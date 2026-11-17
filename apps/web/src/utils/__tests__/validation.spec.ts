import { describe, expect, it } from 'vitest';
import {
  removedSeatsText,
  validateStudentForm,
  validateStudyRoomForm,
  type StudyRoomFormValues,
} from '../validation';

const room: StudyRoomFormValues = {
  name: '3층 A 자습실',
  maxPersonnel: 10,
  startDate: '2026-11-20',
  startTime: '18:00',
  endDate: '2026-11-20',
  endTime: '22:00',
};

describe('validateStudyRoomForm', () => {
  it('올바른 값이면 에러가 없다', () => {
    expect(validateStudyRoomForm(room)).toEqual({});
  });

  it('이름은 공백만 있으면 안 된다', () => {
    expect(validateStudyRoomForm({ ...room, name: '   ' }).name).toBe('자습실 이름을 적어 주세요');
  });

  it('최대 인원은 1 이상 정수', () => {
    expect(validateStudyRoomForm({ ...room, maxPersonnel: 0 }).maxPersonnel).toBeDefined();
    expect(validateStudyRoomForm({ ...room, maxPersonnel: null }).maxPersonnel).toBeDefined();
  });

  it('최대 인원은 30석 이하 (좌석 배치도 6줄)', () => {
    expect(validateStudyRoomForm({ ...room, maxPersonnel: 30 }).maxPersonnel).toBeUndefined();
    expect(validateStudyRoomForm({ ...room, maxPersonnel: 31 }).maxPersonnel).toBe(
      '최대 인원은 30석 이하로 정해 주세요',
    );
  });

  it('종료는 시작보다 늦어야 한다 (같은 시각 불가)', () => {
    expect(validateStudyRoomForm({ ...room, endTime: '18:00' }).end).toBe(
      '종료 일시는 시작보다 늦어야 해요',
    );
    expect(
      validateStudyRoomForm({ ...room, endDate: '2026-11-21', endTime: '02:00' }).end,
    ).toBeUndefined();
  });

  it('날짜가 비면 에러', () => {
    expect(validateStudyRoomForm({ ...room, startDate: '' }).start).toBeDefined();
  });
});

describe('validateStudentForm', () => {
  it('이름과 휴대폰 번호를 검사한다', () => {
    expect(validateStudentForm({ name: '김하늘', phone: '01012345678' })).toEqual({});
    expect(validateStudentForm({ name: '', phone: '02-123-4567' })).toEqual({
      name: '학생 이름을 적어 주세요',
      phone: '휴대폰 번호를 적어 주세요 (예: 010-1234-5678)',
    });
  });
});

describe('removedSeatsText', () => {
  it('줄이지 않으면 null', () => {
    expect(removedSeatsText(10, 10)).toBeNull();
    expect(removedSeatsText(10, 12)).toBeNull();
    expect(removedSeatsText(10, null)).toBeNull();
    expect(removedSeatsText(10, 0)).toBeNull();
  });

  it('2석 이하는 하나씩, 3석 이상은 범위로', () => {
    expect(removedSeatsText(10, 9)).toBe('10번 좌석이 없어져요');
    expect(removedSeatsText(10, 8)).toBe('9번, 10번 좌석이 없어져요');
    expect(removedSeatsText(12, 8)).toBe('9번~12번 좌석이 없어져요');
  });
});
