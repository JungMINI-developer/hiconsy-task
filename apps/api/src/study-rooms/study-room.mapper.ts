import type { StudyRoom, StudyRoomHistory, StudyRoomVisit } from '@hiconsy/shared';
import type {
  StudyRoom as StudyRoomRow,
  Student as StudentRow,
  Visit as VisitRow,
  VisitHistory as VisitHistoryRow,
} from '../generated/prisma/client.js';
import { toKstIso, toKstIsoOrNull } from '../common/utils/date.js';
import { availableSeats, type WaitlistCounts } from '../waitlist/waitlist-sync.js';

const NO_WAITLIST: WaitlistCounts = { offered: 0, waiting: 0 };

export function toStudyRoom(
  row: StudyRoomRow,
  currentPersonnel: number,
  waitlist: WaitlistCounts = NO_WAITLIST,
): StudyRoom {
  return {
    id: row.id,
    name: row.name,
    maxPersonnel: row.maxPersonnel,
    currentPersonnel,
    offeredCount: waitlist.offered,
    waitingCount: waitlist.waiting,
    availableSeats: availableSeats(row.maxPersonnel, currentPersonnel, waitlist),
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

export function toStudyRoomVisit(
  row: VisitRow & {
    student: Pick<StudentRow, 'id' | 'name' | 'phone'>;
    histories: Pick<VisitHistoryRow, 'createdAt'>[];
  },
): StudyRoomVisit {
  return {
    id: row.id,
    student: { id: row.student.id, name: row.student.name, phone: row.student.phone },
    startAt: toKstIso(row.startAt),
    endAt: toKstIso(row.endAt),
    // 마지막 APPLY 이력이 없으면(이력 도입 전 데이터) 신청 행 생성 시각으로 대신한다
    appliedAt: toKstIso(row.histories[0]?.createdAt ?? row.createdAt),
  };
}
