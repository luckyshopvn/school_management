# 17. ĐẶC TẢ API

- Mô tả: Điểm cuối, phương thức, yêu cầu, phản hồi, xác thực, phân quyền, kiểm tra dữ liệu, xử lý lỗi, phân trang, lọc, sắp xếp, phiên bản.
- Phiên bản: 1.52
- Ngày cập nhật: 2026-10-11
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
8. Giao diện lập trình ứng dụng này do hai dịch vụ máy chủ phục vụ (cổng vào chuyển `/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`, `/api/v1/permissions`, `/api/v1/api-clients` sang dịch vụ định danh, phần còn lại sang máy chủ API): nhóm điểm cuối xác thực, quản lý tài khoản và quản lý khóa API của đối tác do **dịch vụ định danh** phục vụ (QĐ-17); các nhóm còn lại do **máy chủ API nghiệp vụ** phục vụ. Hai dịch vụ dùng chung một tiền tố phiên bản và một mô hình lỗi.
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

Thay bảng phần bếp ở mục 15 của `17_DAC_TA_API.md`:


|---|---|---|

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
3. `GET /medication-requests` nhận `child_id`, `status`, `org_unit_id`, `class_id` (lọc theo lớp hiện tại của trẻ); mỗi dòng có `full_name`, `class_name`, `current_class_id`, `administrations` (mảng liều đã ghi). Tối đa 200 dòng mới nhất.
4. `POST /medication-requests/{id}/receive` nhận `received_quantity`, `received_note` (tùy chọn); `POST /medication-requests/{id}/reject` nhận `reason` (bắt buộc); `POST /medication-requests/{id}/complete` không nhận thân. Không ở trạng thái phù hợp trả `ERR_RULE_VIOLATION` (nhận: mã BR-49; từ chối, kết thúc: mã P10-04). Không có quyền theo BR-86 trả `ERR_FORBIDDEN`.
5. `POST /medication-administrations` nhận `request_id`, `scheduled_date` (trống là hôm nay, không sau hôm nay), `scheduled_time` (một trong `times`), `is_skipped`, `skip_reason` (bắt buộc khi bỏ liều), `dose_note`. Yêu cầu chờ nhận trả mã BR-49; yêu cầu đã kết thúc hoặc ngày ngoài thời gian dùng thuốc trả mã P10-04; liều đã ghi trả `ERR_CONFLICT` với `details` gồm `administration_id` và `existing` (nội dung đã ghi). Ghi đủ liều theo lịch thì yêu cầu tự chuyển `completed`.
6. `POST /medication-administrations/{id}/acknowledge` chỉ phụ huynh của trẻ, chỉ với liều bỏ (liều đã cho uống trả mã BR-88); gọi lại trả thời điểm xác nhận lần đầu.
7. `GET /medication-schedules` nhận `date` (trống là hôm nay), `org_unit_id`, `class_id`; trả từng giờ của các yêu cầu đang cho uống trong ngày: `request_id`, `child_id`, `full_name`, `class_name`, `medicine_name`, `dosage`, `scheduled_date`, `scheduled_time`, `administration` (liều đã ghi hoặc `null`), `can_administer`.
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
| POST | /api/v1/academic-years/{id}/open | Mở năm học: kiểm tra BR-89, BR-94, tạo cơ sở dữ liệu năm học, chuyển dữ liệu dùng chung, trẻ, lớp, quỹ, công nợ (YCTD-69), chuyển năm đang dùng sang đã đóng và chỉ đọc (BR-93) |
| POST | /api/v1/academic-years/{id}/close | Bỏ ngày 09/10/2026: gộp vào mở năm học mới (YCTD-37) |

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
5. `POST /medical-events` nhận `child_id`, `occurred_at` (ISO 8601, không sau hiện tại), `symptoms`, `handling`, `handler_name` (trống là người ghi), `severity` (`mild`, `moderate`, `severe`). `GET /medical-events` nhận `child_id` hoặc `org_unit_id`, `from`, `to`. `POST /medical-events/{id}/acknowledge` chỉ phụ huynh của trẻ, gọi lại trả thời điểm xác nhận lần đầu.
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

