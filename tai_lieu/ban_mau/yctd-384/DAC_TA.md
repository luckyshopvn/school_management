# YCTD-384: Thiết kế lại giao diện toàn hệ thống

- Mô tả: Đặc tả công việc thiết kế lại giao diện mọi ứng dụng web theo hai phong cách, dùng đầy đủ trên máy tính, máy tính bảng, điện thoại, sẵn sàng cho ứng dụng Android, iOS; danh sách lát, tiêu chí nghiệm thu dự kiến.
- Ngày: 2026-10-30
- Mức: Lớn (sửa giá trị đã có ở tài liệu `15`, chạm mọi ứng dụng web)
- Trạng thái: Chờ phê duyệt bản mẫu, danh sách lát và các quyết định ở mục 9
- Bản mẫu: [index.html](index.html) (mở thẳng bằng trình duyệt; thanh trên chọn màn hình, khổ, trạng thái, biến thể hành chính)

## 1. Yêu cầu và quyết định

Eric yêu cầu ngày 2026-10-30:

1. Thiết kế lại toàn bộ giao diện cho sạch, đẹp, hiện đại, thân thiện trên máy tính, máy tính bảng, điện thoại.
2. Mọi chức năng của mọi ứng dụng dùng được đầy đủ ở cả ba cỡ; không chức năng nào chỉ dùng được trên máy tính. Bản mẫu thiết kế riêng cho từng cỡ (không chỉ co giãn): điều hướng, bảng nhiều cột, biểu mẫu dài, lịch, bảng điểm, báo cáo, thao tác hàng loạt.
3. Hệ thiết kế dùng lại được khi làm ứng dụng Android, iOS sau này; khảo sát `apps/mobile`, `packages/pwa`, đề xuất phương án và quy tắc cửa hàng ứng dụng cần tính trước. Chỉ thiết kế và đề xuất, chưa xây ứng dụng gốc.
4. Thay đổi phạm vi: chợ gia sư (`apps/market`) tách sang kho riêng, chương trình gia sư trong trường (DT-27) bỏ hẳn; bỏ các màn hình đó khỏi việc này. Thêm Gia sư AI theo bản mẫu đã duyệt MH-596 đến MH-600.

Quyết định của Eric ngày 2026-10-30:

1. Cổng quản trị trường và cổng vận hành theo phong cách "Hành chính hiện đại".
2. Ứng dụng giáo viên, phụ huynh, học sinh theo phong cách "Thân thiện theo vai"; màu nhấn giáo viên #0F6B5F, phụ huynh #1F5FA8, học sinh #6D28D9 (duyệt trên ảnh minh họa).
3. Menu và tiêu đề trang cổng quản trị giữ số thứ bậc.

Giữ nguyên: chữ tối thiểu 14 điểm ảnh (Q-89), vùng chạm 44 điểm ảnh, tương phản WCAG 2.1 AA, chữ trong ô nhập 16 điểm ảnh. Không đổi nghiệp vụ, API, phân quyền, dữ liệu; không xóa chức năng.

## 2. Hiện trạng chung (khảo sát ngày 2026-10-30)

Ảnh chụp ba khổ trên bản nhiều trường ở máy phát triển; rà mã tự động.

1. Ba màu chính khác nhau: #0670C0 (giáo viên, phụ huynh, học sinh), #1F4E8C (cổng quản trị), #055A9A (cổng vận hành). Tài liệu `15` mục 2.1 vẫn ghi thanh đầu trang xanh #0670C0, tên trường vàng, không còn đúng với cổng quản trị.
2. Chỉ cổng quản trị dùng Be Vietnam Pro; các ứng dụng khác dùng phông hệ thống. `theme.css` không có biến phông.
3. Cổng vận hành không dùng `theme.css` và không dùng thành phần nào của `packages/ui` (tự viết lại hộp thoại, thẻ chọn, dải kết quả); khoảng 76 mã màu viết cứng.
4. Ứng dụng giáo viên không có thanh điều hướng (trái BC-02); trang chủ là cột khoảng 20 nút giống nhau. Ứng dụng học sinh một trang, không có điều hướng. Ứng dụng phụ huynh: mỗi con khoảng 20 nút viên; thanh dưới vẫn hiện trên máy tính; nhãn thanh dưới 12 điểm ảnh.
5. Cổng quản trị: máy tính bảng 1024 mất thanh bên (chỉ hiện từ 1280); điện thoại có dải thông báo chiếm một phần tư màn hình, ô tìm co còn chữ "Tìm", thanh công cụ lưới xếp 4 hàng trước dữ liệu; máy tính có biểu mẫu đặt cạnh lưới làm cột bị cắt; Điểm danh chưa chọn lớp là trang trắng; ngày hiện lẫn hai kiểu; số tiêu đề trang không khớp menu ("7.4. Thời khoá biểu" khi menu hiện 1 đến 6).
6. Quy tắc 44 điểm ảnh, chữ ô nhập 16 điểm ảnh ở cổng quản trị chỉ áp dưới 1280; còn khoảng 370 phần tử thấp hơn 44 trên máy tính. Chữ dưới 14 điểm ảnh: cổng quản trị 7 chỗ, cổng vận hành 9 khai báo, giáo viên 6 (ô chữ 9 điểm ảnh), phụ huynh 2.
7. Viền ô nhập #CDD5DF chỉ đạt 1,48:1 với nền trắng, dưới 3:1 của WCAG 1.4.11.

