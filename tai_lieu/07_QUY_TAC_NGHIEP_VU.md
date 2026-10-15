# 07. QUY TẮC NGHIỆP VỤ

- Mô tả: Điều kiện, ràng buộc, công thức, trạng thái, ngoại lệ, quy tắc chuyển trạng thái.
- Phiên bản: 1.41
- Ngày cập nhật: 2026-10-15
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Quy ước

Quy tắc nghiệp vụ đánh mã `BR-xx`, đánh số tăng dần, không tái sử dụng mã đã cấp. Quy tắc có ghi chú "(chờ xác nhận)" là đề xuất, chưa được nhà trường xác nhận và phải được duyệt trước khi đưa vào mã nguồn.

## 2. Quy tắc về đơn vị, năm học và lớp

| Mã | Quy tắc |
|---|---|
| BR-01 | Đơn vị tổ chức xếp thành cây hai cấp (QĐ-23, YCTD-38): cấp 1 là Trường chính, chỉ có một đơn vị, không có đơn vị cha; cấp 2 là Phân hiệu hoặc Điểm trường, mỗi đơn vị chọn một loại và trực thuộc thẳng Trường chính. Nhãn cấp cố định, không đổi được. Mọi dữ liệu nghiệp vụ đều thuộc một đơn vị. Người được gán ở Trường chính có phạm vi toàn trường; người được gán ở đơn vị cấp 2 chỉ thấy dữ liệu của đơn vị đó. Hiệu trưởng, cán bộ quản lý cấp trên và kiểm toán viên ở phạm vi toàn trường theo quyền của từng vai trò. Quản trị nền tảng chỉ thao tác cấu hình kỹ thuật, không xem dữ liệu nghiệp vụ. Không ngừng sử dụng được đơn vị còn đơn vị con đang hoạt động |
| BR-02 | Một lớp thuộc đúng một đơn vị ở cấp 1 hoặc cấp 2 và một năm học. Cả hai cấp đều có thể có lớp. Lớp không bị xóa khi kết thúc năm học, chỉ chuyển sang trạng thái đã đóng |
| BR-03 | Một trẻ thuộc đúng một lớp tại một thời điểm. Đơn vị của trẻ là đơn vị của lớp trẻ đang học (QĐ-14). Lịch sử chuyển lớp được ghi lại, không ghi đè |
| BR-04 | Sĩ số tối đa của lớp do đơn vị quản lý lớp cấu hình. Vượt sĩ số thì hệ thống cảnh báo và yêu cầu quản lý đơn vị xác nhận. Sĩ số áp dụng là số nhỏ hơn giữa sĩ số của lớp và cấu hình sĩ số tối đa của đơn vị (YCTD-70) |
| BR-05 | Tài khoản nhân sự nghỉ việc bị khóa ngay khi hợp đồng chấm dứt, không xóa để giữ lịch sử |

## 3. Quy tắc về trẻ và phụ huynh

| Mã | Quy tắc |
|---|---|
| BR-06 | Hồ sơ trẻ chỉ được duyệt khi có tối thiểu họ tên, ngày sinh, giới tính, một người liên hệ là phụ huynh hoặc người giám hộ có số điện thoại; phải khai báo dị ứng hoặc chọn không có dị ứng trước khi trình duyệt |
| BR-07 | Trẻ nhận diện bằng số định danh cá nhân (bắt buộc, không trùng toàn trường) và mã định danh do cơ sở dữ liệu ngành của Bộ Giáo dục và Đào tạo cấp (không bắt buộc, không trùng khi có, tô đỏ khi còn trống). Hệ thống không tự sinh mã trẻ theo mẫu riêng |
| BR-08 | Một trẻ có thể có nhiều phụ huynh cùng theo dõi. Một phụ huynh có thể theo dõi nhiều trẻ |
| BR-09 | Trẻ là con của nhân sự trong trường được gắn cờ riêng để áp dụng chính sách miễn giảm |
| BR-10 | Trạng thái học tập của trẻ gồm: đang học, tạm nghỉ, thôi học, đã tốt nghiệp. Không xóa hồ sơ trẻ đã từng phát sinh học phí |
| BR-11 | Người được ủy quyền đón trẻ phải được phụ huynh khai báo trước trong hồ sơ, kèm quan hệ và số điện thoại |

## 4. Quy tắc về điểm danh và chăm sóc

| Mã | Quy tắc |
|---|---|
| BR-12 | Điểm danh một lần mỗi ngày, mỗi trẻ một bản ghi cho mỗi ngày. Sửa điểm danh sau khi đã chốt ngày phải có lý do và ghi nhật ký thao tác |
| BR-13 | Báo vắng do phụ huynh gửi hoặc giáo viên ghi nhận. Báo vắng có trước giờ học được coi là nghỉ có báo; giờ học là mục cấu hình theo đơn vị, mặc định 07:30 (YCTD-47) |
| BR-14 | Tiền ăn tính theo số ngày ăn thực tế của trẻ, lấy từ điểm danh đã chốt; không có khoản giảm trừ tiền ăn do nghỉ, vì ngày nghỉ có báo hay không báo đều không tính tiền ăn |
| BR-15 | Nhật ký của bé ghi theo ngày và theo trẻ; phụ huynh chỉ xem được nhật ký của con mình |
| BR-16 | Hệ thống không cho phép nhập điểm danh hoặc nhật ký cho trẻ không thuộc lớp mà người dùng phụ trách |

## 5. Quy tắc về học phí và giảm trừ

| Mã | Quy tắc |
|---|---|
| BR-17 | Học phí tính theo tháng dương lịch, dựa trên biểu phí dùng chung cho mọi đơn vị của trường, theo khối lớp và bản đăng ký dịch vụ của trẻ trong kỳ |
| BR-18 | Biểu phí có hiệu lực theo khoảng ngày. Mỗi phiên bản bắt đầu ngày 1 của một tháng; phiên bản đã tới ngày hiệu lực không sửa được, muốn đổi phải tạo phiên bản mới (YCTD-49). Khi biểu phí thay đổi, hóa đơn đã phát hành không bị tính lại tự động |
| BR-19 | Khoản phải thu của một trẻ trong một kỳ gồm: học phí chính khóa, tiền ăn, các dịch vụ khác đã đăng ký, phí hoạt động ngoại khóa đã đăng ký, và các khoản phát sinh. Học phí chính khóa là một loại phí trong biểu phí, mức có thể bằng không theo chính sách miễn học phí của từng năm học; khi mức bằng không thì hóa đơn không sinh dòng học phí chính khóa. Phí ngoại khóa theo tháng thu đủ mỗi kỳ mà đăng ký còn hiệu lực, không giảm trừ khi nghỉ buổi hoặc thôi giữa tháng; phí theo hoạt động thu một lần (YCTD-78) |
| BR-20 | Loại giảm trừ, cách tính và mức do nhà trường cấu hình (P05-11, Q-16), ví dụ trẻ con nhân sự, anh chị em ruột cùng học, học phí đặc biệt theo thỏa thuận, học bổng. Mỗi khoản giảm trừ phải ghi rõ căn cứ và người phê duyệt |
| BR-21 | Giảm trừ theo tỷ lệ phần trăm và giảm trừ theo số tiền cố định là hai cách áp dụng khác nhau; hệ thống lưu cả căn cứ và kết quả tính để truy xuất về sau |
| BR-22 | Tổng giảm trừ của một trẻ trong một kỳ không vượt quá tổng khoản phải thu của kỳ đó; mỗi khoản miễn giảm không vượt tổng các khoản mà loại miễn giảm áp dụng (YCTD-52). Số dư âm phải chuyển thành số dư có cho kỳ sau, không để âm trên hóa đơn |
| BR-23 | Trẻ nhập học hoặc thôi học giữa tháng: học phí chính khóa bằng học phí tháng nhân số ngày học thực tế trong tháng, chia số ngày học của tháng, làm tròn đến đồng. Số ngày học thực tế là số ngày học trong thời gian trẻ đang học, không trừ ngày vắng (YCTD-51). Số ngày học của tháng tính theo lịch năm học (BR-91): các ngày học trong tuần nằm trong học kỳ hoặc kỳ hè, trừ tuần nghỉ và ngày nghỉ lễ, cộng ngày học bù thứ bảy |
| BR-24 | Trẻ thôi học giữa tháng: quyết toán đến ngày thôi học, các khoản đã thu vượt được bù trừ vào kỳ sau hoặc hoàn lại theo quyết định của Hiệu trưởng. Phiếu chi hoàn tiền luôn do Hiệu trưởng phê duyệt, không xét hạn mức |
| BR-25 | Hóa đơn học phí đã phát hành không sửa trực tiếp. Muốn điều chỉnh phải lập phiếu điều chỉnh có lý do, người phê duyệt và liên kết tới hóa đơn gốc |
| BR-26 | Đăng ký dịch vụ theo tháng phải chốt trước ngày cấu hình của đơn vị (mặc định ngày 25 của tháng trước kỳ, YCTD-49). Sau ngày chốt hoặc khi kế toán đã chốt danh sách kỳ chỉ được đăng ký thêm các dịch vụ không bắt buộc (ví dụ STEM, Anh văn, 7 môn phối hợp); đăng ký trễ phải được Ban Giám hiệu duyệt, và Ban Giám hiệu quyết định thu 100% phí tháng hoặc thu theo số ngày thực tế. Đăng ký trễ phải ghi ngày bắt đầu học dịch vụ; thu theo số ngày thực tế thì tính từ ngày đó, kể cả ngày đó, đến cuối tháng (Q-150). Hủy dịch vụ sau ngày chốt cũng phải được Ban Giám hiệu duyệt (YCTD-50) |
| BR-27 | Bỏ ngày 09/10/2026: học thứ bảy không còn là dịch vụ thu phí; thứ bảy chỉ có lịch học bù toàn trường do Ban Giám hiệu lập (BR-84) |

