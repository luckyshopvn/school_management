# YCTD-384: Thiết kế lại giao diện toàn hệ thống

- Mô tả: Đặc tả công việc thiết kế lại giao diện mọi ứng dụng web theo hai phong cách, danh sách lát, tiêu chí nghiệm thu dự kiến.
- Ngày: 2026-10-30
- Mức: Lớn (sửa giá trị đã có ở tài liệu `15`, chạm mọi ứng dụng web)
- Trạng thái: Chờ phê duyệt bản mẫu và danh sách lát
- Bản mẫu: [index.html](index.html) (mở thẳng bằng trình duyệt; thanh trên chọn màn hình, khổ, trạng thái)

## 1. Yêu cầu và quyết định

Eric yêu cầu ngày 2026-10-30: thiết kế lại toàn bộ giao diện cho sạch, đẹp, hiện đại, thân thiện trên máy tính, máy tính bảng, điện thoại.

Quyết định của Eric ngày 2026-10-30:

1. Cổng quản trị trường và cổng vận hành nền tảng theo phong cách "Hành chính hiện đại" (thanh bên xanh đậm, nền xám nhạt, thẻ trắng viền mảnh, như hai cổng đã duyệt ngày 28 và 29/10).
2. Ứng dụng giáo viên, phụ huynh, học sinh, chợ gia sư theo phong cách "Thân thiện theo vai": nền kem, thẻ bo 16, nút dạng viên, thanh dưới; màu nhấn giáo viên xanh ngọc #0F6B5F, phụ huynh xanh dương #1F5FA8, học sinh tím #6D28D9, chợ gia sư giữ #1F4E8C đã duyệt.
3. Menu và tiêu đề trang cổng quản trị giữ số thứ bậc (1., 1.1., 1.1.1.) như hiện nay.

Giữ nguyên: chữ tối thiểu 14 điểm ảnh (Q-89), vùng chạm 44 điểm ảnh, tương phản WCAG 2.1 AA, chữ trong ô nhập 16 điểm ảnh, chưa có chế độ tối (Q-85). Không đổi nghiệp vụ, API, phân quyền, dữ liệu; không xóa chức năng.

## 2. Hiện trạng (khảo sát ngày 2026-10-30)

Ảnh chụp ba khổ trên bản nhiều trường ở máy phát triển; rà mã tự động. Điểm chính:

1. Ba màu chính khác nhau: #0670C0 (giáo viên, phụ huynh, học sinh), #1F4E8C (cổng quản trị, chợ gia sư), #055A9A (cổng vận hành). Tài liệu `15` mục 2.1 vẫn ghi thanh đầu trang xanh #0670C0, tên trường vàng, không còn đúng với cổng quản trị.
2. Chỉ cổng quản trị dùng Be Vietnam Pro; các ứng dụng khác dùng phông hệ thống. `theme.css` không có biến phông.
3. Cổng vận hành không dùng `theme.css` và không dùng thành phần nào của `packages/ui` (tự viết lại hộp thoại, thẻ chọn, dải kết quả); khoảng 76 mã màu viết cứng.
4. Ứng dụng giáo viên không có thanh điều hướng (trái BC-02); trang chủ là cột khoảng 20 nút giống nhau. Ứng dụng học sinh một trang, không có điều hướng. Ứng dụng phụ huynh: mỗi con khoảng 20 nút viên; thanh dưới vẫn hiện trên máy tính; nhãn thanh dưới 12 điểm ảnh.
5. Cổng quản trị: máy tính bảng 1024 mất thanh bên (chỉ hiện từ 1280); điện thoại có dải thông báo chiếm một phần tư màn hình, ô tìm co còn chữ "Tìm", thanh công cụ lưới xếp 4 hàng trước dữ liệu; máy tính có biểu mẫu đặt cạnh lưới làm cột bị cắt; Điểm danh chưa chọn lớp là trang trắng; ngày hiện lẫn hai kiểu.
6. Khoảng 70 trang cổng quản trị, 9 trang cổng vận hành có bảng không bọc cuộn ngang. Quy tắc 44 điểm ảnh, chữ ô nhập 16 điểm ảnh ở cổng quản trị chỉ áp dưới 1280; còn khoảng 370 phần tử thấp hơn 44 trên máy tính.
7. Chữ dưới 14 điểm ảnh: cổng quản trị 7 chỗ, cổng vận hành 9 khai báo, giáo viên 6 (ô chữ 9 điểm ảnh), phụ huynh 2.
8. Viền ô nhập #CDD5DF chỉ đạt 1,48:1 với nền trắng, dưới 3:1 của WCAG 1.4.11.

