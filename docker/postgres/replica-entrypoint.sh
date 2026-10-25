#!/bin/sh
# Khởi động bản sao chỉ đọc của PostgreSQL (DT-SaaS phần S7a, YCTD-198, cách đặt T3). Lần đầu (thư mục dữ liệu trống) lấy
# bản sao cơ bản từ máy chính bằng pg_basebackup kèm khe sao chép, ghi sẵn cấu hình nối máy chính (-R); các lần sau chạy
# PostgreSQL như thường. Bản sao chỉ đọc, dùng để chuyển sang khi máy chính hỏng (thao tác tay, xem README) và để sao lưu
# không làm nặng máy chính.
set -eu
: "${PRIMARY_HOST:?Thiếu PRIMARY_HOST}"
: "${PRIMARY_PORT:=5432}"
: "${REPLICATION_PASSWORD:?Thiếu REPLICATION_PASSWORD}"
: "${REPLICATION_SLOT:=replica_1}"
PGDATA=${PGDATA:-/var/lib/postgresql/data}

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Thư mục dữ liệu trống: lấy bản sao cơ bản từ $PRIMARY_HOST:$PRIMARY_PORT"
  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
  chmod 0700 "$PGDATA"
  # Ảnh postgres chính thức có gosu (bản cũ dùng su-exec)
  if command -v gosu >/dev/null 2>&1; then as_postgres="gosu postgres"; else as_postgres="su-exec postgres"; fi
  $as_postgres env PGPASSWORD="$REPLICATION_PASSWORD" pg_basebackup \
    -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" -U replicator -D "$PGDATA" \
    -X stream -R -C -S "$REPLICATION_SLOT" --checkpoint=fast --progress
fi
exec docker-entrypoint.sh postgres -c hot_standby=on "$@"
