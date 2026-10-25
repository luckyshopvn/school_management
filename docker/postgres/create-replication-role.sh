#!/bin/sh
# Vai trò sao chép cho bản sao chỉ đọc (DT-SaaS phần S7a, YCTD-198, cách đặt T3). Chạy một lần ở lần khởi tạo đầu của
# PostgreSQL chính, sau create-databases.sh. Không đặt REPLICATION_PASSWORD thì bỏ qua (T1, T2 không có bản sao).
# Bản sao chỉ nối được từ dải địa chỉ REPLICATION_ALLOWED_CIDR (mạng riêng giữa các máy), bằng SCRAM.
set -eu
if [ -z "${REPLICATION_PASSWORD:-}" ]; then
  echo "Không đặt REPLICATION_PASSWORD: bỏ qua vai trò sao chép"
  exit 0
fi
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres <<SQL
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '${REPLICATION_PASSWORD}';
SQL
echo "host replication replicator ${REPLICATION_ALLOWED_CIDR:-10.0.0.0/8} scram-sha-256" >> "$PGDATA/pg_hba.conf"
