<script setup lang="ts">
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui';
import { cn } from '@/utils/cn';
import { buttonVariants } from './variants';
import AppButton from './AppButton.vue';

/**
 * 되돌릴 수 없는 액션 확인 (interaction-rules.md#확인-다이얼로그).
 * 기본 포커스는 안전한 쪽(닫기). 확인 처리 중에는 다이얼로그를 유지한다.
 */
const open = defineModel<boolean>('open', { required: true });

withDefaults(
  defineProps<{
    title: string;
    description: string;
    confirmLabel: string;
    loading?: boolean;
    tone?: 'danger' | 'primary';
  }>(),
  { tone: 'danger' },
);

const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay
        class="fixed inset-0 z-40 bg-fg/30 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <AlertDialogContent
        class="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-dialog -translate-y-1/2 rounded-xl bg-surface p-6 shadow-overlay focus:outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-dialog-in"
      >
        <AlertDialogTitle class="text-heading">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-body text-fg-muted">
          {{ description }}
        </AlertDialogDescription>
        <div class="mt-6 flex gap-2">
          <AlertDialogCancel
            :class="cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'flex-1')"
          >
            닫기
          </AlertDialogCancel>
          <!-- AlertDialogAction은 누르면 바로 닫히므로, 처리 중 유지를 위해 일반 버튼으로 둔다 -->
          <AppButton
            :variant="tone"
            size="lg"
            class="flex-1"
            :loading="loading"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </AppButton>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
