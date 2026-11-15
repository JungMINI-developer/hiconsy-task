import { computed, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import type { Visit } from '@hiconsy/shared';
import { visitsApi } from '@/api/visits';
import { useSessionStore } from './session';

export type VisitGroup = 'upcoming' | 'past' | 'canceled';

/** 예정(유효 신청 중 방문 종료 전) / 지난 방문 / 취소됨 — screens.md S-21 */
export function visitGroup(visit: Visit, now: Date = new Date()): VisitGroup {
  if (visit.status === 'CANCELED') return 'canceled';
  return new Date(visit.endAt).getTime() > now.getTime() ? 'upcoming' : 'past';
}

/** 이미 시작한 방문은 수정·취소할 수 없다 (requirements 9절 #12) */
export function isVisitEditable(visit: Visit, now: Date = new Date()): boolean {
  return visit.status === 'APPLIED' && new Date(visit.startAt).getTime() > now.getTime();
}

/**
 * 학생 본인의 방문 신청 목록.
 * 헤더의 "내 신청" 배지와 학생 화면들이 같은 값을 보도록 스토어에 둔다.
 * (서버 데이터를 오래 캐시하지 않고, 화면 진입·변경 후마다 load로 다시 가져온다)
 */
export const useMyVisitsStore = defineStore('myVisits', () => {
  const session = useSessionStore();
  const visits = shallowRef<Visit[]>([]);

  const upcomingCount = computed(
    () => visits.value.filter((v) => visitGroup(v) === 'upcoming').length,
  );

  /** 자습실 id → 유효 신청 */
  const activeByRoom = computed(() => {
    const map = new Map<number, Visit>();
    for (const v of visits.value) if (v.status === 'APPLIED') map.set(v.studyRoom.id, v);
    return map;
  });

  async function load(): Promise<Visit[]> {
    const id = session.studentId;
    if (id === null) return [];
    const list = await visitsApi.list(id);
    if (session.studentId === id) visits.value = list;
    return list;
  }

  function clear() {
    visits.value = [];
  }

  // 다른 학생으로 바꾸면 이전 학생의 신청을 보여주지 않는다
  watch(
    () => session.studentId,
    () => clear(),
  );

  return { visits, upcomingCount, activeByRoom, load, clear };
});
