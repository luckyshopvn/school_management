#!/bin/sh
# Sinh tệp cấu hình từ tệp mẫu lúc khởi động vùng chứa giám sát (DT-SaaS phần S7a, YCTD-198). Chạy được bằng sh và awk của
# busybox (ảnh prom/*): thay ${TEN_BIEN} bằng giá trị biến môi trường; bỏ khối giữa "# @<kenh>" và "# @end" khi biến bật
# kênh đó trống (email: ALERT_EMAIL_TO, telegram: ALERT_TELEGRAM_CHAT_ID, webhook: ALERT_WEBHOOK_URL); ghi bí mật ra tệp
# riêng quyền 600 để cấu hình đọc bằng *_file. Dùng: render.sh <tệp mẫu> <tệp kết quả>
set -eu
template=$1
output=$2
mkdir -p "$(dirname "$output")" /run/alertmanager 2>/dev/null || true
umask 077
if [ -n "${ALERT_EMAIL_PASSWORD:-}" ]; then printf '%s' "$ALERT_EMAIL_PASSWORD" > /run/alertmanager/email-password; fi
if [ -n "${ALERT_TELEGRAM_BOT_TOKEN:-}" ]; then printf '%s' "$ALERT_TELEGRAM_BOT_TOKEN" > /run/alertmanager/telegram-token; fi
awk '
  function enabled(channel) {
    if (channel == "email") return ENVIRON["ALERT_EMAIL_TO"] != ""
    if (channel == "telegram") return ENVIRON["ALERT_TELEGRAM_CHAT_ID"] != "" && ENVIRON["ALERT_TELEGRAM_BOT_TOKEN"] != ""
    if (channel == "webhook") return ENVIRON["ALERT_WEBHOOK_URL"] != ""
    return 1
  }
  /# @end/ { skip = 0; next }
  /# @[a-z]+/ { match($0, /@[a-z]+/); skip = !enabled(substr($0, RSTART + 1, RLENGTH - 1)); next }
  skip { next }
  {
    line = $0
    while (match(line, /\$\{[A-Z0-9_]+\}/)) {
      name = substr(line, RSTART + 2, RLENGTH - 3)
      line = substr(line, 1, RSTART - 1) ENVIRON[name] substr(line, RSTART + RLENGTH)
    }
    print line
  }
' "$template" > "$output"
