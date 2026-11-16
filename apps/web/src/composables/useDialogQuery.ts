import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/**
 * 다이얼로그 열림 상태를 URL 쿼리와 동기화한다 (`?new=1`, `?edit=3`).
 * 새로고침·뒤로가기에도 유지된다. 열 때는 기록을 남기고(push) 닫을 때는 되돌린다(replace).
 *
 * @param options.clear 닫을 때 함께 지울 쿼리 (예: 신청 다이얼로그의 미리 고른 시간 `slot`)
 */
export function useDialogQuery(key: string, options: { clear?: string[] } = {}) {
  const route = useRoute();
  const router = useRouter();

  const value = computed(() => {
    const raw = route.query[key];
    return typeof raw === 'string' && raw ? raw : null;
  });

  /** @param extra 함께 넣을 쿼리 (예: 미리 고른 시간 `{ slot }`) */
  function open(v: string | number = '1', extra: Record<string, string> = {}) {
    void router.push({ query: { ...route.query, [key]: String(v), ...extra } });
  }

  function close() {
    if (value.value === null) return;
    const query = { ...route.query };
    for (const k of [key, ...(options.clear ?? [])]) delete query[k];
    void router.replace({ query });
  }

  /** v-model:open에 바로 연결할 수 있는 boolean */
  const isOpen = computed({
    get: () => value.value !== null,
    set: (next: boolean) => (next ? open() : close()),
  });

  return { value, isOpen, open, close };
}
