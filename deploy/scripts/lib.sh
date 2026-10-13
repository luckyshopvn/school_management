#!/usr/bin/env bash
# Hàm dùng chung cho backup.sh và restore.sh (YCTD-92). Không chạy trực tiếp tệp này.

# `pwd -W` chỉ có ở Git Bash trên Windows (thử cấu hình trên máy phát triển); trên Linux dùng `pwd`
DEPLOY_DIR=$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))
ENV_FILE=${ENV_FILE:-"$DEPLOY_DIR/.env"}
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.production.yml"
RCLONE_IMAGE=${RCLONE_IMAGE:-rclone/rclone:1.68.2}

[ -f "$ENV_FILE" ] || { echo "Không có tệp cấu hình $ENV_FILE" >&2; exit 1; }
# Nạp cấu hình; các giá trị trong .env không có dấu cách nên đọc được bằng shell
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

PROJECT_NAME=${COMPOSE_PROJECT_NAME:-school-management}
NETWORK_NAME="${PROJECT_NAME}_default"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  log "LỖI: $*" >&2
  exit 1
}

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" "$@"
}

# Câu lệnh SQL chạy bằng tài khoản quản trị postgres bên trong vùng chứa
psql_admin() {
  database=$1
  shift
  compose exec -T postgres psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -At "$@"
}

encrypt() {
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_ENCRYPTION_PASSPHRASE
}

decrypt() {
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_PASSPHRASE
}

require_passphrase() {
  [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ] || fail "Thiếu BACKUP_ENCRYPTION_PASSPHRASE trong $ENV_FILE (SL-05: bản sao lưu phải được mã hóa)"
  command -v openssl >/dev/null 2>&1 || fail "Cần cài openssl"
}

# rclone chạy trong vùng chứa, nối vào mạng nội bộ của dự án để đọc kho tệp SeaweedFS.
# Hai kho cấu hình bằng biến môi trường: `source` là kho tệp của hệ thống, `offsite` là kho cất bản sao lưu ngoài máy chủ
rclone() {
  mount_dir=$1
  shift
  docker run --rm --network "$NETWORK_NAME" --user "$(id -u):$(id -g)" \
    -v "$mount_dir:/backup" \
    -e RCLONE_CONFIG=/tmp/rclone.conf \
    -e RCLONE_LOG_LEVEL=ERROR \
    -e RCLONE_CONFIG_SOURCE_TYPE=s3 \
    -e RCLONE_CONFIG_SOURCE_PROVIDER=Other \
    -e RCLONE_CONFIG_SOURCE_ENDPOINT="$S3_ENDPOINT" \
    -e RCLONE_CONFIG_SOURCE_REGION="${S3_REGION:-us-east-1}" \
    -e RCLONE_CONFIG_SOURCE_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_SOURCE_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    -e RCLONE_CONFIG_SOURCE_FORCE_PATH_STYLE=true \
    -e RCLONE_CONFIG_OFFSITE_TYPE=s3 \
    -e RCLONE_CONFIG_OFFSITE_PROVIDER=Other \
    -e RCLONE_CONFIG_OFFSITE_ENDPOINT="${OFFSITE_S3_ENDPOINT:-}" \
    -e RCLONE_CONFIG_OFFSITE_REGION="${OFFSITE_S3_REGION:-us-east-1}" \
    -e RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID="${OFFSITE_S3_ACCESS_KEY_ID:-}" \
    -e RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY="${OFFSITE_S3_SECRET_ACCESS_KEY:-}" \
    -e RCLONE_CONFIG_OFFSITE_FORCE_PATH_STYLE=true \
    "$RCLONE_IMAGE" "$@"
}
