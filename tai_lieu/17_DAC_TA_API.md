# 17. ĐẶC TẢ API

- Mô tả: Điểm cuối, phương thức, yêu cầu, phản hồi, xác thực, phân quyền, kiểm tra dữ liệu, xử lý lỗi, phân trang, lọc, sắp xếp, phiên bản.
- Phiên bản: 1.31
- Ngày cập nhật: 2026-10-10
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Quy ước chung

1. Đường dẫn có tiền tố phiên bản, ví dụ `/api/v1/`.
2. Định dạng dữ liệu trao đổi là JSON; tệp tải lên dùng biểu mẫu nhiều phần.
3. Tên trường dùng dạng chữ thường nối bằng gạch dưới.
4. Mọi yêu cầu phải kèm mã phiên hợp lệ, trừ các điểm cuối đăng nhập, kích hoạt tài khoản và kiểm tra sức khỏe.
5. Mọi điểm cuối kiểm tra quyền ở máy chủ theo ba lớp: vai trò, đơn vị, bản ghi.
6. Mọi yêu cầu thay đổi dữ liệu phải kèm mã chống gửi trùng do giao diện sinh; máy chủ bỏ qua yêu cầu trùng và trả lại kết quả của lần đầu.
7. Mọi điểm cuối thay đổi dữ liệu đều ghi nhật ký thao tác.
8. Giao diện lập trình ứng dụng này do hai dịch vụ máy chủ phục vụ (cổng vào chuyển `/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`, `/api/v1/permissions` sang dịch vụ định danh, phần còn lại sang máy chủ API): nhóm điểm cuối xác thực, quản lý tài khoản và quản lý khóa API của đối tác do **dịch vụ định danh** phục vụ (QĐ-17); các nhóm còn lại do **máy chủ API nghiệp vụ** phục vụ. Hai dịch vụ dùng chung một tiền tố phiên bản và một mô hình lỗi.
9. Tầng giao diện không truy cập cơ sở dữ liệu; mọi thao tác dữ liệu đều đi qua giao diện lập trình ứng dụng này.

## 2. Mô hình lỗi

| Mã lỗi | Mã trạng thái | Ý nghĩa | Trường kèm theo |
|---|---|---|---|
| ERR_VALIDATION | 400 | Dữ liệu không hợp lệ | Danh sách trường lỗi và thông điệp |
| ERR_UNAUTHENTICATED | 401 | Chưa đăng nhập hoặc phiên hết hạn | Không |
| ERR_FORBIDDEN | 403 | Không có quyền | Mã quyền còn thiếu |
| ERR_NOT_FOUND | 404 | Không tìm thấy bản ghi trong phạm vi | Tên thực thể |
| ERR_CONFLICT | 409 | Trùng dữ liệu | Trường bị trùng, mã bản ghi đã tồn tại |
| ERR_RULE_VIOLATION | 422 | Vi phạm quy tắc nghiệp vụ | Mã quy tắc nghiệp vụ bị vi phạm |
| ERR_RATE_LIMIT | 429 | Vượt giới hạn tần suất | Thời gian chờ |
| ERR_INTERNAL | 500 | Lỗi hệ thống | Mã tương quan |

Cấu trúc phản hồi lỗi gồm mã lỗi, thông điệp tiếng Việt hiển thị được cho người dùng, danh sách chi tiết theo trường, và mã tương quan để tra nhật ký.

Điểm cuối kiểm tra sức khỏe có ở cả hai dịch vụ, dùng để theo dõi vận hành, không trả dữ liệu nghiệp vụ (đợt DT-00):

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/health | Trả `status` là `ok` và `service` là `api` hoặc `identity` |

## 3. Phân trang, lọc, sắp xếp

| Tham số | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| page | số nguyên | 1 | Bắt đầu từ một |
| page_size | số nguyên | 20 | Tối đa 100 |
| sort | chuỗi | tùy điểm cuối | Dạng tên trường kèm dấu trừ để giảm dần |
| q | chuỗi | trống | Tìm kiếm theo từ khóa trên các trường được khai báo |
| org_unit_id | mã định danh | theo phiên | Chỉ nhận giá trị trong phạm vi quyền |
| from_date, to_date | ngày | tùy điểm cuối | Lọc theo khoảng ngày |

Phản hồi danh sách gồm `items`, `page`, `page_size`, `total`, `total_pages`.

## 4. Xác thực và phiên

Nhóm điểm cuối dưới đây do dịch vụ định danh phục vụ.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | /api/v1/auth/login | Đăng nhập bằng số điện thoại hoặc tên đăng nhập kèm mật khẩu |
| POST | /api/v1/auth/otp/request | Phụ huynh yêu cầu mã một lần gửi qua tin nhắn tới số điện thoại đã đăng ký |
| POST | /api/v1/auth/otp/login | Đăng nhập bằng số điện thoại và mã một lần |
| POST | /api/v1/auth/refresh | Làm mới mã phiên bằng mã làm mới |
| POST | /api/v1/auth/logout | Thu hồi phiên hiện tại |
| POST | /api/v1/auth/activate | Bỏ ngày 10/10/2026: kích hoạt là đăng nhập bằng mật khẩu mặc định rồi gọi `change-password` (YCTD-43) |
| POST | /api/v1/auth/change-password | Đổi mật khẩu |
| POST | /api/v1/auth/verify-otp | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31) |
| GET | /api/v1/auth/me | Lấy thông tin tài khoản, vai trò, đơn vị, danh sách quyền |

Giao kèo của nhóm điểm cuối xác thực (DT-01 phần 1):

1. `login` nhận `login` (số điện thoại hoặc tên đăng nhập), `password`, `channel` (`portal`, `teacher`, `parent`); trả `access_token`, `token_type`, `expires_in` (giây), `password_change_required`; mã làm mới đặt trong cookie httpOnly riêng của kênh: `refresh_token` (cổng quản trị), `refresh_token_teacher`, `refresh_token_parent` (BM-71, YCTD-36, YCTD-43).
2. `refresh` nhận `channel` (mặc định `portal`), đọc mã làm mới từ cookie của kênh đó; phiên khác kênh bị từ chối; trả mã phiên mới và đặt mã làm mới mới vào cookie, mã làm mới cũ hết dùng được. Dùng lại mã làm mới cũ thì phiên bị thu hồi. Hạn của phiên tính từ lúc đăng nhập.
3. `logout` thu hồi phiên và xóa cookie của kênh. `change-password` nhận `current_password`, `new_password`; trả mã phiên mới không còn giới hạn đổi mật khẩu; các phiên khác của tài khoản bị thu hồi.
4. Khi `password_change_required` là đúng, mã phiên chỉ dùng được cho `change-password`, `me`, `logout`; điểm cuối khác trả `ERR_FORBIDDEN`.
5. `me` trả `id`, `full_name`, `phone`, `username`, `must_change_password` và `assignments`, mỗi phần tử gồm `role_code`, `role_name`, `org_unit_id` (trống là toàn trường), `permissions`. Mỗi lần gọi đều kiểm tra lại phiên và trạng thái tài khoản (QĐ-20).
6. Vượt giới hạn tần suất trả `ERR_RATE_LIMIT` kèm `retry_after_seconds` và tiêu đề `retry-after`.
7. Máy chủ API nghiệp vụ kiểm tra mã phiên ở mọi điểm cuối trừ `GET /api/v1/health`; mã phiên còn bắt buộc đổi mật khẩu trả `ERR_FORBIDDEN`; không liên lạc được với dịch vụ định danh trả `ERR_INTERNAL`.
8. Tài khoản phụ huynh còn dùng mật khẩu mặc định thì `login` so với mật khẩu mặc định chung và trả `password_change_required` đúng; `change-password` nhận mật khẩu mặc định làm mật khẩu hiện tại, mật khẩu mới phải khác (YCTD-43).
9. `otp/request` nhận `phone`; trả `message`, `expires_in_seconds` như nhau dù số điện thoại có hay không; chỉ gửi mã khi số thuộc tài khoản có duy nhất vai trò VT-14 đang hoạt động; quá số lần gửi trong giờ trả `ERR_RATE_LIMIT` cho mọi số. `otp/login` nhận `phone`, `code`; đúng thì cấp phiên kênh phụ huynh không bị giới hạn đổi mật khẩu (Q-147); sai thì trả `ERR_UNAUTHENTICATED`, nhập sai đủ số lần thì mã hết hiệu lực.
10. `GET`, `PUT /auth/settings` có thêm `one_time_code_lifetime_minutes`, `one_time_code_maximum_attempts`, `one_time_code_maximum_sends_per_hour`; `PUT` nhận `parent_default_password`, `GET` chỉ trả `parent_default_password_configured`. `POST /users` với tài khoản chỉ có vai trò VT-14 trả `temporary_password` trống và `uses_default_password` đúng.

## 5. Nền tảng và phân quyền

