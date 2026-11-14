# build context: 레포 루트 (docker compose가 지정)
FROM node:24-alpine
RUN npm install -g pnpm@12.14.0
WORKDIR /app

# 1) 의존성 설치 (manifest만 먼저 복사해 레이어 캐시 활용)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --filter "@hiconsy/api..."

# 2) 소스 복사 후 shared → api 순서로 빌드
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter "@hiconsy/api..." run build

WORKDIR /app/apps/api
EXPOSE 3000
# 마이그레이션 적용 → 시드(멱등) → 서버 실행
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec prisma db seed && node dist/main.js"]
