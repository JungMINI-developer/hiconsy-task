<script setup lang="ts">
import { computed, useId } from 'vue';

/**
 * label + 컨트롤 + hint/error. id를 자동으로 만들어 슬롯에 넘긴다.
 * 컨트롤은 `:id`, `:aria-describedby`, `:aria-invalid`를 슬롯 props로 받아 연결한다.
 */
const props = defineProps<{
  label: string;
  /** 컨트롤 id를 직접 정할 때 (포커스 이동 대상 등). 없으면 자동 생성 */
  id?: string;
  hint?: string;
  error?: string | null;
  /** 라벨 옆 "(선택)" 표시 */
  optional?: boolean;
}>();

const autoId = useId();
const id = props.id ?? autoId;
const hintId = `${id}-hint`;
const errorId = `${id}-error`;

const describedby = computed(
  () =>
    [props.error ? errorId : null, props.hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined,
);
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-label">
      {{ label }}
      <span v-if="optional" class="font-normal text-fg-muted">(선택)</span>
    </label>
    <slot :id="id" :describedby="describedby" :invalid="!!error" />
    <p v-if="error" :id="errorId" class="text-caption text-status-danger">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" class="text-caption text-fg-muted">{{ hint }}</p>
  </div>
</template>
