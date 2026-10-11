# 10. YÊU CẦU CHỨC NĂNG

- Mô tả: Mã chức năng, tên chức năng, mục đích, người sử dụng, điều kiện thực hiện, dữ liệu đầu vào, quy trình xử lý, kết quả đầu ra, quy tắc nghiệp vụ, trường hợp ngoại lệ, phân quyền, thông báo lỗi.
- Phiên bản: 1.25
- Ngày cập nhật: 2026-10-11
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Quy ước

1. Mã chức năng theo dạng `P<phân hệ>-<số thứ tự>`, ví dụ `P05-03`.
2. Mỗi chức năng dưới đây là một yêu cầu ở mức nghiệp vụ. Chi tiết luồng, luồng lỗi, thông báo và tiêu chí nghiệm thu của các chức năng trọng yếu nằm trong `25_QUY_TRINH_NGHIEP_VU/` và `11_TIEU_CHI_NGHIEM_THU.md`.
3. Mọi chức năng đều phải kiểm tra quyền ở máy chủ theo ma trận tại `08_VAI_TRO_NGUOI_DUNG.md`. Cột "Người dùng" chỉ nêu vai trò chính, không phải danh sách quyền đầy đủ.
4. Mọi chức năng ghi dữ liệu đều phải ghi nhật ký thao tác theo quy tắc `BR-35` và `PQ-05`.
5. Chức năng gắn nhãn **(G1)**, **(G2)**, **(G3)** tương ứng giai đoạn 1, 2, 3 tại `05_PHAM_VI.md`.

## 2. Phân hệ P01 — Nền tảng, đơn vị và phân quyền

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P01-01 | Quản lý cây đơn vị hai cấp (G1) | VT-02 | Tên, mã, loại đơn vị (Trường chính, Phân hiệu, Điểm trường), địa chỉ, người phụ trách, trạng thái | Tạo Trường chính; tạo, sửa, ngừng sử dụng Phân hiệu, Điểm trường trực thuộc Trường chính | Cây đơn vị hai cấp dạng cây và danh sách phẳng (QĐ-23, YCTD-38) | BR-01 |
| P01-02 | Quản lý năm học (G1) | VT-02 | Tên năm học; ngày bắt đầu và kết thúc của học kỳ 1, học kỳ 2; kỳ hè nếu có; ngày học trong tuần; tuần nghỉ | Tạo năm học kèm lịch chung toàn trường, tự đánh số tuần, đánh dấu tuần nghỉ (BR-91); mở năm học mới thì tạo cơ sở dữ liệu năm học, chuyển dữ liệu dùng chung và chuyển năm đang dùng sang đã đóng, chỉ đọc; chặn mở khi năm đang dùng còn trẻ đã thôi học có công nợ chưa tất toán (YCTD-37) | Danh sách năm học và lịch năm học | BR-02, BR-89, BR-91, BR-93 |
| P01-03 | Quản lý phòng ban (G1) | VT-02, VT-06 | Tên, đơn vị, phòng ban cha | Tạo, sửa, ngừng sử dụng | Sơ đồ phòng ban | BR-01 |
| P01-04 | Quản lý chức danh (G1) | VT-02, VT-06 | Tên chức danh, cấp bậc | Tạo, sửa, ngừng sử dụng | Danh sách chức danh | BR-37 |
| P01-05 | Quản lý danh mục dùng chung (G1) | VT-02 | Loại danh mục (do hệ thống định nghĩa: quan hệ với trẻ, loại nghỉ phép, loại hợp đồng, nhóm tài sản; YCTD-42), mã, tên, thứ tự | Tạo, sửa, ngừng sử dụng mục trong từng loại | Danh mục dùng chung | BR-75 |
| P01-06 | Quản lý tài khoản (G1) | VT-02, VT-03 | Họ tên, số điện thoại, vai trò, đơn vị | Tạo, khóa, mở khóa, đặt lại mật khẩu; người được đặt lại bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp (Q-148) | Danh sách tài khoản | PQ-06, PQ-07, BM-07 |
| P01-07 | Quản lý vai trò và quyền (G1) | VT-02 | Vai trò, danh sách quyền, phạm vi đơn vị | Gán và thu hồi quyền | Ma trận quyền hiện hành | PQ-01, PQ-03, PQ-04 |
| P01-08 | Cấu hình tham số theo đơn vị (G1) | VT-02, VT-03 | Ngày chốt học phí (mặc định mùng 1 tháng sau, cấu hình được; ngày chốt công cố định mùng 1 tháng sau, không cấu hình, YCTD-41), ngày đến hạn, giờ bắt đầu học (mặc định 07:30, YCTD-47), ngày chốt đăng ký dịch vụ (mặc định ngày 25 của tháng trước kỳ, YCTD-49), mốc nhắc nợ (mặc định 3, 7 và 15 ngày sau ngày đến hạn), bật hoặc tắt chặn đăng ký dịch vụ khi nợ quá hạn, bật hoặc tắt ghi nhật ký truy cập, bật hoặc tắt kiểm tra số dư tài khoản ngân hàng, bật hoặc tắt chặn xuất quá tồn kho, bật hoặc tắt không có nhân viên y tế (BR-86), sĩ số tối đa | Lưu và áp dụng cấu hình; đơn vị chưa cấu hình một mục thì dùng giá trị của Trường chính, rồi tới mặc định; chỉ ngày chốt học phí (mùng 1 tháng sau), giờ bắt đầu học, ngày chốt đăng ký dịch vụ và mốc nhắc nợ (3, 7, 15 ngày) có mặc định, các mục khác để trống cho tới khi nhà trường cấu hình; mật khẩu mặc định của phụ huynh lưu ở dịch vụ định danh, làm ở DT-02 (YCTD-40) | Bộ tham số của đơn vị | BR-18, BR-33, BR-34, BR-62, BR-73, BR-86 |
| P01-09 | Nhật ký thao tác (G1) | VT-02, VT-03 | Bộ lọc người dùng, thời gian, đối tượng | Ghi và tra cứu nhật ký thao tác | Danh sách nhật ký | BR-35, BR-73 |
| P01-10 | Cấu hình hạn mức phê duyệt (G1) | VT-02 | Loại chứng từ, hạn mức theo đơn vị | Lưu và áp dụng hạn mức phê duyệt | Danh sách hạn mức | BR-77, BR-79 |
| P01-11 | Danh mục phòng học (G1) | VT-02, VT-03 | Đơn vị, mã phòng, tên phòng, sức chứa, trạng thái | Tạo, sửa, ngừng sử dụng phòng học; gán phòng cho lớp | Danh mục phòng học | BR-01, BR-75 |
| P01-12 | Danh mục bậc học (G1) | VT-02 | Mã (không đổi sau khi tạo), tên bậc học, độ tuổi theo tháng (YCTD-42), thứ tự | Tạo, sửa, ngừng sử dụng; lớp và biểu phí chọn bậc học từ danh mục | Danh mục bậc học | BR-02, BR-17, BR-75 |
| P01-13 | Nhập dữ liệu ban đầu từ Excel (G1) | VT-02, VT-04, VT-06 | Loại dữ liệu, tệp Excel theo mẫu tải từ hệ thống | Kiểm tra toàn bộ tệp, xuất báo cáo dòng lỗi; chỉ ghi khi không còn dòng lỗi; ghi nhật ký nhập; trẻ nhập ở trạng thái đang học, bổ sung giấy khai sinh sau (YCTD-46) | Trẻ, phụ huynh, lớp, nhân sự, công nợ đầu kỳ đã nhập | BR-06, BR-35, BR-75 |
| P01-14 | Khóa API cho đối tác (G1) | VT-02 | Tên đối tác, loại đối tác, phạm vi dữ liệu (báo cáo tổng hợp, thu chi và công nợ, danh sách trẻ và phụ huynh, nhân sự và lương), căn cứ pháp lý, địa chỉ mạng cho phép, ngày hết hạn | Cấp, thu hồi khóa; đối tác chỉ đọc dữ liệu trong phạm vi; mọi lần đọc dữ liệu cá nhân ghi nhật ký | Danh sách khóa API | BR-74, BR-73 |

