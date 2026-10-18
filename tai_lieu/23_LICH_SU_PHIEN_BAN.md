# 23. LỊCH SỬ PHIÊN BẢN

- Mô tả: Mã phiên bản, ngày phát hành, danh sách thay đổi, chức năng mới, lỗi đã sửa, thay đổi dữ liệu, thay đổi API, rủi ro, khả năng tương thích, phương án quay lui.
- Phiên bản: 0.10
- Ngày cập nhật: 2026-10-18
- Trạng thái: Đang cập nhật
- Đã rà duyệt: Eric, ngày 2026-10-09

## 1. Quy ước

1. Mỗi phiên bản phát hành ghi một mục, xếp mới nhất lên đầu.
2. Mỗi mục ghi rõ: mã phiên bản, ngày phát hành, phạm vi thay đổi, chức năng mới, lỗi đã sửa, thay đổi dữ liệu, thay đổi API, rủi ro, khả năng tương thích và phương án quay lui.
3. Phiên bản đánh số theo dạng chính.phụ.sửa. Tăng số chính khi thay đổi phá vỡ tương thích, tăng số phụ khi thêm chức năng, tăng số sửa khi sửa lỗi.
4. Bản phần mềm 1.0.0, 1.1.0, 1.2.0 được Eric nghiệm thu ngày 13/10/2026, gắn thẻ `v1.0.0`, `v1.1.0`, `v1.2.0` (YCTD-92), ứng với phiên bản tài liệu 0.31.0, 0.42.0, 0.48.0. Các mục dưới đây ghi các mốc của bộ tài liệu.
5. Từ phiên bản 0.4.0, mỗi mục ghi theo mẫu của Vibecoding_Flow; các mục trước giữ nguyên dạng bảng và tên tệp cũ vì là ghi nhận lịch sử.

## 2. Danh sách phiên bản

### Phiên bản 0.82.0 – 2026-10-18

- Phạm vi thay đổi: DT-15 phần 15f3, các phân hệ Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng; Báo cáo theo giao diện chung của Sở (YCTD-115).
- Chức năng mới: tiêu đề 8 trang của năm phân hệ có số theo menu (1. Kho và tài sản, 2. Đề nghị mua hàng, 1. Tương tác với phụ huynh, 2. Hoạt động và tin tức, 1. Bài học và giáo án, 1. Tuyển sinh, 2. Tuyển dụng, 1. Báo cáo và bảng điều khiển); 32 lưới dữ liệu dùng chung ở 8 trang (tìm kiếm, Mở rộng tìm kiếm, cấu hình cột và số dòng theo người dùng); nút Thêm mới mở biểu mẫu theo khối có nút Ghi, Hủy; lưới Danh mục tài sản có cột "Thiết bị dạy học" khi có quyền quản lý thiết bị dạy học (P03, P13 đến P18). Nghiệp vụ không đổi.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không có bảng, cột mới; cấu hình lưới mới lưu ở `user_grid_settings` sẵn có.
- Thay đổi API: không có điểm cuối mới; `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm 32 khóa lưới.
- Kiểm thử: kịch bản CT-599 đến CT-606. Kết quả: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`): 848/848 ca đạt; toàn bộ kiểm thử giao diện: 134/134 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: lưới lọc, phân trang tại chỗ nên danh sách rất dài vẫn tải một lần như trước; người dùng quen biểu mẫu luôn hiện phải bấm "Thêm mới" để mở biểu mẫu.
- Khả năng tương thích: đường dẫn, điểm cuối, quyền không đổi; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15f3`; không có tệp thay đổi cấu trúc dữ liệu; dòng cấu hình của 32 khóa lưới ở `user_grid_settings` để lại không ảnh hưởng (khóa lạ không còn được đọc).

### Phiên bản 0.81.0 – 2026-10-18

- Phạm vi thay đổi: DT-15 phần 15f2, phân hệ Nhân sự – chấm công, lương theo giao diện chung của Sở (YCTD-113).
- Chức năng mới: tiêu đề 12 trang của phân hệ có số theo menu (1.1. Chấm công đến 3.2. Đánh giá nhân sự); 17 lưới dữ liệu dùng chung ở 10 trang (tìm kiếm, Mở rộng tìm kiếm, cấu hình cột và số dòng theo người dùng); nút Thêm mới mở biểu mẫu theo khối có nút Ghi, Hủy; xóa ngày lễ, lịch học bù hoặc nghỉ bù, lịch công tác qua hộp xác nhận xóa dùng chung (P08, P09). Nghiệp vụ không đổi.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không có bảng, cột mới; cấu hình lưới mới lưu ở `user_grid_settings` sẵn có.
- Thay đổi API: không có điểm cuối mới; `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm 17 khóa lưới.
- Rủi ro: lưới lọc, phân trang tại chỗ nên danh sách rất dài vẫn tải một lần như trước; người dùng quen nút cũ phải bấm "Thêm mới" để mở biểu mẫu.
- Khả năng tương thích: đường dẫn, điểm cuối, quyền không đổi; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15f2`; không có tệp thay đổi cấu trúc dữ liệu; dòng cấu hình của 17 khóa lưới ở `user_grid_settings` để lại không ảnh hưởng (khóa lạ không còn được đọc).

### Phiên bản 0.80.1 – 2026-10-18

- Phạm vi thay đổi: 2.1 Hồ sơ lớp học, cột hiện mặc định và số dòng mỗi trang theo hệ thống của Sở (YCTD-117).
- Chức năng mới: không có.
- Lỗi đã sửa: lưới 2.1 hiện mặc định Lớp ghép, Ghép vào lớp, Lớp giải thể và ẩn Phân hiệu, Giáo viên chủ nhiệm, Điểm trường như Sở; 50 dòng mỗi trang khi người dùng chưa chọn số dòng; xuất Excel không chọn cột theo cột mặc định mới.
- Thay đổi dữ liệu: không có.
- Thay đổi API: `POST /classes/export` không gửi `columns` thì xuất 13 cột mặc định mới.
- Rủi ro: người dùng quen thấy tên giáo viên chủ nhiệm trên lưới phải bật lại cột.
- Khả năng tương thích: cấu hình cột, số dòng đã lưu của người dùng giữ nguyên; số dòng mặc định chung người dùng đã chọn vẫn được ưu tiên hơn 50; lưới khác không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh; không có thay đổi cơ sở dữ liệu.
### Phiên bản 0.80.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16k, phân hệ Quản lý kí hồ sơ theo hệ thống của Sở, bản chạy nội bộ (YCTD-130). Phần cuối của DT-16.
- Chức năng mới: phân hệ "Quản lý kí hồ sơ" trên ô chọn phân hệ: "1.1. Chứng thư số nhà trường" (thông tin chứng thư, ảnh con dấu, Đăng ký kí nội bộ), "2.1. Đồng bộ chứng thư số" (Đánh dấu đã đồng bộ), "2.2. Kí hồ sơ trường, lớp, nhân sự, học sinh" (thẻ Trường, Lớp, Nhân sự, Học sinh, Sổ đầu bài; Tạo hồ sơ PDF, Kí xác nhận nội bộ, Tải thông tin thay đổi, Hủy hồ sơ, Xuất dữ liệu sổ đầu bài), "2.3. Xác nhận hoàn thành và gửi hồ sơ" (Xác nhận hoàn thành, Hủy xác nhận, Tải tệp gửi, Đánh dấu đã gửi) (P01-28 đến P01-31). Không có chữ ký số thật.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0015_create_signing_tables` (bảng `signing_certificates`, `signing_dossiers`, `signing_events`, dãy số `signing_dossier_code`); tệp định danh `0049_add_signing_permissions` (bốn quyền P01, bỏ phân hệ mới khỏi nhóm Phụ huynh). Không có migration năm học.
- Thay đổi API: nhóm điểm cuối mới `/signing` (tài liệu 17 mục 5, mục 17); `buildPdf` của công cụ xuất dùng chung nhận thêm khổ dọc và phần cuối tài liệu.
- Kiểm thử: kịch bản CT-589 đến CT-598. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 848/848 ca đạt; toàn bộ kiểm thử giao diện 133/133 ca đạt (CI, lượt chạy 39121128162); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tệp đã kí là xác nhận trên phần mềm, không có giá trị pháp lý của chữ ký số; nội dung hồ sơ PDF chưa đối chiếu mẫu của Sở; hồ sơ không truyền lên cấp trên, người dùng nộp tệp và đánh dấu.
- Khả năng tương thích: thêm phân hệ, không đổi chức năng cũ; nhóm người dùng tự tạo thấy phân hệ mới khi có quyền (phân hệ thêm sau mặc định hiện, YCTD-120).
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16k; chạy phần quay lui của tệp hệ thống `0015` (xóa ba bảng, dãy số) và tệp định danh `0049` (xóa quyền, dòng loại trừ phân hệ). Tệp PDF, ảnh con dấu ở kho tệp (tiền tố `signing-dossier/`, `signing-seal/`) xóa tay nếu cần.

### Phiên bản 0.79.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16j, báo cáo số liệu EMIS theo hệ thống của Sở (YCTD-129).
- Chức năng mới: phân hệ "Báo cáo số liệu" đủ bảy biểu: 1.1 thêm thẻ nhập tay "Ngân sách nhà nước"; mục mới "1.2. Báo cáo cơ sở vật chất" (năm thẻ nhập tay, Lấy dữ liệu, Lấy dữ liệu năm trước), "1.3. Báo cáo sức khỏe học sinh đầu năm" (cột theo Sở), "2.1. Báo cáo EMIS cuối năm" (sáu mục I đến VI), "2.2. Báo cáo đội ngũ" (ba thẻ), "2.3. Đề án ngoại ngữ" (hai thẻ nhập tay, đánh dấu trường không có dữ liệu), "2.4. Báo cáo giáo dục mầm non cuối năm"; màn hình chung có Ghi, khóa khi đã đánh dấu đã gửi, Xuất Excel in tên đơn vị hành chính; danh sách gửi báo cáo bảy biểu kèm số đã gửi, số cần gửi, lần gửi cuối; nút "Xuất file lỗi" ở mỗi dòng biểu (P17-24 đến P17-28, sửa P17-18, P17-20, P17-22).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0059_create_emis_report_values` tạo bảng `emis_report_values`. Không có migration hệ thống, định danh.
- Thay đổi API: điểm cuối mới `GET /reports/emis/forms/{form}`, `PUT /reports/emis/forms/{form}/tabs/{tab}`, `POST /reports/emis/forms/{form}/tabs/{tab}/fill`, `POST /reports/emis/forms/{form}/export`, `POST /upper-level-submissions/{form}/error-file`; nhóm `/upper-level-submissions` nhận thêm mã sáu biểu mới; tệp gửi của 1.1 sáu trang.
- Kiểm thử: kịch bản CT-580 đến CT-588. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 832/832 ca đạt; toàn bộ kiểm thử giao diện 131/131 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tên, mã số chỉ tiêu của bảy biểu do Claude đặt, chưa đối chiếu biểu mẫu chính thức của Sở; không truyền dữ liệu lên Bộ, Sở, người dùng phải gửi tệp và đánh dấu trạng thái; 2.1, 2.4 tính tại thời điểm xem.
- Khả năng tương thích: giữ `GET /reports/emis/start-of-year`, `POST /reports/emis/start-of-year/export`, `GET /reports/emis/start-of-year-health`; trạng thái gửi đã có của 1.1 giữ nguyên (cùng mã `emis-start-of-year`); tệp Excel 1.1 thêm trang thứ sáu ở cuối, năm trang đầu như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16j; chạy phần quay lui của tệp năm học `0059` (xóa bảng `emis_report_values`). Dòng `upper_level_submissions` của sáu biểu mới không còn được đọc, xóa tay nếu cần.

### Phiên bản 0.78.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16i, cơ sở vật chất và thiết bị dạy học đủ theo hệ thống của Sở (YCTD-128).
- Chức năng mới: mục "1.2. Báo cáo cơ sở vật chất" (số liệu phòng theo khối, loại phòng và hiện trạng; nhà vệ sinh; mức độ đạt chuẩn theo khối; Xuất Excel, Xuất PDF; gửi lên cấp trên chạy nội bộ); "6.1. Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ" (lấy số liệu từ khai báo phòng, Ghi, Xuất Excel); "6.2. Nhập liệu cơ sở vật chất"; "2.2. Thiết bị ngoài danh mục tối thiểu" thành mục riêng; "2.3. Gửi thiết bị dạy học lên cấp trên" (Xuất tệp gửi, Đánh dấu đã gửi, Trường không có dữ liệu); nhập phòng và danh mục thiết bị từ Excel; thông tin nhà vệ sinh của phòng; gắn tài sản với thiết bị ở Kho.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0058_add_facilities_so_parity` tạo ba bảng `facility_investments`, `facility_standard_levels`, `facility_import_jobs`; bốn khóa nhà vệ sinh mới trong `rooms.facility_attributes` (jsonb, không đổi cấu trúc).
- Thay đổi API: điểm cuối mới `/facilities/report`, `/facilities/report/standard-levels`, `/facilities/report/export`, `/facilities/investments`, `/facilities/investments/export`, nhóm `/facility-imports`; hai biểu mẫu gửi lên cấp trên `facilities-report`, `equipment-summary`; `/rooms` nhận bốn thuộc tính nhà vệ sinh.
- Kiểm thử: kịch bản CT-572 đến CT-579. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 832/832 ca đạt; toàn bộ kiểm thử giao diện 130/130 ca đạt (CI, lượt chạy 39103041728; CT-15a-8 của `01-login.spec.ts` sửa theo nhóm menu mới "6. Cơ sở vật chất"); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: gửi lên cấp trên không truyền dữ liệu, người dùng phải nộp tệp và đánh dấu; mức độ đạt chuẩn, thuộc tính nhà vệ sinh do Claude chọn, chưa đối chiếu biểu mẫu chính thức.
- Khả năng tương thích: phòng cũ không có thuộc tính nhà vệ sinh vẫn hợp lệ; `/rooms` không gửi thuộc tính mới thì như cũ; 2.1 bỏ thẻ 2.2 nhưng dữ liệu, điểm cuối không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16i; chạy phần quay lui của tệp năm học `0058` (xóa ba bảng). Khóa nhà vệ sinh đã lưu trong `facility_attributes` khiến bản cũ từ chối khi sửa phòng đó, xóa tay các khóa này nếu quay lui.