Các điểm cuối tài khoản, vai trò, quyền và khóa API dưới đây do dịch vụ định danh phục vụ. Các điểm cuối còn lại, gồm đơn vị, năm học, cấu hình và nhóm `/partner/`, do máy chủ API nghiệp vụ phục vụ; khóa API gửi kèm yêu cầu của đối tác được máy chủ API kiểm tra với dịch vụ định danh.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/org-units | Danh sách và tạo đơn vị; lọc được theo cấp và theo đơn vị cha |
| GET | /api/v1/org-units/tree | Cây đơn vị hai cấp (QĐ-23) |
| PATCH | /api/v1/org-units/{id} | Cập nhật tên, mã, loại cấp 2, địa chỉ, điện thoại, người phụ trách, trạng thái; không đổi được đơn vị cha vì cây chỉ có hai cấp (YCTD-38) |
| GET, POST | /api/v1/academic-years | Danh sách và tạo năm học kèm lịch năm học |
| GET, PUT | /api/v1/academic-years/{id}/calendar | Đọc và lưu học kỳ, kỳ hè, ngày học trong tuần; hệ thống tự đánh số tuần (BR-91) |
| GET, PATCH | /api/v1/academic-years/{id}/weeks | Danh sách tuần; đánh dấu hoặc bỏ đánh dấu tuần nghỉ |
| POST | /api/v1/academic-years/{id}/open | Mở năm học: kiểm tra BR-89, tạo cơ sở dữ liệu năm học, chuyển dữ liệu dùng chung, chuyển năm đang dùng sang đã đóng và chỉ đọc (BR-93) |
| POST | /api/v1/academic-years/{id}/close | Bỏ ngày 09/10/2026: gộp vào mở năm học mới (YCTD-37) |

Giao kèo của phiếu đảo phiếu chi (DT-05 phần 5e-2, YCTD-56):

1. `POST /payments/{id}/reverse` nhận `reason` (bắt buộc, tối đa 500 ký tự); cần `P06.payment-reversal.create`; phiếu không ở trạng thái đã phát hành trả `ERR_RULE_VIOLATION` mã BR-29. Kết quả có `code` (DPC-), `payment_code`, `amount`, `status`, `requires_principal`.
2. `POST /payments/{id}/reverse/approve` và `/reverse/reject` (nhận `reason` bắt buộc) cần `P06.payment.approve`; phiếu đảo có `requires_principal` mà người duyệt không phải Hiệu trưởng trả `ERR_FORBIDDEN`.
3. `GET /payments/{id}` có `reversals`; sổ quỹ ghi giao dịch hoàn lại với `document_code` là số phiếu đảo.

Giao kèo của phiếu chi và sổ quỹ (DT-05 phần 5e-1, YCTD-55):

1. `POST /payments` nhận `request_key`, `org_unit_id`, `payment_type` (`regular`, `refund`, `payroll`), `child_id` (bắt buộc khi `refund`), `payee_name`, `amount`, `content` (tối đa 500 ký tự), `account_id`, `category_id` (khoản mục chi), `file_ids` (tệp mục đích `payment_voucher` của đơn vị); cần `P06.payment.manage`. Gửi lại cùng `request_key` trả phiếu đã lập.
2. `POST /payments/{id}/submit` không có chứng từ trả `ERR_RULE_VIOLATION` mã BR-28; hoàn tiền vượt số dư có của trẻ trả mã BR-24.
3. `POST /payments/{id}/approve` cần `P06.payment.approve`; phiếu `requires_principal` mà người duyệt không phải Hiệu trưởng hoặc người duyệt là người lập trả `ERR_FORBIDDEN`; nguồn chi không đủ trả mã BR-34; phiếu đã duyệt trả mã BR-77 kèm `approved_by`. Duyệt thành công trả phiếu có `code`, `payment_date`, `approved_by`. `/reject` nhận `reason` bắt buộc, phiếu về `draft` kèm `reject_reason`.
4. `GET /cash-books?account_id=&from=&to=` trả `opening_balance`, `total_in`, `total_out`, `closing_balance`, `transactions` (mỗi dòng có `document_code`, `amount` dương là thu, âm là chi, `balance_after`).

Giao kèo của phiếu đảo phiếu thu và công nợ đầu kỳ (DT-05 phần 5d-2, YCTD-54):

1. `POST /receipts/{id}/reverse` nhận `reason` (bắt buộc, tối đa 500 ký tự); cần `P06.receipt-reversal.create` ở đơn vị của phiếu. Phiếu không ở trạng thái đã phát hành trả `ERR_RULE_VIOLATION` mã BR-29. Kết quả có `code` (DPT-), `receipt_code`, `amount`, `status`, `requires_principal`.
2. `POST /receipts/{id}/reverse/approve` và `/reverse/reject` (nhận `reason` bắt buộc) cần `P06.receipt-reversal.approve`; phiếu đảo có `requires_principal` mà người duyệt không phải Hiệu trưởng trả `ERR_FORBIDDEN`; quỹ tiền mặt không đủ trả mã BR-34.
3. `GET /receipts/{id}` có `reversals` gồm số, lý do, trạng thái của phiếu đảo.
4. `POST /imports` với `type=opening_debts` cần `P05.opening-debt.import`; mẫu tệp ở `GET /imports/templates/opening_debts`; ghi bằng `POST /imports/{id}/commit`.

Giao kèo của phiếu thu, quỹ và công nợ (DT-05 phần 5d-1, YCTD-53):

1. `POST /receipts` nhận `request_key` (mã yêu cầu do màn hình sinh), `child_id`, `payer_name`, `amount` (số nguyên đồng lớn hơn 0), `method` (`cash`, `transfer`, `other`), `account_id`, `category_id` (khoản mục thu đang dùng), `receipt_date` (không sau hôm nay), `content`, `allocations` (danh sách `invoice_id`, `amount`); cần `P06.receipt.manage` ở đơn vị của trẻ. Gửi lại cùng `request_key` trả phiếu đã lập. Phân bổ khác số còn phải nộp, vượt số thu, hóa đơn của trẻ khác hoặc chưa phát hành trả `ERR_RULE_VIOLATION` mã BR-31. Thủ quỹ lập phiếu không phải tiền mặt trả `ERR_FORBIDDEN`.
2. Kết quả và `GET /receipts/{id}` có `code`, `amount`, `allocated_amount`, `allocations`, `account_name`, `category_name`, `status`. `GET /receipts` lọc `org_unit_id`, `child_id`, `from`, `to`; cần `P06.view` hoặc `P06.receipt.manage`.
3. `POST /children/{id}/credit-allocations` nhận `allocations`; tổng không vượt số dư có của trẻ.
4. `GET /debts?org_unit_id=&class_id=&overdue_only=true` và `GET /children/{id}/debt` trả `payable_amount`, `paid_amount`, `outstanding_amount`, `credit_amount`, `balance_amount`, `overdue_amount`, `overdue_days`; chi tiết có `invoices` với `payment_status` (`unpaid`, `paid`, `overdue`). Cần `P05.debt.view` hoặc `P06.receipt.manage`; phụ huynh chỉ xem được con mình.
5. `GET /invoices`, `GET /invoices/{id}` thêm `paid_amount`, `outstanding_amount`.

Giao kèo của miễn giảm và phiếu điều chỉnh (DT-05 phần 5c-2, YCTD-52):

1. `POST /invoices/{id}/discounts` nhận `discount_type_id` (loại đang dùng, nếu không trả `ERR_VALIDATION`), `basis` (bắt buộc, tối đa 500 ký tự); cần `P05.discount.manage`. Kết quả có `calculation_method`, `rate_value`, `base_amount`, `applied_amount`, `status`, `requires_principal`. Vượt khoản áp dụng hoặc tổng hóa đơn trả `ERR_RULE_VIOLATION` mã BR-22.
2. `POST /invoice-adjustments` nhận `invoice_id` (hóa đơn đã phát hành, nếu không trả mã BR-25), `amount` (số nguyên khác 0, âm là giảm), `reason`; cần `P05.invoice-adjustment.create`.
3. `POST /discounts/{id}/approve`, `POST /invoice-adjustments/{id}/approve` cần `P05.fee-document.approve` ở đơn vị; chứng từ có `requires_principal` mà người duyệt không phải Hiệu trưởng trả `ERR_FORBIDDEN`. `.../reject` nhận `reason` bắt buộc.
4. `GET /invoices`, `GET /invoices/{id}` có `discount_amount`, `adjustment_amount`, `payable_amount`; chi tiết có `discounts`, `adjustments` (phụ huynh chỉ thấy khoản đã duyệt).

Giao kèo của tính học phí và hóa đơn (DT-05 phần 5c-1, YCTD-51):

1. `POST /fee-calculations` nhận `org_unit_id`, `period`; cần `P05.fee-calculation.manage`. Kỳ chưa chốt đăng ký trả `ERR_RULE_VIOLATION` mã BR-26; đã phát hành trả mã BR-25; thiếu biểu phí trả mã BR-17 kèm `details` là bậc học hoặc dịch vụ thiếu; còn ngày chưa chốt điểm danh trả mã Q-151 kèm `details` (`field` là tên lớp, `message` là ngày). Kết quả là lần chạy (`status`, `child_count`, `total_amount`).
2. `GET /invoices` lọc theo `org_unit_id`, `period`, `child_id`, `status`; mỗi dòng có `code`, `child_name`, `invoice_kind`, `status`, `total_amount`, `due_date`, `review_flags` (`absent_many`, `large_change`, `no_registration`), `basis`. `GET /invoices/{id}` thêm `items`.
3. `POST /invoices/issue` nhận `org_unit_id`, `period`, `due_date` (không nhỏ hơn hôm nay, nếu không trả `ERR_VALIDATION`); phát hành mọi hóa đơn nháp của kỳ. `POST /invoices/supplementary` nhận `child_id`, `period`, `due_date`; hóa đơn chính chưa phát hành hoặc không còn khoản chưa lập trả mã BR-85.
4. `POST /service-registrations` của phụ huynh trả mã BR-33 khi đơn vị bật `block_service_registration_when_overdue` và trẻ có hóa đơn quá hạn.

Giao kèo của đăng ký dịch vụ (DT-05 phần 5b, YCTD-50):

