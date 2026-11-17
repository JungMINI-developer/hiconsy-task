<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ErrorCode, type Visit } from '@hiconsy/shared';
import { ChevronLeft } from 'lucide-vue-next';
import { AppError } from '@/api/client';
import { studyRoomsApi } from '@/api/studyRooms';
import { visitsApi } from '@/api/visits';
import { useAsync } from '@/composables/useAsync';
import { useFullRoomFallback } from '@/composables/useFullRoomFallback';
import { useAutoRefresh, useRefetchOnVisible } from '@/composables/useRefetch';
import { useSeatPicker } from '@/composables/useSeatPicker';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { useVisitTimePicker } from '@/composables/useVisitTimePicker';
import { useVisitToast } from '@/composables/useVisitToast';
import { isVisitEditable, isVisitInProgress, useMyVisitsStore } from '@/stores/myVisits';
import { useVisitCheckout } from '@/composables/useVisitCheckout';
import { useSessionStore } from '@/stores/session';
import {
  formatDate,
  formatRange,
  formatTimeRange,
  getRoomPhase,
  isSameDay,
  toIsoWithOffset,
} from '@/utils/datetime';
import { seatUsageText } from '@/utils/roomSeats';
import { errorMessage } from '@/utils/errorMessage';
import { visitChangeText } from '@/utils/visitChange';
import { decodeSlot, hasAvailableSlot } from '@/utils/visitSlots';
import PageShell from '@/components/layout/PageShell.vue';
import AlternativeRoomsDialog from '@/components/domain/AlternativeRoomsDialog.vue';
import SeatGrid from '@/components/domain/SeatGrid.vue';
import VisitTimeFields from '@/components/domain/VisitTimeFields.vue';
import AppAlert from '@/components/ui/AppAlert.vue';
import AppButton from '@/components/ui/AppButton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import { buttonVariants } from '@/components/ui/variants';

/**
 * S-22 학생 · 자습실 페이지 `/student/rooms/:id` (#49)
 * 위 얇은 헤더에서 날짜·방문 시간을 고르고, 아래 큰 좌석 현황에서 좌석을 고른 뒤
 * 하단 [신청하기]로 신청한다.
 * 이미 신청한 자습실이면 내 시간·좌석을 보여주고, [시간 변경]·[좌석 변경]으로 **변경 모드**(`?edit=1`)에
 * 들어가 시간과 좌석을 함께 바꾼다 (두 버튼은 같은 모드, 포커스만 다르다).
 * 좌석 현황은 30초마다 다시 받는다 (보는 동안 다른 학생이 신청할 수 있다).
 */
const props = defineProps<{ id: number }>();

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const myVisits = useMyVisitsStore();
const toast = useToast();
const visitToast = useVisitToast();
const handleStudentGone = useStudentGuard();

const page = useAsync(async () => {
  const [room] = await Promise.all([studyRoomsApi.get(props.id), myVisits.load()]);
  return room;
});
const room = computed(() => page.data.value ?? null);
const notFound = computed(
  () =>
    page.error.value?.code === ErrorCode.STUDY_ROOM_NOT_FOUND ||
    (!!room.value && getRoomPhase(room.value) === 'ended'),
);

/** 내 유효 신청 (있으면 신청 대신 변경) */
const myVisit = computed<Visit | null>(() => myVisits.activeByRoom.get(props.id) ?? null);
/** 변경 모드: 내 신청이 있고 아직 시작 전일 때 `?edit=1` */
const editing = computed(
  () => route.query.edit === '1' && !!myVisit.value && isVisitEditable(myVisit.value),
);
/** 신청한 자습실을 보기만 하는 상태 (시간·좌석 고르기 꺼짐) */
const viewOnly = computed(() => !!myVisit.value && !editing.value);

// ── 시간 ───────────────────────────────────────────────
const picker = useVisitTimePicker(room, myVisit);
/** 자습실을 불러온 뒤 한 번만 시간을 채운다: 내 신청 → ?slot= → 첫 시간 */
const ready = ref(false);
watch(
  room,
  (r) => {
    if (!r || r.id !== props.id || ready.value) return;
    picker.reset({ visit: myVisit.value, slot: decodeSlot(route.query.slot) });
    ready.value = true;
  },
  { immediate: true },
);

