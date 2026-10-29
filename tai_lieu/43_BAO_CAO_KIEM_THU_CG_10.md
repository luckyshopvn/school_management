# 43. BÁO CÁO KIỂM THỬ VÀ CỔNG CG-10

- Mô tả: Kết quả chạy thật của bộ kịch bản kiểm thử `CT-...` và bộ ca kiểm thử chi tiết `CTC-...` cho giai đoạn 1, phân loại các ca chưa chạy và lỗi, kết luận cổng CG-10 trước khi phát hành 1.0.0 (đợt DT-09 phần 9g, YCTD-72).
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-11
- Trạng thái: Đã đánh giá
- Người đánh giá: Claude, theo ủy quyền của Eric ngày 2026-10-11

## 1. Phạm vi

Giai đoạn 1 (G1) theo `05_PHAM_VI.md` và `10_YEU_CAU_CHUC_NANG.md`: dịch vụ định danh, P01, P02, P04, P05, P06, P07, P08, P17 phần G1, P19. Các chức năng G2, G3 và các chức năng đã bỏ không thuộc bản 1.0.0.

## 2. Môi trường và cách chạy

| Hạng mục | Nội dung |
|---|---|
| Môi trường | Máy phát triển chạy Docker (PostgreSQL, Redis, SeaweedFS) và GitHub Actions; môi trường thử nghiệm trên đám mây dựng khi triển khai (YCTD-32, việc T6) |
| Kiểm thử máy chủ | `node --test` cho dịch vụ định danh và máy chủ API; mỗi bộ kiểm thử tạo cơ sở dữ liệu riêng và chạy thật qua HTTP |
| Kiểm thử giao diện | Playwright chạy cổng quản trị, ứng dụng phụ huynh, ứng dụng giáo viên với dịch vụ thật trên cơ sở dữ liệu `school_system_e2e` |
| Lần chạy cuối | Ngày 11/10/2026 trên nhánh `dt-09-phan-9g`: máy chủ API 401/401 đạt, kiểm thử giao diện 47/47 đạt; mọi yêu cầu gộp của DT-09 qua tích hợp liên tục |

## 3. Kết quả tổng hợp

| Bộ ca | Tổng | Đạt | Chưa chạy | Không áp dụng |
|---|---|---|---|---|
| Kịch bản kiểm thử `CT-001` đến `CT-188` | 188 | 131 | 50 | 7 |
| Ca kiểm thử chi tiết `CTC-...` | 453 | 441 | 5 | 7 |

Mọi ca thuộc chức năng G1 có thể chạy trên máy phát triển đều đã chạy và đạt. Các ca chưa chạy được phân loại ở mục 4.

## 4. Ca chưa chạy và quyết định xử lý

### 4.1 Ca chi tiết `CTC-...`

| Mã | Mức | Lý do chưa chạy | Quyết định |
|---|---|---|---|
| CTC-DD-024 | Thấp | Mã một lần do dịch vụ định danh gửi, giới hạn 5 tin thông báo mỗi ngày do máy chủ API đếm (YCTD-71); hai bên độc lập nên đúng theo thiết kế, nhưng cần nhà cung cấp tin nhắn thật để chạy trọn | Chạy khi nối nhà cung cấp tin nhắn ở việc T1 |
| CTC-P01-058 | Thấp | Thời hạn giữ nhật ký (BM-70) là cấu hình sao lưu và lưu trữ của môi trường chạy thật | Rà khi triển khai ở việc T6 |
| CTC-P01-062 | Cao | Chứng từ đề nghị mua hàng thuộc P13 (G2); cơ chế hạn mức theo loại chứng từ đã kiểm với phiếu chi (CTC-P01-061, CTC-P01-065) | Chạy cùng P13 ở giai đoạn 2 |
| CTC-P06-049 | Trung bình | Xuất dữ liệu kèm nhật ký xuất là P17-12 (G2) | Chạy cùng P17-12 ở giai đoạn 2 |
| CTC-P06-061 | Cao | Điểm cuối nhận thông báo tiền vào có chữ ký và địa chỉ mạng cho phép (BM-62) làm khi chọn nhà cung cấp thanh toán; bản giả lập không có chữ ký (YCTD-57) | Làm và chạy khi chọn nhà cung cấp ở việc T1; trước đó không bật thanh toán trực tuyến ở môi trường chạy thật |

### 4.2 Kịch bản `CT-...`

