import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL이 설정되지 않았습니다.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * 초기 데이터 시드.
 * Docker 실행 시 컨테이너가 시작될 때마다 실행되므로 반드시 멱등(upsert)하게 작성한다.
 */
async function main() {
  // TODO: 도메인 모델 추가 후 upsert로 시드 데이터 작성
  console.log('🌱 seed 완료');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
