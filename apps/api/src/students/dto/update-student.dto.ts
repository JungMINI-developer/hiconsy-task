import { PartialType } from '@nestjs/swagger';
import type { UpdateStudentRequest } from '@hiconsy/shared';
import { CreateStudentDto } from './create-student.dto.js';

/** 보낸 필드만 수정한다 */
export class UpdateStudentDto
  extends PartialType(CreateStudentDto)
  implements UpdateStudentRequest {}
