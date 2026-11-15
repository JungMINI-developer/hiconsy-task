# 디자인 시스템

토큰은 Tailwind CSS v4의 `@theme` 블록(`src/styles/main.css`)에 CSS 변수로 정의합니다. `@theme`에 적은 변수는 그대로 유틸리티 클래스가 됩니다(`--color-accent` → `bg-accent`, `text-accent`, `border-accent`). 컴포넌트는 이 클래스만 쓰고, 임의 값(`bg-[#3a5f8c]`, `p-[13px]`)은 쓰지 않습니다. 아래 값은 초안이며 `better-colors`로 대비를 검증한 뒤 확정합니다.

## 방향

- **키워드:** 차분함, 정돈, 읽기 쉬움. 학원 게시판의 종이 시간표처럼 정보가 줄 맞춰 놓인 느낌.
- **피할 것:** 보라-파랑 그라데이션, 이모지 라벨, 카드 안의 카드, 아이콘 타일, 회색 배경 위 회색 글자, 모든 요소에 둥근 그림자. (`unslop`, `impeccable detect`가 잡는 패턴)
- **Tailwind 기본 팔레트를 쓰지 않습니다.** `bg-blue-500 rounded-lg shadow-md` 같은 기본 조합은 어느 서비스든 비슷해 보이게 만듭니다. `@theme`에서 `--color-*: initial;`로 기본 색을 모두 지우고, 아래 의미 토큰만 남깁니다.
- **강조색은 한 곳에만:** 주요 행동 버튼과 "내 신청" 표시. 나머지는 무채색 + 상태색.

## 색 토큰

OKLCH로 정의합니다. 라이트 모드만 MVP 범위이고, 다크 모드는 `[data-theme='dark']`에서 같은 변수를 재정의하는 구조로 열어 둡니다(`@custom-variant dark`).

이름은 클래스로 읽었을 때 자연스럽게 짓습니다(`text-text`, `border-border`처럼 겹치지 않게).

| `@theme` 변수                                                   | 클래스 예                     | 용도                          | 값 (초안)                           |
| --------------------------------------------------------------- | ----------------------------- | ----------------------------- | ----------------------------------- |
| `--color-canvas`                                                | `bg-canvas`                   | 페이지 배경                   | `oklch(98.5% 0.004 95)`             |
| `--color-surface`                                               | `bg-surface`                  | 카드·다이얼로그               | `oklch(100% 0 0)`                   |
| `--color-line`                                                  | `border-line`, `divide-line`  | 구분선, 입력 테두리           | `oklch(90% 0.006 95)`               |
| `--color-fg`                                                    | `text-fg`                     | 본문                          | `oklch(22% 0.01 260)`               |
| `--color-fg-muted`                                              | `text-fg-muted`               | 보조 텍스트 (대비 4.5:1 이상) | `oklch(48% 0.01 260)`               |
| `--color-accent`                                                | `bg-accent`, `text-accent`    | 주요 버튼, 링크, 내 신청 표시 | `oklch(50% 0.13 250)` (차분한 남색) |
| `--color-accent-fg`                                             | `text-accent-fg`              | 강조색 위 글자                | `oklch(99% 0 0)`                    |
| `--color-focus`                                                 | `ring-focus`, `outline-focus` | 포커스 링                     | `--color-accent`와 같은 값          |
| `--color-white`, `--color-black`, `transparent`, `currentColor` | -                             | 유틸리티용으로 남김           | -                                   |

### 상태색 (의미 토큰)

| `@theme` 변수             | 클래스 예                                  | 의미                  | 사용처                       |
| ------------------------- | ------------------------------------------ | --------------------- | ---------------------------- |
| `--color-status-open`     | `bg-status-open`                           | 신청 가능 / 운영 중   | 배지, CapacityBar 기본       |
| `--color-status-warn`     | `bg-status-warn`                           | 정원 80% 이상         | CapacityBar                  |
| `--color-status-full`     | `bg-status-full`                           | 정원 마감             | 배지, CapacityBar 100%       |
| `--color-status-applied`  | `bg-status-applied/10 text-status-applied` | 신청됨 (내 신청)      | 배지 — accent와 같은 계열    |
| `--color-status-canceled` | `text-status-canceled`                     | 취소됨                | 배지 (무채색, 텍스트로 구분) |
| `--color-status-ended`    | `text-status-ended`                        | 운영 종료 / 지난 방문 | 배지 (무채색)                |
| `--color-status-danger`   | `bg-status-danger`, `text-status-danger`   | 삭제·에러             | 위험 버튼, 에러 텍스트       |

