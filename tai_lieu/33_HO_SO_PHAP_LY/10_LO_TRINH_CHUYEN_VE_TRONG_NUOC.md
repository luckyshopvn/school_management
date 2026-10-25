# PL-10. KẾ HOẠCH VÀ LỘ TRÌNH CHUYỂN DỮ LIỆU VỀ MÁY CHỦ TRONG NƯỚC

- Mã mẫu: PL-10; phiên bản mẫu: S8a-1.0 (2026-10-25); YCTD-200. Kèm PL-03, PL-09; lưu ở hồ sơ trường (S4).
- Trạng thái: **bản nháp, cần luật sư rà trước khi dùng.** Thời hạn, điều kiện là giả định của kế hoạch (14.5 "S9" mục 7, GD-101).
- Công cụ: hồ sơ triển khai "Vận hành" (S7a), lệnh `platform relayout` (S9). Các công cụ này **chưa làm** tại ngày soạn mẫu; trước khi nhận dữ liệu thật phải có bản chạy thử thành công (mục 4).

## 1. Điều kiện kích hoạt

Chuyển dữ liệu của một trường về máy chủ trong nước khi có **một** trong các điều kiện sau (ghi ngày phát sinh vào hồ sơ trường, nhắc trên bảng điều khiển S4):

| Mã | Điều kiện | Ai phát hiện |
|---|---|---|
| KH-1 | Trường ký hợp đồng chính thức (chuyển từ dùng thử sang trả phí) | Quản trị nền tảng |
| KH-2 | Cơ quan có thẩm quyền yêu cầu (gồm yêu cầu ngừng chuyển dữ liệu xuyên biên giới, yêu cầu lưu trữ trong nước) | Nền tảng, Nhà trường |
| KH-3 | Hết thời hạn ở văn bản đồng ý (PL-03 mục 1) hoặc Nhà trường rút đồng ý và chọn chuyển về | Hệ thống nhắc |
| KH-4 | Vượt số trường, dung lượng, giới hạn của gói miễn phí ở hồ sơ Thử nghiệm | Giám sát |
| KH-5 | Phiếu chấp nhận rủi ro PL-09 hết hiệu lực | Hệ thống nhắc |
| KH-6 | Sự cố lộ dữ liệu ở hạ tầng Thử nghiệm | Quy trình PL-12 |

## 2. Thời hạn

- Mục tiêu: hoàn tất **trong 30 ngày** kể từ ngày phát sinh điều kiện [giả định]; KH-2 theo thời hạn cơ quan có thẩm quyền yêu cầu nếu ngắn hơn.
- Trong thời gian chờ chuyển: không nhận thêm trường `consented` mới; có thể chuyển trường sang chỉ đọc nếu KH-2, KH-6.

## 3. Các bước (theo kế hoạch 14.5 "S9")

| Bước | Việc | Người làm | Bằng chứng |
|---|---|---|---|
| 1 | Dựng hoặc dùng hồ sơ Vận hành trên VPS trong nước (S7a) | Vận hành nền tảng | Bản ghi PL-08 của hồ sơ Vận hành |
| 2 | `platform relayout --school <mã> --to database`: sao chép dữ liệu từng bảng sang cơ sở dữ liệu mới đã chạy migrate, kiểm số dòng và tổng kiểm từng bảng | Vận hành nền tảng | Báo cáo kiểm khớp |
| 3 | Chuyển tệp từ kho tệp Thử nghiệm sang kho tệp trong nước, giữ khóa tệp | Vận hành nền tảng | Báo cáo số tệp, tổng kiểm |
| 4 | Chuyển tên miền (bản ghi DNS) | Vận hành nền tảng; Nhà trường nếu dùng tên miền riêng | |
| 5 | Đổi `data_class` thành `production` **chỉ sau khi** dữ liệu đã ở trong nước; ghi `school_hosting` mới | Quản trị nền tảng | `school_hosting` |
| 6 | Xóa trường ở nền tảng Thử nghiệm; yêu cầu từng nhà cung cấp xóa dữ liệu (gồm bản sao lưu), giữ biên bản | Vận hành nền tảng | Biên bản xóa, xác nhận của nhà cung cấp |
| 7 | Cập nhật hồ sơ đánh giá tác động (PL-06), báo cơ quan chuyên trách việc chấm dứt chuyển xuyên biên giới theo Điều 20 Nghị định 356/2025/NĐ-CP | Nhà trường, Nền tảng hỗ trợ | Văn bản cập nhật (Mẫu số 03a/03b) |
| 8 | Thông báo cho Nhà trường, cha mẹ (nếu đã thông báo nơi lưu ở PL-03 phần B) | Nhà trường | |

## 4. Kiểm tra sẵn sàng trước khi nhận dữ liệu thật

- [ ] Đã chạy thử bước 2, 3 với một trường dữ liệu giả, khớp số dòng, tổng kiểm.
- [ ] Đã thử khôi phục từ sao lưu của hồ sơ Vận hành.
- [ ] Đã có hợp đồng hoặc cam kết với nhà cung cấp VPS trong nước `[GD-96]`.
- [ ] Đã có danh sách đầu mối, thời gian dự kiến cho từng bước.

## 5. Trách nhiệm

| Bên | Trách nhiệm |
|---|---|
| Nền tảng | Duy trì công cụ, chạy thử định kỳ `[3 tháng/lần]`, thực hiện chuyển đúng hạn, giữ biên bản |
| Nhà trường | Báo khi phát sinh KH-1, KH-3; cập nhật hồ sơ với cơ quan chuyên trách; thông báo cho gia đình |
| Eric | Quyết định khi có tranh chấp về thời hạn; ký phiếu PL-09 mới nếu cần kéo dài |
