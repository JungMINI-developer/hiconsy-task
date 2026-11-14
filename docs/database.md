# 데이터베이스 스키마

> TODO: 도메인 모델 구현 후 작성

## ERD

```mermaid
erDiagram
  %% TODO
```

## 테이블 설명

| 테이블 | 설명 |
| ------ | ---- |
|        |      |

## 설계 이유

- TODO: 정규화 수준, 관계 설정 이유
- TODO: 인덱스 / 유니크 제약조건
- TODO: 삭제 정책 (soft delete 여부, onDelete 정책)

## 마이그레이션

- 스키마: `apps/api/prisma/schema.prisma`
- 마이그레이션: `apps/api/prisma/migrations/`
- 시드: `apps/api/prisma/seed.ts` (멱등하게 작성, Docker 실행 시 자동 적용)
