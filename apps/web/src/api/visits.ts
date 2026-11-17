import type { ApiResponse, CreateVisitRequest, UpdateVisitRequest, Visit } from '@hiconsy/shared';
import { apiClient, unwrap } from './client';

/** 로그인 대신 경로의 학생 id를 본인으로 본다 (requirements 9절 #11) */
const base = (studentId: number) => `/students/${studentId}/visits`;

export const visitsApi = {
  list: (studentId: number) => unwrap(apiClient.get<ApiResponse<Visit[]>>(base(studentId))),
  apply: (studentId: number, body: CreateVisitRequest) =>
    unwrap(apiClient.post<ApiResponse<Visit>>(base(studentId), body)),
  updateTime: (studentId: number, visitId: number, body: UpdateVisitRequest) =>
    unwrap(apiClient.patch<ApiResponse<Visit>>(`${base(studentId)}/${visitId}`, body)),
  cancel: (studentId: number, visitId: number) =>
    unwrap(apiClient.post<ApiResponse<Visit>>(`${base(studentId)}/${visitId}/cancel`)),
  /** 조기 퇴실 — 진행 중인 방문의 종료를 지금으로 줄인다 (#66) */
  checkout: (studentId: number, visitId: number) =>
    unwrap(apiClient.post<ApiResponse<Visit>>(`${base(studentId)}/${visitId}/checkout`)),
};
