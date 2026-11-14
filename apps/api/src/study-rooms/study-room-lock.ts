import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * 트랜잭션 안에서 자습실 행에 배타 락(SELECT ... FOR UPDATE)을 건다.
 *
 * 같은 자습실에 대한 방문 신청·재신청·시간 수정과 자습실 수정·삭제가 이 락으로 직렬화되어,
 * "인원 세기 → 저장" 사이에 다른 트랜잭션이 끼어드는 경쟁 상태(정원 초과 등)를 막는다.
 * 락 범위는 자습실 1행이므로 다른 자습실 작업은 기다리지 않는다.
 */
export async function lockStudyRoom(tx: Prisma.TransactionClient, id: number): Promise<void> {
  const rows = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM study_rooms WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE
  `;
  if (rows.length === 0) throw studyRoomNotFound();
}

export function studyRoomNotFound(): DomainException {
  return new DomainException(
    ErrorCode.STUDY_ROOM_NOT_FOUND,
    '자습실을 찾을 수 없습니다.',
    HttpStatus.NOT_FOUND,
  );
}
