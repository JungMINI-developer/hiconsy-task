# hiconsy-task

하이컨시 과제전형 레포입니다. pnpm workspace + Turborepo 기반 풀스택 모노레포입니다.

## 기술 스택

| 영역                       | 스택                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Frontend (`apps/web`)      | Vue 3, Vite, TypeScript, Vue Router, Pinia, Axios, Vitest, ESLint + oxlint         |
| Backend (`apps/api`)       | NestJS 12 (ESM), Prisma 7, PostgreSQL 16, Swagger, class-validator, Vitest, oxlint |
| Shared (`packages/shared`) | FE/BE 공통 타입 (API 응답 포맷 등)                                                 |
| Monorepo                   | pnpm workspace, Turborepo                                                          |

## 요구 사항

- Node.js 24 이상 (`.nvmrc`)
- pnpm 12 (`corepack enable`)
- Docker (PostgreSQL)

## 실행 방법

```bash
pnpm install                      # 의존성 설치 + Prisma Client 생성
cp apps/api/.env.example apps/api/.env
pnpm db:up                        # PostgreSQL 실행 (localhost:5434)
pnpm db:migrate                   # 마이그레이션 적용
pnpm dev                          # web + api + shared(watch) 동시 실행
```

| 주소                           | 설명         |
| ------------------------------ | ------------ |
| http://localhost:5173          | 프론트엔드   |
| http://localhost:3000/api      | 백엔드 API   |
| http://localhost:3000/api/docs | Swagger 문서 |

> DB 호스트 포트는 기본 `5434`입니다. 바꾸려면 `POSTGRES_PORT`를 지정하고 `apps/api/.env`의 `DATABASE_URL`도 함께 수정하세요.

## 스크립트

| 명령                          | 설명                                       |
| ----------------------------- | ------------------------------------------ |
| `pnpm dev`                    | 전체 개발 서버 실행                        |
| `pnpm build`                  | 전체 빌드                                  |
| `pnpm lint`                   | 전체 lint                                  |
| `pnpm typecheck`              | 전체 타입 체크                             |
| `pnpm test`                   | 전체 테스트                                |
| `pnpm db:up` / `pnpm db:down` | PostgreSQL 컨테이너 시작 / 종료            |
| `pnpm db:migrate`             | Prisma 마이그레이션 (`prisma migrate dev`) |

특정 앱만 실행: `pnpm --filter @hiconsy/web dev`

## 디렉터리 구조

```
apps/
  web/        # Vue 3 프론트엔드
  api/        # NestJS 백엔드 (prisma/ 스키마 포함)
packages/
  shared/     # FE/BE 공유 타입
  tsconfig/   # 공통 tsconfig base
docker-compose.yml
turbo.json
pnpm-workspace.yaml
```

## 개발 시 참고

- FE는 Vite dev proxy로 `/api` 요청을 `localhost:3000`에 보냅니다. 그래서 개발 중에는 CORS 설정 없이 호출할 수 있습니다.
- `packages/shared`는 `tsc`로 빌드됩니다. `pnpm dev`를 실행하면 watch 모드로 함께 뜹니다.
- Prisma Client는 `apps/api/src/generated/prisma`에 생성되고 git에는 올라가지 않습니다(`pnpm install` 때 자동 생성).
