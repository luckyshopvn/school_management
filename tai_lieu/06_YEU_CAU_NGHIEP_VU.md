# 06. YÊU CẦU NGHIỆP VỤ

- Mô tả: Nhóm người dùng, quy trình chính, quy trình phụ, quy trình ngoại lệ, điều kiện bắt đầu, điều kiện kết thúc, dữ liệu nghiệp vụ.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Nhóm người dùng

| Nhóm | Mã vai trò | Mô tả |
|---|---|---|
| Quản trị nền tảng | VT-01 | Quản trị hệ thống ở cấp nhà cung cấp, không xem dữ liệu nghiệp vụ của trường |
| Ban quản lý | VT-02, VT-15, VT-03 | Hiệu trưởng xem toàn trường; Phó Hiệu trưởng xem các đơn vị được gán và phê duyệt dưới hạn mức; quản lý đơn vị xem trong phạm vi đơn vị |
| Tài chính | VT-04, VT-05 | Kế toán và kế toán trưởng, phụ trách học phí, thu chi, công nợ, lương |
| Nhân sự | VT-06 | Hồ sơ nhân sự, hợp đồng, tuyển dụng, chấm công |
| Giảng dạy | VT-07, VT-08 | Giáo viên chủ nhiệm và giáo viên bộ môn |
| Y tế | VT-09 | Nhân viên y tế học đường |
| Bếp | VT-10 | Nhân viên bếp và dinh dưỡng |
| Kho và mua hàng | VT-11 | Nhân viên kho, tài sản, mua hàng |
| Tuyển sinh | VT-12 | Nhân viên tuyển sinh |
| Bảo vệ | VT-18 | Xác nhận người đón trẻ tại cổng |
| Tài chính hỗ trợ | VT-16 | Thủ quỹ |
| Chuyên môn | VT-17 | Tổ trưởng chuyên môn |
| Bên ngoài | VT-19, VT-20 | Cán bộ quản lý cấp trên, kiểm toán viên |
| Phụ huynh | VT-14 | Cha, mẹ hoặc người giám hộ của trẻ |

## 2. Nghiệp vụ theo phân hệ

