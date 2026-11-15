import { describe, expect, it } from 'vitest';
import {
  hasAvailableSlot,
  slotToDate,
  visitDateOptions,
  visitEndOptions,
  visitStartOptions,
} from '../visitSlots';

// TZ=Asia/Seoul (vitest.config.ts)
const period = { startDate: '2026-11-20T18:00:00+09:00', endDate: '2026-11-20T22:00:00+09:00' };
const before = new Date('2026-11-15T12:00:00+09:00');

describe('visitSlots', () => {
  it('운영 기간 안에서 30분 단위로 시작 시각을 만든다 (끝 30분 전까지)', () => {
    expect(visitDateOptions(period, before)).toEqual(['2026-11-20']);
    expect(visitStartOptions(period, '2026-11-20', before)).toEqual([
      '18:00',
      '18:30',
      '19:00',
      '19:30',
      '20:00',
      '20:30',
      '21:00',
      '21:30',
    ]);
  });

  it('지금 이전 시각은 제외하고 다음 30분 경계부터 시작한다', () => {
    const now = new Date('2026-11-20T19:10:00+09:00');
    expect(visitStartOptions(period, '2026-11-20', now)[0]).toBe('19:30');
    // 정확히 경계 시각이어도 지금은 고를 수 없다 (시작은 현재 이후)
    expect(visitStartOptions(period, '2026-11-20', new Date('2026-11-20T19:00:00+09:00'))[0]).toBe(
      '19:30',
    );
  });

  it('종료 시각은 시작 이후 ~ 운영 종료까지', () => {
    expect(visitEndOptions(period, slotToDate('2026-11-20', '21:00')!)).toEqual(['21:30', '22:00']);
  });

  it('여러 날 운영이면 날짜별로 나누고 방문은 하루 안으로 제한한다', () => {
    const multi = {
      startDate: '2026-11-20T22:00:00+09:00',
      endDate: '2026-11-21T02:00:00+09:00',
    };
    expect(visitDateOptions(multi, before)).toEqual(['2026-11-20', '2026-11-21']);
    expect(visitStartOptions(multi, '2026-11-20', before)).toEqual([
      '22:00',
      '22:30',
      '23:00',
      '23:30',
    ]);
    expect(visitEndOptions(multi, slotToDate('2026-11-20', '23:00')!)).toEqual(['23:30', '24:00']);
    expect(slotToDate('2026-11-20', '24:00')!.toISOString()).toBe('2026-11-20T15:00:00.000Z');
  });

  it('운영 시작이 30분 경계가 아니면 다음 경계부터', () => {
    const odd = { startDate: '2026-11-20T18:10:00+09:00', endDate: '2026-11-20T19:30:00+09:00' };
    expect(visitStartOptions(odd, '2026-11-20', before)).toEqual(['18:30', '19:00']);
  });

  it('남은 시간이 없으면 신청할 수 없다', () => {
    expect(hasAvailableSlot(period, new Date('2026-11-20T21:40:00+09:00'))).toBe(false);
    expect(hasAvailableSlot(period, before)).toBe(true);
  });
});
