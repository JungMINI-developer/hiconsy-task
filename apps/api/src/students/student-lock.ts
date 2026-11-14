import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * 트랜잭션 안에서 삭제되지 않은 학생 행에 락을 건다.
 * - `share`: 방문 신청·수정·취소. 같은 학생의 다른 신청 작업과는 동시에 진행되지만,
 *   학생 삭제(`update`)와는 직렬화되어 "삭제된 학생의 유효 신청"이 생기지 않는다.
 * - `update`: 학생 삭제.
 */
export async function lockStudent(
  tx: Prisma.TransactionClient,
  id: number,
  mode: 'share' | 'update',
): Promise<void> {
  const rows =
    mode === 'share'
      ? await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM students WHERE id = ${id} AND deleted_at IS NULL FOR SHARE
        `
      : await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM students WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE
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
