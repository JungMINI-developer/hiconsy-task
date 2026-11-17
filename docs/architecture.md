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
| PATCH  | `/api/study-rooms/:id`                            | 자습실 수정 (보낸 필드만)                  | 409 `SEATS_IN_USE`, `PERIOD_EXCLUDES_VISITS`                                                                                      |
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

| 작업                       | 학생 행             | 자습실 행                             |
| -------------------------- | ------------------- | ------------------------------------- |
| 방문 신청·재신청·시간 수정 | `FOR NO KEY UPDATE` | `FOR UPDATE`                          |
| 방문 취소                  | `FOR SHARE`         | `FOR UPDATE`                          |
| 자습실 수정·삭제           | -                   | `FOR UPDATE`                          |
| 학생 삭제                  | `FOR NO KEY UPDATE` | 관련 자습실 전부 `FOR UPDATE` (id 순) |

- **자습실 행 `FOR UPDATE`** (`lockStudyRoom()`): 같은 자습실의 작업끼리 직렬화된다. "인원 세기 → 저장" 사이에 다른 신청이 끼어들 수 없어 정원이 지켜지고, 정원 축소·기간 변경 검사와 신청이 엇갈리지 않는다. 다른 자습실 작업은 기다리지 않는다.
- **학생 행 락** (`lockStudent()`): 어떤 모드든 학생 삭제(`FOR NO KEY UPDATE`)와 직렬화되어 "삭제된 학생의 유효 신청"가 생기지 않는다.
  - 신청·시간 수정은 `FOR NO KEY UPDATE`로 **같은 학생의 신청끼리도 직렬화**한다. A·B 자습실에 같은 시간으로 동시에 신청하면 자습실 락이 서로 달라 둘 다 "시간 겹침 검사"를 통과할 수 있기 때문이다 (requirements 9절 #13).
  - `FOR UPDATE`가 아닌 `FOR NO KEY UPDATE`인 이유: 자습실 삭제는 자습실 락을 잡은 채 `visit_histories`에 행을 넣고, 이때 FK 검사가 학생 행에 `FOR KEY SHARE`를 건다. 신청 쪽이 학생 행을 `FOR UPDATE`로 잡고 자습실 락을 기다리면 서로를 기다리는 교착 상태가 된다. `FOR NO KEY UPDATE`는 `FOR KEY SHARE`와 충돌하지 않는다.
  - 취소는 겹침을 만들 수 없으므로 `FOR SHARE`로 충분하다.
  - 학생 삭제는 학생 행 `FOR NO KEY UPDATE` → 신청한 자습실 행 `FOR UPDATE`(id 순)로 잡는다. 같은 신청을 자동 취소하는 자습실 삭제와 동시에 실행되면, 자습실 락 없이는 "학생 삭제는 이력 FK 검사로 자습실 락을, 자습실 삭제는 신청 행 락을" 기다리는 교착 상태가 된다. 학생 행을 `FOR UPDATE`로 잡아도 자습실 삭제의 FK 검사와 충돌해 교착 상태가 된다 (#36에서 발견, #44에서 대기열을 빼며 다시 확인).
- 락은 항상 학생 → 자습실 순서로 잡아 교착 상태를 피한다.

e2e 테스트로 검증한다 (`test/visits.e2e-spec.ts`의 "동시성").

- 정원 3명 자습실에 10명이 동시에 신청하면 정확히 3명만 성공한다. 자습실 락을 빼고 실행하면 10명 전원이 성공해 테스트가 실패하는 것을 확인했다.
- 정원이 1자리 남은 자습실에 20명이 동시에 신청하면 1명만 성공한다. 남은 자리가 2·3개일 때도 그 수만큼만 성공한다(시연으로 확인). 재신청과 신규 신청이 섞여도 1건만 성공하고, 취소와 신청이 동시에 와도 어느 순서든 정원을 넘지 않는다.
- 같은 학생의 동시 중복 신청은 1건만 성공한다.
- 정원 축소와 신청이 동시에 들어와도 정원을 넘지 않는다.
- 같은 학생이 5개 자습실에 같은 시간으로 동시에 신청하면 1건만 성공한다. 학생 락을 `FOR SHARE`로 낮추면 여러 건이 성공해 테스트가 실패하는 것을 확인했다.
- 시간 수정과 그 자습실 삭제가 동시에 들어와도 교착 상태 없이 처리된다. 학생 락을 `FOR UPDATE`로 올리면 PostgreSQL이 `deadlock detected`로 한쪽을 중단시켜 테스트가 실패하는 것을 확인했다.
- 학생 삭제와 그 학생이 신청한 자습실 삭제가 동시에 들어와도 교착 상태 없이 처리된다. 학생 삭제에서 자습실 락을 빼거나 학생 락을 `FOR UPDATE`로 되돌리면 `deadlock detected`(500)로 실패한다.

문제별 상세(대안 비교, 락 유무 비교 결과, 재현 방법)는 솔루션 문서에 정리했다.

- 정원 마감 직전(남은 자리 1~3) 동시 신청, 공정성: [solutions/study-room-capacity-concurrency.md](./solutions/study-room-capacity-concurrency.md)
- 같은 학생의 시간 겹침, 학생 락 모드 선택: [solutions/visit-time-overlap-concurrency.md](./solutions/visit-time-overlap-concurrency.md)
- 대기열(자리 제안, #44에서 제거한 기능의 기록), 학생 삭제 교착 상태 해소: [solutions/waitlist-offer.md](./solutions/waitlist-offer.md)

### `apps/web` (Vue 3)

```
src/
  main.ts, App.vue
  router/               # 라우트 맵 + 역할 가드 (역할이 맞지 않으면 역할 선택으로)
  api/                  # axios 인스턴스(client: 응답 언래핑·AppError 정규화), 리소스별 호출 함수
  stores/               # Pinia: session(역할·선택한 학생, localStorage), myVisits(내 신청) — 헤더·학생 화면 공유
  views/
    RoleSelectView      # S-00 역할 선택 (로그인 대체)
    teacher/            # S-10 자습실 목록 · S-11 상세(신청자·이력) · S-13 학생 목록
    student/            # S-20 자습실 목록 · S-21 내 신청
  components/
    ui/                 # 도메인을 모르는 공통 UI (Reka UI 래퍼: Dialog, Select, Tabs, Toast …)
    domain/             # 자습실 카드·정원 막대·이력 타임라인, 등록/신청 다이얼로그(S-12·S-22), 정원 마감 안내(S-23)
    layout/             # 헤더, 페이지 틀
  composables/          # useAsync(로딩·에러·늦은 응답 무시), useDialogQuery(다이얼로그 ↔ URL 쿼리),
                        # useFullRoomFallback(정원 마감 시 다른 자습실 안내), useToast …
  utils/                # 순수 함수 — 날짜 표기, 방문 시간 선택지·겹침(visitSlots), 대체 자습실 후보, 에러 문구, 검증
  styles/main.css       # Tailwind v4 @theme 디자인 토큰
e2e/                    # Playwright (데스크톱 1280 + 모바일 320, 전용 DB)
```

- **서버 데이터는 전역 캐시에 두지 않습니다.** 정원은 다른 학생의 신청으로 계속 바뀌므로, 화면 진입·변경 직후·탭 복귀 시 다시 조회합니다(`useAsync` + `useRefetchOnVisible`). 예외는 여러 화면이 같이 보는 "내 신청"(`myVisits`)뿐입니다.
- **다이얼로그 열림 상태는 URL 쿼리**(`?apply=3`, `?edit=5`, 미리 고른 시간 `&slot=`)에 둡니다. 새로고침·뒤로가기·다른 화면에서 이어서 열기가 같은 방식으로 동작합니다.
- **규칙 판단은 서버가 최종**입니다. 화면은 운영 기간 밖·지난 시각·내 신청과 겹치는 시각을 선택지에서 미리 막고(헛걸음 방지), 서버 에러 코드(`ErrorCode`)별로 안내·재조회를 정합니다(`VisitFormDialog`의 `handleError`).
- **비즈니스 계산은 `utils`의 순수 함수**로 빼서 단위 테스트합니다(방문 시간 선택지, 겹침, 대체 자습실 후보, 날짜 표기). 화면 흐름은 Playwright로 검증합니다.

UI는 Reka UI(헤드리스) + Tailwind CSS v4로 구현하고, 디자인 토큰은 `@theme`에 정의합니다. 화면 명세(S-00~S-23), 라우트 맵, 사용자 흐름, 문구 규칙은 [apps/web/docs](../apps/web/docs/README.md)를 참고합니다.
