import type { Visit } from '@hiconsy/shared';
import { toKstIso, toKstIsoOrNull } from '../common/utils/date.js';
import type { StudyRoom as StudyRoomRow, Visit as VisitRow } from '../generated/prisma/client.js';

export function toVisit(row: VisitRow & { studyRoom: StudyRoomRow }): Visit {
  return {
    id: row.id,
    studentId: row.studentId,
    studyRoom: {
      id: row.studyRoom.id,
      name: row.studyRoom.name,
      startDate: toKstIso(row.studyRoom.startDate),
      endDate: toKstIso(row.studyRoom.endDate),
      deleted: row.studyRoom.deletedAt !== null,
    },
    startAt: toKstIso(row.startAt),
    endAt: toKstIso(row.endAt),
    status: row.status,
    canceledAt: toKstIsoOrNull(row.canceledAt),
    createdAt: toKstIso(row.createdAt),
    updatedAt: toKstIso(row.updatedAt),
  };
}
