# 15. HỆ THỐNG THIẾT KẾ

- Mô tả: Màu sắc, chữ, khoảng cách, thành phần dùng chung, quy tắc thiết kế thống nhất.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Nguyên tắc thiết kế

1. **Rõ trước, đẹp sau.** Màn hình nghiệp vụ ưu tiên đọc nhanh và thao tác nhanh; trang trí không được cản trở.
2. **Ấm nhưng không trẻ con.** Sản phẩm phục vụ trẻ nhỏ nhưng người dùng là người lớn đi làm; màu ấm dùng cho nhận diện, không dùng cho dữ liệu.
3. **Một hệ thống cho ba kênh.** Ba kênh dùng chung thành phần, chỉ khác bố cục điều hướng.
4. **Màu dữ liệu tách khỏi màu nhận diện.** Màu trạng thái và màu tài chính có quy ước riêng, không dùng màu nhận diện để thể hiện trạng thái.
5. **Đủ tương phản.** Mọi cặp chữ và nền phải đạt tương phản tối thiểu 4,5:1 với chữ thường và 3:1 với chữ từ 18 điểm ảnh trở lên, để đọc được ngoài trời và trên màn hình điện thoại cũ.

## 2. Màu sắc

### 2.1 Màu nhận diện

| Mã | Tên | Giá trị | Dùng cho |
|---|---|---|---|
| M-01 | Cam nắng | #F59E0B | Màu chính, nền nút hành động chính (chữ trên nút dùng C-01), biểu tượng thương hiệu |
| M-02 | Cam đậm | #B45309 | Trạng thái nhấn của màu chính, chữ trên nền sáng của vùng thương hiệu |
| M-03 | Xanh biển nhạt | #0EA5E9 | Màu phụ, liên kết, biểu tượng thông tin |
| M-04 | Xanh lá dịu | #10B981 | Màu phụ thứ hai, vùng tích cực |

### 2.2 Màu nền và chữ

| Mã | Tên | Giá trị | Dùng cho |
|---|---|---|---|
| N-01 | Nền trang | #F8FAFC | Nền toàn trang |
| N-02 | Nền thẻ | #FFFFFF | Nền thẻ, bảng, biểu mẫu |
| N-03 | Nền vùng chọn | #EFF6FF | Dòng đang chọn, vùng được đánh dấu |
| C-01 | Chữ chính | #0F172A | Tiêu đề và nội dung chính |
| C-02 | Chữ phụ | #475569 | Nhãn, mô tả, ghi chú |
| C-03 | Chữ mờ | #94A3B8 | Văn bản không hoạt động |
| V-01 | Viền | #E2E8F0 | Viền thẻ, viền ô nhập |
| V-02 | Viền nhấn | #CBD5E1 | Viền khi trỏ vào |

### 2.3 Màu trạng thái

| Mã | Tên | Giá trị | Dùng cho |
|---|---|---|---|
| T-01 | Thành công | #16A34A | Đã duyệt, đã thu đủ, đã hoàn thành |
| T-02 | Cảnh báo | #D97706 | Chờ duyệt, sắp đến hạn, cần chú ý |
| T-03 | Nguy hiểm | #DC2626 | Từ chối, quá hạn, lỗi, hành động phá hủy |
| T-04 | Thông tin | #2563EB | Đang xử lý, ghi chú hệ thống |
| T-05 | Trung tính | #64748B | Đã hủy, không hoạt động, nháp |

### 2.4 Màu quy ước tài chính

| Mã | Quy ước | Giá trị |
|---|---|---|
| TC-01 | Khoản thu, tiền vào, số dư tăng | #2563EB |
| TC-02 | Khoản chi, tiền ra, số dư giảm | #DC2626 |
| TC-03 | Công nợ phải thu còn lại | #D97706 |
| TC-04 | Công nợ phải trả | #7C3AED |

