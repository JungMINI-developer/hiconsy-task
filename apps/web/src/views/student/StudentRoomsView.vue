<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import type { StudyRoom, Visit, WaitlistEntry } from '@hiconsy/shared';
import { Check, Clock, Sparkles } from 'lucide-vue-next';
import { studyRoomsApi } from '@/api/studyRooms';
import { useAsync } from '@/composables/useAsync';
import { useDialogQuery } from '@/composables/useDialogQuery';
import { useFullRoomFallback } from '@/composables/useFullRoomFallback';
import { useHighlight, useRefetchOnVisible } from '@/composables/useRefetch';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { useVisitToast } from '@/composables/useVisitToast';
import { isVisitEditable, useMyVisitsStore } from '@/stores/myVisits';
import { useMyWaitlistStore } from '@/stores/myWaitlist';
import {
  formatDate,
  formatTimeRange,
  getRoomPhase,
  isSameDay,
  formatRange,
} from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import { decodeSlot, encodeSlot, hasAvailableSlot } from '@/utils/visitSlots';
import PageShell from '@/components/layout/PageShell.vue';
import CapacityBar from '@/components/domain/CapacityBar.vue';
import StudyRoomCard from '@/components/domain/StudyRoomCard.vue';
import AlternativeRoomsDialog from '@/components/domain/AlternativeRoomsDialog.vue';
import OfferBanner from '@/components/domain/OfferBanner.vue';
import VisitFormDialog from '@/components/domain/VisitFormDialog.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import { buttonVariants } from '@/components/ui/variants';

const myVisits = useMyVisitsStore();
const myWaitlist = useMyWaitlistStore();
const handleStudentGone = useStudentGuard();
const toast = useToast();
const visitToast = useVisitToast();
const { highlightedId, highlight } = useHighlight();

// 자습실·내 신청·내 대기를 함께 가져온다 (카드에 내 신청·대기 상태를 바로 보여주기 위해).
// 내 대기 조회가 서버의 제안 정리(만료·다음 순번)를 일으키므로 자습실 목록보다 먼저 받는다.
const page = useAsync(async () => {
  await Promise.all([myVisits.load(), myWaitlist.load()]);
  return studyRoomsApi.list();
});
async function refresh() {
  await page.run();
  if (page.error.value) handleStudentGone(page.error.value);
}
useRefetchOnVisible(refresh);

type CardState = 'applied' | 'offered' | 'waiting' | 'available' | 'full' | 'closing';

interface RoomCard {
  room: StudyRoom;
  state: CardState;
  myVisit?: Visit;
  myWait?: WaitlistEntry;
  /** 새로 신청할 수 있는 자리 (대기자 몫을 뺀 값, #36) */
  remaining: number;
}

/** 종료된 자습실은 숨기고, 카드 상태를 정한다 (screens.md S-20) */
const cards = computed<RoomCard[]>(() =>
  (page.data.value ?? [])
    .filter((room) => getRoomPhase(room) !== 'ended')
    .map((room) => {
      const myVisit = myVisits.activeByRoom.get(room.id);
      const myWait = myWaitlist.activeByRoom.get(room.id);
      const remaining = room.availableSeats;
      let state: CardState = 'available';
      if (myVisit) state = 'applied';
      else if (myWait) state = myWait.status === 'OFFERED' ? 'offered' : 'waiting';
      else if (!hasAvailableSlot(room)) state = 'closing';
      else if (remaining === 0) state = 'full';
      return { room, state, myVisit, myWait, remaining };
    }),
);

function visitText(v: Pick<Visit, 'startAt' | 'endAt'>) {
  return isSameDay(v.startAt, v.endAt)
    ? `${formatDate(v.startAt)} ${formatTimeRange(v.startAt, v.endAt)}`
    : formatRange(v.startAt, v.endAt);
}

// 신청 (?apply=roomId, 미리 고른 시간 &slot=) · 시간 변경 (?edit=visitId)
const route = useRoute();
const applyDialog = useDialogQuery('apply', { clear: ['slot'] });
const initialSlot = computed(() => decodeSlot(route.query.slot));
// 정원 마감 시 같은 시간에 자리가 남은 자습실 안내 (#35)
const full = useFullRoomFallback(() => page.data.value, refresh);
const editDialog = useDialogQuery('edit');
// 자리 제안을 받은 자습실도 신청 다이얼로그로 확정한다 (#36)
const applyingCard = computed(
  () =>
    cards.value.find(
      (c) =>
        String(c.room.id) === applyDialog.value.value &&
        (c.state === 'available' || c.state === 'offered'),
    ) ?? null,
);
// 대기 등록 (?wait=roomId) — 정원 마감 카드에서
const waitDialog = useDialogQuery('wait');
const waitingCard = computed(
  () =>
    cards.value.find((c) => String(c.room.id) === waitDialog.value.value && c.state === 'full') ??
    null,
);
const waitOpen = computed({
  get: () => !!waitingCard.value,
  set: (v: boolean) => !v && waitDialog.close(),
});