1. Kỳ có dạng `YYYY-MM`, thuộc năm học đang mở. Kết quả bảng và đăng ký của trẻ có `period`, `is_summer`, `closing_date`, `is_locked`, `is_late` (đã qua ngày chốt hoặc kỳ đã chốt), `services` và `registrations` (`id`, `service_id`, `status`, `source`, `is_late`, `service_start_date`, `late_charge_method`).
2. `POST /service-registrations` nhận `child_id`, `period`, `service_id`, `service_start_date` (bắt buộc khi trễ, thuộc kỳ). Dịch vụ bắt buộc trả `ERR_RULE_VIOLATION` mã BR-83; đã đăng ký trả `ERR_CONFLICT`; tháng hè mà trẻ chưa đăng ký học hè trả `ERR_RULE_VIOLATION` mã BR-92. Trễ thì `status` là `pending_late`.
3. `POST .../cancel` với dịch vụ bắt buộc trả mã BR-83; trễ thì `status` là `pending_cancel`. `POST .../approve-late` nhận `charge_method` (`full_month`, `actual_days`, bắt buộc khi duyệt đăng ký trễ); `POST .../reject-late` nhận `reason` bắt buộc. Cần `P05.late-registration.approve` ở đơn vị của dòng đăng ký.
4. `POST /service-registrations/lock` nhận `org_unit_id`, `period`; cần `P05.registration.manage`; kỳ đã chốt trả mã BR-26; báo cho VT-03 của đơn vị.
5. `POST /summer-registrations` nhận `child_id`, `period` (phải là tháng hè, nếu không trả `ERR_VALIDATION`); `GET` lọc theo `child_id` hoặc `org_unit_id`, `period`; `DELETE` sau ngày chốt trả mã BR-26.

Giao kèo của danh mục học phí và tài chính (DT-05 phần 5a, YCTD-49):

1. `POST /services` nhận `code`, `name`, `unit`, `calculation_method` (`monthly`, `per_present_day`), `is_mandatory`; mã không đổi. Bán trú có mã `BAN_TRU`, `is_system` là đúng; ngừng sử dụng hoặc đổi cách tính trả `ERR_RULE_VIOLATION` mã BR-83.
2. `POST /fee-schedules` nhận `name`, `effective_from` (dạng `YYYY-MM-01`, sau phiên bản mới nhất, nếu không trả `ERR_RULE_VIOLATION` mã BR-18), `items` (`grade_level`, `fee_type` là `tuition` hoặc `service`, `service_id` khi là dịch vụ, `amount` số nguyên đồng không âm). Kết quả có `effective_to`, `is_editable`, `items` kèm `service_name`. `PUT` nhận `name`, `items` và thay toàn bộ dòng giá; `PUT`, `DELETE` với phiên bản đã tới ngày hiệu lực trả `ERR_RULE_VIOLATION` mã BR-18; chỉ xóa được phiên bản mới nhất.
3. `POST /discount-types` nhận `code`, `name`, `calculation_method` (`percent` từ 1 đến 100, `amount` số tiền đồng), `value`, `applies_to` (`tuition` và mã dịch vụ), `condition_note`; mã và cách tính không đổi.
4. `POST /cashflow-categories` nhận `code`, `name`, `group_name`, `flow_type` (`income`, `expense`); `GET` lọc được theo `status`, `flow_type`; mã và loại không đổi.

Giao kèo của đón trả (DT-04 phần 4b, YCTD-48):

1. `POST /children/{id}/authorized-pickups` nhận `full_name`, `relationship`, `phone` (bắt buộc, 10 chữ số), `valid_from` (mặc định hôm nay), `valid_to` (trống là không thời hạn); người gọi là phụ huynh của trẻ hoặc có `P02.authorized-pickup.manage` ở đơn vị của trẻ. `GET` trả các ủy quyền đang hiệu lực kèm `is_valid_today`, cho người xem được trẻ và bảo vệ trong đơn vị của trẻ. `DELETE /authorized-pickups/{id}` chuyển sang đã hủy.
2. `POST /children/{id}/pickups` nhận `pickup_type` (`handover` mặc định, `gate_check`), một trong `guardian_id`, `authorized_pickup_id`, `person` (`full_name`, `relationship`, `phone` tùy chọn); với bàn giao thêm `date` (mặc định hôm nay), `picked_up_at`, `photo_file_id`. Bàn giao chỉ giáo viên chủ nhiệm, trẻ có mặt, thời điểm không trước thời điểm điểm danh, mỗi ngày một lần.
3. Người đón ngoài danh sách khi bàn giao trả `ERR_RULE_VIOLATION` mã BR-56, chi tiết `confirmation_request_id`; lần đầu tạo yêu cầu và gửi thông báo cho phụ huynh; phụ huynh xác nhận thì gửi lại được, lượt bàn giao có `person_kind` là `parent_confirmed`. Với `gate_check` người ngoài danh sách chỉ bị từ chối, không tạo yêu cầu.
4. `GET /pickup-directory?org_unit_id=&search=` cần `P04.pickup.gate-confirm` ở đơn vị; `search` tối thiểu 2 ký tự, tối đa 20 trẻ; chỉ trả họ tên trẻ, lớp, người được đón và lượt xác nhận tại cổng hôm nay.
5. `POST /files` với `purpose` là `pickup_photo` nhận ảnh JPEG hoặc PNG của giáo viên chủ nhiệm có lớp ở đơn vị.

Giao kèo của điểm danh (DT-04 phần 4a, YCTD-47):

1. `GET /classes/{id}/attendance?date=` trả `day_status` (`open`, `locked`), `can_edit`, `children` (trạng thái đã lưu hoặc trống là chưa đánh dấu; trẻ đã báo vắng hiện sẵn nghỉ có báo), `summary` gồm số suất ăn. Ngày không phải ngày học trả `ERR_RULE_VIOLATION` mã BR-91.
2. `PUT /classes/{id}/attendance` nhận `date`, `entries` (`child_id`, `status`, `note`), `reason` (bắt buộc khi ngày đã chốt), `offline_recorded_at` (khi gửi bù). Chống trùng theo trẻ và ngày; trẻ không còn trong lớp trả trong `skipped_child_ids`. Người ghi là giáo viên chủ nhiệm đang được phân công hoặc người có `P04.attendance.manage`.
3. `POST .../lock` nhận `date`; còn trẻ chưa đánh dấu trả `ERR_RULE_VIOLATION` mã BR-12. `POST .../unlock` nhận `date`, `reason`.
4. `POST /absences` nhận `child_id`, `from_date`, `to_date` (tối đa 31 ngày), `reason`; chỉ ghi các ngày học; trả các bản ghi kèm `is_advised`. Phụ huynh chỉ báo cho con mình; giáo viên chủ nhiệm và quản lý đơn vị ghi thay.
5. `GET /children/{id}/attendance?month=YYYY-MM` trả `records` và `absences` của trẻ trong tháng, theo phạm vi xem trẻ.

Giao kèo của nhập dữ liệu (DT-03 phần 3c, YCTD-46):

1. `GET /imports/templates/{type}` trả tệp Excel mẫu, `type` là `classes`, `children` hoặc `moet_codes`; trang thứ hai hướng dẫn cách ghi từng cột.
2. `POST /imports` là biểu mẫu nhiều phần gồm `file` và `type` (`classes`, `children`); cần `P01.import.children`. Hệ thống kiểm tra toàn bộ tệp, trả lần nhập gồm `status` (`validated`, `failed`), `total_rows`, `error_rows`, `errors` (dòng, cột, nội dung). Tệp không phải Excel hoặc vượt 5 MB trả `ERR_VALIDATION`.
3. `POST /imports/{id}/commit` kiểm tra lại toàn bộ rồi ghi trong một giao dịch; lần nhập còn lỗi hoặc đã ghi trả `ERR_RULE_VIOLATION` mã P01-13. Trẻ nhập ở trạng thái đang học, có lịch sử lớp, phụ huynh có số điện thoại được tạo tài khoản.
4. `POST /imports/moet-codes` là biểu mẫu nhiều phần gồm `file`; cần `P02.child.manage`; gán mã cho các dòng khớp số định danh trong phạm vi, trả `assigned_rows` và `errors` cho dòng không khớp hoặc trùng mã.
5. `GET /children` có thêm bộ lọc `missing_birth_certificate=true`; quản lý đơn vị bổ sung giấy khai sinh cho trẻ đang học bằng `PATCH /children/{id}` với `birth_certificate_file_id`, không cần lý do khi trước đó còn trống.

Giao kèo của hồ sơ trẻ (DT-03 phần 3b, YCTD-45):

