import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-env.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // 모든 e2e가 같은 테스트 DB를 쓰므로 파일 단위 병렬 실행을 끈다
    fileParallelism: false,
    env: { DATABASE_URL: TEST_DATABASE_URL },
  },
});
