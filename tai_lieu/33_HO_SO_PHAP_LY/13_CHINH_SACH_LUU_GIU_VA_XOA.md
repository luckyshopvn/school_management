# PL-13. CHÍNH SÁCH LƯU GIỮ VÀ XÓA DỮ LIỆU

- Mã mẫu: PL-13; phiên bản mẫu: S8a-1.0 (2026-10-25); YCTD-200.
- Trạng thái: **bản nháp, cần luật sư rà trước khi dùng.** Thời hạn là giả định của kế hoạch (14.11 GD-99, GD-101; SL-01) cho đến khi Eric chốt.
- Nối với: S2 (phân loại `data_class`, tự xóa dữ liệu giả, bằng chứng ở `school_consents`), S5a (trạng thái trường, chỉ đọc, tạm ngưng), S7b (sao lưu, khôi phục). Cấu hình ở `platform_settings`, `plans`.
- Căn cứ (đã đọc ngày 2026-10-25): Điều 14 Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (các trường hợp xóa, hủy; xóa bằng biện pháp an toàn, ngăn khôi phục trái phép; thông báo cho chủ thể khi không thể xóa vì lý do chính đáng); khoản 2 Điều 12 Nghị định 356/2025/NĐ-CP (tuân thủ thời hạn xử lý, yêu cầu xóa, hủy trong hợp đồng điện toán đám mây). **Chưa tra** quy định ngành giáo dục về thời hạn lưu hồ sơ, sổ sách học sinh, giáo viên dạng điện tử; luật sư bổ sung cột "căn cứ" ở mục 2.

## 1. Nguyên tắc

1. Nhà trường (bên kiểm soát) quyết định thời hạn lưu dữ liệu nghiệp vụ theo quy định ngành và chính sách của trường; Nền tảng cung cấp chức năng và thực hiện theo chỉ dẫn.
2. Nền tảng không tự xóa dữ liệu thật của trường vì lý do quá hạn thanh toán (chỉ chuyển chỉ đọc, tạm ngưng).
3. Xóa phải an toàn và có biên bản; bản sao lưu bị xóa theo vòng quay, không khôi phục lại dữ liệu đã xóa trừ khi Nhà trường yêu cầu trong thời hạn.

## 2. Thời hạn theo loại dữ liệu và phân loại trường

| Dữ liệu | `synthetic` (dữ liệu giả) | `consented` (dữ liệu thật, thử nghiệm) | `production` (dữ liệu thật, vận hành) | Căn cứ |
|---|---|---|---|---|
| Dữ liệu nghiệp vụ của trường | **Có thể tự xóa** sau `[30]` ngày kể từ khởi tạo (bật tắt theo trường) | **Không tự xóa**; xóa khi chuyển về trong nước xong (PL-10 bước 6), khi trường rút đồng ý và chọn xóa, hoặc khi chấm dứt hợp đồng | **Không tự xóa**; xóa khi chấm dứt hợp đồng theo mục 3 | Hợp đồng; `[quy định ngành: luật sư bổ sung]` |
| Tệp đính kèm, ảnh | Như trên | Như trên | Như trên | |
| Bản ghi camera khi thi trực tuyến (YCTD-215; mặc định tắt) | Tự xoá theo hạn của trường | Tự xoá theo hạn của trường (mặc định `[30]` ngày, 7 đến 90) | Như `consented` | Cần đồng ý của cha mẹ (học sinh dưới 16 tuổi); GD-132; luật sư kiểm (PL-15 câu 6 đến 8) |
| Bản sao lưu | Theo vòng quay | Giữ tối thiểu `[30]` ngày (SL-01), xóa theo vòng quay | Như `consented` | SL-01 |
| Nhật ký hệ thống, nhật ký truy cập | `[ ]` | Tối thiểu `[12]` tháng | Tối thiểu `[12]` tháng | Theo tóm tắt Nghị định 333/2026/NĐ-CP về nhật ký hệ thống (luật sư kiểm) |
| Dữ liệu người dùng phải lưu theo pháp luật an ninh mạng (tài khoản, thời gian dùng dịch vụ, địa chỉ IP, ...) | `[ ]` | `[ ]` | Tối thiểu `[24]` tháng | Theo tóm tắt Nghị định 333/2026/NĐ-CP (luật sư kiểm phạm vi áp dụng) |
| Bằng chứng tuân thủ (`school_consents`, `school_hosting`, biên bản xóa) | Không có | Giữ sau khi xóa trường trong `[ ]` năm | Như `consented` | Phục vụ kiểm tra của cơ quan chuyên trách |
| Chứng từ thu phí giữa nền tảng và trường | — | Theo pháp luật kế toán | Theo pháp luật kế toán | Luật Kế toán `[luật sư kiểm thời hạn]` |

## 3. Khi chấm dứt hợp đồng

1. Trường chuyển chỉ đọc, được xuất toàn bộ dữ liệu trong `[30]` ngày [GD-99].
2. Hết thời hạn, Nền tảng xóa dữ liệu khỏi hệ thống đang chạy; bản sao lưu hết vòng quay chậm nhất sau `[ ]` ngày; gửi biên bản xác nhận xóa cho trường.
3. Ở hồ sơ Thử nghiệm: yêu cầu từng nhà cung cấp ở PL-08 xóa, giữ xác nhận.

## 4. Yêu cầu xóa của chủ thể dữ liệu

Chủ thể gửi qua Nhà trường; Nhà trường quyết định (có trường hợp không xóa theo khoản 2 Điều 14, Điều 19 Luật); Nền tảng thực hiện trong `[ ]` ngày làm việc từ khi Nhà trường yêu cầu; nếu không thể xóa vì lý do chính đáng thì Nhà trường thông báo cho chủ thể (khoản 5 Điều 14 Luật).

## 5. Cách xóa

- Cơ sở dữ liệu: xóa cơ sở dữ liệu hoặc lược đồ của trường; xóa khóa của trường ở `school_keys` (làm các trường dữ liệu đã mã hóa không đọc được nữa, kể cả trong bản sao lưu còn lại).
- Kho tệp: xóa toàn bộ đối tượng theo tiền tố của trường.
- Ghi biên bản: trường, phạm vi, thời điểm, người thực hiện, kết quả kiểm tra sau xóa.
