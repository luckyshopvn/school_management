# 04. TỔNG QUAN DỰ ÁN

- Mô tả: Tên sản phẩm, vấn đề cần giải quyết, mục tiêu sản phẩm, đối tượng sử dụng, giá trị mang lại, kết quả mong muốn, yêu cầu cấp cao, giới hạn ban đầu.
- Dự án: School Management - Hệ thống quản lý trường mầm non
- Mã dự án: SM
- Phiên bản: 1.1
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Tên sản phẩm và định vị

**School Management** là hệ thống quản lý trường mầm non dùng chung cho mọi cấp đơn vị. Đơn vị tổ chức thành cây hai cấp: Trường chính ở cấp 1; Phân hiệu và Điểm trường ở cấp 2, trực thuộc Trường chính (QĐ-23). Hệ thống vận hành trên ba kênh:

| Kênh | Đối tượng | Nền tảng |
|---|---|---|
| Cổng quản trị | Ban Giám hiệu, quản lý đơn vị, kế toán, nhân sự, các bộ phận nghiệp vụ | Trình duyệt |
| Ứng dụng giáo viên | Giáo viên chủ nhiệm, giáo viên bộ môn | Trình duyệt và điện thoại |
| Ứng dụng phụ huynh | Phụ huynh, người giám hộ | Điện thoại |

Định vị: một hệ thống duy nhất thay cho tập hợp bảng tính, sổ giấy và các nhóm tin nhắn rời rạc đang được dùng để quản lý trẻ, học phí, nhân sự và chăm sóc hằng ngày.

Sản phẩm mới hoàn toàn, không kế thừa mã nguồn của hệ thống nào.

## 2. Vấn đề cần giải quyết

| Mã | Vấn đề | Hệ quả |
|---|---|---|
| VĐ-01 | Hồ sơ trẻ, phụ huynh và tình trạng học phí nằm rải rác ở bảng tính của từng đơn vị | Không tổng hợp được toàn trường, số liệu lệch giữa các đơn vị |
| VĐ-02 | Điểm danh và báo vắng truyền miệng hoặc qua nhóm tin nhắn | Không có bằng chứng, tranh chấp khi tính giảm trừ tiền ăn |
| VĐ-03 | Học phí tính tay với nhiều mức miễn giảm khác nhau | Sai sót, thất thu, mất nhiều thời gian đối soát cuối tháng |
| VĐ-04 | Phụ huynh không tự tra được tình hình học phí, công nợ và lịch sinh hoạt của con | Phát sinh khiếu nại, cán bộ kế toán phải trả lời lặp lại |
| VĐ-05 | Chấm công và nghỉ phép không liên kết với bảng lương | Bảng lương ra chậm, khó truy xuất khi có thắc mắc |
| VĐ-06 | Dặn thuốc và chăm sóc sức khỏe ghi trên giấy | Thất lạc, rủi ro khi xảy ra sự cố y tế tại trường |
| VĐ-07 | Ban Giám hiệu không có bức tranh vận hành theo thời gian thực | Ra quyết định dựa trên báo cáo tổng hợp tay, chậm một đến vài ngày |

## 3. Mục tiêu sản phẩm

1. Gom toàn bộ dữ liệu trẻ, phụ huynh, lớp học, nhân sự và tài chính của mọi đơn vị vào một hệ thống duy nhất.
2. Tự động hóa việc tính học phí, giảm trừ và công nợ từ dữ liệu đăng ký dịch vụ và điểm danh thực tế.
3. Cho phụ huynh tự tra cứu thay vì hỏi nhà trường: điểm danh, thời khóa biểu, nhật ký, thực đơn, học phí, thông báo.
4. Cho giáo viên công cụ ghi nhận công việc hằng ngày tại lớp và trao đổi với phụ huynh trong cùng một nơi.
5. Cho Ban Giám hiệu bảng điều khiển tập trung theo đơn vị và toàn trường.

## 4. Đối tượng sử dụng

| Nhóm | Vai trò điển hình | Nhu cầu chính |
|---|---|---|
| Ban quản lý | Ban Giám hiệu, quản lý đơn vị, tổ trưởng chuyên môn | Nhìn thấy toàn cảnh, kiểm soát dòng tiền, so sánh giữa các đơn vị, quản lý chuyên môn |
| Khối tài chính | Kế toán, kế toán trưởng, thủ quỹ | Thu học phí, theo dõi công nợ, lập phiếu thu chi, báo cáo |
| Khối vận hành | Nhân sự, kho, bếp, y tế, tuyển sinh, bảo vệ | Làm đúng quy trình của từng bộ phận, dữ liệu không trùng lặp |
| Khối giảng dạy | Giáo viên chủ nhiệm, giáo viên bộ môn | Điểm danh, giáo án, nhật ký, trao đổi phụ huynh, công việc được giao |
| Phụ huynh | Cha, mẹ, người giám hộ | Theo dõi con, thanh toán, trao đổi với nhà trường |
| Bên ngoài nhà trường | Cán bộ quản lý cấp trên, kiểm toán viên | Xem báo cáo và dữ liệu được cấp quyền, không thay đổi dữ liệu |