Quy ước này áp dụng thống nhất trên mọi màn hình tài chính và mọi báo cáo.

## 3. Chữ

| Mã | Cấp | Cỡ chữ | Độ đậm | Dùng cho |
|---|---|---|---|---|
| CH-01 | Tiêu đề trang | 24 điểm ảnh | 700 | Tên màn hình |
| CH-02 | Tiêu đề vùng | 18 điểm ảnh | 600 | Tên khối, tên thẻ |
| CH-03 | Tiêu đề nhỏ | 16 điểm ảnh | 600 | Tên nhóm trong biểu mẫu |
| CH-04 | Nội dung | 15 điểm ảnh | 400 | Chữ thường |
| CH-05 | Nhãn | 14 điểm ảnh | 500 | Nhãn trường, tiêu đề cột |
| CH-06 | Ghi chú | 14 điểm ảnh | 400 | Chú thích, dấu thời gian; dùng màu C-02 để phân biệt với nội dung |
| CH-07 | Số liệu lớn | 28 điểm ảnh | 700 | Chỉ số trên bảng điều khiển |

Phông chữ dùng phông hệ thống có hỗ trợ đầy đủ dấu tiếng Việt. Không dùng quá nhiều cấp cỡ chữ trong cùng một khối. Không có chữ nào nhỏ hơn 14 điểm ảnh; giao diện cho phóng to theo trình duyệt (Q-89).

## 4. Khoảng cách và bố cục

| Mã | Đơn vị | Giá trị |
|---|---|---|
| KC-01 | Đơn vị cơ sở | 4 điểm ảnh |
| KC-02 | Khoảng cách trong thành phần | 8 điểm ảnh |
| KC-03 | Khoảng cách giữa thành phần | 16 điểm ảnh |
| KC-04 | Khoảng cách giữa khối | 24 điểm ảnh |
| KC-05 | Đệm trong thẻ | 16 điểm ảnh |
| KC-06 | Bán kính góc | 8 điểm ảnh cho thành phần nhỏ, 12 điểm ảnh cho thẻ |
| KC-07 | Chiều rộng vùng nội dung tối đa | 1440 điểm ảnh |
| KC-08 | Chiều rộng thanh điều hướng bên | 240 điểm ảnh |

## 5. Thành phần dùng chung

| Mã | Thành phần | Quy tắc |
|---|---|---|
| TD-01 | Nút | Bốn loại: chính, phụ, chỉ chữ, phá hủy. Mỗi màn hình chỉ một nút chính |
| TD-02 | Ô nhập | Có nhãn phía trên, thông báo lỗi phía dưới, không dùng chỗ giữ chỗ làm nhãn |
| TD-03 | Ô chọn | Có tìm kiếm khi danh sách trên hai mươi mục |
| TD-04 | Bảng dữ liệu | Cột đầu cố định khi cuộn ngang, có sắp xếp, có chọn nhiều dòng khi cần |
| TD-05 | Thẻ chỉ số | Nhãn, số liệu lớn, dòng so sánh với kỳ trước |
| TD-06 | Nhãn trạng thái | Nền nhạt cùng tông với màu trạng thái ở mục 2.3, chữ đậm dùng chính màu trạng thái, luôn kèm chữ, không chỉ dùng màu |
| TD-07 | Hộp thoại xác nhận | Bắt buộc với hành động không hoàn tác được, có mô tả hậu quả |
| TD-08 | Thông báo nổi | Góc trên bên phải, tự ẩn sau năm giây, không che nút hành động |
| TD-09 | Khung xương | Dùng khi tải, giữ đúng kích thước nội dung thật |
| TD-10 | Bộ lọc | Hiển thị số lượng điều kiện đang áp dụng, có nút xóa toàn bộ |
| TD-11 | Biểu mẫu nhiều bước | Hiển thị bước hiện tại và cho quay lại bước trước |
| TD-12 | Vùng tải tệp | Kéo thả hoặc chọn, hiển thị tiến trình và lỗi từng tệp |
| TD-13 | Dòng thời gian | Dùng cho lịch sử thao tác, lịch sử trạng thái |
| TD-14 | Thanh chọn đơn vị | Chỉ hiển thị khi người dùng có nhiều hơn một đơn vị; có dạng cây và dạng danh sách phẳng có lọc, mặc định dạng cây (Q-119) |
| TD-15 | Khối rỗng | Hình minh họa nhỏ, một câu giải thích, một nút hành động nếu có |
| TD-16 | Ô dữ liệu ngành còn trống | Ô mã định danh ngành còn trống có nền đỏ nhạt và chữ "Chưa có mã" màu T-03 (BR-07) |
| TD-17 | Số định danh đã che | Chỉ hiện bốn số cuối, phần còn lại thay bằng dấu sao; vai trò được xem đầy đủ có nút xem, mỗi lần bấm ghi nhật ký truy cập (BR-81) |

