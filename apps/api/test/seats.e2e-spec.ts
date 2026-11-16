import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createRoomWithSeats, createTestApp, resetDatabase } from './helpers.js';

/** 운영 기간: 2030-01-10 09:00 ~ 22:00 (KST) */
const ROOM = {
  name: 'A 자습실',
  maxPersonnel: 3,
  startDate: '2030-01-10T09:00:00+09:00',
  endDate: '2030-01-10T22:00:00+09:00',
};
/** 2030-01-10 h시 (KST) */
const at = (h: number) => `2030-01-10T${String(h).padStart(2, '0')}:00:00+09:00`;
const slot = (from: number, to: number) => ({ startAt: at(from), endAt: at(to) });

/** 좌석 단위 예약 (#45): 같은 좌석의 유효 신청끼리 시간이 겹치면 안 된다 */
describe('Seats (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let phoneSeq = 0;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  async function createStudent(): Promise<number> {
    phoneSeq += 1;
    const phone = `010-3000-${String(phoneSeq).padStart(4, '0')}`;
    return (await prisma.student.create({ data: { name: '학생', phone } })).id;
  }

  const createRoom = (overrides: Partial<typeof ROOM> = {}) =>
    createRoomWithSeats(prisma, { ...ROOM, ...overrides });

  async function seatId(roomId: number, number: number): Promise<number> {
    const seat = await prisma.seat.findUniqueOrThrow({
      where: { studyRoomId_number: { studyRoomId: roomId, number } },
    });
    return seat.id;
  }

  const apply = (
    studentId: number,
    studyRoomId: number,
    range: { startAt: string; endAt: string },
    seat?: number,
  ) =>
    api()
      .post(`/api/students/${studentId}/visits`)
      .send({ studyRoomId, ...range, ...(seat !== undefined && { seatId: seat }) });

  const updateTime = (
    studentId: number,
    visitId: number,
    range: { startAt: string; endAt: string },
    seat?: number,
  ) =>
    api()
      .patch(`/api/students/${studentId}/visits/${visitId}`)
      .send({ ...range, ...(seat !== undefined && { seatId: seat }) });

  describe('신청', () => {
    it('좌석을 고르면 그 좌석으로 신청하고, 응답·이력에 좌석이 남는다', async () => {
      const roomId = await createRoom();
      const seat2 = await seatId(roomId, 2);
      const res = await apply(await createStudent(), roomId, slot(19, 21), seat2).expect(201);

      expect(res.body.data.seat).toEqual({ id: seat2, number: 2 });
      const history = await prisma.visitHistory.findFirstOrThrow({
        where: { visitId: res.body.data.id },
      });
      expect(history).toMatchObject({ action: 'APPLY', prevSeatId: null, seatId: seat2 });
    });

    it('좌석을 고르지 않으면 그 시간 내내 비어 있는 가장 작은 번호 좌석을 준다', async () => {
      const roomId = await createRoom();
      await apply(await createStudent(), roomId, slot(19, 21), await seatId(roomId, 1)).expect(201);

      const res = await apply(await createStudent(), roomId, slot(20, 22)).expect(201);
      expect(res.body.data.seat.number).toBe(2);
    });

    it('같은 좌석에 시간이 겹치면 SEAT_TAKEN, 다른 좌석은 된다', async () => {
      const roomId = await createRoom();
      const seat1 = await seatId(roomId, 1);
      await apply(await createStudent(), roomId, slot(18, 20), seat1).expect(201);

      const res = await apply(await createStudent(), roomId, slot(19, 21), seat1).expect(409);
      expect(res.body.error.code).toBe('SEAT_TAKEN');
      expect(res.body.error.message).toContain('1번');
      await apply(await createStudent(), roomId, slot(19, 21), await seatId(roomId, 2)).expect(201);
    });

    it('같은 좌석이라도 시간이 이어지기만 하면 된다 (18~20시 다음 20~22시)', async () => {
      const roomId = await createRoom();
      const seat1 = await seatId(roomId, 1);
      await apply(await createStudent(), roomId, slot(18, 20), seat1).expect(201);
      await apply(await createStudent(), roomId, slot(20, 22), seat1).expect(201);
    });

    it('시간이 겹치지 않으면 좌석 수보다 많은 학생이 신청할 수 있다', async () => {
      const roomId = await createRoom({ maxPersonnel: 1 });
      await apply(await createStudent(), roomId, slot(10, 12)).expect(201);
      await apply(await createStudent(), roomId, slot(13, 15)).expect(201);
      await apply(await createStudent(), roomId, slot(19, 21)).expect(201);

      const res = await api().get(`/api/study-rooms/${roomId}`).expect(200);
      expect(res.body.data).toMatchObject({ maxPersonnel: 1, currentPersonnel: 3 });
    });

    it('매 순간 한 자리가 비어도, 시간 내내 빈 좌석이 없으면 CAPACITY_FULL (좌석 단편화)', async () => {
      const roomId = await createRoom({ maxPersonnel: 2 });
      await apply(await createStudent(), roomId, slot(18, 20), await seatId(roomId, 1)).expect(201);
      await apply(await createStudent(), roomId, slot(20, 22), await seatId(roomId, 2)).expect(201);

      const res = await apply(await createStudent(), roomId, slot(19, 21)).expect(409);
      expect(res.body.error.code).toBe('CAPACITY_FULL');
    });

    it('다른 자습실의 좌석이거나 최대 인원을 줄여 쓰지 않는 좌석이면 SEAT_NOT_FOUND', async () => {
      const roomId = await createRoom();
      const otherRoomId = await createRoom({ name: 'B 자습실' });
      const student = await createStudent();

      const other = await apply(student, roomId, slot(19, 21), await seatId(otherRoomId, 1));
      expect(other.status).toBe(404);
      expect(other.body.error.code).toBe('SEAT_NOT_FOUND');

      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 2 }).expect(200);
      const unused = await apply(student, roomId, slot(19, 21), await seatId(roomId, 3));
      expect(unused.body.error.code).toBe('SEAT_NOT_FOUND');
    });

    it('취소하면 좌석 기록은 남고, 그 시간의 좌석은 다른 학생이 쓸 수 있다', async () => {
      const roomId = await createRoom({ maxPersonnel: 1 });
      const student = await createStudent();
      const visit = await apply(student, roomId, slot(19, 21)).expect(201);

      const canceled = await api()
        .post(`/api/students/${student}/visits/${visit.body.data.id}/cancel`)
        .expect(200);
      expect(canceled.body.data.seat.number).toBe(1);
      await apply(await createStudent(), roomId, slot(19, 21)).expect(201);
    });
  });

  describe('시간 수정', () => {
    it('새 시간에 같은 좌석이 차 있으면 SEAT_TAKEN, 다른 좌석으로 옮기면 된다', async () => {
      const roomId = await createRoom();
      const [seat1, seat2] = [await seatId(roomId, 1), await seatId(roomId, 2)];
      await apply(await createStudent(), roomId, slot(19, 21), seat1).expect(201);
      const me = await createStudent();
      const visit = await apply(me, roomId, slot(10, 12), seat1).expect(201);
      const visitId = visit.body.data.id as number;

      const taken = await updateTime(me, visitId, slot(19, 21)).expect(409);
      expect(taken.body.error.code).toBe('SEAT_TAKEN');

      const moved = await updateTime(me, visitId, slot(19, 21), seat2).expect(200);
      expect(moved.body.data.seat).toEqual({ id: seat2, number: 2 });
      const history = await prisma.visitHistory.findFirstOrThrow({
        where: { visitId, action: 'UPDATE' },
      });
      expect(history).toMatchObject({ prevSeatId: seat1, seatId: seat2 });
    });

    it('자기 신청이 차지한 시간은 빈 것으로 본다 (시간을 늘리기)', async () => {
      const roomId = await createRoom({ maxPersonnel: 1 });
      const me = await createStudent();
      const visit = await apply(me, roomId, slot(19, 21)).expect(201);

      const res = await updateTime(me, visit.body.data.id, slot(18, 22)).expect(200);
      expect(res.body.data.seat.number).toBe(1);
    });

    it('시간은 그대로 두고 좌석만 바꿀 수 있다', async () => {
      const roomId = await createRoom();
      const me = await createStudent();
      const visit = await apply(me, roomId, slot(19, 21)).expect(201);
      const seat3 = await seatId(roomId, 3);

      const res = await updateTime(me, visit.body.data.id, slot(19, 21), seat3).expect(200);
      expect(res.body.data.seat.number).toBe(3);
    });
  });

  describe('좌석 현황 조회', () => {
    it('GET /study-rooms/:id/seats — 고른 시간 내내 비어 있는지, 내 신청은 빼고 볼 수 있다', async () => {
      const roomId = await createRoom();
      const me = await createStudent();
      const mine = await apply(me, roomId, slot(19, 21), await seatId(roomId, 1)).expect(201);
      await apply(await createStudent(), roomId, slot(20, 22), await seatId(roomId, 2)).expect(201);

      const res = await api()
        .get(`/api/study-rooms/${roomId}/seats`)
        .query(slot(19, 21))
        .expect(200);
      expect(res.body.data.map((s: { number: number; available: boolean }) => s.available)).toEqual(
        [false, false, true],
      );

      const excludingMine = await api()
        .get(`/api/study-rooms/${roomId}/seats`)
        .query({ ...slot(19, 21), exceptVisitId: mine.body.data.id })
        .expect(200);
      expect(excludingMine.body.data[0]).toMatchObject({ number: 1, available: true });
    });

    it('GET /study-rooms/:id/seats — 쓰지 않는 좌석은 빠지고, 시작 ≥ 종료면 INVALID_PERIOD', async () => {
      const roomId = await createRoom();
      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 2 }).expect(200);

      const res = await api()
        .get(`/api/study-rooms/${roomId}/seats`)
        .query(slot(19, 21))
        .expect(200);
      expect(res.body.data).toHaveLength(2);

      const bad = await api()
        .get(`/api/study-rooms/${roomId}/seats`)
        .query(slot(21, 19))
        .expect(400);
      expect(bad.body.error.code).toBe('INVALID_PERIOD');
    });

    it('GET /study-rooms/:id/seat-map — 그 시각에 앉아 있기로 한 학생을 좌석마다 준다', async () => {
      const roomId = await createRoom();
      const student = await createStudent();
      await apply(student, roomId, slot(19, 21), await seatId(roomId, 2)).expect(201);

      const during = await api()
        .get(`/api/study-rooms/${roomId}/seat-map`)
        .query({ at: '2030-01-10T19:30:00+09:00' })
        .expect(200);
      expect(during.body.data.map((s: { visit: unknown }) => s.visit !== null)).toEqual([
        false,
        true,
        false,
      ]);
      expect(during.body.data[1].visit).toMatchObject({
        student: { id: student },
        startAt: '2030-01-10T19:00:00.000+09:00',
      });

      // 종료 시각은 포함하지 않는다 [시작, 종료)
      const after = await api()
        .get(`/api/study-rooms/${roomId}/seat-map`)
        .query({ at: at(21) })
        .expect(200);
      expect(after.body.data.every((s: { visit: unknown }) => s.visit === null)).toBe(true);
    });

    it('GET /study-rooms/free-seats — 운영 기간이 그 시간을 포함하는 자습실마다 빈 좌석 수', async () => {
      const a = await createRoom({ maxPersonnel: 2 });
      const b = await createRoom({ name: 'B 자습실', maxPersonnel: 5 });
      await createRoom({ name: '저녁 전에 닫음', endDate: at(18) });
      await apply(await createStudent(), a, slot(19, 21)).expect(201);
      await apply(await createStudent(), a, slot(20, 22)).expect(201);

      const res = await api().get('/api/study-rooms/free-seats').query(slot(19, 21)).expect(200);
      expect(res.body.data).toEqual([
        { studyRoomId: a, freeSeats: 0 },
        { studyRoomId: b, freeSeats: 5 },
      ]);
    });
  });

  describe('동시성', () => {
    it('같은 좌석에 10명이 동시에 같은 시간을 신청하면 1명만 성공한다', async () => {
      const roomId = await createRoom({ maxPersonnel: 5 });
      const seat1 = await seatId(roomId, 1);
      const students = await Promise.all(Array.from({ length: 10 }, () => createStudent()));

      const results = await Promise.all(students.map((s) => apply(s, roomId, slot(19, 21), seat1)));

      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(
        new Set(results.filter((r) => r.status !== 201).map((r) => r.body.error.code)),
      ).toEqual(new Set(['SEAT_TAKEN']));
      expect(await prisma.visit.count({ where: { seatId: seat1, status: 'APPLIED' } })).toBe(1);
    });

    it('서로 다른 좌석에 동시에 신청하면 모두 성공한다', async () => {
      const roomId = await createRoom({ maxPersonnel: 5 });
      const seats = await Promise.all([1, 2, 3, 4, 5].map((n) => seatId(roomId, n)));
      const students = await Promise.all(seats.map(() => createStudent()));

      const results = await Promise.all(
        students.map((s, i) => apply(s, roomId, slot(19, 21), seats[i])),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    });

    it('자동 배정으로 동시에 신청해도 좌석 수만큼만 성공하고 같은 좌석이 겹치지 않는다', async () => {
      const roomId = await createRoom({ maxPersonnel: 3 });
      const students = await Promise.all(Array.from({ length: 10 }, () => createStudent()));

      const results = await Promise.all(students.map((s) => apply(s, roomId, slot(19, 21))));

      const ok = results.filter((r) => r.status === 201);
      expect(ok).toHaveLength(3);
      expect(new Set(ok.map((r) => r.body.data.seat.number))).toEqual(new Set([1, 2, 3]));
    });
  });
});
