import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CapacityBar from '../CapacityBar.vue';

function fill(current: number, max: number) {
  const wrapper = mount(CapacityBar, { props: { current, max } });
  return wrapper.find('[role="meter"] > div').classes();
}

describe('CapacityBar', () => {
  it('80% 미만은 기본색, 80% 이상은 주의색, 100%는 마감색', () => {
    expect(fill(0, 10)).toContain('bg-status-open');
    expect(fill(7, 10)).toContain('bg-status-open');
    expect(fill(8, 10)).toContain('bg-status-warn');
    expect(fill(10, 10)).toContain('bg-status-full');
  });

  it('숫자를 함께 보여준다 (강사: 신청/정원, 학생: 남은 자리)', () => {
    expect(mount(CapacityBar, { props: { current: 7, max: 10 } }).text()).toContain('7 / 10명');
    expect(
      mount(CapacityBar, { props: { current: 7, max: 10, perspective: 'student' } }).text(),
    ).toContain('남은 자리 3 / 10');
  });

  it('meter 역할과 값을 노출한다', () => {
    const meter = mount(CapacityBar, { props: { current: 3, max: 5 } }).find('[role="meter"]');
    expect(meter.attributes('aria-valuenow')).toBe('3');
    expect(meter.attributes('aria-valuemax')).toBe('5');
  });

  it('학생 화면은 남은 자리만큼 막대가 차고, 적게 남으면 주의색', () => {
    const bar = (current: number) =>
      mount(CapacityBar, { props: { current, max: 10, perspective: 'student' } }).find(
        '[role="meter"] > div',
      );
    expect(bar(2).attributes('style')).toContain('width: 80%');
    expect(bar(2).classes()).toContain('bg-status-open');
    expect(bar(8).attributes('style')).toContain('width: 20%');
    expect(bar(8).classes()).toContain('bg-status-warn');
    expect(
      mount(CapacityBar, { props: { current: 8, max: 10, perspective: 'student' } })
        .find('[role="meter"]')
        .attributes('aria-valuenow'),
    ).toBe('2');
  });
});
