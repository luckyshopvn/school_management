#!/usr/bin/env bash
# Khôi phục từ một bản sao lưu do backup.sh tạo (YCTD-92, SL-03, SL-04, CT-089).
# Cách dùng:
#   bash deploy/scripts/restore.sh <thư mục bản sao lưu> [--only school_identity,school_system] [--files] [--yes]
#     --only   chỉ khôi phục các cơ sở dữ liệu liệt kê (mặc định: mọi tệp *.dump.enc trong thư mục)
#     --files  khôi phục cả kho tệp từ files.tar.enc (chỉ có ở bản hằng ngày)
#     --yes    không hỏi xác nhận
# Khôi phục ghi đè dữ liệu hiện có. Diễn tập phục hồi (SL-03) chạy trên môi trường tách biệt: dùng tệp cấu hình khác, ví dụ
#   ENV_FILE=deploy/.env.dien-tap bash deploy/scripts/restore.sh /duong/dan/ban-sao-luu --files --yes
# Bản sao lưu ở kho ngoài máy chủ tải về trước bằng rclone (xem deploy/README.md).
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

source_dir=""
only=""
restore_files=false
assume_yes=false
while [ $# -gt 0 ]; do
  case "$1" in
    --only) only=${2:-}; shift 2 ;;
    --files) restore_files=true; shift ;;
    --yes) assume_yes=true; shift ;;
    -*) fail "Tham số không hợp lệ: $1" ;;
    *) source_dir=$1; shift ;;
  esac
done
[ -n "$source_dir" ] || fail "Thiếu thư mục bản sao lưu"
[ -d "$source_dir" ] || fail "Không có thư mục $source_dir"
source_dir=$(cd "$source_dir" && pwd)
require_passphrase

# Đối chiếu mã băm trước khi khôi phục
if [ -f "$source_dir/SHA256SUMS" ]; then
  (cd "$source_dir" && sha256sum -c SHA256SUMS) || fail "Mã băm không khớp, bản sao lưu bị hỏng"
fi

dumps=()
if [ -n "$only" ]; then
  IFS=',' read -r -a names <<<"$only"
  for name in "${names[@]}"; do
    [ -f "$source_dir/$name.dump.enc" ] || fail "Không có $name.dump.enc trong $source_dir"
    dumps+=("$source_dir/$name.dump.enc")
  done
else
  for file in "$source_dir"/*.dump.enc; do
    [ -f "$file" ] && dumps+=("$file")
  done
fi
[ ${#dumps[@]} -gt 0 ] || fail "Không có tệp *.dump.enc trong $source_dir"
if $restore_files && [ ! -f "$source_dir/files.tar.enc" ]; then
  fail "Không có files.tar.enc trong $source_dir (bản hằng giờ không chứa kho tệp)"
fi

log "Dự án: $PROJECT_NAME (tệp cấu hình $ENV_FILE)"
log "Sẽ khôi phục: $(for file in "${dumps[@]}"; do basename "$file" .dump.enc; done | tr '\n' ' ')$($restore_files && echo '+ kho tệp')"
if ! $assume_yes; then
  printf 'Dữ liệu hiện có của các mục trên sẽ bị ghi đè. Gõ "dong y" để tiếp tục: '
  read -r answer
  [ "$answer" = "dong y" ] || fail "Đã hủy"
fi

started_at=$(date +%s)
log "Dừng các dịch vụ dùng cơ sở dữ liệu"
compose stop web api identity >/dev/null
compose up -d postgres >/dev/null
for attempt in $(seq 1 30); do
  compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1 && break
  [ "$attempt" -eq 30 ] && fail "PostgreSQL không sẵn sàng"
  sleep 2
done

for file in "${dumps[@]}"; do
  database=$(basename "$file" .dump.enc)
  log "Khôi phục cơ sở dữ liệu $database"
  # Chép vào vùng chứa rồi khôi phục từ tệp; --create tạo lại cơ sở dữ liệu cùng chủ sở hữu, quyền kết nối và thiết lập chỉ
  # đọc của năm học đã đóng như lúc sao lưu. Tài khoản identity_service, api_service đã có từ lần khởi tạo PostgreSQL
  # PGOPTIONS: thiết lập chỉ đọc được tạo lại trước khi nạp dữ liệu, nên phiên khôi phục tự tắt chỉ đọc cho riêng mình
  decrypt <"$file" | compose exec -T postgres sh -c 'cat > /tmp/restore.dump'
  compose exec -T -e PGOPTIONS='-c default_transaction_read_only=off' postgres \
    pg_restore -U postgres --clean --if-exists --create --exit-on-error -d postgres /tmp/restore.dump
  compose exec -T postgres rm -f /tmp/restore.dump
done

if $restore_files; then
  log "Khôi phục kho tệp vào thùng chứa $S3_BUCKET"
  # Giải nén vào thư mục sao lưu (đủ chỗ hơn /tmp khi kho tệp lớn)
  mkdir -p "${BACKUP_DIR:-/var/backups/school-management}"
  work_dir=$(mktemp -d "${BACKUP_DIR:-/var/backups/school-management}/khoi-phuc.XXXXXX")
  trap 'rm -rf "$work_dir"' EXIT
  mkdir -p "$work_dir/files"
  decrypt <"$source_dir/files.tar.enc" | tar -C "$work_dir/files" -xf -
  compose up -d >/dev/null 2>&1 || true
  rclone "$work_dir" mkdir "source:$S3_BUCKET"
  rclone "$work_dir" copy /backup/files "source:$S3_BUCKET"
fi

log "Khởi động lại hệ thống (dịch vụ migrate chạy lại tệp thay đổi cấu trúc nếu bản sao lưu cũ hơn mã nguồn)"
compose up -d
log "Kiểm tra số bản ghi chính sau khôi phục"
psql_admin school_identity -c "select 'users', count(*) from users" || true
psql_admin school_system -c "select database_name, status from academic_year_databases order by database_name" || true
log "Khôi phục xong sau $(( $(date +%s) - started_at )) giây. Ghi biên bản theo SL-03 (mẫu trong deploy/README.md)."
