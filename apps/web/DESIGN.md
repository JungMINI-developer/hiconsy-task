---
name: 자습실 예약 (TDS-inspired)
description: 자습실 방문 예약 서비스의 시각 시스템. 토스 디자인 시스템(TDS Mobile)의 공개 팔레트·타입 스케일·버튼 모양을 참고했고, WCAG 2.2 AA를 지키기 위해 일부 값을 한 단계 진하게 옮겼다. 값의 출처는 src/styles/main.css(@theme)와 src/components/ui/variants.ts이며, 둘이 다르면 코드가 기준이다.
reference: TDS Mobile Colors·Typography·Button (tossmini-docs.toss.im), 토스 브랜드 요소(로고·이름·Toss Product Sans)는 쓰지 않음
colors:
  canvas: '#f2f4f6' # grey100 — 페이지 바탕
  surface: '#ffffff' # 카드·다이얼로그
  sunken: '#f2f4f6' # 흰 면 안의 트랙·스켈레톤
  line: '#e5e8eb' # grey200 — 구분선
  line-strong: '#d1d6db' # grey300
  line-input: '#8b95a1' # grey500 — 입력 테두리 (3.04:1)
  fg: '#191f28' # grey900
  fg-muted: '#4e5968' # grey700 — 보조 텍스트 (TDS muted grey500 대신)
  fg-subtle: '#6b7684' # grey600 — 흰 면 위 placeholder만
  accent: '#1b64da' # blue700 — 채움 버튼·링크 (TDS primary blue500 대신)
  accent-hover: '#1957c2' # blue800
  accent-fg: '#ffffff'
  accent-weak: '#e8f3ff' # blue50 — weak 버튼·내 신청 배지 바탕
  focus: '#1b64da'
  status-open: '#027648' # green900
  status-warn: '#fe9800' # orange500 — 정원 막대 채움 전용 (글자로 쓰지 않음)
  status-full: '#d22030' # red700
  status-applied: '#1b64da' # blue700
  status-canceled: '#4e5968' # grey700
  status-ended: '#4e5968' # grey700
  status-danger: '#d22030' # red700
  grey50: '#f9fafb'
  grey100: '#f2f4f6'
  grey200: '#e5e8eb'
  grey300: '#d1d6db'
  grey400: '#b0b8c1'
  grey500: '#8b95a1'
  grey600: '#6b7684'
  grey700: '#4e5968'
  grey800: '#333d4b'
  grey900: '#191f28'
  blue50: '#e8f3ff'
  blue100: '#c9e2ff'
  blue500: '#3182f6'
  blue600: '#2272eb'
  blue700: '#1b64da'
  blue800: '#1957c2'
  red50: '#ffeeee'
  red700: '#d22030'
  red800: '#bc1b2a'
  orange50: '#fff3e0'
  orange500: '#fe9800'
  green50: '#f0faf6'
  green500: '#03b26c'
  green900: '#027648'
typography:
  title:
    token: t2
    fontSize: 26px
    lineHeight: 35px
    fontWeight: 700
    use: 페이지 h1
  heading:
    token: t5
    fontSize: 17px
    lineHeight: 25.5px
    fontWeight: 600
    use: 카드 제목, 다이얼로그 제목
  body:
    token: st10
    fontSize: 16px
    lineHeight: 24px
    fontWeight: 400
    use: 본문, 입력값
  label:
    token: t6
    fontSize: 15px
    lineHeight: 22.5px
    fontWeight: 600
    use: 버튼, 폼 라벨, 탭, 메뉴
  caption:
    token: t7
    fontSize: 13px
    lineHeight: 19.5px
    fontWeight: 400
    use: 힌트, 에러, 타임스탬프, 배지
  fontFamily: Pretendard Variable, Pretendard, system-ui, sans-serif
rounded:
  sm: 8px # 작은 버튼, 배지, 메뉴 항목
  md: 10px # 중간 버튼, 입력
  lg: 14px # 큰 버튼, 팝오버, 토스트
  xl: 16px # 카드, 다이얼로그
  full: 9999px
spacing:
  base: 4px
  card-padding: 16px (모바일) / 20px
  card-gap: 12px
  field-gap: 20px
