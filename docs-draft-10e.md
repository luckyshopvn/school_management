# Nháp tài liệu phần 10e: Hoạt động, hình ảnh, tin tức, thư viện, ngoại khóa

## YCTD

### YCTD-78: Hoạt động, hình ảnh, tin tức, thư viện, ngoại khóa – 2026-10-12

- Lý do: phần 10e theo cách chia ở YCTD-73 (P14-01 đến P14-06, P14-09 đến P14-12). P14-07 thuộc G1 (đã làm ở YCTD-64), P14-08 thuộc G3 nên không làm. Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền dùng đã cấp trước ở tệp 0033 định danh: `P14.activity.create` (VT-07, VT-08) lập hoạt động cho lớp đang được phân công (chủ nhiệm hoặc bộ môn); `P14.activity.approve` (VT-03, VT-15, VT-02) duyệt, từ chối, ẩn, công bố lại hoạt động trong phạm vi đơn vị; `P14.content.manage` (VT-03) danh mục hoạt động, danh mục tin tức, tin tức; `P14.library.manage` (VT-03, VT-07) chủ đề thư viện, album, nội dung thư viện, hình tô màu; `P14.extracurricular.manage` (VT-03, VT-07) hoạt động ngoại khóa; `P14.comment.moderate` (VT-03, VT-07) ẩn bình luận. Phụ huynh đăng ký ngoại khóa, thích, bình luận cho con mình không cần mã quyền riêng (kiểm tra là phụ huynh của trẻ, BR-72). Quyền văn phòng tính theo vai trò không phải giáo viên, không phải phụ huynh; phạm vi theo đơn vị được gán, gán ở Trường chính là toàn trường.
  - Hoạt động của lớp (P14-01, BR-64): giáo viên tạo thì hoạt động ở trạng thái chờ duyệt ngay (thông báo VT-03, VT-15 của đơn vị); giáo viên chọn "Lưu nháp" để thêm hình trước rồi gửi duyệt sau. Trạng thái: nháp, chờ duyệt, đã công bố, bị từ chối, đã ẩn. Sửa nội dung, thêm hoặc gỡ hình khi nháp, chờ duyệt hoặc bị từ chối; sửa hoạt động bị từ chối thì về nháp; hoạt động đã công bố không sửa được (QT-10 E6, mã BR-64). Tiêu đề tối đa 200 ký tự, nội dung tối đa 5 000 ký tự. Danh mục phải đang dùng, thuộc đơn vị của lớp hoặc Trường chính.
  - Duyệt (P14-02, Q-72): người duyệt là vai trò văn phòng có `P14.activity.approve` phủ đơn vị của hoạt động; giáo viên bộ môn duyệt trả `ERR_FORBIDDEN` (CT-072). Duyệt là công bố ngay, phụ huynh của trẻ đang học trong lớp nhận thông báo. Từ chối, ẩn bắt buộc lý do, người tạo nhận thông báo; công bố lại hoạt động đã ẩn. Chuyển trạng thái kiểm tra trạng thái cũ trong cùng câu lệnh, đổi đồng thời trả `ERR_CONFLICT`.
  - Hình ảnh (P14-04, BR-65): ảnh JPEG hoặc PNG tối đa 10 MB, mục đích tệp mới `activity_photo`, tối đa 30 ảnh mỗi hoạt động (Q-71). Khi tải ảnh, giáo viên gắn thẻ trẻ của lớp có trong ảnh; trẻ chưa đồng ý (`children.photo_consent` khác `granted`) thì trả `warnings` và hình đó bị loại trừ, không hiển thị và không tải được với phụ huynh (mã BR-65), nhân sự vẫn thấy kèm tên trẻ chưa đồng ý (CT-071). Điều kiện xét lúc đọc nên khi phụ huynh rút đồng ý thì mọi hình đã công bố có gắn thẻ trẻ đó tự ẩn, tệp không bị xóa (QT-10 bước 12); đồng ý lại thì hình hiện lại. Không có nhận diện khuôn mặt, gắn thẻ là thao tác của giáo viên.
  - Lượt thích một lần mỗi tài khoản (bỏ thích được); bình luận của mọi loại nội dung lưu chung một bảng `content_comments` (đối tượng `activity`, `news`, `library_item`, `library_album`) thay vì tách `activity_comments`; chỉ bình luận nội dung đã công bố.
  - Bình luận (P14-12, BR-66): không có thao tác xóa; `DELETE /content-comments/{id}` luôn trả `ERR_RULE_VIOLATION` mã BR-66 (CT-123). Ẩn bình luận bắt buộc lý do, người ẩn là vai trò văn phòng có `P14.comment.moderate` hoặc `P14.activity.approve` ở đơn vị; giáo viên có `P14.comment.moderate` ẩn bình luận trên hoạt động của lớp mình được phân công hoặc nội dung do mình tạo. Bình luận ẩn vẫn lưu, người quản lý thấy kèm lý do, phụ huynh không thấy. Phụ huynh bình luận thì người tạo nội dung và VT-03 của đơn vị nhận thông báo. Chưa làm luồng "chuyển phản hồi tiêu cực cho quản lý xử lý riêng" ngoài thông báo này.
  - Danh mục (P14-03, P14-05, P14-06): danh mục hoạt động, danh mục tin tức, chủ đề thư viện theo đơn vị (tên duy nhất trong đơn vị, thứ tự, trạng thái); danh mục của Trường chính dùng chung mọi đơn vị; mọi người dùng trong đơn vị đọc được danh mục đang dùng.
  - Phạm vi công bố (BR-69) cho tin tức, nội dung thư viện, hình tô màu: `school` (toàn trường, chỉ người có phạm vi toàn trường chọn được), `unit` (mặc định, đơn vị của nội dung, chỉ vai trò văn phòng), `class`, `child` (thuộc đơn vị của nội dung). Giáo viên có `P14.library.manage` chỉ công bố cho lớp mình được phân công hoặc trẻ của lớp đó, chỉ sửa nội dung do mình tạo. Trạng thái nội dung: nháp, đã công bố, đã ẩn (ẩn bắt buộc lý do; công bố lại bằng công bố). Phụ huynh thấy nội dung đã công bố có phạm vi là toàn trường, đơn vị của con, lớp của con hoặc chính con; nhân sự thấy theo đơn vị được gán và lớp được phân công.
  - Tin tức (P14-05): VT-03 soạn, công bố; công bố thì phụ huynh nhận thông báo (theo vai trò VT-14 của đơn vị khi phạm vi đơn vị hoặc toàn trường; phụ huynh của lớp hoặc của trẻ khi phạm vi lớp, trẻ). Nội dung thư viện, hình tô màu không gửi thông báo.
  - Tệp nội dung: mục đích tệp mới `content_file` (ảnh JPEG, PNG hoặc PDF tối đa 10 MB) cho ảnh bìa tin tức, tài liệu thư viện, ảnh bìa album, hình tô màu; tải lên bằng `POST /content-files` khi có một trong các quyền P14 quản lý nội dung ở đơn vị; người quản lý của đơn vị xem mọi tệp, người khác chỉ xem tệp gắn với nội dung đã công bố trong phạm vi xem. Ảnh hoạt động và tệp nội dung đi qua điểm cuối riêng, không qua `POST /files`.
  - Album thư viện (P14-12): người có `P14.library.manage` lập album theo đơn vị (tên, chủ đề, ảnh bìa, trạng thái); nội dung thư viện gắn album bằng `album_id`; người xem thấy album đang dùng có ít nhất một nội dung đã công bố trong phạm vi.
  - Hình tô màu (P14-09): tên, chủ đề (chữ tự do), độ tuổi, tệp bắt buộc, phạm vi công bố như thư viện.
  - Hoạt động ngoại khóa (P14-10): VT-03 hoặc VT-07 lập theo đơn vị với tên, mô tả, ngày bắt đầu, ngày kết thúc, bậc học được đăng ký (trống là mọi bậc), chỉ tiêu (1 đến 10 000, bắt buộc), cách thu phí `free`, `per_activity`, `monthly` và mức phí (miễn phí là 0, có phí lớn hơn 0). Trạng thái nháp, đã công bố, đã đóng. Đã công bố thì không đổi phí, ngày bắt đầu; chỉ tiêu không giảm dưới số trẻ đang đăng ký.
  - Đăng ký ngoại khóa (P14-11): phụ huynh của trẻ, hoặc nhân sự có `P14.extracurricular.manage` hay `P05.registration.manage` ở đơn vị của trẻ (VT-04 đăng ký thay). Chỉ hoạt động đã công bố, chưa kết thúc, trẻ đang học trong đơn vị của hoạt động, đúng bậc học; mỗi trẻ một đăng ký đang hiệu lực mỗi hoạt động (trùng trả `ERR_CONFLICT`). Đếm chỉ tiêu trong giao dịch có khóa dòng hoạt động; đủ chỉ tiêu trả `ERR_RULE_VIOLATION` mã `P14-11` kèm câu "đã đủ chỉ tiêu, hết chỗ" (CT-121). Ngày hiệu lực là hôm nay hoặc ngày bắt đầu nếu sau hôm nay. Thôi tham gia: đăng ký chuyển `withdrawn`, ngày kết thúc hiệu lực là hôm nay.
  - Phí ngoại khóa (BR-19, BR-85): dòng khoản phải thu loại mới `extracurricular` trong `invoice_items` kèm `extracurricular_registration_id`, không gắn dịch vụ nên miễn giảm theo dịch vụ không áp. Phí theo tháng thu đủ mỗi kỳ mà đăng ký còn hiệu lực ít nhất một ngày trong tháng (kể cả tháng bắt đầu giữa tháng), không giảm trừ khi trẻ nghỉ buổi hay thôi giữa tháng (CT-130, CT-131); phí theo hoạt động thu một lần ở kỳ của ngày hiệu lực, thôi không hoàn. Khi đăng ký có phí: hóa đơn chính kỳ đó đã phát hành thì lập ngay hóa đơn bổ sung đã phát hành (mã HD-, hạn nộp là hạn của hóa đơn chính hoặc hôm nay nếu đã qua; báo phụ huynh và VT-04) (CT-122); hóa đơn chính còn nháp thì thêm dòng vào nháp và tính lại miễn giảm chờ duyệt; chưa tính thì lần tính học phí của kỳ lấy vào. Lần tính học phí bỏ đăng ký đã lập khoản thu ở hóa đơn bổ sung cùng kỳ (theo tháng) hoặc ở hóa đơn khác (theo hoạt động) để không thu trùng. Không dùng bảng `services` và `service_registrations` vì giá ngoại khóa theo từng hoạt động, không theo bậc học và biểu phí.
  - Mở năm học mới: bước chuyển `activities` chạy sau bước kho, chuyển danh mục hoạt động, danh mục tin tức, chủ đề thư viện, album thư viện, nội dung thư viện và hình tô màu có phạm vi toàn trường hoặc đơn vị kèm dòng tệp; nội dung theo lớp, theo trẻ không chuyển. Hoạt động của lớp, tin tức, bình luận, ngoại khóa và đăng ký tra ở năm cũ.
  - Màn hình: cổng quản trị trang "Hoạt động và tin tức" (`/activities`), nhóm điều hướng mới "HOẠT ĐỘNG VÀ TRUYỀN THÔNG", các thẻ Duyệt hoạt động, Danh mục, Tin tức (kèm bình luận và ẩn bình luận), Thư viện và hình tô màu, Ngoại khóa (lập, công bố, đóng, danh sách đăng ký). Ứng dụng giáo viên màn hình mới "Hoạt động lớp <tên lớp>" (tạo, gửi duyệt, lưu nháp, tải ảnh gắn thẻ trẻ có ghi chú trẻ chưa đồng ý). Ứng dụng phụ huynh nút "Hoạt động" trong thẻ của trẻ: hoạt động đã công bố của lớp kèm ảnh, thích, bình luận; tin tức; ngoại khóa với đăng ký và thôi tham gia.
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `14`, `16`, `17`, `21`, `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API (phân hệ mới `activities`, tính học phí), cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: mười bốn bảng mới của năm học (tệp 0034): `activity_categories`, `news_categories`, `library_topics`, `activities`, `activity_media`, `activity_media_children`, `activity_likes`, `news`, `library_albums`, `library_items`, `coloring_pages`, `content_comments`, `extracurricular_activities`, `extracurricular_registrations`; `invoice_items` thêm cột `extracurricular_registration_id` và loại dòng `extracurricular`; `files.purpose` thêm `activity_photo`, `content_file` (ràng buộc tạo lại gồm cả `medicine_photo`, `prescription` của phần 10b). Không dùng bảng `activity_comments` dự kiến. Không thêm quyền mới (đã cấp ở tệp 0033 định danh).
- API bị ảnh hưởng: nhóm điểm cuối nội dung, tương tác trong mục 16 của `17`; `GET /invoices/{id}` có thêm dòng `item_type` `extracurricular`.
- Giao diện bị ảnh hưởng: MH-23, MH-24, MH-36, MG-07, MP-14, MP-16, MP-20.
- Quyền bị ảnh hưởng: PQ-43.
- Ảnh hưởng chức năng cũ: tính học phí kỳ thêm dòng phí ngoại khóa; thêm một bước chuyển năm học (sau bước kho). Các kiểm thử học phí cũ (`fee-calculation`, `fee-scenarios`, `discounts`, `registrations`) và chuyển năm học chạy lại đều đạt.
- Kiểm thử cần thực hiện: CT-069, CT-070, CT-071, CT-072, CT-121, CT-122, CT-123, CT-130, CT-131; kiểm thử giao diện `tests/e2e/34-activities.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

