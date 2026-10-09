# 11. TIÊU CHÍ NGHIỆM THU

- Mô tả: Tiêu chí nghiệm thu cho từng chức năng, viết dạng Cho, Khi, Thì.
- Phiên bản: 1.11
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Quy ước

1. Tiêu chí nghiệm thu đánh mã `AC-xx`, viết dạng **Cho / Khi / Thì**.
2. Mỗi nhóm chức năng phải có ít nhất một tiêu chí thất bại về quyền.
3. Một tiêu chí chỉ được coi là đạt khi đã chạy thử thật trên môi trường thử nghiệm với dữ liệu thật, có ghi lại kết quả.
4. Chưa có tiêu chí nghiệm thu thì chức năng không được coi là hoàn thành.

## 2. Nền tảng, đơn vị và phân quyền

| Mã | Tiêu chí |
|---|---|
| AC-01 | Cho một tài khoản quản lý đơn vị A / Khi truy vấn danh sách trẻ / Thì chỉ nhận được trẻ thuộc đơn vị A, không có bản ghi nào của đơn vị B |
| AC-02 | Cho một tài khoản kế toán đơn vị A / Khi gọi trực tiếp điểm cuối cập nhật hồ sơ trẻ của đơn vị A / Thì bị từ chối với lỗi không có quyền, dù giao diện có hiển thị nút hay không |
| AC-03 | Cho một tài khoản giáo viên không được phân công lớp Bảo Ngọc / Khi gọi điểm cuối điểm danh của lớp Bảo Ngọc / Thì bị từ chối |
| AC-04 | Cho quản trị nền tảng / Khi mở danh sách hồ sơ trẻ / Thì không thấy dữ liệu nghiệp vụ nào của trường |
| AC-05 | Cho một thay đổi vai trò của người dùng / Khi người dùng đó gửi yêu cầu kế tiếp / Thì quyền mới có hiệu lực ngay, không chờ phiên hết hạn |
| AC-06 | Cho một đơn vị có cấu hình ngày chốt học phí là ngày hai mươi lăm / Khi kế toán xem cấu hình / Thì thấy đúng ngày hai mươi lăm và ngày này được dùng khi chốt đăng ký dịch vụ |

## 3. Trẻ, phụ huynh và lớp học

| Mã | Tiêu chí |
|---|---|
| AC-07 | Cho nhân viên tuyển sinh / Khi tạo hồ sơ trẻ thiếu ngày sinh / Thì hệ thống từ chối và chỉ rõ trường còn thiếu |
| AC-08 | Cho hồ sơ trẻ có số định danh cá nhân trùng với một trẻ đã có / Khi lưu / Thì hệ thống từ chối và chỉ ra hồ sơ trùng |
| AC-09 | Cho một trẻ đang học lớp Mầm 1 / Khi quản lý đơn vị chuyển trẻ sang lớp Mầm 2 / Thì lớp Mầm 1 giảm một trẻ, lớp Mầm 2 tăng một trẻ, và lịch sử lớp của trẻ ghi thêm một dòng, không ghi đè dòng cũ |
| AC-10 | Cho lớp có sĩ số tối đa là hai mươi lăm và hiện có hai mươi lăm trẻ / Khi phân thêm một trẻ / Thì hệ thống cảnh báo vượt sĩ số và yêu cầu xác nhận của quản lý đơn vị |
| AC-11 | Cho một trẻ còn công nợ / Khi quản lý đơn vị thực hiện chuyển đơn vị / Thì hệ thống chặn và yêu cầu tất toán công nợ trước |
| AC-12 | Cho một phụ huynh của trẻ A / Khi mở danh sách trẻ / Thì chỉ thấy trẻ A |
| AC-13 | Cho một phụ huynh của trẻ A / Khi gọi điểm cuối lấy hồ sơ của trẻ B / Thì bị từ chối |

## 4. Điểm danh và chăm sóc hằng ngày

| Mã | Tiêu chí |
|---|---|
| AC-14 | Cho giáo viên chủ nhiệm lớp Mầm 1 / Khi điểm danh trong ngày cho lớp / Thì hệ thống tạo đúng một bản ghi cho mỗi trẻ trong ngày, không tạo trùng khi bấm lưu hai lần |
| AC-15 | Cho ngày đã chốt điểm danh / Khi giáo viên sửa trạng thái điểm danh của một trẻ / Thì hệ thống yêu cầu nhập lý do và ghi nhật ký thao tác kèm giá trị trước và sau |
| AC-16 | Cho phụ huynh báo vắng cho con trước giờ học / Khi giáo viên mở bảng điểm danh / Thì trẻ đã ở trạng thái nghỉ có báo và không bị tính là vắng không báo |
| AC-17 | Cho một giáo viên không phụ trách lớp Mầm 1 / Khi gọi điểm cuối điểm danh của lớp Mầm 1 / Thì bị từ chối |
| AC-18 | Cho phụ huynh của trẻ A / Khi mở nhật ký của bé / Thì chỉ thấy nhật ký của trẻ A, không thấy nhật ký của trẻ khác trong lớp |
| AC-19 | Cho giáo viên ghi nhật ký cho một trẻ không thuộc lớp mình / Khi lưu / Thì bị từ chối |
| AC-20 | Cho người đến đón trẻ không có tên trong danh sách ủy quyền / Khi giáo viên thực hiện bàn giao / Thì hệ thống chặn bàn giao và yêu cầu xác nhận của phụ huynh |

## 5. Học phí, khoản thu và giảm trừ

