# Nháp tài liệu DT-11 phần 11b — Tuyển dụng (YCTD-87)

## YCTD

### YCTD-87: Tuyển dụng phần đề nghị, tin, ứng viên, phỏng vấn – 2026-10-12

- Lý do: phần 11b theo cách chia đợt DT-11 (YCTD-85), làm P18-01 đến P18-04, mục phạm vi G3-02. Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền dùng các mã đã cấp trước ở tệp 0035 của định danh: `P18.recruitment-request.create` (VT-06, VT-03) lập đề nghị cho đơn vị trong phạm vi; `P18.recruitment-request.approve` (VT-02, VT-15) duyệt hoặc từ chối trong phạm vi đơn vị được gán (VT-02 ở Trường chính là toàn trường); `P18.recruitment.manage` (VT-06) soạn, công bố, đóng tin, tiếp nhận, nhập, sàng lọc ứng viên, tải hồ sơ xin việc, tạo hồ sơ nhân sự từ ứng viên đã tuyển; `P18.interview.manage` (VT-06, VT-03) lên lịch, hủy lịch, ghi kết quả phỏng vấn và quyết định tuyển.
  - Đề nghị tuyển dụng (P18-01): vị trí, số lượng (1 đến 1000), yêu cầu, lý do, ngày cần người (không bắt buộc, không trước hôm nay); mã `DNTD-000001` theo năm học. Đề nghị trình duyệt ngay khi lập; Phó Hiệu trưởng của đơn vị và Hiệu trưởng nhận thông báo. Đề nghị không có giá trị tiền nên không áp hạn mức phê duyệt: người có quyền duyệt trong phạm vi đơn vị duyệt được; người lập không tự duyệt; từ chối bắt buộc lý do. Mỗi lần duyệt, từ chối ghi nhật ký thao tác kèm người duyệt, tên, thời điểm, vị trí, số lượng, lý do (BR-80). Người lập hoặc nhân sự của đơn vị đóng đề nghị đang chờ duyệt hoặc đã duyệt kèm lý do (đã tuyển đủ, không cần nữa); đóng đề nghị thì các tin còn mở của đề nghị đóng theo. Danh sách đề nghị có số ứng viên đã tuyển so với số lượng cần; hệ thống không chặn tuyển quá số lượng, chỉ hiển thị.
  - Tin tuyển dụng (P18-02): chỉ soạn từ đề nghị đã duyệt; nhiều tin cho một đề nghị được; tiêu đề, mô tả, yêu cầu, hạn nộp (không trước hôm nay). Trạng thái đang soạn, đã công bố, đã đóng; sửa khi chưa đóng; công bố cần đề nghị còn ở trạng thái đã duyệt và hạn nộp chưa qua. Phạm vi công bố của tin tuyển dụng là công khai: tin đã công bố còn hạn nộp (theo ngày Việt Nam) hiện trên trang công khai không cần tài khoản; hết hạn thì không hiện và không nhận hồ sơ, không cần thao tác đóng. Đơn vị của tin là đơn vị của đề nghị.
  - Trang công khai (MH-65) đặt trong ứng dụng phụ huynh, mở bằng liên kết “Tuyển dụng giáo viên và nhân viên” trên màn hình đăng nhập (địa chỉ `#tuyen-dung`), không cần đăng nhập. Điểm cuối công khai `/api/v1/public/job-posts`: mỗi địa chỉ mạng tối đa 120 lần xem mỗi phút và 10 lần nộp hồ sơ mỗi 10 phút (giữ trong bộ nhớ máy chủ, đếm cả lần nộp lỗi), vượt thì trả `ERR_RATE_LIMIT` kèm số giây chờ. Nộp hồ sơ là biểu mẫu nhiều phần: họ tên, số điện thoại (10 số bắt đầu bằng 0) bắt buộc; thư điện tử, ngày sinh, giới tính, địa chỉ, giới thiệu bản thân, nguồn biết tin (mặc định trang tuyển dụng) không bắt buộc; hồ sơ xin việc bắt buộc, ảnh JPEG, PNG hoặc PDF nhận diện theo byte đầu, tối đa 10 MB; bắt buộc tích đồng ý cho nhà trường xử lý dữ liệu cá nhân để tuyển dụng, lưu thời điểm đồng ý. Mỗi số điện thoại nộp một lần cho một tin (trùng trả `ERR_CONFLICT`). Kết quả chỉ trả lời nhận hồ sơ, không trả mã hay dữ liệu đã nộp. Nhân sự (VT-06) của đơn vị và của Trường chính nhận thông báo có hồ sơ mới. Lần nộp công khai không ghi nhật ký thao tác vì không có người dùng; dòng ứng viên có người tạo trống.
  - Hồ sơ xin việc lưu ở bảng tệp dùng chung với mục đích mới `candidate_cv` (tệp 0041 dựng lại ràng buộc mục đích tệp với danh sách đủ). Tải tệp này qua `GET /files/{id}` bị từ chối; chỉ tải qua `GET /candidates/{id}/cv` để kiểm tra quyền P18 và ghi nhật ký truy cập.
  - Hồ sơ ứng viên (P18-03) là dữ liệu cá nhân: người có `P18.recruitment.manage` hoặc `P18.interview.manage` trong phạm vi đơn vị của tin mới xem; danh sách không trả số điện thoại, thư điện tử; xem chi tiết (phạm vi `candidate_profile`) và tải hồ sơ xin việc (phạm vi `candidate_cv`) luôn ghi nhật ký truy cập dữ liệu, không phụ thuộc cấu hình `data_access_logging` vì đây không phải dữ liệu của trẻ. Ứng viên không xóa (BR-75), trạng thái: mới, đang sàng lọc, đang phỏng vấn, đã tuyển, không đạt, đã rút. Nhân sự nhập ứng viên nộp trực tiếp hoặc qua người giới thiệu cho tin đã công bố hoặc đã đóng (nguồn: trang tuyển dụng, người giới thiệu, trang việc làm, mạng xã hội, nộp trực tiếp, khác) và tải hồ sơ xin việc sau. Đổi trạng thái thủ công: mới sang đang sàng lọc, không đạt, đã rút; đang sàng lọc sang không đạt, đã rút; đang phỏng vấn sang đã rút; không đạt và đã rút bắt buộc lý do và hủy lịch phỏng vấn còn chờ; trạng thái kết thúc không mở lại.
  - Phỏng vấn (P18-04): lên lịch cho ứng viên đang sàng lọc hoặc đang phỏng vấn, mỗi lúc một lịch chờ; thời điểm (ngày không trước hôm nay), địa điểm, 1 đến 10 người phỏng vấn chọn từ hồ sơ nhân sự đang làm việc (đơn vị bất kỳ); vòng tự đánh số theo số lịch không bị hủy. Ứng viên chuyển sang đang phỏng vấn; người phỏng vấn có tài khoản nhận thông báo trong ứng dụng. Ghi kết quả đạt hoặc không đạt, điểm 0 đến 10 (một chữ số thập phân, không bắt buộc), đánh giá bắt buộc; hủy lịch chờ kèm lý do.
  - Quyết định tuyển: ứng viên đang phỏng vấn, không còn lịch chờ, có ít nhất một lần phỏng vấn đã ghi kết quả; tuyển cần lần phỏng vấn gần nhất đạt; không tuyển bắt buộc lý do. Ghi người quyết định, thời điểm, ghi chú, kèm nhật ký thao tác (BR-80); quyết định tuyển thì nhân sự của đơn vị và Trường chính nhận thông báo cần tạo hồ sơ nhân sự và hợp đồng.
  - Tạo hồ sơ nhân sự từ ứng viên đã tuyển là bước tùy chọn, tách khỏi quyết định tuyển: nhân sự nhập mã nhân sự, ngày vào làm, phòng ban, chức danh; hệ thống dùng nghiệp vụ tạo hồ sơ của P07-01 (cần thêm `P07.staff.manage`) với họ tên, ngày sinh, giới tính, điện thoại, thư điện tử, địa chỉ của ứng viên, đơn vị chính là đơn vị của tin; số định danh và hợp đồng nhập ở trang Hồ sơ nhân sự. Số điện thoại đã có hồ sơ nhân sự (kể cả đã nghỉ) thì không tạo hồ sơ thứ hai, trả mã BR-37; mỗi ứng viên gắn tối đa một hồ sơ nhân sự.
  - Hệ thống không gửi thông báo cho ứng viên (ứng viên không có tài khoản); nhân sự liên hệ trực tiếp qua số điện thoại.
  - Mở năm học mới chuyển đề nghị đang chờ duyệt hoặc đã duyệt kèm mọi tin, ứng viên, dòng tệp hồ sơ xin việc, lịch phỏng vấn của đề nghị, giữ mã định danh; số thứ tự mã đề nghị tiếp nối năm cũ; đề nghị đã đóng, bị từ chối tra ở năm cũ. Chạy sau bước nhân sự.
  - Trang Tuyển dụng trên cổng quản trị (MH-27, mục điều hướng “Tuyển dụng” trong nhóm Nhân sự) cho người có một trong bốn quyền P18, gồm các thẻ Đề nghị tuyển dụng, Đề nghị chờ duyệt, Tin tuyển dụng, Ứng viên (chi tiết, sàng lọc, phỏng vấn, quyết định tuyển, tạo hồ sơ nhân sự).