| activity_categories | Danh mục hoạt động theo đơn vị (P14-03) | org_unit_id, name (duy nhất trong đơn vị), order_no, status, created_by |
| news_categories | Danh mục tin tức theo đơn vị (P14-05) | org_unit_id, name (duy nhất trong đơn vị), order_no, status, created_by |
| library_topics | Chủ đề thư viện theo đơn vị (P14-06) | org_unit_id, name (duy nhất trong đơn vị), order_no, status, created_by |
| activities | Hoạt động của lớp (P14-01, P14-02) | org_unit_id, class_id, category_id, title, content, activity_date, status (draft, pending, published, rejected, hidden), created_by, created_by_name, submitted_at, approved_by, approved_at, reject_reason, published_at, hidden_reason, hidden_by, hidden_at |
| activity_media | Ảnh của hoạt động (P14-04) | activity_id, file_id (mục đích activity_photo), caption, order_no, created_by; tối đa 30 ảnh mỗi hoạt động |
| activity_media_children | Trẻ được gắn thẻ trong ảnh (BR-65) | media_id, child_id (khóa chính đôi); ảnh hiển thị cho phụ huynh khi mọi trẻ được gắn đang đồng ý hình ảnh |
| activity_likes | Lượt thích | activity_id, user_id (khóa chính đôi), created_at |
| news | Tin tức (P14-05) | org_unit_id, category_id, title, summary, content, cover_file_id, scope_type (school, unit, class, child), scope_id, status (draft, published, hidden), published_at, published_by, hidden_reason, hidden_by, hidden_at, created_by |
| library_albums | Album thư viện (P14-12) | org_unit_id, topic_id, title, cover_file_id, status |
| library_items | Nội dung thư viện (P14-06) | org_unit_id, topic_id, album_id, title, description, age_group, file_id, scope_type, scope_id, status, published_at, hidden_reason |
| coloring_pages | Hình tô màu (P14-09) | org_unit_id, title, topic, age_group, file_id (bắt buộc), scope_type, scope_id, status, published_at, hidden_reason |
| content_comments | Bình luận trên hoạt động, tin tức, nội dung và album thư viện (P14-12, BR-66) | target_type (activity, news, library_item, library_album), target_id, org_unit_id, user_id, author_name, is_parent, content, created_at, hidden_reason, hidden_by, hidden_at; không xóa |
| extracurricular_activities | Hoạt động ngoại khóa (P14-10) | org_unit_id, name, description, start_date, end_date, grade_levels, quota (lớn hơn 0), fee_type (free, per_activity, monthly), fee_amount, status (draft, published, closed) |
| extracurricular_registrations | Đăng ký ngoại khóa (P14-11) | activity_id, child_id, org_unit_id, registered_by, registered_at, effective_from, effective_to, status (active, withdrawn), withdrawn_by, withdrawn_at; một đăng ký đang hiệu lực mỗi trẻ mỗi hoạt động |

