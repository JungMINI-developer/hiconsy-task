import type { Visit } from '@hiconsy/shared';
import { formatDate, formatTimeRange } from '@/utils/datetime';
import { visitChangeText, type VisitSnapshot } from '@/utils/visitChange';
import { useToast } from './useToast';

const snapshot = (v: Visit): VisitSnapshot => ({
  startAt: v.startAt,
  endAt: v.endAt,
  seatNumber: v.seat?.number ?? null,
});

/** 방문 신청·변경 성공 토스트 (ux-writing.md#성공-토스트) */
export function useVisitToast() {
  const toast = useToast();
  return {
    applied(visit: Visit) {
      toast.success(
        `방문을 신청했어요. ${formatDate(visit.startAt)} ${formatTimeRange(visit.startAt, visit.endAt)}`,
      );
    },
    /** 바뀐 것만: `방문을 바꿨어요. 3번 → 7번 좌석 · 11:00 – 13:00 → 12:00 – 14:00` (#49) */
    updated(prev: Visit | null, visit: Visit) {
      const change = prev ? visitChangeText(snapshot(prev), snapshot(visit)) : '';
      toast.success(change ? `방문을 바꿨어요. ${change}` : '방문을 바꿨어요');
    },
  };
}
