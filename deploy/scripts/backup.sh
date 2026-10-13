#!/usr/bin/env bash
# Sao lưu môi trường chạy thật (YCTD-92) theo SL-01 đến SL-05 (12_KIEN_TRUC_HE_THONG.md mục 11):
#   daily  (mặc định) mọi cơ sở dữ liệu: school_identity, school_system và mọi school_year_* tìm thấy trong PostgreSQL, kèm
#          danh sách tài khoản kết nối và toàn bộ kho tệp; giữ BACKUP_RETENTION_DAYS ngày (SL-01, tối thiểu 30).
#          Cơ sở dữ liệu năm học đã đóng (read_only) được chép thêm một lần vào thư mục archive/ và giữ lâu dài.
#   hourly cơ sở dữ liệu định danh, hệ thống và năm học đang dùng (chứa dữ liệu tài chính) để mất tối đa 1 giờ dữ liệu
#          (SL-02, SL-04); giữ BACKUP_HOURLY_RETENTION_HOURS giờ. Kho tệp được đồng bộ vào bản chép cục bộ files-mirror/.
# Mọi tệp được mã hóa AES-256 bằng BACKUP_ENCRYPTION_PASSPHRASE (SL-05) và kiểm tra đọc lại được sau khi ghi; nếu có
# OFFSITE_S3_BUCKET thì đẩy sang kho ngoài máy chủ (SL-05). Chạy bằng tài khoản có quyền docker, từ bất kỳ thư mục nào:
#   bash deploy/scripts/backup.sh daily
#   ENV_FILE=/duong/dan/.env bash deploy/scripts/backup.sh hourly
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

mode=${1:-daily}
case "$mode" in
  daily | hourly) ;;
  *) fail "Chế độ không hợp lệ: $mode (dùng daily hoặc hourly)" ;;
esac

require_passphrase
BACKUP_DIR=${BACKUP_DIR:-/var/backups/school-management}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
HOURLY_RETENTION_HOURS=${BACKUP_HOURLY_RETENTION_HOURS:-48}
[ "$RETENTION_DAYS" -ge 30 ] || log "CẢNH BÁO: BACKUP_RETENTION_DAYS=$RETENTION_DAYS nhỏ hơn 30 ngày theo SL-01"

umask 077
mkdir -p "$BACKUP_DIR/$mode" "$BACKUP_DIR/archive" "$BACKUP_DIR/files-mirror"

# Không chạy chồng hai lần sao lưu
lock_dir="$BACKUP_DIR/.lock"
mkdir "$lock_dir" 2>/dev/null || fail "Đang có lần sao lưu khác chạy (xóa $lock_dir nếu chắc chắn không có)"
stamp=$(date '+%Y-%m-%d_%H%M%S')
target="$BACKUP_DIR/$mode/$stamp"
partial="$target.dang-ghi"
cleanup() {
  rm -rf "$lock_dir"
  [ -d "$partial" ] && rm -rf "$partial"
  return 0
}
trap cleanup EXIT INT TERM
mkdir -p "$partial"

compose ps --status running --services | grep -qx postgres || fail "Dịch vụ postgres không chạy"

# Danh sách cơ sở dữ liệu tìm động: năm học mới mở được sao lưu ngay mà không phải sửa tệp này
school_year_databases=$(psql_admin postgres -c "select datname from pg_database where datname like 'school\_year\_%' order by datname")
closed_databases=$(psql_admin school_system -c "select database_name from academic_year_databases where status = 'read_only' order by database_name")

is_closed() {
  printf '%s\n' "$closed_databases" | grep -qx "$1"
}

databases="school_identity school_system"
for database in $school_year_databases; do
  if [ "$mode" = hourly ] && is_closed "$database"; then
    continue
  fi
  databases="$databases $database"
done

dump_database() {
  database=$1
  file="$partial/$database.dump.enc"
  log "Sao lưu cơ sở dữ liệu $database"
  compose exec -T postgres pg_dump -U postgres -Fc -d "$database" | encrypt >"$file"
  # Kiểm tra bản sao lưu giải mã và đọc được mục lục, không chỉ kiểm tra tệp tồn tại (BR-76)
  decrypt <"$file" | compose exec -T postgres pg_restore --list >/dev/null ||
    fail "Bản sao lưu $database không đọc lại được"
}

