import { enterAsTeacher, expect, kst, test } from './support/fixtures';
import { toast } from './support/ui';

test.beforeEach(async ({ page }) => {
  await enterAsTeacher(page);
});

test('학생을 등록·수정·삭제하고, 중복 전화번호는 막는다', async ({ page, seed }) => {
  await seed.student('김하늘', '010-1111-1111');
  await page.goto('/teacher/students');
  await expect(page.getByText('등록된 학생 1명')).toBeVisible();

  // 등록 — 중복 번호
  await page.getByRole('button', { name: '학생 등록' }).click();
  const dialog = page.getByRole('dialog', { name: '학생 등록' });
  await dialog.getByLabel('이름').fill('이도윤');
  await dialog.getByLabel('휴대폰 번호').fill('01011111111');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('이미 등록된 전화번호예요')).toBeVisible();
  await expect(dialog.getByLabel('휴대폰 번호')).toBeFocused();

  // 하이픈 없이 적어도 정규화되어 저장
  await dialog.getByLabel('휴대폰 번호').fill('01022223333');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(toast(page, '이도윤 학생을 등록했어요')).toBeVisible();
  await expect(page.getByRole('row', { name: /이도윤/ })).toContainText('010-2222-3333');

  // 수정
  await page.getByRole('button', { name: '이도윤 메뉴' }).click();
  await page.getByRole('menuitem', { name: '수정' }).click();
  const edit = page.getByRole('dialog', { name: '학생 정보 수정' });
  await expect(edit.getByLabel('이름')).toHaveValue('이도윤');
  await edit.getByLabel('이름').fill('이도현');
  await edit.getByRole('button', { name: '저장' }).click();
  await expect(toast(page, '변경 내용을 저장했어요')).toBeVisible();
  await expect(page.getByRole('cell', { name: '이도현', exact: true })).toBeVisible();

  // 검색
  await page.getByRole('searchbox', { name: '이름·전화번호로 찾기' }).fill('3333');
  await expect(page.getByRole('row')).toHaveCount(2); // 머리글 + 1명
});

test('학생을 삭제하면 유효 신청 수를 알려주고 목록에서 뺀다', async ({ page, seed }) => {
  const room = await seed.room({ name: 'A 자습실' });
  const s = await seed.student('김하늘', '010-1111-1111');
  await seed.visit(s.id, room.id, kst(1, 11), kst(1, 12));

  await page.goto('/teacher/students');
  await page.getByRole('button', { name: '김하늘 메뉴' }).click();
  await page.getByRole('menuitem', { name: '삭제' }).click();

  const confirm = page.getByRole('alertdialog', { name: '김하늘 학생을 삭제할까요?' });
  await expect(confirm).toContainText('유효 신청 1건이 취소돼요');
  await confirm.getByRole('button', { name: '삭제' }).click();

  await expect(toast(page, '김하늘 학생을 삭제했어요')).toBeVisible();
  await expect(page.getByText('등록된 학생이 없어요')).toBeVisible();
});