Giao kèo của thanh toán trực tuyến (DT-05 phần 5f, YCTD-57):

1. `GET /invoices/{id}/payment-qr` cho phụ huynh của trẻ hoặc người có `P06.receipt.manage` ở đơn vị; trả `amount`, `transfer_content`, `virtual_account_number`, `qr_content`, `bank_name`, `account_name`, `expires_at`. Hóa đơn đã thu đủ trả `ERR_RULE_VIOLATION` mã BR-31; chưa cấu hình tài khoản nhận hoặc chưa nối nhà cung cấp trả mã P06-11.
2. `PUT /online-payment-settings` nhận `account_id` (tài khoản ngân hàng đang dùng của Trường chính) và `category_id` (khoản mục thu); cần `P06.cash-account.manage` ở Trường chính.
3. `GET /online-payment-transactions?status=pending` trả giao dịch chưa khớp và chưa xử lý kèm `match_status` (`wrong_amount`, `unknown_invoice`, `already_paid`); giao dịch chưa xác định trẻ hiện cho kế toán mọi đơn vị. `POST /online-payment-transactions/{id}/resolve` nhận `note` bắt buộc, `receipt_id` không bắt buộc; giao dịch đã khớp hoặc đã xử lý trả mã P06-11.
4. `POST /payment-webhooks/development` nhận `provider_transaction_ref`, `virtual_account_number`, `amount`, `transfer_content`; trả giao dịch kèm `match_status`, `receipt_id`.

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
| GET | /api/v1/children | Danh sách trẻ có lọc và phân trang |
| POST | /api/v1/children | Tạo hồ sơ trẻ |
| GET | /api/v1/children/{id} | Chi tiết hồ sơ trẻ |
| GET | /api/v1/children/{id}/national-id | Xem đầy đủ số định danh cá nhân; chỉ VT-02, VT-15, VT-03, VT-12; ghi nhật ký truy cập |
| GET | /api/v1/children/{id}/photo-consent | Trạng thái và lịch sử đồng ý hình ảnh (YCTD-67) |
| POST | /api/v1/children/{id}/photo-consent | Phụ huynh đồng ý hoặc rút đồng ý; nhà trường ghi nhận giấy ký tay |
| PUT | /api/v1/children/{id}/staff-child | Gắn hoặc bỏ cờ trẻ con nhân viên (YCTD-67) |
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
| GET, POST | /api/v1/suppliers | Danh sách và thêm nhà cung cấp của đơn vị |
| PUT | /api/v1/suppliers/{id} | Sửa hoặc ngừng dùng nhà cung cấp |
| POST | /api/v1/fiscal-periods/{id}/request-close | Kế toán trưởng đề nghị chốt kỳ tài chính |
| POST | /api/v1/fiscal-periods/{id}/close | Hiệu trưởng phê duyệt và chốt kỳ tài chính |
| GET, POST | /api/v1/cashflow-categories | Khoản mục và nhóm thu chi |
| PATCH | /api/v1/cashflow-categories/{id} | Sửa, ngừng sử dụng khoản mục (YCTD-49) |