## 3. Thiết kế

Giá trị: tài liệu `15` mục 2.6 (PC-01 đến PC-28), mục 3 (phông), mục 4 (KC-09 đến KC-11), mục 5.2 (TD-20 đến TD-26), MC-03.

Thay đổi tài liệu `14` sẽ ghi ở lát 0 sau khi duyệt:

| Mã | Thay đổi |
|---|---|
| BC-02 | Giáo viên, phụ huynh, học sinh, chợ gia sư: thanh dưới 4 đến 5 mục dưới 1024 điểm ảnh, thanh bên từ 1024; mục "Tất cả" chứa mọi chức năng không có trên thanh |
| BC-11 | Cổng quản trị: dưới 768 điểm ảnh ngăn menu từ nút "Menu chức năng"; 768 đến 1279 dải biểu tượng 72 điểm ảnh (trước: ngăn menu dưới 1280) |
| TN-01 đến TN-03 | Theo KC-09: dưới 768, 768 đến 1279, từ 1280 |
| TN-04 | Vùng chạm 44, chữ 14, chữ ô nhập 16 ở mọi khổ |

Màn hình trong bản mẫu (mỗi màn có sáu trạng thái: có dữ liệu, rỗng, đang tải, lỗi, không có quyền, thao tác thành công):

| Ứng dụng | Màn hình | Mã màn hình hiện có |
|---|---|---|
| Cổng quản trị trường | Trang chủ, Quản lý hồ sơ học sinh, Thêm học sinh, Điểm danh | MH-01, MH-02 (danh sách và biểu mẫu Thêm mới), MH-51 |
| Cổng vận hành | Trường học | MH-316 |
| Giáo viên | Trang chủ, Điểm danh lớp | MG-01, MG-02 |
| Phụ huynh | Trang chủ, Học phí | MP-01, MP-11 |
| Học sinh | Trang chủ, Bài thi | MH-361 (trang chủ), MH-343 |
| Chợ gia sư | Tìm gia sư, Buổi học | MH-532, MH-540 |

Không thêm màn hình mới, không cấp mã MH mới.

## 4. Danh sách lát

Mỗi lát một PR vào `main`, đủ 11 kiểm tra CI mới gộp, có điểm xem trước: ảnh chụp ba khổ so với bản mẫu và chạy thử trên bản nhiều trường.