## 3. Phân hệ P02 — Trẻ, phụ huynh và lớp học

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P02-01 | Danh sách trẻ (G1) | VT-03, VT-04, VT-07 | Bộ lọc đơn vị, lớp, trạng thái, từ khóa | Truy vấn có phân trang và lọc theo quyền | Danh sách trẻ | BR-01, BR-72 |
| P02-02 | Hồ sơ trẻ (G1) | VT-12, VT-03 | Thông tin định danh, ngày sinh, giới tính, địa chỉ, số định danh cá nhân, bản chụp giấy khai sinh, mã định danh do cơ sở dữ liệu ngành cấp, ghi chú | Tạo, sửa, trình duyệt; kiểm tra số định danh không trùng; tô đỏ khi chưa có mã ngành; che số định danh với vai trò không được xem đầy đủ | Hồ sơ trẻ hoàn chỉnh | BR-06, BR-07, BR-81 |
| P02-03 | Hồ sơ phụ huynh và quan hệ với trẻ (G1) | VT-12, VT-03 | Họ tên, quan hệ, số điện thoại, nghề nghiệp | Gắn phụ huynh vào trẻ, đặt phụ huynh liên hệ chính; phụ huynh có số điện thoại được tạo tài khoản với mật khẩu mặc định chung | Danh sách phụ huynh của trẻ | BR-08, PQ-06 |
| P02-04 | Người được ủy quyền đón trẻ (G1) | VT-14, VT-02, VT-15, VT-03 | Họ tên, quan hệ, số điện thoại, hiệu lực từ ngày đến ngày | Khai báo và hủy ủy quyền; phụ huynh khai báo cho con mình (YCTD-48) | Danh sách người được ủy quyền | BR-11 |
| P02-05 | Lớp học (G1) | VT-03 | Tên lớp, khối, đơn vị, năm học, một hoặc nhiều giáo viên chủ nhiệm và giáo viên bộ môn chọn theo tài khoản (YCTD-44), sĩ số tối đa | Tạo, sửa, đóng lớp, phân công giáo viên | Danh sách lớp | BR-02, BR-04 |
| P02-06 | Phân lớp và chuyển lớp (G1) | VT-03 | Trẻ, lớp đích, ngày hiệu lực, lý do | Ghi thêm lịch sử lớp của trẻ | Lịch sử lớp của trẻ | BR-03 |
| P02-07 | Chuyển đơn vị (G1) | VT-03, VT-02 | Trẻ, đơn vị đích, ngày hiệu lực | Kiểm tra công nợ, ghi lịch sử | Hồ sơ trẻ ở đơn vị mới | LP-02, BR-32 |
| P02-08 | Thôi học và quyết toán (G1) | VT-03, VT-04, VT-02 | Trẻ, ngày thôi học, lý do, kết quả quyết toán | Đổi trạng thái, chốt công nợ, thu hồi tài sản; khoản thu vượt được bù trừ hoặc hoàn tiền theo quyết định của Hiệu trưởng, phiếu chi hoàn tiền do Hiệu trưởng phê duyệt | Trẻ ở trạng thái thôi học | LP-03, BR-10, BR-24 |
| P02-09 | Cờ trẻ con nhân viên và đồng ý sử dụng hình ảnh (G1) | VT-03, VT-14 | Trẻ, nhân sự liên quan; đồng ý hoặc rút đồng ý hình ảnh, cách đồng ý, bản chụp giấy ký tay | Phụ huynh đồng ý hoặc rút đồng ý trên ứng dụng; nhà trường ghi nhận giấy ký tay; lưu người và thời điểm | Cờ và lịch sử đồng ý trên hồ sơ trẻ | BR-09, BR-65 |
| P02-10 | Danh sách trẻ theo lớp của giáo viên (G1) | VT-07, VT-08 | Lớp được phân công | Truy vấn giới hạn theo phân công | Danh sách trẻ trong lớp | BR-72 |
| P02-11 | Đồ bị mất của trẻ (G2) | VT-14, VT-07, VT-03 | Trẻ, mô tả đồ, ngày phát hiện, hình ảnh | Phụ huynh báo mất đồ hoặc giáo viên ghi nhận đồ nhặt được; đối chiếu, xác nhận đã trả hoặc không tìm thấy | Phiếu đồ bị mất ở trạng thái đã báo, đã tìm thấy, đã trả hoặc không tìm thấy | BR-72, BR-75 |
| P02-12 | Nhập mã định danh ngành từ tệp (G1) | VT-12, VT-03 | Tệp theo mẫu của hệ thống gồm số định danh cá nhân, mã định danh ngành, họ tên, chép từ tệp xuất của cơ sở dữ liệu ngành (YCTD-46) | Đối chiếu theo số định danh cá nhân, gán mã ngành, báo dòng không khớp hoặc trùng; kết nối tự động để giai đoạn 3 (G3-09) | Mã ngành trên hồ sơ trẻ | BR-07 |

## 4. Phân hệ P03 — Giảng dạy

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P03-01 | Bài học (G2) | VT-07, VT-08 | Tên bài, chủ đề, độ tuổi, mục tiêu, học liệu | Tạo, sửa, chia sẻ bài học | Danh sách bài học | BR-01 |
| P03-02 | Giáo án (G2) | VT-07, VT-08, VT-17 | Bài học, hoạt động, thời lượng, học liệu | Soạn, trình duyệt; tổ trưởng chuyên môn duyệt trước, quản lý đơn vị duyệt sau và công bố | Giáo án đã duyệt | BR-64 |
| P03-03 | Chủ đề (G2) | VT-03, VT-07 | Tên chủ đề, khoảng thời gian | Tạo và gán bài học vào chủ đề | Danh sách chủ đề | BR-01 |
| P03-04 | Thời khóa biểu (G2) | VT-03, VT-07 | Lớp, tuần, tiết, môn hoặc hoạt động, giáo viên | Lập và công bố thời khóa biểu | Thời khóa biểu theo lớp và tuần | BR-69 |
| P03-05 | Kế hoạch giảng dạy (G2) | VT-07, VT-03 | Kỳ, lớp, mục tiêu, nội dung dự kiến | Lập và theo dõi kế hoạch | Kế hoạch giảng dạy của kỳ | BR-01 |
| P03-06 | Tiến độ học tập của trẻ (G2) | VT-07 | Trẻ, chỉ số phát triển, nhận xét theo kỳ | Ghi nhận và công bố cho phụ huynh | Phiếu tiến độ của trẻ | BR-15 |
| P03-07 | Lịch hoạt động lớp (G2) | VT-07 | Lớp, ngày, hoạt động | Lập lịch và công bố | Lịch hoạt động của lớp | BR-69 |
| P03-08 | Lĩnh vực và nhóm bài học (G2) | VT-03, VT-07 | Tên lĩnh vực, tên nhóm bài học, thứ tự | Quản lý hai danh mục, gán bài học vào lĩnh vực và nhóm | Danh mục lĩnh vực và nhóm bài học | BR-01, BR-75 |

