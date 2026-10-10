# 24. YÊU CẦU THAY ĐỔI

- Mô tả: Sổ quản lý yêu cầu thay đổi, ghi lý do, đánh giá ảnh hưởng và trạng thái của từng thay đổi trước khi triển khai.
- Phiên bản: 0.4
- Ngày cập nhật: 2026-10-10
- Trạng thái: Đang cập nhật

## Quy ước

Mã yêu cầu thay đổi dạng `YCTD-nn`, đánh số tăng dần, không tái sử dụng. Mục mới nhất ở trên cùng. Trạng thái dùng bốn giá trị: Chờ phê duyệt, Đã phê duyệt, Từ chối, Đã triển khai.

Các thay đổi trước phiên bản 0.4.0 chưa có sổ này; xem `23_LICH_SU_PHIEN_BAN.md` các phiên bản 0.1.0 đến 0.3.1.

### YCTD-44: Chia DT-03, giáo viên của lớp và phụ huynh trùng số điện thoại nhân sự – 2026-10-10

- Lý do: DT-03 lớn hơn một yêu cầu gộp; chưa có hồ sơ nhân sự (P07) nhưng lớp cần giáo viên; bảng `classes` có một cột giáo viên chủ nhiệm trong khi bảng phân công cho phép nhiều giáo viên; số điện thoại phụ huynh có thể đã thuộc tài khoản nhân sự; chưa có phân hệ thông báo.
- Nội dung thay đổi:
  - DT-03 chia ba phần: 3a lớp học; 3b hồ sơ trẻ đến khi duyệt và phân lớp; 3c nhập Excel và nhập mã ngành.
  - Giáo viên trong lớp tạm chọn theo tài khoản: chủ nhiệm là tài khoản có vai trò VT-07, bộ môn là VT-08, cùng đơn vị với lớp hoặc ở Trường chính; khi có P07 thì chuyển sang hồ sơ nhân sự. Nhân sự liên quan của cờ trẻ con nhân viên cũng chọn theo tài khoản.
  - Một lớp có một hoặc nhiều giáo viên chủ nhiệm cùng lúc; bỏ cột `classes.homeroom_teacher_id`, dùng bảng `class_staff_assignments`.
  - Số điện thoại phụ huynh đã thuộc tài khoản nhân sự thì hệ thống tự thêm vai trò VT-14 vào tài khoản đó và ghi nhật ký.
  - Thông báo trong ứng dụng và tin nhắn chỉ ghi vào hàng đợi; gửi thật làm ở phân hệ thông báo.
  - Mã quyền mới `P02.class.manage` cho VT-02 toàn trường, VT-15 và VT-03 trong đơn vị được gán.
  - Lớp và phân công không chuyển sang năm học mới vì lớp gắn với một năm học (BR-02).
- Thành phần bị ảnh hưởng: `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md`, `01`, `03`, `index.md`; mã nguồn DT-03.
- Dữ liệu bị ảnh hưởng: bảng `classes` không có `homeroom_teacher_id`; `class_staff_assignments` dùng `staff_user_id`, thêm `staff_name`.
- API bị ảnh hưởng: thêm `PATCH /classes/{id}/staff-assignments/{assignmentId}`; dịch vụ định danh thêm `GET /users/directory`.
- Giao diện bị ảnh hưởng: MH-03.
- Quyền bị ảnh hưởng: thêm `P02.class.manage`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P02-039 đến 043.
- Trạng thái: Đã triển khai phần 3a

### YCTD-43: Đăng nhập của phụ huynh – 2026-10-10

- Lý do: thiết kế DT-02 gặp các điểm chưa rõ: chưa có tài khoản nhà cung cấp tin nhắn (T1); P01-08 ghi mật khẩu mặc định của phụ huynh trong cấu hình theo đơn vị nhưng mật khẩu chỉ được nằm ở dịch vụ định danh; thông số mã một lần chưa có mặc định; điểm cuối `POST /auth/activate` trùng chức năng với đăng nhập và đổi mật khẩu. Khi kiểm thử giao diện phát hiện thêm: ba kênh dùng chung tên miền (Q-118) và chung một cookie mã làm mới, nên đăng nhập kênh này dùng hoặc đè phiên kênh kia.
- Nội dung thay đổi:
  - Mật khẩu mặc định của phụ huynh là một mật khẩu toàn trường, Hiệu trưởng đặt ở cấu hình chung của dịch vụ định danh, lưu dạng băm; bỏ khỏi cấu hình theo đơn vị P01-08. Tài khoản chưa kích hoạt dùng mật khẩu mặc định đang có, nên đổi mật khẩu mặc định thì phụ huynh chưa kích hoạt dùng mật khẩu mới.
  - Thông số mã một lần có mặc định 5 phút, nhập sai tối đa 5 lần, gửi tối đa 5 lần mỗi giờ cho một số điện thoại; Hiệu trưởng sửa được. Đếm số lần gửi theo số điện thoại cho mọi số để báo vượt giới hạn mà không lộ số có tồn tại hay không.
  - Tin nhắn gửi qua một lớp gửi riêng; khi phát triển ghi ra nhật ký máy chủ; môi trường chạy thật không khởi động khi chưa có nhà cung cấp; P19-06 chỉ nghiệm thu xong khi có T1.
  - Bỏ `POST /auth/activate`; kích hoạt là đăng nhập bằng mật khẩu mặc định rồi đổi mật khẩu.
  - Mã một lần chỉ dùng cho tài khoản có duy nhất vai trò VT-14.
  - Tạo tài khoản chỉ có vai trò VT-14 thì dùng mật khẩu mặc định, không sinh mật khẩu tạm; chưa đặt mật khẩu mặc định thì từ chối.
  - Mỗi kênh một cookie mã làm mới (`refresh_token`, `refresh_token_teacher`, `refresh_token_parent`); `refresh` nhận `channel`, mặc định `portal`; phiên khác kênh bị từ chối.
- Thành phần bị ảnh hưởng: `08`, `10`, `12`, `16`, `17`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `01`, `03`, `index.md`; mã nguồn DT-02.
- Dữ liệu bị ảnh hưởng: `users.password_hash` cho phép để trống; `sessions.login_method`; bảng `one_time_codes`; bốn khóa mới trong `identity_settings`.
- API bị ảnh hưởng: thêm `POST /auth/otp/request`, `POST /auth/otp/login`; bỏ `POST /auth/activate`; `GET`, `PUT /auth/settings` thêm thông số mã một lần và mật khẩu mặc định; `POST /users` trả thêm `uses_default_password`; `refresh` nhận `channel`.
- Giao diện bị ảnh hưởng: màn hình Cấu hình phần Tài khoản, màn hình Tài khoản; ứng dụng phụ huynh có MH-47, MH-48.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: cổng quản trị vẫn dùng cookie `refresh_token` và gọi `refresh` không kèm kênh như trước.
- Kiểm thử cần thực hiện: CTC-DD-010 đến 012, 014, 016 đến 023, 042.
- Trạng thái: Đã triển khai

### YCTD-42: Các danh mục của P01 – 2026-10-10

- Lý do: thiết kế DT-01 phần 6b gặp bốn điểm tài liệu chưa rõ: danh mục dùng chung chưa có loại và chưa có bảng; P01-03, P01-04 ghi VT-06 nhưng ma trận quyền ghi VT-06 không truy cập P01; chưa rõ cách hiệu lực của hạn mức phê duyệt; chưa rõ đơn vị của độ tuổi bậc học. Tài liệu 08 mục 5 còn thiếu phiếu đảo phiếu thu và phiếu đảo phiếu chi so với tài liệu 07 mục 12.1.
- Nội dung thay đổi:
  - Danh mục dùng chung có loại do hệ thống định nghĩa, ban đầu gồm quan hệ với trẻ, loại nghỉ phép, loại hợp đồng, nhóm tài sản; phân hệ nào cần loại mới thì thêm khi xây phân hệ đó; không tạo sẵn mục.
  - VT-06 tạo, sửa phòng ban và chức danh trong đơn vị được gán (`P01.department.manage`).
  - Hạn mức phê duyệt có hiệu lực ngay khi lưu; bản cũ chuyển sang hết hiệu lực; không kế thừa từ Trường chính.
  - Độ tuổi bậc học ghi theo tháng tuổi; mã bậc học không đổi được vì lớp và biểu phí tham chiếu theo mã.
  - Mã quyền mới `P01.department.manage` (VT-02, VT-06), `P01.catalog.manage` (VT-02), `P01.approval-threshold.manage` (VT-02), `P01.room.manage` (VT-02, VT-03).
  - Thêm MH-49 Phòng ban và chức danh, MH-50 Danh mục dùng chung.
  - Tài liệu 08 mục 5 bổ sung phiếu đảo phiếu thu và phiếu đảo phiếu chi cho khớp tài liệu 07.
- Thành phần bị ảnh hưởng: `01`, `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`; mã nguồn DT-01 phần 6b.
- Dữ liệu bị ảnh hưởng: bảng mới `catalog_items`; `grade_levels` dùng `age_from_months`, `age_to_months`; bốn mã quyền mới.
- API bị ảnh hưởng: thêm `PATCH` cho phòng ban, chức danh, phòng học, bậc học; thêm `GET /catalog-types`, `GET`, `POST /catalog-items`, `PATCH /catalog-items/{id}`.
- Giao diện bị ảnh hưởng: MH-33, MH-34, MH-49, MH-50.
- Quyền bị ảnh hưởng: VT-06 có quyền ở P01 cho phòng ban và chức danh; ghi chú 13 của tài liệu 08 sửa theo.
- Ảnh hưởng chức năng cũ: không, các danh mục chưa có mã nguồn.
- Kiểm thử cần thực hiện: CTC-P01-020 đến 022, 024 đến 026, 028, 029, 059, 067, 069, 072, 073, 075.
- Trạng thái: Đã triển khai

### YCTD-41: Ngày chốt học phí và ngày chốt công – 2026-10-09

