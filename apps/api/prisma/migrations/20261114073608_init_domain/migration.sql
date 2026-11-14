-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('APPLIED', 'CANCELED');

-- CreateEnum
CREATE TYPE "VisitAction" AS ENUM ('APPLY', 'UPDATE', 'CANCEL');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('STUDENT', 'INSTRUCTOR', 'SYSTEM');

-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_rooms" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "max_personnel" INTEGER NOT NULL,
    "start_date" TIMESTAMPTZ(3) NOT NULL,
    "end_date" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "study_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "study_room_id" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'APPLIED',
    "canceled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_histories" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "study_room_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "action" "VisitAction" NOT NULL,
    "prev_start_at" TIMESTAMPTZ(3),
    "prev_end_at" TIMESTAMPTZ(3),
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "actor_type" "ActorType" NOT NULL DEFAULT 'STUDENT',
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "students_deleted_at_idx" ON "students"("deleted_at");

-- CreateIndex
CREATE INDEX "study_rooms_deleted_at_start_date_idx" ON "study_rooms"("deleted_at", "start_date");

-- CreateIndex
CREATE INDEX "visits_study_room_id_status_idx" ON "visits"("study_room_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "visits_student_id_study_room_id_key" ON "visits"("student_id", "study_room_id");

-- CreateIndex
CREATE INDEX "visit_histories_study_room_id_created_at_idx" ON "visit_histories"("study_room_id", "created_at");

-- CreateIndex
CREATE INDEX "visit_histories_student_id_created_at_idx" ON "visit_histories"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "visit_histories_visit_id_idx" ON "visit_histories"("visit_id");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_study_room_id_fkey" FOREIGN KEY ("study_room_id") REFERENCES "study_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_histories" ADD CONSTRAINT "visit_histories_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_histories" ADD CONSTRAINT "visit_histories_study_room_id_fkey" FOREIGN KEY ("study_room_id") REFERENCES "study_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_histories" ADD CONSTRAINT "visit_histories_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK 제약조건 (Prisma 스키마로 표현할 수 없어 직접 추가)
ALTER TABLE "study_rooms"
  ADD CONSTRAINT "study_rooms_max_personnel_check" CHECK ("max_personnel" > 0),
  ADD CONSTRAINT "study_rooms_period_check" CHECK ("start_date" < "end_date");

ALTER TABLE "visits"
  ADD CONSTRAINT "visits_period_check" CHECK ("start_at" < "end_at");

ALTER TABLE "visit_histories"
  ADD CONSTRAINT "visit_histories_period_check" CHECK ("start_at" < "end_at");
