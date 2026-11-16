import { computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import type { StudyRoom } from '@hiconsy/shared';
import { studyRoomsApi } from '@/api/studyRooms';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { useMyVisitsStore } from '@/stores/myVisits';
import {
  findAlternativeRooms,
  type AlternativeRoom,
  type VisitRange,
} from '@/utils/alternativeRooms';
import { toIsoWithOffset } from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import { encodeSlot } from '@/utils/visitSlots';

/** 고른 시간에 빈 좌석이 없는 자습실과 그 시간 */
export interface FullRoomEvent extends VisitRange {
  room: Pick<StudyRoom, 'id' | 'name'>;
}

interface Fallback {
  fullRoomName: string;
  range: VisitRange;
  rooms: AlternativeRoom[];
}

/**
 * 고른 시간에 빈 좌석이 없을 때 같은 시간에 빈 좌석이 있는 자습실 안내 (#35, #49, screens.md S-23)
 * 1. 자습실 목록·내 신청과 자습실별 빈 좌석 수를 다시 받아
 * 2. 같은 시간으로 바로 신청할 수 있는 다른 자습실이 있으면 안내 다이얼로그를 열고,
 *    없으면 "같은 시간에 빈 좌석이 있는 자습실이 없어요" 토스트로 알린다.
 * 3. 고른 자습실은 같은 시간이 채워진 자습실 페이지(`/student/rooms/:id?slot=`)로 연다.
 */
export function useFullRoomFallback() {
  const router = useRouter();
  const toast = useToast();
  const myVisits = useMyVisitsStore();
  const handleStudentGone = useStudentGuard();
  const fallback = shallowRef<Fallback | null>(null);

  async function onFull(event: FullRoomEvent): Promise<boolean> {
    const range = { startAt: event.startAt, endAt: event.endAt };
    let rooms: StudyRoom[];
    let free: Map<number, number>;
    try {
      const [list, counts] = await Promise.all([
        studyRoomsApi.list(),
        studyRoomsApi.freeSeats({
          startAt: toIsoWithOffset(range.startAt),
          endAt: toIsoWithOffset(range.endAt),
        }),
        myVisits.load(),
      ]);
      rooms = list;
      free = new Map(counts.map((c) => [c.studyRoomId, c.freeSeats]));
    } catch (e) {
      if (!handleStudentGone(e)) toast.error(errorMessage(e));
      return false;
    }
    const candidates = findAlternativeRooms(rooms, free, range, myVisits.visits, event.room.id);
    if (candidates.length === 0) {
      toast.error('같은 시간에 빈 좌석이 있는 자습실이 없어요');
      return false;
    }
    fallback.value = { fullRoomName: event.room.name, range, rooms: candidates };
    return true;
  }

  function pick(room: StudyRoom) {
    const range = fallback.value?.range;
    fallback.value = null;
    if (!range) return;
    void router.push({
      name: 'student-room',
      params: { id: String(room.id) },
      query: { slot: encodeSlot(range.startAt, range.endAt) },
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
