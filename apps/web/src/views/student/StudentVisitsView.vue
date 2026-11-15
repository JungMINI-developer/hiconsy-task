<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import type { StudyRoom, Visit } from '@hiconsy/shared';
import { studyRoomsApi } from '@/api/studyRooms';
import { visitsApi } from '@/api/visits';
import { useAsync } from '@/composables/useAsync';
import { useDialogQuery } from '@/composables/useDialogQuery';
import { useHighlight, useRefetchOnVisible } from '@/composables/useRefetch';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { useVisitToast } from '@/composables/useVisitToast';
import { isVisitEditable, useMyVisitsStore, visitGroup, type VisitGroup } from '@/stores/myVisits';
import { useSessionStore } from '@/stores/session';
import { cn } from '@/utils/cn';
import {
  formatDate,
  formatRange,
  formatTimeRange,
  getRoomPhase,
  isSameDay,
} from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import { hasAvailableSlot } from '@/utils/visitSlots';
import PageShell from '@/components/layout/PageShell.vue';
import VisitFormDialog from '@/components/domain/VisitFormDialog.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import AppTabs from '@/components/ui/AppTabs.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import { buttonVariants } from '@/components/ui/variants';

const session = useSessionStore();
const myVisits = useMyVisitsStore();
const toast = useToast();
const visitToast = useVisitToast();
const handleStudentGone = useStudentGuard();
const { highlightedId, highlight } = useHighlight();

// 다시 신청 가능 여부를 알기 위해 자습실 목록도 함께 가져온다
const page = useAsync(async () => {
  const [rooms] = await Promise.all([studyRoomsApi.list(), myVisits.load()]);
  return rooms;
});
async function refresh() {
  await page.run();
  if (page.error.value) handleStudentGone(page.error.value);
}
useRefetchOnVisible(refresh);

const tab = ref<VisitGroup>('upcoming');

const groups = computed(() => {
  const now = new Date();
  const byGroup: Record<VisitGroup, Visit[]> = { upcoming: [], past: [], canceled: [] };
  for (const v of myVisits.visits) byGroup[visitGroup(v, now)].push(v);
  const time = (s: string | null) => (s ? new Date(s).getTime() : 0);
  byGroup.upcoming.sort((a, b) => time(a.startAt) - time(b.startAt));
  byGroup.past.sort((a, b) => time(b.startAt) - time(a.startAt));
  byGroup.canceled.sort((a, b) => time(b.canceledAt) - time(a.canceledAt));
  return byGroup;
});

// 불러오기 전·실패 시에는 개수를 숨긴다 (0건으로 오해하지 않게)
const tabs = computed(() => {
  const loaded = !!page.data.value;
  return [
    {
      value: 'upcoming' as const,
      label: '예정',
      count: loaded ? groups.value.upcoming.length : undefined,
    },
    { value: 'past' as const, label: '지난 방문' },
    {
      value: 'canceled' as const,
      label: '취소됨',
      count: loaded ? groups.value.canceled.length : undefined,
    },
  ];
});
const visible = computed(() => groups.value[tab.value]);

const EMPTY: Record<VisitGroup, string> = {
  upcoming: '아직 신청한 방문이 없어요',
  past: '지난 방문이 없어요',
  canceled: '취소한 방문이 없어요',
};

function visitText(v: Pick<Visit, 'startAt' | 'endAt'>) {
  return isSameDay(v.startAt, v.endAt)
    ? `${formatDate(v.startAt)} ${formatTimeRange(v.startAt, v.endAt)}`
    : formatRange(v.startAt, v.endAt);
}

const isStarted = (v: Visit) => new Date(v.startAt).getTime() <= Date.now();

/** 취소한 방문을 다시 신청할 수 있는 자습실 (삭제·종료·마감·이미 신청함이면 null) */
function reapplyRoom(v: Visit): StudyRoom | null {
  if (v.studyRoom.deleted || myVisits.activeByRoom.has(v.studyRoom.id)) return null;
  const room = page.data.value?.find((r) => r.id === v.studyRoom.id);
  if (!room || getRoomPhase(room) === 'ended') return null;
  if (room.currentPersonnel >= room.maxPersonnel || !hasAvailableSlot(room)) return null;
  return room;
}

// 시간 변경 (?edit=visitId) · 다시 신청 (?apply=roomId)
const editDialog = useDialogQuery('edit');
const applyDialog = useDialogQuery('apply');
const editingVisit = computed(
  () =>
    myVisits.visits.find((v) => String(v.id) === editDialog.value.value && isVisitEditable(v)) ??
    null,
);
const applyingRoom = computed(() => {
  const visit = myVisits.visits.find(
    (v) => v.status === 'CANCELED' && String(v.studyRoom.id) === applyDialog.value.value,
  );
  return visit ? reapplyRoom(visit) : null;
});
const editOpen = computed({
  get: () => !!editingVisit.value,
  set: (v: boolean) => !v && editDialog.close(),
});
const applyOpen = computed({
  get: () => !!applyingRoom.value,
  set: (v: boolean) => !v && applyDialog.close(),
});

function onSaved(visit: Visit, mode: 'apply' | 'update') {
  if (mode === 'apply') {
    visitToast.applied(visit);
    tab.value = 'upcoming';
  } else {
    visitToast.updated(editingVisit.value, visit);
  }
  highlight(visit.id);
  void refresh();
}

