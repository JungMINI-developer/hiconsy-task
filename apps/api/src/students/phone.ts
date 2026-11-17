/** 정규화된 휴대폰 번호 형식 (010-1234-5678, 011-123-4567) */
export const NORMALIZED_PHONE_PATTERN = /^01[016789]-\d{3,4}-\d{4}$/;

/**
 * 휴대폰 번호를 010-1234-5678 형태로 정규화한다.
 * 하이픈·공백·점 같은 구분자는 무시하고, 휴대폰 번호 형식이 아니면 입력을 그대로 돌려준다
 * (형식 검증은 NORMALIZED_PHONE_PATTERN으로 따로 한다).
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[\s.-]/g, '');
  const match = /^(01[016789])(\d{3,4})(\d{4})$/.exec(digits);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : input;
}
