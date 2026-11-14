import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate`는 DB 접속이 필요 없으므로, .env가 없는 환경(최초 설치, CI, Docker 빌드)에서도
    // 설치가 실패하지 않도록 env()가 아닌 process.env를 사용한다.
    url: process.env.DATABASE_URL ?? '',
  },
});