components:
  button:
    sizes: sm 32px / r8 · md 40px / r10 · lg 48px / r14 · icon 36px
    variants: primary(fill) · weak · secondary(weak grey) · light(흰색, 회색 바탕 위) · ghost · danger(fill) · danger-weak
    pressed: scale(0.96)
    focus: 2px blue700 outline, offset 2px
    states: hover(한 단계 진하게) · pressed · loading(스피너 + aria-busy, 라벨 유지) · disabled(opacity 0.4)
  badge:
    style: weak (연한 바탕 + 진한 글자)
    tones: open · full · applied · canceled · ended · neutral
  text-field:
    height: 44px
    border: 1px line-input, hover grey600, focus accent, error status-danger
  card:
    background: surface
    rounded: 16px
    border: none
  dialog:
    rounded: 16px
    footer: 동일 폭 lg 버튼 2개 (닫기 secondary + 주요 동작)
  toast:
    background: grey800
    text: white
    rounded: 14px
fonts:
  roles:
    sans: Pretendard Variable
  note: TDS의 브랜드 서체 Toss Product Sans는 재배포 권리가 확인되지 않아 쓰지 않고, TDS 레퍼런스가 한글 대체 서체로 제시한 Pretendard Variable을 npm으로 self-host한다
---

# 자습실 예약 디자인 시스템 (TDS-inspired)

## Overview

### Visual Theme & Atmosphere

학원 강사와 학생이 매일 여는 업무 도구입니다. "내가 명단에 있는지", "자리가 몇 개 남았는지"를 한눈에 답하는 것이 목표라서, 토스 디자인 시스템(TDS Mobile)의 **회색 바탕 위 흰 면**, **분명한 파란 행동색**, **큰 터치 버튼**, **짧은 해요체**를 참고했습니다.

이 문서는 토스의 디자인 시스템이 아니라, TDS 공개 문서의 값을 **참고해 이 프로젝트에 맞게 옮긴** 시스템입니다. 토스 로고·이름·브랜드 서체는 쓰지 않습니다.

**Key Characteristics:**

- 회색 바탕 `#f2f4f6` 위에 테두리 없는 흰 카드 (radius 16px) — 테두리 대신 면으로 구분
- 채움 버튼은 `#1b64da`(blue700) — TDS primary `#3182f6` 위 흰 글자는 3.71:1이라 AA를 넘도록 한 단계 진하게
- 인라인 동작은 weak 버튼(`#e8f3ff` 바탕 + `#1b64da` 글자), 다이얼로그 하단은 동일 폭 큰 버튼 2개
- 누름 피드백은 색이 아니라 크기(scale 0.96)
- 상태는 항상 텍스트로도 전달 (배지 라벨, `7 / 10명`)

### Primary tasks

- 강사: 자습실을 열고(최대 인원·운영 기간), 정원과 신청 현황을 확인하고, 이력을 본다
- 학생: 남은 자리를 보고 방문 시간을 골라 신청하고, 내 신청 상태를 확인하고, 시간을 바꾸거나 취소한다

### Principles

1. **상태가 먼저 보인다.** 정원과 내 신청 여부는 목록 카드에서 바로 보인다.
2. **규칙은 입력 단계에서 막는다.** 운영 기간 밖·지난 시각은 선택지에 아예 없다.
3. **되돌릴 수 없는 일만 확인을 받는다.** 취소·삭제만 확인 다이얼로그.
4. **파랑은 행동에만.** 채움 파랑은 화면당 주요 동작 하나, 나머지는 weak 또는 무채색.
5. **접근성이 레퍼런스보다 우선한다.** 레퍼런스 값이 AA에 못 미치면 같은 스케일 안에서 진한 단계로 옮긴다.

## Colors

### 역할

| 역할                    | 값        | 스케일    | 쓰는 곳                                      |
| ----------------------- | --------- | --------- | -------------------------------------------- |
| canvas                  | `#f2f4f6` | grey100   | 페이지 바탕                                  |
| surface                 | `#ffffff` | —         | 카드, 다이얼로그, 헤더, 입력                 |
| fg                      | `#191f28` | grey900   | 본문, 제목                                   |
| fg-muted                | `#4e5968` | grey700   | 보조 텍스트 (회색 바탕 위에서도 6.45:1)      |
| fg-subtle               | `#6b7684` | grey600   | placeholder (흰 면 위에서만, 4.62:1)         |
| accent                  | `#1b64da` | blue700   | 채움 버튼, 링크, 포커스 링, 선택된 역할 카드 |
| accent-weak             | `#e8f3ff` | blue50    | weak 버튼, 신청함 배지, 변경 항목 강조       |
| line-input              | `#8b95a1` | grey500   | 입력 테두리 (3.04:1)                         |
| status-open             | `#027648` | green900  | 운영 중 배지, 정원 막대                      |
| status-warn             | `#fe9800` | orange500 | 정원 80% 이상 막대 (글자로 쓰지 않음)        |
| status-full · danger    | `#d22030` | red700    | 정원 마감 배지, 삭제·에러                    |
| status-canceled · ended | `#4e5968` | grey700   | 취소됨·지난 방문 배지                        |

