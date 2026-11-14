import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, type Visit } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import type { Prisma, StudyRoom, Visit as VisitRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lockStudent, studentNotFound } from '../students/student-lock.js';
import { lockStudyRoom } from '../study-rooms/study-room-lock.js';
import type { CreateVisitDto } from './dto/create-visit.dto.js';
import type { UpdateVisitDto } from './dto/update-visit.dto.js';
import { toVisit } from './visit.mapper.js';

/**
 * 학생의 방문 신청·수정·취소.
 *
 * 모든 변경은 하나의 트랜잭션에서 다음 순서로 처리한다.
 * 1. 학생 행 FOR SHARE: 동시에 진행되는 학생 삭제와 직렬화
 * 2. 자습실 행 FOR UPDATE: 같은 자습실의 신청·수정·취소, 자습실 수정·삭제와 직렬화 (정원 보장)
 * 3. 규칙 검사 → visits 변경 → visit_histories 기록
 */
@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-VST-04: 본인 신청 목록 (방문 시작 순, 취소 포함) */
  async findAllByStudent(studentId: number): Promise<Visit[]> {
    const exists = await this.prisma.student.count({ where: { id: studentId, deletedAt: null } });
    if (exists === 0) throw studentNotFound();
    const visits = await this.prisma.visit.findMany({
      where: { studentId },
      include: { studyRoom: true },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    });
    return visits.map(toVisit);
  }

  /** FR-VST-01: 신청 또는 취소한 신청의 재신청 */
  async apply(studentId: number, dto: CreateVisitDto): Promise<Visit> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    return this.prisma.$transaction(async (tx) => {
      await lockStudent(tx, studentId, 'share');
      await lockStudyRoom(tx, dto.studyRoomId);
      const room = await tx.studyRoom.findUniqueOrThrow({ where: { id: dto.studyRoomId } });

      assertValidVisitTime(startAt, endAt, room);

      const existing = await tx.visit.findUnique({
        where: { studentId_studyRoomId: { studentId, studyRoomId: room.id } },
      });
      if (existing?.status === 'APPLIED') {
        throw new DomainException(
          ErrorCode.ALREADY_APPLIED,
          '이미 신청한 자습실입니다. 방문 시간을 수정하거나 취소한 뒤 다시 신청해 주세요.',
          HttpStatus.CONFLICT,
        );
      }

      const appliedCount = await tx.visit.count({
        where: { studyRoomId: room.id, status: 'APPLIED' },
      });
      if (appliedCount >= room.maxPersonnel) {
        throw new DomainException(
          ErrorCode.CAPACITY_FULL,
          `정원(${room.maxPersonnel}명)이 가득 찼습니다.`,
          HttpStatus.CONFLICT,
        );
      }

      // 재신청은 기존 행을 APPLIED로 되돌린다 (UNIQUE(student_id, study_room_id) 유지)
      const visit = existing
        ? await tx.visit.update({
            where: { id: existing.id },
            data: { status: 'APPLIED', startAt, endAt, canceledAt: null },
            include: { studyRoom: true },
          })
        : await tx.visit.create({
            data: { studentId, studyRoomId: room.id, startAt, endAt },
            include: { studyRoom: true },
          });

      await tx.visitHistory.create({
        data: {
          visitId: visit.id,
          studentId,
          studyRoomId: room.id,
          action: 'APPLY',
          startAt,
          endAt,
          actorType: 'STUDENT',
        },
      });
      return toVisit(visit);
    });
  }

  /** FR-VST-02: 방문 시간 수정 */
  async updateTime(studentId: number, visitId: number, dto: UpdateVisitDto): Promise<Visit> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    return this.prisma.$transaction(async (tx) => {
      const { visit, room } = await this.lockOwnVisit(tx, studentId, visitId);
      assertChangeable(visit);
      assertValidVisitTime(startAt, endAt, room);

      const unchanged =
        visit.startAt.getTime() === startAt.getTime() && visit.endAt.getTime() === endAt.getTime();
      if (unchanged) return toVisit({ ...visit, studyRoom: room });

      const updated = await tx.visit.update({
        where: { id: visit.id },
        data: { startAt, endAt },
        include: { studyRoom: true },
      });
      await tx.visitHistory.create({
        data: {
          visitId: visit.id,
          studentId,
          studyRoomId: room.id,
          action: 'UPDATE',
          prevStartAt: visit.startAt,
          prevEndAt: visit.endAt,
          startAt,
          endAt,
          actorType: 'STUDENT',
        },
      });
      return toVisit(updated);
    });
  }

  /** FR-VST-03: 취소 (정원 복원) */
  async cancel(studentId: number, visitId: number): Promise<Visit> {
    return this.prisma.$transaction(async (tx) => {
      const { visit, room } = await this.lockOwnVisit(tx, studentId, visitId);
      assertChangeable(visit);

      const canceled = await tx.visit.update({
        where: { id: visit.id },
        data: { status: 'CANCELED', canceledAt: new Date() },
        include: { studyRoom: true },
      });
      await tx.visitHistory.create({
        data: {
          visitId: visit.id,
          studentId,
          studyRoomId: room.id,
          action: 'CANCEL',
          prevStartAt: visit.startAt,
          prevEndAt: visit.endAt,
          startAt: visit.startAt,
          endAt: visit.endAt,
          actorType: 'STUDENT',
        },
      });
      return toVisit(canceled);
    });
  }

  /**
   * 본인 신청인지 확인하고 학생·자습실 락을 잡은 뒤, 락 이후 시점의 최신 값을 다시 읽는다.
   * 다른 학생의 신청은 존재 여부를 노출하지 않도록 404로 응답한다.
   */
  private async lockOwnVisit(
    tx: Prisma.TransactionClient,
    studentId: number,
    visitId: number,
  ): Promise<{ visit: VisitRow; room: StudyRoom }> {
    await lockStudent(tx, studentId, 'share');
    const target = await tx.visit.findFirst({ where: { id: visitId, studentId } });
    if (!target) throw visitNotFound();

    await lockStudyRoom(tx, target.studyRoomId);
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
    const room = await tx.studyRoom.findUniqueOrThrow({ where: { id: visit.studyRoomId } });
    return { visit, room };
  }
}

