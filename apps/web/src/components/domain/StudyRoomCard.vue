<script setup lang="ts">
import type { StudyRoom } from '@hiconsy/shared';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { cn } from '@/utils/cn';
import { formatRange } from '@/utils/datetime';

/**
 * 자습실 카드 (S-10 강사, S-20 학생 공용).
 * 역할별 정보·액션은 슬롯으로 채운다.
 * `to`가 있으면 제목 링크가 카드 전체를 덮어 클릭 영역이 되고, 슬롯의 버튼은 그 위에 놓인다.
 */
const props = defineProps<{
  room: Pick<StudyRoom, 'id' | 'name' | 'startDate' | 'endDate'>;
  to?: RouteLocationRaw;
  /** 방금 바뀐 항목 강조 (1.2s) */
  highlighted?: boolean;
  muted?: boolean;
}>();
</script>

<template>
  <article
    :class="
      cn(
        'relative flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 transition-colors duration-120 ease-standard sm:p-5',
        props.to && 'has-[a[data-card-link]:hover]:border-line-strong',
        props.highlighted && 'animate-highlight',
      )
    "
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 :class="cn('text-heading', props.muted && 'text-fg-muted')">
          <RouterLink
            v-if="props.to"
            :to="props.to"
            data-card-link
            class="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {{ room.name }}
          </RouterLink>
          <template v-else>{{ room.name }}</template>
        </h2>
        <p class="mt-1 text-body text-fg-muted tabular-nums">
          {{ formatRange(room.startDate, room.endDate) }}
        </p>
      </div>
      <div class="relative z-10 flex shrink-0 items-center gap-1">
        <slot name="badges" />
        <slot name="menu" />
      </div>
    </div>
    <div
      v-if="$slots.default"
      class="relative z-10 flex flex-wrap items-center justify-between gap-3"
    >
      <slot />
    </div>
  </article>
</template>