1. `GET /children` lọc `org_unit_id`, `class_id`, `status`, `q`, phân trang; chỉ trả trẻ trong phạm vi xem của PQ-18; số định danh trả dạng che `national_id_masked`. `GET /children/{id}` trả thêm phụ huynh, lịch sử lớp, lớp hiện tại; `health` chỉ trả cho vai trò ở BR-53.
2. `POST /children` cần `P02.child.manage`; nhận thông tin định danh, `national_id` mười hai chữ số, `birth_certificate_file_id`, `photo_consent` (`granted` kèm `photo_consent_file_id`, `refused`, `pending`), `health`, `guardians` (ít nhất một, đúng một liên hệ chính, quan hệ từ danh mục `parent_relationship`), cờ trẻ con nhân viên kèm `related_staff_user_id` và `related_staff_role_code`. Số định danh hoặc mã ngành trùng trả `ERR_CONFLICT` kèm mã hồ sơ trùng; trùng họ tên và ngày sinh trong đơn vị trả `ERR_RULE_VIOLATION` với `possible_duplicates`, gửi lại kèm `confirm_possible_duplicate` thì lưu.
3. `PATCH /children/{id}`: hồ sơ nháp cần `P02.child.manage`; hồ sơ chờ duyệt không sửa được; trẻ đang học cần `P02.approve`, sửa thông tin định danh phải kèm `reason`.
4. `submit` cần hồ sơ đã khai báo dị ứng và có liên hệ có số điện thoại, không đủ trả `ERR_RULE_VIOLATION` mã BR-06. `approve` nhận `class_id`, `confirm_over_capacity`; lớp đủ sĩ số trả `ERR_RULE_VIOLATION` mã BR-04; duyệt xong đơn vị của trẻ là đơn vị của lớp, máy chủ API gọi `POST /users/guardian-accounts` cho mọi phụ huynh có số điện thoại. `reject` nhận `reason`. `transfer-class` nhận `class_id`, `reason`, `from_date`, `confirm_over_capacity`; lớp đích khác đơn vị trả `ERR_RULE_VIOLATION` mã LP-02.
5. `GET /children/{id}/national-id` cần `P02.national-id.view` trong phạm vi đơn vị và luôn ghi `data_access_logs`.
6. `POST /files` là biểu mẫu nhiều phần gồm `file`, `org_unit_id`, `purpose` (`birth_certificate`, `photo_consent`); cần `P02.child.manage` ở đơn vị.
7. Các thông báo trong ứng dụng và tin nhắn báo tài khoản phụ huynh đã tạo được ghi vào `notifications`, `notification_recipients` ở trạng thái chờ gửi.

Giao kèo của lớp học (DT-03 phần 3a, YCTD-44):

1. `GET /classes` lọc theo `org_unit_id`, `status`, `grade_level`; `mine=true` trả các lớp người gọi đang được phân công. Mỗi lớp kèm `staff` là các phân công còn hiệu lực. Ai có vai trò ở đơn vị đều đọc được.
2. `POST /classes` nhận `org_unit_id`, `code`, `name`, `grade_level`, `room_id`, `max_size`; `PATCH /classes/{id}` sửa các trường đó và `status` (`active`, `closed`). Bậc học phải đang dùng; phòng phải đang dùng và cùng đơn vị, khác đơn vị trả `ERR_RULE_VIOLATION`. Mã trùng trong đơn vị trả `ERR_CONFLICT`. Cần `P02.class.manage` trong phạm vi đơn vị.
3. `POST /classes/{id}/staff-assignments` nhận `staff_user_id`, `assignment_role` (`homeroom`, `subject`), `subject_name` (bắt buộc với bộ môn), `from_date` (mặc định hôm nay). Người được chọn phải có VT-07 với chủ nhiệm, VT-08 với bộ môn, ở đơn vị của lớp hoặc Trường chính; máy chủ API kiểm tra qua `GET /users/directory` bằng mã phiên của người gọi. Lớp đã đóng thì trả `ERR_RULE_VIOLATION`. `PATCH .../{assignmentId}` nhận `status: ended` và `to_date`.
4. `GET /users/directory?role_code=&org_unit_id=` trả `user_id`, `full_name`, `role_code`, `org_unit_id` của tài khoản đang hoạt động có vai trò đó ở đơn vị hoặc Trường chính.

Giao kèo của các danh mục (DT-01 phần 6b, YCTD-42):

1. `GET /departments`, `GET /job-titles`, `GET /rooms` bắt buộc `org_unit_id`; ai có vai trò ở đơn vị đó đều đọc được. `POST` nhận `org_unit_id` và các trường của bảng; `PATCH /{id}` nhận các trường sửa được và `status` (`active`, `inactive`). Ghi cần `P01.department.manage` (phòng ban, chức danh) hoặc `P01.room.manage` (phòng học) trong phạm vi đơn vị; đơn vị phải đang hoạt động.
2. Phòng ban cha phải cùng đơn vị, đang hoạt động và không phải phòng ban con của chính nó; không ngừng sử dụng được phòng ban còn phòng ban con đang hoạt động. Vi phạm trả `ERR_RULE_VIOLATION`.
3. `GET /catalog-items` lọc theo `catalog_type`, `status`; `GET /grade-levels` lọc theo `status`; mọi người đã đăng nhập đều đọc được. Ghi cần `P01.catalog.manage`. Mã bậc học không đổi được; độ tuổi theo tháng, tuổi từ không lớn hơn tuổi đến.
4. `GET /approval-thresholds` cần `P01.view`, chỉ trả hạn mức đang hiệu lực trong phạm vi đơn vị, lọc được theo `org_unit_id`. `PUT /approval-thresholds` nhận `org_unit_id`, `document_type` (tám loại của `07_QUY_TAC_NGHIEP_VU.md` mục 12.1), `threshold_amount` lớn hơn 0, tối đa hai chữ số thập phân; gửi `null` là gỡ hạn mức. Cần `P01.approval-threshold.manage`.
5. Mã trùng trong phạm vi duy nhất trả `ERR_CONFLICT`. Mọi thao tác ghi đều ghi nhật ký thao tác; khi mở năm học mới, các danh mục chuyển sang và giữ nguyên mã định danh.

Giao kèo của cấu hình và nhật ký thao tác (DT-01 phần 6a):

1. `GET /settings?org_unit_id=` trả danh sách mục cấu hình, mỗi mục gồm `key`, `label`, `value_type`, `value` (giá trị đang áp dụng), `source` (`unit`, `truong_chinh`, `default`, `missing`), `unit_value`. Ai có vai trò ở đơn vị đó đều đọc được (YCTD-40).
2. `PUT /settings` nhận `org_unit_id` và `values` là bảng khóa và giá trị; giá trị `null` xóa giá trị riêng để kế thừa lại; cần `P01.setting.manage` trong phạm vi đơn vị (PQ-15). Khóa lạ hoặc giá trị sai trả `ERR_VALIDATION`.
3. `GET /audit-logs` theo mục 3, lọc `org_unit_id`, `entity_name`, `entity_id`, `actor_user_id`, `from_date`, `to_date`; cần `P01.view`; chỉ trả nhật ký trong phạm vi đơn vị. Mỗi bản ghi có `actor_name` là tên người thực hiện lúc thao tác.
4. Dịch vụ định danh: `GET`, `PUT /auth/settings` đọc và sửa `account_inactivity_lock_days` (mặc định 90, từ 7 đến 3650; sửa cần `P01.setting.manage` ở phạm vi toàn trường); `GET /users/audit-logs` trả nhật ký tài khoản và quyền, chỉ VT-01, VT-02 xem.

Giao kèo của nhóm điểm cuối cây đơn vị (DT-01 phần 4):

1. `POST /org-units` nhận `code`, `name`, `unit_type` (`truong_chinh`, `phan_hieu`, `diem_truong`), `address`, `phone`, `manager_user_id`; đơn vị cấp 2 tự trực thuộc Trường chính. Cần năm học đang dùng, nếu không trả `ERR_RULE_VIOLATION` mã BR-93.
2. Vi phạm cây hai cấp trả `ERR_RULE_VIOLATION` mã BR-01: Trường chính thứ hai, đơn vị dưới đơn vị cấp 2, đổi đơn vị cha, đổi loại giữa hai cấp, ngừng sử dụng Trường chính, ngừng sử dụng đơn vị còn đơn vị con đang hoạt động. Mã trùng trả `ERR_CONFLICT`.
3. `GET /org-units` lọc được theo `unit_type` và `status`; `GET /org-units/tree` trả Trường chính kèm `children`. Mọi người đã đăng nhập đọc được; ghi cần `P01.org-unit.manage` (PQ-12).
4. Mọi thao tác tạo, sửa ghi `audit_logs` kèm giá trị trước và sau (QU-04).

Giao kèo của nhóm điểm cuối năm học (DT-01 phần 3):

