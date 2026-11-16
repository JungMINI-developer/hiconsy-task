<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ErrorCode, type Visit, type WaitlistEntry } from '@hiconsy/shared';
import { visitsApi } from '@/api/visits';
import { waitlistApi } from '@/api/waitlist';
import { AppError } from '@/api/client';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { useMyVisitsStore } from '@/stores/myVisits';
import { useSessionStore } from '@/stores/session';
import {
  formatDate,
  formatDuration,
  formatRange,
  formatTime,
  formatTimeRange,
  toDateInputValue,
  toIsoWithOffset,
  toTimeValue,
} from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import {
  findOverlap,
  slotToDate,
  SLOT_MS,
  visitDateOptions,
  visitEndOptions,
  visitStartOptions,
  type BusyRange,
  type Period,
  type SlotValue,
} from '@/utils/visitSlots';
import type { SelectOption } from '@/components/ui/AppSelect.vue';
import AppAlert from '@/components/ui/AppAlert.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import FormField from '@/components/ui/FormField.vue';

export interface VisitRoom extends Period {
  id: number;
  name: string;
}

/**
 * S-22 방문 신청·시간 변경 다이얼로그. 같은 시간 선택 UI로 네 가지 일을 한다.
 * - 신청 / 시간 변경 (`visit`)
 * - 대기 등록 (`waitlist`, #36): 정원이 찬 자습실에 원하는 시간으로 줄을 선다
 * - 자리 확정 (`offer`, #36): 받은 자리 제안을 확정한다 (신청 API가 제안을 소비)
 * 운영 기간 밖·지난 시각은 선택지에서 아예 제외하고, 내 다른 신청과 겹치는 시각은 이유와 함께
 * 비활성화한다 (interaction-rules.md#방문-s-22). 대기는 백업 신청과 겹쳐도 되므로 막지 않고 안내만 한다.
 */
const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
  room: VisitRoom | null;
  /** 있으면 시간 변경 모드 */
  visit?: Visit | null;
  /** 신청 모드에서 보여줄 남은 자리 */
  remaining?: number;
  /** 신청 모드에서 미리 고를 시간 (고를 수 없는 값이면 무시하고 기본값) */
  initialSlot?: SlotValue | null;
  /** 대기 등록 모드 (#36) */
  waitlist?: boolean;
  /** 대기 등록 모드에서 보여줄 현재 대기 인원 */
  waitingCount?: number;
  /** 있으면 자리 확정 모드 (#36) */
  offer?: WaitlistEntry | null;
}>();

/** 정원이 차서 신청이 거절됨 — 거절된 자습실과 고른 시간 */
export interface FullRoomEvent {
  room: VisitRoom;
  startAt: Date;
  endAt: Date;
  /** 다른 자습실이 없을 때 보여줄 안내 문구 */
  message: string;
}

const emit = defineEmits<{
  saved: [visit: Visit, mode: 'apply' | 'update'];
  /** 정원·기간이 바뀌어 목록을 다시 가져와야 함 */
  stale: [];
  full: [event: FullRoomEvent];
  waited: [entry: WaitlistEntry];
}>();

const session = useSessionStore();
const myVisits = useMyVisitsStore();
const toast = useToast();
const handleStudentGone = useStudentGuard();

const isEdit = computed(() => !!props.visit);
const mode = computed<'update' | 'wait' | 'confirm' | 'apply'>(() => {
  if (props.visit) return 'update';
  if (props.waitlist) return 'wait';
  if (props.offer) return 'confirm';
  return 'apply';
});
const TITLE = {
  update: '시간 변경',
  wait: '대기 등록',
  confirm: '자리 확정',
  apply: '방문 신청',
} as const;
const SUBMIT = {
  update: '변경하기',
  wait: '대기 등록',
  confirm: '확정하기',
  apply: '신청하기',
} as const;
const period = computed<Period | null>(() => (props.visit ? props.visit.studyRoom : props.room));
const roomName = computed(() => props.visit?.studyRoom.name ?? props.room?.name ?? '');

const date = ref<string | undefined>();
const start = ref<string | undefined>();
const end = ref<string | undefined>();
const saving = ref(false);
const formError = ref<{ message: string; showMyVisits?: boolean } | null>(null);

/**
 * 내 다른 유효 신청 (시간을 바꾸는 신청 자신은 제외).
 * 같은 학생의 신청끼리는 시간이 겹칠 수 없다 (requirements 9절 #13).
 */
const otherVisits = computed<BusyRange[]>(() => {
  const now = Date.now();
  return myVisits.visits
    .filter(
      (v) =>
        v.status === 'APPLIED' && v.id !== props.visit?.id && new Date(v.endAt).getTime() > now,
    )
    .map((v) => ({
      startAt: new Date(v.startAt),
      endAt: new Date(v.endAt),
      label: v.studyRoom.name,
    }));
});
/** 선택지를 막는 기준. 대기는 백업 신청과 겹쳐도 되므로(#36) 막지 않는다 */
const busy = computed<BusyRange[]>(() => (mode.value === 'wait' ? [] : otherVisits.value));

