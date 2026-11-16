<script setup lang="ts">
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastViewport } from 'reka-ui';
import { CircleAlert, CircleCheck, X } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';

/**
 * 전역 토스트. App.vue에 하나만 둔다. 에러는 assertive로 알린다.
 * 화면 가운데 아래에 쌓이며(새 알림이 아래), 여러 개가 와도 모두 보인다.
 */
const { toasts, dismiss } = useToast();
</script>

<template>
  <ToastProvider label="알림" :duration="4000" swipe-direction="down">
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      :type="toast.tone === 'error' ? 'foreground' : 'background'"
      class="flex w-full items-start gap-3 rounded-lg bg-grey-800 p-3.5 pr-2 text-white shadow-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-dialog-in data-[swipe=end]:animate-fade-out"
      @update:open="(open: boolean) => !open && dismiss(toast.id)"
    >
      <CircleCheck
        v-if="toast.tone === 'success'"
        class="mt-0.5 size-5 shrink-0 text-green-500"
        aria-hidden="true"
      />
      <CircleAlert v-else class="mt-0.5 size-5 shrink-0 text-red-50" aria-hidden="true" />
      <ToastDescription class="flex-1 text-body">{{ toast.message }}</ToastDescription>
      <ToastClose
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-grey-400 hover:bg-grey-700 hover:text-white"
        aria-label="알림 닫기"
      >
        <X class="size-4" aria-hidden="true" />
      </ToastClose>
    </ToastRoot>
    <!-- 기본 이름이 영어(Notifications (F8))라 스크린 리더용으로 한국어 이름을 준다 -->
    <ToastViewport
      label="알림 ({hotkey})"
      class="fixed inset-x-0 bottom-[var(--toast-offset,0px)] z-50 mx-auto my-0 flex w-full max-w-lg list-none flex-col items-center gap-2 p-4 outline-none sm:pb-6"
    />
  </ToastProvider>
</template>