1. `POST /academic-years` nhận `name`; năm học mới có `status` là `draft` (chưa mở). `status` khác là `open` (đang dùng), `closed` (đã đóng).
2. `PUT /academic-years/{id}/calendar` nhận `first_term`, `second_term`, `summer_term` (có thể trống), mỗi kỳ gồm `start_date`, `end_date` dạng `YYYY-MM-DD`; `school_days_of_week` là danh sách số từ 1 (thứ hai) đến 7 (chủ nhật), mặc định 1 đến 5. Lưu lịch thì đánh số lại tuần; tuần tính từ thứ hai đến chủ nhật.
3. `PATCH /academic-years/{id}/weeks` nhận `weeks`, mỗi phần tử gồm `week_no`, `is_off`, `note`.
4. Năm học đã đóng không sửa được lịch và tuần, trả `ERR_RULE_VIOLATION` mã BR-91. Mở năm học trả `ERR_RULE_VIOLATION` mã BR-93 khi năm học không ở `draft`, chưa có lịch, hoặc bắt đầu không sau ngày kết thúc của năm đang dùng; mã BR-89 khi còn trẻ đã thôi học có công nợ.
5. Phản hồi `ERR_RULE_VIOLATION` có trường `rule_code` là mã quy tắc bị vi phạm.
6. Các điểm cuối đọc dùng được với mọi người đã đăng nhập; các điểm cuối ghi cần `P01.academic-year.manage` (PQ-11).
| GET, POST | /api/v1/departments | Danh sách và tạo phòng ban |
| PATCH | /api/v1/departments/{id} | Sửa tên, phòng ban cha, ngừng sử dụng hoặc dùng lại phòng ban |
| GET, POST | /api/v1/job-titles | Danh sách và tạo chức danh |
| PATCH | /api/v1/job-titles/{id} | Sửa, ngừng sử dụng hoặc dùng lại chức danh |
| GET | /api/v1/catalog-types | Các loại danh mục dùng chung do hệ thống định nghĩa |
| GET, POST | /api/v1/catalog-items | Danh sách và tạo mục danh mục dùng chung |
| PATCH | /api/v1/catalog-items/{id} | Sửa, ngừng sử dụng hoặc dùng lại mục danh mục dùng chung |
| GET, POST | /api/v1/users | Danh sách và tạo tài khoản |
| GET | /api/v1/users/directory | Danh bạ nhân sự theo vai trò và đơn vị để phân công giáo viên; cần `P02.class.manage` (YCTD-44) |
| PATCH | /api/v1/users/{id} | Cập nhật tài khoản, khóa hoặc mở khóa |
| POST | /api/v1/users/guardian-accounts | Tạo tài khoản phụ huynh hoặc thêm vai trò VT-14 khi duyệt hồ sơ trẻ; cần `P02.approve` ở đơn vị (YCTD-45) |
| POST | /api/v1/users/{id}/reset-password | Đặt lại mật khẩu |
| GET, POST | /api/v1/roles | Danh sách và tạo vai trò |
| PUT | /api/v1/roles/{id}/permissions | Gán danh sách quyền cho vai trò |
| POST | /api/v1/users/{id}/roles | Gán vai trò kèm phạm vi đơn vị |
| DELETE | /api/v1/users/{id}/roles/{assignmentId} | Gỡ một vai trò của tài khoản; thu hồi mọi phiên của tài khoản (YCTD-39) |
| GET | /api/v1/permissions | Danh sách quyền theo phân hệ |

Giao kèo của nhóm điểm cuối tài khoản, vai trò, quyền (DT-01 phần 5, do dịch vụ định danh phục vụ):

1. `POST /users` nhận `full_name`, `phone` (10 chữ số, bắt đầu bằng 0), `username`, `valid_until`, `roles` (mỗi phần tử gồm `role_code`, `org_unit_id`); trả `account` và `temporary_password` chỉ một lần (PQ-14).
2. Vai trò VT-01, VT-02, VT-19, VT-20 không chọn đơn vị; vai trò khác bắt buộc chọn đơn vị đang hoạt động (PQ-03); VT-20 bắt buộc `valid_until` (BM-68); trùng số điện thoại hoặc tên đăng nhập trả `ERR_CONFLICT`.
3. `PATCH /users/{id}` sửa `full_name`, `phone`, `username`, `valid_until`, `status` (`active`, `locked`); không ai tự sửa tài khoản của mình (PQ-08). Khóa, đặt lại mật khẩu, gán hoặc gỡ vai trò thì thu hồi mọi phiên (BM-56).
4. `GET /users` theo mục 3, lọc `q`, `status`, `role_code`; chỉ trả tài khoản trong phạm vi quản lý của người gọi (PQ-13).
5. `PUT /roles/{id}/permissions` nhận `permission_codes` thay toàn bộ quyền của vai trò; quyền mới có hiệu lực ở yêu cầu kế tiếp. `POST /roles` nhận `code`, `name`.
6. Mọi thao tác ghi `identity_audit_logs` kèm giá trị trước và sau. Dịch vụ định danh đọc cây đơn vị qua `GET /api/v1/org-units` của máy chủ API bằng mã phiên của người gọi.
| GET, PUT | /api/v1/settings | Đọc và ghi cấu hình theo đơn vị |
| GET, PUT | /api/v1/approval-thresholds | Đọc và ghi hạn mức phê duyệt theo đơn vị và loại chứng từ |
| GET, POST | /api/v1/rooms | Danh mục phòng học |
| PATCH | /api/v1/rooms/{id} | Sửa, ngừng sử dụng hoặc dùng lại phòng học |
| GET, POST | /api/v1/grade-levels | Danh mục bậc học |
| PATCH | /api/v1/grade-levels/{id} | Sửa, ngừng sử dụng hoặc dùng lại bậc học; không đổi mã |
| GET | /api/v1/audit-logs | Tra nhật ký thao tác |
| GET, POST | /api/v1/api-clients | Danh sách và cấp khóa API cho đối tác |
| POST | /api/v1/api-clients/{id}/revoke | Thu hồi khóa API |
| GET | /api/v1/partner/reports/summary | Đối tác đọc báo cáo tổng hợp; xác thực bằng khóa API |
| GET | /api/v1/partner/finance | Đối tác đọc phiếu thu, phiếu chi, khoản mục, công nợ tổng hợp |
| GET | /api/v1/partner/children | Đối tác đọc danh sách trẻ và phụ huynh; ghi nhật ký mỗi lần đọc |
| GET | /api/v1/partner/staff | Đối tác đọc nhân sự và bảng lương; ghi nhật ký mỗi lần đọc |
| GET | /api/v1/imports/templates/{type} | Tải mẫu Excel theo loại dữ liệu |
| POST | /api/v1/imports | Tải tệp lên và kiểm tra, trả báo cáo dòng lỗi |
| GET | /api/v1/imports/{id} | Trạng thái và báo cáo lỗi của lần nhập |
| POST | /api/v1/imports/{id}/commit | Ghi dữ liệu khi không còn dòng lỗi |
| GET | /api/v1/data-access-logs | Tra nhật ký truy cập dữ liệu nhạy cảm |

## 6. Trẻ, phụ huynh và lớp học

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/children | Danh sách trẻ có lọc và phân trang |
| POST | /api/v1/children | Tạo hồ sơ trẻ |
| GET | /api/v1/children/{id} | Chi tiết hồ sơ trẻ |
| GET | /api/v1/children/{id}/national-id | Xem đầy đủ số định danh cá nhân; chỉ VT-02, VT-15, VT-03, VT-12; ghi nhật ký truy cập |
| POST | /api/v1/children/{id}/photo-consent | Phụ huynh đồng ý hoặc rút đồng ý; nhà trường ghi nhận giấy ký tay |
| PATCH | /api/v1/children/{id} | Cập nhật hồ sơ trẻ |
| POST | /api/v1/children/{id}/submit | Gửi trình duyệt hồ sơ |
| POST | /api/v1/children/{id}/approve | Duyệt hồ sơ và phân lớp |
| POST | /api/v1/children/{id}/reject | Từ chối hồ sơ kèm lý do |
| POST | /api/v1/children/{id}/transfer-class | Chuyển lớp |
| POST | /api/v1/children/{id}/transfer-unit | Chuyển đơn vị |
| POST | /api/v1/children/{id}/withdraw | Ghi nhận thôi học và quyết toán |
| GET | /api/v1/children/check-duplicate | Kiểm tra trẻ nghi trùng theo họ tên và ngày sinh |
| GET, POST | /api/v1/guardians | Danh sách và tạo hồ sơ phụ huynh |
| POST | /api/v1/children/{id}/guardians | Gắn phụ huynh vào trẻ |
| PATCH | /api/v1/children/{id}/guardians/{guardianId} | Đặt phụ huynh làm liên hệ chính (YCTD-45) |
| POST | /api/v1/files | Tải tệp đính kèm lên kho tệp: ảnh JPEG, PNG hoặc PDF, tối đa 10 MB (YCTD-45) |
| GET | /api/v1/files/{id} | Tải tệp đính kèm; giấy khai sinh cần `P02.national-id.view` và luôn ghi nhật ký truy cập |
| GET, POST | /api/v1/children/{id}/authorized-pickups | Danh sách và khai báo người được ủy quyền đón trẻ |
| DELETE | /api/v1/authorized-pickups/{id} | Hủy ủy quyền đón trẻ |
| GET, POST | /api/v1/classes | Danh sách và tạo lớp |
| PATCH | /api/v1/classes/{id} | Cập nhật lớp |
| GET | /api/v1/classes/{id}/children | Danh sách trẻ trong lớp |
| POST | /api/v1/imports/moet-codes | Nhập mã định danh ngành từ tệp (P02-12) |
| GET, POST | /api/v1/classes/{id}/staff-assignments | Phân công giáo viên chủ nhiệm và giáo viên bộ môn vào lớp |
| PATCH | /api/v1/classes/{id}/staff-assignments/{assignmentId} | Kết thúc phân công (YCTD-44) |
| PATCH | /api/v1/staff-assignments/{id} | Kết thúc hoặc sửa phân công |
| GET, POST | /api/v1/teaching-groups | Tổ chuyên môn, tổ trưởng và thành viên |
| GET, POST | /api/v1/lost-items | Danh sách và báo đồ bị mất của trẻ |
| POST | /api/v1/lost-items/{id}/close | Đóng phiếu đồ bị mất kèm kết quả |

