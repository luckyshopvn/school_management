# Bản nháp tài liệu DT-12 phần 12a: nối nhà cung cấp tin nhắn eSMS.vn (YCTD-92)

## Đã làm

- Anh Eric chọn eSMS.vn làm nhà cung cấp tin nhắn ngày 2026-10-13. Phần 12a thay lớp gửi chỉ ghi nhật ký bằng kết nối
  eSMS.vn khi có cấu hình.
- Gói dùng chung `packages/server` có `EsmsClient` (tệp `esms-client.ts`): gửi yêu cầu POST JSON tới
  `https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/` với các trường ApiKey, SecretKey, Phone,
  Content, Brandname, SmsType = 2 (tin chăm sóc khách hàng có tên thương hiệu), IsUnicode, Sandbox, RequestId (mã ngẫu
  nhiên mỗi lần gửi).
  - CodeResult = 100 là thành công, trả SMSID; mã khác hoặc mã HTTP lỗi thì báo lỗi kèm mã và nội dung lỗi.
  - Số điện thoại chuẩn hóa về dạng 84xxxxxxxxx (nhận 0xxxxxxxxx, +84, có dấu cách hoặc dấu chấm); số sai dạng thì báo
    lỗi, không gọi eSMS.vn.
  - Mặc định bỏ dấu tiếng Việt (gồm chữ đ) và gửi IsUnicode = 0 vì tin có dấu giá cao hơn; ESMS_UNICODE=true thì gửi
    nguyên văn có dấu.
  - Hết 10 giây không phản hồi thì hủy yêu cầu và báo lỗi.
- Dịch vụ định danh: `EsmsSmsSender` gửi mã đăng nhập một lần cho phụ huynh (YCTD-43); lỗi nhà cung cấp được ném ra cho
  luồng gửi mã.
- Máy chủ API: `EsmsSmsGateway` gửi tin nhắn thông báo (YCTD-71); lỗi được ném ra để tiến trình gửi thông báo ghi lỗi và
  thử lại như hiện nay.
- Cả hai dịch vụ đọc cấu hình bằng hàm dùng chung `readSmsProviderSettings`. Môi trường chạy thật (NODE_ENV=production)
  mà không đặt SMS_PROVIDER=esms thì dịch vụ dừng ngay khi khởi động. Trước đây chỉ dịch vụ định danh dừng, nay máy chủ API
  cũng dừng.

## Biến môi trường (đã thêm vào .env.example, để trống)

| Biến            | Ý nghĩa                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| SMS_PROVIDER    | Để trống hoặc `log`: chỉ ghi nhật ký, dùng khi phát triển và kiểm thử. `esms`: gửi qua eSMS.vn |
| ESMS_API_KEY    | Khóa API của tài khoản eSMS.vn, bắt buộc khi SMS_PROVIDER=esms                                 |
| ESMS_SECRET_KEY | Khóa bí mật của tài khoản eSMS.vn, bắt buộc khi SMS_PROVIDER=esms                              |
| ESMS_BRANDNAME  | Tên thương hiệu đã đăng ký với eSMS.vn, bắt buộc khi SMS_PROVIDER=esms                         |
| ESMS_SANDBOX    | `true`: gửi thử, eSMS.vn nhận yêu cầu nhưng không gửi tin thật                                 |
| ESMS_UNICODE    | `true`: gửi tin có dấu (giá cao hơn); mặc định bỏ dấu                                          |

## Kịch bản kiểm thử (kiểm thử đơn vị, giả lập eSMS.vn, không gọi eSMS.vn thật)

- CT-12a-1: Gửi thành công: trả mã tin; yêu cầu gửi đúng địa chỉ, phương thức POST, đủ các trường, SmsType 2, số điện thoại dạng 84 — đạt.
- CT-12a-2: eSMS.vn trả CodeResult khác 100: báo lỗi kèm mã và nội dung lỗi — đạt.
- CT-12a-3: eSMS.vn trả mã HTTP lỗi: báo lỗi — đạt.
- CT-12a-4: Nội dung có dấu khi chưa bật ESMS_UNICODE: gửi nội dung đã bỏ dấu, gồm chữ đ, IsUnicode 0 — đạt.
- CT-12a-5: Bật ESMS_UNICODE và ESMS_SANDBOX: giữ nguyên nội dung có dấu, IsUnicode 1, Sandbox 1 — đạt.
- CT-12a-6: Số điện thoại các dạng 0..., +84..., 84...: chuẩn hóa về 84...; số sai dạng báo lỗi và không gọi eSMS.vn — đạt.
- CT-12a-7: eSMS.vn không phản hồi trong thời hạn: hủy yêu cầu, báo lỗi quá thời hạn — đạt.
- CT-12a-8: SMS_PROVIDER=esms mà thiếu ESMS_API_KEY, ESMS_SECRET_KEY hoặc ESMS_BRANDNAME: báo lỗi nêu tên biến thiếu — đạt.
- CT-12a-9: SMS_PROVIDER=esms đủ biến ở môi trường chạy thật: đọc được cấu hình eSMS.vn — đạt.
- CT-12a-10: Không đặt SMS_PROVIDER: mặc định log khi phát triển; ở môi trường chạy thật thì dừng; nhà cung cấp lạ thì báo chưa hỗ trợ — đạt.
- CT-12a-11: Dịch vụ định danh với SMS_PROVIDER=esms: dùng lớp gửi eSMS.vn; mặc định dùng lớp ghi nhật ký — đạt.
- CT-12a-12: Dịch vụ định danh gửi mã đăng nhập qua eSMS.vn: gửi nội dung bỏ dấu; eSMS.vn trả lỗi thì luồng gửi nhận lỗi — đạt.
- CT-12a-13: Máy chủ API với SMS_PROVIDER=esms: dùng lớp gửi eSMS.vn; chưa cấu hình hoặc log thì ghi nhật ký — đạt.
- CT-12a-14: Máy chủ API gửi thông báo có dấu qua eSMS.vn: giữ nội dung có dấu khi bật ESMS_UNICODE; eSMS.vn trả lỗi thì tiến trình gửi nhận lỗi — đạt.

## Giới hạn

- Chưa thử với tài khoản eSMS.vn thật; các kịch bản trên dùng bộ giả lập yêu cầu HTTP.
- Cần nhà trường mở tài khoản eSMS.vn, nạp tiền và đăng ký tên thương hiệu (Brandname) cho tin chăm sóc khách hàng trước
  khi chạy thật; nội dung tin có thể phải đăng ký mẫu với nhà mạng theo quy định của eSMS.vn.
- Chưa nhận báo cáo trạng thái tin (callback) từ eSMS.vn; chỉ biết eSMS.vn đã nhận yêu cầu gửi.
- Nên thử với ESMS_SANDBOX=true trước khi gửi tin thật.
