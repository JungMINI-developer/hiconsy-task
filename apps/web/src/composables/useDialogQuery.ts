import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/**
 * 다이얼로그 열림 상태를 URL 쿼리와 동기화한다 (`?new=1`, `?edit=3`).
 * 새로고침·뒤로가기에도 유지된다. 열 때는 기록을 남기고(push) 닫을 때는 되돌린다(replace).
 */
export function useDialogQuery(key: string) {
  const route = useRoute();
  const router = useRouter();

  const value = computed(() => {
    const raw = route.query[key];
    return typeof raw === 'string' && raw ? raw : null;
  });

  function open(v: string | number = '1') {
    void router.push({ query: { ...route.query, [key]: String(v) } });
  }

  function close() {
    if (value.value === null) return;
    const query = { ...route.query };
    delete query[key];
    void router.replace({ query });
  }

  /** v-model:open에 바로 연결할 수 있는 boolean */
  const isOpen = computed({
    get: () => value.value !== null,
    set: (next: boolean) => (next ? open() : close()),
  });

  return { value, isOpen, open, close };
}
