/**
 * 폼 검증 규칙 — apps/web/docs/interaction-rules.md#폼-검증
 * 클라이언트 검증은 안내용이고 서버 검증이 최종 기준이다. 규칙은 BE DTO와 같게 둔다.
 */
import { combineDateTime } from './datetime';
import { isMobilePhone } from './phone';

export const ROOM_NAME_MAX = 100;
export const ROOM_CAPACITY_MAX = 1000;
export const STUDENT_NAME_MAX = 50;

export interface StudyRoomFormValues {
  name: string;
  maxPersonnel: number | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export type StudyRoomFormErrors = Partial<
  Record<'name' | 'maxPersonnel' | 'start' | 'end', string>
>;

/**
 * @param currentPersonnel 수정 시 현재 유효 신청 인원 (규칙 #7: 이보다 작게 줄일 수 없다)
 */
export function validateStudyRoomForm(
  values: StudyRoomFormValues,
  currentPersonnel = 0,
): StudyRoomFormErrors {
  const errors: StudyRoomFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = '자습실 이름을 적어 주세요';
  else if (name.length > ROOM_NAME_MAX)
    errors.name = `이름은 ${ROOM_NAME_MAX}자 이하로 적어 주세요`;

  const max = values.maxPersonnel;
  if (max === null || !Number.isInteger(max) || max < 1) {
    errors.maxPersonnel = '최대 인원은 1명 이상이어야 해요';
  } else if (max > ROOM_CAPACITY_MAX) {
    errors.maxPersonnel = `최대 인원은 ${ROOM_CAPACITY_MAX}명 이하로 정해 주세요`;
  } else if (max < currentPersonnel) {
    errors.maxPersonnel = `현재 ${currentPersonnel}명이 신청했어요. ${currentPersonnel}명 이상으로 정해 주세요`;
  }

  const start = combineDateTime(values.startDate, values.startTime);
  const end = combineDateTime(values.endDate, values.endTime);
  if (!start) errors.start = '운영 시작 일시를 골라 주세요';
  if (!end) errors.end = '운영 종료 일시를 골라 주세요';
  if (start && end && start.getTime() >= end.getTime()) {
    errors.end = '종료 일시는 시작보다 늦어야 해요';
  }
  return errors;
}

export interface StudentFormValues {
  name: string;
  phone: string;
}

export type StudentFormErrors = Partial<Record<keyof StudentFormValues, string>>;

export function validateStudentForm(values: StudentFormValues): StudentFormErrors {
  const errors: StudentFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = '학생 이름을 적어 주세요';
  else if (name.length > STUDENT_NAME_MAX)
    errors.name = `이름은 ${STUDENT_NAME_MAX}자 이하로 적어 주세요`;
  if (!values.phone.trim()) errors.phone = '전화번호를 적어 주세요';
  else if (!isMobilePhone(values.phone))
    errors.phone = '휴대폰 번호를 적어 주세요 (예: 010-1234-5678)';
  return errors;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;