// ── 좌석 ───────────────────────────────────────────────
/** 재신청이면 이전 좌석을 미리 고른다 */
const preferredSeatId = computed(() => {
  if (myVisit.value) return myVisit.value.seat?.id ?? null;
  const previous = myVisits.visits.find(
    (v) => v.status === 'CANCELED' && v.studyRoom.id === props.id,
  );
  return previous?.seat?.id ?? null;
});
const seat = useSeatPicker({
  roomId: computed(() => props.id),
  range: picker.selected,
  preferredSeatId,
  exceptVisitId: computed(() => myVisit.value?.id),
  active: computed(() => ready.value && !notFound.value),
});

async function refresh() {
  await page.run();
  if (page.error.value) handleStudentGone(page.error.value);
}

// 퇴실 (#66) — 진행 중인 내 방문은 시간·좌석 변경 대신 퇴실
const checkout = useVisitCheckout(() => refresh());
// 다른 자습실 안내(S-23)에서 다른 자습실로 옮기면 같은 화면을 다시 쓴다 → 새로 불러온다
watch(
  () => props.id,
  () => {
    ready.value = false;
    formError.value = null;
    void refresh();
  },
);
useRefetchOnVisible(async () => {
  await refresh();
  void seat.reload('poll');
});
useAutoRefresh(async () => {
  await refresh();
  void seat.reload('poll');
});

/** 신청을 막는 상태 */
const blocked = computed<string | null>(() => {
  const r = room.value;
  if (!r) return null;
  if (!hasAvailableSlot(r)) return '신청할 수 있는 시간이 지났어요';
  if (!r.hasFreeSlot && !myVisit.value) return '남은 시간에 빈 좌석이 없어요';
  return null;
});

function visitText(v: { startAt: string | Date; endAt: string | Date }) {
  return isSameDay(v.startAt, v.endAt)
    ? `${formatDate(v.startAt)} ${formatTimeRange(v.startAt, v.endAt)}`
    : formatRange(v.startAt, v.endAt);
}

// ── 신청 ───────────────────────────────────────────────
const saving = ref(false);
const formError = ref<{ message: string; showMyVisits?: boolean } | null>(null);
const canApply = computed(
  () =>
    !myVisit.value &&
    !blocked.value &&
    !!picker.selected.value &&
    seat.seatId.value !== null &&
    !seat.loading.value &&
    !picker.conflict.value,
);

async function apply() {
  const studentId = session.studentId;
  const range = picker.selected.value;
  if (!canApply.value || studentId === null || !range || seat.seatId.value === null) return;
  formError.value = null;
  saving.value = true;
  try {
    const visit = await visitsApi.apply(studentId, {
      studyRoomId: props.id,
      startAt: toIsoWithOffset(range.startAt),
      endAt: toIsoWithOffset(range.endAt),
      seatId: seat.seatId.value,
    });
    visitToast.applied(visit);
    await refresh();
    void seat.reload('refresh');
  } catch (e) {
    handleApplyError(e);
  } finally {
    saving.value = false;
  }
}

function handleApplyError(e: unknown) {
  if (handleStudentGone(e)) return;
  const code = e instanceof AppError ? e.code : null;
  switch (code) {
    // 고른 좌석을 그 사이 다른 학생이 가져갔거나 쓸 수 없게 됨: 좌석을 다시 받는다
    case ErrorCode.SEAT_TAKEN:
    case ErrorCode.SEAT_NOT_FOUND:
    case ErrorCode.CAPACITY_FULL: {
      const number = seat.selectedSeat.value?.number;
      seat.notify(
        code === ErrorCode.SEAT_TAKEN && number !== undefined
          ? `방금 다른 학생이 ${number}번 좌석을 예약했어요. 다른 좌석을 골라 주세요`
          : errorMessage(e),
      );
      seat.seatId.value = null;
      void seat.reload('refresh');
      return;
    }
    // 다른 탭·기기에서 신청해 내 신청 목록이 바뀐 경우
    case ErrorCode.ALREADY_APPLIED:
    case ErrorCode.VISIT_TIME_OVERLAP:
      formError.value = { message: errorMessage(e), showMyVisits: true };
      void refresh();
      return;
    case ErrorCode.STUDY_ROOM_NOT_FOUND:
    case ErrorCode.VISIT_OUT_OF_PERIOD:
      toast.error(errorMessage(e));
      void refresh();
      return;
    default:
      formError.value = { message: errorMessage(e) };
  }
}

