import { enterAsTeacher, expect, kst, test } from './support/fixtures';
import { expectNoHorizontalScroll, pick, toast } from './support/ui';

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
    await expect(page.getByText('3석 · 예약 0건')).toBeVisible();
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
    await expect(page.getByText('4석 · 예약 2건')).toBeVisible();
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
    await expect(page.getByRole('cell', { name: '김하늘', exact: true })).toBeVisible();
  });
});

test.describe('강사 · 자습실 상세 · 삭제', () => {
  test('이력 탭에서 신청·변경·취소를 시간순으로 보고 거를 수 있다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실' });
    const a = await seed.student('김하늘', '010-1111-1111');
    const b = await seed.student('이도윤', '010-2222-2222');
    const va = await seed.visit(a.id, room.id, kst(1, 11), kst(1, 12));
    await seed.changeVisit(a.id, va.id, kst(1, 13), kst(1, 14));
    const vb = await seed.visit(b.id, room.id, kst(1, 15), kst(1, 16));
    await seed.cancelVisit(b.id, vb.id);

    await page.goto(`/teacher/rooms/${room.id}`);
    // 신청자: 취소한 학생은 빠진다
    await expect(page.getByRole('tab', { name: /신청자\s*1/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: '김하늘', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '이도윤', exact: true })).toHaveCount(0);

    await page.getByRole('tab', { name: /이력/ }).click();
    const items = page.getByRole('listitem');
    await expect(items).toHaveCount(4);
    // 최신이 위
    await expect(items.first()).toContainText('이도윤');
    await expect(items.first()).toContainText('취소');
    await expect(page.getByText('시간 변경')).toBeVisible();

    await pick(page, page.getByRole('combobox', { name: '이력 종류' }), '취소');
    await expect(items).toHaveCount(1);

    await pick(page, page.getByRole('combobox', { name: '이력 종류' }), '전체');
    await page.getByRole('searchbox', { name: '학생 이름으로 찾기' }).fill('하늘');
    await expect(items).toHaveCount(2);
  });

  test('신청자 탭은 연락처를 함께 보여 동명이인을 구분한다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실' });
    const a = await seed.student('김하늘', '010-1111-1111');
    const b = await seed.student('김하늘', '010-5656-7878');
    const c = await seed.student('이도윤', '010-3333-3333');
    await seed.visit(a.id, room.id, kst(1, 13), kst(1, 14));
    await seed.visit(b.id, room.id, kst(1, 10), kst(1, 11));
    const canceled = await seed.visit(c.id, room.id, kst(1, 11), kst(1, 12));
    await seed.cancelVisit(c.id, canceled.id);

    await page.goto(`/teacher/rooms/${room.id}`);
    await expect(page.getByRole('tab', { name: /신청자\s*2/ })).toBeVisible();
    const rows = page.getByRole('row');
    // 머리글 + 2명, 방문 시작 순 — 취소한 학생은 빠진다
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText('김하늘');
    await expect(rows.nth(1)).toContainText('010-5656-7878');
    await expect(rows.nth(2)).toContainText('010-1111-1111');
    await expect(page.getByRole('cell', { name: '이도윤', exact: true })).toHaveCount(0);
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
