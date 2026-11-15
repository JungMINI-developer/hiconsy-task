import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { SESSION_STORAGE_KEY, useSessionStore } from '../session';

const student = { id: 3, name: '김하늘', phone: '010-1234-5678' };

describe('session store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('학생으로 들어가면 localStorage에 저장한다', async () => {
    const session = useSessionStore();
    session.enterAsStudent(student);
    await nextTick();
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!)).toEqual({
      role: 'student',
      student,
    });
  });

  it('저장된 세션을 복원한다', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ role: 'student', student }));
    const session = useSessionStore();
    expect(session.isStudent).toBe(true);
    expect(session.studentId).toBe(3);
  });

  it('강사로 바꾸면 학생 정보를 비운다', () => {
    const session = useSessionStore();
    session.enterAsStudent(student);
    session.enterAsTeacher();
    expect(session.isTeacher).toBe(true);
    expect(session.student).toBeNull();
  });

  it('손상된 값이면 빈 세션으로 시작한다', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, '{oops');
    expect(useSessionStore().role).toBeNull();
    setActivePinia(createPinia());
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ role: 'student', student: null }));
    expect(useSessionStore().role).toBeNull();
  });
});
