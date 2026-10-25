# syntax=docker/dockerfile:1.7
# Ảnh máy chủ web: Caddy phục vụ ba giao diện (portal, ứng dụng phụ huynh, ứng dụng giáo viên) dạng tệp tĩnh và chuyển
# /api/v1 sang dịch vụ định danh hoặc máy chủ API, tự cấp chứng chỉ HTTPS (YCTD-92).
# Dựng từ thư mục gốc kho mã nguồn: docker build -f deploy/docker/web.Dockerfile .

ARG NODE_IMAGE=node:24-alpine
ARG CADDY_IMAGE=caddy:2.10-alpine

FROM ${NODE_IMAGE} AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN npm install --global pnpm@10.12.1 && npm cache clean --force
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/identity/package.json apps/identity/
COPY apps/worker/package.json apps/worker/
COPY apps/portal/package.json apps/portal/
COPY apps/parent/package.json apps/parent/
COPY apps/teacher/package.json apps/teacher/
COPY apps/platform/package.json apps/platform/
COPY packages/config/package.json packages/config/
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY database/package.json database/
COPY tests/package.json tests/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store \
      --filter "@school-management/portal..." --filter "@school-management/parent..." \
      --filter "@school-management/teacher..."
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY packages/ui packages/ui
COPY apps/portal apps/portal
COPY apps/parent apps/parent
COPY apps/teacher apps/teacher
# Giao diện gọi /api/v1 cùng tên miền nên không cần biến địa chỉ máy chủ lúc dựng
RUN pnpm --filter "@school-management/portal..." --filter "@school-management/parent..." \
      --filter "@school-management/teacher..." build

FROM ${CADDY_IMAGE} AS web
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/portal/dist /srv/portal
COPY --from=build /app/apps/parent/dist /srv/parent
COPY --from=build /app/apps/teacher/dist /srv/teacher
