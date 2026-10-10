# 02. NHẬT KÝ DỰ ÁN

- Mô tả: Ghi nhận công việc, quyết định, thay đổi và vấn đề tồn đọng theo ngày, ngày mới nhất ở trên cùng.
- Phiên bản: 0.4
- Ngày cập nhật: 2026-10-10
- Trạng thái: Đang cập nhật

## Quy ước ghi nhật ký

- Mục mới ghi ở trên cùng; không sửa nội dung mục cũ.
- Từ ngày 2026-10-09, mỗi mục ghi theo mẫu của Vibecoding_Flow: công việc đã thực hiện, quyết định, thay đổi, vấn đề tồn đọng. Các mục cũ giữ nguyên dạng và tên tệp cũ.
- Mỗi mục ghi rõ ngày, người thực hiện, nội dung, tệp bị ảnh hưởng, kết quả kiểm thử.
- Không ghi thông tin tạm thời như kết quả tra cứu, đường dẫn tạm, thông báo lỗi của công cụ.

## Nhật ký theo ngày

### 2026-10-10 — DT-03 phần 3c: nhập dữ liệu

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 12 (phần 3b) vào nhánh chính. Eric yêu cầu làm song song: viết phần sau trong lúc phần trước chạy kiểm thử trên GitHub.
- Hỏi Eric ba điểm của phần 3c; viết trên nhánh `dt-03-phan-3c`.
- Cơ sở dữ liệu: năm học có `data_import_jobs`, giấy khai sinh cho phép trống với trẻ nhập (tệp 0007); định danh có quyền `P01.import.children` (tệp 0012).
- Máy chủ API: mẫu Excel, kiểm tra và ghi tệp lớp, tệp trẻ kèm phụ huynh, nhập mã ngành, bộ lọc thiếu giấy khai sinh; tệp vượt dung lượng trả `ERR_VALIDATION`.
- Cổng quản trị: màn hình Nhập dữ liệu (MH-40); Hồ sơ trẻ có bộ lọc và bổ sung giấy khai sinh.
- Kết quả: máy chủ API 116/116, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 22/22.

#### Quyết định

- Trẻ nhập vào thẳng đang học, bổ sung giấy khai sinh sau; mẫu mã ngành của hệ thống; nhập lớp và trẻ kèm phụ huynh (YCTD-46) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-46 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.1.

#### Vấn đề tồn đọng

- CTC-P01-079, 082 (nhập công nợ, nhân sự) làm ở P05, P07; chuyển trẻ sang năm mới (GD-90) làm cùng lên lớp.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-03 phần 3b: hồ sơ trẻ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 11 (phần 3a) vào nhánh chính.
- Hỏi Eric năm điểm của phần 3b; Eric duyệt thiết kế; viết trên nhánh `dt-03-phan-3b`.
- Hạ tầng: SeaweedFS trong docker compose và GitHub Actions; khóa mã hóa số định danh; lệnh `generate-data-keys`.
- Cơ sở dữ liệu: năm học có mười bảng của hồ sơ trẻ (tệp 0006); định danh có quyền `P02.child.manage`, `P02.national-id.view` (tệp 0011).
- Dịch vụ định danh: tạo tài khoản phụ huynh khi duyệt hồ sơ, thêm vai trò VT-14 cho tài khoản nhân sự trùng số điện thoại.
- Máy chủ API: hồ sơ trẻ, phụ huynh, sức khỏe, đồng ý hình ảnh, trình duyệt, duyệt và phân lớp, từ chối, chuyển lớp, xem đầy đủ số định danh, tệp đính kèm, hàng đợi thông báo.
- Cổng quản trị: màn hình Hồ sơ trẻ (MH-02); màn hình Lớp học hiện sĩ số đang học.
- Kết quả: máy chủ API 107/107, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 21/21.

#### Quyết định

- Đồng ý hình ảnh ba trạng thái; phạm vi xem trẻ theo lớp với giáo viên; kho tệp SeaweedFS thay MinIO; chuyển trẻ sang năm mới để lại đợt sau (YCTD-45) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-45 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.0.

#### Vấn đề tồn đọng

- CTC-P02-013 (gán mã ngành trùng qua nhập tệp) làm ở phần 3c; CTC-P02-033 cần nhà cung cấp tin nhắn.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-03 phần 3a: lớp học

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 10 (DT-02) vào nhánh chính.
- Hỏi Eric năm điểm của DT-03; Eric duyệt thiết kế phần 3a; viết trên nhánh `dt-03-phan-3a`.
- Cơ sở dữ liệu: năm học có `classes`, `class_staff_assignments` (tệp 0005); định danh có quyền `P02.class.manage` (tệp 0010).
- Dịch vụ định danh: danh bạ nhân sự theo vai trò và đơn vị.
- Máy chủ API: lớp học, phân công giáo viên, kiểm tra bậc học, phòng học, vai trò người được phân công.
- Cổng quản trị: nhóm điều hướng Trẻ và lớp, màn hình Lớp học (MH-03).
- Kết quả: máy chủ API 87/87, dịch vụ định danh 35/35, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 19/19.

#### Quyết định

- DT-03 chia ba phần; giáo viên chọn theo tài khoản; một lớp nhiều giáo viên chủ nhiệm; số điện thoại phụ huynh trùng tài khoản nhân sự thì thêm vai trò VT-14; thông báo ghi hàng đợi (YCTD-44) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-44 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.9.

#### Vấn đề tồn đọng

- Phần điểm danh của CTC-P02-042 chạy khi có P04.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-02: đăng nhập của phụ huynh

#### Công việc đã thực hiện

- Gộp các yêu cầu gộp số 4 đến 9 vào nhánh chính, hoàn tất DT-01.
- Hỏi Eric bốn điểm của DT-02; Eric duyệt thiết kế; viết trên nhánh `dt-02`.
- Cơ sở dữ liệu định danh: tệp 0009 cho mật khẩu mặc định, `sessions.login_method`, bảng `one_time_codes`.
- Dịch vụ định danh: đăng nhập bằng mật khẩu mặc định, mã một lần, lớp gửi tin nhắn, cấu hình chung mới, tạo tài khoản phụ huynh dùng mật khẩu mặc định, cookie mã làm mới riêng theo kênh.
- Cổng quản trị: màn hình Cấu hình phần Tài khoản có mật khẩu mặc định và thông số mã một lần; màn hình Tài khoản báo tài khoản phụ huynh dùng mật khẩu mặc định.
- Ứng dụng phụ huynh: đăng nhập bằng mật khẩu hoặc mã, đặt mật khẩu mới khi kích hoạt, trang chủ tạm.
- Kiểm thử giao diện phát hiện cổng quản trị và ứng dụng phụ huynh dùng chung cookie mã làm mới; đã sửa bằng cookie riêng theo kênh.
- Kết quả: dịch vụ định danh 35/35, máy chủ API 80/80, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 17/17.

#### Quyết định

- Mật khẩu mặc định toàn trường; thông số mã một lần có mặc định, Hiệu trưởng sửa được; lớp gửi tin nhắn nối sau; làm màn hình ứng dụng phụ huynh; bỏ `POST /auth/activate` (YCTD-43) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-43 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.8.

#### Vấn đề tồn đọng

- P19-06 chỉ nghiệm thu xong khi có tài khoản nhà cung cấp tin nhắn (T1).
- CTC-DD-011, 042 còn phần cần P02; CTC-DD-013, 015, 024 chưa chạy.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-01 phần 6b: các danh mục

#### Công việc đã thực hiện

- Hỏi Eric bốn điểm tài liệu chưa rõ trước khi thiết kế; Eric duyệt thiết kế; viết trên nhánh `dt-01-phan-6b`.
- Cơ sở dữ liệu: năm học có `departments`, `job_titles`, `catalog_items`, `approval_thresholds`, `rooms`, `grade_levels` (tệp 0004); định danh có bốn mã quyền mới (tệp 0008).
- Máy chủ API: điểm cuối của sáu danh mục, kiểm tra phạm vi đơn vị, ghi nhật ký thao tác, chuyển danh mục khi mở năm học mới.
- Cổng quản trị: MH-49 Phòng ban và chức danh, MH-50 Danh mục dùng chung, MH-33 Hạn mức phê duyệt, MH-34 Phòng học và bậc học; bộ lọc nhật ký thao tác thêm các danh mục.
- Kết quả: máy chủ API 80/80 (gồm 16 ca của danh mục), dịch vụ định danh 21/21, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 15/15.

#### Quyết định

- Danh mục dùng chung có bốn loại do hệ thống định nghĩa; VT-06 quản lý phòng ban và chức danh trong đơn vị; hạn mức có hiệu lực ngay; độ tuổi bậc học theo tháng (YCTD-42) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-42 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.7.

#### Vấn đề tồn đọng

- CTC-P01-023, 027, 060 đến 066, 068, 070, 071, 074 và phần chọn bậc học của 073 cần hồ sơ nhân sự, lớp học, chứng từ ở các đợt sau.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Ngày chốt học phí và chốt công

#### Công việc đã thực hiện

- Eric cho biết ngày chốt học phí là mùng 1 tháng sau; hỏi lại hai điểm và sửa tài liệu, mã nguồn phần 6a.

#### Quyết định

- Chốt học phí mặc định mùng 1 tháng sau, vẫn cấu hình được; chốt công cố định mùng 1 tháng sau (YCTD-41) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-41 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.6.

#### Vấn đề tồn đọng

- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — DT-01 phần 6a: cấu hình và nhật ký thao tác

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 6a. Viết trên nhánh `dt-01-phan-6a`.
- Cơ sở dữ liệu: năm học có `settings` và cột `audit_logs.actor_name`; định danh có `identity_settings`, cột `identity_audit_logs.actor_name`, quyền `P01.setting.manage` cho VT-02, VT-03.
- Máy chủ API: danh mục mười mục cấu hình, kế thừa đơn vị, Trường chính, mặc định; ghi nhật ký; chuyển cấu hình khi mở năm học; tra nhật ký thao tác theo phạm vi đơn vị.
- Dịch vụ định danh: số ngày tự khóa đọc, sửa trên cổng; khóa tài khoản lâu không đăng nhập ở lần đăng nhập kế tiếp; tra nhật ký tài khoản và quyền.
- Cổng quản trị: màn hình Cấu hình và MH-31 Nhật ký thao tác, nhật ký chỉ hiện các trường thay đổi.
- Kết quả: máy chủ API 64/64 (gồm CTC-P01-044 đến 048, 051, 053, 054), dịch vụ định danh 21/21 (gồm CTC-DD-006), cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 12/12.

#### Quyết định

- Không có quyết định mới ngoài YCTD-40.

#### Thay đổi

- `17` ghi giao kèo cấu hình và nhật ký; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.5.

