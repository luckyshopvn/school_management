---
yctd: YCTD-295
tieu_de: Trang chủ cổng quản trị theo mẫu giao diện Tổng quan
ngay: 2026-10-28
phien_ban_de_xuat: 0.176.0
---

## 02 Nhật ký

### 2026-10-28 — Trang chủ cổng quản trị theo mẫu giao diện Tổng quan

#### Công việc đã thực hiện

- Dựng bộ mẫu giao diện trên canvas thiết kế (tổng quan Ban Giám hiệu, danh sách học sinh, đăng nhập, điểm danh trên ứng dụng giáo viên, trang chủ ứng dụng phụ huynh, sổ điểm, thời khoá biểu) theo mã màu và cỡ chữ ở `packages/ui/src/theme.css`.
- Đưa mẫu Tổng quan vào trang chủ cổng quản trị: dòng ngày trên lời chào; bảng điều khiển MH-01 đổi từ 8 thẻ nhỏ sang 5 thẻ số lớn có dòng ghi chú; thêm khối "Việc cần xử lý" theo phân hệ; xếp sinh nhật, hợp đồng sắp hết hạn vào lưới hai cột.

#### Quyết định

- Giữ tiêu đề "Xin chào, …" vì nhiều kịch bản e2e dựa vào tiêu đề này.
- Khối "Việc cần xử lý" dùng lại truy vấn đếm của nút Việc của tôi (không gọi thêm máy chủ), xếp phân hệ nhiều việc lên trước, bằng nhau thì theo thứ tự nhãn, tối đa 5 dòng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Chưa đưa biểu đồ chuyên cần 7 ngày, bảng lớp vắng nhiều, lịch hôm nay của mẫu vì chưa có điểm cuối trả số liệu này; không dùng số liệu giả.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-295, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Cần điểm cuối chuyên cần theo ngày và lớp vắng nhiều trong ngày để hoàn thiện mẫu Tổng quan.

## 24 Yêu cầu thay đổi

### YCTD-295: Trang chủ cổng quản trị theo mẫu giao diện Tổng quan – 2026-10-28

- Lý do: Eric yêu cầu thiết kế giao diện và đưa mẫu Tổng quan vào cổng quản trị.
- Nội dung thay đổi: Trang chủ có dòng ngày theo giờ Việt Nam; MH-01 gộp thành 5 thẻ (học sinh kèm số lớp, tỷ lệ đi học kèm lượt có mặt, nhân sự, tỷ lệ học phí đã thu kèm số đã thu trên phải thu, công nợ kèm phần quá hạn tô màu cảnh báo); khối "Việc cần xử lý" theo phân hệ dẫn tới Việc của tôi.
- Thành phần bị ảnh hưởng: `apps/portal/src/pages/HomePage.tsx`, `apps/portal/src/reports/DashboardCards.tsx`, `apps/portal/src/my-work/MyWorkSummary.tsx` (mới).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: trang chủ cổng quản trị theo mẫu giao diện Tổng quan (YCTD-295).
- Bảng điều khiển MH-01 hiển thị 5 thẻ số lớn có ghi chú; thêm khối "Việc cần xử lý" theo phân hệ.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Trang chủ cổng quản trị theo mẫu giao diện Tổng quan | YCTD-295 |
