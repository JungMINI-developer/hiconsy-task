import { computed, ref } from 'vue';
import type { Visit } from '@hiconsy/shared';
import { visitsApi } from '@/api/visits';
import { useSessionStore } from '@/stores/session';
import { formatTime, formatTimeRange } from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import { useStudentGuard } from './useStudentGuard';
import { useToast } from './useToast';

/**
 * 조기 퇴실 (#66, 규칙 #16) — 확인 다이얼로그 상태와 요청.
 * 내 신청(S-21)과 자습실 페이지(S-22)가 같은 흐름을 쓴다.
 * 되돌릴 수 없으므로 항상 확인을 받는다 (확인 다이얼로그 규칙: 되돌릴 수 없는 일만 확인).
 */
export function useVisitCheckout(onDone: () => unknown) {
  const session = useSessionStore();
  const toast = useToast();
  const handleStudentGone = useStudentGuard();

  const target = ref<Visit | null>(null);
  const busy = ref(false);
  const open = computed({
    get: () => !!target.value,
    set: (v: boolean) => {
      if (!v) target.value = null;
    },
  });

  const description = computed(() => {
    const v = target.value;
    if (!v) return '';
    const seat = v.seat ? ` · ${v.seat.number}번 좌석` : '';
    return (
      `${v.studyRoom.name}${seat} · ${formatTimeRange(v.startAt, v.endAt)}. ` +
      `지금(${formatTime(new Date())}) 퇴실하면 남은 시간에는 다른 학생이 이 좌석을 쓸 수 있고, 되돌릴 수 없어요.`
    );
  });

  async function confirm() {
    const visit = target.value;
    const studentId = session.studentId;
    if (!visit || studentId === null) return;
    busy.value = true;
    try {
      const done = await visitsApi.checkout(studentId, visit.id);
      toast.success(`퇴실했어요. ${formatTimeRange(done.startAt, done.endAt)} 이용`);
    } catch (e) {
      if (!handleStudentGone(e)) toast.error(errorMessage(e));
    } finally {
      busy.value = false;
      target.value = null;
      await onDone();
    }
  }

  return { target, open, busy, description, confirm };
}
