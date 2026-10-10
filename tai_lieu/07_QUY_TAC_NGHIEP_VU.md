# 07. QUY TẮC NGHIỆP VỤ

- Mô tả: Điều kiện, ràng buộc, công thức, trạng thái, ngoại lệ, quy tắc chuyển trạng thái.
- Phiên bản: 1.13
- Ngày cập nhật: 2026-10-10
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
| BR-04 | Sĩ số tối đa của lớp do đơn vị quản lý lớp cấu hình. Vượt sĩ số thì hệ thống cảnh báo và yêu cầu quản lý đơn vị xác nhận |
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
| BR-19 | Khoản phải thu của một trẻ trong một kỳ gồm: học phí chính khóa, tiền ăn, các dịch vụ khác đã đăng ký, và các khoản phát sinh. Học phí chính khóa là một loại phí trong biểu phí, mức có thể bằng không theo chính sách miễn học phí của từng năm học; khi mức bằng không thì hóa đơn không sinh dòng học phí chính khóa |
| BR-20 | Loại giảm trừ, cách tính và mức do nhà trường cấu hình (P05-11, Q-16), ví dụ trẻ con nhân sự, anh chị em ruột cùng học, học phí đặc biệt theo thỏa thuận, học bổng. Mỗi khoản giảm trừ phải ghi rõ căn cứ và người phê duyệt |
| BR-21 | Giảm trừ theo tỷ lệ phần trăm và giảm trừ theo số tiền cố định là hai cách áp dụng khác nhau; hệ thống lưu cả căn cứ và kết quả tính để truy xuất về sau |
| BR-22 | Tổng giảm trừ của một trẻ trong một kỳ không vượt quá tổng khoản phải thu của kỳ đó. Số dư âm phải chuyển thành số dư có cho kỳ sau, không để âm trên hóa đơn |
| BR-23 | Trẻ nhập học hoặc thôi học giữa tháng: học phí chính khóa bằng học phí tháng nhân số ngày học thực tế trong tháng, chia số ngày học của tháng. Số ngày học của tháng tính theo lịch năm học (BR-91): các ngày học trong tuần nằm trong học kỳ hoặc kỳ hè, trừ tuần nghỉ và ngày nghỉ lễ, cộng ngày học bù thứ bảy |
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
| BR-33 | Công nợ quá hạn được xác định theo số ngày quá hạn so với ngày đến hạn của kỳ. Hệ thống đưa vào danh sách nhắc nợ theo mốc cấu hình. Mỗi đơn vị tự bật hoặc tắt việc chặn phụ huynh đăng ký thêm dịch vụ khi trẻ còn công nợ quá hạn; trẻ không bị chặn đi học |
| BR-34 | Số dư quỹ tiền mặt và tài khoản ngân hàng được tính từ phiếu thu, phiếu chi và các giao dịch đã ghi nhận; số dư quỹ tiền mặt không được âm, quy tắc bắt buộc và không tắt được; kiểm tra số dư tài khoản ngân hàng do đơn vị cấu hình |
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
| BR-43 | Lương tháng M trả trước một lần vào đầu tháng M, không đợi chốt công của tháng M: gồm lương theo hợp đồng, phụ cấp cố định và thưởng, trừ khấu trừ cố định; cộng trừ phần điều chỉnh theo bảng công đã chốt của tháng M−1, gồm trừ ngày không hưởng lương bằng lương hợp đồng nhân số ngày không hưởng lương chia ngày công chuẩn (Q-154), cộng tiền làm thêm giờ, phụ cấp và khấu trừ tính theo ngày công. Ngày không hưởng lương gồm nghỉ không lương, vắng không phép và ngày có đơn nghỉ bị từ chối hoặc đã hủy. Tháng M−1 chưa chốt công thì không tính được bảng lương tháng M. Nhân sự mới vào làm giữa tháng không được trả trước tháng đầu; phần tháng đầu trả vào đầu tháng sau theo ngày công đã chốt (Q-155). Xem YCTD-29 |
| BR-44 | Khấu trừ gồm bảo hiểm bắt buộc theo quy định, thuế thu nhập cá nhân theo biểu đang áp dụng, và các khoản khác có ghi rõ căn cứ |
| BR-45 | Bảng lương đã chốt không sửa trực tiếp. Sai thì lập bảng điều chỉnh cho kỳ sau, có lý do và người phê duyệt |
| BR-46 | Nhân sự chỉ xem được bảng lương, chấm công và đơn nghỉ của chính mình, trừ nhân sự, kế toán, kế toán trưởng, Ban Giám hiệu và kiểm toán viên trong thời hạn tài khoản |
| BR-47 | Đánh giá nhân sự theo kỳ dựa trên chỉ số do đơn vị cấu hình. Kết quả đánh giá đã công bố không sửa mà phải lập đánh giá lại có lý do |

