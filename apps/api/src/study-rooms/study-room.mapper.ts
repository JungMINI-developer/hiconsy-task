import type { StudyRoom, StudyRoomHistory } from '@hiconsy/shared';
import type {
  StudyRoom as StudyRoomRow,
  Student as StudentRow,
  VisitHistory as VisitHistoryRow,
} from '../generated/prisma/client.js';

export function toStudyRoom(row: StudyRoomRow, currentPersonnel: number): StudyRoom {
  return {
    id: row.id,
    name: row.name,
    maxPersonnel: row.maxPersonnel,
    currentPersonnel,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toStudyRoomHistory(
  row: VisitHistoryRow & { student: Pick<StudentRow, 'id' | 'name'> },
): StudyRoomHistory {
  return {
    id: row.id,
    visitId: row.visitId,
    student: { id: row.student.id, name: row.student.name },
    action: row.action,
    prevStartAt: row.prevStartAt?.toISOString() ?? null,
    prevEndAt: row.prevEndAt?.toISOString() ?? null,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    actorType: row.actorType,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}
