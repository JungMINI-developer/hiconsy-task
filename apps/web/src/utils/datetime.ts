/**
 * 날짜·시간 표기 — apps/web/docs/ux-writing.md#날짜시간-표기
 * 화면 표시는 이 모듈만 쓴다. 브라우저 시간대 기준(Asia/Seoul 가정).
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const RANGE_SEPARATOR = ' – ';

type DateInput = string | Date;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isSameDay(a: DateInput, b: DateInput): boolean {
  const x = toDate(a);
  const y = toDate(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/** 두 시각의 달력 날짜 차이 (b - a, 로컬 기준) */
function dayDiff(a: Date, b: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(b) - start(a)) / 86_400_000);
}

const RELATIVE_DAY: Record<number, string> = { [-1]: '어제', 0: '오늘', 1: '내일' };

/** `오늘`·`내일`·`어제`, 그 밖엔 `11.20(목)`, 올해가 아니면 `2027.01.05(화)` */
export function formatDate(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  const relative = RELATIVE_DAY[dayDiff(now, d)];
  if (relative) return relative;
  const md = `${pad(d.getMonth() + 1)}.${pad(d.getDate())}(${WEEKDAYS[d.getDay()]})`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}.${md}`;
}

/** `18:00` */
export function formatTime(value: DateInput): string {
  const d = toDate(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `11.20(목) 18:00` */
export function formatDateTime(value: DateInput, now: Date = new Date()): string {
  return `${formatDate(value, now)} ${formatTime(value)}`;
}

/** 같은 날 `11.20(목) 18:00 – 22:00`, 다른 날 `11.20(목) 18:00 – 11.21(금) 02:00` */
export function formatRange(start: DateInput, end: DateInput, now: Date = new Date()): string {
  const tail = isSameDay(start, end) ? formatTime(end) : formatDateTime(end, now);
  return `${formatDateTime(start, now)}${RANGE_SEPARATOR}${tail}`;
}

/** 시각만 `18:00 – 20:00` (같은 날임을 아는 곳에서 사용) */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return `${formatTime(start)}${RANGE_SEPARATOR}${formatTime(end)}`;
}

/** 이력 타임스탬프: 1시간 이내면 `12분 전`, 아니면 `11.15 14:02` */
export function formatTimestamp(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  const diffMs = now.getTime() - d.getTime();
  if (diffMs >= 0 && diffMs < 60 * 60 * 1000) {
    const minutes = Math.floor(diffMs / 60_000);
    return minutes < 1 ? '방금 전' : `${minutes}분 전`;
  }
  const md = `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const date = d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}.${md}`;
  return `${date} ${formatTime(d)}`;
}

/** 서버로 보낼 ISO 문자열 (로컬 오프셋 포함, 예: 2026-11-20T18:00:00+09:00) */
export function toIsoWithOffset(value: Date): string {
  const offsetMin = -value.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export type RoomPhase = 'upcoming' | 'open' | 'ended';

/** 운영 상태: 현재 시각 기준 예정 · 운영 중 · 종료 (클라이언트 계산) */
export function getRoomPhase(
  room: { startDate: string; endDate: string },
  now: Date = new Date(),
): RoomPhase {
  const t = now.getTime();
  if (t < new Date(room.startDate).getTime()) return 'upcoming';
  if (t >= new Date(room.endDate).getTime()) return 'ended';
  return 'open';
}

/** `<input type="date">` 값 (로컬 기준 `YYYY-MM-DD`) */
export function toDateInputValue(value: DateInput): string {
  const d = toDate(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 시간 선택 값 (`HH:mm`) */
export function toTimeValue(value: DateInput): string {
  return formatTime(value);
}

/** `YYYY-MM-DD` + `HH:mm` → 로컬 Date. 형식이 틀리면 null */
export function combineDateTime(date: string, time: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return null;
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 하루를 30분 단위로 나눈 `HH:mm` 목록 (00:00 ~ 23:30) */
export function halfHourSlots(): string[] {
  return Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`);
}

/**
 * 시작을 옮길 때 종료를 같은 간격만큼 옮긴다 (자습실 폼).
 * 옮기기 전 구간이 올바르지 않았으면(시작 ≥ 종료) 그대로 둔다.
 */
export function shiftEndWithStart(prevStart: Date, nextStart: Date, end: Date): Date | null {
  if (end.getTime() <= prevStart.getTime()) return null;
  return new Date(end.getTime() + (nextStart.getTime() - prevStart.getTime()));
}

/** 구간 길이: `2시간`, `1시간 30분`, `30분` */
export function formatDuration(start: DateInput, end: DateInput): string {
  const minutes = Math.round((toDate(end).getTime() - toDate(start).getTime()) / 60_000);
  if (minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}시간` : '', m ? `${m}분` : ''].filter(Boolean).join(' ');
}

/** 남은 시간 `M:SS` (자리 제안 확정 마감까지, #36). 지났으면 `0:00` */
export function formatCountdown(until: DateInput, now: Date = new Date()): string {
  const total = Math.max(Math.ceil((toDate(until).getTime() - now.getTime()) / 1000), 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
