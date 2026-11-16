import type { CreateWaitlistRequest } from '@hiconsy/shared';
import { CreateVisitDto } from '../../visits/dto/create-visit.dto.js';

/** 대기 등록: 자습실과 원하는 방문 구간 (방문 신청과 같은 모양) */
export class CreateWaitlistDto extends CreateVisitDto implements CreateWaitlistRequest {}
