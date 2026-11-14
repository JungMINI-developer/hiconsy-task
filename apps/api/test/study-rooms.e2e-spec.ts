import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase } from './helpers.js';

const room = {
  name: 'A 자습실',
  maxPersonnel: 3,
  startDate: '2030-01-10T09:00:00.000Z',
  endDate: '2030-01-10T22:00:00.000Z',
};

describe('StudyRooms (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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

  async function createRoom(body: Partial<typeof room> = {}): Promise<number> {
    const res = await api()
      .post('/api/study-rooms')
      .send({ ...room, ...body })
      .expect(201);
    return res.body.data.id as number;
  }

  /** 테스트용 방문 신청 (방문 API 구현 전이라 DB에 직접 생성) */
  async function applyVisit(roomId: number, startAt: string, endAt: string, name = '학생') {
    const student = await prisma.student.create({ data: { name, phone: '010-0000-0000' } });
    const visit = await prisma.visit.create({
      data: { studentId: student.id, studyRoomId: roomId, startAt, endAt },
    });
    await prisma.visitHistory.create({
      data: {
        visitId: visit.id,
        studentId: student.id,
        studyRoomId: roomId,
        action: 'APPLY',
        startAt,
        endAt,
      },
    });
    return visit;
  }

  describe('POST /api/study-rooms', () => {
    it('자습실을 등록한다', async () => {
      const res = await api().post('/api/study-rooms').send(room).expect(201);
      expect(res.body).toMatchObject({
        success: true,
        data: { ...room, currentPersonnel: 0 },
      });
    });

    it('시작 일시가 종료 일시보다 늦으면 INVALID_PERIOD', async () => {
      const res = await api()
        .post('/api/study-rooms')
        .send({ ...room, startDate: room.endDate, endDate: room.startDate })
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_PERIOD');
    });

    it('입력값이 올바르지 않으면 details에 사유를 담는다', async () => {
      const res = await api()
        .post('/api/study-rooms')
        .send({ ...room, maxPersonnel: 0, startDate: 'not-a-date' })
        .expect(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.details).toHaveLength(2);
    });
  });

  describe('GET /api/study-rooms', () => {
    it('삭제된 자습실을 제외하고, 현재 신청 인원(취소 제외)을 함께 준다', async () => {
      const roomId = await createRoom();
      const deletedId = await createRoom({ name: '삭제될 자습실' });
      await applyVisit(roomId, '2030-01-10T10:00:00Z', '2030-01-10T12:00:00Z', '학생1');
      const canceled = await applyVisit(roomId, '2030-01-10T10:00:00Z', '2030-01-10T12:00:00Z');
      await prisma.visit.update({ where: { id: canceled.id }, data: { status: 'CANCELED' } });
      await api().delete(`/api/study-rooms/${deletedId}`).expect(204);

      const res = await api().get('/api/study-rooms').expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ id: roomId, currentPersonnel: 1 });
    });
  });

  describe('GET /api/study-rooms/:id', () => {
    it('없는 자습실은 STUDY_ROOM_NOT_FOUND', async () => {
      const res = await api().get('/api/study-rooms/9999').expect(404);
      expect(res.body.error.code).toBe('STUDY_ROOM_NOT_FOUND');
    });
  });

  describe('PATCH /api/study-rooms/:id', () => {
    it('보낸 필드만 수정한다', async () => {
      const roomId = await createRoom();
      const res = await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ maxPersonnel: 5 })
        .expect(200);
      expect(res.body.data).toMatchObject({ ...room, maxPersonnel: 5 });
    });

    it('최대 인원을 현재 신청 인원보다 작게 줄이면 CAPACITY_BELOW_CURRENT', async () => {
      const roomId = await createRoom();
      await applyVisit(roomId, '2030-01-10T10:00:00Z', '2030-01-10T12:00:00Z');
      await applyVisit(roomId, '2030-01-10T10:00:00Z', '2030-01-10T12:00:00Z');

      const res = await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ maxPersonnel: 1 })
        .expect(409);
      expect(res.body.error.code).toBe('CAPACITY_BELOW_CURRENT');

      // 현재 신청 인원과 같게는 줄일 수 있다
      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 2 }).expect(200);
    });

    it('운영 기간 밖으로 밀려나는 신청이 있으면 PERIOD_EXCLUDES_VISITS', async () => {
      const roomId = await createRoom();
      await applyVisit(roomId, '2030-01-10T19:00:00Z', '2030-01-10T21:00:00Z');

      const res = await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ endDate: '2030-01-10T20:00:00Z' })
        .expect(409);
      expect(res.body.error.code).toBe('PERIOD_EXCLUDES_VISITS');

      // 신청 구간을 포함하는 기간으로는 변경할 수 있다
      await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ endDate: '2030-01-10T21:00:00Z' })
        .expect(200);
    });

    it('취소된 신청은 기간 변경을 막지 않는다', async () => {
      const roomId = await createRoom();
      const visit = await applyVisit(roomId, '2030-01-10T19:00:00Z', '2030-01-10T21:00:00Z');
      await prisma.visit.update({ where: { id: visit.id }, data: { status: 'CANCELED' } });

      await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ endDate: '2030-01-10T12:00:00Z' })
        .expect(200);
    });

    it('수정 결과 시작 ≥ 종료가 되면 INVALID_PERIOD', async () => {
      const roomId = await createRoom();
      const res = await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ startDate: '2030-01-11T00:00:00Z' })
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_PERIOD');
    });
  });

  describe('DELETE /api/study-rooms/:id', () => {
    it('Soft Delete하고 유효 신청을 SYSTEM 사유로 자동 취소한다', async () => {
      const roomId = await createRoom();
      const visit = await applyVisit(roomId, '2030-01-10T10:00:00Z', '2030-01-10T12:00:00Z');

      await api().delete(`/api/study-rooms/${roomId}`).expect(204);

      const deleted = await prisma.studyRoom.findUniqueOrThrow({ where: { id: roomId } });
      expect(deleted.deletedAt).not.toBeNull();

      const canceled = await prisma.visit.findUniqueOrThrow({ where: { id: visit.id } });
      expect(canceled.status).toBe('CANCELED');

      const histories = await prisma.visitHistory.findMany({
        where: { visitId: visit.id },
        orderBy: { id: 'asc' },
      });
      expect(histories.map((h) => h.action)).toEqual(['APPLY', 'CANCEL']);
      expect(histories[1]).toMatchObject({ actorType: 'SYSTEM', reason: '자습실 삭제' });
    });

    it('삭제된 자습실은 조회·수정·삭제할 수 없다', async () => {
      const roomId = await createRoom();
      await api().delete(`/api/study-rooms/${roomId}`).expect(204);

      await api().get(`/api/study-rooms/${roomId}`).expect(404);
      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 5 }).expect(404);
      await api().delete(`/api/study-rooms/${roomId}`).expect(404);
    });
  });

  describe('GET /api/study-rooms/:id/histories', () => {
    it('이력을 시간순으로 학생 정보와 함께 준다', async () => {
      const roomId = await createRoom();
      const visit = await applyVisit(
        roomId,
        '2030-01-10T10:00:00Z',
        '2030-01-10T12:00:00Z',
        '김하이',
      );
      await prisma.visitHistory.create({
        data: {
          visitId: visit.id,
          studentId: visit.studentId,
          studyRoomId: roomId,
          action: 'UPDATE',
          prevStartAt: '2030-01-10T10:00:00Z',
          prevEndAt: '2030-01-10T12:00:00Z',
          startAt: '2030-01-10T11:00:00Z',
          endAt: '2030-01-10T13:00:00Z',
        },
      });

      const res = await api().get(`/api/study-rooms/${roomId}/histories`).expect(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toMatchObject({
        action: 'APPLY',
        student: { name: '김하이' },
        prevStartAt: null,
      });
      expect(res.body.data[1]).toMatchObject({
        action: 'UPDATE',
        prevStartAt: '2030-01-10T10:00:00.000Z',
        startAt: '2030-01-10T11:00:00.000Z',
      });
    });
  });
});
