import { formatDate, formatTimeRange, isSameDay } from './datetime';

type DateInput = string | Date;

export interface VisitSnapshot {
  startAt: DateInput;
  endAt: DateInput;
  seatNumber: number | null;
}

const time = (v: VisitSnapshot) =>
  new Date(v.startAt).getTime() + ':' + new Date(v.endAt).getTime();

/** 방문 시간 글자: 같은 날이면 날짜를 한 번만 (`내일 11:00 – 13:00`) */
function when(v: VisitSnapshot, withDate: boolean) {
  const range = formatTimeRange(v.startAt, v.endAt);
  return withDate ? `${formatDate(v.startAt)} ${range}` : range;
}

/**
 * 바뀐 것만 `이전 → 이후`로 (#49 변경 모드 하단 바·성공 토스트).
 * 예: `3번 → 7번 좌석 · 11:00 – 13:00 → 12:00 – 14:00`
 * 날짜가 바뀌면 날짜도 붙인다. 아무것도 안 바뀌면 빈 문자열.
 */
export function visitChangeText(prev: VisitSnapshot, next: VisitSnapshot): string {
  const parts: string[] = [];
  if (prev.seatNumber !== next.seatNumber && next.seatNumber !== null) {
    parts.push(
      prev.seatNumber === null
        ? `${next.seatNumber}번 좌석`
        : `${prev.seatNumber}번 → ${next.seatNumber}번 좌석`,
    );
  }
  if (time(prev) !== time(next)) {
    const dateChanged = !isSameDay(prev.startAt, next.startAt);
    parts.push(`${when(prev, dateChanged)} → ${when(next, dateChanged)}`);
  }
  return parts.join(' · ');
}
