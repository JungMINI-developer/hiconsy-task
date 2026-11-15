import type {
  ApiResponse,
  CreateStudentRequest,
  Student,
  UpdateStudentRequest,
} from '@hiconsy/shared';
import { apiClient, unwrap } from './client';

export const studentsApi = {
  list: () => unwrap(apiClient.get<ApiResponse<Student[]>>('/students')),
  get: (id: number) => unwrap(apiClient.get<ApiResponse<Student>>(`/students/${id}`)),
  create: (body: CreateStudentRequest) =>
    unwrap(apiClient.post<ApiResponse<Student>>('/students', body)),
  update: (id: number, body: UpdateStudentRequest) =>
    unwrap(apiClient.patch<ApiResponse<Student>>(`/students/${id}`, body)),
  remove: (id: number) => apiClient.delete(`/students/${id}`).then(() => undefined),
};