| Mã | Nghiệp vụ | Vai trò chính | Tần suất |
|---|---|---|---|
| NV-01 | Tiếp nhận trẻ mới, lập hồ sơ trẻ và phụ huynh, xếp lớp | VT-12, VT-03 | Theo đợt |
| NV-02 | Quản lý hồ sơ trẻ trong suốt thời gian học, chuyển lớp, chuyển đơn vị, thôi học | VT-03, VT-07 | Không thường xuyên |
| NV-03 | Điểm danh một lần mỗi ngày, báo vắng, đón trả trẻ | VT-07, VT-14, VT-18 | Hằng ngày |
| NV-04 | Ghi nhật ký của bé: ăn, ngủ, vệ sinh, tâm trạng, hoạt động trong ngày | VT-07 | Hằng ngày |
| NV-05 | Xây dựng giáo án, bài học, thời khóa biểu, kế hoạch giảng dạy và theo dõi tiến độ | VT-07, VT-08, VT-17, VT-03 | Hằng tuần |
| NV-06 | Đăng ký dịch vụ theo tháng cho từng trẻ: bán trú bắt buộc với mọi trẻ, gồm ba bữa sáng, trưa, xế (BR-83); các dịch vụ không bắt buộc như STEM, Anh văn | VT-04, VT-14 | Hằng tháng |
| NV-07 | Tính học phí và các khoản phải thu theo tháng, áp dụng miễn giảm và học phí đặc biệt | VT-04 | Hằng tháng |
| NV-08 | Thu học phí, lập phiếu thu, theo dõi công nợ phải thu của từng trẻ | VT-04, VT-16 | Hằng ngày |
| NV-09 | Lập phiếu chi, quản lý quỹ tiền mặt và tài khoản ngân hàng, theo dõi công nợ phải trả | VT-04, VT-05, VT-16 | Hằng ngày |
| NV-10 | Quản lý hồ sơ nhân sự, hợp đồng lao động, quá trình công tác | VT-06 | Không thường xuyên |
| NV-11 | Chấm công, quản lý lịch nghỉ, lịch công tác, nghỉ phép | VT-06, VT-07 | Hằng ngày |
| NV-12 | Tính bảng lương, thưởng, khấu trừ | VT-04, VT-06 | Hằng tháng |
| NV-13 | Giao việc, theo dõi kế hoạch, đánh giá nhân sự theo kỳ | VT-03, VT-06 | Hằng tuần, hằng kỳ |
| NV-14 | Quản lý sức khỏe trẻ: dặn thuốc, cấp thuốc, khám sức khỏe định kỳ, chăm sóc khi ốm | VT-09, VT-07, VT-14 | Hằng ngày |
| NV-15 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — |
| NV-16 | Xây dựng thực đơn, định lượng nguyên liệu, tính suất ăn, quản lý bếp | VT-10 | Hằng tuần, hằng ngày |
| NV-17 | Quản lý tài sản, cấp phát, mượn trả, ghi nhận hỏng và mất | VT-11 | Không thường xuyên |
| NV-18 | Đề nghị mua hàng, lập phiếu mua hàng, quản lý nhà cung cấp và tồn kho | VT-11, VT-04 | Hằng tuần |
| NV-19 | Đăng hoạt động của lớp, duyệt hoạt động, đăng hình ảnh, tin tức, thư viện, thông báo | VT-07, VT-03 | Hằng ngày |
| NV-20 | Trao đổi giữa nhà trường và phụ huynh, tiếp nhận góp ý | VT-07, VT-14, VT-03 | Hằng ngày |
| NV-21 | Tổ chức bình chọn, biểu quyết, khảo sát và công bố kết quả | VT-03 | Theo đợt |
| NV-22 | Tiếp nhận hồ sơ tuyển sinh, xét duyệt, chuyển thành hồ sơ trẻ | VT-12, VT-03 | Theo đợt |
| NV-23 | Tuyển dụng nhân sự: đề nghị, tin, ứng viên, phỏng vấn, kết quả | VT-06 | Theo đợt |
| NV-24 | Xem báo cáo và bảng điều khiển theo vai trò, theo đơn vị, toàn trường | VT-02, VT-15, VT-03, VT-04, VT-06, VT-19, VT-20 | Hằng ngày |

## 3. Quy trình chính

Các quy trình dưới đây được đặc tả chi tiết trong thư mục `25_QUY_TRINH_NGHIEP_VU/`.

| Mã | Tên quy trình | Phân hệ | Vai trò khởi động |
|---|---|---|---|
| QT-01 | Tiếp nhận trẻ mới và lập hồ sơ trẻ | P02, P16 | VT-12, VT-03 |
| QT-02 | Điểm danh, báo vắng và đón trả trẻ | P04 | VT-07, VT-14 |
| QT-03 | Đăng ký dịch vụ và tính học phí theo tháng | P05 | VT-04 |
| QT-04 | Thu học phí và quản lý công nợ phải thu | P05, P06 | VT-04 |
| QT-05 | Lập phiếu chi và quản lý quỹ, tài khoản ngân hàng | P06 | VT-04, VT-05 |
| QT-06 | Chấm công, nghỉ phép và tính lương | P08 | VT-06, VT-04 |
| QT-07 | Dặn thuốc, cấp thuốc và chăm sóc sức khỏe trẻ | P10 | VT-14, VT-09 |
| QT-08 | Tổ chức đưa đón trẻ — Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | P11 | — |
| QT-09 | Ghi nhật ký của bé và trao đổi với phụ huynh | P04, P15 | VT-07 |
| QT-10 | Đăng hoạt động của lớp, duyệt và công bố cho phụ huynh | P14 | VT-07, VT-03 |

## 4. Quy trình phụ

