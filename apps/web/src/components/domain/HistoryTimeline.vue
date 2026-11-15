<script setup lang="ts">
import type { StudyRoomHistory } from '@hiconsy/shared';
import { cn } from '@/utils/cn';
import { formatRange, formatTimestamp } from '@/utils/datetime';

/**
 * 방문 신청·변경·취소 이력 타임라인 (최신이 위).
 * 변경은 "이전 → 이후"를 한 줄로, 시스템 처리는 사유와 함께 보여준다.
 */
withDefaults(
  defineProps<{
    items: StudyRoomHistory[];
    /** 학생 이름을 보여줄지 (S-11은 true, 내 신청 이력은 false) */
    showStudent?: boolean;
  }>(),
  { showStudent: true },
);

const ACTION_LABEL = { APPLY: '신청', UPDATE: '시간 변경', CANCEL: '취소' } as const;

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
            <span :class="cn('mr-2', h.action === 'CANCEL' && 'text-fg-muted')">
              {{ actionLabel(h) }}
            </span>
            <span class="tabular-nums">
              <template v-if="h.action === 'UPDATE' && h.prevStartAt && h.prevEndAt">
                <del class="text-fg-muted">{{ visitRange(h.prevStartAt, h.prevEndAt) }}</del>
                <span class="mx-1" aria-hidden="true">→</span>
                <span class="sr-only">에서</span>
                {{ visitRange(h.startAt, h.endAt) }}
              </template>
              <template v-else>{{ visitRange(h.startAt, h.endAt) }}</template>
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
