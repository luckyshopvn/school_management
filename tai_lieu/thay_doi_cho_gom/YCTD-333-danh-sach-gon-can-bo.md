---
yctd: YCTD-333
tieu_de: Cổng quản trị: lưới dữ liệu gọn (menu Thêm, thanh Đã chọn) và danh sách cán bộ theo thiết kế
ngay: 2026-10-29
phien_ban_de_xuat: 0.209.0
---

## 02 Nhật ký

### 2026-10-29 — Cổng quản trị: lưới dữ liệu gọn và danh sách cán bộ theo thiết kế (YCTD-333)

#### Công việc đã thực hiện

- Lưới dữ liệu dùng chung (`packages/ui` DataGrid): nút "Xuất PDF" và "Cấu hình cột hiển thị" vào menu "Thêm" (menu button theo WAI-ARIA, `MoreMenu`); thêm `moreActions` (thao tác phụ của màn hình vào cùng menu) và `selectionActions` (thao tác trên dòng đã chọn, chỉ hiện ở thanh "Đã chọn" khi có dòng được chọn, kèm nút Bỏ chọn). Áp cho mọi màn hình dùng lưới.
- 3.1.1 Hồ sơ cán bộ, giáo viên: thanh công cụ còn Nhập từ Excel (mở 3.1.3), Thêm mới; Thay đổi, Xóa ở thanh "Đã chọn"; Xuất Excel, Xuất tệp theo mẫu Bộ, Xuất file lỗi ở menu Thêm; cột Ngày sinh, Giới tính, Dân tộc, Nhóm chức vụ, Hình thức hợp đồng, Trình độ chuyên môn ẩn mặc định (bật ở Cấu hình cột hiển thị); ô mã định danh Bộ trống ghi chữ xám thay nhãn đỏ.
- Trợ giúp e2e `tests/e2e/grid.ts` (`gridMoreItem`, `clickGridMoreItem`); sửa kịch bản 04, 51, 54, 55, 58, 60, 184.

#### Quyết định

- Không bỏ chức năng: mọi nút cũ vẫn còn, chỉ dời vào menu Thêm hoặc thanh "Đã chọn"; cột ẩn vẫn bật lại được và vẫn xuất Excel theo cột đang hiện.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-333, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Áp cùng mẫu cho danh sách học sinh, lớp, văn bản, thu phí và các trang khác ở các PR sau.

## 24 Yêu cầu thay đổi

### YCTD-333: Cổng quản trị: lưới dữ liệu gọn và danh sách cán bộ theo thiết kế – 2026-10-29

- Lý do: thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28: thanh công cụ danh sách có 6 đến 9 nút ngang, nút thao tác hàng loạt hiện mờ thường trực, bảng hơn 12 cột mặc định làm tên xuống nhiều dòng.
- Nội dung thay đổi: menu "Thêm" ở lưới dùng chung; thanh "Đã chọn" cho thao tác hàng loạt; danh sách cán bộ gọn theo thiết kế. Kịch bản CT-15d-10 kiểm cột mặc định mới; CT-16f-11 kiểm Thay đổi, Xóa chỉ hiện khi chọn dòng.
- Thành phần bị ảnh hưởng: `packages/ui/src/DataGrid.tsx`, `MoreMenu.tsx`, `index.ts`; `apps/portal/src/staff/StaffPage.tsx`; `tests/e2e/grid.ts`, `04-accounts`, `51-students-so`, `54-school-classes-so`, `55-staff-so`, `58-export-import-tools`, `60-staff-full-so`, `184-tablet-portal-platform`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: lưới dữ liệu gọn và danh sách cán bộ theo thiết kế (YCTD-333).
- Menu "Thêm" ở mọi lưới dữ liệu; thanh "Đã chọn" cho thao tác hàng loạt; danh sách cán bộ ít cột mặc định hơn.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng quản trị: lưới dữ liệu gọn, danh sách cán bộ theo thiết kế | YCTD-333 |