## 7. Giảng dạy

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/lesson-domains | Danh mục lĩnh vực bài học |
| GET, POST | /api/v1/lesson-groups | Danh mục nhóm bài học, lọc được theo lĩnh vực |
| GET, POST | /api/v1/themes | Danh sách và tạo chủ đề giảng dạy |
| GET, POST | /api/v1/lessons | Danh sách bài học, lọc theo chủ đề, lĩnh vực, nhóm, độ tuổi; tạo bài học |
| PATCH | /api/v1/lessons/{id} | Cập nhật bài học |
| GET, POST | /api/v1/lesson-plans | Danh sách giáo án theo lớp và khoảng ngày; soạn giáo án |
| PATCH | /api/v1/lesson-plans/{id} | Cập nhật giáo án ở trạng thái nháp hoặc bị từ chối |
| POST | /api/v1/lesson-plans/{id}/submit | Gửi trình duyệt giáo án |
| POST | /api/v1/lesson-plans/{id}/approve | Duyệt và công bố giáo án |
| POST | /api/v1/lesson-plans/{id}/reject | Từ chối giáo án kèm lý do |
| GET, PUT | /api/v1/classes/{id}/timetable | Đọc và lưu thời khóa biểu của lớp theo tuần |
| POST | /api/v1/classes/{id}/timetable/publish | Công bố thời khóa biểu cho phụ huynh |
| GET, POST | /api/v1/teaching-plans | Danh sách và lập kế hoạch giảng dạy theo lớp và kỳ |
| PATCH | /api/v1/teaching-plans/{id} | Cập nhật kế hoạch và tiến độ giảng dạy |
| GET, POST | /api/v1/children/{id}/progress | Tiến độ học tập của trẻ theo kỳ; ghi nhận chỉ số và nhận xét |
| POST | /api/v1/children/{id}/progress/publish | Công bố phiếu tiến độ cho phụ huynh |
| GET, POST | /api/v1/classes/{id}/activity-schedules | Lịch hoạt động của lớp theo ngày |
| POST | /api/v1/classes/{id}/activity-schedules/publish | Công bố lịch hoạt động lớp cho phụ huynh |

Giáo viên chủ nhiệm và giáo viên bộ môn chỉ thao tác trên lớp được phân công. Phụ huynh chỉ đọc được thời khóa biểu, lịch hoạt động và tiến độ đã công bố của lớp và của con mình.

## 8. Điểm danh và chăm sóc hằng ngày

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/classes/{id}/attendance | Bảng điểm danh của lớp theo ngày |
| PUT | /api/v1/classes/{id}/attendance | Lưu trạng thái điểm danh trong ngày |
| POST | /api/v1/classes/{id}/attendance/lock | Chốt điểm danh ngày |
| POST | /api/v1/classes/{id}/attendance/unlock | Mở lại điểm danh ngày kèm lý do |
| GET, POST | /api/v1/absences | Danh sách và ghi nhận nghỉ |
| GET | /api/v1/children/{id}/attendance | Điểm danh và báo vắng của một trẻ theo tháng (YCTD-47) |
| POST | /api/v1/children/{id}/pickups | Giáo viên chủ nhiệm ghi nhận bàn giao trẻ; bảo vệ xác nhận người đón tại cổng (YCTD-48) |
| GET | /api/v1/classes/{id}/pickups | Đón trả của lớp trong ngày: trẻ, người được đón, lượt bàn giao, yêu cầu xác nhận (YCTD-48) |
| GET | /api/v1/pickup-directory | Bảo vệ tìm trẻ trong đơn vị kèm người được đón hôm nay (YCTD-48) |
| GET | /api/v1/pickup-confirmations | Yêu cầu xác nhận người đón của các con của phụ huynh (YCTD-48) |
| POST | /api/v1/pickup-confirmations/{id}/confirm | Phụ huynh xác nhận người đón ngoài danh sách (YCTD-48) |
| POST | /api/v1/pickup-confirmations/{id}/refuse | Phụ huynh từ chối người đón ngoài danh sách (YCTD-48) |
| GET | /api/v1/classes/{id}/journals | Danh sách nhật ký của lớp theo ngày |
| PUT | /api/v1/children/{id}/journals/{date} | Lưu nhật ký của trẻ trong ngày |
| POST | /api/v1/classes/{id}/journals/publish | Công bố nhật ký của ngày |
| GET | /api/v1/children/{id}/journals | Nhật ký của trẻ, dùng cho ứng dụng phụ huynh |

## 9. Học phí, khoản thu và giảm trừ

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/fee-schedules | Danh sách phiên bản biểu phí và tạo phiên bản mới |
| GET, PUT, DELETE | /api/v1/fee-schedules/{id} | Xem; sửa, xóa phiên bản chưa tới ngày hiệu lực (YCTD-49) |
| GET, POST | /api/v1/services | Danh sách và tạo dịch vụ |
| PATCH | /api/v1/services/{id} | Sửa, ngừng sử dụng dịch vụ (YCTD-49) |
| GET, POST | /api/v1/service-registrations | Bảng đăng ký của đơn vị theo kỳ và đăng ký dịch vụ |
| GET | /api/v1/service-registrations/periods | Các tháng của năm học đang mở, đánh dấu tháng hè (YCTD-50) |
| GET | /api/v1/service-registrations/pending | Đăng ký trễ và hủy trễ chờ Ban Giám hiệu duyệt (YCTD-50) |
| GET | /api/v1/children/{id}/service-registrations | Đăng ký của một trẻ trong kỳ (YCTD-50) |
| POST | /api/v1/service-registrations/{id}/cancel | Hủy dịch vụ; sau ngày chốt chờ Ban Giám hiệu duyệt (YCTD-50) |
| POST | /api/v1/service-registrations/{id}/reject-late | Ban Giám hiệu từ chối đăng ký trễ hoặc hủy trễ kèm lý do (YCTD-50) |
| POST | /api/v1/service-registrations/lock | Chốt danh sách đăng ký của kỳ |
| GET, POST | /api/v1/summer-registrations | Danh sách và đăng ký học hè theo tháng (P05-13) |
| DELETE | /api/v1/summer-registrations/{id} | Hủy học hè trước ngày chốt của tháng (YCTD-50) |
| POST | /api/v1/service-registrations/{id}/approve-late | Ban Giám hiệu duyệt đăng ký trễ và chọn cách thu phí, hoặc duyệt hủy trễ |
| POST | /api/v1/fee-calculations | Chạy tính học phí cho kỳ và đơn vị |
| GET | /api/v1/fee-calculations/{run_id} | Xem trạng thái và kết quả của lần tính |
| GET | /api/v1/invoices | Danh sách hóa đơn có lọc |
| POST | /api/v1/invoices/issue | Phát hành khoản phải thu của kỳ |
| POST | /api/v1/invoices/supplementary | Lập hóa đơn bổ sung cùng kỳ cho khoản phát sinh sau khi hóa đơn chính đã phát hành (BR-85) |
| GET | /api/v1/invoices/{id} | Chi tiết hóa đơn và các dòng khoản phải thu |
| PATCH | /api/v1/invoices/{id} | Luôn trả `ERR_RULE_VIOLATION` mã BR-25: hóa đơn không sửa trực tiếp (YCTD-51) |
| GET | /api/v1/invoices/{id}/payment-qr | Mã QR chuyển khoản cho số còn phải nộp của hóa đơn |
| POST | /api/v1/payment-webhooks/bank-transfer | Nhận thông báo tiền vào từ ngân hàng hoặc đơn vị trung gian; không dùng mã phiên, xác thực bằng chữ ký |
| GET | /api/v1/online-payment-transactions | Danh sách giao dịch chuyển khoản, lọc theo trạng thái khớp |
| POST | /api/v1/online-payment-transactions/{id}/resolve | Kế toán xử lý giao dịch không khớp |
| POST | /api/v1/invoices/{id}/discounts | Lập giảm trừ, trình Ban Giám hiệu duyệt theo hạn mức |
| POST | /api/v1/invoices/{id}/discounts/copy-previous | Chép miễn giảm đã duyệt của kỳ trước sang hóa đơn, chờ duyệt (YCTD-52) |
| GET | /api/v1/fee-approvals/pending | Miễn giảm và phiếu điều chỉnh chờ duyệt của người duyệt (YCTD-52) |
| POST | /api/v1/discounts/{id}/approve | Ban Giám hiệu duyệt giảm trừ |
| POST | /api/v1/discounts/{id}/reject | Từ chối giảm trừ kèm lý do |
| GET, POST | /api/v1/discount-types | Danh mục loại miễn giảm |
| PATCH | /api/v1/discount-types/{id} | Sửa, ngừng sử dụng loại miễn giảm (YCTD-49) |
| POST | /api/v1/invoice-adjustments | Lập phiếu điều chỉnh hóa đơn |
| POST | /api/v1/invoice-adjustments/{id}/approve | Ban Giám hiệu duyệt phiếu điều chỉnh theo hạn mức |
| POST | /api/v1/invoice-adjustments/{id}/reject | Từ chối phiếu điều chỉnh kèm lý do |
| GET | /api/v1/debts | Danh sách công nợ theo trẻ, theo lớp, theo mốc quá hạn |
| GET | /api/v1/children/{id}/debt | Công nợ của một trẻ: hóa đơn đã phát hành kèm số còn phải nộp, số dư có (YCTD-53) |
| GET | /api/v1/debts/reminders | Danh sách cần nhắc nợ |
| POST | /api/v1/debts/reminders/send | Gửi nhắc nợ |
| GET, POST | /api/v1/debt-resolutions | Danh sách và lập đề xuất xử lý công nợ quá hạn (P05-12) |
| POST | /api/v1/debt-resolutions/{id}/decide | Ban Giám hiệu ghi quyết định xử lý |

