import type { StudyRoom, Visit } from '@hiconsy/shared';
import { findOverlap, type BusyRange } from './visitSlots';

export interface VisitRange {
  startAt: Date;
  endAt: Date;
}

/** 새로 신청할 수 있는 자리 (대기자 몫을 뺀 값, #36) */
const remaining = (room: StudyRoom) => room.availableSeats;

/**
 * 정원이 차서 거절된 신청과 **같은 시간으로 바로 신청할 수 있는** 다른 자습실 (#35).
 *
 * - 방문 구간 전체가 운영 기간 안
 * - 남은 자리가 있음 (조회 시점 값이라 최종 판단은 서버)
 * - 내가 이미 유효 신청한 자습실이 아님 (중복 금지)
 * - 내 다른 유효 신청과 시간이 겹치지 않음 (requirements 9절 #13)
 * - 시작이 지금 이후
 *
 * 남은 자리가 많은 순으로 돌려준다 (신청이 성공할 가능성이 높은 곳부터).
 */
export function findAlternativeRooms(
  rooms: readonly StudyRoom[],
  range: VisitRange,
  myVisits: readonly Visit[],
  excludeRoomId: number,
  now: Date = new Date(),
): StudyRoom[] {
  if (range.startAt.getTime() <= now.getTime()) return [];

  const active = myVisits.filter((v) => v.status === 'APPLIED');
  const busy: BusyRange[] = active.map((v) => ({
    startAt: new Date(v.startAt),
    endAt: new Date(v.endAt),
    label: v.studyRoom.name,
  }));
  // 겹침은 학생 기준이라, 이 시간이 내 다른 신청과 겹치면 어느 자습실도 신청할 수 없다
  if (findOverlap(range.startAt, range.endAt, busy)) return [];

  const appliedRoomIds = new Set(active.map((v) => v.studyRoom.id));
  return rooms
    .filter(
      (room) =>
        room.id !== excludeRoomId &&
        !appliedRoomIds.has(room.id) &&
        remaining(room) > 0 &&
        new Date(room.startDate).getTime() <= range.startAt.getTime() &&
        range.endAt.getTime() <= new Date(room.endDate).getTime(),
    )
    .sort((a, b) => remaining(b) - remaining(a) || a.id - b.id);
}
