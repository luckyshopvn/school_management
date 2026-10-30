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

### 2.6 Hai phong cách dùng chung (YCTD-384, Eric duyệt ngày 2026-10-30)

Eric chọn ngày 2026-10-30: cổng quản trị trường và cổng vận hành theo phong cách "Hành chính hiện đại"; ứng dụng giáo viên, phụ huynh, học sinh theo phong cách "Thân thiện theo vai" (một nền chung, mỗi vai một màu nhấn). Hai phong cách dùng chung phông, thang chữ, khoảng cách, vùng chạm, màu trạng thái (VH-14 đến VH-18), màu tài chính (mục 2.4) và mọi thành phần ở mục 5. Giá trị đặt một lần ở `packages/ui/src/theme.css`; ứng dụng chỉ chọn phong cách và vai, không ghi đè màu riêng. Khi các lát của YCTD-384 xong, PC-01 đến PC-28 thay M-01, M-02, M-05, N-01 đến N-03, C-01 đến C-03, V-01, V-02 và VH-01 đến VH-13 trong mã giao diện; các mã cũ giữ trong tài liệu để tra cứu. Bản mẫu: `tai_lieu/ban_mau/yctd-384/index.html`.

Phong cách Hành chính hiện đại (lớp `.pc-hanh-chinh`):

| Mã | Tên | Giá trị | Dùng cho |
|---|---|---|---|
| PC-01 | Nền trang | #F4F6F9 | Nền vùng nội dung (bằng VH-08) |
| PC-02 | Nền thẻ | #FFFFFF | Thẻ, bảng, biểu mẫu, thanh đầu trang trên máy tính |
| PC-03 | Chữ | #17202A | Chữ chính (15,2:1 trên PC-01) |
| PC-04 | Chữ phụ | #5D6875 | Nhãn phụ, mô tả, tiêu đề cột (5,24:1 trên PC-01) |
| PC-05 | Viền thẻ | #DDE2E8 | Viền thẻ, hộp thoại |
| PC-06 | Kẻ dòng | #EEF1F4 | Kẻ dòng bảng, phân ô số liệu |
| PC-07 | Viền ô nhập | #7D8896 | Viền ô nhập, ô chọn, nút phụ; đạt 3:1 với nền theo WCAG 1.4.11 (thay #CDD5DF chỉ đạt 1,48:1) |
| PC-08 | Nhấn | #1F4E8C | Nút chính (chữ trắng 8,31:1), mục menu đang chọn, viền tiêu điểm, nút lọc đang chọn; thống nhất cổng vận hành (trước là #055A9A) và cổng quản trị |
| PC-09 | Nhấn đậm | #163A69 | Nút chính khi trỏ vào, chữ trên nền nhạt nhấn |
| PC-10 | Nền nhạt nhấn | #E8EEF7 | Nút lọc đang chọn, ô ảnh đại diện, dải thông tin (bằng VH-15) |
| PC-11 | Nền thanh bên | #12304F | Thanh bên; thanh đầu trang trên điện thoại (bằng VH-01) |
| PC-12 | Chữ thanh bên | #DBE6F3 | Mục menu (10,65:1) |
| PC-13 | Chữ phụ thanh bên | #A9BCD2 | Số thứ bậc, nhãn nhóm, chữ phụ (6,92:1) |
| PC-14 | Đường kẻ thanh bên | #2A4A6E | Viền nút Phân hệ, đường phân cách |

Phong cách Thân thiện theo vai (lớp `.pc-theo-vai` kèm một lớp vai):