## 3. Màn hình chưa dùng được đầy đủ trên điện thoại hoặc máy tính bảng

Rà toàn bộ mã giao diện. Lưới dùng chung `DataGrid` đã có dạng thẻ dưới 768 điểm ảnh (cả chọn dòng); từ 768 đến 1279 là bảng cuộn ngang có cột đầu dính. Cổng quản trị có 313 tệp giao diện: khoảng 108 tệp dùng `DataGrid`, 123 tệp có bảng `<table>` tự viết, trong đó khoảng 72 tệp không có khung cuộn ngang. Ứng dụng giáo viên, phụ huynh, học sinh phần lớn đã thiết kế cho điện thoại; vướng chủ yếu ở công cụ lớp học.

| Nhóm | Số màn hình (ước) | Ví dụ tiêu biểu (đường dẫn, tệp) | Vấn đề | Cách xử lý theo cỡ | Lát |
|---|---|---|---|---|---|
| A. Bảng nhiều cột tự viết | khoảng 70 cổng quản trị, khoảng 10 cổng vận hành | `/training/*` (TrainingPages, 61 cột trên 8 bảng), `/learning-resources/*`, `/graduation`, `/ledger`, `/library/*`, `/emis/send`, `/facility-report`; cổng vận hành Trường học (`SchoolsPage.tsx:1073`), Nhật ký truy cập | Không có khung cuộn, bảng bóp hoặc tràn trang trên điện thoại | Chuyển sang `DataGrid` khi là danh sách; còn lại bọc khung cuộn có cột đầu dính. Điện thoại: thẻ (TD-23). Máy tính bảng: ẩn bớt cột phụ, mở ở dòng chi tiết | L3, L6 |
| B. Bảng nhập theo ô | khoảng 15 | Sổ điểm `/scores` (12 đến 16 cột), Đánh giá học sinh `/student-assessments`, Chấm công `/staff-attendance` (28 đến 31 cột ngày, chi tiết chỉ ở chú thích khi trỏ chuột), sửa Thời khóa biểu, Xếp thời khóa biểu, Thực đơn `/kitchen`, Hạnh kiểm `/conduct`, Điểm danh, Điểm danh theo tiết, Ma trận đề, Chấm thi, Khung tiết, Biểu phí | Không thể thành thẻ thường; không có cột tên dính; thông tin chỉ hiện khi trỏ chuột | Máy tính, máy tính bảng: bảng nhập có cột tên và hàng tiêu đề dính, ô 44 điểm ảnh (TD-29). Điện thoại: hai chế độ cùng dữ liệu, cùng điểm cuối: nhập theo từng học sinh (mọi cột của một em, nút em trước, em sau) và nhập theo một cột cho cả lớp. Chú thích khi trỏ chuột thành chữ hiện sẵn hoặc mở ở ngăn dưới | L4 |
| C. Lịch, thời khóa biểu theo tuần | khoảng 7 | Xem Thời khóa biểu (`min-w-[48rem]`), Tra cứu thời khóa biểu, Lịch công tác, Lịch họp, lưới tháng của Chấm công | Lưới 6 đến 7 cột ngày rộng cố định | Máy tính, máy tính bảng: lưới tuần (TD-30). Điện thoại: hàng nút chọn ngày, các tiết của ngày thành danh sách; xem tháng thành danh sách theo ngày. Đổi tiết bằng bấm ô rồi chọn ở ngăn dưới | L4 |
| D. Biểu mẫu dài, biểu mẫu cạnh lưới | khoảng 25 | Danh sách người dùng (`/accounts`, biểu mẫu 400 điểm ảnh cạnh lưới), Đơn vị (`/org-units`), Cài đặt trường, Ký số, chi tiết Văn bản đến, đi, dòng nhập 5 cột ở Chất lượng, Thực đơn | Máy tính bảng phải cuộn rất dài; dòng nhập nhiều cột chật | Biểu mẫu tách thành trang hoặc ngăn riêng, không đặt cạnh lưới. Biểu mẫu dài có mục lục: máy tính là cột trái dính, máy tính bảng và điện thoại là hàng nút dính trên cùng (TD-31); lỗi đánh dấu ở mục; nút Ghi dính đáy. Dòng nhập nhiều cột xuống dòng dưới 1024 | L3 |
| E. Báo cáo, biểu đồ, in | khoảng 20 | Báo cáo (`/reports`, 15 cột), Báo cáo thi, Báo cáo Tiểu học, Trung học, Thống kê, Báo cáo thời khóa biểu, Tăng trưởng (biểu đồ chữ nhỏ), in Lịch, in Truy xuất thực phẩm | Bảng rộng; biểu đồ chữ nhỏ; in chỉ theo khổ máy tính | Điện thoại: số liệu hai cột, biểu đồ gọn có bảng số liệu đi kèm (TD-32), bảng thành thẻ; xuất Excel, PDF tải về hoặc chia sẻ. In dùng bản in riêng theo khổ giấy, không phụ thuộc khổ màn hình | L5 |
| F. Thao tác hàng loạt, nhập Excel, tải tệp | khoảng 15 lưới chọn dòng, 8 trang nhập Excel, 44 tệp có chọn tệp | Tài khoản, Học sinh, Lớp, Nhóm trẻ, Tuyển sinh đầu cấp (6 lưới), Hồ sơ cuối cấp; hộp chuyển lớp hàng loạt; Nhập Excel (`ExcelImportPanel`) | Thanh thao tác ở đầu lưới bị cuộn mất trên điện thoại; bảng xem trước, báo lỗi nhập là bảng tự viết | Điện thoại: thẻ có ô chọn, thanh thao tác dính đáy kèm số đã chọn (TD-28), thao tác ít dùng ở ngăn dưới (TD-27). Nhập Excel: chọn tệp bằng nút (không chỉ kéo thả), báo lỗi theo dòng thành thẻ | L2, L5 |
| G. Chỉ dùng được bằng chuột | khoảng 6 | Sơ đồ chỗ ngồi (kéo thả, đã có cách bấm), Sắp xếp Truy cập nhanh (chỉ kéo), chú thích khi trỏ chuột ở Chấm công, Đánh giá; nhãn dải biểu tượng cổng vận hành chỉ hiện khi nhấn giữ | Màn hình cảm ứng không kéo thả, không trỏ chuột được | Mọi thao tác kéo thả có cách bấm tương đương (nút lên, xuống; bấm chọn rồi bấm chỗ đặt). Không để thông tin chỉ ở chú thích khi trỏ chuột. Dải biểu tượng có nhãn chữ khi mở rộng | L5, L6 |
| H. Khác | khoảng 10 | Công cụ lớp học của giáo viên (Bảng tuần hoàn `min-w-[640px]` 18 cột, Hình học, Đồ thị, Bảng trắng, Đồng hồ kéo kim, Ô chữ chữ 9 điểm ảnh), Liên kết ứng dụng (`min-w-[720px]`), Hồ sơ cán bộ (`min-w-[36rem]`), Giám sát thi trực tuyến | Kích thước cố định, thao tác kéo trên hình | Công cụ trình chiếu: điện thoại xoay ngang hoặc phóng to, có nút thay kéo; Bảng tuần hoàn cuộn có cột nhóm dính; còn lại theo nhóm A | L3, L7 |

