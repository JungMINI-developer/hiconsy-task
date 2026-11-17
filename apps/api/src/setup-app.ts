import { INestApplication, ValidationPipe } from '@nestjs/common';

/** main.ts와 e2e 테스트가 같은 앱 설정을 쓰도록 공통화 */
export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  return app;
}