| Nhóm | Mã | Lý do | Quyết định |
|---|---|---|---|
| Chức năng G2, G3 | CT-041 (P06-09), CT-053 đến CT-058, CT-116 đến CT-118, CT-162, CT-171 đến CT-175 (P10), CT-064, CT-065, CT-119 (P12), CT-066 đến CT-068, CT-120 (P13), CT-069 đến CT-072, CT-121 đến CT-123, CT-130, CT-131 (P14), CT-073 đến CT-075 (P15), CT-076, CT-077, CT-124 (P16), CT-081 (P17-08), CT-083 (P17-12), CT-085 (P17-11), CT-107 đến CT-109 (P02-11), CT-110 (P03-08), CT-169 (P05-12) | Không thuộc bản 1.0.0 | Chạy cùng giai đoạn của chức năng |
| Hiệu năng và phục hồi | CT-086, CT-087, CT-088, CT-089 | Cần môi trường có cấu hình gần môi trường chạy thật và quy trình sao lưu (SL-01) | Chạy trên môi trường thử nghiệm khi triển khai ở việc T6, trước khi mở cho người dùng |

## 5. Lỗi phát hiện trong đợt DT-09

| Mức | Lỗi | Xử lý |
|---|---|---|
| Nghiêm trọng | Mở năm học mới không chuyển trẻ, phụ huynh, lớp, quỹ, công nợ, mẫu thông báo và không kiểm tra BR-89 | Đã sửa ở YCTD-69 (yêu cầu gộp số 39) |
| Cao | Thiếu chuyển đơn vị, thôi học, cập nhật đồng ý hình ảnh, cờ trẻ con nhân viên cho trẻ đã có hồ sơ (P02-07, P02-08, P02-09) | Đã làm ở YCTD-67 (yêu cầu gộp số 37) |
| Cao | Thiếu lịch nghỉ và lịch công tác (P08-02) | Đã làm ở YCTD-68 (yêu cầu gộp số 38) |
| Cao | Thông báo chỉ vào hàng đợi, chưa gửi, chưa gửi lại khi lỗi, chưa giới hạn tin nhắn, chưa nhắc ghi nhật ký | Đã làm ở YCTD-71 (yêu cầu gộp số 41) |
| Trung bình | Cấu hình sĩ số tối đa và ghi nhật ký truy cập lưu được nhưng không có tác dụng; báo cáo thu chi chưa tổng hợp theo nhóm và theo kỳ | Đã sửa ở YCTD-70 (yêu cầu gộp số 40) |
| Thấp | Kết quả mong đợi của một số ca lệch với quyết định đã duyệt sau đó: CTC-P01-061, CTC-P04-039, CTC-P04-040, CT-006 (YCTD-66); CTC-P06-050 và quyền của P06-08 lệch PQ-35 (YCTD-62) | Đã sửa tài liệu ở YCTD-66 và YCTD-72 |

Không còn lỗi nghiêm trọng hoặc lỗi cao chưa xử lý trong phạm vi G1.

## 6. Giới hạn đã biết của bản 1.0.0

1. Chưa nối nhà cung cấp tin nhắn và nhà cung cấp thanh toán thật (việc T1): tin nhắn ghi ra nhật ký máy chủ; thanh toán trực tuyến chỉ có bản giả lập.
2. Chưa dựng môi trường thử nghiệm và chạy thật trên đám mây (việc T6): hiệu năng, phục hồi, thời hạn giữ nhật ký kiểm ở bước triển khai.
3. Lên lớp đầu năm làm bằng tạo lớp mới và chuyển lớp ở năm học mới (YCTD-69); mã thanh toán trực tuyến của hóa đơn năm cũ không chuyển sang năm mới, tiền về sau đó vào hàng đợi chưa khớp.

## 7. Kết luận

Cổng CG-10 đạt ngày 11/10/2026: không còn lỗi nghiêm trọng chưa xử lý; các ca thuộc tiêu chí nghiệm thu G1 chạy được trên máy phát triển đều đạt; các ca còn lại đã phân loại theo mức và có quyết định xử lý.

Bản ứng viên phát hành 1.0.0 là phiên bản tài liệu 0.31.0 trên nhánh `main`. Cổng CG-11 chờ hai việc: Eric nghiệm thu bản ứng viên và triển khai lên môi trường chạy thật (việc T6) kèm xác nhận sau triển khai; khi đạt thì gắn phiên bản 1.0.0.