## 5. Giá trị mang lại

| Đối tượng | Giá trị |
|---|---|
| Ban Giám hiệu | Một bảng điều khiển cho nhiều đơn vị, số liệu lấy trực tiếp từ nghiệp vụ phát sinh |
| Kế toán | Giảm thao tác tính tay; công nợ và doanh thu học phí được tính từ dữ liệu gốc |
| Giáo viên | Giảm việc ghi chép giấy, giảm việc trả lời phụ huynh lặp lại |
| Phụ huynh | Chủ động theo dõi con và thanh toán, không phải gọi điện hỏi |
| Nhà trường | Giảm tranh chấp nhờ dữ liệu có dấu vết và thời điểm ghi nhận rõ ràng |

## 6. Kết quả mong muốn

1. Một trẻ chỉ tồn tại một hồ sơ duy nhất trong toàn trường, dùng chung cho mọi phân hệ.
2. Học phí của một trẻ trong một tháng được tính ra từ dữ liệu đăng ký dịch vụ, điểm danh và quy tắc miễn giảm, không nhập tay.
3. Mọi khoản thu, chi đều có phiếu và không xóa được, chỉ đảo được.
4. Phụ huynh mở ứng dụng là thấy được trạng thái của con trong ngày.
5. Ban Giám hiệu lọc được báo cáo theo đơn vị, theo tháng và theo lớp trong thời gian dưới một phút.

## 7. Yêu cầu cấp cao

| Mã | Yêu cầu |
|---|---|
| YCC-01 | Một hệ thống phục vụ một trường với cây đơn vị hai cấp: Trường chính và các Phân hiệu, Điểm trường trực thuộc (QĐ-23); dữ liệu của đơn vị nào chỉ đơn vị đó và cấp quản lý tương ứng được xem |
| YCC-02 | Mọi dữ liệu nghiệp vụ gắn với trẻ, lớp, đơn vị và thời điểm phát sinh |
| YCC-03 | Phân quyền do máy chủ quyết định, không dựa vào việc ẩn nút trên giao diện |
| YCC-04 | Dữ liệu tài chính không xóa, chỉ đảo bút toán hoặc ghi phiếu điều chỉnh |
| YCC-05 | Mọi thao tác thay đổi dữ liệu phải ghi nhật ký thao tác kèm người thực hiện và thời điểm |
| YCC-06 | Ứng dụng phụ huynh và giáo viên dùng được trên điện thoại, không cần cài đặt phức tạp |
| YCC-07 | Hệ thống gửi được thông báo qua nhiều kênh, tối thiểu là thông báo trong ứng dụng |
| YCC-08 | Báo cáo phải lọc được theo đơn vị ở mọi cấp, lớp, thời gian và trạng thái |
| YCC-09 | Tầng giao diện tách hoàn toàn khỏi tầng máy chủ; giao diện chỉ gọi giao diện lập trình ứng dụng, không truy cập cơ sở dữ liệu |
| YCC-10 | Hệ thống quản lý người dùng và xác thực là một dịch vụ định danh độc lập, tự viết, tách khỏi máy chủ API nghiệp vụ |
| YCC-11 | Phê duyệt chứng từ theo hạn mức: Phó Hiệu trưởng phê duyệt dưới hạn mức, Hiệu trưởng phê duyệt từ hạn mức trở lên |

## 8. Giới hạn ban đầu

1. Chưa có mã nguồn, chưa có cơ sở dữ liệu, chưa có dữ liệu lịch sử phải chuyển đổi.
2. Chưa xác định được số lượng đơn vị, số lớp và số trẻ thực tế.
3. Chưa có biểu mẫu giấy thật của trường để đối chiếu.
4. Tích hợp bên ngoài đã xác định nhưng chưa có tài khoản: API chỉ đọc cho đối tác (QĐ-16), xác nhận chuyển khoản mã QR (T5), tin nhắn SMS (T1), nhập mã định danh của Bộ Giáo dục và Đào tạo từ tệp ở giai đoạn 1 và đồng bộ tự động ở giai đoạn 3 (T8), Zalo ở giai đoạn 3 (T7).
5. Sổ kế toán kép thuộc phạm vi giai đoạn 3 (G3-06), lập theo chế độ kế toán hành chính, sự nghiệp (Q-140).