| Mã | Tên quy trình phụ | Gắn với |
|---|---|---|
| QTP-01 | Chuyển lớp cho trẻ trong cùng đơn vị | QT-01 |
| QTP-02 | Chuyển đơn vị cho trẻ | QT-01 |
| QTP-03 | Cho trẻ thôi học và quyết toán công nợ | QT-04 |
| QTP-04 | Điều chỉnh học phí đã phát hành khi phát hiện sai | QT-03 |
| QTP-05 | Đảo phiếu thu đã phát hành | QT-04 |
| QTP-06 | Bỏ ngày 09/10/2026: nhà trường không cho ứng lương (Q-54) | QT-06 |
| QTP-07 | Đăng ký dịch vụ bổ sung giữa tháng | QT-03 |
| QTP-08 | Khám sức khỏe định kỳ theo đợt cho toàn trường | QT-07 |
| QTP-09 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — |
| QTP-10 | Bàn giao trẻ cho người được ủy quyền | QT-02 |
| QTP-11 | Cấp phát và thu hồi tài sản của lớp | P13 |
| QTP-12 | Kiểm kê kho định kỳ | P13 |

## 5. Quy trình ngoại lệ

| Mã | Tình huống | Hướng xử lý |
|---|---|---|
| QTN-01 | Trẻ nghỉ ốm dài ngày có giấy xác nhận | Tiền ăn chỉ tính theo ngày ăn thực tế; học phí không giảm (Q-12) |
| QTN-02 | Phụ huynh không thanh toán quá hạn | Hệ thống ghi nhận công nợ quá hạn, gửi nhắc nợ theo mốc ngày, chuyển danh sách cho quản lý đơn vị |
| QTN-03 | Trẻ nhập học giữa tháng | Tính học phí theo số ngày học thực tế, công thức tại BR-23 |
| QTN-04 | Trẻ thôi học giữa tháng | Quyết toán đến ngày thôi học, hoàn hoặc bù trừ các khoản đã thu trước |
| QTN-05 | Bỏ ngày 09/10/2026: học thứ bảy không còn là dịch vụ thu phí; thứ bảy chỉ có lịch học bù toàn trường do Ban Giám hiệu lập (BR-84) | — |
| QTN-06 | Phụ huynh gửi thuốc nhưng thiếu thông tin liều hoặc giờ | Y tế từ chối nhận thuốc và yêu cầu bổ sung thông tin |
| QTN-07 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — |
| QTN-08 | Người đến đón trẻ không có tên trong danh sách ủy quyền | Giáo viên không bàn giao, liên hệ phụ huynh xác nhận |
| QTN-09 | Nhân sự nghỉ việc đột ngột chưa bàn giao | Khóa tài khoản, chuyển danh sách công việc và lớp phụ trách cho người thay thế |
| QTN-10 | Số liệu chấm công và đơn nghỉ phép không khớp | Nhân sự đối chiếu, quản lý đơn vị xác nhận trước khi chốt lương |
| QTN-11 | Phụ huynh phản hồi tiêu cực công khai trên hoạt động của lớp | Quản lý đơn vị nhận thông báo, xử lý riêng, không xóa bình luận của phụ huynh |
| QTN-12 | Mất điện hoặc mất mạng tại đơn vị trong giờ điểm danh | Ứng dụng giáo viên lưu tạm điểm danh và tự gửi lại khi có mạng (Q-09); nếu thiết bị không dùng được thì ghi tạm ra giấy, nhập bù ngay khi có mạng, ghi rõ thời điểm nhập bù |

## 6. Điều kiện bắt đầu và kết thúc

**Điều kiện bắt đầu của toàn trường:** cây đơn vị không giới hạn cấp (QĐ-14) đã được cấu hình; năm học, lớp học, biểu phí và danh mục dùng chung đã được cấu hình; tài khoản nhân sự đã được cấp và gán phạm vi đơn vị.

**Điều kiện bắt đầu của một trẻ:** có hồ sơ trẻ đã được duyệt, có ít nhất một phụ huynh liên hệ, đã được phân vào một lớp của một đơn vị, đã có bản đăng ký dịch vụ cho kỳ hiện tại.

**Điều kiện kết thúc của một trẻ:** trạng thái thôi học đã được ghi nhận kèm lý do, công nợ đã tất toán hoặc đã có quyết định xử lý, tài sản và đồ dùng đã thu hồi, phụ huynh đã được thông báo.

**Điều kiện kết thúc một kỳ học phí:** mọi khoản phải thu của kỳ đã phát hành, số thu đã ghi nhận, số còn lại đã chuyển thành công nợ.

## 7. Dữ liệu nghiệp vụ

