# 15. HỆ THỐNG THIẾT KẾ

- Mô tả: Màu sắc, chữ, khoảng cách, thành phần dùng chung, quy tắc thiết kế thống nhất.
- Phiên bản: 1.2
- Ngày cập nhật: 2026-10-15
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
| M-01 | Xanh dương | #0670C0 | Màu chính, nền nút hành động chính (chữ trắng), nền thanh đầu trang của cổng quản trị (YCTD-99); đậm hơn để chữ đạt tương phản 4,5:1 (YCTD-235) |
| M-02 | Xanh dương đậm | #055A9A | Trạng thái nhấn của màu chính, chữ và gạch chân của mục đang chọn trên menu ngang của cổng quản trị (YCTD-107); đậm hơn để chữ đạt tương phản 4,5:1 (YCTD-235) |
| M-03 | Xanh liên kết | #0369A1 | Màu phụ, liên kết, biểu tượng thông tin; đậm hơn để chữ đạt tương phản 4,5:1 (YCTD-235) |
| M-04 | Xanh lá dịu | #10B981 | Màu phụ thứ hai, vùng tích cực |
| M-05 | Vàng nhấn | #FFFF00 | Tên hệ thống trên thanh đầu trang xanh (YCTD-99); vàng thuần để đạt tương phản 4,5:1 trên nền thanh đầu trang (YCTD-235) |

### 2.2 Màu nền và chữ

| Mã | Tên | Giá trị | Dùng cho |
|---|---|---|---|
| N-01 | Nền trang | #F5F7FA | Nền toàn trang |
| N-02 | Nền thẻ | #FFFFFF | Nền thẻ, bảng, biểu mẫu |
| N-03 | Nền vùng chọn | #E6F2FC | Dòng đang chọn, vùng được đánh dấu |
| C-01 | Chữ chính | #0F172A | Tiêu đề và nội dung chính |
| C-02 | Chữ phụ | #475569 | Nhãn, mô tả, ghi chú |
| C-03 | Chữ mờ | #64748B | Văn bản không hoạt động; đậm hơn để chữ đạt tương phản 4,5:1 (YCTD-235) |
| V-01 | Viền | #E2E8F0 | Viền thẻ, viền ô nhập |
| V-02 | Viền nhấn | #CBD5E1 | Viền khi trỏ vào |

### 2.3 Màu trạng thái

| Mã | Tên | Giá trị | Dùng cho |
|---|---|---|---|
| T-01 | Thành công | #166534 | Đã duyệt, đã thu đủ, đã hoàn thành; đậm hơn để chữ đạt tương phản 4,5:1 (YCTD-235) |
| T-02 | Cảnh báo | #92400E | Chờ duyệt, sắp đến hạn, cần chú ý; đậm hơn để chữ đạt tương phản 4,5:1 (YCTD-235) |
| T-03 | Nguy hiểm | #B91C1C | Từ chối, quá hạn, lỗi, hành động phá hủy; đậm hơn để chữ đạt tương phản 4,5:1 (YCTD-235) |
| T-04 | Thông tin | #1D4ED8 | Đang xử lý, ghi chú hệ thống; đậm hơn để chữ đạt tương phản 4,5:1 (YCTD-235) |
| T-05 | Trung tính | #475569 | Đã hủy, không hoạt động, nháp; đậm hơn để chữ trên nền nhạt cùng tông đạt tương phản 4,5:1 (YCTD-235) |

### 2.4 Màu quy ước tài chính

| Mã | Quy ước | Giá trị |
|---|---|---|
| TC-01 | Khoản thu, tiền vào, số dư tăng | #2563EB |
| TC-02 | Khoản chi, tiền ra, số dư giảm | #DC2626 |
| TC-03 | Công nợ phải thu còn lại | #D97706 |
| TC-04 | Công nợ phải trả | #7C3AED |

Quy ước này áp dụng thống nhất trên mọi màn hình tài chính và mọi báo cáo.

### 2.5 Màu cổng vận hành

Cổng vận hành nền tảng (`apps/platform`, thiết kế Eric duyệt ngày 2026-10-29) dùng thanh điều hướng bên trái màu xanh đậm, khác KC-08 của cổng quản trị. Giá trị ghi đúng như `apps/platform/src/cong-van-hanh.css` (biến `--pf-*`), chỉ áp trong `.shell-platform` (YCTD-370, ĐX-15.1 đến ĐX-15.3).

