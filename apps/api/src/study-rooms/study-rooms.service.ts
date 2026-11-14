import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, type StudyRoom, type StudyRoomHistory } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CancelReason, cancelAppliedVisitsBySystem } from '../visits/visit-cancellation.js';
import type { CreateStudyRoomDto } from './dto/create-study-room.dto.js';
import type { UpdateStudyRoomDto } from './dto/update-study-room.dto.js';
import { lockStudyRoom, studyRoomNotFound } from './study-room-lock.js';
import { toStudyRoom, toStudyRoomHistory } from './study-room.mapper.js';

/** 현재 유효 신청(APPLIED) 수를 함께 조회하기 위한 include */
const withAppliedCount = {
  _count: { select: { visits: { where: { status: 'APPLIED' as const } } } },
};

@Injectable()
export class StudyRoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-ROM-01: 삭제되지 않은 자습실 목록 (운영 시작일 순) */
  async findAll(): Promise<StudyRoom[]> {
    const rooms = await this.prisma.studyRoom.findMany({
      where: { deletedAt: null },
      include: withAppliedCount,
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
    return rooms.map((room) => toStudyRoom(room, room._count.visits));
  }

  async findOne(id: number): Promise<StudyRoom> {
    const room = await this.prisma.studyRoom.findFirst({
      where: { id, deletedAt: null },
      include: withAppliedCount,
    });
    if (!room) throw studyRoomNotFound();
    return toStudyRoom(room, room._count.visits);
  }

  /** FR-ROM-02 */
  async create(dto: CreateStudyRoomDto): Promise<StudyRoom> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    assertValidPeriod(startDate, endDate);

    const room = await this.prisma.studyRoom.create({
      data: { name: dto.name, maxPersonnel: dto.maxPersonnel, startDate, endDate },
    });
    return toStudyRoom(room, 0);
  }

  /**
   * FR-ROM-04, FR-ROM-06
   * - 최대 인원은 현재 유효 신청 인원보다 작게 줄일 수 없다.
   * - 운영 기간은 기존 유효 신청의 방문 구간을 모두 포함해야 한다.
   */
  async update(id: number, dto: UpdateStudyRoomDto): Promise<StudyRoom> {
    return this.prisma.$transaction(async (tx) => {
      await lockStudyRoom(tx, id);
      const current = await tx.studyRoom.findUniqueOrThrow({ where: { id } });

      const maxPersonnel = dto.maxPersonnel ?? current.maxPersonnel;
      const startDate = dto.startDate ? new Date(dto.startDate) : current.startDate;
      const endDate = dto.endDate ? new Date(dto.endDate) : current.endDate;
      assertValidPeriod(startDate, endDate);

      const appliedCount = await tx.visit.count({ where: { studyRoomId: id, status: 'APPLIED' } });

      if (maxPersonnel < appliedCount) {
        throw new DomainException(
          ErrorCode.CAPACITY_BELOW_CURRENT,
          `현재 신청 인원(${appliedCount}명)보다 작게 줄일 수 없습니다.`,
          HttpStatus.CONFLICT,
        );
      }

      const periodChanged =
        startDate.getTime() !== current.startDate.getTime() ||
        endDate.getTime() !== current.endDate.getTime();
      if (periodChanged) {
        const outOfPeriod = await tx.visit.count({
          where: {
            studyRoomId: id,
            status: 'APPLIED',
            OR: [{ startAt: { lt: startDate } }, { endAt: { gt: endDate } }],
          },
        });
        if (outOfPeriod > 0) {
          throw new DomainException(
            ErrorCode.PERIOD_EXCLUDES_VISITS,
            `변경할 운영 기간을 벗어나는 방문 신청이 ${outOfPeriod}건 있습니다.`,
            HttpStatus.CONFLICT,
          );
        }
      }

      const room = await tx.studyRoom.update({
        where: { id },
        data: { name: dto.name, maxPersonnel, startDate, endDate },
      });
      return toStudyRoom(room, appliedCount);
    });
  }

  /**
   * FR-ROM-05, FR-ROM-06: Soft Delete.
   * 유효 신청은 자동 취소하고 이력에 SYSTEM 주체와 사유를 남긴다.
   */
  async remove(id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockStudyRoom(tx, id);
      const now = new Date();

      await cancelAppliedVisitsBySystem(
        tx,
        { studyRoomId: id },
        CancelReason.STUDY_ROOM_DELETED,
        now,
      );

      await tx.studyRoom.update({ where: { id }, data: { deletedAt: now } });
    });
  }

  /** FR-ROM-03: 방문 신청·수정·취소 이력 (시간순) */
  async findHistories(id: number): Promise<StudyRoomHistory[]> {
    const exists = await this.prisma.studyRoom.count({ where: { id, deletedAt: null } });
    if (exists === 0) throw studyRoomNotFound();

    const histories = await this.prisma.visitHistory.findMany({
      where: { studyRoomId: id },
      include: { student: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return histories.map(toStudyRoomHistory);
  }
}

function assertValidPeriod(startDate: Date, endDate: Date): void {
  if (startDate.getTime() >= endDate.getTime()) {
    throw new DomainException(
      ErrorCode.INVALID_PERIOD,
      '운영 시작 일시는 종료 일시보다 이전이어야 합니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