Bản mẫu có đại diện cho các nhóm A (Hồ sơ học sinh, Trường học, Cài đặt Gia sư AI), B (Sổ điểm, Điểm danh), C (Thời khóa biểu), D (Thêm học sinh), E (Báo cáo thu học phí), F (chọn nhiều trên điện thoại). Mỗi lát làm lại màn hình nào thì chạy ảnh chụp ba cỡ cho đủ màn hình của nhóm đó trong lát.

## 4. Thiết kế

Giá trị: tài liệu `15` mục 2.6 (PC-01 đến PC-28), mục 2.7 (sẵn sàng cho ứng dụng gốc), mục 3 (phông), mục 4 (KC-09 đến KC-11), mục 5.2 (TD-20 đến TD-32), MC-03.

Thay đổi tài liệu `14` sẽ ghi ở lát 0 sau khi duyệt:

| Mã | Thay đổi |
|---|---|
| BC-02 | Giáo viên, phụ huynh, học sinh: thanh dưới 4 đến 5 mục dưới 1024 điểm ảnh, thanh bên từ 1024; mục "Tất cả" chứa mọi chức năng không có trên thanh |
| BC-11 | Cổng quản trị: dưới 768 điểm ảnh ngăn menu từ nút "Menu chức năng"; 768 đến 1279 dải biểu tượng 72 điểm ảnh (trước: ngăn menu dưới 1280) |
| BC-18 (mới) | Mọi chức năng dùng được ở ba cỡ theo cách xử lý nhóm ở mục 3; không chức năng nào chỉ có trên máy tính |
| TN-01 đến TN-03 | Theo KC-09: dưới 768, 768 đến 1279, từ 1280 |
| TN-04 | Vùng chạm 44, chữ 14, chữ ô nhập 16 ở mọi khổ |

Màn hình trong bản mẫu (mỗi màn có sáu trạng thái: có dữ liệu, rỗng, đang tải, lỗi, không có quyền, thao tác thành công; ba khổ 1366, 1024, 390):