## 5. Phân hệ P04 — Điểm danh và chăm sóc hằng ngày

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P04-01 | Điểm danh trong ngày (G1) | VT-07 | Lớp, ngày, trạng thái từng trẻ | Ghi bản ghi điểm danh, chống trùng theo trẻ và ngày; lưu tạm khi mất mạng và gửi lại khi có mạng (Q-09); ngày thứ bảy học bù điểm danh như ngày thường | Bảng điểm danh trong ngày | BR-12, BR-16, BR-84 |
| P04-02 | Báo vắng (G1) | VT-14, VT-07 | Trẻ, ngày, lý do, có báo trước hay không | Ghi nhận nghỉ, đánh dấu nghỉ có báo | Bản ghi nghỉ của trẻ | BR-13 |
| P04-03 | Đón trả trẻ (G1) | VT-07, VT-18, VT-14 | Trẻ, thời điểm, người đón, quan hệ, ảnh bàn giao | Giáo viên chủ nhiệm ghi nhận bàn giao chiều; người ngoài danh sách cần phụ huynh xác nhận trên ứng dụng; bảo vệ xác nhận người đón tại cổng theo danh sách ủy quyền (YCTD-48) | Nhật ký đón trả | BR-11, BR-56 |
| P04-04 | Nhật ký của bé (G1) | VT-07 | Trẻ, ngày, nội dung ăn, ngủ, vệ sinh, tâm trạng | Ghi nhật ký, công bố cho phụ huynh của trẻ | Nhật ký trong ngày | BR-15 |
| P04-05 | Ghi nhận ăn, ngủ, vệ sinh (G1) | VT-07 | Trẻ, bữa, số lượng ăn, thời lượng ngủ | Ghi nhận chi tiết trong ngày | Chi tiết chăm sóc | BR-15 |
| P04-06 | Chốt điểm danh ngày (G1) | VT-07, VT-03 | Ngày, lớp | Khóa bản ghi trong ngày, cho phép sửa kèm lý do | Số liệu điểm danh đã chốt | BR-12 |

## 6. Phân hệ P05 — Học phí, khoản thu và giảm trừ

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P05-01 | Biểu phí (G1) | VT-04 | Khối lớp, loại phí, mức phí, khoảng hiệu lực; dùng chung cho mọi đơn vị | Tạo phiên bản biểu phí | Biểu phí theo khoảng thời gian | BR-17, BR-18 |
| P05-02 | Danh mục dịch vụ (G1) | VT-04 | Tên dịch vụ, đơn vị tính, cách tính, dịch vụ bắt buộc hay không | Tạo và ngừng sử dụng dịch vụ | Danh mục dịch vụ | BR-19, BR-83 |
| P05-03 | Đăng ký dịch vụ theo tháng (G1) | VT-04, VT-14 | Trẻ, kỳ, danh sách dịch vụ đăng ký | Lưu đăng ký, kiểm tra ngày chốt; bán trú luôn được đăng ký; đăng ký trễ dịch vụ không bắt buộc phải ghi ngày bắt đầu học dịch vụ, chuyển Ban Giám hiệu duyệt kèm cách thu phí (Q-150); hủy sau ngày chốt cũng chờ Ban Giám hiệu duyệt; dịch vụ không bắt buộc tự giữ sang tháng sau tới khi hủy, trừ tháng hè (YCTD-49, YCTD-50); chặn phụ huynh đăng ký thêm khi trẻ còn nợ quá hạn nếu đơn vị bật | Bản đăng ký của trẻ trong kỳ | BR-26, BR-33, BR-83 |
| P05-04 | Chốt danh sách đăng ký (G1) | VT-04 | Kỳ, đơn vị | Khóa đăng ký của kỳ | Danh sách đăng ký đã chốt | BR-26 |
| P05-05 | Tính học phí kỳ (G1) | VT-04 | Kỳ, đơn vị, biểu phí, đăng ký, điểm danh, giảm trừ | Tính khoản phải thu cho từng trẻ; chặn tính và liệt kê lớp, ngày khi còn ngày trong kỳ chưa chốt điểm danh (Q-151) | Bảng tính học phí của kỳ | BR-17, BR-19, BR-23 |
| P05-06 | Phát hành khoản phải thu (G1) | VT-04 | Bảng tính đã kiểm tra; khoản phát sinh sau phát hành | Sinh hóa đơn chính và các dòng khoản phải thu; lập hóa đơn bổ sung cùng kỳ cho khoản phát sinh sau khi đã phát hành | Hóa đơn của từng trẻ | BR-25, BR-85 |
| P05-07 | Miễn giảm và học phí đặc biệt (G1) | VT-04, VT-15, VT-02 | Trẻ, kỳ, loại giảm trừ, căn cứ | Kế toán lập, Ban Giám hiệu phê duyệt theo hạn mức; áp dụng giảm trừ, lưu căn cứ và kết quả | Dòng giảm trừ trên hóa đơn | BR-20, BR-21, BR-22, BR-77 |
| P05-08 | Điều chỉnh hóa đơn (G1) | VT-04, VT-05, VT-15, VT-02 | Hóa đơn gốc, lý do, nội dung điều chỉnh | Sinh phiếu điều chỉnh liên kết hóa đơn gốc, Ban Giám hiệu phê duyệt theo hạn mức | Phiếu điều chỉnh | BR-25, BR-77 |
| P05-09 | Xem công nợ của trẻ (G1) | VT-14, VT-04 | Trẻ, kỳ | Tính số dư công nợ | Bảng công nợ của trẻ | BR-32 |
| P05-10 | Danh sách nhắc nợ (G2) | VT-04, VT-03 | Kỳ, mốc quá hạn | Lọc công nợ quá hạn theo mốc | Danh sách cần nhắc nợ | BR-33 |
| P05-11 | Danh mục loại miễn giảm (G1) | VT-04, VT-02 | Mã, tên loại miễn giảm, cách tính theo phần trăm hoặc số tiền, mức, khoản thu áp dụng, điều kiện | Tạo, sửa, ngừng sử dụng loại miễn giảm; P05-07 chỉ chọn loại trong danh mục | Danh mục loại miễn giảm | BR-20, BR-21, BR-75 |
| P05-12 | Xử lý công nợ quá hạn (G2) | VT-03, VT-04, VT-15, VT-02 | Trẻ, kỳ quá hạn, nội dung đề xuất | Quản lý đơn vị hoặc kế toán lập đề xuất; Phó Hiệu trưởng hoặc Hiệu trưởng ghi quyết định; không thay đổi số tiền công nợ | Đề xuất và quyết định xử lý | BR-33, YCTD-23 |
| P05-13 | Đăng ký học hè (G1) | VT-14, VT-04 | Trẻ, các tháng hè đăng ký | Đăng ký trẻ học hè theo từng tháng trong kỳ hè; trẻ đã đăng ký thì điểm danh và tính học phí như tháng thường | Danh sách trẻ học hè theo tháng | BR-92 |

