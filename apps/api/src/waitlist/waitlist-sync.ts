import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { lockStudyRoom } from '../study-rooms/study-room-lock.js';

/** 자리 제안 유효 시간 (#36). 단, 원하는 방문 시작 전까지 */
export const OFFER_TTL_MS = 10 * 60 * 1000;

/** 대기 종료 사유 (학생·강사 화면에 그대로 보인다) */
export const WaitlistReason = {
  OFFER_EXPIRED: '제안 만료',
  VISIT_STARTED: '방문 시간이 지남',
  DECLINED: '제안 거절',
  CANCELED_BY_STUDENT: '본인 취소',
  CONFIRMED: '대기 확정',
  STUDY_ROOM_DELETED: '자습실 삭제',
  STUDENT_DELETED: '학생 삭제',
  PERIOD_CHANGED: '운영 기간 변경',
} as const;

/**
 * 자습실의 대기열을 현재 정원에 맞춘다. **자습실 행 락을 잡은 트랜잭션 안에서만** 호출한다.
 *
 * 1. 만료: 제안 유효 시간이 지났거나 원하는 방문 시작이 지난 대기를 끝낸다 (EXPIRED)
 * 2. 정원 축소: 유효 신청 + 제안이 정원을 넘으면, 늦게 등록한 제안부터 대기(WAITING)로 되돌린다 (순번 유지)
 * 3. 빈자리 제안: 정원 − 유효 신청 − 제안만큼, 등록 순으로 WAITING → OFFERED
 *
 * 대기 행의 상태만 바꾸고 다른 학생의 행 락은 잡지 않으므로, 학생 → 자습실 락 순서가 유지된다.
 * (FK 컬럼이 바뀌지 않는 UPDATE는 학생 행에 FOR KEY SHARE를 걸지 않는다)
 *
 * 정원이 1자리씩 줄 서서 처리되는 근거는 자습실 락이고, 제안 생성 시점은 "누군가 이 자습실을 건드릴 때"다.
 * 알림이 없어 학생은 앱을 열어야 제안을 보므로, 내 대기 조회 때도 이 함수를 실행한다 (syncWaitlistNow).
 */
export async function syncWaitlist(
  tx: Prisma.TransactionClient,
  room: { id: number; maxPersonnel: number },
  now: Date = new Date(),
): Promise<void> {
  await tx.waitlistEntry.updateMany({
    where: { studyRoomId: room.id, status: 'OFFERED', offerExpiresAt: { lte: now } },
    data: { status: 'EXPIRED', endedAt: now, endReason: WaitlistReason.OFFER_EXPIRED },
  });
  await tx.waitlistEntry.updateMany({
    where: { studyRoomId: room.id, endedAt: null, startAt: { lte: now } },
    data: { status: 'EXPIRED', endedAt: now, endReason: WaitlistReason.VISIT_STARTED },
  });

  const applied = await tx.visit.count({ where: { studyRoomId: room.id, status: 'APPLIED' } });
  const offers = await tx.waitlistEntry.findMany({
    where: { studyRoomId: room.id, status: 'OFFERED' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });

  const over = applied + offers.length - room.maxPersonnel;
  if (over > 0) {
    await tx.waitlistEntry.updateMany({
      where: { id: { in: offers.slice(0, over).map((o) => o.id) } },
      data: { status: 'WAITING', offeredAt: null, offerExpiresAt: null },
    });
    return;
  }

  const free = -over;
  if (free === 0) return;
  const next = await tx.waitlistEntry.findMany({
    where: { studyRoomId: room.id, status: 'WAITING' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: free,
  });
  for (const entry of next) {
    const expiresAt = Math.min(now.getTime() + OFFER_TTL_MS, entry.startAt.getTime());
    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'OFFERED', offeredAt: now, offerExpiresAt: new Date(expiresAt) },
    });
  }
}

/**
 * 자습실 락을 잡고 대기열을 맞춘 뒤 **바로 커밋**한다.
 *
 * 신청·대기 등록처럼 맞춘 뒤 거절(409)될 수 있는 작업은 본 트랜잭션보다 먼저 이것을 실행한다.
 * 같은 트랜잭션에서 맞추고 거절하면 롤백으로 방금 만든 제안까지 사라지기 때문이다.
 * 삭제된·없는 자습실이면 아무것도 하지 않는다.
 */
export async function syncWaitlistNow(
  prisma: PrismaClient,
  studyRoomId: number,
  now: Date = new Date(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    try {
      await lockStudyRoom(tx, studyRoomId);
    } catch {
      return;
    }
    const room = await tx.studyRoom.findUniqueOrThrow({ where: { id: studyRoomId } });
    await syncWaitlist(tx, room, now);
  });
}

/**
 * 조건에 맞는 진행 중 대기를 모두 끝낸다 (CANCELED + 사유).
 * 자습실·학생 삭제, 운영 기간 변경처럼 대기자가 아닌 쪽의 변경으로 대기가 무의미해질 때 쓴다.
 * 자리를 잡아 두던 제안이 풀리므로, 호출한 쪽에서 이어서 syncWaitlist를 실행한다.
 */
export async function cancelActiveWaitlist(
  tx: Prisma.TransactionClient,
  where: Prisma.WaitlistEntryWhereInput,
  reason: string,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await tx.waitlistEntry.updateMany({
    where: { ...where, endedAt: null },
    data: { status: 'CANCELED', endedAt: now, endReason: reason },
  });
  return count;
}

export interface WaitlistCounts {
  /** 만료되지 않은 제안 */
  offered: number;
  /** 방문 시작 전인 대기 */
  waiting: number;
}

/**
 * 자습실별 제안·대기 인원 (조회용, 락 없음).
 * 아직 동기화되지 않은 만료 제안·지난 대기는 빼고 센다.
 */
export async function countWaitlist(
  client: Prisma.TransactionClient | PrismaClient,
  studyRoomIds: number[],
  now: Date = new Date(),
): Promise<Map<number, WaitlistCounts>> {
  const result = new Map<number, WaitlistCounts>(
    studyRoomIds.map((id) => [id, { offered: 0, waiting: 0 }]),
  );
  if (studyRoomIds.length === 0) return result;
  const groups = await client.waitlistEntry.groupBy({
    by: ['studyRoomId', 'status'],
    where: {
      studyRoomId: { in: studyRoomIds },
      startAt: { gt: now },
      OR: [{ status: 'WAITING' }, { status: 'OFFERED', offerExpiresAt: { gt: now } }],
    },
    _count: { _all: true },
  });
  for (const g of groups) {
    const counts = result.get(g.studyRoomId)!;
    if (g.status === 'OFFERED') counts.offered = g._count._all;
    else counts.waiting = g._count._all;
  }
  return result;
}

/** 새로 신청할 수 있는 자리 = 최대 인원 − 유효 신청 − 제안 − 대기 (대기자 우선) */
export function availableSeats(maxPersonnel: number, applied: number, counts: WaitlistCounts) {
  return Math.max(maxPersonnel - applied - counts.offered - counts.waiting, 0);
}
