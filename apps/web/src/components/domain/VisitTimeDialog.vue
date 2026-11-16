<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ErrorCode, type SeatAvailability, type Visit } from '@hiconsy/shared';
import { studyRoomsApi } from '@/api/studyRooms';
import { visitsApi } from '@/api/visits';
import { AppError } from '@/api/client';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { useMyVisitsStore } from '@/stores/myVisits';
import { useSessionStore } from '@/stores/session';
import {
  formatDate,
  formatDuration,
  formatRange,
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
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import FormField from '@/components/ui/FormField.vue';
import SeatGrid from './SeatGrid.vue';

export interface VisitRoom extends Period {
  id: number;
  name: string;
}

/**
 * S-22 방문 신청·시간 변경 다이얼로그 — 한 화면에서 시간과 좌석을 고른다 (#49).
 * 운영 기간 밖·지난 시각은 선택지에서 아예 제외하고,
 * 내 다른 신청과 겹치는 시각은 이유와 함께 비활성화한다 (interaction-rules.md#방문-s-22).
 * 좌석은 고른 시간 내내 비어 있는 좌석만 고를 수 있고, 시간을 바꿀 때마다 배치도를 다시 받는다.
 */
const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
  room: VisitRoom | null;
  /** 있으면 시간 변경 모드 */
  visit?: Visit | null;
  /** 신청 모드에서 미리 고를 시간 (고를 수 없는 값이면 무시하고 기본값) */
  initialSlot?: SlotValue | null;
}>();

/** 고른 시간에 빈 좌석이 없어 같은 시간의 다른 자습실을 찾음 (S-23) */
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
  /** [같은 시간에 빈 좌석이 있는 자습실 보기] — 다이얼로그는 화면이 닫는다 (후보가 있을 때만) */
  full: [event: FullRoomEvent];
}>();

const session = useSessionStore();
const myVisits = useMyVisitsStore();
const toast = useToast();
const handleStudentGone = useStudentGuard();

