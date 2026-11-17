<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  ErrorCode,
  type SeatOccupancy,
  type StudyRoom,
  type StudyRoomHistory,
  type StudyRoomVisit,
} from '@hiconsy/shared';
import { ChevronLeft, ChevronRight, Search } from 'lucide-vue-next';
import { studyRoomsApi } from '@/api/studyRooms';
import { useAsync } from '@/composables/useAsync';
import { useDialogQuery } from '@/composables/useDialogQuery';
import { useAutoRefresh, useRefetchOnVisible } from '@/composables/useRefetch';
import { useToast } from '@/composables/useToast';
import { cn } from '@/utils/cn';
import {
  formatDate,
  formatDateTime,
  formatRange,
  formatTime,
  formatTimeRange,
  getRoomPhase,
  isSameDay,
  toIsoWithOffset,
} from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import { filterHistories, type HistoryFilter } from '@/utils/history';
import { defaultSeatMapTime, isSeatedAt, nowSeatMapTime, seatMapTimes } from '@/utils/seatMapTime';
import PageShell from '@/components/layout/PageShell.vue';
import HistoryTimeline from '@/components/domain/HistoryTimeline.vue';
import RoomPhaseBadge from '@/components/domain/RoomPhaseBadge.vue';
import SeatMapGrid from '@/components/domain/SeatMapGrid.vue';
import StudyRoomFormDialog from '@/components/domain/StudyRoomFormDialog.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import AppTabs from '@/components/ui/AppTabs.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import { buttonVariants } from '@/components/ui/variants';

/**
 * S-11 강사 · 자습실 상세 (#51).
 * 왼쪽 패널(요약 숫자 + 신청 학생)과 메인([좌석 현황 / 이력] 탭 — 시각 선택 + 좌석 배치도).
 */
const props = defineProps<{ id: number }>();

const route = useRoute();
const router = useRouter();
const toast = useToast();

const detail = useAsync(async () => {
  const [room, histories, applicants] = await Promise.all([
    studyRoomsApi.get(props.id),
    studyRoomsApi.histories(props.id),
    studyRoomsApi.visits(props.id),
  ]);
  return { room, histories, applicants };
});

const room = computed<StudyRoom | null>(() => detail.data.value?.room ?? null);
const histories = computed<StudyRoomHistory[]>(() => detail.data.value?.histories ?? []);
/** 유효 신청 전체 — 서버가 방문 시작 순으로, 학생 연락처와 함께 준다 (#51 결정 3) */
const applicants = computed<StudyRoomVisit[]>(() => detail.data.value?.applicants ?? []);
const notFound = computed(() => detail.error.value?.code === ErrorCode.STUDY_ROOM_NOT_FOUND);
const multiDay = computed(
  () =>
    !!room.value &&
    !isSameDay(room.value.startDate, new Date(new Date(room.value.endDate).getTime() - 1)),
);

// ── 볼 시각 ──────────────────────────────────────────────
const viewTime = ref<number | null>(null);
const seatMap = useAsync((at: number) =>
  studyRoomsApi.seatMap(props.id, toIsoWithOffset(new Date(at))),
);
const seats = computed<SeatOccupancy[]>(() => seatMap.data.value ?? []);

const timeOptions = computed(() =>
  room.value
    ? seatMapTimes(room.value).map((t) => ({
        value: t,
        label: multiDay.value ? formatDateTime(new Date(t)) : formatTime(new Date(t)),
      }))
    : [],
);
const timeIndex = computed(() => timeOptions.value.findIndex((o) => o.value === viewTime.value));
const nowTime = computed(() => (room.value ? nowSeatMapTime(room.value) : null));

// 처음 한 번만 기본값을 정한다. 이후 자동 갱신으로 바꾸지 않는다 (보고 있는 시점이 갑자기 바뀌지 않게)
watch(room, (r) => {
  if (r && viewTime.value === null) viewTime.value = defaultSeatMapTime(r);
});
watch(viewTime, (t) => {
  if (t !== null) void seatMap.run(t);
});

function stepTime(delta: -1 | 1) {
  const next = timeOptions.value[timeIndex.value + delta];
  if (next) setTime(next.value);
}

/** 시각을 직접 바꿨을 때 — 강조한 학생이 그 시각에 없으면 강조를 푼다 */
function setTime(t: number) {
  viewTime.value = t;
  const v = highlightedVisit.value;
  if (v && !isSeatedAt(v, t)) highlightedVisitId.value = null;
}

// ── 요약 숫자 (#51 결정 2) — 고른 시각 기준. 예약 건수는 좌석 수보다 많을 수 있어 빼고 신청 학생 수로 보여준다
const occupiedCount = computed(() => seats.value.filter((s) => s.visit).length);
const summary = computed(() => [
  { label: '이용 중', value: seatMap.data.value ? occupiedCount.value : null },
  {
    label: '빈 좌석',
    value: seatMap.data.value ? seats.value.length - occupiedCount.value : null,
  },
]);

