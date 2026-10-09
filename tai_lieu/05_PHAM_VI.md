# 05. PHẠM VI

- Mô tả: Phạm vi trong, phạm vi ngoài, chức năng bắt buộc, chức năng ưu tiên, chức năng để giai đoạn sau, giới hạn của phiên bản.
- Phiên bản: 1.3
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Ranh giới sản phẩm

Sản phẩm bắt đầu từ lúc một trẻ được tiếp nhận vào trường và kết thúc khi trẻ rời trường cùng các nghĩa vụ tài chính đã tất toán. Sản phẩm bao trùm bốn khối: quản lý trẻ và giảng dạy, nhân sự và vận hành, tài chính học phí và công nợ, kết nối nhà trường với giáo viên và phụ huynh.

Sản phẩm không thay thế hệ thống kế toán doanh nghiệp, không thay thế phần mềm nhân sự chuyên sâu, không phải hệ thống quản lý học tập theo chuẩn phổ thông.

## 2. Phân hệ và phạm vi trong

| Mã | Phân hệ | Nội dung chính |
|---|---|---|
| P01 | Nền tảng, đơn vị và phân quyền | Đơn vị, năm học, phòng ban, chức danh, tài khoản, vai trò, quyền, hạn mức phê duyệt, cấu hình danh mục dùng chung, nhập dữ liệu ban đầu, khóa API cho đối tác, nhật ký thao tác |
| P02 | Trẻ, phụ huynh và lớp học | Hồ sơ trẻ, mã định danh, hồ sơ phụ huynh, mối quan hệ, lớp học, phân lớp, chuyển lớp, trạng thái học tập, trẻ là con của nhân viên |
| P03 | Giảng dạy | Bài học, giáo án, chủ đề, thời khóa biểu, kế hoạch giảng dạy, tiến độ học tập |
| P04 | Điểm danh và chăm sóc hằng ngày | Điểm danh một lần mỗi ngày, báo vắng, đón trả trẻ, nhật ký của bé, ghi nhận ăn và ngủ |
| P05 | Học phí, khoản thu và giảm trừ | Biểu phí, đăng ký dịch vụ theo tháng, tính học phí, miễn giảm, học phí đặc biệt, công nợ phải thu của trẻ |
| P06 | Tài chính | Phiếu thu, phiếu chi, quỹ tiền mặt, tài khoản ngân hàng, lịch sử giao dịch, công nợ phải trả, báo cáo tài chính quản trị |
| P07 | Nhân sự | Hồ sơ nhân sự, phòng ban, chức danh, hợp đồng lao động, quá trình công tác, chứng chỉ |
| P08 | Chấm công và tiền lương | Chấm công, lịch nghỉ, lịch công tác, nghỉ phép, bảng lương, lương thưởng, khấu trừ |
| P09 | Công việc, kế hoạch và đánh giá | Giao việc, công việc cá nhân, kế hoạch, tiến độ, đánh giá theo kỳ và chỉ số |
| P10 | Y tế học đường | Danh sách thuốc, dặn thuốc, cấp thuốc, khám sức khỏe, kết quả khám, chăm sóc, yêu cầu báo cáo sức khỏe |
| P11 | Xe đưa đón | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| P12 | Bếp và dinh dưỡng | Thực đơn, món ăn, định lượng, nguyên liệu, suất ăn theo ngày gồm ba bữa sáng, trưa, xế, buffet theo dịp, báo cơm |
| P13 | Kho, tài sản và mua hàng | Tài sản, cấp phát, mượn trả, hỏng và mất, đề nghị mua hàng, phiếu mua hàng, nhà cung cấp, tồn kho |
| P14 | Hoạt động, nội dung và truyền thông | Hoạt động của lớp, hoạt động ngoại khóa, album hình ảnh, tin tức, thư viện, thông báo, tài khoản Facebook và Fanpage |
| P15 | Tương tác và ý kiến | Trao đổi hai chiều, góp ý, bình chọn, biểu quyết, khảo sát và kết quả |
| P16 | Tuyển sinh | Đợt tuyển sinh, hồ sơ tuyển sinh, tiếp nhận, xét duyệt, chuyển thành hồ sơ trẻ |
| P17 | Báo cáo và bảng điều khiển | Bảng điều khiển theo vai trò, báo cáo theo phân hệ, báo cáo hợp nhất nhiều đơn vị, xuất dữ liệu |
| P18 | Tuyển dụng | Đề nghị tuyển dụng, tin tuyển dụng, hồ sơ ứng viên, phỏng vấn, kết quả |
| P19 | Kênh truy cập và thông báo | Cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh, trung tâm thông báo, mẫu thông báo |

