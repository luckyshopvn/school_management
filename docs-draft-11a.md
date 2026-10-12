# Nháp tài liệu DT-11 phần 11a — Tuyển sinh trực tuyến

## YCTD

### YCTD-86: Tuyển sinh trực tuyến: đợt, hồ sơ, xét duyệt, chuyển hồ sơ trẻ, tin tuyển sinh – 2026-10-12

- Lý do: phần 11a của đợt DT-11 (giai đoạn 3), làm P16-01 đến P16-05, phạm vi G3-01 (tuyển sinh trực tuyến và chuyển hồ sơ tuyển sinh thành hồ sơ trẻ) và G3-07 (tin tuyển sinh). Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền dùng bốn quyền đã cấp trước ở tệp 0035 của định danh: `P16.admission-campaign.manage` (VT-12, VT-03) lập, sửa, mở, đóng đợt; `P16.application.manage` (VT-12, VT-03) nhập hộ, sửa, tiếp nhận hồ sơ và chuyển thành hồ sơ trẻ; `P16.application.review` (VT-03) xét đạt hoặc không đạt; `P16.admission-post.manage` (VT-12) soạn, công bố, ẩn tin. Người có một trong bốn quyền được xem đợt, hồ sơ, tin trong phạm vi đơn vị. Mọi thao tác kiểm tra quyền theo đơn vị của đợt (BR-01): người ở Trường chính có phạm vi toàn trường, người ở đơn vị cấp 2 chỉ đợt của đơn vị đó.
  - Đợt tuyển sinh thuộc một đơn vị và thuộc năm học đang dùng (lưu ở cơ sở dữ liệu năm học), không lưu `academic_year_id` như `16` dự kiến; trẻ chuyển vào lớp của năm học đang dùng. Trạng thái nháp, đang mở, đã đóng. Mở đợt khi hạn nhận hồ sơ chưa qua; đóng đợt thì thôi nhận hồ sơ trực tuyến, hồ sơ đã nhận vẫn xét và chuyển được; đợt đã đóng không sửa, không mở lại. Chỉ tiêu từ 1 đến 10.000, không giảm dưới số hồ sơ đã đạt hoặc đã chuyển.
  - Phụ huynh và người ngoài trường xem tin và nộp hồ sơ không cần tài khoản qua nhóm điểm cuối công khai `/api/v1/public/...` (bỏ qua xác thực bằng `@PublicEndpoint`), có kiểm tra dữ liệu vào và giới hạn theo địa chỉ mạng theo cùng cách cửa sổ cố định của khóa API đối tác: nộp hồ sơ tối đa 10 lần mỗi giờ, đọc tin và tra cứu tối đa 60 lần mỗi phút trên một địa chỉ (vượt trả `ERR_RATE_LIMIT` 429). Bộ đếm giữ trong bộ nhớ tiến trình máy chủ API; khi chạy nhiều tiến trình thì giới hạn tính theo từng tiến trình (cần chuyển sang kho dùng chung khi triển khai nhiều bản, ghi cho T6).
  - Chỉ nhận hồ sơ trực tuyến khi đợt đang mở và hôm nay trong khoảng nhận hồ sơ. Hồ sơ trực tuyến bắt buộc: họ tên, ngày sinh (không sau hôm nay), giới tính của trẻ, khai báo có hay không có dị ứng (ghi dị ứng gì khi có), họ tên và số điện thoại phụ huynh; không bắt buộc: số định danh cá nhân của trẻ (lưu mã hóa như hồ sơ trẻ, chỉ trả dạng che), thư điện tử, quan hệ với trẻ (chọn trong danh mục `parent_relationship`), địa chỉ, ghi chú. Không nhận tệp đính kèm trực tuyến; bản chụp giấy khai sinh do nhà trường tải khi chuyển thành hồ sơ trẻ.
  - Một trẻ chỉ một hồ sơ còn hiệu lực trong một đợt: trùng số điện thoại phụ huynh, họ tên (không phân biệt hoa thường, khoảng trắng) và ngày sinh với hồ sơ chưa bị từ chối trả `ERR_CONFLICT` kèm mã hồ sơ đã có.
  - Mã hồ sơ `TS-000001` theo năm học, dùng `nextDocumentCode` loại `admission_application`. Người nộp nhận mã ngay, tra cứu trạng thái bằng mã cùng số điện thoại đã khai; sai một trong hai trả cùng thông báo không tìm thấy. Tra cứu chỉ trả mã, tên trẻ, tên đợt, trạng thái, lý do không đạt, ngày nộp. Chưa gửi tin nhắn cho người nộp vì người nộp chưa có tài khoản (hàng đợi thông báo gửi theo tài khoản).
  - Trạng thái hồ sơ: đã nộp (trực tuyến) -> đã tiếp nhận -> đạt hoặc không đạt -> đã chuyển hồ sơ trẻ. Nhân viên tuyển sinh nhập hộ tại trường thì hồ sơ ở thẳng trạng thái đã tiếp nhận. Tiếp nhận kiểm tra đủ điều kiện tối thiểu của BR-06 (đã khai báo dị ứng; các trường còn lại bắt buộc từ lúc nộp). Sửa hồ sơ khi đã nộp hoặc đã tiếp nhận (gửi đầy đủ thông tin); không ghi đè số định danh khi để trống.
  - Xét duyệt: chỉ hồ sơ đã tiếp nhận được xét đạt, kèm ghi chú và lớp dự kiến tùy chọn; tổng hồ sơ đạt và đã chuyển không vượt chỉ tiêu (`ERR_RULE_VIOLATION` mã P16-03). Không đạt bắt buộc lý do, làm được với hồ sơ đã nộp hoặc đã tiếp nhận; không xét lại hồ sơ đã đạt hay không đạt.
  - Chuyển thành hồ sơ trẻ (P16-04, QT-01): chỉ hồ sơ đạt (hồ sơ khác trả `ERR_RULE_VIOLATION` mã P16-04, CT-077). Dùng lại đúng `ChildrenService`: tạo hồ sơ trẻ (kiểm tra trùng số định danh BR-07, nghi trùng họ tên và ngày sinh cần xác nhận, giấy khai sinh đúng loại và đơn vị, quan hệ trong danh mục), gửi trình duyệt (BR-06), rồi duyệt và phân lớp khi người chuyển có `P02.approve` ở đơn vị của lớp (quản lý đơn vị): trẻ đang học, lịch sử lớp, tài khoản VT-14 cho số điện thoại phụ huynh, thông báo giáo viên chủ nhiệm và kế toán như QT-01. Người chuyển không có quyền duyệt (nhân viên tuyển sinh) thì hồ sơ trẻ ở trạng thái chờ duyệt, quản lý đơn vị duyệt ở trang Hồ sơ trẻ như hồ sơ thường. Người chuyển nhập lớp, bản chụp giấy khai sinh (bắt buộc, theo BR-81), số định danh nếu hồ sơ chưa có, quan hệ nếu hồ sơ chưa có, có thể sửa khai báo dị ứng, xác nhận vượt sĩ số và xác nhận nghi trùng. Sĩ số được kiểm tra trước khi tạo hồ sơ trẻ. Đồng ý hình ảnh của trẻ chuyển sang ở trạng thái chờ phụ huynh xác nhận trên ứng dụng.
  - Lớp nhận trẻ phải đang hoạt động và thuộc đơn vị của đợt; đợt của Trường chính nhận được vào lớp của mọi đơn vị.
  - Hồ sơ trẻ đã sinh thì hồ sơ tuyển sinh ghi đã chuyển ngay (gắn `created_child_id`); nếu bước duyệt lỗi (ví dụ chưa tạo được tài khoản phụ huynh) thì trả `approval_error`, hồ sơ trẻ ở trạng thái chờ duyệt để duyệt lại ở trang Hồ sơ trẻ. Các bước tạo, gửi trình duyệt, duyệt chạy theo từng giao dịch của dịch vụ hồ sơ trẻ, không gộp một giao dịch.
  - Tin tuyển sinh gắn một đợt, phạm vi công bố theo đơn vị của đợt (BR-69); trạng thái nháp, đang đăng, đã ẩn (ẩn kèm lý do, công bố lại được). Thời hạn đăng mặc định bằng hạn nhận hồ sơ của đợt. Không lập, không công bố tin của đợt đã đóng. Trang công khai chỉ hiện đợt đang mở trong thời gian nhận hồ sơ kèm tin đang đăng trong khoảng ngày đăng, mỗi tin kèm thời hạn (CT-124).
  - Thông báo trong ứng dụng theo vai trò của đơn vị đợt: hồ sơ trực tuyến mới báo VT-12; hồ sơ đã tiếp nhận báo VT-03 chờ xét; hồ sơ đạt báo VT-12 chờ chuyển hồ sơ trẻ.
  - Nhật ký thao tác cho mọi thao tác ghi; hồ sơ nộp trực tuyến ghi người thực hiện là tài khoản hệ thống `00000000-0000-4000-8000-000000000086` tên "Phụ huynh nộp trực tuyến" kèm địa chỉ mạng; nhật ký không chứa số định danh dạng rõ.
  - Mở năm học mới: chuyển đợt còn nháp hoặc đang mở cùng tin chưa ẩn của đợt và hồ sơ chưa xong (đã nộp, đã tiếp nhận, đạt) giữ nguyên mã để phụ huynh tra cứu tiếp; lớp dự kiến bỏ trống; số hồ sơ năm mới đánh tiếp sau mã lớn nhất đã chuyển. Đợt đã đóng, hồ sơ không đạt hoặc đã chuyển tra ở năm cũ.
  - Cổng quản trị có trang Tuyển sinh (mục điều hướng "Tuyển sinh", nhóm TUYỂN SINH) với ba thẻ: Hồ sơ tuyển sinh (MH-26), Đợt tuyển sinh và Tin tuyển sinh (MH-63). Ứng dụng phụ huynh có trang Tuyển sinh trực tuyến không cần đăng nhập (MP-21), mở bằng nút "Tuyển sinh trực tuyến" trên màn hình đăng nhập hoặc địa chỉ có `#tuyen-sinh`.
