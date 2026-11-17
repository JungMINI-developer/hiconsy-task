import { describe, expect, it } from 'vitest';
import { defaultSeatMapTime, isSeatedAt, nowSeatMapTime, seatMapTimes } from '../seatMapTime';

const period = { startDate: '2026-11-20T18:00:00+09:00', endDate: '2026-11-20T22:00:00+09:00' };
const at = (hhmm: string) => new Date(`2026-11-20T${hhmm}:00+09:00`);

describe('seatMapTimes', () => {
  it('운영 시작부터 종료 30분 전까지 30분 단위', () => {
    const times = seatMapTimes(period);
    expect(times).toHaveLength(8);
    expect(times[0]).toBe(at('18:00').getTime());
    expect(times[times.length - 1]).toBe(at('21:30').getTime());
  });
});

describe('defaultSeatMapTime', () => {
  it('운영 중이면 지금을 30분 단위로 내린다', () => {
    expect(defaultSeatMapTime(period, at('19:47'))).toBe(at('19:30').getTime());
    expect(defaultSeatMapTime(period, at('19:30'))).toBe(at('19:30').getTime());
  });

  it('운영 전·종료 후면 운영 시작', () => {
    expect(defaultSeatMapTime(period, at('09:00'))).toBe(at('18:00').getTime());
    expect(defaultSeatMapTime(period, at('22:00'))).toBe(at('18:00').getTime());
  });
});

describe('nowSeatMapTime', () => {
  it('운영 시간이 아니면 null', () => {
    expect(nowSeatMapTime(period, at('17:59'))).toBeNull();
    expect(nowSeatMapTime(period, at('21:59'))).toBe(at('21:30').getTime());
  });
});

describe('isSeatedAt', () => {
  it('시작은 포함, 끝은 제외', () => {
    const v = { startAt: '2026-11-20T19:00:00+09:00', endAt: '2026-11-20T21:00:00+09:00' };
    expect(isSeatedAt(v, at('19:00').getTime())).toBe(true);
    expect(isSeatedAt(v, at('20:30').getTime())).toBe(true);
    expect(isSeatedAt(v, at('21:00').getTime())).toBe(false);
  });
});
