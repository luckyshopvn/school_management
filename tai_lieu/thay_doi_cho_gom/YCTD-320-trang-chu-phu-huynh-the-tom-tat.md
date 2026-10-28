---
yctd: YCTD-320
tieu_de: Trang chủ ứng dụng phụ huynh thêm thẻ Khoản cần nộp và Điểm mới
ngay: 2026-10-28
phien_ban_de_xuat: 0.196.0
---

## 02 Nhật ký

### 2026-10-28 — Trang chủ ứng dụng phụ huynh thêm thẻ Khoản cần nộp và Điểm mới

#### Công việc đã thực hiện

- Thẻ của từng con trên trang chủ ứng dụng phụ huynh có thêm hai thẻ tóm tắt trên lưới lối tắt:
  - "Khoản cần nộp": tối đa ba hóa đơn đã phát hành còn phải nộp (tháng, số còn phải nộp), nhãn hạn nộp gần nhất, nút "Xem và thanh toán" mở bảng Học phí (có mã QR).
  - "Điểm mới" (con học THCS, THPT): tối đa ba môn có điểm ở học kỳ đã khoá gần nhất (trung bình môn hoặc Đạt, Chưa đạt), nút "Xem sổ điểm" mở bảng Điểm học tập.
- Hai thẻ dùng đúng điểm cuối của bảng Học phí (`GET /invoices?child_id=`) và Điểm học tập (`GET /scores/children/:id`); lỗi hay chưa có dữ liệu thì ẩn thẻ. Thành phần ở `apps/parent/src/screens/ChildSummaryCards.tsx`.

#### Quyết định

- Không làm nút "Đổi con" và thanh điều hướng dưới của mẫu giao diện: kiểm thử giao diện 85, 86 cần thấy thẻ của mọi con cùng lúc, ứng dụng phụ huynh chưa có điều hướng dưới (đổi khung ứng dụng là việc riêng). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-320, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Nút "Đổi con", thanh điều hướng dưới chờ Eric quyết định có đổi khung ứng dụng phụ huynh hay không.

## 24 Yêu cầu thay đổi

### YCTD-320: Trang chủ ứng dụng phụ huynh thêm thẻ Khoản cần nộp và Điểm mới – 2026-10-28

- Lý do: mẫu giao diện đã duyệt của trang chủ phụ huynh có thẻ Điểm mới và Khoản cần nộp nhưng trang chủ chưa có (để lại ở YCTD-296); Eric yêu cầu làm nốt.
- Nội dung thay đổi: hai thẻ tóm tắt ở thẻ của con, mở bảng chi tiết sẵn có.
- Thành phần bị ảnh hưởng: `apps/parent/src/screens/HomeScreen.tsx`, `apps/parent/src/screens/ChildSummaryCards.tsx`.
- Dữ liệu, API, quyền bị ảnh hưởng: không; dùng API sẵn có.
- Ảnh hưởng chức năng cũ: không; các nút, bảng hiện có giữ nguyên.
- Kiểm thử cần thực hiện: kiểm kiểu ứng dụng phụ huynh; kiểm thử giao diện 15, 16, 18, 85, 98.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: trang chủ ứng dụng phụ huynh thêm thẻ Khoản cần nộp, Điểm mới (YCTD-320).
- Không đổi dữ liệu, API, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Trang chủ ứng dụng phụ huynh thêm thẻ Khoản cần nộp và Điểm mới | YCTD-320 |