### 레퍼런스에서 옮긴 값

| 레퍼런스 역할          | TDS 값               | 대비 | 이 프로젝트       | 대비 |
| ---------------------- | -------------------- | ---- | ----------------- | ---- |
| primary 채움 (흰 글자) | `#3182f6` blue500    | 3.71 | `#1b64da` blue700 | 5.41 |
| muted 텍스트           | `#8b95a1` grey500    | 3.04 | `#4e5968` grey700 | 7.11 |
| danger                 | `#e42939` red600     | 4.49 | `#d22030` red700  | 5.26 |
| weak hover 글자        | `#1b64da` on blue100 | 4.07 | `#1957c2` blue800 | 4.96 |

### 측정한 대비 (WCAG 2.2 AA)

| 조합                                               |               대비 | 기준 |
| -------------------------------------------------- | -----------------: | ---: |
| fg / surface · canvas                              |      16.56 / 15.02 |  4.5 |
| fg-muted / surface · canvas · grey50               | 7.11 / 6.45 / 6.81 |  4.5 |
| fg-subtle / surface (placeholder)                  |               4.62 |  4.5 |
| accent 글자 / surface · canvas                     |        5.41 / 4.91 |  4.5 |
| 흰 글자 / accent · accent-hover                    |        5.41 / 6.60 |  4.5 |
| accent / blue50 (weak 버튼, 신청함 배지)           |               4.82 |  4.5 |
| blue800 / blue100 (weak hover)                     |               4.96 |  4.5 |
| grey700 / grey100 · grey200 (secondary, 중립 배지) |        6.45 / 5.78 |  4.5 |
| green900 / green50 (운영 중 배지)                  |               5.35 |  4.5 |
| red700 / red50 (마감 배지, danger-weak)            |               4.69 |  4.5 |
| 흰 글자 / red700 · red800 (삭제)                   |        5.26 / 6.31 |  4.5 |
| 흰 글자 / grey800 (토스트)                         |              11.00 |  4.5 |
| line-input / surface                               |               3.04 |    3 |
| focus / canvas                                     |               4.91 |    3 |

## Typography

TDS 타입 스케일에서 다섯 단계만 골라 용도 이름으로 씁니다. Tailwind 기본 크기(`text-sm` 등)는 지웠습니다.

| 클래스         | TDS 토큰 | 크기 / 줄간격 | 굵기 | 쓰는 곳                      |
| -------------- | -------- | ------------- | ---: | ---------------------------- |
| `text-title`   | t2       | 26 / 35       |  700 | 페이지 h1                    |
| `text-heading` | t5       | 17 / 25.5     |  600 | 카드·다이얼로그 제목         |
| `text-body`    | st10     | 16 / 24       |  400 | 본문, 입력값                 |
| `text-label`   | t6       | 15 / 22.5     |  600 | 버튼, 폼 라벨, 탭            |
| `text-caption` | t7       | 13 / 19.5     |  400 | 힌트, 에러, 타임스탬프, 배지 |

- 서체: Pretendard Variable (TDS가 Toss Product Sans의 한글 대체 서체로 측정해 제시한 서체). 브랜드 서체는 쓰지 않습니다.
- 숫자(시간·인원)는 `tabular-nums`.
- TDS 굵기는 숫자로 공개되어 있지 않아 굵기 값은 이 프로젝트가 정한 값입니다.

## Layout

| 항목           | 값                                                 |
| -------------- | -------------------------------------------------- |
| 본문 폭        | `max-w-content` 960px, 좌우 16px(모바일) / 24px    |
| 카드           | 1열, 1024px 이상 2열, 사이 12px, 안쪽 16px / 20px  |
| 다이얼로그     | 폭 448px, 최대 높이 화면 - 32px, 안쪽 24px         |
| 브레이크포인트 | `sm` 640px(헤더 축약·표 열), `lg` 1024px(카드 2열) |
| 헤더           | 흰 면 56px, 아래 1px grey200                       |

## Elevation & Depth

면의 높낮이는 **색**으로 만듭니다(grey100 바탕 → 흰 카드). 그림자는 떠 있는 요소(다이얼로그·드롭다운·셀렉트·토스트)에만 `shadow-overlay` 하나를 씁니다. TDS에는 공개된 그림자 값이 없으므로 이 값은 **이 프로젝트의 확장 값**입니다.

## Motion & Easing

TDS는 숫자로 된 duration·easing을 공개하지 않습니다. 아래 값은 모두 **이 프로젝트의 확장 값**입니다.

