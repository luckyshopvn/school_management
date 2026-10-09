# 22. BẢO MẬT

- Mô tả: Xác thực, phân quyền, phiên làm việc, kiểm tra dữ liệu đầu vào, bảo mật API, truy cập dữ liệu.
- Phiên bản: 1.2
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Nguyên tắc

1. **Máy chủ quyết định.** Mọi kiểm tra quyền thực hiện ở máy chủ. Giao diện chỉ hiển thị theo quyền để thuận tiện.
2. **Quyền tối thiểu.** Mỗi vai trò chỉ nhận đúng quyền cần cho công việc của mình.
3. **Không tin dữ liệu vào.** Mọi dữ liệu từ giao diện đều phải kiểm tra lại ở máy chủ.
4. **Có dấu vết.** Mọi thay đổi dữ liệu và mọi truy cập dữ liệu nhạy cảm đều ghi nhật ký.
5. **Dữ liệu trẻ em là dữ liệu cần bảo vệ cao nhất.** Hồ sơ sức khỏe, hình ảnh và thông tin định danh của trẻ là nhóm dữ liệu được bảo vệ chặt nhất.

## 2. Xác thực

| Mã | Biện pháp |
|---|---|
| BM-01 | Đăng nhập bằng số điện thoại hoặc tên đăng nhập kèm mật khẩu; phụ huynh có thêm cách đăng nhập bằng mã một lần gửi qua tin nhắn |
| BM-02 | Mật khẩu lưu dưới dạng băm có muối, dùng thuật toán băm mật khẩu chuyên dụng, không dùng hàm băm thông thường |
| BM-03 | Yêu cầu độ dài và độ phức tạp tối thiểu của mật khẩu |
| BM-04 | Giới hạn số lần đăng nhập sai, tạm khóa tài khoản theo cấu hình |
| BM-05 | Mã phiên ngắn hạn kèm mã làm mới; mã làm mới thu hồi được khi đăng xuất hoặc khi phát hiện bất thường. Mã phiên hết hạn sau 15 phút; mã làm mới hết hạn sau 8 giờ với cổng quản trị và 30 ngày với ứng dụng giáo viên, ứng dụng phụ huynh (Q-120) |
| BM-06 | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31); rủi ro chiếm tài khoản của vai trò phê duyệt được giảm bằng BM-03, BM-04, BM-36, BM-56 (RR-15) |
| BM-07 | Tài khoản phụ huynh mới bắt buộc đổi mật khẩu ở lần đăng nhập đầu bằng mật khẩu; tài khoản vừa được đặt lại mật khẩu (P01-06) bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp (Q-148) |
| BM-08 | Khóa tài khoản ngay khi nhân sự nghỉ việc, không xóa để giữ lịch sử |
| BM-09 | Tài khoản không dùng quá số ngày cấu hình thì tạm khóa |
| BM-54 | Dịch vụ định danh là nơi duy nhất xử lý mật khẩu và cấp phiên; máy chủ API nghiệp vụ không lưu mật khẩu và không tự xác thực mật khẩu |
| BM-55 | Khóa ký mã phiên của dịch vụ định danh lưu trong kho bí mật, tách theo môi trường, xoay định kỳ |
| BM-56 | Phiên bị thu hồi khi phát hiện đăng nhập từ địa chỉ mạng bất thường hoặc khi quyền của tài khoản thay đổi |
| BM-61 | Mã một lần: chỉ dùng một lần, hết hạn sau số phút cấu hình, lưu dạng băm, giới hạn số lần gửi theo số điện thoại và số lần nhập sai; không tiết lộ số điện thoại có tồn tại trong hệ thống hay không |
| BM-68 | Tài khoản kiểm toán viên (VT-20) bắt buộc có ngày hết hiệu lực; hết hạn thì tự khóa |
| BM-69 | Mật khẩu mặc định chung của tài khoản phụ huynh do nhà trường cấu hình, lưu dạng băm, không gửi qua tin nhắn; phiên đăng nhập bằng mật khẩu mặc định chỉ dùng được màn hình đổi mật khẩu; phiên đăng nhập bằng mã một lần dùng bình thường dù chưa đổi mật khẩu mặc định (Q-147); theo dõi đăng nhập sai bất thường trên tài khoản chưa đổi mật khẩu |

## 3. Phân quyền