## 8. Quy tắc về y tế học đường

| Mã | Quy tắc |
|---|---|
| BR-48 | Phụ huynh gửi thuốc phải khai báo tên thuốc, liều lượng, giờ cho uống, thời gian dùng, tình trạng dị ứng và gửi ít nhất một ảnh thuốc; ảnh đơn thuốc của bác sĩ không bắt buộc. Thiếu thông tin bắt buộc thì không nhận thuốc |
| BR-49 | Người nhận thuốc phải xác nhận đã nhận thuốc trước khi thuốc được đưa vào danh sách cần cho uống. Người nhận thuốc là y tế, hoặc giáo viên chủ nhiệm khi đơn vị bật cấu hình không có nhân viên y tế (BR-86) |
| BR-50 | Mỗi lần cho trẻ uống thuốc, người nhận thuốc theo BR-49 ghi nhận thời điểm và người thực hiện. Bỏ liều phải ghi lý do |
| BR-51 | Hồ sơ sức khỏe của trẻ gồm: chiều cao, cân nặng, dị ứng, bệnh nền, kết quả khám định kỳ, sự kiện y tế phát sinh tại trường, nhu cầu đặc biệt và lưu ý chăm sóc |
| BR-52 | Sự kiện y tế tại trường phải được ghi nhận ngay, thông báo cho phụ huynh, và ghi rõ ai xử lý, xử lý như thế nào |
| BR-53 | Dữ liệu sức khỏe của trẻ là dữ liệu cá nhân nhạy cảm; chỉ giáo viên chủ nhiệm, y tế, Ban Giám hiệu, quản lý đơn vị, kế toán và chính phụ huynh của trẻ được xem; nhu cầu đặc biệt và lưu ý chăm sóc của trẻ cũng thuộc nhóm dữ liệu này |

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
| BR-58 | Suất ăn một ngày gồm ba bữa sáng, trưa, xế, thuộc bán trú. Số suất ăn mỗi ngày bằng số trẻ có mặt theo điểm danh; trẻ vắng ngày nào không tính tiền ăn ngày đó (BR-14). Bếp và kế toán dùng cùng một con số |
| BR-59 | Thực đơn theo tuần phải được duyệt trước khi công bố cho phụ huynh |
| BR-60 | Định lượng nguyên liệu tính từ thực đơn và số suất. Chênh lệch giữa định lượng và thực xuất phải được ghi nhận |
| BR-61 | Tài sản của trường được gán cho đơn vị, phòng hoặc lớp. Mượn, trả, hỏng, mất đều phải có phiếu và người xác nhận |
| BR-62 | Tồn kho tính từ phiếu nhập, phiếu xuất và phiếu kiểm kê. Không cho xuất quá số lượng tồn nếu đơn vị bật kiểm tra này |
| BR-63 | Đề nghị mua hàng phải được duyệt theo hạn mức cấu hình trước khi lập phiếu mua hàng |

## 11. Quy tắc về nội dung và tương tác

| Mã | Quy tắc |
|---|---|
| BR-64 | Hoạt động do giáo viên tạo phải ở trạng thái chờ duyệt. Chỉ hoạt động đã duyệt mới hiển thị cho phụ huynh |
| BR-65 | Hình ảnh của trẻ chỉ được công bố khi phụ huynh đã đồng ý cho sử dụng hình ảnh. Phụ huynh đồng ý bằng xác nhận trên ứng dụng hoặc bằng giấy ký tay được nhà trường tải bản chụp lên; hệ thống lưu cách đồng ý, người đồng ý và thời điểm. Phụ huynh rút lại đồng ý bất cứ lúc nào |
| BR-66 | Bình luận của phụ huynh không bị xóa. Phản hồi tiêu cực được chuyển cho quản lý đơn vị xử lý riêng; quản lý đơn vị được ẩn bình luận vi phạm kèm lý do; bình luận ẩn vẫn được lưu |
| BR-67 | Mỗi tài khoản chỉ được bỏ một phiếu cho mỗi bình chọn, biểu quyết hoặc khảo sát. Sau khi gửi, phiếu không sửa được |
| BR-68 | Bình chọn, biểu quyết, khảo sát có thời gian bắt đầu và kết thúc. Ngoài khoảng thời gian đó hệ thống không nhận phiếu |
| BR-69 | Tin tức, thư viện và thông báo có phạm vi công bố: toàn trường, theo đơn vị, theo lớp hoặc theo từng trẻ |
| BR-70 | Thông báo quan trọng phải ghi nhận ai đã đọc, ai chưa đọc, để nhà trường biết chắc phụ huynh đã nhận |

