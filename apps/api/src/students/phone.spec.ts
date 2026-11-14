import { NORMALIZED_PHONE_PATTERN, normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it.each([
    ['01012345678', '010-1234-5678'],
    ['010-1234-5678', '010-1234-5678'],
    ['010 1234 5678', '010-1234-5678'],
    ['010.1234.5678', '010-1234-5678'],
    ['0111234567', '011-123-4567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(expected).toMatch(NORMALIZED_PHONE_PATTERN);
  });

  it.each(['02-123-4567', '0101234', 'abc'])('휴대폰 번호가 아니면 그대로 둔다: %s', (input) => {
    expect(normalizePhone(input)).toBe(input);
    expect(input).not.toMatch(NORMALIZED_PHONE_PATTERN);
  });
});