배지 배경은 투명도 수식어(`bg-status-full/10`)로 만들어 별도 연한 색 토큰을 두지 않습니다.

이력 타임라인의 이벤트 점 색: 신청 = applied, 변경 = warn, 취소 = canceled, 시스템 처리 = danger 테두리.

**색만으로 상태를 전달하지 않습니다.** 모든 배지에는 텍스트 라벨이 있습니다.

## 타이포그래피

- 서체: **Pretendard Variable** (한글·숫자 가독성, 가변 폰트 1개로 굵기 해결). `--font-sans`에 지정하고 폴백은 `system-ui`.
- 숫자(시간, 인원)는 `tabular-nums` 클래스로 자릿수를 맞춥니다.
- Tailwind 기본 크기(`text-sm`, `text-lg` 등)는 지우고(`--text-*: initial;`) 용도 이름으로만 씁니다. 줄간격·굵기도 토큰에 함께 묶습니다(`--text-title--line-height`, `--text-title--font-weight`).

| `@theme` 변수    | 클래스         | 크기 / 줄간격 | 굵기 | 용도                       |
| ---------------- | -------------- | ------------- | ---- | -------------------------- |
| `--text-title`   | `text-title`   | 24 / 32       | 700  | 페이지 제목                |
| `--text-heading` | `text-heading` | 18 / 26       | 600  | 카드 제목, 다이얼로그 제목 |
| `--text-body`    | `text-body`    | 15 / 24       | 400  | 본문                       |
| `--text-label`   | `text-label`   | 14 / 20       | 500  | 폼 라벨, 버튼              |
| `--text-caption` | `text-caption` | 13 / 18       | 400  | 보조 정보, 타임스탬프      |

## 간격·모양

| 항목           | Tailwind 설정                                   | 쓰는 값                                               |
| -------------- | ----------------------------------------------- | ----------------------------------------------------- |
| 간격           | 기본 `--spacing: 0.25rem` 유지 (`p-4` = 16px)   | 1, 2, 3, 4, 5, 6, 8, 12 단계만 사용 (4~48px)          |
| 모서리         | `--radius-*: initial;` 후 `sm`/`md`/`lg` 재정의 | `rounded-sm` 4px, `rounded-md` 8px, `rounded-lg` 12px |
| 그림자         | `--shadow-*: initial;` 후 `--shadow-overlay`만  | `shadow-overlay` — 다이얼로그·팝오버·토스트에만       |
| 콘텐츠 최대 폭 | `--container-content: 60rem`                    | `max-w-content` (960px)                               |
| 브레이크포인트 | 기본값 사용                                     | `sm:` 640px, `lg:` 1024px만 사용                      |

카드는 그림자 대신 `border border-line`으로 구분합니다.

## 모션

- `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`, 지속시간 120ms(상태 변화) / 200ms(다이얼로그 진입). 클래스: `transition-colors duration-120 ease-standard`.
- Reka UI가 노출하는 `data-state`로 진입·퇴장을 겁니다: `data-[state=open]:opacity-100 data-[state=closed]:opacity-0`.
- `motion-reduce:` 수식어로 이동 애니메이션을 끄고 opacity만 남깁니다.

## `@theme` 초안

