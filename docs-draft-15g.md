# Nháp tài liệu DT-15 phần 15g — Gửi phản hồi, hết hạn mật khẩu (YCTD-110)

## YCTD

### YCTD-110: Gửi phản hồi ở chân trang và hết hạn mật khẩu (DT-15 phần 15g) – 2026-10-14

- Lý do: kế hoạch theo hệ thống của Sở (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2 ý 4, mục 4.1, 4.5; đợt 15g) và khảo sát (`31_KHAO_SAT_HE_THONG_SO.md` mục 2.3: chân mọi trang có biểu mẫu "Gửi phản hồi", menu người dùng có "Danh sách ý kiến đã gửi", thông báo hết hạn mật khẩu; mục 7, 1.4: danh sách người dùng có thời gian đổi mật khẩu; mục 8.3 số 11, 12). Eric chọn phương án 4 ngày 2026-10-14 (biểu mẫu phản hồi, danh sách ý kiến, màn hình xử lý ý kiến, hết hạn mật khẩu). Các điểm chi tiết dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi:
  - Gửi phản hồi: chân mọi trang của cổng quản trị có nút "Gửi phản hồi" mở hộp thoại theo biểu mẫu của Sở. Ô theo thứ tự: Đường dẫn trang (tự điền trang đang mở, chỉ đọc), Loại ý kiến (Góp ý, Báo lỗi, Đề nghị), Tiêu đề (bắt buộc, tối đa 200 ký tự), Nội dung (bắt buộc, tối đa 5000 ký tự), Số điện thoại, Thư điện tử (không bắt buộc, kiểm tra định dạng), Ảnh chụp màn hình (không bắt buộc, JPEG hoặc PNG tối đa 5 MB, nhận diện theo các byte đầu của tệp, lưu ở kho tệp S3 như tệp đính kèm khác). Nhãn bên trái, nút Hủy và Gửi; lỗi hiện dưới từng ô. Gửi xong đóng hộp thoại và báo "Đã gửi ý kiến phản hồi". Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: dùng lại kho tệp sẵn có nên có ảnh đính kèm; thêm Số điện thoại, Thư điện tử vì biểu mẫu của Sở có.
  - Máy chủ ghi người gửi, tên người gửi lúc gửi, đơn vị (đơn vị của vai trò đầu tiên gán theo đơn vị; vai trò toàn trường thì để trống), trang, loại, tiêu đề, nội dung, trạng thái "Mới". Mỗi tài khoản gửi tối đa 10 ý kiến trong một giờ; quá thì trả `ERR_RATE_LIMIT` (429) kèm `rule_code` YCTD-110 và số giây phải chờ. Đếm trong giao dịch có khóa theo tài khoản để hai lần gửi cùng lúc không vượt giới hạn.
  - Danh sách ý kiến đã gửi: mục mới trong menu người dùng (sau Cấu hình hiển thị lưới, trước Thoát), trang `/my-feedback`. Lưới dữ liệu chung (khóa `my-feedback`): Ngày gửi, Loại, Tiêu đề, Trang, Trạng thái, Ngày trả lời; tìm theo tiêu đề, nội dung; nút "Chi tiết" mở nội dung, liên hệ, ảnh đính kèm (mở ở thẻ mới), câu trả lời.
  - Ý kiến phản hồi: mục "3.4. Ý kiến phản hồi" của phân hệ Quản trị hệ thống (nhóm "3. Kết nối và nhật ký"), trang `/feedback`, cho người có quyền mới `P01.feedback.manage` (Quản trị nền tảng VT-01, Hiệu trưởng VT-02). Lưới dữ liệu chung (khóa `feedback`): Ngày gửi, Người gửi, Đơn vị, Loại, Tiêu đề, Trang, Trạng thái; ẩn mặc định Người trả lời, Ngày trả lời, Số điện thoại, Thư điện tử. Tìm theo tiêu đề, nội dung, người gửi; Mở rộng tìm kiếm lọc Trạng thái (lọc ở máy chủ) và Loại. Nút "Xử lý" mở chi tiết và khối Trạng thái (Mới, Đang xử lý, Đã xử lý), Trả lời, nút Ghi. Câu trả lời mới hoặc đã sửa thì ghi người trả lời, thời điểm trả lời và gửi thông báo trong ứng dụng cho người gửi ("Ý kiến phản hồi đã được trả lời", mã mẫu `feedback_reply`); lưu lại đúng câu trả lời cũ thì không báo lại; xóa trắng câu trả lời thì bỏ người trả lời.
  - Hết hạn mật khẩu: chính sách chung ở dịch vụ định danh gồm Số ngày hết hạn mật khẩu (`password_max_age_days`, 0 đến 3650, mặc định 0 là không giới hạn) và Số ngày báo trước khi hết hạn (`password_expiry_warning_days`, 0 đến 90, mặc định 7). Mỗi tài khoản có thời điểm đặt mật khẩu gần nhất (`password_changed_at`); tài khoản đã có lấy thời điểm cập nhật gần nhất, không có thì thời điểm tạo. Đổi mật khẩu và đặt lại mật khẩu tạm ghi lại thời điểm này.
  - Đăng nhập bằng mật khẩu (và làm mới phiên đăng nhập bằng mật khẩu): mật khẩu đã quá số ngày thì phiên chỉ được đổi mật khẩu như tài khoản phải đổi mật khẩu (MH-48, BM-07); phản hồi có `password_expired: true`; nhật ký bảo mật ghi `login_password_expired`. Màn hình Đổi mật khẩu hiện "Mật khẩu đã hết hạn, vui lòng đổi mật khẩu". Mật khẩu mới phải khác mật khẩu hiện tại (quy tắc đã có). Trong khoảng báo trước, phản hồi có `password_expires_in_days` và đầu mọi trang của cổng quản trị báo "Mật khẩu sẽ hết hạn sau N ngày." kèm liên kết Đổi mật khẩu.
  - Chỉ áp cho tài khoản nhân sự (có ít nhất một vai trò khác Phụ huynh VT-14). Tài khoản chỉ có vai trò Phụ huynh, tài khoản còn dùng mật khẩu mặc định chung của phụ huynh và phiên đăng nhập bằng mã một lần không bị hết hạn mật khẩu (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).
  - Chính sách sửa ở khối "Chính sách mật khẩu" cuối màn hình Danh sách người dùng (`/accounts`), cho người có quyền quản lý mọi tài khoản `P01.account.manage` (VT-01, VT-02). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: không đặt ở khối Tài khoản của màn hình Cấu hình vì khối đó theo quyền `P01.setting.manage` mà Quản trị nền tảng không có. Lưới Danh sách người dùng thêm cột ẩn mặc định "Thời gian đổi mật khẩu" theo cột của Sở.
