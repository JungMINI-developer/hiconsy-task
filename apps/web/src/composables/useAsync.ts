import { computed, onScopeDispose, ref, shallowRef, type Ref } from 'vue';
import { toAppError, type AppError } from '@/api/client';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

/** 스켈레톤을 띄우기 전 기다리는 시간 — 빠른 응답에서 깜빡임을 막는다 */
export const SKELETON_DELAY_MS = 300;

export interface UseAsyncReturn<T, A extends unknown[]> {
  data: Ref<T | undefined>;
  error: Ref<AppError | null>;
  status: Ref<AsyncStatus>;
  /** 첫 로딩이 300ms를 넘겼을 때만 true (재조회 중에는 기존 데이터를 유지) */
  showSkeleton: Ref<boolean>;
  isLoading: Ref<boolean>;
  run: (...args: A) => Promise<T | undefined>;
}

/**
 * loading / error / success 상태를 표준화한다.
 * 늦게 도착한 이전 요청의 응답은 버린다.
 */
export function useAsync<T, A extends unknown[] = []>(
  fn: (...args: A) => Promise<T>,
): UseAsyncReturn<T, A> {
  const data = shallowRef<T | undefined>(undefined);
  const error = ref<AppError | null>(null) as Ref<AppError | null>;
  const status = ref<AsyncStatus>('idle');
  const skeletonVisible = ref(false);
  let callId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  async function run(...args: A): Promise<T | undefined> {
    const id = ++callId;
    status.value = 'loading';
    error.value = null;
    clearTimer();
    if (data.value === undefined) {
      timer = setTimeout(() => {
        if (id === callId && status.value === 'loading') skeletonVisible.value = true;
      }, SKELETON_DELAY_MS);
    }
    try {
      const result = await fn(...args);
      if (id !== callId) return undefined;
      data.value = result;
      status.value = 'success';
      return result;
    } catch (e) {
      if (id !== callId) return undefined;
      error.value = toAppError(e);
      status.value = 'error';
      return undefined;
    } finally {
      if (id === callId) {
        clearTimer();
        skeletonVisible.value = false;
      }
    }
  }

  onScopeDispose(clearTimer);

  return {
    data,
    error,
    status,
    showSkeleton: computed(() => skeletonVisible.value),
    isLoading: computed(() => status.value === 'loading'),
    run,
  };
}
