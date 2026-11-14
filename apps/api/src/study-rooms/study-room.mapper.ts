import type { StudyRoom, StudyRoomHistory } from '@hiconsy/shared';
import type {
  StudyRoom as StudyRoomRow,
  Student as StudentRow,
  VisitHistory as VisitHistoryRow,
} from '../generated/prisma/client.js';
import { toKstIso, toKstIsoOrNull } from '../common/utils/date.js';

export function toStudyRoom(row: StudyRoomRow, currentPersonnel: number): StudyRoom {
  return {
    id: row.id,
    name: row.name,
    maxPersonnel: row.maxPersonnel,
    currentPersonnel,
    startDate: toKstIso(row.startDate),
    endDate: toKstIso(row.endDate),
    createdAt: toKstIso(row.createdAt),
    updatedAt: toKstIso(row.updatedAt),
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
    prevStartAt: toKstIsoOrNull(row.prevStartAt),
    prevEndAt: toKstIsoOrNull(row.prevEndAt),
    startAt: toKstIso(row.startAt),
    endAt: toKstIso(row.endAt),
    actorType: row.actorType,
    reason: row.reason,
    createdAt: toKstIso(row.createdAt),
  };
}
