import { readonly, ref } from 'vue';

export type ToastTone = 'success' | 'error';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const toasts = ref<ToastItem[]>([]);
let nextId = 1;

/** 전역 토스트 1개 채널. 렌더링은 AppToaster가 맡는다. */
export function useToast() {
  function show(message: string, tone: ToastTone = 'success') {
    toasts.value = [...toasts.value, { id: nextId++, tone, message }];
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts: readonly(toasts),
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    dismiss,
  };
}
