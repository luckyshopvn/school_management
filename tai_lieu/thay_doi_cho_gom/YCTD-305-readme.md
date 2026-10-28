---
yctd: YCTD-305
tieu_de: README song ngữ ở gốc kho mã
ngay: 2026-10-28
phien_ban_de_xuat: 0.178.0
---

## 02 Nhật ký

### 2026-10-28 — README song ngữ

#### Công việc đã thực hiện

- Thêm `README.md` (tiếng Việt, bản chính) và `README.en.md` (tiếng Anh) ở gốc kho mã, có liên kết chuyển ngôn ngữ ở đầu mỗi tệp: giới thiệu, tính năng theo nhóm, kiến trúc (sơ đồ mermaid), chạy trên máy, kiểm thử, triển khai, quy ước đóng góp, giấy phép.
- Nội dung lấy từ `package.json`, `pnpm-workspace.yaml`, `docker-compose.yml`, `.env.example`, `deploy/`, `.github/workflows/ci.yml` và bộ tài liệu `tai_lieu/`.

#### Quyết định

- Kho chưa có tệp `LICENSE`: README ghi "chưa có giấy phép", không tự chọn giấy phép.
- `apps/student` (PR 224) và `apps/tutor` (PR 223) ghi rõ là đang tách, chưa có trên `main`; khi hai PR gộp thì cập nhật bảng thư mục.
- README không chứa khoá, mật khẩu, địa chỉ nội bộ hay dữ liệu thật, không khẳng định tuân thủ hay chứng nhận.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-305, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chủ dự án chọn giấy phép thì thêm `LICENSE` và sửa mục "Giấy phép" của hai README.

## 24 Yêu cầu thay đổi

### YCTD-305: README song ngữ ở gốc kho mã – 2026-10-28

- Lý do: kho mã công khai chưa có README ở gốc; chủ dự án (Eric) yêu cầu thêm bản tiếng Việt và tiếng Anh.
- Nội dung thay đổi: thêm `README.md`, `README.en.md`.
- Thành phần bị ảnh hưởng: chỉ tài liệu ở gốc kho mã.
- Dữ liệu, API, giao diện, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: định dạng (`pnpm format:check`), kiểm tệp mảnh (`node scripts/gom-thay-doi.mjs --kiem`), kiểm các liên kết tương đối.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: thêm README song ngữ ở gốc kho mã (YCTD-305).
- Không đổi hành vi chạy, không đổi cấu trúc dữ liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | README song ngữ ở gốc kho mã | YCTD-305 |
