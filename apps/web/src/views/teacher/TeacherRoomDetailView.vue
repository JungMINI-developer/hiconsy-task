<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  ErrorCode,
  type StudyRoom,
  type StudyRoomHistory,
  type StudyRoomVisit,
  type StudyRoomWaitlistEntry,
} from '@hiconsy/shared';
import { ChevronLeft, Search } from 'lucide-vue-next';
import { studyRoomsApi } from '@/api/studyRooms';
import { waitlistApi } from '@/api/waitlist';
import { useAsync } from '@/composables/useAsync';
import { useDialogQuery } from '@/composables/useDialogQuery';
import { useRefetchOnVisible } from '@/composables/useRefetch';
import { useToast } from '@/composables/useToast';
import {
  formatDate,
  formatRange,
  formatTime,
  formatTimeRange,
  getRoomPhase,
  isSameDay,
} from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import { filterHistories, type HistoryFilter } from '@/utils/history';
import PageShell from '@/components/layout/PageShell.vue';
import CapacityBar from '@/components/domain/CapacityBar.vue';
import HistoryTimeline from '@/components/domain/HistoryTimeline.vue';
import RoomPhaseBadge from '@/components/domain/RoomPhaseBadge.vue';
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

const props = defineProps<{ id: number }>();

const route = useRoute();
const router = useRouter();
const toast = useToast();

const detail = useAsync(async () => {
  // 대기 조회가 서버의 제안 정리(만료·다음 순번)를 일으키므로 정원보다 먼저 받는다 (#36)
  const waitlist = await waitlistApi.byRoom(props.id);
  const [room, histories, applicants] = await Promise.all([
    studyRoomsApi.get(props.id),
    studyRoomsApi.histories(props.id),
    studyRoomsApi.visits(props.id),
  ]);
  return { room, histories, applicants, waitlist };
});
useRefetchOnVisible(detail.run);

const room = computed<StudyRoom | null>(() => detail.data.value?.room ?? null);
const histories = computed<StudyRoomHistory[]>(() => detail.data.value?.histories ?? []);
const notFound = computed(() => detail.error.value?.code === ErrorCode.STUDY_ROOM_NOT_FOUND);

// 탭은 URL 쿼리(?tab=)와 동기화 — 수정 다이얼로그의 [신청자 보기] 링크가 이 값을 쓴다
type Tab = 'applicants' | 'waitlist' | 'histories';
const tab = computed<Tab>({
  get: () =>
    route.query.tab === 'histories' || route.query.tab === 'waitlist'
      ? route.query.tab
      : 'applicants',
  set: (v) => void router.replace({ query: { ...route.query, tab: v } }),
});

/** 현재 유효 신청 — 서버가 학생 연락처와 함께 준다 (동명이인 구분) */
const applicants = computed<StudyRoomVisit[]>(() => detail.data.value?.applicants ?? []);
/** 진행 중 대기 — 제안 중 → 대기 순번 순 (#36) */
const waitlist = computed<StudyRoomWaitlistEntry[]>(() => detail.data.value?.waitlist ?? []);
const tabs = computed(() => [
  { value: 'applicants' as const, label: '신청자', count: applicants.value.length },
  { value: 'waitlist' as const, label: '대기', count: waitlist.value.length },
  { value: 'histories' as const, label: '이력', count: histories.value.length },
]);

const historyFilter = ref<HistoryFilter>('ALL');
const studentQuery = ref('');
const filterOptions = [
  { value: 'ALL' as const, label: '전체' },
  { value: 'APPLY' as const, label: '신청' },
  { value: 'UPDATE' as const, label: '시간 변경' },
  { value: 'CANCEL' as const, label: '취소' },
];
const visibleHistories = computed(() =>
  filterHistories(histories.value, historyFilter.value, studentQuery.value),
);

function visitRange(start: string, end: string) {
  return isSameDay(start, end)
    ? `${formatDate(start)} ${formatTimeRange(start, end)}`
    : formatRange(start, end);
}

// 수정 (?edit=1)
const editDialog = useDialogQuery('edit');
function onSaved() {
  toast.success('변경 내용을 저장했어요');
  void detail.run();
}

