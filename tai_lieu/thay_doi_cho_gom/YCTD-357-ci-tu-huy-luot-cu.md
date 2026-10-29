---
yctd: YCTD-357
tieu_de: CI tự huỷ lượt chạy cũ của cùng PR hoặc cùng nhánh
ngay: 2026-10-29
phien_ban_de_xuat: 0.237.0
---

## 02 Nhật ký

### 2026-10-29 — CI tự huỷ lượt chạy cũ của cùng PR hoặc cùng nhánh (YCTD-357)

#### Công việc đã thực hiện

- Thêm khối `concurrency` ở cấp workflow của `.github/workflows/ci.yml`: khoá gồm tên workflow, loại sự kiện và số PR (nhánh khác thì ref), `cancel-in-progress: true`. Lượt chạy mới của cùng PR hoặc cùng nhánh huỷ lượt cũ đang chạy hoặc đang chờ.

#### Quyết định

- Loại sự kiện nằm trong khoá để lượt chạy đêm (schedule) và lượt push của main không huỷ lẫn nhau; khoá theo số PR để các PR nối tiếp nhau không chạy trùng hai lượt cho một head (Eric duyệt ngày 2026-10-29).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-357, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-357: CI tự huỷ lượt chạy cũ của cùng PR hoặc cùng nhánh – 2026-10-29

- Lý do: hàng chờ CI nghẽn vì nhiều lượt chạy cho các bản main cũ, lượt trùng và lượt cũ của PR (ngày 2026-10-29 phải huỷ tay 14 lượt).
- Nội dung thay đổi: khối `concurrency` ở cấp workflow, `cancel-in-progress: true`; không đổi việc (job) nào.
- Thành phần bị ảnh hưởng: `.github/workflows/ci.yml`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: CI tự huỷ lượt chạy cũ của cùng PR hoặc cùng nhánh (YCTD-357).

## 01 Bảng phiên bản

| {PHIEN_BAN} | CI tự huỷ lượt chạy cũ của cùng PR hoặc cùng nhánh | YCTD-357 |
