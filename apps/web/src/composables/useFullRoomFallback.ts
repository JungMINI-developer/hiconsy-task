import { computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import type { StudyRoom } from '@hiconsy/shared';
import type { FullRoomEvent } from '@/components/domain/VisitFormDialog.vue';
import { useToast } from '@/composables/useToast';
import { useMyVisitsStore } from '@/stores/myVisits';
import { findAlternativeRooms, type VisitRange } from '@/utils/alternativeRooms';
import { encodeSlot } from '@/utils/visitSlots';

interface Fallback {
  fullRoomName: string;
  range: VisitRange;
  rooms: StudyRoom[];
}

/**
 * 정원이 차서 신청이 거절됐을 때 (#35, screens.md S-23)
 * 1. 자습실 목록·내 신청을 다시 받아
 * 2. 같은 시간으로 바로 신청할 수 있는 다른 자습실이 있으면 안내 다이얼로그를 열고, 없으면 토스트로 알린다.
 * 3. 고른 자습실은 같은 시간이 채워진 신청 다이얼로그(`/student/rooms?apply=&slot=`)로 연다.
 *
 * @param rooms 다시 받은 자습실 목록 (화면의 useAsync 데이터)
 * @param refresh 자습실 목록과 내 신청을 다시 받는 함수
 */
export function useFullRoomFallback(
  rooms: () => readonly StudyRoom[] | undefined,
  refresh: () => Promise<void>,
) {
  const router = useRouter();
  const toast = useToast();
  const myVisits = useMyVisitsStore();
  const fallback = shallowRef<Fallback | null>(null);

  async function onFull(event: FullRoomEvent) {
    const range = { startAt: event.startAt, endAt: event.endAt };
    await refresh();
    const candidates = findAlternativeRooms(rooms() ?? [], range, myVisits.visits, event.room.id);
    if (candidates.length === 0) {
      toast.error(event.message);
      return;
    }
    fallback.value = { fullRoomName: event.room.name, range, rooms: candidates };
  }

  function pick(room: StudyRoom) {
    const range = fallback.value?.range;
    fallback.value = null;
    if (!range) return;
    void router.push({
      name: 'student-rooms',
      query: { apply: String(room.id), slot: encodeSlot(range.startAt, range.endAt) },
    });
  }

  const open = computed({
    get: () => !!fallback.value,
    set: (v: boolean) => {
      if (!v) fallback.value = null;
    },
  });

  return { fallback, open, onFull, pick };
}
