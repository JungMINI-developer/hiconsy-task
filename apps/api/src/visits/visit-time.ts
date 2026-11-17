import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import type { StudyRoom } from '../generated/prisma/client.js';

/**
 * 방문 구간 검사: 시작 < 종료, 미래 시각, 자습실 운영 기간 안 (requirements 9절 #1·#6).
 * 방문 신청과 시간 수정이 함께 쓴다.
 */
export function assertValidVisitTime(
  startAt: Date,
  endAt: Date,
  room: Pick<StudyRoom, 'startDate' | 'endDate'>,
): void {
  if (startAt.getTime() >= endAt.getTime()) {
    throw new DomainException(
      ErrorCode.INVALID_PERIOD,
      '방문 시작 일시는 종료 일시보다 이전이어야 합니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (startAt.getTime() <= Date.now()) {
    throw new DomainException(
      ErrorCode.VISIT_IN_PAST,
      '지난 시간으로는 신청할 수 없습니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (startAt < room.startDate || endAt > room.endDate) {
    throw new DomainException(
      ErrorCode.VISIT_OUT_OF_PERIOD,
      '방문 시간은 자습실 운영 기간 안이어야 합니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