## 7. Phân hệ P06 — Tài chính

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P06-01 | Phiếu thu (G1) | VT-04, VT-16 | Trẻ, người nộp, số tiền, phương thức, nội dung | Sinh phiếu thu, cấp số phiếu | Phiếu thu đã phát hành | BR-28, BR-30 |
| P06-02 | Phân bổ phiếu thu (G1) | VT-04, VT-16 | Phiếu thu, danh sách khoản phải thu | Phân bổ số tiền vào từng khoản; thủ quỹ phân bổ khi lập phiếu thu tiền mặt (Q-152) | Chi tiết phân bổ | BR-31, BR-32 |
| P06-03 | Đảo phiếu thu (G1) | VT-04, VT-05, VT-15, VT-02 | Phiếu thu gốc, lý do | Sinh phiếu đảo tham chiếu phiếu gốc ở trạng thái chờ duyệt; Ban Giám hiệu phê duyệt theo hạn mức; công nợ chỉ thay đổi khi đã duyệt | Phiếu đảo | BR-29, BR-77 |
| P06-04 | Phiếu chi (G1) | VT-04, VT-05, VT-16 | Người nhận, số tiền, nội dung, chứng từ | Sinh phiếu chi, trình Ban Giám hiệu duyệt theo hạn mức; phiếu chi hoàn tiền khi trẻ thôi học do Hiệu trưởng duyệt; chặn khi quỹ tiền mặt không đủ; phiếu đảo phiếu chi chờ Ban Giám hiệu duyệt theo hạn mức (YCTD-24) | Phiếu chi đã duyệt | BR-24, BR-28, BR-34, BR-77 |
| P06-05 | Quỹ tiền mặt (G1) | VT-04, VT-05, VT-16 | Phiếu thu, phiếu chi, phiếu nộp, phiếu rút | Tính số dư quỹ theo thời điểm | Sổ quỹ | BR-34 |
| P06-06 | Tài khoản ngân hàng và lịch sử giao dịch (G2) | VT-04, VT-05 | Tài khoản, số dư đầu, giao dịch | Ghi nhận giao dịch, đối chiếu | Sổ ngân hàng | BR-34 |
| P06-07 | Công nợ phải trả (G2) | VT-04, VT-05 | Nhà cung cấp, chứng từ, số tiền, hạn thanh toán | Ghi nhận và theo dõi công nợ phải trả | Bảng công nợ phải trả | BR-36 |
| P06-08 | Báo cáo thu chi (G1) | VT-02, VT-03, VT-04 | Đơn vị, khoảng ngày, loại thu chi | Tổng hợp theo nhóm và theo kỳ | Báo cáo thu chi | BR-36 |
| P06-09 | Chốt kỳ tài chính (G2) | VT-05, VT-02 | Kỳ, đơn vị | Kế toán trưởng đề nghị chốt, Hiệu trưởng phê duyệt; khóa số liệu của kỳ, chặn sửa ngược | Kỳ đã chốt | BR-25, BR-29, BR-77 |
| P06-10 | Khoản mục và nhóm thu chi (G1) | VT-04, VT-05 | Mã, tên khoản mục, nhóm thu chi, loại thu hoặc chi | Quản lý danh mục; phiếu thu và phiếu chi bắt buộc chọn khoản mục | Danh mục khoản mục thu chi | BR-36 |
| P06-11 | Thanh toán trực tuyến bằng mã QR (G1) | VT-14, VT-04 | Hóa đơn, số còn phải nộp | Xin nhà cung cấp tài khoản ảo và mã QR dùng một lần theo hóa đơn với số tiền bằng số còn phải nộp, nội dung là mã hóa đơn; tiền về tài khoản duy nhất của trường; nhận thông báo tiền vào, đối chiếu, tự lập phiếu thu và phân bổ; giao dịch không khớp chuyển kế toán xử lý (YCTD-57) | Phiếu thu tự động, hóa đơn đã thu đủ | BR-28, BR-31 |

## 8. Phân hệ P07 — Nhân sự

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P07-01 | Hồ sơ nhân sự (G1) | VT-06 | Thông tin định danh, liên hệ, phòng ban, chức danh, đơn vị chính | Tạo, sửa, ngừng sử dụng hồ sơ | Hồ sơ nhân sự | BR-37 |
| P07-02 | Hợp đồng lao động (G1) | VT-06 | Loại hợp đồng, ngày bắt đầu, ngày kết thúc, lương thỏa thuận, phụ cấp | Tạo, gia hạn, chấm dứt hợp đồng; chấm dứt hợp đồng thì chuyển kế toán lập bảng quyết toán cuối cùng | Hợp đồng và lịch sử hợp đồng | BR-38, BR-05, BR-90 |
| P07-03 | Quá trình công tác và chứng chỉ (G2) | VT-06 | Mốc công tác, chức danh, chứng chỉ, ngày cấp | Ghi thêm lịch sử | Lịch sử công tác | BR-37 |
| P07-04 | Danh sách nhân sự theo đơn vị và phòng ban (G1) | VT-03, VT-06 | Bộ lọc đơn vị, phòng ban, chức danh, trạng thái | Truy vấn theo quyền | Danh sách nhân sự | BR-01, BR-72 |

## 9. Phân hệ P08 — Chấm công và tiền lương

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P08-01 | Chấm công (G1) | VT-06, mọi nhân sự có hồ sơ liên kết tài khoản | Nhân sự, ngày, giờ vào, giờ ra, ghi chú | Nhân sự tự vào ca, ra ca hôm nay theo giờ máy chủ; phòng nhân sự nhập hoặc sửa giờ có nhật ký; tính số phút làm, đi muộn, về sớm theo giờ làm của đơn vị (YCTD-59) | Bảng công theo tháng | BR-39 |
| P08-02 | Lịch nghỉ và lịch công tác (G1) | VT-06, VT-03 | Nhân sự, ngày, loại, ghi chú | Lập và công bố lịch | Lịch nghỉ và công tác | BR-40 |
| P08-03 | Đơn xin nghỉ phép (G1) | Mọi nhân sự có hồ sơ liên kết tài khoản, VT-06, VT-15, VT-02 | Nhân sự, loại nghỉ, khoảng thời gian, nửa ngày ở ngày đầu hoặc ngày cuối, lý do | Nhân sự tự gửi hoặc phòng nhân sự lập hộ; Hiệu trưởng hoặc Phó Hiệu trưởng duyệt (YCTD-58); số ngày chỉ đếm ngày làm việc; duyệt đơn phép năm thì trừ số ngày phép (YCTD-59) | Đơn nghỉ đã duyệt | BR-40, BR-41 |
| P08-04 | Chốt bảng công (G1) | VT-06, VT-15, VT-02 | Đơn vị, tháng | Chốt từ mùng 1 tháng sau khi không còn đơn chờ duyệt; ghi từng ngày đi làm, nghỉ theo đơn, vắng không phép, nghỉ lễ, nghỉ bù, giờ làm thêm; kỳ đã chốt chặn sửa; mở lại phải được Ban Giám hiệu duyệt (Q-135, YCTD-59) | Bảng công đã chốt | LE-07, BR-39, BR-82 |
| P08-05 | Ứng lương — Bỏ ngày 09/10/2026: nhà trường không cho ứng lương (Q-54) | — | — | — | — | — |
| P08-06 | Bảng lương (G1) | VT-04, VT-06, VT-15, VT-02 | Tháng M, lương hợp đồng, phụ cấp, thưởng, khấu trừ, bảng công đã chốt của tháng M−1 | Một bảng lương toàn trường mỗi tháng; đầu tháng M tính bảng lương trả trước kèm điều chỉnh theo công tháng M−1; chặn khi còn đơn vị chưa chốt công tháng M−1; thuế thu nhập cá nhân lũy tiến; Ban Giám hiệu phê duyệt theo hạn mức của Trường chính (YCTD-29, YCTD-60); lập phiếu chi lương và bảng quyết toán ở phần 6c-2 | Bảng lương của tháng | BR-43, BR-44, BR-77, BR-90 |
| P08-07 | Lương thưởng và khấu trừ (G2) | VT-04, VT-05 | Loại thưởng, loại khấu trừ, căn cứ | Ghi nhận các khoản thưởng và khấu trừ | Chi tiết bảng lương | BR-44, BR-45 |
| P08-08 | Phiếu lương của nhân sự (G1) | Mọi vai trò nhân sự | Kỳ | Hiển thị chi tiết lương của chính mình | Phiếu lương | BR-46 |
| P08-09 | Ngày nghỉ lễ (G1) | VT-06 gán ở Trường chính | Ngày, tên ngày lễ, có hưởng lương hay không | Lập lịch nghỉ lễ chung toàn trường; ngày lễ không là ngày học của trẻ và là ngày nghỉ lễ của nhân sự (YCTD-59) | Lịch nghỉ lễ | BR-39, BR-84 |
| P08-10 | Lịch học bù và nghỉ bù (G1) | VT-02, VT-15 | Ngày, loại lịch (học bù thứ bảy hoặc nghỉ bù thứ hai đến thứ sáu), ghi chú | Thứ bảy mặc định nghỉ; Ban Giám hiệu bổ sung từng ngày vào lịch chung toàn trường; học bù là ngày học của mọi lớp và ngày làm việc của mọi nhân sự; nghỉ bù trẻ nghỉ, nhân sự nghỉ có lương; áp dụng khi điểm danh, tính học phí và chấm công (YCTD-59) | Lịch học bù và nghỉ bù | BR-39, BR-84 |
| P08-11 | Danh mục khấu trừ và quy định số ngày phép năm (G1) | VT-06, VT-04 | Loại khấu trừ, cách tính, tỷ lệ hoặc số tiền; chức danh, khoảng thâm niên, số ngày phép | Cấu hình danh mục khấu trừ dùng khi tính lương (phần 6c); quy định phép năm chung toàn trường do phòng nhân sự gán ở Trường chính lập, cấp theo năm dương lịch (YCTD-59) | Danh mục khấu trừ, bảng quy định phép năm | BR-41, BR-44 |
| P08-12 | Tiền làm thêm giờ (G1) | VT-06, VT-04 | Chấm công đã chốt, giờ làm chuẩn, hệ số làm thêm | Tính phần vượt giờ chuẩn, tối đa 1 giờ mỗi ngày, tiền bằng lương giờ nhân hệ số, đưa vào bảng lương của tháng kế tiếp (YCTD-60) | Dòng làm thêm trên bảng lương | BR-82 |

