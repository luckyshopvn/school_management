# 27.1. BỘ CA KIỂM THỬ CHI TIẾT — DỊCH VỤ ĐỊNH DANH VÀ P01

- Mô tả: Ca kiểm thử chi tiết cho dịch vụ định danh (Q-125, Q-126) và các chức năng giai đoạn 1 của phân hệ P01 Nền tảng, đơn vị và phân quyền (việc N21, Q-105).
- Phiên bản: 1.15
- Ngày cập nhật: 2026-10-10
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Quy ước

1. Mã ca: `CTC-DD-nnn` cho dịch vụ định danh, `CTC-P01-nnn` cho phân hệ P01. Đánh số tăng dần, không tái sử dụng mã đã cấp.
2. Cột "Căn cứ" trỏ tới tiêu chí nghiệm thu (AC), quy tắc (BR, PQ, XT, BM, KT) và ca khởi đầu (CT) trong `21_KICH_BAN_KIEM_THU.md` mà ca này chi tiết hóa.
3. Cột "Lớp" theo `20_KE_HOACH_KIEM_THU.md` mục 3: LT-01 đơn vị, LT-02 tích hợp, LT-04 phân quyền, LT-05 dữ liệu.
4. Ưu tiên: Cao là ca bắt buộc đạt trước khi nghiệm thu đợt xây dựng; Trung bình và Thấp chạy trong kiểm thử hồi quy.
5. Mọi ca phân quyền gọi thẳng điểm cuối, không thao tác qua giao diện (GD-57). Mã lỗi theo `17_DAC_TA_API.md` mục 2.
6. Cột "Thực tế" và "Trạng thái" chỉ điền khi đã chạy thật. Trạng thái dùng: Chưa chạy, Đạt, Không đạt.
7. Giá trị cấu hình dùng trong ca là giá trị của dữ liệu kiểm thử, không phải giá trị chốt cho vận hành.

## 2. Dữ liệu và tài khoản dùng chung

Cây đơn vị theo DL-01 và GD-79:

| Ký hiệu | Đơn vị | Đơn vị cha |
|---|---|---|
| TC | Trường chính | Không có |
| PH-A | Phân hiệu A | TC |
| PH-B | Phân hiệu B | TC |
| ĐT-A1 | Điểm trường A1 | TC |
| ĐT-A2 | Điểm trường A2 | TC |
| ĐT-B1 | Điểm trường B1 | TC |

Cây chỉ có hai cấp (QĐ-23). "Nhóm A" là ba đơn vị PH-A, ĐT-A1, ĐT-A2; "nhóm B" là PH-B, ĐT-B1. Tài khoản có phạm vi nhóm A được gán ở cả ba đơn vị của nhóm A (YCTD-38).

Tài khoản kiểm thử:

| Ký hiệu | Vai trò | Phạm vi |
|---|---|---|
| HT | VT-02 Hiệu trưởng | Toàn trường |
| PHT-A | VT-15 Phó Hiệu trưởng | Nhóm A |
| QL-A | VT-03 Quản lý đơn vị | Nhóm A |
| QL-A1 | VT-03 Quản lý đơn vị | ĐT-A1 |
| KT-A | VT-04 Kế toán | Nhóm A |
| KTT | VT-05 Kế toán trưởng | TC |
| NS-A | VT-06 Nhân sự | Nhóm A |
| GV-A1 | VT-07 Giáo viên chủ nhiệm | Một lớp của ĐT-A1 |
| PH-1 | VT-14 Phụ huynh | Trẻ T1 thuộc ĐT-A1 |
| QTNT | VT-01 Quản trị nền tảng | Cấu hình kỹ thuật |
| KTV | VT-20 Kiểm toán viên | Toàn trường, có ngày hết hiệu lực |

Tham số dữ liệu kiểm thử: số lần đăng nhập sai tối đa 5; số ngày không dùng thì khóa 90; mã một lần hết hạn sau 5 phút, nhập sai tối đa 5 lần, gửi tối đa 5 lần mỗi giờ cho một số điện thoại.

## 3. Dịch vụ định danh

### 3.1. Đăng nhập bằng mật khẩu

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-DD-001 | P19-06 | XT-01, BM-01 | LT-02 | Cao | Tài khoản NS-A đang hoạt động | Gọi `POST /api/v1/auth/login` bằng số điện thoại và mật khẩu đúng | Trả mã phiên và mã làm mới; `GET /api/v1/auth/me` trả đúng vai trò VT-06 và đơn vị PH-A | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-002 | P19-06 | XT-01 | LT-02 | Trung bình | Tài khoản NS-A có tên đăng nhập | Đăng nhập bằng tên đăng nhập và mật khẩu đúng | Đăng nhập thành công như CTC-DD-001 | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-003 | P19-06 | XT-01, BM-29 | LT-02 | Cao | Tài khoản NS-A | Đăng nhập với mật khẩu sai | Trả `ERR_UNAUTHENTICATED`, không cấp phiên; phản hồi không chứa thông tin nội bộ | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-004 | P19-06 | XT-05, BM-04, BM-36, CT-006, YCTD-35 | LT-02 | Cao | Tài khoản NS-A, đếm sai bằng 0 | Đăng nhập sai 5 lần liên tiếp, rồi đăng nhập đúng; sau 15 phút đăng nhập đúng lần nữa | Lần đúng đầu tiên bị từ chối vì tài khoản tạm khóa, thông báo thử lại sau 15 phút; sau 15 phút đăng nhập thành công; nhật ký bảo mật ghi 5 lần sai theo tài khoản và địa chỉ mạng | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-005 | P19-06 | BR-05 | LT-02 | Cao | Hợp đồng của NS-A đã chấm dứt, tài khoản đã khóa | Đăng nhập bằng thông tin đúng | Bị từ chối; tài khoản vẫn tồn tại, lịch sử thao tác còn nguyên | | Chưa chạy |
| CTC-DD-006 | P19-06 | PQ-07, BM-09 | LT-02 | Trung bình | Tài khoản GV-A1 không đăng nhập 91 ngày | Đăng nhập bằng thông tin đúng | Bị từ chối, tài khoản ở trạng thái tạm khóa, cần kích hoạt lại | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-007 | P19-06 | AC-209, BM-68, CT-165 | LT-02 | Cao | KTV có ngày hết hiệu lực là hôm qua | Đăng nhập bằng thông tin đúng | Bị từ chối; tài khoản ở trạng thái khóa | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-008 | P19-06 | KT-07, BM-26 | LT-02 | Trung bình | Không | Gửi liên tục yêu cầu đăng nhập vượt giới hạn tần suất | Trả `ERR_RATE_LIMIT` kèm thời gian chờ | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-009 | P19-06 | XT-04, BM-02 | LT-05 | Cao | Hai tài khoản đặt cùng một mật khẩu | Đọc bảng `users` trong cơ sở dữ liệu định danh | Không có mật khẩu bản rõ; hai giá trị băm khác nhau vì có muối; thuật toán là thuật toán băm mật khẩu chuyên dụng | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |

