import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

export async function createTestApp(): Promise<{
  app: INestApplication<App>;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(moduleRef.createNestApplication<INestApplication<App>>());
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** 테스트 간 격리를 위해 모든 도메인 테이블을 비운다 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE visit_histories, visits, seats, study_rooms, students RESTART IDENTITY CASCADE',
  );
}

/** 자습실을 DB에 직접 만들 때 좌석 1~maxPersonnel번도 함께 만든다 (API로 등록할 때와 같게, #45) */
export async function createRoomWithSeats(
  prisma: PrismaService,
  data: Prisma.StudyRoomCreateInput,
): Promise<number> {
  const room = await prisma.studyRoom.create({
    data: {
      ...data,
      seats: {
        create: Array.from({ length: data.maxPersonnel }, (_, i) => ({ number: i + 1 })),
      },
    },
  });
  return room.id;
}
