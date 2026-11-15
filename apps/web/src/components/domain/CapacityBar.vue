<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/utils/cn';

/**
 * 정원 막대 + 숫자. 숫자를 항상 함께 보여 색만으로 상태를 전달하지 않는다.
 * - 강사: 신청 인원만큼 찬다 (80% 이상 주의색, 100% 마감색)
 * - 학생: 남은 자리만큼 찬다 — 라벨 "남은 자리 n"과 막대가 같은 방향으로 읽히게
 *   (남은 자리가 20% 이하면 주의색, 0이면 마감색 글자)
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

const remaining = computed(() => Math.max(props.max - props.current, 0));
/** 신청 비율 (0~1) — 상태색 기준 */
const taken = computed(() => (props.max > 0 ? Math.min(props.current / props.max, 1) : 0));
const level = computed(() => (taken.value >= 1 ? 'full' : taken.value >= 0.8 ? 'warn' : 'open'));
/** 막대 길이: 강사는 신청 비율, 학생은 남은 비율 */
const ratio = computed(() => {
  if (props.max <= 0) return 0;
  return props.perspective === 'student' ? remaining.value / props.max : taken.value;
});
const meterValue = computed(() =>
  props.perspective === 'student' ? remaining.value : props.current,
);

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
      :aria-valuenow="meterValue"
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
