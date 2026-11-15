<script setup lang="ts" generic="T extends string">
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui';

export interface TabItem<V> {
  value: V;
  label: string;
  /** 탭 옆 개수 (없으면 표시하지 않음) */
  count?: number;
}

/**
 * 목록 필터·상세 탭. 탭 내용은 슬롯 하나로 렌더링하고
 * 현재 값에 따라 화면이 내용을 바꾼다 (TabsContent를 탭마다 두지 않음).
 */
const model = defineModel<T>({ required: true });

defineProps<{
  items: TabItem<T>[];
  label: string;
}>();
</script>

<template>
  <TabsRoot v-model="model" :unmount-on-hide="false">
    <TabsList :aria-label="label" class="flex gap-1 border-b border-line">
      <TabsTrigger
        v-for="item in items"
        :key="item.value"
        :value="item.value"
        class="-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 text-label text-fg-muted transition-colors duration-120 ease-standard hover:text-fg data-[state=active]:border-fg data-[state=active]:text-fg"
      >
        {{ item.label }}
        <span v-if="item.count !== undefined" class="text-caption tabular-nums">
          {{ item.count }}
        </span>
      </TabsTrigger>
    </TabsList>
    <slot />
  </TabsRoot>
</template>