#### Vấn đề tồn đọng

- CTC-P01-049, 050, 052, 055 đến 058 cần dữ liệu tài chính, lớp, hóa đơn và nhật ký truy cập ở các đợt sau.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 6a: cấu hình và nhật ký

#### Công việc đã thực hiện

- Trình thiết kế phần 6a và bốn câu hỏi về cấu hình.

#### Quyết định

- Cấu hình chưa có mặc định trong tài liệu để trống, bắt buộc cấu hình; kế thừa từ Trường chính; VT-02, VT-03 sửa cấu hình; số ngày tự khóa mặc định 90, Hiệu trưởng sửa trên cổng (YCTD-40) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-40 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.4.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 6a.

### 2026-10-09 — DT-01 phần 5: tài khoản, vai trò, quyền

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 5. Viết trên nhánh `dt-01-phan-5`.
- Cơ sở dữ liệu định danh: `0006_add_account_management` tạo `identity_audit_logs` và thêm `P01.account.manage-in-unit` cho VT-03.
- Dịch vụ định danh: tạo, sửa, khóa, mở khóa tài khoản, đặt lại mật khẩu bằng mật khẩu tạm, gán và gỡ vai trò, tạo vai trò, sửa ma trận quyền, danh sách quyền; kiểm tra phạm vi theo PQ-13 bằng cây đơn vị đọc qua máy chủ API; thu hồi phiên khi khóa, đặt lại mật khẩu, đổi vai trò; giới hạn đăng nhập đọc được từ biến môi trường `LOGIN_REQUESTS_PER_MINUTE`, mặc định 10.
- Cổng quản trị: MH-30 gồm màn hình Tài khoản và Vai trò và quyền; mục điều hướng chỉ hiện với người có quyền quản lý tài khoản; máy chủ phát triển chuyển `users`, `roles`, `permissions` sang dịch vụ định danh.
- Kết quả: máy chủ API 54/54 (gồm CTC-P01-030 đến 035, 037 đến 039, 041, 042, CTC-DD-035, 039, 040), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 10/10.

#### Quyết định

- Không có quyết định mới ngoài YCTD-39.

#### Thay đổi

- `17` ghi giao kèo nhóm tài khoản, vai trò, quyền, điểm cuối gỡ vai trò và quy tắc chuyển tiếp của cổng vào; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.3.

#### Vấn đề tồn đọng

- CTC-P01-036 (khóa khi chấm dứt hợp đồng) làm ở DT-06; CTC-P01-040, 043 cần điểm cuối nghiệp vụ của kế toán và hồ sơ trẻ.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 5: tài khoản, vai trò, quyền

#### Công việc đã thực hiện

- Trình thiết kế phần 5 và bốn câu hỏi về phân quyền quản lý tài khoản.

#### Quyết định

- VT-01, VT-02 quản lý mọi tài khoản và sửa ma trận quyền; VT-03 tạo tài khoản với mọi vai trò trừ VT-01, VT-02 trong đơn vị được gán; hệ thống sinh mật khẩu tạm khi đặt lại (YCTD-39) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-39 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.2.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 5.

### 2026-10-09 — DT-01 phần 4: cây đơn vị hai cấp

#### Công việc đã thực hiện

- Eric duyệt YCTD-38 và thiết kế phần 4. Viết trên nhánh `dt-01-phan-4`.
- Cơ sở dữ liệu năm học: `0002_create_org_units_and_audit_logs` tạo `org_units` có ràng buộc một Trường chính, đơn vị cấp 2 chỉ trực thuộc Trường chính ở tầng dữ liệu, và `audit_logs`. Cơ sở dữ liệu định danh: `0005_add_org_unit_permission` thêm `P01.org-unit.manage` cho VT-02.
- Máy chủ API: tạo, sửa, ngừng sử dụng đơn vị; cây và danh sách phẳng lọc theo loại; ghi nhật ký thao tác; bước chuyển cây đơn vị khi mở năm học, giữ nguyên mã định danh; lớp đơn vị của phân quyền: gán ở Trường chính là toàn trường, gán ở đơn vị cấp 2 chỉ có đơn vị đó.
- Cổng quản trị: MH-32 Cây đơn vị, dạng cây và danh sách phẳng.
- Kết quả: máy chủ API 41/41 (gồm CTC-P01-001 đến 005, 007, 008, 012 và lớp đơn vị theo CTC-P01-009 đến 011 với điểm cuối kiểm thử), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 7/7.

#### Quyết định

- Không có quyết định mới ngoài YCTD-38.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối cây đơn vị; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.1.

#### Vấn đề tồn đọng

- CTC-P01-009 đến 011 kiểm lại với danh sách lớp và trẻ ở DT-03.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 4: cây đơn vị

#### Công việc đã thực hiện

- Trình thiết kế phần 4; Eric cho biết trường chỉ có hai cấp; đánh giá ảnh hưởng và trình YCTD-38.

#### Quyết định

- Cây đơn vị hai cấp, cấp 2 chọn loại Phân hiệu hoặc Điểm trường, Trường chính có lớp, nhãn cố định; chặn ngừng sử dụng đơn vị còn đơn vị con đang hoạt động (YCTD-38) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-38 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.0.

#### Vấn đề tồn đọng

- Viết mã phần 4.

### 2026-10-09 — DT-01 phần 3: năm học

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 3. Viết trên nhánh `dt-01-phan-3`.
- Cơ sở dữ liệu hệ thống: `0002_create_academic_year_tables` tạo `academic_years`, `academic_terms`, `school_weeks`, `academic_year_databases`, có chỉ mục bảo đảm chỉ một năm đang dùng. Cơ sở dữ liệu định danh: `0004_add_academic_year_permission` thêm `P01.academic-year.manage` cho VT-02.
- Tài khoản `api_service` có quyền tạo cơ sở dữ liệu; bỏ cơ sở dữ liệu năm học tạo tay trong Docker và biến `SCHOOL_YEAR_DATABASE_URL`; công cụ thay đổi cấu trúc chạy trên năm học đang dùng (QU-11).
- Máy chủ API: tạo năm học, lưu lịch, đánh số tuần, đánh dấu tuần nghỉ, mở năm học gồm kiểm tra, tạo cơ sở dữ liệu, chạy tệp thay đổi cấu trúc, chuyển dữ liệu, đóng năm cũ và chuyển sang chỉ đọc; khung bước chuyển năm học để các phân hệ sau tự thêm bước.
- Cổng quản trị: màn hình Năm học gồm MH-45 và MH-43; thêm `StatusBadge`, `ConfirmDialog`, `Toast` vào `packages/ui`.
- Kiểm thử giao diện chạy trên cơ sở dữ liệu hệ thống riêng `school_system_e2e` và cổng riêng, chuẩn bị lại trước mỗi lần chạy.
- Kết quả: máy chủ API 26/26 (gồm CTC-P01-013, 018, 099 đến 104 và khung kiểm tra, chuyển dữ liệu của CTC-P01-096, 097), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 5/5.

#### Quyết định

- Không có quyết định mới ngoài YCTD-37.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối năm học và trường `rule_code`; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.6.

#### Vấn đề tồn đọng

- CTC-P01-014 đến 017, 096 đến 098 cần dữ liệu trẻ và công nợ, chạy ở DT-03 và DT-05; CTC-P01-019 chạy khi có tệp thay đổi cấu trúc năm học thứ hai.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 3: năm học

#### Công việc đã thực hiện

- Đọc tài liệu cho phần 3, phát hiện mâu thuẫn giữa AC-194, CB-10 và BR-89, CTC-P01-096 đến 098 về việc năm cũ còn ghi được sau khi mở năm mới; trình Eric thiết kế phần 3.

#### Quyết định

- Mở năm học mới là đóng năm cũ trong một thao tác; lịch năm học sửa được cho tới khi đóng (YCTD-37) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-37 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.5.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 3.

### 2026-10-09 — DT-01 phần 2: kiểm tra mã phiên, quyền và màn hình đăng nhập

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 2. Viết trên nhánh `dt-01-phan-2`.
- Thêm gói `packages/server`: mô hình lỗi, bộ lọc lỗi, đồng hồ, kiểm tra mã phiên bằng khóa công khai; dịch vụ định danh chuyển sang dùng gói này.
- Dịch vụ định danh trả mã làm mới bằng cookie httpOnly, SameSite=Strict, Secure, đường dẫn `/api/v1/auth`; đăng xuất xóa cookie (BM-71).
- Máy chủ API: kiểm tra mã phiên ở mọi điểm cuối trừ kiểm tra sức khỏe; hỏi `GET /api/v1/auth/me` ở mỗi yêu cầu (QĐ-20); khai báo quyền cần có cho từng điểm cuối; trả phạm vi đơn vị của từng quyền; từ chối mã phiên còn bắt buộc đổi mật khẩu.
- Cổng quản trị: MH-47 Đăng nhập, MH-48 Đổi mật khẩu, khung trang điều hướng dọc bên trái, tự làm mới mã phiên, đăng xuất; thêm thành phần `Button`, `TextField`, `Alert` và mã màu theo `15` vào `packages/ui`.
- Thêm gói `tests` chạy Playwright; GitHub Actions sinh khóa tạm, cài Chromium và chạy kiểm thử giao diện.
- Kết quả: dịch vụ định danh 20/20, máy chủ API 9/9 (gồm CTC-DD-035, 036, 037, 041), cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 3/3; kiểm tra kiểu, quy tắc viết mã, định dạng đạt.

#### Quyết định

- Cookie mã làm mới áp dụng cho cả ba kênh trình duyệt – người quyết định: Eric.

#### Thay đổi

- Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.4.

#### Vấn đề tồn đọng

- CTC-DD-035 mới kiểm được phần từ chối ngay khi mất vai trò; phần thu hồi mã làm mới khi đổi quyền làm cùng điểm cuối gán vai trò ở phần 5. CTC-DD-041 kiểm lại khi có điểm cuối nghiệp vụ thật.
- Lớp đơn vị mới trả đơn vị được gán; mở rộng sang đơn vị con làm ở phần 4 khi có cây đơn vị.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 2

#### Công việc đã thực hiện

- Trình thiết kế phần 2: máy chủ API kiểm tra mã phiên và quyền, màn hình đăng nhập và đổi mật khẩu trên cổng quản trị.

#### Quyết định

- Mã làm mới lưu trong cookie httpOnly; thêm gói `packages/server`; điều hướng dọc bên trái; làm kiểm thử Playwright ngay (YCTD-36) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-36 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.3.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 2.