| Nhóm dữ liệu | Thực thể chính |
|---|---|
| Tổ chức | Cây đơn vị không giới hạn cấp, tên cấp mặc định Trường chính, Phân hiệu, Điểm trường; phòng ban, chức danh, năm học, lịch nghỉ thứ bảy và lịch học bù |
| Con người | Trẻ, phụ huynh, nhân sự, ứng viên tuyển dụng |
| Học tập | Lớp, phân lớp, bài học, giáo án, thời khóa biểu, kế hoạch, tiến độ |
| Chăm sóc | Điểm danh, báo vắng, nhật ký của bé, đón trả trẻ, hồ sơ sức khỏe, dặn thuốc |
| Tài chính | Biểu phí, đăng ký dịch vụ, khoản phải thu, miễn giảm, phiếu thu, phiếu chi, quỹ, tài khoản ngân hàng, công nợ |
| Nhân sự | Hợp đồng, chấm công, lịch nghỉ, nghỉ phép, bảng lương, đánh giá |
| Vận hành | Thực đơn, định lượng, suất ăn, tài sản, kho, phiếu mua hàng, nhà cung cấp |
| Truyền thông | Hoạt động, hình ảnh, tin tức, thư viện, thông báo, bình luận |
| Tương tác | Trao đổi, góp ý, bình chọn, biểu quyết, khảo sát |
| Hệ thống | Tài khoản, vai trò, quyền, phạm vi đơn vị, hạn mức phê duyệt, cấu hình, nhật ký thao tác |

## 8. Chưa xác minh được

1. Quy trình nghiệp vụ thật của trường: chỉ có tên chức năng trong tám ảnh, không có mô tả luồng. Đã tìm trong: tám ảnh sơ đồ chức năng và danh sách tính năng.
2. Đã có câu trả lời: giảm trừ khi trẻ nghỉ (Q-12, BR-14), công thức học phí giữa tháng (BR-23), mốc nhắc nợ (Q-11).
3. Đã có câu trả lời: Ban Giám hiệu phê duyệt miễn giảm theo hạn mức (Q-10); mức hạn mức do nhà trường cấu hình sau (Q-112).
4. Quy định pháp luật và quy định của cơ quan quản lý giáo dục mà trường phải tuân thủ trong hồ sơ trẻ, y tế học đường, bếp ăn: chưa xác nhận.
5. Đã có câu trả lời: buffet là tiệc theo dịp, không thu riêng; trường không có bữa tối (YCTD-20). Nghĩa của "mất đồ", "hình tô màu" đã được xác nhận tại Q-06.

## 9. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-08 | Đã xác nhận ngày 09/10/2026: Một trẻ có thể có nhiều phụ huynh cùng theo dõi; một phụ huynh có thể có nhiều con | Eric |
| GD-09 | Đã xác nhận ngày 09/10/2026: Mọi khoản phải thu của trẻ đều thuộc một kỳ học phí theo tháng | Eric |
| GD-10 | Đã xác nhận ngày 09/10/2026: Hệ thống phải ghi nhật ký thao tác cho mọi thay đổi dữ liệu tài chính và dữ liệu cá nhân của trẻ | Eric |
| GD-74 | Đã xác nhận ngày 09/10/2026 (theo QĐ-08): Nghiệp vụ quản lý tài khoản, vai trò và phiên đăng nhập do một dịch vụ định danh độc lập đảm nhiệm, tách khỏi nghiệp vụ trường học | Eric |
| Q-10 | Đã trả lời ngày 09/10/2026: Ban Giám hiệu phê duyệt miễn giảm theo hạn mức; mức miễn giảm do nhà trường cấu hình (P05-11) | Eric |
| Q-11 | Đã trả lời ngày 09/10/2026: mốc nhắc nợ cấu hình theo đơn vị, mặc định 3, 7 và 15 ngày sau ngày đến hạn; nhắc trong ứng dụng và qua tin nhắn | Eric |
| Q-12 | Đã trả lời ngày 09/10/2026: không giảm học phí khi trẻ nghỉ ốm dài ngày; tiền ăn tính theo ngày ăn thực tế | Eric |
| Q-13 | Đã trả lời ngày 09/10/2026: bình luận hiển thị ngay, không kiểm duyệt trước; quản lý đơn vị ẩn được bình luận vi phạm kèm lý do, không xóa | Eric |