| Mã | Tên | Giá trị | Dùng cho |
|---|---|---|---|
| VH-01 | Nền thanh bên | #12304F | Thanh bên, thanh đầu trang ở điện thoại |
| VH-02 | Đường kẻ thanh bên | #2A4A6E | Đường phân cách khối tài khoản ở chân thanh bên |
| VH-03 | Chữ thanh bên | #DBE6F3 | Chữ mục menu |
| VH-04 | Chữ phụ thanh bên | #A9BCD2 | Nhãn nhóm menu, vai trò nhân viên |
| VH-05 | Mục đang chọn | #1F4E8C | Nền mục menu đang mở (chữ trắng) |
| VH-06 | Nhấn | #055A9A | Nút chính, liên kết, viền tiêu điểm, thẻ chọn đang chọn (bằng M-02) |
| VH-07 | Nhấn đậm | #04497D | Nút chính khi trỏ vào, chữ nhãn thông tin |
| VH-08 | Nền trang | #F4F6F9 | Nền vùng nội dung, chân hộp thoại |
| VH-09 | Viền thẻ | #DDE2E8 | Viền thẻ, hộp thoại, thẻ chọn |
| VH-10 | Kẻ dòng | #EEF1F4 | Kẻ dòng bảng, phân nhóm biểu mẫu |
| VH-11 | Viền ô nhập | #CDD5DF | Viền ô nhập, ô chọn, nút lọc |
| VH-12 | Chữ | #17202A | Chữ chính |
| VH-13 | Chữ phụ | #5D6875 | Mô tả, gợi ý, tiêu đề cột |
| VH-14 | Nhãn thành công | nền #E3F4EA, chữ #1D6B43 | Nhãn, dải thông báo thành công |
| VH-15 | Nhãn thông tin | nền #E8EEF7, chữ #04497D | Nhãn thông tin, nút lọc đang chọn |
| VH-16 | Nhãn cảnh báo | nền #FDF0D8, chữ #7A4600 | Nhãn, dải cảnh báo |
| VH-17 | Nhãn trung tính | nền #EEF1F4, chữ #4A5562 | Đã hủy, đã kết thúc, ngừng dùng |
| VH-18 | Nguy hiểm | chữ, nút phá hủy T-03 #B91C1C (chữ trắng trên nền này 6,5:1); nền nhạt #FDECEC (chữ T-03 trên nền này 5,67:1) | Nút phá hủy, nhãn quá hạn, dải lỗi, lỗi tại ô |
| VH-19 | Lớp phủ hộp thoại | C-01 mờ 45% (rgb(15 23 42 / 45%)) | Nền sau hộp thoại |

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

Phông chữ dùng phông hệ thống có hỗ trợ đầy đủ dấu tiếng Việt. Không dùng quá nhiều cấp cỡ chữ trong cùng một khối. Không có chữ nào nhỏ hơn 14 điểm ảnh, kể cả cổng vận hành từ YCTD-370; giao diện cho phóng to theo trình duyệt (Q-89).

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
| KC-08 | Thanh menu ngang của cổng quản trị | Một dòng dưới thanh đầu trang, mục cấp một mở menu sổ xuống, cấp sâu hơn bật sang bên phải; dưới 768 điểm ảnh thay bằng cây menu gập mở từ nút "☰". Thay thanh điều hướng bên rộng 240 điểm ảnh, ẩn hiện được, nhóm thu gọn được của YCTD-99 (YCTD-107) |

## 5. Thành phần dùng chung

