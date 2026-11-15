import { expect, test } from './support/fixtures';
import { expectNoHorizontalScroll, pick } from './support/ui';

test.describe('역할 선택', () => {
  test('역할 없이 강사·학생 화면에 들어가면 역할 선택으로 보낸다', async ({ page }) => {
    await page.goto('/teacher/rooms');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('어떤 역할로 들어갈까요?');

    await page.goto('/student/visits');
    await expect(page).toHaveURL('/');
  });

  test('강사로 들어가면 자습실 목록으로 이동한다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: /강사/ }).click();
    await page.getByRole('button', { name: '들어가기' }).click();

    await expect(page).toHaveURL('/teacher/rooms');
    await expect(page).toHaveTitle('자습실 목록 · 자습실 예약');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('자습실');
    await expectNoHorizontalScroll(page);
  });

  test('학생은 이름을 골라 들어가고, 전화번호는 가려서 보여준다', async ({ page, seed }) => {
    await seed.student('김하늘', '010-1234-5678');
    await page.goto('/');
    await page.getByRole('radio', { name: /학생/ }).click();

    // 이름을 고르지 않고 들어가면 안내
    await page.getByRole('button', { name: '들어가기' }).click();
    await expect(page.getByText('학생을 골라 주세요')).toBeVisible();

    // 동명이인 구분용 전화번호는 가운데를 가린다
    await page.getByRole('combobox', { name: '이름을 골라 주세요' }).click();
    await expect(page.getByRole('option', { name: /김하늘/ })).toContainText('010-****-5678');
    await page.keyboard.press('Escape');

    await pick(page, page.getByRole('combobox', { name: '이름을 골라 주세요' }), '김하늘');
    await expect(page.getByRole('combobox', { name: '이름을 골라 주세요' })).toContainText(
      '김하늘',
    );
    await page.getByRole('button', { name: '들어가기' }).click();

    await expect(page).toHaveURL('/student/rooms');
    await expect(page.getByRole('banner')).toContainText('김하늘');
  });

  test('등록된 학생이 없으면 강사로 먼저 등록하라고 안내한다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: /학생/ }).click();
    await expect(page.getByText('등록된 학생이 없어요')).toBeVisible();
  });
});
