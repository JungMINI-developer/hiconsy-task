import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@hiconsy/shared';

/** 모든 예외를 공통 에러 포맷(ApiError)으로 변환한다 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = '서버 내부 오류가 발생했습니다.';
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const raw = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      if (Array.isArray(raw)) {
        message = '요청 값이 올바르지 않습니다.';
        details = raw.map(String);
      } else if (typeof raw === 'string') {
        message = raw;
      } else {
        message = exception.message;
      }
    } else {
      this.logger.error(exception);
    }

    const payload: ApiError = {
      success: false,
      error: { code: HttpStatus[status] ?? 'UNKNOWN_ERROR', message, details },
    };
    response.status(status).json(payload);
  }
}
