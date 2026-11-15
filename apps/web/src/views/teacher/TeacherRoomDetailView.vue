<script setup lang="ts">
import PageShell from '@/components/layout/PageShell.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

defineProps<{ id: number }>();
</script>

<template>
  <PageShell title="자습실 상세">
    <!-- #16에서 구현 -->
    <EmptyState title="화면을 준비하고 있어요" />
  </PageShell>
</template>
