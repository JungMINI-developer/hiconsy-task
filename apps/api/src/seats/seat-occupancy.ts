import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import type { Prisma, Seat } from '../generated/prisma/client.js';

/**
 * 좌석 단위 정원 (#45): 같은 좌석의 유효 신청끼리 방문 구간이 겹치면 안 된다.
 * 구간은 반열린 구간 [start, end)이라 18~20시 다음 20~22시는 같은 좌석에 앉을 수 있다.
 *
 * 이 파일의 검사는 모두 **자습실 행 락(FOR UPDATE) 안에서** 불러야 한다.
 * 같은 자습실의 좌석 작업이 그 락으로 차례로 처리되어 "비었는지 확인 → 저장" 사이에 끼어들 수 없다.
 */

export interface Range {
  startAt: Date;
  endAt: Date;
}

/** 쓰는 좌석: 번호가 최대 인원 이하 (그보다 큰 번호는 최대 인원을 줄여 쓰지 않게 된 좌석) */
export function activeSeatsWhere(studyRoomId: number, maxPersonnel: number) {
  return { studyRoomId, number: { lte: maxPersonnel } } satisfies Prisma.SeatWhereInput;
}

/** 구간과 겹치는 유효 신청 조건 */
export function overlappingVisitsWhere(range: Range, excludeVisitId?: number) {
  return {
    status: 'APPLIED' as const,
    startAt: { lt: range.endAt },
    endAt: { gt: range.startAt },
    ...(excludeVisitId !== undefined && { id: { not: excludeVisitId } }),
  } satisfies Prisma.VisitWhereInput;
}

/** 구간 내내 비어 있는 좌석 (쓰는 좌석 중에서, 번호 순) */
export async function findFreeSeats(
  tx: Prisma.TransactionClient,
  room: { id: number; maxPersonnel: number },
  range: Range,
  excludeVisitId?: number,
): Promise<Seat[]> {
  return tx.seat.findMany({
    where: {
      ...activeSeatsWhere(room.id, room.maxPersonnel),
      visits: { none: overlappingVisitsWhere(range, excludeVisitId) },
    },
    orderBy: { number: 'asc' },
  });
}

/**
 * 신청·시간 수정에 쓸 좌석을 정한다.
 * - `seatId`가 있으면 그 자습실의 쓰는 좌석인지, 구간 내내 비어 있는지 확인한다.
 * - 없으면 구간 내내 비어 있는 가장 작은 번호 좌석을 고른다 (없으면 정원 마감).
 */
export async function pickSeat(
  tx: Prisma.TransactionClient,
  room: { id: number; maxPersonnel: number },
  range: Range,
  seatId: number | undefined,
  excludeVisitId?: number,
): Promise<Seat> {
  if (seatId === undefined) {
    const [free] = await findFreeSeats(tx, room, range, excludeVisitId);
    if (!free) {
      throw new DomainException(
        ErrorCode.CAPACITY_FULL,
        '그 시간 내내 비어 있는 좌석이 없습니다.',
        HttpStatus.CONFLICT,
      );
    }
    return free;
  }

  const seat = await tx.seat.findFirst({
    where: { id: seatId, ...activeSeatsWhere(room.id, room.maxPersonnel) },
  });
  if (!seat) {
    throw new DomainException(
      ErrorCode.SEAT_NOT_FOUND,
      '이 자습실의 좌석이 아닙니다.',
      HttpStatus.NOT_FOUND,
    );
  }
  const taken = await tx.visit.count({
    where: { seatId: seat.id, ...overlappingVisitsWhere(range, excludeVisitId) },
  });
  if (taken > 0) {
    throw new DomainException(
      ErrorCode.SEAT_TAKEN,
      `${seat.number}번 좌석은 그 시간에 이미 예약되어 있습니다.`,
      HttpStatus.CONFLICT,
    );
  }
  return seat;
}

/**
 * 최대 인원에 맞춰 좌석 1~maxPersonnel번이 있게 한다 (없는 번호만 만든다).
 * 줄일 때는 행을 지우지 않는다 — 큰 번호 좌석은 쓰지 않는 좌석이 된다.
 */
export async function ensureSeats(
  tx: Prisma.TransactionClient,
  studyRoomId: number,
  maxPersonnel: number,
): Promise<void> {
  await tx.seat.createMany({
    data: Array.from({ length: maxPersonnel }, (_, i) => ({ studyRoomId, number: i + 1 })),
    skipDuplicates: true,
  });
}
