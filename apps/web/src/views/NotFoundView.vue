<script setup lang="ts">
import { RouterLink } from 'vue-router';
import PageShell from '@/components/layout/PageShell.vue';
import { buttonVariants } from '@/components/ui/variants';
</script>

<template>
  <PageShell title="페이지를 찾을 수 없어요" description="주소가 바뀌었거나 없는 페이지예요.">
    <RouterLink to="/" :class="buttonVariants({ variant: 'secondary' })">처음으로</RouterLink>
  </PageShell>
</template>