// 취소
const canceling = ref<Visit | null>(null);
const cancelBusy = ref(false);
const cancelOpen = computed({
  get: () => !!canceling.value,
  set: (v: boolean) => !v && (canceling.value = null),
});
const cancelDescription = computed(() =>
  canceling.value
    ? `${canceling.value.studyRoom.name} · ${visitText(canceling.value)}. 취소해도 자리가 남아 있으면 다시 신청할 수 있어요.`
    : '',
);

async function confirmCancel() {
  const visit = canceling.value;
  const studentId = session.studentId;
  if (!visit || studentId === null) return;
  cancelBusy.value = true;
  try {
    await visitsApi.cancel(studentId, visit.id);
    toast.success('방문을 취소했어요');
  } catch (e) {
    if (!handleStudentGone(e)) toast.error(errorMessage(e));
  } finally {
    cancelBusy.value = false;
    canceling.value = null;
    void refresh();
  }
}
</script>

<template>
  <PageShell title="내 신청">
    <AppTabs v-model="tab" :items="tabs" label="신청 상태" class="mb-5" />

    <p class="sr-only" aria-live="polite">
      <template v-if="page.status.value === 'success'">신청 {{ visible.length }}건</template>
    </p>

    <div v-if="page.showSkeleton.value" class="flex flex-col gap-3">
      <AppSkeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" />
    </div>
    <ErrorState
      v-else-if="page.status.value === 'error' && !page.data.value"
      title="내 신청을 불러오지 못했어요"
      :description="errorMessage(page.error.value)"
      @retry="refresh"
    />
    <template v-else-if="page.data.value">
      <EmptyState v-if="visible.length === 0" :title="EMPTY[tab]">
        <RouterLink
          v-if="tab === 'upcoming'"
          :to="{ name: 'student-rooms' }"
          :class="buttonVariants({ variant: 'secondary' })"
        >
          자습실 보기
        </RouterLink>
      </EmptyState>

      <ul v-else class="flex flex-col gap-3">
        <li
          v-for="visit in visible"
          :key="visit.id"
          :class="
            cn(
              'flex flex-col gap-3 rounded-xl bg-surface p-4 sm:p-5',
              highlightedId === visit.id && 'animate-highlight',
            )
          "
        >
          <div class="flex items-start justify-between gap-3">
            <h2 :class="cn('text-heading', tab !== 'upcoming' && 'text-fg-muted')">
              {{ visit.studyRoom.name }}
            </h2>
            <AppBadge v-if="tab === 'canceled'" tone="canceled">취소됨</AppBadge>
            <AppBadge v-else-if="tab === 'past'" tone="ended">지난 방문</AppBadge>
            <AppBadge v-else-if="isStarted(visit)" tone="open">방문 중</AppBadge>
            <AppBadge v-else tone="applied">신청됨</AppBadge>
          </div>

          <dl class="flex flex-col gap-1 text-body">
            <div class="flex gap-3">
              <dt class="w-10 shrink-0 text-fg-muted">방문</dt>
              <dd class="tabular-nums">{{ visitText(visit) }}</dd>
            </div>
            <div class="flex gap-3">
              <dt class="w-10 shrink-0 text-fg-muted">신청</dt>
              <dd class="tabular-nums">{{ formatDate(visit.createdAt) }}</dd>
            </div>
            <div v-if="visit.status === 'CANCELED' && visit.canceledAt" class="flex gap-3">
              <dt class="w-10 shrink-0 text-fg-muted">취소</dt>
              <dd>
                <span class="tabular-nums">{{ formatDate(visit.canceledAt) }}</span>
                <span v-if="visit.studyRoom.deleted" class="text-fg-muted">
                  · 자습실이 삭제되어 자동으로 취소됐어요
                </span>
              </dd>
            </div>
          </dl>

          <div
            v-if="tab === 'upcoming' || (tab === 'canceled' && reapplyRoom(visit))"
            class="flex flex-wrap items-center justify-end gap-2"
          >
            <template v-if="tab === 'upcoming'">
              <template v-if="isVisitEditable(visit)">
                <AppButton variant="secondary" size="sm" @click="editDialog.open(visit.id)">
                  시간 변경
                </AppButton>
                <AppButton variant="danger-weak" size="sm" @click="canceling = visit">
                  취소
                </AppButton>
              </template>
              <p v-else class="text-caption text-fg-muted">
                이미 시작한 방문은 바꾸거나 취소할 수 없어요
              </p>
            </template>
            <AppButton
              v-else
              variant="weak"
              size="sm"
              @click="applyDialog.open(visit.studyRoom.id)"
            >
              다시 신청
            </AppButton>
          </div>
        </li>
      </ul>
    </template>

    <VisitFormDialog
      v-model:open="editOpen"
      :room="null"
      :visit="editingVisit"
      @saved="onSaved"
      @stale="refresh"
    />
    <VisitFormDialog
      v-model:open="applyOpen"
      :room="applyingRoom"
      :remaining="
        applyingRoom ? applyingRoom.maxPersonnel - applyingRoom.currentPersonnel : undefined
      "
      @saved="onSaved"
      @stale="refresh"
    />
    <ConfirmDialog
      v-model:open="cancelOpen"
      title="방문을 취소할까요?"
      :description="cancelDescription"
      confirm-label="방문 취소"
      :loading="cancelBusy"
      @confirm="confirmCancel"
    />
  </PageShell>
</template>
