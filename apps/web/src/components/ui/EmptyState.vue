<script setup lang="ts">
/** 빈 상태: 이유 + 다음 행동 1개 (screens.md 상태 규칙) */
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center gap-1 rounded-xl bg-surface px-6 py-12 text-center">
    <p class="text-body font-medium">{{ title }}</p>
    <p v-if="description" class="text-caption text-fg-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
