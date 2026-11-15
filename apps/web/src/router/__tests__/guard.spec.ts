import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { createAppRouter } from '../index';
import { useSessionStore } from '@/stores/session';

describe('router guard', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('역할 없이 강사 화면에 들어가면 역할 선택으로 보낸다', async () => {
    const router = createAppRouter(createMemoryHistory());
    await router.push('/teacher/rooms');
    expect(router.currentRoute.value.name).toBe('role-select');
  });

  it('학생은 강사 화면에 들어갈 수 없다', async () => {
    useSessionStore().enterAsStudent({ id: 1, name: '김하늘', phone: '010-1234-5678' });
    const router = createAppRouter(createMemoryHistory());
    await router.push('/teacher/students');
    expect(router.currentRoute.value.name).toBe('role-select');
  });

  it('역할이 맞으면 들어가고 문서 제목을 바꾼다', async () => {
    useSessionStore().enterAsTeacher();
    const router = createAppRouter(createMemoryHistory());
    await router.push('/teacher/rooms/7');
    expect(router.currentRoute.value.name).toBe('teacher-room');
    expect(document.title).toBe('자습실 상세 · 자습실 예약');
  });
});
