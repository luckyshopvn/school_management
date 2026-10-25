#!/usr/bin/env bash
# Triển khai không gián đoạn của hồ sơ "Vận hành" (DT-SaaS phần S7a, YCTD-198).
#
# Dùng: scripts/deploy.sh [--env-file production.env] [--tag <phiên bản>] [--pull] [--skip-build]
#
# Thứ tự:
#   1. dựng (hoặc kéo) ảnh mới với IMAGE_TAG mới;
#   2. chạy migrate một lần, nối thẳng PostgreSQL. Thay đổi cấu trúc phải tương thích lùi (chỉ thêm bảng, cột có mặc định
#      hoặc cho phép trống, chỉ mục tạo không khóa; bỏ cột, đổi tên ở bản phát hành sau khi không còn mã đọc), vì bản cũ
#      còn chạy trong lúc khởi động lại lần lượt;
#   3. khởi động lại lần lượt identity-a, identity-b, api-a, api-b: dịch vụ sau chỉ bắt đầu khi dịch vụ trước báo khỏe
#      (kiểm tra sức khỏe của ảnh). Trong lúc một bản khởi động lại, Caddy chuyển yêu cầu sang bản kia (kiểm tra sức khỏe
#      chủ động, thử lại trong 15 giây);
#   4. worker (việc nền xếp hàng ở Redis, không mất việc), rồi web (Caddy) khi ảnh giao diện đổi.
# Quay lui: chạy lại với --tag <phiên bản trước>; migrate không quay lui tự động (thay đổi tương thích lùi nên bản trước vẫn
# chạy trên cấu trúc mới).
set -euo pipefail

PROFILE_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="$PROFILE_DIR/production.env"
TAG=""
PULL=0
BUILD=1
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-180}

while [ $# -gt 0 ]; do
  case "$1" in
    --env-file) ENV_FILE=$2; shift 2 ;;
    --tag) TAG=$2; shift 2 ;;
    --pull) PULL=1; BUILD=0; shift ;;
    --skip-build) BUILD=0; shift ;;
    *) echo "Tham số không hiểu: $1" >&2; exit 2 ;;
  esac
done

[ -f "$ENV_FILE" ] || { echo "Không có tệp cấu hình $ENV_FILE" >&2; exit 1; }
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

compose() {
  local files=(-f "$PROFILE_DIR/compose.yml")
  if [ -f "$PROFILE_DIR/compose.edge.yml" ] && docker network inspect school-edge >/dev/null 2>&1; then
    files+=(-f "$PROFILE_DIR/compose.edge.yml")
  fi
  if [ -n "$TAG" ]; then
    IMAGE_TAG="$TAG" docker compose "${files[@]}" --env-file "$ENV_FILE" "$@"
  else
    docker compose "${files[@]}" --env-file "$ENV_FILE" "$@"
  fi
}

# Chờ một dịch vụ báo khỏe theo kiểm tra sức khỏe của vùng chứa
wait_healthy() {
  local service=$1
  local container
  container=$(compose ps -q "$service")
  [ -n "$container" ] || { log "Không thấy vùng chứa của $service"; return 1; }
  local waited=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    local status
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")
    case "$status" in
      healthy|running) log "$service: $status"; return 0 ;;
      unhealthy|exited|dead) log "$service: $status"; return 1 ;;
    esac
    sleep 3
    waited=$((waited + 3))
  done
  log "$service chưa khỏe sau $HEALTH_TIMEOUT giây"
  return 1
}

services_enabled() {
  compose config --services
}

if [ "$BUILD" = 1 ]; then
  log "Dựng ảnh${TAG:+ phiên bản $TAG}"
  compose build
elif [ "$PULL" = 1 ]; then
  log "Kéo ảnh${TAG:+ phiên bản $TAG}"
  compose pull --ignore-buildable
fi

enabled=$(services_enabled)
if ! grep -qx 'api-a' <<<"$enabled"; then
  # Máy cơ sở dữ liệu (T2, T3): chỉ cập nhật PgBouncer, giám sát
  log "Máy không chạy ứng dụng: cập nhật các dịch vụ đang bật"
  compose up -d
  exit 0
fi

log "Chạy migrate (nối thẳng PostgreSQL)"
compose run --rm --no-deps migrate

for service in identity-a identity-b api-a api-b; do
  log "Khởi động lại $service"
  compose up -d --no-deps --force-recreate "$service"
  wait_healthy "$service" || { log "Dừng triển khai: $service không khỏe; bản còn lại vẫn phục vụ"; exit 1; }
done

log "Khởi động lại worker"
compose up -d --no-deps worker

log "Cập nhật Caddy (ảnh giao diện) và các dịch vụ còn lại"
compose up -d --no-deps web
wait_healthy web
compose up -d
log "Xong"