| Lát | Nội dung | Điểm xem trước |
|---|---|---|
| L0 | Tài liệu: phiếu 24 (tệp mảnh), tài liệu `15` chuyển "Đã phê duyệt", tài liệu `14` (BC-02, BC-11, TN-01 đến TN-04), tiêu chí `11`, kịch bản `21`, bản mẫu này | Eric duyệt bản mẫu và danh sách lát |
| L1 | Nền `packages/ui`: biến PC-01 đến PC-28 và lớp phong cách, vai trong `theme.css`; Be Vietnam Pro qua `@fontsource`; 44 điểm ảnh, 16 điểm ảnh ở mọi khổ; cập nhật Button, TextField, StatusBadge, Alert, ApplicationHeader; thành phần mới TD-20 đến TD-26 (chưa ứng dụng nào đổi bố cục) | Trang thử thành phần chạy cục bộ, ảnh ba khổ; e2e hiện có đạt |
| L2 | Cổng quản trị, khung và lưới: khung TD-20 (dải biểu tượng ở máy tính bảng, thanh đầu xanh ở điện thoại), dải thông báo TD-24, thanh công cụ gọn TD-25 và thẻ TD-23 trong `DataGrid`, sửa chữ dưới 14 | Trang chủ, Hồ sơ học sinh, Danh sách người dùng ở ba khổ |
| L3 | Cổng quản trị, các trang: bọc cuộn khoảng 70 bảng, khối rỗng cho trang chưa chọn lớp hoặc đơn vị, tách biểu mẫu đặt cạnh lưới thành trang hoặc ngăn riêng, ngày hiện ngày/tháng/năm | Điểm danh, Danh sách người dùng, Biểu phí, Thời khóa biểu |
| L4 | Cổng vận hành: chuyển `--pf-*` sang biến chung, dùng thành phần `packages/ui` (Dialog, TabList, dải kết quả), nhấn #1F4E8C, bọc 9 bảng, sửa 9 khai báo chữ nhỏ; giữ bố cục đợt 2 | Trường học, Gói dịch vụ, Bảo trì |
| L5 | Ứng dụng giáo viên: khung TD-21, thanh dưới, trang chủ lối tắt, Điểm danh nhóm nút TD-26; sửa chữ 9 điểm ảnh ở công cụ lớp học | Trang chủ, Điểm danh, một công cụ lớp học |
| L6 | Ứng dụng phụ huynh: khung TD-21, lối tắt theo con, "Tất cả", Học phí | Trang chủ hai con, Học phí |
| L7 | Ứng dụng học sinh: khung TD-21, thanh dưới, Bài thi, ngày hiện ngày/tháng/năm | Trang chủ, Bài thi |
| L8 | Chợ gia sư: phông, nút viên, thanh dưới, lịch gia sư thành danh sách theo ngày ở điện thoại; giữ màu đã duyệt | Tìm gia sư, Buổi học, Lịch gia sư |

Thứ tự: L0, L1 trước; L2 đến L8 làm tuần tự, mỗi lát chờ Eric xem rồi mới làm tiếp. L1 đổi biến dùng chung nên chạy lại ảnh chụp cả sáu ứng dụng để chắc không vỡ.

Không chạm `apps/api` (đang có YCTD-383 chạy song song).

## 5. Tiêu chí nghiệm thu dự kiến

Mã giữ sẵn: AC-1200 đến AC-1239, CT-1800 đến CT-1849 (xa khoảng YCTD-383 đang dùng). Ghi vào tài liệu `11`, `21` ở lát 0.

| Mã | Tiêu chí | Mức |
|---|---|---|
| AC-1200 | Cho mỗi màn hình đã làm lại / Khi mở ở 1366, 1024, 390 điểm ảnh / Thì khớp bản mẫu đã duyệt, không có thanh cuộn ngang ngoài vùng bảng | Bắt buộc |
| AC-1201 | Cho mọi ứng dụng / Khi đo / Thì không chữ nào dưới 14 điểm ảnh, chữ ô nhập 16 điểm ảnh, nút, ô nhập, mục menu cao từ 44 điểm ảnh ở mọi khổ | Bắt buộc |
| AC-1202 | Cho mọi cặp chữ, nền / Khi đo / Thì đạt 4,5:1 (chữ thường), 3:1 (chữ từ 18 điểm ảnh, viền ô nhập, viền tiêu điểm) | Bắt buộc |
| AC-1203 | Cho mã giao diện đã sửa / Khi tìm mã màu viết cứng, lớp màu Tailwind, ghi đè biến màu ở từng ứng dụng / Thì không có, chỉ dùng biến ở `theme.css` sinh từ tài liệu `15` | Bắt buộc |
| AC-1204 | Cho mọi chức năng có trước YCTD-384 / Khi làm lại sau khi đổi giao diện / Thì gọi đúng điểm cuối cũ với cùng dữ liệu gửi; e2e hiện có đạt | Bắt buộc |
| AC-1205 | Cho cổng quản trị / Khi ở máy tính bảng, điện thoại / Thì còn điều hướng (dải biểu tượng, ngăn menu), số thứ bậc giữ nguyên | Bắt buộc |
| AC-1206 | Cho ứng dụng theo vai / Khi dưới 1024 hoặc từ 1024 điểm ảnh / Thì có thanh dưới hoặc thanh bên; mọi chức năng cũ vào được qua lối tắt, thanh, hoặc "Tất cả" | Bắt buộc |
| AC-1207 | Cho mỗi màn hình đã làm lại / Khi đang tải, rỗng, lỗi, không có quyền, thao tác thành công / Thì có khung xương, khối rỗng, dải lỗi có nút Tải lại và mã tra cứu, thông báo không có quyền, thông báo nổi | Bắt buộc |
| AC-1208 | Cho người dùng bàn phím / Khi Tab qua khung, menu, lưới, biểu mẫu / Thì đi đúng thứ tự, có viền tiêu điểm, ô nhập có nhãn | Bắt buộc |
| AC-1209 | Cho bảng dữ liệu / Khi dưới 768 điểm ảnh / Thì thành danh sách thẻ hoặc cuộn ngang trong khung của bảng | Bắt buộc |
| AC-1210 | Cho nút theo quyền / Khi đăng nhập từng vai trò / Thì nút hiện, ẩn như trước YCTD-384; máy chủ vẫn kiểm quyền | Bắt buộc |
| AC-1211 | Cho ngày hiển thị trên màn hình đã làm lại / Khi xem / Thì dạng ngày/tháng/năm | Mong muốn |