## 9. Chưa xác minh được

Những điều dưới đây chưa kiểm chứng được và không được dùng làm căn cứ thiết kế:

1. Quy trình nghiệp vụ thật đang chạy tại trường: không có tài liệu, không có biểu mẫu, không có phỏng vấn người dùng. Đã tìm trong: tám ảnh sơ đồ chức năng và danh sách tính năng do Eric gửi ngày 09/10/2026.
2. Mức miễn giảm học phí: không có văn bản. Đã tìm trong: danh sách tính năng. Công thức học phí giữa tháng và cách tính tiền ăn đã được Eric chốt ngày 09/10/2026 (BR-14, BR-23).
3. Số lượng đơn vị, lớp, trẻ, nhân sự và khối lượng giao dịch dự kiến: không có số liệu.
4. Danh mục biểu mẫu báo cáo mà Ban Giám hiệu và kế toán đang dùng: không có mẫu thật.
5. Có phải tuân thủ quy định báo cáo của cơ quan quản lý giáo dục hay không: chưa xác nhận.

## 10. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-01 | Đã xác nhận ngày 09/10/2026: Trường vận hành theo mô hình một pháp nhân với nhiều cấp đơn vị: Trường chính, Phân hiệu, Điểm trường | Eric |
| GD-02 | Đã xác nhận ngày 09/10/2026: Đơn vị tiền tệ là đồng Việt Nam, kỳ kế toán và kỳ học phí là tháng dương lịch | Eric |
| GD-03 | Đã xác nhận ngày 09/10/2026: Học phí được tính theo tháng, không tính theo kỳ học | Eric |
| GD-04 | Đã xác nhận ngày 09/10/2026: Hệ thống phục vụ khối mầm non gồm nhà trẻ và mẫu giáo | Eric |
| GD-71 | Đã xác nhận ngày 09/10/2026 (theo quyết định Ban Giám hiệu ngày 09/10/2026): Đây là trường công lập nên cấp quản lý cao nhất là Ban Giám hiệu gồm Hiệu trưởng và Phó Hiệu trưởng | Eric |
| GD-84 | Đã xác nhận ngày 09/10/2026 (theo Q-131): Tên dự án là School Management và thư mục gốc đặt tại `D:\School_Management`, chốt ngày 09/10/2026 theo yêu cầu của Eric | Eric |
| Q-01 | Đã trả lời ngày 09/10/2026: có lập sổ kế toán kép, làm ở giai đoạn 3, theo chế độ kế toán hành chính, sự nghiệp | Eric |
| Q-140 | Đã trả lời ngày 09/10/2026: sổ kế toán kép lập theo chế độ kế toán hành chính, sự nghiệp dành cho đơn vị sự nghiệp công lập (Thông tư 24/2024/TT-BTC theo hiểu biết của nhóm thiết kế, kế toán trưởng kiểm tra lại số hiệu văn bản khi xây dựng) | Eric |
| Q-02 | Đã trả lời ngày 09/10/2026: có, nhập dữ liệu ban đầu từ tệp Excel theo mẫu ở giai đoạn 1 (P01-13) | Eric |
| Q-03 | Đã trả lời ngày 09/10/2026: có, giai đoạn 1 nhận thanh toán bằng chuyển khoản mã QR có xác nhận tự động (P06-11); đối soát sao kê đầy đủ để giai đoạn 3 | Eric |
| Q-04 | Đã trả lời ngày 09/10/2026: giai đoạn 1 làm ứng dụng web chạy trên trình duyệt điện thoại; bản cài riêng để giai đoạn 3 (N2) | Eric |
| Q-05 | Đã trả lời ngày 09/10/2026: kết nối Zalo để giai đoạn 3 (G3-08) | Eric |
| Q-06 | Đã trả lời ngày 09/10/2026 theo tám ảnh sơ đồ chức năng: "mật độ" là "mất đồ" (đồ bị mất); "hình tổ màu" là "hình tô màu"; "ăn tối" là dịch vụ bữa tối có đăng ký và thu phí, có theo dõi trẻ ăn tối và báo cáo ăn tối. Phần ăn tối thay bằng YCTD-20: trường không có bữa tối | Eric |
| Q-131 | Đã trả lời ngày 09/10/2026: tên dự án lấy theo tên thư mục gốc, tức School Management | Eric |
| Q-132 | Đã trả lời ngày 09/10/2026: mã dự án đổi từ SKG thành SM, viết tắt của School Management | Eric |
