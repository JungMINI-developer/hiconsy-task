import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { StudyRoom, StudyRoomHistory, StudyRoomVisit } from '@hiconsy/shared';
import { CreateStudyRoomDto } from './dto/create-study-room.dto.js';
import { UpdateStudyRoomDto } from './dto/update-study-room.dto.js';
import { StudyRoomsService } from './study-rooms.service.js';

@ApiTags('study-rooms')
@Controller('study-rooms')
export class StudyRoomsController {
  constructor(private readonly studyRoomsService: StudyRoomsService) {}

  @Get()
  @ApiOperation({ summary: '자습실 목록 (삭제 제외, 현재 신청 인원 포함)' })
  findAll(): Promise<StudyRoom[]> {
    return this.studyRoomsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: '자습실 등록' })
  @ApiResponse({ status: 400, description: 'INVALID_PERIOD: 시작 ≥ 종료 / 입력값 검증 실패' })
  create(@Body() dto: CreateStudyRoomDto): Promise<StudyRoom> {
    return this.studyRoomsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '자습실 상세' })
  @ApiResponse({ status: 404, description: 'STUDY_ROOM_NOT_FOUND' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<StudyRoom> {
    return this.studyRoomsService.findOne(id);
  }

  @Get(':id/histories')
  @ApiOperation({ summary: '자습실의 방문 신청·수정·취소 이력 (시간순)' })
  @ApiResponse({ status: 404, description: 'STUDY_ROOM_NOT_FOUND' })
  findHistories(@Param('id', ParseIntPipe) id: number): Promise<StudyRoomHistory[]> {
    return this.studyRoomsService.findHistories(id);
  }

  @Get(':id/visits')
  @ApiOperation({ summary: '자습실의 현재 유효 신청 목록 (학생 연락처 포함, 방문 시작 순)' })
  @ApiResponse({ status: 404, description: 'STUDY_ROOM_NOT_FOUND' })
  findVisits(@Param('id', ParseIntPipe) id: number): Promise<StudyRoomVisit[]> {
    return this.studyRoomsService.findVisits(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '자습실 수정 (보낸 필드만)' })
  @ApiResponse({ status: 404, description: 'STUDY_ROOM_NOT_FOUND' })
  @ApiResponse({
    status: 409,
    description:
      'SEATS_IN_USE: 없어질 좌석에 끝나지 않은 예약 존재 / PERIOD_EXCLUDES_VISITS: 기간 밖 신청 존재',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudyRoomDto,
  ): Promise<StudyRoom> {
    return this.studyRoomsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '자습실 삭제 (Soft Delete, 유효 신청 자동 취소)' })
  @ApiResponse({ status: 404, description: 'STUDY_ROOM_NOT_FOUND' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.studyRoomsService.remove(id);
  }
}