## 6. Quy tắc về thu chi, quỹ và công nợ

| Mã | Quy tắc |
|---|---|
| BR-28 | Mọi khoản thu, chi đều phải có phiếu. Không ghi nhận thu chi không có phiếu |
| BR-29 | Phiếu thu và phiếu chi đã phát hành không được xóa. Sai thì lập phiếu đảo có tham chiếu tới phiếu gốc |
| BR-30 | Số phiếu thu và phiếu chi do hệ thống sinh theo quy tắc của đơn vị, không trùng trong phạm vi đơn vị và năm học, đánh lại từ đầu mỗi năm học (YCTD-30) |
| BR-31 | Một phiếu thu thanh toán cho một hoặc nhiều hóa đơn của một trẻ và phải trả đủ số còn phải nộp của từng hóa đơn được chọn; không nhận thanh toán một phần. Tổng số tiền phân bổ không vượt quá số tiền thu |
| BR-32 | Số dư công nợ của trẻ là tổng khoản phải thu trừ tổng số tiền đã phân bổ từ các phiếu thu và trừ giảm trừ đã duyệt |
| BR-33 | Công nợ quá hạn được xác định theo số ngày quá hạn so với ngày đến hạn của kỳ. Hệ thống đưa vào danh sách nhắc nợ theo mốc cấu hình. Mỗi đơn vị tự bật hoặc tắt việc chặn phụ huynh đăng ký thêm dịch vụ khi trẻ còn công nợ quá hạn; trẻ không bị chặn đi học. Mỗi hóa đơn được nhắc nợ tối đa một lần ở mỗi mốc; đề xuất và quyết định xử lý công nợ quá hạn không làm thay đổi số tiền công nợ (YCTD-82) |
| BR-34 | Số dư quỹ tiền mặt và tài khoản ngân hàng được tính từ phiếu thu, phiếu chi và các giao dịch đã ghi nhận; số dư quỹ tiền mặt không được âm, quy tắc bắt buộc và không tắt được; kiểm tra số dư tài khoản ngân hàng do đơn vị cấu hình, mặc định bật (YCTD-55). Dòng sao kê ngân hàng nhập để đối chiếu không làm thay đổi số dư tài khoản (YCTD-82) Dòng sao kê nhập từ tệp cũng không làm thay đổi số dư; tiền vào trên sao kê chưa có phiếu thu chỉ được đề xuất lập phiếu thu, kế toán xác nhận mới lập (YCTD-89) |
| BR-35 | Mọi thao tác thay đổi số liệu tài chính phải ghi nhật ký thao tác kèm người thực hiện, thời điểm và giá trị trước, giá trị sau |
| BR-36 | Báo cáo tài chính phải lọc được theo đơn vị, theo khoảng ngày, theo loại thu chi và theo người lập phiếu |

## 7. Quy tắc về nhân sự, chấm công và lương

| Mã | Quy tắc |
|---|---|
| BR-37 | Mỗi nhân sự có một hồ sơ duy nhất, gắn với một đơn vị chính. Nhân sự làm nhiều đơn vị được ghi nhận riêng |
| BR-38 | Hợp đồng lao động có thời hạn và lương thỏa thuận. Khi hợp đồng hết hạn mà chưa gia hạn, hệ thống cảnh báo trước số ngày cấu hình |
| BR-39 | Chấm công theo ngày, ghi nhận giờ vào, giờ ra, số giờ làm thực tế và trạng thái: đủ công, đi muộn, về sớm, nghỉ có lương, nghỉ không lương, nghỉ lễ |
| BR-40 | Đơn xin nghỉ phép phải được quản lý trực tiếp duyệt trước khi tính vào ngày nghỉ có lương |
| BR-41 | Số ngày phép năm của mỗi nhân sự do nhà trường cấu hình theo chức danh và thâm niên (P08-11) |
| BR-42 | Bỏ ngày 09/10/2026: nhà trường không cho ứng lương (Q-54) |
| BR-43 | Lương tháng M trả trước một lần vào đầu tháng M, không đợi chốt công của tháng M: gồm lương theo hợp đồng, phụ cấp cố định và thưởng, trừ khấu trừ cố định; cộng trừ phần điều chỉnh theo bảng công đã chốt của tháng M−1, gồm trừ ngày không hưởng lương bằng lương hợp đồng nhân số ngày không hưởng lương chia ngày công chuẩn, ngày công chuẩn là số ngày làm việc của tháng theo lịch (Q-154, YCTD-60), cộng tiền làm thêm giờ, phụ cấp và khấu trừ tính theo ngày công. Ngày không hưởng lương gồm nghỉ không lương, vắng không phép và ngày có đơn nghỉ bị từ chối hoặc đã hủy. Tháng M−1 chưa chốt công thì không tính được bảng lương tháng M. Nhân sự mới vào làm giữa tháng không được trả trước tháng đầu; phần tháng đầu trả vào đầu tháng sau theo ngày công đã chốt (Q-155). Xem YCTD-29 |
| BR-44 | Khấu trừ gồm bảo hiểm bắt buộc theo quy định, thuế thu nhập cá nhân theo biểu đang áp dụng, và các khoản khác có ghi rõ căn cứ |
| BR-45 | Bảng lương đã chốt không sửa trực tiếp. Sai thì lập bảng điều chỉnh cho kỳ sau, có lý do và người phê duyệt |
| BR-46 | Nhân sự chỉ xem được bảng lương, chấm công và đơn nghỉ của chính mình, trừ nhân sự, kế toán, kế toán trưởng, Ban Giám hiệu và kiểm toán viên trong thời hạn tài khoản |
| BR-47 | Đánh giá nhân sự theo kỳ dựa trên chỉ số do đơn vị cấu hình. Kết quả đánh giá đã công bố không sửa mà phải lập đánh giá lại có lý do. Điểm tổng thang 100 là trung bình có trọng số của tỷ lệ điểm trên điểm tối đa từng chỉ số; mỗi nhân sự mỗi kỳ chỉ một phiếu đã công bố còn hiệu lực, phiếu đánh giá lại thay thế phiếu cũ khi công bố (YCTD-81) |

