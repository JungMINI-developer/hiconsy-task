import type { ActorType, Prisma, Visit } from '../generated/prisma/client.js';

export const CancelReason = {
  STUDY_ROOM_DELETED: '자습실 삭제',
  STUDENT_DELETED: '학생 삭제',
} as const;

/**
 * CANCEL 이력 1행. 취소는 시간·좌석을 바꾸지 않으므로 이전·이후 값이 같다.
 * 학생 본인 취소와 시스템 일괄 취소가 같은 모양을 쓰도록 한 곳에 둔다 (#12 → #57).
 */
export function cancelHistoryData(
  visit: Pick<Visit, 'id' | 'studyRoomId' | 'studentId' | 'startAt' | 'endAt' | 'seatId'>,
  actorType: ActorType,
  reason: string | null = null,
): Prisma.VisitHistoryCreateManyInput {
  return {
    visitId: visit.id,
    studyRoomId: visit.studyRoomId,
    studentId: visit.studentId,
    action: 'CANCEL',
    prevStartAt: visit.startAt,
    prevEndAt: visit.endAt,
    startAt: visit.startAt,
    endAt: visit.endAt,
    prevSeatId: visit.seatId,
    seatId: visit.seatId,
    actorType,
    reason,
  };
}

/**
 * 조건에 맞는 **끝나지 않은** 유효 신청(APPLIED, `end_at > now`)을 모두 시스템 취소하고 CANCEL 이력을 남긴다.
 * 자습실·학생 삭제처럼 신청 당사자가 아닌 쪽의 변경으로 신청이 무효가 될 때 사용한다.
 *
 * 이미 끝난 방문은 건드리지 않는다 — 지나간 사실을 바꾸지 않는다(규칙 #6·#12), 좌석 축소(#7)와 같은 기준 (#57).
 * 진행 중인 방문은 취소한다(자습실이 없어지면 남은 시간을 쓸 수 없다).
 * 반드시 호출하는 쪽 트랜잭션 안에서 실행한다.
 */
export async function cancelAppliedVisitsBySystem(
  tx: Prisma.TransactionClient,
  where: { studyRoomId: number } | { studentId: number },
  reason: string,
  now: Date = new Date(),
): Promise<number> {
  const unfinished = await tx.visit.findMany({
    where: { ...where, status: 'APPLIED', endAt: { gt: now } },
  });
  if (unfinished.length === 0) return 0;

  await tx.visit.updateMany({
    where: { id: { in: unfinished.map((visit) => visit.id) } },
    data: { status: 'CANCELED', canceledAt: now },
  });
  await tx.visitHistory.createMany({
    data: unfinished.map((visit) => cancelHistoryData(visit, 'SYSTEM', reason)),
  });
  return unfinished.length;
}
