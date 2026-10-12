# Nháp tài liệu phần 10f: Tương tác và đồ bị mất

## YCTD

### YCTD-79: Tương tác với phụ huynh và đồ bị mất của trẻ – 2026-10-12

- Lý do: phần 10f theo cách chia ở YCTD-73 (P15-01 đến P15-06, P02-11). Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền dùng các mã đã cấp trước ở tệp định danh 0033 (YCTD-73): `P15.interaction.manage` (VT-03, VT-02, VT-15) lập bình chọn, biểu quyết, khảo sát, danh mục khảo sát, xem kết quả, xử lý góp ý và bình luận; `P15.message.send` (VT-07, VT-03) trao đổi với phụ huynh; `P02.lost-item.manage` (VT-07, VT-03) xử lý phiếu đồ bị mất. Quyền theo phạm vi đơn vị chỉ tính vai trò quản lý (bỏ vai trò giáo viên và phụ huynh); giáo viên chỉ theo lớp đang được phân công. Phụ huynh tham gia không cần mã quyền: kiểm tra là phụ huynh của trẻ hoặc là đối tượng của bình chọn (BR-72).
  - Trao đổi hai chiều (P15-01): mỗi cặp trẻ và tài khoản phụ huynh có một luồng (`message_threads` duy nhất theo `child_id` + `guardian_user_id`), không gắn cố định một giáo viên (bỏ trường `teacher_id` của bảng dự kiến). Phía nhà trường là giáo viên đang được phân công (chủ nhiệm hoặc bộ môn có quyền) ở lớp hiện tại của trẻ và quản lý đơn vị; đổi lớp thì giáo viên lớp mới thấy luồng cũ. Phụ huynh mở luồng cho con mình; giáo viên mở luồng với phụ huynh của trẻ trong lớp (trẻ có nhiều phụ huynh dùng ứng dụng thì chọn phụ huynh). Tin của phụ huynh báo trong ứng dụng cho giáo viên chủ nhiệm của lớp; trẻ chưa có lớp hoặc lớp chưa có chủ nhiệm thì báo quản lý đơn vị (VT-03) theo vai trò. Tin của nhà trường báo phụ huynh của luồng. Ghi thời điểm đã đọc theo từng tin của phía bên kia khi người dùng mở luồng (BR-70); danh sách luồng có số tin chưa đọc. Không làm thời gian thực, không gửi tin nhắn SMS; tệp đính kèm chưa làm (để không đổi ràng buộc mục đích của bảng `files` đang dùng chung với các phần khác), tối đa 2000 ký tự mỗi tin.
  - Góp ý (P15-02): phụ huynh góp ý gắn với con (đơn vị theo trẻ); nhân sự góp ý cho đơn vị mình trong phạm vi vai trò. Chủ đề cố định: dạy học, chăm sóc, bữa ăn, cơ sở vật chất, học phí, khác. Mức riêng tư: ghi tên hoặc ẩn danh; góp ý ẩn danh không hiện người gửi và trẻ với người xử lý (vẫn lưu người gửi để người gửi xem lại góp ý của mình). Quản lý đơn vị nhận thông báo theo vai trò; người có `P15.interaction.manage` ghi đang xử lý (kèm chuyển người xử lý `assigned_to_user_id`, người đó nhận thông báo) hoặc đã xử lý (bắt buộc kết quả, người gửi nhận thông báo); góp ý đã xử lý không xử lý lại (P15-02).
  - Bình chọn, biểu quyết, khảo sát dùng chung bảng `polls` theo `poll_type`. Bình chọn và biểu quyết có một câu hỏi chọn một tạo tự động từ tiêu đề và danh sách phương án (tối thiểu hai); khảo sát có nhiều câu hỏi với loại chọn một, chọn nhiều, trả lời chữ, đánh giá từ 1 đến 5, lập tay qua API hoặc chép từ danh mục khảo sát. Phương án lưu theo câu hỏi (`poll_options.question_id`). Đối tượng: phụ huynh, nhân sự hoặc cả hai, của cả đơn vị hoặc một lớp (thay `scope_type`, `scope_id` bằng `class_id` + `audience`); phụ huynh là đối tượng khi có con đang học ở đơn vị hoặc lớp; nhân sự khi có vai trò ở đơn vị (gán ở Trường chính tính toàn trường) hoặc là giáo viên của lớp. Trạng thái: nháp, đang mở, đã đóng; mở thì đối tượng nhận thông báo (lớp: từng phụ huynh, giáo viên của lớp; đơn vị: theo vai trò VT-14, VT-07, VT-08); quản lý đóng sớm được. Không sửa, không xóa bình chọn ở phần này.
  - BR-67: mỗi tài khoản một phiếu (ràng buộc duy nhất trên `poll_responses`), phiếu thứ hai trả `ERR_RULE_VIOLATION` mã BR-67. BR-68: ngoài khoảng bắt đầu đến kết thúc, hoặc khi đã đóng, trả mã BR-68 kèm thông báo "Đã hết thời gian ..." hoặc "Chưa tới thời gian ...". Người quản lý không là đối tượng thì không gửi phiếu được.
  - Kết quả: người quản lý xem bất cứ lúc nào (số phiếu từng phương án, điểm trung bình, các câu trả lời chữ; với bình chọn không ẩn danh có danh sách người trả lời lấy tên theo hồ sơ phụ huynh); đối tượng xem khi quản lý bấm công bố kết quả, người đã gửi phiếu nhận thông báo.
  - Danh mục khảo sát (`survey_templates`) dùng chung toàn trường, tên không trùng, bộ câu hỏi lưu dạng JSON; người có `P15.interaction.manage` ở bất kỳ đơn vị nào thêm, ngừng dùng, dùng lại; khảo sát chép câu hỏi tại thời điểm lập nên sửa mẫu sau không đổi khảo sát đã lập.
  - Bình luận và lượt thích (P15-06) làm ở mức chung cho đối tượng của P15 theo cặp `target_type` + `target_id` (bảng `interaction_comments`, `interaction_likes`, điểm cuối `/interaction-comments`, `/interaction-likes`); hiện có loại `poll`, lượt thích có thêm loại `comment`. Phần 10e có bình luận riêng trên nội dung P14 (`activity_comments`, `content_comments`, `/comments/{id}/hide`); người điều phối thống nhất hai cách khi gộp (đề xuất: giữ chung một bảng theo cặp loại và mã đối tượng).
  - BR-66: không có thao tác xóa bình luận. Người xem báo bình luận tiêu cực (ghi `reported_at`, quản lý đơn vị nhận thông báo theo vai trò); quản lý đơn vị ẩn kèm lý do, hiện lại hoặc ghi chú xử lý; mỗi lần xử lý một dòng `comment_moderations`; nội dung bình luận giữ nguyên. Bình luận ẩn chỉ người quản lý và người viết còn thấy (người viết thấy đã bị ẩn và lý do).
  - Lượt thích bật tắt: thích lần nữa là bỏ thích (xóa dòng thích; lượt thích không phải chứng từ nên không áp BR-75). Bình luận đã ẩn không thích được.
  - Đồ bị mất (P02-11): phụ huynh báo mất đồ của con (trạng thái đã báo), giáo viên chủ nhiệm của lớp hiện tại nhận thông báo (không có chủ nhiệm thì quản lý đơn vị); giáo viên, quản lý cũng lập được phiếu báo mất cho trẻ trong phạm vi (phụ huynh nhận thông báo). Giáo viên, quản lý ghi nhận đồ nhặt được theo lớp, trẻ không bắt buộc (trạng thái đã tìm thấy). Người xử lý (giáo viên chủ nhiệm của lớp có `P02.lost-item.manage` hoặc quản lý trong đơn vị) đánh dấu đã tìm thấy, đóng phiếu với kết quả đã trả hoặc không tìm thấy; phụ huynh nhận thông báo mỗi lần. Mã phiếu `DBM-000001` theo năm học. Ngày phát hiện không sau hôm nay, mặc định hôm nay.
  - Xóa phiếu đồ bị mất (`DELETE /lost-items/{id}`) là hủy (trạng thái đã hủy, không xóa cứng): người báo hoặc người xử lý hủy được phiếu đang báo; phiếu đã đóng (đã trả, không tìm thấy) trả mã BR-75; phiếu đã tìm thấy hoặc đã hủy trả mã P02-11.
  - Ảnh đồ bị mất: bảng có `photo_file_id` nhưng API chưa nhận ảnh ở phần này, cùng lý do với tệp đính kèm tin nhắn; làm khi thống nhất mục đích tệp mới (`lost_item_photo`, `message_attachment`).
  - Mở năm học mới: chuyển danh mục khảo sát; luồng trao đổi, góp ý, bình chọn, bình luận, phiếu đồ bị mất tra ở năm cũ. Bước chuyển chạy sau bước chuyển kho.
  - Giao diện: nhóm điều hướng mới "TƯƠNG TÁC" với mục "Tương tác với phụ huynh" (`/interactions`, MH-25) gồm các thẻ theo quyền: bình chọn và khảo sát, danh mục khảo sát, góp ý, trao đổi, đồ bị mất, bình luận cần xử lý. Trang khảo sát trên cổng quản trị lập từ danh mục khảo sát (lập câu hỏi tay chỉ qua API). Ứng dụng giáo viên: nút "Trao đổi lớp ..." mở màn hình trao đổi với phụ huynh và đồ bị mất của lớp (MG-08, MG-15). Ứng dụng phụ huynh: nút "Trao đổi" trên thẻ của con mở nhắn giáo viên, báo mất đồ, góp ý (MP-09, MP-10, MP-19); bình chọn, khảo sát đang mở hiển thị ở trang chủ ngay dưới mục xác nhận người đón, kèm kết quả đã công bố, bình luận và lượt thích (MP-17).
