<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/utils/cn';
import { badgeVariants, type BadgeVariants } from './variants';

const props = defineProps<{
  tone?: BadgeVariants['tone'];
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <span :class="cn(badgeVariants({ tone: props.tone }), props.class)"><slot /></span>
</template>
