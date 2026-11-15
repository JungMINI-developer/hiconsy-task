<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next';
import AppButton from './AppButton.vue';

/** 실패한 영역에만 표시: 무엇이 실패했는지 + [다시 시도] */
defineProps<{
  title: string;
  description?: string;
  retrying?: boolean;
}>();

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    role="alert"
    class="flex flex-col items-center gap-1 rounded-lg border border-line bg-surface px-6 py-10 text-center"
  >
    <CircleAlert class="mb-1 size-5 text-status-danger" aria-hidden="true" />
    <p class="text-body font-medium">{{ title }}</p>
    <p v-if="description" class="text-caption text-fg-muted">{{ description }}</p>
    <div class="mt-4 flex gap-2">
      <slot>
        <AppButton variant="secondary" :loading="retrying" @click="emit('retry')">
          다시 시도
        </AppButton>
      </slot>
    </div>
  </div>
</template>