/** 유효 신청이고, 아직 시작하지 않은 방문만 수정·취소할 수 있다 */
function assertChangeable(visit: VisitRow): void {
  if (visit.status === 'CANCELED') {
    throw new DomainException(
      ErrorCode.VISIT_ALREADY_CANCELED,
      '이미 취소된 신청입니다.',
      HttpStatus.CONFLICT,
    );
  }
  if (visit.startAt.getTime() <= Date.now()) {
    throw new DomainException(
      ErrorCode.VISIT_ALREADY_STARTED,
      '이미 시작된 방문은 수정하거나 취소할 수 없습니다.',
      HttpStatus.CONFLICT,
    );
  }
}

/** 시작 < 종료, 미래 시각, 자습실 운영 기간 안 */
function assertValidVisitTime(startAt: Date, endAt: Date, room: StudyRoom): void {
  if (startAt.getTime() >= endAt.getTime()) {
    throw new DomainException(
      ErrorCode.INVALID_PERIOD,
      '방문 시작 일시는 종료 일시보다 이전이어야 합니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (startAt.getTime() <= Date.now()) {
    throw new DomainException(
      ErrorCode.VISIT_IN_PAST,
      '지난 시간으로는 신청할 수 없습니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (startAt < room.startDate || endAt > room.endDate) {
    throw new DomainException(
      ErrorCode.VISIT_OUT_OF_PERIOD,
      '방문 시간은 자습실 운영 기간 안이어야 합니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

function visitNotFound(): DomainException {
  return new DomainException(
    ErrorCode.VISIT_NOT_FOUND,
    '방문 신청을 찾을 수 없습니다.',
    HttpStatus.NOT_FOUND,
  );
}
