# UI 구현 가이드

## 라이브러리 선택

| 선택                                      | 이유                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Reka UI** (`reka-ui@2`, 헤드리스)       | 다이얼로그 포커스 트랩, Select 키보드 탐색, DatePicker 등 접근성 구현이 까다로운 부분만 맡긴다. 스타일이 없어 디자인을 직접 통제할 수 있다 |
| **자체 CSS 변수 토큰** + `<style scoped>` | 의존성을 늘리지 않고, 토큰 한 곳만 바꾸면 전체가 따라온다. Tailwind 없이도 화면 수(8개)가 적어 관리 가능                                   |
| `@internationalized/date`                 | Reka UI 날짜 컴포넌트가 요구하는 날짜 타입. 시간대 변환을 이 계층에서만 처리                                                               |
| `pretendard`                              | 한글 UI 서체 (npm으로 받아 self-host)                                                                                                      |

쓰지 않는 것: Tailwind, shadcn-vue, Vuetify/Element Plus(완성형 라이브러리는 기본 테마 인상이 강하고 번들이 큼), 전역 서버 캐시 라이브러리(재조회 전략으로 충분).

```bash
pnpm --filter @hiconsy/web add reka-ui @internationalized/date pretendard
```

## 폴더 구조

```
src/
  styles/
    tokens.css        # design-system.md의 토큰 (CSS 변수)
    base.css          # reset, 서체, :focus-visible, reduced-motion
  components/
    ui/               # 범용 컴포넌트 (Reka UI 래핑 포함) — 도메인 import 금지
    domain/           # StudyRoomCard, CapacityBar, HistoryTimeline ...
    layout/           # AppHeader, RoleSwitcher, PageShell
  views/
    RoleSelectView.vue
    teacher/  TeacherRoomsView.vue  TeacherRoomDetailView.vue  TeacherStudentsView.vue
    student/  StudentRoomsView.vue  StudentVisitsView.vue
  composables/
    useAsync.ts       # { data, error, status, run } — loading/empty/error 표준화
    useStudyRooms.ts  useVisits.ts  useStudents.ts
    useToast.ts
    useDialogQuery.ts # 다이얼로그 상태 ↔ URL 쿼리
  stores/
    session.ts        # 역할, 선택한 학생 (localStorage 동기화)
  api/
    client.ts         # axios 인스턴스 + 에러 정규화 인터셉터
    studyRooms.ts  visits.ts  students.ts
  utils/
    datetime.ts       # 포맷(ux-writing 규칙), ISO ↔ CalendarDateTime 변환
    validation.ts     # 폼 검증 규칙 (BE와 같은 규칙)
```

의존 방향: `views → domain → ui`, `views → composables → api`. `ui`는 아무것도 import하지 않습니다.

## 구현 규칙

### 컴포넌트

- `<script setup lang="ts">`, props/emits는 타입 기반 선언(`defineProps<...>()`).
- Reka UI는 `components/ui`에서만 import하고 래핑합니다. 화면 코드가 Reka UI에 직접 의존하지 않게 해서, 라이브러리를 바꿔도 `ui/`만 고치면 되도록 합니다.
- 스타일은 `<style scoped>` + 토큰 변수. 색·간격 리터럴 금지(리뷰 시 `impeccable detect`로 확인).
- 상태 5종(loading/empty/error/disabled/success)은 `Skeleton`, `EmptyState`, `ErrorState`와 `useAsync`의 `status`로 통일합니다.

### 데이터·에러