| Mã | Biện pháp |
|---|---|
| BM-10 | Kiểm tra ba lớp tại mọi yêu cầu: vai trò, phạm vi đơn vị, phạm vi bản ghi |
| BM-11 | Giới hạn phạm vi ở tầng truy vấn dữ liệu, không chỉ ở tầng nghiệp vụ, để chống sót điều kiện |
| BM-12 | Mọi truy vấn tới bảng có cột đơn vị đều phải kèm điều kiện đơn vị |
| BM-13 | Kiểm tra quyền trên từng bản ghi với dữ liệu của trẻ, không chỉ theo đơn vị |
| BM-14 | Thu hồi quyền có hiệu lực ngay tại yêu cầu kế tiếp |
| BM-15 | Mọi thay đổi vai trò và quyền ghi nhật ký thao tác kèm giá trị trước và sau |

## 4. Bảo vệ dữ liệu cá nhân

| Mã | Biện pháp |
|---|---|
| BM-16 | Dữ liệu cá nhân của trẻ gồm thông tin định danh, ngày sinh, địa chỉ, thông tin sức khỏe và hình ảnh |
| BM-17 | Chỉ giáo viên chủ nhiệm, nhân viên y tế, Ban Giám hiệu, quản lý đơn vị, kế toán và chính phụ huynh của trẻ được xem dữ liệu sức khỏe (BR-53) |
| BM-18 | Hình ảnh của trẻ chỉ được công bố khi phụ huynh đã đồng ý; cờ đồng ý kiểm tra ở cấp từng trẻ |
| BM-19 | Ghi nhật ký mọi lần đọc dữ liệu sức khỏe và dữ liệu tài chính khi đơn vị bật chế độ này; luôn ghi, không tắt được, khi đối tác đọc dữ liệu cá nhân qua API và khi xem đầy đủ số định danh cá nhân (BR-73) |
| BM-20 | Xuất dữ liệu cá nhân phải có quyền riêng và ghi nhật ký kèm người xuất, bộ lọc, thời điểm |
| BM-21 | Không đưa dữ liệu thật của trẻ ra môi trường phát triển và môi trường thử nghiệm |
| BM-22 | Khi cần dữ liệu để kiểm thử, phải dùng dữ liệu mô phỏng hoặc dữ liệu đã loại bỏ thông tin định danh |
| BM-64 | Số định danh cá nhân của trẻ được mã hóa khi lưu; chỉ giải mã cho vai trò được xem đầy đủ theo BR-81 và ghi nhật ký mỗi lần giải mã |
| BM-67 | Hệ thống tuân thủ quy định bảo vệ dữ liệu cá nhân hiện hành; trước khi phát hành phải kiểm tra lại văn bản áp dụng (theo hiểu biết của nhóm thiết kế: Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân 2025) |
| BM-70 | Nhật ký thao tác, nhật ký truy cập dữ liệu nhạy cảm, nhật ký xuất dữ liệu và nhật ký bảo mật giữ tối thiểu 24 tháng; nhật ký lỗi hệ thống giữ tối thiểu 6 tháng (Q-109, `12_KIEN_TRUC_HE_THONG.md` mục nhật ký) |

## 5. Bảo mật giao diện lập trình

