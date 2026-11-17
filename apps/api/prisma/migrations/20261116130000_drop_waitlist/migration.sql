-- 대기열 제거 (#44): 좌석 단위 예약으로 전환하며 대기열(#36)을 없앤다
-- (docs/tbd/seat-based-reservation.md 결정 3)
-- DropForeignKey
ALTER TABLE "waitlist_entries" DROP CONSTRAINT "waitlist_entries_student_id_fkey";

-- DropForeignKey
ALTER TABLE "waitlist_entries" DROP CONSTRAINT "waitlist_entries_study_room_id_fkey";

-- DropTable
DROP TABLE "waitlist_entries";

-- DropEnum
DROP TYPE "WaitlistStatus";
