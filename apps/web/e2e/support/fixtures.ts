import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import pg from 'pg';
import type { ApiResponse, SeatAvailability, Student, StudyRoom, Visit } from '@hiconsy/shared';
import { E2E_API_URL, E2E_DATABASE_URL } from './env';

/** 테스트 사이 격리: 모든 도메인 테이블을 비운다 (API e2e의 resetDatabase와 같은 방식) */
async function resetDatabase() {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      'TRUNCATE TABLE visit_histories, visits, seats, study_rooms, students RESTART IDENTITY CASCADE',
    );
  } finally {
    await client.end();
  }
}

/**
 * KST 기준 시각 (테스트 실행 환경의 시간대와 무관하게 브라우저(Asia/Seoul)와 맞춘다).
 * @example kst(1, 10) → 내일 10:00 KST
 */
export function kst(dayOffset: number, hour: number, minute = 0): string {
  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  todayKst.setUTCDate(todayKst.getUTCDate() + dayOffset);
  const ymd = todayKst.toISOString().slice(0, 10);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${ymd}T${hh}:${mm}:00+09:00`;
}

/** 테스트 데이터를 API로 만든다 (화면 조작은 검증 대상에만 쓴다) */
export class Seed {
  constructor(private readonly api: APIRequestContext) {}

  private async post<T>(path: string, data: unknown): Promise<T> {
    const res = await this.api.post(`${E2E_API_URL}${path}`, { data });
    expect(res.ok(), `${path} → ${res.status()} ${await res.text()}`).toBeTruthy();
    return ((await res.json()) as ApiResponse<T>).data;
  }

  student(name: string, phone: string) {
    return this.post<Student>('/students', { name, phone });
  }

  room(input: { name: string; maxPersonnel?: number; startDate?: string; endDate?: string }) {
    return this.post<StudyRoom>('/study-rooms', {
      maxPersonnel: 10,
      startDate: kst(1, 10),
      endDate: kst(1, 22),
      ...input,
    });
  }

  /** `seat`(좌석 번호)를 주지 않으면 서버가 빈 좌석을 배정한다 */
  async visit(
    studentId: number,
    studyRoomId: number,
    startAt: string,
    endAt: string,
    opts: { seat?: number } = {},
  ) {
    const seatId = opts.seat === undefined ? undefined : await this.seatId(studyRoomId, opts.seat);
    return this.post<Visit>(`/students/${studentId}/visits`, {
      studyRoomId,
      startAt,
      endAt,
      ...(seatId !== undefined && { seatId }),
    });
  }

  private async seatId(studyRoomId: number, number: number) {
    const res = await this.api.get(`${E2E_API_URL}/study-rooms/${studyRoomId}/seats`, {
      params: { startAt: kst(1, 10), endAt: kst(1, 11) },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const seats = ((await res.json()) as ApiResponse<SeatAvailability[]>).data;
    const seat = seats.find((s) => s.number === number);
    if (!seat) throw new Error(`${number}번 좌석이 없어요`);
    return seat.id;
  }

  /** 시간·좌석 변경. `seat`(좌석 번호)를 주면 좌석도 바꾼다 */
  async changeVisit(
    studentId: number,
    visitId: number,
    startAt: string,
    endAt: string,
    opts: { studyRoomId?: number; seat?: number } = {},
  ) {
    const seatId =
      opts.seat !== undefined && opts.studyRoomId !== undefined
        ? await this.seatId(opts.studyRoomId, opts.seat)
        : undefined;
    const res = await this.api.patch(`${E2E_API_URL}/students/${studentId}/visits/${visitId}`, {
      data: { startAt, endAt, ...(seatId !== undefined && { seatId }) },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  }

  cancelVisit(studentId: number, visitId: number) {
    return this.post<Visit>(`/students/${studentId}/visits/${visitId}/cancel`, {});
  }

  async deleteStudent(id: number) {
    const res = await this.api.delete(`${E2E_API_URL}/students/${id}`);
    expect(res.ok(), await res.text()).toBeTruthy();
  }

  /**
   * 자습실과 그 신청·이력을 hours시간 앞으로(과거로) 옮긴다.
   * 이미 지난 방문은 API로 만들 수 없어(VISIT_IN_PAST) "시간이 흐른 상황"을 DB에서 만든다.
   */
  async shiftRoomBack(studyRoomId: number, hours: number) {
    const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
    await client.connect();
    const d = `interval '${hours} hours'`;
    try {
      await client.query(
        `UPDATE study_rooms SET start_date = start_date - ${d}, end_date = end_date - ${d} WHERE id = $1`,
        [studyRoomId],
      );
      await client.query(
        `UPDATE visits SET start_at = start_at - ${d}, end_at = end_at - ${d} WHERE study_room_id = $1`,
        [studyRoomId],
      );
      await client.query(
        `UPDATE visit_histories SET start_at = start_at - ${d}, end_at = end_at - ${d},
           prev_start_at = prev_start_at - ${d}, prev_end_at = prev_end_at - ${d} WHERE study_room_id = $1`,
        [studyRoomId],
      );
    } finally {
      await client.end();
    }
  }

  async deleteRoom(id: number) {
    const res = await this.api.delete(`${E2E_API_URL}/study-rooms/${id}`);
    expect(res.ok(), await res.text()).toBeTruthy();
  }
}

/** 로그인 대신 고르는 역할을 미리 넣어 둔다 (역할 선택 화면 자체는 role.spec에서 검증) */
export async function enterAsTeacher(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('hiconsy.session', JSON.stringify({ role: 'teacher', student: null }));
  });
}

export async function enterAsStudent(page: Page, student: Pick<Student, 'id' | 'name' | 'phone'>) {
  await page.addInitScript((s) => {
    localStorage.setItem('hiconsy.session', JSON.stringify({ role: 'student', student: s }));
  }, student);
}

export const test = base.extend<{ seed: Seed; cleanDb: void }>({
  cleanDb: [
    // Playwright 픽스처는 의존성이 없어도 첫 인자를 객체 패턴으로 받는다 (.oxlintrc에서 e2e만 허용)
    async ({}, use) => {
      await resetDatabase();
      await use();
    },
    { auto: true },
  ],
  seed: async ({ request }, use) => {
    await use(new Seed(request));
  },
});

export { expect };
