import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { SeatOccupancy } from '@hiconsy/shared';
import SeatMapGrid from '../SeatMapGrid.vue';

const visit = (name: string, deletedAt: string | null): SeatOccupancy['visit'] => ({
  id: 1,
  student: { id: 1, name, phone: '010-1234-5678', deletedAt },
  startAt: '2026-11-20T19:00:00+09:00',
  endAt: '2026-11-20T21:00:00+09:00',
});

const seats: SeatOccupancy[] = [
  { id: 1, number: 1, visit: visit('김하늘', null) },
  { id: 2, number: 2, visit: visit('이도윤', '2026-11-17T10:00:00+09:00') },
  { id: 3, number: 3, visit: null },
];

describe('SeatMapGrid', () => {
  it('좌석마다 학생 이름·시간을 스크린리더 이름으로 준다', () => {
    const wrapper = mount(SeatMapGrid, { props: { seats } });
    const labels = wrapper.findAll('li[data-seat]').map((li) => li.attributes('aria-label'));
    expect(labels).toEqual([
      '1번 좌석, 김하늘, 19:00 – 21:00',
      '2번 좌석, 이도윤, 탈퇴한 학생, 19:00 – 21:00',
      '3번 좌석, 비어 있음',
    ]);
  });

  it('탈퇴한 학생 칸은 끝나는 시각 자리에 "탈퇴"를 보여준다 (#61)', () => {
    const wrapper = mount(SeatMapGrid, { props: { seats } });
    expect(wrapper.get('[data-seat="1"]').text()).toContain('~21:00');
    expect(wrapper.get('[data-seat="2"]').text()).toContain('탈퇴');
    expect(wrapper.get('[data-seat="2"]').text()).not.toContain('~21:00');
  });

  it('강조한 좌석을 표시한다', () => {
    const wrapper = mount(SeatMapGrid, { props: { seats, highlightedSeatId: 1 } });
    expect(wrapper.get('[data-seat="1"]').attributes('data-highlighted')).toBe('true');
    expect(wrapper.get('[data-seat="2"]').attributes('data-highlighted')).toBeUndefined();
  });
});
