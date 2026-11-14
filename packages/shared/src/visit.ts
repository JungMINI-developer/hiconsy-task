import type { IsoDateString, VisitStatus } from './study-room.js';

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
  status: VisitStatus;
  canceledAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateVisitRequest {
  studyRoomId: number;
  startAt: IsoDateString;
  endAt: IsoDateString;
}

export interface UpdateVisitRequest {
  startAt: IsoDateString;
  endAt: IsoDateString;
}
