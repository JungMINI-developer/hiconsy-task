import { computed, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import type { WaitlistEntry } from '@hiconsy/shared';
import { waitlistApi } from '@/api/waitlist';
import { useSessionStore } from './session';

export const isActiveWait = (e: WaitlistEntry) => e.status === 'WAITING' || e.status === 'OFFERED';

/**
 * 학생 본인의 대기 (#36).
 * 상단 자리 제안 배너·자습실 카드·내 신청 대기 탭이 같은 값을 보도록 스토어에 둔다.
 * 서버가 조회 때 만료·다음 순번 제안을 정리하므로, 화면 진입·변경 후·제안 만료 시점에 load로 다시 가져온다.
 */
export const useMyWaitlistStore = defineStore('myWaitlist', () => {
  const session = useSessionStore();
  const entries = shallowRef<WaitlistEntry[]>([]);

  const active = computed(() => entries.value.filter(isActiveWait));
  /** 자리 제안 중 — 상단 배너 */
  const offers = computed(() => active.value.filter((e) => e.status === 'OFFERED'));
  /** 자습실 id → 진행 중 대기 */
  const activeByRoom = computed(() => new Map(active.value.map((e) => [e.studyRoom.id, e])));

  async function load(): Promise<WaitlistEntry[]> {
    const id = session.studentId;
    if (id === null) return [];
    const list = await waitlistApi.list(id);
    if (session.studentId === id) entries.value = list;
    return list;
  }

  function clear() {
    entries.value = [];
  }

  watch(
    () => session.studentId,
    () => clear(),
  );

  return { entries, active, offers, activeByRoom, load, clear };
});
