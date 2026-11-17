<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ErrorCode, type StudyRoom } from '@hiconsy/shared';
import { studyRoomsApi } from '@/api/studyRooms';
import { AppError } from '@/api/client';
import {
  combineDateTime,
  halfHourSlots,
  shiftEndWithStart,
  toDateInputValue,
  toIsoWithOffset,
  toTimeValue,
} from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import {
  hasErrors,
  removedSeatsText,
  ROOM_CAPACITY_MAX,
  ROOM_NAME_MAX,
  validateStudyRoomForm,
  type StudyRoomFormErrors,
  type StudyRoomFormValues,
} from '@/utils/validation';
import AppAlert from '@/components/ui/AppAlert.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppNumberField from '@/components/ui/AppNumberField.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import FormField from '@/components/ui/FormField.vue';

/** S-12 자습실 등록·수정 다이얼로그. `room`이 있으면 수정 모드 */
const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{ room?: StudyRoom | null }>();

const emit = defineEmits<{
  saved: [room: StudyRoom, mode: 'create' | 'edit'];
  /** 수정 중인 자습실이 이미 삭제됨 */
  gone: [];
}>();

const isEdit = computed(() => !!props.room);
const timeOptions = halfHourSlots().map((t) => ({ value: t, label: t }));

function initialValues(): StudyRoomFormValues {
  if (props.room) {
    return {
      name: props.room.name,
      maxPersonnel: props.room.maxPersonnel,
      startDate: toDateInputValue(props.room.startDate),
      startTime: toTimeValue(props.room.startDate),
      endDate: toDateInputValue(props.room.endDate),
      endTime: toTimeValue(props.room.endDate),
    };
  }
  // 기본값: 내일 18:00 – 22:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = toDateInputValue(tomorrow);
  return {
    name: '',
    maxPersonnel: 10,
    startDate: day,
    startTime: '18:00',
    endDate: day,
    endTime: '22:00',
  };
}

const values = reactive<StudyRoomFormValues>(initialValues());
const touched = reactive<Record<keyof StudyRoomFormErrors, boolean>>({
  name: false,
  maxPersonnel: false,
  start: false,
  end: false,
});
const submitted = ref(false);
const saving = ref(false);
const serverFieldErrors = ref<StudyRoomFormErrors>({});
const formError = ref<{ message: string; showApplicantsLink?: boolean } | null>(null);

// 열릴 때마다 초기화 (다른 자습실을 이어서 수정하는 경우 포함)
watch(
  () => [open.value, props.room?.id] as const,
  ([isOpen]) => {
    if (!isOpen) return;
    Object.assign(values, initialValues());
    Object.keys(touched).forEach((k) => (touched[k as keyof typeof touched] = false));
    submitted.value = false;
    serverFieldErrors.value = {};
    formError.value = null;
  },
  { immediate: true },
);

// 입력을 고치면 그 필드의 서버 에러는 지운다
watch(
  () => ({ ...values }),
  () => {
    serverFieldErrors.value = {};
  },
);

/**
 * 운영 시작을 바꾸면 종료도 같은 간격만큼 옮긴다.
 * (시작 날짜만 미루고 종료를 잊어 "종료가 시작보다 앞서는" 실수를 막는다)
 */
function moveStart(next: { date?: string; time?: string }) {
  const prevStart = combineDateTime(values.startDate, values.startTime);
  if (next.date !== undefined) values.startDate = next.date;
  if (next.time !== undefined) {
    values.startTime = next.time;
    touched.start = true;
  }
  const nextStart = combineDateTime(values.startDate, values.startTime);
  const end = combineDateTime(values.endDate, values.endTime);
  if (!prevStart || !nextStart || !end) return;
  const shifted = shiftEndWithStart(prevStart, nextStart, end);
  if (!shifted) return;
  values.endDate = toDateInputValue(shifted);
  values.endTime = toTimeValue(shifted);
}

const clientErrors = computed(() => validateStudyRoomForm(values));

/** 최대 인원 = 좌석 수. 수정에서 줄이면 없어질 좌석을 미리 알린다 (막지는 않음, 서버가 판단) */
const capacityHint = computed(() => {
  const removed = props.room
    ? removedSeatsText(props.room.maxPersonnel, values.maxPersonnel)
    : null;
  return removed ?? `좌석 수예요. 한 줄 5석으로 배치돼요 (1~${ROOM_CAPACITY_MAX}석)`;
});

/** blur 이후부터 보여주고, 한 번 보이면 고칠 때마다 다시 검사한다 (정원은 입력 즉시) */
function fieldError(field: keyof StudyRoomFormErrors): string | undefined {
  const visible = submitted.value || touched[field] || field === 'maxPersonnel';
  return serverFieldErrors.value[field] ?? (visible ? clientErrors.value[field] : undefined);
}

const FIELD_IDS: Record<keyof StudyRoomFormErrors, string> = {
  name: 'room-name',
  maxPersonnel: 'room-max',
  start: 'room-start-date',
  end: 'room-end-date',
};

function focusFirstError(errors: StudyRoomFormErrors) {
  const first = (Object.keys(FIELD_IDS) as (keyof StudyRoomFormErrors)[]).find((k) => errors[k]);
  if (first) void nextTick(() => document.getElementById(FIELD_IDS[first])?.focus());
}

