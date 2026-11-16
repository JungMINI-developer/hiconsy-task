import type {
  ApiResponse,
  CreateWaitlistRequest,
  StudyRoomWaitlistEntry,
  WaitlistEntry,
} from '@hiconsy/shared';
import { apiClient, unwrap } from './client';

/** 대기열 (#36). 자리 제안 확정은 방문 신청(visitsApi.apply)으로 한다 */
const base = (studentId: number) => `/students/${studentId}/waitlist`;

export const waitlistApi = {
  list: (studentId: number) => unwrap(apiClient.get<ApiResponse<WaitlistEntry[]>>(base(studentId))),
  register: (studentId: number, body: CreateWaitlistRequest) =>
    unwrap(apiClient.post<ApiResponse<WaitlistEntry>>(base(studentId), body)),
  /** 대기 취소 / 자리 제안 거절 */
  cancel: (studentId: number, entryId: number) =>
    unwrap(apiClient.post<ApiResponse<WaitlistEntry>>(`${base(studentId)}/${entryId}/cancel`)),
  /** 강사: 자습실의 진행 중 대기 */
  byRoom: (studyRoomId: number) =>
    unwrap(
      apiClient.get<ApiResponse<StudyRoomWaitlistEntry[]>>(`/study-rooms/${studyRoomId}/waitlist`),
    ),
};
