# 개발 컨벤션

## 브랜치 전략 (Git Flow)

| 브랜치                            | 용도                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| `main`                            | 배포 브랜치. `dev`에서 릴리스 PR로만 병합                  |
| `dev`                             | 개발 통합 브랜치 (**기본 브랜치**)                         |
| `feat/#이슈번호-설명`             | 기능 개발 (`dev`에서 분기)                                 |
| `fix/#이슈번호-설명`              | 버그 수정 (`dev`에서 분기)                                 |
| `refactor/…`, `chore/…`, `docs/…` | 그 외 작업 (`dev`에서 분기)                                |
| `hotfix/#이슈번호-설명`           | 배포 긴급 수정 (`main`에서 분기 → `main`, `dev` 모두 반영) |

예시: `feat/#3-login-api`, `fix/#12-cart-total`

### 작업 흐름

1. 이슈 생성 (템플릿 사용)
2. `dev`에서 작업 브랜치 생성
3. 커밋 컨벤션에 맞춰 커밋
4. `dev`로 PR 생성 → 본문에 `close #이슈번호`
5. `feat/*` → `dev`: **Squash and merge**
6. `dev` → `main`: **Create a merge commit** (릴리스)

## 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 따르며, `commitlint`가 커밋 시 자동으로 검사합니다.

```
<type>(<scope>): <subject>

<body>  # 선택

<footer>  # 선택 (예: close #3)
```

| type           | 설명                                 |
| -------------- | ------------------------------------ |
| `feat`         | 새로운 기능                          |
| `fix`          | 버그 수정                            |
| `refactor`     | 동작 변화 없는 코드 개선             |
| `style`        | 포맷팅, 세미콜론 등 (로직 변화 없음) |
| `design`       | UI/CSS 변경                          |
| `docs`         | 문서                                 |
| `test`         | 테스트 추가/수정                     |
| `chore`        | 설정, 패키지 등 기타 작업            |
| `build` / `ci` | 빌드, CI 설정                        |
| `perf`         | 성능 개선                            |
| `revert`       | 커밋 되돌리기                        |

- **scope**: `web`, `api`, `shared`, `infra`, `deps`, `config` (선택)
- **subject**: 한글로 간결하게, 마침표 없이, 100자 이내

예시

```
feat(api): 상품 목록 조회 API 추가
fix(web): 장바구니 수량 변경 시 합계가 갱신되지 않는 문제 수정
chore(deps): axios 버전 업데이트
```

## Git Hooks

`pnpm install` 시 husky가 자동 설치됩니다.

- **pre-commit**: `lint-staged`로 staged 파일에 Prettier 적용
- **commit-msg**: `commitlint`로 커밋 메시지 검사

## 코드 컨벤션

### 공통

- 포맷은 루트 `.prettierrc`를 따릅니다 (single quote, semicolon, printWidth 100).
- FE/BE가 함께 쓰는 타입(API 요청/응답)은 `packages/shared`에 정의하고 양쪽에서 import 합니다.
- PR 전 `pnpm lint && pnpm typecheck && pnpm test`를 통과시킵니다.

### 네이밍

| 대상                     | 규칙                     | 예시                                             |
| ------------------------ | ------------------------ | ------------------------------------------------ |
| 변수, 함수               | camelCase                | `fetchProducts`                                  |
| 클래스, 타입, 인터페이스 | PascalCase               | `ProductService`, `ApiResponse`                  |
| 상수                     | UPPER_SNAKE_CASE         | `MAX_PAGE_SIZE`                                  |
| Vue 컴포넌트 파일        | PascalCase               | `ProductCard.vue`                                |
| Nest 파일                | kebab-case + 역할 접미사 | `product.controller.ts`, `create-product.dto.ts` |
| boolean                  | `is`/`has`/`can` 접두사  | `isLoading`                                      |

### Frontend (`apps/web`)

- `<script setup lang="ts">` + Composition API 사용
- 페이지는 `src/views`, 재사용 컴포넌트는 `src/components`
- API 호출은 `src/api`에 모으고 컴포넌트에서 axios를 직접 쓰지 않습니다.
- 전역 상태는 Pinia store(`src/stores`), 지역 상태는 컴포넌트 내부 `ref`

### Backend (`apps/api`)

- 도메인 단위 모듈 구성: `src/<domain>/{*.module,*.controller,*.service}.ts`, `dto/`
- Controller는 요청/응답만, 비즈니스 로직은 Service에 둡니다.
- 요청 DTO는 `class-validator`로 검증하고 Swagger 데코레이터를 붙입니다.
- DB 접근은 `PrismaService`를 통해서만 합니다. 스키마 변경 시 마이그레이션 파일을 함께 커밋합니다.
- ESM 프로젝트이므로 상대 경로 import는 `.js` 확장자를 붙입니다.
