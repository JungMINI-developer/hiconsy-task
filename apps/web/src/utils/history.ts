import type { StudyRoomHistory, VisitAction } from '@hiconsy/shared';

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
