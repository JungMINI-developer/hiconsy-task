import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase } from './helpers.js';

describe('Students (e2e)', () => {
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

  async function createStudent(name = '김하이', phone = '010-1111-1111'): Promise<number> {
    const res = await api().post('/api/students').send({ name, phone }).expect(201);
    return res.body.data.id as number;
  }

  describe('POST /api/students', () => {
    it('학생을 등록하고 전화번호를 010-1234-5678 형태로 정규화한다', async () => {
      const res = await api()
        .post('/api/students')
        .send({ name: '  김하이 ', phone: '01012345678' })
        .expect(201);
      expect(res.body.data).toMatchObject({ name: '김하이', phone: '010-1234-5678' });
      expect(res.body.data.createdAt).toMatch(/\+09:00$/);
    });

    it('휴대폰 번호 형식이 아니면 400', async () => {
      const res = await api()
        .post('/api/students')
        .send({ name: '김하이', phone: '02-123-4567' })
        .expect(400);
      expect(res.body.error.details).toEqual(['phone은 휴대폰 번호 형식이어야 합니다.']);
    });

    it('삭제되지 않은 학생과 전화번호가 겹치면 DUPLICATE_PHONE (표기가 달라도)', async () => {
      await createStudent('김하이', '010-1111-1111');
      const res = await api()
        .post('/api/students')
        .send({ name: '이컨시', phone: '01011111111' })
        .expect(409);
      expect(res.body.error.code).toBe('DUPLICATE_PHONE');
    });

    it('삭제된 학생의 전화번호로는 다시 등록할 수 있다', async () => {
      const id = await createStudent('김하이', '010-1111-1111');
      await api().delete(`/api/students/${id}`).expect(204);
      await api()
        .post('/api/students')
        .send({ name: '김하이', phone: '010-1111-1111' })
        .expect(201);
    });
  });

  describe('GET /api/students', () => {
    it('삭제된 학생을 제외하고 이름순으로 준다', async () => {
      await createStudent('최공부', '010-1111-1111');
      await createStudent('김하이', '010-2222-2222');
      const deletedId = await createStudent('박자습', '010-3333-3333');
      await api().delete(`/api/students/${deletedId}`).expect(204);

      const res = await api().get('/api/students').expect(200);
      expect(res.body.data.map((s: { name: string }) => s.name)).toEqual(['김하이', '최공부']);
    });
  });

  describe('GET /api/students/:id', () => {
    it('없는 학생은 STUDENT_NOT_FOUND', async () => {
      const res = await api().get('/api/students/9999').expect(404);
      expect(res.body.error.code).toBe('STUDENT_NOT_FOUND');
    });
  });

  describe('PATCH /api/students/:id', () => {
    it('보낸 필드만 수정한다', async () => {
      const id = await createStudent('김하이', '010-1111-1111');
      const res = await api()
        .patch(`/api/students/${id}`)
        .send({ phone: '010 9999 9999' })
        .expect(200);
      expect(res.body.data).toMatchObject({ name: '김하이', phone: '010-9999-9999' });
    });

    it('본인 번호 그대로는 수정할 수 있고, 다른 학생 번호로는 바꿀 수 없다', async () => {
      const id = await createStudent('김하이', '010-1111-1111');
      await createStudent('이컨시', '010-2222-2222');

      await api().patch(`/api/students/${id}`).send({ phone: '010-1111-1111' }).expect(200);
      const res = await api()
        .patch(`/api/students/${id}`)
        .send({ phone: '010-2222-2222' })
        .expect(409);
      expect(res.body.error.code).toBe('DUPLICATE_PHONE');
    });

    it('삭제된 학생은 수정할 수 없다', async () => {
      const id = await createStudent();
      await api().delete(`/api/students/${id}`).expect(204);
      await api().patch(`/api/students/${id}`).send({ name: '새이름' }).expect(404);
    });
  });

  describe('DELETE /api/students/:id', () => {
    it('Soft Delete하고 유효 신청을 SYSTEM "학생 삭제" 사유로 자동 취소한다', async () => {
      const studentId = await createStudent();
      const room = await prisma.studyRoom.create({
        data: {
          name: 'A 자습실',
          maxPersonnel: 3,
          startDate: '2030-01-10T09:00:00+09:00',
          endDate: '2030-01-10T22:00:00+09:00',
        },
      });
      const visit = await prisma.visit.create({
        data: {
          studentId,
          studyRoomId: room.id,
          startAt: '2030-01-10T10:00:00+09:00',
          endAt: '2030-01-10T12:00:00+09:00',
        },
      });

      await api().delete(`/api/students/${studentId}`).expect(204);

      const deleted = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
      expect(deleted.deletedAt).not.toBeNull();
      const canceled = await prisma.visit.findUniqueOrThrow({ where: { id: visit.id } });
      expect(canceled.status).toBe('CANCELED');

      // 취소된 만큼 자습실 현재 인원이 복원된다
      const roomRes = await api().get(`/api/study-rooms/${room.id}`).expect(200);
      expect(roomRes.body.data.currentPersonnel).toBe(0);

      const histories = await api().get(`/api/study-rooms/${room.id}/histories`).expect(200);
      expect(histories.body.data).toEqual([
        expect.objectContaining({ action: 'CANCEL', actorType: 'SYSTEM', reason: '학생 삭제' }),
      ]);
    });

    it('지난 방문은 그대로 두고, 끝나지 않은 방문만 자동 취소한다 (#57)', async () => {
      const studentId = await createStudent();
      const hour = 60 * 60 * 1000;
      const at = (h: number) => new Date(Date.now() + h * hour);
      const room = await prisma.studyRoom.create({
        data: { name: 'A 자습실', maxPersonnel: 3, startDate: at(-48), endDate: at(48) },
      });
      const past = await prisma.visit.create({
        data: { studentId, studyRoomId: room.id, startAt: at(-30), endAt: at(-28) },
      });
      const otherRoom = await prisma.studyRoom.create({
        data: { name: 'B 자습실', maxPersonnel: 3, startDate: at(-48), endDate: at(48) },
      });
      const upcoming = await prisma.visit.create({
        data: { studentId, studyRoomId: otherRoom.id, startAt: at(2), endAt: at(4) },
      });

      await api().delete(`/api/students/${studentId}`).expect(204);

      expect((await prisma.visit.findUniqueOrThrow({ where: { id: past.id } })).status).toBe(
        'APPLIED',
      );
      expect((await prisma.visit.findUniqueOrThrow({ where: { id: upcoming.id } })).status).toBe(
        'CANCELED',
      );
      expect(await prisma.visitHistory.count({ where: { visitId: past.id } })).toBe(0);
    });

    it('이미 삭제된 학생은 STUDENT_NOT_FOUND', async () => {
      const id = await createStudent();
      await api().delete(`/api/students/${id}`).expect(204);
      const res = await api().delete(`/api/students/${id}`).expect(404);
      expect(res.body.error.code).toBe('STUDENT_NOT_FOUND');
    });
  });
});