### 3.2. Mật khẩu mặc định của phụ huynh

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-DD-010 | P19-06 | AC-203, PQ-06, XT-03, CT-159 | LT-02 | Cao | PH-1 vừa được tạo với mật khẩu mặc định chung | Đăng nhập bằng mật khẩu mặc định | Đăng nhập được nhưng chỉ dùng được điểm cuối đổi mật khẩu | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-011 | P19-06 | AC-203, BM-69 | LT-04 | Cao | PH-1 đăng nhập bằng mật khẩu mặc định, chưa đổi | Gọi `GET /api/v1/children` | Trả `ERR_FORBIDDEN` | Phiên hạn chế bị từ chối ở điểm cuối của dịch vụ định danh, kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` ngày 10/10/2026; phần `GET /api/v1/children` chạy khi có P02 | Chưa chạy |
| CTC-DD-012 | P19-06 | AC-89, CT-007 | LT-02 | Cao | PH-1 ở trạng thái của CTC-DD-010 | Gọi `POST /api/v1/auth/change-password` với mật khẩu mặc định làm mật khẩu hiện tại, đặt mật khẩu mới hợp lệ (YCTD-43); đăng nhập lại bằng mật khẩu mới; thử mật khẩu mặc định | Đổi thành công; mật khẩu mới dùng được mọi chức năng của phụ huynh; mật khẩu mặc định bị từ chối | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-013 | P19-06 | BM-03 | LT-02 | Trung bình | PH-1 ở trạng thái của CTC-DD-010 | Đặt mật khẩu mới ngắn hơn độ dài tối thiểu | Trả `ERR_VALIDATION`, mật khẩu không đổi | | Chưa chạy |
| CTC-DD-014 | P01-08 | BM-69 | LT-05 | Cao | HT đã cấu hình mật khẩu mặc định chung | Đọc cấu hình qua `GET /api/v1/auth/settings` và đọc cơ sở dữ liệu (YCTD-43) | Không trả mật khẩu mặc định ở dạng rõ; cơ sở dữ liệu chỉ lưu giá trị băm | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-015 | P02-03 | BM-69, PQ-06 | LT-02 | Trung bình | Hồ sơ trẻ được duyệt, phụ huynh có số điện thoại | Kiểm tra tin nhắn gửi cho phụ huynh | Tin nhắn báo tài khoản đã tạo, không chứa mật khẩu | | Chưa chạy |

### 3.3. Mã một lần cho phụ huynh

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-DD-016 | P19-06 | XT-09, BM-61 | LT-02 | Cao | PH-1 đã đổi mật khẩu mặc định | Gọi `POST /api/v1/auth/otp/request` | Tin nhắn chứa mã sáu chữ số; bảng `one_time_codes` lưu giá trị băm, mục đích là đăng nhập | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-017 | P19-06 | AC-180, CT-136 | LT-02 | Cao | Đã có mã của CTC-DD-016, còn hạn | Gọi `POST /api/v1/auth/otp/login` với mã đúng | Đăng nhập thành công, không cần mật khẩu | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-018 | P19-06 | AC-181 | LT-02 | Cao | Mã đã quá 5 phút | Đăng nhập bằng mã đó | Bị từ chối, phải yêu cầu mã mới | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-019 | P19-06 | AC-181, CT-137 | LT-02 | Cao | Mã còn hạn | Nhập sai 5 lần rồi nhập đúng | Lần đúng vẫn bị từ chối, phải yêu cầu mã mới | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-020 | P19-06 | XT-09, BM-61 | LT-02 | Cao | Mã đã dùng đăng nhập thành công | Dùng lại mã đó | Bị từ chối | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-021 | P19-06 | BM-61 | LT-02 | Cao | Một số điện thoại không có trong hệ thống | Yêu cầu mã cho số đó và cho số của PH-1 | Hai phản hồi giống nhau, không tiết lộ số có tồn tại hay không; không gửi tin cho số không tồn tại | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-022 | P19-06 | XT-09, BM-61 | LT-02 | Trung bình | PH-1 | Yêu cầu mã lần thứ 6 trong một giờ | Trả `ERR_RATE_LIMIT`, không gửi tin | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-023 | P19-06 | XT-01 | LT-04 | Trung bình | Tài khoản NS-A | Yêu cầu mã một lần và đăng nhập bằng mã | Bị từ chối vì cách đăng nhập này chỉ dành cho phụ huynh | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-DD-042 | P19-06 | Q-147, AC-203 | LT-02 | Cao | PH-1 còn mật khẩu mặc định, chưa đổi | Đăng nhập bằng mã một lần; gọi `GET /api/v1/children` | Đăng nhập thành công; xem được trẻ T1 bình thường; lần đăng nhập bằng mật khẩu mặc định sau đó vẫn chỉ vào màn hình đổi mật khẩu | Đăng nhập bằng mã cấp phiên đầy đủ kể cả sau khi làm mới, kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` ngày 10/10/2026; phần xem trẻ chạy khi có P02 | Chưa chạy |
| CTC-DD-024 | P19-06 | KT-09 | LT-02 | Thấp | PH-1 đã nhận 5 tin nhắn thông báo trong ngày | Yêu cầu mã một lần | Vẫn nhận được mã vì giới hạn 5 tin mỗi ngày không tính mã một lần | | Chưa chạy |

