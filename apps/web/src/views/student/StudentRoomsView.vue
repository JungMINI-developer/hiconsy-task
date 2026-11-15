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
import CapacityBar from '@/components/domain/CapacityBar.vue';
import StudyRoomCard from '@/components/domain/StudyRoomCard.vue';
import VisitFormDialog from '@/components/domain/VisitFormDialog.vue';
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

type CardState = 'applied' | 'available' | 'full' | 'closing';

interface RoomCard {
  room: StudyRoom;
  state: CardState;
  myVisit?: Visit;
  remaining: number;
}

/** 종료된 자습실은 숨기고, 카드 상태를 정한다 (screens.md S-20) */
const cards = computed<RoomCard[]>(() =>
  (page.data.value ?? [])
    .filter((room) => getRoomPhase(room) !== 'ended')
    .map((room) => {
      const myVisit = myVisits.activeByRoom.get(room.id);
      const remaining = Math.max(room.maxPersonnel - room.currentPersonnel, 0);
      let state: CardState = 'available';
      if (myVisit) state = 'applied';
      else if (remaining === 0) state = 'full';
      else if (!hasAvailableSlot(room)) state = 'closing';
      return { room, state, myVisit, remaining };
    }),
);

function visitText(v: Visit) {
  return isSameDay(v.startAt, v.endAt)
    ? `${formatDate(v.startAt)} ${formatTimeRange(v.startAt, v.endAt)}`
    : formatRange(v.startAt, v.endAt);
}

// 신청 (?apply=roomId) · 시간 변경 (?edit=visitId)
const applyDialog = useDialogQuery('apply');
const editDialog = useDialogQuery('edit');
const applyingCard = computed(
  () =>
    cards.value.find(
      (c) => String(c.room.id) === applyDialog.value.value && c.state === 'available',
    ) ?? null,
);
const editingVisit = computed(
  () =>
    myVisits.visits.find((v) => String(v.id) === editDialog.value.value && isVisitEditable(v)) ??
    null,
);
const applyOpen = computed({
  get: () => !!applyingCard.value,
  set: (v: boolean) => !v && applyDialog.close(),
});
const editOpen = computed({
  get: () => !!editingVisit.value,
  set: (v: boolean) => !v && editDialog.close(),
});

function onSaved(visit: Visit, mode: 'apply' | 'update') {
  if (mode === 'apply') visitToast.applied(visit);
  else visitToast.updated(editingVisit.value, visit);
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
              <AppBadge v-else-if="state === 'full'" tone="full">정원 마감</AppBadge>
              <AppBadge v-else-if="getRoomPhase(room) === 'open'" tone="open">운영 중</AppBadge>
            </template>

            <div class="flex min-w-0 flex-col gap-1">
              <p
                v-if="state === 'applied' && myVisit"
                class="text-label text-status-applied tabular-nums"
              >
                내 방문 {{ visitText(myVisit) }}
              </p>
              <CapacityBar
                :current="room.currentPersonnel"
                :max="room.maxPersonnel"
                perspective="student"
              />
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
                  {{ state === 'full' ? '정원이 다 찼어요' : '신청할 수 있는 시간이 지났어요' }}
                </span>
                <AppButton
                  variant="weak"
                  size="sm"
                  :disabled="state !== 'available'"
                  :aria-describedby="state !== 'available' ? `reason-${room.id}` : undefined"
                  @click="applyDialog.open(room.id)"
                >
                  방문 신청
                </AppButton>
              </template>
            </div>
          </StudyRoomCard>
        </li>
      </ul>
    </template>

    <VisitFormDialog
      v-model:open="applyOpen"
      :room="applyingCard?.room ?? null"
      :remaining="applyingCard?.remaining"
      @saved="onSaved"
      @stale="refresh"
    />
    <VisitFormDialog
      v-model:open="editOpen"
      :room="null"
      :visit="editingVisit"
      @saved="onSaved"
      @stale="refresh"
    />
  </PageShell>
</template>
