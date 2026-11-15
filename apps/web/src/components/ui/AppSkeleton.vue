<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/utils/cn';

/** 레이아웃 크기를 유지하는 자리 표시. 크기는 class로 정한다. */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
  <div :class="cn('animate-pulse rounded-md bg-sunken', props.class)" aria-hidden="true" />
</template>
