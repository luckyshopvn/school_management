---
yctd: YCTD-334
tieu_de: Cổng quản trị: trang Điểm danh theo thiết kế mới
ngay: 2026-10-29
phien_ban_de_xuat: 0.210.0
---

## 02 Nhật ký

### 2026-10-29 — Cổng quản trị: trang Điểm danh theo thiết kế mới (YCTD-334)

#### Công việc đã thực hiện

- 4.7 Điểm danh: tiêu đề và bộ lọc một hàng; ô Đơn vị chỉ hiện khi người dùng có từ hai đơn vị; nút Hôm trước, Hôm sau cạnh ô ngày; tóm tắt thành từng ô số (số chưa đánh dấu tô màu cảnh báo khi còn); nút thao tác lên đầu bảng; thêm nút "Đánh dấu tất cả có mặt" cho các dòng chưa đánh dấu (vẫn phải bấm Lưu điểm danh; tắt khi mọi dòng đã đánh dấu).
- Kịch bản e2e 11 kiểm nút mới và nút đổi ngày.

#### Quyết định

- Giữ đủ sáu trạng thái điểm danh, chốt, mở lại kèm lý do như trước; chỉ đổi cách bày.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-334, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-334: Cổng quản trị: trang Điểm danh theo thiết kế mới – 2026-10-29

- Lý do: thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28: trang điểm danh trống trải, tóm tắt một dòng chữ dài, nút thao tác ở cuối bảng.
- Nội dung thay đổi: bộ lọc một hàng, ô Đơn vị ẩn khi chỉ có một đơn vị, nút đổi ngày, tóm tắt dạng ô số, nút thao tác ở đầu bảng, nút Đánh dấu tất cả có mặt.
- Thành phần bị ảnh hưởng: `apps/portal/src/attendance/AttendancePage.tsx`; `tests/e2e/11-attendance.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: trang Điểm danh của cổng quản trị theo thiết kế mới (YCTD-334).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng quản trị: trang Điểm danh theo thiết kế mới | YCTD-334 |