- Lý do: Eric cho biết ngày chốt học phí là mùng 1 của tháng tiếp theo; trước đó tài liệu ghi chốt học phí và chốt công mặc định ngày cuối tháng (Q-25).
- Nội dung thay đổi: ngày chốt học phí mặc định mùng 1 tháng sau, đơn vị vẫn cấu hình được; ngày chốt công cố định mùng 1 tháng sau, bỏ khỏi cấu hình theo đơn vị.
- Thành phần bị ảnh hưởng: `01`, `09`, `10`, `QT-06`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`; mã nguồn danh mục cấu hình.
- Dữ liệu bị ảnh hưởng: mục cấu hình `attendance_closing_day` bỏ; `tuition_closing_day` có thêm giá trị `next_month_first` làm mặc định.
- API bị ảnh hưởng: `GET /settings` không còn mục ngày chốt công.
- Giao diện bị ảnh hưởng: màn hình Cấu hình.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: phần 6a chưa gộp nên chỉ sửa trên nhánh đang làm.
- Kiểm thử cần thực hiện: CTC-P01-044, 045.
- Trạng thái: Đã triển khai

### YCTD-40: Cấu hình theo đơn vị và tự khóa tài khoản – 2026-10-09

- Lý do: thiết kế DT-01 phần 6a cần giá trị mặc định, cách kế thừa, người sửa cấu hình và nơi cấu hình số ngày tự khóa; tài liệu chưa ghi.
- Nội dung thay đổi: chỉ ngày chốt học phí, ngày chốt công và mốc nhắc nợ có mặc định; các mục khác để trống, bắt buộc nhà trường cấu hình; đơn vị chưa cấu hình lấy giá trị của Trường chính rồi mặc định; thêm PQ-15 và quyền `P01.setting.manage` cho VT-02, VT-03; số ngày tự khóa (PQ-07) mặc định 90, Hiệu trưởng sửa trên cổng, lưu ở bảng mới `identity_settings`; mật khẩu mặc định của phụ huynh làm ở DT-02.
- Thành phần bị ảnh hưởng: `01`, `08`, `10`, `16`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng `settings` ở cơ sở dữ liệu năm học, `identity_settings` ở cơ sở dữ liệu định danh; mã quyền mới.
- API bị ảnh hưởng: `GET`, `PUT /api/v1/settings`; điểm cuối cấu hình của dịch vụ định danh.
- Giao diện bị ảnh hưởng: màn hình cấu hình trong MH-30; MH-31.
- Quyền bị ảnh hưởng: VT-15 chỉ xem cấu hình.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P01-044 đến 048, 051, 053, 054; CTC-DD-006.
- Trạng thái: Đã triển khai

### YCTD-39: Phân quyền quản lý tài khoản – 2026-10-09

- Lý do: thiết kế DT-01 phần 5 cần chốt ai tạo tài khoản, VT-03 được cấp vai trò nào, ai sửa ma trận quyền, cách đặt lại mật khẩu; tài liệu chỉ ghi VT-02, VT-03 cho P01-06 trong khi ma trận cho VT-15 quyền S ở P01.
- Nội dung thay đổi: thêm PQ-13, PQ-14; mã quyền `P01.account.manage-in-unit` cho VT-03; VT-01 và VT-02 sửa được ma trận quyền và tạo vai trò; mật khẩu tạm do hệ thống sinh; bảng `identity_audit_logs` trong cơ sở dữ liệu định danh; khóa, gán, gỡ vai trò, đặt lại mật khẩu thì thu hồi mọi phiên (BM-56).
- Thành phần bị ảnh hưởng: `01`, `08`, `16`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng mới `identity_audit_logs`; mã quyền mới.
- API bị ảnh hưởng: không thêm điểm cuối; các điểm cuối `users`, `roles` kiểm quyền theo PQ-13.
- Giao diện bị ảnh hưởng: MH-30.
- Quyền bị ảnh hưởng: VT-15 không quản lý tài khoản dù có `P01.edit`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P01-030 đến 035, 037 đến 042; CTC-DD-035, 039, 040.
- Trạng thái: Đã triển khai

### YCTD-38: Cây đơn vị hai cấp – 2026-10-09

- Lý do: Eric cho biết trường chỉ có hai cấp: Trường chính và các Phân hiệu, Điểm trường; trước đó QĐ-14 ghi cây không giới hạn cấp.
- Nội dung thay đổi: QĐ-23 thay QĐ-14: cấp 1 là Trường chính duy nhất; cấp 2 là Phân hiệu hoặc Điểm trường, chọn loại cho từng đơn vị, trực thuộc thẳng Trường chính; nhãn cố định; cả hai cấp có lớp. Phạm vi quyền theo đúng đơn vị được gán, gán ở Trường chính là toàn trường. Không ngừng sử dụng được đơn vị còn đơn vị con đang hoạt động. Thêm PQ-12 và quyền `P01.org-unit.manage` chỉ VT-02 có. Dữ liệu kiểm thử: ba Điểm trường trực thuộc TC; tài khoản phạm vi "nhóm A" gán ở PH-A, ĐT-A1, ĐT-A2. CTC-P01-006 không áp dụng.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `08`, `10`, `11`, `12`, `14`, `16`, `17`, `18`, `19`, `20`, `21`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `02_P02_VA_P04.md`, `04_P06.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: `org_units.unit_type` chỉ ba giá trị cố định; không cần đường dẫn phân cấp.
- API bị ảnh hưởng: `org-units` chặn tạo đơn vị dưới đơn vị cấp 2.
- Giao diện bị ảnh hưởng: MH-32 thành cây hai cấp, lọc theo loại.
- Quyền bị ảnh hưởng: gán ở một Phân hiệu không còn bao gồm Điểm trường; VT-15 và VT-03 không quản lý đơn vị dù có `P01.edit`.
- Ảnh hưởng chức năng cũ: chưa có mã cây đơn vị nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CTC-P01-001 đến 005, 007, 008, 012; 009 đến 011 khi có lớp và trẻ.
- Trạng thái: Đã triển khai

### YCTD-37: Mở năm học mới là đóng năm cũ – 2026-10-09

- Lý do: AC-194 và CB-10 ghi mở năm mới thì năm cũ chỉ đọc, trong khi BR-89 và CTC-P01-096 đến 098 ngụ ý năm cũ còn ghi được tới khi đóng riêng; nếu năm cũ vẫn ghi được thì thu nợ của trẻ đang học có thể ghi trùng ở hai năm.
- Nội dung thay đổi: thêm BR-93, mỗi thời điểm chỉ một năm học đang dùng; mở năm mới gồm kiểm tra BR-89, tạo cơ sở dữ liệu, chuyển dữ liệu, chuyển năm cũ sang đã đóng và chỉ đọc; bỏ điểm cuối đóng năm học riêng; BR-89 chuyển từ chặn đóng sang chặn mở; lịch năm học sửa được cho tới khi đóng, sửa ngày thì đánh số lại tuần và giữ cờ nghỉ; thêm PQ-11 và quyền `P01.academic-year.manage` chỉ VT-02 có.
- Thành phần bị ảnh hưởng: `01`, `07`, `08`, `10`, `11`, `16`, `17`, `21`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: `academic_years.status` có ba giá trị; thêm mã quyền mới trong cơ sở dữ liệu định danh.
- API bị ảnh hưởng: bỏ `POST /api/v1/academic-years/{id}/close`; `open` đóng năm đang dùng.
- Giao diện bị ảnh hưởng: MH-43 không có nút đóng năm học.
- Quyền bị ảnh hưởng: VT-15 và VT-03 không quản lý năm học dù có `P01.edit`.
- Ảnh hưởng chức năng cũ: chưa có mã năm học nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CTC-P01-013, 018, 019, 099 đến 104; 014 đến 017, 096 đến 098 khi có dữ liệu trẻ và công nợ.
- Trạng thái: Đã triển khai

### YCTD-36: Thiết kế DT-01 phần 2 – 2026-10-09

- Lý do: thiết kế phần 2 cần chốt nơi lưu mã làm mới trên trình duyệt, nơi đặt mã dùng chung của hai dịch vụ máy chủ, cách điều hướng của cổng quản trị đang mâu thuẫn trong `14`, và màn hình đăng nhập chưa có trong `14`.
- Nội dung thay đổi: mã làm mới gửi bằng cookie httpOnly cho cả ba kênh trình duyệt, không trả trong nội dung phản hồi (BM-71, RG-04); thêm gói `packages/server`; cổng quản trị điều hướng dọc bên trái theo BC-01, sửa sơ đồ mục 1 của `14`; thêm MH-47 Đăng nhập, MH-48 Đổi mật khẩu; kiểm thử giao diện bằng Playwright làm ngay từ phần 2.
- Thành phần bị ảnh hưởng: `01`, `13`, `14`, `17`, `22`, `index.md`; mã nguồn `apps/identity` đổi cách trả mã làm mới.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: `login`, `refresh`, `logout` dùng cookie `refresh_token` thay cho trường `refresh_token`.
- Giao diện bị ảnh hưởng: thêm MH-47, MH-48.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: kiểm thử phần 1 sửa theo cookie.
- Kiểm thử cần thực hiện: CTC-DD-031 đến 037, 041; kiểm thử giao diện luồng đăng nhập.
- Trạng thái: Đã triển khai

### YCTD-35: Quy tắc mật khẩu, tạm khóa, mã quyền và tài khoản đầu tiên – 2026-10-09

- Lý do: thiết kế DT-01 phần 1 cần các giá trị mà tài liệu chưa chốt.
- Nội dung thay đổi: mật khẩu tối thiểu 8 ký tự có chữ và số (BM-03); sai 5 lần tạm khóa 15 phút rồi tự mở (BM-04, XT-05); giới hạn 10 yêu cầu đăng nhập mỗi phút trên một địa chỉ mạng; mã quyền dạng phân hệ và hành động (PQ-09); VT-01 có thêm quyền `P01.account.manage`, tài khoản đầu tiên là VT-01 tạo bằng lệnh (PQ-10); thêm bảng `security_events` và cột `users.locked_until`; sửa kết quả mong đợi của CTC-DD-004.
- Thành phần bị ảnh hưởng: `01`, `08`, `12`, `16`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng mới `security_events`, cột mới `users.locked_until`.
- API bị ảnh hưởng: không thêm điểm cuối.
- Giao diện bị ảnh hưởng: thông báo tạm khóa ghi thời gian thử lại.
- Quyền bị ảnh hưởng: VT-01 có thêm `P01.account.manage`.
- Ảnh hưởng chức năng cũ: chưa có mã nghiệp vụ nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CTC-DD-001 đến 004, 009, 031 đến 034, 043.
- Trạng thái: Đã triển khai

### YCTD-34: Gộp phần lõi dịch vụ định danh vào DT-01 – 2026-10-09

- Lý do: điều kiện ra của DT-01 là đăng nhập được và phân quyền ba lớp chạy đúng, nhưng đăng nhập, tài khoản, vai trò, quyền thuộc dịch vụ định danh ở DT-02; ngoài ra `org_units` nằm trong cơ sở dữ liệu năm học nên phải có năm học trước cây đơn vị.
- Nội dung thay đổi: DT-01 làm theo sáu phần, mỗi phần một yêu cầu gộp: (1) phần lõi dịch vụ định danh; (2) máy chủ API kiểm tra phiên và quyền; (3) năm học; (4) cây đơn vị; (5) quản lý tài khoản, vai trò, quyền; (6) cấu hình, nhật ký thao tác và danh mục. DT-02 chỉ còn mã một lần và kích hoạt tài khoản phụ huynh. Chốt QĐ-20 hỏi dịch vụ định danh quyền hiện hành ở mọi yêu cầu, QĐ-21 cấp quyền tạo cơ sở dữ liệu cho tài khoản kết nối của máy chủ API, QĐ-22 ký mã phiên bằng Ed25519.
- Thành phần bị ảnh hưởng: `01`, `03`, `12`, `index.md`.
- Dữ liệu bị ảnh hưởng: không đổi cấu trúc; tài khoản `api_service` có thêm quyền tạo cơ sở dữ liệu.
- API bị ảnh hưởng: không thêm điểm cuối; máy chủ API dùng `GET /api/v1/auth/me` của dịch vụ định danh để lấy quyền hiện hành.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không đổi quy tắc; PQ-04 được bảo đảm bằng QĐ-20.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: ca CTC-DD và CTC-P01 tương ứng từng phần.
- Trạng thái: Đã triển khai

### YCTD-33: Thư viện truy cập dữ liệu và quy ước nhánh – 2026-10-09

- Lý do: chuẩn bị đợt DT-00; tài liệu chưa chọn thư viện truy cập dữ liệu và chưa có quy ước nhánh trên GitHub.
- Nội dung thay đổi: chọn Kysely cho truy cập dữ liệu và chạy tệp thay đổi cấu trúc (QĐ-18); nhánh `main` được bảo vệ, mỗi việc một nhánh, gộp qua yêu cầu gộp khi kiểm thử đạt và Eric duyệt (QĐ-19); cây thư mục ở `13` mục 4 thêm `database/system/` và sửa `packages/shared` chỉ chứa kiểu dữ liệu và hằng số cho khớp ranh giới ở mục 2.
- Thành phần bị ảnh hưởng: `01`, `12`, `13`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: kiểm thử mẫu của DT-00 chạy tệp thay đổi cấu trúc trên ba cơ sở dữ liệu.
- Trạng thái: Đã triển khai

### YCTD-32: Chỉ dùng GitHub trước, hạ tầng đám mây khi triển khai – 2026-10-09

