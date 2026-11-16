<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { SEATS_PER_ROW } from '@hiconsy/shared';
import { Check } from 'lucide-vue-next';
import { cn } from '@/utils/cn';

/**
 * 좌석 배치도 (S-22, #49). 한 줄 5석 격자에서 좌석 하나를 고른다.
 *
 * 접근성: 라디오 그룹 패턴. Tab은 그룹에 한 번만 들어오고(고른 좌석 또는 첫 빈 좌석),
 * 방향키 ←→↑↓로 움직이면서 고른다. 예약된 좌석은 건너뛴다.
 * 색만으로 상태를 전달하지 않도록 예약됨은 빗금, 고른 좌석은 체크 아이콘을 함께 쓴다.
 *
 * 칸 안의 내용은 `#seat` 슬롯으로 바꿀 수 있다 (강사 배치도에서 학생 이름 표시 등).
 */
export interface GridSeat {
  id: number;
  number: number;
  available: boolean;
}

const model = defineModel<number | null>({ required: true });

const props = defineProps<{
  seats: readonly GridSeat[];
  /** 시간 변경 중인 내 지금 좌석 — "내 좌석" 표시 */
  mySeatId?: number | null;
  /** 그룹 이름 (스크린리더) */
  label?: string;
  disabled?: boolean;
}>();

/** Tab으로 들어올 좌석: 고른 좌석 → 첫 빈 좌석 */
const tabStopId = computed(() => {
  const selected = props.seats.find((s) => s.id === model.value && s.available);
  return (selected ?? props.seats.find((s) => s.available))?.id ?? null;
});

function seatLabel(seat: GridSeat) {
  const state = seat.available ? '비어 있음' : '예약됨';
  return `${seat.number}번 좌석, ${state}${seat.id === props.mySeatId ? ', 내 좌석' : ''}`;
}

function select(seat: GridSeat) {
  if (props.disabled || !seat.available) return;
  model.value = seat.id;
}

const STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: SEATS_PER_ROW,
  ArrowUp: -SEATS_PER_ROW,
};

/** 방향키: 그 방향으로 가장 가까운 빈 좌석으로 옮기며 고른다 (끝에서 멈춤, 줄을 넘겨 감싸지 않음) */
async function onKeydown(event: KeyboardEvent, index: number) {
  const step = STEP[event.key];
  if (step === undefined) return;
  event.preventDefault();
  const group = (event.currentTarget as HTMLElement).parentElement;
  const horizontal = Math.abs(step) === 1;
  const row = Math.floor(index / SEATS_PER_ROW);
  for (let i = index + step; i >= 0 && i < props.seats.length; i += step) {
    if (horizontal && Math.floor(i / SEATS_PER_ROW) !== row) break;
    const seat = props.seats[i]!;
    if (seat.available) {
      select(seat);
      await nextTick();
      group?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.focus();
      return;
    }
  }
}

function seatClass(seat: GridSeat) {
  const selected = seat.id === model.value;
  return cn(
    'relative flex aspect-square min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border text-label tabular-nums transition-colors duration-120 ease-standard',
    !seat.available &&
      'cursor-not-allowed border-line bg-sunken bg-[repeating-linear-gradient(135deg,var(--color-grey-200)_0_3px,transparent_3px_8px)] text-fg-subtle',
    seat.available && !selected && 'border-line-input bg-surface text-fg hover:border-accent',
    seat.available && selected && 'border-accent bg-accent text-accent-fg',
    props.disabled && seat.available && 'opacity-60',
  );
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-caption text-fg-muted" aria-hidden="true">
      <li class="flex items-center gap-1.5">
        <span class="size-3.5 rounded-sm border border-line-input bg-surface" />빈 좌석
      </li>
      <li class="flex items-center gap-1.5">
        <span
          class="size-3.5 rounded-sm border border-line bg-sunken bg-[repeating-linear-gradient(135deg,var(--color-grey-300)_0_2px,transparent_2px_5px)]"
        />예약됨
      </li>
      <li class="flex items-center gap-1.5">
        <span class="flex size-3.5 items-center justify-center rounded-sm bg-accent">
          <Check class="size-2.5 text-accent-fg" :stroke-width="3" />
        </span>
        고른 좌석
      </li>
    </ul>

    <div class="flex flex-col gap-2">
      <p
        class="rounded-sm bg-sunken py-1 text-center text-caption text-fg-muted"
        aria-hidden="true"
      >
        앞
      </p>
      <div
        role="radiogroup"
        :aria-label="label ?? '좌석'"
        :aria-disabled="disabled || undefined"
        class="grid gap-2"
        :style="{ gridTemplateColumns: `repeat(${SEATS_PER_ROW}, minmax(0, 1fr))` }"
      >
        <button
          v-for="(seat, index) in seats"
          :key="seat.id"
          type="button"
          role="radio"
          :aria-checked="seat.id === model"
          :aria-disabled="!seat.available || disabled || undefined"
          :aria-label="seatLabel(seat)"
          :tabindex="seat.id === tabStopId ? 0 : -1"
          :class="seatClass(seat)"
          :data-index="index"
          :data-seat="seat.number"
          @click="select(seat)"
          @keydown="onKeydown($event, index)"
        >
          <slot name="seat" :seat="seat" :selected="seat.id === model">
            <Check
              v-if="seat.id === model"
              class="absolute top-1 right-1 size-3.5"
              :stroke-width="3"
              aria-hidden="true"
            />
            <span>{{ seat.number }}</span>
            <span v-if="seat.id === mySeatId" class="text-caption leading-none">내 좌석</span>
          </slot>
        </button>
      </div>
    </div>
  </div>
</template>
