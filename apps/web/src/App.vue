<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppToaster from '@/components/ui/AppToaster.vue';
import { useMyVisitsStore } from '@/stores/myVisits';
import { useMyWaitlistStore } from '@/stores/myWaitlist';
import { useSessionStore } from '@/stores/session';

const session = useSessionStore();
const myVisits = useMyVisitsStore();
const myWaitlist = useMyWaitlistStore();
</script>

<template>
  <a
    href="#content"
    class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-overlay"
  >
    본문으로 건너뛰기
  </a>
  <AppHeader
    :active-visit-count="session.isStudent ? myVisits.upcomingCount : undefined"
    :offer-count="session.isStudent ? myWaitlist.offers.length : undefined"
  />
  <div id="content">
    <RouterView />
  </div>
  <AppToaster />
</template>