## 8. Quy tắc về y tế học đường

| Mã | Quy tắc |
|---|---|
| BR-48 | Phụ huynh gửi thuốc phải khai báo tên thuốc, liều lượng, giờ cho uống, thời gian dùng, tình trạng dị ứng và gửi ít nhất một ảnh thuốc; ảnh đơn thuốc của bác sĩ không bắt buộc. Thiếu thông tin bắt buộc thì không nhận thuốc. Tình trạng dị ứng bắt buộc nhập, ghi Không nếu không dị ứng; mỗi yêu cầu dùng thuốc tối đa 30 ngày (YCTD-75) |
| BR-49 | Người nhận thuốc phải xác nhận đã nhận thuốc trước khi thuốc được đưa vào danh sách cần cho uống. Người nhận thuốc là y tế, hoặc giáo viên chủ nhiệm khi đơn vị bật cấu hình không có nhân viên y tế (BR-86) |
| BR-50 | Mỗi lần cho trẻ uống thuốc, người nhận thuốc theo BR-49 ghi nhận thời điểm và người thực hiện. Bỏ liều phải ghi lý do |
| BR-51 | Hồ sơ sức khỏe của trẻ gồm: chiều cao, cân nặng, dị ứng, bệnh nền, kết quả khám định kỳ, sự kiện y tế phát sinh tại trường, nhu cầu đặc biệt và lưu ý chăm sóc |
| BR-52 | Sự kiện y tế tại trường phải được ghi nhận ngay, thông báo cho phụ huynh, và ghi rõ ai xử lý, xử lý như thế nào |
| BR-53 | Dữ liệu sức khỏe của trẻ là dữ liệu cá nhân nhạy cảm; chỉ giáo viên chủ nhiệm, y tế, Ban Giám hiệu, quản lý đơn vị, kế toán (VT-04, không gồm kế toán trưởng, YCTD-74) và chính phụ huynh của trẻ được xem; nhu cầu đặc biệt và lưu ý chăm sóc của trẻ cũng thuộc nhóm dữ liệu này |

## 9. Quy tắc về đưa đón và bàn giao trẻ

| Mã | Quy tắc |
|---|---|
| BR-54 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| BR-55 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| BR-56 | Trẻ chỉ được bàn giao cho phụ huynh hoặc người được ủy quyền có trong hồ sơ. Trường hợp khác phải có xác nhận của phụ huynh và ghi nhật ký |
| BR-57 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |

## 10. Quy tắc về bếp, kho và tài sản

| Mã | Quy tắc |
|---|---|
| BR-58 | Suất ăn một ngày gồm ba bữa sáng, trưa, xế, thuộc bán trú. Số suất ăn mỗi ngày bằng số trẻ có mặt theo điểm danh; trẻ vắng ngày nào không tính tiền ăn ngày đó (BR-14). Bếp và kế toán dùng cùng một con số. Số suất của lớp trong ngày lấy theo điểm danh đã chốt; trước khi chốt, bếp dùng báo cơm của giáo viên chủ nhiệm hoặc số trẻ có mặt đã lưu làm số tạm; báo cáo ăn và bếp đối chiếu số suất đã lưu với điểm danh đã chốt (YCTD-76) |
| BR-59 | Thực đơn theo tuần phải được duyệt trước khi công bố cho phụ huynh |
| BR-60 | Định lượng nguyên liệu tính từ thực đơn và số suất. Chênh lệch giữa định lượng và thực xuất phải được ghi nhận |
| BR-61 | Tài sản của trường được gán cho đơn vị, phòng hoặc lớp. Mượn, trả, hỏng, mất đều phải có phiếu và người xác nhận. Chỉ tài sản đang trong kho mới cấp phát hoặc cho mượn được; hỏng hoặc mất do Ban Giám hiệu của đơn vị duyệt xử lý (YCTD-77) |
| BR-62 | Tồn kho tính từ phiếu nhập, phiếu xuất, tồn ban đầu, phiếu chuyển năm và phiếu điều chỉnh kiểm kê đã duyệt. Không cho xuất quá số lượng tồn. Tồn ban đầu chỉ nhập cho mặt hàng chưa có giao dịch và khóa ngay khi ghi. Kiểm kê có chênh lệch chỉ điều chỉnh tồn sau khi kế toán trưởng duyệt (YCTD-77) |
| BR-63 | Đề nghị mua hàng phải được duyệt theo hạn mức cấu hình trước khi lập phiếu mua hàng. Dưới hạn mức thì Phó Hiệu trưởng của đơn vị hoặc Hiệu trưởng duyệt; từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức thì Hiệu trưởng duyệt; người lập không tự duyệt. Mỗi đề nghị đã duyệt lập một phiếu mua hàng (YCTD-77) |

## 11. Quy tắc về nội dung và tương tác

| Mã | Quy tắc |
|---|---|
| BR-64 | Hoạt động do giáo viên tạo phải ở trạng thái chờ duyệt. Chỉ hoạt động đã duyệt mới hiển thị cho phụ huynh. Giáo viên có thể lưu nháp để thêm hình rồi gửi duyệt. Hoạt động đã công bố không sửa được; quản lý đơn vị hoặc Ban Giám hiệu ẩn kèm lý do và công bố lại (Q-72, YCTD-78) |
| BR-65 | Hình ảnh của trẻ chỉ được công bố khi phụ huynh đã đồng ý cho sử dụng hình ảnh. Phụ huynh đồng ý bằng xác nhận trên ứng dụng hoặc bằng giấy ký tay được nhà trường tải bản chụp lên; hệ thống lưu cách đồng ý, người đồng ý và thời điểm. Phụ huynh rút lại đồng ý bất cứ lúc nào. Giáo viên gắn thẻ trẻ có trong ảnh; ảnh có trẻ chưa đồng ý không hiển thị cho phụ huynh. Khi phụ huynh rút đồng ý, mọi ảnh đã công bố có gắn thẻ trẻ đó tự ẩn, tệp không bị xóa (YCTD-78). Khi đăng lên Fanpage, hình có bất kỳ trẻ được gắn thẻ chưa đồng ý bị loại khỏi bài đăng; chỉ nội dung đang công bố và tin tức phạm vi toàn trường hoặc đơn vị được đăng (YCTD-90) |
| BR-66 | Không bình luận nào bị xóa, kể cả của phụ huynh. Phản hồi tiêu cực được chuyển cho quản lý đơn vị xử lý riêng; quản lý đơn vị được ẩn bình luận vi phạm kèm lý do; bình luận ẩn vẫn được lưu. Người xem báo bình luận tiêu cực; mỗi lần xử lý (ẩn, hiện lại, ghi chú) có một bản ghi xử lý kèm lý do và người xử lý (YCTD-78, YCTD-79) |
| BR-67 | Mỗi tài khoản chỉ được bỏ một phiếu cho mỗi bình chọn, biểu quyết hoặc khảo sát. Sau khi gửi, phiếu không sửa được |
| BR-68 | Bình chọn, biểu quyết, khảo sát có thời gian bắt đầu và kết thúc. Ngoài khoảng thời gian đó hệ thống không nhận phiếu |
| BR-69 | Tin tức, thư viện và thông báo có phạm vi công bố: toàn trường, theo đơn vị, theo lớp hoặc theo từng trẻ. Tin tuyển dụng và tin tuyển sinh đã công bố có phạm vi công khai: người ngoài trường xem được và nộp hồ sơ không cần tài khoản đến hết hạn (YCTD-86, YCTD-87) |
| BR-70 | Thông báo quan trọng phải ghi nhận ai đã đọc, ai chưa đọc, để nhà trường biết chắc phụ huynh đã nhận |

