/** e2e는 개발 DB(hiconsy)가 아닌 테스트 전용 DB(hiconsy_test)를 사용한다 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://hiconsy:hiconsy@localhost:5434/hiconsy_test?schema=public';