| Mã | Thành phần | Quy tắc |
|---|---|---|
| TD-01 | Nút | Bốn loại: chính, phụ, chỉ chữ, phá hủy. Mỗi màn hình chỉ một nút chính |
| TD-02 | Ô nhập | Có nhãn phía trên, thông báo lỗi phía dưới, không dùng chỗ giữ chỗ làm nhãn |
| TD-03 | Ô chọn | Có tìm kiếm khi danh sách trên hai mươi mục |
| TD-04 | Bảng dữ liệu | Cột đầu cố định khi cuộn ngang, có sắp xếp, có chọn nhiều dòng khi cần. Cổng quản trị dùng lưới dữ liệu dùng chung `DataGrid` ở `packages/ui`: tìm kiếm, Mở rộng tìm kiếm, chọn dòng, thao tác trên dòng, dòng chi tiết, cấu hình cột hiển thị, số dòng mỗi trang 10 đến 200, phân trang; cột và số dòng nhớ theo tài khoản (`14_DAC_TA_GIAO_DIEN.md` BC-13, BC-14; YCTD-107) |
| TD-05 | Thẻ chỉ số | Nhãn, số liệu lớn, dòng so sánh với kỳ trước |
| TD-06 | Nhãn trạng thái | Nền nhạt cùng tông với màu trạng thái ở mục 2.3, chữ đậm dùng chính màu trạng thái, luôn kèm chữ, không chỉ dùng màu |
| TD-07 | Hộp thoại xác nhận | Bắt buộc với hành động không hoàn tác được, có mô tả hậu quả. Xóa, gỡ trên cổng quản trị dùng hộp xác nhận xóa dùng chung `ConfirmDeleteDialog`: phải tích ô "Tôi đã đọc và đồng ý xóa <đối tượng>" thì nút Xóa mới bấm được (`14_DAC_TA_GIAO_DIEN.md` BC-15; YCTD-107) |
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
| TD-18 | Menu ngang đánh số và menu người dùng | Vai trò `menubar`, `menu`, `menuitem` theo WAI-ARIA, dùng được bằng chuột và bàn phím; mục có số thứ bậc 1., 1.1., 1.1.1.; trang đang mở tô sáng ở mục lá và mục cấp một chứa nó; menu người dùng mở từ tên người dùng ở thanh đầu trang (`14_DAC_TA_GIAO_DIEN.md` BC-10 đến BC-12; YCTD-107) |
| TD-19 | Khối biểu mẫu | `FormBlock` (khối có tiêu đề), `FormRow` (một dòng nhãn và ô nhập) và lớp `FORM_CONTROL_CLASS` cho ô nhập ở `packages/ui`: nhãn bên trái, ô nhập bên phải; dưới 768 điểm ảnh nhãn nằm trên ô nhập; dùng cho biểu mẫu theo khối như của Sở (`14_DAC_TA_GIAO_DIEN.md` BC-16; YCTD-108) |

### 5.1 Thành phần riêng của cổng vận hành

Lớp ở `apps/platform/src/cong-van-hanh.css`, thành phần React ở `apps/platform/src/platform-ui.tsx` (YCTD-370, ĐX-15.3). TD-07, TD-09, TD-15 áp cho cổng vận hành qua các thành phần này.

| Mã | Thành phần | Quy tắc |
|---|---|---|
| VH-TP-01 | Hộp thoại (`Dialog`, `ConfirmDialog`) | Thẻ `<dialog>` mở dạng phủ: tiêu đề, nút đóng ×, thân, chân có nút; lớp phủ VH-19; Esc đóng, trừ hộp thông tin hiện một lần (chỉ đóng bằng nút "Đã lưu, đóng"); đóng xong tiêu điểm về nút đã mở. Thay hộp nhập, hộp xác nhận của trình duyệt. Hộp xác nhận thao tác phá hủy dùng nút VH-18 |
| VH-TP-02 | Nhóm nút lọc trạng thái | Nút bo tròn, `aria-pressed`; nút đang chọn theo VH-15, viền VH-06 |
| VH-TP-03 | Dải thông báo kết quả | Bốn tông thành công, nguy hiểm, cảnh báo, thông tin; thành công `role="status"`, lỗi `role="alert"`; lỗi tải có nút Tải lại |
| VH-TP-04 | Thẻ chọn trong trang (`TabList`) | Mũi tên trái, phải, Home, End chuyển thẻ; chỉ thẻ đang chọn nhận tiêu điểm bằng Tab |
| VH-TP-05 | Ô nhập có gợi ý | Nhãn phía trên, gợi ý chữ phụ cạnh nhãn, lỗi màu T-03 dưới ô, `aria-invalid` |
| VH-TP-06 | Nút gửi | Đang gửi thì khóa nút, đổi chữ "Đang …", không gửi lặp khi bấm nhiều lần |

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
