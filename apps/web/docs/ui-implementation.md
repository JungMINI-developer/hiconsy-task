# UI 구현 가이드

## 라이브러리 선택

| 선택                                                   | 이유                                                                                                                                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reka UI** (`reka-ui@2`, 헤드리스)                    | 다이얼로그 포커스 트랩, Select 키보드 탐색, DatePicker 등 접근성 구현이 까다로운 부분만 맡긴다. 스타일이 없어 디자인을 직접 통제할 수 있다                                                                            |
| **Tailwind CSS v4** (`@tailwindcss/vite`)              | 템플릿 안에서 스타일을 끝내 파일·클래스 이름 고민이 없다. `@theme`에 정한 토큰만 클래스로 나오므로 하드코딩 값이 자연스럽게 줄어든다. Reka UI의 `data-state` 속성에 `data-[state=open]:`으로 바로 스타일을 걸 수 있다 |
| `class-variance-authority` + `tailwind-merge` + `clsx` | 버튼·배지처럼 변형이 많은 컴포넌트의 클래스를 `cva`로 정리하고, `cn()`으로 외부에서 넘긴 클래스와 충돌 없이 합친다                                                                                                    |
| `@internationalized/date`                              | Reka UI 날짜 컴포넌트가 요구하는 날짜 타입. 시간대 변환을 이 계층에서만 처리                                                                                                                                          |
| `pretendard`                                           | 한글 UI 서체 (npm으로 받아 self-host)                                                                                                                                                                                 |
| `lucide-vue-next`                                      | 선 굵기가 일정한 아이콘 세트. 쓰는 아이콘만 번들에 들어간다(트리 셰이킹). 아이콘은 라벨을 보조할 때만 쓰고 `aria-hidden`을 붙인다                                                                                     |
| `prettier-plugin-tailwindcss` (dev)                    | 클래스 순서를 자동 정렬해 리뷰 diff를 줄인다                                                                                                                                                                          |

쓰지 않는 것: shadcn-vue(같은 Reka UI + Tailwind 조합이지만 완성 컴포넌트를 받아오면 기본 테마 인상이 남는다. 구현 참고 자료로만 본다), Vuetify/Element Plus(완성형 라이브러리는 기본 테마 인상이 강하고 번들이 큼), 전역 서버 캐시 라이브러리(재조회 전략으로 충분).

```bash
pnpm --filter @hiconsy/web add reka-ui @internationalized/date pretendard class-variance-authority tailwind-merge clsx lucide-vue-next
pnpm --filter @hiconsy/web add -D tailwindcss @tailwindcss/vite
pnpm add -Dw prettier-plugin-tailwindcss  # 루트 .prettierrc에서 사용
```

```ts
// apps/web/vite.config.ts
import tailwindcss from '@tailwindcss/vite';
// plugins: [vue(), tailwindcss(), ...]
```

```jsonc
// .prettierrc — 루트 설정에 플러그인 추가
{
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./apps/web/src/styles/main.css",
}
```

## 폴더 구조

```
src/
  styles/
    main.css          # @import 'tailwindcss' + @theme 토큰 + @layer base (main.ts에서 import)
  components/
    ui/               # 범용 컴포넌트 (Reka UI 래핑 포함) — 도메인 import 금지
    domain/           # StudyRoomCard, SeatGrid, SeatMapGrid, HistoryTimeline ...
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
    cn.ts             # clsx + tailwind-merge
    datetime.ts       # 포맷(ux-writing 규칙), ISO ↔ CalendarDateTime 변환
    validation.ts     # 폼 검증 규칙 (BE와 같은 규칙)
```

의존 방향: `views → domain → ui`, `views → composables → api`. `ui`는 아무것도 import하지 않습니다.

## 구현 규칙

### 컴포넌트

- `<script setup lang="ts">`, props/emits는 타입 기반 선언(`defineProps<...>()`).
- Reka UI는 `components/ui`에서만 import하고 래핑합니다. 화면 코드가 Reka UI에 직접 의존하지 않게 해서, 라이브러리를 바꿔도 `ui/`만 고치면 되도록 합니다.
- 상태 5종(loading/empty/error/disabled/success)은 `Skeleton`, `EmptyState`, `ErrorState`와 `useAsync`의 `status`로 통일합니다.

### Tailwind 사용 규칙

- **스타일은 템플릿 클래스로 씁니다.** `<style scoped>`는 Tailwind로 표현이 안 되는 경우(복잡한 `@keyframes` 등)에만 쓰고, 그때는 블록 첫 줄에 `@reference "@/styles/main.css";`를 넣어야 `@apply`와 토큰을 쓸 수 있습니다.
- **임의 값 금지.** `bg-[#3a5f8c]`, `p-[13px]`, `text-[15px]` 대신 `@theme` 토큰을 씁니다. 필요한 값이 없으면 토큰을 추가하고 `design-system.md`도 고칩니다. 기본 팔레트를 지웠으므로 `bg-blue-500` 같은 클래스는 아예 만들어지지 않습니다.
- **클래스 이름을 문자열로 조합하지 않습니다.** `` `bg-status-${tone}` ``는 Tailwind가 찾지 못해 CSS가 생성되지 않습니다. 매핑 객체나 `cva` variant로 완성된 클래스 이름을 씁니다.
- **변형이 있는 컴포넌트는 `cva`로 정의합니다.**

  ```ts
  // components/ui/button.variants.ts
  export const buttonVariants = cva(
    'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-label transition-colors duration-120 ease-standard disabled:opacity-50',
    {
      variants: {
        variant: {
          primary: 'bg-accent text-accent-fg hover:bg-accent/90',
          secondary: 'border border-line bg-surface text-fg hover:bg-canvas',
          ghost: 'text-fg hover:bg-canvas',
          danger: 'bg-status-danger text-white hover:bg-status-danger/90',
        },
      },
      defaultVariants: { variant: 'primary' },
    },
  );
  ```

