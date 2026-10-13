# Bản nháp tài liệu DT-12 phần 12b: nhà cung cấp thanh toán thật (YCTD-92)

Bản nháp để đưa vào tai_lieu/ khi gộp; chưa sửa tai_lieu/.

## Tóm tắt

Ngày 2026-10-13 Eric chọn bốn nhà cung cấp thanh toán trực tuyến: PayOS, SePay, Casso, VNPay. Phần 12b thêm bốn cổng mới
vào sổ đăng ký cổng thanh toán đã có (YCTD-89), làm theo tài liệu công khai của từng nhà cung cấp:

| Mã cổng | Cách cấp mã thanh toán                                                             | Báo tiền vào                   | Cần mã BIN |
| ------- | ---------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| `payos` | Gọi API PayOS tạo yêu cầu thanh toán, nhận chuỗi VietQR và tài khoản nhận theo đơn | Webhook ký HMAC-SHA256         | Không      |
| `sepay` | Dựng VietQR tĩnh tới tài khoản thật của trường, nội dung là mã hóa đơn bỏ gạch     | Webhook xác thực bằng khóa API | Có         |
| `casso` | Dựng VietQR tĩnh như SePay                                                         | Webhook V2 ký HMAC-SHA512      | Có         |
| `vnpay` | Dựng địa chỉ trang thanh toán VNPay đã ký HMAC-SHA512, hết hạn sau 15 phút         | IPN (GET) ký HMAC-SHA512       | Không      |

- Khóa của nhà cung cấp chỉ đọc từ biến môi trường, không lưu trong cơ sở dữ liệu. Cổng có trong `PAYMENT_GATEWAY` mà thiếu
  biến bắt buộc thì máy chủ API dừng khởi động và báo tên biến thiếu.
- Mỗi tài khoản ngân hàng vẫn chọn cổng của mình như YCTD-89; tài khoản chưa chọn dùng cổng đầu trong `PAYMENT_GATEWAY`.
- Đối chiếu giữ nguyên quy tắc đã có: theo nội dung chuyển khoản (mã hóa đơn bỏ gạch) trước, số tiền sau; khớp thì tự lập
  phiếu thu, không khớp thì vào danh sách chờ kế toán. Với PayOS và VNPay, giao dịch còn được nối với yêu cầu thanh toán
  theo mã đơn ở nhà cung cấp (mã đơn PayOS, `vnp_TxnRef` của VNPay).
- Mỗi giao dịch có mã riêng theo nhà cung cấp (`payos-<reference>`, `sepay-<id>`, `casso-<id>`, `vnpay-<vnp_TxnRef>`); nhà
  cung cấp gửi lại cùng giao dịch thì không lập phiếu thu lần hai.
- Điểm cuối nhận thông báo là điểm cuối công khai (không dùng mã phiên), xác thực bằng chữ ký hoặc khóa của từng nhà cung cấp.
  Cổng chưa bật trên máy chủ thì trả 404; chữ ký hoặc khóa sai thì trả 401 và không ghi giao dịch.
- Ứng dụng phụ huynh: khi `qr_content` là địa chỉ http(s) (VNPay) thì hiện nút "Thanh toán qua VNPay" mở trang thanh toán,
  mã QR là mã của địa chỉ đó, không hiện dòng số tài khoản.

## Biến môi trường