## 6. Biểu tượng và hình ảnh

1. Biểu tượng dùng một bộ thống nhất, nét mảnh, kích thước mặc định hai mươi điểm ảnh.
2. Biểu tượng không đứng một mình trong thao tác quan trọng; luôn kèm chữ hoặc nhãn khi trỏ vào.
3. Hình minh họa cho trạng thái rỗng dùng phong cách vẽ tay nhẹ, tông màu nhận diện.
4. Hình ảnh của trẻ trong sản phẩm phải tuân thủ cờ đồng ý sử dụng hình ảnh đã ghi trong hồ sơ trẻ.

## 7. Quy tắc dùng màu

| Mã | Quy tắc |
|---|---|
| MC-01 | Màu nhận diện không dùng để thể hiện trạng thái hay giá trị tài chính |
| MC-02 | Không truyền đạt thông tin chỉ bằng màu; luôn kèm chữ hoặc biểu tượng |
| MC-03 | Nền tối chỉ dùng cho lớp phủ hộp thoại và thanh điều hướng trên điện thoại |
| MC-04 | Màu cảnh báo và nguy hiểm chỉ dùng cho việc cần chú ý thật, không dùng trang trí |
| MC-05 | Trong cùng một màn hình tối đa ba màu trạng thái xuất hiện |
| MC-06 | Chữ trên nền màu phải đạt tương phản ở nguyên tắc 5; không đặt chữ trắng trên nền M-01, M-03, M-04, T-02 |

## 8. Chưa xác minh được

1. Bộ nhận diện thương hiệu của trường: tám ảnh giới thiệu dùng tông vàng cam và xanh lá, nhưng đó là tài liệu giới thiệu chức năng, không phải bộ nhận diện chính thức. Đã tìm trong: tám ảnh sơ đồ chức năng.
2. Đã có câu trả lời: mọi đơn vị dùng chung một bộ nhận diện (Q-88).
3. Đã có câu trả lời: chữ tối thiểu 14 điểm ảnh, cho phóng to theo trình duyệt (Q-89).

## 9. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-46 | Đã xác nhận ngày 09/10/2026 (theo Q-83): Bảng màu ở mục 2 là đề xuất của nhóm thiết kế, chưa phải bộ nhận diện chính thức | Eric |
| GD-47 | Đã xác nhận ngày 09/10/2026: Ba kênh dùng chung một hệ thống thiết kế, chỉ khác bố cục điều hướng | Eric |
| Q-87 | Đã trả lời ngày 09/10/2026: chưa có; dùng bảng màu đề xuất tới khi có nhận diện chính thức | Eric |
| Q-88 | Đã trả lời ngày 09/10/2026: không; mọi đơn vị dùng chung một bộ nhận diện | Eric |
| Q-89 | Đã trả lời ngày 09/10/2026: chữ tối thiểu 14 điểm ảnh, cho phóng to theo trình duyệt | Eric |
