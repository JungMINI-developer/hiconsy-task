import type { Visit } from '@hiconsy/shared';
import { toKstIso, toKstIsoOrNull } from '../common/utils/date.js';
import type {
  Seat as SeatRow,
  StudyRoom as StudyRoomRow,
  Visit as VisitRow,
} from '../generated/prisma/client.js';
import { toSeatRef } from '../seats/seat.mapper.js';

/** 신청을 응답으로 바꿀 때 함께 읽는 관계 */
export const visitInclude = { studyRoom: true, seat: true } as const;

export function toVisit(row: VisitRow & { studyRoom: StudyRoomRow; seat: SeatRow | null }): Visit {
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
    seat: toSeatRef(row.seat),
    status: row.status,
    canceledAt: toKstIsoOrNull(row.canceledAt),
    createdAt: toKstIso(row.createdAt),
    updatedAt: toKstIso(row.updatedAt),
  };
}
