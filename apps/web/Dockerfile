# build context: 레포 루트 (docker compose가 지정)
FROM node:24-alpine AS build
RUN npm install -g pnpm@12.14.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@hiconsy/web..."

COPY packages packages
COPY apps/web apps/web
RUN pnpm --filter "@hiconsy/web..." run build

# 정적 파일 서빙 + /api 리버스 프록시
FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