// ── 빈 좌석이 없을 때 같은 시간의 다른 자습실 (S-23) ─────────
const full = useFullRoomFallback();
function findOtherRooms() {
  const r = room.value;
  const range = picker.selected.value;
  if (r && range) void full.onFull({ room: r, ...range });
}

// ── 변경 모드 (?edit=1) ─────────────────────────────────
const timeBar = ref<HTMLElement | null>(null);
const seatSection = ref<HTMLElement | null>(null);

/** 내 신청의 시간·좌석으로 되돌린다 */
function resetToMyVisit() {
  const visit = myVisit.value;
  if (!visit) return;
  picker.reset({ visit });
  seat.seatId.value = visit.seat?.id ?? null;
}

/** [시간 변경]은 시간 헤더에, [좌석 변경]은 좌석 현황에 포커스를 둔다 */
async function enterEdit(target: 'time' | 'seat') {
  resetToMyVisit();
  formError.value = null;
  await router.replace({ query: { ...route.query, edit: '1' } });
  await nextTick();
  const el =
    target === 'time'
      ? timeBar.value?.querySelector<HTMLElement>('[aria-label="방문 시작 시각"]')
      : seatSection.value?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]');
  el?.focus();
}

/** 주소에서 `edit`만 뺀 쿼리 */
function queryWithoutEdit() {
  const query = { ...route.query };
  delete query.edit;
  return query;
}

async function exitEdit() {
  await router.replace({ query: queryWithoutEdit() });
  resetToMyVisit();
}

/** 바뀐 것만 `3번 → 7번 좌석 · 11:00 – 13:00 → 12:00 – 14:00` */
const changeText = computed(() => {
  const visit = myVisit.value;
  const range = picker.selected.value;
  if (!editing.value || !visit || !range) return '';
  return visitChangeText(
    { startAt: visit.startAt, endAt: visit.endAt, seatNumber: visit.seat?.number ?? null },
    { ...range, seatNumber: seat.selectedSeat.value?.number ?? null },
  );
});
const canSave = computed(
  () =>
    editing.value &&
    !!changeText.value &&
    seat.seatId.value !== null &&
    !seat.loading.value &&
    !picker.conflict.value,
);

async function saveChange() {
  const studentId = session.studentId;
  const visit = myVisit.value;
  const range = picker.selected.value;
  if (!canSave.value || studentId === null || !visit || !range || seat.seatId.value === null) {
    return;
  }
  formError.value = null;
  saving.value = true;
  try {
    const saved = await visitsApi.updateTime(studentId, visit.id, {
      startAt: toIsoWithOffset(range.startAt),
      endAt: toIsoWithOffset(range.endAt),
      seatId: seat.seatId.value,
    });
    visitToast.updated(visit, saved);
    await router.replace({ query: queryWithoutEdit() });
    await refresh();
    resetToMyVisit();
    void seat.reload('refresh');
  } catch (e) {
    handleSaveError(e);
  } finally {
    saving.value = false;
  }
}

function handleSaveError(e: unknown) {
  const code = e instanceof AppError ? e.code : null;
  // 그 사이 시작했거나 취소된 신청: 알리고 변경 모드를 닫는다
  if (
    code === ErrorCode.VISIT_ALREADY_STARTED ||
    code === ErrorCode.VISIT_ALREADY_CANCELED ||
    code === ErrorCode.VISIT_NOT_FOUND
  ) {
    toast.error(errorMessage(e));
    void exitEdit();
    void refresh();
    return;
  }
  // 나머지(좌석 선점·겹침·기간)는 신청과 같게 처리한다
  handleApplyError(e);
}
</script>

