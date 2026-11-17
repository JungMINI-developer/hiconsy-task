# 기술 스택 및 선택 이유

> 각 항목의 "선택 이유"는 초기 세팅 기준 초안입니다. 구현을 진행하며 실제 경험을 바탕으로 다듬습니다.

## Monorepo — pnpm workspace + Turborepo

- FE와 BE가 **API 요청/응답 타입을 `packages/shared`로 공유**해서, 계약이 바뀌면 양쪽에서 컴파일 오류로 바로 드러나게 했습니다.
- pnpm: 엄격한 의존성 격리(phantom dependency 방지)와 빠른 설치, workspace 프로토콜 지원.
- Turborepo: `dev`/`build`/`test`를 패키지 의존 순서(shared → web/api)에 맞춰 병렬 실행하고 결과를 캐싱합니다.

## Frontend — Vue 3 + Vite + TypeScript

- 과제 요구 사항 (Vue.js)
- `<script setup>` + Composition API로 로직을 composable 단위로 분리하기 쉽습니다.
- Vite: 빠른 dev 서버/HMR, dev proxy로 CORS 없이 BE를 호출할 수 있습니다.
- Pinia: Vue 공식 상태 관리 라이브러리, TypeScript 추론이 좋습니다.
- Axios: 인터셉터로 공통 에러 처리를 한 곳에 모을 수 있습니다.

## Backend — NestJS + Prisma + PostgreSQL

- 과제 요구 사항 (Nest.js)
- NestJS: 모듈/DI 구조로 도메인별 책임 분리가 명확하고, ValidationPipe·Swagger 등 공식 생태계가 갖춰져 있습니다.
- Prisma: 스키마 파일 하나로 모델·마이그레이션·타입이 생성되어 DB 스키마와 코드 타입이 어긋나지 않습니다.
- PostgreSQL: 관계형 데이터 무결성(FK, 트랜잭션, 제약조건)을 보장하는 검증된 RDBMS입니다.

## 품질 관리

- Vitest: FE/BE 동일한 테스트 러너 사용.
- oxlint + ESLint: oxlint로 빠른 기본 검사, ESLint로 Vue 전용 규칙 검사.
- husky + commitlint + lint-staged: 커밋 단계에서 컨벤션과 포맷을 강제합니다.
- GitHub Actions: PR마다 lint/typecheck/test/build/e2e/Docker 빌드를 검증합니다.

## 인프라 — Docker Compose

- 평가 환경에서 Node.js/pnpm 버전 차이 없이 `docker compose up` 한 번으로 실행되도록 했습니다.
- 운영 배포는 과제 범위에 포함되지 않아, 로컬에서 그대로 재현되는 것을 우선했습니다.
