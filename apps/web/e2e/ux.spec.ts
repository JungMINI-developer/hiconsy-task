import { enterAsStudent, enterAsTeacher, expect, kst, test } from './support/fixtures';
import { nav, pick, toast } from './support/ui';
import type { Locator, Page } from '@playwright/test';

/** #26 실사용 점검에서 고친 UX — 다시 나빠지지 않도록 고정한다 */

test.describe('토스트', () => {
  test('화면 가운데 아래에 뜨고, 연달아 오면 모두 보인다', async ({ page, seed }) => {
    await seed.room({ name: 'A 자습실' });
    await seed.room({ name: 'B 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);
    await page.goto('/student/rooms');

    for (const name of ['A 자습실', 'B 자습실']) {
      await page
        .getByRole('listitem')
        .filter({ hasText: name })
        .getByRole('button', { name: '방문 신청' })
        .click();
      await page.getByRole('dialog').getByRole('button', { name: '신청하기' }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    }

    const items = page.getByRole('region', { name: /알림/ }).getByRole('listitem');
    await expect(items).toHaveCount(2);
    for (const item of await items.all()) await expect(item).toBeInViewport();

    const viewport = page.viewportSize()!;
    // 가운데 기준은 본문 영역 — scrollbar-gutter로 스크롤바 자리(약 15px)를 뺀 폭 (페이지 본문과 같은 축)
    const layoutWidth = await page.evaluate(() => document.body.clientWidth);
    const box = (await items.last().boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - layoutWidth / 2), '가로 가운데').toBeLessThan(2);
    expect(box.y + box.height, '화면 아래쪽').toBeGreaterThan(viewport.height * 0.75);
    // 시간 구간이 한 줄에 다 들어갈 만큼 넓다 (데스크톱)
    if (viewport.width >= 640) expect(box.width).toBeGreaterThanOrEqual(440);
  });
});

test.describe('강사 · 자습실 폼', () => {
  test.beforeEach(async ({ page }) => enterAsTeacher(page));

  test('운영 시작을 옮기면 종료도 같은 간격으로 따라간다', async ({ page }) => {
    await page.goto('/teacher/rooms?new=1');
    const dialog = page.getByRole('dialog', { name: '새 자습실' });
    const startDate = dialog.getByLabel('운영 시작', { exact: true });
    const endDate = dialog.getByLabel('운영 종료', { exact: true });
    await expect(endDate).toHaveValue(kst(1, 0).slice(0, 10));

    await startDate.fill(kst(4, 0).slice(0, 10));
    await expect(endDate).toHaveValue(kst(4, 0).slice(0, 10));

    // 시작 시각을 1시간 늦추면 종료도 1시간 늦춰진다 (18:00–22:00 → 19:00–23:00)
    await pick(page, dialog.getByRole('combobox', { name: '운영 시작 시각' }), '19:00');
    await expect(dialog.getByRole('combobox', { name: '운영 종료 시각' })).toHaveText('23:00');
    await expect(dialog.getByText('종료 일시는 시작보다 늦어야 해요')).toHaveCount(0);
  });

  test('새로 만든 자습실이 목록 끝에 생기면 그 카드로 스크롤한다', async ({ page, seed }) => {
    for (let i = 1; i <= 8; i++)
      await seed.room({ name: `기존 자습실 ${i}`, startDate: kst(1, 9), endDate: kst(1, 22) });
    await page.goto('/teacher/rooms?new=1');
    const dialog = page.getByRole('dialog', { name: '새 자습실' });
    await dialog.getByLabel('이름').fill('맨 끝에 생기는 자습실');
    await dialog.getByLabel('운영 시작', { exact: true }).fill(kst(6, 0).slice(0, 10));
    await dialog.getByRole('button', { name: '저장' }).click();

    await expect(page.getByRole('link', { name: '맨 끝에 생기는 자습실' })).toBeInViewport();
  });

  test('스크롤바가 생겨도 화면이 흔들리지 않게 자리를 잡아 둔다', async ({ page }) => {
    await page.goto('/teacher/rooms');
    const gutter = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollbarGutter,
    );
    expect(gutter).toBe('stable');
  });
});

test.describe('강사 · 이력', () => {
  test('신청·시간 변경·취소가 배지로 구분된다', async ({ page, seed }) => {
    await enterAsTeacher(page);
    const room = await seed.room({ name: 'A 자습실' });
    const s = await seed.student('김하늘', '010-1111-1111');
    const v = await seed.visit(s.id, room.id, kst(1, 11), kst(1, 12));
    await seed.cancelVisit(s.id, v.id);

    await page.goto(`/teacher/rooms/${room.id}?tab=histories`);
    const items = page.getByRole('listitem');
    // 최신(취소)이 위 — 동작 라벨이 색 있는 배지로 보인다
    await expect(items.first().getByText('취소', { exact: true })).toHaveClass(/bg-grey-100/);
    await expect(items.last().getByText('신청', { exact: true })).toHaveClass(/bg-blue-50/);
  });
});

test.describe('역할 선택', () => {
  test('역할을 고르는 화면에서는 이전 역할의 메뉴를 보여주지 않는다', async ({ page }) => {
    await enterAsTeacher(page);
    await page.goto('/teacher/rooms');
    await expect(nav(page)).toBeVisible();

    await page.getByRole('link', { name: /역할 바꾸기/ }).click();
    await expect(page).toHaveURL('/');
    await expect(nav(page)).toHaveCount(0);
    await expect(page.getByRole('banner')).not.toContainText('강사');
  });

  test('동명이인은 고른 뒤에도 번호 뒷자리로 구분된다', async ({ page, seed }) => {
    await seed.student('김하늘', '010-1111-1111');
    await seed.student('김하늘', '010-5656-7878');
    await page.goto('/');
    await page.getByRole('radio', { name: /학생/ }).click();
    const select = page.getByRole('combobox', { name: '이름을 골라 주세요' });
    await select.click();
    await page.getByRole('option').filter({ hasText: '7878' }).click();
    await expect(select).toContainText('김하늘');
    await expect(select).toContainText('010-****-7878');
  });
});

test.describe('학생 · 표기', () => {
  test('정원 막대는 남은 자리만큼 차고, 오늘·내일은 상대 날짜로 보인다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 10 });
    const others = await Promise.all(
      Array.from({ length: 8 }, (_, i) => seed.student(`학생${i}`, `010-2000-00${10 + i}`)),
    );
    for (const [i, o] of others.entries())
      await seed.visit(o.id, room.id, kst(1, 10 + i), kst(1, 11 + i));
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    const card = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    const meter = card.getByRole('meter', { name: '남은 자리' });
    await expect(meter).toHaveAttribute('aria-valuenow', '2');
    await expect(card).toContainText('내일 10:00 – 22:00');
  });

  test('신청 다이얼로그: 하루만 운영하면 날짜는 텍스트로, 고른 길이를 보여준다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);
    await page.goto(`/student/rooms?apply=${room.id}`);

    const dialog = page.getByRole('dialog', { name: 'A 자습실 방문 신청' });
    await expect(dialog.getByRole('combobox', { name: '날짜' })).toHaveCount(0);
    await expect(dialog).toContainText('내일');
    await expect(dialog).toContainText('2시간');
    await pick(page, dialog.getByRole('combobox', { name: '방문 종료 시각' }), '11:30');
    await expect(dialog).toContainText('1시간 30분');
  });

  test('내 신청 카드는 방문 시간이 가장 먼저 크게 보인다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await seed.visit(me.id, room.id, kst(1, 12), kst(1, 14));
    await enterAsStudent(page, me);

    await page.goto('/student/visits');
    const card = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    const time = card.getByText('내일 12:00 – 14:00');
    await expect(time).toHaveClass(/text-heading/);
    await expect(card.getByRole('heading', { name: 'A 자습실' })).toBeVisible();
    await expect(toast(page, '없음')).toHaveCount(0);
  });
});