## 3. Phạm vi ngoài

Những việc sau không thuộc phạm vi sản phẩm ở mọi giai đoạn:

1. Bỏ ngày 09/10/2026: sổ kế toán kép đã được đưa vào phạm vi giai đoạn 3, xem G3-06.
2. Tính thuế thu nhập cá nhân và bảo hiểm xã hội ở mức kê khai: hệ thống tính khấu trừ trên bảng lương, không nộp thay qua cổng cơ quan thuế.
3. Cổng thông tin của cơ quan quản lý giáo dục: không tự động nộp báo cáo lên hệ thống ngành.
4. Camera và thiết bị phần cứng: hệ thống chỉ hiển thị đường dẫn tới camera nếu nhà trường cung cấp, không tự quản lý luồng video.
5. Chấm công bằng thiết bị vân tay hoặc khuôn mặt: hệ thống nhận dữ liệu chấm công qua nhập tay, nhập hàng loạt hoặc giao diện lập trình, không tự nhận dạng sinh trắc học.
6. Quản lý tài chính của pháp nhân khác ngoài trường.

## 4. Chức năng bắt buộc — giai đoạn 1

Giai đoạn 1 phải chạy được thật, có dữ liệu thật và được nghiệm thu.

| Mã | Nội dung | Phân hệ |
|---|---|---|
| G1-01 | Cây đơn vị không giới hạn cấp, tên cấp mặc định Trường chính, Phân hiệu, Điểm trường; năm học; phòng ban, chức danh; cấu hình tham số và hạn mức phê duyệt | P01 |
| G1-02 | Dịch vụ định danh: tài khoản, vai trò, quyền, phạm vi đơn vị, đăng nhập và phiên | P01 |
| G1-03 | Hồ sơ trẻ, hồ sơ phụ huynh, lớp học, phân lớp, chuyển lớp, chuyển đơn vị, thôi học và quyết toán, đồng ý sử dụng hình ảnh | P02 |
| G1-04 | Điểm danh một lần mỗi ngày, báo vắng, đón trả trẻ, nhật ký của bé, ghi nhận ăn, ngủ, vệ sinh, chốt điểm danh ngày | P04 |
| G1-05 | Biểu phí, đăng ký dịch vụ, tính học phí, miễn giảm | P05 |
| G1-06 | Phiếu thu, công nợ phải thu của trẻ, theo dõi thanh toán | P05, P06 |
| G1-07 | Hồ sơ nhân sự, hợp đồng lao động | P07 |
| G1-08 | Chấm công, lịch nghỉ, nghỉ phép | P08 |
| G1-09 | Bảng lương cơ bản, tiền làm thêm giờ, phiếu lương; ứng lương đã bỏ ngày 09/10/2026 (Q-54) | P08 |
| G1-10 | Ứng dụng phụ huynh: điểm danh, học phí, thông báo, nhật ký | P19 |
| G1-11 | Ứng dụng giáo viên: điểm danh, nhật ký, công việc được giao | P19 |
| G1-12 | Bảng điều khiển và báo cáo cơ bản: số trẻ, thu học phí, công nợ, chấm công | P17 |
| G1-13 | Danh mục phòng học, bậc học, khoản mục thu chi, loại miễn giảm, khấu trừ, quy định phép năm; ngày nghỉ lễ và lịch nghỉ thứ 7 | P01, P05, P06, P08 |
| G1-14 | Sinh nhật trẻ trên bảng tin, báo cáo học thứ 7; báo cáo ăn tối bỏ ngày 09/10/2026 (YCTD-20) | P17 |
| G1-15 | Nhập dữ liệu ban đầu từ tệp Excel theo mẫu: trẻ, phụ huynh, lớp, nhân sự, công nợ đầu kỳ | P01 |
| G1-16 | Thanh toán trực tuyến bằng chuyển khoản mã QR có xác nhận tự động, hệ thống tự lập phiếu thu | P05, P06, P19 |
| G1-17 | API chỉ đọc cho đối tác, cấp và thu hồi khóa, ghi nhật ký mỗi lần đọc dữ liệu cá nhân (QĐ-16) | P01 |
| G1-18 | Nhập mã định danh của Bộ Giáo dục và Đào tạo từ tệp, đối chiếu theo số định danh cá nhân | P02 |
| G1-19 | Phiếu chi và quỹ tiền mặt, gồm phiếu chi hoàn tiền khi trẻ thôi học và phiếu chi lương (YCTD-19) | P06 |
| G1-20 | Lịch năm học: học kỳ, kỳ hè, tuần học, tuần nghỉ, ngày học trong tuần; đăng ký học hè theo tháng (YCTD-30) | P01, P05 |

