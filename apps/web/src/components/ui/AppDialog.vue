<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui';
import { useTemplateRef } from 'vue';
import { X } from 'lucide-vue-next';

const open = defineModel<boolean>('open', { required: true });

defineProps<{
  title: string;
  description?: string;
}>();

const body = useTemplateRef<HTMLElement>('body');

/** 열리면 본문의 첫 입력으로 포커스 (없으면 Reka 기본 동작: 첫 포커스 가능 요소) */
function focusFirstField(event: Event) {
  const field = body.value?.querySelector<HTMLElement>(
    'input:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled])',
  );
  if (!field) return;
  event.preventDefault();
  field.focus();
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-40 bg-fg/30 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <DialogContent
        class="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-dialog-h max-w-dialog -translate-y-1/2 flex-col rounded-xl bg-surface shadow-overlay focus:outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-dialog-in"
        @open-auto-focus="focusFirstField"
      >
        <header class="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <DialogTitle class="text-heading">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-caption text-fg-muted">
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose
            class="-mt-1 -mr-2 inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-sunken hover:text-fg"
            aria-label="닫기"
          >
            <X class="size-4" aria-hidden="true" />
          </DialogClose>
        </header>
        <div ref="body" class="overflow-y-auto px-6 pb-6">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
