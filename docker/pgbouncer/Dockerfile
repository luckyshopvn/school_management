# PgBouncer cho hồ sơ "Vận hành" (DT-SaaS phần S7a, YCTD-198). Dựng từ gói pgbouncer của Alpine để không phụ thuộc ảnh của
# bên thứ ba; cấu hình và danh sách xác thực sinh lúc khởi động từ biến môi trường (docker/pgbouncer/entrypoint.sh)
ARG ALPINE_IMAGE=alpine:3.20
FROM ${ALPINE_IMAGE}
RUN apk add --no-cache pgbouncer postgresql16-client \
  && addgroup -S pgbouncer && adduser -S -D -H -G pgbouncer pgbouncer \
  && mkdir -p /etc/pgbouncer /var/run/pgbouncer \
  && chown -R pgbouncer:pgbouncer /etc/pgbouncer /var/run/pgbouncer
COPY docker/pgbouncer/entrypoint.sh /usr/local/bin/pgbouncer-entrypoint
RUN chmod 0755 /usr/local/bin/pgbouncer-entrypoint
USER pgbouncer
EXPOSE 6432
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD pg_isready -h 127.0.0.1 -p 6432 -U "${PGBOUNCER_STATS_USER:-pgbouncer_stats}" -d pgbouncer || exit 1
ENTRYPOINT ["/usr/local/bin/pgbouncer-entrypoint"]
