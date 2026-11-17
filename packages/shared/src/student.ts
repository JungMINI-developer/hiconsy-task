import type { IsoDateString } from './study-room.js';

export interface Student {
  id: number;
  name: string;
  /** 010-1234-5678 형태로 정규화된 휴대폰 번호 */
  phone: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateStudentRequest {
  name: string;
  /** 하이픈·공백 유무와 관계없이 휴대폰 번호면 허용 (예: 01012345678) */
  phone: string;
}

export type UpdateStudentRequest = Partial<CreateStudentRequest>;
