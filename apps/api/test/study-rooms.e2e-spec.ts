import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase } from './helpers.js';

const room = {
  name: 'A 자습실',
  maxPersonnel: 3,
  startDate: '2030-01-10T09:00:00.000+09:00',
  endDate: '2030-01-10T22:00:00.000+09:00',
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

  let phoneSeq = 0;

  /** 테스트용 방문 신청 (방문 API 구현 전이라 DB에 직접 생성). seatNumber를 주면 그 좌석에 앉힌다 */
  async function applyVisit(
    roomId: number,
    startAt: string,
    endAt: string,
    name = '학생',
    seatNumber?: number,
  ) {
    phoneSeq += 1;
    const phone = `010-0000-${String(phoneSeq).padStart(4, '0')}`;
    const student = await prisma.student.create({ data: { name, phone } });
    const seat =
      seatNumber === undefined
        ? null
        : await prisma.seat.findUniqueOrThrow({
            where: { studyRoomId_number: { studyRoomId: roomId, number: seatNumber } },
          });
    const visit = await prisma.visit.create({
      data: { studentId: student.id, studyRoomId: roomId, startAt, endAt, seatId: seat?.id },
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

    it('최대 인원만큼 좌석 1~N번을 만든다', async () => {
      const roomId = await createRoom({ maxPersonnel: 4 });
      const seats = await prisma.seat.findMany({
        where: { studyRoomId: roomId },
        orderBy: { number: 'asc' },
      });
      expect(seats.map((s) => s.number)).toEqual([1, 2, 3, 4]);
    });

    it('최대 인원은 1~30명 (= 좌석 수)', async () => {
      await createRoom({ maxPersonnel: 30 });
      const res = await api()
        .post('/api/study-rooms')
        .send({ ...room, maxPersonnel: 31 })
        .expect(400);
      expect(res.body.error.details.join()).toContain('maxPersonnel');
    });

    it('UTC(Z)로 보내도 응답은 KST(+09:00)로 준다', async () => {
      const res = await api()
        .post('/api/study-rooms')
        .send({ ...room, startDate: '2030-01-10T00:00:00Z', endDate: '2030-01-10T13:00:00Z' })
        .expect(201);
      expect(res.body.data.startDate).toBe('2030-01-10T09:00:00.000+09:00');
      expect(res.body.data.endDate).toBe('2030-01-10T22:00:00.000+09:00');
      expect(res.body.data.createdAt).toMatch(/\+09:00$/);
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
      await applyVisit(roomId, '2030-01-10T10:00:00+09:00', '2030-01-10T12:00:00+09:00', '학생1');
      const canceled = await applyVisit(
        roomId,
        '2030-01-10T10:00:00+09:00',
        '2030-01-10T12:00:00+09:00',
      );
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

    it('최대 인원을 줄일 때 없어질 좌석에 끝나지 않은 예약이 있으면 SEATS_IN_USE', async () => {
      const roomId = await createRoom(); // 3석
      await applyVisit(roomId, '2030-01-10T10:00:00+09:00', '2030-01-10T12:00:00+09:00', 'A', 1);
      await applyVisit(roomId, '2030-01-10T10:00:00+09:00', '2030-01-10T12:00:00+09:00', 'B', 3);

      const res = await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ maxPersonnel: 2 })
        .expect(409);
      expect(res.body.error.code).toBe('SEATS_IN_USE');
      expect(res.body.error.message).toContain('3번');
    });

    it('남는 좌석에만 예약이 있으면 신청 건수보다 작게도 줄일 수 있다 (좌석 = 최대 인원)', async () => {
      const roomId = await createRoom(); // 3석
      // 1번 좌석을 시간별로 나눠 3명이 쓴다
      await applyVisit(roomId, '2030-01-10T10:00:00+09:00', '2030-01-10T12:00:00+09:00', 'A', 1);
      await applyVisit(roomId, '2030-01-10T13:00:00+09:00', '2030-01-10T15:00:00+09:00', 'B', 1);
      await applyVisit(roomId, '2030-01-10T19:00:00+09:00', '2030-01-10T21:00:00+09:00', 'C', 1);

      const res = await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ maxPersonnel: 1 })
        .expect(200);
      expect(res.body.data).toMatchObject({ maxPersonnel: 1, currentPersonnel: 3 });
    });

    it('취소했거나 이미 끝난 예약은 좌석 축소를 막지 않는다', async () => {
      const roomId = await createRoom({ startDate: '2020-01-10T09:00:00+09:00' });
      await applyVisit(roomId, '2020-01-10T10:00:00+09:00', '2020-01-10T12:00:00+09:00', 'A', 3);
      const canceled = await applyVisit(
        roomId,
        '2030-01-10T10:00:00+09:00',
        '2030-01-10T12:00:00+09:00',
        'B',
        2,
      );
      await prisma.visit.update({ where: { id: canceled.id }, data: { status: 'CANCELED' } });

      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 1 }).expect(200);
    });

    it('줄였다가 다시 늘리면 같은 좌석을 다시 쓴다 (좌석 행은 지우지 않는다)', async () => {
      const roomId = await createRoom(); // 3석
      const seat3 = await prisma.seat.findUniqueOrThrow({
        where: { studyRoomId_number: { studyRoomId: roomId, number: 3 } },
      });

      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 1 }).expect(200);
      await api().patch(`/api/study-rooms/${roomId}`).send({ maxPersonnel: 4 }).expect(200);

      const seats = await prisma.seat.findMany({
        where: { studyRoomId: roomId },
        orderBy: { number: 'asc' },
      });
      expect(seats.map((s) => s.number)).toEqual([1, 2, 3, 4]);
      expect(seats[2]!.id).toBe(seat3.id);
    });

    it('운영 기간 밖으로 밀려나는 신청이 있으면 PERIOD_EXCLUDES_VISITS', async () => {
      const roomId = await createRoom();
      await applyVisit(roomId, '2030-01-10T19:00:00+09:00', '2030-01-10T21:00:00+09:00');

      const res = await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ endDate: '2030-01-10T20:00:00+09:00' })
        .expect(409);
      expect(res.body.error.code).toBe('PERIOD_EXCLUDES_VISITS');

      // 신청 구간을 포함하는 기간으로는 변경할 수 있다
      await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ endDate: '2030-01-10T21:00:00+09:00' })
        .expect(200);
    });

    it('취소된 신청은 기간 변경을 막지 않는다', async () => {
      const roomId = await createRoom();
      const visit = await applyVisit(
        roomId,
        '2030-01-10T19:00:00+09:00',
        '2030-01-10T21:00:00+09:00',
      );
      await prisma.visit.update({ where: { id: visit.id }, data: { status: 'CANCELED' } });

      await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ endDate: '2030-01-10T12:00:00+09:00' })
        .expect(200);
    });

    it('수정 결과 시작 ≥ 종료가 되면 INVALID_PERIOD', async () => {
      const roomId = await createRoom();
      const res = await api()
        .patch(`/api/study-rooms/${roomId}`)
        .send({ startDate: '2030-01-11T00:00:00+09:00' })
        .expect(400);
      expect(res.body.error.code).toBe('INVALID_PERIOD');
    });
  });

  describe('DELETE /api/study-rooms/:id', () => {
    it('Soft Delete하고 유효 신청을 SYSTEM 사유로 자동 취소한다', async () => {
      const roomId = await createRoom();
      const visit = await applyVisit(
        roomId,
        '2030-01-10T10:00:00+09:00',
        '2030-01-10T12:00:00+09:00',
      );

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
        '2030-01-10T10:00:00+09:00',
        '2030-01-10T12:00:00+09:00',
        '김하이',
      );
      await prisma.visitHistory.create({
        data: {
          visitId: visit.id,
          studentId: visit.studentId,
          studyRoomId: roomId,
          action: 'UPDATE',
          prevStartAt: '2030-01-10T10:00:00+09:00',
          prevEndAt: '2030-01-10T12:00:00+09:00',
          startAt: '2030-01-10T11:00:00+09:00',
          endAt: '2030-01-10T13:00:00+09:00',
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
        prevStartAt: '2030-01-10T10:00:00.000+09:00',
        startAt: '2030-01-10T11:00:00.000+09:00',
      });
    });
  });

  describe('GET /api/study-rooms/:id/visits', () => {
    async function createStudent(name: string, phone: string): Promise<number> {
      const res = await api().post('/api/students').send({ name, phone }).expect(201);
      return res.body.data.id as number;
    }

    async function apply(studentId: number, roomId: number, startAt: string, endAt: string) {
      const res = await api()
        .post(`/api/students/${studentId}/visits`)
        .send({ studyRoomId: roomId, startAt, endAt })
        .expect(201);
      return res.body.data.id as number;
    }

    it('유효 신청만 방문 시작 순으로, 학생 연락처와 함께 준다', async () => {
      const roomId = await createRoom({ maxPersonnel: 5 });
      // 동명이인
      const a = await createStudent('김하늘', '010-1111-1111');
      const b = await createStudent('김하늘', '01056567878');
      const c = await createStudent('이도윤', '010-3333-3333');
      await apply(a, roomId, '2030-01-10T13:00:00+09:00', '2030-01-10T15:00:00+09:00');
      await apply(b, roomId, '2030-01-10T10:00:00+09:00', '2030-01-10T12:00:00+09:00');
      const canceled = await apply(
        c,
        roomId,
        '2030-01-10T11:00:00+09:00',
        '2030-01-10T12:00:00+09:00',
      );
      await api().post(`/api/students/${c}/visits/${canceled}/cancel`).expect(200);

      const res = await api().get(`/api/study-rooms/${roomId}/visits`).expect(200);
      expect(res.body.data).toEqual([
        expect.objectContaining({
          student: { id: b, name: '김하늘', phone: '010-5656-7878' },
          startAt: '2030-01-10T10:00:00.000+09:00',
          endAt: '2030-01-10T12:00:00.000+09:00',
        }),
        expect.objectContaining({
          student: { id: a, name: '김하늘', phone: '010-1111-1111' },
          startAt: '2030-01-10T13:00:00.000+09:00',
        }),
      ]);
    });

    it('취소 후 재신청하면 다시 나오고, 신청 시각은 재신청 시각이다', async () => {
      const roomId = await createRoom();
      const s = await createStudent('김하늘', '010-1111-1111');
      const visitId = await apply(
        s,
        roomId,
        '2030-01-10T10:00:00+09:00',
        '2030-01-10T12:00:00+09:00',
      );
      const first = await prisma.visitHistory.findFirstOrThrow({ where: { visitId } });
      await api().post(`/api/students/${s}/visits/${visitId}/cancel`).expect(200);
      await apply(s, roomId, '2030-01-10T14:00:00+09:00', '2030-01-10T15:00:00+09:00');

      const res = await api().get(`/api/study-rooms/${roomId}/visits`).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        id: visitId,
        startAt: '2030-01-10T14:00:00.000+09:00',
      });
      expect(new Date(res.body.data[0].appliedAt).getTime()).toBeGreaterThan(
        first.createdAt.getTime(),
      );
    });

    it('삭제된 학생의 신청은 자동 취소되어 빠진다', async () => {
      const roomId = await createRoom();
      const s = await createStudent('김하늘', '010-1111-1111');
      await apply(s, roomId, '2030-01-10T10:00:00+09:00', '2030-01-10T12:00:00+09:00');
      await api().delete(`/api/students/${s}`).expect(204);

      const res = await api().get(`/api/study-rooms/${roomId}/visits`).expect(200);
      expect(res.body.data).toEqual([]);
    });

    it('없거나 삭제된 자습실은 STUDY_ROOM_NOT_FOUND', async () => {
      const roomId = await createRoom();
      await api().delete(`/api/study-rooms/${roomId}`).expect(204);
      const res = await api().get(`/api/study-rooms/${roomId}/visits`).expect(404);
      expect(res.body.error.code).toBe('STUDY_ROOM_NOT_FOUND');
      await api().get('/api/study-rooms/99999/visits').expect(404);
    });
  });
});
