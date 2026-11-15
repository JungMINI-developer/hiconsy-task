/** 휴대폰 번호 처리 — BE 규칙(requirements 9절 #10)과 같은 기준 */

const MOBILE_DIGITS = /^01[016789]\d{7,8}$/;

/** 하이픈·공백 유무와 관계없이 휴대폰 번호인지 */
export function isMobilePhone(value: string): boolean {
  return MOBILE_DIGITS.test(value.replace(/\D/g, ''));
}

/** 학생 선택 화면용 마스킹: 010-1234-5678 → 010-****-5678 */
export function maskPhone(phone: string): string {
  const parts = phone.split('-');
  if (parts.length !== 3) return phone;
  return `${parts[0]}-${'*'.repeat(parts[1]!.length)}-${parts[2]}`;
}
