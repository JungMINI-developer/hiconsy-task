<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { StudyRoom } from '@hiconsy/shared';
import { Plus } from 'lucide-vue-next';
import { studyRoomsApi } from '@/api/studyRooms';
import { useAsync } from '@/composables/useAsync';
import { useDialogQuery } from '@/composables/useDialogQuery';
import { scrollToItem, useHighlight, useRefetchOnVisible } from '@/composables/useRefetch';
import { useToast } from '@/composables/useToast';
import { getRoomPhase } from '@/utils/datetime';
import { seatUsageText } from '@/utils/roomSeats';
import { errorMessage } from '@/utils/errorMessage';
import PageShell from '@/components/layout/PageShell.vue';
import RoomPhaseBadge from '@/components/domain/RoomPhaseBadge.vue';
import StudyRoomCard from '@/components/domain/StudyRoomCard.vue';
import StudyRoomFormDialog from '@/components/domain/StudyRoomFormDialog.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppDropdownMenu from '@/components/ui/AppDropdownMenu.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import AppTabs from '@/components/ui/AppTabs.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';

const toast = useToast();
const rooms = useAsync(() => studyRoomsApi.list());
useRefetchOnVisible(rooms.run);
const { highlightedId, highlight } = useHighlight();

type Tab = 'active' | 'ended';
const tab = ref<Tab>('active');

const grouped = computed(() => {
  const now = new Date();
  const list = rooms.data.value ?? [];
  return {
    active: list.filter((r) => getRoomPhase(r, now) !== 'ended'),
    // 종료된 자습실은 최근에 끝난 것부터
    ended: list
      .filter((r) => getRoomPhase(r, now) === 'ended')
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()),
  };
});
const visible = computed(() => grouped.value[tab.value]);
// 불러오기 전·실패 시에는 개수를 숨긴다 (0개로 오해하지 않게)
const tabs = computed(() => {
  const loaded = !!rooms.data.value;
  return [
    {
      value: 'active' as const,
      label: '운영 중 · 예정',
      count: loaded ? grouped.value.active.length : undefined,
    },
    {
      value: 'ended' as const,
      label: '종료',
      count: loaded ? grouped.value.ended.length : undefined,
    },
  ];
});

// 등록·수정 다이얼로그 (URL 쿼리 ?new=1, ?edit=id)
const createDialog = useDialogQuery('new');
const editDialog = useDialogQuery('edit');
const editingRoom = computed(
  () => rooms.data.value?.find((r) => String(r.id) === editDialog.value.value) ?? null,
);
const editOpen = computed({
  get: () => !!editingRoom.value,
  set: (v: boolean) => !v && editDialog.close(),
});

function onSaved(room: StudyRoom, mode: 'create' | 'edit') {
  toast.success(mode === 'create' ? '자습실을 열었어요' : '변경 내용을 저장했어요');
  if (mode === 'create') tab.value = getRoomPhase(room) === 'ended' ? 'ended' : 'active';
  // 목록을 다시 받은 뒤 그 카드로 스크롤하고 강조한다 (목록 끝에 생겨 화면 밖일 수 있음)
  void rooms.run().then(async () => {
    await nextTick();
    scrollToItem(`[data-room-id="${room.id}"]`);
    highlight(room.id);
  });
}

function onGone() {
  toast.error('삭제된 자습실이에요');
  void rooms.run();
}

// 삭제
const deleting = ref<StudyRoom | null>(null);
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (v: boolean) => !v && (deleting.value = null),
});
const removing = ref(false);
const deleteDescription = computed(() => {
  const n = deleting.value?.currentPersonnel ?? 0;
  const effect =
    n > 0
      ? `신청한 학생 ${n}명의 신청이 모두 취소돼요. 학생은 내 신청에서 취소 사유를 볼 수 있어요.`
      : '아직 신청한 학생이 없어요. 삭제하면 목록에서 사라져요.';
  return `${deleting.value?.name ?? ''} · ${effect}`;
});

async function confirmDelete() {
  if (!deleting.value) return;
  removing.value = true;
  try {
    await studyRoomsApi.remove(deleting.value.id);
    toast.success('자습실을 삭제했어요');
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    removing.value = false;
    deleting.value = null;
    void rooms.run();
  }
}

function onMenu(room: StudyRoom, key: string) {
  if (key === 'edit') editDialog.open(room.id);
  if (key === 'delete') deleting.value = room;
}

const menuItems = [
  { key: 'edit', label: '수정' },
  { key: 'delete', label: '삭제', danger: true },
];
</script>

<template>
  <PageShell title="자습실">
    <template #actions>
      <AppButton @click="createDialog.open()">
        <Plus class="size-4" aria-hidden="true" />
        새 자습실
      </AppButton>
    </template>

    <AppTabs v-model="tab" :items="tabs" label="운영 상태" class="mb-5" />

    <p class="sr-only" aria-live="polite">
      <template v-if="rooms.status.value === 'success'">자습실 {{ visible.length }}개</template>
    </p>

    <div v-if="rooms.showSkeleton.value" class="grid gap-3 lg:grid-cols-2">
      <AppSkeleton v-for="i in 4" :key="i" class="h-32 rounded-xl" />
    </div>
    <ErrorState
      v-else-if="rooms.status.value === 'error' && !rooms.data.value"
      title="자습실 목록을 불러오지 못했어요"
      :description="errorMessage(rooms.error.value)"
      @retry="rooms.run()"
    />
    <template v-else-if="rooms.data.value">
      <EmptyState
        v-if="rooms.data.value.length === 0"
        title="아직 연 자습실이 없어요"
        description="최대 인원과 운영 기간을 정하면 학생들이 바로 신청할 수 있어요"
      >
        <AppButton @click="createDialog.open()">새 자습실</AppButton>
      </EmptyState>
      <EmptyState
        v-else-if="visible.length === 0"
        :title="
          tab === 'active' ? '운영 중이거나 예정된 자습실이 없어요' : '종료된 자습실이 없어요'
        "
      >
        <AppButton v-if="tab === 'active'" variant="weak" @click="createDialog.open()">
          새 자습실
        </AppButton>
      </EmptyState>
      <ul v-else class="grid gap-3 lg:grid-cols-2">
        <li v-for="room in visible" :key="room.id" :data-room-id="room.id">
          <StudyRoomCard
            :room="room"
            :to="{ name: 'teacher-room', params: { id: room.id } }"
            :highlighted="highlightedId === room.id"
            :muted="tab === 'ended'"
          >
            <template #badges>
              <RoomPhaseBadge :phase="getRoomPhase(room)" />
            </template>
            <template #menu>
              <AppDropdownMenu
                :items="menuItems"
                :label="`${room.name} 메뉴`"
                @select="(key) => onMenu(room, key)"
              />
            </template>
            <p class="text-label tabular-nums" data-testid="room-seats">
              {{ seatUsageText(room) }}
            </p>
          </StudyRoomCard>
        </li>
      </ul>
    </template>

    <StudyRoomFormDialog v-model:open="createDialog.isOpen.value" @saved="onSaved" />
    <StudyRoomFormDialog
      v-model:open="editOpen"
      :room="editingRoom"
      @saved="onSaved"
      @gone="onGone"
    />
    <ConfirmDialog
      v-model:open="deleteOpen"
      title="자습실을 삭제할까요?"
      :description="deleteDescription"
      confirm-label="삭제"
      :loading="removing"
      @confirm="confirmDelete"
    />
  </PageShell>
</template>
