import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, type Visit } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import type { Prisma, Seat, StudyRoom, Visit as VisitRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lockStudent, studentNotFound, type StudentLockMode } from '../students/student-lock.js';
import { pickSeat } from '../seats/seat-occupancy.js';
import { lockStudyRoom } from '../study-rooms/study-room-lock.js';
import type { CreateVisitDto } from './dto/create-visit.dto.js';
import type { UpdateVisitDto } from './dto/update-visit.dto.js';
import { toVisit, visitInclude } from './visit.mapper.js';
import { assertValidVisitTime } from './visit-time.js';

/**
 * 학생의 방문 신청·수정·취소.
 *
 * 모든 변경은 하나의 트랜잭션에서 다음 순서로 처리한다.
 * 1. 학생 행 락: 학생 삭제와 직렬화. 신청·시간 수정은 FOR NO KEY UPDATE로 같은 학생의
 *    신청끼리도 직렬화한다 (다른 자습실과의 시간 겹침 보장, student-lock.ts 참고)
 * 2. 자습실 행 FOR UPDATE: 같은 자습실의 신청·수정·취소, 자습실 수정·삭제와 직렬화
 *    (같은 좌석의 시간 겹침 검사 → 저장 사이에 끼어들 수 없다, #45)
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
      include: visitInclude,
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    });
    return visits.map(toVisit);
  }

  /**
   * FR-VST-01: 신청 또는 취소한 신청의 재신청.
   * 좌석(#45): `seatId`가 있으면 그 좌석이 구간 내내 비어 있어야 하고(409 SEAT_TAKEN),
   * 없으면 비어 있는 가장 작은 번호 좌석을 고른다(없으면 409 CAPACITY_FULL).
   */
  async apply(studentId: number, dto: CreateVisitDto): Promise<Visit> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    return this.prisma.$transaction(async (tx) => {
      await lockStudent(tx, studentId, 'noKeyUpdate');
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

      await assertNoOverlap(tx, studentId, startAt, endAt);

      const seat = await pickSeat(tx, room, { startAt, endAt }, dto.seatId);

      // 재신청은 기존 행을 APPLIED로 되돌린다 (UNIQUE(student_id, study_room_id) 유지)
      const visit = existing
        ? await tx.visit.update({
            where: { id: existing.id },
            data: { status: 'APPLIED', startAt, endAt, seatId: seat.id, canceledAt: null },
            include: visitInclude,
          })
        : await tx.visit.create({
            data: { studentId, studyRoomId: room.id, startAt, endAt, seatId: seat.id },
            include: visitInclude,
          });

      await tx.visitHistory.create({
        data: {
          visitId: visit.id,
          studentId,
          studyRoomId: room.id,
          action: 'APPLY',
          startAt,
          endAt,
          seatId: seat.id,
          actorType: 'STUDENT',
        },
      });
      return toVisit(visit);
    });
  }

  /**
   * FR-VST-02: 방문 시간 수정. 좌석도 함께 바꿀 수 있다 (#45).
   * `seatId`가 없으면 지금 좌석을 유지하고, 새 시간에 그 좌석이 비어 있어야 한다(자기 신청은 제외).
   */
  async updateTime(studentId: number, visitId: number, dto: UpdateVisitDto): Promise<Visit> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    return this.prisma.$transaction(async (tx) => {
      const { visit, room } = await this.lockOwnVisit(tx, studentId, visitId, 'noKeyUpdate');
      assertChangeable(visit);
      assertValidVisitTime(startAt, endAt, room);

      const seatId = dto.seatId ?? visit.seatId ?? undefined;
      const unchanged =
        visit.startAt.getTime() === startAt.getTime() &&
        visit.endAt.getTime() === endAt.getTime() &&
        seatId === visit.seatId;
      if (unchanged) return toVisit({ ...visit, studyRoom: room });

      await assertNoOverlap(tx, studentId, startAt, endAt, visit.id);
      const seat = await pickSeat(tx, room, { startAt, endAt }, seatId, visit.id);

      const updated = await tx.visit.update({
        where: { id: visit.id },
        data: { startAt, endAt, seatId: seat.id },
        include: visitInclude,
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
          prevSeatId: visit.seatId,
          seatId: seat.id,
          actorType: 'STUDENT',
        },
      });
      return toVisit(updated);
    });
  }

  /** FR-VST-03: 취소. 좌석 기록은 남기고(재신청 때 기본 선택), 그 시간의 좌석은 비워진다 */
  async cancel(studentId: number, visitId: number): Promise<Visit> {
    return this.prisma.$transaction(async (tx) => {
      // 취소는 시간 겹침을 만들 수 없으므로 학생 삭제와만 직렬화한다
      const { visit, room } = await this.lockOwnVisit(tx, studentId, visitId, 'share');
      assertChangeable(visit);

      const canceled = await tx.visit.update({
        where: { id: visit.id },
        data: { status: 'CANCELED', canceledAt: new Date() },
        include: visitInclude,
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
          prevSeatId: visit.seatId,
          seatId: visit.seatId,
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
    studentLock: StudentLockMode,
  ): Promise<{ visit: VisitRow & { seat: Seat | null }; room: StudyRoom }> {
    await lockStudent(tx, studentId, studentLock);
    const target = await tx.visit.findFirst({ where: { id: visitId, studentId } });
    if (!target) throw visitNotFound();

    await lockStudyRoom(tx, target.studyRoomId);
    const visit = await tx.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: { seat: true },
    });
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

/**
 * 같은 학생의 다른 유효 신청과 방문 구간이 겹치면 안 된다 (requirements 9절 #13).
 * 구간은 반열린 구간 [start, end)으로 보므로 19~21시 다음 21~22시처럼 이어지는 신청은 허용한다.
 * 호출 전에 학생 행을 FOR NO KEY UPDATE로 잠가 같은 학생의 동시 신청과 직렬화해야 한다.
 */
async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  studentId: number,
  startAt: Date,
  endAt: Date,
  excludeVisitId?: number,
): Promise<void> {
  const overlapping = await tx.visit.findFirst({
    where: {
      studentId,
      status: 'APPLIED',
      ...(excludeVisitId !== undefined && { id: { not: excludeVisitId } }),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    include: { studyRoom: { select: { name: true } } },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
  });
  if (overlapping) {
    throw new DomainException(
      ErrorCode.VISIT_TIME_OVERLAP,
      `같은 시간에 신청한 자습실(${overlapping.studyRoom.name})이 있습니다.`,
      HttpStatus.CONFLICT,
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
