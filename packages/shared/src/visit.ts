import type { IsoDateString, SeatRef, VisitStatus } from './study-room.js';

/** 학생의 방문 신청 (내 신청 목록 등) */
export interface Visit {
  id: number;
  studentId: number;
  studyRoom: {
    id: number;
    name: string;
    startDate: IsoDateString;
    endDate: IsoDateString;
    /** 자습실이 삭제됐는지 (삭제 시 신청은 자동 취소됨) */
    deleted: boolean;
  };
  startAt: IsoDateString;
  endAt: IsoDateString;
  /** 앉을 좌석. 취소해도 남는다 (재신청 때 기본 선택). 좌석 도입 전에 취소된 신청은 null */
  seat: SeatRef | null;
  status: VisitStatus;
  canceledAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateVisitRequest {
  studyRoomId: number;
  startAt: IsoDateString;
  endAt: IsoDateString;
  /** 앉을 좌석. 없으면 그 시간 내내 비어 있는 가장 작은 번호 좌석을 서버가 고른다 */
  seatId?: number;
}

export interface UpdateVisitRequest {
  startAt: IsoDateString;
  endAt: IsoDateString;
  /** 바꿀 좌석. 없으면 지금 좌석을 유지한다 */
  seatId?: number;
}
