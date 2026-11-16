-- 좌석 단위 예약 (#45): 자습실의 최대 인원 = 좌석 수, 신청은 좌석을 하나 차지한다.
-- 같은 좌석의 유효 신청끼리 시간이 겹치지 않는 규칙은 서비스 로직(자습실 락 안)으로 지킨다.
-- (배제 제약은 Prisma 스키마로 표현할 수 없어 쓰지 않는다)

-- AlterTable
ALTER TABLE "visit_histories" ADD COLUMN     "prev_seat_id" INTEGER,
ADD COLUMN     "seat_id" INTEGER;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "seat_id" INTEGER;

-- CreateTable
CREATE TABLE "seats" (
    "id" SERIAL NOT NULL,
    "study_room_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seats_study_room_id_number_key" ON "seats"("study_room_id", "number");

-- CreateIndex
CREATE INDEX "visits_seat_id_status_start_at_idx" ON "visits"("seat_id", "status", "start_at");

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_study_room_id_fkey" FOREIGN KEY ("study_room_id") REFERENCES "study_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_histories" ADD CONSTRAINT "visit_histories_prev_seat_id_fkey" FOREIGN KEY ("prev_seat_id") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_histories" ADD CONSTRAINT "visit_histories_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 좌석 번호는 1부터 (Prisma 스키마로 표현할 수 없어 직접 추가)
ALTER TABLE "seats" ADD CONSTRAINT "seats_number_check" CHECK ("number" >= 1);

-- 데이터 이전 1: 기존 자습실마다 좌석 1~max_personnel번 생성
INSERT INTO "seats" ("study_room_id", "number")
SELECT r."id", n
FROM "study_rooms" r
CROSS JOIN LATERAL generate_series(1, r."max_personnel") AS n;

-- 데이터 이전 2: 기존 유효 신청을 방문 시작 순으로 보며, 시간이 겹치지 않는 가장 작은 번호 좌석에 배정
-- (지금까지는 유효 신청 수 ≤ 최대 인원이 보장되므로 모두 배정된다. 취소된 신청은 좌석 없이 둔다)
DO $$
DECLARE
  v RECORD;
  free_seat INTEGER;
BEGIN
  FOR v IN
    SELECT "id", "study_room_id", "start_at", "end_at"
    FROM "visits"
    WHERE "status" = 'APPLIED'
    ORDER BY "study_room_id", "start_at", "id"
  LOOP
    SELECT s."id" INTO free_seat
    FROM "seats" s
    WHERE s."study_room_id" = v."study_room_id"
      AND NOT EXISTS (
        SELECT 1 FROM "visits" o
        WHERE o."seat_id" = s."id"
          AND o."status" = 'APPLIED'
          AND o."start_at" < v."end_at"
          AND o."end_at" > v."start_at"
      )
    ORDER BY s."number"
    LIMIT 1;

    UPDATE "visits" SET "seat_id" = free_seat WHERE "id" = v."id";
  END LOOP;
END $$;
