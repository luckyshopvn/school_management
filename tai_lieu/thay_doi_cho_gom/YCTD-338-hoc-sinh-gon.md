---
yctd: YCTD-338
tieu_de: Cổng quản trị: danh sách học sinh gọn theo thiết kế
ngay: 2026-10-29
phien_ban_de_xuat: 0.214.0
---

## 02 Nhật ký

### 2026-10-29 — Cổng quản trị: danh sách học sinh gọn theo thiết kế (YCTD-338)

#### Công việc đã thực hiện

- 4.1.1 Quản lý hồ sơ học sinh theo mẫu của YCTD-333: đầu trang chỉ còn nút chính Nhập từ Excel (mở 4.1.2, người có quyền nhập học sinh), Thêm mới; Thay đổi, Xóa, Cập nhật hàng loạt, Cấp mã định danh Bộ (ghi mã cho dòng đã chọn) ở thanh "Đã chọn" (`selectionActions`); Cấp mã định danh Bộ, Xuất Excel, Xuất file lỗi, Đồng bộ CSDL ngành ở menu Thêm (`moreActions`) cùng Xuất PDF, Cấu hình cột hiển thị.
- Cột mặc định: Mã định danh Bộ GD&ĐT, Họ tên, Ngày sinh, Giới tính, Lớp, Trạng thái, Số điện thoại liên hệ; Dân tộc, Phụ huynh, Chuyên cần, Khối ẩn mặc định (bật ở Cấu hình cột hiển thị). Cột Lớp chuyển lên sau Giới tính theo thiết kế.
- Ô mã định danh Bộ trống ghi "Chưa có" chữ xám thay nhãn đỏ; bỏ ảnh chữ cái đầu chỉ để trang trí ở ô Họ tên. Thẻ trạng thái, ô "Tìm theo họ tên", mở rộng tìm kiếm giữ nguyên.
- Sửa kịch bản e2e 51 (cột mặc định, Xuất Excel ở menu Thêm), 62 (bật cột Dân tộc ở Cấu hình cột hiển thị, nút Xóa chỉ có sau khi chọn dòng, Xuất file lỗi ở menu Thêm). Cập nhật MH-02 ở `14_DAC_TA_GIAO_DIEN.md`, ghi chú AC-201 ở `11_TIEU_CHI_NGHIEM_THU.md`.

#### Quyết định

- Không bỏ chức năng, chỉ dời chỗ. "Cấp mã định danh Bộ" có ở cả hai chỗ: ở menu Thêm mở hộp không kèm dòng (xuất tệp theo mẫu Bộ cho học sinh chưa có mã), ở thanh "Đã chọn" mở hộp ghi mã cho các dòng đã chọn, như nút cũ khi có và khi chưa có dòng chọn.
- Nhập từ Excel, Thêm mới giữ ở đầu trang (cạnh tiêu đề và dòng tổng số) như bố cục hiện có của trang học sinh, không chuyển vào thanh công cụ của lưới.
- "Đồng bộ CSDL ngành" là nút phụ trên đầu trang nên vào menu Thêm.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-338, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Ô tìm chưa đọc tham số `?q=` trên đường dẫn (main chưa có); sẽ thêm cùng phần tìm chung nếu cần.

## 24 Yêu cầu thay đổi

### YCTD-338: Cổng quản trị: danh sách học sinh gọn theo thiết kế – 2026-10-29

- Lý do: thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28: thanh công cụ danh sách học sinh có nhiều nút ngang, nút thao tác hàng loạt hiện mờ thường trực, bảng 11 cột mặc định.
- Nội dung thay đổi: danh sách học sinh theo mẫu lưới gọn của YCTD-333 (menu Thêm, thanh "Đã chọn", cột mặc định ít hơn, mã định danh Bộ trống ghi chữ xám). Kịch bản CT-15c-12 kiểm cột mặc định mới; CT-16g-14 kiểm Xóa chỉ hiện khi chọn dòng, Cấp mã định danh Bộ ở thanh "Đã chọn", Xuất file lỗi ở menu Thêm.
- Thành phần bị ảnh hưởng: `apps/portal/src/children/ChildrenPage.tsx`; `tests/e2e/51-students-so.spec.ts`, `62-students-full-so.spec.ts`; `tai_lieu/14_DAC_TA_GIAO_DIEN.md` (MH-02), `11_TIEU_CHI_NGHIEM_THU.md` (AC-201).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: danh sách học sinh gọn theo thiết kế (YCTD-338).
- Thao tác trên dòng đã chọn ở thanh "Đã chọn"; xuất tệp, đồng bộ CSDL ngành ở menu Thêm; ít cột mặc định hơn.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng quản trị: danh sách học sinh gọn theo thiết kế | YCTD-338 |
