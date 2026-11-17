import axios, { AxiosError } from 'axios';
import type { ApiError, ApiResponse } from '@hiconsy/shared';

/** dev 환경에서는 Vite proxy(/api → localhost:3000)를 통해 BE로 전달된다 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
});

/** 네트워크 오류처럼 서버가 공통 에러 포맷으로 응답하지 않은 경우의 코드 */
export const NETWORK_ERROR = 'NETWORK_ERROR';

/**
 * 화면이 다루는 단일 에러 형태. 화면은 `code`로만 분기한다.
 * (apps/web/docs/interaction-rules.md#서버-응답-처리)
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number | null,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function isApiError(body: unknown): body is ApiError {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as ApiError).success === false &&
    typeof (body as ApiError).error?.code === 'string'
  );
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof AxiosError) {
    const body: unknown = error.response?.data;
    const status = error.response?.status ?? null;
    if (isApiError(body)) {
      return new AppError(body.error.code, body.error.message, status, body.error.details);
    }
    return new AppError(NETWORK_ERROR, error.message, status);
  }
  return new AppError(NETWORK_ERROR, error instanceof Error ? error.message : String(error), null);
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toAppError(error)),
);

/** 공통 응답 포맷 `{ success, data }`에서 data만 꺼낸다 */
export async function unwrap<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await request;
  return data.data;
}