## 10. Tài chính

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/receipts | Danh sách phiếu thu; lập và phát hành ngay phiếu thu kèm phân bổ (YCTD-53) |
| GET, DELETE | /api/v1/receipts/{id} | Chi tiết phiếu thu kèm phân bổ; xóa luôn bị từ chối (BR-29) |
| POST | /api/v1/receipts/{id}/reverse | Lập phiếu đảo phiếu thu kèm lý do, chờ Ban Giám hiệu duyệt |
| POST | /api/v1/receipts/{id}/reverse/approve | Ban Giám hiệu duyệt phiếu đảo theo hạn mức (YCTD-23) |
| POST | /api/v1/receipts/{id}/reverse/reject | Ban Giám hiệu từ chối phiếu đảo kèm lý do |
| GET | /api/v1/receipt-reversals/pending | Phiếu đảo chờ duyệt của người duyệt (YCTD-54) |
| GET | /api/v1/children/{id}/receipts | Lịch sử phiếu thu của trẻ |
| POST | /api/v1/children/{id}/credit-allocations | Dùng số dư có của trẻ thanh toán hóa đơn (GD-27, YCTD-53) |
| GET, POST | /api/v1/payments | Danh sách và lập phiếu chi nháp (YCTD-55) |
| GET, PATCH, DELETE | /api/v1/payments/{id} | Chi tiết kèm chứng từ; sửa và xóa khi còn nháp |
| POST | /api/v1/payments/{id}/submit | Trình duyệt phiếu chi, bắt buộc có chứng từ |
| GET | /api/v1/payments/pending | Phiếu chi chờ duyệt của người duyệt |
| POST | /api/v1/payments/{id}/approve | Phê duyệt phiếu chi |
| POST | /api/v1/payments/{id}/reject | Từ chối phiếu chi |
| POST | /api/v1/payments/{id}/reverse | Lập phiếu đảo phiếu chi kèm lý do, chờ Ban Giám hiệu duyệt |
| POST | /api/v1/payments/{id}/reverse/approve | Ban Giám hiệu duyệt phiếu đảo phiếu chi theo hạn mức (YCTD-24) |
| POST | /api/v1/payments/{id}/reverse/reject | Ban Giám hiệu từ chối phiếu đảo phiếu chi kèm lý do |
| GET | /api/v1/payment-reversals/pending | Phiếu đảo phiếu chi chờ duyệt của người duyệt (YCTD-56) |
| GET, POST | /api/v1/cash-accounts | Danh sách quỹ và tài khoản ngân hàng của đơn vị; khai báo quỹ hoặc tài khoản (YCTD-53) |
| PATCH | /api/v1/cash-accounts/{id} | Sửa tên, thông tin ngân hàng, ngừng sử dụng |
| GET | /api/v1/cash-books | Sổ quỹ hoặc sổ tài khoản theo khoảng ngày, thay cho lịch sử giao dịch của tài khoản (YCTD-55) |
| GET, POST | /api/v1/payables | Danh sách và ghi nhận công nợ phải trả |
| GET, POST | /api/v1/suppliers | Danh sách và tạo nhà cung cấp |
| POST | /api/v1/fiscal-periods/{id}/request-close | Kế toán trưởng đề nghị chốt kỳ tài chính |
| POST | /api/v1/fiscal-periods/{id}/close | Hiệu trưởng phê duyệt và chốt kỳ tài chính |
| GET, POST | /api/v1/cashflow-categories | Khoản mục và nhóm thu chi |
| PATCH | /api/v1/cashflow-categories/{id} | Sửa, ngừng sử dụng khoản mục (YCTD-49) |

## 11. Nhân sự, chấm công và tiền lương

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/staff | Danh sách và tạo hồ sơ nhân sự |
| GET, PATCH | /api/v1/staff/{id} | Chi tiết và cập nhật hồ sơ nhân sự |
| GET, POST | /api/v1/staff/{id}/contracts | Danh sách và tạo hợp đồng lao động |
| POST | /api/v1/contracts/{id}/terminate | Chấm dứt hợp đồng |
| GET | /api/v1/attendance-logs | Bảng chấm công theo kỳ và đơn vị |
| PUT | /api/v1/attendance-logs | Ghi hoặc sửa chấm công |
| POST | /api/v1/attendance-logs/lock | Chốt bảng công của kỳ |
| POST | /api/v1/attendance-logs/reopen-requests | Nhân sự đề nghị mở lại kỳ công đã chốt kèm lý do |
| POST | /api/v1/attendance-logs/reopen-requests/{id}/approve | Ban Giám hiệu duyệt mở lại kỳ công (Q-135) |
| GET, POST | /api/v1/work-schedules | Lịch nghỉ và lịch công tác |
| GET, POST | /api/v1/leave-requests | Danh sách và tạo đơn xin nghỉ phép |
| POST | /api/v1/leave-requests/{id}/approve | Duyệt đơn nghỉ phép |
| POST | /api/v1/leave-requests/{id}/reject | Từ chối đơn nghỉ phép |
| POST | /api/v1/payrolls | Tính bảng lương trả trước của tháng kèm điều chỉnh theo công đã chốt của tháng trước; trả `ERR_RULE_VIOLATION` khi tháng trước chưa chốt công (BR-43) |
| GET | /api/v1/payrolls/{period_id} | Bảng lương của kỳ |
| POST | /api/v1/payrolls/{period_id}/approve | Phê duyệt bảng lương |
| POST | /api/v1/payrolls/settlements | Lập bảng quyết toán cuối cùng khi chấm dứt hợp đồng (BR-90) |
| GET | /api/v1/me/payslips | Phiếu lương của chính người đăng nhập |
| GET | /api/v1/me/attendance-logs | Chấm công của chính người đăng nhập |
| GET, POST | /api/v1/allowance-types | Danh mục phụ cấp |
| GET, POST | /api/v1/deduction-types | Danh mục khấu trừ |
| GET, POST | /api/v1/leave-policies | Quy định số ngày phép năm theo chức danh và thâm niên |
| GET, POST | /api/v1/holidays | Ngày nghỉ lễ |
| GET, POST | /api/v1/saturday-schedules | Lịch nghỉ thứ 7 định kỳ và lịch học bù chung toàn trường; chỉ Ban Giám hiệu được tạo và sửa |

## 12. Công việc, kế hoạch và đánh giá

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/tasks | Danh sách và tạo công việc |
| PATCH | /api/v1/tasks/{id} | Cập nhật công việc |
| POST | /api/v1/tasks/{id}/updates | Cập nhật tiến độ |
| GET, POST | /api/v1/plans | Danh sách và tạo kế hoạch |
| GET, POST | /api/v1/evaluations | Danh sách và tạo đánh giá |
| POST | /api/v1/evaluations/{id}/publish | Công bố kết quả đánh giá |
| GET, POST | /api/v1/evaluation-criteria | Danh mục chỉ số đánh giá |

## 13. Y tế học đường

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/children/{id}/health-profile | Hồ sơ sức khỏe của trẻ |
| PUT | /api/v1/children/{id}/health-profile | Cập nhật hồ sơ sức khỏe |
| GET, POST | /api/v1/children/{id}/health-measurements | Chỉ số sức khỏe theo lần đo |
| GET, POST | /api/v1/medicines | Danh mục thuốc |
| GET, POST | /api/v1/medication-requests | Danh sách và gửi yêu cầu dặn thuốc |
| POST | /api/v1/medication-requests/{id}/receive | Xác nhận đã nhận thuốc |
| POST | /api/v1/medication-requests/{id}/reject | Từ chối nhận thuốc kèm lý do |
| GET | /api/v1/medication-schedules | Danh sách trẻ cần cho uống thuốc theo khung giờ |
| POST | /api/v1/medication-administrations | Ghi nhận một lần cho uống thuốc hoặc bỏ liều; giáo viên chủ nhiệm chỉ gọi được khi đơn vị bật cấu hình không có nhân viên y tế |
| POST | /api/v1/medication-administrations/{id}/acknowledge | Phụ huynh xác nhận đã biết thông báo bỏ liều (YCTD-25) |
| GET, POST | /api/v1/health-check-campaigns | Đợt khám sức khỏe |
| PUT | /api/v1/health-check-campaigns/{id}/results | Ghi kết quả khám cho từng trẻ |
| GET, POST | /api/v1/medical-events | Sự kiện y tế tại trường |
| POST | /api/v1/medical-events/{id}/acknowledge | Phụ huynh xác nhận đã biết sự kiện y tế (YCTD-25) |
| GET, POST | /api/v1/children/{id}/daily-care-logs | Nhật ký chăm sóc hằng ngày của trẻ (P10-12) |
| GET, POST | /api/v1/medicine-purchase-requests | Đề nghị mua thuốc |
| POST | /api/v1/medicine-purchase-requests/{id}/approve | Duyệt đề nghị mua thuốc theo hạn mức |
| GET, POST | /api/v1/medicine-purchase-orders | Phiếu mua thuốc và thuốc đã mua |
| GET, POST | /api/v1/health-check-schedules | Lịch khám sức khỏe |
| GET, POST | /api/v1/health-standards | Tiêu chuẩn sức khỏe |

## 14. Xe đưa đón (đã bỏ)

Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62). Mọi điểm cuối của nhóm này đã gỡ.

## 15. Bếp, kho và mua hàng

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/dishes | Món ăn |
| GET, POST | /api/v1/menus | Thực đơn tuần |
| POST | /api/v1/menus/{id}/approve | Duyệt và công bố thực đơn |
| GET | /api/v1/menus/{id}/norms | Định lượng nguyên liệu theo số suất |
| GET | /api/v1/meal-plans | Số suất ăn theo ngày |
| GET, POST | /api/v1/buffet-events | Tiệc buffet theo dịp |
| GET, POST | /api/v1/market-purchases | Phiếu đi chợ |
| POST | /api/v1/market-purchases/{id}/receive | Xác nhận nhập nguyên liệu của phiếu đi chợ |
| GET, POST | /api/v1/assets | Tài sản |
| POST | /api/v1/asset-assignments | Cấp phát và thu hồi tài sản |
| POST | /api/v1/asset-loans | Mượn và trả tài sản |
| POST | /api/v1/asset-damages | Ghi nhận hỏng hoặc mất |
| GET, POST | /api/v1/purchase-requests | Đề nghị mua hàng |
| POST | /api/v1/purchase-requests/{id}/approve | Duyệt đề nghị mua hàng |
| POST | /api/v1/purchase-requests/{id}/reject | Từ chối đề nghị mua hàng kèm lý do |
| GET, POST | /api/v1/purchase-orders | Phiếu mua hàng |
| GET, POST | /api/v1/stock-items | Mặt hàng trong kho |
| GET | /api/v1/stock-transactions | Nhập xuất kho |
| GET, POST | /api/v1/stock-counts | Kỳ kiểm kê và biên bản kiểm kê |
| POST | /api/v1/stock-opening-balances | Nhập tồn kho ban đầu |