### 3.4. Xác thực hai lớp (đã bỏ, YCTD-31)

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-DD-025 | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31) | — | — | — | — | — | — | — | Không áp dụng |
| CTC-DD-026 | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31) | — | — | — | — | — | — | — | Không áp dụng |
| CTC-DD-027 | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31) | — | — | — | — | — | — | — | Không áp dụng |
| CTC-DD-028 | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31) | — | — | — | — | — | — | — | Không áp dụng |
| CTC-DD-029 | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31) | — | — | — | — | — | — | — | Không áp dụng |
| CTC-DD-030 | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31) | — | — | — | — | — | — | — | Không áp dụng |
| CTC-DD-043 | P19-06 | XT-07, YCTD-31 | LT-02 | Cao | Tài khoản HT, PHT-A, KTT, QTNT | Đăng nhập từng tài khoản bằng mật khẩu đúng; gọi `POST /api/v1/auth/verify-otp` | Mỗi lần đăng nhập được cấp phiên đầy đủ, không yêu cầu mã xác thực hai lớp; điểm cuối xác thực hai lớp không còn dùng | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |

### 3.5. Phiên làm việc

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-DD-031 | P19-06 | XT-02, Q-120 | LT-02 | Cao | NS-A vừa đăng nhập | Gọi điểm cuối nghiệp vụ sau 16 phút bằng mã phiên cũ; gọi `POST /api/v1/auth/refresh` | Lần đầu trả `ERR_UNAUTHENTICATED`; làm mới thành công và mã phiên mới dùng được | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-032 | P19-06 | XT-02, Q-120 | LT-02 | Cao | NS-A đăng nhập trên cổng quản trị | Làm mới bằng mã làm mới sau 8 giờ 1 phút | Bị từ chối, phải đăng nhập lại | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-033 | P19-06 | XT-02, Q-120 | LT-02 | Trung bình | GV-A1 và PH-1 đăng nhập trên ứng dụng | Làm mới sau 29 ngày; làm mới sau 30 ngày 1 phút | Lần đầu thành công; lần sau bị từ chối | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-034 | P19-06 | BM-05 | LT-02 | Cao | NS-A đang có phiên | Gọi `POST /api/v1/auth/logout`, rồi làm mới bằng mã làm mới cũ | Làm mới bị từ chối | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-035 | P01-07 | AC-05, PQ-04, BM-14, BM-56, CT-005 | LT-04 | Cao | QL-A đang có phiên, đang có quyền duyệt hồ sơ trẻ | HT thu hồi vai trò VT-03 của QL-A; QL-A gửi ngay yêu cầu duyệt hồ sơ | Bị từ chối ngay, không chờ phiên hết hạn; mã làm mới cũ bị thu hồi | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-036 | P01-06 | PQ-04 | LT-04 | Cao | GV-A1 đang có phiên | HT khóa tài khoản GV-A1; GV-A1 gửi yêu cầu kế tiếp | Bị từ chối ngay | Kiểm thử tự động `apps/api/src/authentication/authentication.guard.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-037 | P19-06 | XT-06, AC-146, BM-58, CT-102 | LT-02 | Cao | Không | Gửi yêu cầu thay đổi dữ liệu tới máy chủ API kèm mã phiên sửa chữ ký, và kèm mã phiên hợp lệ | Mã sửa chữ ký bị từ chối; mã hợp lệ được xử lý sau khi kiểm tra | Kiểm thử tự động `apps/api/src/authentication/authentication.guard.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-038 | P19-06 | XT-08, BM-54 | LT-05 | Cao | Không | Rà cấu trúc cơ sở dữ liệu năm học, cơ sở dữ liệu hệ thống và mã nguồn máy chủ API | Không có cột mật khẩu, không có hàm xác thực mật khẩu ngoài dịch vụ định danh | | Chưa chạy |

### 3.6. Quản lý tài khoản qua dịch vụ định danh

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-DD-039 | P01-06 | AC-147, CT-103 | LT-04 | Cao | GV-A1 | Gọi `PATCH /api/v1/users/{id}` của NS-A | Dịch vụ định danh trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-040 | P01-06 | PQ-08 | LT-04 | Trung bình | PH-1 | Gọi điểm cuối cập nhật tài khoản để đổi số điện thoại đăng nhập của chính mình | Trả `ERR_FORBIDDEN`; số điện thoại không đổi | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-DD-041 | P01-06 | AC-04, CT-004 | LT-04 | Cao | QTNT | Gọi `GET /api/v1/children` và `GET /api/v1/invoices` | Không trả dữ liệu nghiệp vụ nào | | Chưa chạy |

## 4. Phân hệ P01

### 4.1. P01-01 Cây đơn vị

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-001 | P01-01 | AC-135, CT-091 | LT-02 | Cao | Trường chưa có đơn vị | HT tạo TC không chọn đơn vị cha | Tạo thành công, đơn vị cha trống | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-002 | P01-01 | BR-01 | LT-02 | Cao | Đã có TC | HT tạo PH-A loại Phân hiệu và ĐT-A1 loại Điểm trường dưới TC | Tạo thành công; `GET /api/v1/org-units/tree` trả hai đơn vị dưới TC kèm loại | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-003 | P01-01 | AC-136, BR-01, CT-092, YCTD-38 | LT-02 | Cao | Cây theo mục 2 | Tạo đơn vị có đơn vị cha là ĐT-A1; đổi đơn vị cha của PH-A thành ĐT-A1 | Cả hai trả `ERR_RULE_VIOLATION` kèm mã BR-01; cây không đổi | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-004 | P01-01 | AC-136, YCTD-38 | LT-02 | Trung bình | Cây theo mục 2 | Tạo Trường chính thứ hai; đặt TC dưới PH-A | Bị từ chối như CTC-P01-003 | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-005 | P01-01 | AC-137, CT-093, YCTD-38 | LT-02 | Cao | Cây theo mục 2 | Mở cây đơn vị; chuyển sang danh sách phẳng và lọc theo loại Điểm trường | Năm đơn vị cấp 2 nằm dưới TC kèm loại; danh sách phẳng chỉ còn ĐT-A1, ĐT-A2, ĐT-B1 | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-006 | Bỏ ngày 09/10/2026: nhãn cấp cố định, không đổi được (YCTD-38) | — | — | — | — | — | — | — | Không áp dụng |
| CTC-P01-007 | P01-01 | BR-75 | LT-02 | Trung bình | ĐT-A2 không còn dùng | Ngừng sử dụng ĐT-A2 | ĐT-A2 ở trạng thái ngừng sử dụng, không bị xóa; không chọn được khi tạo lớp mới | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-008 | P01-01 | P01-01, PQ-03 | LT-04 | Cao | QL-A | Gọi `POST /api/v1/org-units` | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-009 | P01-01 | AC-139, CT-095 | LT-04 | Cao | Tài khoản gán ở TC | Truy vấn danh sách lớp của ĐT-B1 | Được trả dữ liệu | | Chưa chạy |
| CTC-P01-010 | P01-01 | AC-140, CT-096 | LT-04 | Cao | QL-A1 gán ở ĐT-A1 | Truy vấn danh sách lớp của PH-A và của ĐT-A2 | Cả hai bị từ chối | | Chưa chạy |
| CTC-P01-011 | P01-01 | AC-01, CT-001 | LT-04 | Cao | QL-A gán ở nhóm A | Truy vấn danh sách trẻ | Chỉ trả trẻ thuộc PH-A, ĐT-A1, ĐT-A2; không có trẻ của PH-B, ĐT-B1 | | Chưa chạy |
| CTC-P01-012 | P01-01 | PCF-05 | LT-05 | Trung bình | Cây theo mục 2 | HT đổi tên PH-B; mở nhật ký thao tác | Có bản ghi người thực hiện, thời điểm, giá trị trước và sau | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 09/10/2026 | Đạt |