- Thành phần bị ảnh hưởng: `05`, `07`, `08`, `10`, `14`, `15`, `16`, `17`, `21`, `03`, `23`, `24`, `index.md`; cổng quản trị, máy chủ API, dịch vụ định danh, gói dùng chung, kiểm thử giao diện.
- Dữ liệu bị ảnh hưởng: bảng mới `feedback` ở cơ sở dữ liệu hệ thống (`database/system/migrations/0007_create_feedback.ts`); cột mới `users.password_changed_at` và quyền `P01.feedback.manage` ở cơ sở dữ liệu định danh (`database/identity/migrations/0042_add_password_expiry_and_feedback_permission.ts`); khóa cấu hình mới `password_max_age_days`, `password_expiry_warning_days` ở `identity_settings`.
- API bị ảnh hưởng: điểm cuối mới `POST /api/v1/user-feedback`, `GET /api/v1/me/user-feedback`, `GET /api/v1/user-feedback`, `PUT /api/v1/user-feedback/{id}`, `GET /api/v1/user-feedback/{id}/attachment`, `GET`, `PUT /api/v1/auth/settings/password-policy`; phản hồi đăng nhập, làm mới phiên, đổi mật khẩu thêm `password_expired`, `password_expires_in_days`; danh sách tài khoản thêm `password_changed_at`.
- Giao diện bị ảnh hưởng: khung trang (chân trang, báo sắp hết hạn mật khẩu), menu người dùng, menu Quản trị hệ thống, màn hình Danh sách người dùng, Đổi mật khẩu; trang mới Danh sách ý kiến đã gửi, Ý kiến phản hồi. Ứng dụng giáo viên, phụ huynh không đổi giao diện.
- Quyền bị ảnh hưởng: quyền mới `P01.feedback.manage` gán VT-01, VT-02.
- Ảnh hưởng chức năng cũ: mặc định chính sách tắt nên đăng nhập không đổi cho tới khi Quản trị đặt số ngày; tài khoản đã có tính hạn từ thời điểm cập nhật gần nhất nên bật chính sách có thể bắt nhiều tài khoản đổi mật khẩu ngay. Góp ý của phụ huynh ở phân hệ Tương tác (`/api/v1/feedbacks`) không đổi. Menu người dùng có năm mục.
- Kiểm thử cần thực hiện: CT-15g-1 đến CT-15g-16.
- Trạng thái: Đã triển khai

