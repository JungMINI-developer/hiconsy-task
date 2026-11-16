import { describe, expect, it } from 'vitest';
import { visitChangeText } from '../visitChange';

// TZ=Asia/Seoul (vitest.config.ts)
const at = (day: number, time: string) => `2026-11-${day}T${time}:00+09:00`;
const visit = (seatNumber: number | null, start: string, end: string, day = 20) => ({
  startAt: at(day, start),
  endAt: at(day, end),
  seatNumber,
});

describe('visitChangeText', () => {
  it('좌석과 시간이 모두 바뀌면 둘 다 이전 → 이후로', () => {
    expect(visitChangeText(visit(3, '11:00', '13:00'), visit(7, '12:00', '14:00'))).toBe(
      '3번 → 7번 좌석 · 11:00 – 13:00 → 12:00 – 14:00',
    );
  });

  it('바뀐 것만 보여준다', () => {
    expect(visitChangeText(visit(3, '11:00', '13:00'), visit(7, '11:00', '13:00'))).toBe(
      '3번 → 7번 좌석',
    );
    expect(visitChangeText(visit(3, '11:00', '13:00'), visit(3, '12:00', '13:00'))).toBe(
      '11:00 – 13:00 → 12:00 – 13:00',
    );
    expect(visitChangeText(visit(3, '11:00', '13:00'), visit(3, '11:00', '13:00'))).toBe('');
  });

  it('날짜가 바뀌면 날짜를 붙인다', () => {
    const text = visitChangeText(visit(3, '11:00', '13:00', 20), visit(3, '11:00', '13:00', 21));
    expect(text).toMatch(/11\.20.* 11:00 – 13:00 → 11\.21.* 11:00 – 13:00/);
  });

  it('좌석이 없던 신청(좌석 도입 전)은 새 좌석만', () => {
    expect(visitChangeText(visit(null, '11:00', '13:00'), visit(5, '11:00', '13:00'))).toBe(
      '5번 좌석',
    );
  });
});
