<script setup lang="ts">
import type { SeatOccupancy } from '@hiconsy/shared';
import { SEATS_PER_ROW } from '@hiconsy/shared';
import { cn } from '@/utils/cn';
import { formatTime, formatTimeRange } from '@/utils/datetime';

/**
 * 강사용 좌석 배치도 (S-11, #51). 그 시각에 좌석마다 앉기로 한 학생을 보여준다.
 *
 * 학생용 `SeatGrid`와 같은 한 줄 5석 격자·"앞" 라벨을 쓰지만 **고르는 동작이 없는 보기 전용**이라
 * 라디오 그룹이 아니라 목록으로 읽힌다. 강조는 신청 학생 목록(왼쪽 패널)에서 한다.
 */
const props = defineProps<{
  seats: readonly SeatOccupancy[];
  /** 강조할 좌석 id (신청 학생 목록에서 고른 학생) */
  highlightedSeatId?: number | null;
}>();

function seatLabel(seat: SeatOccupancy) {
  if (!seat.visit) return `${seat.number}번 좌석, 비어 있음`;
  const v = seat.visit;
  return `${seat.number}번 좌석, ${v.student.name}, ${formatTimeRange(v.startAt, v.endAt)}`;
}

function seatClass(seat: SeatOccupancy) {
  const highlighted = seat.id === props.highlightedSeatId;
  return cn(
    'relative flex min-h-12 min-w-0 flex-col items-start justify-between gap-0.5 rounded-md border px-1.5 py-1 text-left tabular-nums transition-colors duration-120 ease-standard sm:min-h-16 sm:px-2 sm:py-1.5',
    seat.visit ? 'border-transparent bg-accent-weak text-fg' : 'border-line-input bg-surface',
    highlighted && 'border-accent ring-2 ring-accent',
  );
}
</script>

<template>
  <!-- 이름을 넣으려고 학생용보다 칸을 넓게(최대 약 96px). 320px에서는 약 50px로 줄고 끝나는 시각을 숨긴다 -->
  <div class="mx-auto flex w-full max-w-[33rem] flex-col gap-4">
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-muted" aria-hidden="true">
      <li class="flex items-center gap-1.5">
        <span class="size-3.5 rounded-sm bg-accent-weak" />이용 중
      </li>
      <li class="flex items-center gap-1.5">
        <span class="size-3.5 rounded-sm border border-line-input bg-surface" />빈 좌석
      </li>
    </ul>

    <div class="flex flex-col gap-2">
      <p
        class="rounded-sm bg-sunken py-1 text-center text-caption text-fg-muted"
        aria-hidden="true"
      >
        앞
      </p>
      <ul
        aria-label="좌석 배치도"
        class="grid gap-1.5 sm:gap-3"
        :style="{ gridTemplateColumns: `repeat(${SEATS_PER_ROW}, minmax(0, 6rem))` }"
      >
        <li
          v-for="seat in seats"
          :key="seat.id"
          :class="seatClass(seat)"
          :aria-label="seatLabel(seat)"
          :aria-current="seat.id === highlightedSeatId || undefined"
          :title="seat.visit ? seatLabel(seat) : undefined"
          :data-seat="seat.number"
          :data-occupied="!!seat.visit || undefined"
          :data-highlighted="seat.id === highlightedSeatId || undefined"
        >
          <span class="text-caption leading-none text-fg-muted" aria-hidden="true">
            {{ seat.number }}
          </span>
          <template v-if="seat.visit">
            <span
              :class="
                cn(
                  'w-full truncate text-caption leading-tight sm:text-label',
                  seat.id === highlightedSeatId && 'font-bold',
                )
              "
              aria-hidden="true"
            >
              {{ seat.visit.student.name }}
            </span>
            <span
              class="hidden text-caption leading-none text-fg-muted sm:inline"
              aria-hidden="true"
            >
              ~{{ formatTime(seat.visit.endAt) }}
            </span>
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>
