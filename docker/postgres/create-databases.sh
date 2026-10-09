#!/bin/sh
# Tạo cơ sở dữ liệu định danh và cơ sở dữ liệu hệ thống (QĐ-15, QĐ-17); dịch vụ định danh và máy chủ API dùng tài khoản kết nối riêng.
# Cơ sở dữ liệu năm học do máy chủ API tạo khi mở năm học nên api_service có quyền tạo cơ sở dữ liệu (QĐ-21).
set -eu
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres <<SQL
CREATE ROLE identity_service LOGIN PASSWORD '${IDENTITY_DATABASE_PASSWORD}';
CREATE ROLE api_service LOGIN CREATEDB PASSWORD '${API_DATABASE_PASSWORD}';
CREATE DATABASE school_identity OWNER identity_service;
CREATE DATABASE school_system OWNER api_service;
REVOKE CONNECT ON DATABASE school_identity FROM PUBLIC;
REVOKE CONNECT ON DATABASE school_system FROM PUBLIC;
GRANT CONNECT ON DATABASE school_identity TO identity_service;
GRANT CONNECT ON DATABASE school_system TO api_service;
SQL
