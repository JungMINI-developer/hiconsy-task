<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ErrorCode, type Visit } from '@hiconsy/shared';
import { visitsApi } from '@/api/visits';
import { AppError } from '@/api/client';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
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
  slotToDate,
  visitDateOptions,
  visitEndOptions,
  visitStartOptions,
  type Period,
} from '@/utils/visitSlots';
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
 * S-22 방문 신청·시간 변경 다이얼로그.
 * 운영 기간 밖·지난 시각은 선택지에서 아예 제외한다 (interaction-rules.md#방문-s-22).
 */
const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
  room: VisitRoom | null;
  /** 있으면 시간 변경 모드 */
  visit?: Visit | null;
  /** 신청 모드에서 보여줄 남은 자리 */
  remaining?: number;
}>();

const emit = defineEmits<{
  saved: [visit: Visit, mode: 'apply' | 'update'];
  /** 정원·기간이 바뀌어 목록을 다시 가져와야 함 */
  stale: [];
}>();

const session = useSessionStore();
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

const dateOptions = computed(() =>
  period.value
    ? visitDateOptions(period.value).map((d) => ({ value: d, label: formatDate(`${d}T00:00:00`) }))
    : [],
);
const startOptions = computed(() =>
  period.value && date.value
    ? visitStartOptions(period.value, date.value).map((t) => ({ value: t, label: t }))
    : [],
);
const startDate = computed(() =>
  date.value && start.value ? slotToDate(date.value, start.value) : null,
);
const endOptions = computed(() =>
  period.value && startDate.value
    ? visitEndOptions(period.value, startDate.value).map((t) => ({ value: t, label: t }))
    : [],
);
const noSlots = computed(() => dateOptions.value.length === 0);

/** 기본 종료: 시작 + 2시간 (안 되면 고를 수 있는 마지막) */
function defaultEnd(): string | undefined {
  const options = endOptions.value.map((o) => o.value);
  return options[3] ?? options[options.length - 1];
}

// 열릴 때 초기화: 수정이면 기존 값, 신청이면 첫 선택지
watch(
  () => [open.value, props.room?.id, props.visit?.id] as const,
  ([isOpen]) => {
    if (!isOpen) return;
    formError.value = null;
    if (props.visit) {
      date.value = toDateInputValue(props.visit.startAt);
      start.value = toTimeValue(props.visit.startAt);
      const endAt = new Date(props.visit.endAt);
      end.value = toDateInputValue(endAt) !== date.value ? '24:00' : toTimeValue(endAt);
    } else {
      date.value = dateOptions.value[0]?.value;
      start.value = startOptions.value[0]?.value;
      end.value = defaultEnd();
    }
  },
  { immediate: true },
);

// 날짜를 바꾸면 시작이, 시작을 바꾸면 종료가 유효한지 맞춘다
watch(date, () => {
  if (!startOptions.value.some((o) => o.value === start.value)) {
    start.value = startOptions.value[0]?.value;
  }
});
watch(start, () => {
  if (!endOptions.value.some((o) => o.value === end.value)) end.value = defaultEnd();
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

const unchanged = computed(
  () =>
    !!props.visit &&
    !!selected.value &&
    selected.value.startAt.getTime() === new Date(props.visit.startAt).getTime() &&
    selected.value.endAt.getTime() === new Date(props.visit.endAt).getTime(),
);

async function submit() {
  const studentId = session.studentId;
  if (!selected.value || studentId === null || unchanged.value) return;
  formError.value = null;
  saving.value = true;
  const body = {
    startAt: toIsoWithOffset(selected.value.startAt),
    endAt: toIsoWithOffset(selected.value.endAt),
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
    case ErrorCode.ALREADY_APPLIED:
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
              class="flex-1"
            />
            <span class="text-fg-muted" aria-hidden="true">–</span>
            <AppSelect
              v-model="end"
              :options="endOptions"
              aria-label="방문 종료 시각"
              class="flex-1"
            />
          </div>
          <p class="text-caption text-fg-muted">
            <span v-if="duration" class="font-semibold text-fg">{{ duration }}</span>
            <span v-if="duration" aria-hidden="true"> · </span>
            30분 단위로, 운영 기간 안에서만 고를 수 있어요
          </p>
        </fieldset>

        <p v-if="!isEdit && remaining !== undefined" class="text-body">
          남은 자리 <span class="font-medium tabular-nums">{{ remaining }}</span>
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
          v-if="!noSlots"
          type="submit"
          size="lg"
          class="flex-1"
          :loading="saving"
          :disabled="!selected || unchanged"
        >
          {{ isEdit ? '변경하기' : '신청하기' }}
        </AppButton>
      </div>
    </form>
  </AppDialog>
</template>