## 10. Phân hệ P09 — Công việc, kế hoạch và đánh giá

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P09-01 | Giao việc (G2) | VT-03, VT-06 | Người nhận, nội dung, hạn, mức ưu tiên, tệp đính kèm | Tạo việc, gửi thông báo cho người nhận | Danh sách việc được giao | BR-70 |
| P09-02 | Công việc cá nhân (G2) | Mọi vai trò nhân sự | Nội dung, hạn, trạng thái | Tạo và cập nhật việc của chính mình | Danh sách việc cá nhân | BR-46 |
| P09-03 | Kế hoạch (G2) | VT-03 | Kỳ, mục tiêu, đầu việc, người phụ trách | Lập kế hoạch và theo dõi | Kế hoạch của kỳ | BR-01 |
| P09-04 | Theo dõi tiến độ (G2) | VT-03, VT-06 | Trạng thái, phần trăm hoàn thành, ghi chú | Cập nhật và tổng hợp tiến độ | Bảng tiến độ | BR-01 |
| P09-05 | Đánh giá theo kỳ và chỉ số (G2) | VT-03, VT-06 | Kỳ, chỉ số, điểm, nhận xét | Tính kết quả đánh giá, công bố | Phiếu đánh giá | BR-47 |

## 11. Phân hệ P10 — Y tế học đường

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P10-01 | Hồ sơ sức khỏe trẻ (G2) | VT-09 | Chiều cao, cân nặng, dị ứng, bệnh nền, thị lực | Ghi nhận và cập nhật theo lần đo | Hồ sơ sức khỏe | BR-51, BR-53 |
| P10-02 | Danh mục thuốc (G2) | VT-09 | Tên thuốc, hoạt chất, đơn vị, nhà thuốc | Quản lý danh mục và số lượng | Danh mục thuốc | BR-48 |
| P10-03 | Yêu cầu dặn thuốc (G2) | VT-14 | Tên thuốc, liều, giờ, số ngày, ghi chú, ít nhất một ảnh thuốc, ảnh đơn thuốc nếu có | Tiếp nhận yêu cầu, kiểm tra thông tin bắt buộc; chuyển cho y tế, hoặc giáo viên chủ nhiệm khi đơn vị không có nhân viên y tế | Phiếu dặn thuốc ở trạng thái chờ nhận | BR-48, BR-86 |
| P10-04 | Nhận thuốc và cho uống thuốc (G2) | VT-09, VT-07 | Phiếu dặn thuốc, thuốc thực nhận, thời điểm cho uống | Xác nhận nhận thuốc, ghi nhận từng liều; VT-07 chỉ khi đơn vị bật cấu hình không có nhân viên y tế; phụ huynh xác nhận đã biết thông báo bỏ liều | Nhật ký cho uống thuốc | BR-49, BR-50, BR-86, BR-88 |
| P10-05 | Đề nghị mua thuốc và cấp thuốc (G2) | VT-09, VT-04 | Thuốc cần, số lượng, lý do | Trình duyệt, chuyển mua hoặc cấp từ kho | Phiếu mua hoặc phiếu cấp thuốc | BR-63 |
| P10-06 | Khám sức khỏe định kỳ và kết quả (G2) | VT-09 | Đợt khám, trẻ, kết quả từng chỉ số | Ghi kết quả theo đợt, công bố cho phụ huynh | Phiếu kết quả khám | BR-51 |
| P10-07 | Sự kiện y tế và chăm sóc (G2) | VT-09, VT-07, VT-14 | Trẻ, thời điểm, triệu chứng, xử lý, người xử lý | Ghi nhận sự kiện, thông báo phụ huynh; phụ huynh xác nhận đã biết, y tế và giáo viên thấy trạng thái xác nhận | Bản ghi sự kiện y tế | BR-52, BR-88 |
| P10-08 | Yêu cầu báo cáo sức khỏe (G2) | VT-14, VT-09 | Trẻ, loại báo cáo, kỳ | Tổng hợp và gửi báo cáo | Báo cáo sức khỏe của trẻ | BR-53 |
| P10-09 | Phiếu mua thuốc và thuốc đã mua (G2) | VT-09, VT-04 | Đề nghị mua thuốc đã duyệt, nhà thuốc, thuốc, số lượng, đơn giá | Lập phiếu mua thuốc, ghi nhận thuốc đã mua, tăng số lượng trong danh mục thuốc; thanh toán qua phiếu chi theo QT-05 | Phiếu mua thuốc | BR-63, BR-28 |
| P10-10 | Lịch khám sức khỏe (G2) | VT-09 | Đợt khám, ngày, lớp, nơi khám | Lập lịch khám theo đợt, thông báo phụ huynh của trẻ trong lớp | Lịch khám | BR-51, BR-69 |
| P10-11 | Tiêu chuẩn sức khỏe (G2) | VT-09 | Độ tuổi, giới tính, chỉ số, ngưỡng dưới, ngưỡng trên theo tiêu chuẩn của Bộ Y tế | Quản lý bảng tiêu chuẩn theo Bộ Y tế; so sánh kết quả khám với tiêu chuẩn | Bảng tiêu chuẩn và đánh giá chỉ số | BR-51 |
| P10-12 | Theo dõi chăm sóc hằng ngày (G2) | VT-07, VT-09, VT-14 | Trẻ, ngày, thời điểm, nhiệt độ, tình trạng, chăm sóc đặc biệt theo lưu ý của phụ huynh | Giáo viên chủ nhiệm hoặc y tế ghi nhận; phụ huynh của trẻ xem trên ứng dụng | Nhật ký chăm sóc hằng ngày | BR-53, BR-87 |

## 12. Phân hệ P11 — Xe đưa đón (đã bỏ ngày 09/10/2026)

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P11-01 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | — | — | — |
| P11-02 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | — | — | — |
| P11-03 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | — | — | — |
| P11-04 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | — | — | — |
| P11-05 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | — | — | — |
| P11-06 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | — | — | — |
| P11-07 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | — | — | — |

