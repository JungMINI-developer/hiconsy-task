import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { StudyRoomWaitlistEntry, WaitlistEntry } from '@hiconsy/shared';
import { CreateWaitlistDto } from './dto/create-waitlist.dto.js';
import { WaitlistService } from './waitlist.service.js';

/**
 * 대기열 (#36). 학생 경로는 방문 신청과 같이 경로의 studentId를 "본인"으로 본다.
 * 제안 확정은 방문 신청(POST /students/:studentId/visits)으로 한다.
 */
@ApiTags('waitlist')
@Controller()
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Get('students/:studentId/waitlist')
  @ApiOperation({ summary: '내 대기 목록 (진행 중 + 종료, 최근 등록 순)' })
  @ApiResponse({ status: 404, description: 'STUDENT_NOT_FOUND' })
  findMine(@Param('studentId', ParseIntPipe) studentId: number): Promise<WaitlistEntry[]> {
    return this.waitlistService.findAllByStudent(studentId);
  }

  @Post('students/:studentId/waitlist')
  @ApiOperation({ summary: '대기 등록 (정원이 찬 자습실, 원하는 방문 구간)' })
  @ApiResponse({ status: 400, description: 'INVALID_PERIOD / VISIT_IN_PAST / VISIT_OUT_OF_PERIOD' })
  @ApiResponse({ status: 404, description: 'STUDENT_NOT_FOUND / STUDY_ROOM_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description: 'ALREADY_APPLIED / ALREADY_WAITING / ROOM_HAS_SEATS: 자리가 남아 바로 신청 가능',
  })
  register(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() dto: CreateWaitlistDto,
  ): Promise<WaitlistEntry> {
    return this.waitlistService.register(studentId, dto);
  }

  @Post('students/:studentId/waitlist/:entryId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '대기 취소 / 자리 제안 거절 (제안 중이던 자리는 다음 순번에게)' })
  @ApiResponse({ status: 404, description: 'STUDENT_NOT_FOUND / WAITLIST_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'WAITLIST_ALREADY_ENDED' })
  cancel(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('entryId', ParseIntPipe) entryId: number,
  ): Promise<WaitlistEntry> {
    return this.waitlistService.cancel(studentId, entryId);
  }

  @Get('study-rooms/:id/waitlist')
  @ApiOperation({ summary: '자습실의 진행 중 대기 (제안 중 → 대기 순번 순, 학생 연락처 포함)' })
  @ApiResponse({ status: 404, description: 'STUDY_ROOM_NOT_FOUND' })
  findByRoom(@Param('id', ParseIntPipe) id: number): Promise<StudyRoomWaitlistEntry[]> {
    return this.waitlistService.findByRoom(id);
  }
}
