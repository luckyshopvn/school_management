---
yctd: YCTD-384
tieu_de: Thiết kế lại giao diện, lát L2: khung cổng quản trị, vùng chạm ở mọi khổ, thanh chọn nhiều dính đáy
ngay: 2026-10-30
phien_ban_de_xuat: 0.254.0
---

## 02 Nhật ký

### 2026-10-30 — Thiết kế lại giao diện, lát L2: khung cổng quản trị (YCTD-384)

#### Công việc đã thực hiện

- Vùng chạm 44 điểm ảnh và chữ ô nhập 16 điểm ảnh của cổng quản trị áp ở mọi khổ màn hình (KC-10, TN-04), trước chỉ dưới 1280 điểm ảnh; bỏ lớp `touch-layout` riêng của trang đăng nhập vì đã thừa.
- Khung trang: lớp phong cách `pc-hanh-chinh`; thanh bên luôn hiện từ 1024 điểm ảnh (trước 1280), dưới 1024 là ngăn menu; thanh đầu trang nền trắng, viền dưới từ 768 điểm ảnh, xanh đậm trên điện thoại, chừa vùng an toàn; các nút trên thanh đầu trang (ô tìm, năm học, Việc của tôi, chuông, ứng dụng liên kết, menu người dùng) dùng màu chữ kế thừa và cao 44 điểm ảnh; mục menu cao 44 điểm ảnh ở mọi khổ.
- Dải "Thông báo" khi vào trang: trên điện thoại mỗi thông báo cắt một dòng, nút "Xem đủ" mở hết (TD-24); máy tính giữ như cũ.
- Lưới dùng chung `DataGrid`: dải "Đã chọn N dòng" kèm thao tác thành thanh dính đáy màn hình dưới 768 điểm ảnh, chừa vùng an toàn (TD-28); ô chọn dòng 44 điểm ảnh ở mọi khổ.
- Sửa chữ dưới 14 điểm ảnh: số đếm ở chuông thông báo và Việc của tôi (11), ghi chú thẻ số liệu trang chủ (13), nhóm kết quả ô tìm chức năng (12), nhãn "Phân hệ" (12), chữ trong ô thời khóa biểu (12).
- Kiểm thử e2e 184 (CT-26e-1, CT-26e-2) sửa theo mốc mới: thanh bên từ 1024 điểm ảnh; cổng quản trị kiểm vùng chạm, chữ ô nhập ở mọi khổ.

#### Quyết định

- Bản mẫu vẽ dải biểu tượng 72 điểm ảnh cho máy tính bảng, nhưng menu cổng quản trị (23 phân hệ, mục có số thứ bậc) không có biểu tượng cho từng nhóm; tự vẽ là việc thiết kế mới chưa duyệt. Lát này hiện thanh bên đầy đủ từ 1024 điểm ảnh, dưới 1024 là ngăn menu; điều phối chọn thay Eric theo khuyến nghị ngày 2026-10-30, Eric có thể đổi. Đã ghi ở tài liệu `14` BC-11, `15` KC-09, đặc tả `tai_lieu/ban_mau/yctd-384/DAC_TA.md`.
- Ẩn cột phụ của lưới ở máy tính bảng dời sang lát L3 cùng các bảng nhiều cột.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-384, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chưa chụp được ảnh thật ở ba khổ: bản nhiều trường trên máy đã tắt khi ứng dụng bị thoát, chạy lại thì máy hết bộ nhớ (còn khoảng 160 MB RAM, nhiều phiên khác đang chạy kiểm kiểu). Chụp ở điểm xem trước khi máy đủ bộ nhớ.

## 24 Yêu cầu thay đổi

### YCTD-384: Thiết kế lại giao diện, lát L2: khung cổng quản trị – 2026-10-30

- Lý do: lát L2 của YCTD-384 theo danh sách lát Eric duyệt ngày 2026-10-30.
- Nội dung thay đổi: vùng chạm 44, chữ ô nhập 16 điểm ảnh ở mọi khổ; thanh bên từ 1024 điểm ảnh; thanh đầu trang nền trắng từ 768 điểm ảnh; dải thông báo gọn trên điện thoại; thanh chọn nhiều của lưới dính đáy trên điện thoại; sửa chữ dưới 14 điểm ảnh.
- Thành phần bị ảnh hưởng: `apps/portal/src/index.css`, `pages/AppShell.tsx`, `MainMenu.tsx`, `FunctionSearch.tsx`, `AcademicYearSwitcher.tsx`, `UserMenu.tsx`, `workspaces.tsx`, `LoginPage.tsx`, `portal-shell/AppLauncher.tsx`, `StartupNotices.tsx`, `notifications/NotificationBell.tsx`, `my-work/MyWorkBadge.tsx`, `reports/DashboardCards.tsx`, `timetables/TimetablesPage.tsx`; `packages/ui/src/DataGrid.tsx`; `tests/e2e/184-tablet-portal-platform.spec.ts`, `tests/e2e/menu.ts`; tài liệu 14, 15.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không đổi chức năng; trên máy tính các nút, ô nhập nhỏ cao lên 44 điểm ảnh; máy tính bảng ngang (1024 đến 1279) thấy thanh bên thay ngăn menu.
- Kiểm thử cần thực hiện: kiểm kiểu, lint, toàn bộ e2e (đặc biệt 184, 59, 185 và các spec dùng `selectWorkspace`).
- Mức: Lớn (thuộc YCTD-384). Người phê duyệt: Eric, ngày 2026-10-30 (bản mẫu, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: thiết kế lại giao diện, lát L2: khung cổng quản trị, vùng chạm 44 điểm ảnh và chữ ô nhập 16 điểm ảnh ở mọi khổ, thanh bên từ 1024 điểm ảnh, thanh chọn nhiều dính đáy trên điện thoại (YCTD-384).
- Quay lui: hoàn tác commit hợp nhất của PR; không có database migration.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Thiết kế lại giao diện, lát L2: khung cổng quản trị | YCTD-384 |
