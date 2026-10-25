#!/bin/sh
# Sinh cấu hình PgBouncer từ biến môi trường rồi chạy (DT-SaaS phần S7a, YCTD-198).
#
# Chế độ gom:
# - mặc định `transaction` cho cơ sở dữ liệu định danh và mọi cơ sở dữ liệu năm học (`*`): mã dùng múi giờ đặt ở mức cơ sở
#   dữ liệu (`alter database ... set timezone`), khóa tư vấn chỉ dạng theo giao dịch (`pg_advisory_xact_lock`), không
#   `LISTEN`, không `SET` theo phiên, không câu lệnh chuẩn bị có tên, nên chạy đúng khi gom theo giao dịch;
# - `session` cho cơ sở dữ liệu hệ thống (`PGBOUNCER_SESSION_DATABASES`, mặc định `school_system`): thao tác mở năm học giữ
#   khóa tư vấn theo phiên (`pg_try_advisory_lock` rồi `pg_advisory_unlock` trên cùng một kết nối) và tạo cơ sở dữ liệu
#   năm học, phải đi trên một kết nối máy chủ suốt thao tác.
# Lệnh migrate không đi qua PgBouncer (nối thẳng PostgreSQL).
#
# Xác thực: mỗi tài khoản trong PGBOUNCER_USERS (dạng `ten:BIEN_MAT_KHAU`, cách nhau bằng dấu cách) lấy mật khẩu từ biến
# môi trường có tên BIEN_MAT_KHAU, ghi vào userlist.txt (quyền 600, chỉ trong vùng chứa). PgBouncer xác thực bằng SCRAM với
# PostgreSQL. Khi có vai trò riêng cho từng trường (DT-SaaS S1a, S2), danh sách sinh từ cơ sở dữ liệu nền tảng thay cho
# biến này.
set -eu

: "${PGBOUNCER_UPSTREAM_HOST:=postgres}"
: "${PGBOUNCER_UPSTREAM_PORT:=5432}"
: "${PGBOUNCER_PORT:=6432}"
: "${PGBOUNCER_DEFAULT_POOL_SIZE:=10}"
: "${PGBOUNCER_MIN_POOL_SIZE:=0}"
: "${PGBOUNCER_RESERVE_POOL_SIZE:=5}"
: "${PGBOUNCER_MAX_CLIENT_CONN:=2000}"
: "${PGBOUNCER_MAX_DB_CONNECTIONS:=40}"
: "${PGBOUNCER_SERVER_IDLE_TIMEOUT:=300}"
: "${PGBOUNCER_SESSION_DATABASES:=school_system}"
: "${PGBOUNCER_STATS_USER:=pgbouncer_stats}"
: "${PGBOUNCER_USERS:?Thiếu PGBOUNCER_USERS (dạng ten:BIEN_MAT_KHAU ...)}"

CONFIG=/etc/pgbouncer/pgbouncer.ini
USERLIST=/etc/pgbouncer/userlist.txt
umask 077

: > "$USERLIST"
for entry in $PGBOUNCER_USERS; do
  name=${entry%%:*}
  variable=${entry#*:}
  eval "password=\${$variable:-}"
  if [ -z "$password" ]; then
    echo "Thiếu mật khẩu cho tài khoản $name (biến $variable)" >&2
    exit 1
  fi
  printf '"%s" "%s"\n' "$name" "$password" >> "$USERLIST"
done
# Tài khoản xem thống kê (giám sát): không có mật khẩu thì chỉ cho kết nối từ trong vùng chứa (kiểm tra sức khỏe)
if [ -n "${PGBOUNCER_STATS_PASSWORD:-}" ]; then
  printf '"%s" "%s"\n' "$PGBOUNCER_STATS_USER" "$PGBOUNCER_STATS_PASSWORD" >> "$USERLIST"
fi

upstream="host=$PGBOUNCER_UPSTREAM_HOST port=$PGBOUNCER_UPSTREAM_PORT"
{
  echo '[databases]'
  for database in $PGBOUNCER_SESSION_DATABASES; do
    echo "$database = $upstream pool_mode=session"
  done
  # Mọi cơ sở dữ liệu khác (định danh, các năm học, cơ sở dữ liệu mở sau) theo tên kết nối, gom theo giao dịch
  echo "* = $upstream"
  echo
  echo '[pgbouncer]'
  echo "listen_addr = 0.0.0.0"
  echo "listen_port = $PGBOUNCER_PORT"
  echo "unix_socket_dir = /var/run/pgbouncer"
  echo "auth_type = scram-sha-256"
  echo "auth_file = $USERLIST"
  echo "pool_mode = transaction"
  echo "default_pool_size = $PGBOUNCER_DEFAULT_POOL_SIZE"
  echo "min_pool_size = $PGBOUNCER_MIN_POOL_SIZE"
  echo "reserve_pool_size = $PGBOUNCER_RESERVE_POOL_SIZE"
  echo "max_client_conn = $PGBOUNCER_MAX_CLIENT_CONN"
  echo "max_db_connections = $PGBOUNCER_MAX_DB_CONNECTIONS"
  echo "server_idle_timeout = $PGBOUNCER_SERVER_IDLE_TIMEOUT"
  # Đóng kết nối máy chủ của cơ sở dữ liệu rảnh để hàng trăm cơ sở dữ liệu nhỏ không giữ kết nối
  echo "autodb_idle_timeout = 600"
  echo "server_reset_query = DISCARD ALL"
  echo "server_reset_query_always = 0"
  echo "ignore_startup_parameters = extra_float_digits,options"
  echo "max_prepared_statements = 200"
  echo "stats_users = $PGBOUNCER_STATS_USER"
  echo "log_connections = 0"
  echo "log_disconnections = 0"
  echo "log_pooler_errors = 1"
  echo "stats_period = 60"
} > "$CONFIG"

exec pgbouncer "$CONFIG"