function confirmOffer(wait: WaitlistEntry) {
  applyDialog.open(wait.studyRoom.id, {
    slot: encodeSlot(new Date(wait.startAt), new Date(wait.endAt)),
  });
}
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

function onWaited(entry: WaitlistEntry) {
  toast.success(
    `${entry.studyRoom.name} 대기 등록했어요${entry.position ? `. ${entry.position}번째예요` : ''}`,
  );
  highlight(entry.studyRoom.id);
  void refresh();
}
</script>

<template>
  <PageShell title="신청할 수 있는 자습실">
    <OfferBanner @changed="refresh" />
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
        <li v-for="{ room, state, myVisit, myWait, remaining } in cards" :key="room.id">
          <StudyRoomCard :room="room" :highlighted="highlightedId === room.id">
            <template #badges>
              <AppBadge v-if="state === 'applied'" tone="applied">
                <Check class="size-3.5" aria-hidden="true" />
                신청함
              </AppBadge>
              <AppBadge v-else-if="state === 'offered'" tone="applied">
                <Sparkles class="size-3.5" aria-hidden="true" />
                자리 제안
              </AppBadge>
              <AppBadge v-else-if="state === 'waiting'" tone="neutral">
                <Clock class="size-3.5" aria-hidden="true" />
                대기 중
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
              <p
                v-else-if="(state === 'offered' || state === 'waiting') && myWait"
                class="text-label text-status-applied tabular-nums"
              >
                {{ state === 'offered' ? '자리가 났어요' : `대기 ${myWait.position}번째` }} ·
                {{ visitText(myWait) }}
              </p>
              <CapacityBar
                :current="room.maxPersonnel - remaining"
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
              <AppButton
                v-else-if="state === 'offered' && myWait"
                size="sm"
                @click="confirmOffer(myWait)"
              >
                확정하기
              </AppButton>
              <RouterLink
                v-else-if="state === 'waiting'"
                :to="{ name: 'student-visits', query: { tab: 'waitlist' } }"
                :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
              >
                내 대기 보기
              </RouterLink>
              <template v-else-if="state === 'full'">
                <span :id="`reason-${room.id}`" class="text-caption text-fg-muted">
                  정원이 다 찼어요<template v-if="room.waitingCount + room.offeredCount">
                    · 대기 {{ room.waitingCount + room.offeredCount }}명</template
                  >
                </span>
                <AppButton
                  variant="weak"
                  size="sm"
                  :aria-describedby="`reason-${room.id}`"
                  @click="waitDialog.open(room.id)"
                >
                  대기 등록
                </AppButton>
              </template>
              <template v-else>
                <span
                  v-if="state !== 'available'"
                  :id="`reason-${room.id}`"
                  class="text-caption text-fg-muted"
                >
                  신청할 수 있는 시간이 지났어요
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
      :initial-slot="initialSlot"
      :offer="applyingCard?.state === 'offered' ? applyingCard.myWait : null"
      @saved="onSaved"
      @stale="refresh"
      @full="full.onFull"
    />
    <VisitFormDialog
      v-model:open="waitOpen"
      :room="waitingCard?.room ?? null"
      waitlist
      :waiting-count="
        waitingCard ? waitingCard.room.waitingCount + waitingCard.room.offeredCount : 0
      "
      @waited="onWaited"
      @stale="refresh"
    />
    <VisitFormDialog
      v-model:open="editOpen"
      :room="null"
      :visit="editingVisit"
      @saved="onSaved"
      @stale="refresh"
    />
    <AlternativeRoomsDialog
      v-if="full.fallback.value"
      v-model:open="full.open.value"
      :full-room-name="full.fallback.value.fullRoom.name"
      :range="full.fallback.value.range"
      :rooms="full.fallback.value.rooms"
      :can-wait="full.fallback.value.canWait"
      :waiting-count="full.fallback.value.waitingCount"
      :waiting="full.waiting.value"
      @pick="full.pick"
      @wait="full.wait"
    />
  </PageShell>
</template>
