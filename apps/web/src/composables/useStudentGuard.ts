import { ErrorCode } from '@hiconsy/shared';
import { useRouter } from 'vue-router';
import { AppError } from '@/api/client';
import { useMyVisitsStore } from '@/stores/myVisits';
import { useSessionStore } from '@/stores/session';
import { useToast } from './useToast';

/**
 * 선택한 학생이 그 사이 삭제되면(STUDENT_NOT_FOUND) 세션을 비우고 역할 선택으로 보낸다.
 * (interaction-rules.md#서버-응답-처리)
 * @returns 처리했으면 true
 */
export function useStudentGuard() {
  const router = useRouter();
  const session = useSessionStore();
  const myVisits = useMyVisitsStore();
  const toast = useToast();

  return function handleStudentGone(error: unknown): boolean {
    if (!(error instanceof AppError) || error.code !== ErrorCode.STUDENT_NOT_FOUND) return false;
    session.reset();
    myVisits.clear();
    toast.error('선택한 학생 정보가 삭제됐어요. 다시 골라 주세요');
    void router.replace({ name: 'role-select' });
    return true;
  };
}
