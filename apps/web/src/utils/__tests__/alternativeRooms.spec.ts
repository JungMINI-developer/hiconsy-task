import { describe, expect, it } from 'vitest';
import type { StudyRoom, Visit } from '@hiconsy/shared';
import { findAlternativeRooms, type AlternativeRoom } from '../alternativeRooms';

// TZ=Asia/Seoul (vitest.config.ts)
const at = (time: string) => new Date(`2026-11-20T${time}:00+09:00`);
const now = new Date('2026-11-15T12:00:00+09:00');
const range = { startAt: at('19:00'), endAt: at('21:00') };

function room(id: number, overrides: Partial<StudyRoom> = {}): StudyRoom {
  return {
    id,
    name: `${id}번 자습실`,
    maxPersonnel: 5,
    currentPersonnel: 0,
    occupiedSeats: null,
    unfinishedVisits: 0,
    hasFreeSlot: true,
    startDate: '2026-11-20T09:00:00+09:00',
    endDate: '2026-11-20T22:00:00+09:00',
    createdAt: '2026-11-01T00:00:00+09:00',
    updatedAt: '2026-11-01T00:00:00+09:00',
    ...overrides,
  };
}

function visit(roomId: number, start: string, end: string, status: Visit['status'] = 'APPLIED') {
  return {
    id: roomId * 100,
    studentId: 1,
    studyRoom: {
      id: roomId,
      name: `${roomId}번 자습실`,
      startDate: '2026-11-20T09:00:00+09:00',
      endDate: '2026-11-20T22:00:00+09:00',
      deleted: false,
    },
    startAt: at(start).toISOString(),
    endAt: at(end).toISOString(),
    seat: null,
    status,
    canceledAt: null,
    createdAt: '2026-11-01T00:00:00+09:00',
    updatedAt: '2026-11-01T00:00:00+09:00',
  } satisfies Visit;
}

const ids = (list: AlternativeRoom[]) => list.map((c) => c.room.id);
/** 빈 좌석 수 (기본: 모든 자습실 5석) */
const free = (overrides: Record<number, number> = {}) =>
  new Map(Array.from({ length: 10 }, (_, i) => [i, overrides[i] ?? 5]));

describe('findAlternativeRooms', () => {
  it('빈 좌석이 없는 자습실을 빼고, 빈 좌석이 많은 순으로 빈 좌석 수와 함께 준다', () => {
    const rooms = [room(1), room(2), room(3)];
    const result = findAlternativeRooms(rooms, free({ 2: 2, 3: 4 }), range, [], 1, now);
    expect(result.map((c) => [c.room.id, c.freeSeats])).toEqual([
      [3, 4],
      [2, 2],
    ]);
  });

  it('빈 좌석이 0이거나 조회 결과에 없는 자습실은 뺀다', () => {
    const rooms = [room(2), room(3), room(11)];
    expect(ids(findAlternativeRooms(rooms, free({ 2: 0 }), range, [], 1, now))).toEqual([3]);
  });

  it('방문 구간 전체가 운영 기간 안인 자습실만 준다 (경계는 포함)', () => {
    const rooms = [
      room(2, { endDate: '2026-11-20T20:00:00+09:00' }), // 21시 전에 끝남
      room(3, { startDate: '2026-11-20T19:30:00+09:00' }), // 19시 이후 시작
      room(4, { startDate: '2026-11-20T19:00:00+09:00', endDate: '2026-11-20T21:00:00+09:00' }),
    ];
    expect(ids(findAlternativeRooms(rooms, free(), range, [], 1, now))).toEqual([4]);
  });

  it('이미 유효 신청한 자습실은 빼고, 취소한 자습실은 준다', () => {
    const rooms = [room(2), room(3)];
    const mine = [visit(2, '10:00', '12:00'), visit(3, '10:00', '12:00', 'CANCELED')];
    expect(ids(findAlternativeRooms(rooms, free(), range, mine, 1, now))).toEqual([3]);
  });

  it('고른 시간이 내 다른 유효 신청과 겹치면 어느 자습실도 주지 않는다', () => {
    const mine = [visit(9, '20:00', '22:00')];
    expect(findAlternativeRooms([room(2), room(3)], free(), range, mine, 1, now)).toEqual([]);
    // 맞닿는 구간은 겹치지 않는다
    const adjacent = [visit(9, '21:00', '22:00')];
    expect(ids(findAlternativeRooms([room(2)], free(), range, adjacent, 1, now))).toEqual([2]);
  });

  it('이미 시작한 시간이면 주지 않는다', () => {
    expect(findAlternativeRooms([room(2)], free(), range, [], 1, at('19:00'))).toEqual([]);
  });
});
