# Nháp tài liệu DT-15 phần 15c — Học sinh theo hệ thống của Sở: lưới học sinh, hồ sơ theo khối, điện thoại nhận tin, học 2 buổi và bán trú, biến động học sinh (YCTD-108)

## YCTD

### YCTD-108: Học sinh theo hệ thống của Sở (DT-15 phần 15c) – 2026-10-14

- Lý do: Eric quyết định ngày 2026-10-13 đồng bộ cổng quản trị theo hệ thống quản lý trường học của Sở GD&ĐT TP.HCM (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 1, 2, 3.1, 5 đợt 15c; khảo sát `31_KHAO_SAT_HE_THONG_SO.md` mục 3.4 "Học sinh"). Phần 15c đưa nhóm "4. Học sinh" theo Sở: đổi tên, cột và bộ lọc danh sách, sắp xếp A–Z, điện thoại nhận tin, đánh dấu hàng loạt học 2 buổi/ngày và bán trú, biến động học sinh. Phần này dựa trên khung chung của phần 15a (YCTD-107). Các điểm chi tiết dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi:
  - Đổi tên: màn hình "Hồ sơ trẻ" thành "4.1.1. Quản lý hồ sơ học sinh". Tiêu đề trang lấy từ cây menu, kèm số thứ bậc như của Sở. Chữ "trẻ" trên các màn hình học sinh của cổng quản trị đổi thành "học sinh", ví dụ "Lớp cho học sinh", "Học sinh là con của nhân sự trong trường", "Người được ủy quyền đón học sinh". Thông báo lỗi của máy chủ API và ứng dụng giáo viên, phụ huynh giữ nguyên.
  - Danh sách học sinh dùng lưới dữ liệu chung, khóa lưới `children`, phân trang ở máy chủ từ 10 đến 200 dòng mỗi trang. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
    - Cột hiện mặc định theo mục 4.1.1 của Sở: Mã định danh Bộ GD&ĐT (tô đỏ "Chưa có" khi trống, AC-201), Họ tên, Ngày sinh (ngày/tháng/năm), Giới tính, Dân tộc, Trạng thái, Số điện thoại liên hệ (số của phụ huynh liên hệ chính).
    - Thêm hai cột Khối, Lớp của mục 4.1.4, vì màn hình 4.1.4 gộp vào 4.1.1.
    - Cột ẩn mặc định, bật ở "Cấu hình cột hiển thị": Điện thoại nhận tin, Học 2 buổi/ngày, Bán trú, Diện chính sách, Khuyết tật, Biết bơi, Số định danh (che tám số đầu), Đơn vị.
  - Thứ tự danh sách theo mục 4.1.3 của Sở: A–Z theo tên (từ cuối của họ tên) rồi theo cả họ tên, so sánh theo thứ tự chữ cái tiếng Việt (bảng đối chiếu `vi-x-icu` của PostgreSQL). Danh sách và tệp Excel luôn theo thứ tự này. Chưa có chức năng ghi số thứ tự cố định trong lớp như của Sở.
  - Thanh công cụ của lưới:
    - "Tìm theo họ tên".
    - "Mở rộng tìm kiếm" với bộ lọc của mục 4.1.4: đơn vị, khối, lớp (khi đã chọn đơn vị), trạng thái, giới tính, dân tộc, diện chính sách, khuyết tật, học 2 buổi/ngày, bán trú, biết bơi, nhóm học sinh, mã định danh Bộ GD&ĐT, số định danh cá nhân (đủ mười hai số, so bằng mã băm), thiếu giấy khai sinh.
    - Nút Thêm mới, Cập nhật hàng loạt, Xuất Excel, Cấu hình cột hiển thị.
    - Ô chọn từng dòng; nút "Hồ sơ" trên dòng; bấm dòng cũng mở hồ sơ ngay dưới dòng.
  - Dân tộc, diện chính sách, khuyết tật, biết bơi chưa có cột riêng nên lấy từ cột CSDL ngành đã nhập (`moet_profile`, YCTD-100). Các cột này xem cùng nhóm vai trò xem sức khỏe như ở hồ sơ (BR-53). Người khác thấy ô trống, không có bộ lọc tương ứng; gọi máy chủ lọc theo dân tộc, diện chính sách, khuyết tật thì bị từ chối.
  - Xuất Excel: tệp có cột STT và đúng các cột đang hiện trên lưới, theo thứ tự đang hiện, theo bộ lọc và ô tìm kiếm đang chọn. Điều kiện xuất:
    - Cần quyền xuất dữ liệu `P17.data.export` và chỉ có học sinh trong phạm vi xem trẻ (BR-72).
    - Tối đa 10 000 dòng; nhiều hơn thì báo thu hẹp bộ lọc (lỗi quy tắc YCTD-108).
    - Mỗi lần xuất ghi một dòng nhật ký xuất (`export_logs`, mã báo cáo `children`, có dữ liệu cá nhân) trước khi trả tệp (BR-74). Nhật ký không ghi số định danh đã nhập ở bộ lọc.
  - Hồ sơ học sinh có hai thẻ:
    - "Hồ sơ học sinh" theo thứ tự ô nhập của Sở, chia khối, nhãn bên trái, nút Ghi:
      - Thông tin chung: mã định danh Bộ GD&ĐT, họ tên, ngày sinh, giới tính, trạng thái, dân tộc, số định danh cá nhân kèm nút xem đầy đủ, lớp.
      - Địa chỉ: nơi sinh, chỗ ở hiện nay.
      - Thông tin khác: học 2 buổi/ngày, học sinh lớp bán trú, diện chính sách, khuyết tật.
      - Thông tin gia đình: danh sách phụ huynh, điện thoại nhận tin.
      - Bên dưới là thông tin theo CSDL ngành (chỉ đọc).
    - "Thông tin riêng của trường": giấy khai sinh (bổ sung khi thiếu), đồng ý hình ảnh, con nhân viên, ngày nhập học, ghi chú, sức khỏe, lịch sử lớp.
    - Các thao tác gửi trình duyệt, duyệt và phân lớp, từ chối, chuyển lớp, chuyển đơn vị, thôi học, người đón nằm dưới hai thẻ như trước.
    - Hồ sơ thiếu giấy khai sinh có dòng cảnh báo ở đầu.
    - Ghi chỉ gửi các ô đã đổi. Sửa họ tên, ngày sinh, giới tính, nơi sinh, chỗ ở của học sinh đã duyệt cần nhập "Lý do sửa thông tin định danh" như QT-01 E7.
    - Người được sửa: hồ sơ nháp do người có quyền lập hồ sơ sửa; hồ sơ đã duyệt do người có quyền duyệt sửa; hồ sơ chờ duyệt chỉ xem.
  - Biểu mẫu Thêm mới theo cùng thứ tự khối: Thông tin chung (thêm ô Đơn vị), Địa chỉ, Thông tin gia đình, Thông tin riêng của trường (giấy khai sinh, sức khỏe, đồng ý hình ảnh, con nhân viên, ghi chú). Nút "Ghi" lưu hồ sơ nháp như nút "Lưu hồ sơ nháp" trước đây.
  - Điện thoại nhận tin theo mục 4.1.5 của Sở:
    - Mỗi học sinh chọn tối đa một phụ huynh có số điện thoại làm số nhận tin, ở khối Thông tin gia đình. Bỏ chọn thì về như trước.
    - Số hiện ở cột "Điện thoại nhận tin" của lưới và tệp Excel.
    - Lưu ở dòng gắn phụ huynh với học sinh (`child_guardians.receives_sms`) nên chuyển năm học cùng dòng gắn.
    - Tin nhắn SMS, Zalo gửi theo từng học sinh chỉ đi tới phụ huynh được chọn khi phụ huynh đó có tài khoản: học phí, phiếu thu, nhắc nợ qua Zalo, sự kiện y tế nặng, vắng không báo khi chốt điểm danh. Chưa chọn, hoặc phụ huynh được chọn chưa có tài khoản, thì gửi mọi phụ huynh có tài khoản như trước.
    - Thông báo trong ứng dụng vẫn gửi mọi phụ huynh.
  - Học 2 buổi/ngày, bán trú theo mục 4.1.12 của Sở:
    - Thêm hai cột của hồ sơ học sinh (`children.two_sessions_per_day`, `children.boarding`). Giá trị ban đầu lấy từ cột "Học 2 buổi/ngày", "Học sinh lớp bán trú" của tệp CSDL ngành đã nhập; nhập lại tệp ngành thì cập nhật theo tệp.
    - Sửa từng học sinh ở hồ sơ, hoặc chọn nhiều dòng rồi bấm "Cập nhật hàng loạt", chọn Giữ nguyên, Có hoặc Không cho từng thông tin, bấm Ghi.
    - Quyền như sửa hồ sơ. Có học sinh chờ duyệt thì không cập nhật học sinh nào và báo tên (lỗi quy tắc YCTD-108). Mỗi học sinh ghi một dòng nhật ký thao tác.
  - 4.2 Biến động học sinh: mục menu mới "4.2. Biến động học sinh" (`/student-movements`).
    - Danh sách dựng từ lịch sử đã có của năm học, không thêm bảng (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
      - Nhập học: ngày nhập học của hồ sơ, đến lớp đầu tiên.
      - Chuyển lớp: dòng lịch sử lớp nối tiếp dòng trước, trừ dòng do chuyển đơn vị.
      - Chuyển đơn vị: theo bảng chuyển đơn vị (P02-07).
      - Thôi học: ngày, lý do thôi học, từ lớp cuối.
    - Cột: ngày, loại biến động, mã định danh Bộ GD&ĐT, họ tên, ngày sinh, giới tính (ẩn mặc định), từ, đến, lý do. Mới nhất trước.
    - Lọc theo khoảng ngày (từ ngày, đến ngày), tìm theo họ tên, mở rộng tìm kiếm theo loại và đơn vị. Số biến động theo từng loại hiện trên lưới.
    - Lưới dùng khóa `student-movements`. Xuất Excel theo bộ lọc, ghi nhật ký xuất mã `student-movements`.
    - Ai xem được: người có quyền lập hoặc duyệt hồ sơ trẻ, trong phạm vi xem trẻ. Xuất Excel cần thêm quyền xuất dữ liệu.
    - Ghi nhận chuyển lớp, chuyển đơn vị, thôi học vẫn làm ở hồ sơ học sinh.
  - Gói giao diện dùng chung thêm `FormBlock`, `FormRow`, `FORM_CONTROL_CLASS`: khối có tiêu đề, nhãn bên trái, ô nhập bên phải; màn hình hẹp thì nhãn nằm trên. Hàm `menuPageTitle` lấy tiêu đề trang theo mục menu, giống tệp của phần 15e.
- Thành phần bị ảnh hưởng:
  - Tài liệu: `05`, `08`, `10`, `14`, `15`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `24`, `index.md`.
  - Mã nguồn: máy chủ API (hồ sơ trẻ, nhập tệp ngành, học phí, phiếu thu, nhắc nợ, y tế, điểm danh); cổng quản trị; gói giao diện dùng chung; gói dùng chung; kiểm thử đơn vị và kiểm thử giao diện.
- Dữ liệu bị ảnh hưởng: tệp `database/school-year/migrations/0050_add_student_flags_and_sms_guardian.ts`.
  - `children` thêm `two_sessions_per_day`, `boarding`, lấy giá trị ban đầu từ `moet_profile`.
  - `child_guardians` thêm `receives_sms` và chỉ mục duy nhất một dòng nhận tin mỗi học sinh.
- API bị ảnh hưởng:
  - `GET /api/v1/children` thêm bộ lọc, cột, thứ tự A–Z, cỡ trang đến 200.
  - `PATCH /api/v1/children/{id}` nhận `two_sessions_per_day`, `boarding`.
  - `GET /api/v1/children/{id}` trả `two_sessions_per_day`, `boarding`, `sms_phone` và `receives_sms` của từng phụ huynh.
  - Điểm cuối mới: `POST /api/v1/children/export`, `POST /api/v1/children/bulk-update`, `PUT /api/v1/children/{id}/sms-guardian`, `GET /api/v1/student-movements`, `POST /api/v1/student-movements/export`.
- Giao diện bị ảnh hưởng: MH-02 Quản lý hồ sơ học sinh (lưới, hồ sơ hai thẻ, biểu mẫu thêm mới); màn hình mới 4.2 Biến động học sinh; menu thêm mục 4.2; Truy cập nhanh ghim được trang 4.2. Ứng dụng giáo viên, phụ huynh không đổi.
- Quyền bị ảnh hưởng: không có mã quyền mới. Dùng lại `P02.child.manage`, `P02.approve` (sửa hồ sơ, cập nhật hàng loạt, điện thoại nhận tin, xem biến động) và `P17.data.export` (xuất Excel).
- Ảnh hưởng chức năng cũ:
  - Đường dẫn `/children` không đổi.
  - Bộ lọc Đơn vị, Trạng thái, Nhóm học sinh, Thiếu giấy khai sinh chuyển vào "Mở rộng tìm kiếm".
  - Nút "Tạo hồ sơ mới" đổi thành "Thêm mới", "Lưu hồ sơ nháp" đổi thành "Ghi".
  - Hồ sơ mở ngay dưới dòng thay cho khung bên phải.
  - Danh sách sắp xếp theo tên thay cho theo họ tên.
  - Tin nhắn theo học sinh gửi số nhận tin khi đã chọn.
- Kiểm thử cần thực hiện: CT-15c-1 đến CT-15c-14.
  - Kiểm thử đơn vị `apps/api/src/children/students-so.test.ts`.
  - Kiểm thử giao diện mới `tests/e2e/51-students-so.spec.ts`.
  - Sửa `tests/e2e/09-children.spec.ts`, `10-imports.spec.ts`, `45-moet-import.spec.ts` theo tên nút, nhãn và vị trí bộ lọc mới.
- Trạng thái: Đã triển khai

## Bảng

| Bảng | Mô tả | Cột thay đổi |
|---|---|---|
| children | Hồ sơ học sinh (cơ sở dữ liệu năm học) | two_sessions_per_day (boolean, mặc định false; học 2 buổi/ngày), boarding (boolean, mặc định false; học sinh lớp bán trú); giá trị ban đầu từ `moet_profile` (`two_sessions_per_day`, `boarding_class`) |
| child_guardians | Phụ huynh gắn với học sinh | receives_sms (boolean, mặc định false; phụ huynh có điện thoại nhận tin); chỉ mục duy nhất `child_guardians_receives_sms_unique` trên child_id khi receives_sms để mỗi học sinh tối đa một số nhận tin |

## Điểm cuối

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | /api/v1/children | Thêm tham số `gender`, `grade_level`, `ethnicity` (khớp một phần), `policy`, `disability`, `two_sessions_per_day`, `boarding`, `can_swim` (true/false), `moet_student_code` (khớp một phần), `national_id` (đủ 12 số). Giữ `org_unit_id`, `class_id`, `group_id`, `status`, `q`, `missing_birth_certificate`. `page_size` đến 200. Dòng trả thêm `org_unit_name`, `grade_level`, `grade_name`, `two_sessions_per_day`, `boarding`, `has_birth_certificate`, `ethnicity`, `policy_target`, `disability_type`, `can_swim` (null với người không xem sức khỏe), `contact_phone`, `sms_phone`; kèm `health_fields_visible`. Thứ tự A–Z theo tên rồi họ tên. Lọc theo dân tộc, diện chính sách, khuyết tật khi không được xem sức khỏe trả `ERR_FORBIDDEN` |
| POST | /api/v1/children/export | Cần `P17.data.export`. Thân: các bộ lọc như trên và `columns` (mảng mã cột không trùng: moet_student_code, full_name, dob, gender, ethnicity, status, contact_phone, grade, class, sms_phone, two_sessions_per_day, boarding, policy_target, disability_type, can_swim, national_id, org_unit; bỏ trống là 9 cột mặc định). Trả tệp xlsx, đầu `x-export-log-id`. Quá 10 000 dòng trả `ERR_RULE_VIOLATION` mã YCTD-108 |
| POST | /api/v1/children/bulk-update | Cần `P02.child.manage` hoặc `P02.approve`. Thân `child_ids` (1 đến 500 mã), `two_sessions_per_day`, `boarding` (boolean, ít nhất một). Hồ sơ nháp cần quyền lập hồ sơ ở đơn vị, hồ sơ khác cần quyền duyệt ở đơn vị. Có hồ sơ chờ duyệt trả `ERR_RULE_VIOLATION` YCTD-108 kèm tên, không cập nhật học sinh nào. Trả `updated` |
| PATCH | /api/v1/children/{id} | Nhận thêm `two_sessions_per_day`, `boarding` (boolean, không phải thông tin định danh) |
| PUT | /api/v1/children/{id}/sms-guardian | Cần `P02.child.manage` hoặc `P02.approve`; quyền như sửa phụ huynh. Thân `guardian_id` (mã phụ huynh của học sinh hoặc null để bỏ chọn; bắt buộc có trường). Phụ huynh không gắn với học sinh trả `ERR_NOT_FOUND`; phụ huynh chưa có số điện thoại trả `ERR_RULE_VIOLATION` YCTD-108. Trả hồ sơ học sinh |
| GET | /api/v1/student-movements | Cần `P02.child.manage` hoặc `P02.approve`; trong phạm vi xem trẻ. Tham số `from`, `to` (YYYY-MM-DD), `kind` (enrolled, class_transfer, unit_transfer, withdrawn), `org_unit_id`, `q`, `page`, `page_size` (10, 20, 50, 100, 200). Trả `items` (id, kind, date, child_id, full_name, dob, gender, moet_student_code, org_unit_id, from_name, to_name, reason), `total`, `total_pages`, `counts` theo loại |
| POST | /api/v1/student-movements/export | Cần `P17.data.export`. Thân là bộ lọc như trên. Trả tệp xlsx, ghi nhật ký xuất mã `student-movements` |

## Màn hình

| Mã | Màn hình | Vai trò |
|---|---|---|
| MH-02 | 4.1.1. Quản lý hồ sơ học sinh: lưới học sinh theo cột của Sở (khóa `children`), tìm theo họ tên, mở rộng tìm kiếm, Thêm mới, Cập nhật hàng loạt, Xuất Excel, cấu hình cột; hồ sơ hai thẻ "Hồ sơ học sinh" (khối, nhãn bên trái, nút Ghi, điện thoại nhận tin) và "Thông tin riêng của trường"; biểu mẫu thêm mới theo khối | Như cũ; Xuất Excel cho người có quyền xuất dữ liệu |
| (mới) | 4.2. Biến động học sinh: từ ngày, đến ngày, số biến động theo loại, lưới (khóa `student-movements`) tìm theo họ tên, mở rộng tìm kiếm theo loại và đơn vị, Xuất Excel | Người có quyền lập hoặc duyệt hồ sơ trẻ (VT-02, VT-15, VT-03, VT-12) |

Số MH của màn hình mới do người điều phối đánh khi gộp tài liệu. Cây menu thêm mục "4.2. Biến động học sinh" (`/student-movements`) trong nhóm "4. Học sinh" của phân hệ Quản lý giáo dục Mầm non.

## Quyền

| Mã | Nội dung |
|---|---|
| PQ | Không có quyền mới. Mục 4.2 hiện khi người dùng thấy nhóm học sinh và có `P02.child.manage` hoặc `P02.approve`. Nút Thêm mới theo `P02.child.manage`; nút Cập nhật hàng loạt theo `P02.child.manage` hoặc `P02.approve`; nút Xuất Excel theo `P17.data.export`. Máy chủ kiểm tra quyền và phạm vi đơn vị ở mọi yêu cầu (AI-12). Cột, bộ lọc dân tộc, diện chính sách, khuyết tật, biết bơi theo nhóm vai trò xem sức khỏe (BR-53) |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/children/students-so.test.ts` ngày 14/10/2026:

- CT-15c-1: Năm học sinh của một đơn vị có tên An, An, Ánh, Bảo, Dũng; đọc danh sách: thứ tự Bùi Văn An, Trần Thị An, Nguyễn Minh Ánh, Lê Gia Bảo, Phạm Đức Dũng; dòng có khối, lớp, số điện thoại liên hệ, dân tộc từ CSDL ngành — đạt.
- CT-15c-2: Lọc theo khối, giới tính, dân tộc, diện chính sách có và không, biết bơi, số định danh, lớp và trạng thái; cỡ trang 200: mỗi bộ lọc trả đúng học sinh — đạt.
- CT-15c-3: Bộ lọc sai (giới tính, diện chính sách, số định danh, cỡ trang 300); nhân viên tuyển sinh lọc theo dân tộc và đọc danh sách: lỗi dữ liệu 400 đủ bốn trường; lọc theo dân tộc bị từ chối 403; danh sách không có dân tộc, diện chính sách — đạt.
- CT-15c-4: Hiệu trưởng cập nhật hàng loạt học 2 buổi/ngày và bán trú cho hai học sinh, rồi sửa bán trú của một học sinh ở hồ sơ: hai học sinh được cập nhật, lọc ra đúng hai học sinh, hồ sơ đổi đúng một ô, nhật ký thao tác ghi cập nhật hàng loạt — đạt.
- CT-15c-5: Cập nhật hàng loạt có học sinh chờ duyệt, danh sách rỗng, giá trị sai, không chọn thông tin, giáo viên thực hiện: lỗi quy tắc YCTD-108 kèm tên học sinh chờ duyệt và học sinh còn lại không đổi; lỗi dữ liệu 400; giáo viên bị từ chối 403 — đạt.
- CT-15c-6: Chọn mẹ làm điện thoại nhận tin, chọn bố chưa có số, chọn phụ huynh của học sinh khác, giáo viên chọn, thiếu trường, bỏ chọn: hồ sơ và danh sách có số nhận tin; lỗi quy tắc YCTD-108; 404; 403; 400; bỏ chọn thì số nhận tin trống — đạt.
- CT-15c-7: Chọn người nhận tin nhắn khi có, không có phụ huynh được chọn, phụ huynh được chọn chưa có tài khoản: chỉ phụ huynh được chọn; không chọn hoặc chưa có tài khoản thì mọi phụ huynh có tài khoản — đạt.
- CT-15c-8: Hiệu trưởng xuất Excel khối Mầm của một đơn vị với bốn cột theo thứ tự chọn: tệp có STT và đúng bốn cột, ba học sinh theo thứ tự A–Z; nhật ký xuất mã `children`, ba dòng, có dữ liệu cá nhân, đúng đơn vị — đạt.
- CT-15c-9: Nhân viên tuyển sinh (không có quyền xuất) xuất; gửi cột lạ, cột trùng; xuất không gửi cột: bị từ chối 403; lỗi dữ liệu 400; tệp có chín cột mặc định, ngày sinh dạng ngày/tháng/năm — đạt.
- CT-15c-10: Chuyển lớp một học sinh, chuyển đơn vị một học sinh, ghi thôi học một học sinh rồi xem biến động trong ngày, theo loại, khoảng ngày khác, tìm theo tên: bốn nhập học, một chuyển lớp, một chuyển đơn vị, một thôi học với đúng lớp, đơn vị đi, đến và lý do; dòng lớp mới do chuyển đơn vị không tính thành chuyển lớp; khoảng ngày khác không có dòng — đạt.
- CT-15c-11: Bộ lọc biến động sai; giáo viên xem; xuất Excel loại chuyển lớp; không có quyền xuất: lỗi dữ liệu 400; 403; tệp có đủ cột, một dòng; nhật ký xuất mã `student-movements` có dữ liệu cá nhân; 403 — đạt.

Kiểm thử giao diện `tests/e2e/51-students-so.spec.ts` ngày 14/10/2026:

- CT-15c-12: Hiệu trưởng mở 4.1.1, tìm ba học sinh, bật cột Điện thoại nhận tin và Học 2 buổi/ngày, chọn hai dòng, cập nhật hàng loạt, mở rộng tìm kiếm theo học 2 buổi/ngày, xuất Excel: tiêu đề "4.1.1. Quản lý hồ sơ học sinh"; đủ cột của Sở; thứ tự An, Ánh, Bảo; hai học sinh có "Có"; lọc còn hai dòng; tệp có đúng các cột đang hiện và hai học sinh — đạt.
- CT-15c-13: Mở hồ sơ, chọn điện thoại nhận tin, Ghi; sửa chỗ ở không lý do rồi có lý do; mở thẻ "Thông tin riêng của trường": hồ sơ có bốn khối của Sở và cảnh báo thiếu giấy khai sinh; lưới hiện số nhận tin; thiếu lý do báo lỗi, có lý do thì ghi được; thẻ riêng có lịch sử lớp, thẻ Sở ẩn — đạt.
- CT-15c-14: Chuyển lớp một học sinh ở hồ sơ, mở 4.2, lọc theo loại, xuất Excel; giáo viên đăng nhập: có dòng chuyển lớp với lớp đi, lớp đến, lý do; lọc còn một dòng; tệp có loại "Chuyển lớp"; giáo viên không có mục 4.2 — đạt.

Sửa kiểm thử giao diện có sẵn theo tên mới: `09-children.spec.ts` (Thêm mới, biểu mẫu hồ sơ học sinh, nút Ghi, bộ lọc trạng thái trong Mở rộng tìm kiếm, "Lớp cho học sinh", tiêu đề 4.1.1), `10-imports.spec.ts` và `45-moet-import.spec.ts` (ô Thiếu giấy khai sinh trong Mở rộng tìm kiếm).

KET_QUA_TONG_HOP

## Hạn chế

- Chưa có chuyển đến, chuyển đi giữa các trường, tiếp nhận học sinh chuyển đến, duyệt chuyển đi như mục 4.2 của Sở vì hệ thống chưa liên thông với trường khác. Biến động chỉ gồm nhập học, chuyển lớp, chuyển đơn vị trong trường, thôi học của năm học đang dùng. Học sinh chuyển sang năm học mới mang theo ngày nhập học cũ.
- Biến động dựng từ lịch sử đã có. Lịch sử lớp chỉ giữ dòng gần nhất khi chuyển năm học (GD-90) nên chuyển lớp của năm cũ xem ở năm cũ. Tệp Excel biến động xuất đủ các cột, chưa theo cấu hình cột của lưới.
- Sắp xếp A–Z chỉ là thứ tự hiển thị và xuất tệp; chưa ghi số thứ tự cố định trong lớp, chưa chọn sắp xếp theo lớp như mục 4.1.3 của Sở.
- Dân tộc, diện chính sách, khuyết tật, biết bơi chỉ có khi đã nhập tệp CSDL ngành và chưa sửa được trên hồ sơ (chỉ đọc). Lọc dân tộc là khớp một phần theo chữ trong tệp.
- Điện thoại nhận tin chưa có nhập từ Excel và sửa hàng loạt như mục 4.1.5 của Sở. Tin nhắn chỉ gửi theo số nhận tin khi phụ huynh đó đã có tài khoản; tin nhắn không gắn với một học sinh (thông báo chung) không đổi.
- Chưa có nút Xuất PDF, Xuất file lỗi, Cấp mã định danh Bộ của Sở; chưa tách màn hình 4.1.2 Nhập học sinh từ Excel khỏi màn hình nhập dữ liệu chung.
- Thông báo lỗi của máy chủ API vẫn dùng chữ "trẻ" vì ứng dụng giáo viên, phụ huynh dùng chung.
