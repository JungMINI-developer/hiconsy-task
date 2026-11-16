<script setup lang="ts">
import type { StudyRoom } from '@hiconsy/shared';
import { formatDate, formatTimeRange } from '@/utils/datetime';
import type { AlternativeRoom, VisitRange } from '@/utils/alternativeRooms';
import AppButton from '@/components/ui/AppButton.vue';
import AppDialog from '@/components/ui/AppDialog.vue';

/**
 * S-23 같은 시간에 빈 좌석이 있는 자습실 안내 (#35, #49).
 * 고른 자습실은 같은 시간이 미리 채워진 신청 다이얼로그(S-22)로 이어진다.
 */
const open = defineModel<boolean>('open', { required: true });

defineProps<{
  /** 고른 시간에 빈 좌석이 없는 자습실 이름 */
  fullRoomName: string;
  range: VisitRange;
  rooms: AlternativeRoom[];
}>();

const emit = defineEmits<{ pick: [room: StudyRoom] }>();
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="`그 시간에 ${fullRoomName}에는 빈 좌석이 없어요`"
    :description="`같은 시간(${formatDate(range.startAt)} ${formatTimeRange(range.startAt, range.endAt)})에 빈 좌석이 있는 자습실이에요`"
  >
    <ul class="flex flex-col gap-2">
      <li
        v-for="{ room, freeSeats } in rooms"
        :key="room.id"
        class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-grey-50 px-4 py-3"
      >
        <!-- 좁은 화면(320px)에서는 버튼이 다음 줄 오른쪽으로 내려간다 -->
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-body font-medium">{{ room.name }}</span>
          <span class="text-caption whitespace-nowrap text-fg-muted tabular-nums">
            빈 좌석 {{ freeSeats }}석 / {{ room.maxPersonnel }}석
          </span>
        </div>
        <AppButton
          variant="weak"
          size="sm"
          class="ml-auto shrink-0"
          :aria-label="`${room.name} 이 시간으로 신청`"
          @click="emit('pick', room)"
        >
          이 시간으로 신청
        </AppButton>
      </li>
    </ul>
    <AppButton variant="secondary" size="lg" class="mt-5 w-full" @click="open = false">
      닫기
    </AppButton>
  </AppDialog>
</template>
