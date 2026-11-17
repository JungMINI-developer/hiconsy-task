<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/utils/cn';
import { controlClass } from './variants';

const model = defineModel<string | number>();

const props = defineProps<{
  class?: HTMLAttributes['class'];
  invalid?: boolean;
}>();
</script>

<template>
  <input
    v-model="model"
    :class="cn(controlClass, props.class)"
    :aria-invalid="props.invalid || undefined"
  />
</template>
