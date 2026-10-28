---
yctd: YCTD-307
tieu_de: Chọn phân hệ ở cổng quản trị thì mở trang của phân hệ mới
ngay: 2026-10-28
phien_ban_de_xuat: 0.184.0
---

## 02 Nhật ký

### 2026-10-28 — Chọn phân hệ ở cổng quản trị thì mở trang của phân hệ mới

#### Công việc đã thực hiện

- Sửa lỗi Eric báo: chọn phân hệ khác ở ô Phân hệ chỉ đổi menu ngang, vùng nội dung vẫn là trang của phân hệ cũ nên phải tự bấm mục menu.
- Ô Phân hệ chọn phân hệ khác thì mở trang đầu của phân hệ đó (mục menu có đường dẫn đầu tiên trong cây menu đã lọc theo quyền); chọn lại phân hệ đang mở thì giữ nguyên trang.
- Khung trang chỉ tự chuyển menu theo trang khi trang không thuộc phân hệ đang chọn, nên trang có mặt ở nhiều phân hệ không kéo menu về phân hệ cũ.
- Bổ sung kịch bản e2e CT-15a-9: chọn phân hệ thì đường dẫn chuyển sang một trang của phân hệ đó.

#### Quyết định

- Trang đích là mục menu đầu tiên người dùng có quyền, vì các phân hệ chưa có trang tổng quan riêng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-307, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-307: Chọn phân hệ ở cổng quản trị thì mở trang của phân hệ mới – 2026-10-28

- Lý do: Eric báo lỗi chuyển phân hệ mà màn hình chưa chuyển sang phân hệ mới, phải tự bấm.
- Nội dung thay đổi: Ô Phân hệ chọn phân hệ khác thì điều hướng tới trang đầu của phân hệ theo quyền; khung trang ưu tiên giữ phân hệ đang chọn khi trang thuộc nhiều phân hệ.
- Thành phần bị ảnh hưởng: `apps/portal/src/pages/workspaces.tsx`, `apps/portal/src/pages/AppShell.tsx`, `tests/e2e/01-login.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: chọn phân hệ ở cổng quản trị thì mở trang của phân hệ mới (YCTD-307).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Chọn phân hệ ở cổng quản trị thì mở trang của phân hệ mới | YCTD-307 |
