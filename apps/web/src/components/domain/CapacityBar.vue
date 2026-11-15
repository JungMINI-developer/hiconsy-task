<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/utils/cn';

/**
 * 신청/정원 막대 + 숫자. 80% 이상 주의색, 100% 마감색.
 * 숫자를 항상 함께 보여 색만으로 상태를 전달하지 않는다.
 */
const props = withDefaults(
  defineProps<{
    current: number;
    max: number;
    /** teacher: "7 / 10명", student: "남은 자리 3 / 10" */
    perspective?: 'teacher' | 'student';
  }>(),
  { perspective: 'teacher' },
);

const ratio = computed(() => (props.max > 0 ? Math.min(props.current / props.max, 1) : 0));
const level = computed(() => (ratio.value >= 1 ? 'full' : ratio.value >= 0.8 ? 'warn' : 'open'));
const remaining = computed(() => Math.max(props.max - props.current, 0));

const fillClass = {
  open: 'bg-status-open',
  warn: 'bg-status-warn',
  full: 'bg-status-full',
} as const;

const label = computed(() =>
  props.perspective === 'student'
    ? `남은 자리 ${remaining.value} / ${props.max}`
    : `${props.current} / ${props.max}명`,
);
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      role="meter"
      :aria-valuenow="current"
      aria-valuemin="0"
      :aria-valuemax="max"
      :aria-valuetext="label"
      :aria-label="perspective === 'student' ? '남은 자리' : '신청 인원'"
      class="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-sunken sm:w-32"
    >
      <div
        :class="cn('h-full rounded-full transition-[width] duration-200', fillClass[level])"
        :style="{ width: `${ratio * 100}%` }"
      />
    </div>
    <span
      :class="cn('text-label tabular-nums', level === 'full' ? 'text-status-full' : 'text-fg')"
      data-testid="capacity-label"
    >
      {{ label }}
    </span>
  </div>
</template>