## Bảng

| feedback | Ý kiến phản hồi gửi từ chân trang cổng quản trị (DT-15 phần 15g), ở cơ sở dữ liệu hệ thống nên giữ qua các năm học; `user_id`, `org_unit_id`, `replied_by` là mã ở dịch vụ định danh và cây đơn vị, không có khóa ngoại vì khác cơ sở dữ liệu | id, user_id, user_name, org_unit_id, page_url, feedback_type (`suggestion`, `bug`, `request`), title (1 đến 200 ký tự), content (1 đến 5000 ký tự), contact_phone, contact_email, attachment_key, attachment_name, attachment_content_type, attachment_size, status (`new`, `in_progress`, `resolved`; mặc định `new`), reply, replied_by, replied_by_name, replied_at, created_at, updated_at, updated_by; chỉ mục (user_id, created_at), (status, created_at) |
| users (định danh) | Thêm cột | password_changed_at (timestamptz, bắt buộc, mặc định now(); tài khoản đã có lấy coalesce(updated_at, created_at)) |
| identity_settings (định danh) | Thêm khóa | password_max_age_days (mặc định 0), password_expiry_warning_days (mặc định 7) |

## Điểm cuối

| POST | /api/v1/user-feedback | Gửi ý kiến (biểu mẫu nhiều phần hoặc JSON): `feedback_type`, `title`, `content` bắt buộc; `page_url` (bắt đầu bằng `/`, tối đa 500 ký tự), `contact_phone` (9 đến 15 chữ số), `contact_email`, tệp `attachment` (JPEG, PNG tối đa 5 MB) không bắt buộc. Mọi tài khoản đăng nhập; tối đa 10 ý kiến mỗi giờ (429 `ERR_RATE_LIMIT`, `rule_code` YCTD-110, `retry_after_seconds`) |
| GET | /api/v1/me/user-feedback | Ý kiến của chính tài khoản, mới nhất trước |
| GET | /api/v1/user-feedback | Mọi ý kiến, lọc `status`; cần `P01.feedback.manage` |
| PUT | /api/v1/user-feedback/{id} | Đổi `status`, `reply` (tối đa 5000 ký tự, rỗng là xóa); cần `P01.feedback.manage`; trả lời mới thì báo người gửi trong ứng dụng (khi có năm học đang dùng) |
| GET | /api/v1/user-feedback/{id}/attachment | Ảnh đính kèm; người gửi hoặc người có `P01.feedback.manage`, người khác nhận 404 |
| GET | /api/v1/auth/settings/password-policy | Chính sách hạn mật khẩu; cần `P01.account.manage` |
| PUT | /api/v1/auth/settings/password-policy | Sửa `password_max_age_days` (0 đến 3650), `password_expiry_warning_days` (0 đến 90); cần `P01.account.manage`; ghi nhật ký định danh |

Phản hồi `POST /api/v1/auth/login`, `/auth/refresh`, `/auth/change-password` thêm `password_expired` (true thì `password_change_required` cũng true) và `password_expires_in_days` (số ngày còn lại khi trong khoảng báo trước, ngoài ra null). `GET /api/v1/users` trả thêm `password_changed_at`.

## Màn hình

| Khung trang | Chân trang có nút "Gửi phản hồi" mở hộp thoại Gửi phản hồi; đầu trang báo "Mật khẩu sẽ hết hạn sau N ngày." khi trong khoảng báo trước | Mọi người dùng cổng quản trị |
| Menu người dùng | Thêm mục Danh sách ý kiến đã gửi (Thông báo, Đổi mật khẩu, Cấu hình hiển thị lưới, Danh sách ý kiến đã gửi, Thoát) | Mọi người dùng cổng quản trị |
| Danh sách ý kiến đã gửi (`/my-feedback`) | Lưới ý kiến của chính người dùng, chi tiết có nội dung, ảnh, câu trả lời | Mọi người dùng cổng quản trị |
| Ý kiến phản hồi (`/feedback`, Quản trị hệ thống 3.4) | Lưới mọi ý kiến, lọc trạng thái, loại; Xử lý: trạng thái, trả lời, Ghi | VT-01, VT-02 |
| MH-30 Danh sách người dùng | Khối Chính sách mật khẩu (Số ngày hết hạn mật khẩu, Số ngày báo trước khi hết hạn, Ghi); cột ẩn Thời gian đổi mật khẩu | Khối chính sách: VT-01, VT-02 |
| MH-48 Đổi mật khẩu | Mật khẩu hết hạn thì báo "Mật khẩu đã hết hạn, vui lòng đổi mật khẩu" | Như cũ |