```css
/* src/styles/main.css */
@import 'tailwindcss';
@import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

@theme {
  --color-*: initial;
  --text-*: initial;
  --radius-*: initial;
  --shadow-*: initial;

  --font-sans: 'Pretendard Variable', system-ui, sans-serif;

  --color-white: oklch(100% 0 0);
  --color-black: oklch(0% 0 0);
  --color-canvas: oklch(98.5% 0.004 95);
  --color-surface: oklch(100% 0 0);
  --color-line: oklch(90% 0.006 95);
  --color-fg: oklch(22% 0.01 260);
  --color-fg-muted: oklch(48% 0.01 260);
  --color-accent: oklch(50% 0.13 250);
  --color-accent-fg: oklch(99% 0 0);
  --color-focus: var(--color-accent);
  /* --color-status-*: better-colors로 대비 검증 후 확정 */

  --text-title: 1.5rem;
  --text-title--line-height: 2rem;
  --text-title--font-weight: 700;
  /* heading, body, label, caption 동일 패턴 */

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-overlay: 0 8px 24px oklch(22% 0.01 260 / 0.12);
  --container-content: 60rem;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}

@layer base {
  html {
    @apply bg-canvas font-sans text-body text-fg;
  }
  :focus-visible {
    @apply outline-2 outline-offset-2 outline-focus;
  }
}
```

## 컴포넌트 인벤토리

### `components/ui` — 범용 (도메인 모름)

| 컴포넌트                                  | 기반                                      | 비고                                                                                        |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `AppButton`                               | 자체 (`<button>`) + `cva`                 | variant: primary / secondary / ghost / danger, `loading`                                    |
| `AppDialog`                               | Reka UI `Dialog`                          | 포커스 트랩, ESC, 스크롤 잠금                                                               |
| `ConfirmDialog`                           | Reka UI `AlertDialog`                     | 확인/닫기, 기본 포커스는 닫기                                                               |
| `AppSelect`                               | Reka UI `Select`                          | 학생 선택, 시간 선택                                                                        |
| `AppNumberField`                          | Reka UI `NumberField`                     | 최대 인원                                                                                   |
| 날짜 입력 (`AppInput type="date"`)        | 네이티브 `<input type="date">`            | 운영 기간 날짜. 모바일 기본 피커·키보드 입력을 그대로 쓰기 위해 Reka `DatePicker` 대신 사용 |
| 시각 선택 (`AppSelect`)                   | `AppSelect` (30분 단위 `halfHourSlots()`) | 운영·방문 시각. 선택지를 30분 단위로 제한                                                   |
| `AppTabs`                                 | Reka UI `Tabs`                            | 목록 필터, 상세 탭                                                                          |
| `AppToast`                                | Reka UI `Toast`                           | 성공·에러 알림, `aria-live`                                                                 |
| `AppTooltip`                              | Reka UI `Tooltip`                         | 비활성 버튼 이유                                                                            |
| `AppDropdownMenu`                         | Reka UI `DropdownMenu`                    | 카드 `[⋯]` 메뉴                                                                             |
| `AppBadge`                                | 자체 + `cva`                              | 상태 배지 (tone: open/warn/full/applied/canceled/ended)                                     |
| `FormField`                               | 자체                                      | label + control + hint/error, id 자동 연결                                                  |
| `AppInput`                                | 자체                                      | 텍스트·날짜·검색 입력 (`controlClass` 공용)                                                 |
| `AppAlert`                                | 자체                                      | 폼·다이얼로그 상단 에러 안내 (`role="alert"`)                                               |
| `AppSkeleton`, `EmptyState`, `ErrorState` | 자체                                      | 5종 상태 표준화                                                                             |

### `components/domain` — 도메인 전용

| 컴포넌트           | 화면             | 설명                                               |
| ------------------ | ---------------- | -------------------------------------------------- |
| `StudyRoomCard`    | S-10, S-20       | `variant: 'teacher' \| 'student'`로 정보·액션 분기 |
| `CapacityBar`      | S-10, S-11, S-20 | 신청/정원 막대 + 숫자, 80%·100% 상태색             |
| `PeriodText`       | 전역             | 운영 기간·방문 시간 포맷 (같은 날이면 날짜 생략)   |
| `VisitStatusBadge` | S-20, S-21       | 신청됨·취소됨·지난 방문                            |
| `HistoryTimeline`  | S-11, S-21       | `VisitHistory` 목록 → 시간순 타임라인              |
| `StudyRoomForm`    | S-12             | 등록·수정 공용                                     |
| `VisitForm`        | S-22             | 신청·수정 공용, 운영 기간 기반 선택지 생성         |
| `RoleSwitcher`     | 헤더             | 현재 역할·이름 + 역할 바꾸기                       |
