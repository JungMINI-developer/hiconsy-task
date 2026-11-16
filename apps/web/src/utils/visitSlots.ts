/**
 * 방문 신청 다이얼로그(S-22)의 선택지 생성.
 * - 30분 단위
 * - 구간 전체가 운영 기간 안 (requirements 9절 #1)
 * - 시작은 지금 이후 (#6)
 * - 방문은 하루 안으로 제한 (UI 제약, screens.md S-22)
 * - 내 다른 유효 신청과 겹치지 않음 (#13) — 선택지는 남기고 비활성화한다
 */
import { toDateInputValue, toTimeValue } from './datetime';

export const SLOT_MS = 30 * 60 * 1000;

/** 이미 신청해 둔 다른 방문 구간 (겹치면 고를 수 없다) */
export interface BusyRange {
  startAt: Date;
  endAt: Date;
  /** 겹칠 때 보여줄 자습실 이름 */
  label: string;
}

/**
 * [startAt, endAt)과 겹치는 첫 구간.
 * 반열린 구간이라 19~21시 다음 21~22시처럼 맞닿는 구간은 겹치지 않는다 (서버와 같은 기준).
 */
export function findOverlap(
  startAt: Date,
  endAt: Date,
  busy: readonly BusyRange[],
): BusyRange | undefined {
  return busy.find(
    (b) => b.startAt.getTime() < endAt.getTime() && startAt.getTime() < b.endAt.getTime(),
  );
}

export interface Period {
  startDate: string;
  endDate: string;
}

/** t 이상인 가장 가까운 30분 경계 */
function ceilToSlot(t: number): number {
  return Math.ceil(t / SLOT_MS) * SLOT_MS;
}

function startOfNextDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

/** 고를 수 있는 모든 시작 시각 */
function allStarts(period: Period, now: Date): Date[] {
  const roomStart = new Date(period.startDate).getTime();
  const roomEnd = new Date(period.endDate).getTime();
  // 30분 경계는 로컬 시간대 기준이어야 하므로 오프셋을 보정한다
  const offset = new Date(roomStart).getTimezoneOffset() * 60_000;
  let t = ceilToSlot(Math.max(roomStart, now.getTime() + 1) - offset) + offset;
  const result: Date[] = [];
  for (; t + SLOT_MS <= roomEnd; t += SLOT_MS) {
    const d = new Date(t);
    // 같은 날 안에 최소 30분 머물 수 있어야 한다
    if (t + SLOT_MS <= startOfNextDay(d).getTime()) result.push(d);
  }
  return result;
}

/** 시작 시각을 고를 수 있는 날짜 (`YYYY-MM-DD`) */
export function visitDateOptions(period: Period, now: Date = new Date()): string[] {
  return [...new Set(allStarts(period, now).map((d) => toDateInputValue(d)))];
}

/** 해당 날짜의 시작 시각 (`HH:mm`) */
export function visitStartOptions(period: Period, date: string, now: Date = new Date()): string[] {
  return allStarts(period, now)
    .filter((d) => toDateInputValue(d) === date)
    .map((d) => toTimeValue(d));
}

/**
 * 시작 시각 이후의 종료 시각 (`HH:mm`).
 * 자정에 끝나는 경우는 `24:00`으로 표기한다.
 */
export function visitEndOptions(period: Period, start: Date): string[] {
  const roomEnd = new Date(period.endDate).getTime();
  const limit = Math.min(roomEnd, startOfNextDay(start).getTime());
  const result: string[] = [];
  for (let t = start.getTime() + SLOT_MS; t <= limit; t += SLOT_MS) {
    result.push(t === startOfNextDay(start).getTime() ? '24:00' : toTimeValue(new Date(t)));
  }
  return result;
}

/** `YYYY-MM-DD` + `HH:mm`(24:00 허용) → Date */
export function slotToDate(date: string, time: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return null;
  return new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]));
}

/** 지금 신청할 수 있는 시간이 남아 있는지 */
export function hasAvailableSlot(period: Period, now: Date = new Date()): boolean {
  return allStarts(period, now).length > 0;
}

/** 다이얼로그의 선택값 (날짜 `YYYY-MM-DD`, 시작·종료 `HH:mm`, 자정 종료는 `24:00`) */
export interface SlotValue {
  date: string;
  start: string;
  end: string;
}

/** 방문 구간 → 다이얼로그 선택값. 종료가 다음 날 0시면 `24:00`으로 표기한다 */
export function toSlotValue(startAt: Date, endAt: Date): SlotValue {
  const date = toDateInputValue(startAt);
  return {
    date,
    start: toTimeValue(startAt),
    end: toDateInputValue(endAt) !== date ? '24:00' : toTimeValue(endAt),
  };
}

/**
 * URL 쿼리용 문자열 `YYYY-MM-DDTHH:mm~HH:mm` (로컬 시간).
 * 정원 마감 후 다른 자습실 신청 다이얼로그를 고른 시간으로 열 때 쓴다 (#35).
 */
export function encodeSlot(startAt: Date, endAt: Date): string {
  const { date, start, end } = toSlotValue(startAt, endAt);
  return `${date}T${start}~${end}`;
}

export function decodeSlot(raw: unknown): SlotValue | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})~(\d{2}:\d{2})$/.exec(raw);
  if (!m) return null;
  const [, date, start, end] = m as unknown as [string, string, string, string];
  const s = slotToDate(date, start);
  const e = slotToDate(date, end);
  return s && e && s.getTime() < e.getTime() ? { date, start, end } : null;
}
