-- 삭제되지 않은 학생끼리만 전화번호 중복 불가 (부분 유니크 인덱스)
CREATE UNIQUE INDEX "students_phone_active_key" ON "students"("phone") WHERE ("deleted_at" IS NULL);