- **외부 클래스는 `cn()`으로 합칩니다.** `ui` 컴포넌트는 `class` prop을 받아 `cn(buttonVariants({ variant }), props.class)`로 합쳐, 사용하는 쪽에서 덮어쓴 클래스가 이기게 합니다.
- **Reka UI 상태는 data 속성으로 스타일링합니다.** `data-[state=open]:`, `data-[highlighted]:`, `data-[disabled]:` 수식어를 씁니다(별도 상태 클래스 토글 불필요).
- **클래스가 너무 길어지면 컴포넌트로 뽑습니다.** 같은 클래스 묶음이 두 곳 이상 반복되면 `@apply`로 감추기보다 `ui`/`domain` 컴포넌트로 만듭니다.

### 데이터·에러

- 요청·응답 타입은 `packages/shared`의 것을 그대로 씁니다(`StudyRoom`, `StudyRoomHistory`, `Student`, `Create*/Update*Request`, `ErrorCode`). 방문 타입은 방문 API 구현 시 같은 위치에 추가됩니다.
- `src/api/client.ts` 인터셉터에서 `ApiError`를 `AppError { code, message, details, status }`로 정규화합니다. 화면은 `code`로 분기만 합니다([interaction-rules.md](./interaction-rules.md#서버-응답-처리)).
- 날짜는 API 경계에서 ISO 문자열 ↔ `@internationalized/date` 객체로 변환하고, 화면 표시는 `utils/datetime.ts`만 씁니다.

### 라우팅

- `information-architecture.md`의 라우트 맵을 그대로 옮기고, `meta: { role: 'teacher' | 'student', title }`을 둡니다.
- `beforeEach` 가드: 역할 불일치 → `/`. `afterEach`: `document.title` 갱신 + `<h1>` 포커스.
- 화면 컴포넌트는 lazy import(`() => import(...)`).

### 기타

- `index.html`: `lang="ko"`, `<title>자습실 예약</title>`로 수정.

## 테스트

| 대상                                 | 방법                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `utils/datetime.ts`, `validation.ts` | Vitest 단위 테스트 (같은 날/다른 날 구간, 경계값)                                         |
| `domain` 컴포넌트                    | `@vue/test-utils`로 상태별 렌더 (좌석 빈/예약됨/고른 좌석, 이력 좌석 변경, 신청함/취소됨) |
| `VisitForm` 선택지 생성              | 운영 기간·현재 시각에 따라 선택지가 제한되는지                                            |
| 라우터 가드                          | 역할 없이 접근 시 `/`로 이동                                                              |
| 세션 스토어                          | localStorage 복원                                                                         |

## 구현 순서 (이슈 단위)

1. **기반:** 의존성 설치, Tailwind 설정과 `main.css`(`@theme` 토큰), `components/ui` 기본 세트, 레이아웃, 라우터·세션 스토어 (S-00)
2. **강사 MVP:** S-10, S-12, S-11, S-13
3. **학생 MVP:** S-20, S-22, S-21
4. **다듬기:** 빈/에러 상태 점검(`impeccable harden`, `onboard`), `unslop`, `impeccable polish`, 접근성 검토
5. **선택:** FR-STD-02 학생 관리, FR-ROM-06 기존 신청 처리 UI

각 화면 PR에는 스크린샷과 `impeccable critique` 요약(점수, 남은 P2·P3)을 붙입니다.

## 디자인 스킬 설치

디자인 스킬은 프로젝트 의존성이 아니라 **개발자의 도구**이므로 레포에 넣지 않고 Claude Code 사용자 전역(`~/.claude/skills`)에 설치합니다. 레포에는 이 문서(어떤 단계에서 어떤 스킬을 쓰는지)만 남깁니다.

```bash
# impeccable — 훅 없이 전역 설치 (훅을 켜면 모든 프로젝트의 파일 수정마다 검사가 돈다)
npx impeccable install --user --providers=claude --no-hooks -y

# jakubkrehel/skills — better-*, interface-review, state-machine 등 14종
npx skills add jakubkrehel/skills -g --skill '*' --agent claude-code --copy -y

# unslop — 수동 복사 (CC BY 4.0)
git clone --depth 1 https://github.com/heydamir/unslop /tmp/unslop
cp -r /tmp/unslop/skills/unslop ~/.claude/skills/

# frontend-design — anthropics/skills 플러그인으로 제공되므로 별도 설치 불필요
```

업데이트: `npx skills update -g`(jakubkrehel), `npx impeccable install --user --providers=claude --no-hooks --force`.

| 주의할 점                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| impeccable `live` 모드는 로컬 체크아웃 전용이며, Apply 시 권한 우회 플래그로 에이전트를 실행할 수 있다. 쓰지 않거나 `IMPECCABLE_LIVE_COPY_AGENT=chat`으로 제한한다 |
| `afk`는 자리를 비운 동안 에이전트가 스스로 개선 작업을 하는 스킬이다. 직접 호출할 때만 동작하며, 이 과제에서는 쓰지 않는다                                         |
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
