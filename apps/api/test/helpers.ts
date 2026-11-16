import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
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
    'TRUNCATE TABLE waitlist_entries, visit_histories, visits, study_rooms, students RESTART IDENTITY CASCADE',
  );
}
