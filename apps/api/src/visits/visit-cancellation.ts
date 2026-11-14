import type { Prisma } from '../generated/prisma/client.js';

export const CancelReason = {
  STUDY_ROOM_DELETED: '자습실 삭제',
  STUDENT_DELETED: '학생 삭제',
} as const;

/**
 * 조건에 맞는 유효 신청(APPLIED)을 모두 시스템 취소하고 CANCEL 이력을 남긴다.
 * 자습실·학생 삭제처럼 신청 당사자가 아닌 쪽의 변경으로 신청이 무효가 될 때 사용한다.
 * 반드시 호출하는 쪽 트랜잭션 안에서 실행한다.
 */
export async function cancelAppliedVisitsBySystem(
  tx: Prisma.TransactionClient,
  where: { studyRoomId: number } | { studentId: number },
  reason: string,
  now: Date = new Date(),
): Promise<number> {
  const applied = await tx.visit.findMany({ where: { ...where, status: 'APPLIED' } });
  if (applied.length === 0) return 0;

  await tx.visit.updateMany({
    where: { id: { in: applied.map((visit) => visit.id) } },
    data: { status: 'CANCELED', canceledAt: now },
  });
  await tx.visitHistory.createMany({
    data: applied.map((visit) => ({
      visitId: visit.id,
      studyRoomId: visit.studyRoomId,
      studentId: visit.studentId,
      action: 'CANCEL' as const,
      prevStartAt: visit.startAt,
      prevEndAt: visit.endAt,
      startAt: visit.startAt,
      endAt: visit.endAt,
      actorType: 'SYSTEM' as const,
      reason,
    })),
  });
  return applied.length;
}