/** 비활성 선택지 옆에 보여줄 이유 */
const BUSY_HINT = '다른 신청';

function option(value: string, label: string, blocked: boolean): SelectOption<string> {
  return blocked ? { value, label, disabled: true, hint: BUSY_HINT } : { value, label };
}

/** 이 시각에 시작하면 최소 길이(30분)도 머물 수 없는지 */
function isStartBlocked(day: string, time: string): boolean {
  const s = slotToDate(day, time);
  return !s || !!findOverlap(s, new Date(s.getTime() + SLOT_MS), busy.value);
}

function firstEnabled(options: SelectOption<string>[]): string | undefined {
  return options.find((o) => !o.disabled)?.value;
}

const dateOptions = computed(() => {
  const p = period.value;
  if (!p) return [];
  return visitDateOptions(p).map((d) =>
    option(
      d,
      formatDate(`${d}T00:00:00`),
      visitStartOptions(p, d).every((t) => isStartBlocked(d, t)),
    ),
  );
});
const startOptions = computed(() => {
  const day = date.value;
  if (!period.value || !day) return [];
  return visitStartOptions(period.value, day).map((t) => option(t, t, isStartBlocked(day, t)));
});
const startDate = computed(() =>
  date.value && start.value ? slotToDate(date.value, start.value) : null,
);
const endOptions = computed(() => {
  const day = date.value;
  const s = startDate.value;
  if (!period.value || !day || !s) return [];
  return visitEndOptions(period.value, s).map((t) => {
    const e = slotToDate(day, t);
    return option(t, t, !e || !!findOverlap(s, e, busy.value));
  });
});
const noSlots = computed(() => dateOptions.value.length === 0);
/** 운영 기간 안의 시간이 모두 내 다른 신청과 겹친다 */
const allBusy = computed(() => !noSlots.value && dateOptions.value.every((o) => o.disabled));

/** 기본 종료: 시작 + 2시간 (안 되면 고를 수 있는 마지막) */
function defaultEnd(): string | undefined {
  const options = endOptions.value.filter((o) => !o.disabled).map((o) => o.value);
  return options[3] ?? options[options.length - 1];
}

// 열릴 때 초기화: 수정이면 기존 값, 신청이면 첫 선택지
// 소스를 배열로 넘겨 값마다 비교한다. 게터가 새 배열을 돌려주면 stale 재조회로 room 객체만
// 바뀌어도(id는 같아도) 다시 초기화되어, 고른 시간과 서버 에러 문구가 사라진다.
watch(
  [open, () => props.room?.id, () => props.visit?.id],
  ([isOpen]) => {
    if (!isOpen) return;
    formError.value = null;
    if (props.visit) {
      date.value = toDateInputValue(props.visit.startAt);
      start.value = toTimeValue(props.visit.startAt);
      const endAt = new Date(props.visit.endAt);
      end.value = toDateInputValue(endAt) !== date.value ? '24:00' : toTimeValue(endAt);
    } else if (!applyInitialSlot()) {
      date.value = firstEnabled(dateOptions.value);
      start.value = firstEnabled(startOptions.value);
      end.value = defaultEnd();
    }
  },
  { immediate: true },
);

/** 미리 고른 시간(정원 마감 후 다른 자습실 안내에서 넘어온 경우)이 지금 고를 수 있으면 채운다 */
function applyInitialSlot(): boolean {
  const slot = props.initialSlot;
  if (!slot) return false;
  const enabled = (options: SelectOption<string>[], value: string) =>
    options.some((o) => o.value === value && !o.disabled);
  date.value = slot.date;
  start.value = slot.start;
  end.value = slot.end;
  if (
    enabled(dateOptions.value, slot.date) &&
    enabled(startOptions.value, slot.start) &&
    enabled(endOptions.value, slot.end)
  ) {
    return true;
  }
  return false;
}

// 날짜를 바꾸면 시작이, 시작을 바꾸면 종료가 유효한지 맞춘다
watch(date, () => {
  if (!startOptions.value.some((o) => o.value === start.value && !o.disabled)) {
    start.value = firstEnabled(startOptions.value);
  }
});
watch(start, () => {
  if (!endOptions.value.some((o) => o.value === end.value && !o.disabled)) end.value = defaultEnd();
});

const selected = computed(() => {
  if (!date.value || !start.value || !end.value) return null;
  const s = slotToDate(date.value, start.value);
  const e = slotToDate(date.value, end.value);
  return s && e ? { startAt: s, endAt: e } : null;
});

