#!/bin/sh
# Dựng tệp tĩnh cho cổng biên của hồ sơ thử nghiệm (DT-SaaS phần S9, YCTD-203): ba ứng dụng dưới đường dẫn gốc riêng và cổng nền
# tảng ở gốc, chép vào ./public theo thư mục mà src/worker.mjs đọc (quan-ly, giao-vien, phu-huynh, nen-tang). Chạy từ thư mục
# deploy/profiles/trial/cloudflare; cần pnpm và thư viện đã cài ở gốc kho mã nguồn. Tổ hợp 3a đưa thư mục ./public lên Vercel
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../../.." && pwd)
public="$here/public"
rm -rf "$public"
mkdir -p "$public"

build() {
  package=$1
  base=$2
  target=$3
  echo "Dựng $package với đường dẫn gốc $base"
  (cd "$root" && APP_BASE_PATH="$base" pnpm --filter "@school-management/$package..." build)
  mkdir -p "$public/$target"
  cp -R "$root/apps/$package/dist/." "$public/$target/"
}

build portal /quan-ly/ quan-ly
build teacher /giao-vien/ giao-vien
build parent /phu-huynh/ phu-huynh
build platform / nen-tang
echo "Đã dựng tệp tĩnh vào $public"
