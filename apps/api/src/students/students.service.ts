import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, type Student } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CancelReason, cancelAppliedVisitsBySystem } from '../visits/visit-cancellation.js';
import type { CreateStudentDto } from './dto/create-student.dto.js';
import type { UpdateStudentDto } from './dto/update-student.dto.js';
import { lockStudyRoom } from '../study-rooms/study-room-lock.js';
import { lockStudent, studentNotFound } from './student-lock.js';
import { toStudent } from './student.mapper.js';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-STD-01: 삭제되지 않은 학생 목록 (이름순) */
  async findAll(): Promise<Student[]> {
    const students = await this.prisma.student.findMany({
      where: { deletedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return students.map(toStudent);
  }

  async findOne(id: number): Promise<Student> {
    const student = await this.prisma.student.findFirst({ where: { id, deletedAt: null } });
    if (!student) throw studentNotFound();
    return toStudent(student);
  }

  /** FR-STD-02 */
  async create(dto: CreateStudentDto): Promise<Student> {
    const student = await this.prisma.student
      .create({ data: { name: dto.name, phone: dto.phone } })
      .catch(rethrowDuplicatePhone);
    return toStudent(student);
  }

  /** FR-STD-02: 보낸 필드만 수정 */
  async update(id: number, dto: UpdateStudentDto): Promise<Student> {
    const { count } = await this.prisma.student
      .updateMany({ where: { id, deletedAt: null }, data: { name: dto.name, phone: dto.phone } })
      .catch(rethrowDuplicatePhone);
    if (count === 0) throw studentNotFound();
    return this.findOne(id);
  }

  /**
   * FR-STD-02: Soft Delete.
   * 유효 신청은 자동 취소하고 이력에 SYSTEM 주체와 "학생 삭제" 사유를 남긴다.
   *
   * 락: 학생 행(FOR NO KEY UPDATE) → 신청한 자습실 행(id 순, FOR UPDATE).
   * - 자습실 락 없이 신청 행을 먼저 바꾸면, 같은 신청을 취소하려는 자습실 삭제와
   *   "학생 삭제는 이력 FK 검사로 자습실 락을, 자습실 삭제는 신청 행 락을" 기다리는 교착 상태가 된다.
   * - 학생 행을 FOR UPDATE로 잡으면 자습실 삭제가 이 학생의 이력을 넣을 때 FK 검사(FOR KEY SHARE)와
   *   충돌해 역시 교착 상태가 된다.
   */
  async remove(id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockStudent(tx, id, 'noKeyUpdate');

      const visits = await tx.visit.findMany({
        where: { studentId: id, status: 'APPLIED' },
        select: { studyRoomId: true },
      });
      const roomIds = [...new Set(visits.map((v) => v.studyRoomId))].sort((a, b) => a - b);
      // 이미 삭제된 자습실은 락을 잡을 필요가 없다 (그 신청은 자습실 삭제가 취소했다)
      for (const roomId of roomIds) await lockStudyRoom(tx, roomId).catch(() => undefined);

      const now = new Date();
      await cancelAppliedVisitsBySystem(tx, { studentId: id }, CancelReason.STUDENT_DELETED, now);
      await tx.student.update({ where: { id }, data: { deletedAt: now } });
    });
  }
}

/** 전화번호 부분 유니크 인덱스(students_phone_active_key) 위반을 도메인 에러로 바꾼다 */
function rethrowDuplicatePhone(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new DomainException(
      ErrorCode.DUPLICATE_PHONE,
      '이미 등록된 전화번호입니다.',
      HttpStatus.CONFLICT,
    );
  }
  throw error;
}
