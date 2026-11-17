import { nextTick } from 'vue';
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type RouterHistory,
} from 'vue-router';
import { useSessionStore, type Role } from '@/stores/session';

declare module 'vue-router' {
  interface RouteMeta {
    /** 이 화면에 들어올 수 있는 역할 (없으면 공통) */
    role?: Role;
    /** 문서 제목 (`{title} · 자습실 예약`) */
    title?: string;
  }
}

export const APP_NAME = '자습실 예약';

/** 라우트 맵 — apps/web/docs/information-architecture.md */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'role-select',
    component: () => import('@/views/RoleSelectView.vue'),
    meta: { title: '역할 선택' },
  },
  { path: '/teacher', redirect: { name: 'teacher-rooms' } },
  {
    path: '/teacher/rooms',
    name: 'teacher-rooms',
    component: () => import('@/views/teacher/TeacherRoomsView.vue'),
    meta: { role: 'teacher', title: '자습실 목록' },
  },
  {
    path: '/teacher/rooms/:id(\\d+)',
    name: 'teacher-room',
    component: () => import('@/views/teacher/TeacherRoomDetailView.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: { role: 'teacher', title: '자습실 상세' },
  },
  {
    path: '/teacher/students',
    name: 'teacher-students',
    component: () => import('@/views/teacher/TeacherStudentsView.vue'),
    meta: { role: 'teacher', title: '학생 목록' },
  },
  { path: '/student', redirect: { name: 'student-rooms' } },
  {
    path: '/student/rooms',
    name: 'student-rooms',
    component: () => import('@/views/student/StudentRoomsView.vue'),
    meta: { role: 'student', title: '자습실 목록' },
  },
  {
    path: '/student/rooms/:id(\\d+)',
    name: 'student-room',
    component: () => import('@/views/student/StudentRoomView.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: { role: 'student', title: '자습실 좌석' },
  },
  {
    path: '/student/visits',
    name: 'student-visits',
    component: () => import('@/views/student/StudentVisitsView.vue'),
    meta: { role: 'student', title: '내 신청' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '페이지를 찾을 수 없음' },
  },
];

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  const router = createRouter({ history, routes });

  // 역할이 맞지 않으면 역할 선택으로 보낸다
  router.beforeEach((to) => {
    const required = to.meta.role;
    if (!required) return true;
    const session = useSessionStore();
    const allowed = required === 'teacher' ? session.isTeacher : session.isStudent;
    return allowed ? true : { name: 'role-select' };
  });

  // 문서 제목 갱신 + 새 페이지 h1로 포커스 이동 (첫 진입은 제외)
  router.afterEach((to, from, failure) => {
    if (failure) return;
    document.title = to.meta.title ? `${to.meta.title} · ${APP_NAME}` : APP_NAME;
    if (!from.matched.length) return;
    void nextTick(() => {
      document.querySelector<HTMLElement>('[data-page-title]')?.focus();
    });
  });

  return router;
}