## 12. Quy tắc về phân quyền và dữ liệu

| Mã | Quy tắc |
|---|---|
| BR-71 | Quyền do máy chủ quyết định tại mọi yêu cầu. Ẩn hoặc vô hiệu hóa nút trên giao diện chỉ là tiện dụng, không được coi là bảo mật |
| BR-72 | Quyền được kiểm tra theo ba lớp: vai trò, phạm vi đơn vị, phạm vi bản ghi. Ví dụ phụ huynh chỉ truy cập được bản ghi của con mình |
| BR-73 | Mọi thao tác đọc dữ liệu cá nhân của trẻ và dữ liệu tài chính phải ghi nhật ký truy cập khi đơn vị bật chế độ này. Hai trường hợp luôn ghi nhật ký, không tắt được: đối tác đọc dữ liệu cá nhân qua API (BM-66) và xem đầy đủ số định danh cá nhân (BR-81) |
| BR-74 | Dữ liệu cá nhân của trẻ và phụ huynh không được xuất ra ngoài hệ thống nếu không có quyền xuất dữ liệu và không ghi nhật ký xuất. Người xuất phải có cả quyền xuất dữ liệu và quyền xem báo cáo trong phạm vi đơn vị; mỗi lần xuất ghi người xuất, báo cáo, bộ lọc, đơn vị, số dòng và có dữ liệu cá nhân hay không; tệp xuất không lưu lại trên hệ thống (YCTD-83) |
| BR-75 | Không xóa cứng dữ liệu nghiệp vụ đã phát sinh. Dữ liệu không dùng nữa chuyển sang trạng thái ngừng sử dụng |
| BR-76 | Sao lưu dữ liệu theo lịch cấu hình; phải kiểm tra khả năng phục hồi định kỳ, không chỉ kiểm tra bản sao lưu tồn tại |

### 12.1 Quy tắc về phân cấp phê duyệt

Bổ sung ngày 2026-10-09 theo yêu cầu tách vai trò Ban Giám hiệu thành Hiệu trưởng và Phó Hiệu trưởng kèm hạn mức phê duyệt.