/** 고른 방문 길이 (예: 2시간) */
const duration = computed(() =>
  selected.value ? formatDuration(selected.value.startAt, selected.value.endAt) : '',
);

/** 고른 시간과 겹치는 내 다른 신청 (선택지를 막아도 목록을 다시 받은 뒤엔 생길 수 있다) */
const conflict = computed(() =>
  selected.value
    ? findOverlap(selected.value.startAt, selected.value.endAt, busy.value)
    : undefined,
);

/** 대기 등록 시 내 신청과 겹치면 안내만 한다 (확정하려면 그 신청을 취소하거나 시간을 바꿔야 함) */
const waitConflict = computed(() =>
  mode.value === 'wait' && selected.value
    ? findOverlap(selected.value.startAt, selected.value.endAt, otherVisits.value)
    : undefined,
);

const unchanged = computed(
  () =>
    !!props.visit &&
    !!selected.value &&
    selected.value.startAt.getTime() === new Date(props.visit.startAt).getTime() &&
    selected.value.endAt.getTime() === new Date(props.visit.endAt).getTime(),
);

async function submit() {
  const studentId = session.studentId;
  if (!selected.value || studentId === null || unchanged.value || conflict.value) return;
  formError.value = null;
  saving.value = true;
  const body = {
    startAt: toIsoWithOffset(selected.value.startAt),
    endAt: toIsoWithOffset(selected.value.endAt),
  };
  try {
    if (mode.value === 'wait') {
      emit(
        'waited',
        await waitlistApi.register(studentId, { studyRoomId: props.room!.id, ...body }),
      );
      open.value = false;
      return;
    }
    const saved = props.visit
      ? await visitsApi.updateTime(studentId, props.visit.id, body)
      : await visitsApi.apply(studentId, { studyRoomId: props.room!.id, ...body });
    emit('saved', saved, isEdit.value ? 'update' : 'apply');
    open.value = false;
  } catch (e) {
    handleError(e);
  } finally {
    saving.value = false;
  }
}