| Ứng dụng | Màn hình | Mã màn hình |
|---|---|---|
| Cổng quản trị trường | Trang chủ, Quản lý hồ sơ học sinh, Thêm học sinh, Điểm danh, Sổ điểm, Thời khóa biểu, Báo cáo thu học phí, Cài đặt Gia sư AI | MH-01, MH-02, MH-51, Sổ điểm và Thời khóa biểu theo đường dẫn `/scores`, `/timetables`, MH-28, MH-599 |
| Cổng vận hành | Trường học | MH-316 |
| Giáo viên | Trang chủ, Điểm danh lớp | MG-01, MG-02 |
| Phụ huynh | Trang chủ, Học phí, Gia sư AI cho con | MP-01, MP-11, MH-598 |
| Học sinh | Trang chủ, Gia sư AI, Bài thi | MH-361 và MH-596, MH-597, MH-343 |

Nội dung các màn Gia sư AI theo bản mẫu đã duyệt MH-596 đến MH-600; bản mẫu này chỉ đổi phong cách và bày ba cỡ. MH-600 (cổng vận hành, gói bán trực tiếp) theo bố cục của Trường học. Không thêm màn hình mới, không cấp mã MH mới. Số mục trên menu bản mẫu (2.3. Sổ điểm, 2.4. Thời khóa biểu) là minh họa; khi làm, tiêu đề trang lấy đúng số của mục menu đang mở.

## 5. Danh sách lát

Mỗi lát một PR vào `main`, đủ 11 kiểm tra CI mới gộp, có điểm xem trước: ảnh chụp ba khổ so với bản mẫu và chạy thử trên bản nhiều trường.

| Lát | Nội dung | Điểm xem trước |
|---|---|---|
| L0 | Tài liệu: phiếu 24 (tệp mảnh), tài liệu `15` chuyển "Đã phê duyệt", tài liệu `14` (BC-02, BC-11, BC-18, TN-01 đến TN-04), tiêu chí `11`, kịch bản `21`, bản mẫu này | Eric duyệt bản mẫu, danh sách lát, quyết định mục 9 |
| L1 | Nền `packages/ui`: nguồn biến `tokens.json` sinh `theme.css` (PC-01 đến PC-28, lớp phong cách, vai); Be Vietnam Pro qua `@fontsource`; cỡ chữ theo `rem` để theo cỡ chữ hệ thống; vùng an toàn; 44, 16 điểm ảnh ở mọi khổ; cập nhật Button, TextField, StatusBadge, Alert, ApplicationHeader, `DataGrid` (dải chọn dòng dính đáy dưới 768, ẩn cột phụ ở máy tính bảng); thành phần mới TD-20 đến TD-32. Giữ tên biến cũ trỏ về giá trị cũ tới lát của từng ứng dụng | Trang thử thành phần, ảnh ba khổ; e2e hiện có đạt |
| L2 | Cổng quản trị, khung và lưới: TD-20 (dải biểu tượng ở máy tính bảng, thanh đầu xanh ở điện thoại), TD-24, TD-25, thao tác hàng loạt nhóm F trên các lưới chọn dòng, số tiêu đề theo menu, sửa chữ dưới 14 | Trang chủ, Hồ sơ học sinh, Danh sách người dùng ở ba khổ |
| L3 | Cổng quản trị, nhóm A, D, H: khoảng 70 bảng tự viết sang `DataGrid` hoặc khung cuộn; biểu mẫu tách khỏi lưới, mục lục biểu mẫu dài; khối rỗng; ngày hiện ngày/tháng/năm | Danh sách người dùng, Đơn vị, Tốt nghiệp, Sổ cái, Thư viện |
| L4 | Cổng quản trị, nhóm B, C: bảng nhập theo ô và chế độ nhập theo học sinh, theo cột ở điện thoại (Sổ điểm, Đánh giá, Hạnh kiểm, Chấm công, Điểm danh, Điểm danh theo tiết, Thực đơn, Chấm thi, Ma trận đề, Khung tiết, Biểu phí); lịch tuần, xem theo ngày (Thời khóa biểu, Tra cứu, Lịch công tác, Lịch họp). Tách nhỏ thành L4a điểm và đánh giá, L4b chấm công và điểm danh, L4c lịch và thực đơn | Sổ điểm, Chấm công, Thời khóa biểu ba khổ |
| L5 | Cổng quản trị, nhóm E, F, G: báo cáo có bảng số liệu đi kèm biểu đồ, xuất tệp trên điện thoại; nhập Excel; cách bấm thay kéo thả; bỏ thông tin chỉ có khi trỏ chuột | Báo cáo, Nhập Excel, Sơ đồ chỗ ngồi |
| L6 | Cổng vận hành: chuyển `--pf-*` sang biến chung, dùng thành phần `packages/ui`, nhấn #1F4E8C, khoảng 10 bảng nhóm A, 9 khai báo chữ nhỏ, nhãn dải biểu tượng; giữ bố cục đợt 2; MH-600 | Trường học, Gói dịch vụ, Bảo trì, Gia sư AI |
| L7 | Ứng dụng giáo viên: khung TD-21, thanh dưới, trang chủ lối tắt, Điểm danh nhóm nút TD-26; công cụ lớp học nhóm H | Trang chủ, Điểm danh, Bảng tuần hoàn |
| L8 | Ứng dụng phụ huynh: khung TD-21, lối tắt theo con, "Tất cả", Học phí, Gia sư AI cho con (MH-598) | Trang chủ hai con, Học phí, Gia sư AI |
| L9 | Ứng dụng học sinh: khung TD-21, thanh dưới, Bài thi, Gia sư AI (MH-596, MH-597) | Trang chủ, Gia sư AI, Bài thi |