<template>
  <PageShell :title="room?.name ?? '자습실'">
    <template #back>
      <RouterLink
        :to="{ name: 'student-rooms' }"
        class="mb-3 -ml-1 inline-flex items-center gap-0.5 text-label text-fg-muted hover:text-fg"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        자습실 목록
      </RouterLink>
    </template>
    <template v-if="room" #description>
      <span class="tabular-nums">{{ formatRange(room.startDate, room.endDate) }}</span>
      <span aria-hidden="true"> · </span>
      <span class="tabular-nums">{{ room ? seatUsageText(room) : '' }}</span>
    </template>

    <EmptyState
      v-if="notFound"
      title="신청할 수 없는 자습실이에요"
      description="삭제됐거나 운영이 끝났어요"
    >
      <RouterLink
        :to="{ name: 'student-rooms' }"
        :class="buttonVariants({ variant: 'weak', size: 'md' })"
      >
        자습실 목록으로
      </RouterLink>
    </EmptyState>
    <ErrorState
      v-else-if="page.status.value === 'error' && !room"
      title="자습실을 불러오지 못했어요"
      :description="errorMessage(page.error.value)"
      @retry="refresh"
    />
    <div v-else-if="!room" class="flex flex-col gap-3">
      <AppSkeleton class="h-16 rounded-xl" />
      <AppSkeleton class="h-96 rounded-xl" />
    </div>

    <div v-else class="flex flex-col gap-3">
      <AppAlert v-if="formError" :message="formError.message">
        <RouterLink
          v-if="formError.showMyVisits"
          :to="{ name: 'student-visits' }"
          class="mt-1 inline-block text-label text-accent underline underline-offset-4"
        >
          내 신청으로 가기
        </RouterLink>
      </AppAlert>

      <!-- 얇은 헤더: 날짜·방문 시간 (신청한 자습실을 보기만 할 때는 내 방문 시간을 글자로) -->
      <section
        ref="timeBar"
        aria-label="방문 시간"
        class="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-surface px-4 py-3 sm:px-5"
      >
        <p v-if="viewOnly && myVisit" class="text-label tabular-nums">
          <span class="text-fg-muted">내 방문</span> {{ visitText(myVisit) }}
        </p>
        <p v-else-if="picker.noSlots.value" class="text-body text-fg-muted">
          지금 고를 수 있는 시간이 없어요. 운영 기간이 끝났거나 곧 끝나요.
        </p>
        <p v-else-if="picker.allBusy.value && !myVisit" class="text-body text-fg-muted">
          운영 시간이 모두 내 다른 신청과 겹쳐요.
          <RouterLink
            :to="{ name: 'student-visits' }"
            class="text-label text-accent underline underline-offset-4"
            >내 신청으로 가기</RouterLink
          >
        </p>
        <template v-else>
          <VisitTimeFields :picker="picker" layout="bar" />
          <p
            v-if="seat.loaded.value && !seat.error.value"
            class="text-label text-fg-muted tabular-nums"
            aria-live="polite"
          >
            이 시간 빈 좌석 {{ seat.freeCount.value }}석
          </p>
        </template>
      </section>

      <!-- 큰 좌석 현황 -->
      <section
        ref="seatSection"
        aria-labelledby="seat-heading"
        class="flex flex-col gap-4 rounded-xl bg-surface px-4 py-6 sm:px-8 sm:py-8"
      >
        <h2 id="seat-heading" class="sr-only">좌석</h2>
        <p class="sr-only" aria-live="assertive">{{ seat.notice.value }}</p>

        <div v-if="seat.error.value" class="flex flex-col items-center gap-2" role="alert">
          <p class="text-body text-status-danger">
            좌석을 불러오지 못했어요. {{ seat.error.value }}
          </p>
          <AppButton variant="secondary" size="sm" @click="seat.reload('refresh')">
            다시 시도
          </AppButton>
        </div>
        <AppSkeleton
          v-else-if="!seat.loaded.value"
          class="mx-auto h-72 w-full max-w-sm rounded-lg"
        />
        <template v-else>
          <!-- 신청한 자습실을 보기만 할 때는 내 좌석을 보여주고, 변경 모드에서 다시 고른다 -->
          <SeatGrid
            :model-value="viewOnly ? (myVisit?.seat?.id ?? null) : seat.seatId.value"
            @update:model-value="(v) => (seat.seatId.value = v)"
            :seats="seat.seats.value"
            :my-seat-id="myVisit?.seat?.id ?? null"
            :disabled="saving || viewOnly || (!myVisit && !!blocked)"
            :aria-busy="seat.loading.value || undefined"
            :class="seat.loading.value && 'opacity-60'"
          />
          <div
            v-if="seat.freeCount.value === 0 && !viewOnly && !(!myVisit && blocked)"
            class="mx-auto flex flex-col items-center gap-2 text-center"
          >
            <p class="text-body text-fg-muted">그 시간 내내 비어 있는 좌석이 없어요</p>
            <AppButton v-if="!myVisit" variant="weak" size="sm" @click="findOtherRooms">
              같은 시간에 빈 좌석이 있는 자습실 보기
            </AppButton>
          </div>
        </template>
        <!-- 구분선 아래: 고른 좌석·시간(또는 내 방문·바뀐 것) + 오른쪽 아래 버튼 -->
        <div
          data-testid="room-action-bar"
          class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line pt-5"
        >
          <p class="min-w-0 text-body tabular-nums">
            <template v-if="editing">
              <span v-if="changeText" class="font-medium">{{ changeText }}</span>
              <span v-else class="text-fg-muted">바꿀 시간이나 좌석을 골라 주세요</span>
            </template>
            <template v-else-if="myVisit">
              <span class="text-label text-status-applied">내 방문</span>
              {{ visitText(myVisit)
              }}<template v-if="myVisit.seat"> · {{ myVisit.seat.number }}번 좌석</template>
            </template>
            <span v-else-if="blocked" :id="`blocked-${id}`" class="text-fg-muted">{{
              blocked
            }}</span>
            <template v-else-if="seat.selectedSeat.value && picker.selected.value">
              <span class="font-medium">{{ seat.selectedSeat.value.number }}번 좌석</span>
              · {{ visitText(picker.selected.value) }}
            </template>
            <span v-else class="text-fg-muted">앉을 좌석을 골라 주세요</span>
          </p>

          <div v-if="editing" class="flex w-full gap-2 sm:w-auto">
            <AppButton
              variant="secondary"
              size="lg"
              class="flex-1 sm:flex-none"
              :disabled="saving"
              @click="exitEdit"
            >
              취소
            </AppButton>
            <AppButton
              size="lg"
              class="flex-1 sm:flex-none"
              :loading="saving"
              :disabled="!canSave"
              @click="saveChange"
            >
              변경하기
            </AppButton>
          </div>
          <AppButton
            v-else-if="myVisit && isVisitInProgress(myVisit)"
            variant="secondary"
            size="lg"
            class="w-full sm:w-auto"
            @click="checkout.target.value = myVisit"
          >
            퇴실
          </AppButton>
          <div v-else-if="myVisit" class="flex w-full gap-2 sm:w-auto">
            <AppButton
              variant="secondary"
              size="lg"
              class="flex-1 sm:flex-none"
              :disabled="!isVisitEditable(myVisit)"
              @click="enterEdit('time')"
            >
              시간 변경
            </AppButton>
            <AppButton
              variant="secondary"
              size="lg"
              class="flex-1 sm:flex-none"
              :disabled="!isVisitEditable(myVisit)"
              @click="enterEdit('seat')"
            >
              좌석 변경
            </AppButton>
          </div>
          <AppButton
            v-else
            size="lg"
            class="w-full sm:w-auto"
            :loading="saving"
            :disabled="!canApply"
            :aria-describedby="blocked ? `blocked-${id}` : undefined"
            @click="apply"
          >
            신청하기
          </AppButton>
        </div>
      </section>
    </div>

    <AlternativeRoomsDialog
      v-if="full.fallback.value"
      v-model:open="full.open.value"
      :full-room-name="full.fallback.value.fullRoomName"
      :range="full.fallback.value.range"
      :rooms="full.fallback.value.rooms"
      @pick="full.pick"
    />
    <ConfirmDialog
      v-model:open="checkout.open.value"
      title="지금 퇴실할까요?"
      :description="checkout.description.value"
      confirm-label="퇴실"
      :loading="checkout.busy.value"
      @confirm="checkout.confirm"
    />
  </PageShell>
</template>
