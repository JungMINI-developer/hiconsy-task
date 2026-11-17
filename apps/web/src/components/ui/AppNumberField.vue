<script setup lang="ts">
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from 'reka-ui';
import { Minus, Plus } from 'lucide-vue-next';

/** 정수 입력 + −/+ 버튼. 값이 비면 null */
const model = defineModel<number | null>({ required: true });

defineProps<{
  id?: string;
  min?: number;
  max?: number;
  invalid?: boolean;
  describedby?: string;
  /** 단위 (예: "명") */
  unit?: string;
}>();

/**
 * Reka NumberField는 포커스를 벗어날 때(또는 Enter) 값을 확정한다.
 * 정원 검사처럼 입력하는 즉시 안내해야 하므로, 타이핑 중인 값도 숫자면 바로 반영한다.
 */
function onTyping(event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim();
  if (raw === '') model.value = null;
  else if (/^\d+$/.test(raw)) model.value = Number(raw);
}

const stepButton =
  'inline-flex size-11 shrink-0 items-center justify-center text-fg-muted hover:bg-sunken hover:text-fg disabled:cursor-not-allowed disabled:opacity-40';
</script>

<template>
  <div class="flex items-center gap-2">
    <NumberFieldRoot
      :model-value="model ?? undefined"
      :min="min"
      :max="max"
      :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
      class="inline-flex h-11 items-center overflow-hidden rounded-md border border-line-input bg-surface has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus has-[input[aria-invalid=true]]:border-status-danger"
      @update:model-value="(v?: number) => (model = v === undefined || Number.isNaN(v) ? null : v)"
    >
      <NumberFieldDecrement :class="stepButton" aria-label="줄이기">
        <Minus class="size-4" aria-hidden="true" />
      </NumberFieldDecrement>
      <NumberFieldInput
        :id="id"
        inputmode="numeric"
        @input="onTyping"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedby"
        class="h-full w-16 border-x border-line bg-transparent text-center text-body tabular-nums focus:outline-none"
      />
      <NumberFieldIncrement :class="stepButton" aria-label="늘리기">
        <Plus class="size-4" aria-hidden="true" />
      </NumberFieldIncrement>
    </NumberFieldRoot>
    <span v-if="unit" class="text-body text-fg-muted">{{ unit }}</span>
  </div>
</template>
