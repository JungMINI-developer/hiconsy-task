import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * 화면 진입 시 + 창이 다시 보일 때 재조회한다 (interaction-rules.md#데이터-최신화).
 */
export function useRefetchOnVisible(refetch: () => unknown) {
  const onVisible = () => {
    if (document.visibilityState === 'visible') void refetch();
  };
  onMounted(() => {
    void refetch();
    document.addEventListener('visibilitychange', onVisible);
  });
  onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible));
}

/** 방금 바뀐 항목을 잠깐 강조한다 (1.2s, design-system 모션) */
export function useHighlight(durationMs = 1200) {
  const highlightedId = ref<number | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  function highlight(id: number) {
    highlightedId.value = id;
    clearTimeout(timer);
    timer = setTimeout(() => (highlightedId.value = null), durationMs);
  }
  onBeforeUnmount(() => clearTimeout(timer));
  return { highlightedId, highlight };
}

/** 바뀐 항목을 화면 안으로 스크롤한다 (목록 끝에 추가되어 보이지 않는 경우) */
export function scrollToItem(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}