| Mã | Tên | Giá trị | Dùng cho |
|---|---|---|---|
| PC-15 | Nền trang | #FBF8F3 | Nền vùng nội dung |
| PC-16 | Chữ | #1F2A24 | Chữ chính (14,01:1 trên PC-15) |
| PC-17 | Chữ phụ | #5C6660 | Mô tả, thời gian (5,62:1 trên PC-15) |
| PC-18 | Viền thẻ | #E7E1D8 | Viền thẻ, thanh dưới |
| PC-19 | Kẻ dòng | #F1ECE4 | Kẻ dòng danh sách |
| PC-20 | Viền ô nhập | #8A8174 | Viền ô nhập, nút phụ (3,62:1 trên PC-15) |
| PC-21 | Giáo viên | nhấn #0F6B5F, nhấn đậm #0B564C, nền nhạt #E1F1EC | Lớp `.vai-giao-vien`; chữ trắng trên nhấn 6,39:1; nhấn đậm trên nền nhạt 7,35:1 |
| PC-22 | Phụ huynh | nhấn #1F5FA8, nhấn đậm #184C87, nền nhạt #E6EEF9 | Lớp `.vai-phu-huynh`; 6,44:1; 7,41:1 |
| PC-23 | Học sinh | nhấn #6D28D9, nhấn đậm #5B21B6, nền nhạt #EFE7FD | Lớp `.vai-hoc-sinh`; 7,10:1; 7,49:1 |
| PC-24 | (bỏ) | — | Dự kiến cho chợ gia sư; bỏ ngày 2026-10-30 vì chợ gia sư tách sang kho riêng. Mã không dùng lại |

Dùng chung hai phong cách:

| Mã | Tên | Giá trị | Dùng cho |
|---|---|---|---|
| PC-25 | Thành công | nền #E3F4EA, chữ #1D6B43 | Nhãn, dải thành công (bằng VH-14; 5,68:1) |
| PC-26 | Cảnh báo | nền #FDF0D8, chữ #7A4600 | Nhãn, dải cảnh báo (bằng VH-16; 6,89:1) |
| PC-27 | Nguy hiểm | nền #FDECEC, chữ và nút phá hủy #B91C1C | Bằng VH-18 (5,66:1 trên nền nhạt) |
| PC-28 | Trung tính | nền #EEF1F4, chữ #4A5562 | Đã hủy, bảo lưu, đã kết thúc (bằng VH-17) |

### 2.7 Sẵn sàng cho ứng dụng Android, iOS (YCTD-384, Eric duyệt ngày 2026-10-30)

| Mã | Quy tắc |
|---|---|
| GT-01 | Nguồn biến duy nhất `packages/ui/tokens.json` (màu, chữ, khoảng cách, bo góc, bóng, thời lượng chuyển động) sinh `theme.css`; tên biến theo nghĩa (nhấn, nền, chữ phụ), không theo màu; về sau sinh được chủ đề cho ứng dụng gốc |
| GT-02 | Cỡ chữ khai báo theo `rem` để theo cỡ chữ của hệ thống, trình duyệt; bố cục chịu được cỡ chữ 200% |
| GT-03 | Vùng an toàn: trang đặt `viewport-fit=cover`; thanh đầu, thanh dưới, thanh thao tác, ngăn dưới cộng `env(safe-area-inset-*)` |
| GT-04 | Điều hướng: thanh dưới tối đa 5 mục; màn con có nút quay lại ở đầu trang; vuốt mép trái (iOS) và nút quay lại (Android) đóng ngăn, hộp thoại trước rồi mới về màn trước |
| GT-05 | Cử chỉ chỉ là cách thêm: kéo xuống tải lại danh sách, nhấn giữ để chọn nhiều; mọi việc làm được bằng nút |
| GT-06 | Chế độ tối: phiên bản 1.0 chưa có (Q-85); mỗi biến PC-* có giá trị tối định nghĩa sẵn trong `tokens.json`, chưa bật (Eric quyết ngày 2026-10-30, Q-384-2) |

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

