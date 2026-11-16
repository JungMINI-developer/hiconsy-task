import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase } from './helpers.js';

/** 운영 기간: 2030-01-10 09:00 ~ 22:00 (KST) */
const ROOM = {
  name: 'A 자습실',
  maxPersonnel: 3,
  startDate: '2030-01-10T09:00:00+09:00',
  endDate: '2030-01-10T22:00:00+09:00',
};
const SLOT = { startAt: '2030-01-10T19:00:00+09:00', endAt: '2030-01-10T21:00:00+09:00' };

describe('Visits (e2e)', () => {
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
    const phone = `010-1000-${String(phoneSeq).padStart(4, '0')}`;
    const student = await prisma.student.create({ data: { name, phone } });
    return student.id;
  }

  async function createRoom(overrides: Partial<typeof ROOM> = {}): Promise<number> {
    const room = await prisma.studyRoom.create({ data: { ...ROOM, ...overrides } });
    return room.id;
  }

  function apply(studentId: number, studyRoomId: number, slot = SLOT) {
    return api()
      .post(`/api/students/${studentId}/visits`)
      .send({ studyRoomId, ...slot });
  }

  async function applyOk(studentId: number, studyRoomId: number, slot = SLOT): Promise<number> {
    const res = await apply(studentId, studyRoomId, slot).expect(201);
    return res.body.data.id as number;
  }

  async function historyActions(visitId: number) {
    const rows = await prisma.visitHistory.findMany({
      where: { visitId },
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => `${row.action}:${row.actorType}`);
  }

  describe('POST /api/students/:studentId/visits (신청)', () => {
    it('신청하고 APPLY 이력을 남긴다', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();

      const res = await apply(studentId, roomId).expect(201);
      expect(res.body.data).toMatchObject({
        studentId,
        status: 'APPLIED',
        startAt: '2030-01-10T19:00:00.000+09:00',
        endAt: '2030-01-10T21:00:00.000+09:00',
        canceledAt: null,
        studyRoom: { id: roomId, name: ROOM.name, deleted: false },
      });
      expect(await historyActions(res.body.data.id)).toEqual(['APPLY:STUDENT']);
    });

    it.each([
      ['운영 기간 전 시작', '2030-01-10T08:00:00+09:00', '2030-01-10T10:00:00+09:00'],
      ['운영 기간 후 종료', '2030-01-10T21:00:00+09:00', '2030-01-10T23:00:00+09:00'],
    ])('%s → VISIT_OUT_OF_PERIOD', async (_, startAt, endAt) => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      const res = await apply(studentId, roomId, { startAt, endAt }).expect(400);
      expect(res.body.error.code).toBe('VISIT_OUT_OF_PERIOD');
    });

    it('운영 기간 경계(시작·종료 시각과 같음)는 허용한다', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      await apply(studentId, roomId, { startAt: ROOM.startDate, endAt: ROOM.endDate }).expect(201);
    });

    it('시작 ≥ 종료면 INVALID_PERIOD', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      const res = await apply(studentId, roomId, {
        startAt: SLOT.endAt,
        endAt: SLOT.startAt,
      }).expect(400);
      expect(res.body.error.code).toBe('INVALID_PERIOD');
    });

    it('지난 시간이면 VISIT_IN_PAST', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom({
        startDate: '2020-01-01T00:00:00+09:00',
        endDate: '2040-01-01T00:00:00+09:00',
      });
      const res = await apply(studentId, roomId, {
        startAt: '2020-06-01T10:00:00+09:00',
        endAt: '2020-06-01T12:00:00+09:00',
      }).expect(400);
      expect(res.body.error.code).toBe('VISIT_IN_PAST');
    });

    it('삭제된 자습실에는 신청할 수 없다', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      await api().delete(`/api/study-rooms/${roomId}`).expect(204);

      const res = await apply(studentId, roomId).expect(404);
      expect(res.body.error.code).toBe('STUDY_ROOM_NOT_FOUND');
    });

    it('없거나 삭제된 학생은 STUDENT_NOT_FOUND', async () => {
      const roomId = await createRoom();
      const studentId = await createStudent();
      await api().delete(`/api/students/${studentId}`).expect(204);

      expect((await apply(studentId, roomId).expect(404)).body.error.code).toBe(
        'STUDENT_NOT_FOUND',
      );
      expect((await apply(9999, roomId).expect(404)).body.error.code).toBe('STUDENT_NOT_FOUND');
    });

    it('같은 자습실에 유효 신청이 있으면 ALREADY_APPLIED', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      await applyOk(studentId, roomId);

      const res = await apply(studentId, roomId).expect(409);
      expect(res.body.error.code).toBe('ALREADY_APPLIED');
    });

    it('정원이 차면 CAPACITY_FULL, 누가 취소하면 다시 신청할 수 있다', async () => {
      const roomId = await createRoom({ maxPersonnel: 2 });
      const [a, b, c] = [await createStudent(), await createStudent(), await createStudent()];
      const visitA = await applyOk(a, roomId);
      await applyOk(b, roomId);

      const full = await apply(c, roomId).expect(409);
      expect(full.body.error.code).toBe('CAPACITY_FULL');

      await api().post(`/api/students/${a}/visits/${visitA}/cancel`).expect(200);
      await apply(c, roomId).expect(201);
    });

    it('취소 후 재신청하면 같은 신청 행을 APPLIED로 되돌리고 이력이 이어진다', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      const visitId = await applyOk(studentId, roomId);
      await api().post(`/api/students/${studentId}/visits/${visitId}/cancel`).expect(200);

      const slot = { startAt: '2030-01-10T10:00:00+09:00', endAt: '2030-01-10T12:00:00+09:00' };
      const res = await apply(studentId, roomId, slot).expect(201);
      expect(res.body.data).toMatchObject({
        id: visitId,
        status: 'APPLIED',
        canceledAt: null,
        startAt: '2030-01-10T10:00:00.000+09:00',
      });
      expect(await historyActions(visitId)).toEqual([
        'APPLY:STUDENT',
        'CANCEL:STUDENT',
        'APPLY:STUDENT',
      ]);
    });
  });

  describe('다른 자습실과 방문 시간 겹침', () => {
    it('같은 학생이 다른 자습실에 겹치는 시간으로 신청하면 VISIT_TIME_OVERLAP', async () => {
      const studentId = await createStudent();
      const roomA = await createRoom({ name: 'A 자습실' });
      const roomB = await createRoom({ name: 'B 자습실' });
      await applyOk(studentId, roomA); // 19~21시

      const res = await apply(studentId, roomB, {
        startAt: '2030-01-10T20:00:00+09:00',
        endAt: '2030-01-10T22:00:00+09:00',
      }).expect(409);
      expect(res.body.error).toMatchObject({
        code: 'VISIT_TIME_OVERLAP',
        message: expect.stringContaining('A 자습실'),
      });
      expect(await prisma.visit.count({ where: { studyRoomId: roomB } })).toBe(0);
    });

    it('기존 신청을 완전히 감싸는 구간도 겹침이다', async () => {
      const studentId = await createStudent();
      const [roomA, roomB] = [await createRoom(), await createRoom()];
      await applyOk(studentId, roomA); // 19~21시

      const res = await apply(studentId, roomB, {
        startAt: '2030-01-10T18:00:00+09:00',
        endAt: '2030-01-10T22:00:00+09:00',
      }).expect(409);
      expect(res.body.error.code).toBe('VISIT_TIME_OVERLAP');
    });

    it('이어지는 구간(앞 신청의 종료 = 새 신청의 시작)은 허용한다', async () => {
      const studentId = await createStudent();
      const [roomA, roomB, roomC] = [await createRoom(), await createRoom(), await createRoom()];
      await applyOk(studentId, roomA); // 19~21시

      await applyOk(studentId, roomB, {
        startAt: '2030-01-10T21:00:00+09:00',
        endAt: '2030-01-10T22:00:00+09:00',
      });
      await applyOk(studentId, roomC, {
        startAt: '2030-01-10T17:00:00+09:00',
        endAt: '2030-01-10T19:00:00+09:00',
      });
    });

    it('다른 학생과는 겹쳐도 되고, 취소한 신청과는 겹쳐도 된다', async () => {
      const [a, b] = [await createStudent(), await createStudent()];
      const [roomA, roomB] = [await createRoom(), await createRoom()];
      const visitA = await applyOk(a, roomA);
      await applyOk(b, roomB);

      await api().post(`/api/students/${a}/visits/${visitA}/cancel`).expect(200);
      await applyOk(a, roomB);
    });

    it('재신청도 다른 자습실의 유효 신청과 겹치면 막는다', async () => {
      const studentId = await createStudent();
      const [roomA, roomB] = [await createRoom(), await createRoom()];
      const visitA = await applyOk(studentId, roomA);
      await api().post(`/api/students/${studentId}/visits/${visitA}/cancel`).expect(200);
      await applyOk(studentId, roomB);

      const res = await apply(studentId, roomA).expect(409);
      expect(res.body.error.code).toBe('VISIT_TIME_OVERLAP');
      expect(await historyActions(visitA)).toEqual(['APPLY:STUDENT', 'CANCEL:STUDENT']);
    });

    it('시간 수정은 자기 자신을 빼고 검사하고, 다른 자습실 신청과 겹치면 막는다', async () => {
      const studentId = await createStudent();
      const [roomA, roomB] = [await createRoom(), await createRoom()];
      const visitA = await applyOk(studentId, roomA); // 19~21시
      await applyOk(studentId, roomB, {
        startAt: '2030-01-10T10:00:00+09:00',
        endAt: '2030-01-10T12:00:00+09:00',
      });

      // 자기 구간과 겹치게 늘리는 건 허용
      await api()
        .patch(`/api/students/${studentId}/visits/${visitA}`)
        .send({ startAt: '2030-01-10T19:30:00+09:00', endAt: '2030-01-10T21:30:00+09:00' })
        .expect(200);

      const res = await api()
        .patch(`/api/students/${studentId}/visits/${visitA}`)
        .send({ startAt: '2030-01-10T11:00:00+09:00', endAt: '2030-01-10T13:00:00+09:00' })
        .expect(409);
      expect(res.body.error.code).toBe('VISIT_TIME_OVERLAP');
      expect(await historyActions(visitA)).toEqual(['APPLY:STUDENT', 'UPDATE:STUDENT']);
    });
  });

  describe('PATCH /api/students/:studentId/visits/:visitId (시간 수정)', () => {
    it('방문 시간을 바꾸고 변경 전후를 UPDATE 이력에 남긴다', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      const visitId = await applyOk(studentId, roomId);

      const res = await api()
        .patch(`/api/students/${studentId}/visits/${visitId}`)
        .send({ startAt: '2030-01-10T20:00:00+09:00', endAt: '2030-01-10T22:00:00+09:00' })
        .expect(200);
      expect(res.body.data).toMatchObject({
        startAt: '2030-01-10T20:00:00.000+09:00',
        endAt: '2030-01-10T22:00:00.000+09:00',
      });

      const history = await api().get(`/api/study-rooms/${roomId}/histories`).expect(200);
      expect(history.body.data[1]).toMatchObject({
        action: 'UPDATE',
        actorType: 'STUDENT',
        prevStartAt: '2030-01-10T19:00:00.000+09:00',
        startAt: '2030-01-10T20:00:00.000+09:00',
      });
    });

    it('같은 시간으로 수정하면 이력을 남기지 않는다', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      const visitId = await applyOk(studentId, roomId);

      await api().patch(`/api/students/${studentId}/visits/${visitId}`).send(SLOT).expect(200);
      expect(await historyActions(visitId)).toEqual(['APPLY:STUDENT']);
    });

    it('운영 기간을 벗어나면 VISIT_OUT_OF_PERIOD', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      const visitId = await applyOk(studentId, roomId);

      const res = await api()
        .patch(`/api/students/${studentId}/visits/${visitId}`)
        .send({ startAt: '2030-01-10T21:00:00+09:00', endAt: '2030-01-10T23:00:00+09:00' })
        .expect(400);
      expect(res.body.error.code).toBe('VISIT_OUT_OF_PERIOD');
    });

    it('다른 학생의 신청은 VISIT_NOT_FOUND', async () => {
      const owner = await createStudent();
      const other = await createStudent();
      const roomId = await createRoom();
      const visitId = await applyOk(owner, roomId);

      const res = await api()
        .patch(`/api/students/${other}/visits/${visitId}`)
        .send(SLOT)
        .expect(404);
      expect(res.body.error.code).toBe('VISIT_NOT_FOUND');
    });

    it('취소된 신청은 VISIT_ALREADY_CANCELED', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      const visitId = await applyOk(studentId, roomId);
      await api().post(`/api/students/${studentId}/visits/${visitId}/cancel`).expect(200);

      const res = await api()
        .patch(`/api/students/${studentId}/visits/${visitId}`)
        .send(SLOT)
        .expect(409);
      expect(res.body.error.code).toBe('VISIT_ALREADY_CANCELED');
    });
  });

  describe('POST /api/students/:studentId/visits/:visitId/cancel (취소)', () => {
    it('취소하면 CANCELED가 되고 자습실 현재 인원이 복원된다', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      const visitId = await applyOk(studentId, roomId);

      const res = await api()
        .post(`/api/students/${studentId}/visits/${visitId}/cancel`)
        .expect(200);
      expect(res.body.data.status).toBe('CANCELED');
      expect(res.body.data.canceledAt).toMatch(/\+09:00$/);

      const room = await api().get(`/api/study-rooms/${roomId}`).expect(200);
      expect(room.body.data.currentPersonnel).toBe(0);
      expect(await historyActions(visitId)).toEqual(['APPLY:STUDENT', 'CANCEL:STUDENT']);
    });

    it('이미 취소된 신청은 VISIT_ALREADY_CANCELED', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom();
      const visitId = await applyOk(studentId, roomId);
      await api().post(`/api/students/${studentId}/visits/${visitId}/cancel`).expect(200);

      const res = await api()
        .post(`/api/students/${studentId}/visits/${visitId}/cancel`)
        .expect(409);
      expect(res.body.error.code).toBe('VISIT_ALREADY_CANCELED');
    });
  });

  describe('이미 시작된 방문', () => {
    it('수정·취소할 수 없다 (VISIT_ALREADY_STARTED)', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom({
        startDate: '2020-01-01T00:00:00+09:00',
        endDate: '2040-01-01T00:00:00+09:00',
      });
      // 과거 시작 신청은 API로 만들 수 없으므로 DB에 직접 만든다
      const visit = await prisma.visit.create({
        data: {
          studentId,
          studyRoomId: roomId,
          startAt: '2020-06-01T10:00:00+09:00',
          endAt: '2039-01-01T00:00:00+09:00',
        },
      });

      const patch = await api()
        .patch(`/api/students/${studentId}/visits/${visit.id}`)
        .send(SLOT)
        .expect(409);
      expect(patch.body.error.code).toBe('VISIT_ALREADY_STARTED');

      const cancel = await api()
        .post(`/api/students/${studentId}/visits/${visit.id}/cancel`)
        .expect(409);
      expect(cancel.body.error.code).toBe('VISIT_ALREADY_STARTED');
    });
  });

  describe('GET /api/students/:studentId/visits (내 신청 목록)', () => {
    it('본인 신청만, 취소 포함, 방문 시작 순으로 준다', async () => {
      const me = await createStudent();
      const other = await createStudent();
      const roomA = await createRoom({ name: 'A' });
      const roomB = await createRoom({ name: 'B' });
      const roomC = await createRoom({ name: 'C' });

      await applyOk(me, roomA, SLOT);
      const canceled = await applyOk(me, roomB, {
        startAt: '2030-01-10T10:00:00+09:00',
        endAt: '2030-01-10T11:00:00+09:00',
      });
      await api().post(`/api/students/${me}/visits/${canceled}/cancel`).expect(200);
      await applyOk(other, roomC);

      const res = await api().get(`/api/students/${me}/visits`).expect(200);
      expect(
        res.body.data.map((v: { studyRoom: { name: string }; status: string }) => [
          v.studyRoom.name,
          v.status,
        ]),
      ).toEqual([
        ['B', 'CANCELED'],
        ['A', 'APPLIED'],
      ]);
    });

    it('자습실이 삭제되면 신청이 자동 취소되고 deleted로 표시된다', async () => {
      const me = await createStudent();
      const roomId = await createRoom();
      await applyOk(me, roomId);
      await api().delete(`/api/study-rooms/${roomId}`).expect(204);

      const res = await api().get(`/api/students/${me}/visits`).expect(200);
      expect(res.body.data[0]).toMatchObject({
        status: 'CANCELED',
        studyRoom: { id: roomId, deleted: true },
      });
    });
  });

  describe('동시성', () => {
    it('정원 3명 자습실에 10명이 동시에 신청해도 3명만 성공한다', async () => {
      const roomId = await createRoom({ maxPersonnel: 3 });
      const students = await Promise.all(Array.from({ length: 10 }, () => createStudent()));

      const results = await Promise.all(students.map((id) => apply(id, roomId)));
      const statuses = results.map((res) => res.status).sort();

      expect(statuses.filter((s) => s === 201)).toHaveLength(3);
      expect(results.filter((res) => res.status === 409).map((res) => res.body.error.code)).toEqual(
        Array(7).fill('CAPACITY_FULL'),
      );
      expect(await prisma.visit.count({ where: { studyRoomId: roomId, status: 'APPLIED' } })).toBe(
        3,
      );
    });

    describe('정원 마지막 1자리', () => {
      async function applied(roomId: number) {
        return prisma.visit.count({ where: { studyRoomId: roomId, status: 'APPLIED' } });
      }

      it('20명이 동시에 신청해도 1명만 성공하고 나머지는 CAPACITY_FULL', async () => {
        const roomId = await createRoom({ maxPersonnel: 5 });
        for (let i = 0; i < 4; i += 1) await applyOk(await createStudent(), roomId);
        const students = await Promise.all(Array.from({ length: 20 }, () => createStudent()));

        const results = await Promise.all(students.map((id) => apply(id, roomId)));

        expect(results.filter((res) => res.status === 201)).toHaveLength(1);
        expect(
          results.filter((res) => res.status !== 201).map((res) => res.body.error.code),
        ).toEqual(Array(19).fill('CAPACITY_FULL'));
        expect(await applied(roomId)).toBe(5);
        // 거절된 신청은 이력도 남지 않는다 (먼저 신청한 4건 + 성공 1건)
        expect(await prisma.visitHistory.count({ where: { studyRoomId: roomId } })).toBe(5);
      });

      it('재신청(취소했던 학생)과 신규 신청이 동시에 와도 1건만 성공한다', async () => {
        const roomId = await createRoom({ maxPersonnel: 2 });
        const [a, b, c, d] = await Promise.all(Array.from({ length: 4 }, () => createStudent()));
        await applyOk(a, roomId);
        const visitB = await applyOk(b, roomId);
        await api().post(`/api/students/${b}/visits/${visitB}/cancel`).expect(200); // 남은 자리 1

        const results = await Promise.all([b, c, d].map((id) => apply(id, roomId)));

        expect(results.filter((res) => res.status === 201)).toHaveLength(1);
        expect(
          results.filter((res) => res.status !== 201).map((res) => res.body.error.code),
        ).toEqual(['CAPACITY_FULL', 'CAPACITY_FULL']);
        expect(await applied(roomId)).toBe(2);
      });

      it('정원이 찬 자습실에서 취소와 신규 신청이 동시에 와도 정원을 넘지 않는다', async () => {
        // 어느 쪽이 먼저 락을 잡느냐에 따라 결과가 갈리므로 여러 번 반복한다
        for (let i = 0; i < 10; i += 1) {
          await resetDatabase(prisma);
          const roomId = await createRoom({ maxPersonnel: 1 });
          const [a, b] = [await createStudent(), await createStudent()];
          const visitA = await applyOk(a, roomId);

          const [cancel, applyB] = await Promise.all([
            api().post(`/api/students/${a}/visits/${visitA}/cancel`),
            apply(b, roomId),
          ]);

          expect(cancel.status).toBe(200);
          if (applyB.status === 201) {
            // 취소가 먼저 커밋됨 → 비워진 자리를 B가 차지
            expect(await applied(roomId)).toBe(1);
          } else {
            // 신청이 먼저 락을 잡음 → 아직 꽉 차 있어 거절, 그 뒤 취소로 0명
            expect(applyB.body.error.code).toBe('CAPACITY_FULL');
            expect(await applied(roomId)).toBe(0);
          }
        }
      });
    });

    it('같은 학생이 같은 자습실에 동시에 여러 번 신청해도 1건만 성공한다', async () => {
      const studentId = await createStudent();
      const roomId = await createRoom({ maxPersonnel: 10 });

      const results = await Promise.all(Array.from({ length: 5 }, () => apply(studentId, roomId)));

      expect(results.filter((res) => res.status === 201)).toHaveLength(1);
      expect(results.filter((res) => res.status !== 201).map((res) => res.body.error.code)).toEqual(
        Array(4).fill('ALREADY_APPLIED'),
      );
      expect(await prisma.visitHistory.count()).toBe(1);
    });

    it('정원 축소와 신청이 동시에 일어나도 정원을 넘지 않는다', async () => {
      const roomId = await createRoom({ maxPersonnel: 3 });
      const [a, b, c] = [await createStudent(), await createStudent(), await createStudent()];
      await applyOk(a, roomId);
      await applyOk(b, roomId);

      const [shrink, applyC] = await Promise.all([
        api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 2 }),
        apply(c, roomId),
      ]);

      // 어느 쪽이 먼저 락을 잡든 둘 중 하나만 성공한다
      expect([shrink.status, applyC.status].sort()).toEqual([200, 409].sort());
      const room = await prisma.studyRoom.findUniqueOrThrow({ where: { id: roomId } });
      const applied = await prisma.visit.count({
        where: { studyRoomId: roomId, status: 'APPLIED' },
      });
      expect(applied).toBeLessThanOrEqual(room.maxPersonnel);
    });

    it('같은 학생이 여러 자습실에 같은 시간으로 동시에 신청해도 1건만 성공한다', async () => {
      const studentId = await createStudent();
      const rooms = await Promise.all(Array.from({ length: 5 }, () => createRoom()));

      const results = await Promise.all(rooms.map((roomId) => apply(studentId, roomId)));

      expect(results.filter((res) => res.status === 201)).toHaveLength(1);
      expect(results.filter((res) => res.status !== 201).map((res) => res.body.error.code)).toEqual(
        Array(4).fill('VISIT_TIME_OVERLAP'),
      );
      expect(await prisma.visit.count({ where: { studentId, status: 'APPLIED' } })).toBe(1);
    });

    it('같은 학생이 두 신청을 서로 겹치게 동시에 수정해도 1건만 성공한다', async () => {
      const studentId = await createStudent();
      const [roomA, roomB] = [await createRoom(), await createRoom()];
      const visitA = await applyOk(studentId, roomA); // 19~21시
      const visitB = await applyOk(studentId, roomB, {
        startAt: '2030-01-10T10:00:00+09:00',
        endAt: '2030-01-10T12:00:00+09:00',
      });

      const target = { startAt: '2030-01-10T15:00:00+09:00', endAt: '2030-01-10T17:00:00+09:00' };
      const results = await Promise.all(
        [visitA, visitB].map((id) =>
          api().patch(`/api/students/${studentId}/visits/${id}`).send(target),
        ),
      );

      expect(results.filter((res) => res.status === 200)).toHaveLength(1);
      expect(results.filter((res) => res.status !== 200).map((res) => res.body.error.code)).toEqual(
        ['VISIT_TIME_OVERLAP'],
      );
    });

    it('시간 수정과 그 신청의 자습실 삭제가 동시에 일어나도 교착 상태 없이 처리된다', async () => {
      // 자습실 삭제는 자습실 락을 잡은 채 이력을 넣으며 학생 행에 FK 검사(FOR KEY SHARE)를 건다.
      // 시간 수정이 학생 행을 FOR UPDATE로 잡으면 서로를 기다려 교착 상태가 된다.
      for (let i = 0; i < 10; i += 1) {
        await resetDatabase(prisma);
        const studentId = await createStudent();
        const roomId = await createRoom();
        const visitId = await applyOk(studentId, roomId);

        const [patch, remove] = await Promise.all([
          api()
            .patch(`/api/students/${studentId}/visits/${visitId}`)
            .send({ startAt: '2030-01-10T20:00:00+09:00', endAt: '2030-01-10T22:00:00+09:00' }),
          api().delete(`/api/study-rooms/${roomId}`),
        ]);

        expect(remove.status).toBe(204);
        // 수정이 먼저면 성공, 삭제가 먼저면 자습실이 없다
        expect([200, 404]).toContain(patch.status);
        const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
        expect(visit.status).toBe('CANCELED');
      }
    });
  });
});