| Mã | Tiêu chí |
|---|---|
| AC-21 | Cho một trẻ đăng ký bán trú, STEM và Anh văn trong kỳ / Khi kế toán chạy tính học phí / Thì khoản phải thu của trẻ gồm đúng ba khoản dịch vụ cộng học phí chính khóa theo biểu phí đang hiệu lực |
| AC-22 | Cho một trẻ có mười tám ngày ăn thực tế trong tháng theo điểm danh đã chốt / Khi tính học phí kỳ / Thì tiền ăn bằng đơn giá suất ăn nhân mười tám và hiển thị được số ngày ăn làm căn cứ |
| AC-23 | Cho một trẻ là con của nhân sự trong trường / Khi áp dụng giảm trừ / Thì mức giảm trừ theo chính sách trẻ con nhân sự được áp dụng và ghi rõ người phê duyệt |
| AC-24 | Cho hóa đơn đã phát hành / Khi kế toán sửa trực tiếp số tiền trên hóa đơn / Thì hệ thống không cho sửa và yêu cầu lập phiếu điều chỉnh |
| AC-25 | Cho một phiếu điều chỉnh hóa đơn / Khi mở phiếu / Thì thấy liên kết tới hóa đơn gốc và lý do điều chỉnh |
| AC-26 | Cho một trẻ nhập học ngày mười lăm của tháng có hai mươi hai ngày học, trẻ học mười hai ngày / Khi tính học phí kỳ / Thì học phí chính khóa bằng học phí tháng nhân mười hai chia hai mươi hai (BR-23) |
| AC-27 | Cho một kế toán đơn vị A / Khi gọi điểm cuối phát hành khoản phải thu của đơn vị B / Thì bị từ chối |
| AC-28 | Cho một phụ huynh / Khi mở màn hình học phí / Thì chỉ thấy học phí và công nợ của con mình, không thấy của trẻ khác |
| AC-29 | Cho kỳ đã phát hành khoản phải thu / Khi kế toán đăng ký thêm dịch vụ không bắt buộc cho một trẻ / Thì đăng ký ở trạng thái chờ Ban Giám hiệu duyệt theo BR-26 và hóa đơn đã phát hành không bị sửa |

## 6. Thu chi, quỹ và công nợ

| Mã | Tiêu chí |
|---|---|
| AC-30 | Cho một phiếu thu mới / Khi phát hành / Thì hệ thống cấp số phiếu không trùng trong phạm vi đơn vị và năm học |
| AC-31 | Cho phiếu thu một triệu đồng / Khi phân bổ vào ba khoản phải thu có tổng một triệu hai trăm nghìn đồng / Thì hệ thống từ chối vì tổng phân bổ vượt số tiền thu |
| AC-32 | Cho một trẻ có hai hóa đơn còn phải nộp một triệu và hai triệu đồng / Khi thu một triệu đồng cho hóa đơn một triệu / Thì hóa đơn đó đã thu đủ và công nợ của trẻ còn hai triệu đồng |
| AC-33 | Cho phiếu thu đã phát hành / Khi kế toán bấm xóa / Thì hệ thống không cho xóa và yêu cầu lập phiếu đảo |
| AC-34 | Cho phiếu đảo được lập từ phiếu thu gốc / Khi mở phiếu đảo / Thì thấy tham chiếu tới phiếu gốc và phiếu gốc vẫn tồn tại nguyên vẹn |
| AC-35 | Cho phiếu chi có giá trị từ hạn mức trở lên / Khi kế toán trình duyệt / Thì hệ thống chuyển cho Hiệu trưởng và phiếu ở trạng thái chờ duyệt |
| AC-36 | Cho một giáo viên / Khi gọi điểm cuối danh sách phiếu chi của đơn vị / Thì bị từ chối |
| AC-37 | Cho quỹ tiền mặt có số dư một triệu đồng / Khi lập phiếu chi hai triệu đồng từ quỹ tiền mặt / Thì hệ thống từ chối và báo số dư không đủ, ở mọi đơn vị |

## 7. Nhân sự, chấm công và tiền lương

| Mã | Tiêu chí |
|---|---|
| AC-38 | Cho một hợp đồng lao động sắp hết hạn trong mười ngày và cấu hình cảnh báo là mười lăm ngày / Khi nhân sự mở trang chủ / Thì thấy cảnh báo hợp đồng sắp hết hạn |
| AC-39 | Cho nhân sự chấm công ngày mười tháng mười / Khi nhân sự ghi giờ vào và giờ ra / Thì hệ thống tính số giờ làm thực tế và xếp trạng thái đủ công, đi muộn hoặc về sớm theo cấu hình |
| AC-40 | Cho một đơn xin nghỉ phép bị từ chối hoặc đã hủy / Khi chốt bảng công / Thì ngày nghỉ đó không được tính là nghỉ có lương (Q-153) |
| AC-41 | Cho bảng công đã chốt / Khi nhân sự sửa giờ chấm công của kỳ đó / Thì hệ thống chặn và yêu cầu mở lại kỳ, việc mở lại do Ban Giám hiệu phê duyệt |
| AC-42 | Bỏ ngày 09/10/2026: nhà trường không cho ứng lương (Q-54) |
| AC-43 | Cho bảng công tháng 9 đã chốt / Khi kế toán tính bảng lương tháng 10 vào đầu tháng 10 / Thì lương mỗi nhân sự bằng lương hợp đồng cộng phụ cấp cố định cộng thưởng trừ khấu trừ cố định, cộng trừ phần điều chỉnh theo công tháng 9 gồm trừ ngày không hưởng lương, cộng tiền làm thêm giờ, phụ cấp và khấu trừ theo ngày công; mọi thành phần đều xem được chi tiết (BR-43) |
| AC-44 | Cho một giáo viên / Khi mở phiếu lương / Thì chỉ thấy phiếu lương của chính mình |
| AC-45 | Cho một giáo viên / Khi gọi điểm cuối bảng lương của đơn vị / Thì bị từ chối |
| AC-46 | Cho bảng lương đã chốt / Khi kế toán sửa trực tiếp / Thì hệ thống không cho sửa và yêu cầu lập bảng điều chỉnh cho kỳ sau |

## 8. Y tế học đường

