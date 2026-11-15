<script setup lang="ts">
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastViewport } from 'reka-ui';
import { CircleAlert, CircleCheck, X } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';

/** 전역 토스트. App.vue에 하나만 둔다. 에러는 assertive로 알린다. */
const { toasts, dismiss } = useToast();
</script>

<template>
  <ToastProvider label="알림" :duration="4000" swipe-direction="right">
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      :type="toast.tone === 'error' ? 'foreground' : 'background'"
      class="flex items-start gap-3 rounded-md border border-line bg-surface p-3 pr-2 shadow-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-dialog-in data-[swipe=end]:animate-fade-out"
      @update:open="(open: boolean) => !open && dismiss(toast.id)"
    >
      <CircleCheck
        v-if="toast.tone === 'success'"
        class="mt-0.5 size-5 shrink-0 text-status-open"
        aria-hidden="true"
      />
      <CircleAlert v-else class="mt-0.5 size-5 shrink-0 text-status-danger" aria-hidden="true" />
      <ToastDescription class="flex-1 text-body">{{ toast.message }}</ToastDescription>
      <ToastClose
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-sunken hover:text-fg"
        aria-label="알림 닫기"
      >
        <X class="size-4" aria-hidden="true" />
      </ToastClose>
    </ToastRoot>
    <ToastViewport
      class="fixed right-0 bottom-0 z-50 m-0 flex w-full max-w-sm list-none flex-col gap-2 p-4 outline-none"
    />
  </ToastProvider>
</template>