- Thành phần bị ảnh hưởng: `07`, `08`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: ba bảng mới của năm học (tệp 0040): `admission_campaigns`, `admission_applications`, `admission_posts`; dòng `document_sequences` loại `admission_application`. Không thêm quyền mới (đã có ở tệp 0035 của định danh).
- API bị ảnh hưởng: nhóm điểm cuối P16 trong `17` mục 16 và nhóm công khai `/public/...` mới.
- Giao diện bị ảnh hưởng: MH-26, MH-63 mới, MP-21 mới, MH-47 (thêm nút Tuyển sinh trực tuyến).
- Quyền bị ảnh hưởng: PQ-49.
- Ảnh hưởng chức năng cũ: không đổi hành vi hồ sơ trẻ; màn hình đăng nhập ứng dụng phụ huynh thêm một nút.
- Kiểm thử cần thực hiện: CT-076, CT-077, CT-124; đề xuất CT-216 đến CT-221.
- Trạng thái: Đã triển khai

## Bảng

| admission_campaigns | Đợt tuyển sinh của một đơn vị trong năm học đang dùng (P16-01) | org_unit_id, name, description, quota, open_from, open_to, status (draft, open, closed), opened_at, closed_at, created_by |
| admission_applications | Hồ sơ tuyển sinh nộp trực tuyến hoặc nhập tại trường (P16-02 đến P16-04) | code (TS-000001), campaign_id, org_unit_id, source (online, staff), child_full_name, child_dob, child_gender, child_national_id_encrypted, child_national_id_hash, child_national_id_last4, child_has_allergies, child_allergies, guardian_full_name, guardian_phone, guardian_email, guardian_relationship_item_id, address, note, status (submitted, received, passed, rejected, converted), received_by, received_at, reviewed_by, reviewed_at, review_note, reject_reason, planned_class_id, created_child_id, converted_by, converted_at, submitted_ip, created_by |
| admission_posts | Tin tuyển sinh gắn đợt, phạm vi theo đơn vị của đợt (P16-05) | campaign_id, title, content, publish_from, publish_to, status (draft, published, hidden), published_at, hidden_reason, created_by |

