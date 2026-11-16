import { describe, expect, it } from 'vitest';
import type { StudyRoomHistory } from '@hiconsy/shared';
import { filterHistories } from '../history';

let seq = 0;
function h(
  visitId: number,
  action: StudyRoomHistory['action'],
  createdAt: string,
  startAt = '2026-11-20T18:00:00+09:00',
  name = `학생${visitId}`,
): StudyRoomHistory {
  return {
    id: ++seq,
    visitId,
    student: { id: visitId, name },
    action,
    prevStartAt: null,
    prevEndAt: null,
    startAt,
    endAt: '2026-11-20T20:00:00+09:00',
    prevSeat: null,
    seat: null,
    actorType: 'STUDENT',
    reason: null,
    createdAt,
  };
}

describe('filterHistories', () => {
  const list = [
    h(1, 'APPLY', '2026-11-14T09:00:00+09:00', undefined, '김하늘'),
    h(2, 'CANCEL', '2026-11-14T10:00:00+09:00', undefined, '이도윤'),
  ];

  it('최신순으로 정렬하고 종류·이름으로 거른다', () => {
    expect(filterHistories(list, 'ALL', '').map((x) => x.visitId)).toEqual([2, 1]);
    expect(filterHistories(list, 'APPLY', '').map((x) => x.visitId)).toEqual([1]);
    expect(filterHistories(list, 'ALL', '하늘').map((x) => x.visitId)).toEqual([1]);
  });
});
