import type { StudyRoomWaitlistEntry, WaitlistEntry } from '@hiconsy/shared';
import { toKstIso, toKstIsoOrNull } from '../common/utils/date.js';
import type {
  Student as StudentRow,
  StudyRoom as StudyRoomRow,
  WaitlistEntry as WaitlistEntryRow,
} from '../generated/prisma/client.js';

export function toWaitlistEntry(
  row: WaitlistEntryRow & { studyRoom: StudyRoomRow },
  position: number | null,
): WaitlistEntry {
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
    position,
    offeredAt: toKstIsoOrNull(row.offeredAt),
    offerExpiresAt: toKstIsoOrNull(row.offerExpiresAt),
    endedAt: toKstIsoOrNull(row.endedAt),
    endReason: row.endReason,
    createdAt: toKstIso(row.createdAt),
  };
}

export function toStudyRoomWaitlistEntry(
  row: WaitlistEntryRow & { student: Pick<StudentRow, 'id' | 'name' | 'phone'> },
  position: number | null,
): StudyRoomWaitlistEntry {
  return {
    id: row.id,
    student: { id: row.student.id, name: row.student.name, phone: row.student.phone },
    startAt: toKstIso(row.startAt),
    endAt: toKstIso(row.endAt),
    status: row.status === 'OFFERED' ? 'OFFERED' : 'WAITING',
    position,
    offerExpiresAt: toKstIsoOrNull(row.offerExpiresAt),
    createdAt: toKstIso(row.createdAt),
  };
}
