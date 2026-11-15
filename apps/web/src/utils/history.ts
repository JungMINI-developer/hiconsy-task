import type { StudyRoomHistory, VisitAction } from '@hiconsy/shared';

export interface Applicant {
  visitId: number;
  student: { id: number; name: string };
  startAt: string;
  endAt: string;
  /** 가장 최근 신청(재신청 포함) 시각 */
  appliedAt: string;
}

/**
 * 자습실 이력에서 현재 유효 신청자를 계산한다.
 * 신청자 목록 API가 따로 없으므로, 방문(visitId)별 마지막 이벤트가 취소가 아닌 것을 유효 신청으로 본다.
 */
export function deriveApplicants(histories: readonly StudyRoomHistory[]): Applicant[] {
  const sorted = [...histories].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id,
  );
  const byVisit = new Map<number, { last: StudyRoomHistory; appliedAt: string }>();
  for (const h of sorted) {
    const prev = byVisit.get(h.visitId);
    byVisit.set(h.visitId, {
      last: h,
      appliedAt: h.action === 'APPLY' ? h.createdAt : (prev?.appliedAt ?? h.createdAt),
    });
  }
  return [...byVisit.values()]
    .filter(({ last }) => last.action !== 'CANCEL')
    .map(({ last, appliedAt }) => ({
      visitId: last.visitId,
      student: last.student,
      startAt: last.startAt,
      endAt: last.endAt,
      appliedAt,
    }))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export type HistoryFilter = 'ALL' | VisitAction;

export function filterHistories(
  histories: readonly StudyRoomHistory[],
  filter: HistoryFilter,
  studentQuery: string,
): StudyRoomHistory[] {
  const q = studentQuery.trim();
  return histories
    .filter((h) => filter === 'ALL' || h.action === filter)
    .filter((h) => !q || h.student.name.includes(q))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id,
    );
}