### 4.2. P01-02 Năm học

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-013 | P01-02 | P01-02 | LT-02 | Cao | Không | HT tạo năm học 2027–2028 với ngày bắt đầu và kết thúc | Năm học ở trạng thái chưa mở | Kiểm thử tự động `apps/api/src/academic-years/academic-years.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-014 | P01-02 | AC-194, QĐ-15, QĐ-17, CT-150 | LT-05 | Cao | Năm 2026–2027 đang dùng theo DL-11, có trẻ đang học và công nợ chưa tất toán | HT gọi `POST /api/v1/academic-years/{id}/open` cho 2027–2028 | Có cơ sở dữ liệu năm mới gồm trẻ đang học, phụ huynh, nhân sự, danh mục, cấu hình, số dư công nợ chưa tất toán; mã định danh của mọi bản ghi chuyển sang giữ nguyên | | Chưa chạy |
| CTC-P01-015 | P01-02 | AC-194, QĐ-17 | LT-05 | Cao | Sau CTC-P01-014 | So sánh mã định danh của 20 trẻ ngẫu nhiên giữa hai cơ sở dữ liệu | Trùng khớp hoàn toàn | | Chưa chạy |
| CTC-P01-016 | P01-02 | P01-02, QĐ-15 | LT-02 | Cao | Năm 2026–2027 đã đóng | Gửi yêu cầu sửa một hồ sơ trẻ của năm 2026–2027 | Bị từ chối vì cơ sở dữ liệu năm cũ chỉ đọc; đọc vẫn được | | Chưa chạy |
| CTC-P01-017 | P01-02 | GD-90 | LT-05 | Trung bình | Sau CTC-P01-014 | Mở lịch sử lớp của một trẻ ở năm mới và ở năm cũ | Năm mới có lịch sử lớp gần nhất; năm cũ có lịch sử đầy đủ | | Chưa chạy |
| CTC-P01-018 | P01-02 | P01-02, PQ-11 | LT-04 | Cao | QL-A, PHT-A | Gọi tạo năm học và mở năm học | Đều trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/academic-years/academic-years.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-019 | P01-02 | QU-11 | LT-02 | Trung bình | Năm cũ đã đóng, có thay đổi cấu trúc dữ liệu mới | Chạy công cụ thay đổi cấu trúc dữ liệu | Chỉ cơ sở dữ liệu năm đang dùng được thay đổi; năm đã đóng giữ phiên bản cấu trúc cũ và vẫn đọc được | | Chưa chạy |
| CTC-P01-096 | P01-02 | AC-221, BR-89, Q-149, CT-177, YCTD-37 | LT-02 | Cao | Năm 2026–2027 đang dùng có trẻ T9 đã thôi học còn nợ 500 000 | HT gọi `POST /api/v1/academic-years/{id}/open` cho 2027–2028 | Trả `ERR_RULE_VIOLATION` kèm mã BR-89 và danh sách trẻ còn nợ; không tạo cơ sở dữ liệu mới; 2026–2027 vẫn đang dùng | | Chưa chạy |
| CTC-P01-097 | P01-02 | BR-89, BR-93, Q-149, YCTD-37 | LT-02 | Cao | Như CTC-P01-096 | KT-A lập phiếu thu đủ 500 000 cho T9; HT mở 2027–2028 | Mở thành công; 2026–2027 chuyển sang đã đóng, cơ sở dữ liệu chỉ đọc | | Chưa chạy |
| CTC-P01-098 | P01-02 | AC-194, BR-89 | LT-05 | Cao | Năm 2026–2027 có trẻ T9 đã thôi học còn nợ và trẻ T1 đang học còn nợ | Mở năm 2027–2028 | T1 và số dư công nợ của T1 chuyển sang năm mới; T9 và công nợ của T9 không chuyển | | Chưa chạy |
| CTC-P01-099 | P01-02 | AC-228, BR-91, CT-184 | LT-02 | Cao | Năm học 2026–2027 chưa có lịch | HT lưu học kỳ 1 từ 05/09/2026 đến 15/01/2027, học kỳ 2 từ 18/01/2027 đến 25/05/2027, kỳ hè từ 01/06/2027 đến 31/07/2027, ngày học thứ hai đến thứ sáu | Lưu được; danh sách tuần đánh số liên tục từ tuần chứa 05/09/2026 đến hết kỳ hè | Kiểm thử tự động `apps/api/src/academic-years/academic-years.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-100 | P01-02 | AC-228, BR-91 | LT-02 | Cao | Không | Lưu lịch có học kỳ 1 kết thúc 20/01/2027, học kỳ 2 bắt đầu 18/01/2027 | Trả `ERR_VALIDATION` | Kiểm thử tự động `apps/api/src/academic-years/academic-years.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-101 | P01-02 | BR-91 | LT-02 | Trung bình | Không | Lưu kỳ hè bắt đầu 20/05/2027, trước khi học kỳ 2 kết thúc | Trả `ERR_VALIDATION` | Kiểm thử tự động `apps/api/src/academic-years/academic-years.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-102 | P01-02 | AC-229, BR-91 | LT-02 | Cao | Lịch của CTC-P01-099 | HT đánh dấu tuần chứa ngày 08/02/2027 là tuần nghỉ Tết qua `PATCH /api/v1/academic-years/{id}/weeks` | Tuần đó có cờ nghỉ; số tuần không đổi | Kiểm thử tự động `apps/api/src/academic-years/academic-years.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-103 | P01-02 | BR-91, YCTD-30 | LT-04 | Cao | QL-A, PHT-A | Gọi `PUT /api/v1/academic-years/{id}/calendar` | Cả hai trả `ERR_FORBIDDEN` vì lịch chung toàn trường do Hiệu trưởng lập | Kiểm thử tự động `apps/api/src/academic-years/academic-years.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-104 | P01-02 | YCTD-30, QĐ-17 | LT-05 | Trung bình | Năm 2027–2028 đã tạo, chưa mở | HT lưu lịch năm 2027–2028; đọc lịch | Lịch lưu ở cơ sở dữ liệu hệ thống và đọc được trước khi mở năm học | Kiểm thử tự động `apps/api/src/academic-years/academic-years.test.ts` đạt ngày 09/10/2026 | Đạt |

