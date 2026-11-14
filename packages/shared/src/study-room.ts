/** 날짜는 API 경계에서 ISO 8601 문자열로 주고받는다 */
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
