import { expect, type Locator, type Page } from '@playwright/test';

/** Reka UI Select: 트리거를 열고 옵션을 고른다 */
export async function pick(page: Page, trigger: Locator, option: string) {
  await trigger.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
}

/**
 * 토스트 영역에서 문구를 찾는다 (같은 문구가 연달아 뜨면 가장 최근 것).
 * 모달이 열려 있으면 토스트 영역이 접근성 트리에서 가려지므로 includeHidden으로 찾는다.
 * (모달 안 안내는 다이얼로그 안 라이브 영역이 따로 읽어 준다)
 */
export function toast(page: Page, text: string | RegExp) {
  return page.getByRole('region', { name: /알림/, includeHidden: true }).getByText(text).last();
}

/** 화면에 가로 스크롤이 생기지 않았는지 (320px 레이아웃 회귀 방지) */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, '가로 스크롤 폭(px)').toBeLessThanOrEqual(0);
}

/** 헤더의 주 메뉴 */
export function nav(page: Page) {
  return page.getByRole('navigation', { name: '주 메뉴' });
}