| 항목           | 값                                                    |
| -------------- | ----------------------------------------------------- |
| 이징           | `cubic-bezier(0.2, 0, 0, 1)`                          |
| 상태 변화      | 120ms (색·크기)                                       |
| 다이얼로그     | 진입 200ms(살짝 위로 + 페이드), 퇴장 120ms            |
| 누름           | scale 0.96 (역할 카드 0.98)                           |
| 변경 항목 강조 | blue50 → 투명, 1.2s                                   |
| 줄인 모션      | `prefers-reduced-motion`에서 모든 애니메이션·전환 1ms |

## Components

### Button (`AppButton`, `buttonVariants`)

| 변형                     | 모양                                   | 쓰는 곳                                                                       |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------------------- |
| `primary` (fill)         | blue700 바탕 + 흰 글자                 | 화면당 주요 동작 (새 자습실, 신청하기, 저장)                                  |
| `weak`                   | blue50 바탕 + blue700 글자             | 카드 안 인라인 동작 (방문 신청, 다시 신청)                                    |
| `secondary`              | grey100 바탕 + grey700 글자            | 흰 면 위 보조 동작 (닫기, 시간 변경, 다시 시도)                               |
| `light`                  | 흰 바탕 + grey700 글자                 | 회색 바탕 위 보조 동작 (상세의 수정) — secondary는 grey100 위에서 보이지 않음 |
| `ghost`                  | 바탕 없음                              | 아이콘 버튼, 덜 중요한 링크                                                   |
| `danger` / `danger-weak` | red700 채움 / red50 바탕 + red700 글자 | 삭제 확인 / 삭제·취소 진입                                                    |

| 크기   | 높이 / 모서리 | 쓰는 곳                               |
| ------ | ------------- | ------------------------------------- |
| `sm`   | 32px / 8px    | 카드 안 동작                          |
| `md`   | 40px / 10px   | 페이지 상단 동작                      |
| `lg`   | 48px / 14px   | 다이얼로그 하단, 역할 선택 [들어가기] |
| `icon` | 36px / 10px   | `⋯` 메뉴                              |

상태: hover(한 단계 진하게) · pressed(scale 0.96) · loading(스피너 + `aria-busy`, 라벨·폭 유지) · disabled(opacity 0.4, 이유는 버튼 옆 텍스트) · focus(2px blue700 outline).

### Badge (`AppBadge`)

weak 스타일 하나만 씁니다: 같은 색 계열의 50 바탕 + 진한 글자, 모서리 8px, caption 600. 상태 표시일 뿐 누를 수 없습니다.

### Text Field (`AppInput`, `AppSelect`, `AppNumberField`)

높이 44px, 모서리 10px, 1px grey500 테두리. hover grey600, focus blue700, 에러 red700(`aria-invalid`). 에러 문구는 필드 아래 caption으로 두고 `aria-describedby`로 연결합니다.

### Card (`cardClass`, `StudyRoomCard`)

흰 면 + 모서리 16px + 테두리 없음. 카드 전체가 링크일 때는 제목 링크가 `after:inset-0`으로 덮고, hover 시 grey50.

### Dialog (`AppDialog`, `ConfirmDialog`)

모서리 16px, 그림자 하나. 열리면 첫 입력으로 포커스, 하단은 [닫기](secondary) + 주요 동작을 동일 폭 lg 버튼으로. 확인 다이얼로그의 기본 포커스는 [닫기].

### Toast (`AppToaster`)

grey800 바탕 + 흰 글자, 모서리 14px. **화면 가운데 아래**(본문과 같은 축)에 최대 폭 512px로 뜨고, 여러 개가 오면 새 알림이 아래로 쌓여 모두 보입니다(4초 후 사라짐, 아래로 밀어 닫기). 성공은 green500 아이콘, 에러는 assertive로 읽힙니다.

### Tabs · Capacity · Timeline

- 탭: 밑줄형, 활성은 grey900 글자 + 2px 밑줄. 개수는 데이터를 불러온 뒤에만 표시.
- 정원 막대(`CapacityBar`): 8px 높이 트랙(grey100), 숫자 항상 병기, `role="meter"`.
  - 강사: **신청 인원**만큼 찹니다. 80% 이상 orange500, 100% red700.
  - 학생: **남은 자리**만큼 찹니다(라벨 "남은 자리 n"과 같은 방향). 남은 자리가 20% 이하면 orange500, 0이면 빈 막대 + red700 글자.
- 이력(`HistoryTimeline`): 동작을 배지로 표시 — 신청 applied(파랑), 시간 변경 neutral, 취소 canceled, 자동 취소 full(빨강). 시간 변경은 `<del>이전</del> → 이후`.

