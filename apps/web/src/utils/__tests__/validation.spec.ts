import { describe, expect, it } from 'vitest';
import {
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

  it('수정 시 현재 신청 인원보다 작게 줄일 수 없다 (같은 값은 허용)', () => {
    expect(validateStudyRoomForm({ ...room, maxPersonnel: 6 }, 7).maxPersonnel).toBe(
      '현재 7명이 신청했어요. 7명 이상으로 정해 주세요',
    );
    expect(validateStudyRoomForm({ ...room, maxPersonnel: 7 }, 7).maxPersonnel).toBeUndefined();
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