## Điểm cuối

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

Giao kèo của nhóm điểm cuối tuyển sinh (DT-11 phần 11a, YCTD-86):

1. `GET /admission-campaigns`, `GET /admission-posts`, `GET /admission-applications`, `GET /admission-applications/{id}` cần một trong `P16.admission-campaign.manage`, `P16.application.manage`, `P16.application.review`, `P16.admission-post.manage`; chỉ trả bản ghi của đơn vị trong phạm vi. Đợt trả thêm `org_unit_name`, `application_count`, `passed_count` (đạt và đã chuyển), `converted_count`. Danh sách hồ sơ tối đa 500 dòng mới nhất, mỗi dòng `id`, `code`, `campaign_id`, `campaign_name`, `org_unit_id`, `source`, `child_full_name`, `child_dob`, `child_gender`, `guardian_full_name`, `guardian_phone`, `status`, `reject_reason`, `created_child_id`, `child_status`, `created_at`. Chi tiết không trả số định danh dạng mã hóa, trả `child_national_id_masked`, `guardian_relationship`, `planned_class_name`, `child_status`.
2. `POST /admission-campaigns` nhận `org_unit_id`, `name` (tối đa 200), `description`, `quota` (1 đến 10.000), `open_from`, `open_to` (không trước `open_from`); cần `P16.admission-campaign.manage` ở đơn vị; đơn vị ngừng dùng trả `ERR_VALIDATION`. `PATCH` nhận cùng trường trừ `org_unit_id`; đợt đã đóng hoặc chỉ tiêu nhỏ hơn số đạt trả `ERR_RULE_VIOLATION` mã P16-01. `open` chỉ với đợt nháp có hạn chưa qua; `close` chỉ với đợt đang mở; sai trả mã P16-01.
3. `POST /admission-posts` nhận `campaign_id`, `title` (tối đa 200), `content` (tối đa 10.000), `publish_from`, `publish_to` (tùy chọn, mặc định hạn nhận hồ sơ của đợt); cần `P16.admission-post.manage`. Đợt đã đóng trả `ERR_RULE_VIOLATION` mã P16-05. `publish` với tin chưa đăng; `hide` nhận `reason` bắt buộc với tin đang đăng.
4. `POST /public/admission-applications` không cần mã phiên; nhận `campaign_id`, `child_full_name` (tối đa 100), `child_dob`, `child_gender` (`male`, `female`), `child_has_allergies` (bắt buộc), `child_allergies` (bắt buộc khi có dị ứng), `child_national_id` (tùy chọn, 12 chữ số), `guardian_full_name`, `guardian_phone` (10 chữ số bắt đầu bằng 0), `guardian_email`, `guardian_relationship_item_id`, `address`, `note`. Đợt không mở hoặc ngoài thời gian nhận trả `ERR_RULE_VIOLATION` mã P16-02; trùng hồ sơ trả `ERR_CONFLICT`. Trả 201 `code`, `status`, `status_label`, `campaign_name`, `child_full_name`, `message`. `POST /admission-applications` (nhân viên) nhận cùng trường, `child_has_allergies` không bắt buộc ở bước đọc nhưng thiếu trả mã BR-06; cần `P16.application.manage` ở đơn vị của đợt; hồ sơ ở trạng thái `received`.
5. `GET /public/admissions` trả `campaigns` (đợt đang mở và hôm nay trong khoảng nhận hồ sơ: `id`, `name`, `description`, `quota`, `open_from`, `open_to`, `application_deadline`, `org_unit_name`, `org_unit_address`, `posts` gồm `id`, `title`, `content`, `publish_from`, `publish_to`, `published_at`, `deadline`) và `relationships` (`id`, `name`). `GET /public/admission-applications/lookup` nhận `code` (dạng TS-000001) và `phone`; không khớp trả `ERR_NOT_FOUND`; trả `code`, `child_full_name`, `campaign_name`, `status`, `status_label`, `reject_reason` (chỉ khi không đạt), `submitted_at`. Mỗi địa chỉ mạng nộp tối đa 10 hồ sơ mỗi giờ, đọc và tra cứu tối đa 60 yêu cầu mỗi phút; vượt trả `ERR_RATE_LIMIT`.
6. `PATCH /admission-applications/{id}` nhận đầy đủ trường như khi nộp trừ `campaign_id`; chỉ hồ sơ `submitted` hoặc `received`, khác trả mã P16-02. `receive` chỉ hồ sơ `submitted`; chưa khai báo dị ứng trả mã BR-06. `approve` cần `P16.application.review`, nhận `note`, `planned_class_id` (tùy chọn); chỉ hồ sơ `received`, đủ chỉ tiêu trả mã P16-03. `reject` cần `P16.application.review`, nhận `reason` bắt buộc; chỉ hồ sơ `submitted` hoặc `received`.
7. `POST /admission-applications/{id}/convert` cần `P16.application.manage` ở đơn vị của đợt và `P02.child.manage` ở đơn vị của lớp; nhận `class_id`, `birth_certificate_file_id` (tệp mục đích `birth_certificate` của đơn vị lớp), `national_id` (bắt buộc khi hồ sơ chưa có), `relationship_item_id` (bắt buộc khi hồ sơ chưa có), `has_allergies` (tùy chọn), `confirm_possible_duplicate`, `confirm_over_capacity`. Hồ sơ không ở trạng thái `passed` trả `ERR_RULE_VIOLATION` mã P16-04; lớp không thuộc đơn vị của đợt trả `ERR_VALIDATION`; lỗi của hồ sơ trẻ (trùng số định danh `ERR_CONFLICT`, nghi trùng mã QT-01, vượt sĩ số mã BR-04) trả nguyên. Trả `application`, `child` (`id`, `full_name`, `status` là `active` khi người chuyển có `P02.approve` ở đơn vị lớp, ngược lại `pending`; `current_class`, `guardians`) và `approval_error`.