### 2026-10-09 — DT-01 phần 1: phần lõi dịch vụ định danh

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 1. Viết trên nhánh `dt-01-phan-1`.
- Cơ sở dữ liệu định danh: tệp thay đổi cấu trúc `0002_create_account_tables` tạo `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `security_events`; `0003_seed_roles_and_permissions` tạo 19 vai trò và 55 mã quyền theo ma trận ở `08` mục 3.
- Dịch vụ định danh: `login`, `refresh`, `logout`, `change-password`, `me`; băm mật khẩu argon2id; mã phiên ký Ed25519; mã làm mới đổi mới sau mỗi lần làm mới; tạm khóa 15 phút sau 5 lần sai; giới hạn 10 yêu cầu đăng nhập mỗi phút trên một địa chỉ mạng; mô hình lỗi kèm mã tương quan.
- Lệnh `create-platform-administrator` tạo tài khoản VT-01 đầu tiên; lệnh `generate-token-keys` sinh cặp khóa ký mã phiên.
- Kết quả: 19/19 kiểm thử của dịch vụ định danh đạt, gồm CTC-DD-001 đến 004, 007, 008, 009, 031 đến 034, 043; toàn bộ 24 kiểm thử của dự án đạt; kiểm tra kiểu, quy tắc viết mã, định dạng đạt.

#### Quyết định

- Không có quyết định mới ngoài YCTD-35.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối xác thực; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.2.

#### Vấn đề tồn đọng

- Kiểm thử để lại tài khoản kiểm thử trong cơ sở dữ liệu định danh của môi trường phát triển.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Kế hoạch đợt DT-01

#### Công việc đã thực hiện

- Đọc tài liệu cho đợt DT-01, phát hiện DT-01 phụ thuộc phần lõi dịch vụ định danh ở DT-02; trình Eric cách chia sáu phần.

#### Quyết định

- Gộp phần lõi dịch vụ định danh vào DT-01, làm theo sáu phần (YCTD-34) – người quyết định: Eric.
- QĐ-20, QĐ-21, QĐ-22 – người quyết định: Eric.
- Mật khẩu tối thiểu 8 ký tự có chữ và số; sai 5 lần tạm khóa 15 phút rồi tự mở; mã quyền theo phân hệ và hành động; tài khoản đầu tiên là VT-01 (YCTD-35) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-34, YCTD-35 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.0 đến 0.26.1.

#### Vấn đề tồn đọng

- Việc tiếp theo: trình thiết kế chi tiết DT-01 phần 1.

### 2026-10-09 — Qua cổng CG-08

#### Công việc đã thực hiện

- Eric đồng ý commit; đẩy nhánh `main` và `dt-00-nen-mong` lên GitHub sau khi Eric cấp quyền ghi.
- GitHub Actions chạy kiểm thử trên yêu cầu gộp số 1: đạt.
- Cài đặt sẵn công cụ `gh`; Eric đăng nhập bằng tài khoản `luckyshopvn`.
- Eric gộp yêu cầu gộp số 1 vào `main`. M01-3 hoàn thành, CG-08 đạt.

#### Quyết định

- Eric là người bấm gộp yêu cầu gộp vào `main` (QĐ-19).

#### Thay đổi

- Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.5.

#### Vấn đề tồn đọng

- Việc tiếp theo: trình thiết kế đợt DT-01 (`M01`). Các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — M01-3 nền móng kỹ thuật

#### Công việc đã thực hiện

- Eric duyệt thiết kế DT-00. Khởi tạo Git tại gốc dự án, nối kho https://github.com/luckyshopvn/school_management, làm trên nhánh `dt-00-nen-mong`.
- Dựng cấu trúc nhiều gói bằng pnpm theo `13` mục 4: `apps/api`, `apps/identity`, `apps/worker`, `apps/portal`, `apps/teacher`, `apps/parent`, `packages/shared`, `packages/ui`, `packages/config`, `database/`.
- Docker Compose chạy PostgreSQL 17 và Redis 7; tệp `docker/postgres/create-databases.sh` tạo ba cơ sở dữ liệu `school_identity`, `school_system`, `school_year_2026_2027` với hai tài khoản kết nối riêng.
- Tệp thay đổi cấu trúc đầu tiên của ba cơ sở dữ liệu đặt giờ Việt Nam; chạy bằng Kysely.
- GitHub Actions chạy kiểm tra định dạng, kiểm tra quy tắc viết mã, xây dựng, kiểm tra kiểu, chạy tệp thay đổi cấu trúc và kiểm thử.
- Kết quả trên máy: xây dựng, kiểm tra kiểu, kiểm tra quy tắc viết mã, kiểm tra định dạng đạt; tệp thay đổi cấu trúc chạy được trên ba cơ sở dữ liệu; 6/6 kiểm thử đạt: kiểm tra sức khỏe của `api` và `identity`, tệp thay đổi cấu trúc chạy hai lần không lỗi và đặt giờ Việt Nam trên ba cơ sở dữ liệu, tiến trình chạy nền kết nối Redis.

#### Quyết định

- Dùng TypeScript 6.0, NestJS 11, Vite 8, ESLint 10; không dùng TypeScript 7 và NestJS 12 vì vừa phát hành và chưa được các công cụ kiểm tra hỗ trợ.

#### Thay đổi

- `17` thêm điểm cuối `GET /api/v1/health`; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.4.

#### Vấn đề tồn đọng

- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Lịch năm học

#### Công việc đã thực hiện

- Eric cho biết năm học gồm hai học kỳ, bắt đầu khoảng 05/09, kết thúc khoảng tháng 5 năm sau; hỏi bốn điểm và trình thiết kế YCTD-30.
- Áp dụng YCTD-30 vào các tài liệu liên quan và thêm 15 ca vào bộ ca kiểm thử chi tiết.

#### Quyết định

- Tuần học gồm tự đánh số tuần, tuần nghỉ, ngày học trong tuần – người quyết định: Eric.
- Có kỳ hè riêng, đăng ký học hè theo từng tháng – người quyết định: Eric.
- Số phiếu thu, phiếu chi đánh theo năm học – người quyết định: Eric.
- Hiệu trưởng lập lịch năm học chung toàn trường – người quyết định: Eric.
- Đăng ký học hè đặt ở P05-13 vì gắn với tính học phí.
- Bỏ xác thực hai lớp (YCTD-31) – người quyết định: Eric.
- Chỉ dùng GitHub trước; Eric tự tạo kho riêng; môi trường phát triển chạy Docker trên máy cục bộ; GitHub Actions chỉ chạy kiểm thử; hạ tầng đám mây khi triển khai (YCTD-32) – người quyết định: Eric.
- Kho mã nguồn https://github.com/luckyshopvn/school_management; dùng Kysely (QĐ-18); nhánh theo việc, gộp qua yêu cầu gộp (QĐ-19); commit đứng tên thư công ty của Eric (YCTD-33) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-30 đến YCTD-33 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.0 đến 0.25.3.

#### Vấn đề tồn đọng

- Việc tiếp theo: Eric cài Docker Desktop; sau đó M01-3 dựng nền móng DT-00 để qua CG-08. Các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — N21 bộ ca kiểm thử chi tiết

#### Công việc đã thực hiện

- Lập thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`; viết đợt 1 `01_DINH_DANH_VA_P01.md`: 42 ca dịch vụ định danh, 98 ca P01, bảng truy xuất tiêu chí nghiệm thu.
- Phát hiện ba điểm căn cứ chưa rõ, ghi thành Q-147 đến Q-149, áp dụng câu trả lời theo YCTD-26.
- Viết đợt 2 `02_P02_VA_P04.md`: 68 ca P02, 43 ca P04, bảng truy xuất tiêu chí nghiệm thu.
- Viết đợt 3 `03_P05.md`: 62 ca P05; phát hiện Q-150, Q-151, áp dụng câu trả lời theo YCTD-27.
- Viết đợt 4 `04_P06.md`: 65 ca P06; phát hiện Q-152, áp dụng câu trả lời theo YCTD-28.
- Khi chuẩn bị đợt 5, Q-153 làm rõ lương trả trước đầu tháng; hỏi thêm Q-154 đến Q-156; trình và áp dụng YCTD-29.
- Viết đợt 5 `05_P08.md`: 59 ca P08 theo cách chi lương trả trước.

#### Quyết định

- Đợt 1 `01_DINH_DANH_VA_P01.md`, đợt 2 `02_P02_VA_P04.md`, đợt 3 `03_P05.md`, đợt 4 `04_P06.md` và đợt 5 `05_P08.md` phiên bản 1.0 được phê duyệt; N21 hoàn thành – người quyết định: Eric.
- N21 chỉ viết cho chức năng giai đoạn 1, đặt ở thư mục 27, mã `CTC-...`, chia năm đợt và duyệt từng đợt – người quyết định: Eric.
- Q-147: phụ huynh chưa đổi mật khẩu mặc định vẫn đăng nhập bằng mã một lần và dùng bình thường – người quyết định: Eric.
- Q-148: người được đặt lại mật khẩu bắt buộc đổi ở lần đăng nhập kế tiếp – người quyết định: Eric.
- Q-149: công nợ của trẻ đã thôi học không chuyển sang năm mới; chặn đóng năm khi còn nợ loại này – người quyết định: Eric.
- Q-150: đăng ký trễ thu theo ngày thực tế tính từ ngày bắt đầu học dịch vụ – người quyết định: Eric.
- Q-151: còn ngày chưa chốt điểm danh thì chặn tính học phí – người quyết định: Eric.
- Q-152: thủ quỹ chọn hóa đơn và phân bổ khi lập phiếu thu tiền mặt – người quyết định: Eric.
- YCTD-29: lương trả trước đầu tháng, điều chỉnh theo công tháng trước; tháng trước chưa chốt công thì chặn tính lương; nhân sự mới không trả trước tháng đầu; nghỉ việc lập bảng quyết toán; vẫn chặn chốt công khi còn đơn chờ duyệt (Q-153 đến Q-156) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-26 đến YCTD-29 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.23.0 đến 0.24.1.

#### Vấn đề tồn đọng

- N21 hoàn thành. Việc tiếp theo: M01-3 tạo kho mã nguồn và ba môi trường để qua CG-08; các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — Rà duyệt từng tài liệu

#### Công việc đã thực hiện

