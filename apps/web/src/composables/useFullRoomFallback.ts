import { computed, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import type { StudyRoom } from '@hiconsy/shared';
import { waitlistApi } from '@/api/waitlist';
import type { FullRoomEvent, VisitRoom } from '@/components/domain/VisitFormDialog.vue';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { useMyVisitsStore } from '@/stores/myVisits';
import { useMyWaitlistStore } from '@/stores/myWaitlist';
import { useSessionStore } from '@/stores/session';
import { findAlternativeRooms, type VisitRange } from '@/utils/alternativeRooms';
import { errorMessage } from '@/utils/errorMessage';
import { toIsoWithOffset } from '@/utils/datetime';
import { encodeSlot } from '@/utils/visitSlots';

interface Fallback {
  fullRoom: VisitRoom;
  range: VisitRange;
  rooms: StudyRoom[];
  canWait: boolean;
  waitingCount: number;
}

/**
 * 정원이 차서 신청이 거절됐을 때 (#35·#36, screens.md S-23)
 * 1. 자습실 목록·내 신청·내 대기를 다시 받아
 * 2. 같은 시간으로 바로 신청할 수 있는 다른 자습실, 또는 거절된 자습실 대기 등록을 안내한다.
 *    둘 다 없으면(이미 대기 중이고 후보도 없음) 토스트로 알린다.
 * 3. 다른 자습실을 고르면 같은 시간이 채워진 신청 다이얼로그(`/student/rooms?apply=&slot=`)로,
 *    대기 등록은 그 시간으로 바로 등록한다.
 *
 * @param rooms 다시 받은 자습실 목록 (화면의 useAsync 데이터)
 * @param refresh 자습실 목록·내 신청·내 대기를 다시 받는 함수
 */
export function useFullRoomFallback(
  rooms: () => readonly StudyRoom[] | undefined,
  refresh: () => Promise<void>,
) {
  const router = useRouter();
  const toast = useToast();
  const session = useSessionStore();
  const myVisits = useMyVisitsStore();
  const myWaitlist = useMyWaitlistStore();
  const handleStudentGone = useStudentGuard();
  const fallback = shallowRef<Fallback | null>(null);
  const waiting = ref(false);

  async function onFull(event: FullRoomEvent) {
    const range = { startAt: event.startAt, endAt: event.endAt };
    await refresh();
    const list = rooms() ?? [];
    const candidates = findAlternativeRooms(list, range, myVisits.visits, event.room.id);
    const fullRoom = list.find((r) => r.id === event.room.id);
    const canWait =
      !!fullRoom && fullRoom.availableSeats === 0 && !myWaitlist.activeByRoom.has(fullRoom.id);
    if (candidates.length === 0 && !canWait) {
      toast.error(event.message);
      return;
    }
    fallback.value = {
      fullRoom: event.room,
      range,
      rooms: candidates,
      canWait,
      waitingCount: fullRoom ? fullRoom.waitingCount + fullRoom.offeredCount : 0,
    };
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

  async function wait() {
    const current = fallback.value;
    const studentId = session.studentId;
    if (!current || studentId === null) return;
    waiting.value = true;
    try {
      const entry = await waitlistApi.register(studentId, {
        studyRoomId: current.fullRoom.id,
        startAt: toIsoWithOffset(current.range.startAt),
        endAt: toIsoWithOffset(current.range.endAt),
      });
      toast.success(
        `${current.fullRoom.name} 대기 등록했어요${entry.position ? `. ${entry.position}번째예요` : ''}`,
      );
      fallback.value = null;
    } catch (e) {
      if (handleStudentGone(e)) return;
      toast.error(errorMessage(e));
      fallback.value = null;
    } finally {
      waiting.value = false;
      await refresh();
    }
  }

  const open = computed({
    get: () => !!fallback.value,
    set: (v: boolean) => {
      if (!v) fallback.value = null;
    },
  });

  return { fallback, open, waiting, onFull, pick, wait };
}
