# hiconsy-task

하이컨시 과제전형 레포입니다. Vue 3(FE)와 NestJS(BE)로 구성된 풀스택 모노레포입니다.

## 과제 주제: 자습실 방문 예약 시스템

단톡방으로 받던 자습실 예약을 시스템으로 옮기는 MVP입니다.

- **강사**: 자습실(최대 인원, 운영 기간)을 등록·수정·삭제하고, 학생들의 신청·수정·취소 이력을 조회합니다.
- **학생**: 운영 기간 안에서 방문 시간을 정해 신청하고, 본인 신청을 수정·취소합니다.
- 로그인 대신 화면에서 강사/학생을 선택합니다.

요구사항(FR), 기능 정의(FN), 필수 엔티티 원문 정리: [docs/requirements.md](./docs/requirements.md)

### 화면

| 강사 · 자습실 목록                                   | 강사 · 자습실 상세 (이력)                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| ![강사 자습실 목록](./docs/images/teacher-rooms.jpg) | ![강사 자습실 상세 이력](./docs/images/teacher-room-history.jpg) |
| **학생 · 방문 신청**                                 | **학생 · 내 신청 (취소됨)**                                      |
| ![학생 방문 신청](./docs/images/student-apply.jpg)   | ![학생 내 신청](./docs/images/student-visits.jpg)                |

- 정원(`7 / 10명`, 학생은 `남은 자리`)과 내 신청 여부를 목록 카드에서 바로 보여줍니다.
- 방문 시간은 운영 기간 안·현재 이후의 30분 단위 선택지만 고를 수 있습니다.
- 시스템이 취소한 신청(자습실 삭제)은 학생의 취소됨 탭에 사유와 함께 남습니다.
- 디자인 원칙과 실제 토큰·대비 측정 결과: [apps/web/DESIGN.md](./apps/web/DESIGN.md)

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
pnpm test:e2e    # API e2e + 웹 E2E — pnpm db:up 필요
pnpm lint        # lint
pnpm typecheck   # 타입 체크
```

**웹 E2E (Playwright)** — 실제 브라우저에서 강사·학생 흐름을 버튼을 눌러 가며 확인합니다.

```bash
pnpm --filter @hiconsy/web exec playwright install chromium   # 처음 한 번 (약 100MB)
pnpm --filter @hiconsy/web test:e2e        # 데스크톱(1280) + 모바일(320) 두 폭
pnpm --filter @hiconsy/web test:e2e:ui     # 단계별로 보며 실행 (UI 모드)
```

- API(3100)·웹(5174) 서버를 테스트가 직접 띄우므로, 개발 서버(3000/5173)를 켜 둔 채로 돌려도 겹치지 않습니다.
- 개발 DB와 분리된 `hiconsy_web_e2e` DB를 쓰고(없으면 자동 생성), 테스트마다 데이터를 비웁니다.
- 실패하면 `apps/web/playwright-report`에 스크린샷과 trace가 남습니다 (`pnpm --filter @hiconsy/web exec playwright show-report`).
- 시나리오: 역할 선택·권한 이동, 강사 자습실 등록·수정 거절·이력·삭제, 학생 관리, 학생 신청·시간 변경·취소·다시 신청, 정원 마감·동시 신청, 키보드 조작, 320px 가로 스크롤

모든 PR에서 GitHub Actions로 lint, 타입 체크, 테스트, 빌드, API e2e(PostgreSQL), 웹 E2E(Playwright), Docker 빌드를 검증합니다.

### 환경변수

| 파일            | 읽는 곳                                | 필요 여부                       |
| --------------- | -------------------------------------- | ------------------------------- |
| `.env` (루트)   | `docker-compose.yml`                   | 선택. 없으면 기본값 사용        |
| `apps/api/.env` | NestJS, Prisma CLI (마이그레이션·시드) | 로컬 개발 모드에서 필수         |
| `apps/web/.env` | Vite                                   | 선택. 비우면 `/api` 프록시 사용 |

루트 `.env`로 바꿀 수 있는 값 (`cp .env.example .env`):

| 환경변수            | 기본값    | 대상                   |
| ------------------- | --------- | ---------------------- |
| `POSTGRES_USER`     | `hiconsy` | DB 사용자              |
| `POSTGRES_PASSWORD` | `hiconsy` | DB 비밀번호            |
| `POSTGRES_DB`       | `hiconsy` | DB 이름                |
| `POSTGRES_PORT`     | `5434`    | PostgreSQL 호스트 포트 |
| `API_PORT`          | `3000`    | Docker api 포트        |
| `WEB_PORT`          | `8080`    | Docker web 포트        |

Docker 전체 실행(방법 A)에서는 api 컨테이너의 `DATABASE_URL`이 위 값으로 자동 조합됩니다.
로컬 개발 모드(방법 B)에서 DB 값이나 포트를 바꿨다면 `apps/api/.env`의 `DATABASE_URL`도 같이 맞춰야 합니다.

### DB 접속 (pgAdmin, DBeaver 등)

| 항목     | 값 (기본값)                            |
| -------- | -------------------------------------- |
| Host     | `localhost`                            |
| Port     | `5434` (`POSTGRES_PORT`)               |
| Database | `hiconsy` (e2e 테스트: `hiconsy_test`) |
| Username | `hiconsy`                              |
| Password | `hiconsy`                              |

- pgAdmin을 Docker로 실행했다면 Host에 `host.docker.internal`을 입력합니다.
- GUI 없이 보려면 `pnpm --filter @hiconsy/api prisma:studio`를 실행합니다.

---

## 2. 기술 스택 및 선택 이유

| 영역      | 기술                                                                                          |
| --------- | --------------------------------------------------------------------------------------------- |
| Frontend  | Vue 3 (Composition API), Vite, TypeScript, Vue Router, Pinia, Axios, Tailwind CSS v4, Reka UI |
| Backend   | NestJS 12, Prisma 7, PostgreSQL 16, Swagger, class-validator                                  |
| 공통      | pnpm workspace, Turborepo, TypeScript, Vitest                                                 |
| 품질 관리 | ESLint, oxlint, Prettier, husky, commitlint, lint-staged, GitHub Actions                      |
| 인프라    | Docker, Docker Compose, nginx                                                                 |

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

| 테이블            | 역할                                         |
| ----------------- | -------------------------------------------- |
| `students`        | 학생 (Soft Delete)                           |
| `study_rooms`     | 자습실: 최대 인원, 운영 기간 (Soft Delete)   |
| `visits`          | 방문 신청의 현재 상태 (학생-자습실 쌍당 1행) |
| `visit_histories` | 신청·수정·취소 이벤트 로그 (append-only)     |

- 신청(현재 상태)과 이력(이벤트)을 분리해 정원·중복 검사와 이력 조회를 각각 단순하게 유지
- `UNIQUE(student_id, study_room_id)` + 상태 전환으로 중복 신청 방지와 취소 후 재신청을 함께 지원
- 정원은 트랜잭션 안에서 자습실 행을 `FOR UPDATE`로 잠근 뒤 검사

ERD와 자세한 설계 이유: [docs/database.md](./docs/database.md)

---

## 5. 개발 시 고민한 점 / 아쉬운 점

[docs/retrospective.md](./docs/retrospective.md)