- Rà `04_TONG_QUAN_DU_AN.md`: sửa cây đơn vị không giới hạn cấp, bỏ nhắc ứng lương, cập nhật nhóm đối tượng theo vai trò mới, cập nhật tích hợp bên ngoài.
- Rà `05_PHAM_VI.md`: bổ sung vào giai đoạn 1 các chức năng đã gắn G1 ở tài liệu 10 (G1-17 API cho đối tác, G1-18 nhập mã định danh, làm thêm giờ, hạn mức, năm học, chuyển đơn vị, nhật ký của bé); sửa đơn vị của trẻ theo QĐ-14; cập nhật mục chưa xác minh theo Q-02, Q-08, Q-09.
- Rà `06_YEU_CAU_NGHIEP_VU.md`: sửa cây đơn vị, QTN-03 theo BR-23, QTN-12 theo Q-09, thêm vai trò mới vào các nghiệp vụ, cập nhật mục chưa xác minh; phát hiện dịch vụ học thứ bảy mâu thuẫn với lịch học bù, áp dụng YCTD-16.
- Rà `07_QUY_TAC_NGHIEP_VU.md`: sửa BR-01, BR-03, BR-20, BR-24, BR-46, BR-53, BR-73, BR-77, trạng thái đơn nghỉ phép, mục chưa xác minh; sửa ma trận quyền phân hệ Y tế; đồng bộ phiên bản quy trình QT-01, QT-02, QT-04, QT-06 trong mục lục (mục lục ghi thấp hơn tệp).
- Rà `08_VAI_TRO_NGUOI_DUNG.md`: ma trận thêm quyền duyệt của quản lý đơn vị ở P02, P08 và quyền đăng nhập của VT-19, VT-20 ở P19; thêm ghi chú lịch nghỉ thứ 7, nhập dữ liệu ban đầu; PQ-03 và phạm vi toàn trường của VT-19, VT-20; bảng phê duyệt có ngoại lệ hoàn tiền; cập nhật mục chưa xác minh. BR-01 ở tài liệu 07 sửa theo.
- Rà `09_LUONG_NGHIEP_VU.md`: nhân sự chốt công; không chặn trẻ đi học khi nợ; đăng ký giữa tháng theo BR-26; LP-11, LP-12 gắn P13; mất mạng theo Q-09; sửa sơ đồ luồng; thêm thủ quỹ; cập nhật mục chưa xác minh.
- Rà `10_YEU_CAU_CHUC_NANG.md`: sửa người dùng, quy tắc và bước phê duyệt của P01-01, P01-08, P02-03, P02-08, P04-01, P05-02, P05-03, P05-07, P05-08, P06-01, P06-04, P06-05, P08-03, P08-04, P08-06, P08-08, P17-01, P18-01, P18-03, P19-01, P19-06; cập nhật mục chưa xác minh.
- Rà `11_TIEU_CHI_NGHIEM_THU.md`: sửa AC-26, AC-29, AC-41, AC-43, AC-58, AC-89, AC-147, AC-166, AC-180; thêm AC-206 đến AC-209 và CT-162 đến CT-165; phát hiện công thức suất ăn trừ hai lần, áp dụng YCTD-20.
- Rà `12_KIEN_TRUC_HE_THONG.md`: định danh dùng cơ sở dữ liệu riêng; sơ đồ thêm đối tác, cơ sở dữ liệu theo năm học và cơ sở dữ liệu định danh; phạm vi đơn vị theo YCTD-18; nhật ký nhạy cảm theo BR-73; thêm CB-09, CB-10; sao lưu gồm mọi cơ sở dữ liệu; cập nhật mục chưa xác minh.
- Rà `13_CONG_NGHE_SU_DUNG.md`: đổi tên mục 2 thành công nghệ đã chốt; tách thư mục `database/` theo định danh và năm học; thêm QU-11; cập nhật mục chưa xác minh.
- Rà `14_DAC_TA_GIAO_DIEN.md`: sửa vai trò ở MH-05, MH-07, MH-09, MH-10, MH-11, MH-13, MH-15, MH-28, MH-29, MH-30; MH-32 theo QĐ-14; đặt nhập mã ngành, buffet, đồng ý hình ảnh vào màn hình sẵn có; sửa BC-01, BC-08, XL-05; bỏ mục xe trong sơ đồ; cập nhật mục chưa xác minh.
- Rà `15_HE_THONG_THIET_KE.md`: nâng mọi cỡ chữ lên tối thiểu 14 theo Q-89; ghi mức tương phản 4,5:1; nút chính nền cam dùng chữ tối; thêm TD-16, TD-17, MC-06; TD-14 theo Q-119; cập nhật mục chưa xác minh.
- Rà `16_CO_SO_DU_LIEU.md`: phân ba loại cơ sở dữ liệu; giữ nguyên mã khi mở năm học; thêm `sessions`, `one_time_codes`, `class_staff_assignments`, `teaching_groups`, `teaching_group_members`; thêm cột cho trẻ con nhân viên, phiếu chi, nhật ký truy cập; hóa đơn chính và bổ sung; bỏ bảng trống ở mục P11; cập nhật mục chưa xác minh.
- Rà `17_DAC_TA_API.md`: thêm điểm cuối duyệt và từ chối giảm trừ, phiếu điều chỉnh, mở lại kỳ công, đề nghị mua hàng, hồ sơ tuyển sinh; thêm điểm cuối phân công giáo viên, tổ chuyên môn, đề nghị mua thuốc, phỏng vấn, ẩn bình luận; ghi khóa API do dịch vụ định danh quản lý; thêm KT-09; bỏ bảng trống mục xe; cập nhật mục chưa xác minh.
- Rà `18_QUY_TAC_PHAT_TRIEN_AI.md`: thêm AI-41 về cơ sở dữ liệu theo năm học, AI-42 về quyết định kiến trúc; AI-13 dẫn BR-81; mục 6 dùng tên trạng thái của quy trình; AI-10 bỏ từ tiếng Anh.
- Rà `19_CHI_DAN_HE_THONG_AI.md`: cập nhật ngữ cảnh theo QĐ-14 đến QĐ-17 và thư mục 26; câu lệnh hệ thống bỏ từ tiếng Anh, thêm ngoại lệ hạn mức và nguyên tắc 17; bảng quy ước mã bỏ dạng không dùng và thêm mười bốn nhóm tiền tố.
- Rà `20_KE_HOACH_KIEM_THU.md`: thêm PV-13 đến PV-15 cho API đối tác, cơ sở dữ liệu theo năm học, nhập dữ liệu; bổ sung phạm vi đăng nhập, thanh toán mã QR, công việc, tuyển dụng; dữ liệu kiểm thử theo GD-79 và thêm DL-11 đến DL-13; đưa câu trả lời Q-101 đến Q-104 vào nội dung; bỏ mục chưa xác minh đã lỗi thời.
- Rà `21_KICH_BAN_KIEM_THU.md`: sửa CT-007, CT-021, CT-031, CT-049, CT-067, CT-082, CT-089, CT-150 cho khớp quy tắc và tiêu chí nghiệm thu; thêm AC-211 và CT-167 cho khóa API đã thu hồi; AC-194 thêm giữ nguyên mã định danh, tài liệu 11 lên phiên bản 1.1; cập nhật mục chưa xác minh.
- Rà `22_BAO_MAT.md`: BM-17 thêm Ban Giám hiệu theo BR-53; chuyển BM-61 đến BM-69 khỏi mục giám sát về đúng mục; BM-05 ghi thời hạn phiên theo Q-120; BM-19 ghi hai trường hợp luôn ghi nhật ký; BM-42 khớp SL-01 đến SL-04; SL-01 thêm cơ sở dữ liệu hệ thống, tài liệu 12 lên phiên bản 1.1; thêm BM-70 thời hạn lưu nhật ký và dòng trách nhiệm bên thứ ba; bỏ mục chưa xác minh đã lỗi thời.
- Rà `23_LICH_SU_PHIEN_BAN.md`: hạ cấp tiêu đề các mục phiên bản từ 0.4.0; quy ước 2 dùng tên mục "thay đổi API"; quy ước 5 ghi lý do giữ tên tệp cũ; `index.md` sửa phạm vi tài liệu 24 thành YCTD-01 đến YCTD-22.
- Rà `01_KE_HOACH_TONG_THE.md`: cập nhật mô tả sản phẩm, mốc 1.0.0 và 1.1.0, trạng thái cổng, phạm vi mã; tên trạng thái theo quy trình; bỏ nội dung chờ duyệt và mục chưa xác minh đã lỗi thời; xếp năm chức năng giai đoạn 1 mới vào đợt; RR-07 theo kịch bản hiệu năng của tài liệu 20.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md`: bước 2 nhập số định danh, giấy khai sinh và từ chối trùng số định danh khi lưu; số điện thoại đã có tài khoản thì gắn phụ huynh có sẵn theo BR-08, thay cho chặn; bỏ chữ kích hoạt tài khoản và quy trình tiếp nhận lại không tồn tại; thêm AC-201.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-02_DIEM_DANH_BAO_VANG.md`: BR-56 chép đủ vế phụ huynh xác nhận người đón ngoài danh sách, sửa E6 và sơ đồ; thêm ngày học bù thứ 7 theo BR-84; thêm Ban Giám hiệu vào tác nhân; gộp dòng dữ liệu trùng, thêm ảnh bàn giao tùy chọn; quản lý đơn vị được chốt và sửa sau chốt, tài liệu 08 thêm ghi chú 15 và lên phiên bản 1.1.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-03_DANG_KY_DICH_VU_VA_TINH_HOC_PHI.md`: đăng ký trễ chờ Ban Giám hiệu duyệt và lập hóa đơn bổ sung cùng kỳ thay cho phát sinh kỳ sau; AC-29 chép theo bản đã sửa; biểu phí dùng chung toàn trường; thêm kiểm tra bán trú bắt buộc và chặn khi nợ quá hạn; quản lý đơn vị chỉ xem; Hiệu trưởng duyệt khi chưa cấu hình hạn mức; ràng buộc chống trùng áp cho hóa đơn chính.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-04_THU_HOC_PHI_VA_CONG_NO.md`: thêm thủ quỹ; luồng lỗi thanh toán mã QR E10, E11 và AC-186 đến AC-189; nhắc nợ ghi rõ giai đoạn 2; phiếu đảo chờ Ban Giám hiệu duyệt; xử lý công nợ quá hạn qua P05-12 (YCTD-23).
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-05_PHIEU_CHI_VA_QUY.md`: AC-37 theo BR-34 bắt buộc; thêm thủ quỹ và kế toán trưởng lập phiếu; phiếu chi hoàn tiền và loại chưa cấu hình hạn mức do Hiệu trưởng duyệt; phiếu đảo phiếu chi chờ Ban Giám hiệu duyệt (YCTD-24); thêm loại phiếu chi, khoản mục, nhiều quỹ; ghi rõ giai đoạn của từng phần.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-06_CHAM_CONG_VA_TINH_LUONG.md`: thêm tiền làm thêm giờ vào bước tính lương; nhân sự đề nghị và Ban Giám hiệu duyệt mở lại kỳ công; chốt công áp lịch nghỉ lễ, nghỉ thứ 7 và học bù (BR-84); phiếu chi loại lương trình duyệt theo QT-05; Hiệu trưởng duyệt khi chưa cấu hình hạn mức; thêm MH-44; chép AC-41, AC-43, AC-46 theo bản mới.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-07_DAN_THUOC_VA_CHAM_SOC_SUC_KHOE.md`: áp dụng YCTD-25: giáo viên chủ nhiệm nhận thuốc khi đơn vị không có nhân viên y tế, ảnh thuốc bắt buộc, chăm sóc hằng ngày P10-12, phụ huynh xác nhận đã biết; thêm Ban Giám hiệu vào tác nhân; GD-32 không còn hiệu lực.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-09_NHAT_KY_VA_TRAO_DOI.md`: bỏ chữ kích hoạt tài khoản; ghi nhật ký thuộc giai đoạn 1, trao đổi và góp ý thuộc giai đoạn 2; quản lý đơn vị sửa nhật ký quá hạn theo Q-67, ghi chú 15 của tài liệu 08 mở rộng và lên phiên bản 1.4.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md`: Ban Giám hiệu duyệt, ẩn và công bố lại hoạt động theo ma trận và Q-72, P14-02 thêm VT-15, VT-02; ẩn bình luận vi phạm kèm lý do (Q-70); tự ẩn hình khi phụ huynh rút đồng ý (BR-65, AC-190); giới hạn ảnh theo Q-71; ghi giai đoạn; tài liệu 17 thêm điểm cuối ẩn và công bố lại hoạt động.

#### Quyết định

- `04_TONG_QUAN_DU_AN.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `05_PHAM_VI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `06_YEU_CAU_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- Bỏ dịch vụ học thứ bảy; thứ bảy chỉ có lịch học bù chung toàn trường do Ban Giám hiệu lập – người quyết định: Eric (YCTD-16).
- `07_QUY_TAC_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt; dữ liệu sức khỏe chỉ cho giáo viên chủ nhiệm, y tế, Ban Giám hiệu, quản lý đơn vị, kế toán và phụ huynh; hoàn tiền khi trẻ thôi học luôn do Hiệu trưởng phê duyệt – người quyết định: Eric (YCTD-17).
- `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.0 được phê duyệt; kiểm toán viên luôn xem số liệu toàn trường (Q-145) – người quyết định: Eric (YCTD-18).
- `09_LUONG_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `10_YEU_CAU_CHUC_NANG.md` phiên bản 1.0 được phê duyệt; phiếu chi và quỹ tiền mặt chuyển sang giai đoạn 1 – người quyết định: Eric (YCTD-19).
- `11_TIEU_CHI_NGHIEM_THU.md` phiên bản 1.0 được phê duyệt; trường không có bữa tối; ba bữa sáng, trưa, xế thuộc bán trú; số suất bằng số trẻ có mặt; buffet là tiệc theo dịp không thu riêng – người quyết định: Eric (YCTD-20).
- `12_KIEN_TRUC_HE_THONG.md` phiên bản 1.0 được phê duyệt; chốt QĐ-01, QĐ-03, QĐ-05 – người quyết định: Eric.
- `13_CONG_NGHE_SU_DUNG.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `14_DAC_TA_GIAO_DIEN.md` phiên bản 1.0 được phê duyệt; nhân sự tự phục vụ ở cả hai kênh, thêm MH-44 (Q-146) – người quyết định: Eric (YCTD-21).
- `15_HE_THONG_THIET_KE.md` phiên bản 1.0 được phê duyệt; mọi cỡ chữ tối thiểu 14 điểm ảnh – người quyết định: Eric.
- `16_CO_SO_DU_LIEU.md` phiên bản 1.0 được phê duyệt; khoản phát sinh sau phát hành lập hóa đơn bổ sung cùng kỳ (BR-85); khóa API đặt ở cơ sở dữ liệu định danh, danh sách năm học đặt ở cơ sở dữ liệu hệ thống (QĐ-17) – người quyết định: Eric (YCTD-22).
- `17_DAC_TA_API.md` phiên bản 1.0 được phê duyệt; không thêm chức năng tự lấy lại mật khẩu – người quyết định: Eric.
- `18_QUY_TAC_PHAT_TRIEN_AI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `19_CHI_DAN_HE_THONG_AI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `20_KE_HOACH_KIEM_THU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `21_KICH_BAN_KIEM_THU.md` phiên bản 1.0 được phê duyệt; thêm ca kiểm thử khóa API đã thu hồi – người quyết định: Eric.
- `22_BAO_MAT.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `23_LICH_SU_PHIEN_BAN.md` đã rà duyệt, giữ trạng thái Đang cập nhật theo quy định của `index.md` – người quyết định: Eric.
- `01_KE_HOACH_TONG_THE.md` phiên bản 1.0 được phê duyệt; G1-15 đến G1-19 xếp vào DT-00, DT-03, DT-05, DT-06, DT-07 theo phân hệ; kiểm thử hiệu năng theo dữ liệu môi trường thử nghiệm của tài liệu 20, không dùng dữ liệu gấp năm lần – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md` phiên bản 1.3 được phê duyệt; phụ huynh nhiều con dùng một tài khoản – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-02_DIEM_DANH_BAO_VANG.md` phiên bản 1.4 được phê duyệt; quản lý đơn vị được chốt điểm danh ngày và sửa điểm danh đã chốt kèm lý do, ma trận P04 của VT-03 thành X, S – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-03_DANG_KY_DICH_VU_VA_TINH_HOC_PHI.md` phiên bản 1.7 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-04_THU_HOC_PHI_VA_CONG_NO.md` phiên bản 1.3 được phê duyệt; phiếu đảo phiếu thu do Ban Giám hiệu duyệt theo hạn mức; xử lý công nợ quá hạn do Ban Giám hiệu quyết, thêm P05-12 ở giai đoạn 2 (YCTD-23) – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-05_PHIEU_CHI_VA_QUY.md` phiên bản 1.2 được phê duyệt; phiếu đảo phiếu chi do Ban Giám hiệu duyệt theo hạn mức (YCTD-24) – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-06_CHAM_CONG_VA_TINH_LUONG.md` phiên bản 1.4 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-07_DAN_THUOC_VA_CHAM_SOC_SUC_KHOE.md` phiên bản 1.2 được phê duyệt; bổ sung nội dung gửi thuốc và chăm sóc sức khỏe theo YCTD-25, giữ giai đoạn 2: giáo viên nhận thuốc theo cấu hình đơn vị, ảnh thuốc bắt buộc và đơn tùy chọn, chăm sóc hằng ngày, phụ huynh xác nhận đã biết chỉ hiển thị trạng thái – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-09_NHAT_KY_VA_TRAO_DOI.md` phiên bản 1.1 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md` phiên bản 1.1 được phê duyệt; hoàn tất rà duyệt các đặc tả QT, CG-03 đạt – người quyết định: Eric.

#### Thay đổi

- `04_TONG_QUAN_DU_AN.md`, `05_PHAM_VI.md`, `06_YEU_CAU_NGHIEP_VU.md`, `index.md`.
- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-16 đến YCTD-25 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.13.0 đến 0.22.2.

#### Vấn đề tồn đọng

- Rà duyệt toàn bộ tài liệu đã xong; CG-01 đến CG-07 đã đạt.
- Việc tiếp theo: N21 viết bộ ca kiểm thử chi tiết; M01-3 tạo kho mã nguồn và ba môi trường để qua CG-08; các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — Xử lý hết giả định

#### Công việc đã thực hiện

- N22: hỏi Eric năm lượt (lượt 17 đến lượt 21) về giả định và các điểm cần làm rõ; cập nhật trạng thái toàn bộ 92 giả định; áp dụng các quyết định mới.
- Kiểm tra bằng truy vấn văn bản: không còn câu hỏi mở, không còn giả định chờ xác nhận, không còn quy tắc ghi chờ xác nhận; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Nhân sự chốt công; bán trú bắt buộc; đăng ký trễ do Ban Giám hiệu duyệt; trẻ nhận diện bằng số định danh và mã ngành; tài khoản phụ huynh dùng mật khẩu mặc định chung; không chia mốc trong ngày – người quyết định: Eric (YCTD-15).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-15 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.12.0.

#### Vấn đề tồn đọng

- Eric phê duyệt bộ tài liệu `04` đến `23` để qua các cổng CG-01 đến CG-07 – trạng thái: chờ xác nhận.
- N21: viết bộ ca kiểm thử chi tiết cho bốn nhóm phân hệ – trạng thái: chưa bắt đầu.
- RR-14: mật khẩu mặc định chung là rủi ro bảo mật đã được ghi nhận – trạng thái: chấp nhận theo quyết định của Eric.

### 2026-10-09 — Trả lời toàn bộ câu hỏi mở

#### Công việc đã thực hiện

- N20: hỏi Eric tám lượt (lượt 9 đến lượt 16), dùng hình thức tích chọn đề xuất cho các câu có đề xuất hợp lý và hỏi riêng các câu không được chọn; áp dụng câu trả lời vào toàn bộ bộ tài liệu.
- Sự cố khi chạy script phần A: lệnh khôi phục tự động xóa nội dung thư mục `tai_lieu` nhưng không chép lại được vì thư mục đang được dùng. Đã chép lại từ bản sao lưu ngay trước khi chạy, đối chiếu khớp hoàn toàn rồi chạy lại. Đã đổi cách chạy: script chạy trong tiến trình con và khôi phục chỉ xóa nội dung bên trong thư mục.
- Kiểm tra bằng truy vấn văn bản: không còn câu hỏi mở; không còn tham chiếu xe đưa đón ngoài các dòng ghi đã bỏ; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Bỏ phân hệ xe đưa đón; thêm năm vai trò; cây đơn vị không giới hạn cấp; mỗi năm học một cơ sở dữ liệu; API chỉ đọc cho đối tác ngay giai đoạn 1; tiền làm thêm giờ tối đa 1 giờ mỗi ngày; AI phải xin xác nhận trước mọi thay đổi mã nguồn; cùng các quyết định khác ở YCTD-14 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-14 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.11.0.

#### Vấn đề tồn đọng

- 85 giả định chưa xác nhận – trạng thái: chờ xác nhận.
- N21: viết bộ ca kiểm thử chi tiết cho bốn nhóm phân hệ – trạng thái: chưa bắt đầu.

### 2026-10-09 — Chốt các quyết định lượt 8

#### Công việc đã thực hiện

- N19: áp dụng câu trả lời lượt 8; bỏ chức năng ứng lương theo yêu cầu, giữ mã kèm ghi chú; cập nhật quy tắc quỹ tiền mặt, đồng ý hình ảnh, số định danh của trẻ.
- Kiểm tra bằng truy vấn văn bản: không còn tham chiếu ứng lương ngoài các dòng ghi "Bỏ ngày 09/10/2026"; đếm lại câu hỏi mở, giả định, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Không cho ứng lương; lương trả một lần mỗi tháng – người quyết định: Eric (Q-54, Q-56).
- Quỹ tiền mặt không âm, bắt buộc – người quyết định: Eric (Q-19).
- Đồng ý hình ảnh trên ứng dụng hoặc giấy ký tay, rút lại được – người quyết định: Eric (Q-20).
- Lưu số định danh và giấy khai sinh của trẻ, che với vai trò không cần – người quyết định: Eric (Q-35, Q-37).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-13 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.10.0.

#### Vấn đề tồn đọng

- GD-88, GD-89 mới – trạng thái: chờ xác nhận.
- 76 câu hỏi mở và 84 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 6 và lượt 7

#### Công việc đã thực hiện

- N18: áp dụng câu trả lời lượt 6 và lượt 7; thêm P01-13, P06-11 cùng dữ liệu, điểm cuối, màn hình, biện pháp bảo mật, tiêu chí và ca kiểm thử; đổi quy tắc thu tiền sang luôn trả đủ.
- Kiểm tra bằng truy vấn văn bản: đếm lại chức năng, bảng, màn hình, câu hỏi mở, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Nhập dữ liệu ban đầu từ Excel ở giai đoạn 1 – người quyết định: Eric (Q-02).
- Zalo để giai đoạn 3 – người quyết định: Eric (Q-05).
- Mốc nhắc nợ mặc định 3, 7, 15 ngày, cấu hình được – người quyết định: Eric (Q-11, Q-45).
- Thanh toán trực tuyến bằng chuyển khoản mã QR có xác nhận tự động ở giai đoạn 1 – người quyết định: Eric (Q-48, Q-81).
- Luôn phải trả đủ – người quyết định: Eric (Q-47).
- Quản lý đơn vị không xem bảng lương – người quyết định: Eric (Q-23).
- Hiệu trưởng và kế toán trưởng cùng nghiệm thu – người quyết định: Eric (Q-129).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-12 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.9.0.

#### Vấn đề tồn đọng

- Q-142: chọn nhà cung cấp tin nhắn và dịch vụ xác nhận chuyển khoản; cần trước khi nghiệm thu P19-06 và P06-11 – trạng thái: chờ xác nhận.
- 82 câu hỏi mở và 82 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 4 và lượt 5

#### Công việc đã thực hiện

- N16: áp dụng câu trả lời lượt 4 và lượt 5; đổi điểm danh sang một lần mỗi ngày trên toàn bộ tài liệu; thêm đăng nhập bằng mã một lần cho phụ huynh; chốt hạ tầng và nơi lưu mã nguồn.
- Kiểm tra bằng truy vấn văn bản: không còn tham chiếu điểm danh theo buổi; đếm lại câu hỏi mở, giả định, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Git trên GitHub kèm tích hợp và triển khai tự động từ đợt DT-00 – người quyết định: Eric (Q-130).
- Máy chủ đám mây trong nước, dữ liệu lưu tại Việt Nam – người quyết định: Eric (Q-74, Q-76).
- Phụ huynh đăng nhập bằng mật khẩu hoặc mã một lần – người quyết định: Eric (Q-24, Q-117).
- Ứng dụng phụ huynh và giáo viên dạng web ở giai đoạn 1 – người quyết định: Eric (Q-04).
- Điểm danh một lần mỗi ngày – người quyết định: Eric (Q-38).
- Đi muộn hoặc về sớm vẫn tính đủ ngày ăn – người quyết định: Eric (Q-39).
- Chốt công và học phí ngày cuối tháng – người quyết định: Eric (Q-25).
- Chặn đăng ký dịch vụ khi nợ quá hạn cấu hình theo đơn vị – người quyết định: Eric (Q-27, Q-46).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-11 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.8.0.

#### Vấn đề tồn đọng

- T1: chọn nhà cung cấp tin nhắn, cần cho thông báo và đăng nhập bằng mã một lần – trạng thái: chờ xác nhận.
- T6: thuê máy chủ đám mây trong nước – trạng thái: chờ xác nhận.
- 93 câu hỏi mở và 82 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 3

#### Công việc đã thực hiện

- N15: áp dụng câu trả lời lượt 3; thêm P05-11, P08-11 cùng bảng dữ liệu, điểm cuối, tiêu chí nghiệm thu và ca kiểm thử.
- Kiểm tra bằng truy vấn văn bản: đếm lại câu hỏi mở, chức năng, bảng, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp – người quyết định: Eric (Q-140).
- Học phí chính khóa cấu hình được, mức có thể bằng không – người quyết định: Eric (Q-141).
- Mức miễn giảm do nhà trường tự cấu hình – người quyết định: Eric (Q-16).
- Danh mục khấu trừ và số ngày phép năm do nhà trường tự cấu hình – người quyết định: Eric (Q-17, Q-18).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-10 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.7.0.

#### Vấn đề tồn đọng

- Không còn việc xây dựng nào bị chặn bởi câu hỏi nghiệp vụ. Còn 105 câu hỏi mở, 85 giả định chưa xác nhận và việc Eric phê duyệt bộ tài liệu – trạng thái: chờ xác nhận.
- Q-130: hệ thống quản lý phiên bản mã nguồn – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định ưu tiên lượt 1 và lượt 2

#### Công việc đã thực hiện

- N14: hỏi Eric hai lượt câu hỏi ưu tiên, áp dụng câu trả lời vào quy tắc nghiệp vụ, phạm vi, kiến trúc, công nghệ, dữ liệu, quy trình QT-02, QT-03, QT-05, kế hoạch tổng thể và danh sách công việc.
- Kiểm tra bằng truy vấn văn bản: đếm lại câu hỏi mở và giả định; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Phương án lưu trữ A – người quyết định: Eric (Q-77).
- Bộ công nghệ đề xuất – người quyết định: Eric (Q-79).
- Học phí giữa tháng theo ngày học thực tế – người quyết định: Eric (Q-14, Q-41).
- Lập sổ kế toán kép ở giai đoạn 3 – người quyết định: Eric (Q-01, Q-51).
- Chưa đặt mức hạn mức, cấu hình sau – người quyết định: Eric (Q-112, Q-26).
- Nhà trường tự tạo cây đơn vị; các đơn vị dùng chung biểu phí – người quyết định: Eric (Q-113, Q-122).
- Tiền ăn thu theo ngày ăn thực tế – người quyết định: Eric (Q-15, Q-43).
- Đồng ý cách xếp ba giai đoạn – người quyết định: Eric (Q-07).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-09 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.6.0.

#### Vấn đề tồn đọng

- Q-140: sổ kế toán kép theo chế độ kế toán nào; trường công lập thường áp dụng chế độ kế toán hành chính, sự nghiệp, khác Thông tư 99/2025/TT-BTC dành cho doanh nghiệp – trạng thái: chờ xác nhận.
- Q-16: mức miễn giảm và thẩm quyền, đang chặn M05 – trạng thái: chờ xác nhận.
- Q-17, Q-18: danh mục khấu trừ và số ngày phép năm, đang chặn M08 – trạng thái: chờ xác nhận.

### 2026-10-09 — Trả lời Q-139 và xác nhận GD-86

#### Công việc đã thực hiện

- N13: cập nhật P14-11; thêm AC-175, CT-131; đánh dấu GD-86 đã xác nhận.
- Kiểm tra bằng truy vấn văn bản: không có lỗi bảng, liên kết hỏng hay khối mã lẻ; đếm lại câu hỏi mở và giả định.

#### Quyết định

- Phí ngoại khóa thu theo tháng không giảm trừ khi trẻ nghỉ buổi hoặc thôi giữa tháng – người quyết định: Eric (Q-139).
- Lịch nghỉ thứ 7 và lịch học bù áp dụng cho mọi nhân sự của đơn vị – người quyết định: Eric (GD-86).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-08 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.3.

#### Vấn đề tồn đọng

- 126 câu hỏi mở và 85 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Bổ sung điểm cuối cho phân hệ Giảng dạy

#### Công việc đã thực hiện

- N12: thêm mục 7 Giảng dạy với mười tám điểm cuối vào `17_DAC_TA_API.md`; thêm bảng `class_activity_schedules` cho P03-07.
- Kiểm tra bằng truy vấn văn bản: không có lỗi bảng, liên kết hỏng hay khối mã lẻ; không tài liệu nào trỏ tới số mục cũ từ 7 trở đi của `17_DAC_TA_API.md`.

#### Quyết định

- Bổ sung điểm cuối cho phân hệ Giảng dạy – người quyết định: Eric (YCTD-07).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-07 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.2.

#### Vấn đề tồn đọng

- Q-139 và GD-86 – trạng thái: chờ xác nhận.
- Vấn đề thiếu điểm cuối P03 ghi ở hai mục nhật ký trước – trạng thái: đã xử lý.

### 2026-10-09 — Áp dụng câu trả lời Q-136 đến Q-138

#### Công việc đã thực hiện

- N11: cập nhật P08-10, P10-11, P14-10, P14-11 cùng dữ liệu, tiêu chí nghiệm thu và ca kiểm thử liên quan.
- Kiểm tra bằng truy vấn văn bản: đếm lại mã câu hỏi, giả định, tiêu chí và ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Tiêu chuẩn sức khỏe theo Bộ Y tế – người quyết định: Eric (Q-136).
- Hoạt động ngoại khóa thu phí theo từng hoạt động hoặc theo tháng – người quyết định: Eric (Q-137).
- Nghỉ thứ bảy định kỳ, trừ lịch học bù – người quyết định: Eric (Q-138).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-06 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.1.

#### Vấn đề tồn đọng

- Q-139: phí ngoại khóa theo tháng có giảm trừ khi trẻ nghỉ không – trạng thái: chờ xác nhận.
- GD-86: lịch nghỉ thứ 7 và học bù áp dụng cho mọi nhân sự của đơn vị – trạng thái: chờ xác nhận.
- `17_DAC_TA_API.md` chưa có nhóm điểm cuối cho phân hệ P03 Giảng dạy – trạng thái: chờ xác nhận.

### 2026-10-09 — Bổ sung chức năng theo tám ảnh sơ đồ chức năng

#### Công việc đã thực hiện

- N10: đối chiếu tám ảnh sơ đồ chức năng với danh sách chức năng, tìm ra mười hai nhóm mục còn thiếu; bổ sung hai mươi chức năng cùng tiêu chí nghiệm thu, ca kiểm thử, bảng dữ liệu, điểm cuối, màn hình và phạm vi.
- N10: lưu tám ảnh vào `26_SO_DO_CHUC_NANG/`.
- N10: sửa số liệu ghi nhầm về số chức năng và số bảng dữ liệu.
- Kiểm tra bằng truy vấn văn bản: đếm lại chức năng, bảng, màn hình, mã câu hỏi và giả định; không có liên kết hỏng, hàng bảng thiếu dấu `|`, khối mã lẻ.

#### Quyết định

- Bổ sung cả mười hai nhóm mục từ ảnh vào phạm vi, theo giai đoạn đề xuất – người quyết định: Eric (YCTD-05).
- Lưu tám ảnh sơ đồ chức năng vào dự án – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-05 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.0.

#### Vấn đề tồn đọng

- Q-136, Q-137, Q-138 – trạng thái: chờ xác nhận.
- `17_DAC_TA_API.md` chưa có nhóm điểm cuối cho phân hệ P03 Giảng dạy (bài học, giáo án, thời khóa biểu) – trạng thái: chờ xác nhận.

### 2026-10-09 — Chuyển sang quy trình Vibecoding_Flow và sửa các chỗ chưa khớp

#### Công việc đã thực hiện

- N9: chuyển bộ tài liệu từ `tai-lieu-thiet-ke/` sang `tai_lieu/`, đổi tên và đánh số lại theo Vibecoding_Flow, đổi phần đầu tài liệu sang mẫu mới, gộp mục lục quy trình vào `index.md`, tạo `24_YEU_CAU_THAY_DOI.md`.
- N9: sửa các chỗ chưa khớp: thuật ngữ cũ trong sơ đồ, số câu hỏi mở và giả định cũ, trạng thái mốc 0.3.0, số ứng dụng giao diện trong `13_CONG_NGHE_SU_DUNG.md`, bảng trỏ tới AC-94 đến AC-134 trong `11_TIEU_CHI_NGHIEM_THU.md`.
- N9: thống nhất phân cấp phê duyệt theo quyết định của Eric.
- Kiểm tra bằng truy vấn văn bản: không còn tên tệp cũ ngoài các mục lịch sử và bảng đối chiếu; không còn thuật ngữ "cơ sở" theo nghĩa đơn vị và "Chủ trường"; không có liên kết hỏng, hàng bảng thiếu dấu `|`, khối mã lẻ; có đủ 135 mã câu hỏi mở, sáu mã đã trả lời; đủ 84 giả định.

#### Quyết định

- Chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow – người quyết định: Eric (YCTD-01).
- Chỉ Ban Giám hiệu phê duyệt chứng từ theo hạn mức; kế toán trưởng không nằm trong luồng phê duyệt, chỉ chốt kỳ tài chính – người quyết định: Eric (YCTD-02).
- Mã dự án đổi từ SKG thành SM – người quyết định: Eric (YCTD-03, trả lời Q-132).
- Chốt kỳ tài chính do kế toán trưởng đề nghị, Hiệu trưởng phê duyệt; quản lý đơn vị không phê duyệt chứng từ thuộc danh mục hạn mức; Ban Giám hiệu phê duyệt mở lại kỳ công – người quyết định: Eric (YCTD-04, trả lời Q-133 đến Q-135).

#### Thay đổi

- Toàn bộ bộ tài liệu: đổi tên tệp theo bảng đối chiếu ở `24_YEU_CAU_THAY_DOI.md` YCTD-01; cập nhật mọi tham chiếu, trừ các mục lịch sử.
- `07_QUY_TAC_NGHIEP_VU.md`: ghi rõ chỉ Ban Giám hiệu phê duyệt chứng từ thuộc danh mục hạn mức; Hiệu trưởng phê duyệt chốt kỳ tài chính; thêm và trả lời Q-133, Q-134.
- `08_VAI_TRO_NGUOI_DUNG.md`: VT-05 mất quyền phê duyệt, thêm ghi chú 8; VT-03 chỉ phê duyệt việc không có giá trị tiền; bảng phân cấp phê duyệt mục 5 viết lại.
- `10_YEU_CAU_CHUC_NANG.md` P06-09, `16_CO_SO_DU_LIEU.md` bảng `fiscal_periods`, `17_DAC_TA_API.md` điểm cuối chốt kỳ: theo luồng đề nghị và phê duyệt chốt kỳ.
- `QT-03`, `QT-04`, `QT-05`, `QT-06` lên phiên bản 1.1: bỏ kế toán trưởng khỏi luồng phê duyệt; QT-06 thêm và trả lời Q-135; QT-05 trả lời Q-49.
- `11_TIEU_CHI_NGHIEM_THU.md` AC-35, `21_KICH_BAN_KIEM_THU.md` CT-038, `14_DAC_TA_GIAO_DIEN.md` MH-10: theo luồng phê duyệt mới.
- `04_TONG_QUAN_DU_AN.md`, `QT-01` GD-20: mã dự án SM.
- `23_LICH_SU_PHIEN_BAN.md`: thêm phiên bản 0.4.0.

#### Vấn đề tồn đọng

- Q-06: cần Eric xem lại sơ đồ chức năng để xác nhận "hình tổ màu" có phải "hình tô màu" ở P14-09 – trạng thái: chờ xác nhận. Bốn ảnh sơ đồ chức năng không có trong thư mục dự án.
- Ghi chú của công cụ khác trong `.workbuddy-ai/` vẫn trỏ đường dẫn `tai-lieu-thiet-ke/` cũ – trạng thái: chờ xác nhận có cần cập nhật không.

### 2026-10-09 — Đổi tên dự án thành School Management

**Người thực hiện:** Minh

**Nội dung:**

- Đổi tên dự án từ Sun KinderGarten thành School Management theo yêu cầu của Eric, để khớp với tên thư mục gốc `D:\School_Management`.
- Thay thế toàn bộ 43 chỗ ghi tên cũ trên 36 tệp, gồm hai mươi bốn dòng tiêu đề "Dự án:", phần thân của `01_Tong_quan_du_an.md`, `16_Cau_lenh_he_thong_AI.md` và `21_Ke_hoach_tong_the_du_an.md`, cùng cây thư mục mã nguồn dự kiến trong `10_Cong_nghe_su_dung.md`.
- Trong cây thư mục mã nguồn dự kiến, thư mục gốc đổi từ `SunKinderGarten/` thành `School_Management/`.
- Giữ nguyên phần thân của hai mục nhật ký cũ có nhắc tên cũ, vì nhật ký chỉ ghi thêm, không ghi đè. Tên cũ trong hai mục đó là ghi chép lịch sử, không phải tham chiếu còn hiệu lực.
- Cập nhật `GD-84` trong `01_Tong_quan_du_an.md` để ghi nhận tên dự án mới; đánh dấu `Q-131` đã được trả lời; thêm câu hỏi mở `Q-132` về mã dự án.
- Thêm một hàng vào bảng "Quyết định đã chốt" của `index.md`.
- Ghi phiên bản 0.3.1 vào `20_Lich_su_thay_doi.md`; thêm mã công việc `N8` vào `Checklist_cong_viec.md`.

**Tệp bị ảnh hưởng:**

- Sửa 36 tệp trong `tai-lieu-thiet-ke/`: hai mươi mốt tài liệu đánh số, `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md`, `Quy_trinh_nghiep_vu/index.md`, `Quy_trinh_nghiep_vu/Phieu_yeu_cau.md` và mười đặc tả `QT-01` đến `QT-10`.
- Không tệp nào bị đổi tên hay di chuyển.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: tên cũ chỉ còn xuất hiện ở những chỗ cố ý, gồm hai mục nhật ký lịch sử, chính mục nhật ký này, mục 0.3.1 của `20_Lich_su_thay_doi.md` và câu hỏi `Q-132`; mã `SKG` vẫn giữ nguyên tại hai mươi hai chỗ.
- Đã kiểm tra khung mã ba chấm cân bằng và không có hàng bảng thiếu dấu `|` kết thúc sau khi thay thế.

**Ghi chú:**

- Mã dự án vẫn là `SKG`, vốn là chữ viết tắt của tên cũ. Đây là điểm chưa khớp, đã ghi thành `Q-132` để Eric quyết; chưa tự đổi vì mã dự án còn được dùng trong quy tắc sinh mã trẻ tại `GD-20` của `QT-01`.
- Không đổi mã phiên bản tài liệu thành số chính vì việc đổi tên không phá vỡ nội dung nghiệp vụ, thiết kế dữ liệu hay giao diện lập trình.

### 2026-10-09 — Dời thư mục dự án sang ổ D

**Người thực hiện:** Minh

**Nội dung:**

- Dời toàn bộ thư mục dự án theo yêu cầu của Eric.
- Đường dẫn cũ: `C:\Users\vinhn\WorkBuddy AI\2026-10-09-08-11-58\SunKinderGarten\`.
- Đường dẫn mới: `D:\School_Management\`.
- Cách làm: sao chép sang ổ D trước, đối chiếu mã băm của từng tệp, xác nhận khớp hoàn toàn rồi mới xóa thư mục nguồn. Không dùng lệnh dời trực tiếp vì hai ổ khác nhau nên thao tác dời sẽ là sao chép rồi xóa, dễ mất dữ liệu nếu gián đoạn.
- Sao chép kèm thư mục `.workbuddy-ai` chứa nhật ký phiên và ghi chú dài hạn, để dự án tự chứa đủ ngữ cảnh khi mở tại vị trí mới. Thư mục `.workbuddy-ai` ở vị trí cũ vẫn giữ nguyên, không xóa.
- Thêm giả định `GD-84` và câu hỏi mở `Q-131` vào `01_Tong_quan_du_an.md`: thư mục gốc đổi tên nhưng tên sản phẩm trong tài liệu chưa đổi.

**Tệp bị ảnh hưởng:**

- Toàn bộ 36 tệp trong `tai-lieu-thiet-ke/` được dời nguyên trạng sang `D:\School_Management\tai-lieu-thiet-ke\`.
- Sửa: `01_Tong_quan_du_an.md` (thêm `GD-84`, `Q-131`), `index.md` (cập nhật số đếm giả định và câu hỏi mở), `Nhat_ky_du_an.md`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng mã băm: 36 tệp ở vị trí mới có mã băm giống từng byte so với vị trí cũ; danh sách đường dẫn tệp khớp hoàn toàn; tổng số dòng tài liệu vẫn là 6 402.
- Đã kiểm tra không có tài liệu nào chứa đường dẫn tuyệt đối tới vị trí cũ, nên việc dời không làm hỏng tham chiếu chéo. Mọi tham chiếu trong tài liệu đều là đường dẫn tương đối.

**Ghi chú:**

- Tên thư mục gốc nay là School_Management, khác tên sản phẩm Sun KinderGarten; đã ghi thành `Q-131` để Eric quyết.
- Nếu mở `D:\School_Management` làm thư mục làm việc mới, ghi chú dài hạn và nhật ký phiên nằm sẵn trong `.workbuddy-ai` ở đó.

### 2026-10-09 — Lập kế hoạch tổng thể dự án

**Người thực hiện:** Minh

**Nội dung:**

- Soạn tài liệu `21_Ke_hoach_tong_the_du_an.md`: kế hoạch tổng thể của toàn bộ dự án theo yêu cầu của Eric.
- Dựng bảng mười hai giai đoạn kèm đầu ra bắt buộc, cổng kiểm soát `CG-01` đến `CG-12` và trạng thái hiện tại của từng giai đoạn. Kết luận: dự án đang đứng ở cổng `CG-04` và `CG-05`, chưa qua được.
- Dựng bảng sáu mốc phát hành: 0.1.0, 0.2.0, 0.3.0, 1.0.0, 1.1.0, 1.2.0, gắn với ba giai đoạn sản phẩm tại `02_Pham_vi.md`.
- Dựng kế hoạch thực thi giai đoạn xây dựng thành mười hai đợt `DT-00` đến `DT-11`, mỗi đợt ghi rõ nội dung, phân hệ, mã công việc, phụ thuộc và điều kiện ra.
- Vẽ đường găng bằng sơ đồ và liệt kê bảy mắt xích đang chặn dự án, trong đó ba việc `M05`, `M06`, `M08` đang tạm dừng.
- Dựng ma trận trách nhiệm theo giai đoạn với bốn ký hiệu A, R, C, I.
- Dựng bảng ngưỡng phê duyệt thay đổi gồm sáu loại thay đổi và người phê duyệt tương ứng.
- Ghi mười hai rủi ro `RR-01` đến `RR-12` kèm mức đánh giá, ảnh hưởng và ứng phó.
- Ghi mục "Trạng thái hiện tại và việc trước mắt" với mười việc xếp theo thứ tự, ghi rõ việc nào của Eric và việc nào của Minh.
- Ghi hai giả định mới `GD-82`, `GD-83` và ba câu hỏi mở mới `Q-128` đến `Q-130`.
- Bổ sung `AI-38` và `AI-39` vào `15_Quy_tac_phat_trien_AI.md`, nguyên tắc 15 vào câu lệnh hệ thống tại `16_Cau_lenh_he_thong_AI.md`, và ba tiền tố mã `CG-xx`, `DT-xx`, `RR-xx` vào bảng quy ước mã.
- Cập nhật `index.md`: thêm tài liệu số 21, sửa số giả định từ 80 lên 83 do `GD-81` trước đây chưa được đếm, sửa số câu hỏi mở từ 127 lên 130, thêm ba hàng đếm cổng, đợt và rủi ro.
- Ghi phiên bản 0.3.0 vào `20_Lich_su_thay_doi.md`; thêm mã công việc `N7` vào `Checklist_cong_viec.md`.

**Tệp bị ảnh hưởng:**

- Tạo mới: `21_Ke_hoach_tong_the_du_an.md`.
- Sửa: `index.md`, `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md`, `20_Lich_su_thay_doi.md`, `Checklist_cong_viec.md`, `Nhat_ky_du_an.md`.

**Kết quả kiểm thử:**

- Không áp dụng. Tài liệu này là kế hoạch, chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: mã `CG-01` đến `CG-12`, `DT-00` đến `DT-11`, `RR-01` đến `RR-12` không trùng với bất kỳ tiền tố nào đã dùng; mọi bảng trong tài liệu mới đều có hàng phân cách; khối mã và sơ đồ cân bằng.

**Ghi chú:**

- Kế hoạch dùng thứ tự và điều kiện vào, điều kiện ra thay cho hạn ngày vì chưa có nguồn lực và ngày bắt đầu được xác nhận, ghi tại `GD-83` và `Q-128`.
- Tài liệu đặt trong bộ tài liệu thiết kế dưới số 21 theo quy tắc "phát sinh tài liệu mới thì đánh số tiếp theo"; xếp vào nhóm quản lý trong `index.md` vì điều phối toàn bộ vòng đời dự án.
- Ba việc Eric cần làm trước để mở đợt đầu tiên: trả lời nhóm câu hỏi ưu tiên, chốt phương án lưu trữ nhiều đơn vị và bộ công nghệ, xác nhận cách xếp ba giai đoạn.

### 2026-10-09 — Cập nhật theo bốn yêu cầu mới

**Người thực hiện:** Minh

**Nội dung:**

- Đổi vai trò Chủ trường thành Ban Giám hiệu gồm hai vai trò tách riêng: Hiệu trưởng (VT-02) và Phó Hiệu trưởng (VT-15), vì đây là trường công lập.
- Bổ sung phân cấp phê duyệt theo hạn mức: Phó Hiệu trưởng phê duyệt chứng từ dưới hạn mức, Hiệu trưởng phê duyệt từ hạn mức trở lên; thêm BR-77 đến BR-80 tại `04_Quy_tac_nghiep_vu.md` mục 12.1 và mục 5 mới trong `05_Vai_tro_nguoi_dung.md`.
- Chuyển mô hình đơn vị tổ chức từ một cấp sang ba cấp: Trường chính, Phân hiệu, Điểm trường. Cả ba cấp đều có thể có lớp; đơn vị của trẻ là đơn vị ở cấp thấp nhất nơi trẻ học.
- Thay thuật ngữ "cơ sở" bằng "đơn vị" trên toàn bộ bộ tài liệu, giữ nguyên các cụm "cơ sở dữ liệu" và "cơ sở hạ tầng". Tổng cộng sửa 31 tệp.
- Đổi bảng `branches` thành `org_units` kèm trường `unit_type` và `parent_id` tự tham chiếu; đổi cột `branch_id` thành `org_unit_id` tại `13_Luoc_do_co_so_du_lieu.md`.
- Sửa mâu thuẫn nội bộ giữa BR-01, BR-02 và GD-05 bằng cách viết lại theo mô hình ba cấp.
- Tách hoàn toàn tầng giao diện khỏi tầng máy chủ; giao diện chỉ gọi giao diện lập trình ứng dụng, không truy cập cơ sở dữ liệu. Ghi tại `09_Kien_truc_he_thong.md` mục 1 và 2, `10_Cong_nghe_su_dung.md` mục 2 và 4, `11_Dac_ta_giao_dien.md` mục 7 mới.
- Tách dịch vụ định danh độc lập tự viết khỏi máy chủ API nghiệp vụ; ghi tại `09_Kien_truc_he_thong.md` TP-11 và mục 4, `14_Dac_ta_API.md` mục 1 và 4, `19_Bao_mat.md` BM-54 đến BM-59.
- Bổ sung mã mới: BR-77 đến BR-80, GD-61 đến GD-80, Q-112 đến Q-127, AC-135 đến AC-148, CT-091 đến CT-104, PCF-11 đến PCF-13, RG-01 đến RG-06, P01-10, MH-32 và MH-33, PV-10 đến PV-12, XT-08, QU-09 và QU-10, QĐ-06 đến QĐ-10.
- Ghi phiên bản 0.2.0 vào `20_Lich_su_thay_doi.md`.

**Tệp bị ảnh hưởng:**

- Toàn bộ bộ tài liệu: `01` đến `20`, `index.md`, `Checklist_cong_viec.md`, `Nhat_ky_du_an.md` và toàn bộ thư mục `Quy_trinh_nghiep_vu/`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: không còn chỗ nào dùng "cơ sở" theo nghĩa đơn vị tổ chức; không còn "Chủ trường"; các cụm "cơ sở dữ liệu" và "cơ sở hạ tầng" giữ nguyên.

**Ghi chú:**

- Bốn quyết định này do Eric chốt ngày 09/10/2026, ghi tại `09_Kien_truc_he_thong.md` QĐ-06 đến QĐ-10.
- Mức hạn mức phê duyệt cụ thể chưa có, đã ghi thành Q-112 và Q-123.
- Số Phân hiệu và Điểm trường thực tế chưa có, đã ghi thành Q-113 và Q-122.

### 2026-10-09 — Soạn bộ tài liệu thiết kế

**Người thực hiện:** Minh

**Nội dung:**

- Phân tích nguồn đầu vào: danh sách tính năng bốn nhóm và bốn ảnh sơ đồ chức năng (Tương tác và Nội dung, Chức năng dành cho giáo viên, Chức năng dành cho phụ huynh, Chức năng dành cho kế toán) do Eric gửi.
- Xác định sản phẩm là mới hoàn toàn, không kế thừa mã nguồn của hệ thống nào; ghi nhận trong `01_Tong_quan_du_an.md` mục 1.
- Xác định 19 phân hệ, mã P01 đến P19, và xếp vào ba giai đoạn tại `02_Pham_vi.md`.
- Xác định 14 vai trò người dùng, mã VT-01 đến VT-14, kèm ma trận quyền theo phân hệ tại `05_Vai_tro_nguoi_dung.md`.
- Soạn nhóm tài liệu phân tích nghiệp vụ: `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md`.
- Soạn nhóm tài liệu thiết kế: `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md`.
- Soạn nhóm tài liệu quy tắc, kiểm thử và vận hành: `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md`.
- Soạn 10 đặc tả quy trình nghiệp vụ theo khuôn đặc tả, mã QT-01 đến QT-10, mỗi tệp đủ mười lăm mục.
- Ghi nhận 76 quy tắc nghiệp vụ, 134 tiêu chí nghiệm thu, 90 ca kiểm thử khởi đầu, 60 giả định và 111 câu hỏi mở.
- Ghi nhận ba đề xuất cần phê duyệt trước khi xây dựng: mô hình nhiều đơn vị chọn phương án tách bằng cột đơn vị, bộ công nghệ đề xuất, và cách xếp giai đoạn 1, 2, 3.

**Tệp bị ảnh hưởng:**

- Toàn bộ thư mục `tai-lieu-thiet-ke/`, gồm 20 tài liệu đánh số, ba tệp quản lý và 11 tệp trong thư mục `Quy_trinh_nghiep_vu/`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.

**Ghi chú:**

- Mọi tài liệu để ở trạng thái Chờ duyệt, chưa có nội dung nào được phê duyệt.
- Chưa xác minh được nghiệp vụ thật của trường: không có biểu mẫu, không có phỏng vấn người dùng. Đã ghi rõ ở mục "Chưa xác minh được" của từng tài liệu phân tích.
- Các điểm cần Eric quyết định trước khi chuyển bước: công thức học phí giữa tháng, mốc giảm trừ tiền ăn, mức miễn giảm và thẩm quyền phê duyệt, mốc nhắc nợ, có lập sổ kế toán kép theo Thông tư 99/2025/TT-BTC hay không, số ngày phép năm, các khoản khấu trừ trên bảng lương.

### 2026-10-09

**Người thực hiện:**

**Nội dung:**

- Khởi tạo bộ tài liệu thiết kế cho dự án Sun KinderGarten - Hệ thống quản lý trường mầm non.

**Tệp bị ảnh hưởng:**

- Toàn bộ thư mục tai-lieu-thiet-ke.

**Kết quả kiểm thử:**

- Không áp dụng.

**Ghi chú:**

- Không có.
