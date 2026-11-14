/**
 * 서비스 기준 시간대: 한국 표준시(KST, UTC+9). 한국은 서머타임이 없어 고정 오프셋으로 충분하다.
 * DB에는 timestamptz(UTC 기준 시각)로 저장하고, API 응답에서만 +09:00 오프셋으로 표현한다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_OFFSET = '+09:00';

/** Date → KST 오프셋 ISO 8601 문자열 (예: 2026-11-15T19:00:00.000+09:00) */
export function toKstIso(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().replace('Z', KST_OFFSET);
}

export function toKstIsoOrNull(date: Date | null): string | null {
  return date ? toKstIso(date) : null;
}
