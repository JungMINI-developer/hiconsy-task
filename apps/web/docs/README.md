# Web UI/UX 설계 문서

자습실 방문 예약 서비스의 프론트엔드(UI/UX) 설계 문서입니다. 기준 명세는 [docs/requirements.md](../../../docs/requirements.md), 데이터 모델은 [docs/database.md](../../../docs/database.md)입니다.

## 문서 목록

| 순서 | 문서                                                         | 답하는 질문                                          |
| ---- | ------------------------------------------------------------ | ---------------------------------------------------- |
| 1    | [user-flows.md](./user-flows.md)                             | 누가, 어떤 문제를, 어떤 순서로 해결하는가            |
| 2    | [information-architecture.md](./information-architecture.md) | 어떤 화면이 있고 어떻게 이동하는가 (라우트 맵)       |
| 3    | [screens.md](./screens.md)                                   | 화면마다 무엇을 보여주고, 상태별로 어떻게 보이는가   |
| 4    | [interaction-rules.md](./interaction-rules.md)               | 입력 검증, 에러, 확인, 동시성 충돌을 어떻게 다루는가 |
| 5    | [design-system.md](./design-system.md)                       | 색·타이포·간격 토큰과 컴포넌트 목록                  |
| 6    | [ux-writing.md](./ux-writing.md)                             | 용어, 버튼 라벨, 에러·빈 상태 문구                   |
| 7    | [accessibility.md](./accessibility.md)                       | 어떤 접근성 기준을 지키는가                          |
| 8    | [ui-implementation.md](./ui-implementation.md)               | Vue 코드로 어떻게 옮기는가 (구조·라이브러리·테스트)  |

1~4는 **무엇을** 만들지, 5~8은 **어떻게** 만들지를 다룹니다. 구현 이슈는 화면 단위([screens.md](./screens.md)의 S-xx ID)로 쪼갭니다.

## 설계 원칙

1. **상태가 먼저 보인다.** 현장 문제는 "내가 명단에 있는지 모르겠다", "인원 세는 게 일이다"였다. 정원(`3/10`)과 내 신청 상태는 어느 화면에서든 한눈에 보여야 한다.
2. **규칙은 입력 단계에서 막는다.** 운영 기간 밖, 시작 ≥ 종료, 정원 초과는 서버 에러를 기다리지 않고 폼에서 먼저 안내한다. 서버 검증은 최종 방어선이다.
3. **되돌릴 수 없는 일만 확인을 받는다.** 취소·삭제만 확인 다이얼로그를 띄우고, 신청·수정은 바로 반영한 뒤 결과를 알린다.
4. **업무 도구답게 차분하게.** 강사와 학생이 매일 쓰는 도구다. 장식(그라데이션, 이모지 라벨, 과한 그림자)보다 정보 밀도와 정렬을 우선한다.

## 디자인 → 구현 → 리뷰 워크플로

GitHub에 스타 등록한 UI 관련 오픈소스는 컴포넌트 라이브러리가 아니라 **코딩 에이전트용 디자인 스킬**입니다. 그래서 컴포넌트는 [Reka UI](https://reka-ui.com)(헤드리스) + 자체 CSS 토큰으로 만들고, 스킬은 각 단계의 설계·검토 도구로 씁니다.

| 단계           | 할 일                                   | 사용할 스킬                                                                           | 산출물                                   |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1. 제품 맥락   | 사용자·목표·제약 정리                   | `impeccable init`                                                                     | `apps/web/PRODUCT.md`                    |
| 2. UX 설계     | 흐름·화면·상태를 코드 전에 확정         | `impeccable shape`                                                                    | 1~4번 문서                               |
| 3. 시각 방향   | 톤·타이포·팔레트 결정                   | `frontend-design`, `better-colors`, `better-typography`                               | [design-system.md](./design-system.md)   |
| 4. 기반 구현   | 토큰 CSS, `components/ui` 기본 컴포넌트 | `better-ui`, `state-machine`(컴포넌트 상태 전수 확인)                                 | `src/styles/tokens.css`, `components/ui` |
| 5. 화면 구현   | 화면 단위 이슈로 구현                   | `better-layout`, `better-writing`, `impeccable harden`(에러·엣지), `onboard`(빈 상태) | `views/*`                                |
| 6. 다듬기      | AI 티 제거, 완성도 패스                 | `unslop`, `impeccable polish`                                                         | -                                        |
| 7. 검토        | UX 점수·기술 품질·접근성                | `impeccable critique` / `audit`, `better-accessibility`, `interface-review`(PR)       | PR 본문에 결과 요약                      |
| 8. 디자인 기록 | 실제 구현된 시각 시스템 기록            | `impeccable document`                                                                 | `apps/web/DESIGN.md`                     |

| 스킬 출처                                                                   | 성격                                                                                         |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable)                 | 디자인 명령어 모음(shape, critique, audit, polish 등) + 슬롭 검출기(`npx impeccable detect`) |
| [jakubkrehel/skills](https://github.com/jakubkrehel/skills)                 | 영역별 리뷰·구현 가이드(better-colors/typography/layout/accessibility/writing/ui)            |
| [heydamir/unslop](https://github.com/heydamir/unslop)                       | 완성된 화면에서 AI스러운 패턴을 찾아 패스별로 고치는 스킬                                    |
| [anthropics/skills — frontend-design](https://github.com/anthropics/skills) | 템플릿 기본값을 피하는 미적 방향 설정                                                        |

설치 방법과 구현 규칙은 [ui-implementation.md](./ui-implementation.md#디자인-스킬-설치)에 있습니다.
