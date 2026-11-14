<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { HealthStatus } from '@hiconsy/shared';
import { fetchHealth } from '@/api/client';

const health = ref<HealthStatus | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    health.value = await fetchHealth();
  } catch {
    error.value = 'API 서버에 연결할 수 없습니다.';
  }
});
</script>

<template>
  <main>
    <h1>Hiconsy Task</h1>
    <p v-if="health">API: {{ health.status }} / DB: {{ health.database }}</p>
    <p v-else-if="error">{{ error }}</p>
    <p v-else>API 상태 확인 중...</p>
  </main>
</template>
