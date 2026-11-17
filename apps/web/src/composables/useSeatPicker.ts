import { computed, ref, watch, type Ref } from 'vue';
import type { SeatAvailability } from '@hiconsy/shared';
import { studyRoomsApi } from '@/api/studyRooms';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { toIsoWithOffset } from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import type { VisitRange } from '@/utils/alternativeRooms';

/**
 * 왜 좌석을 다시 받는지
 * - time: 학생이 시간을 바꿈 → 고른 좌석이 차면 "그 시간에는 …" 안내
 * - poll: 자동 갱신(30초)·탭 복귀 → 고른 좌석을 그 사이 다른 학생이 가져가면 안내
 * - refresh: 신청 실패 후 다시 받음 (안내는 부른 쪽이 이미 함)
 */
export type SeatReloadReason = 'time' | 'poll' | 'refresh';

/**
 * 고른 시간의 좌석 현황과 고른 좌석 (#49, screens.md S-22).
 * - 처음(또는 자습실이 바뀌면) 받을 때 좌석을 미리 고른다: preferred가 비어 있으면 그 좌석, 아니면 가장 작은 번호
 * - 고른 좌석이 차게 되면 선택을 풀고 토스트 + 라이브 영역(notice)으로 알린다
 *   (모달 안에서는 바깥 토스트가 스크린리더에 가려지므로 notice를 화면 안에 읽게 둔다)
 */
export function useSeatPicker(options: {
  roomId: Ref<number | null>;
  range: Ref<VisitRange | null>;
  /** 미리 고를 좌석 (재신청이면 이전 좌석) */
  preferredSeatId: Ref<number | null>;
  /** 시간 변경 중인 내 신청 — 그 신청이 차지한 자리는 빈 것으로 본다 */
  exceptVisitId?: Ref<number | undefined>;
  /** false면 비워 두고 부르지 않는다 (닫힌 모달, 불러오기 전 페이지) */
  active: Ref<boolean>;
}) {
  const toast = useToast();
  const handleStudentGone = useStudentGuard();

  const seats = ref<SeatAvailability[]>([]);
  const seatId = ref<number | null>(null);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);
  const notice = ref('');
  let pickDefault = true;
  let request = 0;

  const freeCount = computed(() => seats.value.filter((s) => s.available).length);
  const selectedSeat = computed(() => seats.value.find((s) => s.id === seatId.value) ?? null);

  function notify(message: string) {
    toast.error(message);
    notice.value = message;
  }

  async function reload(reason: SeatReloadReason = 'time') {
    const id = options.roomId.value;
    const range = options.range.value;
    const current = ++request;
    if (!options.active.value || id === null || !range) {
      seats.value = [];
      loading.value = false;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const list = await studyRoomsApi.seats(
        id,
        { startAt: toIsoWithOffset(range.startAt), endAt: toIsoWithOffset(range.endAt) },
        options.exceptVisitId?.value,
      );
      if (current !== request) return;
      const isFree = (sid: number | null) => list.some((s) => s.id === sid && s.available);
      const previous = seats.value.find((s) => s.id === seatId.value);
      seats.value = list;
      loaded.value = true;
      if (pickDefault) {
        pickDefault = false;
        const preferred = options.preferredSeatId.value;
        seatId.value = isFree(preferred) ? preferred : (list.find((s) => s.available)?.id ?? null);
      } else if (seatId.value !== null && !isFree(seatId.value)) {
        seatId.value = null;
        if (reason === 'time') {
          notify('그 시간에는 다른 학생이 이미 예약한 좌석이에요. 다른 좌석을 골라 주세요');
        } else if (reason === 'poll' && previous) {
          notify(
            `방금 다른 학생이 ${previous.number}번 좌석을 예약했어요. 다른 좌석을 골라 주세요`,
          );
        }
      }
    } catch (e) {
      if (current !== request) return;
      if (handleStudentGone(e)) return;
      error.value = errorMessage(e);
    } finally {
      if (current === request) loading.value = false;
    }
  }

  // 켜지거나 자습실·시간이 바뀌면 다시 받는다 (켜질 때·자습실이 바뀔 때는 좌석을 새로 미리 고른다)
  watch(
    [
      options.active,
      options.roomId,
      () => options.range.value?.startAt.getTime(),
      () => options.range.value?.endAt.getTime(),
    ],
    ([isActive], previous) => {
      const [wasActive, prevRoomId] = previous ?? [false, null];
      if (!isActive) {
        seats.value = [];
        seatId.value = null;
        loaded.value = false;
        notice.value = '';
        return;
      }
      if (!wasActive || prevRoomId !== options.roomId.value) {
        pickDefault = true;
        loaded.value = false;
      }
      void reload('time');
    },
    { immediate: true },
  );

  return { seats, seatId, loading, loaded, error, notice, freeCount, selectedSeat, notify, reload };
}
