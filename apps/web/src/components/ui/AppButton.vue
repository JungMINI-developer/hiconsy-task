<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { LoaderCircle } from 'lucide-vue-next';
import { cn } from '@/utils/cn';
import { buttonVariants, type ButtonVariants } from './variants';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant'];
    size?: ButtonVariants['size'];
    type?: 'button' | 'submit' | 'reset';
    /** 응답 대기 중: 스피너 + 비활성 (라벨은 유지해 폭이 바뀌지 않게) */
    loading?: boolean;
    disabled?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  { type: 'button' },
);
</script>

<template>
  <button
    :type="props.type"
    :class="cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)"
    :disabled="props.disabled || props.loading"
    :aria-busy="props.loading || undefined"
  >
    <LoaderCircle v-if="props.loading" class="size-4 animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
