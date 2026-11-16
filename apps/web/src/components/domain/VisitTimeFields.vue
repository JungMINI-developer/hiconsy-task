<script setup lang="ts">
import type { VisitTimePicker } from '@/composables/useVisitTimePicker';
import { formatTimeRange } from '@/utils/datetime';
import AppSelect from '@/components/ui/AppSelect.vue';
import FormField from '@/components/ui/FormField.vue';

/**
 * 방문 날짜·시각 입력 (`useVisitTimePicker`의 값을 그린다).
 * - stacked: 시간 변경 모달 — 날짜·방문 시간을 위아래로
 * - bar: 학생 자습실 페이지의 얇은 헤더 — 한 줄(좁으면 두 줄)
 * 고를 수 있는 날짜가 하루뿐이면 드롭다운 대신 그 날짜를 글자로 보여준다 (#26).
 */
const props = withDefaults(
  defineProps<{
    picker: VisitTimePicker;
    layout?: 'stacked' | 'bar';
  }>(),
  { layout: 'stacked' },
);

// 템플릿에서 v-model로 쓰려고 ref를 그대로 꺼낸다
const { date, start, end } = props.picker;
</script>

<template>
  <div v-if="layout === 'bar'" class="flex flex-wrap items-center gap-x-3 gap-y-2">
    <AppSelect
      v-if="picker.dateOptions.value.length > 1"
      v-model="date"
      :options="picker.dateOptions.value"
      aria-label="방문 날짜"
      open-below
      class="w-36"
    />
    <p v-else class="text-label tabular-nums">
      <span class="sr-only">방문 날짜 </span>{{ picker.dateOptions.value[0]?.label }}
    </p>
    <div class="flex items-center gap-2">
      <AppSelect
        v-model="start"
        :options="picker.startOptions.value"
        aria-label="방문 시작 시각"
        open-below
        class="w-28"
      />
      <span class="text-fg-muted" aria-hidden="true">–</span>
      <AppSelect
        v-model="end"
        :options="picker.endOptions.value"
        aria-label="방문 종료 시각"
        open-below
        class="w-28"
      />
    </div>
    <span v-if="picker.duration.value" class="text-caption text-fg-muted">
      {{ picker.duration.value }}
    </span>
  </div>

  <div v-else class="flex flex-col gap-5">
    <FormField
      v-if="picker.dateOptions.value.length > 1"
      id="visit-date"
      v-slot="{ id }"
      label="날짜"
    >
      <AppSelect :id="id" v-model="date" :options="picker.dateOptions.value" />
    </FormField>
    <div v-else class="flex flex-col gap-1.5">
      <p class="text-label">날짜</p>
      <p class="text-body tabular-nums">{{ picker.dateOptions.value[0]?.label }}</p>
    </div>

    <fieldset class="flex flex-col gap-1.5">
      <legend class="mb-1.5 text-label">방문 시간</legend>
      <div class="flex items-center gap-2">
        <AppSelect
          v-model="start"
          :options="picker.startOptions.value"
          aria-label="방문 시작 시각"
          open-below
          class="flex-1"
        />
        <span class="text-fg-muted" aria-hidden="true">–</span>
        <AppSelect
          v-model="end"
          :options="picker.endOptions.value"
          aria-label="방문 종료 시각"
          open-below
          class="flex-1"
        />
      </div>
      <p class="text-caption text-fg-muted">
        <span v-if="picker.duration.value" class="font-semibold text-fg">
          {{ picker.duration.value }}
        </span>
        <span v-if="picker.duration.value" aria-hidden="true"> · </span>
        30분 단위로, 운영 기간 안에서만 고를 수 있어요
      </p>
      <p v-if="picker.busy.value.length > 0" class="text-caption text-fg-muted">
        내 다른 신청과 겹치는 시간은 고를 수 없어요
      </p>
    </fieldset>
  </div>

  <p v-if="picker.conflict.value" class="text-caption text-status-danger" role="alert">
    {{ picker.conflict.value.label }} 신청({{
      formatTimeRange(picker.conflict.value.startAt, picker.conflict.value.endAt)
    }})과 겹쳐요
  </p>
</template>
