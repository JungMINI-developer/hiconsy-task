import { computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import type { StudyRoom } from '@hiconsy/shared';
import type { FullRoomEvent } from '@/components/domain/VisitFormDialog.vue';
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

interface Fallback {
  fullRoomName: string;
  range: VisitRange;
  rooms: AlternativeRoom[];
}

/**
 * 고른 시간에 빈 좌석이 없을 때 같은 시간에 빈 좌석이 있는 자습실 안내 (#35, #49, screens.md S-23)
 * 1. 자습실 목록·내 신청과 자습실별 빈 좌석 수를 다시 받아
 * 2. 같은 시간으로 바로 신청할 수 있는 다른 자습실이 있으면 안내 다이얼로그를 열고, 없으면 토스트로 알린다.
 *    열었는지를 돌려주므로, 화면은 열었을 때만 신청 다이얼로그를 닫는다 (없으면 S-22에 남는다).
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
  const handleStudentGone = useStudentGuard();
  const fallback = shallowRef<Fallback | null>(null);

  async function onFull(event: FullRoomEvent): Promise<boolean> {
    const range = { startAt: event.startAt, endAt: event.endAt };
    let free: Map<number, number>;
    try {
      const [counts] = await Promise.all([
        studyRoomsApi.freeSeats({
          startAt: toIsoWithOffset(range.startAt),
          endAt: toIsoWithOffset(range.endAt),
        }),
        refresh(),
      ]);
      free = new Map(counts.map((c) => [c.studyRoomId, c.freeSeats]));
    } catch (e) {
      if (!handleStudentGone(e)) toast.error(errorMessage(e));
      return false;
    }
    const candidates = findAlternativeRooms(
      rooms() ?? [],
      free,
      range,
      myVisits.visits,
      event.room.id,
    );
    if (candidates.length === 0) {
      toast.error(event.message);
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