- Lý do: Eric quyết định trước mắt chỉ dùng GitHub; hạ tầng đám mây cung cấp khi triển khai.
- Nội dung thay đổi: CG-08 và DT-00 chỉ cần kho mã nguồn riêng trên GitHub do Eric tạo và môi trường phát triển chạy Docker trên máy cục bộ (PostgreSQL, Redis qua Docker Compose); GitHub Actions chỉ chạy kiểm thử, chưa triển khai; môi trường thử nghiệm và chạy thật dựng khi có hạ tầng (T6). Việc M01-3 gộp nền móng DT-00 với ranh giới giao diện và máy chủ.
- Thành phần bị ảnh hưởng: `01`, `03`, `12`, `13`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng. Kiểm thử nghiệm thu trên môi trường thử nghiệm và cổng CG-11 vẫn cần T6 (RR-08).
- Kiểm thử cần thực hiện: dựng được môi trường phát triển trống, chạy được một kiểm thử mẫu trên máy và trên GitHub Actions.
- Trạng thái: Đã triển khai

### YCTD-31: Bỏ xác thực hai lớp – 2026-10-09

- Lý do: Eric quyết định hệ thống không cần xác thực hai lớp.
- Nội dung thay đổi: bỏ XT-07, BM-06; điểm cuối `/api/v1/auth/verify-otp` không dùng; mã một lần chỉ còn dùng cho phụ huynh đăng nhập (XT-09); việc N1 ghi đã bỏ; ca CTC-DD-025 đến CTC-DD-030 không áp dụng, thêm CTC-DD-043; ghi rủi ro RR-15.
- Thành phần bị ảnh hưởng: `01`, `03`, `12`, `13`, `16`, `17`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: `one_time_codes.purpose` chỉ còn giá trị đăng nhập.
- API bị ảnh hưởng: bỏ `/api/v1/auth/verify-otp`.
- Giao diện bị ảnh hưởng: không có bước nhập mã sau khi đăng nhập trên cổng quản trị.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CTC-DD-043.
- Trạng thái: Đã triển khai

### YCTD-30: Lịch năm học có học kỳ, kỳ hè và tuần học – 2026-10-09

- Lý do: Eric cho biết năm học không chạy theo năm dương lịch mà gồm hai học kỳ, bắt đầu khoảng 05/09 và kết thúc khoảng tháng 5 năm sau; cần cấu hình thời gian từng học kỳ và tuần học khi tạo năm học. Năm học trước đây chỉ có ngày bắt đầu và kết thúc.
- Nội dung thay đổi:
  - BR-91: Hiệu trưởng lập lịch năm học chung toàn trường gồm học kỳ 1, học kỳ 2, kỳ hè không bắt buộc, ngày học trong tuần; hệ thống tự đánh số tuần; đánh dấu tuần nghỉ.
  - BR-23: số ngày học của tháng tính theo lịch năm học, trừ tuần nghỉ và ngày lễ, cộng ngày học bù thứ bảy.
  - BR-92 và P05-13 Đăng ký học hè (G1): đăng ký theo từng tháng hè; chỉ trẻ đã đăng ký mới được điểm danh và tính học phí tháng hè.
  - BR-30: số phiếu không trùng trong đơn vị và năm học, đánh lại từ đầu mỗi năm học.
  - Sửa P01-02, AC-30, QT-02, QT-03, QT-04, QT-05; thêm G1-20, MH-45, MH-46, AC-228 đến AC-232, CT-184 đến CT-188 và 15 ca chi tiết.
- Thành phần bị ảnh hưởng: `01`, `05`, `07`, `10`, `11`, `14`, `16`, `17`, `21`, QT-02 đến QT-05, `27_BO_CA_KIEM_THU_CHI_TIET/`, `index.md`.
- Dữ liệu bị ảnh hưởng: `academic_years` chuyển sang cơ sở dữ liệu hệ thống, chung toàn trường, thêm `school_days_of_week`; thêm bảng `academic_terms`, `school_weeks`, `summer_registrations`; số bảng từ 159 lên 162.
- API bị ảnh hưởng: thêm `/api/v1/academic-years/{id}/calendar`, `/api/v1/academic-years/{id}/weeks`, `/api/v1/summer-registrations`.
- Giao diện bị ảnh hưởng: thêm MH-45 Lịch năm học, MH-46 Đăng ký học hè; MP-12 có đăng ký học hè.
- Quyền bị ảnh hưởng: chỉ Hiệu trưởng lập lịch năm học; kế toán và phụ huynh đăng ký học hè.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-184 đến CT-188, CTC-P01-099 đến CTC-P01-104, CTC-P04-044 đến CTC-P04-046, CTC-P05-063 đến CTC-P05-067, CTC-P06-066.
- Trạng thái: Đã triển khai

### YCTD-29: Lương trả trước đầu tháng, điều chỉnh theo công tháng trước – 2026-10-09

- Lý do: khi viết bộ ca kiểm thử P08 (N21), Q-153 về AC-40 làm rõ cách chi lương thực tế: lương chi từ đầu tháng, không đợi chốt công; ngày công bị trừ vào tháng tiếp theo. Eric trả lời thêm Q-154 đến Q-156 và duyệt bản đánh giá ảnh hưởng ngày 09/10/2026.
- Nội dung thay đổi:
  - BR-43 viết lại: lương tháng M trả trước đầu tháng M; điều chỉnh theo bảng công đã chốt tháng M−1 gồm trừ ngày không hưởng lương theo tỷ lệ ngày công (Q-154), cộng tiền làm thêm giờ, phụ cấp và khấu trừ theo ngày công; tháng M−1 chưa chốt công thì chặn tính lương tháng M; nhân sự mới không được trả trước tháng đầu (Q-155).
  - BR-82: tiền làm thêm giờ cộng vào bảng lương tháng kế tiếp.
  - BR-90: bảng quyết toán cuối cùng khi chấm dứt hợp đồng; trả thừa ghi khoản phải thu hồi, thu bằng phiếu thu không gắn trẻ (Q-156).
  - Q-153: vẫn chặn chốt công khi còn đơn nghỉ chờ duyệt; AC-40 sửa cho đơn bị từ chối hoặc đã hủy.
  - Sửa P07-02, P08-06, P08-12, AC-43, AC-197, CB-02, N-05, CT-049, DL-07, QT-06; thêm AC-224 đến AC-227, CT-180 đến CT-183.
- Thành phần bị ảnh hưởng: `01`, `07`, `09`, `10`, `11`, `12`, `16`, `17`, `20`, `21`, QT-06, `index.md`.
- Dữ liệu bị ảnh hưởng: `payroll_periods` thêm `payroll_type`, `adjustment_year`, `adjustment_month`, bỏ `attendance_locked_at`; `payslips` thêm `adjustment_amount`, `recovery_amount`; `receipts` thêm `staff_id`, `child_id` được để trống với phiếu thu thu hồi lương.
- API bị ảnh hưởng: `/api/v1/payrolls` tính bảng lương trả trước và trả lỗi khi tháng trước chưa chốt công; thêm `/api/v1/payrolls/settlements`.
- Giao diện bị ảnh hưởng: bảng lương hiển thị phần trả trước và phần điều chỉnh theo công tháng trước; màn hình lập bảng quyết toán.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-049, CT-180 đến CT-183 và bộ ca chi tiết P08.
- Trạng thái: Đã triển khai

### YCTD-28: Thủ quỹ phân bổ phiếu thu tiền mặt (Q-152) – 2026-10-09

- Lý do: viết bộ ca kiểm thử chi tiết đợt 4 (N21) phát hiện P06-01 cho thủ quỹ lập phiếu thu tiền mặt nhưng P06-02 chỉ cho kế toán phân bổ, trong khi BR-31 yêu cầu chọn hóa đơn khi lập phiếu. Eric chốt: thủ quỹ được chọn hóa đơn và phân bổ.
- Nội dung thay đổi: P06-02 thêm VT-16; QT-04 ghi thủ quỹ phân bổ; thêm AC-223, CT-179.
- Thành phần bị ảnh hưởng: `01`, `10`, `11`, `21`, QT-04, `27_BO_CA_KIEM_THU_CHI_TIET/`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: `/api/v1/receipts` nhận danh sách phân bổ từ VT-16 khi phương thức là tiền mặt.
- Giao diện bị ảnh hưởng: biểu mẫu phiếu thu của thủ quỹ có bước chọn hóa đơn.
- Quyền bị ảnh hưởng: VT-16 có quyền phân bổ phiếu thu tiền mặt; không lập, không sửa hóa đơn.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-179, CTC-P06-011, CTC-P06-012.
- Trạng thái: Đã triển khai

### YCTD-27: Trả lời Q-150, Q-151 khi viết bộ ca kiểm thử P05 – 2026-10-09

- Lý do: viết bộ ca kiểm thử chi tiết đợt 3 (N21) phát hiện hai điểm căn cứ chưa rõ về cách tính tiền. Eric trả lời ngày 09/10/2026.
- Nội dung thay đổi:
  - Q-150: đăng ký trễ phải ghi ngày bắt đầu học dịch vụ; thu theo ngày thực tế tính từ ngày đó, kể cả ngày đó, đến cuối tháng. Sửa BR-26, P05-03, AC-199.
  - Q-151: còn ngày chưa chốt điểm danh trong kỳ thì chặn tính học phí và liệt kê lớp, ngày chưa chốt. Sửa P05-05; thêm AC-222, CT-178, QT-03 E12.
- Thành phần bị ảnh hưởng: `01`, `07`, `10`, `11`, `16`, `21`, QT-03, `27_BO_CA_KIEM_THU_CHI_TIET/`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng `service_registrations` thêm cột `service_start_date`.
- API bị ảnh hưởng: không đổi đường dẫn; `/api/v1/service-registrations` nhận ngày bắt đầu học dịch vụ khi đăng ký trễ; `/api/v1/fee-calculations` trả `ERR_RULE_VIOLATION` khi còn ngày chưa chốt điểm danh.
- Giao diện bị ảnh hưởng: màn hình đăng ký dịch vụ của phụ huynh có ô ngày bắt đầu khi đăng ký trễ; màn hình chạy tính học phí hiển thị danh sách lớp, ngày chưa chốt.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-178, CTC-P05-013, CTC-P05-015, CTC-P05-031.
- Trạng thái: Đã triển khai

### YCTD-26: Trả lời Q-147 đến Q-149 khi viết bộ ca kiểm thử chi tiết – 2026-10-09

- Lý do: viết bộ ca kiểm thử chi tiết đợt 1 (N21) phát hiện ba điểm căn cứ chưa rõ. Eric trả lời ngày 09/10/2026.
- Nội dung thay đổi:
  - Q-147: phụ huynh chưa đổi mật khẩu mặc định vẫn đăng nhập bằng mã một lần và dùng bình thường; sửa BM-69, AC-203, P19-06, RR-14.
  - Q-148: người được đặt lại mật khẩu bắt buộc đổi ở lần đăng nhập kế tiếp; sửa BM-07, P01-06; thêm AC-220, CT-176.
  - Q-149: công nợ của trẻ đã thôi học không chuyển sang năm mới; chặn đóng năm học khi còn nợ loại này; thêm BR-89, AC-221, CT-177; sửa P01-02.
