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
    exceptions/           # DomainException (도메인 에러 코드)
    filters/              # 모든 예외 → ApiError 포맷
    interceptors/         # 반환값 → ApiSuccess 포맷
  prisma/                 # PrismaService (Global)
  study-rooms/            # 자습실 (controller, service, dto, mapper, 행 락)
  students/               # 학생 (전화번호 정규화 포함)
  visits/                 # 방문 신청·수정·취소, 내 신청 목록, 시스템 자동 취소
test/                     # e2e (테스트 전용 DB, 테스트마다 테이블 초기화)
prisma/
  schema.prisma
  migrations/
  seed.ts
```

요청 흐름: `Controller → Service → PrismaService → PostgreSQL`
컨트롤러는 데이터만 반환하고, 응답 포맷팅은 Interceptor·Filter가 전담합니다.

#### 에러 처리

- 입력값 검증 실패: `400 BAD_REQUEST`, 사유는 `error.details`
- 도메인 규칙 위반: `DomainException`으로 던지며 `error.code`에 도메인 에러 코드를 담는다
  (코드 목록: `packages/shared/src/error-code.ts`). FE는 `code`로 분기하고 `message`는 그대로 보여줄 수 있다.

#### 시간 처리

| 구간     | 형식                                                                    |
| -------- | ----------------------------------------------------------------------- |
| DB       | `timestamptz` — 시점(instant)을 UTC 기준으로 저장                       |
| API 응답 | **KST 오프셋 ISO 8601** (예: `2026-11-15T19:00:00.000+09:00`)           |
| API 요청 | 오프셋이 있는 ISO 8601이면 무엇이든 허용 (`+09:00`, `Z` 모두 같은 시점) |

- 서비스 사용자가 모두 한국에 있으므로 응답을 KST로 맞춰, Swagger·로그에서 바로 읽을 수 있고 FE도 별도 변환 없이 날짜·시각을 표시할 수 있게 했다.
- 오프셋이 붙은 표준 ISO 문자열이라 `new Date()`로 파싱하면 같은 시점이 되므로, 이후 다른 시간대를 지원해야 해도 저장 데이터는 바꿀 필요가 없다.
- 변환은 응답 매퍼에서 `toKstIso()`(`apps/api/src/common/utils/date.ts`)로 일괄 처리한다.

#### API 목록

전체 명세는 Swagger(`/api/docs`)에서 확인할 수 있다.

| Method | Path                                              | 설명                                       | 주요 에러                                                                                                                         |
| ------ | ------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/study-rooms`                                | 자습실 목록 (삭제 제외, 현재 신청 인원)    |                                                                                                                                   |
| POST   | `/api/study-rooms`                                | 자습실 등록                                | 400 `INVALID_PERIOD`                                                                                                              |
| GET    | `/api/study-rooms/:id`                            | 자습실 상세                                | 404 `STUDY_ROOM_NOT_FOUND`                                                                                                        |
| GET    | `/api/study-rooms/:id/histories`                  | 방문 신청·수정·취소 이력 (시간순)          | 404 `STUDY_ROOM_NOT_FOUND`                                                                                                        |
| GET    | `/api/study-rooms/:id/visits`                     | 유효 신청 (학생 연락처 포함, 방문 시작 순) | 404 `STUDY_ROOM_NOT_FOUND`                                                                                                        |
| PATCH  | `/api/study-rooms/:id`                            | 자습실 수정 (보낸 필드만)                  | 409 `CAPACITY_BELOW_CURRENT`, `PERIOD_EXCLUDES_VISITS`                                                                            |
| DELETE | `/api/study-rooms/:id`                            | Soft Delete + 유효 신청 자동 취소 (204)    | 404 `STUDY_ROOM_NOT_FOUND`                                                                                                        |
| GET    | `/api/students`                                   | 학생 목록 (삭제 제외, 이름순)              |                                                                                                                                   |
| POST   | `/api/students`                                   | 학생 등록 (전화번호 정규화)                | 409 `DUPLICATE_PHONE`                                                                                                             |
| GET    | `/api/students/:id`                               | 학생 상세                                  | 404 `STUDENT_NOT_FOUND`                                                                                                           |
| PATCH  | `/api/students/:id`                               | 학생 수정 (보낸 필드만)                    | 404 `STUDENT_NOT_FOUND`, 409 `DUPLICATE_PHONE`                                                                                    |
| DELETE | `/api/students/:id`                               | Soft Delete + 유효 신청 자동 취소 (204)    | 404 `STUDENT_NOT_FOUND`                                                                                                           |
| GET    | `/api/students/:studentId/visits`                 | 내 신청 목록 (취소 포함, 방문 시작 순)     | 404 `STUDENT_NOT_FOUND`                                                                                                           |
| POST   | `/api/students/:studentId/visits`                 | 방문 신청 / 취소 후 재신청                 | 400 `VISIT_IN_PAST`·`VISIT_OUT_OF_PERIOD`, 404 `STUDY_ROOM_NOT_FOUND`, 409 `ALREADY_APPLIED`·`VISIT_TIME_OVERLAP`·`CAPACITY_FULL` |
| PATCH  | `/api/students/:studentId/visits/:visitId`        | 방문 시간 수정                             | 400, 404 `VISIT_NOT_FOUND`, 409 `VISIT_TIME_OVERLAP`·`VISIT_ALREADY_CANCELED`·`VISIT_ALREADY_STARTED`                             |
| POST   | `/api/students/:studentId/visits/:visitId/cancel` | 방문 취소 (정원 복원)                      | 404 `VISIT_NOT_FOUND`, 409 `VISIT_ALREADY_CANCELED`·`VISIT_ALREADY_STARTED`                                                       |