for database in $databases; do
  dump_database "$database"
done

if [ "$mode" = daily ]; then
  log "Sao lưu danh sách tài khoản kết nối PostgreSQL"
  compose exec -T postgres pg_dumpall -U postgres --globals-only | encrypt >"$partial/globals.sql.enc"
fi

# Kho tệp: đồng bộ bản chép cục bộ (tăng dần), bản hằng ngày đóng gói và mã hóa
log "Đồng bộ kho tệp $S3_BUCKET vào $BACKUP_DIR/files-mirror"
# Thùng chứa được máy chủ API tạo ở lần ghi tệp đầu; chưa có thì chưa có tệp nào để sao lưu
if rclone "$BACKUP_DIR" lsf source: --dirs-only | grep -qx "$S3_BUCKET/"; then
  rclone "$BACKUP_DIR" sync "source:$S3_BUCKET" /backup/files-mirror --fast-list
else
  log "Kho tệp chưa có thùng chứa $S3_BUCKET (chưa có tệp nào được tải lên)"
fi
if [ "$mode" = daily ]; then
  log "Đóng gói kho tệp"
  tar -C "$BACKUP_DIR/files-mirror" -cf - . | encrypt >"$partial/files.tar.enc"
  decrypt <"$partial/files.tar.enc" | tar -tf - >/dev/null || fail "Bản sao lưu kho tệp không đọc lại được"
fi

# Ghi danh sách tệp kèm mã băm để đối chiếu khi khôi phục
(
  cd "$partial"
  {
    echo "che_do=$mode"
    echo "thoi_diem=$stamp"
    echo "co_so_du_lieu=$databases"
    echo "nam_hoc_da_dong=$(printf '%s' "$closed_databases" | tr '\n' ' ')"
  } >manifest.txt
  sha256sum ./*.enc >SHA256SUMS
)
mv "$partial" "$target"
log "Đã ghi bản sao lưu $target"

# Năm học đã đóng: giữ lâu dài một bản (SL-01)
if [ "$mode" = daily ]; then
  for database in $closed_databases; do
    if [ ! -f "$BACKUP_DIR/archive/$database.dump.enc" ] && [ -f "$target/$database.dump.enc" ]; then
      cp "$target/$database.dump.enc" "$BACKUP_DIR/archive/$database.dump.enc"
      log "Đã lưu lâu dài bản sao lưu năm học đã đóng $database"
    fi
  done
fi

# Đẩy sang kho ngoài máy chủ (SL-05); tệp đã mã hóa trước khi rời máy chủ
if [ -n "${OFFSITE_S3_BUCKET:-}" ]; then
  remote="offsite:$OFFSITE_S3_BUCKET/${OFFSITE_S3_PREFIX:-school-management}"
  log "Đẩy bản sao lưu sang $remote/$mode/$stamp"
  rclone "$BACKUP_DIR" copy "/backup/$mode/$stamp" "$remote/$mode/$stamp"
  if [ "$mode" = daily ]; then
    rclone "$BACKUP_DIR" copy /backup/archive "$remote/archive"
    rclone "$BACKUP_DIR" delete "$remote/daily" --min-age "${RETENTION_DAYS}d" --rmdirs
  else
    rclone "$BACKUP_DIR" delete "$remote/hourly" --min-age "${HOURLY_RETENTION_HOURS}h" --rmdirs
  fi
else
  log "CẢNH BÁO: chưa cấu hình OFFSITE_S3_BUCKET; bản sao lưu chỉ nằm trên máy chủ này (trái SL-05)"
fi

# Xóa bản cũ quá hạn trên máy chủ; thư mục archive/ không bao giờ bị xóa
if [ "$mode" = daily ]; then
  find "$BACKUP_DIR/daily" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +
else
  find "$BACKUP_DIR/hourly" -mindepth 1 -maxdepth 1 -type d -mmin +"$((HOURLY_RETENTION_HOURS * 60))" -exec rm -rf {} +
fi

# Báo cho dịch vụ giám sát bên ngoài (ví dụ healthchecks.io) biết lần sao lưu đã xong
if [ -n "${BACKUP_HEALTHCHECK_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "$BACKUP_HEALTHCHECK_URL" >/dev/null || log "CẢNH BÁO: không gọi được BACKUP_HEALTHCHECK_URL"
fi
log "Sao lưu $mode hoàn tất"
