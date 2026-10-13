# 30. BÁO CÁO KIỂM THỬ GIAI ĐOẠN 3

- Mô tả: Kết quả chạy thật của bộ kịch bản kiểm thử `CT-...` và bộ ca kiểm thử chi tiết `CTC-...` sau giai đoạn 3, phân loại các ca chưa chạy và lỗi phát hiện khi gộp các phần, kết luận trước khi đóng gói bản ứng viên phát hành 1.2.0 (đợt DT-11, YCTD-91).
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-13
- Trạng thái: Đã đánh giá
- Người đánh giá: Claude, theo ủy quyền của Eric ngày 2026-10-11

## 1. Phạm vi

Giai đoạn 3 (G3) theo `05_PHAM_VI.md`, làm trong năm phần của đợt DT-11 (YCTD-85): G3-01 và G3-07 tuyển sinh trực tuyến, tin tuyển sinh (11a, YCTD-86); G3-02 tuyển dụng (11b, YCTD-87); G3-06 sổ kế toán kép (11c, YCTD-88); G3-05 đối soát sao kê tự động và nhiều cổng thanh toán (11d, YCTD-89); G3-03 và G3-08 kết nối Facebook, Fanpage, Zalo Official Account (11e, YCTD-90). Chạy lại toàn bộ kiểm thử giai đoạn 1 và 2 để kiểm hồi quy.

Chưa làm: G3-04 bản cài riêng trên điện thoại chờ Eric quyết định; G3-09 kết nối tự động với cơ sở dữ liệu ngành chưa có giao diện lập trình công khai, tiếp tục nhập từ tệp (P02-12).

| Phần | Phân hệ | Thay đổi | Yêu cầu gộp |
|---|---|---|---|
| Quyền và kế hoạch | P01, P06, P14, P16, P18 | YCTD-85 | 56, 57 |
| 11e | P14-08, kênh Zalo | YCTD-90 | 58 |
| 11b | P18 tuyển dụng | YCTD-87 | 59 |
| 11a | P16 tuyển sinh | YCTD-86 | 60 |
| 11d | P06-06, P06-11 đối soát và cổng thanh toán | YCTD-89 | 61 |
| 11c | P06-12 sổ kế toán kép | YCTD-88 | 62 |

## 2. Môi trường và cách chạy

Như `29_BAO_CAO_KIEM_THU_G2.md`: năm phần làm song song bằng các agent trong worktree riêng, quyền cấp trước ở tệp định danh 0035; người điều phối gộp nối tiếp, chạy toàn bộ kiểm thử máy chủ và giao diện trước mỗi yêu cầu gộp. Lần chạy cuối ngày 12/10/2026 trên nhánh `dt-11-phan-11c` (đã gồm mọi phần): máy chủ API 518/518 đạt, kiểm thử giao diện 62/62 đạt.

## 3. Kết quả tổng hợp

| Bộ ca | Tổng | Đạt | Chưa chạy | Không áp dụng |
|---|---|---|---|---|
| Kịch bản kiểm thử `CT-001` đến `CT-235` | 235 | 224 | 4 | 7 |
| Ca kiểm thử chi tiết `CTC-...` | 453 | 443 | 3 | 7 |

So với `29_BAO_CAO_KIEM_THU_G2.md`: thêm 34 kịch bản mới cho chức năng G3 (CT-202 đến CT-235, kèm AC-246 đến AC-279); ba kịch bản P16 trước đây chưa chạy (CT-076, CT-077, CT-124) nay đạt. Mọi kịch bản thuộc chức năng G1, G2 và G3 chạy được trên máy phát triển đều đạt.

## 4. Ca chưa chạy và quyết định xử lý

| Mã | Lý do | Quyết định |
|---|---|---|
| CT-086, CT-087, CT-088, CT-089 | Hiệu năng và phục hồi cần môi trường gần môi trường chạy thật và quy trình sao lưu | Chạy trên môi trường thử nghiệm khi triển khai ở việc T6 |

Ba ca chi tiết CTC-DD-024, CTC-P01-058, CTC-P06-061 giữ nguyên quyết định ở `28_BAO_CAO_KIEM_THU_CG_10.md` (chờ việc T1 và T6).

## 5. Lỗi phát hiện trong đợt DT-11

| Mức | Lỗi | Xử lý |
|---|---|---|
| Cao | Quyền cấu hình kết nối ngoài cấp cho VT-01, trái PQ-10 (VT-01 chỉ quản lý tài khoản) | Sửa tệp định danh 0035 chỉ cấp VT-02 (yêu cầu gộp số 56) |
| Trung bình | Hai phần làm song song cùng đặt tên lớp `PublicRateLimiter`, cùng sửa màn hình đăng nhập phụ huynh | Đổi tên lớp của tuyển sinh, đặt cả hai trang công khai trên màn hình đăng nhập (YCTD-86) |
| Thấp | Kiểm thử giao diện chọn hộp chọn theo nhãn bao ngoài, ô số và ô chữ cùng nhãn, chuyển hồ sơ tuyển sinh chậm trên máy chạy kiểm thử liên tục | Sửa kiểm thử: chọn theo vai trò, chờ chuyển hồ sơ đến 20 giây |
| Thấp | Chạy hai lần kiểm thử giao diện chồng nhau làm dịch vụ kiểm thử còn treo giữ cổng | Quy trình: không chạy song song hai lần kiểm thử giao diện; dừng dịch vụ còn treo trước khi chạy lại |

Không còn lỗi nghiêm trọng hoặc lỗi cao chưa xử lý trong phạm vi G1, G2, G3.

## 6. Giới hạn đã biết của bản 1.2.0

1. Các giới hạn của bản 1.0.0 và 1.1.0 ở `28_BAO_CAO_KIEM_THU_CG_10.md` và `29_BAO_CAO_KIEM_THU_G2.md` vẫn còn.
2. Facebook, Zalo Official Account, cổng thanh toán có thông báo tiền vào chỉ chạy bằng bộ giả lập; nối tài khoản thật ở việc T1 (T4, T7).
3. Giới hạn số lần gọi của trang tuyển sinh, tuyển dụng công khai giữ trong bộ nhớ từng máy chủ; khi chạy nhiều máy chủ cần bộ nhớ chung (việc T6).
4. Sổ kế toán kép: danh mục tài khoản khởi tạo cần kế toán trưởng đối chiếu Thông tư 24/2024/TT-BTC; kết chuyển theo năm học; công nợ phải trả, kho, khấu hao chưa ghi sổ tự động; ghi sổ tự động chạy khi xem sổ hoặc bấm ghi sổ.
5. Nhập sao kê chỉ đọc tệp .xlsx và CSV mã UTF-8.
6. Chưa có bản cài riêng trên điện thoại (G3-04) và kết nối tự động với cơ sở dữ liệu ngành (G3-09).

## 7. Kết luận

Kiểm thử giai đoạn 3 đạt ngày 12/10/2026: không còn lỗi nghiêm trọng chưa xử lý; các kịch bản thuộc tiêu chí nghiệm thu G1, G2, G3 chạy được trên máy phát triển đều đạt; các ca còn lại đã phân loại và có quyết định xử lý.

Bản ứng viên phát hành 1.2.0 là phiên bản tài liệu 0.48.0 trên nhánh `main`. Gắn phiên bản 1.2.0 sau khi 1.0.0 qua cổng CG-11, 1.1.0 được nghiệm thu, và Eric nghiệm thu bản ứng viên 1.2.0.
