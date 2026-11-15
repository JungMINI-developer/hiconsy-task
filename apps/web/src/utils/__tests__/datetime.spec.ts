import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRange,
  formatTimestamp,
  getRoomPhase,
  toIsoWithOffset,
} from '../datetime';

// 테스트는 TZ=Asia/Seoul 기준으로 실행된다 (vitest.config.ts)
const now = new Date('2026-11-15T12:00:00+09:00');

describe('datetime', () => {
  it('올해 날짜는 연도를 생략하고 요일을 붙인다', () => {
    expect(formatDate('2026-11-20T18:00:00+09:00', now)).toBe('11.20(금)');
    expect(formatDate('2027-01-05T18:00:00+09:00', now)).toBe('2027.01.05(화)');
  });

  it('날짜와 시간을 함께 표기한다', () => {
    expect(formatDateTime('2026-11-20T09:05:00+09:00', now)).toBe('11.20(금) 09:05');
  });

  it('같은 날 구간은 종료 날짜를 생략한다', () => {
    expect(formatRange('2026-11-20T18:00:00+09:00', '2026-11-20T22:00:00+09:00', now)).toBe(
      '11.20(금) 18:00 – 22:00',
    );
  });

  it('다른 날 구간은 양쪽 날짜를 모두 쓴다', () => {
    expect(formatRange('2026-11-20T18:00:00+09:00', '2026-11-21T02:00:00+09:00', now)).toBe(
      '11.20(금) 18:00 – 11.21(토) 02:00',
    );
  });

  it('UTC로 받은 시각도 로컬 시간대로 표기한다', () => {
    expect(formatDateTime('2026-11-20T09:00:00.000Z', now)).toBe('11.20(금) 18:00');
  });

  it('이력 타임스탬프는 1시간 이내면 상대 시간으로 쓴다', () => {
    expect(formatTimestamp('2026-11-15T11:48:00+09:00', now)).toBe('12분 전');
    expect(formatTimestamp('2026-11-15T11:59:40+09:00', now)).toBe('방금 전');
    expect(formatTimestamp('2026-11-14T14:02:00+09:00', now)).toBe('11.14 14:02');
  });

  it('로컬 오프셋이 붙은 ISO 문자열을 만든다', () => {
    expect(toIsoWithOffset(new Date('2026-11-20T18:30:00+09:00'))).toBe(
      '2026-11-20T18:30:00+09:00',
    );
  });

  it('운영 상태를 현재 시각 기준으로 계산한다', () => {
    const room = { startDate: '2026-11-15T09:00:00+09:00', endDate: '2026-11-15T12:00:00+09:00' };
    expect(getRoomPhase(room, new Date('2026-11-15T08:59:59+09:00'))).toBe('upcoming');
    expect(getRoomPhase(room, new Date('2026-11-15T09:00:00+09:00'))).toBe('open');
    expect(getRoomPhase(room, new Date('2026-11-15T12:00:00+09:00'))).toBe('ended');
  });
});
