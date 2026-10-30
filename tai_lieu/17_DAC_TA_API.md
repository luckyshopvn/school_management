# 17. ĐẶC TẢ API

- Mô tả: Điểm cuối, phương thức, yêu cầu, phản hồi, xác thực, phân quyền, kiểm tra dữ liệu, xử lý lỗi, phân trang, lọc, sắp xếp, phiên bản.
- Phiên bản: 1.131
- Ngày cập nhật: 2026-10-26
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
8. Giao diện lập trình ứng dụng này do hai dịch vụ máy chủ phục vụ (cổng vào chuyển `/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`, `/api/v1/permissions`, `/api/v1/api-clients` sang dịch vụ định danh, phần còn lại sang máy chủ API): nhóm điểm cuối xác thực, quản lý tài khoản và quản lý khóa API của đối tác do **dịch vụ định danh** phục vụ (QĐ-17); các nhóm còn lại do **máy chủ API nghiệp vụ** phục vụ. Hai dịch vụ dùng chung một tiền tố phiên bản và một mô hình lỗi. Xuất Excel tài khoản, nhóm người dùng ở `/api/v1/account-exports` (YCTD-119) do máy chủ API phục vụ, đặt ngoài tiền tố `/users`, `/roles` để cổng vào không chuyển sang dịch vụ định danh.
9. Tầng giao diện không truy cập cơ sở dữ liệu; mọi thao tác dữ liệu đều đi qua giao diện lập trình ứng dụng này.
10. Xem năm học đã đóng (BC-09, YCTD-342): yêu cầu gửi máy chủ API có thể kèm tiêu đề `x-academic-year-id: <mã năm học>`. Mã sai dạng trả 400 (`ERR_VALIDATION`, trường `x-academic-year-id`); năm học không có hoặc còn nháp trả 404. Năm đang dùng thì như không có tiêu đề. Năm đã đóng: yêu cầu `GET`, `HEAD` đọc cơ sở dữ liệu của năm đó (chỉ đọc ở mức cơ sở dữ liệu); yêu cầu khác cần đến dữ liệu năm học trả 422 `ERR_RULE_VIOLATION` mã quy tắc `BR-93`; điểm cuối chỉ dùng cơ sở dữ liệu hệ thống (cấu hình lưới, thông báo…) không bị ảnh hưởng. Khi đang xem năm đã đóng, lỗi ghi vào cơ sở dữ liệu chỉ đọc hoặc thiếu bảng, cột (chức năng làm sau ngày đóng năm, QU-11) trả 422 mã quy tắc `BR-93` thay cho lỗi hệ thống. Quyền kiểm như thường.

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
| page_size | số nguyên | 20 | Tối đa 100; riêng `GET /users` của dịch vụ định danh (YCTD-107), `GET /children` và `GET /student-movements` (YCTD-108), `GET /audit-logs` và `GET /users/audit-logs` (YCTD-109), `GET /administrative-units/addresses` và `GET /administrative-units/mappings` (YCTD-116) tối đa 200 cho lưới dữ liệu của cổng quản trị |
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
| GET, PUT | /api/v1/auth/settings/password-policy | Đọc và sửa chính sách hết hạn mật khẩu; cần `P01.account.manage` (BR-110, YCTD-110) |
| GET | /api/v1/auth/totp | Trạng thái xác thực hai lớp của chính mình: `feature_enabled`, `enrolled`, `pending_setup`, `recovery_codes_left` (YCTD-201, BR-219) |
| POST | /api/v1/auth/totp/setup | Bắt đầu đăng ký: trả `secret` và `otpauth_uri`; 422 khi trường chưa bật hoặc đã bật xác thực hai lớp |
| POST | /api/v1/auth/totp/confirm | Xác nhận mã đầu tiên `{ code }`: bật, trả `recovery_codes` (8 mã, chỉ một lần); mã sai 400 |
| POST | /api/v1/auth/totp/disable | Tắt bằng mã hiện tại hoặc mã khôi phục `{ code }` |
| POST | /api/v1/auth/totp/reset | Người có quyền quản lý mọi tài khoản đặt lại hộ `{ user_id }`; có nhật ký; người khác 403 |
| (đổi) | POST /api/v1/auth/login, POST /api/v1/auth/platform/login | Thêm `otp_code` (mã TOTP hoặc mã khôi phục): tài khoản đã bật xác thực hai lớp (vận hành nền tảng: luôn) thiếu mã thì 401 kèm chi tiết `otp_code` và chưa tính nhập sai; mã sai 401 (tính nhập sai) |
| (đổi) | GET, PUT /api/v1/auth/settings | Thêm `totp_enabled` (mặc định false); GET, PUT /api/v1/auth/settings/password-policy thêm `password_min_length` (8 đến 64), `login_max_failed_attempts` (3 đến 10), `login_lock_minutes` (1 đến 1440) (YCTD-201, BR-220) |
| GET | /api/v1/auth/login-options | Công khai: đường dây nóng và có luôn hiện mã xác nhận của trang đăng nhập cổng quản trị (YCTD-123) |
| POST | /api/v1/auth/captcha | Công khai: cấp ảnh mã xác nhận mới (YCTD-123) |
| POST | /api/v1/auth/password-reset/request | Công khai: quên mật khẩu, yêu cầu mã đặt lại gửi qua tin nhắn; cần mã xác nhận (YCTD-123) |
| POST | /api/v1/auth/password-reset/confirm | Công khai: đặt mật khẩu mới bằng mã trong tin nhắn (YCTD-123) |

Thay bảng phần bếp ở mục 15 của `17_DAC_TA_API.md`:


|---|---|---|

Giao kèo thi trực tuyến cho học sinh (DT-23 phần 23a, YCTD-211, BR-237):

1. `POST /auth/login` nhận `channel` = `student`; tài khoản VT-21 chỉ vào kênh này và kênh này chỉ nhận VT-21 (sai trả 401 như sai mật khẩu). Nhóm `/student/*` chỉ nhận mã phiên kênh `student` (kênh khác trả 403), mã phiên kênh `student` chỉ gọi nhóm này (tuyến khác trả 403); học sinh không còn đang học, cấp bị tắt, chưa nối tài khoản trả 403; phân hệ ngoài gói trả 403 `MODULE_NOT_IN_PLAN`.
2. `POST /online-exams/assignments` nhận `exam_mode` (`at-school` mặc định theo trường, `remote` chỉ khi trường bật, nếu không 422), `exam_id`, `class_ids`, `child_ids`, `opens_at`, `closes_at`, `duration_minutes` (5 đến 300), `max_attempts` (1 đến 5), `attempt_policy`, `shuffle_questions`, `shuffle_options`, `variant_mode`, `fixed_variant_code`, `result_mode`, `fullscreen_required`, `max_violations` (0 đến 20), `violation_action`, `camera_enabled`, `camera_fallback`, `single_session_mode`, `term_type`, `score_kind`, `score_seq`, `true_false_rule`, `absent_policy`; đề chưa khoá, đề có tự luận mà nhiều lần, cấp bị tắt, giờ đóng đã qua trả 422 hoặc 400; lớp khác cấp, khối trả 400; giáo viên giao lớp không dạy trả 403.
3. `POST /student/exams/{id}/start` nhận `camera_state` (`off`, `granted`, `denied`, `unavailable`) và `room_code`: bài tại trường cần mã phòng đang mở có tên học sinh (sai, phòng đóng, hết hạn: 422 chi tiết `room_code`) và địa chỉ trong dải mạng của trường nếu trường khai (ngoài dải: 403 chi tiết `network`); bài từ xa không cần mã; đang có lượt dở thì trả lại lượt đó (phiên khác: 422 kèm chi tiết `session` = `replaced` hoặc đóng phiên cũ theo cấu hình); ngoài giờ, hết lượt, thiếu camera khi cấu hình chặn trả 422. Nội dung câu hỏi không có đáp án đúng, hướng dẫn chấm; `remaining_seconds` theo đồng hồ máy chủ.
4. `PUT /student/attempts/{id}/answers` nhận `answers` theo số câu (nhãn hiển thị A, B, C, D; đúng sai `Đ`, `S` từng ý; đáp số; tự luận), chỉ ghi đè câu gửi lên, nhận đến hạn nộp cộng 10 giây; đã nộp trả 422.
5. `POST /student/attempts/{id}/events` nhận tối đa 20 sự kiện (`fullscreen_exit`, `page_hidden`, `window_blur`, `camera_lost`, `no_face`, `multiple_faces`; `detail` chỉ `duration_ms`, `faces`) và trả `violations`, `outcome` (`none`, `warn`, `flag`, `auto_submit`); không nhận hình hay video.
6. `GET /student/attempts/{id}/result`: `visible` theo `result_mode`; đáp án đúng (`correct_answer`) chỉ có sau giờ đóng.

Giao kèo giám thị camera cho thi trực tuyến (DT-23 phần 23e, YCTD-215, BR-270):

1. `PUT /online-exams/school-settings` nhận thêm `allow_live_proctoring`, `allow_recording`, `recording_retention_days` (7 đến 90); thiếu trường thì giữ giá trị cũ. `POST /online-exams/assignments` nhận `proctor_live`, `proctor_record`: trường chưa bật thì 422 (chi tiết theo trường), bài tắt camera thì 400.
2. `POST /student/exams/{id}/start` nhận `proctor_notice` (đã đọc thông báo): bài có giám sát mà thiếu thì 422 chi tiết `proctor_notice`; học sinh dưới 16 tuổi hoặc chưa rõ ngày sinh thiếu đồng ý của loại đang bật thì 422 chi tiết `proctor_consent`.
3. `POST /online-exams/attempts/{id}/proctor/views` (200, trả `view_id`): bài bật xem trực tiếp, trường còn bật, lượt đang làm, camera đã bật, còn đồng ý (dưới 16 tuổi), dưới 60 phiên đang mở; ngoài ra 422; không phải người quản lý bài giao 403. `GET …/proctor/views/{viewId}/signals?after=` trả `ended` và các thông điệp `answer`, `ice` mới (tối đa 100); `POST` gửi `offer` hoặc `ice` (`payload` tối đa 24.000 ký tự); `DELETE` kết thúc và xoá thông điệp. Chỉ người mở phiên dùng được (người khác 404).
4. `GET /student/attempts/{id}/proctor?after=` trả `active`, `watching` (số phiên xem còn sống trong 30 giây), `active_view_ids`, `signals` (`offer`, `ice`), `cursor`; `POST …/proctor/signals` nhận `view_id`, `kind` (`answer`, `ice`), `payload`. Lượt của học sinh khác 404; đều tính vào giới hạn tần suất của học sinh.
5. `POST /student/attempts/{id}/recording/chunks` (nhiều phần, trường `chunk` tối đa 8 MB, `seq` từ 0 đến 1999): bài phải bật ghi hình và học sinh đã xác nhận thông báo, trường còn bật ghi hình, còn đồng ý (dưới 16 tuổi), lượt đang làm (nộp rồi 422); đoạn 0 phải là WebM; gửi lại cùng `seq` trả `stored: false`.
6. `GET /online-exams/attempts/{id}/recording`: video WebM ghép các đoạn đã giải mã (`cache-control: no-store, private`, `content-disposition: inline`); chỉ người giao bài và `P02.exam.manage` (người khác 403); không có đoạn chưa hết hạn thì 404; mỗi lần gọi ghi một dòng nhật ký người xem. `GET …/proctor` trả `notice_at`, `recording` (số đoạn, hạn), `can_watch_recording`, `views`.
7. `PUT /online-exams/proctor/consents` (`P02.exam.manage`; `child_id`, `scope`, `granted`, `guardian_name` bắt buộc khi đồng ý) và `GET/PUT /parent/exam-proctor-consents` (`child_id`, `scope`, `granted`; phụ huynh không phải của học sinh 403) trả tình trạng đồng ý (`live`, `record` hoặc null).



Giao kèo phần 10f (YCTD-79):

1. `POST /message-threads` nhận `child_id`, `content`, `guardian_user_id` (nhà trường chọn khi trẻ có nhiều phụ huynh dùng ứng dụng); trả `{ thread_id, message }`; luồng đã có thì dùng lại. Người ngoài luồng gọi tin nhắn trả `ERR_FORBIDDEN`.
2. `GET /message-threads` trả `child_name`, `class_name`, `guardian_name`, `last_message`, `last_message_at`, `my_side`, `unread_count`.
3. `POST /feedbacks` nhận `child_id` (phụ huynh) hoặc `org_unit_id` (nhân sự), `category`, `content`, `privacy_level`; góp ý ẩn danh trả người xử lý `submitter_name` "Ẩn danh", `submitted_by_user_id` và `child_id` rỗng. `handle` nhận `status` (`in_progress`, `resolved`), `handling_note` (bắt buộc khi `resolved`), `assigned_to_user_id`; góp ý đã xử lý trả mã P15-02.
4. `POST /polls` nhận `org_unit_id`, `poll_type`, `title`, `description`, `class_id`, `audience`, `start_at`, `end_at` (ISO 8601, kết thúc sau bắt đầu), `is_anonymous`, `options` (bình chọn, biểu quyết), `questions` hoặc `survey_template_id` (khảo sát). Mở khi thời gian kết thúc đã qua, mở bình chọn không ở trạng thái nháp, đóng bình chọn không đang mở trả mã BR-68.
5. `POST /polls/{id}/responses` nhận `option_id` (bình chọn, biểu quyết) hoặc `answers: [{ question_id, option_ids, text, number }]`; phiếu thứ hai trả mã BR-67; ngoài thời gian hoặc đã đóng trả mã BR-68; không là đối tượng trả `ERR_FORBIDDEN`; thiếu câu bắt buộc hoặc phương án không thuộc câu hỏi trả `ERR_VALIDATION`.
6. `GET /polls/{id}/results` trả `response_count`, `respondents` (chỉ người quản lý, bình chọn không ẩn danh), `questions[].options[].count`, `texts`, `average`; đối tượng gọi khi chưa công bố trả `ERR_FORBIDDEN`.
7. `POST /interaction-comments/{id}/moderate` nhận `action` (`hide`, `restore`, `note`) và `reason` bắt buộc; ẩn bình luận đã ẩn hoặc hiện lại bình luận đang hiện trả mã BR-66; không có điểm cuối xóa bình luận.
8. `POST /interaction-likes` nhận `target_type` (`poll`, `comment`), `target_id`; trả `{ liked, like_count }`.
9. `POST /lost-items` nhận `report_type` (`lost` mặc định, `found`), `child_id` (bắt buộc khi báo mất), `class_id` (đồ nhặt được không rõ trẻ), `description`, `noticed_on` (mặc định hôm nay, không sau hôm nay); phụ huynh chỉ báo mất cho con mình, đồ nhặt được chỉ người xử lý ghi. Phụ huynh gọi phiếu hoặc danh sách của trẻ không phải con mình trả `ERR_FORBIDDEN`.
10. `DELETE /lost-items/{id}` trả phiếu ở trạng thái `cancelled`; phiếu đã đóng trả mã BR-75; phiếu đã tìm thấy hoặc đã hủy trả mã P02-11.

Thay hai dòng có sẵn và thêm một dòng trong mục 17 của `17_DAC_TA_API.md`:


Giao kèo:

1. Việc trả `{ id, task_type: assigned | personal, title, description, org_unit_id, assigner_user_id, assigner_name, assignee_staff_id, assignee_name, due_date, priority: low | normal | high, status: todo | in_progress | done | cancelled, progress_percent, plan_item_id, completed_at, cancel_reason, overdue }`; chi tiết thêm `can_edit`, `can_update_progress`, `updates`.
2. Bảng tiến độ trả `{ rows: [{ staff_id, full_name, total, todo, in_progress, done, overdue, average_progress }], total, done, overdue, average_progress }`.
3. Kế hoạch trả `{ ..., status: draft | active | closed, item_count, done_count, progress_percent }`; chi tiết thêm `can_manage`, `items: [{ id, content, owner_staff_id, owner_name, due_date, task_id, task_status, progress_percent }]`. Kỳ: `period_type` month (`YYYY-MM`), term (`HK1|HK2|HE YYYY-YYYY`), year (`YYYY-YYYY`).
4. Phiếu đánh giá trả `{ id, staff_id, full_name, staff_code, period_type, period_value, total_score, comment, status: draft | published | superseded, replaces_id, reevaluation_reason, evaluated_by_name, published_at, scores: [{ criterion_id, criterion_code, criterion_name, weight, max_score, score, comment }] }`. Lập phiếu gửi `scores: [{ criterion_id, score, comment }]` đủ mọi chỉ số đang dùng.
5. Quá trình công tác trả `{ staff_id, can_manage, history: [{ id, org_unit_id, unit_name, department_name, job_title_name, from_date, to_date, note, is_main_unit }], certificates: [...] }`.
6. Khoản thưởng, khấu trừ trả `{ id, staff_id, full_name, staff_code, pay_item_type_id, kind: allowance | deduction, item_code, item_name, target_year, target_month, amount, basis, status: active | cancelled, cancel_reason, can_cancel }`. Phiếu lương có dòng `line_type` `bonus` hoặc `deduction`, mục `adjustment`, `code` là mã loại khoản.
7. Mã lỗi: `ERR_RULE_VIOLATION` kèm `P09-01` (người nhận nghỉ việc hoặc chưa có tài khoản; việc đã xong hoặc đã hủy), `P09-03` (kế hoạch không ở trạng thái phù hợp), `P09-04` (cập nhật tiến độ việc đã xong), `BR-47` (sửa phiếu đã công bố, đánh giá lại thiếu lý do, đơn vị chưa có chỉ số), `BR-45` (tháng đã trình duyệt bảng lương), `BR-90` (nhân sự đã chấm dứt hợp đồng); `ERR_CONFLICT` khi trùng mã chỉ số, đã có phiếu nháp của kỳ, mốc công tác đã có ngày kết thúc.

Thay hai dòng dự kiến `POST /fiscal-periods/{id}/request-close` và `/close` bằng các dòng trên (đề nghị chốt tạo dòng kỳ nên dùng `POST /fiscal-periods`). Bỏ dòng dự kiến `GET, POST /suppliers` của P06-07 vì nhà cung cấp đã có ở P13-07 (YCTD-77).

Giao kèo:

1. Khóa truy cập Fanpage và Zalo chỉ đọc từ biến môi trường `FACEBOOK_PAGE_ACCESS_TOKEN`, `ZALO_OA_ACCESS_TOKEN`; không có điểm cuối nào nhận hay trả khóa. `PUT /integrations/{connector}` từ chối mọi trường cấu hình ngoài `page_id`, `page_name` (facebook) hoặc `oa_id`, `oa_name` (zalo) bằng 400; bật mà thiếu mã trang hoặc mã Official Account là 400; kết nối khác hai giá trị trên là 404. Mọi lần lưu ghi nhật ký thao tác.
2. `FACEBOOK_PUBLISHER=development`, `ZALO_SENDER=development` dùng bộ giả lập; không đặt và không có khóa thì `provider` là `none`, `credentials_configured` là false.
3. Đăng Fanpage: người không có `P14.facebook.manage` ở đơn vị nào 403; chưa bật Fanpage hoặc máy chủ chưa có khóa 422 `P14-08`; nội dung không thuộc phạm vi đơn vị của người đăng 403; nội dung chưa công bố hoặc đã ẩn 422 `BR-64`; tin tức phạm vi lớp hoặc trẻ 422 `P14-08`; đã đăng 409. Facebook lỗi thì trả 201 với `status = failed`, `last_error`; thử lại chỉ cho bài `failed` (khác là 409), trả 200, tăng `attempt_count`.
4. Hình kèm bài: hình của hoạt động có bất kỳ trẻ được gắn thẻ chưa đồng ý (`photo_consent` khác `granted`) bị loại, số hình bị loại ở `excluded_photo_count`; xét lúc đăng hoặc thử lại.
5. Liên kết Zalo: số điện thoại 10 chữ số bắt đầu bằng 0 và phải là số của một phụ huynh trong năm học (không thì 422 `G3-08`); số hoặc mã Zalo đã liên kết thì 409.
6. Tiến trình gửi thông báo: người nhận kênh `zalo` gửi qua Zalo khi Zalo bật, máy chủ có khóa và số điện thoại đã liên kết; còn lại hoặc Zalo lỗi thì gửi tin nhắn. Tin Zalo và tin nhắn tính chung giới hạn 5 tin mỗi ngày; `delivered_via` ghi kênh thực tế.
7. Nhắc nợ thêm người nhận kênh `zalo` cho mỗi phụ huynh khi Zalo đang bật lúc gửi nhắc.

Thay bốn dòng P18 hiện có trong `17` bằng:


Giao kèo sổ kế toán (YCTD-88):

1. Xem: người có `P06.ledger.view` hoặc `P06.ledger.manage`; phạm vi theo đơn vị được gán, gán ở Trường chính là toàn trường. `org_unit_id` ngoài phạm vi trả `ERR_FORBIDDEN`; bỏ trống là mọi đơn vị trong phạm vi. `from`, `to` bắt buộc dạng YYYY-MM-DD, from không sau to (`ERR_VALIDATION`). Mỗi lần xem sổ, báo cáo, xuất Excel thì ghi sổ chứng từ chưa ghi trước.
2. `POST /ledger/accounts` nhận `parent_id`, `code`, `name`: chỉ người quản lý sổ ở Trường chính (`ERR_FORBIDDEN`); số hiệu sai dạng `ERR_VALIDATION`; không bắt đầu bằng số hiệu cha, tài khoản cha ngừng dùng `ERR_RULE_VIOLATION` mã P06-12; trùng số hiệu `ERR_CONFLICT`. `PATCH` nhận `name`, `status`; tài khoản theo chế độ, ngừng dùng khi còn tài khoản chi tiết đang dùng hoặc đang trong quy tắc trả `ERR_RULE_VIOLATION` mã P06-12.
3. `PUT /ledger/posting-rules` nhận `document_type`, `category_id` (chỉ loại chứng từ theo khoản mục), `debit_account_id`, `credit_account_id`: phía tiền của quỹ phải để trống, phía còn lại bắt buộc, hai phía khác nhau, tài khoản đang dùng (`ERR_VALIDATION`); quy tắc `money_cash`, `money_bank` chỉ khai báo phía Nợ. Có rồi thì thay, chưa có thì thêm. `DELETE` quy tắc chung trả `ERR_RULE_VIOLATION` mã P06-12.
4. `POST /ledger/post-documents`: người có `P06.ledger.manage` ở bất kỳ đơn vị nào; ghi cho toàn trường; trả `{ posted: { receipt, payment, receipt_reversal, payment_reversal, invoice, discount, invoice_adjustment, payroll, settlement }, total }`; chạy lại trả `total` 0.
5. `POST /ledger/entries` nhận `org_unit_id`, `entry_date`, `description`, `lines` (2–50 dòng `account_id`, `debit`, `credit`, `description`), `request_key` tùy chọn: ngoài phạm vi quản lý `ERR_FORBIDDEN`; dòng sai, tổng Nợ khác tổng Có, ngày sau hôm nay, ngày ngoài năm học, tài khoản ngừng dùng `ERR_VALIDATION`; ngày thuộc kỳ đã chốt `ERR_RULE_VIOLATION` mã BR-95; gửi lại cùng `request_key` trả bút toán đã ghi. `POST /ledger/entries/{id}/void` nhận `reason` bắt buộc; bút toán tự động, số dư đầu năm hoặc đã hủy `ERR_CONFLICT`; kỳ đã chốt BR-95.
6. Bảng cân đối trả `accounts` (account_code, account_name, level, opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit), `totals` và `balanced`. Sổ cái trả `account`, `lines` (entry_date, code, description, source_code, account_code, counterpart_accounts, debit, credit, balance_debit, balance_credit), `totals`. Sổ nhật ký chung trả `entries` (kèm `lines`), `lines` phẳng để xuất và `totals`.

Giao kèo của nhóm điểm cuối nhập sao kê và cổng thanh toán (DT-11 phần 11d, YCTD-89):

1. `GET /bank-statement-profiles/{accountId}` cần `P06.bank-statement.import` hoặc quyền xem đối chiếu ngân hàng ở đơn vị của tài khoản; trả `account_id`, `profile` (trống khi chưa cấu hình). `PUT` nhận `header_row` (mặc định 1), `date_column`, `date_format` (`dmy` mặc định, `ymd`, `mdy`), `amount_mode` (`signed` cần `amount_column`; `split` cần `credit_column`, `debit_column`), `description_column`, `reference_column` (tùy chọn); tên cột tối đa 100 ký tự; cần `P06.bank-statement.import`. Quỹ tiền mặt trả `ERR_VALIDATION`.
2. `POST /bank-statement-imports` dạng `multipart/form-data` nhận `account_id`, `file` (xlsx hoặc CSV UTF-8, tối đa 5 MB, 2 000 dòng); cần `P06.bank-statement.import`. Chưa có cấu hình trả `ERR_RULE_VIOLATION` mã P06-06; thiếu cột ở dòng tiêu đề, tệp không đọc được, tệp không có dòng trả `ERR_VALIDATION`. Trả 201 với bản ghi lần nhập (`total_rows`, `imported_count`, `duplicate_count`, `error_count`, `errors` gồm `row`, `column`, `message`, `duplicates`, `auto_matched_count`, `suggested_count`) và `lines` (các dòng vừa ghi sau đối soát). `GET /bank-statement-imports?account_id=` trả các lần nhập mới nhất trước.
3. `POST /bank-transactions/{id}/create-receipt` nhận `category_id` (khoản mục thu đang dùng), `invoice_id` (tùy chọn, mặc định hóa đơn đề xuất), `payer_name` (tùy chọn); cần `P06.bank-transaction.manage` ở đơn vị của dòng và `P06.receipt.manage` ở đơn vị của hóa đơn. Dòng đã khớp trả `ERR_CONFLICT`; dòng tiền ra, dòng không có đề xuất mà không chọn hóa đơn trả `ERR_VALIDATION`; hóa đơn chưa phát hành, đã thu đủ hoặc số tiền dòng nhỏ hơn số còn nợ trả `ERR_RULE_VIOLATION` mã BR-31; ngày thuộc kỳ đã chốt trả mã P06-09. Trả 201 `line` (đã khớp), `receipt` (`id`, `code`, `amount`).
4. `POST /bank-transactions/{id}/dismiss-suggestion` cần `P06.bank-transaction.manage`; dòng không có đề xuất trả `ERR_CONFLICT`.
5. `POST /bank-transactions/auto-match` (YCTD-82) dùng số ngày `bank_match_days` của đơn vị, ưu tiên mã chứng từ, trả thêm `suggested_count`. `POST /bank-transactions` tính đề xuất cho dòng vừa gõ.
6. `GET /payment-providers` cần quyền xem thanh toán trực tuyến; trả `code`, `label`, `supports_webhook`, `requires_bank_bin`, `is_default`. `PUT /cash-accounts/{id}/payment-provider` nhận `payment_provider` (trống là cổng mặc định; mã chưa bật trả `ERR_VALIDATION`), `bank_bin` (6 chữ số; bắt buộc khi cổng cần); cần `P06.cash-account.manage` ở đơn vị của tài khoản; chỉ tài khoản ngân hàng. `GET /invoices/{id}/payment-qr` dùng cổng của tài khoản nhận, trả thêm `provider`; cổng của tài khoản chưa bật trên máy chủ trả mã P06-11. `POST /payment-webhooks/development` có khi cổng `development` được bật (không cần là cổng mặc định).

Giao kèo của nhóm điểm cuối tuyển sinh (DT-11 phần 11a, YCTD-86):

1. `GET /admission-campaigns`, `GET /admission-posts`, `GET /admission-applications`, `GET /admission-applications/{id}` cần một trong `P16.admission-campaign.manage`, `P16.application.manage`, `P16.application.review`, `P16.admission-post.manage`; chỉ trả bản ghi của đơn vị trong phạm vi. Đợt trả thêm `org_unit_name`, `application_count`, `passed_count` (đạt và đã chuyển), `converted_count`. Danh sách hồ sơ tối đa 500 dòng mới nhất, mỗi dòng `id`, `code`, `campaign_id`, `campaign_name`, `org_unit_id`, `source`, `child_full_name`, `child_dob`, `child_gender`, `guardian_full_name`, `guardian_phone`, `status`, `reject_reason`, `created_child_id`, `child_status`, `created_at`. Chi tiết không trả số định danh dạng mã hóa, trả `child_national_id_masked`, `guardian_relationship`, `planned_class_name`, `child_status`.
2. `POST /admission-campaigns` nhận `org_unit_id`, `name` (tối đa 200), `description`, `quota` (1 đến 10.000), `open_from`, `open_to` (không trước `open_from`); cần `P16.admission-campaign.manage` ở đơn vị; đơn vị ngừng dùng trả `ERR_VALIDATION`. `PATCH` nhận cùng trường trừ `org_unit_id`; đợt đã đóng hoặc chỉ tiêu nhỏ hơn số đạt trả `ERR_RULE_VIOLATION` mã P16-01. `open` chỉ với đợt nháp có hạn chưa qua; `close` chỉ với đợt đang mở; sai trả mã P16-01.
3. `POST /admission-posts` nhận `campaign_id`, `title` (tối đa 200), `content` (tối đa 10.000), `publish_from`, `publish_to` (tùy chọn, mặc định hạn nhận hồ sơ của đợt); cần `P16.admission-post.manage`. Đợt đã đóng trả `ERR_RULE_VIOLATION` mã P16-05. `publish` với tin chưa đăng; `hide` nhận `reason` bắt buộc với tin đang đăng.
4. `POST /public/admission-applications` không cần mã phiên; nhận `campaign_id`, `child_full_name` (tối đa 100), `child_dob`, `child_gender` (`male`, `female`), `child_has_allergies` (bắt buộc), `child_allergies` (bắt buộc khi có dị ứng), `child_national_id` (tùy chọn, 12 chữ số), `guardian_full_name`, `guardian_phone` (10 chữ số bắt đầu bằng 0), `guardian_email`, `guardian_relationship_item_id`, `address`, `note`. Đợt không mở hoặc ngoài thời gian nhận trả `ERR_RULE_VIOLATION` mã P16-02; trùng hồ sơ trả `ERR_CONFLICT`. Trả 201 `code`, `status`, `status_label`, `campaign_name`, `child_full_name`, `message`. `POST /admission-applications` (nhân viên) nhận cùng trường, `child_has_allergies` không bắt buộc ở bước đọc nhưng thiếu trả mã BR-06; cần `P16.application.manage` ở đơn vị của đợt; hồ sơ ở trạng thái `received`.
5. `GET /public/admissions` trả `campaigns` (đợt đang mở và hôm nay trong khoảng nhận hồ sơ: `id`, `name`, `description`, `quota`, `open_from`, `open_to`, `application_deadline`, `org_unit_name`, `org_unit_address`, `posts` gồm `id`, `title`, `content`, `publish_from`, `publish_to`, `published_at`, `deadline`) và `relationships` (`id`, `name`). `GET /public/admission-applications/lookup` nhận `code` (dạng TS-000001) và `phone`; không khớp trả `ERR_NOT_FOUND`; trả `code`, `child_full_name`, `campaign_name`, `status`, `status_label`, `reject_reason` (chỉ khi không đạt), `submitted_at`. Mỗi địa chỉ mạng nộp tối đa 10 hồ sơ mỗi giờ, đọc và tra cứu tối đa 60 yêu cầu mỗi phút; vượt trả `ERR_RATE_LIMIT`.
6. `PATCH /admission-applications/{id}` nhận đầy đủ trường như khi nộp trừ `campaign_id`; chỉ hồ sơ `submitted` hoặc `received`, khác trả mã P16-02. `receive` chỉ hồ sơ `submitted`; chưa khai báo dị ứng trả mã BR-06. `approve` cần `P16.application.review`, nhận `note`, `planned_class_id` (tùy chọn); chỉ hồ sơ `received`, đủ chỉ tiêu trả mã P16-03. `reject` cần `P16.application.review`, nhận `reason` bắt buộc; chỉ hồ sơ `submitted` hoặc `received`.
7. `POST /admission-applications/{id}/convert` cần `P16.application.manage` ở đơn vị của đợt và `P02.child.manage` ở đơn vị của lớp; nhận `class_id`, `birth_certificate_file_id` (tệp mục đích `birth_certificate` của đơn vị lớp), `national_id` (bắt buộc khi hồ sơ chưa có), `relationship_item_id` (bắt buộc khi hồ sơ chưa có), `has_allergies` (tùy chọn), `confirm_possible_duplicate`, `confirm_over_capacity`. Hồ sơ không ở trạng thái `passed` trả `ERR_RULE_VIOLATION` mã P16-04; lớp không thuộc đơn vị của đợt trả `ERR_VALIDATION`; lỗi của hồ sơ trẻ (trùng số định danh `ERR_CONFLICT`, nghi trùng mã QT-01, vượt sĩ số mã BR-04) trả nguyên. Trả `application`, `child` (`id`, `full_name`, `status` là `active` khi người chuyển có `P02.approve` ở đơn vị lớp, ngược lại `pending`; `current_class`, `guardians`) và `approval_error`.

Giao kèo của nhóm điểm cuối tuyển dụng (DT-11 phần 11b, YCTD-87):

1. `POST /recruitment-requests` nhận `org_unit_id` (trống khi chỉ có một đơn vị trong phạm vi), `position`, `quantity` (1 đến 1000), `requirements`, `reason`, `needed_by` (không bắt buộc, không trước hôm nay); cần `P18.recruitment-request.create`. `approve`, `reject` (nhận `reason` bắt buộc) cần `P18.recruitment-request.approve` trong phạm vi đơn vị, người lập không tự duyệt (`ERR_FORBIDDEN`), đề nghị không chờ duyệt trả mã BR-80. `close` nhận `reason`, cần là người lập hoặc có `P18.recruitment.manage`. Kết quả có `code`, `unit_name`, `hired_count`, `approver_name`, `reject_reason`, `close_reason`.
2. `POST /job-postings` nhận `request_id`, `title`, `description`, `requirements`, `deadline`; `PUT` nhận bốn trường cuối; cần `P18.recruitment.manage` trong đơn vị của đề nghị; đề nghị chưa duyệt trả mã BR-80; tin đã đóng không sửa (BR-75); `publish` chỉ từ tin đang soạn (BR-69). Kết quả có `request_code`, `position`, `quantity`, `unit_name`, `candidate_count`, `is_open`. Danh sách cần một trong `P18.recruitment.manage`, `P18.interview.manage`, `P18.recruitment-request.approve`.
3. Điểm cuối `/public/job-posts` không cần mã phiên; mỗi địa chỉ mạng 120 lần xem mỗi phút, 10 lần nộp mỗi 10 phút, vượt trả `ERR_RATE_LIMIT` (429). Tin trả `id`, `title`, `description`, `requirements`, `deadline`, `published_at`, `position`, `quantity`, `unit_name`, `org_unit_id`. Tin không công bố hoặc hết hạn trả `ERR_NOT_FOUND`. `POST .../applications` là biểu mẫu nhiều phần: `full_name`, `phone` bắt buộc, `email`, `dob`, `gender`, `address`, `cover_letter`, `source` (`website`, `referral`, `job_board`, `social_media`, `other`), `consent` phải là `true`, tệp ở trường `cv` (ảnh JPEG, PNG hoặc PDF, tối đa 10 MB) bắt buộc; trùng số điện thoại trong tin trả `ERR_CONFLICT`; kết quả chỉ có `message`.
4. `GET /candidates` lọc `posting_id`, `status`, `org_unit_id`; trả `full_name`, `posting_title`, `source`, `status`, `has_cv`, `staff_id`, không trả liên hệ. `GET /candidates/{id}` trả đủ liên hệ, `cv_file_name`, `staff_code`, `can_manage`, `can_interview`, `interviews` (kèm `interviewers` gồm `staff_id`, `full_name`) và ghi nhật ký truy cập phạm vi `candidate_profile`; `GET /candidates/{id}/cv` ghi phạm vi `candidate_cv`. Đọc cần `P18.recruitment.manage` hoặc `P18.interview.manage` trong phạm vi đơn vị của tin.
5. `POST /candidates` nhận `posting_id` (tin đã công bố hoặc đã đóng), `full_name`, `phone`, `email`, `dob`, `gender`, `address`, `source` (thêm `walk_in`), `note`; `POST /candidates/{id}/cv` nhận tệp ở trường `cv`; `POST /candidates/{id}/status` nhận `status` (`screening`, `rejected`, `withdrawn`) và `reason` (bắt buộc trừ `screening`); chuyển không hợp lệ trả mã BR-75. Cần `P18.recruitment.manage`.
6. `POST /candidates/{id}/interviews` nhận `scheduled_at` (ISO 8601), `location`, `interviewer_staff_ids` (1 đến 10 hồ sơ nhân sự đang làm); `POST /interviews/{id}/result` nhận `result` (`passed`, `failed`), `score` (0 đến 10, không bắt buộc), `evaluation`; `cancel` nhận `reason`; `POST /candidates/{id}/decision` nhận `result` (`hired`, `rejected`) và `note` (bắt buộc khi không tuyển); còn lịch chờ, chưa có kết quả hoặc lần gần nhất không đạt mà quyết định tuyển trả mã BR-80. Cần `P18.interview.manage`.
7. `POST /candidates/{id}/staff` nhận `code`, `start_date`, `department_id`, `job_title_id`; cần `P18.recruitment.manage` và `P07.staff.manage`; ứng viên chưa tuyển, đã có hồ sơ hoặc số điện thoại đã có hồ sơ nhân sự trả mã BR-37; mã nhân sự trùng trả `ERR_CONFLICT`.

Giao kèo của nhóm điểm cuối tài chính giai đoạn 2 (DT-10 phần 10i, YCTD-82):

1. `GET /debts/reminders` nhận `org_unit_id` (bắt buộc), `class_id`, `milestone` (số ngày), `due_only=true`; cần `P05.debt-reminder.manage` hoặc `P05.debt.view` ở đơn vị. Trả `milestones`, `rows` (`invoice_id`, `invoice_code`, `period`, `child_id`, `child_name`, `class_name`, `due_date`, `outstanding_amount`, `overdue_days`, `milestone_days`, `last_reminder_milestone`, `last_reminded_at`, `needs_reminder`), `totals`.
2. `POST /debts/reminders/send` nhận `org_unit_id`, `invoice_ids` (1 đến 500); cần `P05.debt-reminder.manage`. Trả `sent_count`, `skipped` (`invoice_id`, `reason`). Gửi thông báo mẫu `debt_reminder` trong ứng dụng cho phụ huynh.
3. `POST /debt-resolutions` nhận `child_id`, `invoice_id` (tùy chọn), `proposal`; cần `P05.overdue-debt.propose`. Trẻ hoặc hóa đơn không có nợ quá hạn trả `ERR_RULE_VIOLATION` mã BR-33; trẻ đã có đề xuất đang chờ trả `ERR_CONFLICT`. `POST /debt-resolutions/{id}/decide` nhận `decision`; cần `P05.overdue-debt.decide` (thiếu trả `ERR_FORBIDDEN`); đã quyết định trả `ERR_CONFLICT`. `GET /debt-resolutions` lọc `org_unit_id`, `child_id`, `status` (`pending`, `decided`).
4. `POST /bank-transactions` nhận `account_id` (tài khoản ngân hàng, quỹ tiền mặt trả `ERR_VALIDATION`), `transaction_date`, `amount` (số nguyên khác 0), `description`, `bank_reference`; cần `P06.bank-transaction.manage`. `POST /bank-transactions/{id}/match` nhận `account_transaction_id`; khác tài khoản hoặc số tiền trả mã BR-34; giao dịch đã khớp dòng khác hoặc dòng đã khớp trả `ERR_CONFLICT`. Xóa dòng đã khớp trả mã BR-34. `POST /bank-transactions/auto-match` nhận `account_id`, `from`, `to`; trả bảng đối chiếu kèm `auto_matched_count`. `GET /bank-reconciliation` nhận `account_id`, `from`, `to`; trả `book_opening_balance`, `book_movement`, `book_closing_balance`, `statement_movement`, `difference`, `matched_count`, `unmatched_book`, `unmatched_statement`, `book`, `statement`.
5. `POST /payables` nhận `source_type` (`manual` mặc định, `purchase_order`, `medicine_purchase_order`), `source_id` (khi không lập tay), `due_date`; lập tay thêm `org_unit_id`, `supplier_id` hoặc `payee_name`, `document_ref`, `description`, `amount`, `document_date`. Cần `P06.payable.manage`. Chứng từ đã ghi trả `ERR_CONFLICT`; phiếu mua hàng đã thanh toán trả mã P06-07. `GET /payables` lọc `org_unit_id`, `status` (`open`, `paid`, `cancelled`), `supplier_id`, `overdue_only`; trả `rows` (kèm `overdue_days`, `payment_code`), `payees`, `totals`. `POST /payables/{id}/pay` nhận `payment_id`: phiếu chi chưa phát hành, khác đơn vị hoặc khác số tiền trả mã BR-28; phiếu chi đã dùng trả `ERR_CONFLICT`; công nợ không còn chưa trả trả mã P06-07. `POST /payables/{id}/cancel` nhận `reason`.
6. `GET /fiscal-periods?org_unit_id=` trả từng tháng của năm học đang mở: `period`, `id`, `status` (`open`, `pending`, `closed`, `rejected`), `ended`, `can_request`, `summary`, `request_note`, `reject_reason`. `POST /fiscal-periods` nhận `org_unit_id`, `period` (YYYY-MM), `note`; cần `P06.period-close.request`; tháng chưa kết thúc hoặc còn chứng từ chờ duyệt, hóa đơn nháp trả `ERR_RULE_VIOLATION` mã P06-09 (`details` là `draft_invoices`, `discounts`, `invoice_adjustments`, `receipt_reversals`, `payment_reversals`); đang chờ hoặc đã chốt trả `ERR_CONFLICT`. `POST /fiscal-periods/{id}/close` cần `P06.period-close.approve`; người đề nghị tự duyệt trả mã BR-77. `POST /fiscal-periods/{id}/reject` nhận `reason`.
7. Thao tác ghi chạm kỳ tài chính đã chốt của đơn vị trả `ERR_RULE_VIOLATION` mã P06-09: `POST /receipts` có `receipt_date` thuộc kỳ, duyệt phiếu chi khi ngày phát hành thuộc kỳ, `POST /receipts/{id}/reverse` và `/payments/{id}/reverse` (cả duyệt) với phiếu có ngày thuộc kỳ, `POST /fee-calculations`, `/invoices/issue`, `/invoices/supplementary` của kỳ, miễn giảm, chép miễn giảm, phiếu điều chỉnh và duyệt của hóa đơn kỳ, dòng sao kê và công nợ phải trả có ngày thuộc kỳ.

Giao kèo của báo cáo hoạt động, báo cáo hợp nhất và xuất dữ liệu (DT-10 phần 10j, YCTD-83):

1. `GET /reports/activities` cần `P17.report.operations`; nhận `from`, `to` (bắt buộc, tối đa 366 ngày, quá trả `ERR_VALIDATION`), `org_unit_id`, `class_id` (tùy chọn); đơn vị hoặc lớp ngoài phạm vi trả `ERR_FORBIDDEN`. Trả `from`, `to`, `org_unit_ids`, `class_id`, `sections` (mảng `code`, `title`, `columns` gồm `key`, `label`, `rows`). Mục có sẵn: `attendance` (`children_count`, `present`, `absent_notified`, `absent_unnotified`, `total`, `rate_percent`), `journals` (`published_count`, `draft_count`, `amendment_count`, `present`, `coverage_percent`), `health` (`medical_event_count`, `severe_event_count`, `daily_care_count`), `medication` (`request_count`, `given_count`, `skipped_count`) theo lớp kèm `org_unit_name`, `class_name`; `notifications` (`org_unit_name`, `notification_count`, `sms_sent_count`, `sms_failed_count`) theo đơn vị. Phần hoạt động (P14) và công việc (P09) thêm mục mới cùng định dạng.
2. `GET /reports/consolidated` cần `P17.report.consolidated`; nhận `month` (`YYYY-MM`) và `org_unit_ids` (mã cách nhau dấu phẩy, trống là mọi đơn vị trong phạm vi); mã sai định dạng trả `ERR_VALIDATION`, đơn vị ngoài phạm vi trả `ERR_FORBIDDEN`. Trả `month`, `units` (mỗi dòng `org_unit_id`, `org_unit_code`, `org_unit_name`, `unit_type`, `children_count`, `classes_count`, `staff_count`, `attendance_present_count`, `attendance_record_count`, `attendance_rate_percent`, `tuition_payable_amount`, `tuition_paid_amount`, `tuition_outstanding_amount`, `tuition_collection_percent`, `debt_outstanding_amount`, `debt_overdue_amount`, `income_amount`, `expense_amount`, `difference_amount`) và `totals` (tổng các cột số, tỷ lệ tính lại từ tổng). Không có trường dữ liệu cá nhân.
3. `POST /reports/{code}/export` cần `P17.data.export` và quyền xem của báo cáo `code` trong phạm vi; `code` là `tuition`, `debts`, `cash-flow`, `attendance`, `staff-attendance`, `saturday-classes`, `consolidated`, khác trả `ERR_NOT_FOUND`. Thân là bộ lọc cùng tên trường với chuỗi truy vấn của báo cáo (mảng được nối bằng dấu phẩy); bộ lọc sai trả `ERR_VALIDATION`. Từ YCTD-394 thân nhận thêm `school_level` tùy chọn (mã cấp hoặc `all`, như tham số cấp dùng chung): tên trang và nhãn cột có chữ người học ghi theo thuật ngữ của cấp đó ("Theo trẻ" hay "Theo học sinh"), không gửi thì theo các cấp người dùng được xem; mã sai trả `ERR_VALIDATION`, cấp chưa bật hoặc ngoài phạm vi trả `ERR_FORBIDDEN`; số liệu không lọc theo tham số này. Thành công trả `200` nội dung `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, tiêu đề `content-disposition: attachment; filename="bao-cao-{code}-{YYYYMMDD-HHmm}.xlsx"` và `x-export-log-id`. Mỗi lần thành công ghi một dòng `export_logs`; lần bị từ chối không ghi.
4. `GET /reports/export-logs` cần `P17.data.export`; nhận `from`, `to`; người có phạm vi toàn trường theo quyền xuất thấy mọi dòng, người khác chỉ thấy dòng của mình; mỗi dòng `id`, `user_id`, `actor_name`, `report_code`, `filters_data`, `org_unit_ids`, `row_count`, `contains_personal_data`, `file_name`, `exported_at`; tối đa 500 dòng mới nhất.

Giao kèo của nhóm điểm cuối giảng dạy (DT-10 phần 10g, YCTD-80):

1. `GET /lesson-domains`, `/lesson-groups`, `/themes`, `/lessons` cho mọi nhân sự (không tính vai trò phụ huynh) trong phạm vi đơn vị, trả bản ghi của đơn vị trong phạm vi và của Trường chính; phụ huynh trả `ERR_FORBIDDEN`. Lọc `org_unit_id`, `status` (mặc định bài học `active`); nhóm lọc thêm `domain_id`; bài học lọc `theme_id`, `domain_id`, `lesson_group_id`, `age_group`, `mine=true`. Người chỉ có vai trò giáo viên thấy bài học của mình và bài học `is_shared`.
2. `POST /lesson-domains` nhận `org_unit_id`, `name`, `order_no`; `POST /lesson-groups` nhận `domain_id`, `name`, `order_no` (đơn vị lấy theo lĩnh vực; lĩnh vực ngừng dùng trả mã BR-75); `POST /themes` nhận `org_unit_id`, `name`, `age_group`, `start_date`, `end_date`. Cần `P03.curriculum.manage` ở đơn vị; trùng tên trả `ERR_CONFLICT`. `PATCH` nhận `name`, `order_no` (chủ đề nhận `start_date`, `end_date`, `age_group`), `status`.
3. `POST /lessons` nhận `org_unit_id` (bỏ trống thì lấy đơn vị đầu tiên trong phạm vi `P03.lesson.manage`), `name`, `objectives`, `materials`, `age_group`, `theme_id`, `domain_id`, `lesson_group_id`, `is_shared`; cần `P03.lesson.manage` ở đơn vị. Tham chiếu không đang dùng hoặc khác đơn vị, nhóm khác lĩnh vực trả `ERR_VALIDATION`. `PATCH /lessons/{id}` chỉ người soạn, nhận thêm `status`.
4. `POST /lesson-plans` nhận `lesson_id`, `class_id`, `planned_date`, `activities`, `duration_minutes` (5–480), `materials`; cần `P03.lesson.manage` và phân công đang hiệu lực ở lớp, nếu không trả `ERR_FORBIDDEN`; bài học ngừng dùng, khác đơn vị, hoặc riêng của người khác trả `ERR_VALIDATION`. `PATCH` chỉ người soạn khi nháp hoặc bị trả lại (khác trả mã P03-02). `submit` chỉ người soạn từ nháp hoặc bị trả lại.
5. `approve` (`comment` tùy chọn), `reject` (`comment` bắt buộc) cần `P03.lesson-plan.review`: vai trò VT-03 có quyền ở đơn vị của giáo án là bước quản lý (từ `submitted` hoặc `leader_approved`, duyệt thành `approved`); vai trò VT-17 là bước tổ trưởng (chỉ từ `submitted`, duyệt thành `leader_approved`); ngoài phạm vi trả `ERR_FORBIDDEN`; tự duyệt hoặc sai trạng thái trả mã P03-02.
6. `GET /lesson-plans?view=mine` giáo án của người gọi; `view=review` giáo án của người khác chờ người gọi duyệt theo bước; không có `view` thì bắt buộc `class_id` và người gọi xem được lớp (nhân sự văn phòng hoặc tổ trưởng ở đơn vị của lớp, giáo viên được phân công). Lọc thêm `from`, `to`, `status`. `GET /lesson-plans/{id}` có `lesson`, `class_name`, `reviews`.
7. `PUT /classes/{id}/timetable` nhận `effective_from` (thứ Hai, không trước tuần hiện tại), `slots` (tối đa 100 dòng `weekday`, `period_no`, `start_time`, `end_time`, `activity_name`, `teacher_id`); cần `P03.curriculum.manage` ở đơn vị hoặc chủ nhiệm lớp. Trùng tiết, trùng giờ trong lớp, giáo viên trùng giờ ở lớp khác, tuần đã qua, phiên bản đã công bố trả mã P03-04. `GET` nhận `week` (mặc định hôm nay), trả `effective_from`, `status`, `slots`, `versions` (chỉ nhân sự). `publish` nhận `effective_from`; không có bản nháp trả mã P03-04; phụ huynh của lớp nhận thông báo.
8. `POST /classes/{id}/activity-schedules` nhận `activity_date` (không trước hôm nay), `start_time`, `end_time`, `activity_name`, `note`; trùng giờ trả mã P03-07. `publish` nhận `from`, `to`. `PATCH /class-activity-schedules/{id}` sửa khi nháp hoặc `status=cancelled`. `GET` nhận `from` (mặc định hôm nay), `to` (mặc định 7 ngày); nhân sự thấy nháp và đã công bố, phụ huynh có con trong lớp chỉ thấy đã công bố.
9. `POST /teaching-plans` nhận `class_id`, `period_type`, `period_value`, `objectives`, `content`; trùng kỳ trả `ERR_CONFLICT`. `PATCH` nhận `objectives`, `content`, `progress_note`, `status`. `GET /teaching-plans?class_id=` cho người xem được lớp.
10. `POST /children/{id}/progress` nhận `period_type` (`term`, `month`), `period_value`, `items` (1–50 dòng `indicator_code`, `level`, `comment`, `domain_id`); cần `P03.progress.record` và phân công lớp hiện tại của trẻ; kỳ đã công bố trả mã P03-06. `publish` nhận kỳ; không có chỉ số chưa công bố trả mã P03-06. `GET` nhận kỳ tùy chọn; phụ huynh chỉ thấy chỉ số đã công bố; nhân sự theo phạm vi xem trẻ.
11. `GET /children/{id}/learning` cho phụ huynh của trẻ (hoặc nhân sự xem được trẻ): `class_id`, `class_name`, `timetable` đã công bố của tuần, `activities` đã công bố 14 ngày tới, `progress`.

Giao kèo của nhóm điểm cuối hoạt động, nội dung và ngoại khóa (DT-10 phần 10e, YCTD-78):

1. `POST /activities` nhận `class_id`, `category_id` (danh mục đang dùng của đơn vị của lớp hoặc Trường chính), `title` (tối đa 200 ký tự), `content` (tối đa 5 000 ký tự), `activity_date`, `draft` (tùy chọn, mặc định sai); cần `P14.activity.create` và đang được phân công lớp, nếu không trả `ERR_FORBIDDEN`. Kết quả `status` `pending` (hoặc `draft`).
2. `GET /activities` trả hoạt động mà người gọi được xem: người có `P14.activity.approve` hoặc `P14.content.manage` (vai trò văn phòng) theo đơn vị, giáo viên theo lớp được phân công (mọi trạng thái), phụ huynh chỉ hoạt động `published` của lớp con; lọc `class_id`, `child_id`, `status`, `org_unit_id`. Mỗi dòng có `class_name`, `category_name`, `media` (`id`, `caption`, `file_name`, `child_ids`, `unconsented_children`, `excluded`; phụ huynh chỉ nhận ảnh không bị loại trừ, không kèm thẻ trẻ), `like_count`, `liked_by_me`, `comment_count`. `GET /activities/{id}` cùng quy tắc, không có quyền trả `ERR_FORBIDDEN`.
3. `PATCH /activities/{id}` nhận các trường của mục 1 trừ `class_id`; chỉ người tạo được phân công lớp; hoạt động đã công bố hoặc đã ẩn trả mã BR-64. `submit`, `approve`, `reject` (`reason` bắt buộc), `hide` (`reason` bắt buộc), `republish` kiểm tra trạng thái nguồn, sai trả mã BR-64; người duyệt không có phạm vi trả `ERR_FORBIDDEN`.
4. `POST /activities/{id}/media` là biểu mẫu nhiều phần gồm `file` (JPEG, PNG tối đa 10 MB), `child_ids` (mã trẻ cách nhau bởi dấu phẩy, phải đang học trong lớp của hoạt động), `caption`; quá 30 ảnh trả mã Q-71. Kết quả `{ media, warnings }`, `warnings` gồm `child_id` và câu báo cho từng trẻ chưa đồng ý hình ảnh.
5. `GET /activity-media/{id}/file` cho nhân sự xem được hoạt động; phụ huynh chỉ khi hoạt động đã công bố và mọi trẻ được gắn thẻ đang đồng ý, nếu không trả mã BR-65.
6. Bình luận: `POST /content-comments` nhận `target_type`, `target_id`, `content` (tối đa 1 000 ký tự); `POST /activities/{id}/comments` nhận `content`. Đối tượng chưa công bố trả mã BR-64. `GET` trả bình luận theo thời gian; người quản lý thấy cả bình luận ẩn kèm `hidden_reason`. `POST /comments/{id}/hide` nhận `reason` bắt buộc; đã ẩn trả `ERR_CONFLICT`. `DELETE /content-comments/{id}` luôn trả mã BR-66.
7. `POST /news`, `/library-items`, `/coloring-pages` nhận `org_unit_id`, các trường riêng (tin tức: `title`, `summary`, `content`, `category_id`, `cover_file_id`; thư viện: `title`, `description`, `age_group`, `topic_id`, `album_id`, `file_id`; hình tô màu: `title`, `topic`, `age_group`, `file_id` bắt buộc), `scope_type`, `scope_id` (mặc định đơn vị của nội dung); tạo ở trạng thái `draft`. Tệp phải là `content_file` của đơn vị. `publish`, `hide` (`reason` bắt buộc); trạng thái sai trả mã BR-69. `GET` lọc `org_unit_id`, `status`, `child_id` (phụ huynh xem theo một con); mỗi dòng có `can_manage`.
8. `POST /content-files` là biểu mẫu nhiều phần gồm `org_unit_id`, `file` (JPEG, PNG, PDF tối đa 10 MB); cần `P14.content.manage`, `P14.library.manage` hoặc `P14.extracurricular.manage` ở đơn vị.
9. Danh mục: `GET /activity-categories|news-categories|library-topics?org_unit_id=` (kèm `include_inactive=true`) trả danh mục của đơn vị và Trường chính cho người dùng trong đơn vị; `POST` nhận `org_unit_id`, `name`, `order_no`; `PATCH` nhận `name`, `order_no`, `status`; trùng tên trả `ERR_CONFLICT`.
10. `POST /extracurricular-activities` nhận `org_unit_id`, `name`, `description`, `start_date`, `end_date`, `grade_levels` (mảng mã bậc học), `quota`, `fee_type`, `fee_amount`; cần `P14.extracurricular.manage`. `GET` cho nhân sự có quyền ngoại khóa, đăng ký dịch vụ hoặc tính học phí theo đơn vị (mọi trạng thái) và phụ huynh (đã công bố, đơn vị có con); mỗi dòng có `registered_count`, `remaining`, `can_manage`, `my_registrations` (đăng ký của con người gọi).
11. `POST /extracurricular-activities/{id}/registrations` nhận `child_id`; hoạt động chưa công bố, đã kết thúc, trẻ không thuộc đơn vị hoặc sai bậc học, đủ chỉ tiêu trả mã `P14-11`; trùng trả `ERR_CONFLICT`. Kết quả có `charge`: `null` (chờ tính học phí hoặc miễn phí) hoặc `{ invoice_id, invoice_kind }` (`supplementary` khi đã lập hóa đơn bổ sung, `main` khi thêm vào hóa đơn chính nháp). `POST /extracurricular-registrations/{id}/withdraw` cho phụ huynh của trẻ hoặc nhân sự có quyền; đã thôi trả `ERR_CONFLICT`.

Giao kèo của nhóm điểm cuối bếp, thực đơn, suất ăn, phiếu đi chợ (DT-10 phần 10c):

1. Ghi danh mục bếp, thực đơn, tính suất, phiếu đi chợ cần `P12.kitchen.manage` trong phạm vi đơn vị; đọc cần một trong `P12.kitchen.manage`, `P12.menu.approve`, `P17.report.kitchen` của đơn vị. Các điểm cuối danh sách bắt buộc `org_unit_id`. Ngoài phạm vi trả `ERR_FORBIDDEN`; trùng mã nguyên liệu, tên món, tên nhà cung cấp, thực đơn cùng đơn vị, tuần, độ tuổi trả `ERR_CONFLICT`.
2. `POST /dishes` nhận `org_unit_id`, `name`, `group_name`, `recipe_note`, `norms` (mỗi phần tử `ingredient_id`, `quantity_per_serving` lớn hơn 0, tối đa 50 dòng); `PUT /dishes/{id}/norms` nhận `norms`. Nguyên liệu khác đơn vị hoặc ngừng dùng trả `ERR_RULE_VIOLATION` mã BR-60.
3. `POST /menus` nhận `org_unit_id`, `week_start_date` (thứ hai, sai trả `ERR_VALIDATION`), `age_group` (mặc định `all`, hoặc mã khối học), `note`, `items` (mỗi phần tử `weekday` 1 đến 6, `meal_type` `breakfast`, `lunch`, `snack`, `dish_id` cùng đơn vị, `note`; tối đa 120). `status` là `draft`, `submitted`, `published`.
4. `PUT /menus/{id}/items` chỉ khi `draft`; `submit` chỉ khi `draft` và có món; `approve`, `reject` (nhận `reason` bắt buộc) chỉ khi `submitted` và cần `P12.menu.approve`. Sai trạng thái trả `ERR_RULE_VIOLATION` mã BR-59. Duyệt là công bố.
5. `GET /menus/{id}/norms` nhận `date` trong tuần của thực đơn (mặc định thứ hai) và `servings` (số nguyên 0 đến 5000, mặc định số suất của các lớp dùng thực đơn trong ngày); trả `lines` theo món và `totals` theo nguyên liệu kèm `shortage` so với tồn.
6. `GET /children/{id}/menus` nhận `week_start_date` là một ngày bất kỳ của tuần (mặc định hôm nay); chỉ phụ huynh của trẻ hoặc người đọc dữ liệu bếp của đơn vị; trả `menu` là thực đơn đã công bố đúng mã khối của lớp, không có thì thực đơn chung, không có thì `null`; `buffets` là buffet đã duyệt trong tuần của toàn đơn vị hoặc lớp của trẻ.
7. `GET /meal-plans` nhận `org_unit_id`, `date` (mặc định hôm nay); trả `headcount` (mỗi bữa), `meals` ba bữa, `status` (`final` khi mọi lớp đang hoạt động đã chốt điểm danh, còn lại `provisional`), `computed_from`, `classes` (mỗi lớp `enrolled_count`, `attendance_meal_count`, `meal_report_headcount`, `source` `attendance_locked` | `meal_report` | `attendance_open`, `headcount`) và `stored` là số đã lưu. `POST /meal-plans/compute` nhận `org_unit_id`, `date` (ngày học không sau hôm nay, ngày không phải ngày học trả mã BR-91) và ghi đè số đã lưu.
8. `POST /classes/{id}/meal-report` nhận `date` (mặc định hôm nay, không sau hôm nay, phải là ngày học), `headcount` (số nguyên), `note`; chỉ giáo viên chủ nhiệm đang được phân công có `P12.meal-report.submit`, sai trả `ERR_FORBIDDEN`; quá sĩ số hoặc điểm danh đã chốt trả `ERR_RULE_VIOLATION` mã BR-58. `GET` cho giáo viên chủ nhiệm hoặc người đọc dữ liệu bếp.
9. `POST /buffet-events` nhận `org_unit_id`, `buffet_date` (không trước hôm nay), `occasion`, `class_id` (trống là toàn đơn vị), `menu_note`; cần `P12.kitchen.manage` hoặc `P12.menu.approve`. `approve` cần `P12.menu.approve`, chỉ khi `draft`; `cancel` cần một trong hai quyền. Sai trạng thái trả mã P12-06.
10. `POST /market-purchases` nhận `org_unit_id`, `purchase_date`, `supplier_id` (nhà cung cấp thực phẩm cùng đơn vị đang dùng), `note`, `items` (1 đến 100 dòng, mỗi dòng `ingredient_id`, `quantity` lớn hơn 0, `unit_price` nguyên đồng không âm; mỗi nguyên liệu một dòng); trả `code` dạng `PDC-000001`, `total_amount`, mỗi dòng có `planned_quantity` và `difference`.
11. `receive` chỉ khi `draft`: `status` thành `received`, `payment_status` thành `awaiting_payment`, tồn nguyên liệu tăng, kế toán (VT-04) của đơn vị nhận thông báo; `cancel` chỉ khi `draft`. Sai trạng thái trả mã P12-09. `GET /market-purchases` lọc `status`, `payment_status=awaiting_payment`; người có `P06.payment.manage` của đơn vị cũng đọc được.
12. `link-payment` nhận `payment_id`; cần `P06.payment.manage` trong đơn vị; phiếu đi chợ phải chờ thanh toán, phiếu chi đã phát hành, số tiền bằng `total_amount`, chưa gắn phiếu đi chợ khác, sai trả `ERR_RULE_VIOLATION` mã BR-28; xong thì `payment_status` thành `paid`.
13. `GET /reports/meals` nhận `org_unit_id`, `from`, `to` (mặc định đầu tháng đến hôm nay, tối đa 62 ngày); cần `P17.report.kitchen` trong đơn vị. Trả `days` (mỗi ngày `class_count`, `locked_class_count`, `attendance_locked`, `attendance_meal_count` theo điểm danh đã chốt, `absent_count`, `meal_headcount` đã lưu, `meal_plan_status`, `matched` là `true`, `false` hoặc `null` khi chưa đối chiếu được), `mismatched_days`, `total_meal_days`, `purchases` (`count`, `total_amount`, `awaiting_payment_amount`, `paid_amount`, `by_supplier`) và `cost_per_meal_day`.
14. Mọi thao tác ghi ghi `audit_logs` kèm giá trị trước và sau (QU-04).

Giao kèo của thuốc và dặn thuốc (DT-10 phần 10b, YCTD-75):

1. `POST /files` nhận thêm `purpose` `medicine_photo` (JPEG, PNG) và `prescription` (JPEG, PNG, PDF); chỉ phụ huynh có con đang học trong `org_unit_id` tải được, khác trả `ERR_FORBIDDEN`. `GET /files/{id}` của hai mục đích này theo quyền xem sức khỏe của trẻ của yêu cầu chứa tệp; tệp chưa gắn yêu cầu chỉ người tải lên xem.
2. `POST /medication-requests` nhận `child_id`, `medicine_name`, `dosage`, `times` (mảng một đến sáu giờ `HH:MM`, không trùng), `from_date` (không trước hôm nay), `to_date` (tối đa 30 ngày), `allergy_note` (bắt buộc), `note`, `medicine_photo_ids` (mảng một đến năm mã tệp `medicine_photo`), `prescription_photo_id` (tùy chọn, tệp `prescription`); tệp phải do người gọi tải lên và thuộc đơn vị của trẻ. Thiếu trường bắt buộc trả `ERR_VALIDATION`; không phải phụ huynh của trẻ trả `ERR_FORBIDDEN`; trẻ không đang học trả mã P10-03. Trả `assigned_role` (`nurse` hoặc `homeroom`).
3. `GET /medication-requests` nhận `child_id`, `status`, `org_unit_id`, `class_id` (lọc theo lớp hiện tại của trẻ); mỗi dòng có `full_name`, `class_name`, `current_class_id`, `administrations` (mảng liều đã ghi). Tối đa 200 dòng mới nhất. `status` là `pending` (phụ huynh đã gửi, chờ nhận thuốc), `received` (đã nhận thuốc, YCTD-344), `administering` (đang cho uống), `completed`, `rejected`; giá trị khác trả `ERR_VALIDATION`. Đọc danh sách, chi tiết, lịch cho uống thì yêu cầu `received` hoặc `administering` có `to_date` trước hôm nay được chuyển `completed` (QT-07 mục 7: hết thời gian dùng thuốc thì hệ thống hoàn thành). Gửi yêu cầu thì thông báo trong ứng dụng cho cả y tế của đơn vị (VT-09) và giáo viên chủ nhiệm của lớp, nội dung ghi rõ người nhận thuốc.
4. `POST /medication-requests/{id}/receive` nhận `received_quantity`, `received_note` (tùy chọn); `POST /medication-requests/{id}/reject` nhận `reason` (bắt buộc); `POST /medication-requests/{id}/complete` không nhận thân. Nhận thuốc chuyển `pending` sang `received` và báo phụ huynh trong ứng dụng; từ chối chỉ từ `pending`, báo phụ huynh trong ứng dụng và tin nhắn kèm lý do; kết thúc sớm từ `received` hoặc `administering` (YCTD-344). Không ở trạng thái phù hợp trả `ERR_RULE_VIOLATION` (nhận: mã BR-49; từ chối, kết thúc: mã P10-04). Không có quyền theo BR-86 trả `ERR_FORBIDDEN`.
5. `POST /medication-administrations` nhận `request_id`, `scheduled_date` (trống là hôm nay, không sau hôm nay), `scheduled_time` (một trong `times`), `is_skipped`, `skip_reason` (bắt buộc khi bỏ liều), `dose_note`. Yêu cầu chờ nhận trả mã BR-49; yêu cầu đã kết thúc hoặc ngày ngoài thời gian dùng thuốc trả mã P10-04; liều đã ghi trả `ERR_CONFLICT` với `details` gồm `administration_id` và `existing` (nội dung đã ghi). Ghi liều được ở `received` và `administering`; liều đầu tiên chuyển `received` sang `administering`. Ghi đủ liều theo lịch thì yêu cầu tự chuyển `completed`. Mỗi liều cho uống báo phụ huynh trong ứng dụng (mẫu `medication_dose_given`); bỏ liều báo trong ứng dụng và tin nhắn (`medication_dose_skipped`, YCTD-344).
6. `POST /medication-administrations/{id}/acknowledge` chỉ phụ huynh của trẻ, chỉ với liều bỏ (liều đã cho uống trả mã BR-88); gọi lại trả thời điểm xác nhận lần đầu.
7. `GET /medication-schedules` nhận `date` (trống là hôm nay), `org_unit_id`, `class_id`; trả từng giờ của các yêu cầu đã nhận thuốc hoặc đang cho uống trong ngày (yêu cầu chờ nhận không có, BR-49): `request_id`, `child_id`, `full_name`, `class_name`, `medicine_name`, `dosage`, `scheduled_date`, `scheduled_time`, `administration` (liều đã ghi hoặc `null`), `can_administer`.
8. `POST /medicines` nhận `org_unit_id`, `code`, `name`, `active_ingredient`, `unit`, `pharmacy_id`, `stock_qty` (tồn đầu, 0 trở lên); trùng mã trong đơn vị trả `ERR_CONFLICT`. `PATCH /medicines/{id}` gửi `stock_qty` trả `ERR_VALIDATION`. `GET /medicines`, `GET /pharmacies` nhận `org_unit_id`, `status`; người có `P10.medicine.manage`, `P10.medicine-purchase.approve` hoặc `P06.view` xem theo phạm vi.
9. `POST /medicine-purchase-requests` nhận `medicine_id`, `quantity`, `estimated_unit_price`, `reason`; trả `estimated_amount`, `requires_principal`. `POST .../approve` không nhận thân; `POST .../reject` nhận `reason` (bắt buộc). Cần Hiệu trưởng mà người duyệt không phải Hiệu trưởng, hoặc người duyệt là người lập, trả `ERR_FORBIDDEN`; đề nghị không chờ duyệt trả mã BR-63.
10. `POST /medicine-purchase-orders` nhận `request_id` (đề nghị đã duyệt, chưa lập phiếu; khác trả mã BR-63), `pharmacy_id`, `order_date`, `note`, `items` (mảng `medicine_id`, `quantity`, `unit_price`, mỗi thuốc một dòng, thuốc thuộc đơn vị của đề nghị); trả `code` dạng `MT-000001`, `total_amount`, `items`; tồn của từng thuốc tăng theo số lượng.
11. `POST /medicine-issues` nhận `medicine_id`, `quantity`, `recipient`, `reason`; trả `code` dạng `CTH-000001` và `stock_qty` sau khi cấp; không đủ tồn trả mã P10-05.

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
11. Hết hạn mật khẩu (DT-15 phần 15g, YCTD-110, BR-110): `login`, `refresh`, `change-password` trả thêm `password_expired` (đúng thì `password_change_required` cũng đúng, mã phiên chỉ dùng được như mục 4) và `password_expires_in_days` (số ngày còn lại khi trong khoảng báo trước, ngoài ra null). Chỉ xét tài khoản có ít nhất một vai trò khác VT-14, đăng nhập hoặc làm mới phiên bằng mật khẩu; tài khoản còn dùng mật khẩu mặc định chung và phiên bằng mã một lần không xét. Đăng nhập bằng mật khẩu đã hết hạn ghi `security_events` loại `login_password_expired`. `change-password` và `POST /users/{id}/reset-password` ghi lại `password_changed_at`; mật khẩu mới trùng mật khẩu hiện tại trả `ERR_VALIDATION`.
12. `GET /auth/settings/password-policy` trả `password_max_age_days` (mặc định 0 là không giới hạn), `password_expiry_warning_days` (mặc định 7). `PUT` nhận một hoặc cả hai trường: `password_max_age_days` số nguyên 0 đến 3650, `password_expiry_warning_days` số nguyên 0 đến 90; sai hoặc thân rỗng trả `ERR_VALIDATION`; ghi `identity_audit_logs`. Cả hai cần `P01.account.manage` (VT-01, VT-02), thiếu quyền trả `ERR_FORBIDDEN`.
13. Mã xác nhận, quên mật khẩu, lịch sử mật khẩu (DT-16 phần 16c, YCTD-123, BR-121):
    - `POST /auth/captcha` không cần thân yêu cầu, trả `captcha_id`, `image` (`data:image/png;base64,…`, ảnh 170 × 56 điểm ảnh vẽ ở máy chủ), `expires_in_seconds` (300); giới hạn tần suất theo địa chỉ mạng như `login`. Đáp án lưu ở Redis 5 phút, dùng một lần.
    - `login` kênh `portal` nhận thêm `captcha_id`, `captcha_text` (không phân biệt hoa thường). Khi bắt buộc (`captcha_always` đúng hoặc tên đăng nhập đã sai từ `captcha_failure_threshold` lần trong 15 phút) mà thiếu mã trả `ERR_VALIDATION` (400) trường `captcha` "Nhập mã xác nhận trong ảnh", sai hoặc hết hạn trả trường `captcha` "Mã xác nhận không đúng hoặc đã hết hạn", trước khi kiểm tra mật khẩu. Kênh `teacher`, `parent` không áp dụng.
    - `GET /auth/login-options` trả `{ hotline, captcha_always }`; `hotline` null khi chưa cấu hình.
    - `POST /auth/password-reset/request` nhận `login` (số điện thoại hoặc tên đăng nhập), `captcha_id`, `captcha_text` (luôn bắt buộc); trả 200 cùng nội dung dù tài khoản có hay không; chỉ gửi mã 6 chữ số khi tài khoản đang hoạt động, có số điện thoại và có vai trò khác VT-14; quá `one_time_code_maximum_sends_per_hour` lần mỗi giờ theo tên đã nhập trả `ERR_RATE_LIMIT` (429).
    - `POST /auth/password-reset/confirm` nhận `login`, `code`, `new_password`; mật khẩu không đạt chính sách (BM-03) hoặc trùng mật khẩu gần đây trả `ERR_VALIDATION` trường `new_password` và giữ mã; mã sai, hết hạn hoặc đã dùng trả `ERR_UNAUTHENTICATED` (401) "Mã không đúng hoặc đã hết hạn, vui lòng yêu cầu mã mới"; thành công trả `message`, thu hồi mọi phiên, mở tạm khóa, bỏ bắt buộc đổi mật khẩu. Nhật ký an ninh: `password_reset_code_sent`, `password_reset`, `password_reset_failed`, `password_reset_request_ignored`, `password_reset_send_limit`.
    - `change-password` và `password-reset/confirm` từ chối mật khẩu trùng mật khẩu hiện tại hoặc `password_history_count` mật khẩu gần nhất: trường `new_password` "Mật khẩu mới phải khác mật khẩu hiện tại và N mật khẩu gần nhất".
    - `GET`, `PUT /auth/settings` có thêm `captcha_failure_threshold` (1 đến 10), `password_history_count` (0 đến 24), `captcha_always` (đúng hoặc sai), `login_hotline` (tối đa 100 ký tự, chuỗi rỗng là bỏ); sửa cần `P01.setting.manage` ở phạm vi toàn trường như mục 10.
    - `otp/login` của phụ huynh chỉ nhận mã có `purpose` là `login`.

Giao kèo nhiều trường (DT-SaaS phần S1a, YCTD-191, BR-200 đến BR-202):

1. Có biến `PLATFORM_DATABASE_URL` thì dịch vụ định danh và máy chủ API chạy nhiều trường: mỗi yêu cầu nhận diện trường theo tên miền (`TENANT_HOST_SOURCE` là `host`, `x-forwarded-host` kèm `TRUST_PROXY`, hoặc `header:<tên>` kèm `EDGE_SHARED_SECRET`); tên miền lạ, thiếu tên miền, trường đang khởi tạo hoặc đã xóa trả 404 chung (`ERR_NOT_FOUND`), trường tạm dừng trả 503 (`ERR_SCHOOL_SUSPENDED`); đường dẫn `/api/v1/health` và `/api/v1/auth/platform/*` không cần trường.
2. Mã phiên mang claim `tid` (mã trường; `sid` đã là mã phiên). Máy chủ API và dịch vụ định danh trả 401 khi thiếu `tid` hoặc `tid` khác trường của tên miền. Gọi nội bộ giữa hai dịch vụ dùng địa chỉ nội bộ, không phải tên miền của trường: khi tên miền không phân giải được mà yêu cầu có mã phiên hợp lệ thì lấy trường theo `tid` trong mã phiên đã ký.
3. Cookie mã làm mới đặt tên kèm mã trường (`refresh_token__<mã>`), khóa Redis của dịch vụ định danh có tiền tố `t:<mã>`, `cacheKey`, `storageKey` thêm tiền tố của trường (trường số 1 tiền tố trống).
4. Việc nền và việc khởi động theo trường (gửi thông báo, văn thư, xuất nền, lưu kết quả máy xếp, nhắc việc, đăng ký biểu EMIS) chạy qua bộ lập lịch (YCTD-192, BR-203, BR-204): `SCHEDULER_MODE` (`internal` mặc định hoặc `external`), `SCHEDULER_INTERVAL_SECONDS` (15), `SCHEDULER_CONCURRENCY` (2), `INTERNAL_JOB_TOKEN`, `TIMETABLE_MAX_ACTIVE_RUNS` (2), `PLATFORM_ROOT_DOMAIN`. `domain-check` ở chế độ nhiều trường tra danh mục tên miền của nền tảng (BR-205).

Giao kèo khởi tạo và vòng đời trường (DT-SaaS phần S2, YCTD-193, BR-206 đến BR-208):

1. Nhóm `/api/v1/auth/platform/schools` chỉ phục vụ ở tên miền cổng nền tảng (tên miền khác 404) và cần mã phiên vận hành (thiếu, sai 401). Lỗi bước setup trả 400 `ERR_VALIDATION` kèm `details` theo từng trường (`code`, `name`, `levels`, `domain.host`, `consents`, `admin.login`, `terms`, ...); vi phạm vòng đời (đổi trạng thái không hợp lệ, thiếu hồ sơ khi đổi sang `consented`, cấp lại lời mời khi đã kích hoạt) trả 422 `ERR_RULE_VIOLATION` mã quy tắc BR-208; mã trường không có trả 404.
2. `POST /schools` nhận `{ code, name, address, levels, first_year_start, domain: { mode: 'system' } | { mode: 'custom', host }, data_class, status, consents[], hosting[], admin: { full_name, login, phone }, terms: { version, accepted, accepted_by_name, accepted_by_title } }`, chạy khởi tạo ngay, trả `{ job_id, status: 'done' | 'failed', error, school, activation: { path: '/activate?token=…', host } }`; đường kích hoạt chỉ trả ở lần chạy tạo lời mời.
3. `GET /api/v1/auth/activate?token=` và `POST /api/v1/auth/activate` (`{ token, new_password }`) phục vụ ở tên miền của trường, không cần đăng nhập, có giới hạn tần suất đăng nhập; mã sai, đã dùng, hết hạn hoặc của trường khác trả 401; mật khẩu sai chính sách trả 400.
4. Trạng thái trường đổi thì bộ phân giải của dịch vụ định danh đọc lại ngay; máy chủ API đọc lại sau `TENANT_CACHE_SECONDS`.

Giao kèo hồ sơ thử nghiệm (DT-SaaS phần S9, YCTD-203, BR-209, BR-210):

1. Cổng biên chuyển `/api/v1` về máy chủ kèm `x-school-host: <tên miền gốc>` và `x-edge-auth: <EDGE_SHARED_SECRET>`, bỏ hai tiêu đề này, `x-forwarded-host`, `x-website-root` nếu người dùng tự đặt; đặt `x-forwarded-for` bằng địa chỉ người dùng. Máy chủ ngủ (quá `ORIGIN_TIMEOUT_MS`, lỗi kết nối, 502, 504, 520 đến 524) thì cổng biên trả 503 kèm `Retry-After: 10`: trang HTML cho trình duyệt, `{ error: { code: 'ERR_SERVICE_WAKING', message, details: [] } }` cho lời gọi khác. Lỗi 503 của ứng dụng chuyển nguyên.
2. Bước setup và `POST /auth/platform/schools/{mã}/data-class` trả 400 hoặc 422 có lỗi ở `data_class` khi loại dữ liệu trái `PLATFORM_DATA_POLICY`; `GET /auth/platform/schools/settings` thêm `data_policy`; chi tiết trường trả `provider` của từng tên miền.
3. Biến của nền tảng: `DB_HOST_ADAPTER` (`plain`, `neon`, `supabase`), `DB_POOLER_HOST`, `DB_POOLER_PORT`, `SUPABASE_PROJECT_REF`, `PLATFORM_DATA_POLICY`, `DOMAIN_PROVIDER` (`dns-check`, `cloudflare-saas`, `vercel-domains`) kèm `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` hoặc `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `MIGRATE_ON_START`, `MIGRATE_SCHOOLS_ON_START`, `SMS_ALLOW_LOG`, `REDIS_URL=memory://` (dịch vụ định danh), `APP_BASE_PATH` (lúc dựng giao diện).
4. Lệnh `platform relayout --school <mã> --to database|schema` đọc nền tảng nguồn từ biến của nền tảng và nền tảng đích từ `TARGET_PLATFORM_DATABASE_URL`, `TARGET_PLATFORM_MASTER_KEY`, `TARGET_PLATFORM_ADMIN_DATABASE_URL`, `TARGET_PLATFORM_SHARED_DATABASE`; in mỗi cơ sở dữ liệu đã chép và số bảng khớp.

Giao kèo gói dịch vụ (DT-SaaS phần S5a, YCTD-194, BR-214 đến BR-216):

1. Khi trường có gói, quyền thuộc phân hệ ngoài gói trả 403 `MODULE_NOT_IN_PLAN`; vượt giới hạn khi thêm học sinh, bật cấp học, tải tệp trả 422 `PLAN_LIMIT_EXCEEDED`; trường ở trạng thái `read_only` trả 403 `SCHOOL_READ_ONLY` cho mọi yêu cầu ghi tới máy chủ API và dịch vụ định danh, trừ `/api/v1/auth/*` (ngoài `/auth/settings`), đường dẫn xuất, `/api/v1/export-jobs`, `/api/v1/school-plan`, `/api/v1/billing`. Trường chưa gán gói và chế độ một trường không bị ảnh hưởng.

Giao kèo thu phí tự động (DT-SaaS phần S5b, YCTD-196, BR-222 đến BR-224):

1. Nhóm `/api/v1/billing` chỉ có ở nền tảng nhiều trường (chế độ một trường trả 404), cần `P01.billing.manage`, chỉ trả hóa đơn của trường theo tên miền; được gọi cả khi trường ở chế độ chỉ đọc. `POST /billing/invoices/{id}/pay` trả `{ provider, provider_reference, virtual_account_number, qr_content, amount, transfer_content, account_name }` cho số còn nợ; hóa đơn không còn nợ trả 409; `simulate-payment` chỉ có khi cổng mặc định của nền tảng là bộ giả lập (không thì 404).
2. `POST /api/v1/platform-billing/webhooks/{payos|sepay|casso}` không cần trường, xác thực bằng chữ ký hoặc khóa của cổng lưu ở cơ sở dữ liệu nền tảng; cổng chưa bật 404, sai khóa 401; giao dịch trùng mã vẫn trả 200 nhưng không ghi lại.
3. Nhóm `/api/v1/auth/platform/billing` chỉ ở tên miền cổng nền tảng với mã phiên vận hành; điều chỉnh tay thiếu lý do (dưới 3 ký tự) trả 400, sai trạng thái (giảm giá hóa đơn đã trả, hủy hóa đơn đã thu) trả 409; khóa cổng chỉ trả gợi ý bốn ký tự cuối.
Giao kèo sao lưu theo trường (DT-SaaS phần S7b, YCTD-199, BR-217, BR-218):

1. `GET /api/v1/auth/platform/schools/{mã}` trả thêm `backups`: 20 dòng `backup_runs` gần nhất của trường (`id`, `kind`, `status`, `file_name`, `file_bytes`, `tables`, `rows`, `details`, `error`, `started_at`, `finished_at`); không có điểm cuối chạy sao lưu từ trình duyệt.
2. Lệnh `platform` (biến `BACKUP_ENCRYPTION_PASSPHRASE` ít nhất 16 ký tự, `BACKUP_DIR`): `backup-school (--school <mã> | --all) [--scope all|active] [--keep-days n]` (đọc ở máy chủ khác khi có `BACKUP_SOURCE_HOST`, `BACKUP_SOURCE_PORT`), `verify-backup --file`, `restore-school --file (--in-place | --as <mã mới>)`, `restore-drill (--file | --school | --all)`, `move-school --school [--drop-source]` với `TARGET_CLUSTER_ADMIN_URL`, `TARGET_CLUSTER_LAYOUT`, `TARGET_CLUSTER_SHARED_DATABASE`. Lỗi một trường khi chạy `--all` thì báo dòng LỖI, chạy tiếp trường khác, mã thoát 1.
3. `platform relayout` (S9) không còn cần quyền siêu người dùng ở nền tảng đích: dữ liệu nạp bằng vai trò của trường.


Giao kèo bảng điều khiển nền tảng và phiên hỗ trợ (DT-SaaS phần S4, YCTD-197, BR-225 đến BR-227):

1. Mã phiên của phiên hỗ trợ mang claim `spt` (`read` hoặc `full`); `GET /auth/me` trả thêm `support` (`id`, `scope`, `operator_name`, `expires_at`), phiên thường là `null`. Phiên hỗ trợ đã kết thúc, hết hạn hoặc trường đã rút cho phép thì mọi yêu cầu và làm mới phiên trả 401.
2. Phiên chỉ đọc: mọi yêu cầu ghi tới máy chủ API và dịch vụ định danh trả 403 `ERR_FORBIDDEN` (mã quy tắc YCTD-197 ở máy chủ API), trừ đăng xuất; mọi phiên hỗ trợ bị 403 ở `/auth/impersonation*`, `/auth/change-password`, `/signing/*`, kí văn bản đi, `/school-data-exports`, `/support-access`.
3. Biến môi trường: `PLATFORM_ERROR_ALERT_PER_HOUR` (dịch vụ định danh, mặc định 20), `SCHOOL_METRICS_INTERVAL_SECONDS` (máy chủ API, mặc định 3600, 0 là tắt).

Giao kèo đơn vị cấp trên (DT-SaaS phần S6, YCTD-202, BR-228 đến BR-230):

1. Mã phiên cấp trên: đối tượng `school-management-parent-org`, claim `kind = parent_org_user`, hạn 8 giờ; máy chủ API kiểm bằng khóa công khai (cả khóa cũ khi đang xoay khóa).
2. Nhóm số liệu (`category`): `scale` (lớp, học sinh đang học theo giới tính, khối), `attendance` (30 ngày: số ngày, lượt điểm danh, có mặt, vắng, tỉ lệ), `learning` (kết quả môn đạt, chưa đạt; mức tiến bộ), `facilities` (phòng, diện tích, tình trạng), `staff` (nhân sự theo giới tính), `emis` (số dòng theo biểu). Ô số người dưới ngưỡng trả `null` và liệt kê ở `hidden_cells`.
3. Biến môi trường máy chủ API: `AGGREGATE_SNAPSHOT_INTERVAL_SECONDS` (mặc định 21600), `PARENT_ORG_MIN_GROUP` (mặc định 5), `PLATFORM_CONSOLE_HOST` (như dịch vụ định danh). Khi phát triển, cổng nền tảng chuyển `/api/v1/parent-org` sang máy chủ API.

## 5. Nền tảng và phân quyền

Các điểm cuối tài khoản, vai trò, quyền và khóa API dưới đây do dịch vụ định danh phục vụ. Các điểm cuối còn lại, gồm đơn vị, năm học, cấu hình và nhóm `/partner/`, do máy chủ API nghiệp vụ phục vụ; khóa API gửi kèm yêu cầu của đối tác được máy chủ API kiểm tra với dịch vụ định danh.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/org-units | Danh sách và tạo đơn vị; lọc được theo cấp và theo đơn vị cha; từ YCTD-111 có thêm `distance_km`, `area_m2` |
| GET | /api/v1/org-units/tree | Cây đơn vị hai cấp (QĐ-23) |
| PATCH | /api/v1/org-units/{id} | Cập nhật tên, mã, loại cấp 2, địa chỉ, điện thoại, người phụ trách, trạng thái; không đổi được đơn vị cha vì cây chỉ có hai cấp (YCTD-38); từ YCTD-111 sửa thêm khoảng cách đến cơ sở chính, diện tích |
| POST | /api/v1/org-units/export | Xuất Excel 1.2 phân hiệu hoặc 1.3 điểm trường theo bộ lọc và `columns`; cần `P17.data.export`, ghi nhật ký xuất (BR-117, YCTD-119) |
| GET | /api/v1/org-units/levels | Cấp học của từng đơn vị (YCTD-152) |
| PUT | /api/v1/org-units/{id}/levels | Đặt cấp học của đơn vị (`school_levels`, ít nhất một); cần `P01.org-unit.manage` (YCTD-152) |
| POST | /api/v1/account-exports/roles | Xuất Excel 1.1 Nhóm người dùng theo từ khóa và `columns`; cần `P17.data.export`, ghi nhật ký xuất (BR-117, YCTD-119) |
| GET, POST | /api/v1/academic-years | Danh sách và tạo năm học kèm lịch năm học |
| GET, PUT | /api/v1/academic-years/{id}/calendar | Đọc và lưu học kỳ, kỳ hè, ngày học trong tuần; hệ thống tự đánh số tuần (BR-91) |
| GET, PATCH | /api/v1/academic-years/{id}/weeks | Danh sách tuần; đánh dấu hoặc bỏ đánh dấu tuần nghỉ; từ YCTD-127 trả thêm học kỳ đang áp dụng, học kỳ chọn riêng, hiển thị; sửa học kỳ, hiển thị, tuần đệm của "3.4. Khai báo tuần" |
| DELETE | /api/v1/academic-years/{id}/calendar | Bỏ lịch riêng của cấp (`school_level` bắt buộc); từ YCTD-152 lịch và tuần nhận `school_level` (trống là lịch chung), lịch trả thêm `school_level`, `inherited` |
| POST | /api/v1/academic-years/{id}/open | Mở năm học: kiểm tra BR-89, BR-94, tạo cơ sở dữ liệu năm học, chuyển dữ liệu dùng chung, trẻ, lớp, quỹ, công nợ (YCTD-69), chuyển năm đang dùng sang đã đóng và chỉ đọc (BR-93) |
| GET | /api/v1/academic-years/rollover/status | "5.7. Chuyển hồ sơ lên năm học mới": năm đang dùng, năm chờ mở có lịch, Hủy được hay không kèm lý do; cần `P01.academic-year.manage` (P01-27, YCTD-127) |
| POST | /api/v1/academic-years/{id}/cancel-open | Hủy chuyển hồ sơ lên năm học mới khi năm mới chưa phát sinh dữ liệu (BR-125, YCTD-127) |
| POST | /api/v1/academic-years/{id}/close | Bỏ ngày 09/10/2026: gộp vào mở năm học mới (YCTD-37) |
| GET, PUT | /api/v1/me/quick-links | Đọc và lưu lối tắt Truy cập nhanh trên trang chủ cổng quản trị của chính người đăng nhập (YCTD-102) |
| GET, PUT | /api/v1/me/grid-settings/{gridKey} | Đọc và ghi đè cấu hình lưới dữ liệu (cột hiển thị theo thứ tự, số dòng mỗi trang) của chính người đăng nhập (YCTD-107) |
| GET, POST | /api/v1/system-announcements | Danh sách thông báo hệ thống; soạn thông báo; cần `P01.announcement.manage` (YCTD-123) |
| PUT, DELETE | /api/v1/system-announcements/{id} | Sửa (thay toàn bộ), xóa thông báo; cần `P01.announcement.manage` |
| GET | /api/v1/system-announcements/active | Thông báo đang bật và còn hiệu lực hôm nay; mọi người đã đăng nhập |
| GET, PUT | /api/v1/app-links | Ứng dụng liên kết theo thứ tự (mọi người đã đăng nhập); thay cả danh sách (cần `P01.announcement.manage`) |
| GET | /api/v1/portal-context | Tên, mã trường, năm học đang dùng, cấp học, lời nhắc mã định danh tổ chức cho thanh đầu trang; mọi người đã đăng nhập; từ YCTD-127 tên trường lấy theo tên trường hiển thị ở "1.4. Cấu hình trường" khi có |
| GET, PUT | /api/v1/school-levels | Cấp học của trường kèm số lớp, cấp người dùng được xem (mọi người đã đăng nhập); ghi cả bốn cấp (cần `P01.school-level.manage`) (P01-35, YCTD-151) |
| GET, PUT | /api/v1/users/{id}/school-levels | Phạm vi cấp học của tài khoản, dịch vụ định danh (cần quyền quản lý tài khoản đó) (P01-36, YCTD-151) |
| PUT | /api/v1/auth/me/working-school-level | Lưu cấp đang làm việc của chính tài khoản, dịch vụ định danh (mọi người đã đăng nhập) (P01-42, YCTD-153) |
| GET | /api/v1/portal-context/school-levels | Cấp người dùng được xem (cấp đang bật thu hẹp theo phạm vi cấp) cho bộ chọn cấp, menu, nhãn thuật ngữ; mọi người đã đăng nhập (P01-41, YCTD-153) |
| GET | /api/v1/public/login-info | Công khai: tên, mã trường, năm học đang dùng cho trang đăng nhập (YCTD-123); từ YCTD-127 tên trường lấy theo tên trường hiển thị khi có |
| GET, PUT | /api/v1/school-profile | Đọc hồ sơ trường kèm Trường chính; ghi các thẻ gửi lên (P01-15, YCTD-106) |
| GET, PUT | /api/v1/accreditation-review | Đọc, ghi bản "1.7. Rà soát thông tin kiểm định CLGD" của năm học (P01-24, BR-125, YCTD-127; đủ ô như Sở từ YCTD-136, BR-129) |
| POST | /api/v1/accreditation-review/collect | "Lấy dữ liệu": tính số lớp, phòng, diện tích, số học sinh từ dữ liệu sẵn có, lấy thông tin trường, chuẩn quốc gia, kiểm định từ cây đơn vị và hồ sơ trường, không ghi (YCTD-127, YCTD-136) |
| GET, POST | /api/v1/school-splits | "1.8. Tách trường": danh sách yêu cầu kèm số học sinh, nhân sự; tạo yêu cầu (P01-25, BR-125, YCTD-127) |
| GET | /api/v1/school-splits/candidates | Học sinh đang học (`type=child`) hoặc nhân sự đang làm việc (`type=staff`) để chọn, tìm theo `q` (YCTD-127) |
| GET, PATCH, DELETE | /api/v1/school-splits/{id} | Chi tiết; sửa, xóa yêu cầu chưa xác nhận đi (YCTD-127) |
| POST | /api/v1/school-splits/{id}/status | Xác nhận đi, hủy xác nhận, đánh dấu đã tiếp nhận (YCTD-127) |
| POST | /api/v1/school-splits/{id}/export | Xuất hồ sơ học sinh (82 cột) hoặc nhân sự (75 cột) theo mẫu CSDL ngành, ghi nhật ký xuất (BR-74, YCTD-127) |
| POST | /api/v1/user-feedback | Gửi ý kiến phản hồi từ chân trang cổng quản trị; mọi tài khoản đăng nhập, tối đa 10 ý kiến mỗi giờ (P01-16, BR-108, YCTD-110) |
| GET | /api/v1/me/user-feedback | Ý kiến phản hồi của chính người đăng nhập, mới nhất trước (YCTD-110) |
| GET | /api/v1/user-feedback | Mọi ý kiến phản hồi, lọc `status`; cần `P01.feedback.manage` (YCTD-110) |
| PUT | /api/v1/user-feedback/{id} | Đổi trạng thái, trả lời ý kiến; cần `P01.feedback.manage` (BR-109, YCTD-110) |
| GET | /api/v1/user-feedback/{id}/attachment | Ảnh đính kèm của ý kiến; người gửi hoặc người có `P01.feedback.manage` (YCTD-110) |

Giao kèo của học sinh theo hệ thống của Sở (DT-15 phần 15c, YCTD-108):

1. `GET /children` giữ `org_unit_id`, `class_id`, `group_id`, `status`, `q`, `missing_birth_certificate`; thêm `gender`, `grade_level`, `ethnicity` (khớp một phần), `policy`, `disability`, `two_sessions_per_day`, `boarding`, `can_swim` (true/false), `moet_student_code` (khớp một phần), `national_id` (đủ 12 số, so bằng mã băm); `page_size` từ 1 đến 200. Dòng trả thêm `org_unit_name`, `grade_level`, `grade_name`, `two_sessions_per_day`, `boarding`, `has_birth_certificate`, `ethnicity`, `policy_target`, `disability_type`, `can_swim` (null với người không xem được sức khỏe, BR-53), `contact_phone`, `sms_phone`; kèm `health_fields_visible`. Thứ tự A–Z theo tên rồi họ tên (BR-107). Lọc theo dân tộc, diện chính sách, khuyết tật khi không được xem sức khỏe trả `ERR_FORBIDDEN` (403); bộ lọc sai trả `ERR_VALIDATION` (400) kèm trường lỗi.
2. `POST /children/export` cần `P17.data.export` và phạm vi xem trẻ (BR-72). Thân gồm các bộ lọc như mục 1 và `columns` (mảng mã cột không trùng trong `moet_student_code`, `full_name`, `dob`, `gender`, `ethnicity`, `status`, `contact_phone`, `grade`, `class`, `sms_phone`, `two_sessions_per_day`, `boarding`, `policy_target`, `disability_type`, `can_swim`, `national_id`, `org_unit`; bỏ trống là 9 cột mặc định). Trả tệp xlsx có cột STT và các cột theo thứ tự gửi, đầu `x-export-log-id`; ghi `export_logs` mã báo cáo `children`, có dữ liệu cá nhân, không ghi số định danh của bộ lọc (BR-74). Quá 10 000 dòng trả `ERR_RULE_VIOLATION` mã YCTD-108.
3. `POST /children/bulk-update` cần `P02.child.manage` hoặc `P02.approve`. Thân `child_ids` (1 đến 500 mã), `two_sessions_per_day`, `boarding` (boolean, ít nhất một). Hồ sơ nháp cần quyền lập hồ sơ ở đơn vị, hồ sơ khác cần quyền duyệt ở đơn vị; có hồ sơ chờ duyệt trả `ERR_RULE_VIOLATION` mã YCTD-108 kèm tên, không cập nhật học sinh nào (BR-106). Trả `updated`; mỗi học sinh ghi một dòng `audit_logs`.
4. `PATCH /children/{id}` nhận thêm `two_sessions_per_day`, `boarding` (boolean, không phải thông tin định danh nên không cần `reason`). `GET /children/{id}` trả thêm `two_sessions_per_day`, `boarding`, `sms_phone` và `receives_sms` của từng phụ huynh.
5. `PUT /children/{id}/sms-guardian` cần `P02.child.manage` hoặc `P02.approve`, quyền như sửa phụ huynh. Thân `guardian_id` bắt buộc có trường: mã phụ huynh của học sinh hoặc null để bỏ chọn. Phụ huynh không gắn với học sinh trả `ERR_NOT_FOUND`; phụ huynh chưa có số điện thoại trả `ERR_RULE_VIOLATION` mã YCTD-108; trả hồ sơ học sinh. Tin nhắn SMS, Zalo theo học sinh gửi phụ huynh nhận tin theo BR-105.
6. `GET /student-movements` cần `P02.child.manage` hoặc `P02.approve`, trong phạm vi xem trẻ. Tham số `from`, `to` (YYYY-MM-DD), `kind` (`enrolled`, `class_transfer`, `unit_transfer`, `withdrawn`), `org_unit_id`, `q`, `page`, `page_size` (10, 20, 50, 100, 200). Trả `items` (`id`, `kind`, `date`, `child_id`, `full_name`, `dob`, `gender`, `moet_student_code`, `org_unit_id`, `from_name`, `to_name`, `reason`) mới nhất trước, `total`, `total_pages`, `counts` theo loại. `POST /student-movements/export` cần `P17.data.export`, thân là bộ lọc như trên, trả tệp xlsx và ghi `export_logs` mã `student-movements`.

Giao kèo của học sinh đủ theo hệ thống của Sở (DT-16 phần 16g, YCTD-126, BR-124; vi phạm quy tắc trả `ERR_RULE_VIOLATION` mã YCTD-126):

1. `DELETE /children/{id}` cần `P02.child.manage` ở đơn vị; chỉ hồ sơ nháp, khác thì 422. Trả `{ deleted: true }`; hồ sơ đã xóa đọc lại 404.
2. `POST /children/moet-codes` cần `P02.child.manage`; thân `items` (1 đến 500 `{ child_id, moet_student_code }`, mã 1 đến 50 ký tự); mã trùng học sinh khác hoặc trùng trong thân trả 422 kèm tên. `POST /children/moet-file` cần `P17.data.export` và `P02.national-id.view`, thân là bộ lọc của `GET /children` (thêm `missing_moet_code`), trả tệp xlsx 82 cột (tối đa 10 000 học sinh), ghi `export_logs` mã `moet-student-file`. `POST /children/error-file` cần `P17.data.export`, trả tệp các hồ sơ thiếu, sai ô bắt buộc (cột cuối "Nội dung lỗi"), mã `children-error-file`; không có hồ sơ lỗi trả 422.
3. `GET /children` thêm `missing_moet_code` (true), `national_id_verified` (true, false); dòng trả thêm `national_id_verified_at`, `national_id_verified_by_name`, `residence_change_note`; lọc theo `class_id` thì theo `order_number`. `PATCH /children/{id}` nhận `ethnicity`, `policy_target`, `disability_type` (chuỗi tối đa 100 ký tự, rỗng là xóa), `can_swim` (boolean); cần vai trò xem sức khỏe (BR-53), khác thì 403; đổi `national_id` thì xóa kết quả xác thực. `GET /children/{id}` trả `moet_fields` (null khi không xem được).
4. `GET /student-order?class_id=` cần `P02.child.manage` hoặc `P02.approve` trong phạm vi đơn vị, trả `class` và `items` (`id`, `full_name`, `dob`, `gender`, `moet_student_code`, `order_number`). `POST /student-order/sort` thân `class_id` (bỏ trống là mọi lớp đang dùng trong phạm vi) trả `classes`, `students`. `PUT /student-order/{classId}` thân `child_ids` đủ đúng học sinh đang học của lớp theo thứ tự, thiếu, thừa trả 422.
5. `POST /children/sms-guardians` cần `P02.child.manage` hoặc `P02.approve`; thân `child_ids` (1 đến 500), `relation` (`mother`, `father`, `legal_guardian`, `primary`, `none`); có hồ sơ chờ duyệt trả 422; trả `updated`, `skipped` (tên học sinh không có số theo quan hệ đó).
6. `POST /children/bulk-transfer-class` cần `P02.approve`; thân `items` (1 đến 500 `{ child_id, class_id }`), `reason`, `from_date` (bỏ trống là hôm nay), `confirm_over_capacity`; dòng không hợp lệ trả 422 kèm từng dòng, vượt sĩ số trả 422 mã BR-04; trả `transferred`.
7. `POST /national-ids/verify`, `/national-ids/unverify` cần `P02.approve`; thân `child_ids`; số không đủ 12 chữ số trả 422 kèm tên; trả `verified`, `already` hoặc `unverified`. `PUT /children/{id}/residence-change` thân `note` (tối đa 1000 ký tự, null là xóa). `GET /national-ids/progress`, `/national-ids/duplicates` cần `P02.child.manage` hoặc `P02.approve`, trong phạm vi xem trẻ.
8. `GET /learning-accounts` cần `P01.account.manage`, tham số như `GET /children` và `page`, `page_size` (đến 200). `POST /learning-accounts/issue` thân `child_ids`, `mode` (`create`, `reset`); chỉ học sinh đang học, tạm nghỉ; không có học sinh phù hợp chế độ trả 422; trả `items` (`child_id`, `full_name`, `class_name`, `username`, `password`), `skipped`, `file` (`name`, `content_base64` tệp xlsx), ghi `export_logs` mã `learning-account-passwords`. `POST /learning-accounts/export` cần thêm `P17.data.export`, trả tệp không có mật khẩu.
9. `GET /student-transfers` cần `P02.child.manage` hoặc `P02.approve`; tham số `direction`, `status`, `q`, `page`, `page_size`; trả `items`, `total`, `counts` theo `chiều:trạng thái`. `POST /student-transfers/out` thân `child_id`, `school_name` (bắt buộc), `province_name`, `ward_name`, `transfer_date`, `reason`; trả 201. `POST /student-transfers/{id}/approve`, `/reject` (cần `note`) cần `P02.approve`. `GET /student-transfers/{id}/dossier?format=pdf|xlsx` cần `P17.data.export` và `P02.national-id.view`, mã nhật ký `student-transfer-dossier`. `POST /student-transfers/in` cần `P02.child.manage`, dạng nhiều phần `file` (xls, xlsx, tối đa 5 MB), `org_unit_id`, `school_name`, `province_name`, `ward_name`, `transfer_date` (không sau hôm nay), `reason`; trả `created`, `errors` (dòng lỗi, khi có thì không tạo hồ sơ nào), `transfers`.
10. `GET /student-imports/moet-template` cần `P01.import.children`; `with_data=true` cần thêm `P02.national-id.view`, ghi nhật ký mã `import-template-moet-children`. `GET /student-imports/moet-catalogs` trả `items` danh mục tra cứu. `POST /imports/{id}/commit` nhận `confirm_update` (boolean); lần nhập `moet_children` có dòng cập nhật mà thiếu thì 422. `/imports` nhận loại `sms_phones` (cần `P02.child.manage`), `national_ids`, `student_addresses` (cần `P02.approve`), đủ tệp mẫu, mẫu kèm dữ liệu, danh mục, chọn cột, xuất file lỗi.
11. `GET /administrative-units/new-wards`, `PUT /administrative-units/mappings/{id}` (thân `new_unit_id` là xã mới trong danh mục; trùng dòng đã có trả 422 mã YCTD-116), `DELETE /administrative-units/mappings/{id}` cần `P01.catalog.manage`. `GET /administrative-units/addresses` có `address_type` `transfer_from`.

Giao kèo của gói chuyển trường (YCTD-390 lát L1; BR-480 đến BR-483):

1. `POST /student-transfers/{id}/package` cần `P02.approve` ở đơn vị của đề nghị, thêm `P17.data.export` và `P02.national-id.view` (thiếu trả 403). Thân `optional_parts` (mảng con của `suc-khoe`, `khen-thuong`, không trùng; sai trả 400), `consent_recorded` (boolean, bắt buộc `true` khi có phần thêm, thiếu trả 400), `application_received` (bắt buộc `true`: đã nhận đơn xin chuyển trường của cha mẹ, thiếu trả 400). Chỉ đề nghị chuyển đi chờ duyệt hoặc đã duyệt (khác trả 422 mã BR-480). Trả `package_code`, `package_sha256`, `password` (chỉ trả lần này, không lưu), `parts` (`path`, `label`, `bytes`), `package_file`, `print_file` (`file_name`, `content_base64`); ghi nhật ký xuất mã `student-transfer-package`, lưu mã gói, mã băm, danh sách phần ở `student_transfers`.
2. `POST /student-transfers/package/preview` cần `P02.approve`; đa phần `file` (tối đa 50 MB), `password` (16 chữ, số; khác trả 400). Sai mật khẩu, gói bị sửa, sai định dạng trả 422 mã BR-480. Trả bản kê rút gọn: `package_code`, `created_at`, `source_school`, `transfer_date`, `reason`, `approved_by_name`, `student` (họ tên, ngày sinh, mã Bộ, bốn số cuối số định danh, lớp cũ, cha mẹ), `parts`, `learning_records`, `consent`, `already_received`, `existing_child`.
3. `POST /student-transfers/package/accept` cần `P02.approve` ở đơn vị của lớp; đa phần `file`, `password`, `class_id`, `from_date` (bỏ trống là hôm nay, không sau hôm nay), `confirm_over_capacity`. Gói đã tiếp nhận, học sinh trùng mã Bộ trả 422 mã BR-480; lớp đủ sĩ số chưa xác nhận trả 422 mã BR-04, chưa tạo hồ sơ nào; dòng lỗi của tệp 82 cột trả 200 kèm `errors`. Thành công trả `transfer_id`, `child_id`; hồ sơ Đang học trong lớp (BR-482).
4. `GET /student-transfers/received-learning-records?child_id=` cần `P02.child.manage` hoặc `P02.approve`, học sinh trong phạm vi sửa hồ sơ; trả `id`, `kind` (`learning_record`, `term_results`), `academic_year_name`, `class_name`, `grade_level`, `school_level`, `source_school_name`, `package_code`, `signer_name`, `signed_at`, `has_file`. `GET /student-transfers/received-learning-records/{id}/file` trả PDF nguyên bản (BR-483).

Giao kèo của hộp thư chuyển trường giữa các trường trên nền tảng (YCTD-390 lát L2; BR-510 đến BR-514). Chỉ có ở bản nhiều trường; bản một trường trả 404 (riêng `GET .../mailbox/settings` trả `available: false`, `outbox`, `inbox` trả mảng rỗng):

1. `GET /student-transfers/mailbox/settings` cần `P02.child.manage` hoặc `P02.approve`; trả `available`, `enabled`, `updated_by_name`, `updated_at`. `PUT` cần `P02.approve`, thân `enabled` (boolean; sai trả 400); bật lần đầu tạo khóa nhận và ký của trường.
2. `GET /student-transfers/mailbox/directory?q=` cần `P02.approve`; trường chưa bật trả 422 mã BR-510; trả tối đa 50 trường khác đã bật, đang hoạt động: `school_id`, `name`, `moet_code`, `commune_name`, `school_levels`; không có dữ liệu học sinh.
3. `POST /student-transfers/{id}/send` cần như lập gói (`P02.approve`, `P17.data.export`, `P02.national-id.view`); thân `to_school_id`, `optional_parts`, `consent_recorded`, `application_received` như lập gói. Trường đi hoặc trường đến chưa bật trả 422 mã BR-510; đề nghị đã có thư đang chờ hoặc đã tiếp nhận trả 422 mã BR-511. Trả `mailbox_id`, `package_code`, `to_school_name`, `state`, `sent_at`, `expires_at`.
4. `POST /student-transfers/{id}/revoke` cần `P02.approve`; chỉ thư đang chờ (`sent`, `opened`), khác trả 422 mã BR-511; xóa gói ngay.
5. `GET /student-transfers/mailbox/outbox` cần `P02.child.manage` hoặc `P02.approve`: thư trường mình gửi (`id`, `package_code`, `state`, `decision_note`, `sent_at`, `decided_at`, `expires_at`, `to_school_name`). `GET /student-transfers/mailbox/inbox` cần `P02.approve`: thư gửi cho trường mình (`from_school_name`, `from_school_moet_code` thay cho trường đến).
6. `POST /student-transfers/mailbox/{mailboxId}/preview` cần `P02.approve`; thư không gửi cho trường mình trả 404; thư đã xử lý, thu hồi, hết hạn trả 422 mã BR-511; chữ ký sai, mã băm không khớp trả 422 mã BR-512; trả như xem trước gói kèm `mailbox_id`, thư chuyển sang `opened`. `POST .../accept` thân `class_id`, `from_date`, `confirm_over_capacity` như tiếp nhận gói; thành công thư chuyển sang `accepted` (BR-513). `POST .../reject` thân `note` (1 đến 500 ký tự; sai trả 400), thư chuyển sang `rejected`.

Giao kèo của cập nhật địa danh hành chính (DT-15 phần 15h1, YCTD-116):

1. `GET /administrative-units/addresses` cần `P02.child.manage` hoặc `P02.approve`, trong phạm vi xem trẻ (BR-72); chỉ học sinh nháp, chờ duyệt, đang học, tạm nghỉ có `moet_profile`. Tham số `address_type` (`permanent`, `hometown`, `birth_registration`, `birthplace`, `current`), `suggestion` (`suggested`, `multiple`, `none`), `org_unit_id`, `q` (họ tên, tối đa 100 ký tự), `page`, `page_size` (10, 20, 50, 100, 200). Trả `items` (mỗi phần tử: `id` dạng `<mã học sinh>:<loại địa chỉ>`, `child_id`, `moet_student_code`, `full_name`, `dob`, `org_unit_id`, `class_name`, `child_status`, `address_type`, `old_province`, `old_district`, `old_ward`, `old_ward_code`, `suggestion`, `candidates` gồm `id`, `code`, `ward_name`, `province_name`), `page`, `page_size`, `total`, `total_pages`, `counts` (số địa chỉ theo tình trạng, không tính bộ lọc tình trạng). Không có năm học đang dùng thì danh sách rỗng.
2. `POST /administrative-units/addresses/convert` cần `P02.child.manage` hoặc `P02.approve`. Thân `items` (1 đến 500 phần tử `{ child_id, address_type, new_unit_id? }`; trùng thì gộp). Lỗi dạng trả 400; học sinh ngoài phạm vi trả 404; quyền ở đơn vị như cập nhật hàng loạt (403); hồ sơ chờ duyệt, địa chỉ không còn theo địa danh cũ, chưa có đối chiếu, nhiều xã mới chưa chọn, `new_unit_id` không thuộc các xã đối chiếu thì trả 422 `ERR_RULE_VIOLATION` mã YCTD-116, chi tiết nêu từng địa chỉ, không chuyển địa chỉ nào (BR-115). Thành công trả `{ updated, children }`.
3. `GET /administrative-units/mappings` cần `P02.child.manage`, `P02.approve` hoặc `P01.catalog.manage`. Tham số `q` (tìm theo khóa tên xã cũ, quận/huyện cũ, xã mới), `page`, `page_size`. Mỗi dòng có `id`, `source`, `old_province`, `old_district`, `old_ward` (trống khi đối chiếu theo huyện), `old_ward_code`, `new_province`, `new_ward`, `new_ward_code`.
4. `GET /administrative-units/mappings/template` cần `P01.catalog.manage`, trả tệp mẫu Excel bảy cột kèm trang hướng dẫn. `POST /administrative-units/mappings/import` cần `P01.catalog.manage`, nhận tệp `file` (xlsx, tối đa 5 MB, 2000 dòng). Trả `{ status: 'failed' | 'committed', total_rows, error_rows, errors: [{ row, column, message }], created_units, created_mappings }`; còn dòng lỗi thì không ghi dòng nào.

Giao kèo của cấu hình lưới theo người dùng (DT-15 phần 15a, YCTD-107):

1. Hai điểm cuối chỉ cần đăng nhập, không cần quyền riêng; chỉ đọc và ghi cấu hình của chính tài khoản gọi. Không có mã phiên trả `ERR_UNAUTHENTICATED` (401).
2. `gridKey` phải thuộc `DATA_GRID_KEYS` ở gói dùng chung (`default`, `accounts`, `staff`, từ YCTD-108 thêm `children`, `student-movements`, từ YCTD-109 thêm `roles`, `api-clients`, `audit-logs`, từ YCTD-116 thêm `administrative-addresses`, `administrative-unit-mappings`, từ YCTD-110 thêm `my-feedback`, `feedback`, từ YCTD-111 thêm `branches`, `school-sites`, `classes`, `class-assignments`, từ YCTD-113 thêm 17 khóa của phân hệ Nhân sự – chấm công, lương: `my-leave-requests`, `leave-requests`, `leave-policies`, `leave-balances`, `holidays`, `school-day-changes`, `work-schedules`, `payslips`, `payroll-settlements`, `payroll-adjustments`, `pay-item-types`, `bonus-deductions`, `my-tasks`, `unit-tasks`, `work-plans`, `evaluation-criteria`, `evaluations`, từ YCTD-114 thêm 20 khóa của phân hệ Tài chính – học phí: `services`, `discount-types`, `late-registrations`, `invoices`, `fee-approval-discounts`, `fee-approval-adjustments`, `debts`, `debt-reminders`, `debt-resolutions`, `receipts`, `receipt-reversals`, `payments`, `payment-approvals`, `payment-reversals`, `cash-accounts`, `payables`, `cashflow-categories`, `ledger-accounts`, `ledger-rules`, `fiscal-periods`; từ YCTD-115 thêm 32 khóa của các phân hệ Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng; Báo cáo: `stock-items`, `stock-transactions`, `purchase-orders`, `assets`, `asset-damages`, `stock-counts`, `suppliers`, `my-purchase-requests`, `purchase-requests`, `polls`, `survey-templates`, `interaction-feedbacks`, `lost-items`, `reported-comments`, `content-catalogs`, `news`, `library-items`, `extracurricular-activities`, `lesson-plan-reviews`, `lessons`, `lesson-domains`, `lesson-groups`, `lesson-themes`, `teaching-plans`, `admission-campaigns`, `admission-applications`, `admission-posts`, `recruitment-requests`, `recruitment-approvals`, `job-postings`, `candidates`, `export-logs`; lưới chuyển sang ở các phần sau thêm khóa); khóa lạ trả `ERR_VALIDATION` (400), trường lỗi `gridKey`. Khóa `default` giữ số dòng mỗi trang mặc định cho mọi lưới.
3. `GET /me/grid-settings/{gridKey}` trả `{ columns, page_size }`: `columns` là mảng mã cột theo thứ tự hiển thị hoặc null (theo mặc định của màn hình), `page_size` là số hoặc null; chưa lưu thì cả hai null.
4. `PUT /me/grid-settings/{gridKey}` nhận `{ columns, page_size }` và ghi đè cả cấu hình: `columns` từ 1 đến 100 mã cột, không trùng, mỗi mã 1 đến 64 ký tự chữ, số, `_`, `.`, `-`, null là theo mặc định, lưới `default` không nhận cột; `page_size` là 10, 20, 50, 100, 200 hoặc null. Dữ liệu sai trả `ERR_VALIDATION` (400) kèm trường lỗi và giữ nguyên cấu hình cũ.
5. Số dòng mỗi trang của một lưới trên giao diện: `page_size` của lưới, không có thì của `default`, không có nữa thì 20 (`14_DAC_TA_GIAO_DIEN.md` BC-14).

Giao kèo của ý kiến phản hồi (DT-15 phần 15g, YCTD-110, do máy chủ API phục vụ, lưu ở cơ sở dữ liệu hệ thống):

1. `POST /user-feedback` nhận biểu mẫu nhiều phần hoặc JSON: `feedback_type` (`suggestion`, `bug`, `request`), `title` (1 đến 200 ký tự), `content` (1 đến 5000 ký tự) bắt buộc; `page_url` (bắt đầu bằng `/`, tối đa 500 ký tự), `contact_phone` (9 đến 15 chữ số, có thể có dấu `+` đầu), `contact_email`, tệp `attachment` (JPEG hoặc PNG đến 5 MB, nhận diện theo các byte đầu của tệp, lưu ở kho tệp) không bắt buộc. Mọi tài khoản đăng nhập gửi được; không có mã phiên trả `ERR_UNAUTHENTICATED` (401). Dữ liệu sai trả `ERR_VALIDATION` (400) kèm từng trường lỗi. Trả ý kiến vừa ghi, trạng thái `new`; máy chủ ghi `user_id`, `user_name`, `org_unit_id` (đơn vị của vai trò đầu tiên gán theo đơn vị, vai trò toàn trường thì trống).
2. Giới hạn tần suất (BR-108): tài khoản đã gửi 10 ý kiến trong 60 phút liền trước thì trả `ERR_RATE_LIMIT` (429) kèm `rule_code` YCTD-110 và `retry_after_seconds` (số giây tới khi ý kiến cũ nhất trong khoảng ra khỏi một giờ); đếm trong giao dịch có khóa theo tài khoản nên hai yêu cầu cùng lúc không vượt giới hạn. Giới hạn tính riêng từng tài khoản.
3. `GET /me/user-feedback` trả ý kiến của chính người gọi, `GET /user-feedback` trả mọi ý kiến, mới nhất trước, mỗi dòng gồm `id`, `user_id`, `user_name`, `org_unit_id`, `org_unit_name`, `page_url`, `feedback_type`, `title`, `content`, `contact_phone`, `contact_email`, `attachment_name`, `status`, `reply`, `replied_by_name`, `replied_at`, `created_at`, `updated_at`. `GET /user-feedback` nhận `status` (`new`, `in_progress`, `resolved`), giá trị khác trả `ERR_VALIDATION`. Hai danh sách trả cả danh sách, giao diện phân trang ở trình duyệt.
4. `PUT /user-feedback/{id}` nhận `status` và/hoặc `reply` (tối đa 5000 ký tự, chuỗi rỗng là xóa câu trả lời), phải có ít nhất một trường; không thấy ý kiến trả `ERR_NOT_FOUND` (404). Câu trả lời mới hoặc khác câu cũ thì ghi `replied_by`, `replied_by_name`, `replied_at` và xếp một thông báo trong ứng dụng mã mẫu `feedback_reply` ("Ý kiến phản hồi đã được trả lời") cho người gửi khi có năm học đang dùng; lưu lại đúng câu cũ không báo lại; xóa câu trả lời thì bỏ người và thời điểm trả lời (BR-109).
5. `GET /user-feedback/{id}/attachment` trả ảnh với kiểu nội dung đã lưu; chỉ người gửi hoặc người có `P01.feedback.manage` xem được, người khác và ý kiến không có ảnh nhận `ERR_NOT_FOUND` (404).
6. `GET /user-feedback`, `PUT /user-feedback/{id}` cần `P01.feedback.manage` (VT-01, VT-02, PQ-64), thiếu quyền trả `ERR_FORBIDDEN` (403). `DATA_GRID_KEYS` thêm `my-feedback`, `feedback` cho hai lưới của cổng quản trị. Góp ý của phụ huynh ở `/feedbacks` (mục 16) là chức năng khác, không đổi.

Giao kèo khung trang cổng quản trị (DT-16 phần 16c, YCTD-123, do máy chủ API phục vụ; hai bảng ở cơ sở dữ liệu hệ thống):

1. `POST /system-announcements` nhận `title` (1 đến 200 ký tự), `content` (1 đến 5000 ký tự), `valid_from` (YYYY-MM-DD) bắt buộc, `valid_until` (không trước `valid_from`, không gửi là không hết hạn), `is_active` (đúng hoặc sai, mặc định đúng); trả 201 kèm `id`, `created_by`, `created_by_name`. `PUT /system-announcements/{id}` nhận như `POST` và thay toàn bộ, trả 200. `DELETE` trả 204, không có thông báo trả `ERR_NOT_FOUND` (404). Dữ liệu sai trả `ERR_VALIDATION` (400) kèm từng trường. Mọi thao tác ghi ghi nhật ký thao tác (`system_announcements`) ở năm học đang dùng nếu có.
2. `GET /system-announcements/active` trả các thông báo có `is_active` đúng và hôm nay theo giờ Việt Nam nằm trong `valid_from` đến `valid_until`.
3. `PUT /app-links` nhận `{ links: [{ name, url, description }] }` (0 đến 20 dòng; `name` 1 đến 100 ký tự; `url` bắt đầu bằng `http://` hoặc `https://`; lỗi chỉ rõ trường dạng `links[0].url`), thay cả danh sách theo thứ tự gửi lên; ghi nhật ký thao tác `portal_app_links`. `GET /app-links` trả `name`, `url`, `description`, `position` theo thứ tự.
4. `GET /portal-context` trả `school_name` (tên Trường chính trong cây đơn vị của năm học đang dùng), `school_code` (`general.moet_code` ở hồ sơ trường, chưa có thì mã đơn vị), `academic_year` (tên năm học đang dùng), `education_level` ("Cấp MN"), `organization_id_reminder` (đúng khi người gọi có `P01.school-profile.manage`, đã có Trường chính và `general.electronic_id_code` chưa đúng 12 chữ số). `GET /public/login-info` trả `school_name`, `school_code`, `academic_year`; chưa có năm học hoặc Trường chính thì các trường là null.
5. `PUT /school-profile`: `general.electronic_id_code` có thì phải đúng 12 chữ số (Nghị định 69/2024/NĐ-CP), sai trả `ERR_VALIDATION` trường `general.electronic_id_code` "Mã định danh điện tử của tổ chức gồm đúng 12 chữ số".
6. Thiếu quyền trả `ERR_FORBIDDEN` (403); chưa đăng nhập gọi `/portal-context`, `/system-announcements/active`, `/app-links` trả 401. `DATA_GRID_KEYS` thêm `system-announcements` cho lưới của mục 3.6.

Giao kèo trường, lớp và lịch năm học theo Sở (DT-16 phần 16e, YCTD-127, BR-125):

1. `PUT /settings` nhận thêm ba khóa `school_display_name`, `administrative_unit_name` (kiểu `text`: chữ, bỏ khoảng trắng hai đầu, 1 đến 200 ký tự; `null` là xóa) và `underweight_growth_calculation` (đúng hoặc sai, mặc định đúng). Ba khóa chỉ đặt ở Trường chính: gửi với `org_unit_id` khác trả `ERR_RULE_VIOLATION` (422) mã `YCTD-127`; giá trị sai trả `ERR_VALIDATION` (400). `GET`, `PUT /settings` trả mỗi mục thêm cờ `school` (đúng với ba mục của khối "Cấu hình trường"). `GET /portal-context`, `GET /public/login-info` trả `school_name` là tên trường hiển thị khi có, không thì tên Trường chính. `GET /reports/growth` và `/export`: ô `underweight_growth_calculation` sai thì trẻ suy dinh dưỡng thể nhẹ cân không xếp kênh cân nặng theo chiều cao (gầy còm, thừa cân, béo phì).
2. `GET /academic-years/{id}/weeks` trả mỗi tuần thêm `term` (học kỳ đang áp dụng: `term_type` nếu chọn riêng, không thì học kỳ đầu tiên có ngày trong tuần, không có thì null), `term_type`, `is_visible`. `PATCH /academic-years/{id}/weeks` nhận thêm ở mỗi phần tử `term_type` (`first_term`, `second_term`, `summer_term` hoặc null là theo lịch) và `is_visible` (đúng hoặc sai); không gửi thì giữ giá trị cũ; sai trả `ERR_VALIDATION` trường `weeks[i].term_type`, `weeks[i].is_visible`. `PUT /academic-years/{id}/calendar` đánh số lại tuần nhưng giữ `is_off`, `note`, `term_type`, `is_visible` của tuần cùng ngày bắt đầu.
3. `GET /academic-years/rollover/status` cần `P01.academic-year.manage`; trả `current` (năm học đang dùng hoặc null), `candidates` (năm chờ mở đã có lịch, bắt đầu sau năm đang dùng), `cancel` (`allowed`, `reason`). `POST /academic-years/{id}/cancel-open` cần `P01.academic-year.manage`; điều kiện ở BR-125, không đạt trả `ERR_RULE_VIOLATION` (422) mã `YCTD-127` kèm lý do; đang có thao tác mở năm học khác trả mã BR-93. Thành công trả năm học đã về `draft`. "Thực hiện" dùng `POST /academic-years/{id}/open`, nay ghi thêm `academic_year_databases.carried_over_at`.
4. `POST /classes/delete` nhận `class_ids` (1 đến 200 mã lớp, sai trả `ERR_VALIDATION` trường `class_ids`); `POST /classes/bulk-update` nhận `class_ids` và ít nhất một trong `status` (`active`, `closed`), `two_sessions_per_day`, `boarding` (không có trả `ERR_VALIDATION` trường `changes`). Cả hai cần `P02.class.manage`, xử lý từng lớp trong phạm vi như sửa một lớp và trả `succeeded` (`id`, `name`), `failed` (`id`, `name`, `message`). Xóa lớp ghi `audit_logs` (`delete`) và xóa phân công của lớp; lớp còn dòng tham chiếu hoặc có lớp ghép vào nằm ở `failed`.
5. `GET /class-assignments` nhận thêm `assignment` (`assigned`, `unassigned`; giá trị khác trả `ERR_VALIDATION`). Dòng giáo viên chưa phân công (VT-07, VT-08 ở đơn vị trong phạm vi, từ danh bạ của dịch vụ định danh) có `class_id`, `assignment_role` null; người không đọc được danh bạ chỉ nhận dòng đã phân công. `POST /class-assignments/export` nhận cùng bộ lọc, cột Vai trò trong lớp ghi "Chưa phân công".
6. `/imports` loại `classes`: mẫu, mẫu kèm dữ liệu (`?with_data=true`), tra cứu danh mục và tệp nhập thêm bảy cột `age_group` (Nhóm tuổi, mã hoặc tên, danh mục "Nhóm tuổi"), `sort_order` (Thứ tự, 0 đến 9999), `two_sessions_per_day`, `mixed_age_count` (2 hoặc 3, chỉ lớp mẫu giáo), `is_combined`, `combined_into_code` (Ghép vào lớp: mã lớp đang dùng của cùng đơn vị), `boarding` (Có, Không hoặc x); lỗi báo theo dòng, cột.
7. `GET /accreditation-review` cần `P01.school-profile.manage` hoặc `P17.report.emis`, trả `saved` (bản đã ghi: bảy số, `note`, `collected_at`, `updated_at`; chưa ghi thì null). `POST /accreditation-review/collect` cùng quyền, trả bảy số tính được kèm `collected_at`, không ghi. `PUT /accreditation-review` cần `P01.school-profile.manage` ở phạm vi toàn trường (khác trả `ERR_FORBIDDEN`); nhận `class_count`, `classroom_count`, `subject_room_count`, `child_count` (số nguyên 0 đến 1 000 000 hoặc null), `land_area_m2`, `floor_area_m2`, `area_per_child_m2` (số không âm hoặc null), `note` (tối đa 1000 ký tự), `collected` (đúng thì ghi giờ lấy dữ liệu); sai trả `ERR_VALIDATION`; ghi `audit_logs`. Từ YCTD-136 thêm các ô và đổi giới hạn ghi chú theo giao kèo phần 17e dưới đây.
8. Nhóm `/school-splits` cần `P01.school-profile.manage` ở phạm vi toàn trường (khác trả `ERR_FORBIDDEN`). `POST`, `PATCH /{id}` nhận `destination_school`, `reason` (bắt buộc), `destination_code` (tối đa 500 ký tự), `child_ids`, `staff_ids` (mảng mã, tối đa 2000, ít nhất một đối tượng, mã phải có trong năm học); sai trả `ERR_VALIDATION`. `POST /{id}/status` nhận `action` (`confirm`, `unconfirm`, `receive`) và `note` (ghi chú tiếp nhận). Sửa, xóa yêu cầu đã xác nhận và chuyển trạng thái sai thứ tự trả `ERR_RULE_VIOLATION` (422) mã `YCTD-127`; `DELETE` thành công trả 204. `POST /{id}/export` nhận `subject` (`children`, `staff`, khác trả `ERR_VALIDATION`), cần thêm `P17.data.export`; trả tệp `tach-truong-<mã>-hoc-sinh-….xlsx` (82 cột) hoặc `…-nhan-su-….xlsx` (75 cột) theo mẫu tệp CSDL ngành, ghi `export_logs` mã báo cáo `school-split-children` hoặc `school-split-staff` có dữ liệu cá nhân. Mọi thay đổi ghi `audit_logs`. Không có điểm cuối truyền dữ liệu; chỗ nối `SchoolSplitTransport`.
9. `PORTAL_QUICK_LINK_PATHS` thêm `/accreditation-review`, `/school-splits`, `/school-weeks`, `/year-rollover`; `DATA_GRID_KEYS` thêm `school-splits`. Không có mã quyền mới.

Giao kèo 1.7 Rà soát thông tin kiểm định CLGD đủ ô như Sở (DT-17 phần 17e, YCTD-136, BR-129):

1. `GET /accreditation-review` trả `saved` thêm `school_name`, `school_code`, `ownership_type`, `education_level` (bản ghi trước 17e trống thì trả "Mầm non"), `national_standard_year`, `national_standard_date`, `national_standard_level`, `accreditation_year`, `accreditation_date`, `accreditation_level`, `national_standard_registration`, `floor_area_per_child_m2`. `POST /accreditation-review/collect` trả thêm cùng các ô: `school_name` là tên Trường chính, `school_code` là `general.moet_code` của hồ sơ trường (chưa có thì mã Trường chính), `ownership_type`, chuẩn quốc gia, kiểm định CLGD, `national_standard_registration` lấy ở `general`; `education_level` luôn "Mầm non"; `floor_area_m2` lấy `general.floor_area_m2`, chưa có thì tổng diện tích phòng đang dùng; `floor_area_per_child_m2` là `floor_area_m2` chia `child_count`, làm tròn hai chữ số, trống khi thiếu một trong hai.
2. `PUT /accreditation-review` nhận thêm `school_name` (bắt buộc, tối đa 200 ký tự), `school_code` (bắt buộc, tối đa 20 ký tự), `ownership_type` (bắt buộc: `public`, `private`, `people_founded`), `national_standard_level` (`1`, `2`), `accreditation_level` (`1` đến `4`), `national_standard_registration` (tối đa 100 ký tự), `national_standard_year`, `accreditation_year` (số nguyên 1900 đến 2100), `national_standard_date`, `accreditation_date` (`YYYY-MM-DD`), `floor_area_per_child_m2` (số không âm); chữ bỏ khoảng trắng hai đầu, chuỗi rỗng là null; `note` tối đa 500 ký tự (thay 1000); `education_level` không nhận, máy chủ ghi "Mầm non". Sai trả `ERR_VALIDATION` (400) kèm từng trường. Quyền như mục 7 của giao kèo phần 16e.
3. `PUT /school-profile` nhận ở `general` tám khóa mới `floor_area_m2`, `national_standard_level`, `national_standard_year`, `national_standard_date`, `national_standard_registration`, `accreditation_level`, `accreditation_year`, `accreditation_date` theo kiểu ở `SCHOOL_PROFILE_SECTIONS`; năm ngoài 1900 đến 2100 trả `ERR_VALIDATION` trường `general.national_standard_year` hoặc `general.accreditation_year` "Năm từ 1900 đến 2100". Không có điểm cuối, mã quyền mới.

Giao kèo báo cáo số liệu EMIS theo Sở (DT-16 phần 16j, YCTD-129, BR-127):

1. Mã biểu `{form}`: `emis-start-of-year` (1.1), `emis-facilities` (1.2), `emis-start-of-year-health` (1.3), `emis-end-of-year` (2.1), `emis-staff` (2.2), `emis-foreign-language` (2.3), `emis-preschool-end-of-year` (2.4) (`packages/shared/src/emis.ts`). Mọi điểm cuối của nhóm `/reports/emis/forms` cần `P17.report.emis` ở phạm vi toàn trường, thiếu trả `ERR_FORBIDDEN` (403); mã biểu không có trả `ERR_NOT_FOUND` (404).
2. `GET /reports/emis/forms/{form}` trả `code`, `menu`, `name`, `school_name`, `administrative_unit_name` (tên đơn vị hành chính ở "1.4. Cấu hình trường", chưa đặt thì null), `academic_year`, `generated_on`, `locked` (đúng khi biểu đã đánh dấu đã gửi hoặc đang chờ mở khóa), `tabs` (mỗi thẻ `key`, `label`, `columns` [`key`, `label`], `rows` [`code`, `label`, `unit`, `values` theo mã cột], `editable`, `can_fill`, `can_copy_previous_year`, `saved_at`, `saved_by_name`), `warnings`, `completeness` (`label`, `done`), `extra`.
3. `PUT /reports/emis/forms/{form}/tabs/{tab}` nhận `rows` (mảng `code`, `values` là đối tượng `<mã cột>: số hoặc null`); số âm, lớn hơn 10^12, không phải số, mã chỉ tiêu hoặc mã cột không thuộc thẻ trả `ERR_VALIDATION` (400) trường `rows…`; thẻ tính từ dữ liệu, biểu đang khóa trả `ERR_RULE_VIOLATION` (422) mã `YCTD-129`. Ghi đè từng dòng theo mã chỉ tiêu kèm người ghi, thời điểm; trả như `GET`.
4. `POST /reports/emis/forms/{form}/tabs/{tab}/fill` nhận `source` (`data` là Lấy dữ liệu, `previous_year` là Lấy dữ liệu năm trước; khác trả `ERR_VALIDATION` trường `source`); trả `rows` và `source_name` ("dữ liệu của hệ thống" hoặc "năm học <tên>"), không lưu. Thẻ không có nguồn tương ứng, biểu đang khóa, chưa có năm học trước hoặc năm trước chưa ghi thẻ trả `ERR_RULE_VIOLATION` (422) mã `YCTD-129`. Năm trước là năm học có ngày bắt đầu liền trước năm đang dùng.
5. `POST /reports/emis/forms/{form}/export` trả tệp Excel mỗi thẻ một trang (tên tệp `emis-dau-nam`, `emis-co-so-vat-chat`, `emis-suc-khoe-dau-nam`, `emis-cuoi-nam`, `emis-doi-ngu`, `emis-de-an-ngoai-ngu`, `emis-gdmn-cuoi-nam` kèm `-YYYYMMDD-HHMM.xlsx`), ghi `export_logs` mã báo cáo là mã biểu, không có dữ liệu cá nhân; không cần `P17.data.export`.
6. Bảy biểu đăng ký với `UpperLevelForms` (mục 17.1): Xuất tệp gửi lưu tệp Excel như mục 5 và bản chụp số liệu; quyền của biểu là `P17.report.emis`, quyền mở khóa là `P01.school-profile.manage`; 2.3 cho đánh dấu `no_data`. `POST /upper-level-submissions/{form}/error-file` trả tệp `file-loi-<form>-YYYYMMDD-HHMM.xlsx`. `GET /reports/emis/start-of-year`, `POST /reports/emis/start-of-year/export`, `GET /reports/emis/start-of-year-health` giữ nguyên; bản chụp gửi của 1.1 nay lập bằng biểu chung (sáu trang). Không có mã quyền mới.
7. Từ YCTD-132 (BR-131): `emis-start-of-year` có menu `1.1.1`, tên "Lập báo cáo đầu năm"; thẻ `school_classes`, `children`, `staff`, `rooms` (Biểu 01.ĐN-MN, `code` 01 đến 217, dòng tiêu đề có `heading`) và `budget` (Biểu 08.ĐN-NSNN, `code` 1 đến 71, cột `estimate`, `expected`); cột có thêm `group` (tiêu đề nhóm của hàng thứ nhất); mỗi thẻ có `locked` riêng. Thẻ 1 của `emis-facilities` mã 01 đến 84, cột theo hiện trạng kèm `permanent_new`, `semi_permanent_new` (Xây dựng mới). `emis-end-of-year`, `emis-foreign-language` một thẻ cột `total`; `emis-staff` sáu thẻ. Ở 2.3 `PUT` bỏ số gửi lên của chỉ tiêu 1 đến 4, máy chủ tính lại. `DELETE /reports/emis/forms/{form}/tabs/{tab}` xóa mọi số đã ghi của thẻ nhập tay, trả biểu như `GET`; thẻ tính hoặc thẻ đã khóa trả 422 mã YCTD-129. Biểu mẫu gửi lên cấp trên của 1.1 là năm biểu mẫu riêng `emis-01-school-classes`, `emis-01-children`, `emis-01-staff`, `emis-01-rooms`, `emis-08-budget` (`emis-08-budget` cho đánh dấu `no_data`), thay `emis-start-of-year`.
8. 1.1.2 Gửi báo cáo đầu năm (YCTD-132, `apps/api/src/emis/emis-sending.ts`): mọi điểm cuối cần `P17.report.emis` ở phạm vi toàn trường. `GET /reports/emis/start-of-year/sending` trả `records` (mỗi dòng `record_type` trong `school`, `staff`, `class`, `child`, `health_first_term`, `name`, `total`, `sent`, `to_send`, `last_sent_at`, `status`), `forms` (dòng gửi lên cấp trên của năm biểu mẫu kèm `completion` `complete`, `no_data`, `incomplete` và `completion_label`), `can_manage`, `can_unlock`. `POST /reports/emis/start-of-year/send`, `/error-file`, `/resend` nhận `records`, `forms` (mảng mã hợp lệ, ít nhất một mục; sai trả `ERR_VALIDATION` 400). `send` trả tệp `gui-bao-cao-dau-nam-YYYYMMDD-HHMM.xlsx` (mỗi loại hồ sơ một trang danh sách hồ sơ cần gửi, một trang biểu mẫu đã gửi), ghi `emis_record_submissions` cho hồ sơ cần gửi, với mỗi biểu mẫu xuất tệp gửi rồi đánh dấu đã gửi ngày hôm nay (`no_data` khi không có dữ liệu); biểu mẫu đã gửi, đang chờ mở khóa hoặc chưa đầy đủ dữ liệu trả 422 mã YCTD-132; ghi `export_logs` mã `emis-start-of-year-send`. `error-file` trả tệp `file-loi-bao-cao-dau-nam-YYYYMMDD-HHMM.xlsx` (hồ sơ thiếu mã của Bộ, trẻ chưa có số đo học kỳ I, điều kiện hoàn thành chưa đạt), ghi `export_logs` mã `emis-start-of-year-errors`. `resend` nhận thêm `note` (tối đa 500 ký tự), cần `P01.school-profile.manage` (thiếu trả `ERR_FORBIDDEN` 403); xóa đánh dấu của loại hồ sơ chọn, biểu mẫu đã gửi hoặc đang chờ mở khóa chuyển `resend`; trả như `GET`.
9. Từ YCTD-132: `PATCH /children/{id}` nhận `policy_benefits` (mảng giá trị trong `nd238_learning_cost`, `nd66_nursery_boarding`, `nd57_small_ethnic`, `nd105_lunch`, `nd105_allowance`; giá trị khác trả 400); `PATCH /staff/{id}/profile` nhận `concurrent_disability_support`, `concurrent_shared_position` (đúng sai); điểm cuối phòng nhận, trả `built_this_year`. Các điểm cuối đọc hồ sơ trả thêm các trường này.

Giao kèo phân hệ Quản lý kí hồ sơ, bản chạy nội bộ (DT-16 phần 16k, YCTD-130, BR-128):

1. Mọi điểm cuối của nhóm `/signing` cần một trong bốn quyền `P01.signing.view`, `P01.signing.manage`, `P01.signing.sign`, `P01.signing.certificate` (không có trả `ERR_FORBIDDEN`); dịch vụ kiểm tra quyền của từng thao tác ở phạm vi toàn trường. Vi phạm quy tắc trả `ERR_RULE_VIOLATION` (422) mã YCTD-130.
2. `GET /signing/certificate` trả thông tin chứng thư, `status`, `sync_status`, `synced_on`, `has_seal`, `expired`, `can_manage`, `digital_signer` (luôn sai ở bản nội bộ), `signer_description`, `events`. `PUT /signing/certificate` nhận `signature_type` (`remote`, `usb_token`, `hsm`), `provider`, `login_name`, `holder_name`, `holder_title`, `serial_number` (chữ, tối đa 200 ký tự), `valid_from`, `valid_to` (`YYYY-MM-DD`); thân có `password`, `pin`, `private_key` trả `ERR_VALIDATION`. `POST /signing/certificate/register`, `/revoke`, `/unsync`; `POST /signing/certificate/sync` nhận `synced_on`, `note`. `POST /signing/certificate/seal` nhận tệp nhiều phần `file` (PNG, JPEG, tối đa 1 MB), `GET` trả ảnh, `DELETE` xóa.
3. `GET /signing/objects?object_type=&period=` trả `items` (đối tượng `object_id`, `object_label`, `detail` kèm `dossier` chưa hủy hoặc null); `object_type` là `school`, `class`, `staff`, `child`, `class_log`; `class_log` cần `period` dạng `YYYY-MM`.
4. `POST /signing/dossiers` nhận `object_type`, `object_ids` (1 đến 500 mã), `period`; trả 201 `created`, `codes`. Đối tượng đã có hồ sơ chưa hủy trả 422; đối tượng không có trả 404 và không tạo hồ sơ nào. `POST /signing/dossiers/sign`, `/check-changes`, `/complete` nhận `ids` (1 đến 500); `/mark-sent` nhận thêm `sent_on`, `note`. `POST /signing/dossiers/{id}/cancel` nhận `reason` (bắt buộc), `/uncomplete` nhận `reason` (không bắt buộc). `GET /signing/dossiers/{id}` trả hồ sơ kèm `events`. `GET /signing/dossiers/{id}/file?version=original|signed` trả tệp PDF, ghi `export_logs` mã `signing-dossier` (`contains_personal_data` đúng trừ hồ sơ trường).
5. `GET /signing/submissions?object_type=&status=` trả hồ sơ của năm học đang dùng; không có `status` thì trả hồ sơ Đã kí, Đã xác nhận, Đã gửi. `POST /signing/class-log/export` nhận `class_id`, `month` (`YYYY-MM`), trả tệp Excel sổ đầu bài, ghi `export_logs` mã `signing-class-log`.
6. Chỗ nối chữ ký số: lớp trừu tượng `DossierSigner` (`apps/api/src/signing/dossier-signer.ts`) nhận số liệu, tệp gốc, mã băm, người kí, thông tin chứng thư, ảnh con dấu và trả tệp đã kí kèm `method`; bản nội bộ `InternalDossierSigner` (`digital` sai) đăng ký trong `ApplicationModule`. Khi có nhà cung cấp kí số thì thay bằng lớp gọi giao diện lập trình của nhà cung cấp.
7. Từ YCTD-133 (BR-130): `PUT /signing/certificate` chỉ nhận `signature_type` `remote`, `usb_token` và `provider` trống hoặc một trong VNPT-CA, BkavCA, VIETTEL, Ban Cơ yếu Chính phủ, MISA; `GET` trả thêm `school` (`code`, `name`, `principal_name`, `email`, `website`), `provider_in_list`. `POST /signing/certificate/register` nhận `reason` (không bắt buộc), cần `login_name`; nhà phát hành ngoài danh sách trả 422 mã YCTD-133. `GET /signing/objects` trả thêm `code`, `principal_name`, `stage` (`nhom_tre`, `mau_giao`), `dob`, `person_status`, `job_position`, `class_id`, `class_name`, `create_error`. `POST /signing/dossiers` nhận `note` (tối đa 500 ký tự), trả thêm `errors` (`object_id`, `object_label`, `reason`); `object_type=class_log` trả 422 mã YCTD-133; không đối tượng nào tạo được trả 422 mã YCTD-133 kèm lý do; `staff`, `child` cần `P02.national-id.view` ở phạm vi toàn trường (403). `GET /signing/dossiers/{id}/view` trả `dossier`, `root`, `document` (`sections` có `items` hoặc `table`), `signature` (null khi chưa kí), `xml_schema`; hồ sơ nhân sự, học sinh ghi `export_logs` mã `signing-dossier-view`. `GET /signing/dossiers/{id}/file?version=xml` trả tệp `application/xml`, hồ sơ không có tệp XML trả 422. `GET /signing/create-errors/file?object_type=&period=` trả tệp Excel, ghi `export_logs` mã `signing-create-errors`. `GET /signing/submissions` trả `items` và `school`. Chỗ nối tệp XML: lớp trừu tượng `DossierXmlWriter` (`apps/api/src/signing/dossier-xml.ts`), bản nội bộ `InternalDossierXmlWriter`.

Giao kèo phân hệ Tuyển sinh đầu cấp phần 1, bản chạy nội bộ (DT-17 phần 17c, YCTD-134, BR-132; do máy chủ API phục vụ, dữ liệu ở cơ sở dữ liệu năm học đang dùng):

1. Quyền: điểm cuối xem của `/final-year-records`, `/final-year-completion`, `/final-year-statistics`, `/entry-school-map`, `/school-services`, `/entry-admissions/staff`, `/entry-admissions/classes` cần một trong `P02.final-year.view`, `P02.final-year.manage`, `P02.final-year.approve`; ghi cần `P02.final-year.manage`; `POST /final-year-records/actions` cần `P02.final-year.manage` (`confirm`, `edited`) hoặc `P02.final-year.approve` (`approve`, `unapprove`), kiểm tra lại ở từng hồ sơ theo đơn vị; `GET /admission-support`, `/export` cần thêm hoặc thay bằng `P02.admission-support.reply`, `PUT /admission-support/{id}`, `/notify` cần `P02.admission-support.reply`. Phạm vi theo đơn vị của trẻ (BR-72); thiếu quyền trả `ERR_FORBIDDEN` (403). Nhóm `/parent/...` không cần quyền, kiểm tra quan hệ phụ huynh của trẻ (không phải con trả 403). Vi phạm quy tắc trả `ERR_RULE_VIOLATION` (422) mã `YCTD-134`. Mọi thay đổi ghi `audit_logs` (hồ sơ, `settings`, xác nhận lớp, `org_units`, dịch vụ, yêu cầu hỗ trợ) và `final_year_record_events` với hồ sơ.
2. `GET /final-year-records` nhận `org_unit_id`, `class_id`, `national_id` (đúng 12 chữ số, lọc bằng mã băm), `q` (họ tên, tối đa 100 ký tự), `check` (`complete`, `missing`), `identity_type`, `status`, `registration_source`, `review_status`, `has_location`, `admission_consent` (`true`, `false`), `order` (`school`, `class`); giá trị sai trả `ERR_VALIDATION`. Trả `items` (hồ sơ kèm `national_id` đã che, `missing`, `check_text`, `files`, `guardians`, `has_parent_account`), `edit_deadline`, `today`; sắp A–Z theo tên rồi họ đệm, `order=class` thì theo lớp trước.
3. `PUT /final-year-records/{id}` nhận các ô `identity_type`, `residence_type` (`permanent`, `temporary`, `other` hoặc null), `current_residence`, `house_number`, `street`, `residential_group`, `quarter`, `ward`, `province`, `contact_name`, `routed_school`, `beneficiary`, `priority_form` (chữ tối đa 300 ký tự, rỗng là null), `contact_phone` (10 hoặc 11 chữ số bắt đầu bằng 0), `contact_email`, `registration_source`, `latitude` (−90 đến 90), `longitude` (−180 đến 180; nhận dấu phẩy thập phân, làm tròn sáu chữ số); không có ô nào trả 400; hồ sơ đã duyệt trả 422. `PUT /final-year-records/settings` nhận `edit_deadline` (`YYYY-MM-DD` hoặc null), cần `P02.final-year.manage` ở phạm vi toàn trường.
4. `POST /final-year-records/actions` nhận `action` (`confirm`, `edited`, `approve`, `unapprove`) và `ids` (1 đến 1000 mã hồ sơ); trả `done`, `skipped` (`id`, `full_name`, `reason`). `edited` đưa phụ huynh có tài khoản vào thông báo `final_year_record_edited` (kênh trong ứng dụng). `POST /final-year-records/accounts` nhận `ids`, trả `items` (`record_id`, `child_name`, `class_name`, `guardian_name`, `relationship`, `phone`, `user_id`, `has_account`); cổng quản trị gọi `POST /users/bulk-reset-password` của dịch vụ định danh với các `user_id` này để "Khởi tạo mật khẩu".
5. `POST /final-year-records/export` nhận `filter` như mục 2, trả tệp `ho-so-cuoi-cap-….xlsx` (cột ID đầu tiên), ghi `export_logs` mã `final_year_records`. `POST /final-year-records/pdf` nhận `format` (`a5`, `a4_folded`), `kind` (`information` mặc định, `declaration`), `split` (đúng thì trả `application/zip`, mỗi hồ sơ một tệp PDF), `ids` (không gửi là toàn bộ theo `filter`); không có hồ sơ trả 422; tên tệp `ho-so-cuoi-cap-a5-…`, `phieu-ke-khai-a4-gap-doi-…`; ghi `export_logs` mã `final_year_records_pdf` có dữ liệu cá nhân, mã nhật ký ở tiêu đề `x-export-log-id`. Excel, PDF in đủ số định danh khi người gọi có `P02.national-id.view` ở mọi đơn vị của các hồ sơ, không thì in số đã che; bản mã của hồ sơ nào không giải được thì hồ sơ đó in số đã che, tệp vẫn tạo được. Không cần `P17.data.export`.
6. `POST /final-year-records/import` nhận tệp `file` (Excel theo cột của tệp xuất, cột ID bắt buộc khớp hồ sơ trong phạm vi `P02.final-year.manage`, chưa duyệt); trả `updated`, `errors` (`row`, `column`, `message`); có lỗi thì `updated` là 0, không ghi dòng nào; `?error_file=true` trả tệp `danh-sach-loi-ho-so-cuoi-cap.xlsx`.
7. Giấy tờ: `POST /final-year-records/{id}/files` và `POST /parent/final-year-records/{id}/files` nhận `file` (JPEG, PNG, PDF theo chữ ký tệp, tối đa 10 MB) và `kind` (`birth_certificate`, `residence`, `evidence`), trả 201 thông tin tệp; `GET /final-year-records/files/{fileId}` trả nội dung cho người xem hồ sơ trong phạm vi hoặc phụ huynh của trẻ; `DELETE` cho người có `P02.final-year.manage` hoặc phụ huynh đã tải tệp đó (trước hạn); hồ sơ đã duyệt trả 422. `GET /files/{id}` với tệp `final_year_document` trả 403.
8. Ứng dụng phụ huynh: `GET /parent/final-year-records` trả hồ sơ của con (số đã che, không có `guardians`), `edit_deadline`, `today`. `POST /{id}/confirm`; `POST /{id}/propose` nhận `content` (bắt buộc, tối đa 1000 ký tự); `POST /{id}/consent` nhận `consent` (boolean); ba điểm cuối trả hồ sơ sau khi đổi. Xác nhận, đề xuất, tải, gỡ giấy tờ sau hạn điều chỉnh trả 422 mã YCTD-134.
9. `GET /final-year-completion` trả `items` theo lớp năm cuối cấp (`class_id`, `class_name`, `org_unit_name`, `total`, `complete`, `missing`, `confirmed`, `confirmed_by_name`, `confirmed_at`); `PUT` nhận `items` (1 đến 500, mỗi dòng `class_id`, `confirmed`), lớp không phải lớp năm cuối cấp đang dùng trả 400. `GET /final-year-statistics` trả `items` (`org_unit_id`, `org_unit_name`, `unit_type`, `total`, `missing`, `complete_rate`). Hai `export` ghi `export_logs` mã `final_year_completion`, `final_year_statistics` (không có dữ liệu cá nhân).
10. `GET /entry-school-map` trả `school` (Trường chính) và `sites` kèm `missing`, `check_text`, `map_confirmed_at`, `map_confirmed_by_name`; `PUT /entry-school-map/{unitId}` nhận `latitude`, `longitude`, `province`, `ward`, `quarter`, `address` (tối đa 300 ký tự), `phone` (tối đa 20 ký tự); `POST /entry-school-map/confirm` cần quyền ở Trường chính, Trường chính thiếu vị trí trả 422.
11. `POST`, `PUT /school-services` nhận `code` (bắt buộc, tối đa 50 ký tự), `name` (bắt buộc, tối đa 200 ký tự), `sort_order` (0 đến 9999); cần phạm vi toàn trường; trùng mã trả `ERR_CONFLICT` (409). `GET` trả thêm `finance_service_name` của `services` cùng mã. `POST /school-services/delete` nhận `ids` (1 đến 500), trả `removed`. Xuất Excel mã `entry_school_services`. `GET /entry-admissions/staff` nhận `code`, `name`, `phone`; xuất mã `entry_staff`. `GET /entry-admissions/classes` nhận `grade_level`, trả `grade_levels`, `items` kèm `homeroom_teachers`. Mục 3.1, 3.2 dùng `GET /roles` của dịch vụ định danh và `GET /account-directory` (danh sách người dùng của 1.4), Xuất Excel của 3.2 dùng xuất danh sách người dùng của 1.4.
12. `GET /admission-support` nhận `q`, `national_id` (12 chữ số), `status` (`pending`, `answered`), trả số định danh của trẻ đã che. `PUT /admission-support/{id}` nhận `reply` (tối đa 2000 ký tự; rỗng là chưa trả lời). `POST /admission-support/notify` nhận `ids` (1 đến 500), trả `sent`, `skipped`, `email_available`; mỗi yêu cầu đã có câu trả lời nhận thông báo `admission_support_reply` cho người gửi, gửi thêm thư qua chỗ nối `AdmissionSupportMailer` khi `available` (bản mặc định `UnconfiguredAdmissionSupportMailer` không gửi), ghi `notified_at`, `notified_channels`. Xuất Excel mã `admission_support_requests`. `POST /parent/admission-support` nhận `child_id` (con của người gọi), `content` (bắt buộc, tối đa 2000 ký tự), `email`, `phone`, trả 201; `GET` trả yêu cầu của người gọi kèm câu trả lời.
13. `PORTAL_QUICK_LINK_PATHS` thêm mười đường dẫn `/entry-admissions/...`; `DATA_GRID_KEYS` thêm `final-year-records`, `final-year-completion`, `final-year-statistics`, `entry-school-sites`, `entry-school-services`, `entry-roles`, `entry-users`, `entry-staff`, `entry-classes`, `admission-support-requests`; `PERMISSION_CODES` thêm `finalYearView`, `finalYearManage`, `finalYearApprove`, `admissionSupportReply`. `GET /auth/me` trả 13 phân hệ cho nhóm có đủ phân hệ.

Giao kèo phân hệ Tuyển sinh đầu cấp phần 2, bản chạy nội bộ (DT-17 phần 17d, YCTD-135, BR-133; do máy chủ API phục vụ, nhóm `/entry-intake`, dữ liệu ở cơ sở dữ liệu năm học đang dùng):

1. Quyền: `GET /entry-intake/campaigns`, `/options`, `/applications`, `/files/{fileId}`, `/notices/recipients`, `/transfers/results` và `POST /evidence`, `/export`, `/forms` cần một trong `P02.entry-intake.view`, `P02.entry-intake.manage`, `P02.entry-intake.transfer`; `PUT /campaigns/{id}`, `PUT /applications/{id}`, `POST /save`, `/review`, `/remove`, `/cancel`, `GET /import-template`, `POST /import`, `POST /applications/{id}/files`, `DELETE /files/{fileId}`, `POST /notices/copy`, `/notices/send`, `GET /notices/template`, `POST /notices/import` cần `P02.entry-intake.manage`; `PUT /transfers`, `POST /transfers/arrange`, `/transfers/run`, `/transfers/cancel` cần `P02.entry-intake.transfer`. Phạm vi theo đơn vị của hồ sơ, là đơn vị của đợt (BR-72); thiếu quyền hoặc ngoài phạm vi trả `ERR_FORBIDDEN` (403). Vi phạm quy tắc trả `ERR_RULE_VIOLATION` (422) mã `YCTD-135`. Mọi thay đổi ghi `audit_logs`. Danh sách mã chọn `ids` gồm 1 đến 1000 mã.
2. `GET /entry-intake/campaigns` trả `items` (`id`, `name`, `status`, `org_unit_id`, `program_type`, `target_academic_year_id`, `open_from`, `open_to`) trong phạm vi. `PUT /campaigns/{id}` nhận `program_type` (`general`, `advanced`, `survey`) và `target_academic_year_id` (mã năm học hoặc null). `GET /options` trả `academic_years` (kèm `status`), `org_units`, `classes` đang dùng, `relationships` (danh mục quan hệ).
3. `GET /applications` nhận `screen` (`intake` mặc định, `advanced`, `notices`, `transfer`, `transferred`) và bộ lọc `campaign_id`, `final_year_school`, `residence_type`, `ward`, `quarter`, `province`, `national_id` (đủ 12 chữ số thì lọc bằng mã băm, ít hơn thì so số cuối), `q` (họ tên hoặc mã hồ sơ), `dob` (`YYYY-MM-DD`), `father_name`, `mother_name`, `decision` (`accepted`, `not_accepted`), `doc_admission_notice`, `doc_declaration`, `doc_birth_certificate_copy`, `routed`, `has_phone`, `notice_sent`, `transferred` (`yes`, `no`), `program_type`, `school_review`, `ward_review`, `record_type`, `package_code`, `guid`, `student_code`; chữ tối đa 200 ký tự; giá trị sai trả `ERR_VALIDATION`. `intake`, `notices` là hồ sơ phân tuyến và hồ sơ đạt, đã chuyển, đã hủy nhập học; `advanced` là các hồ sơ đó của đợt tiên tiến; `transfer` là hồ sơ chuyển được và hồ sơ đã chuyển; `transferred` là hồ sơ đã chuyển hoặc đã hủy nhập học sau khi chuyển. Trả `items` (số định danh đã che, `files`, `has_parent_account`, `last_notice_at`, `planned_class_name`, `target_org_unit_name`, `student_code`, `transfer_package_code`, `transfer_guid`, `last_transfer_note`, `last_transfer_succeeded`).
4. `PUT /applications/{id}` nhận các ô gửi lên (ô không gửi giữ nguyên): `residence_type`, `current_residence`, `address` (tối đa 300 ký tự), `residential_group`, `quarter`, `ward`, `province`, `father_name`, `mother_name`, `final_year_ward` (tối đa 100 ký tự), `place_of_birth`, `final_year_school` (tối đa 200 ký tự), `advanced_criteria` (tối đa 1000 ký tự), `advanced_achievements` (tối đa 2000 ký tự), `registered_at`, `ward_review`, `guardian_full_name` (bắt buộc khi gửi), `guardian_phone` (10 hoặc 11 chữ số bắt đầu bằng 0), `guardian_email`, `guardian_relationship_item_id` (có trong danh mục), `child_has_allergies` (`true`, `false`, null), `national_id` (12 chữ số; rỗng là giữ); trả hồ sơ sau khi sửa. Hồ sơ đã chuyển hoặc đã hủy trả 422. `POST /save` nhận `items` (1 đến 1000 dòng `id`, `submitted_documents` trong năm giá trị, `admission_decision` `pending`, `accepted`, `declined`); `POST /review` nhận `review` (`admitted`, `not_admitted`, `pending`) và `ids`; `POST /remove`, `POST /cancel` nhận `ids`; bốn điểm cuối trả `done`, `skipped` (`id`, `full_name`, `reason`).
5. `GET /import-template` trả tệp `mau-danh-sach-phan-tuyen.xlsx` 22 cột (Họ và tên, Ngày sinh, Giới tính, Người liên hệ, Số điện thoại bắt buộc). `POST /import` nhận `campaign_id` và tệp `file`; trả `created`, `errors` (`row`, `column`, `message`); có lỗi thì `created` là 0, không ghi dòng nào; `?error_file=true` trả tệp `danh-sach-loi-phan-tuyen.xlsx` kèm cột nội dung lỗi; đợt đã đóng trả 422.
6. Giấy tờ: `POST /applications/{id}/files` nhận `file` (JPEG, PNG, PDF theo chữ ký tệp, tối đa 10 MB) và `kind` (`birth_certificate`, `residence`, `evidence`), trả 201 thông tin tệp; `GET /files/{fileId}` trả nội dung cho người xem trong phạm vi; `DELETE /files/{fileId}` gỡ tệp; hồ sơ đã chuyển hoặc đã hủy trả 422. Tệp ở bảng `files` mục đích `admission_document`.
7. Tệp xuất: `POST /evidence` nhận `ids`, trả tệp nén `minh-chung-….zip` (mỗi hồ sơ một thư mục theo mã hồ sơ), không có minh chứng trả 422, ghi `export_logs` mã `entry_intake_evidence`. `POST /export` nhận `screen`, `filter` như mục 3, trả tệp Excel theo cột của màn hình, ghi `export_logs` mã `entry_intake_<screen>`. `POST /forms` nhận `kind` (`information` là phiếu thông tin, `registration` là phiếu đăng ký) và `ids`, trả tệp PDF khổ A5 mỗi hồ sơ một trang (`phieu-thong-tin-…`, `phieu-dang-ky-…`), ghi `export_logs` mã `entry_intake_information`, `entry_intake_registration`. Mã nhật ký ở tiêu đề `x-export-log-id`; nhật ký đều có dữ liệu cá nhân. Excel, PDF in đủ số định danh khi người gọi có `P02.national-id.view` ở mọi đơn vị của các hồ sơ, không thì in số đã che. Không cần `P17.data.export`.
8. Thông báo (1.5): `GET /notices/recipients` nhận `campaign_id` (không có thì trả danh sách trống) và bộ lọc như mục 3; trả `items` (`key`, `application_id` hoặc `contact_id`, `external`, số định danh đã che, `phone`, `notice_content`, `final_year_school`, `moet_code`, `last_notice_at`, `has_parent_account`); lọc `program_type`, `routed`, `decision`, `ward`, `quarter` thì bỏ học sinh ngoài hệ thống. `POST /notices/copy` nhận `campaign_id`, `content` (bắt buộc, tối đa 1000 ký tự), `application_ids`, `contact_ids` (ít nhất một người), trả `updated`. `POST /notices/send` nhận `campaign_id`, `content` (không bắt buộc), `application_ids`, `contact_ids`; người nhận không có nội dung riêng khi `content` trống trả 422; mỗi người có tài khoản phụ huynh cùng số điện thoại nhận thông báo mẫu `entry_admission_notice` kênh `in_app`, `zalo`; trả `notice_id`, `recipients`, `delivered`, `not_delivered`. `GET /notices/template?kind=content|external` trả tệp mẫu nội dung gửi hoặc học sinh ngoài hệ thống; `POST /notices/import` nhận `campaign_id`, `kind`, `file`, trả `updated` hoặc `created` kèm `errors`, `?error_file=true` trả tệp lỗi.
9. Chuyển hồ sơ (1.6, 5.11): `PUT /transfers` nhận `items` (`id`, `target_org_unit_id` hoặc null, `record_type` `account`, `free`). `POST /transfers/arrange` nhận `ids`, `class_id` (null là bỏ xếp lớp). `POST /transfers/run` nhận `ids`, `clear_classes`, `confirm_duplicates` (boolean); năm học nhận trẻ chưa chọn, chưa tạo, đã đóng hoặc chưa mở trả 422; trả `package_code` (`GT-` kèm thời điểm và bốn ký tự) và `results` (`application_id`, `code`, `full_name`, số định danh đã che, `guid`, `succeeded`, `note`). Mỗi hồ sơ chuyển được gọi tạo hồ sơ trẻ của `ChildrenService` (cần `P02.child.manage` ở đơn vị nhận), gửi trình duyệt, duyệt và xếp lớp khi có lớp và người gọi có `P02.approve` ở đơn vị đó; giấy khai sinh chuyển mục đích `birth_certificate`; lỗi của hồ sơ nào ghi vào kết quả của hồ sơ đó. `GET /transfers/results` nhận `kind` (`transfer` mặc định, `cancel`), `package_code`; trả `packages`, `items` (tối đa 2000 dòng mới nhất). `POST /transfers/cancel` nhận `ids`, trả `package_code` (`HN-…`) và `results`.
10. `GET /public/admission-applications/lookup` (YCTD-86) trả nhãn "Đã hủy nhập học" cho hồ sơ `cancelled`. Bước chuyển tuyển sinh khi mở năm học mới chép thêm `admission_application_files` và dòng `files` của hồ sơ được chuyển, bỏ trống `target_org_unit_id` khi đơn vị không còn. `PORTAL_QUICK_LINK_PATHS` thêm sáu đường dẫn (`/entry-admissions/advanced`, `/intake`, `/notices`, `/transfer`, `/transfer-results`, `/admitted-students`); `DATA_GRID_KEYS` thêm `entry-advanced`, `entry-intake`, `entry-notices`, `entry-transfer`, `entry-transfer-results`, `entry-cancel-results`, `admitted-students`; `PERMISSION_CODES` thêm `entryIntakeView`, `entryIntakeManage`, `entryIntakeTransfer`.

Giao kèo phân hệ KPI (DT-18 phần 18d, YCTD-139, BR-135; do máy chủ API phục vụ, nhóm `/kpi`, dữ liệu ở cơ sở dữ liệu năm học đang dùng):

1. Quyền: đọc bộ quy tắc, phiên bản, kỳ cần một trong năm quyền `P09.kpi.*`; ghi bộ quy tắc, phiên bản, kỳ, khóa và mở lại kỳ, đối tượng, chuyển dữ liệu cần `P09.kpi.configure`; danh mục chung cần `P09.kpi.configure` toàn trường, danh mục đơn vị cần `P09.kpi.manage` hoặc `P09.kpi.configure` ở đơn vị; giao việc, ủy quyền cần `P09.kpi.manage`; thao tác của người thực hiện cần `P09.kpi.participate` và là chính người đó; duyệt, chấm, trả lại, kết luận cần là người được ủy quyền, cấp trên trực tiếp hoặc có `P09.kpi.manage` ở đơn vị của người thực hiện, và không phải chính người đó. Vi phạm quy tắc trả 422 `ERR_RULE_VIOLATION` mã `YCTD-139`.
2. Thiết lập: `GET /kpi/rule-sets` (kèm `versions`), `GET /kpi/rule-versions/{id}` (kèm `config`), `POST /kpi/rule-sets` (`code`, `name`, `description`, `copy_from_version_id`), `PATCH /kpi/rule-sets/{id}`, `POST /kpi/rule-sets/{id}/versions`, `PATCH /kpi/rule-versions/{id}` (`config`, `note`; chỉ bản nháp; lỗi cấu hình trả 400 theo `config.<đường dẫn>`), `POST /kpi/rule-versions/{id}/publish`, `DELETE /kpi/rule-versions/{id}` (bản nháp); `GET /kpi/profiles` (`org_unit_id`, `q`), `PUT /kpi/profiles` (`staff_ids`, `rule_set_id`, `subject_group`, `school_level`, `job_position`, `superior_staff_id`, `is_head`, `excluded`); `GET /kpi/periods` (kèm `rule_versions`), `POST /kpi/periods`, `PATCH /kpi/periods/{id}`, `PUT /kpi/periods/{id}/rule-versions`, `POST /kpi/periods/{id}/lock` (`note`; vượt tỷ lệ xuất sắc trả 422), `POST /kpi/periods/{id}/reopen` (`note` bắt buộc).
3. Danh mục: `GET /kpi/catalog` (`org_unit_id`, `common`, `rule_set_id`, `status`, `school_level`, `job_position`, `q`), `GET /kpi/catalog/indicator-progress`, `GET /kpi/catalog/export`, `GET /kpi/catalog/template`, `POST /kpi/catalog/import` (`org_unit_id`, `rule_set_id`, tệp; `?error_file=true` trả tệp lỗi), `POST /kpi/catalog`, `POST /kpi/catalog/proposals`, `PATCH /kpi/catalog/{id}`, `POST /kpi/catalog/{id}/decision` (`approve`, `note` bắt buộc khi không duyệt).
4. Việc: `GET /kpi/tasks/mine`, `GET /kpi/tasks` (`period_id` bắt buộc, `org_unit_id`, `staff_id`, `status`, `q`), `GET /kpi/tasks/staff-options`, `GET /kpi/tasks/{id}` (kèm `files`), `POST /kpi/tasks/assign` (`period_id`, `staff_ids`, `catalog_item_id` hoặc `name`, `axis_code`, `task_type`, `difficulty_code`, `deadline`, `is_confidential`), `POST /kpi/tasks/register`, `POST /kpi/tasks/{id}/decision` (`approve`, `note`, `difficulty_code`), `/accept`, `/return` (`reason`), `PATCH /kpi/tasks/{id}`, `/cancel` (`reason`), `/extension` (`requested_deadline`, `reason`), `/extension/decision`, `PUT /kpi/tasks/{id}/evidence` (`actual_finish_date`, `evidence_text`, `document_number`), `POST|GET|DELETE /kpi/tasks/{id}/files[/{fileId}]`, `/self-assess` (`quality_code` hoặc `result_code`, `bonus_proposed`, `bonus_reason`), `/grade` (`quality_code` hoặc `result_code`, `progress_percent`, `progress_adjust_reason`, `exceeded`, `bonus_approved`, `difficulty_code`, `comment`), `/rework` (`reason`), `POST /kpi/tasks/delegate` (`task_ids`, `evaluator_staff_id` hoặc null để thu hồi, `note`). Các lần đọc áp hạn tự động trước khi trả.
5. Phiếu: `GET /kpi/evaluations/mine`, `PUT /kpi/evaluations/mine` (`period_id`, `criteria` [`code`, `satisfied`, `note`], `self_rank`, `self_comment`), `POST /kpi/evaluations/mine/submit`, `GET /kpi/evaluations`, `GET /kpi/evaluations/{id}`, `POST /kpi/evaluations/{id}/return` (`reason`), `POST /kpi/evaluations/{id}/conclude` (`criteria`, `exclusions`, `exclusion_note`, `rank`, `comment`); `GET|PUT /kpi/advisory` (`items` [`evaluation_id`, `rank`, `comment`], kèm `quotas`); `GET|PUT /kpi/voting` (`votes` [`evaluation_id`, `rank`, `comment`]).
6. Báo cáo (mỗi lần tải ghi `export_logs` mã `kpi-…`): `GET /kpi/reports/evaluations/{id}/task-sheet?format=xlsx|pdf`, `/self-evaluation?format=docx|pdf`, `/monthly-sheet?format=docx|pdf`; `GET /kpi/reports/periods/{id}/annual-sheet?staff_id=…`, `/summary`, `/unit-summary?format=xlsx|pdf|docx`, `/manager-actions`, `/manager-actions/export`; `GET /kpi/reports/regulation?rule_set_version_id=…&school_level=…`.
7. `POST /kpi/legacy-import` (tệp sao lưu SQLite tối đa 100 MB, `preview` mặc định true): trả `preview`, `periods`, `catalog_items`, `tasks`, `evaluations`, `profiles`, `unmatched_people`, `skipped_tasks`; tệp không phải SQLite trả 400.

Giao kèo của hồ sơ trường, khai báo cơ sở vật chất, thiết bị dạy học, báo cáo EMIS đầu năm (DT-14 phần 14d, YCTD-106):

1. `GET /school-profile` cần `P01.school-profile.manage` hoặc `P17.report.emis`, trả hồ sơ của năm học đang dùng kèm Trường chính (chưa ghi thì các thẻ trống). `PUT /school-profile` cần `P01.school-profile.manage` ở phạm vi toàn trường; nhận một hoặc nhiều thẻ `general`, `other_info`, `foreign_elements`, `internet`, `it_infrastructure` (đối tượng khóa cố định) và `office_accounts` (mảng dòng `account_name` bắt buộc, `holder_name`, `position`, `email`); thẻ gửi lên thay toàn bộ, thẻ không gửi giữ nguyên. Thẻ lạ, trường lạ, số âm, số lẻ ở ô số nguyên, ngày không đúng `YYYY-MM-DD`, giá trị chọn ngoài danh sách, chữ quá 500 ký tự, mật khẩu trong tài khoản trả `ERR_VALIDATION`. Mỗi lần ghi ghi nhật ký thao tác.
2. `POST /rooms`, `PATCH /rooms/{id}` nhận thêm `room_block`, `room_type`, `condition`, `area_m2`, `facility_attributes` (không bắt buộc); loại phòng không thuộc khối (khi sửa chỉ một trong hai thì so với giá trị đang lưu), thuộc tính lạ, giá trị ngoài danh sách trả `ERR_VALIDATION`. `GET /rooms` trả thêm các trường này.
3. `GET /facilities/rooms` cần `P17.report.facilities`, `P01.room.manage` hoặc (từ YCTD-340) `P13.equipment.manage`; lọc `org_unit_id` (trong phạm vi), `room_block`, `room_type`, `condition`, `status`; trả phòng kèm nhóm, lớp đang hoạt động gắn phòng và tổng hợp phòng đang dùng theo khối, hiện trạng kèm tổng diện tích. `POST /facilities/rooms/export` nhận cùng bộ lọc, trả tệp Excel hai trang.
4. `GET /equipment-items` cần `P13.equipment.manage` hoặc `P17.report.facilities`, lọc `age_group`, `is_minimum`. `POST /equipment-items`, `PATCH /equipment-items/{id}` cần `P13.equipment.manage` ở phạm vi toàn trường; mã trùng trả `ERR_CONFLICT`; không nhập mã thì tự đánh `TT-0001` (danh mục tối thiểu) hoặc `NDM-0001` (ngoài danh mục); `PATCH` sửa tên, định mức, ghi chú, `status` (`active`, `inactive`) và ghi nhật ký thao tác.
5. `GET /equipment-holdings` cần `org_unit_id`. `PUT /equipment-holdings` cần `P13.equipment.manage` trong phạm vi đơn vị; nhận `org_unit_id`, `items` (1 đến 500 dòng: `equipment_item_id`, `class_id` trống là dòng của đơn vị, `quantity`, `next_year_need` chỉ ở dòng đơn vị, `note`); ghi lại thì thay số cũ. Lớp của đơn vị khác, nhu cầu ở dòng lớp trả `ERR_VALIDATION`; đơn vị ngừng sử dụng trả `ERR_RULE_VIOLATION` mã `BR-75`. `POST /equipment-assets` nhận `asset_id`, `equipment_item_id` (trống là bỏ gắn).
6. `GET /equipment-report` cần `P17.report.facilities` hoặc `P13.equipment.manage`; lọc `org_unit_id`, `class_id`, `age_group`, `equipment_group`, `development_area`, `is_minimum`; trả từng thiết bị với định mức, hiện có, thừa, thiếu, tỷ lệ đáp ứng, nhu cầu năm sau, tỷ lệ đáp ứng chung, theo lớp và danh sách lớp chưa xếp được nhóm tuổi (BR-102). `POST /equipment-report/export` trả tệp Excel hai trang.
7. `GET /reports/emis/start-of-year` cần `P17.report.emis` ở phạm vi toàn trường; trả năm thẻ của Biểu 1, năm học, loại hình và cảnh báo (BR-104). `POST /reports/emis/start-of-year/export` trả tệp Excel năm trang.
8. Ba điểm cuối xuất ghi một dòng `export_logs` (mã báo cáo `facility-rooms`, `equipment-summary`, `emis-start-of-year`, không có dữ liệu cá nhân), trả mã nhật ký ở tiêu đề `x-export-log-id`; không cần `P17.data.export`.
9. Vi phạm quy tắc nghiệp vụ của phần này (ghi số lượng hoặc gắn tài sản cho thiết bị ngừng dùng, gắn tài sản đã thanh lý) trả `ERR_RULE_VIOLATION` với mã chung của đợt DT-14 là `YCTD-102`.

Giao kèo cơ sở vật chất theo Sở (DT-16 phần 16i, YCTD-128, BR-126):

1. `GET /facilities/report` cần `P17.report.facilities` hoặc `P01.school-profile.manage`; `org_unit_id` trong phạm vi (trống là mọi đơn vị trong phạm vi); trả `figures` (dòng khối, loại phòng, tổng), `toilets` (`rows`, `group_rooms`, `group_rooms_ensuite`, `group_rooms_adjacent`), `standard` (năm khối kèm `level`, `note`, `hints`), `overall_level` (mức thấp nhất hoặc null), `completeness`, `whole_school`.
2. `PUT /facilities/report/standard-levels` cần `P01.school-profile.manage` toàn trường; nhận `items` (`room_block` trong năm khối không lặp, `level` not_met, level_1, level_2, `note` tối đa 500 ký tự); ghi nhật ký thao tác; trả báo cáo toàn trường.
3. `GET /facilities/investments` cần `P17.report.facilities` hoặc `P01.school-profile.manage` toàn trường; trả `items` (classroom, teacher_housing kèm `suggestion`), `class_count`, `classes_without_room`, `can_manage`. `PUT` cần `P01.school-profile.manage` toàn trường; số nguyên không âm (tối đa 100 000), `need_budget_million` không âm làm tròn hai chữ số.
4. `/facility-imports` cùng dạng điểm cuối với `/imports` (mục 17.1) cho loại `rooms` (cần `P01.room.manage`, đơn vị của dòng trong phạm vi) và `equipment_items` (cần `P13.equipment.manage` toàn trường); loại khác trả `ERR_VALIDATION`; ghi lần nhập còn dòng lỗi hoặc đã ghi trả `ERR_RULE_VIOLATION` mã YCTD-128.
5. Biểu mẫu gửi lên cấp trên mới (mục 17.1, P17-20): `facilities-report` ("Báo cáo cơ sở vật chất", quyền `P17.report.facilities`, không cho trường không có dữ liệu) và `equipment-summary` ("Tổng hợp thiết bị dạy học", cho trường không có dữ liệu); quyền mở khóa `P01.school-profile.manage`; cả hai cần phạm vi toàn trường. Tệp gửi là tệp Excel của 1.2 (mã báo cáo `facilities-report`) và của 2.1 (`equipment-summary`).
6. `POST /rooms`, `PATCH /rooms/{id}` nhận thêm `facility_attributes.toilet_users`, `toilet_standard`, `toilet_separate_gender`, `toilet_seats`; gửi cho phòng không phải loại `toilet` trả `ERR_VALIDATION`.

Giao kèo thiết bị: nơi để, tem QR, kiểm kê, đối sánh danh mục tối thiểu (DT-18 phần 18g, YCTD-143, BR-138):

1. `GET /equipment-locations` cần `P13.equipment.manage`, `P17.report.facilities` hoặc `P13.equipment.stocktake`, lọc `org_unit_id`; trả kèm `room_name`, `parent_name`, `target_count`. `POST` (`org_unit_id`, `code` tối đa 30 ký tự, `name`, `location_type` room/store/position, `room_id`, `parent_id`, `note`), `PATCH /equipment-locations/{id}` (thêm `status`) cần `P13.equipment.manage` trong phạm vi; trùng mã 409; nơi để cha phải không nằm trong nơi khác.
2. `GET /equipment-placements` (`org_unit_id`, `location_id` gồm vị trí con, `target_type` asset/holding, `search`) trả tài sản chưa thanh lý và lô (còn số hoặc đã có tem): `target_type`, `id`, `code`, `name`, `unit`, `quantity`, `location_id`, `location_name`, `qr_code`, `org_unit_name`. `PUT /equipment-placements` (`org_unit_id`, `location_id` hoặc trống để bỏ, `targets` 1 đến 500 dòng `{target_type, id}`) cần `P13.equipment.manage`.
3. `POST /equipment-labels` (`org_unit_id`, `targets`) cần `P13.equipment.manage`: cấp mã tem còn thiếu, trả tệp PDF (`application/pdf`, `tem-qr-thiet-bi-….pdf`), ghi `export_logs` mã `equipment-labels`. `GET /equipment-qr/{code}` nhận mã tem hoặc đường dẫn có mã, trả thiết bị, lô trong phạm vi (400 khi không phải tem, 404 khi không có trong phạm vi).
4. `GET /equipment-stocktakes` (`org_unit_id`, `status`) và `GET /equipment-stocktakes/{id}` (kèm `lines` có `status`, `difference`, `qr_code` và `summary`) cần `P13.equipment.manage` hoặc `P13.equipment.stocktake`. `POST /equipment-stocktakes` (`org_unit_id`, `name`, `started_on`, `location_id`, `members`, `note`) cần `P13.equipment.manage`, trả kèm `line_count`; đơn vị đang có đợt chưa chốt trả `ERR_RULE_VIOLATION` `YCTD-143`.
5. `POST /equipment-stocktakes/{id}/scan` (`qr_code` hoặc `line_id`, `condition`, `counted_quantity`, `usable_quantity`, `found_location_id`, `note`) cần `P13.equipment.manage` hoặc `P13.equipment.stocktake` trong đơn vị của đợt, trả dòng đã ghi. `POST …/submit`, `…/approve`, `…/return` (`note` bắt buộc), `…/cancel`, `…/close` cần `P13.equipment.manage`; sai trạng thái hoặc còn dòng chưa kiểm khi nộp trả `ERR_RULE_VIOLATION` `YCTD-143`; `close` trả `applied` (`holdings`, `moved`, `damages`, `skipped`). `POST …/minutes` (`format` pdf hoặc xlsx) trả biên bản, ghi `export_logs` mã `equipment-stocktake-minutes`.
6. `GET /equipment-templates` cần `P13.equipment.manage` hoặc `P17.report.facilities`: `code`, `school_level`, `title`, `source`, `item_count`, `loaded_count`. `POST /equipment-templates/{code}/load` (`retire_placeholders`) cần `P13.equipment.manage` toàn trường, trả `added`, `existing`, `retired`. `GET /equipment-minimum` (`org_unit_id`, `school_level` mặc định MN, `status` enough/short/none) trả `rows`, `totals`, `catalog_count`, `not_applicable_count`, `unclassified_classes`; `POST /equipment-minimum/export` (thêm `format`) ghi `export_logs` mã `equipment-minimum`. Từ YCTD-345: `school_level` không gửi thì là cấp mặc định của trường (cấp đầu tiên đang bật), cấp chưa bật trả 422 (`YCTD-152`), mã lạ 400; kết quả có thêm `catalog_source` (`standard`, `legal_basis`, `note`); chỉ lớp của cấp đang đối sánh, lớp cấp phổ thông khớp thiết bị theo mã khối. `GET /equipment-minimum/levels` (cùng quyền) trả mỗi cấp đang bật: `school_level`, `standard` (chỉ MN là true), `legal_basis`, `note`, `template_codes`, `catalog_count` (thiết bị tối thiểu đang dùng). `POST /equipment-templates/{code}/load` với mẫu của cấp chưa bật trả 422. `GET /equipment-items` lọc thêm `school_level`, trả thêm `school_level`, `template_code`; `POST`, `PATCH /equipment-items` nhận `school_level` (không gửi thì suy từ `age_group`); `age_group` nhận thêm `K1` đến `K12` (TH K1–K5, THCS K6–K9, THPT K10–K12); khối không thuộc cấp, `development_area` ở cấp phổ thông trả 400; cấp chưa bật trả 422. Nhập Excel danh mục thiết bị suy cấp từ cột Nhóm tuổi (ghi khối với cấp phổ thông), báo lỗi dòng của cấp chưa bật.
7. `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm năm khóa lưới: `equipment-locations`, `equipment-labels`, `equipment-stocktakes`, `equipment-stocktake-lines`, `equipment-minimum`.

Giao kèo của cân nặng, chiều cao, thống kê theo tiêu chí ngành, hồ sơ chưa nhập đủ (DT-14 phần 14a, YCTD-105):

1. `POST /growth-rounds` nhận `org_unit_id`, `name` (trùng trong đơn vị trả `ERR_RULE_VIOLATION`), `measured_on` (sau hôm nay trả `ERR_VALIDATION`), `note`; lập, xóa đợt cần `P10.health.manage` trong phạm vi đơn vị. `GET /growth-rounds` cần `org_unit_id`, trả số số đo của từng đợt và `can_manage`. `DELETE` đợt đã có số đo trả `ERR_RULE_VIOLATION`.
2. `GET /growth-rounds/{id}/measurements` nhận `class_id`, trả học sinh đang học trong lớp vào ngày cân đo kèm số đo, tháng tuổi, BMI, chỉ số Z, kênh và `can_edit`; giáo viên chủ nhiệm chỉ đọc lớp mình. `PUT` nhận `rows` (1 đến 500 dòng: `child_id`, `weight_kg` 1 đến 150, `height_cm` 30 đến 200, `note`), nhận dấu phẩy thập phân; trống cả hai số là xóa số đo của học sinh trong đợt; trả `saved_count`, `removed_count`. Học sinh không thuộc đơn vị của đợt trả `ERR_RULE_VIOLATION`; sinh sau ngày cân đo hoặc số đo ngoài khoảng trả `ERR_VALIDATION`.
3. `GET /growth-rounds/{id}/template` trả tệp Excel mẫu của lớp (`class_id`). `POST /growth-rounds/{id}/import` nhận biểu mẫu nhiều phần (`file`), so khớp theo mã học sinh hoặc họ tên và ngày sinh; có dòng lỗi thì không lưu dòng nào, trả lỗi từng dòng; dòng trống cả hai số bỏ qua.
4. `GET /children/{id}/growth` trả các lần đo (số đo sức khỏe, số đo của đợt, kết quả khám định kỳ; phụ huynh chỉ thấy kết quả khám đã công bố) kèm chỉ số Z, kênh và đường chuẩn WHO (trung vị, ±2SD, ±3SD) cho cân nặng, chiều cao theo tuổi. Quyền xem theo BR-53 và PQ-57.
5. `GET /reports/growth` cần `P17.report.growth`; nhận `round_id` hoặc `month` (`YYYY-MM`, thiếu cả hai trả `ERR_VALIDATION`), lọc `org_unit_id`, `gender`, `channel`; trả theo lớp, theo khối kèm tổng cộng, theo đơn vị và danh sách học sinh. `GET /reports/growth/export` trả tệp Excel ba bảng, ghi một dòng `export_logs` mã báo cáo `growth` có dữ liệu cá nhân, trả mã nhật ký ở tiêu đề `x-export-log-id`; không cần `P17.data.export`.
6. `GET /statistics/classes`, `/statistics/children`, `/statistics/missing-child-fields` cần `P17.child-statistics.view`; `GET /statistics/staff`, `/statistics/missing-staff-fields` cần `P17.staff-statistics.view`; đều lọc `org_unit_id` trong phạm vi. Hai điểm cuối hồ sơ chưa nhập đủ nhận `field` để trả danh sách hồ sơ thiếu trường đó; trường không có trong danh sách trả `ERR_VALIDATION`.
7. Vi phạm quy tắc nghiệp vụ của phần này trả `ERR_RULE_VIOLATION` với mã chung của đợt DT-14 là `YCTD-102`.

Giao kèo sức khỏe, dinh dưỡng và thống kê học sinh theo Sở (DT-16 phần 16h, YCTD-125, BR-123):

1. `GET /student-health` nhận `class_id`, `term` (`first_term` hoặc `second_term`), thiếu hoặc sai trả `ERR_VALIDATION`. Trả `class`, `term`, `term_range` (học kỳ trong lịch năm học, chưa khai báo thì null), `can_edit` và `rows` của học sinh đang học trong lớp: `child_id`, `full_name`, `dob`, `gender`, `record_id`, `measured_on`, `weight_kg`, `height_cm`, `growth_round_id`, `physical_education`, `can_swim`, `eye_conditions`, `note`, `latest_growth` (số đo gần nhất trong các đợt cân đo của đơn vị thuộc học kỳ, không có thì null). Xem được khi là vai trò văn phòng được xem dữ liệu y tế của đơn vị, có `P10.health.manage` hoặc `P17.report.growth` của đơn vị, hoặc là giáo viên chủ nhiệm của lớp; người khác nhận `ERR_FORBIDDEN`.
2. `PUT /student-health` nhận `class_id`, `term`, `rows` (1 đến 500 dòng: `child_id` không lặp và đang học trong lớp, sai trả lỗi trường `rows[i].child_id`; `weight_kg` 1 đến 150, `height_cm` 30 đến 200, nhận dấu phẩy thập phân; `measured_on` dạng `YYYY-MM-DD`; `physical_education` `passed`, `not_passed` hoặc trống; `can_swim` đúng, sai hoặc null; `eye_conditions` mảng mã thuộc `myopia`, `hyperopia`, `astigmatism`, `cataract`, `macular_degeneration`, `dry_eye`, `strabismus`; `note`). Dòng trống mọi ô thì xóa dòng của học sinh trong học kỳ. Trả `saved_count`, `removed_count`. Cần `P10.health.manage` trong đơn vị của lớp, thiếu trả `ERR_FORBIDDEN`. Mỗi dòng ghi `audit_logs` (`student_health_records`).
3. `POST /student-health/pull-growth` nhận `class_id`, `term`; chép `weight_kg`, `height_cm`, `measured_on`, `growth_round_id` của số đo gần nhất trong học kỳ, không đổi ô khác; trả `updated_count`, `missing_count` (học sinh chưa có số đo). Không có số đo nào trả `ERR_RULE_VIOLATION` (422) mã `YCTD-125`. Quyền như `PUT`.
4. `GET /student-health/export` nhận `class_id`, `term`; trả tệp `suc-khoe-hoc-sinh-hk1.xlsx` hoặc `suc-khoe-hoc-sinh-hk2.xlsx` một trang "Sức khỏe học sinh"; ghi `export_logs` mã báo cáo `student-health` có dữ liệu cá nhân, trả mã nhật ký ở tiêu đề `x-export-log-id`. Quyền như xem; không cần `P17.data.export`.
5. `GET /reports/growth` nhận thêm `term` (thay `round_id`, `month`; thiếu cả ba trả `ERR_VALIDATION` trường `round_id`) và `compare_round_id` (chỉ đi kèm `round_id`, không thì `ERR_VALIDATION` trường `compare_round_id`; trùng đợt đang xem trả `ERR_VALIDATION`; ngoài phạm vi trả `ERR_FORBIDDEN`). Trả thêm `term`, `term_range`, `comparison` (`first_rounds`, `last_rounds`, `classes` mỗi lớp có `first`, `last`, `change` cho tám khóa `enrolled`, `measured`, `underweight`, `stunted`, `wasted`, `overweight`, `obese`, `all_normal`, và `totals` cùng dạng; không có so sánh thì null); mỗi dòng tổng hợp có thêm `examined`, `examined_female`, `examined_percent`. `GET /reports/growth/export` thêm cột "Được khám định kỳ", "Tỷ lệ khám định kỳ (%)" và trang "So sánh hai lần cân đo" khi có so sánh; tên tệp theo học kỳ là `tong-hop-can-do-hk1.xlsx`, `tong-hop-can-do-hk2.xlsx`.
6. `GET /statistics/students` cần `P17.child-statistics.view`, nhận `org_unit_id` (trong phạm vi), `term` (mặc định học kỳ chứa hôm nay; sai trả `ERR_VALIDATION`). Trả `on_date`, `term`, `term_range`, `org_unit_ids`, `totals`, `age_groups`, `by_age`, `by_class` (mỗi lớp `total`, `female`, `ages`), `by_ethnicity`, `completion` (`class_count`, `categories` với khóa `children`, `female`, `disabled`, `ethnic`, `martyr_family`, mỗi khóa có `count`, `completed`, `not_completed`, `percent`), `policy_by_age`, `term_health` (`recorded`, `totals`, `by_age`; mỗi phần có `swimming`, `not_swimming`, `eye_any`, `eye_conditions`, `physical_education_passed`, `physical_education_not_passed` dạng số và số nữ), `ethnic` (`count`, `female`, `by_ethnicity`, `students`), `eye_condition_labels`. `GET /statistics/students/export` nhận thêm `format` (`xlsx` mặc định hoặc `pdf`), dựng năm bảng bằng `buildTableFile` của 16a, tên tệp `thong-ke-hoc-sinh-hk1.xlsx` (hoặc `.pdf`), ghi `export_logs` mã báo cáo `student-statistics` có dữ liệu cá nhân; không cần `P17.data.export`. `GET /statistics/children` giữ nguyên.
7. `GET /reports/emis/start-of-year-health` cần `P17.report.emis` ở phạm vi toàn trường, thiếu trả `ERR_FORBIDDEN`. Trả `school_name`, `ownership`, `term_range` (học kỳ I), `generated_on`, `rows` cùng dạng dòng của Biểu 1 (`code` 1.3.01 đến 1.3.17, `label`, `unit`, `total`, `public`, `private`, `people_founded`, `female`, `ethnic_minority`; ba cột loại hình null khi chưa khai báo loại hình), `warnings`. Điểm nối cho phần 16j: màn hình 1.3, xuất tệp và đăng ký biểu mẫu với `UpperLevelForms` (mục 17.1 ý 4) dùng hàm `EmisHealthReportService.startOfYearHealth`; tên, mã chỉ tiêu cần đối chiếu biểu mẫu chính thức của Sở trước khi gửi.
8. `POST /menus` nhận thêm `name` (tối đa 200 ký tự), `month` (`YYYY-MM` hoặc `MM/YYYY`), `week_no` (1 đến 60), `from_date` (bắt buộc khi không gửi `week_start_date`), `to_date`, `grade_levels` (mảng mã khối hoặc chuỗi cách nhau bằng dấu phẩy, chấm phẩy; mã không có trong danh mục trả `ERR_VALIDATION`); `week_start_date`, `age_group` cũ vẫn nhận. Đến ngày ngoài tuần của từ ngày trả `ERR_VALIDATION` trường `to_date`; trùng khối với thực đơn khác cùng tuần trả `ERR_VALIDATION` trường `grade_levels`. Danh sách, chi tiết trả thêm `name`, `month`, `week_no`, `from_date`, `to_date`, `grade_levels`; `GET /menus` lọc thêm `month`. `PUT /menus/{id}` nhận các trường thông tin chung (không gửi thì giữ), chỉ thực đơn nháp, khác trả `ERR_RULE_VIOLATION` mã BR-59; ghi `audit_logs`. `GET /children/{id}/menus` chọn thực đơn đã công bố có khối của trẻ, không có thì thực đơn mọi khối.
9. `/menu-imports` cùng dạng điểm cuối với `/imports` (mục 17.1) cho loại `menus` (loại khác trả `ERR_VALIDATION`); mọi điểm cuối cần `P12.kitchen.manage`, tải lên, ghi, tệp lỗi cần thêm quyền quản lý bếp của đơn vị. Cột mẫu: Tên thực đơn, Tháng, Tuần, Từ ngày, Đến ngày, Khối áp dụng, Thứ (2 đến 7 hoặc CN), Bữa, Món ăn, Ghi chú; cột luôn nhập `menu_name`, `from_date`, `weekday`, `meal_type`, `dish`; `updates_existing`, `template_with_data` sai. `POST /menu-imports` nhận biểu mẫu nhiều phần `file`, `org_unit_id` (bắt buộc), `columns` (mã cột cách nhau bằng dấu phẩy); trả 201 kèm `id`, `status` (`validated` hoặc `failed`), `total_rows`, `error_rows`, `errors` (dòng, cột, nội dung), `menu_count`. `POST /menu-imports/{id}/commit` chỉ khi `validated`, lần nhập còn lỗi hoặc đã ghi trả `ERR_RULE_VIOLATION` mã YCTD-121; kiểm tra lại trùng tuần, trùng khối rồi ghi thực đơn nháp kèm món, ghi `audit_logs`. `GET /menu-imports/{id}/error-file` chỉ khi có lỗi.
10. `PORTAL_QUICK_LINK_PATHS` thêm `/student-health`, `/student-statistics`; `DATA_GRID_KEYS` thêm `student-statistics-ethnic`. Không có mã quyền mới.

Giao kèo của hoàn thành chương trình, nhóm học sinh, chuẩn nghề nghiệp (DT-14 phần 14c, YCTD-104):

1. `PUT /program-completion/classes/{id}` nhận `items` (`child_id`, `result` là `completed` hoặc `not_completed`, `note` tối đa 500 ký tự); cần `P02.program-completion.manage` (VT-07 chỉ lớp đang chủ nhiệm). Lớp không phải mẫu giáo 5-6 tuổi, lớp đã xác nhận trả `ERR_RULE_VIOLATION`; trẻ không học lớp hoặc giá trị sai trả `ERR_VALIDATION`.
2. `confirm`, `unconfirm` cần `P02.program-completion.approve` trong phạm vi đơn vị của lớp; `confirm` khi lớp không có trẻ hoặc còn trẻ chưa có kết quả trả `ERR_RULE_VIOLATION`; `unconfirm` nhận `reason` bắt buộc, ghi nhật ký thao tác (giá trị trước là dòng xác nhận, giá trị sau là lý do).
3. `GET /program-completion/statistics` trả theo lớp, theo đơn vị và tổng: số lớp, số lớp đã xác nhận, số trẻ đang học, hoàn thành, chưa hoàn thành, chưa ghi, `completion_rate` (phần trăm làm tròn 2 chữ số, lớp không có trẻ là 0). `GET /program-completion/export` trả tệp Excel (STT, đơn vị, lớp, họ tên, ngày sinh, giới tính, kết quả, ghi chú, trạng thái xác nhận), ghi một dòng `export_logs` mã báo cáo `program-completion` có dữ liệu cá nhân; người xem được danh sách thì xuất được.
4. `POST /child-groups` nhận `org_unit_id`, `name` (trùng trong đơn vị trả `ERR_CONFLICT`), `description`, `teacher_staff_id` (hồ sơ nhân sự đang làm việc của đơn vị); `PATCH` nhận các trường trên và `status` (`active`, `inactive`). `members` và `members/remove` nhận `child_ids` (1 đến 200); chỉ trẻ đang học của đơn vị có nhóm, thêm trùng không lỗi, nhóm ngừng dùng không thêm được. Ghi cần `P02.child-group.manage`; giáo viên đọc được nhóm mình phụ trách và nhóm có trẻ lớp mình (PQ-55).
5. `PATCH /professional-standards/{id}`, `POST`, `PATCH /professional-criteria` cần `P07.professional-standard.manage` ở phạm vi toàn trường; tiêu chí mới tự đánh mã tiếp theo số lớn nhất của chuẩn; sửa danh mục chỉ áp cho phiếu mở sau.
6. `POST /professional-evaluations` nhận `standard_type` (`teacher`, `principal`), `staff_ids`; trả số phiếu đã mở và danh sách nhân sự bỏ qua vì đã có phiếu; nhân sự có tài khoản nhận thông báo mời tự đánh giá. Phiếu chuẩn hiệu trưởng cần `P07.professional-standard.manage`, phiếu chuẩn giáo viên cần `P07.professional-standard.assess` trong phạm vi đơn vị chính của nhân sự; mở phiếu của chính mình trả `ERR_FORBIDDEN`.
7. `PUT /{id}/self` nhận `items` (`criterion_id`, `rating` là `not_met`, `met`, `good`, `excellent`, `evidence` tối đa 2000 ký tự), chỉ chủ phiếu ở trạng thái `self_assessing`; `submit-self` khi còn tiêu chí chưa có mức trả `ERR_RULE_VIOLATION`. `PUT /{id}/assessment` nhận `items` (`criterion_id`, `rating`, `note`) và `comment`, chỉ khi phiếu `self_submitted`; `finalize` khi còn tiêu chí chưa có mức của người đánh giá trả `ERR_RULE_VIOLATION`, đủ thì tính `overall_level` theo BR-99 và thông báo kết quả cho nhân sự. Người đánh giá ghi hoặc chốt phiếu của chính mình trả `ERR_FORBIDDEN`.
8. `GET /me/professional-evaluation` trả `evaluation` trống khi chưa có phiếu. `GET /professional-evaluations/statistics` trả theo loại chuẩn số phiếu, đã chốt, chưa chốt, số phiếu và tỷ lệ từng mức trên số phiếu đã chốt.
9. Vi phạm quy tắc nghiệp vụ của phần này trả `ERR_RULE_VIOLATION` với mã chung của đợt DT-14 là `YCTD-102`.

Giao kèo của Truy cập nhanh (DT-14 phần 14b, YCTD-102):

1. Hai điểm cuối chỉ cần đăng nhập, không cần quyền riêng; chỉ đọc và sửa lối tắt của chính tài khoản gọi. Không có mã phiên trả `ERR_UNAUTHENTICATED` (401).
2. `GET /me/quick-links` trả danh sách `{ path, label, position }` theo `position` tăng dần; tài khoản chưa ghim trang nào nhận danh sách rỗng.
3. `PUT /me/quick-links` nhận `{ links: [{ path, label }] }` và thay cả danh sách trong một giao dịch, khóa theo tài khoản để hai lần lưu cùng lúc chạy lần lượt; thứ tự trong mảng là thứ tự hiển thị, `position` đánh lại từ 0; mảng rỗng xóa hết lối tắt.
4. Trả `ERR_VALIDATION` (400) kèm trường lỗi (ví dụ `links[0].path`) và giữ nguyên dữ liệu cũ khi `links` không phải mảng, quá 12 mục (`MAX_QUICK_LINKS`), đường dẫn ngoài danh sách cho phép `PORTAL_QUICK_LINK_PATHS` ở gói dùng chung (không gồm Trang chủ và Đổi mật khẩu), trùng đường dẫn, nhãn rỗng hoặc dài hơn 100 ký tự.
5. Máy chủ không đối chiếu quyền theo từng trang; mỗi trang vẫn tự kiểm tra quyền khi mở và gọi dữ liệu.

Giao kèo của nhóm điểm cuối kho, tài sản và mua hàng (DT-10 phần 10d, YCTD-77):

1. `POST /purchase-requests` nhận `org_unit_id` (bỏ trống khi người lập chỉ được gán một đơn vị), `needed_by` (không trước hôm nay), `reason`, `items` (1 đến 100 dòng `item_name`, `quantity` lớn hơn 0 tối đa hai chữ số thập phân, `unit`, `estimated_price` số nguyên đồng lớn hơn 0, `note`); cần `P13.purchase-request.create` ở đơn vị. Kết quả có `code` (DNMH-000001), `status` `pending`, `total_amount`, `requires_principal` (đúng khi từ hạn mức loại `purchase_request` trở lên hoặc đơn vị chưa đặt hạn mức).
2. `GET /purchase-requests?view=` nhận `mine` (mặc định, đề nghị của người gọi), `pending` (chờ duyệt của người khác trong phạm vi `P13.purchase-request.approve`; VT-15 chỉ thấy `requires_principal` sai), `approved` (đã duyệt trong phạm vi `P13.purchase-order.manage`), `all`; lọc thêm `status`, `org_unit_id`. `GET /purchase-requests/{id}` cho người lập hoặc người có quyền duyệt, lập phiếu mua, `P06.payment.manage` ở đơn vị.
3. `POST /purchase-requests/{id}/approve`, `reject` (`reason` bắt buộc) cần `P13.purchase-request.approve` ở đơn vị; `requires_principal` đúng mà người gọi không có vai trò VT-02 trả `ERR_FORBIDDEN`; người lập tự duyệt trả `ERR_FORBIDDEN`; đề nghị không chờ duyệt trả `ERR_RULE_VIOLATION` mã BR-63.
4. `POST /purchase-orders` nhận `request_id`, `supplier_id` (nhà cung cấp đang dùng của đơn vị), `order_date` (không sau hôm nay), `note`, `items` (`item_name`, `stock_item_id` tùy chọn là mặt hàng kho đang dùng của đơn vị, `quantity`, `unit_price`); cần `P13.purchase-order.manage`. Đề nghị chưa duyệt hoặc đã lập phiếu trả mã BR-63. Kết quả có `code` (PMH-000001), `total_amount`, `status` `ordered`, `payment_status` `awaiting_payment`.
5. `POST /purchase-orders/{id}/receive` nhận `received_date` (từ ngày mua đến hôm nay); nhận đủ cả phiếu một lần, dòng có `stock_item_id` sinh phiếu nhập kho; đã nhận trả mã BR-62. `POST /purchase-orders/{id}/payment` nhận `payment_id`; cần `P06.payment.manage`; phiếu chi chưa phát hành, khác đơn vị, khác số tiền hoặc phiếu mua đã thanh toán trả mã BR-28; phiếu chi đã gắn phiếu mua khác trả `ERR_CONFLICT`.
6. `POST /stock-transactions` nhận `org_unit_id`, `transaction_type` (`receipt`, `issue`), `transaction_date` (không sau hôm nay), `note`, `lines` (`stock_item_id`, `quantity`, `unit_price` tùy chọn); cần `P13.asset.manage`. Một dòng xuất vượt tồn thì cả phiếu bị từ chối mã BR-62 với câu báo "Xuất vượt tồn" và tồn hiện tại. Kết quả có `code` (PNK- hoặc PXK-) và các dòng kèm `balance_after`.
7. `POST /stock-opening-balances` nhận `org_unit_id`, `balance_date`, `lines` (`stock_item_id` không trùng, `quantity`, `unit_price` bắt buộc); mặt hàng đã có bất kỳ giao dịch nào (kể cả chuyển năm) trả mã BR-62.
8. `POST /stock-counts` nhận `org_unit_id`, `count_date`, `note`, `lines` (`stock_item_id`, `actual_qty` từ 0, `note`); kết quả có `lines` với `system_qty`, `actual_qty`, `difference` và `status` `matched` hoặc `pending`. `approve` cần `P13.stocktake.approve` ở đơn vị, người lập không tự duyệt, ghi phiếu điều chỉnh DCK theo `difference`; `reject` nhận `reason` bắt buộc; biên bản không chờ duyệt trả mã BR-62.
9. `POST /assets` nhận `org_unit_id`, `code` (trùng trả `ERR_CONFLICT`), `name`, `category`, `unit`, `original_cost`, `purchase_date`; `PUT /assets/{id}` nhận các trường trên trừ mã và đơn vị, `status` chỉ nhận `disposed`. `POST /asset-assignments` nhận `asset_id`, `assigned_to_type` (`room`, `class`, `staff`, `unit`), `assigned_to_id`, `assigned_to_name`, `received_by_name`, `assigned_on`, `note`; `POST /asset-loans` nhận `asset_id`, `borrower_name`, `borrower_user_id`, `from_date`, `due_date`, `note`; tài sản không trong kho trả mã BR-61. `return` của hai loại phiếu nhận ngày trả và ghi chú; đã trả trả mã BR-61. `GET /asset-loans` có `overdue`.
10. `POST /asset-damages` nhận `asset_id`, `incident_type`, `severity`, `description`, `occurred_on`, `proposed_handling`; tài sản đã mất, đã thanh lý hoặc đang có ghi nhận chờ duyệt trả mã BR-61. `approve` (ghi chú tùy chọn), `reject` (`note` bắt buộc) cần `P13.purchase-request.approve` ở đơn vị, người ghi nhận không tự duyệt.
11. Danh sách tài sản, phiếu mượn, hỏng mất cho người có `P13.asset.manage` hoặc `P13.purchase-request.approve`; mặt hàng và sổ kho cho `P13.asset.manage`, `P13.purchase-order.manage`, `P13.stocktake.approve`; kiểm kê cho `P13.asset.manage`, `P13.stocktake.approve`; nhà cung cấp cho `P13.asset.manage`, `P13.purchase-order.manage`; phiếu mua hàng cho `P13.purchase-order.manage`, `P06.payment.manage`; đều trong phạm vi đơn vị.

Giao kèo của y tế học đường phần hồ sơ, khám, sự kiện, chăm sóc, báo cáo (DT-10 phần 10a, YCTD-74):

1. Chỉ số và kết quả khám trả `evaluation` dạng `{ height_cm | weight_kg | bmi: below | normal | above }`, chỉ có chỉ số đã có tiêu chuẩn phù hợp.
2. `POST /children/{id}/health-measurements` nhận `measured_on`, `height_cm` (30 đến 200), `weight_kg` (1 đến 150), `vision_left`, `vision_right`, `note`; cần ít nhất một chỉ số.
3. `POST /health-standards` nhận `indicator_code`, `gender`, `age_month_from`, `age_month_to` (0 đến 120), `lower_value`, `upper_value`, `source_document`; trùng khoảng trả mã P10-11.
4. `POST /health-check-schedules` nhận `campaign_id`, `class_id`, `check_date`, `location`; trả thêm `notified_count`; lớp đã có lịch trong đợt trả `ERR_CONFLICT`. `PUT /health-check-campaigns/{id}/results` nhận `child_id`, `height_cm`, `weight_kg`, `result_data`, `conclusion`, `note`; đợt đã đóng trả mã P10-06.
5. `POST /medical-events` nhận `child_id`, `occurred_at` (ISO 8601, không sau hiện tại), `symptoms`, `handling`, `handler_name` (trống là người ghi), `severity` (`mild`, `moderate`, `severe`). Ghi xong thì ngoài phụ huynh, quản lý đơn vị của trẻ (VT-03) nhận thông báo trong ứng dụng (mẫu `medical_event_manager`); sự kiện `severe` leo thang: VT-03, Hiệu trưởng (VT-02), Phó Hiệu trưởng phụ trách đơn vị (VT-15) nhận mẫu `medical_event_severe` (QT-07 bước 8, YCTD-344). `GET /medical-events` nhận `child_id` hoặc `org_unit_id`, `from`, `to`. `POST /medical-events/{id}/acknowledge` chỉ phụ huynh của trẻ, gọi lại trả thời điểm xác nhận lần đầu.
6. `POST /daily-care-logs` nhận `child_id`, `care_date` (trống là hôm nay), `temperature` (34 đến 43), `condition_note`, `special_care_note`.
7. `POST /health-report-requests` nhận `child_id`, `report_type` (`growth`, `medical`, `full`), `period_from`, `period_to`, `note`; đã có yêu cầu đang chờ trả mã P10-08. `GET /health-report-requests` nhận `status`; y tế thấy yêu cầu trong đơn vị, phụ huynh thấy yêu cầu của mình kèm `report_data`. `POST /health-report-requests/{id}/send` nhận `response_note`.

Giao kèo của mở năm học mới (DT-09 phần 9d, YCTD-69):

1. `POST /academic-years/{id}/open` trả `ERR_RULE_VIOLATION` mã BR-89 kèm `details` từng trẻ đã thôi học hoặc ra trường còn nợ (`Tên: số tiền`); mã BR-94 kèm số chứng từ chờ duyệt theo loại.
2. Danh sách và chi tiết phiếu thu có `carried_over`; `POST /receipts/{id}/reverse` với phiếu có `carried_over` trả mã BR-29; `GET /reports/cash-flow` không gồm phiếu này.

Giao kèo của lịch nghỉ và lịch công tác (DT-09 phần 9c, YCTD-68):

1. `GET /work-schedules?org_unit_id=&month=` cần `P08.work-schedule.manage` hoặc `P08.attendance.view` trong phạm vi; trả từng lịch kèm `full_name`, `status`, `published_at`.
2. `POST /work-schedules` nhận `staff_id`, `schedule_date`, `schedule_type` (`business_trip`, `day_off`), `note`; ngày ngoài thời gian làm việc trả `ERR_VALIDATION`; kỳ công đã chốt trả mã Q-135; trùng ngày trả `ERR_CONFLICT`.
3. `POST /work-schedules/publish` nhận `org_unit_id`, `month`; trả `published_count`; không có lịch nháp trả mã P08-02.
4. `GET /me/work-schedules?month=` trả lịch đã công bố của người đăng nhập; tháng trống là tháng hiện tại.

Giao kèo của chuyển đơn vị, thôi học, đồng ý hình ảnh (DT-09 phần 9b, YCTD-67):

1. `POST /children/{id}/transfer-unit` nhận `class_id`, `reason`, `effective_date` (trống là hôm nay), `confirm_over_capacity`; còn số phải nộp trả mã LP-02 kèm `outstanding_amount`; trả `from_org_unit_id`, `to_org_unit_id`, `from_class_id`, `to_class_id`, `effective_date`.
2. `POST /children/{id}/withdraw` nhận `reason`, `leave_date` (trống là hôm nay); trả `status`, `leave_date`, `outstanding_amount`, `credit_amount`.
3. `POST /children/{id}/photo-consent` nhận `action` (`grant`, `withdraw`) và `file_id` khi nhà trường ghi nhận giấy ký tay; trả `photo_consent`, `photo_consent_method`, `history`.
4. `PUT /children/{id}/staff-child` nhận `is_staff_child`, `related_staff_user_id`, `related_staff_role_code`.

Giao kèo của nhật ký của bé (DT-08 phần 8b, YCTD-65):

1. `GET /classes/{id}/journals?date=` trả `can_write` và `children` (từng trẻ đang học kèm `journal` hoặc trống); cần là giáo viên chủ nhiệm của lớp hoặc có `P04.attendance.manage` trong phạm vi.
2. `PUT /children/{id}/journals/{date}` nhận `meal_note`, `sleep_note`, `hygiene_note`, `mood` (`happy`, `normal`, `tired`, `sad`, `unwell`), `activity_note` (tối đa 1000 ký tự), `reason` khi sửa nhật ký đã công bố; không phải chủ nhiệm trả `ERR_FORBIDDEN`; thiếu lý do khi sửa bản đã công bố trả mã BR-15.
3. `POST /classes/{id}/journals/publish` nhận `date`, `confirm`; còn trẻ chưa có nội dung mà chưa xác nhận trả mã BR-15 kèm `details` là tên từng trẻ.
4. `GET /children/{id}/journals?month=` trả `journals`; phụ huynh chỉ nhận bản đã công bố.

Giao kèo của trung tâm thông báo (DT-08 phần 8a, YCTD-64):

1. `GET /notifications?unread_only=` trả `unread_count` và tối đa 50 `notifications` mới nhất (`id`, `template_code`, `title`, `body` đã áp mẫu, `created_at`, `is_read`).
2. `POST /notifications/{id}/read` với thông báo không gửi cho mình trả `ERR_NOT_FOUND`. `GET /notifications/{id}/receipts` cần `P19.notification-receipt.view` trong phạm vi đơn vị của thông báo; trả `direct_recipients`, `role_recipients`, `readers`, `unread_count`.
3. `PUT /notification-templates/{code}` nhận `title_template`, `body_template` (tối đa 1000 ký tự); cần `P19.notification-template.manage` với phạm vi toàn trường.

Giao kèo của khóa API cho đối tác (DT-07 phần 7b, YCTD-63):

1. `POST /api-clients` (dịch vụ định danh) nhận `name`, `partner_type`, `scopes` (`reports`, `finance`, `children`, `staff`), `legal_basis` (bắt buộc khi có `children` hoặc `staff`), `allowed_ips`, `valid_until`; cần `P01.api-client.manage`; trả thêm `api_key` duy nhất một lần. `GET /api-clients` không trả khóa và giá trị băm.
2. Nhóm `/partner/` nhận khóa ở tiêu đề `x-api-key`. `GET /partner/reports/summary?month=` trả số liệu như bảng điều khiển toàn trường; `GET /partner/finance?from=&to=` trả `cash_flow` và `debts`; `GET /partner/children` trả trẻ đang học kèm `guardians`; `GET /partner/staff` trả nhân sự kèm `contract` và `latest_payslip`.
3. Khóa sai, đã thu hồi, hết hạn, sai địa chỉ mạng trả `ERR_UNAUTHENTICATED`; thiếu phạm vi trả `ERR_FORBIDDEN`; quá 60 yêu cầu mỗi phút trả `ERR_RATE_LIMIT`.

Giao kèo của bảng điều khiển và báo cáo (DT-07 phần 7a, YCTD-62):

1. Mọi điểm cuối nhận `org_unit_id` tùy chọn (trống là mọi đơn vị trong phạm vi); đơn vị ngoài phạm vi trả `ERR_FORBIDDEN`. `GET /dashboard/leadership`, `/dashboard/unit`, `/reports/tuition`, `/reports/staff-attendance` nhận `month`; `/reports/cash-flow`, `/reports/attendance`, `/reports/saturday-classes` nhận `from`, `to`.
2. `GET /dashboard/*` trả `children_count`, `classes_count`, `staff_count`, `tuition` (`invoice_count`, `payable_amount`, `paid_amount`, `outstanding_amount`), `debt` (`outstanding_amount`, `overdue_amount`), `attendance` (`present_count`, `record_count`, `rate_percent`). `GET /dashboard/birthdays` nhận `month`, `class_id`; trả `full_name`, `dob`, `class_name`, `turning_age`.
3. `GET /reports/tuition` nhận thêm `grade_level`; trả `classes` và `totals`. `GET /reports/debts` nhận `minimum_overdue_days`; trả `children`, `classes`, `totals`. `GET /reports/cash-flow` nhận `flow_type` (`income`, `expense`), `created_by`; trả `categories`, `groups` (`flow_type`, `group_name`, `count`, `amount`; YCTD-70), `periods` (`period` dạng `YYYY-MM`, `income_amount`, `expense_amount`), `documents`, `totals` (`income_amount`, `expense_amount`, `difference_amount`). `GET /reports/attendance` nhận `class_id`; trả `classes` (kèm `rate_percent`) và `absences`. `GET /reports/staff-attendance` nhận `department_id`; trả `staff`. `GET /reports/saturday-classes` trả `days` kèm `classes`, `present_count`, `absent_count`.

Giao kèo của phiếu chi lương, quyết toán và điều chỉnh (DT-06 phần 6c-2, YCTD-61):

1. `POST /payrolls/{id}/payment` và `POST /payroll-settlements/{id}/payment` nhận `account_id`, `category_id` (khoản mục chi), `request_key`; tạo phiếu chi `payment_type` `payroll` trạng thái nháp của Trường chính; chứng từ chưa duyệt, đã có phiếu chi chưa đảo, quyết toán không phải trả thêm trả mã BR-77 hoặc BR-90.
2. `POST /payroll-settlements` nhận `contract_id` của hợp đồng đã chấm dứt; trả `earned_amount`, `prepaid_amount`, `tax_difference`, `payable_amount`, `lines`, `recovery_outstanding` (chỉ khi đã duyệt), `receipts`, `payments`, `can_manage`, `can_approve`. Còn đơn nghỉ chờ duyệt trả mã BR-40; phiếu lương tháng nghỉ việc chưa duyệt trả mã BR-90; đã trình trả mã BR-45.
3. `POST /payroll-settlements/{id}/recovery-receipts` nhận `amount`, `method`, `account_id`, `category_id` (khoản mục thu), `receipt_date`, `content`, `request_key`; vượt khoản còn phải thu hồi trả mã BR-90.
4. `POST /payroll-adjustments` nhận `staff_id`, `month`, `amount` (khác 0), `reason`; tháng đã có bảng lương trình duyệt trả mã BR-45. `approve`, `reject` (nhận `reason`) theo hạn mức bảng lương của Trường chính.

Giao kèo của danh mục lương, biểu thuế và bảng lương (DT-06 phần 6c-1, YCTD-60):

1. `POST /pay-item-types`, `PUT /pay-item-types/{id}` nhận `kind` (`allowance`, `deduction`), `code`, `name`, `calculation_method` (`fixed_monthly`, `per_workday`, `percent_of_base`), `default_amount` hoặc `rate_percent`, `is_tax_exempt` (chỉ phụ cấp), `is_mandatory_insurance` (chỉ khấu trừ), `PUT` thêm `status`; cần `P08.pay-item-type.manage`.
2. `POST /staff/{id}/pay-items` nhận `pay_item_type_id`, `amount` hoặc `rate_percent` (trống là mức chung; danh mục chưa có mức chung thì bắt buộc); `PUT /staff/{id}/dependents` nhận `dependents_count`; cần `P08.staff-pay-item.manage` trong phạm vi.
3. `POST /tax-tables` nhận `effective_from` (ngày 1 của tháng), `personal_deduction`, `dependent_deduction`, `brackets` (danh sách `up_to`, `rate_percent`, bậc cuối không có `up_to`); cần `P08.tax-table.manage`; ngày hiệu lực không sớm hơn tháng của bảng lương đã trình.
4. `POST /payrolls` nhận `month`; cần `P08.payroll.manage`; trước ngày 1 của tháng, còn đơn vị chưa chốt công tháng trước (kèm `details`) trả mã BR-43; thiếu hệ số làm thêm trả mã BR-82; bảng đã trình hoặc đã duyệt trả mã BR-45. Kết quả có `status`, `total_net`, `skipped`, `can_manage`, `can_approve`, `payslips` (từng người: `prepaid_amount`, `adjustment_amount`, `taxable_income`, `tax_amount`, `net_amount`, `lines` gồm `section`, `code`, `name`, `amount`, `basis`).
5. `POST /payrolls/{id}/submit` tính `requires_principal` theo hạn mức `payroll` của Trường chính. `approve` cần `P08.payroll.approve`: VT-02 duyệt mọi bảng, VT-15 gán ở Trường chính duyệt bảng dưới hạn mức; `return` nhận `reason` bắt buộc.
6. `GET /me/payslips` trả phiếu đã duyệt của chính người đăng nhập kèm `period_year`, `period_month`, `lines`.

Giao kèo của phép năm, đơn nghỉ và bảng công (DT-06 phần 6b-2, YCTD-59):

1. `POST /leave-policies`, `PUT /leave-policies/{id}` nhận `job_title_id`, `seniority_from_years`, `seniority_to_years` (trống là trở lên), `entitled_days` (theo nửa ngày), `PUT` thêm `status`; cần `P08.leave-policy.manage` với phạm vi toàn trường; khoảng trùng trả mã BR-41.
2. `GET /leave-balances?org_unit_id=&year=` trả từng nhân sự `granted`, `policy_missing`, `entitled_days`, `used_days`, `remaining_days`, `adjust_reason`. `PUT /leave-balances` nhận `staff_id`, `year`, `entitled_days`, `reason`; cần `P08.attendance.manage`; nhỏ hơn số ngày đã nghỉ trả mã BR-41.
3. `POST /leave-requests` nhận `staff_id` (trống là chính mình), `leave_type_id`, `from_date`, `to_date`, `first_day_half`, `last_day_half` (`morning`, `afternoon`), `reason`; lập hộ cần `P08.attendance.manage`. Trả `days` do máy chủ tính. Trùng đơn, không có ngày làm việc trả mã BR-40; thiếu quy định hoặc không đủ ngày phép trả mã BR-41; kỳ đã chốt trả mã Q-135.
4. `POST /leave-requests/{id}/approve` cần `P08.leave.approve` trong phạm vi đơn vị của nhân sự; `reject` nhận `reason` bắt buộc; `cancel` cho người gửi, chính nhân sự hoặc phòng nhân sự. Đơn không còn chờ trả mã BR-40.
5. `POST /attendance-logs/lock` nhận `org_unit_id`, `month`; cần `P08.attendance.manage`; tháng chưa hết trả mã YCTD-41; thiếu giờ làm trả mã BR-39; còn đơn chờ trả mã BR-40 với `details` liệt kê từng đơn; đã chốt trả mã Q-135.
6. `GET /timesheet-periods?org_unit_id=&month=` trả `status` (`open`, `closed`, `reopened`), `can_close`, `can_approve_reopen`, `reopen_requests`, `summary` (từng nhân sự: `present_days`, `leave_days`, `absent_days`, `unpaid_days`, `insurance_days`, `overtime_minutes`).
7. `POST /attendance-logs/reopen-requests` nhận `org_unit_id`, `month`, `reason`; kỳ chưa chốt hoặc đã có đề nghị chờ trả mã Q-135. `approve`, `reject` (nhận `reason`) cần `P08.timesheet-reopen.approve` trong phạm vi đơn vị.

Giao kèo của ngày lễ, lịch bù và chấm công (DT-06 phần 6b-1, YCTD-59):

1. `POST /holidays` nhận `holiday_date`, `name` (tối đa 200 ký tự), `is_paid`; cần `P08.holiday.manage` với phạm vi toàn trường. `POST /school-day-changes` nhận `change_date`, `change_type` (`makeup_school_day`, `compensatory_day_off`), `note`; cần `P08.school-day-change.manage`. Ngày từ hôm nay trở về trước, học bù không phải thứ bảy trong học kỳ, nghỉ bù không phải thứ hai đến thứ sáu, ngày đã là ngày lễ hoặc đã có lịch bù đều bị từ chối (BR-84 hoặc `ERR_CONFLICT`).
2. `GET /school-days?year=` trả `holidays` và `changes` của năm dương lịch cho mọi người đã đăng nhập.
3. `GET /me/attendance-logs?month=YYYY-MM` trả `staff`, `today`, `today_log`, `days` (từng ngày với `kind`: `work`, `holiday` kèm `name`, `is_paid`, `compensatory_day_off`, `rest`), `logs`; tài khoản chưa gắn hồ sơ trả `ERR_NOT_FOUND`. `POST /me/attendance-logs/check-in` và `check-out` không nhận thân yêu cầu; vào ca lần hai, ra ca khi chưa vào ca, hồ sơ đã nghỉ việc trả mã BR-39.
4. `GET /attendance-logs?org_unit_id=&month=` cần `P08.attendance.view` trong phạm vi; trả `work_hours`, `can_manage`, `days`, `staff` kèm `logs`. `PUT /attendance-logs` nhận `staff_id`, `work_date`, `check_in`, `check_out` (giờ `HH:MM`, có thể trống), `note`; cần `P08.attendance.manage`; ngày chưa tới hoặc giờ ra không lớn hơn giờ vào trả `ERR_VALIDATION`; ngày ngoài thời gian làm việc của nhân sự trả mã BR-39.
5. Mỗi bản ghi chấm công có `worked_minutes`, `late_minutes`, `early_leave_minutes` tính theo cấu hình `work_start_time`, `work_end_time`, `lunch_break_minutes` của đơn vị lúc ghi; phần chưa cấu hình để trống.
6. Danh mục dùng chung: mục loại `leave_type` bắt buộc `attributes` gồm `is_paid`, `deducts_annual_leave`, `insurance_paid`; loại khác bỏ qua `attributes`.

Giao kèo của hồ sơ nhân sự và hợp đồng (DT-06 phần 6a, YCTD-58):

1. `POST /staff`, `PUT /staff/{id}` nhận `org_unit_id`, `code`, `full_name`, `dob`, `gender` (`male`, `female`), `phone`, `email`, `address`, `id_number` (mười hai chữ số), `department_id`, `job_title_id`, `start_date`; cần `P07.staff.manage`. Kết quả có `id_number_masked`, `has_account`, `department_name`, `job_title_name`; `GET /staff/{id}` có `contracts` khi người xem có `P07.contract.view` hoặc là chính nhân sự, ngược lại `contracts` là null.
2. `POST /staff/{id}/account` nhận `login` (tên đăng nhập hoặc số điện thoại); không có tài khoản trả `ERR_NOT_FOUND`; tài khoản chỉ là phụ huynh hoặc đã gắn hồ sơ khác trả `ERR_RULE_VIOLATION` mã BR-37.
3. `POST /staff/{id}/contracts` nhận `contract_no`, `contract_type` (`probation`, `fixed_term`, `indefinite`), `start_date`, `end_date`, `base_salary`, `allowances` (danh sách `name`, `amount`); trùng thời gian với hợp đồng còn hiệu lực trả mã BR-38.
4. `POST /employment-contracts/{id}/terminate` nhận `terminated_on`, `reason` bắt buộc; dịch vụ định danh khóa tài khoản liên kết qua `POST /users/{id}/terminate-employment` bằng mã phiên của người thao tác.
5. `GET /staff/{id}/teaching-assignments` (YCTD-316) trả `has_account`, `items` (phân công đang hiệu lực ở năm học hiện tại: `id`, `assignment_role` `homeroom` hoặc `subject`, `class_id`, `class_code`, `class_name`, `grade_level`, `school_level`, `subject_id`, `subject_name`, `periods_per_week` là số tiết của phân công hoặc của chương trình theo khối khi trống, `from_date`, `to_date`), `total_periods`. Cần `P07.staff.view` trong phạm vi đơn vị của nhân sự hoặc là chính nhân sự, ngược lại trả `ERR_FORBIDDEN`; hồ sơ chưa liên kết tài khoản trả `has_account: false`, `items` trống.

Giao kèo của nhân sự theo hệ thống của Sở (DT-15 phần 15d, YCTD-112):

1. `GET /staff/search` cần `P07.staff.view` trong phạm vi (người không có trả `ERR_FORBIDDEN`). Tham số `org_unit_id`, `department_id`, `status` (`active`, `terminated`), `q` (họ tên hoặc mã nhân sự, khớp một phần), `gender` (`male`, `female`), `moet_staff_code` (khớp một phần), `id_number` (đủ 12 số), `party_member` (`true`, `false`), `age_from`, `age_to` (0 đến 100, tuổi từ không lớn hơn tuổi đến), `job_position` (khớp một phần), `page` (từ 1), `page_size` (1 đến 200, mặc định 20). Trả `items` (`id`, `org_unit_id`, `unit_name`, `code`, `full_name`, `dob`, `gender`, `phone`, `email`, `status`, `start_date`, `moet_staff_code`, `department_name`, `job_title_name`, `ethnicity`, `job_position`, `position_group`, `contract_form`, `professional_qualification`, `party_member`, `id_number_masked`, `has_account`, `contract_no`, `contract_type`, `contract_end_date`, `base_salary`), `page`, `page_size`, `total`, `total_pages`, `contract_fields_visible`. Thứ tự A–Z theo tên rồi họ tên (BR-114). Bốn cột hợp đồng là null với nhân sự ngoài phạm vi `P07.contract.view`. Đơn vị ngoài phạm vi trả `ERR_FORBIDDEN`; giá trị sai trả `ERR_VALIDATION`.
2. `POST /staff/export` cần `P17.data.export`. Thân gồm các bộ lọc như mục 1 và `columns` (mảng mã cột không trùng trong `moet_staff_code`, `code`, `full_name`, `dob`, `gender`, `status`, `ethnicity`, `phone`, `job_position`, `position_group`, `contract_form`, `professional_qualification`, `department`, `job_title`, `party_member`, `email`, `start_date`, `id_number`, `account`, `unit`, `contract_no`, `contract_end_date`, `base_salary`; bỏ trống là 12 cột mặc định); mã lạ, trùng hoặc mảng rỗng trả `ERR_VALIDATION`. Trả tệp xlsx có cột STT, đầu `x-export-log-id`, ghi nhật ký xuất mã `staff` có dữ liệu cá nhân (BR-74), bộ lọc trong nhật ký không có số định danh. Quá 10 000 dòng trả `ERR_RULE_VIOLATION` mã YCTD-112.
3. `PATCH /staff/{id}/profile` cần `P07.staff.manage` ở đơn vị của nhân sự. Thân chỉ gồm ô cần đổi: `moet_staff_code`, `full_name`, `code`, `start_date` (ba ô này không được để trống khi gửi), `dob`, `gender`, `phone`, `email`, `address`, `id_number` (12 số), `department_id`, `job_title_id` (thuộc đơn vị và đang dùng), `moet_profile` (đối tượng: khóa của tệp ngành không có cột riêng; chữ tối đa 500 ký tự, ngày YYYY-MM-DD, ô đánh dấu `true`, `null`, `false` hoặc chuỗi rỗng là xóa; số sổ BHXH 4 đến 20 chữ hoặc số). Khóa lạ, giá trị sai, không có ô nào trả `ERR_VALIDATION`; trùng mã nhân sự hoặc mã định danh Bộ trả `ERR_CONFLICT`. Ghi nhật ký thao tác có giá trị trước và sau (số sổ BHXH ghi "đã đổi"). Trả hồ sơ như `GET /staff/{id}`.
4. `GET /staff/{id}` trả thêm `moet_fields`: giá trị gốc của các ô theo Sở (chữ, ngày YYYY-MM-DD, ô đánh dấu `true`; số sổ BHXH đã che). `GET /staff` giữ nguyên dạng trả về (danh sách) cho các màn hình chọn nhân sự và giao diện lập trình cho đối tác.

Giao kèo của nhân sự đủ theo hệ thống của Sở (DT-16 phần 16f, YCTD-124, BR-122; vi phạm quy tắc trả `ERR_RULE_VIOLATION` mã YCTD-124):

1. `GET /staff/search`, `POST /staff/export` nhận thêm bộ lọc `special_difficulty_commune` (`true`, `false`), `id_verification` (`unverified`, `verified`, `invalid`); dòng trả thêm `special_difficulty_commune`, `id_verification_status`, `bank_account_number`, `tax_code`; mã cột xuất thêm `special_difficulty_commune`, `id_verification`, `bank_account`, `tax_code` (không thuộc 12 cột mặc định).
2. `PATCH /staff/{id}/profile` nhận thêm `bank_account_number` (bỏ khoảng trắng, dấu chấm; 6 đến 20 chữ số), `bank_name`, `tax_code` (10 chữ số, `10 số-3 số` hoặc 12 chữ số), `special_difficulty_commune` (đúng hoặc sai); `null` là xóa; sai trả `ERR_VALIDATION`.
3. `POST /staff/delete` nhận `staff_ids` (1 đến 200 mã); cần `P07.staff.manage` ở đơn vị của từng hồ sơ (thiếu trả `ERR_FORBIDDEN`), mã không tồn tại trả `ERR_NOT_FOUND`. Trả `deleted_count` và `results` (`id`, `full_name`, `deleted`, `reason`): hồ sơ đã liên kết tài khoản hoặc có dữ liệu tham chiếu (khóa ngoại) không xóa, `reason` nêu loại dữ liệu (ví dụ "hợp đồng lao động"); xóa ghi nhật ký thao tác `delete` có mã nhân sự, họ tên, mã định danh Bộ trước khi xóa.
4. `POST /staff/ministry-export` cần `P17.data.export`; thân là bộ lọc như mục 1 của giao kèo YCTD-112; trả tệp xlsx (trang "Hồ sơ" 75 cột theo mẫu tệp CSDL ngành, số định danh, số sổ BHXH đủ số; "Kiểm tra dữ liệu"; "Danh mục"); quá 5000 hồ sơ trả lỗi quy tắc; ghi nhật ký xuất mã `staff-ministry` có dữ liệu cá nhân, bộ lọc không có số định danh. Không gửi đi đâu.
5. `POST /staff/ministry-errors` như mục 4, trả tệp cột STT, Mã nhân sự, Họ tên, Cột, Lỗi chỉ gồm hồ sơ thiếu hoặc sai ô bắt buộc; không có hồ sơ lỗi trả 422 mã YCTD-124; ghi nhật ký xuất mã `staff-ministry-errors`.
6. `GET /staff/ministry-template` cần `P01.import.staff`, trả mẫu 75 cột không có dòng; `?with_data=true` kèm hồ sơ trong phạm vi nhập và ghi nhật ký xuất mã `import-template-moet_staff`. Tệp nhập lại được bằng `POST /imports` loại `moet_staff` (hồ sơ đã có cập nhật, không tạo trùng). `GET /staff/ministry-catalogs` cần `P01.import.staff` hoặc `P07.staff.view`, trả `items` (`key`, `title`, `items`).
7. `GET /staff-branches` cần `P07.staff.view`; tham số `org_unit_id`, `branch_id`, `q`, `page`, `page_size`; trả nhân sự kèm `branches` (`org_unit_id`, tên, `source`). `POST /staff-branches/assign`, `/unassign` nhận `staff_ids`, `org_unit_ids` (phân hiệu, điểm trường đang hoạt động; Trường chính hoặc đơn vị ngừng dùng trả `ERR_VALIDATION`), trả `assigned_count` hoặc `removed_count`; đơn vị chính của nhân sự không gán. `POST /staff-branches/from-teaching` nhận `staff_ids`, lấy đơn vị của các lớp đang hoạt động mà tài khoản liên kết đang được phân công, thay dòng `teaching` cũ, giữ dòng `manual`; trả `assigned_count`, `without_account_count`. Ba điểm cuối ghi cần `P07.staff.manage` với nhân sự trong phạm vi.
8. `GET /staff-identity` cần `P07.staff.view`; tham số `org_unit_id`, `status`, `q`, `page`, `page_size`; trả `automatic` (sai ở bản chạy nội bộ) và dòng có số định danh đã che, thông tin thường trú, trạng thái, ngày, người đánh dấu, ghi chú; không trả số định danh đủ. `POST /staff-identity/mark` cần `P07.staff.manage`, nhận `staff_ids`, `status` (`verified`, `invalid`, `unverified`), `note` (bắt buộc với `invalid`, thiếu trả `ERR_VALIDATION`); trả `updated_count`, `results` (`id`, `error`; hồ sơ chưa có số định danh 12 chữ số không đánh dấu đã xác thực được). Không gọi dịch vụ ngoài; chỗ nối `IdentityVerificationGateway`.
9. `GET /staff-identity/progress` cần `P17.staff-statistics.view`; tham số `org_unit_id`, `group_by` (`unit` mặc định, `department`); trả `items` (tên, tổng số, đã xác thực, sai thông tin, tỷ lệ) và `totals`. `GET /staff-identity/duplicates` trả `groups` (`id_number_masked`, `staff`) các hồ sơ trong phạm vi trùng đủ 12 số.
10. `GET /staff-movements` cần `P07.staff.view`; tham số `type` bắt buộc (`transfer_in`, `transfer_out`, `guest_out`, `guest_in`), `status`, `q`, `page`, `page_size`; mỗi dòng có `status_label`. `POST /staff-movements` cần `P07.staff.manage`, nhận `movement_type`, `staff_id` (chuyển đi, đi thỉnh giảng; nhân sự đang làm việc) hoặc `org_unit_id`, `full_name`, `dob`, `gender` (chuyển đến, đến thỉnh giảng), `other_province`, `other_ward`, `other_school`, `movement_date`, `end_date` (không trước `movement_date`), `subject`, `decision_no`, `reason`, `note`; nhân sự đã có phiếu chuyển đi chờ duyệt trả lỗi quy tắc; trả 201. `POST /staff-movements/transfer-in-file` nhận tệp `file` (tệp 75 cột đúng một dòng) kèm `org_unit_id`, `other_school`, `movement_date`, tạo phiếu tiếp nhận có `dossier` (số định danh đã che trong phản hồi).
11. `POST /staff-movements/{id}/approve` với phiếu chờ xử lý: chuyển đến tạo hồ sơ nháp mã `CDN-` kèm sáu chữ số, trả `staff_id` (trùng mã định danh Bộ trả `ERR_CONFLICT`); chuyển đi cho nhân sự nghỉ việc từ ngày chuyển, chấm dứt hợp đồng còn hiệu lực, khóa tài khoản liên kết qua dịch vụ định danh như chấm dứt hợp đồng; đi thỉnh giảng, đến thỉnh giảng chỉ đổi trạng thái. `POST /{id}/reject` cần `note`. Phiếu đã xử lý trả lỗi quy tắc. `POST /{id}/confirm` nhận `confirmed_on` (không sau hôm nay), chỉ với phiếu chuyển đi đã duyệt. Mọi thao tác ghi nhật ký thao tác.
12. `GET /staff-movements/{id}/pdf` (cần `P07.staff.view`) trả phiếu PDF, số định danh, số sổ BHXH chỉ hiện bốn số cuối, ghi nhật ký xuất mã `staff-movement-pdf`. `GET /{id}/ministry-file` cần `P17.data.export`, chỉ phiếu có hồ sơ chuyển, trả tệp 75 cột một dòng, ghi nhật ký xuất mã `staff-movement-ministry`.
13. `POST /imports` loại `professional_ratings` cần `P07.professional-standard.assess`; mẫu `GET /imports/templates/professional_ratings[?with_data=true]`, danh mục `GET /imports/catalogs/professional_ratings`; dòng lỗi khi phiếu chưa gửi tự đánh giá, đã chốt, ngoài quyền đánh giá hoặc mức sai; ghi bằng `POST /imports/{id}/commit`, dòng có "Chốt phiếu" thì chốt phiếu.
14. `GET /statistics/staff-so` cần `P17.staff-statistics.view`; tham số `org_unit_id`; trả `by_qualification`, `by_job_position`, `by_contract_form`, `by_position_group` (mỗi dòng `value`, `count`, `female`, `in_catalog`) và `standards` (theo `standard_type`: `finalized`, `overall`, `criteria` với `levels`). `GET /statistics/missing-staff-fields` thêm trường `bank_account`, `tax_code`.
15. `DATA_GRID_KEYS` thêm `staff-branches`, `staff-identity`, `staff-movements-in`, `staff-movements-out`, `staff-guests-out`, `staff-guests-in`.

Giao kèo của thanh toán trực tuyến (DT-05 phần 5f, YCTD-57):

1. `GET /invoices/{id}/payment-qr` cho phụ huynh của trẻ hoặc người có `P06.receipt.manage` ở đơn vị; trả `amount`, `transfer_content`, `virtual_account_number`, `qr_content`, `bank_name`, `account_name`, `expires_at`. Hóa đơn đã thu đủ trả `ERR_RULE_VIOLATION` mã BR-31; chưa cấu hình tài khoản nhận hoặc chưa nối nhà cung cấp trả mã P06-11.
2. `PUT /online-payment-settings` nhận `account_id` (tài khoản ngân hàng đang dùng của Trường chính) và `category_id` (khoản mục thu); cần `P06.cash-account.manage` ở Trường chính.
3. `GET /online-payment-transactions?status=pending` trả giao dịch chưa khớp và chưa xử lý kèm `match_status` (`wrong_amount`, `unknown_invoice`, `already_paid`); giao dịch chưa xác định trẻ hiện cho kế toán mọi đơn vị. `POST /online-payment-transactions/{id}/resolve` nhận `note` bắt buộc, `receipt_id` không bắt buộc; giao dịch đã khớp hoặc đã xử lý trả mã P06-11.
4. `POST /payment-webhooks/development` nhận `provider_transaction_ref`, `virtual_account_number`, `amount`, `transfer_content`; trả giao dịch kèm `match_status`, `receipt_id`.
5. Bốn điểm cuối nhận thông báo của nhà cung cấp thật không dùng mã phiên: cổng chưa bật trả 404; chữ ký hoặc khóa sai trả 401 và không ghi giao dịch; giao dịch đã nhận thì không lập phiếu thu lần hai (YCTD-94).

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

Giao kèo của lớp học theo hệ thống của Sở (DT-15 phần 15b, YCTD-111):

1. `GET /classes` nhận thêm `q` (khớp một phần tên hoặc mã lớp), `stage` (`nhom_tre`, `mau_giao`), `age_group`, `two_sessions_per_day`, `boarding`, `is_combined` (`true`, `false`); giữ `org_unit_id`, `status`, `grade_level`, `mine`; giá trị sai trả `ERR_VALIDATION`. Dòng trả thêm `org_unit_name`, `org_unit_type`, `grade_name`, `age_group` (nhóm tuổi đang áp dụng), `age_group_from_grade`, `stage`, `sort_order`, `room_name`, `homeroom_names`, `enrolled_count`, `two_sessions_per_day`, `mixed_age_count`, `is_combined`, `combined_into_class_id`, `combined_into_name`, `boarding`. Thứ tự theo `sort_order` (trống ở cuối) rồi mã lớp.
2. `POST /classes` nhận thêm `age_group` (một trong sáu nhóm tuổi hoặc null), `sort_order` (0 đến 9999 hoặc null), `two_sessions_per_day`, `is_combined`, `boarding` (boolean, mặc định false), `mixed_age_count` (2, 3 hoặc null), `combined_into_class_id` (chỉ giữ khi `is_combined`). `PATCH /classes/{id}` nhận các trường đó, trường không gửi thì không đổi; `is_combined` false thì bỏ lớp được ghép vào; đổi khối, nhóm tuổi thì kiểm tra lại quy tắc ghép độ tuổi. Vi phạm BR-112 trả `ERR_RULE_VIOLATION` mã YCTD-111.
3. `POST /classes/export` cần `P17.data.export`. Thân gồm các bộ lọc như mục 1 và `columns` (mảng mã cột không trùng trong `branch`, `code`, `name`, `grade`, `stage`, `nursery_group`, `age_group`, `sort_order`, `homeroom`, `enrolled`, `two_sessions_per_day`, `mixed_age`, `is_combined`, `combined_into`, `boarding`, `dissolved`, `school_site`, `room`, `max_size`; bỏ trống là 13 cột hiện mặc định trên lưới theo Sở: `code`, `name`, `grade`, `stage`, `nursery_group`, `age_group`, `sort_order`, `enrolled`, `two_sessions_per_day`, `is_combined`, `combined_into`, `boarding`, `dissolved`, YCTD-117); mã lạ hoặc trùng trả `ERR_VALIDATION`. Trả tệp xlsx có cột STT, đầu `x-export-log-id`, ghi nhật ký xuất mã `classes` (BR-74). Quá 10 000 dòng trả `ERR_RULE_VIOLATION` mã YCTD-111.
4. `GET /class-assignments`: ai có vai trò ở đơn vị đều xem, trong phạm vi xem lớp. Tham số `org_unit_id`, `grade_level`, `assignment_role` (`homeroom`, `subject`), `q` (tên giáo viên); giá trị sai trả `ERR_VALIDATION`. Trả mảng (`id`, `class_id`, `class_code`, `class_name`, `grade_name`, `org_unit_id`, `org_unit_name`, `staff_user_id`, `staff_name`, `assignment_role`, `subject_name`, `from_date`) xếp theo tên giáo viên rồi tên lớp. Phân công, kết thúc phân công vẫn qua `POST /classes/{id}/staff-assignments`, `PATCH .../{assignmentId}` (cần `P02.class.manage`).
5. `POST /class-assignments/export` cần `P17.data.export`; thân là bộ lọc như mục 4; trả tệp xlsx có cột STT và bảy cột Giáo viên, Vai trò trong lớp, Môn dạy, Lớp, Khối, Đơn vị, Từ ngày; ghi nhật ký xuất mã `class-assignments` (BR-113).
6. `DATA_GRID_KEYS` thêm `branches`, `school-sites`, `classes`, `class-assignments`; `PORTAL_QUICK_LINK_PATHS` thêm `/branches`, `/school-sites`, `/class-imports`, `/class-assignments` nên Truy cập nhanh ghim được bốn trang mới.

Giao kèo của các danh mục (DT-01 phần 6b, YCTD-42):

1. `GET /departments`, `GET /job-titles`, `GET /rooms` bắt buộc `org_unit_id`; ai có vai trò ở đơn vị đó đều đọc được. `POST` nhận `org_unit_id` và các trường của bảng; `PATCH /{id}` nhận các trường sửa được và `status` (`active`, `inactive`). Ghi cần `P01.department.manage` (phòng ban, chức danh) hoặc `P01.room.manage` (phòng học) trong phạm vi đơn vị; đơn vị phải đang hoạt động.
2. Phòng ban cha phải cùng đơn vị, đang hoạt động và không phải phòng ban con của chính nó; không ngừng sử dụng được phòng ban còn phòng ban con đang hoạt động. Vi phạm trả `ERR_RULE_VIOLATION`.
3. `GET /catalog-items` lọc theo `catalog_type`, `status`; `GET /grade-levels` lọc theo `status`; mọi người đã đăng nhập đều đọc được. Ghi cần `P01.catalog.manage`. Mã bậc học không đổi được; độ tuổi theo tháng, tuổi từ không lớn hơn tuổi đến.
   Từ YCTD-152, `POST /grade-levels` nhận `school_level` (mặc định MN); tháng tuổi null được ở cấp khác MN; `GET /grade-levels` lọc thêm `school_level`; `PATCH` không nhận `school_level`. `POST /curricula` nhận `code`, `name`, `school_level`, `grade_level_codes`, `is_default`, `note`. `POST`, `PATCH /classes` nhận `curriculum_id`; lớp trả `school_level`, `curriculum_id`; `GET /classes` trả thêm `curriculum_name`, lọc `school_level`, lớp ngoài MN có `age_group`, `stage` null. Lỗi quy tắc dùng mã YCTD-152.
4. `GET /approval-thresholds` cần `P01.view`, chỉ trả hạn mức đang hiệu lực trong phạm vi đơn vị, lọc được theo `org_unit_id`. `PUT /approval-thresholds` nhận `org_unit_id`, `document_type` (tám loại của `07_QUY_TAC_NGHIEP_VU.md` mục 12.1), `threshold_amount` lớn hơn 0, tối đa hai chữ số thập phân; gửi `null` là gỡ hạn mức. Cần `P01.approval-threshold.manage`.
5. Mã trùng trong phạm vi duy nhất trả `ERR_CONFLICT`. Mọi thao tác ghi đều ghi nhật ký thao tác; khi mở năm học mới, các danh mục chuyển sang và giữ nguyên mã định danh.

Giao kèo của cấu hình và nhật ký thao tác (DT-01 phần 6a):

1. `GET /settings?org_unit_id=` trả danh sách mục cấu hình, mỗi mục gồm `key`, `label`, `value_type`, `value` (giá trị đang áp dụng), `source` (`unit`, `truong_chinh`, `default`, `missing`), `unit_value`. Ai có vai trò ở đơn vị đó đều đọc được (YCTD-40).
2. `PUT /settings` nhận `org_unit_id` và `values` là bảng khóa và giá trị; giá trị `null` xóa giá trị riêng để kế thừa lại; cần `P01.setting.manage` trong phạm vi đơn vị (PQ-15). Khóa lạ hoặc giá trị sai trả `ERR_VALIDATION`.
3. `GET /audit-logs` theo mục 3 (riêng `page_size` từ 1 đến 200 từ YCTD-109, trước là 100), lọc `org_unit_id`, `entity_name`, `entity_id`, `actor_user_id`, `from_date`, `to_date`; cần `P01.view`; chỉ trả nhật ký trong phạm vi đơn vị. Mỗi bản ghi có `actor_name` là tên người thực hiện lúc thao tác.
4. Dịch vụ định danh: `GET`, `PUT /auth/settings` đọc và sửa `account_inactivity_lock_days` (mặc định 90, từ 7 đến 3650; sửa cần `P01.setting.manage` ở phạm vi toàn trường); `GET /users/audit-logs` trả nhật ký tài khoản và quyền, chỉ VT-01, VT-02 xem; `page_size` từ 1 đến 200 (YCTD-109).

Giao kèo của nhóm điểm cuối cây đơn vị (DT-01 phần 4):

1. `POST /org-units` nhận `code`, `name`, `unit_type` (`truong_chinh`, `phan_hieu`, `diem_truong`), `address`, `phone`, `manager_user_id`; đơn vị cấp 2 tự trực thuộc Trường chính. Cần năm học đang dùng, nếu không trả `ERR_RULE_VIOLATION` mã BR-93.
2. Vi phạm cây hai cấp trả `ERR_RULE_VIOLATION` mã BR-01: Trường chính thứ hai, đơn vị dưới đơn vị cấp 2, đổi đơn vị cha, đổi loại giữa hai cấp, ngừng sử dụng Trường chính, ngừng sử dụng đơn vị còn đơn vị con đang hoạt động. Mã trùng trả `ERR_CONFLICT`.
3. `GET /org-units` lọc được theo `unit_type` và `status`; `GET /org-units/tree` trả Trường chính kèm `children`. Mọi người đã đăng nhập đọc được; ghi cần `P01.org-unit.manage` (PQ-12).
4. Mọi thao tác tạo, sửa ghi `audit_logs` kèm giá trị trước và sau (QU-04).
5. Từ YCTD-111 (DT-15 phần 15b, BR-111), dòng của `GET /org-units` trả thêm `distance_km`, `area_m2` (số hoặc null). `POST`, `PATCH /org-units` nhận thêm `distance_km` (0 đến 999 999), `area_m2` (0 đến 9 999 999 999), số không âm tối đa hai chữ số thập phân, null hoặc chuỗi rỗng là bỏ trống; sai trả `ERR_VALIDATION`; `PATCH` không gửi trường thì không đổi. Trường chính có khoảng cách trả `ERR_RULE_VIOLATION` mã YCTD-111. Màn hình 1.2, 1.3 của cổng quản trị dùng chính các điểm cuối này, không có điểm cuối mới.

Giao kèo của Xuất Excel còn thiếu theo Sở (DT-16 phần 16b, YCTD-119, BR-117):

1. Ba điểm cuối `POST /org-units/export`, `POST /administrative-units/addresses/export`, `POST /account-exports/roles` cần `P17.data.export`; thiếu quyền trả `ERR_FORBIDDEN` (403). Thân JSON gồm bộ lọc của màn hình và `columns` (mảng mã cột không trùng, không rỗng; không gửi là các cột mặc định); cột lạ, trùng hoặc bộ lọc sai trả `ERR_VALIDATION` (400) kèm trường lỗi. Trả tệp xlsx có cột STT và các cột theo thứ tự gửi, đầu `x-export-log-id`; mỗi lần xuất ghi `export_logs` ở năm học đang dùng trước khi trả tệp; chưa có năm học đang dùng trả `ERR_RULE_VIOLATION` mã BR-93.
2. `POST /org-units/export`: `unit_type` bắt buộc (`phan_hieu`, `diem_truong`; giá trị khác, kể cả `truong_chinh`, trả 400), `status` (`active`, `inactive`), `q` (tên hoặc mã chứa từ khóa, tối đa 100 ký tự); mã cột `code`, `name`, `address`, `distance_km`, `area_m2`, `phone`, `status` (mặc định cả bảy), nhãn Mã, Tên, Địa chỉ, Khoảng cách đến cơ sở chính (km), Diện tích (m²), Điện thoại, Trạng thái (Đang dùng, Ngừng sử dụng); xếp như `GET /org-units`. Nhật ký mã `branches` hoặc `school-sites`, `contains_personal_data` false; tên tệp `danh-sach-phan-hieu-…`, `danh-sach-diem-truong-…`.
3. `POST /administrative-units/addresses/export`: cần thêm `P02.child.manage` hoặc `P02.approve`, trong phạm vi xem trẻ (BR-72); bộ lọc `address_type`, `suggestion`, `org_unit_id`, `q` như `GET /administrative-units/addresses`; mã cột `moet_student_code`, `full_name`, `dob`, `class_name`, `address_type`, `old_province`, `old_district`, `old_ward`, `old_ward_code`, `new_province`, `new_ward`, `new_ward_code`, `suggestion` (mặc định bỏ `old_ward_code`, `new_ward_code`); nhiều xã mới ghi cách nhau "; ". Quá 10 000 địa chỉ trả `ERR_RULE_VIOLATION` mã YCTD-116. Nhật ký mã `administrative-addresses`, có dữ liệu cá nhân; tên tệp `dia-chi-dia-danh-cu-…`.
4. Xuất Excel 1.4 Danh sách người dùng dùng `POST /account-directory/export` của phần 16d (YCTD-120); bản đầu `POST /account-exports/users` của phần 16b đã bỏ khi gộp.
5. `POST /account-exports/roles`: `q` (mã hoặc tên nhóm chứa từ khóa, không phân biệt hoa thường) lọc trên `GET /roles` của dịch vụ định danh; mã cột `code`, `name`, `active` (Có khi nhóm có hiệu lực), `administrator` (nhóm có `P01.account.manage` hoặc `P01.account.manage-in-unit`), `system`, `permission_count`, `user_count` (mặc định năm cột đầu). Nhật ký mã `roles`, `contains_personal_data` false; tên tệp `nhom-nguoi-dung-…`.
6. `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm 38 khóa lưới của phần 16b: `facility-rooms`, `equipment-summary`, `equipment-outside`, `equipment-catalog`, `growth-report-children`, `missing-child-profiles`, `missing-staff-profiles`, `program-completion-classes`, `program-completion-children`, `child-groups`, `child-group-members`, `professional-evaluations`, `kitchen-menus`, `kitchen-ingredients`, `kitchen-dishes`, `kitchen-suppliers`, `kitchen-purchases`, `kitchen-buffets`, `health-campaigns`, `health-schedules`, `medical-events`, `health-report-requests`, `health-standards`, `medication-requests`, `medication-schedule`, `medicines`, `pharmacies`, `medicine-purchase-requests`, `medicine-purchase-orders`, `medicine-issues`, `academic-years`, `departments`, `job-titles`, `catalog-items`, `rooms`, `grade-levels`, `zalo-followers`, `org-units`.

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
| GET, POST | /api/v1/users | Danh sách và tạo tài khoản; từ YCTD-109 lọc thêm `login`, `full_name`, `must_change_password`, lọc và phân trang trong câu truy vấn; từ YCTD-110 mỗi dòng có thêm `password_changed_at`; từ YCTD-120 lọc thêm `user_ids` (tối đa 200, phân tách bằng dấu phẩy), `password_expires_from`, `password_expires_to` (YYYY-MM-DD), mỗi dòng có `password_expires_at` |
| GET | /api/v1/users/directory | Danh bạ nhân sự theo vai trò và đơn vị để phân công giáo viên; cần `P02.class.manage` (YCTD-44) |
| PATCH | /api/v1/users/{id} | Cập nhật tài khoản, khóa hoặc mở khóa |
| POST | /api/v1/users/guardian-accounts | Tạo tài khoản phụ huynh hoặc thêm vai trò VT-14 khi duyệt hồ sơ trẻ; cần `P02.approve` ở đơn vị (YCTD-45) |
| POST | /api/v1/users/{id}/reset-password | Đặt lại mật khẩu |
| GET, POST | /api/v1/roles | Danh sách và tạo vai trò |
| PUT | /api/v1/roles/{id}/permissions | Gán danh sách quyền cho vai trò |
| PATCH, DELETE | /api/v1/roles/{id} | Sửa `name`, `is_active`; xóa nhóm không phải nhóm hệ thống, chưa có người dùng (BR-118, YCTD-120) |
| PUT | /api/v1/roles/{id}/workspaces | Thay toàn bộ phân hệ nhóm được dùng: `workspace_keys` là khóa phân hệ của `PORTAL_WORKSPACES` (P01-18) |
| POST | /api/v1/users/bulk-reset-password | Cấp mật khẩu hàng loạt: `user_ids` (1 đến 200); trả từng dòng `temporary_password` hoặc `skipped_reason` (YCTD-120) |
| POST | /api/v1/users/bulk-roles | Phân nhóm quyền hàng loạt: `user_ids`, `role` (`role_code`, `org_unit_id`); trả từng dòng `added`, `skipped_reason`; cần `P01.account.manage` |
| POST | /api/v1/users/{id}/roles | Gán vai trò kèm phạm vi đơn vị |
| DELETE | /api/v1/users/{id}/roles/{assignmentId} | Gỡ một vai trò của tài khoản; thu hồi mọi phiên của tài khoản (YCTD-39) |
| GET | /api/v1/permissions | Danh sách quyền theo phân hệ |

Giao kèo của nhóm điểm cuối tài khoản, vai trò, quyền (DT-01 phần 5, do dịch vụ định danh phục vụ):

1. `POST /users` nhận `full_name`, `phone` (10 chữ số, bắt đầu bằng 0), `username`, `valid_until`, `roles` (mỗi phần tử gồm `role_code`, `org_unit_id`); trả `account` và `temporary_password` chỉ một lần (PQ-14).
2. Vai trò VT-01, VT-02, VT-19, VT-20 không chọn đơn vị; vai trò khác bắt buộc chọn đơn vị đang hoạt động (PQ-03); VT-20 bắt buộc `valid_until` (BM-68); trùng số điện thoại hoặc tên đăng nhập trả `ERR_CONFLICT`.
3. `PATCH /users/{id}` sửa `full_name`, `phone`, `username`, `valid_until`, `status` (`active`, `locked`); không ai tự sửa tài khoản của mình (PQ-08). Khóa, đặt lại mật khẩu, gán hoặc gỡ vai trò thì thu hồi mọi phiên (BM-56).
4. `GET /users` theo mục 3 (riêng `page_size` từ 1 đến 200, YCTD-107), lọc `q`, `status`, `role_code`; chỉ trả tài khoản trong phạm vi quản lý của người gọi (PQ-13). Từ YCTD-109 (DT-15 phần 15e) nhận thêm `login` (khớp một phần tên đăng nhập hoặc số điện thoại), `full_name` (khớp một phần họ tên), `must_change_password` (`true`, `false`); từ khóa thoát ký tự `%`, `_`. Dịch vụ định danh lọc, đếm (`count(*)`) và cắt trang (`limit`, `offset`) ngay trong câu truy vấn, sắp theo họ tên rồi mã, chỉ đọc vai trò của các tài khoản trên trang (trước đây đọc mọi tài khoản cùng vai trò, quyền rồi mới cắt trang); `total` là số tài khoản sau lọc và sau phạm vi; dạng trả về giữ nguyên. Phạm vi của VT-03 viết bằng điều kiện `exists` đúng như kiểm tra quyền quản lý tài khoản (`canManageAccount`): tài khoản có ít nhất một vai trò, mọi vai trò nằm trong đơn vị được gán (gán ở Trường chính là toàn trường) và không phải VT-01, VT-02. Giá trị sai (ví dụ `must_change_password=co`, `page=0`, `page_size=201`, `status` lạ) trả `ERR_VALIDATION` (400). Từ YCTD-110 mỗi tài khoản trả thêm `password_changed_at` (thời điểm đặt mật khẩu gần nhất, BR-110).
5. `PUT /roles/{id}/permissions` nhận `permission_codes` thay toàn bộ quyền của vai trò; quyền mới có hiệu lực ở yêu cầu kế tiếp. `POST /roles` nhận `code`, `name`. Từ YCTD-109, màn hình 1.3 Phân quyền nhóm theo menu của cổng quản trị (đường dẫn giao diện `/role-permissions`, không có điểm cuối mới) ghi bằng chính `PUT /roles/{id}/permissions`; chỉ người có `P01.account.manage` ghi được như trước.
6. Mọi thao tác ghi `identity_audit_logs` kèm giá trị trước và sau. Dịch vụ định danh đọc cây đơn vị qua `GET /api/v1/org-units` của máy chủ API bằng mã phiên của người gọi.
| GET, PUT | /api/v1/settings | Đọc và ghi cấu hình theo đơn vị; từ YCTD-127 ba khóa của khối "Cấu hình trường" chỉ ghi ở Trường chính |
| GET, PUT | /api/v1/approval-thresholds | Đọc và ghi hạn mức phê duyệt theo đơn vị và loại chứng từ |
| GET, POST | /api/v1/rooms | Danh mục phòng học; kèm khối phòng, loại phòng, hiện trạng, diện tích, thuộc tính (YCTD-106) |
| PATCH | /api/v1/rooms/{id} | Sửa, ngừng sử dụng hoặc dùng lại phòng học; sửa khai báo cơ sở vật chất (YCTD-106) |
| GET, POST | /api/v1/grade-levels | Danh mục bậc học |
| PATCH | /api/v1/grade-levels/{id} | Sửa, ngừng sử dụng hoặc dùng lại bậc học; không đổi mã |
| POST | /api/v1/grade-levels/templates | Nạp khối mẫu của cấp (`school_level` là TH, THCS, THPT); trả `created`, `skipped` (YCTD-152) |
| GET | /api/v1/grade-levels/next | Khối kế tiếp khi lên lớp (`code`); trả `kind` (grade hoặc completed), `code`, `school_level` (YCTD-152) |
| GET, POST | /api/v1/curricula | Chương trình theo cấp; lọc `school_level` (YCTD-152) |
| PATCH | /api/v1/curricula/{id} | Sửa tên, khối áp dụng, mặc định, ghi chú, trạng thái; không đổi mã, cấp (YCTD-152) |
| GET, POST | /api/v1/subjects | Môn học theo cấp (lọc `school_level`; mọi người đã đăng nhập); thêm môn (cần `P01.catalog.manage`) (P02-34, YCTD-158) |
| PATCH | /api/v1/subjects/{id} | Sửa tên, loại, cách đánh giá, thứ tự, trạng thái; mã, cấp không đổi (P02-34) |
| POST | /api/v1/subjects/templates | Nạp bộ môn mẫu của cấp (P02-34) |
| GET, PUT | /api/v1/curricula/{id}/subjects | Số tiết theo khối của chương trình; thay cả bảng (P02-34) |
| GET | /api/v1/teaching-assignments | Môn của lớp theo chương trình và khối kèm giáo viên đang dạy (`class_id`) (P02-35) |
| GET | /api/v1/teaching-assignments/teachers | Tổng tiết mỗi tuần của giáo viên theo cấp (P02-35) |
| GET, PUT | /api/v1/children/{id}/elective-subjects | Môn tự chọn của học sinh và các môn chọn được (P02-36) |
| GET, POST | /api/v1/subject-combinations | Tổ hợp môn THPT kèm môn và số học sinh (mọi người đã đăng nhập); thêm tổ hợp (cần `P01.catalog.manage`) (P02-55, YCTD-167) |
| PATCH | /api/v1/subject-combinations/{id} | Sửa tên, thứ tự, trạng thái, danh sách môn (khi chưa có học sinh); mã không đổi (P02-55) |
| GET | /api/v1/subject-combinations/{id}/students | Học sinh đã đăng ký tổ hợp kèm lớp, trạng thái (cần `P02.view`) (P02-55) |
| GET, PUT | /api/v1/children/{id}/subject-combination | Tổ hợp đã đăng ký và các tổ hợp chọn được; đăng ký hoặc đề nghị đổi (P02-56) |
| POST | /api/v1/children/{id}/subject-combination/approve, /reject | Duyệt hoặc từ chối đổi tổ hợp (cần `P02.class.manage`) (P02-56) |
| GET, POST, PATCH | /api/v1/subject-teams | Tổ bộ môn; thêm, sửa tổ (cần `P01.catalog.manage`) (P02-57) |
| PUT, DELETE | /api/v1/subject-teams/{id}/members, /members/{staffUserId} | Thêm, đặt vai trò, bỏ thành viên (P02-57) |
| GET | /api/v1/subject-teams/{id}/loads | Tổng tiết mỗi tuần của giáo viên trong các môn của tổ (P02-57) |
| GET, PUT | /api/v1/scores/config | Cấu hình sổ điểm của cấp (`school_level`); sửa cần `P02.assessment.manage` (P02-60, YCTD-170) |
| GET | /api/v1/scores/classes/{id} | Môn, quyền nhập, học kỳ (hạn, khoá), cấu hình của lớp (P02-58) |
| GET, PUT | /api/v1/scores/classes/{id}/subjects/{subjectId} | Bảng điểm một môn theo học kỳ (`term_type`); ghi điểm theo học sinh (P02-58). Từ YCTD-318 thêm `GET …/template` (tệp mẫu `so-diem.xlsx` kèm học sinh, điểm đang có), `POST …/import` (biểu mẫu `term_type`, `file`; trả `saved`, `errors` theo dòng, có lỗi thì không ghi; ghi như `PUT`), `GET …/print` (`so-diem.pdf`); cùng `term_type` |
| GET | /api/v1/scores/classes/{id}/summary | Điểm trung bình, kết quả, gợi ý xếp loại theo học kỳ hoặc `year` (P02-59) |
| PUT | /api/v1/scores/classes/{id}/ratings | Xác nhận xếp loại học tập, rèn luyện, nhận xét (P02-59) |
| GET, POST | /api/v1/scores/locks, /locks/unlock | Trạng thái khoá, khoá điểm theo học kỳ, mở khoá kèm lý do (cần `P02.assessment.manage`) (P02-59) |
| GET | /api/v1/scores/children/{id} | Điểm đã khoá của con cho phụ huynh (P02-60) |
| GET, PUT | /api/v1/period-slots | Khung giờ tiết học của cấp ở năm học đang dùng; thay cả khung (cần `P02.timetable.manage`) (P02-39, YCTD-160) |
| GET, POST | /api/v1/timetable-versions | Bản thời khoá biểu theo cấp kèm `is_current`; tạo bản nháp, chép từ bản khác (P02-40) |
| PATCH, DELETE | /api/v1/timetable-versions/{id} | Sửa tên, ngày áp dụng, ghi chú; xoá bản nháp (P02-40) |
| GET | /api/v1/timetable-versions/{id}/lessons | Tiết của bản kèm khung giờ; lọc `class_id`, `teacher_user_id`, `room_id` (P02-40). Từ YCTD-317 `GET /api/v1/timetable-versions/{id}/export` cùng bộ lọc trả tệp `thoi-khoa-bieu.xlsx`: mỗi lớp, giáo viên hoặc phòng một trang dạng lưới tiết theo thứ; không lọc thì mọi lớp; quyền như xem thời khoá biểu |
| PUT | /api/v1/timetable-versions/{id}/classes/{classId}/lessons | Thay tiết của một lớp trong bản nháp (P02-40) |
| GET | /api/v1/timetable-versions/{id}/conflicts | Xung đột cứng, mềm của bản (P02-40) |
| POST | /api/v1/timetable-versions/{id}/publish | Ban hành bản nháp (P02-40) |
| GET, POST | /api/v1/timetable-versions/{id}/import-template, /import | Tệp mẫu; nhập Excel vào bản nháp (P02-40) |
| GET | /api/v1/timetables, /api/v1/timetables/mine | Bản đang áp dụng theo lớp, giáo viên, phòng, ngày; lịch dạy của tôi (P02-41) |
| GET | /api/v1/children/{id}/timetable | Thời khoá biểu đang áp dụng của lớp con đang học (P02-41) |
| GET, PUT | /api/v1/timetable-generator/settings | Mức quan trọng của ràng buộc, giới hạn thời gian, số phương án của cấp (P02-51, YCTD-164) |
| GET, PUT | /api/v1/timetable-generator/subject-rules | Quy tắc xếp của môn, phòng chọn được (P02-51) |
| GET | /api/v1/timetable-generator/teacher-busy | Giáo viên được phân công ở cấp kèm tiết bận, khung giờ, ngày học (P02-51) |
| PUT | /api/v1/timetable-generator/teacher-busy/{teacherUserId} | Thay tiết bận của giáo viên (P02-51) |
| GET | /api/v1/timetable-generator/precheck | Số lớp, giáo viên, tiết, ô; vấn đề của dữ liệu trước khi xếp (P02-51) |
| GET, POST | /api/v1/timetable-generations | Lần xếp của cấp; bắt đầu lần xếp (P02-51) |
| GET | /api/v1/timetable-generations/{id} | Trạng thái, tiến độ, vấn đề, các phương án (P02-51) |
| POST | /api/v1/timetable-generations/{id}/cancel | Huỷ lần xếp chưa xong (P02-51) |
| GET | /api/v1/timetable-generations/{id}/variants/{no} | Tiết của phương án kèm tên lớp, môn, giáo viên, phòng, khung giờ (P02-51) |
| POST | /api/v1/timetable-generations/{id}/variants/{no}/apply | Tạo bản nháp từ phương án (P02-51) |
| POST | /api/v1/timetable-versions/{id}/classes/{classId}/check | Xung đột nếu ghi các ô đang sửa của lớp, không ghi (P02-52) |
| GET, POST | /api/v1/timetable-changes | Dạy thay, đổi tiết trong khoảng ngày; ghi thay đổi (P02-53) |
| GET | /api/v1/timetable-changes/day | Tiết thực tế của một ngày theo lớp hoặc giáo viên (P02-53) |
| GET | /api/v1/timetable-changes/teachers | Giáo viên có thể dạy thay (P02-53) |
| DELETE | /api/v1/timetable-changes/{id} | Xoá thay đổi (đổi tiết xoá cả cặp) (P02-53) |
| GET | /api/v1/timetable-reports/teaching, /api/v1/timetable-reports/rooms | Báo cáo tiết dạy theo giáo viên; dùng phòng (P02-54) |
| GET, POST | /api/v1/timetable-lookup-codes | Mã tra cứu còn hiệu lực; tạo mã của lớp hoặc giáo viên (P02-54) |
| DELETE | /api/v1/timetable-lookup-codes/{id} | Thu hồi mã (P02-54) |
| GET | /api/v1/public/timetable-lookup/{code} | Trang tra cứu không cần đăng nhập: thời khoá biểu đang áp dụng, thay đổi 7 ngày tới (P02-54) |
| GET | /api/v1/class-logs/week | Sổ đầu bài của lớp trong tuần chứa `date`: tiết theo thời khoá biểu kèm tiết đã ghi, số vắng, muộn, chữ ký Ban giám hiệu (P02-46, YCTD-162) |
| GET | /api/v1/class-logs/mine | Các tiết tôi dạy trong ngày kèm tiết đã ghi (P02-45) |
| GET | /api/v1/class-logs/lesson | Chi tiết một tiết (`class_id`, `date`, `period_no`) kèm học sinh và điểm danh mặc định (P02-45) |
| PUT | /api/v1/class-logs | Ghi tiết và điểm danh theo tiết (P02-45) |
| POST | /api/v1/class-logs/{id}/sign | Giáo viên ký tiết (P02-45) |
| POST | /api/v1/class-logs/reviews | Ban giám hiệu ký sổ tuần (cần `P02.class-log.review`) (P02-46) |
| GET, PUT | /api/v1/class-logs/lesson, /class-logs (từ YCTD-171) | Thêm `group_no` (0 đến 9, mặc định 0); chi tiết trả `group_filtered`, `rating` (quy tắc của cấp), `seating` (sơ đồ đang dùng); vi phạm quy tắc xếp loại trả 422 mã YCTD-171 |
| GET, PUT | /api/v1/class-logs/settings (từ YCTD-171) | Quy tắc xếp loại tiết theo cấp (`school_level`, `rating_mode`, `rating_labels`, `low_rating_comment`, `conduct_points`); sửa cần `P02.class-log.settings` |
| GET | /api/v1/class-logs/week/export (từ YCTD-171) | Xuất sổ đầu bài tuần của lớp (`class_id`, `date`, `format` = `xlsx`, `pdf`), ghi nhật ký xuất |
| GET, POST, PUT, DELETE | /api/v1/seating-charts, /{id}, /{id}/export (từ YCTD-171) | Sơ đồ chỗ ngồi: danh sách theo lớp (`class_id`, `date`) kèm `can_manage`, `current_chart_id`, học sinh; lập (`mode` = `manual`, `by_name`, `rotate`; `from_chart_id`, `rotate` = `columns`, `rows`); sửa chỗ; xoá; in `format` = `pdf`, `xlsx` |
| GET, PUT | /api/v1/conduct/red-stars, /red-stars/{childId} (từ YCTD-171) | Đội sao đỏ theo cấp; thêm, sửa nhiệm vụ, ngừng (`duty`, `status`) cần `P02.conduct.manage`; `POST /conduct/entries` nhận `reporter_child_id`; `/conduct/ranking` trả `lesson_points` và cột điểm tiết của lớp |
| GET | /api/v1/period-attendance/summary | Chuyên cần theo tiết của lớp trong khoảng ngày (P02-47) |
| GET | /api/v1/children/{id}/period-attendance | Điểm danh theo tiết của con trong tháng (P02-47) |
| GET | /api/v1/library/settings | Thiết lập thư viện: cấp có học sinh mượn, ngày giữ chỗ, quy định mượn, phân loại, chỉ tiêu (cần `P02.library.view` hoặc `manage`) (P02-75, YCTD-181) |
| PUT | /api/v1/library/settings | Ghi thiết lập, quy định mượn, ngưỡng chỉ tiêu (cần `P02.library.manage`) (P02-75) |
| POST, PATCH | /api/v1/library/categories, /api/v1/library/categories/{id} | Thêm, sửa phân loại ấn phẩm (P02-71) |
| GET, POST | /api/v1/library/titles | Tra cứu ấn phẩm (từ khóa, phân loại, khối, cấp, trạng thái, phân trang), thêm ấn phẩm (P02-71) |
| GET, PATCH | /api/v1/library/titles/{id} | Chi tiết ấn phẩm kèm bản sao, tệp; sửa, ngừng dùng (P02-71) |
| POST | /api/v1/library/titles/{id}/copies | Thêm số bản sao, cấp số đăng ký liên tiếp (P02-71) |
| GET, POST, DELETE | /api/v1/library/titles/{id}/files, /api/v1/library/titles/{id}/files/{fileId} | Tệp tài liệu số của ấn phẩm: liệt kê, tải lên, tải xuống, xóa (P02-71) |
| GET, PATCH | /api/v1/library/copies, /api/v1/library/copies/{id} | Liệt kê bản sao; đổi tình trạng tốt, hỏng, kệ, ghi chú (P02-71) |
| POST | /api/v1/library/copies/dispose | Thanh lý các bản sao kèm lý do (P02-71) |
| POST | /api/v1/library/labels | Tem mã PDF của các bản sao (P02-71) |
| GET | /api/v1/library/registry | Sổ đăng ký cá biệt, `format` xlsx hoặc pdf (P02-71) |
| GET, POST | /api/v1/library/readers | Danh sách bạn đọc; cấp thẻ cho một người (P02-72) |
| GET | /api/v1/library/readers/lookup | Tìm bạn đọc theo số thẻ hoặc tên (P02-72) |
| POST | /api/v1/library/readers/sync | Cấp thẻ cho cán bộ, học sinh đủ điều kiện, khóa thẻ người đã nghỉ (P02-72) |
| PATCH, GET | /api/v1/library/readers/{id}, /api/v1/library/readers/{id}/loans | Khóa, mở khóa thẻ; lịch sử mượn (P02-72) |
| POST | /api/v1/library/readers/cards | Thẻ bạn đọc PDF (P02-72) |
| GET, POST | /api/v1/library/loans | Danh sách lượt mượn (trạng thái open, overdue, returned, lost); cho mượn một hoặc nhiều bản (P02-73) |
| POST | /api/v1/library/loans/return, /api/v1/library/loans/return-many | Nhận trả một bản; trả hàng loạt kèm tình trạng (P02-73, P02-74) |
| POST | /api/v1/library/loans/{id}/renew, /api/v1/library/loans/{id}/lost | Gia hạn; báo mất (P02-73) |
| POST | /api/v1/library/loans/remind | Nhắc bạn đọc có bản quá hạn (P02-73) |
| GET, POST, DELETE | /api/v1/library/reservations, /api/v1/library/reservations/{id} | Danh sách, thêm, hủy lượt đặt trước (P02-73) |
| GET, POST, PATCH | /api/v1/library/textbook-sets, /api/v1/library/textbook-sets/{id} | Bộ sách giáo khoa theo khối (P02-74) |
| POST, GET | /api/v1/library/textbooks/issue, /api/v1/library/textbooks/outstanding | Phát bộ sách cho lớp; sách giáo khoa lớp còn giữ (P02-74) |
| GET, POST | /api/v1/library/stocktakes | Danh sách, mở đợt kiểm kê (P02-75) |
| GET, POST | /api/v1/library/stocktakes/{id}, /scan, /close, /resolve | Kết quả đợt; quét mã; đóng đợt; xử lý bản thiếu (P02-75) |
| GET | /api/v1/library/reports/overview, /api/v1/library/reports/export | Báo cáo thư viện và chỉ tiêu; xuất `type` overview, loans, overdue (P02-75) |
| GET | /api/v1/library/my-loans | Sách cán bộ đang mượn (P02-73) |
| GET | /api/v1/library/children/{id}/loans | Sách con đang mượn (phụ huynh của học sinh, nhân sự quản lý) (P02-73) |
| GET | /api/v1/audit-logs | Tra nhật ký thao tác; `page_size` đến 200 (YCTD-109) |
| GET, POST | /api/v1/api-clients | Danh sách và cấp khóa API cho đối tác |
| POST | /api/v1/api-clients/{id}/revoke | Thu hồi khóa API |
| POST | /api/v1/api-clients/verify | Máy chủ API kiểm tra khóa và địa chỉ mạng của đối tác, trả phạm vi (YCTD-63) |
| GET | /api/v1/partner/reports/summary | Đối tác đọc báo cáo tổng hợp; xác thực bằng khóa API |
| GET | /api/v1/partner/finance | Đối tác đọc phiếu thu, phiếu chi, khoản mục, công nợ tổng hợp |
| GET | /api/v1/partner/children | Đối tác đọc danh sách trẻ và phụ huynh; ghi nhật ký mỗi lần đọc |
| GET | /api/v1/partner/staff | Đối tác đọc nhân sự và bảng lương; ghi nhật ký mỗi lần đọc |
| GET | /api/v1/imports/templates/{type} | Tải mẫu Excel theo loại dữ liệu |
| POST | /api/v1/imports | Tải tệp lên và kiểm tra, trả báo cáo dòng lỗi |
| GET | /api/v1/imports/{id} | Trạng thái và báo cáo lỗi của lần nhập |
| POST | /api/v1/imports/{id}/commit | Ghi dữ liệu khi không còn dòng lỗi |
| GET | /api/v1/data-access-logs | Tra nhật ký truy cập dữ liệu nhạy cảm; quyền `P01.view`, cùng bộ lọc và phân trang với `/audit-logs` (YCTD-70) |

## 6. Trẻ, phụ huynh và lớp học

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/children | Danh sách trẻ có lọc và phân trang; lọc theo nhóm học sinh `group_id` (YCTD-104); bộ lọc, cột theo Sở, thứ tự A–Z, cỡ trang đến 200 (YCTD-108). Từ YCTD-319 mỗi dòng có thêm `guardian_name` (người liên hệ chính), `attendance_rate` (phần trăm ngày có mặt kể cả đi muộn, về sớm trên số ngày đã điểm danh ở năm học, null khi chưa điểm danh); `POST /children/export` nhận thêm mã cột `guardian_name`, `attendance_rate` |
| POST | /api/v1/children/export | Xuất Excel danh sách học sinh theo bộ lọc và cột đang hiện; cần `P17.data.export`, ghi nhật ký xuất (YCTD-108) |
| POST | /api/v1/children/bulk-update | Cập nhật hàng loạt học 2 buổi/ngày, bán trú (BR-106, YCTD-108) |
| POST | /api/v1/children | Tạo hồ sơ trẻ |
| GET | /api/v1/children/{id} | Chi tiết hồ sơ trẻ; từ YCTD-108 có `two_sessions_per_day`, `boarding`, `sms_phone` |
| PUT | /api/v1/children/{id}/sms-guardian | Chọn hoặc bỏ chọn phụ huynh có điện thoại nhận tin (BR-105, YCTD-108) |
| GET | /api/v1/student-movements | Biến động học sinh của năm học: nhập học, chuyển lớp, chuyển đơn vị, thôi học (P02-15, YCTD-108) |
| POST | /api/v1/student-movements/export | Xuất Excel biến động học sinh; cần `P17.data.export`, ghi nhật ký xuất (YCTD-108) |
| GET | /api/v1/administrative-units/addresses | Địa chỉ học sinh còn theo địa danh cũ, đề xuất địa danh mới (P02-17, YCTD-116) |
| POST | /api/v1/administrative-units/addresses/export | Xuất Excel lưới địa chỉ theo bộ lọc và `columns`; cần `P17.data.export` và `P02.child.manage` hoặc `P02.approve`, ghi nhật ký xuất (BR-117, YCTD-119) |
| POST | /api/v1/administrative-units/addresses/convert | Chuyển hàng loạt địa chỉ sang địa danh mới, ghi nhật ký trước và sau (YCTD-116) |
| GET | /api/v1/administrative-units/mappings | Bảng đối chiếu địa danh cũ sang mới (YCTD-116) |
| GET | /api/v1/administrative-units/mappings/template | Tệp mẫu Excel bảng đối chiếu; cần `P01.catalog.manage` (YCTD-116) |
| POST | /api/v1/administrative-units/mappings/import | Nhập bảng đối chiếu từ Excel; cần `P01.catalog.manage` (YCTD-116) |
| GET | /api/v1/administrative-units/new-wards | Xã mới để chọn khi sửa dòng đối chiếu (YCTD-126) |
| PUT, DELETE | /api/v1/administrative-units/mappings/{id} | Sửa xã mới, xóa dòng đối chiếu; cần `P01.catalog.manage` (YCTD-126) |
| DELETE | /api/v1/children/{id} | Xóa hồ sơ nháp, không xóa cứng (P02-18, YCTD-126) |
| POST | /api/v1/children/moet-codes | Ghi tay mã định danh Bộ GD&ĐT (P02-18, YCTD-126) |
| POST | /api/v1/children/moet-file | Tệp 82 cột theo mẫu Bộ theo bộ lọc (P02-18, YCTD-126) |
| POST | /api/v1/children/error-file | Xuất file lỗi hồ sơ học sinh (P02-18, YCTD-126) |
| POST | /api/v1/children/sms-guardians | Điện thoại nhận tin hàng loạt theo quan hệ (P02-20, YCTD-126) |
| POST | /api/v1/children/bulk-transfer-class | Chuyển lớp hàng loạt (P02-23, YCTD-126) |
| GET, POST, PUT | /api/v1/student-order | Thứ tự học sinh trong lớp, sắp xếp A–Z, ghi thứ tự (P02-19, YCTD-126) |
| POST | /api/v1/national-ids/verify, /unverify | Đánh dấu, bỏ đánh dấu đã xác thực số định danh (P02-21, YCTD-126) |
| PUT | /api/v1/children/{id}/residence-change | Ghi biến động cư trú (P02-21, YCTD-126) |
| GET | /api/v1/national-ids/progress, /duplicates | Tiến độ xác thực theo lớp, hồ sơ nghi trùng (P02-21, YCTD-126) |
| GET, POST | /api/v1/learning-accounts, /issue, /export | Tài khoản học và thi (P02-22, YCTD-126) |
| GET, POST | /api/v1/student-transfers, /out, /in, /{id}/approve, /{id}/reject | Chuyển đi, tiếp nhận chuyển đến (P02-23, YCTD-126) |
| GET | /api/v1/student-transfers/{id}/dossier | Hồ sơ chuyển PDF hoặc tệp mẫu Bộ (P02-23, YCTD-126) |
| POST | /api/v1/student-transfers/{id}/package, /package/preview, /package/accept | Gói chuyển trường: lập, xem trước, tiếp nhận (P02-23, YCTD-390) |
| GET | /api/v1/student-transfers/received-learning-records, /received-learning-records/{id}/file | Học bạ nhận từ trường khác, chỉ đọc (P02-23, YCTD-390) |
| GET, PUT, POST | /api/v1/student-transfers/mailbox/settings, /mailbox/directory, /mailbox/inbox, /mailbox/outbox, /{id}/send, /{id}/revoke, /mailbox/{mailboxId}/preview, /accept, /reject | Hộp thư chuyển trường giữa các trường trên nền tảng (P02-23, YCTD-390 lát L2) |
| GET | /api/v1/student-imports/moet-template, /moet-catalogs | Mẫu 82 cột, danh mục tra cứu của 4.1.2 (P02-19, YCTD-126) |
| GET | /api/v1/children/{id}/national-id | Xem đầy đủ số định danh cá nhân; chỉ VT-02, VT-15, VT-03, VT-12; ghi nhật ký truy cập |
| GET | /api/v1/children/{id}/photo-consent | Trạng thái và lịch sử đồng ý hình ảnh (YCTD-67) |
| POST | /api/v1/children/{id}/photo-consent | Phụ huynh đồng ý hoặc rút đồng ý; nhà trường ghi nhận giấy ký tay |
| PUT | /api/v1/children/{id}/staff-child | Gắn hoặc bỏ cờ trẻ con nhân viên (YCTD-67) |
| PATCH | /api/v1/children/{id} | Cập nhật hồ sơ trẻ; nhận thêm `two_sessions_per_day`, `boarding` (YCTD-108) |
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
| GET, POST | /api/v1/classes | Danh sách và tạo lớp; từ YCTD-111 thêm bộ lọc, cột và thông tin lớp theo Sở |
| PATCH | /api/v1/classes/{id} | Cập nhật lớp |
| POST | /api/v1/classes/delete | Xóa các lớp chưa phát sinh dữ liệu (`class_ids`, tối đa 200), trả lớp đã xóa và lớp không xóa được kèm lý do; cần `P02.class.manage` (BR-125, YCTD-127) |
| POST | /api/v1/classes/bulk-update | Đổi học 2 buổi/ngày, bán trú, trạng thái (giải thể) cho các lớp đã chọn; cần `P02.class.manage` (BR-125, YCTD-127) |
| POST | /api/v1/classes/export | Xuất Excel danh sách lớp theo bộ lọc và cột đang hiện; cần `P17.data.export`, ghi nhật ký xuất (YCTD-111) |
| GET | /api/v1/class-assignments | Phân công phụ trách lớp: phân công còn hiệu lực của lớp đang dùng trong phạm vi xem (YCTD-111); từ YCTD-127 có dòng giáo viên chưa phân công, lọc `assignment` |
| POST | /api/v1/class-assignments/export | Xuất Excel phân công phụ trách lớp; cần `P17.data.export`, ghi nhật ký xuất (YCTD-111) |
| GET | /api/v1/classes/{id}/children | Danh sách trẻ trong lớp |
| POST | /api/v1/imports/moet-codes | Nhập mã định danh ngành từ tệp (P02-12) |
| GET, POST | /api/v1/classes/{id}/staff-assignments | Phân công giáo viên chủ nhiệm và giáo viên bộ môn vào lớp |
| PATCH | /api/v1/classes/{id}/staff-assignments/{assignmentId} | Kết thúc phân công (YCTD-44) |
| PATCH | /api/v1/staff-assignments/{id} | Kết thúc hoặc sửa phân công |
| GET, POST | /api/v1/teaching-groups | Tổ chuyên môn, tổ trưởng và thành viên |
| GET | /api/v1/program-completion/classes | Lớp mẫu giáo 5-6 tuổi trong phạm vi kèm số liệu hoàn thành chương trình, lọc `org_unit_id` (P02-13, YCTD-104) |
| GET, PUT | /api/v1/program-completion/classes/{id} | Danh sách trẻ đang học của lớp kèm kết quả; ghi kết quả nhiều trẻ (YCTD-104) |
| POST | /api/v1/program-completion/classes/{id}/confirm | Xác nhận danh sách của lớp (BR-97) |
| POST | /api/v1/program-completion/classes/{id}/unconfirm | Hủy xác nhận kèm lý do (BR-97) |
| GET | /api/v1/program-completion/statistics | Thống kê hoàn thành chương trình theo lớp, đơn vị và tổng (YCTD-104) |
| GET | /api/v1/program-completion/export | Xuất Excel theo `class_id` hoặc `org_unit_id`, ghi nhật ký xuất (BR-74, YCTD-104) |
| GET, POST | /api/v1/child-groups | Danh sách nhóm học sinh trong phạm vi, lọc `org_unit_id`; lập nhóm (P02-14, YCTD-104) |
| GET, PATCH | /api/v1/child-groups/{id} | Chi tiết nhóm kèm trẻ; sửa tên, mô tả, giáo viên phụ trách, trạng thái (YCTD-104) |
| POST | /api/v1/child-groups/{id}/members | Thêm trẻ vào nhóm (YCTD-104) |
| POST | /api/v1/child-groups/{id}/members/remove | Bớt trẻ khỏi nhóm (YCTD-104) |
| GET | /api/v1/final-year-records | 1.1 Hồ sơ học sinh cuối cấp trong phạm vi kèm bộ lọc, hạn điều chỉnh, ngày hôm nay; tự lập hồ sơ cho trẻ mới vào lớp năm cuối cấp (P02-24, BR-132, YCTD-134) |
| GET, PUT | /api/v1/final-year-records/settings | Đọc, ghi hạn điều chỉnh thông tin `edit_deadline` (YCTD-134) |
| POST | /api/v1/final-year-records/actions | Xác nhận hồ sơ, Đã chỉnh sửa thông tin, Duyệt, Hủy duyệt cho hồ sơ chọn (YCTD-134) |
| POST | /api/v1/final-year-records/accounts | Thông tin tài khoản phụ huynh của hồ sơ chọn (YCTD-134) |
| POST | /api/v1/final-year-records/export, /pdf | Xuất Excel; Xuất PDF A5, A4 gập đôi, tệp nén, In phiếu kê khai, phiếu thông tin; ghi nhật ký xuất (BR-74, YCTD-134) |
| POST | /api/v1/final-year-records/import | Cập nhật từ Excel; `?error_file=true` trả tệp kèm cột nội dung lỗi (YCTD-134) |
| GET, DELETE | /api/v1/final-year-records/files/{fileId} | Tải, gỡ giấy tờ của hồ sơ cuối cấp (YCTD-134) |
| PUT | /api/v1/final-year-records/{id} | Sửa ô thông tin của hồ sơ (YCTD-134) |
| GET | /api/v1/final-year-records/{id}/events | Lịch sử hồ sơ (YCTD-134) |
| POST | /api/v1/final-year-records/{id}/files | Trường tải giấy tờ vào hồ sơ (YCTD-134) |
| GET, PUT | /api/v1/final-year-completion | 1.2 xác nhận hoàn thành theo lớp; ghi đánh dấu tay (P02-26, YCTD-134) |
| POST | /api/v1/final-year-completion/export | Xuất Excel 1.2 (YCTD-134) |
| GET | /api/v1/final-year-statistics | 4.1 thống kê theo đơn vị (P02-26, YCTD-134) |
| POST | /api/v1/final-year-statistics/export | Xuất Excel 4.1 (YCTD-134) |
| GET | /api/v1/parent/final-year-records | Ứng dụng phụ huynh: hồ sơ cuối cấp của con (P02-25, YCTD-134) |
| POST | /api/v1/parent/final-year-records/{id}/confirm, /{id}/propose, /{id}/consent, /{id}/files | Phụ huynh xác nhận, đề xuất sửa, đồng ý nhập học, tải giấy tờ (YCTD-134) |
| GET | /api/v1/entry-school-map | 1.8 Trường chính và điểm trường kèm kiểm dò vị trí (P02-27, YCTD-134) |
| PUT | /api/v1/entry-school-map/{unitId} | Ghi tọa độ, tỉnh/thành phố, phường/xã, khu phố, điện thoại, địa chỉ của đơn vị (YCTD-134) |
| POST | /api/v1/entry-school-map/confirm | Xác nhận thông tin trường (YCTD-134) |
| GET, POST | /api/v1/school-services | 2.1 danh mục dịch vụ tại trường lọc `code`, `name`; thêm dịch vụ (P02-27, YCTD-134) |
| PUT | /api/v1/school-services/{id} | Sửa dịch vụ (YCTD-134) |
| POST | /api/v1/school-services/delete, /export | Xóa dịch vụ chọn; Xuất Excel (YCTD-134) |
| GET | /api/v1/entry-admissions/staff, /entry-admissions/classes | 3.3 nhân sự, 3.4 lớp sẵn có trong phạm vi (P02-27, YCTD-134) |
| POST | /api/v1/entry-admissions/staff/export | Xuất Excel 3.3 (YCTD-134) |
| GET | /api/v1/admission-support | 5.1 yêu cầu hỗ trợ tuyển sinh lọc `q`, `national_id`, `status` (P02-28, YCTD-134) |
| PUT | /api/v1/admission-support/{id} | Ghi câu trả lời (YCTD-134) |
| POST | /api/v1/admission-support/notify, /export | Gửi câu trả lời cho phụ huynh; Xuất Excel (YCTD-134) |
| GET, POST | /api/v1/parent/admission-support | Ứng dụng phụ huynh: yêu cầu đã gửi; gửi yêu cầu hỗ trợ cho con (YCTD-134) |
| GET, PUT | /api/v1/entry-intake/campaigns, /entry-intake/campaigns/{id} | Đợt tuyển sinh kèm loại hình, năm học nhận trẻ; ghi hai ô này (P02-29, YCTD-135) |
| GET | /api/v1/entry-intake/options | Năm học, đơn vị, lớp đang dùng, danh mục quan hệ (YCTD-135) |
| GET | /api/v1/entry-intake/applications | Hồ sơ của 1.3, 1.4, 1.5, 1.6, 1.7 theo `screen` kèm bộ lọc (P02-29 đến P02-33, BR-133, YCTD-135) |
| PUT | /api/v1/entry-intake/applications/{id} | Cập nhật hồ sơ (YCTD-135) |
| POST | /api/v1/entry-intake/save, /review, /remove, /cancel | Lưu dữ liệu 1.4; xác nhận trường tiên tiến; Xóa hồ sơ phân tuyến; Hủy nhập học hồ sơ chưa chuyển (YCTD-135) |
| GET, POST | /api/v1/entry-intake/import-template, /entry-intake/import | Mẫu và nhập danh sách phân tuyến; `?error_file=true` trả tệp lỗi (YCTD-135) |
| POST | /api/v1/entry-intake/applications/{id}/files | Tải giấy tờ vào hồ sơ tuyển sinh (YCTD-135) |
| GET, DELETE | /api/v1/entry-intake/files/{fileId} | Mở, gỡ giấy tờ (YCTD-135) |
| POST | /api/v1/entry-intake/evidence, /export, /forms | Tải minh chứng (tệp nén); Xuất Excel theo màn hình; phiếu thông tin, phiếu đăng ký PDF; ghi nhật ký xuất (BR-74, YCTD-135) |
| GET | /api/v1/entry-intake/notices/recipients | Người nhận thông báo của đợt (P02-31, YCTD-135) |
| POST | /api/v1/entry-intake/notices/copy, /notices/send | Sao chép nội dung; Gửi thông báo (YCTD-135) |
| GET, POST | /api/v1/entry-intake/notices/template, /notices/import | Mẫu và nhập nội dung gửi, học sinh ngoài hệ thống (YCTD-135) |
| PUT | /api/v1/entry-intake/transfers | Ghi điểm trường, loại hồ sơ của 1.6 (P02-32, YCTD-135) |
| POST | /api/v1/entry-intake/transfers/arrange, /transfers/run | Xếp lớp (5.11); Chuyển hồ sơ sang CSDL (YCTD-135) |
| GET | /api/v1/entry-intake/transfers/results | Kết quả chuyển, kết quả hủy nhập học theo mã gói tin (P02-32, P02-33, YCTD-135) |
| POST | /api/v1/entry-intake/transfers/cancel | Hủy nhập học hồ sơ đã chuyển (P02-33, YCTD-135) |
| GET, POST, PATCH, DELETE | /api/v1/kpi/rule-sets, /kpi/rule-sets/{id}, /kpi/rule-sets/{id}/versions, /kpi/rule-versions/{id}, /kpi/rule-versions/{id}/publish | Bộ quy tắc và phiên bản (P09-13, YCTD-139) |
| GET, PUT | /api/v1/kpi/profiles | Đối tượng đánh giá (P09-13, YCTD-139) |
| GET, POST, PATCH, PUT | /api/v1/kpi/periods, /kpi/periods/{id}, /kpi/periods/{id}/rule-versions, /kpi/periods/{id}/lock, /kpi/periods/{id}/reopen | Kỳ, phiên bản quy tắc của kỳ, khóa, mở lại (P09-13, YCTD-139) |
| GET, POST, PATCH | /api/v1/kpi/catalog, /kpi/catalog/{id}, /kpi/catalog/proposals, /kpi/catalog/{id}/decision, /kpi/catalog/import, /kpi/catalog/template, /kpi/catalog/export, /kpi/catalog/indicator-progress | Danh mục công việc chuẩn (P09-14, YCTD-139) |
| GET, POST, PATCH, PUT, DELETE | /api/v1/kpi/tasks và các điểm cuối con | Việc, minh chứng, tự đánh giá, chấm, ủy quyền (P09-15, P09-16, YCTD-139) |
| GET, PUT, POST | /api/v1/kpi/evaluations, /kpi/evaluations/mine, /kpi/evaluations/{id}/return, /kpi/evaluations/{id}/conclude, /kpi/advisory, /kpi/voting | Phiếu, kết luận, tham mưu, biểu quyết (P09-17, P09-18, YCTD-139) |
| GET | /api/v1/kpi/reports/… | Mẫu báo cáo Excel, Word, PDF (P09-19, BR-74, YCTD-139) |
| POST | /api/v1/kpi/legacy-import | Chuyển dữ liệu từ hệ thống KPI cũ (P09-19, YCTD-139) |

## 7. Giảng dạy

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/lesson-domains | Danh mục lĩnh vực bài học của đơn vị và Trường chính; thêm lĩnh vực |
| PATCH | /api/v1/lesson-domains/{id} | Sửa tên, thứ tự, ngừng dùng lĩnh vực |
| GET, POST | /api/v1/lesson-groups | Danh mục nhóm bài học, lọc theo lĩnh vực; thêm nhóm |
| PATCH | /api/v1/lesson-groups/{id} | Sửa tên, thứ tự, ngừng dùng nhóm |
| GET, POST | /api/v1/themes | Danh sách và tạo chủ đề giảng dạy |
| PATCH | /api/v1/themes/{id} | Sửa hoặc ngừng dùng chủ đề |
| GET, POST | /api/v1/lessons | Danh sách bài học, lọc theo chủ đề, lĩnh vực, nhóm, độ tuổi, của tôi; tạo bài học |
| PATCH | /api/v1/lessons/{id} | Người soạn cập nhật, chia sẻ hoặc ngừng dùng bài học |
| GET, POST | /api/v1/lesson-plans | Danh sách giáo án của tôi, chờ tôi duyệt hoặc theo lớp và khoảng ngày; soạn giáo án |
| GET, PATCH | /api/v1/lesson-plans/{id} | Chi tiết kèm lịch sử duyệt; cập nhật giáo án nháp hoặc bị trả lại |
| POST | /api/v1/lesson-plans/{id}/submit | Gửi duyệt giáo án |
| POST | /api/v1/lesson-plans/{id}/approve | Tổ trưởng duyệt bước trước; quản lý đơn vị duyệt và công bố |
| POST | /api/v1/lesson-plans/{id}/reject | Trả lại giáo án kèm góp ý |
| GET, PUT | /api/v1/classes/{id}/timetable | Đọc thời khóa biểu theo tuần; lưu bản nháp phiên bản áp dụng từ thứ Hai |
| POST | /api/v1/classes/{id}/timetable/publish | Công bố phiên bản thời khóa biểu cho phụ huynh |
| GET, POST | /api/v1/classes/{id}/activity-schedules | Lịch hoạt động của lớp theo khoảng ngày; thêm hoạt động nháp |
| POST | /api/v1/classes/{id}/activity-schedules/publish | Công bố hoạt động nháp trong khoảng ngày |
| PATCH | /api/v1/class-activity-schedules/{id} | Sửa hoạt động nháp hoặc hủy hoạt động |
| GET, POST | /api/v1/teaching-plans | Kế hoạch giảng dạy của lớp; lập kế hoạch theo lớp và kỳ |
| PATCH | /api/v1/teaching-plans/{id} | Cập nhật kế hoạch, tiến độ, trạng thái |
| GET, POST | /api/v1/children/{id}/progress | Tiến độ học tập của trẻ theo kỳ; ghi chỉ số và nhận xét |
| POST | /api/v1/children/{id}/progress/publish | Công bố phiếu tiến độ của kỳ cho phụ huynh |
| GET | /api/v1/children/{id}/learning | Trang học tập của con: thời khóa biểu, lịch hoạt động, tiến độ đã công bố |

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
| GET, POST | /api/v1/fee-schedules (từ YCTD-154) | `GET` lọc `school_level`; `POST` nhận `school_level` (mặc định MN, cấp phải đang bật); mỗi phiên bản trả `school_level` |
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
| POST | /api/v1/payment-webhooks/bank-transfer | Nhận thông báo tiền vào từ ngân hàng hoặc đơn vị trung gian; không dùng mã phiên, xác thực bằng chữ ký; làm khi chọn nhà cung cấp (YCTD-57) |
| POST | /api/v1/payment-webhooks/development | Giả lập thông báo tiền vào, chỉ có với bộ giả lập nhà cung cấp (YCTD-57) |
| POST | /api/v1/payment-webhooks/payos | Thông báo tiền vào của PayOS, công khai, kiểm chữ ký HMAC-SHA256 (YCTD-94) |
| POST | /api/v1/payment-webhooks/sepay | Thông báo giao dịch của SePay, công khai, kiểm khóa API ở tiêu đề Authorization (YCTD-94) |
| POST | /api/v1/payment-webhooks/casso | Thông báo giao dịch Webhook V2 của Casso, công khai, kiểm chữ ký HMAC-SHA512 (YCTD-94) |
| GET | /api/v1/payment-webhooks/vnpay-ipn | Kết quả thanh toán VNPay (IPN), công khai, kiểm chữ ký HMAC-SHA512, trả RspCode theo VNPay (YCTD-94) |
| GET, PUT | /api/v1/online-payment-settings | Tài khoản nhận thanh toán trực tuyến của trường và khoản mục thu (YCTD-57) |
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
| GET | /api/v1/debts/reminders | Danh sách nhắc nợ: hóa đơn quá hạn của đơn vị kèm mốc, lần nhắc gần nhất, cần nhắc (P05-10) |
| POST | /api/v1/debts/reminders/send | Gửi nhắc nợ cho các hóa đơn được chọn (P05-10) |
| GET, POST | /api/v1/debt-resolutions | Danh sách và lập đề xuất xử lý công nợ quá hạn (P05-12) |
| POST | /api/v1/debt-resolutions/{id}/decide | Phó Hiệu trưởng hoặc Hiệu trưởng ghi quyết định (P05-12) |
| GET, POST | /api/v1/bank-transactions | Danh sách và ghi dòng sao kê ngân hàng (P06-06) |
| DELETE | /api/v1/bank-transactions/{id} | Xóa dòng sao kê chưa khớp (P06-06) |
| POST | /api/v1/bank-transactions/{id}/match | Khớp dòng sao kê với giao dịch tài khoản (P06-06) |
| POST | /api/v1/bank-transactions/{id}/unmatch | Bỏ khớp (P06-06) |
| POST | /api/v1/bank-transactions/auto-match | Khớp tự động trong khoảng ngày (P06-06) |
| GET | /api/v1/bank-reconciliation | Bảng đối chiếu tài khoản ngân hàng trong khoảng ngày (P06-06) |
| GET, POST | /api/v1/payables | Danh sách và ghi công nợ phải trả (P06-07) |
| GET | /api/v1/payables/sources | Phiếu mua hàng, phiếu mua thuốc chưa ghi công nợ và nhà cung cấp đang dùng (P06-07) |
| POST | /api/v1/payables/{id}/pay | Ghi đã trả bằng phiếu chi đã phát hành (P06-07) |
| POST | /api/v1/payables/{id}/cancel | Hủy công nợ chưa trả (P06-07) |
| GET | /api/v1/fiscal-periods | Các tháng của năm học kèm trạng thái kỳ tài chính của đơn vị (P06-09) |
| GET | /api/v1/fiscal-periods/preview | Số liệu và chứng từ chờ duyệt của một kỳ (P06-09) |
| POST | /api/v1/fiscal-periods | Kế toán trưởng đề nghị chốt kỳ (P06-09) |
| POST | /api/v1/fiscal-periods/{id}/close | Hiệu trưởng phê duyệt và chốt kỳ (P06-09) |
| POST | /api/v1/fiscal-periods/{id}/reject | Hiệu trưởng từ chối đề nghị chốt kèm lý do (P06-09) |

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
| GET | /api/v1/ledger/accounts | Hệ thống tài khoản kèm cờ có tài khoản chi tiết và quyền sửa (người xem hoặc quản lý sổ) |
| POST | /api/v1/ledger/accounts | Thêm tài khoản chi tiết dưới tài khoản cha (quản lý sổ ở Trường chính) |
| PATCH | /api/v1/ledger/accounts/{id} | Đổi tên hoặc ngừng dùng, dùng lại tài khoản chi tiết |
| GET | /api/v1/ledger/posting-rules | Loại chứng từ và quy tắc ghi sổ đang dùng |
| PUT | /api/v1/ledger/posting-rules | Lưu quy tắc của một loại chứng từ (và khoản mục) |
| DELETE | /api/v1/ledger/posting-rules/{id} | Bỏ quy tắc riêng theo khoản mục |
| POST | /api/v1/ledger/post-documents | Ghi sổ chứng từ chưa ghi, trả số bút toán theo loại chứng từ |
| GET | /api/v1/ledger/entries | Sổ nhật ký chung theo đơn vị (bỏ trống là cả phạm vi) và khoảng ngày from, to |
| GET | /api/v1/ledger/entries/{id} | Một bút toán kèm dòng |
| POST | /api/v1/ledger/entries | Ghi bút toán thủ công |
| POST | /api/v1/ledger/entries/{id}/void | Hủy bút toán thủ công kèm lý do |
| GET | /api/v1/ledger/reports/trial-balance | Bảng cân đối số phát sinh |
| GET | /api/v1/ledger/reports/general-ledger | Sổ cái của một tài khoản (account_id) gồm tài khoản chi tiết |
| POST | /api/v1/reports/ledger-journal/export, /ledger-trial-balance/export, /ledger-general-ledger/export | Xuất Excel sổ nhật ký chung, bảng cân đối, sổ cái (P17-12) |
| GET, PUT | /api/v1/bank-statement-profiles/{accountId} | Xem và lưu cấu hình cột của tệp sao kê của tài khoản ngân hàng (G3-05) |
| GET, POST | /api/v1/bank-statement-imports | Danh sách lần nhập của tài khoản; nhập tệp sao kê Excel hoặc CSV rồi đối soát tự động (G3-05) |
| POST | /api/v1/bank-transactions/{id}/create-receipt | Xác nhận đề xuất: lập phiếu thu chuyển khoản từ dòng sao kê và khớp (G3-05) |
| POST | /api/v1/bank-transactions/{id}/dismiss-suggestion | Bỏ đề xuất lập phiếu thu của dòng sao kê (G3-05) |
| GET | /api/v1/payment-providers | Các cổng thanh toán trực tuyến máy chủ đã bật (G3-05) |
| PUT | /api/v1/cash-accounts/{id}/payment-provider | Tài khoản ngân hàng chọn cổng thanh toán và khai mã BIN (G3-05) |
| PATCH | /api/v1/cash-accounts/{id} | Sửa tên, thông tin ngân hàng, ngừng sử dụng |
| GET | /api/v1/cash-books | Sổ quỹ hoặc sổ tài khoản theo khoảng ngày, thay cho lịch sử giao dịch của tài khoản (YCTD-55) |
| GET, POST | /api/v1/suppliers | Danh sách và thêm nhà cung cấp của đơn vị |
| PUT | /api/v1/suppliers/{id} | Sửa hoặc ngừng dùng nhà cung cấp |
| GET, POST | /api/v1/cashflow-categories | Khoản mục và nhóm thu chi |
| PATCH | /api/v1/cashflow-categories/{id} | Sửa, ngừng sử dụng khoản mục (YCTD-49) |

## 11. Nhân sự, chấm công và tiền lương

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/staff | Danh sách và tạo hồ sơ nhân sự |
| GET, PUT | /api/v1/staff/{id} | Chi tiết kèm hợp đồng và cập nhật hồ sơ nhân sự (YCTD-58) |
| GET | /api/v1/staff/search | Lưới 3.1.1 Hồ sơ cán bộ, giáo viên: phân trang, bộ lọc mở rộng, A–Z (YCTD-112) |
| POST | /api/v1/staff/export | Xuất Excel danh sách cán bộ, giáo viên theo bộ lọc và cột đang hiện; cần `P17.data.export`, ghi nhật ký xuất (YCTD-112) |
| PATCH | /api/v1/staff/{id}/profile | Ghi hồ sơ theo biểu mẫu của Sở và thông tin riêng của trường, chỉ ô gửi lên (YCTD-112) |
| POST | /api/v1/staff/delete | Xóa hồ sơ nhập nhầm chưa có dữ liệu liên quan, trả kết quả và lý do từng hồ sơ; cần `P07.staff.manage` (YCTD-124) |
| POST | /api/v1/staff/ministry-export | Xuất tệp theo mẫu Bộ 75 cột kèm kiểm tra dữ liệu, danh mục; không gửi đi; cần `P17.data.export`, ghi nhật ký xuất (YCTD-124) |
| POST | /api/v1/staff/ministry-errors | Xuất file lỗi: hồ sơ thiếu, sai ô bắt buộc theo mẫu Bộ; cần `P17.data.export` (YCTD-124) |
| GET | /api/v1/staff/ministry-template | Mẫu 75 cột của 3.1.3, `?with_data=true` kèm hồ sơ; cần `P01.import.staff` (YCTD-124) |
| GET | /api/v1/staff/ministry-catalogs | Danh mục của Bộ để tra cứu (YCTD-124) |
| GET | /api/v1/staff-branches | Nhân sự kèm phân hiệu, điểm trường đã gán (3.1.2, YCTD-124) |
| POST | /api/v1/staff-branches/assign, /unassign, /from-teaching | Gán, bỏ gán phân hiệu; lấy theo phân hiệu giảng dạy; cần `P07.staff.manage` |
| GET | /api/v1/staff-identity | Danh sách xác thực số định danh, bản chạy nội bộ (3.1.5, YCTD-124) |
| POST | /api/v1/staff-identity/mark | Đánh dấu đã xác thực, sai thông tin, đặt lại chưa xác thực; cần `P07.staff.manage` |
| GET | /api/v1/staff-identity/progress | Tiến độ xác thực theo đơn vị hoặc bộ phận (5.6); cần `P17.staff-statistics.view` |
| GET | /api/v1/staff-identity/duplicates | Hồ sơ trùng số định danh (5.6); cần `P17.staff-statistics.view` |
| GET, POST | /api/v1/staff-movements | Danh sách biến động theo loại; lập phiếu (3.5, YCTD-124) |
| POST | /api/v1/staff-movements/transfer-in-file | Lập phiếu tiếp nhận chuyển đến từ tệp hồ sơ chuyển 75 cột một dòng |
| GET | /api/v1/staff-movements/{id} | Chi tiết phiếu biến động |
| POST | /api/v1/staff-movements/{id}/approve, /reject, /confirm | Duyệt, tiếp nhận hoặc xác nhận; từ chối kèm lý do; đánh dấu trường đến đã tiếp nhận |
| GET | /api/v1/staff-movements/{id}/pdf, /ministry-file | Phiếu PDF; tệp theo mẫu Bộ của phiếu chuyển đi (cần `P17.data.export`); ghi nhật ký xuất |
| GET | /api/v1/staff/me | Hồ sơ và hợp đồng của chính mình (YCTD-58) |
| PATCH | /api/v1/staff/me/contact | Người dùng tự sửa `phone` (9 đến 15 chữ số, có thể có dấu + ở đầu), `email`, `address` trên hồ sơ nhân sự gắn với tài khoản của mình; chưa gắn trả `ERR_NOT_FOUND` (404); ghi nhật ký thao tác `staff`; trả hồ sơ như `GET /staff/me` (YCTD-123) |
| GET | /api/v1/staff/expiring-contracts | Hợp đồng sắp hết hạn theo cấu hình đơn vị (YCTD-58) |
| POST, DELETE | /api/v1/staff/{id}/account | Liên kết và bỏ liên kết tài khoản có sẵn (YCTD-58) |
| POST | /api/v1/staff/{id}/contracts | Lập hợp đồng lao động |
| POST | /api/v1/employment-contracts/{id}/terminate | Chấm dứt hợp đồng, khóa tài khoản liên kết (YCTD-58) |
| GET | /api/v1/attendance-logs | Bảng chấm công của đơn vị theo tháng kèm loại ngày (YCTD-59) |
| PUT | /api/v1/attendance-logs | Phòng nhân sự ghi hoặc sửa chấm công của một ngày |
| GET | /api/v1/timesheet-periods | Trạng thái kỳ công, đề nghị mở lại và tổng hợp bảng công đã chốt (YCTD-59) |
| POST | /api/v1/attendance-logs/lock | Chốt bảng công của đơn vị theo tháng |
| GET, POST | /api/v1/attendance-logs/reopen-requests | Đề nghị mở lại đang chờ trong phạm vi người duyệt; nhân sự đề nghị mở lại kỳ công đã chốt kèm lý do |
| POST | /api/v1/attendance-logs/reopen-requests/{id}/approve | Ban Giám hiệu duyệt mở lại kỳ công (Q-135) |
| POST | /api/v1/attendance-logs/reopen-requests/{id}/reject | Ban Giám hiệu từ chối mở lại kèm lý do (YCTD-59) |
| GET, POST | /api/v1/work-schedules | Lịch nghỉ và lịch công tác của đơn vị theo tháng; lập lịch nháp (YCTD-68) |
| POST | /api/v1/work-schedules/publish | Công bố lịch nháp của đơn vị trong tháng |
| DELETE | /api/v1/work-schedules/{id} | Xóa lịch khi kỳ công còn mở |
| GET | /api/v1/me/work-schedules | Lịch đã công bố của tôi theo tháng |
| GET, POST | /api/v1/leave-requests | Danh sách và tạo đơn xin nghỉ phép |
| POST | /api/v1/leave-requests/{id}/approve | Duyệt đơn nghỉ phép |
| POST | /api/v1/leave-requests/{id}/reject | Từ chối đơn nghỉ phép kèm lý do |
| POST | /api/v1/leave-requests/{id}/cancel | Hủy đơn còn chờ duyệt (YCTD-59) |
| GET | /api/v1/me/leave-requests | Đơn nghỉ và số ngày phép năm của chính người đăng nhập (YCTD-59) |
| GET, PUT | /api/v1/leave-balances | Số ngày phép năm của nhân sự trong đơn vị; phòng nhân sự chỉnh kèm lý do (YCTD-59) |
| GET | /api/v1/payrolls | Danh sách bảng lương theo tháng (YCTD-60) |
| POST | /api/v1/payrolls | Tính hoặc tính lại bảng lương toàn trường của tháng kèm điều chỉnh theo công đã chốt của tháng trước; trả `ERR_RULE_VIOLATION` khi tháng trước còn đơn vị chưa chốt công (BR-43) |
| GET | /api/v1/payrolls/{id} | Bảng lương kèm phiếu của nhân sự trong phạm vi người xem |
| POST | /api/v1/payrolls/{id}/submit | Trình duyệt bảng lương (YCTD-60) |
| POST | /api/v1/payrolls/{id}/approve | Phê duyệt bảng lương, công bố phiếu lương |
| POST | /api/v1/payrolls/{id}/return | Trả lại bảng lương về nháp kèm lý do (YCTD-60) |
| POST | /api/v1/payrolls/{id}/payment | Lập phiếu chi lương nháp từ bảng lương đã duyệt (YCTD-61) |
| GET, POST | /api/v1/payroll-settlements | Hợp đồng đã chấm dứt kèm bảng quyết toán; lập hoặc tính lại bảng quyết toán (BR-90, YCTD-61) |
| GET | /api/v1/payroll-settlements/{id} | Chi tiết bảng quyết toán kèm phiếu chi, phiếu thu đã lập |
| POST | /api/v1/payroll-settlements/{id}/submit | Trình duyệt bảng quyết toán |
| POST | /api/v1/payroll-settlements/{id}/approve | Duyệt bảng quyết toán |
| POST | /api/v1/payroll-settlements/{id}/return | Trả lại bảng quyết toán kèm lý do |
| POST | /api/v1/payroll-settlements/{id}/recovery-receipts | Lập phiếu thu thu hồi lương không gắn trẻ |
| POST | /api/v1/payroll-settlements/{id}/payment | Lập phiếu chi quyết toán nháp khi phải trả thêm |
| GET, POST | /api/v1/payroll-adjustments | Khoản điều chỉnh lương cho kỳ sau (BR-45) |
| POST | /api/v1/payroll-adjustments/{id}/approve | Duyệt khoản điều chỉnh |
| POST | /api/v1/payroll-adjustments/{id}/reject | Từ chối khoản điều chỉnh kèm lý do |
| GET | /api/v1/me/payslips | Phiếu lương của chính người đăng nhập |
| GET | /api/v1/me/attendance-logs | Chấm công của chính người đăng nhập theo tháng |
| POST | /api/v1/me/attendance-logs/check-in | Tự vào ca hôm nay theo giờ máy chủ (YCTD-59) |
| POST | /api/v1/me/attendance-logs/check-out | Tự ra ca hôm nay theo giờ máy chủ (YCTD-59) |
| GET, POST | /api/v1/pay-item-types | Danh mục phụ cấp, thưởng, khấu trừ (YCTD-60) |
| PUT | /api/v1/pay-item-types/{id} | Sửa hoặc ngừng dùng khoản |
| GET, POST | /api/v1/staff/{id}/pay-items | Khoản gán cho nhân sự |
| DELETE | /api/v1/staff-pay-items/{id} | Bỏ khoản đã gán |
| PUT | /api/v1/staff/{id}/dependents | Số người phụ thuộc của nhân sự |
| GET, POST | /api/v1/tax-tables | Biểu thuế thu nhập cá nhân theo phiên bản (YCTD-60) |
| GET, POST | /api/v1/leave-policies | Quy định số ngày phép năm theo chức danh và thâm niên |
| PUT | /api/v1/leave-policies/{id} | Sửa hoặc ngừng dùng quy định phép năm (YCTD-59) |
| GET | /api/v1/school-days | Ngày nghỉ lễ và lịch học bù, nghỉ bù của một năm dương lịch (YCTD-59) |
| POST | /api/v1/holidays | Thêm ngày nghỉ lễ |
| PUT, DELETE | /api/v1/holidays/{id} | Sửa tên, hưởng lương hoặc xóa ngày nghỉ lễ |
| POST | /api/v1/school-day-changes | Thêm ngày học bù thứ bảy hoặc ngày nghỉ bù chung toàn trường; chỉ Ban Giám hiệu (YCTD-59) |
| DELETE | /api/v1/school-day-changes/{id} | Xóa ngày học bù hoặc nghỉ bù |
| GET | /api/v1/professional-standards | Danh mục tiêu chuẩn kèm tiêu chí chuẩn nghề nghiệp, lọc `standard_type` (P07-05, YCTD-104) |
| PATCH | /api/v1/professional-standards/{id} | Sửa tên tiêu chuẩn (YCTD-104) |
| POST | /api/v1/professional-criteria | Thêm tiêu chí (YCTD-104) |
| PATCH | /api/v1/professional-criteria/{id} | Sửa tên, tiêu chí trọng yếu, trạng thái của tiêu chí (YCTD-104) |
| GET, POST | /api/v1/professional-evaluations | Danh sách phiếu trong phạm vi, lọc `org_unit_id`, `standard_type`, `status`; mở phiếu cho nhiều nhân sự (YCTD-104) |
| GET | /api/v1/professional-evaluations/statistics | Thống kê phiếu theo loại chuẩn và mức xếp loại (YCTD-104) |
| GET | /api/v1/professional-evaluations/{id} | Chi tiết phiếu kèm tiêu chí (YCTD-104) |
| PUT | /api/v1/professional-evaluations/{id}/self | Lưu tự đánh giá (YCTD-104) |
| POST | /api/v1/professional-evaluations/{id}/submit-self | Gửi tự đánh giá (BR-98) |
| PUT | /api/v1/professional-evaluations/{id}/assessment | Người đánh giá lưu mức, nhận xét (YCTD-104) |
| POST | /api/v1/professional-evaluations/{id}/finalize | Chốt phiếu, xếp loại chung (BR-99) |
| GET | /api/v1/me/professional-evaluation | Phiếu chuẩn nghề nghiệp của chính người đăng nhập trong năm học (YCTD-104) |

## 12. Công việc, kế hoạch và đánh giá

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/tasks | Danh sách việc theo `view` (`mine` việc của tôi, `assigned` việc tôi giao, `unit` việc được giao trong đơn vị), lọc `status`, `org_unit_id`, `assignee_staff_id`; tạo việc cá nhân (không có `assignee_staff_id`) hoặc giao việc |
| GET | /api/v1/tasks/{id} | Chi tiết việc kèm các lần cập nhật tiến độ, `can_edit`, `can_update_progress` |
| PATCH | /api/v1/tasks/{id} | Sửa việc; người giao chỉ hủy kèm `cancel_reason`; việc cá nhân đổi được trạng thái |
| POST | /api/v1/tasks/{id}/updates | Người nhận cập nhật `progress_percent` (0–100) kèm `content` |
| GET | /api/v1/task-progress | Bảng tiến độ việc được giao theo người nhận, lọc `org_unit_id`, `from`, `to` (theo hạn) |
| GET, POST | /api/v1/plans | Danh sách kế hoạch kèm tiến độ; lập kế hoạch nháp kèm đầu việc |
| GET, PATCH | /api/v1/plans/{id} | Chi tiết kế hoạch kèm đầu việc và tiến độ; sửa kế hoạch nháp (thay toàn bộ đầu việc) |
| POST | /api/v1/plans/{id}/items | Thêm đầu việc; kế hoạch đang thực hiện thì giao việc ngay |
| POST | /api/v1/plans/{id}/activate | Kích hoạt kế hoạch, giao việc cho người phụ trách từng đầu việc |
| POST | /api/v1/plans/{id}/close | Đóng kế hoạch đang thực hiện |
| GET, POST | /api/v1/evaluation-criteria | Chỉ số đánh giá theo đơn vị; thêm chỉ số |
| PATCH | /api/v1/evaluation-criteria/{id} | Sửa tên, trọng số, điểm tối đa, ngừng dùng chỉ số |
| GET, POST | /api/v1/evaluations | Phiếu đánh giá theo đơn vị, nhân sự, kỳ, trạng thái; lập phiếu nháp (đánh giá lại kèm `reevaluation_reason`) |
| GET, PATCH | /api/v1/evaluations/{id} | Chi tiết phiếu kèm điểm từng chỉ số; sửa phiếu nháp |
| POST | /api/v1/evaluations/{id}/publish | Công bố kết quả đánh giá, phiếu cũ của kỳ chuyển đã thay thế |
| GET | /api/v1/me/evaluations | Phiếu đánh giá đã công bố của chính người đăng nhập |
| GET, POST | /api/v1/staff/{id}/work-history | Quá trình công tác và chứng chỉ của nhân sự; ghi thêm mốc công tác |
| PATCH | /api/v1/staff-work-history/{id} | Ghi ngày kết thúc cho mốc công tác đang mở |
| POST | /api/v1/staff/{id}/certificates | Thêm chứng chỉ |
| DELETE | /api/v1/staff-certificates/{id} | Xóa chứng chỉ ghi nhầm |
| GET, POST | /api/v1/bonus-deductions | Khoản thưởng, khấu trừ theo `month` và `staff_id` kèm `can_cancel`; ghi khoản |
| POST | /api/v1/bonus-deductions/{id}/cancel | Hủy khoản kèm lý do khi bảng lương của tháng còn nháp |
| GET, POST | /api/v1/archive-fonds | Danh sách phông lưu trữ kèm `holding_count`, `record_count`; thêm phông (P09-07, YCTD-118) |
| PUT, DELETE | /api/v1/archive-fonds/{id} | Sửa phông; xóa phông không còn thông tin lưu trữ, hồ sơ (BR-116) |
| GET, POST | /api/v1/archive-holdings | Thông tin lưu trữ, lọc `fond_id`; thêm dòng (P09-07) |
| PUT, DELETE | /api/v1/archive-holdings/{id} | Sửa, xóa dòng thông tin lưu trữ |
| GET | /api/v1/archive-report | Báo cáo lưu trữ theo phông, giai đoạn kèm `totals`, lọc `fond_id`, `storage_location` (P09-08) |
| POST | /api/v1/archive-report/export | Xuất Excel báo cáo lưu trữ, ghi nhật ký xuất `archive-report` (BR-74) |
| GET, POST | /api/v1/archive-records | Hồ sơ tài liệu phân trang, lọc `status`, `search`, `fond_id`, `handler`, `due_from`, `due_to`, `overdue`; thêm hồ sơ (P09-06) |
| POST | /api/v1/archive-records/export | Xuất Excel hồ sơ theo bộ lọc và `columns`, ghi nhật ký xuất `archive-records` (BR-74) |
| GET, PUT, DELETE | /api/v1/archive-records/{id} | Hồ sơ kèm `files`; sửa (thay toàn bộ); xóa hồ sơ cùng tệp đính kèm |
| POST | /api/v1/archive-records/{id}/files | Tải lên một tệp đính kèm (biểu mẫu nhiều phần, trường `file`) |
| GET, DELETE | /api/v1/archive-records/{id}/files/{fileId} | Tải về, xóa tệp đính kèm |

Giao kèo văn thư lưu trữ (YCTD-118):

1. Xem (`GET`) cần một trong `P09.archive.view`, `P09.archive.manage`, `P09.archive.export`; thêm, sửa, xóa, tải lên, xóa tệp cần `P09.archive.manage`; hai điểm cuối `/export` cần `P09.archive.export`; thiếu quyền trả `ERR_FORBIDDEN` (403). Ghi và xuất cần năm học đang dùng để ghi nhật ký thao tác, nhật ký xuất, chưa có thì trả `ERR_RULE_VIOLATION` mã BR-93 (422).
2. Hồ sơ nhận `code` (1 đến 50 ký tự), `title` (1 đến 500), `handler_name` (1 đến 200), `opened_on` (YYYY-MM-DD) bắt buộc; `fond_id`, `due_date`, `sheet_count` (0 đến 100 000), `note` (đến 2000) không bắt buộc; `status` (`pending`, `completed`), `completed_on` (bắt buộc khi `completed`, không gửi khi `pending`), `retention` (`permanent`, `limited`), `retention_years` (1 đến 100 khi `limited`) theo BR-116. Phông lưu trữ nhận `code` (1 đến 50), `name` (1 đến 200), `note`. Thông tin lưu trữ nhận `fond_id`, `period_from_year`, `period_to_year`, `arranged` (đúng hoặc sai), `expired` (mặc định sai), `retention`, `retention_years`, `bundle_count`, `box_count`, `shelf_meters` (số, tối đa hai chữ số thập phân), `storage_location`, `note`. Dữ liệu sai trả `ERR_VALIDATION` (400) kèm từng trường; số, ký hiệu hoặc mã phông trùng trả `ERR_CONFLICT` (409); phông không có trả lỗi trường `fond_id`.
3. `GET /archive-records` trả `items`, `page`, `page_size` (1 đến 200), `total`, `total_pages`; mỗi hồ sơ có `fond_code`, `fond_name`, `file_count`, `overdue` (chưa hoàn thành, thời hạn trước hôm nay theo giờ Việt Nam). Chưa hoàn thành xếp theo thời hạn gần nhất trước, hoàn thành theo ngày hoàn thành mới nhất trước. `search` khớp một phần số, ký hiệu hoặc tiêu đề; ký tự `%`, `_` được hiểu đúng là ký tự.
4. Tệp đính kèm: PDF, JPEG, PNG nhận theo các byte đầu; .doc, .docx, .xls, .xlsx nhận theo các byte đầu kèm đuôi tên tệp; tối đa 10 MB; tệp khác trả `ERR_VALIDATION` trường `file`; quá 20 tệp mỗi hồ sơ trả `ERR_RULE_VIOLATION` mã YCTD-118. Tải về trả đúng kiểu nội dung, `content-disposition: attachment`; tệp không thuộc hồ sơ trả `ERR_NOT_FOUND` (404).
5. Xóa phông còn thông tin lưu trữ hoặc hồ sơ trả `ERR_RULE_VIOLATION` mã YCTD-118 (422). Xóa hồ sơ xóa luôn tệp ở kho tệp. Mọi thao tác ghi ghi nhật ký thao tác (`archive_fonds`, `archive_holdings`, `archive_records`, `archive_record_files`).
6. Xuất Excel hồ sơ: `columns` là mã cột của lưới (`code`, `title`, `fond`, `handler_name`, `opened_on`, `due_date`, `status`, `completed_on`, `retention`, `sheet_count`, `file_count`, `note`), không trùng, không gửi thì theo mặc định; tối đa 5 000 dòng, nhiều hơn trả `ERR_RULE_VIOLATION` mã YCTD-118. Báo cáo lưu trữ xuất một bảng tính có dòng tiêu đề, các dòng theo phông, giai đoạn và dòng Tổng cộng. Mỗi lần xuất ghi nhật ký xuất trước khi trả tệp, trả mã nhật ký ở `x-export-log-id`.
7. Từ YCTD-122: `GET /archive-handlers` (cần `P09.archive.manage`) trả nhân sự đang làm việc trong phạm vi quản lý: `id`, `code`, `full_name`, `org_unit_id`. Phông nhận `org_unit_id` (trống là toàn trường) và trả `org_unit_id`, `org_unit_name`; hồ sơ nhận `org_unit_id`, `handler_staff_id` (có mã thì `handler_name` không bắt buộc, máy chủ ghi tên theo hồ sơ nhân sự; nhân sự không có hoặc đã nghỉ lỗi trường `handler_staff_id`) và trả thêm `org_unit_name`, `due_soon`. `GET /archive-records`, `POST /archive-records/export` lọc thêm `org_unit_id`, `due_soon=true`; `GET /archive-report`, `POST /archive-report/export` lọc thêm `org_unit_id`; cột xuất Excel thêm `org_unit`. Mọi điểm cuối lọc theo phạm vi đơn vị (PQ-71): bản ghi ngoài phạm vi trả `ERR_NOT_FOUND`, ghi vào đơn vị ngoài phạm vi trả `ERR_FORBIDDEN`; đơn vị không có lỗi trường `org_unit_id`; phông khác đơn vị với hồ sơ lỗi trường `fond_id`.

Điểm cuối văn bản đến (DT-18 phần 18a, YCTD-138):

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/document-catalogs | Danh mục văn bản lọc `kind`; thêm mục (P09-12, YCTD-138) |
| PUT, DELETE | /api/v1/document-catalogs/{id} | Sửa, xóa mục chưa dùng (YCTD-138) |
| GET, POST | /api/v1/external-units | Đơn vị bên ngoài lọc `q`, `active=true`, kèm `group_names`; thêm (YCTD-138) |
| PUT, DELETE | /api/v1/external-units/{id} | Sửa, xóa đơn vị chưa dùng (YCTD-138) |
| GET, POST | /api/v1/external-unit-groups | Nhóm đơn vị ban hành kèm `unit_ids`, `unit_names`; thêm (YCTD-138) |
| PUT, DELETE | /api/v1/external-unit-groups/{id} | Sửa (thay toàn bộ đơn vị), xóa nhóm (YCTD-138) |
| GET, PUT | /api/v1/document-leaders | Lãnh đạo nhận văn bản; ghi cả danh sách (YCTD-138) |
| GET | /api/v1/document-staff | Nhân sự đang làm việc có tài khoản để chọn người nhận (YCTD-138) |
| GET, POST | /api/v1/document-books | Sổ văn bản lọc `direction`, `year` kèm số văn bản, số đến kế tiếp, người theo dõi, người quản trị; thêm sổ (YCTD-138) |
| PUT, DELETE | /api/v1/document-books/{id} | Sửa, xóa sổ chưa có văn bản (YCTD-138) |
| GET | /api/v1/document-books/{id}/register, /register/export | Sổ đăng ký văn bản đến theo `from`, `to`; xuất Excel, ghi nhật ký xuất (P09-11, BR-74, YCTD-138) |
| GET, POST | /api/v1/incoming-documents | Danh sách theo `view` kèm bộ lọc; vào sổ văn bản (P09-09, P09-11, YCTD-138) |
| GET | /api/v1/incoming-documents/next-number | Số đến kế tiếp của sổ `book_id` (YCTD-138) |
| POST | /api/v1/incoming-documents/interconnect | Nhập văn bản nhận qua liên thông, chờ vào sổ (bản chạy nội bộ, YCTD-138) |
| POST | /api/v1/incoming-documents/complete, /archive, /flags | Kết thúc hàng loạt; lưu hồ sơ hàng loạt; đánh dấu, theo dõi hàng loạt (YCTD-138) |
| GET, PUT, DELETE | /api/v1/incoming-documents/{id} | Chi tiết (đánh dấu đã đọc); cập nhật thông tin; xóa văn bản chưa chuyển (YCTD-138) |
| POST | /api/v1/incoming-documents/{id}/register, /acknowledge | Vào sổ văn bản liên thông; đánh dấu, hủy đánh dấu tiếp nhận (YCTD-138) |
| POST | /api/v1/incoming-documents/{id}/files | Tải tệp (`file`, `kind`, `scanned`) (YCTD-138) |
| GET, DELETE | /api/v1/incoming-documents/{id}/files/{fileId} | Tải về, xóa tệp (YCTD-138) |
| PUT | /api/v1/incoming-documents/{id}/relations | Văn bản liên quan (YCTD-138) |
| POST | /api/v1/incoming-documents/{id}/transfer, /return, /refuse, /revoke, /finish | Chuyển (trình lãnh đạo, chuyển xử lý, luân chuyển); trả lại; từ chối; lấy lại; xử lý xong (P09-10, BR-134, YCTD-138) |
| POST | /api/v1/incoming-documents/{id}/extension, /extension/decide | Xin gia hạn; đồng ý hoặc không (YCTD-138) |
| POST | /api/v1/incoming-documents/{id}/complete, /restrict, /reply, /unread | Kết thúc; hạn chế xem; văn bản trả lời; đánh dấu chưa đọc (YCTD-138) |
| GET | /api/v1/incoming-documents/{id}/slips/{type} | Phiếu trình (`submission`), phiếu xử lý (`processing`), phiếu giao nhận (`handover`) PDF (YCTD-138) |
| GET | /api/v1/incoming-documents/{id}/tasks | Việc tạo từ văn bản (P09-24, YCTD-141) |
| GET, POST, PATCH | /api/v1/task-directives, /task-directives/options, /task-directives/{id} | Giao việc theo cây đơn vị; công việc cần xử lý (`box=inbox`), đã giao (`box=outbox`); chi tiết; sửa (P09-24, YCTD-141) |
| POST | /api/v1/task-directives/{id}/cancel, /assignments, /assignments/{aid}/progress, /approve, /revoke | Hủy việc; phân công thêm hoặc tiếp; cập nhật tiến độ; phê duyệt; thu hồi (P09-24, YCTD-141) |
| POST, GET, DELETE | /api/v1/task-directives/{id}/files, /files/{fileId} | Tệp đính kèm của việc (YCTD-141) |
| GET, POST, PUT, DELETE | /api/v1/meeting-rooms, /room-bookings, /room-bookings/{id}/approve, /reject, /cancel | Phòng họp, đăng ký sử dụng (P09-25, YCTD-141) |
| GET, POST, PUT, DELETE | /api/v1/unit-schedules, /unit-schedules/publish, /unit-schedules/export, /unit-schedule-templates, /unit-schedule-templates/{id}/apply | Lịch đơn vị, công bố, xuất, mẫu lịch (P09-25, YCTD-141) |
| GET, POST, PUT, DELETE | /api/v1/work-files, /work-files/{id}, /items, /shares, /transfer, /close, /reopen, /submit, /accept, /return | Hồ sơ công việc, nộp lưu (P09-26, YCTD-141) |
| GET | /api/v1/document-reports/incoming, /summary, /statistics, /export | Báo cáo (P09-27, YCTD-141) |
| GET | /api/v1/my-work, /my-work/count | Việc của tôi và số đếm (P09-30, YCTD-142) |
| GET, PUT | /api/v1/professional-records/overview, /lock, /options, /statistics | Tổng quan, khóa năm học, danh sách chọn, thống kê (YCTD-142) |
| GET, POST, PUT, DELETE | /api/v1/professional-folders, /professional-folders/{id}, /professional-folders/defaults | Thư mục, luồng duyệt, danh mục mặc định (P09-28, YCTD-142) |
| GET, POST, PUT | /api/v1/professional-work-groups, /professional-work-groups/{id} | Nhóm công tác (YCTD-142) |
| GET, POST, PUT | /api/v1/professional-rounds, /{id}, /{id}/close, /reopen, /remind, /status | Đợt nộp, tình trạng nộp (P09-29, YCTD-142) |
| GET, POST, PUT, DELETE | /api/v1/professional-documents, /{id}, /versions, /signed-file, /submit, /withdraw, /leader-approve, /approve, /return | Hồ sơ, phiên bản, luồng duyệt (P09-28, YCTD-142) |
| GET, POST, PUT, DELETE | /api/v1/education-plan-templates, /{id}, /defaults | Thư viện mẫu kế hoạch giáo dục (P09-31, YCTD-147) |
| GET, POST, PUT, DELETE | /api/v1/education-plans, /overview, /{id}, /{id}/submit, /withdraw, /approve, /return, /diff, /export, /signed-file, /work-plan | Kế hoạch giáo dục (P09-32, YCTD-147) |
| GET, POST | /api/v1/education-plans/previous-year, /copy; GET /progress, /progress/export | Sao chép từ năm trước; tiến độ duyệt (P09-32, P09-33, YCTD-147) |
| GET, POST, PUT, DELETE | /api/v1/quality/frameworks, /{id}, /defaults; /frameworks/{id}/standards, /standards/{id}, /standards/{id}/criteria, /criteria/{id}, /criteria/{id}/indicators, /indicators/{id} | Bộ tiêu chuẩn đánh giá (P09-40, YCTD-149) |
| GET, POST, PUT, DELETE | /api/v1/quality/overview, /assessments, /assessments/{id}, /council, /groups, /start, /complete, /reopen, /recognition, /recognition/apply, /inherit-evidences, /work-plan, /report, /evidences/export; /quality/recognition | Đợt tự đánh giá, báo cáo, kế hoạch cải tiến, công nhận (P09-41, P09-44) |
| GET, PUT, POST | /api/v1/quality/reports, /reports/{id}, /submit, /approve, /return, /reopen | Phiếu đánh giá tiêu chí (P09-42) |
| GET, POST, PUT, DELETE | /api/v1/quality/evidences, /evidences/{id}, /evidences/{id}/file; /quality/evidence-sources | Minh chứng (P09-43) |
| GET, POST, PUT, DELETE | /api/v1/emulation/overview, /emulation/titles, /{id}, /defaults | Tổng quan, danh mục danh hiệu (P09-34, YCTD-148) |
| GET, POST, PUT, DELETE | /api/v1/emulation/campaigns, /{id}, /launch, /publish, /close, /launch-document, /council, /meetings, /report, /report/export; /emulation/registrations, /review, /{id} | Đợt, hội đồng, báo cáo, đăng ký (P09-35, P09-37, P09-39) |
| GET, POST, PUT, DELETE | /api/v1/emulation/nominations, /{id}, /submit, /withdraw, /accept, /return, /evidence-options, /evidence, /evidence/{id}/file, /report | Hồ sơ đề nghị (P09-36) |
| GET, PUT, POST | /api/v1/emulation/voting, /emulation/meetings/{id}, /votes, /close, /minutes; /emulation/appeals, /{id}/resolve | Bỏ phiếu, phúc khảo, khiếu nại (P09-37, P09-38) |
| GET, POST | /api/v1/boarding/classes/{id}/roster, /cuts, /close, /reopen (từ YCTD-159) | Danh sách ăn bán trú lớp ngoài Mầm non theo ngày; cắt suất (`child_id`, `date`, `cut`, `reason`), chốt (`date`), mở lại (`date`, `reason` bắt buộc); giáo viên chủ nhiệm hoặc `P04.boarding.manage`; lớp Mầm non trả 422 mã YCTD-159 |
| GET, POST, DELETE | /api/v1/boarding/children/{id}/cuts, /{date} (từ YCTD-159) | Phụ huynh xem ngày cắt suất của con trong tháng (`month`), báo (`date`, `reason`), hủy cắt suất |
| GET, PUT, POST, PATCH, DELETE | /api/v1/conduct/settings, /conduct/criteria, /defaults, /{id}, /conduct/entries, /{id}, /conduct/ranking (từ YCTD-159) | Nề nếp: cấu hình (`enabled`, `base_points`; sửa cần `P02.conduct.manage`), tiêu chí, ghi điểm (`class_id`, `criterion_id`, `date`, `quantity`, `reported_by`, `note`; cần `P02.conduct.record`), xếp hạng (`period` = `week`, `month`, `first_term`, `second_term`, `date`, `school_level`, `org_unit_id`, `grade_level`) |
| GET, POST, PUT, PATCH | /api/v1/assessment/config, /defaults, /levels, /items, /items/{id}, /periods/{id}, /periods/{id}/tests, /templates, /templates/{id} (từ YCTD-161) | Cấu hình đánh giá theo `school_level`; đọc: mọi người đã đăng nhập; sửa, nạp mặc định: `P02.assessment.manage` |
| GET, PUT, POST, DELETE | /api/v1/assessment/classes/{id}, /subjects/{subjectId}, /competencies, /comments, /summary, /year-results; /assessment/comments/{id} (từ YCTD-161) | Tổng quan lớp (kỳ, môn, quyền nhập), bảng nhập theo `period_id`, lưu (`entries`: `child_id`, `level_code`, `score`, `comment`), nhận xét thường xuyên, tổng hợp cuối kỳ, gợi ý và xác nhận cuối năm; quá hạn, đã khoá trả 422 mã YCTD-161 |
| GET, POST | /api/v1/assessment/locks, /locks/unlock; /assessment/children/{id} (từ YCTD-161) | Khoá kỳ (`period_id`, `class_ids` trống là mọi lớp của cấp trong phạm vi), mở khoá (`reason` bắt buộc); phụ huynh xem kết quả đã khoá của con |
| GET, POST, PATCH | /api/v1/learning-records/award-titles, /defaults, /{id}; /learning-records/classes/{id}/awards; /learning-records/awards/{id}/decide, /certificate (từ YCTD-163) | Danh hiệu (sửa: `P02.student-record.approve`), khen thưởng của lớp kèm gợi ý, đề nghị (`child_id`, `title_id`, `achievement`), duyệt (`approve`, `note`), giấy khen PDF; trái quy tắc trả 422 mã YCTD-163 |
| GET, PUT, POST, PATCH | /api/v1/learning-records/classes/{id}/completion, /learning-records, /learning-records/prepare; /learning-records/learning-records/{id}, /sign, /reopen, /file; /learning-records/children/{id} (từ YCTD-163) | Hoàn thành chương trình (`entries`: `child_id`, `support_plan`, `support_result`, `support_note`), học bạ của lớp, lập, nhận xét, kí nội bộ, mở lại (`reason`), tải PDF, học bạ và khen thưởng của học sinh (phụ huynh: bản đã kí) |
| GET, POST | /api/v1/question-topics | Chủ đề theo môn, khối; thêm (`P02.exam.review`) (P02-61, YCTD-168) |
| GET, POST | /api/v1/questions | Câu hỏi (lọc môn, khối, chủ đề, mức, dạng, trạng thái, tìm); soạn câu nháp (P02-61) |
| GET | /api/v1/questions/stats, /api/v1/questions/import-template | Thống kê câu dùng được theo chủ đề, mức, dạng; tệp mẫu nhập (P02-61) |
| POST | /api/v1/questions/import | Nhập câu hỏi từ Excel thành câu nháp (P02-61) |
| GET, PUT | /api/v1/questions/{id} | Xem, sửa câu hỏi (P02-61) |
| POST | /api/v1/questions/{id}/submit, /review, /retire | Gửi thẩm định; duyệt hoặc trả lại (`decision`, `note`); ngừng dùng (P02-61) |
| GET, POST, PUT | /api/v1/exam-matrices, /api/v1/exam-matrices/{id} | Ma trận kèm tổng hợp `summary`, điểm lệch `issues` (P02-62) |
| GET, POST, PUT | /api/v1/assessment-plans, /api/v1/assessment-plans/{id} | Kế hoạch kiểm tra kèm `exam_count`, `locked_count`, `timetable_note` (P02-63) |
| POST | /api/v1/assessment-plans/{id}/submit, /decide | Gửi duyệt; duyệt hoặc trả lại (P02-63) |
| GET, POST | /api/v1/exams, /api/v1/exams/staff | Đề được giao (người quản lý thấy mọi đề); giao đề; người có thể ra đề, thẩm định (P02-64) |
| GET, PATCH | /api/v1/exams/{id} | Đề kèm câu, mã đề, đáp án từng mã; sửa tên, số mã, ma trận, hạn (P02-64) |
| POST, DELETE | /api/v1/exams/{id}/generate, /questions, /questions/{questionId}, /variants | Bốc câu theo ma trận (`seed` tùy chọn); thêm, bỏ câu; trộn mã đề (P02-64) |
| POST | /api/v1/exams/{id}/submit, /review, /lock, /unlock | Gửi thẩm định; duyệt hoặc trả lại; khoá; mở khoá (`reason`) (P02-64) |
| GET | /api/v1/exams/{id}/export | Tải đề một mã (`part=paper`, `code`) hoặc đáp án (`part=answers`), `format=pdf` hoặc `docx` (P02-64) |
| GET | /api/v1/exam-grading/exams, /api/v1/exam-grading/classes | Đề đã khoá của cấp; lớp tạo được bài kiểm tra của đề (P02-69, YCTD-173) |
| GET, POST | /api/v1/exam-grading/sessions | Bài kiểm tra của lớp người dùng xem được (kèm số bài đã chấm, trung bình); tạo (P02-69) |
| GET | /api/v1/exam-grading/sessions/{id} | Bài kiểm tra kèm mã đề (số câu, dạng, điểm), học sinh và bài làm, `blockers` (P02-69) |
| PUT | /api/v1/exam-grading/sessions/{id}/sheets/{childId} | Ghi bài làm: `variant_code`, `absent`, `answers`, `essay` (P02-69) |
| GET, POST | /api/v1/exam-grading/sessions/{id}/import-template, /import | Tệp mẫu kết quả quét kèm học sinh; nhập tệp quét (P02-69) |
| GET | /api/v1/exam-grading/sessions/{id}/answer-sheet | Phiếu trả lời PDF (P02-69) |
| POST | /api/v1/exam-grading/sessions/{id}/lock, /unlock, /transfer | Khoá điểm; mở khoá (`reason`); chuyển vào sổ điểm (trả `written`) (P02-69) |
| GET | /api/v1/exam-grading/reports/{examId}, /export | Báo cáo theo câu, chủ đề, mức, lớp, phân bố điểm (`class_id` tuỳ chọn); xuất `format=xlsx` hoặc `pdf` (P02-70) |
| GET, PUT | /api/v1/online-exams/settings, /settings/{level} | Công tắc học sinh đăng nhập làm bài theo cấp (P02-85, YCTD-211) |
| GET, PUT | /api/v1/online-exams/school-settings | Cấu hình thi trực tuyến của trường: chế độ thi mặc định, thi từ xa, dải mạng, hạn mã phòng (P02-85) |
| POST | /api/v1/online-exams/assignments/{id}/rooms, /api/v1/online-exams/rooms/{id}/close | Mở phòng thi (mã 6 chữ số, danh sách học sinh); đóng phòng (P02-84) |
| GET | /api/v1/online-exams/exams, /classes | Đề đã khoá, lớp giao được (P02-82) |
| GET, POST | /api/v1/online-exams/assignments | Danh sách, giao đề (P02-82); từ YCTD-271 nhận thêm `group_ids` (nhóm của bộ nhóm đang dùng, thành viên lúc giao được giao như học sinh; nhóm của bộ đã lưu trữ 404, nhóm trống 400) |
| GET, PATCH | /api/v1/online-exams/assignments/{id} | Chi tiết, theo dõi; sửa tên, giờ, chế độ kết quả (P02-84) |
| POST | /api/v1/online-exams/assignments/{id}/cancel, /release-results | Huỷ; công bố kết quả (P02-84) |
| GET, PUT, POST | /api/v1/online-exams/attempts/{id}, /essay-marks, /force-submit | Xem bài; điểm tự luận; nộp thay (P02-84) |
| GET | /api/v1/tutoring/meta, /tutoring/rules; POST /tutoring/rules | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Danh mục cho biểu mẫu, quy định dạy thêm đang áp dụng và lịch sử; thêm quy định có ngày hiệu lực (P02.tutoring.manage) (YCTD-252) |
| GET, POST | /api/v1/tutoring/programs; GET, PUT /tutoring/programs/{id} | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Chương trình gia sư; vi phạm Thông tư 29 trả 422 `ERR_RULE_VIOLATION` mã YCTD-252, chi tiết mã từng dòng (`curriculum_fee`, `curriculum_audience`, `curriculum_subject`, `curriculum_level`) |
| POST | /api/v1/tutoring/programs/{id}/submit, /approve, /reject, /close | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Nộp (người dạy), duyệt, không duyệt (cần `reason`), đóng (Ban Giám hiệu) |
| GET, PUT | /api/v1/tutoring/programs/{id}/candidate-suggestions, /candidates | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Gợi ý học sinh chưa đạt môn từ sổ điểm; xác nhận danh sách học sinh được đăng ký |
| POST | /api/v1/tutoring/programs/{id}/sessions | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Xếp buổi lẻ (`session_date`) hoặc lặp theo tuần (`weekly`: from, to, weekdays 1 đến 7), `start_time`, `end_time`; trùng thời khoá biểu (`timetable_teacher`, `timetable_class`) hoặc quá giới hạn tiết (`weekly_periods`) trả 422 |
| GET | /api/v1/tutoring/programs/{id}/registrations; POST /tutoring/registrations/{id}/approve, /reject | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Đơn đăng ký; duyệt kiểm sĩ số và giới hạn tiết |
| POST | /api/v1/tutoring/programs/{id}/messages | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Nhắn cha mẹ của học sinh đã đăng ký qua luồng trao đổi |
| GET | /api/v1/tutoring/sessions?from&to; POST /tutoring/sessions/{id}/cancel | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Buổi của chương trình mình dạy (Ban Giám hiệu: mọi buổi); hủy buổi báo cha mẹ |
| GET, PUT | /api/v1/tutoring/sessions/{id}/attendance; POST .../room-events | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Điểm danh và xác nhận (vắng báo cha mẹ một lần); sự kiện vào, ra phòng giả lập đến khi 27a gộp |
| GET, POST | /api/v1/tutoring/exemptions; GET .../{id}/file | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Quyết định tăng thời lượng của Sở (biểu mẫu nhiều phần, tệp tùy chọn) |
| GET | /api/v1/children/{id}/tutoring; POST .../registrations; POST .../registrations/{rid}/withdraw | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Cha mẹ: chương trình mở cho con, đơn đã gửi, lịch học và điểm danh đã xác nhận; gửi đơn (`agree` bắt buộc), rút đơn |
| GET | /api/v1/tutoring/finance/report?from&to; GET .../report/export | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Thu chi gia sư theo chương trình và khoảng tháng (tối đa 24 tháng): đã thu, trừ kỳ sau, điều chỉnh giảm, đã hoàn, thu thuần, thù lao đã đẩy và chưa đẩy, tổng thù lao theo nguồn chi; tệp Excel ghi nhật ký xuất (YCTD-253) |
| GET, POST | /api/v1/tutoring/finance/teacher-pay?month; POST .../teacher-pay/push `{ month }` | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Thù lao buổi đã dạy chưa đẩy đến hết tháng (lý do chưa đẩy được); đẩy vào bảng lương tháng, cần `P08.bonus-deduction.manage`; bảng lương đã gửi duyệt hoặc đã duyệt trả 422 `payroll_locked` (YCTD-253) |
| GET, POST | /api/v1/tutoring/finance/credits; POST .../credits/{id}/adjust, /deduct-next, /close `{ note }` | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Khoản trừ buổi hủy đã thu; lập điều chỉnh giảm hóa đơn qua luồng điều chỉnh hiện có (cần `P05.invoice-adjustment.create`), chuyển sang trừ kỳ sau, đóng sau khi hoàn (YCTD-253) |
| GET, PUT | /api/v1/video/status, /settings, /usage | Lớp video: máy chủ có bật video không; cấu hình của trường (người dự tối đa, giữ bản ghi, phòng chờ; sửa cần `P02.learning.decide` từ YCTD-393, trước đó `P02.tutoring.manage`); phút đã dùng và dung lượng bản ghi theo gói (YCTD-251) |
| POST | /api/v1/video/sessions/{id}/room; POST /video/rooms `{ title }`; POST /video/rooms/{id}/join | **Đã bỏ một phần (YCTD-393):** `/video/sessions/{id}/room` của buổi gia sư đã bỏ; phòng tức thời giữ lại. Mở phòng của buổi (giáo viên dạy, Ban Giám hiệu) hoặc phòng tức thời; vào phòng trả `{ status: ready, url, token }` hoặc `{ status: waiting }`; vượt phút của gói trả PLAN_LIMIT_EXCEEDED (YCTD-251) |
| GET, PATCH, POST | /api/v1/video/rooms/{id}; PATCH .../participants/{identity} `{ admit, can_speak, can_share, remove }`; POST .../end, .../recording/start, .../recording/stop | **Đã bỏ một phần (YCTD-393):** `/recording/start`, `/recording/stop` đã bỏ. Chủ phòng: người chờ, người dự, cho vào, cho nói, cho chia sẻ, mời ra, kết thúc, ghi hình (cần chương trình bật và đồng ý của cha mẹ, 422 kèm tên học sinh thiếu đồng ý) (YCTD-251) |
| GET, POST | /api/v1/video/sessions/{id}/recordings; POST /video/recordings/{id}/view-link, /hold; GET /video/recordings/{id}/stream?token | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Bản ghi của buổi; đường dẫn xem ký 5 phút (mỗi lần lấy ghi nhật ký xem), phát trực tiếp không lưu đệm; giữ bản ghi vì tranh chấp (YCTD-251) |
| GET, POST, PUT | /api/v1/children/{id}/video/rooms, /rooms/{roomId}/join, /sessions/{sid}/recordings, /recordings/{rid}/view-link, /consents, PUT /consents/{programId} `{ agree }` | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Cha mẹ: lớp đang mở của buổi của con, vào xem, bản ghi, đồng ý hoặc rút đồng ý ghi hình (YCTD-251) |
| GET, POST | /api/v1/student/video/rooms, /rooms/{id}/join | **Đã bỏ (YCTD-393):** gia sư trong trường đã bỏ. Học sinh (kênh student, `P02.learning.study`): lớp đang mở của buổi đã đăng ký, vào lớp (YCTD-251) |
| POST | /api/v1/video/webhook | Sự kiện của máy chủ video (vào ra, ghi xong, phòng đóng): đường dẫn không cần trường, trường lấy từ tên phòng, chữ ký sai 401, video tắt 404 (YCTD-251) |
| GET | /api/v1/student/profile, /exams | Học sinh: thông tin, bài được giao (P02-83) |
| POST | /api/v1/student/exams/{id}/start | Mở hoặc tiếp tục lượt (`camera_state`) (P02-83) |
| GET, PUT | /api/v1/student/attempts/{id}, /answers | Đọc lượt; lưu nháp từng câu (P02-83) |
| POST | /api/v1/student/attempts/{id}/events, /submit | Báo sự kiện; nộp (P02-83) |
| GET | /api/v1/student/attempts/{id}/result | Kết quả theo chế độ (P02-83) |
| GET, POST, DELETE | /api/v1/online-exams/attempts/{id}/proctor/views, /proctor/views/{viewId}/signals, /proctor/views/{viewId} | Giáo viên mở phiên xem trực tiếp, hỏi và gửi thông điệp báo hiệu, kết thúc (P02-97, YCTD-215) |
| GET | /api/v1/online-exams/proctor/ice, /api/v1/student/proctor/ice | Máy chủ ICE (STUN, TURN có hạn) cho trình duyệt (P02-97) |
| GET | /api/v1/online-exams/attempts/{id}/proctor, /recording | Thông tin giám sát của lượt, nhật ký người xem; phát bản ghi (P02-98) |
| GET, POST | /api/v1/student/attempts/{id}/proctor, /proctor/signals | Học sinh hỏi phiên xem và gửi trả lời (P02-97) |
| POST | /api/v1/student/attempts/{id}/recording/chunks | Học sinh tải một đoạn bản ghi (P02-98) |
| GET | /api/v1/online-exams/assignments/{id}/proctor/consents | Tình trạng đồng ý của học sinh trong bài giao (P02-96) |
| PUT | /api/v1/online-exams/proctor/consents | Người quản lý ghi nhận hoặc thu hồi văn bản đồng ý (P02-96) |
| GET, PUT | /api/v1/parent/exam-proctor-consents | Phụ huynh xem, đồng ý, thu hồi cho con mình (P02-96) |
| POST | /api/v1/users/student-accounts/sync | Dịch vụ định danh: tạo, cấp lại người dùng kênh `student` (máy chủ API gọi) (P02-83) |
| GET | /api/v1/public/student-awards/verify (từ YCTD-163) | Tra cứu công khai mã giấy khen học sinh (`code` 12 kí tự), giới hạn tần suất |
| GET | /api/v1/primary-reports/enrollment, /assessments, /year-end, /attendance, /{report}/export (từ YCTD-165) | Thống kê Tiểu học (`org_unit_id`; `period_id`, `group` = `class`, `grade`, `school`; `from`, `to`); xuất `format` = `xlsx`, `pdf`; cần `P17.child-statistics.view` |
| GET, PUT | /api/v1/primary-reports/emis, /{code}, /{code}/values, /{code}/rows, /{code}/export (từ YCTD-165) | Biểu EMIS Tiểu học cấu hình được: danh sách, biểu đã tính, lưu số nhập tay (`rows`: `code`, `values`), thay khung (`rows`: `code`, `label`, `unit`, `kind`, `formula`; cần `P17.report-form.manage`), xuất; biểu đã gửi trả 422 mã YCTD-165. Từ YCTD-385 lát L1: danh sách bỏ biểu `archived` (thêm `?archived=true` để có cả), trả thêm `source` (`custom`, `tt25`, `eqms`), `form_number`, `archived`; biểu đã tính trả thêm `source`, `form_number`, `ownership` (`public`, `private`), `ownership_label`, `sections` (`code`, `name`, `columns` theo loại hình của trường, `ownership_groups`) và `section` ở mỗi dòng; dòng cộng (`rows:156+158`) tính sau cùng; số nhập tay lưu theo phần của dòng, cột phải thuộc phần; thay khung biểu có `source` khác `custom` trả 422 mã YCTD-165; xuất Excel biểu nhiều phần mỗi phần một trang, đủ ba nhóm cột Tổng số, Công lập, Tư thục (nhóm không thuộc loại hình của trường để trống) |
| GET | /api/v1/secondary-reports/enrollment, /results, /scores, /teachers, /{report}/export (từ YCTD-175) | Thống kê THCS, THPT (`school_level` = `THCS`, `THPT` bắt buộc; `org_unit_id`; `group` = `class`, `grade`, `school`; `term` = `first_term`, `second_term`, `year`; `subject_id`); xuất `format` = `xlsx`, `pdf`; cần `P17.child-statistics.view` |
| GET, PUT | /api/v1/secondary-reports/emis, /{code}, /{code}/values, /{code}/rows, /{code}/export (từ YCTD-175) | Biểu EMIS THCS, THPT, cùng giao kèo với `/primary-reports/emis`; mỗi đường chỉ biểu của cấp mình (biểu cấp khác 404); công thức kiểm theo bộ điều kiện của cấp của biểu. Từ YCTD-385 lát L2: biểu `tt25-03-dn-thcs`, `tt25-03-cn-thcs`; điều kiện THCS, THPT thêm tuổi, mới tuyển, lưu ban năm trước, dạng khuyết tật, `two_sessions`, học lại hè, chuyển đến từ tỉnh khác, `graduation_eligible`; lớp `two_sessions`, `multigrade`, `multi_level`; trường `type_thcs`, `type_th_thcs`, `type_thpt`, `type_thcs_thpt`, `type_th_thcs_thpt`; đội ngũ `job=equipment_lab`. Từ lát L3: biểu `tt25-04-dn-thpt`, `tt25-04-cn-thpt`; biểu khung THPT cũ `archived` |
| GET, POST, PUT, DELETE | /api/v1/emulation/decisions, /{id}, /document, /outgoing, /issue, /upper-result; /emulation/awards/{id}/certificate; /emulation/history, /export, /{id}; GET /public/emulation-awards/verify | Quyết định, giấy khen, sổ theo dõi, tra cứu công khai (P09-38, P09-39) |
| GET, PUT, POST, PATCH | /api/v1/training/catalog, /training/settings, /training/topics, /training/topics/{id}, /training/competency-domains, /training/competency-domains/{id} | Danh mục bồi dưỡng; sửa cần `P09.training.manage` (P09-49, YCTD-182) |
| GET, POST, PATCH | /api/v1/training/courses, /training/courses/{id} | Khoá bồi dưỡng kèm số đăng ký, đăng ký của tôi; chi tiết kèm đăng ký theo quyền; tạo, sửa, đổi trạng thái (P09-45) |
| POST | /api/v1/training/courses/{id}/registrations, /training/registrations/{id}/cancel, /training/registrations/{id}/review | Đăng ký, huỷ, duyệt (P09-45) |
| PUT, POST, GET | /api/v1/training/courses/{id}/results, /certificates, /certificates.pdf | Ghi kết quả; cấp chứng nhận; tải mọi chứng nhận của khoá (P09-46) |
| POST, DELETE, GET | /api/v1/training/certificates, /training/certificates/{id}, /revoke, /reissue, /pdf | Chứng chỉ nhập tay; xoá; thu hồi, cấp lại, tải chứng nhận (P09-46, P09-47) |
| GET | /api/v1/training/mine, /training/records | Hồ sơ bồi dưỡng của tôi; theo tổ, trường (P09-47) |
| GET, PUT, POST | /api/v1/training/competency/mine, /training/competency, /training/competency/{id}/confirm | Tự đánh giá năng lực số; bản đồ năng lực; xác nhận (P09-48) |
| GET | /api/v1/public/training-certificates/verify | Tra cứu chứng nhận bồi dưỡng theo `code` 12 ký tự, không cần đăng nhập (P09-46) |
| GET, POST, PATCH | /api/v1/learning-resources/catalog, /types, /types/{id}, /licenses, /licenses/{id}, /topics, /topics/{id} | Danh mục kho học liệu; sửa loại, giấy phép, chủ đề cần `P09.learning-resource.manage` (giáo viên thêm được chủ đề) (P09-55, YCTD-183) |
| GET, POST, PUT | /api/v1/learning-resources, /learning-resources/{id} | Tìm (`q`, `type_id`, `school_level`, `grade_level_code`, `subject_code`, `topic_id`, `license_id`, `scope` = `all`, `mine`, `review`); tạo; xem; sửa metadata (P09-50, P09-52) |
| POST | /api/v1/learning-resources/{id}/files, /links, /lesson-plans | Thêm phiên bản: tệp (`file`), liên kết (`url`, `link_title`), kế hoạch bài dạy (`lesson_plan_id`) (P09-50) |
| POST | /api/v1/learning-resources/{id}/submit, /review, /hide, /restore, /retire | Gửi duyệt; duyệt, trả lại; ẩn tạm, mở lại, ngừng dùng (P09-51) |
| GET | /api/v1/learning-resources/{id}/download | Tải phiên bản (`version` tùy chọn): tệp; liên kết hoặc kế hoạch bài dạy trả JSON (P09-52) |
| GET, POST, PATCH, PUT, DELETE | /api/v1/learning-resources/collections, /collections/{id}, /collections/{id}/items, /collections/{id}/export | Bộ sưu tập (P09-53) |
| GET, POST | /api/v1/learning-resources/{id}/reports, /learning-resources/reports, /learning-resources/reports/{id}/handle | Báo lỗi; danh sách; xử lý (P09-54) |
| GET | /api/v1/learning-resources/statistics | Thống kê kho (P09-55) |
| GET | /api/v1/resource-sharing/bank | Câu hỏi, đề, ma trận của ngân hàng 22g1 người dùng thấy (`kind`, `q`, `subject_id`, `grade_level_code`, `cognitive_level`), kèm lịch sử dùng, đường dẫn (P09-56, YCTD-184) |
| GET | /api/v1/resource-sharing/statistics | Thống kê sử dụng câu hỏi, học liệu, chỗ trống chủ đề (P09-56) |
| GET, PUT | /api/v1/resource-sharing/collections/{id}/items | Câu hỏi, đề, ma trận trong bộ sưu tập; thay danh sách (`items`: `kind`, `id`) (P09-56) |
| GET, POST, PUT | /api/v1/resource-sharing/rubrics, /rubrics/{id} | Rubric (P09-57) |
| POST, GET | /api/v1/resource-sharing/rubrics/{id}/clone, /archive, /restore, /print | Nhân bản, lưu trữ, dùng lại, in PDF (P09-57) |
| GET | /api/v1/resource-sharing/packages/preview, /export, /imports | Xem trước, xuất gói (`collection_id`, `source_school`), lịch sử nhập (P09-58) |
| POST | /api/v1/resource-sharing/packages/import | Nhập gói (tệp `file`), trả `imported_count`, `skipped`, `resource_ids` (P09-58) |
| GET, PUT, POST, DELETE | /api/v1/website/settings, /website/settings/images/{purpose}, /website/sample-content, /website/disclosure-categories | Thông tin website, biểu trưng, ảnh đầu trang, nội dung mẫu, nhóm công khai (P14-13, YCTD-144) |
| GET, POST, PATCH, DELETE | /api/v1/website/domains, /website/domains/{id}, /website/domains/{id}/dns-confirmation | Tên miền (P14-13, YCTD-144) |
| GET, POST, PUT, DELETE | /api/v1/website/posts, /website/posts/{id}, /submit, /approve, /return, /unpublish, /files, /files/{fileId} | Bài viết, luồng duyệt, tệp (P14-14, YCTD-144) |
| GET, POST, PUT, DELETE | /api/v1/website/albums, /website/albums/{id}, /submit, /approve, /return, /unpublish, /files, /files/{fileId}, /cover/{fileId} | Thư viện ảnh (P14-15, YCTD-144) |
| GET, POST | /api/v1/website/review, /website/files/{fileId}, /website/contacts, /website/contacts/{id}/handle | Nội dung chờ duyệt, xem tệp, thư liên hệ (YCTD-144) |
| GET, POST | /api/v1/public/site, /public/site/{trang}, /public/website/domain-check | Trang công khai theo tên miền (không cần đăng nhập; trang gioi-thieu, co-cau-to-chuc, tin-tuc, thong-bao, van-ban, tuyen-sinh, cong-khai, thoi-khoa-bieu, thu-vien-anh, lien-he, tep, robots.txt, sitemap.xml), kiểm tra tên miền cho máy chủ web (P14-16, YCTD-144) |
| POST | /api/v1/auth/impersonation, /auth/impersonation/exit | Bắt đầu, thoát đăng nhập thay (dịch vụ định danh, P01-32, YCTD-145) |
| GET | /api/v1/auth/impersonations, /api/v1/impersonation-actions | Nhật ký đăng nhập thay (định danh), thao tác trong từng lần (máy chủ API) (P01-32, YCTD-145) |
| POST | /api/v1/auth/platform/login | Đăng nhập vận hành nền tảng (YCTD-191, PQ-105): chỉ ở tên miền cổng nền tảng (PLATFORM_CONSOLE_HOST), tên miền khác 404; đúng thì trả mã phiên vận hành (đối tượng riêng, hạn 8 giờ); sai 5 lần khóa 15 phút; không cần trường |
| GET | /api/v1/auth/platform/me | Thông tin tài khoản vận hành đang đăng nhập kèm số trường (YCTD-191); mã phiên của trường không dùng được ở đây |
| GET | /api/v1/auth/platform/plan-modules | Danh sách phân hệ chọn được cho gói (YCTD-194); mã phiên vận hành |
| GET, POST | /api/v1/auth/platform/plans | Danh sách, tạo gói (YCTD-194): mã, tên, phân hệ, giới hạn, số ngày dùng thử, cách tính phí, đơn giá, mức tối thiểu, giá theo phân hệ, kỳ thu |
| PUT | /api/v1/auth/platform/plans/{id} | Sửa gói (YCTD-194) |
| GET | /api/v1/auth/platform/plan-schools | Danh sách trường kèm trạng thái, gói hiện hành, hạn (YCTD-194) |
| PUT | /api/v1/auth/platform/plan-schools/{id} | Gán gói (ngày hiệu lực), đặt hạn dùng thử, hạn đã trả phí, trạng thái trường (YCTD-194); ghi nhật ký nền tảng |
| POST | /api/v1/auth/platform/plan-lifecycle | Chạy chuyển trạng thái theo hạn, trả danh sách trường đổi và trường cần nhắc (YCTD-194, BR-216) |
| GET | /api/v1/school-plan | Gói của trường đang dùng: `restricted`, trạng thái, gói, phân hệ, giới hạn, số đang dùng (học sinh, dung lượng, cấp học), hạn, số ngày còn lại, `read_only` (YCTD-194); mọi người dùng đã đăng nhập |
| GET | /api/v1/billing/invoices | Hóa đơn dịch vụ của trường, số còn nợ, cổng thanh toán đang dùng (YCTD-196, P01.billing.manage) |
| GET | /api/v1/billing/invoices/{id} | Chi tiết: dòng, VAT, tiền đã nhận, hóa đơn điện tử, yêu cầu thanh toán gần nhất |
| GET | /api/v1/billing/invoices/{id}/document | Bản in HTML của hóa đơn (tải về) |
| POST | /api/v1/billing/invoices/{id}/pay | Tạo mã QR hoặc liên kết thanh toán qua cổng của nền tảng cho số còn nợ |
| POST | /api/v1/billing/invoices/{id}/simulate-payment | Giả lập tiền vào đủ số còn nợ (chỉ khi dùng cổng giả lập) |
| POST | /api/v1/platform-billing/webhooks/{provider} | Thông báo tiền vào của cổng thanh toán của nền tảng (PayOS, SePay, Casso); không cần trường |
| GET | /api/v1/auth/platform/billing | Tổng quan thu phí: cấu hình, khóa cổng (gợi ý), công nợ theo trường, giao dịch chưa khớp |
| PUT | /api/v1/auth/platform/billing/settings, /billing/connectors/{connector} | Cấu hình thu phí; khóa cổng của nền tảng (để trống giá trị bí mật là giữ nguyên) |
| GET, POST | /api/v1/auth/platform/billing/price-rules; PUT .../price-rules/{id} | Quy tắc tính phí |
| GET, POST | /api/v1/auth/platform/billing/invoices | Danh sách hóa đơn (lọc `status`: issued, paid, void, overdue; `school_id`); lập hóa đơn tay cho kỳ đang chạy |
| GET | /api/v1/auth/platform/billing/invoices/{id} | Chi tiết hóa đơn |
| POST | /api/v1/auth/platform/billing/invoices/{id}/{discount\|manual-payment\|void\|einvoice\|einvoice-cancel} | Điều chỉnh tay có lý do, hóa đơn điện tử |
| POST | /api/v1/auth/platform/billing/payments/{id}/assign, /billing/schools/{id}/free-period | Gán giao dịch chưa khớp; tặng kỳ |
| GET | /api/v1/auth/platform/dashboard | Bảng điều khiển nền tảng (YCTD-197, BR-225): tổng hợp và danh sách trường kèm trạng thái, gói, số liệu mới nhất, lỗi 1 giờ và 24 giờ, việc định kỳ lỗi, phiên hỗ trợ đang mở, cảnh báo; mã phiên vận hành |
| GET | /api/v1/auth/platform/dashboard/errors?school=<mã>&hours=<1 đến 720> | Lỗi gom theo giờ (YCTD-197); `school=-` là lỗi không thuộc trường nào |
| GET, POST | /api/v1/auth/platform/maintenance-notices | Danh sách, tạo thông báo bảo trì (YCTD-197, BR-226); dữ liệu sai 400; ghi nhật ký nền tảng |
| POST | /api/v1/auth/platform/maintenance-notices/{id}/cancel | Hủy thông báo bảo trì (YCTD-197) |
| GET | /api/v1/auth/platform/service-status | Tình trạng dịch vụ cho trang Bảo trì (YCTD-376): năm mục identity, api, worker, storage, queue, mỗi mục `state` (ok, slow, error, unknown), `milliseconds`, `detail`, `observed_at`; ngưỡng Chậm 1 giây; quyền `maintenance.view`; không có mã phiên 401 |
| GET | /api/v1/auth/platform/schools/{mã}/support | Cho phép hỗ trợ của trường (đọc từ cơ sở dữ liệu hệ thống của trường) và 20 phiên hỗ trợ gần nhất (YCTD-197) |
| POST | /api/v1/auth/platform/schools/{mã}/support-sessions | Mở phiên hỗ trợ `{ reason }` (YCTD-197, BR-227): trường không phục vụ hoặc chưa cho phép 422; trả `session_id`, `scope`, `expires_at`, `handoff` (`path` `/support-login?code=…`, `host`, `expires_in_seconds` 300) |
| POST | /api/v1/auth/platform/support-sessions/{id}/end | Kết thúc phiên hỗ trợ, thu hồi phiên đăng nhập ở trường, ghi nhật ký hai phía (YCTD-197) |
| POST | /api/v1/auth/support/exchange | Đổi mã một lần `{ code }` lấy phiên đăng nhập kênh cổng của tài khoản hỗ trợ (YCTD-197): công khai theo tên miền của trường; mã sai, đã dùng, hết hạn, của trường khác hoặc trường đã rút cho phép 401; trả mã phiên kèm `support_scope`, đặt cookie mã làm mới |
| GET | /api/v1/platform-notices | Thông báo bảo trì đang hiệu lực hoặc bắt đầu trong 72 giờ của trường và phiên hỗ trợ đang mở (chỉ trả cho quản trị tài khoản và chính phiên hỗ trợ) (YCTD-197); mọi người dùng đã đăng nhập |
| GET, POST | /api/v1/support-access | Cho phép hỗ trợ của trường (YCTD-197, BR-227, P01.account.manage): đọc cho phép đang hiệu lực, lịch sử, phiên hỗ trợ kèm thao tác; bật `{ scope, hours, reason }` (thời hạn 1 đến 168 giờ, sai 400; phiên hỗ trợ không tự bật được) |
| POST | /api/v1/support-access/{id}/revoke | Rút cho phép (YCTD-197): kết thúc phiên hỗ trợ theo cho phép đó và thu hồi phiên đăng nhập của tài khoản hỗ trợ ngay, trả `ended_sessions` |
| GET, POST | /api/v1/auth/platform/admin-units | Cây đơn vị cấp trên kèm trường, tài khoản (GET); thêm đơn vị `{ level, code, name, parent_id }`, sai cấp 400, trùng mã 409 (YCTD-202, BR-228); chỉ ở tên miền cổng nền tảng |
| POST | /api/v1/auth/platform/admin-units/import | Nạp danh sách `{ units: [{ level, code, name, parent_code }] }` hoặc `{ preset: "default" }`; trả `{ created, skipped }` |
| PUT | /api/v1/auth/platform/admin-units/{id} | Đổi tên, trạng thái (`active`, `inactive`) |
| POST | /api/v1/auth/platform/admin-units/{id}/merge, /split | Gộp vào `{ into_id }` cùng cấp; tách `{ code, name, school_ids, child_ids }` |
| PUT | /api/v1/auth/platform/schools/{mã}/admin-unit | Gắn trường vào nút `{ admin_unit_id }` (trống là bỏ gắn) |
| POST | /api/v1/auth/platform/parent-org-users, /parent-org-users/{id}/totp, /parent-org-users/{id}/status | Tạo tài khoản cấp trên (trả khóa TOTP, mã khôi phục một lần), cấp lại xác thực hai lớp, khóa hoặc mở khóa |
| POST | /api/v1/auth/parent-org/login | Đăng nhập cấp trên `{ login, password, otp_code }` ở tên miền cổng nền tảng (tên miền khác 404); trả `access_token` (đối tượng `school-management-parent-org`, 8 giờ) và phạm vi |
| GET | /api/v1/auth/parent-org/me | Tài khoản, đơn vị, cấp, các nút và trường trong cây con, nhóm số liệu |
| GET, POST | /api/v1/auth/parent-org/access-requests | Đề nghị xem chi tiết của mình; gửi `{ school_code, categories, reason, hours }` (trường ngoài phạm vi 403) |
| POST | /api/v1/auth/parent-org/access-requests/{id}/open | Mở phiên xem chi tiết chỉ đọc khi trường đã duyệt (chưa duyệt, đã rút 422); trả đường liên kết một lần như phiên hỗ trợ |
| GET, PUT | /api/v1/parent-org-consents | Phía trường (P01.setting.manage): chuỗi đơn vị quản lý, đồng ý đang hiệu lực, lịch sử, đề nghị; PUT `{ items: [{ level, category, granted }] }` bật, tắt |
| POST | /api/v1/parent-org-consents/requests/{id}/{approve|reject|revoke} | Duyệt, từ chối, rút đề nghị xem chi tiết; rút kết thúc phiên đang mở |
| GET | /api/v1/parent-org/aggregate?unit=<id>&category=<nhóm> | Số liệu tổng hợp cho tài khoản cấp trên (đường dẫn không cần trường, chỉ tên miền cổng nền tảng): tổng của nút (trống khi ít trường hơn ngưỡng), nút con, so sánh trường đã đồng ý, ô ẩn; nút ngoài phạm vi 403, nhóm sai 400 |
| GET | /api/v1/parent-org/aggregate/export?unit=&category=&format=xlsx|pdf | Xuất Excel, PDF (trang So sánh trường, Tổng hợp) |
Giao kèo trợ lý AI (DT-23 phần 23d, YCTD-214, BR-234 đến BR-236):

1. Lỗi: tắt hoặc thiếu khóa hoặc gói chưa có đơn giá 422 (quy tắc YCTD-214, thông báo nêu lý do); có dữ liệu cá nhân trong mô tả 422 (không nhắc lại nội dung); vượt hạn mức 422 `PLAN_LIMIT_EXCEEDED`; nhà cung cấp lỗi 422 (không lộ khóa); kết quả không đúng định dạng 422.
2. Biến môi trường máy chủ API: `AI_MOCK=true` bật bộ giả lập `mock` (chỉ kiểm thử; máy chủ không khởi động khi `NODE_ENV=production`).

| GET | /api/v1/ai/status | Trạng thái cho nút Soạn nháp bằng AI `{ enabled, ready, reason }`; với P01.integration.manage thêm thiết lập, nhà cung cấp, khóa (gợi ý), cấu hình nền tảng, mức dùng tháng, hạn mức, tạm tính phí kỳ; quyền: soạn câu hỏi, kho học liệu hoặc quản lý kết nối |
| PUT | /api/v1/ai/settings | `{ enabled, key_mode, provider, model, per_user_daily_requests, log_retention_months }` (P01.integration.manage); `platform` ở một trường 422; nhà cung cấp lạ 400 |
| POST | /api/v1/ai/check | Kiểm tra kết nối bằng khóa của cấu hình đang chọn (P01.integration.manage); ghi nhật ký loại `check` |
| GET | /api/v1/ai/requests, /api/v1/ai/requests/{id} | Nhật ký yêu cầu (`limit` đến 500, `status`); không có toàn văn lời nhắc |
| POST | /api/v1/ai/question-drafts | Soạn câu hỏi nháp `{ school_level, subject_id, grade_level_code, topic_id, cognitive_level, question_type, count (1 đến 10), requirement, extra }` (P02.question.author); trả 201 `{ request_id, questions, skipped, tokens, notice }` |
| POST | /api/v1/ai/lesson-plan-drafts | Soạn kế hoạch bài dạy nháp `{ school_level, subject_code, grade_level_code, topic_text, duration_minutes (10 đến 240), requirement, extra }` (P09.learning-resource.use); trả 201 `{ request_id, resource, tokens, notice }` |
| PUT, DELETE | /api/v1/school-settings/integrations/ai | Nhập, xóa khóa AI của trường (kết nối `ai` của S3: `api_key`, `endpoint`); không trả lại giá trị |
| GET | /api/v1/auth/platform/ai | Cổng nền tảng: thiết lập, gợi ý khóa chung, đơn giá AI từng gói |
| PUT | /api/v1/auth/platform/ai/settings, /ai/key, /ai/pricing/{planId} | Lưu nhà cung cấp và mô hình; khóa chung `{ enabled, api_key }` (trống là giữ khóa cũ); đơn giá AI của gói `{ free_tokens, input_price_per_1k, output_price_per_1k, model_prices, minimum_fee, rounding_step }` |
| GET | /api/v1/auth/platform/ai/usage?from=&to= | Token đã dùng theo trường, cấu hình, mô hình trong khoảng ngày (mặc định tháng hiện tại) |
| POST, PUT | /api/v1/auth/platform/plans | Thêm `ai_max_requests`, `ai_max_tokens` (trống là không giới hạn, 0 là không dùng AI) |
| GET | /api/v1/auth/directory/context | Chế độ trang đăng nhập (YCTD-220): `{ mode: "single" }` chế độ một trường; `{ mode: "directory", page }` ở tên miền chung `PLATFORM_ROOT_DOMAIN`; `{ mode: "school", unit }` ở tên miền của trường (tên, mã Bộ, sở, xã, cấp); tên miền lạ 404 |
| GET | /api/v1/auth/directory/departments, /levels | Danh sách sở, cấp học của danh mục; chỉ ở tên miền chung (khác 404); 120 yêu cầu mỗi phút mỗi địa chỉ |
| GET | /api/v1/auth/directory/communes?department=&q=&limit=&offset= | Phường, xã của sở, tìm không dấu, tối đa 50 dòng, `{ items, has_more }`; thiếu sở 400 |
| GET | /api/v1/auth/directory/units?department=&level=&commune=&q=&limit=&offset= | Trường của sở theo cấp, xã, chữ (tên hoặc đầu mã), tối đa 50 dòng; chỉ trả `moet_code`, `name`, `commune_name`, `levels` |
| GET | /api/v1/auth/directory/unit?code= | Một đơn vị khi người dùng chọn: `available` (đã khởi tạo trên nền tảng và đang phục vụ), `login_host`, `message`; mã lạ 404 |
| POST | /api/v1/auth/directory/captcha | `{ unit }`: ảnh mã xác nhận của trường đã chọn; đơn vị chưa dùng nền tảng 422 |
| POST | /api/v1/auth/directory/login | `{ unit, login, password, captcha_id, captcha_text, otp_code }`: đăng nhập trong ngữ cảnh của trường (mã xác nhận luôn bắt buộc, sai như `/auth/login`), 20 lần mỗi phút mỗi địa chỉ; đúng thì trả `{ handoff: { host, path: "/sign-in-handoff#code=...", expires_in_seconds: 120 } }`, không đặt cookie |
| POST | /api/v1/auth/handoff/exchange | `{ code }` ở tên miền của trường: đổi mã chuyển phiên một lần lấy mã phiên và cookie làm mới kênh cổng; sai trường, đã dùng, hết hạn 401 |
| GET | /api/v1/auth/platform/catalog | Số liệu danh mục (sở, xã, đơn vị, theo cấp, theo cờ, số trường đã gắn), 10 lần nhập gần nhất, danh sách sở, nhãn cờ (YCTD-220) |
| GET | /api/v1/auth/platform/catalog/units?department=&level=&commune=&q=&flag=&include_inactive=&offset= | Tra cứu đơn vị kèm cờ chất lượng, trạng thái, mã trường đã gắn |
| GET | /api/v1/auth/platform/catalog/unit?code= | Chi tiết một đơn vị kèm trường đã gắn |
| POST | /api/v1/auth/platform/catalog/import?kind=units (hoặc communes)&file_name=&dry_run=&deactivate_missing= | Nội dung `text/csv` (UTF-8, tối đa 20 MB): nhập hoặc cập nhật danh mục; trả báo cáo `{ run_id, dry_run, totals, flags, skipped }`; thiếu cột 400 |
| PUT | /api/v1/auth/platform/schools/{mã}/catalog-unit | Gắn trường với mã Bộ `{ moet_code }` (trống là gỡ); mã không có trong danh mục hoặc đã gắn trường khác 400 |
| GET, PUT | /api/v1/auth/platform/login-page | Tiêu đề, dòng phụ, tối đa 6 dòng thông tin hỗ trợ của trang đăng nhập ở tên miền chung |
| GET, PUT | /api/v1/auth/platform/support-policy | Chính sách vào trường của quản trị nền tảng `{ mode, default_hours, max_hours }`; PUT cần `otp_code`; chuyển `school_grant` kết thúc phiên đang mở theo chính sách nền tảng |
| POST | /api/v1/auth/platform/schools/{mã}/support-sessions (đổi ở YCTD-220) | Thêm `otp_code`, `scope` (`read` mặc định, `full`), `hours` (1 đến tối đa của chính sách): trường chưa cho phép mà chính sách là `any_school` thì mở phiên `access_basis: "platform_policy"` sau khi kiểm mã xác thực hai lớp (thiếu mã 422, sai 401, giờ sai 400); trả thêm `access_basis` |
| GET | /api/v1/classroom-tools/config (từ YCTD-212) | Cấu hình công cụ lớp học của trường: `offline_enabled`, `roster_ttl_hours`, `conduct_enabled`, `disabled_tools` (mã công cụ trường tắt ở Hộp công cụ giảng dạy, từ YCTD-325); người đăng nhập nào cũng đọc được |
| GET | /api/v1/classroom-tools/classes/{id}/roster (từ YCTD-212) | Danh sách lớp gọn: `students` (`id`, `order_no`, `full_name`, `code`, `absent_today`); chỉ người có phạm vi xem trẻ của lớp, không thì 403 (P03-09, BR-231) |
| POST | /api/v1/classroom-tools/calls (từ YCTD-212) | Ghi lượt gọi (`class_id`, `calls` 1 đến 100 mục `client_id`, `child_id`, `called_at` tuỳ chọn); trả `saved`, `duplicates` (gửi lại cùng `client_id` không trùng); học sinh ngoài lớp 400 |
| GET, DELETE | /api/v1/classroom-tools/classes/{id}/calls, /calls/{callId} (từ YCTD-212) | Xem 100 lượt gần nhất; xóa một lượt hoặc toàn bộ lượt của chính mình |
| GET, PUT | /api/v1/classroom-tools/classes/{id}/grouping (từ YCTD-212) | Bản chia nhóm gần nhất của giáo viên (`groups`: `name`, `child_ids`; mỗi học sinh một nhóm, thuộc lớp); từ YCTD-271 đọc và lưu bộ nhóm `classroom` của giáo viên, `PUT` nhận thêm `group_set_id` tuỳ chọn khi chọn bộ sẵn có |
| GET | /api/v1/group-sets?class_id=&subject_id=&purpose=&include_archived= (từ YCTD-271) | Bộ nhóm của lớp, mới nhất trước: `id`, `name`, `purpose`, `method`, `status`, `subject_name`, `owner_name`, `group_count`, `replaces_id`; mặc định chỉ bộ đang dùng. Giáo viên được phân công hoặc dạy lớp, vai trò đơn vị xem được lớp; khác 403 |
| POST | /api/v1/group-sets/preview (từ YCTD-271) | Xem trước, không lưu: `class_id`, `subject_id`, `method`, `by` (`count`, `size`), `value` (1 đến 50), `seed`, `ability_source` (`term_average`, `subject_level`; `activity` 400 đến khi có 28d), `balance_gender`, `exclude_absent`, `apart`, `together` (tối đa 100 cặp), `leader_mode` (`none`, `random`, `rotate`); trả `groups` (`name`, `child_ids`, `leader_child_id`), `violations`, `seed`, `excluded_absent`; không trả mức năng lực. Theo năng lực thiếu môn 400 |
| POST | /api/v1/group-sets (từ YCTD-271) | Lưu bộ nhóm: như xem trước, thêm `purpose`, `name`, `groups` (lưu đúng danh sách đã xem hoặc chia tay), `replaces_id` (bộ cũ chuyển `archived`); học sinh ngoài lớp hoặc ở hai nhóm 400 (trừ `timetable_group`); trả bộ kèm `groups`, `violations` |
| GET | /api/v1/group-sets/{id} (từ YCTD-271) | Bộ nhóm, `can_edit`, `groups` (`id`, `name`, `position`, `leader_child_id`, `child_ids`, `members`: `child_id`, `full_name`, `is_leader`) |
| PATCH | /api/v1/group-sets/{id} (từ YCTD-271) | Đổi `name`, `status` = `archived`; bộ đã lưu trữ 400; không phải người lập hoặc vai trò đơn vị 403 |
| POST | /api/v1/group-sets/{id}/move, /groups/{groupId}/leader, /leaders (từ YCTD-271) | Chuyển `child_id` sang `to_group_id` (trống là bỏ khỏi bộ); đặt hoặc bỏ nhóm trưởng (`child_id` phải trong nhóm); đổi nhóm trưởng cả bộ `mode` = `random` hoặc `rotate`; mỗi thay đổi ghi `child_group_member_events` |
| GET | /api/v1/group-sets/subjects?class_id= (từ YCTD-271) | Môn đang dùng của cấp học của lớp, để chọn môn khi chia theo năng lực |
| GET | /api/v1/group-sets/children/{childId} (từ YCTD-271) | Nhóm của con trong các bộ đang dùng: `set_name`, `purpose`, `subject_name`, `group_name`, `leader_name`, `members` (họ tên); không có cách chia, tham số. Phụ huynh của học sinh hoặc nhân sự xem được học sinh; khác 403 |
| POST | /api/v1/classroom-tools/scores (từ YCTD-212) | Ghi dòng điểm (`class_id`, `session_key`, `events` 1 đến 200 mục `client_id`, `target_kind`, `group_name` hoặc `child_id`, `delta`, `note`, `occurred_at`); chống trùng theo `client_id` |
| GET, DELETE | /api/v1/classroom-tools/classes/{id}/scores?session_key=, /scores/{sessionKey} (từ YCTD-212) | Dòng điểm và tổng theo đối tượng của buổi (chỉ của chính giáo viên); bỏ buổi xóa dòng chưa chuyển vào nề nếp |
| POST | /api/v1/classroom-tools/classes/{id}/scores/{sessionKey}/confirm (từ YCTD-212) | Chuyển điểm vào nề nếp: `criterion_id`, `targets` (tuỳ chọn), `date` (tuỳ chọn); cần `P02.conduct.record`; trả `confirmed_events`, `net`, `quantity`, `conduct_entry_ids`; 422 khi tổng bằng 0, tiêu chí ngược chiều, nề nếp chưa bật (BR-232) |
| GET | /api/v1/classroom-games/classes/{classId}/catalog (từ YCTD-213) | Môn, chủ đề, mức nhận thức có câu đã duyệt của khối của lớp (P02-100); giáo viên không phụ trách lớp 403 |
| GET | /api/v1/classroom-games/classes/{classId}/questions (từ YCTD-213) | Câu đã duyệt theo môn, chủ đề, mức, dạng (trắc nghiệm, đúng sai, trả lời ngắn), tối đa 60; có đáp án vì giáo viên điều khiển (P02-100) |
| POST | /api/v1/classroom-games/sessions (từ YCTD-213) | Lưu lượt chơi (`client_id`, `class_id`, `kind`, `title`, `config`, `group_scores`, `question_ids`, `answers`): chấm lại trắc nghiệm, đúng sai theo ngân hàng; ghi lịch sử sử dụng câu hỏi kèm tỷ lệ đúng; gửi lại cùng `client_id` không trùng; câu nháp 400 (P02-100, P02-102) |
| GET | /api/v1/classroom-games/classes/{classId}/sessions, /sessions/{id} (từ YCTD-213) | Lịch sử lượt chơi và chi tiết (P02-102) |
| GET | /api/v1/public/push/vapid-public-key | Khóa công khai VAPID của nền tảng cho đăng ký đẩy (YCTD-232): `{ enabled, public_key }`; chưa bật đẩy hoặc chưa có khóa thì `enabled: false` |
| GET, POST | /api/v1/push/subscriptions | Máy đã đăng ký của chính người dùng; đăng ký `{ endpoint (https), keys: { p256dh, auth }, app, device_label, origin }`, cùng máy thì cập nhật (`created: false`), máy của người khác thì thu hồi đăng ký cũ; sai dữ liệu 400 |
| POST | /api/v1/push/subscriptions/unsubscribe | `{ endpoint }`: ứng dụng gọi khi đăng xuất, thu hồi đăng ký của máy này |
| DELETE | /api/v1/push/subscriptions/{id} | Gỡ một máy của mình; máy của người khác 404 |
| GET, PUT | /api/v1/push/preferences | Tám nhóm loại và trạng thái bật đẩy; PUT `{ groups: { <mã nhóm>: true hoặc false } }`, nhóm lạ 400 |
| GET, PUT | /api/v1/push/urgent-templates | Loại thông báo khẩn (P01.setting.manage): PUT `{ template_codes: [...] }` thay danh sách |
| POST | /api/v1/internal/jobs/tick | Điểm gọi của bộ hẹn giờ bên ngoài (YCTD-192, BR-204): tiêu đề `x-internal-job-token` bằng `INTERNAL_JOB_TOKEN` (so sánh thời gian hằng, sai 401, chưa đặt 404, có giới hạn tần suất); chạy việc nền đến hạn của mọi trường rồi trả `{ jobs, schools, failed }`; không cần trường (gọi bằng địa chỉ nội bộ) |
| GET | /api/v1/public/schools/picker | Trang chọn trường ở tên miền gốc (YCTD-192, BR-205, MH-315): trang HTML tĩnh, 404 khi chưa đặt `PLATFORM_ROOT_DOMAIN`; không cần trường |
| GET | /api/v1/public/schools/resolve?code=<mã> | Đổi mã trường thành `{ url }` của trường đang phục vụ (YCTD-192, BR-205); mã lạ, trường tạm dừng, đang khởi tạo hoặc đã xóa 404; có giới hạn tần suất theo địa chỉ mạng; không liệt kê trường |
| GET | /api/v1/auth/platform/schools, /auth/platform/schools/settings, /auth/platform/schools/{mã} | Danh sách trường kèm tên miền; cấu hình (tên miền hệ thống, địa chỉ vào, bộ nối tên miền, số ngày chờ xóa); chi tiết trường kèm tên miền, hồ sơ đồng ý, vùng máy chủ, việc khởi tạo, sự kiện, lời mời (không có mã kích hoạt) (P01-54 đến P01-56, PQ-106, YCTD-193) |
| POST | /api/v1/auth/platform/schools | Khởi tạo trường theo bước setup (P01-54, BR-206, BR-207) |
| POST | /api/v1/auth/platform/schools/jobs/{mã việc}/resume, /jobs/{mã việc}/rollback | Chạy tiếp, hoàn tác việc khởi tạo lỗi (P01-54) |
| POST | /api/v1/auth/platform/schools/{mã}/suspend, /resume, /request-deletion, /cancel-deletion | Tạm dừng, mở lại, yêu cầu xóa, hủy yêu cầu xóa; thân `{ reason }` (P01-55, BR-208) |
| POST | /api/v1/auth/platform/schools/{mã}/invitation | Cấp lại đường kích hoạt quản trị viên đầu tiên (P01-57) |
| POST | /api/v1/auth/platform/schools/{mã}/consents, /hosting, /data-class | Ghi hồ sơ đồng ý, vùng máy chủ; đổi loại dữ liệu (P01-56, BR-207); trả chi tiết trường. Chỉ vai trò vận hành `quan_tri`, `ky_thuat`, vai trò khác 403 (YCTD-343). Chi tiết trường `GET /auth/platform/schools/{mã}` có thêm `consent_gaps`: các mục còn thiếu để chuyển sang `consented`, rỗng là đủ |
| POST | /api/v1/auth/platform/schools/{mã}/domains, /domains/{tên miền}/verify | Thêm tên miền riêng (chờ kiểm tra), kiểm tra DNS (P01-56) |
| GET, POST | /api/v1/auth/activate | Xem lời mời, kích hoạt quản trị viên đầu tiên ở tên miền của trường (P01-57, BM-77) |
| GET, POST | /api/v1/school-data-exports; GET /api/v1/users/data-export | Gói ZIP toàn bộ dữ liệu; phần dữ liệu tài khoản của dịch vụ định danh (P01-33, YCTD-145) |
| GET | /api/v1/public/demo | Trạng thái bản trình diễn, tài khoản trình diễn, mật khẩu chung (công khai; P01-34, YCTD-145) |
| GET | /api/v1/outgoing-documents | Danh sách văn bản đi theo `view` (`drafts`, `pending`, `processed`, `to_issue`, `issued`, `search`), lọc, phân trang (YCTD-140) |
| GET | /api/v1/outgoing-documents/recipients | Đơn vị nhận của văn bản đã ban hành theo `status` (`pending`, `sent`, `delivered`, `all`) |
| GET | /api/v1/outgoing-documents/next-number | Số đi kế tiếp của sổ văn bản đi (`book_id`) |
| POST | /api/v1/outgoing-documents | Tạo dự thảo |
| GET, PUT, DELETE | /api/v1/outgoing-documents/{id} | Chi tiết (kèm `actions`), sửa, xóa dự thảo chưa trình |
| POST, GET, DELETE | /api/v1/outgoing-documents/{id}/files, /files/{fileId} | Tệp dự thảo, phiếu trình, văn bản gửi kèm; tải tệp; xóa tệp |
| POST | /api/v1/outgoing-documents/{id}/consult, /consult/end, /opinion | Lấy ý kiến; kết thúc lấy ý kiến; cho ý kiến hoặc kết thúc cho ý kiến (`finish`) |
| POST | /api/v1/outgoing-documents/{id}/submit, /revoke, /sign, /decline, /return | Trình ký, lấy lại, ký nội bộ, không ký, trả lại |
| POST | /api/v1/outgoing-documents/{id}/issue, /send, /publish, /freeze | Cấp số và phát hành, đánh dấu gửi liên thông, public lên cổng TTĐT, đóng băng |
| POST | /api/v1/outgoing-documents/archive | Lưu hồ sơ hàng loạt |
| GET | /api/v1/outgoing-documents/{id}/slip | Phiếu trình ký PDF |
| GET | /api/v1/document-books/{id}/outgoing-register, /outgoing-register/export | Sổ đăng ký văn bản đi, xuất Excel |
| GET | /api/v1/public/outgoing-documents/verify | Tra cứu mã QR, không cần đăng nhập (`code` 12 ký tự) |

Giao kèo văn bản đến theo VNPT iOffice (DT-18 phần 18a, YCTD-138, BR-134; máy chủ API, dữ liệu ở cơ sở dữ liệu hệ thống):

1. Quyền: mọi điểm cuối cần một trong bốn quyền `P09.incoming-document.*`; ghi danh mục, đơn vị, nhóm, lãnh đạo, sổ cần `admin` ở phạm vi toàn trường; `POST /incoming-documents`, `/interconnect`, `GET /next-number` cần `register` ở phạm vi toàn trường; sổ đăng ký cần `register` hoặc `admin`. Các thao tác trên văn bản kiểm tra vai trò trong luồng ở máy chủ; văn bản người dùng không xem được trả `ERR_NOT_FOUND`; thao tác không được làm trả `ERR_RULE_VIOLATION` mã `YCTD-138`.
2. `GET /incoming-documents` nhận `view` (`inbox` mặc định, `processed`, `registered`, `processing`, `completed`, `for_information`, `starred`, `followed`, `search`, `interconnect`; bốn danh sách của văn thư và `interconnect` cần `register`), `role` (`all`, `main`, `coordinate`, `view`), `q` (trích yếu), `symbol`, `arrival_number`, `issuer`, `arrival_from`, `arrival_to`, `book_id`, `form_id`, `urgency_id`, `overdue=true`, `due_soon=true`, `page`, `page_size` (10, 20, 50, 100, 200); trả `items` (thông tin văn bản, tên danh mục, `urgency_level`, `starred`, `followed`, `my_role`, `my_status`, `unread`, `effective_deadline` là hạn của dòng đang chờ của mình hoặc hạn văn bản, `overdue`, `due_soon`, `main_handler_name`, `directed`, `file_count`), `total`, `page`, `page_size`.
3. Văn bản nhận các ô của biểu mẫu: `summary` (tối đa 2000 ký tự), `symbol` (100), `issuer_unit_id` hoặc `issuer_name` (một trong hai), `document_date` bắt buộc; `form_id`, `urgency_id`, `secrecy_id`, `field_id` (đúng loại danh mục), `deadline`, `authority`, `document_kind`, `transfer_method`, `copy_type`, `has_paper`, `processing_note` (4000); vào sổ thêm `book_id`, `arrival_date` bắt buộc, `arrival_number` (trống là số kế tiếp; trùng trả `ERR_CONFLICT` ở ô `arrival_number`). Chi tiết trả thêm `files`, `related`, `assignments` (kèm `overdue`, `due_soon`), `events`, `my_pending_assignment_id`, `actions` (thao tác người xem làm được), `exchange` (`connected` false, mô tả bản chạy nội bộ). Mở chi tiết ghi `read_at` các dòng đang chờ của người xem, dòng xem để biết thành `done`.
4. `POST /{id}/transfer` nhận `mode` (`leader`, `process`, `rotate`), `recipients` (1 đến 100, mỗi dòng `user_id`, `role` với `process`, `deadline`), `note`, `deadline` chung. `return`, `refuse` cần `note`. `extension` nhận `until`, `reason`; `extension/decide` nhận `assignment_id`, `approve` (boolean), `note`. `restrict` nhận `restricted`; `reply` nhận `reply_symbol`, `reply_date`, `note`; `acknowledge` nhận `acknowledged` (mặc định true), `reference`; `register` nhận `book_id`, `arrival_number`, `arrival_date`.
5. Thao tác hàng loạt `complete`, `archive` (thêm `archive_record_id` của hồ sơ tài liệu 5.10.1) nhận `ids` (1 đến 200), trả mỗi văn bản `id`, `ok`, `message`; văn bản không làm được không chặn văn bản khác. `flags` nhận `ids` và `starred` hoặc `followed`.
6. Tệp: PDF, JPEG, PNG, Word, Excel theo chữ ký tệp, tối đa 50 MB, tối đa 30 tệp mỗi văn bản; `kind` `main` hoặc `related`, `scanned` là `true` khi quét. Người tải lên hoặc văn thư xóa tệp khi văn bản chưa kết thúc. Phiếu PDF khổ dọc, tên tệp `phieu-trinh-…`, `phieu-xu-ly-…`, `phieu-giao-nhan-…`. Sổ đăng ký trả `book`, `items` (cột của iOffice; văn bản hạn chế xem che trích yếu); tệp Excel `so-van-ban-den-<năm>-….xlsx` ghi `export_logs` mã `incoming_document_register`.
7. Người nhận được chuyển nhận thông báo trong ứng dụng (mẫu `incoming_document`); trả lại, từ chối, xử lý xong, xin gia hạn báo người chuyển; kết quả gia hạn báo người xin. `PORTAL_QUICK_LINK_PATHS` thêm 12 đường dẫn của phân hệ `documents`; `DATA_GRID_KEYS` thêm `incoming-documents`, `incoming-manage`, `incoming-interconnect`, `incoming-register`, `document-books`, `external-units`, `external-unit-groups`, `document-catalogs`.

Giao kèo quản trị và trình diễn (DT-18 phần 18h, YCTD-145, BR-141):

1. `POST /auth/impersonation` nhận `user_id`, `reason` (5 đến 500 ký tự), mã phiên cổng quản trị của người có `P01.account.impersonate`; trả mã phiên của tài khoản đích kèm `impersonation_id`, đặt cookie mã làm mới cổng quản trị sang phiên đích. Tài khoản quyền cao hơn, quản trị khác, VT-01, chính mình, đang khóa, chỉ phụ huynh, đang đăng nhập thay trả 422 `YCTD-145`; thiếu quyền 403; thiếu lý do 400.
2. `POST /auth/impersonation/exit` bằng mã phiên đăng nhập thay: đóng phiên đích, trả mã phiên mới của phiên gốc (`signed_out: false`) hoặc `signed_out: true` khi phiên gốc đã hết hạn. `GET /auth/me` trả `impersonation` (`id`, `impersonator_id`, `impersonator_name`, `started_at`, `expires_at`) hoặc `null`.
3. Trong phiên đăng nhập thay: `/auth/change-password`, `/users/{id}/reset-password`, `/users/bulk-reset-password`, `PUT /auth/settings`, `PUT /auth/settings/password-policy` trả 403 `YCTD-145`; ở máy chủ API, thao tác ghi `/signing/certificate*`, `/signing/dossiers/sign`, `/outgoing-documents/{id}/sign`, `/school-data-exports` trả 403 `YCTD-145`; mọi thao tác ghi và tải tệp khác ghi `impersonation_actions`.
4. `POST /school-data-exports` (`P01.data.export-all`) trả 202 kèm `job`; đang có gói chưa xong trả 422. Tải gói bằng `GET /export-jobs/{id}/file` (chỉ người tạo, `application/zip`); mỗi lần tải ghi `export_job_downloads`. `GET /school-data-exports` trả 50 gói gần nhất kèm `user_name`, `download_count`, `last_downloaded_at`.
5. `GET /public/demo` (không cần đăng nhập) trả `enabled`, `seeded_at`, `next_reset_at`, `reset_interval_hours`, `accounts`, `password` (chỉ khi là bản trình diễn).


Giao kèo bán trú, an toàn thực phẩm (DT-18 phần 22b, YCTD-146, BR-143 đến BR-146):

1. `POST /food-safety/files` (nhiều phần: `file`, `org_unit_id`; `P12.kitchen.manage`) nhận PDF, ảnh JPEG, PNG tối đa 10 MB; trả `id`. `GET /food-safety/files/{id}` cho người xem dữ liệu bếp của đơn vị.
2. `GET /food-supplier-certificates` nhận `org_unit_id`, `supplier_id`, `validity` (`valid`, `expiring`, `expired`, `revoked`); mỗi dòng có `validity`, `days_left`. `POST` nhận `supplier_id`, `certificate_type`, `number`, `issued_by`, `issued_on`, `expires_on`, `scope_note`, `file_id`; `PATCH` nhận các trường đó và `status`. `GET /food-suppliers/safety-summary` trả mỗi nhà cung cấp `has_valid_food_safety`, `expiring_count`, `expired_count`, `nearest_expiry`.
3. `GET /food-lots` nhận `org_unit_id`, `from`, `to`, `status`, `ingredient_id`, `supplier_id`, `expiry` (`expiring`, `expired`); mỗi lô có `expiry_state`, `purchase_code`. `GET /food-lots/{id}` thêm `inspection` (kết quả bước 1) và `usage` (món đã dùng). `POST /food-lots` nhận `org_unit_id`, `ingredient_id`, `supplier_id`, `received_date`, `quantity` và các trường của lô; `PATCH` lô đã kiểm tra chỉ nhận `document_number`, `document_file_id`, `note` (422 BR-146). `POST /food-lots/{id}/close` nhận `status` (`used_up`, `disposed`) và `handling_note` (bắt buộc khi hủy). Chi tiết phiếu đi chợ trả `supplier_certificate_warning` và mỗi dòng có `lot`.
4. `POST /food-inspections` (`P12.food-safety.inspect`) nhận `org_unit_id`, `inspection_date`, `step`, `inspector_name`, `inspector_title`, `inspected_time` (HH:MM), `location`, `note`; trùng ngày, bước trả 422; trả phiếu với dòng gợi ý. `PUT /food-inspections/{id}` nhận các trường đầu phiếu và `lines` (thay toàn bộ dòng: `lot_id`, `meal_type`, `dish_id`, `dish_name`, `main_ingredients`, `servings`, `first_time`, `second_time`, `hygiene_people`, `hygiene_equipment`, `hygiene_area`, `utensils`, `sensory_result`, `rapid_test_result` là `pass` hoặc `fail`, `rejection_action`, `action`, `note`, `lot_ids`). `POST /food-inspections/{id}/confirm` trả 422 BR-144 kèm từng lỗi. `GET /food-inspections/day` nhận `org_unit_id`, `date`, trả `steps` (ba phiếu hoặc `null`).
5. `POST /food-samples` nhận `org_unit_id`, `sample_date`, `meal_type`, `dish_id`, `dish_name`, `servings`, `food_form`, `quantity`, `container`, `storage_temperature`, `sampled_at` (không múi giờ là giờ Việt Nam), `note`; sai lượng, nhiệt độ trả 400. `POST /food-samples/destroy` nhận `ids` (1 đến 100), `quality_note`, `destroyed_at`; chưa đủ 24 giờ hoặc đang giữ trả 422 BR-143. `hold` nhận `hold_reason`; `release` bỏ giữ. Mỗi mẫu có `earliest_destroy_at`, `destroy_state` (`retaining`, `due`, `held`, `destroyed`). `GET /food-samples/suggestions` trả món của ngày, `servings`, `required`, `sampled`.
6. `GET /food-safety/trace` nhận `org_unit_id`, `date`, `dish_id`; mỗi món có `step2`, `step3`, `lots_source` (`recorded`, `inferred`, `none`), `lots` (kèm `first_step`, `certificates` với `validity_on_date`), `samples`. `POST /food-safety/books` nhận `org_unit_id`, `from`, `to` (tối đa 63 ngày), `book` (`inspections`, `samples`, `labels`), `format` (`pdf`, `xlsx`; nhãn chỉ PDF); trả tệp, ghi `export_logs`.


Giao kèo website trường (DT-18 phần 18f, YCTD-144, BR-139; dữ liệu ở cơ sở dữ liệu hệ thống):

1. Quyền: ghi `/website/settings`, `/website/domains`, `/website/sample-content` cần `P14.website.configure`; bài, album, thư liên hệ cần `P14.website.edit` hoặc `P14.website.approve`; `/approve`, `/return`, `/unpublish`, `/website/review`, `/contacts/{id}/handle` cần `P14.website.approve`.
2. `POST /website/domains` nhận `hostname` (chữ không dấu, số, gạch ngang, có dấu chấm, không giao thức, cổng), `kind` (`primary`, `alias`, `demo`), `note`; tên miền chính thứ hai trả 422 `YCTD-144`, trùng trả 409. `/dns-confirmation` nhận `confirmed`.
3. `POST /website/posts` nhận `kind`, `title` (bắt buộc), `summary`, `body_html` (lọc trước khi lưu), `pinned`, `page_key` (`intro`, `organization` với `page`; trùng trả 409), `disclosure_category`, `disclosure_year` (dạng 2026-2027) với `disclosure`. `/files` nhận tệp `file` và `purpose` (`cover`, `attachment`); album nhận `file`, `caption`. `/albums/{id}/submit` nhận `consent_confirmed` bắt buộc đúng. `/return` nhận `note`, `/unpublish` nhận `reason` bắt buộc.
4. `GET /public/website/domain-check?domain=` trả 200 khi tên miền đã đăng ký và đang dùng, 404 khi không (Caddy `on_demand_tls`). Trang `/public/site/*` chọn trường theo tên máy của yêu cầu; tên miền lạ trả trang 404; tên miền phụ trả 301 về tên miền chính; có `X-Website-Root: 1` thì liên kết tính từ gốc tên miền. Trang trả `Content-Security-Policy: default-src 'none'; ...`. `POST /public/site/lien-he` nhận biểu mẫu `full_name`, `phone`, `email`, `subject`, `message`; thành công trả 303 về `/lien-he?da-gui=1`, lỗi trả 422 kèm biểu mẫu, quá giới hạn trả 429.


Giao kèo giao việc, lịch, hồ sơ công việc, báo cáo theo VNPT iOffice (DT-18 phần 18c, YCTD-141, BR-137; việc ở cơ sở dữ liệu năm học, lịch, phòng họp, hồ sơ ở cơ sở dữ liệu hệ thống):

1. `POST /task-directives` nhận `content` (bắt buộc), `leader_user_id`, `priority` (`low`, `normal`, `high`), `start_date`, `duration_days`, `remind_assigner`, `recurrence` (`none`, `daily`, `weekly`, `monthly`), `source_document_id`, `related_documents`, `assignments` (1 đến 100 dòng `role` `main`, `coordinate`, `follow`; `target_type` `unit` kèm `org_unit_id`, `department_id` hoặc `staff` kèm `staff_id`; `start_date`, `due_date`). Lỗi theo dòng trả `assignments[i].<trường>`. Cần `P09.task.direct` ở đơn vị của mọi dòng.
2. `GET /task-directives` nhận `box` (`inbox` mặc định, `outbox`), `status` (`open`, `open_on_time`, `open_overdue`, `done`, `done_on_time`, `done_late`, `pending_approval`, `approved`, `approved_not_done`, `approved_done`), `role`, `target`, `q`, `source_document_id`, `page`, `page_size`. Chi tiết trả `assignments` kèm `can_update`, `can_delegate`, `can_approve`, `can_revoke`; người không liên quan nhận 404.
3. `/assignments/{aid}/progress` nhận `progress_percent` (0 đến 100), `content`; `/approve` nhận `result` (`done`, `not_done`), `note`; `/assignments` nhận `assignments` và `parent_id` (phân công tiếp); `/cancel` nhận `reason` bắt buộc.
4. `POST /room-bookings` nhận `room_id`, `title`, `chair_name`, `participants`, `date`, `start_time`, `end_time` (HH:MM), `note`; trùng giờ trả 422. `POST /unit-schedules`, `PUT /unit-schedules/{id}` nhận `org_unit_id`, `entry_date`, `session`, `start_time`, `end_time`, `content`, `chair_name`, `participants`, `location`, `note`, `room_id` (cần giờ bắt đầu, kết thúc), `attendee_ids`. `GET /unit-schedules` nhận `from`, `to` (tối đa 62 ngày), `org_unit_id`, `view=mine`, `location`, `participant`; `/export` thêm `format` (`xlsx`, `pdf`). `/publish` nhận `from`, `to`, `org_unit_id`. `/unit-schedule-templates/{id}/apply` nhận `week_of`, `org_unit_id`.
5. `GET /work-files` nhận `box` (`personal`, `shared`, `transferred`, `archive`, `expired`), `year`, `q`. `POST /work-files` nhận `code`, `title`, `year`, `description`, `org_unit_id`, `retention`, `retention_years`; ký hiệu trùng trả 409. `/items` nhận `item_type` và `incoming_document_id`, `task_id` hoặc `title`, `note`. `PUT /shares` nhận `shares` [`user_id`, `permission`]. `/transfer` nhận `user_id`, `note`. `/submit` nhận `retention`, `retention_years` (tùy chọn). `/accept` nhận `code` (mặc định năm và ký hiệu), `fond_id`; `/return` nhận `note` bắt buộc.
6. `GET /document-reports/{incoming|summary|statistics}` nhận `from`, `to` (bắt buộc, tối đa 400 ngày), `org_unit_id`; `/export` thêm `kind`, `format`, ghi `export_logs` mã `document_report_<kind>`.

Giao kèo thi đua, khen thưởng (DT-18 phần 22d, YCTD-148, BR-147 đến BR-150; dữ liệu ở cơ sở dữ liệu năm học hiện hành, sổ nhiều năm đọc mọi năm học):

1. `POST /emulation/titles`, `PUT /{id}` nhận `code`, `name`, `description`, `kind`, `target`, `decision_level`, `school_level`, `min_kpi_rank`, `requires_initiative`, `prerequisite_code` cùng `consecutive_years` (1 đến 10), `quota_percent` cùng `quota_base_code`, `vote_threshold_percent`, `min_score`, `criteria` (tối đa 20: `code` chữ thường, `title`, `weight`, `max_score`), `sort_order`, `status`; `POST /defaults` trả `created`, `skipped`.
2. `POST /emulation/campaigns` nhận `code`, `name`, `kind`, `description`, `title_ids`, `kpi_period_id`, `registration_deadline`, `nomination_deadline`, `appeal_days`; `/launch`, `/publish` (trả `appeal_deadline`), `/close`. `PUT /{id}/council` nhận `members` (`user_id`, `position`); `POST /{id}/meetings` nhận `held_at` (YYYY-MM-DDTHH:mm giờ Việt Nam), `location`, `content`.
3. `POST /emulation/registrations`, `POST /emulation/nominations` nhận `campaign_id`, `title_id`, `target`, `staff_id` (bỏ trống là mình) hoặc `department_id` (đăng ký thêm `commitment`). `PUT /emulation/nominations/{id}` nhận `achievements`, `initiative`, `scores` (theo mã tiêu chí); chi tiết trả `criteria`, `eligibility` (`code`, `label`, `state` là `ok`, `failed`, `unknown`, `detail`), `kpi_live` hoặc `kpi_rank`, `evidence`, `appeals`; số phiếu chỉ hiện sau công bố (người quản lý luôn thấy). `POST /{id}/evidence` nhận `document_id`, `note`.
4. `PUT /emulation/meetings/{id}/votes` nhận `votes` (`nomination_id`, `choice`); `GET /emulation/meetings/{id}` trả `my_choice`, `voted_members`, số phiếu chỉ khi phiên đã đóng; `POST /{id}/close` nhận `attendee_count`, `conclusion`.
5. `POST /emulation/appeals` nhận `campaign_id`, `nomination_id` (bắt buộc với phúc khảo), `kind`, `content`; quá hạn trả 422 BR-150. `POST /{id}/resolve` nhận `accept`, `response`.
6. `POST /emulation/decisions` nhận `campaign_id`, `kind`, `title`, `basis`, `signer_name`, `signer_title`, `nomination_ids`; lỗi theo ô `nomination_ids.{n}`. `POST /{id}/outgoing` tạo văn bản đi dự thảo kèm tệp Word. `POST /{id}/issue` (`P09.emulation.decide`) nhận `number`, `issue_date`. `POST /{id}/upper-result` nhận `number`, `date`, `issuer`, `awarded_ids`. `GET /emulation/awards/{id}/certificate` trả PDF; mã QR là địa chỉ `/tra-cuu-khen-thuong?ma=` theo nguồn của yêu cầu.
7. `GET /emulation/history` nhận `q`, `target`, `title_code`, `staff_id`; `POST` nhận `year_name`, `title_code`, `title_name`, `title_kind`, `target`, `staff_id` hoặc `department_id`, `decision_number`, `decision_date`, `issuer`, `note`. `GET /public/emulation-awards/verify?code=` (không đăng nhập, giới hạn số lần) trả `school_name`, `subject_name`, `title_name`, `year_name`, `decision_number`, `decision_date`, `issuer`.


Giao kèo bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f, YCTD-149, BR-151 đến BR-153; dữ liệu ở cơ sở dữ liệu năm học hiện hành):

1. `POST /quality/frameworks`, `PUT /{id}` nhận `code` (chữ không dấu, số, chấm, gạch), `name`, `school_level`, `legal_basis`, `max_level` (1 đến 4), `sort_order`, `status`; `POST /defaults` nhận `school_level`, trả `created`, `skipped` (cấp chưa có bộ mẫu trả 422). Tiêu chuẩn nhận `code`, `title`, `sort_order`; tiêu chí thêm `evidence_hint`; chỉ báo nhận `level`, `code`, `content`. Xóa bộ, tiêu chí đã dùng trả 422. `GET /frameworks/{id}` trả cây `standards[].criteria[].indicators[]`.
2. `POST /quality/assessments`, `PUT /{id}` nhận `framework_id`, `title`, `decision_number`, `decision_date`, `start_date`, `end_date`, `introduction`, `conclusion`. `PUT /{id}/council` nhận `members` (`staff_id`, `position`, `duty`); `PUT /{id}/groups` nhận `groups` (`name`, `leader_staff_id`, `member_staff_ids`, `criterion_ids`), thay toàn bộ. `POST /{id}/start`, `/complete` (nhận `self_level`), `/reopen`. `GET /{id}` trả `council`, `groups`, `criteria` (tiến độ từng tiêu chí), `summary` (`total`, `assessed`, `by_level`, `suggested`), `evidence_status`, `can_manage`, `my_group_ids`.
3. `GET /quality/reports` nhận `assessment_id`, `mine`; `PUT /reports/{id}` nhận `current_state`, `strengths`, `weaknesses`, `improvement_actions` (tối đa 30), `indicator_results` (mã chỉ báo → true, false), `self_level`; `GET` trả thêm `indicators`, `suggested_level`, `evidences`, `can_edit`, `can_review`. `/return` cần `note`.
4. `GET /quality/evidences` nhận `assessment_id` (bắt buộc), `criterion_id`, `status`, `q`; `POST` nhận `assessment_id`, `criterion_id`, `box` (tùy chọn), `title`, `document_number`, `issued_date`, `issuer`, `description`, `status`, `source_type`, `source_id`, `criterion_ids` (dùng chung); trả `code`. `POST /evidences/{id}/file` (nhiều phần: `file`) nhận tối đa 20 MB. `GET /evidences/{id}/file` trả tệp tải lên hoặc tệp của hồ sơ kho. `GET /evidence-sources` nhận `source_type`, `q`, trả `id`, `label`.
5. `POST /assessments/{id}/inherit-evidences` trả `year_name`, `created`, `skipped`. `POST /{id}/work-plan` trả `work_plan_ids`, `plans`, `items`. `GET /{id}/report?format=docx|pdf` trả báo cáo tự đánh giá; `GET /{id}/evidences/export?format=xlsx` trả danh mục minh chứng. `PUT /{id}/recognition` nhận `external_level`, `recognition_decision`, `recognition_date`, `recognition_valid_until`; `POST /{id}/recognition/apply` ghi vào bản rà soát 1.7, trả `accreditation_level`, `accreditation_date`, `accreditation_year`. `GET /quality/recognition` trả `review` (1.7 kèm `valid_until`, `state`) và `records`.
6. `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm sáu khóa lưới: `quality-assessments`, `quality-assessment-criteria`, `quality-reports`, `quality-evidences`, `quality-recognitions`, `quality-frameworks`.


Giao kèo cấp học của trường (DT-19 phần 19a, YCTD-151, BR-154):

1. `GET /school-levels` trả `levels` (theo thứ tự: `code`, `is_enabled`, `order_no`, `display_name`, `learner_term`, `context_label`, `updated_by_name`, `updated_at`, `class_count`) và `user_levels` (cấp đang bật thu hẹp theo phạm vi cấp của người gọi).
2. `PUT /school-levels` nhận `levels` đủ bốn cấp, mỗi cấp một lần; lỗi theo ô `levels[n].order_no`, `levels[n].display_name`, `levels[n].learner_term`, `levels[n].context_label` (400), thiếu, trùng cấp hoặc trùng thứ tự ở `levels` (400); không cấp nào bật trả 422 BR-154. Trả như `GET`.
3. `GET /users/{id}/school-levels` trả `school_levels` (theo thứ tự mã); `PUT` nhận `school_levels` (mảng mã, trống là mọi cấp; mã sai trả 400 ở `school_levels`); tài khoản ngoài phạm vi quản lý trả 403. `GET /auth/me` thêm `school_levels`.
4. `GET /portal-context` trả `education_level` là nhãn các cấp đang bật nối bằng dấu phẩy; `GET /website/settings` trả `school_levels` là các cấp đang bật.


Giao kèo menu theo cấp học (DT-19 phần 19c, YCTD-153, BR-159):

1. `PUT /auth/me/working-school-level` nhận `school_level` (mã cấp, hoặc `null` là "Tất cả"); mã sai hoặc ngoài phạm vi cấp của tài khoản trả 400 ở `school_level`; trả `{ working_school_level }`. `GET /auth/me` thêm `working_school_level` (`null` là "Tất cả").
2. `GET /portal-context/school-levels` (mọi người đã đăng nhập) trả `school_levels`: cấp người dùng được xem theo thứ tự (`code`, `display_name`, `learner_term`, `context_label`).
3. Tham số cấp dùng chung `school_level` (truy vấn): mã cấp chỉ lấy cấp đó; không gửi, trống hoặc `all` là mọi cấp người dùng được xem; mã sai trả 400 ở `school_level`; cấp chưa bật hoặc ngoài phạm vi trả 403. Máy chủ đọc qua `SchoolLevelResolver.requested`; điểm cuối nào nhận tham số này ghi ở giao kèo của điểm cuối đó (từ 19d).
4. `GET /me/quick-links` không trả lối tắt tới mục menu của cấp trường chưa bật; `PUT` giữ kiểm tra cũ.


Giao kèo ứng dụng phụ huynh, giáo viên và tin tức theo cấp (DT-19 phần 19e, YCTD-155, BR-163):

1. `GET /children` thêm `school_level` ở mỗi dòng: cấp của lớp đang học, `null` khi chưa xếp lớp (ứng dụng coi là Mầm non). `GET /classes` đã có `school_level` (YCTD-152).
2. `POST /news`, `PATCH /news/{id}` nhận `audience_levels` (mảng mã cấp; không gửi là không đổi, khi tạo là trống); mã sai hoặc cấp chưa bật trả 400 ở `audience_levels`; phạm vi lớp, trẻ luôn lưu `[]`. Tin trả thêm `audience_levels`.
3. `GET /news`, `GET /news/{id}`: phụ huynh (không có vai trò nhân sự) chỉ thấy tin có `audience_levels` trống hoặc có cấp của một con đang học; `child_id` thì theo cấp của con đó; tin ngoài cấp trả 403 ở `GET /news/{id}`. Nhân sự không lọc theo cấp.
4. `POST /news-recipients/count` nhận `org_unit_id`, `scope_type`, `scope_id` (không gửi là đơn vị), `audience_levels`; trả `{ recipient_count }` là số tài khoản phụ huynh của trẻ đang học trong phạm vi (có cấp nhận thì chỉ trẻ học lớp thuộc các cấp đó; phạm vi lớp, trẻ không lọc cấp). Không có quyền soạn tin của đơn vị trả 403.
5. Công bố tin toàn trường, đơn vị có cấp nhận gửi thông báo `news_published` tới từng tài khoản phụ huynh như mục 4; tin không có cấp nhận gửi theo vai trò VT-14 của đơn vị như trước.


Giao kèo nền Tiểu học (DT-20 phần 20a, YCTD-158, BR-166):

1. `POST /subjects` nhận `code`, `name`, `school_level`, `kind`, `assessment`, `order_no`; cấp chưa bật trả 422; mã trùng 409. `PATCH` gửi `code` hoặc `school_level` trả 400.
2. `POST /subjects/templates` nhận `school_level`; trả `created_subjects` (mã môn mới), `curriculum_id` (chương trình mặc định của cấp, tạo nếu chưa có), `created_periods` (số dòng số tiết mới); cấp chưa bật 422, cấp chưa có bộ mẫu 422.
3. `PUT /curricula/{id}/subjects` nhận `subjects` (`subject_id`, `grade_level_code`, `periods_per_week`, `is_elective`); số tiết sai, trùng môn và khối trả 400; môn, khối khác cấp hoặc ngoài khối áp dụng trả 422. `GET` trả các dòng kèm `subject_code`, `subject_name`, `kind`; `periods_per_week` là số.
4. `POST /classes/{id}/staff-assignments` nhận thêm `subject_id`, `periods_per_week`; lớp Tiểu học vai trò bộ môn thiếu `subject_id` trả 400; môn khác cấp, ngừng dùng trả 400; môn đã có giáo viên trả 422. Phân công trả thêm `subject_id`, `periods_per_week`.
5. `GET /teaching-assignments?class_id=` trả `class`, `curriculum`, `subjects` (dòng số tiết của khối lớp kèm `assignment`), `planned_periods`; `GET /teaching-assignments/teachers?school_level=` trả `staff_user_id`, `staff_name`, `total_periods`, `classes`.
6. `GET /children/{id}/elective-subjects` trả `subjects` (đã chọn), `options` (môn tự chọn của khối); `PUT` nhận `subject_ids`; môn ngoài `options` trả 422.


Giao kèo nền THCS, THPT (DT-21 phần 21a, YCTD-167, BR-179):

1. `POST /subjects`, `PATCH /subjects/{id}` nhận thêm `assessment` = `score` và `option_group` (`social_science`, `natural_science`, `technology_arts` hoặc null); giá trị khác trả 400. `POST /subjects/templates` nhận cấp `THCS`, `THPT` như `TH` (chương trình mặc định `CT-THCS-2018`, `CT-THPT-2018`).
2. `POST /subject-combinations` nhận `code`, `name`, `order_no`, `subject_ids`; thiếu `subject_ids` trả 400; cấp THPT chưa bật, môn không phải môn lựa chọn đang dùng của THPT, sai số môn (4) hoặc ít hơn 2 nhóm trả 422; mã trùng 409. `PATCH` gửi `code` trả 400; đổi `subject_ids` khi đã có học sinh trả 422. Mỗi tổ hợp trả `subjects`, `student_count`.
3. `GET /children/{id}/subject-combination` trả `registration` (`combination_id`, `combination_code`, `combination_name`, `status`, `previous_combination_id`) hoặc null và `options` (tổ hợp đang dùng; rỗng nếu học sinh không học lớp THPT). `PUT` nhận `combination_id`; học sinh không học lớp THPT, tổ hợp ngừng dùng trả 422; đăng ký lần đầu `approved`, đổi sang tổ hợp khác `pending` (giữ `previous_combination_id`). `approve` đặt `approved` và thay môn tự chọn theo môn của tổ hợp; `reject` trả về tổ hợp trước; không có đề nghị chờ duyệt trả 422.
4. `POST /subject-teams` nhận `code`, `name`, `school_level` (`THCS` hoặc `THPT`), `subject_ids`; cấp khác trả 400; môn khác cấp 422; mã trùng 409. `PUT /subject-teams/{id}/members` nhận `org_unit_id`, `staff_user_id`, `role` (`head` hoặc `member`); người không có vai trò giáo viên bộ môn (VT-08) ở đơn vị trả 400; tổ trưởng mới thay tổ trưởng cũ (thành thành viên). `GET /subject-teams/{id}/loads` trả `staff_user_id`, `staff_name`, `total_periods`.

Giao kèo sổ điểm THCS, THPT (DT-21 phần 21c, YCTD-170, BR-180):

1. `GET /scores/config?school_level=` (THCS hoặc THPT, cấp khác 400) trả `config` (đã lưu hoặc mặc định). `PUT` nhận `school_level`, `config`; cấu hình sai (hệ số ngoài 1 đến 9, thiếu ba mức Tốt, Khá, Đạt, dòng cuối số lần đánh giá có giới hạn) trả 400; không có quyền quản lý 403.
2. `GET /scores/classes/{id}` trả `class`, `access` (`manage`, `homeroom`, `subject_ids`), `subjects` (`mode` là `score` hoặc `comment`, `required_regular`, `is_elective`), `terms` (`term_type`, `deadline`, `locked`), `config`; lớp không thuộc THCS, THPT trả 422; không có quyền xem 403.
3. `PUT /scores/classes/{id}/subjects/{subjectId}` nhận `term_type` (`first_term`, `second_term`) và `entries` (tối đa 200: `child_id`, `regular` tối đa 10 điểm, `mid`, `final`, `result`, `comment`); điểm ngoài 0 đến 10 hoặc quá một chữ số thập phân, môn nhận xét có điểm, môn tính điểm có `result` trả 400; không được phân công môn 403; học kỳ đã khoá hoặc quá hạn (người không quản lý) trả 422. Điểm null xoá điểm đó. Trả bảng điểm kèm `average`.
4. `GET /scores/classes/{id}/summary?term_type=` (`first_term`, `second_term`, `year`) trả `subjects`, `rows` (`subjects` điểm trung bình hoặc kết quả, `suggested`, `learning`, `conduct`, `comment`), `locked`, `can_rate`. `PUT /scores/classes/{id}/ratings` nhận `term_type`, `entries` (`child_id`, `learning`, `conduct` là `good`, `fair`, `pass`, `fail` hoặc trống, `comment`); chỉ giáo viên chủ nhiệm hoặc người quản lý (403); học kỳ đã khoá trả 422 (cả năm theo học kỳ II).
5. `POST /scores/locks` nhận `term_type`, `school_level`, `class_ids` (tuỳ chọn); trả `locked_class_count`. `GET /scores/locks?term_type=&school_level=` trả trạng thái từng lớp. `POST /scores/locks/unlock` nhận `term_type`, `class_id`, `reason` (3 đến 500 ký tự); lớp chưa khoá trả 422. `GET /scores/children/{id}` chỉ phụ huynh của con (403 nếu không), trả `terms` đã khoá và `year_rating` khi học kỳ II đã khoá.

Giao kèo học bạ, khen thưởng, lên lớp THCS, THPT (DT-21 phần 21e, YCTD-172, BR-187; dùng các điểm cuối `/learning-records` của 20e, không thêm điểm cuối):

1. Lớp THCS, THPT dùng cùng điểm cuối với Tiểu học. `GET /learning-records/classes/{id}/awards`, `/completion`, `/learning-records` trả mỗi học sinh thêm `has_result` (đã có kết quả cuối năm đã xác nhận), `needs_support` (học tập hoặc rèn luyện cả năm Chưa đạt), `year_label` ("Học tập: Tốt; rèn luyện: Tốt"; null với Tiểu học), `learning`, `conduct`; `year_result` là null với THCS, THPT.
2. `year_end_locked` là học kỳ II của lớp đã khoá điểm (sổ điểm, BR-180). Chưa khoá thì đề nghị danh hiệu cuối năm, ghi hoàn thành chương trình, lập học bạ trả 422.
3. `GET /learning-records/award-titles?school_level=THCS|THPT`, `POST /learning-records/award-titles/defaults` nạp Xuất sắc (`secondary_excellent`), Giỏi (`secondary_good`), đột xuất; `POST /award-titles` nhận thêm hai căn cứ này. `POST /classes/{id}/awards` với căn cứ Xuất sắc cần học tập, rèn luyện cả năm Tốt và ít nhất 6 môn tính điểm có điểm trung bình cả năm từ 9,0, Giỏi cần học tập, rèn luyện cả năm Tốt, không đủ trả 422; `suggested_title_ids` là danh hiệu cao nhất đủ điều kiện.
4. `PUT /classes/{id}/completion` với THCS, THPT: học sinh chưa có xếp loại cả năm trả 400; đạt (học tập, rèn luyện từ Đạt) thì `promoted`, khối cuối cấp `level_completed`; chưa đạt thì `pending_support` (kèm `support_plan` `summer_training` hoặc `retest`), kết quả `completed` thì lên lớp hoặc hoàn thành cấp, `not_completed` thì `retained`.
5. `POST /classes/{id}/learning-records/prepare` lập học bạ có khối `secondary` (`subjects`: tên, `mode`, `first`, `second`, `year`; `ratings` theo `first`, `second`, `year`); kí, tệp, mở lại, `GET /learning-records/children/{id}` như Tiểu học.

Giao kèo xét tốt nghiệp, hồ sơ thi THCS, THPT (DT-21 phần 21f, YCTD-174, BR-195; tiền tố `/graduation`, quyền xem `P02.assessment.view`, quản lý `P02.student-record.approve` toàn trường):

1. `GET|PUT /config?school_level=THCS|THPT` đọc, ghi cấu hình (hệ số, điểm đạt, điểm liệt, bài thi, tiền tố); `PUT` sai quy tắc trả 400. `GET|POST /sessions` liệt kê, tạo kỳ (một kỳ cho mỗi cấp, năm học; trùng 409); `GET /sessions/{id}` trả toàn bộ kỳ: cấu hình, môn, thí sinh (điều kiện, điểm trung bình, bài thi, điểm, kết quả), phòng, biên bản, tệp xuất, hồ sơ chuyển cấp.
2. `POST /sessions/{id}/candidates/generate` lập thí sinh từ lớp khối cuối cấp (khối 9 hoặc 12), điều kiện theo xếp loại cả năm; `PATCH /candidates/{id}` ghi ưu tiên, khuyến khích (không quá mức tối đa), bài thi (bắt buộc cộng đúng số tự chọn trong danh sách), miễn thi, điểm trung bình các lớp; `PUT /candidates/{id}/scores` ghi điểm thi; `POST /sessions/{id}/exam-numbers` đánh số báo danh.
3. `POST /sessions/{id}/rooms` thêm phòng; `POST /sessions/{id}/rooms/assign` xếp thí sinh, thiếu sức chứa trả 422.
4. `POST /sessions/{id}/evaluate` xét: THCS đủ điều kiện thì đề xuất tốt nghiệp; THPT thiếu điểm thì chưa xét. `POST /sessions/{id}/confirm` công nhận: thiếu biên bản hội đồng hoặc còn thí sinh chưa có kết quả trả 422; cấp `certificate_no` dạng `tiền tố-năm-00001`; kỳ đã công nhận không sửa được (422).
5. `POST /sessions/{id}/minutes`, `GET /minutes/{id}/file` (PDF); `GET /candidates/{id}/certificate` (PDF, chỉ khi đã công nhận); `GET /sessions/{id}/export?kind=candidates|results` (xlsx, ghi tệp đã xuất); `POST /submissions/{id}/mark-sent`.
6. `POST /sessions/{id}/transfer-dossiers` lập hồ sơ chuyển cấp cho học sinh THCS đã tốt nghiệp và có học bạ đã kí (trả `created`, `skipped`); `POST /transfer-dossiers/{id}/mark-sent`. Chỉ làm bản chạy nội bộ, nối Sở, Bộ ở bước sau.

Giao kèo thời khoá biểu (DT-20 phần 22c1, YCTD-160, BR-170):

1. `PUT /period-slots` nhận `school_level`, `slots` (`period_no`, `session`, `start_time`, `end_time`); sai giờ, trùng tiết, chồng giờ trả 400 ở `slots[n].…` hoặc `slots`.
2. `POST /timetable-versions` nhận `school_level`, `name`, `effective_from` (YYYY-MM-DD), `copy_from_id` (tùy chọn, cùng cấp); trả bản nháp. `PATCH`, `DELETE`, `PUT …/classes/{classId}/lessons`, `POST …/import` với bản đã ban hành trả 422.
3. `PUT …/classes/{classId}/lessons` nhận `lessons` (`weekday` 1 đến 7, `period_no` 1 đến 15, `subject_id`, `room_id` tùy chọn); trùng ô trả 400; môn khác cấp, phòng ngoài đơn vị trả 400; lớp khác cấp với bản trả 422. Giáo viên của tiết lấy theo phân công môn ở lớp.
4. `GET …/conflicts` trả mảng `severity` (`hard`, `soft`), `code` (`teacher_clash`, `room_clash`, `period_outside_frame`, `day_outside_week`, `subject_outside_curriculum`, `periods_mismatch`, `missing_teacher`, `teacher_not_assigned`), `message`, `class_id`, `weekday`, `period_no`. `POST …/publish` còn xung đột cứng hoặc bản trống trả 422 (`details` liệt kê xung đột).
5. `POST …/import` (tệp `file`) trả `imported`, `classes`, `errors` (`row`, `column`, `message`); có lỗi thì không ghi.
6. `GET /timetables` (nhân sự), `/timetables/mine` (giáo viên), `/children/{id}/timetable` (phụ huynh của học sinh, nhân sự) trả `versions` (bản đang áp dụng của từng cấp), `slots` (khung giờ theo cấp), `lessons`.
7. Từ YCTD-169 (DT-21 phần 21b, BR-185): mỗi tiết có `group_no` (0 là cả lớp, 1 đến 9 là nhóm học môn lựa chọn cùng tiết); `PUT …/lessons` và `POST …/check` nhận `group_no` (bỏ trống là 0), một lớp, một nhóm, một tiết chỉ một môn, nhóm ngoài 0 đến 9 trả 400; các điểm cuối xem tiết (`GET …/lessons`, `/timetables`, `/timetables/mine`) trả `group_no`; `GET /children/{id}/timetable` chỉ trả tiết cả lớp và tiết nhóm có môn nằm trong tổ hợp môn đang hiệu lực của con; `POST …/import` nhận thêm cột Nhóm (trống là cả lớp, tệp không có cột này vẫn nhận); `GET …/conflicts` thêm mã `class_group_clash` (cứng), `double_period_split`, `room_not_subject_room` (mềm); `POST /timetable-changes` với tiết học nhóm trả 422.


Giao kèo sổ đầu bài (DT-20 phần 20d, YCTD-162, BR-174):

1. `PUT /class-logs` nhận `class_id`, `lesson_date` (YYYY-MM-DD), `period_no` (1 đến 15), `lesson_title` (1 đến 300 ký tự), `content` (tối đa 2000), `comment` (tối đa 1000), `rating` (A, B, C, D hoặc rỗng), `attendance` (`child_id`, `status` là `present`, `late`, `absent_excused`, `absent_unexcused`, `note` tối đa 300; không trùng học sinh); sai trả 400; học sinh không thuộc lớp trả 400; không phải giáo viên của tiết trả 403; ngày chưa đến, lớp không có tiết, tiết đã ký, tuần đã ký trả 422. Ghi lại cùng lớp, ngày, tiết thì sửa bản đã ghi và thay toàn bộ điểm danh.
2. `POST /class-logs/{id}/sign` trả tiết đã ký; người khác trả 403; đã ký trả 422.
3. `GET /class-logs/lesson` trả `subject_name`, `teacher_name`, `log`, `week_signed`, `can_edit`, `students` (`child_id`, `full_name`, `absence_reason` khi có báo vắng của ngày, `status`, `note`); lớp không có tiết và chưa ghi trả 404. Từ YCTD-350 mỗi học sinh có thêm `status_source` (`period` tiết đã ghi, `daily` theo điểm danh đầu ngày, `absence` theo báo vắng, `default` có mặt) và `daily_status`; tiết chưa ghi lấy `status` theo điểm danh đầu ngày của lớp (có mặt, đi muộn giữ nguyên; về sớm là có mặt; nghỉ có báo là vắng có phép; nghỉ không báo là vắng không phép), ngày chưa điểm danh đầu ngày mới xét báo vắng; `note` mặc định là ghi chú của điểm danh đầu ngày.
4. `POST /class-logs/reviews` nhận `class_id`, `date` (ngày bất kỳ trong tuần), `comment`; trả 201 `review`, `lessons`, `unsigned_lessons`; tuần đã ký trả 422.
5. `GET /period-attendance/summary` (`class_id`, `from`, `to`) trả `lessons` (số tiết đã ghi) và `students` (`present`, `late`, `absent_excused`, `absent_unexcused`, `absent_days`, `notice_days`, `absent_without_notice_days`, `notice_but_present_days`, `daily_absent_days`).
6. `GET /children/{id}/period-attendance?month=YYYY-MM` (phụ huynh của học sinh, nhân sự) trả `counts` theo trạng thái và `records` (các tiết không có mặt: `lesson_date`, `period_no`, `subject_name`, `status`, `note`); phụ huynh khác trả 403.

Giao kèo thư viện (DT-22 phần 22a, YCTD-181, BR-189 đến BR-191):

1. Điểm cuối thư viện cần `P02.library.manage`, riêng tra cứu ấn phẩm, xem thiết lập, `my-loans` cần `P02.library.view` hoặc `manage`; `children/{id}/loans` kiểm tra quan hệ phụ huynh, không cần quyền. Lỗi dữ liệu trả 400; không tìm thấy trả 404; vi phạm quy tắc (thẻ khóa, vượt mức, quá hạn, bản không cho mượn, đặt trước khi còn bản, đợt kiểm kê đã đóng) trả 422 với `rule_code` YCTD-181.
2. `POST /library/titles/{id}/copies` nhận `quantity` (1 đến 500), `source`, `price`, `acquired_on`, `shelf`; trả mảng `id`, `copy_no`.
3. `POST /library/loans` nhận `reader_id`, `copy_codes` (1 đến 50, nhận mã quét có khoảng trắng, chữ thường), `class_id`, `note`; tất cả cùng thành công hoặc không bản nào; trả `reader`, `loans` (`id`, `copy_no`, `title`, `due_on`).
4. `POST /library/loans/return` nhận `copy_code` hoặc `loan_id`, `condition` (`good`, `damaged`, `lost`); trả lượt mượn kèm `fine_amount`, `overdue_days`, `reservation_for` (tên người được giữ bản).
5. `POST /library/textbooks/issue` nhận `class_id`, `set_id`; trả `issued`, `due_on`, `without_card` (tên học sinh chưa có thẻ), `shortages` (`title`, `missing`).
6. `GET /library/stocktakes/{id}` trả `expected`, `found`, `missing`, `surplus`, `damaged` (mỗi phần tử có `copy_no`, `title`, `shelf`, `condition`, `on_loan`); `POST …/resolve` nhận `copy_ids` (chỉ bản thiếu của đợt đã đóng), `action` (`lost`, `dispose`), `reason`.
7. `GET /library/reports/overview` trả `students`, `teachers`, `titles`, `copies`, `by_category`, `by_grade`, `loans`, `by_month`, `by_class`, `top_titles`, `top_readers`, `indicators` (`code`, `value`, `threshold`, `passed` là true, false hoặc null).


Giao kèo máy xếp thời khoá biểu (DT-20 phần 22c2, YCTD-164, BR-178):

1. `PUT /timetable-generator/settings` nhận `school_level`, `weights` (`double_period`, `avoid_last_period`, `spread_week`, `teacher_gaps`, `class_gaps`, số nguyên 0 đến 10), `time_limit_seconds` (5 đến 600), `variant_count` (1 đến 5); sai trả 400. `PUT …/subject-rules` nhận `school_level`, `rules` (`subject_id`, `double_period`, `avoid_last_period`, `max_per_day` 1 đến 10 hoặc trống, `room_id`); môn khác cấp trả 400. `PUT …/teacher-busy/{teacherUserId}` nhận `slots` (`weekday`, `period_no`); giáo viên chưa phân công trả 404.
2. `POST /timetable-generations` nhận `school_level` (và tùy chọn `weights`, `time_limit_seconds`, `variant_count` thay cài đặt đã lưu); trả lần xếp trạng thái `queued` (201). Cấp còn lần xếp chưa xong hoặc không có tiết nào cần xếp trả 422.
3. `GET /timetable-generations/{id}` trả `status`, `percent`, `best_score`, `best_hard`, `message`, `issues` (`code`: `class_capacity`, `teacher_capacity`, `room_capacity`, `no_periods`, `missing_teacher`; `severity`; `message`), `variants` (`variant_no`, `score`, `hard_count`, `soft` gồm `code`, `label`, `penalty`, `weight`; `violations` tối đa 100 dòng gồm `code` `teacher_clash`, `room_clash`, `teacher_unavailable`, `unplaced` và `message`; `violation_count`; `version_id`). `POST …/variants/{no}/apply` nhận `name`, `effective_from`; trả bản nháp nguồn `generator`.
4. `POST /timetable-versions/{id}/classes/{classId}/check` nhận `lessons` như `PUT …/lessons`; trả mảng xung đột như `GET …/conflicts`, không ghi. `GET …/conflicts` thêm mã mềm `teacher_busy`.
5. `POST /timetable-changes` nhận `kind` (`substitute` kèm `teacher_user_id`; `swap` kèm `target_date`, `target_period_no`), `date`, `class_id`, `period_no`, `reason` (tối đa 500 ký tự); tiết không có trong bản đang áp dụng, tiết đã có thay đổi, giáo viên đang có tiết khác cùng lúc trả 422; trả các dòng đã ghi (201). `GET /timetable-changes/day` nhận `date`, `class_id` hoặc `teacher_user_id`; trả tiết kèm `change` (`kind`, `reason`, `original_subject_name`, `original_teacher_user_id`, `original_teacher_name`).
6. `GET /timetable-reports/teaching` nhận `from`, `to` (tối đa 92 ngày) trả `days`, `teachers` (`planned`, `substitute_taught`, `substituted_away`, `swapped`, `actual`); `GET /timetable-reports/rooms` nhận `date` trả `slot_count`, `rooms` (`periods`, `usage_percent`, `by_weekday`, `classes`).
7. `POST /timetable-lookup-codes` nhận `kind` (`class`, `teacher`), `target_id`; đã có mã còn hiệu lực thì trả mã đó. `GET /public/timetable-lookup/{code}` không cần đăng nhập, trả `kind`, `target_name`, `versions`, `slots`, `lessons`, `changes`; mã sai hoặc đã thu hồi trả 404.


Giao kèo kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168, BR-184):

1. `POST, PUT /questions` nhận `school_level` (TH, THCS, THPT), `subject_id`, `grade_level_code`, `topic_id`, `cognitive_level`, `question_type`, `content`, `options` (mảng chữ), `answer` (mảng: khoá đúng; Đ, S từng ý; đáp số), `guidance`, `score` (0 đến 10); sai dạng trả 400; môn, khối khác cấp, chủ đề khác môn trả 400; sửa câu không được phép trả 403.
2. `POST /questions/{id}/review`, `/assessment-plans/{id}/decide`, `/exams/{id}/review` nhận `decision` (`approve`, `return`) và `note` (bắt buộc khi trả lại); sai trạng thái trả 422 mã YCTD-168.
3. `POST /questions/import?school_level=` (tệp `file`) trả `imported`, `errors` (`row`, `column`, `message`); có lỗi thì không ghi.
4. `POST, PUT /exam-matrices` nhận `school_level`, `subject_id`, `grade_level_code`, `name`, `total_score`, `target_ratios` (bốn mức, tổng 100), `tolerance`, `rows`; trả ma trận kèm `summary` (`count`, `score`, `ratios`) và `issues` (`total_score`, `ratio`, `empty`).
5. `POST /exams` (`P02.exam.manage`) nhận `plan_id` (kế hoạch đã duyệt; môn, khối, thời gian lấy theo kế hoạch) hoặc `school_level`, `subject_id`, `grade_level_code`; `title`, `matrix_id`, `variant_count`, `avoid_recent_days`, `author_user_id`, `reviewer_user_id`, `due_date`. Người không được giao gọi `GET /exams/{id}`, `/export` trả 403.
6. `POST /exams/{id}/generate` thiếu câu trả 422 kèm `details` từng dòng thiếu; ma trận chưa hợp lệ trả 422. `/submit` khi chưa trộn mã đề trả 422. Đề đã gửi, đã khoá không sửa (422).


Giao kèo hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182, BR-186; danh mục ở cơ sở dữ liệu hệ thống, còn lại ở năm học hiện hành):

1. `POST /training/courses` nhận `name`, `topic_id` (tùy chọn, có trong danh mục), `organizer_kind` (`school`, `external`), `organizer_name`, `mode`, `location`, `start_date`, `end_date`, `periods` (1 đến 1000), `sessions`, `quota`, `registration_deadline`, `issues_certificate` (chỉ khoá `school`); sai trả 400. `PATCH` chỉ có `status` thì đổi trạng thái.
2. `POST …/registrations` nhận `note`; khoá không mở, quá hạn, hết chỉ tiêu, chưa có hồ sơ cán bộ trả 422; đã đăng ký trả 409. `POST …/review` nhận `decision` (`approve`, `reject`), `note`; tổ trưởng chỉ đăng ký `pending` của tổ mình, người khác trả 403. `…/cancel` chỉ người đăng ký, chỉ đăng ký đang chờ.
3. `PUT …/results` nhận `results` (`registration_id`, `attended_sessions`, `result`, `credited_periods`, `comment`); đăng ký chưa duyệt, số buổi, số tiết quá khoá trả 400. `POST …/certificates` trả 201 `issued`, `certificates` (`id`, `lookup_code`); khoá không cấp chứng nhận hoặc không còn người đạt chưa cấp trả 422.
4. `POST /training/certificates/{id}/revoke` nhận `reason` (bắt buộc); `/reissue` trả bản mới mã mới; chứng nhận do trường cấp không xoá (422). `GET …/pdf` chỉ người được cấp hoặc Ban Giám hiệu (người khác 404).
5. `GET /public/training-certificates/verify?code=` trả `code`, `staff_name`, `certificate_name`, `course_name`, `issued_by`, `issued_date`, `periods`, `status` (`valid`, `revoked`); mã sai dạng 400, không thấy 404, quá 60 lần mỗi phút 429.
6. `GET /training/mine` trả `required_periods`, `total_periods`, `missing_periods`, `registrations`, `certificates` (kèm `expiring_soon`), `competency_gaps`. `GET /training/records` (`department_id` tùy chọn) trả `rows`, `departments`, `plan`.
7. `PUT /training/competency/mine` nhận `term`, `scores` (`domain_code`, `level`) đủ mọi miền đang dùng; kỳ đã xác nhận trả 422. `POST /training/competency/{id}/confirm` nhận `scores` (`domain_code`, `level`, `reason`); đổi mức không có lý do trả 400.


Giao kèo kiểm tra, đánh giá phần chấm (DT-21 phần 22g2, YCTD-173, BR-188):

1. `POST /exam-grading/sessions` nhận `exam_id` (đề đã khoá, đã trộn mã), `class_id` (cùng cấp, khối), `term_type`, `score_kind`, `score_seq` (1 đến 10, chỉ dùng với `regular`), `true_false_rule`, `double_marking`, `mark_tolerance` (0 đến 10), `absent_policy`; sai dạng, lớp khác khối trả 400; đề chưa khoá, lớp đã có bài của đề trả 422 mã YCTD-173; không dạy môn của lớp trả 403.
2. `PUT /sheets/{childId}`: `answers` là đối tượng số câu → mảng lựa chọn; `essay` là đối tượng mã câu → `first`, `second`; mã đề sai, điểm tự luận ngoài 0 đến điểm câu trả 400; bài kiểm tra đã khoá trả 422.
3. `POST /import` (tệp `file`, cột Mã hệ thống, Họ và tên, Mã đề, Vắng, Câu 1 đến Câu n) trả `imported`, `errors` (`row`, `column`, `message`); có lỗi thì không ghi.
4. `POST /lock` (`P02.exam.manage`) còn học sinh chưa có bài, thiếu điểm tự luận, cần xem lại trả 422 kèm tên học sinh. `/transfer` khi chưa khoá hoặc đã chuyển trả 422; quyền, khoá, hạn theo sổ điểm 21c (403, 422 mã YCTD-170).


Giao kèo kho học liệu số (DT-22 phần 22h1, YCTD-183, BR-196; học liệu, phiên bản, bộ sưu tập, danh mục ở cơ sở dữ liệu hệ thống, sự kiện, báo lỗi, lượt ở năm học hiện hành):

1. `POST /learning-resources` nhận `title` (1 đến 300 ký tự), `type_id`, `school_level` (`MN`, `TH`, `THCS`, `THPT`), `grade_level_code`, `subject_code` (có trong môn của năm học), `topic_id`, `week_no` (1 đến 60), `keywords` (tối đa 30, mỗi từ 50 ký tự), `author_name`, `language`, `duration_minutes`, `license_id`, `license_source`, `origin`, `responsible_name`, `license_expires_on`, `visibility` (`private`, `unit`, `school`; `network` trả 400 "chưa bật"); trả học liệu nháp.
2. `POST …/files` (tệp `file`, tối đa 50 MB; sai định dạng 400), `…/links` (`url` http, https), `…/lesson-plans` (`lesson_plan_id` của chính người sở hữu); chỉ người sở hữu (403), học liệu đang chờ duyệt, ẩn, ngừng dùng trả 422; trả phiên bản mới.
3. `POST …/submit` trả học liệu `pending_unit` (hoặc `pending_school` khi người sở hữu không thuộc tổ) kèm `needs_school_review`; thiếu phiên bản, phạm vi cá nhân, thiếu hoặc bị chặn hoặc không rõ giấy phép, có xin phép thiếu nơi cấp trả 422.
4. `POST …/review` nhận `decision` (`approve`, `return`), `note` (bắt buộc khi trả lại); không phải người duyệt của bước trả 403; duyệt bước tổ của học liệu rủi ro chuyển `pending_school`, còn lại công bố (`published_version` là phiên bản hiện tại).
5. `GET /learning-resources/{id}` trả `resource`, `versions` (người khác chỉ thấy bản đã công bố), `events` (chỉ người sở hữu, người duyệt, thủ kho), `views`, `downloads`; học liệu không thấy được trả 404.
6. `PUT /collections/{id}/items` nhận `resource_ids` theo thứ tự (không trùng, tối đa 500, chỉ học liệu người lập thấy được; sai trả 400; người khác sửa trả 403).
7. `POST /learning-resources/{id}/reports` nhận `kind` (`content`, `file`, `copyright`), `description`; `POST /learning-resources/reports/{id}/handle` nhận `status` (`resolved`, `rejected`), `response` (bắt buộc), `hide` (ẩn tạm học liệu); báo lỗi đã xử lý trả 422.


Giao kèo kho học liệu, câu hỏi và chia sẻ (DT-22 phần 22h2, YCTD-184, BR-197):

1. `GET /resource-sharing/bank` không tạo, không sửa câu hỏi; câu, đề người dùng không thấy theo 22g1 thì không có trong kết quả. Bộ lọc sai trả 400.
2. `PUT /collections/{id}/items`: chỉ người lập (403); mục trùng, quá 500, không tồn tại hoặc không xem được trả 400.
3. `POST, PUT /rubrics` nhận `name`, `description`, `school_level`, `subject_id`, `grade_level_code`, `question_id` (câu tự luận), `visibility`, `levels` (2 đến 6, điểm tăng dần), `criteria` (1 đến 20: `name`, `weight`, `descriptors` đủ số mức); sai trả 400; sửa rubric của người khác trả 403.
4. Gói: tệp gzip chứa JSON `format` = `school-management.resource-package/1`, `package_code`, `source_school`, `created_at`, `items` (metadata, `license_code`, `kind` `file` có `file_name`, `sha256`, `data` base64, hoặc `link` có `url`). Tệp không đọc được, sai định dạng trả 400; học liệu lỗi được bỏ qua kèm lý do. Không có quyền chia sẻ trả 403; bộ sưu tập không có học liệu xuất được trả 422 mã YCTD-184.


Giao kèo kế hoạch giáo dục (DT-18 phần 22i, YCTD-147, BR-142):

1. `POST /education-plan-templates`, `PUT /{id}` nhận `code`, `name`, `description`, `school_level`, `scope`, `period`, `sections` (1 đến 30 mục, mã chữ thường, số, gạch dưới; mục bảng 1 đến 10 cột), `approval_steps` (sắp lại theo thứ tự cố định), `requires_signing`, `archive_folder_id`, `sort_order`, `status`; `POST /defaults` nhận `school_level`, trả `created`, `skipped`, `kind` (`project`: bảy mẫu Mầm non; `frame`: sáu khung rỗng của TH, THCS, THPT, YCTD-345); cấp chưa bật trả 422 (`YCTD-152`), cả khi tạo mẫu hoặc đổi mẫu sang cấp chưa bật; `DELETE` mẫu đã có kế hoạch trả 422.
2. `POST /education-plans` nhận `template_id`, `title`, `period_label`, `period_start`, `period_end`, `class_id` (kế hoạch nhóm lớp), `department_id` hoặc `work_group_id` (kế hoạch tổ, nhóm), `org_unit_id` (kế hoạch của trường); `PUT /{id}` nhận `title`, kì, `content` (theo mã mục: chuỗi hoặc mảng dòng; ô ngày YYYY-MM-DD, lỗi trả `content.{mục}.{dòng}.{cột}`).
3. `POST /{id}/submit`, `/approve` (`note` tùy chọn), `/return` (`note` bắt buộc), `/withdraw` trả chi tiết kế hoạch có `status`, `current_step`, `actions`; sai bước, sai người trả 422 `YCTD-147`.
4. `GET /{id}/diff?from=source|{số phiên bản}&to={số phiên bản}` trả `from_label`, `to_label`, `changed`, `sections` (`state` same, changed, added, removed; `lines` op same, added, removed). `GET /{id}/export?format=docx|pdf`; `GET /{id}/signed-file`.
5. `GET /previous-year` trả `year_name`, `plans`; `POST /copy` nhận `source_id`, `title`, `class_id`, kì. `GET /progress` trả `totals`, `by_step`, `by_template`, `by_department`, `waiting`; `/progress/export?format=xlsx`. `POST /{id}/work-plan` trả `work_plan_id`, `items`.
6. `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm năm khóa lưới: `education-plans`, `education-plan-review`, `education-plan-templates`, `education-plan-progress`, `education-plan-previous`. `GET /my-work` có nguồn `education_plans`.


Giao kèo hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e, YCTD-142, BR-140; máy chủ API, dữ liệu hồ sơ ở cơ sở dữ liệu năm học hiện hành):

1. `GET /professional-records/overview` trả `locked`, `has_staff`, `can_use`, `can_review`, `can_approve`, `can_manage`, `signer_description`, `my_groups` (tổ chuyên môn của mình, nhóm công tác kèm `leader`). `PUT /professional-records/lock` (`locked`) cần `P09.professional-record.manage` toàn trường. `GET /professional-records/options` (đơn vị, tổ, nhân sự) và `GET /professional-records/statistics` (`round_id`; `rounds`, `departments`, `totals`) cần `.manage` hoặc `.approve`.
2. `GET /professional-folders` (`branch`, `include_inactive`); `POST`, `PUT /professional-folders/{id}` (`parent_id`, `branch` không đổi sau khi tạo, `name`, `description`, `school_level`, `approval_flow`, `requires_signing`, `sort_order`, `status`), `DELETE` (thư mục trống) và `POST /professional-folders/defaults` (`school_level`; trả `created`, `skipped`) cần `.manage`.
3. `GET /professional-work-groups`; `POST`, `PUT /professional-work-groups/{id}` (`org_unit_id`, `name`, `description`, `status`, `members` gồm `staff_id`, `is_leader`) cần `.manage` trong đơn vị.
4. `GET /professional-rounds` (`status` `open`, `closed`, `all`) trả kèm `expected`, `on_time`, `late`, `missing`, `my_state`, `my_document_id`, `overdue`. `POST`, `PUT /professional-rounds/{id}` (`folder_id`, `title`, `description`, `submitter_kind`, `org_unit_id`, `department_ids`, `opens_on`, `due_at` dạng `YYYY-MM-DDTHH:mm` giờ Việt Nam hoặc ISO), `/close`, `/reopen`, `/remind` (trả `reminded`) cần `.manage`. `GET /professional-rounds/{id}/status` trả `submitters` (`state` `on_time`, `late`, `draft`, `missing`) cho tổ trưởng (tổ mình), Ban Giám hiệu, người quản lý.
5. `GET /professional-documents` (`view` `mine`, `groups`, `school`, `review`; `all`, `processed`, `folder_id`, `round_id`, `status`, `q`); `POST` (`folder_id`, `round_id`, `title`, `description`, `department_id`, `work_group_id`); `GET`, `PUT`, `DELETE /professional-documents/{id}` (chi tiết kèm `versions`, `events`, `actions`). `POST /{id}/versions` (multipart `file`, `note`); `GET /{id}/versions/{versionId}/file`, `/signed-file`. `POST /{id}/submit`, `/withdraw`, `/leader-approve`, `/approve` (`note`), `/return` (`note` bắt buộc). Sai luồng, khóa năm học, thiếu chứng thư trả `ERR_RULE_VIOLATION` mã YCTD-142; ngoài phạm vi trả `ERR_FORBIDDEN`.
6. `GET /my-work` (`source`, `state` `overdue` hoặc `due_soon`, `q`) cho mọi tài khoản: `items` (`source`, `kind`, `title`, `detail`, `link`, `deadline`, `overdue`, `due_soon`, `received_at`), `count` (`total`, `overdue`, `by_source`), `failed_sources`. `GET /my-work/count` trả `count`.
7. `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm tám khóa lưới: `my-work`, `professional-documents`, `professional-review`, `professional-rounds`, `professional-round-status`, `professional-statistics`, `professional-folders`, `professional-work-groups`.

Giao kèo văn bản đi theo VNPT iOffice (DT-18 phần 18b, YCTD-140, BR-136; máy chủ API, dữ liệu ở cơ sở dữ liệu hệ thống):

1. Quyền: mọi điểm cuối cần một trong bốn quyền `P09.outgoing-document.*`; tạo dự thảo cần `draft`; `next-number`, `recipients`, `issue`, `send`, `publish`, `freeze` cần `issue` ở phạm vi toàn trường; tra cứu (`view=search`) cần `search` hoặc `issue`. Văn bản xem được: người tạo, người soạn, người ký, người được lấy ý kiến; văn thư xem văn bản đã ký, đã ban hành; người tra cứu xem từ khi trình ký. Văn bản không xem được trả `ERR_NOT_FOUND`; thao tác không được làm trả `ERR_RULE_VIOLATION` mã `YCTD-140`.
2. Văn bản nhận `summary` (bắt buộc, tối đa 2000), `submission_number` (50), `form_id`, `urgency_id`, `secrecy_id`, `field_id` (đúng loại danh mục), `document_kind`, `priority`, `meeting_at` (ngày giờ ISO), `meeting_place`, `insert_qr` (mặc định `true`), `drafter_id` (nhân sự có tài khoản; trống là người tạo), `drafting_unit_id` (đơn vị năm học), `signer_id` (trong danh sách lãnh đạo nhận văn bản), `content_note`, `reply_to_id` (văn bản đến); `recipients` (tối đa 200, mỗi dòng đúng một trong `external_unit_id`, `org_unit_id`, không trùng) và `links` (tối đa 50, `link_type` `related` hoặc `original`, đúng một trong `outgoing_id`, `incoming_id`) thay toàn bộ khi gửi, giữ nguyên khi bỏ trống.
3. `consult` nhận `user_ids` (1 đến 100), `deadline` (không trước hôm nay), `note`; `opinion` nhận `opinion` (bắt buộc khi không kết thúc), `finish`; `submit` nhận `signer_id`, `note`; `decline`, `return` cần `note`. `sign` lập bản đã ký qua `DossierSigner`; nội dung mã QR là `<nguồn của cổng>/tra-cuu-van-ban?ma=<mã>` lấy theo tiêu đề `Origin` của yêu cầu (không ghi cứng tên miền), không có nguồn hợp lệ thì chỉ in mã.
4. `issue` nhận `book_id` (sổ chiều đi), `issue_number` (trống là số kế tiếp), `symbol_suffix` (tối đa 80, không có "/"), `issue_date`, `copies` (1 đến 9999, mặc định 1), `recipients` (thay đơn vị nhận nếu gửi); trùng số trả `ERR_CONFLICT`. `send` nhận `recipient_ids` (đơn vị bên ngoài của văn bản), `sent` (mặc định `true`), `reference`; gọi `DocumentExchange.send` (bản nội bộ không truyền). `publish` nhận `published`; `freeze` nhận `frozen`. `archive` nhận `ids`, `archive_record_id`, trả mỗi văn bản `id`, `ok`, `message`.
5. Tệp: PDF, JPEG, PNG, Word, Excel theo chữ ký tệp, tối đa 50 MB, 30 tệp; `kind` `draft` (mặc định), `submission`, `attachment`; bản đã ký (`signed`) chỉ do máy chủ lập. Khóa kho tệp tạo qua `storageKey`.
6. `GET /public/outgoing-documents/verify?code=` (giới hạn số lần theo địa chỉ như các trang công khai) trả `code`, `school_name`, `issued`, `symbol`, `issue_date`, `summary` (chỉ văn bản đã ban hành không mật), `signer_name`, `signer_title`, `signed_at`, `internal_signature`, `signed_sha256`, `signed_size_bytes`; mã sai dạng trả `ERR_VALIDATION`, không có trả `ERR_NOT_FOUND`.
7. Thông báo trong ứng dụng (mẫu `outgoing_document`): người được lấy ý kiến, người ký khi trình, người soạn khi có ý kiến, ký, không ký, trả lại, ban hành. `GET /document-books?direction=outgoing` đếm văn bản đi và số đi kế tiếp; xóa sổ đã có văn bản đi bị chặn.

## 13. Y tế học đường

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/children/{id}/health-profile | Hồ sơ sức khỏe của trẻ |
| PUT | /api/v1/children/{id}/health-profile | Cập nhật hồ sơ sức khỏe |
| GET, POST | /api/v1/children/{id}/health-measurements | Chỉ số sức khỏe theo lần đo |
| GET, POST | /api/v1/medicines | Danh mục thuốc theo đơn vị; tạo thuốc kèm tồn đầu (YCTD-75) |
| PATCH | /api/v1/medicines/{id} | Sửa tên, hoạt chất, đơn vị tính, nhà thuốc, trạng thái; không sửa tồn |
| GET, POST | /api/v1/pharmacies | Nhà thuốc theo đơn vị |
| PATCH | /api/v1/pharmacies/{id} | Sửa nhà thuốc |
| GET, POST | /api/v1/medication-requests | Danh sách và gửi yêu cầu dặn thuốc |
| GET | /api/v1/medication-requests/{id} | Chi tiết yêu cầu kèm các liều đã ghi và `can_administer` |
| POST | /api/v1/medication-requests/{id}/receive | Xác nhận đã nhận thuốc |
| POST | /api/v1/medication-requests/{id}/reject | Từ chối nhận thuốc kèm lý do |
| POST | /api/v1/medication-requests/{id}/complete | Kết thúc sớm yêu cầu đã nhận thuốc hoặc đang cho uống |
| GET | /api/v1/medication-schedules | Danh sách trẻ cần cho uống thuốc theo khung giờ của một ngày |
| POST | /api/v1/medication-administrations | Ghi nhận một lần cho uống thuốc hoặc bỏ liều; giáo viên chủ nhiệm chỉ gọi được khi đơn vị bật cấu hình không có nhân viên y tế |
| POST | /api/v1/medication-administrations/{id}/acknowledge | Phụ huynh xác nhận đã biết thông báo bỏ liều (YCTD-25) |
| GET, POST | /api/v1/medicine-purchase-requests | Đề nghị mua thuốc |
| POST | /api/v1/medicine-purchase-requests/{id}/approve | Duyệt đề nghị mua thuốc theo hạn mức |
| POST | /api/v1/medicine-purchase-requests/{id}/reject | Từ chối đề nghị mua thuốc kèm lý do |
| GET, POST | /api/v1/medicine-purchase-orders | Phiếu mua thuốc và thuốc đã mua |
| GET, POST | /api/v1/medicine-issues | Phiếu cấp thuốc từ tủ thuốc |
| GET, POST | /api/v1/health-check-campaigns | Đợt khám sức khỏe |
| POST | /api/v1/health-check-campaigns/{id}/close | Đóng đợt khám (YCTD-74) |
| GET | /api/v1/health-check-campaigns/{id}/results | Kết quả khám của trẻ đang học trong đơn vị của đợt, lọc theo lớp, kèm đánh giá |
| POST | /api/v1/health-check-campaigns/{id}/publish-results | Công bố kết quả chưa công bố, báo phụ huynh |
| GET | /api/v1/children/{id}/health | Tổng hợp sức khỏe của trẻ: hồ sơ, chỉ số, kết quả khám đã công bố, sự kiện y tế, chăm sóc 30 ngày |
| POST | /api/v1/daily-care-logs | Ghi chăm sóc hằng ngày |
| GET | /api/v1/children/{id}/daily-care-logs | Chăm sóc hằng ngày của trẻ theo khoảng ngày |
| GET, POST | /api/v1/health-report-requests | Yêu cầu báo cáo sức khỏe |
| POST | /api/v1/health-report-requests/{id}/send | Y tế tổng hợp và gửi báo cáo |
| DELETE | /api/v1/health-standards/{id} | Xóa tiêu chuẩn sức khỏe |
| PUT | /api/v1/health-check-campaigns/{id}/results | Ghi kết quả khám cho từng trẻ |
| GET, POST | /api/v1/medical-events | Sự kiện y tế tại trường |
| POST | /api/v1/medical-events/{id}/acknowledge | Phụ huynh xác nhận đã biết sự kiện y tế (YCTD-25) |
| GET, POST | /api/v1/children/{id}/daily-care-logs | Nhật ký chăm sóc hằng ngày của trẻ (P10-12) |
| GET, POST | /api/v1/health-check-schedules | Lịch khám sức khỏe |
| GET, POST | /api/v1/health-standards | Tiêu chuẩn sức khỏe |
| GET, POST | /api/v1/growth-rounds | Đợt cân đo của đơn vị (`org_unit_id` bắt buộc) kèm số số đo, `can_manage`; lập đợt (P10-13, YCTD-105) |
| DELETE | /api/v1/growth-rounds/{id} | Xóa đợt chưa có số đo (BR-100) |
| GET, PUT | /api/v1/growth-rounds/{id}/measurements | Bảng nhập của một lớp (`class_id`) kèm tháng tuổi, BMI, chỉ số Z, kênh, `can_edit`; Tính và lưu số đo cả lớp (YCTD-105) |
| GET | /api/v1/growth-rounds/{id}/template | Tệp mẫu Excel của lớp (`class_id`) (YCTD-105) |
| POST | /api/v1/growth-rounds/{id}/import | Nhập số đo từ Excel, trả số dòng đã lưu và lỗi từng dòng (BR-100) |
| GET, PUT | /api/v1/student-health | Bảng thông tin sức khỏe của lớp (`class_id`) theo học kỳ (`term`) kèm số đo 4.3 gần nhất, `can_edit`; ghi nhiều học sinh (P10-15, BR-123, YCTD-125) |
| POST | /api/v1/student-health/pull-growth | "Lấy dữ liệu từ 4.3": chép số đo gần nhất của các đợt cân đo trong học kỳ cho lớp (YCTD-125) |
| GET | /api/v1/student-health/export | Xuất Excel bảng của lớp theo học kỳ, ghi nhật ký xuất (BR-74, YCTD-125) |
| GET | /api/v1/children/{id}/growth | Biểu đồ tăng trưởng: các lần đo kèm kết quả, đường chuẩn WHO (BR-101) |

## 14. Xe đưa đón (đã bỏ)

Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62). Mọi điểm cuối của nhóm này đã gỡ.

## 15. Bếp, kho và mua hàng

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/ingredients | Danh sách nguyên liệu của đơn vị và thêm nguyên liệu |
| PATCH | /api/v1/ingredients/{id} | Sửa tên, đơn vị tính, ngừng hoặc dùng lại nguyên liệu |
| GET, POST | /api/v1/dishes | Món ăn của đơn vị kèm định lượng; thêm món (có thể kèm định lượng) |
| PATCH | /api/v1/dishes/{id} | Sửa món, ngừng hoặc dùng lại |
| PUT | /api/v1/dishes/{id}/norms | Thay toàn bộ định lượng trên một suất của món |
| GET, POST | /api/v1/food-suppliers | Nhà cung cấp thực phẩm của đơn vị |
| PATCH | /api/v1/food-suppliers/{id} | Sửa, ngừng hoặc dùng lại nhà cung cấp thực phẩm |
| GET, POST | /api/v1/menus | Thực đơn tuần của đơn vị (lọc `week_start_date`, từ YCTD-125 thêm `month`); lập thực đơn nháp (từ YCTD-125 nhận tên, tháng, tuần, từ ngày, đến ngày, khối áp dụng) |
| GET | /api/v1/menus/{id} | Chi tiết thực đơn kèm món |
| PUT | /api/v1/menus/{id} | "Thay đổi" thông tin chung của thực đơn nháp (P12-10, BR-123, YCTD-125) |
| GET | /api/v1/menu-imports/templates/menus/columns | Cột của mẫu nhập thực đơn, cờ `locked` (YCTD-125) |
| GET | /api/v1/menu-imports/catalogs/menus | Tra cứu danh mục khối, bữa, thứ, món ăn của đơn vị (`org_unit_id`) (YCTD-125) |
| GET | /api/v1/menu-imports/templates/menus | Tệp mẫu nhập thực đơn kèm trang Danh mục (YCTD-125) |
| POST | /api/v1/menu-imports | Tải tệp Excel thực đơn lên, kiểm tra cả tệp (YCTD-125) |
| POST | /api/v1/menu-imports/{id}/commit | Ghi các thực đơn đọc được thành thực đơn nháp (YCTD-125) |
| GET | /api/v1/menu-imports/{id}/error-file | Tệp lỗi: tệp gốc kèm cột Nội dung lỗi (YCTD-125) |
| PUT | /api/v1/menus/{id}/items | Thay toàn bộ món của thực đơn nháp |
| POST | /api/v1/menus/{id}/submit | Bếp trình duyệt thực đơn |
| POST | /api/v1/menus/{id}/approve | Duyệt và công bố thực đơn |
| POST | /api/v1/menus/{id}/reject | Trả lại thực đơn kèm lý do |
| GET | /api/v1/menus/{id}/norms | Định lượng nguyên liệu của thực đơn trong một ngày theo số suất |
| GET | /api/v1/children/{id}/menus | Thực đơn đã công bố và buffet đã duyệt của tuần cho phụ huynh của trẻ |
| GET | /api/v1/meal-plans | Số suất ăn theo ngày của đơn vị theo từng lớp |
| POST | /api/v1/meal-plans/compute | Tính và lưu số suất ăn của ngày |
| GET | /api/v1/kitchen/daily-norms | Định lượng nguyên liệu của ngày cho cả đơn vị |
| GET | /api/v1/kitchen/meal-counts | Suất ăn theo lớp, khối, đơn vị cho ngày hoặc tuần; hôm nay cộng trẻ chưa điểm danh chưa báo vắng (YCTD-103) |
| GET, POST | /api/v1/classes/{id}/meal-report | Xem và gửi báo cơm của lớp |
| GET, POST | /api/v1/buffet-events | Tiệc buffet theo dịp |
| POST | /api/v1/buffet-events/{id}/approve | Duyệt buffet |
| POST | /api/v1/buffet-events/{id}/cancel | Hủy buffet |
| GET, POST | /api/v1/market-purchases | Phiếu đi chợ của đơn vị; lập phiếu nháp |
| GET | /api/v1/market-purchases/{id} | Chi tiết phiếu đi chợ kèm chênh lệch với định lượng |
| POST | /api/v1/market-purchases/{id}/receive | Xác nhận nhập nguyên liệu, chuyển đề nghị thanh toán |
| POST | /api/v1/market-purchases/{id}/cancel | Hủy phiếu nháp |
| POST | /api/v1/market-purchases/{id}/link-payment | Kế toán gắn phiếu chi đã phát hành |
| POST, GET | /api/v1/food-safety/files, /food-safety/files/{id} | Tải lên, tải về tệp quét giấy tờ, chứng từ (P12-11, P12-12, YCTD-146) |
| GET, POST, PATCH | /api/v1/food-supplier-certificates, /food-supplier-certificates/{id}; GET /food-suppliers/safety-summary | Giấy tờ an toàn thực phẩm của nhà cung cấp, tổng hợp theo nhà cung cấp (P12-12) |
| GET, POST, PATCH | /api/v1/food-lots, /food-lots/{id}; POST /food-lots/{id}/close | Lô hàng nhập, đóng lô (P12-11) |
| GET, POST, PUT | /api/v1/food-inspections, /food-inspections/day, /food-inspections/{id}; POST /food-inspections/{id}/confirm | Phiếu kiểm thực ba bước (P12-13) |
| GET, POST | /api/v1/food-samples, /food-samples/suggestions, /food-samples/destroy, /food-samples/{id}/hold, /food-samples/{id}/release | Lưu, hủy, giữ mẫu thức ăn (P12-14) |
| GET, POST | /api/v1/food-safety/trace; POST /food-safety/books | Truy xuất nguồn gốc; sổ kiểm thực, sổ lưu mẫu, nhãn mẫu (P12-15, P12-13, P12-14) |
| GET | /api/v1/reports/meals | Báo cáo ăn và bếp: đối chiếu suất ăn với điểm danh đã chốt, chi phí đi chợ |
| GET, POST | /api/v1/assets | Danh sách (lọc đơn vị, trạng thái, mã hoặc tên) và thêm tài sản |
| GET, PUT | /api/v1/assets/{id} | Chi tiết tài sản kèm lịch sử cấp phát, mượn, hỏng mất; sửa thông tin hoặc thanh lý |
| POST | /api/v1/asset-assignments | Cấp phát tài sản |
| POST | /api/v1/asset-assignments/{id}/return | Thu hồi tài sản đã cấp phát |
| GET, POST | /api/v1/asset-loans | Danh sách phiếu mượn (đang mượn, quá hạn, đã trả) và cho mượn |
| POST | /api/v1/asset-loans/{id}/return | Nhận trả tài sản mượn |
| GET, POST | /api/v1/asset-damages | Danh sách và ghi nhận hỏng hoặc mất |
| POST | /api/v1/asset-damages/{id}/approve | Ban Giám hiệu duyệt xử lý hỏng mất |
| POST | /api/v1/asset-damages/{id}/reject | Từ chối xử lý hỏng mất kèm lý do |
| GET, POST | /api/v1/stock-items | Mặt hàng trong kho kèm tồn hiện tại |
| PUT | /api/v1/stock-items/{id} | Sửa mặt hàng |
| GET, POST | /api/v1/stock-transactions | Sổ kho; ghi phiếu nhập hoặc phiếu xuất |
| POST | /api/v1/stock-opening-balances | Nhập tồn kho ban đầu |
| GET, POST | /api/v1/stock-counts | Danh sách và lập biên bản kiểm kê |
| GET | /api/v1/stock-counts/{id} | Chi tiết biên bản kiểm kê |
| POST | /api/v1/stock-counts/{id}/approve | Kế toán trưởng duyệt biên bản có chênh lệch, điều chỉnh tồn |
| POST | /api/v1/stock-counts/{id}/reject | Từ chối biên bản kiểm kê kèm lý do |
| GET, POST | /api/v1/purchase-requests | Đề nghị của tôi, chờ duyệt, đã duyệt; lập đề nghị mua hàng |
| GET | /api/v1/purchase-requests/{id} | Chi tiết đề nghị |
| POST | /api/v1/purchase-requests/{id}/approve | Duyệt đề nghị mua hàng theo hạn mức |
| POST | /api/v1/purchase-requests/{id}/reject | Từ chối đề nghị mua hàng kèm lý do |
| GET, POST | /api/v1/purchase-orders | Danh sách và lập phiếu mua hàng từ đề nghị đã duyệt |
| GET | /api/v1/purchase-orders/{id} | Chi tiết phiếu mua hàng |
| POST | /api/v1/purchase-orders/{id}/receive | Nhận hàng vào kho |
| POST | /api/v1/purchase-orders/{id}/payment | Gắn phiếu chi đã phát hành, đánh dấu đã thanh toán |
| GET | /api/v1/facilities/rooms | Khai báo cơ sở vật chất: phòng của các đơn vị trong phạm vi kèm tổng hợp theo khối và hiện trạng (P13-11, YCTD-106) |
| POST | /api/v1/facilities/rooms/export | Xuất Excel danh sách phòng và tổng hợp, ghi nhật ký xuất (BR-74, YCTD-106) |
| GET, POST | /api/v1/equipment-items | Danh mục thiết bị dạy học (lọc nhóm tuổi, loại danh mục); thêm thiết bị (P13-12, YCTD-106) |
| PATCH | /api/v1/equipment-items/{id} | Sửa thiết bị, ngừng hoặc dùng lại (YCTD-106) |
| GET, PUT | /api/v1/equipment-holdings | Số hiện có của một đơn vị; ghi nhiều dòng theo đơn vị hoặc lớp (YCTD-106) |
| POST | /api/v1/equipment-assets | Gắn hoặc bỏ gắn tài sản với thiết bị (YCTD-106) |
| GET | /api/v1/equipment-report | Tổng hợp thiết bị dạy học theo định mức (BR-102, YCTD-106) |
| POST | /api/v1/equipment-report/export | Xuất Excel tổng hợp thiết bị, ghi nhật ký xuất (BR-74, YCTD-106) |
| GET | /api/v1/facilities/report | "1.2. Báo cáo cơ sở vật chất": số liệu phòng, nhà vệ sinh, mức độ đạt chuẩn, hoàn thành dữ liệu; lọc `org_unit_id` (P17-23, BR-126, YCTD-128) |
| PUT | /api/v1/facilities/report/standard-levels | Ghi mức độ đạt chuẩn các khối phòng cho toàn trường (YCTD-128) |
| POST | /api/v1/facilities/report/export | Xuất Excel hoặc PDF (`format`) ba trang của 1.2, ghi nhật ký xuất (BR-74, YCTD-128) |
| GET, PUT | /api/v1/facilities/investments | "6.1. Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ": đọc kèm gợi ý từ khai báo phòng; ghi (P13-13, YCTD-128) |
| POST | /api/v1/facilities/investments/export | Xuất Excel hoặc PDF 6.1, ghi nhật ký xuất (YCTD-128) |
| GET | /api/v1/facility-imports/templates/{type}/columns | Cột của mẫu nhập phòng (`rooms`) hoặc danh mục thiết bị (`equipment_items`), cờ `locked` (P13-14, YCTD-128) |
| GET | /api/v1/facility-imports/catalogs/{type} | Tra cứu danh mục của tệp nhập (YCTD-128) |
| GET | /api/v1/facility-imports/templates/{type} | Tệp mẫu; `with_data=true` kèm phòng trong phạm vi hoặc cả danh mục thiết bị (YCTD-128) |
| POST | /api/v1/facility-imports | Tải tệp lên (`type`, `file`, `columns`), kiểm tra cả tệp (YCTD-128) |
| POST | /api/v1/facility-imports/{id}/commit | Ghi dữ liệu khi không còn dòng lỗi (YCTD-128) |
| GET | /api/v1/facility-imports/{id}/error-file | Tệp lỗi: tệp gốc kèm cột Nội dung lỗi (YCTD-128) |
| GET, POST | /api/v1/equipment-locations | Nơi để thiết bị của đơn vị; thêm nơi để (P13-16, YCTD-143) |
| PATCH | /api/v1/equipment-locations/{id} | Sửa, ngừng hoặc dùng lại nơi để (YCTD-143) |
| GET, PUT | /api/v1/equipment-placements | Thiết bị, lô kèm nơi để và mã tem; gán nơi để hàng loạt (YCTD-143) |
| POST | /api/v1/equipment-labels | In tem QR khổ A4 (PDF), cấp mã tem, ghi nhật ký xuất (YCTD-143) |
| GET | /api/v1/equipment-qr/{code} | Tra mã tem đã quét (YCTD-143) |
| GET, POST | /api/v1/equipment-stocktakes | Đợt kiểm kê; lập đợt, chụp sổ (P13-17, YCTD-143) |
| GET | /api/v1/equipment-stocktakes/{id} | Chi tiết đợt kèm dòng đối chiếu, tổng hợp (YCTD-143) |
| POST | /api/v1/equipment-stocktakes/{id}/scan | Ghi kết quả quét theo mã tem hoặc dòng (YCTD-143) |
| POST | /api/v1/equipment-stocktakes/{id}/submit, approve, return, cancel, close | Nộp, duyệt, trả lại, hủy, chốt chênh lệch (YCTD-143) |
| POST | /api/v1/equipment-stocktakes/{id}/minutes | Biên bản kiểm kê PDF hoặc Excel, ghi nhật ký xuất (YCTD-143) |
| GET | /api/v1/equipment-templates | Danh mục mẫu thiết bị tối thiểu theo cấp học (P13-18, YCTD-143) |
| POST | /api/v1/equipment-templates/{code}/load | Nạp danh mục mẫu: thêm mã chưa có (YCTD-143) |
| GET | /api/v1/equipment-minimum, /levels | Đối sánh danh mục tối thiểu: Đủ, Thiếu, Chưa có (YCTD-143); nguồn danh mục theo cấp đang bật (YCTD-345) |
| POST | /api/v1/equipment-minimum/export | Xuất Excel hoặc PDF đối sánh, ghi nhật ký xuất (YCTD-143) |

## 16. Nội dung, tương tác và tuyển sinh

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/activities | Danh sách (lọc lớp, trẻ, trạng thái, đơn vị) và tạo hoạt động (chờ duyệt, hoặc nháp khi `draft`) |
| GET | /api/v1/integrations | Cấu hình hai kết nối: bật hay tắt, cấu hình không bí mật, nhà cung cấp, đã có khóa ở máy chủ hay chưa (P01.integration.manage) |
| PUT | /api/v1/integrations/{connector} | Lưu cấu hình Fanpage (`facebook`) hoặc Zalo (`zalo`): `enabled`, `config` chỉ gồm trường được phép |
| GET | /api/v1/integrations/zalo/followers | Danh sách số điện thoại đã liên kết Zalo kèm tên phụ huynh |
| POST | /api/v1/integrations/zalo/followers | Liên kết số điện thoại phụ huynh với mã người dùng Zalo |
| DELETE | /api/v1/integrations/zalo/followers/{id} | Bỏ liên kết Zalo |
| POST | /api/v1/integrations/facebook/test | Kiểm tra kết nối Fanpage: trả mã và tên trang; lỗi trả 422 kèm lời báo (YCTD-95) |
| POST | /api/v1/integrations/zalo/test | Kiểm tra kết nối Zalo Official Account: trả mã và tên Official Account; lỗi trả 422 (YCTD-95) |
| PUT | /api/v1/integrations/zalo/refresh-token | Lưu khóa làm mới Zalo mới (mã hóa), bỏ khóa truy cập cũ; không bao giờ trả lại khóa, nhật ký chỉ ghi đã thay (YCTD-95) |
| GET | /api/v1/school-settings/integrations | Danh sách kết nối ngoài riêng của trường (YCTD-195, BR-211, P01.integration.manage): trạng thái, các ô nhập (giá trị bí mật chỉ bốn ký tự cuối), địa chỉ gọi lại của trường |
| PUT | /api/v1/school-settings/integrations/:connector | Lưu một kết nối `{ enabled, values }`: giá trị mã hóa bằng khóa của trường, ô trống giữ giá trị đã lưu; thiếu ô bắt buộc khi bật 400 |
| DELETE | /api/v1/school-settings/integrations/:connector | Xóa cấu hình một kết nối |
| POST | /api/v1/school-settings/integrations/:connector/test | Kiểm tra kết nối bằng giá trị đã lưu (Facebook, Zalo, eSMS gọi nhà cung cấp; kho tệp ghi và xóa tệp thử; cổng thanh toán kiểm tra đủ khóa); chưa cấu hình 422 `G3-10` |
| GET, PUT | /api/v1/school-settings/branding | Thương hiệu của trường: `display_name`, `primary_color` (#RRGGBB) (YCTD-195, BR-213); từ YCTD-231 thêm `app_short_name` (tối đa 9 ký tự, không gửi thì giữ giá trị cũ, BR-238) |
| GET | /api/v1/public/branding, /api/v1/public/branding/logo | Công khai theo tên miền của trường: tên hiển thị, màu, địa chỉ và ảnh biểu trưng cho trang đăng nhập (YCTD-195, MH-322) |
| GET | /api/v1/public/pwa/{teacher,parent,student}.webmanifest?base=, /api/v1/public/pwa/icon.svg, /api/v1/public/pwa/icon-maskable.svg (từ YCTD-231) | Công khai theo tên miền của trường: manifest (`application/manifest+json`: `id`, `name`, `short_name`, `theme_color`, `start_url`, `scope` theo `base` dạng `/…/`, sai dạng thì `/`; `icons`; `apple_touch_icon` ngoài chuẩn) và biểu tượng SVG 512 (nền màu trường, biểu trưng hoặc chữ cái đầu; `content-security-policy` chặn mã); ứng dụng lạ 404 (P19-07, BR-238) |
| GET | /api/v1/sync-accounts | Tài khoản đồng bộ của Bộ (`moet`), của Sở (`doet`): `username`, `password_configured`, `updated_at`, `sync_available`; không bao giờ trả mật khẩu; cần `P01.integration.manage` (P01-19, YCTD-120) |
| PUT, DELETE | /api/v1/sync-accounts/{target} | Ghi `username` (bắt buộc, đến 100 ký tự), `password` (đến 200 ký tự; trống thì giữ mật khẩu đã lưu, lần đầu bắt buộc); xóa thông tin đã lưu |
| GET | /api/v1/account-directory | Danh sách người dùng của 1.4 ghép hồ sơ nhân sự: tham số như `GET /users` (`q`, `status`, `role_code`, `login`, `full_name`, `must_change_password`, `password_expires_from`, `password_expires_to`, `page`, `page_size` 10, 20, 50, 100, 200) và `identifier` (mã nhân sự hoặc mã Bộ, khớp một phần); mỗi dòng thêm `staff_id`, `staff_code`, `moet_staff_code`; cần `P01.account.manage` hoặc `P01.account.manage-in-unit` (YCTD-120) |
| POST | /api/v1/account-directory/export | Xuất Excel theo bộ lọc và `columns`; cần thêm `P17.data.export`; tối đa 10 000 dòng; ghi nhật ký xuất `accounts` (BR-74) |
| GET | /api/v1/account-directory/staff-without-account | Nhân sự đang làm việc chưa có tài khoản trong phạm vi: `id`, `code`, `full_name`, `phone`, `org_unit_id`, `org_unit_name`, `suggested_username` |
| POST | /api/v1/account-directory/staff-accounts | Lấy danh sách CBQL/GV: `staff_ids` (1 đến 200), `role_code`; tạo tài khoản từng người qua dịch vụ định danh, liên kết hồ sơ nhân sự; trả từng dòng `login`, `temporary_password` hoặc `error` |
| POST | /api/v1/activities/{id}/facebook-post | Đăng hoạt động đã công bố lên Fanpage (P14.facebook.manage) |
| POST | /api/v1/news/{id}/facebook-post | Đăng tin tức đã công bố, phạm vi toàn trường hoặc đơn vị, lên Fanpage |
| POST | /api/v1/news-recipients/count | Số tài khoản phụ huynh nhận tin trước khi công bố theo phạm vi và cấp nhận (cần quyền soạn tin tức của đơn vị) (P01-44, YCTD-155) |
| GET | /api/v1/facebook-posts | Bài đăng Fanpage trong phạm vi đơn vị; lọc `source_type`, `source_id` |
| POST | /api/v1/facebook-posts/{id}/retry | Thử đăng lại bài đăng lỗi |
| GET, PATCH | /api/v1/activities/{id} | Chi tiết kèm ảnh, lượt thích, số bình luận; sửa khi chưa công bố |
| POST | /api/v1/activities/{id}/submit | Gửi trình duyệt hoạt động nháp hoặc bị từ chối |
| POST | /api/v1/activities/{id}/approve | Duyệt và công bố hoạt động |
| POST | /api/v1/activities/{id}/reject | Từ chối hoạt động kèm lý do |
| POST | /api/v1/activities/{id}/hide | Ẩn hoạt động đã công bố kèm lý do (Q-72) |
| POST | /api/v1/activities/{id}/republish | Công bố lại hoạt động đã ẩn |
| POST | /api/v1/activities/{id}/media | Tải ảnh hoạt động, gắn thẻ trẻ, cảnh báo trẻ chưa đồng ý hình ảnh |
| DELETE | /api/v1/activities/{id}/media/{mediaId} | Gỡ ảnh khỏi hoạt động chưa công bố |
| GET | /api/v1/activity-media/{id}/file | Tải ảnh hoạt động theo quyền xem |
| POST, DELETE | /api/v1/activities/{id}/like | Thích, bỏ thích hoạt động đã công bố |
| GET, POST | /api/v1/activities/{id}/comments | Bình luận của hoạt động |
| GET, POST | /api/v1/activity-categories | Danh mục hoạt động của đơn vị |
| PATCH | /api/v1/activity-categories/{id} | Sửa, ngừng dùng danh mục hoạt động |
| GET, POST | /api/v1/news-categories | Danh mục tin tức của đơn vị |
| PATCH | /api/v1/news-categories/{id} | Sửa, ngừng dùng danh mục tin tức |
| GET, POST | /api/v1/library-topics | Chủ đề thư viện của đơn vị |
| PATCH | /api/v1/library-topics/{id} | Sửa, ngừng dùng chủ đề thư viện |
| POST | /api/v1/content-files | Tải tệp nội dung (ảnh bìa, tài liệu thư viện, hình tô màu) |
| GET | /api/v1/content-files/{id} | Tải tệp nội dung theo quyền xem |
| GET, POST | /api/v1/news | Tin tức |
| GET, PATCH | /api/v1/news/{id} | Chi tiết, sửa tin tức |
| POST | /api/v1/news/{id}/publish | Công bố tin tức |
| POST | /api/v1/news/{id}/hide | Ẩn tin tức đã công bố kèm lý do |
| GET, POST | /api/v1/library-items | Nội dung thư viện |
| GET, PATCH | /api/v1/library-items/{id} | Chi tiết, sửa nội dung thư viện |
| POST | /api/v1/library-items/{id}/publish | Công bố nội dung thư viện |
| POST | /api/v1/library-items/{id}/hide | Ẩn nội dung thư viện kèm lý do |
| GET, POST | /api/v1/coloring-pages | Hình tô màu |
| GET, PATCH | /api/v1/coloring-pages/{id} | Chi tiết, sửa hình tô màu |
| POST | /api/v1/coloring-pages/{id}/publish | Công bố hình tô màu |
| POST | /api/v1/coloring-pages/{id}/hide | Ẩn hình tô màu kèm lý do |
| GET, POST | /api/v1/library-albums | Album thư viện |
| PATCH | /api/v1/library-albums/{id} | Sửa, ngừng dùng album |
| GET, POST | /api/v1/content-comments | Bình luận trên hoạt động, tin tức, thư viện, album |
| DELETE | /api/v1/content-comments/{id} | Luôn bị chặn: bình luận không xóa được (BR-66) |
| POST | /api/v1/comments/{id}/hide | Ẩn bình luận vi phạm kèm lý do; bình luận vẫn được lưu (BR-66) |
| GET, POST | /api/v1/extracurricular-activities | Hoạt động ngoại khóa |
| PATCH | /api/v1/extracurricular-activities/{id} | Sửa hoạt động ngoại khóa |
| POST | /api/v1/extracurricular-activities/{id}/publish | Công bố hoạt động ngoại khóa |
| POST | /api/v1/extracurricular-activities/{id}/close | Đóng hoạt động ngoại khóa |
| GET, POST | /api/v1/extracurricular-activities/{id}/registrations | Danh sách đăng ký; đăng ký cho trẻ |
| POST | /api/v1/extracurricular-registrations/{id}/withdraw | Thôi tham gia ngoại khóa |
| GET, POST | /api/v1/announcements | Thông báo |
| GET | /api/v1/announcements/{id}/reads | Danh sách đã đọc và chưa đọc |
| Phương thức | Đường dẫn | Mô tả |
| GET, POST | /api/v1/message-threads | Danh sách luồng trong phạm vi kèm số tin chưa đọc (lọc `child_id`, `class_id`); mở luồng cho một trẻ và gửi tin đầu tiên |
| GET, POST | /api/v1/message-threads/{id}/messages | Tin nhắn trong luồng; gửi tin |
| POST | /api/v1/message-threads/{id}/read | Ghi đã đọc các tin của phía bên kia |
| GET, POST | /api/v1/feedbacks | Góp ý của tôi và của đơn vị trong phạm vi xử lý; gửi góp ý |
| POST | /api/v1/feedbacks/{id}/handle | Ghi đang xử lý (chuyển người xử lý) hoặc kết quả xử lý |
| GET, POST | /api/v1/polls | Bình chọn, biểu quyết, khảo sát trong phạm vi hoặc dành cho tôi (lọc `status`, `poll_type`, `org_unit_id`, `open=true`); lập bản nháp |
| GET | /api/v1/polls/{id} | Chi tiết kèm câu hỏi, phương án, đã gửi phiếu chưa, lượt thích |
| POST | /api/v1/polls/{id}/publish | Mở bình chọn và báo đối tượng |
| POST | /api/v1/polls/{id}/close | Đóng sớm |
| POST | /api/v1/polls/{id}/publish-results | Công bố kết quả cho đối tượng |
| POST | /api/v1/polls/{id}/responses | Gửi phiếu trả lời (BR-67, BR-68) |
| GET | /api/v1/polls/{id}/results | Kết quả |
| GET, POST | /api/v1/survey-templates | Danh mục khảo sát; thêm mẫu |
| POST | /api/v1/survey-templates/{id}/status | Ngừng dùng hoặc dùng lại mẫu |
| GET, POST | /api/v1/interaction-comments | Bình luận của một đối tượng P15; gửi bình luận |
| GET | /api/v1/interaction-comments/reported | Bình luận bị báo hoặc đã ẩn trong phạm vi quản lý |
| POST | /api/v1/interaction-comments/{id}/report | Báo bình luận tiêu cực cho quản lý đơn vị |
| POST | /api/v1/interaction-comments/{id}/moderate | Quản lý đơn vị ẩn, hiện lại hoặc ghi chú kèm lý do; bình luận vẫn được lưu (BR-66) |
| POST | /api/v1/interaction-likes | Thích hoặc bỏ thích bình chọn, bình luận |
| GET, POST | /api/v1/lost-items | Danh sách (lọc `child_id`, `class_id`, `status`) và báo mất đồ hoặc ghi nhận đồ nhặt được |
| GET | /api/v1/lost-items/{id} | Chi tiết phiếu |
| POST | /api/v1/lost-items/{id}/found | Đánh dấu đã tìm thấy |
| POST | /api/v1/lost-items/{id}/close | Đóng phiếu với kết quả đã trả hoặc không tìm thấy |
| DELETE | /api/v1/lost-items/{id} | Hủy phiếu đang báo; phiếu đã đóng bị chặn (BR-75) |
| GET, POST | /api/v1/admission-campaigns | Danh sách đợt trong phạm vi kèm số hồ sơ, số đạt, số đã chuyển (lọc `org_unit_id`, `status`); lập đợt nháp |
| PATCH | /api/v1/admission-campaigns/{id} | Sửa đợt chưa đóng |
| POST | /api/v1/admission-campaigns/{id}/open | Mở đợt nháp |
| POST | /api/v1/admission-campaigns/{id}/close | Đóng đợt đang mở |
| GET, POST | /api/v1/admission-posts | Tin tuyển sinh (lọc `campaign_id`); soạn tin nháp |
| PATCH | /api/v1/admission-posts/{id} | Sửa tin |
| POST | /api/v1/admission-posts/{id}/publish | Công bố tin khi đợt chưa đóng |
| POST | /api/v1/admission-posts/{id}/hide | Ẩn tin đang đăng kèm lý do |
| GET, POST | /api/v1/admission-applications | Hồ sơ trong phạm vi (lọc `campaign_id`, `status`, `q`); nhân viên nhập hộ hồ sơ (đã tiếp nhận) |
| GET, PATCH | /api/v1/admission-applications/{id} | Chi tiết (số định danh đã che); sửa hồ sơ chưa xét |
| POST | /api/v1/admission-applications/{id}/receive | Tiếp nhận hồ sơ trực tuyến, kiểm tra BR-06 |
| POST | /api/v1/admission-applications/{id}/approve | Xét đạt, không vượt chỉ tiêu |
| POST | /api/v1/admission-applications/{id}/reject | Xét không đạt kèm lý do |
| POST | /api/v1/admission-applications/{id}/convert | Chuyển hồ sơ đạt thành hồ sơ trẻ theo QT-01 |
| GET | /api/v1/public/admissions | Không cần đăng nhập: đợt đang nhận hồ sơ kèm tin đang đăng và thời hạn, danh mục quan hệ |
| POST | /api/v1/public/admission-applications | Không cần đăng nhập: nộp hồ sơ, trả mã hồ sơ |
| GET | /api/v1/public/admission-applications/lookup | Không cần đăng nhập: tra cứu trạng thái bằng `code` và `phone` |
| GET, POST | /api/v1/recruitment-requests | Danh sách (view mine, pending, all; lọc status, org_unit_id) và lập đề nghị tuyển dụng |
| GET | /api/v1/recruitment-requests/{id} | Chi tiết đề nghị kèm số đã tuyển |
| POST | /api/v1/recruitment-requests/{id}/approve | Duyệt đề nghị tuyển dụng |
| POST | /api/v1/recruitment-requests/{id}/reject | Từ chối đề nghị kèm lý do |
| POST | /api/v1/recruitment-requests/{id}/close | Đóng đề nghị kèm lý do, đóng các tin còn mở |
| GET, POST | /api/v1/job-postings | Danh sách và soạn tin tuyển dụng |
| GET, PUT | /api/v1/job-postings/{id} | Chi tiết, sửa tin chưa đóng |
| POST | /api/v1/job-postings/{id}/publish | Công bố tin |
| POST | /api/v1/job-postings/{id}/close | Đóng tin |
| GET | /api/v1/public/job-posts | Công khai, không cần tài khoản: tin đã công bố còn hạn nộp |
| GET | /api/v1/public/job-posts/{id} | Công khai: chi tiết tin còn hạn |
| POST | /api/v1/public/job-posts/{id}/applications | Công khai: nộp hồ sơ kèm hồ sơ xin việc |
| GET, POST | /api/v1/candidates | Danh sách ứng viên (không có liên hệ) và nhân sự nhập ứng viên |
| GET | /api/v1/candidates/{id} | Chi tiết ứng viên kèm lịch phỏng vấn, ghi nhật ký truy cập |
| GET, POST | /api/v1/candidates/{id}/cv | Tải (ghi nhật ký truy cập) hoặc đính kèm hồ sơ xin việc |
| POST | /api/v1/candidates/{id}/status | Sàng lọc: đang sàng lọc, không đạt, đã rút |
| POST | /api/v1/candidates/{id}/interviews | Lên lịch phỏng vấn |
| POST | /api/v1/interviews/{id}/result | Ghi kết quả phỏng vấn |
| POST | /api/v1/interviews/{id}/cancel | Hủy lịch phỏng vấn kèm lý do |
| POST | /api/v1/candidates/{id}/decision | Quyết định tuyển hoặc không tuyển |
| POST | /api/v1/candidates/{id}/staff | Tạo hồ sơ nhân sự từ ứng viên đã tuyển |

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
| GET | /api/v1/reports/activities | Báo cáo hoạt động và công việc theo lớp (P17-10, YCTD-83) |
| GET | /api/v1/reports/consolidated | Báo cáo hợp nhất so sánh chỉ số giữa các đơn vị, chỉ số liệu tổng hợp (P17-11, YCTD-83) |
| POST | /api/v1/reports/{code}/export | Xuất báo cáo ra tệp Excel, ghi nhật ký xuất (P17-12, BR-74, YCTD-83) |
| GET | /api/v1/reports/export-logs | Nhật ký xuất dữ liệu (BR-74, YCTD-83) |
| GET | /api/v1/reports/saturday-classes | Báo cáo học thứ 7: số trẻ đi học và vắng của từng ngày học bù |
| GET | /api/v1/reports/attendance-meals | Điểm danh và suất ăn theo ngày, tuần, tháng: mỗi lớp mỗi ngày sĩ số, có mặt, vắng P/K/B, suất ăn, tỷ lệ, theo khối (YCTD-103) |
| GET | /api/v1/reports/attendance-meals/children | Bảng điểm danh từng trẻ của một lớp theo kỳ, mã P/K/B/N (YCTD-103) |
| POST | /api/v1/reports/attendance-meals/export | Xuất Excel điểm danh và suất ăn theo mẫu của trường, ghi nhật ký xuất dữ liệu (YCTD-103) |
| GET | /api/v1/reports/growth | Tổng hợp cân nặng, chiều cao theo đợt hoặc tháng, lọc đơn vị, giới tính, kênh (P10-14, YCTD-105); từ YCTD-125 theo học kỳ (`term`), so sánh với đợt khác (`compare_round_id`), số được khám định kỳ |
| GET | /api/v1/reports/growth/export | Xuất Excel tổng hợp cân nặng, chiều cao, ghi nhật ký xuất (BR-74, YCTD-105) |
| GET | /api/v1/statistics/classes | Thống kê lớp học theo nhóm tuổi (P17-16, YCTD-105) |
| GET | /api/v1/statistics/classes, /statistics/children, /statistics/students, /statistics/missing-child-fields, /reports/attendance-meals (từ YCTD-154) | Nhận `school_level` (mã cấp đang bật, trong phạm vi cấp của người dùng, 403 nếu không; trống hoặc `all` là mọi cấp được xem); 5.1 trả thêm `grade_groups` (lớp cấp ngoài Mầm non theo khối); chấm công và suất ăn có `stage` theo cấp (`TH`, `THCS`, `THPT`) |
| GET | /api/v1/statistics/children | Thống kê học sinh (P17-16, YCTD-105) |
| GET | /api/v1/statistics/students | 5.3 Thống kê học sinh theo Sở theo học kỳ (`term`), lọc `org_unit_id` (P17-21, BR-123, YCTD-125) |
| GET | /api/v1/statistics/students/export | Xuất Excel hoặc PDF (`format`) năm bảng của 5.3, ghi nhật ký xuất (BR-74, YCTD-125) |
| GET | /api/v1/statistics/staff | Thống kê nhân sự (P17-16, YCTD-105) |
| GET | /api/v1/statistics/missing-child-fields | Hồ sơ học sinh chưa nhập đủ; `field` để lấy danh sách (P17-17, YCTD-105) |
| GET | /api/v1/statistics/missing-staff-fields | Hồ sơ nhân sự chưa nhập đủ; `field` để lấy danh sách (P17-17, YCTD-105); từ YCTD-124 thêm `bank_account`, `tax_code` |
| GET | /api/v1/statistics/staff-so | 5.2 Thống kê nhân sự theo danh mục Bộ và chuẩn nghề nghiệp (P07-10, YCTD-124) |
| GET | /api/v1/reports/emis/start-of-year | Báo cáo EMIS đầu năm Biểu 1: năm thẻ, cảnh báo (P17-18, BR-104, YCTD-106) |
| POST | /api/v1/reports/emis/start-of-year/export | Xuất Excel năm trang, ghi nhật ký xuất (BR-74, YCTD-106) |
| GET | /api/v1/reports/emis/start-of-year-health | Số liệu báo cáo sức khỏe học sinh đầu năm (dòng 1.3 của Sở): 17 dòng chỉ tiêu, cảnh báo; màn hình, xuất tệp, gửi lên cấp trên ở phần 16j (P17-22, YCTD-125); từ YCTD-129 giữ để tương thích, màn hình dùng biểu chung `emis-start-of-year-health` |
| GET | /api/v1/reports/emis/forms/{form} | Xem một trong bảy biểu báo cáo số liệu EMIS: thẻ, cột, dòng, số đã ghi, cảnh báo, hoàn thành dữ liệu, trạng thái khóa (P17-18, P17-22 đến P17-28, BR-127, YCTD-129) |
| PUT | /api/v1/reports/emis/forms/{form}/tabs/{tab} | Ghi số liệu của thẻ nhập tay (YCTD-129) |
| POST | /api/v1/reports/emis/forms/{form}/tabs/{tab}/fill | Lấy dữ liệu (`source` `data`) hoặc Lấy dữ liệu năm trước (`previous_year`), không lưu (YCTD-129) |
| POST | /api/v1/reports/emis/forms/{form}/export | Xuất Excel mỗi thẻ một trang, ghi nhật ký xuất (BR-74, YCTD-129) |
| DELETE | /api/v1/reports/emis/forms/{form}/tabs/{tab} | Xóa dữ liệu của thẻ nhập tay chưa khóa (P17-18, BR-131, YCTD-132) |
| GET | /api/v1/reports/emis/start-of-year/sending | Lưới hồ sơ và lưới biểu mẫu của 1.1.2 Gửi báo cáo đầu năm (P17-20, YCTD-132) |
| POST | /api/v1/reports/emis/start-of-year/send | Gửi hồ sơ: tệp gửi, đánh dấu đã gửi hồ sơ và biểu mẫu chọn, ghi nhật ký xuất (P17-20, BR-131, YCTD-132) |
| POST | /api/v1/reports/emis/start-of-year/error-file | Xuất file lỗi của hồ sơ và biểu mẫu chọn, ghi nhật ký xuất (YCTD-132) |
| POST | /api/v1/reports/emis/start-of-year/resend | Đặt trạng thái gửi lại, cần thêm `P01.school-profile.manage` (BR-131, YCTD-132) |
| GET | /api/v1/export-jobs | "Tệp đã tạo": 100 tác vụ xuất nền gần nhất của người đăng nhập (P17-19, YCTD-121) |
| GET | /api/v1/export-jobs/{id}/file | Tải tệp của tác vụ đã tạo xong, chưa hết hạn; chỉ người tạo; chưa xong, lỗi, hết hạn trả 422 mã YCTD-121 |
| GET | /api/v1/upper-level-submissions?forms={mã,…} | Danh sách biểu mẫu gửi lên cấp trên của năm học đang dùng kèm hoàn thành dữ liệu, trạng thái, ngày gửi, tệp gửi, quyền của người xem (P17-20, YCTD-121) |
| POST | /api/v1/upper-level-submissions/{form}/export | Xuất tệp gửi, lưu tệp và bản chụp số liệu; biểu mẫu đang khóa trả 422 |
| GET | /api/v1/upper-level-submissions/{form}/file | Tải tệp gửi gần nhất |
| POST | /api/v1/upper-level-submissions/{form}/mark-sent | Đánh dấu đã gửi: `sent_on` (YYYY-MM-DD, không sau hôm nay), `note`, `no_data` |
| POST | /api/v1/upper-level-submissions/{form}/unlock-request | Gửi yêu cầu mở khóa: `reason` bắt buộc, tối đa 500 ký tự |
| POST | /api/v1/upper-level-submissions/{form}/unlock | Người có quyền mở khóa: `approve` (true mở khóa, false từ chối), `note` |
| POST | /api/v1/upper-level-submissions/{form}/resend | Người có quyền mở khóa đặt trạng thái gửi lại: `note` |
| GET | /api/v1/upper-level-submissions/{form}/events | Lịch sử thao tác của biểu mẫu, mới nhất trước |
| POST | /api/v1/upper-level-submissions/{form}/error-file | Xuất file lỗi: tệp Excel liệt kê các điều kiện hoàn thành dữ liệu chưa đạt của biểu mẫu, ghi nhật ký xuất; dùng chung cho mọi biểu mẫu gửi lên cấp trên (YCTD-129) |
| GET, PUT | /api/v1/signing/certificate | Xem, ghi chứng thư số nhà trường (P01-28, BR-128, YCTD-130) |
| POST | /api/v1/signing/certificate/register, /revoke | Đăng ký kí nội bộ, hủy đăng ký (YCTD-130) |
| POST, GET, DELETE | /api/v1/signing/certificate/seal | Tải lên, xem, xóa ảnh con dấu (YCTD-130) |
| POST | /api/v1/signing/certificate/sync, /unsync | Đánh dấu đã đồng bộ, đặt lại chưa đồng bộ (P01-29, YCTD-130) |
| GET | /api/v1/signing/objects | Đối tượng của một loại hồ sơ kèm hồ sơ chưa hủy (P01-30, YCTD-130) |
| POST | /api/v1/signing/dossiers | Tạo hồ sơ PDF (YCTD-130) |
| POST | /api/v1/signing/dossiers/sign, /check-changes, /complete, /mark-sent | Kí xác nhận nội bộ, tải thông tin thay đổi, xác nhận hoàn thành, đánh dấu đã gửi (P01-30, P01-31, YCTD-130) |
| GET | /api/v1/signing/dossiers/{id}, /{id}/file | Chi tiết, lịch sử; tệp gốc hoặc tệp đã kí, ghi nhật ký xuất (BR-74, YCTD-130) |
| POST | /api/v1/signing/dossiers/{id}/cancel, /{id}/uncomplete | Hủy hồ sơ, hủy xác nhận (YCTD-130) |
| GET | /api/v1/signing/submissions | Hồ sơ đã kí của 2.3 (P01-31, YCTD-130) |
| POST | /api/v1/signing/class-log/export | Xuất dữ liệu sổ đầu bài ra Excel (YCTD-130) |
| GET | /api/v1/signing/dossiers/{id}/view | Nội dung hồ sơ và thông tin chữ ký cho cửa sổ Xem hồ sơ kí (P01-30, YCTD-133) |
| GET | /api/v1/signing/create-errors/file | Tải file lỗi tạo hồ sơ (P01-30, YCTD-133) |
| GET | /api/v1/notifications | Danh sách thông báo của người đăng nhập |
| POST | /api/v1/notifications/{id}/read | Đánh dấu đã đọc |
| POST | /api/v1/notifications/read-all | Đánh dấu đọc tất cả (YCTD-64) |
| GET | /api/v1/notifications/{id}/receipts | Ai đã đọc, ai chưa đọc (BR-70, YCTD-64) |
| GET | /api/v1/notification-templates | Mẫu thông báo theo mã (YCTD-64) |
| PUT, DELETE | /api/v1/notification-templates/{code} | Sửa mẫu hoặc dùng lại nội dung gốc |
| GET, POST | /api/v1/notification-templates | Mẫu thông báo |

### 17.1. Công cụ xuất, nhập và gửi lên cấp trên dùng chung (YCTD-121)

Điểm cuối nhập bổ sung: `GET /api/v1/imports/templates/{type}?with_data=true` (tệp mẫu kèm dữ liệu, hiện có ở `classes`, từ YCTD-124 thêm `professional_ratings`, từ YCTD-126 thêm `sms_phones`, `national_ids`, `student_addresses`, ghi nhật ký xuất), `GET /api/v1/imports/templates/{type}/columns` (cột của mẫu, cờ `locked`, `updates_existing`, `template_with_data`), `GET /api/v1/imports/catalogs/{type}` (danh mục tra cứu: `key`, `title`, `column`, `items` mã, tên, ghi chú), `GET /api/v1/imports/{id}/error-file` (tệp gốc kèm cột Nội dung lỗi; không có lỗi trả 422 mã YCTD-121). `POST /api/v1/imports` và `/imports/moet-codes` nhận trường `columns` dạng `khóa1,khóa2`; lần nhập trả `selected_columns`. Các điểm cuối xuất danh sách (`/children/export`, `/staff/export`, `/classes/export`, `/class-assignments/export`, `/student-movements/export`) nhận `format` `xlsx` hoặc `pdf`; `/children/export`, `/staff/export` trả 202 `{ job }` khi danh sách vượt số dòng xuất trực tiếp.

Hướng dẫn dùng cho các phần sau (16b, 16e đến 16k):

1. Xuất PDF trên lưới: điểm cuối xuất của màn hình đọc định dạng bằng `readTableFileFormat(body.format)` và dựng tệp bằng `buildStudentWorkbook` hoặc `buildFacilitiesWorkbook` với `format` (hai hàm dùng `buildTableFile`, tự đổi đuôi tên tệp, ghi nhật ký xuất kèm định dạng). Ở cổng quản trị, hàm gọi xuất nhận thêm `format` và gọi `downloadExport` (`apps/portal/src/exports/export-api.ts`); truyền `exportPdf={(columnIds) => exportX(filter, columnIds, 'pdf')}` cho `DataGrid`.
2. Tác vụ xuất nền: trong hàm khởi tạo của dịch vụ gọi `exportJobs.register('<mã báo cáo>', { title, run(currentUser, parameters, { format, ipAddress, rowLimit }) })`; hàm `run` truy vấn tối đa `rowLimit` dòng, vượt thì ném `ExportTooLargeError(total)`, rồi trả `ExportedFile` (có `rowCount`). Điểm cuối gọi `exportJobs.exportOrQueue(currentUser, mã, parameters, format, ip)` và trả bằng `sendExportOutcome`. `parameters` phải là dữ liệu JSON, không chứa số định danh hay dữ liệu bí mật vì lưu ở cơ sở dữ liệu hệ thống.
3. Nhập Excel: dùng `ExcelImportPanel` (`apps/portal/src/imports/ExcelImportPanel.tsx`) với `type`, `title`, `uploadPath`; máy chủ khai báo cột ở `IMPORT_COLUMNS`, cột luôn nhập ở `LOCKED_IMPORT_COLUMNS`, danh mục ở `ImportsService.catalogs`, dữ liệu mẫu ở `templateRows`, loại cập nhật được bản ghi đã có ở `UPDATING_IMPORT_TYPES`; đọc tệp bằng `readSheet(body, columns, selected)`; tệp lỗi dùng `buildErrorWorkbook`. Màn hình nhập riêng (ví dụ 3.1.3, 4.1.2) có thể đặt `ErrorFileButton`, `RowMessageTable` vào phần của mình.
4. Gửi lên cấp trên: trong dịch vụ của biểu mẫu gọi `upperLevelForms.register({ code, name, permission, unlockPermission, allowNoData, completeness(currentUser), snapshot(currentUser, ip) })`; `completeness` trả danh sách `{ label, done }`, `snapshot` trả `{ file: ExportedFile, data }` (dựng tệp theo mẫu nộp, ghi nhật ký xuất). Ở cổng quản trị đặt `<UpperLevelSubmissionPanel formCodes={['<mã>']} onChanged={…} />`. Không thêm nút "Gửi" truyền đi; khi có giao diện lập trình của Bộ, Sở thì thay `ManualUpperLevelGateway` bằng bản kết nối thật cung cấp cho `UpperLevelGateway`.
5. Xuất file lỗi (từ YCTD-129): mọi biểu mẫu đã đăng ký có sẵn `POST /upper-level-submissions/{form}/error-file`, dựng từ `completeness` của biểu (các mục `done` sai), không cần khai báo thêm; `UpperLevelSubmissionPanel` hiện nút "Xuất file lỗi" ở dòng biểu khi dữ liệu chưa hoàn thành, kể cả hai biểu của phần 16i (YCTD-128). Đặt `label` của mục hoàn thành là câu đọc được (ví dụ "Đã ghi thẻ Nhà vệ sinh") vì tệp in nguyên câu đó. Màn hình nhập số liệu của biểu cần khóa khi đã gửi thì gọi `UpperLevelSubmissions.statusOf(formCode)` rồi `isLocked(status)` (đúng khi đã gửi hoặc đang chờ mở khóa) trước khi ghi.
6. Cách phần 16j dùng: `EmisForms` (`apps/api/src/emis/emis-forms.ts`) đăng ký bảy biểu trong một vòng lặp, `completeness` và `snapshot` gọi lại hàm xem biểu và hàm dựng tệp Excel của biểu nên tệp gửi trùng với tệp Xuất Excel; ghi, lấy dữ liệu kiểm tra `isLocked` và trả mã YCTD-129. Cổng quản trị đặt `<UpperLevelSubmissionPanel formCodes={EMIS_FORM_CODES} summary … />` ở 1.1 (bảy dòng kèm dòng tổng hợp số đã gửi, số cần gửi, lần gửi cuối) và `formCodes={[mã biểu]}` ở sáu màn hình còn lại.
7. Tệp PDF dạng hồ sơ (từ YCTD-130): `buildPdf(sheets, createdAt, { orientation, closing, subject })` ở `apps/api/src/exports/table-file.ts` dựng PDF khổ dọc (`portrait`) và thêm phần cuối tài liệu (`closing`, ví dụ khối xác nhận kí kèm ảnh `data:image/png;base64,…`); `buildTableFile` không đổi. Phần 16k dùng cho hồ sơ kí.

### 17.2. Lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272)

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/learning/config | Quyền của người gọi (`can_teach`, `can_template`, `can_decide`, `can_view`, `can_review`), `link_domains`, danh mục loại hoạt động |
| GET | /api/v1/learning/spaces?scope=mine\|all | Lớp học trực tuyến của tôi (đồng bộ phần của giáo viên trước) hoặc của trường (`P02.learning.view`); kèm tên lớp, môn, giáo viên, số hoạt động (P03-12, BR-248) |
| POST | /api/v1/learning/spaces/sync | Đồng bộ lớp học trực tuyến từ phân công và thời khoá biểu (`P02.learning.view`); trả `created`, `teachers_added`, `teachers_removed` |
| POST | /api/v1/learning/spaces | Tạo khoá tự chọn `{ title, school_level, description, enrollment_mode, capacity, teacher_user_ids }` (`P02.learning.view`) |
| GET, PATCH | /api/v1/learning/spaces/{id} | Chi tiết (lớp, giáo viên, số học sinh, chương, hoạt động, `replace_allowed_today`, `can_teach`); sửa `title`, `description`, `visible_to_students`, `status` (giáo viên của lớp); người không dạy, không quản lý 403 |
| POST, DELETE | /api/v1/learning/spaces/{id}/teachers, /teachers/{userId} | Thêm, bỏ giáo viên thêm tay (`P02.learning.view`) |
| POST, DELETE | /api/v1/learning/spaces/{id}/enrollments, /enrollments/{childId} | Ghi danh `{ child_ids }`, bỏ ghi danh khoá tự chọn; lớp theo môn 422; quá số chỗ 422 |
| GET | /api/v1/learning/spaces/{id}/progress, /plan, /events | Tiến độ (hoạt động đã giao, mỗi học sinh `summary` và `results`); kế hoạch theo tuần `weeks`; 200 dòng nhật ký gần nhất (P03-14) |
| POST | /api/v1/learning/spaces/{id}/sections; PATCH, DELETE /api/v1/learning/sections/{id} | Thêm, sửa (`title`, `planned_week`, `position`), xóa chương (có kết quả thì 422) |
| POST | /api/v1/learning/spaces/{id}/activities; PATCH, DELETE /api/v1/learning/activities/{id} | Thêm, sửa, xóa hoạt động `{ section_id, kind, title, lesson_label, instructions, required, teaching_mode, estimated_minutes, opens_at, due_at, closes_at, open_rules, completion_rule, graded, weight, pass_score, planned_week, settings }`; loại chưa đăng ký 400; học liệu chưa công bố, tên miền chưa cho phép, điều kiện mở trỏ ra ngoài lớp, thay thế khi chưa có quyết định 422 (P03-13, BR-249, BR-250, BR-252) |
| POST | /api/v1/learning/activities/{id}/publish | Giao `{ published: true }` hoặc chuyển về nháp |
| POST | /api/v1/learning/activities/{id}/exceptions | Mở riêng, gia hạn `{ child_id, reason, due_at, unlocked }`; học sinh ngoài lớp 422 |
| POST | /api/v1/learning/activities/{id}/results | Giáo viên ghi kết quả `{ child_id, status, score, level }`; hoạt động chưa giao, học sinh ngoài lớp 422 |
| GET, POST | /api/v1/learning/templates | Khoá mẫu người gọi được thấy; tạo `{ title, description, school_level, subject_id, grade_level_code, content }` (`P02.learning.template`) (P03-15) |
| GET, PUT | /api/v1/learning/templates/{id} | Chi tiết kèm `reviews`; người soạn sửa `title`, `description`, `content` |
| POST | /api/v1/learning/templates/{id}/submit, /review, /retire, /apply | Gửi duyệt; duyệt `{ decision: approve\|return, note }` (người duyệt của bước, không phải người soạn); ngừng dùng; đẩy bản đã duyệt `{ space_ids }` trả số hoạt động thêm, cập nhật, giữ (BR-251) |
| GET, POST | /api/v1/learning/decisions; POST /api/v1/learning/decisions/{id}/revoke | Quyết định dạy học trực tuyến thay thế; ghi `{ decision_no, decision_date, reason, class_ids, starts_on, ends_on }`, thu hồi (`P02.learning.decide`) (P03-16) |
| GET, POST | /api/v1/learning/rules | Nội quy hiện hành và số học sinh đã xác nhận; ban hành phiên bản mới `{ content }` (`P02.learning.decide`) |
| GET | /api/v1/learning/children/{childId} | Phụ huynh xem việc học trực tuyến của con: `rules` (nội quy, đã xác nhận chưa), `spaces` (lớp đã mở, tiến độ, chương, hoạt động đã giao với `open`, `locked_reasons`, `status`, `score`); khác con 403 (P03-17) |
| POST | /api/v1/learning/children/{childId}/rules/acknowledge | Phụ huynh xác nhận đã đọc nội quy thay con |
| GET | /api/v1/student/learning | Học sinh (kênh `student`, `P02.learning.study`) xem lớp học trực tuyến đã mở cho mình: cùng dạng với tuyến của phụ huynh |
| POST | /api/v1/student/learning/activities/{id}/open | Học sinh mở hoạt động đang mở với mình: ghi đã xem, cách tính "xem xong" thì hoàn thành; trả `{ id, kind, title, instructions, body, url, resource }`; hoạt động còn khóa trả 422 `YCTD-272` kèm lý do |
| POST | /api/v1/student/learning/rules/acknowledge | Học sinh xác nhận đã đọc nội quy |

Mọi tuyến nhân sự của `/learning` (trừ `children/...`) cần một trong `P02.learning.teach`, `template`, `decide`, `view`; ở nền tảng nhiều trường, gói không gồm phân hệ của nhóm menu 9 thì trả 403 `MODULE_NOT_IN_PLAN`.

### 17.3. Bài tập trực tuyến (DT-28 phần 28c, YCTD-273)

Tuyến giáo viên cần `P02.assignment.manage` và là giáo viên của lớp học trực tuyến của hoạt động; lỗi quy tắc 422 mã `YCTD-273`.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, PUT, PATCH | /api/v1/learning/activities/{id}/assignment | Màn hình soạn (cài đặt, phiên bản, câu kèm đáp án, đích, số học sinh nhận, học sinh, bộ nhóm của lớp); lưu toàn bộ `{ context, work_mode, group_set_id, late_policy, max_attempts, grading, rubric_id, show_results, estimated_minutes, ai_blocked?, variants: [{ code, name }], items: [{ variant_code, kind, question_id, resource_id, prompt, score }], targets: [{ kind, group_id, child_id, variant_code }] }` (đã phát hành thì 422; không gửi `ai_blocked` thì giữ giá trị đã có); PATCH sau phát hành chỉ `late_policy`, `max_attempts` (chỉ tăng), `show_results`, `ai_blocked` (YCTD-383 lát L3: "Không dùng AI", giá trị khác true, false thì 422) |
| GET | /api/v1/learning/activities/{id}/assignment/questions?search= | Câu đã duyệt cùng cấp, cùng môn của lớp (tối đa 100) |
| POST | /api/v1/learning/activities/{id}/assignment/release, /close | Phát hành (chốt danh sách, giao hoạt động; trả `recipient_count`); đóng hoặc mở lại `{ closed }` |
| PATCH | /api/v1/learning/activities/{id}/assignment/recipients/{childId} | Hạn riêng `due_at`, miễn `{ excused, excuse_reason }` |
| GET | /api/v1/learning/activities/{id}/assignment/submissions | Theo học sinh hoặc theo nhóm: lần nộp mới nhất, có bản nháp, miễn |
| POST | /api/v1/learning/activities/{id}/assignment/return | Trả bài `{ submission_ids? }` (không gửi là mọi bài đã chấm xong); trả `returned`, `skipped` |
| GET; POST, DELETE | /api/v1/learning/activities/{id}/assignment/comment-bank; /api/v1/learning/assignment-comments, /{id} | Ngân hàng nhận xét (câu của trường theo cấp và câu của giáo viên); thêm, xóa câu của mình |
| GET | /api/v1/learning/submissions/{id} | Bài nộp: câu, câu trả lời, điểm máy chấm, tệp, trao đổi, thành viên, đánh giá đóng góp |
| POST | /api/v1/learning/submissions/{id}/grade | `{ item_scores, criteria_scores, level, feedback, feedback_ai_assisted }`; bài đã trả thì ghi lại kết quả hoạt động |
| POST | /api/v1/learning/submissions/{id}/contributions/{childId} | Điều chỉnh điểm cá nhân bài nhóm `{ score, reason }` |
| POST | /api/v1/learning/submissions/{id}/ai-feedback | Gợi ý nhận xét `{ note }`; trả `{ request_id, comment, notice }`; không lưu vào bài |
| POST | /api/v1/learning/submissions/{id}/comments | Giáo viên trả lời trao đổi trên bài `{ body }` (1 đến 2000 ký tự sau khi bỏ khoảng trắng hai đầu, sai 422); chỉ giáo viên của lớp học trực tuyến có hoạt động (giáo viên khác, phụ huynh, học sinh 403; bài không có 404); trả `201 { id, author_name, author_kind: "teacher", body, created_at }` để màn hình hiện ngay (YCTD-346) |
| GET | /api/v1/learning/submission-files/{id} | Tệp của bài nộp (giáo viên) |
| GET | /api/v1/learning/children/{childId}/assignments/{activityId} | Phụ huynh (hoặc cán bộ xem lớp học trực tuyến) xem các lần nộp, điểm, mức, nhận xét đã trả của con |
| GET | /api/v1/student/assignments/{activityId} | Học sinh (kênh `student`, `P02.learning.study`): câu không đáp án, bản nháp, các lần nộp, `can_submit`, `submit_blocked_reason`, `will_be_late`, nhóm, giới hạn tệp |
| PUT | /api/v1/student/assignments/{activityId}/draft | Lưu nháp `{ answers, version }`; khác phiên bản 409 |
| POST | /api/v1/student/assignments/{activityId}/items/{itemId}/files | Gửi tệp (multipart `file`) vào bản nháp |
| POST | /api/v1/student/assignments/{activityId}/submit, /contribution | Nộp `{ answers?, version? }` (trả `late`); đánh giá đóng góp `{ self_rating, self_note, peers }` |
| POST | /api/v1/student/assignments/{activityId}/submissions/{submissionId}/comments | Học sinh trao đổi trên bài của mình |
| GET, DELETE | /api/v1/student/assignments/files/{fileId} | Xem tệp của bài mình (hoặc nhóm mình), xóa tệp của bản nháp |

### 17.4. Tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (DT-28 phần 28d, YCTD-274)

Tuyến nhân sự cần một trong `P02.learning.teach`, `P02.learning.view`, `P02.learning.decide`, `P02.assignment.manage`; ai xem lớp nào, báo cáo nào kiểm ở máy chủ; lỗi quy tắc 422 mã `YCTD-274`.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/learning/spaces/{id}/progress-grid | Hoạt động, chương, từng em (`summary` có `pending_grading`, `sections`, `attention`, `results`), danh sách cần chú ý |
| GET | /api/v1/learning/spaces/{id}/gradebook; /gradebook/file?format=xlsx\|pdf | Bảng điểm hoạt động (`notice`, `gradebook_enabled`, `can_transfer`, `activities`, `rows` có `average` hoặc `levels`); tệp |
| POST | /api/v1/learning/spaces/{id}/score-book/preview, /score-book | THCS, THPT `{ activity_ids, method, term_type, seq }`: xem trước (`score`, `reason`, `current` từng em); ghi (`written`, `skipped`) |
| POST | /api/v1/learning/spaces/{id}/comment-book/preview, /comment-book | Tiểu học: gợi ý `{ activity_ids? }` (kỳ đánh giá, thư viện câu nhận xét, `level_code`, `comment`, `feedback` từng em); ghi `{ period_id, activity_ids, items: [{ child_id, level_code, comment }] }` (`levels`, `comments`) |
| GET | /api/v1/learning/spaces/{id}/record?term_type=&format= | Hồ sơ dạy học trực tuyến của lớp, môn theo học kỳ (Excel, PDF) |
| GET | /api/v1/learning/reports/homeroom?class_id=, /department, /school, /teachers | Báo cáo chủ nhiệm, tổ chuyên môn, toàn trường, hoạt động dạy của giáo viên |
| GET, PUT | /api/v1/learning/term-reports/{term} | Báo cáo tổng kết học kỳ (`range`, `stats`, `report`); lưu `{ evaluation, difficulties, causes, recommendations }` (Ban Giám hiệu) |
| GET | /api/v1/learning/term-reports/{term}/file?format= | Tệp báo cáo tổng kết (PDF, Excel) |
| GET | /api/v1/learning/children/{childId}/summary | Phụ huynh (hoặc cán bộ xem lớp học trực tuyến): tiến độ từng lớp, hạn trong 7 ngày tới, nhận xét bài tập đã trả |

### 17.5. Giao tiếp trong lớp và nhóm (DT-28 phần 28e, YCTD-275)

Tuyến nhân sự cần một trong `P02.learning.teach`, `P02.learning.view`, `P02.learning.decide`, `P02.discussion.moderate`; hàng chờ báo cáo cần `P02.discussion.moderate`; lỗi quy tắc 422 mã `YCTD-275`.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/learning/spaces/{id}/threads?kind= | Chủ đề của lớp (giáo viên thấy cả đã ẩn, câu hỏi riêng; `students_can_post_topics`); giáo viên tạo `{ kind, title, body, section_id, activity_id }` (thông báo thì gửi thông báo) |
| PUT | /api/v1/learning/spaces/{id}/discussion-settings | `{ students_can_post_topics }` |
| GET | /api/v1/learning/spaces/{id}/questions/pending | Câu hỏi chờ giáo viên trả lời (`overdue` sau 48 giờ) |
| GET; POST | /api/v1/learning/threads/{id}; /posts, /accept, /lock, /hide, /reports | Chủ đề và mọi trả lời; trả lời `{ body }`; xác nhận `{ post_id }`; khoá `{ locked }`; ẩn `{ post_id?, hidden }`; báo cáo `{ post_id?, reason }` |
| GET; POST | /api/v1/learning/groups/{id}/workspace; /threads | Không gian nhóm cho người lập bộ nhóm, giáo viên của lớp; đăng tin |
| GET | /api/v1/learning/group-files/{id} | Tệp nhóm (nhân sự) |
| GET, PUT | /api/v1/learning/discussion-config | Ban Giám hiệu: `{ open_hours, blocked_words }` |
| GET, PATCH | /api/v1/learning/discussion-reports?status=closed, /{id} | Hàng chờ (chủ nhiệm chỉ lớp mình); xử lý `{ status, resolution, hide, ban_days }` |
| GET | /api/v1/learning/children/{childId}/announcements, /groups, /calendar?from= | Phụ huynh: thông báo lớp, nhóm theo GD-145, lịch tuần của con |
| GET; POST | /api/v1/student/discussions/spaces/{id}?kind=; /threads | Học sinh: chủ đề của lớp (`can_post_topics`, `open_now`); tạo `{ kind: forum\|question, title, body, private }` (trả `masked`) |
| GET; POST | /api/v1/student/discussions/threads/{id}; /posts, /reports | Chủ đề và trả lời chưa ẩn; trả lời (trả `masked`); báo cáo |
| DELETE | /api/v1/student/discussions/posts/{id} | Học sinh ẩn trả lời của mình |
| GET | /api/v1/student/groups, /groups/{id} | Nhóm của em; không gian nhóm |
| POST, PATCH, PUT | /api/v1/student/groups/{id}/threads, /tasks; /student/group-tasks/{id}; /student/groups/{id}/note | Đăng tin; thêm việc `{ title, assignee_child_id, due_on }`; đổi trạng thái `{ status }`; lưu ghi chú `{ content, version }` (409 khi bản cũ) |
| POST; GET | /api/v1/student/groups/{id}/files; /student/group-files/{id} | Gửi tệp (multipart `file`); xem tệp |
| GET | /api/v1/student/calendar?from= | Lịch học tập tuần của em |

### 17.6. Bài về nhà và phụ huynh (DT-28 phần 28f, YCTD-276)

Lỗi quy tắc 422 mã `YCTD-276`. Tuyến phát hành bài tập của 28c `POST /api/v1/learning/activities/{id}/assignment/release` nhận thêm `{ confirm_warnings }` và trả thêm `policy_warnings`; bài về nhà vượt quy tắc cảnh báo chưa xác nhận thì 422 có chi tiết ô `confirm_warnings`, vượt quy tắc chặn chưa được cho vượt thì 422 ô `override_reason`.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET; POST | /api/v1/learning/homework/class-logs/{id} | Bài về nhà của tiết (`can_assign`); giáo viên tạo bài về nhà `{ title, instructions, estimated_minutes }`, trả `activity_id`, `due_at`, `due_basis` (`next_lesson`, `default`); cần `P02.assignment.manage` |
| GET | /api/v1/learning/homework/activities/{id}/workload | Lịch 7 ngày của lớp quanh ngày đến hạn kèm bài đang soạn, `check` (vi phạm, cách xử lý), `override_reason` |
| POST | /api/v1/learning/homework/activities/{id}/override | Ban Giám hiệu cho vượt quy tắc chặn `{ reason }` |
| GET | /api/v1/learning/homework/activities/{id}/absences | Học sinh vắng có phép ngày phát hành, gợi ý `extend` hoặc `excuse` |
| GET | /api/v1/learning/homework/workload?class_id=&from= | Khối lượng 7 ngày của lớp (giáo viên đang dạy, chủ nhiệm, Ban Giám hiệu) |
| GET; PUT; DELETE | /api/v1/learning/homework/policies; /{id} | Ban Giám hiệu: danh sách quy tắc và `reminder_time`; lưu theo cấp, khối `{ school_level, grade, no_homework, max_items_per_day, max_minutes_per_day, blocked_weekdays, skip_holidays, action, basis }`; bỏ quy tắc |
| PUT | /api/v1/learning/homework/reminder-time | Ban Giám hiệu: `{ reminder_time }` từ 06:00 đến 20:59 |
| GET | /api/v1/learning/children/{childId}/homework | Phụ huynh: bài về nhà của con (`status`, kết quả khi đã trả, `acknowledged_by_me`, `can_proxy`), `has_student_account` |
| POST | /api/v1/learning/children/{childId}/homework/{id}/acknowledge | "Đã xem cùng con" |
| GET | /api/v1/learning/children/{childId}/homework/{id} | Bài để nộp thay: câu (không đáp án), bản nháp, các lần nộp, `can_proxy`, `proxy_blocked_reason` |
| POST; DELETE | /api/v1/learning/children/{childId}/homework/{id}/items/{itemId}/files; /files/{fileId} | Nộp thay: gửi tệp (multipart `file`), xóa tệp của bản nháp |
| POST | /api/v1/learning/children/{childId}/homework/{id}/submit | Nộp thay `{ answers }`; bài ghi `submitted_by_kind = guardian` |
| POST | /api/v1/learning/children/{childId}/homework/{id}/submissions/{submissionId}/comments | Phụ huynh trao đổi trên bài đã nộp `{ body }` |

### 17.7. Gói SCORM và gói khoá học (DT-28 phần 28h, YCTD-278)

Lỗi quy tắc 422 mã `YCTD-278`. Mở bài, xem trước cần tiêu đề `Origin` của trang mở (trình duyệt tự gửi).

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST; GET | /api/v1/learning-resources/{id}/scorm | Người soạn tải gói zip (multipart `file`, tối đa 200 MB) lên học liệu loại `scorm`, trả chuẩn, tên, SCO, số tệp; danh sách gói của các phiên bản người xem thấy được |
| POST | /api/v1/learning-resources/{id}/scorm/{packageId}/preview | Xem trước: `scos` (mã, tên, `url` có mã truy cập), không ghi kết quả |
| GET | /api/v1/learning/activities/{id}/scorm-attempts | Giáo viên: lượt chạy theo học sinh, SCO (trạng thái, điểm, thời gian) |
| POST | /api/v1/student/scorm/activities/{id}/launch | Học sinh mở hoạt động gói SCORM: chuẩn, tên, `content_origin`, `scos` (kèm `url`, trạng thái đã có) |
| POST | /api/v1/student/scorm/activities/{id}/commit | `{ sco, values: { "cmi....": "..." }, finished }`; trả kết quả hoạt động và trạng thái từng SCO |
| GET | /api/v1/scorm-content/{mã truy cập}/{đường dẫn} | Tệp của gói (không cần mã phiên); CSP `sandbox allow-scripts`, trang SCO có bộ chuyển API; mã sai, hết hạn, của trường khác thì 404 |
| GET | /api/v1/learning/templates/{id}/package | Tải gói khoá học `.khoahoc.gz`; tiêu đề `x-package-skipped` là số học liệu không đóng gói được |
| POST; GET | /api/v1/learning/template-packages | Nhập gói khoá học (multipart `file`) thành khoá mẫu nháp, trả `template_id`, `created_resources`, `reused`, `skipped`; nhật ký xuất, nhập |

### 17.8. Huy hiệu và chứng nhận hoàn thành (DT-28 phần 28i, YCTD-279)

Lỗi quy tắc 422 mã `YCTD-279`.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, PUT | /api/v1/learning/recognition/config | Ban Giám hiệu: `{ badges_enabled, certificates_enabled, certificate: { title, signer_title, signer_name } }` |
| GET | /api/v1/learning/spaces/{id}/recognition | Giáo viên xem được lớp học trực tuyến: từng học sinh (theo tên) với `completed`, huy hiệu, chứng nhận; `can_teach` |
| POST; DELETE | /api/v1/learning/spaces/{id}/badges; /api/v1/learning/badges/{id} | Trao huy hiệu `{ child_id, title, reason }`; thu hồi `{ reason }` |
| POST; POST | /api/v1/learning/spaces/{id}/certificates; /api/v1/learning/certificates/{id}/revoke | Cấp chứng nhận `{ child_id }` (khoá tự chọn, đã hoàn thành); thu hồi `{ reason }` |
| GET | /api/v1/learning/certificates/{id}/pdf | Tệp PDF cho giáo viên xem được lớp, phụ huynh của em |
| GET | /api/v1/learning/children/{childId}/recognition | Phụ huynh: `badges_enabled`, `certificates_enabled`, huy hiệu, chứng nhận của con |
| GET; GET | /api/v1/student/recognition; /certificates/{id}/pdf | Học sinh: huy hiệu, chứng nhận của em; tệp PDF |
| GET | /api/v1/public/certificates/{mã} | Trang kiểm tra công khai (HTML): tên khoá, họ tên viết tắt, ngày cấp, tên trường, trạng thái; không có thì 404 |

### 17.9. Học khi mạng yếu (DT-28 phần 28j, YCTD-280)

Lỗi quy tắc 422 mã `YCTD-280`. Tuyến nộp bài của học sinh `POST /api/v1/student/assignments/{id}/submit` nhận thêm `client_submit_key` (uuid), `client_submitted_at`; gửi lại cùng mã thì trả lần nộp đã nhận kèm `replayed: true`. Tuyến gửi tệp `POST /api/v1/student/assignments/{id}/items/{itemId}/files?client_key=` gửi lại cùng mã thì trả tệp đã nhận.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, PUT | /api/v1/learning/offline/config | Ban Giám hiệu: `{ enabled, retention_days }` (1 đến 7) |
| GET | /api/v1/student/offline | Học sinh: cấu hình học khi mạng yếu của trường |

### 17.10. Giờ học trực tuyến, phòng nhóm, phòng chia nhỏ (DT-28 phần 28g, YCTD-277)

Lỗi quy tắc 422 mã `YCTD-277`. Vào phòng trả `{ status, room_id, title, role, identity, url, token, can_speak, can_share }` như 27a. Hoạt động loại `live_session` tạo qua tuyến hoạt động của lõi với `opens_at` và `settings.duration_minutes`.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/learning/activities/{id}/live | Giáo viên: phòng, phòng chia nhỏ, lượt gọi giáo viên, thông báo, điểm danh gợi ý, bộ nhóm |
| POST | /api/v1/learning/activities/{id}/live/open | Giáo viên mở phòng giờ học và vào |
| POST | /api/v1/learning/activities/{id}/live/attendance | Xác nhận điểm danh `{ entries: [{ child_id, status: present \| absent \| excused }] }` |
| POST | /api/v1/learning/live/rooms/{id}/join, /leave, /end | Cán bộ vào, rời, kết thúc phòng |
| POST | /api/v1/learning/live/rooms/{id}/breakouts | Chia phòng `{ count \| group_set_id, minutes, seed? }` |
| POST | /api/v1/learning/live/rooms/{id}/breakouts/close | Gọi tất cả về phòng chính |
| POST | /api/v1/learning/live/rooms/{id}/notices, /move | Thông báo tới mọi phòng; chuyển học sinh `{ child_id, room_id }` |
| POST | /api/v1/learning/live/help/{id}/resolve | Đã hỗ trợ lượt gọi giáo viên |
| GET | /api/v1/learning/spaces/{id}/live-groups | Bộ nhóm, nhóm, phòng nhóm đang mở |
| PUT | /api/v1/learning/live/group-sets/{id} | Bật, tắt học sinh tự mở phòng `{ student_open }` |
| POST | /api/v1/learning/live/groups/{id}/open | Giáo viên mở phòng nhóm và vào |
| GET | /api/v1/student/live | Học sinh: giờ học đang mở, phòng chia nhỏ của em, phòng nhóm |
| POST | /api/v1/student/live/activities/{id}/join | Học sinh vào giờ học |
| POST | /api/v1/student/live/groups/{id}/open | Học sinh mở phòng nhóm (khi được bật, trong giờ mở) |
| GET | /api/v1/student/live/rooms/{id} | Trạng thái phòng: `teacher_watching`, thông báo, phòng chia nhỏ, `moved_to` |
| POST | /api/v1/student/live/rooms/{id}/join, /leave, /help, /report | Vào, rời phòng; gọi giáo viên; báo cáo `{ reason }` |

### 17.11. Gia sư AI nền tảng bán thẳng cho phụ huynh (YCTD-383 lát L1b)

Chỉ có ở nền tảng nhiều trường. Phần phụ huynh theo tên miền của trường, người gọi phải là cha mẹ, người giám hộ của con (403 nếu không). Phần vận hành ở đường dẫn không cần trường, chỉ ở tên miền `PLATFORM_CONSOLE_HOST` (tên miền khác 404), mã phiên vận hành vai trò `quan_tri` hoặc `ke_toan` (việc `ai-tutor.sales`; vai trò khác 403). Mua trùng gói tháng, gói ngừng bán, sai cấp học, tháng đã qua, giao dịch đã đổi trạng thái: 409. Tiền vào đi qua `POST /api/v1/platform-billing/webhooks/{provider}` có sẵn: nội dung chứa `GSAI...` thì xử lý ở đây, không đối chiếu với hóa đơn dịch vụ.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/ai-tutor/direct/children/{childId} | Phụ huynh: `{ school_level, payment: { available, provider, simulated }, current_month, next_month, plans, subscriptions, balance: { monthly, topUp }, orders, upgrade_options: [{ subscription_id, from_plan_name, plan_id, plan_name, price_difference, extra_turns, remaining_days, days_in_month }] }`; gói lọc theo cấp học của lớp đang học |
| POST | /api/v1/ai-tutor/direct/children/{childId}/upgrades | Phụ huynh nâng gói tháng của nền tảng đang dùng trong tháng này `{ plan_id }`: 201 giao dịch `upgrade` chờ thanh toán, số tiền là phần chênh lệch theo số ngày còn lại (YCTD-386); tiền vào thì áp lần nâng, cộng lượt cùng tỉ lệ |
| POST | /api/v1/ai-tutor/direct/children/{childId}/orders | Phụ huynh mua `{ plan_id, period_month? }` (gói tháng, mặc định tháng này): 201 giao dịch `pending` có `code`, `transfer_content`, `qr_content`, `pending_expires_at` |
| GET | /api/v1/ai-tutor/direct/orders/{id} | Phụ huynh: một giao dịch, kèm `receipt` khi đã thu, `refund` khi đã hoàn |
| POST | /api/v1/ai-tutor/direct/orders/{id}/cancel | Phụ huynh hủy giao dịch `pending` |
| POST | /api/v1/ai-tutor/direct/orders/{id}/simulate-payment | Giả lập tiền vào đủ số tiền; chỉ khi cổng mặc định của nền tảng là bộ giả lập (khác thì 404) |
| GET, POST | /api/v1/platform-ai-tutor/plans | Vận hành: danh sách gói kèm `paid_orders`; tạo gói `{ kind, name, price (1.000 đến 10.000.000), turns, allow_images (chỉ gói tháng), school_levels }` |
| PUT | /api/v1/platform-ai-tutor/plans/{id} | Sửa gói (không đổi `kind`); lần mua đã có giữ giá cũ |
| POST | /api/v1/platform-ai-tutor/plans/{id}/status | Ngừng bán, mở bán lại `{ status: active \| archived }` |
| GET | /api/v1/platform-ai-tutor/orders?status= | 200 giao dịch mới nhất: mã, trường, gói, số tiền, trạng thái, số biên lai, số đã hoàn |
| GET | /api/v1/platform-ai-tutor/orders/{id} | Chi tiết: người mua, biên lai, tiền vào của cổng, hoàn tiền kèm người thao tác |
| POST | /api/v1/platform-ai-tutor/orders/{id}/cancel | Hủy giao dịch `pending` `{ reason }` |
| POST | /api/v1/platform-ai-tutor/orders/{id}/refund | Hoàn tiền `{ amount? (mặc định đủ), reason }` cho giao dịch `paid` hoặc `needs_refund`; ghi nhật ký nền tảng. Giao dịch nâng gói: gói về gói trước khi nâng, bớt lượt đã cộng; chỉ hoàn được lần nâng gần nhất (409 nếu đã nâng tiếp) |

### 17.12. Gia sư AI do trường bán (YCTD-383 lát L1a, YCTD-387)

Quản trị dùng quyền `P01.integration.manage`; điểm cuối của phụ huynh chỉ cho người giám hộ của con (khác thì 403). Lỗi quy tắc 422 mã `BR-461` (cấp chưa bật), `BR-462` (mua: gói ngừng bán, sai cấp, tháng đã qua, đã có gói tháng trong tháng), `BR-463` (hủy), `BR-464` (nâng gói). Giá là số nguyên đồng.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/ai-tutor/school | Cài đặt `{ enabled_levels, quiet_start, quiet_end }`, `sales_block_reason` (lý do chưa bán được gói của trường khi gói dịch vụ chưa gán hoặc chưa đặt đơn giá AI, YCTD-383 lát L3; bán được thì `null`) và gói kèm `active_count` |
| PUT | /api/v1/ai-tutor/school/settings | Lưu `{ enabled_levels: ('TH' \| 'THCS' \| 'THPT')[], quiet_start: 'HH:MM', quiet_end: 'HH:MM' }`; bật cấp học khi gói dịch vụ chưa đặt đơn giá AI thì 422 `BR-475` (tắt hết cấp học vẫn lưu được) |
| POST | /api/v1/ai-tutor/school/plans | Tạo gói `{ kind: monthly \| top_up, name, price, turns, allow_images, school_levels, status? }` |
| PUT | /api/v1/ai-tutor/school/plans/{id} | Sửa gói, ngừng bán (`status: archived`) hoặc bán lại; không đổi `kind` |
| GET | /api/v1/ai-tutor/school/purchases?month=YYYY-MM | Lần mua và lần nâng gói của trường, có tên học sinh, `invoiced` |
| GET | /api/v1/children/{id}/ai-tutor | Phụ huynh: `enabled`, `current_month`, `next_month`, gói đang bán cho cấp của con, `balance { monthly, top_up }`, lần mua 12 tháng (cả hai nguồn) kèm `can_cancel`, `cancel_note`, lần nâng |
| POST | /api/v1/children/{id}/ai-tutor/purchases | Mua `{ plan_id, period_month (gói tháng, YYYY-MM-01), consent: true }`; kích hoạt ngay; trả lại trang của con. Gói dịch vụ của trường chưa đặt đơn giá AI thì 422 `BR-475` (cả khi nâng gói); trang của con trả `enabled: false` |
| POST | /api/v1/children/{id}/ai-tutor/purchases/{subscriptionId}/cancel | Hủy khi chưa lên hóa đơn học phí và con chưa dùng lượt |
| GET | /api/v1/children/{id}/ai-tutor/purchases/{subscriptionId}/upgrade-quote?plan_id= | Báo giá nâng gói `{ remaining_days, days_in_month, price_difference, extra_turns }` |
| POST | /api/v1/children/{id}/ai-tutor/purchases/{subscriptionId}/upgrade | Nâng gói `{ plan_id }`; áp ngay, phần chênh lệch vào hóa đơn học phí kỳ tới |

### 17.13. Học sinh trò chuyện với gia sư AI (YCTD-383 lát L2)

Chỉ có ở nền tảng nhiều trường và chỉ dùng khóa AI của nền tảng (Q8). Nhóm `/student/ai-tutor`: chỉ mã phiên kênh student, quyền `P02.learning.study`, chỉ hội thoại của chính em (hội thoại của em khác trả 404). Phiên xem hỗ trợ của quản trị nền tảng chỉ đọc: không gửi câu hỏi, không thấy hội thoại. Lỗi quy tắc 422 mã `BR-466` (hết lượt, nhà cung cấp lỗi, khóa), `BR-467` (chưa đủ hai lượt tự làm để xem lời giải), `BR-468` (câu có dữ liệu cá nhân). Mỗi câu hỏi tạm giữ một lượt trước khi gọi nhà cung cấp, trừ khi nhà cung cấp trả lời, hoàn khi lỗi, khi có dữ liệu cá nhân, khi bị kiểm duyệt hoặc ngoài học tập. Câu có dấu hiệu tự hại hoặc bị bắt nạt nhận câu trả lời theo mẫu có số 111, không gửi nhà cung cấp, ghi cờ ở `ai_tutor_safety_flags`.

Lát L3: gửi câu hỏi khi đang bị khóa trả 422 mã `BR-466`, `details` có `{ field: 'lock', message: <code> }`, không giữ lượt, không trừ lượt. Thứ tự khóa: `read_only`, `exam` (BR-471), `assignment` (BR-472), `quiet_hours` (BR-473). Cờ cảnh báo báo giáo viên chủ nhiệm và cha mẹ có tài khoản liên kết với em cùng lúc (BR-474) qua thông báo trong ứng dụng (hai thông báo riêng: `ai_tutor_safety_flag` cho giáo viên, `ai_tutor_safety_flag_guardian` cho cha mẹ); nhóm `/ai-tutor/safety-flags` dùng mã phiên của nhân viên (kênh student 403), không gắn quyền riêng: máy chủ chỉ trả cờ của em đang học lớp người xem chủ nhiệm, hoặc của lớp chưa có giáo viên chủ nhiệm khi người xem có vai trò VT-02, VT-15 (toàn trường hoặc đơn vị được gán); người khác nhận danh sách trống, đánh dấu cờ không được xem trả 404.

Lát L4 (ảnh bài tập, Q5): câu hỏi kèm ảnh gửi dạng `multipart/form-data` với các trường chữ như JSON và tối đa 3 tệp ở trường `images` (JPEG, PNG, WebP, mỗi tệp tối đa 4 MB). Em không có gói tháng đang dùng có quyền gửi ảnh nhận 422 `BR-500`, `details` có `{ field: 'images', message: 'plan' }`, không giữ lượt. Sai loại, quá số ảnh, ảnh hỏng, ảnh kèm `mode: solution` trả 400 `ERR_VALIDATION` (`field: 'images'`); ảnh quá cỡ dừng ở bộ nhận tệp, trả 400 "Tệp vượt dung lượng cho phép". Ảnh có thông tin cá nhân (`BR-501`) vẫn trả 201 với `turn: released`, câu trả lời theo mẫu bậc `safety`, không có ảnh trong tin nhắn.

Lát L5: em chưa có gói đang dùng hoặc đã hết lượt gửi lời nhờ cha mẹ (`BR-530`): máy chủ chọn lý do `no_plan` (chưa có gói) hoặc `no_turns` (hết lượt), tạo thông báo trong ứng dụng cho cha mẹ, người giám hộ có tài khoản liên kết với em (mẫu `ai_tutor_parent_request_plan`, `ai_tutor_parent_request_turns`, câu cố định có tên em, không có nội dung em gõ); mỗi lý do một lần trong 24 giờ; còn lượt, đã gửi trong 24 giờ, chưa có cha mẹ có tài khoản trả 422 `BR-530`, không tạo thông báo; phiên xem hỗ trợ 403. Cha mẹ thấy ba chủ đề nhiều nhất trong tháng (`BR-531`). Báo cáo tháng cho trường (`BR-532`) theo quy tắc tính của lát L2 (`BR-470`): lượt hỏi là lượt đã trừ trong tháng; token gồm cả câu được hoàn lượt; tách gói trường bán (vào hóa đơn dịch vụ) và gói nền tảng bán (chi phí của nền tảng); không có tên học sinh, không có nội dung.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/student/ai-tutor | Trang của em: `child { school_level, grade_level_code, class_name }`, `access { allowed, code?, title?, message? }` (điểm kiểm tra khóa duy nhất; lát L3: `code` là `read_only`, `exam`, `assignment`, `quiet_hours`), `ready`, `unavailable_reason`, `balance { monthly, top_up, remaining, total }`, `subscribed`, `subjects [{ code, name }]` của cấp, `conversations` (50 hội thoại gần nhất); lát L4: `images { allowed, max_count, max_bytes, retention_days }`; lát L5: `parent_request { reason: no_plan \| no_turns \| null, guardian_account, last_sent_at, next_allowed_at }` (phiên xem hỗ trợ: `null`) |
| GET | /api/v1/student/ai-tutor/conversations/{id} | Một hội thoại: `conversation`, `messages [{ id, role, body, image_text, images [{ id, content_type, deleted, deleted_label }], step, step_label, request_kind, blocked, reported, created_at }]` (lát L4: `image_text`, `images`), `attempts`, `solution_unlocked` |
| POST | /api/v1/student/ai-tutor/messages | Gửi `{ conversation_id?, subject_code? (hội thoại mới), text (1 đến 2.000 ký tự), mode: hint \| solution }`; `solution` chỉ khi đã có hai lượt tự làm; lát L4: dạng nhiều phần có thêm `images` (tối đa 3 ảnh, gói Nâng cao), có ảnh thì `text` được trống. 201 `{ conversation, messages: [câu hỏi, câu trả lời], turn: captured \| released, balance, attempts, solution_unlocked }`; câu bị kiểm duyệt vẫn 201 với `turn: released` |
| GET | /api/v1/student/ai-tutor/images/{id} | Lát L4: tải ảnh em đã gửi (`content-type` của ảnh, `cache-control: no-store`); chỉ ảnh trong hội thoại của chính em, không phiên xem hỗ trợ (403); ảnh của em khác hoặc đã xóa sau 30 ngày trả 404 |
| POST | /api/v1/student/ai-tutor/parent-requests | Lát L5: gửi lời nhờ cha mẹ, không có thân yêu cầu. 201 `{ reason, guardian_account, last_sent_at, next_allowed_at, notified }` (`notified`: số tài khoản cha mẹ nhận thông báo); 422 `BR-530` khi còn lượt, đã gửi cùng lý do trong 24 giờ, chưa có cha mẹ có tài khoản |
| POST | /api/v1/student/ai-tutor/messages/{id}/report | Báo câu trả lời sai `{ note? (tối đa 500 ký tự) }`; chỉ câu trả lời của gia sư trong hội thoại của em, trừ câu trả lời theo mẫu an toàn |
| GET | /api/v1/children/{id}/ai-tutor/topics | Cha mẹ, người giám hộ của con (khác thì 403; giáo viên 403): `month`, `turns_this_month`, `topics [{ subject_name, topic, turns, started_at, last_message_at }]`; lát L5: `top_topics [{ topic, turns }]` (ba chủ đề có nhiều lượt đã trừ nhất trong tháng); không có toàn văn, không có trích đoạn |
| GET | /api/v1/ai-tutor/school/report?month=YYYY-MM | Lát L5, quyền `P01.integration.manage` (trang Gia sư AI của cổng quản trị, MH-599); thiếu `month` thì tháng hiện tại giờ Việt Nam; sai dạng 400. `{ month, questions, students, refunded_answers_with_tokens, school { questions, requests, input_tokens, output_tokens, total_tokens }, platform { cùng các trường } }`; `school` là phần vào hóa đơn dịch vụ |

### 17.14. Giám thị: nội quy, khu vực, phân công trực (YCTD-391 lát L1)

Nhóm `/supervision`. Đọc danh mục cần `P02.supervision.record` hoặc `P02.supervision.manage`; sửa, phân công, tra người trực cần `P02.supervision.manage`. Cấp chỉ nhận `TH`, `THCS`, `THPT`. Giờ là giờ Việt Nam dạng `HH:MM`.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/supervision/zones | Khu vực: `id, name, description, order_no, status` |
| POST, PATCH | /api/v1/supervision/zones, /zones/{id} | Tạo `{ name, description?, order_no? }`; sửa thêm `status`; trùng tên 409 |
| GET | /api/v1/supervision/rule-items?school_level= | Mục nội quy kèm `class_criterion_name`, `class_criterion_points` |
| POST | /api/v1/supervision/rule-items | Tạo `{ code, name, kind: violation \| commendation, school_level, parent_notice?: none \| immediate \| daily_digest, class_criterion_id?, order_no? }`; tiêu chí nề nếp khác cấp hoặc ngược chiều 422 (`rule_code` YCTD-391) |
| POST | /api/v1/supervision/rule-items/defaults | Nạp bộ mặc định `{ school_level }`; trả `created`, `skipped` |
| PATCH | /api/v1/supervision/rule-items/{id} | Sửa `name, parent_notice, class_criterion_id (null là bỏ gắn), order_no, status`; gửi `code`, `kind`, `school_level` thì 400 |
| GET | /api/v1/supervision/staff-options | Nhân sự đang làm việc, đã có tài khoản, trong phạm vi đơn vị |
| GET | /api/v1/supervision/assignments?school_level=&staff_id= | Phân công kèm `staff_name` |
| POST | /api/v1/supervision/assignments | Tạo `{ staff_id, school_level, grade_levels[], zone_ids[], weekdays[1..7], start_time, end_time, from_date?, to_date?, note? }`; nhân sự đã nghỉ hoặc chưa có tài khoản 422 |
| PATCH | /api/v1/supervision/assignments/{id} | Sửa các trường trên trừ `staff_id`, thêm `status` |
| GET | /api/v1/supervision/my-scope (lát L2) | Lớp người dùng được ghi nhận (`classes`), `school_levels`, `can_manage`; cần `P02.supervision.record` hoặc `P02.supervision.manage` |
| GET | /api/v1/supervision/students?search=&class_id= (lát L2) | Học sinh đang học ở lớp trong phạm vi; tìm theo tên (ít nhất 2 ký tự) hoặc theo lớp; lớp ngoài phạm vi 403 |
| GET | /api/v1/supervision/records?from=&to=&class_id=&child_id=&mine=true (lát L2) | Ghi nhận theo ngày giờ Việt Nam: của mình và của lớp trong phạm vi (`mine=true` chỉ của mình); kèm `full_name`, `class_name`, `zone_name` |
| POST | /api/v1/supervision/records (lát L2) | Ghi `{ child_ids (1 đến 30), rule_item_id, occurred_at?, zone_id?, description?, evidence_file_ids? (tối đa 3 tệp `conduct_evidence` do mình tải, chưa gắn) }`; cần `P02.supervision.record`; học sinh ngoài phạm vi 403; mục khác cấp 422 (`rule_code` YCTD-391); trả `record_ids`, `class_points_added` (mục gắn tiêu chí nề nếp và trường đã bật nề nếp) |
| POST | /api/v1/supervision/records/{id}/revoke (lát L2) | Thu hồi `{ reason }`: người ghi trong ngày, giáo viên chủ nhiệm của lớp, người quản lý rèn luyện; xóa dòng điểm lớp đi kèm; đã thu hồi 422 |
| GET | /api/v1/supervision/on-duty?zone_id=&at= | Người đang trực khu vực ở thời điểm `at` (ISO 8601, mặc định bây giờ): `[{ user_id, staff_id, full_name }]`; trống là không ai trực. Máy chủ dùng cùng hàm `SupervisionService.findOnDutySupervisors` khi gửi cảnh báo camera (YCTD-389) |

### 17.15. Thẻ QR và lượt qua cổng (YCTD-389 lát L1)

Mã ở `apps/api/src/gate-passes/`. Lượt qua cổng là gợi ý cho giáo viên; chỉ "Đi muộn" từ thẻ được tự ghi.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/classes/{id}/gate-cards | Thẻ của học sinh đang học trong lớp: `class_name`, `children [{ child_id, full_name, code, issued_at }]`; quyền `P04.gate-card.manage` ở đơn vị của lớp, khác thì 403 |
| POST | /api/v1/classes/{id}/gate-cards | Cấp thẻ cho học sinh chưa có; `{ reissue_child_ids?: uuid[] }` cấp lại (thu hồi thẻ cũ). Học sinh ngoài lớp: 422. Trả như GET kèm `issued_count` |
| POST | /api/v1/gate-passes | Quét thẻ `{ code, direction: in \| out }`; mã gõ tay được (bỏ khoảng trắng, gạch nối, không phân biệt hoa thường); quyền `P04.gate-pass.record` ở đơn vị của học sinh (403). Mã sai dạng, thẻ đã thu hồi, học sinh không còn học: 422; không có thẻ: 404. Trả `{ id, child_id, child_name, class_name, direction, passed_at, duplicate, auto_late }`; báo phụ huynh `gate_arrived` hoặc `gate_left` (trong ứng dụng, đẩy theo nhóm `gate`) |
| GET | /api/v1/gate-passes/recent | 30 lượt mới nhất hôm nay trong phạm vi `P04.gate-pass.record` của người dùng; không có quyền: 403 |
| POST | /api/v1/gate-passes/{id}/reject | Báo nhận nhầm `{ note? }` (tối đa 500 ký tự): giáo viên chủ nhiệm của lớp hoặc người có `P04.attendance.manage` ở đơn vị (403); lượt đã báo nhầm: 422; phụ huynh nhận `gate_pass_corrected` |
| GET | /api/v1/children/{id}/gate-passes?from=&to= | Lượt của một học sinh, tối đa 31 ngày (422): người được xem hồ sơ em, phụ huynh của em; phụ huynh khác 403. Gồm lượt đã báo nhầm (`review_status`), bỏ lượt chờ xem |
| GET | /api/v1/classes/{id}/attendance | (Đã có) mỗi dòng thêm `gate { first_in_pass_id, first_in, last_out, first_in_method, suggested_status }` hoặc `null`; `suggested_status` là `present` khi vào trước hoặc đúng giờ học, `late` khi sau |

### 17.16. Thiết bị điểm danh, máy chấm công (YCTD-389 lát L2)

Mã ở `apps/api/src/gate-passes/attendance-devices.*`. Quyền quản lý `P04.gate-device.manage` (VT-02, VT-15, VT-03) theo đơn vị của thiết bị. Bộ giả lập: `scripts/gia-lap-may-cham-cong.mjs`.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/attendance-devices | Thiết bị trong phạm vi quyền: `id, org_unit_id, kind, name, location_name, direction, key_hint, last_seen_at, disabled_at, created_at` (không trả khóa, mã băm); không có quyền 403 |
| POST | /api/v1/attendance-devices | Khai báo `{ org_unit_id, kind, name (1 đến 120 ký tự), location_name?, direction: in \| out \| both }` (400 khi sai); 201 trả thiết bị kèm `key` (chỉ lần này) |
| POST | /api/v1/attendance-devices/{id}/rotate-key | Đổi khóa, khóa cũ hết hiệu lực ngay; trả thiết bị kèm `key` mới |
| POST | /api/v1/attendance-devices/{id}/disable | `{ disabled?: boolean }` (mặc định tắt) |
| POST | /api/v1/attendance-devices/{id}/import | Tệp `file` CSV hoặc xlsx (tối đa 5 MB, 5.000 dòng): cột "Mã", "Thời điểm" (giờ Việt Nam), "Hướng" tùy chọn. Trả `{ total, counts: { recorded, duplicate, unchanged, manual_kept, unknown_code, rejected }, errors: [{ line, message }] }` (tối đa 50 lỗi); nhập lại cùng tệp không ghi trùng |
| POST | /api/v1/device-events | Công khai, tiêu đề `x-device-key` (thiếu, sai, thiết bị đã tắt: 401). Thân `{ events: [{ external_id (1 đến 100 ký tự), code, direction?: in \| out, occurred_at (ISO 8601) }] }`, 1 đến 500 lượt (400). Trả `{ device_id, results: [{ external_id, status: recorded \| duplicate \| unchanged \| manual_kept \| unknown_code \| rejected, message? }] }` |

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
| KT-09 | Mỗi phụ huynh nhận tối đa 5 tin gửi ra ngoài mỗi ngày, gồm tin nhắn và tin qua Zalo Official Account, không tính mã một lần; thông báo trong ứng dụng không giới hạn (Q-96, YCTD-90) |

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
