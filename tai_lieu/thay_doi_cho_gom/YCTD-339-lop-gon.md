---
yctd: YCTD-339
tieu_de: Cổng quản trị: trang Hồ sơ lớp học gọn theo thiết kế
ngay: 2026-10-29
phien_ban_de_xuat: 0.215.0
---

## 02 Nhật ký

### 2026-10-29 — Cổng quản trị: trang Hồ sơ lớp học gọn theo thiết kế (YCTD-339)

#### Công việc đã thực hiện

- 2.1 Hồ sơ lớp học theo mẫu YCTD-333: thanh công cụ còn Nhập từ Excel (mở 2.2, chỉ hiện khi có quyền của mục 2.2), Thêm mới; Thay đổi, Giải thể lớp đã chọn, Xóa lớp ở thanh "Đã chọn" (chỉ hiện khi chọn dòng); Xuất Excel ở menu Thêm cùng Xuất PDF và Cấu hình cột hiển thị.
- Cột hiện mặc định: Tên lớp, Khối, Giáo viên chủ nhiệm, Số học sinh, Điểm trường, Phòng học. Mã lớp, Nhóm lớp, Nhóm trẻ, Nhóm tuổi, Thứ tự, Học 2 buổi/ngày, Lớp ghép, Ghép vào lớp, Lớp bán trú, Lớp giải thể ẩn mặc định (cùng Phân hiệu, Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, Sĩ số tối đa vốn đã ẩn); bật lại ở Cấu hình cột hiển thị.
- Đầu trang có liên kết "Phân công phụ trách lớp" sang 3.3 (hiện theo quyền của mục 3.3); mục menu 3.3 giữ nguyên, hai trang vẫn tách.
- Sửa kịch bản e2e 08-classes (bật cột Lớp giải thể trước khi kiểm), 54-school-classes-so (CT-15b-9 kiểm cột mặc định mới, Nhập từ Excel, liên kết 3.3, thao tác hàng loạt chưa hiện khi chưa chọn dòng, bật cột ẩn rồi kiểm, Xuất Excel qua menu Thêm).

#### Quyết định

- Không bỏ chức năng: mọi nút cũ vẫn còn, chỉ dời chỗ; thao tác trên dòng (Sửa, Giáo viên, Giải thể lớp, Mở lại) giữ ở cuối dòng.
- Giữ tên cột và thứ tự cột theo Sở (mã cột trùng mã cột tệp Excel của máy chủ); cột "Điểm trường" là cột đơn vị của lớp trên lưới. Thứ tự cột mặc định vì vậy là Điểm trường trước Phòng học.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-339, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-339: Cổng quản trị: trang Hồ sơ lớp học gọn theo thiết kế – 2026-10-29

- Lý do: thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28: thanh công cụ 2.1 có năm nút ngang, ba nút thao tác hàng loạt hiện mờ thường trực, bảng 13 cột mặc định; chưa có lối đi nhanh sang 3.3 Phân công phụ trách lớp.
- Nội dung thay đổi: trang 2.1 theo mẫu lưới gọn của YCTD-333 (thanh công cụ, thanh "Đã chọn", menu Thêm, sáu cột mặc định); liên kết sang 3.3 ở đầu trang. Kịch bản CT-15b-9 kiểm cột mặc định mới và chỗ đặt các nút.
- Thành phần bị ảnh hưởng: `apps/portal/src/classes/ClassesPage.tsx`; `tests/e2e/08-classes`, `54-school-classes-so`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: trang Hồ sơ lớp học gọn theo thiết kế cổng quản trị (YCTD-339).
- Thao tác hàng loạt ở thanh "Đã chọn", Xuất Excel ở menu Thêm, sáu cột mặc định; liên kết sang Phân công phụ trách lớp.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng quản trị: trang Hồ sơ lớp học gọn theo thiết kế | YCTD-339 |
