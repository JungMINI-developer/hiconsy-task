/**
 * 날짜는 API 경계에서 ISO 8601 문자열로 주고받는다.
 * - 응답: 항상 KST 오프셋 (예: 2026-11-15T19:00:00.000+09:00)
 * - 요청: 오프셋이 있는 어떤 ISO 문자열이든 허용 (예: ...+09:00, ...Z)
 */
export type IsoDateString = string;

export type VisitStatus = 'APPLIED' | 'CANCELED';
export type VisitAction = 'APPLY' | 'UPDATE' | 'CANCEL';
export type ActorType = 'STUDENT' | 'INSTRUCTOR' | 'SYSTEM';

/** 자습실 (목록·상세 공통) */
export interface StudyRoom {
  id: number;
  name: string;
  maxPersonnel: number;
  /** 현재 유효 신청(APPLIED) 인원 */
  currentPersonnel: number;
  /** 자리 제안 중(확정 대기)인 인원 — 정원 1자리씩 잡아 둔다 (#36) */
  offeredCount: number;
  /** 순번을 기다리는 대기 인원 */
  waitingCount: number;
  /**
   * 새로 신청할 수 있는 자리 = 최대 인원 − 유효 신청 − 제안 중 − 대기 (0 이상).
   * 대기자가 있으면 빈자리는 대기자에게 먼저 돌아가므로 새 신청자에게는 0이다.
   */
  availableSeats: number;
  startDate: IsoDateString;
  endDate: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateStudyRoomRequest {
  name: string;
  maxPersonnel: number;
  startDate: IsoDateString;
  endDate: IsoDateString;
}

export type UpdateStudyRoomRequest = Partial<CreateStudyRoomRequest>;

/** 자습실 상세의 방문 신청·수정·취소 이력 1건 */
export interface StudyRoomHistory {
  id: number;
  visitId: number;
  student: { id: number; name: string };
  action: VisitAction;
  prevStartAt: IsoDateString | null;
  prevEndAt: IsoDateString | null;
  startAt: IsoDateString;
  endAt: IsoDateString;
  actorType: ActorType;
  reason: string | null;
  createdAt: IsoDateString;
}

/**
 * 자습실의 현재 유효 신청(APPLIED) 1건 — 강사 화면 [신청자] 탭.
 * 동명이인을 구분할 수 있도록 학생 연락처를 함께 준다.
 */
export interface StudyRoomVisit {
  /** 방문 신청 id */
  id: number;
  student: { id: number; name: string; phone: string };
  startAt: IsoDateString;
  endAt: IsoDateString;
  /** 가장 최근 신청 시각 (취소 후 재신청했다면 재신청 시각) */
  appliedAt: IsoDateString;
}
