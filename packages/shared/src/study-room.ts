/**
 * 날짜는 API 경계에서 ISO 8601 문자열로 주고받는다.
 * - 응답: 항상 KST 오프셋 (예: 2026-11-15T19:00:00.000+09:00)
 * - 요청: 오프셋이 있는 어떤 ISO 문자열이든 허용 (예: ...+09:00, ...Z)
 */
export type IsoDateString = string;

export type VisitStatus = 'APPLIED' | 'CANCELED';

/** 자습실 하나의 최대 좌석 수 (= 최대 인원 상한, #45) */
export const ROOM_CAPACITY_MAX = 30;
/** 좌석 배치도 한 줄의 좌석 수. 좌석 n번은 (n-1)/5 번째 줄, (n-1)%5 번째 칸 */
export const SEATS_PER_ROW = 5;

/** 좌석 참조 (신청·이력에 붙는 좌석) */
export interface SeatRef {
  id: number;
  /** 자습실 안의 좌석 번호 (1부터) */
  number: number;
}
export type VisitAction = 'APPLY' | 'UPDATE' | 'CANCEL';
export type ActorType = 'STUDENT' | 'INSTRUCTOR' | 'SYSTEM';

/** 자습실 (목록·상세 공통) */
export interface StudyRoom {
  id: number;
  name: string;
  /** 최대 인원 = 좌석 수 */
  maxPersonnel: number;
  /** 현재 유효 신청(APPLIED) 건수. 좌석을 시간별로 나눠 쓰므로 최대 인원보다 많을 수 있다 */
  currentPersonnel: number;
  /**
   * 지금 시각이 방문 구간 안에 있는 유효 신청 수 = 지금 이용 중인 좌석 수 (예약 기준, #49).
   * 운영 시간이 아니면 null
   */
  occupiedSeats: number | null;
  /** 남은 운영 시간에 30분 이상 비는 좌석이 하나라도 있는지. false면 학생 신청을 막는다 */
  hasFreeSlot: boolean;
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
  /** 이벤트 이전 좌석 (APPLY이거나 좌석 도입 전 이력이면 null) */
  prevSeat: SeatRef | null;
  /** 이벤트 이후 좌석 (좌석 도입 전 이력이면 null) */
  seat: SeatRef | null;
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
  seat: SeatRef | null;
  /** 가장 최근 신청 시각 (취소 후 재신청했다면 재신청 시각) */
  appliedAt: IsoDateString;
}

/** 좌석 1개의 예약 가능 여부 — 학생이 고른 시간 내내 비어 있는지 (`GET /study-rooms/:id/seats`) */
export interface SeatAvailability extends SeatRef {
  available: boolean;
}

/** 강사용 좌석 배치도의 좌석 1개 — 그 시각에 앉아 있기로 한 신청 (`GET /study-rooms/:id/seat-map`) */
export interface SeatOccupancy extends SeatRef {
  visit: {
    id: number;
    student: { id: number; name: string; phone: string };
    startAt: IsoDateString;
    endAt: IsoDateString;
  } | null;
}

/** 자습실별로 고른 시간 내내 비어 있는 좌석 수 (`GET /study-rooms/free-seats`, 정원 마감 안내용) */
export interface RoomFreeSeats {
  studyRoomId: number;
  freeSeats: number;
}