## Màn hình

| MH-26 | Hồ sơ tuyển sinh và xét duyệt: trang Tuyển sinh thẻ Hồ sơ tuyển sinh, chọn đợt, lọc trạng thái, xem hồ sơ, tiếp nhận, xét đạt hoặc không đạt kèm lý do, chuyển hồ sơ đạt thành hồ sơ trẻ (chọn lớp, giấy khai sinh, số định danh, quan hệ) (YCTD-86) | VT-12, VT-03 |
| MH-63 | Đợt và tin tuyển sinh: trang Tuyển sinh thẻ Đợt tuyển sinh (lập, mở, đóng đợt, số hồ sơ và chỉ tiêu) và thẻ Tin tuyển sinh (soạn, công bố, ẩn tin kèm thời hạn) (YCTD-86) | VT-12, VT-03 |
| MP-21 | Tuyển sinh trực tuyến không cần đăng nhập: nút "Tuyển sinh trực tuyến" trên màn hình đăng nhập (MH-47), tin tuyển sinh của đợt đang mở kèm thời hạn, nộp hồ sơ, nhận mã hồ sơ, tra cứu trạng thái bằng mã và số điện thoại (YCTD-86) | Phụ huynh, người ngoài trường |

Ghi chú: 14 chưa có mã MP hoặc MG cho P16 nên đề xuất MP-21 (người điều phối đánh số lại nếu cần); MH-64 không dùng.