## 12. Quy tắc về phân quyền và dữ liệu

| Mã | Quy tắc |
|---|---|
| BR-71 | Quyền do máy chủ quyết định tại mọi yêu cầu. Ẩn hoặc vô hiệu hóa nút trên giao diện chỉ là tiện dụng, không được coi là bảo mật |
| BR-72 | Quyền được kiểm tra theo ba lớp: vai trò, phạm vi đơn vị, phạm vi bản ghi. Ví dụ phụ huynh chỉ truy cập được bản ghi của con mình |
| BR-73 | Mọi thao tác đọc dữ liệu cá nhân của trẻ và dữ liệu tài chính phải ghi nhật ký truy cập khi đơn vị bật chế độ này. Hai trường hợp luôn ghi nhật ký, không tắt được: đối tác đọc dữ liệu cá nhân qua API (BM-66) và xem đầy đủ số định danh cá nhân (BR-81) |
| BR-74 | Dữ liệu cá nhân của trẻ và phụ huynh không được xuất ra ngoài hệ thống nếu không có quyền xuất dữ liệu và không ghi nhật ký xuất |
| BR-75 | Không xóa cứng dữ liệu nghiệp vụ đã phát sinh. Dữ liệu không dùng nữa chuyển sang trạng thái ngừng sử dụng |
| BR-76 | Sao lưu dữ liệu theo lịch cấu hình; phải kiểm tra khả năng phục hồi định kỳ, không chỉ kiểm tra bản sao lưu tồn tại |

### 12.1 Quy tắc về phân cấp phê duyệt

Bổ sung ngày 2026-10-09 theo yêu cầu tách vai trò Ban Giám hiệu thành Hiệu trưởng và Phó Hiệu trưởng kèm hạn mức phê duyệt.

