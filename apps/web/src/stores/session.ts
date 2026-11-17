import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { Student } from '@hiconsy/shared';

export type Role = 'teacher' | 'student';

/** 로그인 대신 화면에서 고른 역할과 학생 (localStorage에 유지) */
export interface SessionStudent {
  id: number;
  name: string;
  phone: string;
}

interface PersistedSession {
  role: Role | null;
  student: SessionStudent | null;
}

export const SESSION_STORAGE_KEY = 'hiconsy.session';

function load(): PersistedSession {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return { role: null, student: null };
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    const role = parsed.role === 'teacher' || parsed.role === 'student' ? parsed.role : null;
    const student = parsed.student && typeof parsed.student.id === 'number' ? parsed.student : null;
    // 학생 역할인데 학생 정보가 없으면 세션을 비운다
    if (role === 'student' && !student) return { role: null, student: null };
    return { role, student: role === 'student' ? student : null };
  } catch {
    return { role: null, student: null };
  }
}

export const useSessionStore = defineStore('session', () => {
  const initial = load();
  const role = ref<Role | null>(initial.role);
  const student = ref<SessionStudent | null>(initial.student);

  const isTeacher = computed(() => role.value === 'teacher');
  const isStudent = computed(() => role.value === 'student' && student.value !== null);
  /** 학생 화면에서 쓰는 학생 id (학생 역할이 아니면 null) */
  const studentId = computed(() => (isStudent.value ? student.value!.id : null));

  function enterAsTeacher() {
    role.value = 'teacher';
    student.value = null;
  }

  function enterAsStudent(s: Pick<Student, 'id' | 'name' | 'phone'>) {
    role.value = 'student';
    student.value = { id: s.id, name: s.name, phone: s.phone };
  }

  function reset() {
    role.value = null;
    student.value = null;
  }

  watch([role, student], () => {
    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ role: role.value, student: student.value }),
      );
    } catch {
      // 저장소를 쓸 수 없는 환경(사파리 비공개 창 등)에서는 메모리에만 둔다
    }
  });

  return { role, student, isTeacher, isStudent, studentId, enterAsTeacher, enterAsStudent, reset };
});