## 13. Phân hệ P12 — Bếp và dinh dưỡng

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P12-01 | Món ăn (G2) | VT-10 | Tên món, nhóm chất, nguyên liệu, cách chế biến | Quản lý danh mục món ăn | Danh mục món ăn | BR-60 |
| P12-02 | Thực đơn theo tuần (G2) | VT-10 | Tuần, bữa, món, đối tượng độ tuổi | Lập thực đơn theo tuần | Thực đơn tuần | BR-59 |
| P12-03 | Duyệt và công bố thực đơn (G2) | VT-03 | Thực đơn tuần | Trình duyệt và công bố cho phụ huynh | Thực đơn đã công bố | BR-59, BR-69 |
| P12-04 | Định lượng nguyên liệu (G2) | VT-10 | Thực đơn, số suất, định mức trên một suất | Tính nhu cầu nguyên liệu | Bảng định lượng | BR-60 |
| P12-05 | Suất ăn theo ngày (G2) | VT-10 | Ngày, đơn vị, điểm danh | Tính số suất của ba bữa sáng, trưa, xế bằng số trẻ có mặt | Số suất ăn của ngày | BR-58 |
| P12-06 | Buffet theo dịp (G2) | VT-10, VT-03 | Dịp tổ chức, ngày, lớp hoặc toàn trường, thực đơn | Lập kế hoạch tiệc buffet theo dịp; nằm trong tiền ăn, không đăng ký, không thu riêng | Lịch buffet | BR-83 |
| P12-07 | Báo cơm (G2) | VT-07, VT-10 | Lớp, ngày | Tổng hợp số trẻ có mặt từ điểm danh gửi bếp; phần đăng ký ăn tối bỏ ngày 09/10/2026 (YCTD-20) | Danh sách báo cơm | BR-58 |
| P12-08 | Nhà cung cấp thực phẩm (G2) | VT-10, VT-04 | Nhà cung cấp, nhóm thực phẩm cung cấp | Dùng chung danh mục nhà cung cấp, đánh dấu nhà cung cấp thực phẩm | Danh sách nhà cung cấp thực phẩm | BR-63 |
| P12-09 | Phiếu đi chợ (G2) | VT-10 | Ngày, nhà cung cấp, nguyên liệu, số lượng, đơn giá | Lập phiếu đi chợ từ định lượng của ngày, xác nhận nhập nguyên liệu, chuyển đề nghị thanh toán theo QT-05 | Phiếu đi chợ | BR-60, BR-63, BR-28 |

## 14. Phân hệ P13 — Kho, tài sản và mua hàng

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P13-01 | Danh mục tài sản (G2) | VT-11 | Mã tài sản, tên, nhóm, đơn vị, nguyên giá, ngày nhập | Tạo và cập nhật tài sản | Danh mục tài sản | BR-61 |
| P13-02 | Cấp phát và thu hồi (G2) | VT-11 | Tài sản, đơn vị, phòng hoặc lớp, người nhận | Sinh phiếu cấp phát và phiếu thu hồi | Phiếu cấp phát và thu hồi | BR-61 |
| P13-03 | Mượn trả (G2) | VT-11 | Tài sản, người mượn, thời hạn | Ghi nhận mượn, trả, quá hạn | Phiếu mượn trả | BR-61 |
| P13-04 | Ghi nhận hỏng và mất (G2) | VT-11 | Tài sản, loại sự việc, mức độ, đề xuất xử lý | Ghi nhận, trình duyệt xử lý | Bản ghi hỏng hoặc mất | BR-61 |
| P13-05 | Đề nghị mua hàng (G2) | Mọi vai trò nhân sự | Mặt hàng, số lượng, lý do, thời hạn cần | Trình duyệt theo hạn mức | Đề nghị đã duyệt hoặc từ chối | BR-63 |
| P13-06 | Phiếu mua hàng (G2) | VT-11, VT-04 | Nhà cung cấp, mặt hàng, số lượng, đơn giá | Lập phiếu, ghi nhận công nợ phải trả | Phiếu mua hàng | BR-63 |
| P13-07 | Nhà cung cấp (G2) | VT-11, VT-04 | Tên, mã số thuế, liên hệ, điều khoản | Quản lý danh mục nhà cung cấp | Danh mục nhà cung cấp | BR-63 |
| P13-08 | Nhập xuất tồn kho (G2) | VT-11 | Phiếu nhập, phiếu xuất, mặt hàng, số lượng | Tính tồn kho theo thời điểm | Sổ kho | BR-62 |
| P13-09 | Kiểm kê (G2) | VT-11, VT-05 | Kỳ kiểm kê, số lượng thực tế | Đối chiếu và ghi nhận chênh lệch | Biên bản kiểm kê | LP-12, BR-62 |
| P13-10 | Tồn kho ban đầu (G2) | VT-11 | Mặt hàng hoặc tài sản, số lượng, đơn giá, ngày khóa sổ | Nhập một lần khi bắt đầu dùng hệ thống; khóa sau khi xác nhận | Số tồn ban đầu | BR-62 |

## 15. Phân hệ P14 — Hoạt động, nội dung và truyền thông

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P14-01 | Hoạt động của lớp (G2) | VT-07, VT-08 | Tiêu đề, nội dung, hình ảnh, lớp, danh mục | Tạo hoạt động ở trạng thái chờ duyệt | Hoạt động chờ duyệt | BR-64 |
| P14-02 | Duyệt hoạt động (G2) | VT-03, VT-15, VT-02 | Hoạt động chờ duyệt, quyết định | Duyệt, từ chối kèm lý do, công bố; ẩn hoạt động đã công bố kèm lý do và công bố lại (Q-72) | Hoạt động đã công bố | BR-64 |
| P14-03 | Danh mục hoạt động (G2) | VT-03 | Tên danh mục, thứ tự | Quản lý danh mục | Danh mục hoạt động | BR-01 |
| P14-04 | Hình ảnh và album (G2) | VT-07, VT-03 | Tệp hình ảnh, album, lớp, chủ đề | Tải lên, gắn thẻ trẻ, kiểm tra cờ đồng ý hình ảnh | Album hình ảnh | BR-65 |
| P14-05 | Tin tức và danh mục tin tức (G2) | VT-03 | Tiêu đề, nội dung, ảnh, phạm vi công bố | Soạn và công bố tin tức | Danh sách tin tức | BR-69 |
| P14-06 | Thư viện và chủ đề (G2) | VT-03, VT-07 | Tài liệu, chủ đề, độ tuổi | Quản lý nội dung thư viện | Danh sách nội dung thư viện | BR-69 |
| P14-07 | Thông báo và mức độ đã đọc (G1) | VT-03, VT-06 | Tiêu đề, nội dung, đối tượng nhận, mức độ quan trọng | Gửi thông báo, ghi nhận ai đã đọc | Danh sách thông báo và tỷ lệ đã đọc | BR-70 |
| P14-08 | Tài khoản Facebook và Fanpage (G3) | VT-03 | Liên kết tài khoản, quyền đăng | Kết nối và đăng nội dung đã duyệt | Bài đăng trên Fanpage | BR-64 |
| P14-09 | Hình tô màu (G2) | VT-03, VT-07 | Tệp hình, chủ đề, độ tuổi | Quản lý và công bố cho phụ huynh | Bộ hình tô màu | BR-69 |
| P14-10 | Hoạt động ngoại khóa (G2) | VT-03, VT-07 | Tên, mô tả, thời gian, đối tượng, chỉ tiêu, mức phí, cách thu phí theo từng hoạt động hoặc theo tháng | Tạo và công bố hoạt động ngoại khóa | Danh sách hoạt động ngoại khóa | BR-69 |
| P14-11 | Đăng ký hoạt động ngoại khóa (G2) | VT-14, VT-07, VT-04 | Trẻ, hoạt động ngoại khóa | Đăng ký, kiểm tra chỉ tiêu; phí theo từng hoạt động đưa vào khoản phải thu một lần, lập hóa đơn bổ sung nếu hóa đơn chính của kỳ đã phát hành (BR-85), phí theo tháng đưa vào khoản phải thu mỗi kỳ khi đăng ký còn hiệu lực, không giảm trừ khi trẻ nghỉ buổi hoặc thôi tham gia giữa tháng | Danh sách đăng ký tham gia | BR-19, BR-72 |
| P14-12 | Album thư viện và bình luận nội dung (G2) | VT-03, VT-07, VT-14 | Album, chủ đề, nội dung bình luận trên thư viện và tin tức | Quản lý album trong thư viện; ghi nhận bình luận, không cho xóa bình luận của phụ huynh | Album và luồng bình luận | BR-66, BR-69 |

