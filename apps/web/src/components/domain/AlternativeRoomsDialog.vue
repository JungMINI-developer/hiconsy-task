<script setup lang="ts">
import { computed } from 'vue';
import type { StudyRoom } from '@hiconsy/shared';
import { formatDate, formatTimeRange } from '@/utils/datetime';
import type { VisitRange } from '@/utils/alternativeRooms';
import AppButton from '@/components/ui/AppButton.vue';
import AppDialog from '@/components/ui/AppDialog.vue';

/**
 * S-23 정원 마감 시 안내 (#35, #36).
 * - 같은 시간에 자리가 남은 다른 자습실 → 같은 시간이 채워진 신청 다이얼로그(S-22)
 * - 거절된 자습실에 그 시간으로 대기 등록 → 자리가 나면 순번대로 자리 제안(S-24)
 */
const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
  /** 정원이 차서 거절된 자습실 이름 */
  fullRoomName: string;
  range: VisitRange;
  rooms: StudyRoom[];
  /** 거절된 자습실에 대기할 수 있는지 (이미 대기 중이면 false) */
  canWait: boolean;
  /** 거절된 자습실의 현재 대기 인원 (제안 중 포함) */
  waitingCount: number;
  waiting?: boolean;
}>();

const emit = defineEmits<{ pick: [room: StudyRoom]; wait: [] }>();

const time = computed(
  () =>
    `${formatDate(props.range.startAt)} ${formatTimeRange(props.range.startAt, props.range.endAt)}`,
);
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="`${fullRoomName} 정원이 방금 찼어요`"
    :description="
      rooms.length
        ? `같은 시간(${time})에 자리가 있는 자습실이에요`
        : `같은 시간(${time})에 자리가 남은 자습실이 없어요`
    "
  >
    <ul v-if="rooms.length" class="flex flex-col gap-2">
      <li
        v-for="room in rooms"
        :key="room.id"
        class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-grey-50 px-4 py-3"
      >
        <!-- 좁은 화면(320px)에서는 버튼이 다음 줄 오른쪽으로 내려간다 -->
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-body font-medium">{{ room.name }}</span>
          <span class="text-caption whitespace-nowrap text-fg-muted tabular-nums">
            남은 자리 {{ room.availableSeats }} / {{ room.maxPersonnel }}
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

    <div
      v-if="canWait"
      :class="['flex flex-col gap-1', rooms.length > 0 && 'mt-5 border-t border-line pt-5']"
    >
      <p class="text-label">{{ fullRoomName }} 자리를 기다릴 수도 있어요</p>
      <p class="text-caption text-fg-muted">
        <template v-if="waitingCount">지금 {{ waitingCount }}명이 기다리고 있어요. </template>
        자리가 나면 순번대로 10분 동안 자리를 잡아 드려요.
      </p>
      <AppButton
        variant="weak"
        size="lg"
        class="mt-2 w-full"
        :loading="waiting"
        @click="emit('wait')"
      >
        이 시간으로 대기 등록
      </AppButton>
    </div>

    <AppButton variant="secondary" size="lg" class="mt-5 w-full" @click="open = false">
      닫기
    </AppButton>
  </AppDialog>
</template>
