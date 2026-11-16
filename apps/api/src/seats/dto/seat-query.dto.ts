import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsPositive } from 'class-validator';

/** 방문 구간 (빈 좌석 조회) */
export class SeatRangeQueryDto {
  @ApiProperty({ description: '방문 시작 일시 (ISO 8601)', example: '2026-11-20T19:00:00+09:00' })
  @IsISO8601({ strict: true })
  startAt: string;

  @ApiProperty({ description: '방문 종료 일시 (ISO 8601)', example: '2026-11-20T21:00:00+09:00' })
  @IsISO8601({ strict: true })
  endAt: string;
}

/** 자습실 좌석별 예약 가능 여부 조회 */
export class SeatAvailabilityQueryDto extends SeatRangeQueryDto {
  @ApiPropertyOptional({
    description: '시간을 바꾸는 내 신청 id — 그 신청이 차지한 자리는 빈 것으로 본다',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  exceptVisitId?: number;
}

/** 강사용 좌석 배치도 조회 */
export class SeatMapQueryDto {
  @ApiProperty({ description: '볼 시각 (ISO 8601)', example: '2026-11-20T19:30:00+09:00' })
  @IsISO8601({ strict: true })
  at: string;
}
