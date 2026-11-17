# 기술 스택 및 선택 이유

> README [2. 기술 스택 및 선택 이유](../README.md#2-기술-스택-및-선택-이유)의 상세판입니다. 필수 조건은 **Vue 3**와 **NestJS**이고, 나머지는 이 과제(동시 신청이 몰리는 예약 시스템을 평가자 로컬에서 그대로 실행)에 맞춰 골랐습니다.

## 한눈에 보기

| 영역      | 기술 (버전)                                                                             |
| --------- | --------------------------------------------------------------------------------------- |
| 공통      | TypeScript 6, pnpm 12 workspace, Turborepo 2, Node.js 24                                |
| Frontend  | Vue 3.5, Vite 8, Vue Router 5, Pinia 4, Axios, Tailwind CSS 4, Reka UI 2, lucide        |
| Backend   | NestJS 12, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 16, class-validator, Swagger     |
| 테스트    | Vitest 4 (단위·API e2e), Supertest, Playwright (웹 E2E, 데스크톱 1280 + 모바일 320)     |
| 품질 관리 | oxlint(type-aware) + ESLint, Prettier, husky + lint-staged + commitlint, GitHub Actions |
| 인프라    | Docker Compose (postgres · api · web), nginx                                            |

## 모노레포 — pnpm workspace + Turborepo

- **FE·BE가 API 계약을 `packages/shared`로 함께 씁니다.** 요청·응답 타입, 에러 코드(`ErrorCode`), 공용 상수(최대 좌석 30, 한 줄 5석)를 한 곳에 두어, 한쪽만 바꾸면 다른 쪽이 타입 검사에서 바로 깨집니다. 예: 강사 화면 학생 정보에 `deletedAt`을 더하자(#61) 웹 테스트 데이터까지 타입 오류로 드러났습니다.
- **pnpm**: 엄격한 의존성 격리(선언하지 않은 패키지를 쓰지 못함), 빠른 설치, `workspace:*` 프로토콜.
- **Turborepo**: `build`·`typecheck`·`test`를 패키지 의존 순서(shared → web·api)대로 병렬 실행하고 결과를 캐시합니다.

## Frontend — Vue 3 + Vite

| 기술                        | 이유                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue 3 `<script setup>` + TS | 과제 조건. 화면 로직을 composable로 나눠 재사용하고 테스트했습니다 (`useSeatPicker`·`useVisitTimePicker`·`useAutoRefresh`·`useVisitCheckout`)                                    |
| Vite                        | 빠른 개발 서버, `/api` 프록시로 개발·Docker 모두 같은 origin만 호출 (환경별 분기 없음)                                                                                           |
| Vue Router                  | 다이얼로그·모드 상태를 URL 쿼리에 둬(`?edit=1`, `?tab=histories`, `?slot=`) 새로고침·뒤로가기에도 유지                                                                           |
| Pinia                       | 여러 화면이 함께 보는 상태만 둡니다(고른 역할·학생, 헤더 "내 신청" 배지). 좌석은 다른 학생의 신청으로 계속 바뀌므로 서버 데이터는 캐시하지 않고 화면 진입·30초마다 다시 받습니다 |
| Axios                       | 응답 언래핑(`{ success, data }`)과 에러 정규화(`AppError`)를 클라이언트 한 곳에서 처리                                                                                           |
| Tailwind CSS 4              | 디자인 토큰을 `@theme`에 정의해 색·간격을 토큰으로만 씁니다. 320px 대응을 클래스 단위로 빠르게 조정                                                                              |
| Reka UI (헤드리스) + cva    | Dialog·Select·Tabs·Toast의 **접근성 동작**(포커스 가두기, 키보드 조작, ARIA)은 검증된 라이브러리에 맡기고 모양은 직접 만들었습니다. 변형은 `class-variance-authority`로 관리     |
| lucide-vue-next, Pretendard | 일관된 선 아이콘, 한글 가독성                                                                                                                                                    |

## Backend — NestJS + Prisma + PostgreSQL

| 기술                  | 이유                                                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NestJS                | 과제 조건. 도메인별 모듈(`study-rooms`·`students`·`visits`·`seats`), DTO + `ValidationPipe` 입력 검증, 공식 Swagger. **Interceptor·Exception Filter**로 모든 응답을 `{ success, data }` / `{ success, error: { code, message } }`로 통일 |
| Prisma 7              | 스키마 하나에서 모델·마이그레이션·타입이 나와 DB와 코드 타입이 어긋나지 않습니다. 기존 데이터를 옮기는 마이그레이션(좌석 배정, #48)도 SQL로 함께 관리                                                                                    |
| PostgreSQL 16         | 이 과제의 핵심인 동시 신청을 **행 락**으로 다룹니다 — 자습실 행 `FOR UPDATE`, 학생 행 `FOR NO KEY UPDATE`(교착 상태 회피). 그 밖에 부분 유니크 인덱스(활성 학생 전화번호), CHECK 제약, `timestamptz`                                     |
| Swagger (`/api/docs`) | 평가자가 API를 바로 확인. 엔드포인트마다 가능한 에러 코드를 적었습니다                                                                                                                                                                   |

Prisma로 표현할 수 없는 것은 이렇게 다뤘습니다.

- **행 락**: `$queryRaw`로 `SELECT ... FOR UPDATE`를 실행합니다(`study-room-lock.ts`, `student-lock.ts`).
- **CHECK 제약**: 마이그레이션 SQL에 직접 넣었습니다(Prisma는 비교하지 않아 이후 마이그레이션에서 지워지지 않음).
- **같은 좌석·같은 학생의 시간 겹침**: DB 배제 제약(`EXCLUDE USING gist`)은 Prisma 스키마로 표현할 수 없어, 행 락 + 서비스 로직으로 막았습니다. → [solutions](./solutions/)

## 테스트

| 도구               | 쓰는 곳                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest             | 웹·API 단위 테스트를 같은 러너로                                                                                                          |
| Vitest + Supertest | **API e2e**: 실제 PostgreSQL(테스트 전용 DB)에 붙여 규칙·동시 요청을 검증. 락을 빼면 실패하는지까지 확인했습니다                          |
| Playwright         | **웹 E2E**: 실제 브라우저로 강사·학생 흐름을 데스크톱 1280·모바일 320에서. 전용 DB·포트를 써서 개발 서버를 켠 채로 돌려도 겹치지 않습니다 |

## 품질 관리

- **oxlint(type-aware) + ESLint**: oxlint로 빠른 기본·타입 기반 검사, ESLint로 Vue 전용 규칙.
- **Prettier + husky + lint-staged + commitlint**: 커밋할 때 포맷과 [커밋 컨벤션](../CONTRIBUTING.md#커밋-컨벤션)을 강제합니다.
- **GitHub Actions**: 모든 PR에서 4개 작업 — ① lint·typecheck·단위 테스트·빌드 ② API e2e(PostgreSQL) ③ 웹 E2E(Playwright) ④ Docker 빌드. `main`은 ①②④ 통과가 필수입니다.

## 인프라 — Docker Compose

- **평가자 로컬에서 그대로 실행되는 것**을 우선했습니다. Docker만 있으면 Node.js·pnpm 버전과 상관없이 `docker compose up --build` 한 번으로 postgres·api·web이 뜹니다.
- api 컨테이너가 시작할 때 `prisma migrate deploy` → 시드 → 서버 순으로 실행합니다. 시드는 실행 시각 기준으로 **지금 운영 중인 자습실**을 넣어 바로 좌석 현황을 볼 수 있습니다.
- web은 nginx가 Vue 빌드를 서빙하고 `/api/`를 api 컨테이너로 프록시합니다(같은 origin).
- 운영 배포는 과제 범위가 아니라 두지 않았습니다.