- Thành phần bị ảnh hưởng: `01`, `07`, `10`, `11`, `21`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/`, `index.md`.
- Dữ liệu bị ảnh hưởng: không đổi bảng.
- API bị ảnh hưởng: không đổi đường dẫn; `/api/v1/academic-years/{id}/close` trả `ERR_RULE_VIOLATION` kèm BR-89; `/api/v1/users/{id}/reset-password` đặt cờ bắt buộc đổi mật khẩu.
- Giao diện bị ảnh hưởng: màn hình năm học hiển thị danh sách trẻ còn nợ khi bị chặn đóng.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-176, CT-177, CTC-DD-042, CTC-P01-035, CTC-P01-096 đến CTC-P01-098.
- Trạng thái: Đã triển khai

### YCTD-25: Bổ sung nội dung gửi thuốc cho y tế và chăm sóc sức khỏe – 2026-10-09

- Lý do: Eric yêu cầu bổ sung nội dung cho chức năng gửi thuốc và chăm sóc sức khỏe, giữ ở giai đoạn 2.
- Nội dung thay đổi:
  - BR-86: cấu hình đơn vị "không có nhân viên y tế"; khi bật, giáo viên chủ nhiệm nhận thuốc, cho uống và ghi liều.
  - BR-48: bắt buộc ít nhất một ảnh thuốc; ảnh đơn thuốc không bắt buộc (giữ Q-60).
  - BR-87 và P10-12 Theo dõi chăm sóc hằng ngày (G2): nhiệt độ, tình trạng khi ốm, chăm sóc đặc biệt; phụ huynh xem trên ứng dụng.
  - BR-88: phụ huynh xác nhận đã biết sự kiện y tế và bỏ liều; chỉ hiển thị trạng thái, không nhắc lại.
  - Sửa BR-49, BR-50, P01-08, P10-03, P10-04, P10-07, G2-02; GD-32 không còn hiệu lực.
  - Thêm AC-215 đến AC-219, CT-171 đến CT-175.
- Thành phần bị ảnh hưởng: `01`, `05`, `07`, `08`, `10`, `11`, `14`, `16`, `17`, `20`, `21`, QT-07, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `daily_care_logs`; `medication_requests` thêm `medicine_photo_ids`, `prescription_photo_id`, `assigned_role`; `medication_administrations` và `medical_events` thêm `parent_acknowledged_at`, `parent_acknowledged_by`; số bảng từ 158 lên 159.
- API bị ảnh hưởng: thêm `/api/v1/medication-administrations/{id}/acknowledge`, `/api/v1/medical-events/{id}/acknowledge`, `/api/v1/children/{id}/daily-care-logs`.
- Giao diện bị ảnh hưởng: MG-09, MP-08.
- Quyền bị ảnh hưởng: ghi chú 17 của ma trận: quyền S của VT-07 ở P10.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-171 đến CT-175.
- Trạng thái: Đã triển khai

### YCTD-24: Ban Giám hiệu duyệt phiếu đảo phiếu chi – 2026-10-09

- Lý do: rà duyệt QT-05 phát hiện bảng trạng thái ghi Ban Giám hiệu duyệt phiếu đảo phiếu chi, nhưng bước 8, danh mục hạn mức và tài liệu 17 không có bước duyệt. Eric chốt: làm giống phiếu đảo phiếu thu (YCTD-23).
- Nội dung thay đổi: thêm phiếu đảo phiếu chi vào danh mục chứng từ áp dụng hạn mức; P06-04 thêm bước duyệt phiếu đảo; số dư chỉ hoàn lại khi đã duyệt; thêm AC-214, CT-170.
- Thành phần bị ảnh hưởng: `01`, `07`, `10`, `11`, `17`, `21`, QT-05, `index.md`.
- Dữ liệu bị ảnh hưởng: không đổi bảng; phiếu đảo là một dòng `payments` có `approved_by`, `approved_at`.
- API bị ảnh hưởng: thêm `/api/v1/payments/{id}/reverse/approve`, `/api/v1/payments/{id}/reverse/reject`.
- Giao diện bị ảnh hưởng: MH-10 hiển thị phiếu đảo chờ duyệt cho Ban Giám hiệu.
- Quyền bị ảnh hưởng: không; Ban Giám hiệu đã có quyền D ở P06.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-170.
- Trạng thái: Đã triển khai

### YCTD-23: Ban Giám hiệu duyệt phiếu đảo phiếu thu và quyết định xử lý công nợ quá hạn – 2026-10-09

- Lý do: rà duyệt QT-04 phát hiện QT-04 ghi Ban Giám hiệu duyệt phiếu đảo và xử lý công nợ, nhưng danh mục hạn mức, P06-03 và tài liệu 17 không có bước duyệt; bước xử lý công nợ không có chức năng, bảng và điểm cuối. Eric chốt: phiếu đảo phiếu thu do Ban Giám hiệu duyệt theo hạn mức; xử lý công nợ quá hạn do Ban Giám hiệu quyết, thêm chức năng ở giai đoạn 2.
- Nội dung thay đổi:
  - Thêm phiếu đảo phiếu thu vào danh mục chứng từ áp dụng hạn mức; P06-03 thêm bước duyệt; LP-05 cập nhật.
  - Thêm P05-12 Xử lý công nợ quá hạn (G2) và G2-17: quản lý đơn vị hoặc kế toán lập đề xuất, Phó Hiệu trưởng hoặc Hiệu trưởng ghi quyết định, không thay đổi số tiền công nợ.
  - Thêm AC-212, AC-213, CT-168, CT-169.
- Thành phần bị ảnh hưởng: `01`, `05`, `07`, `08`, `09`, `10`, `11`, `14`, `16`, `17`, `21`, QT-04, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `debt_resolutions`; bảng `receipts` thêm `approved_by`, `approved_at`; số bảng từ 157 lên 158.
- API bị ảnh hưởng: thêm `/api/v1/receipts/{id}/reverse/approve`, `/api/v1/receipts/{id}/reverse/reject`, `/api/v1/debt-resolutions`, `/api/v1/debt-resolutions/{id}/decide`.
- Giao diện bị ảnh hưởng: MH-08 thêm lập đề xuất và ghi quyết định; thêm VT-15, VT-02.
- Quyền bị ảnh hưởng: ma trận P05 của VT-03 thành X, S, ghi chú 16.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-168, CT-169.
- Trạng thái: Đã triển khai

### YCTD-22: Hóa đơn bổ sung, cơ sở dữ liệu hệ thống, bổ sung bảng khi rà duyệt tài liệu 16 – 2026-10-09

- Lý do: rà duyệt `16_CO_SO_DU_LIEU.md` phát hiện bảng không theo năm học nằm chung cơ sở dữ liệu năm học, ràng buộc mỗi tháng một hóa đơn chặn khoản phát sinh sau phát hành, và thiếu bảng cho phân công giáo viên, tổ chuyên môn, phiên đăng nhập, mã một lần.
- Nội dung thay đổi:
  - QĐ-17: khóa API đối tác ở cơ sở dữ liệu định danh; danh sách cơ sở dữ liệu năm học ở cơ sở dữ liệu hệ thống của máy chủ API; giữ nguyên mã định danh khi mở năm học.
  - BR-85: mỗi trẻ mỗi kỳ một hóa đơn chính; khoản phát sinh sau phát hành lập hóa đơn bổ sung cùng kỳ. Cập nhật P05-06, P14-11; thêm AC-210, CT-166.
  - Thêm bảng `sessions`, `one_time_codes`, `class_staff_assignments`, `teaching_groups`, `teaching_group_members`.
  - Thêm cột `children.related_staff_id`, `invoices.invoice_kind`, `payments.payment_type`, `payments.child_id`, `data_access_logs.api_client_id`, `scope`, `record_count`.
- Thành phần bị ảnh hưởng: `01`, `03`, `07`, `10`, `11`, `12`, `16`, `17`, `21`, `index.md`.
- Dữ liệu bị ảnh hưởng: như trên; số bảng từ 152 lên 157.
- API bị ảnh hưởng: thêm `/api/v1/invoices/supplementary`.
- Giao diện bị ảnh hưởng: MH-06 có thao tác lập hóa đơn bổ sung.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-166.
- Trạng thái: Đã triển khai

### YCTD-21: Màn hình cá nhân cho nhân sự dùng cổng quản trị; chỉnh sửa khi rà duyệt tài liệu 14 – 2026-10-09

- Lý do: rà duyệt `14_DAC_TA_GIAO_DIEN.md` phát hiện MG-10 đến MG-12 ghi cho vai trò không dùng ứng dụng giáo viên, còn nhân sự dùng cổng quản trị chưa có nơi xem phiếu lương và xin nghỉ. Eric chọn tự phục vụ ở cả hai kênh (Q-146).
- Nội dung thay đổi:
  - Thêm MH-44 Cá nhân trên cổng quản trị; MG-10 đến MG-12 dành cho mọi nhân sự dùng ứng dụng giáo viên.
  - Sửa vai trò màn hình theo YCTD-17 đến YCTD-19: MH-05, MH-07, MH-09, MH-10, MH-11, MH-13, MH-15, MH-28, MH-29, MH-30.
  - MH-19 có buffet theo dịp; MH-40 có nhập mã định danh ngành; MP-18 có đồng ý sử dụng hình ảnh; MH-32 theo QĐ-14.
  - Sửa BC-01, BC-08, XL-05; bỏ mục xe trong sơ đồ điều hướng.
- Thành phần bị ảnh hưởng: `01`, `14`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không thêm điểm cuối; MH-44 dùng các điểm cuối tự phục vụ sẵn có.
- Giao diện bị ảnh hưởng: thêm MH-44.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: bổ sung khi viết bộ ca kiểm thử chi tiết N21.
- Trạng thái: Đã triển khai

### YCTD-20: Bỏ bữa tối, ba bữa thuộc bán trú, buffet theo dịp; chỉnh sửa khi rà duyệt tài liệu 11 – 2026-10-09

- Lý do: rà duyệt `11_TIEU_CHI_NGHIEM_THU.md` phát hiện công thức suất ăn (BR-58, AC-58) trừ trẻ nghỉ hai lần. Eric cho biết trường không có bữa tối; suất ăn một ngày gồm ba bữa sáng, trưa, xế; số suất bằng số trẻ có mặt; vắng ngày nào không tính tiền ăn ngày đó; buffet là tiệc theo dịp không thu riêng. Câu trả lời này thay phần ăn tối của Q-06.
- Nội dung thay đổi:
  - Bỏ dịch vụ ăn tối và ăn sáng riêng; ba bữa thuộc bán trú (BR-83); BR-58 viết lại.
  - P17-15 Báo cáo ăn tối, AC-171, CT-127 ghi bỏ; P12-07 chỉ còn báo cơm; P12-06 đổi thành buffet theo dịp.
  - AC-21, CT-023, QT-03 đổi ví dụ dịch vụ thành bán trú, STEM, Anh văn; AC-58, CT-064 viết lại.
  - Sửa tài liệu 11: AC-26 ghi công thức cụ thể, AC-29 theo BR-26, AC-41 Ban Giám hiệu mở lại kỳ công, AC-43 có tiền làm thêm giờ, AC-89 và AC-180 bỏ kích hoạt tài khoản, AC-147 theo P01-06, AC-166 chỉ cho phí theo từng hoạt động.
  - Thêm AC-206 đến AC-209 và CT-162 đến CT-165 cho quyết định YCTD-17, YCTD-18, Q-112, BM-68.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `10`, `11`, `16`, `17`, `21`, `QT-02`, `QT-03`, `index.md`.
- Dữ liệu bị ảnh hưởng: gỡ `meal_registrations`; `buffet_registrations` thay bằng `buffet_events`; `meal_plans.meal_type` nhận sáng, trưa, xế.
- API bị ảnh hưởng: gỡ `/api/v1/meal-registrations`, `/api/v1/reports/dinners`; `/api/v1/buffet-registrations` thay bằng `/api/v1/buffet-events`.
- Giao diện bị ảnh hưởng: MG-14 chỉ còn suất ăn và báo cơm theo điểm danh.
- Quyền bị ảnh hưởng: phụ huynh không còn đăng ký hoặc hủy bữa.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-023, CT-064, CT-162 đến CT-165.
- Trạng thái: Đã triển khai

### YCTD-19: Phiếu chi và quỹ tiền mặt chuyển sang giai đoạn 1; chỉnh sửa khi rà duyệt tài liệu 10 – 2026-10-09

- Lý do: rà duyệt `10_YEU_CAU_CHUC_NANG.md` phát hiện giai đoạn 1 có thôi học kèm hoàn tiền (BR-24), thu tiền mặt và phiếu chi lương (QT-06) nhưng phiếu chi và quỹ tiền mặt nằm ở giai đoạn 2. Eric chọn đưa vào giai đoạn 1.
- Nội dung thay đổi:
  - P06-04 Phiếu chi và P06-05 Quỹ tiền mặt chuyển sang G1; thêm G1-19; G2-09 chỉ còn tài khoản ngân hàng và công nợ phải trả; đợt DT-05 và module M06 gồm phiếu chi và quỹ tiền mặt.
  - Sửa chức năng cho khớp quyết định đã chốt: P05-07 và P05-08 do Ban Giám hiệu phê duyệt theo hạn mức (bỏ quản lý đơn vị khỏi P05-07); P08-06 phê duyệt bảng lương theo hạn mức; P08-04 mở lại kỳ công do Ban Giám hiệu duyệt; P08-03 quản lý trực tiếp duyệt nghỉ phép; P02-08 hoàn tiền theo BR-24; P06-01, P06-04, P06-05 thêm thủ quỹ.
  - Bổ sung chi tiết đã chốt: công tắc cấu hình BR-34, BR-62, BR-73 trong P01-08; tạo tài khoản phụ huynh trong P02-03; lưu tạm điểm danh và ngày học bù trong P04-01; cờ dịch vụ bắt buộc trong P05-02; chặn đăng ký khi nợ trong P05-03; P19-06 bỏ mã kích hoạt, bắt buộc đổi mật khẩu mặc định.
  - Sửa dẫn chiếu sai ở P06-04, P18-01, P18-03; thêm vai trò còn thiếu ở P08-08, P17-01, P19-01.
- Thành phần bị ảnh hưởng: `01`, `03`, `05`, `10`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng `payments` và sổ quỹ tiền mặt cần có từ giai đoạn 1.
- API bị ảnh hưởng: các điểm cuối `/api/v1/payments` và sổ quỹ chuyển sang giai đoạn 1.
- Giao diện bị ảnh hưởng: MH-10 Phiếu chi và phê duyệt cần có từ giai đoạn 1.
- Quyền bị ảnh hưởng: quản lý đơn vị không còn tham gia miễn giảm.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng; khối lượng giai đoạn 1 tăng.
- Kiểm thử cần thực hiện: CT-038 đến CT-042, CT-097 đến CT-100 chạy ở giai đoạn 1.
- Trạng thái: Đã triển khai

### YCTD-18: Bổ sung quyền còn thiếu khi rà duyệt tài liệu 08 – 2026-10-09

- Lý do: rà duyệt `08_VAI_TRO_NGUOI_DUNG.md` phát hiện ma trận quyền thiếu quyền đã được quyết định ở nơi khác; Eric trả lời phạm vi của kiểm toán viên (Q-145).
- Nội dung thay đổi:
  - VT-20 luôn ở phạm vi toàn trường; VT-19 ghi rõ phạm vi toàn trường trong PQ-03; BR-01 sửa theo.
  - Ma trận: VT-03 có quyền D ở P02 (duyệt hồ sơ trẻ) và P08 (duyệt đơn nghỉ phép); VT-19, VT-20 có quyền X ở P19 để đăng nhập cổng quản trị.
  - Ghi chú mới: Ban Giám hiệu lập lịch nghỉ thứ 7 trong P08; kế toán và nhân sự dùng P01-13 cho dữ liệu của mình.
  - Bảng phân cấp phê duyệt ghi ngoại lệ phiếu chi hoàn tiền khi trẻ thôi học.
- Thành phần bị ảnh hưởng: `01`, `07`, `08`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: kiểm tra quyền của các điểm cuối duyệt hồ sơ trẻ, duyệt đơn nghỉ phép, nhập dữ liệu ban đầu, lịch nghỉ thứ 7 theo ma trận mới.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: như trên.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: bổ sung khi viết bộ ca kiểm thử chi tiết N21.
- Trạng thái: Đã triển khai

### YCTD-17: Quyền xem sức khỏe, quyền hoàn tiền và các chỉnh sửa khi rà duyệt tài liệu 07 – 2026-10-09

- Lý do: rà duyệt `07_QUY_TAC_NGHIEP_VU.md` phát hiện BR-53 mâu thuẫn ma trận quyền, BR-24 mâu thuẫn Q-134 và một số quy tắc chưa theo quyết định đã chốt.
- Nội dung thay đổi:
  - BR-53: thêm Ban Giám hiệu vào nhóm được xem dữ liệu sức khỏe; ma trận quyền P10 bỏ quyền xem của kế toán trưởng, nhân sự, giáo viên bộ môn.
  - BR-24: bù trừ hoặc hoàn tiền khi trẻ thôi học do Hiệu trưởng quyết định; phiếu chi hoàn tiền luôn do Hiệu trưởng phê duyệt, không xét hạn mức; BR-77 ghi ngoại lệ này và quy tắc Q-112.
  - BR-01: Quản trị nền tảng không xem dữ liệu nghiệp vụ. BR-03: bỏ cụm cấp thấp nhất. BR-20: loại giảm trừ do nhà trường cấu hình. BR-46: thêm kế toán trưởng, Ban Giám hiệu, kiểm toán viên. BR-73: API đối tác và xem đầy đủ số định danh luôn ghi nhật ký.
  - Đơn nghỉ phép thêm trạng thái Từ chối.
- Thành phần bị ảnh hưởng: `07`, `08`, `QT-03`, `QT-06`, `QT-07`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: điểm cuối phân hệ Y tế từ chối kế toán trưởng, nhân sự, giáo viên bộ môn; điểm cuối phê duyệt phiếu chi hoàn tiền chỉ nhận Hiệu trưởng.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: như trên.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: bổ sung khi viết bộ ca kiểm thử chi tiết N21.
- Trạng thái: Đã triển khai

### YCTD-16: Bỏ dịch vụ học thứ bảy, lịch học bù chung toàn trường – 2026-10-09

- Lý do: khi rà duyệt `06_YEU_CAU_NGHIEP_VU.md`, Eric xác nhận thứ bảy là lịch học bù chung toàn trường do Ban Giám hiệu lập trên hệ thống, không phải dịch vụ từng trẻ đăng ký.
- Nội dung thay đổi:
  - Bỏ dịch vụ học thứ bảy thu phí theo trẻ: BR-27 và QTN-05 ghi bỏ; BR-19, QT-03, NV-06 gỡ khoản tiền học thứ bảy.
  - Thêm BR-84: Ban Giám hiệu lập lịch nghỉ thứ bảy định kỳ và lịch học bù chung toàn trường; ngày học bù là ngày học bình thường của mọi lớp, tính vào số ngày học của tháng, không thu phí riêng; với nhân sự là ngày làm việc.
  - P08-10 chuyển người thực hiện sang Ban Giám hiệu (VT-02, VT-15); GD-86 ghi thay thế.
  - P17-14 Báo cáo học thứ 7 đổi nội dung thành số trẻ đi học và vắng của từng ngày học bù.
  - AC-21, CT-023 thay học thứ bảy bằng ăn tối; sửa AC-158, AC-170, CT-126; thêm AC-204, AC-205, CT-160, CT-161.
- Thành phần bị ảnh hưởng: `01`, `06`, `07`, `10`, `11`, `14`, `16`, `17`, `21`, `QT-03`, `index.md`.
- Dữ liệu bị ảnh hưởng: `saturday_schedules.org_unit_id` luôn là đơn vị gốc; danh mục dịch vụ không còn dịch vụ học thứ bảy.
- API bị ảnh hưởng: `/api/v1/saturday-schedules` chỉ Ban Giám hiệu được tạo và sửa; đổi mô tả `/api/v1/reports/saturday-classes`.
- Giao diện bị ảnh hưởng: MH-37 phần lịch nghỉ thứ 7 do Ban Giám hiệu thao tác.
- Quyền bị ảnh hưởng: nhân sự và quản lý đơn vị không còn lập lịch nghỉ thứ bảy.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-023, CT-114, CT-126, CT-129, CT-160, CT-161.
- Trạng thái: Đã triển khai

### YCTD-15: Xác nhận giả định và áp dụng câu trả lời lượt 17 đến lượt 21 – 2026-10-09

- Lý do: Eric xác nhận các giả định qua năm lượt tích chọn và trả lời các điểm cần làm rõ.
- Nội dung thay đổi:
  - 57 giả định được Eric xác nhận trực tiếp; 19 giả định đánh dấu đã xác nhận theo quyết định đã chốt trước đó (dẫn quyết định gốc trong dòng); GD-16 sửa thành nhân sự chốt công, kế toán chốt học phí và tính lương; 8 giả định ghi không còn hiệu lực (GD-11, GD-15, GD-20, GD-21, GD-34, GD-35, GD-64, GD-88).
  - Bán trú bắt buộc với mọi trẻ (BR-83); sau ngày chốt chỉ đăng ký thêm dịch vụ không bắt buộc như STEM, Anh văn, 7 môn phối hợp, phải được Ban Giám hiệu duyệt và Ban Giám hiệu chọn thu cả tháng hay theo ngày thực tế (BR-26); QT-03 lên 1.3.
  - Trẻ nhận diện bằng số định danh cá nhân bắt buộc và mã định danh ngành không bắt buộc, tô đỏ khi trống (BR-07); số định danh và giấy khai sinh bắt buộc khi tạo hồ sơ (BR-81); thêm P02-12 nhập mã ngành từ tệp ở giai đoạn 1, kết nối tự động để giai đoạn 3 (G3-09, Q-144, T8).
  - Tạo tài khoản cho mọi phụ huynh có số điện thoại với mật khẩu mặc định chung, bắt buộc đổi lần đầu (PQ-06, XT-03, BM-69); thêm rủi ro RR-14; QT-01 lên 1.2.
  - Không chia mốc trong ngày; nhân sự chỉ chấm công vào và ra.
- Thành phần bị ảnh hưởng: `01`, `03`, `05`, `07`, `08`, `09`, `10`, `11`, `12`, `16`, `17`, `21`, `22`, `QT-01`, `QT-03`, `index.md` và dòng giả định trong mọi tài liệu.
- Dữ liệu bị ảnh hưởng: `children.code` thay bằng `moet_student_code` và `national_id_hash`; `services.is_mandatory`; `service_registrations` thêm cột đăng ký trễ.
- API bị ảnh hưởng: thêm `/api/v1/service-registrations/{id}/approve-late`, `/api/v1/imports/moet-codes`; đổi mô tả `/api/v1/auth/activate`.
- Giao diện bị ảnh hưởng: danh sách và hồ sơ trẻ tô đỏ ô mã ngành trống; màn hình đăng nhập lần đầu chỉ cho đổi mật khẩu.
- Quyền bị ảnh hưởng: Ban Giám hiệu duyệt đăng ký trễ.
- Ảnh hưởng chức năng cũ: hệ thống không còn tự sinh mã trẻ.
- Kiểm thử cần thực hiện: CT-009, CT-154 đến CT-159.
- Trạng thái: Đã triển khai

### YCTD-14: Áp dụng câu trả lời lượt 9 đến lượt 16 – 2026-10-09

- Lý do: Eric trả lời toàn bộ 76 câu hỏi mở còn lại và câu mới Q-143. Phần lớn chấp nhận đề xuất; các quyết định có tác động lớn liệt kê dưới đây.
- Nội dung thay đổi:
  - Bỏ phân hệ P11 Xe đưa đón (Q-62): giữ mã kèm ghi chú đã bỏ ở P11-01 đến P11-07, P17-09, BR-54, BR-55, BR-57, AC-53 đến AC-57, CT-059 đến CT-063, CB-04, MG-13, MP-13, NV-15, QTP-09, QTN-07, LN-08, N-07, LP-09, LE-06, DL-09, G2-03, M11; QT-08 đánh dấu đã bỏ; QT-02 thay bước xác nhận lên xe bằng bảo vệ xác nhận người đón; gỡ tám bảng và mười điểm cuối.
  - Vai trò (Q-21, Q-110): bỏ VT-13; thêm VT-16 Thủ quỹ, VT-17 Tổ trưởng chuyên môn, VT-18 Bảo vệ, VT-19 Cán bộ quản lý cấp trên, VT-20 Kiểm toán viên; ma trận quyền thêm năm cột; P03-02 thêm bước tổ trưởng duyệt; thêm MG-16, MG-17; GD-92.
  - Cây đơn vị không giới hạn cấp (Q-124): QĐ-14 thay QĐ-09; viết lại BR-01, AC-136, AC-137, CT-092, AI-33, nguyên tắc 11 của câu lệnh hệ thống; GD-76 hết hiệu lực; cụm "ba cấp" trong tài liệu đổi thành "nhiều cấp", trừ các ghi chép lịch sử.
  - Mỗi năm học một cơ sở dữ liệu (Q-90): QĐ-15 điều chỉnh QĐ-02; P01-02 mở và đóng năm học kèm chuyển dữ liệu; bảng `academic_year_databases`; hai điểm cuối mở, đóng năm học; MH-43; AC-194, CT-150; rủi ro RR-13 mức cao; GD-90.
  - API chỉ đọc cho đối tác ngay giai đoạn 1 (Q-94, Q-143): QĐ-16; P01-14; bảng `api_clients`; sáu điểm cuối; MH-42; BM-65, BM-66; AC-195, AC-196, CT-151, CT-152.
  - Tiền làm thêm giờ tối đa 1 giờ mỗi ngày, không có phụ cấp dạy thay (Q-57): BR-82, P08-12, cột `attendance_logs.overtime_minutes`, AC-197, CT-153, GD-91.
  - Quy tắc AI chặt hơn (Q-97 đến Q-99): AI-40, nguyên tắc 16; sửa lỗi trong phạm vi đã duyệt cũng cần Eric xác nhận.
  - Các câu còn lại: BR-06 bắt buộc khai dị ứng; trường nhu cầu đặc biệt; BR-66 cho ẩn bình luận vi phạm; học phí không giảm khi nghỉ ốm; XT-02 thời hạn phiên; SL-04 khôi phục trong 4 giờ; XD-04 giữ hồ sơ trẻ 5 năm rồi ẩn danh; PCF-01 theo quy mô dưới 1 000 trẻ; bảng `approval_thresholds`; nhà cung cấp tin nhắn và xác nhận chuyển khoản cấu hình được; BM-67 tuân thủ bảo vệ dữ liệu cá nhân; BM-68 tài khoản kiểm toán có hạn; Hiệu trưởng chịu trách nhiệm dữ liệu cá nhân; việc N21 viết ca kiểm thử chi tiết.
- Thành phần bị ảnh hưởng: gần như toàn bộ bộ tài liệu và các quy trình QT-01, QT-02, QT-06, QT-07, QT-08, QT-09, QT-10.
- Dữ liệu bị ảnh hưởng: gỡ tám bảng xe đưa đón; thêm `approval_thresholds`, `api_clients`, `academic_year_databases`; thêm cột `users.valid_until`, `attendance_logs.overtime_minutes`, `children.special_needs_note`; `org_units.unit_type` thành nhãn.
- API bị ảnh hưởng: gỡ mười điểm cuối xe đưa đón; thêm tám điểm cuối năm học và đối tác.
- Giao diện bị ảnh hưởng: bỏ MG-13, MP-13; thêm MH-42, MH-43, MG-16, MG-17.
- Quyền bị ảnh hưởng: năm vai trò mới, bỏ VT-13; đối tác đọc dữ liệu qua khóa API.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng dữ liệu thật.
- Kiểm thử cần thực hiện: CT-092, CT-150 đến CT-153; bộ ca chi tiết ở việc N21.
- Trạng thái: Đã triển khai

### YCTD-13: Áp dụng câu trả lời lượt 8 – 2026-10-09

- Lý do: Eric trả lời: không cho ứng lương (Q-54), lương trả một lần mỗi tháng (Q-56); quỹ tiền mặt bắt buộc không âm, không tắt được (Q-19); phụ huynh đồng ý hình ảnh trên ứng dụng hoặc giấy ký tay (Q-20); lưu số định danh cá nhân và giấy khai sinh của trẻ, che với vai trò không cần (Q-35, Q-37).
- Nội dung thay đổi: bỏ chức năng P08-05 Ứng lương theo yêu cầu của Eric, giữ mã kèm ghi chú "Bỏ ngày 09/10/2026" ở P08-05, BR-42, AC-42, CT-048, QTP-06, LP-06; bỏ "đề nghị ứng lương" khỏi danh mục chứng từ áp dụng hạn mức; BR-43 và QT-06 không còn trừ tạm ứng, QT-06 lên 1.2 và đánh số lại luồng chính; BR-34 quỹ tiền mặt không âm bắt buộc; BR-65 viết lại; thêm BR-81 về số định danh của trẻ; P02-02, P02-09 cập nhật; QT-01 lên 1.1; thêm BM-64, AC-190 đến AC-193, CT-146 đến CT-149; thêm GD-88, GD-89.
- Thành phần bị ảnh hưởng: `01`, `03`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `14`, `16`, `17`, `20`, `21`, `22`, `QT-01`, `QT-04`, `QT-05`, `QT-06`, `QT-10`, `index.md`.
- Dữ liệu bị ảnh hưởng: gỡ bảng `advance_requests` và cột `payslips.advance_amount`; `children` thêm cột đồng ý hình ảnh, `national_id_encrypted`, `birth_certificate_file_id`; thêm bảng `photo_consent_histories`.
- API bị ảnh hưởng: gỡ `/api/v1/advance-requests` và `/api/v1/advance-requests/{id}/approve`; thêm `/api/v1/children/{id}/national-id`, `/api/v1/children/{id}/photo-consent`.
- Giao diện bị ảnh hưởng: MH-15 chỉ còn bảng lương; MP-18 có thêm đồng ý hoặc rút đồng ý hình ảnh; hồ sơ trẻ hiển thị số định danh đã che.
- Quyền bị ảnh hưởng: chỉ VT-02, VT-15, VT-03, VT-12 xem đầy đủ số định danh của trẻ.
- Ảnh hưởng chức năng cũ: bảng lương không còn khoản tạm ứng. Ảnh sơ đồ chức năng của giáo viên có mục "Ứng lương" nhưng Eric đã quyết định bỏ.
- Kiểm thử cần thực hiện: CT-037, CT-039, CT-049, CT-146 đến CT-149.
- Trạng thái: Đã triển khai

### YCTD-12: Áp dụng câu trả lời lượt 6 và lượt 7 – 2026-10-09

- Lý do: Eric trả lời: nhập dữ liệu cũ từ Excel theo mẫu (Q-02); Zalo để giai đoạn 3 (Q-05); mốc nhắc nợ cấu hình, mặc định 3, 7, 15 ngày (Q-11, Q-45); thanh toán trực tuyến ngay giai đoạn 1 (Q-48, Q-03) bằng chuyển khoản mã QR có xác nhận tự động (Q-81); luôn phải trả đủ (Q-47); quản lý đơn vị không xem bảng lương (Q-23); Eric, Hiệu trưởng và kế toán trưởng cùng nghiệm thu (Q-129, Q-32, Q-101).
- Nội dung thay đổi: thêm P01-13 Nhập dữ liệu ban đầu từ Excel và P06-11 Thanh toán trực tuyến bằng mã QR, cùng G1-15, G1-16; G3-05 thu hẹp thành đối soát sao kê và cổng khác; thêm G3-08 Zalo; BR-31 không nhận thanh toán một phần; bỏ trạng thái "thu một phần" của hóa đơn; sửa AC-32, CT-035; thêm AC-183 đến AC-189, CT-139 đến CT-145, BM-62, BM-63, MH-40, MH-41; QT-04 lên phiên bản 1.2 với bước thanh toán bằng mã QR; thêm người cùng nghiệm thu vào kế hoạch tổng thể.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `08`, `10`, `11`, `13`, `14`, `16`, `17`, `20`, `21`, `22`, `23`, `QT-04`, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `data_import_jobs`, `online_payment_transactions`.
- API bị ảnh hưởng: thêm tám điểm cuối cho nhập dữ liệu và thanh toán trực tuyến; điểm cuối nhận thông báo tiền vào không dùng mã phiên, xác thực bằng chữ ký.
- Giao diện bị ảnh hưởng: thêm MH-40, MH-41; MP-11 hiển thị mã QR cho hóa đơn còn phải nộp.
- Quyền bị ảnh hưởng: VT-03 không xem bảng lương.
- Ảnh hưởng chức năng cũ: phiếu thu không còn thu một phần; P01-08 có mốc nhắc nợ mặc định.
- Kiểm thử cần thực hiện: CT-035, CT-139 đến CT-145.
- Câu hỏi phát sinh: Q-142 (chọn nhà cung cấp tin nhắn và dịch vụ xác nhận chuyển khoản).
- Trạng thái: Đã triển khai

### YCTD-11: Áp dụng câu trả lời lượt 4 và lượt 5 – 2026-10-09

- Lý do: Eric trả lời: Git trên GitHub kèm tích hợp và triển khai tự động từ đợt DT-00 (Q-130); máy chủ đám mây trong nước (Q-74, Q-76); phụ huynh đăng nhập bằng cả mật khẩu và mã một lần (Q-24, Q-117); ứng dụng dạng web ở giai đoạn 1 (Q-04); điểm danh một lần mỗi ngày (Q-38); đi muộn hoặc về sớm vẫn tính đủ ngày ăn (Q-39); chốt công và học phí ngày cuối tháng (Q-25); chặn khi nợ quá hạn cấu hình theo đơn vị (Q-27, Q-46). Q-111 được đánh dấu đã trả lời theo Q-07.
- Nội dung thay đổi: điểm danh đổi từ hai buổi sáng, chiều sang một lần mỗi ngày (BR-12, P04-01, P04-02, QT-02 lên phiên bản 1.1, AC-14, AC-98, CT-015); GD-22 hết hiệu lực; thêm XT-09, BM-61 và hai điểm cuối đăng nhập bằng mã một lần; chốt QĐ-04, thêm QĐ-12, QĐ-13; P01-08 thêm ngày chốt công, mặc định ngày cuối tháng, và cờ chặn đăng ký dịch vụ khi nợ quá hạn; BR-33 bổ sung; thêm AC-180 đến AC-182, CT-136 đến CT-138; GD-40, GD-87 đã xác nhận.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, `13`, `16`, `17`, `21`, `22`, `23`, `QT-02`, `QT-04`, `QT-08`, `index.md`.
- Dữ liệu bị ảnh hưởng: bỏ cột `session` khỏi `attendance_records` và `absence_records`; ràng buộc duy nhất đổi sang trẻ và ngày.
- API bị ảnh hưởng: điểm cuối điểm danh không còn tham số buổi; thêm `/api/v1/auth/otp/request`, `/api/v1/auth/otp/login`.
- Giao diện bị ảnh hưởng: MG-02, MP-06 bỏ chọn buổi; màn hình đăng nhập của ứng dụng phụ huynh có thêm cách đăng nhập bằng mã một lần.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn. Đăng nhập bằng mã một lần cần nhà cung cấp tin nhắn (T1).
- Kiểm thử cần thực hiện: CT-015, CT-136 đến CT-138.
- Trạng thái: Đã triển khai

### YCTD-10: Áp dụng câu trả lời lượt 3 – 2026-10-09

- Lý do: Eric trả lời: sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp (Q-140); học phí chính khóa cấu hình được, mức có thể bằng không (Q-141, câu hỏi mới vì trẻ mầm non trường công lập có thể được miễn học phí từ năm học 2025–2026); mức miễn giảm do nhà trường tự cấu hình (Q-16, Q-10, Q-42); danh mục khấu trừ và số ngày phép năm do nhà trường tự cấu hình (Q-17, Q-18, Q-53, Q-55).
- Nội dung thay đổi: thêm P05-11 Danh mục loại miễn giảm (G1) và P08-11 Danh mục khấu trừ và quy định số ngày phép năm (G1), vì bảng lương và tính học phí ở giai đoạn 1 cần các danh mục này trong khi P08-07 thuộc giai đoạn 2; bổ sung BR-19 về học phí chính khóa bằng không; viết lại BR-41; thêm AC-176 đến AC-179, CT-132 đến CT-135; `M05`, `M08` hết bị chặn.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `10`, `11`, `16`, `17`, `21`, `QT-03`, `QT-06`, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `discount_types`, `leave_policies`; `discounts.discount_type` đổi thành `discounts.discount_type_id`.
- API bị ảnh hưởng: thêm `/api/v1/discount-types`, `/api/v1/leave-policies`.
- Giao diện bị ảnh hưởng: MH-07 có thêm danh mục loại miễn giảm; MH-15 có thêm danh mục khấu trừ và quy định phép năm.
- Quyền bị ảnh hưởng: không đổi ma trận theo phân hệ.
- Ảnh hưởng chức năng cũ: P05-07 chỉ chọn loại miễn giảm trong danh mục; P08-03 cấp phép năm theo quy định cấu hình.
- Kiểm thử cần thực hiện: CT-132 đến CT-135.
- Trạng thái: Đã triển khai

### YCTD-09: Áp dụng câu trả lời lượt 1 và lượt 2 – 2026-10-09

- Lý do: Eric trả lời tám câu hỏi ưu tiên: phương án lưu trữ A (Q-77); bộ công nghệ đề xuất (Q-79); học phí giữa tháng theo ngày học thực tế (Q-14, Q-41); có lập sổ kế toán kép (Q-01, Q-51); chưa có mức hạn mức, cấu hình sau (Q-112, Q-26); nhà trường tự tạo cây đơn vị trong Cấu hình, các đơn vị dùng chung biểu phí (Q-113, Q-122); tiền ăn thu theo ngày ăn thực tế (Q-15, Q-43); đồng ý cách xếp ba giai đoạn (Q-07). Q-22 được đánh dấu đã trả lời theo YCTD-02 và YCTD-04.
- Nội dung thay đổi: chốt QĐ-02 và thêm QĐ-11; viết lại BR-14, BR-17, BR-23; bỏ "giảm trừ do nghỉ có báo" khỏi BR-20; G3-06 được duyệt và bỏ mục 1 của phạm vi ngoài; biểu phí dùng chung toàn trường; sửa AC-22, CT-024, E8 của QT-03; QT-03 lên phiên bản 1.2; cập nhật kế hoạch tổng thể, rủi ro RR-02, RR-03, RR-05, RR-06, RR-07; `M00-2` đến `M00-5` hoàn thành; `M06` hết bị chặn.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, `13`, `16`, `21`, `QT-02`, `QT-03`, `QT-05`, `index.md`.
- Dữ liệu bị ảnh hưởng: `fee_schedules.org_unit_id` luôn là Trường chính. Không thêm bảng.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: màn hình biểu phí (MH-04) không còn chọn đơn vị.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: tính học phí không còn khoản giảm trừ tiền ăn do nghỉ có báo; tiền ăn tính trực tiếp từ số ngày ăn thực tế.
- Kiểm thử cần thực hiện: CT-024, CT-027.
- Câu hỏi phát sinh: Q-140 (chế độ kế toán cho sổ kế toán kép); giả định GD-87 (định nghĩa ngày ăn thực tế).
- Trạng thái: Đã triển khai

### YCTD-08: Áp dụng câu trả lời Q-139 và xác nhận GD-86 – 2026-10-09

- Lý do: Eric trả lời phí ngoại khóa thu theo tháng không giảm trừ khi trẻ nghỉ buổi hoặc thôi tham gia giữa tháng, và xác nhận lịch nghỉ thứ 7 cùng lịch học bù áp dụng cho mọi nhân sự của đơn vị.
- Nội dung thay đổi: P14-11 ghi rõ không giảm trừ phí ngoại khóa theo tháng; GD-86 đánh dấu đã xác nhận; thêm AC-175, CT-131.
- Thành phần bị ảnh hưởng: `10_YEU_CAU_CHUC_NANG.md`, `11_TIEU_CHI_NGHIEM_THU.md`, `21_KICH_BAN_KIEM_THU.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: tính học phí kỳ (P05-05) không áp dụng giảm trừ do nghỉ có báo cho phí ngoại khóa thu theo tháng.
- Kiểm thử cần thực hiện: CT-131.
- Trạng thái: Đã triển khai

