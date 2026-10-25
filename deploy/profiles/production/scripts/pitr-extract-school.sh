#!/usr/bin/env bash
# Lấy riêng một trường về một thời điểm (DT-SaaS phần S7b, YCTD-199; PITR.md): dựng một bản khôi phục tạm của cả cụm PostgreSQL từ
# bản cơ bản và nhật ký giao dịch của WAL-G vào một ổ và mạng riêng (không nối mạng của hệ thống đang chạy), dừng ở thời điểm
# yêu cầu, rồi sao lưu logic riêng trường đó ra BACKUP_DIR/schools/<mã>/ bằng lệnh `platform backup-school` (đọc ở bản tạm nhờ
# BACKUP_SOURCE_HOST). Sau khi kiểm tra tệp, khôi phục vào hệ thống đang chạy bằng `platform restore-school --in-place` (trường
# phải tạm dừng) hoặc `--as <mã mới>` để xem lại. Bản tạm bị gỡ khi xong. Chạy từ thư mục gốc mã nguồn:
#   bash deploy/profiles/production/scripts/pitr-extract-school.sh <mã trường> '2026-10-25 09:30:00+07'
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-deploy/profiles/production/compose.yml}
ENV_FILE=${ENV_FILE:-deploy/profiles/production/production.env}
export COMPOSE_FILE ENV_FILE
# shellcheck source=../../../scripts/lib.sh
. "$(dirname "$0")/../../../scripts/lib.sh"

[ $# -eq 2 ] || fail "Dùng: pitr-extract-school.sh <mã trường> '<thời điểm, ví dụ 2026-10-25 09:30:00+07>'"
code=$1
target_time=$2
require_passphrase
[ -n "${WALG_S3_PREFIX:-}" ] || fail "Chưa bật lưu nhật ký giao dịch (WALG_S3_PREFIX trống, xem compose.pitr.yml)"
[ -n "${PLATFORM_MASTER_KEY:-}" ] || fail "Thiếu PLATFORM_MASTER_KEY"
BACKUP_DIR=${BACKUP_DIR:-/var/backups/school-management}
mkdir -p "$BACKUP_DIR/schools"

stamp=$(date '+%Y%m%d%H%M%S')
name="pitr-$stamp"
image="${IMAGE_PREFIX:-school-management}/postgres-walg:${IMAGE_TAG:-latest}"
tool_image="${IMAGE_PREFIX:-school-management}/identity:${IMAGE_TAG:-latest}"
walg_env=(
  -e "WALG_S3_PREFIX=$WALG_S3_PREFIX"
  -e "AWS_ENDPOINT=$WALG_S3_ENDPOINT"
  -e "AWS_REGION=${WALG_S3_REGION:-us-east-1}"
  -e AWS_S3_FORCE_PATH_STYLE=true
  -e "AWS_ACCESS_KEY_ID=$WALG_S3_ACCESS_KEY_ID"
  -e "AWS_SECRET_ACCESS_KEY=$WALG_S3_SECRET_ACCESS_KEY"
  -e "WALG_LIBSODIUM_KEY=$WALG_LIBSODIUM_KEY"
)

cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker volume rm "$name" >/dev/null 2>&1 || true
  docker network rm "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

log "Dựng bản khôi phục tạm $name đến thời điểm $target_time"
docker network create --internal "$name" >/dev/null
docker volume create "$name" >/dev/null
data=/var/lib/postgresql/data
docker run --rm -v "$name:$data" "${walg_env[@]}" --entrypoint sh "$image" -c "
  set -e
  wal-g backup-fetch $data LATEST
  touch $data/recovery.signal
  printf \"restore_command = 'wal-g wal-fetch %%f %%p'\nrecovery_target_time = '%s'\nrecovery_target_action = 'promote'\narchive_mode = off\n\" '$target_time' >> $data/postgresql.auto.conf
  chown -R postgres:postgres $data
  chmod 700 $data
"
# Mạng nội bộ riêng (--internal) nhưng WAL-G cần tải nhật ký từ kho ngoài: nối thêm mạng mặc định của Docker trong lúc phục hồi
docker run -d --name "$name" --network bridge -v "$name:$data" "${walg_env[@]}" -e "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
  "$image" postgres -c max_locks_per_transaction=256 >/dev/null
docker network connect --alias pitr-postgres "$name" "$name"

log "Chờ bản tạm phục hồi xong"
for _ in $(seq 1 720); do
  if docker exec "$name" psql -U postgres -At -c 'select pg_is_in_recovery()' 2>/dev/null | grep -qx f; then
    break
  fi
  sleep 5
done
docker exec "$name" psql -U postgres -At -c 'select pg_is_in_recovery()' | grep -qx f || fail "Bản tạm chưa phục hồi xong sau 1 giờ"
docker network disconnect bridge "$name"

log "Sao lưu riêng trường $code từ bản tạm"
admin="postgres://postgres:$POSTGRES_PASSWORD@pitr-postgres:5432"
docker run --rm --network "$name" --user "$(id -u):$(id -g)" \
  -v "$BACKUP_DIR/schools:/backup/schools" \
  -e BACKUP_DIR=/backup/schools \
  -e BACKUP_ENCRYPTION_PASSPHRASE \
  -e "PLATFORM_DATABASE_URL=$admin/${PITR_PLATFORM_DATABASE:-school_platform}" \
  -e "PLATFORM_ADMIN_DATABASE_URL=$admin/postgres" \
  -e PLATFORM_MASTER_KEY -e TENANT_DB_LAYOUT -e PLATFORM_SHARED_DATABASE \
  -e BACKUP_SOURCE_HOST=pitr-postgres -e BACKUP_SOURCE_PORT=5432 \
  --entrypoint node "$tool_image" /app/database/dist/src/platform-command.js backup-school --school "$code" --keep-days 3650

log "Xong. Tệp ở $BACKUP_DIR/schools/$code/ (mới nhất). Kiểm tra: platform verify-backup --file <tệp>; khôi phục: tạm dừng trường rồi platform restore-school --file <tệp> --in-place, hoặc --as <mã mới> để xem lại"
