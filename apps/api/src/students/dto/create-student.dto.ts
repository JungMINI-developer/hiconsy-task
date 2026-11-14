import { ApiProperty } from '@nestjs/swagger';
import type { CreateStudentRequest } from '@hiconsy/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { NORMALIZED_PHONE_PATTERN, normalizePhone } from '../phone.js';

export class CreateStudentDto implements CreateStudentRequest {
  @ApiProperty({ description: '이름', example: '김하이', maxLength: 50 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: '휴대폰 번호. 하이픈 유무와 관계없이 받아 010-1234-5678 형태로 저장',
    example: '010-1234-5678',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value.trim()) : value,
  )
  @IsString()
  @Matches(NORMALIZED_PHONE_PATTERN, { message: 'phone은 휴대폰 번호 형식이어야 합니다.' })
  phone: string;
}