| Mã | Tiêu chí |
|---|---|
| AC-47 | Cho phụ huynh gửi yêu cầu dặn thuốc thiếu giờ cho uống / Khi gửi / Thì hệ thống từ chối và yêu cầu bổ sung thông tin bắt buộc |
| AC-48 | Cho yêu cầu dặn thuốc đã đủ thông tin / Khi y tế chưa xác nhận nhận thuốc / Thì thuốc không xuất hiện trong danh sách cần cho uống |
| AC-49 | Cho phiếu dặn thuốc đã nhận / Khi y tế ghi nhận một liều / Thì hệ thống lưu thời điểm và người thực hiện, không cho ghi trùng cùng một liều trong cùng một thời điểm |
| AC-50 | Cho y tế bỏ một liều / Khi ghi nhận bỏ liều / Thì hệ thống bắt buộc nhập lý do và thông báo cho phụ huynh của trẻ |
| AC-51 | Cho một giáo viên không phụ trách và không liên quan tới trẻ A / Khi gọi điểm cuối hồ sơ sức khỏe của trẻ A / Thì bị từ chối |
| AC-52 | Cho một sự kiện y tế phát sinh tại trường / Khi y tế ghi nhận / Thì phụ huynh của trẻ nhận được thông báo và bản ghi lưu người xử lý cùng cách xử lý |

## 9. Xe đưa đón (đã bỏ ngày 09/10/2026)

| Mã | Tiêu chí |
|---|---|
| AC-53 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| AC-54 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| AC-55 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| AC-56 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| AC-57 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |

## 10. Bếp và dinh dưỡng

| Mã | Tiêu chí |
|---|---|
| AC-58 | Cho ngày mười tháng mười có ba mươi trẻ có mặt theo điểm danh và hai trẻ nghỉ / Khi bếp mở số suất ăn của ngày / Thì số suất là ba mươi cho mỗi bữa sáng, trưa, xế, và hai trẻ nghỉ không bị tính tiền ăn ngày đó |
| AC-59 | Cho một thực đơn tuần chưa được duyệt / Khi phụ huynh mở màn hình thực đơn / Thì thực đơn đó không hiển thị |
| AC-60 | Cho một thực đơn tuần đã công bố / Khi phụ huynh mở màn hình thực đơn / Thì thấy đúng thực đơn của đơn vị và độ tuổi của con |
| AC-61 | Cho một giáo viên không thuộc bộ phận bếp / Khi gọi điểm cuối sửa định lượng nguyên liệu / Thì bị từ chối |

## 11. Kho, tài sản và mua hàng

| Mã | Tiêu chí |
|---|---|
| AC-62 | Cho một tài sản đang được cấp cho lớp Mầm 1 / Khi nhân viên kho thu hồi / Thì phiếu thu hồi được sinh và tài sản trở về trạng thái trong kho |
| AC-63 | Cho mặt hàng có tồn kho mười đơn vị / Khi lập phiếu xuất mười lăm đơn vị / Thì hệ thống từ chối vì vượt tồn |
| AC-64 | Cho một đề nghị mua hàng vượt hạn mức / Khi nhân viên kho trình duyệt / Thì đề nghị chuyển sang cấp duyệt cao hơn và ở trạng thái chờ duyệt |
| AC-65 | Cho một giáo viên / Khi gọi điểm cuối lập phiếu mua hàng / Thì bị từ chối |
| AC-66 | Cho một kỳ kiểm kê có chênh lệch / Khi nhân viên kho ghi nhận số thực tế / Thì biên bản kiểm kê ghi rõ chênh lệch và cần người phê duyệt |

## 12. Hoạt động, nội dung và truyền thông

| Mã | Tiêu chí |
|---|---|
| AC-67 | Cho giáo viên tạo một hoạt động của lớp / Khi lưu / Thì hoạt động ở trạng thái chờ duyệt và chưa hiển thị cho phụ huynh |
| AC-68 | Cho một hoạt động đã được quản lý đơn vị duyệt / Khi phụ huynh của trẻ trong lớp mở ứng dụng / Thì thấy hoạt động đó kèm hình ảnh |
| AC-69 | Cho một hoạt động bị từ chối / Khi giáo viên mở lại / Thì thấy lý do từ chối |
| AC-70 | Cho một trẻ chưa có cờ đồng ý sử dụng hình ảnh / Khi giáo viên tải lên album có hình của trẻ đó / Thì hệ thống cảnh báo và không công bố hình của trẻ đó |
| AC-71 | Cho một phụ huynh / Khi mở danh sách tin tức / Thì chỉ thấy tin tức có phạm vi công bố bao gồm đơn vị và lớp của con mình |
| AC-72 | Cho một giáo viên bộ môn / Khi gọi điểm cuối duyệt hoạt động / Thì bị từ chối |
| AC-73 | Cho một thông báo quan trọng / Khi quản lý đơn vị mở báo cáo thông báo / Thì thấy danh sách phụ huynh đã đọc và chưa đọc |

## 13. Tương tác và ý kiến

| Mã | Tiêu chí |
|---|---|
| AC-74 | Cho một tài khoản phụ huynh đã gửi phiếu bình chọn / Khi gửi phiếu thứ hai cho cùng bình chọn / Thì hệ thống từ chối |
| AC-75 | Cho một bình chọn đã hết thời gian / Khi phụ huynh gửi phiếu / Thì hệ thống từ chối và báo đã hết thời gian |
| AC-76 | Cho một phụ huynh gửi bình luận tiêu cực trên hoạt động của lớp / Khi quản lý đơn vị xử lý / Thì bình luận vẫn tồn tại và có bản ghi xử lý, không bị xóa |
| AC-77 | Cho một phụ huynh / Khi mở luồng trao đổi / Thì chỉ thấy trao đổi liên quan tới con mình và với nhà trường |
| AC-78 | Cho một phụ huynh / Khi gọi điểm cuối đọc trao đổi giữa giáo viên và phụ huynh khác / Thì bị từ chối |

## 14. Tuyển sinh, tuyển dụng

| Mã | Tiêu chí |
|---|---|
| AC-79 | Cho một hồ sơ tuyển sinh đã đạt / Khi nhân viên tuyển sinh chuyển thành hồ sơ trẻ / Thì hồ sơ trẻ được sinh, phụ huynh được gắn và trẻ được phân vào lớp dự kiến |
| AC-80 | Cho một hồ sơ tuyển sinh chưa đạt / Khi chuyển thành hồ sơ trẻ / Thì hệ thống từ chối |
| AC-81 | Cho một nhân viên tuyển sinh đơn vị A / Khi gọi điểm cuối hồ sơ tuyển sinh của đơn vị B / Thì bị từ chối |
| AC-82 | Cho một ứng viên đã có kết quả tuyển / Khi mở hồ sơ ứng viên / Thì thấy lịch sử phỏng vấn và người đánh giá |

