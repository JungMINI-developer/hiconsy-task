<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next';

/** 폼·다이얼로그 상단의 에러 안내. 나타나면 스크린 리더가 바로 읽는다. */
defineProps<{ message: string }>();
</script>

<template>
  <div
    role="alert"
    class="flex gap-2 rounded-md border border-status-danger/30 bg-status-danger/5 p-3 text-body"
  >
    <CircleAlert class="mt-0.5 size-4 shrink-0 text-status-danger" aria-hidden="true" />
    <div class="min-w-0">
      <p>{{ message }}</p>
      <slot />
    </div>
  </div>
</template>
