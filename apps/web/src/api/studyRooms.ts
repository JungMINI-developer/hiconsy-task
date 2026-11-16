import type {
  ApiResponse,
  CreateStudyRoomRequest,
  IsoDateString,
  RoomFreeSeats,
  SeatAvailability,
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
  /** 좌석별로 고른 시간 내내 비어 있는지. 시간 변경이면 내 신청(exceptVisitId)은 빈 것으로 본다 */
  seats: (
    id: number,
    range: { startAt: IsoDateString; endAt: IsoDateString },
    exceptVisitId?: number,
  ) =>
    unwrap(
      apiClient.get<ApiResponse<SeatAvailability[]>>(`/study-rooms/${id}/seats`, {
        params: { ...range, ...(exceptVisitId !== undefined && { exceptVisitId }) },
      }),
    ),
  /** 운영 기간이 그 시간을 포함하는 자습실마다 그 시간 내내 비어 있는 좌석 수 (S-23) */
  freeSeats: (range: { startAt: IsoDateString; endAt: IsoDateString }) =>
    unwrap(
      apiClient.get<ApiResponse<RoomFreeSeats[]>>('/study-rooms/free-seats', { params: range }),
    ),
  remove: (id: number) => apiClient.delete(`/study-rooms/${id}`).then(() => undefined),
};