- 응답 타입은 `packages/shared`에 도메인 타입(`StudyRoomDto`, `VisitDto`, `VisitHistoryDto`)을 추가해 FE/BE가 공유합니다.
- `src/api/client.ts` 인터셉터에서 `ApiError`를 `AppError { code, message, details, status }`로 정규화합니다. 화면은 `code`로 분기만 합니다([interaction-rules.md](./interaction-rules.md#서버-응답-처리)).
- 날짜는 API 경계에서 ISO 문자열 ↔ `@internationalized/date` 객체로 변환하고, 화면 표시는 `utils/datetime.ts`만 씁니다.

### 라우팅

- `information-architecture.md`의 라우트 맵을 그대로 옮기고, `meta: { role: 'teacher' | 'student', title }`을 둡니다.
- `beforeEach` 가드: 역할 불일치 → `/`. `afterEach`: `document.title` 갱신 + `<h1>` 포커스.
- 화면 컴포넌트는 lazy import(`() => import(...)`).

### 기타

- `index.html`: `lang="ko"`, `<title>자습실 예약</title>`로 수정.

## 테스트

| 대상                                 | 방법                                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| `utils/datetime.ts`, `validation.ts` | Vitest 단위 테스트 (같은 날/다른 날 구간, 경계값)                |
| `domain` 컴포넌트                    | `@vue/test-utils`로 상태별 렌더 (정원 0/80%/100%, 신청함/취소됨) |
| `VisitForm` 선택지 생성              | 운영 기간·현재 시각에 따라 선택지가 제한되는지                   |
| 라우터 가드                          | 역할 없이 접근 시 `/`로 이동                                     |
| 세션 스토어                          | localStorage 복원                                                |

## 구현 순서 (이슈 단위)

1. **기반:** 의존성 설치, `tokens.css`/`base.css`, `components/ui` 기본 세트, 레이아웃, 라우터·세션 스토어 (S-00)
2. **강사 MVP:** S-10, S-12, S-11, S-13
3. **학생 MVP:** S-20, S-22, S-21
4. **다듬기:** 빈/에러 상태 점검(`impeccable harden`, `onboard`), `unslop`, `impeccable polish`, 접근성 검토
5. **선택:** FR-STD-02 학생 관리, FR-ROM-06 기존 신청 처리 UI

각 화면 PR에는 스크린샷과 `impeccable critique` 요약(점수, 남은 P2·P3)을 붙입니다.

## 디자인 스킬 설치

스타 등록한 디자인 스킬은 프로젝트 `.claude/skills/`에 설치해 팀(평가자) 누구나 같은 도구로 검토할 수 있게 합니다.

```bash
# 레포 루트에서
npx impeccable install                       # impeccable 스킬 + 디자인 훅
npx skills add jakubkrehel/skills            # better-* 스킬 모음

# unslop, frontend-design은 수동 복사
git clone --depth 1 https://github.com/heydamir/unslop /tmp/unslop
cp -r /tmp/unslop/skills/unslop .claude/skills/
git clone --depth 1 https://github.com/anthropics/skills /tmp/anthropic-skills
cp -r /tmp/anthropic-skills/skills/frontend-design .claude/skills/
```

| 주의할 점                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| impeccable `live` 모드는 로컬 체크아웃 전용이며, Apply 시 권한 우회 플래그로 에이전트를 실행할 수 있다. 쓰지 않거나 `IMPECCABLE_LIVE_COPY_AGENT=chat`으로 제한한다 |
| unslop은 CC BY 4.0 — 저장소에 포함할 경우 출처 표기                                                                                                                |
| 슬롭 검출기는 에이전트 없이도 돌릴 수 있다: `npx impeccable detect apps/web/src`, 개발 서버 대상 `npx impeccable detect http://localhost:5173`                     |
| CI 추가 여부는 기반 구현 후 결정 (`--github` 옵션으로 PR 주석 가능)                                                                                                |

### 사용 예

```
/impeccable init                              # apps/web/PRODUCT.md 생성
/impeccable shape 학생 방문 신청 흐름
/better-colors design-system.md 상태색 대비 확인
/state-machine StudyRoomCard
/impeccable critique 학생 자습실 목록
/unslop 강사 자습실 상세
/interface-review                             # PR 직전
/impeccable document                          # apps/web/DESIGN.md 생성
```