### 4.3. P01-03 Phòng ban và P01-04 Chức danh

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-020 | P01-03 | P01-03 | LT-02 | Trung bình | Cây theo mục 2 | NS-A tạo phòng ban "Tổ chuyên môn" thuộc PH-A, có phòng ban cha | Tạo thành công, hiện đúng trong sơ đồ phòng ban | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-021 | P01-03 | P01-03 | LT-04 | Trung bình | NS-A gán ở nhóm A | Tạo phòng ban thuộc PH-B | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-022 | P01-03 | P01-03 | LT-04 | Trung bình | GV-A1 | Gọi `POST /api/v1/departments` | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-023 | P01-03 | BR-75 | LT-02 | Thấp | Phòng ban đã có nhân sự | Ngừng sử dụng phòng ban | Trạng thái ngừng sử dụng; nhân sự cũ vẫn giữ lịch sử phòng ban | | Chưa chạy |
| CTC-P01-024 | P01-04 | P01-04, BR-37 | LT-02 | Trung bình | Không | NS-A tạo chức danh "Giáo viên mầm non hạng III" kèm cấp bậc | Tạo thành công | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-025 | P01-04 | P01-04 | LT-04 | Trung bình | KT-A | Gọi `POST /api/v1/job-titles` | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |

### 4.4. P01-05 Danh mục dùng chung

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-026 | P01-05 | P01-05 | LT-02 | Trung bình | Không | HT tạo mục mới trong một loại danh mục dùng chung | Mục mới chọn được ở các màn hình dùng loại danh mục đó | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-027 | P01-05 | BR-75 | LT-02 | Trung bình | Một mục đã được dùng trong bản ghi cũ | Ngừng sử dụng mục đó | Bản ghi cũ vẫn hiển thị đúng mục; không chọn được mục đó cho bản ghi mới | | Chưa chạy |
| CTC-P01-028 | P01-05 | KT-04 | LT-02 | Thấp | Đã có mã "MA_01" trong một loại danh mục | Tạo mục mới trùng mã | Trả `ERR_CONFLICT` | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-029 | P01-05 | P01-05 | LT-04 | Trung bình | QL-A | Tạo mục danh mục dùng chung | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |

### 4.5. P01-06 Tài khoản

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-030 | P01-06 | P01-06 | LT-02 | Cao | Không | HT tạo tài khoản giáo viên với số điện thoại, vai trò VT-07, đơn vị ĐT-A1 | Tạo thành công; người dùng đăng nhập được | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-031 | P01-06 | P01-06, PQ-03 | LT-02 | Cao | QL-A | Tạo tài khoản nhân viên thuộc ĐT-A1 | Tạo thành công vì QL-A được gán ở ĐT-A1 | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-032 | P01-06 | PQ-03 | LT-04 | Cao | QL-A | Tạo tài khoản thuộc PH-B | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-033 | P01-06 | KT-04 | LT-02 | Cao | Số điện thoại đã thuộc một tài khoản nhân sự | Tạo tài khoản nhân sự khác cùng số điện thoại | Trả `ERR_CONFLICT` | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-034 | P01-06 | P01-06 | LT-02 | Cao | Tài khoản GV-A1 đang hoạt động | HT khóa rồi mở khóa | Khi khóa thì không đăng nhập được; khi mở khóa thì đăng nhập lại được; dữ liệu không mất | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-035 | P01-06 | P01-06, AC-220, BM-07, Q-148, CT-176 | LT-02 | Cao | Tài khoản GV-A1 | HT gọi `POST /api/v1/users/{id}/reset-password`; GV-A1 đăng nhập bằng mật khẩu được cấp; GV-A1 gọi một điểm cuối nghiệp vụ; GV-A1 đổi mật khẩu rồi gọi lại | Mật khẩu cũ không dùng được; phiên bằng mật khẩu được cấp chỉ dùng được điểm cuối đổi mật khẩu; sau khi đổi thì dùng bình thường | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-036 | P01-06 | BR-05 | LT-02 | Cao | NS-A có hợp đồng của GV-A1 | Chấm dứt hợp đồng của GV-A1 | Tài khoản GV-A1 bị khóa ngay; không bị xóa | | Chưa chạy |
| CTC-P01-037 | P01-06 | PQ-05, PCF-05 | LT-05 | Trung bình | Không | Sau CTC-P01-034 mở nhật ký thao tác | Có bản ghi khóa và mở khóa kèm người thực hiện, thời điểm, trạng thái trước và sau | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |

