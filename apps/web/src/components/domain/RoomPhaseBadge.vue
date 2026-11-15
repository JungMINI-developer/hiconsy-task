<script setup lang="ts">
import type { RoomPhase } from '@/utils/datetime';
import AppBadge from '@/components/ui/AppBadge.vue';

defineProps<{ phase: RoomPhase }>();

const META = {
  open: { tone: 'open', label: '운영 중' },
  upcoming: { tone: 'neutral', label: '예정' },
  ended: { tone: 'ended', label: '종료' },
} as const;
</script>

<template>
  <AppBadge :tone="META[phase].tone">{{ META[phase].label }}</AppBadge>
</template>