Bổ sung bảng có sẵn: `invoice_items` thêm `extracurricular_registration_id` và `item_type` nhận thêm `extracurricular`; `files.purpose` thêm `activity_photo`, `content_file`. Bỏ bảng dự kiến `activity_comments` (gộp vào `content_comments`).

## Điểm cuối

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

## Màn hình

| MH-23 | Danh sách hoạt động và duyệt hoạt động: trang Hoạt động và tin tức, thẻ Duyệt hoạt động lọc theo trạng thái, duyệt và công bố, từ chối hoặc ẩn kèm lý do, công bố lại; cảnh báo ảnh có trẻ chưa đồng ý hình ảnh (YCTD-78) | VT-03, VT-15, VT-02 |
| MH-24 | Tin tức, thư viện, thông báo: trang Hoạt động và tin tức, thẻ Danh mục (danh mục hoạt động, danh mục tin tức, chủ đề thư viện), Tin tức (soạn, công bố, ẩn, xem và ẩn bình luận kèm lý do), Thư viện và hình tô màu (tải tệp, lưu, công bố, ẩn); thông báo ở trang Thông báo (YCTD-64, YCTD-78) | VT-03, VT-07 |
| MH-36 | Hoạt động ngoại khóa và danh sách đăng ký: trang Hoạt động và tin tức, thẻ Ngoại khóa: lập hoạt động có chỉ tiêu, cách thu phí, mức phí; công bố, đóng; xem danh sách đăng ký (YCTD-78) | VT-03, VT-07 |
| MG-07 | Tạo hoạt động và album hình ảnh: nút "Hoạt động và hình ảnh" ở mỗi lớp, tạo hoạt động gửi duyệt hoặc lưu nháp, tải ảnh và gắn thẻ trẻ, ghi chú trẻ chưa đồng ý hình ảnh, xem trạng thái và lý do từ chối (YCTD-78) | VT-07, VT-08 |
| MP-14 | Hoạt động và hình ảnh: nút "Hoạt động" trong thẻ của trẻ, hoạt động đã công bố của lớp kèm ảnh, thích, bình luận (YCTD-78) | VT-14 |
| MP-16 | Tin tức, thông báo, thư viện, hình tô màu: tin tức đã công bố trong mục Hoạt động của trẻ; thông báo ở mục Thông báo (YCTD-64, YCTD-78); thư viện và hình tô màu chưa có danh sách riêng trên ứng dụng phụ huynh (giao diện lập trình đã có) | VT-14 |
| MP-20 | Hoạt động ngoại khóa: trong mục Hoạt động của trẻ, danh sách hoạt động ngoại khóa, mức phí, chỗ còn lại, đăng ký và thôi tham gia (YCTD-78) | VT-14 |