function handleError(e: unknown) {
  if (handleStudentGone(e)) {
    open.value = false;
    return;
  }
  const code = e instanceof AppError ? e.code : null;
  // 확정하는 사이 제안이 만료되어 다음 대기자에게 넘어감
  if (code === ErrorCode.CAPACITY_FULL && mode.value === 'confirm') {
    toast.error('자리 제안 시간이 지나 다음 대기자에게 넘어갔어요');
    open.value = false;
    emit('stale');
    return;
  }
  // 정원 마감: 닫고, 같은 시간에 자리가 남은 다른 자습실 안내는 화면이 맡는다 (#35)
  if (code === ErrorCode.CAPACITY_FULL && mode.value === 'apply' && props.room && selected.value) {
    emit('full', { room: props.room, ...selected.value, message: errorMessage(e) });
    open.value = false;
    return;
  }
  switch (code) {
    // 목록 기준이 바뀐 경우: 알리고 닫은 뒤 다시 조회
    case ErrorCode.CAPACITY_FULL:
    case ErrorCode.STUDY_ROOM_NOT_FOUND:
    case ErrorCode.VISIT_ALREADY_CANCELED:
    case ErrorCode.VISIT_ALREADY_STARTED:
    case ErrorCode.VISIT_NOT_FOUND:
      toast.error(errorMessage(e));
      open.value = false;
      emit('stale');
      return;
    // 다른 탭·기기에서 신청해 내 신청 목록이 바뀐 경우: 다시 받아 선택지를 맞춘다
    case ErrorCode.ALREADY_APPLIED:
    case ErrorCode.VISIT_TIME_OVERLAP:
    case ErrorCode.ALREADY_WAITING:
      formError.value = { message: errorMessage(e), showMyVisits: true };
      emit('stale');
      return;
    // 대기하려는 사이 자리가 남음 → 다시 받아 바로 신청하게 한다
    case ErrorCode.ROOM_HAS_SEATS:
      formError.value = { message: errorMessage(e) };
      emit('stale');
      return;
    case ErrorCode.VISIT_OUT_OF_PERIOD:
      // 클라이언트 검증을 통과했다면 그 사이 운영 기간이 바뀐 것
      formError.value = {
        message: period.value
          ? `운영 기간(${formatRange(period.value.startDate, period.value.endDate)}) 안에서 골라 주세요. 운영 기간이 바뀌었을 수 있어요`
          : errorMessage(e),
      };
      emit('stale');
      return;
    default:
      formError.value = { message: errorMessage(e) };
  }
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="`${roomName} ${TITLE[mode]}`"
    :description="period ? `운영 ${formatRange(period.startDate, period.endDate)}` : undefined"
  >
    <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
      <AppAlert v-if="formError" :message="formError.message">
        <RouterLink
          v-if="formError.showMyVisits"
          :to="{ name: 'student-visits' }"
          class="mt-1 inline-block text-label text-accent underline underline-offset-4"
          @click="open = false"
        >
          내 신청으로 가기
        </RouterLink>
      </AppAlert>

      <p v-if="noSlots" class="rounded-lg bg-grey-50 px-4 py-6 text-center text-body text-fg-muted">
        지금 고를 수 있는 시간이 없어요. 운영 기간이 끝났거나 곧 끝나요.
      </p>

      <div
        v-else-if="allBusy"
        class="flex flex-col items-center gap-1 rounded-lg bg-grey-50 px-4 py-6 text-center"
      >
        <p class="text-body text-fg-muted">
          운영 시간이 모두 내 다른 신청과 겹쳐요. 다른 신청의 시간을 바꾸거나 취소한 뒤 신청해
          주세요.
        </p>
        <RouterLink
          :to="{ name: 'student-visits' }"
          class="text-label text-accent underline underline-offset-4"
          @click="open = false"
        >
          내 신청으로 가기
        </RouterLink>
      </div>

      <template v-else>
        <!-- 고를 수 있는 날짜가 하루뿐이면 드롭다운 대신 그 날짜를 보여준다 -->
        <FormField v-if="dateOptions.length > 1" id="visit-date" v-slot="{ id }" label="날짜">
          <AppSelect :id="id" v-model="date" :options="dateOptions" />
        </FormField>
        <div v-else class="flex flex-col gap-1.5">
          <p class="text-label">날짜</p>
          <p class="text-body tabular-nums">{{ dateOptions[0]?.label }}</p>
        </div>

        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1.5 text-label">방문 시간</legend>
          <div class="flex items-center gap-2">
            <AppSelect
              v-model="start"
              :options="startOptions"
              aria-label="방문 시작 시각"
              open-below
              class="flex-1"
            />
            <span class="text-fg-muted" aria-hidden="true">–</span>
            <AppSelect
              v-model="end"
              :options="endOptions"
              aria-label="방문 종료 시각"
              open-below
              class="flex-1"
            />
          </div>
          <p class="text-caption text-fg-muted">
            <span v-if="duration" class="font-semibold text-fg">{{ duration }}</span>
            <span v-if="duration" aria-hidden="true"> · </span>
            30분 단위로, 운영 기간 안에서만 고를 수 있어요
          </p>
          <p v-if="busy.length > 0" class="text-caption text-fg-muted">
            내 다른 신청과 겹치는 시간은 고를 수 없어요
          </p>
          <p v-if="conflict" class="text-caption text-status-danger" role="alert">
            {{ conflict.label }} 신청({{ formatTimeRange(conflict.startAt, conflict.endAt) }})과
            겹쳐요<template v-if="mode === 'confirm'"
              >. 그 신청을 취소하거나 다른 시간을 골라 주세요</template
            >
          </p>
          <p v-if="waitConflict" class="text-caption text-fg-muted">
            {{ waitConflict.label }} 신청({{
              formatTimeRange(waitConflict.startAt, waitConflict.endAt)
            }})과 겹쳐요. 자리가 나서 확정하려면 그 신청을 취소하거나 시간을 바꿔야 해요
          </p>
        </fieldset>

        <p v-if="mode === 'apply' && remaining !== undefined" class="text-body">
          남은 자리 <span class="font-medium tabular-nums">{{ remaining }}</span>
        </p>
        <p v-if="mode === 'wait'" class="text-body">
          <template v-if="waitingCount">
            대기 <span class="font-medium tabular-nums">{{ waitingCount }}명</span> ·
          </template>
          자리가 나면 순번대로 10분 동안 자리를 잡아 드려요
        </p>
        <p v-if="mode === 'confirm' && offer?.offerExpiresAt" class="text-body">
          <span class="font-medium tabular-nums">{{ formatTime(offer.offerExpiresAt) }}</span>까지
          확정하면 자리가 내 것이 돼요
        </p>
        <p v-if="isEdit && visit" class="text-caption text-fg-muted">
          지금 신청한 시간: {{ formatDate(visit.startAt) }}
          {{ formatTimeRange(visit.startAt, visit.endAt) }}
        </p>
      </template>

      <p v-if="unchanged" class="-mb-2 text-caption text-fg-muted">바꿀 시간을 골라 주세요</p>
      <div class="mt-2 flex gap-2">
        <AppButton variant="secondary" size="lg" class="flex-1" @click="open = false"
          >닫기</AppButton
        >
        <AppButton
          v-if="!noSlots && !allBusy"
          type="submit"
          size="lg"
          class="flex-1"
          :loading="saving"
          :disabled="!selected || unchanged || !!conflict"
        >
          {{ SUBMIT[mode] }}
        </AppButton>
      </div>
    </form>
  </AppDialog>
</template>
