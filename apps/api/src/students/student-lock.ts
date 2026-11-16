import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import { Prisma } from '../generated/prisma/client.js';

/**
 * 학생 행 락 모드.
 * - `share` (FOR SHARE): 방문 취소. 학생 삭제와 직렬화된다.
 * - `noKeyUpdate` (FOR NO KEY UPDATE): 방문 신청·시간 수정. 같은 학생의 신청끼리도 직렬화해
 *   "시간 겹침 검사 → 저장" 사이에 다른 자습실 신청이 끼어들지 못하게 한다.
 *   FK 검사가 거는 FOR KEY SHARE와는 충돌하지 않으므로, 자습실 삭제가 자습실 락을 잡은 채
 *   이 학생의 이력 행을 넣어도 교착 상태가 생기지 않는다 (FOR UPDATE였다면 생긴다).
 * - `update` (FOR UPDATE): 학생 삭제.
 */
export type StudentLockMode = 'share' | 'noKeyUpdate' | 'update';

const LOCK_CLAUSE: Record<StudentLockMode, Prisma.Sql> = {
  share: Prisma.raw('FOR SHARE'),
  noKeyUpdate: Prisma.raw('FOR NO KEY UPDATE'),
  update: Prisma.raw('FOR UPDATE'),
};

/**
 * 트랜잭션 안에서 삭제되지 않은 학생 행에 락을 건다.
 * 어떤 모드든 학생 삭제(`update`)와 직렬화되어 "삭제된 학생의 유효 신청"이 생기지 않는다.
 */
export async function lockStudent(
  tx: Prisma.TransactionClient,
  id: number,
  mode: StudentLockMode,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM students WHERE id = ${id} AND deleted_at IS NULL ${LOCK_CLAUSE[mode]}
  `;
  if (rows.length === 0) throw studentNotFound();
}

export function studentNotFound(): DomainException {
  return new DomainException(
    ErrorCode.STUDENT_NOT_FOUND,
    '학생을 찾을 수 없습니다.',
    HttpStatus.NOT_FOUND,
  );
}
