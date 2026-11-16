import { enterAsStudent, enterAsTeacher, expect, kst, test } from './support/fixtures';
import { expectNoHorizontalScroll, nav, toast } from './support/ui';

/** 대기열: 정원 마감 시 대기 등록과 자리 제안 (#36) */
test.describe('학생 · 대기열', () => {
  test('정원 마감 카드에서 원하는 시간으로 대기 등록하고, 내 신청 대기 탭에서 취소한다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const other = await seed.student('이도윤', '010-2222-2222');
    await seed.visit(other.id, room.id, kst(1, 18), kst(1, 20));
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    const card = page.getByRole('main').getByRole('listitem').filter({ hasText: 'A 자습실' });
    await card.getByRole('button', { name: '대기 등록' }).click();
    const dialog = page.getByRole('dialog', { name: 'A 자습실 대기 등록' });
    await expect(dialog).toContainText('자리가 나면 순번대로 10분 동안 자리를 잡아 드려요');
    await expect(dialog.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await dialog.getByRole('button', { name: '대기 등록' }).click();

    await expect(toast(page, 'A 자습실 대기 등록했어요. 1번째예요')).toBeVisible();
    await expect(card).toContainText('대기 중');
    await expect(card).toContainText('대기 1번째');
    await expectNoHorizontalScroll(page);

    await card.getByRole('link', { name: '내 대기 보기' }).click();
    await expect(page).toHaveURL('/student/visits?tab=waitlist');
    await expect(page.getByRole('tab', { name: /대기\s*1/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const wait = page.getByTestId('wait').filter({ hasText: 'A 자습실' });
    await expect(wait).toContainText('대기 1번째');
    await wait.getByRole('button', { name: '대기 취소' }).click();
    const confirm = page.getByRole('alertdialog', { name: '대기를 취소할까요?' });
    await expect(confirm).toContainText('순번이 사라지고');
    await confirm.getByRole('button', { name: '대기 취소' }).click();

    await expect(toast(page, '대기를 취소했어요')).toBeVisible();
    await expect(wait).toContainText('취소됨');
    await expect(wait).toContainText('본인 취소');
  });

  test('신청이 정원 마감으로 거절되면 그 시간으로 바로 대기 등록한다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const me = await seed.student('김하늘', '010-1111-1111');
    const other = await seed.student('이도윤', '010-2222-2222');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms?apply=${room.id}`);
    const dialog = page.getByRole('dialog', { name: 'A 자습실 방문 신청' });
    await expect(dialog.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await seed.visit(other.id, room.id, kst(1, 18), kst(1, 20));
    await dialog.getByRole('button', { name: '신청하기' }).click();

    const notice = page.getByRole('dialog', { name: 'A 자습실 정원이 방금 찼어요' });
    await notice.getByRole('button', { name: '이 시간으로 대기 등록' }).click();
    await expect(toast(page, 'A 자습실 대기 등록했어요. 1번째예요')).toBeVisible();
    const card = page.getByRole('main').getByRole('listitem').filter({ hasText: 'A 자습실' });
    await expect(card).toContainText('대기 1번째 · 내일 10:00 – 12:00');
  });

  test('자리가 나면 상단 배너로 알리고, 원하던 시간으로 확정한다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const holder = await seed.student('이도윤', '010-2222-2222');
    const held = await seed.visit(holder.id, room.id, kst(1, 18), kst(1, 20));
    const me = await seed.student('김하늘', '010-1111-1111');
    await seed.wait(me.id, room.id, kst(1, 10), kst(1, 12));
    await seed.cancelVisit(holder.id, held.id); // 자리가 나서 1번 대기자인 나에게 제안
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    const banner = page.getByRole('region', { name: '자리 제안' });
    await expect(banner).toContainText('A 자습실 자리가 났어요');
    await expect(banner).toContainText(/내일 10:00 – 12:00 · 확정까지 \d+:\d\d/);
    await expect(nav(page).getByTestId('nav-attention')).toBeVisible();
    // 대기자 몫이라 다른 학생에게는 남은 자리가 없다
    await expect(
      page.getByRole('main').getByRole('listitem').filter({ hasText: 'A 자습실' }),
    ).toContainText('자리 제안');
    await expectNoHorizontalScroll(page);

    await banner.getByRole('button', { name: 'A 자습실 자리 확정하기' }).click();
    await expect(page).toHaveURL(new RegExp(`apply=${room.id}&slot=`));
    const dialog = page.getByRole('dialog', { name: 'A 자습실 자리 확정' });
    await expect(dialog.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await expect(dialog.getByRole('combobox', { name: '방문 종료 시각' })).toHaveText('12:00');
    await expect(dialog).toContainText('까지 확정하면 자리가 내 것이 돼요');
    await dialog.getByRole('button', { name: '확정하기' }).click();

    await expect(toast(page, /방문을 신청했어요\. .* 10:00 – 12:00/)).toBeVisible();
    await expect(banner).toBeHidden();
    await expect(nav(page).getByTestId('nav-attention')).toHaveCount(0);
    await expect(
      page.getByRole('main').getByRole('listitem').filter({ hasText: 'A 자습실' }),
    ).toContainText('신청함');
  });

  test('자리 제안을 거절하면 배너가 사라지고 대기 탭에 거절로 남는다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const holder = await seed.student('이도윤', '010-2222-2222');
    const held = await seed.visit(holder.id, room.id, kst(1, 18), kst(1, 20));
    const me = await seed.student('김하늘', '010-1111-1111');
    await seed.wait(me.id, room.id, kst(1, 10), kst(1, 12));
    await seed.cancelVisit(holder.id, held.id);
    await enterAsStudent(page, me);

    await page.goto('/student/visits');
    const banner = page.getByRole('region', { name: '자리 제안' });
    await banner.getByRole('button', { name: 'A 자습실 자리 제안 거절' }).click();

    await expect(toast(page, 'A 자습실 자리 제안을 거절했어요')).toBeVisible();
    await expect(banner).toBeHidden();
    await page.getByRole('tab', { name: /대기/ }).click();
    const wait = page.getByTestId('wait').filter({ hasText: 'A 자습실' });
    await expect(wait).toContainText('거절함');
    await expect(wait).toContainText('제안 거절');
  });
});

test.describe('강사 · 대기열', () => {
  test('목록 카드에 대기 인원, 상세 대기 탭에 순번·연락처·원하는 시간을 보여준다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const holder = await seed.student('박서준', '010-3333-3333');
    await seed.visit(holder.id, room.id, kst(1, 18), kst(1, 20));
    const kim = await seed.student('김하늘', '010-1111-1111');
    const lee = await seed.student('이도윤', '010-2222-2222');
    await seed.wait(kim.id, room.id, kst(1, 10), kst(1, 12));
    await seed.wait(lee.id, room.id, kst(1, 13), kst(1, 15));
    await enterAsTeacher(page);

    await page.goto('/teacher/rooms');
    await expect(
      page.getByRole('main').getByRole('listitem').filter({ hasText: 'A 자습실' }),
    ).toContainText('대기 2명');

    await page.goto(`/teacher/rooms/${room.id}?tab=waitlist`);
    await expect(page.getByRole('tab', { name: /대기\s*2/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const rows = page.getByRole('region', { name: '대기' }).getByRole('row');
    await expect(rows.nth(1)).toContainText('1번째');
    await expect(rows.nth(1)).toContainText('김하늘');
    await expect(rows.nth(1)).toContainText('010-1111-1111');
    await expect(rows.nth(1)).toContainText('내일 10:00 – 12:00');
    await expect(rows.nth(2)).toContainText('2번째');
    await expect(rows.nth(2)).toContainText('이도윤');
  });
});
