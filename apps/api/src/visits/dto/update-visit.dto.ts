import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UpdateVisitRequest } from '@hiconsy/shared';
import { IsISO8601, IsInt, IsOptional, IsPositive } from 'class-validator';

export class UpdateVisitDto implements UpdateVisitRequest {
  @ApiProperty({ description: '방문 시작 일시 (ISO 8601)', example: '2026-11-20T19:00:00+09:00' })
  @IsISO8601({ strict: true })
  startAt: string;

  @ApiProperty({ description: '방문 종료 일시 (ISO 8601)', example: '2026-11-20T21:00:00+09:00' })
  @IsISO8601({ strict: true })
  endAt: string;

  @ApiPropertyOptional({
    description:
      '앉을 좌석 id. 신청에서 없으면 그 시간 내내 빈 가장 작은 번호 좌석, 시간 수정에서 없으면 지금 좌석',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  seatId?: number;
}