#### 동시성 제어

신청 정보를 바꾸는 모든 작업은 하나의 트랜잭션에서 아래 순서로 락을 잡는다.

| 작업                       | 학생 행             | 자습실 행    |
| -------------------------- | ------------------- | ------------ |
| 방문 신청·재신청·시간 수정 | `FOR NO KEY UPDATE` | `FOR UPDATE` |
| 방문 취소                  | `FOR SHARE`         | `FOR UPDATE` |
| 자습실 수정·삭제           | -                   | `FOR UPDATE` |
| 학생 삭제                  | `FOR UPDATE`        | -            |

- **자습실 행 `FOR UPDATE`** (`lockStudyRoom()`): 같은 자습실의 작업끼리 직렬화된다. "인원 세기 → 저장" 사이에 다른 신청이 끼어들 수 없어 정원이 지켜지고, 정원 축소·기간 변경 검사와 신청이 엇갈리지 않는다. 다른 자습실 작업은 기다리지 않는다.
- **학생 행 락** (`lockStudent()`): 어떤 모드든 학생 삭제(`FOR UPDATE`)와 직렬화되어 "삭제된 학생의 유효 신청"이 생기지 않는다.
  - 신청·시간 수정은 `FOR NO KEY UPDATE`로 **같은 학생의 신청끼리도 직렬화**한다. A·B 자습실에 같은 시간으로 동시에 신청하면 자습실 락이 서로 달라 둘 다 "시간 겹침 검사"를 통과할 수 있기 때문이다 (requirements 9절 #13).
  - `FOR UPDATE`가 아닌 `FOR NO KEY UPDATE`인 이유: 자습실 삭제는 자습실 락을 잡은 채 `visit_histories`에 행을 넣고, 이때 FK 검사가 학생 행에 `FOR KEY SHARE`를 건다. 신청 쪽이 학생 행을 `FOR UPDATE`로 잡고 자습실 락을 기다리면 서로를 기다리는 교착 상태가 된다. `FOR NO KEY UPDATE`는 `FOR KEY SHARE`와 충돌하지 않는다.
  - 취소는 겹침을 만들 수 없으므로 `FOR SHARE`로 충분하다.
- 락은 항상 학생 → 자습실 순서로 잡아 교착 상태를 피한다.

e2e 테스트로 검증한다 (`test/visits.e2e-spec.ts`의 "동시성").

- 정원 3명 자습실에 10명이 동시에 신청하면 정확히 3명만 성공한다. 자습실 락을 빼고 실행하면 10명 전원이 성공해 테스트가 실패하는 것을 확인했다.
- 정원이 1자리 남은 자습실에 20명이 동시에 신청하면 1명만 성공한다. 재신청과 신규 신청이 섞여도 1건만 성공하고, 취소와 신청이 동시에 와도 어느 순서든 정원을 넘지 않는다.
- 같은 학생의 동시 중복 신청은 1건만 성공한다.
- 정원 축소와 신청이 동시에 들어와도 정원을 넘지 않는다.
- 같은 학생이 5개 자습실에 같은 시간으로 동시에 신청하면 1건만 성공한다. 학생 락을 `FOR SHARE`로 낮추면 여러 건이 성공해 테스트가 실패하는 것을 확인했다.
- 시간 수정과 그 자습실 삭제가 동시에 들어와도 교착 상태 없이 처리된다. 학생 락을 `FOR UPDATE`로 올리면 PostgreSQL이 `deadlock detected`로 한쪽을 중단시켜 테스트가 실패하는 것을 확인했다.

문제별 상세(대안 비교, 락 유무 비교 결과, 재현 방법)는 솔루션 문서에 정리했다.

- 정원 마지막 자리 동시 신청, 공정성: [solutions/study-room-capacity-concurrency.md](./solutions/study-room-capacity-concurrency.md)
- 같은 학생의 시간 겹침, 학생 락 모드 선택: [solutions/visit-time-overlap-concurrency.md](./solutions/visit-time-overlap-concurrency.md)

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
