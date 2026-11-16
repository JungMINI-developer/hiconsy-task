import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, type StudyRoomWaitlistEntry, type WaitlistEntry } from '@hiconsy/shared';
import { DomainException } from '../common/exceptions/domain.exception.js';
import type { Prisma, WaitlistEntry as WaitlistEntryRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lockStudent, studentNotFound } from '../students/student-lock.js';
import { lockStudyRoom, studyRoomNotFound } from '../study-rooms/study-room-lock.js';
import { assertValidVisitTime } from '../visits/visit-time.js';
import type { CreateWaitlistDto } from './dto/create-waitlist.dto.js';
import {
  availableSeats,
  countWaitlist,
  syncWaitlist,
  syncWaitlistNow,
  WaitlistReason,
} from './waitlist-sync.js';
import { toStudyRoomWaitlistEntry, toWaitlistEntry } from './waitlist.mapper.js';

/**
 * 대기열: 정원이 찬 자습실에 줄을 서고, 자리가 나면 순번대로 자리 제안을 받는다 (#36).
 * 제안 확정은 방문 신청 API가 맡는다 (VisitsService.apply가 본인 제안을 소비).
 *
 * 대기 행을 바꾸는 작업은 모두 자습실 행 락 안에서 실행되어 순번·정원 계산이 엇갈리지 않는다.
 */
