import { enterAsStudent, expect, kst, test } from './support/fixtures';
import type { Page } from '@playwright/test';
import { expectNoHorizontalScroll, nav, pick, toast } from './support/ui';

/** 자습실 페이지의 좌석 현황 */
const seatGroup = (page: Page) => page.getByRole('radiogroup', { name: '좌석' });
/** 자습실 페이지 하단 고정 바 (고른 좌석·시간 / 내 방문) */
const bottomBar = (page: Page) => page.getByTestId('room-action-bar');

test.describe('학생 · 방문 신청', () => {
  test('자습실 페이지에서 시간·좌석을 골라 신청 → 변경 → 취소 → 다시 신청', async ({
    page,
    seed,
  }) => {
    await seed.room({ name: 'A 자습실', maxPersonnel: 5 });
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    const card = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    await expect(card).toContainText('좌석 5석'); // 내일 운영이라 "지금 이용 중"은 없다
    await expectNoHorizontalScroll(page);

    // 신청 — 자습실 페이지: 위에서 시간, 아래 좌석 현황에서 좌석, 하단 [신청하기]
    await card.getByRole('link', { name: /방문 신청/ }).click();
    await expect(page).toHaveURL(/\/student\/rooms\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'A 자습실' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await pick(page, page.getByRole('combobox', { name: '방문 시작 시각' }), '11:00');
    await pick(page, page.getByRole('combobox', { name: '방문 종료 시각' }), '13:00');
    await expect(page.getByText('이 시간 빈 좌석 5석')).toBeVisible();
    const seats = seatGroup(page);
    await expect(seats.getByRole('radio', { name: '1번 좌석, 비어 있음' })).toBeChecked();
    await seats.getByRole('radio', { name: '3번 좌석, 비어 있음' }).click();
    await expect(bottomBar(page)).toContainText('3번 좌석 · 내일 11:00 – 13:00');
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: '신청하기' }).click();

    await expect(toast(page, /방문을 신청했어요\. .* 11:00 – 13:00/)).toBeVisible();
    // 신청한 자습실이면 내 시간·좌석을 보여주기만 하고, 하단 버튼은 [시간 변경]·[좌석 변경]
    await expect(bottomBar(page)).toContainText('내 방문 내일 11:00 – 13:00 · 3번 좌석');
    await expect(page.getByRole('button', { name: '신청하기' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: '방문 시작 시각' })).toHaveCount(0);
    await expect(seats.getByRole('radio', { name: /3번 좌석.*내 좌석/ })).toBeChecked();
    await expect(nav(page).getByRole('link', { name: /내 신청.*1/ })).toBeVisible();
    // 내 신청 개수 배지가 붙어도 320px 헤더가 넘치지 않는다 (#63)
    await expectNoHorizontalScroll(page);

    // 시간 변경 → 변경 모드: 시간과 좌석을 함께 바꿀 수 있다 (아무것도 안 바꾸면 비활성)
    await page.getByRole('button', { name: '시간 변경' }).click();
    await expect(page).toHaveURL(/edit=1/);
    await expect(page.getByRole('combobox', { name: '방문 시작 시각' })).toBeFocused();
    await expect(bottomBar(page)).toContainText('바꿀 시간이나 좌석을 골라 주세요');
    await expect(page.getByRole('button', { name: '변경하기' })).toBeDisabled();
    await pick(page, page.getByRole('combobox', { name: '방문 시작 시각' }), '12:00');
    await seats.getByRole('radio', { name: '5번 좌석, 비어 있음' }).click();
    await expect(bottomBar(page)).toContainText('3번 → 5번 좌석 · 11:00 – 13:00 → 12:00 – 13:00');
    await page.getByRole('button', { name: '변경하기' }).click();
    await expect(
      toast(page, '방문을 바꿨어요. 3번 → 5번 좌석 · 11:00 – 13:00 → 12:00 – 13:00'),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/edit=1/);
    await expect(bottomBar(page)).toContainText('내 방문 내일 12:00 – 13:00 · 5번 좌석');

    // 목록 카드에는 [변경] 하나 — 자습실 페이지 변경 모드로 간다
    await page.getByRole('link', { name: '자습실 목록' }).click();
    await expect(card).toContainText('12:00 – 13:00 · 5번 좌석');
    await card.getByRole('link', { name: /변경/ }).click();
    await expect(page).toHaveURL(/\/student\/rooms\/\d+\?edit=1/);
    await expect(page.getByRole('button', { name: '변경하기' })).toBeVisible();
    await page.getByRole('button', { name: '취소' }).click();
    await expect(bottomBar(page)).toContainText('내 방문 내일 12:00 – 13:00 · 5번 좌석');

    // 취소 — 내 신청에서
    await nav(page)
      .getByRole('link', { name: /내 신청/ })
      .click();
    await expect(page).toHaveURL('/student/visits');
    const visit = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    await expect(visit).toContainText('12:00 – 13:00');
    await expect(visit).toContainText('5번 좌석');
    await visit.getByRole('button', { name: '취소' }).click();
    const confirm = page.getByRole('alertdialog', { name: '방문을 취소할까요?' });
    await confirm.getByRole('button', { name: '방문 취소' }).click();
    await expect(toast(page, '방문을 취소했어요')).toBeVisible();
    await expect(page.getByText('아직 신청한 방문이 없어요')).toBeVisible();

    // 다시 신청 — 자습실 페이지로 가고, 이전 좌석(5번)이 미리 골라져 있다
    await page.getByRole('tab', { name: /취소됨/ }).click();
    await page.getByRole('link', { name: '다시 신청' }).click();
    await expect(page).toHaveURL(/\/student\/rooms\/\d+$/);
    await expect(seatGroup(page).getByRole('radio', { name: '5번 좌석, 비어 있음' })).toBeChecked();
    await page.getByRole('button', { name: '신청하기' }).click();
    await expect(toast(page, /방문을 신청했어요/)).toBeVisible();
  });

  test('좌석 변경: 시간은 그대로 두고 좌석만 바꾼다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 5 });
    const me = await seed.student('김하늘', '010-1111-1111');
    await seed.visit(me.id, room.id, kst(1, 10), kst(1, 12)); // 1번 좌석
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${room.id}`);
    await page.getByRole('button', { name: '좌석 변경' }).click();
    const seats = seatGroup(page);
    // 좌석 현황의 내 좌석(고른 좌석)에 포커스 → 방향키로 옮긴다
    await expect(seats.getByRole('radio', { name: /1번 좌석.*내 좌석/ })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(bottomBar(page)).toContainText('1번 → 2번 좌석');
    await page.getByRole('button', { name: '변경하기' }).click();
    await expect(toast(page, '방문을 바꿨어요. 1번 → 2번 좌석')).toBeVisible();
    await expect(bottomBar(page)).toContainText('내 방문 내일 10:00 – 12:00 · 2번 좌석');
  });

  test('변경 모드에서 시간을 바꿔 지금 좌석이 차면 선택을 풀고 다른 좌석을 고르게 한다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 2 });
    const me = await seed.student('김하늘', '010-1111-1111');
    const other = await seed.student('이도윤', '010-2222-2222');
    await seed.visit(me.id, room.id, kst(1, 10), kst(1, 12)); // 1번 좌석
    await seed.visit(other.id, room.id, kst(1, 14), kst(1, 16)); // 14~16시엔 1번이 빈다 → 1번
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${room.id}?edit=1`);
    await pick(page, page.getByRole('combobox', { name: '방문 시작 시각' }), '14:00');
    await expect(
      toast(page, '그 시간에는 다른 학생이 이미 예약한 좌석이에요. 다른 좌석을 골라 주세요'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '변경하기' })).toBeDisabled();
    await seatGroup(page).getByRole('radio', { name: '2번 좌석, 비어 있음' }).click();
    await page.getByRole('button', { name: '변경하기' }).click();
    await expect(
      toast(page, /방문을 바꿨어요\. 1번 → 2번 좌석 · 10:00 – 12:00 → 14:00 – 16:00/),
    ).toBeVisible();
  });

  test('남은 시간 내내 빈 좌석이 없으면 신청할 수 없고 이유를 보여준다', async ({ page, seed }) => {
    const full = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const partly = await seed.room({ name: 'B 자습실', maxPersonnel: 1 });
    const other = await seed.student('이도윤', '010-2222-2222');
    const third = await seed.student('박서준', '010-3333-3333');
    await seed.visit(other.id, full.id, kst(1, 10), kst(1, 22)); // 운영 시간 내내
    await seed.visit(third.id, partly.id, kst(1, 10), kst(1, 21)); // 21~22시는 빈다
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    const a = page.getByRole('listitem').filter({ hasText: 'A 자습실' });
    await expect(a.getByRole('button', { name: '방문 신청' })).toBeDisabled();
    await expect(a.getByRole('button', { name: '방문 신청' })).toHaveAccessibleDescription(
      '남은 시간에 빈 좌석이 없어요',
    );
    await expect(a).not.toContainText('정원 마감');
    // 한 칸이라도 비면 신청할 수 있다
    const b = page.getByRole('listitem').filter({ hasText: 'B 자습실' });
    await expect(b.getByRole('link', { name: /방문 신청/ })).toBeVisible();

    // 주소로 바로 들어와도 신청 버튼은 막혀 있다
    await page.goto(`/student/rooms/${full.id}`);
    await expect(bottomBar(page)).toContainText('남은 시간에 빈 좌석이 없어요');
    await expect(page.getByRole('button', { name: '신청하기' })).toBeDisabled();
  });

  test('시간을 바꿔 고른 좌석이 그 시간에 차 있으면 선택을 풀고 알린다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 2 });
    const other = await seed.student('이도윤', '010-2222-2222');
    await seed.visit(other.id, room.id, kst(1, 14), kst(1, 16)); // 1번 좌석 14~16시
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${room.id}`);
    const seats = seatGroup(page);
    await expect(seats.getByRole('radio', { name: '1번 좌석, 비어 있음' })).toBeChecked();

    await pick(page, page.getByRole('combobox', { name: '방문 시작 시각' }), '14:00');
    await expect(
      toast(page, '그 시간에는 다른 학생이 이미 예약한 좌석이에요. 다른 좌석을 골라 주세요'),
    ).toBeVisible();
    await expect(seats.getByRole('radio', { name: '1번 좌석, 예약됨' })).toBeVisible();
    await expect(bottomBar(page)).toContainText('앉을 좌석을 골라 주세요');
    await expect(page.getByRole('button', { name: '신청하기' })).toBeDisabled();

    await seats.getByRole('radio', { name: '2번 좌석, 비어 있음' }).click();
    await page.getByRole('button', { name: '신청하기' }).click();
    await expect(toast(page, /방문을 신청했어요/)).toBeVisible();
  });

  test('신청하는 순간 고른 좌석을 다른 학생이 가져가면 좌석 현황을 다시 받아 다시 고른다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 2 });
    const me = await seed.student('김하늘', '010-1111-1111');
    const other = await seed.student('이도윤', '010-2222-2222');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${room.id}`);
    const seats = seatGroup(page);
    await expect(seats.getByRole('radio', { name: '1번 좌석, 비어 있음' })).toBeChecked();
    // 다른 학생이 같은 시간(기본 10:00–12:00)의 1번 좌석을 먼저 가져감
    await seed.visit(other.id, room.id, kst(1, 10), kst(1, 12));
    await page.getByRole('button', { name: '신청하기' }).click();

    await expect(
      toast(page, '방금 다른 학생이 1번 좌석을 예약했어요. 다른 좌석을 골라 주세요'),
    ).toBeVisible();
    await expect(seats.getByRole('radio', { name: '1번 좌석, 예약됨' })).toBeVisible();
    await expect(page.getByText('이 시간 빈 좌석 1석')).toBeVisible();

    await seats.getByRole('radio', { name: '2번 좌석, 비어 있음' }).click();
    await page.getByRole('button', { name: '신청하기' }).click();
    await expect(toast(page, /방문을 신청했어요/)).toBeVisible();
  });

  test('보는 동안 다른 학생이 고른 좌석을 가져가면 자동 갱신에서 알린다', async ({
    page,
    seed,
  }) => {
    await page.clock.install();
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 2 });
    const me = await seed.student('김하늘', '010-1111-1111');
    const other = await seed.student('이도윤', '010-2222-2222');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${room.id}`);
    const seats = seatGroup(page);
    await expect(seats.getByRole('radio', { name: '1번 좌석, 비어 있음' })).toBeChecked();
    await seed.visit(other.id, room.id, kst(1, 10), kst(1, 12));
    await page.clock.runFor(30_000); // 30초 자동 갱신

    await expect(
      toast(page, '방금 다른 학생이 1번 좌석을 예약했어요. 다른 좌석을 골라 주세요'),
    ).toBeVisible();
    await expect(seats.getByRole('radio', { name: '1번 좌석, 예약됨' })).toBeVisible();
  });

  test('고른 시간에 빈 좌석이 없으면 같은 시간에 빈 좌석이 있는 자습실로 이어서 신청한다', async ({
    page,
    seed,
  }) => {
    const roomA = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const roomB = await seed.room({ name: 'B 자습실', maxPersonnel: 5 });
    const roomC = await seed.room({ name: 'C 자습실', maxPersonnel: 1 });
    await seed.room({ name: 'D 자습실', startDate: kst(1, 15) }); // 오전 시간은 운영 전
    const me = await seed.student('김하늘', '010-1111-1111');
    const other = await seed.student('이도윤', '010-2222-2222');
    const third = await seed.student('박서준', '010-3333-3333');
    await seed.visit(other.id, roomA.id, kst(1, 10), kst(1, 12)); // A는 기본 시간에 마감
    await seed.visit(third.id, roomC.id, kst(1, 10), kst(1, 12)); // C도 그 시간에 마감
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${roomA.id}`);
    await expect(page.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await expect(page.getByText('그 시간 내내 비어 있는 좌석이 없어요')).toBeVisible();
    await expect(page.getByRole('button', { name: '신청하기' })).toBeDisabled();
    await page.getByRole('button', { name: '같은 시간에 빈 좌석이 있는 자습실 보기' }).click();

    // 같은 시간에 빈 좌석이 있는 곳만 안내 (C는 마감, D는 운영 기간 밖)
    const alternatives = page.getByRole('dialog', {
      name: '그 시간에 A 자습실에는 빈 좌석이 없어요',
    });
    await expect(alternatives).toContainText('10:00 – 12:00');
    await expect(alternatives.getByRole('listitem')).toHaveCount(1);
    await expect(alternatives).toContainText('빈 좌석 5석 / 5석');

    // 고른 자습실 페이지가 같은 시간으로 열린다
    await alternatives.getByRole('button', { name: 'B 자습실 이 시간으로 신청' }).click();
    await expect(page).toHaveURL(new RegExp(`/student/rooms/${roomB.id}\\?slot=`));
    await expect(page.getByRole('heading', { level: 1, name: 'B 자습실' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await expect(page.getByRole('combobox', { name: '방문 종료 시각' })).toHaveText('12:00');
    await expect(seatGroup(page).getByRole('radio', { name: '1번 좌석, 비어 있음' })).toBeChecked();
    await page.getByRole('button', { name: '신청하기' }).click();
    await expect(toast(page, /방문을 신청했어요\. .* 10:00 – 12:00/)).toBeVisible();
  });

  test('같은 시간에 빈 좌석이 있는 자습실이 없으면 알리고 그 페이지에 남는다', async ({
    page,
    seed,
  }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 1 });
    const other = await seed.student('이도윤', '010-2222-2222');
    await seed.visit(other.id, room.id, kst(1, 10), kst(1, 12));
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${room.id}`);
    await page.getByRole('button', { name: '같은 시간에 빈 좌석이 있는 자습실 보기' }).click();
    await expect(toast(page, '같은 시간에 빈 좌석이 있는 자습실이 없어요')).toBeVisible();
    await expect(page).toHaveURL(`/student/rooms/${room.id}`);
  });

  test('좌석은 방향키로 움직이며 고르고 예약된 좌석은 건너뛴다', async ({ page, seed }) => {
    const room = await seed.room({ name: 'A 자습실', maxPersonnel: 10 });
    const other = await seed.student('이도윤', '010-2222-2222');
    await seed.visit(other.id, room.id, kst(1, 10), kst(1, 12)); // 1번 좌석
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${room.id}`);
    const seats = seatGroup(page);
    const seat2 = seats.getByRole('radio', { name: '2번 좌석, 비어 있음' });
    await expect(seat2).toBeChecked(); // 1번은 예약됨
    await seat2.focus();
    await page.keyboard.press('ArrowDown');
    await expect(seats.getByRole('radio', { name: '7번 좌석, 비어 있음' })).toBeChecked();
    await expect(seats.getByRole('radio', { name: '7번 좌석, 비어 있음' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft'); // 1번은 예약됨 → 그대로
    await expect(seat2).toBeChecked();
  });

  test('내 다른 신청과 겹치는 시간은 고를 수 없다', async ({ page, seed }) => {
    const roomA = await seed.room({ name: 'A 자습실' });
    const roomB = await seed.room({ name: 'B 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await seed.visit(me.id, roomA.id, kst(1, 10), kst(1, 12));
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${roomB.id}`);
    // 겹치지 않는 첫 시각(A 신청이 끝나는 12:00)부터 고른다 — 맞닿는 구간은 허용
    const startSelect = page.getByRole('combobox', { name: '방문 시작 시각' });
    await expect(startSelect).toHaveText('12:00');
    await startSelect.click();
    const blocked = page.getByRole('option', { name: /^11:30/ });
    await expect(blocked).toHaveAttribute('aria-disabled', 'true');
    await expect(blocked).toContainText('다른 신청');
    await page.keyboard.press('Escape');

    await pick(page, page.getByRole('combobox', { name: '방문 종료 시각' }), '13:00');
    await page.getByRole('button', { name: '신청하기' }).click();
    await expect(toast(page, /방문을 신청했어요\. .* 12:00 – 13:00/)).toBeVisible();
  });

  test('보는 사이 겹치는 신청이 생기면 이유를 보여주고 막는다', async ({ page, seed }) => {
    const roomA = await seed.room({ name: 'A 자습실' });
    const roomB = await seed.room({ name: 'B 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto(`/student/rooms/${roomB.id}`);
    await expect(page.getByRole('combobox', { name: '방문 시작 시각' })).toHaveText('10:00');
    await seed.visit(me.id, roomA.id, kst(1, 10), kst(1, 12)); // 다른 탭에서 먼저 신청
    await page.getByRole('button', { name: '신청하기' }).click();

    await expect(page.getByRole('alert').first()).toContainText(
      '같은 시간에 신청한 다른 자습실이 있어요. 겹치지 않는 시간을 골라 주세요',
    );
    // 내 신청을 다시 받아 겹치는 신청을 알려주고 제출을 막는다
    await expect(page.getByText('A 자습실 신청(10:00 – 12:00)과 겹쳐요')).toBeVisible();
    await expect(page.getByRole('button', { name: '신청하기' })).toBeDisabled();
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
  test('Tab·Enter로 자습실 페이지에 들어가 좌석을 고르고 신청한다', async ({
    page,
    seed,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '키보드 흐름은 데스크톱에서만 확인');
    await seed.room({ name: 'A 자습실' });
    const me = await seed.student('김하늘', '010-1111-1111');
    await enterAsStudent(page, me);

    await page.goto('/student/rooms');
    await page.getByRole('link', { name: /방문 신청/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'A 자습실' })).toBeFocused();

    // 좌석 묶음은 Tab 한 번으로 들어가고 방향키로 고른다
    const seat1 = seatGroup(page).getByRole('radio', { name: '1번 좌석, 비어 있음' });
    await seat1.focus();
    await page.keyboard.press('ArrowRight');
    await expect(seatGroup(page).getByRole('radio', { name: '2번 좌석, 비어 있음' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '신청하기' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toast(page, /방문을 신청했어요/)).toBeVisible();
  });
});
