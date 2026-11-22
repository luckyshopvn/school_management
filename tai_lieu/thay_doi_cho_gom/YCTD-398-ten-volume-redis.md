---
yctd: YCTD-398
tieu_de: Đặt tên volume cho Redis ở môi trường phát triển
ngay: 2026-11-22
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-11-22 — Đặt tên volume cho Redis ở môi trường phát triển

#### Công việc đã thực hiện

- `docker-compose.yml`: dịch vụ `redis` gắn volume có tên `redis-data` vào `/data`, khai báo `redis-data` ở mục `volumes`.

#### Quyết định

- Dùng tên `redis-data` giống `deploy/docker-compose.production.yml` và `deploy/profiles/production/compose.yml`. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-398.

#### Vấn đề tồn đọng

- Máy đã chạy môi trường phát triển trước thay đổi này còn một volume ẩn danh cũ của Redis; xóa bằng `docker volume prune` hoặc `docker volume rm <mã volume>`.

## 24 Yêu cầu thay đổi

### YCTD-398: Đặt tên volume cho Redis ở môi trường phát triển – 2026-11-22

- Lý do: ảnh `redis:7-alpine` khai báo `/data` là volume; `docker-compose.yml` không gắn volume có tên nên mỗi lần tạo lại container Redis sinh một volume ẩn danh mới, volume cũ bị bỏ lại.
- Nội dung thay đổi: gắn volume có tên `redis-data` vào `/data` của dịch vụ `redis` trong `docker-compose.yml`.
- Thành phần bị ảnh hưởng: chỉ môi trường phát triển trên máy cục bộ; không đổi mã nguồn, cơ sở dữ liệu, API, giao diện, phân quyền, hồ sơ triển khai.
- Dữ liệu bị ảnh hưởng: không; Redis ở môi trường phát triển chỉ giữ dữ liệu tạm.
- Kiểm thử cần làm: `docker compose config` hợp lệ; `docker compose up -d redis` tạo volume `school_management_redis-data`, Redis trả `PONG`.
- Trạng thái: Đã triển khai