| Mã | Biện pháp |
|---|---|
| BM-23 | Bắt buộc mã hóa đường truyền bằng giao thức bảo mật |
| BM-24 | Kiểm tra và từ chối dữ liệu vào theo danh sách trường cho phép, không nhận trường lạ |
| BM-25 | Chống tiêm câu lệnh bằng truy vấn có tham số, không nối chuỗi câu truy vấn |
| BM-26 | Giới hạn tần suất cho các điểm cuối nhạy cảm: đăng nhập, gửi thông báo, gửi phiếu bình chọn, xuất dữ liệu |
| BM-27 | Giới hạn dung lượng và định dạng tệp tải lên; kiểm tra nội dung tệp, không chỉ kiểm tra phần mở rộng |
| BM-28 | Truy cập tệp qua đường dẫn có thời hạn, kiểm tra quyền trước khi trả tệp |
| BM-29 | Không trả về thông tin nội bộ trong phản hồi lỗi; chỉ trả mã lỗi và mã tương quan |
| BM-30 | Cấu hình chia sẻ tài nguyên nguồn gốc chỉ cho phép các tên miền của hệ thống |
| BM-57 | Tầng giao diện không truy cập cơ sở dữ liệu và không giữ thông tin đăng nhập cơ sở dữ liệu |
| BM-58 | Máy chủ API nghiệp vụ kiểm tra mã phiên với dịch vụ định danh hoặc kiểm tra chữ ký của mã trước khi xử lý mọi yêu cầu |
| BM-59 | Phê duyệt theo hạn mức được kiểm tra ở máy chủ; không tin giá trị hạn mức do giao diện gửi lên |
| BM-62 | Điểm cuối nhận thông báo tiền vào chỉ chấp nhận yêu cầu có chữ ký hợp lệ của nhà cung cấp và đến từ địa chỉ mạng cho phép; chống xử lý trùng theo mã giao dịch của nhà cung cấp; không tự lập phiếu thu khi số tiền hoặc nội dung không khớp |
| BM-63 | Tệp Excel nhập dữ liệu ban đầu được kiểm tra định dạng và nội dung, giới hạn dung lượng; chỉ VT-02, VT-04, VT-06 được nhập; mỗi lần nhập ghi nhật ký |
| BM-65 | Khóa API của đối tác lưu dạng băm, chỉ hiển thị một lần khi cấp; mỗi khóa có phạm vi dữ liệu, địa chỉ mạng cho phép, ngày hết hạn và giới hạn tần suất; thu hồi có hiệu lực ngay |
| BM-66 | Đối tác chỉ đọc dữ liệu cá nhân khi khóa ghi căn cứ pháp lý; mỗi lần đọc ghi nhật ký truy cập dữ liệu nhạy cảm kèm khóa, phạm vi và số bản ghi |

## 6. Quản lý bí mật và cấu hình

| Mã | Biện pháp |
|---|---|
| BM-31 | Không đặt bí mật trong mã nguồn hoặc trong tệp cấu hình mẫu |
| BM-32 | Bí mật lưu trong biến môi trường hoặc kho bí mật của hạ tầng |
| BM-33 | Tách cấu hình theo môi trường; không dùng chung bí mật giữa các môi trường |
| BM-34 | Xoay khóa và mật khẩu định kỳ, tối thiểu mỗi năm một lần và ngay khi có người rời nhóm |
| BM-35 | Không ghi bí mật vào nhật ký, kể cả khi ghi lỗi kết nối |

## 7. Nhật ký và giám sát bảo mật

| Mã | Nội dung theo dõi |
|---|---|
| BM-36 | Số lần đăng nhập sai theo tài khoản và theo địa chỉ mạng |
| BM-37 | Truy cập dữ liệu ngoài phạm vi đơn vị được gán |
| BM-38 | Xuất dữ liệu với khối lượng bất thường |
| BM-39 | Thay đổi vai trò và quyền |
| BM-40 | Truy cập dữ liệu sức khỏe ngoài giờ làm việc hoặc với tần suất bất thường |
| BM-41 | Lỗi xác thực và lỗi phân quyền tăng đột biến |
| BM-60 | Phê duyệt chứng từ vượt hạn mức bị từ chối hoặc bị chuyển cấp bất thường |

Các trường hợp trên phải đẩy cảnh báo cho quản trị nền tảng và ghi vào nhật ký bảo mật riêng.

## 8. Sao lưu và khôi phục

| Mã | Biện pháp |
|---|---|
| BM-42 | Sao lưu theo SL-01 đến SL-04: sao lưu toàn bộ hằng ngày, giữ tối thiểu ba mươi ngày, gồm cơ sở dữ liệu định danh, cơ sở dữ liệu hệ thống, cơ sở dữ liệu năm học đang dùng và kho tệp; cơ sở dữ liệu năm học đã đóng sao lưu một lần khi đóng và giữ lâu dài; sao lưu tăng dần mỗi giờ với dữ liệu tài chính; khôi phục trong 4 giờ, mất tối đa dữ liệu của 1 giờ gần nhất |
| BM-43 | Bản sao lưu được mã hóa và lưu ở nơi khác với máy chủ chính |
| BM-44 | Kiểm tra phục hồi định kỳ hằng tháng trên môi trường tách biệt, có biên bản |
| BM-45 | Giới hạn quyền truy cập bản sao lưu; chỉ quản trị nền tảng được truy cập |
| BM-46 | Có phương án quay lui cho mỗi lần phát hành |

