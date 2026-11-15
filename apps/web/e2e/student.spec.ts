import { enterAsStudent, expect, kst, test } from './support/fixtures';
import { expectNoHorizontalScroll, nav, pick, toast } from './support/ui';

test.describe('학생 · 방문 신청', () => {
  test('신청 → 시간 변경 → 취소 → 다시 신청', async ({ page, seed }) => {
    await seed.room({ name: 'A 자습실', maxPersonnel: 5 });
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    const card = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    await expect(card).toContainText('남은 자리 5 / 5');
    await expectNoHorizontalScroll(page);

    // 신청 — 운영 기간(내일 10:00–22:00) 안의 30분 단위만 고를 수 있다
    await card.getByRole('button', { name: '방문 신청' }).click();
    const dialog = page.getByRole('dialog', { name: 'A 자습실 방문 신청' });
    await expect(dialog.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await pick(page, dialog.getByRole('combobox', { name: '방문 시작 시각' }), '11:00');
    await pick(page, dialog.getByRole('combobox', { name: '방문 종료 시각' }), '13:00');
    await dialog.getByRole('button', { name: '신청하기' }).click();

    await expect(toast(page, /방문을 신청했어요\. .* 11:00 – 13:00/)).toBeVisible();
    await expect(card).toContainText('신청함');
    await expect(card).toContainText('11:00 – 13:00');
    await expect(card).toContainText('남은 자리 4 / 5');
    // 헤더 "내 신청" 배지
    await expect(nav(page).getByRole('link', { name: /내 신청.*1/ })).toBeVisible();

    // 시간 변경 — 그대로면 변경 버튼 비활성
    await card.getByRole('button', { name: '시간 변경' }).click();
    const edit = page.getByRole('dialog', { name: 'A 자습실 시간 변경' });
    await expect(edit.getByRole('button', { name: '변경하기' })).toBeDisabled();
    await pick(page, edit.getByRole('combobox', { name: '방문 시작 시각' }), '12:00');
    await edit.getByRole('button', { name: '변경하기' }).click();
    await expect(toast(page, '방문 시간을 바꿨어요. 11:00 → 12:00')).toBeVisible();

    // 취소 — 내 신청에서
    await nav(page)
      .getByRole('link', { name: /내 신청/ })
      .click();
    await expect(page).toHaveURL('/student/visits');
    const visit = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    await expect(visit).toContainText('12:00 – 13:00');
    await visit.getByRole('button', { name: '취소' }).click();
    const confirm = page.getByRole('alertdialog', { name: '방문을 취소할까요?' });
    await expect(confirm).toContainText('A 자습실');
    await confirm.getByRole('button', { name: '방문 취소' }).click();
    await expect(toast(page, '방문을 취소했어요')).toBeVisible();
    await expect(page.getByText('아직 신청한 방문이 없어요')).toBeVisible();
    await expect(nav(page).getByRole('link', { name: /내 신청.*1/ })).toHaveCount(0);

    // 다시 신청
    await page.getByRole('tab', { name: /취소됨/ }).click();
    await page.getByRole('button', { name: '다시 신청' }).click();
    await page
      .getByRole('dialog', { name: 'A 자습실 방문 신청' })
      .getByRole('button', { name: '신청하기' })
      .click();
    await expect(toast(page, /방문을 신청했어요/)).toBeVisible();
    await expect(page.getByRole('tab', { name: /예정\s*1/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('정원이 찬 자습실은 신청 버튼이 비활성이고 이유를 보여준다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const other = await seed.student('이도윤', '010-2222-2222');
    await seed.visit(other.id, room.id, kst(1, 11), kst(1, 12));
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    const card = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    await expect(card).toContainText('정원 마감');
    await expect(card.getByRole('button', { name: '방문 신청' })).toBeDisabled();
    await expect(card.getByRole('button', { name: '방문 신청' })).toHaveAccessibleDescription(
      '정원이 다 찼어요',
    );
  });

  test('다이얼로그를 연 사이 정원이 차면 알려주고 목록을 갱신한다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const me = await seed.student('김하늘', '010-1111-1111');
    const other = await seed.student('이도윤', '010-2222-2222');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms?apply=${room.id}`);
    const dialog = page.getByRole('dialog', { name: 'A 자습실 방문 신청' });
    await expect(dialog).toBeVisible();
    await seed.visit(other.id, room.id, kst(1, 15), kst(1, 16)); // 다른 학생이 먼저
    await dialog.getByRole('button', { name: '신청하기' }).click();

    await expect(toast(page, '방금 정원이 다 찼어요. 다른 자습실을 골라 주세요')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('listitem').filter({ hasText: 'A 자습실' })).toContainText(
      '정원 마감',
    );
  });

  test('자습실이 삭제되어 취소된 신청은 사유와 함께 남는다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await seed.visit(me.id, room.id, kst(1, 11), kst(1, 12));
    await seed.deleteRoom(room.id);
    await enterAsStudent(page, me);

    await page.goto('/student/visits');
    await page.getByRole('tab', { name: /취소됨/ }).click();
    const visit = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    await expect(visit).toContainText('자습실이 삭제되어 자동으로 취소됐어요');
    await expect(visit.getByRole('button', { name: '다시 신청' })).toHaveCount(0);
  });

  test('선택한 학생이 삭제되면 역할 선택으로 돌려보낸다', async ({ page, seed }) => {
    await enterAsStudent(page, { id: 999, name: '없는 학생', phone: '010-0000-0000' });
    await page.goto('/student/rooms');
    await expect(page).toHaveURL('/');
    await expect(toast(page, '선택한 학생 정보가 삭제됐어요. 다시 골라 주세요')).toBeVisible();
    void seed;
  });
});

test.describe('학생 · 키보드만으로', () => {
  test('Tab·Enter·Esc로 신청 다이얼로그를 열고 닫는다', async ({ page, seed }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '키보드 흐름은 데스크톱에서만 확인');
    await seed.room({ name: 'A 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    const apply = page.getByRole('button', { name: '방문 신청' });
    await apply.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'A 자습실 방문 신청' });
    // 하루만 운영하는 자습실은 날짜를 고를 필요가 없어 시작 시각으로 바로 포커스
    await expect(dialog.getByRole('combobox', { name: '방문 시작 시각' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL('/student/rooms');
    await expect(apply).toBeFocused();
  });
});
