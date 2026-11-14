import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('DB 연결이 정상이면 database: up을 반환한다', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: { $queryRaw: vi.fn<() => Promise<number[]>>().mockResolvedValue([1]) },
        },
      ],
    }).compile();

    const result = await moduleRef.get(HealthController).check();
    expect(result.database).toBe('up');
  });
});
