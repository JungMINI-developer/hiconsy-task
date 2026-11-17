<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Student } from '@hiconsy/shared';
import { Plus, Search } from 'lucide-vue-next';
import { studentsApi } from '@/api/students';
import { visitsApi } from '@/api/visits';
import { useAsync } from '@/composables/useAsync';
import { useDialogQuery } from '@/composables/useDialogQuery';
import { useHighlight, useRefetchOnVisible } from '@/composables/useRefetch';
import { useToast } from '@/composables/useToast';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import PageShell from '@/components/layout/PageShell.vue';
import StudentFormDialog from '@/components/domain/StudentFormDialog.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppDropdownMenu from '@/components/ui/AppDropdownMenu.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';

const toast = useToast();
const students = useAsync(() => studentsApi.list());
useRefetchOnVisible(students.run);
const { highlightedId, highlight } = useHighlight();

const query = ref('');
const filtered = computed(() => {
  const q = query.value.trim();
  const digits = q.replace(/\D/g, '');
  const list = students.data.value ?? [];
  if (!q) return list;
  return list.filter(
    (s) => s.name.includes(q) || (digits.length > 0 && s.phone.replace(/\D/g, '').includes(digits)),
  );
});

// 등록·수정 (?new=1, ?edit=id)
const createDialog = useDialogQuery('new');
const editDialog = useDialogQuery('edit');
const editingStudent = computed(
  () => students.data.value?.find((s) => String(s.id) === editDialog.value.value) ?? null,
);
const editOpen = computed({
  get: () => !!editingStudent.value,
  set: (v: boolean) => !v && editDialog.close(),
});

function onSaved(student: Student, mode: 'create' | 'edit') {
  toast.success(mode === 'create' ? `${student.name} 학생을 등록했어요` : '변경 내용을 저장했어요');
  highlight(student.id);
  void students.run();
}

function onGone() {
  toast.error('삭제된 학생이에요');
  void students.run();
}

// 삭제: 확인 전에 취소될(끝나지 않은) 신청 수를 가져와 영향을 알려준다
const deleting = ref<Student | null>(null);
const activeVisitCount = ref<number | null>(null);
const removing = ref(false);
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (v: boolean) => !v && (deleting.value = null),
});
const deleteDescription = computed(() => {
  const n = activeVisitCount.value;
  if (n === null)
    return '이 학생의 끝나지 않은 신청이 있으면 모두 취소돼요. 지난 방문 기록은 그대로 남아요.';
  return n > 0
    ? `끝나지 않은 신청 ${n}건이 취소돼요. 지난 방문 기록은 그대로 남아요.`
    : '취소될 신청이 없어요. 삭제하면 목록에서 사라져요.';
});

async function askDelete(student: Student) {
  deleting.value = student;
  activeVisitCount.value = null;
  try {
    const visits = await visitsApi.list(student.id);
    if (deleting.value?.id === student.id) {
      // 삭제하면 끝나지 않은 신청만 취소된다 — 지난 방문은 그대로 남는다 (#57)
      const now = Date.now();
      activeVisitCount.value = visits.filter(
        (v) => v.status === 'APPLIED' && new Date(v.endAt).getTime() > now,
      ).length;
    }
  } catch {
    /* 개수를 못 가져와도 삭제는 할 수 있다 */
  }
}

async function confirmDelete() {
  if (!deleting.value) return;
  const { name } = deleting.value;
  removing.value = true;
  try {
    await studentsApi.remove(deleting.value.id);
    toast.success(`${name} 학생을 삭제했어요`);
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    removing.value = false;
    deleting.value = null;
    void students.run();
  }
}

const menuItems = [
  { key: 'edit', label: '수정' },
  { key: 'delete', label: '삭제', danger: true },
];

function onMenu(student: Student, key: string) {
  if (key === 'edit') editDialog.open(student.id);
  if (key === 'delete') void askDelete(student);
}
</script>

<template>
  <PageShell title="학생">
    <template v-if="students.data.value" #description>
      등록된 학생 <span class="tabular-nums">{{ students.data.value.length }}</span>명
    </template>
    <template #actions>
      <AppButton @click="createDialog.open()">
        <Plus class="size-4" aria-hidden="true" />
        학생 등록
      </AppButton>
    </template>

    <div v-if="students.showSkeleton.value" class="flex flex-col gap-2">
      <AppSkeleton class="h-10 w-full max-w-xs" />
      <AppSkeleton class="h-64 w-full" />
    </div>
    <ErrorState
      v-else-if="students.status.value === 'error' && !students.data.value"
      title="학생 목록을 불러오지 못했어요"
      :description="errorMessage(students.error.value)"
      @retry="students.run()"
    />
    <template v-else-if="students.data.value">
      <EmptyState
        v-if="students.data.value.length === 0"
        title="등록된 학생이 없어요"
        description="학생을 등록하면 학생 역할로 들어가 방문을 신청할 수 있어요"
      >
        <AppButton @click="createDialog.open()">학생 등록</AppButton>
      </EmptyState>
      <template v-else>
        <div class="relative mb-4 max-w-xs">
          <Search
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
            aria-hidden="true"
          />
          <AppInput
            v-model="query"
            type="search"
            placeholder="이름·전화번호로 찾기"
            aria-label="이름·전화번호로 찾기"
            class="pl-9"
          />
        </div>
        <p class="sr-only" aria-live="polite">
          <template v-if="query">검색 결과 {{ filtered.length }}명</template>
        </p>
        <EmptyState v-if="filtered.length === 0" title="찾는 학생이 없어요" />
        <div v-else class="overflow-x-auto rounded-xl bg-surface">
          <table class="w-full text-left text-body">
            <thead class="border-b border-line text-label text-fg-muted">
              <tr>
                <th scope="col" class="px-4 py-2.5 font-medium">이름</th>
                <th scope="col" class="px-4 py-2.5 font-medium">연락처</th>
                <th scope="col" class="hidden px-4 py-2.5 font-medium sm:table-cell">등록일</th>
                <th scope="col" class="w-12 px-2 py-2.5"><span class="sr-only">메뉴</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr
                v-for="s in filtered"
                :key="s.id"
                :class="cn(highlightedId === s.id && 'animate-highlight')"
              >
                <td class="px-4 py-2 font-medium whitespace-nowrap">{{ s.name }}</td>
                <td class="px-4 py-2 whitespace-nowrap tabular-nums">{{ s.phone }}</td>
                <td class="hidden px-4 py-2 text-fg-muted tabular-nums sm:table-cell">
                  {{ formatDate(s.createdAt) }}
                </td>
                <td class="px-2 py-1 text-right">
                  <AppDropdownMenu
                    :items="menuItems"
                    :label="`${s.name} 메뉴`"
                    @select="(key) => onMenu(s, key)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <StudentFormDialog v-model:open="createDialog.isOpen.value" @saved="onSaved" />
    <StudentFormDialog
      v-model:open="editOpen"
      :student="editingStudent"
      @saved="onSaved"
      @gone="onGone"
    />
    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="`${deleting?.name ?? ''} 학생을 삭제할까요?`"
      :description="deleteDescription"
      confirm-label="삭제"
      :loading="removing"
      @confirm="confirmDelete"
    />
  </PageShell>
</template>