Thứ tự: L0, L1 trước; L2 đến L9 tuần tự, mỗi lát chờ Eric xem rồi mới làm tiếp. Không chạm `apps/api`. Giao diện Gia sư AI do YCTD-383 làm: nếu YCTD-383 gộp trước L8, L9 thì hai lát này đổi phong cách màn hình đã có; nếu sau, YCTD-383 dùng thành phần của L1.

## 6. Tiêu chí nghiệm thu dự kiến

Mã giữ sẵn: AC-1200 đến AC-1239, CT-1800 đến CT-1849 (xa khoảng YCTD-383 đang dùng). Ghi vào tài liệu `11`, `21` ở lát 0.

| Mã | Tiêu chí | Mức |
|---|---|---|
| AC-1200 | Cho mỗi màn hình đã làm lại / Khi mở ở 1366, 1024, 390 điểm ảnh / Thì khớp bản mẫu đã duyệt, không có thanh cuộn ngang ngoài vùng bảng | Bắt buộc |
| AC-1201 | Cho mọi ứng dụng / Khi đo / Thì không chữ nào dưới 14 điểm ảnh, chữ ô nhập 16 điểm ảnh, nút, ô nhập, mục menu cao từ 44 điểm ảnh ở mọi khổ | Bắt buộc |
| AC-1202 | Cho mọi cặp chữ, nền / Khi đo / Thì đạt 4,5:1 (chữ thường), 3:1 (chữ từ 18 điểm ảnh, viền ô nhập, viền tiêu điểm) | Bắt buộc |
| AC-1203 | Cho mã giao diện đã sửa / Khi tìm mã màu viết cứng, lớp màu Tailwind, ghi đè biến màu ở từng ứng dụng / Thì không có, chỉ dùng biến sinh từ tài liệu `15` | Bắt buộc |
| AC-1204 | Cho mọi chức năng có trước YCTD-384 / Khi làm lại sau khi đổi giao diện / Thì gọi đúng điểm cuối cũ với cùng dữ liệu gửi; e2e hiện có đạt | Bắt buộc |
| AC-1205 | Cho cổng quản trị / Khi ở máy tính bảng, điện thoại / Thì còn điều hướng (dải biểu tượng, ngăn menu), số thứ bậc giữ nguyên | Bắt buộc |
| AC-1206 | Cho ứng dụng theo vai / Khi dưới 1024 hoặc từ 1024 điểm ảnh / Thì có thanh dưới hoặc thanh bên; mọi chức năng cũ vào được qua lối tắt, thanh, hoặc "Tất cả" | Bắt buộc |
| AC-1207 | Cho mỗi màn hình đã làm lại / Khi đang tải, rỗng, lỗi, không có quyền, thao tác thành công / Thì có khung xương, khối rỗng, dải lỗi có nút Tải lại và mã tra cứu, thông báo không có quyền, thông báo nổi | Bắt buộc |
| AC-1208 | Cho người dùng bàn phím / Khi Tab qua khung, menu, lưới, biểu mẫu / Thì đi đúng thứ tự, có viền tiêu điểm, ô nhập có nhãn | Bắt buộc |
| AC-1209 | Cho bảng dữ liệu nhóm A / Khi dưới 768 điểm ảnh / Thì thành danh sách thẻ hoặc cuộn ngang trong khung của bảng có cột đầu dính | Bắt buộc |
| AC-1210 | Cho nút theo quyền / Khi đăng nhập từng vai trò / Thì nút hiện, ẩn như trước YCTD-384; máy chủ vẫn kiểm quyền | Bắt buộc |
| AC-1211 | Cho ngày hiển thị trên màn hình đã làm lại / Khi xem / Thì dạng ngày/tháng/năm | Mong muốn |
| AC-1212 | Cho mỗi chức năng ở mục 3 / Khi làm trên điện thoại 390 và máy tính bảng 1024 điểm ảnh bằng cảm ứng / Thì hoàn thành được như trên máy tính (nhập, sửa, xóa, chọn nhiều, nhập Excel, xuất tệp) | Bắt buộc |
| AC-1213 | Cho bảng nhập theo ô nhóm B / Khi nhập trên điện thoại theo học sinh hoặc theo cột / Thì dữ liệu gửi đi và kết quả ghi giống nhập theo bảng | Bắt buộc |
| AC-1214 | Cho thao tác kéo thả, chú thích khi trỏ chuột / Khi dùng cảm ứng / Thì có cách bấm tương đương, thông tin hiện được không cần trỏ chuột | Bắt buộc |
| AC-1215 | Cho trình duyệt đặt cỡ chữ 200% / Khi mở ứng dụng theo vai / Thì không mất nội dung, không chồng chữ | Bắt buộc |
| AC-1216 | Cho điện thoại có tai thỏ, thanh cử chỉ / Khi mở ở chế độ toàn màn hình (đã cài) / Thì thanh dưới, thanh đầu, thanh thao tác không bị che | Bắt buộc |

