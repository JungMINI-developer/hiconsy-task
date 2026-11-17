import { describe, expect, it } from 'vitest';
import type { Visit } from '@hiconsy/shared';
import { isVisitEditable, isVisitInProgress, visitGroup } from '../myVisits';

const now = new Date('2026-11-20T19:00:00+09:00');

function visit(status: Visit['status'], startAt: string, endAt: string): Visit {
  return {
    id: 1,
    studentId: 1,
    studyRoom: { id: 1, name: 'A', startDate: startAt, endDate: endAt, deleted: false },
    startAt,
    endAt,
    seat: null,
    status,
    canceledAt: status === 'CANCELED' ? startAt : null,
    createdAt: startAt,
    updatedAt: startAt,
  };
}

describe('myVisits 규칙', () => {
  it('취소는 취소됨, 유효 신청은 방문 종료 전이면 예정·이후면 지난 방문', () => {
    expect(
      visitGroup(visit('CANCELED', '2026-11-21T18:00:00+09:00', '2026-11-21T20:00:00+09:00'), now),
    ).toBe('canceled');
    expect(
      visitGroup(visit('APPLIED', '2026-11-20T18:00:00+09:00', '2026-11-20T20:00:00+09:00'), now),
    ).toBe('upcoming');
    expect(
      visitGroup(visit('APPLIED', '2026-11-20T16:00:00+09:00', '2026-11-20T19:00:00+09:00'), now),
    ).toBe('past');
  });

  it('시작 전인 유효 신청만 수정·취소할 수 있다', () => {
    expect(
      isVisitEditable(
        visit('APPLIED', '2026-11-20T19:30:00+09:00', '2026-11-20T21:00:00+09:00'),
        now,
      ),
    ).toBe(true);
    expect(
      isVisitEditable(
        visit('APPLIED', '2026-11-20T19:00:00+09:00', '2026-11-20T21:00:00+09:00'),
        now,
      ),
    ).toBe(false);
    expect(
      isVisitEditable(
        visit('CANCELED', '2026-11-21T19:00:00+09:00', '2026-11-21T21:00:00+09:00'),
        now,
      ),
    ).toBe(false);
  });
});

describe('isVisitInProgress (#66 퇴실)', () => {
  it('시작 < 지금 < 종료인 유효 신청만 진행 중', () => {
    expect(
      isVisitInProgress(
        visit('APPLIED', '2026-11-20T18:00:00+09:00', '2026-11-20T20:00:00+09:00'),
        now,
      ),
    ).toBe(true);
    // 시작과 같은 시각은 아직 시작 전 (퇴실하면 구간이 비므로)
    expect(
      isVisitInProgress(
        visit('APPLIED', '2026-11-20T19:00:00+09:00', '2026-11-20T20:00:00+09:00'),
        now,
      ),
    ).toBe(false);
    expect(
      isVisitInProgress(
        visit('APPLIED', '2026-11-20T17:00:00+09:00', '2026-11-20T19:00:00+09:00'),
        now,
      ),
    ).toBe(false);
    expect(
      isVisitInProgress(
        visit('CANCELED', '2026-11-20T18:00:00+09:00', '2026-11-20T20:00:00+09:00'),
        now,
      ),
    ).toBe(false);
  });
});
