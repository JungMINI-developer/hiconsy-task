<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { StudyRoom, Visit } from '@hiconsy/shared';
import { Check } from 'lucide-vue-next';
import { studyRoomsApi } from '@/api/studyRooms';
import { useAsync } from '@/composables/useAsync';
import { useDialogQuery } from '@/composables/useDialogQuery';
import { useHighlight, useRefetchOnVisible } from '@/composables/useRefetch';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useVisitToast } from '@/composables/useVisitToast';
import { isVisitEditable, useMyVisitsStore } from '@/stores/myVisits';
import {
  formatDate,
  formatTimeRange,
  getRoomPhase,
  isSameDay,
  formatRange,
} from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import { hasAvailableSlot } from '@/utils/visitSlots';
import PageShell from '@/components/layout/PageShell.vue';
import StudyRoomCard from '@/components/domain/StudyRoomCard.vue';
import VisitTimeDialog from '@/components/domain/VisitTimeDialog.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import { buttonVariants } from '@/components/ui/variants';

const myVisits = useMyVisitsStore();
const handleStudentGone = useStudentGuard();
const visitToast = useVisitToast();
const { highlightedId, highlight } = useHighlight();

// 자습실과 내 신청을 함께 가져온다 (카드에 내 신청 여부를 바로 보여주기 위해)
const page = useAsync(async () => {
  const [rooms] = await Promise.all([studyRoomsApi.list(), myVisits.load()]);
  return rooms;
});
async function refresh() {
  await page.run();
  if (page.error.value) handleStudentGone(page.error.value);
}
useRefetchOnVisible(refresh);

/**
 * - applied: 내 유효 신청이 있음
 * - closing: 신청할 수 있는 시간이 지남 (남은 운영 시간이 30분 미만)
 * - noSeat: 남은 운영 시간 어디에도 30분 이상 빈 좌석이 없음 (#49) — 지금만 다 차 있는 건 막지 않는다
 */
type CardState = 'applied' | 'available' | 'noSeat' | 'closing';

interface RoomCard {
  room: StudyRoom;
  state: CardState;
  myVisit?: Visit;
}

/** 신청 버튼을 막는 이유 (applied·available은 막지 않음) */
const REASON: Record<CardState, string> = {
  applied: '',
  available: '',
  closing: '신청할 수 있는 시간이 지났어요',
  noSeat: '남은 시간에 빈 좌석이 없어요',
};

/** 종료된 자습실은 숨기고, 카드 상태를 정한다 (screens.md S-20) */
const cards = computed<RoomCard[]>(() =>
  (page.data.value ?? [])
    .filter((room) => getRoomPhase(room) !== 'ended')
    .map((room) => {
      const myVisit = myVisits.activeByRoom.get(room.id);
      let state: CardState = 'available';
      if (myVisit) state = 'applied';
      else if (!hasAvailableSlot(room)) state = 'closing';
      else if (!room.hasFreeSlot) state = 'noSeat';
      return { room, state, myVisit };
    }),
);

/** `좌석 10석 · 지금 6석 이용 중` — 운영 시간이 아니면 좌석 수만 (#49) */
function seatText(room: StudyRoom) {
  const total = `좌석 ${room.maxPersonnel}석`;
  return room.occupiedSeats === null ? total : `${total} · 지금 ${room.occupiedSeats}석 이용 중`;
}

function visitText(v: Visit) {
  const time = isSameDay(v.startAt, v.endAt)
    ? `${formatDate(v.startAt)} ${formatTimeRange(v.startAt, v.endAt)}`
    : formatRange(v.startAt, v.endAt);
  return v.seat ? `${time} · ${v.seat.number}번 좌석` : time;
}

// 시간 변경 (?edit=visitId) — 신청은 자습실 페이지에서 한다 (#49)
const editDialog = useDialogQuery('edit');
const editingVisit = computed(
  () =>
    myVisits.visits.find((v) => String(v.id) === editDialog.value.value && isVisitEditable(v)) ??
    null,
);
const editOpen = computed({
  get: () => !!editingVisit.value,
  set: (v: boolean) => !v && editDialog.close(),
});

function onTimeChanged(visit: Visit) {
  visitToast.updated(editingVisit.value, visit);
  highlight(visit.studyRoom.id);
  void refresh();
}
</script>

<template>
  <PageShell title="신청할 수 있는 자습실">
    <p class="sr-only" aria-live="polite">
      <template v-if="page.status.value === 'success'">자습실 {{ cards.length }}개</template>
    </p>

    <div v-if="page.showSkeleton.value" class="grid gap-3 lg:grid-cols-2">
      <AppSkeleton v-for="i in 4" :key="i" class="h-36 rounded-xl" />
    </div>
    <ErrorState
      v-else-if="page.status.value === 'error' && !page.data.value"
      title="자습실 목록을 불러오지 못했어요"
      :description="errorMessage(page.error.value)"
      @retry="refresh"
    />
    <template v-else-if="page.data.value">
      <EmptyState
        v-if="cards.length === 0"
        title="지금 신청할 수 있는 자습실이 없어요"
        description="강사가 자습실을 열면 여기에 보여요"
      />
      <ul v-else class="grid gap-3 lg:grid-cols-2">
        <li v-for="{ room, state, myVisit } in cards" :key="room.id">
          <StudyRoomCard :room="room" :highlighted="highlightedId === room.id">
            <template #badges>
              <AppBadge v-if="state === 'applied'" tone="applied">
                <Check class="size-3.5" aria-hidden="true" />
                신청함
              </AppBadge>
              <AppBadge v-else-if="getRoomPhase(room) === 'open'" tone="open">운영 중</AppBadge>
            </template>

            <div class="flex min-w-0 flex-col gap-1">
              <p
                v-if="state === 'applied' && myVisit"
                class="text-label text-status-applied tabular-nums"
              >
                내 방문 {{ visitText(myVisit) }}
              </p>
              <p class="text-label text-fg-muted tabular-nums">{{ seatText(room) }}</p>
            </div>

            <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
              <template v-if="state === 'applied' && myVisit">
                <AppButton
                  v-if="isVisitEditable(myVisit)"
                  variant="secondary"
                  size="sm"
                  @click="editDialog.open(myVisit.id)"
                >
                  시간 변경
                </AppButton>
                <RouterLink
                  :to="{ name: 'student-visits' }"
                  :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
                >
                  내 신청 보기
                </RouterLink>
              </template>
              <template v-else>
                <span
                  v-if="state !== 'available'"
                  :id="`reason-${room.id}`"
                  class="text-caption text-fg-muted"
                >
                  {{ REASON[state] }}
                </span>
                <RouterLink
                  v-if="state === 'available'"
                  :to="{ name: 'student-room', params: { id: room.id } }"
                  :class="buttonVariants({ variant: 'weak', size: 'sm' })"
                  :aria-label="`${room.name} 방문 신청`"
                >
                  방문 신청
                </RouterLink>
                <AppButton
                  v-else
                  variant="weak"
                  size="sm"
                  disabled
                  :aria-describedby="`reason-${room.id}`"
                >
                  방문 신청
                </AppButton>
              </template>
            </div>
          </StudyRoomCard>
        </li>
      </ul>
    </template>

    <VisitTimeDialog
      v-model:open="editOpen"
      :visit="editingVisit"
      @saved="onTimeChanged"
      @stale="refresh"
    />
  </PageShell>
</template>
