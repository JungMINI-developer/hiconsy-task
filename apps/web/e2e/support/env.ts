/**
 * 웹 E2E 실행 환경.
 * 개발 서버(3000/5173)와 동시에 돌려도 겹치지 않게 포트를 따로 쓰고,
 * 개발 DB(hiconsy)·API e2e DB(hiconsy_test)와도 분리된 DB를 쓴다.
 */
export const E2E_API_PORT = Number(process.env.E2E_API_PORT ?? 3100);
export const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5174);

export const E2E_API_URL = `http://localhost:${E2E_API_PORT}/api`;
export const E2E_WEB_URL = `http://localhost:${E2E_WEB_PORT}`;

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://hiconsy:hiconsy@localhost:5434/hiconsy_web_e2e?schema=public';
