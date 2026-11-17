<script setup lang="ts" generic="T extends string | number">
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';
import { Check, ChevronDown } from 'lucide-vue-next';
import { cn } from '@/utils/cn';
import { controlClass } from './variants';

export interface SelectOption<V> {
  value: V;
  label: string;
  /** 라벨 옆 보조 정보 (예: 마스킹한 전화번호) */
  hint?: string;
  disabled?: boolean;
}

const model = defineModel<T | undefined>();

const props = defineProps<{
  options: SelectOption<T>[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedby?: string;
  /** 보이는 라벨이 없을 때의 접근 가능한 이름 */
  ariaLabel?: string;
  /**
   * 항상 아래로 연다. 선택지가 많아(예: 30분 단위 시각 48개) 아래 공간에 다 들어가지 않으면
   * 기본 동작은 위로 뒤집히는데, 시간처럼 위→아래로 읽는 목록은 아래로 열고 목록 안에서 스크롤하게 한다.
   */
  openBelow?: boolean;
  /** 트리거 버튼에 붙는 클래스 (너비 등) */
  class?: HTMLAttributes['class'];
}>();

const selected = computed(() => props.options.find((o) => o.value === model.value));
</script>

<template>
  <SelectRoot v-model="model" :disabled="props.disabled">
    <SelectTrigger
      :id="props.id"
      :class="
        cn(
          controlClass,
          'flex items-center justify-between gap-2 text-left data-placeholder:text-fg-muted',
          props.class,
        )
      "
      :aria-invalid="props.invalid || undefined"
      :aria-describedby="props.describedby"
      :aria-label="props.ariaLabel"
    >
      <SelectValue :placeholder="props.placeholder" class="flex min-w-0 items-center gap-2">
        <!-- 고른 뒤에도 보조 정보(예: 번호 뒷자리)를 보여 동명이인을 구분할 수 있게 한다 -->
        <template v-if="selected">
          <span class="truncate">{{ selected.label }}</span>
          <span v-if="selected.hint" class="shrink-0 text-caption text-fg-subtle tabular-nums">
            {{ selected.hint }}
          </span>
        </template>
        <template v-else>{{ props.placeholder }}</template>
      </SelectValue>
      <SelectIcon as-child>
        <ChevronDown class="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        side="bottom"
        :avoid-collisions="!props.openBelow"
        :side-offset="4"
        class="z-50 max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) overflow-hidden rounded-lg bg-surface shadow-overlay data-[state=open]:animate-fade-in"
      >
        <SelectViewport :class="cn('p-1.5', props.openBelow && 'max-h-64')">
          <SelectItem
            v-for="option in props.options"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
            :text-value="option.label"
            class="relative flex h-9 cursor-default items-center gap-2 rounded-sm pr-3 pl-8 text-body outline-none select-none data-disabled:text-fg-muted data-disabled:opacity-60 data-highlighted:bg-sunken"
          >
            <SelectItemIndicator class="absolute left-2 inline-flex items-center">
              <Check class="size-4 text-accent" aria-hidden="true" />
            </SelectItemIndicator>
            <SelectItemText>{{ option.label }}</SelectItemText>
            <span v-if="option.hint" class="ml-auto text-caption text-fg-muted tabular-nums">
              {{ option.hint }}
            </span>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
