# syntax=docker/dockerfile:1.7
# Ảnh chạy máy chủ API nghiệp vụ (đích `api`), dịch vụ định danh (đích `identity`) (YCTD-92) và tiến trình chạy nền (đích
# `worker`, máy xếp thời khoá biểu của DT-20 phần 22c2).
# Dựng từ thư mục gốc kho mã nguồn: docker build -f deploy/docker/server.Dockerfile --target api .
# Ảnh `identity` có thêm lệnh chạy tệp thay đổi cấu trúc (dịch vụ `migrate`) và lệnh tạo tài khoản VT-01 đầu tiên.

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN npm install --global pnpm@10.12.1 && npm cache clean --force
WORKDIR /app

# Chỉ tệp khai báo gói để tận dụng bộ nhớ đệm khi mã nguồn đổi mà thư viện không đổi
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/identity/package.json apps/identity/
COPY apps/worker/package.json apps/worker/
COPY apps/portal/package.json apps/portal/
COPY apps/parent/package.json apps/parent/
COPY apps/teacher/package.json apps/teacher/
COPY apps/platform/package.json apps/platform/
COPY apps/mobile/package.json apps/mobile/
COPY apps/market/package.json apps/market/
COPY apps/tutor/package.json apps/tutor/
COPY packages/config/package.json packages/config/
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY packages/pwa/package.json packages/pwa/
COPY packages/market-client/package.json packages/market-client/
COPY database/package.json database/
COPY tests/package.json tests/

# Dựng mã TypeScript của các dịch vụ và các gói dùng chung
FROM manifests AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store \
      --filter "@school-management/api..." --filter "@school-management/identity..." \
      --filter "@school-management/worker..."
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY database database
COPY apps/identity apps/identity
COPY apps/api apps/api
COPY apps/worker apps/worker
RUN pnpm --filter "@school-management/api..." --filter "@school-management/identity..." \
      --filter "@school-management/worker..." build

# Thư viện chạy thật (không có thư viện phát triển), dàn phẳng để gói dùng chung tìm được thư viện của dịch vụ
FROM manifests AS production-dependencies-api
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --store-dir /pnpm/store --config.node-linker=hoisted \
      --filter "@school-management/api..."

FROM manifests AS production-dependencies-identity
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --store-dir /pnpm/store --config.node-linker=hoisted \
      --filter "@school-management/identity..."

FROM manifests AS production-dependencies-worker
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --store-dir /pnpm/store --config.node-linker=hoisted \
      --filter "@school-management/worker..."

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
# tini chuyển tín hiệu dừng cho Node để đóng kết nối gọn gàng khi `docker compose stop`
RUN apk add --no-cache tini
WORKDIR /app
USER node
ENTRYPOINT ["/sbin/tini", "--"]

FROM runtime AS api
COPY --from=production-dependencies-api --chown=node:node /app /app
COPY --from=build --chown=node:node /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build --chown=node:node /app/packages/server/dist /app/packages/server/dist
COPY --from=build --chown=node:node /app/database/dist /app/database/dist
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
WORKDIR /app/apps/api
ENV API_PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]

FROM runtime AS identity
COPY --from=production-dependencies-identity --chown=node:node /app /app
COPY --from=build --chown=node:node /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build --chown=node:node /app/packages/server/dist /app/packages/server/dist
COPY --from=build --chown=node:node /app/database/dist /app/database/dist
COPY --from=build --chown=node:node /app/apps/identity/dist /app/apps/identity/dist
WORKDIR /app/apps/identity
ENV IDENTITY_PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3001/api/v1/health || exit 1
CMD ["node", "dist/main.js"]

# Tiến trình chạy nền: chỉ nối Redis, không mở cổng, không đọc cơ sở dữ liệu
FROM runtime AS worker
COPY --from=production-dependencies-worker --chown=node:node /app /app
COPY --from=build --chown=node:node /app/packages/server/dist /app/packages/server/dist
COPY --from=build --chown=node:node /app/apps/worker/dist /app/apps/worker/dist
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
