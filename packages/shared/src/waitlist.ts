import type { IsoDateString } from './study-room.js';

/**
 * 대기열 항목 상태 (#36).
 * - WAITING: 순번 대기 / OFFERED: 자리 제안 중 (진행 중)
 * - CONFIRMED: 확정해 방문 신청됨 / DECLINED: 거절 / EXPIRED: 제안 만료·방문 시작 지남 / CANCELED: 취소·자동 취소 (종료)
 */
export type WaitlistStatus =
  'WAITING' | 'OFFERED' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED' | 'CANCELED';

/** 학생의 대기 1건 (내 신청 > 대기) */
export interface WaitlistEntry {
  id: number;
  studentId: number;
  studyRoom: {
    id: number;
    name: string;
    startDate: IsoDateString;
    endDate: IsoDateString;
    deleted: boolean;
  };
  /** 원하는 방문 구간 (확정할 때 바꿀 수 있다) */
  startAt: IsoDateString;
  endAt: IsoDateString;
  status: WaitlistStatus;
  /** WAITING일 때 내 앞에 있는 사람 수 + 1 (1 = 다음 차례). 그 외 null */
  position: number | null;
  offeredAt: IsoDateString | null;
  /** OFFERED일 때 이 시각까지 확정해야 한다 */
  offerExpiresAt: IsoDateString | null;
  endedAt: IsoDateString | null;
  /** 종료 사유 (예: 제안 만료, 자습실 삭제) */
  endReason: string | null;
  createdAt: IsoDateString;
}

export interface CreateWaitlistRequest {
  studyRoomId: number;
  startAt: IsoDateString;
  endAt: IsoDateString;
}

/** 자습실의 진행 중인 대기 1건 — 강사 화면 [대기] 탭 */
export interface StudyRoomWaitlistEntry {
  id: number;
  student: { id: number; name: string; phone: string };
  startAt: IsoDateString;
  endAt: IsoDateString;
  status: Extract<WaitlistStatus, 'WAITING' | 'OFFERED'>;
  /** WAITING 순번 (1부터). OFFERED면 null */
  position: number | null;
  offerExpiresAt: IsoDateString | null;
  createdAt: IsoDateString;
}