## 16. Nội dung, tương tác và tuyển sinh

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/activities | Danh sách và tạo hoạt động |
| POST | /api/v1/activities/{id}/submit | Gửi trình duyệt |
| POST | /api/v1/activities/{id}/approve | Duyệt hoạt động |
| POST | /api/v1/activities/{id}/reject | Từ chối hoạt động kèm lý do |
| POST | /api/v1/activities/{id}/hide | Quản lý đơn vị hoặc Ban Giám hiệu ẩn hoạt động đã công bố kèm lý do (Q-72) |
| POST | /api/v1/activities/{id}/republish | Công bố lại hoạt động đã ẩn |
| POST | /api/v1/activities/{id}/like | Thích hoạt động |
| GET, POST | /api/v1/activities/{id}/comments | Bình luận của hoạt động |
| POST | /api/v1/comments/{id}/hide | Quản lý đơn vị ẩn bình luận vi phạm kèm lý do; bình luận vẫn được lưu (BR-66) |
| GET, POST | /api/v1/news | Tin tức |
| GET, POST | /api/v1/library-items | Nội dung thư viện |
| GET, POST | /api/v1/coloring-pages | Hình tô màu |
| GET, POST | /api/v1/extracurricular-activities | Hoạt động ngoại khóa |
| GET, POST | /api/v1/extracurricular-activities/{id}/registrations | Đăng ký hoạt động ngoại khóa |
| GET, POST | /api/v1/library-albums | Album thư viện |
| GET, POST | /api/v1/content-comments | Bình luận trên thư viện và tin tức |
| GET, POST | /api/v1/announcements | Thông báo |
| GET | /api/v1/announcements/{id}/reads | Danh sách đã đọc và chưa đọc |
| GET, POST | /api/v1/message-threads | Luồng trao đổi |
| GET, POST | /api/v1/message-threads/{id}/messages | Tin nhắn trong luồng |
| GET, POST | /api/v1/feedbacks | Góp ý |
| POST | /api/v1/feedbacks/{id}/handle | Ghi nhận xử lý góp ý |
| GET, POST | /api/v1/polls | Bình chọn, biểu quyết, khảo sát |
| POST | /api/v1/polls/{id}/responses | Gửi phiếu trả lời |
| GET | /api/v1/polls/{id}/results | Kết quả |
| GET, POST | /api/v1/admission-campaigns | Đợt tuyển sinh |
| GET, POST | /api/v1/admission-posts | Tin tuyển sinh |
| GET, POST | /api/v1/admission-applications | Hồ sơ tuyển sinh |
| POST | /api/v1/admission-applications/{id}/approve | Duyệt hồ sơ tuyển sinh |
| POST | /api/v1/admission-applications/{id}/reject | Từ chối hồ sơ tuyển sinh kèm lý do |
| POST | /api/v1/admission-applications/{id}/convert | Chuyển thành hồ sơ trẻ |
| GET, POST | /api/v1/recruitment-requests | Đề nghị tuyển dụng |
| GET, POST | /api/v1/job-postings | Tin tuyển dụng |
| GET, POST | /api/v1/candidates | Hồ sơ ứng viên |
| GET, POST | /api/v1/candidates/{id}/interviews | Lịch phỏng vấn và kết quả |

## 17. Báo cáo và thông báo

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/dashboard/leadership | Bảng điều khiển Ban Giám hiệu |
| GET | /api/v1/dashboard/unit | Bảng điều khiển quản lý đơn vị |
| GET | /api/v1/dashboard/birthdays | Sinh nhật trẻ trong tháng |
| GET | /api/v1/reports/tuition | Báo cáo học phí |
| GET | /api/v1/reports/debts | Báo cáo công nợ |
| GET | /api/v1/reports/cash-flow | Báo cáo thu chi |
| GET | /api/v1/reports/attendance | Báo cáo điểm danh và trẻ vắng |
| GET | /api/v1/reports/staff-attendance | Báo cáo chấm công |
| GET | /api/v1/reports/meals | Báo cáo ăn và bếp |
| GET | /api/v1/reports/activities | Báo cáo hoạt động và công việc |
| GET | /api/v1/reports/consolidated | Báo cáo hợp nhất nhiều đơn vị |
| GET | /api/v1/reports/saturday-classes | Báo cáo học thứ 7: số trẻ đi học và vắng của từng ngày học bù |
| POST | /api/v1/reports/{code}/export | Xuất báo cáo ra tệp |
| GET | /api/v1/notifications | Danh sách thông báo của người đăng nhập |
| POST | /api/v1/notifications/{id}/read | Đánh dấu đã đọc |
| GET, POST | /api/v1/notification-templates | Mẫu thông báo |

## 18. Quy tắc kiểm tra dữ liệu

| Mã | Quy tắc |
|---|---|
| KT-01 | Kiểm tra ở máy chủ độc lập với kiểm tra ở giao diện; không tin dữ liệu gửi lên |
| KT-02 | Kiểm tra sự tồn tại và phạm vi của mọi mã định danh được gửi lên |
| KT-03 | Kiểm tra trạng thái cho phép thao tác trước khi thực hiện, ví dụ không sửa hóa đơn đã phát hành |
| KT-04 | Kiểm tra ràng buộc duy nhất trước khi ghi và bắt lỗi trùng ở tầng dữ liệu |
| KT-05 | Kiểm tra tổng phân bổ không vượt số tiền thu ở cả giao diện và máy chủ |
| KT-06 | Giới hạn dung lượng và định dạng tệp tải lên ở máy chủ |
| KT-07 | Giới hạn tần suất cho các điểm cuối nhạy cảm: đăng nhập, gửi thông báo, gửi phiếu bình chọn |
| KT-08 | Mọi phản hồi lỗi phải kèm mã tương quan để tra nhật ký |
| KT-09 | Mỗi phụ huynh nhận tối đa 5 tin nhắn mỗi ngày, không tính mã một lần; thông báo trong ứng dụng không giới hạn (Q-96) |

## 19. Phiên bản và tương thích

1. Đường dẫn mang số phiên bản; thay đổi phá vỡ tương thích phải tăng số phiên bản.
2. Không xóa điểm cuối đang dùng; ngừng dùng thì đánh dấu và thông báo trước.
3. Trường mới thêm vào phản hồi không được coi là thay đổi phá vỡ tương thích.
4. Mọi thay đổi hợp đồng giao tiếp phải ghi vào `23_LICH_SU_PHIEN_BAN.md`.

## 20. Chưa xác minh được

1. Đã có câu trả lời: đối tác đọc qua nhóm `/partner/` bằng khóa API (Q-94, Q-143); ngân hàng hoặc đơn vị trung gian gọi điểm cuối nhận thông báo tiền vào.
2. Đã có câu trả lời: API chỉ đọc cho đối tác từ giai đoạn 1 (QĐ-16).
3. Giới hạn tần suất cụ thể của từng điểm cuối: chưa có số liệu; giới hạn tin nhắn đã có ở KT-09.
4. Đã có câu trả lời: không dùng kết nối thời gian thực; điểm danh và bảng điều khiển tự tải lại mỗi 60 giây (Q-95).

## 21. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-50 | Đã xác nhận ngày 09/10/2026: Giao diện lập trình theo phong cách REST, phiên bản trong đường dẫn | Eric |
| GD-51 | Đã xác nhận ngày 09/10/2026: Mọi thao tác ghi đều có mã chống gửi trùng | Eric |
| GD-67 | Đã xác nhận ngày 09/10/2026: Nhóm điểm cuối xác thực và quản lý tài khoản do dịch vụ định danh phục vụ, dùng chung tiền tố phiên bản và mô hình lỗi với máy chủ API nghiệp vụ | Eric |
| Q-94 | Đã trả lời ngày 09/10/2026: có, mở API chỉ đọc cho đối tác ngay giai đoạn 1 (P01-14) | Eric |
| Q-95 | Đã trả lời ngày 09/10/2026: không dùng kết nối thời gian thực; màn hình điểm danh và bảng điều khiển tự tải lại mỗi 60 giây | Eric |
| Q-96 | Đã trả lời ngày 09/10/2026: mỗi phụ huynh nhận tối đa 5 tin nhắn mỗi ngày, không tính mã một lần; thông báo trong ứng dụng không giới hạn | Eric |
| Q-118 | Đã trả lời ngày 09/10/2026: dùng chung tên miền, tách theo đường dẫn | Eric |
| Q-143 | Đã trả lời ngày 09/10/2026: API cho đối tác đọc được báo cáo tổng hợp, thu chi và công nợ, danh sách trẻ và phụ huynh, nhân sự và lương; đọc dữ liệu cá nhân phải có căn cứ pháp lý ghi trên khóa và ghi nhật ký mỗi lần đọc | Eric |
