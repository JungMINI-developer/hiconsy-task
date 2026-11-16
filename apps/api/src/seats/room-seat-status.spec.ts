import { ceilToSlot, seatHasFreeSlot } from './room-seat-status.js';

/** 2030-01-10 h시 m분 (KST) */
const t = (h: number, m = 0) =>
  new Date(`2030-01-10T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+09:00`);
const ms = (h: number, m = 0) => t(h, m).getTime();
const visit = (from: number, to: number) => ({ startAt: t(from), endAt: t(to) });

describe('ceilToSlot', () => {
  it('다음 30분 경계로 올리고, 경계면 그대로 둔다', () => {
    expect(ceilToSlot(ms(10, 1))).toBe(ms(10, 30));
    expect(ceilToSlot(ms(10, 30))).toBe(ms(10, 30));
  });
});

describe('seatHasFreeSlot', () => {
  it('신청이 없으면 30분 이상 남았을 때만 빈 구간이 있다', () => {
    expect(seatHasFreeSlot([], ms(21, 30), ms(22))).toBe(true);
    expect(seatHasFreeSlot([], ms(21, 31), ms(22))).toBe(false);
  });

  it('신청 사이에 30분 이상 틈이 있으면 빈 구간이 있다', () => {
    expect(seatHasFreeSlot([visit(10, 12), visit(13, 22)], ms(10), ms(22))).toBe(true);
  });

  it('신청이 빈틈없이 이어지면 빈 구간이 없다 (순서 무관)', () => {
    expect(seatHasFreeSlot([visit(12, 22), visit(9, 12)], ms(9), ms(22))).toBe(false);
  });

  it('30분 경계에 맞지 않는 짧은 틈은 빈 구간이 아니다', () => {
    const v1 = { startAt: t(9), endAt: t(10, 10) };
    const v2 = { startAt: t(10, 50), endAt: t(22) };
    expect(seatHasFreeSlot([v1, v2], ms(9), ms(22))).toBe(false); // 10:10~10:50 사이 30분 경계 칸 없음
  });

  it('마지막 신청 뒤에 30분이 남으면 빈 구간이 있다', () => {
    expect(seatHasFreeSlot([visit(9, 21)], ms(9), ms(22))).toBe(true);
  });

  it('from 이전에 시작한 신청도 고려한다', () => {
    expect(seatHasFreeSlot([visit(8, 22)], ms(19), ms(22))).toBe(false);
  });
});
