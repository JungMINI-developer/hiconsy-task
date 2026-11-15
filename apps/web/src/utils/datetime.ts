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

/** `11.20(목)`, 올해가 아니면 `2027.01.05(화)` */
export function formatDate(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
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
