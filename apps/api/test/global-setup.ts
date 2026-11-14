import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-env.js';

/** e2e 시작 전 테스트 전용 DB에 마이그레이션을 적용한다 */
export default function setup() {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