@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  /** 내 대기 목록 (진행 중 + 종료, 최근 등록 순). 조회 전에 내 대기가 있는 자습실을 동기화한다 */
  async findAllByStudent(studentId: number): Promise<WaitlistEntry[]> {
    const exists = await this.prisma.student.count({ where: { id: studentId, deletedAt: null } });
    if (exists === 0) throw studentNotFound();

    const active = await this.prisma.waitlistEntry.findMany({
      where: { studentId, endedAt: null },
      select: { studyRoomId: true },
    });
    for (const roomId of new Set(active.map((e) => e.studyRoomId))) {
      await syncWaitlistNow(this.prisma, roomId);
    }

    const rows = await this.prisma.waitlistEntry.findMany({
      where: { studentId },
      include: { studyRoom: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return Promise.all(
      rows.map(async (row) => toWaitlistEntry(row, await this.position(this.prisma, row))),
    );
  }

  /** 대기 등록: 정원이 찬 자습실에만, 학생-자습실 쌍당 진행 중 1건 */
  async register(studentId: number, dto: CreateWaitlistDto): Promise<WaitlistEntry> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    // 거절(409)돼도 만료 정리·제안은 남도록 먼저 커밋한다
    await syncWaitlistNow(this.prisma, dto.studyRoomId);

    return this.prisma.$transaction(async (tx) => {
      await lockStudent(tx, studentId, 'share');
      await lockStudyRoom(tx, dto.studyRoomId);
      const room = await tx.studyRoom.findUniqueOrThrow({ where: { id: dto.studyRoomId } });
      await syncWaitlist(tx, room);

      assertValidVisitTime(startAt, endAt, room);

      const applied = await tx.visit.findFirst({
        where: { studentId, studyRoomId: room.id, status: 'APPLIED' },
      });
      if (applied) {
        throw new DomainException(
          ErrorCode.ALREADY_APPLIED,
          '이미 신청한 자습실입니다.',
          HttpStatus.CONFLICT,
        );
      }
      const waiting = await tx.waitlistEntry.findFirst({
        where: { studentId, studyRoomId: room.id, endedAt: null },
      });
      if (waiting) {
        throw new DomainException(
          ErrorCode.ALREADY_WAITING,
          '이미 대기 중인 자습실입니다.',
          HttpStatus.CONFLICT,
        );
      }

      const appliedCount = await tx.visit.count({
        where: { studyRoomId: room.id, status: 'APPLIED' },
      });
      const counts = (await countWaitlist(tx, [room.id])).get(room.id)!;
      if (availableSeats(room.maxPersonnel, appliedCount, counts) > 0) {
        throw new DomainException(
          ErrorCode.ROOM_HAS_SEATS,
          '자리가 남아 있어 바로 신청할 수 있습니다.',
          HttpStatus.CONFLICT,
        );
      }

      const entry = await tx.waitlistEntry.create({
        data: { studentId, studyRoomId: room.id, startAt, endAt },
        include: { studyRoom: true },
      });
      return toWaitlistEntry(entry, await this.position(tx, entry));
    });
  }

  /**
   * 대기 취소 / 제안 거절. 제안 중이었다면 잡아 두던 자리가 다음 순번에게 넘어간다.
   * 다른 학생의 대기는 존재 여부를 노출하지 않도록 404로 응답한다.
   */
  async cancel(studentId: number, entryId: number): Promise<WaitlistEntry> {
    return this.prisma.$transaction(async (tx) => {
      await lockStudent(tx, studentId, 'share');
      const target = await tx.waitlistEntry.findFirst({ where: { id: entryId, studentId } });
      if (!target) throw waitlistNotFound();
      if (target.endedAt) throw waitlistAlreadyEnded();

      await lockStudyRoom(tx, target.studyRoomId);
      const room = await tx.studyRoom.findUniqueOrThrow({ where: { id: target.studyRoomId } });
      // 락을 잡는 사이 만료됐을 수 있으므로 동기화 후 다시 읽는다
      await syncWaitlist(tx, room);
      const entry = await tx.waitlistEntry.findUniqueOrThrow({ where: { id: entryId } });
      if (entry.endedAt) throw waitlistAlreadyEnded();

      const declined = entry.status === 'OFFERED';
      const ended = await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status: declined ? 'DECLINED' : 'CANCELED',
          endedAt: new Date(),
          endReason: declined ? WaitlistReason.DECLINED : WaitlistReason.CANCELED_BY_STUDENT,
        },
        include: { studyRoom: true },
      });
      await syncWaitlist(tx, room);
      return toWaitlistEntry(ended, null);
    });
  }

  /** 강사 화면 [대기] 탭: 진행 중 대기 (제안 중 → 대기 순번 순) */
  async findByRoom(studyRoomId: number): Promise<StudyRoomWaitlistEntry[]> {
    const exists = await this.prisma.studyRoom.count({
      where: { id: studyRoomId, deletedAt: null },
    });
    if (exists === 0) throw studyRoomNotFound();
    await syncWaitlistNow(this.prisma, studyRoomId);

    const rows = await this.prisma.waitlistEntry.findMany({
      where: { studyRoomId, endedAt: null },
      include: { student: { select: { id: true, name: true, phone: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const offered = rows.filter((r) => r.status === 'OFFERED');
    const waiting = rows.filter((r) => r.status === 'WAITING');
    return [
      ...offered.map((r) => toStudyRoomWaitlistEntry(r, null)),
      ...waiting.map((r, i) => toStudyRoomWaitlistEntry(r, i + 1)),
    ];
  }

  /** WAITING이면 같은 자습실에서 나보다 먼저 등록한 대기 수 + 1, 아니면 null */
  private async position(
    client: Prisma.TransactionClient,
    entry: WaitlistEntryRow,
  ): Promise<number | null> {
    if (entry.status !== 'WAITING') return null;
    const ahead = await client.waitlistEntry.count({
      where: {
        studyRoomId: entry.studyRoomId,
        status: 'WAITING',
        OR: [
          { createdAt: { lt: entry.createdAt } },
          { createdAt: entry.createdAt, id: { lt: entry.id } },
        ],
      },
    });
    return ahead + 1;
  }
}

function waitlistNotFound(): DomainException {
  return new DomainException(
    ErrorCode.WAITLIST_NOT_FOUND,
    '대기를 찾을 수 없습니다.',
    HttpStatus.NOT_FOUND,
  );
}

function waitlistAlreadyEnded(): DomainException {
  return new DomainException(
    ErrorCode.WAITLIST_ALREADY_ENDED,
    '이미 끝난 대기입니다.',
    HttpStatus.CONFLICT,
  );
}