### States

| 컴포넌트   | 상태                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Button     | 7 변형 × 4 크기, hover · pressed · loading · disabled · focus                                                 |
| Text Field | default · hover · focus · error · disabled                                                                    |
| Badge      | open · full · applied · canceled · ended · neutral                                                            |
| 화면 영역  | loading(300ms 후 스켈레톤) · empty(이유 + 행동 1개) · error(실패 영역만 + 다시 시도) · success(토스트 + 강조) |

## Do's and Don'ts

### Do

- 채움 파랑은 화면당 주요 동작 하나에만 쓰고, 카드 안 동작은 weak으로.
- 회색 바탕 위의 보조 버튼은 `light`, 흰 면 위의 보조 버튼은 `secondary`.
- 새 색이 필요하면 스케일에서 고르고, 글자로 쓸 때는 대비를 재서 이 문서에 남긴다.
- 상태는 색 + 텍스트로 함께 전달한다.

### Don't

- TDS primary `#3182f6`를 흰 글자 바탕으로 쓰지 않는다 (3.71:1).
- grey500을 글자색으로 쓰지 않는다 (흰 바탕 3.04:1). 테두리 전용.
- orange 계열을 글자색으로 쓰지 않는다 (orange900도 흰 바탕 3.73:1).
- 카드에 테두리와 그림자를 함께 두지 않는다. 카드는 면, 그림자는 떠 있는 요소만.
- 토스 로고·이름·Toss Product Sans를 쓰지 않는다.
- 임의 값(`bg-[#…]`, `p-[13px]`)을 쓰지 않는다. 필요하면 토큰을 추가한다.

## Voice & Tone

해요체, 짧고 구체적으로. 시스템 관점이 아니라 사용자 관점("방문을 신청했어요"). 에러는 무엇이 문제인지 + 어떻게 하면 되는지를 한 문장에. 느낌표·이모지는 쓰지 않습니다. 자세한 문구는 [docs/ux-writing.md](./docs/ux-writing.md).

## CJK Typesetting

- `word-break: keep-all` — 한글을 음절이 아니라 띄어쓰기 단위로 줄바꿈 ("주말 특/강" 방지). 긴 단어는 `overflow-wrap: anywhere`로만 끊습니다.
- 제목은 `text-wrap: balance`, 문단·목록은 `text-wrap: pretty` (문장 끝 한 글자가 떨어지는 것 방지).
- 구간 구분자는 앞뒤 공백이 있는 en dash(`18:00 – 20:00`).
- 어제·오늘·내일은 날짜 대신 상대 표기(`오늘 20:00 – 22:00`).
- `scrollbar-gutter: stable` — 목록이 길어져 스크롤바가 생겨도 본문이 좌우로 흔들리지 않습니다.

## Agent Prompt Guide

- "카드 안 보조 동작 버튼을 만들어 줘" → `<AppButton variant="weak" size="sm">` 또는 흰 면 위면 `secondary`.
- "다이얼로그 하단 버튼" → `<AppButton variant="secondary" size="lg" class="flex-1">닫기</AppButton>` + `<AppButton size="lg" class="flex-1">`.
- "새 상태 배지" → `badgeVariants`에 tone을 추가하고, 글자/바탕 대비를 재서 위 표에 넣는다.
- 레퍼런스에 없는 값은 "이 프로젝트의 확장 값"으로 표시한다.

## Governance

### 검증 (#23)

| 항목      | 방법                                     | 결과                                                        |
| --------- | ---------------------------------------- | ----------------------------------------------------------- |
| 색 대비   | 사용 중인 25개 조합 계산                 | 전부 통과 (weak hover 1건 수정)                             |
| 슬롭 패턴 | `impeccable detect` (소스, `/` 1280·320) | 0건                                                         |
| 320px     | 모든 화면을 320px 폭으로 확인            | 가로 스크롤 없음. 자습실 폼 날짜 잘림·제목 음절 줄바꿈 수정 |
| 테스트    | lint · typecheck · test(41) · build      | 통과                                                        |

### Known Gaps

- VoiceOver로 신청·취소 흐름을 확인하지 않았습니다.
- 다크 모드는 토큰 구조(`@custom-variant dark`)만 열어 두었습니다.
- 그림자·모션 값은 TDS 근거가 없는 확장 값입니다.
- TDS 버튼 문서의 포커스 링(연한 파랑 2겹)은 바탕 대비 3:1에 못 미쳐 쓰지 않고, blue700 2px outline을 씁니다.
