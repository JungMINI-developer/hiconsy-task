import { describe, expect, it } from 'vitest';
import { seatUsageText } from '../roomSeats';

describe('seatUsageText', () => {
  it('운영 중이면 지금 이용 중인 좌석 수를 붙인다', () => {
    expect(seatUsageText({ maxPersonnel: 10, occupiedSeats: 6 })).toBe(
      '좌석 10석 · 지금 6석 이용 중',
    );
    expect(seatUsageText({ maxPersonnel: 10, occupiedSeats: 0 })).toBe(
      '좌석 10석 · 지금 0석 이용 중',
    );
  });

  it('운영 시간이 아니면 좌석 수만', () => {
    expect(seatUsageText({ maxPersonnel: 10, occupiedSeats: null })).toBe('좌석 10석');
  });
});