### 4.6. P01-07 Vai trò và quyền

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-038 | P01-07 | PQ-03 | LT-02 | Cao | Tài khoản mới chưa có vai trò | Gán VT-04 không chỉ định đơn vị | Trả `ERR_VALIDATION`; vai trò không được gán | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-039 | P01-07 | PQ-03 | LT-02 | Cao | Tài khoản mới | Gán VT-04 kèm đơn vị PH-A | Gán thành công; phạm vi dữ liệu là PH-A (QĐ-23) | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-040 | P01-07 | PQ-02 | LT-04 | Cao | Tài khoản có VT-04 ở PH-A và VT-06 ở PH-A | Gọi điểm cuối của kế toán và điểm cuối của nhân sự | Cả hai được phép vì quyền là hợp của các vai trò | | Chưa chạy |
| CTC-P01-041 | P01-07 | PQ-01, PQ-05 | LT-05 | Cao | Vai trò VT-04 | HT thêm một quyền vào VT-04 qua `PUT /api/v1/roles/{id}/permissions`; mở nhật ký | Mọi tài khoản VT-04 có quyền mới ở yêu cầu kế tiếp; nhật ký ghi danh sách quyền trước và sau | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-042 | P01-07 | P01-07 | LT-04 | Cao | QL-A | Gọi `POST /api/v1/users/{id}/roles` | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-043 | P01-07 | AC-02, CT-002 | LT-04 | Cao | KT-A | Gọi trực tiếp điểm cuối cập nhật hồ sơ trẻ của PH-A | Trả `ERR_FORBIDDEN` | | Chưa chạy |

