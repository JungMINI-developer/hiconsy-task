import { computed, ref, watch, type Ref } from 'vue';
import type { Visit } from '@hiconsy/shared';
import type { SelectOption } from '@/components/ui/AppSelect.vue';
import { useMyVisitsStore } from '@/stores/myVisits';
import { formatDate, formatDuration, toDateInputValue, toTimeValue } from '@/utils/datetime';
import {
  findOverlap,
  slotToDate,
  SLOT_MS,
  visitDateOptions,
  visitEndOptions,
  visitStartOptions,
  type BusyRange,
  type Period,
  type SlotValue,
} from '@/utils/visitSlots';

/** 비활성 선택지 옆에 보여줄 이유 */
const BUSY_HINT = '다른 신청';

/**
 * 방문 시간(날짜 + 시작 + 종료) 고르기 — 학생 자습실 페이지 헤더와 시간 변경 모달이 함께 쓴다.
 * 운영 기간 밖·지난 시각은 선택지에서 아예 제외하고,
 * 내 다른 신청과 겹치는 시각은 이유와 함께 비활성화한다 (interaction-rules.md#방문-s-22).
 *
 * @param period 자습실 운영 기간
 * @param editingVisit 시간을 바꾸는 신청 (겹침 검사에서 자신은 뺀다)
 */
export function useVisitTimePicker(
  period: Ref<Period | null>,
  editingVisit: Ref<Visit | null | undefined>,
) {
  const myVisits = useMyVisitsStore();
  const date = ref<string | undefined>();
  const start = ref<string | undefined>();
  const end = ref<string | undefined>();

  /** 내 다른 유효 신청 — 같은 학생의 신청끼리는 시간이 겹칠 수 없다 (requirements 9절 #13) */
  const busy = computed<BusyRange[]>(() => {
    const now = Date.now();
    return myVisits.visits
      .filter(
        (v) =>
          v.status === 'APPLIED' &&
          v.id !== editingVisit.value?.id &&
          new Date(v.endAt).getTime() > now,
      )
      .map((v) => ({
        startAt: new Date(v.startAt),
        endAt: new Date(v.endAt),
        label: v.studyRoom.name,
      }));
  });

  function option(value: string, label: string, blocked: boolean): SelectOption<string> {
    return blocked ? { value, label, disabled: true, hint: BUSY_HINT } : { value, label };
  }

  /** 이 시각에 시작하면 최소 길이(30분)도 머물 수 없는지 */
  function isStartBlocked(day: string, time: string): boolean {
    const s = slotToDate(day, time);
    return !s || !!findOverlap(s, new Date(s.getTime() + SLOT_MS), busy.value);
  }

  const firstEnabled = (options: SelectOption<string>[]) => options.find((o) => !o.disabled)?.value;
  const isEnabled = (options: SelectOption<string>[], value: string | undefined) =>
    options.some((o) => o.value === value && !o.disabled);

  const dateOptions = computed(() => {
    const p = period.value;
    if (!p) return [];
    return visitDateOptions(p).map((d) =>
      option(
        d,
        formatDate(`${d}T00:00:00`),
        visitStartOptions(p, d).every((t) => isStartBlocked(d, t)),
      ),
    );
  });
  const startOptions = computed(() => {
    const day = date.value;
    if (!period.value || !day) return [];
    return visitStartOptions(period.value, day).map((t) => option(t, t, isStartBlocked(day, t)));
  });
  const startDate = computed(() =>
    date.value && start.value ? slotToDate(date.value, start.value) : null,
  );
  const endOptions = computed(() => {
    const day = date.value;
    const s = startDate.value;
    if (!period.value || !day || !s) return [];
    return visitEndOptions(period.value, s).map((t) => {
      const e = slotToDate(day, t);
      return option(t, t, !e || !!findOverlap(s, e, busy.value));
    });
  });
  const noSlots = computed(() => dateOptions.value.length === 0);
  /** 운영 기간 안의 시간이 모두 내 다른 신청과 겹친다 */
  const allBusy = computed(() => !noSlots.value && dateOptions.value.every((o) => o.disabled));

  /** 기본 종료: 시작 + 2시간 (안 되면 고를 수 있는 마지막) */
  function defaultEnd(): string | undefined {
    const options = endOptions.value.filter((o) => !o.disabled).map((o) => o.value);
    return options[3] ?? options[options.length - 1];
  }

  /**
   * 처음 값 채우기: 신청의 시간 → 미리 고른 시간(고를 수 있을 때) → 고를 수 있는 첫 시간 + 2시간
   */
  function reset(initial: { visit?: Visit | null; slot?: SlotValue | null } = {}) {
    if (initial.visit) {
      date.value = toDateInputValue(initial.visit.startAt);
      start.value = toTimeValue(initial.visit.startAt);
      const endAt = new Date(initial.visit.endAt);
      end.value = toDateInputValue(endAt) !== date.value ? '24:00' : toTimeValue(endAt);
      return;
    }
    const slot = initial.slot;
    if (slot) {
      date.value = slot.date;
      start.value = slot.start;
      end.value = slot.end;
      if (
        isEnabled(dateOptions.value, slot.date) &&
        isEnabled(startOptions.value, slot.start) &&
        isEnabled(endOptions.value, slot.end)
      ) {
        return;
      }
    }
    date.value = firstEnabled(dateOptions.value);
    start.value = firstEnabled(startOptions.value);
    end.value = defaultEnd();
  }

  // 날짜를 바꾸면 시작이, 시작을 바꾸면 종료가 유효한지 맞춘다
  watch(date, () => {
    if (!isEnabled(startOptions.value, start.value)) start.value = firstEnabled(startOptions.value);
  });
  watch(start, () => {
    if (!isEnabled(endOptions.value, end.value)) end.value = defaultEnd();
  });

  const selected = computed(() => {
    if (!date.value || !start.value || !end.value) return null;
    const s = slotToDate(date.value, start.value);
    const e = slotToDate(date.value, end.value);
    return s && e ? { startAt: s, endAt: e } : null;
  });

  /** 고른 방문 길이 (예: 2시간) */
  const duration = computed(() =>
    selected.value ? formatDuration(selected.value.startAt, selected.value.endAt) : '',
  );

  /** 고른 시간과 겹치는 내 다른 신청 (선택지를 막아도 목록을 다시 받은 뒤엔 생길 수 있다) */
  const conflict = computed(() =>
    selected.value
      ? findOverlap(selected.value.startAt, selected.value.endAt, busy.value)
      : undefined,
  );

  return {
    date,
    start,
    end,
    dateOptions,
    startOptions,
    endOptions,
    noSlots,
    allBusy,
    busy,
    selected,
    duration,
    conflict,
    reset,
  };
}

export type VisitTimePicker = ReturnType<typeof useVisitTimePicker>;