## Quyền

| PQ-49 | Tuyển sinh (YCTD-86): `P16.admission-campaign.manage` cho VT-12, VT-03 lập, sửa, mở, đóng đợt tuyển sinh trong đơn vị; `P16.application.manage` cho VT-12, VT-03 nhập hộ, sửa, tiếp nhận hồ sơ và chuyển hồ sơ đạt thành hồ sơ trẻ (cần thêm `P02.child.manage`; trẻ vào lớp ngay khi người chuyển có `P02.approve`, ngược lại chờ quản lý đơn vị duyệt); `P16.application.review` cho VT-03 xét đạt hoặc không đạt; `P16.admission-post.manage` cho VT-12 soạn, công bố, ẩn tin tuyển sinh. Người có một trong các quyền xem đợt, hồ sơ, tin trong phạm vi đơn vị. Phụ huynh và người ngoài trường xem tin, nộp, tra cứu hồ sơ không cần tài khoản, giới hạn theo địa chỉ mạng |

## Kết quả kiểm thử

Kiểm thử máy chủ `apps/api/src/admissions/admissions.test.ts`: 10/10 ca đạt.

- CT-076 đạt: `admissions.test.ts` ca "CT-076: chuyển hồ sơ tuyển sinh đã đạt sinh hồ sơ trẻ đang học, gắn phụ huynh, phân lớp"; kiểm thử giao diện `tests/e2e/40-admissions.spec.ts` (người điều phối chạy).
- CT-077 đạt: `admissions.test.ts` ca "CT-077: chuyển hồ sơ tuyển sinh chưa đạt bị từ chối".
- CT-124 đạt: `admissions.test.ts` ca "CT-124: P16-05 danh sách tin tuyển sinh của đợt đang mở kèm thời hạn, không cần đăng nhập"; kiểm thử giao diện `tests/e2e/40-admissions.spec.ts`.
- Đề xuất kịch bản mới (đã đạt trong `admissions.test.ts`):
  - CT-216 | P16-01 | Lập đợt nháp, mở đợt; giáo viên hoặc quản lý đơn vị khác lập đợt | Đợt nháp chưa nhận hồ sơ; mở xong nhận hồ sơ; người ngoài quyền hoặc ngoài đơn vị bị từ chối
  - CT-217 | P16-02 | Phụ huynh không đăng nhập nộp hồ sơ, tra cứu bằng mã và số điện thoại | Nhận mã TS-000001; nộp trùng bị báo; sai số điện thoại không tra được; số định danh hiện dạng che
  - CT-218 | P16-03 | Nhân viên tuyển sinh xét hồ sơ; quản lý đơn vị xét không đạt không ghi lý do | Bị từ chối; không đạt cần lý do, phụ huynh tra cứu thấy lý do
  - CT-219 | P16-03 | Xét đạt khi đã đủ chỉ tiêu; đóng đợt rồi nộp trực tuyến | Bị chặn mã P16-03; hồ sơ trực tuyến bị chặn mã P16-02, đợt không còn trên trang công khai
  - CT-220 | P16-04 | Nhân viên tuyển sinh chuyển hồ sơ đạt | Hồ sơ trẻ chờ duyệt; quản lý đơn vị duyệt ở trang Hồ sơ trẻ thì trẻ đang học
  - CT-221 | P16 | Gửi quá 10 hồ sơ trong một giờ từ một địa chỉ mạng | Bị chặn `ERR_RATE_LIMIT`
  - Ca chuyển năm học (đợt đang mở, tin, hồ sơ chưa xong được chuyển, số hồ sơ đánh tiếp) cũng đạt trong cùng tệp.
