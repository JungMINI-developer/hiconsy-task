import type {
  ApiResponse,
  CreateStudyRoomRequest,
  StudyRoom,
  StudyRoomHistory,
  StudyRoomVisit,
  UpdateStudyRoomRequest,
} from '@hiconsy/shared';
import { apiClient, unwrap } from './client';

export const studyRoomsApi = {
  list: () => unwrap(apiClient.get<ApiResponse<StudyRoom[]>>('/study-rooms')),
  get: (id: number) => unwrap(apiClient.get<ApiResponse<StudyRoom>>(`/study-rooms/${id}`)),
  histories: (id: number) =>
    unwrap(apiClient.get<ApiResponse<StudyRoomHistory[]>>(`/study-rooms/${id}/histories`)),
  /** 현재 유효 신청 (학생 연락처 포함) */
  visits: (id: number) =>
    unwrap(apiClient.get<ApiResponse<StudyRoomVisit[]>>(`/study-rooms/${id}/visits`)),
  create: (body: CreateStudyRoomRequest) =>
    unwrap(apiClient.post<ApiResponse<StudyRoom>>('/study-rooms', body)),
  update: (id: number, body: UpdateStudyRoomRequest) =>
    unwrap(apiClient.patch<ApiResponse<StudyRoom>>(`/study-rooms/${id}`, body)),
  remove: (id: number) => apiClient.delete(`/study-rooms/${id}`).then(() => undefined),
};