## 15. Báo cáo và bảng điều khiển

| Mã | Tiêu chí |
|---|---|
| AC-83 | Cho Hiệu trưởng / Khi mở bảng điều khiển / Thì thấy số trẻ, số lớp, số nhân sự, thu học phí, công nợ và tỷ lệ đi học của mọi đơn vị ở mọi cấp |
| AC-84 | Cho quản lý đơn vị A / Khi mở bảng điều khiển / Thì chỉ thấy số liệu của đơn vị A và các đơn vị cấp dưới trực thuộc, không thấy đơn vị khác |
| AC-85 | Cho báo cáo công nợ kỳ tháng mười / Khi kế toán mở báo cáo / Thì tổng công nợ bằng tổng khoản phải thu trừ tổng đã phân bổ từ phiếu thu trừ giảm trừ đã duyệt, và khớp với tổng công nợ của từng trẻ |
| AC-86 | Cho báo cáo thu chi khoảng ngày bất kỳ / Khi kế toán xuất tệp / Thì hệ thống sinh tệp và ghi nhật ký xuất dữ liệu kèm người xuất và thời điểm |
| AC-87 | Cho một giáo viên / Khi gọi điểm cuối báo cáo thu chi / Thì bị từ chối |
| AC-88 | Cho báo cáo hợp nhất nhiều đơn vị / Khi Hiệu trưởng chọn hai đơn vị / Thì chỉ số của hai đơn vị hiển thị tách biệt và có dòng tổng |

## 16. Kênh truy cập và thông báo

| Mã | Tiêu chí |
|---|---|
| AC-89 | Cho một phụ huynh mới được tạo tài khoản với mật khẩu mặc định chung / Khi đăng nhập lần đầu / Thì bắt buộc đổi mật khẩu trước khi dùng |
| AC-90 | Cho một tài khoản bị khóa / Khi đăng nhập / Thì bị từ chối và thông báo liên hệ nhà trường |
| AC-91 | Cho một sự kiện nghiệp vụ có cấu hình gửi thông báo / Khi sự kiện xảy ra / Thì thông báo được tạo cho đúng đối tượng nhận và có trạng thái đã đọc, chưa đọc |
| AC-92 | Cho ứng dụng phụ huynh / Khi mạng chậm và phụ huynh bấm gửi báo vắng hai lần / Thì hệ thống chỉ tạo một bản ghi báo vắng |
| AC-93 | Cho một tài khoản phụ huynh / Khi gọi điểm cuối dữ liệu của trẻ không có quan hệ với tài khoản đó / Thì bị từ chối ở máy chủ |

## 17. Đơn vị tổ chức, phân cấp phê duyệt và kiến trúc

| Mã | Tiêu chí |
|---|---|
| AC-135 | Cho một trường chưa cấu hình đơn vị / Khi Hiệu trưởng tạo Trường chính / Thì hệ thống tạo đơn vị cấp cao nhất với đơn vị cha trống |
| AC-136 | Cho cây đơn vị hai cấp / Khi tạo đơn vị dưới một Phân hiệu hoặc Điểm trường, hoặc đặt Trường chính dưới đơn vị khác / Thì hệ thống từ chối vì cây chỉ có hai cấp (BR-01, YCTD-38) |
| AC-137 | Cho Trường chính có hai Phân hiệu và ba Điểm trường / Khi mở màn hình cây đơn vị / Thì thấy mỗi đơn vị cấp 2 nằm dưới Trường chính kèm loại đơn vị, và chuyển được sang dạng danh sách phẳng lọc theo loại (YCTD-38) |
| AC-138 | Cho một lớp thuộc Điểm trường / Khi xếp trẻ vào lớp đó / Thì đơn vị của trẻ được ghi nhận là Điểm trường đó |
| AC-139 | Cho một người dùng được gán phạm vi ở Trường chính / Khi truy vấn dữ liệu của một Điểm trường trực thuộc / Thì được phép vì đơn vị cấp trên bao gồm đơn vị cấp dưới trực thuộc |
| AC-140 | Cho một người dùng được gán phạm vi ở Điểm trường A / Khi truy vấn dữ liệu của Trường chính hoặc của đơn vị cấp 2 khác / Thì bị từ chối vì phạm vi chỉ gồm đơn vị được gán (YCTD-38) |
| AC-141 | Cho hạn mức phê duyệt của một đơn vị / Khi Phó Hiệu trưởng phê duyệt phiếu chi có giá trị dưới hạn mức / Thì phiếu chi được duyệt |
| AC-142 | Cho hạn mức phê duyệt của một đơn vị / Khi Phó Hiệu trưởng phê duyệt phiếu chi có giá trị bằng hoặc trên hạn mức / Thì hệ thống từ chối và yêu cầu chuyển lên Hiệu trưởng |
| AC-143 | Cho một phiếu chi do chính người phê duyệt lập / Khi người đó phê duyệt phiếu / Thì hệ thống từ chối vì người lập không tự phê duyệt chứng từ của mình |
| AC-144 | Cho một Phó Hiệu trưởng được gán đơn vị A / Khi phê duyệt chứng từ của đơn vị B / Thì bị từ chối |
| AC-145 | Cho tầng giao diện / Khi kiểm tra mã nguồn của gói giao diện / Thì không có thông tin đăng nhập cơ sở dữ liệu và không có truy vấn dữ liệu trực tiếp |
| AC-146 | Cho một yêu cầu thay đổi dữ liệu / Khi gửi kèm mã phiên do dịch vụ định danh phát hành / Thì máy chủ API nghiệp vụ kiểm tra mã phiên với dịch vụ định danh trước khi xử lý |
| AC-147 | Cho một người dùng không có quyền quản lý tài khoản, ví dụ giáo viên / Khi gọi điểm cuối quản lý tài khoản của người khác / Thì bị từ chối ở dịch vụ định danh |
| AC-148 | Cho một chứng từ vượt hạn mức đã bị Phó Hiệu trưởng từ chối / Khi xem nhật ký thao tác / Thì thấy người từ chối, thời điểm và lý do từ chối |