const isEdit = computed(() => !!props.visit);
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
const busy = computed<BusyRange[]>(() => {
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

// ── 좌석 (#49) ──────────────────────────────────────────────

const roomId = computed(() => props.visit?.studyRoom.id ?? props.room?.id ?? null);
const seats = ref<SeatAvailability[]>([]);
const seatId = ref<number | null>(null);
const seatsLoading = ref(false);
const seatsError = ref<string | null>(null);
/** 다이얼로그를 연 뒤 첫 좌석 응답을 받았는지 (그 전엔 스켈레톤) */
const seatsLoaded = ref(false);
/** 연 직후 첫 조회면 좌석을 미리 골라 둔다 */
let pickDefaultSeat = false;
/** 늦게 온 응답 버리기 */
let seatRequest = 0;
/**
 * 좌석 안내를 토스트로 띄우고, 다이얼로그 안 라이브 영역으로도 읽어 준다.
 * 모달이 열려 있으면 바깥의 토스트 영역은 접근성 트리에서 가려져 스크린리더가 읽지 못한다.
 */
const seatNotice = ref('');
function notifySeat(message: string) {
  toast.error(message);
  seatNotice.value = message;
}

const freeSeatCount = computed(() => seats.value.filter((s) => s.available).length);
const selectedSeat = computed(() => seats.value.find((s) => s.id === seatId.value) ?? null);
const mySeatId = computed(() => props.visit?.seat?.id ?? null);

/** 미리 고를 좌석: 시간 변경이면 지금 좌석, 재신청이면 이전 좌석 */
const preferredSeatId = computed(() => {
  if (props.visit) return props.visit.seat?.id ?? null;
  const previous = myVisits.visits.find(
    (v) => v.status === 'CANCELED' && v.studyRoom.id === props.room?.id,
  );
  return previous?.seat?.id ?? null;
});

/**
 * 고른 시간의 좌석을 다시 받는다.
 * - 연 직후: 미리 고를 좌석이 비어 있으면 그 좌석, 아니면 가장 작은 번호의 빈 좌석
 * - 시간을 바꾼 뒤: 고른 좌석이 그 시간에 차 있으면 선택을 풀고 알린다
 */
async function loadSeats(reason: 'time' | 'refresh' = 'time') {
  const id = roomId.value;
  const range = selected.value;
  const request = ++seatRequest;
  if (!open.value || id === null || !range) {
    seats.value = [];
    seatsLoading.value = false;
    return;
  }
  seatsLoading.value = true;
  seatsError.value = null;
  try {
    const list = await studyRoomsApi.seats(
      id,
      { startAt: toIsoWithOffset(range.startAt), endAt: toIsoWithOffset(range.endAt) },
      props.visit?.id,
    );
    if (request !== seatRequest) return;
    seats.value = list;
    seatsLoaded.value = true;
    const isFree = (sid: number | null) => list.some((s) => s.id === sid && s.available);
    if (pickDefaultSeat) {
      pickDefaultSeat = false;
      seatId.value = isFree(preferredSeatId.value)
        ? preferredSeatId.value
        : (list.find((s) => s.available)?.id ?? null);
    } else if (seatId.value !== null && !isFree(seatId.value)) {
      seatId.value = null;
      if (reason === 'time') {
        notifySeat('그 시간에는 다른 학생이 이미 예약한 좌석이에요. 다른 좌석을 골라 주세요');
      }
    }
  } catch (e) {
    if (request !== seatRequest) return;
    if (handleStudentGone(e)) {
      open.value = false;
      return;
    }
    seatsError.value = errorMessage(e);
  } finally {
    if (request === seatRequest) seatsLoading.value = false;
  }
}

// 열리거나 자습실·시간이 바뀌면 좌석을 다시 받는다
watch(
  [open, roomId, () => selected.value?.startAt.getTime(), () => selected.value?.endAt.getTime()],
  ([isOpen], previous) => {
    const [wasOpen, prevRoomId] = previous ?? [false, null];
    if (!isOpen) {
      seatNotice.value = '';
      seats.value = [];
      seatId.value = null;
      seatsLoaded.value = false;
      return;
    }
    if (!wasOpen || prevRoomId !== roomId.value) {
      pickDefaultSeat = true;
      seatsLoaded.value = false;
    }
    void loadSeats('time');
  },
  { immediate: true },
);

/** [같은 시간에 빈 좌석이 있는 자습실 보기] (S-23) */
function findOtherRooms() {
  if (!props.room || !selected.value) return;
  emit('full', {
    room: props.room,
    ...selected.value,
    message: '같은 시간에 빈 좌석이 있는 자습실이 없어요',
  });
}

const unchanged = computed(
  () =>
    !!props.visit &&
    !!selected.value &&
    selected.value.startAt.getTime() === new Date(props.visit.startAt).getTime() &&
    selected.value.endAt.getTime() === new Date(props.visit.endAt).getTime() &&
    seatId.value === (props.visit.seat?.id ?? null),
);

async function submit() {
  const studentId = session.studentId;
  if (
    !selected.value ||
    seatId.value === null ||
    studentId === null ||
    unchanged.value ||
    conflict.value
  ) {
    return;
  }
  formError.value = null;
  saving.value = true;
  const body = {
    startAt: toIsoWithOffset(selected.value.startAt),
    endAt: toIsoWithOffset(selected.value.endAt),
    seatId: seatId.value,
  };
  try {
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
  switch (code) {
    // 고른 좌석을 그 사이 다른 학생이 가져갔거나 쓸 수 없게 됨: 다이얼로그를 두고 배치도를 다시 받는다
    case ErrorCode.SEAT_TAKEN:
    case ErrorCode.SEAT_NOT_FOUND:
    case ErrorCode.CAPACITY_FULL: {
      const number = selectedSeat.value?.number;
      notifySeat(
        code === ErrorCode.SEAT_TAKEN && number !== undefined
          ? `방금 다른 학생이 ${number}번 좌석을 예약했어요. 다른 좌석을 골라 주세요`
          : errorMessage(e),
      );
      seatId.value = null;
      void loadSeats('refresh');
      emit('stale');
      return;
    }
    // 목록 기준이 바뀐 경우: 알리고 닫은 뒤 다시 조회
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
      formError.value = { message: errorMessage(e), showMyVisits: true };
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
    :title="`${roomName} ${isEdit ? '시간 변경' : '방문 신청'}`"
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
            겹쳐요
          </p>
        </fieldset>

        <p v-if="isEdit && visit" class="-mt-2 text-caption text-fg-muted">
          지금 신청한 시간: {{ formatDate(visit.startAt) }}
          {{ formatTimeRange(visit.startAt, visit.endAt)
          }}<template v-if="visit.seat"> · {{ visit.seat.number }}번 좌석</template>
        </p>

        <!-- 좌석 (#49): 고른 시간 내내 비어 있는 좌석만 고를 수 있다 -->
        <section
          aria-labelledby="visit-seat-heading"
          class="flex flex-col gap-3 border-t border-line pt-5"
        >
          <p class="sr-only" aria-live="assertive">{{ seatNotice }}</p>
          <div class="flex items-baseline justify-between gap-3">
            <h3 id="visit-seat-heading" class="text-label">좌석</h3>
            <p
              v-if="seatsLoaded && !seatsError"
              class="text-caption text-fg-muted tabular-nums"
              aria-live="polite"
            >
              이 시간 빈 좌석 {{ freeSeatCount }}석
            </p>
          </div>

          <div v-if="seatsError" class="flex flex-col items-start gap-2" role="alert">
            <p class="text-caption text-status-danger">
              좌석을 불러오지 못했어요. {{ seatsError }}
            </p>
            <AppButton variant="secondary" size="sm" @click="loadSeats('refresh')">
              다시 시도
            </AppButton>
          </div>
          <AppSkeleton v-else-if="!seatsLoaded" class="h-48 w-full rounded-lg" />
          <template v-else>
            <SeatGrid
              v-model="seatId"
              :seats="seats"
              :my-seat-id="mySeatId"
              :disabled="saving"
              :aria-busy="seatsLoading || undefined"
              :class="seatsLoading && 'opacity-60'"
            />
            <div
              v-if="freeSeatCount === 0"
              class="flex flex-col items-start gap-2 rounded-lg bg-grey-50 px-4 py-3"
            >
              <p class="text-body text-fg-muted">그 시간 내내 비어 있는 좌석이 없어요</p>
              <AppButton v-if="!isEdit && room" variant="weak" size="sm" @click="findOtherRooms">
                같은 시간에 빈 좌석이 있는 자습실 보기
              </AppButton>
            </div>
            <p v-else-if="selectedSeat" class="text-body">
              <span class="font-medium tabular-nums">{{ selectedSeat.number }}번 좌석</span>에
              앉아요
            </p>
            <p v-else class="text-caption text-fg-muted">앉을 좌석을 골라 주세요</p>
          </template>
        </section>
      </template>

      <p v-if="unchanged" class="-mb-2 text-caption text-fg-muted">
        바꿀 시간이나 좌석을 골라 주세요
      </p>
      <!-- 좌석이 많아 다이얼로그가 스크롤되어도 버튼은 아래에 붙어 보인다 -->
      <div class="sticky -bottom-6 z-10 -mx-6 mt-2 -mb-6 flex gap-2 bg-surface px-6 pt-3 pb-6">
        <AppButton variant="secondary" size="lg" class="flex-1" @click="open = false"
          >닫기</AppButton
        >
        <AppButton
          v-if="!noSlots && !allBusy"
          type="submit"
          size="lg"
          class="flex-1"
          :loading="saving"
          :disabled="!selected || seatId === null || seatsLoading || unchanged || !!conflict"
        >
          {{ isEdit ? '변경하기' : '신청하기' }}
        </AppButton>
      </div>
    </form>
  </AppDialog>
</template>
