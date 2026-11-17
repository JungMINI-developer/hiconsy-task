/**
 * 폼 검증 규칙 — apps/web/docs/interaction-rules.md#폼-검증
 * 클라이언트 검증은 안내용이고 서버 검증이 최종 기준이다. 규칙은 BE DTO와 같게 둔다.
 */
import { ROOM_CAPACITY_MAX } from '@hiconsy/shared';
import { combineDateTime } from './datetime';
import { isMobilePhone } from './phone';

export { ROOM_CAPACITY_MAX };
export const ROOM_NAME_MAX = 100;
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
 * 좌석을 줄여도 되는지는 서버만 안다(없어질 좌석에 끝나지 않은 예약이 있는지, `SEATS_IN_USE`).
 * 예약은 시간별로 좌석을 나눠 쓰므로 예약 건수로는 판단할 수 없다 (#51).
 */
export function validateStudyRoomForm(values: StudyRoomFormValues): StudyRoomFormErrors {
  const errors: StudyRoomFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = '자습실 이름을 적어 주세요';
  else if (name.length > ROOM_NAME_MAX)
    errors.name = `이름은 ${ROOM_NAME_MAX}자 이하로 적어 주세요`;

  const max = values.maxPersonnel;
  if (max === null || !Number.isInteger(max) || max < 1) {
    errors.maxPersonnel = '최대 인원은 1석 이상이어야 해요';
  } else if (max > ROOM_CAPACITY_MAX) {
    errors.maxPersonnel = `최대 인원은 ${ROOM_CAPACITY_MAX}석 이하로 정해 주세요`;
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

/**
 * 좌석 수를 줄일 때 없어질 좌석 안내 (S-12). 줄이지 않으면 null.
 * 2석 이하면 "9번, 10번 좌석", 3석 이상이면 "9번~12번 좌석".
 */
export function removedSeatsText(current: number, next: number | null): string | null {
  if (next === null || !Number.isInteger(next) || next < 1 || next >= current) return null;
  const first = next + 1;
  const seats = current - first >= 2 ? `${first}번~${current}번` : range(first, current).join(', ');
  return `${seats} 좌석이 없어져요`;
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => `${from + i}번`);
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;