| Mã | Quy tắc |
|---|---|
| BR-77 | Hạn mức phê duyệt được cấu hình theo đơn vị và theo loại chứng từ. Phó Hiệu trưởng phê duyệt chứng từ có giá trị dưới hạn mức; Hiệu trưởng phê duyệt chứng từ có giá trị bằng hoặc trên hạn mức. Loại chứng từ chưa cấu hình hạn mức thì Hiệu trưởng phê duyệt (Q-112). Phiếu chi hoàn tiền khi trẻ thôi học là ngoại lệ, luôn do Hiệu trưởng phê duyệt (BR-24) |
| BR-78 | Người lập chứng từ không được tự phê duyệt chứng từ do chính mình lập. Trường hợp đặc biệt phải do Hiệu trưởng phê duyệt và ghi rõ lý do |
| BR-79 | Phó Hiệu trưởng chỉ phê duyệt trong phạm vi đơn vị được gán. Hiệu trưởng phê duyệt trong phạm vi toàn trường |
| BR-80 | Mọi lần phê duyệt hoặc từ chối đều ghi nhật ký thao tác kèm người phê duyệt, thời điểm, giá trị chứng từ và lý do từ chối nếu có |
| BR-81 | Số định danh cá nhân và bản chụp giấy khai sinh của trẻ bắt buộc khi tạo hồ sơ; trẻ nhập từ dữ liệu ban đầu được bổ sung giấy khai sinh sau (YCTD-46); chỉ hiển thị đầy đủ với Hiệu trưởng, Phó Hiệu trưởng, quản lý đơn vị và nhân viên tuyển sinh; vai trò khác thấy số đã che; mỗi lần xem đầy đủ ghi nhật ký truy cập dữ liệu nhạy cảm |
| BR-82 | Giờ làm thêm tính từ chấm công, là phần vượt giờ làm chuẩn trong ngày, tối đa 1 giờ mỗi ngày; tiền làm thêm bằng số giờ nhân đơn giá cấu hình, đưa vào bảng lương của tháng kế tiếp (BR-43). Không có phụ cấp dạy thay |
| BR-83 | Bán trú là dịch vụ bắt buộc với mọi trẻ đang học; phụ huynh không bỏ chọn được. Bán trú gồm ba bữa sáng, trưa, xế; không có dịch vụ ăn sáng hay ăn tối riêng. Tiệc buffet tổ chức theo dịp, nằm trong tiền ăn, không thu riêng |
| BR-84 | Lịch nghỉ thứ bảy định kỳ và lịch học bù thứ bảy do Ban Giám hiệu lập, áp dụng cho toàn trường. Ngày học bù là ngày học bình thường của mọi lớp: có điểm danh, tính vào số ngày học của tháng theo BR-23, tiền ăn tính theo BR-14, không thu phí riêng; với nhân sự là ngày làm việc |
| BR-85 | Mỗi trẻ mỗi kỳ có một hóa đơn chính. Khoản phát sinh sau khi hóa đơn chính đã phát hành, gồm đăng ký trễ được Ban Giám hiệu duyệt và phí hoạt động ngoại khóa thu theo từng hoạt động, được lập thành hóa đơn bổ sung cùng kỳ; hóa đơn chính không bị sửa |
| BR-86 | Mỗi đơn vị có cấu hình "không có nhân viên y tế". Khi bật, yêu cầu dặn thuốc của trẻ thuộc đơn vị đó chuyển cho giáo viên chủ nhiệm của lớp; giáo viên chủ nhiệm nhận thuốc, cho uống và ghi liều như y tế; y tế được gán ở đơn vị cấp trên vẫn xem được. Khi tắt, giáo viên chủ nhiệm không nhận thuốc và không ghi liều (YCTD-25) |
| BR-87 | Giáo viên chủ nhiệm và y tế ghi nhận chăm sóc hằng ngày của trẻ: nhiệt độ, tình trạng khi trẻ ốm, chăm sóc đặc biệt theo lưu ý của phụ huynh; phụ huynh của trẻ xem được trên ứng dụng (YCTD-25) |
| BR-88 | Phụ huynh xác nhận đã biết với thông báo sự kiện y tế và thông báo bỏ liều; hệ thống chỉ hiển thị trạng thái đã hoặc chưa xác nhận cho y tế và giáo viên chủ nhiệm, không nhắc lại (YCTD-25) |
| BR-89 | Không mở được năm học mới khi năm học đang dùng còn trẻ đã thôi học có công nợ chưa tất toán; kế toán phải thu hết hoặc xử lý bằng miễn giảm, điều chỉnh hóa đơn trước. Công nợ của trẻ đã thôi học không chuyển sang năm mới (Q-149, YCTD-37) |
| BR-90 | Khi chấm dứt hợp đồng, nhân sự chốt công đến ngày nghỉ và kế toán lập bảng quyết toán cuối cùng: còn thiếu thì trả thêm, đã trả thừa thì ghi khoản phải thu hồi và thu bằng phiếu thu không gắn trẻ, khoản mục thu hồi lương; bảng quyết toán do Ban Giám hiệu duyệt theo hạn mức bảng lương (Q-156, YCTD-29) |
| BR-91 | Hiệu trưởng lập một lịch năm học chung toàn trường khi tạo năm học: học kỳ 1 và học kỳ 2 có ngày bắt đầu, ngày kết thúc, học kỳ 1 kết thúc trước khi học kỳ 2 bắt đầu; kỳ hè không bắt buộc, nằm sau học kỳ 2; ngày học trong tuần, mặc định thứ hai đến thứ sáu. Hệ thống tự đánh số tuần từ tuần chứa ngày bắt đầu học kỳ 1 đến hết năm học; Hiệu trưởng đánh dấu tuần nghỉ. Lịch sửa được cho tới khi năm học đóng; sửa ngày thì hệ thống đánh số lại tuần và giữ cờ nghỉ của tuần có cùng ngày bắt đầu (YCTD-37). Ngày ngoài học kỳ và kỳ hè, ngày thuộc tuần nghỉ không điểm danh và không tính vào số ngày học (YCTD-30) |
| BR-92 | Kỳ hè thuộc năm học đó. Trẻ học hè phải được đăng ký theo từng tháng hè; trẻ đã đăng ký thì điểm danh và tính học phí như tháng thường theo biểu phí hiện hành, trẻ không đăng ký thì không có trong bảng điểm danh và không có hóa đơn của tháng hè đó (YCTD-30) |
| BR-93 | Mỗi thời điểm chỉ có một năm học đang dùng. Mở năm học mới là một thao tác: kiểm tra BR-89, tạo cơ sở dữ liệu năm mới, chuyển dữ liệu dùng chung, chuyển năm đang dùng sang đã đóng và cơ sở dữ liệu của năm đó sang chỉ đọc. Năm học đầu tiên của hệ thống mở mà không có năm trước (YCTD-37) |

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
