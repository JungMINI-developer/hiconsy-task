-- 조기 퇴실 (#66): 진행 중인 방문을 학생이 퇴실 처리하면 종료 시각을 줄이고 CHECKOUT 이력을 남긴다
-- AlterEnum
ALTER TYPE "VisitAction" ADD VALUE 'CHECKOUT';