## 7. Rà soát giao diện trên bản mẫu

Chạy tự động trên 17 màn hình × 3 khổ × 6 trạng thái (306 ảnh): không có phần tử tràn ngang ngoài vùng bảng và các hàng nút cuộn ngang có chủ ý, không chữ nào dưới 14 điểm ảnh, không nút, ô nhập, mục menu nào thấp hơn 44 điểm ảnh. Tương phản các cặp màu đo bằng công thức WCAG, ghi ở tài liệu `15` mục 2.6.

| Mục rà soát | Kết quả |
|---|---|
| 1. Khớp đặc tả | Bản mẫu là đặc tả; khớp tài liệu `15` mục 2.6, 2.7, 4, 5.2 |
| 2. Chỉ dùng giá trị tài liệu `15` | Đạt (biến PC-*); biến thể kiểu Sở dùng giá trị riêng, chỉ để so sánh |
| 3. Đủ trạng thái | Đạt, sáu trạng thái mỗi màn hình |
| 4. Thông báo tiếng Việt nêu lỗi và cách xử lý | Đạt (lỗi tải có mã tra cứu, lỗi ô nhập nêu cách nhập đúng) |
| 5. Responsive, không cuộn ngang ngoài ý muốn | Đạt ở 1366, 1024, 390 |
| 6. Tiếng Việt có dấu, nội dung dài | Đạt (tên dài, địa chỉ dài, tên trường dài) |
| 7. Tương phản | Đạt |
| 8. Bàn phím, viền tiêu điểm, nhãn ô nhập | Đạt trên bản mẫu (viền tiêu điểm 3 điểm ảnh màu nhấn) |
| 9. Theo quyền | Có trạng thái không có quyền; ẩn nút theo quyền giữ như mã hiện có |
| 10. Nút đang xử lý, xác nhận xóa | Dùng lại thành phần hiện có (VH-TP-06, TD-07); không vẽ lại |
| 11. Lỗi tại đúng ô | Đạt (Thêm học sinh, trạng thái Lỗi; mục lục đánh dấu phần có lỗi) |
| 12. Màn hình cũ không bị ảnh hưởng | Kiểm ở từng lát bằng ảnh chụp trước, sau |

## 8. Ứng dụng Android, iOS (thiết kế và đề xuất, chưa xây)

### 8.1 Hiện trạng

- `apps/mobile`: vỏ Capacitor 8.5 (DT-26 phần 26f, YCTD-236), bản demo trên máy giả lập. Mở trang khởi động trong `www` (chọn trường, vai trò) rồi tải ứng dụng web giáo viên hoặc phụ huynh của trường trong WebView. Có đẩy thông báo gốc FCM, APNs (26g, YCTD-237) qua plugin `PushNotifications`. Chưa đóng gói bản dựng tĩnh, chưa có lớp HTTP gốc, chưa giữ mã làm mới trong Keychain, Keystore, chưa có sinh trắc học, liên kết sâu, chưa ký bản phát hành (26h).
- `packages/pwa`: tệp kê khai, service worker, đăng ký đẩy thông báo web, lời mời cài (`InstallPrompt`); dùng ở giáo viên, phụ huynh, học sinh; cổng quản trị, cổng vận hành chưa dùng.

### 8.2 Phương án

| Phương án | Cách làm | Ưu | Nhược |
|---|---|---|---|
| P1. Chỉ PWA | Cài từ trình duyệt, không lên cửa hàng | Rẻ nhất, một mã nguồn, cập nhật tức thì, không chịu quy tắc cửa hàng | Không có trên App Store, Google Play; iOS chỉ nhận đẩy thông báo khi đã thêm vào màn hình chính (iOS 16.4 trở lên); không có Keychain, sinh trắc học; phụ huynh khó tìm, khó cài |
| P2. Capacitor đóng gói ứng dụng web (đề xuất) | Tiếp tục `apps/mobile`: đóng gói bản dựng giáo viên, phụ huynh, học sinh vào ứng dụng, thêm plugin gốc (đẩy thông báo, Keychain, Keystore, sinh trắc học, máy ảnh quét mã, liên kết sâu, nút quay lại Android) | Dùng lại 100% giao diện, biến, thành phần của việc này; đã có nền ở DT-26; một đội làm được | Hiệu năng WebView trên máy Android rẻ; phải có chức năng gốc rõ ràng để không bị từ chối vì chỉ là trang web bọc lại (Apple 4.2); cập nhật mã đóng gói phải qua duyệt |
| P3. React Native, Expo dùng chung biến | Viết lại giao diện bằng thành phần gốc, dùng chung `tokens.json`, kiểu dữ liệu, lớp gọi API | Cảm giác và hiệu năng gốc tốt nhất | Viết lại toàn bộ màn hình ba ứng dụng, hai bộ giao diện phải giữ đồng bộ; chi phí lớn nhất |

