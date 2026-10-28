---
yctd: YCTD-360
tieu_de: Áp bản thiết kế cho Chợ gia sư phía phụ huynh
ngay: 2026-10-29
phien_ban_de_xuat: 0.240.0
---

## 02 Nhật ký

### 2026-10-29 — Áp bản thiết kế cho Chợ gia sư phía phụ huynh

#### Công việc đã thực hiện

- Áp bản thiết kế "Chợ gia sư, Gia sư, Cấp trên" (Eric duyệt ngày 2026-10-28) cho `apps/market`: khung chung `MarketShell` (gói `packages/market-client`) có thanh đầu trang trắng, nhãn "Thanh toán giả lập", dải báo chợ chạy thử, nội dung rộng, chân trang có đường dây nóng và văn bản pháp lý; biểu mẫu đăng ký, đăng nhập, xác nhận mã nằm trong thẻ giữa trang.
- Khu phụ huynh chia năm trang theo thanh điều hướng ở đầu trang (Tìm gia sư, Buổi học của con, Tin nhắn, Hồ sơ con, An toàn) thay cho một trang dài; trang đang mở ghi ở phần `#` của địa chỉ. Tài khoản chưa có hồ sơ con thì vào thẳng trang Hồ sơ con.
- Tìm gia sư: khối tìm ở đầu trang (môn, cấp, lớp, ngày trống), bộ lọc thêm bên trái (loại nội dung, giá tối đa, huy hiệu xác minh), sắp xếp, thẻ gia sư có chữ đầu tên thay ảnh. Ô "Ngày trống" dùng tham số `weekday` máy chủ đã có từ 27g nhưng giao diện chưa gọi; lọc theo huy hiệu làm ở trình duyệt.
- Trang gia sư hai cột: hồ sơ, Mẫu 02 dạng bảng, lưới giờ trống bảy ngày; thẻ đặt buổi bên phải có tóm tắt học phí, thời lượng, hạn giữ chỗ 30 phút, nút sang thanh toán.
- Buổi học của con chia nhóm Sắp tới, Cần bạn xem, Đã xong; mỗi buổi có ô ngày giờ, nhãn trạng thái. "Thanh toán giả lập" mở khung ghi rõ "Đây là thanh toán giả lập", chỗ đặt mã QR không quét được, nút "Giả lập: đã trả thành công".
- Hồ sơ con: mỗi con một thẻ; thêm nút sửa hồ sơ con (gọi `PUT /market/children/:id` đã có, việc T-M7 của rà soát giao diện); xóa hồ sơ con phải xác nhận qua hộp thoại (sửa H-6); khối thông tin tài khoản chỉ xem.
- Trang An toàn: đường dây nóng, danh sách báo cáo phụ huynh đã gửi kèm trạng thái và kết quả (gọi `GET /market/reports` đã có, việc T-M8), chính sách an toàn trẻ em.
- Tin nhắn: hộp thư bên trái, hội thoại bên phải, tin của mình bên phải; dùng chung với ứng dụng Gia sư.
- Màu theo bản thiết kế: xanh #1f4e8c, #12304f, nền kem #fbf8f3, ghi đè biến màu trong `apps/market/src/index.css`, không sửa `packages/ui`; vùng chạm 44 px.
- Sửa kiểm thử giao diện 197, 198 theo điều hướng mới và khung thanh toán giả lập; 198 thêm bước xem báo cáo đã gửi ở trang An toàn.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: phần này chỉ đổi giao diện và nối các API máy chủ đã có; chức năng trong bản vẽ cần API mới thì chưa hiện (không vẽ nút không chạy).
- Giữ phông chữ hệ thống như cổng quản trị đã áp thiết kế (PR 239), chưa tải Be Vietnam Pro.
- Phòng học video của chợ làm ở YCTD-362; nút "Vào phòng học" giữ nguyên hành vi cũ trong phần này.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-360, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chưa làm vì cần API mới: đánh giá sau buổi và gia sư trả lời, sắp xếp theo đánh giá (T-M2); gói buổi (T-M3); đổi mật khẩu, sửa thông tin tài khoản, quên mật khẩu (T-M5); đăng nhập định danh cho phụ huynh (T-M6); con đọc tin nhắn khi phụ huynh cho (T-M9); nút "Giả lập: trả lỗi" (bộ giả lập chưa có đường trả lỗi).

## 24 Yêu cầu thay đổi

### YCTD-360: Áp bản thiết kế cho Chợ gia sư phía phụ huynh – 2026-10-29

- Lý do: rà soát giao diện ngày 2026-10-28 ghi chợ gia sư chưa có thiết kế; Eric duyệt bản thiết kế "Chợ gia sư, Gia sư, Cấp trên" ngày 2026-10-28 và cho làm mã.
- Nội dung thay đổi: khung chung của chợ, năm trang của khu phụ huynh có thanh điều hướng, tìm gia sư có lọc ngày trống và huy hiệu, trang gia sư hai cột, buổi học chia nhóm, khung thanh toán giả lập, sửa hồ sơ con, xác nhận xóa con, trang An toàn có báo cáo đã gửi.
- Thành phần bị ảnh hưởng: `packages/market-client/src/MarketShell.tsx`, `packages/market-client/src/SafetyWidgets.tsx`, `apps/market/src/*`, `tests/e2e/197-tutor-booking.spec.ts`, `tests/e2e/198-market-safety.spec.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không (chỉ gọi thêm `PUT /market/children/:id`, `GET /market/reports`, tham số `weekday` đã có).
- Ảnh hưởng chức năng cũ: khu phụ huynh không còn là một trang dài; trả tiền giả lập cần thêm một bước xác nhận. Ứng dụng Gia sư dùng chung khung mới (thanh đầu trang, hộp thư hai cột) nhưng chưa đổi bố cục riêng (YCTD-361).
- Kiểm thử cần thực hiện: kiểm kiểu `apps/market`, `apps/tutor`; kiểm thử giao diện 195, 196, 197, 198.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: Chợ gia sư phía phụ huynh theo bản thiết kế đã duyệt: thanh điều hướng năm trang, tìm gia sư, trang gia sư, buổi học, thanh toán giả lập, hồ sơ con, trang An toàn (YCTD-360).
- Không đổi dữ liệu, API, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Áp bản thiết kế cho Chợ gia sư phía phụ huynh | YCTD-360 |
