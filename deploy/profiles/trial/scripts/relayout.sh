#!/bin/sh
# Chuyển một trường từ hồ sơ thử nghiệm sang hồ sơ vận hành (DT-SaaS phần S9, YCTD-203; README mục 6). Chạy từ gốc kho mã nguồn đã
# dựng (pnpm build) trên máy kết nối được tới cả hai nơi. Biến của nguồn: PLATFORM_DATABASE_URL, PLATFORM_MASTER_KEY (nền tảng thử
# nghiệm). Biến của đích: TARGET_PLATFORM_DATABASE_URL, TARGET_PLATFORM_MASTER_KEY, TARGET_PLATFORM_ADMIN_DATABASE_URL (tài khoản
# tạo cơ sở dữ liệu, vai trò ở VPS, địa chỉ trực tiếp không qua PgBouncer; không cần quyền siêu người dùng từ S7b). Trường nguồn phải đang tạm dừng hoặc chỉ đọc
set -eu
if [ $# -lt 1 ]; then
  echo "Dùng: sh deploy/profiles/trial/scripts/relayout.sh <mã trường> [database|schema]" >&2
  exit 2
fi
code=$1
layout=${2:-database}
for name in PLATFORM_DATABASE_URL PLATFORM_MASTER_KEY TARGET_PLATFORM_DATABASE_URL TARGET_PLATFORM_MASTER_KEY TARGET_PLATFORM_ADMIN_DATABASE_URL; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "Thiếu biến $name" >&2
    exit 2
  fi
done
node database/dist/src/platform-command.js relayout --school "$code" --to "$layout"
echo "Tiếp theo: chép tệp tenants/<tiền tố>/ sang kho tệp của đích (ví dụ rclone sync), chuyển DNS, ghi vùng máy chủ mới, đổi loại dữ liệu sang production rồi mở lại trường ở đích"
