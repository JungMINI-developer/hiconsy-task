import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase } from './helpers.js';

/** 운영 기간: 2030-01-10 09:00 ~ 22:00 (KST) */
const ROOM = {
  name: 'A 자습실',
  maxPersonnel: 1,
  startDate: '2030-01-10T09:00:00+09:00',
  endDate: '2030-01-10T22:00:00+09:00',
};
const SLOT = { startAt: '2030-01-10T19:00:00+09:00', endAt: '2030-01-10T21:00:00+09:00' };
const MORNING = { startAt: '2030-01-10T10:00:00+09:00', endAt: '2030-01-10T12:00:00+09:00' };

describe('Waitlist (e2e)', () => {
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

  async function createStudent(name = '학생'): Promise<number> {
    phoneSeq += 1;
    const phone = `010-2000-${String(phoneSeq).padStart(4, '0')}`;
    return (await prisma.student.create({ data: { name, phone } })).id;
  }

  async function createRoom(overrides: Partial<typeof ROOM> = {}): Promise<number> {
    return (await prisma.studyRoom.create({ data: { ...ROOM, ...overrides } })).id;
  }

  const apply = (studentId: number, studyRoomId: number, slot = SLOT) =>
    api()
      .post(`/api/students/${studentId}/visits`)
      .send({ studyRoomId, ...slot });

  async function applyOk(studentId: number, studyRoomId: number, slot = SLOT): Promise<number> {
    return (await apply(studentId, studyRoomId, slot).expect(201)).body.data.id as number;
  }

  const cancelVisit = (studentId: number, visitId: number) =>
    api().post(`/api/students/${studentId}/visits/${visitId}/cancel`);

  const wait = (studentId: number, studyRoomId: number, slot = SLOT) =>
    api()
      .post(`/api/students/${studentId}/waitlist`)
      .send({ studyRoomId, ...slot });

  async function waitOk(studentId: number, studyRoomId: number, slot = SLOT): Promise<number> {
    return (await wait(studentId, studyRoomId, slot).expect(201)).body.data.id as number;
  }

  const entry = (id: number) => prisma.waitlistEntry.findUniqueOrThrow({ where: { id } });
  const myWaitlist = async (studentId: number) =>
    (await api().get(`/api/students/${studentId}/waitlist`).expect(200)).body.data as Array<{
      id: number;
      status: string;
      position: number | null;
      endReason: string | null;
      offerExpiresAt: string | null;
    }>;

  /** 정원 1명 자습실이 꽉 찬 상태: [자습실 id, 신청한 학생 id, 그 신청 id] */
  async function fullRoom(overrides: Partial<typeof ROOM> = {}) {
    const roomId = await createRoom(overrides);
    const holder = await createStudent('먼저 신청');
    const visitId = await applyOk(holder, roomId);
    return { roomId, holder, visitId };
  }

  describe('대기 등록', () => {
    it('정원이 찬 자습실에 등록하면 등록 순서대로 순번을 받는다', async () => {
      const { roomId } = await fullRoom();
      const [a, b] = [await createStudent('가'), await createStudent('나')];

      const first = await wait(a, roomId).expect(201);
      expect(first.body.data).toMatchObject({
        status: 'WAITING',
        position: 1,
        startAt: '2030-01-10T19:00:00.000+09:00',
        studyRoom: { id: roomId, deleted: false },
        offerExpiresAt: null,
      });
      expect((await wait(b, roomId).expect(201)).body.data.position).toBe(2);

      const room = (await api().get(`/api/study-rooms/${roomId}`).expect(200)).body.data;
      expect(room).toMatchObject({
        currentPersonnel: 1,
        offeredCount: 0,
        waitingCount: 2,
        availableSeats: 0,
      });
    });

    it('자리가 남아 있으면 ROOM_HAS_SEATS (바로 신청하면 된다)', async () => {
      const roomId = await createRoom({ maxPersonnel: 2 });
      await applyOk(await createStudent(), roomId);

      const res = await wait(await createStudent(), roomId).expect(409);
      expect(res.body.error.code).toBe('ROOM_HAS_SEATS');
    });

    it('이미 신청한 자습실은 ALREADY_APPLIED, 이미 대기 중이면 ALREADY_WAITING', async () => {
      const { roomId, holder } = await fullRoom();
      expect((await wait(holder, roomId).expect(409)).body.error.code).toBe('ALREADY_APPLIED');

      const a = await createStudent();
      await waitOk(a, roomId);
      expect((await wait(a, roomId).expect(409)).body.error.code).toBe('ALREADY_WAITING');
    });

    it('방문 구간은 신청과 같은 규칙으로 검사한다 (기간 밖·지난 시간)', async () => {
      const { roomId } = await fullRoom();
      const a = await createStudent();
      const outside = { startAt: '2030-01-10T21:00:00+09:00', endAt: '2030-01-10T23:00:00+09:00' };
      expect((await wait(a, roomId, outside).expect(400)).body.error.code).toBe(
        'VISIT_OUT_OF_PERIOD',
      );
      const past = { startAt: '2020-01-10T19:00:00+09:00', endAt: '2020-01-10T21:00:00+09:00' };
      expect((await wait(a, roomId, past).expect(400)).body.error.code).toBe('VISIT_IN_PAST');
    });

    it('대기 중에도 같은 시간으로 다른 자습실을 신청할 수 있다 (백업)', async () => {
      const { roomId } = await fullRoom();
      const roomB = await createRoom({ name: 'B 자습실' });
      const a = await createStudent();
      await waitOk(a, roomId);
      await applyOk(a, roomB);
    });
  });

  describe('자리 제안', () => {
    it('신청이 취소되면 1번 대기자에게 10분짜리 제안이 가고, 새 신청자보다 우선한다', async () => {
      const { roomId, holder, visitId } = await fullRoom();
      const [a, b] = [await createStudent('가'), await createStudent('나')];
      const entryA = await waitOk(a, roomId);
      await waitOk(b, roomId);

      const before = Date.now();
      await cancelVisit(holder, visitId).expect(200);

      const offered = await entry(entryA);
      expect(offered.status).toBe('OFFERED');
      const ttl = offered.offerExpiresAt!.getTime() - before;
      expect(ttl).toBeGreaterThan(9 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000 + 5000);
      expect((await myWaitlist(b))[0]).toMatchObject({ status: 'WAITING', position: 1 });

      // 대기자 우선: 대기하지 않던 학생은 자리가 비어도 신청할 수 없다
      const outsider = await createStudent('새 신청자');
      expect((await apply(outsider, roomId).expect(409)).body.error.code).toBe('CAPACITY_FULL');
      const room = (await api().get(`/api/study-rooms/${roomId}`).expect(200)).body.data;
      expect(room).toMatchObject({ currentPersonnel: 0, offeredCount: 1, availableSeats: 0 });
    });

    it('제안을 받은 학생이 신청하면 확정되고, 이력에 "대기 확정"을 남긴다 (시간 변경 가능)', async () => {
      const { roomId, holder, visitId } = await fullRoom();
      const a = await createStudent();
      const entryA = await waitOk(a, roomId);
      await cancelVisit(holder, visitId).expect(200);

      const res = await apply(a, roomId, MORNING).expect(201);
      expect(res.body.data.startAt).toBe('2030-01-10T10:00:00.000+09:00');
      expect(await entry(entryA)).toMatchObject({ status: 'CONFIRMED', endReason: '대기 확정' });

      const history = await prisma.visitHistory.findFirstOrThrow({
        where: { visitId: res.body.data.id, action: 'APPLY' },
      });
      expect(history.reason).toBe('대기 확정');
      const room = (await api().get(`/api/study-rooms/${roomId}`).expect(200)).body.data;
      expect(room).toMatchObject({ currentPersonnel: 1, offeredCount: 0, waitingCount: 0 });
    });

    it('제안을 거절하면 DECLINED가 되고 다음 대기자에게 넘어간다', async () => {
      const { roomId, holder, visitId } = await fullRoom();
      const [a, b] = [await createStudent(), await createStudent()];
      const entryA = await waitOk(a, roomId);
      const entryB = await waitOk(b, roomId);
      await cancelVisit(holder, visitId).expect(200);

      const res = await api().post(`/api/students/${a}/waitlist/${entryA}/cancel`).expect(200);
      expect(res.body.data).toMatchObject({ status: 'DECLINED', endReason: '제안 거절' });
      expect((await entry(entryB)).status).toBe('OFFERED');
    });

    it('제안이 만료되면 대기가 끝나고 다음 대기자에게 제안된다 (내 대기 조회 때 정리)', async () => {
      const { roomId, holder, visitId } = await fullRoom();
      const [a, b] = [await createStudent(), await createStudent()];
      const entryA = await waitOk(a, roomId);
      const entryB = await waitOk(b, roomId);
      await cancelVisit(holder, visitId).expect(200);
      await prisma.waitlistEntry.update({
        where: { id: entryA },
        data: { offerExpiresAt: new Date(Date.now() - 1000) },
      });

      expect((await myWaitlist(a))[0]).toMatchObject({ status: 'EXPIRED', endReason: '제안 만료' });
      expect((await myWaitlist(b))[0]).toMatchObject({ status: 'OFFERED', position: null });
      // 만료된 제안으로는 확정할 수 없다
      expect((await apply(a, roomId).expect(409)).body.error.code).toBe('CAPACITY_FULL');
      expect((await entry(entryB)).status).toBe('OFFERED');
    });

    it('원하는 방문 시작이 지난 대기는 끝난다', async () => {
      const { roomId } = await fullRoom();
      const a = await createStudent();
      const entryA = await waitOk(a, roomId);
      await prisma.waitlistEntry.update({
        where: { id: entryA },
        data: { startAt: new Date(Date.now() - 1000) },
      });

      expect((await myWaitlist(a))[0]).toMatchObject({
        status: 'EXPIRED',
        endReason: '방문 시간이 지남',
      });
    });

    it('대기를 취소하면 CANCELED, 다른 학생의 대기는 WAITLIST_NOT_FOUND, 끝난 대기는 WAITLIST_ALREADY_ENDED', async () => {
      const { roomId } = await fullRoom();
      const [a, b] = [await createStudent(), await createStudent()];
      const entryA = await waitOk(a, roomId);

      await api().post(`/api/students/${b}/waitlist/${entryA}/cancel`).expect(404);
      const res = await api().post(`/api/students/${a}/waitlist/${entryA}/cancel`).expect(200);
      expect(res.body.data).toMatchObject({ status: 'CANCELED', endReason: '본인 취소' });
      const again = await api().post(`/api/students/${a}/waitlist/${entryA}/cancel`).expect(409);
      expect(again.body.error.code).toBe('WAITLIST_ALREADY_ENDED');
      // 끝난 뒤에는 다시 등록할 수 있다 (맨 뒤)
      await waitOk(a, roomId);
    });

    it('백업 신청과 겹치면 확정할 수 없고, 백업을 취소하면 확정된다', async () => {
      const { roomId, holder, visitId } = await fullRoom();
      const roomB = await createRoom({ name: 'B 자습실' });
      const a = await createStudent();
      await waitOk(a, roomId);
      const backup = await applyOk(a, roomB);
      await cancelVisit(holder, visitId).expect(200);

      expect((await apply(a, roomId).expect(409)).body.error.code).toBe('VISIT_TIME_OVERLAP');
      await cancelVisit(a, backup).expect(200);
      await apply(a, roomId).expect(201);
    });
  });

  describe('강사의 자습실 변경', () => {
    it('최대 인원을 늘리면 늘어난 만큼 앞 순번부터 제안된다', async () => {
      const { roomId } = await fullRoom();
      const ids = [];
      for (let i = 0; i < 3; i += 1) ids.push(await waitOk(await createStudent(), roomId));

      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 3 }).expect(200);

      const statuses = await Promise.all(ids.map(async (id) => (await entry(id)).status));
      expect(statuses).toEqual(['OFFERED', 'OFFERED', 'WAITING']);
    });

    it('최대 인원을 줄여 제안이 넘치면, 늦게 등록한 제안부터 대기로 되돌린다 (순번 유지)', async () => {
      const roomId = await createRoom({ maxPersonnel: 3 });
      await applyOk(await createStudent(), roomId);
      // 정원 1명 상태에서 대기 2명 → 정원 3으로 늘려 둘 다 제안
      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 1 }).expect(200);
      const [a, b] = [await createStudent(), await createStudent()];
      const entryA = await waitOk(a, roomId);
      const entryB = await waitOk(b, roomId);
      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 3 }).expect(200);
      expect((await entry(entryB)).status).toBe('OFFERED');

      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 2 }).expect(200);

      expect((await entry(entryA)).status).toBe('OFFERED');
      expect(await entry(entryB)).toMatchObject({ status: 'WAITING', offerExpiresAt: null });
      expect((await myWaitlist(b))[0]).toMatchObject({ status: 'WAITING', position: 1 });
    });

    it('운영 기간을 바꾸면 기간 밖이 된 대기만 자동 취소한다 (기간 변경은 막지 않는다)', async () => {
      const { roomId } = await fullRoom({ startDate: '2030-01-10T09:00:00+09:00' });
      const [a, b] = [await createStudent(), await createStudent()];
      // 신청자(19~21시)는 새 기간 안에 있도록 아침 대기만 밖으로 밀어낸다
      const morning = await waitOk(a, roomId, MORNING);
      const evening = await waitOk(b, roomId);

      await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ startDate: '2030-01-10T13:00:00+09:00' })
        .expect(200);

      expect(await entry(morning)).toMatchObject({
        status: 'CANCELED',
        endReason: '운영 기간 변경',
      });
      expect((await entry(evening)).status).toBe('WAITING');
    });

    it('자습실을 삭제하면 진행 중 대기를 자동 취소한다', async () => {
      const { roomId } = await fullRoom();
      const a = await createStudent();
      const entryA = await waitOk(a, roomId);

      await api().delete(`/api/study-rooms/${roomId}`).expect(204);
      expect(await entry(entryA)).toMatchObject({ status: 'CANCELED', endReason: '자습실 삭제' });
      expect((await myWaitlist(a))[0]).toMatchObject({ studyRoom: { deleted: true } });
    });

    it('학생을 삭제하면 그 학생의 대기는 취소되고, 비워진 신청 자리는 다음 대기자에게 제안된다', async () => {
      const { roomId, holder } = await fullRoom();
      const roomB = await fullRoom({ name: 'B 자습실' });
      const a = await createStudent();
      const entryA = await waitOk(a, roomId);
      const holderWait = await waitOk(holder, roomB.roomId, MORNING);

      await api().delete(`/api/students/${holder}`).expect(204);

      expect(await entry(holderWait)).toMatchObject({ status: 'CANCELED', endReason: '학생 삭제' });
      expect((await entry(entryA)).status).toBe('OFFERED');
    });
  });

  describe('강사 화면 대기 탭', () => {
    it('제안 중 → 대기 순번 순으로, 학생 연락처와 함께 준다', async () => {
      const roomId = await createRoom({ maxPersonnel: 1 });
      const holder = await createStudent('신청');
      const visitId = await applyOk(holder, roomId);
      const [a, b, c] = [
        await createStudent('가'),
        await createStudent('나'),
        await createStudent('다'),
      ];
      for (const s of [a, b, c]) await waitOk(s, roomId);
      await cancelVisit(holder, visitId).expect(200);

      const res = await api().get(`/api/study-rooms/${roomId}/waitlist`).expect(200);
      expect(
        res.body.data.map(
          (e: { student: { name: string }; status: string; position: number | null }) => [
            e.student.name,
            e.status,
            e.position,
          ],
        ),
      ).toEqual([
        ['가', 'OFFERED', null],
        ['나', 'WAITING', 1],
        ['다', 'WAITING', 2],
      ]);
      expect(res.body.data[0].student.phone).toMatch(/^010-/);
    });
  });

  describe('동시성', () => {
    it('제안받은 자리에 다른 학생 10명이 동시에 신청해도 제안받은 학생만 성공한다', async () => {
      const { roomId, holder, visitId } = await fullRoom();
      const offeredStudent = await createStudent('대기자');
      await waitOk(offeredStudent, roomId);
      await cancelVisit(holder, visitId).expect(200);
      const others = await Promise.all(Array.from({ length: 10 }, () => createStudent()));

      const results = await Promise.all([offeredStudent, ...others].map((s) => apply(s, roomId)));

      expect(results[0]!.status).toBe(201);
      expect(results.slice(1).map((r) => r.body.error.code)).toEqual(
        Array(10).fill('CAPACITY_FULL'),
      );
      expect(await prisma.visit.count({ where: { studyRoomId: roomId, status: 'APPLIED' } })).toBe(
        1,
      );
    });

    it('마지막 자리 취소와 동시에 여러 명이 신청해도, 대기자가 있으면 자리는 대기자에게 간다', async () => {
      for (let i = 0; i < 5; i += 1) {
        await resetDatabase(prisma);
        const { roomId, holder, visitId } = await fullRoom();
        const waiter = await createStudent('대기자');
        const entryW = await waitOk(waiter, roomId);
        const others = await Promise.all(Array.from({ length: 5 }, () => createStudent()));

        const [cancel, ...applies] = await Promise.all([
          cancelVisit(holder, visitId),
          ...others.map((s) => apply(s, roomId)),
        ]);

        expect(cancel.status).toBe(200);
        expect(applies.filter((r) => r.status === 201)).toHaveLength(0);
        expect((await entry(entryW)).status).toBe('OFFERED');
      }
    });

    it('같은 학생이 같은 자습실에 동시에 여러 번 대기 등록해도 1건만 성공한다', async () => {
      const { roomId } = await fullRoom();
      const a = await createStudent();

      const results = await Promise.all(Array.from({ length: 5 }, () => wait(a, roomId)));

      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status !== 201).map((r) => r.body.error.code)).toEqual(
        Array(4).fill('ALREADY_WAITING'),
      );
    });

    it('학생 삭제와 그 학생이 신청한 자습실 삭제가 동시에 일어나도 교착 상태 없이 처리된다', async () => {
      // 학생 삭제가 학생 행을 FOR UPDATE로 잡으면, 자습실 삭제가 이 학생의 이력을 넣을 때 FK 검사와 충돌해 교착 상태가 된다
      for (let i = 0; i < 10; i += 1) {
        await resetDatabase(prisma);
        const roomId = await createRoom({ maxPersonnel: 5 });
        const s = await createStudent();
        const visitId = await applyOk(s, roomId);

        const [delStudent, delRoom] = await Promise.all([
          api().delete(`/api/students/${s}`),
          api().delete(`/api/study-rooms/${roomId}`),
        ]);

        expect([delStudent.status, delRoom.status]).toEqual([204, 204]);
        const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
        expect(visit.status).toBe('CANCELED');
        // 자동 취소 이력은 한 번만 남는다
        expect(await prisma.visitHistory.count({ where: { visitId, action: 'CANCEL' } })).toBe(1);
      }
    });
  });
});
