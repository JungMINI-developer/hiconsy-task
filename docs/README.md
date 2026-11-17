# 문서 지도

README는 제출 항목별 요약이고, 자세한 설계·근거·검증은 아래 문서에 있습니다.

## 제출 항목별 상세 문서

| README 항목               | 상세 문서                                         | 담고 있는 것                                                                  |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. 프로젝트 실행 방법     | [../README.md](../README.md#1-프로젝트-실행-방법) | Docker·로컬 실행, 테스트, 환경변수 (README에 모두 있음)                       |
| 2. 기술 스택 및 선택 이유 | [tech-stack.md](./tech-stack.md)                  | 영역별 기술·버전과 선택 이유, Prisma로 표현할 수 없는 것을 다룬 방법          |
| 3. 아키텍처 및 컨벤션     | [architecture.md](./architecture.md)              | 인프라, 소스 구조, 응답·에러 규약, 시간 처리, API 목록, 락 순서와 동시성 검증 |
|                           | [../CONTRIBUTING.md](../CONTRIBUTING.md)          | 브랜치 전략, 작업 흐름, 커밋·코드 컨벤션                                      |
| 4. 데이터베이스 스키마    | [database.md](./database.md)                      | ERD, 테이블·enum·상태 흐름, 설계 이유 9가지, 제약·인덱스, 마이그레이션·시드   |
| 5. 고민한 점 / 아쉬운 점  | [retrospective.md](./retrospective.md)            | 개발하며 고민한 점과 아쉬운 점 전체                                           |

## 요구사항과 규칙

| 문서                                 | 담고 있는 것                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| [requirements.md](./requirements.md) | 과제 명세 정리(배경·운영 규칙·FR·필수 엔티티·제출 조건), **9절: 직접 정한 규칙 16개와 근거** |

## 문제 해결 기록 — [solutions/](./solutions/)

문제 → 선택지 → 결정 → 검증(락을 빼면 실패하는지 등) → 재현 방법 순서로 정리했습니다.

| 문서                                                                                 | 다루는 문제                                                                |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [seat-reservation-concurrency.md](./solutions/seat-reservation-concurrency.md)       | 같은 좌석 동시 예약 — 자습실 행 락을 그대로 쓴 이유, 대안 비교, 좌석 축소  |
| [visit-time-overlap-concurrency.md](./solutions/visit-time-overlap-concurrency.md)   | 같은 학생의 시간 겹침 — 학생 행 락 모드(`FOR NO KEY UPDATE`)와 교착 상태   |
| [study-room-capacity-concurrency.md](./solutions/study-room-capacity-concurrency.md) | (좌석 전환 전 기록) 정원 마감 직전 동시 신청, 락 대안 비교, 공정성         |
| [waitlist-offer.md](./solutions/waitlist-offer.md)                                   | (제거한 기능의 기록) 대기열·자리 제안, 롤백 함정, 학생 삭제 교착 상태 해소 |

## 설계 기록 — [tbd/](./tbd/)

| 문서                                                         | 담고 있는 것                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [seat-based-reservation.md](./tbd/seat-based-reservation.md) | (구현됨) 자습실 단위 정원 → 좌석 단위 예약으로 바꿀 때의 방향 비교와 결정 사항 |

## 화면(UI/UX) 설계 — [apps/web/docs/](../apps/web/docs/README.md)

| 문서                                                                        | 담고 있는 것                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------- |
| [screens.md](../apps/web/docs/screens.md)                                   | 화면 명세 S-00~S-23 (표시 데이터 → 액션 → 상태)     |
| [user-flows.md](../apps/web/docs/user-flows.md)                             | 강사·학생 사용자 흐름                               |
| [information-architecture.md](../apps/web/docs/information-architecture.md) | 라우트 맵, 화면 ↔ 기능 ↔ API 매핑, 클라이언트 상태  |
| [interaction-rules.md](../apps/web/docs/interaction-rules.md)               | 에러 코드별 UI 처리, 확인 다이얼로그, 데이터 최신화 |
| [ux-writing.md](../apps/web/docs/ux-writing.md)                             | 용어집, 버튼·토스트·에러 문구                       |
| [design-system.md](../apps/web/docs/design-system.md)                       | 토큰, 컴포넌트 목록                                 |
| [accessibility.md](../apps/web/docs/accessibility.md)                       | 접근성 점검 항목                                    |
| [ui-implementation.md](../apps/web/docs/ui-implementation.md)               | UI 구현 방식, 테스트 전략                           |
| [../apps/web/DESIGN.md](../apps/web/DESIGN.md)                              | 디자인 원칙, 실제 토큰 값·대비 측정 결과            |

## 화면 캡처 — [images/](./images/)

| 폴더                                                                 | 내용                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| [seat-teacher](./images/seat-teacher/)                               | 강사 화면 (목록·상세·이력·좌석 축소 거절), 데스크톱·320px |
| [seat-student](./images/seat-student/)                               | 학생 화면 (목록·자습실 페이지·내 신청), 데스크톱·320px    |
| [concurrency](./images/concurrency/), [waitlist](./images/waitlist/) | solutions 문서에 쓰인 캡처 (좌석 전환 전 화면)            |
