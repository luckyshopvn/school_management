#!/usr/bin/env bash
# Kiểm tra cấu hình của hồ sơ "Vận hành" trước khi triển khai (DT-SaaS phần S7a, YCTD-198): cú pháp Compose với các tổ hợp
# hồ sơ T1, T2, T3 và staging; Caddyfile; Prometheus, luật cảnh báo; Alertmanager; Loki. Dùng giá trị giả, không cần
# production.env. Cần Docker. Dùng: scripts/check-config.sh
set -euo pipefail
PROFILE_DIR=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
# Đường dẫn gắn vào vùng chứa (Git Bash trên Windows cần đường dẫn dạng Windows)
host_path() { (cd "$1" && (pwd -W 2>/dev/null || pwd)); }

fake_env() {
  local file=$1
  sed -E 's/^([A-Z0-9_]+)=$/\1=gia-tri-gia/' "$2" > "$file"
}

fake_env "$WORK/production.env" "$PROFILE_DIR/production.env.example"
fake_env "$WORK/staging.env" "$PROFILE_DIR/staging.env.example"

check_compose() {
  local label=$1 env_file=$2 profiles=$3
  shift 3
  COMPOSE_PROFILES="$profiles" docker compose -f "$PROFILE_DIR/compose.yml" "$@" --env-file "$env_file" config --quiet
  echo "Compose $label: hợp lệ"
}

check_compose 'T1' "$WORK/production.env" 'db,app,seaweedfs,monitoring'
check_compose 'T2 máy cơ sở dữ liệu' "$WORK/production.env" 'db,monitoring-agent'
check_compose 'T2 máy ứng dụng' "$WORK/production.env" 'app,seaweedfs,monitoring'
check_compose 'T3 máy bản sao' "$WORK/production.env" 'replica,monitoring-agent'
check_compose 'staging cùng VPS' "$WORK/staging.env" 'db,app,seaweedfs,demo' -f "$PROFILE_DIR/compose.edge.yml"

MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(host_path "$PROFILE_DIR/caddy"):/etc/caddy:ro" \
  -e ACME_EMAIL=van-hanh@he-thong.test -e DOMAIN_CHECK_URL=http://api-a:3000/check \
  -e 'API_UPSTREAMS=api-a:3000 api-b:3000' -e 'IDENTITY_UPSTREAMS=identity-a:3001 identity-b:3001' \
  -e CATCH_ALL_ADDRESS=https:// -e TLS_MODE=on-demand -e TENANT_PATHS=on \
  caddy:2.10-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
  && echo 'Caddyfile: hợp lệ' || { echo 'Caddyfile: LỖI'; exit 1; }

mkdir -p "$WORK/monitoring"
cp -r "$PROFILE_DIR/monitoring/." "$WORK/monitoring/"
MSYS_NO_PATHCONV=1 docker run --rm -v "$(host_path "$WORK/monitoring"):/m" -e ENVIRONMENT_NAME=kiem-tra -e HOST_LABEL=vps-1 \
  --entrypoint /bin/sh prom/prometheus:v2.54.1 -c \
  'sh /m/render.sh /m/prometheus.yml /tmp/p.yml && sed "s#/etc/prometheus/rules#/m/rules#; s#/etc/prometheus/targets.d#/m/targets.d#" /tmp/p.yml > /tmp/q.yml && promtool check config --syntax-only /tmp/q.yml && promtool check rules /m/rules/*.yml' \
  >/dev/null && echo 'Prometheus, luật cảnh báo: hợp lệ'
MSYS_NO_PATHCONV=1 docker run --rm -v "$(host_path "$WORK/monitoring"):/m" --user root \
  -e ALERT_EMAIL_TO=van-hanh@he-thong.test -e ALERT_EMAIL_FROM=canh-bao@he-thong.test \
  -e ALERT_EMAIL_SMARTHOST=smtp.he-thong.test:587 -e ALERT_EMAIL_USERNAME=canh-bao -e ALERT_EMAIL_PASSWORD=gia \
  -e ALERT_TELEGRAM_BOT_TOKEN=123:gia -e ALERT_TELEGRAM_CHAT_ID=-100123 -e ALERT_WEBHOOK_URL=http://chuyen-tiep.test/zalo \
  --entrypoint /bin/sh prom/alertmanager:v0.27.0 -c \
  'sh /m/render.sh /m/alertmanager.yml /tmp/a.yml && amtool check-config /tmp/a.yml' >/dev/null \
  && echo 'Alertmanager (đủ ba kênh): hợp lệ'
MSYS_NO_PATHCONV=1 docker run --rm -v "$(host_path "$WORK/monitoring"):/m" --user root \
  --entrypoint /bin/sh prom/alertmanager:v0.27.0 -c \
  'sh /m/render.sh /m/alertmanager.yml /tmp/a.yml && amtool check-config /tmp/a.yml' >/dev/null \
  && echo 'Alertmanager (không kênh nào): hợp lệ'
MSYS_NO_PATHCONV=1 docker run --rm -v "$(host_path "$WORK/monitoring"):/m" grafana/loki:3.2.1 \
  -config.file=/m/loki.yml -verify-config >/dev/null 2>&1 && echo 'Loki: hợp lệ'