## 16. Phân hệ P15 — Tương tác và ý kiến

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P15-01 | Trao đổi hai chiều (G2) | VT-07, VT-14, VT-03 | Người nhận, nội dung, tệp đính kèm | Gửi, nhận, đánh dấu đã đọc, lưu lịch sử | Luồng trao đổi | BR-70 |
| P15-02 | Góp ý (G2) | VT-14, VT-07 | Nội dung, chủ đề, mức độ riêng tư | Tiếp nhận, chuyển người xử lý, ghi kết quả | Phiếu góp ý và kết quả xử lý | BR-66 |
| P15-03 | Bình chọn và kết quả (G2) | VT-03, VT-14 | Câu hỏi, lựa chọn, thời gian, đối tượng | Nhận phiếu, chặn trùng, công bố kết quả | Kết quả bình chọn | BR-67, BR-68 |
| P15-04 | Biểu quyết và kết quả (G2) | VT-03, VT-14 | Nội dung, phương án, thời gian, đối tượng | Nhận phiếu, chặn trùng, công bố kết quả | Kết quả biểu quyết | BR-67, BR-68 |
| P15-05 | Khảo sát và danh mục khảo sát (G2) | VT-03, VT-14 | Bộ câu hỏi, loại câu trả lời, thời gian | Nhận phản hồi, tổng hợp kết quả | Báo cáo khảo sát | BR-67, BR-68 |
| P15-06 | Bình luận và lượt thích (G2) | VT-14, VT-07 | Đối tượng, nội dung bình luận | Ghi nhận bình luận, không cho xóa bình luận của phụ huynh | Luồng bình luận | BR-66 |

## 17. Phân hệ P16 — Tuyển sinh

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P16-01 | Đợt tuyển sinh (G3) | VT-12, VT-03 | Tên đợt, đơn vị, chỉ tiêu, thời gian nhận hồ sơ | Mở và đóng đợt tuyển sinh | Danh sách đợt | BR-01 |
| P16-02 | Hồ sơ tuyển sinh (G3) | VT-12 | Thông tin trẻ, phụ huynh, giấy tờ đính kèm | Tiếp nhận hồ sơ, kiểm tra đủ điều kiện | Hồ sơ ở trạng thái tiếp nhận | BR-06 |
| P16-03 | Xét duyệt hồ sơ (G3) | VT-03 | Hồ sơ, kết quả xét | Duyệt hoặc từ chối kèm lý do | Hồ sơ đạt hoặc không đạt | BR-01 |
| P16-04 | Chuyển thành hồ sơ trẻ (G3) | VT-12, VT-03 | Hồ sơ đã đạt, lớp dự kiến | Sinh hồ sơ trẻ, gắn phụ huynh, phân lớp | Hồ sơ trẻ ở trạng thái đang học | QT-01 |
| P16-05 | Tin tuyển sinh (G3) | VT-12 | Tiêu đề, nội dung, đợt tuyển sinh, thời hạn | Soạn và công bố tin tuyển sinh gắn với đợt tuyển sinh | Danh sách tin tuyển sinh | BR-69 |

## 18. Phân hệ P17 — Báo cáo và bảng điều khiển

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P17-01 | Bảng điều khiển Ban Giám hiệu (G1) | VT-02, VT-15 | Đơn vị, kỳ | Tổng hợp số trẻ, số lớp, số nhân sự, thu học phí, công nợ, tỷ lệ đi học | Bảng điều khiển toàn trường | BR-36 |
| P17-02 | Bảng điều khiển quản lý đơn vị (G1) | VT-03 | Kỳ | Tổng hợp theo đơn vị được gán | Bảng điều khiển đơn vị | BR-01 |
| P17-03 | Báo cáo học phí (G1) | VT-04, VT-02 | Kỳ, đơn vị, khối lớp | Tổng hợp khoản phải thu, đã thu, giảm trừ | Báo cáo học phí | BR-36 |
| P17-04 | Báo cáo công nợ (G1) | VT-04, VT-02 | Kỳ, mốc quá hạn, đơn vị | Tổng hợp công nợ phải thu theo trẻ và theo lớp | Báo cáo công nợ | BR-33 |
| P17-05 | Báo cáo thu chi (G1) | VT-04, VT-05 | Khoảng ngày, đơn vị, loại thu chi | Tổng hợp thu, chi, chênh lệch | Báo cáo thu chi | BR-36 |
| P17-06 | Báo cáo điểm danh và trẻ vắng (G1) | VT-03, VT-07 | Ngày hoặc kỳ, lớp, đơn vị | Tổng hợp tỷ lệ đi học, danh sách vắng | Báo cáo điểm danh | BR-12 |
| P17-07 | Báo cáo chấm công (G1) | VT-06, VT-03 | Kỳ, đơn vị, phòng ban | Tổng hợp ngày công, đi muộn, nghỉ | Báo cáo chấm công | BR-39 |
| P17-08 | Báo cáo ăn và bếp (G2) | VT-10, VT-04 | Ngày hoặc kỳ, đơn vị | Tổng hợp suất ăn, chi phí nguyên liệu | Báo cáo bếp | BR-58 |
| P17-09 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | — | — | — |
| P17-10 | Báo cáo hoạt động và công việc (G2) | VT-03 | Kỳ, đơn vị, lớp | Tổng hợp hoạt động đã công bố và tiến độ công việc | Báo cáo vận hành | BR-64 |
| P17-11 | Báo cáo hợp nhất nhiều đơn vị (G2) | VT-02, VT-19 | Kỳ, danh sách đơn vị | So sánh chỉ số giữa các đơn vị; cán bộ quản lý cấp trên chỉ thấy số liệu tổng hợp | Báo cáo hợp nhất | BR-01 |
| P17-12 | Xuất dữ liệu (G2) | VT-02, VT-04, VT-06 | Loại báo cáo, bộ lọc | Sinh tệp và ghi nhật ký xuất | Tệp dữ liệu | BR-74 |
| P17-13 | Sinh nhật trẻ trong tháng trên bảng tin (G1) | VT-02, VT-15, VT-03, VT-07 | Đơn vị, lớp, tháng | Lọc trẻ đang học có ngày sinh trong tháng theo phạm vi quyền | Danh sách sinh nhật trong tháng | BR-72 |
| P17-14 | Báo cáo học thứ 7 (G1) | VT-04, VT-03 | Kỳ, đơn vị, lớp | Tổng hợp các ngày thứ bảy học bù trong kỳ và số trẻ đi học, số trẻ vắng của từng ngày | Báo cáo học thứ 7 | BR-84 |
| P17-15 | Bỏ ngày 09/10/2026: trường không có bữa tối (YCTD-20) | — | — | — | — | — |

## 19. Phân hệ P18 — Tuyển dụng

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P18-01 | Đề nghị tuyển dụng (G3) | VT-06, VT-03 | Vị trí, số lượng, yêu cầu, lý do | Trình Ban Giám hiệu duyệt đề nghị | Đề nghị đã duyệt | BR-80 |
| P18-02 | Tin tuyển dụng (G3) | VT-06 | Tiêu đề, mô tả, yêu cầu, thời hạn | Soạn và công bố tin | Danh sách tin | BR-69 |
| P18-03 | Hồ sơ ứng viên (G3) | VT-06 | Thông tin ứng viên, tệp đính kèm, nguồn | Tiếp nhận, sàng lọc, đổi trạng thái | Danh sách ứng viên | BR-74, BR-75 |
| P18-04 | Phỏng vấn và kết quả (G3) | VT-06, VT-03 | Lịch phỏng vấn, người phỏng vấn, đánh giá | Ghi nhận kết quả, quyết định tuyển | Kết quả tuyển dụng | BR-37 |

## 20. Phân hệ P19 — Kênh truy cập và thông báo