Số MH do người điều phối đánh khi gộp tài liệu.

## Quyền

| PQ | `P01.feedback.manage` (mới): xem mọi ý kiến phản hồi, đổi trạng thái, trả lời; gán VT-01, VT-02. Gửi ý kiến và xem ý kiến của mình không cần quyền riêng. Sửa chính sách hạn mật khẩu dùng quyền có sẵn `P01.account.manage` (VT-01, VT-02). Máy chủ kiểm tra quyền ở mọi yêu cầu (AI-12) |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/feedback/feedback.test.ts` và `apps/identity/src/authentication/password-expiry.test.ts` ngày 14/10/2026:

- CT-15g-1: Gửi ý kiến, xem danh sách của mình khi chưa đăng nhập: bị từ chối 401 — đạt.
- CT-15g-2: Giáo viên gửi ý kiến, xem danh sách của mình; giáo viên khác xem danh sách của mình: ý kiến trạng thái Mới, đúng người gửi và trang; người khác không thấy — đạt.
- CT-15g-3: Gửi loại lạ, tiêu đề rỗng, thư điện tử sai: lỗi dữ liệu 400 kèm ba trường lỗi — đạt.
- CT-15g-4: Gửi kèm ảnh PNG, tải ảnh bằng người gửi, Hiệu trưởng, giáo viên khác; gửi tệp không phải ảnh: người gửi và Hiệu trưởng nhận đúng ảnh, người khác nhận 404; tệp không phải ảnh bị từ chối 400 — đạt.
- CT-15g-5: Giáo viên xem mọi ý kiến, đổi trạng thái; Hiệu trưởng, Quản trị nền tảng xem mọi ý kiến; lọc trạng thái lạ: giáo viên bị từ chối 403; hai vai trò quản trị thấy ý kiến; trạng thái lạ lỗi 400 — đạt.
- CT-15g-6: Hiệu trưởng chuyển Đang xử lý, lọc theo trạng thái, trả lời và chuyển Đã xử lý, lưu lại đúng câu trả lời cũ: trạng thái, câu trả lời, người và thời điểm trả lời được ghi; người gửi thấy câu trả lời và có một thông báo trong ứng dụng, người khác không có; lưu lại không báo lần hai — đạt.
- CT-15g-7: Sửa ý kiến không tồn tại: 404 — đạt.
- CT-15g-8: Gửi 11 ý kiến trong một giờ, người khác gửi, lùi thời điểm gửi quá một giờ rồi gửi lại: lần 11 bị chặn 429 `ERR_RATE_LIMIT`, `rule_code` YCTD-110, có số giây chờ; người khác vẫn gửi được; sau một giờ gửi lại được — đạt.
- CT-15g-9: Đọc chính sách mặc định; giáo viên, Quản lý đơn vị đọc, sửa; sửa số âm, 4000, chữ, thân rỗng; Hiệu trưởng đặt 90 ngày: mặc định 0 và 7; hai vai trò không có quyền bị từ chối 403; dữ liệu sai lỗi 400; lưu được 90 ngày — đạt.
- CT-15g-10: Tài khoản giáo viên đặt mật khẩu 100 ngày trước đăng nhập, làm mới phiên, gọi điểm cuối khác, đổi sang mật khẩu cũ rồi mật khẩu mới, đăng nhập lại: đăng nhập và làm mới đều bắt buộc đổi mật khẩu, `password_expired` true, nhật ký bảo mật ghi `login_password_expired`; điểm cuối khác bị từ chối; mật khẩu trùng bị từ chối 400; đổi xong đăng nhập bình thường — đạt.
- CT-15g-11: Mật khẩu đặt 85 ngày, 80 ngày trước; số ngày báo trước 0: còn 5 ngày thì trả `password_expires_in_days` 5 và chưa bắt buộc đổi; 80 ngày không báo; báo trước 0 thì không báo — đạt.
- CT-15g-12: Tài khoản chỉ có vai trò Phụ huynh, tài khoản Phụ huynh kiêm giáo viên, mật khẩu đặt 400 ngày trước: phụ huynh không bị hết hạn; tài khoản kiêm nhân sự bị hết hạn — đạt.
- CT-15g-13: Đặt số ngày tối đa 0, tài khoản đặt mật khẩu 1000 ngày trước: không hết hạn, không báo — đạt.

Kiểm thử giao diện `tests/e2e/53-feedback-password-expiry.spec.ts` ngày 14/10/2026:

- CT-15g-14: Giáo viên bấm "Gửi phản hồi" ở chân trang, bấm Gửi khi chưa nhập, nhập đủ kèm ảnh chụp màn hình, mở Danh sách ý kiến đã gửi ở menu người dùng: ô Đường dẫn trang tự điền; lỗi hiện dưới Loại ý kiến, Tiêu đề, Nội dung; gửi xong báo "Đã gửi ý kiến phản hồi"; danh sách có ý kiến loại Báo lỗi, trạng thái Mới, chi tiết có nội dung, tên ảnh, "Chưa trả lời"; giáo viên không có mục Ý kiến phản hồi — đạt.
- CT-15g-15: Hiệu trưởng mở "3.4. Ý kiến phản hồi", tìm ý kiến, Xử lý chọn Đã xử lý, nhập trả lời, Ghi, lọc trạng thái Mới; giáo viên mở lại danh sách của mình: báo "Đã ghi xử lý ý kiến", dòng chuyển Đã xử lý, lọc Mới thì không còn dòng; giáo viên thấy Đã xử lý và câu trả lời — đạt.
- CT-15g-16: Quản trị nền tảng mở Danh sách người dùng, nhập 5000 rồi 90 ở Số ngày hết hạn mật khẩu, Ghi; giáo viên có mật khẩu 100 ngày đăng nhập, đổi sang mật khẩu cũ rồi mật khẩu mới; nhân sự có mật khẩu 85 ngày đăng nhập: khối hiện 0 và 7; 5000 báo lỗi dưới ô; 90 lưu được; giáo viên bị chuyển sang Đổi mật khẩu với dòng "Mật khẩu đã hết hạn, vui lòng đổi mật khẩu", mật khẩu cũ bị từ chối, đổi xong vào trang chủ; nhân sự thấy "Mật khẩu sẽ hết hạn sau 5 ngày." và liên kết Đổi mật khẩu — đạt.

KET_QUA_TOAN_BO

## Hạn chế

- Thông báo trả lời ý kiến nằm ở cơ sở dữ liệu năm học: chưa có năm học đang dùng thì không gửi thông báo (ghi nhật ký cảnh báo), người gửi vẫn xem câu trả lời ở Danh sách ý kiến đã gửi. Thông báo không có liên kết mở thẳng ý kiến.
- Chỉ đính kèm một ảnh JPEG hoặc PNG; chưa nhận PDF hay nhiều tệp, chưa tự chụp màn hình. Ảnh của ý kiến không bị xóa khỏi kho tệp (không xóa cứng dữ liệu, AI-08).
- Ý kiến gửi về quản trị của trường (VT-01, VT-02), chưa gửi về đơn vị hỗ trợ bên ngoài như hệ thống của Sở; chưa gửi thư điện tử, tin nhắn khi có ý kiến mới hoặc khi trả lời.
- Đổi trạng thái, trả lời ý kiến ghi người và thời điểm sửa gần nhất trên bản ghi, chưa ghi vào nhật ký thao tác.
- Màn hình Ý kiến phản hồi và Danh sách ý kiến đã gửi tải cả danh sách rồi phân trang ở trình duyệt; số ý kiến rất lớn thì cần phân trang ở máy chủ.
- Hết hạn mật khẩu chỉ áp cho tài khoản nhân sự; tài khoản phụ huynh không bao giờ hết hạn mật khẩu (theo yêu cầu). Ứng dụng giáo viên vẫn bắt đổi mật khẩu khi hết hạn (cùng cờ `password_change_required`) nhưng chưa hiện dòng "Mật khẩu đã hết hạn" và chưa báo sắp hết hạn.
- Bật chính sách lần đầu thì tài khoản đã có tính hạn từ thời điểm cập nhật gần nhất (thời điểm đặt mật khẩu thật trước đây không được lưu), nên có thể nhiều tài khoản phải đổi mật khẩu ngay.
- Mật khẩu mới chỉ phải khác mật khẩu hiện tại, chưa chặn dùng lại các mật khẩu cũ hơn. Chưa có bộ lọc "ngày hết hạn mật khẩu", "trạng thái đổi mật khẩu" ở Danh sách người dùng như của Sở (phần 15e sửa màn hình này).
- Báo sắp hết hạn mật khẩu là dòng trên đầu trang, chưa phải hộp thông báo bật lên như của Sở.
