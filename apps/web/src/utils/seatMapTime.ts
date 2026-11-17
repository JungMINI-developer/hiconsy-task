/**
 * 강사 좌석 배치도(S-11)의 "볼 시각" 선택 (#51).
 * - 선택지: 운영 기간 안의 30분 경계 (운영 시작 ~ 종료 30분 전)
 * - 기본값: 운영 중이면 지금을 30분 단위로 내린 시각, 운영 전·종료 후면 운영 시작 (#51 결정 1)
 */
import { SLOT_MS, type Period } from './visitSlots';

/** 30분 경계는 로컬 시간대 기준 */
function floorToSlot(t: number): number {
  const offset = new Date(t).getTimezoneOffset() * 60_000;
  return Math.floor((t - offset) / SLOT_MS) * SLOT_MS + offset;
}

function ceilToSlot(t: number): number {
  const offset = new Date(t).getTimezoneOffset() * 60_000;
  return Math.ceil((t - offset) / SLOT_MS) * SLOT_MS + offset;
}

/** 볼 수 있는 시각 (epoch ms, 오름차순) */
export function seatMapTimes(period: Period): number[] {
  const start = new Date(period.startDate).getTime();
  const end = new Date(period.endDate).getTime();
  const result: number[] = [];
  for (let t = ceilToSlot(start); t < end; t += SLOT_MS) result.push(t);
  // 운영 시작이 30분 경계가 아니면 시작 시각 자체도 고를 수 있게 둔다
  if (result[0] !== start && start < end) result.unshift(start);
  return result;
}

/** 처음 볼 시각 */
export function defaultSeatMapTime(period: Period, now: Date = new Date()): number {
  const start = new Date(period.startDate).getTime();
  const end = new Date(period.endDate).getTime();
  const t = now.getTime();
  if (t < start || t >= end) return start;
  return Math.max(start, floorToSlot(t));
}

/** 운영 중일 때 [지금]이 가리킬 시각. 운영 시간이 아니면 null */
export function nowSeatMapTime(period: Period, now: Date = new Date()): number | null {
  const t = now.getTime();
  if (t < new Date(period.startDate).getTime() || t >= new Date(period.endDate).getTime())
    return null;
  return defaultSeatMapTime(period, now);
}

/** 그 방문이 시각 t에 앉아 있는지 — 반열린 구간 [startAt, endAt) (서버 seat-map과 같은 기준) */
export function isSeatedAt(visit: { startAt: string; endAt: string }, t: number): boolean {
  return new Date(visit.startAt).getTime() <= t && t < new Date(visit.endAt).getTime();
}
