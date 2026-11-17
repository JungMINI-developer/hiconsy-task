-- 대기열 (#36): 정원이 찬 자습실에 원하는 시간으로 줄을 서고, 자리가 나면 순번대로 자리 제안
-- 학생-자습실 쌍당 진행 중(ended_at IS NULL) 대기 1건은 부분 유니크 인덱스로 보장
-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELED');

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "study_room_id" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "offered_at" TIMESTAMPTZ(3),
    "offer_expires_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "end_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_entries_study_room_id_status_created_at_idx" ON "waitlist_entries"("study_room_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "waitlist_entries_student_id_status_idx" ON "waitlist_entries"("student_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_active_key" ON "waitlist_entries"("student_id", "study_room_id") WHERE ("ended_at" IS NULL);

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_study_room_id_fkey" FOREIGN KEY ("study_room_id") REFERENCES "study_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

