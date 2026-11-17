import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E2E_DATABASE_URL } from './support/env';

/** E2E 전용 DB에 마이그레이션을 적용한다 (DB가 없으면 Prisma가 만든다) */
export default function globalSetup() {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('../../api', import.meta.url)),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });
}
