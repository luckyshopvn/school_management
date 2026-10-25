# syntax=docker/dockerfile:1.7
# PostgreSQL 17 kèm WAL-G để lưu nhật ký giao dịch ra kho ngoài máy chủ và khôi phục về một thời điểm (DT-SaaS phần S7b, YCTD-199;
# deploy/profiles/production/PITR.md). Dùng bản Debian của ảnh postgres vì tệp chạy của WAL-G dựng cho glibc (không chạy trên
# Alpine). Phiên bản và mã băm ghim cứng, kiểm khi tải (WAL-G v3.0.9, phát hành 2026-08-20; tra ngày 2026-10-25)
ARG POSTGRES_IMAGE=postgres:17-bookworm
FROM ${POSTGRES_IMAGE}

ARG WALG_VERSION=v3.0.9
ARG WALG_ASSET=wal-g-pg-22.04-amd64.tar.gz
ARG WALG_SHA256=4f03ee4679db7f660bfd1b2b8291ac5df247cd2ec48074b60c112f4897299f24

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl; \
    curl -fsSL -o /tmp/wal-g.tar.gz "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/${WALG_ASSET}"; \
    echo "${WALG_SHA256}  /tmp/wal-g.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/wal-g.tar.gz -C /tmp; \
    install -m 0755 "/tmp/$(basename "${WALG_ASSET}" .tar.gz)" /usr/local/bin/wal-g; \
    rm -rf /tmp/wal-g* /var/lib/apt/lists/*; \
    wal-g --version
