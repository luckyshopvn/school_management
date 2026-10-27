# syntax=docker/dockerfile:1.7
# Ảnh máy chủ web: Caddy phục vụ bốn giao diện (portal, ứng dụng phụ huynh, ứng dụng giáo viên, ứng dụng học sinh ở /hoc-sinh/ của
# tên miền phụ huynh, YCTD-300) dạng tệp tĩnh và chuyển
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
COPY apps/student/package.json apps/student/
COPY apps/platform/package.json apps/platform/
COPY apps/mobile/package.json apps/mobile/
COPY packages/config/package.json packages/config/
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY packages/pwa/package.json packages/pwa/
COPY database/package.json database/
COPY tests/package.json tests/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store \
      --filter "@school-management/portal..." --filter "@school-management/parent..." \
      --filter "@school-management/teacher..." --filter "@school-management/student..."
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY packages/ui packages/ui
COPY packages/pwa packages/pwa
COPY apps/portal apps/portal
COPY apps/parent apps/parent
COPY apps/teacher apps/teacher
COPY apps/student apps/student
# Giao diện gọi /api/v1 cùng tên miền nên không cần biến địa chỉ máy chủ lúc dựng
RUN pnpm --filter "@school-management/portal..." --filter "@school-management/parent..." \
      --filter "@school-management/teacher..." build
# Ứng dụng học sinh luôn nằm dưới /hoc-sinh/ (tên miền phụ huynh hoặc tên miền của trường, YCTD-300)
RUN APP_BASE_PATH=/hoc-sinh/ pnpm --filter "@school-management/student" build

FROM ${CADDY_IMAGE} AS web
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/portal/dist /srv/portal
COPY --from=build /app/apps/parent/dist /srv/parent
COPY --from=build /app/apps/teacher/dist /srv/teacher
COPY --from=build /app/apps/student/dist /srv/student
