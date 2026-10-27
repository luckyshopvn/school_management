#!/bin/sh
# Sinh mật khẩu, khóa ký mã phiên Ed25519 (QĐ-22) và khóa dữ liệu trẻ (BM-64) cho môi trường chạy thật (YCTD-92).
# Cách dùng:
#   sh deploy/scripts/generate-keys.sh                 in các dòng KEY=giá_trị ra màn hình
#   sh deploy/scripts/generate-keys.sh deploy/.env     điền vào các biến đang để trống trong tệp; biến đã có giá trị giữ nguyên
# Cần openssl. Không chạy lại để thay khóa của hệ thống đang chạy nếu chưa hiểu hậu quả: đổi khóa ký làm mọi phiên hết hiệu
# lực; đổi CHILD_DATA_* làm mất khả năng đọc số định danh đã mã hóa.
set -eu

command -v openssl >/dev/null 2>&1 || { echo "Cần cài openssl" >&2; exit 1; }

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT INT TERM
umask 077

openssl genpkey -algorithm ed25519 -out "$work_dir/private.pem"
openssl pkey -in "$work_dir/private.pem" -pubout -out "$work_dir/public.pem"

one_line_base64() {
  openssl base64 -A -in "$1"
}

password() {
  openssl rand -hex 24
}

cat >"$work_dir/generated" <<EOF
POSTGRES_PASSWORD=$(password)
IDENTITY_DATABASE_PASSWORD=$(password)
API_DATABASE_PASSWORD=$(password)
REDIS_PASSWORD=$(password)
IDENTITY_TOKEN_PRIVATE_KEY=$(one_line_base64 "$work_dir/private.pem")
TOKEN_PUBLIC_KEY=$(one_line_base64 "$work_dir/public.pem")
CHILD_DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)
CHILD_DATA_HASH_KEY=$(openssl rand -base64 32)
S3_ACCESS_KEY_ID=$(openssl rand -hex 10)
S3_SECRET_ACCESS_KEY=$(password)
BACKUP_ENCRYPTION_PASSPHRASE=$(openssl rand -hex 32)
TURN_SHARED_SECRET=$(password)
LIVEKIT_API_SECRET=$(password)
PGBOUNCER_STATS_PASSWORD=$(password)
REPLICATION_PASSWORD=$(password)
GRAFANA_ADMIN_PASSWORD=$(password)
EOF

if [ $# -eq 0 ]; then
  cat "$work_dir/generated"
  exit 0
fi

target=$1
[ -f "$target" ] || { echo "Không có tệp $target" >&2; exit 1; }

# Chỉ điền dòng dạng TEN= (trống); dòng đã có giá trị hoặc chưa có trong tệp thì báo lại, không ghi đè
filled=""
skipped=""
while IFS= read -r line; do
  name=${line%%=*}
  if grep -q "^${name}=\$" "$target"; then
    awk -v name="$name" -v value="${line#*=}" 'BEGIN { FS = OFS = "=" } $0 == name "=" { print name "=" value; next } { print }' \
      "$target" >"$work_dir/next"
    cat "$work_dir/next" >"$target"
    filled="$filled $name"
  else
    skipped="$skipped $name"
  fi
done <"$work_dir/generated"
chmod 600 "$target"
echo "Đã điền:${filled:- (không có)}"
echo "Giữ nguyên (đã có giá trị hoặc không có dòng trống):${skipped:- (không có)}"
echo "Nhớ cất bản sao CHILD_DATA_ENCRYPTION_KEY, CHILD_DATA_HASH_KEY và BACKUP_ENCRYPTION_PASSPHRASE ở nơi khác máy chủ."