### YCTD-07: Bổ sung điểm cuối cho phân hệ Giảng dạy – 2026-10-09

- Lý do: `17_DAC_TA_API.md` không có điểm cuối nào cho phân hệ P03 Giảng dạy, trong khi `10_YEU_CAU_CHUC_NANG.md` có tám chức năng P03-01 đến P03-08. Chức năng P03-07 Lịch hoạt động lớp chưa có bảng dữ liệu. Eric yêu cầu bổ sung.
- Nội dung thay đổi: thêm mục 7 Giảng dạy với mười tám điểm cuối vào `17_DAC_TA_API.md`, đánh số lại các mục sau từ 8 đến 21; thêm bảng `class_activity_schedules` vào `16_CO_SO_DU_LIEU.md`.
- Thành phần bị ảnh hưởng: `17_DAC_TA_API.md`, `16_CO_SO_DU_LIEU.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `class_activity_schedules`.
- API bị ảnh hưởng: thêm mười tám điểm cuối, không đổi điểm cuối đã có.
- Giao diện bị ảnh hưởng: không; MG-05, MG-06, MP-04, MP-05 đã có.
- Quyền bị ảnh hưởng: không đổi; áp dụng ma trận P03 và phạm vi bản ghi của giáo viên và phụ huynh.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn.
- Kiểm thử cần thực hiện: khi xây dựng P03, thêm ca kiểm thử giáo viên không phụ trách lớp gọi điểm cuối giáo án và thời khóa biểu của lớp đó phải bị từ chối.
- Trạng thái: Đã triển khai

### YCTD-06: Áp dụng câu trả lời Q-136 đến Q-138 – 2026-10-09

- Lý do: Eric trả lời ba câu hỏi phát sinh từ YCTD-05: tiêu chuẩn sức khỏe theo Bộ Y tế; hoạt động ngoại khóa thu phí theo cả hai cách, theo từng hoạt động và theo tháng; nghỉ thứ bảy định kỳ, trừ lịch học bù.
- Nội dung thay đổi: P10-11 ghi nguồn tiêu chuẩn là Bộ Y tế. P14-10 và P14-11 cho mỗi hoạt động chọn cách thu phí; phí theo tháng đưa vào khoản phải thu mỗi kỳ khi đăng ký còn hiệu lực. P08-10 đổi từ lịch theo từng nhân sự sang lịch nghỉ thứ bảy định kỳ của đơn vị kèm danh sách ngày học bù là ngày làm việc. Sửa AC-158, CT-114; thêm AC-173, AC-174, CT-129, CT-130.
- Thành phần bị ảnh hưởng: `10_YEU_CAU_CHUC_NANG.md`, `11_TIEU_CHI_NGHIEM_THU.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md`.
- Dữ liệu bị ảnh hưởng: `saturday_schedules` đổi `staff_id` thành `org_unit_id`, `schedule_type` nhận nghỉ định kỳ hoặc học bù; `health_standards` đổi `source` thành `source_document`; `extracurricular_activities` thêm `fee_type`; `extracurricular_registrations` thêm `effective_from`, `effective_to`.
- API bị ảnh hưởng: không đổi đường dẫn; `/api/v1/saturday-schedules` làm việc theo đơn vị thay vì theo nhân sự.
- Giao diện bị ảnh hưởng: MH-36 có thêm lựa chọn cách thu phí; MH-37 nhập lịch theo đơn vị.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: tính học phí kỳ (P05-05) phải đọc thêm đăng ký ngoại khóa thu theo tháng. Chưa có mã nguồn nên không ảnh hưởng dữ liệu thật.
- Kiểm thử cần thực hiện: CT-114, CT-122, CT-129, CT-130.
- Câu hỏi phát sinh: Q-139 (giảm trừ phí ngoại khóa theo tháng); giả định GD-86 (lịch nghỉ thứ 7 áp dụng cho mọi nhân sự của đơn vị).
- Trạng thái: Đã triển khai

### YCTD-05: Bổ sung hai mươi chức năng theo tám ảnh sơ đồ chức năng – 2026-10-09

- Lý do: Eric gửi tám ảnh sơ đồ chức năng (trước đây bộ tài liệu chỉ ghi nhận bốn ảnh). Đối chiếu cho thấy mười hai nhóm mục chưa có trong danh sách chức năng; Eric chọn bổ sung cả mười hai nhóm. Ảnh cũng trả lời Q-06 và Q-29: "mật độ" là "mất đồ", "hình tổ màu" là "hình tô màu", "ăn tối" là dịch vụ bữa tối có đăng ký và thu phí.
- Nội dung thay đổi: thêm P01-11, P01-12, P02-11, P03-08, P06-10, P08-09, P08-10, P10-09 đến P10-11, P12-08, P12-09, P13-10, P14-10 đến P14-12, P16-05, P17-13 đến P17-15; thêm AC-149 đến AC-172, CT-105 đến CT-128; thêm G1-13, G1-14, G2-11 đến G2-16, G3-07 vào phạm vi; lưu tám ảnh vào `26_SO_DO_CHUC_NANG/`. Sửa số liệu ghi nhầm: số chức năng trước bổ sung là 141, không phải 106; số bảng dữ liệu là 134, không phải 92.
- Thành phần bị ảnh hưởng: `05_PHAM_VI.md`, `10_YEU_CAU_CHUC_NANG.md`, `11_TIEU_CHI_NGHIEM_THU.md`, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md`, `04_TONG_QUAN_DU_AN.md`, `06_YEU_CAU_NGHIEP_VU.md`, `01_KE_HOACH_TONG_THE.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm mười chín bảng `rooms`, `grade_levels`, `lost_items`, `lesson_domains`, `lesson_groups`, `cashflow_categories`, `holidays`, `saturday_schedules`, `medicine_purchase_orders`, `medicine_purchase_order_items`, `health_check_schedules`, `health_standards`, `market_purchases`, `market_purchase_items`, `extracurricular_activities`, `extracurricular_registrations`, `library_albums`, `content_comments`, `admission_posts`; thêm cột `classes.room_id`, `lessons.domain_id`, `lessons.lesson_group_id`, `receipts.category_id`, `payments.category_id`, `suppliers.supplier_type`.
- API bị ảnh hưởng: thêm hai mươi hai điểm cuối, xem `17_DAC_TA_API.md`.
- Giao diện bị ảnh hưởng: thêm MH-34 đến MH-39, MG-15, MP-19, MP-20.
- Quyền bị ảnh hưởng: không đổi ma trận theo phân hệ; quyền của từng chức năng theo cột "Người dùng" trong `10_YEU_CAU_CHUC_NANG.md`.
- Ảnh hưởng chức năng cũ: phiếu thu và phiếu chi bắt buộc chọn khoản mục (P06-10); lớp và biểu phí chọn bậc học từ danh mục (P01-12). Chưa có mã nguồn nên không ảnh hưởng dữ liệu thật.
- Kiểm thử cần thực hiện: CT-105 đến CT-128.
- Câu hỏi phát sinh: Q-136 (nguồn bảng tiêu chuẩn sức khỏe), Q-137 (cách thu phí hoạt động ngoại khóa), Q-138 (nghĩa của lịch nghỉ thứ 7).
- Trạng thái: Đã triển khai

### YCTD-04: Mở rộng phạm vi phê duyệt chỉ của Ban Giám hiệu – 2026-10-09

- Lý do: YCTD-02 để lại ba câu hỏi Q-133, Q-134, Q-135. Eric trả lời: chốt kỳ tài chính vẫn thuộc danh mục hạn mức và do Hiệu trưởng phê duyệt; quản lý đơn vị không phê duyệt chứng từ thuộc danh mục hạn mức; Ban Giám hiệu phê duyệt mở lại kỳ công.
- Nội dung thay đổi: kế toán trưởng chuyển từ "chốt kỳ" sang "đề nghị chốt kỳ"; Hiệu trưởng phê duyệt chốt kỳ. Quản lý đơn vị chỉ phê duyệt việc không có giá trị tiền như hồ sơ trẻ, đơn nghỉ phép, hoạt động của lớp, đổi tuyến xe. Mở lại kỳ công do Phó Hiệu trưởng hoặc Hiệu trưởng phê duyệt.
- Thành phần bị ảnh hưởng: `07_QUY_TAC_NGHIEP_VU.md` mục 12.1; `08_VAI_TRO_NGUOI_DUNG.md` VT-05, ghi chú 7 và 8, bảng phân cấp phê duyệt mục 5; `10_YEU_CAU_CHUC_NANG.md` P06-09; `QT-03`, `QT-05`, `QT-06`.
- Dữ liệu bị ảnh hưởng: bảng `fiscal_periods` thêm `close_requested_by`, `close_requested_at` trong `16_CO_SO_DU_LIEU.md`.
- API bị ảnh hưởng: thêm `POST /api/v1/fiscal-periods/{id}/request-close`; `POST /api/v1/fiscal-periods/{id}/close` chỉ dành cho Hiệu trưởng.
- Giao diện bị ảnh hưởng: màn hình chốt kỳ tài chính trong QT-05 có thêm bước đề nghị và bước phê duyệt.
- Quyền bị ảnh hưởng: VT-03 mất quyền phê duyệt miễn giảm, ứng lương, đề nghị mua hàng; VT-05 mất quyền tự chốt kỳ và mở lại kỳ công.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn.
- Kiểm thử cần thực hiện: `CT-041` phải kiểm tra kế toán trưởng không tự chốt được kỳ; thêm ca kiểm thử quản lý đơn vị gọi điểm cuối phê duyệt miễn giảm, ứng lương, đề nghị mua hàng phải bị từ chối khi xây dựng `P05-07`, `P08-05`, `P13-05`.
- Trạng thái: Đã triển khai

### YCTD-03: Đổi mã dự án từ SKG thành SM – 2026-10-09

- Lý do: SKG là chữ viết tắt của tên cũ Sun KinderGarten, không còn khớp tên School Management. Eric chốt đổi thành SM, trả lời `Q-132`.
- Nội dung thay đổi: dòng "Mã dự án" trong `04_TONG_QUAN_DU_AN.md` ghi SM; quy tắc sinh mã trẻ `GD-20` đổi thành dạng `SM-<mã đơn vị>-<số thứ tự>`.
- Thành phần bị ảnh hưởng: `04_TONG_QUAN_DU_AN.md`, `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md`.
- Dữ liệu bị ảnh hưởng: định dạng cột `children.code` khi sinh mã trẻ. Chưa có dữ liệu thật nên không phải chuyển đổi.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn.
- Kiểm thử cần thực hiện: khi xây dựng `P02-02`, ca `CT-009` phải kiểm tra mã trẻ có tiền tố SM.
- Trạng thái: Đã triển khai

### YCTD-02: Chỉ Ban Giám hiệu phê duyệt chứng từ theo hạn mức – 2026-10-09

- Lý do: tài liệu mâu thuẫn. `QT-05`, `AC-35`, `CT-038` ghi phiếu chi vượt hạn mức do kế toán trưởng duyệt; `BR-77` và mục 5 của `08_VAI_TRO_NGUOI_DUNG.md` ghi Phó Hiệu trưởng duyệt dưới hạn mức, Hiệu trưởng duyệt từ hạn mức trở lên. Eric chốt: chỉ Ban Giám hiệu duyệt, kế toán trưởng không nằm trong luồng phê duyệt và chỉ chốt kỳ tài chính.
- Nội dung thay đổi: bỏ kế toán trưởng khỏi luồng phê duyệt giảm trừ, phiếu đảo, phiếu chi và bảng lương; bỏ kế toán khỏi luồng phê duyệt ứng lương. Mọi phiếu chi đều phải trình duyệt, không còn trường hợp kế toán tự phát hành khi trong hạn mức. Hạn mức cấu hình theo đơn vị và loại chứng từ, không theo vai trò.
- Thành phần bị ảnh hưởng: `07_QUY_TAC_NGHIEP_VU.md` mục 12.1; `08_VAI_TRO_NGUOI_DUNG.md` mô tả VT-05, ma trận quyền, ghi chú 8; `11_TIEU_CHI_NGHIEM_THU.md` AC-35; `21_KICH_BAN_KIEM_THU.md` CT-038; `QT-03`, `QT-04`, `QT-05`, `QT-06` lên phiên bản 1.1.
- Dữ liệu bị ảnh hưởng: không đổi bảng. Cột `approved_by` của `payments`, `discounts`, `invoice_adjustments`, `payroll_periods` chỉ nhận tài khoản có vai trò VT-15 hoặc VT-02.
- API bị ảnh hưởng: không đổi đường dẫn. `/api/v1/payments/{id}/approve`, `/api/v1/payrolls/{period_id}/approve` và các điểm cuối phê duyệt khác phải từ chối vai trò VT-05.
- Giao diện bị ảnh hưởng: `MH-10` không hiển thị nút phê duyệt cho kế toán trưởng.
- Quyền bị ảnh hưởng: VT-05 mất quyền D ở P05, P06, P08, P13; nhận quyền như VT-04 và thêm quyền chốt kỳ tài chính.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn.
- Kiểm thử cần thực hiện: `CT-038`, `CT-097` đến `CT-100`; thêm ca kiểm thử kế toán trưởng gọi điểm cuối phê duyệt phiếu chi phải bị từ chối khi xây dựng `P06-04`.
- Câu hỏi phát sinh: `Q-133`, `Q-134`, `Q-135`, đã được trả lời và triển khai ở YCTD-04.
- Trạng thái: Đã triển khai

### YCTD-01: Chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow – 2026-10-09

- Lý do: Eric yêu cầu áp dụng quy trình Vibecoding_Flow. Quy trình quy định thư mục `tai_lieu/`, tên tệp in hoa không dấu, thứ tự đánh số và mẫu phần đầu tài liệu khác với bộ tài liệu cũ.
- Nội dung thay đổi: chuyển `tai-lieu-thiet-ke/` thành `tai_lieu/`; đổi tên và đánh số lại toàn bộ tài liệu theo bảng dưới; thêm `24_YEU_CAU_THAY_DOI.md`; đặt các đặc tả quy trình vào `25_QUY_TRINH_NGHIEP_VU/` và gộp mục lục con vào `index.md`; đổi phần đầu mỗi tài liệu sang mẫu "Số. Tên, Mô tả, Phiên bản, Ngày cập nhật, Trạng thái"; đổi trạng thái tài liệu sang Bản nháp, Chờ phê duyệt, Đã phê duyệt; đổi trạng thái công việc sang Chưa bắt đầu, Đang thực hiện, Cần sửa, Bị chặn, Hoàn thành; nhật ký dự án xếp ngày mới nhất ở trên cùng.
- Thành phần bị ảnh hưởng: toàn bộ bộ tài liệu. Mọi tham chiếu tên tệp đã được cập nhật, trừ các mục lịch sử trong `02_NHAT_KY_DU_AN.md` và `23_LICH_SU_PHIEN_BAN.md`, nơi tên cũ được giữ nguyên vì là ghi chép lịch sử.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn. Ghi chú của công cụ khác trong `.workbuddy-ai/` vẫn trỏ đường dẫn cũ.
- Kiểm thử cần thực hiện: rà văn bản không còn tham chiếu tên tệp cũ ngoài mục lịch sử; bảng không thiếu dấu `|` kết thúc; khối mã cân bằng.
- Trạng thái: Đã triển khai

Bảng đối chiếu tên tệp cũ và mới:

| Tên cũ trong `tai-lieu-thiet-ke/` | Tên mới trong `tai_lieu/` |
|---|---|
| index.md | index.md |
| 21_Ke_hoach_tong_the_du_an.md | 01_KE_HOACH_TONG_THE.md |
| Nhat_ky_du_an.md | 02_NHAT_KY_DU_AN.md |
| Checklist_cong_viec.md | 03_DANH_SACH_CONG_VIEC.md |
| 01_Tong_quan_du_an.md | 04_TONG_QUAN_DU_AN.md |
| 02_Pham_vi.md | 05_PHAM_VI.md |
| 03_Yeu_cau_nghiep_vu.md | 06_YEU_CAU_NGHIEP_VU.md |
| 04_Quy_tac_nghiep_vu.md | 07_QUY_TAC_NGHIEP_VU.md |
| 05_Vai_tro_nguoi_dung.md | 08_VAI_TRO_NGUOI_DUNG.md |
| 06_Luong_nghiep_vu.md | 09_LUONG_NGHIEP_VU.md |
| 07_Yeu_cau_chuc_nang.md | 10_YEU_CAU_CHUC_NANG.md |
| 08_Tieu_chi_nghiem_thu.md | 11_TIEU_CHI_NGHIEM_THU.md |
| 09_Kien_truc_he_thong.md | 12_KIEN_TRUC_HE_THONG.md |
| 10_Cong_nghe_su_dung.md | 13_CONG_NGHE_SU_DUNG.md |
| 11_Dac_ta_giao_dien.md | 14_DAC_TA_GIAO_DIEN.md |
| 12_He_thong_thiet_ke.md | 15_HE_THONG_THIET_KE.md |
| 13_Luoc_do_co_so_du_lieu.md | 16_CO_SO_DU_LIEU.md |
| 14_Dac_ta_API.md | 17_DAC_TA_API.md |
| 15_Quy_tac_phat_trien_AI.md | 18_QUY_TAC_PHAT_TRIEN_AI.md |
| 16_Cau_lenh_he_thong_AI.md | 19_CHI_DAN_HE_THONG_AI.md |
| 17_Ke_hoach_kiem_thu.md | 20_KE_HOACH_KIEM_THU.md |
| 18_Ca_kiem_thu.md | 21_KICH_BAN_KIEM_THU.md |
| 19_Bao_mat.md | 22_BAO_MAT.md |
| 20_Lich_su_thay_doi.md | 23_LICH_SU_PHIEN_BAN.md |
| Không có | 24_YEU_CAU_THAY_DOI.md |
| Quy_trinh_nghiep_vu/index.md | Gộp vào index.md |
| Quy_trinh_nghiep_vu/Phieu_yeu_cau.md | 25_QUY_TRINH_NGHIEP_VU/PHIEU_YEU_CAU.md |
| Quy_trinh_nghiep_vu/QT-nn_Ten_quy_trinh.md | 25_QUY_TRINH_NGHIEP_VU/QT-nn_TEN_QUY_TRINH.md |