| Mã | Tên chức năng | Người dùng | Đầu vào chính | Xử lý chính | Đầu ra chính | Quy tắc |
|---|---|---|---|---|---|---|
| P19-01 | Cổng quản trị (G1) | VT-02 đến VT-12, VT-15, VT-16, VT-17, VT-19, VT-20 | Tài khoản, vai trò | Cung cấp giao diện theo vai trò | Cổng quản trị | PQ-01 |
| P19-02 | Ứng dụng giáo viên (G1) | VT-07, VT-08, VT-09, VT-10, VT-17, VT-18 | Tài khoản giáo viên và nhân viên | Cung cấp giao diện tác nghiệp tại lớp và tại cổng | Ứng dụng giáo viên | PQ-01 |
| P19-03 | Ứng dụng phụ huynh (G1) | VT-14 | Tài khoản phụ huynh | Cung cấp giao diện theo dõi con | Ứng dụng phụ huynh | PQ-06 |
| P19-04 | Trung tâm thông báo (G1) | Mọi vai trò | Sự kiện nghiệp vụ | Tạo, phân phối, đánh dấu đã đọc | Danh sách thông báo | BR-70 |
| P19-05 | Mẫu thông báo (G1) | VT-02, VT-03 | Loại sự kiện, kênh, nội dung mẫu | Quản lý mẫu và biến nội dung | Mẫu thông báo | BR-70 |
| P19-06 | Đăng nhập và quản lý phiên (G1) | Mọi vai trò | Tài khoản, mật khẩu; phụ huynh có thể đăng nhập bằng mã một lần gửi qua tin nhắn; mật khẩu mặc định chung và thông số mã một lần do Hiệu trưởng đặt ở cấu hình chung của dịch vụ định danh (YCTD-43) | Xác thực, cấp phiên, thu hồi phiên; phiên đăng nhập bằng mật khẩu mặc định chỉ được vào màn hình đổi mật khẩu; phiên đăng nhập bằng mã một lần dùng bình thường (Q-147) | Phiên làm việc | PQ-04, PQ-06 |

## 21. Yêu cầu phi chức năng

| Mã | Yêu cầu |
|---|---|
| PCF-01 | Thời gian phản hồi của các màn hình danh sách và bảng điều khiển dưới hai giây với dữ liệu tới năm nghìn trẻ, gấp năm lần quy mô dự kiến dưới một nghìn trẻ |
| PCF-02 | Hệ thống dùng được trên trình duyệt phổ biến hiện hành và trên điện thoại màn hình nhỏ từ ba trăm sáu mươi điểm ảnh |
| PCF-03 | Ứng dụng phụ huynh và giáo viên phải dùng được khi mạng chậm; thao tác ghi phải chống gửi trùng |
| PCF-04 | Sao lưu dữ liệu hằng ngày, giữ tối thiểu ba mươi ngày, có kiểm tra phục hồi định kỳ |
| PCF-05 | Ghi nhật ký thao tác cho mọi thay đổi dữ liệu; nhật ký giữ tối thiểu hai mươi bốn tháng |
| PCF-06 | Dữ liệu truyền trên mạng phải được mã hóa; mật khẩu lưu dưới dạng băm có muối |
| PCF-07 | Hệ thống chịu được tải đỉnh vào giờ điểm danh buổi sáng và giờ chốt học phí cuối tháng |
| PCF-08 | Tác vụ tính học phí và tính lương chạy nền, không chặn giao diện, có báo cáo kết quả |
| PCF-09 | Mọi báo cáo xuất được ra tệp để lưu trữ và gửi cho cơ quan quản lý khi cần |
| PCF-10 | Hệ thống có môi trường thử nghiệm tách biệt với môi trường chạy thật |
| PCF-11 | Tầng giao diện và tầng máy chủ tách hoàn toàn; giao diện chỉ gọi giao diện lập trình ứng dụng, không truy cập cơ sở dữ liệu |
| PCF-12 | Quản lý người dùng và xác thực do một dịch vụ định danh độc lập tự viết đảm nhiệm; dịch vụ này tách khỏi máy chủ API nghiệp vụ |
| PCF-13 | Một máy chủ API nghiệp vụ duy nhất phục vụ mọi nghiệp vụ trường học, chia mô đun bên trong |

## 22. Chưa xác minh được

1. Danh sách chức năng đầy đủ theo mong muốn của nhà trường: tám ảnh chỉ liệt kê tên, không có mô tả nghiệp vụ. Đã tìm trong: tám ảnh sơ đồ chức năng và danh sách tính năng.
2. Đã có câu trả lời: buffet là tiệc theo dịp, không thu riêng; trường không có bữa tối (YCTD-20). Nghĩa của "mất đồ", "hình tô màu" đã được xác nhận tại Q-06.
3. Các chỉ số đánh giá nhân sự: do đơn vị cấu hình (BR-47); chưa có danh sách chỉ số thật.
4. Đã có câu trả lời: định lượng trên một suất theo độ tuổi do bếp cấu hình cho từng món (Q-30).
5. Quy mô đã có câu trả lời: dưới 1 000 trẻ, khoảng 100 người dùng đồng thời (Q-31). Dung lượng lưu trữ hình ảnh: chưa có thông tin; các chỉ số ở mục 21 là đề xuất đã được xác nhận (GD-18).

## 23. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-17 | Đã xác nhận ngày 09/10/2026: Mã chức năng theo dạng P<phân hệ>-<số> dùng xuyên suốt bộ tài liệu | Eric |
| GD-18 | Đã xác nhận ngày 09/10/2026: Các chỉ số phi chức năng ở mục 21 là đề xuất của nhóm thiết kế | Eric |
| GD-75 | Đã xác nhận ngày 09/10/2026: Chức năng quản lý cây đơn vị nhiều cấp và cấu hình hạn mức phê duyệt thuộc giai đoạn 1 | Eric |
| GD-85 | Đã xác nhận ngày 09/10/2026 (theo YCTD-05): Mười hai nhóm chức năng bổ sung ngày 09/10/2026 lấy từ tám ảnh sơ đồ chức năng; giai đoạn của từng chức năng là đề xuất đã được Eric chọn | Eric |
| GD-86 | Đã xác nhận ngày 09/10/2026: lịch nghỉ thứ 7 và lịch học bù lập theo đơn vị, áp dụng cho mọi nhân sự của đơn vị. Thay bằng YCTD-16: Ban Giám hiệu lập một lịch chung cho toàn trường | Eric |
| Q-28 | Đã trả lời ngày 09/10/2026: đối chiếu tám ảnh sơ đồ chức năng, bổ sung hai mươi chức năng theo YCTD-05 | Eric |
| Q-29 | Đã trả lời ngày 09/10/2026: "mật độ" là "mất đồ" (đồ bị mất), theo ảnh "Chức năng dành cho phụ huynh" | Eric |
| Q-30 | Đã trả lời ngày 09/10/2026: định lượng nguyên liệu trên một suất theo độ tuổi do bếp tự cấu hình cho từng món | Eric |
| Q-31 | Đã trả lời ngày 09/10/2026: quy mô dưới 1 000 trẻ, khoảng 100 người dùng đồng thời | Eric |
| Q-144 | Đã trả lời ngày 09/10/2026: giai đoạn 1 nhập mã ngành từ tệp (P02-12); kết nối tự động với cơ sở dữ liệu ngành để giai đoạn 3 | Eric |
| Q-136 | Đã trả lời ngày 09/10/2026: bảng tiêu chuẩn sức khỏe lấy theo tiêu chuẩn của Bộ Y tế | Eric |
| Q-137 | Đã trả lời ngày 09/10/2026: hoạt động ngoại khóa thu phí theo cả hai cách, theo từng hoạt động hoặc theo tháng, do từng hoạt động cấu hình | Eric |
| Q-138 | Đã trả lời ngày 09/10/2026: nghỉ thứ bảy định kỳ, trừ các ngày có lịch học bù | Eric |
| Q-139 | Đã trả lời ngày 09/10/2026: phí ngoại khóa thu theo tháng không giảm trừ khi trẻ nghỉ buổi hoặc thôi tham gia giữa tháng | Eric |
| Q-123 | Đã trả lời ngày 09/10/2026: áp dụng hạn mức cho các chứng từ ở mục 12.1 của tài liệu 07 | Eric |
