<script setup lang="ts">
import { computed, type Component } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ArrowLeftRight, CalendarCheck, DoorOpen, Users } from 'lucide-vue-next';
import { useSessionStore } from '@/stores/session';

interface NavItem {
  to: string;
  label: string;
  icon: Component;
  /** 메뉴 옆 개수 배지 (예: 학생의 유효 신청 수) */
  count?: number;
  /** 확인이 필요한 일이 있다는 점 표시 (예: 자리 제안, #36) */
  attention?: number;
}

const props = defineProps<{
  /** 학생의 유효 신청 수 — "내 신청" 메뉴에 배지로 붙는다 */
  activeVisitCount?: number;
  /** 학생이 받은 자리 제안 수 — "내 신청" 메뉴에 점으로 표시 */
  offerCount?: number;
}>();

const session = useSessionStore();
const route = useRoute();
/** 역할을 고르는 중에는 이전 역할의 메뉴·이름을 보이지 않는다 (어느 역할인지 헷갈리지 않게) */
const choosingRole = computed(() => route.name === 'role-select');

const nav = computed<NavItem[]>(() => {
  if (choosingRole.value) return [];
  if (session.isTeacher) {
    return [
      { to: '/teacher/rooms', label: '자습실', icon: DoorOpen },
      { to: '/teacher/students', label: '학생', icon: Users },
    ];
  }
  if (session.isStudent) {
    return [
      { to: '/student/rooms', label: '자습실', icon: DoorOpen },
      {
        to: '/student/visits',
        label: '내 신청',
        icon: CalendarCheck,
        count: props.activeVisitCount,
        attention: props.offerCount,
      },
    ];
  }
  return [];
});

const who = computed(() => {
  if (choosingRole.value) return '';
  return session.isTeacher ? '강사' : (session.student?.name ?? '');
});
const home = computed(() => nav.value[0]?.to ?? '/');
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-line bg-surface">
    <div class="mx-auto flex h-14 max-w-content items-center gap-2 px-4 sm:gap-6 sm:px-6">
      <RouterLink :to="home" class="shrink-0 text-label font-semibold whitespace-nowrap">
        자습실 예약
      </RouterLink>

      <nav v-if="nav.length" aria-label="주 메뉴" class="flex h-full items-stretch gap-1">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="relative inline-flex items-center gap-1.5 px-2 text-label whitespace-nowrap text-fg-muted transition-colors duration-120 ease-standard hover:text-fg aria-[current=page]:text-fg aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-fg sm:px-3"
        >
          <component :is="item.icon" class="size-4 sm:hidden" aria-hidden="true" />
          {{ item.label }}
          <span
            v-if="item.count"
            class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-caption font-medium text-accent-fg tabular-nums"
          >
            <span class="sr-only">예정 방문</span>{{ item.count }}<span class="sr-only">건</span>
          </span>
          <span
            v-if="item.attention"
            class="size-2 rounded-full bg-status-warn"
            data-testid="nav-attention"
          >
            <span class="sr-only">자리 제안 {{ item.attention }}건</span>
          </span>
        </RouterLink>
      </nav>

      <div v-if="who" class="ml-auto flex shrink-0 items-center gap-2 text-label">
        <span class="hidden max-w-32 truncate sm:inline">{{ who }}</span>
        <span class="hidden text-line-strong sm:inline" aria-hidden="true">·</span>
        <!-- 640px 미만에서는 아이콘만 보여 메뉴 라벨이 줄바꿈되지 않게 한다 -->
        <RouterLink
          to="/"
          class="inline-flex size-9 items-center justify-center rounded-md text-fg-muted hover:bg-sunken hover:text-fg sm:size-auto sm:rounded-none sm:underline-offset-4 sm:hover:bg-transparent sm:hover:underline"
          :aria-label="`${who}(으)로 보는 중. 역할 바꾸기`"
        >
          <ArrowLeftRight class="size-4 sm:hidden" aria-hidden="true" />
          <span class="hidden whitespace-nowrap sm:inline">역할 바꾸기</span>
        </RouterLink>
      </div>
    </div>
  </header>
</template>
