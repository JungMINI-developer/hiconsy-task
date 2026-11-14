import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@hiconsy/shared';

/**
 * 도메인 규칙 위반 예외. error.code에 HTTP 상태명 대신 도메인 에러 코드를 담는다.
 * FE는 code로 분기하고 message는 그대로 사용자에게 보여줄 수 있다.
 */
export class DomainException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
  ) {
    super({ code, message }, status);
  }
}
