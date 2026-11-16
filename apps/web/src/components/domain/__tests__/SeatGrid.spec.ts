import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SeatGrid, { type GridSeat } from '../SeatGrid.vue';

/** 좌석 n개, taken 번호는 예약됨. id = 번호 + 100 */
function seats(n: number, taken: number[] = []): GridSeat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 101,
    number: i + 1,
    available: !taken.includes(i + 1),
  }));
}

function mountGrid(list: GridSeat[], modelValue: number | null = null, extra = {}) {
  return mount(SeatGrid, {
    props: {
      seats: list,
      modelValue,
      'onUpdate:modelValue': (v: number | null) => wrapper.setProps({ modelValue: v }),
      ...extra,
    },
    attachTo: document.body,
  });
}
let wrapper: ReturnType<typeof mountGrid>;

const radio = (n: number) => wrapper.get(`[data-seat="${n}"]`);

describe('SeatGrid', () => {
  it('좌석마다 번호와 상태를 이름으로 읽는다', () => {
    wrapper = mountGrid(seats(3, [2]), null, { mySeatId: 103 });
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('좌석');
    expect(radio(1).attributes('aria-label')).toBe('1번 좌석, 비어 있음');
    expect(radio(2).attributes('aria-label')).toBe('2번 좌석, 예약됨');
    expect(radio(2).attributes('aria-disabled')).toBe('true');
    expect(radio(3).attributes('aria-label')).toBe('3번 좌석, 비어 있음, 내 좌석');
    expect(radio(3).text()).toContain('내 좌석');
    wrapper.unmount();
  });

  it('빈 좌석을 누르면 고르고, 예약된 좌석은 고를 수 없다', async () => {
    wrapper = mountGrid(seats(3, [2]));
    await radio(2).trigger('click');
    expect(wrapper.props('modelValue')).toBeNull();
    await radio(3).trigger('click');
    expect(wrapper.props('modelValue')).toBe(103);
    expect(radio(3).attributes('aria-checked')).toBe('true');
    wrapper.unmount();
  });

  it('Tab은 고른 좌석, 없으면 첫 빈 좌석 하나에만 머문다', async () => {
    wrapper = mountGrid(seats(4, [1]));
    expect(wrapper.findAll('[tabindex="0"]').map((b) => b.attributes('data-seat'))).toEqual(['2']);
    await wrapper.setProps({ modelValue: 104 });
    expect(wrapper.findAll('[tabindex="0"]').map((b) => b.attributes('data-seat'))).toEqual(['4']);
    wrapper.unmount();
  });

  it('방향키로 움직이며 고르고, 예약된 좌석은 건너뛴다', async () => {
    // 1 2 3 4 5 / 6 7 8 9 10 — 2·7 예약됨
    wrapper = mountGrid(seats(10, [2, 7]), 101);
    await radio(1).trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.props('modelValue')).toBe(103); // 2를 건너뜀
    expect(document.activeElement?.getAttribute('data-seat')).toBe('3');

    await radio(3).trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.props('modelValue')).toBe(108);

    await radio(8).trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.props('modelValue')).toBe(106); // 7을 건너뜀
    wrapper.unmount();
  });

  it('줄 끝에서 좌우로는 다음 줄로 넘어가지 않는다', async () => {
    wrapper = mountGrid(seats(10), 105);
    await radio(5).trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.props('modelValue')).toBe(105);
    wrapper.unmount();
  });

  it('disabled면 고를 수 없다', async () => {
    wrapper = mountGrid(seats(2), null, { disabled: true });
    await radio(1).trigger('click');
    expect(wrapper.props('modelValue')).toBeNull();
    wrapper.unmount();
  });
});