## 18. Tiêu chí nghiệm thu nằm trong đặc tả quy trình

Các mã từ AC-94 đến AC-134 được viết trực tiếp trong mục 12 của từng đặc tả quy trình, không lặp lại trong tài liệu này. Nội dung gốc nằm ở tệp tương ứng dưới đây.

| Mã | Tệp |
|---|---|
| AC-94 đến AC-96 | `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md` |
| AC-97 đến AC-99 | `25_QUY_TRINH_NGHIEP_VU/QT-02_DIEM_DANH_BAO_VANG.md` |
| AC-100 đến AC-103 | `25_QUY_TRINH_NGHIEP_VU/QT-03_DANG_KY_DICH_VU_VA_TINH_HOC_PHI.md` |
| AC-104 đến AC-108 | `25_QUY_TRINH_NGHIEP_VU/QT-04_THU_HOC_PHI_VA_CONG_NO.md` |
| AC-109 đến AC-113 | `25_QUY_TRINH_NGHIEP_VU/QT-05_PHIEU_CHI_VA_QUY.md` |
| AC-114 đến AC-116 | `25_QUY_TRINH_NGHIEP_VU/QT-06_CHAM_CONG_VA_TINH_LUONG.md` |
| AC-117 đến AC-119 | `25_QUY_TRINH_NGHIEP_VU/QT-07_DAN_THUOC_VA_CHAM_SOC_SUC_KHOE.md` |
| AC-120 đến AC-123 | `25_QUY_TRINH_NGHIEP_VU/QT-08_TO_CHUC_DUA_DON.md`, đã bỏ ngày 09/10/2026 |
| AC-124 đến AC-129 | `25_QUY_TRINH_NGHIEP_VU/QT-09_NHAT_KY_VA_TRAO_DOI.md` |
| AC-130 đến AC-134 | `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md` |

## 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng

| Mã | Tiêu chí |
|---|---|
| AC-149 | Cho quản lý đơn vị A / Khi tạo phòng học / Thì phòng thuộc đơn vị A và chỉ chọn được cho lớp của đơn vị A |
| AC-150 | Cho một bậc học đã gắn với lớp hoặc biểu phí / Khi ngừng sử dụng bậc học / Thì không chọn được cho lớp mới, còn lớp và biểu phí cũ giữ nguyên |
| AC-151 | Cho phụ huynh của trẻ A / Khi báo mất đồ / Thì phiếu ở trạng thái đã báo và giáo viên chủ nhiệm lớp của trẻ A nhận thông báo |
| AC-152 | Cho phụ huynh của trẻ A / Khi gọi điểm cuối xem phiếu đồ bị mất của trẻ B / Thì bị từ chối ở máy chủ |
| AC-153 | Cho một phiếu đồ bị mất đã đóng / Khi người dùng bấm xóa / Thì hệ thống không cho xóa |
| AC-154 | Cho bài học đã gán lĩnh vực và nhóm / Khi giáo viên lọc theo lĩnh vực / Thì chỉ thấy bài học thuộc lĩnh vực đó |
| AC-155 | Cho phiếu thu chưa chọn khoản mục / Khi kế toán phát hành / Thì hệ thống từ chối và yêu cầu chọn khoản mục |
| AC-156 | Cho báo cáo thu chi của một kỳ / Khi nhóm theo nhóm thu chi / Thì tổng các nhóm bằng tổng thu chi của kỳ |
| AC-157 | Cho một ngày nghỉ lễ có hưởng lương / Khi chốt bảng công / Thì ngày đó ghi trạng thái nghỉ lễ, không tính vắng không phép |
| AC-158 | Cho một ngày thứ bảy nghỉ định kỳ của trường / Khi chốt bảng công / Thì ngày đó không tính vắng không phép với mọi nhân sự |
| AC-159 | Cho một giáo viên / Khi gọi điểm cuối sửa ngày nghỉ lễ / Thì bị từ chối |
| AC-160 | Cho đề nghị mua thuốc đã duyệt / Khi y tế ghi nhận thuốc đã mua / Thì số lượng thuốc trong danh mục tăng đúng số đã mua |
| AC-161 | Cho lịch khám đã lập cho lớp Mầm 1 / Khi y tế công bố lịch / Thì phụ huynh của trẻ lớp Mầm 1 nhận thông báo |
| AC-162 | Cho kết quả khám có chỉ số ngoài ngưỡng tiêu chuẩn / Khi y tế lưu kết quả / Thì chỉ số được đánh dấu cần theo dõi |
| AC-163 | Cho phiếu đi chợ / Khi nhân viên bếp xác nhận nhập / Thì tồn nguyên liệu tăng và phát sinh đề nghị thanh toán theo QT-05 |
| AC-164 | Cho mặt hàng đã có giao dịch nhập xuất / Khi nhập tồn ban đầu / Thì hệ thống từ chối |
| AC-165 | Cho hoạt động ngoại khóa có chỉ tiêu hai mươi trẻ đã đủ chỗ / Khi phụ huynh đăng ký / Thì hệ thống từ chối và báo hết chỗ |
| AC-166 | Cho hoạt động ngoại khóa thu phí theo từng hoạt động / Khi đăng ký được ghi nhận / Thì phí được đưa vào khoản phải thu như khoản phát sinh |
| AC-167 | Cho phụ huynh bình luận trên tin tức / Khi người khác bấm xóa bình luận / Thì bình luận không bị xóa |
| AC-168 | Cho tin tuyển sinh đã công bố của đợt đang mở / Khi mở danh sách tin tuyển sinh / Thì thấy tin kèm thời hạn nhận hồ sơ |
| AC-169 | Cho giáo viên chủ nhiệm lớp Mầm 1 / Khi mở bảng tin / Thì chỉ thấy sinh nhật trong tháng của trẻ lớp Mầm 1 |
| AC-170 | Cho báo cáo học thứ 7 của một kỳ / Khi kế toán mở báo cáo / Thì thấy các ngày thứ bảy học bù trong kỳ và số trẻ đi học, số trẻ vắng của từng ngày |
| AC-171 | Bỏ ngày 09/10/2026: trường không có bữa tối (YCTD-20) |
| AC-172 | Cho một giáo viên / Khi gọi điểm cuối báo cáo học thứ 7 của đơn vị / Thì bị từ chối |
| AC-173 | Cho một ngày thứ bảy có lịch học bù / Khi chốt bảng công / Thì ngày đó là ngày làm việc và nhân sự không chấm công bị tính vắng |
| AC-174 | Cho hoạt động ngoại khóa thu phí theo tháng và một trẻ đã đăng ký / Khi kế toán chạy tính học phí kỳ kế tiếp / Thì phí hoạt động có trong khoản phải thu của kỳ đó cho tới khi đăng ký hết hiệu lực |
| AC-175 | Cho trẻ đăng ký hoạt động ngoại khóa thu phí theo tháng, nghỉ ba buổi và thôi tham gia ngày mười lăm / Khi kế toán tính học phí kỳ đó / Thì phí hoạt động của tháng được thu đủ, không có dòng giảm trừ |
| AC-176 | Cho biểu phí có học phí chính khóa bằng không / Khi kế toán tính học phí kỳ / Thì hóa đơn chỉ gồm các khoản dịch vụ, không có dòng học phí chính khóa |
| AC-177 | Cho loại miễn giảm anh chị em ruột giảm mười phần trăm tiền bán trú / Khi áp dụng cho một trẻ / Thì dòng giảm trừ bằng mười phần trăm tiền bán trú và ghi rõ loại miễn giảm |
| AC-178 | Cho quy định giáo viên thâm niên từ năm năm được mười ba ngày phép / Khi cấp phép năm cho giáo viên có sáu năm thâm niên / Thì số ngày phép được cấp là mười ba |
| AC-179 | Cho loại khấu trừ cấu hình theo tỷ lệ phần trăm lương hợp đồng / Khi tính lương / Thì số tiền khấu trừ bằng tỷ lệ nhân lương hợp đồng và hiển thị căn cứ |
| AC-180 | Cho phụ huynh đã đổi mật khẩu mặc định / Khi yêu cầu mã một lần và nhập đúng mã trong thời hạn / Thì đăng nhập thành công không cần mật khẩu |
| AC-181 | Cho phụ huynh yêu cầu mã một lần / Khi nhập sai mã quá số lần cấu hình hoặc nhập mã đã hết hạn / Thì bị từ chối và phải yêu cầu mã mới |
| AC-182 | Cho đơn vị đã bật chặn đăng ký dịch vụ khi nợ quá hạn và trẻ còn công nợ quá hạn / Khi phụ huynh đăng ký thêm dịch vụ / Thì bị từ chối kèm thông báo công nợ; trẻ vẫn được điểm danh bình thường |
| AC-183 | Cho tệp Excel nhập trẻ có một dòng thiếu ngày sinh / Khi kiểm tra tệp / Thì hệ thống báo dòng lỗi và không ghi dòng nào cho tới khi sửa hết lỗi |
| AC-184 | Cho tệp công nợ đầu kỳ hợp lệ / Khi ghi dữ liệu / Thì mỗi trẻ có khoản phải thu đầu kỳ đúng số tiền và lần nhập được ghi nhật ký |
| AC-185 | Cho một giáo viên / Khi gọi điểm cuối nhập dữ liệu ban đầu / Thì bị từ chối |
| AC-186 | Cho hóa đơn còn phải nộp hai triệu đồng / Khi phụ huynh chuyển khoản đủ hai triệu theo mã QR và hệ thống nhận thông báo tiền vào / Thì phiếu thu được tự lập, hóa đơn đã thu đủ và phụ huynh nhận biên nhận |
| AC-187 | Cho một thông báo tiền vào đã xử lý / Khi nhà cung cấp gửi lại cùng mã giao dịch / Thì hệ thống không tạo phiếu thu thứ hai |
| AC-188 | Cho chuyển khoản có số tiền khác số còn phải nộp / Khi hệ thống nhận thông báo tiền vào / Thì không tự lập phiếu thu, giao dịch vào danh sách chờ kế toán xử lý |
| AC-189 | Cho hóa đơn còn phải nộp hai triệu đồng / Khi kế toán lập phiếu thu một triệu cho hóa đơn đó / Thì hệ thống từ chối vì không nhận thanh toán một phần |
| AC-190 | Cho phụ huynh của trẻ A đã đồng ý sử dụng hình ảnh / Khi phụ huynh rút đồng ý trên ứng dụng / Thì hình của trẻ A không được công bố thêm, hình đã công bố có trẻ A bị ẩn và lịch sử đồng ý ghi người, thời điểm |
| AC-191 | Cho phụ huynh của trẻ A / Khi gọi điểm cuối thay đổi đồng ý hình ảnh của trẻ B / Thì bị từ chối ở máy chủ |
| AC-192 | Cho kế toán mở hồ sơ trẻ / Khi xem số định danh cá nhân / Thì chỉ thấy số đã che |
| AC-193 | Cho quản lý đơn vị xem đầy đủ số định danh cá nhân của trẻ / Khi mở nhật ký truy cập dữ liệu nhạy cảm / Thì thấy bản ghi người xem và thời điểm |
| AC-194 | Cho năm học 2026–2027 đang dùng / Khi Hiệu trưởng mở năm học 2027–2028 / Thì hệ thống tạo cơ sở dữ liệu năm học mới có trẻ đang học, phụ huynh, nhân sự, danh mục, cấu hình và số dư công nợ chưa tất toán, giữ nguyên mã định danh của bản ghi chuyển sang (QĐ-17); cơ sở dữ liệu năm cũ chuyển sang chỉ đọc |
| AC-195 | Cho khóa API có phạm vi báo cáo tổng hợp / Khi đối tác gọi điểm cuối danh sách trẻ / Thì bị từ chối |
| AC-196 | Cho khóa API có phạm vi danh sách trẻ / Khi đối tác đọc danh sách trẻ / Thì mỗi lần đọc được ghi nhật ký truy cập dữ liệu nhạy cảm kèm khóa và căn cứ pháp lý |
| AC-197 | Cho nhân viên làm vượt giờ chuẩn 2 giờ trong một ngày / Khi chốt bảng công của tháng / Thì chỉ tính 1 giờ làm thêm, tiền làm thêm bằng 1 giờ nhân đơn giá cấu hình và được cộng vào bảng lương tháng kế tiếp |
| AC-198 | Cho kỳ đã qua ngày chốt / Khi phụ huynh đăng ký thêm lớp STEM / Thì đăng ký ở trạng thái chờ Ban Giám hiệu duyệt, chưa sinh khoản phải thu |
| AC-199 | Cho đăng ký trễ được duyệt với cách thu theo ngày thực tế / Khi tính học phí kỳ / Thì phí bằng phí tháng nhân số ngày học từ ngày bắt đầu học dịch vụ, kể cả ngày đó, đến cuối tháng, chia số ngày học của tháng (Q-150) |
| AC-200 | Cho một trẻ đang học / Khi phụ huynh hoặc kế toán bỏ chọn bán trú / Thì hệ thống không cho bỏ |
| AC-201 | Cho trẻ chưa có mã định danh ngành / Khi mở danh sách trẻ / Thì ô mã ngành để trống và tô đỏ |
| AC-202 | Cho tệp mã định danh ngành / Khi nhập / Thì mã được gán theo số định danh cá nhân, dòng không khớp hoặc mã trùng được báo lỗi |
| AC-203 | Cho phụ huynh mới được tạo tài khoản với mật khẩu mặc định / Khi đăng nhập bằng mật khẩu mặc định / Thì chỉ vào được màn hình đổi mật khẩu cho tới khi đổi xong; đăng nhập bằng mã một lần thì dùng bình thường (Q-147) |
| AC-204 | Cho một ngày thứ bảy có lịch học bù do Ban Giám hiệu lập / Khi giáo viên mở điểm danh ngày đó / Thì mọi lớp của mọi đơn vị có danh sách điểm danh như ngày học thường và ngày đó được tính vào số ngày học của tháng |
| AC-205 | Cho tài khoản quản lý đơn vị hoặc nhân sự / Khi gọi điểm cuối tạo lịch nghỉ thứ bảy hoặc lịch học bù / Thì bị từ chối |
| AC-206 | Cho tài khoản kế toán trưởng, nhân sự hoặc giáo viên bộ môn / Khi gọi điểm cuối hồ sơ sức khỏe của một trẻ / Thì bị từ chối (BR-53) |
| AC-207 | Cho phiếu chi hoàn tiền khi trẻ thôi học có giá trị dưới hạn mức / Khi Phó Hiệu trưởng phê duyệt / Thì hệ thống từ chối và chuyển Hiệu trưởng (BR-24) |
| AC-208 | Cho loại chứng từ chưa được cấu hình hạn mức / Khi kế toán trình duyệt chứng từ loại đó / Thì chứng từ chuyển cho Hiệu trưởng (Q-112) |
| AC-209 | Cho tài khoản kiểm toán viên đã quá ngày hết hiệu lực / Khi đăng nhập / Thì bị từ chối và tài khoản ở trạng thái khóa (BM-68) |
| AC-210 | Cho trẻ đã có hóa đơn chính tháng mười đã phát hành và một đăng ký trễ lớp STEM vừa được Ban Giám hiệu duyệt / Khi kế toán phát hành khoản phát sinh / Thì hệ thống sinh hóa đơn bổ sung tháng mười, hóa đơn chính giữ nguyên (BR-85) |
| AC-211 | Cho khóa API đối tác đã bị thu hồi / Khi đối tác gọi bất kỳ điểm cuối nào bằng khóa đó / Thì bị từ chối ngay (QĐ-16) |
| AC-212 | Cho phiếu đảo phiếu thu vừa được lập / Khi chưa được Ban Giám hiệu duyệt / Thì phiếu gốc và công nợ chưa thay đổi, và kế toán trưởng gọi điểm cuối duyệt bị từ chối (YCTD-23) |
| AC-213 | Cho đề xuất xử lý công nợ quá hạn do quản lý đơn vị lập / Khi quản lý đơn vị gọi điểm cuối ghi quyết định / Thì bị từ chối; khi Phó Hiệu trưởng ghi quyết định thì đề xuất chuyển sang đã quyết định và số tiền công nợ không đổi (YCTD-23) |
| AC-214 | Cho phiếu đảo phiếu chi vừa được lập / Khi chưa được Ban Giám hiệu duyệt / Thì phiếu gốc và số dư quỹ chưa thay đổi, và kế toán trưởng gọi điểm cuối duyệt bị từ chối (YCTD-24) |
| AC-215 | Cho đơn vị đã bật cấu hình không có nhân viên y tế / Khi phụ huynh của trẻ thuộc đơn vị đó gửi yêu cầu dặn thuốc / Thì giáo viên chủ nhiệm nhận được yêu cầu, xác nhận nhận thuốc và ghi nhận được từng liều (BR-86) |
| AC-216 | Cho đơn vị chưa bật cấu hình không có nhân viên y tế / Khi giáo viên chủ nhiệm gọi điểm cuối xác nhận nhận thuốc / Thì bị từ chối (BR-86) |
| AC-217 | Cho yêu cầu dặn thuốc không có ảnh thuốc / Khi phụ huynh gửi / Thì hệ thống từ chối và yêu cầu gửi ảnh thuốc; yêu cầu không có ảnh đơn thuốc vẫn gửi được (BR-48) |
| AC-218 | Cho giáo viên chủ nhiệm ghi nhiệt độ và tình trạng của trẻ A trong ngày / Khi phụ huynh trẻ A mở ứng dụng / Thì thấy bản ghi chăm sóc của con; phụ huynh trẻ khác không thấy (BR-87) |
| AC-219 | Cho sự kiện y tế đã thông báo phụ huynh / Khi phụ huynh bấm đã biết / Thì y tế và giáo viên chủ nhiệm thấy trạng thái đã xác nhận kèm thời điểm; khi chưa bấm thì thấy chưa xác nhận và hệ thống không nhắc lại (BR-88) |
| AC-220 | Cho tài khoản vừa được Hiệu trưởng đặt lại mật khẩu / Khi người dùng đăng nhập bằng mật khẩu mới được cấp / Thì chỉ vào được màn hình đổi mật khẩu cho tới khi đổi xong (Q-148) |
| AC-221 | Cho năm học đang dùng còn một trẻ đã thôi học có công nợ chưa tất toán / Khi Hiệu trưởng mở năm học mới / Thì hệ thống chặn, liệt kê trẻ còn nợ và năm đang dùng vẫn ghi được (BR-89, YCTD-37) |
| AC-222 | Cho kỳ còn lớp có ngày chưa chốt điểm danh / Khi kế toán chạy tính học phí kỳ / Thì hệ thống chặn và liệt kê lớp, ngày chưa chốt (Q-151) |
| AC-223 | Cho thủ quỹ và một hóa đơn còn phải nộp 1 000 000 / Khi thủ quỹ lập phiếu thu tiền mặt 1 000 000 và chọn hóa đơn đó / Thì hóa đơn ở trạng thái đã thu đủ và quỹ tiền mặt tăng 1 000 000 (Q-152) |
| AC-224 | Cho bảng công tháng 9 của một đơn vị chưa chốt / Khi kế toán tính bảng lương tháng 10 / Thì hệ thống chặn và liệt kê đơn vị chưa chốt công (BR-43) |
| AC-225 | Cho lương hợp đồng 12 000 000, ngày công chuẩn tháng 9 là 24, nhân sự có 2 ngày nghỉ không lương và 1 ngày vắng không phép trong tháng 9 / Khi tính bảng lương tháng 10 / Thì dòng điều chỉnh trừ 12 000 000 × 3 / 24 = 1 500 000 (Q-154) |
| AC-226 | Cho nhân sự bắt đầu hợp đồng ngày 15/10 / Khi tính bảng lương tháng 10 và tháng 11 / Thì tháng 10 không có phần trả trước; bảng lương tháng 11 gồm phần tháng 10 theo ngày công đã chốt và lương trả trước tháng 11 (Q-155) |
| AC-227 | Cho nhân sự đã nhận lương trả trước tháng 10 và chấm dứt hợp đồng ngày 10/10 / Khi chốt công đến ngày nghỉ và kế toán lập bảng quyết toán / Thì bảng quyết toán ghi số đã trả thừa thành khoản phải thu hồi và trình Ban Giám hiệu duyệt theo hạn mức bảng lương (Q-156, BR-90) |
| AC-228 | Cho năm học có học kỳ 1 từ 05/09/2026 đến 15/01/2027 và học kỳ 2 từ 18/01/2027 đến 25/05/2027 / Khi Hiệu trưởng lưu lịch năm học / Thì hệ thống đánh số tuần liên tục từ tuần chứa ngày 05/09/2026 đến hết năm học; lịch có học kỳ 1 kết thúc sau ngày bắt đầu học kỳ 2 bị từ chối (BR-91) |
| AC-229 | Cho một tuần được đánh dấu tuần nghỉ / Khi giáo viên mở điểm danh một ngày trong tuần đó và kế toán tính số ngày học của tháng / Thì không có bảng điểm danh và các ngày của tuần đó không tính vào số ngày học (BR-91) |
| AC-230 | Cho một ngày sau học kỳ 2 và không thuộc kỳ hè / Khi giáo viên mở điểm danh ngày đó / Thì không có bảng điểm danh (BR-91) |
| AC-231 | Cho kỳ hè có tháng 6; trẻ T1 đã đăng ký học hè tháng 6, trẻ T2 không đăng ký / Khi điểm danh và tính học phí tháng 6 / Thì chỉ T1 có trong bảng điểm danh và có hóa đơn tháng 6 (BR-92) |
| AC-232 | Cho phiếu thu cuối năm học 2026–2027 và phiếu thu đầu tiên của năm học 2027–2028 ở cùng đơn vị / Khi phát hành / Thì số phiếu của năm học mới được đánh lại từ đầu và không trùng trong năm học (BR-30) |

