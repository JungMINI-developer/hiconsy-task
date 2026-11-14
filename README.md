# hiconsy-task

하이컨시 과제전형 레포입니다. Vue 3(FE)와 NestJS(BE)로 구성된 풀스택 모노레포입니다.

## 과제 주제: 자습실 방문 예약 시스템

단톡방으로 받던 자습실 예약을 시스템으로 옮기는 MVP입니다.

- **강사**: 자습실(최대 인원, 운영 기간)을 등록·수정·삭제하고, 학생들의 신청·수정·취소 이력을 조회합니다.
- **학생**: 운영 기간 안에서 방문 시간을 정해 신청하고, 본인 신청을 수정·취소합니다.
- 로그인 대신 화면에서 강사/학생을 선택합니다.

요구사항(FR), 기능 정의(FN), 필수 엔티티 원문 정리: [docs/requirements.md](./docs/requirements.md)

> TODO: 구현 범위(필수/선택 FR) 및 직접 정한 규칙 요약

## 목차

1. [프로젝트 실행 방법](#1-프로젝트-실행-방법)
2. [기술 스택 및 선택 이유](#2-기술-스택-및-선택-이유)
3. [아키텍처 및 컨벤션](#3-아키텍처-및-컨벤션)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [개발 시 고민한 점 / 아쉬운 점](#5-개발-시-고민한-점--아쉬운-점)

---

## 1. 프로젝트 실행 방법

### 방법 A. Docker로 전체 실행 (권장)

Docker만 설치되어 있으면 Node.js/pnpm 설치 없이 실행할 수 있습니다.

```bash
docker compose up --build
```

| 주소                           | 설명               |
| ------------------------------ | ------------------ |
| http://localhost:8080          | 프론트엔드 (nginx) |
| http://localhost:3000/api      | 백엔드 API         |
| http://localhost:3000/api/docs | Swagger API 문서   |

컨테이너 시작 시 DB 마이그레이션과 시드 데이터가 자동으로 적용됩니다.
종료: `docker compose down` (DB 데이터까지 삭제: `docker compose down -v`)

### 방법 B. 로컬 개발 모드

요구 사항: Node.js 24+, pnpm 12 (`npm i -g pnpm@12` 또는 `corepack enable`), Docker

```bash
pnpm install                          # 의존성 설치 + Prisma Client 생성
cp apps/api/.env.example apps/api/.env
pnpm db:up                            # PostgreSQL 실행 (localhost:5434)
pnpm db:migrate                       # 마이그레이션 적용
pnpm db:seed                          # 시드 데이터
pnpm dev                              # web + api 동시 실행 (hot reload)
```

| 주소                           | 설명             |
| ------------------------------ | ---------------- |
| http://localhost:5173          | 프론트엔드       |
| http://localhost:3000/api      | 백엔드 API       |
| http://localhost:3000/api/docs | Swagger API 문서 |

### 테스트

```bash
pnpm test        # 단위 테스트 (web, api)
pnpm test:e2e    # API e2e 테스트 — pnpm db:up 필요, 테스트 전용 DB(hiconsy_test) 사용
pnpm lint        # lint
pnpm typecheck   # 타입 체크
```

모든 PR에서 GitHub Actions로 lint, 타입 체크, 테스트, 빌드, e2e(PostgreSQL), Docker 빌드를 검증합니다.

### 포트 충돌 시

| 환경변수        | 기본값 | 대상                   |
| --------------- | ------ | ---------------------- |
| `POSTGRES_PORT` | 5434   | PostgreSQL 호스트 포트 |
| `API_PORT`      | 3000   | Docker api 포트        |
| `WEB_PORT`      | 8080   | Docker web 포트        |

`POSTGRES_PORT`를 바꾸면 `apps/api/.env`의 `DATABASE_URL`도 함께 수정해야 합니다.

---

## 2. 기술 스택 및 선택 이유

| 영역      | 기술                                                                     |
| --------- | ------------------------------------------------------------------------ |
| Frontend  | Vue 3 (Composition API), Vite, TypeScript, Vue Router, Pinia, Axios      |
| Backend   | NestJS 12, Prisma 7, PostgreSQL 16, Swagger, class-validator             |
| 공통      | pnpm workspace, Turborepo, TypeScript, Vitest                            |
| 품질 관리 | ESLint, oxlint, Prettier, husky, commitlint, lint-staged, GitHub Actions |
| 인프라    | Docker, Docker Compose, nginx                                            |

자세한 선택 이유: [docs/tech-stack.md](./docs/tech-stack.md)

---

## 3. 아키텍처 및 컨벤션

```
apps/
  web/              # Vue 3 SPA (+ docs/ UI/UX 설계 문서)
  api/              # NestJS REST API (+ prisma/ 스키마·마이그레이션)
packages/
  shared/           # FE/BE 공유 타입 (API 요청/응답 계약)
  tsconfig/         # 공통 tsconfig
infra/postgres/     # DB 초기화 스크립트
docs/               # 상세 문서
```

- 아키텍처 (인프라, 소스 코드 구조, 요청 흐름): [docs/architecture.md](./docs/architecture.md)
- 컨벤션 (브랜치 전략, 커밋, 코드 스타일): [CONTRIBUTING.md](./CONTRIBUTING.md)
- UI/UX 설계 (사용자 흐름, 화면 명세, 디자인 시스템, UI 구현 방식): [apps/web/docs](./apps/web/docs/README.md)

---

## 4. 데이터베이스 스키마

스키마 구조(ERD)와 설계 이유: [docs/database.md](./docs/database.md)

---

## 5. 개발 시 고민한 점 / 아쉬운 점

[docs/retrospective.md](./docs/retrospective.md)