- Thành phần bị ảnh hưởng: `07`, `08`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: mười ba bảng mới của năm học (tệp 0035); không thêm quyền (đã có ở tệp 0033 của định danh).
- API bị ảnh hưởng: các điểm cuối P15 và đồ bị mất trong `17`.
- Giao diện bị ảnh hưởng: MH-25, MG-08, MG-15, MP-09, MP-10, MP-17, MP-19.
- Quyền bị ảnh hưởng: PQ-44.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CT-073, CT-074, CT-075, CT-107, CT-108, CT-109.
- Trạng thái: Đã triển khai

## Bảng

Thay mục 16 (P15) và dòng `lost_items` của mục P02:

| Bảng | Mục đích | Trường chính |
|---|---|---|
| message_threads | Luồng trao đổi, một luồng cho mỗi trẻ và tài khoản phụ huynh | org_unit_id, child_id, guardian_user_id, created_by, last_message_at |
| messages | Tin nhắn | thread_id, sender_user_id, sender_side (guardian, staff), sender_name, content, sent_at, read_at, read_by |
| feedbacks | Góp ý | org_unit_id, child_id, submitted_by_user_id, submitter_name, category, content, privacy_level (named, anonymous), status (received, in_progress, resolved), assigned_to_user_id, handled_by, handled_at, handling_note |
| survey_templates | Danh mục khảo sát chung toàn trường | name (duy nhất), description, questions (JSON: question_text, answer_type, is_required, options), status |
| polls | Bình chọn, biểu quyết, khảo sát | org_unit_id, poll_type (poll, vote, survey), title, description, class_id, audience (guardians, staff, everyone), start_at, end_at, is_anonymous, survey_template_id, status (draft, open, closed), published_at, closed_at, results_published_at, created_by |
| poll_questions | Câu hỏi (bình chọn và biểu quyết có một câu) | poll_id, question_text, answer_type (single_choice, multiple_choice, text, rating), order_no, is_required |
| poll_options | Phương án của câu hỏi | poll_id, question_id, label, order_no |
| poll_responses | Phiếu trả lời | poll_id, user_id, submitted_at |
| poll_answers | Câu trả lời chi tiết | response_id, question_id, option_id, answer_text, answer_number |
| interaction_comments | Bình luận trên đối tượng của P15 | org_unit_id, target_type (poll), target_id, user_id, author_name, author_side, content, reported_at, reported_by, hidden_at, hidden_by, hide_reason |
| comment_moderations | Bản ghi xử lý bình luận | comment_id, action (hide, restore, note), reason, handled_by, handled_at |
| interaction_likes | Lượt thích | target_type (poll, comment), target_id, user_id |
| lost_items | Đồ bị mất của trẻ | code (DBM-000001), org_unit_id, child_id, class_id, report_type (lost, found), description, noticed_on, photo_file_id, status (reported, found, returned, not_found, cancelled), reported_by, reported_at, found_by, found_at, found_note, closed_by, closed_at, result_note, cancelled_by, cancelled_at |