## 20. Chưa xác minh được

1. Mức chi tiết tiêu chí nghiệm thu mà nhà trường mong muốn: chưa có mẫu nghiệm thu của trường. Đã tìm trong: tám ảnh sơ đồ chức năng và danh sách tính năng.
2. Ngưỡng hiệu năng: dùng các chỉ số PCF-01 đến PCF-13 đã được xác nhận (GD-18).
3. Đã có câu trả lời: Eric duyệt mọi cổng; Hiệu trưởng nghiệm thu nghiệp vụ chung; kế toán trưởng nghiệm thu P05, P06, P08 (Q-32).
4. Đã có câu trả lời: cây đơn vị không giới hạn cấp (Q-124); đã thay bằng cây hai cấp ngày 09/10/2026 (QĐ-23, YCTD-38).

## 21. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-19 | Đã xác nhận ngày 09/10/2026: Mọi tiêu chí ở tài liệu này phải được chạy thử thật trước khi đánh dấu hoàn thành | Eric |
| GD-76 | Không còn hiệu lực từ ngày 09/10/2026: cây đơn vị không giới hạn cấp (Q-124) | Eric |
| Q-32 | Đã trả lời ngày 09/10/2026: Eric duyệt mọi cổng; Hiệu trưởng nghiệm thu nghiệp vụ chung; kế toán trưởng nghiệm thu P05, P06, P08 | Eric |
| Q-33 | Đã trả lời ngày 09/10/2026: chưa có mẫu riêng; nhóm phát triển soạn mẫu biên bản nghiệm thu để Eric duyệt | Eric |
| Q-34 | Đã trả lời ngày 09/10/2026: không có tiêu chí bắt buộc nào ngoài tài liệu 11 | Eric |
| Q-124 | Đã trả lời ngày 09/10/2026: cây đơn vị không giới hạn cấp (QĐ-14) | Eric |