| Mã | Quy tắc |
|---|---|
| BR-77 | Hạn mức phê duyệt được cấu hình theo đơn vị và theo loại chứng từ. Phó Hiệu trưởng phê duyệt chứng từ có giá trị dưới hạn mức; Hiệu trưởng phê duyệt chứng từ có giá trị bằng hoặc trên hạn mức. Loại chứng từ chưa cấu hình hạn mức thì Hiệu trưởng phê duyệt (Q-112). Phiếu chi hoàn tiền khi trẻ thôi học là ngoại lệ, luôn do Hiệu trưởng phê duyệt (BR-24) |
| BR-78 | Người lập chứng từ không được tự phê duyệt chứng từ do chính mình lập. Trường hợp đặc biệt phải do Hiệu trưởng phê duyệt và ghi rõ lý do |
| BR-79 | Phó Hiệu trưởng chỉ phê duyệt trong phạm vi đơn vị được gán. Hiệu trưởng phê duyệt trong phạm vi toàn trường |
| BR-80 | Mọi lần phê duyệt hoặc từ chối đều ghi nhật ký thao tác kèm người phê duyệt, thời điểm, giá trị chứng từ và lý do từ chối nếu có; áp dụng cả cho đề nghị tuyển dụng (giá trị là vị trí và số lượng) và quyết định tuyển ứng viên (YCTD-87) |
| BR-81 | Số định danh cá nhân và bản chụp giấy khai sinh của trẻ bắt buộc khi tạo hồ sơ; trẻ nhập từ dữ liệu ban đầu được bổ sung giấy khai sinh sau (YCTD-46); chỉ hiển thị đầy đủ với Hiệu trưởng, Phó Hiệu trưởng, quản lý đơn vị và nhân viên tuyển sinh; vai trò khác thấy số đã che; mỗi lần xem đầy đủ ghi nhật ký truy cập dữ liệu nhạy cảm |
| BR-82 | Giờ làm thêm tính từ chấm công, là phần vượt giờ làm chuẩn trong ngày, tối đa 1 giờ mỗi ngày; tiền làm thêm bằng số giờ nhân lương giờ (lương hợp đồng chia ngày công chuẩn chia giờ làm chuẩn) nhân hệ số cấu hình của đơn vị (YCTD-60), đưa vào bảng lương của tháng kế tiếp (BR-43). Không có phụ cấp dạy thay |
| BR-83 | Bán trú là dịch vụ bắt buộc với mọi trẻ đang học; phụ huynh không bỏ chọn được. Bán trú gồm ba bữa sáng, trưa, xế; không có dịch vụ ăn sáng hay ăn tối riêng. Tiệc buffet tổ chức theo dịp, nằm trong tiền ăn, không thu riêng |
| BR-84 | Thứ bảy mặc định nghỉ; Ban Giám hiệu bổ sung từng ngày học bù thứ bảy và ngày nghỉ bù (thứ hai đến thứ sáu, nhân sự nghỉ có lương) vào lịch chung toàn trường (YCTD-59). Ngày học bù là ngày học bình thường của mọi lớp: có điểm danh, tính vào số ngày học của tháng theo BR-23, tiền ăn tính theo BR-14, không thu phí riêng; với nhân sự là ngày làm việc |
| BR-85 | Mỗi trẻ mỗi kỳ có một hóa đơn chính. Khoản phát sinh sau khi hóa đơn chính đã phát hành, gồm đăng ký trễ được Ban Giám hiệu duyệt và phí hoạt động ngoại khóa thu theo từng hoạt động, được lập thành hóa đơn bổ sung cùng kỳ; hóa đơn chính không bị sửa |
| BR-86 | Mỗi đơn vị có cấu hình "không có nhân viên y tế". Khi bật, yêu cầu dặn thuốc của trẻ thuộc đơn vị đó chuyển cho giáo viên chủ nhiệm của lớp; giáo viên chủ nhiệm nhận thuốc, cho uống và ghi liều như y tế; y tế được gán ở đơn vị cấp trên vẫn xem được. Khi tắt, giáo viên chủ nhiệm không nhận thuốc và không ghi liều (YCTD-25) |
| BR-87 | Giáo viên chủ nhiệm và y tế ghi nhận chăm sóc hằng ngày của trẻ: nhiệt độ, tình trạng khi trẻ ốm, chăm sóc đặc biệt theo lưu ý của phụ huynh; phụ huynh của trẻ xem được trên ứng dụng (YCTD-25) |
| BR-88 | Phụ huynh xác nhận đã biết với thông báo sự kiện y tế và thông báo bỏ liều; hệ thống chỉ hiển thị trạng thái đã hoặc chưa xác nhận cho y tế và giáo viên chủ nhiệm, không nhắc lại (YCTD-25) |
| BR-89 | Không mở được năm học mới khi năm học đang dùng còn trẻ đã thôi học hoặc đã ra trường có công nợ chưa tất toán; kế toán phải thu hết hoặc xử lý bằng miễn giảm, điều chỉnh hóa đơn trước. Công nợ của trẻ đã thôi học không chuyển sang năm mới; công nợ và số dư có của trẻ được chuyển sang được bù trừ thành một hóa đơn công nợ đầu kỳ hoặc một phiếu ghi số dư có (Q-149, YCTD-37, YCTD-69) |
| BR-90 | Khi chấm dứt hợp đồng, nhân sự chốt công đến ngày nghỉ và kế toán lập bảng quyết toán cuối cùng: còn thiếu thì trả thêm, đã trả thừa thì ghi khoản phải thu hồi và thu bằng phiếu thu không gắn trẻ, khoản mục thu hồi lương; bảng quyết toán do Ban Giám hiệu duyệt theo hạn mức bảng lương (Q-156, YCTD-29) |
| BR-91 | Hiệu trưởng lập một lịch năm học chung toàn trường khi tạo năm học: học kỳ 1 và học kỳ 2 có ngày bắt đầu, ngày kết thúc, học kỳ 1 kết thúc trước khi học kỳ 2 bắt đầu; kỳ hè không bắt buộc, nằm sau học kỳ 2; ngày học trong tuần, mặc định thứ hai đến thứ sáu. Hệ thống tự đánh số tuần từ tuần chứa ngày bắt đầu học kỳ 1 đến hết năm học; Hiệu trưởng đánh dấu tuần nghỉ. Lịch sửa được cho tới khi năm học đóng; sửa ngày thì hệ thống đánh số lại tuần và giữ cờ nghỉ của tuần có cùng ngày bắt đầu (YCTD-37). Ngày ngoài học kỳ và kỳ hè, ngày thuộc tuần nghỉ không điểm danh và không tính vào số ngày học (YCTD-30) |
| BR-92 | Kỳ hè thuộc năm học đó. Trẻ học hè phải được đăng ký theo từng tháng hè; trẻ đã đăng ký thì điểm danh và tính học phí như tháng thường theo biểu phí hiện hành, trẻ không đăng ký thì không có trong bảng điểm danh và không có hóa đơn của tháng hè đó (YCTD-30) |
| BR-93 | Mỗi thời điểm chỉ có một năm học đang dùng. Mở năm học mới là một thao tác: kiểm tra BR-89, tạo cơ sở dữ liệu năm mới, chuyển dữ liệu dùng chung, chuyển năm đang dùng sang đã đóng và cơ sở dữ liệu của năm đó sang chỉ đọc. Năm học đầu tiên của hệ thống mở mà không có năm trước (YCTD-37) |
| BR-94 | Không mở được năm học mới khi năm học đang dùng còn miễn giảm, điều chỉnh hóa đơn, phiếu đảo phiếu thu, phiếu chi hoặc phiếu đảo phiếu chi chờ duyệt, vì năm cũ chuyển sang chỉ đọc (YCTD-69) |
| BR-95 | Kỳ tài chính là tháng dương lịch của từng đơn vị, chỉ đề nghị chốt khi tháng đã kết thúc. Khi Hiệu trưởng đã duyệt chốt kỳ, không lập, phát hành, đảo hay duyệt đảo chứng từ thu chi có ngày thuộc kỳ, không tính lại, phát hành, miễn giảm hay điều chỉnh hóa đơn của kỳ; sai sót của kỳ đã chốt được sửa bằng chứng từ của kỳ đang mở (YCTD-82) Không ghi hoặc hủy bút toán thủ công có ngày thuộc kỳ đã chốt; bút toán tự động của chứng từ thuộc kỳ vẫn được ghi sổ vì chứng từ đã phát hành, duyệt trước khi chốt (YCTD-88) |
| BR-96 | Mỗi bút toán phải cân: tổng Nợ bằng tổng Có, mỗi dòng ghi một phía với số tiền dương. Bút toán đã ghi sổ không sửa, không xóa; bút toán thủ công sai thì hủy kèm lý do rồi ghi lại, bút toán tự động sai thì sửa chứng từ gốc bằng phiếu đảo hoặc phiếu điều chỉnh. Mỗi chứng từ ghi sổ tự động đúng một lần cho mỗi đơn vị theo quy tắc ghi sổ đang dùng tại lúc ghi (YCTD-88) |
| BR-97 | Hoàn thành chương trình giáo dục mầm non chỉ ghi cho lớp có bậc học bắt đầu từ 60 tháng tuổi (mẫu giáo 5-6 tuổi) và cho trẻ đang học ở lớp hiện tại; mỗi trẻ một kết quả mỗi năm học (Hoàn thành hoặc Chưa hoàn thành, ghi chú tối đa 500 ký tự), ghi lại thì thay kết quả cũ. Ban Giám hiệu chỉ xác nhận danh sách của lớp khi lớp có ít nhất một trẻ và mọi trẻ đang học đã có kết quả; danh sách đã xác nhận bị khóa, không ghi sửa được; hủy xác nhận bắt buộc lý do và ghi nhật ký thao tác, sau đó sửa và xác nhận lại (YCTD-104) |
| BR-98 | Mỗi nhân sự có một phiếu đánh giá chuẩn nghề nghiệp mỗi năm học; loại chuẩn (giáo viên mầm non hoặc hiệu trưởng, chuẩn hiệu trưởng dùng cho Hiệu trưởng, Phó Hiệu trưởng, quản lý đơn vị) chọn lúc mở; phiếu giữ danh mục tiêu chí lúc mở, sửa danh mục chỉ áp cho phiếu mở sau. Nhân sự chỉ gửi tự đánh giá khi mọi tiêu chí có mức, đã gửi thì không tự sửa; người đánh giá chỉ chốt khi mọi tiêu chí có mức của mình, mức cuối của tiêu chí là mức của người đánh giá; phiếu đã chốt không sửa. Phiếu chuẩn giáo viên do người có quyền đánh giá trong phạm vi đơn vị chính của nhân sự; phiếu chuẩn hiệu trưởng chỉ Hiệu trưởng. Không ai mở, đánh giá hay chốt phiếu của chính mình (YCTD-104) |
| BR-99 | Xếp loại chung của phiếu chuẩn nghề nghiệp khi chốt: Chưa đạt khi có tiêu chí Chưa đạt; Tốt khi mọi tiêu chí từ Khá trở lên, ít nhất 2/3 số tiêu chí đạt Tốt và mọi tiêu chí trọng yếu đạt Tốt; Khá khi mọi tiêu chí từ Đạt trở lên, ít nhất 2/3 số tiêu chí từ Khá trở lên và mọi tiêu chí trọng yếu từ Khá trở lên; còn lại là Đạt. "Ít nhất 2/3" so sánh số nguyên: số tiêu chí đạt mức × 3 ≥ tổng số tiêu chí × 2. Tiêu chí trọng yếu là tiêu chí đánh dấu trên danh mục, mặc định các tiêu chí của tiêu chuẩn 1 và 2. Quy tắc theo cách xếp loại của Thông tư 26/2018/TT-BGDĐT và Thông tư 25/2018/TT-BGDĐT, cần đối chiếu văn bản (YCTD-104) |
| BR-100 | Đợt cân đo thuộc một đơn vị, tên duy nhất trong đơn vị, ngày cân đo không sau hôm nay; đợt đã có số đo thì không xóa. Mỗi học sinh có tối đa một số đo trong một đợt, lưu trong bảng số đo sức khỏe; chỉ ghi cho học sinh thuộc đơn vị của đợt, đang học trong lớp vào ngày cân đo và sinh không sau ngày cân đo; cân nặng 1 đến 150 kg, chiều cao 30 đến 200 cm; để trống cả hai số là xóa số đo của học sinh trong đợt. Nhập từ Excel kiểm tra cả tệp trước, có dòng lỗi thì không lưu dòng nào. Mở năm học mới thì số đo chuyển sang năm mới không kèm đợt (YCTD-105) |
| BR-101 | Chỉ số Z cân nặng theo tuổi, chiều cao theo tuổi, cân nặng theo chiều cao và BMI theo tuổi tính theo chuẩn WHO 2006 (0 đến 60 tháng) và tham chiếu WHO 2007 (61 đến 84 tháng), tháng tuổi tròn bằng số ngày tuổi chia 30,4375, không tính trên 84 tháng; không lưu, tính lại mỗi lần đọc. Kênh tăng trưởng: cân nặng theo tuổi dưới −2SD là suy dinh dưỡng thể nhẹ cân, trên +2SD là cân nặng cao hơn tuổi; chiều cao theo tuổi dưới −2SD là suy dinh dưỡng thể thấp còi; dưới 61 tháng, cân nặng theo chiều cao dưới −2SD là suy dinh dưỡng thể gầy còm, trên +2SD là thừa cân, trên +3SD là béo phì; từ 61 tháng dùng BMI theo tuổi: dưới −2SD gầy còm, trên +1SD thừa cân, trên +2SD béo phì. Học sinh bình thường cả ba kênh khi đủ ba kênh và không kênh nào bất thường. Tỷ lệ kênh trong tổng hợp tính trên số học sinh có chỉ số tương ứng (YCTD-105) |
| BR-102 | Thiết bị dạy học: danh mục dùng chung toàn trường, chỉ người có quyền quản lý thiết bị ở phạm vi toàn trường thêm, sửa, ngừng thiết bị; thiết bị ngừng dùng không ghi số lượng, không gắn tài sản; tài sản đã thanh lý không gắn được. Nhóm tuổi của lớp lấy theo tháng tuổi giữa khoảng của bậc học; lớp có bậc học không có trong danh mục không tính định mức. Định mức = số lượng một nhóm, lớp × số nhóm, lớp đang hoạt động cùng nhóm tuổi; thiết bị tính theo học sinh thì = số lượng × sĩ số (học sinh đang học, lớp hiện tại) của từng lớp, làm tròn lên từng lớp. Hiện có = số nhập tay (theo đơn vị hoặc theo lớp, ghi lại thì thay số cũ) + số tài sản gắn còn dùng được (trong kho, đã cấp phát, đang cho mượn; tài sản cấp phát cho lớp tính vào lớp). Thừa = phần hiện có vượt định mức; thiếu = phần định mức chưa có; tỷ lệ đáp ứng = min(hiện có, định mức) / định mức, tối đa 100%, một chữ số thập phân, tính trên thiết bị tối thiểu. Nhu cầu bổ sung năm sau chỉ nhập ở dòng của đơn vị; không nhập thì bằng số thiếu. Thiết bị ngoài danh mục không có định mức. Mở năm học mới chuyển danh mục (giữ mã định danh) và số hiện có theo đơn vị (số theo lớp cộng vào dòng của đơn vị, nhu cầu để trống) (YCTD-106) |
| BR-103 | Hồ sơ trường: một hồ sơ mỗi năm học, gắn với Trường chính, chỉ ghi khi có quyền ở phạm vi toàn trường; danh sách trường của sáu thẻ cố định, trường lạ, sai kiểu, giá trị chọn ngoài danh sách, chữ quá 500 ký tự bị từ chối; thẻ gửi lên thay toàn bộ nội dung thẻ, thẻ không gửi giữ nguyên; không lưu mật khẩu tài khoản văn phòng điện tử; mỗi lần ghi ghi nhật ký thao tác; mở năm học mới chuyển hồ sơ sang năm mới. Khai báo cơ sở vật chất: khối phòng, loại phòng, hiện trạng, diện tích, thuộc tính của phòng không bắt buộc; loại phòng phải thuộc khối phòng (khi sửa chỉ một trong hai thì so với giá trị đang lưu); thuộc tính chỉ nhận khóa cố định (YCTD-106) |
| BR-104 | Báo cáo EMIS đầu năm tính tại thời điểm xem từ dữ liệu của năm học đang dùng, không lưu số đã nộp, không gửi lên Sở; chỉ xem ở phạm vi toàn trường. Cả số của trường vào cột theo loại hình trong hồ sơ trường, hai cột loại hình còn lại là 0; chưa khai báo loại hình thì ba cột để trống và cảnh báo. Học sinh tính trạng thái đang học, nhà trẻ hay mẫu giáo theo nhóm tuổi của lớp hiện tại (chưa có lớp thì theo tuổi), tuổi = năm bắt đầu năm học − năm sinh; nhân sự tính người đang làm việc, phân loại theo nhóm chức vụ của tệp CSDL ngành, không có thì theo tên chức danh; phòng tính phòng đang dùng; dân tộc thiểu số là có ghi dân tộc và không phải dân tộc Kinh. Mã số chỉ tiêu do hệ thống đặt, cần đối chiếu danh mục chỉ tiêu EMIS chính thức (YCTD-106) |
| BR-105 | Điện thoại nhận tin của học sinh (YCTD-108): mỗi học sinh có tối đa một phụ huynh nhận tin, chọn trong các phụ huynh gắn với học sinh và đã có số điện thoại; phụ huynh không gắn với học sinh hoặc chưa có số thì không chọn được; bỏ chọn được. Tin nhắn SMS, Zalo gửi theo từng học sinh (học phí, phiếu thu, nhắc nợ, sự kiện y tế nặng, vắng không báo khi chốt điểm danh) chỉ đi tới phụ huynh nhận tin khi phụ huynh đó có tài khoản; chưa chọn, hoặc phụ huynh được chọn chưa có tài khoản, thì gửi mọi phụ huynh có tài khoản. Thông báo trong ứng dụng và tin nhắn không gắn với một học sinh không theo quy tắc này. Lựa chọn chuyển sang năm học mới cùng dòng gắn phụ huynh |
| BR-106 | Học 2 buổi/ngày, học sinh lớp bán trú (YCTD-108) là hai thông tin có hoặc không của hồ sơ học sinh, không phải thông tin định danh nên sửa không cần lý do; nhập lại tệp CSDL ngành thì cập nhật theo tệp. Cập nhật hàng loạt nhận 1 đến 500 học sinh và ít nhất một thông tin; người cập nhật cần quyền như sửa hồ sơ (hồ sơ nháp cần quyền lập hồ sơ, hồ sơ khác cần quyền duyệt ở đơn vị của học sinh); có học sinh chờ duyệt hoặc học sinh không được sửa thì không cập nhật học sinh nào; mỗi học sinh được cập nhật ghi một dòng nhật ký thao tác |
| BR-107 | Danh sách học sinh theo Sở (YCTD-108) xếp A–Z theo tên (từ cuối của họ tên) rồi theo cả họ tên, so theo thứ tự chữ cái tiếng Việt; tệp Excel theo cùng thứ tự và chỉ có các cột người xuất đang hiện. Xuất danh sách học sinh tối đa 10 000 dòng một lần, theo BR-74. Dân tộc, diện chính sách, khuyết tật, biết bơi chỉ hiện và lọc được với người xem được dữ liệu sức khỏe (BR-53). Biến động học sinh dựng từ lịch sử đã có của năm học (ngày nhập học, lịch sử lớp, chuyển đơn vị, thôi học), không ghi riêng; dòng lớp mới do chuyển đơn vị không tính là chuyển lớp |
| BR-108 | Ý kiến phản hồi gửi từ chân trang cổng quản trị (YCTD-110): mọi tài khoản đăng nhập được gửi, không cần quyền riêng; loại ý kiến là Góp ý, Báo lỗi hoặc Đề nghị; tiêu đề 1 đến 200 ký tự, nội dung 1 đến 5000 ký tự bắt buộc; đường dẫn trang bắt đầu bằng `/`, tối đa 500 ký tự; số điện thoại 9 đến 15 chữ số, thư điện tử đúng định dạng, không bắt buộc; tối đa một ảnh JPEG hoặc PNG đến 5 MB, nhận diện theo các byte đầu của tệp. Mỗi tài khoản gửi tối đa 10 ý kiến trong 60 phút liền trước; quá thì từ chối `ERR_RATE_LIMIT` mã YCTD-110 kèm số giây phải chờ; đếm trong giao dịch có khóa theo tài khoản. Ý kiến ghi tên người gửi và đơn vị của vai trò đầu tiên gán theo đơn vị lúc gửi. Người gửi chỉ xem ý kiến và ảnh của mình; người có quyền xử lý xem mọi ý kiến; ý kiến không bị xóa |
| BR-109 | Xử lý ý kiến phản hồi (YCTD-110): người có quyền `P01.feedback.manage` chọn trạng thái Mới, Đang xử lý hoặc Đã xử lý và ghi câu trả lời (tối đa 5000 ký tự), mỗi lần ghi phải có trạng thái hoặc câu trả lời. Câu trả lời mới hoặc khác câu cũ thì ghi người trả lời, thời điểm trả lời và gửi một thông báo trong ứng dụng cho người gửi khi có năm học đang dùng; lưu lại đúng câu cũ không báo lại; xóa trắng câu trả lời thì bỏ người và thời điểm trả lời |
| BR-110 | Hết hạn mật khẩu (YCTD-110): số ngày hết hạn mật khẩu từ 0 đến 3650 (mặc định 0 là không giới hạn), số ngày báo trước từ 0 đến 90 (mặc định 7), chung toàn trường, do người có `P01.account.manage` sửa. Hạn tính từ thời điểm đặt mật khẩu gần nhất (đổi mật khẩu hoặc được đặt lại mật khẩu tạm; tài khoản có trước YCTD-110 tính từ thời điểm cập nhật gần nhất). Chỉ áp cho tài khoản có ít nhất một vai trò khác VT-14, đăng nhập hoặc làm mới phiên bằng mật khẩu; tài khoản chỉ có VT-14, tài khoản còn dùng mật khẩu mặc định chung và phiên bằng mã một lần không hết hạn. Quá hạn thì phiên chỉ được đổi mật khẩu (như BM-07), mật khẩu mới phải khác mật khẩu hiện tại; còn từ số ngày báo trước trở xuống thì báo số ngày còn lại, chưa bắt buộc đổi |
| BR-111 | Phân hiệu, điểm trường (YCTD-111) có thêm khoảng cách đến cơ sở chính (km, 0 đến 999 999) và diện tích (m², 0 đến 9 999 999 999), là số không âm, tối đa hai chữ số thập phân, không bắt buộc. Trường chính là cơ sở chính nên không có khoảng cách đến cơ sở chính; nhập cho Trường chính thì từ chối mã YCTD-111. Phân hiệu, điểm trường không bị xóa, chỉ ngừng sử dụng và dùng lại theo BR-01 |
| BR-112 | Thông tin lớp theo Sở (YCTD-111). Nhóm tuổi của lớp là một trong 3–12 tháng, 13–24 tháng, 25–36 tháng, 3–4 tuổi, 4–5 tuổi, 5–6 tuổi; bỏ trống thì theo khối, tính từ tháng tuổi bắt đầu của bậc học như thống kê (dưới 12 tháng là 3–12 tháng, dưới 24 là 13–24 tháng, dưới 36 là 25–36 tháng, dưới 48 là 3–4 tuổi, dưới 60 là 4–5 tuổi, còn lại 5–6 tuổi). Ba nhóm dưới 36 tháng là nhóm lớp "Nhóm trẻ", ba nhóm còn lại là "Lớp mẫu giáo". Chỉ lớp mẫu giáo (theo nhóm tuổi đang áp dụng) mới ghép 2 hoặc 3 độ tuổi; đổi khối, nhóm tuổi cũng kiểm tra lại. Lớp ghép chỉ ghép vào một lớp khác đang dùng của cùng đơn vị; không ghép vào chính nó; không ghép nối tiếp (lớp đã ghép vào lớp khác không nhận lớp ghép vào, lớp đã có lớp ghép vào thì không ghép vào lớp khác); bỏ đánh dấu lớp ghép thì bỏ lớp được ghép vào. Vi phạm trả mã YCTD-111. Thứ tự là số nguyên 0 đến 9999, danh sách lớp xếp theo thứ tự (lớp chưa có thứ tự ở cuối) rồi theo mã lớp. Lớp giải thể là lớp đã đóng theo BR-02. Mở năm học mới chép các thông tin này cùng lớp; lớp ghép vào một lớp không chép sang thì bỏ lớp được ghép vào |
| BR-113 | Danh sách lớp và phân công phụ trách lớp (YCTD-111). Xuất Excel danh sách lớp theo bộ lọc đang chọn, có cột STT và các cột đang hiện trên lưới theo thứ tự đang hiện (không chọn thì 13 cột mặc định), tối đa 10 000 dòng một lần (quá thì từ chối mã YCTD-111), ghi nhật ký xuất có dữ liệu cá nhân vì có tên giáo viên (BR-74). Phân công phụ trách lớp là các phân công giáo viên còn hiệu lực của lớp đang dùng trong phạm vi xem lớp, không thêm bảng; xếp theo tên giáo viên rồi tên lớp; xuất Excel bảy cột, ghi nhật ký xuất theo BR-74 |
| BR-114 | Danh sách và hồ sơ cán bộ, giáo viên theo Sở (YCTD-112). Lưới và tệp Excel chỉ có nhân sự trong phạm vi `P07.staff.view`, xếp A–Z theo tên (từ cuối của họ tên) rồi theo họ tên, thứ tự chữ cái tiếng Việt. Lọc tuổi theo tuổi tròn tính đến hôm nay theo ngày sinh, từ 0 đến 100, tuổi từ không lớn hơn tuổi đến; hồ sơ chưa có ngày sinh không khớp. Lọc số định danh phải đủ mười hai số và so đủ số. Vị trí việc làm trống thì lấy chức danh của trường; hình thức hợp đồng trống thì lấy loại hợp đồng còn hiệu lực, chỉ với nhân sự trong phạm vi `P07.contract.view` của người xem; số hợp đồng, hạn hợp đồng, lương thỏa thuận để trống với nhân sự ngoài phạm vi đó (BR-46). Xuất Excel có cột STT và các cột đang hiện theo thứ tự đang hiện (không chọn thì 12 cột mặc định), tối đa 10 000 dòng (quá thì từ chối mã YCTD-112), ghi nhật ký xuất có dữ liệu cá nhân (BR-74), nhật ký không ghi số định danh đã nhập ở bộ lọc. Ghi hồ sơ chỉ đổi các ô gửi lên; ô của Sở chưa có cột riêng lưu ở `moet_profile` đúng khóa của tệp CSDL ngành; bỏ đánh dấu hoặc xóa chữ là xóa ô; số sổ BHXH lưu mã hóa kèm bốn số cuối, chỉ hiện số đã che. Mỗi lần ghi một dòng nhật ký thao tác có giá trị trước và sau; số sổ BHXH ghi "đã đổi", số định danh chỉ ghi bốn số cuối. Nhập lại tệp CSDL ngành thay toàn bộ `moet_profile` như trước |
| BR-115 | Cập nhật địa danh hành chính (YCTD-116). Danh mục địa danh dùng chung mọi năm học: đơn vị cũ (tỉnh, quận/huyện, xã trước sắp xếp năm 2025), đơn vị mới (tỉnh, xã), bảng đối chiếu đơn vị cũ sang xã mới; gieo sẵn Thành phố Hồ Chí Minh theo Nghị quyết 1685/NQ-UBTVQH15 và mã số của Cục Thống kê, tỉnh khác nhập từ Excel. Tên so khớp bỏ tiền tố loại đơn vị, dấu câu, hoa thường, số 0 đầu, không phân biệt hai kiểu đặt dấu thanh, giữ dấu. Một địa chỉ (tỉnh, quận/huyện cũ, xã của một trong năm loại địa chỉ trong `moet_profile`) còn theo địa danh cũ khi còn ghi quận/huyện, khi tỉnh chỉ có ở danh mục cũ, hoặc khi xã không có trong danh sách xã mới của tỉnh; tỉnh ngoài danh mục mà không ghi quận/huyện thì không xét. Đề xuất theo bảng đối chiếu của xã cũ (tìm theo tỉnh, quận/huyện; thiếu quận/huyện thì chỉ nhận khi tên xã không trùng trong tỉnh); huyện không có cấp xã đối chiếu theo huyện; địa chỉ đã theo tên xã mới mà còn ghi quận/huyện thì đề xuất chính xã đó. Chuyển: chỉ địa chỉ còn theo địa danh cũ có đúng một xã mới, hoặc người dùng chọn một xã mới trong các xã đối chiếu; ghi tỉnh, xã theo tên mới, bỏ quận/huyện cũ, giữ tổ/thôn/xóm. Quyền như cập nhật hàng loạt (hồ sơ nháp cần `P02.child.manage`, hồ sơ khác cần `P02.approve` ở đơn vị, hồ sơ chờ duyệt không chuyển); có một địa chỉ không chuyển được thì không chuyển địa chỉ nào (`ERR_RULE_VIOLATION` mã YCTD-116, nêu từng địa chỉ). Nhập bảng đối chiếu: đơn vị chưa có thì thêm, dòng đã có bỏ qua, mã khác danh mục hoặc đã dùng là dòng lỗi, có dòng lỗi thì không ghi dòng nào. Ghi nhật ký thao tác có giá trị trước và sau |

