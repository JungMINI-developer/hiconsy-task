import { PartialType } from '@nestjs/swagger';
import type { UpdateStudyRoomRequest } from '@hiconsy/shared';
import { CreateStudyRoomDto } from './create-study-room.dto.js';

/** 보낸 필드만 수정한다 */
export class UpdateStudyRoomDto
  extends PartialType(CreateStudyRoomDto)
  implements UpdateStudyRoomRequest {}