/** 시간 선택 목록이 필드 아래로 열리고, 화면 안에 있으며, 고른 시각이 보이는지 */
async function expectOpensBelow(page: Page, trigger: Locator) {
  // 열리면 바깥 요소가 접근성 트리에서 가려지므로 위치는 열기 전에 잰다
  const t = (await trigger.boundingBox())!;
  await trigger.click();
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  const l = (await list.boundingBox())!;
  expect(l.y, '목록이 필드 아래에서 시작').toBeGreaterThanOrEqual(t.y + t.height);
  expect(l.y + l.height, '목록이 화면 안에').toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.getByRole('option', { selected: true })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
}

test.describe('시간 선택', () => {
  test('자습실 폼의 시각 목록은 아래로 열린다', async ({ page }) => {
    await enterAsTeacher(page);
    await page.goto('/teacher/rooms?new=1');
    const dialog = page.getByRole('dialog', { name: '새 자습실' });
    await expectOpensBelow(page, dialog.getByRole('combobox', { name: '운영 시작 시각' }));
    await expectOpensBelow(page, dialog.getByRole('combobox', { name: '운영 종료 시각' }));
  });

  test('방문 신청의 시각 목록은 아래로 열린다', async ({ page, seed }) => {
    const room = await seed.room({
      name: 'A 자습실',
      startDate: kst(1, 0),
      endDate: kst(1, 23, 30),
    });
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);
    await page.goto(`/student/rooms?apply=${room.id}`);
    const dialog = page.getByRole('dialog', { name: 'A 자습실 방문 신청' });
    await expectOpensBelow(page, dialog.getByRole('combobox', { name: '방문 시작 시각' }));
    await expectOpensBelow(page, dialog.getByRole('combobox', { name: '방문 종료 시각' }));
  });
});
