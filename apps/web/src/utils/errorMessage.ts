import { ErrorCode } from '@hiconsy/shared';
import { AppError, NETWORK_ERROR } from '@/api/client';

/**
 * 에러 코드 → 화면 문구 (apps/web/docs/ux-writing.md#에러-메시지).
 * 맥락이 필요한 문구(정원 축소 인원, 운영 기간)는 화면에서 직접 만든다.
 */
const MESSAGES: Record<string, string> = {
  [ErrorCode.STUDY_ROOM_NOT_FOUND]: '삭제된 자습실이에요',
  [ErrorCode.INVALID_PERIOD]: '종료 일시는 시작보다 늦어야 해요',
  [ErrorCode.PERIOD_EXCLUDES_VISITS]:
    '새 운영 기간 밖에 있는 신청이 있어요. 학생과 시간을 먼저 조율해 주세요',
  [ErrorCode.STUDENT_NOT_FOUND]: '삭제된 학생이에요',
  [ErrorCode.DUPLICATE_PHONE]: '이미 등록된 전화번호예요',
  [ErrorCode.VISIT_NOT_FOUND]: '신청을 찾을 수 없어요',
  [ErrorCode.VISIT_IN_PAST]: '지금 이후의 시간을 골라 주세요',
  [ErrorCode.VISIT_OUT_OF_PERIOD]: '운영 기간 안에서 골라 주세요',
  [ErrorCode.ALREADY_APPLIED]:
    '이미 신청한 자습실이에요. 시간을 바꾸려면 내 신청에서 변경해 주세요',
  [ErrorCode.VISIT_TIME_OVERLAP]:
    '같은 시간에 신청한 다른 자습실이 있어요. 겹치지 않는 시간을 골라 주세요',
  [ErrorCode.CAPACITY_FULL]: '그 시간 내내 비어 있는 좌석이 없어요',
  [ErrorCode.SEAT_TAKEN]: '방금 다른 학생이 그 좌석을 예약했어요. 다른 좌석을 골라 주세요',
  [ErrorCode.SEAT_NOT_FOUND]: '이 좌석은 지금 쓸 수 없어요. 다른 좌석을 골라 주세요',
  [ErrorCode.SEATS_IN_USE]: '없어질 좌석에 예약이 있어 줄일 수 없어요',
  [ErrorCode.VISIT_ALREADY_CANCELED]: '이미 취소한 신청이에요',
  [ErrorCode.VISIT_ALREADY_STARTED]: '이미 시작한 방문은 바꾸거나 취소할 수 없어요',
  [ErrorCode.VISIT_NOT_STARTED]: '아직 시작하지 않은 방문이에요. 퇴실 대신 취소해 주세요',
  [ErrorCode.VISIT_ALREADY_ENDED]: '이미 끝난 방문이에요',
  [NETWORK_ERROR]: '연결이 불안정해요. 잠시 후 다시 시도해 주세요',
};

const FALLBACK = '문제가 생겼어요. 잠시 후 다시 시도해 주세요';

export function errorMessage(error: unknown): string {
  if (error instanceof AppError) {
    const known = MESSAGES[error.code];
    if (known) return known;
    if (error.code === 'BAD_REQUEST' && error.details[0]) return error.details[0];
    if (error.status !== null && error.status >= 500) return MESSAGES[NETWORK_ERROR]!;
  }
  return FALLBACK;
}