- Thành phần bị ảnh hưởng: `05`, `07`, `08`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị, ứng dụng phụ huynh (trang công khai).
- Dữ liệu bị ảnh hưởng: bốn bảng mới của năm học `recruitment_requests`, `job_postings`, `candidates`, `interviews` và mục đích tệp `candidate_cv` (tệp 0041); không thêm quyền (đã cấp ở tệp 0035 của định danh).
- API bị ảnh hưởng: các điểm cuối P18 trong `17`, nhóm điểm cuối công khai `/api/v1/public/job-posts`; `GET /files/{id}` từ chối tệp `candidate_cv`.
- Giao diện bị ảnh hưởng: MH-27, MH-65 (mới), màn hình đăng nhập của ứng dụng phụ huynh thêm liên kết “Tuyển dụng giáo viên và nhân viên”.
- Quyền bị ảnh hưởng: PQ-50.
- Ảnh hưởng chức năng cũ: không đổi hành vi cũ; tải tệp chung không còn mở được tệp mục đích `candidate_cv` (mục đích mới).
- Kiểm thử cần thực hiện: CT-208 đến CT-215; kiểm thử giao diện `tests/e2e/41-recruitment.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

| recruitment_requests | Đề nghị tuyển dụng (P18-01, BR-80) | code (DNTD-000001), org_unit_id, position, quantity, requirements, reason, needed_by, status (pending, approved, rejected, closed), requester_id, requester_name, approved_by, approver_name, approved_at, reject_reason, closed_by, closed_at, close_reason |
| job_postings | Tin tuyển dụng (P18-02); đã công bố còn hạn là công khai | request_id, org_unit_id, title, description, requirements, deadline, status (draft, published, closed), published_at, published_by, closed_at, closed_by, created_by |
| candidates | Hồ sơ ứng viên (P18-03); dữ liệu cá nhân, không xóa; duy nhất theo tin và số điện thoại | posting_id, org_unit_id, full_name, dob, gender, phone, email, address, source, cv_file_id, cover_letter, consent_at, status (new, screening, interviewing, hired, rejected, withdrawn), status_reason, note, decided_by, decided_at, decision_note, staff_id, created_by (trống là nộp công khai) |
| interviews | Phỏng vấn (P18-04) | candidate_id, round, scheduled_at, location, interviewer_staff_ids, status (scheduled, completed, cancelled), result (passed, failed), score, evaluation, cancel_reason, recorded_by, recorded_at, created_by |

Ghi chú: thay các dòng `recruitment_requests`, `job_postings`, `candidates`, `interviews` ở mục 17 của `16`; bảng `files` thêm mục đích `candidate_cv`.

## Điểm cuối

Thay bốn dòng P18 hiện có trong `17` bằng:

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

Giao kèo của nhóm điểm cuối tuyển dụng (DT-11 phần 11b, YCTD-87):

1. `POST /recruitment-requests` nhận `org_unit_id` (trống khi chỉ có một đơn vị trong phạm vi), `position`, `quantity` (1 đến 1000), `requirements`, `reason`, `needed_by` (không bắt buộc, không trước hôm nay); cần `P18.recruitment-request.create`. `approve`, `reject` (nhận `reason` bắt buộc) cần `P18.recruitment-request.approve` trong phạm vi đơn vị, người lập không tự duyệt (`ERR_FORBIDDEN`), đề nghị không chờ duyệt trả mã BR-80. `close` nhận `reason`, cần là người lập hoặc có `P18.recruitment.manage`. Kết quả có `code`, `unit_name`, `hired_count`, `approver_name`, `reject_reason`, `close_reason`.
2. `POST /job-postings` nhận `request_id`, `title`, `description`, `requirements`, `deadline`; `PUT` nhận bốn trường cuối; cần `P18.recruitment.manage` trong đơn vị của đề nghị; đề nghị chưa duyệt trả mã BR-80; tin đã đóng không sửa (BR-75); `publish` chỉ từ tin đang soạn (BR-69). Kết quả có `request_code`, `position`, `quantity`, `unit_name`, `candidate_count`, `is_open`. Danh sách cần một trong `P18.recruitment.manage`, `P18.interview.manage`, `P18.recruitment-request.approve`.
3. Điểm cuối `/public/job-posts` không cần mã phiên; mỗi địa chỉ mạng 120 lần xem mỗi phút, 10 lần nộp mỗi 10 phút, vượt trả `ERR_RATE_LIMIT` (429). Tin trả `id`, `title`, `description`, `requirements`, `deadline`, `published_at`, `position`, `quantity`, `unit_name`, `org_unit_id`. Tin không công bố hoặc hết hạn trả `ERR_NOT_FOUND`. `POST .../applications` là biểu mẫu nhiều phần: `full_name`, `phone` bắt buộc, `email`, `dob`, `gender`, `address`, `cover_letter`, `source` (`website`, `referral`, `job_board`, `social_media`, `other`), `consent` phải là `true`, tệp ở trường `cv` (ảnh JPEG, PNG hoặc PDF, tối đa 10 MB) bắt buộc; trùng số điện thoại trong tin trả `ERR_CONFLICT`; kết quả chỉ có `message`.
4. `GET /candidates` lọc `posting_id`, `status`, `org_unit_id`; trả `full_name`, `posting_title`, `source`, `status`, `has_cv`, `staff_id`, không trả liên hệ. `GET /candidates/{id}` trả đủ liên hệ, `cv_file_name`, `staff_code`, `can_manage`, `can_interview`, `interviews` (kèm `interviewers` gồm `staff_id`, `full_name`) và ghi nhật ký truy cập phạm vi `candidate_profile`; `GET /candidates/{id}/cv` ghi phạm vi `candidate_cv`. Đọc cần `P18.recruitment.manage` hoặc `P18.interview.manage` trong phạm vi đơn vị của tin.
5. `POST /candidates` nhận `posting_id` (tin đã công bố hoặc đã đóng), `full_name`, `phone`, `email`, `dob`, `gender`, `address`, `source` (thêm `walk_in`), `note`; `POST /candidates/{id}/cv` nhận tệp ở trường `cv`; `POST /candidates/{id}/status` nhận `status` (`screening`, `rejected`, `withdrawn`) và `reason` (bắt buộc trừ `screening`); chuyển không hợp lệ trả mã BR-75. Cần `P18.recruitment.manage`.
6. `POST /candidates/{id}/interviews` nhận `scheduled_at` (ISO 8601), `location`, `interviewer_staff_ids` (1 đến 10 hồ sơ nhân sự đang làm); `POST /interviews/{id}/result` nhận `result` (`passed`, `failed`), `score` (0 đến 10, không bắt buộc), `evaluation`; `cancel` nhận `reason`; `POST /candidates/{id}/decision` nhận `result` (`hired`, `rejected`) và `note` (bắt buộc khi không tuyển); còn lịch chờ, chưa có kết quả hoặc lần gần nhất không đạt mà quyết định tuyển trả mã BR-80. Cần `P18.interview.manage`.
7. `POST /candidates/{id}/staff` nhận `code`, `start_date`, `department_id`, `job_title_id`; cần `P18.recruitment.manage` và `P07.staff.manage`; ứng viên chưa tuyển, đã có hồ sơ hoặc số điện thoại đã có hồ sơ nhân sự trả mã BR-37; mã nhân sự trùng trả `ERR_CONFLICT`.

## Màn hình

| MH-27 | Tuyển dụng (YCTD-87): đề nghị tuyển dụng (lập, đóng, số đã tuyển so với cần), đề nghị chờ duyệt (duyệt, từ chối kèm lý do), tin tuyển dụng (soạn từ đề nghị đã duyệt, công bố, đóng), ứng viên (danh sách theo tin, nhập ứng viên, chi tiết kèm hồ sơ xin việc, sàng lọc, lịch và kết quả phỏng vấn, quyết định tuyển, tạo hồ sơ nhân sự) | VT-06, VT-03; VT-02, VT-15 duyệt đề nghị và xem tin |
| MH-65 | Trang tuyển dụng công khai trong ứng dụng phụ huynh, mở từ liên kết “Tuyển dụng giáo viên và nhân viên” trên màn hình đăng nhập, không cần tài khoản: tin đã công bố còn hạn, biểu mẫu nộp hồ sơ kèm hồ sơ xin việc và đồng ý xử lý dữ liệu cá nhân (YCTD-87) | Người ngoài trường |

MH-66 không dùng.

## Quyền

| PQ-50 | Tuyển dụng (YCTD-87): `P18.recruitment-request.create` cho VT-06, VT-03 lập đề nghị tuyển dụng cho đơn vị trong phạm vi và đóng đề nghị mình lập; `P18.recruitment-request.approve` cho VT-02 (toàn trường), VT-15 (đơn vị được gán) duyệt hoặc từ chối, không tự duyệt đề nghị mình lập; `P18.recruitment.manage` cho VT-06 soạn, công bố, đóng tin, nhập và sàng lọc ứng viên, đóng đề nghị của đơn vị, tạo hồ sơ nhân sự từ ứng viên đã tuyển (cần thêm `P07.staff.manage`); `P18.interview.manage` cho VT-06, VT-03 lên lịch, ghi kết quả phỏng vấn và quyết định tuyển. Hồ sơ ứng viên chỉ người có `P18.recruitment.manage` hoặc `P18.interview.manage` trong phạm vi đơn vị xem, mỗi lần xem chi tiết hoặc hồ sơ xin việc ghi nhật ký truy cập. Người ngoài trường không cần tài khoản xem tin đã công bố còn hạn và nộp hồ sơ |

## Kết quả kiểm thử

Kịch bản đề xuất thêm vào `21` (P18 chưa có kịch bản), đều đạt bằng kiểm thử tự động `apps/api/src/recruitment/recruitment.test.ts` ngày 12/10/2026:

| CT-208 | P18-01 | Quản lý đơn vị lập đề nghị; giáo viên lập; nhân sự duyệt; Phó Hiệu trưởng duyệt; người lập tự duyệt; duyệt lại | Giáo viên, nhân sự bị từ chối; Phó Hiệu trưởng duyệt được, nhật ký có người duyệt, thời điểm, số lượng (BR-80); người lập không tự duyệt; duyệt lại trả BR-80 | Đạt |
| CT-209 | P18-02 | Nhân sự đơn vị khác soạn tin; soạn tin hạn nộp đã qua; công bố tin; xem trang công khai không đăng nhập; tin hết hạn | Bị từ chối, lỗi dữ liệu; tin đang soạn không hiện công khai; tin đã công bố hiện kèm vị trí, đơn vị; tin hết hạn trả không tìm thấy | Đạt |
| CT-210 | P18-03 | Người ngoài nộp hồ sơ thiếu đồng ý, số điện thoại sai, thiếu tệp, tệp không phải ảnh hoặc PDF, hợp lệ, nộp lại | Bốn trường hợp đầu lỗi dữ liệu; hợp lệ được nhận, không trả mã; nộp lại trả xung đột; nhân sự nhận thông báo | Đạt |
| CT-211 | P18-03 | Giáo viên, nhân sự đơn vị khác xem ứng viên; nhân sự xem danh sách; quản lý đơn vị xem chi tiết; tải hồ sơ xin việc; tải qua điểm cuối tệp chung | Bị từ chối; danh sách không có số điện thoại; chi tiết và tải tệp ghi nhật ký truy cập (BR-74); tải qua tệp chung bị từ chối | Đạt |
| CT-212 | P18-03 | Nhân sự nhập ứng viên; quản lý đơn vị nhập; loại không lý do; loại có lý do; mở lại; xóa | Nhân sự nhập được, quản lý đơn vị bị từ chối; thiếu lý do lỗi dữ liệu; mở lại trả BR-75; không có điểm cuối xóa | Đạt |
| CT-213 | P18-04 | Lên lịch với người phỏng vấn không phải nhân sự; giáo viên lên lịch; quyết định khi còn lịch chờ; vòng 1 không đạt rồi quyết định tuyển; vòng 2 đạt rồi quyết định tuyển | Lỗi dữ liệu; bị từ chối; trả BR-80 hai lần; tuyển được, nhật ký có người và thời điểm quyết định; đề nghị có số đã tuyển 1 | Đạt |
| CT-214 | P18-04 | Quản lý đơn vị tạo hồ sơ nhân sự từ ứng viên đã tuyển; nhân sự tạo; tạo lần hai | Bị từ chối; hồ sơ nhân sự có họ tên, điện thoại, đơn vị của ứng viên; lần hai trả BR-37 | Đạt |
| CT-215 | P18-01, P18-02 | Giáo viên đóng đề nghị; nhân sự đóng đề nghị; nộp hồ sơ vào tin đã đóng; nộp liên tục nhiều lần | Bị từ chối; đề nghị và tin đều đóng; tin đã đóng trả không tìm thấy; vượt giới hạn trả `ERR_RATE_LIMIT` | Đạt |

Kiểm thử giao diện `tests/e2e/41-recruitment.spec.ts` (luồng đề nghị, duyệt, công bố tin, nộp hồ sơ công khai trên ứng dụng phụ huynh, sàng lọc, phỏng vấn, quyết định tuyển, tạo hồ sơ nhân sự): đã viết, chưa chạy (người điều phối chạy). Kiểm thử chuyển năm học `apps/api/src/academic-years/year-transition.test.ts` vẫn đạt với bước chuyển tuyển dụng.

## Quy tắc

- Đề xuất bổ sung BR-69: “… Tin tuyển dụng đã công bố có phạm vi công khai: người ngoài trường xem được và nộp hồ sơ không cần tài khoản đến hết hạn nộp (YCTD-87).”
- Đề xuất bổ sung BR-80 (không đổi nghĩa): áp dụng cả cho duyệt, từ chối đề nghị tuyển dụng và quyết định tuyển ứng viên; giá trị chứng từ của đề nghị tuyển dụng là vị trí và số lượng.
- Không thêm mã BR mới; chặn tuyển quá số lượng không làm (chỉ hiển thị số đã tuyển so với cần).