## 9. Ứng phó sự cố

| Mã | Bước | Nội dung |
|---|---|---|
| BM-47 | Phát hiện | Cảnh báo tự động hoặc báo cáo từ người dùng |
| BM-48 | Khoanh vùng | Xác định phạm vi ảnh hưởng: tài khoản, đơn vị, loại dữ liệu |
| BM-49 | Ngăn chặn | Khóa tài khoản liên quan, thu hồi phiên, tạm dừng kênh bị ảnh hưởng |
| BM-50 | Điều tra | Đọc nhật ký thao tác, nhật ký truy cập, nhật ký lỗi |
| BM-51 | Khắc phục | Sửa lỗi gốc, khôi phục dữ liệu nếu cần |
| BM-52 | Thông báo | Thông báo cho nhà trường và phụ huynh bị ảnh hưởng theo mức độ sự cố |
| BM-53 | Rà soát | Ghi biên bản sự cố, xác định nguyên nhân gốc, bổ sung biện pháp phòng ngừa |

## 10. Trách nhiệm của các bên

| Bên | Trách nhiệm |
|---|---|
| Nhà trường | Hiệu trưởng chịu trách nhiệm bảo vệ dữ liệu cá nhân tại trường (Q-108); quản lý tài khoản nhân sự, gán đúng vai trò và đơn vị, thu hồi quyền khi nhân sự rời đi, xử lý yêu cầu của phụ huynh về dữ liệu, cấp và thu hồi khóa API cho đối tác |
| Nhóm phát triển | Thực hiện đúng các biện pháp ở tài liệu này, không tự ý nới lỏng kiểm tra quyền, báo cáo rủi ro phát hiện được |
| Quản trị nền tảng | Vận hành hạ tầng, sao lưu, giám sát, ứng phó sự cố, không truy cập dữ liệu nghiệp vụ |
| Bên thứ ba | Cơ quan quản lý giáo dục và phần mềm kế toán chỉ đọc qua API theo khóa hoặc qua vai trò VT-19; đơn vị kiểm toán dùng vai trò VT-20 có ngày hết hiệu lực; bảo hiểm xã hội và cơ quan thuế chỉ nhận tệp xuất, không có tài khoản (Q-110) |

## 11. Chưa xác minh được

Không còn mục chưa xác minh. Bốn mục trước đây đã được trả lời tại Q-107 đến Q-110; văn bản pháp luật áp dụng phải kiểm tra lại trước khi phát hành theo BM-67.

## 12. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-58 | Đã xác nhận ngày 09/10/2026: Hệ thống triển khai trên hạ tầng có mã hóa đường truyền và sao lưu tự động | Eric |
| GD-59 | Đã xác nhận ngày 09/10/2026: Nhà trường là bên kiểm soát dữ liệu, nhóm phát triển là bên xử lý dữ liệu theo yêu cầu của nhà trường | Eric |
| GD-69 | Đã xác nhận ngày 09/10/2026 (theo QĐ-08): Dịch vụ định danh tự viết nên toàn bộ trách nhiệm bảo mật xác thực thuộc nhóm phát triển, không dựa vào nhà cung cấp ngoài | Eric |
| Q-107 | Đã trả lời ngày 09/10/2026: tuân thủ quy định bảo vệ dữ liệu cá nhân hiện hành; kiểm tra lại văn bản trước khi phát hành (BM-67) | Eric |
| Q-108 | Đã trả lời ngày 09/10/2026: Hiệu trưởng chịu trách nhiệm bảo vệ dữ liệu cá nhân tại trường | Eric |
| Q-109 | Đã trả lời ngày 09/10/2026: nhật ký giữ tối thiểu 24 tháng | Eric |
| Q-110 | Đã trả lời ngày 09/10/2026: cơ quan quản lý giáo dục và phần mềm kế toán đọc qua API hoặc vai trò VT-19; đơn vị kiểm toán dùng vai trò VT-20; bảo hiểm xã hội, cơ quan thuế chỉ nhận tệp xuất | Eric |
| Q-120 | Đã trả lời ngày 09/10/2026: mã phiên 15 phút; mã làm mới 8 giờ cho cổng quản trị, 30 ngày cho ứng dụng giáo viên và phụ huynh | Eric |