Phông chữ dùng phông hệ thống có hỗ trợ đầy đủ dấu tiếng Việt. Từ YCTD-384 (Eric duyệt ngày 2026-10-30): mọi ứng dụng dùng Be Vietnam Pro (độ đậm 400, 500, 600, 700) đóng gói cùng ứng dụng qua `@fontsource`, không tải từ máy chủ ngoài, phông hệ thống làm phông dự phòng; như cổng quản trị đang dùng. Chữ trong ô nhập 16 điểm ảnh ở mọi khổ màn hình (trước chỉ áp dưới 1280 điểm ảnh ở cổng quản trị). Số thứ bậc trên menu và tiêu đề trang cổng quản trị giữ như hiện nay (quyết định của Eric ngày 2026-10-30). Không dùng quá nhiều cấp cỡ chữ trong cùng một khối. Không có chữ nào nhỏ hơn 14 điểm ảnh, kể cả cổng vận hành từ YCTD-370; giao diện cho phóng to theo trình duyệt (Q-89).

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
| KC-09 | Điểm ngắt (YCTD-384, Eric duyệt ngày 2026-10-30) | Điện thoại dưới 768 điểm ảnh; máy tính bảng 768 đến 1279; máy tính từ 1280. Phong cách hành chính: máy tính có thanh bên 256 điểm ảnh; cổng quản trị hiện thanh bên từ 1024 điểm ảnh, dưới 1024 là ngăn menu (menu không có biểu tượng cho từng nhóm nên không thu thành dải biểu tượng; lát L2, chờ Eric xác nhận); cổng vận hành giữ dải biểu tượng 72 điểm ảnh ở 768 đến 1279 như đã có; điện thoại ẩn thanh bên, thanh đầu xanh đậm có nút "Menu chức năng" mở ngăn. Phong cách theo vai: dưới 1024 điểm ảnh có thanh dưới 4 đến 5 mục; từ 1024 thanh dưới thành thanh bên trắng 240 điểm ảnh. Bảng dữ liệu dưới 768 điểm ảnh chuyển thành danh sách thẻ hoặc bọc cuộn ngang |
| KC-10 | Vùng chạm (YCTD-384, Eric duyệt ngày 2026-10-30) | Mọi nút, ô nhập, mục menu, mục thanh dưới cao tối thiểu 44 điểm ảnh ở mọi khổ màn hình (trước chỉ áp dưới 1280 ở cổng quản trị) |
| KC-11 | Bo góc theo phong cách (YCTD-384, Eric duyệt ngày 2026-10-30) | Hành chính: 8 điểm ảnh cho nút, ô nhập; 12 cho thẻ; không đổ bóng. Theo vai: 12 cho ô nhập; 16 cho thẻ, ô lối tắt; nút dạng viên; bóng mờ 0 2px 6px rgb(60 45 20 / 5%). Nhãn trạng thái bo tròn ở cả hai phong cách |
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
| VH-TP-07 | Thanh so với hạn mức | Chữ "đã dùng / hạn mức (phần trăm)" trên thanh cao 8 điểm ảnh, nền VH-17; dưới 80% màu VH-06, từ 80% chữ cảnh báo VH-16, từ 100% T-03; vai trò `meter` (YCTD-374) |

### 5.2 Thành phần dùng chung thêm ở YCTD-384 (Eric duyệt ngày 2026-10-30)

Đặt ở `packages/ui`, dùng cho mọi ứng dụng. Thành phần riêng của cổng vận hành (mục 5.1) chuyển về `packages/ui` ở lát của cổng vận hành; hành vi giữ nguyên.

