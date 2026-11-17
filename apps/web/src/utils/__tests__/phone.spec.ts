import { describe, expect, it } from 'vitest';
import { isMobilePhone, maskPhone } from '../phone';

describe('phone', () => {
  it('하이픈·공백과 관계없이 휴대폰 번호를 판별한다', () => {
    expect(isMobilePhone('010-1234-5678')).toBe(true);
    expect(isMobilePhone('01012345678')).toBe(true);
    expect(isMobilePhone('011 234 5678')).toBe(true);
    expect(isMobilePhone('02-123-4567')).toBe(false);
    expect(isMobilePhone('010-12-5678')).toBe(false);
  });

  it('가운데 자리를 가린다', () => {
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
    expect(maskPhone('011-234-5678')).toBe('011-***-5678');
  });
});
