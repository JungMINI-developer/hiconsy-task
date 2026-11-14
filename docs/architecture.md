# 아키텍처

## 인프라 (Docker Compose)

```
Browser
  │
  ▼
web (nginx :8080) ── /api/* ──▶ api (NestJS :3000) ──▶ postgres (:5432)
  └─ 정적 파일 (Vue SPA)            ├─ 시작 시 prisma migrate deploy + seed
                                    └─ /api/docs (Swagger)
```

- FE는 dev(Vite proxy), Docker(nginx proxy) 모두 같은 origin의 `/api`만 호출하므로 환경별 분기가 없습니다.
- PostgreSQL에는 개발 DB(`hiconsy`)와 e2e 테스트 전용 DB(`hiconsy_test`)가 분리되어 있습니다.

## 소스 코드 구조

### `packages/shared`

FE/BE 사이의 API 계약(요청/응답 타입)을 정의합니다.

```ts
// 성공: { success: true, data: T }
// 실패: { success: false, error: { code, message, details? } }
```

### `apps/api` (NestJS)

```
src/
  main.ts                 # 부트스트랩 + Swagger
  setup-app.ts            # prefix, CORS, ValidationPipe (main/e2e 공용)
  app.module.ts
  config/                 # 환경변수 검증
  common/
    filters/              # 모든 예외 → ApiError 포맷
    interceptors/         # 반환값 → ApiSuccess 포맷
  prisma/                 # PrismaService (Global)
  <domain>/               # 도메인 모듈 (controller, service, dto)
prisma/
  schema.prisma
  migrations/
  seed.ts
```

요청 흐름: `Controller → Service → PrismaService → PostgreSQL`
컨트롤러는 데이터만 반환하고, 응답 포맷팅은 Interceptor·Filter가 전담합니다.

### `apps/web` (Vue 3)

```
src/
  api/          # axios 인스턴스, API 호출 함수
  views/        # 라우트 페이지
  components/   # 재사용 컴포넌트
  stores/       # Pinia 스토어
  router/
```

UI는 Reka UI(헤드리스) + Tailwind CSS v4로 구현하고, 디자인 토큰은 `@theme`에 정의합니다. 화면 구성, 라우트 맵, 컴포넌트 구조는 [apps/web/docs](../apps/web/docs/README.md)를 참고합니다.

> TODO: 도메인 구현 후 모듈/컴포넌트 구조 보완