// 삭제
const deleteOpen = ref(false);
const removing = ref(false);
const deleteDescription = computed(() => {
  const n = room.value?.currentPersonnel ?? 0;
  const effect =
    n > 0
      ? `신청한 학생 ${n}명의 신청이 모두 취소돼요. 학생은 내 신청에서 취소 사유를 볼 수 있어요.`
      : '아직 신청한 학생이 없어요. 삭제하면 목록에서 사라져요.';
  const w = waitlist.value.length;
  return `${room.value?.name ?? ''} · ${effect}${w > 0 ? ` 대기 ${w}명도 취소돼요.` : ''}`;
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
    <template v-if="room" #actions>
      <AppButton variant="light" @click="editDialog.open()">수정</AppButton>
      <AppButton variant="danger-weak" @click="deleteOpen = true"> 삭제 </AppButton>
    </template>

    <div v-if="detail.showSkeleton.value" class="flex flex-col gap-4">
      <AppSkeleton class="h-16 w-full" />
      <AppSkeleton class="h-64 w-full" />
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
      @retry="detail.run()"
    />

    <template v-else-if="room">
      <dl class="mb-8 flex flex-col gap-3 rounded-xl bg-surface p-4 sm:p-5">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
          <dt class="w-20 shrink-0 text-label text-fg-muted">운영 기간</dt>
          <dd class="flex flex-wrap items-center gap-2 tabular-nums">
            {{ formatRange(room.startDate, room.endDate) }}
            <RoomPhaseBadge :phase="getRoomPhase(room)" />
          </dd>
        </div>
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
          <dt class="w-20 shrink-0 text-label text-fg-muted">정원</dt>
          <dd class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CapacityBar :current="room.currentPersonnel" :max="room.maxPersonnel" />
            <span
              v-if="room.offeredCount + room.waitingCount"
              class="text-label text-fg-muted tabular-nums"
            >
              <template v-if="room.offeredCount">자리 제안 {{ room.offeredCount }}명 · </template
              >대기 {{ room.waitingCount }}명
            </span>
          </dd>
        </div>
      </dl>

      <AppTabs v-model="tab" :items="tabs" label="자습실 상세" class="mb-4" />

      <!-- 신청자 -->
      <section v-if="tab === 'applicants'" aria-label="신청자">
        <EmptyState v-if="applicants.length === 0" title="아직 신청한 학생이 없어요" />
        <div v-else class="overflow-x-auto rounded-xl bg-surface">
          <table class="w-full text-left text-body">
            <thead class="border-b border-line text-label text-fg-muted">
              <tr>
                <th scope="col" class="px-4 py-2.5 font-medium">이름</th>
                <th scope="col" class="px-4 py-2.5 font-medium">연락처</th>
                <th scope="col" class="px-4 py-2.5 font-medium">방문 시간</th>
                <th scope="col" class="hidden px-4 py-2.5 font-medium sm:table-cell">신청일</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="a in applicants" :key="a.id">
                <td class="px-4 py-3 font-medium whitespace-nowrap">{{ a.student.name }}</td>
                <td class="px-4 py-3 whitespace-nowrap tabular-nums">{{ a.student.phone }}</td>
                <td class="px-4 py-3 whitespace-nowrap tabular-nums">
                  {{ visitRange(a.startAt, a.endAt) }}
                </td>
                <td class="hidden px-4 py-3 text-fg-muted tabular-nums sm:table-cell">
                  {{ formatDate(a.appliedAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 대기 (#36) -->
      <section v-else-if="tab === 'waitlist'" aria-label="대기">
        <EmptyState
          v-if="waitlist.length === 0"
          title="대기 중인 학생이 없어요"
          description="정원이 차면 학생이 원하는 시간으로 대기할 수 있어요"
        />
        <div v-else class="overflow-x-auto rounded-xl bg-surface">
          <table class="w-full text-left text-body">
            <thead class="border-b border-line text-label text-fg-muted">
              <tr>
                <th scope="col" class="px-4 py-2.5 font-medium">순서</th>
                <th scope="col" class="px-4 py-2.5 font-medium">이름</th>
                <th scope="col" class="px-4 py-2.5 font-medium">연락처</th>
                <th scope="col" class="px-4 py-2.5 font-medium">원하는 시간</th>
                <th scope="col" class="hidden px-4 py-2.5 font-medium sm:table-cell">등록일</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="w in waitlist" :key="w.id">
                <td class="px-4 py-3 whitespace-nowrap tabular-nums">
                  <AppBadge v-if="w.status === 'OFFERED'" tone="applied">
                    자리 제안 ·
                    {{ w.offerExpiresAt ? `${formatTime(w.offerExpiresAt)}까지` : '' }}
                  </AppBadge>
                  <template v-else>{{ w.position }}번째</template>
                </td>
                <td class="px-4 py-3 font-medium whitespace-nowrap">{{ w.student.name }}</td>
                <td class="px-4 py-3 whitespace-nowrap tabular-nums">{{ w.student.phone }}</td>
                <td class="px-4 py-3 whitespace-nowrap tabular-nums">
                  {{ visitRange(w.startAt, w.endAt) }}
                </td>
                <td class="hidden px-4 py-3 text-fg-muted tabular-nums sm:table-cell">
                  {{ formatDate(w.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 이력 -->
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

      <StudyRoomFormDialog
        v-model:open="editDialog.isOpen.value"
        :room="room"
        @saved="onSaved"
        @gone="detail.run()"
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
