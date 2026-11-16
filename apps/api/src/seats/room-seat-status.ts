import type { Prisma } from '../generated/prisma/client.js';

/** 신청 시간은 30분 단위로 고른다 (웹 S-22) */
export const SLOT_MS = 30 * 60 * 1000;

/** 시각을 다음 30분 경계로 올린다 (이미 경계면 그대로) */
export function ceilToSlot(time: number): number {
  return Math.ceil(time / SLOT_MS) * SLOT_MS;
}

interface Interval {
  startAt: Date;
  endAt: Date;
}

/**
 * 좌석 하나가 [from, until) 안에서 30분 경계에 맞춘 30분 이상 비는 구간이 있는지.
 * @param visits 그 좌석의 유효 신청 (순서 무관)
 */
export function seatHasFreeSlot(visits: readonly Interval[], from: number, until: number): boolean {
  let cursor = from;
  const sorted = [...visits].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  for (const v of sorted) {
    if (ceilToSlot(cursor) + SLOT_MS <= Math.min(v.startAt.getTime(), until)) return true;
    cursor = Math.max(cursor, v.endAt.getTime());
    if (cursor >= until) return false;
  }
  return ceilToSlot(cursor) + SLOT_MS <= until;
}

/** 자습실 카드(S-20)에 붙는 좌석 현황 (#49) */
export interface RoomSeatStatus {
  /** 지금 시각이 방문 구간 안에 있는 유효 신청 수. 운영 시간이 아니면 null */
  occupiedSeats: number | null;
  /** 남은 운영 시간에 30분 이상 비는 좌석이 하나라도 있는지 */
  hasFreeSlot: boolean;
}

/**
 * 자습실들의 좌석 현황을 한 번에 계산한다 (쿼리 1번).
 * - 남은 시간: 지금 이후 첫 30분 경계(운영 시작 전이면 운영 시작)부터 운영 종료까지
 * - 쓰는 좌석(번호 ≤ 최대 인원)만 센다. 신청이 없는 좌석이 있으면 바로 빈 30분이 있다
 */
export async function computeRoomSeatStatus(
  db: Prisma.TransactionClient,
  rooms: readonly { id: number; maxPersonnel: number; startDate: Date; endDate: Date }[],
  now: Date = new Date(),
): Promise<Map<number, RoomSeatStatus>> {
  const visits = await db.visit.findMany({
    where: {
      studyRoomId: { in: rooms.map((r) => r.id) },
      status: 'APPLIED',
      endAt: { gt: now },
      seat: { isNot: null },
    },
    select: {
      studyRoomId: true,
      startAt: true,
      endAt: true,
      seat: { select: { number: true } },
    },
  });

  const result = new Map<number, RoomSeatStatus>();
  for (const room of rooms) {
    const nowMs = now.getTime();
    const operating = room.startDate.getTime() <= nowMs && nowMs < room.endDate.getTime();
    const roomVisits = visits.filter(
      (v) => v.studyRoomId === room.id && v.seat !== null && v.seat.number <= room.maxPersonnel,
    );

    const occupiedSeats = operating
      ? roomVisits.filter((v) => v.startAt.getTime() <= nowMs).length
      : null;

    const from = Math.max(ceilToSlot(nowMs), room.startDate.getTime());
    const until = room.endDate.getTime();
    const bySeat = new Map<number, Interval[]>();
    for (const v of roomVisits) {
      const list = bySeat.get(v.seat!.number) ?? [];
      list.push(v);
      bySeat.set(v.seat!.number, list);
    }
    const hasFreeSlot =
      from + SLOT_MS <= until &&
      (bySeat.size < room.maxPersonnel ||
        [...bySeat.values()].some((seatVisits) => seatHasFreeSlot(seatVisits, from, until)));

    result.set(room.id, { occupiedSeats, hasFreeSlot });
  }
  return result;
}
