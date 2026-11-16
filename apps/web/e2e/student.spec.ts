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

  test('정원이 찬 자습실은 신청 대신 대기 등록을 보여주고 이유를 알려준다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const other = await seed.student('이도윤', '010-2222-2222');
    await seed.visit(other.id, room.id, kst(1, 11), kst(1, 12));
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    const card = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    await expect(card).toContainText('정원 마감');
    await expect(card.getByRole('button', { name: '방문 신청' })).toHaveCount(0);
    await expect(card.getByRole('button', { name: '대기 등록' })).toHaveAccessibleDescription(
      '정원이 다 찼어요',
    );
  });

  test('다이얼로그를 연 사이 정원이 차면 알리고, 다른 자습실이 없으면 대기 등록을 안내한다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const me = await seed.student('김하늘', '010-1111-1111');
    const other = await seed.student('이도윤', '010-2222-2222');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms?apply=${room.id}`);
    const dialog = page.getByRole('dialog', { name: 'A 자습실 방문 신청' });
    await expect(dialog).toBeVisible();
    await seed.visit(other.id, room.id, kst(1, 15), kst(1, 16)); // 다른 학생이 먼저
    await dialog.getByRole('button', { name: '신청하기' }).click();

    await expect(dialog).toBeHidden();
    const notice = page.getByRole('dialog', { name: 'A 자습실 정원이 방금 찼어요' });
    await expect(notice).toContainText('자리가 남은 자습실이 없어요');
    await expect(notice.getByRole('button', { name: '이 시간으로 대기 등록' })).toBeVisible();
    await notice.getByRole('button', { name: '닫기' }).last().click();
    await expect(page.getByRole('listitem').filter({ hasText: 'A 자습실' })).toContainText(
      '정원 마감',
    );
  });

  test('정원이 차면 같은 시간에 자리가 남은 자습실로 이어서 신청한다', async ({ page, seed }) => {
    const roomA = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const roomB = await seed.room({ name: 'B 자습실', maxPersonnel: 5 });
    const roomC = await seed.room({ name: 'C 자습실', maxPersonnel: 1 });
    await seed.room({ name: 'D 자습실', startDate: kst(1, 15) }); // 오전 시간은 운영 전
    const me = await seed.student('김하늘', '010-1111-1111');
    const other = await seed.student('이도윤', '010-2222-2222');
    await seed.visit(other.id, roomC.id, kst(1, 18), kst(1, 19)); // C는 이미 마감
    await enterAsStudent(page, me);

    // 기본 선택(10:00–12:00)으로 A 신청 → 그 사이 다른 학생이 A의 마지막 자리를 가져감
    await page.goto(`/student/rooms?apply=${roomA.id}`);
    const applyA = page.getByRole('dialog', { name: 'A 자습실 방문 신청' });
    await expect(applyA.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await seed.visit(other.id, roomA.id, kst(1, 15), kst(1, 16));
    await applyA.getByRole('button', { name: '신청하기' }).click();

    // 같은 시간에 자리가 있는 곳만 안내 (C는 마감, D는 운영 기간 밖)
    const alternatives = page.getByRole('dialog', { name: 'A 자습실 정원이 방금 찼어요' });
    await expect(alternatives).toContainText('10:00 – 12:00');
    await expect(alternatives.getByRole('listitem')).toHaveCount(1);
    await expect(alternatives).toContainText('B 자습실');
    await expect(alternatives).toContainText('남은 자리 5 / 5');

    // 고른 자습실의 신청 다이얼로그가 같은 시간으로 열린다
    await alternatives.getByRole('button', { name: 'B 자습실 이 시간으로 신청' }).click();
    await expect(page).toHaveURL(new RegExp(`apply=${roomB.id}&slot=`));
    const applyB = page.getByRole('dialog', { name: 'B 자습실 방문 신청' });
    await expect(applyB.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await expect(applyB.getByRole('combobox', { name: '방문 종료 시각' })).toHaveText('12:00');
    await applyB.getByRole('button', { name: '신청하기' }).click();

    await expect(toast(page, /방문을 신청했어요\. .* 10:00 – 12:00/)).toBeVisible();
    await expect(page).not.toHaveURL(/slot=/);
    await expect(page.getByRole('listitem').filter({ hasText: 'B 자습실' })).toContainText(
      '신청함',
    );
  });

  test('다시 신청이 정원 마감으로 거절되면 자습실 목록에서 같은 시간으로 이어서 신청한다', async ({
    page,
    seed,
  }) => {
    const roomA = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    await seed.room({ name: 'B 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    const other = await seed.student('이도윤', '010-2222-2222');
    const mine = await seed.visit(me.id, roomA.id, kst(1, 11), kst(1, 12));
    await seed.cancelVisit(me.id, mine.id);
    await enterAsStudent(page, me);

    await page.goto(`/student/visits?apply=${roomA.id}`);
    const reapply = page.getByRole('dialog', { name: 'A 자습실 방문 신청' });
    await expect(reapply).toBeVisible();
    await seed.visit(other.id, roomA.id, kst(1, 15), kst(1, 16));
    await reapply.getByRole('button', { name: '신청하기' }).click();

    const alternatives = page.getByRole('dialog', { name: 'A 자습실 정원이 방금 찼어요' });
    await alternatives.getByRole('button', { name: 'B 자습실 이 시간으로 신청' }).click();
    await expect(page).toHaveURL(/\/student\/rooms\?apply=\d+&slot=/);
    await expect(page.getByRole('dialog', { name: 'B 자습실 방문 신청' })).toBeVisible();
  });

  test('내 다른 신청과 겹치는 시간은 고를 수 없다', async ({ page, seed }) => {
    const roomA = await seed.room({ name: 'A 자습실' });
    await seed.room({ name: 'B 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await seed.visit(me.id, roomA.id, kst(1, 10), kst(1, 12));
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    await page
      .getByRole('listitem')
      .filter({ hasText: 'B 자습실' })
      .getByRole('button', { name: '방문 신청' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'B 자습실 방문 신청' });
    await expect(dialog).toContainText('내 다른 신청과 겹치는 시간은 고를 수 없어요');

    // 겹치지 않는 첫 시각(A 신청이 끝나는 12:00)부터 고른다 — 맞닿는 구간은 허용
    const startSelect = dialog.getByRole('combobox', { name: '방문 시작 시각' });
    await expect(startSelect).toHaveText('12:00');
    await startSelect.click();
    const blocked = page.getByRole('option', { name: /^11:30/ });
    await expect(blocked).toHaveAttribute('aria-disabled', 'true');
    await expect(blocked).toContainText('다른 신청');
    await page.keyboard.press('Escape');

    await pick(page, dialog.getByRole('combobox', { name: '방문 종료 시각' }), '13:00');
    await dialog.getByRole('button', { name: '신청하기' }).click();
    await expect(toast(page, /방문을 신청했어요\. .* 12:00 – 13:00/)).toBeVisible();
  });

  test('다이얼로그를 연 사이 겹치는 신청이 생기면 이유를 보여주고 막는다', async ({
    page,
    seed,
  }) => {
    const roomA = await seed.room({ name: 'A 자습실' });
    const roomB = await seed.room({ name: 'B 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms?apply=${roomB.id}`);
    const dialog = page.getByRole('dialog', { name: 'B 자습실 방문 신청' });
    await expect(dialog.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await seed.visit(me.id, roomA.id, kst(1, 10), kst(1, 12)); // 다른 탭에서 먼저 신청
    await dialog.getByRole('button', { name: '신청하기' }).click();

    await expect(dialog).toContainText(
      '같은 시간에 신청한 다른 자습실이 있어요. 겹치지 않는 시간을 골라 주세요',
    );
    // 내 신청을 다시 받아 겹치는 신청을 알려주고 제출을 막는다
    await expect(dialog).toContainText('A 자습실 신청(10:00 – 12:00)과 겹쳐요');
    await expect(dialog.getByRole('button', { name: '신청하기' })).toBeDisabled();
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