Danh mục chứng từ áp dụng hạn mức: phiếu chi, phiếu đảo phiếu thu (YCTD-23), phiếu đảo phiếu chi (YCTD-24), đề nghị mua hàng, phiếu điều chỉnh hóa đơn, miễn giảm học phí, bảng lương kỳ, chốt kỳ tài chính. Mức hạn mức cụ thể chưa có, xem Q-22 và Q-112.

Chỉ Ban Giám hiệu phê duyệt chứng từ thuộc danh mục trên theo BR-77; kế toán, kế toán trưởng và quản lý đơn vị không phê duyệt, quyết định ngày 2026-10-09. Chốt kỳ tài chính không có giá trị tiền nên do kế toán trưởng đề nghị và luôn do Hiệu trưởng phê duyệt (Q-133).

## 13. Quy tắc chuyển trạng thái

| Đối tượng | Chuỗi trạng thái |
|---|---|
| Hồ sơ trẻ | Nháp → Chờ duyệt → Đang học → Tạm nghỉ → Thôi học hoặc Đã tốt nghiệp |
| Hóa đơn học phí | Nháp → Đã phát hành → Đã thu đủ, hoặc Quá hạn |
| Phiếu thu, phiếu chi | Nháp → Đã phát hành → Đã đảo |
| Đơn nghỉ phép | Chờ duyệt → Đã duyệt → Đã hủy, hoặc Từ chối |
| Yêu cầu dặn thuốc | Phụ huynh gửi → Y tế nhận thuốc → Đang cho uống → Hoàn thành, hoặc Từ chối |
| Hoạt động của lớp | Nháp → Chờ duyệt → Đã công bố → Đã ẩn |
| Đề nghị mua hàng | Chờ duyệt → Đã duyệt → Đã mua → Đã nhập kho, hoặc Từ chối |
| Hồ sơ tuyển sinh | Tiếp nhận → Đang xét → Đạt → Đã nhập học, hoặc Không đạt |
| Danh sách hoàn thành chương trình của lớp | Đang ghi → Đã xác nhận (khóa) → Đang ghi khi hủy xác nhận kèm lý do (BR-97) |
| Phiếu đánh giá chuẩn nghề nghiệp | Chờ tự đánh giá → Chờ đánh giá → Đã chốt (BR-98) |
| Ý kiến phản hồi | Mới → Đang xử lý → Đã xử lý; người xử lý chọn được bất kỳ trạng thái nào trong ba trạng thái, kể cả quay lại (BR-109) |

