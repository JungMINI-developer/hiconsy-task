/** FE/BE 공통 API 응답 포맷 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    /** HTTP 상태 기반 에러 코드 (예: NOT_FOUND, BAD_REQUEST) */
    code: string;
    message: string;
    /** 검증 실패 시 필드별 상세 메시지 */
    details?: string[];
  };
}

export type ApiResponse<T> = ApiSuccess<T>;
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export interface HealthStatus {
  status: 'ok';
  database: 'up' | 'down';
  timestamp: string;
}
