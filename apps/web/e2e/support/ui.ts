import { expect, type Locator, type Page } from '@playwright/test';

/** Reka UI Select: 트리거를 열고 옵션을 고른다 */
export async function pick(page: Page, trigger: Locator, option: string) {
  await trigger.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
}

/** 토스트 영역에서 문구를 찾는다 (같은 문구가 연달아 뜨면 가장 최근 것) */
export function toast(page: Page, text: string | RegExp) {
  return page.getByRole('region', { name: /알림/ }).getByText(text).last();
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