| Mã | Thành phần | Quy tắc |
|---|---|---|
| TD-20 | Khung hành chính | Thanh bên PC-11 có tên đơn vị, nút Phân hệ, menu có số thứ bậc, "Tất cả chức năng"; thanh đầu trang trắng có ô tìm, nút ngữ cảnh năm học, Việc của tôi, chuông, ảnh đại diện mở menu người dùng; bố cục theo KC-09 |
| TD-21 | Khung theo vai | Đầu trang màu nhấn bo đáy 20 điểm ảnh, lời chào, nút ngữ cảnh dạng viên (chọn lớp, chọn con, tuần), chuông; thanh dưới hoặc thanh bên theo KC-09; mục đang chọn có viên nền nhạt nhấn |
| TD-22 | Ô lối tắt | Bốn ô một hàng: biểu tượng trong ô 52 điểm ảnh bo 16, nhãn 14 điểm ảnh; ô cuối luôn là "Tất cả" mở danh sách đủ chức năng. Thay hàng nút viên dài ở ứng dụng phụ huynh và cột nút ở ứng dụng giáo viên |
| TD-23 | Danh sách thẻ thay bảng | Dưới 768 điểm ảnh mỗi dòng bảng thành một thẻ: ảnh đại diện hoặc chữ viết tắt, tên, một dòng phụ, nhãn trạng thái, mũi tên mở chi tiết; cả thẻ là vùng bấm. Bảng nhập theo ô giữ dạng bảng, bọc cuộn ngang có cột đầu cố định |
| TD-24 | Dải thông báo một dòng | Thay khối thông báo cao ở đầu trang: biểu tượng, nội dung cắt một dòng, nút Xem mở đủ nội dung, nút Ẩn; đạt tương phản như PC-10 |
| TD-25 | Thanh công cụ lưới gọn | Ô tìm, nút "Bộ lọc" kèm số điều kiện đang áp dụng (TD-10), nút phụ hay dùng, nút "Thêm" gom thao tác ít dùng; nút chính đặt cạnh tiêu đề trang. Khi chọn dòng hiện dải "Đã chọn N …" với thao tác hàng loạt. Điện thoại ẩn nút phụ vào "Thêm" |
| TD-26 | Nhóm nút chọn một | Các nút liền nhau cao 44 điểm ảnh, `role="group"`, `aria-pressed`; nút đang chọn tô màu trạng thái tương ứng (ví dụ điểm danh Có, Phép, Vắng) |
| TD-27 | Ngăn dưới | Điện thoại: thao tác ít dùng, bộ lọc, chọn giá trị mở từ đáy màn hình, có tay cầm, lớp phủ, vùng an toàn; vuốt xuống hoặc nút quay lại đóng. Máy tính bảng, máy tính dùng menu sổ xuống, hộp thoại |
| TD-28 | Thanh thao tác hàng loạt ở đáy | Điện thoại: khi chọn từ một dòng, thanh dính đáy hiện số đã chọn, nút Bỏ chọn, thao tác chính, nút "Thao tác khác" mở TD-27; máy tính bảng, máy tính dùng dải "Đã chọn N …" trên lưới |
| TD-29 | Bảng nhập theo ô | Máy tính, máy tính bảng: cột tên và hàng tiêu đề dính khi cuộn, ô nhập 44 điểm ảnh, bàn phím số cho điểm. Điện thoại: chế độ nhập theo từng dòng (mọi cột của một học sinh, nút trước, sau) và theo một cột cho cả danh sách; cùng dữ liệu, cùng điểm cuối |
| TD-30 | Lịch tuần, ngày | Máy tính, máy tính bảng: lưới tuần, ô có cảnh báo tô màu kèm chữ. Điện thoại: hàng nút chọn ngày, các mục của ngày thành danh sách; xem tháng thành danh sách theo ngày; đổi ô bằng bấm rồi chọn ở TD-27 |
| TD-31 | Mục lục biểu mẫu dài | Máy tính: cột mục lục trái dính; máy tính bảng, điện thoại: hàng nút cuộn ngang dính trên cùng; mục có lỗi gắn nhãn số lỗi; nút Ghi dính đáy |
| TD-32 | Biểu đồ kèm số liệu | Mỗi biểu đồ có câu tóm tắt và bảng số liệu đọc được bằng trình đọc màn hình; nhãn trục từ 14 điểm ảnh; điện thoại thu gọn số cột, không cuộn ngang |

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
| MC-03 | Nền tối chỉ dùng cho lớp phủ hộp thoại và thanh điều hướng trên điện thoại. Từ YCTD-384 (Eric duyệt ngày 2026-10-30): thêm thanh bên PC-11 của phong cách hành chính và đầu trang màu nhấn của phong cách theo vai |
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
