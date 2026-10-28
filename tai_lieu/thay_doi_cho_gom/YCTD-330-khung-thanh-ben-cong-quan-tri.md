---
yctd: YCTD-330
tieu_de: Thiết kế lại cổng quản trị trường, phần khung chung: thanh bên trái, giữ số thứ bậc
ngay: 2026-10-28
phien_ban_de_xuat: 0.206.0
---

## 02 Nhật ký

### 2026-10-28 — Thiết kế lại cổng quản trị trường, phần khung chung (YCTD-330)

#### Công việc đã thực hiện

- Khảo sát mã `apps/portal` và bản chạy trên máy, lập danh sách yếu tố thừa về hình thức; vẽ canvas thiết kế 14 màn "Cổng quản trị trường" (khung chung, đăng nhập, bảng điều khiển, cán bộ, hồ sơ cán bộ, học sinh, lớp, điểm danh, sổ điểm, thời khóa biểu, Công văn của tôi, văn bản đến và đi, thu phí, cài đặt trường). Eric duyệt ngày 2026-10-28.
- Làm phần khung chung: thanh bên trái xanh đậm có tên trường, ô chọn phân hệ (thêm ô lọc khi có hơn 8 phân hệ) và cây menu đánh số gập mở của phân hệ đang chọn; nhóm chứa trang đang mở tự mở; dưới 1280 px thanh bên là ngăn kéo. Thanh đầu trang giữ cấp học, năm học, Việc của tôi, chuông, ứng dụng liên kết, menu người dùng. Bỏ chân trang, "Gửi phản hồi" chuyển vào menu người dùng. Trang chủ bỏ tiêu đề "Tổng quan phân hệ" và khối Lối tắt (trùng cây menu). Màu nút chính, thanh đầu trang đổi sang xanh đậm (#1f4e8c, #12304f) trong cổng quản trị.
- Đổi trợ giúp e2e `tests/e2e/menu.ts` sang thanh bên (`sideMenu`, `workspaceMenu`, `openGroup`); sửa kịch bản 01, 53, 83, 184 theo khung mới.

#### Quyết định

- GD-159: thanh bên trái thay menu ngang của DT-15 phần 15a. GD-160: giữ số thứ bậc theo Sở trên menu. Ghi ở `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 21.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-330, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chưa làm ở phần này: gom cấp học, năm học, học kỳ vào một nút; dải thông báo một dòng thay hộp bật lên; ô tìm chung ở đầu trang; trang "Tất cả chức năng"; nhóm "Hay dùng" khi chọn phân hệ; phông chữ Be Vietnam Pro. Các trang theo thiết kế làm ở YCTD-331 trở đi.
- Chưa xem tận mắt trên máy: bản chạy thử ở cổng riêng không nhận ra trường qua proxy; dựa vào kiểm thử giao diện trên CI.

## 24 Yêu cầu thay đổi

### YCTD-330: Thiết kế lại cổng quản trị trường, phần khung chung – 2026-10-28

- Lý do: Eric yêu cầu thiết kế lại cổng quản trị cho gọn, bỏ yếu tố thừa (menu ngang ba cấp, chân trang chỉ chứa một nút, khối Lối tắt trùng menu, tiêu đề chồng nhau ở trang chủ); Eric duyệt bản thiết kế ngày 2026-10-28, chọn giữ số thứ bậc.
- Nội dung thay đổi: thanh bên trái thay menu ngang (GD-159), giữ số thứ bậc (GD-160); ô chọn phân hệ ở thanh bên có ô lọc; bỏ chân trang, Gửi phản hồi ở menu người dùng; bỏ khối Lối tắt, tiêu đề "Tổng quan phân hệ"; màu xanh đậm. Kịch bản CT-15a-7, CT-15a-8 đổi sang thao tác thanh bên bằng chuột, bàn phím; CT-15a-11 thêm mục Gửi phản hồi; CT-26e-1 kiểm thanh bên từ 1280 px.
- Thành phần bị ảnh hưởng: `apps/portal/src/pages/AppShell.tsx`, `MainMenu.tsx`, `workspaces.tsx`, `UserMenu.tsx`, `WorkspaceDashboard.tsx`, `apps/portal/src/index.css`; `tests/e2e/menu.ts`, `01-login`, `53-feedback-password-expiry`, `83-school-level-menu`, `184-tablet-portal-platform`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: khung chung mới của cổng quản trị trường (YCTD-330).
- Thanh bên trái theo phân hệ, cây menu đánh số gập mở; ô chọn phân hệ có ô lọc; bỏ chân trang; Gửi phản hồi ở menu người dùng; trang chủ bỏ Lối tắt và tiêu đề "Tổng quan phân hệ"; màu xanh đậm.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Thiết kế lại cổng quản trị trường: khung chung, thanh bên trái | YCTD-330 |
