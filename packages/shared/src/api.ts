/** FE/BE 공통 API 응답 포맷 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T>;
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export interface HealthStatus {
  status: 'ok';
  database: 'up' | 'down';
  timestamp: string;
}
