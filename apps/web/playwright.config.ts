import { defineConfig, devices } from '@playwright/test';
import {
  E2E_API_PORT,
  E2E_API_URL,
  E2E_DATABASE_URL,
  E2E_WEB_PORT,
  E2E_WEB_URL,
} from './e2e/support/env';

/**
 * 웹 E2E — 실제 브라우저에서 강사·학생 흐름을 따라간다.
 * 실행: pnpm --filter @hiconsy/web test:e2e  (DB: pnpm db:up)
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // 모든 테스트가 같은 E2E DB를 비우고 채우므로 순서대로 실행한다
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_WEB_URL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile-320',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 700 }, hasTouch: true },
    },
  ],
  webServer: [
    {
      name: 'api',
      command: 'pnpm --filter @hiconsy/api exec nest start',
      url: `${E2E_API_URL}/health`,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        PORT: String(E2E_API_PORT),
        CORS_ORIGIN: E2E_WEB_URL,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
    },
    {
      name: 'web',
      command: `pnpm exec vite --port ${E2E_WEB_PORT} --strictPort`,
      url: E2E_WEB_URL,
      env: { E2E: 'true', VITE_API_PROXY_TARGET: `http://localhost:${E2E_API_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