## 6. Rà soát giao diện trên bản mẫu

Chạy tự động trên 13 màn hình × 3 khổ × 6 trạng thái (234 ảnh): không có phần tử tràn ngang ngoài vùng bảng, không chữ nào dưới 14 điểm ảnh, không nút, ô nhập, mục menu nào thấp hơn 44 điểm ảnh. Tương phản các cặp màu đo bằng công thức WCAG, ghi ở tài liệu `15` mục 2.6.

| Mục rà soát | Kết quả |
|---|---|
| 1. Khớp đặc tả | Bản mẫu là đặc tả; khớp tài liệu `15` mục 2.6, 4, 5.2 |
| 2. Chỉ dùng giá trị tài liệu `15` | Đạt (biến PC-*) |
| 3. Đủ trạng thái | Đạt, sáu trạng thái mỗi màn hình |
| 4. Thông báo tiếng Việt nêu lỗi và cách xử lý | Đạt (lỗi tải có mã tra cứu, lỗi ô nhập nêu cách nhập đúng) |
| 5. Responsive, không cuộn ngang ngoài ý muốn | Đạt ở 1366, 1024, 390 |
| 6. Tiếng Việt có dấu, nội dung dài | Đạt (tên dài, địa chỉ dài, tên trường dài) |
| 7. Tương phản | Đạt |
| 8. Bàn phím, viền tiêu điểm, nhãn ô nhập | Đạt trên bản mẫu (viền tiêu điểm 3 điểm ảnh màu nhấn) |
| 9. Theo quyền | Có trạng thái không có quyền; ẩn nút theo quyền giữ như mã hiện có |
| 10. Nút đang xử lý, xác nhận xóa | Dùng lại thành phần hiện có (VH-TP-06, TD-07); không vẽ lại |
| 11. Lỗi tại đúng ô | Đạt (Thêm học sinh, trạng thái Lỗi) |
| 12. Màn hình cũ không bị ảnh hưởng | Kiểm ở từng lát bằng ảnh chụp trước, sau |

## 7. Rủi ro

1. L1 đổi biến dùng chung: mọi ứng dụng đổi màu cùng lúc nếu ứng dụng đang ghi đè ít. Giảm thiểu: L1 thêm biến mới, giữ tên biến cũ trỏ về giá trị cũ cho tới lát của từng ứng dụng.
2. Ứng dụng giáo viên có khoảng 25 màn hình đi theo kiểu "trang chủ → màn → quay lại"; thanh dưới đổi đường đi. Giảm thiểu: giữ mọi màn và nút Quay lại, chỉ thêm thanh dưới và lối tắt.
3. Bản nhiều trường trên máy chạy từ bản dựng ngày 29/10: ảnh hiện trạng có thể thiếu thay đổi của PR gộp sau đó.