## 5. Chức năng ưu tiên — giai đoạn 2

| Mã | Nội dung | Phân hệ |
|---|---|---|
| G2-01 | Giáo án, bài học, thời khóa biểu, kế hoạch và tiến độ giảng dạy | P03 |
| G2-02 | Y tế: dặn thuốc kèm ảnh thuốc, cấp thuốc, khám sức khỏe, chăm sóc, theo dõi chăm sóc hằng ngày, phụ huynh xác nhận đã biết; giáo viên chủ nhiệm nhận thuốc khi đơn vị không có nhân viên y tế (YCTD-25) | P10 |
| G2-03 | Xe đưa đón — Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | P11 |
| G2-04 | Bếp: thực đơn, định lượng, suất ăn, báo cơm | P12 |
| G2-05 | Kho, tài sản, mua hàng, tồn kho | P13 |
| G2-06 | Hoạt động, hình ảnh, tin tức, thư viện, thông báo nâng cao | P14 |
| G2-07 | Trao đổi hai chiều, góp ý, bình chọn, biểu quyết, khảo sát | P15 |
| G2-08 | Công việc, kế hoạch, đánh giá theo kỳ | P09 |
| G2-09 | Tài khoản ngân hàng, công nợ phải trả; phiếu chi và quỹ tiền mặt chuyển sang G1-19 ngày 09/10/2026 | P06 |
| G2-10 | Báo cáo hợp nhất nhiều đơn vị | P17 |
| G2-11 | Đồ bị mất của trẻ | P02 |
| G2-12 | Lĩnh vực và nhóm bài học | P03 |
| G2-13 | Phiếu mua thuốc, lịch khám, tiêu chuẩn sức khỏe | P10 |
| G2-14 | Phiếu đi chợ, nhà cung cấp thực phẩm | P12 |
| G2-15 | Tồn kho ban đầu | P13 |
| G2-16 | Hoạt động ngoại khóa và đăng ký tham gia; album thư viện; bình luận trên thư viện và tin tức | P14 |
| G2-17 | Danh sách nhắc nợ; đề xuất và quyết định xử lý công nợ quá hạn (YCTD-23) | P05 |

## 6. Chức năng để giai đoạn sau — giai đoạn 3