## 14. Chưa xác minh được

1. Công thức tính học phí giữa tháng và cách tính tiền ăn: đã được Eric chốt ngày 09/10/2026, ghi tại BR-14 và BR-23.
2. Đã có câu trả lời: loại và mức miễn giảm do nhà trường cấu hình, Ban Giám hiệu phê duyệt theo hạn mức (Q-16).
3. Đã có câu trả lời: danh mục khấu trừ do nhà trường cấu hình (Q-17).
4. Đã có câu trả lời: số ngày phép năm do nhà trường cấu hình (Q-18).
5. Tiêu chuẩn sức khỏe theo Bộ Y tế (Q-136). Quy định về bếp ăn tập thể: chưa xác nhận.
6. Đã có câu trả lời: mốc nhắc nợ mặc định 3, 7, 15 ngày sau ngày đến hạn (Q-11); chặn đăng ký thêm dịch vụ do đơn vị bật hoặc tắt (BR-33).
7. Mức hạn mức cụ thể: nhà trường cấu hình sau; khi chưa cấu hình thì Hiệu trưởng phê duyệt (Q-112).

## 15. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-11 | Không còn hiệu lực từ ngày 09/10/2026: không còn quy tắc nào ghi chờ xác nhận | Eric |
| GD-12 | Đã xác nhận ngày 09/10/2026: Hệ thống lưu cả căn cứ và kết quả tính của mọi khoản giảm trừ để truy xuất về sau | Eric |
| Q-14 | Đã trả lời ngày 09/10/2026: tính theo ngày học thực tế, công thức ghi tại BR-23 | Eric |
| Q-15 | Đã trả lời ngày 09/10/2026: tiền ăn thu theo ngày ăn thực tế, không có mốc giảm trừ, xem BR-14 | Eric |
| GD-87 | Đã xác nhận ngày 09/10/2026: ngày ăn thực tế là ngày trẻ có trạng thái có mặt, đi muộn hoặc về sớm trong điểm danh đã chốt (Q-39) | Eric |
| Q-16 | Đã trả lời ngày 09/10/2026: loại miễn giảm, cách tính và mức do nhà trường tự cấu hình (P05-11); Ban Giám hiệu phê duyệt theo hạn mức | Eric |
| Q-17 | Đã trả lời ngày 09/10/2026: danh mục khấu trừ do nhà trường tự cấu hình theo quy định hiện hành (P08-11) | Eric |
| Q-18 | Đã trả lời ngày 09/10/2026: số ngày phép năm do nhà trường tự cấu hình theo chức danh và thâm niên (P08-11) | Eric |
| Q-19 | Đã trả lời ngày 09/10/2026: bắt buộc số dư quỹ tiền mặt không âm, không tắt được | Eric |
| Q-20 | Đã trả lời ngày 09/10/2026: phụ huynh đồng ý trên ứng dụng hoặc bằng giấy ký tay; rút lại được, xem BR-65 | Eric |
| Q-112 | Đã trả lời ngày 09/10/2026: chưa có mức hạn mức, để nhà trường cấu hình sau; khi chưa cấu hình thì Hiệu trưởng phê duyệt mọi chứng từ | Eric |
| Q-133 | Đã trả lời ngày 09/10/2026: chốt kỳ tài chính vẫn thuộc danh mục; kế toán trưởng đề nghị, Hiệu trưởng phê duyệt | Eric |
| Q-134 | Đã trả lời ngày 09/10/2026: quản lý đơn vị không phê duyệt chứng từ thuộc danh mục áp dụng hạn mức; chỉ Ban Giám hiệu phê duyệt | Eric |
| Q-141 | Đã trả lời ngày 09/10/2026: học phí chính khóa cấu hình được, mức có thể bằng không khi nhà nước miễn học phí; hệ thống không phụ thuộc chính sách từng năm | Eric |