Khuyến nghị: P2 cho ba ứng dụng giáo viên, phụ huynh, học sinh (một ứng dụng chọn vai như bản demo, hoặc ba ứng dụng riêng, chờ quyết định khi tới 26h); cổng quản trị, cổng vận hành giữ là ứng dụng web dùng tốt trên máy tính bảng, điện thoại, không lên cửa hàng. Hệ thiết kế làm theo mục 8.3 để chuyển sang P3 được về sau nếu cần.

### 8.3 Hệ thiết kế sẵn sàng cho ứng dụng gốc (đưa vào L1)

1. Nguồn biến duy nhất `packages/ui/tokens.json` (màu, chữ, khoảng cách, bo góc, bóng, thời lượng chuyển động) sinh `theme.css`; về sau sinh được chủ đề cho React Native hoặc tệp màu Android, iOS. Tên biến theo nghĩa (nhấn, nền, chữ phụ), không theo màu.
2. Thành phần đặt tên và trạng thái theo tài liệu `15` mục 5; mỗi thành phần ghi tương ứng gốc: thanh dưới ↔ thanh thẻ iOS, thanh điều hướng Material; ngăn dưới ↔ bảng trượt iOS, bottom sheet Material; ngăn menu chỉ dùng cho cổng quản trị trên web.
3. Điều hướng: tối đa 5 mục ở thanh dưới; nút quay lại ở đầu trang mỗi màn con; vuốt từ mép trái để quay lại trên iOS và nút quay lại của Android đóng ngăn, hộp thoại trước rồi mới về màn trước.
4. Cử chỉ: kéo xuống để tải lại ở danh sách; nhấn giữ để chọn nhiều chỉ là cách thêm, luôn có ô chọn; không chức năng nào chỉ có ở cử chỉ.
5. Vùng an toàn: `viewport-fit=cover` và `env(safe-area-inset-*)` cho thanh đầu, thanh dưới, thanh thao tác, ngăn dưới (đã có trong bản mẫu).
6. Cỡ chữ hệ thống: cỡ chữ theo `rem`; bố cục chịu được 200%; Android WebView theo cỡ chữ hệ thống, iOS cần đọc cỡ chữ ưu tiên (Dynamic Type) qua plugin khi ở P2.
7. Chế độ tối: Q-85 quyết định phiên bản 1.0 chưa có. Đề xuất định nghĩa sẵn cặp giá trị tối cho mỗi biến PC-* trong `tokens.json` (chưa bật), để bật sau không phải sửa thành phần. Chờ Eric quyết (mục 9).
8. Ảnh, biểu tượng: một bộ biểu tượng nét, xuất được SVG cho cả web và gốc; ảnh có kích thước 1x, 2x, 3x.

### 8.4 Quy tắc App Store, Google Play cần tính trước

Các điểm dưới đây theo hướng dẫn duyệt của Apple và chính sách Google Play mà tôi biết tới tháng 6/2026; cần kiểm lại bản mới nhất và đối chiếu hồ sơ pháp lý (tài liệu `48`) trước khi nộp.

