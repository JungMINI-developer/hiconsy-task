import axios from 'axios';
import type { ApiResponse, HealthStatus } from '@hiconsy/shared';

/** dev 환경에서는 Vite proxy(/api → localhost:3000)를 통해 BE로 전달된다 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
});

export async function fetchHealth(): Promise<HealthStatus> {
  const { data } = await apiClient.get<ApiResponse<HealthStatus>>('/health');
  return data.data;
}
