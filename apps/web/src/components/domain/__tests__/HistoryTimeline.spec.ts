import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { StudyRoomHistory } from '@hiconsy/shared';
import HistoryTimeline from '../HistoryTimeline.vue';

const base: StudyRoomHistory = {
  id: 1,
  visitId: 1,
  student: { id: 1, name: '김하늘' },
  action: 'APPLY',
  prevStartAt: null,
  prevEndAt: null,
  startAt: '2026-11-20T18:00:00+09:00',
  endAt: '2026-11-20T20:00:00+09:00',
  actorType: 'STUDENT',
  reason: null,
  createdAt: '2026-11-14T09:00:00+09:00',
};

describe('HistoryTimeline', () => {
  it('시간 변경은 이전 → 이후를 한 줄로 보여준다', () => {
    const wrapper = mount(HistoryTimeline, {
      props: {
        items: [
          {
            ...base,
            action: 'UPDATE',
            prevStartAt: '2026-11-20T19:00:00+09:00',
            prevEndAt: '2026-11-20T21:00:00+09:00',
          },
        ],
      },
    });
    expect(wrapper.text()).toContain('시간 변경');
    expect(wrapper.find('del').text()).toBe('11.20(금) 19:00 – 21:00');
    expect(wrapper.text()).toContain('18:00 – 20:00');
  });

  it('시스템 취소는 자동 취소와 사유를 보여준다', () => {
    const wrapper = mount(HistoryTimeline, {
      props: { items: [{ ...base, action: 'CANCEL', actorType: 'SYSTEM', reason: '자습실 삭제' }] },
    });
    expect(wrapper.text()).toContain('자동 취소');
    expect(wrapper.text()).toContain('시스템 처리 · 사유: 자습실 삭제');
  });

  it('showStudent=false면 학생 이름을 숨긴다', () => {
    const wrapper = mount(HistoryTimeline, { props: { items: [base], showStudent: false } });
    expect(wrapper.text()).not.toContain('김하늘');
  });
});