// ── 신청 학생 · 강조 ────────────────────────────────────
const highlightedVisitId = ref<number | null>(null);
const highlightedVisit = computed(
  () => applicants.value.find((a) => a.id === highlightedVisitId.value) ?? null,
);
/** 강조할 좌석은 배치도 기준으로 찾는다 (그 시각에 그 신청이 앉은 좌석) */
const highlightedSeatId = computed(
  () => seats.value.find((s) => s.visit && s.visit.id === highlightedVisitId.value)?.id ?? null,
);
const announcement = ref('');

const seatedNow = (a: StudyRoomVisit) => viewTime.value !== null && isSeatedAt(a, viewTime.value);

async function toggleHighlight(a: StudyRoomVisit) {
  if (highlightedVisitId.value === a.id) {
    highlightedVisitId.value = null;
    return;
  }
  highlightedVisitId.value = a.id;
  // 그 시각에 앉아 있지 않으면 방문 시작으로 옮긴다 — 옮기지 않으면 같은 좌석의 다른 학생을 가리킨다
  if (!seatedNow(a)) {
    const start = new Date(a.startAt).getTime();
    viewTime.value = start;
    announcement.value = `${a.student.name} 학생 방문 시각(${formatTime(a.startAt)})으로 옮겼어요`;
  } else {
    announcement.value = '';
  }
  // 좁은 화면에서는 배치도가 목록 아래에 있으므로 보이게 스크롤한다
  await nextTick();
  const grid = document.getElementById('seat-map');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  grid?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

// 자동 갱신으로 강조한 신청이 사라지면(취소) 조용히 푼다
watch(applicants, (list) => {
  if (highlightedVisitId.value !== null && !list.some((a) => a.id === highlightedVisitId.value))
    highlightedVisitId.value = null;
});

/** 좁은 화면에서 처음 보여줄 신청 학생 수 (배치도가 너무 밀리지 않게) */
const COLLAPSED_COUNT = 5;
const expanded = ref(false);

function visitTime(a: StudyRoomVisit) {
  if (!multiDay.value) return formatTimeRange(a.startAt, a.endAt);
  return isSameDay(a.startAt, a.endAt)
    ? `${formatDate(a.startAt)} ${formatTimeRange(a.startAt, a.endAt)}`
    : formatRange(a.startAt, a.endAt);
}

// ── 탭 · 이력 ───────────────────────────────────────────
// 탭은 URL 쿼리(?tab=)와 동기화
type Tab = 'seats' | 'histories';
const tab = computed<Tab>({
  get: () => (route.query.tab === 'histories' ? 'histories' : 'seats'),
  set: (v) =>
    void router.replace({ query: { ...route.query, tab: v === 'seats' ? undefined : v } }),
});
const tabs = computed(() => [
  { value: 'seats' as const, label: '좌석 현황' },
  { value: 'histories' as const, label: '이력', count: histories.value.length },
]);

const historyFilter = ref<HistoryFilter>('ALL');
const studentQuery = ref('');
const filterOptions = [
  { value: 'ALL' as const, label: '전체' },
  { value: 'APPLY' as const, label: '신청' },
  { value: 'UPDATE' as const, label: '변경' },
  { value: 'CANCEL' as const, label: '취소' },
  { value: 'CHECKOUT' as const, label: '퇴실' },
];
const visibleHistories = computed(() =>
  filterHistories(histories.value, historyFilter.value, studentQuery.value),
);

// ── 최신화: 진입·창이 다시 보일 때 + 30초마다 (보는 동안 학생이 신청할 수 있다) ──
function refresh() {
  const tasks: Promise<unknown>[] = [detail.run()];
  if (viewTime.value !== null) tasks.push(seatMap.run(viewTime.value));
  return Promise.all(tasks);
}
useRefetchOnVisible(refresh);
useAutoRefresh(refresh);

// ── 수정 (?edit=1) · 삭제 ───────────────────────────────
const editDialog = useDialogQuery('edit');
function onSaved() {
  toast.success('변경 내용을 저장했어요');
  void refresh();
}

const deleteOpen = ref(false);
const removing = ref(false);
const deleteDescription = computed(() => {
  // 삭제하면 끝나지 않은 신청만 취소된다 — 지난 방문은 그대로 남는다 (#57)
  const n = room.value?.unfinishedVisits ?? 0;
  const effect =
    n > 0
      ? `끝나지 않은 신청 ${n}건이 취소돼요. 지난 방문 기록은 그대로 남고, 학생은 내 신청에서 취소 사유를 볼 수 있어요.`
      : '취소될 신청이 없어요. 삭제하면 목록에서 사라져요.';
  return `${room.value?.name ?? ''} · ${effect}`;
});
async function confirmDelete() {
  removing.value = true;
  try {
    await studyRoomsApi.remove(props.id);
    toast.success('자습실을 삭제했어요');
    deleteOpen.value = false;
    void router.push({ name: 'teacher-rooms' });
  } catch (e) {
    toast.error(errorMessage(e));
    deleteOpen.value = false;
    void detail.run();
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <PageShell :title="room?.name ?? '자습실 상세'">
    <template #back>
      <RouterLink
        :to="{ name: 'teacher-rooms' }"
        class="mb-3 -ml-1 inline-flex items-center gap-0.5 text-label text-fg-muted hover:text-fg"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        자습실 목록
      </RouterLink>
    </template>
    <template v-if="room" #description>
      <span class="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="tabular-nums">{{ formatRange(room.startDate, room.endDate) }}</span>
        <span aria-hidden="true">·</span>
        <span>좌석 {{ room.maxPersonnel }}석</span>
        <RoomPhaseBadge :phase="getRoomPhase(room)" />
      </span>
    </template>
    <template v-if="room" #actions>
      <AppButton variant="light" @click="editDialog.open()">수정</AppButton>
      <AppButton variant="danger-weak" @click="deleteOpen = true"> 삭제 </AppButton>
    </template>

    <div
      v-if="detail.showSkeleton.value"
      class="flex flex-col gap-4 lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-6"
    >
      <AppSkeleton class="h-72 w-full" />
      <AppSkeleton class="h-96 w-full" />
    </div>

    <EmptyState
      v-else-if="notFound"
      title="삭제된 자습실이에요"
      description="목록에서 다른 자습실을 골라 주세요"
    >
      <RouterLink :to="{ name: 'teacher-rooms' }" :class="buttonVariants({ variant: 'secondary' })">
        목록으로
      </RouterLink>
    </EmptyState>

    <ErrorState
      v-else-if="detail.status.value === 'error' && !room"
      title="자습실 정보를 불러오지 못했어요"
      :description="errorMessage(detail.error.value)"
      @retry="refresh()"
    />

    <div
      v-else-if="room"
      class="flex flex-col gap-4 lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start lg:gap-6"
    >
      <!-- 왼쪽 패널: 요약 숫자 + 신청 학생 (좁은 화면에서는 메인 위로 쌓인다, #51 결정 4) -->
      <aside
        class="flex flex-col rounded-xl bg-surface lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)]"
        aria-label="자습실 요약"
      >
        <div class="border-b border-line p-4">
          <dl class="grid grid-cols-2 gap-2 text-center" data-testid="seat-summary">
            <div v-for="item in summary" :key="item.label" class="flex flex-col gap-0.5">
              <dt class="text-caption text-fg-muted">{{ item.label }}</dt>
              <dd class="text-heading tabular-nums">{{ item.value ?? '–' }}</dd>
            </div>
          </dl>
          <p v-if="viewTime !== null" class="mt-2 text-center text-caption text-fg-muted">
            {{ formatTime(new Date(viewTime)) }} 기준
          </p>
        </div>

        <section class="flex min-h-0 flex-col" aria-labelledby="applicants-heading">
          <h2 id="applicants-heading" class="px-4 pt-4 pb-2 text-label">
            신청 학생 <span class="text-fg-muted tabular-nums">{{ applicants.length }}</span>
          </h2>
          <p v-if="applicants.length === 0" class="px-4 pb-4 text-body text-fg-muted">
            아직 신청한 학생이 없어요. 학생이 신청하면 여기에 보여요.
          </p>
          <ul v-else class="flex min-h-0 flex-col overflow-y-auto px-2 pb-2">
            <li
              v-for="(a, index) in applicants"
              :key="a.id"
              :class="!expanded && index >= COLLAPSED_COUNT ? 'hidden lg:block' : undefined"
            >
              <button
                type="button"
                :aria-pressed="highlightedVisitId === a.id"
                :data-visit-id="a.id"
                :class="
                  cn(
                    'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors duration-120 ease-standard hover:bg-grey-50',
                    highlightedVisitId === a.id && 'bg-accent-weak hover:bg-accent-weak',
                  )
                "
                @click="toggleHighlight(a)"
              >
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="flex items-baseline gap-2">
                    <span :class="cn('truncate', seatedNow(a) && 'font-bold')">
                      {{ a.student.name }}
                    </span>
                    <!-- 학생을 삭제해도 지난 방문은 기록으로 남는다 (#57, #61) -->
                    <AppBadge
                      v-if="a.student.deletedAt"
                      tone="canceled"
                      class="shrink-0 self-center"
                      data-testid="withdrawn"
                    >
                      탈퇴
                    </AppBadge>
                    <span v-if="a.seat" class="shrink-0 text-label text-fg-muted tabular-nums">
                      {{ a.seat.number }}번
                    </span>
                  </span>
                  <span class="text-caption text-fg-muted tabular-nums">
                    {{ visitTime(a) }} · {{ a.student.phone }}
                  </span>
                </span>
                <span
                  v-if="seatedNow(a)"
                  class="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
                  aria-hidden="true"
                />
                <span v-if="seatedNow(a)" class="sr-only">고른 시각에 이용 중</span>
              </button>
            </li>
          </ul>
          <AppButton
            v-if="!expanded && applicants.length > COLLAPSED_COUNT"
            variant="secondary"
            class="mx-4 mb-4 lg:hidden"
            @click="expanded = true"
          >
            {{ applicants.length - COLLAPSED_COUNT }}명 더 보기
          </AppButton>
        </section>
      </aside>

      <!-- 메인: [좌석 현황 / 이력] -->
      <div class="min-w-0">
        <AppTabs v-model="tab" :items="tabs" label="자습실 상세" class="mb-4" />

        <section
          v-if="tab === 'seats'"
          id="seat-map"
          aria-label="좌석 현황"
          class="flex scroll-mt-4 flex-col gap-5 rounded-xl bg-surface p-4 sm:p-5"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-label text-fg-muted" aria-hidden="true">시각</span>
            <div class="flex items-center gap-1">
              <AppButton
                variant="secondary"
                size="icon"
                class="size-11"
                aria-label="30분 앞으로"
                :title="timeIndex <= 0 ? '운영 기간의 처음이에요' : undefined"
                :disabled="timeIndex <= 0"
                @click="stepTime(-1)"
              >
                <ChevronLeft class="size-4" aria-hidden="true" />
              </AppButton>
              <AppSelect
                :model-value="viewTime ?? undefined"
                :options="timeOptions"
                aria-label="볼 시각"
                :class="multiDay ? 'w-44' : 'w-28'"
                open-below
                @update:model-value="(t) => t !== undefined && setTime(t)"
              />
              <AppButton
                variant="secondary"
                size="icon"
                class="size-11"
                aria-label="30분 뒤로"
                :title="timeIndex >= timeOptions.length - 1 ? '운영 기간의 끝이에요' : undefined"
                :disabled="timeIndex >= timeOptions.length - 1"
                @click="stepTime(1)"
              >
                <ChevronRight class="size-4" aria-hidden="true" />
              </AppButton>
            </div>
            <AppButton
              v-if="nowTime !== null"
              variant="weak"
              class="h-11"
              :disabled="viewTime === nowTime"
              @click="setTime(nowTime)"
            >
              지금
            </AppButton>
          </div>

          <p class="sr-only" aria-live="polite">{{ announcement }}</p>

          <div v-if="seatMap.showSkeleton.value" class="mx-auto grid w-full max-w-[33rem] gap-3">
            <AppSkeleton v-for="n in 3" :key="n" class="h-14 w-full" />
          </div>
          <ErrorState
            v-else-if="seatMap.status.value === 'error' && !seatMap.data.value"
            title="좌석 현황을 불러오지 못했어요"
            :description="errorMessage(seatMap.error.value)"
            @retry="viewTime !== null && seatMap.run(viewTime)"
          />
          <SeatMapGrid
            v-else-if="seatMap.data.value"
            :seats="seats"
            :highlighted-seat-id="highlightedSeatId"
            :aria-busy="seatMap.isLoading.value || undefined"
          />
        </section>

        <section v-else aria-label="이력">
          <div class="mb-4 flex flex-wrap gap-2">
            <AppSelect
              v-model="historyFilter"
              :options="filterOptions"
              aria-label="이력 종류"
              class="w-32"
            />
            <div class="relative min-w-0 flex-1 sm:max-w-xs">
              <Search
                class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
                aria-hidden="true"
              />
              <AppInput
                v-model="studentQuery"
                type="search"
                placeholder="학생 이름으로 찾기"
                aria-label="학생 이름으로 찾기"
                class="pl-9"
              />
            </div>
          </div>
          <EmptyState v-if="histories.length === 0" title="아직 신청한 학생이 없어요" />
          <EmptyState v-else-if="visibleHistories.length === 0" title="조건에 맞는 이력이 없어요" />
          <div v-else class="rounded-xl bg-surface p-4 sm:p-5">
            <HistoryTimeline :items="visibleHistories" />
          </div>
        </section>
      </div>
    </div>

    <template v-if="room">
      <StudyRoomFormDialog
        v-model:open="editDialog.isOpen.value"
        :room="room"
        @saved="onSaved"
        @gone="refresh()"
      />
      <ConfirmDialog
        v-model:open="deleteOpen"
        title="자습실을 삭제할까요?"
        :description="deleteDescription"
        confirm-label="삭제"
        :loading="removing"
        @confirm="confirmDelete"
      />
    </template>
  </PageShell>
</template>
