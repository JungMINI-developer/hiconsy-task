<script setup lang="ts">
/**
 * 화면 공통 틀: 제목(h1) + 설명 + 우측 액션 + 본문.
 * h1은 라우트 이동 시 포커스를 받는다 (tabindex=-1, router afterEach).
 */
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <main class="mx-auto w-full max-w-content px-4 pt-8 pb-16 sm:px-6">
    <slot name="back" />
    <div class="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div class="min-w-0">
        <h1 tabindex="-1" data-page-title class="text-title focus:outline-none">
          <slot name="title">{{ title }}</slot>
        </h1>
        <p v-if="description || $slots.description" class="mt-1 text-body text-fg-muted">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </main>
</template>