Ràng buộc duy nhất: `poll_responses` trên bộ đôi bình chọn và tài khoản; `message_threads` trên bộ đôi trẻ và tài khoản phụ huynh; `interaction_likes` trên bộ ba loại đối tượng, mã đối tượng và tài khoản.

## Điểm cuối

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
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

## Màn hình

| Mã | Màn hình | Vai trò chính |
|---|---|---|
| MH-25 | Tương tác với phụ huynh: bình chọn, biểu quyết, khảo sát (lập nháp, mở, đóng, kết quả, công bố kết quả); danh mục khảo sát; góp ý và xử lý; trao đổi với phụ huynh của đơn vị; phiếu đồ bị mất; bình luận bị báo cần xử lý (YCTD-79) | VT-03, VT-02, VT-15; VT-07 thẻ trao đổi và đồ bị mất |
| MG-08 | Trao đổi với phụ huynh: luồng của trẻ trong lớp kèm số tin chưa đọc, trả lời, nhắn phụ huynh một trẻ (YCTD-79) | VT-07 |
| MG-15 | Đồ bị mất của lớp: phiếu của lớp, đánh dấu đã tìm thấy, đã trả, không tìm thấy; ghi nhận đồ nhặt được (YCTD-79); chung màn hình với MG-08 | VT-07 |
| MP-09 | Trao đổi với nhà trường: nhắn giáo viên chủ nhiệm của lớp con, tải lại để thấy trả lời (YCTD-79) | VT-14 |
| MP-10 | Góp ý: chủ đề, nội dung, ẩn danh; xem trạng thái và kết quả xử lý (YCTD-79) | VT-14 |
| MP-17 | Bình chọn, biểu quyết, khảo sát đang mở ở trang chủ: gửi phiếu một lần, kết quả đã công bố, bình luận, thích (YCTD-79) | VT-14 |
| MP-19 | Mất đồ: báo mất đồ của con, xem kết quả, hủy phiếu đang báo (YCTD-79) | VT-14 |

