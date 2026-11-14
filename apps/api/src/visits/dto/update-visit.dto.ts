import { ApiProperty } from '@nestjs/swagger';
import type { UpdateVisitRequest } from '@hiconsy/shared';
import { IsISO8601 } from 'class-validator';

export class UpdateVisitDto implements UpdateVisitRequest {
  @ApiProperty({ description: '방문 시작 일시 (ISO 8601)', example: '2026-11-20T19:00:00+09:00' })
  @IsISO8601({ strict: true })
  startAt: string;

  @ApiProperty({ description: '방문 종료 일시 (ISO 8601)', example: '2026-11-20T21:00:00+09:00' })
  @IsISO8601({ strict: true })
  endAt: string;
}