### Phiên bản 0.77.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16e, trường, lớp và lịch năm học theo hệ thống của Sở (YCTD-127).
- Chức năng mới: 1.4 khối "Cấu hình trường" (Tên trường hiển thị, Tên đơn vị hành chính, tính cân nặng/chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân); mục "1.7. Rà soát thông tin kiểm định CLGD" (Lấy dữ liệu, Ghi); mục "1.8. Tách trường" bản chạy nội bộ (yêu cầu tách, xác nhận đi, đánh dấu đã tiếp nhận, xuất hồ sơ 82 cột, 75 cột theo mẫu CSDL ngành); 2.1 chọn nhiều lớp, Thay đổi hàng loạt, Giải thể lớp đã chọn, Xóa lớp; 2.2 bảy cột lớp theo Sở; 3.3 dòng giáo viên chưa phân công, lọc tình trạng phân công; mục "3.4. Khai báo tuần"; mục "5.7. Chuyển hồ sơ lên năm học mới" (Thực hiện, Hủy) (P01-24 đến P01-27, sửa P01-08, P01-13, P02-05).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0054_create_accreditation_reviews_and_school_splits` tạo ba bảng `accreditation_reviews`, `school_split_requests`, `school_split_items`; tệp hệ thống `0013_add_school_week_fields_and_carry_over_time` thêm `school_weeks.term_type`, `school_weeks.is_visible`, `academic_year_databases.carried_over_at`; bảng `settings` có thêm kiểu giá trị `text` và ba khóa của Trường chính, không đổi cấu trúc.
- Thay đổi API: điểm cuối mới `/academic-years/rollover/status`, `/academic-years/{id}/cancel-open`, `/classes/delete`, `/classes/bulk-update`, `/accreditation-review`, `/accreditation-review/collect`, nhóm `/school-splits`; `PUT /settings` nhận ba khóa mới; `/academic-years/{id}/weeks` thêm `term`, `term_type`, `is_visible`; `/class-assignments` lọc thêm `assignment`; nhập lớp thêm bảy cột; `/portal-context`, `/public/login-info` lấy tên trường hiển thị.
- Kiểm thử: kịch bản CT-551 đến CT-571. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 825/825 ca đạt; toàn bộ kiểm thử giao diện 129/129 ca đạt (CI, lượt chạy 39086989582); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: Hủy chuyển hồ sơ xóa cơ sở dữ liệu năm học mới, không hoàn tác được (chỉ cho khi năm mới chưa phát sinh dữ liệu); tách trường không truyền dữ liệu, người dùng phải gửi tệp và đánh dấu trạng thái; phòng bộ môn, diện tích sàn ở 1.7 do Claude chọn cách tính, chưa đối chiếu biểu mẫu kiểm định.
- Khả năng tương thích: ô cân nặng/chiều cao cho trẻ nhẹ cân mặc định bật nên 4.3.2 tính như cũ; chưa đặt tên trường hiển thị thì vẫn dùng tên Trường chính; `PATCH /academic-years/{id}/weeks` không gửi `term_type`, `is_visible` thì giữ giá trị cũ; `GET /class-assignments` không gửi `assignment` vẫn trả dòng đã phân công như cũ, thêm dòng chưa phân công khi người gọi đọc được danh bạ; năm học mở trước phần 16e không có `carried_over_at` nên không hủy được.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16e; chạy phần quay lui của tệp năm học `0054` (xóa ba bảng) và tệp hệ thống `0013` (xóa ba cột). Ba khóa cấu hình đã lưu ở bảng `settings` không còn được đọc, xóa tay nếu cần.

### Phiên bản 0.76.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16g, nhóm Học sinh của phân hệ Quản lý giáo dục Mầm non đủ theo hệ thống của Sở (YCTD-126).
- Chức năng mới: 4.1.1 có Thay đổi, Xóa hồ sơ nháp, Cấp mã định danh Bộ (ghi tay, xuất tệp 82 cột theo mẫu Bộ), Xuất file lỗi, sửa dân tộc, diện chính sách, khuyết tật, biết bơi; màn hình mới 4.1.2 Nhập học sinh từ Excel (mẫu 82 cột, kèm dữ liệu, tra cứu danh mục, đồng ý cập nhật), 4.1.3 Sắp xếp học sinh, 4.1.5 Điện thoại nhận tin của phụ huynh, 4.1.8 Thu thập, xác thực số định danh (nội bộ), 4.1.10 Tài khoản học và thi (nội bộ), 5.4 Mã định danh, mật khẩu mặc định, 5.5 Tiến độ xác thực số định danh học sinh; 4.1.11 nhập địa chỉ mới, sửa, xóa dòng đối chiếu, loại "Chuyển đến từ"; 4.2 chuyển lớp hàng loạt, chuyển đi, tiếp nhận chuyển đến (nội bộ).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0056_add_student_records_so` thêm `class_enrollments.order_number`, sáu cột của `children`, bảng `student_learning_accounts`, `student_transfers`, ba loại nhập mới của `data_import_jobs`.
- Thay đổi API: điểm cuối mới của xóa hồ sơ, mã Bộ, tệp theo mẫu Bộ, file lỗi, điện thoại nhận tin, chuyển lớp hàng loạt, thứ tự học sinh, số định danh, tài khoản học và thi, chuyển trường, công cụ nhập 82 cột, sửa, xóa dòng đối chiếu; `POST /imports/{id}/commit` nhận `confirm_update` (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-534 đến CT-550. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã 810/810 ca đạt; toàn bộ kiểm thử giao diện 122/123 ca đạt (ca hỏng là CT-15a-7 của `01-login.spec.ts`: trang đăng nhập chưa hiện kịp ở đầu lượt chạy, không liên quan phần này, đạt ở các lần chạy trước và sau; ở lần chạy khác hỏng `04-accounts` do tài khoản còn lại trong cơ sở dữ liệu định danh của lần chạy trước và CT-16a-10 do tiến trình xuất nền nhận tác vụ sớm, cũng không liên quan).
- Rủi ro: chưa có kết nối thật tới CSDL Bộ, CSDLQG về dân cư, trường khác; tài khoản học và thi chưa dùng đăng nhập được; tệp CSDL ngành cập nhật học sinh đã có cần đánh dấu đồng ý nên cách nhập cũ qua giao diện lập trình phải gửi `confirm_update`.
- Khả năng tương thích: cột mới mặc định null nên hồ sơ đã có không đổi nghĩa; hồ sơ chưa sắp xếp theo A–Z như trước; trang nhập dữ liệu chung chỉ còn công nợ đầu kỳ.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16g; chạy phần quay lui của tệp `0056` (xóa lần nhập ba loại mới, trả ràng buộc loại nhập, xóa hai bảng và các cột mới).

### Phiên bản 0.75.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16h, sức khỏe, dinh dưỡng và thống kê học sinh theo hệ thống của Sở (YCTD-125).
- Chức năng mới: mục "4.6.1. Nhập thông tin sức khỏe học sinh" theo học kỳ (cân nặng, chiều cao, giáo dục thể chất, biết bơi, bảy loại bệnh về mắt, "Lấy dữ liệu từ 4.3", Xuất Excel); 4.3.2 tổng hợp theo học kỳ, so sánh hai lần cân đo, cột "Được khám định kỳ"; 4.5 thực đơn có tên, tháng, tuần, từ ngày, đến ngày, nhiều khối áp dụng, nút "Thay đổi" cho thực đơn nháp, nhập thực đơn từ Excel bằng công cụ nhập chung; mục "5.3. Thống kê học sinh" sáu thẻ, Xuất Excel, Xuất PDF; số liệu báo cáo sức khỏe học sinh đầu năm (dòng 1.3) cho phần 16j (P10-15, P12-10, P17-21, P17-22).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0057_add_student_health_and_menu_fields` thêm sáu cột của `menus` (`name`, `month`, `week_no`, `from_date`, `to_date`, `grade_levels`; thực đơn cũ lấy giá trị từ tuần bắt đầu và độ tuổi) kèm hai ràng buộc kiểm tra, tạo hai bảng `menu_import_jobs`, `student_health_records`.
- Thay đổi API: điểm cuối mới `/student-health`, `/student-health/pull-growth`, `/student-health/export`, `/statistics/students`, `/statistics/students/export`, `/reports/emis/start-of-year-health`, `PUT /menus/{id}`, nhóm `/menu-imports`; `POST /menus` nhận thêm thông tin chung theo Sở; `GET /menus` lọc thêm `month`; `/reports/growth` nhận thêm `term`, `compare_round_id`, trả thêm `comparison` và số được khám định kỳ.
- Kiểm thử: kịch bản CT-524 đến CT-533. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 787/787 ca đạt; toàn bộ kiểm thử giao diện 115/115 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: chỉ tiêu của báo cáo sức khỏe đầu năm do Claude đặt, chưa đối chiếu biểu mẫu chính thức của Sở; con thương binh, liệt sĩ nhận biết theo chữ trong đối tượng chính sách nên có thể sót khi hồ sơ ghi cách khác.
- Khả năng tương thích: `POST /menus` vẫn nhận `week_start_date`, `age_group`; cột `age_group` giữ làm khóa không trùng; thực đơn chung và thực đơn riêng của khối cùng tuần vẫn cùng tồn tại được; `GET /statistics/children` không đổi; Y tế học đường, Thuốc và dặn thuốc đổi số mục thành 4.6.2, 4.6.3, đường dẫn giữ nguyên.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16h; chạy phần quay lui của tệp `0057` (xóa `student_health_records`, `menu_import_jobs`, hai ràng buộc và sáu cột mới của `menus`). Thực đơn lập sau khi gộp vẫn dùng được vì `week_start_date`, `age_group` vẫn được ghi.

### Phiên bản 0.74.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16f, nhóm Nhân sự của phân hệ Quản lý giáo dục Mầm non đủ theo hệ thống của Sở (YCTD-124).
- Chức năng mới: 3.1.1 có Thay đổi, Xóa hồ sơ nhập nhầm, Xuất tệp theo mẫu Bộ (75 cột kèm kiểm tra dữ liệu), Xuất file lỗi, lọc xã ĐBKK và trạng thái xác thực số định danh; hồ sơ có danh mục của Bộ, tài khoản ngân hàng, mã số thuế, xã ĐBKK; 3.1.2 Nhân sự phân hiệu; 3.1.3 Nhập nhân sự từ Excel (mẫu 75 cột kèm dữ liệu, tra cứu danh mục); 3.1.5 Xác thực số định danh nhân sự (bản chạy nội bộ: Đánh dấu đã xác thực, Đánh dấu sai thông tin); 3.2 Nhập mức đánh giá từ Excel; 3.5 Biến động nhân sự (tiếp nhận chuyển đến, duyệt chuyển đi, đi thỉnh giảng, đến thỉnh giảng, bản chạy nội bộ); 5.2 Thống kê nhân sự theo danh mục Bộ và chuẩn nghề nghiệp; 5.6 Tiến độ xác thực số định danh nhân sự; 5.9 thêm tài khoản ngân hàng, mã số thuế (P07-06 đến P07-10).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0055_add_staff_so_parity` thêm chín cột của `staff` (tài khoản ngân hàng, tên ngân hàng, mã số thuế, xã ĐBKK, trạng thái xác thực số định danh kèm ngày, người, ghi chú), tạo hai bảng `staff_branch_assignments`, `staff_movements`, cho `data_import_jobs.import_type` nhận thêm `professional_ratings`. Không đổi cơ sở dữ liệu định danh, hệ thống.
- Thay đổi API: điểm cuối mới `/staff/delete`, `/staff/ministry-export`, `/staff/ministry-errors`, `/staff/ministry-template`, `/staff/ministry-catalogs`, `/staff-branches` (bốn điểm cuối), `/staff-identity` (bốn điểm cuối), `/staff-movements` (chín điểm cuối), `/statistics/staff-so`; `/staff/search`, `/staff/export` thêm bộ lọc, cột; `PATCH /staff/{id}/profile` nhận bốn trường mới; `/imports` nhận loại `professional_ratings`; `/statistics/missing-staff-fields` thêm hai trường.
- Kiểm thử: kịch bản CT-510 đến CT-523. Kết quả ngày 17/10/2026: 10 ca kiểm thử đơn vị và 4 ca kiểm thử giao diện của phần 16f đạt; kiểm thử đơn vị toàn bộ kho mã 788/788 ca đạt; toàn bộ kiểm thử giao diện 118/118 ca đạt.
- Rủi ro: danh mục của Bộ do Claude tổng hợp, có thể lệch danh mục chính thức; duyệt chuyển đi cho nhân sự nghỉ việc, chấm dứt hợp đồng và khóa tài khoản, duyệt nhầm phải lập lại hồ sơ, hợp đồng bằng tay; tệp theo mẫu Bộ có số định danh đủ 12 chữ số nên chỉ người có quyền xuất dữ liệu tải được và mỗi lần tải ghi nhật ký xuất.
- Khả năng tương thích: các cột mới có giá trị mặc định (xã ĐBKK sai, chưa xác thực) nên hồ sơ đã có không đổi nghĩa; giá trị chữ tự do cũ của các ô nay theo danh mục vẫn giữ và hiện "(giá trị cũ, ngoài danh mục)"; phần nhập nhân sự rời khỏi 4.1.2 sang 3.1.3; 5.9 thêm hai trường; không đổi điểm cuối cũ ngoài các điểm đã nêu.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16f; chạy phần quay lui của tệp `0055` (xóa lần nhập `professional_ratings`, trả ràng buộc loại nhập, xóa hai bảng, xóa chín cột của `staff`).

### Phiên bản 0.73.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16c, khung trang và đăng nhập cổng quản trị theo hệ thống của Sở (YCTD-123).
- Chức năng mới: thanh đầu trang có tên trường, ô "Cấp MN · năm học · học kỳ", lưới ứng dụng liên kết; menu người dùng đủ bảy mục (thêm Hồ sơ nhân sự cá nhân, Hướng dẫn); hộp "Thông báo" khi vào trang (thông báo hệ thống, mật khẩu sắp hết hạn, nhắc mã định danh điện tử của tổ chức theo NĐ 69); trang đăng nhập có tên, mã trường, ghi nhớ tài khoản, mã xác nhận dạng ảnh, liên kết Quên mật khẩu, đường dây nóng; trang Quên mật khẩu gửi mã qua tin nhắn; lịch sử mật khẩu; Quản trị hệ thống thêm 3.6 Thông báo hệ thống, 3.7 Ứng dụng liên kết; 1.4 Cấu hình trường thêm khối "Đăng nhập và bảo mật" (P01-21 đến P01-23).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp định danh `0045_add_password_history_and_announcement_permission` tạo bảng `password_history`, cho `one_time_codes.purpose` nhận thêm `password_reset`, thêm quyền `P01.announcement.manage` và gán cho VT-01, VT-02; tệp hệ thống `0011_create_announcements_and_app_links` tạo hai bảng `system_announcements`, `portal_app_links`; `identity_settings` có thêm bốn khóa cấu hình đăng nhập.
- Thay đổi API: điểm cuối mới của dịch vụ định danh `/auth/login-options`, `/auth/captcha`, `/auth/password-reset/request`, `/auth/password-reset/confirm`; `login` kênh cổng quản trị nhận `captcha_id`, `captcha_text`; `/auth/settings` thêm bốn cấu hình. Điểm cuối mới của máy chủ API `/system-announcements`, `/system-announcements/{id}`, `/system-announcements/active`, `/app-links`, `/portal-context`, `/public/login-info`, `/staff/me/contact`; `PUT /school-profile` kiểm tra mã định danh điện tử 12 chữ số.
- Kiểm thử: kịch bản CT-489 đến CT-509. Kết quả ngày 17/10/2026: kiểm thử đơn vị toàn bộ kho mã 778/778 ca đạt; toàn bộ kiểm thử giao diện 114/114 ca đạt.
- Rủi ro: ảnh mã xác nhận tự sinh ở mức cơ bản, không bằng dịch vụ chuyên dụng; quên mật khẩu phụ thuộc kênh tin nhắn, chưa có thư điện tử; ghi thẻ thông tin chung của hồ sơ trường cần mã định danh điện tử đúng 12 chữ số hoặc để trống.
- Khả năng tương thích: đăng nhập cổng quản trị đòi mã xác nhận từ lần thứ tư sau ba lần sai (mặc định), ứng dụng giáo viên, phụ huynh không đổi; mã một lần của phụ huynh chỉ đọc mã mục đích đăng nhập; menu người dùng thêm hai mục; không đổi điểm cuối cũ ngoài các điểm đã nêu. Tệp `0045`, `0011` có số nhỏ hơn tệp đã gộp trước (`0046`, `0016`) nhưng vẫn chạy vì công cụ chạy tệp thay đổi cấu trúc cho chạy lệch thứ tự.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16c; chạy phần quay lui của tệp `0011` (xóa hai bảng) và `0045` (gỡ quyền, xóa mã đặt lại mật khẩu, trả ràng buộc mục đích về `login`, xóa bảng `password_history`); bốn khóa cấu hình đăng nhập ở `identity_settings` không còn được đọc, xóa thủ công nếu cần.

### Phiên bản 0.72.0 – 2026-10-17

- Phạm vi thay đổi: DT-15 phần 15h2, sửa các hạn chế của văn thư lưu trữ (YCTD-122).
- Chức năng mới: phông, hồ sơ chia theo đơn vị và lọc theo phạm vi đơn vị; người giải quyết chọn từ nhân sự; nhắc sắp đến hạn, quá hạn trong ứng dụng; nhãn và bộ lọc "Sắp đến hạn"; hàng chờ xóa lại tệp ở kho tệp (P09-06 đến P09-08).
- Lỗi đã sửa: tệp đính kèm có thể còn ở kho tệp khi kho lỗi lúc xóa.
- Thay đổi dữ liệu: tệp hệ thống `0016_add_archive_units_handlers_reminders` thêm cột `org_unit_id` (phông, hồ sơ), `handler_staff_id`, `due_reminded_at`, `overdue_reminded_at` (hồ sơ), bảng `archive_file_deletions`.
- Thay đổi API: điểm cuối mới `GET /archive-handlers`; trường và bộ lọc mới `org_unit_id`, `handler_staff_id`, `due_soon`.
- Rủi ro: người chỉ có vai trò theo đơn vị không còn thấy dữ liệu văn thư toàn trường đã nhập trước.
- Khả năng tương thích: dữ liệu cũ có đơn vị trống (toàn trường), tên người giải quyết giữ nguyên; điểm cuối cũ giữ đường dẫn và nhận thêm trường không bắt buộc.
- Phương án quay lui: hoàn lại commit gộp; chạy phần quay lui của tệp `0016` (xóa cột và bảng mới).

### Phiên bản 0.71.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16a, công cụ xuất, nhập dùng chung và mẫu gửi lên cấp trên chạy nội bộ theo hệ thống của Sở (YCTD-121).
- Chức năng mới: nút "Xuất PDF" của lưới dữ liệu dùng chung (bật ở 4.1.1, 4.1.9, 2.1, 3.3, 3.1.1); tác vụ xuất nền cho danh sách lớn và màn hình "3.5. Tệp đã tạo"; thành phần nhập Excel dùng chung với tải file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập, xuất file lỗi (MH-40, MH-92); nhập lớp học cập nhật lớp đã có; khối "Gửi lên cấp trên" ở 1.1 Báo cáo EMIS đầu năm với Xuất tệp gửi, Đánh dấu đã gửi, Gửi yêu cầu mở khóa, Mở khóa, Đặt trạng thái gửi lại (P01-20, P17-19, P17-20).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0010_create_export_jobs_and_submissions` tạo ba bảng `export_jobs`, `upper_level_submissions`, `upper_level_submission_events`. Không thêm quyền.
- Thay đổi API: điểm cuối mới `/export-jobs`, `/export-jobs/{id}/file`, `/imports/templates/{type}/columns`, `/imports/catalogs/{type}`, `/imports/{id}/error-file`, `/upper-level-submissions` và các thao tác theo biểu mẫu; điểm cuối xuất của năm danh sách nhận `format`, hai danh sách trả 202 kèm tác vụ khi lớn.
- Rủi ro: tiến trình xuất nền chạy trong máy chủ API nên tệp rất lớn dùng bộ nhớ của máy chủ API; nhập lớp học nay cập nhật lớp đã có (trước báo trùng) nên tệp cũ nhập lại sẽ ghi đè tên, sĩ số, phòng của lớp.
- Khả năng tương thích: điểm cuối cũ nhận thêm trường tùy chọn, không gửi thì như trước, trừ trả 202 thay cho 422 khi danh sách vượt 10 000 dòng; màn hình không bật Xuất PDF không đổi; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16a; chạy phần quay lui của tệp `0010` (xóa ba bảng); tệp ở kho tệp dưới khóa `export/`, `submission/` xóa thủ công nếu cần.
### Phiên bản 0.70.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16d, quản trị hệ thống đủ theo hệ thống của Sở (YCTD-120).
- Chức năng mới: 1.1 Nhóm người dùng có Hiệu lực, Sửa, Xóa; màn hình 1.2 Phân quyền nhóm theo phần mềm (phân hệ nhóm được dùng, ẩn phân hệ khỏi ô chọn phân hệ và menu); 1.4 Danh sách người dùng có Mã nhân sự, Mã Bộ, Ngày hết hạn mật khẩu, lọc Mã định danh, ngày hết hạn mật khẩu, Phân nhóm quyền, Cấp mật khẩu hàng loạt, Lấy danh sách CBQL/GV, Xuất Excel; màn hình 1.6 Tài khoản đồng bộ của Bộ, của Sở (lưu mã hóa, bản chạy nội bộ).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp định danh `0046_add_role_status_and_workspaces` thêm `roles.is_active`, bảng `role_workspace_exclusions`; tệp hệ thống `0012_add_sync_account_credentials` thêm hai loại kết nối và hai cột của `integration_credentials`.
- Thay đổi API: dịch vụ định danh thêm `PATCH, DELETE /roles/{id}`, `PUT /roles/{id}/workspaces`, `POST /users/bulk-reset-password`, `POST /users/bulk-roles`, tham số mới của `GET /users`, trường `workspaces` ở `/auth/me`; máy chủ API thêm `/account-directory`, `/account-directory/export`, `/account-directory/staff-without-account`, `/account-directory/staff-accounts`, `/sync-accounts`.
- Rủi ro: ngừng hiệu lực một nhóm đang dùng làm người dùng mất quyền ngay; thao tác hàng loạt không gộp một giao dịch.
- Khả năng tương thích: điểm cuối cũ giữ nguyên dạng trả về, chỉ thêm trường; không có mã quyền mới; nhóm cũ giữ đủ phân hệ trừ Phụ huynh; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16d; chạy phần quay lui của tệp định danh `0046` (bỏ cột, bảng) và tệp hệ thống `0012` (xóa hai loại tài khoản đồng bộ, bỏ hai cột).
### Phiên bản 0.69.0 – 2026-10-16

- Phạm vi thay đổi: DT-16 phần 16b, lưới dữ liệu chung, hộp xác nhận xóa, Xuất Excel cho các màn hình còn lại theo hệ thống của Sở (YCTD-119).
- Chức năng mới: lưới dữ liệu chung (tìm kiếm, Mở rộng tìm kiếm, cấu hình cột, số dòng mỗi trang theo người dùng, tiêu đề theo menu) cho 1.1 Khai báo cơ sở vật chất, 2.1 Tổng hợp thiết bị dạy học, 4.3.2 Tổng hợp cân nặng, chiều cao, 5.8 Thống kê hồ sơ chưa nhập đủ, 4.4 Hoàn thành chương trình, 4.1.6 Nhóm học sinh (bỏ nhiều học sinh khỏi nhóm), 3.2 Đánh giá chuẩn nghề nghiệp (lọc Loại chuẩn, Trạng thái), 4.5 Thực đơn bữa ăn, 4.6.1 Y tế học đường, 4.6.2 Thuốc và dặn thuốc, 2.1 Năm học, 2.2 Cây đơn vị (danh sách phẳng), 2.3 Phòng ban và chức danh, 2.4 Danh mục dùng chung, 2.5 Phòng học và bậc học, 3.2 Kết nối ngoài; hộp xác nhận xóa cho bỏ học sinh khỏi nhóm, bỏ món, bỏ nguyên liệu, xóa tiêu chuẩn sức khỏe, bỏ liên kết Zalo; Xuất Excel theo cột đang hiện cho 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường, 4.1.11 Cập nhật địa danh hành chính, 1.1 Nhóm người dùng (BR-117); Xuất Excel 1.4 dùng điểm cuối của phần 16d.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không có tệp thay đổi cấu trúc dữ liệu; 38 khóa lưới mới trong `DATA_GRID_KEYS` dùng cho `user_grid_settings`; các lần xuất mới ghi `export_logs`, phân hiệu, điểm trường, nhóm người dùng ghi không có dữ liệu cá nhân.
- Thay đổi API: điểm cuối mới `POST /org-units/export`, `POST /administrative-units/addresses/export`, `POST /account-exports/roles`; `/me/grid-settings/{gridKey}` nhận thêm 38 khóa lưới.
- Rủi ro: ô tìm kiếm của các lưới mới chỉ tìm trên dữ liệu đã tải.
- Khả năng tương thích: không đổi bảng, quyền, điểm cuối cũ; điểm cuối của dịch vụ định danh không đổi; cấu hình lưới đã lưu của các lưới cũ giữ nguyên; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16b; không có phần quay lui cơ sở dữ liệu; dòng `user_grid_settings` của 38 khóa mới không còn được đọc, xóa nếu cần.

### Phiên bản 0.68.0 – 2026-10-16

- Phạm vi thay đổi: DT-15 phần 15h2, văn thư lưu trữ theo hệ thống của Sở (YCTD-118).
- Chức năng mới: nhóm menu "5.10. Văn thư lưu trữ" của phân hệ Quản lý giáo dục Mầm non với bốn màn hình: 5.10.1 Hồ sơ tài liệu (hai thẻ Chưa hoàn thành, Hoàn thành; người giải quyết, thời hạn, nhãn Quá hạn; tệp đính kèm ở kho tệp; Xuất Excel), 5.10.2 Phông lưu trữ, 5.10.3 Thông tin lưu trữ (phông, giai đoạn, chỉnh lý, hết giá trị, thời hạn bảo quản, số bó, số hộp, số mét giá, nơi bảo quản), 5.10.4 Báo cáo lưu trữ cộng theo phông, giai đoạn có Xuất Excel (P09-06 đến P09-08).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0009_create_archive_tables` tạo bốn bảng `archive_fonds`, `archive_holdings`, `archive_records`, `archive_record_files`; tệp định danh `0044_add_archive_permissions` thêm ba quyền `P09.archive.view`, `P09.archive.manage`, `P09.archive.export` và gán cho VT-02, VT-04, VT-06 (đủ ba), VT-15 (xem, xuất), VT-03 (xem).
- Thay đổi API: điểm cuối mới `/archive-fonds`, `/archive-holdings`, `/archive-report`, `/archive-report/export`, `/archive-records`, `/archive-records/export`, `/archive-records/{id}`, `/archive-records/{id}/files`, `/archive-records/{id}/files/{fileId}`.
- Rủi ro: người giải quyết là chữ tự do; xóa tệp ở kho tệp sau khi xóa dòng nên lỗi kho tệp có thể để lại tệp mồ côi.
- Khả năng tương thích: không đổi bảng, điểm cuối, màn hình cũ; kho tệp thêm thao tác xóa tệp; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 15h2; chạy phần quay lui của tệp `0009` (xóa bốn bảng) và `0044` (gỡ ba quyền); tệp đính kèm đã tải lên nằm dưới khóa `archive-records/` của kho tệp, xóa thủ công nếu cần.

### Phiên bản 0.66.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15h1, cập nhật địa danh hành chính theo hệ thống của Sở (YCTD-116).
- Chức năng mới: màn hình "4.1.11. Cập nhật địa danh hành chính": lưới địa chỉ của học sinh còn theo địa danh trước sắp xếp năm 2025 ở năm loại địa chỉ của tệp CSDL ngành, địa danh mới đề xuất theo bảng đối chiếu, chọn xã mới khi xã cũ chia cho nhiều xã, chuyển hàng loạt có ghi nhật ký trước và sau; bảng đối chiếu địa danh gieo sẵn Thành phố Hồ Chí Minh theo Nghị quyết 1685/NQ-UBTVQH15 và mã số của Cục Thống kê, nhập thêm từ Excel.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp `0008_create_administrative_units` của cơ sở dữ liệu hệ thống tạo `administrative_units`, `administrative_unit_mappings` và gieo 651 đơn vị, 493 dòng đối chiếu.
- Thay đổi API: điểm cuối mới `GET /administrative-units/addresses`, `POST /administrative-units/addresses/convert`, `GET /administrative-units/mappings`, `GET /administrative-units/mappings/template`, `POST /administrative-units/mappings/import`.
- Rủi ro: danh mục chỉ có Thành phố Hồ Chí Minh; mã mới lấy từ danh mục của Cục Thống kê, chưa đọc trực tiếp phụ lục Quyết định 19/2025/QĐ-TTg; nhập lại tệp CSDL ngành ghi đè địa chỉ đã chuyển.
- Khả năng tương thích: không đổi điểm cuối, màn hình đã có; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15h1`; phần quay lui của tệp 0008 xóa hai bảng; địa chỉ đã chuyển giữ nguyên, xem giá trị cũ ở nhật ký thao tác.

### Phiên bản 0.65.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15d, nhân sự theo hệ thống của Sở (YCTD-112).
- Chức năng mới: màn hình hồ sơ nhân sự đổi tên "3.1.1. Hồ sơ cán bộ, giáo viên" với lưới theo cột của Sở (Mã định danh Bộ GD&ĐT, Mã nhân sự, Họ tên, Ngày sinh, Giới tính, Trạng thái, Dân tộc, Điện thoại, Vị trí việc làm, Nhóm chức vụ, Hình thức hợp đồng, Trình độ chuyên môn), phân trang ở máy chủ, xếp A–Z theo tên; Mở rộng tìm kiếm theo đơn vị, phòng ban, trạng thái, giới tính, vị trí việc làm, Đảng viên, tuổi từ–đến, mã định danh Bộ, số định danh (gộp mục 3.1.4 của Sở); Xuất Excel theo cột đang hiện; hồ sơ hai thẻ "Hồ sơ cán bộ, giáo viên" (bảy khối theo thứ tự cột của tệp CSDL ngành, nút Ghi) và "Thông tin riêng của trường" (thông tin của trường, tài khoản, hợp đồng, lương và phụ cấp, quá trình công tác); biểu mẫu Thêm mới theo khối (P07).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không có bảng, cột mới; các ô của Sở ghi vào `staff.moet_profile` (đã có từ tệp 0046) theo khóa của tệp CSDL ngành.
- Thay đổi API: điểm cuối mới `GET /staff/search`, `POST /staff/export`, `PATCH /staff/{id}/profile`; `GET /staff/{id}` trả thêm `moet_fields`; `GET /staff` giữ nguyên.
- Rủi ro: ô theo Sở là chữ tự do, chưa có danh mục của Bộ; nhập lại tệp CSDL ngành ghi đè các ô đã sửa ở biểu mẫu; lọc số định danh giải mã các hồ sơ cùng bốn số cuối trong phạm vi.
- Khả năng tương thích: đường dẫn `/staff`, `GET /staff`, `POST /staff`, `PUT /staff/{id}` không đổi; cấu hình cột đã lưu của lưới `staff` bỏ qua mã cột không còn dùng; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15d`; không có tệp thay đổi cấu trúc dữ liệu cần quay lui, các khóa đã ghi vào `moet_profile` vẫn đọc được ở khối "Thông tin theo CSDL ngành".

### Phiên bản 0.64.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15b, trường học, lớp học theo hệ thống của Sở (YCTD-111).
- Chức năng mới: mục "1.2. Quản lý phân hiệu" (`/branches`), "1.3. Quản lý điểm trường" (`/school-sites`) với lưới theo cột của Sở (Mã, Tên, Địa chỉ, Khoảng cách đến cơ sở chính, Diện tích, Điện thoại, Trạng thái), Thêm mới, Sửa theo biểu mẫu khối, Ngừng sử dụng, Dùng lại; "2.1. Hồ sơ lớp học" chuyển sang lưới dữ liệu chung với cột, Mở rộng tìm kiếm, Xuất Excel theo Sở và biểu mẫu theo khối có nhóm tuổi, thứ tự, học 2 buổi/ngày, lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, lớp ghép, lớp bán trú; "2.2. Nhập lớp học từ Excel" (`/class-imports`) tách khỏi màn hình Nhập dữ liệu; "3.3. Phân công phụ trách lớp" (`/class-assignments`) liệt kê, phân công, kết thúc phân công, xuất Excel; tiêu đề 1.1, 1.4 kèm số menu (P01, P02).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: cột `org_units.distance_km`, `org_units.area_m2` và `classes.age_group`, `sort_order`, `two_sessions_per_day`, `mixed_age_count`, `is_combined`, `combined_into_class_id`, `boarding` cùng ràng buộc `classes_combined_check` ở cơ sở dữ liệu năm học (tệp `database/school-year/migrations/0051_add_so_school_and_class_fields.ts`); ba cột boolean mặc định false.
- Thay đổi API: `GET`, `POST`, `PATCH /org-units` thêm `distance_km`, `area_m2`; `GET /classes` thêm bộ lọc `q`, `stage`, `age_group`, `two_sessions_per_day`, `boarding`, `is_combined` và các cột mới, thứ tự theo `sort_order` rồi mã lớp; `POST`, `PATCH /classes` nhận các ô mới; điểm cuối mới `POST /classes/export`, `GET /class-assignments`, `POST /class-assignments/export`; `DATA_GRID_KEYS` thêm `branches`, `school-sites`, `classes`, `class-assignments`.
- Rủi ro: danh sách lớp và phân công phụ trách lớp tải cả danh sách trong phạm vi rồi phân trang ở trình duyệt; nhóm tuổi chọn riêng ở lớp chưa dùng cho thống kê nên thống kê theo bậc học có thể khác cột Nhóm tuổi; mẫu nhập lớp học chưa có các ô mới.
- Khả năng tương thích: lớp đã có không có thứ tự nên vẫn xếp theo mã lớp; nhóm tuổi trống là theo bậc học như trước; đường dẫn `/classes`, `/org-units`, `/imports` không đổi, nhập lớp học chuyển sang `/class-imports`; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15b`; chạy phần quay lui của tệp 0051 của cơ sở dữ liệu năm học (gỡ hai cột của `org_units` và bảy cột của `classes`, mất khoảng cách, diện tích và thông tin lớp theo Sở đã nhập).

### Phiên bản 0.63.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15g, gửi phản hồi và hết hạn mật khẩu theo hệ thống của Sở (YCTD-110).
- Chức năng mới: nút "Gửi phản hồi" ở chân mọi trang của cổng quản trị mở hộp thoại gửi ý kiến (Đường dẫn trang, Loại ý kiến, Tiêu đề, Nội dung, Số điện thoại, Thư điện tử, Ảnh chụp màn hình), tối đa 10 ý kiến mỗi giờ mỗi tài khoản; mục "Danh sách ý kiến đã gửi" ở menu người dùng (`/my-feedback`); mục "3.4. Ý kiến phản hồi" của Quản trị hệ thống (`/feedback`) cho VT-01, VT-02 xem mọi ý kiến, đổi trạng thái (Mới, Đang xử lý, Đã xử lý), trả lời, người gửi nhận thông báo trong ứng dụng; chính sách hết hạn mật khẩu (số ngày hết hạn, số ngày báo trước) ở khối "Chính sách mật khẩu" của "1.4. Danh sách người dùng", mật khẩu quá hạn thì bắt buộc đổi ở màn hình Đổi mật khẩu, sắp hết hạn thì đầu trang báo số ngày còn lại; cột ẩn "Thời gian đổi mật khẩu" ở danh sách người dùng (P01, P19).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: bảng mới `feedback` ở cơ sở dữ liệu hệ thống (tệp `database/system/migrations/0007_create_feedback.ts`); cột `users.password_changed_at` (tài khoản đã có lấy thời điểm cập nhật gần nhất, không có thì thời điểm tạo) và quyền `P01.feedback.manage` gán VT-01, VT-02 ở cơ sở dữ liệu định danh (tệp `database/identity/migrations/0042_add_password_expiry_and_feedback_permission.ts`); khóa `password_max_age_days` (mặc định 0), `password_expiry_warning_days` (mặc định 7) ở `identity_settings`.
- Thay đổi API: điểm cuối mới `POST /user-feedback`, `GET /me/user-feedback`, `GET /user-feedback`, `PUT /user-feedback/{id}`, `GET /user-feedback/{id}/attachment`, `GET`, `PUT /auth/settings/password-policy`; `login`, `refresh`, `change-password` trả thêm `password_expired`, `password_expires_in_days`; `GET /users` trả thêm `password_changed_at`; `DATA_GRID_KEYS` thêm `my-feedback`, `feedback`.
- Rủi ro: bật chính sách hết hạn lần đầu thì tài khoản đã có tính hạn từ thời điểm cập nhật gần nhất, nhiều tài khoản có thể phải đổi mật khẩu ngay; thông báo trả lời ý kiến cần năm học đang dùng; hai màn hình ý kiến phân trang ở trình duyệt nên chậm khi số ý kiến rất lớn.
- Khả năng tương thích: chính sách hết hạn mặc định tắt (0 ngày) nên đăng nhập như cũ cho tới khi người quản trị đặt số ngày; tài khoản chỉ có vai trò Phụ huynh, tài khoản còn dùng mật khẩu mặc định chung và phiên đăng nhập bằng mã một lần không bị hết hạn mật khẩu; ứng dụng giáo viên dùng cờ `password_change_required` có sẵn nên vẫn bắt đổi mật khẩu; VT-01 có thêm quyền `P01.feedback.manage` (PQ-10); góp ý của phụ huynh ở phân hệ Tương tác (`/feedbacks`) không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15g`; chạy phần quay lui của tệp 0042 của cơ sở dữ liệu định danh (gỡ quyền `P01.feedback.manage` và cột `password_changed_at`; dòng chính sách đã lưu ở `identity_settings` còn lại nhưng không được đọc) và tệp 0007 của cơ sở dữ liệu hệ thống (gỡ bảng `feedback`, mất các ý kiến đã gửi; ảnh đính kèm còn ở kho tệp).

### Phiên bản 0.62.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15e, quản trị hệ thống theo hệ thống của Sở: nhóm người dùng, phân quyền nhóm theo menu, danh sách người dùng (YCTD-109).
- Chức năng mới: "1.1. Nhóm người dùng" trên lưới dữ liệu chung (Mã nhóm, Tên nhóm, Hiệu lực, Là nhóm quản trị, Là nhóm hệ thống), biểu mẫu thêm nhóm theo khối, nút Phân quyền trên dòng; mục mới "1.3. Phân quyền nhóm theo menu" (`/role-permissions`): chọn quyền theo cây menu đánh số, chọn cả mục hoặc từng quyền, khối Quyền khác; "1.4. Danh sách người dùng" với cột và bộ lọc theo Sở (nhóm quyền, loại tài khoản, trạng thái đổi mật khẩu, tên đăng nhập, tên nhân sự); Khóa API cho đối tác và Nhật ký thao tác dùng lưới dữ liệu chung; tiêu đề các màn hình quản trị kèm số menu; điều kiện hiện mục menu chuyển sang gói dùng chung `packages/shared/src/menu-permissions.ts` (P01, P19).
- Lỗi đã sửa: danh sách người dùng chậm khi có khoảng 30 nghìn tài khoản (dịch vụ định danh đọc mọi tài khoản cùng vai trò, quyền rồi mới cắt trang); nay lọc, đếm, phân trang trong câu truy vấn, một trang 50 dòng dưới 1,5 giây trên máy phát triển.
- Thay đổi dữ liệu: hai chỉ mục `users_full_name_id_index` (`users (full_name, id)`) và `user_roles_role_id_index` (`user_roles (role_id)`) ở cơ sở dữ liệu định danh (tệp 0041); không đổi bảng, không đổi dữ liệu.
- Thay đổi API: `GET /users` thêm tham số `login`, `full_name`, `must_change_password`, dạng trả về giữ nguyên; `GET /audit-logs`, `GET /users/audit-logs` nhận `page_size` đến 200; `DATA_GRID_KEYS` thêm `roles`, `api-clients`, `audit-logs`. Không có điểm cuối mới, không có quyền mới.
- Rủi ro: người quản trị quen ma trận quyền theo phân hệ chức năng cần làm quen chọn quyền theo cây menu; một quyền thuộc nhiều mục nên tích ở một mục làm đổi các mục khác; tìm theo từ khóa vẫn so khớp một phần, nhiều hơn 30 nghìn tài khoản cần chỉ mục trigram.
- Khả năng tương thích: đường dẫn `/roles`, `/accounts`, `/api-clients`, `/audit-logs` giữ nguyên; điểm cuối ghi quyền `PUT /roles/{id}/permissions` không đổi; kết quả hiện, ẩn mục menu như trước; cấu hình cột đã lưu của lưới `accounts` có mã cột `username` cũ thì bỏ qua mã đó; nút "Lưu quyền của vai trò", "Tạo vai trò" đổi thành "Ghi"; bộ lọc Trạng thái, Đối tượng của Nhật ký thao tác chuyển vào "Mở rộng tìm kiếm".
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15e`; chạy phần quay lui của tệp 0041 của cơ sở dữ liệu định danh để gỡ hai chỉ mục (không mất dữ liệu).

### Phiên bản 0.61.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15c, học sinh theo hệ thống của Sở: Quản lý hồ sơ học sinh, điện thoại nhận tin, học 2 buổi/ngày và bán trú, biến động học sinh (YCTD-108).
- Chức năng mới: màn hình "4.1.1. Quản lý hồ sơ học sinh" dùng lưới dữ liệu chung với cột, bộ lọc "Mở rộng tìm kiếm" theo Sở, thứ tự A–Z theo tên, Xuất Excel theo cột đang hiện; hồ sơ học sinh hai thẻ "Hồ sơ học sinh" (khối của Sở, nhãn bên trái, nút Ghi) và "Thông tin riêng của trường"; biểu mẫu Thêm mới theo khối; điện thoại nhận tin của học sinh, tin nhắn theo học sinh gửi số nhận tin; học 2 buổi/ngày, bán trú sửa ở hồ sơ hoặc cập nhật hàng loạt; mục mới "4.2. Biến động học sinh" (nhập học, chuyển lớp, chuyển đơn vị, thôi học) kèm Xuất Excel; chữ "trẻ" trên các màn hình học sinh của cổng quản trị đổi thành "học sinh" (P02, P17).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: cột mới `children.two_sessions_per_day`, `children.boarding` (giá trị ban đầu từ `moet_profile`), `child_guardians.receives_sms` và chỉ mục duy nhất `child_guardians_receives_sms_unique` ở cơ sở dữ liệu năm học (tệp 0050).
- Thay đổi API: `GET /children` thêm bộ lọc, cột, thứ tự A–Z, cỡ trang đến 200; `GET`, `PATCH /children/{id}` thêm `two_sessions_per_day`, `boarding`, `sms_phone`; thêm `POST /children/export`, `POST /children/bulk-update`, `PUT /children/{id}/sms-guardian`, `GET /student-movements`, `POST /student-movements/export`.
- Rủi ro: người dùng quen danh sách sắp theo họ tên và khung hồ sơ bên phải cần làm quen thứ tự theo tên và hồ sơ mở dưới dòng; tin nhắn theo học sinh chỉ đi tới một phụ huynh khi đã chọn số nhận tin; dân tộc, diện chính sách, khuyết tật, biết bơi trống với học sinh chưa nhập tệp CSDL ngành.
- Khả năng tương thích: đường dẫn `/children` và lối tắt Truy cập nhanh giữ nguyên; bộ lọc cũ chuyển vào "Mở rộng tìm kiếm"; nút "Tạo hồ sơ mới", "Lưu hồ sơ nháp" đổi thành "Thêm mới", "Ghi"; học sinh chưa chọn số nhận tin vẫn nhận tin như trước; thông báo lỗi của máy chủ API và ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15c`; chạy phần quay lui của tệp 0050 để gỡ ba cột và chỉ mục (mất lựa chọn số nhận tin, học 2 buổi/ngày, bán trú đã ghi sau khi phát hành).

### Phiên bản 0.60.0 – 2026-10-14

- Phạm vi thay đổi: DT-15 phần 15a, khung chung của cổng quản trị theo hệ thống của Sở: menu ngang đánh số, menu người dùng, lưới dữ liệu dùng chung, cấu hình lưới theo người dùng (YCTD-107).
- Chức năng mới: menu ngang nhiều cấp đánh số theo phân hệ thay thanh điều hướng bên trái, dùng được bằng chuột và bàn phím, cây menu gập trên màn hình hẹp; menu người dùng (Thông báo, Đổi mật khẩu, Cấu hình hiển thị lưới, Thoát); lưới dữ liệu dùng chung (tìm kiếm, mở rộng tìm kiếm, chọn dòng, cấu hình cột hiển thị, số dòng mỗi trang 10 đến 200) và hộp xác nhận xóa có ô "Tôi đã đọc và đồng ý xóa"; cấu hình lưới lưu theo tài khoản; thí điểm lưới ở Tài khoản và Hồ sơ nhân sự (P19, P01, P07).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng mới `user_grid_settings` ở cơ sở dữ liệu hệ thống (tệp 0005).
- Thay đổi API: thêm `GET`, `PUT /me/grid-settings/{gridKey}`; `GET /users` của dịch vụ định danh nhận `page_size` đến 200.
- Rủi ro: người dùng quen thanh điều hướng bên trái cần làm quen menu ngang; danh sách tài khoản ở dịch vụ định danh vẫn đọc hết rồi cắt trang nên có lúc chậm khi có rất nhiều tài khoản; menu cấp ba ở mục cuối thanh có thể tràn khỏi màn hình rộng vừa đủ.
- Khả năng tương thích: đường dẫn các trang và lối tắt Truy cập nhanh giữ nguyên; lựa chọn ẩn thanh điều hướng, nhóm thu gọn (YCTD-99) và lựa chọn "Tất cả chức năng" của ô Phân hệ (YCTD-101) không còn dùng, giá trị cũ đã lưu thì dùng phân hệ đầu tiên người dùng được thấy; gỡ vai trò ở Tài khoản thêm bước xác nhận.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15a`; bảng `user_grid_settings` để lại không ảnh hưởng.

### Phiên bản 0.59.0 – 2026-10-14

- Phạm vi thay đổi: DT-14 phần 14d, hồ sơ trường, khai báo cơ sở vật chất, thiết bị dạy học, biểu EMIS đầu năm (YCTD-106).
- Chức năng mới: hồ sơ trường sáu thẻ (P01); khai báo cơ sở vật chất theo khối phòng, loại phòng, hiện trạng kèm bảng tổng hợp, danh mục thiết bị dạy học tối thiểu và ngoài danh mục, số lượng hiện có, tổng hợp thiết bị theo định mức (P13); báo cáo EMIS đầu năm Biểu 1 năm thẻ (P17); xuất Excel kèm nhật ký xuất.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: ba bảng mới `equipment_items`, `equipment_holdings`, `school_profiles`, cột mới của `rooms` (khối, loại, hiện trạng, diện tích, thuộc tính) và `assets.equipment_item_id` (tệp 0049 của năm học); bốn quyền mới (tệp 0039 của định danh).
- Thay đổi API: thêm `/school-profile`, `/facilities/rooms`, `/facilities/rooms/export`, `/equipment-items`, `/equipment-holdings`, `/equipment-assets`, `/equipment-report`, `/equipment-report/export`, `/reports/emis/start-of-year`, `/reports/emis/start-of-year/export`; `/rooms` thêm trường khai báo cơ sở vật chất.
- Rủi ro: danh mục thiết bị tối thiểu gieo sẵn (56 thiết bị) và mã số chỉ tiêu EMIS do hệ thống đặt, cần đối chiếu văn bản; dân tộc, khuyết tật, nhóm chức vụ, đảng viên đọc từ hồ sơ CSDL ngành đã nhập (YCTD-100).
- Khả năng tương thích: chức năng cũ giữ nguyên; trường mới của phòng học không bắt buộc; mở năm học mới thêm bước chuyển hồ sơ trường, danh mục thiết bị và số hiện có.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-14-phan-14d`; bảng, cột mới để lại không ảnh hưởng.

### Phiên bản 0.58.0 – 2026-10-14

- Phạm vi thay đổi: DT-14 phần 14a, cân nặng, chiều cao theo chuẩn WHO, thống kê theo tiêu chí ngành, hồ sơ chưa nhập đủ (YCTD-105).
- Chức năng mới: đợt cân đo, nhập cân nặng, chiều cao (kể cả từ Excel), kênh tăng trưởng, biểu đồ tăng trưởng, tổng hợp cân nặng, chiều cao (P10); thống kê lớp học, học sinh, nhân sự theo tiêu chí ngành, hồ sơ học sinh, nhân sự chưa nhập đủ (P17).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng mới `growth_rounds`, cột mới `health_measurements.growth_round_id` (tệp 0048 của năm học); ba quyền mới (tệp 0038 của định danh).
- Thay đổi API: thêm `/growth-rounds`, `/children/{id}/growth`, `/reports/growth`, `/reports/growth/export`, `/statistics/classes`, `/statistics/children`, `/statistics/staff`, `/statistics/missing-child-fields`, `/statistics/missing-staff-fields`.
- Rủi ro: dân tộc, khuyết tật, trình độ và các trường tương tự đọc từ hồ sơ CSDL ngành đã nhập (YCTD-100), trường chưa nhập tệp ngành thì thống kê ở "Chưa nhập"; ngưỡng kênh cố định theo WHO.
- Khả năng tương thích: chức năng cũ giữ nguyên; mở năm học mới bỏ liên kết đợt của số đo chuyển sang.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-14-phan-14a`; bảng, cột mới để lại không ảnh hưởng.

### Phiên bản 0.57.0 – 2026-10-13

- Phạm vi thay đổi: DT-14 phần 14c, hoàn thành chương trình mầm non, chuẩn nghề nghiệp, nhóm học sinh (YCTD-104).
- Chức năng mới: hoàn thành chương trình mầm non, nhóm học sinh (P02), đánh giá chuẩn nghề nghiệp giáo viên, hiệu trưởng (P07).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tám bảng mới của năm học (tệp 0047); năm quyền mới (tệp 0037 của định danh).
- Thay đổi API: thêm `/program-completion`, `/child-groups`, `/professional-standards`, `/professional-criteria`, `/professional-evaluations`, `/me/professional-evaluation`; `GET /children` thêm lọc `group_id`.
- Rủi ro: tên tiêu chí gieo sẵn và quy tắc xếp loại cần đối chiếu Thông tư 25, 26/2018/TT-BGDĐT.
- Khả năng tương thích: chức năng cũ giữ nguyên.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-14-phan-14c`; các bảng mới để lại không ảnh hưởng.

### Phiên bản 0.56.0 – 2026-10-13

- Phạm vi thay đổi: DT-14 phần 14b, năm học ở thanh đầu trang và Truy cập nhanh (YCTD-102).
- Chức năng mới: ô năm học, học kỳ ở thanh đầu trang; Truy cập nhanh trên trang chủ (P01).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `user_quick_links` ở cơ sở dữ liệu hệ thống (tệp 0004).
- Thay đổi API: thêm `GET`, `PUT /me/quick-links`.
- Rủi ro: học kỳ hiện tại tính theo đồng hồ trình duyệt; năm học đã đóng chưa xem được.
- Khả năng tương thích: chức năng cũ giữ nguyên; người dùng chưa ghim thì vùng Truy cập nhanh trống.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-14-phan-14b`; bảng `user_quick_links` để lại không ảnh hưởng.

### Phiên bản 0.55.0 – 2026-10-13

- Phạm vi thay đổi: DT-13 phần 13c, báo cáo điểm danh và suất ăn theo ngày, tuần, tháng (YCTD-103).
- Chức năng mới: báo cáo điểm danh và suất ăn, xuất Excel theo mẫu của trường, suất ăn cho bếp (P17-02, P12).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `GET /reports/attendance-meals`, `GET /reports/attendance-meals/children`, `POST /reports/attendance-meals/export`, `GET /kitchen/meal-counts`.
- Rủi ro: mã B suy từ lý do vắng có từ chỉ bệnh, có thể sót khi lý do ghi khác.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-13-phan-13a`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.54.0 – 2026-10-13

- Phạm vi thay đổi: DT-13 phần 13a, nhập thẳng tệp học sinh, cán bộ theo mẫu CSDL ngành (YCTD-100).
- Chức năng mới: nhập tệp học sinh, cán bộ theo mẫu CSDL ngành, lưu đủ mọi cột (P01-13, P02-12, P07).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp 0045, 0046 của năm học: hồ sơ ngành của trẻ và nhân sự, năm sinh và số định danh của người thân, bản xem trước của lượt nhập.
- Thay đổi API: loại nhập `moet_children`, `moet_staff`; tải tệp nhận `org_unit_id`.
- Rủi ro: giá trị danh mục chưa đối chiếu danh mục của Bộ; nhập lại thay toàn bộ hồ sơ ngành.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-13-phan-13a`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.53.0 – 2026-10-13

- Phạm vi thay đổi: DT-12 phần 12d, cấu hình triển khai môi trường chạy thật (YCTD-98).
- Chức năng mới: cấu hình triển khai Docker Compose, sao lưu và khôi phục, hướng dẫn triển khai (XT-04, SL-01 đến SL-05).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: chưa thử trên máy chủ thuê với tên miền và HTTPS thật.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-phan-12d`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.52.0 – 2026-10-13

- Phạm vi thay đổi: DT-12 phần 12c, Fanpage và Zalo Official Account chạy thật (YCTD-95).
- Chức năng mới: kiểm tra kết nối Fanpage, Zalo, làm mới khóa Zalo tự động (P14-08, G3-08).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `integration_credentials` của cơ sở dữ liệu hệ thống (tệp 0003).
- Thay đổi API: thêm `POST /api/v1/integrations/facebook/test`, `POST /api/v1/integrations/zalo/test`, `PUT /api/v1/integrations/zalo/refresh-token`.
- Rủi ro: chưa thử với Fanpage và Official Account thật; đổi `CHILD_DATA_ENCRYPTION_KEY` thì phải dán lại khóa làm mới Zalo.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-phan-12c`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.51.0 – 2026-10-13

- Phạm vi thay đổi: DT-12 phần 12b, cổng thanh toán PayOS, SePay, Casso, VNPay (YCTD-94).
- Chức năng mới: bốn cổng thanh toán trực tuyến và điểm cuối nhận thông báo tiền vào (P06-11).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `POST /api/v1/payment-webhooks/payos`, `/sepay`, `/casso` và `GET /api/v1/payment-webhooks/vnpay-ipn`.
- Rủi ro: chưa thử với tài khoản thật của bốn nhà cung cấp; cần thử trên môi trường thử của từng nhà cung cấp trước khi chạy thật.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-phan-12b`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.50.0 – 2026-10-13

- Phạm vi thay đổi: DT-12 phần 12a, nối nhà cung cấp tin nhắn eSMS.vn (YCTD-93).
- Chức năng mới: gửi mã đăng nhập một lần và tin nhắn thông báo qua eSMS.vn (P19-06, XT-09).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: chưa thử với tài khoản eSMS.vn thật; tên thương hiệu và mẫu tin cần đăng ký trước.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-phan-12a`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.49.0 – 2026-10-13

- Phạm vi thay đổi: Eric nghiệm thu ba bản 1.0.0, 1.1.0, 1.2.0; quyết định G3-04; chọn nhà cung cấp; lập đợt DT-12 (YCTD-92).
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: các bản đã nghiệm thu chưa chạy thật trên máy chủ đám mây (việc T6).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-ke-hoach`.

### Phiên bản 0.48.0 – 2026-10-11

- Phạm vi thay đổi: DT-11, báo cáo kiểm thử giai đoạn 3, bản ứng viên phát hành 1.2.0 (YCTD-91).
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: các giới hạn đã biết ở mục 6 của `30_BAO_CAO_KIEM_THU_G3.md`.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-bao-cao-g3`.

### Phiên bản 0.47.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11c, sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp (YCTD-88).
- Chức năng mới: P06-12 (mới) trên máy chủ API và cổng quản trị (MH-67, MH-68, MH-69).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bốn bảng sổ kế toán của năm học kèm danh mục tài khoản và quy tắc ghi sổ khởi tạo (tệp 0042).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: danh mục tài khoản khởi tạo cần kế toán trưởng đối chiếu văn bản gốc; kết chuyển theo năm học, không theo năm dương lịch.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11c`; chạy ngược tệp 0042 của cơ sở dữ liệu năm học.

### Phiên bản 0.46.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11d, nhập sao kê ngân hàng, đối soát tự động, nhiều cổng thanh toán (YCTD-89).
- Chức năng mới: P06-06, P06-11 trên máy chủ API và cổng quản trị (MH-70, MH-11).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `bank_statement_profiles`, `bank_statement_imports` của năm học (tệp 0043); cột `cash_accounts.payment_provider`, `bank_bin`, `bank_statement_lines.import_id`, `suggested_invoice_id`; cấu hình đơn vị `bank_match_days`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: cấu hình cột sai làm đọc sai sao kê; chỉ đọc tệp .xlsx và CSV mã UTF-8.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11d`; chạy ngược tệp 0043 của cơ sở dữ liệu năm học.

### Phiên bản 0.45.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11a, tuyển sinh trực tuyến và tin tuyển sinh (YCTD-86).
- Chức năng mới: P16-01 đến P16-05 trên máy chủ API, cổng quản trị (MH-26, MH-63), trang tuyển sinh trực tuyến công khai trên ứng dụng phụ huynh (MP-21).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: ba bảng tuyển sinh của năm học (tệp 0040).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: điểm cuối công khai giới hạn số lần gọi trong bộ nhớ của từng máy chủ, cần bộ nhớ chung khi chạy nhiều máy chủ (việc T6); chuyển hồ sơ gồm nhiều bước không chung một giao dịch, lỗi duyệt để lại hồ sơ trẻ chờ duyệt.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11a`; chạy ngược tệp 0040 của cơ sở dữ liệu năm học.

### Phiên bản 0.44.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11b, tuyển dụng: đề nghị, tin, ứng viên, phỏng vấn (YCTD-87).
- Chức năng mới: P18-01 đến P18-04 trên máy chủ API, cổng quản trị (MH-27), trang tuyển dụng công khai trên ứng dụng phụ huynh (MH-65).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bốn bảng tuyển dụng của năm học (tệp 0041); thêm mục đích tệp `candidate_cv`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: điểm cuối công khai giới hạn số lần gọi trong bộ nhớ của từng máy chủ, cần bộ nhớ chung khi chạy nhiều máy chủ (việc T6).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11b`; chạy ngược tệp 0041 của cơ sở dữ liệu năm học.

### Phiên bản 0.43.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11e, kết nối Facebook, Fanpage và Zalo Official Account (YCTD-90).
- Chức năng mới: P14-08, kênh Zalo của trung tâm thông báo (P19-04) và nhắc nợ (P05-10) trên máy chủ API và cổng quản trị (MH-71, MH-23).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `integration_settings`, `zalo_followers`, `facebook_posts` của năm học (tệp 0044); kênh `zalo` và cột `delivered_via` ở `notification_recipients`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: bộ chuyển đổi Graph API và Zalo Official Account thật chưa chạy với tài khoản thật; khóa truy cập chỉ đặt ở biến môi trường.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11e`; chạy ngược tệp 0044 của cơ sở dữ liệu năm học.

### Phiên bản 0.42.0 – 2026-10-11

- Phạm vi thay đổi: DT-10, báo cáo kiểm thử giai đoạn 2, bản ứng viên phát hành 1.1.0 (YCTD-84).
- Chức năng mới: không; bổ sung ca kiểm thử cho CT-041, CT-083, CT-085.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: các giới hạn đã biết ở mục 6 của `29_BAO_CAO_KIEM_THU_G2.md`.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-bao-cao-g2`.

### Phiên bản 0.41.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10i, nhắc nợ, xử lý công nợ quá hạn, đối chiếu ngân hàng, công nợ phải trả, chốt kỳ tài chính (YCTD-82).
- Chức năng mới: P05-10, P05-12, P06-06, P06-07, P06-09 trên máy chủ API và cổng quản trị (MH-08, MH-11, MH-61, MH-62).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: năm bảng của năm học (tệp 0038); không thêm cột vào bảng có sẵn.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: kỳ đã chốt chặn lập và sửa chứng từ của kỳ; chưa có thao tác mở lại kỳ đã chốt.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10i`; chạy ngược tệp 0038 của cơ sở dữ liệu năm học.

### Phiên bản 0.40.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10h, công việc, kế hoạch, đánh giá nhân sự, quá trình công tác, thưởng và khấu trừ (YCTD-81).
- Chức năng mới: P09-01 đến P09-05, P07-03, P08-07 trên máy chủ API, cổng quản trị (MH-58, MH-59, MH-60, MH-12, MH-44), ứng dụng giáo viên (MG-12).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười bảng của năm học (tệp 0037); phiếu lương có thêm dòng thưởng và khấu trừ.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: khoản thưởng, khấu trừ ghi khi bảng lương còn nháp cần tính lại bảng lương; quyết toán nghỉ việc chưa gồm thưởng.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10h`; chạy ngược tệp 0037 của cơ sở dữ liệu năm học.

### Phiên bản 0.39.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10j, báo cáo hoạt động và công việc, báo cáo hợp nhất, xuất dữ liệu (YCTD-83).
- Chức năng mới: P17-10, P17-11, P17-12 trên máy chủ API và cổng quản trị (MH-28, MH-29).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `export_logs` của năm học (tệp 0039).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: báo cáo hợp nhất tính trực tiếp từ dữ liệu gốc, chưa dùng số liệu tổng hợp sẵn; tháng có nhiều dữ liệu có thể chậm.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10j`; chạy ngược tệp 0039 của cơ sở dữ liệu năm học.

### Phiên bản 0.38.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10g, giảng dạy: bài học, giáo án, thời khóa biểu, kế hoạch, tiến độ học tập (YCTD-80).
- Chức năng mới: P03-01 đến P03-08 (trừ tổ chuyên môn) trên máy chủ API, cổng quản trị (MH-57), ứng dụng giáo viên (MG-05, MG-06), ứng dụng phụ huynh (MP-04, MP-05).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười bảng giảng dạy của năm học (tệp 0036).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: tổ trưởng chuyên môn xem theo đơn vị được gán vì chưa có bảng tổ chuyên môn.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10g`; chạy ngược tệp 0036 của cơ sở dữ liệu năm học.

### Phiên bản 0.37.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10f, tương tác với phụ huynh và đồ bị mất của trẻ (YCTD-79).
- Chức năng mới: P15-01 đến P15-06 và P02-11 trên máy chủ API, cổng quản trị (MH-25), ứng dụng giáo viên (MG-08, MG-15), ứng dụng phụ huynh (MP-09, MP-10, MP-17, MP-19).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười ba bảng tương tác và đồ bị mất của năm học (tệp 0035).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: trao đổi không theo thời gian thực, phụ huynh và giáo viên tải lại để thấy tin mới; chưa nhận ảnh đồ bị mất và tệp đính kèm tin nhắn.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10f`; chạy ngược tệp 0035 của cơ sở dữ liệu năm học.

### Phiên bản 0.36.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10e, hoạt động, hình ảnh, tin tức, thư viện, ngoại khóa (YCTD-78).
- Chức năng mới: P14-01 đến P14-12 trên máy chủ API, cổng quản trị (trang Hoạt động và tin tức), ứng dụng giáo viên (hoạt động lớp), ứng dụng phụ huynh (hoạt động, tin tức).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: các bảng hoạt động, nội dung, bình luận, ngoại khóa của năm học (tệp 0034); thêm mục đích tệp `activity_photo`, `content_file`; thêm loại dòng hóa đơn `extracurricular` và cột `invoice_items.extracurricular_registration_id`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: phí ngoại khóa đi vào lần tính học phí; đăng ký sau khi hóa đơn chính đã phát hành sinh hóa đơn bổ sung.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10e`; chạy ngược tệp 0034 của cơ sở dữ liệu năm học.

### Phiên bản 0.35.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10c, bếp, thực đơn, định lượng và báo cáo ăn (YCTD-76).
- Chức năng mới: P12-01 đến P12-09 và P17-08 trên máy chủ API, cổng quản trị (MH-18, MH-38), ứng dụng giáo viên (MG-14), ứng dụng phụ huynh (MP-15).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười một bảng bếp của năm học (tệp 0032).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: số suất tạm trước khi chốt điểm danh có thể khác số chính thức; báo cáo ăn và bếp chỉ ra ngày lệch.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10c`; chạy ngược tệp 0032 của cơ sở dữ liệu năm học.

### Phiên bản 0.34.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10b, thuốc: danh mục, dặn thuốc, cho uống, mua và cấp thuốc (YCTD-75).
- Chức năng mới: P10-02, P10-03, P10-04, P10-05, P10-09 trên máy chủ API, cổng quản trị (MH-17), ứng dụng giáo viên (MG-09 phần dặn thuốc), ứng dụng phụ huynh (MP-07, MP-08 phần bỏ liều).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tám bảng thuốc của năm học (tệp 0031); thêm mục đích tệp `medicine_photo`, `prescription`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: giáo viên chủ nhiệm chỉ nhận thuốc khi đơn vị bật cấu hình không có nhân viên y tế; cấu hình sai thì không ai nhận được yêu cầu.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10b`; chạy ngược tệp 0031 của cơ sở dữ liệu năm học.

### Phiên bản 0.33.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10d, kho, tài sản, mua hàng (YCTD-77).
- Chức năng mới: P13-01 đến P13-10 trên máy chủ API và cổng quản trị (MH-20, MH-21, MH-22).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười ba bảng kho, tài sản, mua hàng của năm học (tệp 0033).
- Thay đổi API: nhóm điểm cuối kho, tài sản, mua hàng trong `17`.
- Rủi ro: thanh toán phiếu mua hàng phụ thuộc kế toán gắn phiếu chi; phiếu chưa gắn vẫn ở trạng thái chờ thanh toán.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10d`; chạy ngược tệp 0033 của cơ sở dữ liệu năm học.

### Phiên bản 0.32.0 – 2026-10-11

- Phạm vi thay đổi: kế hoạch DT-10 (YCTD-73); DT-10 phần 10a, y tế học đường phần hồ sơ, khám, sự kiện, chăm sóc, báo cáo (YCTD-74).
- Chức năng mới: P10-01, P10-06, P10-07, P10-08, P10-10, P10-11, P10-12 trên máy chủ API, cổng quản trị (MH-16), ứng dụng giáo viên (MG-09), ứng dụng phụ huynh (MP-08).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tám bảng y tế của năm học; ba quyền P10.
- Thay đổi API: các điểm cuối y tế trong `17`.
- Rủi ro: tiêu chuẩn sức khỏe do y tế nhập tay theo văn bản của Bộ Y tế, nhập sai thì đánh giá sai.
- Khả năng tương thích: kế toán trưởng không còn thấy mục sức khỏe trong chi tiết hồ sơ trẻ (BR-53).
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10a`; chạy ngược tệp 0030 của cơ sở dữ liệu năm học và 0031 của định danh.

### Phiên bản 0.31.0 – 2026-10-11 (ứng viên phát hành 1.0.0)

- Phạm vi thay đổi: DT-09 phần 9g, báo cáo cổng CG-10 và bản ứng viên phát hành 1.0.0 (YCTD-72).
- Chức năng mới: không; toàn bộ chức năng G1 đã có ở các phiên bản 0.25.x đến 0.30.9.
- Lỗi đã sửa: tài liệu CTC-P06-050 và quyền của P06-08 lệch PQ-35.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: chưa nối nhà cung cấp tin nhắn và thanh toán thật (T1); chưa chạy kiểm thử hiệu năng và phục hồi trên môi trường thật (T6).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: bản ứng viên chưa triển khai; khi triển khai, quay lui bằng bản sao lưu cơ sở dữ liệu trước triển khai và bản dựng trước đó.

### Phiên bản 0.30.9 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9f, tiến trình gửi thông báo, gửi lại khi lỗi, giới hạn tin nhắn trong ngày, nhắc ghi nhật ký (YCTD-71).
- Chức năng mới: tiến trình nền CB-05, CB-07 trong máy chủ API; cấu hình `journal_reminder_time`.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `notification_recipients` thêm cột theo dõi lần gửi và trạng thái `limited`.
- Thay đổi API: không thêm điểm cuối; biến môi trường mới `NOTIFICATION_DISPATCH_INTERVAL_SECONDS`.
- Rủi ro: chưa nối nhà cung cấp tin nhắn thật (T1), tin nhắn chỉ ghi ra nhật ký máy chủ.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9f`; chạy ngược tệp 0029 của cơ sở dữ liệu năm học.

### Phiên bản 0.30.8 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9e, sĩ số tối đa và nhật ký truy cập theo cấu hình, báo cáo thu chi theo nhóm và theo tháng (YCTD-70).
- Chức năng mới: `GET /data-access-logs`; bảng theo nhóm và theo tháng của báo cáo thu chi.
- Lỗi đã sửa: cấu hình `max_class_size` và `data_access_logging` trước đây lưu được nhưng không có tác dụng.
- Thay đổi dữ liệu: không.
- Thay đổi API: báo cáo thu chi có `groups`, `periods`.
- Rủi ro: bật ghi nhật ký truy cập làm tăng số dòng nhật ký; giữ tối thiểu 24 tháng (BM-70).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9e`.

### Phiên bản 0.30.7 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9d, chuyển trẻ, phụ huynh, lớp đang học, quỹ, công nợ sang năm học mới; kiểm tra BR-89, BR-94 (YCTD-69).
- Chức năng mới: hai bước chuyển năm học `children` và `finance`; mẫu thông báo chuyển cùng cấu hình.
- Lỗi đã sửa: mở năm học mới trước đây không chuyển trẻ, lớp, quỹ, công nợ, mẫu thông báo và không kiểm tra BR-89.
- Thay đổi dữ liệu: `receipts.carried_over`.
- Thay đổi API: mở năm học trả thêm mã BR-94; phiếu thu có `carried_over`.
- Rủi ro: mở năm học là thao tác một chiều; cần sao lưu trước khi mở (RR-13).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9d`; chạy ngược tệp 0028 của cơ sở dữ liệu năm học.

### Phiên bản 0.30.6 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9c, lịch nghỉ và lịch công tác (YCTD-68).
- Chức năng mới: P08-02 trên máy chủ API, cổng quản trị (MH-56), ứng dụng giáo viên (MG-10).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `work_schedules`; quyền `P08.work-schedule.manage`.
- Thay đổi API: năm điểm cuối lịch công tác; bảng công tính ngày công tác đã công bố.
- Rủi ro: ngày công tác không chấm công được tính đủ giờ chuẩn nên lịch phải lập đúng trước khi chốt công.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9c`; chạy ngược tệp 0027 của cơ sở dữ liệu năm học và 0030 của cơ sở dữ liệu định danh.

### Phiên bản 0.30.5 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9b, chuyển đơn vị, thôi học, đồng ý hình ảnh, cờ trẻ con nhân viên (YCTD-67).
- Chức năng mới: P02-07, P02-08, P02-09 trên máy chủ API, cổng quản trị, ứng dụng phụ huynh.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `child_unit_transfers`.
- Thay đổi API: năm điểm cuối mới của hồ sơ trẻ.
- Rủi ro: tính học phí tháng thôi học phụ thuộc ngày thôi học nhập đúng.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9b`; chạy ngược tệp thay đổi cấu trúc 0026 của cơ sở dữ liệu năm học.

### Phiên bản 0.30.4 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9a, kiểm thử bổ sung và ghi kết quả (YCTD-66).
- Chức năng mới: không.
- Lỗi đã sửa: nhật ký duyệt, từ chối phiếu chi thiếu giá trị chứng từ (BR-80).
- Thay đổi dữ liệu: không.
- Thay đổi API: không đổi giao kèo.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9a`.

### Phiên bản 0.30.3 – 2026-10-11

- Phạm vi thay đổi: DT-08 phần 8b, nhật ký của bé (YCTD-65).
- Chức năng mới: giáo viên chủ nhiệm ghi và công bố nhật ký của bé; phụ huynh xem nhật ký đã công bố của con.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `daily_journals`, `journal_amendments`.
- Thay đổi API: nhóm điểm cuối nhật ký.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-08-phan-8b`; chạy ngược tệp thay đổi cấu trúc 0025 của cơ sở dữ liệu năm học.

### Phiên bản 0.30.2 – 2026-10-11

- Phạm vi thay đổi: DT-08 phần 8a, trung tâm thông báo và mẫu thông báo (YCTD-64).
- Chức năng mới: thông báo của tôi trên ba kênh giao diện, đánh dấu đã đọc, ai đã đọc, mẫu thông báo.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `notification_reads`, `notification_templates`; hai mã quyền P19.
- Thay đổi API: nhóm điểm cuối `/notifications`, `/notification-templates`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-08-phan-8a`; chạy ngược tệp thay đổi cấu trúc 0024 của cơ sở dữ liệu năm học và 0029 của cơ sở dữ liệu định danh.

### Phiên bản 0.30.1 – 2026-10-11

- Phạm vi thay đổi: DT-07 phần 7b, khóa API cho đối tác chỉ đọc (YCTD-63).
- Chức năng mới: cấp, thu hồi khóa API; đối tác đọc báo cáo tổng hợp, thu chi và công nợ, danh sách trẻ và phụ huynh, nhân sự và lương theo phạm vi khóa.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `api_clients` ở cơ sở dữ liệu định danh; mã quyền `P01.api-client.manage`.
- Thay đổi API: nhóm `/api-clients` (dịch vụ định danh), nhóm `/partner/` (máy chủ API).
- Rủi ro: giới hạn tần suất giữ trong bộ nhớ của một tiến trình máy chủ API; khi chạy nhiều tiến trình cần chuyển sang Redis.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-07-phan-7b`; chạy ngược tệp thay đổi cấu trúc 0028 của cơ sở dữ liệu định danh.

### Phiên bản 0.30.0 – 2026-10-11

- Phạm vi thay đổi: DT-07 phần 7a, bảng điều khiển và báo cáo cơ bản (YCTD-62).
- Chức năng mới: bảng điều khiển Ban Giám hiệu và quản lý đơn vị, sinh nhật trẻ trong tháng, sáu báo cáo cơ bản.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: chín mã quyền P17.
- Thay đổi API: nhóm điểm cuối `/dashboard/` và `/reports/`.
- Rủi ro: báo cáo tính trực tiếp, dữ liệu lớn có thể chậm; khi cần thì thêm bảng tổng hợp.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-07-phan-7a`; chạy ngược tệp thay đổi cấu trúc 0027 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.7 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6c-2, phiếu chi lương, quyết toán, thu hồi lương, điều chỉnh kỳ sau (YCTD-61).
- Chức năng mới: phiếu chi lương từ bảng lương và bảng quyết toán; bảng quyết toán khi chấm dứt hợp đồng; phiếu thu thu hồi lương không gắn trẻ; khoản điều chỉnh lương kỳ sau.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `payroll_settlements`, `payroll_adjustments`; cột liên kết ở `payments`, `receipts`; `receipts.child_id` được trống.
- Thay đổi API: nhóm điểm cuối quyết toán, điều chỉnh, phiếu chi lương.
- Rủi ro: phiếu thu không gắn trẻ chưa đảo được bằng chức năng đảo phiếu thu.
- Khả năng tương thích: phiếu thu cũ đều gắn trẻ, không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6c-2`; chạy ngược tệp thay đổi cấu trúc 0023 của cơ sở dữ liệu năm học.

### Phiên bản 0.29.6 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6c-1, danh mục lương, biểu thuế, bảng lương toàn trường, phiếu lương (YCTD-60).
- Chức năng mới: danh mục phụ cấp, thưởng, khấu trừ; khoản gán cho nhân sự; biểu thuế thu nhập cá nhân; tính bảng lương trả trước kèm điều chỉnh; trình, duyệt theo hạn mức, trả lại; phiếu lương của tôi.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: sáu bảng tiền lương, `staff.dependents_count`; sáu mã quyền P08; cấu hình `overtime_rate_percent`.
- Thay đổi API: nhóm điểm cuối danh mục lương, biểu thuế, bảng lương, phiếu lương.
- Rủi ro: biểu thuế có sẵn phải được kế toán trưởng cập nhật khi luật thay đổi.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6c-1`; chạy ngược tệp thay đổi cấu trúc 0022 của cơ sở dữ liệu năm học và 0026 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.5 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6b-2, phép năm, đơn nghỉ phép, chốt và mở lại bảng công (YCTD-59).
- Chức năng mới: quy định phép năm theo chức danh và thâm niên; số ngày phép năm; đơn nghỉ tự gửi hoặc lập hộ, duyệt, từ chối, hủy; chốt bảng công; đề nghị và duyệt mở lại kỳ công.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: sáu bảng phép năm, đơn nghỉ, bảng công; ba mã quyền P08.
- Thay đổi API: nhóm điểm cuối phép năm, đơn nghỉ, kỳ công.
- Rủi ro: kỳ đã chốt chặn sửa chấm công và đơn nghỉ của tháng đó.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6b-2`; chạy ngược tệp thay đổi cấu trúc 0021 của cơ sở dữ liệu năm học và 0025 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.4 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6b-1, ngày lễ, lịch học bù và nghỉ bù, chấm công (YCTD-59).
- Chức năng mới: ngày nghỉ lễ, ngày học bù thứ bảy, ngày nghỉ bù; nhân sự tự vào ca, ra ca; phòng nhân sự nhập, sửa giờ; bảng chấm công theo tháng; cấu hình giờ làm; thuộc tính tính công của loại nghỉ.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `holidays`, `school_day_changes`, `attendance_logs`, `catalog_items.attributes`; bốn mã quyền P08; ba mục cấu hình giờ làm.
- Thay đổi API: nhóm điểm cuối ngày lễ, lịch bù, chấm công; danh mục dùng chung nhận `attributes`.
- Rủi ro: ngày lễ, nghỉ bù, học bù đổi ngày học khi điểm danh và tính học phí; chỉ lập được cho ngày từ ngày mai.
- Khả năng tương thích: chưa lập lịch thì ngày học không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6b`; chạy ngược tệp thay đổi cấu trúc 0020 của cơ sở dữ liệu năm học và 0024 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.3 – 2026-10-10

- Phạm vi thay đổi: DT-06 phần 6a, hồ sơ nhân sự và hợp đồng lao động (YCTD-58).
- Chức năng mới: hồ sơ nhân sự, liên kết tài khoản có sẵn, hợp đồng lao động, chấm dứt hợp đồng khóa tài khoản, cảnh báo hợp đồng sắp hết hạn, nhập nhân sự từ Excel.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `staff`, `employment_contracts`; mã quyền `P07.staff.manage`, `P07.staff.view`, `P07.contract.view`, `P01.import.staff`; cấu hình `contract_expiry_warning_days`.
- Thay đổi API: nhóm điểm cuối nhân sự và hợp đồng; hai điểm cuối mới ở dịch vụ định danh.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6a`; chạy ngược tệp thay đổi cấu trúc 0019 của cơ sở dữ liệu năm học và 0023 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.2 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5f, thanh toán trực tuyến bằng mã QR (YCTD-57).
- Chức năng mới: tài khoản ảo và mã QR dùng một lần theo hóa đơn; đối chiếu giao dịch tiền vào tự lập phiếu thu; danh sách giao dịch chờ kế toán xử lý; phụ huynh thanh toán bằng mã QR.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `payment_requests`, `online_payment_transactions`; `cash_accounts` thêm tài khoản nhận thanh toán trực tuyến.
- Thay đổi API: mã QR của hóa đơn, cấu hình tài khoản nhận, giao dịch chuyển khoản và xử lý, điểm cuối giả lập.
- Rủi ro: chưa nối nhà cung cấp thật; ở môi trường chạy thật không đặt `PAYMENT_GATEWAY` thì phụ huynh nhận thông báo chưa nối.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5f`; chạy ngược tệp thay đổi cấu trúc 0018 của cơ sở dữ liệu năm học.

### Phiên bản 0.29.1 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5e-2, phiếu đảo phiếu chi (YCTD-56).
- Chức năng mới: lập phiếu đảo phiếu chi kèm lý do; Ban Giám hiệu duyệt theo hạn mức; hoàn lại nguồn chi và số dư có khi đảo phiếu hoàn tiền.
- Lỗi đã sửa: kiểm thử giao diện phiếu chi không còn phụ thuộc việc đơn vị chưa đặt hạn mức.
- Thay đổi dữ liệu: `payment_reversals`; mã quyền `P06.payment-reversal.create`.
- Thay đổi API: điểm cuối đảo phiếu chi, phiếu đảo phiếu chi chờ duyệt.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5e2`; chạy ngược tệp thay đổi cấu trúc 0017 của cơ sở dữ liệu năm học và 0022 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.0 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5e-1, phiếu chi và sổ quỹ (YCTD-55).
- Chức năng mới: phiếu chi kèm chứng từ, trình duyệt, Ban Giám hiệu duyệt theo hạn mức thì phát hành và trừ nguồn chi; phiếu chi hoàn tiền thôi học trừ số dư có của trẻ; sổ quỹ theo khoảng ngày.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `payments`, `payment_attachments`, `payment_refund_sources`; tệp mục đích `payment_voucher`; mã quyền `P06.payment.manage`, `P06.payment.approve`; mặc định của `bank_balance_check` là bật.
- Thay đổi API: nhóm điểm cuối phiếu chi, `GET /cash-books`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5e`; chạy ngược tệp thay đổi cấu trúc 0016 của cơ sở dữ liệu năm học và 0021 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.9 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5d-2, đảo phiếu thu và nhập công nợ đầu kỳ (YCTD-54).
- Chức năng mới: lập phiếu đảo phiếu thu, Ban Giám hiệu duyệt theo hạn mức; nhập công nợ đầu kỳ từ Excel thành hóa đơn đầu kỳ.
- Lỗi đã sửa: mục điều hướng "Quỹ và tài khoản" trùng với mục "Tài khoản", đổi thành "Quỹ và ngân hàng".
- Thay đổi dữ liệu: `receipt_reversals`; loại hóa đơn, loại dòng khoản và loại lần nhập thêm đầu kỳ; mã quyền `P06.receipt-reversal.create`, `P06.receipt-reversal.approve`, `P05.opening-debt.import`.
- Thay đổi API: điểm cuối đảo phiếu thu, phiếu đảo chờ duyệt; nhập dữ liệu nhận loại `opening_debts`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5d2`; chạy ngược tệp thay đổi cấu trúc 0015 của cơ sở dữ liệu năm học và 0020 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.8 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5d-1, phiếu thu, phân bổ, quỹ và công nợ phải thu (YCTD-53).
- Chức năng mới: khai báo quỹ tiền mặt và tài khoản ngân hàng; lập phiếu thu và phân bổ vào hóa đơn, số dư có; công nợ theo đơn vị và theo trẻ; màn hình Công nợ, Phiếu thu, Quỹ và ngân hàng; phụ huynh xem số còn phải nộp và lịch sử đã nộp.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `cash_accounts`, `receipts`, `receipt_allocations`, `account_transactions`; mã quyền `P06.receipt.manage`, `P06.cash-account.manage`, `P05.debt.view`.
- Thay đổi API: nhóm điểm cuối phiếu thu, quỹ và tài khoản, công nợ; hóa đơn thêm số đã thu và còn phải nộp; bỏ `POST /receipts/{id}/issue`.
- Rủi ro: không.
- Khả năng tương thích: miễn giảm và điều chỉnh giảm bị chặn khi vượt số còn phải nộp của hóa đơn đã thu.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5d1`; chạy ngược tệp thay đổi cấu trúc 0014 của cơ sở dữ liệu năm học và 0019 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.7 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5c-2, miễn giảm và phiếu điều chỉnh hóa đơn (YCTD-52).
- Chức năng mới: lập miễn giảm trên hóa đơn nháp và đã phát hành, chép miễn giảm kỳ trước; phiếu điều chỉnh tăng, giảm; Ban Giám hiệu duyệt theo hạn mức; số phải nộp trên hóa đơn; màn hình duyệt MH-07.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `discounts`, `invoice_adjustments`; mã quyền `P05.discount.manage`, `P05.invoice-adjustment.create`, `P05.fee-document.approve`.
- Thay đổi API: nhóm điểm cuối miễn giảm, phiếu điều chỉnh, chờ duyệt; hóa đơn thêm số phải nộp.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5c2`; chạy ngược tệp thay đổi cấu trúc 0013 của cơ sở dữ liệu năm học và 0018 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.6 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5c-1, tính học phí và phát hành hóa đơn (YCTD-51).
- Chức năng mới: tính học phí kỳ theo đơn vị; hóa đơn nháp kèm dòng cần kiểm tra; phát hành hóa đơn chính và bổ sung; xem hóa đơn trên cổng quản trị và ứng dụng phụ huynh; chặn đăng ký thêm khi nợ quá hạn.
- Lỗi đã sửa: phụ huynh xem được bảng đăng ký dịch vụ của cả đơn vị.
- Thay đổi dữ liệu: `fee_calculation_runs`, `invoices`, `invoice_items`, `document_sequences`; mã quyền `P05.fee-calculation.manage`.
- Thay đổi API: nhóm điểm cuối tính học phí và hóa đơn.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ ngoài sửa lỗi phân quyền.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5c1`; chạy ngược tệp thay đổi cấu trúc 0012 của cơ sở dữ liệu năm học và 0017 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.5 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5b, đăng ký dịch vụ và học hè (YCTD-50).
- Chức năng mới: đăng ký dịch vụ theo tháng tự giữ tới khi hủy; đăng ký và hủy sau ngày chốt chờ Ban Giám hiệu duyệt; chốt danh sách kỳ; đăng ký học hè; điểm danh ngày hè; màn hình MH-05, MP-12.
- Lỗi đã sửa: kiểm thử hồ sơ trẻ thất bại ngẫu nhiên do tên trùng; ứng dụng phụ huynh và ứng dụng giáo viên hiển thị nhầm dữ liệu của tháng hoặc ngày cũ khi kết quả tải về không theo thứ tự.
- Thay đổi dữ liệu: `service_registrations`, `registration_periods`, `summer_registrations`; cấu hình `service_registration_closing_day`; mã quyền `P05.registration.manage`, `P05.late-registration.approve`.
- Thay đổi API: nhóm điểm cuối đăng ký dịch vụ và học hè; bảng điểm danh ngày hè có dữ liệu.
- Rủi ro: không.
- Khả năng tương thích: ngày kỳ hè có bảng điểm danh cho trẻ đăng ký học hè; chức năng khác không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5b`; chạy ngược tệp thay đổi cấu trúc 0011 của cơ sở dữ liệu năm học và 0016 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.4 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5a, danh mục học phí và tài chính (YCTD-49).
- Chức năng mới: danh mục dịch vụ có bán trú tạo sẵn; biểu phí theo phiên bản; loại miễn giảm; khoản mục thu chi; màn hình MH-04, MH-39.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `services`, `fee_schedules`, `fee_schedule_items`, `discount_types`, `cashflow_categories`; mã quyền `P05.fee-catalog.manage`, `P05.discount-type.manage`, `P06.cashflow-category.manage`.
- Thay đổi API: nhóm điểm cuối dịch vụ, biểu phí, loại miễn giảm, khoản mục thu chi.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5a`; chạy ngược tệp thay đổi cấu trúc 0010 của cơ sở dữ liệu năm học và 0015 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.3 – 2026-10-10

- Phạm vi thay đổi: DT-04 phần 4b, người được ủy quyền đón trẻ và đón trả (YCTD-48).
- Chức năng mới: khai báo, hủy người được ủy quyền trên ứng dụng phụ huynh và cổng quản trị; giáo viên chủ nhiệm bàn giao trẻ kèm ảnh tùy chọn; phụ huynh xác nhận người đón ngoài danh sách; bảo vệ xác nhận người đón tại cổng.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `authorized_pickups`, `pickup_confirmation_requests`, `pickup_records`; tệp mục đích `pickup_photo`; mã quyền `P02.authorized-pickup.manage`, `P04.pickup.gate-confirm`.
- Thay đổi API: nhóm điểm cuối đón trả; `POST /files` nhận ảnh bàn giao.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-04-phan-4b`; chạy ngược tệp thay đổi cấu trúc 0009 của cơ sở dữ liệu năm học và 0014 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.2 – 2026-10-10

- Phạm vi thay đổi: DT-04 phần 4a, điểm danh, chốt ngày, báo vắng (YCTD-47).
- Chức năng mới: bảng điểm danh theo ngày học; lưu chống trùng và lưu tạm khi mất mạng; chốt ngày, sửa sau khi chốt, mở lại; báo vắng nhiều ngày; ứng dụng giáo viên; màn hình báo vắng và điểm danh trong ứng dụng phụ huynh; màn hình Điểm danh trên cổng quản trị.
- Lỗi đã sửa: kiểm thử các tệp chạy song song làm hỏng cấu hình dùng chung (yêu cầu gộp số 14).
- Thay đổi dữ liệu: `attendance_records`, `attendance_days`, `absence_records`; người nhận thông báo theo vai trò; mục cấu hình `school_start_time`; mã quyền `P04.attendance.manage`.
- Thay đổi API: nhóm điểm cuối điểm danh và báo vắng.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-04-phan-4a`; chạy ngược tệp thay đổi cấu trúc 0008 của cơ sở dữ liệu năm học và 0013 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.1 – 2026-10-10

- Phạm vi thay đổi: DT-03 phần 3c, nhập dữ liệu ban đầu và mã định danh ngành (YCTD-46).
- Chức năng mới: tải mẫu Excel; nhập lớp; nhập trẻ kèm phụ huynh vào thẳng trạng thái đang học; nhập mã ngành; bộ lọc và bổ sung giấy khai sinh; màn hình Nhập dữ liệu.
- Lỗi đã sửa: tệp tải lên vượt dung lượng trả lỗi hệ thống thay vì lỗi dữ liệu.
- Thay đổi dữ liệu: bảng `data_import_jobs`; `children.birth_certificate_file_id` cho phép trống; mã quyền `P01.import.children`.
- Thay đổi API: nhóm điểm cuối `/imports`; bộ lọc `missing_birth_certificate`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-03-phan-3c`; chạy ngược tệp thay đổi cấu trúc 0007 của cơ sở dữ liệu năm học và 0012 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.0 – 2026-10-10

- Phạm vi thay đổi: DT-03 phần 3b, hồ sơ trẻ từ lúc tiếp nhận đến khi vào lớp (YCTD-45).
- Chức năng mới: lập hồ sơ trẻ, phụ huynh, sức khỏe cơ bản, cờ trẻ con nhân viên, đồng ý hình ảnh; gửi trình duyệt, duyệt và phân lớp, từ chối; tạo tài khoản phụ huynh khi duyệt; chuyển lớp; xem đầy đủ số định danh có ghi nhật ký; tải giấy khai sinh; màn hình Hồ sơ trẻ.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười bảng mới ở cơ sở dữ liệu năm học; mã quyền `P02.child.manage`, `P02.national-id.view`.
- Thay đổi API: nhóm điểm cuối hồ sơ trẻ và tệp; `GET /classes/{id}/children`; `POST /users/guardian-accounts`; danh sách lớp trả thêm `enrolled_count`.
- Rủi ro: hai khóa mã hóa số định danh phải được sao lưu cùng cơ sở dữ liệu; mất khóa thì không giải mã được.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-03-phan-3b`; chạy ngược tệp thay đổi cấu trúc 0006 của cơ sở dữ liệu năm học và 0011 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.9 – 2026-10-10

- Phạm vi thay đổi: DT-03 phần 3a, lớp học và phân công giáo viên (YCTD-44).
- Chức năng mới: tạo, sửa, đóng, mở lại lớp; phân công và kết thúc phân công giáo viên chủ nhiệm, bộ môn; lớp của tôi; màn hình Lớp học.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `classes`, `class_staff_assignments`; mã quyền `P02.class.manage`.
- Thay đổi API: `GET`, `POST /classes`; `PATCH /classes/{id}`; `GET`, `POST /classes/{id}/staff-assignments`; `PATCH /classes/{id}/staff-assignments/{assignmentId}`; `GET /users/directory`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-03-phan-3a`; chạy ngược tệp thay đổi cấu trúc 0005 của cơ sở dữ liệu năm học và 0010 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.8 – 2026-10-10

- Phạm vi thay đổi: DT-02, đăng nhập của phụ huynh (YCTD-43).
- Chức năng mới: mật khẩu mặc định chung của phụ huynh; đăng nhập bằng mã một lần; kích hoạt tài khoản; ứng dụng phụ huynh có màn hình đăng nhập, đặt mật khẩu mới, trang chủ tạm.
- Lỗi đã sửa: ba kênh dùng chung một cookie mã làm mới.
- Thay đổi dữ liệu: `users.password_hash` cho phép để trống; `sessions.login_method`; bảng `one_time_codes`; khóa mới trong `identity_settings`.
- Thay đổi API: thêm `POST /auth/otp/request`, `POST /auth/otp/login`; bỏ `POST /auth/activate`; mở rộng `/auth/settings`, `POST /users`, `refresh`.
- Rủi ro: chưa có nhà cung cấp tin nhắn nên mã một lần chưa gửi được thật.
- Khả năng tương thích: cổng quản trị giữ nguyên cookie và cách làm mới.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-02`; chạy ngược tệp thay đổi cấu trúc 0009 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.7 – 2026-10-10

- Phạm vi thay đổi: DT-01 phần 6b, các danh mục của P01 (YCTD-42).
- Chức năng mới: phòng ban dạng cây, chức danh, danh mục dùng chung, hạn mức phê duyệt theo đơn vị và loại chứng từ, phòng học, bậc học; màn hình MH-33, MH-34, MH-49, MH-50.
- Lỗi đã sửa: tài liệu 08 mục 5 thiếu phiếu đảo phiếu thu và phiếu đảo phiếu chi.
- Thay đổi dữ liệu: sáu bảng danh mục ở cơ sở dữ liệu năm học; mã quyền `P01.department.manage`, `P01.catalog.manage`, `P01.approval-threshold.manage`, `P01.room.manage`.
- Thay đổi API: điểm cuối phòng ban, chức danh, danh mục dùng chung, hạn mức phê duyệt, phòng học, bậc học.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-6b`; chạy ngược tệp thay đổi cấu trúc 0004 của cơ sở dữ liệu năm học và 0008 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.6 – 2026-10-09

- Phạm vi thay đổi: YCTD-41, ngày chốt học phí và ngày chốt công.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bỏ mục cấu hình `attendance_closing_day`; mặc định `tuition_closing_day` là `next_month_first`.
- Thay đổi API: `GET /settings` không còn mục ngày chốt công.
- Rủi ro: không.
- Khả năng tương thích: phần 6a chưa phát hành nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-41 và danh mục cấu hình về phiên bản trước.

### Phiên bản 0.27.5 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 6a, cấu hình theo đơn vị và nhật ký thao tác.
- Chức năng mới: cấu hình theo đơn vị có kế thừa; tra nhật ký thao tác; tự khóa tài khoản lâu không đăng nhập; màn hình Cấu hình, Nhật ký thao tác.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `settings`, `identity_settings`, cột `actor_name` ở hai bảng nhật ký; mã quyền `P01.setting.manage`.
- Thay đổi API: `GET`, `PUT /settings`; `GET /audit-logs`; `GET`, `PUT /auth/settings`; `GET /users/audit-logs`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-6a`; chạy ngược tệp thay đổi cấu trúc 0003 của cơ sở dữ liệu năm học và 0007 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.4 – 2026-10-09

- Phạm vi thay đổi: YCTD-40, cấu hình theo đơn vị và tự khóa tài khoản.
- Chức năng mới: không.
- Lỗi đã sửa: P01-08 chưa có giá trị mặc định, cách kế thừa và người sửa thống nhất với ma trận quyền.
- Thay đổi dữ liệu: `identity_settings`; mã quyền `P01.setting.manage`.
- Thay đổi API: không.
- Rủi ro: chức năng dùng cấu hình chưa có giá trị phải báo thiếu cấu hình.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-40 về phiên bản trước.

### Phiên bản 0.27.3 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 5, tài khoản, vai trò, quyền.
- Chức năng mới: quản lý tài khoản, mật khẩu tạm, gán và gỡ vai trò, ma trận quyền; màn hình Tài khoản và Vai trò và quyền.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `identity_audit_logs`; mã quyền `P01.account.manage-in-unit`.
- Thay đổi API: nhóm điểm cuối `users`, `roles`, `permissions`; thêm `DELETE /api/v1/users/{id}/roles/{assignmentId}`.
- Rủi ro: dịch vụ định danh gọi máy chủ API để đọc cây đơn vị khi quản lý tài khoản.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-5`; chạy ngược tệp thay đổi cấu trúc 0006 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.2 – 2026-10-09

- Phạm vi thay đổi: YCTD-39, phân quyền quản lý tài khoản.
- Chức năng mới: không.
- Lỗi đã sửa: P01-06 và ma trận quyền chưa thống nhất về VT-15.
- Thay đổi dữ liệu: `identity_audit_logs`; mã quyền `P01.account.manage-in-unit`.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-39 về phiên bản trước.

### Phiên bản 0.27.1 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 4, cây đơn vị hai cấp.
- Chức năng mới: quản lý cây đơn vị, nhật ký thao tác, lớp đơn vị của phân quyền, màn hình Cây đơn vị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `org_units`, `audit_logs` ở cơ sở dữ liệu năm học; mã quyền `P01.org-unit.manage`.
- Thay đổi API: nhóm điểm cuối `org-units`.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-4`; chạy ngược tệp thay đổi cấu trúc 0002 của cơ sở dữ liệu năm học và 0005 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-38, cây đơn vị hai cấp.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `org_units.unit_type` ba giá trị cố định.
- Thay đổi API: không thêm điểm cuối; quy tắc của `org-units` đổi theo cây hai cấp.
- Rủi ro: phạm vi quyền thu hẹp: gán ở Phân hiệu không còn gồm Điểm trường.
- Khả năng tương thích: chưa có mã cây đơn vị nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-38 về phiên bản trước.

### Phiên bản 0.26.6 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 3, năm học.
- Chức năng mới: tạo năm học, lịch năm học, đánh số tuần, tuần nghỉ, mở năm học mới; màn hình Năm học trên cổng quản trị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bốn bảng mới ở cơ sở dữ liệu hệ thống; mã quyền `P01.academic-year.manage`; cơ sở dữ liệu năm học do máy chủ API tạo.
- Thay đổi API: nhóm điểm cuối `academic-years`; phản hồi `ERR_RULE_VIOLATION` có `rule_code`.
- Rủi ro: mở năm học tạo cơ sở dữ liệu mới; lỗi giữa chừng thì xóa cơ sở dữ liệu vừa tạo và giữ nguyên năm đang dùng.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-3`; chạy ngược tệp thay đổi cấu trúc 0002 của cơ sở dữ liệu hệ thống và 0004 của cơ sở dữ liệu định danh.

### Phiên bản 0.26.5 – 2026-10-09

- Phạm vi thay đổi: YCTD-37, quy tắc mở và đóng năm học.
- Chức năng mới: không.
- Lỗi đã sửa: mâu thuẫn giữa AC-194, CB-10 và BR-89 về trạng thái năm cũ sau khi mở năm mới; `index.md` còn ghi BR-01 đến BR-85 trong khi đã có tới BR-92.
- Thay đổi dữ liệu: `academic_years.status` ba giá trị; mã quyền `P01.academic-year.manage`.
- Thay đổi API: bỏ `POST /api/v1/academic-years/{id}/close`.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-37 về phiên bản trước.

### Phiên bản 0.26.4 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 2.
- Chức năng mới: máy chủ API kiểm tra mã phiên và quyền; màn hình đăng nhập, đổi mật khẩu, khung trang của cổng quản trị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: `login`, `refresh`, `logout` dùng cookie `refresh_token`; mọi điểm cuối của máy chủ API trừ kiểm tra sức khỏe yêu cầu mã phiên.
- Rủi ro: máy chủ API phụ thuộc dịch vụ định danh ở mọi yêu cầu.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-2`.

### Phiên bản 0.26.3 – 2026-10-09

- Phạm vi thay đổi: YCTD-36, thiết kế DT-01 phần 2.
- Chức năng mới: không.
- Lỗi đã sửa: sơ đồ mục 1 của `14` ghi điều hướng ngang trái với BC-01; `14` thiếu màn hình đăng nhập và đổi mật khẩu.
- Thay đổi dữ liệu: không.
- Thay đổi API: mã làm mới chuyển sang cookie httpOnly.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-36 về phiên bản trước.

### Phiên bản 0.26.2 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 1, phần lõi dịch vụ định danh.
- Chức năng mới: đăng nhập bằng mật khẩu, làm mới phiên, đăng xuất, đổi mật khẩu, đọc tài khoản và quyền hiện hành; tạo tài khoản quản trị nền tảng đầu tiên bằng lệnh.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: cơ sở dữ liệu định danh có bảy bảng mới, 19 vai trò và 55 mã quyền.
- Thay đổi API: năm điểm cuối nhóm `auth`; `17` ghi giao kèo chi tiết.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-1`; chạy ngược tệp thay đổi cấu trúc 0003, 0002 của cơ sở dữ liệu định danh.

### Phiên bản 0.26.1 – 2026-10-09

- Phạm vi thay đổi: YCTD-35, chốt giá trị cho dịch vụ định danh.
- Chức năng mới: không.
- Lỗi đã sửa: BM-03, BM-04 chưa có giá trị cụ thể; chưa có quy ước mã quyền.
- Thay đổi dữ liệu: thêm `security_events`, `users.locked_until`.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-35 về phiên bản trước.

### Phiên bản 0.26.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-34, chia lại đợt DT-01 và DT-02; QĐ-20 đến QĐ-22.
- Chức năng mới: không.
- Lỗi đã sửa: DT-01 yêu cầu đăng nhập được trong khi dịch vụ định danh xếp ở đợt sau.
- Thay đổi dữ liệu: tài khoản `api_service` có quyền tạo cơ sở dữ liệu.
- Thay đổi API: không.
- Rủi ro: máy chủ API phụ thuộc dịch vụ định danh ở mọi yêu cầu; dịch vụ định danh dừng thì máy chủ API từ chối yêu cầu.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-34 về phiên bản trước.

### Phiên bản 0.25.5 – 2026-10-09

- Phạm vi thay đổi: hoàn thành đợt DT-00 (M01-3), qua cổng CG-08; mã nguồn gộp vào nhánh `main`.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: ba cơ sở dữ liệu định danh, hệ thống, năm học có tệp thay đổi cấu trúc đầu tiên đặt giờ Việt Nam.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của yêu cầu gộp số 1 trên `main`.

### Phiên bản 0.25.4 – 2026-10-09

- Phạm vi thay đổi: đợt DT-00, thêm điểm cuối kiểm tra sức khỏe.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `GET /api/v1/health` ở máy chủ API nghiệp vụ và dịch vụ định danh, không cần mã phiên.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục `17` về phiên bản 1.7.

### Phiên bản 0.25.3 – 2026-10-09

- Phạm vi thay đổi: YCTD-33, chọn Kysely và quy ước nhánh.
- Chức năng mới: không.
- Lỗi đã sửa: cây thư mục ở `13` thiếu `database/system/`; `packages/shared` ghi chứa hàm dùng chung, trái ranh giới giao diện và máy chủ.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-33 về phiên bản trước.

### Phiên bản 0.25.2 – 2026-10-09

- Phạm vi thay đổi: YCTD-32, chỉ dùng GitHub trước, hạ tầng đám mây khi triển khai.
- Chức năng mới: không.
- Lỗi đã sửa: mã M01-3 trong `03` mang nội dung khác `01`; thứ tự ưu tiên trong `03` còn các việc đã xong và một dòng trùng.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: RR-08 giữ nguyên, nghiệm thu vẫn cần hạ tầng T6.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-32 về phiên bản trước.

### Phiên bản 0.25.1 – 2026-10-09

- Phạm vi thay đổi: YCTD-31, bỏ xác thực hai lớp.
- Chức năng mới: không. Bỏ xác thực hai lớp cho bốn vai trò.
- Lỗi đã sửa: việc N1 ghi chưa bắt đầu dù đã chốt.
- Thay đổi dữ liệu: `one_time_codes.purpose` chỉ còn đăng nhập.
- Thay đổi API: bỏ `/api/v1/auth/verify-otp`.
- Rủi ro: RR-15, chiếm tài khoản vai trò phê duyệt khi lộ mật khẩu.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-31 về phiên bản trước.

### Phiên bản 0.25.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-30, lịch năm học có học kỳ, kỳ hè và tuần học.
- Chức năng mới: lịch năm học trong P01-02; P05-13 Đăng ký học hè.
- Lỗi đã sửa: năm học chỉ có ngày bắt đầu và kết thúc, không có học kỳ, tuần học; số phiếu theo năm tài chính không khớp cơ sở dữ liệu theo năm học.
- Thay đổi dữ liệu: thêm `academic_terms`, `school_weeks`, `summer_registrations`; `academic_years` chuyển sang cơ sở dữ liệu hệ thống.
- Thay đổi API: thêm ba điểm cuối theo YCTD-30.
- Rủi ro: lịch năm học cấu hình sai làm sai số ngày học và học phí; giảm bằng AC-228 đến AC-232.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-30 về phiên bản trước.

### Phiên bản 0.24.1 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 5, thêm `27_BO_CA_KIEM_THU_CHI_TIET/05_P08.md` với 59 ca.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 5.

### Phiên bản 0.24.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-29, đổi cách chi lương sang trả trước đầu tháng.
- Chức năng mới: bảng quyết toán cuối cùng khi chấm dứt hợp đồng; phiếu thu thu hồi lương.
- Lỗi đã sửa: AC-40 mâu thuẫn AC-115; BR-43 chưa có công thức ngày công.
- Thay đổi dữ liệu: `payroll_periods`, `payslips`, `receipts` thêm cột theo YCTD-29.
- Thay đổi API: thêm `/api/v1/payrolls/settlements`; `/api/v1/payrolls` đổi cách tính.
- Rủi ro: tính sai phần điều chỉnh tháng trước làm sai lương thực nhận; giảm bằng AC-224 đến AC-227 và bộ ca chi tiết P08.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-29 về phiên bản trước.

### Phiên bản 0.23.3 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 4, thêm `27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md` với 65 ca; YCTD-28.
- Chức năng mới: không.
- Lỗi đã sửa: P06-02 thiếu thủ quỹ trong khi thủ quỹ lập phiếu thu tiền mặt.
- Thay đổi dữ liệu: không.
- Thay đổi API: không đổi đường dẫn.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 4 và khôi phục các tài liệu nêu ở YCTD-28 về phiên bản trước.

### Phiên bản 0.23.2 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 3, thêm `27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md` với 62 ca; YCTD-27.
- Chức năng mới: không. Bổ sung hành vi đã chốt: ngày bắt đầu học dịch vụ khi đăng ký trễ; chặn tính học phí khi còn ngày chưa chốt điểm danh.
- Lỗi đã sửa: AC-199 chưa nói rõ mốc tính số ngày học còn lại.
- Thay đổi dữ liệu: `service_registrations` thêm `service_start_date`.
- Thay đổi API: không đổi đường dẫn; thêm lỗi khi còn ngày chưa chốt điểm danh.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 3 và khôi phục các tài liệu nêu ở YCTD-27 về phiên bản trước.

### Phiên bản 0.23.1 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 2, thêm `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md` với 111 ca.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 2.

### Phiên bản 0.23.0 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 1, thêm thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`; YCTD-26.
- Chức năng mới: không. Bổ sung hành vi đã chốt: bắt buộc đổi mật khẩu sau khi đặt lại; chặn đóng năm học khi còn nợ của trẻ đã thôi học.
- Lỗi đã sửa: BM-69 và AC-203 chưa phân biệt đăng nhập bằng mật khẩu mặc định và bằng mã một lần.
- Thay đổi dữ liệu: không.
- Thay đổi API: không đổi đường dẫn; thêm lỗi BR-89 khi đóng năm học.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa thư mục 27 và khôi phục các tài liệu nêu ở YCTD-26 về phiên bản trước.

### Phiên bản 0.22.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-10; hoàn tất rà duyệt toàn bộ tài liệu, CG-01 đến CG-07 đạt.
- Chức năng mới: không.
- Lỗi đã sửa: QT-10 và P14-02 thiếu Ban Giám hiệu trong bước duyệt; chưa có điểm cuối ẩn hoạt động theo Q-72; thiếu ẩn bình luận, tự ẩn hình khi rút đồng ý, giới hạn ảnh.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `/api/v1/activities/{id}/hide`, `/api/v1/activities/{id}/republish`.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-10 phiên bản 1.0, `10_YEU_CAU_CHUC_NANG.md` phiên bản 1.3 và `17_DAC_TA_API.md` phiên bản 1.3.

### Phiên bản 0.22.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-09.
- Chức năng mới: không.
- Lỗi đã sửa: QT-09 còn chữ kích hoạt tài khoản, chưa ghi giai đoạn; ma trận quyền chưa có quyền sửa nhật ký quá hạn của quản lý đơn vị theo Q-67.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-09 phiên bản 1.0 và `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.3.

### Phiên bản 0.22.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-25 bổ sung nội dung gửi thuốc và chăm sóc sức khỏe; rà duyệt và phê duyệt QT-07.
- Chức năng mới: P10-12 Theo dõi chăm sóc hằng ngày (giai đoạn 2); giáo viên nhận thuốc khi đơn vị không có y tế; ảnh thuốc; phụ huynh xác nhận đã biết.
- Lỗi đã sửa: QT-07 thiếu Ban Giám hiệu trong tác nhân.
- Thay đổi dữ liệu: thêm bảng `daily_care_logs`; thêm cột ảnh thuốc, người nhận thuốc, xác nhận của phụ huynh.
- Thay đổi API: thêm ba điểm cuối theo YCTD-25.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-07 phiên bản 1.1 và các tài liệu nêu ở YCTD-25 về phiên bản trước.

### Phiên bản 0.21.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-06.
- Chức năng mới: không.
- Lỗi đã sửa: QT-06 thiếu tiền làm thêm giờ, người đề nghị mở lại kỳ công, cách áp lịch nghỉ lễ và thứ 7; ba tiêu chí nghiệm thu chép bản cũ.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-06 phiên bản 1.3.

### Phiên bản 0.21.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-05; YCTD-24.
- Chức năng mới: không.
- Lỗi đã sửa: QT-05 có AC-37 trái BR-34; thiếu thủ quỹ, phiếu chi hoàn tiền, trường hợp chưa cấu hình hạn mức; bước đảo phiếu chi lệch bảng trạng thái.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm hai điểm cuối duyệt và từ chối phiếu đảo phiếu chi.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-05 phiên bản 1.1 và các tài liệu nêu ở YCTD-24 về phiên bản trước.

### Phiên bản 0.21.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-04; YCTD-23.
- Chức năng mới: P05-12 Xử lý công nợ quá hạn (giai đoạn 2); bước duyệt phiếu đảo phiếu thu.
- Lỗi đã sửa: QT-04 lệch danh mục hạn mức và thiếu chức năng cho bước xử lý công nợ; thiếu thủ quỹ và luồng lỗi thanh toán mã QR.
- Thay đổi dữ liệu: thêm bảng `debt_resolutions`; `receipts` thêm `approved_by`, `approved_at`.
- Thay đổi API: thêm bốn điểm cuối theo YCTD-23.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-04 phiên bản 1.2 và các tài liệu nêu ở YCTD-23 về phiên bản trước.

### Phiên bản 0.20.3 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-03.
- Chức năng mới: không.
- Lỗi đã sửa: QT-03 còn ghi đăng ký trễ thành phát sinh kỳ sau, biểu phí theo đơn vị, quản lý đơn vị đề xuất miễn giảm; thiếu kiểm tra bán trú bắt buộc và chặn khi nợ quá hạn.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-03 phiên bản 1.6.

### Phiên bản 0.20.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-02.
- Chức năng mới: không.
- Lỗi đã sửa: QT-02 chép thiếu BR-56, thiếu ngày học bù thứ 7; ma trận P04 của VT-03 lệch P04-06.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-02 phiên bản 1.3 và `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.0.

### Phiên bản 0.20.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-01.
- Chức năng mới: không.
- Lỗi đã sửa: QT-01 kiểm tra trùng số định danh muộn, chặn phụ huynh nhiều con, còn chữ kích hoạt tài khoản và tham chiếu quy trình không tồn tại.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-01 phiên bản 1.2.

### Phiên bản 0.20.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 01; xếp G1-15 đến G1-19 vào các đợt xây dựng.
- Chức năng mới: không.
- Lỗi đã sửa: kế hoạch còn ghi tài liệu chờ duyệt, ba cấp đơn vị cố định, phạm vi mã cũ, mốc 1.1.0 còn phần chi của tài chính; năm chức năng giai đoạn 1 chưa thuộc đợt nào; RR-07 lệch kế hoạch kiểm thử.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `01_KE_HOACH_TONG_THE.md` phiên bản 0.4.

### Phiên bản 0.19.7 – 2026-10-09

- Phạm vi thay đổi: rà duyệt tài liệu 23; tài liệu giữ trạng thái Đang cập nhật theo quy định của `index.md`.
- Chức năng mới: không.
- Lỗi đã sửa: tiêu đề các mục phiên bản từ 0.4.0 sai cấp; quy ước 2 dùng tên mục khác với các mục phiên bản; `index.md` ghi phạm vi tài liệu 24 đến YCTD-15 trong khi đã có YCTD-22.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: đưa tiêu đề các mục phiên bản về cấp 2.

### Phiên bản 0.19.6 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 22; tài liệu 12 lên phiên bản 1.1 vì SL-01 thiếu cơ sở dữ liệu hệ thống.
- Chức năng mới: không.
- Lỗi đã sửa: BM-17 thiếu Ban Giám hiệu; biện pháp BM-61 đến BM-69 đặt sai mục giám sát; BM-05, BM-19, BM-42 chưa khớp Q-120, BR-73, SL-01 đến SL-04; câu trả lời Q-109, Q-110 chưa vào nội dung.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `22_BAO_MAT.md` phiên bản 0.4.

### Phiên bản 0.19.5 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 21; tài liệu 11 lên phiên bản 1.1.
- Chức năng mới: không. Thêm AC-211 và CT-167 kiểm tra chức năng thu hồi khóa API đã có ở G1-17.
- Lỗi đã sửa: tám ca kiểm thử lệch quy tắc nghiệp vụ hoặc tiêu chí nghiệm thu; AC-194 thiếu yêu cầu giữ nguyên mã định danh; mục chưa xác minh lỗi thời.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `21_KICH_BAN_KIEM_THU.md` phiên bản 0.4 và `11_TIEU_CHI_NGHIEM_THU.md` phiên bản 1.0.

### Phiên bản 0.19.4 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 20.
- Chức năng mới: không.
- Lỗi đã sửa: phạm vi kiểm thử thiếu API đối tác, cơ sở dữ liệu theo năm học, nhập dữ liệu; dữ liệu kiểm thử lệch GD-79 và thiếu trường hợp theo BR-24, BR-58, BR-84, BR-85; câu trả lời Q-101 đến Q-104 chưa vào nội dung.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `20_KE_HOACH_KIEM_THU.md` phiên bản 0.4.

### Phiên bản 0.19.3 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 19.
- Chức năng mới: không.
- Lỗi đã sửa: ngữ cảnh dự án còn ba cấp đơn vị và thiếu cơ sở dữ liệu theo năm học; câu lệnh hệ thống có từ tiếng Anh và thiếu ngoại lệ hạn mức; bảng quy ước mã thiếu tiền tố và có dạng mã không dùng.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `19_CHI_DAN_HE_THONG_AI.md` phiên bản 0.4.

### Phiên bản 0.19.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 18.
- Chức năng mới: không.
- Lỗi đã sửa: thiếu quy tắc AI cho cơ sở dữ liệu theo năm học; GD-81 đếm sai số quyết định kiến trúc; tên trạng thái lệch quy trình.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `18_QUY_TAC_PHAT_TRIEN_AI.md` phiên bản 0.4.

### Phiên bản 0.19.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 17.
- Chức năng mới: không.
- Lỗi đã sửa: thiếu điểm cuối cho các bước phê duyệt và chức năng đã duyệt; chưa ghi khóa API do dịch vụ định danh quản lý; cây đơn vị ghi ba cấp; thiếu giới hạn tin nhắn theo Q-96.
- Thay đổi dữ liệu: `one_time_codes.purpose` bỏ giá trị đặt lại mật khẩu.
- Thay đổi API: thêm mười lăm điểm cuối, chuyển một điểm cuối sang nhóm trẻ và lớp.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `17_DAC_TA_API.md` phiên bản 0.4.

### Phiên bản 0.19.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 16, xem `24_YEU_CAU_THAY_DOI.md` YCTD-22.
- Chức năng mới: hóa đơn bổ sung cùng kỳ.
- Lỗi đã sửa: bảng không theo năm học nằm chung cơ sở dữ liệu năm học; thiếu bảng phân công giáo viên, tổ chuyên môn, phiên đăng nhập, mã một lần; mục P11 còn bảng trống.
- Thay đổi dữ liệu: thêm năm bảng và bảy cột; thêm cơ sở dữ liệu hệ thống.
- Thay đổi API: thêm một điểm cuối.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-22 về phiên bản 0.18.1.

### Phiên bản 0.18.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 15.
- Chức năng mới: không.
- Lỗi đã sửa: cỡ chữ nhãn và ghi chú nhỏ hơn mức tối thiểu 14 điểm ảnh (Q-89); nút chính chữ trắng trên nền cam không đủ tương phản; thiếu thành phần cho mã ngành còn trống và số định danh đã che.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `15_HE_THONG_THIET_KE.md` phiên bản 0.4.

### Phiên bản 0.18.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 14, xem `24_YEU_CAU_THAY_DOI.md` YCTD-21.
- Chức năng mới: màn hình MH-44 Cá nhân trên cổng quản trị.
- Lỗi đã sửa: vai trò màn hình chưa theo quyết định mới; BC-01 tự mâu thuẫn; BC-08 lệch mục 6; sơ đồ còn mục xe.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-21 về phiên bản 0.17.2.

### Phiên bản 0.17.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 13.
- Chức năng mới: không.
- Lỗi đã sửa: cấu trúc mã nguồn và quy ước chưa tính cơ sở dữ liệu theo năm học và cơ sở dữ liệu định danh riêng; mục chưa xác minh còn điểm đã có câu trả lời.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `13_CONG_NGHE_SU_DUNG.md` phiên bản 0.4.

### Phiên bản 0.17.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 12; chốt QĐ-01, QĐ-03, QĐ-05.
- Chức năng mới: không.
- Lỗi đã sửa: nguyên tắc dùng chung cơ sở dữ liệu giữa định danh và API trái QĐ-15; sơ đồ thiếu đối tác và cơ sở dữ liệu theo năm học; phạm vi đơn vị chưa theo YCTD-18; thiếu tác vụ khóa tài khoản hết hạn và mở năm học.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `12_KIEN_TRUC_HE_THONG.md` phiên bản 0.4.

### Phiên bản 0.17.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 11, xem `24_YEU_CAU_THAY_DOI.md` YCTD-20.
- Chức năng mới: không. Chức năng bỏ: P17-15 Báo cáo ăn tối; dịch vụ ăn sáng và ăn tối.
- Lỗi đã sửa: công thức suất ăn trừ trẻ nghỉ hai lần; AC-29 trái BR-26; AC-147 trái P01-06; tiêu chí còn nhắc kích hoạt tài khoản.
- Thay đổi dữ liệu: gỡ `meal_registrations`; `buffet_registrations` thay bằng `buffet_events`.
- Thay đổi API: gỡ hai điểm cuối, đổi một điểm cuối.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-20 về phiên bản 0.16.0.

### Phiên bản 0.16.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 10, xem `24_YEU_CAU_THAY_DOI.md` YCTD-19.
- Chức năng mới: không. Chức năng đổi giai đoạn: P06-04 Phiếu chi, P06-05 Quỹ tiền mặt sang giai đoạn 1.
- Lỗi đã sửa: quản lý đơn vị tham gia miễn giảm trái Q-134; thiếu bước phê duyệt theo hạn mức ở điều chỉnh hóa đơn và bảng lương; dẫn chiếu quy tắc sai ở ba chức năng; P19-06 còn mã kích hoạt.
- Thay đổi dữ liệu: không.
- Thay đổi API: điểm cuối phiếu chi và sổ quỹ có từ giai đoạn 1.
- Rủi ro: khối lượng giai đoạn 1 tăng.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-19 về phiên bản 0.15.1.

### Phiên bản 0.15.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 09.
- Chức năng mới: không.
- Lỗi đã sửa: tài liệu 09 ghi kế toán chốt công, chặn trẻ đi học khi nợ, đăng ký giữa tháng chuyển kỳ sau, gắn nhầm hai luồng phụ kho vào luồng hoạt động, sơ đồ luồng sai một mũi tên.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `09_LUONG_NGHIEP_VU.md` phiên bản 0.4.

### Phiên bản 0.15.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 08, xem `24_YEU_CAU_THAY_DOI.md` YCTD-18.
- Chức năng mới: không.
- Lỗi đã sửa: ma trận quyền thiếu quyền duyệt của quản lý đơn vị, thiếu quyền đăng nhập của cán bộ quản lý cấp trên và kiểm toán viên; kế hoạch tổng thể ghi sai số quy tắc nghiệp vụ.
- Thay đổi dữ liệu: không.
- Thay đổi API: không thêm điểm cuối; cập nhật quyền theo ma trận.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-18 về phiên bản 0.14.0.

### Phiên bản 0.14.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 07, xem `24_YEU_CAU_THAY_DOI.md` YCTD-17.
- Chức năng mới: không.
- Lỗi đã sửa: BR-53 mâu thuẫn ma trận quyền; BR-24 mâu thuẫn Q-134; BR-01 mâu thuẫn quyền Quản trị nền tảng; mục lục ghi sai phiên bản bốn quy trình.
- Thay đổi dữ liệu: không.
- Thay đổi API: thu hẹp quyền phân hệ Y tế và quyền phê duyệt phiếu chi hoàn tiền.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-17 về phiên bản 0.13.0.

### Phiên bản 0.13.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 04, 05, 06; bỏ dịch vụ học thứ bảy, xem `24_YEU_CAU_THAY_DOI.md` YCTD-16.
- Chức năng mới: không. Chức năng bỏ: dịch vụ học thứ bảy thu phí theo trẻ.
- Lỗi đã sửa: tài liệu 04, 05, 06 còn ghi ba cấp đơn vị cố định, còn nhắc ứng lương, thiếu chức năng giai đoạn 1 đã gắn ở tài liệu 10, còn mục chưa xác minh đã có câu trả lời; mục lục ghi sai phiên bản QT-03.
- Thay đổi dữ liệu: `saturday_schedules` dùng chung toàn trường.
- Thay đổi API: đổi quyền và mô tả hai điểm cuối.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-16 về phiên bản 0.12.0.

### Phiên bản 0.12.0 – 2026-10-09

- Phạm vi thay đổi: xử lý hết giả định, xem `24_YEU_CAU_THAY_DOI.md` YCTD-15.
- Chức năng mới: P02-12 Nhập mã định danh ngành từ tệp; duyệt đăng ký trễ trong P05-03.
- Lỗi đã sửa: GD-16 mâu thuẫn với QT-06 về người chốt công.
- Thay đổi dữ liệu: mã trẻ theo số định danh và mã ngành; cột dịch vụ bắt buộc và đăng ký trễ.
- Thay đổi API: thêm hai điểm cuối.
- Rủi ro: RR-14 mật khẩu mặc định chung.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-15 về phiên bản 0.11.0.

### Phiên bản 0.11.0 – 2026-10-09

- Phạm vi thay đổi: trả lời toàn bộ câu hỏi mở, xem `24_YEU_CAU_THAY_DOI.md` YCTD-14.
- Chức năng mới: P01-14 Khóa API cho đối tác; P08-12 Tiền làm thêm giờ; mở và đóng năm học kèm chuyển dữ liệu. Chức năng bỏ: P11-01 đến P11-07, P17-09.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: gỡ tám bảng xe đưa đón; thêm ba bảng và ba cột; mỗi năm học một cơ sở dữ liệu.
- Thay đổi API: gỡ mười điểm cuối, thêm tám điểm cuối.
- Rủi ro: RR-13 mỗi năm học một cơ sở dữ liệu; API đối tác đọc dữ liệu cá nhân.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-14 về phiên bản 0.10.0.

### Phiên bản 0.10.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 8, xem `24_YEU_CAU_THAY_DOI.md` YCTD-13.
- Chức năng mới: đồng ý hoặc rút đồng ý hình ảnh trên ứng dụng phụ huynh; xem đầy đủ số định danh có ghi nhật ký. Chức năng bỏ: P08-05 Ứng lương.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: gỡ `advance_requests`, `payslips.advance_amount`; thêm `photo_consent_histories` và các cột mới của `children`.
- Thay đổi API: gỡ hai điểm cuối ứng lương, thêm hai điểm cuối hồ sơ trẻ.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-13 về phiên bản 0.9.0.

### Phiên bản 0.9.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 6 và lượt 7, xem `24_YEU_CAU_THAY_DOI.md` YCTD-12.
- Chức năng mới: P01-13 Nhập dữ liệu ban đầu từ Excel; P06-11 Thanh toán trực tuyến bằng mã QR.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: thêm `data_import_jobs`, `online_payment_transactions`; bỏ trạng thái thu một phần của hóa đơn.
- Thay đổi API: thêm tám điểm cuối.
- Rủi ro: thanh toán bằng mã QR và tin nhắn phụ thuộc nhà cung cấp chưa chọn (Q-142, T1, T5).
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-12 về phiên bản 0.8.0.

### Phiên bản 0.8.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 4 và lượt 5, xem `24_YEU_CAU_THAY_DOI.md` YCTD-11.
- Chức năng mới: phụ huynh đăng nhập bằng mã một lần (mở rộng P19-06); cờ chặn đăng ký dịch vụ khi nợ quá hạn (mở rộng P01-08).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bỏ cột `session` của `attendance_records`, `absence_records`.
- Thay đổi API: thêm hai điểm cuối mã một lần; điểm danh không còn tham số buổi.
- Rủi ro: đăng nhập bằng mã một lần phụ thuộc nhà cung cấp tin nhắn chưa chọn (T1).
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-11 về phiên bản 0.7.0.

### Phiên bản 0.7.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 3, xem `24_YEU_CAU_THAY_DOI.md` YCTD-10.
- Chức năng mới: P05-11 Danh mục loại miễn giảm; P08-11 Danh mục khấu trừ và quy định số ngày phép năm.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: thêm `discount_types`, `leave_policies`; `discounts.discount_type_id`.
- Thay đổi API: thêm hai điểm cuối.
- Rủi ro: số hiệu văn bản chế độ kế toán hành chính, sự nghiệp cần kế toán trưởng kiểm tra lại.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-10 về phiên bản 0.6.0.

### Phiên bản 0.6.0 – 2026-10-09

- Phạm vi thay đổi: chốt các quyết định ưu tiên, xem `24_YEU_CAU_THAY_DOI.md` YCTD-09.
- Chức năng mới: không. Sổ kế toán kép (G3-06) được đưa chính thức vào phạm vi giai đoạn 3.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: biểu phí dùng chung toàn trường.
- Thay đổi API: không.
- Rủi ro: chế độ kế toán chưa xác định (Q-140); mức miễn giảm chưa có (Q-16).
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-09 về phiên bản 0.5.3.

### Phiên bản 0.5.3 – 2026-10-09

- Phạm vi thay đổi: trả lời Q-139, xác nhận GD-86, xem `24_YEU_CAU_THAY_DOI.md` YCTD-08.
- Chức năng mới: không. Sửa đặc tả P14-11.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên P14-11, GD-86, Q-139 về phiên bản 0.5.2; xóa AC-175, CT-131.

### Phiên bản 0.5.2 – 2026-10-09

- Phạm vi thay đổi: bổ sung điểm cuối cho phân hệ Giảng dạy, xem `24_YEU_CAU_THAY_DOI.md` YCTD-07.
- Chức năng mới: không.
- Lỗi đã sửa: `17_DAC_TA_API.md` thiếu nhóm điểm cuối P03; chức năng P03-07 thiếu bảng dữ liệu.
- Thay đổi dữ liệu: thêm bảng `class_activity_schedules`.
- Thay đổi API: thêm mười tám điểm cuối ở mục 7; các mục sau đánh số lại từ 8 đến 21.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa mục 7 của `17_DAC_TA_API.md`, đánh số lại các mục, xóa bảng `class_activity_schedules`.

### Phiên bản 0.5.1 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời Q-136 đến Q-138, xem `24_YEU_CAU_THAY_DOI.md` YCTD-06.
- Chức năng mới: không. Sửa đặc tả P08-10, P10-11, P14-10, P14-11.
- Lỗi đã sửa: `01_KE_HOACH_TONG_THE.md` mục 13 còn ghi 84 giả định.
- Thay đổi dữ liệu: `saturday_schedules` theo đơn vị; thêm `fee_type`, `effective_from`, `effective_to`; đổi `health_standards.source` thành `source_document`.
- Thay đổi API: không đổi đường dẫn.
- Rủi ro: Q-139 chưa trả lời; GD-86 chưa xác nhận.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-06 về nội dung của phiên bản 0.5.0.

### Phiên bản 0.5.0 – 2026-10-09

- Phạm vi thay đổi: bổ sung hai mươi chức năng theo tám ảnh sơ đồ chức năng, xem `24_YEU_CAU_THAY_DOI.md` YCTD-05.
- Chức năng mới: P01-11, P01-12, P02-11, P03-08, P06-10, P08-09, P08-10, P10-09 đến P10-11, P12-08, P12-09, P13-10, P14-10 đến P14-12, P16-05, P17-13 đến P17-15.
- Lỗi đã sửa: số chức năng ghi nhầm 106 (thực tế 141 trước bổ sung); số bảng dữ liệu ghi nhầm 92 (thực tế 134 trước bổ sung); trả lời Q-06, Q-28, Q-29.
- Thay đổi dữ liệu: thêm mười chín bảng và sáu cột, xem YCTD-05.
- Thay đổi API: thêm hai mươi hai điểm cuối.
- Rủi ro: ba câu hỏi mới Q-136 đến Q-138; giai đoạn của các chức năng mới là đề xuất.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa các dòng chức năng, tiêu chí, ca kiểm thử, bảng, điểm cuối và màn hình liệt kê ở YCTD-05.

### Phiên bản 0.4.0 – 2026-10-09

- Phạm vi thay đổi: chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow; sửa các chỗ chưa khớp; thống nhất phân cấp phê duyệt; đổi mã dự án thành SM. Chi tiết ở `24_YEU_CAU_THAY_DOI.md` YCTD-01 đến YCTD-04.
- Chức năng mới: không áp dụng.
- Lỗi đã sửa: sơ đồ trong `09_LUONG_NGHIEP_VU.md` và các đặc tả QT-01, QT-03, QT-04, QT-05, QT-08, QT-09, QT-10 còn thuật ngữ cũ "cơ sở" và "Chủ trường"; `01_KE_HOACH_TONG_THE.md` và `03_DANH_SACH_CONG_VIEC.md` còn số câu hỏi mở và giả định cũ; mốc 0.3.0 còn ghi Đang soạn; `13_CONG_NGHE_SU_DUNG.md` ghi bốn ứng dụng giao diện nhưng liệt kê ba; `11_TIEU_CHI_NGHIEM_THU.md` không trỏ tới AC-94 đến AC-134; mâu thuẫn người phê duyệt phiếu chi, miễn giảm, phiếu đảo và bảng lương.
- Thay đổi dữ liệu: bảng `fiscal_periods` thêm `close_requested_by`, `close_requested_at`. Mã trẻ sinh theo dạng `SM-<mã đơn vị>-<số thứ tự>`.
- Thay đổi API: thêm `POST /api/v1/fiscal-periods/{id}/request-close`. Các điểm cuối phê duyệt chứng từ phải từ chối vai trò kế toán, kế toán trưởng và quản lý đơn vị.
- Rủi ro: việc xem "hình tổ màu" là "hình tô màu" ở P14-09 vẫn chưa được xác nhận (Q-06). Ba câu hỏi Q-133 đến Q-135 phát sinh và đã được trả lời trong cùng phiên bản.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng. Mục lịch sử trong `02_NHAT_KY_DU_AN.md` và tệp này giữ nguyên tên tệp cũ.
- Phương án quay lui: đổi tên ngược theo bảng đối chiếu ở YCTD-01; hoàn nguyên QT-03 đến QT-06 về phiên bản 1.0; hoàn nguyên VT-03 và VT-05 về quyền phê duyệt.

### 0.3.1 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Đổi tên dự án từ Sun KinderGarten thành School Management theo yêu cầu của Eric, để khớp với tên thư mục gốc `D:\School_Management` |
| Chức năng mới | Không áp dụng |
| Lỗi đã sửa | Không áp dụng. Đây là thay đổi cách gọi tên, không phải sửa lỗi |
| Thay đổi dữ liệu | Không áp dụng. Không có bảng, cột hay ràng buộc nào bị đổi |
| Thay đổi giao diện lập trình | Không áp dụng. Không có điểm cuối nào bị đổi |
| Rủi ro | Mã dự án vẫn là `SKG`, vốn là chữ viết tắt của tên cũ, nay không còn khớp tên mới; đã ghi thành `Q-132`. Mã này còn dùng trong quy tắc sinh mã trẻ tại `GD-20` của `QT-01`, nên nếu đổi mã thì phải sửa cả quy tắc đó |
| Khả năng tương thích | Không ảnh hưởng nội dung nghiệp vụ, lược đồ dữ liệu hay giao diện lập trình. Hai mục nhật ký cũ còn nhắc tên cũ được giữ nguyên vì nhật ký chỉ ghi thêm. Các mã đã cấp không bị tái sử dụng |
| Phương án quay lui | Thay ngược "School Management" về "Sun KinderGarten" trên cùng 36 tệp; hoàn nguyên `index.md`, `01_Tong_quan_du_an.md`, `Checklist_cong_viec.md` và `Nhat_ky_du_an.md` về trạng thái phiên bản 0.3.0 |

Nội dung đã cập nhật trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Phân tích nghiệp vụ | `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md` |
| Thiết kế | `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md`, `21_Ke_hoach_tong_the_du_an.md` |
| Quy tắc và vận hành | `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md` |
| Quy trình nghiệp vụ | `Quy_trinh_nghiep_vu/index.md`, `Phieu_yeu_cau.md` và `QT-01` đến `QT-10` |
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |

### 0.3.0 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Lập kế hoạch tổng thể dự án theo yêu cầu của Eric: mười hai giai đoạn kèm cổng kiểm soát, sáu mốc phát hành, mười hai đợt xây dựng, đường găng, ma trận trách nhiệm, ngưỡng phê duyệt thay đổi và mười hai rủi ro |
| Chức năng mới | Không áp dụng. Đây là tài liệu kế hoạch, không sinh chức năng phần mềm |
| Lỗi đã sửa | Sửa số giả định trong `index.md` từ 80 lên 83 vì `GD-81` trong `15_Quy_tac_phat_trien_AI.md` trước đây chưa được đếm |
| Thay đổi dữ liệu | Không áp dụng. Không có bảng, cột hay ràng buộc nào bị đổi |
| Thay đổi giao diện lập trình | Không áp dụng. Không có điểm cuối nào bị đổi |
| Rủi ro | Kế hoạch chưa có mốc thời gian nên khó đo tiến độ, ghi tại `RR-12`; ba việc `M05`, `M06`, `M08` đang tạm dừng và nằm trên đường găng; kế hoạch là đề xuất, chưa được Eric phê duyệt, ghi tại `GD-82` |
| Khả năng tương thích | Không ảnh hưởng tài liệu `01` đến `20`; chỉ thêm một tài liệu mới, hai quy tắc phát triển mới và ba tiền tố mã mới. Các mã đã cấp không bị tái sử dụng |
| Phương án quay lui | Xóa `21_Ke_hoach_tong_the_du_an.md`, hoàn nguyên `index.md`, `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md`, `Checklist_cong_viec.md` và `Nhat_ky_du_an.md` về trạng thái phiên bản 0.2.0 |

Nội dung đã cập nhật trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Kế hoạch | `21_Ke_hoach_tong_the_du_an.md` (tạo mới) |
| Quy tắc và vận hành | `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md` |
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |

### 0.2.0 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Cập nhật bộ tài liệu thiết kế theo bốn yêu cầu của Eric ngày 09/10/2026: đổi vai trò Chủ trường thành Ban Giám hiệu, chuyển mô hình một cấp sang ba cấp đơn vị, tách tầng giao diện khỏi tầng máy chủ, tách dịch vụ định danh |
| Chức năng mới | Quản lý cây đơn vị ba cấp (P01-01); cấu hình hạn mức phê duyệt (P01-10); màn hình cây đơn vị (MH-32); màn hình hạn mức phê duyệt (MH-33) |
| Lỗi đã sửa | Sửa mâu thuẫn giữa BR-01, BR-02 và GD-05 về cấp đơn vị; sửa cách gọi vai trò Ban Giám hiệu thành hai vai trò riêng |
| Thay đổi dữ liệu | Bảng `branches` đổi thành `org_units` kèm `unit_type` và `parent_id` tự tham chiếu; cột `branch_id` đổi thành `org_unit_id`; thêm khái niệm hạn mức phê duyệt theo đơn vị và loại chứng từ |
| Thay đổi giao diện lập trình | `/api/v1/branches` đổi thành `/api/v1/org-units`; thêm `/api/v1/org-units/tree` và `/api/v1/approval-thresholds`; `/api/v1/children/{id}/transfer-branch` đổi thành `/api/v1/children/{id}/transfer-unit`; `/api/v1/dashboard/owner` đổi thành `/api/v1/dashboard/leadership`; `/api/v1/dashboard/branch` đổi thành `/api/v1/dashboard/unit` |
| Rủi ro | Việc đổi thuật ngữ "cơ sở" thành "đơn vị" ảnh hưởng toàn bộ bộ tài liệu, cần rà soát lại khi có mã nguồn; mức hạn mức phê duyệt chưa có nên chưa kiểm thử được; số cấp đơn vị thật chưa xác nhận |
| Khả năng tương thích | Bộ tài liệu chưa có mã nguồn nên không có vấn đề tương thích; các mã đã cấp không bị tái sử dụng |
| Phương án quay lui | Giữ nguyên phiên bản 0.1.0 trong lịch sử; nếu cần, khôi phục theo mục 0.1.0 |

Nội dung đã cập nhật trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Phân tích nghiệp vụ | `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md` |
| Thiết kế | `09_Kien_truc_he_thong.md`, `10_Cong_nghe_su_dung.md`, `11_Dac_ta_giao_dien.md`, `13_Luoc_do_co_so_du_lieu.md`, `14_Dac_ta_API.md` |
| Quy tắc và vận hành | `16_Cau_lenh_he_thong_AI.md`, `17_Ke_hoach_kiem_thu.md`, `18_Ca_kiem_thu.md`, `19_Bao_mat.md` |
| Quy trình nghiệp vụ | `QT-01` đến `QT-10` |
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |

### 0.1.0 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Khởi tạo bộ tài liệu thiết kế, chưa có mã nguồn |
| Chức năng mới | Không áp dụng |
| Lỗi đã sửa | Không áp dụng |
| Thay đổi dữ liệu | Không áp dụng |
| Thay đổi giao diện lập trình | Không áp dụng |
| Rủi ro | Bộ tài liệu dựa trên danh sách tính năng và bốn ảnh sơ đồ chức năng, chưa có nghiệp vụ thật để đối chiếu; nhiều giả định và câu hỏi mở chưa được trả lời |
| Khả năng tương thích | Không áp dụng, đây là bản khởi tạo |
| Phương án quay lui | Không áp dụng |

Nội dung đã tạo trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |
| Phân tích nghiệp vụ | `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md` |
| Thiết kế | `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md` |
| Quy tắc và vận hành | `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md` |
| Quy trình nghiệp vụ | `Quy_trinh_nghiep_vu/QT-01` đến `QT-10` và `Quy_trinh_nghiep_vu/index.md` |

## 3. Chưa xác minh được

Không áp dụng. Tài liệu này ghi lịch sử thay đổi, không mô tả hiện trạng hệ thống.

## 4. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-60 | Đã xác nhận ngày 09/10/2026 (theo ghi nhận lịch sử): Phiên bản 0.1.0 đánh dấu mốc khởi tạo tài liệu, chưa phải phiên bản phần mềm | Eric |
| GD-80 | Đã xác nhận ngày 09/10/2026 (theo ghi nhận lịch sử): Phiên bản 0.2.0 ghi nhận bốn thay đổi kiến trúc và mô hình tổ chức đã được Eric chốt ngày 09/10/2026 | Eric |
| GD-82 | Đã xác nhận ngày 09/10/2026 (theo Q-07): Kế hoạch tổng thể là đề xuất, thứ tự đợt và cách xếp giai đoạn có thể đổi sau khi Eric xác nhận | Eric |
| GD-83 | Đã xác nhận ngày 09/10/2026 (theo Q-128): Kế hoạch dùng thứ tự và điều kiện vào, điều kiện ra thay cho hạn ngày | Eric |
| Q-111 | Đã trả lời ngày 09/10/2026: phiên bản 1.0 gồm các phân hệ của giai đoạn 1 theo `05_PHAM_VI.md` mục 4, đã xác nhận tại Q-07 | Eric |
| Q-127 | Đã trả lời ngày 09/10/2026: không tách bản 0.2.0 thành bản phát hành riêng | Eric |
| Q-128 | Đã trả lời ngày 09/10/2026: giữ cách dùng điều kiện vào, điều kiện ra, không đặt mốc ngày | Eric |
| Q-129 | Đã trả lời ngày 09/10/2026: Eric duyệt mọi cổng; Hiệu trưởng cùng nghiệm thu nghiệp vụ; kế toán trưởng cùng nghiệm thu phân hệ học phí, tài chính, lương | Eric |
| Q-130 | Đã trả lời ngày 09/10/2026: dùng Git trên GitHub, kho riêng; dựng tích hợp và triển khai tự động ngay từ đợt DT-00 | Eric |
| Q-132 | Đã trả lời ngày 09/10/2026: mã dự án đổi thành SM | Eric |
