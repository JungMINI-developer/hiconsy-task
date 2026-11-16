import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Visit } from '@hiconsy/shared';
import { CreateVisitDto } from './dto/create-visit.dto.js';
import { UpdateVisitDto } from './dto/update-visit.dto.js';
import { VisitsService } from './visits.service.js';

/**
 * 로그인을 생략하므로 경로의 studentId를 "본인"으로 본다.
 * 다른 학생의 신청에 접근하면 404를 준다.
 */
@ApiTags('visits')
@Controller('students/:studentId/visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  @ApiOperation({ summary: '내 방문 신청 목록 (취소 포함, 방문 시작 순)' })
  @ApiResponse({ status: 404, description: 'STUDENT_NOT_FOUND' })
  findAll(@Param('studentId', ParseIntPipe) studentId: number): Promise<Visit[]> {
    return this.visitsService.findAllByStudent(studentId);
  }

  @Post()
  @ApiOperation({
    summary: '방문 신청 (취소한 자습실은 재신청). seatId가 없으면 빈 좌석 자동 배정',
  })
  @ApiResponse({
    status: 400,
    description: 'INVALID_PERIOD / VISIT_IN_PAST / VISIT_OUT_OF_PERIOD / 입력값 검증 실패',
  })
  @ApiResponse({
    status: 404,
    description: 'STUDENT_NOT_FOUND / STUDY_ROOM_NOT_FOUND / SEAT_NOT_FOUND',
  })
  @ApiResponse({
    status: 409,
    description:
      'ALREADY_APPLIED / VISIT_TIME_OVERLAP / SEAT_TAKEN: 고른 좌석이 그 시간에 예약됨 / CAPACITY_FULL: 그 시간 내내 빈 좌석 없음 (자동 배정)',
  })
  apply(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() dto: CreateVisitDto,
  ): Promise<Visit> {
    return this.visitsService.apply(studentId, dto);
  }

  @Patch(':visitId')
  @ApiOperation({ summary: '방문 시간 수정 (좌석도 함께 바꿀 수 있음)' })
  @ApiResponse({ status: 400, description: 'INVALID_PERIOD / VISIT_IN_PAST / VISIT_OUT_OF_PERIOD' })
  @ApiResponse({ status: 404, description: 'STUDENT_NOT_FOUND / VISIT_NOT_FOUND / SEAT_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description:
      'VISIT_TIME_OVERLAP / SEAT_TAKEN / CAPACITY_FULL / VISIT_ALREADY_CANCELED / VISIT_ALREADY_STARTED',
  })
  updateTime(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: UpdateVisitDto,
  ): Promise<Visit> {
    return this.visitsService.updateTime(studentId, visitId, dto);
  }

  @Post(':visitId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '방문 취소 (정원 복원)' })
  @ApiResponse({ status: 404, description: 'STUDENT_NOT_FOUND / VISIT_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'VISIT_ALREADY_CANCELED / VISIT_ALREADY_STARTED' })
  cancel(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('visitId', ParseIntPipe) visitId: number,
  ): Promise<Visit> {
    return this.visitsService.cancel(studentId, visitId);
  }
}
