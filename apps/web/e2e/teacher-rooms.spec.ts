import { enterAsTeacher, expect, kst, test } from './support/fixtures';
import type { Page } from '@playwright/test';
import { expectNoHorizontalScroll, pick, toast } from './support/ui';

/** 왼쪽 패널의 신청 학생 목록 */
const applicantList = (page: Page) => page.getByRole('region', { name: /신청 학생/ });
/** 좌석 배치도의 n번 좌석 */
const seat = (page: Page, n: number) =>
  page.getByRole('list', { name: '좌석 배치도' }).locator(`[data-seat="${n}"]`);

async function expectSummary(page: Page, n: { occupied: number; free: number }) {
  const summary = page.getByTestId('seat-summary');
  await expect(summary.getByRole('definition').nth(0)).toHaveText(String(n.occupied));
  await expect(summary.getByRole('definition').nth(1)).toHaveText(String(n.free));
}

test.beforeEach(async ({ page }) => {
  await enterAsTeacher(page);
});

test.describe('강사 · 자습실 등록', () => {
  test('빈 목록에서 자습실을 열면 목록에 나타난다', async ({ page }) => {
    await page.goto('/teacher/rooms');
    await expect(page.getByText('아직 연 자습실이 없어요')).toBeVisible();

    await page.getByRole('button', { name: '새 자습실' }).first().click();
    const dialog = page.getByRole('dialog', { name: '새 자습실' });
    await expect(page).toHaveURL(/\?new=1/);
    // 열리면 첫 입력으로 포커스
    await expect(dialog.getByLabel('이름')).toBeFocused();

    await dialog.getByLabel('이름').fill('3층 A 자습실');
    await dialog.getByLabel('최대 인원').fill('3');
    await dialog.getByRole('button', { name: '저장' }).click();

    await expect(toast(page, '자습실을 열었어요')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL('/teacher/rooms');
    await expect(page.getByRole('link', { name: '3층 A 자습실' })).toBeVisible();
    await expect(page.getByText('좌석 3석')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('입력이 잘못되면 저장하지 않고 이유를 보여준다', async ({ page }) => {
    await page.goto('/teacher/rooms?new=1');
    const dialog = page.getByRole('dialog', { name: '새 자습실' });

    await dialog.getByRole('button', { name: '저장' }).click();
    await expect(dialog.getByText('자습실 이름을 적어 주세요')).toBeVisible();
    await expect(dialog.getByLabel('이름')).toBeFocused();

    await dialog.getByLabel('이름').fill('B 자습실');
    await pick(page, dialog.getByRole('combobox', { name: '운영 종료 시각' }), '17:00');
    await dialog.getByRole('button', { name: '저장' }).click();
    await expect(dialog.getByText('종료 일시는 시작보다 늦어야 해요')).toBeVisible();
    await expect(dialog).toBeVisible();
  });
});

test.describe('강사 · 자습실 수정', () => {
  test('없어질 좌석에 끝나지 않은 예약이 있으면 좌석을 줄일 수 없다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 5 });
    const a = await seed.student('김하늘', '010-1111-1111');
    const b = await seed.student('이도윤', '010-2222-2222');
    await seed.visit(a.id, room.id, kst(1, 11), kst(1, 12), { seat: 1 });
    await seed.visit(b.id, room.id, kst(1, 13), kst(1, 14), { seat: 4 });

    await page.goto('/teacher/rooms');
    await page.getByRole('button', { name: 'A 자습실 메뉴' }).click();
    await page.getByRole('menuitem', { name: '수정' }).click();

    const dialog = page.getByRole('dialog', { name: '자습실 수정' });
    await expect(dialog.getByText('좌석 수예요 (1~30석)')).toBeVisible();
    // 줄이면 없어질 좌석을 입력 즉시 알린다 (막지는 않음 — 서버가 판단)
    await dialog.getByLabel('최대 인원').fill('3');
    await expect(dialog.getByText('4번, 5번 좌석이 없어져요')).toBeVisible();
    await dialog.getByRole('button', { name: '저장' }).click();
    await expect(
      dialog.getByText('없어질 좌석에 끝나지 않은 예약이 있어 3석으로 줄일 수 없어요'),
    ).toBeVisible();
    await expect(dialog).toBeVisible();

    // 예약이 없는 좌석만 없어지면 줄일 수 있다
    await dialog.getByLabel('최대 인원').fill('4');
    await expect(dialog.getByText('5번 좌석이 없어져요')).toBeVisible();
    await dialog.getByRole('button', { name: '저장' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('좌석 4석', { exact: true })).toBeVisible();
  });

  test('운영 기간 밖으로 밀려나는 신청이 있으면 막고 신청자를 보여준다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실' });
    const a = await seed.student('김하늘', '010-1111-1111');
    await seed.visit(a.id, room.id, kst(1, 11), kst(1, 12));

    await page.goto(`/teacher/rooms/${room.id}?edit=1`);
    const dialog = page.getByRole('dialog', { name: '자습실 수정' });
    await pick(page, dialog.getByRole('combobox', { name: '운영 시작 시각' }), '13:00');
    await dialog.getByRole('button', { name: '저장' }).click();

    await expect(dialog.getByRole('alert')).toContainText('새 운영 기간 밖에 있는 신청이 있어요');
    await dialog.getByRole('link', { name: '신청 학생 보기' }).click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/teacher/rooms/${room.id}$`));
    await expect(applicantList(page).getByRole('button', { name: /김하늘/ })).toBeVisible();
  });
});

test.describe('강사 · 자습실 상세 · 좌석 현황 (#51)', () => {
  test('시각을 고르면 그 시각의 좌석 배치도와 요약 숫자를 보여준다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 10 });
    const a = await seed.student('김하늘', '010-1111-1111');
    const b = await seed.student('이도윤', '010-2222-2222');
    const c = await seed.student('한지우', '010-3333-3333');
    await seed.visit(a.id, room.id, kst(1, 11), kst(1, 13), { seat: 1 });
    await seed.visit(b.id, room.id, kst(1, 10), kst(1, 12), { seat: 4 });
    await seed.visit(c.id, room.id, kst(1, 13), kst(1, 14), { seat: 2 });

    await page.goto(`/teacher/rooms/${room.id}`);
    // 운영 전이면 운영 시작(10:00)부터 본다
    const time = page.getByRole('combobox', { name: '볼 시각' });
    await expect(time).toContainText('10:00');
    await expect(seat(page, 4)).toHaveAccessibleName('4번 좌석, 이도윤, 10:00 – 12:00');
    await expect(seat(page, 1)).toHaveAccessibleName('1번 좌석, 비어 있음');
    await expectSummary(page, { occupied: 1, free: 9 });
    // 운영 시간이 아니면 [지금]이 없다
    await expect(page.getByRole('button', { name: '지금' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '30분 앞으로' })).toBeDisabled();

    await pick(page, time, '11:00');
    await expect(seat(page, 1)).toContainText('김하늘');
    await expect(seat(page, 4)).toContainText('이도윤');
    await expectSummary(page, { occupied: 2, free: 8 });

    // 30분씩 옮기기 — 12:00에는 이도윤이 끝났다 (끝 시각은 포함하지 않음)
    await page.getByRole('button', { name: '30분 뒤로' }).click();
    await page.getByRole('button', { name: '30분 뒤로' }).click();
    await expect(time).toContainText('12:00');
    await expect(seat(page, 4)).toHaveAccessibleName('4번 좌석, 비어 있음');
    await expectNoHorizontalScroll(page);
  });

  test('신청 학생을 누르면 그 학생의 좌석을 강조하고, 필요하면 시각을 옮긴다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 10 });
    const a = await seed.student('김하늘', '010-1111-1111');
    const c = await seed.student('한지우', '010-3333-3333');
    await seed.visit(a.id, room.id, kst(1, 10), kst(1, 12), { seat: 1 });
    await seed.visit(c.id, room.id, kst(1, 13), kst(1, 14), { seat: 2 });

    await page.goto(`/teacher/rooms/${room.id}`);
    const haneul = applicantList(page).getByRole('button', { name: /김하늘/ });
    const jiwoo = applicantList(page).getByRole('button', { name: /한지우/ });
    // 고른 시각(10:00)에 앉아 있는 학생만 표시
    await expect(haneul).toContainText('고른 시각에 이용 중');
    await expect(jiwoo).not.toContainText('고른 시각에 이용 중');

    await haneul.click();
    await expect(haneul).toHaveAttribute('aria-pressed', 'true');
    await expect(seat(page, 1)).toHaveAttribute('data-highlighted', 'true');

    // 그 시각에 없는 학생을 누르면 방문 시작으로 옮긴 뒤 강조한다
    await jiwoo.click();
    await expect(page.getByRole('combobox', { name: '볼 시각' })).toContainText('13:00');
    await expect(page.getByText('한지우 학생 방문 시각(13:00)으로 옮겼어요')).toBeAttached();
    await expect(seat(page, 2)).toHaveAttribute('data-highlighted', 'true');
    await expect(seat(page, 1)).not.toHaveAttribute('data-highlighted');
    await expect(haneul).toHaveAttribute('aria-pressed', 'false');

    // 시각을 직접 바꿔 그 학생이 없어지면 강조를 푼다
    await page.getByRole('button', { name: '30분 뒤로' }).click();
    await page.getByRole('button', { name: '30분 뒤로' }).click();
    await expect(jiwoo).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-highlighted]')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});

test.describe('강사 · 자습실 상세 · 삭제', () => {
  test('이력 탭에서 신청·변경·취소를 시간순으로 보고 거를 수 있다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실' });
    const a = await seed.student('김하늘', '010-1111-1111');
    const b = await seed.student('이도윤', '010-2222-2222');
    const va = await seed.visit(a.id, room.id, kst(1, 11), kst(1, 12), { seat: 3 });
    await seed.changeVisit(a.id, va.id, kst(1, 11), kst(1, 12), {
      studyRoomId: room.id,
      seat: 7,
    });
    const vb = await seed.visit(b.id, room.id, kst(1, 15), kst(1, 16));
    await seed.cancelVisit(b.id, vb.id);

    await page.goto(`/teacher/rooms/${room.id}`);
    // 신청 학생: 취소한 학생은 빠진다
    await expect(applicantList(page).getByRole('button')).toHaveCount(1);
    await expect(applicantList(page).getByRole('button', { name: /김하늘/ })).toBeVisible();

    await page.getByRole('tab', { name: /이력/ }).click();
    await expect(page).toHaveURL(/\?tab=histories/);
    const items = page.getByRole('region', { name: '이력' }).getByRole('listitem');
    await expect(items).toHaveCount(4);
    // 최신이 위
    await expect(items.first()).toContainText('이도윤');
    await expect(items.first()).toContainText('취소');
    // 좌석만 바꾼 변경은 이전 → 이후 좌석만 (#51)
    const change = items.filter({ hasText: '변경' });
    await expect(change).toHaveCount(1);
    await expect(change.getByTestId('history-seat')).toContainText('3번');
    await expect(change.getByTestId('history-seat')).toContainText('7번 좌석');
    await expect(items.last()).toContainText('3번 좌석');

    await pick(page, page.getByRole('combobox', { name: '이력 종류' }), '취소');
    await expect(items).toHaveCount(1);

    await pick(page, page.getByRole('combobox', { name: '이력 종류' }), '전체');
    await page.getByRole('searchbox', { name: '학생 이름으로 찾기' }).fill('하늘');
    await expect(items).toHaveCount(2);
  });

  test('신청 학생은 연락처를 함께 보여 동명이인을 구분한다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실' });
    const a = await seed.student('김하늘', '010-1111-1111');
    const b = await seed.student('김하늘', '010-5656-7878');
    const c = await seed.student('이도윤', '010-3333-3333');
    await seed.visit(a.id, room.id, kst(1, 13), kst(1, 14));
    await seed.visit(b.id, room.id, kst(1, 10), kst(1, 11));
    const canceled = await seed.visit(c.id, room.id, kst(1, 11), kst(1, 12));
    await seed.cancelVisit(c.id, canceled.id);

    await page.goto(`/teacher/rooms/${room.id}`);
    const rows = applicantList(page).getByRole('button');
    // 2명, 방문 시작 순 — 취소한 학생은 빠진다
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('010-5656-7878');
    await expect(rows.nth(1)).toContainText('010-1111-1111');
    await expect(applicantList(page)).not.toContainText('이도윤');
  });

  test('삭제하면 영향받는 신청 수를 알려주고, 확인 후 목록에서 사라진다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실' });
    await seed.room({ name: 'B 자습실' });
    const a = await seed.student('김하늘', '010-1111-1111');
    await seed.visit(a.id, room.id, kst(1, 11), kst(1, 12));

    await page.goto('/teacher/rooms');
    await page.getByRole('button', { name: 'A 자습실 메뉴' }).click();
    await page.getByRole('menuitem', { name: '삭제' }).click();

    const confirm = page.getByRole('alertdialog', { name: '자습실을 삭제할까요?' });
    await expect(confirm).toContainText('신청한 학생 1명의 신청이 모두 취소돼요');
    // 기본 포커스는 안전한 쪽
    await expect(confirm.getByRole('button', { name: '닫기' })).toBeFocused();
    await confirm.getByRole('button', { name: '삭제' }).click();

    await expect(toast(page, '자습실을 삭제했어요')).toBeVisible();
    await expect(page.getByRole('link', { name: 'A 자습실' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'B 자습실' })).toBeVisible();
  });

  test('삭제된 자습실 주소로 들어오면 안내하고 목록으로 돌아갈 수 있다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실' });
    await seed.deleteRoom(room.id);

    await page.goto(`/teacher/rooms/${room.id}`);
    await expect(page.getByText('삭제된 자습실이에요')).toBeVisible();
    await page.getByRole('link', { name: '목록으로' }).click();
    await expect(page).toHaveURL('/teacher/rooms');
  });
});
