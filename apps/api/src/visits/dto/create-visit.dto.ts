import { ApiProperty } from '@nestjs/swagger';
import type { CreateVisitRequest } from '@hiconsy/shared';
import { IsInt, IsPositive } from 'class-validator';
import { UpdateVisitDto } from './update-visit.dto.js';

export class CreateVisitDto extends UpdateVisitDto implements CreateVisitRequest {
  @ApiProperty({ description: '신청할 자습실 id', example: 1 })
  @IsInt()
  @IsPositive()
  studyRoomId: number;
}
