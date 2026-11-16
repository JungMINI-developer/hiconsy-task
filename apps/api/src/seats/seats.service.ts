import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type RoomFreeSeats,
  type SeatAvailability,
  type SeatOccupancy,
} from '@hiconsy/shared';
import { toKstIso } from '../common/utils/date.js';
import { DomainException } from '../common/exceptions/domain.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { studyRoomNotFound } from '../study-rooms/study-room-lock.js';
import type {
  SeatAvailabilityQueryDto,
  SeatMapQueryDto,
  SeatRangeQueryDto,
} from './dto/seat-query.dto.js';
import { activeSeatsWhere, findFreeSeats, type Range } from './seat-occupancy.js';

/**
 * 좌석 현황 조회 (#45). 모두 읽기 전용이라 락을 잡지 않는다.
 * 화면이 보는 값은 낡을 수 있으므로, 최종 판단은 신청·수정이 자습실 락 안에서 다시 한다.
 */
@Injectable()
export class SeatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 학생 신청용: 쓰는 좌석마다 고른 시간 내내 비어 있는지 */
  async availability(
    studyRoomId: number,
    query: SeatAvailabilityQueryDto,
  ): Promise<SeatAvailability[]> {
    const room = await this.findRoom(studyRoomId);
    const range = toRange(query);
    const [seats, free] = await Promise.all([
      this.prisma.seat.findMany({
        where: activeSeatsWhere(room.id, room.maxPersonnel),
        orderBy: { number: 'asc' },
      }),
      findFreeSeats(this.prisma, room, range, query.exceptVisitId),
    ]);
    const freeIds = new Set(free.map((s) => s.id));
    return seats.map((s) => ({ id: s.id, number: s.number, available: freeIds.has(s.id) }));
  }

  /** 강사용 배치도: 쓰는 좌석마다 그 시각에 앉아 있기로 한 유효 신청 */
  async seatMap(studyRoomId: number, query: SeatMapQueryDto): Promise<SeatOccupancy[]> {
    const room = await this.findRoom(studyRoomId);
    const at = new Date(query.at);
    const seats = await this.prisma.seat.findMany({
      where: activeSeatsWhere(room.id, room.maxPersonnel),
      include: {
        visits: {
          where: { status: 'APPLIED', startAt: { lte: at }, endAt: { gt: at } },
          include: { student: { select: { id: true, name: true, phone: true } } },
          take: 1,
        },
      },
      orderBy: { number: 'asc' },
    });
    return seats.map((s) => {
      const v = s.visits[0];
      return {
        id: s.id,
        number: s.number,
        visit: v
          ? {
              id: v.id,
              student: v.student,
              startAt: toKstIso(v.startAt),
              endAt: toKstIso(v.endAt),
            }
          : null,
      };
    });
  }

  /**
   * 정원 마감 안내용: 운영 기간이 고른 시간을 모두 포함하는 자습실마다 그 시간 내내 비어 있는 좌석 수.
   * 운영 기간 밖이거나 삭제된 자습실은 빠진다.
   */
  async freeSeats(query: SeatRangeQueryDto): Promise<RoomFreeSeats[]> {
    const range = toRange(query);
    const rooms = await this.prisma.studyRoom.findMany({
      where: { deletedAt: null, startDate: { lte: range.startAt }, endDate: { gte: range.endAt } },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(
      rooms.map(async (room) => ({
        studyRoomId: room.id,
        freeSeats: (await findFreeSeats(this.prisma, room, range)).length,
      })),
    );
  }

  private async findRoom(id: number) {
    const room = await this.prisma.studyRoom.findFirst({ where: { id, deletedAt: null } });
    if (!room) throw studyRoomNotFound();
    return room;
  }
}

function toRange(query: SeatRangeQueryDto): Range {
  const startAt = new Date(query.startAt);
  const endAt = new Date(query.endAt);
  if (startAt.getTime() >= endAt.getTime()) {
    throw new DomainException(
      ErrorCode.INVALID_PERIOD,
      '방문 시작 일시는 종료 일시보다 이전이어야 합니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
  return { startAt, endAt };
}
