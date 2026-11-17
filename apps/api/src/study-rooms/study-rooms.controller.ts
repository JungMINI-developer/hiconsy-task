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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  RoomFreeSeats,
  SeatAvailability,
  SeatOccupancy,
  StudyRoom,
  StudyRoomHistory,
  StudyRoomVisit,
} from '@hiconsy/shared';
import {
  SeatAvailabilityQueryDto,
  SeatMapQueryDto,
  SeatRangeQueryDto,
} from '../seats/dto/seat-query.dto.js';
import { SeatsService } from '../seats/seats.service.js';
import { CreateStudyRoomDto } from './dto/create-study-room.dto.js';
import { UpdateStudyRoomDto } from './dto/update-study-room.dto.js';
import { StudyRoomsService } from './study-rooms.service.js';

@ApiTags('study-rooms')
@Controller('study-rooms')
export class StudyRoomsController {
  constructor(
    private readonly studyRoomsService: StudyRoomsService,
    private readonly seatsService: SeatsService,
  ) {}

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

  // ':id'보다 먼저 선언해야 'free-seats'가 id로 잡히지 않는다
  @Get('free-seats')
  @ApiOperation({
    summary:
      '자습실별로 고른 시간 내내 비어 있는 좌석 수 (운영 기간이 그 시간을 포함하는 자습실만)',
  })
  @ApiResponse({ status: 400, description: 'INVALID_PERIOD / 입력값 검증 실패' })
  freeSeats(@Query() query: SeatRangeQueryDto): Promise<RoomFreeSeats[]> {
    return this.seatsService.freeSeats(query);
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

  @Get(':id/seats')
  @ApiOperation({ summary: '좌석별로 고른 시간 내내 비어 있는지 (학생 좌석 선택)' })
  @ApiResponse({ status: 400, description: 'INVALID_PERIOD / 입력값 검증 실패' })
  @ApiResponse({ status: 404, description: 'STUDY_ROOM_NOT_FOUND' })
  findSeats(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: SeatAvailabilityQueryDto,
  ): Promise<SeatAvailability[]> {
    return this.seatsService.availability(id, query);
  }

  @Get(':id/seat-map')
  @ApiOperation({ summary: '그 시각의 좌석 배치도 — 좌석마다 앉아 있기로 한 학생 (강사)' })
  @ApiResponse({ status: 404, description: 'STUDY_ROOM_NOT_FOUND' })
  seatMap(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: SeatMapQueryDto,
  ): Promise<SeatOccupancy[]> {
    return this.seatsService.seatMap(id, query);
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
