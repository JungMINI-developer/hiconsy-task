import { toKstIso, toKstIsoOrNull } from './date.js';

describe('toKstIso', () => {
  it('UTC 시각을 +09:00 오프셋 ISO 문자열로 바꾼다', () => {
    expect(toKstIso(new Date('2026-11-15T10:00:00.000Z'))).toBe('2026-11-15T19:00:00.000+09:00');
  });

  it('날짜가 넘어가는 경우도 KST 기준 날짜로 표현한다', () => {
    expect(toKstIso(new Date('2026-11-15T20:30:00.000Z'))).toBe('2026-11-16T05:30:00.000+09:00');
  });

  it('같은 시각을 가리키므로 다시 파싱하면 원래 값과 같다', () => {
    const date = new Date('2026-11-15T10:00:00.123Z');
    expect(new Date(toKstIso(date)).getTime()).toBe(date.getTime());
  });

  it('null은 그대로 null', () => {
    expect(toKstIsoOrNull(null)).toBeNull();
  });
});