| Mã | Nội dung | Phân hệ |
|---|---|---|
| G3-01 | Tuyển sinh trực tuyến và chuyển hồ sơ tuyển sinh thành hồ sơ trẻ | P16 |
| G3-02 | Tuyển dụng: tin, ứng viên, phỏng vấn | P18 |
| G3-03 | Kết nối Facebook và Fanpage để đăng nội dung | P14 |
| G3-04 | Bản cài riêng trên điện thoại cho phụ huynh nếu bản trên trình duyệt không đáp ứng | P19 |
| G3-05 | Đối soát sao kê ngân hàng tự động và kết nối thêm cổng thanh toán khác | P05, P06 |
| G3-06 | Sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp, đã được Eric duyệt ngày 09/10/2026 | P06 |
| G3-07 | Tin tuyển sinh | P16 |
| G3-08 | Gửi thông báo và nhắc nợ qua Zalo Official Account | P19 |
| G3-09 | Kết nối tự động với cơ sở dữ liệu ngành của Bộ Giáo dục và Đào tạo để nhận mã định danh | P02 |

## 7. Giới hạn của phiên bản

1. Phiên bản 1.0 chỉ gồm giai đoạn 1. Không đưa chức năng giai đoạn 2 và 3 vào cùng phiên bản.
2. Một trẻ chỉ thuộc một lớp tại một thời điểm, do đó thuộc đúng một đơn vị tại một thời điểm; đơn vị của trẻ là đơn vị của lớp trẻ đang học (QĐ-14).
3. Một tài khoản phụ huynh gắn với một số điện thoại; nhiều tài khoản có thể cùng theo dõi một trẻ.
4. Kỳ học phí là tháng dương lịch.
5. Chưa có đa ngôn ngữ; giao diện tiếng Việt.
6. Chưa có chế độ ngoại tuyến; ứng dụng giáo viên chỉ lưu tạm điểm danh khi mất mạng và gửi lại khi có mạng (Q-09).

## 8. Chưa xác minh được

1. Số đơn vị, số lớp, số trẻ, số nhân sự thực tế để ước lượng quy mô. Đã tìm trong: tám ảnh sơ đồ chức năng và danh sách tính năng.
2. Cách xếp ba giai đoạn ở mục 4 đến mục 6 đã được Eric xác nhận ngày 09/10/2026 (Q-07).
3. Đa ngôn ngữ: phiên bản 1.0 chỉ có tiếng Việt (Q-08).
4. Chuyển đổi dữ liệu cũ: nhập dữ liệu ban đầu từ tệp Excel theo mẫu (Q-02, G1-15).

## 9. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-05 | Đã xác nhận ngày 09/10/2026: Một trẻ thuộc đúng một đơn vị ở cấp thấp nhất nơi trẻ học, xác định theo lớp trẻ đang học; chuyển đơn vị là nghiệp vụ riêng có ghi nhận lịch sử | Eric |
| GD-06 | Đã xác nhận ngày 09/10/2026: Kỳ học phí là tháng dương lịch, ngày chốt và ngày đến hạn do từng đơn vị cấu hình | Eric |
| GD-07 | Đã xác nhận ngày 09/10/2026 (theo Q-07, Q-111): Giai đoạn 1 là phiên bản 1.0 phải chạy được thật | Eric |
| GD-72 | Đã xác nhận ngày 09/10/2026: Mọi cấp đơn vị đều có thể có lớp; lớp thuộc cấp nào thì trẻ học lớp đó thuộc đơn vị cấp đó | Eric |
| GD-73 | Đã xác nhận ngày 09/10/2026 (theo QĐ-06): Tầng giao diện và tầng máy chủ là hai sản phẩm triển khai riêng | Eric |
| Q-07 | Đã trả lời ngày 09/10/2026: đồng ý cách xếp ba giai đoạn như đề xuất | Eric |
| Q-08 | Đã trả lời ngày 09/10/2026: phiên bản 1.0 chỉ có giao diện tiếng Việt | Eric |
| Q-09 | Đã trả lời ngày 09/10/2026: không làm chế độ ngoại tuyến đầy đủ; chỉ lưu tạm điểm danh khi mất mạng và gửi lại khi có mạng | Eric |
| Q-122 | Đã trả lời ngày 09/10/2026: nhà trường tự tạo Phân hiệu và Điểm trường trong phần Cấu hình; các đơn vị dùng chung biểu phí | Eric |
