import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ApiResponse, HealthStatus } from '@hiconsy/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<ApiResponse<HealthStatus>> {
    let database: HealthStatus['database'] = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    return {
      success: true,
      data: { status: 'ok', database, timestamp: new Date().toISOString() },
    };
  }
}
