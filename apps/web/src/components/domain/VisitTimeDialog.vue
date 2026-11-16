<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ErrorCode, type SeatAvailability, type Visit } from '@hiconsy/shared';
import { studyRoomsApi } from '@/api/studyRooms';
import { visitsApi } from '@/api/visits';
import { AppError } from '@/api/client';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { useVisitTimePicker } from '@/composables/useVisitTimePicker';
import { useSessionStore } from '@/stores/session';
import { formatDate, formatRange, formatTimeRange, toIsoWithOffset } from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import AppAlert from '@/components/ui/AppAlert.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import VisitTimeFields from './VisitTimeFields.vue';

/**
 * S-22b 방문 시간 변경 모달 (#49) — **시간만** 바꾼다. 좌석은 그대로 둔다.
 * 지금 좌석이 새 시간에 다른 학생에게 예약돼 있으면 [변경하기]를 막고 알린다
 * (좌석을 바꾸려면 취소한 뒤 다시 신청한다).
 */
const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{ visit: Visit | null }>();

const emit = defineEmits<{
  saved: [visit: Visit];
  /** 신청·기간이 바뀌어 목록을 다시 가져와야 함 */
  stale: [];
}>();

const session = useSessionStore();
const toast = useToast();
const handleStudentGone = useStudentGuard();

const visit = toRef(props, 'visit');
const period = computed(() => props.visit?.studyRoom ?? null);
const picker = useVisitTimePicker(period, visit);
const saving = ref(false);
const formError = ref<{ message: string; showMyVisits?: boolean } | null>(null);

watch(
  [open, () => props.visit?.id],
  ([isOpen]) => {
    if (!isOpen) return;
    formError.value = null;
    picker.reset({ visit: props.visit });
  },
  { immediate: true },
);

// ── 지금 좌석이 새 시간에도 비어 있는지 ──────────────────────
const seats = ref<SeatAvailability[] | null>(null);
let request = 0;
async function checkSeat() {
  const range = picker.selected.value;
  const current = ++request;
  seats.value = null;
  if (!open.value || !props.visit || !range) return;
  try {
    const list = await studyRoomsApi.seats(
      props.visit.studyRoom.id,
      { startAt: toIsoWithOffset(range.startAt), endAt: toIsoWithOffset(range.endAt) },
      props.visit.id,
    );
    if (current === request) seats.value = list;
  } catch (e) {
    if (current === request && !handleStudentGone(e)) seats.value = [];
  }
}
watch(
  [
    open,
    () => picker.selected.value?.startAt.getTime(),
    () => picker.selected.value?.endAt.getTime(),
  ],
  () => void checkSeat(),
  { immediate: true },
);
const seatNumber = computed(() => props.visit?.seat?.number ?? null);
/** 새 시간에 지금 좌석이 이미 예약돼 있다 (확인 전·좌석 없음은 막지 않는다) */
const seatTaken = computed(() => {
  const seatId = props.visit?.seat?.id;
  if (!seats.value || seatId === undefined) return false;
  return !seats.value.some((s) => s.id === seatId && s.available);
});

const unchanged = computed(
  () =>
    !!props.visit &&
    !!picker.selected.value &&
    picker.selected.value.startAt.getTime() === new Date(props.visit.startAt).getTime() &&
    picker.selected.value.endAt.getTime() === new Date(props.visit.endAt).getTime(),
);

async function submit() {
  const studentId = session.studentId;
  const range = picker.selected.value;
  if (!props.visit || !range || studentId === null) return;
  if (unchanged.value || picker.conflict.value || seatTaken.value) return;
  formError.value = null;
  saving.value = true;
  try {
    const saved = await visitsApi.updateTime(studentId, props.visit.id, {
      startAt: toIsoWithOffset(range.startAt),
      endAt: toIsoWithOffset(range.endAt),
    });
    emit('saved', saved);
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
    // 그 사이 다른 학생이 새 시간에 내 좌석을 예약함
    case ErrorCode.SEAT_TAKEN:
    case ErrorCode.SEAT_NOT_FOUND:
      void checkSeat();
      return;
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
    case ErrorCode.VISIT_TIME_OVERLAP:
      formError.value = { message: errorMessage(e), showMyVisits: true };
      emit('stale');
      return;
    case ErrorCode.VISIT_OUT_OF_PERIOD:
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
    :title="`${visit?.studyRoom.name ?? ''} 시간 변경`"
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

      <p
        v-if="picker.noSlots.value"
        class="rounded-lg bg-grey-50 px-4 py-6 text-center text-body text-fg-muted"
      >
        지금 고를 수 있는 시간이 없어요. 운영 기간이 끝났거나 곧 끝나요.
      </p>
      <template v-else>
        <VisitTimeFields :picker="picker" />
        <p v-if="visit" class="-mt-2 text-caption text-fg-muted">
          지금 신청한 시간: {{ formatDate(visit.startAt) }}
          {{ formatTimeRange(visit.startAt, visit.endAt) }}
        </p>
        <p v-if="seatNumber !== null && !seatTaken" class="text-body">
          좌석은 <span class="font-medium tabular-nums">{{ seatNumber }}번 좌석</span> 그대로예요
        </p>
        <p v-else-if="seatTaken" class="text-caption text-status-danger" role="alert">
          {{ seatNumber }}번 좌석은 그 시간에 다른 학생이 예약했어요. 좌석을 바꾸려면 취소한 뒤 다시
          신청해 주세요
        </p>
      </template>

      <p v-if="unchanged" class="-mb-2 text-caption text-fg-muted">바꿀 시간을 골라 주세요</p>
      <div class="mt-2 flex gap-2">
        <AppButton variant="secondary" size="lg" class="flex-1" @click="open = false">
          닫기
        </AppButton>
        <AppButton
          v-if="!picker.noSlots.value"
          type="submit"
          size="lg"
          class="flex-1"
          :loading="saving"
          :disabled="!picker.selected.value || unchanged || !!picker.conflict.value || seatTaken"
        >
          변경하기
        </AppButton>
      </div>
    </form>
  </AppDialog>
</template>