| Chủ đề | Quy tắc | Ảnh hưởng tới hệ thống |
|---|---|---|
| Đăng nhập | Apple 4.8: ứng dụng có đăng nhập bằng dịch vụ bên thứ ba (Google, Facebook, Zalo) phải có thêm một cách đăng nhập tương đương giữ riêng tư (Đăng nhập bằng Apple đạt); miễn khi chỉ dùng tài khoản của chính hệ thống, tài khoản do trường cấp, hoặc định danh điện tử của nhà nước | Hiện dùng tài khoản trường cấp: được miễn; nếu thêm đăng nhập bằng định danh điện tử của nhà nước cũng được miễn. Nếu thêm đăng nhập Google, Zalo cho phụ huynh thì phải thêm Đăng nhập bằng Apple |
| Thanh toán nội dung số | Apple 3.1.1, Google Play Payments: mua nội dung số, tính năng dùng trong ứng dụng (gói Gia sư AI, lượt mua thêm) ngay trong ứng dụng phải qua thanh toán trong ứng dụng của Apple, Google; không được đặt nút, liên kết dẫn ra thanh toán ngoài (trừ vùng được phép theo luật địa phương). Dịch vụ bán cho tổ chức (Apple 3.1.3(c)) và dịch vụ người dạy người theo thời gian thực (3.1.3(d)) có ngoại lệ | MH-598 "Mua trực tiếp" (mã QR, thẻ) không đặt được trong ứng dụng cài từ cửa hàng. Cần chọn: dùng thanh toán trong ứng dụng cho mua trực tiếp, hoặc ứng dụng gốc chỉ cho "Mua qua trường" và ẩn mua trực tiếp; "Mua qua trường" là phụ huynh trả qua hóa đơn của trường, cần hỏi Apple, Google trước khi nộp vì không chắc thuộc ngoại lệ bán cho tổ chức |
| Trẻ em | Apple 1.3, 5.1.4: ứng dụng dành cho trẻ không dùng quảng cáo, phân tích của bên thứ ba, có cổng phụ huynh trước liên kết ra ngoài và mua hàng. Google Play chính sách Gia đình: khai độ tuổi mục tiêu; nếu có trẻ dưới 13 tuổi thì chỉ dùng thư viện quảng cáo, phân tích đã chứng nhận, không thu mã định danh quảng cáo | Ứng dụng học sinh: không thêm thư viện phân tích, quảng cáo bên thứ ba; mở liên kết ngoài, mua gói phải qua phụ huynh (đã đúng hướng MH-596 "Gửi lời nhờ cha mẹ") |
| Dữ liệu cá nhân | Nhãn quyền riêng tư (Apple), mục An toàn dữ liệu (Google) phải khai đúng dữ liệu thu; Apple 5.1.2(i): báo rõ và xin đồng ý khi gửi dữ liệu cá nhân tới dịch vụ AI bên thứ ba. Việt Nam: Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân năm 2025: xử lý dữ liệu của trẻ từ đủ 7 tuổi cần đồng ý của trẻ và cha mẹ | Gia sư AI: màn hình đồng ý của phụ huynh trước khi con dùng (MH-598 đã có câu "Đăng ký là đồng ý…"), chặn tên, số điện thoại trước khi gửi (MH-597 đã có), khai dịch vụ AI dùng trong nhãn quyền riêng tư |
| Xóa tài khoản | Apple 5.1.1(v), Google Play: ứng dụng cho tạo tài khoản phải cho xóa tài khoản từ trong ứng dụng; Google còn yêu cầu đường dẫn web để yêu cầu xóa | Tài khoản do trường cấp: cần luồng "Yêu cầu xóa tài khoản" gửi tới trường; chưa có trong hệ thống, là chức năng mới cần phiếu riêng trước khi nộp |
| Chức năng tối thiểu | Apple 4.2: ứng dụng chỉ bọc trang web dễ bị từ chối | P2 phải có chức năng gốc: đẩy thông báo, sinh trắc học, quét mã bằng máy ảnh, làm việc khi mất mạng (điểm danh XL-05) |
| Đẩy thông báo | Xin quyền đúng lúc, nói rõ lợi ích; Android 13 trở lên phải xin quyền | Màn "Cài đặt thông báo" (MH-348) là nơi xin quyền |

## 9. Câu hỏi chờ Eric quyết

| Mã | Câu hỏi | Phương án đề xuất |
|---|---|---|
| Q-384-1 | "Hành chính hiện đại" cho cổng quản trị theo biến thể nào: thanh bên xanh đậm như cổng đang dùng (bản đã trình), hay kiểu Sở (dải xanh #0A3D7A viền đỏ, tiêu đề chữ có chân viết hoa, bảng kẻ ô)? Bản mẫu có công tắc "Biến thể hành chính" để so sánh | Thanh bên xanh đậm: đã duyệt hai lần (28, 29/10), dày thông tin, đọc nhanh; kiểu Sở hợp chào bán cho Phòng, Sở nhưng tiêu đề viết hoa chữ có chân đọc chậm hơn |
| Q-384-2 | Có định nghĩa sẵn giá trị chế độ tối trong `tokens.json` (chưa bật) không? | Có: chi phí nhỏ ở L1, tránh sửa lại khi làm ứng dụng gốc |
| Q-384-3 | Phương án ứng dụng Android, iOS | P2 Capacitor (tiếp tục DT-26) |
| Q-384-4 | Gói Gia sư AI trong ứng dụng cài từ cửa hàng | Hỏi Apple, Google về "Mua qua trường" trước khi nộp; nếu không được miễn thì dùng thanh toán trong ứng dụng cho mua trực tiếp |

## 10. Rủi ro

1. L1 đổi biến dùng chung: giữ tên biến cũ trỏ về giá trị cũ cho tới lát của từng ứng dụng.
2. Ứng dụng giáo viên có khoảng 25 màn hình theo kiểu "trang chủ → màn → quay lại"; thanh dưới đổi đường đi. Giữ mọi màn và nút Quay lại, chỉ thêm thanh dưới và lối tắt.
3. Nhóm B ở điện thoại có hai chế độ nhập: phải cùng điểm cuối, cùng dữ liệu gửi; kiểm bằng e2e ở L4 (AC-1213).
4. Bản nhiều trường trên máy chạy từ bản dựng ngày 29/10: ảnh hiện trạng có thể thiếu thay đổi của PR gộp sau đó.
5. Quy tắc cửa hàng ứng dụng thay đổi theo thời gian; mục 8.4 phải kiểm lại khi tới 26h.
