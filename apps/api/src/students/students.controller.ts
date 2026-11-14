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
import type { Student } from '@hiconsy/shared';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentsService } from './students.service.js';

@ApiTags('students')
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @ApiOperation({ summary: '학생 목록 (삭제 제외, 이름순)' })
  findAll(): Promise<Student[]> {
    return this.studentsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: '학생 등록' })
  @ApiResponse({ status: 400, description: '입력값 검증 실패 (휴대폰 번호 형식 등)' })
  @ApiResponse({ status: 409, description: 'DUPLICATE_PHONE: 이미 등록된 전화번호' })
  create(@Body() dto: CreateStudentDto): Promise<Student> {
    return this.studentsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '학생 상세' })
  @ApiResponse({ status: 404, description: 'STUDENT_NOT_FOUND' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Student> {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '학생 수정 (보낸 필드만)' })
  @ApiResponse({ status: 404, description: 'STUDENT_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'DUPLICATE_PHONE' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto): Promise<Student> {
    return this.studentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '학생 삭제 (Soft Delete, 유효 신청 자동 취소)' })
  @ApiResponse({ status: 404, description: 'STUDENT_NOT_FOUND' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.studentsService.remove(id);
  }
}
