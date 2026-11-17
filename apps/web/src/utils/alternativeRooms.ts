import type { StudyRoom, Visit } from '@hiconsy/shared';
import { findOverlap, type BusyRange } from './visitSlots';

export interface VisitRange {
  startAt: Date;
  endAt: Date;
}

/** 같은 시간으로 신청할 수 있는 다른 자습실과 그 시간 내내 비어 있는 좌석 수 */
export interface AlternativeRoom {
  room: StudyRoom;
  freeSeats: number;
}

/**
 * 고른 시간에 빈 좌석이 없을 때 **같은 시간으로 바로 신청할 수 있는** 다른 자습실 (#35, #49 S-23).
 *
 * - 방문 구간 전체가 운영 기간 안
 * - 그 시간 내내 비어 있는 좌석이 있음 (`GET /study-rooms/free-seats`, 조회 시점 값이라 최종 판단은 서버)
 * - 내가 이미 유효 신청한 자습실이 아님 (중복 금지)
 * - 내 다른 유효 신청과 시간이 겹치지 않음 (requirements 9절 #13)
 * - 시작이 지금 이후
 *
 * 빈 좌석이 많은 순으로 돌려준다 (신청이 성공할 가능성이 높은 곳부터).
 *
 * @param freeSeats 자습실 id → 그 시간 내내 비어 있는 좌석 수
 */
export function findAlternativeRooms(
  rooms: readonly StudyRoom[],
  freeSeats: ReadonlyMap<number, number>,
  range: VisitRange,
  myVisits: readonly Visit[],
  excludeRoomId: number,
  now: Date = new Date(),
): AlternativeRoom[] {
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
        new Date(room.startDate).getTime() <= range.startAt.getTime() &&
        range.endAt.getTime() <= new Date(room.endDate).getTime(),
    )
    .map((room) => ({ room, freeSeats: freeSeats.get(room.id) ?? 0 }))
    .filter((c) => c.freeSeats > 0)
    .sort((a, b) => b.freeSeats - a.freeSeats || a.room.id - b.room.id);
}