## Quyền

| PQ-43 | Hoạt động, hình ảnh, tin tức, thư viện, ngoại khóa (YCTD-78): `P14.activity.create` cho VT-07, VT-08 lập hoạt động và tải ảnh cho lớp được phân công; `P14.activity.approve` cho VT-03, VT-15, VT-02 duyệt, từ chối, ẩn, công bố lại hoạt động và ẩn bình luận trong đơn vị; `P14.content.manage` cho VT-03 quản lý danh mục hoạt động, danh mục tin tức, tin tức; `P14.library.manage` cho VT-03 (mọi phạm vi trong đơn vị) và VT-07 (lớp mình, nội dung mình tạo) quản lý chủ đề, album, thư viện, hình tô màu; `P14.extracurricular.manage` cho VT-03, VT-07 lập hoạt động ngoại khóa và đăng ký thay; `P14.comment.moderate` cho VT-03 (đơn vị) và VT-07 (hoạt động của lớp mình, nội dung mình tạo) ẩn bình luận kèm lý do; `P05.registration.manage` (VT-04) đăng ký ngoại khóa thay phụ huynh; phụ huynh đăng ký, thích, bình luận cho con mình không cần mã quyền; không ai xóa được bình luận |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt 12/12 ca ngày 12/10/2026:

- P14-03: quản lý đơn vị lập danh mục; giáo viên lập bị `ERR_FORBIDDEN`; trùng tên `ERR_CONFLICT`. Đạt.
- CT-069: giáo viên chủ nhiệm tạo hoạt động ở trạng thái chờ duyệt; phụ huynh không thấy trong danh sách, xem chi tiết bị `ERR_FORBIDDEN`; giáo viên không phụ trách lớp không tạo được. Đạt.
- CT-071: ảnh gắn trẻ A (đồng ý) và trẻ B (chưa xác nhận) trả cảnh báo cho trẻ B, ảnh bị loại trừ; ảnh chỉ gắn trẻ A không cảnh báo; gắn trẻ lớp khác bị từ chối. Đạt.
- CT-072: giáo viên bộ môn duyệt bị `ERR_FORBIDDEN`. Đạt.
- CT-070: quản lý duyệt; phụ huynh của lớp thấy hoạt động kèm đúng một ảnh (ảnh có trẻ chưa đồng ý không hiển thị, tải bị mã BR-65); phụ huynh lớp khác không thấy; nhân sự thấy cả hai ảnh kèm tên trẻ chưa đồng ý; thích và bình luận được; giáo viên không sửa được hoạt động đã công bố. Đạt.
- BR-65: trẻ A rút đồng ý thì ảnh đã công bố tự ẩn với phụ huynh. Đạt.
- Q-72: ẩn thiếu lý do bị từ chối; ẩn thì phụ huynh không thấy; công bố lại. Đạt.
- CT-123: phụ huynh bình luận tin tức; xóa bình luận trả mã BR-66; ẩn thiếu lý do bị từ chối, phụ huynh khác ẩn bị `ERR_FORBIDDEN`; quản lý ẩn kèm lý do; phụ huynh không còn thấy, quản lý vẫn thấy nội dung và lý do. Kèm: tin chưa công bố phụ huynh không thấy; tin theo lớp chỉ phụ huynh của lớp đó thấy. Đạt.
- P14-06, P14-09, P14-12: giáo viên tải tệp nội dung, công bố cho đơn vị bị từ chối, công bố cho lớp mình được; tệp chỉ phụ huynh lớp đó tải được sau khi công bố; album đếm nội dung đã công bố theo phạm vi; hình tô màu phạm vi đơn vị hiển thị cho phụ huynh lớp khác. Đạt.
- CT-121: hoạt động miễn phí chỉ tiêu 1; chưa công bố không đăng ký được; trẻ A đăng ký được; trẻ B bị từ chối mã `P14-11` "hết chỗ"; phụ huynh không đăng ký cho con người khác; còn 0 chỗ. Đạt.
- CT-122: hóa đơn chính kỳ hiện tại đã phát hành; đăng ký hoạt động thu theo hoạt động 150 000 thì lập hóa đơn bổ sung 150 000 một dòng `extracurricular`; hóa đơn chính giữ nguyên. Đạt.
- CT-130, CT-131: hoạt động thu theo tháng 300 000; tính học phí tháng A có dòng "Ngoại khóa: Năng khiếu vẽ" 300 000 và tổng khớp các dòng; trẻ C thôi giữa tháng B và nghỉ ba buổi, hóa đơn tháng B vẫn có đúng một dòng 300 000, không có dòng âm, không có miễn giảm; tháng C trẻ C không còn phí, trẻ A vẫn thu. Đạt.

