#!/usr/bin/env bash
# Diễn tập khôi phục tự động theo từng trường (DT-SaaS phần S7b, YCTD-199; SL-03): với mỗi trường, lấy bản sao lưu mới nhất trong
# BACKUP_DIR/schools, khôi phục vào một trường tạm (không phục vụ, không tên miền), so số dòng và tổng kiểm từng bảng với bản sao
# lưu, ghi thời gian khôi phục (bằng chứng RTO) và kết quả vào bảng backup_runs của nền tảng (S4 đọc), rồi gỡ trường tạm.
# Chạy hằng tháng trên môi trường thử (staging) đã chép bản sao lưu về, hoặc trên chính máy chạy thật ngoài giờ học:
#   bash deploy/scripts/restore-drill.sh            mọi trường
#   bash deploy/scripts/restore-drill.sh <mã trường> một trường
#   ENV_FILE=deploy/profiles/production/staging.env COMPOSE_FILE=deploy/profiles/production/compose.yml \
#     bash deploy/scripts/restore-drill.sh
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

require_passphrase
[ -n "${PLATFORM_DATABASE_URL:-}" ] || fail "Diễn tập theo trường cần nền tảng nhiều trường (PLATFORM_DATABASE_URL trong $ENV_FILE)"
BACKUP_DIR=${BACKUP_DIR:-/var/backups/school-management}

status=0
if [ $# -ge 1 ]; then
  platform_command restore-drill --school "$1" || status=$?
else
  platform_command restore-drill --all || status=$?
fi

if [ -n "${BACKUP_HEALTHCHECK_URL:-}" ] && [ "$status" -eq 0 ]; then
  curl -fsS -m 10 --retry 3 "${BACKUP_HEALTHCHECK_URL%/}/drill" >/dev/null || log "CẢNH BÁO: không gọi được BACKUP_HEALTHCHECK_URL"
fi
[ "$status" -eq 0 ] || fail "Diễn tập khôi phục có trường không đạt (xem dòng LỖI ở trên, bảng backup_runs)"
log "Diễn tập khôi phục đạt"
