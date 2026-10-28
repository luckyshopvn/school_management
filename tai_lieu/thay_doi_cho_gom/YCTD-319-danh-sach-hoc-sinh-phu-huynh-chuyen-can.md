---
yctd: YCTD-319
tieu_de: Danh sách học sinh thêm cột Phụ huynh, Chuyên cần và Đồng bộ CSDL ngành
ngay: 2026-10-28
phien_ban_de_xuat: 0.195.0
---

## 02 Nhật ký

### 2026-10-28 — Danh sách học sinh thêm cột Phụ huynh, Chuyên cần và Đồng bộ CSDL ngành

#### Công việc đã thực hiện

- `GET /api/v1/children` trả thêm `guardian_name` (họ tên người liên hệ chính) và `attendance_rate`: phần trăm số ngày có mặt (kể cả đi muộn, về sớm) trên số ngày đã điểm danh ở năm học, làm tròn số nguyên, chưa điểm danh ngày nào là null. Xuất Excel, PDF danh sách nhận thêm cột `guardian_name` (Phụ huynh) và `attendance_rate` (Chuyên cần).
- Lưới 4.1.1. Quản lý hồ sơ học sinh thêm cột Phụ huynh và Chuyên cần (hiện mặc định, sau cột Số điện thoại liên hệ), cấu hình cột ẩn được.
- Nút "Đồng bộ CSDL ngành" (người có quyền nhập học sinh) mở hộp hướng dẫn đồng bộ bằng tệp 82 cột: "Tải tệp kèm dữ liệu để nộp" và "Nhập tệp từ CSDL ngành" (sang 4.1.2). Hệ thống không gửi dữ liệu đi.
- Kiểm thử máy chủ API cho hai trường mới.

#### Quyết định

- Đồng bộ CSDL ngành làm bản chạy nội bộ theo quyết định ngày 2026-10-16 của Eric về chức năng cần hệ thống bên ngoài: dùng tệp theo mẫu của Bộ, để sẵn chỗ nối kết nối thật.
- Chuyên cần tính trên năm học hiện tại (mỗi năm học một cơ sở dữ liệu); "có mặt" gồm đi muộn, về sớm, giống bộ đếm Có mặt của màn hình điểm danh. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-319, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Kết nối trực tiếp CSDL ngành chờ Sở cấp giao diện kết nối.

## 24 Yêu cầu thay đổi

### YCTD-319: Danh sách học sinh thêm cột Phụ huynh, Chuyên cần và Đồng bộ CSDL ngành – 2026-10-28

- Lý do: mẫu giao diện đã duyệt của danh sách học sinh có cột Phụ huynh, Chuyên cần và nút "Đồng bộ CSDL ngành" nhưng mã chưa có (để lại ở YCTD-296); Eric yêu cầu làm nốt.
- Nội dung thay đổi: hai trường mới ở danh sách học sinh và tệp xuất; hai cột của lưới; hộp Đồng bộ CSDL ngành bằng tệp.
- Thành phần bị ảnh hưởng: `apps/api/src/children/student-list.ts`, `apps/api/src/children/students-so.test.ts`, `apps/portal/src/children/ChildrenPage.tsx`, `apps/portal/src/children/children-api.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: `GET /children` thêm hai trường, `POST /children/export` nhận thêm hai mã cột; không đổi dữ liệu, quyền.
- Ảnh hưởng chức năng cũ: không; cột mặc định của tệp xuất khi không gửi `columns` giữ nguyên.
- Kiểm thử cần thực hiện: kiểm kiểu máy chủ API, cổng quản trị; kiểm thử máy chủ API `students-so.test.ts`; kiểm thử giao diện 51.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: danh sách học sinh thêm cột Phụ huynh, Chuyên cần; nút Đồng bộ CSDL ngành bằng tệp (YCTD-319).
- Không đổi dữ liệu, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Danh sách học sinh thêm cột Phụ huynh, Chuyên cần và Đồng bộ CSDL ngành | YCTD-319 |