Kiểm thử học phí và chuyển năm học chạy lại sau khi sửa tính học phí: `fees/fee-calculation` 11/11, `fees/fee-scenarios` 8/8, `fees/discounts` 17/17, `fees/registrations` 17/17, `academic-years/year-transition` 6/6, `academic-years/academic-years` 13/13, đều đạt.

Kiểm thử giao diện `tests/e2e/34-activities.spec.ts` đã viết (giáo viên tạo hoạt động gửi duyệt trên ứng dụng giáo viên, phụ huynh chưa thấy; quản lý đơn vị duyệt trên cổng quản trị; phụ huynh thấy hoạt động đã công bố), chưa chạy theo hướng dẫn chung; người điều phối chạy.

## Quy tắc

- BR-64 đề xuất bổ sung: "... Giáo viên có thể lưu nháp để thêm hình rồi gửi duyệt. Hoạt động đã công bố không sửa được; quản lý đơn vị hoặc Ban Giám hiệu ẩn kèm lý do và công bố lại (Q-72)" (YCTD-78).
- BR-65 đề xuất bổ sung: "... Giáo viên gắn thẻ trẻ có trong ảnh; ảnh có trẻ chưa đồng ý không hiển thị cho phụ huynh. Khi phụ huynh rút đồng ý, mọi ảnh đã công bố có gắn thẻ trẻ đó tự ẩn, tệp không bị xóa" (YCTD-78).
- BR-66 đề xuất bổ sung: "Không bình luận nào bị xóa, kể cả của phụ huynh; ..." (YCTD-78).
- BR-19 đề xuất bổ sung: "... các dịch vụ khác đã đăng ký, phí hoạt động ngoại khóa đã đăng ký (theo tháng thu đủ mỗi kỳ đăng ký còn hiệu lực, không giảm trừ khi nghỉ buổi hoặc thôi giữa tháng; theo hoạt động thu một lần) và các khoản phát sinh" (YCTD-78).