## 11. Nhân sự, chấm công và tiền lương

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/staff | Danh sách và tạo hồ sơ nhân sự |
| GET, PUT | /api/v1/staff/{id} | Chi tiết kèm hợp đồng và cập nhật hồ sơ nhân sự (YCTD-58) |
| GET | /api/v1/staff/me | Hồ sơ và hợp đồng của chính mình (YCTD-58) |
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
| GET, POST | /api/v1/medicines | Danh mục thuốc theo đơn vị; tạo thuốc kèm tồn đầu (YCTD-75) |
| PATCH | /api/v1/medicines/{id} | Sửa tên, hoạt chất, đơn vị tính, nhà thuốc, trạng thái; không sửa tồn |
| GET, POST | /api/v1/pharmacies | Nhà thuốc theo đơn vị |
| PATCH | /api/v1/pharmacies/{id} | Sửa nhà thuốc |
| GET, POST | /api/v1/medication-requests | Danh sách và gửi yêu cầu dặn thuốc |
| GET | /api/v1/medication-requests/{id} | Chi tiết yêu cầu kèm các liều đã ghi và `can_administer` |
| POST | /api/v1/medication-requests/{id}/receive | Xác nhận đã nhận thuốc |
| POST | /api/v1/medication-requests/{id}/reject | Từ chối nhận thuốc kèm lý do |
| POST | /api/v1/medication-requests/{id}/complete | Kết thúc sớm yêu cầu đang cho uống |
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
| GET, POST | /api/v1/menus | Thực đơn tuần của đơn vị; lập thực đơn nháp |
| GET | /api/v1/menus/{id} | Chi tiết thực đơn kèm món |
| PUT | /api/v1/menus/{id}/items | Thay toàn bộ món của thực đơn nháp |
| POST | /api/v1/menus/{id}/submit | Bếp trình duyệt thực đơn |
| POST | /api/v1/menus/{id}/approve | Duyệt và công bố thực đơn |
| POST | /api/v1/menus/{id}/reject | Trả lại thực đơn kèm lý do |
| GET | /api/v1/menus/{id}/norms | Định lượng nguyên liệu của thực đơn trong một ngày theo số suất |
| GET | /api/v1/children/{id}/menus | Thực đơn đã công bố và buffet đã duyệt của tuần cho phụ huynh của trẻ |
| GET | /api/v1/meal-plans | Số suất ăn theo ngày của đơn vị theo từng lớp |
| POST | /api/v1/meal-plans/compute | Tính và lưu số suất ăn của ngày |
| GET | /api/v1/kitchen/daily-norms | Định lượng nguyên liệu của ngày cho cả đơn vị |
| GET, POST | /api/v1/classes/{id}/meal-report | Xem và gửi báo cơm của lớp |
| GET, POST | /api/v1/buffet-events | Tiệc buffet theo dịp |
| POST | /api/v1/buffet-events/{id}/approve | Duyệt buffet |
| POST | /api/v1/buffet-events/{id}/cancel | Hủy buffet |
| GET, POST | /api/v1/market-purchases | Phiếu đi chợ của đơn vị; lập phiếu nháp |
| GET | /api/v1/market-purchases/{id} | Chi tiết phiếu đi chợ kèm chênh lệch với định lượng |
| POST | /api/v1/market-purchases/{id}/receive | Xác nhận nhập nguyên liệu, chuyển đề nghị thanh toán |
| POST | /api/v1/market-purchases/{id}/cancel | Hủy phiếu nháp |
| POST | /api/v1/market-purchases/{id}/link-payment | Kế toán gắn phiếu chi đã phát hành |
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

## 16. Nội dung, tương tác và tuyển sinh

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET, POST | /api/v1/activities | Danh sách (lọc lớp, trẻ, trạng thái, đơn vị) và tạo hoạt động (chờ duyệt, hoặc nháp khi `draft`) |
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
| GET | /api/v1/reports/activities | Báo cáo hoạt động và công việc |
| GET | /api/v1/reports/consolidated | Báo cáo hợp nhất nhiều đơn vị |
| GET | /api/v1/reports/saturday-classes | Báo cáo học thứ 7: số trẻ đi học và vắng của từng ngày học bù |
| POST | /api/v1/reports/{code}/export | Xuất báo cáo ra tệp |
| GET | /api/v1/notifications | Danh sách thông báo của người đăng nhập |
| POST | /api/v1/notifications/{id}/read | Đánh dấu đã đọc |
| POST | /api/v1/notifications/read-all | Đánh dấu đọc tất cả (YCTD-64) |
| GET | /api/v1/notifications/{id}/receipts | Ai đã đọc, ai chưa đọc (BR-70, YCTD-64) |
| GET | /api/v1/notification-templates | Mẫu thông báo theo mã (YCTD-64) |
| PUT, DELETE | /api/v1/notification-templates/{code} | Sửa mẫu hoặc dùng lại nội dung gốc |
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