| Cổng  | Biến bắt buộc                                                                | Biến tùy chọn                                                                                                                            |
| ----- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Chung | `PAYMENT_GATEWAY` (ví dụ `payos,sepay`)                                      |                                                                                                                                          |
| PayOS | `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_RETURN_URL` | `PAYOS_CANCEL_URL` (trống thì dùng `PAYOS_RETURN_URL`), `PAYOS_API_URL` (mặc định `https://api-merchant.payos.vn`)                       |
| SePay | `SEPAY_WEBHOOK_API_KEY`                                                      |                                                                                                                                          |
| Casso | `CASSO_WEBHOOK_SECRET`                                                       |                                                                                                                                          |
| VNPay | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL`                    | `VNPAY_PAYMENT_URL` (mặc định `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`; khi chạy thật đổi sang địa chỉ chính thức VNPay cấp) |

## Địa chỉ đăng ký với nhà cung cấp

`<máy chủ API>` là địa chỉ công khai HTTPS của máy chủ API (việc T6), tiền tố `/api/v1`.

| Nhà cung cấp | Địa chỉ                                               | Ghi chú cấu hình bên nhà cung cấp                                                                                                                    |
| ------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| PayOS        | `POST <máy chủ API>/api/v1/payment-webhooks/payos`    | Khai ở kênh thanh toán trên my.payos.vn; PayOS gửi dữ liệu thử khi xác nhận địa chỉ, hệ thống bỏ qua vì mã đơn không có yêu cầu thanh toán tương ứng |
| SePay        | `POST <máy chủ API>/api/v1/payment-webhooks/sepay`    | Chọn kiểu xác thực API Key, khóa trùng `SEPAY_WEBHOOK_API_KEY`; chọn sự kiện tiền vào                                                                |
| Casso        | `POST <máy chủ API>/api/v1/payment-webhooks/casso`    | Tích hợp Webhook V2, Key bảo mật trùng `CASSO_WEBHOOK_SECRET`                                                                                        |
| VNPay        | `GET <máy chủ API>/api/v1/payment-webhooks/vnpay-ipn` | Gửi địa chỉ IPN cho VNPay cấu hình; `VNPAY_RETURN_URL` là trang của ứng dụng phụ huynh sau khi thanh toán                                            |

Mã trả lời IPN VNPay: `00` đã nhận (kể cả giao dịch không thành công), `97` sai chữ ký, `01` không có đơn, `04` sai số tiền,
`02` đơn đã xác nhận.

## Ca kiểm thử

- CT-12b-1: PayOS tạo mã thanh toán với fetch giả lập: gửi đúng địa chỉ, tiêu đề x-client-id, x-api-key, mã đơn là số nguyên dương an toàn, chữ ký HMAC-SHA256 của `amount&cancelUrl&description&orderCode&returnUrl`; trả chuỗi VietQR và tài khoản nhận của PayOS — đạt.
- CT-12b-2: PayOS trả mã lỗi hoặc không kết nối được: báo lỗi quy tắc P06-11 — đạt.
- CT-12b-3: thông báo PayOS đúng chữ ký: thành giao dịch tiền vào (mã `payos-<reference>`, giờ giao dịch theo giờ Việt Nam); sửa số tiền hoặc thiếu chữ ký bị từ chối; giao dịch không thành công bị bỏ qua — đạt.
- CT-12b-4: SePay dựng VietQR tới tài khoản trường có số tiền và nội dung; thông báo đúng khóa thành giao dịch tiền vào; thiếu khóa, sai khóa, sai kiểu tiêu đề bị từ chối; giao dịch tiền ra bị bỏ qua — đạt.
- CT-12b-5: Casso kiểm chữ ký HMAC-SHA512 khớp bộ dữ liệu mẫu chính thức; thông báo đúng thành giao dịch; sửa dữ liệu hoặc thiếu chữ ký bị từ chối; dữ liệu dạng mảng chỉ lấy giao dịch tiền vào; nội dung có dấu ký kiểu \uXXXX cũng được nhận — đạt.
- CT-12b-6: VNPay dựng địa chỉ thanh toán: số tiền nhân 100, nội dung là mã hóa đơn bỏ gạch, giờ tạo và giờ hết hạn (sau 15 phút) theo giờ Việt Nam, tham số xếp theo tên và mã hóa khoảng trắng thành dấu cộng, chữ ký HMAC-SHA512 đúng — đạt.
- CT-12b-7: IPN VNPay đúng chữ ký (chữ ký viết hoa vẫn nhận) thành giao dịch tiền vào; sửa tham số thì báo sai chữ ký; thanh toán không thành công không tạo giao dịch — đạt.
- CT-12b-8: bật cổng mà thiếu biến môi trường thì dừng khởi động và liệt kê biến thiếu; đủ biến thì tạo được cổng của cả bốn mã — đạt.
- CT-12b-9: điểm cuối PayOS không cần mã phiên: sai chữ ký trả 401 và không ghi giao dịch; đúng chữ ký thì tự lập phiếu thu, hóa đơn hết nợ; gửi lại không lập phiếu thu thứ hai; dữ liệu thử có mã đơn lạ bị bỏ qua — đạt.
- CT-12b-10: điểm cuối SePay: thiếu hoặc sai khóa trả 401; đúng khóa thì tự lập phiếu thu, hóa đơn hết nợ; tiền ra bỏ qua; điểm cuối Casso khi chưa bật cổng trả 404 — đạt.
- CT-12b-11: IPN VNPay qua máy chủ: sai chữ ký 97, đơn lạ 01, sai số tiền 04, đúng thì 00 và tự lập phiếu thu, gửi lại 02 — đạt.

## Giới hạn

- Chưa thử với tài khoản thật của PayOS, SePay, Casso, VNPay; mọi ca kiểm thử dùng khóa thử và fetch giả lập. Trước khi chạy
  thật cần thử trên môi trường sandbox của từng nhà cung cấp.
- Casso: chữ ký theo kho mẫu chính thức github.com/CassoHQ/casso-webhook-v2-verify-signature (HMAC-SHA512 của
  `t + "." + JSON thân thông báo đã xếp khóa ở mọi cấp`). Bộ mẫu python khớp; chữ ký mẫu trong javascript.js không khớp với
  chính dữ liệu mẫu đó. Chưa rõ máy chủ Casso ghi chữ có dấu nguyên dạng hay dạng \uXXXX nên hệ thống nhận cả hai. Chưa kiểm
  độ lệch thời điểm `t` vì tài liệu không nêu.
- SePay và Casso dựng VietQR tĩnh nên phụ huynh có thể sửa nội dung khi chuyển; nội dung sai thì giao dịch vào danh sách chờ.
- PayOS: mô tả gửi PayOS cắt còn 25 ký tự; mã đơn tạo từ thời điểm (mili giây) nhân 1000 cộng số ngẫu nhiên. Chưa kiểm chữ
  ký của phản hồi tạo yêu cầu, chưa gọi API hủy yêu cầu cũ khi số tiền đổi.
- VNPay: địa chỉ IP gửi VNPay là IP của người gọi lấy mã QR (mặc định 127.0.0.1 khi không có). Chưa làm truy vấn giao dịch
  (querydr) và hoàn tiền.
