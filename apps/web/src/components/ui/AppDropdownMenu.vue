<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui';
import { Ellipsis } from 'lucide-vue-next';
import { cn } from '@/utils/cn';
import { buttonVariants } from './variants';

export interface MenuItem {
  key: string;
  label: string;
  danger?: boolean;
}

defineProps<{
  items: MenuItem[];
  /** 트리거 버튼의 접근 가능한 이름 (예: "3층 A 자습실 메뉴") */
  label: string;
}>();

const emit = defineEmits<{ select: [key: string] }>();
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger
      :aria-label="label"
      :class="cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-fg-muted')"
    >
      <Ellipsis class="size-5" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="4"
        class="z-50 min-w-32 rounded-md border border-line bg-surface p-1 shadow-overlay data-[state=open]:animate-fade-in"
      >
        <DropdownMenuItem
          v-for="item in items"
          :key="item.key"
          :class="
            cn(
              'flex h-9 cursor-default items-center rounded-sm px-3 text-body outline-none select-none data-highlighted:bg-sunken',
              item.danger && 'text-status-danger',
            )
          "
          @select="emit('select', item.key)"
        >
          {{ item.label }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
