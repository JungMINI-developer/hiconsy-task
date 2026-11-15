<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { ErrorCode, type Student } from '@hiconsy/shared';
import { studentsApi } from '@/api/students';
import { AppError } from '@/api/client';
import { errorMessage } from '@/utils/errorMessage';
import {
  hasErrors,
  STUDENT_NAME_MAX,
  validateStudentForm,
  type StudentFormErrors,
  type StudentFormValues,
} from '@/utils/validation';
import AppAlert from '@/components/ui/AppAlert.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import AppInput from '@/components/ui/AppInput.vue';
import FormField from '@/components/ui/FormField.vue';

/** 학생 등록·수정 다이얼로그. `student`가 있으면 수정 모드 */
const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{ student?: Student | null }>();

const emit = defineEmits<{
  saved: [student: Student, mode: 'create' | 'edit'];
  gone: [];
}>();

const isEdit = computed(() => !!props.student);

const values = reactive<StudentFormValues>({ name: '', phone: '' });
const touched = reactive({ name: false, phone: false });
const submitted = ref(false);
const saving = ref(false);
const serverErrors = ref<StudentFormErrors>({});
const formError = ref<string | null>(null);

watch(
  () => [open.value, props.student?.id] as const,
  ([isOpen]) => {
    if (!isOpen) return;
    values.name = props.student?.name ?? '';
    values.phone = props.student?.phone ?? '';
    touched.name = touched.phone = false;
    submitted.value = false;
    serverErrors.value = {};
    formError.value = null;
  },
  { immediate: true },
);

watch(
  () => ({ ...values }),
  () => (serverErrors.value = {}),
);

const clientErrors = computed(() => validateStudentForm(values));

function fieldError(field: keyof StudentFormValues) {
  return (
    serverErrors.value[field] ??
    (submitted.value || touched[field] ? clientErrors.value[field] : undefined)
  );
}

function focusField(field: keyof StudentFormValues) {
  void nextTick(() => document.getElementById(`student-${field}`)?.focus());
}

async function submit() {
  submitted.value = true;
  formError.value = null;
  if (hasErrors(clientErrors.value)) {
    focusField(clientErrors.value.name ? 'name' : 'phone');
    return;
  }
  saving.value = true;
  try {
    const body = { name: values.name.trim(), phone: values.phone.trim() };
    const saved = props.student
      ? await studentsApi.update(props.student.id, body)
      : await studentsApi.create(body);
    emit('saved', saved, isEdit.value ? 'edit' : 'create');
    open.value = false;
  } catch (e) {
    const code = e instanceof AppError ? e.code : null;
    if (code === ErrorCode.DUPLICATE_PHONE) {
      serverErrors.value = { phone: errorMessage(e) };
      focusField('phone');
    } else if (code === ErrorCode.STUDENT_NOT_FOUND) {
      open.value = false;
      emit('gone');
    } else {
      formError.value = errorMessage(e);
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="isEdit ? '학생 정보 수정' : '학생 등록'">
    <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
      <AppAlert v-if="formError" :message="formError" />
      <FormField
        id="student-name"
        v-slot="{ id, describedby, invalid }"
        label="이름"
        :error="fieldError('name')"
      >
        <AppInput
          :id="id"
          v-model="values.name"
          :maxlength="STUDENT_NAME_MAX"
          autocomplete="off"
          :invalid="invalid"
          :aria-describedby="describedby"
          @blur="touched.name = true"
        />
      </FormField>
      <FormField
        id="student-phone"
        v-slot="{ id, describedby, invalid }"
        label="휴대폰 번호"
        hint="하이픈 없이 적어도 돼요"
        :error="fieldError('phone')"
      >
        <AppInput
          :id="id"
          v-model="values.phone"
          type="tel"
          inputmode="numeric"
          autocomplete="off"
          placeholder="010-1234-5678"
          class="tabular-nums"
          :invalid="invalid"
          :aria-describedby="describedby"
          @blur="touched.phone = true"
        />
      </FormField>
      <div class="mt-1 flex justify-end gap-2">
        <AppButton variant="secondary" @click="open = false">닫기</AppButton>
        <AppButton type="submit" :loading="saving">저장</AppButton>
      </div>
    </form>
  </AppDialog>
</template>
