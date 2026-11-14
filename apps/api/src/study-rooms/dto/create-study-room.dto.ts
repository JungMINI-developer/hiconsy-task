import { ApiProperty } from '@nestjs/swagger';
import type { CreateStudyRoomRequest } from '@hiconsy/shared';
import { Transform } from 'class-transformer';
import { IsISO8601, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateStudyRoomDto implements CreateStudyRoomRequest {
  @ApiProperty({ description: '자습실 이름', example: 'A 자습실 (중간고사 대비)', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '최대 인원', example: 10, minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  maxPersonnel: number;

  @ApiProperty({ description: '운영 시작 일시 (ISO 8601)', example: '2026-11-20T09:00:00+09:00' })
  @IsISO8601({ strict: true })
  startDate: string;

  @ApiProperty({ description: '운영 종료 일시 (ISO 8601)', example: '2026-11-20T22:00:00+09:00' })
  @IsISO8601({ strict: true })
  endDate: string;
}