## Quyền

| PQ-44 | Tương tác và đồ bị mất (YCTD-79): `P15.interaction.manage` cho VT-03, VT-02, VT-15 lập bình chọn, biểu quyết, khảo sát và danh mục khảo sát, xem và công bố kết quả, xử lý góp ý, ẩn bình luận kèm lý do trong phạm vi đơn vị; `P15.message.send` cho VT-07 trao đổi với phụ huynh của trẻ trong lớp được phân công và VT-03 trong đơn vị; `P02.lost-item.manage` cho VT-07 với phiếu của lớp mình và VT-03 trong đơn vị; phụ huynh nhắn giáo viên, góp ý, báo mất đồ cho con mình, trả lời bình chọn mình là đối tượng mà không cần mã quyền riêng |

## Kết quả kiểm thử

Kiểm thử máy chủ `apps/api/src/interactions/interactions.test.ts`: 9/9 ca đạt.

| Mã | Kết quả | Tệp kiểm thử |
|---|---|---|
| CT-073 | Đạt: phiếu thứ hai cùng tài khoản trả 422 mã BR-67 | `apps/api/src/interactions/interactions.test.ts` (P15-03, CT-073) |
| CT-074 | Đạt: biểu quyết đã hết thời gian trả 422 mã BR-68, thông báo "Đã hết thời gian biểu quyết, không nhận phiếu" | `apps/api/src/interactions/interactions.test.ts` (P15-04, CT-074) |
| CT-075 | Đạt: quản lý đơn vị ẩn bình luận bị báo kèm lý do; nội dung giữ nguyên, có một dòng `comment_moderations`; không có thao tác xóa (404) | `apps/api/src/interactions/interactions.test.ts` (P15-06, CT-075) |
| CT-107 | Đạt: phiếu ở trạng thái đã báo, giáo viên chủ nhiệm của lớp có thông báo, giáo viên lớp khác không | `apps/api/src/interactions/interactions.test.ts` (P02-11, CT-107); luồng giao diện `tests/e2e/35-interactions.spec.ts` (người điều phối chạy) |
| CT-108 | Đạt: phụ huynh trẻ A gọi phiếu và danh sách của trẻ B trả 403 `ERR_FORBIDDEN` | `apps/api/src/interactions/interactions.test.ts` (P02-11, CT-108) |
| CT-109 | Đạt: xóa phiếu đã đóng trả 422 mã BR-75, phiếu vẫn ở trạng thái đã trả; phiếu đang báo hủy được | `apps/api/src/interactions/interactions.test.ts` (P02-11, CT-109) |

Kiểm thử giao diện `tests/e2e/35-interactions.spec.ts` (phụ huynh báo mất đồ và nhắn giáo viên; giáo viên thấy phiếu, đánh dấu đã tìm thấy, trả lời; phụ huynh tải lại thấy kết quả): đã viết, chưa chạy theo hướng dẫn (người điều phối chạy).

## Quy tắc

- BR-66 đề xuất bổ sung: "... bình luận ẩn vẫn được lưu; mỗi lần xử lý (ẩn, hiện lại, ghi chú) có một bản ghi xử lý kèm lý do và người xử lý; bình luận ẩn chỉ quản lý đơn vị và người viết còn thấy."
- BR-67, BR-68: giữ nguyên.