async function submit() {
  submitted.value = true;
  formError.value = null;
  if (hasErrors(clientErrors.value)) {
    focusFirstError(clientErrors.value);
    return;
  }
  const body = {
    name: values.name.trim(),
    maxPersonnel: values.maxPersonnel!,
    startDate: toIsoWithOffset(combineDateTime(values.startDate, values.startTime)!),
    endDate: toIsoWithOffset(combineDateTime(values.endDate, values.endTime)!),
  };
  saving.value = true;
  try {
    const saved = props.room
      ? await studyRoomsApi.update(props.room.id, body)
      : await studyRoomsApi.create(body);
    emit('saved', saved, isEdit.value ? 'edit' : 'create');
    open.value = false;
  } catch (e) {
    handleError(e);
  } finally {
    saving.value = false;
  }
}

function handleError(e: unknown) {
  const code = e instanceof AppError ? e.code : null;
  if (code === ErrorCode.SEATS_IN_USE) {
    serverFieldErrors.value = {
      maxPersonnel: `없어질 좌석에 끝나지 않은 예약이 있어 ${values.maxPersonnel}석으로 줄일 수 없어요. 학생과 좌석을 먼저 조율해 주세요`,
    };
    focusFirstError(serverFieldErrors.value);
  } else if (code === ErrorCode.INVALID_PERIOD) {
    serverFieldErrors.value = { end: errorMessage(e) };
    focusFirstError(serverFieldErrors.value);
  } else if (code === ErrorCode.PERIOD_EXCLUDES_VISITS) {
    formError.value = { message: errorMessage(e), showApplicantsLink: true };
  } else if (code === ErrorCode.STUDY_ROOM_NOT_FOUND) {
    open.value = false;
    emit('gone');
  } else {
    formError.value = { message: errorMessage(e) };
  }
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="isEdit ? '자습실 수정' : '새 자습실'"
    :description="isEdit ? undefined : '좌석 수와 운영 기간을 정해 자습실을 열어요'"
  >
    <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
      <AppAlert v-if="formError" :message="formError.message">
        <RouterLink
          v-if="formError.showApplicantsLink && room"
          :to="{ name: 'teacher-room', params: { id: room.id } }"
          class="mt-1 inline-block text-label text-accent underline underline-offset-4"
          @click="open = false"
        >
          신청 학생 보기
        </RouterLink>
      </AppAlert>

      <FormField
        id="room-name"
        v-slot="{ id, describedby, invalid }"
        label="이름"
        :error="fieldError('name')"
      >
        <AppInput
          :id="id"
          v-model="values.name"
          :maxlength="ROOM_NAME_MAX"
          placeholder="예: 3층 A 자습실"
          autocomplete="off"
          :invalid="invalid"
          :aria-describedby="describedby"
          @blur="touched.name = true"
        />
      </FormField>

      <FormField
        id="room-max"
        v-slot="{ id, describedby, invalid }"
        label="최대 인원"
        :hint="capacityHint"
        :error="fieldError('maxPersonnel')"
      >
        <AppNumberField
          :id="id"
          v-model="values.maxPersonnel"
          :min="1"
          :max="ROOM_CAPACITY_MAX"
          unit="석"
          :invalid="invalid"
          :describedby="describedby"
        />
      </FormField>

      <FormField
        id="room-start-date"
        v-slot="{ id, describedby, invalid }"
        label="운영 시작"
        :error="fieldError('start')"
      >
        <div class="flex flex-wrap gap-2">
          <AppInput
            :id="id"
            :model-value="values.startDate"
            type="date"
            class="min-w-40 flex-1"
            :invalid="invalid"
            :aria-describedby="describedby"
            @update:model-value="(v) => moveStart({ date: String(v ?? '') })"
            @blur="touched.start = true"
          />
          <AppSelect
            :model-value="values.startTime"
            :options="timeOptions"
            class="w-28"
            aria-label="운영 시작 시각"
            open-below
            @update:model-value="(v) => moveStart({ time: v })"
          />
        </div>
      </FormField>

      <FormField
        id="room-end-date"
        v-slot="{ id, describedby, invalid }"
        label="운영 종료"
        :error="fieldError('end')"
      >
        <div class="flex flex-wrap gap-2">
          <AppInput
            :id="id"
            v-model="values.endDate"
            type="date"
            :min="values.startDate || undefined"
            class="min-w-40 flex-1"
            :invalid="invalid"
            :aria-describedby="describedby"
            @blur="touched.end = true"
          />
          <AppSelect
            v-model="values.endTime"
            :options="timeOptions"
            class="w-28"
            aria-label="운영 종료 시각"
            open-below
            :invalid="invalid"
            @update:model-value="touched.end = true"
          />
        </div>
      </FormField>

      <div class="mt-2 flex gap-2">
        <AppButton variant="secondary" size="lg" class="flex-1" @click="open = false"
          >닫기</AppButton
        >
        <AppButton type="submit" size="lg" class="flex-1" :loading="saving">저장</AppButton>
      </div>
    </form>
  </AppDialog>
</template>
