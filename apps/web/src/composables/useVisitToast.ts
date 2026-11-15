import type { Visit } from '@hiconsy/shared';
import { formatDate, formatTime, formatTimeRange } from '@/utils/datetime';
import { useToast } from './useToast';

/** 방문 신청·변경 성공 토스트 (ux-writing.md#성공-토스트) */
export function useVisitToast() {
  const toast = useToast();
  return {
    applied(visit: Visit) {
      toast.success(
        `방문을 신청했어요. ${formatDate(visit.startAt)} ${formatTimeRange(visit.startAt, visit.endAt)}`,
      );
    },
    updated(prev: Pick<Visit, 'startAt'> | null, visit: Visit) {
      toast.success(
        prev
          ? `방문 시간을 바꿨어요. ${formatTime(prev.startAt)} → ${formatTime(visit.startAt)}`
          : '방문 시간을 바꿨어요',
      );
    },
  };
}
