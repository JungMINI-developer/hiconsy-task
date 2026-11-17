<script setup lang="ts">
import type { StudyRoomHistory } from '@hiconsy/shared';
import { cn } from '@/utils/cn';
import { formatRange, formatTimestamp } from '@/utils/datetime';
import AppBadge from '@/components/ui/AppBadge.vue';
import type { BadgeVariants } from '@/components/ui/variants';

/**
 * 방문 신청·변경·취소 이력 타임라인 (최신이 위).
 * 변경은 바뀐 것(시간·좌석)만 "이전 → 이후"로 한 줄에, 시스템 처리는 사유와 함께 보여준다.
 * 좌석 도입 전 이력(`seat`가 null)은 좌석을 빼고 보여준다 (#51).
 */
withDefaults(
  defineProps<{
    items: StudyRoomHistory[];
    /** 학생 이름을 보여줄지 (S-11은 true, 내 신청 이력은 false) */
    showStudent?: boolean;
  }>(),
  { showStudent: true },
);

const ACTION_LABEL = { APPLY: '신청', UPDATE: '변경', CANCEL: '취소' } as const;

/** 훑어볼 때 종류가 먼저 보이도록 배지 색을 나눈다 (글자 라벨이 있어 색만으로 구분하지 않음) */
function actionTone(h: StudyRoomHistory): BadgeVariants['tone'] {
  if (h.action === 'APPLY') return 'applied';
  if (h.action === 'UPDATE') return 'neutral';
  return h.actorType === 'SYSTEM' ? 'full' : 'canceled';
}

function actionLabel(h: StudyRoomHistory) {
  return h.action === 'CANCEL' && h.actorType === 'SYSTEM' ? '자동 취소' : ACTION_LABEL[h.action];
}

function dotClass(h: StudyRoomHistory) {
  if (h.actorType === 'SYSTEM') return 'border-2 border-status-danger bg-surface';
  if (h.action === 'APPLY') return 'bg-status-applied';
  if (h.action === 'UPDATE') return 'bg-status-warn';
  return 'bg-status-canceled';
}

/** 방문 구간 — 운영 기간이 여러 날일 수 있으므로 날짜를 항상 붙인다 */
const visitRange = (start: string, end: string) => formatRange(start, end);

/** 변경에서 시간이 바뀌었는지 (좌석만 바꾼 변경은 시간을 보여주지 않는다) */
function timeChanged(h: StudyRoomHistory): h is StudyRoomHistory & {
  prevStartAt: string;
  prevEndAt: string;
} {
  if (h.action !== 'UPDATE' || !h.prevStartAt || !h.prevEndAt) return false;
  const same = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();
  return !same(h.prevStartAt, h.startAt) || !same(h.prevEndAt, h.endAt);
}

function seatChanged(h: StudyRoomHistory) {
  return h.action === 'UPDATE' && !!h.prevSeat && !!h.seat && h.prevSeat.id !== h.seat.id;
}

/** 시간을 보여줄지 — 좌석만 바꾼 변경이면 숨긴다 */
const showTime = (h: StudyRoomHistory) => h.action !== 'UPDATE' || timeChanged(h) || !h.seat;

const ACTOR_NOTE = { SYSTEM: '시스템 처리', INSTRUCTOR: '강사 처리', STUDENT: null } as const;
</script>

<template>
  <ol class="flex flex-col">
    <li v-for="(h, index) in items" :key="h.id" class="relative flex gap-3 pb-4 last:pb-0">
      <!-- 세로선 -->
      <span
        v-if="index < items.length - 1"
        class="absolute top-4 bottom-0 left-1 w-px -translate-x-1/2 bg-line"
        aria-hidden="true"
      />
      <span :class="cn('mt-2 size-2 shrink-0 rounded-full', dotClass(h))" aria-hidden="true" />
      <div class="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
        <time
          :datetime="h.createdAt"
          class="shrink-0 text-caption text-fg-muted tabular-nums sm:w-24"
        >
          {{ formatTimestamp(h.createdAt) }}
        </time>
        <div class="min-w-0 text-body">
          <p>
            <span v-if="showStudent" class="mr-2 font-medium">{{ h.student.name }}</span>
            <!-- 학생을 삭제해도 이력은 남는다 (#61) -->
            <AppBadge
              v-if="showStudent && h.student.deletedAt"
              tone="canceled"
              class="mr-2 align-middle"
              data-testid="withdrawn"
            >
              탈퇴
            </AppBadge>
            <AppBadge :tone="actionTone(h)" class="mr-2 align-middle">
              {{ actionLabel(h) }}
            </AppBadge>
            <span class="tabular-nums">
              <template v-if="timeChanged(h)">
                <del class="text-fg-muted">{{ visitRange(h.prevStartAt, h.prevEndAt) }}</del>
                <span class="mx-1" aria-hidden="true">→</span>
                <span class="sr-only">에서</span>
                {{ visitRange(h.startAt, h.endAt) }}
              </template>
              <template v-else-if="showTime(h)">{{ visitRange(h.startAt, h.endAt) }}</template>
            </span>
            <span v-if="h.seat" class="tabular-nums" data-testid="history-seat">
              <span v-if="showTime(h)" class="mx-1 text-fg-muted" aria-hidden="true">·</span>
              <template v-if="seatChanged(h)">
                <del class="text-fg-muted">{{ h.prevSeat!.number }}번</del>
                <span class="mx-1" aria-hidden="true">→</span>
                <span class="sr-only">에서</span>
                {{ h.seat.number }}번 좌석
              </template>
              <template v-else>{{ h.seat.number }}번 좌석</template>
            </span>
          </p>
          <p v-if="ACTOR_NOTE[h.actorType] || h.reason" class="text-caption text-fg-muted">
            {{
              [ACTOR_NOTE[h.actorType], h.reason && `사유: ${h.reason}`].filter(Boolean).join(' · ')
            }}
          </p>
        </div>
      </div>
    </li>
  </ol>
</template>
