# 디자인 시스템

토큰은 `src/styles/tokens.css`의 CSS 변수로 정의하고, 컴포넌트는 토큰만 참조합니다(하드코딩 색·px 금지). 아래 값은 초안이며 `better-colors`로 대비를 검증한 뒤 확정합니다.

## 방향

- **키워드:** 차분함, 정돈, 읽기 쉬움. 학원 게시판의 종이 시간표처럼 정보가 줄 맞춰 놓인 느낌.
- **피할 것:** 보라-파랑 그라데이션, 이모지 라벨, 카드 안의 카드, 아이콘 타일, 회색 배경 위 회색 글자, 모든 요소에 둥근 그림자. (`unslop`, `impeccable detect`가 잡는 패턴)
- **강조색은 한 곳에만:** 주요 행동 버튼과 "내 신청" 표시. 나머지는 무채색 + 상태색.

## 색 토큰

OKLCH로 정의합니다. 라이트 모드만 MVP 범위이고, 다크 모드는 같은 이름의 토큰을 `[data-theme='dark']`에서 재정의하는 구조로 열어 둡니다.

| 토큰                 | 용도                          | 값 (초안)                           |
| -------------------- | ----------------------------- | ----------------------------------- |
| `--color-bg`         | 페이지 배경                   | `oklch(98.5% 0.004 95)`             |
| `--color-surface`    | 카드·다이얼로그               | `oklch(100% 0 0)`                   |
| `--color-border`     | 구분선, 입력 테두리           | `oklch(90% 0.006 95)`               |
| `--color-text`       | 본문                          | `oklch(22% 0.01 260)`               |
| `--color-text-muted` | 보조 텍스트 (대비 4.5:1 이상) | `oklch(48% 0.01 260)`               |
| `--color-accent`     | 주요 버튼, 링크, 내 신청 표시 | `oklch(50% 0.13 250)` (차분한 남색) |
| `--color-accent-fg`  | 강조색 위 글자                | `oklch(99% 0 0)`                    |
| `--color-focus`      | 포커스 링                     | `--color-accent` 기반               |

### 상태색 (의미 토큰)

| 토큰                | 의미                  | 사용처                                    |
| ------------------- | --------------------- | ----------------------------------------- |
| `--status-open`     | 신청 가능 / 운영 중   | 배지, CapacityBar 기본                    |
| `--status-warn`     | 정원 80% 이상         | CapacityBar                               |
| `--status-full`     | 정원 마감             | 배지, CapacityBar 100%                    |
| `--status-applied`  | 신청됨 (내 신청)      | 배지 — `--color-accent`와 같은 계열       |
| `--status-canceled` | 취소됨                | 배지 (무채색 + 취소선 없이 텍스트로 구분) |
| `--status-ended`    | 운영 종료 / 지난 방문 | 배지 (무채색)                             |
| `--status-danger`   | 삭제·에러             | 위험 버튼, 에러 텍스트                    |

이력 타임라인의 이벤트 점 색: 신청 = applied, 변경 = warn, 취소 = canceled, 시스템 처리 = danger 테두리.

**색만으로 상태를 전달하지 않습니다.** 모든 배지에는 텍스트 라벨이 있습니다.

## 타이포그래피

- 서체: **Pretendard Variable** (한글·숫자 가독성, 가변 폰트 1개로 굵기 해결). 폴백 `system-ui`.
- 숫자(시간, 인원)는 `font-variant-numeric: tabular-nums`로 자릿수를 맞춥니다.

| 토큰             | 크기 / 줄간격 | 굵기 | 용도                       |
| ---------------- | ------------- | ---- | -------------------------- |
| `--text-title`   | 24 / 32       | 700  | 페이지 제목                |
| `--text-heading` | 18 / 26       | 600  | 카드 제목, 다이얼로그 제목 |
| `--text-body`    | 15 / 24       | 400  | 본문                       |
| `--text-label`   | 14 / 20       | 500  | 폼 라벨, 버튼              |
| `--text-caption` | 13 / 18       | 400  | 보조 정보, 타임스탬프      |

## 간격·모양

| 토큰                        | 값                             |
| --------------------------- | ------------------------------ |
| `--space-1` ~ `--space-8`   | 4, 8, 12, 16, 20, 24, 32, 48px |
| `--radius-sm` / `md` / `lg` | 4 / 8 / 12px                   |
| `--shadow-overlay`          | 다이얼로그·팝오버에만 사용     |
| `--content-max`             | 960px                          |
| 브레이크포인트              | 640px(sm), 1024px(lg)          |

카드는 그림자 대신 `1px` 테두리로 구분합니다. 그림자는 떠 있는 레이어(다이얼로그, 드롭다운, 토스트)에만 씁니다.

## 모션

- 지속시간 120ms(상태 변화) / 200ms(다이얼로그 진입). easing `cubic-bezier(0.2, 0, 0, 1)`.
- `prefers-reduced-motion: reduce`이면 이동 애니메이션을 끄고 opacity만 남깁니다.

## 컴포넌트 인벤토리

### `components/ui` — 범용 (도메인 모름)

| 컴포넌트                               | 기반                                            | 비고                                                     |
| -------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `AppButton`                            | 자체 (`<button>`)                               | variant: primary / secondary / ghost / danger, `loading` |
| `AppDialog`                            | Reka UI `Dialog`                                | 포커스 트랩, ESC, 스크롤 잠금                            |
| `ConfirmDialog`                        | Reka UI `AlertDialog`                           | 확인/닫기, 기본 포커스는 닫기                            |
| `AppSelect`                            | Reka UI `Select`                                | 학생 선택, 시간 선택                                     |
| `AppNumberField`                       | Reka UI `NumberField`                           | 최대 인원                                                |
| `AppDatePicker`                        | Reka UI `DatePicker`                            | 운영 기간 날짜, 방문 날짜 (min/max 제한)                 |
| `AppTimeField`                         | Reka UI `TimeField` 또는 `AppSelect`(30분 단위) | 방문 시간은 Select가 더 빠름                             |
| `AppTabs`                              | Reka UI `Tabs`                                  | 목록 필터, 상세 탭                                       |
| `AppToast`                             | Reka UI `Toast`                                 | 성공·에러 알림, `aria-live`                              |
| `AppTooltip`                           | Reka UI `Tooltip`                               | 비활성 버튼 이유                                         |
| `AppDropdownMenu`                      | Reka UI `DropdownMenu`                          | 카드 `[⋯]` 메뉴                                          |
| `AppBadge`                             | 자체                                            | 상태 배지                                                |
| `FormField`                            | 자체                                            | label + control + hint/error, id 자동 연결               |
| `Skeleton`, `EmptyState`, `ErrorState` | 자체                                            | 5종 상태 표준화                                          |

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