### 4.7. P01-08 Cấu hình tham số theo đơn vị

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-044 | P01-08 | P01-08, YCTD-41 | LT-02 | Trung bình | PH-A chưa cấu hình | Đọc cấu hình của PH-A | Ngày chốt học phí là mùng 1 tháng sau; không có mục ngày chốt công vì cố định mùng 1 tháng sau; mốc nhắc nợ 3, 7, 15 ngày | Kiểm thử tự động `apps/api/src/settings/settings.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-045 | P01-08 | AC-06 | LT-02 | Cao | Không | QL-A đặt ngày chốt học phí của PH-A là ngày 25; KT-A đọc cấu hình | KT-A thấy ngày 25 | Kiểm thử tự động `apps/api/src/settings/settings.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-046 | P01-08 | P01-08, PQ-03 | LT-04 | Cao | QL-A | Ghi cấu hình của PH-B | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/settings/settings.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-047 | P01-08 | P01-08 | LT-04 | Trung bình | KT-A | Ghi cấu hình của PH-A | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/settings/settings.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-048 | P01-08 | BR-34 | LT-02 | Cao | Cấu hình của PH-A | Tìm cách tắt kiểm tra số dư quỹ tiền mặt | Không có tham số này; số dư quỹ tiền mặt luôn được kiểm tra | Kiểm thử tự động `apps/api/src/settings/settings.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-049 | P01-08 | BR-34; chạy khi có P06-06 ở giai đoạn 2 | LT-02 | Thấp | Tài khoản ngân hàng của PH-A có số dư 1 000 000 | Tắt kiểm tra số dư tài khoản ngân hàng; lập phiếu chi 2 000 000 từ tài khoản ngân hàng; bật lại và lập lại | Khi tắt thì không bị chặn vì số dư; khi bật thì bị chặn | | Chưa chạy |
| CTC-P01-050 | P01-08 | BR-04, CT-011 | LT-02 | Trung bình | QL-A đặt sĩ số tối đa của PH-A là 20; một lớp đang có 20 trẻ | Phân thêm trẻ thứ 21 vào lớp | Hệ thống cảnh báo và yêu cầu quản lý đơn vị xác nhận | | Chưa chạy |
| CTC-P01-051 | P01-08 | PCF-05 | LT-05 | Trung bình | Không | Sau CTC-P01-045 mở nhật ký thao tác | Có bản ghi đổi ngày chốt kèm giá trị trước và sau | Kiểm thử tự động `apps/api/src/settings/settings.test.ts` đạt ngày 09/10/2026 | Đạt |

### 4.8. P01-09 Nhật ký thao tác và nhật ký truy cập

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-052 | P01-09 | BR-35 | LT-05 | Cao | Một hóa đơn đã phát hành | Lập phiếu điều chỉnh hóa đơn; tra nhật ký theo đối tượng | Có bản ghi người thực hiện, thời điểm, giá trị trước và sau | | Chưa chạy |
| CTC-P01-053 | P01-09 | P01-09, PQ-03 | LT-04 | Cao | QL-A | Gọi `GET /api/v1/audit-logs` không lọc | Chỉ trả nhật ký của PH-A (QĐ-23) | Kiểm thử tự động `apps/api/src/settings/settings.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-054 | P01-09 | P01-09 | LT-04 | Cao | GV-A1 | Gọi `GET /api/v1/audit-logs` | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/settings/settings.test.ts` đạt ngày 09/10/2026 | Đạt |
| CTC-P01-055 | P01-09 | BR-73 | LT-05 | Cao | PH-A bật ghi nhật ký truy cập | KT-A đọc chi tiết tài chính của một trẻ; tra `GET /api/v1/data-access-logs` | Có bản ghi người đọc, thời điểm, đối tượng | | Chưa chạy |
| CTC-P01-056 | P01-09 | BR-73 | LT-05 | Trung bình | PH-A tắt ghi nhật ký truy cập | Lặp lại CTC-P01-055 | Không có bản ghi mới cho lần đọc này | | Chưa chạy |
| CTC-P01-057 | P01-09 | BR-73, BR-81, AC-193 | LT-05 | Cao | PH-A tắt ghi nhật ký truy cập | QL-A xem đầy đủ số định danh cá nhân của một trẻ | Vẫn có bản ghi vì trường hợp này luôn ghi, không tắt được | | Chưa chạy |
| CTC-P01-058 | P01-09 | BM-70 | LT-05 | Thấp | Không | Rà cấu hình lưu trữ nhật ký | Nhật ký thao tác, truy cập, xuất dữ liệu và bảo mật giữ tối thiểu 24 tháng; nhật ký lỗi giữ tối thiểu 6 tháng | | Chưa chạy |

### 4.9. P01-10 Hạn mức phê duyệt

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-059 | P01-10 | P01-10, BR-77 | LT-02 | Cao | Không | HT đặt hạn mức phiếu chi của PH-A là 10 000 000 | Lưu thành công; đọc lại đúng giá trị theo đơn vị và loại chứng từ | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-060 | P01-10 | AC-141, CT-097 | LT-02 | Cao | Hạn mức của CTC-P01-059; phiếu chi 9 999 999 của PH-A do KT-A lập | PHT-A phê duyệt | Phiếu được duyệt | | Chưa chạy |
| CTC-P01-061 | P01-10 | AC-142, CT-098 | LT-02 | Cao | Phiếu chi 10 000 000 của PH-A | PHT-A phê duyệt | Trả `ERR_RULE_VIOLATION`, yêu cầu chuyển Hiệu trưởng; HT phê duyệt được | | Chưa chạy |
| CTC-P01-062 | P01-10 | AC-208, CT-164 | LT-02 | Cao | Loại chứng từ đề nghị mua hàng của PH-A chưa có hạn mức | KT-A trình một đề nghị 1 000 | Chứng từ chuyển cho Hiệu trưởng; PHT-A phê duyệt bị từ chối | | Chưa chạy |
| CTC-P01-063 | P01-10 | AC-143, BR-78, CT-099 | LT-04 | Cao | Một tài khoản có cả VT-04 và VT-15 ở PH-A lập phiếu chi dưới hạn mức | Chính tài khoản đó phê duyệt phiếu | Bị từ chối | | Chưa chạy |
| CTC-P01-064 | P01-10 | AC-144, BR-79, CT-100 | LT-04 | Cao | Phiếu chi của PH-B | PHT-A phê duyệt | Bị từ chối | | Chưa chạy |
| CTC-P01-065 | P01-10 | AC-148, BR-80, CT-104 | LT-05 | Cao | Sau CTC-P01-061 PHT-A đã bị chặn và HT từ chối kèm lý do | Mở nhật ký thao tác của phiếu | Có người từ chối, thời điểm, giá trị chứng từ, lý do | | Chưa chạy |
| CTC-P01-066 | P01-10 | BM-59 | LT-04 | Cao | Hạn mức của CTC-P01-059 | PHT-A gửi yêu cầu phê duyệt phiếu 15 000 000 kèm trường hạn mức giả là 20 000 000 | Máy chủ bỏ qua giá trị gửi lên, dùng hạn mức đã lưu; bị từ chối | | Chưa chạy |
| CTC-P01-067 | P01-10 | P01-10 | LT-04 | Cao | QL-A, KTT | Gọi `PUT /api/v1/approval-thresholds` | Cả hai trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-068 | P01-10 | AC-207, BR-24, CT-163 | LT-02 | Cao | Phiếu chi hoàn tiền thôi học 500 000 của PH-A, dưới hạn mức | PHT-A phê duyệt | Bị từ chối, chuyển Hiệu trưởng | | Chưa chạy |

### 4.10. P01-11 Phòng học và P01-12 Bậc học

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-069 | P01-11 | P01-11 | LT-02 | Trung bình | Không | QL-A tạo phòng "P101" sức chứa 30 thuộc ĐT-A1 | Tạo thành công | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-070 | P01-11 | CT-105 | LT-02 | Cao | Phòng P101 thuộc ĐT-A1; một lớp thuộc ĐT-B1 | Gán phòng P101 cho lớp đó | Bị từ chối | | Chưa chạy |
| CTC-P01-071 | P01-11 | BR-75 | LT-02 | Thấp | Phòng P101 đang gán cho lớp | Ngừng sử dụng phòng | Lớp hiện tại giữ phòng; không gán được cho lớp mới | | Chưa chạy |
| CTC-P01-072 | P01-11 | PQ-03 | LT-04 | Trung bình | QL-A | Tạo phòng thuộc PH-B | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-073 | P01-12 | P01-12 | LT-02 | Trung bình | Không | HT tạo bậc học "Mầm" độ tuổi 48 đến 59 tháng (YCTD-42) | Tạo thành công; chọn được khi tạo lớp và biểu phí | Phần tạo đạt bằng kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` ngày 10/10/2026; phần chọn khi tạo lớp và biểu phí chạy khi có P02, P05 | Chưa chạy |
| CTC-P01-074 | P01-12 | CT-106, BR-75 | LT-02 | Trung bình | Bậc học "Mầm" đang gắn với lớp | Ngừng sử dụng bậc học | Lớp cũ giữ nguyên; lớp mới không chọn được | | Chưa chạy |
| CTC-P01-075 | P01-12 | P01-12 | LT-04 | Trung bình | QL-A | Tạo bậc học | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/catalogs/catalogs.test.ts` đạt ngày 10/10/2026 | Đạt |

### 4.11. P01-13 Nhập dữ liệu ban đầu từ Excel

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-076 | P01-13 | P01-13 | LT-02 | Trung bình | Không | HT tải mẫu Excel loại trẻ qua `GET /api/v1/imports/templates/{type}` | Nhận tệp mẫu đúng các cột của loại trẻ | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-077 | P01-13 | AC-183, CT-139 | LT-02 | Cao | Tệp trẻ 50 dòng theo DL-13, dòng 17 thiếu ngày sinh | Tải tệp lên; gọi ghi dữ liệu | Báo cáo chỉ ra dòng 17 và trường thiếu; lệnh ghi bị từ chối; không có trẻ nào được tạo | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-078 | P01-13 | P01-13 | LT-02 | Cao | Sửa dòng 17 của tệp trên | Tải lại và ghi | 50 trẻ được tạo; có nhật ký lần nhập | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-079 | P01-13 | AC-184, CT-140 | LT-05 | Cao | Tệp công nợ đầu kỳ hợp lệ của 10 trẻ đã có | KT-A tải lên và ghi | Mỗi trẻ có khoản phải thu đầu kỳ đúng số tiền; nhật ký ghi người nhập và thời điểm | | Chưa chạy |
| CTC-P01-080 | P01-13 | AC-185, CT-141 | LT-04 | Cao | GV-A1 | Gọi `POST /api/v1/imports` | Trả `ERR_FORBIDDEN` | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-081 | P01-13 | BM-63, ghi chú 13 của tài liệu 08 | LT-04 | Cao | KT-A | Tải lên tệp loại trẻ | Trả `ERR_FORBIDDEN` vì kế toán chỉ nhập công nợ đầu kỳ | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-082 | P01-13 | BM-63, ghi chú 13 của tài liệu 08 | LT-04 | Cao | NS-A | Tải lên tệp nhân sự; tải lên tệp công nợ đầu kỳ | Tệp nhân sự được nhận; tệp công nợ bị từ chối | | Chưa chạy |
| CTC-P01-083 | P01-13 | BM-63, BM-27, KT-06 | LT-02 | Trung bình | Không | Tải lên tệp đổi đuôi thành xlsx nhưng nội dung không phải Excel; tải lên tệp vượt dung lượng | Cả hai bị từ chối, không tạo lần nhập | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 10/10/2026 | Đạt |
| CTC-P01-084 | P01-13 | BR-07, KT-04 | LT-02 | Cao | Tệp trẻ có hai dòng trùng số định danh cá nhân, hoặc trùng với trẻ đã có | Tải lên | Báo dòng trùng; không ghi | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 10/10/2026 | Đạt |

### 4.12. P01-14 Khóa API cho đối tác

| Mã | Chức năng | Căn cứ | Lớp | Ưu tiên | Điều kiện trước | Các bước | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| CTC-P01-085 | P01-14 | BM-65 | LT-02 | Cao | Không | HT cấp khóa cho cơ quan quản lý giáo dục, phạm vi báo cáo tổng hợp, địa chỉ mạng cho phép, ngày hết hạn | Khóa hiển thị một lần khi cấp; mở lại danh sách không thấy khóa; bảng `api_clients` chỉ lưu giá trị băm | | Chưa chạy |
| CTC-P01-086 | P01-14 | AC-195, CT-151 | LT-04 | Cao | Khóa phạm vi báo cáo tổng hợp | Gọi `GET /api/v1/partner/children` | Bị từ chối | | Chưa chạy |
| CTC-P01-087 | P01-14 | AC-196, BM-66, CT-152 | LT-05 | Cao | Khóa phạm vi danh sách trẻ, có căn cứ pháp lý | Gọi `GET /api/v1/partner/children` lấy 30 trẻ | Có bản ghi nhật ký truy cập kèm khóa, phạm vi, căn cứ pháp lý và số bản ghi 30 | | Chưa chạy |
| CTC-P01-088 | P01-14 | BM-66 | LT-02 | Cao | Không | Cấp khóa phạm vi danh sách trẻ mà không nhập căn cứ pháp lý | Trả `ERR_VALIDATION`; không cấp khóa | | Chưa chạy |
| CTC-P01-089 | P01-14 | AC-211, BM-65, CT-167 | LT-04 | Cao | Khóa đang dùng được | HT thu hồi khóa; đối tác gọi ngay bằng khóa đó | Bị từ chối ngay | | Chưa chạy |
| CTC-P01-090 | P01-14 | BM-65 | LT-04 | Cao | Khóa có ngày hết hạn là hôm qua | Đối tác gọi bằng khóa | Bị từ chối | | Chưa chạy |
| CTC-P01-091 | P01-14 | BM-65 | LT-04 | Cao | Khóa chỉ cho phép một địa chỉ mạng | Gọi từ địa chỉ mạng khác | Bị từ chối | | Chưa chạy |
| CTC-P01-092 | P01-14 | BM-65 | LT-02 | Trung bình | Khóa có giới hạn tần suất | Gọi vượt giới hạn | Trả `ERR_RATE_LIMIT` | | Chưa chạy |
| CTC-P01-093 | P01-14 | QĐ-16 | LT-04 | Cao | Khóa phạm vi danh sách trẻ | Dùng khóa gọi `POST /api/v1/children` và `PATCH` một hồ sơ trẻ | Cả hai bị từ chối vì khóa chỉ đọc | | Chưa chạy |
| CTC-P01-094 | P01-14 | P01-14 | LT-04 | Cao | QL-A | Gọi `POST /api/v1/api-clients` | Trả `ERR_FORBIDDEN` | | Chưa chạy |
| CTC-P01-095 | P01-14 | QĐ-17 | LT-05 | Trung bình | Đã mở năm học mới theo CTC-P01-014 | Đối tác gọi lại bằng khóa cũ | Khóa vẫn dùng được vì khóa nằm ở cơ sở dữ liệu định danh, không phụ thuộc năm học | | Chưa chạy |

## 5. Bảng truy xuất

| Tiêu chí nghiệm thu | Ca chi tiết |
|---|---|
| AC-01 | CTC-P01-011 |
| AC-02 | CTC-P01-043 |
| AC-04 | CTC-DD-041 |
| AC-05 | CTC-DD-035 |
| AC-06 | CTC-P01-045 |
| AC-89, AC-203 | CTC-DD-010, CTC-DD-011, CTC-DD-012, CTC-DD-042 |
| AC-135 đến AC-140 | CTC-P01-001 đến CTC-P01-005, CTC-P01-009, CTC-P01-010 |
| AC-141 đến AC-144, AC-148 | CTC-P01-060, CTC-P01-061, CTC-P01-063 đến CTC-P01-065 |
| AC-146, AC-147 | CTC-DD-037, CTC-DD-039 |
| AC-180, AC-181 | CTC-DD-017 đến CTC-DD-019 |
| AC-183 đến AC-185 | CTC-P01-077, CTC-P01-079, CTC-P01-080 |
| AC-193 | CTC-P01-057 |
| AC-194 | CTC-P01-014, CTC-P01-015, CTC-P01-098 |
| AC-220 | CTC-P01-035 |
| AC-221 | CTC-P01-096 |
| AC-228, AC-229 | CTC-P01-099, CTC-P01-100, CTC-P01-102 |
| AC-195, AC-196, AC-211 | CTC-P01-086, CTC-P01-087, CTC-P01-089 |
| AC-207, AC-208 | CTC-P01-068, CTC-P01-062 |
| AC-209 | CTC-DD-007 |

Tổng số ca: 43 ca dịch vụ định danh, trong đó CTC-DD-025 đến CTC-DD-030 không áp dụng vì YCTD-31; 104 ca P01.

## 6. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| Q-147 | Đã trả lời ngày 09/10/2026: phụ huynh chưa đổi mật khẩu mặc định vẫn đăng nhập bằng mã một lần và dùng bình thường; đăng nhập bằng mật khẩu mặc định vẫn chỉ vào màn hình đổi mật khẩu (CTC-DD-042) | Eric |
| Q-148 | Đã trả lời ngày 09/10/2026: người được đặt lại mật khẩu bắt buộc đổi ở lần đăng nhập kế tiếp (AC-220, CTC-P01-035) | Eric |
| Q-149 | Đã trả lời ngày 09/10/2026: công nợ của trẻ đã thôi học không chuyển sang năm mới; phải thu hết hoặc xử lý bằng miễn giảm, điều chỉnh hóa đơn trước khi đóng năm, hệ thống chặn đóng năm khi còn nợ loại này (BR-89, AC-221) | Eric |
