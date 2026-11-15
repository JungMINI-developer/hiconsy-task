<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui';
import type { Student } from '@hiconsy/shared';
import { studentsApi } from '@/api/students';
import { useAsync } from '@/composables/useAsync';
import { useSessionStore, type Role } from '@/stores/session';
import { errorMessage } from '@/utils/errorMessage';
import { maskPhone } from '@/utils/phone';
import AppButton from '@/components/ui/AppButton.vue';
import AppSelect, { type SelectOption } from '@/components/ui/AppSelect.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import FormField from '@/components/ui/FormField.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';

const router = useRouter();
const session = useSessionStore();

const roles: { value: Role; label: string; description: string }[] = [
  { value: 'teacher', label: '강사', description: '자습실을 열고 신청을 관리해요' },
  { value: 'student', label: '학생', description: '방문을 신청하고 시간을 바꿔요' },
];

// 이전에 고른 역할·학생을 기본값으로 둔다 (역할 바꾸기로 돌아온 경우)
const role = ref<Role | undefined>(session.role ?? undefined);
const studentId = ref<number | undefined>(session.student?.id);
const submitted = ref(false);

const students = useAsync(() => studentsApi.list());

const studentOptions = computed<SelectOption<number>[]>(() =>
  (students.data.value ?? []).map((s: Student) => ({
    value: s.id,
    label: s.name,
    hint: maskPhone(s.phone),
  })),
);

watch(role, (value) => {
  if (value === 'student' && students.status.value === 'idle') void students.run();
});

onMounted(() => {
  if (role.value === 'student') void students.run();
});

// 삭제된 학생이 기본값으로 남아 있으면 비운다
watch(students.data, (list) => {
  if (list && studentId.value && !list.some((s) => s.id === studentId.value)) {
    studentId.value = undefined;
  }
});

const studentError = computed(() =>
  submitted.value && role.value === 'student' && !studentId.value ? '학생을 골라 주세요' : null,
);

function enter() {
  submitted.value = true;
  if (role.value === 'teacher') {
    session.enterAsTeacher();
    void router.push({ name: 'teacher-rooms' });
    return;
  }
  if (role.value === 'student') {
    const student = students.data.value?.find((s) => s.id === studentId.value);
    if (!student) {
      document.getElementById('student-select')?.focus();
      return;
    }
    session.enterAsStudent(student);
    void router.push({ name: 'student-rooms' });
  }
}
</script>

<template>
  <main class="mx-auto flex w-full max-w-lg flex-col px-4 pt-12 pb-16 sm:pt-20">
    <h1 tabindex="-1" data-page-title class="text-title focus:outline-none">
      어떤 역할로 들어갈까요?
    </h1>
    <p class="mt-2 text-body text-fg-muted">
      로그인 대신 역할을 골라요. 나중에 상단의 역할 바꾸기로 언제든 바꿀 수 있어요.
    </p>

    <form class="mt-8 flex flex-col gap-6" novalidate @submit.prevent="enter">
      <RadioGroupRoot
        v-model="role"
        aria-label="역할"
        class="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <RadioGroupItem
          v-for="item in roles"
          :key="item.value"
          :value="item.value"
          class="flex flex-col items-start gap-1 rounded-lg border border-line-strong bg-surface p-4 text-left transition-colors duration-120 ease-standard hover:border-fg-muted data-[state=checked]:border-accent data-[state=checked]:ring-1 data-[state=checked]:ring-accent"
        >
          <span class="text-heading">{{ item.label }}</span>
          <span class="text-caption text-fg-muted">{{ item.description }}</span>
        </RadioGroupItem>
      </RadioGroupRoot>

      <section v-if="role === 'student'" aria-label="학생 선택">
        <div v-if="students.showSkeleton.value" class="flex flex-col gap-1.5">
          <AppSkeleton class="h-5 w-24" />
          <AppSkeleton class="h-10 w-full" />
        </div>
        <ErrorState
          v-else-if="students.status.value === 'error'"
          title="학생 목록을 불러오지 못했어요"
          :description="errorMessage(students.error.value)"
          :retrying="students.isLoading.value"
          @retry="students.run()"
        />
        <p
          v-else-if="students.data.value && students.data.value.length === 0"
          class="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-body text-fg-muted"
        >
          등록된 학생이 없어요. 강사로 들어가 학생을 먼저 등록해 주세요.
        </p>
        <FormField
          v-else-if="students.data.value"
          id="student-select"
          v-slot="{ id, describedby, invalid }"
          label="이름을 골라 주세요"
          hint="동명이인은 전화번호 뒷자리로 구분해요"
          :error="studentError"
        >
          <AppSelect
            :id="id"
            v-model="studentId"
            :options="studentOptions"
            placeholder="학생 선택"
            :describedby="describedby"
            :invalid="invalid"
          />
        </FormField>
      </section>

      <div class="flex justify-end">
        <AppButton type="submit" :disabled="!role">들어가기</AppButton>
      </div>
    </form>
  </main>
</template>
