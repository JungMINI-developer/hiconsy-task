import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL이 설정되지 않았습니다.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** 오늘 0시(로컬) 기준으로 dayOffset일 뒤 hour시 */
function at(dayOffset: number, hour: number): Date {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return new Date(base.getTime() + dayOffset * DAY + hour * HOUR);
}

/**
 * 초기 데이터 시드.
 * Docker 실행 시 컨테이너가 시작될 때마다 실행되므로 멱등하게 작성한다.
 * 학생이 하나라도 있으면 이미 시드된 것으로 보고 건너뛴다 (사용자가 만든 데이터를 덮어쓰지 않기 위함).
 */
/** 좌석 1~n번 (최대 인원 = 좌석 수, #45) */
function seatsFor(n: number) {
  return { create: Array.from({ length: n }, (_, i) => ({ number: i + 1 })) };
}
const seatInclude = { seats: true } as const;

async function main() {
  if ((await prisma.student.count()) > 0) {
    console.log('🌱 seed 건너뜀 (기존 데이터 존재)');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const students = await Promise.all(
      [
        { name: '김하이', phone: '010-1111-1111' },
        { name: '이컨시', phone: '010-2222-2222' },
        { name: '박자습', phone: '010-3333-3333' },
        { name: '최공부', phone: '010-4444-4444' },
        { name: '정열심', phone: '010-5555-5555' },
      ].map((data) => tx.student.create({ data })),
    );

    const rooms = await Promise.all([
      tx.studyRoom.create({
        data: {
          name: 'A 자습실 (중간고사 대비)',
          maxPersonnel: 3,
          startDate: at(1, 9),
          endDate: at(1, 22),
          seats: seatsFor(3),
        },
        include: seatInclude,
      }),
      tx.studyRoom.create({
        data: {
          name: 'B 자습실 (주말 특강)',
          maxPersonnel: 10,
          startDate: at(3, 10),
          endDate: at(4, 18),
          seats: seatsFor(10),
        },
        include: seatInclude,
      }),
      tx.studyRoom.create({
        data: {
          name: 'C 자습실 (오전반)',
          maxPersonnel: 5,
          startDate: at(2, 9),
          endDate: at(2, 18),
          seats: seatsFor(5),
        },
        include: seatInclude,
      }),
    ]);
    const [roomA, roomB] = rooms;

    const [s1, s2, s3] = students;
    /** 자습실의 n번 좌석 id */
    const seat = (room: (typeof rooms)[number] | undefined, n: number) =>
      room!.seats.find((s) => s.number === n)!.id;

    // s1: A 자습실 1번 좌석 신청 → 시간·좌석 수정 (19~21시 → 20~22시, 1번 → 2번 좌석)
    const v1 = await tx.visit.create({
      data: {
        studentId: s1!.id,
        studyRoomId: roomA!.id,
        startAt: at(1, 20),
        endAt: at(1, 22),
        seatId: seat(roomA, 2),
      },
    });
    await tx.visitHistory.createMany({
      data: [
        {
          visitId: v1.id,
          studentId: s1!.id,
          studyRoomId: roomA!.id,
          action: 'APPLY',
          startAt: at(1, 19),
          endAt: at(1, 21),
          seatId: seat(roomA, 1),
        },
        {
          visitId: v1.id,
          studentId: s1!.id,
          studyRoomId: roomA!.id,
          action: 'UPDATE',
          prevStartAt: at(1, 19),
          prevEndAt: at(1, 21),
          startAt: at(1, 20),
          endAt: at(1, 22),
          prevSeatId: seat(roomA, 1),
          seatId: seat(roomA, 2),
        },
      ],
    });

    // s2: A 자습실 1번 좌석 신청 → 취소 (좌석 기록은 남는다)
    const v2 = await tx.visit.create({
      data: {
        studentId: s2!.id,
        studyRoomId: roomA!.id,
        startAt: at(1, 9),
        endAt: at(1, 12),
        seatId: seat(roomA, 1),
        status: 'CANCELED',
        canceledAt: new Date(),
      },
    });
    await tx.visitHistory.createMany({
      data: [
        {
          visitId: v2.id,
          studentId: s2!.id,
          studyRoomId: roomA!.id,
          action: 'APPLY',
          startAt: at(1, 9),
          endAt: at(1, 12),
          seatId: seat(roomA, 1),
        },
        {
          visitId: v2.id,
          studentId: s2!.id,
          studyRoomId: roomA!.id,
          action: 'CANCEL',
          prevStartAt: at(1, 9),
          prevEndAt: at(1, 12),
          startAt: at(1, 9),
          endAt: at(1, 12),
          prevSeatId: seat(roomA, 1),
          seatId: seat(roomA, 1),
        },
      ],
    });

    // s3: B 자습실 5번 좌석 신청
    const v3 = await tx.visit.create({
      data: {
        studentId: s3!.id,
        studyRoomId: roomB!.id,
        startAt: at(3, 13),
        endAt: at(3, 17),
        seatId: seat(roomB, 5),
      },
    });
    await tx.visitHistory.create({
      data: {
        visitId: v3.id,
        studentId: s3!.id,
        studyRoomId: roomB!.id,
        action: 'APPLY',
        startAt: at(3, 13),
        endAt: at(3, 17),
        seatId: seat(roomB, 5),
      },
    });
  });

  console.log('🌱 seed 완료');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
