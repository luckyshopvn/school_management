#!/bin/sh
# Tạo ba loại cơ sở dữ liệu (QĐ-15, QĐ-17); dịch vụ định danh và máy chủ API dùng tài khoản kết nối riêng
set -eu
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres <<SQL
CREATE ROLE identity_service LOGIN PASSWORD '${IDENTITY_DATABASE_PASSWORD}';
CREATE ROLE api_service LOGIN PASSWORD '${API_DATABASE_PASSWORD}';
CREATE DATABASE school_identity OWNER identity_service;
CREATE DATABASE school_system OWNER api_service;
CREATE DATABASE school_year_2026_2027 OWNER api_service;
REVOKE CONNECT ON DATABASE school_identity FROM PUBLIC;
REVOKE CONNECT ON DATABASE school_system FROM PUBLIC;
REVOKE CONNECT ON DATABASE school_year_2026_2027 FROM PUBLIC;
GRANT CONNECT ON DATABASE school_identity TO identity_service;
GRANT CONNECT ON DATABASE school_system TO api_service;
GRANT CONNECT ON DATABASE school_year_2026_2027 TO api_service;
SQL