- Không chạy kiểm thử giao diện theo hướng dẫn; `tests/e2e/40-admissions.spec.ts` đã viết cho luồng chính (phụ huynh nộp hồ sơ trên ứng dụng phụ huynh không đăng nhập, cán bộ tiếp nhận, xét đạt, chuyển hồ sơ trẻ trên cổng quản trị, phụ huynh tra cứu thấy đã nhập học). Ca này cần cơ sở dữ liệu kiểm thử giao diện đã đặt mật khẩu mặc định phụ huynh (như `09-children.spec.ts`).

## Quy tắc

Không sửa BR có sẵn. Đề xuất ghi vào `07` (hoặc ghi trong mô tả P16 ở `10`) các ràng buộc dùng làm mã quy tắc trả về:

- P16-01: đợt tuyển sinh chỉ mở khi đang nháp và hạn nhận hồ sơ chưa qua; chỉ đóng khi đang mở; đợt đã đóng không sửa; chỉ tiêu không nhỏ hơn số hồ sơ đạt và đã chuyển.
- P16-02: chỉ nhận hồ sơ khi đợt đang mở và hôm nay trong khoảng nhận hồ sơ; một trẻ chỉ một hồ sơ còn hiệu lực trong một đợt; chỉ sửa hồ sơ chưa xét.
- P16-03: chỉ xét hồ sơ đã tiếp nhận; tổng hồ sơ đạt và đã chuyển không vượt chỉ tiêu; không đạt bắt buộc lý do.
- P16-04: chỉ chuyển hồ sơ đạt thành hồ sơ trẻ, mỗi hồ sơ một lần; hồ sơ trẻ sinh ra theo đúng QT-01.
- P16-05: tin tuyển sinh chỉ lập và công bố khi đợt chưa đóng; trang công khai chỉ hiện tin đang đăng của đợt đang nhận hồ sơ.
