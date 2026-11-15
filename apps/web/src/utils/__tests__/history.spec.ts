import { describe, expect, it } from 'vitest';
import type { StudyRoomHistory } from '@hiconsy/shared';
import { deriveApplicants, filterHistories } from '../history';

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
    actorType: 'STUDENT',
    reason: null,
    createdAt,
  };
}

describe('deriveApplicants', () => {
  it('방문별 마지막 이벤트가 취소가 아닌 것만 신청자로 본다', () => {
    const list = [
      h(1, 'APPLY', '2026-11-14T09:00:00+09:00'),
      h(2, 'APPLY', '2026-11-14T09:05:00+09:00'),
      h(2, 'CANCEL', '2026-11-14T09:10:00+09:00'),
      h(1, 'UPDATE', '2026-11-15T14:00:00+09:00', '2026-11-20T19:00:00+09:00'),
    ];
    const result = deriveApplicants(list);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      visitId: 1,
      startAt: '2026-11-20T19:00:00+09:00',
      appliedAt: '2026-11-14T09:00:00+09:00',
    });
  });

  it('취소 후 재신청하면 다시 신청자가 되고 신청일은 재신청 시각이다', () => {
    const list = [
      h(3, 'APPLY', '2026-11-14T09:00:00+09:00'),
      h(3, 'CANCEL', '2026-11-14T10:00:00+09:00'),
      h(3, 'APPLY', '2026-11-15T10:00:00+09:00'),
    ];
    expect(deriveApplicants(list)[0]?.appliedAt).toBe('2026-11-15T10:00:00+09:00');
  });
});

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
