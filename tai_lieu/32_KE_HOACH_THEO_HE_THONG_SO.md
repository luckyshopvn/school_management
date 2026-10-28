# 32. KẾ HOẠCH ĐỒNG BỘ CHỨC NĂNG VÀ GIAO DIỆN THEO HỆ THỐNG CỦA SỞ (DT-15)

- Mô tả: Kế hoạch điều chỉnh School Management theo kết quả khảo sát `31_KHAO_SAT_HE_THONG_SO.md`; từ mục 9 thêm kế hoạch DT-18 điều hành nhà trường, mục 10 thêm kế hoạch DT-19 nền đa cấp học, mục 11 thêm kế hoạch DT-20 Tiểu học (kèm 22c thời khoá biểu), mục 12 thêm kế hoạch DT-21 THCS và THPT (kèm 22g kiểm tra, đánh giá), mục 13 thêm kế hoạch DT-22 (22a thư viện, 22e hồ sơ bồi dưỡng, 22h kho học liệu số), mục 14 thêm kế hoạch DT-SaaS (Enterprise SaaS nhiều trường: S1a, S1b, S2, S3, S4, S5a, S5b, S6, S7a, S7b, S8a, S8b, S9; hai hồ sơ triển khai: thử nghiệm miễn phí và vận hành), mục 15 thêm kế hoạch DT-23 (thi trực tuyến cho học sinh, công cụ lớp học, trò chơi kiến thức và thẻ đáp án giấy, trợ lý AI; 23a đến 23d), mục 18 thêm kế hoạch DT-26 (ứng dụng web cài được, bố cục máy tính bảng, ứng dụng cài đặt iOS và Android; 26a đến 26h), mục 16 thêm DT-24 (danh mục đơn vị toàn quốc, đăng nhập theo đơn vị, quyền vào mọi trường của quản trị nền tảng), mục 19 thêm kế hoạch DT-27 (nền tảng gia sư trực tuyến: gia sư trong trường, khoá học ghi sẵn, hỏi đáp, chợ gia sư mở; 27a đến 27i); mục 17 thêm DT-25 bộ nối nhà cung cấp định danh OIDC, sẵn cho VNeID; mục 20 thêm kế hoạch DT-28 (hệ thống quản lý học tập LMS: lõi khoá học, lớp học trực tuyến, nhóm học tập, bài tập, bài về nhà, tiến độ, thảo luận, học nhóm, SCORM, huy hiệu; 28a đến 28j).
- Phiên bản: 1.82
- Ngày cập nhật: 2026-10-26
- Trạng thái: Đã duyệt hướng làm
- Căn cứ: yêu cầu của Eric ngày 2026-10-13 ("tính năng đã có thì ưu tiên phiên bản và giao diện của Sở; tính năng Sở không có thì giữ nguyên, chỉ đổi giao diện theo trang của Sở") và các lựa chọn của Eric cùng ngày ở mục 2.

## 1. Nguyên tắc

| Trường hợp | Cách làm |
|---|---|
| Đã có, Sở cũng có | Theo Sở: tên và số thứ tự menu, cột danh sách, thứ tự ô nhập, tên nút, bộ lọc. Trường riêng của mình (học phí, hợp đồng, lương…) giữ lại ở thẻ riêng của hồ sơ |
| Đã có, Sở không có | Giữ nguyên nghiệp vụ, chỉ đổi giao diện theo mẫu chung của Sở (menu, lưới dữ liệu, hộp thoại, biểu mẫu) |
| Sở có, chưa có | Làm theo DT-14 (YCTD-102) và các mục chọn ở mục 2 |
| Không áp dụng | Đăng nhập bốn bước chọn trường (mình là một trường); đồng bộ hồ sơ lên CSDL Bộ, Sở; xác thực định danh với CSDLQG về dân cư (cần giao diện lập trình của Bộ, G3-09); tách trường; ký số (cần nhà cung cấp). Từ ngày 2026-10-16 làm bản chạy nội bộ theo mục 7 |

## 2. Lựa chọn của Eric ngày 2026-10-13

1. Menu ngang nhiều cấp có đánh số như Sở, bỏ thanh điều hướng bên trái (thay lựa chọn giữ thanh bên ở YCTD-99).
2. Cổng quản trị gọi "Học sinh" thay cho "Trẻ"; ứng dụng phụ huynh, giáo viên giữ cách gọi hiện tại.
3. Giữ mã quyền theo thao tác; màn hình phân quyền hiển thị theo cây menu, tích một mục menu chọn các quyền của mục đó, vẫn chỉnh được từng thao tác.
4. Làm thêm: biểu mẫu Gửi phản hồi ở chân trang; hết hạn mật khẩu và bắt buộc đổi định kỳ; đổi địa danh hành chính cũ sang mới; văn thư lưu trữ.

## 3. Cây menu đích

Phân hệ chọn ở ô phân hệ trên thanh đầu trang; mỗi phân hệ một menu ngang đánh số.

### 3.1 Quản lý giáo dục Mầm non

| Số | Mục | Nguồn |
|---|---|---|
| 1.1 | Hồ sơ trường | DT-14d |
| 1.2, 1.3 | Phân hiệu, Điểm trường | Tách từ Cây đơn vị; thêm khoảng cách đến cơ sở chính, diện tích, điện thoại |
| 1.4 | Cấu hình trường | Cấu hình |
| 1.5 | Đơn vị quản lý | Thêm vào hồ sơ trường |
| 2.1 | Hồ sơ lớp học | Lớp học; thêm nhóm lớp, nhóm tuổi, thứ tự, học 2 buổi, lớp ghép, ghép vào lớp, bán trú, giải thể |
| 2.2 | Nhập lớp học từ Excel | Nhập dữ liệu |
| 3.1.1 | Hồ sơ cán bộ, giáo viên | Hồ sơ nhân sự; cột theo Sở, hợp đồng và lương ở thẻ riêng |
| 3.1.3 | Nhập nhân sự từ Excel | Nhập dữ liệu (kể cả tệp ngành) |
| 3.1.4 | Tìm kiếm hồ sơ nhân sự | Mới: lọc Đảng viên, tuổi, xã ĐBKK |
| 3.2 | Đánh giá chuẩn nghề nghiệp | DT-14c |
| 3.3 | Phân công phụ trách lớp | Mới, lấy từ giáo viên của lớp |
| 3.4 | Khai báo tuần | Lịch năm học |
| 4.1.1 | Quản lý hồ sơ học sinh | Hồ sơ trẻ; cột theo Sở |
| 4.1.2 | Nhập học sinh từ Excel | Nhập dữ liệu (kể cả tệp ngành) |
| 4.1.3 | Sắp xếp học sinh (A–Z) | Mới |
| 4.1.4 | Tìm kiếm hồ sơ học sinh | Mới: lọc học 2 buổi, bán trú, biết bơi |
| 4.1.5 | Điện thoại nhận tin của phụ huynh | Mới: sửa hàng loạt, nhập từ Excel |
| 4.1.6, 4.1.7 | Nhóm học sinh, xếp học sinh vào nhóm | DT-14c |
| 4.1.11 | Cập nhật địa danh hành chính | Mới (mục 2.4) |
| 4.1.12 | Học 2 buổi/ngày, bán trú | Mới: đánh dấu hàng loạt |
| 4.2 | Biến động học sinh | Gom chuyển lớp, chuyển đơn vị, thôi học |
| 4.3 | Cân nặng, chiều cao | DT-14a |
| 4.4 | Hoàn thành chương trình | DT-14c |
| 4.5 | Thực đơn bữa ăn | Bếp |
| 4.6 | Sức khỏe học sinh | Y tế |
| 5.1–5.3 | Thống kê lớp, nhân sự, học sinh | DT-14a |
| 5.7 | Chuyển hồ sơ lên năm học mới | Chuyển năm học |
| 5.8, 5.9 | Thống kê hồ sơ chưa nhập đủ | Mới |
| 5.10 | Văn thư lưu trữ | Mới (mục 2.4) |

### 3.2 Các phân hệ khác

- Cơ sở vật chất, TBDH và Báo cáo số liệu (EMIS): DT-14d, đánh số theo Sở.
- Quản trị hệ thống: 1.1 Nhóm người dùng (Vai trò); 1.3 Phân quyền theo menu (ma trận quyền hiển thị theo cây menu); 1.4 Danh sách người dùng (Tài khoản, bộ lọc và cột theo Sở); thêm Năm học, Cây đơn vị, Danh mục, Hạn mức, Khóa API, Kết nối ngoài, Nhật ký.
- Phân hệ riêng của mình, đánh số theo cùng kiểu: Tài chính – học phí; Nhân sự – chấm công, lương; Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng; Báo cáo.

## 4. Mẫu giao diện chung

1. Thanh đầu trang theo Sở: tên trường, ô phân hệ, ô "Cấp · Năm học · Học kỳ" (DT-14b), chuông thông báo, menu người dùng (Thông báo, Hồ sơ cá nhân, Đổi mật khẩu, Cấu hình hiển thị lưới, Danh sách ý kiến đã gửi, Hướng dẫn, Thoát).
2. Menu ngang nhiều cấp đánh số, mở bằng chuột và bàn phím; màn hình hẹp chuyển thành menu gập.
3. Lưới dữ liệu dùng chung: Tìm kiếm, Mở rộng tìm kiếm; ô chọn từng dòng; Sửa, Hồ sơ trên dòng; cấu hình cột hiển thị và số dòng mỗi trang (10–200) nhớ theo người dùng; Thêm mới, Thay đổi, Xóa, Xuất Excel, Xuất PDF; hộp xác nhận xóa có ô "Tôi đã đọc và đồng ý xóa".
4. Biểu mẫu nhập theo khối, nhãn bên trái, nút Ghi.
5. Chân trang có biểu mẫu Gửi phản hồi.
6. Ứng dụng giáo viên, phụ huynh giữ bố cục hiện tại, chỉ dùng chung màu.

## 5. Các đợt

| Đợt | Nội dung | Phụ thuộc |
|---|---|---|
| 15a | Khung chung: menu ngang đánh số, menu người dùng, lưới dữ liệu dùng chung, hộp xác nhận xóa, cấu hình lưới theo người dùng; đổi bộ trợ giúp điều hướng của kiểm thử e2e | Sau khi gộp DT-14a–d |
| 15b | Trường học, Lớp học (1.x, 2.x, 3.3) | 15a |
| 15c | Học sinh: đổi tên, cột, tìm kiếm mở rộng, A–Z, điện thoại nhận tin, học 2 buổi và bán trú hàng loạt, biến động, hồ sơ chưa đủ | 15a |
| 15d | Nhân sự: cột, tìm kiếm mở rộng, hồ sơ chưa đủ | 15a |
| 15e | Quản trị hệ thống: nhóm người dùng, phân quyền theo cây menu, danh sách người dùng | 15a |
| 15f | Đưa các phân hệ riêng sang lưới và biểu mẫu chung | 15a |
| 15g | Gửi phản hồi, hết hạn mật khẩu | 15a |
| 15h | Địa danh hành chính mới, văn thư lưu trữ | 15c |

Mỗi đợt: ghi YCTD, chạy đủ kiểm thử đơn vị và e2e, mở PR, gộp khi mọi kiểm tra CI đạt. Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng đợt.

## 6. Tiến độ

| Đợt | Tiến độ |
|---|---|
| 15a | Đã triển khai (YCTD-107) |
| 15b | Đã triển khai (YCTD-111): 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường, 2.1 Hồ sơ lớp học, 2.2 Nhập lớp học từ Excel, 3.3 Phân công phụ trách lớp; 1.1, 1.4 chỉ đổi tiêu đề, 1.4 chưa có ba ô của Sở; 1.6 đến 1.8 không làm theo mục 1. Cột hiện mặc định và 50 dòng mỗi trang của 2.1 chỉnh theo Sở ở YCTD-117 |
| 15c | Đã triển khai (YCTD-108) |
| 15d | Đã triển khai (YCTD-112): 3.1.1 Hồ sơ cán bộ, giáo viên (lưới theo cột của Sở, Xuất Excel, hồ sơ hai thẻ, biểu mẫu Thêm mới theo khối), 3.1.4 gộp vào Mở rộng tìm kiếm của 3.1.1 (chưa có lọc xã ĐBKK); 5.9 đã có từ DT-14a; chưa tách 3.1.2, 3.1.3, 3.1.5, 3.5 |
| 15e | Đã triển khai (YCTD-109) |
| 15f | Chia theo phân hệ của ô phân hệ thành ba phần làm song song (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11), giữ mã YCTD-113 đến YCTD-115: 15f1 Tài chính – học phí (YCTD-114), 15f2 Nhân sự – chấm công, lương (YCTD-113), 15f3 các phân hệ riêng còn lại (YCTD-115) |
| 15f2 | Đã triển khai (YCTD-113): 12 trang của phân hệ Nhân sự – chấm công, lương có tiêu đề đánh số theo menu; 17 lưới dữ liệu chung ở 10 trang; biểu mẫu Thêm mới theo khối, nút Ghi; hộp xác nhận xóa ở ngày lễ, lịch bù, lịch công tác; nghiệp vụ không đổi; bảng chấm công tháng, bảng lương tháng, bảng quyết toán, biểu thuế, phiếu lương của tôi, bảng tiến độ, kết quả đánh giá của tôi giữ bố cục |
| 15f1 | Đã triển khai (YCTD-114): 15 trang của phân hệ Tài chính – học phí có tiêu đề đánh số theo menu; 20 lưới dữ liệu chung; biểu mẫu Thêm mới theo khối, nút Ghi; danh sách chờ duyệt thành lưới; hộp xác nhận xóa ở phiên bản biểu phí, phiếu chi nháp, dòng sao kê, quy tắc ghi sổ; nghiệp vụ không đổi; bảng đăng ký dịch vụ, biểu phí theo phiên bản, sổ quỹ, đối chiếu ngân hàng, nhật ký chung, sổ cái, cân đối số phát sinh giữ bố cục |
| 15f3 | Đã triển khai (YCTD-115): 8 trang của các phân hệ Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng; Báo cáo có tiêu đề đánh số theo menu; 32 lưới dữ liệu chung; biểu mẫu Thêm mới theo khối, nút Ghi; nghiệp vụ không đổi; thẻ Duyệt hoạt động, thẻ Trao đổi, thời khóa biểu, các bảng báo cáo tổng hợp, hồ sơ ứng viên giữ bố cục; trang Thực đơn bữa ăn (`/kitchen`) không thuộc phần này |
| 15g | Đã triển khai (YCTD-110) |
| 15h1 | Đã triển khai (YCTD-116): 4.1.11 Cập nhật địa danh hành chính (lưới địa chỉ học sinh theo địa danh cũ ở năm loại địa chỉ, đề xuất, chuyển hàng loạt; bảng đối chiếu Thành phố Hồ Chí Minh, nhập từ Excel); chưa có nhập danh sách học sinh kèm địa chỉ mới từ Excel |
| 15h2 | Đã triển khai (YCTD-118): 5.10 Văn thư lưu trữ gồm 5.10.1 Hồ sơ tài liệu (hoàn thành, chưa hoàn thành, người giải quyết, thời hạn, tệp đính kèm, Xuất Excel), 5.10.2 Phông lưu trữ, 5.10.3 Thông tin lưu trữ, 5.10.4 Báo cáo lưu trữ (Xuất Excel); chưa có sổ văn bản đến, đi |
| 15h2 (sửa hạn chế) | Đã triển khai (YCTD-122): chia theo đơn vị, người giải quyết theo nhân sự, nhắc hạn, xóa lại tệp; sổ văn bản đến, đi chờ khảo sát |

## 7. Bổ sung đủ tính năng theo Sở (DT-16)

Ngày 2026-10-16 Eric nhận xét DT-15 chưa lấy đầy đủ tính năng từ trang của Sở và yêu cầu làm đủ mọi màn hình, thẻ, cột, bộ lọc, nút đã khảo sát ở tài liệu 31. Lựa chọn của Eric cùng ngày:

1. Tính năng cần hệ thống bên ngoài làm bản chạy nội bộ, có đủ màn hình, cột, nút như Sở; bước cần kết nối thay bằng trạng thái nhập tay (ngày, người thực hiện), tệp xuất theo mẫu của Bộ để nộp, hoặc tệp PDF; khi có giao diện lập trình của Bộ, Sở hoặc nhà cung cấp ký số thì nối thêm. Thay cho dòng "Không áp dụng" ở mục 1: đăng nhập chọn trường, đồng bộ lên CSDL Bộ, Sở, xác thực với CSDLQG về dân cư, tách trường, ký số, gửi lên cấp trên, biến động liên trường.
2. Phân hệ Tuyển sinh đầu cấp và Hồ sơ điện tử chưa khảo sát được; chờ khảo sát bổ sung rồi mới làm.

Các phần chia theo kết quả đối chiếu từng dòng tài liệu 31 với mã nguồn ngày 2026-10-16. Phần lưới dùng chung cho các phân hệ riêng thuộc đợt 15f; 5.10 Văn thư lưu trữ thuộc phần 15h2.

| Phần | Nội dung | Lượt | Tiến độ |
|---|---|---|---|
| 16a | Công cụ xuất, nhập dùng chung: Xuất PDF, tác vụ xuất nền và danh sách "Tệp đã tạo", Xuất file lỗi, tải file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột khi nhập; mẫu "gửi lên cấp trên" chạy nội bộ (mức hoàn thành dữ liệu, trạng thái gửi, ngày gửi, đặt trạng thái gửi lại, mở khóa) | 1 | Đã triển khai (YCTD-121): Xuất PDF trên lưới (bật ở 4.1.1, 4.1.9, 2.1, 3.3, 3.1.1), tác vụ xuất nền và 3.5 Tệp đã tạo (học sinh, cán bộ), nhập Excel dùng chung ở Nhập dữ liệu từ Excel và 2.2 Nhập lớp học (file mẫu kèm dữ liệu của lớp học, tra cứu danh mục, chọn cột, xuất file lỗi), gửi lên cấp trên chạy nội bộ áp cho Biểu 1 EMIS đầu năm; hướng dẫn dùng ở tài liệu 17 mục 17.1 |
| 16b | Lưới dữ liệu dùng chung, hộp xác nhận xóa, Xuất Excel cho các màn hình còn lại của phân hệ Mầm non, Cơ sở vật chất, Báo cáo số liệu, Quản trị hệ thống | 1 | Đã triển khai (YCTD-119): lưới dữ liệu chung cho 1.1, 2.1 Cơ sở vật chất, TBDH; 3.2, 4.1.6, 4.3.2, 4.4, 4.5, 4.6.1, 4.6.2, 5.8 Mầm non; 2.1 đến 2.5, 3.2 Quản trị hệ thống; hộp xác nhận xóa cho bỏ học sinh khỏi nhóm, bỏ món, bỏ nguyên liệu, xóa tiêu chuẩn sức khỏe, bỏ liên kết Zalo; Xuất Excel 1.1, 1.2, 1.3, 1.4, 4.1.11. Bảng nhập theo ô, bảng số liệu cố định (EMIS, 5.1, 2.6) giữ dạng bảng; chưa có Xuất PDF (chờ 16a) |
| 16c | Thanh đầu trang, menu người dùng, thông báo bật lên (hết hạn mật khẩu, mã định danh tổ chức theo NĐ 69), đăng nhập (ghi nhớ tài khoản, quên mật khẩu, mã xác nhận, đường dây nóng) | 1 | Đã triển khai (YCTD-123): tên trường và ô "Cấp MN · năm học · học kỳ" trên thanh đầu trang, lưới ứng dụng liên kết, menu người dùng bảy mục, hộp Thông báo khi vào trang, trang đăng nhập hiện tên, mã trường (bản nội bộ của đăng nhập chọn trường), mã xác nhận, ghi nhớ tài khoản, quên mật khẩu qua tin nhắn, lịch sử mật khẩu, đường dây nóng, 3.6 Thông báo hệ thống, 3.7 Ứng dụng liên kết; chưa có quên mật khẩu qua thư điện tử, Đăng nhập năm cũ |
| 16d | Quản trị hệ thống: 1.1, 1.2 Phân quyền nhóm theo phần mềm, 1.4 đủ cột, bộ lọc, thao tác; 1.6 Tài khoản đồng bộ của Bộ, của Sở (lưu nội bộ) | 1 | Đã triển khai (YCTD-120) |
| 16e | Trường, lớp, lịch: 1.4, 1.7 Rà soát thông tin kiểm định CLGD, 1.8 Tách trường (nội bộ), 2.1, 2.2, 3.3, 3.4 Khai báo tuần, 5.7 | 2 | Đã triển khai (YCTD-127): 1.4 khối Cấu hình trường (tên trường hiển thị, tên đơn vị hành chính, tính cân nặng/chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân, chỉ đặt ở Trường chính); 1.7 Rà soát thông tin kiểm định CLGD (Lấy dữ liệu, Ghi); 1.8 Tách trường bản chạy nội bộ (yêu cầu tách, xác nhận đi, đánh dấu đã tiếp nhận, xuất hồ sơ 82 cột, 75 cột theo mẫu CSDL ngành, tiếp nhận bằng bộ nhập tệp CSDL ngành); 2.1 chọn nhiều lớp, Thay đổi hàng loạt, Giải thể lớp đã chọn, Xóa lớp chưa phát sinh dữ liệu; 2.2 nhập lớp thêm bảy cột của Sở; 3.3 dòng giáo viên chưa phân công, lọc tình trạng phân công; 3.4 Khai báo tuần (học kỳ, hiển thị, tuần đệm); 5.7 Chuyển hồ sơ lên năm học mới (Thực hiện, Hủy khi năm mới chưa phát sinh dữ liệu); tách trường không truyền dữ liệu, tên đơn vị hành chính chưa in lên báo cáo (phần 16j) |
| 16f | Nhân sự: 3.1.1 đủ nút, 3.1.2, 3.1.3, 3.1.4 lọc xã ĐBKK, 3.1.5 (nội bộ), 3.2 nhập Excel, 3.5 Biến động nhân sự (nội bộ), 5.2, 5.6, 5.9 | 2 | Đã triển khai (YCTD-124): 3.1.1 Thay đổi, Xóa hồ sơ nhập nhầm, Xuất tệp theo mẫu Bộ 75 cột kèm kiểm tra dữ liệu, Xuất file lỗi, lọc xã ĐBKK (đánh dấu theo nhân sự), trạng thái xác thực, danh mục của Bộ, tài khoản ngân hàng, mã số thuế; 3.1.2 Nhân sự phân hiệu (gán tay, lấy theo phân hiệu giảng dạy); 3.1.3 Nhập nhân sự từ Excel (mẫu 75 cột kèm dữ liệu, tra cứu danh mục); 3.1.5 Đánh dấu đã xác thực, sai thông tin (bản chạy nội bộ); 3.2 Nhập mức đánh giá từ Excel; 3.5 Biến động nhân sự bốn thẻ (bản chạy nội bộ, hồ sơ chuyển trao bằng tệp 75 cột); 5.2 Thống kê nhân sự theo danh mục Bộ và chuẩn nghề nghiệp; 5.6 Tiến độ xác thực, trùng số định danh; 5.9 thêm tài khoản ngân hàng, mã số thuế; chưa có kết nối CSDL Bộ, CSDLQG, liên thông giữa các trường; 5.1 giữ thẻ nhân sự cũ |
| 16g | Học sinh: 4.1.1 đủ nút, 4.1.2, 4.1.3, 4.1.5, 4.1.8–4.1.10 (nội bộ), 4.1.11 nhập danh sách, 4.2 đủ thao tác, 5.4, 5.5 | 2 | Đã triển khai (YCTD-126): 4.1.1 Thay đổi, Xóa hồ sơ nháp, Cấp mã định danh Bộ (ghi tay, tệp 82 cột theo mẫu Bộ), Xuất file lỗi; 4.1.2 Nhập học sinh từ Excel; 4.1.3 Sắp xếp học sinh; 4.1.5 Điện thoại nhận tin; 4.1.8 Thu thập, xác thực số định danh (đánh dấu đã xác thực); 4.1.10 Tài khoản học và thi lưu nội bộ; 4.1.11 nhập địa chỉ mới, sửa, xóa dòng đối chiếu; 4.2 chuyển lớp hàng loạt, chuyển đi, tiếp nhận chuyển đến bằng tệp; 5.4, 5.5 |
| 16h | Sức khỏe, dinh dưỡng, thống kê: 4.5, 4.6, 5.3, báo cáo sức khỏe đầu năm | 2 | Đã triển khai (YCTD-125): 4.6.1 Nhập thông tin sức khỏe học sinh theo học kỳ (giáo dục thể chất, cân nặng, chiều cao, biết bơi, bệnh về mắt, lấy dữ liệu từ 4.3); 4.3.2 tổng hợp theo học kỳ, so sánh hai lần cân đo, cột được khám định kỳ; 4.5 thực đơn có tên, tháng, tuần, từ ngày–đến ngày, khối áp dụng, nhập từ Excel bằng công cụ nhập chung; 5.3 Thống kê học sinh đủ sáu phần; số liệu báo cáo sức khỏe đầu năm (dòng 1.3) có điểm cuối riêng, màn hình và gửi lên cấp trên ở phần 16j; thực đơn vẫn theo tuần, chỉ tiêu 1.3 chưa đối chiếu biểu mẫu chính thức |
| 16i | Cơ sở vật chất: 1.1 nhập Excel, 1.2 Báo cáo cơ sở vật chất, 2.2, 2.3 (nội bộ), 6.1 Thực trạng và nhu cầu đầu tư | 3 | Đã triển khai (YCTD-128): 1.1 Nhập từ Excel (công cụ nhập chung), thông tin nhà vệ sinh của Phòng vệ sinh, loại phòng nhà công vụ; 1.2 Báo cáo cơ sở vật chất (số liệu phòng theo khối, loại phòng, hiện trạng; nhà vệ sinh; mức độ đạt chuẩn theo khối; Xuất Excel, PDF; gửi lên cấp trên chạy nội bộ); 6.1 Thực trạng và nhu cầu đầu tư (lấy số liệu từ khai báo phòng); 6.2 mở màn hình 1.1; 2.2 mục riêng có nhập danh mục từ Excel; 2.3 Gửi thiết bị dạy học lên cấp trên (Xuất tệp gửi, Đánh dấu đã gửi, Trường không có dữ liệu); gắn tài sản với thiết bị ở Kho; chưa nối hệ thống của Sở, mức độ đạt chuẩn và thông tin nhà vệ sinh cần đối chiếu biểu mẫu chính thức |
| 16j | Báo cáo số liệu (EMIS): 1.1 thẻ ngân sách, 1.2, 1.3, 2.1–2.4, gửi báo cáo (nội bộ) | 3 | Đã triển khai (YCTD-129): màn hình chung cho bảy biểu (thẻ tính từ dữ liệu chỉ xem; thẻ nhập tay có Lấy dữ liệu, Lấy dữ liệu năm trước, Ghi; khóa khi đã đánh dấu đã gửi; Xuất Excel in tên đơn vị hành chính); 1.1 thẻ Ngân sách nhà nước; 1.2 Báo cáo cơ sở vật chất năm thẻ; 1.3 cột theo Sở; 2.1 Báo cáo EMIS cuối năm sáu mục I đến VI; 2.2 Báo cáo đội ngũ ba thẻ; 2.3 Đề án ngoại ngữ hai thẻ, đánh dấu trường không có dữ liệu; 2.4 Báo cáo giáo dục mầm non cuối năm; danh sách gửi báo cáo bảy biểu kèm số đã gửi, số cần gửi, lần gửi cuối, Xuất file lỗi (bản chạy nội bộ, không truyền lên Bộ, Sở); tên, mã số chỉ tiêu chờ đối chiếu biểu mẫu chính thức |
| 16k | Phân hệ Quản lý kí hồ sơ (nội bộ): chứng thư số nhà trường, ảnh con dấu, tạo hồ sơ PDF, xác nhận hoàn thành, khóa hồ sơ | 3 | Đã triển khai (YCTD-130): phân hệ "Quản lý kí hồ sơ"; 1.1 Chứng thư số nhà trường (thông tin chứng thư, không lưu mật khẩu; ảnh con dấu; Đăng ký kí nội bộ); 2.1 Đồng bộ chứng thư số (Đánh dấu đã đồng bộ); 2.2 Kí hồ sơ trường, lớp, nhân sự, học sinh, sổ đầu bài theo tháng (Tạo hồ sơ PDF kèm mã định danh hồ sơ và mã băm, Kí xác nhận nội bộ, Tải thông tin thay đổi, Hủy hồ sơ, Xuất dữ liệu sổ đầu bài); 2.3 Xác nhận hoàn thành, Hủy xác nhận, Tải tệp gửi, Đánh dấu đã gửi; không có chữ ký số thật, chỗ nối `DossierSigner` để nối nhà cung cấp kí số sau; nội dung hồ sơ chưa đối chiếu mẫu của Sở |

Lượt 2 bắt đầu khi phần 16a đã gộp và dùng lại công cụ của phần này; lượt 3 bắt đầu khi lượt 2 đã gộp. Mỗi phần ghi YCTD, chạy đủ kiểm thử đơn vị và e2e, mở PR, gộp khi mọi kiểm tra CI đạt; các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần.

## 8. Theo khảo sát bổ sung ngày 2026-10-19 (DT-17)

### 8.1 Căn cứ

1. Khảo sát bổ sung ở `31_KHAO_SAT_HE_THONG_SO.md` mục 10: phân hệ Tuyển sinh đầu cấp, mẫu nội dung bốn loại hồ sơ kí, tên và mã số chỉ tiêu của các biểu EMIS, màn hình 1.7. Bảng chênh lệch với mã nguồn ở mục 10.7 của tài liệu đó (mã E1–E11, K1–K10, R1–R5).
2. Quyết định của Eric ngày 2026-10-16 (mục 7) vẫn áp dụng: làm đủ mọi tính năng đã khảo sát; tính năng cần hệ thống ngoài làm bản chạy nội bộ (trạng thái đánh dấu tay, tệp xuất, PDF) và giữ chỗ nối để cắm kết nối thật. Phân hệ Tuyển sinh đầu cấp nay đã khảo sát nên làm ở DT-17, thay dòng "chờ khảo sát" ở mục 7.
3. Phân hệ Hồ sơ điện tử không làm ở DT-17: tài khoản trường không được cấp phân hệ này nên không có màn hình để làm theo (tài liệu 31 mục 10.6). Khi Sở cấp phân hệ cho tài khoản thì khảo sát tiếp.
4. Các lựa chọn ở mục 8.2 đến 8.4 do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

### 8.2 Các phần

Số migration ghi theo thứ tự dự kiến; mỗi phần giữ sẵn số riêng để làm song song (kho mã đã bật `allowUnorderedMigrations`, không đánh lại số sang dải của phần khác). Hiện nhánh chính có tệp năm học đến 0059, tệp hệ thống đến 0016, tệp định danh đến 0049.

| Phần | Phạm vi | Migration dự kiến | Phụ thuộc | YCTD giữ sẵn |
|---|---|---|---|---|
| 17a | EMIS theo đúng chỉ tiêu và mã số của Sở (E1–E11) | Năm học 0060 | Đọc các ô hồ sơ trường do 17e thêm (mục 8.3, 17e); gộp sau 17e | YCTD-132 |
| 17b | Kí hồ sơ theo bốn mẫu thật, danh sách nhà phát hành, ẩn sổ đầu bài ở cấp Mầm non (K1–K10) | Hệ thống 0017 | Không | YCTD-133 |
| 17c | Tuyển sinh đầu cấp phần 1: phân hệ, hồ sơ cuối cấp, cổng phụ huynh xác nhận hồ sơ, các màn hình phụ | Năm học 0061; định danh 0050 | Không | YCTD-134 |
| 17d | Tuyển sinh đầu cấp phần 2: tiếp nhận hồ sơ, thông báo, chuyển hồ sơ trúng tuyển sang CSDL trường nội bộ | Năm học 0062; định danh 0051 | Sau khi 17c gộp (dùng phân hệ, cây menu, quyền của 17c) | YCTD-135 |
| 17e | Chỉnh 1.7 Rà soát thông tin kiểm định CLGD (R1–R5) và các ô hồ sơ trường liên quan | Năm học 0063 | Không | YCTD-136 |

Lượt làm (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, theo bài học của DT-16 là chạy tối đa hai phiên cùng lúc): lượt 1 gồm 17e và 17b (nhỏ, không phụ thuộc); lượt 2 gồm 17a và 17c; lượt 3 là 17d. Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH) không trùng: 17e, 17b, 17a, 17c, 17d; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. Mã YCTD giữ sẵn ở bảng trên không đổi theo thứ tự gộp.

### 8.3 Phạm vi chi tiết

#### 17a. EMIS theo chỉ tiêu và mã của Sở

- Biểu 01.ĐN-MN năm thẻ như Sở (gộp thẻ "Học sinh theo độ tuổi" vào thẻ Trẻ em): Trường – Lớp, Trẻ em, Đội ngũ, Cơ sở vật chất, Ngân sách nhà nước; đủ dòng, tên chỉ tiêu, mã số 01 đến 217 và đơn vị như tài liệu 31 mục 10.4.2; cột riêng từng thẻ (thẻ 1 theo loại hình; thẻ 2 Tổng, Nữ của tổng số và của dân tộc thiểu số; thẻ 3 Tổng số, Nữ, Dân tộc và bốn cột phân loại hợp đồng; thẻ 4 Kiên cố, Bán kiên cố, Tạm). Bỏ cảnh báo "mã số do hệ thống đặt".
- Thẻ 5 theo Biểu 08.ĐN-NSNN: hai cột Dự toán, Ước thực hiện; mã 1 đến 71. Các dòng mã 24 đến 55 chưa có tên trong khảo sát: hiện theo cách chia giống mục 1 với nhãn "Mục 2" đến "Mục 5" và ghi chú chờ đối chiếu.
- Tính từ dữ liệu sẵn có: tiêu chí trường từ hồ sơ trường (điện, internet, máy tính, nước uống, vệ sinh, rửa tay, chương trình giới tính, kế hoạch phòng chống thiên tai, mức chuẩn quốc gia); nhóm, lớp theo nhóm tuổi, ghép 2, 3 độ tuổi, số trẻ khuyết tật trong lớp; trẻ học 2 buổi, bán trú, khuyết tật, độ tuổi theo tháng; dinh dưỡng theo thể từ lần cân đo gần nhất trong học kỳ I; đội ngũ theo nhóm chức vụ, vị trí việc làm, trình độ, hạng chức danh, độ tuổi, hình thức hợp đồng theo danh mục Bộ (16f); phòng theo loại và hiện trạng. Dòng không có dữ liệu để 0 và ghi lý do ở danh sách cảnh báo.
- Dữ liệu thêm (năm học 0060): đối tượng chính sách theo từng nghị định của trẻ (NĐ 238/2025 Điều 17, NĐ 66/2025, NĐ 57/2017, NĐ 105/2020 ăn trưa, trợ cấp); kiêm nhiệm hỗ trợ giáo dục người khuyết tật, kiêm nhiệm vị trí dùng chung của nhân sự; cờ "xây dựng mới trong năm" của phòng; xóa số liệu nhập tay đã ghi theo mã cũ của thẻ Ngân sách và Đề án ngoại ngữ (chưa có đơn vị nào nộp thật).
- 1.2.1 Cơ sở vật chất TP.HCM thẻ 1: sáu khối A đến F, mã 01 đến 84, cột Tổng số, Kiên cố (Tổng số, Xây dựng mới), Bán kiên cố (Tổng số, Xây dựng mới), Tạm; đối chiếu loại phòng của mình sang dòng của Sở bằng bảng ánh xạ trong mã. Thẻ 2 đến 5 giữ như 16j, ghi chú chưa đối chiếu.
- 2.1 EMIS cuối năm theo cấu trúc Sở: I Trường, II Nhóm lớp, III Trẻ em (quy mô, dinh dưỡng), VI Cán bộ quản lý, giáo viên, nhân viên (chuẩn nghề nghiệp theo mức, nghỉ hưu, tuyển mới trong năm theo ngày nghỉ việc, ngày vào làm). Bỏ các mục tự đặt không có ở Sở.
- 2.2 Báo cáo đội ngũ ba biểu như Sở: 2.2.1 hai thẻ với bốn cách chia (trình độ, độ tuổi, hạng chức danh, đánh giá viên chức theo NĐ 90), giáo viên dạy giỏi theo cấp, nhân viên theo vị trí; 2.2.2 ngoại ngữ khung 6 bậc, tin học; 2.2.3 xếp loại chung và từng tiêu chí 1–18 (CBQL), 1–15 (giáo viên) từ phiếu đánh giá chuẩn nghề nghiệp đã chốt.
- 2.3 Đề án ngoại ngữ năm chỉ tiêu; chỉ tiêu 1 đến 4 tính, chỉ tiêu 5 nhập tay vào cột Tổng số, có nút Ghi.
- 2.4 GDMN cuối năm: ở học kỳ I hiện trống như Sở.
- Trang gửi như 1.1.2: lưới hồ sơ (hồ sơ trường, giáo viên, lớp, học sinh, sức khỏe nuôi dưỡng kỳ I; tổng số, số đã gửi, số cần gửi, lần gửi cuối) và lưới biểu (năm dòng Biểu 01, Biểu 08 với "Đã đầy đủ dữ liệu", "Không có dữ liệu"); nút Gửi hồ sơ (xuất tệp và đánh dấu đã gửi, bản chạy nội bộ), Xuất file lỗi, Đặt trạng thái gửi lại, Hủy; trang lập có "Xóa dữ liệu" (xóa số liệu nhập tay chưa gửi). 1.2.2 chỉ có "Gửi dữ liệu". Số đã gửi của hồ sơ lấy từ 2.3 của phân hệ kí (17b) nếu đã gộp, chưa có thì từ trạng thái gửi của phần 16a.

#### 17b. Kí hồ sơ theo bốn mẫu thật

- Ẩn thẻ "Sổ đầu bài" ở 2.2 và nút "Xuất dữ liệu sổ đầu bài" ở 2.2, 2.3 vì cấp Mầm non của Sở ẩn hai nút này; máy chủ từ chối tạo hồ sơ sổ đầu bài mới; hồ sơ sổ đầu bài đã có vẫn xem, tải, xác nhận được để không mất dữ liệu. Giữ loại `class_log` trong mã cho cấp học khác sau này.
- Nội dung tệp theo đúng phần và mục của tài liệu 31 mục 10.3.3: hồ sơ trường (thông tin chung và mỗi điểm trường một phần), hồ sơ lớp (không còn danh sách học sinh, giáo viên), hồ sơ nhân sự mười hai phần (lấy từ hồ sơ nhân sự, danh mục Bộ, quá trình công tác, khen thưởng, chuẩn nghề nghiệp, lương đã có; mục chưa có dữ liệu để trống), hồ sơ học sinh hai phần. Thứ tự mục theo Sở.
- Số định danh, CCCD, sổ BHXH in đủ theo mẫu vì hồ sơ là bản nộp cơ quan quản lý; tạo và tải hồ sơ nhân sự, học sinh cần thêm quyền xem số định danh (`P02.national-id.view`), mọi lần tải ghi `export_logs`.
- Thêm tệp dữ liệu XML cho mỗi hồ sơ, gốc mang mã loại `HO_SO_TRUONG`, `HO_SO_LOP`, `HO_SO_NHAN_SU`, `HO_SO_HOC_SINH`; lược đồ tự đặt theo tên mục, có chỗ nối để thay bằng lược đồ của Bộ. Cửa sổ "Xem hồ sơ kí" hai khung: "Thông tin chữ ký số" (người kí, thời điểm, chứng thư, mã băm) và nội dung hồ sơ; Tải xuống, In.
- Chứng thư số: kiểu chữ ký hai giá trị (Kí từ xa, USB token; chứng thư kiểu HSM đã có chuyển thành Kí từ xa và ghi lịch sử); nhà phát hành chọn trong VNPT-CA, BkavCA, VIETTEL, Ban Cơ yếu Chính phủ, MISA (giá trị cũ ngoài danh sách giữ lại, hiện cảnh báo, phải chọn lại mới đăng ký kí nội bộ); 1.1 hiện mã trường, tên trường, email, website từ hồ sơ trường; lịch sử yêu cầu đăng ký. Vẫn không nhận, không lưu mật khẩu.
- Lưới 2.2: trạng thái "Chờ ký" thay "Đã tạo, chưa kí"; cột ghi chú; cột riêng theo loại (tên hiệu trưởng; khối; ngày sinh, trạng thái nhân sự, vị trí việc làm; mã học sinh, ngày sinh, lớp, trạng thái học sinh); lọc khối ở lớp, khối và lớp ở học sinh; "Tải file lỗi" (đối tượng tạo hồ sơ không được kèm lý do). Lưới 2.3 theo cột của Sở.
- Chỗ nối `DossierSigner` giữ nguyên; hộp kí có ô nhà phát hành, tên đăng nhập; "Đăng nhập và kí" chỉ hiện khi có nhà cung cấp thật.

#### 17c. Tuyển sinh đầu cấp phần 1

- Phân hệ mới "Tuyển sinh đầu cấp" trên ô chọn phân hệ, đặt sau "Cơ sở vật chất, TBDH" như thứ tự ở 1.2 Phân quyền nhóm theo phần mềm; cây menu đánh số như tài liệu 31 mục 10.2.2 (17c dựng đủ 15 mục, các mục của 17d hiện khi 17d gộp). Không làm trang và đăng nhập riêng như `truong-tsdc`: dùng chung đăng nhập, ô "Cấp · Năm học · Học kỳ". Phân hệ "Tuyển sinh, tuyển dụng" riêng của mình giữ nguyên.
- 1.1 Hồ sơ học sinh cuối cấp: lấy trẻ đang học lớp mẫu giáo 5–6 tuổi; đủ lọc, cột, nhãn, nút như Sở. Trạng thái hồ sơ sáu giá trị và luồng: trường gửi hồ sơ, phụ huynh xác nhận hoặc đề xuất sửa, trường chỉnh và bấm "Đã chỉnh sửa thông tin", phụ huynh xác nhận lại; Duyệt, Hủy duyệt. Kiểm dò là kiểm tra các mục bắt buộc (định danh, nơi ở hiện tại, liên hệ, giấy khai sinh, ảnh cư trú) kèm nội dung thiếu. Hạn điều chỉnh thông tin do trường đặt. Cập nhật từ Excel và Tải danh sách lỗi dùng công cụ nhập chung (16a). Sáu nút Xuất PDF (A5, A4 gập đôi, toàn bộ hoặc hồ sơ chọn, một tệp hoặc tách tệp nén), In phiếu kê khai, In phiếu thông tin. "Thông tin tài khoản", "Khởi tạo mật khẩu" dùng tài khoản phụ huynh sẵn có. Trường phân tuyến, đối tượng, hình thức ưu tiên, nguồn đăng ký, vị trí nhập tay (bản chạy nội bộ, không có kết nối phân tuyến của Sở).
- Cổng phụ huynh (ứng dụng phụ huynh): màn hình "Hồ sơ cuối cấp" xem hồ sơ của con, Xác nhận, Đề xuất sửa (ghi nội dung), tải ảnh giấy khai sinh, ảnh thông tin cư trú trên VNeID, minh chứng; đồng ý nhập học; gửi yêu cầu hỗ trợ tuyển sinh.
- 1.2 Gửi xác nhận hoàn thành hồ sơ cuối cấp: lưới theo lớp và ô xác nhận, người, ngày; bấm Ghi là trạng thái đánh dấu tay, xuất tệp danh sách để nộp.
- 4.1 Thống kê hồ sơ cuối cấp: theo đơn vị (trường chính, phân hiệu), Xuất Excel.
- 1.8 Thông tin trường theo bản đồ: vĩ độ, kinh độ, khu phố của trường và từng điểm trường, trạng thái kiểm dò; "Xem vị trí" mở bản đồ ngoài theo tọa độ ở thẻ mới, không nhúng thư viện bản đồ.
- 2.1 Dịch vụ đăng ký tại trường: danh mục mã, tên, thứ tự; nối với danh mục dịch vụ của phân hệ Tài chính – học phí khi trùng mã.
- 3.1 đến 3.4: hiển thị nhóm người dùng, người dùng, nhân sự, lớp sẵn có theo cột của Sở; không có "Đồng bộ dữ liệu" vì dùng chung cơ sở dữ liệu.
- 5.1 Danh sách hỗ trợ tuyển sinh: yêu cầu của phụ huynh, trả lời, trạng thái, người trả lời, thời gian; "Gửi email" là gửi câu trả lời qua kênh thông báo của ứng dụng phụ huynh, thư điện tử khi có cấu hình gửi thư.
- Dữ liệu (năm học 0061): hồ sơ cuối cấp và lịch sử trạng thái, tệp đính kèm, xác nhận hoàn thành theo lớp, yêu cầu hỗ trợ, danh mục dịch vụ, tọa độ của đơn vị; quyền mới của phân hệ (định danh 0050).

#### 17d. Tuyển sinh đầu cấp phần 2

- 1.4 Tiếp nhận hồ sơ tuyển sinh: nguồn là danh sách phân tuyến nhập từ Excel (bản chạy nội bộ thay kết nối phân tuyến của Sở) và hồ sơ đã đạt của tuyển sinh trực tuyến (YCTD-86); đủ lọc, cột, ô tích giấy tờ đã nộp, phụ huynh đồng ý hoặc từ chối nhập học; Lưu dữ liệu, Tải phiếu thông tin, In phiếu đăng ký, Hủy nhập học. Đợt tuyển sinh dùng bảng đợt tuyển sinh sẵn có, thêm loại hình (đại trà, tiên tiến, khảo sát).
- 1.3 Danh sách đăng ký trường tiên tiến: tiêu chí, kết quả học tập và thành tích, minh chứng, trạng thái trường duyệt và xã/phường đồng ý (nhập tay); Xác nhận hồ sơ, Không đồng ý, Chưa xác nhận, Tải minh chứng, In phiếu.
- 1.5 Gửi thông báo tuyển sinh đầu cấp: soạn nội dung, lọc người nhận như Sở, gửi qua kênh thông báo của ứng dụng phụ huynh và Zalo OA đã có, trạng thái đã gửi theo người; Nhập từ Excel, Nhập từ Excel học sinh ngoài hệ thống, Sao chép nội dung. Tin nhắn SMS để chỗ nối nhà cung cấp.
- 1.6 Chuyển hồ sơ trúng tuyển sang CSDL: tạo hồ sơ học sinh trong cơ sở dữ liệu của năm học của đợt tuyển sinh (năm học đó phải đã tạo, chưa có thì báo lỗi), mỗi lần chuyển một mã gói tin, mỗi hồ sơ một mã GUID; loại hồ sơ có tài khoản (đã có tài khoản phụ huynh) hoặc tự do; thẻ xem kết quả; hỏi trước khi xóa lớp đã xếp.
- 1.7 Danh sách kết quả chuyển hồ sơ: hai thẻ kết quả chuyển, kết quả hủy nhập học; Hủy nhập học chỉ với hồ sơ học sinh chưa phát sinh dữ liệu.
- 5.11 Danh sách trúng tuyển ở phân hệ Mầm non: bước 1 xếp lớp, bước 2 chuyển sang hồ sơ học sinh, dùng chung xử lý của 1.6.
- Dữ liệu (năm học 0062): thêm cột cho đợt và hồ sơ tuyển sinh (diện cư trú, số định danh, nơi ở hiện tại, trường và phường/xã cuối cấp, giấy tờ đã nộp, đồng ý nhập học, loại hồ sơ, mã gói tin, mã GUID, kết quả chuyển), bảng thông báo đã gửi; quyền thêm (định danh 0051).

#### 17e. Chỉnh 1.7 Rà soát thông tin kiểm định CLGD

- Thêm ô như Sở: tên trường (bắt buộc, tối đa 200 ký tự), mã trường (bắt buộc, tối đa 20 ký tự), loại hình (bắt buộc), cấp học (Mầm non), năm và ngày công nhận chuẩn quốc gia, mức độ, năm và ngày công nhận kiểm định CLGD, cấp độ, thời điểm đăng ký chuẩn quốc gia. "Lấy dữ liệu" điền từ hồ sơ trường; sửa được trước khi Ghi.
- Hồ sơ trường thêm các ô tương ứng ở thẻ Thông tin chung với khóa đặt trước để 17a dùng: `national_standard_level`, `national_standard_year`, `national_standard_date`, `national_standard_registration`, `accreditation_level`, `accreditation_year`, `accreditation_date`, `floor_area_m2` (diện tích sàn xây dựng); không cần migration vì hồ sơ trường lưu theo thẻ.
- Cách tính: diện tích sàn xây dựng lấy ô `floor_area_m2` của hồ sơ trường, chưa nhập thì tổng diện tích các phòng đang dùng như hiện tại; thêm "Diện tích sàn xây dựng/Học sinh" bên cạnh "Diện tích đất/Học sinh", cùng cách làm tròn hai chữ số. Ghi chú tối đa 500 ký tự, nhãn như Sở.
- Dữ liệu (năm học 0063): thêm cột vào `accreditation_reviews`.

### 8.4 Quy ước chung của DT-17

- Mỗi phần ghi YCTD giữ sẵn ở mục 8.2, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 14, 16, 17, 21, 23, 24, 32, `index.md` khi có thay đổi tương ứng), chạy đủ kiểm thử đơn vị và e2e, mở PR, gộp khi mọi kiểm tra CI đạt.
- Không ghi dữ liệu thật của trường vào mã, dữ liệu mẫu hay kiểm thử.
- Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần.

### 8.5 Tiến độ

| Phần | Tiến độ |
|---|---|
| 17a | Đã triển khai (YCTD-132, PR 112, phiên bản 0.86.0): Biểu 01.ĐN-MN năm thẻ mã 01 đến 217 và Biểu 08.ĐN-NSNN mã 1 đến 71 theo cột của Sở; 1.2.1 thẻ 1 mã 01 đến 84 có cột Xây dựng mới; 2.1, 2.2, 2.3 theo cấu trúc của Sở, 2.4 trống ở học kỳ I; "Xóa dữ liệu" của thẻ nhập tay; trang 1.1.2 Gửi báo cáo đầu năm (lưới hồ sơ, lưới biểu mẫu, Gửi hồ sơ, Xuất file lỗi, Đặt trạng thái gửi lại, Hủy) chạy nội bộ; ô chính sách của trẻ, kiêm nhiệm của nhân sự, xây dựng mới của phòng; migration năm học 0060; Biểu 08 mã 24 đến 55 và khối B của 1.2.1 chờ đối chiếu |
| 17b | Đã triển khai (YCTD-133, PR 110, phiên bản 0.85.0): bốn mẫu hồ sơ, tệp XML, nhà phát hành, kiểu chữ ký, bỏ sổ đầu bài ở cấp Mầm non, lưới 2.2, 2.3 theo Sở; hồ sơ nhân sự, học sinh in đủ số định danh với người có quyền xem số định danh (quyết định của Eric ngày 2026-10-19) |
| 17c | Đã triển khai (YCTD-134, PR 113, phiên bản 0.87.0): phân hệ "Tuyển sinh đầu cấp" (13 phân hệ), cây menu 1.1, 1.2, 1.8, 2.1, 3.1–3.4, 4.1, 5.1 (1.3–1.7 chờ 17d); 1.1 hồ sơ cuối cấp tự lập cho trẻ lớp năm cuối cấp, luồng sáu trạng thái, kiểm dò năm mục, hạn điều chỉnh, Xác nhận hồ sơ thay phụ huynh, Duyệt, Hủy duyệt, Cập nhật từ Excel, Xuất Excel, PDF A5, A4 gập đôi, tệp nén, phiếu kê khai, phiếu thông tin, Khởi tạo mật khẩu phụ huynh; màn hình Hồ sơ cuối cấp của ứng dụng phụ huynh; 1.2 đánh dấu tay kèm xuất Excel; 1.8 tọa độ, Xem vị trí trên OpenStreetMap; 2.1 dịch vụ tại trường; 3.1–3.4 chỉ hiển thị; 4.1 theo đơn vị của trẻ; 5.1 trả lời qua ứng dụng phụ huynh, thư điện tử chờ nhà cung cấp; migration năm học 0061, định danh 0050; không kết nối phân tuyến của Sở; kiểm thử giao diện CT-17c-13 đạt |
| 17d | Đã triển khai (YCTD-135, PR 114, phiên bản 0.88.0): 1.3 trường tiên tiến (Xác nhận hồ sơ, Không đồng ý, Chưa xác nhận, trạng thái xã/phường nhập tay, Tải minh chứng, In phiếu); 1.4 tiếp nhận hồ sơ phân tuyến nhập từ Excel và hồ sơ đạt của tuyển sinh trực tuyến, giấy tờ đã nộp, đồng ý nhập học, Lưu dữ liệu, phiếu thông tin, phiếu đăng ký, Hủy nhập học; đợt thêm loại hình, năm học nhận trẻ; 1.5 thông báo qua ứng dụng phụ huynh và Zalo OA, học sinh ngoài hệ thống, SMS chờ nhà cung cấp; 1.6 chuyển hồ sơ thành hồ sơ học sinh ở năm học đang mở, mã gói tin, mã GUID, hỏi xóa lớp đã xếp; 1.7 kết quả chuyển, Hủy nhập học hồ sơ chưa phát sinh dữ liệu; 5.11 xếp lớp rồi chuyển; mở năm học mới chép giấy tờ theo hồ sơ tuyển sinh; migration năm học 0062, định danh 0051; không kết nối phân tuyến của Sở; kiểm thử giao diện CT-17d-11 đạt |
| 17e | Đã triển khai (YCTD-136, PR 111): 1.7 đủ ô như Sở trong năm khối (tên trường, mã trường, loại hình bắt buộc, cấp học Mầm non; năm, ngày công nhận và mức độ chuẩn quốc gia; năm, ngày công nhận và cấp độ kiểm định CLGD; diện tích sàn xây dựng/học sinh; thời điểm đăng ký chuẩn quốc gia; ghi chú tối đa 500 ký tự có bộ đếm); Lấy dữ liệu điền từ cây đơn vị và hồ sơ trường; hồ sơ trường thêm tám ô khóa cố định cho 17a; migration năm học 0063; thời điểm đăng ký là chữ tự do do chưa biết định dạng của Sở |

DT-17 hoàn tất.

## 9. DT-18: điều hành nhà trường

### 9.1 Căn cứ

1. Quyết định của Eric ngày 2026-10-19:
   - Lộ trình sau DT-17: DT-18 → DT-19 (nền đa cấp học) → DT-20 (Tiểu học) → DT-21 (THCS, THPT) → DT-22 → DT-SaaS.
   - Sổ văn bản đến, đi, giao việc, lịch, hồ sơ công việc làm theo hệ thống quản lý văn bản và điều hành VNPT iOffice mà các trường công lập TP.HCM đang dùng.
   - KPI chuyển hẳn hệ thống KPI của Eric vào School Management (viết lại thành phân hệ NestJS, Kysely, PostgreSQL, dùng chung tài khoản, đơn vị, nhân sự, phân quyền, thông báo, tệp, nhật ký); hệ thống cũ không phát triển tiếp.
   - Mỗi trường một tên miền riêng cho website; có chế độ trình diễn.
   - Ký số giữ bản chạy nội bộ, có chỗ nối để cắm nhà cung cấp thật.
   - Bốn phần của DT-22 chạy ở đợt 5 của DT-18: 22b bán trú, kiểm thực và an toàn thực phẩm; 22i kế hoạch giáo dục; 22d thi đua, khen thưởng cán bộ, giáo viên; 22f bảo đảm chất lượng, tự đánh giá. AI gợi ý làm thành phần riêng, tắt mặc định.
2. Khảo sát VNPT iOffice ngày 2026-10-19: Eric đăng nhập, Claude chỉ đọc menu, màn hình danh sách và biểu mẫu thêm mới còn trống; không mở văn bản, không bấm Ghi. Ghi chép lưu ngoài kho, không có nội dung văn bản, tên người hay số liệu. Phiên làm 18a, 18b, 18c đọc ghi chép đó trước khi viết phạm vi chi tiết vào YCTD của phần.
3. Hồ sơ chuyên môn, Việc của tôi, thiết bị có tem QR, website trường, đăng nhập thay, xuất toàn bộ dữ liệu, trang chọn vai lấy mẫu theo mô tả công khai của GIKIDI Nhà Trường. Không sao chép nguyên văn, hình ảnh, tên gọi riêng của sản phẩm đó.
4. Các lựa chọn ở mục 9.2 đến 9.5 do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

### 9.2 Nguyên tắc chung của DT-18

- **Bản chạy nội bộ:** tính năng cần hệ thống ngoài (liên thông văn bản qua trục, gửi SMS, ký số của nhà cung cấp, trỏ tên miền) làm đủ màn hình và nút; bước cần kết nối thay bằng trạng thái đánh dấu tay (ngày, người thực hiện) và tệp xuất; để sẵn chỗ nối để cắm kết nối thật sau.
- **Viết sẵn cho đa thuê bao:** không thêm biến `.env` riêng của trường; không ghi cứng tên miền, tên trường hay mã trường trong mã; cấu hình của trường lưu trong cơ sở dữ liệu; khóa Redis và đường dẫn S3 tạo qua hàm dùng chung.
- **Viết sẵn cho đa cấp học:** danh mục, mẫu và tiêu chí có cột cấp học; dữ liệu mặc định có bản Mầm non, các cấp khác thêm bằng danh mục sau DT-19, không đổi mã. Không ghi cứng "Mầm non" trong luồng nghiệp vụ.
- **AI là thành phần riêng, tắt mặc định:** chỉ gợi ý, người dùng duyệt trước khi ghi; chỉ dùng dữ liệu đã khử định danh; không gửi dữ liệu trẻ em ra dịch vụ ngoài. Các phần chạy đủ khi AI tắt. **Cập nhật 2026-10-26:** Eric đồng ý đưa AI vào; phạm vi cho phép là phần 23d của DT-23 (mục 15): chỉ soạn bản nháp câu hỏi và kế hoạch bài dạy, chỉ gửi nội dung chương trình, tắt mặc định theo trường.
- **Ký số chạy nội bộ:** dùng quy trình kí nội bộ của phân hệ Quản lý kí hồ sơ (16k, 17b) và chỗ nối `DossierSigner`; văn bản đã kí có mã QR tra cứu. Không nhận, không lưu mật khẩu chứng thư.
- **Dữ liệu thật:** không ghi dữ liệu thật của trường, người hay văn bản vào mã, dữ liệu mẫu, kiểm thử hay tài liệu.

### 9.3 Các phần

Số migration ghi theo thứ tự dự kiến; mỗi phần giữ sẵn số riêng để làm song song (kho mã đã bật `allowUnorderedMigrations`, không đánh lại số sang dải của phần khác). Phần nào không cần số đã giữ ở một cơ sở dữ liệu thì để trống số đó, không cho phần khác dùng. Hiện nhánh chính có tệp năm học đến 0063, tệp hệ thống đến 0017, tệp định danh đến 0051; sổ yêu cầu thay đổi đến YCTD-137.

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD giữ sẵn | Migration giữ sẵn |
|---|---|---|---|---|---|
| 18a | Văn bản đến theo VNPT iOffice: sổ văn bản đến, vào sổ, luồng xử lý, phiếu, đơn vị bên ngoài | 1 | Không | YCTD-138 | Hệ thống 0018; định danh 0052 |
| 18b | Văn bản đi theo VNPT iOffice: dự thảo, lấy ý kiến, trình ký, ký nội bộ, cấp số, phát hành, sổ văn bản đi, liên thông nội bộ | 2 | Sau khi 18a gộp (dùng sổ, đơn vị bên ngoài, luồng chuyển của 18a); kí nội bộ 16k, 17b | YCTD-140 | Hệ thống 0019; định danh 0054 |
| 18c | Giao việc, lịch đơn vị, phòng họp, hồ sơ công việc, báo cáo xử lý văn bản | 2 | Sau khi 18a gộp (tạo việc từ văn bản đến); mở rộng Quản lý công việc đã có; nối văn thư lưu trữ 15h2 | YCTD-141 | Năm học 0065; hệ thống 0020; định danh 0055 |
| 18d | KPI: chuyển hệ thống KPI của Eric vào, hai bộ quy tắc chấm cấu hình được | 1 | Không (ô minh chứng số ký hiệu văn bản nối với 18b khi 18b gộp) | YCTD-139 | Năm học 0064; định danh 0053 |
| 18e | Hồ sơ chuyên môn (kho, đợt nộp, luồng duyệt) và Việc của tôi | 3 | Sau đợt 2 (Việc của tôi gom việc chờ của 18a, 18b, 18c, 18d); kí nội bộ | YCTD-142 | Năm học 0066; định danh 0056 |
| 18f | Website trường trên tên miền riêng | 4 | Sau 18b (văn bản công khai); tuyển sinh YCTD-86, 17c, 17d; trang thời khoá biểu chờ 22c (DT-20) | YCTD-144 | Hệ thống 0021; định danh 0058 |
| 18g | Thiết bị: nơi để, tem QR, kiểm kê bằng điện thoại, đối sánh danh mục tối thiểu theo cấp học | 3 | Thiết bị đã có (YCTD-106) | YCTD-143 | Năm học 0067; định danh 0057 |
| 18h | Quản trị và trình diễn: đăng nhập thay, gói ZIP toàn bộ dữ liệu, môi trường trình diễn | 4 | Dữ liệu giả của trình diễn phủ các phần đã gộp đến lúc làm | YCTD-145 | Hệ thống 0022; định danh 0059 |
| 22b | Bán trú: kiểm thực, lưu và hủy mẫu, lô hàng, hồ sơ an toàn thực phẩm của nhà cung cấp, truy xuất | 5 | Bếp, kho đã có; rà mã tiền ăn (`fees`) trước khi viết phạm vi chi tiết | YCTD-146 | Năm học 0068; định danh 0060 |
| 22d | Thi đua, khen thưởng cán bộ, giáo viên | 5 (sau 22b, 22i) | 18d (KPI làm đầu vào), 18e (kho minh chứng) | YCTD-148 | Năm học 0070; định danh 0062 |
| 22f | Bảo đảm chất lượng, tự đánh giá | 5 (sau 22b, 22i) | 17e (1.7), 18e (kho hồ sơ), kế hoạch của Quản lý công việc | YCTD-149 | Năm học 0071; định danh 0063 |
| 22i | Kế hoạch giáo dục: thư viện mẫu, phiên bản theo năm, duyệt nhiều cấp, kí nội bộ | 5 | 18e (luồng duyệt, kho tệp), 17b (kí) | YCTD-147 | Năm học 0069; định danh 0061 |

Đợt làm, mỗi lúc tối đa hai phiên:
- Đợt 1: 18a và 18d.
- Đợt 2: 18b và 18c, bắt đầu khi 18a đã gộp.
- Đợt 3: 18e và 18g, bắt đầu khi đợt 2 đã gộp (18g không phụ thuộc, có thể bắt đầu sớm hơn khi còn phiên trống).
- Đợt 4: 18f và 18h.
- Đợt 5: 22b và 22i, rồi 22d và 22f. 22d và 22f cần 18d, 18e đã gộp; 22b độc lập nên có thể chạy sớm hơn khi còn phiên trống, nhưng không chiếm phiên của 18d.

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH) không trùng theo đợt: 18a, 18d, 18b, 18c, 18e, 18g, 18f, 18h, 22b, 22i, 22d, 22f; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. Mã YCTD và số migration giữ sẵn ở bảng trên không đổi theo thứ tự gộp.

### 9.4 Phạm vi chi tiết

#### 18a. Văn bản đến

- Sổ văn bản đến theo năm và đơn vị: số bắt đầu, ngày áp dụng, người theo dõi, người quản trị.
- Vào sổ đủ các trường của biểu mẫu thêm mới: trích yếu, số ký hiệu, đơn vị ban hành, ngày văn bản, hình thức văn bản, độ khẩn, độ mật, thẩm quyền, loại (mới, thu hồi, thay thế), hình thức chuyển, hình thức sao, có bản giấy, tệp quét hoặc tải lên, văn bản liên quan, nội dung xử lý theo mẫu. Hình thức, độ khẩn, độ mật là danh mục cấu hình được.
- Luồng xử lý: trình lãnh đạo; chuyển xử lý (xử lý chính, phối hợp, xem để biết); chuyển trực tiếp; luân chuyển; trả lại; lấy lại; xin gia hạn; từ chối; kết thúc; kết thúc hàng loạt; lưu hồ sơ hàng loạt. Văn bản trả lời. Tạo việc từ văn bản (nối 18c khi 18c gộp). Hạn chế xem. Đánh dấu, theo dõi, xem để biết.
- In phiếu trình, phiếu xử lý, phiếu giao nhận; sơ đồ luồng văn bản; lịch sử tham mưu.
- Danh sách có tìm theo trích yếu, tìm nâng cao, lọc theo vai trò (xử lý chính, phối hợp, xem, tất cả); màu theo hỏa tốc, khẩn, chỉ đạo, quá hạn, đến hạn.
- Đơn vị bên ngoài và nhóm đơn vị ban hành.
- Liên thông qua trục văn bản: bản chạy nội bộ (nhập tay hoặc nhập tệp, đánh dấu đã nhận), chỗ nối cho trục liên thông.

#### 18b. Văn bản đi

- Dự thảo; lấy ý kiến và cho ý kiến; trình ký; ký hoặc không ký bằng quy trình kí nội bộ (16k, 17b), chèn mã QR tra cứu.
- Cấp số và phát hành theo sổ văn bản đi (ngày ban hành, người ký, đơn vị soạn thảo, số bản); văn bản gửi kèm, văn bản gốc, đơn vị dự kiến nhận; đóng băng văn bản đã phát hành.
- Công bố lên website trường (18f) hoặc ẩn; ô công bố lưu sẵn để 18f đọc.
- Gửi liên thông: bản chạy nội bộ (trạng thái đánh dấu tay và tệp xuất), chỗ nối cho trục liên thông. Văn bản gửi đơn vị nhận trong cùng hệ thống thì tự vào danh sách chờ vào sổ văn bản đến của đơn vị đó.

#### 18c. Giao việc và lịch

- Giao việc: lãnh đạo giao; nội dung; mức độ; số ngày thực hiện; tệp và văn bản liên quan; nhắc việc định kỳ; phân công theo cây đơn vị (xử lý chính, phối hợp, theo dõi; phòng ban hoặc cá nhân; ngày bắt đầu, hết hạn). Danh sách công việc cần xử lý, đã giao, theo trạng thái còn hạn, quá hạn, chờ phê duyệt. Mở rộng bảng việc của Quản lý công việc đã có, không tạo phân hệ việc thứ hai.
- Lịch đơn vị: đăng ký lịch tuần theo buổi sáng, chiều; phòng họp có duyệt và kiểm tra trùng; lịch họp theo tuần, tháng, của tôi; xuất PDF, Excel, in.
- Hồ sơ công việc: cá nhân, chia sẻ, chuyển giao; nối văn thư lưu trữ 15h2 (lưu hồ sơ, thời hạn bảo quản, hồ sơ hết hạn bảo quản).
- Báo cáo thực hiện và đánh giá xử lý văn bản đến, báo cáo tổng hợp, báo cáo thống kê trong đơn vị.

#### 18d. KPI

- Chuyển hệ thống KPI của Eric thành phân hệ của School Management, giữ đủ nghiệp vụ: danh mục công việc chuẩn nhập từ Excel; giao việc hoặc tự đăng ký kèm duyệt; minh chứng và số ký hiệu văn bản (chọn văn bản đi của 18b khi 18b gộp, trước đó nhập chữ); tiến độ tự tính theo hạn; ủy quyền chấm vượt cấp; biểu quyết; tư vấn; khóa và mở kỳ; các mẫu báo cáo xuất Excel, Word, PDF.
- **Hai bộ quy tắc chấm cấu hình được**, chọn theo đối tượng: bộ HD 06-HD/BTCTU (đã sửa đổi) và bộ NĐ 233/2026. Bộ NĐ 233/2026 là mặc định cho viên chức trường công lập và làm trước, vì hạn ban hành quy chế đánh giá của đơn vị là 30/11/2026.
- Máy chấm không ghi cứng tham số: loại công việc, điểm chuẩn, hệ số, thang mức, trọng số, công thức tổng hợp, điểm thưởng, ngưỡng và điều kiện xếp loại, hạn xác nhận, hạn chấm và cách xử lý khi quá hạn, giới hạn chuyển trả việc, lịch kỳ đều là cấu hình của bộ quy tắc, có phiên bản; kỳ đã khóa giữ phiên bản quy tắc đã dùng. Phiên làm 18d nhập các tham số chấm điểm cụ thể thành cấu hình.
- Bộ NĐ 233/2026 có tiêu chí và chỉ báo theo vị trí việc làm, theo cấp học; mẫu quy chế của đơn vị, phiếu theo dõi tháng, phiếu xếp loại năm sinh từ cấu hình.
- **Tài liệu nguồn hạn chế phát tán:** văn bản điều chỉnh bộ HD 06-HD/BTCTU là tài liệu của cơ quan Đảng có dòng chữ chìm cấm phát tán. Không đưa nguyên văn, phụ lục hay danh mục nhiệm vụ định hướng của văn bản đó vào kho mã, dữ liệu mẫu, kiểm thử hay `tai_lieu/`; chỉ đưa tham số chấm điểm dưới dạng cấu hình. Danh mục nhiệm vụ của đơn vị do trường tự nhập hoặc nhập từ Excel lúc dùng.
- Công cụ chuyển dữ liệu từ hệ thống cũ (danh mục, kỳ, việc, điểm) đọc tệp xuất do người dùng cung cấp lúc chạy. Không chép tệp dữ liệu nào của kho hệ thống cũ vào kho này.

#### 18e. Hồ sơ chuyên môn và Việc của tôi

- Kho hồ sơ dạng cây theo năm học, ba nhánh: cá nhân, tổ hoặc khối, trường. Danh mục thư mục mặc định theo từng cấp học (có bản Mầm non).
- Đợt nộp có hạn, bảng "ai chưa nộp", nhắc hạn. Luồng duyệt theo thư mục. Phiên bản khi nộp lại. Kí nội bộ. Khóa năm học. Nhóm công tác.
- Việc của tôi: gom mọi việc đang chờ người dùng ở văn bản đến, đi, giao việc, hồ sơ chuyên môn, KPI và các luồng duyệt, kí đã có, kèm nhắc quá hạn; mỗi phân hệ cung cấp nguồn việc qua một giao diện chung để phần sau tự thêm.

#### 18f. Website trường và tên miền riêng

- Trang công khai của từng trường, chọn trường theo tên miền của yêu cầu; tên miền lưu trong cơ sở dữ liệu, không ghi cứng, không thêm biến `.env` theo trường. Trỏ tên miền và cấp chứng chỉ là bước nhập tay của quản trị, có hướng dẫn.
- Đường dẫn con mặc định: giới thiệu, cơ cấu tổ chức, tin tức, thông báo, văn bản công khai (từ 18b), tuyển sinh, công khai theo quy định, thời khoá biểu (cấp phổ thông, chờ 22c), thư viện ảnh, đăng ký sự kiện qua QR.
- Nội dung soạn trong trang quản trị, có duyệt trước khi đăng; không hiện dữ liệu cá nhân của trẻ.

#### 18g. Thiết bị: tem QR và kiểm kê

- Nơi để; tem QR in A4; đợt kiểm kê bằng điện thoại (quét QR), duyệt, chốt chênh lệch; tỷ lệ sử dụng được.
- Đối sánh danh mục thiết bị tối thiểu theo cấp học (mầm non TT 02/2010 và văn bản sửa đổi; tiểu học TT 37/2021; THCS TT 38/2021; THPT TT 39/2021; cùng các thông tư sửa đổi). Danh mục là dữ liệu cấu hình theo cấp, đọc văn bản gốc trước khi nhập.

#### 18h. Quản trị và trình diễn

- Đăng nhập thay: chỉ quản trị, ghi nhật ký, thanh báo trên mọi trang khi đang đăng nhập thay; khi đăng nhập thay không thao tác được trên chứng thư số và mật khẩu.
- Gói ZIP toàn bộ dữ liệu của trường (tác vụ xuất nền của 16a), ghi `export_logs`.
- Môi trường trình diễn: dữ liệu giả, trang chọn vai, tự đặt lại dữ liệu định kỳ; bật bằng cấu hình của môi trường, không bao giờ trỏ vào dữ liệu thật.

#### 22b. Bán trú: kiểm thực và an toàn thực phẩm

- Kiểm thực ba bước hằng ngày; lưu, hủy mẫu thức ăn; lô hàng và hạn dùng; hồ sơ, giấy chứng nhận an toàn thực phẩm của nhà cung cấp; chứng từ giao hàng; nhật ký vệ sinh bếp; truy xuất khi có phản ánh; xử lý thực phẩm không đạt.
- Rà mã tiền ăn (`fees`: tính theo ngày ăn thực tế, hoàn trả, chuyển số dư) trước khi viết phạm vi chi tiết; ghi chênh lệch vào YCTD của phần.

#### 22i. Kế hoạch giáo dục

- Thư viện mẫu kế hoạch (năm học, tổ chuyên môn gồm dự giờ, thao giảng, giáo viên, chủ nhiệm, bài dạy) theo cấp học; phiên bản theo năm, kế thừa năm trước; duyệt nhiều cấp, bốn trạng thái; kí nội bộ; bảng tiến độ duyệt; xuất Word, PDF, Excel.

#### 22d. Thi đua, khen thưởng cán bộ, giáo viên

- Đợt xét; tiêu chí, trọng số có phiên bản; hồ sơ cá nhân và tập thể; kho minh chứng dùng chung với 18e; kết quả KPI của 18d làm đầu vào; hội đồng bình xét; phúc khảo; khiếu nại có hạn; danh hiệu và giấy khen có mã tra cứu; báo cáo nhiều năm. Đọc văn bản gốc về thi đua, khen thưởng trước khi viết phạm vi chi tiết.

#### 22f. Bảo đảm chất lượng, tự đánh giá

- Bộ tiêu chuẩn cấu hình được theo cấp học, trường tự nhập (tiêu chuẩn, tiêu chí, mức, yêu cầu minh chứng); có thể thêm bộ mẫu theo thông tư hiện hành sau khi đọc văn bản gốc.
- Tự đánh giá từng tiêu chí; minh chứng có mã, bốn trạng thái, kế thừa theo năm học (lấy từ kho hồ sơ 18e); kế hoạch cải tiến nối kế hoạch của Quản lý công việc; báo cáo tự động; theo dõi hiệu lực công nhận. Mở rộng 1.7 đã có (17e).

### 9.5 Quy ước chung của DT-18

- Mỗi phần ghi YCTD giữ sẵn ở mục 9.3, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 14, 16, 17, 21, 23, 24, 32, `index.md` khi có thay đổi tương ứng), chạy đủ kiểm thử đơn vị và e2e, mở PR, gộp khi mọi kiểm tra CI đạt.
- Căn cứ pháp lý của từng phần phải đọc văn bản gốc trước khi viết phạm vi chi tiết; riêng tài liệu hạn chế phát tán của 18d làm theo mục 9.4.
- Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần.

### 9.6 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| 18a | 1 | Đã triển khai (YCTD-138, PR 116, phiên bản 0.89.0): phân hệ Quản lý văn bản và điều hành; sổ văn bản đến, vào sổ theo biểu mẫu iOffice, luồng xử lý đủ nút, hạn chế xem, đánh dấu, theo dõi, phiếu trình, phiếu xử lý, phiếu giao nhận, sổ đăng ký; đơn vị bên ngoài, nhóm đơn vị ban hành, danh mục văn bản, lãnh đạo nhận văn bản; liên thông bản chạy nội bộ (chỗ nối `DocumentExchange`); hàm tạo tên khóa chung `storageKey`, `cacheKey`. Tạo việc từ văn bản chờ 18c; văn bản trả lời nối sổ văn bản đi khi 18b gộp |
| 18d | 1 | Đã làm, YCTD-139, phiên bản 0.90.0, PR 117 |
| 18b | 2 | Đã triển khai (YCTD-140, PR18B_SO, phiên bản 0.91.0): nhóm 3. Văn bản đi; dự thảo theo biểu mẫu iOffice, lấy ý kiến, cho ý kiến, trình ký, ký nội bộ qua `DossierSigner` có mã QR tra cứu, không ký, trả lại; cấp số và phát hành theo sổ văn bản đi, sổ đăng ký văn bản đi; liên thông nội bộ thành văn bản đến chờ vào sổ của phân hiệu, điểm trường; liên thông ra ngoài đánh dấu tay (chỗ nối `DocumentExchange.send`); public lên cổng (cột `published` cho 18f), đóng băng, lưu hồ sơ; trang tra cứu mã QR công khai |
| 18c | 2 | Đã làm, YCTD-141, phiên bản 0.92.0, PR 120: giao việc theo cây đơn vị mở rộng bảng việc đã có, phê duyệt, nhắc việc định kì, tạo việc từ văn bản đến; lịch đơn vị, phòng họp có duyệt, mẫu lịch, lịch họp; hồ sơ công việc nối văn thư lưu trữ; báo cáo xử lý văn bản đến, tổng hợp, thống kê |
| 18e | 3 | Đã triển khai (YCTD-142, PR 121, phiên bản 0.95.0): phân hệ Hồ sơ chuyên môn; Việc của tôi gom việc chờ của văn bản đến, đi, giao việc, phòng họp, KPI, hồ sơ, kế hoạch bài dạy, kí hồ sơ, nghỉ phép qua giao diện `MyWorkSource`, số đếm trên menu và đầu trang; kho ba nhánh theo năm học, danh mục mặc định theo cấp học; đợt nộp có hạn, ai chưa nộp, nhắc; luồng tổ trưởng rồi Ban Giám hiệu, trả lại, phiên bản, kí nội bộ qua `DossierSigner`; thống kê đúng hạn, trễ; nhóm công tác; khóa năm học |
| 18g | 3 | Đã triển khai (YCTD-143, PR 119, phiên bản 0.93.0): 2.4 Nơi để và tem QR thiết bị (phòng, kho, vị trí; tem PDF A4 3 × 8, mã tem không có tên miền); 2.5 Kiểm kê thiết bị (chụp sổ, quét QR trên ứng dụng giáo viên hoặc web di động, đối chiếu, tỷ lệ sử dụng được, nộp, duyệt, trả lại, chốt chênh lệch, biên bản); 2.6 Đối sánh danh mục tối thiểu (cột cấp học, nạp mẫu Mầm non 515 thiết bị theo TT 02/2010 sửa đổi bởi TT 34/2013, Đủ, Thiếu, Chưa có). Mẫu Tiểu học, THCS, THPT thêm sau DT-19 |
| 18f | 4 | Đã làm, YCTD-144, phiên bản 0.94.0, PR 122: phân hệ Website trường; tên miền lưu ở cơ sở dữ liệu, nhận diện trường theo Host, Caddy cấp chứng chỉ theo yêu cầu chỉ cho tên miền đã đăng ký; trang công khai (giới thiệu, cơ cấu tổ chức, tin tức, thông báo, văn bản công khai từ 18b, tuyển sinh, công khai theo Thông tư 09/2024/TT-BGDĐT, thư viện ảnh, liên hệ; thời khóa biểu chờ 22c); soạn, duyệt, đăng, gỡ, lọc HTML; chế độ trình diễn, nội dung mẫu. Đăng ký sự kiện qua QR để phần sau |
| 18h | 4 | Đã làm, YCTD-145, phiên bản 0.96.0, PR 123: nhóm 4. Quản trị và trình diễn của Quản trị hệ thống; đăng nhập thay (quyền riêng VT-02, lý do, thanh báo và nút thoát ở mọi trang, phiên 60 phút, không vào tài khoản quyền cao hơn, không thao tác mật khẩu, kí số, nhật ký bắt đầu, kết thúc và mọi thao tác); gói ZIP toàn bộ dữ liệu (tác vụ xuất nền của 16a, CSV mọi bảng, tệp đính kèm, manifest, hạn tải 48 giờ, nhật ký xuất và tải; hàm dựng gói dùng lại cho DT-SaaS S2); bản trình diễn (dấu ở cơ sở dữ liệu, dữ liệu giả phủ các phân hệ cũ và 18a đến 18g, trang chọn vai, dải trình diễn, chặn SMS, Zalo, Fanpage, thanh toán thật, lệnh tạo và dịch vụ tự đặt lại; dùng cho dùng thử của DT-SaaS S5) |
| 22b | 5 | Đã làm, YCTD-146, phiên bản 0.98.0, PR 125: nhóm 3. Bán trú và an toàn thực phẩm của Bếp – kho, mua hàng; lô hàng nhập (tạo khi nhập phiếu đi chợ, nhập tay, số lô, hạn dùng, chứng từ, cảnh báo sắp hết hạn, đóng lô); hồ sơ an toàn thực phẩm của nhà cung cấp (hiệu lực, cảnh báo 30 ngày ở trang, Việc của tôi, phiếu đi chợ); kiểm thực ba bước theo Quyết định 1246/QĐ-BYT (gợi ý dòng từ lô, thực đơn, số suất; lô đạt mới dùng cho món; xác nhận khóa phiếu); lưu và hủy mẫu (100 g, 150 ml, 2–8 °C, 24 giờ, giữ mẫu khi có phản ánh); truy xuất món ra lô, nhà cung cấp, giấy tờ, mẫu; sổ kiểm thực, sổ lưu mẫu, nhãn mẫu. Rà tiền ăn: tính theo ngày có mặt, số dư có chuyển năm; chưa có chi trả lại số dư |
| 22i | 5 | Đã làm, YCTD-147, phiên bản 0.97.0, PR 124: nhóm 5. Kế hoạch giáo dục của phân hệ Hồ sơ chuyên môn; thư viện mẫu theo cấp học (bảy mẫu Mầm non: kế hoạch nhà trường, năm, tháng, tuần của nhóm lớp, hoạt động tổ, dự giờ, thao giảng, bồi dưỡng thường xuyên); duyệt tổ trưởng, Phó Hiệu trưởng, Hiệu trưởng, bốn trạng thái; kí nội bộ qua `DossierSigner`; lưu bản đã duyệt vào kho hồ sơ 18e; phiên bản, so sánh khác biệt, sao chép từ năm trước; xuất Word, PDF; tiến độ duyệt, xuất Excel; tạo kế hoạch công việc; nguồn Việc của tôi |
| 22d | 5 | Đã làm, YCTD-148, phiên bản 0.99.0, PR 127: phân hệ Thi đua, khen thưởng; danh mục danh hiệu, hình thức khen thưởng cấu hình được (danh mục mặc định theo Luật Thi đua, khen thưởng 2022, Nghị định 368/2026/NĐ-CP); đợt, phát động; đăng ký thi đua cá nhân, tập thể; hồ sơ đề nghị lấy xếp loại KPI của 18d, minh chứng từ kho hồ sơ 18e, bảng điều kiện (KPI, sáng kiến, điểm tiêu chí, năm liên tục, tỉ lệ); hội đồng, phiên họp, bỏ phiếu kín, biên bản; công bố, phúc khảo, khiếu nại có hạn, bình xét lại; quyết định của trường, tờ trình cấp trên, dự thảo văn bản đi 18b; giấy khen có mã QR tra cứu công khai; sổ theo dõi nhiều năm (đọc mọi năm học, nhập tay năm trước); báo cáo đợt; Việc của tôi |
| 22f | 5 | Đã làm, YCTD-149, phiên bản 0.100.0, PR 128: phân hệ Bảo đảm chất lượng; bộ tiêu chuẩn cấu hình được theo cấp học (tiêu chuẩn, tiêu chí, chỉ báo theo mức; bộ mẫu Mầm non năm tiêu chuẩn, hai mươi lăm tiêu chí, chỉ báo trường tự nhập); đợt tự đánh giá, hội đồng, nhóm công tác, phân công tiêu chí; phiếu đánh giá tiêu chí (hiện trạng, điểm mạnh, điểm yếu, kế hoạch cải tiến, mức) nộp, duyệt, trả lại; minh chứng mã Hn-a.b-c, bốn trạng thái, nguồn từ kho hồ sơ 18e, văn bản 18a, 18b, kế thừa năm trước; kế hoạch cải tiến thành kế hoạch công việc nháp; báo cáo tự đánh giá Word, PDF (cơ sở dữ liệu từ 1.7); theo dõi hiệu lực công nhận, ghi vào 1.7 |

## 10. DT-19: nền đa cấp học

### 10.1 Căn cứ và mục tiêu

1. Quyết định của Eric ngày 2026-10-19: mở rộng School Management ra mọi cấp học (Mầm non, Tiểu học, THCS, THPT, trường liên cấp) theo lộ trình DT-18 → DT-19 (nền đa cấp học) → DT-20 (Tiểu học) → DT-21 (THCS, THPT) → DT-22 → DT-SaaS. DT-SaaS làm sau cùng (mô hình mỗi trường một bộ cơ sở dữ liệu, kế hoạch SaaS ghi ngoài kho).
2. Mục tiêu DT-19: thêm chiều "cấp học" cho trường; một trường có một hay nhiều cấp; lớp, khối, chương trình, năm học, học kỳ, menu, phân hệ, cổng phụ huynh và ứng dụng giáo viên theo cấp; chuyển dữ liệu Mầm non hiện có sang cấu trúc mới mà không đổi hành vi. DT-19 không thêm nghiệp vụ riêng của Tiểu học, THCS, THPT (sổ điểm, học bạ, thời khoá biểu, thi đua lớp); các nghiệp vụ đó thuộc DT-20 và DT-21.
3. Hiện trạng mã (đọc ngày 2026-10-22; nhánh chính có tệp năm học đến 0069, hệ thống đến 0022, định danh đến 0061, chưa tính số đã giữ cho 22d, 22f):
   - **Đã có chiều cấp học ở vài chỗ rời:** cột `school_level` (`MN`, `TH`, `THCS`, `THPT`) ở danh mục thiết bị tối thiểu (18g), mẫu kế hoạch giáo dục (22i), tiêu chí KPI (18d); cột `education_level` ở danh mục văn bản (18a, tùy chọn) và rà soát kiểm định (17e); cột `school_levels` (mảng chữ, mặc định `{MN}`) ở `website_settings` của cơ sở dữ liệu hệ thống (18f). Mỗi nơi tự quy ước, chưa có nguồn chung cho "trường này có những cấp nào".
   - **Chưa có thực thể cấp học của trường:** `org_units` (trường chính, phân hiệu, điểm trường) nằm ở cơ sở dữ liệu năm học và không có cột cấp; `classes` chỉ có `grade_level` (chuỗi mã khối) và `age_group` (kiểu liệt kê chỉ có sáu nhóm tuổi Mầm non, `months_3_12` đến `years_5_6`).
   - **Giả định tuổi Mầm non:** `grade_levels` bắt buộc `age_from_months`, `age_to_months` (0 đến 120 tháng). Thống kê lớp và học sinh, EMIS (`emis-01-calc`, `emis-so-calc`, `emis-forms`), báo cáo chấm công và suất ăn (`attendance-meals`), tăng trưởng (`health/growth`), hoàn thành chương trình và hồ sơ cuối cấp (`program-completion`, `final-year-records`), biểu phí theo nhóm tuổi (`fees`), nhập lớp và học sinh từ Excel (`imports`), nội dung kí hồ sơ (`signing-content`) đều tính theo tháng tuổi hoặc nhóm tuổi Mầm non. Bảng `children` và các màn hình "trẻ" mang tên Mầm non.
   - **Giả định Mầm non ở giao diện:** cây menu cổng quản trị (`packages/shared/src/portal-menu.ts`) có phân hệ "Quản lý giáo dục Mầm non" (cùng các mục như 1.1 "Hồ sơ học sinh cuối cấp mầm non", 2.4 "Báo cáo giáo dục mầm non cuối năm"); ô ngữ cảnh ở thanh đầu trang là hằng số `EDUCATION_LEVEL_LABEL = 'Cấp MN'` (`portal-shell`). Ứng dụng phụ huynh, ứng dụng giáo viên và cổng nhận diện (`apps/identity`) không ghi cứng chữ "Mầm non" nhưng toàn bộ nghiệp vụ là của trẻ Mầm non.
   - **Lịch năm học:** `academic_years`, `academic_terms` (`first_term`, `second_term`, `summer_term`), `school_weeks` nằm ở cơ sở dữ liệu hệ thống, mỗi năm học một dòng chung cả trường; mỗi năm học một cơ sở dữ liệu riêng (`academic_year_databases`). Chưa có lịch theo cấp.
   - **Đã viết sẵn cho đa cấp học (mục 9.2):** danh mục, mẫu và tiêu chí của DT-18 có cột cấp học, dữ liệu mặc định bản Mầm non; DT-19 gom về một nguồn.
   - **Đã có sẵn hàm tạo tên chung cho đa thuê bao:** `cacheKey` (khóa Redis) và `storageKey` (đường dẫn S3) ở `apps/api/src/common/resource-names.ts`.

### 10.2 Nguyên tắc

- **Không đổi hành vi Mầm non:** sau DT-19, trường chỉ có cấp Mầm non chạy y như trước (cùng menu, màn hình, kết quả báo cáo). Mọi cột mới có mặc định `MN`; mọi chỗ đọc cấp học mà không thấy cấp thì coi là `MN`. Toàn bộ e2e và kiểm thử đơn vị hiện có vẫn đạt mà không sửa kỳ vọng (mục 10.6).
- **Một nguồn cấp học của trường:** bảng `school_levels` ở cơ sở dữ liệu hệ thống (trường có những cấp nào, bật hay tắt, thứ tự, tên hiển thị, thuật ngữ gọi người học). Các chỗ rời (`website_settings.school_levels`, `EDUCATION_LEVEL_LABEL`) đọc từ nguồn này.
- **Bốn mã cấp cố định** `MN`, `TH`, `THCS`, `THPT` (đã dùng ở 18d, 18g, 22i); thêm cấp phải sửa mã, không sửa dữ liệu. Trường liên cấp là trường bật nhiều mã.
- **Cấp học là thuộc tính của khối và lớp, không phải của vai trò:** lớp thuộc một khối, khối thuộc một cấp. Người dùng được giới hạn theo cấp bằng phạm vi cấp (mặc định mọi cấp), không tạo vai trò mới theo cấp.
- **Giữ tên bảng:** không đổi tên bảng `children`, `classes` và các cột đã có; chỉ đổi nhãn giao diện theo cấp (Trẻ hay Học sinh). Đổi tên bảng làm vỡ mọi truy vấn mà không mang giá trị nghiệp vụ.
- **Viết sẵn cho đa thuê bao (DT-SaaS):** không thêm biến `.env` riêng của trường; cấu hình cấp học lưu trong cơ sở dữ liệu hệ thống; không ghi cứng tên miền, tên trường hay mã trường; khóa Redis qua `cacheKey` và đường dẫn S3 qua `storageKey`, không tự ghép chuỗi. Bảng mới thuộc cơ sở dữ liệu của trường (hệ thống, định danh hoặc năm học), không có bảng dùng chung giữa các trường.
- **Không thêm nghiệp vụ cấp khác:** màn hình của Tiểu học, THCS, THPT chỉ đặt vào menu khi DT-20, DT-21 làm. DT-19 chỉ đưa vào nền (bảng, hàm dùng chung, bộ lọc, nhãn).
- **Dữ liệu thật:** không ghi dữ liệu thật của trường, người hay văn bản vào mã, dữ liệu mẫu, kiểm thử hay tài liệu. Dữ liệu mẫu đa cấp chỉ ở bản trình diễn (18h).

### 10.3 Các phần

Số migration ghi theo thứ tự dự kiến; mỗi phần giữ sẵn số riêng để làm song song (kho mã đã bật `allowUnorderedMigrations`, không đánh lại số sang dải của phần khác). Phần nào không cần số đã giữ ở một cơ sở dữ liệu thì để trống số đó, không cho phần khác dùng. Số bắt đầu của DT-19: năm học 0072, hệ thống 0023, định danh 0064 (các số nhỏ hơn đã dùng hoặc đã giữ cho DT-18, kể cả 22d năm học 0070, định danh 0062 và 22f năm học 0071, định danh 0063). YCTD-150 dành cho chính bản kế hoạch này, YCTD của các phần bắt đầu từ YCTD-151. Số spec e2e mới giữ từ `81-` trở đi (`79-`, `80-` để dành cho 22d, 22f nếu hai phần đó có spec).

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD giữ sẵn | Migration giữ sẵn | e2e giữ sẵn |
|---|---|---|---|---|---|---|
| 19a | Nền cấp học của trường: bảng `school_levels`, hàm dùng chung đọc cấp, phạm vi cấp của người dùng, nối các cột cấp rời về một nguồn | 1 | Không | YCTD-151 | Hệ thống 0023; định danh 0064 | 81 |
| 19b | Cấu trúc theo cấp: khối, lớp, chương trình theo cấp; đơn vị theo cấp; học kỳ và tuần theo cấp; bỏ giả định tuổi ở khối của cấp khác | 1 | Không (dùng bốn mã cấp cố định; nối với `school_levels` khi 19a gộp) | YCTD-152 | Năm học 0072; hệ thống 0024 | 82 |
| 19c | Menu và phân hệ theo cấp: thuộc tính cấp ở phân hệ và mục menu, nhãn thuật ngữ, ô ngữ cảnh, chọn cấp đang làm việc | 2 | Sau khi 19a gộp (đọc `school_levels`) | YCTD-153 | Định danh 0065 | 83 |
| 19d | Số liệu theo cấp: thống kê, báo cáo, EMIS, biểu phí, nhập Excel, tăng trưởng, chấm công và suất ăn tách khỏi giả định tuổi Mầm non, lọc theo cấp | 2 | Sau khi 19a, 19b gộp | YCTD-154 | Năm học 0073 | 84 |
| 19e | Cổng phụ huynh và ứng dụng giáo viên đa cấp: nhiều con ở nhiều cấp trong một trường, giáo viên dạy nhiều cấp, thông báo theo cấp, màn hình theo cấp | 3 | Sau khi 19a, 19b, 19c gộp | YCTD-155 | Năm học 0074 | 85 |
| 19f | Chuyển và kiểm dữ liệu Mầm non, dữ liệu mẫu đa cấp, chuẩn bị cho DT-20, DT-21 | 3 | Sau khi 19a đến 19d gộp | YCTD-156 | Hệ thống 0025; năm học 0075; định danh 0066 | 86 |

Đợt làm, mỗi lúc tối đa hai phiên:
- Đợt 1: 19a và 19b.
- Đợt 2: 19c và 19d, bắt đầu khi 19a đã gộp (19d còn cần 19b đã gộp).
- Đợt 3: 19e và 19f, bắt đầu khi đợt 2 đã gộp.

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH, PQ) không trùng theo đợt: 19a, 19b, 19c, 19d, 19e, 19f; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. Mã YCTD, số migration và số e2e giữ sẵn ở bảng trên không đổi theo thứ tự gộp.

### 10.4 Phạm vi chi tiết

#### 19a. Nền cấp học của trường

- Bảng `school_levels` (hệ thống): mã cấp (`MN`, `TH`, `THCS`, `THPT`), bật hay tắt, thứ tự, tên hiển thị, thuật ngữ gọi người học (trẻ, học sinh), nhãn ô ngữ cảnh ("Cấp MN" như của Sở cho Mầm non). Nạp mặc định: một dòng `MN` bật, ba dòng còn lại tắt. Trường hiện có tự nhận cấp Mầm non, không cần thao tác.
- Hàm dùng chung `SchoolLevelResolver` ở `apps/api`: danh sách cấp đang bật, kiểm tra một cấp có bật không, cấp mặc định; bộ nhớ đệm khóa qua `cacheKey`. Mọi phần sau đọc cấp qua hàm này, không đọc cột rời.
- Nối các nguồn rời về một: `website_settings.school_levels` (18f) đọc từ `school_levels` (cột cũ giữ làm dự phòng, không xóa trong DT-19); `EDUCATION_LEVEL_LABEL` ở `portal-shell` thay bằng nhãn đọc từ bảng; trang công khai của 18f lấy cấp từ hàm chung.
- Phạm vi cấp của người dùng (định danh 0064): bảng người dùng và cấp được xem (không có dòng nào nghĩa là mọi cấp); hàm kiểm tra dùng chung cho API. Quyền hiện có giữ nguyên, phạm vi cấp chỉ thu hẹp thêm. Quyền mới "Cấu hình cấp học của trường" ghi vào ma trận quyền (08).
- Màn hình: Cấu hình trường (mục 1.4) thêm thẻ "Cấp học của trường" (bật, tắt, thứ tự, tên, thuật ngữ); cấp đang có lớp hoặc học sinh chỉ ẩn được, không xóa.
- Ghi nhật ký thao tác mọi thay đổi cấp học.
- **Mở đường cho DT-20, DT-21:** bật cấp `TH`, `THCS`, `THPT` chỉ là bật dòng, không đổi mã; DT-20, DT-21 đọc cấp qua hàm này.

#### 19b. Cấu trúc theo cấp: khối, lớp, chương trình, năm học

- **Khối (`grade_levels`):** thêm cột `school_level` (mặc định `MN`); `age_from_months`, `age_to_months` thành tùy chọn ở cấp ngoài Mầm non (cấp Mầm non giữ bắt buộc, kiểm tra ở lớp dịch vụ). Danh mục khối mẫu theo cấp, trường nạp khi bật cấp: Mầm non giữ mã hiện có, Tiểu học khối 1 đến 5, THCS khối 6 đến 9, THPT khối 10 đến 12. Mã khối duy nhất trong trường, không trùng giữa các cấp.
- **Lớp (`classes`):** thêm `school_level` (mặc định `MN`, suy ra từ khối, không cho lệch khối). `age_group` chỉ dùng ở Mầm non (kiểm tra ở lớp dịch vụ, giữ kiểu cũ, không thêm giá trị). Các cờ riêng Mầm non (`two_sessions_per_day`, `mixed_age_count`, `is_combined`) chỉ hiện ở lớp Mầm non; `boarding` dùng được ở mọi cấp (nghiệp vụ bán trú của Tiểu học là DT-20). Nhập lớp từ Excel (2.2) nhận cột cấp (trống là cấp duy nhất đang bật, hoặc `MN`).
- **Chương trình theo cấp:** bảng `curricula` (chương trình, cấp, khối áp dụng, trạng thái); lớp và khối tham chiếu chương trình. Mầm non: chương trình hiện có (hoàn thành chương trình, 4.4) gắn vào chương trình Mầm non mặc định. Chương trình môn học và số tiết là DT-20, DT-21; DT-19 chỉ có khung và danh mục.
- **Đơn vị:** bảng nối `org_unit_levels` (điểm trường, phân hiệu có những cấp nào); trường chỉ có `MN` thì mọi đơn vị tự có `MN` khi chuyển dữ liệu (19f). Hồ sơ trường, điểm trường hiện cấp của đơn vị.
- **Học kỳ và tuần theo cấp (hệ thống 0024):** `academic_terms` và `school_weeks` thêm `school_level` tùy chọn (trống là chung cả trường, hành vi hiện tại); trường liên cấp khai báo học kỳ, tuần nghỉ riêng từng cấp khi cần. Ngày làm việc trong tuần (`school_days_of_week`) có bản theo cấp ở bảng `academic_year_level_settings` cùng migration. Lịch ở cổng quản trị chọn cấp để xem; lịch chung giữ nguyên.
- **Năm học:** vẫn một năm học một cơ sở dữ liệu cho cả trường, không tách theo cấp (mục 10.5). Mở năm học mới và chuyển hồ sơ lên năm học (5.7) chép khối, lớp, chương trình, cấp; lên lớp theo khối kế tiếp trong cùng cấp; khối cuối cấp chuyển sang khối đầu của cấp kế nếu trường bật cấp đó, nếu không thì ra "hoàn thành cấp học" (logic Mầm non giữ nguyên, nối với 1.1 Hồ sơ cuối cấp).
- **Mở đường cho DT-20, DT-21:** khối 1 đến 12, chương trình theo cấp, lịch theo cấp, lớp thuộc cấp là chỗ để 22c thời khoá biểu, sổ điểm, học bạ bám vào.

#### 19c. Menu và phân hệ theo cấp

- **Thuộc tính cấp ở menu:** `PortalWorkspace` và `PortalMenuNode` thêm `levels` tùy chọn (trống là mọi cấp); danh sách mục menu (`listPortalMenuEntries`) lọc theo cấp bật của trường và cấp đang làm việc. Mục hiện có gắn `levels: ['MN']` khi nghiệp vụ là của Mầm non (hồ sơ cuối cấp Mầm non, báo cáo giáo dục mầm non cuối năm, mẫu EMIS Mầm non, dinh dưỡng theo tháng tuổi); phần còn lại mọi cấp.
- **Phân hệ "Quản lý giáo dục Mầm non":** giữ phân hệ và số menu như của Sở khi trường chỉ có Mầm non (giữ y hệt). Khi trường bật cấp khác, tên phân hệ thành "Quản lý giáo dục" và các nhóm riêng Mầm non hiện theo cấp (DT-20, DT-21 thêm nhóm của cấp mình). Tên phân hệ lấy từ nhãn trong `school_levels`, không ghi cứng.
- **Chọn cấp đang làm việc:** trường nhiều cấp có bộ chọn cấp ở thanh đầu trang (ô ngữ cảnh có sẵn ở 16c); lựa chọn lưu theo người dùng (định danh 0065, bảng ưu tiên người dùng; để trống số này nếu lưu ở giao diện là đủ) và truyền vào API qua một tham số cấp dùng chung; "Tất cả" là mặc định cho người có nhiều cấp.
- **Nhãn thuật ngữ theo cấp:** "Trẻ", "Hồ sơ trẻ" ở Mầm non; "Học sinh", "Hồ sơ học sinh" ở cấp khác; "Nhóm lớp" hay "Lớp" theo cấp. Bảng nhãn ở `packages/shared`, không ghi cứng chữ ở từng trang; các trang đã ghi cứng (mục 10.1) chuyển sang bảng này mà không đổi chữ ở Mầm non.
- **Ma trận quyền (08):** cây quyền theo cây menu vẫn đủ mọi mục; mục không thuộc cấp bật của trường ẩn khỏi cây quyền của trường đó.
- **Trang chủ và liên kết nhanh:** ô liên kết nhanh (`quick-links`) lọc theo cấp bật; quyền hiện từng mục do cổng kiểm tra như cũ, máy chủ vẫn kiểm tra quyền ở mọi yêu cầu.
- **Mở đường cho DT-20, DT-21:** các phân hệ mới của Tiểu học, THCS, THPT thêm vào cây menu bằng thuộc tính `levels` mà không sửa khung.

#### 19d. Số liệu theo cấp: thống kê, báo cáo, biểu phí

- **Tham số cấp dùng chung:** các điểm cuối thống kê, báo cáo, danh sách học sinh, lớp, nhân sự nhận tham số cấp (cùng bộ lọc của 19c); không có tham số thì trả như trước (trường một cấp) hoặc gộp mọi cấp (trường nhiều cấp) theo từng báo cáo.
- **Thống kê (5.1 đến 5.3):** thống kê lớp, học sinh, nhân sự thêm cột và bộ lọc cấp; nhóm tuổi chỉ hiện ở Mầm non, cấp khác thống kê theo khối.
- **EMIS:** biểu mẫu Mầm non (`emis-01-calc`, `emis-so-calc`, `emis-forms`) chỉ tính từ lớp, học sinh thuộc cấp `MN`; trường nhiều cấp chọn cấp ở màn hình EMIS. Biểu EMIS Tiểu học, THCS, THPT là DT-20, DT-21 (khảo sát hệ thống của Sở sau).
- **Chấm công, suất ăn, tăng trưởng, hoàn thành chương trình, hồ sơ cuối cấp:** báo cáo chấm công và suất ăn (`attendance-meals`) lọc theo cấp; tăng trưởng (`health/growth`) chỉ tính theo tháng tuổi cho Mầm non (chuẩn của cấp khác thêm ở DT-20); hồ sơ cuối cấp (`final-year-records`, 1.1) chỉ cho cấp Mầm non (hồ sơ chuyển cấp của cấp khác là DT-20, DT-21).
- **Biểu phí (`fees`):** biểu phí thêm `school_level` (mặc định `MN`; năm học 0073); phí theo nhóm tuổi ở Mầm non, theo khối ở cấp khác; tính phí, công nợ, phiếu thu, thanh toán không đổi. Tiền ăn dùng chung (rà theo 22b).
- **Nhập Excel (2.2, 4.1.2, nhập học sinh):** nhập theo cấp (cột mã khối, không bắt buộc nhóm tuổi ở cấp khác); mẫu Excel tải về theo cấp.
- **Kí hồ sơ (`signing-content`):** mẫu có tên cấp ở tiêu đề lấy từ nhãn cấp.
- **Danh mục dùng chung (DT-18 đã có cột cấp):** gom `education_level` (văn bản, 17e) và `school_level` (18d, 18g, 22i) về cùng bộ bốn mã; không đổi nội dung cột, chỉ thêm kiểm tra giá trị và bộ lọc dùng chung.
- **Mở đường cho DT-20, DT-21:** báo cáo, thống kê, EMIS đã nhận tham số cấp nên báo cáo của Tiểu học, THCS, THPT thêm vào mà không sửa khung.

#### 19e. Cổng phụ huynh và ứng dụng giáo viên đa cấp

- **Cổng phụ huynh (`apps/parent`):** phụ huynh có con ở nhiều cấp trong cùng trường (liên cấp) hoặc nhiều con khác khối thấy đủ các con và chọn từng con; mỗi con hiện theo cấp của lớp (nhãn thuật ngữ theo cấp; màn hình chỉ hiện khi cấp có chức năng, ví dụ hồ sơ cuối cấp Mầm non chỉ ở con Mầm non). Cấu trúc màn hình và quyền hiện có giữ nguyên; trường Mầm non thấy y như cũ.
- **Ứng dụng giáo viên (`apps/teacher`):** giáo viên dạy hoặc chủ nhiệm lớp ở nhiều cấp thấy lớp theo cấp, chọn lớp rồi vào chức năng đúng cấp; điểm danh, đánh giá hằng ngày hiện là của Mầm non nên chỉ hiện ở lớp Mầm non; điểm danh theo tiết, sổ điểm, sổ đầu bài là DT-20, DT-21 thêm vào cùng khung.
- **Thông báo và tin nhắn theo cấp:** thông báo, tin tức, sự kiện có đối tượng nhận theo cấp (năm học 0074, cột `audience_levels`, trống là mọi cấp); gửi theo lớp, khối, cấp; phụ huynh chỉ nhận tin của cấp con học. Số người nhận hiện trước khi gửi.
- **Đăng nhập và nhận diện (`apps/identity`):** tài khoản phụ huynh, giáo viên vẫn một tài khoản cho cả trường, không tạo tài khoản theo cấp; chọn con, chọn lớp xử lý ở ứng dụng.
- **Mở đường cho DT-20, DT-21:** màn hình học sinh (điểm, nhận xét, học bạ, thời khoá biểu) của Tiểu học, THCS, THPT đặt vào khung chọn con, chọn lớp theo cấp.

#### 19f. Chuyển và kiểm dữ liệu Mầm non, dữ liệu mẫu đa cấp

- **Chuyển dữ liệu:** các cột mới có mặc định `MN`; migration năm học 0075 gán cấp `MN` cho khối, lớp, chương trình, đơn vị, biểu phí và danh mục còn thiếu ở mọi cơ sở dữ liệu năm học (kể cả năm học đã đóng, chế độ chỉ đọc: chỉ ghi cột cấp, không đổi nội dung nghiệp vụ); hệ thống 0025 nạp `school_levels` từ `website_settings.school_levels` và gán cấp cho học kỳ, tuần; định danh 0066 chốt phạm vi cấp mặc định của người dùng. Migration chạy lặp được (chạy lại không đổi kết quả).
- **Công cụ kiểm đối chiếu:** lệnh kiểm chỉ đọc, chạy trước và sau chuyển: đếm khối, lớp, học sinh, nhân sự, biểu phí, phiếu thu, điểm danh, phiếu khám, hồ sơ cuối cấp theo từng năm học và so khớp; kiểm toàn vẹn (lớp thuộc khối cùng cấp, đơn vị có cấp, cấp ở mọi dòng thuộc bốn mã). Kết quả ghi vào nhật ký, không ghi dữ liệu thật.
- **Dữ liệu trình diễn đa cấp (18h):** bản trình diễn có thêm trường liên cấp giả (Tiểu học, THCS) để thử menu, cổng phụ huynh, ứng dụng giáo viên; không đổi dữ liệu trình diễn Mầm non hiện có.
- **Kiểm thử đa cấp:** e2e `86-multi-level.spec.ts` (trường liên cấp: bật cấp, tạo khối, lớp Tiểu học, menu, bộ chọn cấp, cổng phụ huynh hai con ở hai cấp) cùng e2e `81-` đến `85-` của các phần; kiểm thử đơn vị cho hàm cấp, chuyển năm học, lọc cấp.
- **Tài liệu:** cập nhật `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `14_DAC_TA_GIAO_DIEN.md`, `12_KIEN_TRUC_HE_THONG.md` (nền đa cấp học, chuyển dữ liệu); ghi quy ước "đọc cấp qua `SchoolLevelResolver`" cho DT-20, DT-21.
- **Chuẩn bị cho DT-20, DT-21:** rà và chốt lại bảng điểm mở đường (mục 10.7); DT-20, DT-21 chỉ bắt đầu khi 19f gộp xong.

### 10.5 Quyết định thiết kế và phương án đã loại

Các lựa chọn dưới đây do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

- **Một cơ sở dữ liệu năm học cho cả trường, không tách theo cấp:** trường liên cấp dùng chung nhân sự, phụ huynh, tài chính, cơ sở vật chất giữa các cấp. Tách cơ sở dữ liệu theo cấp buộc đồng bộ hai bên và vỡ mô hình "một năm học một cơ sở dữ liệu" mà DT-SaaS dựa vào. Phân biệt cấp bằng cột `school_level` ở khối, lớp và các bảng cần.
- **Không thêm `school_level` vào mọi bảng:** chỉ khối, lớp, chương trình, đơn vị (bảng nối), biểu phí, học kỳ, tuần, thông báo. Học sinh, điểm danh, phiếu thu suy ra cấp từ lớp, khối; thêm cột chỉ khi truy vấn hiệu năng cần (đo ở 19d).
- **Không đổi tên bảng `children`:** giữ cho an toàn dữ liệu và kiểm thử; đổi nhãn ở giao diện.
- **Cấp học là bốn mã cố định, không phải danh mục tự do:** cấp học do pháp luật quy định; bảng `school_levels` chỉ lưu bật, tắt, tên hiển thị.
- **Trường liên cấp** là trường bật nhiều mã cấp; người phụ trách một cấp (ví dụ phó hiệu trưởng) dùng phạm vi cấp của người dùng (19a), không tạo vai trò mới.

### 10.6 Rủi ro chuyển dữ liệu Mầm non và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Cột cấp mới làm đổi kết quả truy vấn Mầm non (lọc `school_level` sai, bỏ sót dòng thiếu cấp) | Mặc định `MN`, cột `NOT NULL`; mọi truy vấn lọc cấp coi giá trị trống là `MN`; kiểm thử đơn vị mỗi hàm lọc cấp với dữ liệu thiếu cấp |
| Chuyển dữ liệu năm học cũ (đã đóng, chỉ đọc) làm đổi dữ liệu cũ | Migration chỉ thêm cột có mặc định, chạy lặp được; lệnh kiểm đối chiếu trước và sau chuyển (19f) ở bản sao dữ liệu thử, không chạy thẳng bản thật; số liệu hai bên khớp từng năm học |
| Báo cáo EMIS và thống kê Mầm non lệch số sau khi thêm lọc cấp | Kiểm thử đơn vị có sẵn (`emis-01-calc`, `emis-so-calc`, thống kê) vẫn đạt không sửa kỳ vọng; thêm ca so sánh số liệu trước và sau trên cùng bộ dữ liệu thử |
| Menu, phân hệ Mầm non đổi tên hay biến mất khi thêm lọc cấp | Trường chỉ có Mầm non giữ y hệt menu (tên, số thứ bậc, thứ tự); kiểm thử đơn vị `portal-menu`, `menu-permissions` so với bản cũ; e2e `menu.ts` chạy lại |
| Phạm vi cấp làm mất quyền của người dùng hiện có | Không có dòng phạm vi cấp nghĩa là mọi cấp; kiểm thử quyền cũ không đổi |
| Hai phần cùng đợt (19a và 19b, 19c và 19d, 19e và 19f) cùng sửa schema hoặc menu | Số migration giữ sẵn riêng, cột mới ở bảng khác nhau; thứ tự gộp theo mục 10.3; rà trùng khi gộp |
| 22d, 22f (làm ở DT-18) ghi cứng giả định Mầm non | Hai phần đó viết theo "viết sẵn cho đa cấp học" (mục 9.2); 19d rà lại, thêm lọc cấp vào bảng của hai phần nếu cần |
| Trường liên cấp dùng sai (lớp lệch khối, cấp chưa bật) | Lớp dịch vụ kiểm lớp thuộc khối cùng cấp và cấp đã bật; kiểm thử đơn vị từng ràng buộc |

**Cổng kiểm của mỗi phần DT-19:**
- Kiểm thử đơn vị toàn bộ kho đạt, không sửa kỳ vọng của kiểm thử đang có.
- E2E toàn bộ hiện có đạt (kể cả spec của 22d, 22f nếu đã gộp), cộng e2e mới của phần.
- Typecheck, lint, build đạt; CI 4/4 xanh trước khi gộp.
- Chạy migrate trên bản sao có dữ liệu thử nhiều năm học; từ 19f trở đi kiểm đối chiếu khớp.
- Phiên bản phần mềm tăng theo từng phần; riêng bản kế hoạch này (YCTD-150) chỉ đổi tài liệu, giữ nguyên phiên bản phần mềm.

### 10.7 Phần của DT-19 mở đường cho DT-20 và DT-21

| Cần của DT-20, DT-21 | Do phần nào của DT-19 chuẩn bị |
|---|---|
| Bật cấp Tiểu học, THCS, THPT cho trường; đọc cấp ở mọi nơi | 19a (`school_levels`, `SchoolLevelResolver`) |
| Khối 1 đến 12, lớp thuộc cấp, chương trình theo cấp: nền của sổ điểm, học bạ, thời khoá biểu | 19b (khối, lớp, `curricula`) |
| Học kỳ, tuần nghỉ riêng từng cấp: nền của thời khoá biểu 22c (DT-20) và kiểm tra đánh giá 22g (DT-21) | 19b (học kỳ, tuần theo cấp) |
| Phân hệ, menu riêng từng cấp; nhãn "Học sinh" | 19c (thuộc tính `levels`, nhãn thuật ngữ, chọn cấp) |
| Báo cáo, thống kê, EMIS, biểu phí theo cấp | 19d (tham số cấp dùng chung, biểu phí theo khối) |
| Phụ huynh xem điểm, nhận xét, học bạ; giáo viên nhập điểm, sổ đầu bài theo lớp, theo tiết | 19e (chọn con, chọn lớp theo cấp, thông báo theo cấp) |
| Dữ liệu mẫu và kiểm thử trường liên cấp | 19f (trình diễn đa cấp, e2e đa cấp) |

- **DT-20 (Tiểu học, kèm 22c thời khoá biểu)** xây trên 19a, 19b, 19c, 19e: cấp `TH`, khối 1 đến 5, lịch Tiểu học, menu Tiểu học, màn hình học sinh. Báo cáo EMIS Tiểu học và biểu phí theo khối dùng 19d.
- **DT-21 (THCS, THPT, kèm 22g kiểm tra đánh giá)** xây trên cùng nền và dùng khung chương trình `curricula` (19b) cho tổ hợp môn.
- DT-20, DT-21 chỉ bắt đầu sau khi 19f gộp xong. Khi Eric có tài khoản trường Tiểu học trên hệ thống của Sở thì khảo sát để làm khớp, như đã làm với Mầm non.
- DT-19 không làm (để DT-20, DT-21): sổ điểm, học bạ số, thời khoá biểu, sổ đầu bài, điểm danh theo tiết, đánh giá theo TT 27/2020 và TT 22/2021, khen thưởng cuối năm, EMIS các cấp, xét tốt nghiệp, tổ hợp môn.

### 10.8 Quy ước chung của DT-19

- Mỗi phần ghi YCTD giữ sẵn ở mục 10.3, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 14, 16, 17, 21, 23, 24, 32, `index.md` khi có thay đổi tương ứng), chạy đủ kiểm thử đơn vị và e2e, mở PR, gộp khi mọi kiểm tra CI đạt.
- Mỗi PR của phần nêu rõ cột mới, cách xử lý dữ liệu cũ và kết quả đối chiếu trước, sau chuyển.
- Mã mới theo mục 10.2 (đa thuê bao, không `.env` riêng của trường, `cacheKey`, `storageKey`).
- Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần.

### 10.9 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| 19a | 1 | Đã làm, YCTD-151, phiên bản 0.101.0, PR 129: bảng `school_levels` (hệ thống 0023, Mầm non bật sẵn), `SchoolLevelResolver` (bộ nhớ đệm qua `cacheKey`), phạm vi cấp của người dùng (định danh 0064, `/auth/me` trả `school_levels`), quyền `P01.school-level.manage`, thẻ "Cấp học của trường" ở 1.4, ô ngữ cảnh và website đọc cấp từ một nguồn; e2e 81 |
| 19b | 1 | Đã làm (PR 130, YCTD-152, phiên bản 0.102.0) |
| 19c | 2 | Đã làm, YCTD-153, phiên bản 0.103.0, PR 131: thuộc tính `levels` ở phân hệ và mục menu (mục chỉ Mầm non gắn `MN`), tên phân hệ theo cấp (`levelTitle`), bộ chọn cấp đang làm việc lưu theo tài khoản (định danh 0065 `user_preferences`), tham số cấp dùng chung `school_level` (`SchoolLevelResolver.requested`), bảng nhãn thuật ngữ theo cấp, cây quyền và Truy cập nhanh lọc theo cấp bật; e2e 83 |
| 19d | 2 | Đã làm (PR 132, YCTD-154, phiên bản 0.104.0) |
| 19e | 3 | Đã làm, YCTD-155, phiên bản 0.105.0, PR 133: bảng chức năng theo cấp `LEVEL_FEATURES` (gói dùng chung), cấp của con ở danh sách con, ứng dụng phụ huynh và ứng dụng giáo viên hiện tên cấp, ẩn chức năng chỉ của Mầm non ở con, lớp cấp khác; tin tức có cấp nhận (năm học 0074 `news.audience_levels`), người xem, người nhận theo cấp con học, số người nhận trước khi công bố (`POST /news-recipients/count`); e2e 85 |
| 19f | 3 | Đã làm (PR 134, YCTD-156, phiên bản 0.106.0): tệp vá năm học 0075, hệ thống 0025 (định danh 0066 để trống), lệnh kiểm `level-check`, trường liên cấp trong bản trình diễn, e2e 86, mục 10.10 |

### 10.10 Ghi chú chuẩn bị cho DT-20, DT-21 (YCTD-156)

Chốt sau khi 19a đến 19f gộp. DT-20 (Tiểu học, kèm 22c) và DT-21 (THCS, THPT, kèm 22g) xây trên các điểm dưới đây, không sửa khung:

- **Đọc cấp:** mọi chỗ cần biết trường có những cấp nào, người dùng xem được cấp nào đọc qua `SchoolLevelResolver` (`apps/api/src/common/school-levels.ts`: `enabled`, `isEnabled`, `forUser`, `requested`, `assertCanAccess`); không đọc cột rời, không ghi cứng `MN`. Ghi dữ liệu theo cấp thì kiểm cấp đang bật (`assertLevelEnabled` ở `catalogs/school-level-fields.ts`).
- **Tham số cấp dùng chung:** điểm cuối mới nhận `school_level` (mã cấp, trống hoặc `all`) qua `readLevelFilter` ở `common/report-levels.ts`; cổng quản trị gửi cấp đang làm việc ở thanh đầu trang (`useWorkingSchoolLevels`, `useReportLevel`, `LevelSelect`).
- **Cấu trúc:** khối theo cấp (khối mẫu K1 đến K12 ở `GRADE_LEVEL_TEMPLATES`), lớp lấy cấp theo khối, `curricula` (mỗi cấp một chương trình mặc định; chương trình môn học, số tiết, tổ hợp môn thêm bảng con của `curricula`), `org_unit_levels`, học kỳ, tuần, ngày học riêng của cấp (`school_level` ở `academic_terms`, `school_weeks`, `academic_year_level_settings`; nghiệp vụ hiện có đọc lịch chung, thời khoá biểu 22c đọc lịch của cấp), khối kế tiếp khi lên lớp (`nextGradeLevel`, `GET /grade-levels/next`).
- **Menu, nhãn:** phân hệ, mục menu mới gắn `levels` (19c); nhãn "Trẻ"/"Học sinh" lấy từ bảng thuật ngữ theo cấp, không ghi cứng ở trang.
- **Số liệu:** biểu mẫu riêng Mầm non (EMIS, tăng trưởng theo tháng tuổi, hồ sơ cuối cấp) chỉ tính lớp Mầm non; biểu EMIS, chuẩn tăng trưởng, hồ sơ chuyển cấp của cấp khác là biểu mới theo cấp. Biểu phí theo cấp (mỗi cấp một chuỗi phiên bản, giá theo khối).
- **Phụ huynh, giáo viên:** chọn con, chọn lớp theo cấp, thông báo theo cấp (19e; chức năng hiện theo cấp ở `packages/shared/src/level-features.ts`, đối tượng nhận tin `audience_levels`); màn hình điểm, nhận xét, học bạ, thời khoá biểu, sổ đầu bài đặt vào khung đó và khai báo cấp ở `level-features.ts`.
- **Dữ liệu và kiểm thử:** bản trình diễn có điểm trường liên cấp (Tiểu học, THCS: lớp 1A, 6A, một phụ huynh có con ở hai cấp); e2e `86-multi-level.spec.ts` là mẫu cho kịch bản liên cấp; kịch bản bật cấp khác phải trả lại trường chỉ có Mầm non ở cuối (qua 1.4 để xóa bộ nhớ đệm cấp học). Lệnh `pnpm --filter @school-management/database level-check` kiểm toàn vẹn cấp trước, sau mỗi lần chuyển dữ liệu.
- **Chưa làm ở DT-19:** sổ điểm, học bạ số, thời khoá biểu, sổ đầu bài, điểm danh theo tiết, đánh giá theo TT 27/2020, TT 22/2021, khen thưởng cuối năm, EMIS các cấp, xét tốt nghiệp, tổ hợp môn; khảo sát hệ thống của Sở cho Tiểu học khi Eric có tài khoản.


## 11. DT-20: Tiểu học (kèm 22c thời khoá biểu)

### 11.1 Căn cứ và mục tiêu

1. Lộ trình Eric chốt ngày 2026-10-19: DT-18 → DT-19 (nền đa cấp học) → DT-20 (Tiểu học, kèm 22c thời khoá biểu) → DT-21 (THCS, THPT, kèm 22g) → DT-22 → DT-SaaS. Phạm vi DT-20 theo kế hoạch DT-18: hồ sơ học sinh tiểu học; đánh giá theo Thông tư 27/2020/TT-BGDĐT (nhận xét, mức đạt theo môn học và hoạt động giáo dục, phẩm chất, năng lực); học bạ số; thời khoá biểu (nhập Excel và máy xếp); sổ đầu bài, điểm danh theo tiết; bán trú; khen thưởng cuối năm; báo cáo EMIS tiểu học; nề nếp và thi đua (tuỳ trường). Phần 22c thời khoá biểu thuộc DT-22 nhưng Eric cho chạy cùng DT-20; theo đề xuất trong kế hoạch DT-22 (khoảng 2 đơn vị, rủi ro kỹ thuật lớn nhất), 22c tách hai phần: khung và nhập Excel trước, máy xếp sau.
2. Mục tiêu: trường bật cấp Tiểu học (19a) dùng được School Management cho nghiệp vụ hằng ngày và cuối năm của Tiểu học, theo Chương trình giáo dục phổ thông 2018 và Thông tư 27/2020; trường chỉ có Mầm non không đổi gì.
3. **Chưa khảo sát hệ thống của Sở cấp Tiểu học:** Eric chưa có tài khoản trường Tiểu học trên hệ thống của Sở. DT-20 làm theo văn bản quy phạm và nghiệp vụ chung; màn hình, cột, số mục menu, mẫu biểu EMIS khớp Sở khảo sát sau (khi Eric có tài khoản), như đã làm với Mầm non ở DT-15, DT-16. Phần nào cần khớp Sở ghi rõ ở 11.4 và để chỗ đổi (danh mục, mẫu biểu cấu hình được) thay vì ghi cứng.
4. Hiện trạng mã (đọc ngày 2026-10-23, nhánh chính đã có 19a đến 19e; 19f đang chờ gộp):
   - **Nền DT-19 dùng lại:** `school_levels` và `SchoolLevelResolver` (19a, đọc cấp, phạm vi cấp của người dùng, `requested` cho tham số `?school_level=`); khối `grade_levels.school_level`, khối mẫu K1 đến K5, lớp `classes.school_level`, khung chương trình `curricula` (chưa có môn học, số tiết), `org_unit_levels`, học kỳ, tuần, ngày học theo cấp (19b); thuộc tính `levels` ở cây menu, `levelTitle` của phân hệ Quản lý giáo dục, nhãn "Học sinh"/"Lớp", bộ chọn cấp đang làm việc (19c); tham số cấp ở thống kê, báo cáo, EMIS, biểu phí theo khối (`fee_schedules.school_level`, 19d); bảng chức năng theo cấp `LEVEL_FEATURES` cho ứng dụng phụ huynh, giáo viên, tin tức có cấp nhận (19e); dữ liệu mẫu liên cấp, lệnh kiểm đối chiếu (19f).
   - **Đã có, dùng lại hoặc mở rộng:** `children` (hồ sơ học sinh dùng chung mọi cấp, nhãn theo cấp), `class_enrollments`, `class_staff_assignments` (chủ nhiệm, bộ môn có `subject_name` tự do), điểm danh theo ngày (`attendance_days`, `attendance_records`, gắn suất ăn Mầm non), bếp và thực đơn (`kitchen`), bán trú và an toàn thực phẩm (22b), học phí, dịch vụ (`fees`, `service_registrations`), giảng dạy (`lessons`, `lesson_plans`, bảng `timetables` đơn giản: lớp, thứ, tiết, giờ, tên hoạt động, giáo viên, nháp hay công bố), kí hồ sơ bản chạy nội bộ (16k, 17b), xuất PDF và xuất nền (16a), website trường có chỗ cho trang thời khoá biểu (18f), thi đua khen thưởng cán bộ (22d, không dùng cho học sinh).
   - **Chưa có:** danh mục môn học và hoạt động giáo dục, số tiết theo khối; phân công giảng dạy theo môn; đánh giá học sinh (mọi loại); học bạ; khen thưởng học sinh; sổ đầu bài; điểm danh theo tiết; thời khoá biểu theo môn, phòng, có kiểm tra xung đột; biểu EMIS Tiểu học.

### 11.2 Nguyên tắc

- **Không đổi hành vi Mầm non:** chức năng mới gắn `levels: ['TH']` ở menu và `LEVEL_FEATURES` ở ứng dụng; bảng mới có cột cấp hoặc gắn với lớp, khối có cấp. Toàn bộ e2e và kiểm thử đơn vị hiện có vẫn đạt không sửa kỳ vọng.
- **Đọc cấp qua `SchoolLevelResolver`** (quy ước của 19f); điểm cuối mới nhận tham số `school_level` dùng chung; máy chủ chặn chức năng Tiểu học ở lớp không thuộc cấp `TH` (khác 19e chỉ ẩn ở ứng dụng).
- **Danh mục cấu hình được, có bộ mặc định:** môn học, hoạt động, số tiết, mẫu nhận xét, mẫu học bạ, biểu EMIS nạp mặc định theo văn bản hiện hành, trường sửa được; đổi văn bản hoặc khớp Sở thì sửa danh mục, không sửa mã. Mã môn, mã mức đánh giá cố định trong mã như bốn mã cấp.
- **Văn bản gốc trước phạm vi chi tiết:** mỗi phần đọc toàn văn văn bản căn cứ (Thông tư 27/2020/TT-BGDĐT về đánh giá học sinh tiểu học; Chương trình giáo dục phổ thông 2018 về môn học, hoạt động và thời lượng; Điều lệ trường tiểu học; văn bản hướng dẫn học bạ số, bán trú hiện hành) và ghi số hiệu, điều khoản vào YCTD của phần; chỗ kế hoạch này tóm tắt chỉ để chia phần.
- **Một nguồn sự thật cho tiết học:** thời khoá biểu (22c) là nguồn của sổ đầu bài và điểm danh theo tiết (20d); phân công giảng dạy (20a) là nguồn của thời khoá biểu và quyền nhập đánh giá theo môn (20c).
- **Học bạ là bản chốt:** học bạ (20e) đọc từ đánh giá đã khoá (20c), không nhập lại; sửa sau khi chốt phải mở khoá có lý do và ghi nhật ký; kí bằng luồng kí nội bộ đã có (16k, 17b), chữ ký số thật để sau.
- **Viết sẵn cho đa thuê bao:** không thêm biến `.env` riêng của trường; khóa Redis qua `cacheKey`, tệp qua `storageKey`; bảng mới thuộc cơ sở dữ liệu của trường.
- **Dữ liệu thật:** không đưa dữ liệu thật của trường, học sinh, giáo viên vào mã, dữ liệu mẫu, kiểm thử, tài liệu; dữ liệu mẫu Tiểu học chỉ ở bản trình diễn (18h, 19f).
- **Máy xếp thời khoá biểu chạy trong trường:** không gửi dữ liệu ra dịch vụ ngoài; chạy nền (tác vụ của `worker`), có giới hạn thời gian, trả kết quả tốt nhất tìm được.

### 11.3 Các phần

Số migration giữ sẵn bắt đầu sau DT-19 (19f giữ năm học 0075, hệ thống 0025, định danh 0066): năm học 0076, hệ thống 0026, định danh 0067. Phần nào không cần số đã giữ thì để trống, không cho phần khác dùng (kho mã đã bật `allowUnorderedMigrations`). YCTD-157 dành cho chính bản kế hoạch này; YCTD của các phần từ YCTD-158. Spec e2e từ `87-`.

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD giữ sẵn | Migration giữ sẵn | e2e giữ sẵn |
|---|---|---|---|---|---|---|
| 20a | Nền Tiểu học: danh mục môn học và hoạt động giáo dục, số tiết theo khối, gắn vào `curricula`; phân công giảng dạy theo môn; hồ sơ học sinh Tiểu học; phân hệ, menu Tiểu học (khung) | 1 | 19f đã gộp | YCTD-158 | Năm học 0076; định danh 0067 | 87 |
| 20b | Bán trú Tiểu học; nề nếp và thi đua lớp (tuỳ trường, bật tắt) | 1 | 19f đã gộp | YCTD-159 | Năm học 0077; định danh 0068 | 88 |
| 22c1 | Thời khoá biểu, phần khung: tiết, buổi, khung giờ theo cấp; thời khoá biểu lớp, giáo viên, phòng; nhập Excel; kiểm tra xung đột; ban hành có phiên bản; xem ở ứng dụng giáo viên, phụ huynh, trang công khai | 2 | 20a | YCTD-160 | Năm học 0078; hệ thống 0026; định danh 0069 | 89 |
| 20c | Đánh giá học sinh theo Thông tư 27/2020: thường xuyên (nhận xét), định kỳ (mức đạt môn học và hoạt động, điểm bài kiểm tra định kỳ), phẩm chất, năng lực; tổng hợp cuối kỳ, cuối năm; khoá số liệu | 2 | 20a | YCTD-161 | Năm học 0079; định danh 0070 | 90 |
| 20d | Sổ đầu bài và điểm danh theo tiết: ghi tiết dạy theo thời khoá biểu, nhận xét tiết, kí sổ; điểm danh theo tiết ở ứng dụng giáo viên; phụ huynh xem | 3 | 22c1 | YCTD-162 | Năm học 0080; định danh 0071 | 91 |
| 20e | Học bạ số, khen thưởng cuối năm, hoàn thành chương trình lớp học và hoàn thành chương trình tiểu học; lên lớp, rèn luyện trong hè, kiểm tra lại | 3 | 20c | YCTD-163 | Năm học 0081; định danh 0072 | 92 |
| 22c2 | Thời khoá biểu, phần máy xếp: xếp tự động theo ràng buộc có mức quan trọng, nhiều phương án; chỉnh tay có kiểm tra; dạy thay, đổi tiết; báo cáo tiết dạy, dùng phòng; mã QR tra cứu | 4 | 22c1 | YCTD-164 | Năm học 0082; định danh 0073 | 93 |
| 20f | Báo cáo, thống kê Tiểu học và EMIS Tiểu học (khung biểu cấu hình được, khớp Sở sau khảo sát); tổng hợp kết quả đánh giá theo lớp, khối, trường | 4 | 20c, 20e | YCTD-165 | Năm học 0083; hệ thống 0027; định danh 0074 | 94 |

Đợt làm, mỗi lúc tối đa hai phiên:
- Đợt 1: 20a và 20b (20b không cần môn học; chỉ dùng lớp, khối, cấp của DT-19).
- Đợt 2: 22c1 và 20c, bắt đầu khi 20a đã gộp.
- Đợt 3: 20d (khi 22c1 đã gộp) và 20e (khi 20c đã gộp).
- Đợt 4: 22c2 (khi 22c1 đã gộp) và 20f (khi 20c, 20e đã gộp).

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH, PQ, mã chức năng) theo đợt; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. YCTD, số migration, số e2e giữ sẵn ở bảng trên không đổi theo thứ tự gộp.

### 11.4 Phạm vi chi tiết

#### 20a. Nền Tiểu học

- **Môn học và hoạt động giáo dục** (năm học 0076): danh mục môn, hoạt động theo cấp (mã cố định, tên, loại: môn bắt buộc, tự chọn, hoạt động giáo dục; cách đánh giá: nhận xét và mức đạt, hay nhận xét, mức đạt và điểm bài kiểm tra định kỳ); số tiết mỗi tuần theo khối; gắn vào chương trình `curricula` của 19b. Nạp mặc định theo Chương trình giáo dục phổ thông 2018 cấp Tiểu học (Tiếng Việt, Toán, Đạo đức, Ngoại ngữ 1, Tự nhiên và Xã hội, Lịch sử và Địa lí, Khoa học, Tin học và Công nghệ, Giáo dục thể chất, Nghệ thuật, Hoạt động trải nghiệm; môn tự chọn Tiếng dân tộc thiểu số, Ngoại ngữ 1 ở lớp 1, 2); thời lượng đối chiếu văn bản gốc trước khi nạp.
- **Phân công giảng dạy theo môn:** `class_staff_assignments` thêm môn (thay `subject_name` tự do, dữ liệu cũ giữ nguyên ở Mầm non), số tiết được phân; tổng tiết của giáo viên so với định mức (cấu hình); một môn của một lớp một giáo viên tại một thời điểm. Màn hình phân công theo lớp và theo giáo viên, nhập Excel.
- **Hồ sơ học sinh Tiểu học:** dùng chung `children`; thêm trường riêng Tiểu học khi cần (học hòa nhập, học hai buổi một ngày, bán trú, môn tự chọn đăng ký) ở lớp dịch vụ theo cấp; mẫu nhập Excel theo cấp đã có ở 19d. Cột, nhãn khớp Sở sau khảo sát.
- **Phân hệ, menu:** phân hệ Quản lý giáo dục khi làm việc ở cấp Tiểu học hiện các nhóm của Tiểu học (gắn `levels: ['TH']`); số mục đánh tạm theo nhóm riêng, đánh lại khi khảo sát Sở. Quyền mới cho danh mục môn, phân công giảng dạy (định danh 0067).
- **Chức năng ứng dụng:** thêm mã chức năng Tiểu học vào `LEVEL_FEATURES` (19e) khi phần tương ứng làm.

#### 20b. Bán trú Tiểu học; nề nếp và thi đua lớp

- **Bán trú:** đăng ký bán trú theo học sinh và tháng (dùng dịch vụ, biểu phí theo khối của 19d), danh sách ăn theo ngày cho lớp Tiểu học (không dùng điểm danh theo ngày của Mầm non: giáo viên chốt số suất, báo cắt suất), nối bếp, thực đơn, kiểm thực ba bước (22b), tiền ăn tính theo ngày ăn thực tế như Mầm non. Ứng dụng phụ huynh báo cắt suất trước giờ chốt.
- **Nề nếp và thi đua lớp** (tuỳ trường, bật ở 1.4 Cấu hình trường): tiêu chí nề nếp theo tuần (cấu hình), ghi điểm cộng trừ theo lớp, người ghi (giáo viên trực, đội cờ đỏ là học sinh không có tài khoản thì giáo viên ghi thay), tổng hợp tuần, tháng, học kỳ, xếp hạng lớp. Không dùng bảng thi đua cán bộ của 22d.
- Quyền mới (định danh 0068).

#### 22c1. Thời khoá biểu: khung và nhập Excel

- **Khung thời gian theo cấp** (hệ thống 0026, cạnh `academic_year_level_settings` của 19b): buổi sáng, chiều; số tiết mỗi buổi; giờ bắt đầu, kết thúc từng tiết; ngày học trong tuần lấy theo cấp (19b).
- **Thời khoá biểu** (năm học 0078): phiên bản theo ngày hiệu lực; mỗi ô là lớp, thứ, tiết, môn, giáo viên (từ phân công 20a), phòng (từ danh mục phòng của cơ sở vật chất). Bảng `timetables` hiện có (hoạt động Mầm non) giữ nguyên cho Mầm non; thời khoá biểu theo môn là bảng mới, không đổi dữ liệu cũ.
- **Nhập Excel** theo mẫu (lớp × thứ × tiết), báo lỗi theo dòng như công cụ của 16a; **kiểm tra xung đột**: giáo viên trùng tiết, phòng trùng tiết, lớp vượt hoặc thiếu số tiết của môn so với chương trình, giáo viên vượt định mức; xung đột cứng chặn ban hành, xung đột mềm cảnh báo.
- **Ban hành** có phiên bản, người ban hành, ngày áp dụng; bản cũ giữ để tra cứu; thông báo giáo viên, phụ huynh của lớp.
- **Xem:** theo lớp, giáo viên, phòng ở cổng quản trị; ứng dụng giáo viên (lịch dạy của tôi), ứng dụng phụ huynh (thời khoá biểu của con); trang công khai ở website trường (18f) khi trường bật; xuất Excel, PDF.

#### 20c. Đánh giá học sinh theo Thông tư 27/2020

Phạm vi chốt sau khi đọc toàn văn Thông tư 27/2020/TT-BGDĐT; tóm tắt để chia phần:
- **Đánh giá thường xuyên:** nhận xét theo môn, hoạt động, phẩm chất, năng lực trong quá trình học (giáo viên nhập nhanh theo lớp, có thư viện câu nhận xét do trường quản lý); phụ huynh xem ở ứng dụng.
- **Đánh giá định kỳ** giữa và cuối mỗi học kỳ: mức đạt từng môn, hoạt động (Hoàn thành tốt, Hoàn thành, Chưa hoàn thành); điểm bài kiểm tra định kỳ cuối học kỳ ở các môn văn bản quy định (thang 10, theo khối); mức phẩm chất chủ yếu và năng lực chung, năng lực đặc thù (Tốt, Đạt, Cần cố gắng).
- **Tổng hợp cuối năm:** mức hoàn thành chương trình lớp học của từng học sinh theo quy tắc của Thông tư (gợi ý từ máy, giáo viên chủ nhiệm xác nhận); bảng tổng hợp kết quả theo lớp.
- **Quyền nhập** theo phân công (giáo viên bộ môn nhập môn mình dạy, chủ nhiệm nhập phẩm chất, năng lực, tổng hợp); **khoá số liệu** theo kỳ (Hiệu trưởng khoá, mở khoá có lý do, nhật ký); hạn nhập theo lịch học kỳ của cấp (19b).
- Nhập Excel theo mẫu lớp × môn; xuất bảng tổng hợp.

#### 20d. Sổ đầu bài và điểm danh theo tiết

- **Sổ đầu bài điện tử:** mỗi tiết theo thời khoá biểu đã ban hành (22c1) sinh một dòng; giáo viên dạy ghi tên bài, nội dung, nhận xét tiết, xếp loại tiết (nếu trường dùng), học sinh vắng; dạy thay, đổi tiết ghi người dạy thực tế; Hiệu trưởng, tổ trưởng xem và kí theo tuần (luồng kí nội bộ).
- **Điểm danh theo tiết:** ở ứng dụng giáo viên (mã chức năng mới trong `LEVEL_FEATURES` cho cấp `TH`, `THCS`, `THPT`), tổng hợp vắng có phép, không phép theo ngày; phụ huynh xem, báo vắng theo ngày (dùng lại báo vắng của 19e cho cấp khác khi phần này làm). Điểm danh theo ngày của Mầm non không đổi.
- Báo cáo chuyên cần theo lớp, tháng.

#### 20e. Học bạ số và khen thưởng cuối năm

- **Học bạ số** theo mẫu hiện hành của Bộ (đối chiếu văn bản gốc): thông tin học sinh, kết quả từng năm học đọc từ đánh giá đã khoá (20c), nhận xét của giáo viên chủ nhiệm, xác nhận của Hiệu trưởng; xuất PDF theo mẫu, kí bằng luồng kí nội bộ; lưu theo học sinh qua các năm học (chép sang năm học mới khi chuyển năm, 5.7).
- **Khen thưởng cuối năm:** đề xuất khen thưởng học sinh theo tiêu chí của Thông tư 27/2020 (máy gợi ý từ kết quả đánh giá, giáo viên chủ nhiệm đề nghị, Hiệu trưởng duyệt), giấy khen có mã tra cứu (dùng lại mẫu giấy khen 22d nếu hợp), khen thưởng đột xuất.
- **Hoàn thành chương trình:** danh sách hoàn thành chương trình lớp học, chưa hoàn thành (rèn luyện trong hè, kiểm tra lại, ở lại lớp); hoàn thành chương trình tiểu học ở lớp 5 nối hồ sơ chuyển cấp (tuyển sinh đầu cấp, 17c, 17d); lên lớp theo khối kế tiếp (logic của 19b).
- Phụ huynh xem học bạ, kết quả cuối năm ở ứng dụng.

#### 22c2. Thời khoá biểu: máy xếp

- **Máy xếp tự động** từ phân công (20a), khung thời gian, số tiết, phòng: ràng buộc cứng (không trùng giáo viên, phòng, lớp; giáo viên bận), ràng buộc mềm có mức quan trọng (tiết đôi, môn không học tiết cuối, rải đều trong tuần, giáo viên ít tiết trống); nhiều phương án để so; chạy nền có giới hạn thời gian; thuật toán chọn khi làm (tìm kiếm có ràng buộc hoặc heuristic), không dùng dịch vụ ngoài.
- **Chỉnh tay** trên lưới có kiểm tra xung đột ngay; **dạy thay, đổi tiết** theo ngày (không đổi bản ban hành, ghi vào sổ đầu bài 20d); **báo cáo** tiết dạy theo giáo viên, dùng phòng; **mã QR** tra cứu thời khoá biểu của lớp, giáo viên (đường dẫn không có tên miền ghi cứng).
- Nếu máy xếp chưa đạt chất lượng ở trường có dữ liệu thử, phần này dừng ở chỉnh tay và kiểm tra xung đột, ghi lại để đánh giá (mục 11.6).

#### 20f. Báo cáo, thống kê và EMIS Tiểu học

- **Thống kê Tiểu học:** lớp, học sinh theo khối, giới tính, dân tộc, khuyết tật, học hai buổi, bán trú (dùng khung tham số cấp của 19d); kết quả đánh giá theo lớp, khối, trường; khen thưởng; hoàn thành chương trình.
- **EMIS Tiểu học:** khung biểu cấu hình được (danh mục chỉ tiêu, công thức đọc từ dữ liệu), lập, xuất tệp theo bố cục của Bộ, đánh dấu đã gửi (mẫu "gửi lên cấp trên" bản chạy nội bộ của 16a); nội dung biểu khớp Sở khi khảo sát. Danh mục biểu ở hệ thống 0027.
- Gợi ý khảo sát: khi Eric có tài khoản Tiểu học, khảo sát như mục 31 (màn hình, cột, nút, biểu) rồi ghi đối chiếu vào tài liệu 31 và điều chỉnh 20a, 20f theo kết quả.

### 11.5 Quyết định thiết kế

Các lựa chọn dưới đây do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

- **Tách 22c thành 22c1 và 22c2:** khung, nhập Excel, kiểm tra xung đột đủ dùng cho trường tự xếp bằng phần mềm khác; máy xếp là bài toán tối ưu, rủi ro cao, làm sau và có thể dừng ở chỉnh tay.
- **Thời khoá biểu theo môn là bảng mới:** bảng `timetables` hiện có là lịch hoạt động Mầm non (tên hoạt động tự do); không chuyển đổi để không đổi hành vi Mầm non.
- **Bán trú Tiểu học không dùng điểm danh theo ngày của Mầm non:** Tiểu học điểm danh theo tiết (20d); suất ăn chốt theo danh sách bán trú và báo cắt suất.
- **Nề nếp, thi đua lớp tách khỏi thi đua cán bộ (22d)** và bật tắt theo trường vì không phải trường nào cũng dùng.
- **Không làm ở DT-20:** sổ điểm theo Thông tư 22/2021, tổ hợp môn, xét tốt nghiệp, sơ đồ chỗ ngồi, sao đỏ cấp THCS, THPT (DT-21); ngân hàng câu hỏi, ra đề (22g); chữ ký số thật, đồng bộ CSDL ngành thật (bản chạy nội bộ như DT-16).

### 11.6 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Hiểu sai Thông tư 27/2020 (mức đạt, môn có điểm, quy tắc tổng hợp, khen thưởng) | Đọc toàn văn trước khi viết phạm vi 20c, 20e; ghi điều khoản vào YCTD; kiểm thử đơn vị cho từng quy tắc tổng hợp với bảng ví dụ |
| Màn hình, cột, biểu EMIS lệch Sở vì chưa khảo sát | Danh mục, mẫu biểu cấu hình được; số mục menu đánh tạm; khảo sát khi có tài khoản rồi chỉnh (11.4, 20f) |
| Máy xếp thời khoá biểu chậm hoặc kết quả kém | Chạy nền có giới hạn thời gian; đo trên dữ liệu thử cỡ 30 lớp, 60 giáo viên; chưa đạt thì dừng ở chỉnh tay (22c2) |
| Sổ đầu bài, điểm danh theo tiết lệch thời khoá biểu khi đổi bản ban hành | Sổ sinh từ bản đang áp dụng theo ngày; dạy thay, đổi tiết ghi riêng; kiểm thử đổi bản giữa tuần |
| Học bạ bị sửa sau khi chốt | Học bạ đọc đánh giá đã khoá; mở khoá có lý do, nhật ký; kiểm thử quyền |
| Thay đổi làm đổi hành vi Mầm non (menu, điểm danh, bán trú, giảng dạy) | Mục mới gắn cấp `TH`; giữ bảng cũ; e2e và kiểm thử đơn vị hiện có đạt không sửa kỳ vọng |
| Hai phần cùng đợt cùng sửa tệp chung (cây menu, `LEVEL_FEATURES`, danh sách migration, quyền) | Số migration giữ sẵn riêng; sửa tệp chung theo kiểu thêm cuối; gộp origin/main trước khi mở PR |

**Cổng kiểm của mỗi phần DT-20:** kiểm thử đơn vị toàn bộ kho mã đạt không sửa kỳ vọng; e2e toàn bộ hiện có đạt cộng e2e mới của phần (chạy riêng, giữ khoá `e2e.lock`, không chạy cùng kiểm thử đơn vị toàn kho); typecheck, lint, build đạt; CI 4/4 xanh; phiên bản phần mềm tăng theo từng phần, riêng bản kế hoạch này (YCTD-157) chỉ đổi tài liệu.

### 11.7 Quy ước chung của DT-20

- Mỗi phần ghi YCTD giữ sẵn ở mục 11.3, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 14, 16, 17, 21, 23, 24, 32, `index.md` khi có thay đổi tương ứng), ghi văn bản căn cứ đã đọc, mở PR, gộp khi mọi kiểm tra CI đạt.
- Mã mới theo mục 11.2 (đa thuê bao, đọc cấp qua `SchoolLevelResolver`, không đổi hành vi Mầm non).
- Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần.

### 11.8 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| 20a | 1 | Đã làm, YCTD-158, phiên bản 0.107.0, PR 136: môn học và hoạt động giáo dục (năm học 0076 `subjects`), bộ môn mẫu Tiểu học, số tiết theo khối của chương trình (`curriculum_subjects`), phân công giảng dạy theo môn (`class_staff_assignments.subject_id`), tổng tiết của giáo viên, môn tự chọn của học sinh, nhóm menu "7. Dạy học Tiểu học"; định danh 0067 để trống (không thêm quyền); e2e 87 |
| 20b | 1 | Đã làm (PR #137, YCTD-159, phiên bản 0.108.0) |
| 22c1 | 2 | Đã làm, YCTD-160, phiên bản 0.109.0, PR 138: khung giờ tiết học (hệ thống 0026 `period_slots`), bản thời khoá biểu có ngày áp dụng và tiết theo lớp (năm học 0078 `timetable_versions`, `timetable_lessons`), giáo viên theo phân công của 20a, nhập Excel, kiểm tra xung đột (hàm `findTimetableConflicts` dùng chung với 22c2), ban hành; xem ở 7.4, ứng dụng giáo viên, phụ huynh, website; quyền `P02.timetable.manage` (định danh 0069); e2e 89 |
| 20c | 2 | Đã làm (PR #139, YCTD-161, phiên bản 0.110.0) |
| 20d | 3 | Đã làm, YCTD-162, phiên bản 0.111.0, PR 142: sổ đầu bài theo bản thời khoá biểu đang áp dụng (năm học 0080 `class_logs`), điểm danh theo tiết (`period_attendance`), giáo viên ký tiết, Ban giám hiệu ký sổ tuần (`class_log_reviews`, quyền `P02.class-log.review` định danh 0071); ứng dụng giáo viên Sổ đầu bài, phụ huynh Điểm danh theo tiết; 7.6, 7.7 có tổng hợp chuyên cần đối chiếu báo vắng; điểm danh Mầm non giữ nguyên; e2e 91 |
| 20e | 3 | Đã làm (PR #144, YCTD-163, phiên bản 0.112.0) |
| 22c2 | 4 | Đã làm, YCTD-164, phiên bản 0.113.0, PR 143: máy xếp tự viết (xếp tham lam rồi tìm kiếm cục bộ, ràng buộc bắt buộc và năm ràng buộc mềm có mức 0 đến 10, nhiều phương án, giới hạn thời gian) chạy ở `apps/worker` qua hàng đợi Redis; phương án thành bản nháp (năm học 0082); chỉnh tay có kiểm tra ngay; dạy thay, đổi tiết theo ngày (`timetable_changes`, nguồn tiết thực tế cho 20d); báo cáo tiết dạy, dùng phòng; mã QR và trang tra cứu công khai; định danh 0073 để trống; e2e 93. Đo trên dữ liệu thử 30 lớp, 66 giáo viên: điểm phạt 0 trong khoảng 12 giây mỗi phương án nên không phải dừng ở chỉnh tay |
| 20f | 4 | Đã làm (PR #148, YCTD-165, phiên bản 0.116.0) |


## 12. DT-21: THCS và THPT (kèm 22g kiểm tra, đánh giá)

### 12.1 Căn cứ và mục tiêu

1. Lộ trình Eric chốt ngày 2026-10-19: DT-18 → DT-19 (nền đa cấp học) → DT-20 (Tiểu học, kèm 22c) → DT-21 (THCS, THPT, kèm 22g) → DT-22 → DT-SaaS. Phạm vi DT-21 theo kế hoạch DT-18: sổ điểm theo Thông tư 22/2021/TT-BGDĐT (đánh giá thường xuyên, giữa kỳ, cuối kỳ; nhận xét và điểm số; xếp loại học lực, rèn luyện); học bạ số; thời khoá biểu môn học; sổ đầu bài; thi đua lớp và sao đỏ; sơ đồ chỗ ngồi; tổ hợp môn (THPT); xét tốt nghiệp và hồ sơ thi; EMIS THCS và THPT. Phần 22g (kiểm tra, đánh giá) thuộc kế hoạch DT-22, xếp vào DT-21 vì nối vào sổ điểm: kế hoạch kiểm tra và phân công ra đề; ma trận và bảng đặc tả; ngân hàng câu hỏi; đề nhiều mã, trộn đề; chấm trắc nghiệm theo phiếu; khoá đề, khoá điểm; báo cáo theo câu, chủ đề, mức nhận thức.
2. Mục tiêu: trường bật cấp THCS (khối 6 đến 9) hoặc THPT (khối 10 đến 12) dùng được School Management cho nghiệp vụ hằng ngày và cuối năm theo Chương trình giáo dục phổ thông 2018 và Thông tư 22/2021; trường chỉ có Mầm non hoặc Tiểu học không đổi gì.
3. **Chưa khảo sát hệ thống của Sở cấp THCS, THPT:** Eric chưa có tài khoản trường THCS, THPT trên hệ thống của Sở. DT-21 làm theo văn bản quy phạm và nghiệp vụ chung; màn hình, cột, số mục menu, mẫu biểu EMIS, hồ sơ thi khớp Sở **khảo sát sau** (khi Eric có tài khoản), như đã làm với Mầm non ở DT-15, DT-16 và dự kiến với Tiểu học ở DT-20. Phần nào cần khớp Sở ghi rõ ở 12.4 và để chỗ đổi (danh mục, mẫu biểu cấu hình được) thay vì ghi cứng.
4. Hiện trạng mã (đọc trên nhánh chính ngày 2026-10-24, sau khi 20a, 20b, 22c1, 20c đã gộp; 20d, 20e, 22c2, 20f của DT-20 đang làm hoặc chưa làm):
   - **Nền DT-19 dùng lại:** `school_levels`, `SchoolLevelResolver`, tham số `school_level` (19a, 19c); khối `grade_levels` (khối mẫu K1 đến K12 đã có từ 19b, THCS K6 đến K9, THPT K10 đến K12), lớp theo khối, `curricula` mặc định mỗi cấp, học kỳ, tuần, ngày học theo cấp; menu `levels`, nhãn thuật ngữ theo cấp; `LEVEL_FEATURES` cho ứng dụng phụ huynh, giáo viên; biểu phí theo khối; trường liên cấp ở bản trình diễn và lệnh `level-check` (19f).
   - **DT-20 đã gộp, dùng lại được ngay:** danh mục môn học và hoạt động `subjects`, số tiết theo khối `curriculum_subjects`, phân công giảng dạy theo môn `class_staff_assignments.subject_id`, môn tự chọn của học sinh (20a); nề nếp, thi đua lớp tuỳ trường (20b); khung giờ tiết `period_slots`, bản thời khoá biểu `timetable_versions`, `timetable_lessons`, nhập Excel, hàm `findTimetableConflicts`, ban hành, xem ở cổng, ứng dụng, website (22c1); đánh giá học sinh (20c, `apps/api/src/assessments`): cấu hình theo cấp (thang mức, kỳ đánh giá có hạn nhập theo lịch học kỳ của cấp), nhập theo phân công (giáo viên bộ môn, chủ nhiệm, người quản lý nhập thay), khoá số liệu theo kỳ và lớp, mở khoá từng lớp kèm lý do, nhật ký, phụ huynh xem kỳ đã khoá (`LEVEL_FEATURES.student_assessment`). Các bảng và hàm của 20a, 20b, 22c1 viết theo cấp, không riêng Tiểu học. 20c thì chỉ nhận lớp có kỳ đánh giá của cấp (lớp Mầm non bị từ chối), lưu mức đạt và điểm nguyên 1 đến 10 theo Thông tư 27/2020, nên không chứa được điểm hệ số của Thông tư 22/2021: 21c làm bảng điểm riêng và dùng lại cách phân quyền, hạn nhập, khoá, nhật ký của 20c, không sửa kỳ vọng của 20c.
   - **DT-20 chưa gộp, DT-21 dựa vào khi gộp:** sổ đầu bài, điểm danh theo tiết (20d); học bạ, khen thưởng, lên lớp (20e); máy xếp, dạy thay (22c2); khung EMIS theo cấp (20f). DT-21 dùng lại khung (khoá số liệu, sổ đầu bài, học bạ, máy xếp, biểu EMIS); dùng lại khung khoá số liệu và phân quyền của 20c; chỗ DT-20 ghi riêng cho Thông tư 27/2020 thì DT-21 thêm bảng và quy tắc cho Thông tư 22/2021, không sửa kỳ vọng của Tiểu học.
   - **Chưa có:** môn học, số tiết cho khối 6 đến 12; tổ hợp môn, nhóm môn lựa chọn; tổ bộ môn; sổ điểm (điểm thường xuyên, giữa kỳ, cuối kỳ, điểm trung bình môn, xếp loại); học bạ THCS, THPT; sơ đồ chỗ ngồi; sao đỏ; xét lên lớp, xét tốt nghiệp, hồ sơ thi; biểu EMIS THCS, THPT; toàn bộ 22g (kế hoạch kiểm tra, ngân hàng câu hỏi, đề, phiếu trả lời, báo cáo câu hỏi).

### 12.2 Nguyên tắc

- **Không đổi hành vi các cấp đã có:** chức năng mới gắn `levels: ['THCS', 'THPT']` ở menu và `LEVEL_FEATURES` ở ứng dụng; bảng mới có cột cấp hoặc gắn với lớp, khối có cấp. Toàn bộ e2e và kiểm thử đơn vị hiện có (kể cả Mầm non, Tiểu học) vẫn đạt không sửa kỳ vọng. Máy chủ chặn chức năng THCS, THPT ở lớp không thuộc hai cấp đó.
- **THCS và THPT chung khung, khác danh mục:** môn, tổ hợp, quy tắc xét theo cấp lấy từ danh mục cấu hình theo cấp; mã cấp `THCS` và `THPT` giữ nguyên như 19a.
- **Đọc cấp qua `SchoolLevelResolver`**; điểm cuối mới nhận tham số `school_level` dùng chung.
- **Danh mục cấu hình được, có bộ mặc định:** môn học và số tiết, tổ hợp môn, hệ số điểm, số lần đánh giá thường xuyên, thang xếp loại, mẫu nhận xét, mẫu học bạ, tiêu chí thi đua, biểu EMIS nạp mặc định theo văn bản hiện hành, trường sửa được trong phạm vi văn bản cho phép; đổi văn bản hoặc khớp Sở thì sửa danh mục, không sửa mã. Mã môn, mã mức đánh giá, mã xếp loại cố định trong mã.
- **Văn bản gốc trước phạm vi chi tiết:** mỗi phần đọc toàn văn văn bản căn cứ còn hiệu lực lúc làm (Thông tư 22/2021/TT-BGDĐT về đánh giá học sinh THCS, THPT; Chương trình giáo dục phổ thông 2018; Điều lệ trường trung học; quy chế xét công nhận tốt nghiệp THCS, thi tốt nghiệp THPT; hướng dẫn học bạ số, kiểm tra, đánh giá, ra đề hiện hành), ghi số hiệu, điều khoản vào YCTD của phần; chỗ kế hoạch này tóm tắt chỉ để chia phần. Văn bản có thay thế gần đây (quy chế thi, hệ số điểm, môn thi) kiểm lại trước khi nạp mặc định.
- **Một nguồn sự thật cho tiết học và điểm:** thời khoá biểu (22c1, mở rộng ở 21b) là nguồn của sổ đầu bài và điểm danh theo tiết; sổ điểm (21c) là nguồn duy nhất của điểm; 22g chấm xong thì **chuyển điểm vào sổ điểm** qua một cửa (giáo viên xác nhận, khoá đề, khoá điểm), không có bảng điểm thứ hai; học bạ (21e) và xét tốt nghiệp (21f) đọc từ điểm đã khoá.
- **Điểm là dữ liệu nhạy cảm:** quyền nhập theo phân công giảng dạy; sửa điểm sau khoá phải mở khoá có lý do, ghi nhật ký (ai, khi nào, giá trị cũ, giá trị mới); đề, ngân hàng câu hỏi chưa công bố chỉ người được giao và người có quyền xem; tệp đề lưu qua `storageKey`.
- **Viết sẵn cho đa thuê bao:** không thêm biến `.env` riêng của trường; khóa Redis qua `cacheKey`, tệp qua `storageKey`; bảng mới thuộc cơ sở dữ liệu của trường.
- **Dữ liệu thật:** không đưa dữ liệu thật của trường, học sinh, giáo viên, đề thi thật vào mã, dữ liệu mẫu, kiểm thử, tài liệu; dữ liệu mẫu THCS, THPT chỉ ở bản trình diễn (18h, 19f).
- **Chạy trong trường:** chấm phiếu trắc nghiệm, trộn đề, máy xếp thời khoá biểu chạy nền ở `worker`, không gửi dữ liệu ra dịch vụ ngoài; ảnh phiếu chấm không lưu ngoài kho tệp của trường.

### 12.3 Các phần

Số migration giữ sẵn bắt đầu sau DT-20 (DT-20 giữ đến năm học 0083, hệ thống 0027, định danh 0074): năm học 0084, hệ thống 0028, định danh 0075. Phần nào không cần số đã giữ thì để trống, không cho phần khác dùng (kho mã đã bật `allowUnorderedMigrations`). YCTD-166 dành cho chính bản kế hoạch này; YCTD của các phần từ YCTD-167. Spec e2e từ `95-`. DT-20 còn thừa số giữ sẵn (ví dụ 20f để trống hệ thống 0027) thì không dồn sang DT-21.

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD giữ sẵn | Migration giữ sẵn | e2e giữ sẵn |
|---|---|---|---|---|---|---|
| 21a | Nền THCS, THPT: môn học và số tiết khối 6 đến 12 (mở rộng 20a); tổ hợp môn và nhóm môn lựa chọn của THPT, học sinh đăng ký tổ hợp; tổ bộ môn; phân công giảng dạy dùng lại 20a; phân hệ, menu THCS, THPT (khung); ứng dụng | 1 | 20a (đã gộp) | YCTD-167 | Năm học 0084; định danh 0075 | 95 |
| 22g1 | Kiểm tra, đánh giá, phần đề: kế hoạch kiểm tra và phân công ra đề; ma trận, bảng đặc tả; ngân hàng câu hỏi; tạo đề nhiều mã, trộn đề; khoá đề; xuất đề, đáp án | 1 | 20a (môn), 19b; không cần 21a | YCTD-168 | Năm học 0085; định danh 0076 | 96 |
| 21b | Thời khoá biểu THCS, THPT: mở rộng 22c1, 22c2 cho môn khối 6 đến 12, tiết đôi, phòng bộ môn, lớp theo tổ hợp, học nhóm; máy xếp, dạy thay dùng lại 22c2 | 2 | 21a, 22c1 (đã gộp), 22c2 | YCTD-169 | Năm học 0086; định danh 0077 | 97 |
| 21c | Sổ điểm theo Thông tư 22/2021: điểm thường xuyên, giữa kỳ, cuối kỳ, nhận xét; điểm trung bình môn, kỳ, năm; xếp loại học tập, rèn luyện; khoá điểm | 2 | 21a, 20c (đã gộp: khung khoá số liệu, phân quyền) | YCTD-170 | Năm học 0087; định danh 0078 | 98 |
| 21d | Sổ đầu bài và điểm danh theo tiết cho THCS, THPT; sơ đồ chỗ ngồi; thi đua lớp, sao đỏ | 3 | 21b, 20d, 20b | YCTD-171 | Năm học 0088; định danh 0079 | 99 |
| 21e | Học bạ số THCS, THPT; khen thưởng cuối năm; xét lên lớp, rèn luyện trong hè, kiểm tra lại; kí | 3 | 21c, 20e | YCTD-172 | Năm học 0089; định danh 0080 | 100 |
| 22g2 | Kiểm tra, đánh giá, phần chấm: phiếu trả lời trắc nghiệm, chấm theo phiếu; nhập điểm bài tự luận; khoá điểm; chuyển điểm vào sổ điểm; báo cáo theo câu, chủ đề, mức nhận thức | 4 | 22g1, 21c | YCTD-173 | Năm học 0090; định danh 0081 | 101 |
| 21f | Xét tốt nghiệp THCS, THPT và hồ sơ thi: danh sách đủ điều kiện, hồ sơ dự thi, đăng ký môn thi, phòng thi, biên bản, kết quả; công nhận tốt nghiệp, giấy chứng nhận; hồ sơ chuyển cấp | 4 | 21e | YCTD-174 | Năm học 0091; hệ thống 0029; định danh 0082 | 102 |
| 21g | Báo cáo, thống kê THCS, THPT và EMIS THCS, THPT (khung biểu cấu hình được, khớp Sở sau khảo sát); tổng hợp kết quả học tập, rèn luyện theo lớp, khối, trường | 5 | 21c, 21e, 21f | YCTD-175 | Năm học 0092; hệ thống 0028; định danh 0083 | 103 |

Đợt làm, mỗi lúc tối đa hai phiên:
- Đợt 1: 21a và 22g1 (22g1 không cần tổ hợp môn; chỉ dùng môn của 20a và khối, lớp của DT-19). Bắt đầu được ngay vì 20a đã gộp.
- Đợt 2: 21b và 21c. 21b bắt đầu khi 21a đã gộp; nếu 22c2 chưa gộp thì 21b làm phần khung và nhập Excel, phần máy xếp cho khối 6 đến 12 làm sau khi 22c2 gộp (ghi vào YCTD-169). 21c bắt đầu khi 21a đã gộp;
- Đợt 3: 21d (khi 21b đã gộp) và 21e (khi 21c đã gộp).
- Đợt 4: 22g2 (khi 22g1, 21c đã gộp) và 21f (khi 21e đã gộp).
- Đợt 5: 21g (khi 21c, 21e, 21f đã gộp).

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH, PQ, mã chức năng) theo đợt; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. YCTD, số migration, số e2e giữ sẵn ở bảng trên không đổi theo thứ tự gộp. Hệ thống 0028 giữ cho 21g (danh mục biểu EMIS) dù 21f gộp trước; hệ thống 0029 của 21f chỉ dùng khi cần danh mục kỳ thi, mẫu hồ sơ.

### 12.4 Phạm vi chi tiết

#### 21a. Nền THCS, THPT

- **Môn học và số tiết** (năm học 0084, mở rộng `subjects`, `curriculum_subjects` của 20a): nạp mặc định theo Chương trình giáo dục phổ thông 2018 cho khối 6 đến 9 (môn bắt buộc, hoạt động trải nghiệm hướng nghiệp, nội dung giáo dục địa phương, môn tự chọn) và khối 10 đến 12 (môn bắt buộc, môn học lựa chọn, chuyên đề học tập, hoạt động giáo dục bắt buộc); loại môn: đánh giá bằng nhận xét hay bằng điểm số (khác Tiểu học, theo Thông tư 22/2021); số tiết mỗi tuần, số tiết cả năm theo khối (cần cho số lần đánh giá thường xuyên ở 21c). Thời lượng, tên môn đối chiếu văn bản gốc trước khi nạp.
- **Tổ hợp môn (THPT):** nhóm môn lựa chọn (khoa học tự nhiên, khoa học xã hội, công nghệ và nghệ thuật), tổ hợp do trường xây dựng từ các nhóm theo quy định (cấu hình được); học sinh đăng ký tổ hợp khi vào lớp 10, đổi tổ hợp có duyệt; lớp gắn tổ hợp hoặc lớp có nhiều tổ hợp (học nhóm, xem 21b); danh sách học sinh theo tổ hợp, theo môn lựa chọn; kiểm tra số môn, chuyên đề theo khung chương trình `curricula`.
- **Tổ bộ môn:** tổ chuyên môn theo môn (dùng `org_unit_levels`, danh mục phòng ban hiện có nếu hợp; thêm bảng tổ bộ môn nếu không), tổ trưởng, thành viên, số tiết định mức theo chức danh; liên kết với phân công giảng dạy (20a: tổng tiết giáo viên so với định mức).
- **Phân công giảng dạy:** dùng lại màn hình, nhập Excel của 20a; thêm giáo viên bộ môn dạy nhiều lớp, nhiều khối; kiểm tra một môn của một lớp một giáo viên tại một thời điểm; lớp theo tổ hợp.
- **Hồ sơ học sinh THCS, THPT:** dùng chung `children`; thêm trường riêng khi cần (tổ hợp đăng ký, diện ưu tiên, dân tộc, khuyết tật học hòa nhập, nội trú, học nghề, ngoại ngữ), mẫu nhập Excel theo cấp đã có ở 19d. Cột, nhãn khớp Sở sau khảo sát.
- **Phân hệ, menu, ứng dụng:** nhóm menu THCS, THPT gắn `levels` (số mục đánh tạm, đánh lại khi khảo sát Sở); mã chức năng THCS, THPT thêm vào `LEVEL_FEATURES` khi phần tương ứng làm; quyền mới cho danh mục môn khối 6 đến 12, tổ hợp, tổ bộ môn (định danh 0075).

#### 22g1. Kiểm tra, đánh giá: đề

- **Kế hoạch kiểm tra:** kế hoạch theo học kỳ và khối (kiểm tra thường xuyên, giữa kỳ, cuối kỳ; môn, hình thức, thời gian, tuần), duyệt của tổ trưởng, Hiệu trưởng; **phân công ra đề**, thẩm định, hạn nộp; theo dõi tiến độ; lịch kiểm tra tập trung đối chiếu thời khoá biểu 22c1 để tránh trùng tiết ở mức nhắc việc, không tự xếp phòng thi (phòng thi thuộc 21f).
- **Ma trận, bảng đặc tả:** ma trận đề (nội dung × mức nhận thức nhận biết, thông hiểu, vận dụng, vận dụng cao × dạng câu hỏi trắc nghiệm nhiều lựa chọn, đúng sai, trả lời ngắn, tự luận; số câu, điểm); bảng đặc tả; kiểm tra tổng điểm, tỉ lệ mức nhận thức khớp mẫu của văn bản hiện hành (mẫu cấu hình được vì mẫu theo môn, theo năm có thể đổi).
- **Ngân hàng câu hỏi:** câu hỏi theo môn, khối, chủ đề (theo chương trình), mức nhận thức, dạng, đáp án, thang điểm, ảnh và công thức đơn giản, trạng thái (nháp, thẩm định, dùng được, ngừng dùng), người soạn, tổ trưởng duyệt; tìm, lọc, nhập từ tệp theo mẫu; thống kê số câu theo chủ đề, mức; lịch sử sử dụng của từng câu (nối báo cáo ở 22g2). Ngân hàng dùng được cho cả Tiểu học khi cần, nhưng DT-21 chỉ bật menu THCS, THPT.
- **Tạo đề:** từ ma trận bốc câu theo yêu cầu (ngẫu nhiên có điều kiện, không trùng câu đã dùng gần đây theo cấu hình); **nhiều mã đề**, trộn thứ tự câu và đáp án có bảng đối chiếu mã; soạn tay thêm câu tự luận; **khoá đề** (đề đã khoá không sửa, mở khoá có lý do, ghi nhật ký); xuất PDF, Word, đáp án và hướng dẫn chấm; đề chưa công bố ẩn với người không được giao.
- Quyền mới (định danh 0076).

#### 21b. Thời khoá biểu THCS, THPT

- **Mở rộng 22c1:** khung giờ tiết theo cấp THCS, THPT (sáng, chiều, số tiết, giờ; ngày học theo cấp); thời khoá biểu theo môn, khối 6 đến 12 dùng bảng `timetable_versions`, `timetable_lessons` đã có; nhập Excel mẫu lớp × thứ × tiết; hàm `findTimetableConflicts` dùng chung, thêm quy tắc: tiết đôi, môn thực hành cần phòng bộ môn, giáo viên dạy nhiều lớp, tổ bộ môn.
- **Lớp theo tổ hợp, học nhóm (THPT):** một lớp có thể tách nhóm học môn lựa chọn khác nhau cùng tiết; ô thời khoá biểu gắn nhóm; học sinh thuộc nhóm theo đăng ký môn của 21a; giáo viên, phòng trùng tiết tính theo nhóm. Nếu hình dạng bảng của 22c1 chưa chứa nhóm thì thêm cột nhóm có giá trị mặc định (lớp nguyên), không đổi dữ liệu Tiểu học.
- **Máy xếp, dạy thay, báo cáo, mã QR:** dùng lại 22c2; thêm ràng buộc cho THCS, THPT (tiết đôi, buổi, giáo viên dạy nhiều khối, nhóm); nếu 22c2 chưa gộp, 21b làm khung và nhập Excel trước, phần máy xếp làm sau khi 22c2 gộp (12.3).
- Xem ở cổng quản trị, ứng dụng giáo viên, phụ huynh, website (18f); xuất Excel, PDF.

#### 21c. Sổ điểm theo Thông tư 22/2021

Phạm vi chốt sau khi đọc toàn văn Thông tư 22/2021/TT-BGDĐT; tóm tắt để chia phần (hệ số, số lần đánh giá, thang xếp loại kiểm lại với văn bản trước khi nạp mặc định):
- **Cấu trúc điểm theo môn, kỳ:** đánh giá thường xuyên (số lần theo số tiết của môn cả năm), giữa kỳ, cuối kỳ; môn đánh giá bằng điểm (thang 10, hệ số theo loại điểm) và môn đánh giá bằng nhận xét (Đạt, Chưa đạt); nhận xét của giáo viên cho từng học sinh; điểm miễn, vắng thi, thi bù (cấu hình được).
- **Tính điểm:** điểm trung bình môn học kỳ, điểm trung bình môn cả năm, điểm trung bình các môn học kỳ, cả năm (hàm thuần, kiểm thử bằng bảng ví dụ theo từng công thức của Thông tư; làm tròn theo văn bản); chỗ Thông tư cho phép trường quyết định (số lần đánh giá thường xuyên cao hơn mức tối thiểu) là cấu hình.
- **Xếp loại:** kết quả học tập (Tốt, Khá, Đạt, Chưa đạt) và kết quả rèn luyện (Tốt, Khá, Đạt, Chưa đạt) theo kỳ và cả năm; máy gợi ý theo điều kiện của Thông tư (điều kiện theo điểm môn, số môn đạt, môn đánh giá bằng nhận xét), giáo viên chủ nhiệm xác nhận, rèn luyện do giáo viên chủ nhiệm nhập; danh hiệu học sinh Xuất sắc, Giỏi tính từ xếp loại đã khoá (nối 21e).
- **Quyền nhập, khoá:** giáo viên bộ môn nhập điểm môn mình dạy ở lớp được phân công (20a); chủ nhiệm nhập rèn luyện, nhận xét chung; **khoá điểm** theo kỳ (Hiệu trưởng khoá, mở khoá có lý do, nhật ký, giá trị cũ và mới); hạn nhập theo lịch học kỳ của cấp (19b); nhập nhanh theo lớp, theo môn, nhập Excel mẫu lớp × môn × loại điểm, báo lỗi theo dòng.
- **Xem và xuất:** sổ điểm lớp, môn; bảng điểm cá nhân; phụ huynh xem điểm, nhận xét, xếp loại của con ở ứng dụng (mã chức năng mới ở `LEVEL_FEATURES`); xuất Excel, PDF; thông báo khi giáo viên công bố điểm theo kỳ (tuỳ trường, cấu hình).
- **Nguồn điểm:** mỗi điểm ghi nguồn (nhập tay, nhập Excel, từ 22g2); điểm bài kiểm tra tập trung do 22g2 chuyển vào đúng loại điểm sau khi giáo viên xác nhận.

#### 21d. Sổ đầu bài, điểm danh theo tiết, sơ đồ chỗ ngồi, thi đua lớp, sao đỏ

- **Sổ đầu bài và điểm danh theo tiết:** dùng lại khung 20d cho THCS, THPT (mỗi tiết theo thời khoá biểu đã ban hành sinh một dòng; tên bài, nhận xét tiết, xếp loại tiết, học sinh vắng có phép, không phép, đi muộn; dạy thay, đổi tiết; kí theo tuần); thêm môn theo nhóm của 21b; phụ huynh xem, báo vắng; báo cáo chuyên cần. Phần làm mới là mở khung cho cấp THCS, THPT, quy tắc xếp loại tiết và biểu mẫu cấp.
- **Sơ đồ chỗ ngồi:** lưới chỗ ngồi theo lớp (số dãy, số hàng, bàn đôi), xếp học sinh vào chỗ bằng kéo thả hoặc xoay vòng theo kỳ, ghi ngày áp dụng; sơ đồ theo tiết hoặc theo môn (tuỳ trường, mặc định theo lớp); in sơ đồ; giáo viên bộ môn xem ở sổ đầu bài.
- **Thi đua lớp, sao đỏ:** dùng lại 20b (tiêu chí nề nếp theo tuần, ghi điểm cộng trừ theo lớp, tổng hợp, xếp hạng) cho THCS, THPT; đội sao đỏ là học sinh không có tài khoản nên giáo viên trực ghi thay (quyết định ở 12.6); tiêu chí cấp THCS, THPT cấu hình được; không dùng bảng thi đua cán bộ của 22d.
- Quyền mới (định danh 0079).

#### 21e. Học bạ số, khen thưởng, lên lớp

- **Học bạ số THCS, THPT** theo mẫu hiện hành (đối chiếu văn bản gốc): thông tin học sinh; kết quả học tập từng môn, từng kỳ, cả năm đọc từ sổ điểm đã khoá (21c); xếp loại học tập, rèn luyện; nhận xét của giáo viên chủ nhiệm; xác nhận của Hiệu trưởng; xuất PDF theo mẫu, kí bằng luồng kí nội bộ (16k, 17b), chữ ký số thật để sau; lưu qua các năm học và qua cấp (hồ sơ chuyển cấp từ THCS lên THPT nối 21f); dùng lại khung học bạ của 20e, thêm mẫu cấp.
- **Khen thưởng cuối năm:** danh hiệu học sinh Xuất sắc, Giỏi, khen thưởng đột xuất, giấy khen có mã tra cứu (dùng lại mẫu của 20e, 22d), duyệt của Hiệu trưởng.
- **Xét lên lớp:** điều kiện lên lớp, rèn luyện trong hè, kiểm tra lại, ở lại lớp (quy tắc của Thông tư 22/2021, cấu hình được ở chỗ cho phép); lên lớp theo khối kế tiếp (logic 19b); cuối khối 9 và khối 12 chuyển sang xét tốt nghiệp (21f).
- Phụ huynh xem học bạ, kết quả cuối năm ở ứng dụng.

#### 22g2. Kiểm tra, đánh giá: chấm và báo cáo

- **Phiếu trả lời trắc nghiệm, chấm theo phiếu:** mẫu phiếu (số câu, số đáp án, mã đề, số báo danh) in được; chấm bằng ảnh chụp, tệp quét của phiếu: nhận dạng ô tô, mã đề, số báo danh chạy nền ở `worker` ngay trong trường, người dùng soát các phiếu mờ, tô sai, không đọc được; chấm theo đáp án của mã đề (bảng đối chiếu 22g1); chấm đúng sai, trả lời ngắn theo quy tắc điểm của đề; nhập tay bài trắc nghiệm khi không có ảnh.
- **Bài tự luận và điểm:** nhập điểm theo câu hoặc theo bài, chấm hai người (cấu hình), tổng hợp điểm bài; **khoá điểm** theo bài kiểm tra; **chuyển điểm vào sổ điểm 21c** đúng loại điểm (thường xuyên, giữa kỳ, cuối kỳ), giáo viên bộ môn xác nhận; học sinh vắng, điểm bù xử lý theo cấu hình.
- **Báo cáo:** theo câu (tỉ lệ đúng, độ khó, độ phân biệt), theo chủ đề, theo mức nhận thức, theo lớp, giáo viên, đề; phân bố điểm; danh sách câu nên xem lại; ghi kết quả sử dụng vào lịch sử câu hỏi ở ngân hàng (22g1); xuất Excel, PDF.
- Chưa làm ở DT-21: thi trực tuyến cho học sinh làm bài trên máy (cần giám sát, khác nghiệp vụ; ghi lại để xét sau), chấm tự luận bằng máy.
- Quyền mới (định danh 0081).

#### 21f. Xét tốt nghiệp và hồ sơ thi

- **Xét công nhận tốt nghiệp THCS** (cuối khối 9) theo quy chế hiện hành: điều kiện (hoàn thành chương trình, xếp loại), danh sách đủ điều kiện, hội đồng xét, biên bản, danh sách được công nhận, giấy chứng nhận tốt nghiệp tạm thời, hồ sơ chuyển cấp lên THPT (nối tuyển sinh đầu cấp 17c, 17d).
- **Hồ sơ thi tốt nghiệp THPT** (khối 12): hồ sơ dự thi (đăng ký môn thi, đối tượng ưu tiên, khuyến khích, miễn thi), danh sách thí sinh, số báo danh, phòng thi, giám thị, biên bản, nhập kết quả thi, xét công nhận tốt nghiệp theo điểm xét (quy tắc cấu hình theo năm vì quy chế thi thay đổi), giấy chứng nhận tốt nghiệp tạm thời; xuất tệp theo bố cục của Bộ, Sở (bản chạy nội bộ, đánh dấu đã gửi như 16a; đồng bộ thật để sau).
- **Phòng thi, số báo danh dùng chung:** phần xếp phòng, số báo danh dùng được cho kỳ kiểm tra tập trung của 22g.
- Cấu hình theo năm: quy chế thi, môn thi, hệ số, điểm khuyến khích đổi hằng năm; danh mục nạp ở hệ thống 0029, người dùng có quyền sửa. Mẫu hồ sơ, bố cục tệp khớp Sở khảo sát sau.
- Quyền mới (định danh 0082).

#### 21g. Báo cáo, thống kê và EMIS THCS, THPT

- **Thống kê THCS, THPT:** lớp, học sinh theo khối, giới tính, dân tộc, khuyết tật, tổ hợp (THPT), nội trú; kết quả học tập, rèn luyện theo lớp, khối, trường; học sinh Xuất sắc, Giỏi; lên lớp, ở lại lớp; tốt nghiệp (dùng khung tham số cấp của 19d); phổ điểm môn; tổng hợp theo giáo viên, tổ bộ môn.
- **EMIS THCS, THPT:** khung biểu cấu hình được (danh mục chỉ tiêu, công thức đọc từ dữ liệu), lập, xuất tệp theo bố cục của Bộ, đánh dấu đã gửi; dùng khung 20f của Tiểu học, thêm biểu cấp THCS, THPT. Danh mục biểu ở hệ thống 0028.
- Gợi ý khảo sát: khi Eric có tài khoản THCS, THPT, khảo sát như mục 31 (màn hình, cột, nút, biểu), ghi đối chiếu vào tài liệu 31, điều chỉnh 21a, 21f, 21g theo kết quả.

### 12.5 Tái dùng và làm mới

| Chức năng | Tái dùng từ | Phải làm mới ở DT-21 |
|---|---|---|
| Môn học, số tiết | 20a (`subjects`, `curriculum_subjects`) | Bộ môn khối 6 đến 12, loại đánh giá bằng điểm, môn lựa chọn, chuyên đề |
| Phân công giảng dạy | 20a (`class_staff_assignments.subject_id`) | Dạy nhiều khối, lớp theo tổ hợp, tổ bộ môn |
| Thời khoá biểu | 22c1 (khung giờ, bản, tiết, xung đột, ban hành), 22c2 (máy xếp) | Tiết đôi, phòng bộ môn, nhóm theo tổ hợp |
| Sổ đầu bài, điểm danh theo tiết | 20d | Mẫu và xếp loại tiết cấp THCS, THPT |
| Điểm, đánh giá | 20c (đã gộp: cách phân quyền theo phân công, hạn nhập theo kỳ, khoá theo kỳ và lớp, nhật ký) | Toàn bộ sổ điểm Thông tư 22/2021 (khác Thông tư 27/2020) |
| Học bạ, khen thưởng, lên lớp | 20e (khung, kí, mẫu giấy khen) | Mẫu học bạ, danh hiệu, quy tắc lên lớp cấp THCS, THPT |
| Thi đua lớp, sao đỏ | 20b | Tiêu chí cấp THCS, THPT, xử lý đội sao đỏ |
| EMIS, thống kê | 19d, 20f | Biểu THCS, THPT |
| Kí hồ sơ, xuất PDF, nhập Excel | 16k, 17b, 16a | Không (dùng lại) |
| Kiểm tra, đánh giá (22g), tổ hợp môn, sơ đồ chỗ ngồi, xét tốt nghiệp, hồ sơ thi | không có | Toàn bộ |

### 12.6 Quyết định thiết kế

Các lựa chọn dưới đây do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

- **THCS và THPT làm chung một đợt, chung khung:** hai cấp cùng Thông tư 22/2021, cùng khung sổ điểm, học bạ; khác ở danh mục môn, tổ hợp (chỉ THPT), xét tốt nghiệp (THCS xét, THPT thi) và biểu EMIS. Tách phần theo chức năng, không theo cấp, để mỗi phần dùng được cho cả hai cấp.
- **22g tách hai phần:** 22g1 (đề) độc lập với sổ điểm nên làm sớm, song song với 21a; 22g2 (chấm, báo cáo) cần sổ điểm 21c để chuyển điểm.
- **Điểm chỉ vào một bảng:** 22g2 không tạo bảng điểm riêng; chuyển vào sổ điểm có ghi nguồn, giáo viên xác nhận.
- **Thi trực tuyến cho học sinh để lại:** thêm giám sát, tải tập trung, chống gian lận; ngoài phạm vi kế hoạch DT-22 đã duyệt.
- **Sao đỏ không có tài khoản học sinh ở bản đầu:** giáo viên trực ghi thay như 20b; tài khoản học sinh hạn chế chỉ làm khi Eric yêu cầu.
- **Chấm phiếu ở trong trường:** nhận dạng phiếu chạy ở `worker`, không dùng dịch vụ ngoài vì ảnh phiếu là dữ liệu học sinh; nếu chất lượng nhận dạng chưa đạt ở ảnh chụp điện thoại thì giữ nhập tay và tệp quét chuẩn (12.7).
- **Hồ sơ thi chạy nội bộ:** xuất tệp theo bố cục, đánh dấu đã gửi; đồng bộ thật với hệ thống của Sở, Bộ để sau như DT-16, DT-20.
- **Không làm ở DT-21:** các phần còn lại của DT-22, chữ ký số thật, đồng bộ CSDL ngành thật, thi trực tuyến, chấm tự luận bằng máy, tuyển sinh đầu cấp vào lớp 10 (chỉ nối hồ sơ chuyển cấp).

### 12.7 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Hiểu sai Thông tư 22/2021 (hệ số, số lần đánh giá, làm tròn, điều kiện xếp loại, lên lớp) hoặc dùng văn bản đã hết hiệu lực | Đọc toàn văn trước khi viết phạm vi 21c, 21e; ghi điều khoản vào YCTD; hàm tính thuần, kiểm thử đơn vị bằng bảng ví dụ cho từng công thức; kiểm lại văn bản còn hiệu lực lúc làm |
| Quy chế tốt nghiệp, thi thay đổi theo năm | Quy tắc xét, môn thi, hệ số cấu hình theo năm ở danh mục hệ thống 0029; mỗi năm chỉ sửa danh mục (21f) |
| Màn hình, cột, biểu EMIS, hồ sơ thi lệch Sở vì chưa khảo sát | Danh mục, mẫu biểu cấu hình được; số mục menu đánh tạm; khảo sát khi có tài khoản rồi chỉnh (12.1, 12.4) |
| Sổ điểm lớn, nhiều giáo viên nhập đồng thời, tải chậm | Chỉ mục theo lớp, môn, kỳ; lưu theo ô điểm; kiểm thử tải cỡ 40 lớp, 1.600 học sinh, 12 môn; nhập theo lô |
| Sửa điểm sau khoá, mất dấu vết | Mở khoá có lý do, nhật ký đủ giá trị cũ, mới; kiểm thử quyền; điểm từ 22g2 ghi nguồn |
| Chấm phiếu nhận dạng sai, nhất là ảnh chụp điện thoại | Soát các phiếu độ tin cậy thấp; đo trên phiếu mẫu tự sinh (không dùng phiếu thật); chưa đạt thì dừng ở nhập tay và tệp quét chuẩn |
| Đề, ngân hàng câu hỏi lộ trước giờ thi | Quyền xem theo người được giao; khoá đề; tệp đề qua `storageKey`, tải có ghi nhật ký; kiểm thử quyền |
| DT-20 chưa gộp khi DT-21 bắt đầu (20d, 20e, 22c2, 20f) | Bảng phụ thuộc 12.3 ghi rõ; phần chờ thì tự làm khung đủ dùng theo cùng hình dạng và hợp nhất khi phần kia gộp, ghi vào YCTD; không chép mã |
| Thay đổi làm đổi hành vi Mầm non, Tiểu học (menu, thời khoá biểu, sổ đầu bài, môn học) | Mục mới gắn cấp `THCS`, `THPT`; cột thêm có giá trị mặc định; e2e và kiểm thử đơn vị hiện có đạt không sửa kỳ vọng |
| Hai phần cùng đợt cùng sửa tệp chung (cây menu, `LEVEL_FEATURES`, danh sách migration, quyền, thời khoá biểu) | Số migration giữ sẵn riêng; sửa tệp chung theo kiểu thêm cuối; gộp origin/main trước khi mở PR |

**Cổng kiểm của mỗi phần DT-21:** kiểm thử đơn vị toàn bộ kho mã đạt không sửa kỳ vọng; e2e toàn bộ hiện có đạt cộng e2e mới của phần (chạy riêng, giữ khoá `e2e.lock`, không chạy cùng kiểm thử đơn vị toàn kho); typecheck, lint, build đạt; CI 4/4 xanh; phiên bản phần mềm tăng theo từng phần, riêng bản kế hoạch này (YCTD-166) chỉ đổi tài liệu.

### 12.8 Quy ước chung của DT-21

- Mỗi phần ghi YCTD giữ sẵn ở mục 12.3, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 14, 16, 17, 21, 23, 24, 32, `index.md` khi có thay đổi tương ứng), ghi văn bản căn cứ đã đọc, mở PR, gộp khi mọi kiểm tra CI đạt.
- Mã mới theo mục 12.2 (đa thuê bao, đọc cấp qua `SchoolLevelResolver`, không đổi hành vi các cấp đã có).
- Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần.

### 12.9 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| 21a | 1 | Đã làm, YCTD-167, phiên bản 0.114.0: bộ môn mẫu THCS, THPT, nhóm môn lựa chọn (năm học 0084 `subjects.option_group`), tổ hợp môn và đăng ký (đổi thì chờ duyệt), tổ bộ môn, nhóm menu "7. Dạy học" dùng chung ba cấp, 7.12, 7.13; định danh 0075 để trống (không thêm quyền); e2e 95 |
| 22g1 | 1 | Đã làm, YCTD-168, phiên bản 0.117.0, PR 149: ngân hàng câu hỏi (nguồn duy nhất, 22h2 tham chiếu), chủ đề, thẩm định, nhập Excel, thống kê; ma trận và bảng đặc tả; kế hoạch kiểm tra; giao đề, bốc câu theo ma trận, đề nhiều mã, thẩm định, khoá đề, xuất Word, PDF (năm học 0085); quyền `P02.question.author`, `P02.exam.review`, `P02.exam.manage` (định danh 0076); nhóm menu 8 "Kiểm tra, đánh giá" cho THCS, THPT; e2e 96 |
| 21b | 2 | Đã làm, YCTD-169, phiên bản 0.118.0, PR 151: menu thời khoá biểu ba cấp; tiết học nhóm (năm học 0086 `timetable_lessons.group_no`); luật nhóm, tiết đôi, phòng bộ môn; nhập Excel cột Nhóm; thời khoá biểu của con theo tổ hợp môn; máy xếp bỏ qua môn học lựa chọn; dạy thay chỉ cho tiết cả lớp; chưa làm: xếp tự động tiết nhóm, đổi tiết nhóm, định mức tổ bộ môn; e2e 97 |
| 21c | 2 | Đã làm, YCTD-170, phiên bản 0.115.0: sổ điểm theo Thông tư 22/2021 (năm học 0087 `score_entries`, `subject_term_results`, `term_ratings`, `score_locks`, `score_configs`), trung bình học kỳ, cả năm, gợi ý và xác nhận xếp loại học tập, rèn luyện, khoá điểm, cấu hình theo cấp, mục 7.14, ứng dụng giáo viên, phụ huynh; định danh 0078 để trống (không thêm quyền); e2e 98 |
| 21d | 3 | Đã làm (PR #157, YCTD-171, phiên bản 0.123.0) |
| 21e | 3 | Đã làm, YCTD-172, phiên bản 0.120.0: học bạ số, khen thưởng (Xuất sắc, Giỏi), xét lên lớp, hoàn thành cấp học THCS, THPT trên khung 20e (đọc sổ điểm 21c), học bạ có điểm trung bình hai học kỳ, cả năm, kí nội bộ in đủ số định danh kèm kiểm quyền (năm học 0089 căn cứ danh hiệu); định danh 0080 để trống (không thêm quyền); e2e 100 |
| 22g2 | 4 | Đã làm, YCTD-173, phiên bản 0.121.0, PR 155: bài kiểm tra của lớp từ đề đã khoá; phiếu trả lời PDF; nhập bài tay, nhập tệp quét theo mẫu (chưa nhận dạng ảnh); chấm tự luận hai người; khoá điểm; chuyển sổ điểm 21c qua một cửa; báo cáo theo câu, chủ đề, mức nhận thức, lớp, phân bố điểm, xuất Excel, PDF; ghi kết quả dùng câu (năm học 0090); quyền `P02.exam.grade` (định danh 0081); menu 8.5, 8.6; e2e 101 |
| 21f | 4 | Đã làm, YCTD-174, phiên bản 0.124.0: kỳ xét tốt nghiệp THCS, THPT, hồ sơ dự thi, số báo danh, phòng thi, điểm thi, công nhận có biên bản hội đồng, giấy chứng nhận, tệp xuất và đánh dấu đã gửi thủ công, hồ sơ chuyển cấp THCS (năm học 0091); hệ thống 0029, định danh 0082 để trống (không thêm quyền); e2e 102 |
| 21g | 5 | Đã làm (PR #159, YCTD-175, phiên bản 0.127.0) |

## 13. DT-22: thư viện, bồi dưỡng, kho học liệu số (22a, 22e, 22h)

### 13.1 Căn cứ và mục tiêu

1. Lộ trình Eric chốt ngày 2026-10-19: DT-18 (kèm 22b, 22d, 22f, 22i) → DT-19 → DT-20 (kèm 22c) → DT-21 (kèm 22g) → DT-22 → DT-SaaS. Bản kế hoạch "bổ sung 9 phần theo khảo sát 9 trang" (bản để Eric phê duyệt, lưu ngoài kho) đã được Eric duyệt đủ chín phần; sáu phần đã chạy cùng DT-18, DT-20, DT-21. DT-22 là phần còn lại: **22a thư viện trường học, 22e hồ sơ bồi dưỡng giáo viên, 22h kho học liệu số của trường**. Phạm vi và độ lớn từng phần theo bản kế hoạch đó, chốt lại ở 13.3, 13.4 sau khi đối chiếu mã.
2. Quyết định của Eric đã chốt, áp dụng cho cả DT-22:
   - **AI là thành phần riêng, mặc định tắt**: chỉ gợi ý, có người duyệt, dùng dữ liệu đã khử định danh, không gửi dữ liệu trẻ em ra dịch vụ ngoài. Ba phần của DT-22 **không gọi AI**; chỗ AI có thể gợi ý (gắn thẻ và chủ đề cho học liệu, soạn câu hỏi nháp, gợi ý nội dung bồi dưỡng) chỉ để sẵn điểm nối, không làm trong DT-22 (13.5). **Cập nhật 2026-10-26:** Eric đồng ý đưa AI vào; phần soạn câu hỏi nháp và kế hoạch bài dạy nháp làm ở **23d của DT-23** (mục 15), không thuộc DT-22.
   - **Khách hàng là trường đơn lẻ**: không làm phần tổng hợp cho Phòng, Sở; chia sẻ học liệu liên trường thật chờ DT-SaaS, DT-22 chỉ làm bản chạy nội bộ bằng gói tệp (22h2).
3. Mục tiêu: trường có ba thứ còn thiếu của một trường phổ thông hoàn chỉnh: thư viện quản lý được sách, bạn đọc, mượn trả, kiểm kê, báo cáo theo chuẩn; hồ sơ bồi dưỡng của từng giáo viên (kế hoạch, đăng ký, kết quả, chứng chỉ, chứng nhận có mã tra cứu, năng lực số); kho học liệu số có giấy phép và kiểm duyệt, nối với ngân hàng câu hỏi của 22g1.
4. Các phần này **không cần khảo sát hệ thống của Sở** (Sở không có chức năng tương ứng) mà chỉ làm theo nghiệp vụ chung và văn bản quy phạm; phạm vi suy ra từ mô tả công khai của chín trang đã khảo sát và từ thông tư, Eric chỉnh khi nghiệm thu (Eric đã quyết định không xin demo, ngày 2026-10-19).
5. Hiện trạng mã (đọc trên nhánh chính ngày 2026-10-24, sau khi 20a, 20b, 22c1 đã gộp; kế hoạch DT-21 ở mục 12, PR 140, có thể chưa gộp):
   - **Đã có, dùng lại:**
     - Kho hồ sơ chuyên môn 18e (`professional_folders`, `professional_rounds`, `professional_documents`, `professional_document_versions`, `professional_document_events`, nhóm công tác): thư mục theo năm học, đợt nộp, luồng duyệt tổ trưởng rồi Ban Giám hiệu, phiên bản, trả lại, kí nội bộ qua `DossierSigner`. Việc của tôi (`my-work`, giao diện `MyWorkSource`) cho phần mới tự thêm nguồn việc chờ.
     - Tệp: bảng `files` và `FileStorage` (`S3FileStorage`, `MemoryFileStorage`), khoá tệp qua hàm chung.
     - Mã tra cứu công khai: `DossierSigner` có mã QR tra cứu; giấy khen 22d có mã và điểm cuối công khai `public/emulation-awards/verify` có giới hạn tần suất (`AdmissionsRateLimiter`); website trường 18f, trang công khai.
     - Nhân sự: `staff`, `staff_certificates` (tên, số, nơi cấp, ngày cấp, ngày hết hạn; **chưa có tệp bản sao, chưa gắn khoá học**), `work_history`; thông báo (`notifications`), nhắc hạn.
     - Học sinh, lớp: `children`, `class_enrollments`, `classes`, cấp học và khối (DT-19), môn học `subjects` và chương trình (20a).
     - Giảng dạy: `lesson_plans` (kế hoạch bài dạy, 16), kế hoạch giáo dục 22i.
   - **Có tên gần giống nhưng khác nghiệp vụ, không dùng lại:** `library_items`, `library_albums`, `library_topics`, `coloring_pages` (kho nội dung cho phụ huynh và bé ở Mầm non: ảnh, tranh tô màu, ứng dụng phụ huynh xem), **không phải thư viện sách**; `asset_loans` (mượn thiết bị: mỗi thiết bị tối đa một lần mượn mở, không có bản sao, đặt trước, phạt, bạn đọc).
   - **Chưa có:** danh mục ấn phẩm, bản sao, thẻ bạn đọc, mượn trả, kiểm kê thư viện; kế hoạch, khoá, đăng ký và kết quả bồi dưỡng, chứng nhận do trường cấp, khung năng lực số; kho học liệu, giấy phép học liệu, kiểm duyệt học liệu, bộ sưu tập; ngân hàng câu hỏi (kế hoạch ở 22g1, YCTD-168, chưa làm).

### 13.2 Nguyên tắc

- **Không đổi hành vi các phần đã có:** mỗi phần là phân hệ hoặc nhóm menu mới, gắn `levels` theo cấp được dùng; bảng mới có tiền tố riêng, không sửa bảng cũ ngoài việc thêm cột có giá trị mặc định (`staff_certificates` ở 22e). Toàn bộ e2e và kiểm thử đơn vị hiện có vẫn đạt không sửa kỳ vọng.
- **Một nguồn sự thật:** câu hỏi chỉ nằm ở ngân hàng của 22g1 (kho 22h2 tham chiếu, không sao chép); chứng chỉ của giáo viên chỉ nằm ở `staff_certificates` (22e mở rộng, không bảng thứ hai); tệp minh chứng nằm ở `files`, kho hồ sơ 18e chỉ lưu tham chiếu; thông báo qua hàng đợi thông báo chung.
- **Dùng lại luồng duyệt và kí của 18e**, không viết luồng duyệt thứ hai: duyệt học liệu (22h1), duyệt đăng ký bồi dưỡng (22e) đi qua cùng mô hình trạng thái, sự kiện, Việc của tôi.
- **Giấy phép, nguồn gốc và bản quyền:** học liệu phải có giấy phép trước khi công bố; không đưa nội dung có bản quyền (sách giáo khoa, bài giảng, video) vào mã, dữ liệu mẫu, kiểm thử, tài liệu; dữ liệu mẫu chỉ là nhan đề, số liệu bịa rõ ràng ở bản trình diễn (18h, 19f).
- **Dữ liệu cá nhân tối thiểu:** thẻ bạn đọc, lịch sử mượn của học sinh chỉ người có quyền xem (thủ thư, giáo viên chủ nhiệm lớp đó, phụ huynh của chính con); hồ sơ bồi dưỡng của giáo viên theo quyền như hồ sơ nhân sự (cá nhân, tổ trưởng, Ban Giám hiệu).
- **Không gọi dịch vụ ngoài:** không tải ảnh bìa, siêu dữ liệu sách, đoạn video từ dịch vụ ngoài khi thêm; liên kết video ngoài chỉ lưu địa chỉ, không nhúng hay tải về; quét mã vạch bằng bàn phím hoặc máy quét giả lập bàn phím, camera điện thoại chỉ ở trình duyệt cục bộ.
- **Công khai chỉ qua mã tra cứu:** trang công khai của 22e chỉ cho tra theo mã chứng nhận (có giới hạn tần suất như 22d), không liệt kê.
- **Văn bản gốc trước phạm vi chi tiết:** mỗi phần đọc toàn văn văn bản còn hiệu lực lúc làm và ghi số hiệu, điều khoản vào YCTD của phần. Văn bản dự kiến, **kiểm lại hiệu lực trước khi nạp mặc định**: Luật Thư viện 2019 và văn bản hướng dẫn, thông tư về tiêu chuẩn thư viện cơ sở giáo dục phổ thông (22a); quy chế bồi dưỡng thường xuyên giáo viên, cán bộ quản lý cơ sở giáo dục mầm non, phổ thông, chuẩn nghề nghiệp giáo viên, khung năng lực số của giáo viên theo văn bản của Bộ hiện hành (22e); quy định về sách giáo khoa, bản quyền, giấy phép Creative Commons (22h). Chỗ kế hoạch này tóm tắt chỉ để chia phần.
- **Danh mục cấu hình được, có bộ mặc định:** phân loại ấn phẩm, quy định mượn, loại bạn đọc, chỉ tiêu báo cáo thư viện; loại bồi dưỡng, định mức tiết, khung năng lực số; bộ giấy phép, loại học liệu, chủ đề. Đổi văn bản thì sửa danh mục, không sửa mã; mã cố định chỉ cho trạng thái luồng.
- **Viết sẵn cho đa thuê bao:** không thêm biến `.env` riêng trường; khoá Redis qua `cacheKey`, tệp qua `storageKey`; đường dẫn công khai không ghi cứng tên miền.

### 13.3 Các phần

Số giữ sẵn bắt đầu **sau dải của DT-21 và chừa khoảng rộng** để hai đợt chạy song song không va nhau (kho mã đã bật `allowUnorderedMigrations`): migration năm học từ 0100, hệ thống từ 0040, định danh từ 0090; YCTD-180 dành cho chính bản kế hoạch này, các phần từ YCTD-181; spec e2e từ `120-`. DT-21 giữ đến năm học 0092, hệ thống 0029, định danh 0083, YCTD-175, e2e `103-`; DT-20 giữ đến năm học 0083, hệ thống 0027, định danh 0074, e2e `94-`. **Khoảng trống chừa lại** (năm học 0084 đến 0099 chưa giữ, hệ thống 0030 đến 0039, định danh 0084 đến 0089, e2e `104-` đến `119-`, YCTD-176 đến YCTD-179) là dự phòng cho bổ sung của DT-19, DT-20, DT-21, **không dùng cho DT-22**. Phần nào không cần số đã giữ thì để trống, không cho phần khác dùng.

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD giữ sẵn | Migration giữ sẵn | e2e giữ sẵn |
|---|---|---|---|---|---|---|
| 22a | Thư viện trường học: danh mục ấn phẩm và bản sao, thẻ bạn đọc (cán bộ, học sinh), mượn trả, quá hạn, đặt trước, phát và thu sách giáo khoa, kiểm kê, báo cáo theo chuẩn | 1 | DT-19 (cấp học), 20a (môn, khối); chạy ngay | YCTD-181 | Năm học 0100; hệ thống 0040; định danh 0090 | 120 |
| 22e | Hồ sơ bồi dưỡng giáo viên: kế hoạch, khoá, đăng ký, kết quả, số tiết; chứng chỉ (mở rộng `staff_certificates`); chứng nhận có mã tra cứu công khai; bản đồ năng lực số. Không làm LMS | 1 | 18e, 18f, hồ sơ nhân sự (đã gộp); chạy ngay | YCTD-182 | Năm học 0101; hệ thống 0041; định danh 0091 | 121 |
| 22h1 | Kho học liệu số, phần lõi: kho tệp và liên kết, metadata theo cấp, lớp, môn, chủ đề; giấy phép bắt buộc; kiểm duyệt phân luồng; bộ sưu tập; báo lỗi; thống kê | 2 | 18e (luồng duyệt, kho tệp), 20a (môn); không cần 22g1 | YCTD-183 | Năm học 0102; hệ thống 0042; định danh 0092 | 122 |
| 22h2 | Kho học liệu số, phần câu hỏi và chia sẻ: câu hỏi, đề, ma trận của 22g1 hiện trong kho; rubric; gói chia sẻ liên trường bản chạy nội bộ (xuất, nhập có kiểm) | 3 | 22h1, **22g1 (ngân hàng câu hỏi, ma trận, đề; YCTD-168, năm học 0085, định danh 0076, e2e 96) đã gộp**; phần thống kê sử dụng câu hỏi cần thêm **22g2 (chấm, báo cáo; YCTD-173)** | YCTD-184 | Năm học 0103; định danh 0093 | 123 |

Giữ chỗ chưa giao phiên: **YCTD-185** cho thành phần AI riêng (13.5), migration năm học 0104, hệ thống 0043, định danh 0094, e2e `124-`; YCTD-186 đến YCTD-189, năm học 0105 đến 0109, hệ thống 0044 đến 0049, định danh 0095 đến 0099, e2e `125-` đến `129-` dự phòng cho bổ sung của DT-22. **Cập nhật 2026-10-26:** thành phần AI nay là phần 23d của DT-23 (mục 15, YCTD-214); các số giữ chỗ AI nói trên (YCTD-185, năm học 0104, hệ thống 0043, định danh 0094, e2e `124-`) không còn hiệu lực và để trống.

Đợt làm, mỗi lúc tối đa hai phiên:
- **Đợt 1: 22a và 22e**, độc lập nhau, làm được ngay, không chờ DT-20, DT-21.
- **Đợt 2: 22h1.** Chỉ cần kho hồ sơ 18e (đã gộp) nên **bắt đầu ngay khi một trong hai phần đợt 1 gộp**, không chờ cả hai.
- **Đợt 3: 22h2**, bắt đầu khi 22h1 **và 22g1** (DT-21, đợt 1) đã gộp; phần thống kê sử dụng câu hỏi, mức nhận thức chờ thêm **22g2** (DT-21, đợt 4, ghi kết quả sử dụng vào lịch sử câu hỏi): nếu 22g2 chưa gộp thì 22h2 làm phần còn lại, ghi phần thống kê vào YCTD-184 để làm sau khi 22g2 gộp. Nếu 22g1 gộp trễ thì 22h2 chờ, không tự làm ngân hàng câu hỏi thứ hai, không tạm làm bảng câu hỏi riêng. 22h1 không phụ thuộc 22g1 nên không bị chặn.

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH, PQ, mã chức năng) theo đợt: 22a, 22e, 22h1, 22h2; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. YCTD, số migration, số e2e giữ sẵn ở bảng trên không đổi theo thứ tự gộp.

Cỡ ước lượng (một phần của DT-16 là một đơn vị, chỉ để so sánh): 22a khoảng 1, 22e khoảng 0,75, 22h1 khoảng 1, 22h2 khoảng 0,5; tổng khoảng 3,25 đơn vị, nhỏ hơn DT-20 và DT-21.

### 13.4 Phạm vi chi tiết

#### 22a. Thư viện trường học

- **Danh mục ấn phẩm:** nhan đề, tác giả, nhà xuất bản, năm xuất bản, ISBN (nhập tay, không tra dịch vụ ngoài), phân loại (sách giáo khoa, sách giáo viên, sách tham khảo, truyện, báo, tạp chí, tài liệu số), cấp, khối, môn (theo `subjects` của 20a), chủ đề, ngôn ngữ, kệ hoặc vị trí, ảnh bìa (tải lên, tuỳ chọn); tài liệu số đính tệp (`files`). Nhập từ Excel theo mẫu, báo lỗi theo dòng như công cụ của 16a.
- **Bản sao** (số đăng ký cá biệt, mã vạch hoặc mã QR do hệ thống sinh): nguồn (mua, tặng, cấp), giá, ngày nhập, tình trạng (tốt, hỏng, mất, thanh lý); in nhãn mã (PDF theo khổ nhãn cấu hình); sổ đăng ký cá biệt xuất Excel, PDF. Thanh lý có biên bản, lý do, người duyệt.
- **Bạn đọc và thẻ:** cán bộ lấy từ `staff`, học sinh lấy từ `children` theo lớp đang học ở cấp bật thư viện; thẻ tự cấp khi nhập học, tự khoá khi nghỉ, chuyển trường, tốt nghiệp (không xoá lịch sử); mã thẻ in được (PDF). Mầm non: chỉ cán bộ mượn; bạn đọc nhí mượn theo lớp không nằm trong phạm vi.
- **Quy định mượn** cấu hình theo loại bạn đọc: số bản tối đa cùng lúc, số ngày mượn, số lần gia hạn, mức phạt trễ (nếu trường dùng), loại ấn phẩm không cho mượn về (đọc tại chỗ).
- **Mượn trả:** quét mã thẻ và mã bản sao; kiểm tra quy định; trả có đánh giá tình trạng (hỏng, mất kèm xử lý bồi thường ghi nhận, không thu tiền trong phân hệ này); gia hạn; **đặt trước** khi các bản đã cho mượn hết; **quá hạn**: danh sách, nhắc qua thông báo (hàng đợi chung) và Việc của tôi của thủ thư; **mượn lớp** (giáo viên mượn bộ sách cho lớp).
- **Phát và thu sách giáo khoa** (tuỳ trường): bộ sách theo khối và năm học, phát cho học sinh đầu năm, thu cuối năm, danh sách chưa trả, hỏng, mất; dùng cùng bản sao và nhật ký với mượn trả.
- **Kiểm kê:** đợt kiểm kê theo kệ hoặc cả kho, quét bản sao có mặt, đối chiếu (thừa, thiếu, hỏng), biên bản, xử lý chênh lệch (đánh dấu mất, thanh lý).
- **Báo cáo:** thống kê kho (số đầu sách, số bản, theo phân loại, theo khối), số bản sách giáo khoa, tham khảo trên học sinh, tỉ lệ bạn đọc, lượt mượn theo lớp, tháng, ấn phẩm mượn nhiều, bạn đọc tích cực; **chỉ tiêu theo chuẩn thư viện cơ sở giáo dục phổ thông** nạp theo văn bản gốc sau khi đọc (danh mục chỉ tiêu và ngưỡng cấu hình được), sổ mượn trả; xuất Excel, PDF. Kết quả đo chuẩn thư viện **ghi làm minh chứng cho 22f** (bảo đảm chất lượng) qua tham chiếu, không nhập lại.
- **Menu, quyền:** phân hệ **Thư viện** (gắn `levels` theo cấp bật, mặc định bật `TH`, `THCS`, `THPT`, `MN` tuỳ trường), quyền riêng (định danh 0090) gán cho vai trò thủ thư; ứng dụng phụ huynh xem sách con đang mượn và hạn trả (mã chức năng mới trong `LEVEL_FEATURES` cho cấp có thư viện); ứng dụng giáo viên xem sách mình đang mượn.
- **Lưu ở đâu:** danh mục, bản sao, bạn đọc không theo năm học nên ưu tiên cơ sở dữ liệu hệ thống (0040); kỳ kiểm kê, số liệu theo năm ở năm học 0100. Chốt khi làm và ghi vào YCTD-181; chuyển năm học giữ nguyên kho, lịch sử mượn, chỉ chép cấu hình.

#### 22e. Hồ sơ bồi dưỡng giáo viên

Chỉ phần **quản trị**: ghi nhận, theo dõi, cấp chứng nhận. **Không làm** lớp học trực tuyến, khoá học điện tử, bài thi trực tuyến, kho video bài giảng bồi dưỡng.
- **Kế hoạch bồi dưỡng năm học:** nhu cầu của giáo viên (tự khai báo hoặc tổ chuyên môn đề xuất), danh mục nội dung và chuyên đề bồi dưỡng (cấu hình; bộ mặc định theo quy chế bồi dưỡng thường xuyên sau khi đọc văn bản gốc), hình thức (tập trung, trực tuyến ở hệ thống ngoài, tự học có kiểm tra), thời lượng (tiết), kế hoạch của trường duyệt bằng luồng của 18e; nối kế hoạch giáo dục 22i và kế hoạch công việc khi trường muốn.
- **Khoá, đợt bồi dưỡng:** do trường tổ chức hoặc do cấp trên, đơn vị ngoài tổ chức (ghi nhận): tên, thời gian, địa điểm, đơn vị tổ chức, số tiết, chỉ tiêu, hạn đăng ký; **đăng ký** của giáo viên, duyệt của tổ trưởng và Ban Giám hiệu (Việc của tôi), nhắc hạn; **điểm danh** buổi học (với khoá trường tổ chức); **kết quả** (đạt, không đạt, số tiết được ghi nhận, nhận xét).
- **Hồ sơ bồi dưỡng cá nhân theo năm học:** các khoá đã dự, tổng số tiết so với định mức năm (cấu hình), chứng chỉ, bản sao tệp minh chứng (`files`, và tham chiếu vào thư mục cá nhân của 18e khi giáo viên chọn); xem theo cá nhân, tổ, trường; thiếu tiết so với định mức, cảnh báo.
- **Chứng chỉ:** mở rộng `staff_certificates` (thêm cột: tệp bản sao, loại, khoá liên quan, số tiết, ghi chú, nhắc hết hạn; không đổi cột cũ, dữ liệu cũ vẫn hợp lệ); chứng chỉ nhập tay (từ nơi khác) và chứng chỉ sinh từ khoá cùng một bảng.
- **Chứng nhận do trường cấp có mã tra cứu công khai:** với khoá trường tổ chức: mẫu chứng nhận (cấu hình), mã duy nhất, mã QR (dùng lại `DossierSigner` và cách sinh mã của 22d), xuất PDF hàng loạt, trang tra cứu công khai theo mã (điểm cuối công khai có giới hạn tần suất, chỉ trả tên người, khoá, ngày cấp, trạng thái; không trả dữ liệu khác), thu hồi, cấp lại.
- **Bản đồ năng lực số:** khung năng lực số của giáo viên (miền, mức, mô tả; cấu hình, bộ mặc định theo văn bản của Bộ hiện hành sau khi đọc); giáo viên tự đánh giá theo kỳ, tổ trưởng và Ban Giám hiệu xác nhận hoặc chỉnh có lý do; biểu đồ mạng nhện của cá nhân, bản đồ nhiệt của tổ, trường; **khoảng trống năng lực gợi ý nội dung bồi dưỡng theo quy tắc** (mức dưới ngưỡng thì gợi ý chuyên đề gắn miền đó), không dùng AI; kết quả theo dõi qua các năm.
- **Báo cáo:** tiến độ kế hoạch, tỉ lệ hoàn thành định mức tiết theo tổ, chuyên đề, đơn vị tổ chức; chứng chỉ sắp hết hạn; xuất Excel, PDF. Kết quả bồi dưỡng là **đầu vào tuỳ chọn cho KPI 18d và thi đua 22d** (điều kiện, minh chứng) qua tham chiếu, không sửa hai phần đó nếu không cần.
- **Menu, quyền:** nhóm mới trong phân hệ nhân sự hoặc Hồ sơ chuyên môn (chốt khi làm), quyền riêng (định danh 0091); ứng dụng giáo viên xem khoá của mình, đăng ký, nhận chứng nhận; Việc của tôi có nguồn "đăng ký chờ duyệt", "chứng chỉ sắp hết hạn".
- **Lưu ở đâu:** cấu hình (danh mục chuyên đề, định mức, khung năng lực số) ở hệ thống 0041; khoá, đăng ký, kết quả, đánh giá năng lực theo năm học ở năm học 0101.

#### 22h1. Kho học liệu số: lõi

- **Kho học liệu của trường:** loại học liệu (kế hoạch bài dạy, bài trình chiếu, video, phiếu học tập, tài liệu tham khảo, hình ảnh, đề kiểm tra dạng tệp, loại khác; cấu hình); tệp tải lên qua `FileStorage` (giới hạn định dạng, dung lượng, tên tệp chuẩn hoá) hoặc **liên kết ngoài** (chỉ lưu địa chỉ và tiêu đề, không tải về, không nhúng); kế hoạch bài dạy đã có ở `lesson_plans` **đưa vào kho bằng tham chiếu** (không sao chép, sửa ở nơi cũ thì kho thấy bản mới).
- **Metadata:** cấp, khối, môn (`subjects` 20a, mở rộng theo DT-21 khi có), chủ đề hoặc bài (danh mục chủ đề theo môn, khối, cấu hình, trường tự nhập), tuần dạy dự kiến, loại, từ khoá, tác giả (cán bộ trong trường hoặc nguồn ngoài), ngôn ngữ, thời lượng; tìm kiếm, lọc nhiều tiêu chí, xem trước (PDF, ảnh).
- **Giấy phép bắt buộc:** bộ giấy phép cấu hình (tự biên soạn dùng nội bộ, các loại Creative Commons, tài liệu có xin phép ghi rõ nơi cấp, tài liệu do cơ quan nhà nước ban hành, không rõ giấy phép); mỗi học liệu có giấy phép, nguồn gốc và người chịu trách nhiệm; **không công bố khi thiếu giấy phép hoặc giấy phép bị trường đặt là chặn**; học liệu "không rõ" chỉ xem cá nhân.
- **Kiểm duyệt phân luồng** (dùng luồng duyệt của 18e): tải lên → tổ trưởng chuyên môn của môn duyệt → công bố trong trường; **phân luồng theo rủi ro**: học liệu có liên kết ngoài, video, nguồn có xin phép hoặc loại do trường chọn thêm bước Ban Giám hiệu; trả lại kèm lý do; sự kiện, nhật ký; Việc của tôi.
- **Phiên bản và vòng đời:** nộp lại thành phiên bản mới, bản cũ lưu; ngừng dùng (ẩn, giữ lịch sử); phạm vi xem (`private` cá nhân, `unit` tổ, `school` toàn trường; giá trị `network` liên trường lưu sẵn trong danh mục nhưng **không bật** ở DT-22, để DT-SaaS).
- **Bộ sưu tập:** giáo viên hoặc tổ lập theo chủ đề, theo khối, theo tuần; thêm, sắp xếp học liệu; chia sẻ trong trường; xuất danh sách.
- **Báo lỗi:** người dùng báo sai nội dung, lỗi tệp, nghi vi phạm bản quyền; thủ kho (người điều phối do trường chỉ định) tiếp nhận, xử lý, ẩn tạm, trả lời; thống kê số báo lỗi theo học liệu.
- **Thống kê:** lượt xem, tải về; học liệu theo môn, khối, loại, giấy phép, tổ; đóng góp theo giáo viên; học liệu chưa duyệt, quá hạn duyệt, sắp mất hiệu lực giấy phép (nếu có hạn).
- **Menu, quyền:** phân hệ **Kho học liệu** (gắn `levels` theo cấp; chỉ cổng quản trị và ứng dụng giáo viên, không có học sinh, phụ huynh trong DT-22), quyền riêng (định danh 0092).
- **Lưu ở đâu:** học liệu, giấy phép, chủ đề, bộ sưu tập không theo năm học nên ưu tiên hệ thống 0042; duyệt, báo lỗi, thống kê theo năm ở năm học 0102.

#### 22h2. Kho học liệu số: câu hỏi và chia sẻ

Chỉ bắt đầu khi 22g1 đã gộp; phạm vi dưới đây chốt lại theo hình dạng thật của ngân hàng câu hỏi, ma trận, đề của 22g1 (ghi vào YCTD-184).
- **Câu hỏi, đề, ma trận trong kho:** kho hiện các đối tượng của 22g1 như một loại học liệu **tham chiếu** (khoá `question_id`, `exam_id`), dùng chung ô tìm kiếm, bộ lọc metadata của kho; bộ sưu tập chứa được câu hỏi và đề. **Không** sao chép câu hỏi, không có luồng duyệt thứ hai: kho đọc trạng thái (nháp, thẩm định, dùng được, ngừng dùng) của 22g1 và chuyển người dùng sang màn hình duyệt của 22g1; thống kê sử dụng câu hỏi lấy từ lịch sử sử dụng của câu hỏi (22g1 tạo đề, 22g2 ghi kết quả chấm vào lịch sử, nên cần 22g2).
- **Rubric:** mẫu rubric có cấu trúc (tiêu chí × mức, mô tả, điểm), tạo, nhân bản, in; dùng cho bài tự luận, sản phẩm học tập; nối bằng khoá tham chiếu với câu hỏi tự luận của 22g1 khi 22g1 có chỗ nối (chốt lúc làm); phiếu học tập có cấu trúc (tiêu đề, câu hỏi ngắn, in) nếu 22h1 chưa đủ dùng.
- **Chia sẻ liên trường, bản chạy nội bộ:** **xuất gói** (một bộ sưu tập hoặc nhóm học liệu thành một tệp nén có bản kê: metadata, giấy phép, mã băm từng tệp, tên trường nguồn do trường tự đặt, mã gói; **không có dữ liệu cá nhân** của học sinh hay phụ huynh; học liệu giấy phép "không rõ" hoặc bị chặn không được xuất) và **nhập gói** từ trường khác (kiểm bản kê, mã băm, giấy phép, loại trùng; vào kho ở trạng thái chờ duyệt, qua luồng duyệt của 22h1, ghi nguồn gốc gói). Danh mục chung liên trường thật (tìm trên mạng lưới, đồng bộ, xếp hạng) **chờ DT-SaaS**.
- **Thống kê sử dụng chung** của kho: học liệu và câu hỏi theo môn, chủ đề, mức nhận thức; chỗ trống chủ đề (chủ đề chưa có học liệu hoặc câu hỏi).
- Quyền mới (định danh 0093).

### 13.5 Quyết định thiết kế và phương án đã loại

Các lựa chọn dưới đây do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, trừ hai quyết định của Eric ở 13.1.

- **Tách 22h thành 22h1 và 22h2:** lõi kho (kho, giấy phép, kiểm duyệt, bộ sưu tập) không cần ngân hàng câu hỏi nên làm sớm; phần câu hỏi, đề phụ thuộc 22g1 nên làm sau. Phương án loại: làm cả 22h một lần sau 22g1 (chặn nhóm phiên không cần thiết); làm kho câu hỏi riêng trong 22h để khỏi chờ (hai ngân hàng câu hỏi, lệch dữ liệu).
- **Thư viện sách làm bảng mới, không dùng lại `library_items`:** bảng đó là kho nội dung cho phụ huynh ở Mầm non (ảnh, tranh tô màu), khác nghiệp vụ; dùng chung tên "thư viện" chỉ gây nhầm. Tên bảng mới có tiền tố riêng (chốt khi làm). `asset_loans` (mượn thiết bị) cũng giữ nguyên: không có bản sao, đặt trước, phạt.
- **Chứng chỉ ở một bảng:** mở rộng `staff_certificates` thay vì bảng chứng chỉ mới của 22e; cột thêm đều nullable.
- **Không làm LMS, khoá học trực tuyến, bài thi trực tuyến** (22e); không làm thiết kế bài giảng điện tử (22h chỉ nhận bài giảng đã xuất làm học liệu); không làm cổng giáo án công cộng, giải bài tập, từ điển (đã loại ở bản kế hoạch chín phần).
- **Không dùng AI trong DT-22**; điểm nối để sẵn: danh mục chủ đề, thẻ và từ khoá của học liệu (22h1) và danh sách khoảng trống năng lực (22e) là dữ liệu đã khử định danh có thể làm đầu vào cho gợi ý sau này; không thêm cột hay bảng riêng cho AI. **Cập nhật 2026-10-26:** Eric đã cho làm thành phần AI, ghi ở phần 23d của DT-23 (mục 15): tắt mặc định theo trường, chỉ soạn nháp, người duyệt, chỉ gửi nội dung chương trình, không gửi dữ liệu cá nhân.
- **Chia sẻ liên trường bằng gói tệp, không bằng máy chủ chung:** khách hàng là trường đơn lẻ, DT-SaaS chưa làm; gói tệp đủ để hai trường trao đổi và là hình dạng dữ liệu để DT-SaaS đọc lại.
- **Học sinh, phụ huynh không xem kho học liệu ở DT-22:** nguồn không nêu; tránh bề mặt công khai thêm khi chưa có yêu cầu. Khi có yêu cầu thì thêm bằng YCTD riêng.
- **Không làm ở DT-22:** tổng hợp cho Phòng, Sở (DT-SaaS S6); thu tiền bồi thường sách trong phân hệ thư viện (chỉ ghi nhận); kết nối cơ sở dữ liệu thư viện quốc gia hay dịch vụ tra ISBN ngoài; tìm kiếm toàn văn nội dung tệp.

### 13.6 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Phạm vi suy ra từ mô tả công khai, không có màn hình thật của chín trang nguồn | Chốt phạm vi từng phần theo văn bản quy phạm đọc toàn văn; ghi giả định vào YCTD; Eric chỉnh khi nghiệm thu; không sao chép nguyên văn, hình ảnh, tên gọi riêng của các trang nguồn |
| Chuẩn thư viện, quy chế bồi dưỡng, khung năng lực số thay đổi hoặc đã bị thay | Đọc văn bản còn hiệu lực lúc làm; chỉ tiêu, định mức, khung cấu hình được, bộ mặc định ghi số hiệu văn bản; không ghi cứng số liệu |
| Học liệu vi phạm bản quyền, thiếu giấy phép | Giấy phép bắt buộc mới công bố; báo lỗi nghi vi phạm; ẩn tạm; bộ giấy phép cấu hình; không nội dung có bản quyền trong mã, dữ liệu mẫu, kiểm thử |
| Lộ dữ liệu học sinh qua lịch sử mượn, gói chia sẻ, tra cứu chứng nhận | Quyền xem theo thủ thư, chủ nhiệm, phụ huynh của con; gói chia sẻ không chứa dữ liệu cá nhân (kiểm thử khoá trường nhạy cảm); điểm cuối công khai chỉ tra theo mã, có giới hạn tần suất, chỉ trả trường tối thiểu |
| 22h2 bắt đầu khi 22g1 chưa gộp, dẫn tới ngân hàng câu hỏi thứ hai | Bảng 13.3 ghi 22h2 chờ 22g1 (và 22g2 cho thống kê sử dụng); không tạo bảng câu hỏi trong DT-22; kiểm thử kho chỉ tham chiếu |
| Nhầm với `library_items` Mầm non | Tiền tố bảng, tên phân hệ, tên quyền khác; kiểm thử thư viện Mầm non (cho phụ huynh) không đổi |
| Mở rộng `staff_certificates` làm hỏng dữ liệu, màn hình nhân sự hiện có | Cột thêm nullable; chuyển dữ liệu theo từng bước; e2e nhân sự hiện có đạt không sửa kỳ vọng |
| Tệp tải lên lớn, định dạng nguy hiểm | Giới hạn định dạng và dung lượng cấu hình; chuẩn hoá tên tệp; xem trước chỉ với định dạng an toàn; dùng `FileStorage` như các nơi khác |
| Hai phần cùng đợt cùng sửa tệp chung (cây menu, `LEVEL_FEATURES`, danh sách migration, quyền, `my-work`) | Số migration giữ sẵn riêng và rộng; sửa tệp chung theo kiểu thêm cuối; gộp origin/main trước khi mở PR |
| Va số với DT-20, DT-21 chạy song song | Dải số DT-22 bắt đầu sau dải DT-21 và chừa khoảng trống 13.3; DT-22 không dùng số trong khoảng trống |

**Cổng kiểm của mỗi phần DT-22:** kiểm thử đơn vị toàn bộ kho mã đạt không sửa kỳ vọng; e2e toàn bộ hiện có đạt cộng e2e mới của phần (chạy riêng, giữ khoá `e2e.lock`, không chạy cùng kiểm thử đơn vị toàn kho); typecheck, lint, build đạt; CI 4/4 xanh; phiên bản phần mềm tăng theo từng phần, riêng bản kế hoạch này (YCTD-180) chỉ đổi tài liệu.

### 13.7 Quy ước chung của DT-22

- Mỗi phần ghi YCTD giữ sẵn ở mục 13.3, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 14, 16, 17, 21, 23, 24, 32, `index.md` khi có thay đổi tương ứng), ghi văn bản căn cứ đã đọc, mở PR, gộp khi mọi kiểm tra CI đạt.
- Mã mới theo mục 13.2 (đa thuê bao, không đổi hành vi các phần đã có, không gọi dịch vụ ngoài, không AI).
- Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần.
- Nếu trong lúc làm, một phần cần số ngoài khoảng đã giữ, ghi vào YCTD và lấy ở dải dự phòng của DT-22 (13.3), không lấy từ khoảng trống chừa cho DT-19 đến DT-21.

### 13.8 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| 22a | 1 | Đã làm, YCTD-181, phiên bản 0.122.0, PR 147: phân hệ Thư viện (danh mục, bản sao có số đăng ký cá biệt và tem QR, thanh lý, tệp số, sổ đăng ký; thẻ bạn đọc; mượn trả, phạt, nhắc quá hạn, đặt trước; phát và thu sách giáo khoa; kiểm kê; báo cáo và chỉ tiêu theo chuẩn có ngưỡng cấu hình; thiết lập), ứng dụng giáo viên, phụ huynh; toàn bộ ở cơ sở dữ liệu năm học (năm học 0100, định danh 0090, hệ thống 0040 không dùng); chưa làm: nhập Excel danh mục, minh chứng sang 22f, ảnh bìa; e2e 120 |
| 22e | 1 | Đã làm, YCTD-182, phiên bản 0.119.0, PR 145: danh mục (hệ thống 0041: định mức 120 tiết, chuyên đề theo ba chương trình, khung năng lực số 6 miền 3 mức theo Thông tư 18/2026), khoá, đăng ký, duyệt tổ và Ban Giám hiệu, kết quả, chứng nhận PDF có mã QR, thu hồi, cấp lại, trang tra cứu công khai (năm học 0101, `staff_certificates` thêm cột), chứng chỉ nhập tay, hồ sơ cá nhân, tổ, trường, năng lực số và gợi ý chuyên đề; nhóm 6 của Hồ sơ chuyên môn; quyền `P09.training.*` (định danh 0091); ứng dụng giáo viên; e2e 121 |
| 22h1 | 2 | Đã làm, YCTD-183, phiên bản 0.125.0, PR 156: phân hệ "Kho học liệu" (hệ thống 0042: loại, giấy phép, chủ đề, học liệu, phiên bản tệp, liên kết, tham chiếu kế hoạch bài dạy, bộ sưu tập; năm học 0102: sự kiện duyệt, báo lỗi, lượt xem, tải); giấy phép bắt buộc; kiểm duyệt phân luồng theo rủi ro (tổ trưởng, Ban Giám hiệu); báo lỗi, thủ kho ẩn tạm; thống kê; quyền `P09.learning-resource.*` (định danh 0092); không có bảng câu hỏi; e2e 122 |
| 22h2 | 3 | Đã làm, YCTD-184, phiên bản 0.126.0, PR 160: câu hỏi, đề, ma trận của ngân hàng 22g1 hiện trong kho bằng tham chiếu (không bảng câu hỏi thứ hai), bộ sưu tập chứa câu hỏi, đề; thống kê sử dụng câu hỏi (lịch sử dùng câu của 22g1, 22g2), chỗ trống chủ đề; rubric; gói chia sẻ liên trường bản chạy nội bộ (xuất, nhập có kiểm, chờ duyệt) (năm học 0103); quyền `P09.learning-resource.share` (định danh 0093); menu Kho học liệu 8. đến 10.; e2e 123 |

## 14. DT-SaaS: Enterprise SaaS nhiều trường

### 14.1 Căn cứ và mục tiêu

1. Lộ trình Eric chốt ngày 2026-10-19: DT-18 → DT-19 → DT-20 → DT-21 → DT-22 → **DT-SaaS** (làm sau cùng, để mọi tính năng nghiệp vụ xong trước khi đổi nền). Khi viết kế hoạch này DT-22 (22a, 22e, 22h1, 22h2) và DT-21 (đến 21g, PR 159) đã xong. Đầu vào là bản nháp "Kế hoạch chuyển School Management thành Enterprise SaaS cho nhiều trường" (ngày 2026-10-19, lưu ngoài kho; mục 4 chia phần S1 đến S8, mục 4b ghi quyết định); mục này chốt lại thành các phần làm được sau khi đối chiếu mã.
2. Quyết định của Eric đã chốt:
   - **2026-10-19:** mô hình A, **mỗi trường một bộ cơ sở dữ liệu** (identity, system, các cơ sở dữ liệu năm học), nền tảng có thêm cơ sở dữ liệu `platform` giữ danh sách trường, tên miền, gói; **thu phí tự động làm ngay trong đợt đầu** (S5 thuộc lõi); không ghi cứng tên miền.
   - **2026-10-25, đường dẫn trường:** mặc định là tên miền con theo mẫu `<mã trường>.<tên miền hệ thống>`; tên miền hệ thống là **cấu hình của nền tảng**, không ghi cứng. Ngoài ra quản trị nền tảng có thể **cấu hình tay tên miền riêng cho từng trường ở bước khởi tạo (setup)**, trường trỏ CNAME, HTTPS tự cấp theo yêu cầu (on-demand TLS), chỉ cấp cho tên miền có trong danh sách.
   - **2026-10-25, hạ tầng:** **VPS trong nước** (một hoặc vài máy, Docker Compose); S7 **không giả định dịch vụ đám mây quản lý**; đặt máy chủ tại Việt Nam (Nghị định 53/2022/NĐ-CP).
   - **2026-10-25, bổ sung về hạ tầng:** giai đoạn đầu là **thử nghiệm**, nên kế hoạch phải **linh động**: cùng một mã nguồn triển khai được theo **hai hồ sơ** chọn bằng cấu hình, không rẽ nhánh mã: **(a) "Thử nghiệm"** trên Cloudflare hoặc Vercel và các nền tảng có gói miễn phí khác (Eric chốt dùng **cả ba phương án** viết theo kiểu bộ nối: web tĩnh Cloudflare Worker hoặc Vercel; cơ sở dữ liệu Neon hoặc Supabase, kho tệp R2 hoặc Supabase Storage; máy chủ Render, dự phòng Koyeb), **(b) "Vận hành"** trên VPS trong nước như đã chốt (14.4, S9).
   - **2026-10-25, Eric chốt các giả định:** **trường thật được dùng thử với dữ liệu thật khi đã có văn bản đồng ý của trường**, thay cho ràng buộc "chỉ dữ liệu giả" và bỏ tự xóa sau 30 ngày với trường thật, kèm các biện pháp tuân thủ ở S9, S8a (Eric là người chấp nhận rủi ro pháp lý về lưu trữ trong nước); **S6 làm ở đợt 5, đã duyệt**, đủ ba cấp Bộ, Sở và Phòng Văn hóa – Xã hội (cấp xã) kèm cây đơn vị hành chính cấu hình được; **thu phí cấu hình được** theo học sinh, theo trường, theo phân hệ, mặc định theo số học sinh, quản trị nền tảng chọn cách tính cho từng gói.
3. **Phần chưa chốt thì làm cấu hình được và ghi rõ là giả định** (14.11): tên sản phẩm; cách tính phí (theo học sinh, theo trường hay theo phân hệ); cổng thanh toán của nền tảng; nhà cung cấp hóa đơn điện tử; nhà cung cấp VPS; nền tảng miễn phí cụ thể của hồ sơ thử nghiệm.
4. Mục tiêu: một nền tảng chạy nhiều trường, mỗi trường một đường dẫn riêng, **dữ liệu tách hẳn nhau** (dữ liệu trẻ em, Nghị định 13/2023/NĐ-CP), khởi tạo trường mới bằng một thao tác, cấu hình riêng từng trường, gói dịch vụ và thu phí tự động, vận hành được trên một đến vài VPS trong nước với sao lưu, khôi phục, giám sát theo từng trường; **dùng thử sớm được trên nền tảng miễn phí** (dữ liệu giả, hoặc dữ liệu thật của trường đã có văn bản đồng ý kèm biện pháp tuân thủ, 14.4, S9). Khách hàng chính vẫn là **trường đơn lẻ**; tài khoản cấp trên (S6: Bộ, Sở, Phòng Văn hóa – Xã hội) là phần cuối, đã được duyệt làm ở đợt 5.
5. Hiện trạng mã (đọc trên nhánh chính ngày 2026-10-25):
   - **Một bản triển khai là một trường.** `deploy/docker-compose.production.yml`: `postgres`, `redis`, `seaweedfs` (S3), `migrate`, `identity`, `api`, `worker`, `demo-reset`, `web` (Caddy). Giao diện gọi `/api/v1` cùng tên miền, Caddy chuyển nhóm điểm cuối định danh sang `identity`, phần còn lại sang `api`. Tên miền cố định theo biến `.env` (`PORTAL_SITE`, `PARENT_SITE`, `TEACHER_SITE`, `API_SITE`).
   - **Cơ sở dữ liệu:** lớp `Databases` (`apps/api/src/common/databases.ts`) mở cơ sở dữ liệu hệ thống từ `SYSTEM_DATABASE_URL` và cơ sở dữ liệu năm học theo tên (`replaceDatabaseName`, tên có tiền tố `SCHOOL_YEAR_DATABASE_PREFIX`); dịch vụ định danh dùng `IDENTITY_DATABASE_URL`. `database/src/migrate.ts` có ba loại `identity`, `system`, `school-year`, chạy lặp được (`allowUnorderedMigrations`); danh sách cơ sở dữ liệu năm học lấy từ bảng `academic_year_databases`. **Chưa có khái niệm "thuê bao" ở bất kỳ chỗ nào của mã.**
   - **Cấu hình riêng nằm hết trong `.env`**, áp chung cả bản triển khai (`apps/api/src/common/configuration.ts`): khóa công khai kiểm mã phiên `TOKEN_PUBLIC_KEY` (khóa ký chỉ ở dịch vụ định danh), `CHILD_DATA_ENCRYPTION_KEY`, `CHILD_DATA_HASH_KEY`, `S3_*`, `PAYMENT_GATEWAY` và khóa PayOS, SePay, Casso, VNPay, eSMS, Zalo OA, Facebook, `REDIS_URL`, `LOGIN_REQUESTS_PER_MINUTE`. Khóa truy cập Zalo lưu ở `integration_credentials` (hệ thống 0003) mã hóa AES-GCM bằng khóa dữ liệu trẻ (`secret-encryption.ts`).
   - **Đã viết sẵn cho đa thuê bao** (nguyên tắc từ DT-17): khóa Redis và tệp S3 đi qua `cacheKey`, `storageKey` (`packages/server/src/resource-names.ts`, có ghi chú "chỉ cần thêm tiền tố của trường ở đây"); không thêm biến `.env` riêng trường; không ghi cứng tên miền. Một số phân hệ cũ vẫn ghép khóa bằng tay (S1b rà và chuyển hết).
   - **Đã có, dùng lại:** Caddy `on_demand_tls` hỏi `api:3000/api/v1/public/website/domain-check` cho tên miền website của trường (18f, bảng `website_domains`, hệ thống 0021); bản trình diễn và đăng nhập thay (18h, `demo_environment` hệ thống 0022, YCTD-145); gói ZIP toàn bộ dữ liệu (18h, chưa ZIP64); bốn nhà cung cấp thanh toán (`payment-providers.ts`); `backup.sh` đã liệt kê mọi cơ sở dữ liệu trong PostgreSQL, mã hóa AES-256, đẩy ra ngoài máy (SL-01 đến SL-05); tiến trình nền theo chu kỳ (`NotificationDispatcher`, tác vụ xuất nền 16a, `demo-reset`) và hàng đợi Redis của máy xếp thời khoá biểu trong `apps/worker`.
   - **Hàng đợi Redis chỉ có một chỗ dùng** (máy xếp thời khoá biểu, `apps/worker` và `timetable-generator.ts`): `BLPOP` chờ 5 giây liên tục và ghi tiến độ khoảng 4 lần mỗi giây; **không có `REDIS_URL` thì máy xếp chạy ngay trong tiến trình API** (đường dùng cho kiểm thử). Mọi việc chạy nền khác (`NotificationDispatcher`, tác vụ xuất nền, `demo-reset`) là bộ đếm giờ trong tiến trình, không tự thức dậy khi tiến trình ngủ. Không migration nào dùng `CREATE EXTENSION`. Năm học đã đóng khóa ghi bằng `alter database ... set default_transaction_read_only` (`database-administration.ts`). Bộ nối kho tệp `FileStorage` dùng `S3Client` với điểm cuối cấu hình được.
   - **Ứng dụng giáo viên và phụ huynh là ứng dụng web** (`apps/teacher`, `apps/parent`), không có vỏ ứng dụng di động riêng.
   - **Kiểm thử hiện nay:** e2e một máy chủ API (cổng 3200), một dịch vụ định danh (3201), ba giao diện (5373, 5375, 5376), `workers: 1`, cơ sở dữ liệu `school_system_e2e`, tiền tố năm học `school_year_e2e_`; CI một việc `kiem-thu` (định dạng, lint, build, typecheck, migrate, kiểm thử đơn vị, e2e).

### 14.2 Nguyên tắc

- **Không đổi hành vi bản triển khai một trường hiện có.** Nền tảng nhiều trường bật bằng cấu hình (`PLATFORM_DATABASE_URL`); không có thì chạy **chế độ một trường** như hôm nay (một bộ cơ sở dữ liệu theo `.env`, mọi tên miền thuộc về trường đó). Toàn bộ e2e và kiểm thử đơn vị hiện có vẫn đạt không sửa kỳ vọng. Bản triển khai hiện có trở thành **trường số 1** của nền tảng bằng lệnh nhận bản đang chạy (S1a), **không chuyển dữ liệu**.
- **Mỗi trường một bộ cơ sở dữ liệu, một vai trò PostgreSQL, một tiền tố khóa Redis và tệp.** Không có truy vấn nào dùng chung bảng giữa hai trường; không thêm `tenant_id` vào bảng nghiệp vụ.
- **Đóng chặt khi thiếu ngữ cảnh trường (fail closed):** ở chế độ nhiều trường, truy cập cơ sở dữ liệu, Redis, kho tệp ngoài ngữ cảnh một trường là lỗi, không rơi về trường mặc định.
- **Giữ nguyên mã nghiệp vụ:** `Databases`, `cacheKey`, `storageKey` giữ chữ ký hiện tại và nhận trường qua ngữ cảnh của yêu cầu (`AsyncLocalStorage`), để hàng trăm chỗ gọi không phải sửa.
- **Không bí mật dùng chung giữa các trường:** khóa mã hóa dữ liệu trẻ, khóa nhà cung cấp, tài khoản nhận tiền của từng trường lưu mã hóa theo trường, bọc bằng khóa gốc của nền tảng (S1a, S3). Trước khi S3 xong, trường thứ hai trở đi **không** được dùng khóa tích hợp trong `.env` của trường số 1: tích hợp ngoài ở các trường đó chạy bộ giả lập hoặc tắt.
- **Cấu hình, không ghi cứng:** tên sản phẩm, tên miền hệ thống, danh sách mã trường dành riêng, cách tính phí, nhà cung cấp thanh toán và hóa đơn đều là cấu hình nền tảng.
- **Nền tảng và trường là hai lớp quản trị tách nhau:** tài khoản vận hành nền tảng ở cơ sở dữ liệu `platform`, không phải tài khoản trong bất kỳ trường nào; quản trị nền tảng không xem dữ liệu của trường nếu trường không cho phép (đăng nhập hỗ trợ có đồng ý, có hạn, có nhật ký, S4).
- **Tương thích lùi khi cập nhật cuốn chiếu (expand/contract):** bản mã mới chạy được trên cấu trúc cơ sở dữ liệu của bản liền trước, vì trường được chuyển cấu trúc lần lượt chứ không đồng loạt (S2, S7b).
- **Đo bằng kiểm thử cách ly:** không phần nào được gộp khi kiểm thử cách ly (14.7) chưa đạt.
- **Văn bản gốc trước khi viết điều khoản:** hợp đồng, thỏa thuận xử lý dữ liệu, hồ sơ đánh giá tác động, cấp độ an toàn thông tin đọc toàn văn văn bản còn hiệu lực lúc làm (dự kiến: Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân, Luật An ninh mạng 2018, Nghị định 53/2022/NĐ-CP, Nghị định 85/2016/NĐ-CP, Thông tư 12/2022/TT-BTTTT, Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC về hóa đơn điện tử) và ghi số hiệu vào YCTD của phần. Tài liệu pháp lý do Claude soạn là **bản nháp để luật sư của Eric rà**, không thay tư vấn pháp lý.
- **Dùng dữ liệu giả ở mọi kiểm thử:** tên trường, tên miền, học sinh, tài khoản nhận tiền, hóa đơn trong kiểm thử và dữ liệu mẫu đều là dữ liệu bịa rõ ràng, tên miền dùng `*.localhost` hoặc `*.test`.
- **Một mã nguồn, một ảnh container, hai hồ sơ triển khai chọn bằng cấu hình:** chỗ nào hai hồ sơ khác nhau thì mã có **một giao diện và hai bộ nối** chọn bằng biến cấu hình của nền tảng (bố cục cơ sở dữ liệu, nguồn tên miền, chế độ lập lịch, bộ nối tên miền, kho tệp), **không có `if` theo hồ sơ trong mã nghiệp vụ**, không nhánh Git riêng. CI chạy kiểm thử cách ly ở cả hai bố cục cơ sở dữ liệu (14.7). Chuyển từ thử nghiệm lên vận hành là đổi cấu hình và chạy công cụ chuyển bố cục, **không sửa mã** (S9).
- **Máy chủ ngoài Việt Nam: dữ liệu giả, hoặc dữ liệu thật chỉ khi đủ biện pháp tuân thủ:** hồ sơ thử nghiệm đặt máy ở nước ngoài; trường thật chỉ được dùng thử với dữ liệu thật khi có văn bản đồng ý của trường, hợp đồng hoặc thỏa thuận xử lý dữ liệu, hồ sơ đánh giá tác động theo Nghị định 13/2023/NĐ-CP, vùng máy chủ ghi vào hồ sơ, mã hóa trường dữ liệu trẻ em bằng khóa riêng của trường, và phiếu chấp nhận rủi ro về Nghị định 53/2022/NĐ-CP do Eric ký; có lộ trình, công cụ chuyển sang hồ sơ vận hành trong nước bằng cấu hình (14.4, S9, S8a).

### 14.3 Các phần

Số giữ sẵn bắt đầu **sau dải của DT-22 và chừa dự phòng**: YCTD-190 dành cho chính bản kế hoạch này, các phần từ YCTD-191 (S9 là YCTD-203, bổ sung ngày 2026-10-25); migration năm học từ 0110, hệ thống từ 0050, định danh từ 0100, **cơ sở dữ liệu `platform` mới từ 0001**; spec e2e từ `130-`. DT-22 giữ đến YCTD-189, năm học 0109, hệ thống 0049, định danh 0099, e2e `129-`; **không dùng số trong dải đó** (kể cả chỗ dự phòng chưa dùng của DT-22). Phần nào không cần số đã giữ thì để trống, không cho phần khác dùng. Mỗi phần cần cơ sở dữ liệu `platform` có khối 10 số riêng; `platform` là loại migration thứ tư của `database/src/migrate.ts` (thư mục `database/platform/`), S1a thêm.

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD giữ sẵn | Migration giữ sẵn | e2e giữ sẵn |
|---|---|---|---|---|---|---|
| S1a | Nền đa thuê bao, phần lõi: cơ sở dữ liệu `platform` (trường, tên miền, cụm cơ sở dữ liệu, khóa của trường, mô tả kết nối từng cơ sở dữ liệu của trường), nhận diện trường theo tên miền (nguồn tên miền cấu hình được: `Host`, `X-Forwarded-Host` hoặc tiêu đề do cổng biên đặt kèm bí mật chung), `Databases` theo ngữ cảnh trường, **bố cục cơ sở dữ liệu cấu hình được (`database`: mỗi trường các cơ sở dữ liệu riêng; `schema`: mỗi trường các lược đồ riêng trong ít cơ sở dữ liệu)**, nhóm kết nối có giới hạn, vai trò PostgreSQL riêng, mã phiên gắn mã trường, tiền tố khóa Redis và tệp, chế độ một trường và nhiều trường, lệnh nhận bản đang chạy làm trường số 1, bộ khung kiểm thử cách ly (chạy ở cả hai bố cục), khung cổng vận hành nền tảng | 1 | DT-22 (đã gộp); chạy ngay | YCTD-191 | Nền tảng 0001 đến 0009 | 130 |
| S1b | Nền đa thuê bao, phần chạy nền và công khai: tiến trình nền theo từng trường (gửi thông báo, xuất nền, đặt lại bản trình diễn, hàng đợi máy xếp thời khoá biểu), **bộ lập lịch có hai chế độ: trong tiến trình hoặc ngoài (bộ lập lịch bên ngoài gọi điểm cuối `tick`), việc làm được bù khi bỏ lỡ**, điểm cuối công khai và webhook theo tên miền, Caddy cấp chứng chỉ theo yêu cầu theo danh sách của nền tảng, trang chọn trường, giới hạn tần suất theo trường, chuyển mọi khóa ghép tay sang hàm chung, kiểm tĩnh | 2 | S1a | YCTD-192 | Nền tảng 0010 đến 0019 | 131 |
| S2 | Khởi tạo và vòng đời trường: bước setup (thông tin, mã, cấp học, năm học đầu, tên miền mặc định hoặc tên miền riêng cấu hình tay qua **bộ nối tên miền `DomainProvider`**, quản trị viên đầu tiên), tạo cơ sở dữ liệu hoặc lược đồ **theo bố cục đã chọn**, vai trò, chạy migrate, nạp mặc định, tạm dừng, mở lại, xuất toàn bộ dữ liệu, xóa có thời gian chờ, migrate cuốn chiếu, lệnh dòng lệnh tương đương | 2 | S1a (gộp S1b trước S2) | YCTD-193 | Nền tảng 0020 đến 0029; hệ thống 0050 | 132 |
| S9 | **Triển khai thử nghiệm** (hồ sơ (a)), viết theo kiểu bộ nối chọn bằng cấu hình: web tĩnh Cloudflare Worker hoặc Vercel, cơ sở dữ liệu Neon hoặc Supabase, kho tệp R2 hoặc Supabase Storage, máy chủ Render (dự phòng Koyeb), tên miền riêng Cloudflare for SaaS hoặc Vercel Domains; **tệp mẫu và các bước cho ba tổ hợp chính**; container gộp `identity` + `api`, bố cục `schema`, không Redis; điểm cuối `tick`; **dữ liệu thật khi có văn bản đồng ý**: cổng hồ sơ đồng ý và bảng `school_consents`, `school_hosting`, vùng máy chủ, mã hóa trường dữ liệu trẻ em theo khóa riêng của trường; công cụ `platform relayout` chuyển sang VPS trong nước | 3 | S1a, S1b, S2; **ưu tiên giao đầu đợt 3 để Eric dùng thử sớm** | YCTD-203 | Nền tảng 0100 đến 0109 | 140 |
| S5a | Gói dịch vụ và giới hạn: gói, phân hệ theo gói, giới hạn (học sinh, dung lượng), kiểm tra ở máy chủ và ở menu, trạng thái trường (dùng thử, hoạt động, chỉ đọc, tạm ngưng), chế độ chỉ đọc khi hết hạn | 2 | S1a | YCTD-194 | Nền tảng 0040 đến 0049 | 134 |
| S3 | Cấu hình riêng từng trường: chuyển khóa tích hợp trong `.env` thành cấu hình của trường lưu mã hóa (thanh toán, eSMS, Zalo OA, Facebook, kho tệp), logo, màu, tên, màn hình quản trị của trường, đổi khóa mã hóa dữ liệu trẻ có công cụ mã hóa lại | 3 | S1b (tiến trình nền đã theo trường), S2 | YCTD-195 | Nền tảng 0030 đến 0039; hệ thống 0051, 0052 | 133 |
| S5b | Thu phí tự động: quy tắc tính phí cấu hình được, chốt số liệu kỳ, hóa đơn, thu qua mã QR và cổng thanh toán của nền tảng, đối soát, kích hoạt và gia hạn tự động, nhắc gia hạn, hóa đơn điện tử qua bộ nối | 3 | S5a, S3 (kho khóa mã hóa), S1b (tiến trình nền theo trường) | YCTD-196 | Nền tảng 0050 đến 0059 | 135 |
| S4 | Bảng điều khiển nền tảng: danh sách trường, trạng thái, dung lượng, số người dùng, số học sinh, lần đăng nhập cuối, phiên bản cấu trúc, đăng nhập hỗ trợ có đồng ý, thông báo bảo trì, theo dõi lỗi theo trường | 3 | S2, S5a | YCTD-197 | Nền tảng 0060 đến 0069; hệ thống 0053 | 136 |
| S7a | Hạ tầng VPS trong nước, phần dựng sẵn: hồ sơ "Vận hành" (b) trong `deploy/profiles/production/`: Docker Compose một đến vài máy, PgBouncer, Caddy bắt mọi tên miền, giám sát và cảnh báo, môi trường thử (staging), triển khai không gián đoạn, hướng dẫn vận hành. **Không sửa mã nghiệp vụ** (chỉ `deploy/`, `docker/`) | 1 | không phụ thuộc mã DT-SaaS; chạy ngay | YCTD-198 | không | không (kiểm tay trên staging) |
| S7b | Vận hành nhiều trường: sao lưu và khôi phục từng trường, lưu nhật ký giao dịch để khôi phục về một thời điểm, diễn tập khôi phục tự động, chuyển trường sang cụm khác, thử tải nhiều trường, đo RPO và RTO | 4 | S1b, S2, S7a | YCTD-199 | Nền tảng 0070 đến 0079 | 137 |
| S8a | Pháp lý và hồ sơ tuân thủ (tài liệu): hợp đồng dịch vụ, thỏa thuận xử lý dữ liệu cá nhân, văn bản đồng ý dùng thử dữ liệu thật ở máy chủ ngoài nước, điều khoản sử dụng, chính sách bảo mật, hồ sơ đánh giá tác động xử lý dữ liệu cá nhân và chuyển dữ liệu ra nước ngoài (Nghị định 13/2023/NĐ-CP), bản ghi vùng máy chủ, phiếu chấp nhận rủi ro (Nghị định 53/2022/NĐ-CP), lộ trình chuyển về trong nước, hồ sơ đề xuất cấp độ an toàn hệ thống thông tin, quy trình xử lý sự cố và thông báo vi phạm dữ liệu | 1 | không phụ thuộc mã; chạy ngay | YCTD-200 | không | không |
| S8b | Bảo mật mã: xác thực hai lớp cho tài khoản nền tảng (và tuỳ chọn cho quản trị trường), chính sách mật khẩu theo trường, rà bảo mật tiêu đề, giới hạn tần suất, xoay khóa, kiểm tra thành phần phụ thuộc và bí mật trong CI, sửa lỗi sau kiểm thử xâm nhập | 4 | S1a, S2, S3 | YCTD-201 | Nền tảng 0080 đến 0089; hệ thống 0054; định danh 0101, 0102 | 138 |
| S6 | Đơn vị cấp trên **(đã duyệt, đợt 5)**: ba cấp Bộ, Sở, Phòng Văn hóa – Xã hội (cấp xã); cây đơn vị hành chính cấu hình được; mỗi cấp xem số liệu tổng hợp của các trường thuộc phạm vi và **đã đồng ý**, không xem chi tiết từng học sinh nếu không được cấp quyền | 5 | S1a, S4, S8b | YCTD-202 | Nền tảng 0090 đến 0099; định danh 0103 | 139 |

Giữ chỗ chưa giao: YCTD-204 đến YCTD-209, hệ thống 0055 đến 0069, định danh 0104 đến 0119, năm học 0110 đến 0119, nền tảng 0110 đến 0199, e2e `141-` đến `149-` dự phòng cho bổ sung của DT-SaaS. Thư mục kiểm thử cách ly `tests/tenancy/` (14.7) không dùng số spec.

Đợt làm, mỗi lúc tối đa ba phiên, **không hai phiên cùng sửa một tệp lõi trong cùng đợt**:
- **Đợt 1: S1a, S7a, S8a.** S1a sửa mã lõi (`Databases`, định danh, tên khóa, `database/`); S7a chỉ sửa `deploy/` và `docker/`; S8a chỉ viết tài liệu. S1a làm một mình trên mã lõi.
- **Đợt 2: S1b, S2, S5a.** S1b sửa tiến trình nền, điểm cuối công khai, Caddy; S2 sửa bước khởi tạo, lệnh `migrate`, `database-administration.ts`; S5a sửa kiểm tra gói và menu. **Thứ tự gộp: S1b trước S2** (nhiều trường chỉ bật ở môi trường chạy thật sau khi S1b gộp, 14.8). Đăng ký thêm trang nền tảng, tuyến API, mô-đun chỉ theo kiểu **thêm cuối tệp** (`application.module.ts`, `platform-menu.ts`).
- **Đợt 3: S9, S3, S4.** **S9 giao đầu tiên** (ngay khi S1a, S1b, S2 đã gộp) để Eric dùng thử trên nền tảng miễn phí; S3 sửa cấu hình và các bộ nối ngoài; S4 sửa bảng điều khiển và đăng nhập hỗ trợ (mở rộng đăng nhập thay của 18h). S9 chỉ thêm tệp mới trong `deploy/profiles/trial/`, thư mục cổng biên và một bộ nối, không sửa chung tệp với S3, S4. Bắt đầu khi S1b, S2, S5a đã gộp.
- **Đợt 4: S5b, S7b, S8b.** S5b (thu phí) chuyển từ đợt 3 sang đợt 4 vì cần kho khóa mã hóa của S3 đã gộp; Eric vẫn có thu phí tự động trong lõi, chỉ sau S9 và S3. **Đợt 5: S6** (Eric đã duyệt ngày 2026-10-25), bắt đầu khi S1a, S4, S8b đã gộp.

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH, PQ, mã chức năng): S1a, S7a hoặc S8a (theo thứ tự xong), rồi S1b, S2, S5a, S9, S3, S4, S5b, S7b, S8b, S6; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. YCTD, số migration, số e2e giữ sẵn ở bảng trên không đổi theo thứ tự gộp.

Cỡ ước lượng (một phần của DT-16 là một đơn vị, chỉ để so sánh): S1a 1,5; S1b 1; S2 1,25; S5a 0,75; S3 1; S5b 1,25; S4 1; S9 1,5; S7a 0,5; S7b 0,75; S8a 0,75; S8b 0,75; S6 1,5; tổng khoảng 13,5 đơn vị. Bản nháp ngày 2026-10-19 ước lượng khoảng tám phần; kế hoạch này tách S1, S5, S7, S8 nhỏ hơn để mỗi phiên làm trọn trong một lượt và để tách phần sửa lõi ra khỏi phần chạy song song.

**Điều kiện ra của DT-SaaS** (nghiệm thu với Eric): ít nhất hai trường chạy trên một nền tảng ở môi trường thử (hồ sơ thử nghiệm miễn phí hoặc hồ sơ vận hành), mỗi trường một tên miền con; một trường có tên miền riêng cấu hình tay; khởi tạo trường mới bằng một thao tác trong dưới 10 phút (giả định, đo ở S2); bộ kiểm thử cách ly đạt (14.7); bản triển khai một trường hiện có chạy được như trước; chu kỳ gia hạn chạy hết một vòng bằng dữ liệu giả (hóa đơn, thu tiền giả lập, chuyển chỉ đọc, mở lại); sao lưu và khôi phục một trường diễn tập đạt RPO và RTO đã ghi; một trường thử nghiệm chuyển từ hồ sơ thử nghiệm sang hồ sơ vận hành bằng công cụ chuyển bố cục mà không sửa mã, khớp số dòng từng bảng.

### 14.4 Kiến trúc đích

Tên bảng dưới đây là đề xuất, chốt khi làm và ghi vào YCTD của phần.

**Cơ sở dữ liệu `platform`** (một bộ cho cả nền tảng, loại migration `platform`):

| Nhóm | Bảng đề xuất | Phần |
|---|---|---|
| Trường và cụm | `schools` (mã, tên, trạng thái `provisioning`, `trial`, `active`, `read_only`, `suspended`, `pending_deletion`, `deleted`; cụm; tiền tố tên cơ sở dữ liệu, tiền tố khóa; ghi chú), `school_clusters` (máy chủ cơ sở dữ liệu, cổng, vai trò chính hoặc bản sao), `school_domains` (trường, tên miền, loại `system` hoặc `custom`, trạng thái `pending`, `verified`, `active`, `disabled`), `school_keys` (khóa mã hóa và khóa băm dữ liệu trẻ của trường, bọc bằng khóa gốc), `platform_settings` (tên miền hệ thống, tên sản phẩm, mã dành riêng, ...) | S1a |
| Tiến trình và vòng đời | `provisioning_jobs`, `school_lifecycle_events`, `school_migrations` (phiên bản cấu trúc, trạng thái, lỗi từng trường), `scheduler_state` | S1b, S2 |
| Tài khoản vận hành | `platform_operators` (đăng nhập riêng của nền tảng), `platform_audit_log` | S2, S8b |
| Gói và thu phí | `plans`, `plan_modules`, `plan_limits`, `school_subscriptions`, `price_rules`, `usage_snapshots`, `invoices`, `invoice_lines`, `invoice_payments`, `einvoice_documents`, `dunning_events` | S5a, S5b |
| Vận hành | `maintenance_notices`, `support_sessions`, `school_metrics`, `backup_runs` | S4, S7b |
| Hồ sơ tuân thủ | `school_consents` (loại `dpa`, `consent`, `impact-assessment`, `risk-acceptance`; người ký, chức danh, ngày, phạm vi, thời hạn, bản quét kèm mã băm), `school_hosting` (nhà cung cấp, vùng, dịch vụ, ngày bắt đầu) | S2, S9 |
| Cấp trên | `admin_units` (cây đơn vị hành chính cấu hình được), `parent_org_users`, `school_aggregate_consents` (theo trường, cấp, nhóm số liệu), `aggregate_snapshots` | S6 |

**Luồng một yêu cầu** (chế độ nhiều trường): tên miền → `school_domains` (đệm trong bộ nhớ có hạn, hủy khi đổi) → ngữ cảnh trường (mã, trạng thái, cụm, tên cơ sở dữ liệu, khóa) đặt vào `AsyncLocalStorage` ở đầu yêu cầu của `identity` và `api` → `Databases`, `cacheKey`, `storageKey`, bộ nối ngoài đọc ngữ cảnh → mã phiên phải mang cùng mã trường. Tên miền không có trong danh sách trả 404 chung, không lộ tên trường.

**Tên cơ sở dữ liệu:** `<tiền tố trường>_identity`, `<tiền tố trường>_system`, `<tiền tố trường>_year_<năm bắt đầu>_<năm kết thúc>`; mỗi trường một vai trò PostgreSQL `s_<mã>` chỉ có quyền trên các cơ sở dữ liệu của trường đó. Trường số 1 giữ nguyên tên hiện có (`school_identity`, `school_system`, `school_year_*`) qua cột tiền tố.

**Khóa tên:** `storageKey('a','b')` thành `tenants/<mã>/a/b`, `cacheKey('a','b')` thành `t:<mã>:a:b`; trường số 1 có tiền tố trống để khóa hiện có còn đúng.

**Đường dẫn:** mỗi trường một tên miền (con `<mã>.<tên miền hệ thống>` hoặc tên miền riêng); ba lối vào trên cùng tên miền: gốc là website công khai của trường (18f), `/quan-ly` cổng quản trị, `/giao-vien` ứng dụng giáo viên, `/phu-huynh` ứng dụng phụ huynh, `/api/v1` cho cả bốn (cùng tên miền, không CORS, cookie mã làm mới giữ đường dẫn `/api/v1/auth` và không đặt `Domain`). Cổng vận hành nền tảng ở tên miền con dành riêng (ví dụ `platform.<tên miền hệ thống>`, cấu hình được). Trang chọn trường ở gốc tên miền hệ thống: nhập mã trường rồi chuyển sang tên miền của trường, không đăng nhập chéo.

**Hai hồ sơ triển khai** (Eric bổ sung ngày 2026-10-25), cùng mã nguồn và cùng ảnh container, chọn bằng biến cấu hình **của nền tảng** (không phải của từng trường, nên không trái nguyên tắc "không thêm biến `.env` riêng trường"). Hồ sơ (a) viết theo kiểu **bộ nối (adapter) chọn bằng cấu hình**, mỗi thành phần có hơn một lựa chọn (Eric chốt dùng cả ba phương án ngày 2026-10-25):

| Thành phần | Hồ sơ (a) Thử nghiệm: các bộ nối | Hồ sơ (b) Vận hành |
|---|---|---|
| Web tĩnh và cổng biên | Cloudflare Worker kèm tài sản tĩnh (mặc định) **hoặc** Vercel; chia đường dẫn `/quan-ly`, `/giao-vien`, `/phu-huynh`, chuyển `/api/v1` về máy chủ | Caddy trên VPS (`web`) |
| `identity`, `api`, `worker` | Một container gộp `identity` + `api` (không `worker`) trên **Render, dự phòng Koyeb** | Ba container trên VPS |
| PostgreSQL | **Neon hoặc Supabase** (gói miễn phí), qua bộ gom kết nối của nhà cung cấp, bố cục `schema` | PostgreSQL và PgBouncer trên VPS, bố cục `database` |
| Redis | Không dùng (không đặt `REDIS_URL`; máy xếp thời khoá biểu chạy trong tiến trình hoặc tắt theo gói) | Redis trên VPS |
| Tệp | **Cloudflare R2 hoặc Supabase Storage** (đều tương thích S3) | SeaweedFS trên VPS |
| DNS, tên miền con | Cloudflare, bản ghi ký tự đại diện qua proxy (mặc định); với Vercel làm cổng biên thì tên miền hoặc tên miền con ủy quyền dùng máy chủ tên của Vercel | Bản ghi A đến VPS |
| Tên miền riêng của trường | Cloudflare for SaaS **hoặc** Vercel Domains | Caddy cấp chứng chỉ theo yêu cầu |
| Việc định kỳ | Cloudflare Cron Triggers, lịch của GitHub Actions hoặc lịch của Vercel, gọi điểm cuối `tick` | Bộ lập lịch trong tiến trình |
| Dữ liệu | Dữ liệu giả, hoặc **dữ liệu thật của trường đã có văn bản đồng ý** kèm các biện pháp ở S9 | Dữ liệu thật |
| Máy chủ | Ngoài Việt Nam (chọn vùng gần nhất, Singapore, ghi vào hồ sơ trường) | **Trong Việt Nam** |

**Biến cấu hình chọn hồ sơ và bộ nối** (đặt ở môi trường của nền tảng; mọi giá trị trong tệp mẫu là giả, không khóa thật):
- `TENANT_DB_LAYOUT` = `database` | `schema`: bố cục cơ sở dữ liệu của trường.
- `DB_HOST_ADAPTER` = `plain` | `neon` | `supabase`: cách bộ nối sinh địa chỉ kết nối qua bộ gom của nhà cung cấp (Neon: máy chủ gom kết nối; Supabase: tên đăng nhập dạng vai trò kèm mã dự án) và cách tạo vai trò; mọi lựa chọn đều ghi địa chỉ đã sinh vào `school_databases`, nên `Databases` không biết nhà cung cấp.
- `TENANT_HOST_SOURCE` = `host` | `x-forwarded-host` | `header:<tên tiêu đề>`, kèm `EDGE_SHARED_SECRET` khi dùng tiêu đề do cổng biên đặt (thiếu hoặc sai bí mật thì từ chối, vì máy chủ ở hồ sơ (a) có địa chỉ công khai).
- `SCHEDULER_MODE` = `internal` | `external` và `INTERNAL_JOB_TOKEN`: bộ lập lịch trong tiến trình hay do bên ngoài gọi.
- `DOMAIN_PROVIDER` = `dns-check` | `cloudflare-saas` | `vercel-domains`: bộ nối tên miền riêng (S2, S9).
- `INTEGRATIONS_MODE` = `configured` | `simulated`: bộ nối ngoài chạy bằng cấu hình của trường hay giả lập (mặc định hồ sơ (a) là `simulated` cho trường dữ liệu giả).
- `PLATFORM_DATA_POLICY` = `any` | `consent-required` | `synthetic-only`: chính sách dữ liệu của môi trường (mặc định hồ sơ (a) là `consent-required`: dữ liệu thật chỉ khi đủ hồ sơ đồng ý, S9).
- `TENANT_POOL_MAX` và `TENANT_POOL_SCHOOLS`: số kết nối mỗi kết nối logic và số trường mở cùng lúc (hồ sơ (a) đặt nhỏ).
- `MIGRATE_ON_START`: chạy `platform migrate` khi khởi động (hồ sơ (a), không có bước triển khai riêng); có khóa để hai bản không chạy cùng lúc.
- `S3_*` (điểm cuối R2, Supabase Storage hoặc SeaweedFS; vùng; kiểu đường dẫn), `PLATFORM_DATABASE_URL`, `PLATFORM_MASTER_KEY` như S1a.

**Bố cục cơ sở dữ liệu `schema`** (hồ sơ (a)): mỗi trường có **ba lược đồ trở lên** (`s_<mã>_identity`, `s_<mã>_system`, `s_<mã>_y<năm bắt đầu>_<năm kết thúc>`) trong một hoặc vài cơ sở dữ liệu; mỗi lược đồ có **một vai trò PostgreSQL riêng** chỉ có quyền trên lược đồ đó, với `search_path` đặt **ở mức vai trò** (`alter role ... set search_path`), nên chạy đúng qua bộ gom kết nối ở chế độ theo giao dịch và **mã truy vấn, migration không đổi**. Không có `public` trong `search_path`, thu hồi quyền ở `public`. Mô tả kết nối (cơ sở dữ liệu, vai trò, mật khẩu mã hóa) của từng lược đồ hay cơ sở dữ liệu nằm ở bảng `school_databases` của `platform` ở cả hai bố cục. Tạo trường, tạo năm học mới, khóa năm học đã đóng (`alter role ... set default_transaction_read_only` thay cho `alter database`), sao lưu (`pg_dump -n`), xóa đều đi qua một giao diện `SchoolDatabaseLayout` có hai bộ nối. Cách ly ở mức quyền của PostgreSQL ngang với bố cục `database` (kiểm thử ở 14.7); khác ở chỗ chung một cơ sở dữ liệu nên chung dung lượng và một số tài nguyên, vì vậy chỉ dùng cho thử nghiệm.

### 14.5 Phạm vi chi tiết

#### S1a. Nền đa thuê bao, phần lõi

- **Cơ sở dữ liệu `platform`** và loại migration `platform` (`database/platform/`, `PlatformDatabase`), biến `PLATFORM_DATABASE_URL`, khóa gốc `PLATFORM_MASTER_KEY` (bọc khóa của trường). Không có `PLATFORM_DATABASE_URL` thì chế độ một trường, hành vi hiện nay.
- **Nhận diện trường:** phần mềm trung gian ở `identity` và `api` đọc `Host` (chỉ tin `X-Forwarded-Host` khi `TRUST_PROXY` bật), tra `school_domains`, đặt ngữ cảnh trường; tên miền của cổng nền tảng và tên miền dành riêng được tách; mã trường theo mẫu `[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])`, không trùng danh sách dành riêng (`www`, `api`, `platform`, `admin`, `mail`, `app`, ...), cấu hình được, mã không đổi sau khi tạo.
- **`Databases` theo ngữ cảnh:** cùng chữ ký hiện tại (`system`, `schoolYear(name)`), nhưng phân giải theo trường hiện tại; nhóm kết nối có giới hạn: số kết nối mỗi trường (mặc định 3), tổng số trường mở cùng lúc, tự đóng khi không dùng quá hạn, `statement_timeout`; ở chế độ nhiều trường thiếu ngữ cảnh là lỗi `TENANT_CONTEXT_MISSING`. Chạy việc nền phải gọi `runAsSchool(trường, hàm)` (S1b dùng).
- **Dịch vụ định danh theo trường:** mỗi trường một cơ sở dữ liệu định danh; mã phiên mang `tid` (mã trường; claim `sid` đã là mã phiên nên không dùng), máy chủ API và dịch vụ định danh từ chối mã phiên khác trường với 401; cặp khóa ký **dùng chung của nền tảng** (khóa công khai phát cho `api`); cookie mã làm mới gắn mã trường (cookie của trường khác bị từ chối kể cả khi bị đặt từ tên miền anh em); khóa giới hạn đăng nhập gồm mã trường.
- **Khóa dữ liệu trẻ theo trường:** `school_keys` giữ khóa mã hóa và khóa băm riêng, bọc bằng `PLATFORM_MASTER_KEY` (AES-GCM, `secret-encryption.ts`); `childDataEncryptionKey`, `childDataHashKey` đọc theo trường. Trường số 1 nhận hai khóa từ `.env` hiện tại khi nhận bản đang chạy.
- **Bố cục cơ sở dữ liệu cấu hình được** (14.4): giao diện `SchoolDatabaseLayout` với hai bộ nối `database` và `schema`; bảng `school_databases` giữ mô tả kết nối mọi cơ sở dữ liệu, lược đồ của trường (loại, năm học, máy chủ, cơ sở dữ liệu, vai trò, mật khẩu mã hóa); `Databases` và nhóm kết nối chỉ đọc bảng này; hàm tạo năm học mới, khóa năm học đã đóng, danh sách cơ sở dữ liệu cần migrate (`schoolYearDatabasesToMigrate`) đi qua giao diện. **Mọi kiểm thử cách ly chạy ở cả hai bố cục.**
- **Nguồn tên miền cấu hình được:** `TENANT_HOST_SOURCE` và `EDGE_SHARED_SECRET` (14.4); với tiêu đề do cổng biên đặt, thiếu hoặc sai bí mật thì từ chối (so sánh thời gian hằng); chỉ tin `X-Forwarded-Host` khi `TRUST_PROXY` bật.
- **Chính sách dữ liệu của môi trường:** `PLATFORM_DATA_POLICY` (`any`, `consent-required`, `synthetic-only`) và cột `schools.data_class` (`synthetic`, `consented`, `production`) ở `platform`; `INTEGRATIONS_MODE=simulated` buộc mọi bộ nối ngoài (thanh toán, tin nhắn, Zalo, Facebook) chạy bộ giả lập khi chọn; cổng hồ sơ đồng ý cho `consented` làm ở S2 và S9.
- **Tiền tố khóa:** `cacheKey`, `storageKey` thêm tiền tố trường từ ngữ cảnh (14.4); kiểm thử đơn vị cho hai hàm.
- **Vai trò PostgreSQL theo trường:** hàm tạo vai trò và cấp quyền (S2 gọi); kiểm thử kết nối chéo bị từ chối.
- **Lệnh nhận bản đang chạy:** `platform adopt-existing` ghi bản triển khai hiện có thành trường số 1 (cơ sở dữ liệu hiện có, tiền tố trống, khóa nhập từ `.env`, tên miền từ `PORTAL_SITE` và các biến cùng loại); chạy lặp được; không đổi, không sao chép dữ liệu.
- **Khung cổng vận hành nền tảng:** ứng dụng `apps/platform` (giao diện riêng, đăng nhập bằng `platform_operators`), chỉ có khung, đăng nhập, menu theo dữ liệu (`platform-menu.ts`); các phần sau thêm trang.
- **Khung kiểm thử cách ly** (14.7): thư mục `tests/tenancy/`, hàm dựng nhiều trường giả, ma trận cách ly cho mọi tuyến API, kiểm tĩnh cấm truy cập trực tiếp cơ sở dữ liệu, Redis, S3 ngoài lớp hạ tầng; chạy ở CI.
- **Lưu ở đâu:** bảng ở cơ sở dữ liệu `platform` 0001 đến 0009; không đổi cơ sở dữ liệu của trường.

#### S1b. Nền đa thuê bao, phần chạy nền và công khai

- **Bộ lập lịch theo trường** (`forEachActiveSchool(việc, {số việc song song, độ lệch ngẫu nhiên})`): dùng cho gửi thông báo, tác vụ xuất nền 16a, đặt lại bản trình diễn, nhắc và tổng hợp theo chu kỳ; bỏ qua trường tạm ngưng; trường lỗi không chặn trường khác; mỗi lần chạy ghi trường và thời gian.
- **Chế độ lập lịch ngoài** (`SCHEDULER_MODE=external`): không có bộ đếm giờ trong tiến trình; điểm cuối nội bộ `POST /api/v1/internal/jobs/tick` (kèm `INTERNAL_JOB_TOKEN`, so sánh thời gian hằng, giới hạn tần suất, chỉ nhận từ cổng biên hoặc bộ lập lịch) chạy các việc đến hạn của mọi trường rồi trả về; mỗi việc **tính phần đến hạn từ dấu thời gian trong cơ sở dữ liệu** chứ không đếm số lần gọi, nên **tiến trình ngủ và gọi lại muộn vẫn bù đủ việc, chạy lặp không gây trùng** (gửi thông báo, xuất nền, chuyển trạng thái gói). Thêm một cuộc gọi đánh thức không có việc (`/health`) cho bộ lập lịch bên ngoài. Kiểm thử bỏ lỡ nhiều chu kỳ rồi gọi một lần.
- **Hàng đợi Redis** của máy xếp thời khoá biểu (`apps/worker`): công việc mang mã trường, tên hàng đợi và khóa kết quả có tiền tố trường, hạn mức việc đồng thời mỗi trường để một trường không chiếm hết máy xếp.
- **Không có Redis vẫn chạy được ở nhiều trường:** không đặt `REDIS_URL` thì máy xếp chạy trong tiến trình API như hiện nay, vẫn mang ngữ cảnh trường và vẫn có hạn mức việc đồng thời mỗi trường; gói dịch vụ (S5a) có thể tắt phân hệ máy xếp ở hồ sơ thử nghiệm vì máy chủ miễn phí rất yếu.
- **Điểm cuối công khai và webhook theo tên miền:** website, tra cứu chứng nhận bồi dưỡng (22e), giấy khen (22d), gọi lại của PayOS, SePay, Casso, VNPay; đều phân giải trường theo tên miền; giới hạn tần suất theo trường và địa chỉ; tên miền lạ trả 404 chung.
- **Chứng chỉ theo yêu cầu theo danh sách của nền tảng:** Caddy bắt mọi tên miền (S7a), điểm cuối `domain-check` hỏi `school_domains` (chỉ tên miền ở trạng thái `verified` hoặc `active`, có giới hạn tần suất); thay phần kiểm tra theo `website_domains` hiện nay mà không đổi hành vi ở chế độ một trường.
- **Trang chọn trường** ở gốc tên miền hệ thống.
- **Chuyển khóa ghép tay sang hàm chung:** rà toàn kho mã các chỗ ghép khóa Redis, đường dẫn S3, tên hàng đợi bằng chuỗi; chuyển sang `cacheKey`, `storageKey`; kiểm tĩnh (14.7) chặn chỗ mới.
- **Số đo theo trường:** nhãn mã trường ở nhật ký và chỉ số (`/metrics` của api, identity, worker) cho S4, S7.
- **Lưu ở đâu:** nền tảng 0010 đến 0019 (trạng thái bộ lập lịch, hạn mức việc nền).

#### S2. Khởi tạo và vòng đời trường

- **Bước setup** trong cổng nền tảng: (1) thông tin trường (tên, mã, địa chỉ, cấp học bật theo DT-19, năm học đầu); (2) **tên miền:** mặc định `<mã>.<tên miền hệ thống>` tự gán, hoặc **cấu hình tay tên miền riêng** (nhập tên miền, hệ thống hướng dẫn CNAME về địa chỉ vào của nền tảng và bản ghi TXT xác nhận, chỉ chuyển sang `active` sau khi kiểm tra DNS đạt; từ chối tên miền thuộc tên miền hệ thống, địa chỉ IP, tên miền đã dùng); (3) gói và dùng thử; (4) quản trị viên đầu tiên (đường liên kết kích hoạt một lần, không gửi mật khẩu); (5) xác nhận, ghi việc đồng ý điều khoản (phiên bản điều khoản, thời điểm, người).
- **Hồ sơ đồng ý khi nhận dữ liệu thật ở máy chủ ngoài nước:** bước setup có lựa chọn `data_class`; chọn `consented` thì bắt buộc nhập đủ hồ sơ ở `school_consents` (hợp đồng hoặc thỏa thuận xử lý dữ liệu, văn bản đồng ý, đánh giá tác động, phiếu chấp nhận rủi ro) và vùng máy chủ ở `school_hosting`, thiếu thì không tạo; tải bản quét, lưu mã băm, ghi người nhập; chuyển `synthetic` sang `consented` đi qua cùng cổng (S9 bổ sung chính sách môi trường).
- **Bộ nối tên miền `DomainProvider`** (`request`, `status`, `remove`): `dns-check` (hồ sơ vận hành: kiểm tra bản ghi CNAME và TXT bằng tra DNS, chứng chỉ do Caddy cấp theo yêu cầu) và `cloudflare-saas` (hồ sơ thử nghiệm: gọi giao diện lập trình của Cloudflare for SaaS để tạo, đọc trạng thái, xóa tên miền riêng; mã S9 viết); cả hai chỉ chuyển tên miền sang `active` khi nhà cung cấp báo đã xác nhận; mã thông báo của nhà cung cấp là cấu hình của nền tảng, không ghi vào kho.
- **Tạo theo bố cục:** tiến trình khởi tạo gọi `SchoolDatabaseLayout` nên cùng một luồng tạo trường chạy ở cả hai bố cục; ở `schema` tạo ba lược đồ, ba vai trò, đặt `search_path` mức vai trò, cấp và thu hồi quyền, chạy migrate bằng vai trò của từng lược đồ.
- **Tiến trình khởi tạo có bước, chạy lại được:** tạo vai trò PostgreSQL, tạo cơ sở dữ liệu định danh, hệ thống, năm học đầu; chạy migrate từng loại; nạp mặc định theo cấp học (cấp học, vai trò, quyền, danh mục), tạo quản trị viên, gán tên miền, tạo tiền tố S3; từng bước ghi `provisioning_jobs`; lỗi giữa chừng thì tiếp tục từ bước đang dở, hoặc hoàn tác rồi xóa sạch; khởi tạo nhanh ở kiểm thử bằng cơ sở dữ liệu mẫu (`CREATE DATABASE ... TEMPLATE`) chỉ ở môi trường kiểm thử.
- **Vòng đời:** tạm dừng (không đăng nhập, không việc nền, giữ dữ liệu), mở lại, **xuất toàn bộ dữ liệu** (dùng lại gói ZIP của 18h; làm tiếp ZIP64 và tùy chọn kèm số định danh đầy đủ có quyền riêng, các việc 18h đã ghi ở YCTD-145), **xóa vĩnh viễn** sau thời gian chờ cấu hình được (mặc định 30 ngày, giả định): xóa cơ sở dữ liệu, vai trò, tiền tố S3, khóa Redis, khóa của trường; giữ ở `platform` chỉ bản ghi chứng minh đã xóa; bản sao lưu của trường xóa theo thời hạn lưu (S7b) và hợp đồng nói rõ.
- **Migrate cuốn chiếu:** lệnh `platform migrate` chạy lần lượt qua từng trường (loại `identity`, `system`, mọi năm học đang dùng), ghi `school_migrations`; trường đầu tiên là trường canary; lỗi thì dừng làn sóng và báo (có tùy chọn tiếp tục); bản mã tương thích lùi cấu trúc liền trước (14.2).
- **Lệnh dòng lệnh tương đương** (`platform provision`, `platform suspend`, ...) cho kịch bản và kiểm thử.
- **Lưu ở đâu:** nền tảng 0020 đến 0029; việc đồng ý điều khoản ở hệ thống 0050 của trường.

#### S9. Triển khai thử nghiệm

Mục đích: Eric dùng thử nền tảng nhiều trường **sớm, không cần thuê VPS**, và **cho trường thật dùng thử với dữ liệu thật khi đã có văn bản đồng ý của trường** (Eric chốt ngày 2026-10-25), bằng cùng mã nguồn và ảnh container với hồ sơ vận hành (14.4). Hồ sơ (a) viết theo kiểu **bộ nối chọn bằng cấu hình**, không rẽ nhánh trong mã nghiệp vụ. Số giới hạn của từng nền tảng dưới đây **tra ngày 2026-10-25 từ trang tổng hợp và bài của nhà cung cấp, chưa đối chiếu trang giá chính thức, và thay đổi thường xuyên: S9 kiểm lại trang chính thức trước khi dựng và ghi số hiện hành vào YCTD-203**.

**Các bộ nối và lựa chọn (đều chọn bằng cấu hình, 14.4):**

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Web tĩnh, cổng biên | Cloudflare Worker (mặc định), Vercel | Ràng buộc Vercel ở dưới |
| Cơ sở dữ liệu | Neon, Supabase | `DB_HOST_ADAPTER`; cùng bố cục `schema` |
| Kho tệp | Cloudflare R2, Supabase Storage (giao thức S3) | Chỉ khác điểm cuối, vùng, kiểu đường dẫn; kiểm thử tải tệp lớn với từng nơi |
| Máy chủ | Render (chọn đầu), Koyeb (dự phòng) | Cùng ảnh gộp, khác tệp mẫu |
| Tên miền riêng | Cloudflare for SaaS, Vercel Domains | `DOMAIN_PROVIDER` |

**So sánh nền tảng chạy container có gói miễn phí:**

| Nền tảng | Giới hạn đã tra | Nhận xét |
|---|---|---|
| Render (dịch vụ web miễn phí) | Ngủ sau 15 phút không có yêu cầu, thức dậy khoảng 1 phút; 750 giờ máy mỗi tháng cho cả không gian làm việc, hết giờ thì dừng đến đầu tháng; tệp ghi trên đĩa mất khi khởi động lại; PostgreSQL miễn phí của Render hết hạn sau 30 ngày (không dùng); RAM chưa xác minh | **Chọn đầu tiên:** 750 giờ đủ cho **một** dịch vụ chạy cả tháng; chỉ một container gộp |
| Koyeb (một dịch vụ web miễn phí) | 512 MB RAM, 0,1 vCPU; ngủ sau 1 giờ không có yêu cầu, không tắt được; chỉ vùng Frankfurt hoặc Washington; không gắn ổ đĩa; không dùng cho dịch vụ worker; có thể cần thẻ; Koyeb được Mistral AI mua tháng 2/2026, dịch vụ vẫn chạy (theo dõi) | **Dự phòng:** 0,1 vCPU rất yếu, máy xếp thời khoá biểu phải tắt; vùng xa Việt Nam hơn |
| Fly.io | Không còn gói miễn phí cho tài khoản mới, chỉ dùng thử ngắn (khoảng 2 giờ máy hoặc 7 ngày) | **Loại** |

**PostgreSQL và tệp:** Neon: các trang tổng hợp mâu thuẫn nhau (số dự án 10 hay 100, dung lượng mỗi dự án 0,5 hay 1 GB, khoảng 100 giờ máy tính mỗi dự án) và có bộ gom kết nối; Supabase: 500 MB cơ sở dữ liệu mỗi dự án, 2 dự án mỗi tổ chức, **tạm dừng sau 7 ngày không dùng** (phải bật lại tay hoặc có việc định kỳ truy vấn để giữ), có Supabase Storage dùng giao thức S3. Cả hai nhỏ: mỗi trường ba lược đồ khoảng bốn trăm bảng, **dự tính vài chục MB khi chưa có dữ liệu (giả định, S9 đo)**, nên hồ sơ (a) chỉ nuôi **vài trường thử** (`PLATFORM_MAX_SCHOOLS`, S5a áp giới hạn), mỗi trường một năm học đang dùng; **trường thật có dữ liệu lớn hơn phải dùng gói trả phí hoặc chuyển sang hồ sơ (b)**. Cloudflare R2: 10 GB lưu trữ, 1 triệu thao tác loại A, 10 triệu thao tác loại B mỗi tháng, không tính phí băng thông ra, có thể cần thêm phương thức thanh toán để bật. Cloudflare for SaaS: **100 tên miền riêng miễn phí**, mỗi tên vượt thêm 0,10 USD một tháng, tên miền riêng ký tự đại diện chỉ ở gói Enterprise (không cần, vì mỗi trường một tên miền riêng cụ thể). Cloudflare Workers và Cron Triggers: hạn mức gói miễn phí kiểm lại khi làm. Upstash Redis: 500 nghìn lệnh mỗi tháng, 256 MB, trong khi `BLPOP` 5 giây của máy xếp tiêu hơn 500 nghìn lệnh mỗi tháng riêng nó, nên **không dùng Redis ở hồ sơ (a)**.

**Vercel: ràng buộc và cách kết hợp với Cloudflare DNS.**
- **Gói Hobby chỉ dành cho dùng phi thương mại** (kiểm điều khoản hiện hành): thử nghiệm với trường thật, có thu phí hoặc phục vụ bán hàng, có thể bị coi là thương mại, khi đó cần gói trả phí. **Tên miền con ký tự đại diện cần dùng máy chủ tên của Vercel** để cấp chứng chỉ ký tự đại diện, xung đột với việc để DNS ở Cloudflare.
- **Cách 3a (khuyến nghị khi dùng Vercel): Vercel chỉ phục vụ tệp tĩnh, đứng sau Cloudflare.** DNS và tên miền con ký tự đại diện vẫn ở Cloudflare; Worker vẫn là cổng biên nhận `*.<tên miền hệ thống>`, lấy tệp tĩnh từ địa chỉ của dự án Vercel (`<dự án>.vercel.app`) và chuyển `/api/v1` về máy chủ như cũ; Cloudflare for SaaS giữ nguyên cho tên miền riêng. Không cần chuyển máy chủ tên; Vercel chỉ là nơi lưu tệp tĩnh.
- **Cách 3b: Vercel làm cổng biên, tên miền đi qua Vercel.** Tên miền hệ thống, hoặc một tên miền con **ủy quyền bằng bản ghi NS** (ví dụ `trial.<tên miền gốc>`, để tên miền gốc ở lại Cloudflare), dùng máy chủ tên của Vercel; `/api/v1/*` chuyển về máy chủ bằng quy tắc viết lại và phần mềm trung gian của Vercel để đặt tiêu đề tên miền gốc và `EDGE_SHARED_SECRET` (**kiểm trước khả năng thêm tiêu đề vào yêu cầu gửi lên máy chủ; nếu không làm được thì cách 3b không dùng được vì không bảo vệ được tên miền gốc**); tên miền riêng của trường qua `vercel-domains` (giao diện lập trình của Vercel; giới hạn số tên miền mỗi dự án kiểm lại); mất Cloudflare for SaaS và Cron Triggers nên việc định kỳ dùng lịch của GitHub Actions hoặc lịch của Vercel (hạn mức kiểm lại) gọi `tick`.

**Ba tổ hợp chính, S9 có tệp mẫu và các bước cho từng tổ hợp** (`deploy/profiles/trial/<tổ hợp>/`):

| Tổ hợp | Web và tên miền | Cơ sở dữ liệu | Tệp | Máy chủ | Việc định kỳ |
|---|---|---|---|---|---|
| 1 (mặc định) | Cloudflare Worker, DNS và Cloudflare for SaaS | Neon | R2 | Render | Cloudflare Cron Triggers |
| 2 | Cloudflare Worker, DNS và Cloudflare for SaaS | Supabase | Supabase Storage | Koyeb (hoặc Render) | Cloudflare Cron Triggers |
| 3 | Vercel: 3a sau Worker, hoặc 3b qua Vercel | Neon hoặc Supabase | R2 hoặc Supabase Storage | Render hoặc Koyeb | 3a Cron Triggers; 3b GitHub Actions hoặc lịch Vercel |

**Thiết kế dùng chung:**
- **Cổng biên (Cloudflare Worker, thư mục `cloudflare/`)**: tuyến `*.<tên miền hệ thống>/*`; phục vụ ba ứng dụng tĩnh theo tiền tố đường dẫn (S1b đặt `base`) từ tài sản của Worker hoặc từ địa chỉ Vercel ở cách 3a; chuyển `/api/v1/*` về máy chủ, đặt tiêu đề tên miền gốc và `EDGE_SHARED_SECRET`; khi máy chủ đang ngủ (quá thời gian chờ ngắn, 502, 503) trả **trang "đang khởi động" tự thử lại** thay vì lỗi; `scheduled()` gọi `tick` (mỗi 5 phút, cấu hình được) cũng đánh thức máy chủ.
- **Container gộp** (`container/`): một ảnh chạy `identity` và `api` trong một container, một cổng, bộ định tuyến nhỏ bên trong theo đúng bảng tuyến của Caddy (nhóm điểm cuối định danh sang `identity`, phần còn lại sang `api`); `MIGRATE_ON_START=true`; `NODE_OPTIONS=--max-old-space-size` để vừa RAM; không `worker`.
- **Ngủ khi rảnh:** chấp nhận thức dậy chậm (khoảng 1 phút ở Render); **không giữ thức bằng cách gọi liên tục theo mặc định**, chỉ có tùy chọn gọi trong khung giờ thử nếu điều khoản của nhà cung cấp cho phép (kiểm); việc nền đã bù khi bỏ lỡ (S1b).
- **Kết nối cơ sở dữ liệu:** địa chỉ của bộ gom kết nối cho chạy bình thường, địa chỉ trực tiếp cho `migrate`; `TENANT_POOL_MAX=1`, `TENANT_POOL_SCHOOLS` nhỏ; kiểm tra trước tính tương thích bộ gom ở chế độ theo giao dịch với `timezone.ts`, `Migrator` (ghi vào YCTD), và quyền tạo vai trò bằng SQL ở từng nhà cung cấp (vai trò chạy ứng dụng không giữ quyền rộng).
- **Tích hợp ngoài:** `INTEGRATIONS_MODE=simulated` cho trường dữ liệu giả; trường dữ liệu thật dùng cấu hình riêng của trường (S3) khi đã chọn.

**Dữ liệu thật khi có văn bản đồng ý: biện pháp tuân thủ (Eric chốt ngày 2026-10-25, thay cho ràng buộc "chỉ dữ liệu giả").** Máy chủ ở nước ngoài, nên nền tảng chỉ nhận dữ liệu thật của một trường khi đủ các biện pháp sau; trường dùng dữ liệu giả không cần:
1. **Phân loại dữ liệu của trường (`schools.data_class`):** `synthetic` (dữ liệu giả; **có thể bật tự xóa**, mặc định 30 ngày, giả định), `consented` (dữ liệu thật của trường đã có văn bản đồng ý; **không tự xóa**), `production` (dữ liệu thật ở hồ sơ vận hành trong nước). Không còn ràng buộc "chỉ dữ liệu giả".
2. **Hợp đồng hoặc thỏa thuận xử lý dữ liệu cá nhân và văn bản đồng ý, lưu bằng chứng ở `platform`:** bảng `school_consents` (loại `dpa`, `consent`, `impact-assessment`, `risk-acceptance`; người ký, chức danh, ngày, phạm vi dữ liệu, thời hạn, bản quét lưu kèm mã băm, người ghi, phiên bản mẫu). **Không tạo hoặc chuyển trường sang `consented` khi thiếu hồ sơ bắt buộc**; bằng chứng giữ nguyên khi trường bị xóa, trong thời hạn lưu hồ sơ.
3. **Vùng máy chủ gần nhất (Singapore) ghi vào hồ sơ trường:** bảng `school_hosting` (nhà cung cấp, vùng, dịch vụ, ngày bắt đầu), gồm cả bên xử lý phụ (Neon, Supabase, Render, Koyeb, Cloudflare, Vercel nếu dùng); chọn vùng khi dựng từng dịch vụ và ghi nhận ở bước setup; nói rõ Cloudflare phân phối qua mạng biên toàn cầu, Worker không lưu dữ liệu.
4. **Mã hóa trường dữ liệu trẻ em bằng khóa riêng của trường:** khóa của từng trường ở `school_keys` (S1a), bọc bằng `PLATFORM_MASTER_KEY` chỉ có ở môi trường chạy của máy chủ ứng dụng, **không lưu cùng nhà cung cấp cơ sở dữ liệu**; nhà cung cấp cơ sở dữ liệu chỉ thấy bản mã của các trường đó (số định danh của trẻ, khóa truy cập tích hợp). **Dữ liệu còn lại nằm dạng rõ trong cơ sở dữ liệu**, nên đây là biện pháp giảm rủi ro, không phải mã hóa toàn bộ; S9 rà danh sách trường nên mã hóa thêm cho `consented` và ghi vào YCTD.
5. **Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân và đánh giá tác động chuyển dữ liệu ra nước ngoài theo Nghị định 13/2023/NĐ-CP** (kèm hồ sơ thông báo cơ quan có thẩm quyền, thời hạn theo văn bản hiện hành): S8a soạn mẫu, mỗi trường `consented` có bản của mình ở `school_consents`.
6. **Rủi ro pháp lý, ghi rõ:** Nghị định 53/2022/NĐ-CP có quy định về lưu trữ dữ liệu người dùng Việt Nam trong nước (đọc lại điều khoản và điều kiện áp dụng, văn bản hiện hành lúc làm); đặt dữ liệu thật ở máy chủ ngoài nước là **rủi ro tồn đọng**. **Eric là người chấp nhận rủi ro** theo quyết định ngày 2026-10-25, ghi bằng phiếu chấp nhận rủi ro (`risk-acceptance`) do Eric ký. Kế hoạch này không phải tư vấn pháp lý; luật sư của Eric rà trước khi nhận dữ liệu thật.
7. **Lộ trình và công cụ chuyển về VPS trong nước, chuyển bằng cấu hình:** hồ sơ (b) dựng sẵn (S7a); `platform relayout` chuyển dữ liệu và tệp (bên dưới); đổi `data_class` thành `production` sau khi chuyển. Điều kiện kích hoạt ghi vào hồ sơ trường và nhắc ở bảng điều khiển (S4): khi ký hợp đồng chính thức, khi cơ quan có thẩm quyền yêu cầu, khi hết thời hạn đồng ý, khi vượt số trường hay dung lượng của gói miễn phí; thời hạn chuyển mục tiêu 30 ngày kể từ điều kiện (giả định).
8. **Biểu ngữ và chính sách:** `PLATFORM_DATA_POLICY=consent-required` (mặc định hồ sơ (a)) hiện biểu ngữ "môi trường thử nghiệm, máy chủ ngoài Việt Nam" ở mọi giao diện và chặn tạo trường `consented` khi thiếu hồ sơ; `synthetic-only` (tuỳ chọn) khóa chặt chỉ cho dữ liệu giả; `any` cho môi trường dựng của nhà phát triển.

**Chuyển lên VPS không sửa mã:** (1) dựng hồ sơ (b) (S7a); (2) `platform relayout --school <mã> --to database` sao chép dữ liệu từng bảng từ các lược đồ của trường sang cơ sở dữ liệu mới đã chạy migrate (sao chép theo luồng, kiểm số dòng và tổng kiểm từng bảng), ghi bảng `school_databases` của nền tảng mới; (3) chuyển tệp từ R2 hoặc Supabase Storage sang kho tệp (giữ khóa); (4) chuyển tên miền (bản ghi DNS, bỏ tên miền riêng khỏi nhà cung cấp tên miền của hồ sơ (a) hoặc giữ trước Caddy); (5) đổi `data_class` thành `production` chỉ sau khi đã ở trong nước, ghi `school_hosting` mới; (6) xóa trường ở nền tảng thử và yêu cầu nhà cung cấp xóa dữ liệu, giữ biên bản. Với dữ liệu giả có thể **dựng lại trường bằng khởi tạo** thay cho chuyển.

**Tệp mẫu và các bước triển khai** (`deploy/profiles/trial/`; tệp mẫu chỉ chứa giá trị giả, không khóa, mật khẩu hay mã thông báo thật; tệp thật nằm ngoài kho). Dùng chung: `container/Dockerfile.all-in-one`, `container/render.yaml.example`, `container/koyeb.yaml.example`, `cloudflare/` (Worker, `wrangler.toml.example`), `scripts/relayout`, `env.trial.example`. Mỗi tổ hợp có `README.md` các bước, `env.<tổ hợp>.example`:
- **Tổ hợp 1 (Cloudflare, Neon, R2, Render):** (1) đưa tên miền thử về Cloudflare; (2) tạo dự án Neon (vùng Singapore nếu có), lấy địa chỉ gom kết nối và địa chỉ trực tiếp, đặt `DB_HOST_ADAPTER=neon`; (3) tạo bộ chứa R2 và khóa truy cập; (4) tạo dịch vụ web trên Render từ ảnh gộp, đặt biến môi trường từ tệp mẫu; (5) chạy `platform bootstrap` (cơ sở dữ liệu `platform`, khóa gốc, tài khoản vận hành đầu tiên); (6) cài Worker; (7) bản ghi DNS ký tự đại diện qua proxy; (8) khởi tạo trường thử ở bước setup (chọn `data_class`, nhập hồ sơ đồng ý nếu là dữ liệu thật); (9) kiểm tra theo danh sách (đăng nhập, ma trận cách ly, trang đang khởi động, `tick`).
- **Tổ hợp 2 (Cloudflare, Supabase, Koyeb):** như tổ hợp 1 nhưng (2) tạo dự án Supabase (vùng Singapore), `DB_HOST_ADAPTER=supabase`, bật Storage và lấy điểm cuối S3; (3) bỏ R2; (4) Koyeb từ ảnh gộp (tắt máy xếp thời khoá biểu); thêm việc định kỳ truy vấn để dự án không tạm dừng.
- **Tổ hợp 3 (Vercel):** 3a: tạo dự án Vercel chỉ chứa tệp tĩnh, Worker lấy tệp từ địa chỉ dự án (các bước còn lại như tổ hợp 1 hoặc 2); 3b: ủy quyền tên miền con bằng bản ghi NS cho Vercel, tạo dự án với quy tắc viết lại và phần mềm trung gian đặt tiêu đề, `DOMAIN_PROVIDER=vercel-domains`, lịch gọi `tick` bằng GitHub Actions hoặc lịch Vercel.
- **Kiểm thử:** Worker bằng bộ chạy cục bộ của Workers (định tuyến, tiêu đề, trang đang khởi động, `scheduled`, nguồn tệp tĩnh từ Vercel); ba bộ nối tên miền với máy chủ giao diện lập trình giả; ba bộ nối cơ sở dữ liệu và hai bộ nối kho tệp ở mức tạo vai trò, địa chỉ, tải tệp với máy chủ giả; ma trận cách ly và e2e `multi` ở `TENANT_DB_LAYOUT=schema`; kiểm thử khôi phục `relayout` giữa hai bố cục; kiểm thử cổng hồ sơ đồng ý (thiếu hồ sơ thì không tạo `consented`). Không gọi dịch vụ thật trong CI.
- **Lưu ở đâu:** nền tảng 0100 đến 0109 (`school_consents`, `school_hosting`, nếu chưa có ở khối của S2); `data_class` đã có từ S1a.

#### S5a. Gói dịch vụ và giới hạn

- **Gói:** tên, phân hệ được bật, giới hạn (số học sinh đang học, dung lượng tệp, số cấp học bật), giá niêm yết (dùng ở S5b); gán gói cho trường có ngày hiệu lực; phân hệ lấy từ cây menu và `LEVEL_FEATURES`, quyền `P..` gắn phân hệ qua bảng ánh xạ một nơi.
- **Kiểm tra ở máy chủ:** phân hệ ngoài gói trả 403 `MODULE_NOT_IN_PLAN`; vượt giới hạn học sinh thì chặn **thêm** học sinh mới, không chặn xem; ở menu ẩn mục ngoài gói. Dữ liệu của phân hệ bị tắt được giữ nguyên.
- **Trạng thái trường:** `trial` (dùng thử, mặc định 30 ngày, có thể nạp dữ liệu trình diễn của 18h), `active`, `read_only`, `suspended`. **Chế độ chỉ đọc:** mọi yêu cầu ghi bị chặn (trả `SCHOOL_READ_ONLY`), cho phép xem, xuất dữ liệu, đăng nhập, thanh toán và gia hạn; chuyển trạng thái bằng bộ lập lịch của S1b.
- **Hạn chuyển trạng thái cấu hình được** (giả định mặc định: nhắc từ trước 15 ngày, chỉ đọc sau hạn 7 ngày, tạm ngưng sau 30 ngày, giữ dữ liệu theo hợp đồng); không xóa dữ liệu tự động khi hết hạn.
- **Lưu ở đâu:** nền tảng 0040 đến 0049.

#### S3. Cấu hình riêng từng trường

- **Chuyển khóa trong `.env` thành cấu hình của trường**, lưu mã hóa bằng khóa của trường (bọc ở S1a): cổng thanh toán và tài khoản nhận tiền (PayOS, SePay, Casso, VNPay, VietQR tĩnh), eSMS (tên thương hiệu), Zalo OA, Facebook Page, kho tệp nếu trường muốn kho riêng; bộ nối ngoài đọc theo trường qua một lớp `SchoolSettings` thay cho `readConfigurationFromEnvironment`. Thiếu cấu hình thì bộ nối của trường **tắt hoặc chạy giả lập**, không rơi về khóa của trường khác.
- **Nhận diện thương hiệu:** tên trường hiển thị, logo, màu chủ đạo; tên sản phẩm lấy từ cấu hình nền tảng (chưa chốt).
- **Màn hình quản trị của trường** (4. Quản trị hệ thống): nhập, kiểm tra kết nối, xem địa chỉ gọi lại (webhook) của trường để dán vào cổng thanh toán; không hiển thị lại khóa đã lưu (chỉ 4 ký tự cuối).
- **Đổi khóa mã hóa dữ liệu trẻ:** công cụ mã hóa lại từng bước có thể tiếp tục, ghi nhật ký; đổi khóa gốc của nền tảng bọc lại mọi khóa trường.
- **Lưu ở đâu:** cấu hình nhạy cảm ở hệ thống của trường 0051, 0052 (bảng `integration_credentials` mở rộng hoặc bảng mới, chốt khi làm); bản ghi khóa ở `platform` 0030 đến 0039.

#### S5b. Thu phí tự động

- **Quy tắc tính phí cấu hình được (Eric chốt ngày 2026-10-25):** thước đo `per_student` (số học sinh đang học, bậc thang), `per_school` (phí cố định theo trường), `per_module` (theo phân hệ), kết hợp được; **mặc định theo số học sinh; quản trị nền tảng chọn cách tính cho từng gói** (`plans.price_rule_id`, `price_rules`); phí tối thiểu, kỳ (tháng, quý, năm), VAT; giả định mặc định: phí theo số học sinh đang học chốt vào cuối kỳ cộng phí tối thiểu theo trường; **hàm tính thuần có kiểm thử đơn vị** (số tiền là số nguyên đồng).
- **Chốt số liệu kỳ** (`usage_snapshots`: số học sinh, dung lượng) bằng bộ lập lịch; **hóa đơn nội bộ** (`invoices`, dòng hóa đơn, trạng thái, mã thanh toán); điều chỉnh tay của vận hành (giảm giá, tặng kỳ) có lý do và nhật ký.
- **Thu tiền:** mã QR và liên kết thanh toán qua cổng của nền tảng (dùng lại bộ nối PayOS, SePay, Casso, VNPay; **tài khoản nhận tiền của nền tảng là cấu hình, chưa chốt**), đối soát theo nội dung chuyển khoản mã hóa đơn; thanh toán đủ thì tự gia hạn gói và mở lại trường đang `read_only`; bộ giả lập `development` cho kiểm thử.
- **Nhắc gia hạn:** thông báo trong ứng dụng cho quản trị trường, email hoặc tin nhắn theo lịch cấu hình (trước hạn 15, 7, 1 ngày, sau hạn), mỗi lần ghi `dunning_events`.
- **Hóa đơn điện tử:** giao diện bộ nối `EInvoiceProvider` (phát hành, hủy, tra cứu), bộ nối giả lập; **nhà cung cấp thật chưa chốt**, chọn sau và viết một bộ nối; không tự phát hành hóa đơn thật trong DT-SaaS nếu chưa có hợp đồng nhà cung cấp.
- **Màn hình:** hóa đơn của trường trong cổng quản trị trường (xem, tải, trả tiền), trang hóa đơn và công nợ trong cổng nền tảng.
- **Lưu ở đâu:** nền tảng 0050 đến 0059.

#### S4. Bảng điều khiển nền tảng

- **Danh sách trường:** trạng thái, gói, dung lượng, số người dùng, số học sinh, lần đăng nhập cuối, phiên bản cấu trúc, lỗi gần nhất; số liệu thu bằng bộ lập lịch (chỉ số lượng, không đọc nội dung dữ liệu).
- **Đăng nhập hỗ trợ:** mở rộng đăng nhập thay của 18h: quản trị trường bấm cho phép (có hạn, mặc định 24 giờ, rút được), nhân viên nền tảng vào với quyền chỉ đọc hoặc theo phạm vi cho phép, **mọi thao tác ghi cả hai phía** (nhật ký của trường và `platform_audit_log`), biểu ngữ báo đang có phiên hỗ trợ.
- **Thông báo bảo trì** đến người dùng của một, nhiều hoặc mọi trường.
- **Theo dõi lỗi theo trường:** gom lỗi 5xx và tác vụ nền lỗi theo trường, biểu đồ đơn giản, cảnh báo ngưỡng; không có nội dung dữ liệu cá nhân trong nhật ký lỗi.
- **Lưu ở đâu:** nền tảng 0060 đến 0069; phiên hỗ trợ được trường đồng ý ở hệ thống 0053.
- **Đã làm (YCTD-197, phiên bản 0.138.0; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):** số liệu thu mỗi giờ bằng việc định kỳ `school-metrics` (chỉ đếm, đo dung lượng, tên tệp thay đổi cấu trúc; giữ 30 ngày); lỗi 5xx gom theo trường, giờ, mẫu đường dẫn không tham số, ghi mỗi phút, không nội dung yêu cầu; cảnh báo khi lỗi một giờ từ ngưỡng (mặc định 20), cấu trúc chưa mới nhất, từ 90% giới hạn gói, số liệu cũ quá 3 giờ, việc định kỳ lỗi; thông báo bảo trì cho mọi trường hoặc trường chọn, hiện từ 72 giờ trước đến khi kết thúc, hủy được; đăng nhập hỗ trợ: trường bật cho phép (chỉ đọc hoặc toàn quyền, 1 đến 168 giờ, mặc định 24, lý do, rút bất kỳ lúc nào), nhân viên mở phiên kèm lý do, đường liên kết một lần 5 phút, tài khoản hỗ trợ riêng `ho-tro-nen-tang` (Hiệu trưởng, không đăng nhập bằng mật khẩu), phiên tối đa 8 giờ, claim `spt`, chỉ đọc chặn ghi ở hai dịch vụ, mọi phạm vi chặn đăng nhập thay, đổi mật khẩu, kí số, xuất toàn bộ, đổi cho phép; thao tác ghi ở `support_session_actions`, nhật ký hai phía; rút cho phép thì phiên kết thúc ngay (QĐ-32, BR-225 đến BR-227).

#### S7a. Hạ tầng VPS trong nước, phần dựng sẵn

Chỉ sửa `deploy/` và `docker/`, không sửa mã nghiệp vụ.
- **Ba cách đặt máy, cùng một bộ tệp Compose:** (T1) một VPS chạy mọi thứ, cho đến vài chục trường; (T2) hai VPS: ứng dụng (Caddy, `web`, `api`, `identity`, `worker`, Redis, SeaweedFS) và cơ sở dữ liệu (PostgreSQL, PgBouncer, sao lưu); (T3) từ ba VPS: hai máy ứng dụng chạy song song, một máy cơ sở dữ liệu chính, một máy bản sao. Không giả định cân bằng tải hay cơ sở dữ liệu quản lý của nhà cung cấp: hai máy ứng dụng đặt sau hai địa chỉ A của tên miền kèm kiểm tra sức khỏe (hoặc một địa chỉ nổi nếu cùng mạng), ghi rõ giới hạn.
- **PgBouncer** ở chế độ gom theo giao dịch phía trước PostgreSQL (kiểm tra trước: `timezone.ts`, mọi `SET` theo phiên, khóa tư vấn, `LISTEN`; ghi kết quả vào YCTD); cấu hình PostgreSQL cho hàng trăm cơ sở dữ liệu nhỏ.
- **Caddy bắt mọi tên miền:** khối địa chỉ bắt chung với `on_demand_tls` hỏi điểm cuối `domain-check`; không còn tên miền ghi trong tệp; chạy được cả bản một trường hiện nay.
- **Giám sát và cảnh báo** chạy trên chính VPS (không dịch vụ ngoài): chỉ số máy chủ và PostgreSQL, nhật ký tập trung, kiểm tra tên miền và chứng chỉ sắp hết hạn, cảnh báo qua email, Zalo hoặc Telegram cấu hình được.
- **Môi trường thử (staging):** cùng bộ Compose, tên dự án và tiền tố cơ sở dữ liệu khác, tên miền `*.staging.<tên miền hệ thống>`, dữ liệu giả; chạy được trên cùng VPS hoặc máy riêng.
- **Triển khai không gián đoạn:** hai bản `api` và `identity`, khởi động lại lần lượt sau kiểm tra sức khỏe, `migrate` chạy trước theo quy tắc tương thích lùi.
- **Hướng dẫn vận hành** (`deploy/README.md` và tài liệu 12): quy mô gợi ý (giả định, chưa đo; S7b đo), mở thêm VPS, chuyển cụm, cấp chứng chỉ, thay khóa, xử lý sự cố.
- **Vị trí máy chủ:** checklist chọn nhà cung cấp đặt máy tại Việt Nam, bản sao lưu ngoài máy cũng ở trong nước (Nghị định 53/2022/NĐ-CP, đọc lại văn bản còn hiệu lực).

#### S7b. Vận hành nhiều trường

- **Sao lưu theo từng trường:** `backup.sh` lấy danh sách trường từ `platform`, sao lưu logic riêng từng trường (định danh, hệ thống, năm học đang dùng mỗi giờ, mọi năm mỗi ngày như hiện nay), thư mục và mã hóa theo trường, đẩy ra ngoài máy chủ; **khôi phục một trường** vào chính nó hoặc vào trường mới (để xem lại) mà không ảnh hưởng trường khác.
- **Khôi phục về một thời điểm** của cả cụm bằng sao lưu cơ bản và lưu nhật ký giao dịch (WAL) đẩy ra ngoài; quy trình lấy riêng một trường từ bản khôi phục tạm.
- **Diễn tập khôi phục tự động hằng tháng** vào staging, kiểm tra đọc được và so số dòng; báo kết quả cho S4.
- **Chuyển trường sang cụm khác:** công cụ dừng ghi, sao chép, đổi `school_clusters`, mở lại, có kiểm tra số dòng; dùng khi một máy cơ sở dữ liệu đầy.
- **Thử tải nhiều trường:** dựng trường giả (ví dụ 50 trường, mỗi trường ba năm học, dữ liệu giả cỡ trường thật) đo số kết nối, bộ nhớ, thời gian migrate cuốn chiếu, thời gian sao lưu; ghi giới hạn của từng cách đặt máy (T1 đến T3).
- **Mục tiêu ghi rõ (giả định, đo rồi chốt):** khôi phục về thời điểm cách sự cố không quá 5 phút (RPO) khi có nhật ký giao dịch, không quá 1 giờ khi chỉ có sao lưu theo giờ; khôi phục dịch vụ trong 4 giờ (RTO) với T2, T3; sẵn sàng 99,5% ở T1, 99,9% ở T3 khi bản sao tự gánh được (giả định, không cam kết trước khi đo).
- **Lưu ở đâu:** `backup_runs` và trạng thái chuyển cụm ở `platform` 0070 đến 0079.

#### S8a. Pháp lý và hồ sơ tuân thủ (tài liệu)

- Bộ tài liệu bản nháp: **hợp đồng dịch vụ** (phạm vi, gói, phí, hạn, chấm dứt, trả dữ liệu); **thỏa thuận xử lý dữ liệu cá nhân** (trường là bên kiểm soát dữ liệu, nền tảng là bên xử lý; mục đích, thời hạn, biện pháp bảo vệ, bên xử lý phụ, quyền của chủ thể dữ liệu, dữ liệu của trẻ em); **điều khoản sử dụng và chính sách bảo mật** hiển thị trong ứng dụng (phiên bản có số, việc đồng ý ghi ở S2); **hồ sơ đánh giá tác động xử lý dữ liệu cá nhân** và hồ sơ thông báo; **hồ sơ đề xuất cấp độ an toàn hệ thống thông tin** (xác định cấp độ, phương án bảo vệ, đối chiếu tiêu chuẩn); **quy trình xử lý sự cố và thông báo vi phạm dữ liệu** (thời hạn theo văn bản hiện hành); chính sách lưu giữ và xóa (nối với S2, S7b; khác nhau cho dữ liệu giả có tự xóa và dữ liệu thật không tự xóa); danh sách bên xử lý phụ (nhà cung cấp VPS, cổng thanh toán, tin nhắn).
- **Bộ hồ sơ cho trường dùng thử dữ liệu thật ở máy chủ ngoài Việt Nam (S9, Eric chốt ngày 2026-10-25):** (1) **mẫu hợp đồng hoặc thỏa thuận xử lý dữ liệu cá nhân** cho giai đoạn thử; (2) **mẫu văn bản đồng ý của trường** cho thử nghiệm với dữ liệu thật ở máy chủ ngoài nước (nội dung dữ liệu, phạm vi, thời hạn, quyền rút, nhà cung cấp và vùng máy chủ, rủi ro đã được thông báo, người ký có thẩm quyền) và **mẫu thông báo, căn cứ xử lý cho cha mẹ hoặc người giám hộ** (trường là bên quyết định căn cứ xử lý, nền tảng chỉ cung cấp mẫu); (3) **hồ sơ đánh giá tác động xử lý dữ liệu cá nhân** và **hồ sơ đánh giá tác động chuyển dữ liệu cá nhân ra nước ngoài theo Nghị định 13/2023/NĐ-CP**, cùng hồ sơ nộp cơ quan có thẩm quyền (thời hạn, đầu mối theo văn bản hiện hành); (4) **bản ghi vùng máy chủ và bên xử lý phụ** (nhà cung cấp, dịch vụ, vùng gần nhất Singapore, ngày bắt đầu), mẫu của bảng `school_hosting`; (5) **phiếu chấp nhận rủi ro pháp lý** về lưu trữ dữ liệu trong nước theo Nghị định 53/2022/NĐ-CP, **Eric là người chấp nhận rủi ro** (mẫu có chỗ ghi tên, ngày, phạm vi và thời hạn chấp nhận); (6) **kế hoạch và lộ trình chuyển về VPS trong nước** (điều kiện kích hoạt, thời hạn, công cụ `platform relayout`, trách nhiệm); (7) hướng dẫn **mã hóa trường dữ liệu trẻ em bằng khóa riêng của trường** và giới hạn của biện pháp này (dữ liệu còn lại dạng rõ).
- Mã lưu bằng chứng (`school_consents`, `school_hosting`) làm ở S2, S9; S8a chỉ soạn tài liệu và mẫu, ghi tên trường dữ liệu mà mẫu cần để hai bên khớp nhau.
- Tệp tài liệu mới do S8a tự đặt số và đăng ký ở `index.md`; **bản nháp, cần luật sư của Eric rà trước khi dùng**; không ghi số liệu, tên pháp nhân hay thông tin thật của nhà cung cấp chưa chốt (để chỗ trống có chú thích).

- **Ghi chú khi làm (YCTD-200, 2026-10-25):** đã soạn ở `33_HO_SO_PHAP_LY/`. Khi đối chiếu văn bản hiện hành: Nghị định 13/2023/NĐ-CP **hết hiệu lực từ 01/01/2026**, thay bằng Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP (hồ sơ đánh giá tác động, hồ sơ chuyển xuyên biên giới gửi trong 60 ngày; thông báo vi phạm 72 giờ); khung an ninh mạng đổi sang Luật An ninh mạng số 116/2025/QH15, Nghị định 331/2026/NĐ-CP (cấp độ hệ thống thông tin, thay vị trí của Nghị định 85/2016 ở phần này) và Nghị định 333/2026/NĐ-CP (lưu trữ dữ liệu tại Việt Nam). Các chỗ ở mục 14 còn ghi Nghị định 13/2023, 53/2022, 85/2016 đọc theo văn bản mới; S2, S9 dùng tên văn bản mới. Thêm rủi ro: nền tảng có thể thuộc diện kinh doanh dịch vụ xử lý dữ liệu cá nhân cần Giấy chứng nhận (Điều 21 đến 27 Nghị định 356/2025), mẫu PL-15, luật sư kết luận trước khi nhận dữ liệu thật.

#### S8b. Bảo mật mã

- **Xác thực hai lớp (TOTP) bắt buộc cho tài khoản vận hành nền tảng**; cho quản trị trường là **tuỳ chọn bật theo trường**. Quyết định hiện hành YCTD-31 (không dùng xác thực hai lớp cho Hiệu trưởng, Phó Hiệu trưởng, kế toán trưởng, quản trị nền tảng, RR-15) **chỉ đổi khi Eric xác nhận** (14.11).
- **Chính sách mật khẩu theo trường** (độ dài, hết hạn, khóa khi sai) nằm trên cơ chế hết hạn mật khẩu đã có ở DT-15; mặc định nền tảng cho tài khoản vận hành.
- **Rà bảo mật:** tiêu đề bảo mật ở Caddy, giới hạn tần suất theo trường và địa chỉ, `__Secure-` cho cookie mã làm mới, kiểm tra mã phiên theo trường, nhật ký truy cập dữ liệu trẻ theo trường; **xoay khóa** (khóa ký mã phiên, khóa gốc của nền tảng) có quy trình và công cụ.
- **Kiểm tra trong CI:** quét thành phần phụ thuộc có lỗ hổng, quét bí mật trong mã, kiểm tĩnh của 14.7.
- **Kiểm thử xâm nhập:** danh sách kiểm theo OWASP ASVS mức 2 cho phần đa thuê bao (vượt trường, đổi tên miền, giả `Host`, tải tệp), bản kiểm thử bên ngoài do Eric thuê; phần này chỉ sửa lỗi tìm ra và ghi hồ sơ.
- **Lưu ở đâu:** nền tảng 0080 đến 0089; hệ thống 0054 (chính sách theo trường); định danh 0101, 0102 (bảng TOTP).

#### S6. Đơn vị cấp trên (đợt 5, Eric đã duyệt ngày 2026-10-25)

- **Ba cấp tài khoản cấp trên: Bộ, Sở, Phòng Văn hóa – Xã hội (cấp xã, theo mô hình chính quyền hai cấp).** Mỗi cấp **xem số liệu tổng hợp của các trường thuộc phạm vi của mình và đã đồng ý**; **không xem chi tiết từng học sinh** nếu không được cấp quyền (cấp quyền xem chi tiết ở dưới).
- **Cây đơn vị hành chính cấu hình được** (`admin_units` ở `platform`: cấp, tên, mã, đơn vị cha, trạng thái): quản trị nền tảng thêm, sửa, gộp, tách nút khi tổ chức lại, không ghi cứng địa danh trong mã; bộ nút mặc định (Bộ, các Sở, các Phòng Văn hóa – Xã hội) nạp theo danh mục hành chính hiện hành sau khi đọc văn bản gốc, sửa được. Mỗi trường gắn với **một nút quản lý** (thường là Phòng Văn hóa – Xã hội của xã, phường; trường do Sở quản lý trực tiếp gắn thẳng vào nút Sở); phạm vi của một tài khoản cấp trên là **cây con** của nút nó được gán.
- **Tài khoản cấp trên** (`parent_org_users`) ở `platform`, không thuộc trường nào, gắn một nút; xác thực hai lớp bắt buộc (S8b); nhật ký truy cập ở `platform_audit_log`.
- **Đồng ý của trường, rút được bất kỳ lúc nào:** `school_aggregate_consents` theo trường, theo cấp (Bộ, Sở, Phòng) và theo nhóm số liệu (quy mô, chuyên cần, kết quả học tập, cơ sở vật chất, nhân sự, EMIS); quản trị trường bật, tắt ở màn hình quản trị trường; trường chưa đồng ý không có mặt trong số liệu của cấp đó (kể cả cộng dồn).
- **Chỉ số liệu tổng hợp, không truy vấn chéo cơ sở dữ liệu của trường:** mỗi trường đẩy bản chụp tổng hợp theo chu kỳ vào `aggregate_snapshots` (chỉ số lượng, tỉ lệ, số liệu báo cáo đã tổng hợp, dùng đầu vào là báo cáo và thống kê đã có ở 20f, 21g và EMIS), không có dữ liệu cá nhân của học sinh; cộng dồn theo cây từ nút lá lên Sở và Bộ; **ẩn nhóm quá nhỏ** (nút có ít hơn một ngưỡng trường hoặc học sinh, cấu hình, mặc định 5, giả định) để không suy ra từng trường hay từng em.
- **Quyền xem chi tiết (mặc định không có):** cấp trên đề nghị, quản trị trường duyệt theo phạm vi (nhóm dữ liệu, thời hạn, người), mỗi lần xem ghi ở nhật ký của trường và của nền tảng, trường rút được; dùng cơ chế phiên hỗ trợ của S4, không đường tắt nào khác.
- **Màn hình:** bảng điều khiển cấp trên (chọn nút, cây con, nhóm số liệu, so sánh giữa các trường đã đồng ý, xuất Excel, PDF); quản lý cây đơn vị và tài khoản cấp trên trong cổng nền tảng; màn hình đồng ý ở cổng quản trị trường.
- **Mở rộng sau, bằng YCTD riêng:** thi đua khối, cụm và cấp Phòng, Sở (22d), đánh giá ngoài (22f), nối hệ thống của Bộ, Sở.
- **Phụ thuộc:** S1a, S4 (phiên hỗ trợ, bảng điều khiển), S8b (xác thực hai lớp).
- **Đã làm (YCTD-202, phiên bản 0.139.0; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):** chỉ tệp nền tảng 0090 (`admin_units`, `schools.admin_unit_id`, `parent_org_users` kèm TOTP và mã khôi phục, `school_aggregate_consents`, `aggregate_snapshots`, `parent_org_access_requests`, phiên hỗ trợ có `requester_kind`); không cần định danh 0103, hệ thống 0055 vì bằng chứng đồng ý ở nền tảng (mỗi lần bật một dòng, rút ghi người, thời điểm). Bộ nút mặc định: Bộ GD&ĐT, Sở GD&ĐT TP.HCM, 168 Phòng của xã, phường mới từ danh mục chính thức đã có; tỉnh khác nạp bằng danh sách. Tài khoản cấp trên đăng nhập ở cổng nền tảng (`/cap-tren`), xác thực hai lớp bắt buộc, mã phiên đối tượng riêng 8 giờ. Bản chụp mỗi 6 giờ, sáu nhóm, chỉ số đếm, cả hai bố cục. Số liệu, xuất Excel, PDF ở máy chủ API, đường dẫn không cần trường, chỉ tên miền cổng; ẩn ô 1 đến 4 người, tổng của nút ít hơn 5 trường không hiện (ngưỡng `PARENT_ORG_MIN_GROUP`, giả định). Xem chi tiết: đề nghị, trường duyệt, phiên hỗ trợ chỉ đọc của S4, rút được (QĐ-33, BR-228 đến BR-230).
- **Lưu ở đâu:** nền tảng 0090 đến 0099 (`admin_units`, `parent_org_users`, `school_aggregate_consents`, `aggregate_snapshots`); định danh 0103 nếu cần; hệ thống của trường: cấu hình đồng ý ở hệ thống 0055 (dự phòng).

### 14.6 Quyết định thiết kế và phương án đã loại

Các lựa chọn dưới đây do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, trừ các quyết định của Eric ở 14.1.

- **Mô hình A (Eric chốt), loại B và C:** B (dùng chung cơ sở dữ liệu, thêm cột `tenant_id`, hoặc bảo vệ ở mức dòng) loại vì phải sửa và kiểm thử mọi truy vấn, sót một chỗ là lộ dữ liệu trẻ giữa các trường, lại mâu thuẫn với cơ sở dữ liệu theo năm học. C (mỗi trường một bản triển khai riêng) vẫn dùng được cho khách lớn muốn máy riêng: cùng mã nguồn, chỉ khác nơi đặt, chạy ở chế độ một trường; không phải việc của DT-SaaS.
- **Tên miền con theo mã trường là mặc định; tên miền riêng cấu hình tay (Eric chốt):** loại "đường dẫn `/<mã trường>` trên một tên miền" vì cookie, bộ nhớ trình duyệt và chứng chỉ chung cho mọi trường (một trường lỗi chạy mã giao diện có thể đọc dữ liệu cục bộ của trường kia). Tên miền con tách nguồn gốc (origin) từng trường.
- **Ba ứng dụng chung một tên miền theo tiền tố đường dẫn** (`/quan-ly`, `/giao-vien`, `/phu-huynh`, gốc là website): giữ mọi thứ của một trường ở một tên miền, một chứng chỉ, cookie không cần `Domain`, không gọi chéo tên miền (khớp quy ước 8 của tài liệu 17). Phải đặt đường dẫn gốc (`base`) cho ba ứng dụng web và chỉnh Caddy; ghi vào S1b. Phương án loại: mỗi ứng dụng một tên miền con (`quan-ly-<mã>.…`) vì nhân số tên miền, chứng chỉ và hướng dẫn CNAME lên gấp ba.
- **Cặp khóa ký mã phiên dùng chung của nền tảng, mã trường (`tid`) bắt buộc khớp:** đơn giản cho `api` (một khóa công khai), xoay khóa một nơi. Phương án loại: mỗi trường một cặp khóa (cách ly mạnh hơn khi lộ khóa, nhưng nhân việc phát khóa và xoay khóa; có thể thêm sau vì mã phiên đã có `tid`). Rủi ro lộ khóa ký ghi ở 14.8.
- **Một vai trò PostgreSQL mỗi trường:** hàng rào thứ hai ngoài mã; một lỗi trong ứng dụng cũng không đọc được cơ sở dữ liệu trường khác. Phải xử lý PgBouncer xác thực theo vai trò (danh sách xác thực sinh từ `platform`). Phương án loại: một vai trò chung cho mọi trường (đơn giản nhưng bỏ hàng rào).
- **Ngữ cảnh trường qua `AsyncLocalStorage`, giữ chữ ký `Databases`, `cacheKey`, `storageKey`:** không phải sửa hàng trăm chỗ gọi; nhược điểm là việc nền phải tự bọc ngữ cảnh, nên **đóng chặt** (lỗi khi thiếu) và có kiểm tĩnh. Phương án loại: truyền `school` làm tham số khắp nơi (sửa quá lớn, dễ sót).
- **Một tiến trình `api` phục vụ mọi trường, không một tiến trình mỗi trường:** gom kết nối bằng nhóm có giới hạn và PgBouncer; mở rộng bằng thêm bản `api`. Phương án loại: một vùng chứa mỗi trường (tốn bộ nhớ, cập nhật phải lặp).
- **Bản triển khai hiện có thành trường số 1, không chuyển dữ liệu:** lệnh nhận bản đang chạy chỉ ghi `platform` và dùng lại cơ sở dữ liệu cũ, khóa tên cũ (tiền tố trống). Phương án loại: đổi tên và chép cơ sở dữ liệu (rủi ro, thời gian dừng).
- **Chế độ một trường là mặc định:** mọi bản triển khai hiện nay và e2e hiện có chạy không đổi; kiểm thử nhiều trường là bộ riêng (14.7).
- **Tài khoản không gộp giữa các trường:** một người dạy hai trường có hai tài khoản, đăng nhập ở hai tên miền; không có danh tính chung (làm thế phải có kho tài khoản chung, trái mô hình A và nguyên tắc tách dữ liệu). Trang chọn trường chỉ chuyển hướng. Tài khoản chuyên viên Phòng, Sở nằm ở S6.
- **Ứng dụng di động:** hiện chỉ có ứng dụng web; "nhập mã trường hoặc quét QR" của bản nháp chỉ làm ở trang chọn trường và mã QR của đường dẫn trường (in được ở S2); vỏ ứng dụng di động gốc nằm ngoài DT-SaaS (cập nhật 2026-10-26: Eric yêu cầu ứng dụng cài đặt, làm ở DT-26 bằng cách đóng gói mã web, mục 18).
- **Thu phí tự động trong đợt đầu (Eric chốt):** S5a, S5b thuộc lõi; tiền thu qua cổng thanh toán đã có bộ nối; hóa đơn điện tử đi qua bộ nối có giả lập vì nhà cung cấp chưa chốt. Phương án loại: ký hợp đồng và thu thủ công trước (Eric không chọn).
- **Hết hạn thì chỉ đọc, không xóa:** tránh mất dữ liệu trẻ vì quên gia hạn; xóa chỉ khi trường yêu cầu và qua thời gian chờ.
- **Chứng chỉ HTTPS:** giai đoạn đầu cấp theo yêu cầu cho cả tên miền con và tên miền riêng (chỉ cho tên miền có trong danh sách, đã xác nhận DNS); nhà cung cấp chứng chỉ có hạn mức số chứng chỉ mới mỗi tuần cho một tên miền đăng ký (kiểm tra hạn mức hiện hành), nên khi mở nhiều trường cùng lúc cần **chứng chỉ ký tự đại diện** cho tên miền hệ thống (xác nhận bằng DNS, cần nhà cung cấp DNS có giao diện lập trình mà Caddy hỗ trợ). Ghi vào S7a như tùy chọn bật sau.
- **Hai hồ sơ cùng một mã, chọn bằng cấu hình (Eric bổ sung ngày 2026-10-25):** giao diện cộng bộ nối cho bố cục cơ sở dữ liệu, nguồn tên miền, lập lịch, tên miền riêng, nhà cung cấp cơ sở dữ liệu, kho tệp; không nhánh Git, không `if` theo hồ sơ. Eric chốt dùng **cả ba phương án** của hồ sơ thử nghiệm (web tĩnh Cloudflare hoặc Vercel; cơ sở dữ liệu Neon hoặc Supabase, tệp R2 hoặc Supabase Storage; máy chủ Render, dự phòng Koyeb): mỗi cái là một bộ nối, S9 có tệp mẫu và các bước cho ba tổ hợp chính. Phương án loại: một nhánh mã riêng cho nền tảng miễn phí (hai bản phải giữ đồng bộ, lệch dần).
- **Thử nghiệm dùng bố cục `schema` với một vai trò mỗi lược đồ, không mỗi trường một cơ sở dữ liệu:** gói miễn phí giới hạn số cơ sở dữ liệu, dung lượng và kết nối; vai trò riêng mỗi lược đồ giữ cách ly ở mức quyền PostgreSQL và `search_path` mức vai trò chạy được qua bộ gom kết nối theo giao dịch mà mã không đổi. Phương án loại: (i) một vai trò chung và `SET search_path` mỗi yêu cầu (sai khi gom kết nối theo giao dịch, và là điểm lộ dữ liệu nếu quên đặt); (ii) lọc theo cột mã trường (mô hình B, đã loại ở 14.6); (iii) gộp các lược đồ năm học vào một (làm hỏng cách chuyển năm học và khóa năm đã đóng); (iv) ít trường thử và vẫn mỗi trường một cơ sở dữ liệu (không đủ với giới hạn gói miễn phí) , nên số trường thử bị giới hạn bằng cấu hình thay vì đổi bố cục.
- **Cổng biên mặc định là Cloudflare Worker kèm tài sản tĩnh; Vercel là bộ nối thứ hai:** vì tên miền con ký tự đại diện và tên miền riêng nhiều trường; Vercel gói Hobby chỉ dùng phi thương mại và đòi máy chủ tên của Vercel cho tên miền con ký tự đại diện; Cloudflare Pages không có tên miền ký tự đại diện. Khi dùng Vercel ưu tiên **cách 3a** (Vercel chỉ phục vụ tệp tĩnh sau Worker, DNS ở lại Cloudflare); **cách 3b** (tên miền đi qua Vercel, ủy quyền bằng bản ghi NS) chỉ khi kiểm chứng được việc đặt tiêu đề tên miền gốc và bí mật cổng biên ở Vercel (S9).
- **Cho trường thật dùng thử dữ liệu thật ở máy chủ ngoài nước, kèm biện pháp tuân thủ (Eric chốt ngày 2026-10-25):** thay cho ràng buộc "chỉ dữ liệu giả" và bỏ tự xóa sau 30 ngày với trường thật (trường dữ liệu giả vẫn có thể bật tự xóa). Eric là người chấp nhận rủi ro pháp lý về Nghị định 53/2022/NĐ-CP; biện pháp gồm hợp đồng, thỏa thuận xử lý dữ liệu và văn bản đồng ý lưu ở `platform`, vùng Singapore ghi vào hồ sơ, mã hóa trường dữ liệu trẻ em bằng khóa riêng, hồ sơ đánh giá tác động theo Nghị định 13/2023/NĐ-CP, lộ trình và công cụ chuyển về trong nước. Phương án loại: khóa chặt chỉ dữ liệu giả (Eric không chọn; vẫn có thể bật bằng `synthetic-only`); chờ có VPS rồi mới cho trường thật dùng thử (chậm việc dùng thử).
- **S6 đủ ba cấp Bộ, Sở, Phòng Văn hóa – Xã hội trên một cây đơn vị hành chính cấu hình được (Eric duyệt ngày 2026-10-25):** cây cấu hình được vì tổ chức hành chính thay đổi; số liệu đẩy dạng tổng hợp từ từng trường và có đồng ý của trường, không truy vấn chéo cơ sở dữ liệu; chi tiết học sinh chỉ khi được cấp quyền, có hạn, có nhật ký. Phương án loại: cấp trên đọc thẳng cơ sở dữ liệu của trường (phá cách ly).
- **Một container gộp, không Redis, không worker ở hồ sơ (a):** các gói miễn phí chỉ cho một dịch vụ, RAM nhỏ và CPU yếu; Redis miễn phí hết hạn mức vì `BLPOP`. Máy xếp thời khoá biểu có thể tắt bằng gói dịch vụ.
- **Việc định kỳ do bên ngoài gọi, làm việc bù:** tiến trình miễn phí ngủ nên bộ đếm giờ trong tiến trình không đáng tin; việc đến hạn tính từ dấu thời gian trong cơ sở dữ liệu nên gọi muộn vẫn đủ.
- **Không giữ thức bằng gọi liên tục theo mặc định:** có thể trái điều khoản gói miễn phí và tốn giờ máy; chấp nhận khởi động chậm và có trang chờ.
- **Không làm ở DT-SaaS:** mô hình dùng chung cơ sở dữ liệu; danh tính chung nhiều trường; ứng dụng di động gốc (cập nhật 2026-10-26: chuyển sang DT-26, mục 18); thị trường học liệu liên trường thật (22h2 chỉ có gói tệp, danh mục chung liên trường là việc sau DT-SaaS, thêm bằng YCTD riêng); tự động mở rộng máy chủ, dịch vụ đám mây quản lý (Eric chọn VPS trong nước); thành phần AI (đã chuyển thành phần 23d của DT-23, mục 15, theo quyết định của Eric ngày 2026-10-26).

### 14.7 Kiểm thử cách ly dữ liệu giữa các trường

Nguyên tắc: **cách ly là điều phải chứng minh bằng kiểm thử tự động, ở nhiều lớp, và phần nào làm yếu đi thì CI đỏ.** Bộ kiểm thử đặt ở `tests/tenancy/` và các spec `130-` đến `139-`, S1a dựng khung.

**Dữ liệu mồi (canary).** Mỗi trường giả (`alpha`, `beta`, `gamma`) được nạp một bộ dữ liệu có **chuỗi nhận dạng riêng** (ví dụ `CANARY-ALPHA-…`) ở mọi loại nơi lưu: tên học sinh, phụ huynh, nhân viên; tệp ở kho tệp; thông báo ở hàng đợi; khóa trong Redis; tác vụ xuất nền; nhật ký kiểm toán; cấu hình tích hợp (bộ nối giả lập có dấu riêng từng trường); tên miền. Kiểm thử khẳng định chuỗi của trường này **không bao giờ** xuất hiện ở nơi của trường khác.

Các lớp kiểm thử:

1. **Đơn vị:** bộ phân giải trường (tên miền lạ, tên miền ở trạng thái chưa xác nhận, `Host` giả, `X-Forwarded-Host` khi không tin proxy); `Databases` không bao giờ trả kết nối của trường khác và lỗi khi thiếu ngữ cảnh ở chế độ nhiều trường; `cacheKey`, `storageKey` luôn có tiền tố; nhóm kết nối tôn trọng giới hạn và đóng đúng; mã phiên khác `tid` bị từ chối.
2. **Kiểm tĩnh (chạy ở CI, không cần dịch vụ):** quét mã nguồn, chặn (a) mở kết nối cơ sở dữ liệu, Redis, S3 ngoài lớp hạ tầng, (b) đọc `process.env` ngoài tệp cấu hình và khởi động, (c) ghép khóa Redis, đường dẫn S3, tên hàng đợi bằng chuỗi thay vì hàm chung, (d) tên bảng hay đường dẫn có chứa mã trường ghi cứng, (e) **tuyến API chưa khai báo chính sách trường**: mọi tuyến phải nằm trong bảng `tenancy-route-policy` (cần trường, công khai theo tên miền, hoặc của nền tảng) kèm lý do, nên tuyến mới thêm mà chưa khai báo làm kiểm thử đỏ.
3. **Ma trận cách ly API (cấp yêu cầu):** liệt kê **tự động mọi tuyến** từ bảng tuyến của máy chủ; với mỗi tuyến cần trường: (i) mã phiên của trường A gọi ở tên miền trường B, (ii) mã phiên trường A gọi tên miền A nhưng kèm mã đối tượng (id) của trường B, (iii) không mã phiên; kỳ vọng 401, 403 hoặc 404, và **thân phản hồi không chứa chuỗi canary của B**; với tuyến công khai theo tên miền: gọi tên miền A không thấy dữ liệu B. Tuyến mới thêm vào kho mã tự vào ma trận.
4. **Cơ sở dữ liệu:** (i) kết nối bằng vai trò của A vào cơ sở dữ liệu của B bị từ chối; (ii) sau mỗi bộ kiểm thử, **xuất bản chụp cơ sở dữ liệu của A và tìm chuỗi canary của B** (phải không có); (iii) không có bảng nghiệp vụ nào có cột mã trường (khẳng định mô hình A không bị phá).
5. **Kho tệp và Redis:** ghi tệp, khóa ở A rồi liệt kê khóa, tệp theo tiền tố B (phải rỗng); xóa trường A xóa sạch tiền tố của A mà không đụng B.
6. **Việc nền và tích hợp:** hàng đợi thông báo có thông báo của A và B cùng lúc, bộ nối giả lập đánh dấu trường: thông báo của A chỉ ra bằng cấu hình của A; trường không có cấu hình thì bộ nối tắt chứ không dùng của trường khác; bộ lập lịch chạy cả hai trường, trường lỗi không chặn trường kia; hàng đợi máy xếp thời khoá biểu giữ công việc đúng trường; webhook thanh toán gọi tên miền A chỉ ghi nhận cho A.
7. **E2E nhiều trường (trình duyệt):** hai ngữ cảnh trình duyệt (A, B) đăng nhập cùng lúc ở hai tên miền; dữ liệu mỗi bên khác nhau; thử sao chép địa chỉ API, mã phiên giữa hai bên; thử trang chọn trường; thử trường tạm dừng, chỉ đọc, bị xóa (tên miền trả 404 hoặc thông báo đúng); tên miền riêng cấu hình tay cho một trường.
8. **Vòng đời:** khởi tạo trường mới rồi chạy ma trận; tạm dừng rồi mở lại; xóa trường rồi khẳng định cơ sở dữ liệu, vai trò, tiền tố tệp, khóa Redis đều hết và trường còn lại nguyên vẹn.
9. **Hai bố cục cơ sở dữ liệu:** lớp 1 đến 8 chạy ở **cả hai** `TENANT_DB_LAYOUT`; riêng bố cục `schema` thêm: vai trò của lược đồ A đọc, ghi, tạo bảng ở lược đồ B và ở `public` đều bị từ chối; `search_path` của mỗi vai trò chỉ chứa lược đồ của nó; lỗi `search_path` (truy vấn không có tên lược đồ) không bao giờ rơi vào lược đồ của trường khác; năm học đã đóng ghi bị từ chối bằng `default_transaction_read_only` mức vai trò; công cụ `relayout` giữ nguyên số dòng và tổng kiểm từng bảng hai chiều.
10. **Hồ sơ thử nghiệm:** Worker định tuyến đúng theo tên miền và tiền tố đường dẫn (và nguồn tệp tĩnh Vercel ở cách 3a), tiêu đề tên miền và bí mật cổng biên không giả được từ ngoài (gọi thẳng máy chủ với tiêu đề giả bị từ chối), `tick` bỏ lỡ nhiều chu kỳ vẫn bù đủ, trang "đang khởi động" khi máy chủ không trả lời; **cổng hồ sơ đồng ý:** không tạo hoặc chuyển trường sang `consented` khi thiếu `school_consents` hay `school_hosting`, trường `synthetic` tự xóa đúng hạn còn `consented` không bị tự xóa; khóa của trường mã hóa trường dữ liệu trẻ em và bản mã không đọc được bằng khóa trường khác; **cấp trên (S6):** mỗi cấp chỉ thấy cây con của mình và trường đã đồng ý, nhóm nhỏ bị ẩn, không có đường nào ra dữ liệu từng học sinh khi chưa có quyền xem chi tiết.
11. **Hồi quy:** toàn bộ e2e hiện có chạy được ở **chế độ nhiều trường** (một trường giả có tên miền thay cho `localhost`) và ở chế độ một trường như cũ.

**Cổng kiểm của mọi phần DT-SaaS:** lớp 1, 2, 3 chạy ở mọi PR; lớp 4 đến 8 chạy ở PR của phần chạm đến lớp tương ứng và hằng đêm trên `main`; lớp 11 (hồi quy) chạy ở PR của S1a, S1b, S2, S3, S5a và hằng đêm; lớp 9 chạy ở PR của S1a, S2, S9 và hằng đêm; lớp 10 chạy ở PR của S9. Không phần nào gộp khi lớp nào trong số bắt buộc của nó đỏ.

**Chạy e2e với nhiều trường.**
- **Tên miền giả lập:** tên miền hệ thống kiểm thử là `e2e.localhost`, các trường là `alpha.e2e.localhost`, `beta.e2e.localhost`, `gamma.e2e.localhost`. Trình duyệt Chromium tự đưa mọi `*.localhost` về `127.0.0.1`, không cần sửa tệp `hosts`. Với `*.test` (nếu cần thử tên miền riêng giả như `alpha.truong.test`), dùng tham số khởi chạy `--host-resolver-rules=MAP *.test 127.0.0.1`. Ở kiểm thử cấp API không dựa vào phân giải tên: trợ giúp `tenantRequest(mã)` kết nối thẳng `127.0.0.1` và đặt tiêu đề `Host`, nên chạy giống nhau trên Windows, Linux và CI.
- **Máy chủ:** vẫn một `api` (cổng 3200), một `identity` (3201), ba giao diện (5373, 5375, 5376) như hiện nay; các máy chủ phát triển của giao diện cho phép `.localhost` (`server.allowedHosts`) và chuyển `/api/v1` giữ nguyên `Host`. Cơ sở dữ liệu `school_platform_e2e`, tiền tố cơ sở dữ liệu trường `e2e_<mã>_`, tiền tố Redis và S3 theo trường.
- **Dựng trường:** bước dựng chung (`tests/e2e-setup.mjs`) tạo ba trường bằng lệnh `platform provision` (trước khi S2 xong dùng lệnh dựng thử của S1a), dùng cơ sở dữ liệu mẫu để nhanh (migrate một lần, `CREATE DATABASE ... TEMPLATE` cho trường kế); nạp bộ canary.
- **Hai bố cục trên CI:** việc `kiem-thu-nhieu-truong` chạy ma trận hai bố cục (`TENANT_DB_LAYOUT=database` và `schema`); trên máy một phiên chỉ chạy một bố cục tại một thời điểm, mặc định `database`, chạy `schema` khi phần của mình chạm bố cục. Cơ sở dữ liệu `platform` và các lược đồ của phiên có hậu tố phần.
- **Ba dự án Playwright:** `single` (e2e hiện có, không đổi), `multi` (spec `130-` đến `139-` và ma trận), `multi-regression` (e2e hiện có chạy ở chế độ nhiều trường). Chọn bằng `E2E_TENANCY=single|multi` và `--project`.
- **Trên máy:** theo quy tắc chung, chỉ chạy spec của phần mình và spec bị ảnh hưởng, giữ khóa `/d/School_Management/.claude/e2e.lock`, đặt thời hạn, chạy nền; **không chạy toàn bộ e2e hay `multi-regression` trên máy**; dùng cơ sở dữ liệu định danh và nền tảng riêng của phiên (tên có hậu tố phần). Ghi trong tài liệu: "e2e toàn bộ do CI chạy".
- **Trên CI:** thêm việc `kiem-thu-nhieu-truong` chạy song song với `kiem-thu` (cùng dịch vụ PostgreSQL, Redis, SeaweedFS): kiểm tĩnh, kiểm thử đơn vị cách ly, ma trận API, dự án `multi`; `multi-regression` chạy ở các PR đã nêu và hằng đêm. Việc `kiem-thu` giữ nguyên và vẫn chạy `single`. Từ khi S1a gộp, việc mới này là việc CI bắt buộc, ghi vào quy ước gộp.

### 14.8 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Lộ dữ liệu giữa các trường (mã quên đi qua `Databases`, khóa ghép tay, việc nền không có ngữ cảnh, tuyến công khai) | Đóng chặt khi thiếu ngữ cảnh, vai trò PostgreSQL riêng, kiểm tĩnh, ma trận cách ly tự liệt kê tuyến, tìm chuỗi canary trong bản chụp cơ sở dữ liệu (14.7); **không bật nhiều trường ở môi trường chạy thật trước khi S1a, S1b đã gộp và ma trận đạt** |
| Hai trường dùng chung khóa tích hợp trong `.env` của trường số 1 (gửi nhầm tin nhắn, nhận nhầm tiền) trong thời gian S3 chưa gộp | Nguyên tắc 14.2: trường thứ hai trở đi chạy bộ giả lập hoặc tắt tích hợp cho đến khi S3 gộp; kiểm thử bộ nối tắt khi thiếu cấu hình |
| Lộ khóa ký mã phiên dùng chung làm giả được phiên của mọi trường | Khóa ký chỉ ở dịch vụ định danh, API chỉ giữ khóa công khai; `tid` bắt buộc; xoay khóa có quy trình (S8b); có thể chuyển sang khóa riêng từng trường vì mã phiên đã có `tid` |
| Cookie bị đặt từ tên miền anh em (một tên miền hệ thống chung cho mọi trường) | Cookie mã làm mới không đặt `Domain`, tên có `__Secure-`, gắn mã trường và bị từ chối nếu khác trường; website của trường không chạy mã tùy ý của trường |
| Mở nhiều trường cùng lúc vượt hạn mức cấp chứng chỉ | Chứng chỉ ký tự đại diện cho tên miền hệ thống (14.6); cấp theo yêu cầu chỉ cho tên miền có trong danh sách, đã xác nhận DNS, có giới hạn tần suất; theo dõi hạn mức ở S4 |
| Cấp chứng chỉ cho tên miền không trỏ về nền tảng, bị lạm dụng làm bàn đạp | Điểm cuối kiểm tra chỉ chấp nhận tên miền đã xác nhận bản ghi TXT và CNAME; từ chối khi DNS đổi |
| Quá nhiều kết nối PostgreSQL (nhiều trường × nhiều năm học × nhiều bản `api`) | Nhóm kết nối có giới hạn mỗi trường và toàn cục, tự đóng khi rảnh, PgBouncer; thử tải nhiều trường ở S7b; mở cụm cơ sở dữ liệu thứ hai và chuyển trường (S7b) |
| PgBouncer chế độ gom theo giao dịch làm hỏng chỗ dùng `SET` theo phiên, khóa tư vấn | Rà trước ở S7a (`timezone.ts`, `Migrator`, mọi `SET`), ghi kết quả vào YCTD; migrate đi thẳng PostgreSQL không qua PgBouncer |
| Migrate cuốn chiếu lỗi giữa chừng làm các trường lệch cấu trúc | Bản mã tương thích lùi (expand/contract), trường canary đầu tiên, dừng khi lỗi, bảng `school_migrations`, báo S4; không đổi cấu trúc phá vỡ trong một bản |
| Một trường chiếm hết máy (xếp thời khoá biểu, xuất nền, nhập Excel) | Hạn mức việc đồng thời mỗi trường, giới hạn tần suất theo trường, độ lệch ngẫu nhiên của bộ lập lịch (S1b) |
| Khởi tạo trường để lại cơ sở dữ liệu dở dang | Tiến trình có bước, chạy lại được, có hoàn tác; kiểm thử ngắt giữa chừng ở từng bước (S2) |
| Xóa trường nhầm hoặc bị lạm dụng | Thời gian chờ có thể hủy, xác nhận bằng mã trường, chỉ vai trò vận hành cấp cao, nhật ký nền tảng; xuất dữ liệu trước khi xóa |
| Hết hạn gói làm trường mất quyền vào dữ liệu | Chỉ đọc chứ không xóa, vẫn xuất được dữ liệu, thanh toán được; hạn chuyển trạng thái cấu hình được và nhắc nhiều lần (S5) |
| Sai số tiền hóa đơn, thu trùng, thiếu | Hàm tính thuần có kiểm thử đơn vị nhiều ca, số nguyên đồng, đối soát theo mã hóa đơn, thu trùng không gia hạn hai lần, điều chỉnh tay có nhật ký |
| Hóa đơn điện tử thật phát hành khi chưa sẵn sàng | Chỉ có bộ nối giả lập đến khi chọn nhà cung cấp; cờ bật bộ nối thật cần xác nhận của Eric |
| Một VPS trong nước là điểm lỗi duy nhất ở cách đặt T1 | Ghi rõ mức sẵn sàng của T1; sao lưu ngoài máy, diễn tập khôi phục hằng tháng; chuyển T2, T3 khi vượt ngưỡng (S7) |
| Chưa chọn nhà cung cấp VPS, chưa có số đo năng lực | Bộ Compose không phụ thuộc nhà cung cấp; số quy mô ghi là giả định, S7b đo rồi mới cam kết |
| Tài liệu pháp lý do Claude soạn sai hoặc lỗi thời | Đọc văn bản gốc lúc làm, ghi số hiệu; luật sư của Eric rà; không dùng khi chưa rà (S8a); không nhận dữ liệu thật khi chưa rà bộ hồ sơ của trường đó |
| Quyết định không dùng xác thực hai lớp (YCTD-31, RR-15) mâu thuẫn với nhu cầu của SaaS | Xác thực hai lớp bắt buộc chỉ cho tài khoản vận hành nền tảng (mới), tuỳ chọn cho quản trị trường; đổi quyết định YCTD-31 chờ Eric (14.11) |
| Gói miễn phí đổi giới hạn, đổi điều khoản hoặc ngừng (Koyeb đổi chủ, Fly.io bỏ gói miễn phí) | Số giới hạn ghi là giả định tra ngày 2026-10-25, S9 kiểm lại trang chính thức trước khi dựng; hồ sơ (a) dựng được trên hơn một nền tảng (Render, Koyeb) nhờ ảnh gộp; không phụ thuộc nhà cung cấp riêng nào; hồ sơ (b) luôn là đích |
| Dữ liệu thật của trường nằm ở máy chủ ngoài Việt Nam (Nghị định 53/2022/NĐ-CP về lưu trữ trong nước; Nghị định 13/2023/NĐ-CP về chuyển dữ liệu ra nước ngoài) | **Rủi ro pháp lý tồn đọng, Eric chấp nhận ngày 2026-10-25.** Chỉ nhận khi đủ hồ sơ: hợp đồng hoặc thỏa thuận xử lý dữ liệu, văn bản đồng ý của trường, hồ sơ đánh giá tác động và chuyển ra nước ngoài, phiếu chấp nhận rủi ro, vùng máy chủ ghi vào hồ sơ (cổng ở S2); mã hóa trường dữ liệu trẻ em bằng khóa riêng của trường (dữ liệu còn lại dạng rõ ở nhà cung cấp cơ sở dữ liệu: ghi rõ giới hạn); biểu ngữ ở mọi giao diện; lộ trình và công cụ chuyển về VPS trong nước bằng cấu hình, nhắc ở bảng điều khiển khi đến điều kiện chuyển; luật sư của Eric rà |
| Nhà cung cấp nước ngoài đọc được dữ liệu dạng rõ hoặc bị lộ | Chọn nhà cung cấp có chứng nhận bảo mật, vùng gần nhất, vai trò ứng dụng quyền tối thiểu, khóa gốc chỉ ở môi trường máy chủ ứng dụng, ghi bên xử lý phụ vào `school_hosting`; không đưa vào hồ sơ (a) trường có dữ liệu lớn hoặc nhạy cảm vượt phạm vi đồng ý |
| S6 làm lộ chi tiết từng trường, từng học sinh cho cấp trên | Chỉ bản chụp tổng hợp có đồng ý của trường theo cấp và nhóm số liệu, ẩn nhóm nhỏ, không truy vấn chéo, quyền xem chi tiết có hạn và nhật ký, kiểm thử phạm vi cây con (14.7) |
| Bố cục `schema` lộ dữ liệu giữa trường vì quên tên lược đồ hoặc `search_path` sai | Vai trò riêng mỗi lược đồ chỉ có quyền trên lược đồ của nó, `search_path` ở mức vai trò, không `public`; kiểm thử quyền chéo và ma trận cách ly chạy ở cả hai bố cục (14.7) |
| Vai trò do nhà cung cấp tạo sẵn có quyền rộng (ví dụ vai trò quản trị của gói miễn phí) làm hỏng cách ly | Tạo vai trò của trường bằng SQL, kiểm tra thành viên vai trò và quyền sau khi tạo, vai trò chạy ứng dụng không giữ quyền tạo vai trò, tạo cơ sở dữ liệu hay đọc lược đồ khác; kiểm tra với từng nhà cung cấp trước khi dùng |
| Một cơ sở dữ liệu miễn phí đầy dung lượng hoặc hết giờ máy | Giới hạn số trường thử, một năm học mỗi trường, dữ liệu giả nhỏ, đo dung lượng một trường ở S9, cảnh báo ở bảng điều khiển (S4), tự xóa trường thử dữ liệu giả (tuỳ chọn); trường thật quá dung lượng chuyển sang gói trả phí hoặc hồ sơ (b) |
| Máy chủ ngủ làm mất việc định kỳ, người dùng gặp lỗi khi thức dậy | Việc bù theo dấu thời gian trong cơ sở dữ liệu, trang "đang khởi động" tự thử lại, Cron Triggers gọi `tick` và đánh thức, không mặc định giữ thức |
| `tick` bị gọi từ ngoài | Mã thông báo nội bộ so sánh thời gian hằng, chỉ HTTPS, giới hạn tần suất, từ chối khi thiếu bí mật cổng biên |
| Hai phần cùng đợt sửa chung tệp lõi (`application.module.ts`, `platform-menu.ts`, cây menu, danh sách migration, quyền) | Đợt 1 chỉ S1a sửa mã lõi; sửa tệp chung theo kiểu thêm cuối; thứ tự gộp S1b trước S2; gộp `origin/main` trước khi mở PR |
| Va số với DT-21, DT-22 chạy song song | Dải DT-SaaS bắt đầu sau dải DT-22 (14.3); không dùng số dự phòng của DT-22 |
| Đổi đường dẫn gốc (`base`) của ba ứng dụng làm hỏng liên kết, e2e, bản đã triển khai | Chế độ một trường giữ đường dẫn hiện nay; đường dẫn tiền tố chỉ áp ở chế độ nhiều trường; e2e `single` và `multi-regression` kiểm cả hai |

**Cổng kiểm của mỗi phần DT-SaaS:** kiểm thử đơn vị toàn bộ kho mã đạt không sửa kỳ vọng; e2e `single` hiện có đạt cộng e2e mới của phần (chạy riêng, giữ khóa `e2e.lock`, không chạy cùng kiểm thử đơn vị toàn kho); kiểm thử cách ly theo 14.7; typecheck, lint, build đạt; CI xanh toàn bộ (gồm việc nhiều trường từ khi S1a gộp); phiên bản phần mềm tăng theo từng phần, riêng bản kế hoạch này (YCTD-190) chỉ đổi tài liệu và S7a, S8a (chỉ cấu hình triển khai, tài liệu) ghi rõ có tăng phiên bản hay không trong YCTD của phần.

### 14.9 Quy ước chung của DT-SaaS

- Mỗi phần ghi YCTD giữ sẵn ở mục 14.3, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 12 kiến trúc, 14, 16, 17, 21, 22 bảo mật, 23, 24, 32, `index.md` khi có thay đổi tương ứng), ghi văn bản căn cứ đã đọc, mở PR, gộp khi mọi kiểm tra CI đạt.
- Mã mới theo mục 14.2 (tách dữ liệu từng trường, đóng chặt khi thiếu ngữ cảnh, chế độ một trường không đổi, không bí mật dùng chung, không ghi cứng tên miền).
- Cơ sở dữ liệu `platform` có thư mục migration riêng, kiểm thử dùng cơ sở dữ liệu `platform` riêng của phiên (hậu tố phần), **tuyệt đối không chạy `migrate` lên cơ sở dữ liệu dùng chung**.
- Kiểm thử, dữ liệu mẫu, tài liệu chỉ dùng tên trường, tên miền, tài khoản, hóa đơn giả (`*.localhost`, `*.test`); không dữ liệu thật, không in nội dung `.env`, không dán khóa vào tài liệu.
- Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần; nếu một phần cần số ngoài khoảng đã giữ, ghi vào YCTD và lấy ở dải dự phòng của DT-SaaS (14.3).
- Phần chưa chốt (14.11) làm cấu hình được; khi Eric chốt thì đổi giá trị mặc định bằng YCTD, không sửa mã.

### 14.10 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| S1a | 1 | Đã làm, YCTD-191, phiên bản 0.129.0, PR 164: cơ sở dữ liệu nền tảng (tệp 0001 đến 0004, loại `platform`), nhận diện trường theo tên miền (nguồn `host`, `x-forwarded-host`, `header:<tên>` kèm bí mật cổng biên), `Databases` và `Infrastructure` theo ngữ cảnh trường, bố cục `database` và `schema` (vai trò riêng, `search_path` mức vai trò), nhóm kết nối có giới hạn, mã phiên mang `tid` (không dùng `sid` vì đã là mã phiên), cookie, khóa Redis, khóa tệp có tiền tố, khóa dữ liệu trẻ riêng, `platform adopt-existing`, đăng nhập vận hành nền tảng dưới `/auth/platform`, khung `apps/platform`, kiểm tĩnh, ma trận cách ly mọi tuyến, quét chuỗi mồi, e2e nhiều trường (spec 130); việc nền theo trường để S1b |
| S7a | 1 | Đã làm phần dựng sẵn (PR #163, YCTD-198, phiên bản 0.128.0); kiểm tay trên staging chờ VPS thử |
| S8a | 1 | Đã làm, YCTD-200, PR 162: bộ mẫu `33_HO_SO_PHAP_LY/` (PL-00 đến PL-15, S8a-1.0, bản nháp chờ luật sư rà); không tăng phiên bản phần mềm |
| S1b | 2 | Đã làm, YCTD-192, phiên bản 0.130.0, PR 166: bộ lập lịch việc nền theo trường (`scheduler_state`, nền tảng 0010) và điểm tick ngoài, hàng đợi máy xếp theo trường kèm hạn mức, domain-check theo danh mục tên miền nền tảng, trang chọn trường, giới hạn tần suất công khai theo trường, bộ đệm ngữ cảnh trường; chưa làm: số đo theo trường, bản trình diễn theo trường |
| S2 | 2 | Đã làm, YCTD-193, phiên bản 0.131.0, PR 165: tệp nền tảng 0020 đến 0022 (cột vòng đời của `schools`, `provisioning_jobs`, `school_lifecycle_events`, `school_admin_invitations`, `school_migrations`, cột kiểm tra tên miền, `school_consents`, `school_hosting`), tệp hệ thống 0050 (`terms_acceptances`); thư viện `school-lifecycle.ts` (bước setup, khởi tạo mười một bước chạy tiếp được hoặc hoàn tác, tạm dừng, mở lại, xóa có thời gian chờ, cổng hồ sơ đồng ý, lời mời kích hoạt một lần, migrate cuốn chiếu); bộ nối `DomainProvider` (`dns-check`; `cloudflare-saas`, `vercel-domains` để S9); điểm cuối `/auth/platform/schools` và `/auth/activate` ở dịch vụ định danh; trang Trường ở `apps/platform`, trang `/activate` ở cổng quản trị; lệnh `platform` và lệnh xuất, xóa vĩnh viễn của máy chủ API; biến `PLATFORM_ROOT_DOMAIN`, `PLATFORM_INGRESS_HOST`, `DOMAIN_PROVIDER`, `SCHOOL_DELETION_GRACE_DAYS`; e2e spec 132; lịch chạy `purge-due`, `migrate-schools` chờ bộ lập lịch của S1b |
| S9 | 3 | Đã làm, YCTD-203, phiên bản 0.132.0, PR 167: hồ sơ `deploy/profiles/trial/` (cổng biên Cloudflare Worker có trang đang khởi động, biểu ngữ thử nghiệm, Cron gọi `tick`; container gộp `identity` + `api` với bộ định tuyến cùng bảng tuyến Caddy; ba tổ hợp Render/Koyeb, Neon/Supabase, R2/Supabase Storage, Vercel 3a, 3b; mẫu dòng vùng máy chủ, mẫu bước setup dữ liệu thật); tệp nền tảng 0100 (`school_databases.login_name`); bộ nối `DB_HOST_ADAPTER`, `cloudflare-saas`, `vercel-domains`; `PLATFORM_DATA_POLICY`; `platform relayout`; kho khóa trong bộ nhớ của dịch vụ định danh; `APP_BASE_PATH`; biến `DB_HOST_ADAPTER`, `DB_POOLER_HOST`, `DB_POOLER_PORT`, `SUPABASE_PROJECT_REF`, `PLATFORM_DATA_POLICY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `MIGRATE_ON_START`, `MIGRATE_SCHOOLS_ON_START`, `SMS_ALLOW_LOG`, `TARGET_PLATFORM_*`; e2e spec 140; giới hạn gói miễn phí tra ngày 2026-10-25 ghi ở YCTD-203; chưa dựng thật trên nhà cung cấp, chưa làm `INTEGRATIONS_MODE` (S3), tự xóa trường dữ liệu giả |
| S5a | 2 | Đã làm, YCTD-194, phiên bản 0.134.0, PR 170: gói dịch vụ (tệp nền tảng 0040, `plans`, `school_plans`, hạn của trường), phân hệ theo menu cổng, giới hạn học sinh, dung lượng, cấp học, kiểm tra ở máy chủ và menu, trạng thái trường, chế độ chỉ đọc, hàm `applyPlanLifecycle` và lệnh `platform plan-lifecycle` cho bộ lập lịch của S1b, chỗ tính phí cho S5b (mặc định theo học sinh), trang Gói dịch vụ ở cổng nền tảng, e2e spec 134 |
| S3 | 3 | Đã làm, YCTD-195, phiên bản 0.133.0, PR 169: khóa kết nối ngoài riêng từng trường lưu mã hóa (`integration_secrets`, hệ thống 0051) và bộ nối ngoài đọc theo trường, màn hình quản trị, thương hiệu (`school_branding`, hệ thống 0052), đổi khóa dữ liệu trẻ làm tiếp được và bọc lại khóa gốc (`school_key_rotations`, nền tảng 0030); chưa làm: kiểm tra kết nối thật cho cổng thanh toán, tên sản phẩm theo cấu hình nền tảng |
| S5b | 4 | Đã làm, YCTD-196, phiên bản 0.137.0, PR 174: quy tắc tính phí cấu hình được (`price_rules`, mặc định theo học sinh, kết hợp theo trường, theo phân hệ), chốt số liệu kỳ và hóa đơn bằng việc nền theo trường, thu qua mã QR và cổng của nền tảng (khóa mã hóa bằng khóa gốc, bộ giả lập khi chưa có khóa), điểm nhận tiền vào không cần trường, đối soát, gia hạn và mở lại trường, nhắc gia hạn, điều chỉnh tay có lý do, hóa đơn điện tử qua `EInvoiceProvider` giả lập, trang Thu phí ở cổng nền tảng, trang Hóa đơn dịch vụ ở cổng, e2e spec 135 |
| S4 | 3 | Đã làm, YCTD-197, phiên bản 0.138.0, PR 172: tệp nền tảng 0060 (`school_metrics`, `school_error_counts`, `maintenance_notices`, `support_sessions`, `support_session_actions`), tệp hệ thống 0053 (`support_access_grants`); việc định kỳ `school-metrics`; bộ gom lỗi 5xx theo trường; trang Bảng điều khiển, Bảo trì, khối Phiên hỗ trợ ở cổng nền tảng; trang Cho phép hỗ trợ, `/support-login`, biểu ngữ ở cổng và ứng dụng; biến `PLATFORM_ERROR_ALERT_PER_HOUR`, `SCHOOL_METRICS_INTERVAL_SECONDS`; e2e spec 136; chưa làm: biểu đồ theo thời gian, gửi cảnh báo ra ngoài, kết quả diễn tập khôi phục của S7b |
| S7b | 4 | Đã làm, YCTD-199, phiên bản 0.135.0, PR 171: bảng nền tảng `backup_runs` (0070); sao lưu logic theo từng trường ở cả hai bố cục (`.sbak` mã hóa AES-256-GCM, phạm vi `all` hằng ngày, `active` hằng giờ), khôi phục vào chính trường hoặc thành trường mới, diễn tập khôi phục tự động hằng tháng, chuyển trường sang cụm khác (`platform backup-school`, `verify-backup`, `restore-school`, `restore-drill`, `move-school`); bộ nạp bằng vai trò của trường, mỗi bảng một giao dịch (relayout của S9 dùng chung); khôi phục về một thời điểm bằng WAL-G (`compose.pitr.yml`, `docker/postgres-walg`, `pitr-extract-school.sh`, `PITR.md` kèm RPO, RTO); hồ sơ thử nghiệm ghi giới hạn Neon, Supabase và mẫu GitHub Actions; e2e spec 137; chưa làm: thử tải 50 trường, cảnh báo ở S4, kiểm tay WAL-G trên staging |
| S8b | 4 | Đã làm, YCTD-201, phiên bản 0.136.0, PR 173: xác thực hai lớp TOTP (bắt buộc cho tài khoản vận hành nền tảng, tuỳ chọn theo trường cho người dùng trường; nền tảng 0080, 0081, định danh 0101, 0102), chính sách mật khẩu và khóa tạm theo trường, tiêu đề bảo mật, cookie `__Secure-`, xoay khóa ký hai pha, quét bí mật và thành phần phụ thuộc ở CI, danh sách kiểm ASVS; chưa làm: kiểm thử xâm nhập bên ngoài (Eric thuê), xác thực hai lớp cho ứng dụng phụ huynh |
| S6 | 5 | Đã làm, YCTD-202, phiên bản 0.139.0, PR 175: tệp nền tảng 0090 (`admin_units`, `parent_org_users`, `school_aggregate_consents`, `aggregate_snapshots`, `parent_org_access_requests`); menu Đơn vị cấp trên và trang `/cap-tren` ở cổng nền tảng; Chia sẻ số liệu cấp trên (4.6) ở cổng quản trị; việc định kỳ `aggregate-snapshots`; biến `AGGREGATE_SNAPSHOT_INTERVAL_SECONDS`, `PARENT_ORG_MIN_GROUP`; e2e spec 139; chưa làm: danh mục hành chính toàn quốc ngoài TP.HCM, biểu đồ theo thời gian, thi đua khối cụm (22d), đánh giá ngoài (22f), nối hệ thống Bộ, Sở |

### 14.11 Giả định chưa chốt, làm cấu hình được

| Mã | Mục chưa chốt | Giả định để làm | Cấu hình ở | Cần ai trả lời |
|---|---|---|---|---|
| GD-93 | Tên sản phẩm, tên miền hệ thống | Tên sản phẩm lấy từ cấu hình (mặc định "School Management"); tên miền hệ thống là cấu hình, kiểm thử dùng `e2e.localhost` | `platform_settings` | Eric |
| GD-94 | Cách tính phí | **Eric đã chốt 2026-10-25:** cấu hình được cả ba cách (theo học sinh, theo trường, theo phân hệ), **mặc định theo số học sinh đang học** chốt cuối kỳ cộng phí tối thiểu theo trường; quản trị nền tảng chọn cách tính cho từng gói; số tiền, bậc thang, kỳ là dữ liệu | `price_rules`, `plans` | Eric (đã chốt) |
| GD-95 | Cổng thanh toán của nền tảng, nhà cung cấp hóa đơn điện tử | Dùng lại bộ nối PayOS, SePay, Casso, VNPay (tài khoản nhận tiền của nền tảng chưa có); hóa đơn điện tử qua `EInvoiceProvider` với bộ giả lập | `platform_settings`, bộ nối | Eric |
| GD-96 | Nhà cung cấp VPS trong nước, số máy | Bộ Compose không phụ thuộc nhà cung cấp; ba cách đặt máy T1 đến T3; quy mô gợi ý là giả định đến khi S7b đo | `deploy/` | Eric |
| GD-97 | Xác thực hai lớp so với quyết định YCTD-31 (RR-15) | Bắt buộc cho tài khoản vận hành nền tảng; tuỳ chọn bật theo trường cho quản trị trường; không đổi quyết định hiện có | chính sách theo trường | Eric |
| GD-98 | Khách hàng cấp trên (S6) | **Eric đã chốt 2026-10-25:** làm S6 ở đợt 5 với ba cấp Bộ, Sở, Phòng Văn hóa – Xã hội (cấp xã), cây đơn vị hành chính cấu hình được; mỗi cấp xem số liệu tổng hợp của trường thuộc phạm vi và đã đồng ý, không xem chi tiết từng học sinh nếu không được cấp quyền | `admin_units` | Eric (đã chốt) |
| GD-99 | Thời hạn giữ dữ liệu sau khi hết hạn, thời gian chờ xóa, hạn nhắc, hạn chuyển chỉ đọc, thời gian dùng thử | Dùng thử 30 ngày; nhắc trước hạn 15, 7, 1 ngày; chỉ đọc sau hạn 7 ngày; tạm ngưng sau 30 ngày; chờ xóa 30 ngày; sao lưu giữ tối thiểu 30 ngày (SL-01) | `plans`, `platform_settings` | Eric |
| GD-100 | Hồ sơ thử nghiệm: nền tảng cụ thể | **Eric đã chốt 2026-10-25: dùng cả ba phương án, viết theo kiểu bộ nối chọn bằng cấu hình:** web tĩnh Cloudflare Worker hoặc Vercel (ràng buộc Vercel Hobby phi thương mại, tên miền con ký tự đại diện cần máy chủ tên Vercel: cách 3a sau Worker hoặc 3b qua Vercel); cơ sở dữ liệu Neon hoặc Supabase, kho tệp R2 hoặc Supabase Storage; máy chủ Render, dự phòng Koyeb; không Redis; số giới hạn tra ngày 2026-10-25, kiểm lại khi làm | `deploy/profiles/trial/` | Eric (đã chốt) |
| GD-101 | Hồ sơ thử nghiệm: dữ liệu thật và thời hạn | **Eric đã chốt 2026-10-25:** trường thật được dùng thử với dữ liệu thật khi đã có văn bản đồng ý của trường; bỏ ràng buộc "chỉ dữ liệu giả" và bỏ tự xóa sau 30 ngày cho trường thật (trường dữ liệu giả vẫn có thể bật tự xóa, mặc định 30 ngày); biện pháp tuân thủ: hợp đồng hoặc thỏa thuận xử lý dữ liệu và văn bản đồng ý lưu ở `platform`, vùng Singapore ghi vào hồ sơ, mã hóa trường dữ liệu trẻ em bằng khóa riêng của trường, hồ sơ đánh giá tác động và chuyển dữ liệu ra nước ngoài theo Nghị định 13/2023/NĐ-CP, rủi ro Nghị định 53/2022/NĐ-CP do Eric chấp nhận, lộ trình và công cụ chuyển sang VPS trong nước bằng cấu hình | `school_consents`, `school_hosting`, `platform_settings` | Eric (đã chốt) |

## 15. DT-23: thi trực tuyến, công cụ lớp học, trò chơi kiến thức và trợ lý AI (23a đến 23e)

### 15.1 Căn cứ và mục tiêu

1. Nguồn: báo cáo khảo sát một hệ thống dạy học trực tuyến của bên khác (`.claude/logs-khaosat-vniteach/BAO_CAO_KHAO_SAT_VNITEACH.md`, ghi ở ngoài `tai_lieu/`). Eric xem báo cáo và **chọn đề xuất 1, 2, 3 và 5 ngày 2026-10-26**. Chỉ **học ý tưởng tính năng**; không sao chép nội dung, tên gọi, hình thức hay giao diện của hệ thống đó; mọi tên chức năng, màn hình, mẫu thẻ, trò chơi do dự án tự đặt theo bộ chữ và khuôn giao diện của School Management.
2. Bốn đề xuất được chọn thành bốn phần:
   - **23a Thi trực tuyến cho học sinh** (đề xuất 1): giáo viên giao đề, học sinh vào làm theo giờ mở, giờ đóng, có đếm ngược, đảo câu hỏi và đáp án, chấm tự động phần trắc nghiệm, chuyển điểm vào sổ điểm.
   - **23b Công cụ lớp học trên ứng dụng giáo viên** (đề xuất 2): gọi tên ngẫu nhiên, chia nhóm ngẫu nhiên, đếm ngược, bấm giờ, bảng điểm nhanh, dùng được khi mạng chập chờn.
   - **23c Trò chơi kiến thức và thẻ đáp án giấy** (đề xuất 3): ô chữ, vòng quay, hỏi đáp theo vòng sinh từ ngân hàng câu hỏi; thẻ đáp án giấy đọc bằng camera điện thoại.
   - **23d Trợ lý AI soạn câu hỏi và kế hoạch bài dạy** (đề xuất 5): **Eric đồng ý đưa AI vào ngày 2026-10-26**, thay cho câu "không dùng AI" của DT-22 (13.1, 13.5; sửa ở các mục đó trong cùng bản này). Bản nháp AI luôn đi qua luồng duyệt của 22g1.
3. Mục tiêu: học sinh dùng được hệ thống để làm bài, giáo viên có thêm công cụ dùng ngay trên lớp, chung một ngân hàng câu hỏi, một sổ điểm, một bộ tài khoản học và thi (22g2) với phần đã có, **không dựng kho dữ liệu thứ hai**.
4. Không chọn (Eric không chọn ở đề xuất còn lại, ghi để không bị hỏi lại): đăng nhập bằng tài khoản Google (nhà trường quản tài khoản, không để định danh nằm ở bên ngoài); sinh hoạt Đoàn, Đội (đã có các phần của DT-18, DT-21 đủ dùng); phần quảng bá, thương mại cho giáo viên cá nhân; gói tài khoản cá nhân (khách hàng chính là trường đơn lẻ, 14.1).
5. Hiện trạng mã (đọc trên nhánh chính ngày 2026-10-26, sau PR 175):
   - **Ngân hàng câu hỏi và đề thi (22g1, 22g2):** `questions`, `question_topics`, `question_usages`, `exam_matrices`, `exams`, `exam_questions`, `exam_variants`; câu trong đề lưu bản chụp; có luồng duyệt câu hỏi. `exam_sessions`, `exam_sheets` và luồng chuyển điểm sang `score_entries` của 22g2 (sổ điểm Thông tư 22 và 27). **Chưa có chỗ học sinh làm bài trực tiếp**: bài làm hiện do giáo viên nhập.
   - **Tài khoản học và thi:** `student_learning_accounts` (22g2) đã có nhưng **chưa có kênh đăng nhập cho học sinh**: `SessionChannel` chỉ có `portal`, `teacher`, `parent` (`packages/server/src/access-token.ts`, `database/identity/schema.ts`).
   - **Ứng dụng giáo viên và phụ huynh là ứng dụng web** (`apps/teacher`, `apps/parent`), **chưa có service worker hay manifest** (không dùng ngoại tuyến được).
   - **Nề nếp, thi đua:** `conduct_settings`, `conduct_criteria`, `conduct_entries` (DT-21): chỗ gắn bảng điểm nhanh của 23b.
   - **Nền tảng nhiều trường (DT-SaaS):** gói và giới hạn `plans` (S5a: phân hệ, số học sinh, dung lượng, cấp học), khóa kết nối ngoài từng trường lưu mã hóa (S3, `IntegrationSecretConnector`), bộ lập lịch (S1b), xác thực hai lớp (S8b), kiểm tĩnh và ma trận cách ly (14.7).
   - **Chưa có** chỗ nào trong mã gọi dịch vụ AI; `IntegrationSecretConnector` chưa có `ai`.

### 15.2 Nguyên tắc

- **Dùng lại, không dựng song song:** ngân hàng câu hỏi, đề, bản chụp câu trong đề, tài khoản học và thi, luồng chuyển điểm của 22g2, sổ điểm, kho học liệu số 22h1, nề nếp của DT-21 là nguồn duy nhất. Phần mới chỉ thêm bảng cho thứ chưa có (giao đề, lượt làm bài, phiên công cụ, phiên trò chơi, nhật ký yêu cầu AI).
- **Không đổi hành vi các phần đã có:** toàn bộ e2e và kiểm thử đơn vị hiện có vẫn đạt không sửa kỳ vọng; học sinh chưa có tài khoản đăng nhập thì mọi thứ chạy như hôm nay.
- **Chạy được ở cả hai bố cục cơ sở dữ liệu `database` và `schema` và ở chế độ một trường lẫn nhiều trường:** mọi bảng mới nằm trong cơ sở dữ liệu năm học hoặc hệ thống của trường; khóa Redis và tệp đi qua `cacheKey`, `storageKey`; **đạt kiểm tĩnh đa thuê bao** (14.2, 14.7); ma trận cách ly tự liệt kê tuyến mới.
- **Máy chủ giữ thời gian và đáp án:** đồng hồ làm bài tính ở máy chủ, đáp án đúng không gửi xuống máy học sinh trước khi nộp; giao diện chỉ hiển thị.
- **Dữ liệu trẻ em:** tài khoản học sinh do trường cấp, không tự đăng ký; chỉ hiện thông tin của chính học sinh đó; camera chỉ dùng xử lý tại máy, **không tải hình hay video lên máy chủ** (23a, 23c); danh sách lớp lưu trên máy giáo viên cho dùng ngoại tuyến phải gọn, xóa khi đăng xuất (23b).
- **AI chỉ soạn nháp, người duyệt:** nội dung AI luôn vào trạng thái nháp, mang dấu "do AI soạn", đi qua luồng duyệt 22g1 hoặc kiểm duyệt 22h1 trước khi dùng; **không bao giờ gửi dữ liệu cá nhân của học sinh, phụ huynh, cán bộ** cho nhà cung cấp AI, chỉ gửi nội dung chương trình (môn, lớp, chủ đề, yêu cầu cần đạt, mức nhận thức); **tắt mặc định theo trường**; khóa nhà cung cấp lưu mã hóa theo trường (S3); có nhật ký và hạn mức theo gói (23d).
- **Kiểm thử không gọi dịch vụ ngoài thật:** nhà cung cấp AI trong kiểm thử là bộ giả lập (`mock`) cho kết quả cố định; dữ liệu mẫu là dữ liệu bịa.
- **Văn bản gốc trước khi viết điều khoản:** phần 23d đọc toàn văn văn bản còn hiệu lực lúc làm (dự kiến Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, Nghị định 356/2025/NĐ-CP hướng dẫn; Nghị định 13/2023/NĐ-CP nếu còn hiệu lực ở phần chưa bị thay; văn bản về trí tuệ nhân tạo hiện hành nếu có; Luật Bảo vệ trẻ em về dữ liệu của trẻ) và ghi số hiệu vào YCTD; tài liệu do Claude soạn là bản nháp để luật sư của Eric rà, không thay tư vấn pháp lý.

### 15.3 Các phần

Số giữ sẵn bắt đầu **sau dải của DT-SaaS và chừa dự phòng**: YCTD-210 dành cho chính bản kế hoạch này, các phần YCTD-211 đến YCTD-214, YCTD-215 đến YCTD-219 dự phòng; migration năm học từ 0120, hệ thống từ 0070, định danh từ 0120, nền tảng từ 0200 (23d dùng 0200 đến 0202: giới hạn AI của gói, đo token, dòng phí); spec e2e từ `150-`. DT-SaaS giữ đến YCTD-209, năm học 0119, hệ thống 0069, định danh 0119, nền tảng 0199, e2e `149-`; **không dùng số trong dải đó** (kể cả chỗ dự phòng chưa dùng). Dải DT-22 giữ chỗ cho thành phần AI (YCTD-185, năm học 0104, hệ thống 0043, định danh 0094, e2e `124-`) **không còn hiệu lực**: thành phần AI nay là phần 23d dùng số của DT-23; các số cũ đó để trống, không phần nào dùng.

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD giữ sẵn | Migration giữ sẵn | e2e giữ sẵn |
|---|---|---|---|---|---|---|
| 23a | Thi trực tuyến cho học sinh: kênh đăng nhập `student` và vai trò học sinh gắn tài khoản học và thi, giao đề theo lớp hoặc nhóm học sinh, giờ mở, giờ đóng, thời lượng, số lần làm, đảo câu và đáp án, đếm ngược theo đồng hồ máy chủ, lưu nháp từng câu, nộp bài, chấm tự động câu trắc nghiệm, câu tự luận để giáo viên chấm, chuyển điểm vào sổ điểm Thông tư 22, 27 theo luồng 22g2, khóa toàn màn hình, kiểm tra camera ngay trên máy học sinh, ghi sự kiện rời trang và phiên đăng nhập thứ hai, màn hình học sinh (danh sách bài, làm bài, xem kết quả) | 1 | DT-22 (22g1, 22g2, 22h2 đã gộp); chạy ngay | YCTD-211 | Năm học 0120 đến 0123; định danh 0120, 0121 | 150 |
| 23b | Công cụ lớp học trên ứng dụng giáo viên: gọi tên ngẫu nhiên từ danh sách lớp thật (tuỳ chọn không lặp), chia nhóm ngẫu nhiên, đếm ngược, bấm giờ, bảng điểm nhanh theo nhóm hoặc học sinh gắn được vào nề nếp, thi đua; chạy ngoại tuyến bằng service worker và manifest, bản chụp danh sách lớp gọn | 1 | DT-21 (nề nếp); chạy ngay | YCTD-212 | Năm học 0124, 0125 | 151 |
| 23c | Trò chơi kiến thức và thẻ đáp án giấy: ô chữ, vòng quay, hỏi đáp theo vòng sinh từ ngân hàng câu hỏi chạy trên màn hình lớp; thẻ đáp án giấy tự thiết kế, in được, đọc bằng camera điện thoại của giáo viên; kết quả ghi vào lịch sử sử dụng câu hỏi của 22g2 | 2 | 23a (lưu kết quả lượt làm, màn hình), 23b (vỏ công cụ lớp học, ngoại tuyến) | YCTD-213 | Năm học 0126, 0127 | 152 |
| 23d | Trợ lý AI soạn câu hỏi nháp và kế hoạch bài dạy nháp: bộ nối nhà cung cấp AI (mặc định Claude, mã mô hình cấu hình), khóa lưu mã hóa theo trường (bộ nối `ai` của S3), bật tắt theo trường (mặc định tắt), chỉ gửi nội dung chương trình, nhật ký yêu cầu, hai cấu hình (trường tự nhập khóa, miễn phí; nền tảng cấp khóa, thu phí theo gói và theo token qua S5b, có màn hình thiết lập riêng), hạn mức theo gói (S5a), kết quả vào nháp qua luồng duyệt 22g1 và kiểm duyệt 22h1, hồ sơ pháp lý | 1 | DT-SaaS (S3, S5a, S5b đã gộp); 22g1, 22h1 | YCTD-214 | Năm học 0128; hệ thống 0071 đến 0073; nền tảng 0200 đến 0202 | 153 (kiểm cách ly khóa AI ở nhiều trường: mở rộng `MULTI_TENANT_SPEC` trong `tests/e2e-multi-environment.mjs`, chỉ 23d sửa) |
| 23e | Giám thị camera cho thi trực tuyến: giáo viên coi thi xem lưới camera của học sinh đang làm bài (WebRTC, coturn tự host trong hồ sơ vận hành), bật theo từng bài giao và theo trường (mặc định tắt), thông báo trước khi vào thi và đồng ý của cha mẹ (dưới 16 tuổi), ghi hình tuỳ chọn mã hoá giữ 30 ngày, nhật ký người xem; phát hiện vắng mặt, nhiều khuôn mặt, rời màn hình vẫn chạy trên máy học sinh (23a) | 1 | 23a (đã gộp) | YCTD-215 | Năm học 0129 | 154 |

Giữ chỗ chưa giao: YCTD-216 đến YCTD-219, hệ thống 0070 và 0074 đến 0079, định danh 0122 đến 0129, nền tảng 0203 đến 0209, e2e `155-` đến `159-` dự phòng cho bổ sung của DT-23.

Đợt làm, mỗi lúc tối đa ba phiên, **không hai phiên cùng sửa một tệp lõi trong cùng đợt**:
- **Đợt 1: 23a, 23b, 23d.** 23a sửa kênh đăng nhập (`access-token.ts`, `database/identity/`), giao diện học sinh trong ứng dụng phụ huynh, và phân hệ thi ở cơ sở dữ liệu năm học; 23b chỉ sửa `apps/teacher` (service worker, manifest, trang công cụ) và bảng nhỏ ở năm học; 23d sửa `database/system/schema.ts` (bộ nối `ai`), `database/platform/` (hạn mức AI), phân hệ AI mới và màn hình quản trị trường. Đăng ký thêm mô-đun, tuyến, menu chỉ theo kiểu **thêm cuối tệp** (`application.module.ts`, `platform-menu.ts`, `PORTAL_WORKSPACES`).
- **Đợt 2: 23c.** Bắt đầu khi 23a và 23b đã gộp (dùng lại bảng lượt làm của 23a và vỏ ngoại tuyến của 23b).

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH, PQ, mã chức năng): theo thứ tự xong của 23a, 23b, 23d, rồi 23c; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. YCTD, số migration, số e2e giữ sẵn ở bảng trên không đổi theo thứ tự gộp.

Cỡ ước lượng (một phần của DT-16 là một đơn vị, chỉ để so sánh): 23a 1,5; 23b 0,75; 23c 1,25; 23d 1,25; tổng khoảng 4,75 đơn vị.

**Điều kiện ra của DT-23** (nghiệm thu với Eric): một lớp thử với học sinh dữ liệu giả làm trọn một bài thi trực tuyến từ giao đề đến điểm vào sổ điểm, chạy ở cả hai bố cục cơ sở dữ liệu; giáo viên dùng bốn công cụ lớp học và vẫn mở được trang công cụ khi ngắt mạng sau lần tải đầu; một trò chơi ô chữ, một vòng quay và một lượt thẻ đáp án giấy ghi được kết quả vào lịch sử câu hỏi; trường bật AI soạn được một bộ câu hỏi nháp bằng bộ giả lập, bản nháp không dùng được trong đề trước khi duyệt, yêu cầu có trong nhật ký và bị chặn khi vượt hạn mức; ở cấu hình nền tảng cấp khóa, số token của kỳ ra thành dòng phí AI trên hóa đơn dịch vụ bằng dữ liệu giả; bộ kiểm thử cách ly (14.7) đạt, trường khác không dùng được khóa AI của trường này.

### 15.4 Phạm vi chi tiết

**23a. Thi trực tuyến cho học sinh**
- **Đăng nhập học sinh:** thêm kênh phiên `student` (cùng `SessionChannel`, cùng cơ chế làm mới, cookie, khóa tạm, mã xác nhận ảnh của S8b); người dùng định danh vai trò `hoc_sinh` liên kết một-một với tài khoản học và thi của học sinh (`student_learning_accounts`); tên đăng nhập và mật khẩu mặc định do trường cấp từ "Tài khoản học và thi", đổi mật khẩu ở lần đầu; học sinh chỉ gọi được nhóm điểm cuối `/student/*` và chỉ thấy dữ liệu của chính mình; tắt tài khoản khi học sinh nghỉ học, chuyển trường.
- **Giao đề:** từ đề đã duyệt của 22g1, giáo viên giao cho lớp, nhóm hoặc danh sách học sinh với giờ mở, giờ đóng, thời lượng, số lần làm, chế độ đảo câu hỏi, đảo đáp án, chế độ hiện kết quả (ngay, sau giờ đóng, giáo viên công bố); đề gốc có nhiều bản (`exam_variants`) thì phát ngẫu nhiên hoặc theo quy tắc; bản chụp câu trong đề giữ nguyên để đổi ngân hàng câu hỏi sau này không làm đổi bài đã giao.
- **Làm bài:** bắt đầu tạo lượt làm bài với hạn nộp tính theo đồng hồ máy chủ (kể cả khi học sinh tải lại trang), lưu nháp từng câu, tự nộp khi hết giờ; mất mạng thì giữ câu đã lưu, vào lại làm tiếp trong thời gian còn lại; đáp án đúng chỉ so ở máy chủ.
- **Chấm và chuyển điểm:** câu trắc nghiệm, đúng sai, điền ngắn có đáp án chấm tự động; câu tự luận chờ giáo viên chấm (dùng màn hình chấm của 22g2); khi đủ điểm chuyển vào sổ điểm Thông tư 22 và 27 **bằng luồng chuyển điểm của 22g2** (không viết luồng thứ hai), có bước giáo viên xác nhận trước khi ghi điểm chính thức.
- **Chống gian lận: khóa toàn màn hình và camera (Eric chốt 2026-10-26, GD-106):** mỗi lượt làm chỉ một phiên đăng nhập hợp lệ (phiên thứ hai bị từ chối hoặc đóng phiên cũ, cấu hình được). **Khóa toàn màn hình:** bài làm bắt buộc ở chế độ toàn màn hình của trình duyệt; thoát toàn màn hình, rời trang, đổi cửa sổ được ghi thành sự kiện, quá số lần cho phép (cấu hình theo bài, mặc định 3) thì cảnh báo rồi tự nộp hoặc đánh dấu cho giáo viên (cấu hình theo bài). **Camera:** trước khi vào bài học sinh cho phép camera (trình duyệt hỏi); **hình được xử lý hoàn toàn ngay trên máy học sinh để phát hiện không có mặt trong khung hình hoặc có nhiều khuôn mặt, chỉ gửi lên máy chủ các sự kiện (loại, thời điểm), không gửi hình hay video, không lưu hình**; từ chối camera hoặc không có camera thì theo cấu hình theo bài: chặn vào bài, hoặc cho vào và đánh dấu. Có thể bật theo bài chụp ảnh định kỳ gửi lên để giáo viên xem lại, **tắt mặc định**, chỉ bật khi trường có văn bản đồng ý của cha mẹ hoặc người giám hộ và lưu có thời hạn ngắn; ảnh lưu như dữ liệu trẻ em (mã hóa theo trường, xóa theo hạn, ghi vào hồ sơ đánh giá tác động). Giáo viên xem số lần và thời điểm từng loại sự kiện trong màn hình theo dõi; **sự kiện chỉ là căn cứ để giáo viên xét, không tự trừ điểm**; không chặn thao tác của máy; không nói là chống được gian lận hoàn toàn.
- **Màn hình học sinh** (trong ứng dụng phụ huynh, tuyến riêng của kênh `student`): danh sách bài được giao và hạn, làm bài, xem kết quả theo chế độ đã chọn, đổi mật khẩu.
- **Phân quyền và gói:** quyền giao đề, theo dõi, chấm cho giáo viên theo vai trò hiện có; phân hệ "Thi trực tuyến" tách ở danh sách phân hệ để gói dịch vụ (S5a) bật tắt được.

**23b. Công cụ lớp học trên ứng dụng giáo viên**
- **Gọi tên ngẫu nhiên:** lấy danh sách lớp thật của lớp đang chọn; tuỳ chọn không lặp lại trong một lượt; có thể loại học sinh vắng; hiệu ứng chọn; ghi lượt gọi (ai, lúc nào) để giáo viên xem lại, xóa được.
- **Chia nhóm ngẫu nhiên:** theo số nhóm hoặc số người mỗi nhóm; giữ lại nhóm để dùng cho bảng điểm nhanh; chia lại khi cần.
- **Đếm ngược, bấm giờ:** nhiều đồng hồ, tiếng báo hết giờ, chạy khi tắt màn hình.
- **Bảng điểm nhanh:** cộng, trừ điểm theo nhóm hoặc học sinh trong buổi học; **gắn được vào nề nếp, thi đua** của DT-21 (giáo viên chọn tiêu chí và xác nhận mới ghi `conduct_entries`), hoặc chỉ dùng trong buổi và bỏ.
- **Ngoại tuyến:** service worker lưu vỏ ứng dụng và trang công cụ, `manifest` để thêm vào màn hình chính; **bản chụp danh sách lớp gọn** (số thứ tự, họ tên, mã học sinh) lưu trên máy giáo viên khi mở lớp, **xóa khi đăng xuất hoặc khi hết hạn** (cấu hình, mặc định 24 giờ), có công tắc tắt ngoại tuyến theo trường; điểm cộng, gọi tên ghi trong hàng đợi trên máy và đồng bộ khi có mạng, có xử lý xung đột theo thời điểm; **ứng dụng giáo viên chỉ ngoại tuyến cho 23b**, các phân hệ khác vẫn cần mạng (GD-108).

**23c. Trò chơi kiến thức và thẻ đáp án giấy**
- **Nguồn câu hỏi:** chỉ câu đã duyệt trong ngân hàng câu hỏi (22g1), chọn theo môn, lớp, chủ đề, mức nhận thức.
- **Trò chơi chạy ở màn hình lớp** (giáo viên điều khiển, học sinh không cần thiết bị): **ô chữ** sinh từ câu có đáp án ngắn (bộ tạo lưới, giáo viên chỉnh tay được); **vòng quay** (quay chọn câu, chọn nhóm, chọn phần thưởng cấu hình); **hỏi đáp theo vòng** (chia nhóm, vòng, điểm theo nhóm, bảng điểm). Dùng lại nhóm và bảng điểm của 23b.
- **Thẻ đáp án giấy:** mẫu thẻ **do dự án tự thiết kế** (bốn đáp án A, B, C, D, mã thẻ gắn với học sinh qua số thứ tự trong lớp, không in họ tên đầy đủ); in được từ ứng dụng ra khổ A4 (nhiều thẻ một trang) hoặc thẻ lẻ; giáo viên chiếu câu hỏi, học sinh giơ thẻ, giáo viên quét bằng camera điện thoại trong trình duyệt; **xử lý hình ảnh hoàn toàn trên máy, không tải hình hay video lên máy chủ**, chỉ lưu kết quả (học sinh nào chọn đáp án nào cho câu nào); sửa tay được trước khi lưu. Thư viện đọc mã: tự viết hoặc dùng thư viện mã nguồn mở có giấy phép phù hợp, chọn lúc làm và ghi giấy phép (GD-107).
- **Ghi kết quả:** mỗi câu hỏi đã dùng ghi vào lịch sử sử dụng câu hỏi (`question_usages`, 22g2) kèm tỷ lệ đúng của lớp để thống kê chất lượng câu; điểm trò chơi **không** vào sổ điểm Thông tư 22, 27 (chỉ vào thi đua hoặc nề nếp khi giáo viên chọn, qua 23b).

**23d. Trợ lý AI soạn câu hỏi và kế hoạch bài dạy**
- **Bộ nối nhà cung cấp:** giao diện `AiProvider` (soạn câu hỏi nháp, soạn kế hoạch bài dạy nháp, kiểm tra kết nối) với các bộ nối: `anthropic` (mặc định, mã mô hình cấu hình được, ví dụ `claude-sonnet-5-5`), `mock` (kiểm thử, dữ liệu cố định), để chừa chỗ thêm bộ nối khác bằng cấu hình, **không có `if` theo nhà cung cấp trong mã nghiệp vụ**; địa chỉ và mã mô hình là cấu hình của nền tảng và của trường, không ghi cứng.
- **Khóa và bật tắt, hai cấu hình (Eric chốt 2026-10-26):** thêm `ai` vào `IntegrationSecretConnector` (S3). **Cấu hình 1, `school` (miễn phí):** trường tự nhập khóa nhà cung cấp của mình, lưu mã hóa theo trường, bọc bằng khóa gốc của nền tảng, trường tự trả chi phí cho nhà cung cấp, nền tảng không thu phí AI. **Cấu hình 2, `platform` (thu phí):** nền tảng giữ khóa chung của nền tảng (lưu mã hóa ở cơ sở dữ liệu `platform`, không bao giờ xuống cơ sở dữ liệu trường), trường dùng và **trả phí theo gói và theo số token sử dụng** (phần 23d, mục "Thu phí" dưới đây). Cấu hình chọn theo từng trường ở bước thiết lập AI của trường và ở gói. Mặc định mỗi trường **tắt** AI (`ai_settings.enabled = false`), quản trị trường bật; thiếu khóa hoặc tắt thì nút AI không hiện, điểm cuối trả lỗi rõ ràng, mọi phân hệ khác chạy như cũ.
- **Chỉ gửi nội dung chương trình:** máy chủ **dựng lời nhắc từ mẫu cố định** với các trường có kiểm tra (môn, lớp, chủ đề, yêu cầu cần đạt, mức nhận thức, dạng câu, số câu, mô tả thêm của giáo viên); mô tả thêm bị quét mẫu số điện thoại, thư điện tử, số định danh, tên có trong danh sách học sinh và cán bộ của trường (so sánh ở máy chủ, không gửi danh sách ra ngoài); thấy thì từ chối và báo giáo viên bỏ thông tin cá nhân; **không đưa bài làm, điểm, nhận xét, danh sách lớp, ảnh vào lời nhắc**; giao diện ghi rõ điều này.
- **Kết quả luôn là bản nháp:** câu hỏi vào ngân hàng ở trạng thái nháp với cờ `ai_generated` (năm học 0128), **không dùng được trong đề cho đến khi qua luồng duyệt của 22g1**; kế hoạch bài dạy lưu thành học liệu nháp ở kho học liệu số (22h1) và qua kiểm duyệt của 22h1 trước khi chia sẻ; mọi bản nháp mang dấu "do AI soạn, cần giáo viên kiểm tra", ghi người yêu cầu và người duyệt; giấy phép và nguồn của học liệu theo quy định của 22h1 (giáo viên chịu trách nhiệm kiểm tra không chứa nội dung sao chép có bản quyền).
- **Nhật ký và hạn mức:** bảng nhật ký yêu cầu ở cơ sở dữ liệu hệ thống của trường (ai, lúc nào, loại, môn, lớp, chủ đề, kích thước vào ra, số token vào và ra, nhà cung cấp, mã mô hình, cấu hình dùng, kết quả, lỗi); **không lưu toàn văn lời nhắc ngoài bản nháp đã sinh** (giữ mã băm để tra); hạn mức số yêu cầu và số token mỗi tháng là **giới hạn mới của gói** (`plans`, nền tảng 0200, kiểm tra ở máy chủ và hiển thị còn lại ở màn hình AI, ghép với kiểm tra gói của S5a), chặn khi vượt hạn mức; hạn mức theo từng người dùng để chống lạm dụng (cấu hình). Ở cấu hình `school`, hạn mức chỉ để chống lạm dụng và có thể không đặt.
- **Thu phí (cấu hình `platform`, có thiết lập riêng):** phần mềm đếm token theo trường theo kỳ (bảng đo ở `platform`, nền tảng 0201, tổng hợp từ nhật ký của trường qua việc nền theo trường của S1b); **quy tắc tính phí của S5b mở rộng thêm thành phần AI** (nền tảng 0202): quản trị nền tảng đặt cho từng gói trong một màn hình thiết lập riêng số token miễn phí mỗi kỳ, đơn giá theo một nghìn token vào và ra (có thể khác nhau, tính theo mô hình), phí tối thiểu, làm tròn; dòng phí AI hiện trên hóa đơn dịch vụ cùng kỳ, dùng lại luồng chốt kỳ, hóa đơn, thu tiền, đối soát của S5b, không dựng luồng thu thứ hai; hàm tính thuần có kiểm thử đơn vị, số nguyên đồng; mô hình hay đơn giá nhà cung cấp đổi thì đổi dữ liệu thiết lập, không sửa mã; trường thấy số token đã dùng và tạm tính trước khi chốt kỳ.
- **Hồ sơ pháp lý (tài liệu):** đọc văn bản gốc (15.2) rồi viết bản nháp cho `33_HO_SO_PHAP_LY/`: cập nhật chính sách bảo mật và thỏa thuận xử lý dữ liệu (nhà cung cấp AI là bên xử lý phụ, vùng máy chủ của nhà cung cấp, điều khoản không dùng dữ liệu để huấn luyện nếu nhà cung cấp cho chọn), ghi rõ **chỉ gửi nội dung chương trình, không gửi dữ liệu cá nhân**, nên không phát sinh chuyển dữ liệu cá nhân ra nước ngoài, nhưng vẫn ghi vào hồ sơ đánh giá tác động và hồ sơ chuyển dữ liệu ra nước ngoài (nếu nhà cung cấp ở nước ngoài) để luật sư của Eric kết luận; thêm câu thông báo cho giáo viên và quản trị trường khi bật AI.
- **Màn hình:** nút "Soạn nháp bằng AI" ở ngân hàng câu hỏi (22g1) và ở kho học liệu (22h1); màn hình quản trị AI của trường (bật tắt, khóa, mã mô hình, hạn mức còn lại, nhật ký); phía nền tảng thêm giới hạn AI vào trang Gói dịch vụ.

**23e. Giám thị camera cho thi trực tuyến (YCTD-215, Eric yêu cầu, tách khỏi 23a ngày 2026-10-26)**
- **Xem trực tiếp:** giáo viên coi thi (người giao bài, người dạy lớp, người quản lý) xem lưới camera của học sinh đang làm bài ngay ở màn hình Theo dõi, bằng WebRTC: hình đi thẳng giữa hai trình duyệt, máy chủ API chỉ chuyển thông điệp báo hiệu ngắn hạn (hỏi định kỳ, không dựng web socket); máy chủ chuyển tiếp coturn tự host trong hồ sơ vận hành `deploy/` (dùng chung về sau cho 27a, thông tin TURN có hạn theo khoá dùng chung). Mặc định tắt: trường bật ở Cấu hình thi trực tuyến, giáo viên bật theo từng bài giao; mỗi bài xem tối đa 60 camera cùng lúc.
- **Thông báo và đồng ý:** học sinh đọc thông báo và xác nhận trước khi vào bài có giám sát; học sinh dưới 16 tuổi (hoặc chưa rõ ngày sinh) cần cha mẹ đồng ý từng loại (xem trực tiếp, ghi hình) trên ứng dụng phụ huynh hoặc do người quản lý ghi nhận văn bản; thu hồi có hiệu lực ngay; học sinh thấy dòng thông báo khi có người xem; mỗi phiên xem ghi nhật ký người xem.
- **Phát hiện trên máy:** vắng mặt, nhiều khuôn mặt, rời màn hình vẫn do 23a chạy trên máy học sinh và ghi thành sự kiện của lượt làm (chỉ là căn cứ, không tự trừ điểm); không gửi hình để phát hiện.
- **Ghi hình tuỳ chọn, mặc định tắt:** trình duyệt học sinh ghi từng đoạn ngắn và tải lên, máy chủ mã hoá và lưu ở kho tệp theo khoá lưu trữ, giữ theo số ngày của trường (mặc định 30, 7 đến 90; GD-132), chỉ người giao bài và người quản lý xem lại (phát qua máy chủ, không tải xuống, mỗi lần xem ghi nhật ký), tự xoá khi hết hạn; không nhận diện danh tính sinh trắc.
- **Số giữ sẵn:** YCTD-215, năm học 0129, e2e 154. **Pháp lý:** rủi ro và câu hỏi ghi ở PL-15 (Nghị định 356/2025 Điều 21 khoản 5; Điều 24 Luật 91/2025/QH15) và PL-13 (thời hạn giữ bản ghi); cần luật sư rà trước khi bật ở trường thật.

### 15.5 Quyết định thiết kế và phương án đã loại

- **Học sinh đăng nhập qua kênh `student` riêng, không dùng tài khoản phụ huynh:** cùng cơ chế phiên, khác kênh, khác tuyến, khác quyền; phương án đã loại: dùng chung tài khoản phụ huynh (lộ thông tin phụ huynh cho học sinh, không biết ai đang làm bài), tạo ứng dụng học sinh thứ tư (thêm một ứng dụng phải dựng, triển khai, kiểm thử riêng; màn hình học sinh gọn nên đặt trong ứng dụng phụ huynh, tách khi cần).
- **Đồng hồ và đáp án ở máy chủ:** học sinh đổi giờ máy hoặc xem mã trang không đổi được kết quả; phương án đã loại: chấm ở trình duyệt (lộ đáp án).
- **Chuyển điểm bằng luồng 22g2, có xác nhận của giáo viên:** một đường duy nhất vào sổ điểm; phương án đã loại: ghi thẳng điểm thi trực tuyến vào `score_entries` không qua giáo viên (điểm thi online chưa chắc là điểm chính thức: học sinh có thể làm ở nhà).
- **Ngoại tuyến bằng service worker chỉ cho 23b:** phạm vi nhỏ, dữ liệu gọn, có hàng đợi đồng bộ; phương án đã loại: ngoại tuyến toàn bộ ứng dụng giáo viên (xung đột dữ liệu điểm, học bạ), ứng dụng di động gốc (14.6 đã loại; cập nhật 2026-10-26: ứng dụng cài đặt làm ở DT-26 bằng cách đóng gói mã web, mục 18; ngoại tuyến vẫn chỉ cho 23b).
- **Thẻ đáp án giấy đọc trên máy, không tải hình lên:** giảm rủi ro dữ liệu trẻ em; phương án đã loại: gửi video lên máy chủ để nhận dạng (nặng, vướng quy định); dùng đúng mẫu thẻ của sản phẩm khác (không sao chép, tự thiết kế).
- **AI là bộ nối cấu hình được, không phụ thuộc một nhà cung cấp:** mặc định Claude vì Eric chọn; thay nhà cung cấp hay mô hình bằng cấu hình; phương án đã loại: tự lưu mô hình chạy ở máy chủ của dự án (tốn máy, chất lượng thấp ở giai đoạn này).
- **Hai cấu hình AI, hạn mức và phí gắn với gói:** cấu hình `school` miễn phí cho trường có sẵn khóa, cấu hình `platform` thu theo gói và theo token (Eric chốt 2026-10-26); dùng lại chỗ kiểm tra gói của S5a và luồng thu phí của S5b, không dựng bộ đếm hay luồng thu riêng; phương án đã loại: chỉ tin hạn mức của nhà cung cấp (không chặn theo trường được), chỉ một cấu hình (không đáp ứng cả trường có khóa sẵn lẫn trường muốn trả theo mức dùng).
- **Không làm ở DT-23:** đăng nhập Google; Đoàn, Đội; quảng bá thương mại; gói cá nhân; chấm tự luận bằng AI (kết quả AI không thành điểm); AI nhìn dữ liệu học sinh (nhận xét học bạ, dự đoán kết quả); ghi hình hay video của học sinh lưu ở máy chủ (chỉ có sự kiện và, tuỳ chọn, ảnh định kỳ khi có đồng ý), chặn thao tác của máy; trả lời học sinh bằng AI; ngoại tuyến cho phân hệ ngoài 23b.

### 15.6 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Lộ dữ liệu học sinh hoặc giáo viên cho nhà cung cấp AI | Lời nhắc dựng từ mẫu cố định chỉ chứa nội dung chương trình; quét mẫu cá nhân và so tên trong danh sách trường ở máy chủ; kiểm thử gửi thử có tên, số điện thoại và chuỗi mồi, bộ giả lập ghi lại lời nhắc nhận được và phải không có chuỗi mồi; quyền gọi AI theo vai trò; nhật ký |
| Dùng khóa AI của trường này cho trường khác | Khóa lưu theo trường (S3); bộ nối thiếu ngữ cảnh trường thì đóng chặt; spec 153 cách ly ở nhiều trường; kiểm tĩnh |
| Nội dung AI sai hoặc có bản quyền được dùng thẳng trong đề, bài giảng | Luôn là nháp, chặn dùng trong đề đến khi duyệt (22g1) hoặc kiểm duyệt (22h1), dấu "do AI soạn", người duyệt ghi lại; hướng dẫn giáo viên kiểm tra |
| Chi phí AI vượt dự tính | Hạn mức theo gói, theo người dùng, chặn ở máy chủ, nhật ký số token, tắt mặc định; ở cấu hình `platform` có token miễn phí và dòng phí theo mức dùng, số tạm tính cho trường xem trước |
| Sai số token hoặc đơn giá làm hóa đơn AI sai, hoặc nền tảng chịu lỗ khi giá nhà cung cấp đổi | Đếm token từ phản hồi của nhà cung cấp (không ước lượng), đơn giá theo mô hình là dữ liệu thiết lập, hàm tính thuần kiểm thử nhiều ca, điều chỉnh tay có lý do như S5b, cảnh báo ở bảng điều khiển khi chi phí thực vượt phí thu |
| Nhà cung cấp AI ở nước ngoài, vướng quy định chuyển dữ liệu | Chỉ gửi nội dung chương trình, không gửi dữ liệu cá nhân; ghi vào hồ sơ đánh giá tác động; luật sư của Eric rà trước khi bật ở trường thật; tắt mặc định |
| Học sinh gian lận khi thi ở nhà | Khóa toàn màn hình, camera kiểm tra có mặt và nhiều khuôn mặt ngay trên máy, ghi sự kiện, một phiên, thời lượng cứng, đảo câu, điểm do giáo viên xác nhận trước khi vào sổ, sự kiện chỉ là căn cứ xét không tự trừ điểm; khuyến nghị thi chính thức ở phòng máy có giám thị (GD-106); không hứa chống tuyệt đối |
| Camera của học sinh (trẻ em) làm lộ hình ảnh, gây khó chịu hoặc vướng quy định | Hình xử lý ở máy học sinh, không gửi hình hay video, chỉ gửi sự kiện; ảnh định kỳ tắt mặc định và chỉ bật khi có đồng ý của cha mẹ; đọc lại quy định về dữ liệu của trẻ lúc làm 23a; thông báo rõ cho học sinh và phụ huynh trước khi vào bài; học sinh không có camera có đường thay thế do giáo viên chọn; trường tắt được camera theo bài |
| Học sinh xem được đáp án, đề, điểm của người khác | Đáp án đúng không xuống máy học sinh, tuyến `/student/*` chỉ trả dữ liệu của chính học sinh, ma trận cách ly mọi tuyến, kiểm thử học sinh A gọi dữ liệu học sinh B |
| Đồng hồ máy học sinh sai hoặc mạng chập chờn làm mất bài | Đồng hồ máy chủ, lưu nháp từng câu, vào lại làm tiếp, tự nộp khi hết giờ, kiểm thử ngắt mạng giữa chừng |
| Tải đồng thời lúc cả khối vào làm bài cùng giờ | Lưu nháp gộp theo lô, giới hạn tần suất theo học sinh và theo trường, thử tải một lớp 45 học sinh và một khối 400 học sinh ở môi trường thử, số liệu ghi vào YCTD |
| Tài khoản học sinh bị chia sẻ hoặc đoán mật khẩu | Mật khẩu mặc định đổi ở lần đầu, khóa tạm và mã xác nhận ảnh như kênh khác (S8b), trường khóa, đặt lại mật khẩu; học sinh không có quyền đổi thông tin hồ sơ |
| Danh sách lớp lưu trên máy giáo viên bị lộ khi mất máy | Bản chụp gọn (số thứ tự, họ tên, mã), xóa khi đăng xuất và hết hạn, công tắc tắt theo trường, không lưu điểm, nhận xét, thông tin phụ huynh |
| Thẻ đáp án đọc sai làm sai thống kê | Hiện kết quả đọc cho giáo viên sửa tay trước khi lưu, kiểm thử nhiều góc, ánh sáng, thẻ nghiêng, thẻ bị che, điểm trò chơi không vào sổ điểm chính thức |
| Service worker giữ bản cũ của ứng dụng sau khi cập nhật | Đặt phiên bản bộ nhớ đệm theo bản phát hành, cập nhật nền và hỏi tải lại, đường dẫn `base` giữ như hiện nay (14.8), kiểm thử cập nhật |
| Hai phần cùng đợt sửa chung tệp lõi (`application.module.ts`, `platform-menu.ts`, `PORTAL_WORKSPACES`, `access-token.ts`, `MULTI_TENANT_SPEC`) | Chỉ 23a sửa kênh đăng nhập, chỉ 23d sửa `MULTI_TENANT_SPEC` và `database/platform/`; sửa tệp chung theo kiểu thêm cuối; gộp `origin/main` trước khi mở PR |
| Va số với DT-SaaS hoặc bổ sung chạy song song | Dải DT-23 bắt đầu sau dải DT-SaaS (15.3); không dùng số dự phòng của DT-SaaS hay chỗ giữ cũ của DT-22 |
| Chép nội dung, tên gọi, giao diện của hệ thống được khảo sát | Chỉ lấy ý tưởng tính năng (15.1); tên, mẫu thẻ, trò chơi, giao diện tự thiết kế theo khuôn của dự án; người duyệt PR đối chiếu |

**Cổng kiểm của mỗi phần DT-23:** kiểm thử đơn vị toàn bộ kho mã đạt không sửa kỳ vọng; e2e `single` hiện có đạt cộng e2e mới của phần (chạy riêng, giữ khóa `e2e.lock`, không chạy cùng kiểm thử đơn vị toàn kho); kiểm thử cách ly theo 14.7 ở cả hai bố cục `database` và `schema`; kiểm tĩnh đa thuê bao đạt; typecheck, lint, build đạt; CI xanh toàn bộ; phiên bản phần mềm tăng theo từng phần, riêng bản kế hoạch này (YCTD-210) chỉ đổi tài liệu.

### 15.7 Quy ước chung của DT-23

- Mỗi phần ghi YCTD giữ sẵn ở mục 15.3, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, 23, 24, 32, 34, `index.md` khi có thay đổi tương ứng), ghi văn bản căn cứ đã đọc (phần 23d), mở PR, gộp khi mọi kiểm tra CI đạt.
- Mã mới theo mục 15.2 (dùng lại phần đã có, không đổi hành vi cũ, hai bố cục cơ sở dữ liệu, kiểm tĩnh đa thuê bao, máy chủ giữ đáp án và thời gian, AI chỉ nháp).
- Kiểm thử và dữ liệu mẫu chỉ dùng học sinh, giáo viên, lớp, câu hỏi bịa; kiểm thử AI chỉ qua bộ giả lập `mock`; không in nội dung `.env`, không dán khóa vào tài liệu.
- Tuyệt đối không chạy `migrate` lên cơ sở dữ liệu dùng chung; kiểm thử dùng cơ sở dữ liệu riêng của phiên.
- Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần; nếu một phần cần số ngoài khoảng đã giữ, ghi vào YCTD và lấy ở dải dự phòng của DT-23 (15.3).
- Phần chưa chốt (15.9) làm cấu hình được; khi Eric chốt thì đổi giá trị mặc định bằng YCTD, không sửa mã.

### 15.8 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| 23a | 1 | Đã làm, YCTD-211, phiên bản 0.144.0, PR 189: kênh `student` và vai trò VT-21 nối tài khoản học và thi, giao đề đã khoá cho lớp hoặc học sinh, làm bài có đồng hồ máy chủ, lưu nháp từng câu, chấm tự động, bài nộp vào phiếu chấm 22g2 (chuyển sổ điểm có giáo viên xác nhận), khóa toàn màn hình và camera nhận diện trên máy học sinh (chỉ gửi sự kiện), theo dõi, chấm tự luận, công tắc theo cấp, phân hệ "Thi trực tuyến" (năm học 0120 đến 0123, định danh 0120, 0121, e2e 150); chưa làm: ảnh chụp định kỳ, chuyển điểm Tiểu học, việc nền chốt lượt quá hạn |
| 23b | 1 | Đã làm (YCTD-212, phiên bản 0.140.0, PR 180): công cụ lớp học, ngoại tuyến, bản chụp danh sách lớp 24 giờ; năm học 0124, 0125; e2e 151 |
| 23d | 1 | Đã làm, YCTD-214, phiên bản 0.143.0, PR 184: bộ nối `AiProvider` (`anthropic`, `mock`), hai cấu hình khóa, bật tắt theo trường, lời nhắc từ mẫu cố định và bộ quét dữ liệu cá nhân, bản nháp qua duyệt 22g1 và kiểm duyệt 22h1, nhật ký, hạn mức theo gói, phí theo token qua S5b, màn hình quản trị, e2e spec 153, bản nháp pháp lý PL-22 |
| 23e | 1 | Đã làm, YCTD-215, phiên bản 0.151.0, PR 195: giám thị camera cho thi trực tuyến: cấu hình của trường (mặc định tắt), bật theo bài giao, thông báo và đồng ý của cha mẹ (dưới 16 tuổi, ứng dụng phụ huynh hoặc trường ghi nhận), xem lưới camera trực tiếp qua WebRTC (báo hiệu qua máy chủ API, coturn trong `deploy/`), nhật ký người xem, ghi hình mã hoá có hạn và xem lại có kiểm quyền; năm học 0129; e2e 154; cần luật sư rà (PL-15) trước khi bật ở trường thật |
| 23c | 2 | Đã làm, YCTD-213, phiên bản 0.150.0, PR 202: thẻ "Trò chơi" trong Công cụ lớp học (hỏi đáp theo vòng, vòng quay, ô chữ, thẻ đáp án giấy in và quét bằng camera trên máy), lượt chơi lưu qua máy chủ (chấm lại, gửi lại không trùng), lịch sử sử dụng câu hỏi kèm tỷ lệ đúng (`question_usages` nguồn `game`); năm học 0126, 0127; e2e 152 |

Bản kế hoạch này là YCTD-210, chỉ đổi tài liệu (không tăng phiên bản phần mềm).

### 15.9 Giả định chưa chốt, làm cấu hình được

| Mã | Mục chưa chốt | Giả định để làm | Cấu hình ở | Cần ai trả lời |
|---|---|---|---|---|
| GD-102 | Ai giữ khóa nhà cung cấp AI và chịu chi phí | **Eric đã chốt 2026-10-26:** có cả hai cấu hình: `school` (trường tự nhập khóa, miễn phí) và `platform` (nền tảng giữ khóa, thu phí theo gói và theo token sử dụng) | `ai_settings`, `plans`, `platform_settings` | Eric (đã chốt) |
| GD-103 | Mức thu và hạn mức AI | **Eric đã chốt 2026-10-26:** thu theo gói và theo token sử dụng, có màn hình thiết lập riêng (token miễn phí mỗi kỳ, đơn giá token vào và ra, phí tối thiểu); số cụ thể chưa đặt, là dữ liệu quản trị nền tảng nhập; hạn mức yêu cầu và token mỗi tháng theo gói cũng là dữ liệu | `plans`, `price_rules` | Eric (số tiền) |
| GD-104 | Thời hạn giữ nhật ký yêu cầu AI | 12 tháng | `ai_settings` | Eric |
| GD-105 | Học sinh nhỏ tuổi tự đăng nhập | **Eric đã chốt 2026-10-26:** bật ở mọi cấp học, kể cả Tiểu học; trường có công tắc tắt theo cấp; 23a đọc lại quy định về dữ liệu của trẻ lúc làm (độ tuổi, đồng ý của cha mẹ hoặc người giám hộ) và ghi vào YCTD | cấu hình thi trực tuyến của trường | Eric (đã chốt) |
| GD-106 | Mức chống gian lận | **Eric đã chốt 2026-10-26:** khóa toàn màn hình và camera. Claude chọn cách làm tôn trọng dữ liệu trẻ em: camera xử lý ngay trên máy học sinh, chỉ gửi sự kiện, không gửi hình hay video; ảnh định kỳ tắt mặc định, chỉ bật khi có đồng ý của cha mẹ; sự kiện không tự trừ điểm; điểm cần giáo viên xác nhận mới vào sổ | cấu hình thi trực tuyến, theo bài | Eric (đã chốt hướng; chốt lại nếu muốn lưu hình mặc định) |
| GD-107 | Thư viện đọc thẻ đáp án | Tự viết bộ đọc hoặc dùng thư viện mã nguồn mở có giấy phép cho phép dùng thương mại; chọn và ghi giấy phép lúc làm | mã 23c | Claude (theo ủy quyền) |
| GD-108 | Phạm vi ngoại tuyến của ứng dụng giáo viên | **Eric đã chốt 2026-10-26:** chỉ trang công cụ lớp học (23b); danh sách lớp lưu 24 giờ, xóa khi đăng xuất | cấu hình theo trường | Eric (đã chốt) |

## 16. DT-24: danh mục đơn vị toàn quốc, đăng nhập theo đơn vị, quyền quản trị nền tảng

### 16.1 Căn cứ và mục tiêu

1. **Yêu cầu của Eric ngày 2026-10-26**, ba việc làm thành một đợt nhỏ DT-24 (kế hoạch và mã trong cùng một PR):
   - tự lập danh sách trường toàn quốc theo nguồn đầy đủ nhất;
   - đổi màn hình đăng nhập theo bố cục trang đăng nhập của hệ thống ngành (chọn đơn vị rồi nhập tài khoản);
   - tài khoản quản trị nền tảng vào được mọi trường; **mặc định không cần trường đồng ý** nhưng bắt buộc xác thực hai lớp, lý do, nhật ký đầy đủ trường xem được, phiên có hạn, biểu ngữ; chính sách để cấu hình được ở mức nền tảng.
2. **Nguồn danh mục:** ba phiên khảo sát ngày 2026-10-26 chỉ đọc phần công khai, lưu kết quả **ngoài kho mã** (`.claude/logs-khaosat-csdl-moet`, `.claude/logs-khaosat-smis`, `.claude/logs-khaosat-truong-hcm`):
   - trang đăng nhập cấp trường của CSDL ngành là nguồn đầy đủ nhất: 39.669 trường kèm mã Bộ (43.063 cặp trường, cấp học), 34 sở, 5 cấp học (Mầm non, Tiểu học, THCS, THPT, GDTX), năm học 2026-2027; 11 mã trùng khuôn số căn cước đã che ở nguồn;
   - trang của hệ thống học bạ có đủ 3.321 phường, xã của 34 tỉnh, thành (mã đơn vị hành chính cấp xã 5 chữ số);
   - dữ liệu của Sở TP.HCM (6.168 mã) dùng để đối chiếu: mã trường của Sở trùng mã Bộ.
   - Đối chiếu bằng bộ đọc của DT-24 (chỉ đếm, không in dữ liệu): 39.658 đơn vị nhập được, 11 dòng bị loại vì mã trùng khuôn số căn cước, 4.333 mã không theo dạng 8 hoặc 10 chữ số, 314 tên rỗng, 366 thiếu phường, xã; mọi mã xã của trường đều có trong danh mục phường, xã.
3. **Hiện trạng mã trước DT-24** (nhánh chính ngày 2026-10-26, sau PR 176):
   - S1a nhận diện trường theo tên miền; S1b có trang chọn trường ở tên miền hệ thống (nhập mã trường, không liệt kê trường);
   - S2 khởi tạo trường (mã trường do người vận hành gõ); S3 thương hiệu theo trường (tên hiển thị, màu, biểu trưng công khai ở `/public/branding`);
   - S4 phiên hỗ trợ: nhân viên nền tảng chỉ mở được khi trường đang cho phép (`support_access_grants`), có lý do, đường liên kết một lần, biểu ngữ, nhật ký hai phía; S6 cây đơn vị hành chính do người vận hành tự dựng (`admin_units`) cho tài khoản cấp trên;
   - S8b xác thực hai lớp, khóa tạm, chính sách mật khẩu theo trường; 16c mã xác nhận dạng ảnh do máy chủ sinh.
   - Ứng dụng giáo viên và phụ huynh có màn hình đăng nhập riêng (`apps/teacher`, `apps/parent`), **không dùng chung** trang đăng nhập của cổng quản trị.
4. **Mục tiêu:** danh mục đơn vị toàn quốc là dữ liệu tham chiếu của nền tảng, nạp lại được mỗi năm học; người dùng ở tên miền chung chọn Sở → Cấp học → Phường/Xã → Trường rồi đăng nhập vào đúng trường; quản trị nền tảng vào được mọi trường với các biện pháp bắt buộc; không đổi hành vi của tên miền riêng của trường và chế độ một trường.

### 16.2 Nguyên tắc

- **Kho mã công khai:** không commit tệp CSV toàn quốc hay bất kỳ dữ liệu thu thập nào từ trang của Bộ, Sở. Kho chỉ có mã, migration, công cụ nhập và một tệp mẫu nhỏ toàn dữ liệu giả (`database/platform/catalog-sample/`: mã sở 97, 98, phường xã 99xxx, tên bịa).
- **Không mạo danh cơ quan nhà nước:** trang đăng nhập chỉ học bố cục và luồng chọn đơn vị; không dùng quốc huy, tên, biểu trưng của Bộ GD&ĐT hay tên của hệ thống ngành. Tiêu đề lấy từ cấu hình của nền tảng (tên miền chung) hoặc thương hiệu của trường (S3).
- **Không lộ danh sách khách hàng:** ô chọn liệt kê cả danh mục, không đánh dấu đơn vị nào dùng nền tảng; chỉ khi người dùng chọn một đơn vị mới tra đơn vị đó (như trang chọn trường của S1b), có giới hạn tần suất.
- **Không đổi hành vi cũ:** chế độ một trường và tên miền của trường giữ trang đăng nhập cũ (thêm khung "Thông tin đơn vị" đã khóa); nhãn ô, nút mà các e2e cũ dùng giữ nguyên ("Số điện thoại hoặc tên đăng nhập", "Mật khẩu", "Đăng nhập", "Ghi nhớ tài khoản", "Quên mật khẩu?"); phiên hỗ trợ theo cho phép của S4 giữ nguyên.
- **Đăng nhập luôn chạy trong ngữ cảnh của đúng trường:** tài khoản, khóa tạm, chính sách mật khẩu, xác thực hai lớp, mã xác nhận, nhật ký là của trường được chọn; tên miền chung không nhận cookie phiên của trường nào.
- **Nền tảng là bên xử lý** (Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, Điều 37): quyền vào trường của quản trị nền tảng phải nằm trong thỏa thuận xử lý dữ liệu đã ký (PL-02), chỉ cho mục đích vận hành, hỗ trợ, xử lý sự cố, có biện pháp kiểm soát và trường xem được nhật ký.
- Chạy được ở cả hai bố cục cơ sở dữ liệu `database` và `schema`; đạt kiểm tĩnh đa thuê bao và ma trận cách ly (14.7).

### 16.3 Phần, số giữ sẵn

Một phần duy nhất, **một PR** (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: ba việc dùng chung bảng danh mục, trang đăng nhập và phiên hỗ trợ; tách hai PR sẽ phải sửa trang đăng nhập hai lần). Số giữ sẵn bắt đầu sau dải của DT-23 (đến YCTD-219, năm học 0129, hệ thống 0079, định danh 0129, nền tảng 0209, e2e `159-`):

| Mục | Số |
|---|---|
| YCTD | YCTD-220 (kế hoạch và mã); YCTD-221 đến YCTD-229 dự phòng cho bổ sung của DT-24 |
| Migration nền tảng | 0210 (danh mục), 0211 (gắn mã Bộ cho trường, căn cứ phiên hỗ trợ, chính sách mặc định); giữ 0212 đến 0219 |
| Migration định danh | 0130 (mã chuyển phiên); giữ 0131 đến 0139 |
| Migration năm học, hệ thống | Không dùng |
| e2e | `160-unit-directory-login.spec.ts` (dự án nhiều trường, `MULTI_TENANT_SPEC` thêm 160); `161-` đến `169-` dự phòng |
| Kịch bản kiểm thử trong mã | CT-24-1 đến CT-24-10 |
| Phiên bản phần mềm | 0.141.0 (0.140.0 của 23b gộp trước; phần gộp sau đánh lại số theo nhánh chính lúc gộp) |

### 16.4 Phạm vi chi tiết

**1. Danh mục đơn vị toàn quốc (cơ sở dữ liệu `platform`, migration 0210)**

| Bảng | Nội dung |
|---|---|
| `catalog_departments` | Sở GD&ĐT: mã 2 chữ số là mã tỉnh, thành sau sáp nhập (theo cột mã sở của nguồn), tên tỉnh, thành, trạng thái |
| `catalog_levels` | Cấp học theo mã của Bộ: `MN` 01, `TH` 02, `THCS` 03, `THPT` 04, `GDTX` 05 (nạp sẵn trong migration, là danh mục chuẩn) |
| `catalog_communes` | Phường, xã: mã đơn vị hành chính cấp xã 5 chữ số, sở, tên, tên bỏ dấu để tìm |
| `catalog_units` | Đơn vị trường: mã Bộ (chuỗi bất biến, giữ số 0 đầu, có thể có chữ, tối đa 40 ký tự, duy nhất), tên, tên bỏ dấu, sở, phường xã (có thể trống), tên xã ở nguồn khi không ghép được mã, năm học, nguồn, trạng thái `active`/`inactive`, cờ chất lượng, lần đầu và lần cuối thấy |
| `catalog_unit_levels` | Trường liên cấp: nhiều dòng (nhiều-nhiều với cấp học) |
| `catalog_import_runs` | Mỗi lần nhập (kể cả chạy thử) một dòng: nguồn, tệp, số thêm, sửa, giữ nguyên, bỏ qua, cờ; 500 dòng bỏ qua đầu kèm lý do; người nhập |

- **Quy tắc làm sạch** (`database/src/school-catalog.ts`, Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - đọc CSV theo RFC 4180 (ô có dấu phẩy, ngoặc kép), bỏ dấu BOM; nhận cả tệp một dòng mỗi trường và tệp một dòng mỗi cặp trường, cấp học (gộp cấp theo mã);
  - **không suy ra tỉnh từ hai số đầu mã trường** (mã bất biến, hai số đầu là tỉnh lúc cấp mã trước sáp nhập): sở lấy theo cột `ma_so`;
  - mã giữ nguyên chuỗi (chỉ bỏ khoảng trắng hai đầu); mã không theo dạng 8 hoặc 10 chữ số vẫn nhập, gắn cờ `code_nonstandard`;
  - **mã đã che hoặc 12 chữ số bắt đầu bằng 0 (trùng khuôn số căn cước) không nhập**, ghi vào báo cáo là bị loại với mã `[đã che]`, không ghi giá trị mã;
  - tên rỗng thì đặt tên tạm "Đơn vị mã <mã>", gắn cờ `name_missing`; thiếu xã gắn cờ `commune_missing`; mã xã sai hoặc không có trong danh mục gắn cờ `commune_invalid` và giữ tên xã ở nguồn; thiếu cấp gắn cờ `level_missing`, cấp lạ gắn cờ `level_unknown`;
  - cùng mã ở hai sở khác nhau trong một tệp: giữ dòng đầu, ghi dòng sau vào báo cáo bỏ qua.
- **Nhập lặp lại được:** so từng đơn vị theo mã, chỉ ghi phần đổi (thêm, sửa, giữ nguyên chỉ cập nhật lần cuối thấy); tùy chọn chuyển "ngừng hoạt động" các đơn vị của những sở có trong tệp mà không còn trong tệp (không xóa, vì mã bất biến); chạy thử chỉ tính báo cáo; mỗi lần nhập ghi `catalog_import_runs` và nhật ký nền tảng. Đo trên máy phát triển với bản khảo sát: nhập lần đầu khoảng 16 giây, nhập lại khoảng 3 giây, tìm một trang khoảng 17 ms.
- **Công cụ nhập:** lệnh `platform catalog-import --units <tệp> [--communes <tệp>] [--source] [--dry-run] [--deactivate-missing]` và `platform catalog-seed` (máy phát triển, đọc `CATALOG_UNITS_FILE`, `CATALOG_COMMUNES_FILE`, mặc định tệp khảo sát ở `../.claude/logs-khaosat-*`, không có thì bỏ qua); trang **Danh mục đơn vị** ở cổng nền tảng: số liệu, nhập tệp CSV (gửi nguyên văn bản, tối đa 20 MB, chạy thử trước), báo cáo, tra cứu theo sở, cấp, cờ, chữ (thấy trường đã gắn), các lần nhập gần đây.
- **Gắn với trường đã khởi tạo (S2):** cột `schools.moet_code` (migration 0211, duy nhất, liên kết mềm không khóa ngoại để nạp lại danh mục không vướng trường); bước setup của S2 có ô chọn đơn vị trong danh mục, chọn thì điền tên, cấp học và **mã trường gợi ý theo mã Bộ** (viết thường, khi đúng quy tắc mã trường của S1a); trang chi tiết trường gắn hoặc gỡ mã Bộ cho trường đã có; lệnh `provision --file` nhận thêm `moet_code`.

**2. Màn hình đăng nhập theo đơn vị**

- **Bố cục** (cổng quản trị, MH-47): đầu trang là tiêu đề, biểu trưng theo cấu hình; khung "Đăng nhập hệ thống" gồm phần **Thông tin đơn vị** (Sở GD&ĐT\*, Cấp học\*, Phường/Xã, Trường\*; ô chọn có tìm kiếm không phân biệt dấu, danh sách lấy theo trang từ máy chủ, "Xem thêm") và phần **Thông tin tài khoản** (tên đăng nhập, mật khẩu, mã xác thực hai lớp khi cần, mã xác nhận dạng ảnh do máy chủ sinh, "Ghi nhớ tài khoản" nhớ cả đơn vị đã chọn, "Quên mật khẩu?", nút Đăng nhập); chân trang là các dòng thông tin hỗ trợ cấu hình ở cổng nền tảng (`platform_settings.login_page`) hoặc đường dây nóng của trường.
- **Ba chế độ** theo điểm cuối `GET /auth/directory/context`:
  - **tên miền chung** (`PLATFORM_ROOT_DOMAIN`): hiện ô chọn đơn vị; chọn một trường thì tra `GET /auth/directory/unit`: đơn vị chưa khởi tạo trên nền tảng hiện "Đơn vị này chưa sử dụng hệ thống trên nền tảng..." và không gửi được; đơn vị đã khởi tạo thì lấy mã xác nhận của đúng trường, mã xác nhận luôn bắt buộc ở tên miền chung; đăng nhập `POST /auth/directory/login` chạy trong ngữ cảnh của trường (cùng bộ đếm sai, khóa tạm, chính sách mật khẩu, xác thực hai lớp như đăng nhập ở tên miền của trường); đúng thì phiên mở ở trường đó, trả **mã chuyển phiên một lần** (chỉ lưu mã băm ở `login_handoffs` của cơ sở dữ liệu định danh của trường, hạn 2 phút), trình duyệt sang `https://<tên miền của trường>/sign-in-handoff#code=...`, trang đó đổi mã lấy cookie phiên (`POST /auth/handoff/exchange`) rồi xóa mã khỏi thanh địa chỉ; "Quên mật khẩu?" dẫn sang trang quên mật khẩu ở tên miền của trường đã chọn;
  - **tên miền của trường** (tên miền con hoặc tên miền riêng): ẩn ô chọn, khung "Thông tin đơn vị" khóa vào trường (Sở, tên trường, cấp, mã Bộ nếu đã gắn, năm học); đăng nhập như cũ;
  - **chế độ một trường**: như tên miền của trường, dữ liệu lấy từ `login-info` như cũ.
- **API danh mục cho ô chọn** (dịch vụ định danh, không thuộc trường nào, chỉ phục vụ ở tên miền chung, tên miền khác 404): `departments`, `levels`, `communes?department&q&limit&offset`, `units?department&level&commune&q&limit&offset` (bắt buộc chọn sở, tối đa 50 dòng mỗi trang, chỉ trả mã, tên, xã, cấp, không trả cờ chất lượng), `unit?code`; giới hạn 120 yêu cầu đọc và 20 lần đăng nhập mỗi phút trên một địa chỉ mạng, cộng giới hạn đăng nhập theo trường đã có.
- **Ứng dụng giáo viên, phụ huynh** có màn hình đăng nhập riêng, không dùng chung trang này, nên **không đổi** ở DT-24 (ghi để không bị hỏi lại); đăng nhập theo đơn vị cho hai ứng dụng này là việc sau nếu Eric cần.
- **Cổng biên, máy chủ web:** hồ sơ thử nghiệm chuyển gốc tên miền hệ thống về `/quan-ly/` (trang đăng nhập theo đơn vị); trang chọn trường cũ của S1b vẫn ở `/api/v1/public/schools/picker`. Hồ sơ vận hành nhiều trường đã mở `/quan-ly` trên mọi tên miền đang phục vụ (khối bắt chung, `TENANT_PATHS=on`), nên trang đăng nhập theo đơn vị ở `https://<tên miền hệ thống>/quan-ly/`.

**3. Quyền vào mọi trường của quản trị nền tảng**

- **Chính sách ở mức nền tảng** `platform_settings.support_access_policy` (migration 0211 đặt mặc định): `mode` = `any_school` (mặc định theo quyết định của Eric ngày 2026-10-26) hoặc `school_grant` (chỉ khi trường cho phép, như S4); `default_hours` 2, `max_hours` 8. Đổi ở trang Danh mục đơn vị của cổng nền tảng, bắt buộc nhập lại mã xác thực hai lớp, ghi nhật ký; chuyển sang `school_grant` thì mọi phiên đang mở theo chính sách nền tảng kết thúc ngay và mở mới bị từ chối.
- **Mở phiên khi trường chưa cho phép** (dùng lại phiên hỗ trợ của S4): ở trang chi tiết trường, người vận hành ghi lý do (5 đến 500 ký tự), chọn phạm vi chỉ đọc hoặc toàn quyền, số giờ (1 đến tối đa), **nhập lại mã xác thực hai lớp ngay lúc mở** (ngoài lần đăng nhập cổng); thiếu mã thì từ chối 422, sai mã tính như nhập sai mật khẩu (khóa tạm). Phiên ghi `support_sessions.access_basis = 'platform_policy'`; đường liên kết một lần 5 phút; phiên tự hết hạn theo số giờ; mã phiên mang phạm vi như S4 (chỉ đọc thì chặn ghi).
- **Nhật ký đầy đủ, trường xem được:** nhật ký nền tảng (`support.platform-access-requested`, `support.session-started` kèm căn cứ, lý do, hạn, địa chỉ mạng), nhật ký định danh của trường (`support_start` kèm căn cứ, lý do), từng thao tác trong phiên (`support_session_actions`); trang **Cho phép hỗ trợ** của cổng quản trị liệt kê mọi phiên kèm căn cứ ("quyền quản trị nền tảng, không cần trường cho phép"), lý do, thao tác.
- **Biểu ngữ** ở mọi trang của cổng quản trị trong phiên: "Đang truy cập với quyền quản trị nền tảng: <tên> (phạm vi, đến <giờ>), lý do: ...", cho chính người vận hành và cho quản trị tài khoản của trường.
- Phiên theo cho phép của trường (S4) và phiên xem chi tiết của cấp trên (S6) giữ nguyên; căn cứ ghi `school_grant`, `access_request`.

### 16.5 Quyết định thiết kế và phương án đã loại

- **Danh mục là bảng riêng ở cơ sở dữ liệu nền tảng, không dùng `admin_units` của S6:** `admin_units` là cây quản lý cấp trên do người vận hành tự dựng (gộp, tách nút, tài khoản cấp trên); danh mục là dữ liệu tham chiếu nạp từ nguồn, khóa theo mã của nguồn, nạp lại mỗi năm học. Phương án đã loại: ghi danh mục vào cây S6 (trộn dữ liệu nguồn với cấu hình của người vận hành, gộp, tách nút làm sai mã nguồn).
- **Mã Bộ là chuỗi, không ràng buộc dạng 8 chữ số; không suy ra tỉnh từ mã:** theo báo cáo khảo sát, mã bất biến từ lần cấp đầu, có 4.333 mã không chuẩn. Phương án đã loại: chuẩn hóa hay bỏ mã lạ (mất đơn vị thật).
- **Đăng nhập ở tên miền chung rồi chuyển phiên bằng mã một lần, không đặt cookie dùng chung các tên miền:** cookie phiên của S1a là cookie cùng tên miền (SameSite=Strict); tên miền riêng của trường không chung tên miền gốc. Phương án đã loại: chọn đơn vị xong chuyển hướng sang trang đăng nhập của trường để nhập lại (hai bước, khác luồng một khung của trang mẫu); đặt cookie miền gốc (không áp dụng được cho tên miền riêng, mở rộng phạm vi cookie).
- **Mã chuyển phiên lưu ở cơ sở dữ liệu định danh của trường, không ở Redis:** kiểm tĩnh đa thuê bao cấm gọi Redis ngoài lớp hạ tầng; bảng của trường tự cách ly theo trường. Phương án đã loại: lưu mã làm mới ở Redis (lộ mã làm mới nếu Redis bị đọc).
- **Danh sách không đánh dấu đơn vị đã dùng nền tảng:** tránh lộ danh sách khách hàng; tra từng đơn vị khi chọn, có giới hạn tần suất.
- **Quyền quản trị nền tảng dùng lại phiên hỗ trợ của S4:** một đường duy nhất có đường liên kết một lần, tài khoản hỗ trợ riêng của trường (không đăng nhập bằng mật khẩu), phạm vi, nhật ký thao tác, biểu ngữ. Phương án đã loại: đăng nhập thẳng bằng tài khoản quản trị của trường (không phân biệt được người thao tác), tài khoản vận hành có quyền ở mọi cơ sở dữ liệu (vượt lớp cách ly theo trường).
- **Bắt buộc nhập lại mã xác thực hai lớp lúc mở phiên không cần đồng ý,** dù cổng đã bắt buộc xác thực hai lớp khi đăng nhập: phiên cổng có thể đang mở trên máy để quên; bước xác thực lại cho mỗi lần vào trường là bằng chứng có chủ đích.
- **Không làm ở DT-24:** đăng nhập theo đơn vị cho ứng dụng giáo viên, phụ huynh; kết nối API của hệ thống ngành (chưa có đặc tả công khai; căn cứ là Điều 14 Thông tư 42/2021/TT-BGDĐT, đầu mối Cục Công nghệ thông tin; việc này Eric quyết định); tự động cập nhật danh mục định kỳ (nạp tay mỗi năm học); cho trường tự xin đăng ký từ ô chọn.

### 16.6 Nạp danh mục khi triển khai

1. Lấy tệp danh mục ở máy của người vận hành (không qua kho mã), đúng cột: đơn vị `ma_so, ten_so, ma_cap_hoc, cap_hoc, ma_phuong_xa, ten_phuong_xa, ma_truong, ten_truong, nam_hoc`; phường xã `ma_so, ten_so, ma_phuong_xa, ten_phuong_xa`. Tệp phải giữ bước che mã trùng khuôn số căn cước như bản khảo sát.
2. Chạy thử: `pnpm --filter @school-management/database platform catalog-import --units <tệp đơn vị> --communes <tệp phường xã> --dry-run`, đọc báo cáo (số thêm, bỏ qua, cờ).
3. Nhập thật: bỏ `--dry-run`. Hoặc ở cổng nền tảng, trang Danh mục đơn vị: nạp tệp phường xã trước, rồi tệp đơn vị; chạy thử rồi nhập.
4. Mỗi năm học nạp lại cùng cách; thêm `--deactivate-missing` (hoặc tích ô tương ứng) khi muốn chuyển ngừng hoạt động các đơn vị không còn trong tệp của các sở có trong tệp.
5. Gắn trường đã khởi tạo với mã Bộ ở trang chi tiết trường (hoặc chọn từ danh mục khi khởi tạo trường mới).
6. Đặt tiêu đề, chân trang của trang đăng nhập ở tên miền chung (trang Danh mục đơn vị); kiểm tra chính sách vào trường của quản trị nền tảng đúng thỏa thuận đã ký với các trường (PL-02 Điều 5a).
7. Máy phát triển: `pnpm --filter @school-management/database platform catalog-seed` nạp từ thư mục khảo sát nếu có, không có thì bỏ qua.

### 16.7 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Dữ liệu thu thập lọt vào kho công khai | Tệp mẫu chỉ có mã 97, 98, 99xxx và tên bịa; công cụ đọc tệp ở ngoài kho; người duyệt PR rà danh sách tệp; quét bí mật của S8b vẫn chạy |
| Số căn cước của chủ nhóm trẻ lọt vào danh mục qua mã 12 chữ số | Bộ đọc loại mã đã che và mã khớp khuôn 12 chữ số bắt đầu bằng 0, báo cáo chỉ ghi `[đã che]`; kiểm thử CT-24-2 kiểm báo cáo không chứa giá trị mã |
| Mạo danh cơ quan nhà nước | Tiêu đề, biểu trưng từ cấu hình; e2e 160 kiểm trang không có chữ "Bộ Giáo dục" hay "quốc gia"; người duyệt đối chiếu |
| Lộ danh sách khách hàng qua ô chọn | Danh sách không có cờ đã dùng; tra từng đơn vị có giới hạn 120 yêu cầu mỗi phút mỗi địa chỉ; ô chọn chỉ ở tên miền chung |
| Dò mật khẩu qua tên miền chung, lách giới hạn theo trường | Mã xác nhận luôn bắt buộc; giới hạn 20 lần đăng nhập mỗi phút mỗi địa chỉ trên mọi trường cộng giới hạn theo trường; khóa tạm theo tài khoản như cũ |
| Mã chuyển phiên bị lộ hoặc dùng ở trường khác | Mã 32 byte ngẫu nhiên sau dấu `#`, chỉ lưu mã băm, hạn 2 phút, một lần, bảng ở cơ sở dữ liệu của đúng trường (trường khác không thấy), trang xóa mã khỏi lịch sử; kiểm thử CT-24-6 |
| Trang đăng nhập đổi làm hỏng các e2e đang dùng | Giữ nhãn ô, nút, mã kiểm thử cũ; chạy 01, 59 (một trường) và 130 đến 140, 160 (nhiều trường) |
| Quản trị nền tảng vào trường không đúng mục đích, trái thỏa thuận xử lý dữ liệu | Chỉ khi chính sách cho phép; xác thực hai lớp lúc mở, lý do, có hạn, phạm vi; nhật ký hai phía và từng thao tác; trường xem được; biểu ngữ; PL-02 Điều 5a ghi rõ quyền và giới hạn; chính sách đổi được sang `school_grant`; luật sư rà (GD-110) |
| Chính sách đổi sang `school_grant` mà phiên cũ vẫn chạy | Đổi chính sách kết thúc mọi phiên `platform_policy` đang mở; đổi mã chuyển phiên kiểm lại chính sách; kiểm thử CT-24-7 |
| Va số với DT-23 chạy song song | Dải DT-24 bắt đầu sau toàn bộ dải giữ của DT-23; sửa tệp chung (`application.module.ts`, `MULTI_TENANT_SPEC`, `platform-menu.ts`, schema nền tảng) theo kiểu thêm cuối; gộp `origin/main` khi PR khác gộp trước |

**Cổng kiểm của DT-24:** kiểm thử đơn vị của gói đã sửa (`database` CT-24-1 đến CT-24-4; `apps/identity` CT-24-5 đến CT-24-8 cùng phiên hỗ trợ S4 và ma trận cách ly); e2e 160 và các spec đăng nhập (01, 59 ở dự án một trường; 130 đến 140 ở dự án nhiều trường) giữ khóa `e2e.lock`; kiểm tĩnh đa thuê bao; typecheck, lint, định dạng; CI xanh toàn bộ.

### 16.8 Tiến độ

| Phần | Tiến độ |
|---|---|
| DT-24 | Đã làm trong PR "DT-24: danh mục trường toàn quốc, đăng nhập theo đơn vị, quyền quản trị nền tảng" (YCTD-220, phiên bản 0.141.0) |

### 16.9 Giả định chưa chốt, làm cấu hình được

| Mã | Mục chưa chốt | Giả định để làm | Cấu hình ở | Cần ai trả lời |
|---|---|---|---|---|
| GD-109 | Được dùng lại danh mục lấy từ trang công khai của hệ thống ngành vào phần mềm thương mại không | Chỉ dùng làm dữ liệu tham chiếu nội bộ (tên, mã đơn vị, không có dữ liệu cá nhân), không công bố lại cả danh sách, không ghi tên nguồn trên giao diện; hướng lâu dài là xin kết nối chính thức theo Điều 14 Thông tư 42/2021/TT-BGDĐT | Không | Eric, luật sư |
| GD-110 | Quản trị nền tảng vào mọi trường không cần trường đồng ý | **Eric đã chốt 2026-10-26:** mặc định `any_school`, bắt buộc xác thực hai lớp, lý do, nhật ký trường xem được, có hạn, biểu ngữ; ghi vào PL-02 Điều 5a; luật sư rà trước khi nhận dữ liệu thật | `platform_settings.support_access_policy` | Eric (đã chốt), luật sư |
| GD-111 | Tiêu đề trang đăng nhập ở tên miền chung | "Hệ thống quản lý trường học" cho đến khi Eric chốt tên sản phẩm | `platform_settings.login_page` | Eric |
| GD-112 | Cập nhật danh mục | Nạp tay mỗi năm học từ tệp người vận hành có được; chưa tự động | Không | Eric |

### 16.10 Đăng nhập kiểu SMIS và bản nhiều trường trên máy (YCTD-310)

Eric yêu cầu ngày 2026-10-28: trang đăng nhập làm tương tự trang đăng nhập của hệ thống ngành, chọn Sở → Phường → Cấp học → Trường rồi nhập tài khoản; giữ trường demo hiện có; nạp danh mục trường toàn quốc vào bản nhiều trường trên máy.

1. **Phân cấp:** danh mục của DT-24 đã là Sở → Phường/Xã (mã đơn vị hành chính cấp xã 5 chữ số sau sắp xếp năm 2025, không có cấp huyện) → Trường, cấp học là quan hệ nhiều-nhiều của trường; không phải đổi cấu trúc. Danh mục `administrative_units` trong cơ sở dữ liệu của từng trường (địa chỉ, có thời kỳ cũ và mới) là danh mục khác, không dùng cho ô chọn đơn vị.
2. **Trang đăng nhập (MH-47), thiết kế lại theo ảnh mẫu của Eric:** một thẻ trắng giữa nền xanh nhạt có chấm, tiêu đề "Đăng nhập hệ thống", mục THÔNG TIN ĐƠN VỊ và THÔNG TIN TÀI KHOẢN, hàng mã xác nhận (ô, ảnh, nút làm mới), Ghi nhớ, Quên Mật Khẩu?, nút Đăng nhập. Ở tên miền chung: Sở Giáo dục và Đào tạo → Cấp và Phường / Xã cùng hàng (phường chỉ lọc, có "Tất cả phường, xã" để bỏ lọc; điện thoại xếp dọc) → Trường; ô Cấp chỉ hiện cấp có trường trong sở (và phường nếu chọn) (`GET /api/v1/auth/directory/levels?department=&commune=`; không có tham số thì trả đủ năm cấp). Yêu cầu đầu (Sở → Phường → Cấp) được thay bằng thứ tự của ảnh mẫu. Ở tên miền của trường và chế độ một trường, mục THÔNG TIN ĐƠN VỊ chỉ đọc; mã xác nhận ở chế độ một trường vẫn hiện theo cấu hình hoặc sau lần nhập sai đầu tiên. Ô tài khoản dùng chữ gợi ý, nhãn ẩn cho trình đọc màn hình (ngoại lệ TD-02). **Ghi nhớ:** nhớ đơn vị và tên đăng nhập ở máy; máy chủ giữ phiên cổng quản trị `PORTAL_REMEMBER_DAYS` ngày (mặc định 30) bằng cookie bền, không tích thì cookie phiên; trình quản lý mật khẩu của trình duyệt đề nghị lưu mật khẩu nhờ autocomplete, trang không tự lưu mật khẩu. Không dùng quốc huy, biểu trưng, tên cơ quan nhà nước. Ứng dụng giáo viên, phụ huynh chưa có đăng nhập theo đơn vị (DT-24 chỉ làm ở cổng quản trị) nên không đổi.
3. **Bản nhiều trường trên máy:** từ ngày 2026-10-28 Eric dừng bản một trường và dùng bản nhiều trường. Cổng dải 31xx, 519x riêng, không đụng cổng chuẩn 3000, 3001, 5173… của bản một trường. Bảng địa chỉ duy nhất:

| Thành phần | Địa chỉ |
|---|---|
| Đăng nhập chọn đơn vị (tên miền chung) | `http://truong.localhost:5190/` |
| Cổng quản trị của trường demo | `http://tc.truong.localhost:5190/` |
| Ứng dụng giáo viên | `http://tc.truong.localhost:5192/` |
| Ứng dụng phụ huynh | `http://tc.truong.localhost:5193/` |
| Ứng dụng học sinh | `http://tc.truong.localhost:5194/` |
| Cổng vận hành nền tảng | `http://platform.truong.localhost:5191/` |
| Chợ gia sư | `http://cho-gia-su.truong.localhost:5195/` |
| Ứng dụng Gia sư | `http://gia-su.truong.localhost:5196/` |
| Dịch vụ định danh, máy chủ API | `127.0.0.1:3101`, `127.0.0.1:3100` |
| Tiến trình nền (xếp thời khóa biểu) | hàng đợi Redis `127.0.0.1:6379` |
| Cơ sở dữ liệu nền tảng, chợ | `school_platform` (vai trò `platform_local`), `school_marketplace` (vai trò `marketplace_local`), mật khẩu sinh ngẫu nhiên |
| Tệp môi trường | `.env.nhieu-truong` ở gốc kho (nằm trong `.gitignore`), đè biến cùng tên của `.env` |

   Chromium tự đưa mọi `*.localhost` về máy, không sửa tệp hosts. Trường mới khởi tạo ở cổng vận hành có tên miền `<mã>.truong.localhost`, dùng cùng các cổng trên. Cổng vận hành 5177 (`apps/platform` mặc định) trỏ dịch vụ định danh 3001 của bản một trường, không có nền tảng: cổng vận hành chỉ dùng ở bản nhiều trường, địa chỉ 5191.
   - Trường demo được **nhận** làm trường của nền tảng bằng `adopt-existing` (mã nền tảng `tc-demo` vì mã nền tảng cần 3 đến 32 ký tự chữ thường): dùng lại cơ sở dữ liệu định danh, hệ thống, năm học của bản một trường, không chép, không đổi tên; tài khoản, mật khẩu như bản một trường. Việc nền chạy theo giờ bật mặc định; nếu chạy lại bản một trường trên cùng cơ sở dữ liệu thì dựng lại với `--tat-viec-nen` để không chạy trùng.
   - Trường demo không có trong danh mục của Bộ: lệnh gắn một đơn vị nguồn `demo-local` (mã `DEMO-TC`, cấp Mầm non) ở sở, phường chỉ định. Nạp lại danh mục với `--deactivate-missing` sẽ chuyển đơn vị này sang ngừng hoạt động: chạy lại lệnh dựng để gắn lại.
   - Chợ gia sư: lệnh dựng tạo cơ sở dữ liệu chợ, khóa ký mã liên kết, khóa mã hóa tệp giấy tờ và bật chợ ở `cho-gia-su.truong.localhost`, ứng dụng Gia sư ở `gia-su.truong.localhost`; thu tiền thật luôn tắt (thanh toán giả lập).
4. **Cách dựng** (ở gốc kho, sau `pnpm build`; chạy lại được, giữ khoá và mật khẩu đã sinh):

```bash
pnpm --filter @school-management/database nhieu-truong-cuc-bo --school-code tc-demo --school-domain tc.truong.localhost --school-name "Trường Mầm non Trình Diễn" --units <tệp đơn vị theo cấp.csv> --communes <tệp phường xã.csv> --demo-moet-code DEMO-TC --demo-department 01 --demo-commune 00004 --demo-levels MN
```

   Tệp danh mục đọc từ đường dẫn tham số (đường dẫn tuyệt đối hoặc tính từ thư mục `database/`), không nằm trong kho (mục 16.6); tệp môi trường mặc định `../.env.nhieu-truong`, đổi bằng `--env-out`. Lệnh cần quyền tạo vai trò, cơ sở dữ liệu (`PLATFORM_ADMIN_DATABASE_URL` hoặc `POSTGRES_PASSWORD` trong `.env`), từ chối ghi tệp môi trường không nằm trong `.gitignore` và không in mật khẩu, khoá.
5. **Cách chạy:** `node scripts/chay-nhieu-truong.mjs` ở gốc kho (cần `pnpm build` trước; Ctrl+C dừng tất cả) chạy định danh, API, tiến trình nền và bảy ứng dụng web ở bảng trên, in bảng địa chỉ khi khởi động. Mở `http://truong.localhost:5190/`, chọn Sở GD&ĐT Thành phố Hà Nội → Cấp Mầm non (Phường / Xã để trống hoặc Phường Ba Đình) → Trường Mầm non Trình Diễn, nhập tài khoản của trường demo và mã xác nhận; đăng nhập đúng thì sang `http://tc.truong.localhost:5190/`.
   **Quản trị vào mọi trường:** dùng cơ chế sẵn có của DT-24, không tạo tài khoản ở từng trường. Một tài khoản vận hành nền tảng duy nhất, tên đăng nhập `Admin` (không phân biệt hoa thường; ghi ở `PLATFORM_SUPERADMIN_LOGIN` trong `.env.nhieu-truong`, mật khẩu, khóa xác thực hai lớp và mã khôi phục cũng ở tệp này), đăng nhập ở cổng vận hành `http://platform.truong.localhost:5191/` bằng mật khẩu và mã xác thực hai lớp (bắt buộc với tài khoản vận hành; khóa 15 phút sau 5 lần sai). Vào Trường, chọn trường, ở khung "Truy cập với quyền quản trị nền tảng" nhập mục đích, số giờ (tối đa 8), mã xác thực hai lớp rồi mở đường liên kết một lần sang trường. Chính sách `any_school` áp cho mọi trường, kể cả trường tạo sau; mỗi lần vào trường vẫn hỏi mã hai lớp và lý do, có hạn, ghi nhật ký ở cả hai phía (GD-110). Trên máy, cổng vận hành tạo liên kết `http://<tên miền trường>:5190/…` nhờ `VITE_SCHOOL_PORTAL_PORT` do tập lệnh chạy đặt; bản chạy thật giữ `https://`. Mật khẩu tài khoản vận hành phải từ 12 ký tự (chính sách tài khoản vận hành).
6. **Gỡ:** dừng tiến trình, xoá `.env.nhieu-truong`, `drop database school_platform`, `drop database school_marketplace`, `drop role platform_local`, `drop role marketplace_local`; cơ sở dữ liệu của trường demo không bị ảnh hưởng.
7. **Kiểm thử:** `database` CT-310-1 đến CT-310-3 (`src/local-multi-school.test.ts`); `apps/identity` CT-24-5 bổ sung ô cấp học theo phạm vi, CT-310-5 Ghi nhớ; e2e 160 (thứ tự mới, Ghi nhớ đơn vị, cookie bền), 01 (CT-310-6), 59.

## 17. DT-25: bộ nối nhà cung cấp định danh bên ngoài theo chuẩn OIDC (sẵn cho VNeID)

### 17.1 Căn cứ và mục tiêu

1. Eric yêu cầu ngày 2026-10-26: xây bộ nối nhà cung cấp định danh bên ngoài theo chuẩn OIDC để sau này cắm VNeID mà không phải sửa mã nghiệp vụ.
2. Nguồn: báo cáo khảo sát tích hợp VNeID ngày 2026-10-26 (`.claude/logs-khaosat-vneid/BAO_CAO_KHAO_SAT_VNEID.md`, ở ngoài `tai_lieu/`), mục 5 đến 7:
   - Doanh nghiệp tư nhân **không tự kết nối trực tiếp** vào hệ thống định danh và xác thực điện tử; phải qua tổ chức cung cấp dịch vụ xác thực, trên thực tế là **Trung tâm RAR (Cục C06, Bộ Công an)** theo hợp đồng. Có tiền lệ doanh nghiệp tư nhân dùng VNeID để đăng nhập một lần (FPT Life, 01/2026).
   - **Chuẩn kỹ thuật, phạm vi, tên claim, môi trường thử của RAR chưa công bố.** Vì vậy làm bộ nối OIDC chung, mọi tham số chưa biết là cấu hình, ghi rõ "chờ tài liệu RAR".
   - Rủi ro chính: dữ liệu định danh và dữ liệu trẻ em (Luật 91/2025/QH15, NĐ 356/2025/NĐ-CP; NĐ 69/2024 sửa bởi NĐ 320/2026, người dưới 14 tuổi cần người đại diện đồng ý); phụ thuộc một nhà cung cấp (giữ mật khẩu cộng xác thực hai lớp làm đường dự phòng); nhầm kênh (mã định danh học sinh trên CSDL ngành đi kênh Bộ GD&ĐT, không qua VNeID).
3. Mục tiêu: phụ huynh, giáo viên, cán bộ **đã có tài khoản** tự liên kết tài khoản với VNeID (hoặc nhà cung cấp OIDC khác nền tảng cho phép) rồi đăng nhập bằng nhà cung cấp đó; trường bật tắt; hệ thống chỉ lưu mã liên kết.
4. Liên quan quyết định cũ: DT-23 (15.1, 15.5) ghi "không làm đăng nhập Google" vì nhà trường quản tài khoản. DT-25 giữ đúng ý đó: **không tự tạo tài khoản từ nhà cung cấp ngoài**, tài khoản vẫn do trường cấp; nhà cung cấp chỉ thay bước nhập mật khẩu sau khi chính người dùng liên kết. Nền tảng không khai nhà cung cấp nào thì không có gì thay đổi.
5. Hiện trạng mã trước DT-25 (nhánh chính ngày 2026-10-26, sau PR 176): dịch vụ định danh `apps/identity` có đăng nhập mật khẩu, mã một lần, xác thực hai lớp TOTP tuỳ chọn theo trường (S8b), khóa mã hóa và khóa băm riêng từng trường do kho khóa S3 quản lý (`school_keys`, công cụ đổi khóa tự xử lý mọi cột `*_encrypted` và `*_hash` ở cơ sở dữ liệu định danh, hệ thống, năm học), nhận diện trường theo tên miền (S1a), kiểm tĩnh đa thuê bao và ma trận cách ly (14.7). Thư viện `jose` đã có trong `apps/identity`.

### 17.2 Nguyên tắc

- **Không tự tạo tài khoản.** Chỉ người đã có tài khoản tự liên kết sau khi xác nhận lại bằng **mật khẩu riêng và mã xác thực hai lớp** (nếu đã bật). Tài khoản còn dùng mật khẩu mặc định chung phải đặt mật khẩu riêng trước.
- **Lưu tối thiểu.** Chỉ lưu mã liên kết (`subject`) nhà cung cấp trả, **mã hóa bằng khóa của trường và kèm băm có khóa để tra**; không lưu số định danh, căn cước, họ tên, ngày sinh hay claim nào khác; không gọi `userinfo`. Ngày sinh (nếu nhà cung cấp trả) chỉ dùng trong yêu cầu để chặn người dưới 14 tuổi, không lưu. Nếu RAR trả số định danh làm `subject` thì vẫn chỉ ở dạng mã hóa và băm.
- **Mã nghiệp vụ không phụ thuộc nhà cung cấp.** Lớp trừu tượng `IdentityProvider`; bộ nối theo hồ sơ cấu hình (`oidc`, `vneid`); không có `if` theo tên nhà cung cấp trong luồng liên kết, đăng nhập, kiểm vai trò, nhật ký.
- **Hai lớp cấu hình:** nền tảng khai nhà cung cấp nào dùng được (và có thể cấp mã ứng dụng dùng chung); trường tự bật, chọn nhóm vai trò, có thể dùng mã ứng dụng và khóa riêng. Mặc định mọi trường **tắt**.
- **Không hạ mức bảo mật:** người đã bật xác thực hai lớp vẫn phải nhập mã sau khi đăng nhập bằng nhà cung cấp ngoài, trừ khi trường bật "coi là đạt xác thực hai lớp" và mức đảm bảo nhà cung cấp trả nằm trong danh sách nền tảng khai.
- **Đúng chuẩn OIDC:** authorization code + PKCE (S256), `state` và `nonce` dùng một lần, kiểm chữ ký `id_token` qua JWKS (chỉ thuật toán khóa bất đối xứng, không nhận `none`, `HS*`), kiểm `iss`, `aud`, `azp`, `exp`, `iat`, discovery có kiểm `issuer`, tải lại bộ khóa khi quay khóa.
- **Đa thuê bao:** cấu hình, liên kết, nhật ký ở cơ sở dữ liệu định danh của trường; `state` và vé nhập mã ở Redis theo tiền tố khóa của trường (qua `Infrastructure.scopedCache`, không ghép khóa tay); đạt kiểm tĩnh và ma trận cách ly.
- **Kiểm thử không gọi dịch vụ thật, không có khóa thật:** nhà cung cấp OIDC giả lập chạy cục bộ, khóa ký sinh mới mỗi lần chạy.

### 17.3 Phạm vi và số giữ sẵn

DT-25 là một thành phần nhỏ, làm hai bước. Số giữ sẵn nằm **sau mọi dải đã giữ** (DT-23 giữ đến YCTD-219, định danh 0129, nền tảng 0209, e2e `159-`; DT-24 dùng định danh 0130, nền tảng 0210, 0211): **YCTD-225**, migration định danh **0140, 0141** (0141 dự phòng), không dùng migration nền tảng, hệ thống, năm học; spec e2e **`165-`** (166 dự phòng). YCTD-225, định danh 0140 và e2e `165-` nằm trong khoảng DT-26 (18.3) chừa cho DT-24, DT-25. Nếu phần khác gộp trước và trùng số tài liệu (phiên bản, GD, RR) thì đánh lại theo nhánh chính lúc gộp; YCTD, migration, e2e không đổi. Khi gộp sau DT-26 và DT-27, giả định đổi thành GD-113 đến GD-115 và rủi ro thành RR-23 (khoảng hai đợt đó chừa cho DT-24, DT-25).

| Bước | Phạm vi | Phụ thuộc | Trạng thái |
|---|---|---|---|
| 25a | Phần máy chủ: lớp `IdentityProvider`, bộ nối OIDC chung, hồ sơ `vneid`, khai báo nền tảng, cấu hình của trường, liên kết, gỡ liên kết, đăng nhập, nhập mã hai lớp sau nhà cung cấp, nhật ký, nhà cung cấp OIDC giả lập, kiểm thử đơn vị, cách ly, e2e 165 (phần máy chủ), tài liệu | Không | Làm ở PR của YCTD-225 |
| 25b | Giao diện: nút "Đăng nhập bằng VNeID" (và nhà cung cấp khác) trên màn hình đăng nhập của cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh, chỉ hiện khi trường đã bật; trang quay về `/dang-nhap/ben-ngoai`; mục liên kết, gỡ liên kết, nhật ký ở "Tài khoản của tôi"; màn hình cấu hình của trường; mở rộng e2e 165 bằng trình duyệt | **Sau khi PR DT-24 gộp** (DT-24 đang sửa màn hình đăng nhập; không sửa song song cùng tệp) | Đã làm (YCTD-226) |

### 17.4 Thiết kế

**Lớp và bộ nối** (`apps/identity/src/external-identity/`):
- `identity-provider.ts`: lớp trừu tượng `IdentityProvider` (`authorizationUrl`, `exchange`), kết quả `ExternalIdentityResult` (`subject`, `assurance`, `ageYears`), tạo `state`, `nonce`, `code_verifier`.
- `oidc-provider.ts`: `OidcIdentityProvider` (discovery có bộ nhớ tạm 1 giờ và kiểm `issuer`; đổi mã bằng `client_secret_basic` hoặc `client_secret_post`; kiểm `id_token` bằng `jose` với bộ khóa JWKS từ xa, tải lại khi gặp mã khóa lạ, thời gian chờ giữa hai lần tải cấu hình được; dung sai đồng hồ 60 giây; thời gian chờ mạng 10 giây).
- `provider-profiles.ts`: khai báo của nền tảng và hồ sơ `oidc`, `vneid`; `PENDING_RAR_DOCUMENTATION` liệt kê mục của hồ sơ `vneid` đang là giả định.
- Thêm giao thức khác (nếu RAR không dùng OIDC): viết bộ nối mới theo `IdentityProvider` và thêm một dòng ở `PROVIDER_FACTORIES`; mã nghiệp vụ không đổi.

**Khai báo của nền tảng** (biến môi trường, không chứa bí mật trong JSON):
- `EXTERNAL_IDENTITY_PROVIDERS`: danh sách JSON, mỗi mục gồm `code`, `profile` (`oidc` hoặc `vneid`), `display_name`, `issuer`, `discovery` (mặc định bật) hoặc ba địa chỉ `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `client_id` dùng chung (tuỳ chọn), `scopes` (phải có `openid`), `token_auth_method`, `subject_claim`, `assurance_claim`, `birthdate_claim`, `mfa_assurance_values`, `algorithms`, `extra_authorization_parameters`, `jwks_cooldown_seconds`.
- `EXTERNAL_IDENTITY_<MÃ>_CLIENT_SECRET`: khóa bí mật dùng chung của nền tảng.
- Địa chỉ phải là `https`; `http` chỉ nhận cho máy cục bộ (bộ giả lập).
- **Hồ sơ `vneid`, chờ tài liệu RAR:** `issuer`, `discovery`, `scopes` (giả định `openid`), `token_auth_method` (giả định `client_secret_basic`), `subject_claim` (giả định `sub`), `assurance_claim` (giả định `acr`), `birthdate_claim` (giả định `birthdate`), `mfa_assurance_values`, `extra_authorization_parameters`.

**Cấu hình của trường** (`external_identity_providers`, định danh 0140): `enabled` (mặc định tắt), `client_id` và `client_secret_encrypted` riêng (mã hóa bằng khóa của trường; có cột `id` nên công cụ đổi khóa của S3 tự mã hóa lại), `allowed_roles` (trống là mặc định: mọi vai trò trừ học sinh), `satisfies_mfa` (mặc định tắt). Người có quyền `P01.account.manage` xem, sửa; mỗi lần sửa ghi `identity_audit_logs` (khóa bí mật chỉ ghi "đã đặt") và nhật ký liên kết.

**Liên kết** (`external_identities`): `provider_code`, `subject_encrypted`, `subject_hash` (HMAC-SHA256 bằng khóa băm của trường; chế độ một trường dùng khóa dẫn xuất từ `TOTP_ENCRYPTION_KEY`), `user_id`, `linked_at`, `last_login_at`; duy nhất theo (nhà cung cấp, subject) và (nhà cung cấp, tài khoản). Xóa tài khoản thì xóa liên kết.

**Nhật ký** (`external_identity_events`): `linked`, `unlinked`, `login`, `login_rejected`, `link_rejected`, `settings_updated` với lý do (`not_linked`, `invalid_id_token`, `nonce_mismatch`, `subject_linked_to_other`, `already_linked`, `session_mismatch`, `provider_disabled`, `role_not_allowed`, `under_minimum_age`, `totp_failed`...), người thực hiện, địa chỉ mạng, thời điểm. Phiên mở bằng nhà cung cấp ngoài có `login_method = 'external_provider'`.

**Luồng:**
1. Đăng nhập: `POST /auth/external/:provider/start` (`channel`, `redirect_uri`) trả `authorization_url`; nhà cung cấp chuyển về `/dang-nhap/ben-ngoai` của ứng dụng; trang đó gửi `state`, `code` lên `POST /auth/external/callback`. Kết quả `signed_in` (mã phiên, cookie làm mới như đăng nhập mật khẩu) hoặc `otp_required` kèm vé dùng 5 phút, nhập mã ở `POST /auth/external/complete` (sai 3 lần phải làm lại).
2. Liên kết: người đang đăng nhập gọi `POST /auth/external/:provider/link` kèm mật khẩu, mã hai lớp (nếu đã bật), `redirect_uri`; quay về gửi `callback` **kèm mã phiên của đúng phiên đã bắt đầu**.
3. Gỡ liên kết: `POST /auth/external/:provider/unlink` kèm mật khẩu, mã hai lớp.
4. Xem: `GET /auth/external/providers` (công khai, nút trên màn hình đăng nhập), `GET /auth/external/links`, `GET /auth/external/events` (của chính người dùng), `GET /auth/external/settings`, `PUT /auth/external/settings/:provider` (quản lý tài khoản).
5. Địa chỉ quay về: tuyệt đối, cùng tên miền với yêu cầu, đường dẫn kết thúc bằng `/dang-nhap/ben-ngoai`, không có tham số; nhà cung cấp còn so với địa chỉ đã đăng ký.
6. Điều kiện khi đăng nhập: nền tảng đã khai và trường đang bật (kiểm lại lúc quay về, nên trường tắt giữa chừng thì lượt dở dang bị từ chối); tài khoản còn hiệu lực, không khóa; có ít nhất một vai trò trong nhóm được dùng; người có vai trò học sinh (VT-21 của 23a) chỉ khi trường cho vai trò học sinh và nhà cung cấp trả ngày sinh đủ 14 tuổi; bất kỳ ai nhà cung cấp trả ngày sinh dưới 14 tuổi đều bị từ chối.

### 17.5 Quyết định thiết kế và phương án đã loại

- **Khai báo nền tảng bằng biến môi trường, cấu hình trường bằng bảng:** hợp đồng với RAR là của doanh nghiệp vận hành nền tảng (báo cáo khảo sát mục 6), mã ứng dụng dùng chung là bí mật cấp nền tảng như các khóa khác (QU-05), chạy được cả chế độ một trường lẫn nhiều trường; phương án đã loại: bảng ở cơ sở dữ liệu nền tảng có màn hình ở cổng nền tảng (chế độ một trường không có cơ sở dữ liệu nền tảng; khi cần màn hình thì thêm sau, không đổi mã nghiệp vụ).
- **Lưu subject mã hóa kèm băm có khóa thay vì bản rõ:** tra được, đổi khóa theo S3 được, và không lộ số định danh nếu RAR trả số định danh làm subject; phương án đã loại: lưu bản rõ (rủi ro nếu subject là số định danh), chỉ lưu băm (không tính lại được khi đổi khóa của trường).
- **Vé nhập mã hai lớp sau nhà cung cấp:** giữ nguyên mức bảo mật của S8b; phương án đã loại: luôn coi nhà cung cấp ngoài là đạt xác thực hai lớp (chưa biết mức đảm bảo của RAR).
- **Lượt liên kết gắn với phiên đã bắt đầu:** chống kẻ xấu gửi đường dẫn quay về chứa định danh của mình để gắn vào tài khoản nạn nhân (tấn công giả yêu cầu đăng nhập).
- **Không làm ở DT-25:** tự tạo tài khoản từ nhà cung cấp ngoài; lưu số định danh, căn cước; đăng xuất một lần (single logout) với nhà cung cấp; xác minh danh tính khi tuyển sinh (báo cáo mục 5.2; làm sau khi có hợp đồng RAR); liên kết mã định danh học sinh trên CSDL ngành (đi kênh Bộ GD&ĐT); màn hình khai báo nhà cung cấp ở cổng nền tảng.

### 17.6 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Giả mạo `id_token` hoặc dùng lại mã của lượt khác | Kiểm chữ ký qua JWKS, `iss`, `aud`, `azp`, `exp`, `nonce`; `state` dùng một lần; PKCE S256; kiểm thử chữ ký sai, nonce sai, sai đối tượng, sai bên phát hành, hết hạn, dùng lại state |
| Gắn định danh của người khác vào tài khoản | Liên kết cần mật khẩu, mã hai lớp và đúng phiên đã bắt đầu; subject đã liên kết với người khác bị từ chối (409); kiểm thử ba ca |
| Lộ số định danh hoặc dữ liệu cá nhân | Không gọi `userinfo`, chỉ lưu subject mã hóa và băm có khóa; ngày sinh không lưu; kiểm thử dữ liệu lưu không chứa subject bản rõ |
| Trẻ dưới 14 tuổi tự đăng nhập bằng VNeID | Mặc định không cho vai trò học sinh; học sinh chỉ khi trường cho và nhà cung cấp trả ngày sinh đủ 14 tuổi; ngày sinh dưới 14 tuổi luôn bị từ chối; kiểm thử |
| Lẫn liên kết, cấu hình giữa các trường | Cơ sở dữ liệu định danh theo trường, khóa băm theo trường, Redis theo tiền tố của trường; kiểm thử cách ly hai trường, ma trận cách ly, kiểm tĩnh |
| Nhà cung cấp quay khóa ký | Tải lại JWKS khi gặp mã khóa lạ; kiểm thử quay khóa với bộ giả lập |
| Tham số RAR khác giả định | Mọi tham số là cấu hình, có danh sách "chờ tài liệu RAR"; nếu không phải OIDC thì viết bộ nối mới theo `IdentityProvider` |
| VNeID gián đoạn | Đăng nhập mật khẩu và xác thực hai lớp luôn còn; nhà cung cấp ngoài chỉ là đường thêm |

**Cổng kiểm của DT-25:** kiểm thử đơn vị `apps/identity` (ca mới, các ca đăng nhập, xác thực hai lớp, nhiều trường, ma trận cách ly) đạt không sửa kỳ vọng cũ; e2e 165 cùng spec đăng nhập 01, 07 đạt (chạy riêng, giữ khóa `e2e.lock`); kiểm tĩnh đa thuê bao, typecheck, lint, build đạt; CI xanh toàn bộ.

### 17.7 Tiến độ

| Bước | Tiến độ |
|---|---|
| 25a | Đã làm ở PR của YCTD-225 |
| 25b | Đã làm ở PR của YCTD-226 (phiên bản 0.147.0) |

### 17.8 Giả định chưa chốt, làm cấu hình được

| Mã | Mục chưa chốt | Giả định để làm | Cấu hình ở | Cần ai trả lời |
|---|---|---|---|---|
| GD-113 | Giao thức và tham số kỹ thuật của RAR | OIDC, discovery, phạm vi `openid`, subject ở `sub`, mức đảm bảo ở `acr`, ngày sinh ở `birthdate` | `EXTERNAL_IDENTITY_PROVIDERS` | Trung tâm RAR (qua văn bản Eric gửi) |
| GD-114 | Đăng nhập VNeID có được coi là đạt xác thực hai lớp | Không, trừ khi trường bật và mức đảm bảo nằm trong danh sách nền tảng khai | `satisfies_mfa`, `mfa_assurance_values` | Eric, sau khi có tài liệu RAR |
| GD-115 | Nhóm vai trò được dùng mặc định | Mọi vai trò trừ học sinh (phụ huynh, giáo viên, cán bộ) | `allowed_roles` của trường | Eric |

## 18. DT-26: ứng dụng web cài được (PWA), bố cục máy tính bảng, ứng dụng cài đặt iOS và Android (26a đến 26h)

Mục 16 và 17 dành cho DT-24 (danh mục trường, đăng nhập kiểu SMIS) và DT-25 (bộ nối nhà cung cấp định danh), do các đợt đó ghi khi gộp; DT-26 ghi ở mục 18 để không va số mục với hai đợt đang chạy.

### 18.1 Căn cứ và mục tiêu

1. Nguồn: **yêu cầu của Eric ngày 2026-10-26**, làm theo thứ tự (1) ứng dụng web cài được (PWA) → (2) bố cục máy tính bảng → (3) ứng dụng cài đặt iOS và Android. Ba bước thành ba đợt; đợt sau dùng lại phần của đợt trước.
2. Mục tiêu:
   - **Đợt 1, PWA:** ứng dụng giáo viên, ứng dụng phụ huynh và màn hình học sinh của 23a **cài được lên màn hình chính** với tên, biểu tượng, màn hình chờ theo thương hiệu từng trường; một service worker dùng chung; **thông báo đẩy qua Web Push** nối vào hàng đợi thông báo chung, người dùng tắt được theo loại.
   - **Đợt 2, máy tính bảng:** ứng dụng giáo viên có chế độ lớp học trên máy tính bảng hoặc màn hình lớn; ứng dụng phụ huynh dùng tốt ở máy tính bảng; cổng quản trị và cổng nền tảng có bố cục máy tính bảng; kiểm thử giao diện chạy thêm ở khổ điện thoại và máy tính bảng; đạt yêu cầu truy cập về vùng chạm và cỡ chữ.
   - **Đợt 3, ứng dụng cài đặt:** một ứng dụng iOS và Android đóng gói bằng Capacitor **từ chính mã web** của ứng dụng giáo viên và phụ huynh, thông báo đẩy native qua FCM và APNs dùng chung bộ phát của đợt 1, chọn trường khi mở lần đầu, liên kết sâu, mở khóa phiên bằng sinh trắc học, dựng và ký trên CI, quy trình phát hành và hồ sơ cửa hàng.
3. Đổi quyết định cũ: mục 14.6 và 15.5 ghi "ứng dụng di động gốc" là phương án đã loại. **Eric yêu cầu ứng dụng cài đặt ngày 2026-10-26**; câu ở 14.6, 15.5 được đánh dấu cập nhật và trỏ về mục này. Hướng làm vẫn giữ tinh thần cũ: không viết ứng dụng gốc thứ hai, chỉ đóng gói mã web hiện có (18.5).
4. Hiện trạng mã (đọc trên nhánh chính ngày 2026-10-26, sau PR 177) và phần đang làm song song:
   - **Ứng dụng giáo viên và phụ huynh** (`apps/teacher`, `apps/parent`): React 19, Vite, Tailwind 4; thiết kế cho điện thoại, bố cục một cột (`max-w-md`, `max-w-lg`), có thẻ viewport; **chưa có manifest, service worker, thông báo đẩy** trên nhánh chính. Đường dẫn `/giao-vien/`, `/phu-huynh/` trên tên miền của trường (14.4).
   - **23b (đang làm, YCTD-212)** thêm `apps/teacher/public/sw.js` viết tay (bộ nhớ đệm theo bản dựng, không giữ lời gọi `/api`, hỏi giáo viên trước khi tải lại bản mới), `manifest.webmanifest` và biểu tượng tĩnh, bản chụp danh sách lớp lưu trên máy xóa khi đăng xuất. **DT-26 gom phần này về gói chung, không viết lại** (26a).
   - **23a (đang làm, YCTD-211)** thêm kênh phiên `student` và màn hình học sinh **trong ứng dụng phụ huynh**; PWA của ứng dụng phụ huynh vì thế phủ cả màn hình học sinh.
   - **DT-24 (đang làm)** đổi màn hình đăng nhập và thêm danh mục trường toàn quốc ở cơ sở dữ liệu nền tảng; **DT-25 (đang làm)** thêm đăng nhập bằng nhà cung cấp định danh (OIDC, sẵn cho VNeID). Đợt 3 dùng danh mục của DT-24 cho bước chọn trường và luồng của DT-25 cho đăng nhập trong ứng dụng cài đặt.
   - **Thương hiệu trường (S3):** `school_branding` (tên hiển thị, màu chủ đạo, logo), điểm cuối công khai `/api/v1/public/branding` và `/api/v1/public/branding/logo`.
   - **Hàng đợi thông báo chung:** `queueNotification` ghi `notifications` và `notification_recipients` (năm học); tiến trình `notification-dispatch` gửi theo kênh `in_app`, `sms`, `zalo` (`NotificationChannel`), thử lại 15 phút tối đa 5 lần; chạy theo từng trường qua bộ lập lịch của S1b. **Chưa có kênh đẩy** (tài liệu 34 ghi "Ứng dụng là web, không có vỏ di động").
   - **Cổng quản trị và cổng nền tảng** (`apps/portal`, `apps/platform`): co giãn một phần, thiết kế cho máy tính; bảng dữ liệu (`DataGrid`), bố cục biểu mẫu (`FormLayout`), đầu trang (`ApplicationHeader`) nằm ở `packages/ui` dùng chung.
   - **Kiểm thử giao diện:** Playwright chỉ có một dự án `chromium` khổ máy tính (`tests/playwright.config.ts`); sau PR 177 kiểm thử giao diện chạy ở việc riêng `kiem-thu-giao-dien` của `ci.yml`, kiểm thử nhiều trường ở `kiem-thu-nhieu-truong`; spec lớn nhất trên nhánh chính là `140-`, DT-23 giữ `150-` đến `159-`.

### 18.2 Nguyên tắc

- **Một mã web, nhiều cách phát:** trình duyệt, PWA cài lên màn hình chính, ứng dụng cài đặt đều chạy cùng mã `apps/teacher`, `apps/parent`; phần riêng của từng cách phát nằm sau một lớp mỏng (phát hiện đang chạy trong Capacitor hay trình duyệt), không rẽ nhánh mã nghiệp vụ.
- **Dùng lại, không dựng song song:** service worker và manifest của 23b gom về gói chung; thông báo đẩy là **một kênh mới của hàng đợi thông báo chung** (một bộ phát, nhiều bộ nối `web-push`, `fcm`, `apns`, `development`), không dựng hàng đợi thứ hai; thương hiệu lấy từ S3; chọn trường dùng danh mục của DT-24; đăng nhập qua nhà cung cấp định danh dùng luồng của DT-25.
- **Không đổi hành vi các phần đã có:** toàn bộ e2e và kiểm thử đơn vị hiện có vẫn đạt không sửa kỳ vọng; người không cài, không bật thông báo đẩy dùng như hôm nay; bố cục điện thoại giữ nguyên ở khổ điện thoại.
- **Chạy được ở cả hai bố cục cơ sở dữ liệu `database` và `schema`, chế độ một trường lẫn nhiều trường:** bảng mới nằm ở cơ sở dữ liệu của trường (hệ thống, năm học, định danh) hoặc nền tảng; khóa Redis, tệp đi qua `cacheKey`, `storageKey`; **đạt kiểm tĩnh đa thuê bao** (14.2, 14.7); ma trận cách ly tự liệt kê tuyến mới.
- **Chạy được trên tên miền con và tên miền riêng của từng trường:** manifest, service worker, đăng ký đẩy gắn với **nguồn gốc (origin) của trường**, không ghi cứng tên miền; mỗi trường một nguồn gốc nên bộ nhớ đệm, IndexedDB, đăng ký đẩy tự tách theo trường (14.6).
- **Dữ liệu trên máy tối thiểu:** bộ nhớ đệm ngoại tuyến chỉ giữ vỏ ứng dụng và tệp tĩnh, **không giữ phản hồi `/api`**; dữ liệu ngoại tuyến của 23b giữ nguyên giới hạn GD-108; **đăng xuất thì xóa** bộ nhớ đệm có dữ liệu người dùng, IndexedDB, hủy đăng ký đẩy ở máy và ở máy chủ; **không lưu mật khẩu** ở bất kỳ đâu trên máy.
- **Nội dung đẩy không chứa dữ liệu cá nhân:** thông báo đẩy đi qua máy chủ của Google, Apple, Mozilla (ở nước ngoài), nên nội dung chỉ gồm tiêu đề theo loại và tên trường; họ tên trẻ, số tiền, điểm, sức khỏe chỉ hiện khi mở ứng dụng (đã đăng nhập).
- **Khóa ký và tài khoản nhà phát triển chỉ ở secrets:** không commit khóa ký, tệp chứng chỉ, khóa APNs, tệp dịch vụ Firebase, khóa VAPID riêng; kiểm thử dùng bộ nối giả lập và khóa sinh lúc chạy.
- **Văn bản gốc trước khi viết điều khoản:** phần 26h đọc toàn văn văn bản còn hiệu lực lúc làm (dự kiến Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, Nghị định 356/2025/NĐ-CP; văn bản về cung cấp ứng dụng trên mạng, dự kiến Nghị định 147/2024/NĐ-CP) và chính sách hiện hành của App Store, Google Play; ghi số hiệu, ngày đọc vào YCTD; tài liệu do Claude soạn là bản nháp để luật sư của Eric rà.

### 18.3 Các phần

Số giữ sẵn bắt đầu **sau dải của DT-23 và các số DT-24, DT-25 đang dùng trên nhánh làm việc** (DT-24: YCTD-220, định danh 0130, nền tảng 0210, 0211; DT-25: định danh 0140), chừa khoảng trống cho bổ sung của hai đợt đó (YCTD-221 đến YCTD-229, định danh 0141 đến 0159, nền tảng 0212 đến 0229, e2e `160-` đến `179-`): YCTD-230 dành cho chính bản kế hoạch này, các phần YCTD-231 đến YCTD-238, YCTD-239 đến YCTD-244 dự phòng; migration hệ thống từ 0090, năm học từ 0140, định danh từ 0160, nền tảng từ 0230; spec e2e từ `180-`. **Phiên điều phối kiểm lại** khi giao phần: nếu DT-24, DT-25 đã gộp dùng số nằm trong dải này thì dời phần của DT-26 lên số dự phòng và ghi vào YCTD của phần.

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD giữ sẵn | Migration giữ sẵn | e2e giữ sẵn |
|---|---|---|---|---|---|---|
| 26a | Vỏ PWA dùng chung: gói `packages/pwa` (đăng ký service worker, chiến lược bộ nhớ đệm, cập nhật phiên bản, xóa khi đăng xuất, nhận thông báo đẩy ở service worker), dời service worker và manifest của 23b về gói chung; manifest, biểu tượng, màn hình chờ theo thương hiệu từng trường (điểm cuối công khai sinh từ `school_branding`); cài lên màn hình chính, hướng dẫn cài cho iOS và trình duyệt trong ứng dụng (Zalo, Facebook); áp cho ứng dụng giáo viên, ứng dụng phụ huynh (gồm màn hình học sinh của 23a) | 1 | 23b đã gộp (gom service worker của 23b); 23a đã gộp hoặc gộp trước 26a (màn hình học sinh) | YCTD-231 | Hệ thống 0090 | 181 |
| 26b | Thông báo đẩy Web Push: kênh `push` của hàng đợi thông báo chung, bộ nối `PushSender` (`web-push` theo VAPID, `development` giả lập; chừa `fcm`, `apns` cho 26g), đăng ký theo người dùng và thiết bị, tuỳ chọn tắt theo loại thông báo, khóa VAPID của nền tảng lưu mã hóa, gửi lại và dọn đăng ký hỏng; màn hình bật tắt ở ứng dụng giáo viên, phụ huynh; kiểm cách ly đăng ký giữa các trường | 1 | DT-SaaS (S1a, S1b, S3 đã gộp); phần nối giao diện mở PR sau khi 26a gộp | YCTD-232 | Hệ thống 0091, 0092; năm học 0140; nền tảng 0230 | 182 (cách ly ở nhiều trường: mở rộng `MULTI_TENANT_SPEC`, ở đợt 1 chỉ 26b sửa) |
| 26c | Khung kiểm thử theo khổ thiết bị: dự án Playwright `dien-thoai` (390 × 844), `may-tinh-bang-doc` (820 × 1180), `may-tinh-bang-ngang` (1180 × 820), thêm WebKit cho khổ điện thoại khi chạy đủ; nhãn `@thiet-bi` chọn spec; việc CI riêng `kiem-thu-thiet-bi` (yêu cầu kéo chạy tập con, nhánh chính và hằng đêm chạy đủ, chia mảnh); bộ kiểm vùng chạm 44 px, cỡ chữ, axe-core; ảnh chụp tham chiếu | 1 | PR 177 (đã gộp); chạy ngay | YCTD-233 | Không | 180 |
| 26d | Bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh: chế độ lớp học (sổ đầu bài, điểm danh, công cụ lớp học của 23b, trò chơi của 23c khi đã có) chia hai khung ở máy tính bảng ngang, chế độ trình chiếu lên màn hình lớn; ứng dụng phụ huynh hai cột ở máy tính bảng; vùng chạm, cỡ chữ | 2 | 26a, 26c đã gộp; 23b đã gộp | YCTD-234 | Không | 183 |
| 26e | Bố cục máy tính bảng của cổng quản trị và cổng nền tảng: thanh điều hướng thu gọn thành biểu tượng hoặc ngăn kéo, `DataGrid` cuộn ngang có cột đầu cố định hoặc dạng thẻ, `FormLayout` hai cột, hộp thoại toàn màn hình ở khổ hẹp; vùng chạm, cỡ chữ; sửa `packages/ui` | 2 | 26c đã gộp | YCTD-235 | Không | 184 |
| 26f | Ứng dụng cài đặt: vỏ Capacitor `apps/mobile` (một ứng dụng, chọn vai trò giáo viên hoặc phụ huynh), đóng gói mã dựng của `apps/teacher`, `apps/parent`; chọn trường khi mở lần đầu từ danh mục của DT-24 (nhiều trường được); đăng nhập kiểu ứng dụng gốc (mã làm mới lưu ở Keychain, Keystore sau sinh trắc học, không lưu mật khẩu; nhà cung cấp định danh của DT-25 qua trình duyệt hệ thống); liên kết sâu; chặn phiên bản quá cũ | 3 | 26a, 26b, 26d đã gộp; DT-24 (danh mục), DT-25 (định danh) đã gộp | YCTD-236 | Định danh 0160, 0161; nền tảng 0231 | 185 |
| 26g | Thông báo đẩy native: bộ nối `fcm` (Android) và `apns` (iOS) của `PushSender` dùng chung bộ phát 26b; đăng ký mã thiết bị qua cùng điểm cuối; khóa FCM, APNs của nền tảng lưu mã hóa; mở đúng màn hình khi chạm thông báo | 3 | 26b, 26f đã gộp | YCTD-237 | Hệ thống 0093; nền tảng 0232 | 186 (chỉ 26g sửa `MULTI_TENANT_SPEC` ở đợt 3) |
| 26h | Ký và dựng bản trên CI (GitHub Actions, Android trên Ubuntu, iOS trên macOS, chỉ chạy khi gắn thẻ phát hành hoặc chạy tay), quy trình phát hành (thử nội bộ, TestFlight, thử kín Google Play, phát hành theo tỷ lệ), hồ sơ cửa hàng (mô tả, ảnh chụp bằng dữ liệu giả, tài khoản trình diễn), chính sách quyền riêng tư và biểu mẫu khai báo dữ liệu của App Store, Google Play (`33_HO_SO_PHAP_LY/`), hướng dẫn việc Eric phải làm | 3 | 26f đã gộp (phần dựng bản); phần hồ sơ pháp lý làm được ngay khi đợt 3 mở | YCTD-238 | Không | Không |

Giữ chỗ chưa giao: YCTD-239 đến YCTD-244, hệ thống 0094 đến 0099, năm học 0141 đến 0149, định danh 0162 đến 0169, nền tảng 0233 đến 0239, e2e `187-` đến `189-` dự phòng cho bổ sung của DT-26.

Đợt làm, mỗi lúc tối đa ba phiên, **không hai phiên cùng sửa một tệp lõi trong cùng đợt**:
- **Đợt 1 (PWA): 26a, 26b, 26c.** 26a sở hữu `packages/pwa` (mới), `apps/teacher` và `apps/parent` phần `index.html`, `vite.config.ts`, `main.tsx`, `public/`, điểm cuối công khai manifest và biểu tượng ở `apps/api/src/school-settings/`; 26b sở hữu `apps/api/src/notifications/`, `NotificationChannel` (`database/school-year/schema.ts`), bảng đăng ký đẩy (`database/system/`), khóa VAPID (`database/platform/`), `MULTI_TENANT_SPEC`; mã nhận đẩy ở service worker do 26b viết **trong thư mục riêng** `packages/pwa/src/push/` mà 26a không sửa, còn màn hình bật tắt ở hai ứng dụng nối sau khi 26a gộp (26b gộp `origin/main` rồi mới mở PR phần giao diện); 26c chỉ sửa `tests/playwright.config.ts`, thêm spec `180-` và việc mới trong `.github/workflows/ci.yml` (26a, 26b không sửa `ci.yml`, `playwright.config.ts`). Đăng ký thêm mô-đun, tuyến chỉ theo kiểu **thêm cuối tệp** (`application.module.ts`).
- **Đợt 2 (máy tính bảng): 26d, 26e.** 26d chỉ sửa `apps/teacher`, `apps/parent` (thành phần cần dùng chung thì đặt tạm trong ứng dụng, không sửa `packages/ui`); 26e sở hữu `packages/ui`, `apps/portal`, `apps/platform`. Hai phần cùng thêm spec có nhãn `@thiet-bi` vào tập chạy ở yêu cầu kéo bằng danh sách trong spec của mình, không sửa cấu hình của 26c.
- **Đợt 3 (ứng dụng cài đặt): 26f trước; 26g và 26h khi 26f đã gộp.** 26h làm ngay phần hồ sơ pháp lý, mô tả cửa hàng (chỉ sửa `tai_lieu/33_HO_SO_PHAP_LY/`) song song với 26f; phần quy trình dựng bản (`.github/workflows/ung-dung-di-dong.yml` mới, `apps/mobile/fastlane/`) làm sau khi 26f gộp. 26g sửa `apps/api/src/notifications/` phần bộ nối, `apps/mobile/src/push/` (thư mục riêng), cấu hình đẩy trong dự án Android và iOS do 26f tạo. **Đợt 3 sửa dịch vụ định danh** (`authentication.service.ts`, `access-token.ts`, `database/identity/`): chỉ bắt đầu khi DT-24, DT-25 đã gộp, không chạy song song với phần khác sửa định danh.

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH, PQ, mã chức năng): theo thứ tự xong; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. YCTD, số migration, số e2e giữ sẵn ở bảng trên không đổi theo thứ tự gộp.

Cỡ ước lượng (một phần của DT-16 là một đơn vị, chỉ để so sánh): 26a 1,0; 26b 1,0; 26c 0,5; 26d 1,0; 26e 1,0; 26f 1,5; 26g 0,75; 26h 1,0; tổng khoảng 7,75 đơn vị.

**Điều kiện ra của từng đợt** (nghiệm thu với Eric):
- **Đợt 1:** ứng dụng giáo viên và ứng dụng phụ huynh của hai trường thử (một tên miền con, một tên miền riêng) cài được lên màn hình chính Android (Chrome) và iOS (Safari 16.4 trở lên) với tên, biểu tượng, màu của đúng trường; mở lại khi mất mạng thấy vỏ ứng dụng và trang công cụ lớp học (23b), các phân hệ khác báo cần mạng; bản mới phát hành thì ứng dụng hỏi tải lại; một thông báo của hàng đợi chung đến được máy đã bật đẩy (bộ giả lập trong kiểm thử, máy thật khi Eric thử), tắt loại đó thì không đến; đăng xuất thì máy không nhận đẩy của người cũ; kiểm thử cách ly đạt ở cả hai bố cục.
- **Đợt 2:** các spec `@thiet-bi` đạt ở ba khổ; không có nút, ô nhập dưới 44 × 44 px ở màn hình đã rà; giáo viên làm trọn một tiết trên máy tính bảng ngang (điểm danh, ghi sổ đầu bài, gọi tên, đếm ngược); cổng quản trị dùng được ở 820 × 1180 không cuộn ngang cả trang; thời gian CI của yêu cầu kéo không tăng quá 5 phút so với sau PR 177.
- **Đợt 3:** bản Android và iOS dựng, ký được trên CI (khi có secrets của Eric) và cài được qua thử nội bộ, TestFlight; chọn trường, đăng nhập, mở khóa bằng sinh trắc học, nhận đẩy qua FCM và APNs, chạm thông báo mở đúng màn hình; liên kết sâu mở đúng màn hình; hồ sơ quyền riêng tư và biểu mẫu khai báo dữ liệu có bản nháp để luật sư rà; nộp được bản đầu tiên lên hai cửa hàng (việc nộp do Eric bấm).

### 18.4 Phạm vi chi tiết

**26a. Vỏ PWA dùng chung**
- **Gói `packages/pwa`:** đăng ký service worker theo phạm vi của từng ứng dụng (`/giao-vien/`, `/phu-huynh/`), báo có bản mới, hỏi người dùng rồi mới tải lại (giữ cách của 23b), xóa dữ liệu khi đăng xuất, phát hiện chế độ cài đặt (`display-mode: standalone`), chạy trong Capacitor hay trình duyệt (để đợt 3 dùng lại). Công cụ dựng service worker chọn lúc làm (viết tay như 23b hoặc thư viện mã nguồn mở có giấy phép cho phép dùng thương mại), ghi giấy phép vào YCTD.
- **Chiến lược bộ nhớ đệm:** tệp dựng có mã băm giữ sẵn khi cài (precache theo danh sách của bản dựng); trang `index.html` lấy mạng trước, mất mạng dùng bản giữ; biểu tượng, logo trường lấy bộ nhớ đệm trước rồi làm mới nền; **mọi lời gọi `/api/` đi thẳng ra mạng, không giữ** (dữ liệu ngoại tuyến của 23b vẫn do ứng dụng giữ ở IndexedDB như GD-108). Tên bộ nhớ đệm có tiền tố theo ứng dụng và phiên bản bản dựng.
- **Cập nhật phiên bản:** mã bản dựng nhúng vào service worker; bản mới cài ở nền, hiện thanh "Có bản mới, tải lại"; bản đang dùng quá cũ so với máy chủ (máy chủ trả phiên bản tối thiểu của giao diện ở `/api/v1/health` hoặc tiêu đề phản hồi) thì bắt tải lại; xóa bộ nhớ đệm của bản cũ khi bản mới chạy. Dùng chung cho ứng dụng cài đặt ở đợt 3 (bản đóng gói quá cũ thì báo cập nhật ở cửa hàng).
- **Gom phần của 23b:** dời `apps/teacher/public/sw.js` và cơ chế thay danh sách tệp lúc dựng vào gói chung; trang công cụ lớp học vẫn mở được khi mất mạng như 23b đã nghiệm thu (spec `151-` đạt không sửa kỳ vọng).
- **Manifest theo trường:** `index.html` trỏ tới manifest do máy chủ sinh theo trường đang phục vụ (ví dụ `/api/v1/public/pwa/teacher.webmanifest`, `/api/v1/public/pwa/parent.webmanifest`): `name` là tên hiển thị của trường kèm tên ứng dụng, `short_name` ngắn (cột mới `school_branding.app_short_name`, hệ thống 0090, mặc định cắt từ tên hiển thị), `theme_color` và `background_color` từ màu chủ đạo, `id`, `start_url`, `scope` theo đường dẫn ứng dụng, `display: standalone`. Hai ứng dụng trên cùng tên miền có `id` khác nhau nên cài được cả hai.
- **Biểu tượng và màn hình chờ:** sinh từ logo trường ở các cỡ 192, 512, biểu tượng vừa khung (maskable), biểu tượng Apple 180; màn hình chờ Android lấy từ manifest; màn hình chờ iOS (`apple-touch-startup-image`) sinh theo vài khổ máy phổ biến; ảnh sinh một lần khi đổi logo, lưu ở kho tệp qua `storageKey`, có bản mặc định của sản phẩm khi trường chưa có logo; thẻ `<meta>` màu và tên cho iOS chèn lúc phục vụ trang hoặc lấy động.
- **Cài lên màn hình chính:** Android, máy tính dùng sự kiện cài đặt của trình duyệt, hiện nút "Cài ứng dụng" ở trang chủ và trang thông báo (không hiện lại khi người dùng đã từ chối trong 30 ngày); **iOS không có sự kiện cài đặt** nên hiện tấm hướng dẫn từng bước (nút Chia sẻ, "Thêm vào MH chính") khi mở bằng Safari và chưa cài; mở trong trình duyệt trong ứng dụng (Zalo, Facebook, Messenger, thường gặp khi liên kết gửi qua nhóm Zalo) thì hướng dẫn mở bằng Safari hoặc Chrome. Văn bản hướng dẫn đặt trong tài liệu hướng dẫn sử dụng.
- **Tên miền:** manifest, service worker, biểu tượng đều theo nguồn gốc đang phục vụ; trường đổi từ tên miền con sang tên miền riêng thì bản đã cài ở nguồn gốc cũ thấy thông báo chuyển và hướng dẫn cài lại (nguồn gốc cũ chuyển hướng như 14.4).

**26b. Thông báo đẩy Web Push**
- **Kênh `push`:** thêm `push` vào `NotificationChannel` (năm học 0140); mỗi sự kiện đang gửi `in_app` sẽ thêm người nhận kênh `push` khi người nhận có ít nhất một đăng ký đẩy còn hiệu lực và chưa tắt loại đó; tiến trình `notification-dispatch` gửi qua `PushSender`, cùng cơ chế khóa dòng, thử lại 15 phút tối đa 5 lần, ghi `delivered_via`; **không tính vào giới hạn 5 tin nhắn mỗi ngày** (đẩy không tốn tiền), có giới hạn riêng chống dồn dập (cấu hình, mặc định gộp nhiều thông báo cùng loại trong 5 phút thành một).
- **Bộ nối `PushSender`:** `web-push` (giao thức Web Push, mã hóa nội dung theo chuẩn, khóa VAPID), `development` (giả lập, ghi lại để kiểm thử đọc), chừa `fcm`, `apns` cho 26g; chọn bằng cấu hình, **không có `if` theo nhà cung cấp trong mã nghiệp vụ**; đăng ký trả lỗi hết hạn (404, 410) thì đánh dấu thu hồi.
- **Đăng ký theo người dùng và thiết bị** (`push_subscriptions`, hệ thống 0091): người dùng, ứng dụng (`teacher`, `parent`, `student`), loại (`web_push`, chừa `fcm`, `apns`), địa chỉ đăng ký và khóa **lưu mã hóa bằng khóa của trường** (bọc ở S1a) kèm mã băm để chống trùng, nguồn gốc lúc đăng ký, nhãn thiết bị ngắn do người dùng đặt hoặc tự sinh (loại máy, trình duyệt, không lưu toàn chuỗi nhận dạng trình duyệt), lần thấy gần nhất, số lần lỗi, thời điểm thu hồi. Một người nhiều thiết bị; một thiết bị dùng chung đổi người thì đăng ký cũ bị thu hồi khi đăng xuất. Đăng ký quá 90 ngày không thấy (cấu hình) thì dọn.
- **Tuỳ chọn tắt theo loại** (`notification_preferences`, hệ thống 0092): nhóm loại thông báo cố định, ánh xạ từ `template_code` (thông báo chung của trường, điểm danh và đón trả, học phí, sức khỏe và thuốc, học tập và điểm, thi trực tuyến, tin nhắn, công việc của giáo viên); mặc định bật; người dùng tắt theo nhóm cho kênh đẩy; thông báo khẩn của trường (loại do quản trị trường đánh dấu) không tắt được. Màn hình "Cài đặt thông báo" ở ứng dụng giáo viên và phụ huynh: bật đẩy trên máy này (xin quyền chỉ sau khi người dùng bấm), danh sách máy đã đăng ký và nút gỡ, công tắc theo nhóm.
- **Khóa VAPID:** một cặp khóa của nền tảng (nền tảng 0230, lưu mã hóa ở cơ sở dữ liệu `platform`, không xuống cơ sở dữ liệu trường); khóa công khai trả qua điểm cuối công khai cho giao diện; chế độ một trường lấy từ cấu hình; công cụ dòng lệnh sinh khóa, không ghi vào kho; đổi khóa thì đăng ký cũ cần đăng ký lại (ghi trong hướng dẫn vận hành).
- **Nội dung đẩy:** tiêu đề theo nhóm và tên trường, một câu chung, mã thông báo để mở đúng màn hình; **không có họ tên, số tiền, điểm, nội dung sức khỏe**; chạm thông báo mở ứng dụng ở màn hình của thông báo (đăng nhập nếu phiên đã hết); dấu đã đọc vẫn ghi theo kênh `in_app` như hiện nay.
- **Giới hạn iOS:** Web Push chỉ chạy ở iOS và iPadOS 16.4 trở lên **khi đã cài lên màn hình chính**; màn hình cài đặt thông báo phát hiện và hiện hướng dẫn cài (26a) thay cho nút bật; không hứa đẩy trên iOS khi mở bằng Safari thường.
- **Đa thuê bao:** đăng ký nằm ở cơ sở dữ liệu của trường; tiến trình gửi chạy theo trường (S1b); kiểm thử cách ly: thông báo của trường A không gửi tới đăng ký của trường B, trường B không đọc, xóa được đăng ký của A (spec `182-` ở chế độ nhiều trường, ma trận cách ly).

**26c. Khung kiểm thử theo khổ thiết bị**
- **Dự án Playwright:** giữ dự án `chromium` khổ máy tính như hiện nay cho mọi spec; thêm `dien-thoai` (390 × 844, chạm, di động), `may-tinh-bang-doc` (820 × 1180), `may-tinh-bang-ngang` (1180 × 820), chỉ chạy spec có nhãn `@thiet-bi`; thêm `dien-thoai-webkit` (WebKit, gần Safari iOS) chỉ khi chạy đủ. Spec cũ không tự chạy ở khổ mới; mỗi phần đợt 2 gắn nhãn cho spec mình rà.
- **Bộ kiểm dùng chung trong `tests/e2e/`:** đo vùng chạm của nút, liên kết, ô nhập đang hiện (tối thiểu 44 × 44 px, cho phép ngoại lệ có ghi lý do), cỡ chữ ô nhập tối thiểu 16 px (tránh iOS tự phóng to), không cuộn ngang cả trang, kiểm truy cập bằng axe-core (thư viện mã nguồn mở, ghi giấy phép); ảnh chụp tham chiếu cho vài màn hình chính, chỉ so ở một nền (Linux của CI).
- **CI, hợp với cách tổ chức của PR 177:** thêm việc `kiem-thu-thiet-bi` chạy **song song** với `kiem-thu-giao-dien` (không nối đuôi, nên thời gian chờ của yêu cầu kéo không cộng dồn). Ở **yêu cầu kéo**: chỉ `dien-thoai` và `may-tinh-bang-doc`, chỉ spec có nhãn `@thiet-bi-pr` (tập con chọn lọc, mục tiêu dưới 10 phút cho riêng việc này), chỉ Chromium. Ở **lần đẩy lên nhánh chính và chạy hằng đêm** (lịch `schedule`, khoảng 2 giờ sáng giờ Việt Nam): đủ bốn dự án thiết bị, mọi spec `@thiet-bi`, chia mảnh bằng `--shard` (ma trận 2 đến 3 mảnh). Chạy hằng đêm hỏng thì mở vấn đề hoặc ghi vào bản tóm tắt của lần chạy, không chặn yêu cầu kéo. Kết quả hỏng giữ dấu vết như `kiem-thu-giao-dien`.
- **Không làm chậm:** dựng một lần trong việc, dùng cùng cơ sở dữ liệu mẫu đã migrate của PR 177; nếu sau này cần thì tách bước dựng thành tệp tạo tác dùng chung giữa các việc (ghi ở YCTD, không bắt buộc ở 26c). Ghi số phút đo được trước và sau vào YCTD-233.

**26d. Bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh**
- **Điểm ngắt:** dưới 768 px giữ bố cục điện thoại hiện nay; từ 768 px (máy tính bảng dọc) hai cột thẻ; từ 1024 px (máy tính bảng ngang, màn hình lớn) chia hai khung danh sách và chi tiết. Bỏ khóa `max-w-md`, `max-w-lg` ở khổ lớn, giữ ở khổ điện thoại.
- **Chế độ lớp học của ứng dụng giáo viên:** một màn hình theo tiết đang dạy (lấy từ thời khoá biểu của giáo viên): khung trái danh sách lớp, khung phải chuyển giữa **điểm danh** (màn hình điểm danh hiện có), **sổ đầu bài** (màn hình sổ đầu bài hiện có), **công cụ lớp học** (23b) và **trò chơi kiến thức** (23c khi đã gộp); chế độ **trình chiếu** cho màn hình lớn hoặc máy chiếu: chữ to, nền tương phản, ẩn thông tin riêng (điểm, ghi chú) khi đang chiếu; giữ màn hình sáng khi đang dùng công cụ (khi trình duyệt cho phép).
- **Ứng dụng phụ huynh:** trang chủ hai cột (thông báo, lịch, học phí bên cạnh nhau), danh sách và chi tiết cạnh nhau ở máy tính bảng ngang; màn hình học sinh của 23a dùng được ở máy tính bảng (làm bài ở khổ lớn, khóa toàn màn hình như 23a).
- **Truy cập:** vùng chạm tối thiểu 44 × 44 px, cỡ chữ cơ sở không nhỏ hơn hiện nay, phóng chữ 200% không mất nội dung; spec `183-` gắn `@thiet-bi`, phần chính gắn `@thiet-bi-pr`.

**26e. Bố cục máy tính bảng của cổng quản trị và cổng nền tảng**
- **Điều hướng:** từ 1280 px giữ thanh bên đầy đủ; 768 đến 1279 px thanh bên thu gọn thành biểu tượng có chú thích khi chạm giữ hoặc rê chuột; dưới 768 px thành ngăn kéo mở bằng nút trên đầu trang; giữ đúng thứ tự menu và quyền.
- **Bảng dữ liệu (`DataGrid`):** thêm chế độ co giãn: khổ máy tính bảng cuộn ngang trong khung bảng, cột đầu (mã, tên) cố định; khổ hẹp chuyển dạng thẻ (mỗi dòng một thẻ, cột chính lên đầu, cột phụ thu gọn); mỗi bảng khai báo cột chính, không phải sửa từng màn hình nghiệp vụ trừ khi bảng tự viết.
- **Biểu mẫu (`FormLayout`):** hai cột từ 768 px, một cột dưới 768 px; nhóm trường dài giữ một cột; hộp thoại thành toàn màn hình dưới 768 px; nút hành động chính dính đáy ở khổ hẹp.
- **Truy cập:** như 26d; rà các màn hình dùng nhiều (danh sách học sinh, điểm danh, học phí, sổ điểm, trang chủ cổng nền tảng) và ghi danh sách đã rà vào YCTD; spec `184-`.

**26f. Ứng dụng cài đặt bằng Capacitor**
- **Vỏ ứng dụng `apps/mobile`:** dự án Capacitor (phiên bản ổn định hiện hành lúc làm, ghi vào YCTD) đóng gói **bản dựng tĩnh** của `apps/teacher` và `apps/parent` trong cùng một ứng dụng; màn hình đầu chọn vai trò (Giáo viên, Phụ huynh) sau khi chọn trường; đổi vai trò, đổi trường trong menu. Mã nghiệp vụ của hai ứng dụng web không đổi; chỗ khác nhau (địa chỉ máy chủ, lưu phiên, đẩy, mở liên kết) đi qua lớp phát hiện nền tảng của `packages/pwa`. Màn hình học sinh (23a) **không đưa vào ứng dụng cài đặt ở DT-26** (GD-123), học sinh dùng PWA.
- **Chọn trường khi mở lần đầu:** tìm theo tên, mã, tỉnh hoặc thành phố trong danh mục trường của DT-24 (điểm cuối công khai ở tên miền hệ thống), chỉ trường đang dùng nền tảng; hoặc nhập tên miền, quét mã QR đường dẫn trường (in ở S2); lưu danh sách trường đã thêm (phụ huynh có con học hai trường); **mỗi trường một vùng lưu riêng trên máy** (phiên, bộ nhớ đệm, đăng ký đẩy), xóa trường thì xóa vùng của trường đó.
- **Gọi máy chủ:** mọi lời gọi tới nguồn gốc của trường đã chọn qua lớp HTTP gốc của Capacitor (không phụ thuộc CORS); máy chủ nhận diện ứng dụng cài đặt bằng tiêu đề riêng kèm phiên bản; kiểm lại chính sách nguồn gốc của dịch vụ định danh và API cho kiểu gọi này (YCTD ghi kết quả).
- **Đăng nhập, không lưu mật khẩu:** đăng nhập bằng tên đăng nhập và mật khẩu như web (mật khẩu chỉ gửi đi, không lưu); với ứng dụng cài đặt, dịch vụ định danh trả mã làm mới trong thân phản hồi thay cho cookie khi phiên đánh dấu `client_kind = native` (định danh 0160, chỉ đặt được khi đăng nhập từ ứng dụng cài đặt), mã làm mới lưu ở **Keychain (iOS) hoặc Keystore (Android) có điều kiện sinh trắc học** (hoặc mã khóa máy); mã truy cập chỉ ở bộ nhớ; xoay vòng mã làm mới như hiện nay; đăng xuất, đổi mật khẩu, trường khóa tài khoản thì mã làm mới bị thu hồi ở máy chủ. Danh sách phiên ứng dụng cài đặt theo người dùng (định danh 0161) để người dùng và quản trị trường gỡ máy.
- **Sinh trắc học:** sau lần đăng nhập đầu, hỏi bật "Mở khóa bằng Face ID, vân tay"; mở ứng dụng hoặc quay lại sau thời gian chờ (cấu hình, mặc định 5 phút) thì phải xác thực sinh trắc học mới đọc được mã làm mới; sinh trắc học đổi (thêm vân tay mới) hoặc lỗi nhiều lần thì xóa mã và đăng nhập lại; không có sinh trắc học thì dùng mã khóa máy; trường tắt được "nhớ đăng nhập trên ứng dụng" (cấu hình, ghép với xác thực hai lớp của S8b: bước hai vẫn hỏi ở lần đăng nhập đầu).
- **Nhà cung cấp định danh (DT-25):** luồng OIDC chạy ở **trình duyệt hệ thống** (ASWebAuthenticationSession, Custom Tabs) theo cách khuyến nghị cho ứng dụng gốc, có PKCE, quay về ứng dụng bằng liên kết sâu; không mở trang đăng nhập của nhà cung cấp trong khung web của ứng dụng.
- **Liên kết sâu:** liên kết phổ quát (iOS) và liên kết ứng dụng (Android) cho `*.<tên miền hệ thống>` (tệp `apple-app-site-association`, `assetlinks.json` phục vụ ở mọi tên miền con, nền tảng 0231 lưu mã ứng dụng và vân tay chứng chỉ để sinh tệp); **tên miền riêng của trường không khai báo được trước trong ứng dụng**, nên liên kết trên tên miền riêng mở trình duyệt như hiện nay, còn thông báo đẩy và liên kết do hệ thống tạo cho ứng dụng dùng tên miền con; đường dẫn ánh xạ về màn hình (thông báo, học phí, điểm danh, bài thi); liên kết của trường chưa thêm thì hỏi thêm trường.
- **Phiên bản tối thiểu:** máy chủ trả phiên bản tối thiểu của ứng dụng cài đặt (cấu hình nền tảng); thấp hơn thì chặn và dẫn tới cửa hàng; API giữ tương thích ngược với các bản ứng dụng còn được hỗ trợ (ghi chính sách ở tài liệu 12). Không dùng dịch vụ cập nhật mã qua mạng ở DT-26 (18.5).
- **Kiểm thử:** kiểm thử đơn vị cho lớp nền tảng, lưu phiên, ánh xạ liên kết; spec `185-` chạy bản web của vỏ (chọn trường, chọn vai trò, ánh xạ liên kết) với lớp Capacitor giả lập; thử trên máy ảo Android ở CI của 26h, trên máy thật khi Eric thử.

**26g. Thông báo đẩy native**
- **Bộ nối `fcm`** (Firebase Cloud Messaging, giao thức HTTP v1, cho Android) và **`apns`** (Apple Push Notification service, khóa dạng mã thông báo `.p8`, cho iOS) của `PushSender`; cùng bộ phát, cùng nhóm loại và tuỳ chọn tắt của 26b, cùng quy tắc nội dung không có dữ liệu cá nhân (nội dung FCM, APNs **không mã hóa đầu cuối** như Web Push nên quy tắc này bắt buộc).
- **Đăng ký mã thiết bị:** ứng dụng xin quyền thông báo (Android 13 trở lên, iOS) sau khi người dùng bấm, gửi mã thiết bị về cùng điểm cuối đăng ký của 26b với loại `fcm` hoặc `apns` (hệ thống 0093 nếu cần thêm ràng buộc), làm mới khi mã đổi, thu hồi khi đăng xuất hoặc xóa trường khỏi ứng dụng.
- **Khóa của nền tảng:** tệp tài khoản dịch vụ Firebase và khóa APNs thuộc **một ứng dụng chung cho mọi trường**, lưu mã hóa ở cơ sở dữ liệu `platform` (nền tảng 0232) hoặc cấu hình triển khai, không xuống cơ sở dữ liệu trường; thiếu khóa thì bộ nối tắt, các kênh khác chạy như cũ.
- **Mở đúng màn hình:** chạm thông báo mở trường và màn hình tương ứng (cùng ánh xạ của liên kết sâu 26f); ứng dụng đang mở thì hiện thông báo trong ứng dụng.
- **Kiểm thử:** bộ nối giả lập trả các mã lỗi thật của FCM, APNs (mã hết hạn, khóa sai) để kiểm thử thu hồi và thử lại; spec `186-` kiểm cách ly đăng ký `fcm`, `apns` giữa các trường.

**26h. Ký, dựng bản, phát hành và hồ sơ cửa hàng**
- **CI dựng bản** (tệp quy trình mới `.github/workflows/ung-dung-di-dong.yml`): Android trên Ubuntu (Gradle, gói AAB và APK); iOS trên macOS (Xcode, công cụ tự động hóa dựng và ký, ví dụ fastlane, chọn lúc làm); **chỉ chạy khi gắn thẻ phát hành ứng dụng hoặc chạy tay**, không chạy ở mọi yêu cầu kéo (máy macOS tốn phút gấp nhiều lần); ở yêu cầu kéo sửa `apps/mobile/` chỉ chạy dựng Android bản gỡ lỗi không ký để bắt lỗi sớm.
- **Khóa ký chỉ ở secrets:** khóa tải lên Android (Google Play giữ khóa ký ứng dụng, dùng Play App Signing), chứng chỉ phân phối và hồ sơ cấp phép iOS hoặc khóa App Store Connect API, khóa Google Play API để tải bản lên; giải mã vào thư mục tạm của lần chạy, xóa sau khi dựng; thiếu secrets thì quy trình dựng bản không ký và báo rõ, không hỏng. Hướng dẫn Eric tạo khóa trên máy mình (lệnh mẫu), sao lưu khóa ngoại tuyến, đưa vào secrets của kho; quy tắc chặn commit tệp khóa (`.gitignore`, kiểm ở CI).
- **Quy trình phát hành:** số phiên bản ứng dụng theo phiên bản phần mềm, số bản dựng tăng tự động; luồng: thử nội bộ (Google Play internal testing, TestFlight nội bộ) → thử kín với vài trường thử → phát hành theo tỷ lệ (Android) hoặc phát hành theo giai đoạn (iOS) → toàn bộ; ghi trong tài liệu triển khai; mỗi bản có ghi chú phát hành tiếng Việt.
- **Hồ sơ cửa hàng:** tên ứng dụng, mô tả ngắn và dài tiếng Việt, ảnh chụp màn hình điện thoại và máy tính bảng sinh bằng Playwright trên dữ liệu giả, biểu tượng, danh mục Giáo dục, xếp hạng độ tuổi, **tài khoản trình diễn cho người duyệt** trên môi trường trình diễn (18h) với dữ liệu giả; quốc gia phát hành ban đầu: Việt Nam.
- **Chính sách quyền riêng tư và khai báo dữ liệu (`33_HO_SO_PHAP_LY/`):** cập nhật chính sách bảo mật cho ứng dụng cài đặt (dữ liệu thu, mã thiết bị đẩy, nhà cung cấp đẩy Google, Apple là bên xử lý, sinh trắc học chỉ xử lý trên máy, không thu vị trí, không quảng cáo, không theo dõi); bản nháp nội dung cho mục "Quyền riêng tư của ứng dụng" (App Store) và "An toàn dữ liệu" (Google Play); đường dẫn công khai của chính sách; cách yêu cầu xóa tài khoản (tài khoản do trường cấp, yêu cầu gửi trường xử lý, có trang hướng dẫn công khai như cửa hàng yêu cầu); đọc chính sách cửa hàng về ứng dụng có người dùng là trẻ em và ghi kết luận vào YCTD (GD-123).
- **Việc Eric phải làm** ghi thành danh sách kiểm ở 18.10.

### 18.5 Quyết định thiết kế và phương án đã loại

- **PWA trước, ứng dụng cài đặt sau, cùng một mã:** PWA cho phần lớn lợi ích (cài lên màn hình chính, đẩy, mở nhanh) mà không qua cửa hàng; ứng dụng cài đặt chỉ thêm phần web không làm được (đẩy trên iOS khi chưa cài PWA, sinh trắc học, có mặt trên cửa hàng). Thứ tự này đúng yêu cầu của Eric.
- **Capacitor đóng gói mã web hiện có (chọn):** dùng lại toàn bộ `apps/teacher`, `apps/parent`, cùng ngôn ngữ, cùng kiểm thử; chỉ thêm lớp nền tảng và dự án Android, iOS. Phương án đã loại:
  - **Viết lại bằng React Native:** phải viết lại toàn bộ giao diện hai ứng dụng bằng thành phần gốc (không dùng lại thành phần DOM, Tailwind), hai mã giao diện phải giữ khớp nhau về nghiệp vụ lâu dài, kiểm thử e2e hiện có không dùng được; công sức nhiều lần DT-26 mà lợi ích chính (đẩy, sinh trắc học) Capacitor đã có.
  - **Viết lại bằng Flutter:** như trên và thêm ngôn ngữ Dart, bộ công cụ, thư viện mới cho dự án chỉ dùng TypeScript; không dùng lại được mã kiểm tra dữ liệu, gói `shared`.
  - **Chỉ bọc trang web từ xa (ứng dụng mở thẳng địa chỉ của trường):** luôn có bản mới nhất nhưng dễ bị App Store từ chối vì chỉ là trang web đóng gói, không chạy được khi mất mạng, phụ thuộc cookie của khung web; giữ làm phương án dự phòng nếu bản đóng gói gặp trở ngại.
  - **Dịch vụ cập nhật mã qua mạng (live update):** thêm dịch vụ ngoài hoặc tự dựng, thêm rủi ro bảo mật chuỗi cung ứng; DT-26 dùng chặn phiên bản tối thiểu và phát hành qua cửa hàng; xem lại khi nhịp phát hành cửa hàng thành trở ngại.
  - **Ứng dụng Android dạng TWA (Trusted Web Activity) riêng:** không có tương đương cho iOS, nên vẫn phải làm Capacitor cho iOS; hai cách đóng gói là hai thứ phải giữ.
- **Một ứng dụng có chọn vai trò (chọn) thay cho hai ứng dụng Giáo viên và Phụ huynh:** một hồ sơ cửa hàng, một lần duyệt, một bộ khóa ký và khóa đẩy, một quy trình CI; người vừa là giáo viên vừa là phụ huynh dùng một ứng dụng. Đổi lại mô tả cửa hàng phải nói cho cả hai nhóm và gói nặng hơn một chút (hai bản dựng tĩnh nhỏ). Phương án hai ứng dụng giữ được nếu Eric muốn tên riêng cho từng nhóm (GD-121); đổi được vì vỏ chỉ là cấu hình vai trò.
- **Không làm ứng dụng riêng mang thương hiệu từng trường:** cửa hàng hạn chế ứng dụng sinh từ khuôn mẫu nộp dưới tài khoản của bên làm phần mềm (App Store yêu cầu ứng dụng như vậy nộp bằng tài khoản của chính khách hàng); thương hiệu trường hiện bên trong ứng dụng sau khi chọn trường. Trường muốn ứng dụng riêng là việc sau DT-26, cần tài khoản nhà phát triển của trường.
- **Mã làm mới trong Keychain, Keystore có sinh trắc học, không dùng cookie trong ứng dụng cài đặt:** gắn việc dùng phiên với xác thực trên máy, thu hồi được từ máy chủ; phương án đã loại: lưu mật khẩu để tự đăng nhập (vi phạm nguyên tắc không lưu mật khẩu), giữ cookie trong kho cookie của khung web (không gắn được sinh trắc học, khó thu hồi theo máy).
- **Một bộ phát đẩy, nhiều bộ nối:** Web Push, FCM, APNs là bộ nối của kênh `push`; tuỳ chọn tắt, nội dung, cách ly dùng chung; phương án đã loại: dịch vụ đẩy trung gian bên ngoài (thêm bên xử lý dữ liệu, thêm chi phí), FCM cho cả iOS (iOS vẫn cần khóa APNs, thêm phụ thuộc Google cho thiết bị Apple).
- **Kiểm thử thiết bị ở việc CI riêng, yêu cầu kéo chạy tập con:** giữ thời gian chờ của yêu cầu kéo; chạy đủ ở nhánh chính và hằng đêm; phương án đã loại: chạy mọi spec ở mọi khổ cho mọi yêu cầu kéo (nhân ba thời gian kiểm thử giao diện), chỉ kiểm bằng mắt.
- **Không làm ở DT-26:** ứng dụng học sinh cài đặt (GD-123); ngoại tuyến cho phân hệ ngoài 23b (GD-108 giữ nguyên); cập nhật mã qua mạng; ứng dụng mang thương hiệu từng trường; ứng dụng cho cổng quản trị, cổng nền tảng (chỉ bố cục máy tính bảng trên web); thông báo đẩy có nội dung đầy đủ; đẩy qua dịch vụ trung gian.

### 18.6 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Bộ nhớ đệm ngoại tuyến giữ dữ liệu cá nhân, lộ khi mất máy hoặc máy dùng chung | Service worker không giữ phản hồi `/api`; kiểm thử đọc toàn bộ bộ nhớ đệm sau khi dùng các màn hình chính và tìm chuỗi mồi của dữ liệu giả; đăng xuất xóa bộ nhớ đệm, IndexedDB, hủy đăng ký đẩy; dữ liệu 23b giữ theo GD-108 |
| Máy dùng chung nhận thông báo đẩy của người dùng trước | Đăng xuất thu hồi đăng ký ở máy chủ và ở máy; kiểm thử đăng xuất rồi gửi thông báo, bộ giả lập không ghi nhận gửi tới đăng ký đó |
| Nội dung đẩy lộ dữ liệu cá nhân qua máy chủ của Google, Apple, Mozilla hoặc trên màn hình khóa | Nội dung chỉ tiêu đề theo nhóm và tên trường; kiểm thử dựng nội dung từ thông báo có họ tên, số tiền, điểm và kiểm không còn chuỗi đó; ghi vào hồ sơ đánh giá tác động |
| Đăng ký đẩy hoặc khóa của trường này dùng cho trường khác | Đăng ký lưu ở cơ sở dữ liệu của trường, mã hóa bằng khóa của trường; tiến trình gửi theo trường; spec `182-`, `186-` ở chế độ nhiều trường; ma trận cách ly; kiểm tĩnh |
| Service worker giữ bản cũ sau khi cập nhật, hoặc lỗi service worker làm "kẹt" ứng dụng | Phiên bản bộ nhớ đệm theo bản dựng, hỏi tải lại, phiên bản tối thiểu từ máy chủ; có tuyến gỡ service worker khẩn (tệp service worker tự hủy khi máy chủ bật cờ); kiểm thử nâng bản |
| Trên iOS người dùng không cài nên không nhận đẩy | Hướng dẫn cài rõ ràng, phát hiện trình duyệt trong ứng dụng Zalo, Facebook; kênh `in_app`, SMS, Zalo vẫn chạy; đợt 3 giải quyết bằng ứng dụng cài đặt |
| Trường đổi tên miền làm bản PWA đã cài, đăng ký đẩy ở nguồn gốc cũ hỏng | Nguồn gốc cũ chuyển hướng và báo cài lại; đăng ký ghi nguồn gốc, đổi tên miền thì đánh dấu cần đăng ký lại; kiểm thử ở bố cục có tên miền riêng |
| Thêm kiểm thử thiết bị làm CI chậm | Việc riêng chạy song song, yêu cầu kéo chỉ tập con hai khổ, chạy đủ ở nhánh chính và hằng đêm, chia mảnh; đo và ghi số phút ở YCTD-233; điều kiện ra đợt 2 giới hạn tăng 5 phút |
| Ảnh chụp tham chiếu lệch theo phông chữ, nền tảng làm kiểm thử chập chờn | Chỉ so ảnh ở Linux của CI, ngưỡng sai khác, ít màn hình; ảnh chụp không chặn yêu cầu kéo ở lần đầu thêm |
| Sửa `packages/ui` làm vỡ bố cục máy tính ở các màn hình đã có | Chế độ co giãn bật theo khổ, khổ máy tính giữ nguyên; toàn bộ e2e `chromium` hiện có đạt không sửa kỳ vọng; chỉ 26e sửa `packages/ui` ở đợt 2 |
| Ứng dụng bị App Store hoặc Google Play từ chối (chỉ là trang web, thiếu tài khoản trình diễn, thiếu cách xóa tài khoản, người dùng là trẻ em) | Bản đóng gói có chức năng gốc (đẩy, sinh trắc học, ngoại tuyến của 23b); tài khoản trình diễn dữ liệu giả; trang hướng dẫn xóa tài khoản; không đưa học sinh vào ứng dụng cài đặt ở DT-26 (GD-123); 26h đọc chính sách hiện hành trước khi nộp |
| Lộ khóa ký hoặc khóa đẩy, hoặc mất khóa tải lên Android | Khóa chỉ ở secrets và bản sao lưu ngoại tuyến của Eric; Play App Signing nên mất khóa tải lên đổi được; kiểm CI chặn tệp khóa trong kho; quy trình dựng xóa tệp tạm |
| Mã làm mới trong ứng dụng cài đặt bị lấy khỏi máy | Lưu ở Keychain, Keystore có điều kiện sinh trắc học; xoay vòng; thu hồi theo máy ở máy chủ; trường tắt được nhớ đăng nhập; kiểm thử mã làm mới cũ bị từ chối sau xoay vòng |
| API đổi làm hỏng bản ứng dụng cài đặt cũ đang dùng | Chính sách tương thích ngược, phiên bản tối thiểu, tiêu đề phiên bản ứng dụng để ghi nhận bản còn dùng; kiểm thử hợp đồng API cho các tuyến ứng dụng dùng |
| Liên kết sâu không mở được ở tên miền riêng | Thông báo đẩy, liên kết do hệ thống tạo cho ứng dụng dùng tên miền con; liên kết ở tên miền riêng mở web như cũ; ghi rõ trong hướng dẫn |
| Đợt 3 va chạm với DT-24, DT-25 ở dịch vụ định danh | Đợt 3 chỉ bắt đầu khi DT-24, DT-25 đã gộp; một phần duy nhất (26f) sửa định danh trong đợt 3; gộp `origin/main` trước khi mở PR |
| Hai phần cùng đợt sửa chung tệp lõi (`application.module.ts`, `ci.yml`, `playwright.config.ts`, `packages/ui`, `MULTI_TENANT_SPEC`, `NotificationChannel`) | Phân quyền sở hữu tệp ở 18.3; sửa tệp chung theo kiểu thêm cuối; gộp `origin/main` trước khi mở PR |
| Va số với DT-23, DT-24, DT-25 | Dải DT-26 bắt đầu sau các số đang dùng và chừa khoảng trống (18.3); phiên điều phối kiểm lại lúc giao |

**Cổng kiểm của mỗi phần DT-26:** kiểm thử đơn vị toàn bộ kho mã đạt không sửa kỳ vọng; e2e `single` hiện có đạt cộng e2e mới của phần (chạy riêng, giữ khóa `e2e.lock`); spec `@thiet-bi` đạt ở các khổ đã khai báo (từ khi 26c gộp); kiểm thử cách ly theo 14.7 ở cả hai bố cục `database` và `schema`; kiểm tĩnh đa thuê bao đạt; typecheck, lint, build đạt; CI xanh toàn bộ; phiên bản phần mềm tăng theo từng phần, riêng bản kế hoạch này (YCTD-230) chỉ đổi tài liệu.

### 18.7 Quy ước chung của DT-26

- Mỗi phần ghi YCTD giữ sẵn ở mục 18.3, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 32, 33, 34, `index.md` khi có thay đổi tương ứng), mở PR, gộp khi mọi kiểm tra CI đạt.
- Mã mới theo mục 18.2 (một mã web, dùng lại phần đã có, không đổi hành vi cũ, hai bố cục cơ sở dữ liệu, kiểm tĩnh đa thuê bao, dữ liệu trên máy tối thiểu, nội dung đẩy không có dữ liệu cá nhân).
- Kiểm thử và dữ liệu mẫu chỉ dùng dữ liệu bịa; đẩy chỉ qua bộ giả lập `development`; khóa VAPID, khóa ký trong kiểm thử sinh lúc chạy; không in nội dung `.env`, không dán khóa vào tài liệu, không commit tệp khóa, chứng chỉ, tệp dịch vụ Firebase.
- Tuyệt đối không chạy `migrate` lên cơ sở dữ liệu dùng chung; kiểm thử dùng cơ sở dữ liệu riêng của phiên.
- Thư viện mới (công cụ service worker, Capacitor và phần bổ trợ, axe-core, công cụ dựng iOS) chọn loại mã nguồn mở có giấy phép cho phép dùng thương mại, ghi tên, phiên bản, giấy phép vào YCTD của phần.
- Các điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần; nếu một phần cần số ngoài khoảng đã giữ, ghi vào YCTD và lấy ở dải dự phòng của DT-26 (18.3).
- Phần chưa chốt (18.9) làm cấu hình được; khi Eric chốt thì đổi giá trị mặc định bằng YCTD, không sửa mã.

### 18.8 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| 26a | 1 | Đã làm, YCTD-231, phiên bản 0.145.0: gói `packages/pwa` (mẫu service worker gom từ 23b, plugin Vite, đăng ký, kiểm bản mới, gỡ theo tiền tố, `InstallPrompt`, `UpdateBanner`), manifest và biểu tượng SVG theo trường (`/api/v1/public/pwa/*`, hệ thống 0090 `app_short_name`), ứng dụng phụ huynh có service worker, màn hình học sinh của 23a cài được thành ứng dụng riêng (manifest `student` mở thẳng `#hoc-sinh`); e2e 181. Chưa làm: ảnh PNG và màn hình chờ iOS theo trường (cần thư viện xử lý ảnh, để phần sau) |
| 26b | 1 | Phần máy chủ đã làm (YCTD-232, phiên bản 0.148.0): kênh push, bộ nối, đăng ký, tuỳ chọn theo nhóm, khóa VAPID, spec 182. Phần giao diện (YCTD-239, phiên bản đề xuất 0.153.0): service worker chung nhận đẩy, hiện thông báo, chạm mở ứng dụng; khối "Cài đặt thông báo" ở ứng dụng giáo viên, phụ huynh, màn hình học sinh (bật, tắt trên máy, tắt theo nhóm, gỡ máy, hướng dẫn cài cho iPhone); đồng bộ đăng ký khi mở ứng dụng, thu hồi khi đăng xuất; e2e 187 |
| 26c | 1 | Đã làm, YCTD-233, phiên bản 0.146.0, PR 188: dự án Playwright theo khổ thiết bị, nhãn `@thiet-bi`, bộ kiểm dùng chung, spec 180, việc CI `kiem-thu-thiet-bi`; vi phạm đo được ghi ở đường cơ sở cho 26d, 26e |
| 26d | 2 | Đã làm, YCTD-234, phiên bản đề xuất 0.155.0: chế độ lớp học (lớp theo tiết đang dạy, điểm danh, sổ đầu bài, công cụ lớp học, trình chiếu, giữ màn hình sáng), trang chủ giáo viên hai khung, trang chủ phụ huynh hai cột, màn hình nới rộng từ 768 px; vùng chạm 44 px, chữ ô nhập 16 px, màu tương phản AA ở `index.css` của hai ứng dụng (không sửa `packages/ui`); e2e 183; gỡ vi phạm của 26d khỏi đường cơ sở của 26c |
| 26e | 2 | Đã làm, YCTD-235, phiên bản đề xuất 0.159.0: cổng quản trị dưới 1280 px menu ngăn kéo; cổng nền tảng thanh biểu tượng ở 768 đến 1279 px, ngăn kéo dưới 768 px; `DataGrid` cột đầu cố định và dạng thẻ dưới 768 px; hộp thoại toàn màn hình, nút Ghi dính đáy ở khổ hẹp; màu đủ tương phản ở bộ chủ đề; e2e 184; đường cơ sở của 26c rỗng |
| 26f | 3 | Bản demo, YCTD-236, phiên bản đề xuất 0.165.0 (GD-158): `apps/mobile` vỏ Capacitor 8.5.3, trang khởi động chọn trường, vai trò, mở ứng dụng web của trường trong WebView; dự án Android, iOS; script dựng APK debug, chạy trên máy giả lập; hướng dẫn `apps/mobile/HUONG_DAN_DEMO.md`; e2e 185; đã dựng APK debug và chạy trên máy giả lập Android (Pixel 7, android-36) ngày 2026-10-27, chưa chạy iOS Simulator. Phần còn lại (đóng gói, đăng nhập gốc, sinh trắc học, liên kết sâu, danh mục trường) chờ tài khoản nhà phát triển |
| 26g | 3 | Phần mã, YCTD-237, phiên bản đề xuất 0.170.0 (Eric cho làm trước ngày 2026-10-27): bộ nối `fcm`, `apns` với bộ định tuyến theo loại đăng ký, khóa của nền tảng (nền tảng 0232, không cần hệ thống 0093), đăng ký mã thiết bị qua cùng điểm cuối, cầu nối gốc cho trang của trường, chạm thông báo mở đúng ứng dụng; kiểm thử với máy chủ FCM, APNs giả lập, e2e 186. Chưa nối FCM, APNs thật: chờ dự án Firebase, khóa APNs (cần tài khoản nhà phát triển) |
| 26h | 3 | Hoãn đến khi có tài khoản nhà phát triển Apple, Google (GD-158); YCTD-238 giữ sẵn; phát hành cần các việc của Eric ở 18.10 |

Bản kế hoạch này là YCTD-230, chỉ đổi tài liệu (không tăng phiên bản phần mềm).

### 18.9 Giả định chưa chốt, làm cấu hình được

Mã GD-109 đến GD-119 chừa cho DT-24, DT-25; DT-26 dùng từ GD-120.

| Mã | Mục chưa chốt | Giả định để làm | Cấu hình ở | Cần ai trả lời |
|---|---|---|---|---|
| GD-120 | Tên ứng dụng trên cửa hàng, mã gói (bundle id, application id), tên miền hệ thống dùng cho liên kết sâu | Tạm dùng tên sản phẩm của cấu hình nền tảng (GD-93, mặc định "School Management") và mã gói theo tên miền của Eric; đổi trước lần nộp đầu (mã gói không đổi được sau khi phát hành) | Cấu hình `apps/mobile`, nền tảng 0231 | Eric |
| GD-121 | Một ứng dụng có chọn vai trò hay hai ứng dụng Giáo viên, Phụ huynh | Một ứng dụng (18.5) | Cấu hình vai trò của vỏ | Eric |
| GD-122 | Mức chi tiết của nội dung đẩy | Chỉ tiêu đề theo nhóm và tên trường, không dữ liệu cá nhân; trường không đổi được ở DT-26 | Mã bộ phát (quy tắc cố định) | Eric |
| GD-123 | Học sinh dùng ứng dụng cài đặt | Không ở DT-26: học sinh dùng PWA; tránh chính sách ứng dụng có người dùng dưới 13 tuổi của hai cửa hàng; 26h đọc chính sách và ghi kết luận để Eric quyết bước sau | Cấu hình vai trò của vỏ | Eric |
| GD-124 | Pháp nhân đứng tên tài khoản nhà phát triển | Tài khoản tổ chức (cần pháp nhân và mã D-U-N-S); tài khoản cá nhân mới của Google Play phải qua thử kín bắt buộc trước khi phát hành (kiểm lại điều kiện lúc làm) | Ngoài phần mềm | Eric |
| GD-125 | Thời gian chờ trước khi đòi mở khóa sinh trắc học; trường có được tắt "nhớ đăng nhập" | 5 phút; có công tắc theo trường, mặc định bật | Cấu hình của trường | Eric |
| GD-126 | Thời hạn dọn đăng ký đẩy không dùng | 90 ngày | Cấu hình nền tảng | Claude (theo ủy quyền) |
| GD-127 | Phiên bản iOS, Android thấp nhất hỗ trợ | Theo yêu cầu của phiên bản Capacitor chọn lúc làm; PWA đẩy trên iOS từ 16.4 | Cấu hình dự án | Claude (theo ủy quyền) |
| GD-158 | Phạm vi đợt 3 (26f, 26g, 26h) khi chưa có tài khoản nhà phát triển Apple, Google | Bản demo chạy trên máy giả lập Android, iOS Simulator: vỏ Capacitor, trang khởi động chọn trường, vai trò, script dựng bản debug, hướng dẫn chạy; 26g, 26h và phần đăng nhập gốc, đóng gói, liên kết sâu của 26f hoãn đến khi có tài khoản | `apps/mobile` | Eric (đã trả lời 2026-10-27: chỉ làm demo, thử trên máy giả lập) |

### 18.10 Việc Eric phải làm

Phần mềm làm được đến bản dựng không ký và bộ hồ sơ nháp; các việc sau cần Eric (hoặc người đại diện pháp nhân) tự làm, Claude không làm thay vì cần danh tính, thanh toán hoặc ký kết:

| Việc | Khi nào cần | Ghi chú |
|---|---|---|
| Chọn tên ứng dụng, mã gói, tên miền hệ thống (GD-120) | Trước khi 26f tạo dự án Android, iOS | Mã gói không đổi được sau khi phát hành |
| Chọn pháp nhân đứng tên (GD-124), xin mã D-U-N-S (miễn phí, mất vài ngày) | Trước khi đăng ký hai tài khoản | Tên pháp nhân hiện trên cửa hàng |
| Đăng ký **Apple Developer Program** (99 USD mỗi năm) | Trước 26g (khóa APNs) và 26h (ký iOS, TestFlight) | Gia hạn hằng năm; hết hạn thì ứng dụng bị gỡ khỏi cửa hàng |
| Đăng ký **Google Play Console** (25 USD một lần) | Trước 26h (thử nội bộ Android) | Xác minh danh tính, địa chỉ, số điện thoại của tổ chức |
| Tạo dự án Firebase cho FCM, khóa APNs `.p8` trong tài khoản Apple, khóa App Store Connect API, khóa Google Play API | 26g, 26h | Claude viết hướng dẫn từng bước; Eric tạo và đưa vào secrets của kho |
| Tạo và sao lưu khóa tải lên Android theo lệnh mẫu, đưa vào secrets | 26h | Giữ bản sao lưu ngoại tuyến; bật Play App Signing |
| Cung cấp đường dẫn công khai cho chính sách quyền riêng tư, trang hỗ trợ, thư điện tử liên hệ | 26h | Có thể đặt ở website của sản phẩm |
| Nhờ luật sư rà chính sách quyền riêng tư, khai báo dữ liệu, kết luận về văn bản cung cấp ứng dụng (18.2) | Trước khi nộp lần đầu | Tài liệu do Claude soạn là bản nháp |
| Bấm nộp bản lên App Store và Google Play, trả lời người duyệt | Cuối 26h | Claude chuẩn bị bản dựng, hồ sơ, ghi chú cho người duyệt |
| Thử trên máy thật (một iPhone, một máy Android, một máy tính bảng) | Điều kiện ra của đợt 1 và đợt 3 | Bộ giả lập không thay được đẩy thật trên iOS |

## 19. DT-27: nền tảng gia sư trực tuyến (27a đến 27i)

> Số mục: mục 16, 17 để cho kế hoạch DT-24 (danh mục trường, đăng nhập kiểu SMIS) và DT-25 (định danh OIDC, VNeID); mục 18 là DT-26 (PWA, máy tính bảng, ứng dụng cài đặt, PR 178). Bản này đã gộp nhánh chính sau PR 178 và đánh lại toàn bộ số giữ sẵn của DT-27 vì trùng dải với DT-26.

### 19.1 Căn cứ và mục tiêu

1. **Quyết định của Eric ngày 2026-10-26** (giao qua phiên điều phối):
   - **Mô hình: làm cả hai, theo thứ tự.** Trước: **gia sư trong từng trường** (trường tổ chức phụ đạo, bồi dưỡng trực tuyến cho học sinh của mình, dùng giáo viên, lớp, danh mục sẵn có). Sau: **chợ gia sư mở** (phụ huynh hoặc học sinh bất kỳ tìm và đặt gia sư bên ngoài, nền tảng thu hoa hồng).
   - **Hình thức học: cả ba.** Lớp video trực tiếp (1-1 và nhóm nhỏ, bảng trắng, chia sẻ màn hình, ghi hình); khoá học ghi sẵn (video bài giảng, bài tập, theo dõi tiến độ); hỏi đáp bài tập không đồng bộ (học sinh gửi câu hỏi, gia sư trả lời; có thể có gợi ý của trợ lý AI 23d, **luôn ở dạng nháp**).
   - **Thu phí qua nền tảng:** phụ huynh trả qua mã QR hoặc cổng thanh toán (S5b), nền tảng chi trả cho gia sư hoặc trường sau buổi học, có hoàn tiền và giải quyết tranh chấp. Mục 19.3 chỉ ra phần này **phải làm khác nhau** ở hai mô hình để đúng quy định: trong trường, tiền vào thẳng tài khoản của trường; ở chợ mở, giữ tiền và chia tiền phải đi qua tổ chức có giấy phép trung gian thanh toán.
2. **Mục tiêu:** trường dạy phụ đạo, bồi dưỡng trực tuyến đúng Thông tư 29/2024/TT-BGDĐT (sửa đổi bởi Thông tư 19/2026/TT-BGDĐT) ngay trên dữ liệu đang có; sau đó mở thêm một sản phẩm chợ gia sư cho phụ huynh không thuộc trường nào, **không dựng kho dữ liệu thứ hai cho phần đã có** (ngân hàng câu hỏi, đề, kho học liệu, thi trực tuyến, AI, thu phí, bảng lương, nhắn tin).
3. **Hiện trạng mã** (đọc trên nhánh chính ngày 2026-10-26, sau PR 177; các phần DT-23, DT-24, DT-25 đang làm ở nhánh khác, chưa gộp):
   - **Học liệu và câu hỏi:** kho học liệu số 22h1, 22h2 (`learning_resources`, sự kiện, báo lỗi, lượt dùng, bộ sưu tập câu hỏi); ngân hàng câu hỏi và đề 22g1, 22g2 (`questions`, `exams`, `exam_variants`, `question_usages`, luồng chuyển điểm vào `score_entries`).
   - **Thời khoá biểu và điểm danh:** `timetable_lessons` (giáo viên, lớp, môn, tiết) của 22c; `period_attendance`, `attendance_records`; `class_staff_assignments`. Đây là nguồn để biết **giáo viên đang được phân công dạy học sinh nào** (ràng buộc 19.2).
   - **Thu phí của trường:** `fee_schedules`, `fee_schedule_items`, `invoices`, `invoice_items`, `receipts`, `payments`, `payment_refund_sources`, `online_payment_transactions`; cổng thanh toán **theo trường** qua `TenantPaymentGatewayRegistry` (S3: PayOS, SePay, Casso, VNPay, VietQR tĩnh), tiền vào tài khoản của trường.
   - **Bảng lương:** `pay_item_types`, `staff_pay_items`, `payrolls`, biểu thuế thu nhập cá nhân lũy tiến (`apps/api/src/payroll/pay-items.ts`, YCTD-60).
   - **Thu phí nền tảng:** S5b (`PlatformPaymentGateways` trong `apps/api/src/billing/billing.ts`) chỉ thu tiền **hóa đơn dịch vụ của chính nền tảng** vào tài khoản nền tảng; `EInvoiceProvider` mới có bộ giả lập.
   - **Nhắn tin:** `message_threads`, `messages` (phụ huynh và giáo viên, theo năm học); thông báo `notifications`.
   - **Đa thuê bao:** mỗi trường một bộ cơ sở dữ liệu `identity`, `system`, `year_*` (bố cục `database` hoặc `schema`); `platform` là cơ sở dữ liệu chung duy nhất (14.4). **Chưa có chỗ nào chứa người dùng không thuộc trường** (cần cho chợ mở).
   - **Chưa có:** WebRTC, máy chủ video, ghi hình, khoá học, hỏi đáp. 23e (giám thị camera, YCTD-215) sẽ dựng coturn và WebRTC cho thi; 23a thêm kênh đăng nhập `student`; 23d thêm `AiProvider`; DT-25 thêm bộ nối OIDC (sẵn cho VNeID); DT-26 (mục 18) lên kế hoạch PWA, bố cục máy tính bảng và ứng dụng cài đặt iOS, Android.

### 19.2 Căn cứ pháp lý đã đọc và ràng buộc sản phẩm

Claude tra ngày **2026-10-26**. Cột "Mức đọc" ghi rõ đọc bản gốc hay nguồn thứ cấp; chỗ ghi **chưa xác minh** thì luật sư của Eric phải đối chiếu văn bản gốc trước khi dùng. Tài liệu này không thay tư vấn pháp lý.

| Văn bản | Ban hành, hiệu lực | Nguồn | Mức đọc |
|---|---|---|---|
| Thông tư 19/2026/TT-BGDĐT sửa đổi, bổ sung một số điều của Thông tư 29/2024/TT-BGDĐT về dạy thêm, học thêm | 31/03/2026; hiệu lực 15/05/2026 | `vanban.chinhphu.vn` (thuộc tính, docid 217679); tệp gốc `datafiles.chinhphu.vn/cpp/files/vbpq/2026/4/19-bgddt.pdf` (ảnh quét, Claude đọc từng trang) | **Toàn văn** Điều 1 đến Điều 11 |
| Thông tư 29/2024/TT-BGDĐT quy định về dạy thêm, học thêm | 30/12/2024; hiệu lực 14/02/2025 | Bài phân tích của Báo Luật sư Việt Nam (`lsvn.vn`), `vneconomy.vn`, `thuvienphapluat.vn` (trang hỏi đáp) | Nguồn thứ cấp; **chưa đọc bản gốc** (trang toàn văn trả lỗi 403 hoặc 404). Điều 3, 4, 5 dưới đây **chưa xác minh** từng chữ |
| Nghị định 52/2024/NĐ-CP về thanh toán không dùng tiền mặt; Thông tư 40/2024/TT-NHNN về dịch vụ trung gian thanh toán | 15/05/2024, hiệu lực 01/07/2024; 17/07/2024 | `chinhsachonline.chinhphu.vn`, `baochinhphu.vn`, `vcci.com.vn`, trích đoạn `thuvienphapluat.vn` | Định nghĩa khoản 5, khoản 17 Điều 3 và mức vốn qua trích dẫn; **chưa đọc toàn văn**; chưa biết có văn bản sửa đổi đến 10/2026 hay không (**chưa xác minh**) |
| Nghị định 117/2025/NĐ-CP về quản lý thuế với hoạt động kinh doanh trên nền tảng thương mại điện tử, nền tảng số | hiệu lực 01/07/2025 | `luatvietnam.vn`, `amis.misa.vn`, `viet-partners.com`; bản tin EY (tệp mã hóa, không đọc được) | Nguồn thứ cấp; tỷ lệ khấu trừ **chưa xác minh** (nguồn mâu thuẫn: thuế thu nhập cá nhân với dịch vụ 2% hay 5%) |
| Luật Thương mại điện tử số 122/2025/QH15; Nghị định 248/2026/NĐ-CP hướng dẫn | 10/12/2025, hiệu lực 01/07/2026 | `luatvietnam.vn`, `thuvienphapluat.vn` (tin), `baolaocai.vn` | Nguồn thứ cấp; nghĩa vụ xác thực danh tính người bán trước khi cho bán (Điều 17 theo các bài) **chưa xác minh**; chưa rõ tiếp thị dịch vụ dạy học có thuộc phạm vi "nền tảng trung gian" không |
| Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15; Nghị định 356/2025/NĐ-CP | 26/06/2025 và 31/12/2025; hiệu lực 01/01/2026 | Đã đọc toàn văn các điều liên quan ở S8a ngày 2026-10-25 (`33_HO_SO_PHAP_LY/00_MUC_LUC.md` mục 4) | Điều 24 Luật (dữ liệu trẻ em), Điều 9, 10 (đồng ý), Điều 21 Nghị định (dịch vụ xử lý dữ liệu, khoản 5 "phần mềm giáo dục có yếu tố giám sát như điểm danh, ghi hình") |
| Luật Trẻ em số 102/2016/QH13; Nghị định 56/2017/NĐ-CP | 05/04/2016, hiệu lực 01/06/2017 | Hiểu biết sẵn có, **chưa đọc lại trong phiên này** | Quyền bí mật đời sống riêng tư; trách nhiệm bảo đảm an toàn cho trẻ em trên môi trường mạng; Tổng đài quốc gia bảo vệ trẻ em 111: **chưa xác minh** số điều |
| Cấp phiếu lý lịch tư pháp qua VNeID | Thí điểm toàn quốc 01/10/2024 đến 30/06/2025 (Công văn 656/TTg-KSTT) | `lsvn.vn`, `hatinh.gov.vn` | Nguồn thứ cấp; **chưa xác minh** việc gia hạn hay chính thức hóa sau 30/06/2025, giá trị của bản điện tử |
| Luật Nhà giáo số 73/2025/QH15 | — | Là căn cứ của Thông tư 19/2026 (trang 1) | Chỉ biết là căn cứ; **chưa đọc** điều về hành vi nhà giáo không được làm |

**1. Dạy thêm, học thêm (Thông tư 29/2024 sửa bởi Thông tư 19/2026).** Điều đọc được và ràng buộc trong sản phẩm:

| Quy định | Nguồn | Ràng buộc trong sản phẩm |
|---|---|---|
| "Dạy thêm, học thêm" là dạy học phụ thêm ngoài thời lượng kế hoạch giáo dục đối với **các môn học trong Chương trình giáo dục phổ thông** (và giáo dục thường xuyên) do Bộ trưởng ban hành. Văn hóa, nghệ thuật, thể thao, tăng cường ngoại ngữ, STEM/STEAM, năng lực số, AI, hướng nghiệp, kỹ năng sống **không thuộc nội dung chương trình môn học thì không thuộc phạm vi** Thông tư | TT 19/2026 Điều 1 (khoản 1 Điều 2 mới), bản gốc | Mỗi chương trình gia sư (trong trường và ở chợ) có trường bắt buộc **"loại nội dung"**: `curriculum` (môn trong chương trình, chịu Thông tư 29) hoặc `enrichment` (bổ trợ ngoài chương trình, theo pháp luật khác). Chỉ `curriculum` chịu các khóa dưới đây. Người tạo phải chọn, có giải thích ngay trên màn hình; quản trị trường duyệt |
| Dạy thêm **trong nhà trường không được thu tiền** của học sinh; chỉ cho học sinh đăng ký tự nguyện thuộc các nhóm: kết quả môn học cuối kỳ liền kề chưa đạt, được chọn bồi dưỡng học sinh giỏi, lớp cuối cấp tự nguyện ôn thi | TT 29/2024 khoản 1 Điều 5 (**chưa xác minh** bản gốc) | Chương trình `curriculum` do trường tổ chức **khóa cứng chế độ "không thu tiền"**: không tạo được khoản thu, không hiện nút trả tiền, máy chủ từ chối; bắt buộc chọn nhóm đối tượng; với nhóm "chưa đạt" hệ thống gợi ý danh sách từ sổ điểm (giáo viên xác nhận); có đơn đăng ký của cha mẹ (19.4, 27b) |
| Mỗi môn **không quá 02 tiết/tuần**; học sinh thuộc nhóm đối tượng cần hơn thì Giám đốc Sở quyết định theo đề nghị của Hiệu trưởng | TT 19/2026 Điều 2 (điểm c khoản 4 Điều 5 mới), bản gốc | Đếm số tiết `curriculum` trong trường theo môn, theo học sinh, theo tuần; vượt 2 thì chặn, trừ khi trường nhập số và ngày quyết định của Sở cho học sinh hoặc nhóm đó (lưu tệp quyết định); độ dài một tiết theo cấu hình cấp học hiện có |
| Không tổ chức dạy thêm cho học sinh **tiểu học**, trừ bồi dưỡng nghệ thuật, thể dục thể thao, rèn luyện kỹ năng sống | TT 29/2024 khoản 1 Điều 4 (**chưa xác minh** bản gốc) | Chương trình `curriculum` không chọn được lớp hoặc học sinh cấp Tiểu học (cả trong trường lẫn ở chợ: hồ sơ trẻ có cấp học); `enrichment` vẫn được |
| Giáo viên đang dạy ở trường **không được dạy thêm ngoài nhà trường có thu tiền đối với học sinh mà mình đang được nhà trường phân công dạy** theo kế hoạch giáo dục | TT 29/2024 khoản 2 Điều 4 (**chưa xác minh** bản gốc; Thông tư 19/2026 không sửa Điều 4) | **Ở chợ mở** (27g, 27h): gia sư khai mình đang là giáo viên trường nào; nếu là trường dùng nền tảng thì so khớp với phân công giảng dạy (`timetable_lessons`, `class_staff_assignments`) khi phụ huynh đặt buổi `curriculum` có thu tiền cho trẻ đã liên kết với trường: **chặn**; nếu không so khớp được (trẻ chưa liên kết, trường không dùng nền tảng) thì cả gia sư và phụ huynh phải tích cam kết "không phải giáo viên đang được phân công dạy trẻ này", ghi lại. **Trong trường**: không áp dụng vì `curriculum` đã không thu tiền |
| Giáo viên trường công lập không được tham gia **quản lý, điều hành** dạy thêm ngoài nhà trường nhưng được tham gia dạy thêm | TT 29/2024 khoản 3 Điều 4 (**chưa xác minh** bản gốc) | Ở chợ: giáo viên công lập không mở được hồ sơ **cơ sở dạy thêm** (đứng tên kinh doanh) cho nội dung `curriculum`; chỉ dạy được với tư cách người dạy thuộc một cơ sở đã đăng ký, hoặc dạy `enrichment`. Luật sư kết luận (19.10, việc E-07) |
| Giáo viên đang dạy ở trường khi tham gia dạy thêm ngoài nhà trường phải **báo cáo Hiệu trưởng** về môn, địa điểm, hình thức, mối quan hệ với chủ thể đứng tên đăng ký kinh doanh cơ sở dạy thêm, thời gian, **trước khi bắt đầu** và cập nhật khi thay đổi (Mẫu 03 sửa bởi Điều 10) | TT 19/2026 Điều 3 (khoản 3 Điều 6 mới), Điều 10, bản gốc | Gia sư ở chợ là giáo viên của trường dùng nền tảng: hệ thống **dựng sẵn báo cáo theo Mẫu 03** từ hồ sơ gia sư, gia sư xem và gửi vào trường (luồng văn bản đến hiện có hoặc việc của tôi của Hiệu trưởng); chưa gửi thì không mở nhận buổi `curriculum`. Trường không dùng nền tảng: tải bản PDF để tự nộp, tích xác nhận đã nộp |
| Tổ chức, cá nhân tổ chức dạy thêm ngoài nhà trường **có thu tiền** (cơ sở dạy thêm) phải **đăng ký kinh doanh** và **công khai, cập nhật thường xuyên trên trang thông tin điện tử hoặc niêm yết**: môn học, thời lượng theo khối lớp, địa điểm, hình thức, thời gian, danh sách người dạy, mức thu, trước khi tuyển sinh (Mẫu 02) | TT 19/2026 Điều 3 (khoản 1 Điều 6 mới), bản gốc | Ở chợ: hồ sơ cơ sở dạy thêm `curriculum` bắt buộc mã số đăng ký kinh doanh hoặc mã số thuế hộ kinh doanh (nhân viên nền tảng duyệt tay, lưu tệp); **trang công khai của từng cơ sở trên chợ dựng theo các mục của Mẫu 02** (môn, thời lượng theo khối, hình thức "trực tuyến", lịch, danh sách người dạy, mức thu), không mở tuyển sinh khi thiếu mục. Trong trường: `enrichment` có thu tiền do trường tổ chức theo quy định thu khác của trường, không phải cơ sở dạy thêm |
| Người dạy thêm ngoài nhà trường phải có phẩm chất đạo đức tốt, năng lực chuyên môn phù hợp môn dạy | TT 19/2026 Điều 3 (khoản 2 Điều 6 mới), bản gốc | Xác minh gia sư (27g): danh tính, bằng cấp hoặc chứng chỉ theo môn, phiếu lý lịch tư pháp; nhân viên nền tảng duyệt |
| Nhà trường, xã, Sở lập **đường dây nóng** tiếp nhận phản ánh dạy thêm trái quy định | TT 19/2026 Điều 5, 7, 8, bản gốc | Trang công khai của trường (18f) và cổng phụ huynh hiện số đường dây nóng của trường (cấu hình); nút "Phản ánh dạy thêm" chuyển vào hộp thư góp ý hiện có |
| Thông tư không nhắc riêng hình thức **trực tuyến** | Đọc toàn văn TT 19/2026; TT 29/2024 qua nguồn thứ cấp | Claude áp mọi ràng buộc trên **cho cả dạy trực tuyến** (định nghĩa dạy thêm theo nội dung, không theo nơi dạy); luật sư xác nhận (việc E-07) |

**2. Giữ tiền rồi chi trả.**
- **Dịch vụ hỗ trợ thu hộ, chi hộ** là dịch vụ trung gian thanh toán: "tiếp nhận, xử lý dữ liệu điện tử, tính toán kết quả thu hộ, chi hộ ... và thực hiện thanh toán cho các bên có liên quan" (khoản 17 Điều 3 Nghị định 52/2024, qua trích dẫn); chỉ tổ chức không phải ngân hàng **được Ngân hàng Nhà nước cấp giấy phép** mới được cung ứng (khoản 5 Điều 3); vốn điều lệ tối thiểu **50 tỷ đồng** cho ví điện tử, thu hộ chi hộ, cổng thanh toán điện tử; tổ chức này mở **tài khoản đảm bảo thanh toán** ở ngân hàng hợp tác (Thông tư 40/2024). Kết luận làm việc của Claude (**luật sư kết luận**): nền tảng **nhận tiền của phụ huynh vào tài khoản của mình rồi chi lại cho gia sư** thì có nguy cơ là cung ứng dịch vụ thu hộ, chi hộ không phép. **Không làm cách đó.**
- **Phương án hợp pháp, theo mô hình:**
  - **Trong trường (mốc 1):** tiền vào **thẳng tài khoản của trường** qua cổng thanh toán của trường (S3) như học phí; nền tảng không chạm tiền. Thù lao giáo viên trả qua **bảng lương của trường** (khoản mục mới), khấu trừ thuế thu nhập cá nhân theo biểu thuế sẵn có. Hoàn tiền qua luồng hoàn hiện có (`payment_refund_sources`).
  - **Chợ mở (mốc 3), phương án A (đề xuất):** dùng tính năng **chia tiền hoặc giữ tiền có điều kiện của một tổ chức có giấy phép** (cổng thanh toán, ví điện tử hoặc ngân hàng có dịch vụ thu hộ, chi hộ, tài khoản đảm bảo); tiền nằm ở tổ chức đó, nền tảng chỉ gửi lệnh "giải ngân", "hoàn", "giữ do tranh chấp" và nhận phần hoa hồng. Bộ nối `MarketplacePaymentProvider` (19.4, 27h), bộ giả lập `mock`; nhà cung cấp thật Eric chọn (việc E-02). Tên tổ chức có dịch vụ như vậy ở Việt Nam: **chưa xác minh**, Eric hỏi báo giá.
  - **Chợ mở, phương án B (dự phòng):** nền tảng **chỉ thu phí dịch vụ** (hoa hồng hoặc phí đăng tin) xuất hóa đơn cho gia sư; phụ huynh trả **thẳng vào tài khoản của gia sư** (mã VietQR của gia sư); nền tảng chỉ ghi nhận xác nhận đã trả. Hoàn tiền và tranh chấp khi đó chỉ là quy trình giữa hai bên có nền tảng hòa giải, không giữ tiền được.
- **Thuế và hóa đơn:** Nghị định 117/2025 giao **tổ chức quản lý nền tảng thương mại điện tử, nền tảng số có chức năng thanh toán** khấu trừ, nộp thay thuế giá trị gia tăng và thu nhập cá nhân của hộ, cá nhân bán hàng tại thời điểm giao dịch thành công, theo tỷ lệ trên doanh thu từng giao dịch (Điều 4, 5 theo nguồn thứ cấp). **Chưa xác minh:** nền tảng ở phương án A có bị coi là "có chức năng thanh toán" không; tỷ lệ áp cho dịch vụ dạy học; dịch vụ dạy học có thuộc diện không chịu thuế giá trị gia tăng không; ngưỡng doanh thu không chịu thuế của hộ, cá nhân năm 2026 (nguồn ghi 200 triệu hoặc 500 triệu đồng, mâu thuẫn). Thiết kế: **hàm tính khấu trừ thuần, tỷ lệ là dữ liệu thiết lập có ngày hiệu lực** (như biểu thuế của bảng lương), có công tắc bật khấu trừ; báo cáo khấu trừ theo kỳ; hóa đơn điện tử cho phần hoa hồng của nền tảng qua `EInvoiceProvider` của S5b (nhà cung cấp thật chưa chốt). Gia sư là hộ kinh doanh tự xuất hóa đơn của mình (nếu phải) ngoài nền tảng.

**3. An toàn trẻ em và dữ liệu.**
- **Đồng ý của cha mẹ:** dữ liệu của trẻ em do người đại diện theo pháp luật thay mặt thực hiện quyền; công bố, tiết lộ đời sống riêng tư của trẻ từ đủ 07 tuổi cần đồng ý của cả trẻ và người đại diện (khoản 2 Điều 24 Luật 91/2025, đã đọc ở S8a). Sản phẩm: **mọi tài khoản học sinh ở chợ mở là hồ sơ con do tài khoản phụ huynh tạo**, trẻ không tự đăng ký; đăng ký lớp video, ghi hình, gửi ảnh câu hỏi đều cần phụ huynh đồng ý từng mục (lưu phiên bản văn bản đồng ý, thời điểm, rút lại được); trẻ từ 7 tuổi thấy câu hỏi đồng ý của chính mình khi vào lớp lần đầu.
- **Ghi hình:** Nghị định 356/2025 Điều 21 khoản 5 nêu "phần mềm giáo dục có yếu tố giám sát như điểm danh, ghi hình" là một loại dịch vụ xử lý dữ liệu cá nhân; câu hỏi nền tảng có phải có Giấy chứng nhận đủ điều kiện đã nằm ở PL-15, **ghi hình lớp video làm câu hỏi đó nặng thêm** (thêm vào PL-15, việc E-06). Sản phẩm: biểu tượng "đang ghi" luôn hiện; trong trường ghi hình **tắt mặc định**, bật theo chương trình khi có đồng ý; ở chợ mở **mọi buổi có trẻ vị thành niên đều ghi** (điều kiện dịch vụ để bảo vệ trẻ và giải quyết tranh chấp, phụ huynh đồng ý khi đặt), giữ **30 ngày** (cùng hạn của 23e), giữ lâu hơn chỉ khi có tranh chấp hoặc báo cáo vi phạm đang mở; chỉ người dự buổi, phụ huynh, quản trị có quyền xem; **không tải xuống**; lưu mã hóa ở kho tệp theo `storageKey`.
- **Kênh liên lạc:** **không có nhắn riêng giữa gia sư và trẻ mà phụ huynh không thấy**: mọi luồng tin nhắn gia sư với trẻ luôn có phụ huynh (trong trường dùng `message_threads` hiện có, thêm người dự luôn là phụ huynh); không gọi video ngoài buổi đã đặt; lọc và cảnh báo số điện thoại, địa chỉ thư, mạng xã hội, liên kết ngoài trong tin nhắn và hồ sơ (cũng chống né hoa hồng); phụ huynh vào xem buổi 1-1 bất cứ lúc nào.
- **Báo cáo vi phạm:** nút báo cáo ở phòng học, tin nhắn, hồ sơ; hàng chờ xử lý của nền tảng (với chợ) và của trường (trong trường) có thời hạn phản hồi, tạm khóa gia sư ngay khi báo cáo mức nghiêm trọng, giữ bằng chứng (bản ghi, tin nhắn), hướng dẫn gọi Tổng đài 111 và chuyển cơ quan có thẩm quyền (**chưa xác minh** thủ tục chuyển).
- **Xác minh lý lịch gia sư ở chợ mở:** danh tính qua bộ nối OIDC của DT-25 (VNeID khi có tổ chức cung cấp dịch vụ xác thực, xem ghi chú khảo sát VNeID: doanh nghiệp tư nhân đi qua tổ chức trung gian), đủ 18 tuổi; bằng cấp, chứng chỉ; **phiếu lý lịch tư pháp** tải lên (bản giấy quét hoặc bản điện tử từ VNeID nếu kênh còn hoạt động, **chưa xác minh**), nhân viên duyệt, hạn 6 tháng (giả định GD-136); không lưu số định danh toàn văn ngoài phần mã hóa cần thiết.

**4. Hạ tầng video** (giá tra ngày 2026-10-26, kiểm lại trang chính thức khi làm):

| Lựa chọn | Giá công bố | Nhận xét |
|---|---|---|
| **LiveKit mã nguồn mở tự host** (SFU, báo hiệu, TURN nhúng, Egress ghi hình ra kho S3) | Phần mềm không thu phí (giấy phép Apache 2.0, **chưa xác minh lại** trên kho mã); trả tiền máy và băng thông | **Chọn.** Có sẵn SDK web, React, iOS, Android (khớp DT-26), Egress ghi thẳng vào R2 hoặc SeaweedFS; dữ liệu trẻ em nằm ở máy chủ trong nước |
| mediasoup tự host | Thư viện mã nguồn mở (giấy phép ISC, **chưa xác minh lại**) | Phải tự viết báo hiệu, quản phòng, ghi hình; nhiều việc hơn cho cùng kết quả |
| LiveKit Cloud | Gói Ship 50 USD/tháng gồm 150.000 phút, sau đó 0,0005 USD/phút người dự, băng thông tải xuống 250 GB rồi 0,12 USD/GB; gói Scale 500 USD/tháng, 0,0004 USD/phút, 3 TB rồi 0,10 USD/GB; ghi hình (Egress) 0,001 USD/phút, chuyển mã 0,015 đến 0,02 USD/phút (`livekit.com/pricing.md`) | Giữ làm **bộ nối dự phòng** (cùng SDK); máy chủ ngoài nước nên vướng chuyển dữ liệu trẻ em xuyên biên giới |
| Cloudflare Realtime (SFU, TURN) | 1.000 GB đầu mỗi tháng miễn phí, sau đó 0,05 USD/GB dữ liệu đi ra (`developers.cloudflare.com/realtime/sfu/pricing`) | Rẻ nhất về băng thông; khác SDK, phải tự làm ghi hình; ngoài nước. Ghi làm phương án cho hồ sơ thử nghiệm miễn phí |
| Cloudflare R2 (lưu bản ghi) | 0,015 USD/GB-tháng, không tính phí dữ liệu ra (nguồn thứ cấp `filebase.com`, **chưa xác minh** trên trang Cloudflare) | Kho tệp của hồ sơ thử nghiệm; hồ sơ vận hành dùng SeaweedFS trên VPS (14.4) |

**Ước lượng băng thông** (giả định, đo lại ở 27a): video 720p khoảng 1,2 Mbit/s, kèm tiếng khoảng 1,3 Mbit/s; luồng nhỏ của học sinh khi có giả lập nhiều lớp (simulcast) khoảng 0,3 Mbit/s.
- Lớp 1-1: máy chủ gửi đi khoảng 2 × 1,3 = 2,6 Mbit/s, tức khoảng **1,2 GB mỗi giờ phòng**.
- Nhóm 6 người (1 gia sư, 5 học sinh): luồng gia sư tới 5 học sinh 6,5 Mbit/s, mỗi học sinh nhận 4 luồng nhỏ 1,2 Mbit/s (cộng 6 Mbit/s), gia sư nhận 5 luồng nhỏ 1,5 Mbit/s: khoảng 14 Mbit/s, tức khoảng **6,3 GB mỗi giờ phòng**.
- Bản ghi tổng hợp 720p khoảng 1,5 đến 2 Mbit/s: **0,7 đến 0,9 GB mỗi giờ**; giữ 30 ngày.
- Ví dụ 1.000 giờ phòng 1-1 mỗi ngày: khoảng 35 TB/tháng đi ra. Cloudflare Realtime khoảng 34.000 GB × 0,05 ≈ 1.700 USD/tháng; LiveKit Cloud gói Scale khoảng 3,6 triệu phút người dự × 0,0004 ≈ 1.440 USD cộng 32 TB × 0,10 ≈ 3.200 USD, cộng phí gói, khoảng **5.100 USD/tháng**; tự host: trung bình khoảng 110 Mbit/s, giờ cao điểm buổi tối giả định gấp 4 lần, cần **cổng 1 Gbit/s** và khoảng 8 đến 16 nhân cho SFU cộng máy ghi hình (Egress khoảng 2 đến 4 nhân cho mỗi bản ghi 720p đồng thời, **chưa xác minh**). Giá băng thông VPS trong nước **chưa xác minh**, Eric hỏi báo giá (việc E-05). Ghi hình 1.000 giờ/ngày giữ 30 ngày khoảng 24 TB thường trực, R2 khoảng 360 USD/tháng.
- Kết luận: tự host LiveKit trên VPS trong nước ở hồ sơ vận hành; bộ nối cho phép đổi sang LiveKit Cloud hoặc tắt ghi hình theo gói; **giới hạn phút video và dung lượng bản ghi là giới hạn của gói** (S5a) để chi phí đi cùng doanh thu.

### 19.3 Nguyên tắc

- **Dùng lại, không dựng song song:** thời khoá biểu, phân công, điểm danh, sổ điểm, thu phí và bảng lương của trường, cổng thanh toán theo trường (S3), ngân hàng câu hỏi và đề (22g1, 22g2), kho học liệu (22h1), lượt làm bài và kênh `student` (23a), `AiProvider` (23d), coturn (23e), bộ nối OIDC (DT-25), nhắn tin và thông báo hiện có. Phần mới chỉ thêm bảng cho thứ chưa có (phòng video, chương trình gia sư, buổi, khoá học, câu hỏi bài tập, và toàn bộ chợ mở).
- **Tiền đi theo mô hình:** trong trường **tiền vào tài khoản của trường**, nền tảng không chạm; ở chợ mở **tiền nằm ở tổ chức có giấy phép**, nền tảng chỉ ra lệnh và nhận hoa hồng. Không dùng tài khoản nhận tiền của S5b cho tiền học của phụ huynh. **Không bật thu tiền ở chợ mở trên môi trường thật trước khi Eric chốt E-01 đến E-04 và luật sư rà** (19.10).
- **Quy định dạy thêm là luật của máy chủ:** mọi khóa ở 19.2 mục 1 kiểm ở máy chủ, có kiểm thử đơn vị theo từng dòng của bảng; số liệu (2 tiết, cấp học được miễn) là cấu hình có ngày hiệu lực để khi văn bản đổi thì đổi dữ liệu bằng YCTD, không sửa mã.
- **Trẻ em trước:** phụ huynh luôn thấy, luôn đồng ý trước, rút lại được; không kênh riêng; ghi hình có thời hạn; dữ liệu trẻ ở chợ mở tối thiểu (tên hiển thị, năm sinh, cấp học, lớp), không thu số định danh của trẻ.
- **Hai sản phẩm, một mã nguồn:** gia sư trong trường chạy trong bộ cơ sở dữ liệu của từng trường (cả hai bố cục `database`, `schema`, đạt kiểm tĩnh đa thuê bao 14.7); chợ mở dùng **cơ sở dữ liệu chung mới `marketplace`** (loại migration mới, vai trò PostgreSQL riêng) vì người dùng chợ không thuộc trường nào; chợ đọc dữ liệu trường **chỉ qua API có đồng ý** (liên kết trẻ với trường, so khớp phân công), không đọc thẳng cơ sở dữ liệu trường.
- **Không đổi hành vi phần đã có:** mọi e2e và kiểm thử đơn vị hiện có đạt không sửa kỳ vọng; trường không bật phân hệ "Gia sư trực tuyến" thì không thấy gì mới.
- **Kiểm thử không gọi dịch vụ ngoài thật:** video, thanh toán, xác minh danh tính, AI đều có bộ giả lập `mock`; dữ liệu mẫu bịa; không dán khóa vào tài liệu.

### 19.4 Các phần

Số giữ sẵn bắt đầu **sau dải đã thấy của DT-23 (đến YCTD-219), DT-24 (YCTD-220, định danh 0130, nền tảng 0210, 0211) và DT-25 (YCTD-225, định danh 0140) và DT-26 (mục 18, PR 178: YCTD-230 đến YCTD-244, năm học 0140 đến 0149, hệ thống 0090 đến 0099, định danh 0160 đến 0169, nền tảng 0230 đến 0239, e2e `180-` đến `189-`, GD-120 đến GD-127, RR-25 đến RR-27)**: YCTD-250 cho chính bản kế hoạch này, YCTD-251 đến YCTD-259 cho chín phần, YCTD-260 đến YCTD-264 dự phòng. Migration: năm học 0150 đến 0169, hệ thống 0100 đến 0109, định danh 0170 đến 0179, nền tảng 0240 đến 0249, **cơ sở dữ liệu mới `marketplace` từ 0001** (mỗi phần một khối 10 số). e2e `190-` đến `198-`, `199-` đến `204-` dự phòng (`160-` đến `179-` DT-26 đã chừa cho DT-24, DT-25). **Nếu lúc gộp nhánh chính đã dùng một số trong dải này thì đánh lại theo nhánh chính lúc gộp và ghi vào YCTD của phần.**

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD | Migration | e2e |
|---|---|---|---|---|---|---|
| 27a | Lớp video trực tiếp: bộ nối `VideoRoomProvider` (`livekit` tự host, `livekit-cloud` dự phòng, `mock`), dịch vụ `livekit` và Egress trong hồ sơ vận hành, dùng chung coturn với 23e; phòng 1-1 và nhóm nhỏ (tối đa 8 người dự mặc định, cấu hình), vào phòng bằng mã ngắn hạn do máy chủ cấp theo vai trò; bảng trắng (thư viện mã nguồn mở có giấy phép dùng thương mại, chọn lúc làm), chia sẻ màn hình, tắt tiếng, phòng chờ; ghi hình vào kho tệp theo `storageKey`, thời hạn giữ và xóa tự động, xem lại không tải xuống; phụ huynh vào xem; nhật ký vào ra phòng (nguồn điểm danh); giới hạn phút video và dung lượng bản ghi theo gói (S5a) | 1 | 23a đã gộp (kênh `student`); dùng coturn của 23e nếu đã gộp, chưa thì 27a thêm coturn và 23e dùng lại | YCTD-251 | Năm học 0150, 0151; hệ thống 0100; nền tảng 0240 | 190 (kèm kiểm cách ly phòng video ở nhiều trường: mở rộng `MULTI_TENANT_SPEC`, chỉ 27a sửa ở đợt 1) |
| 27b | Chương trình gia sư trong trường, lịch và đặt buổi, điểm danh: chương trình (môn, lớp hoặc nhóm, giáo viên, **loại nội dung `curriculum` hoặc `enrichment`**, nhóm đối tượng theo Thông tư 29, có thu tiền hay không), buổi học lặp theo tuần tránh trùng thời khoá biểu, đăng ký của học sinh có **đơn của cha mẹ** trên ứng dụng phụ huynh, kiểm tra 2 tiết/tuần/môn, chặn Tiểu học với `curriculum`, quyết định tăng thời lượng của Sở; điểm danh tự động từ nhật ký phòng (27a) và giáo viên xác nhận, ghi vắng báo phụ huynh; tin nhắn luôn có phụ huynh; đường dây nóng của trường | 1 | 22c (thời khoá biểu) đã gộp; 27a cho phòng (làm song song: 27b gọi giao diện phòng qua bộ giả lập đến khi 27a gộp) | YCTD-252 | Năm học 0152 đến 0154 | 191 |
| 27c | Thu phí và chi trả trong trường theo quy định: chương trình `curriculum` khóa cứng "không thu tiền"; `enrichment` có thu tạo khoản thu trên hóa đơn của trường (`fee_schedules`, `invoices`), thu qua cổng của trường (S3), hoàn tiền buổi hủy qua luồng hoàn hiện có; **thù lao giáo viên** tính theo buổi đã dạy và điểm danh xác nhận, đẩy vào bảng lương (khoản mục mới, thuế thu nhập cá nhân theo biểu sẵn có); báo cáo thu chi theo chương trình; kinh phí dạy thêm `curriculum` lấy từ nguồn hợp pháp của trường (chỉ ghi nhận, không thu của học sinh) | 2 | 27b | YCTD-253 | Năm học 0155, 0156 | 192 |
| 27d | Khoá học ghi sẵn: khoá học, chương, bài; bài là học liệu của kho 22h1 (video tải lên kho tệp, phát theo đoạn có kiểm quyền, không tải xuống) hoặc bài tập (đề của 22g1 giao qua lượt làm của 23a); tiến độ theo học sinh (đã xem bao nhiêu phần trăm, bài tập đã làm), giáo viên và phụ huynh xem; giao khoá cho lớp, nhóm, chương trình 27b; khoá công khai trong trường. **Cập nhật YCTD-270: xây trên lõi LMS của DT-28** (khoá, chương, hoạt động, kết quả hoạt động, tiến độ là của 28b, 28d; 27d chỉ thêm phần riêng của gia sư: gắn khoá với chương trình 27b, phát video theo đoạn, chuyển mã tuỳ chọn) | 2 (bắt đầu sau DT-28 đợt 2) | 23a, 22h1 đã gộp; **28b, 28d đã gộp** | YCTD-254 | Hệ thống 0101 đến 0103 (khoá học dùng qua nhiều năm học); năm học 0157 (tiến độ) | 193 |
| 27e | Hỏi đáp bài tập: học sinh gửi câu hỏi (chữ, ảnh) theo môn, chương trình hoặc khoá; hàng chờ của giáo viên phụ trách, nhận câu, trả lời (chữ, ảnh, liên kết học liệu hoặc câu trong ngân hàng), học sinh đánh dấu đã hiểu; **gợi ý của AI 23d luôn là bản nháp chỉ giáo viên thấy**, giáo viên sửa rồi mới gửi, câu trả lời mang dấu "có AI hỗ trợ"; chỉ gửi phần chữ đã quét thông tin cá nhân như 23d, **không gửi ảnh của học sinh cho AI**, phụ huynh bật tắt việc dùng AI cho con; hạn mức theo gói 23d. **Cập nhật YCTD-270: xây trên bộ máy hỏi đáp của 28e** (câu hỏi, trả lời, xác nhận, hàng chờ, an toàn trẻ em là của 28e; 27e thêm hàng chờ theo chương trình, khoá của gia sư và gợi ý AI) | 2 (bắt đầu sau DT-28 đợt 2) | 23a, 23d đã gộp; **28e đã gộp** | YCTD-255 | Năm học 0158, 0159 | 194 |
| 27f | Nền chợ gia sư: cơ sở dữ liệu `marketplace` và loại migration mới, vai trò PostgreSQL riêng; ứng dụng web mới `apps/market` trên tên miền con dành riêng của nền tảng (trang công khai, tài khoản phụ huynh, tài khoản gia sư); đăng nhập riêng của chợ (mật khẩu, mã xác nhận, OIDC của DT-25), hồ sơ con do phụ huynh tạo, đồng ý của phụ huynh theo phiên bản văn bản; **liên kết tùy chọn** với tài khoản phụ huynh ở trường (luồng chuyển đăng nhập của DT-24, có đồng ý) để biết trẻ học trường nào; hồ sơ gia sư và cơ sở dạy thêm ở mức tối thiểu; cấu hình chợ trong cổng nền tảng | 3 | 27a đến 27e đã gộp; DT-24, DT-25 đã gộp | YCTD-256 | Marketplace 0001 đến 0009; định danh 0170 (liên kết) | 195 (kiểm cách ly chợ với các trường: mở rộng `MULTI_TENANT_SPEC`, chỉ 27f sửa ở đợt 3) |
| 27g | Hồ sơ gia sư, xác minh, tìm kiếm, đánh giá: hồ sơ (môn, cấp học, loại nội dung, giá, lịch trống, giới thiệu), xác minh danh tính qua OIDC (VNeID khi có), đủ 18 tuổi, bằng cấp, phiếu lý lịch tư pháp, đăng ký kinh doanh cho `curriculum`, khai là giáo viên trường nào và **báo cáo Mẫu 03 cho Hiệu trưởng**; hàng chờ duyệt của nhân viên nền tảng; **trang công khai theo Mẫu 02**; tìm kiếm và lọc (môn, cấp, giá, lịch, đánh giá); đánh giá sau buổi chỉ của phụ huynh đã học, kiểm duyệt, trả lời của gia sư | 4 | 27f | YCTD-257 | Marketplace 0010 đến 0019 | 196 |
| 27h | Đặt buổi, thanh toán, hoa hồng, chi trả, hoàn tiền, tranh chấp: đặt buổi lẻ hoặc gói buổi, giữ chỗ có hạn, **chặn giáo viên đang được phân công dạy trẻ** với `curriculum` có thu tiền, phòng video của 27a ở ngữ cảnh chợ; bộ nối `MarketplacePaymentProvider` (`mock`, nhà cung cấp có phép khi Eric chọn; phương án B "trả thẳng gia sư" là cấu hình); quy tắc hoa hồng cấu hình (tỷ lệ, tối thiểu, theo loại nội dung), giải ngân sau buổi khi hết thời gian khiếu nại, hoàn tiền theo chính sách hủy, **tranh chấp giữ tiền** và hòa giải có bằng chứng (bản ghi, điểm danh, tin nhắn); hàm tính thuần cho hoa hồng, hoàn, khấu trừ thuế (tỷ lệ là dữ liệu có ngày hiệu lực, công tắc bật); hóa đơn hoa hồng qua `EInvoiceProvider`; đối soát với nhà cung cấp; báo cáo khấu trừ | 4 | 27f; 27g cho hồ sơ đầy đủ (làm song song, dùng hồ sơ tối thiểu của 27f) | YCTD-258 | Marketplace 0020 đến 0029 | 197 |
| 27i | An toàn trẻ em và kiểm duyệt ở chợ: tin nhắn trong chợ luôn có phụ huynh, lọc và cảnh báo thông tin liên lạc ngoài; báo cáo vi phạm từ phòng, tin nhắn, hồ sơ, đánh giá; hàng chờ kiểm duyệt có mức độ và thời hạn, tạm khóa ngay, giữ bằng chứng (kéo dài hạn giữ bản ghi), hướng dẫn Tổng đài 111; nhật ký kiểm duyệt; trang chính sách an toàn trẻ em; chỉ số an toàn trên bảng điều khiển nền tảng | 4 | 27f | YCTD-259 | Marketplace 0030 đến 0039 | 198 |

Giữ chỗ chưa giao: YCTD-260 đến YCTD-264; năm học 0160 đến 0169; hệ thống 0104 đến 0109; định danh 0171 đến 0179; nền tảng 0241 đến 0249; marketplace 0040 đến 0049; e2e `199-` đến `204-`.

Đợt làm, mỗi lúc **tối đa ba phiên**, **không hai phiên cùng sửa một tệp lõi trong cùng đợt**:
- **Đợt 1: 27a, 27b.** 27a sửa `deploy/` (dịch vụ `livekit`, Egress, coturn nếu 23e chưa có), phân hệ video mới, `MULTI_TENANT_SPEC`, `database/platform/` (giới hạn gói); 27b sửa phân hệ gia sư mới ở năm học, trang trong `apps/teacher`, `apps/parent`, `apps/portal`, chỉ đọc thời khoá biểu. Đăng ký mô-đun, tuyến, menu theo kiểu **thêm cuối tệp** (`application.module.ts`, `platform-menu.ts`, `PORTAL_WORKSPACES`).
- **Đợt 2: 27c, 27d, 27e.** 27c là phần duy nhất sửa `fees/`, `finance/`, `payroll/`; 27d sửa phân hệ khoá học mới và chỉ thêm hàm đọc ở `learning-resources/`; 27e là phần duy nhất sửa phân hệ AI của 23d (thêm mẫu lời nhắc "gợi ý trả lời bài tập"). **Mốc 1 "gia sư trong trường" xong khi 27a, 27b, 27c gộp.** Cập nhật YCTD-270: 27d, 27e chỉ bắt đầu khi DT-28 đợt 2 (28c, 28d, 28e) đã gộp vì xây trên lõi LMS (mục 20.6); 27c không đổi.
- **Đợt 3: 27f** một mình (dựng cơ sở dữ liệu `marketplace`, loại migration mới trong `database/`, ứng dụng `apps/market`, `MULTI_TENANT_SPEC`): các phần sau đều dựa vào.
- **Đợt 4: 27g, 27h, 27i.** Mỗi phần một thư mục con trong phân hệ chợ; chỉ 27h sửa phần thanh toán và `billing/` (hóa đơn hoa hồng); chỉ 27g sửa luồng đăng nhập chợ (xác minh OIDC); chỉ 27i sửa tin nhắn chợ. Thêm bảng và tuyến theo kiểu thêm cuối.

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH, PQ, mã chức năng): theo thứ tự xong trong từng đợt; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. YCTD, migration, e2e giữ sẵn ở bảng trên không đổi theo thứ tự gộp (trừ khi va với nhánh chính như đã nói).

Cỡ ước lượng (một phần của DT-16 là một đơn vị): 27a 1,75; 27b 1,25; 27c 1; 27d 1,25; 27e 1; 27f 1,75; 27g 1,25; 27h 1,75; 27i 1; tổng khoảng 12 đơn vị.

**Điều kiện ra** (nghiệm thu với Eric, dữ liệu giả):
- **Mốc 1:** một trường lập chương trình phụ đạo `curriculum` không thu tiền cho học sinh lớp 9 có kết quả chưa đạt, hệ thống chặn khi thêm tiết thứ ba trong tuần và khi chọn lớp Tiểu học; phụ huynh gửi đơn đăng ký; giáo viên dạy một buổi video nhóm có bảng trắng, chia sẻ màn hình, ghi hình (khi bật), điểm danh tự động rồi xác nhận; một chương trình `enrichment` có thu tạo khoản thu trên hóa đơn của trường, thu qua cổng giả lập của trường, buổi hủy được hoàn; thù lao vào bảng lương; chạy ở cả hai bố cục; cách ly (14.7) đạt.
- **Mốc 2:** khoá học có video và bài tập, tiến độ hiện cho giáo viên và phụ huynh; học sinh gửi câu hỏi, giáo viên dùng gợi ý AI giả lập, bản nháp không đến học sinh khi chưa gửi.
- **Mốc 3:** phụ huynh không thuộc trường nào đăng ký, tạo hồ sơ con, tìm gia sư đã xác minh (OIDC giả lập), đặt và trả một buổi qua nhà cung cấp giả lập, buổi có ghi hình, giải ngân trừ hoa hồng sau hạn khiếu nại; một buổi khác bị tranh chấp thì tiền bị giữ và hoàn sau hòa giải; giáo viên đang được phân công dạy trẻ bị chặn khi nhận buổi `curriculum` có thu tiền; báo cáo vi phạm tạm khóa gia sư; trang gia sư có đủ mục của Mẫu 02; cách ly chợ với các trường đạt. **Không mở chợ mở có tiền thật trước khi 19.10 mục E-01 đến E-07 xong.**

### 19.5 Phạm vi chi tiết

**27a. Lớp video trực tiếp**
- **Bộ nối:** `VideoRoomProvider` (tạo phòng, cấp mã vào phòng theo người và quyền, kết thúc phòng, bắt đầu và dừng ghi, nhận sự kiện vào ra qua địa chỉ gọi lại có chữ ký); bộ nối `livekit` (tự host, địa chỉ và khóa là cấu hình của nền tảng, lưu mã hóa ở `platform`), `livekit-cloud` (cùng mã, khác địa chỉ), `mock` (kiểm thử, phát sự kiện giả). Không có `if` theo nhà cung cấp trong mã nghiệp vụ.
- **Phòng:** gắn với một buổi (27b, 27h) hoặc phòng tức thời của giáo viên; tên phòng có mã trường để không trùng giữa trường; mã vào phòng ngắn hạn (mặc định 10 phút để vào, hết buổi thì hết), quyền theo vai trò (gia sư: chia sẻ, ghi, tắt tiếng người khác; học sinh: nói, chia sẻ khi được cho; phụ huynh: xem, nói khi được cho); phòng chờ, gia sư cho vào; tối đa người dự cấu hình.
- **Bảng trắng và chia sẻ màn hình:** bảng trắng đồng bộ qua kênh dữ liệu của phòng, lưu ảnh bảng cuối buổi vào buổi học (tuỳ chọn); thư viện mã nguồn mở có giấy phép dùng thương mại, chọn và ghi giấy phép lúc làm (GD-137).
- **Ghi hình:** Egress ghi tổng hợp vào kho tệp theo `storageKey('video-recordings', …)`; bật theo cấu hình (19.2 mục 3), luôn hiện "đang ghi"; thời hạn giữ theo cấu hình trường (mặc định 30 ngày) và xóa bằng việc nền theo trường của S1b; giữ thêm khi có cờ tranh chấp hoặc báo cáo; xem lại bằng đường dẫn ký ngắn hạn, không có nút tải; mỗi lần xem ghi nhật ký.
- **Hạ tầng:** hồ sơ vận hành thêm dịch vụ `livekit` và `egress` vào `deploy/docker-compose.production.yml`, mở cổng UDP; coturn dùng chung với 23e; hồ sơ thử nghiệm miễn phí dùng `livekit-cloud` hoặc tắt video theo gói (không có máy chạy SFU miễn phí); tài liệu vận hành ghi cách đo băng thông thật.
- **Gói và đo:** giới hạn mới của gói (nền tảng 0240): số phút người dự mỗi tháng, dung lượng bản ghi; đo từ sự kiện vào ra, chặn mở phòng mới khi vượt, hiển thị còn lại.

**27b. Chương trình gia sư trong trường, lịch, điểm danh**
- **Chương trình:** tên, môn, cấp, lớp hoặc danh sách học sinh, giáo viên (một hoặc nhiều), loại nội dung, nhóm đối tượng (với `curriculum` trong trường), có thu tiền (với `curriculum` luôn "không", máy chủ khóa), hình thức (video trực tiếp, khoá học, hỏi đáp, kết hợp), ngày bắt đầu, kết thúc; quản trị trường duyệt trước khi mở đăng ký.
- **Buổi:** lặp theo tuần hoặc lẻ, kiểm trùng với thời khoá biểu chính khóa của giáo viên và lớp (22c), kiểm **2 tiết/tuần/môn/học sinh** cho `curriculum` (đếm cả các chương trình khác cùng môn), ngoại lệ có quyết định của Sở (số, ngày, tệp, học sinh áp dụng).
- **Đăng ký:** phụ huynh thấy chương trình mở trên ứng dụng phụ huynh, đọc nội dung, bấm gửi **đơn đăng ký** (văn bản theo mẫu của trường, lưu phiên bản); giáo viên chủ nhiệm hoặc quản trị duyệt; rút đăng ký.
- **Điểm danh:** từ nhật ký vào ra phòng (vào muộn, ra sớm theo ngưỡng), giáo viên xác nhận hoặc sửa; vắng thì báo phụ huynh qua thông báo hiện có; buổi bị hủy báo mọi người.
- **Nhắn tin:** luồng tin nhắn của chương trình luôn có phụ huynh của học sinh; giáo viên không mở được luồng riêng với học sinh mà không có phụ huynh.

**27c. Thu phí và chi trả trong trường**
- **Khóa "không thu tiền":** `curriculum` do trường tổ chức không tạo khoản thu (máy chủ chặn, có kiểm thử); màn hình ghi rõ căn cứ.
- **Khoản thu `enrichment`:** tạo dòng biểu phí và khoản thu theo buổi hoặc trọn gói vào hóa đơn hiện có của học sinh; thu qua cổng của trường (S3); hủy buổi do trường thì hoàn hoặc trừ kỳ sau theo cấu hình qua luồng hoàn hiện có.
- **Thù lao:** đơn giá theo giáo viên hoặc chương trình, tính theo buổi đã dạy có điểm danh xác nhận; tạo khoản thu nhập trong bảng lương kỳ (khoản mục "thù lao dạy phụ đạo, bồi dưỡng"), chịu thuế thu nhập cá nhân theo biểu thuế sẵn có; với `curriculum` nguồn chi là kinh phí của trường (ghi nguồn, không gắn với thu của học sinh).
- **Báo cáo:** thu, hoàn, chi thù lao theo chương trình và kỳ; xuất Excel.

**27d. Khoá học ghi sẵn**
- **Cập nhật YCTD-270:** khoá, chương, hoạt động, điều kiện mở, kết quả hoạt động, tiến độ cho học sinh, giáo viên, phụ huynh dùng lõi LMS của 28b, 28d (mục 20.7); khoá học ghi sẵn là một `course_space` loại khoá của chương trình gia sư; bảng hệ thống 0101 đến 0103 chỉ dùng nếu còn phần riêng của gia sư, không dựng bảng khoá học thứ hai.
- Khoá, chương, bài; bài video dùng học liệu của 22h1 (tải lên đi qua kiểm duyệt của 22h1, giấy phép theo 22h1); phát theo đoạn có kiểm quyền và đường dẫn ký ngắn hạn, không tải xuống; chuyển mã nhiều độ phân giải là tuỳ chọn ở việc nền (bật theo gói, mặc định tắt: phát tệp MP4 gốc).
- Bài tập: đề đã duyệt của 22g1 giao qua lượt làm của 23a; điểm không tự vào sổ điểm (theo 23a cần giáo viên xác nhận).
- Tiến độ: phần trăm đã xem (ghi theo nhịp, không ghi mỗi giây), bài tập đã nộp, điểm; màn hình cho học sinh, giáo viên, phụ huynh.

**27e. Hỏi đáp bài tập**
- **Cập nhật YCTD-270:** câu hỏi, trả lời, xác nhận câu trả lời, hàng chờ, lọc và báo cáo dùng bộ máy hỏi đáp `question_board` của 28e (mục 20.7); 27e chỉ thêm phạm vi chương trình, khoá của gia sư, thời hạn trả lời theo chương trình và gợi ý AI.
- Câu hỏi: chữ, tối đa vài ảnh (nén ở máy, xóa siêu dữ liệu ảnh), gắn môn, chương trình hoặc khoá; hàng chờ theo môn và người phụ trách, thời hạn trả lời cấu hình, nhắc khi quá hạn.
- Trả lời: chữ, ảnh, liên kết học liệu hoặc câu hỏi trong ngân hàng; học sinh đánh dấu đã hiểu hoặc hỏi thêm; phụ huynh xem.
- **AI:** nút "Gợi ý bằng AI" cho giáo viên; dùng `AiProvider` của 23d với mẫu lời nhắc cố định chỉ chứa môn, lớp, nội dung chữ của câu hỏi **sau khi quét** mẫu số điện thoại, thư điện tử, số định danh, tên trong danh sách trường (như 23d); **không gửi ảnh, không gửi tên học sinh**; kết quả là bản nháp chỉ giáo viên thấy; câu trả lời đã gửi ghi "có AI hỗ trợ"; nhật ký và hạn mức theo 23d; phụ huynh tắt được AI cho con (mặc định theo cấu hình trường); trường tắt AI thì nút không hiện.

**27f. Nền chợ gia sư**
- **Cơ sở dữ liệu `marketplace`:** loại migration mới chạy bằng cùng công cụ migrate (như `platform`), vai trò riêng `marketplace`, không có quyền trên cơ sở dữ liệu trường; bố cục `schema` ở hồ sơ thử nghiệm.
- **Ứng dụng `apps/market`:** trang công khai (tìm gia sư, trang gia sư theo Mẫu 02, chính sách), khu phụ huynh, khu gia sư; dùng gói giao diện chung; tên miền con dành riêng cấu hình ở `platform_settings`.
- **Tài khoản:** phụ huynh đăng ký bằng thư điện tử hoặc số điện thoại có mã xác nhận, hoặc OIDC (DT-25); hồ sơ con (tên hiển thị, năm sinh, cấp, lớp), không có tài khoản riêng cho trẻ dưới 16 tuổi (giả định GD-135, trẻ vào lớp qua đường dẫn của phụ huynh mở trên máy của trẻ); văn bản điều khoản, chính sách, đồng ý có phiên bản.
- **Liên kết với trường (tùy chọn):** phụ huynh của trường dùng nền tảng bấm "liên kết" và đăng nhập ở trường (luồng chuyển đăng nhập DT-24), chợ chỉ nhận mã trường, mã học sinh dạng băm và cấp lớp; dùng cho so khớp phân công (27h).
- **Cấu hình chợ** trong cổng nền tảng: bật tắt chợ, tên miền, văn bản pháp lý, hạn giữ bản ghi, tỷ lệ hoa hồng mặc định (dữ liệu, 27h dùng).

**27g. Hồ sơ gia sư, xác minh, tìm kiếm, đánh giá**
- Hồ sơ: ảnh, giới thiệu, môn, cấp, loại nội dung, giá theo buổi hoặc gói, lịch trống, ngôn ngữ dạy.
- Xác minh từng bậc, hiển thị huy hiệu theo bậc: danh tính (OIDC, đủ 18 tuổi), bằng cấp, lý lịch tư pháp, đăng ký kinh doanh (bắt buộc trước khi nhận buổi `curriculum` có thu); hàng chờ duyệt của nhân viên nền tảng có nhật ký; tệp giấy tờ lưu mã hóa, chỉ nhân viên duyệt xem.
- Giáo viên đang dạy ở trường: khai trường, môn, lớp; giáo viên công lập không mở được cơ sở dạy thêm `curriculum` (19.2 mục 1); dựng báo cáo Mẫu 03 gửi Hiệu trưởng.
- Trang công khai theo Mẫu 02; tìm kiếm có lọc và sắp xếp (đánh giá, giá, giờ trống); không hiện số điện thoại, địa chỉ của gia sư.
- Đánh giá: chỉ phụ huynh có buổi đã hoàn thành, một đánh giá mỗi gói, kiểm duyệt theo từ khoá và báo cáo, gia sư trả lời một lần.

**27h. Đặt buổi, thanh toán, hoa hồng, chi trả, hoàn tiền, tranh chấp**
- Đặt buổi: chọn gia sư, con, nội dung, giờ (múi giờ Việt Nam), giữ chỗ trong thời hạn trả tiền; kiểm Tiểu học với `curriculum`; **so khớp phân công** với trẻ đã liên kết, chặn nếu trùng; cam kết khi không so khớp được.
- Thanh toán: `MarketplacePaymentProvider` (tạo lệnh thu có giữ, giải ngân chia hoa hồng, hoàn một phần hoặc toàn phần, giữ khi tranh chấp, nhận sự kiện có chữ ký, đối soát); `mock`; phương án B: chỉ ghi nhận phụ huynh đã chuyển thẳng cho gia sư và thu hoa hồng của gia sư qua hóa đơn kỳ (S5b mở rộng cho đối tượng gia sư hoặc bảng riêng, chốt khi làm).
- Hoa hồng: quy tắc cấu hình (tỷ lệ phần trăm, tối thiểu, theo loại nội dung, theo gia sư), **tỷ lệ cụ thể Eric chốt** (E-01); hàm tính thuần, số nguyên đồng, kiểm thử đơn vị.
- Giải ngân: tự động sau buổi khi điểm danh hai bên có mặt và hết **thời hạn khiếu nại** (mặc định 48 giờ, GD-133); hủy trước giờ học theo chính sách hủy (GD-134).
- Tranh chấp: phụ huynh mở trong thời hạn khiếu nại; tiền bị giữ; hai bên nộp trình bày; nhân viên nền tảng xem bản ghi (kéo dài hạn giữ), điểm danh, tin nhắn; quyết định hoàn toàn phần, một phần hoặc giải ngân, có lý do và nhật ký; khiếu nại lần hai do người khác xét.
- Thuế và hóa đơn: hàm khấu trừ theo dữ liệu tỷ lệ có ngày hiệu lực, công tắc bật (19.2 mục 2); hóa đơn hoa hồng qua `EInvoiceProvider`; báo cáo khấu trừ, báo cáo doanh thu theo gia sư.

**27i. An toàn trẻ em và kiểm duyệt ở chợ**
- Tin nhắn chợ: luồng giữa gia sư và phụ huynh (trẻ đọc khi phụ huynh cho), không có luồng gia sư với trẻ không có phụ huynh; lọc và che thông tin liên lạc ngoài, cảnh báo, đếm số lần, nhiều lần thì gắn cờ.
- Báo cáo vi phạm: phân loại (an toàn trẻ em, quấy rối, gian lận, né hoa hồng, nội dung sai), mức độ; mức nghiêm trọng từ phụ huynh đã học với gia sư (buổi đã trả tiền hoặc luồng tin nhắn gia sư đã trả lời) tạm khóa ngay hồ sơ, chặn đặt buổi và giữ tiền, nhân viên xác nhận thì hủy mọi buổi sắp tới và báo phụ huynh có buổi với gia sư đó (YCTD-322); báo cáo khác vào hàng chờ theo hạn; giữ bằng chứng; hướng dẫn Tổng đài 111; xuất hồ sơ cho cơ quan có thẩm quyền khi có yêu cầu hợp lệ (có nhật ký).
- Kiểm duyệt: hàng chờ, thời hạn theo mức, người xử lý, quyết định có lý do, kháng nghị; chỉ số trên bảng điều khiển nền tảng.
- Trang chính sách an toàn trẻ em (văn bản ở `33_HO_SO_PHAP_LY` PL-19).

### 19.6 Quyết định thiết kế và phương án đã loại

- **Trong trường tiền vào tài khoản trường, chợ mở tiền nằm ở tổ chức có phép:** đúng Nghị định 52/2024 theo cách hiểu hiện tại; phương án đã loại: nền tảng thu tất cả vào tài khoản của mình rồi chi lại (có nguy cơ là thu hộ chi hộ không phép); nền tảng tự xin giấy phép trung gian thanh toán (vốn tối thiểu 50 tỷ đồng, không hợp giai đoạn này); nền tảng đứng ra bán lại dịch vụ dạy học (nền tảng thành cơ sở dạy thêm, gánh nghĩa vụ Thông tư 29 và thuế trên toàn bộ tiền học).
- **`curriculum` trong trường khóa cứng không thu tiền:** đúng khoản 1 Điều 5 Thông tư 29; phương án đã loại: chỉ cảnh báo (dễ sai, trường chịu trách nhiệm).
- **Loại nội dung `curriculum` hoặc `enrichment` thay cho danh sách môn cứng:** Thông tư 19/2026 phân định theo nội dung chương trình, một môn (ví dụ Tiếng Anh) có thể dạy theo chương trình hoặc tăng cường; người tạo chọn và quản trị duyệt.
- **LiveKit tự host, bộ nối đổi được:** dữ liệu trẻ em ở trong nước, chi phí theo máy; phương án đã loại: Jitsi (khó tách theo trường, ghi hình nặng), dịch vụ video ngoài làm mặc định (chuyển dữ liệu trẻ em ra nước ngoài, giá theo phút cao ở quy mô lớn), mediasoup (nhiều việc tự viết).
- **Chợ mở dùng cơ sở dữ liệu `marketplace` riêng và ứng dụng `apps/market`:** người dùng chợ không thuộc trường nào, trang công khai cần tên miền chung; phương án đã loại: đặt chợ trong ứng dụng phụ huynh (gắn tên miền con của từng trường), đặt bảng chợ trong `platform` (trộn dữ liệu người dùng cuối với dữ liệu vận hành, khó cách ly và xóa).
- **Ghi hình bắt buộc ở chợ với trẻ vị thành niên, tắt mặc định trong trường:** ở chợ người dạy là người lạ, bản ghi là biện pháp bảo vệ và bằng chứng tranh chấp; trong trường đã có quan hệ quản lý của nhà trường; phương án đã loại: ghi mọi buổi mọi nơi (vượt mức cần thiết), không ghi ở chợ (không có bằng chứng khi có sự cố).
- **Hồ sơ con thay vì tài khoản riêng của trẻ ở chợ:** trẻ không tự ký hợp đồng, phụ huynh kiểm soát; phương án đã loại: trẻ tự đăng ký (vướng đồng ý và độ tuổi).
- **AI gợi ý chỉ cho giáo viên, không gửi ảnh:** giữ nguyên nguyên tắc 23d; phương án đã loại: AI trả lời thẳng học sinh (DT-23 15.5 đã loại), gửi ảnh bài làm cho AI (dữ liệu trẻ em).
- **Không làm ở DT-27:** dạy trực tiếp tại nhà hay trung tâm (chỉ trực tuyến); gói tài khoản cá nhân cho giáo viên ngoài chợ; quảng cáo; ví điện tử của nền tảng; tiền tệ ngoài đồng Việt Nam; chấm điểm hay xếp hạng gia sư bằng AI; nhận diện khuôn mặt trong lớp video.

### 19.7 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Nền tảng giữ tiền rồi chi lại bị coi là trung gian thanh toán không phép | Không nhận tiền học vào tài khoản nền tảng; trong trường tiền vào tài khoản trường; chợ mở qua tổ chức có phép hoặc trả thẳng gia sư; luật sư kết luận trước khi bật (E-03); không bật chợ có tiền thật trước đó |
| Trường thu tiền dạy thêm `curriculum` trái Thông tư 29 | Khóa ở máy chủ, kiểm thử đơn vị và e2e thử tạo khoản thu bị từ chối; quản trị duyệt loại nội dung |
| Giáo viên nhận dạy có thu tiền học sinh mình đang dạy | So khớp phân công với trẻ đã liên kết, chặn; cam kết khi không so khớp được; báo cáo Mẫu 03 cho Hiệu trưởng; báo cáo vi phạm |
| Văn bản dạy thêm, thuế đổi hoặc Claude hiểu sai bản gốc (Thông tư 29, Nghị định 117 chưa đọc bản gốc) | Ngưỡng và tỷ lệ là dữ liệu có ngày hiệu lực; luật sư rà (E-07); phần đọc trước khi làm mỗi phần ghi vào YCTD |
| Trẻ bị tiếp cận, dụ dỗ qua lớp video hoặc tin nhắn | Phụ huynh luôn thấy, không kênh riêng, lọc liên lạc ngoài, ghi hình ở chợ, xác minh và lý lịch tư pháp, báo cáo và khóa ngay, chỉ số an toàn |
| Bản ghi video của trẻ bị lộ | Lưu mã hóa theo trường, đường dẫn ký ngắn hạn, không tải xuống, nhật ký xem, xóa theo hạn bằng việc nền, kiểm thử trường khác không xem được bản ghi (spec 190) |
| Chi phí băng thông vượt doanh thu | Giới hạn phút và dung lượng theo gói, đo từ sự kiện, cảnh báo ở bảng điều khiển, giảm độ phân giải tự động, đo thật ở 27a trước khi chốt giá (E-05) |
| Chất lượng video kém ở mạng di động | Simulcast và tự giảm chất lượng, TURN qua TCP, thử trên mạng 4G giả lập độ trễ |
| Gian lận đánh giá, né hoa hồng | Chỉ người đã học mới đánh giá, lọc liên lạc ngoài, gắn cờ lặp, báo cáo |
| Tranh chấp không có bằng chứng | Bản ghi giữ đến khi xong tranh chấp, điểm danh từ nhật ký phòng, tin nhắn trong nền tảng |
| Lộ dữ liệu giữa chợ và các trường | Cơ sở dữ liệu và vai trò riêng, chợ chỉ đọc trường qua API có đồng ý và mã băm, spec 195 mở rộng ma trận cách ly, kiểm tĩnh |
| Nền tảng phải có Giấy chứng nhận dịch vụ xử lý dữ liệu cá nhân vì ghi hình, điểm danh (Nghị định 356/2025 Điều 21 khoản 5) | Bổ sung câu hỏi vào PL-15 (E-06); luật sư kết luận trước khi bật ghi hình ở trường thật |
| Hai phần cùng đợt sửa chung tệp lõi | Phân tệp ở 19.4; thêm cuối tệp; gộp `origin/main` trước khi mở PR |
| Va số với DT-23, DT-24, DT-25, DT-26 chạy song song | Dải bắt đầu sau các số đã thấy và chừa khoảng; va thì đánh lại theo nhánh chính lúc gộp |

**Cổng kiểm của mỗi phần DT-27:** kiểm thử đơn vị toàn kho đạt không sửa kỳ vọng; e2e `single` hiện có đạt cộng e2e mới của phần (giữ khóa `e2e.lock`); kiểm thử cách ly 14.7 ở cả hai bố cục `database` và `schema`; kiểm tĩnh đa thuê bao đạt; typecheck, lint, build đạt; CI xanh toàn bộ; phiên bản phần mềm tăng theo từng phần, riêng bản kế hoạch này (YCTD-250) chỉ đổi tài liệu.

### 19.8 Quy ước chung của DT-27

- Mỗi phần ghi YCTD giữ sẵn ở 19.4, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, 23, 24, 32, 34, `index.md`), **đọc lại văn bản gốc liên quan trước khi làm** (27b, 27c: Thông tư 29/2024 bản gốc; 27h: Nghị định 52/2024, Thông tư 40/2024, Nghị định 117/2025, Luật 122/2025 bản gốc; 27a, 27i: Luật Trẻ em, Luật 91/2025 Điều 24) và ghi số hiệu, ngày đọc vào YCTD.
- Kiểm thử và dữ liệu mẫu chỉ dùng người, trường, gia sư bịa; video, thanh toán, xác minh, AI qua bộ giả lập; không in `.env`, không dán khóa.
- Tuyệt đối không chạy `migrate` lên cơ sở dữ liệu dùng chung; kiểm thử dùng cơ sở dữ liệu riêng của phiên.
- Điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của phần; giả định ở 19.11 làm cấu hình được, Eric chốt thì đổi giá trị bằng YCTD.

### 19.9 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| 27a | 1 | Đã làm, YCTD-251, phiên bản đề xuất 0.158.0, PR 204: bộ nối `VideoRoomProvider` (`livekit`, `livekit-cloud`, `mock`), `livekit` và `egress` ở hồ sơ `video` dùng chung coturn của 23e, phòng của buổi và phòng tức thời, phòng chờ, mã vào phòng 10 phút theo vai trò, bảng trắng tự viết, ghi hình cần chương trình bật và đồng ý của cha mẹ, xem lại bằng đường dẫn ký có nhật ký, xóa theo hạn, nhật ký vào ra thành điểm danh gợi ý của 27b, giới hạn phút và dung lượng bản ghi theo gói; năm học 0160, 0161 (thay 0150, 0151 vì phải chạy sau 0153 của 27b), nền tảng 0240, e2e 190 (cách ly hai trường kiểm ở `apps/api/src/video/video-tenancy.test.ts`) |
| 27b | 1 | Đã làm, YCTD-252, phiên bản 0.152.0, PR 196: chương trình gia sư trong trường (loại nội dung bắt buộc, khóa của Thông tư 29 ở máy chủ, quy định có ngày hiệu lực), buổi lặp theo tuần không trùng thời khoá biểu, giới hạn 2 tiết/tuần/môn, quyết định của Sở, đơn của cha mẹ, điểm danh và báo vắng, tin nhắn qua cha mẹ, chỗ nối điểm danh tự động cho 27a; năm học 0152 đến 0154, định danh 0172, e2e 191 |
| 27c | 2 | Đã làm, YCTD-253, phiên bản đề xuất 0.156.0, PR 201: `curriculum` khóa cứng không giá, nguồn chi kinh phí trường; giá của chương trình bổ trợ có thu, dòng gia sư trên hóa đơn của kỳ do lần tính học phí lập, khoản trừ buổi hủy (trừ kỳ sau, điều chỉnh hóa đơn qua luồng hiện có, đóng sau khi hoàn qua phiếu chi hoàn), thù lao theo tiết vào bảng lương tháng (khoản mục `THU_LAO_DAY_THEM`, chịu thuế thu nhập cá nhân), báo cáo thu chi và tệp Excel; năm học 0155, 0156, e2e 192 |
| 27d | 2 | 27d1 đã làm (YCTD-254, phiên bản đề xuất 0.161.0, PR 208): khoá tự chọn của 28b gắn với chương trình gia sư, ghi danh theo đơn, phát video bài học theo đoạn bằng đường dẫn ký có nhật ký xem; năm học 0200 (sau dải của DT-28). 27d2 đã làm (YCTD-261, phiên bản đề xuất 0.163.0, PR 211): tiến độ xem video ghi kết quả hoạt động của 28b (phần trăm đã xem chỉ tăng, từ 90% là xem xong, theo điều kiện mở), tiến độ của em cho cha mẹ và học sinh, tiến độ từng học sinh cho giáo viên; không thêm migration |
| 27e | 2 | Đã làm (YCTD-255, phiên bản đề xuất 0.166.0, PR 215): hàng chờ hỏi đáp theo chương trình trên 28e, gợi ý AI nháp qua 23d, dấu có AI hỗ trợ, đã hiểu, phụ huynh tắt AI; năm học 0201, hệ thống 0120 |
| 27f | 3 | Đã làm (YCTD-256, phiên bản đề xuất 0.173.0, PR 221): cơ sở dữ liệu chung `marketplace` (marketplace 0001 đến 0005, vai trò riêng, loại migration mới), ứng dụng `apps/market`, tài khoản phụ huynh, gia sư (mật khẩu, mã xác nhận, phiên riêng), hồ sơ con tối thiểu, đồng ý theo phiên bản văn bản, liên kết với trường bằng mã ký (không dùng định danh 0170), hồ sơ gia sư và cơ sở dạy thêm tối thiểu, cấu hình chợ ở cổng nền tảng với thu tiền thật luôn tắt; e2e 195. Quyết định của Eric ngày 2026-10-28: làm mã, tiền giả lập; đăng nhập OIDC chuyển sang 27g cùng xác minh. Cùng ngày Eric yêu cầu ứng dụng riêng cho gia sư: tách `apps/tutor` (ứng dụng Gia sư, tên miền riêng, PWA riêng) khỏi `apps/market` (YCTD-262, phiên bản đề xuất 0.175.0, PR 223); 27g, 27h, 27i làm phần gia sư trên `apps/tutor`. Eric làm rõ cùng ngày: giáo viên dạy kèm ngoài trường cũng dùng `apps/tutor` (kênh ngoài, tài khoản chợ riêng, liên kết tùy chọn với tài khoản trường để hiện nhãn đã xác minh ở 27g), dạy kèm học sinh trong trường vẫn ở ứng dụng giáo viên; giữ các chặn Thông tư 29 (công lập không đứng tên cơ sở cho `curriculum`, chặn trẻ đang được phân công ở 27h) |
| 27g | 4 | Đã làm (YCTD-257, phiên bản đề xuất 0.179.0, PR 227; lượt xác minh danh tính gắn với trình duyệt và tài khoản đã bắt đầu ở YCTD-322), trên ứng dụng Gia sư `apps/tutor`: hồ sơ dạy (môn theo cấp và khối, loại nội dung, giá mỗi buổi, thời lượng, giờ trống, ngôn ngữ), xác minh bốn bậc (danh tính qua OIDC của DT-25 đủ 18 tuổi, bằng cấp, lý lịch tư pháp cấp trong 6 tháng hiệu lực 12 tháng, đăng ký kinh doanh bắt buộc với `curriculum`), giấy tờ mã hóa, hàng chờ duyệt ở cổng nền tảng có nhật ký, đăng nhập OIDC; giáo viên đang dạy ở trường khai trường, công lập thì không có môn `curriculum`, Mẫu 03; tìm gia sư và trang công khai theo Mẫu 02 ở Chợ gia sư; marketplace 0010, e2e 196. Bộ nối OIDC chuyển sang `packages/server`. Chưa làm: ảnh hồ sơ, đánh giá sau buổi (cần buổi đã học của 27h), sắp xếp theo đánh giá, liên kết tài khoản trường để hiện "giáo viên trường X đã xác minh" |
| 27h | 4 | Đã làm (YCTD-258, phiên bản đề xuất 0.181.0, PR 229): đặt buổi lẻ ở Chợ gia sư (giữ chỗ 30 phút, giờ Việt Nam, trong giờ trống, không trùng; chặn môn `curriculum` cho Tiểu học; cam kết khi gia sư đang dạy ở trường), bộ nối `MarketplacePaymentProvider` với bộ giả lập `mock` (giữ tiền, giải ngân chia hoa hồng, hoàn, giữ khi tranh chấp, sự kiện có chữ ký nhận một lần), hoa hồng là quy tắc cấu hình có ngày hiệu lực, hủy theo GD-134, gia sư đánh dấu đã dạy, giải ngân khi hết hạn khiếu nại (GD-133), tranh chấp có trình bày hai bên, quyết định có lý do, khiếu nại lại do nhân viên khác xét; buổi dạy và thu nhập ở ứng dụng Gia sư; thanh toán, tranh chấp, hoa hồng ở cổng nền tảng; marketplace 0020, e2e 197. Thu tiền thật luôn tắt (nhà cung cấp tiền thật bị từ chối). Chưa làm: gói buổi, phòng video của 27a ở ngữ cảnh chợ và điểm danh tự động, so khớp phân công qua liên kết trường, khấu trừ thuế và hóa đơn hoa hồng (E-03, E-09), phương án B, đánh giá sau buổi |
| 27i | 4 | Đã làm (YCTD-259, phiên bản đề xuất 0.182.0, PR 230; điều kiện tạm khóa tự động siết ở YCTD-322): tin nhắn chợ chỉ giữa phụ huynh và gia sư, che thông tin liên lạc ngoài bằng hàm thuần của 28e, cảnh báo, lần thứ 3 gắn cờ và tự tạo báo cáo né hoa hồng; báo cáo vi phạm (5 loại, 4 mức, hạn 4 giờ đến 7 ngày, an toàn trẻ em không thấp hơn mức cao, hướng dẫn 111, 113); mức nghiêm trọng tạm khóa gia sư ngay (ẩn, chặn đặt và nhắn, hủy buổi sắp tới hoàn đủ, giữ tiền chưa giải ngân, báo phụ huynh); hàng chờ kiểm duyệt, quyết định có lý do, kháng nghị do nhân viên khác xét, nhật ký, chỉ số an toàn, xuất hồ sơ có nhật ký; ghi hình bắt buộc với trẻ vị thành niên theo 19.2 (đồng ý khi đặt, phòng chỉ mở khi đang ghi qua bộ nối video của 27a, bản ghi mã hóa giữ 30 ngày, giữ tiếp khi có bằng chứng đang mở, chỉ người của buổi và nhân viên xem, không tải, có nhật ký); chính sách an toàn trẻ em (tóm tắt) ở hai ứng dụng; marketplace 0030, e2e 198. Chưa làm: giao diện phòng video trong hai ứng dụng chợ, sự kiện kết thúc ghi của LiveKit cho phòng chợ, danh sách từ ngữ cấm của chợ, trẻ đọc tin nhắn khi phụ huynh cho, báo cáo từ đánh giá, văn bản PL-19 đầy đủ (E-08) |

Bản kế hoạch này là YCTD-250, chỉ đổi tài liệu (không tăng phiên bản phần mềm).

### 19.10 Việc Eric phải quyết hoặc làm

| Mã | Việc | Cần trước | Ghi chú |
|---|---|---|---|
| E-01 | Chốt tỷ lệ hoa hồng của chợ (theo phần trăm, tối thiểu, có khác nhau theo `curriculum` và `enrichment` không) và phí với trường ở mốc 1 (gói có phân hệ gia sư trực tuyến giá bao nhiêu) | 27h bật tiền thật; S5a cấu hình gói | Là dữ liệu, không chặn làm mã |
| E-02 | Chọn tổ chức có giấy phép cung cấp chia tiền hoặc giữ tiền có điều kiện (phương án A) hoặc quyết dùng phương án B; ký hợp đồng | 27h viết bộ nối thật | Claude chưa xác minh được tổ chức nào có dịch vụ này; Eric hỏi báo giá ở ngân hàng, cổng thanh toán đang dùng |
| E-03 | Luật sư rà mô hình tiền của chợ (Nghị định 52/2024, Thông tư 40/2024), nghĩa vụ khấu trừ thuế (Nghị định 117/2025), nghĩa vụ nền tảng trung gian (Luật 122/2025, Nghị định 248/2026) | Mở chợ có tiền thật | |
| E-04 | Pháp nhân vận hành chợ (doanh nghiệp hiện có hay pháp nhân mới), ngành nghề đăng ký, thông báo hoặc đăng ký với Bộ Công Thương nếu luật yêu cầu (**chưa xác minh**) | Mở chợ | |
| E-05 | Báo giá VPS trong nước có cổng 1 Gbit/s và giá băng thông; chốt có tự host video ở hồ sơ vận hành không | 27a lên môi trường thật | Bảng ước lượng ở 19.2 mục 4 |
| E-06 | Luật sư kết luận PL-15 thêm câu hỏi ghi hình, điểm danh lớp video (Nghị định 356/2025 Điều 21 khoản 5) | Bật ghi hình ở trường thật | |
| E-07 | Luật sư xác nhận cách hiểu Thông tư 29/2024 (bản gốc) và Thông tư 19/2026 áp cho dạy trực tuyến, giáo viên công lập ở chợ, ranh giới `curriculum` và `enrichment` | Mốc 1 ở trường thật | |
| E-08 | Rà và ký các hồ sơ PL-16 đến PL-21 (`33_HO_SO_PHAP_LY/16_DANH_SACH_HO_SO_GIA_SU.md`) | Mốc 1 (PL-17, PL-18 phần trong trường), mốc 3 (tất cả) | |
| E-09 | Chọn nhà cung cấp hóa đơn điện tử thật (đã treo từ S5b) | 27h xuất hóa đơn hoa hồng thật | |
| E-10 | Chốt các giả định GD-130 đến GD-138 ở 19.11 nếu muốn khác giá trị Claude đặt | Khi làm từng phần | |

### 19.11 Giả định chưa chốt, làm cấu hình được

Số GD và RR của DT-27 bắt đầu từ GD-130 và RR-28: DT-26 dùng GD-120 đến GD-127 và RR-25 đến RR-27; GD-109 đến GD-119, GD-128, GD-129 và RR-21 đến RR-24 để cho DT-23e, DT-24, DT-25. Va thì đánh lại khi gộp.

| Mã | Mục chưa chốt | Giả định để làm | Cấu hình ở | Cần ai trả lời |
|---|---|---|---|---|
| GD-130 | Số người tối đa một lớp video nhóm nhỏ | 8 (cả gia sư) | `video_settings` của trường, cấu hình chợ | Eric |
| GD-131 | Ghi hình | Trong trường tắt mặc định, bật theo chương trình khi có đồng ý; ở chợ bắt buộc với buổi có trẻ vị thành niên | `video_settings`, cấu hình chợ | Eric |
| GD-132 | Thời hạn giữ bản ghi | 30 ngày (cùng 23e), kéo dài khi có tranh chấp hoặc báo cáo đang mở | `video_settings`, cấu hình chợ | Eric |
| GD-133 | Thời hạn khiếu nại trước khi giải ngân | 48 giờ sau buổi | cấu hình chợ | Eric |
| GD-134 | Chính sách hủy và hoàn | Hủy trước 24 giờ hoàn đủ; trong 24 giờ hoàn 50%; gia sư hủy hoặc vắng hoàn đủ; trong trường theo cấu hình trường | cấu hình chợ, chương trình | Eric |
| GD-135 | Tuổi có tài khoản riêng ở chợ | Không có tài khoản riêng dưới 16 tuổi; trẻ vào lớp qua đường dẫn của phụ huynh | cấu hình chợ | Eric, luật sư |
| GD-136 | Hạn của phiếu lý lịch tư pháp khi xác minh gia sư | Phiếu cấp trong 6 tháng, xác minh lại mỗi 12 tháng | cấu hình chợ | Eric |
| GD-137 | Thư viện bảng trắng | Thư viện mã nguồn mở có giấy phép dùng thương mại, chọn và ghi giấy phép lúc làm | mã 27a | Claude (theo ủy quyền) |
| GD-138 | Khấu trừ thuế ở chợ | Công tắc tắt đến khi luật sư kết luận (E-03); tỷ lệ là dữ liệu có ngày hiệu lực | cấu hình chợ | Eric, luật sư |

## 20. DT-28: hệ thống quản lý học tập (LMS) cho trường phổ thông (28a đến 28j)

> Số mục: mục 16, 17 vẫn để cho DT-24, DT-25 (PR 182, 181 đang mở); mục 18 là DT-26, mục 19 là DT-27 (PR 179, đã gộp). DT-28 ghi ở mục 20.

### 20.1 Căn cứ và mục tiêu

1. Nguồn: **yêu cầu của Eric ngày 2026-10-26** (giao qua phiên điều phối), hai lần trong cùng ngày:
   - Lần 1: bốn tính năng **chia nhóm trong lớp, học nhóm trực tuyến, làm bài tập trực tuyến, giao bài tập về nhà**, xây trên phần đã có, không dựng song song.
   - Lần 2: **phát triển hệ thống quản lý học tập (LMS)**; bốn tính năng trên là các phần của LMS. Thêm: lớp học trực tuyến theo lớp và môn sinh từ phân công giảng dạy, khoá học tự chọn ngoài lớp; cấu trúc khoá học, điều kiện mở bài, lịch và hạn; theo dõi tiến độ, bảng điểm hoạt động nối với sổ điểm, báo cáo cho giáo viên chủ nhiệm, tổ chuyên môn, Hiệu trưởng, phụ huynh; diễn đàn, hỏi đáp, thông báo lớp, lịch học tập; chuẩn nội dung SCORM, xAPI, cmi5, LTI 1.3; nhập xuất khoá học giữa các trường; huy hiệu, chứng nhận; quan hệ với DT-27; đối chiếu LMS phổ biến; Thông tư 09/2021/TT-BGDĐT.
2. Mục tiêu: School Management có **một LMS gọn cho trường phổ thông**, đáp ứng chức năng tối thiểu của "hệ thống quản lý học tập trực tuyến" và "hệ thống quản lý nội dung học tập trực tuyến" ở Điều 9 Thông tư 09/2021; dữ liệu học tập nằm cùng hồ sơ học sinh, sổ điểm, thời khoá biểu, kho học liệu của trường; giáo viên **không phải tạo lại lớp, danh sách học sinh, môn**; phụ huynh theo dõi được. LMS là **lõi khoá học dùng chung**: khoá học ghi sẵn (27d) và hỏi đáp (27e) của DT-27 xây trên lõi này.
3. Không làm (để phạm vi đúng trường phổ thông, không bê nguyên Moodle): wiki, cơ sở dữ liệu tự định nghĩa, hội thảo chấm chéo thành điểm, bảng thuật ngữ, khảo sát tự thiết kế, chợ ứng dụng bên thứ ba, nhiều chủ đề giao diện, khoá học mở cho người ngoài trường, thanh toán khoá học (thuộc DT-27).
4. Hiện trạng mã (đọc trên nhánh chính ngày 2026-10-26 sau PR 179, 180, và trên nhánh làm việc chưa gộp của 23a, 23d):
   - **Phân công giảng dạy:** `timetable_lessons` (bản thời khoá biểu, lớp, môn `subject_id`, giáo viên, tiết, nhóm tiết `group_no`) và `class_staff_assignments` (lớp, người, vai trò, tên môn, từ ngày, đến ngày); môn ở `subjects`, `curriculum_subjects` (số tiết mỗi tuần); tổ chuyên môn `subject_teams`, `subject_team_subjects`, `subject_team_members` (21a). Đây là nguồn để sinh lớp học trực tuyến theo cặp lớp, môn, giáo viên.
   - **Nhóm học sinh (DT-14c, YCTD-102):** `child_groups` (theo đơn vị, tên duy nhất trong đơn vị, giáo viên phụ trách) và `child_group_members`; nhóm lâu dài, không gắn lớp, môn, không có nhóm trưởng, không có lịch sử.
   - **Chia nhóm ngẫu nhiên của 23b (PR 180):** `classroom_groupings` (một dòng mỗi lớp và giáo viên, nhóm lưu `jsonb`, ghi đè khi chia lại); `classroom_score_events`; công cụ ngoại tuyến ở `apps/teacher/src/tools`.
   - **Sổ đầu bài:** `class_logs` (lớp, ngày, tiết, môn, giáo viên, tên bài, nội dung, `group_no`); chưa có "bài về nhà". Toàn kho chưa có chỗ nào về bài tập về nhà hay khoá học.
   - **Kho học liệu số (22h1, 22h2, cơ sở dữ liệu hệ thống):** `learning_resources` (loại, cấp, khối, môn, chủ đề, tuần, giấy phép, phạm vi, trạng thái `draft`, `pending_unit`, `pending_school`, `published`...), **luồng duyệt tổ trưởng rồi Ban Giám hiệu**, sự kiện, báo lỗi, lượt dùng; bộ sưu tập câu hỏi; thang tiêu chí `rubrics` (năm học); **gói chia sẻ** `school-management.resource-package/1` (gzip của JSON) và luồng nhập dùng lại luồng duyệt.
   - **Ngân hàng câu hỏi, đề, chấm (22g1, 22g2):** `questions` có luồng duyệt; câu trong đề lưu bản chụp; hàm chấm thuần `grading-rules.ts`; `question_usages`; một cửa ghi điểm `ScoresService.recordExamScores` (ghi `score_entries` nguồn `exam`).
   - **Sổ điểm, nhận xét:** `score_entries` (THCS, THPT; `regular`, `mid`, `final`; nguồn `manual`, `import`, `exam`); `regular_comments` (Tiểu học, 20c).
   - **23a (đang làm, YCTD-211):** kênh phiên `student`, màn hình học sinh trong ứng dụng phụ huynh; `exam_assignments`, `exam_assignment_targets` (**chỉ `class` và `student`**), `exam_attempts`.
   - **23d (đang làm, YCTD-214):** `AiProvider`, bộ quét dữ liệu cá nhân, nhật ký và hạn mức; nguyên tắc 15.2 không đưa bài làm của học sinh vào lời nhắc.
   - **Nhắn tin, thông báo:** `message_threads` là luồng phụ huynh với nhà trường theo một trẻ; **không có kênh học sinh với học sinh**; hàng đợi `notifications` (`in_app`, `sms`, `zalo`; `push` là 26b).
   - **Kế hoạch đã gộp nhưng chưa làm:** 27a `VideoRoomProvider` (phòng video, bảng trắng, ghi hình, LiveKit), 27d khoá học ghi sẵn, 27e hỏi đáp; 26a vỏ PWA.

### 20.2 Căn cứ pháp lý đã đọc và ràng buộc sản phẩm

Claude tra ngày **2026-10-26**. Cột "Mức đọc" ghi rõ; chỗ ghi **chưa xác minh** thì luật sư hoặc người làm phần phải đối chiếu bản gốc trước khi dùng. Tài liệu này không thay tư vấn pháp lý.

| Văn bản | Ban hành, hiệu lực | Nguồn | Mức đọc |
|---|---|---|---|
| **Thông tư 09/2021/TT-BGDĐT** quy định về quản lý và tổ chức dạy học trực tuyến trong cơ sở giáo dục phổ thông và cơ sở giáo dục thường xuyên | 30/03/2021; hiệu lực 16/05/2021; người ký Nguyễn Hữu Độ | `vanban.chinhphu.vn` (docid 203106); tệp gốc `datafiles.chinhphu.vn/cpp/files/vbpq/2021/04/09-bgd.signed.pdf` (9 trang ảnh quét, dựng ảnh từng trang để đọc) | **Toàn văn bản gốc** Điều 1 đến Điều 19. Có tin một văn bản năm 2025 sửa đổi một số thông tư, bỏ cụm "Phòng Giáo dục và Đào tạo" khỏi thông tư này (`xaydungchinhsach.chinhphu.vn`): **chưa xác minh** số hiệu, nội dung sửa |
| Thông tư 15/2026/TT-BGDĐT ban hành Điều lệ trường tiểu học, THCS, THPT và trường phổ thông có nhiều cấp học; **thay Thông tư 28/2020/TT-BGDĐT** và Thông tư 32/2020/TT-BGDĐT | 24/03/2026; hiệu lực 10/05/2026 | `chinhphu.vn` (docid 217678); tệp gốc `datafiles.chinhphu.vn/cpp/files/vbpq/2026/4/15-bgddt.pdf` (ảnh quét 28 trang) | **Bản gốc** trang 11, 12, 18, 19 (Điều 17 khoản 3 đến 5, Điều 18 đến 21, Điều 31 khoản 2 đến 4, Điều 32, 33); **chưa rà hết các trang còn lại** |
| Thông tư 22/2021/TT-BGDĐT quy định đánh giá học sinh THCS, THPT | 20/07/2021; hiệu lực 05/09/2021 | `trogiupluat.vn` (bản đăng lại có nguyên văn Điều 6, 7); YCTD-170 ghi đã đọc toàn văn | Nguyên văn khoản 1, 2 Điều 6, khoản 1 Điều 7 qua bản đăng lại; **chưa đối chiếu bản công báo trong phiên này** |
| Thông tư 27/2020/TT-BGDĐT quy định đánh giá học sinh tiểu học | 04/09/2020 | Tóm tắt sau khi đọc toàn văn ở 20c (mục 11.4, YCTD-161) | **Chưa đọc lại trong phiên này**; số điều về đánh giá thường xuyên **chưa xác minh** |
| Công văn 3977/BGDĐT-GDTH (không giao bài tập về nhà cho học sinh lớp 1) | 05/10/2020 (theo báo) | `lsvn.vn`, `znews.vn`, `baoquocte.vn` | Nguồn thứ cấp; **chưa xác minh** bản gốc và việc còn áp dụng |
| "Không giao bài tập về nhà cho học sinh học 2 buổi/ngày" ở tiểu học | Không rõ số hiệu | Bài báo (`znews.vn`, `giaoduc.net.vn`) | **Chưa xác minh** có văn bản hay không |
| Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15; Nghị định 356/2025/NĐ-CP | Hiệu lực 01/01/2026 | Đã đọc toàn văn các điều liên quan ở S8a ngày 2026-10-25 (`33_HO_SO_PHAP_LY/00_MUC_LUC.md` mục 4) | Điều 24 Luật (dữ liệu trẻ em), Điều 9, 10 (đồng ý); Điều 21 khoản 5 Nghị định |
| Luật Trẻ em số 102/2016/QH13 | 05/04/2016 | Hiểu biết sẵn có | **Chưa đọc lại**; số điều **chưa xác minh** |
| Thông tư 29/2024/TT-BGDĐT sửa bởi Thông tư 19/2026/TT-BGDĐT (dạy thêm) | Xem 19.2 | Xem 19.2 | Ranh giới với DT-27 |

**1. Thông tư 09/2021 (bản gốc): hệ thống phải có gì, lưu gì, ai quản lý.**

| Quy định | Nguồn | Ràng buộc trong sản phẩm |
|---|---|---|
| "Hệ thống dạy học trực tuyến" gồm phần mềm tổ chức dạy học trực tuyến trực tiếp, **hệ thống quản lý học tập trực tuyến**, hệ thống quản lý nội dung học tập trực tuyến | Điều 2 khoản 1 | Ba thành phần ứng với: phòng video của 27a (trực tiếp), LMS của DT-28 (quản lý học tập), kho học liệu 22h1 cộng trình soạn khoá học của 28b (quản lý nội dung) |
| Hai hình thức: trực tuyến **hỗ trợ** dạy học trực tiếp (một phần nội dung bài học, chủ đề) và trực tuyến **thay thế** (toàn bộ nội dung bài học, chủ đề) | Điều 2 khoản 3, 4 | Mỗi lớp học trực tuyến và mỗi hoạt động có thuộc tính hình thức `support` hoặc `replace`; báo cáo theo hình thức |
| Người đứng đầu cơ sở quyết định hình thức hỗ trợ; tổ chức hình thức thay thế khi học sinh không đến trường **vì lý do bất khả kháng** | Điều 5 khoản 4; Điều 15 khoản 1 điểm a | Hình thức `replace` chỉ bật được bằng **quyết định của Hiệu trưởng** nhập vào hệ thống (số, ngày, lý do, phạm vi lớp, thời gian, tệp); mặc định mọi lớp là `support` |
| Học sinh: tham dự giờ học trực tuyến, làm hoạt động học tập và kiểm tra, đánh giá theo yêu cầu; khai thác học liệu; **đặt câu hỏi và trả lời câu hỏi với giáo viên và các học sinh khác** | Điều 5 khoản 2; Điều 9 khoản 2 điểm b | Màn hình học sinh có lịch giờ học trực tuyến, hoạt động, học liệu; **hỏi đáp và thảo luận trong lớp** cho cả học sinh trả lời nhau (28e), có giáo viên kiểm duyệt |
| Giáo viên: tổ chức giờ học trực tuyến; giao nhiệm vụ học tập, kiểm tra, đánh giá; theo dõi, hỗ trợ học sinh khai thác học liệu; tư vấn, trả lời câu hỏi | Điều 5 khoản 3; Điều 9 khoản 2 điểm a | Giao hoạt động, bài tập (28c), theo dõi tiến độ từng học sinh (28d), hàng chờ câu hỏi (28e) |
| Kiểm tra, đánh giá **thường xuyên** trực tuyến theo quy định của Bộ; **định kỳ thực hiện trực tiếp tại trường**, chỉ trực tuyến khi học sinh không thể đến trường vì bất khả kháng, Hiệu trưởng quyết định | Điều 6 | Hoạt động trong LMS chỉ cho vào **điểm thường xuyên** (khi giáo viên chọn); bài kiểm tra 23a dùng cho định kỳ trực tuyến chỉ khi có quyết định bất khả kháng đã nhập (khớp chế độ mặc định "chỉ thi tại trường" của 23a) |
| Học liệu dạy học trực tuyến gồm bài giảng đa phương tiện, hướng dẫn thí nghiệm, thực hành, phần mềm mô phỏng, hệ thống câu hỏi, bài tập, tài liệu tham khảo; **phải được tổ chuyên môn thông qua và người đứng đầu cơ sở phê duyệt** | Điều 7 khoản 1, 3 | Học liệu và **khoá học mẫu** dùng trong lớp phải qua **luồng duyệt tổ trưởng rồi Ban Giám hiệu của 22h1** (dùng lại, không viết luồng thứ hai); trang hướng dẫn ngắn, thông báo của giáo viên không cần duyệt (GD-151) |
| Hồ sơ lưu tại trường: minh chứng các yêu cầu Điều 9, 10, 15; **dữ liệu về quá trình dạy học trực tuyến trên hệ thống**; **kế hoạch dạy học trực tuyến và trực tiếp chi tiết theo tuần, tháng, năm cho từng môn**; hồ sơ kiểm tra, đánh giá; trường tự quy định quy trình và thời hạn lưu theo Luật Lưu trữ | Điều 8 | Nhật ký học tập (`learning_events`) giữ suốt thời hạn lưu; lớp học trực tuyến có **kế hoạch dạy học trực tuyến theo tuần** gắn tuần của kế hoạch giáo dục; nút **"Xuất hồ sơ dạy học trực tuyến"** theo lớp, môn, học kỳ; thời hạn lưu là cấu hình của trường (GD-146) |
| LMS tối thiểu: giáo viên lưu trữ, chuyển tải học liệu, giao nhiệm vụ, kiểm tra, đánh giá, theo dõi, trả lời câu hỏi; học sinh truy cập học liệu, làm hoạt động, hỏi đáp; **cơ sở quản lý hồ sơ, tiến trình, kết quả học tập của học sinh và hoạt động dạy của giáo viên**, quản lý thông tin khác theo yêu cầu của trường và cơ quan quản lý ở địa phương | Điều 9 khoản 2 | Đủ ở 28b đến 28e; báo cáo hoạt động dạy của giáo viên (hoạt động đã giao, thời gian phản hồi) cho Ban Giám hiệu (28d) |
| Hệ thống quản lý nội dung có thêm **công cụ cho giáo viên thiết kế nội dung, học liệu** | Điều 9 khoản 3 | Trình soạn trang nội dung và khoá học của 28b; tải học liệu qua 22h1 |
| Hạ tầng: bảo đảm truy cập cho giáo viên, học sinh; **giải pháp an toàn thông tin, quy định về dữ liệu, bảo mật thông tin cá nhân** | Điều 10 khoản 1, 2 | Nguyên tắc đa thuê bao, cách ly, mã hóa của DT-SaaS (14.2, 14.7); hồ sơ PL-01 đến PL-15 |
| Người đứng đầu: quyết định hình thức; xây dựng kế hoạch; phân công trách nhiệm, **phối hợp với phụ huynh**; thẩm định học liệu; **thông báo hình thức và kế hoạch kiểm tra, đánh giá trực tuyến cho học sinh và phụ huynh**; chỉ đạo thu nhận sản phẩm học tập; **quản lý tài khoản học sinh, giáo viên theo mã định danh từ cơ sở dữ liệu ngành** | Điều 15 khoản 1 điểm a đến i | Thông báo lớp, thông báo trường tới phụ huynh (28e); tài khoản học sinh của 23a gắn mã học sinh của Bộ (`moet_student_code`) có ở hồ sơ học sinh; quyền theo vai trò |
| Xây dựng nội quy dạy học trực tuyến; công khai quy định, kế hoạch, điều kiện; **mỗi năm hai lần, cuối mỗi học kỳ, đánh giá, rút kinh nghiệm, gửi Phòng, Sở** | Điều 15 khoản 3, 4, 6 | Trường soạn **nội quy dạy học trực tuyến** trong hệ thống, học sinh xác nhận lần đầu vào lớp; **báo cáo tổng kết dạy học trực tuyến theo học kỳ** xuất được để gửi Sở (28d) |
| Giáo viên phối hợp thường xuyên với phụ huynh; nhân viên quản trị kỹ thuật hỗ trợ | Điều 16 khoản 2, 3 | Phụ huynh xem tiến độ, kết quả, nhận thông báo; vai trò "hỗ trợ kỹ thuật dạy học trực tuyến" (xem cấu hình, không xem bài làm) |
| Học sinh chấp hành nội quy, chủ động liên lạc giáo viên để được hỗ trợ | Điều 17 | Nút "Hỏi giáo viên" trong lớp (28e) |
| Phạm vi: chương trình giáo dục phổ thông và giáo dục thường xuyên cấp THCS, THPT | Điều 1 | LMS bật cho TH, THCS, THPT; **không bật cho Mầm non** |

**2. Đánh giá, bài tập, bài về nhà, an toàn trẻ em.**

| Quy định | Nguồn | Ràng buộc trong sản phẩm |
|---|---|---|
| Hoạt động giáo dục qua các hình thức như **thực hiện bài tập**, thực hành, dự án học tập...; học sinh **làm việc độc lập, theo nhóm** hoặc chung cả lớp với sự hướng dẫn của giáo viên | TT 15/2026 Điều lệ, khoản 2 Điều 19 (bản gốc) | Bài tập cá nhân, nhóm, cả lớp; nhóm của 28a; giáo viên luôn có mặt trong không gian nhóm |
| Ứng dụng công nghệ số và **trí tuệ nhân tạo theo hướng an toàn, hiệu quả, có kiểm soát** | TT 15/2026 Điều lệ, khoản 5 Điều 17 (bản gốc) | Gợi ý nhận xét bằng AI chỉ là nháp giáo viên duyệt, tắt mặc định, có nhật ký |
| Học sinh được bảo đảm điều kiện về thời gian ... để học ở lớp và **tự học ở nhà** | TT 15/2026 Điều lệ, khoản 1 Điều 33 (bản gốc) | Giới hạn khối lượng bài về nhà theo ngày là cấu hình có ô căn cứ; lịch khối lượng của lớp trước khi giao (28f) |
| Trong các trang đã đọc của Điều lệ mới **không có điều nào đặt giới hạn bài về nhà** | TT 15/2026 (phần đã đọc) | Không ghi cứng; ngưỡng là dữ liệu cấu hình |
| Không giao bài tập về nhà cho học sinh lớp 1 | CV 3977 (**chưa xác minh**) | **Eric chốt 2026-10-26 (GD-143): nền tảng không đặt giới hạn mặc định**; Ban Giám hiệu tự cấu hình quy tắc bài về nhà của trường (có thể chặn lớp 1) và tự đối chiếu quy định; hướng dẫn sử dụng có bảng mẫu gợi ý, không bật sẵn |
| Đánh giá thường xuyên qua hỏi đáp, viết, thuyết trình, thực hành, thí nghiệm, **sản phẩm học tập**; đánh giá định kỳ qua bài kiểm tra, bài thực hành, dự án học tập | TT 22/2021 khoản 1 Điều 6, khoản 1 Điều 7 (qua bản đăng lại) | Kết quả hoạt động **có thể** thành một điểm thường xuyên khi giáo viên chọn và xác nhận; **không bao giờ** vào giữa kỳ, cuối kỳ |
| Tiểu học đánh giá thường xuyên bằng nhận xét, không cho điểm | TT 27/2020 (tóm tắt ở 11.4) | **Eric chốt 2026-10-26 (GD-141): cho phép cả Tiểu học**, nhưng không ghi điểm số: kết quả hoạt động là căn cứ, máy gợi ý câu nhận xét thường xuyên (`regular_comments`) và mức đạt môn (`subject_results`), giáo viên xem, sửa, xác nhận mới ghi |
| Dữ liệu cá nhân của trẻ em xử lý với đồng ý của người đại diện; trẻ từ đủ 07 tuổi cần cả đồng ý của trẻ khi công bố, tiết lộ đời sống riêng tư | Luật 91/2025 Điều 24 (đọc ở S8a) | Bài nộp, ảnh, ghi âm, bài viết thảo luận là dữ liệu của trẻ: phạm vi xem theo 20.7; không công bố ra ngoài lớp; **không bảng xếp hạng công khai** (GD-155); **không bao giờ gửi bài làm cho nhà cung cấp AI** (GD-142, Eric chốt); thời hạn lưu |
| Phần mềm giáo dục có yếu tố giám sát là dịch vụ xử lý dữ liệu cá nhân | NĐ 356/2025 Điều 21 khoản 5 | Theo dõi tiến độ, nhật ký học tập, quan sát nhóm làm câu hỏi ở PL-15 nặng thêm (20.12, E-01) |
| Dạy thêm là dạy ngoài thời lượng kế hoạch giáo dục | TT 19/2026 Điều 1 (xem 19.2) | Lớp học trực tuyến theo phân công là chính khóa, **không thu tiền**; khoá tự chọn có thu tiền hoặc phụ đạo có lịch thuộc chương trình 27b |

### 20.3 Đối chiếu các LMS phổ biến và phạm vi chọn

Claude chỉ đọc **trang công khai** ngày 2026-10-26, không đăng nhập, mỗi trang một yêu cầu, cách nhau trên một giây. Nhận xét dựa trên mô tả công khai, không phải dùng thử.

| Hệ thống | Nguồn công khai | Tính năng nêu công khai | Lấy gì cho School Management |
|---|---|---|---|
| Moodle (mã nguồn mở) | `docs.moodle.org/en/Features` (tài liệu bản 5.3) | Diễn đàn, wiki, bảng thuật ngữ, cơ sở dữ liệu, hội thảo chấm chéo; tài nguyên kéo thả; theo dõi hoàn thành hoạt động và khoá học; huy hiệu tương thích Open Badges; sổ điểm, chấm nâng cao, chấm theo năng lực; nhóm; nhập xuất SCORM, IMS LTI; sao lưu, khôi phục khoá học | Cấu trúc chương, hoạt động; hoàn thành hoạt động; điều kiện mở; nhóm; sao lưu thành gói. **Không lấy** wiki, bảng thuật ngữ, cơ sở dữ liệu, hội thảo, hệ phân quyền ngữ cảnh nhiều tầng |
| Google Classroom | `edu.google.com/workspace-for-education/classroom/` | Bài tập tương tác, thang tiêu chí học sinh thấy được, kỳ chấm và thang điểm, ngân hàng nhận xét, chấm hàng loạt, **thư tóm tắt hằng tuần cho người giám hộ**, tiện ích bên thứ ba, kiểm tra trùng lặp, bộ luyện tập phản hồi ngay, phân tích mức tham gia | Bài tập đơn giản, ngân hàng nhận xét, **tóm tắt cho phụ huynh**, thang tiêu chí hiển thị cho học sinh |
| Canvas (Instructure) | `instructure.com/canvas` | Chấm nhanh có chú thích tài liệu, sổ điểm có trọng số, khoá học mẫu đẩy cập nhật từ trung tâm (Blueprint), dữ liệu sự kiện thô, báo cáo trong ứng dụng, **ứng dụng riêng cho học sinh, giáo viên, phụ huynh**, thảo luận, hơn 1.000 công cụ tích hợp | **Khoá học mẫu của trường đẩy xuống các lớp** (tổ chuyên môn soạn một lần cho cả khối), vai trò phụ huynh, chấm nhanh |
| K12Online (Viettel) | `k12online.vn` | Lớp học ảo, điểm danh, báo cáo; bài giảng video, tài liệu, **SCORM**; bài tập, kiểm tra tự chấm; thi cấp trường, phòng, sở; kho học liệu và ngân hàng câu hỏi dùng chung; **kế hoạch bài dạy nộp cho tổ trưởng, nhà trường duyệt**; thời khoá biểu riêng cho học sinh; họp trực tuyến; ứng dụng di động; liên kết SMAS, SSO, cơ sở dữ liệu ngành; tài khoản phụ huynh | Mức kỳ vọng của trường Việt Nam: **phát được SCORM**, duyệt qua tổ, gắn thời khoá biểu, dữ liệu ngành, phụ huynh. Ứng dụng trên App Store có điểm đánh giá thấp theo kết quả tìm kiếm (**chưa xác minh** trên cửa hàng): nên đầu tư trải nghiệm trên điện thoại |
| VNPT E-Learning | Chỉ có bài báo (`baodauthau.vn`, `sggp.org.vn`, `nhandan.vn`), không tìm thấy trang giới thiệu tính năng hiện hành | Kho học liệu, ngân hàng câu hỏi, soạn giáo án điện tử, theo dõi tiến trình, điểm danh, kiểm tra trực tuyến, gợi ý bài học theo lỗ hổng kiến thức, phụ huynh xem lịch sử học, phát trực tiếp và trò chuyện, dữ liệu vnEdu (theo báo 2020 đến 2022) | Gợi ý ôn tập theo kết quả để sau; còn lại đã có trong phạm vi |
| "Viettel MOET LMS" | Không tìm thấy trang công khai của sản phẩm mang tên này | — | Ghi **chưa xác minh**; có thể là cách gọi K12Online hoặc hệ thống của Bộ |

**Phạm vi chọn cho trường phổ thông** (khác Moodle ở chỗ: không bắt giáo viên tạo lớp, gắn chặt thời khoá biểu, sổ điểm, quy định Việt Nam, phụ huynh là người dùng chính):
- **Làm:** lớp học trực tuyến tự sinh từ phân công; khoá tự chọn; khoá học mẫu của tổ chuyên môn đẩy xuống lớp (ý của Canvas Blueprint) qua luồng duyệt 22h1; chương, hoạt động; điều kiện mở; hoàn thành; lịch và hạn; bài tập, bài về nhà; nhóm; thảo luận, hỏi đáp, thông báo lớp; tiến độ, bảng điểm hoạt động, báo cáo theo vai trò; tóm tắt hằng tuần cho phụ huynh (ý của Google Classroom); hồ sơ dạy học trực tuyến theo Thông tư 09; phát gói SCORM 1.2 và SCORM 2004 không trình tự; nhập xuất khoá học; huy hiệu, chứng nhận (tuỳ chọn).
- **Để sau:** LTI 1.3, xAPI với kho bản ghi học tập (LRS) riêng, cmi5, trình tự SCORM 2004 đầy đủ, gợi ý ôn tập tự động, kiểm tra trùng lặp bài làm.
- **Không làm:** xem 20.1 điểm 3.

### 20.4 Chuẩn nội dung học tập: đánh giá và quyết định

Phiên bản chuẩn ghi theo hiểu biết sẵn có, **chưa đọc lại đặc tả trong phiên này**; phần 28h đọc đặc tả gốc trước khi làm.

| Chuẩn | Là gì | Lợi ích cho trường | Chi phí, rủi ro | Quyết định |
|---|---|---|---|---|
| **SCORM 1.2** (ADL) | Gói zip có `imsmanifest.xml`, chạy trong khung, gọi API JavaScript của LMS (`LMSInitialize`, `LMSGetValue`, `LMSSetValue`, `LMSCommit`, `LMSFinish`): trạng thái, điểm, thời gian, dữ liệu tạm | Phần lớn bài giảng điện tử do nhà xuất bản, công cụ soạn bài giảng và giáo viên Việt Nam xuất ra là SCORM; K12Online đã hỗ trợ | Gói là mã JavaScript của bên thứ ba chạy trên trình duyệt học sinh: phải chạy ở **nguồn gốc riêng, khung cô lập**, không đọc được phiên; kiểm kích thước, loại tệp | **Làm (28h):** nhập, phát trong khung cô lập ở tên miền con nội dung, bộ chuyển API ghi trạng thái, điểm, thời gian vào kết quả hoạt động |
| **SCORM 2004** (bản 4) | Như trên, API `API_1484_11`, mô hình dữ liệu khác, thêm **trình tự và điều hướng** giữa nhiều SCO | Một số gói mới dùng 2004 | Trình tự và điều hướng rất phức tạp, ít gói phổ thông dùng thật | **Làm một phần (28h):** gói một SCO hoặc nhiều SCO chạy tuần tự; trình tự đầy đủ **để sau** (GD-153) |
| **xAPI** (bản 1.0.3; xAPI 2.0 là IEEE 9274.1.1) | Câu lệnh "ai, làm gì, với cái gì" gửi tới kho bản ghi học tập (LRS) | Ghi học tập ngoài LMS; phân tích | Phải dựng LRS đúng chuẩn; dữ liệu trẻ em ra ngoài nếu dùng LRS bên ngoài; ít nội dung phổ thông trong nước dùng | **Để sau.** Nhật ký học tập nội bộ (`learning_events`) lưu **dạng gần xAPI** (người, động từ, đối tượng, kết quả, thời điểm) để sau này xuất hoặc dựng LRS mà không đổi dữ liệu |
| **cmi5** | Hồ sơ xAPI cho khoá học do LMS khởi chạy | Thay thế hiện đại của SCORM | Cần LRS; ít nội dung | **Để sau**, cùng xAPI |
| **LTI 1.3** (và LTI Advantage) | Chuẩn của 1EdTech để LMS mở công cụ học tập ngoài bằng OIDC, JWT ký; liên kết sâu, trả điểm, danh sách thành viên | Nối công cụ luyện tập, mô phỏng có trả điểm | Mỗi lần mở công cụ là **gửi dữ liệu học sinh cho bên thứ ba**: cần thỏa thuận xử lý dữ liệu từng nhà cung cấp, có thể chuyển dữ liệu trẻ em ra nước ngoài; quản lý khóa, JWKS; công sức lớn | **Để sau**, khi Eric có nhà cung cấp cụ thể và luật sư rà (GD-152); danh mục loại hoạt động cắm được nên thêm `lti` không đổi lõi |
| Gói khoá học riêng (mở rộng gói 22h2) | `school-management.course-package/1`: JSON nén của cấu trúc khoá, trang nội dung, tham chiếu học liệu (kèm gói học liệu 22h2), câu hỏi, thang tiêu chí, gói SCORM | **Nhập xuất khoá học giữa các trường** trên nền tảng; sao lưu khoá | Giữ giấy phép học liệu theo 22h1; không mang dữ liệu học sinh | **Làm (28h)**, dùng lại luồng nhập của 22h2 (nhập vào nháp, qua duyệt) |
| IMS Common Cartridge, sao lưu Moodle (`.mbz`) | Định dạng trao đổi khoá học giữa LMS | Nhận khoá học từ LMS khác | Nhiều biến thể, công sức lớn | **Để sau**, khi có trường cần chuyển từ Moodle |
| Open Badges | Chuẩn huy hiệu số kiểm chứng được | Học sinh mang huy hiệu ra ngoài | Công khai thông tin trẻ em | **Không xuất ra ngoài** ở DT-28; huy hiệu nội bộ (28i) |

### 20.5 Nguyên tắc

- **Không tạo lại thứ đã có:** lớp, học sinh, môn, giáo viên, tổ chuyên môn lấy từ dữ liệu của trường; lớp học trực tuyến của cặp lớp, môn, giáo viên **tự sinh** từ phân công; danh sách học sinh luôn theo lớp hiện tại.
- **Một lõi khoá học:** lớp học trực tuyến, khoá tự chọn, khoá học mẫu của tổ, khoá học ghi sẵn của DT-27 (27d) đều là `course_spaces` cùng cấu trúc chương, hoạt động; mọi loại hoạt động ghi chung một bảng **kết quả hoạt động** để tiến độ, bảng điểm, báo cáo, điều kiện mở không phải biết từng loại.
- **Loại hoạt động là danh mục cắm được:** học liệu, trang nội dung, liên kết, bài tập, bài kiểm tra 23a, thảo luận, hỏi đáp, học nhóm, giờ học trực tuyến, gói SCORM; thêm loại mới (LTI sau này) bằng cách đăng ký bộ xử lý, **không có `if` theo loại trong lõi**.
- **Một mô hình nhóm:** `child_groups` mở rộng bộ nhóm (28a) cho công cụ lớp học 23b, hoạt động, bài tập, đề 23a, học nhóm.
- **Một luồng duyệt học liệu:** học liệu và khoá học mẫu qua luồng duyệt tổ, trường của 22h1 (Điều 7 khoản 3 Thông tư 09).
- **Một cửa vào sổ điểm:** chỉ qua `ScoresService`, chỉ điểm thường xuyên, khi giáo viên chọn và xác nhận.
- **Phụ huynh luôn biết:** hoạt động, hạn, tiến độ, kết quả, thông báo lớp của con; tóm tắt hằng tuần; nộp thay khi con chưa có tài khoản.
- **Trẻ em trước:** không tin nhắn riêng giữa hai học sinh; mọi không gian thảo luận có giáo viên thấy, giờ mở, lọc, báo cáo, nhật ký; không bảng xếp hạng công khai; phòng video nhóm không ghi hình mặc định; gói SCORM chạy cô lập.
- **AI chỉ soạn nháp:** giữ 15.2; **không gửi bài làm của học sinh cho nhà cung cấp AI** (Eric chốt 2026-10-26, GD-142).
- **Đa thuê bao:** khoá học mẫu (dùng qua nhiều năm) ở cơ sở dữ liệu **hệ thống** của trường; lớp học trực tuyến, kết quả, bài nộp, thảo luận, nhật ký ở cơ sở dữ liệu **năm học**; tệp qua `storageKey`, khóa Redis qua `cacheKey`; hai bố cục `database` và `schema`; kiểm tĩnh đa thuê bao, ma trận cách ly (14.7); gói SCORM phục vụ ở tên miền con nội dung có tiền tố trường; dung lượng tính vào gói (S5a).
- **Không đổi hành vi phần đã có:** e2e và kiểm thử đơn vị hiện có đạt không sửa kỳ vọng (gồm spec 151 của 23b, spec 150 của 23a, các spec của 4.1.6, 4.1.7, 22h1, 22h2); trường không bật phân hệ "Học tập trực tuyến" thì không thấy gì mới.
- **Kiểm thử không gọi dịch vụ ngoài thật:** AI, video, thông báo qua bộ giả lập; gói SCORM mẫu tự soạn; dữ liệu bịa.

### 20.6 Các phần

Số giữ sẵn bắt đầu **sau dải của DT-27** (đến YCTD-264, năm học 0169, hệ thống 0109, định danh 0179, nền tảng 0249, e2e `204-`, GD-138, RR-31) và các số của DT-24, DT-25 đã gộp (PR 182, 181: định danh 0130, 0140, nền tảng 0210, 0211, e2e 160, 165, GD-109 đến GD-115, RR-21 đến RR-23): YCTD-270 cho chính bản kế hoạch này, YCTD-271 đến YCTD-280 cho mười phần, YCTD-281 đến YCTD-289 dự phòng. Migration: năm học 0170 đến 0199; hệ thống 0110 đến 0119; định danh 0180 đến 0189; nền tảng 0250 đến 0254 chỉ giữ chỗ. e2e `210-` đến `219-`, `220-` đến `224-` dự phòng. **Nếu lúc gộp nhánh chính đã dùng một số trong dải này thì đánh lại theo nhánh chính lúc gộp và ghi vào YCTD của phần.**

| Phần | Phạm vi | Đợt | Phụ thuộc | YCTD | Migration | e2e |
|---|---|---|---|---|---|---|
| 28a | **Mô hình nhóm dùng chung:** bộ nhóm `group_sets` mở rộng `child_groups` (lớp, môn, mục đích, cách chia, nhóm trưởng, lịch sử); chia tay, ngẫu nhiên, theo năng lực, cân bằng giới, ràng buộc, từ tiết nhóm 21b; 23b chuyển sang bộ nhóm; đích nhóm cho đề 23a (khi 23a đã gộp) | 1 | 23b (đã gộp); 21c, 20c | YCTD-271 | Năm học 0170, 0171 | 210 |
| 28b | **Lõi LMS:** lớp học trực tuyến tự sinh từ phân công (lớp, môn, giáo viên), khoá tự chọn có ghi danh; khoá học mẫu của tổ chuyên môn (hệ thống) qua luồng duyệt 22h1, đẩy xuống lớp; chương, hoạt động; danh mục loại hoạt động (học liệu 22h1, video, trang nội dung, liên kết, bài kiểm tra 23a; loại khác do phần sau đăng ký); điều kiện mở; lịch, hạn; hoàn thành và **kết quả hoạt động** chung; hình thức `support`, `replace` theo quyết định của Hiệu trưởng; kế hoạch dạy học trực tuyến theo tuần; nội quy dạy học trực tuyến; nhật ký học tập dạng gần xAPI; màn hình giáo viên, học sinh (23a), phụ huynh xem | 1 | 23a đã gộp cho màn hình học sinh (phần giáo viên và API làm trước) | YCTD-272 | Hệ thống 0110 đến 0112; năm học 0172 đến 0175; định danh 0180 | 211 (mở rộng `MULTI_TENANT_SPEC`, chỉ 28b sửa ở đợt 1) |
| 28c | **Bài tập trực tuyến** (loại hoạt động `assignment`): trắc nghiệm từ câu đã duyệt của 22g1 chấm bằng hàm 22g2, tự luận, ảnh, tệp, ghi âm; phiên bản bài cho phân hóa; giao cho lớp, nhóm, học sinh; hạn, nộp muộn, nộp lại; **bài nhóm** một bài nộp cho cả nhóm, đánh giá đóng góp; chấm tay, **thang tiêu chí** 22h2, ngân hàng nhận xét, trả bài, trao đổi trên bài; **gợi ý nhận xét AI** nháp chỉ từ đề, tiêu chí, điểm, không gửi bài làm (23d, GD-142) | 2 | 28b; 28a (bài nhóm); 23d cho phần AI | YCTD-273 | Năm học 0176 đến 0179; định danh 0181 | 212 |
| 28d | **Tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo:** tiến độ từng học sinh và cả lớp; bảng điểm hoạt động; **đưa vào điểm thường xuyên** (THCS, THPT) qua `ScoresService` nguồn `activity` khi giáo viên chọn; Tiểu học: kết quả hoạt động làm căn cứ gợi ý nhận xét thường xuyên và mức đạt môn, giáo viên xác nhận (GD-141); báo cáo cho giáo viên bộ môn, chủ nhiệm, tổ chuyên môn, Hiệu trưởng, phụ huynh; tóm tắt hằng tuần cho phụ huynh; báo cáo hoạt động dạy của giáo viên; **báo cáo tổng kết dạy học trực tuyến theo học kỳ** và **xuất hồ sơ dạy học trực tuyến** (Thông tư 09 Điều 8, Điều 15 khoản 6); ghi `question_usages` | 2 | 28b; đọc kết quả của 28c khi 28c gộp | YCTD-274 | Năm học 0180, 0181 | 213 |
| 28e | **Giao tiếp trong lớp và nhóm:** thông báo lớp (tới học sinh, phụ huynh qua hàng đợi thông báo), diễn đàn lớp, **hỏi đáp** (học sinh hỏi, giáo viên và bạn trả lời, giáo viên xác nhận câu trả lời), **không gian học nhóm** (thảo luận, tệp chung, chia việc, ghi chú) cùng bộ máy thảo luận; an toàn trẻ em (giáo viên luôn thấy, không tin nhắn riêng, giờ mở, lọc, ẩn vẫn lưu, báo cáo vi phạm, hàng chờ của trường); **lịch học tập** của học sinh (hạn hoạt động, giờ học trực tuyến, thời khoá biểu) | 2 | 28b; 28a | YCTD-275 | Năm học 0182 đến 0184; định danh 0182 | 214 |
| 28f | **Bài về nhà và phụ huynh:** giao bài về nhà từ tiết trong sổ đầu bài (gắn `class_log_id`, học liệu, hạn theo tiết kế tiếp); giới hạn khối lượng theo cấp, khối, ngày; lịch khối lượng của lớp; ứng dụng phụ huynh xem bài của con, **nộp thay**, xác nhận đã xem; nhắc có giờ yên lặng; miễn, gia hạn khi vắng | 3 | 28c | YCTD-276 | Năm học 0185, 0186 | 215 |
| 28g | **Học trực tuyến trực tiếp và học nhóm có video:** loại hoạt động "giờ học trực tuyến" mở phòng lớp của 27a từ lịch; phòng video nhóm theo bộ nhóm; **phòng chia nhỏ** khi giáo viên dạy lớp; giáo viên quan sát luôn hiện; không ghi hình mặc định; điểm danh giờ học trực tuyến từ nhật ký phòng vào kết quả hoạt động | 3 | 27a đã gộp; 28b, 28e | YCTD-277 | Năm học 0187, 0188 | 216 |
| 28h | **Chuẩn nội dung và trao đổi khoá học:** nhập, phát gói **SCORM 1.2** và **SCORM 2004** (một SCO hoặc tuần tự) trong khung cô lập ở tên miền con nội dung, bộ chuyển API ghi kết quả hoạt động; **gói khoá học** `school-management.course-package/1` nhập xuất giữa các trường, dùng lại luồng nhập và duyệt của 22h2 | 3 | 28b; 22h2 (đã gộp) | YCTD-278 | Hệ thống 0113, 0114; năm học 0189, 0190 | 217 (kiểm cách ly gói SCORM và tên miền nội dung ở nhiều trường: mở rộng `MULTI_TENANT_SPEC`, chỉ 28h sửa ở đợt 3) |
| 28i | **Huy hiệu và chứng nhận hoàn thành (tuỳ chọn, tắt mặc định):** huy hiệu nội bộ theo tiêu chí, chỉ học sinh, phụ huynh, giáo viên thấy; chứng nhận hoàn thành khoá tự chọn (PDF có mã kiểm tra trên trang công khai của trường) | 4 | 28b, 28d | YCTD-279 | Năm học 0191, 0192 | 218 |
| 28j | **Học khi mạng yếu:** bản nháp, ảnh, ghi âm chờ gửi và nội dung hoạt động đã mở của **chính học sinh** lưu trên máy (IndexedDB), hàng đợi gửi lại chống trùng, xóa khi nộp, đăng xuất, quá hạn; dùng vỏ PWA của 26a | 4 | 26a đã gộp; 28c, 28f | YCTD-280 | Năm học 0193 (nếu cần mã chống trùng) | 219 |

Giữ chỗ chưa giao: YCTD-281 đến YCTD-289; năm học 0194 đến 0199; hệ thống 0115 đến 0119; định danh 0183 đến 0189; nền tảng 0250 đến 0254; e2e `220-` đến `224-`.

Đợt làm, mỗi lúc **tối đa ba phiên**, **không hai phiên cùng sửa một tệp lõi trong cùng đợt**; lõi LMS và mô hình nhóm đi trước:
- **Đợt 1: 28a, 28b.** 28a sở hữu `apps/api/src/child-groups/`, `apps/api/src/classroom-tools/` phần nhóm, `apps/teacher/src/tools/` phần chia nhóm, và là phần duy nhất sửa `online-exams/` (đích `group`, khi 23a đã gộp); 28b sở hữu phân hệ mới `apps/api/src/learning/` (lõi LMS), `database/system/` phần khoá học mẫu, `MULTI_TENANT_SPEC`, màn hình lớp học trực tuyến ở cổng quản trị, ứng dụng giáo viên, màn hình học sinh; 28b chỉ **đọc** `learning-resources/`, `timetables/`, `child-groups/` qua hàm xuất sẵn và gọi dịch vụ duyệt của 22h1, không sửa tệp của 22h1.
- **Đợt 2: 28c, 28d, 28e.** Ba phần làm trong thư mục con riêng của `learning/` (`assignments/`, `progress/`, `discussions/`), **không sửa lõi của 28b** (chỉ thêm dòng đăng ký ở cuối tệp danh mục loại hoạt động); 28c là phần duy nhất sửa phân hệ AI của 23d; 28d là phần duy nhất sửa `apps/api/src/scores/` (nguồn `activity`) và `assessments/` phần `regular_comments`; 28e là phần duy nhất thêm mẫu thông báo mới. **Bốn tính năng Eric yêu cầu xong phần chính khi đợt 2 gộp** (chia nhóm ở 28a, học nhóm không video ở 28e, bài tập ở 28c; bài về nhà ở 28f đợt 3 vì cần 28c).
- **Đợt 3: 28f, 28g, 28h.** 28f sở hữu `class-logs/` phần bài về nhà và phía phụ huynh của `apps/parent`; 28g sửa phân hệ video của 27a phần phòng nhóm, phòng chia nhỏ (thư mục con mới); 28h sở hữu `learning/content-packages/`, cấu hình tên miền con nội dung, `MULTI_TENANT_SPEC` ở đợt 3.
- **Đợt 4: 28i, 28j.** 28i trong `learning/badges/`; 28j sửa `packages/pwa` (thư mục con mới) và màn hình nộp bài của học sinh.
- Đăng ký mô-đun, tuyến, menu theo kiểu **thêm cuối tệp** (`application.module.ts`, `packages/shared/src/portal-menu.ts`, `PORTAL_WORKSPACES`).

**Thứ tự với DT-27** (đề xuất cho phiên điều phối): DT-27 đợt 1 (27a, 27b) chạy song song DT-28 đợt 1 được (không chung tệp); 27c giữ nguyên ở đợt 2 của DT-27; **27d và 27e chỉ bắt đầu khi DT-28 đợt 2 đã gộp** (27d xây trên 28b, 28d; 27e xây trên 28e). 28g cần 27a. Mục 19 đã cập nhật dòng phụ thuộc theo đây (YCTD-270).

Thứ tự gộp để đánh số tài liệu (phiên bản, CT, AC, BR, MH, PQ, mã chức năng): theo thứ tự xong trong từng đợt; phần gộp sau đánh lại số tài liệu theo nhánh chính lúc gộp. YCTD, migration, e2e giữ sẵn không đổi theo thứ tự gộp (trừ khi va với nhánh chính).

Cỡ ước lượng (một phần của DT-16 là một đơn vị): 28a 1,0; 28b 2,0; 28c 1,5; 28d 1,0; 28e 1,25; 28f 1,0; 28g 1,0; 28h 1,25; 28i 0,5; 28j 0,5; tổng khoảng 11 đơn vị.

**Điều kiện ra** (nghiệm thu với Eric, dữ liệu giả, ở cả hai bố cục cơ sở dữ liệu):
- **Đợt 1:** ban hành thời khoá biểu thì mỗi cặp lớp, môn, giáo viên có lớp học trực tuyến mà giáo viên không phải tạo; tổ Toán soạn khoá học mẫu Toán 7, qua duyệt tổ trưởng và Ban Giám hiệu, đẩy xuống bốn lớp 7; hoạt động 2 chỉ mở khi học sinh xong hoạt động 1; một hoạt động có hạn hiện trên màn hình học sinh và phụ huynh; Hiệu trưởng nhập quyết định chuyển một lớp sang `replace` một tuần; khoá CLB tự chọn có ghi danh; giáo viên chia lớp 7 thành 6 nhóm theo năng lực có cân bằng giới, công cụ lớp học 23b dùng bộ nhóm đó (spec 151 đạt không sửa kỳ vọng); trường khác không đọc được lớp học trực tuyến, khoá mẫu của trường này.
- **Đợt 2:** bài tập có trắc nghiệm, tự luận, ảnh, một phiên bản cho 3 học sinh, một bài nhóm; chấm bằng thang tiêu chí, trả bài; bảng điểm hoạt động hiện tiến độ lớp; điểm một hoạt động được xác nhận vào điểm thường xuyên (THCS); ở Tiểu học, gợi ý nhận xét và mức đạt môn từ kết quả hoạt động được giáo viên sửa, xác nhận vào `regular_comments`, `subject_results`, không có điểm số; chủ nhiệm, tổ trưởng, Hiệu trưởng, phụ huynh xem đúng báo cáo của mình; báo cáo tổng kết học kỳ và hồ sơ dạy học trực tuyến xuất được; học sinh hỏi trong lớp, bạn trả lời, giáo viên xác nhận; nhóm thảo luận và chia việc, tin có số điện thoại bị che, ngoài giờ không đăng được, một báo cáo vi phạm vào hàng chờ; gợi ý nhận xét AI giả lập không chứa chuỗi mồi của bài làm trong lời nhắc.
- **Đợt 3:** bài về nhà giao từ sổ đầu bài; trường chưa đặt quy tắc thì không chặn, Ban Giám hiệu đặt quy tắc chặn lớp 1 và cảnh báo quá thời lượng thì hệ thống áp đúng; phụ huynh nhận nhắc (bộ giả lập) và nộp thay; giờ học trực tuyến mở phòng 27a, chia 4 phòng nhỏ theo bộ nhóm; một gói SCORM 1.2 và một gói SCORM 2004 mẫu chạy trong khung cô lập, ghi điểm và trạng thái; khoá học xuất ở trường A nhập được ở trường B vào nháp, qua duyệt.
- **Đợt 4:** trường bật huy hiệu, học sinh nhận huy hiệu hoàn thành chương, chứng nhận khoá CLB kiểm tra được bằng mã; học sinh làm bài khi ngắt mạng, có mạng lại thì tự gửi, không trùng.

### 20.7 Phạm vi chi tiết

**28a. Mô hình nhóm dùng chung**
- **Mở rộng `child_groups`, thêm `group_sets`:** bộ nhóm có lớp, môn (tuỳ chọn), mục đích (`subject`, `activity`, `classroom`), cách chia (`manual`, `random`, `ability_mixed`, `ability_tiered`, `gender_balanced`, `timetable_group`), tham số, người lập, hiệu lực, trạng thái `active`, `archived`, tên. `child_groups` thêm `group_set_id`, `class_id`, `position`, `leader_child_id` (có thể trống); nhóm DT-14c giữ `group_set_id` trống, màn hình 4.1.6 không đổi. Ràng buộc tên duy nhất tách hai ràng buộc riêng phần (trong đơn vị khi không thuộc bộ; trong bộ khi thuộc bộ). `child_group_members` thêm `role`; `child_group_member_events` ghi đổi thành viên, nhóm trưởng.
- **Lịch sử:** chia lại là bộ mới, bộ cũ lưu trữ; bài, đề, không gian đã gắn bộ cũ giữ nguyên.
- **Cách chia (hàm thuần, kiểm thử đơn vị):** ngẫu nhiên có hạt; theo năng lực từ điểm trung bình môn học kỳ gần nhất (THCS, THPT), mức đạt môn (Tiểu học) hoặc kết quả hoạt động gần nhất (28d); trộn kiểu rắn hoặc gom tầng; cân bằng giới theo `children.gender`; ràng buộc "không cùng nhóm", "cùng nhóm"; loại học sinh vắng; **mức năng lực không lưu, không hiện cho học sinh, phụ huynh** (GD-140).
- **Từ tiết nhóm 21b:** sinh bộ nhóm từ tổ hợp môn của nhóm tiết; không đổi `group_no`.
- **Nhóm trưởng:** chọn tay, ngẫu nhiên, luân phiên theo tuần.
- **Chuyển 23b:** chia nhóm trong công cụ lớp học lưu thành bộ `classroom`, chọn được bộ sẵn có; migration 0171 dời `classroom_groupings` sang bộ nhóm, bảng cũ giữ chỉ đọc một bản phát hành; hàng đợi ngoại tuyến theo `client_id` như cũ; spec 151 đạt.
- **Đích nhóm cho 23a:** thêm `group` vào `exam_assignment_targets.kind`; thành viên lúc phát hành tính như đích học sinh; spec 150 đạt.
- **Quyền, hiển thị:** giáo viên lập bộ nhóm cho lớp, môn mình được phân công; Ban Giám hiệu xem mọi bộ; học sinh, phụ huynh thấy nhóm của mình (tên nhóm, nhóm trưởng, bạn trong nhóm).

**28b. Lõi LMS**
- **Lớp học trực tuyến (`course_spaces`, năm học):** loại `class_subject` (lớp, môn, một hoặc nhiều giáo viên) hoặc `elective` (khoá tự chọn: CLB, bồi dưỡng, hoạt động trải nghiệm; người phụ trách, đối tượng theo khối, lớp, số chỗ, cách ghi danh theo GD-156). **Tự sinh** khi bản thời khoá biểu được ban hành và khi phân công đổi: một lớp học trực tuyến cho mỗi cặp lớp, môn trong `timetable_lessons` của bản đang áp dụng (giáo viên là người dạy cặp đó; Tiểu học giáo viên chủ nhiệm dạy nhiều môn có nhiều lớp học trực tuyến); thiếu thời khoá biểu thì sinh từ `class_staff_assignments` có môn; đổi giáo viên thì chuyển quyền, giữ nội dung; không xóa lớp học trực tuyến đã có dữ liệu; lớp chưa có nội dung **ẩn với học sinh** đến khi giáo viên mở (GD-154). Thành viên học sinh **suy ra từ danh sách lớp hiện tại** (không chép); nhóm tiết 21b theo tổ hợp môn của học sinh; khoá tự chọn có bảng ghi danh `course_enrollments`.
- **Khoá học mẫu (`course_templates`, `course_template_sections`, `course_template_items`, hệ thống 0110 đến 0112):** tổ chuyên môn soạn một lần theo môn, khối, dùng qua nhiều năm học; **duyệt bằng luồng của 22h1** (tổ trưởng của tổ, rồi Ban Giám hiệu; gọi dịch vụ duyệt của 22h1 hoặc tách hàm duyệt dùng chung nếu cần, không viết luồng thứ hai); sửa khoá đã duyệt tạo phiên bản mới, qua duyệt lại. **Đẩy xuống lớp:** chọn các lớp học trực tuyến cùng môn, khối; nội dung chép thành bản của lớp kèm `template_version`; mẫu có phiên bản mới thì giáo viên thấy "có cập nhật" và chọn nhận (phần giáo viên đã sửa không bị ghi đè).
- **Cấu trúc:** `course_sections` (chương hoặc chủ đề, thứ tự, tuần dự kiến), `course_activities` (loại, tham chiếu tới đối tượng của loại, tiêu đề, hướng dẫn, thứ tự, bắt buộc hay không, hình thức `support` hoặc `replace`, thời lượng dự kiến, giờ mở, hạn, đóng, bộ nhóm áp dụng, điều kiện mở, cách tính hoàn thành, có tính điểm hay không, trọng số, tuần của kế hoạch). "Bài" theo cách gọi của chương trình là tiêu đề gom nhiều hoạt động trong một chương (hai tầng thật, đơn giản cho giáo viên).
- **Danh mục loại hoạt động** (mỗi loại một bộ xử lý: tạo, hiển thị cho học sinh, tính hoàn thành, ghi kết quả): `resource` (học liệu đã duyệt của 22h1; video phát bằng đường dẫn ký ngắn hạn, ghi phần trăm đã xem theo nhịp; chuyển mã nhiều độ phân giải để sau như 27d), `page` (trang nội dung giáo viên soạn, định dạng tối thiểu, ảnh, công thức; duyệt theo GD-151), `link` (liên kết ngoài trong danh sách tên miền trường cho phép), `exam` (bài kiểm tra 23a: gọi giao đề của 23a, kết quả đọc từ lượt làm), `live_session` (28g), `assignment` (28c), `discussion`, `question_board`, `group_work` (28e), `scorm` (28h). Phần sau đăng ký loại của mình **thêm cuối tệp danh mục**; LTI sau này là một loại mới.
- **Điều kiện mở (hàm thuần, kiểm thử đơn vị):** hoàn thành hoạt động hoặc chương trước; đạt điểm hoặc mức tối thiểu ở hoạt động chỉ định; từ ngày giờ; thuộc nhóm của bộ nhóm; kết hợp "và", "hoặc" một tầng; giáo viên mở riêng cho một học sinh (hòa nhập, học bù) có ghi lý do. Học sinh thấy hoạt động khóa kèm lý do.
- **Hoàn thành và kết quả hoạt động (`activity_results`, năm học):** một dòng cho mỗi học sinh, hoạt động (hoặc nhóm với bài nhóm): trạng thái `not_started`, `in_progress`, `completed`, `passed`, `failed`, `excused`; điểm thang 10 hoặc mức (Tiểu học); lúc hoàn thành; nguồn; cách tính hoàn thành theo loại (đã xem, đã nộp, đạt điểm, giáo viên đánh dấu). **Mọi loại hoạt động ghi bảng này**; tiến độ, bảng điểm, báo cáo, điều kiện mở chỉ đọc bảng này.
- **Lịch, hạn:** hạn và giờ mở hiện ở lịch học tập (28e); nhắc trước hạn qua hàng đợi thông báo; hạn riêng cho học sinh được gia hạn.
- **Hình thức và quyết định của Hiệu trưởng (Thông tư 09 Điều 5 khoản 4, Điều 6, Điều 15):** `online_teaching_decisions` (`support` mặc định; `replace` cần số, ngày, lý do bất khả kháng, phạm vi lớp, môn, thời gian, tệp, người nhập); bài kiểm tra định kỳ trực tuyến chỉ chọn được khi có quyết định `replace` đang hiệu lực cho lớp đó.
- **Kế hoạch dạy học trực tuyến theo tuần:** mỗi lớp học trực tuyến có bảng tuần, chương, hoạt động, hình thức (sinh từ cấu trúc và tuần dự kiến, giáo viên chỉnh); tổ trưởng xem kế hoạch các lớp trong tổ; dùng cho hồ sơ Điều 8.
- **Nội quy dạy học trực tuyến:** trường soạn văn bản có phiên bản; học sinh (hoặc phụ huynh với học sinh chưa có tài khoản) xác nhận đã đọc ở lần đầu vào lớp và khi có phiên bản mới.
- **Nhật ký học tập (`learning_events`, năm học):** người (mã học sinh trong trường), động từ (đã mở, đã xem, đã nộp, đã hoàn thành, đã hỏi...), đối tượng (hoạt động), kết quả, thời điểm; **dạng gần xAPI**; ghi theo lô; giữ theo thời hạn lưu (GD-146); không ghi vị trí, chuỗi nhận dạng thiết bị.
- **Quyền (định danh 0180):** `P02.learning.teach` (giáo viên của lớp học trực tuyến), `P02.learning.template` (soạn khoá mẫu: giáo viên trong tổ), `P02.learning.decide` (quyết định hình thức: Hiệu trưởng), `P02.learning.view` (Ban Giám hiệu, tổ trưởng xem); học sinh gọi `/student/learning/*` chỉ thấy lớp của mình.
- **Màn hình:** cổng quản trị (Học tập trực tuyến: lớp học trực tuyến theo lớp, môn; khoá học mẫu của tổ; khoá tự chọn; quyết định hình thức; nội quy); ứng dụng giáo viên (lớp học trực tuyến của tôi, soạn nhanh, xem tiến độ); màn hình học sinh của 23a (các lớp, chương, hoạt động, khóa, hạn); ứng dụng phụ huynh (các lớp và hoạt động của con, chỉ đọc).
- **Gói:** phân hệ "Học tập trực tuyến" tách ở danh sách phân hệ để gói (S5a) bật tắt; dung lượng tính vào gói.

**28c. Bài tập trực tuyến**
- **Bảng (năm học):** `assignments` (tham chiếu hoạt động của lõi; ngữ cảnh `in_class` hoặc `homework`; cách làm `individual` hoặc `group`; chính sách nộp muộn, số lần nộp; cách chấm `score`, `rubric`, `level`, `completion`, `none`; chế độ hiện kết quả trắc nghiệm; thời lượng dự kiến), `assignment_variants`, `assignment_items` (`question` kèm bản chụp câu 22g1, `essay`, `upload`, `audio`, `resource`), `assignment_targets` (lớp, nhóm, học sinh → phiên bản), `assignment_recipients` (chốt danh sách khi phát hành, hạn riêng, miễn), `assignment_submissions` (học sinh hoặc nhóm, lần nộp, trạng thái, muộn, người nộp `student`, `guardian`, `teacher`, câu trả lời, điểm, điểm theo tiêu chí, mức, nhận xét, lúc trả), `submission_files` (`storageKey('assignment-submissions', …)`), `submission_comments`, `submission_contributions`.
- **Trắc nghiệm:** chỉ câu đã duyệt của 22g1, bản chụp, chấm ở máy chủ bằng hàm chấm 22g2; đáp án không xuống máy trước khi hiện kết quả; không làm lại máy làm bài 23a (không đồng hồ cứng, không khóa toàn màn hình).
- **Làm và nộp:** lưu nháp từng phần; ảnh nén và **xóa siêu dữ liệu trên máy**; ghi âm có giới hạn; nộp muộn đánh dấu; nộp lại tạo lần mới.
- **Bài nhóm:** bản nháp chung có khóa lạc quan; nhóm trưởng nộp; tự đánh giá, đánh giá chéo ngắn chỉ giáo viên xem; giáo viên điều chỉnh điểm cá nhân có lý do.
- **Chấm, trả:** theo học sinh hoặc theo câu; thang tiêu chí 22h2; ngân hàng nhận xét (dùng lại thư viện câu nhận xét của 20c, thêm câu của giáo viên); trả từng bài hoặc hàng loạt; kết quả ghi `activity_results`.
- **Gợi ý nhận xét AI (23d):** lời nhắc chỉ gồm môn, lớp, đề, thang tiêu chí, mức hoặc điểm giáo viên đã cho, ghi chú ngắn của giáo viên đã quét dữ liệu cá nhân; **không bao giờ có bài làm, ảnh, ghi âm của học sinh** (Eric chốt 2026-10-26, GD-142; không làm chế độ gửi bài làm); nháp chỉ giáo viên thấy; nhận xét đã trả ghi "có AI hỗ trợ"; nhật ký, hạn mức theo 23d.
- **Quyền (định danh 0181):** `P02.assignment.manage`; học sinh chỉ thấy bài của mình và nhóm mình.

**28d. Tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo**
- **Tiến độ:** theo học sinh (phần trăm hoạt động bắt buộc đã hoàn thành, quá hạn, đang chờ chấm), theo lớp (lưới học sinh × hoạt động), theo chương; danh sách "cần chú ý" cho giáo viên và chủ nhiệm; **không xếp hạng công khai**.
- **Bảng điểm hoạt động:** cột theo hoạt động có tính điểm, trọng số theo nhóm hoạt động, điểm trung bình hoạt động (chỉ tham khảo, không phải điểm trung bình môn của Thông tư 22); Tiểu học hiện mức; xuất Excel.
- **Vào sổ điểm:** giáo viên chọn hoạt động, cách gộp (một hoạt động, trung bình có trọng số), học kỳ, lần đánh giá thường xuyên, xem trước, xác nhận; ghi qua `ScoresService` (hàm mới cùng cửa với `recordExamScores`, cùng kiểm quyền nhập, khoá, hạn của 21c); `score_entries.source` thêm `activity` (năm học 0180); **chỉ `kind = regular`**; học sinh miễn hoặc chưa nộp bỏ trống. **Tiểu học (Eric chốt 2026-10-26, GD-141):** không ghi điểm số; kết quả hoạt động (mức, điểm hoạt động, nhận xét đã trả) là căn cứ để máy gợi ý câu nhận xét thường xuyên (`regular_comments`, chọn từ thư viện câu nhận xét của 20c và nhận xét đã trả) và gợi ý mức đạt môn của kỳ (`subject_results`, Hoàn thành tốt, Hoàn thành, Chưa hoàn thành); giáo viên xem, sửa, xác nhận mới ghi, cùng kiểm quyền nhập, khoá, hạn của 20c. **Công tắc theo trường, mặc định bật**; mỗi hoạt động mặc định không đưa vào sổ, giáo viên chọn từng hoạt động; không có gì tự ghi.
- **Báo cáo theo vai trò:** giáo viên bộ môn (lớp mình dạy); **giáo viên chủ nhiệm** (mọi môn của lớp: tiến độ, quá hạn, học sinh cần chú ý); **tổ chuyên môn** (các lớp của môn trong tổ: tỷ lệ hoàn thành, độ phủ kế hoạch, dùng khoá mẫu); **Hiệu trưởng** (toàn trường: lớp đang dùng, hoạt động giao theo tuần, tỷ lệ tham gia, thời gian phản hồi của giáo viên, theo hình thức); **phụ huynh** (con: tiến độ, hạn, kết quả, nhận xét); **tóm tắt hằng tuần cho phụ huynh** qua hàng đợi thông báo, bật theo trường.
- **Hồ sơ theo Thông tư 09:** báo cáo tổng kết dạy học trực tuyến theo học kỳ (số liệu tự tổng hợp, ô đánh giá, khó khăn, nguyên nhân, kiến nghị do Ban Giám hiệu nhập), xuất PDF, Excel để gửi Sở (Điều 15 khoản 6); **xuất hồ sơ dạy học trực tuyến** theo lớp, môn, học kỳ (kế hoạch theo tuần, hoạt động, tổng hợp nhật ký, kết quả) (Điều 8 khoản 1).
- **Câu hỏi:** câu trắc nghiệm đã dùng ghi `question_usages` với tỷ lệ đúng.

**28e. Giao tiếp trong lớp và nhóm**
- **Một bộ máy thảo luận** (`discussion_threads`, `discussion_posts`, `discussion_reports`, năm học) với phạm vi `course_space` (diễn đàn lớp, hỏi đáp, thông báo lớp) hoặc `group` (không gian học nhóm).
- **Thông báo lớp:** giáo viên đăng, học sinh đọc, phụ huynh nhận qua hàng đợi thông báo (và `push` của 26b khi có, nội dung đẩy không có dữ liệu cá nhân); dùng cho Điều 15 khoản 1 điểm e Thông tư 09.
- **Diễn đàn lớp:** chủ đề do giáo viên mở (hoặc học sinh mở nếu giáo viên cho), trả lời một tầng.
- **Hỏi đáp:** học sinh hỏi (chữ, ảnh), gắn chương hoặc hoạt động; giáo viên và bạn trả lời; giáo viên **xác nhận câu trả lời đúng**; câu hỏi riêng chỉ giáo viên thấy; hàng chờ câu chưa trả lời có nhắc quá hạn. Đây là nền cho 27e.
- **Không gian học nhóm:** bảng tin, tệp chung, **việc chia việc** (việc, người làm, hạn, trạng thái), ghi chú chung có phiên bản; bài nhóm của 28c mở từ đây.
- **An toàn trẻ em (phần in đậm trường không tắt được):** **giáo viên của lớp học trực tuyến và người lập bộ nhóm luôn thấy mọi nội dung**; **không có tin nhắn riêng giữa hai học sinh**; giờ mở (GD-144), ngoài giờ chỉ đọc; lọc số điện thoại, thư điện tử, liên kết ngoài, tài khoản mạng xã hội, danh sách từ ngữ của trường (che, cảnh báo, gắn cờ); **nút báo cáo**; hàng chờ xử lý của trường (chủ nhiệm, Ban Giám hiệu, người tư vấn tâm lý học đường) có thời hạn, tạm khóa quyền viết, giữ bằng chứng; xóa của học sinh là ẩn, vẫn lưu cho giáo viên và quản trị; nhật ký. Hàm lọc thông tin liên lạc là hàm thuần trong `packages/shared`, 27i dùng lại.
- **Phụ huynh:** đọc thông báo lớp; xem không gian nhóm của con theo GD-145.
- **Lịch học tập:** lịch tuần, tháng của học sinh ghép thời khoá biểu, giờ học trực tuyến (28g), hạn hoạt động, bài về nhà (28f); phụ huynh xem lịch của con; không xuất iCal (GD-157).
- **Quyền (định danh 0182):** `P02.discussion.moderate`.

**28f. Bài về nhà và phụ huynh**
- **Từ sổ đầu bài:** nút "Giao bài về nhà" ở tiết mở bài tập 28c đã điền lớp học trực tuyến, ngữ cảnh `homework`, hạn trước tiết kế tiếp của môn theo thời khoá biểu, gắn `class_log_id` và học liệu; sổ đầu bài hiện bài về nhà của tiết (đọc từ bảng bài tập); tiết nhóm 21b gắn `group_no`.
- **Quy tắc khối lượng do trường tự cấu hình (`homework_policies`, Eric chốt 2026-10-26, GD-143):** nền tảng **không đặt giới hạn mặc định**; Ban Giám hiệu đặt theo cấp, khối: số bài, số phút dự kiến mỗi ngày, ngày không giao (ngày nghỉ, ngày lễ, khối không giao bài về nhà), xử lý `warn` hoặc `block`, ô "căn cứ" để trường ghi văn bản của Sở, của trường; trường tự đối chiếu quy định. Hướng dẫn sử dụng có **bảng mẫu gợi ý** (ví dụ lớp 1 không giao theo Công văn 3977 **chưa xác minh**, ngưỡng phút theo cấp) để trường tham khảo, **không bật sẵn**. Trường chưa đặt quy tắc thì không chặn, không cảnh báo. Lịch khối lượng 7 ngày của lớp vẫn hiện cho giáo viên trước khi phát hành; chủ nhiệm, Ban Giám hiệu xem khối lượng theo lớp, tuần; Ban Giám hiệu vượt chặn có lý do.
- **Ứng dụng phụ huynh:** "Bài tập của con" theo ngày, hạn, trạng thái, kết quả, nhận xét; **nộp thay** khi con chưa có tài khoản (chụp vở, ghi âm, gõ ngắn), `submitted_by_kind = guardian`; "Đã xem cùng con"; trao đổi trên bài.
- **Nhắc:** `homework_assigned`, `homework_due_soon` (mặc định 19:00 hôm trước), `homework_missing`, `homework_returned`; giờ yên lặng 21:00 đến 6:00; gộp nhiều bài một ngày.
- **Vắng học:** gợi ý gia hạn hoặc miễn khi học sinh vắng có phép ngày giao.

**28g. Học trực tuyến trực tiếp và học nhóm có video**
- **Dùng lại 27a:** phòng của `VideoRoomProvider` với ngữ cảnh `course_space` (giờ học trực tuyến của lớp), `group`, `breakout`; bảng trắng, chia sẻ màn hình, giới hạn phút theo gói của 27a; không thêm bộ nối, không thêm dịch vụ video. Đáp ứng "phần mềm tổ chức dạy học trực tuyến trực tiếp" ở Thông tư 09 Điều 9 khoản 1 (kênh hình, tiếng, chữ, chia sẻ màn hình).
- **Giờ học trực tuyến** (`live_session`): giáo viên đặt lịch trong lớp học trực tuyến (gợi ý theo tiết của thời khoá biểu), học sinh vào từ lịch; điểm danh từ nhật ký vào ra ghi `activity_results` (giáo viên xác nhận); ghi hình theo GD-131 của 27a (tắt mặc định).
- **Phòng nhóm:** mở theo lịch hoặc giáo viên mở; học sinh tự mở chỉ khi giáo viên bật cho bộ nhóm, trong giờ mở; giáo viên quan sát bất cứ lúc nào, **học sinh luôn thấy "giáo viên đang xem"** (GD-149); không ghi hình; báo cáo nối hàng chờ 28e.
- **Phòng chia nhỏ:** từ giờ học của lớp, chọn bộ nhóm hoặc chia ngẫu nhiên (lưu bộ `classroom`), đặt thời lượng, gửi thông báo tới mọi phòng, gọi tất cả về, giáo viên chuyển phòng, học sinh "gọi giáo viên".

**28h. Chuẩn nội dung và trao đổi khoá học**
- **Nhập gói SCORM:** giáo viên tải gói zip (giới hạn GD-150), máy chủ kiểm `imsmanifest.xml`, xác định 1.2 hay 2004, danh sách SCO, chặn đường dẫn thoát thư mục và loại tệp không cho phép; gói là **học liệu** nên qua duyệt 22h1 (Thông tư 09 Điều 7 khoản 3); lưu giải nén ở kho tệp theo `storageKey('scorm', …)`.
- **Phát cô lập:** phục vụ ở **tên miền con nội dung riêng** (ví dụ `noi-dung.<tên miền hệ thống>`, tiền tố trường trong đường dẫn, mã truy cập ngắn hạn theo học sinh và hoạt động); khung `iframe` có `sandbox` chỉ cho chạy mã, **không cùng nguồn gốc với ứng dụng** nên không đọc được phiên, cookie, dữ liệu khác; trang cha có bộ chuyển API (`API` cho 1.2, `API_1484_11` cho 2004) nhận lời gọi qua `postMessage` có kiểm nguồn gốc, lưu trạng thái, điểm (quy về thang 10), thời gian, dữ liệu tạm có giới hạn kích thước vào kết quả hoạt động; SCORM 2004 nhiều SCO chạy tuần tự, **không làm trình tự và điều hướng** (GD-153).
- **Gói khoá học** `school-management.course-package/1`: JSON nén gồm cấu trúc khoá, trang nội dung, câu hỏi, thang tiêu chí, gói SCORM và gói học liệu 22h2 cho học liệu tham chiếu; **không chứa dữ liệu học sinh**; giữ giấy phép, nguồn theo 22h1; nhập vào **khoá học mẫu nháp**, qua duyệt; dùng lại hàm đọc, kiểm của `resource-sharing-rules.ts`.
- **Đa thuê bao:** spec 217 ở chế độ nhiều trường (mã truy cập gói của trường A không mở được ở trường B; gói không đọc được cookie của ứng dụng).

**28i. Huy hiệu và chứng nhận hoàn thành**
- Tắt mặc định (GD-155). Huy hiệu nội bộ từ danh sách tiêu chí có sẵn (hoàn thành chương, khoá, nộp đúng hạn N lần liên tiếp, giáo viên trao kèm lý do); chỉ học sinh đó, phụ huynh, giáo viên thấy; **không bảng xếp hạng**, không so sánh giữa học sinh.
- Chứng nhận hoàn thành cho **khoá tự chọn** (và khoá của 27d sau này): PDF theo mẫu của trường, mã kiểm tra; trang kiểm tra công khai chỉ hiện tên khoá, ngày cấp, tên trường, họ tên viết tắt; thu hồi được.

**28j. Học khi mạng yếu**
- Chỉ màn hình học tập của học sinh và nộp thay của phụ huynh: nội dung hoạt động đã mở (trừ video, gói SCORM), bản nháp câu trả lời, ảnh, ghi âm chờ gửi của **chính người dùng** ở IndexedDB theo nguồn gốc trường (26a); xóa khi nộp, đăng xuất, quá GD-148; hàng đợi gửi theo thứ tự, gửi tệp từng phần, mã chống trùng do máy sinh; ghi thời điểm bấm nộp trên máy để giáo viên xét khi muộn do mạng. Mở rộng GD-108 (GD-148, Eric đã chốt 2026-10-27).

### 20.8 Quyết định thiết kế và phương án đã loại

- **Tự viết LMS gọn trong School Management (chọn)** thay vì nhúng Moodle hay dùng LMS bên ngoài: dữ liệu học tập phải đi cùng thời khoá biểu, sổ điểm, hồ sơ học sinh, phụ huynh, đa thuê bao và kiểm tĩnh của nền tảng; Moodle là ứng dụng PHP riêng với cơ sở dữ liệu, phân quyền, tài khoản riêng (đồng bộ hai chiều, hai nơi giữ dữ liệu trẻ em, khó tách theo trường); LMS bên ngoài đưa dữ liệu trẻ em ra khỏi nền tảng. Đổi lại phải tự làm phần chuẩn nội dung: chọn làm SCORM, để sau LTI, xAPI.
- **Lớp học trực tuyến tự sinh từ phân công (chọn):** phương án đã loại: giáo viên tự tạo lớp và mời học sinh bằng mã (lặp dữ liệu, sai danh sách khi chuyển lớp).
- **Khoá học mẫu ở cơ sở dữ liệu hệ thống, bản của lớp ở năm học:** phương án đã loại: mọi thứ ở năm học (mất khoá khi sang năm), mọi thứ ở hệ thống (trộn dữ liệu học sinh nhiều năm, khó khoá sổ năm học).
- **Duyệt khoá mẫu và học liệu qua luồng 22h1:** đúng Điều 7 khoản 3 Thông tư 09; phương án đã loại: luồng duyệt riêng cho khoá học; không duyệt.
- **Hai tầng chương, hoạt động:** phương án đã loại: ba tầng cứng chương, bài, hoạt động (thêm thao tác, ít giá trị).
- **Một bảng kết quả hoạt động chung:** phương án đã loại: mỗi loại tự tính tiến độ (báo cáo phải biết mọi loại).
- **Mở rộng `child_groups` thêm bộ nhóm:** phương án đã loại: bảng nhóm thứ hai, giữ `jsonb` của 23b, dùng `group_no` của 21b làm nhóm.
- **Bài tập có bảng riêng, dùng chung câu hỏi và hàm chấm:** phương án đã loại: mở rộng `exam_assignments`, `exam_attempts` của 23a (trộn vòng đời thi và bài tập).
- **Kết quả hoạt động chỉ vào điểm thường xuyên (THCS, THPT) hoặc làm căn cứ gợi ý nhận xét, mức đạt (Tiểu học), giáo viên chọn từng hoạt động và xác nhận (Eric chốt 2026-10-26, GD-141):** Thông tư 22 Điều 6, 7, Thông tư 27/2020 và Thông tư 09 Điều 6; phương án đã loại: tự ghi điểm, cho chọn giữa kỳ, cuối kỳ.
- **Thảo luận, hỏi đáp, không gian nhóm cùng một bộ máy, không tin nhắn riêng giữa học sinh:** phương án đã loại: mở `message_threads` cho học sinh; nhóm Zalo hay mạng xã hội bên ngoài.
- **SCORM làm, LTI, xAPI, cmi5 để sau:** SCORM là thứ trường đang có; LTI kéo theo chia sẻ dữ liệu trẻ em cho bên thứ ba; xAPI, cmi5 cần LRS; nhật ký dạng gần xAPI giữ đường lui.
- **Gói SCORM ở tên miền con nội dung, khung cô lập:** phương án đã loại: chạy cùng nguồn gốc ứng dụng (mã bên thứ ba đọc được phiên).
- **Huy hiệu nội bộ, tắt mặc định, không bảng xếp hạng:** tránh áp lực, so sánh giữa trẻ; phương án đã loại: bảng xếp hạng lớp, huy hiệu công khai.
- **27d, 27e xây trên lõi LMS:** một cấu trúc khoá học, một tiến độ, một bộ máy hỏi đáp cho cả trường và gia sư; phương án đã loại: 27d, 27e tự dựng khoá học, hỏi đáp riêng (hai mô hình khoá học).
- **AI không bao giờ thấy bài làm (Eric chốt 2026-10-26, GD-142):** giữ 15.2; phương án đã loại: chế độ gửi phần chữ bài làm đã quét và bỏ tên (không làm sẵn ở DT-28; muốn có phải qua YCTD mới, Eric quyết và luật sư rà).
- **Không làm ở DT-28:** wiki, bảng thuật ngữ, cơ sở dữ liệu tự định nghĩa, hội thảo chấm chéo thành điểm, chợ ứng dụng, khoá mở cho người ngoài trường, thanh toán khoá học, gợi ý ôn tập tự động, kiểm tra trùng lặp, chấm tự luận bằng AI thành điểm, nhận dạng chữ viết tay, ghi hình phòng nhóm tự học, LMS cho Mầm non.

### 20.9 Rủi ro và cách kiểm

| Rủi ro | Cách kiểm |
|---|---|
| Phạm vi LMS phình to, chậm bốn tính năng Eric cần | Lõi và nhóm trước; bốn tính năng chính xong ở đợt 2, bài về nhà ở đợt 3; danh sách "không làm", "để sau" ở 20.3, 20.8; phần mới qua YCTD |
| Lớp học trực tuyến tự sinh sai khi thời khoá biểu, phân công đổi giữa năm | Sinh lại theo bản thời khoá biểu đang áp dụng, đổi giáo viên giữ nội dung, không xóa lớp có dữ liệu; kiểm thử đổi bản, đổi giáo viên, nhóm tiết 21b |
| Trẻ bị bắt nạt, quấy rối, tiếp cận trong thảo luận, hỏi đáp, không gian hoặc phòng video nhóm | Giáo viên luôn thấy, không tin nhắn riêng, giờ mở, lọc liên lạc ngoài và từ ngữ, báo cáo và tạm khóa, ẩn vẫn lưu, nhật ký; kiểm thử không tạo được luồng hai học sinh, ngoài giờ không đăng được |
| Gói SCORM chứa mã độc hoặc đọc dữ liệu của ứng dụng | Tên miền con nội dung, khung `sandbox`, mã truy cập ngắn hạn, kiểm `postMessage`, chặn tệp và đường dẫn nguy hiểm, gói qua duyệt 22h1; kiểm thử gói mẫu cố đọc cookie và gọi `/api` thất bại |
| Lộ bài làm, ảnh, ghi âm, nhật ký học tập của trẻ cho người không có quyền hoặc trường khác | Tuyến `/student/*` chỉ trả dữ liệu của chính học sinh; tệp qua `storageKey`, đường dẫn ký ngắn hạn; xóa siêu dữ liệu ảnh; spec 211, 217 nhiều trường; ma trận cách ly |
| Điểm hoạt động lẫn vào điểm định kỳ, vào sổ khi chưa xác nhận, hoặc thành điểm số ở Tiểu học | Một cửa `ScoresService`, chỉ `regular`; Tiểu học chỉ gợi ý nhận xét, mức đạt; giáo viên chọn từng hoạt động và xác nhận; e2e thử ghi `mid` bị từ chối |
| Hiểu sai văn bản (CV 3977, quy định 2 buổi/ngày, văn bản sửa Thông tư 09 năm 2025 chưa đọc) | Quy tắc bài về nhà do trường tự đặt, có ô căn cứ, nền tảng không đặt mặc định (GD-143); bảng mẫu trong hướng dẫn ghi rõ "chưa xác minh"; 28b đọc lại văn bản sửa Thông tư 09 trước khi làm và ghi YCTD |
| Theo dõi tiến độ, nhật ký học tập bị coi là giám sát quá mức | Chỉ ghi sự kiện học tập cần cho Điều 8 Thông tư 09; không ghi vị trí, thiết bị, thời gian rời trang; thời hạn lưu; ghi vào hồ sơ đánh giá tác động (E-01) |
| Cập nhật khoá mẫu ghi đè nội dung giáo viên đã sửa ở lớp | Bản của lớp giữ `template_version`; nhận cập nhật là thao tác chủ động, so sánh khác biệt, không ghi đè phần đã sửa; kiểm thử |
| DT-27 bị chậm vì 27d, 27e chờ lõi LMS | 27a, 27b, 27c không phụ thuộc DT-28; mốc 1 của DT-27 (gia sư trong trường) không cần 27d, 27e; thứ tự đề xuất ở 20.6, Eric xác nhận (E-05) |
| Hai phần cùng đợt sửa chung tệp lõi (`learning/` lõi, `application.module.ts`, `portal-menu.ts`, `MULTI_TENANT_SPEC`, `online-exams/`, `scores/`, phân hệ AI) | Phân tệp ở 20.6; lõi chỉ 28b sửa, phần sau thêm thư mục con và dòng đăng ký cuối tệp; gộp `origin/main` trước khi mở PR |
| Va số với DT-24, DT-25 đang mở hoặc bổ sung của DT-23, DT-26, DT-27 | Dải bắt đầu sau các số đã thấy; va thì đánh lại theo nhánh chính lúc gộp |

**Cổng kiểm của mỗi phần DT-28:** kiểm thử đơn vị toàn kho đạt không sửa kỳ vọng; e2e `single` hiện có đạt cộng e2e mới của phần (giữ khóa `e2e.lock`); kiểm thử cách ly 14.7 ở cả hai bố cục `database` và `schema`; kiểm tĩnh đa thuê bao đạt; typecheck, lint, build đạt; CI xanh toàn bộ; phiên bản phần mềm tăng theo từng phần, riêng bản kế hoạch này (YCTD-270) chỉ đổi tài liệu.

### 20.10 Quy ước chung của DT-28

- Mỗi phần ghi YCTD giữ sẵn ở 20.6, cập nhật tài liệu theo quy ước của kho (02, 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, 23, 24, 32, 34, `index.md`), **đọc lại văn bản gốc liên quan trước khi làm** (28b, 28d: Thông tư 09/2021 và văn bản sửa đổi năm 2025; 28c, 28d: Thông tư 22/2021, Thông tư 27/2020 bản gốc; 28f: CV 3977, văn bản về học 2 buổi/ngày, Thông tư 15/2026 toàn văn; 28e, 28g: Luật Trẻ em, Luật 91/2025 Điều 24; 28h: đặc tả SCORM 1.2, SCORM 2004 bản 4 của ADL) và ghi số hiệu, ngày đọc vào YCTD.
- Kiểm thử và dữ liệu mẫu chỉ dùng người, lớp, khoá học bịa; gói SCORM mẫu tự soạn; AI, video, thông báo qua bộ giả lập; không in `.env`, không dán khóa.
- Tuyệt đối không chạy `migrate` lên cơ sở dữ liệu dùng chung; kiểm thử dùng cơ sở dữ liệu riêng của phiên.
- Thư viện mới (trình soạn nội dung, đọc zip, phát SCORM nếu dùng mã nguồn mở) chọn loại có giấy phép cho phép dùng thương mại, ghi tên, phiên bản, giấy phép vào YCTD.
- Điểm chi tiết không nêu ở đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của phần; giả định ở 20.13 làm cấu hình được, Eric chốt thì đổi giá trị bằng YCTD.

### 20.11 Tiến độ

| Phần | Đợt | Tiến độ |
|---|---|---|
| 28a | 1 | Đã làm (YCTD-271, phiên bản 0.149.0): bộ nhóm, cách chia, nhóm trưởng, 23b dùng bộ nhóm, `GroupSetsReader`, đích `group` cho đề 23a; năm học 0170, 0171; e2e 210. Còn nguồn kết quả hoạt động (chờ 28d) |
| 28b | 1 | Đã làm (YCTD-272, phiên bản 0.154.0, PR 193): lớp học trực tuyến tự sinh từ phân công, khoá tự chọn, khoá mẫu qua duyệt, chương, hoạt động trang, liên kết, học liệu, điều kiện mở, kết quả, tiến độ, kế hoạch tuần, nhật ký, quyết định thay thế, nội quy; hệ thống 0110, năm học 0172 đến 0175, định danh 0180; học sinh tự học ở kênh `student` sau khi 23a gộp; e2e 211 |
| 28c | 2 | Đã làm (YCTD-273, phiên bản đề xuất 0.157.0): loại hoạt động `assignment`, câu đã duyệt của 22g1 chấm bằng hàm 22g2, tự luận, ảnh, tệp, ghi âm, phiên bản, giao lớp, nhóm, học sinh, nộp muộn, số lần nộp, miễn, đóng bài, bài nhóm (nhóm trưởng nộp, đóng góp, điều chỉnh điểm), chấm tay, thang tiêu chí, mức, ngân hàng nhận xét, trả bài, trao đổi, gợi ý nhận xét AI không gửi bài làm (GD-142); năm học 0176 đến 0179, định danh 0181, hệ thống 0111 (loại yêu cầu AI `feedback`); e2e 212. Chưa làm: màn hình soạn phiên bản, đích nhóm, thang tiêu chí ở giao diện (đã có ở máy chủ) |
| 28d | 2 | Đã làm (YCTD-274, phiên bản đề xuất 0.160.0): tiến độ từng em và lớp, cần chú ý, bảng điểm hoạt động, đưa điểm thường xuyên vào sổ điểm (THCS, THPT, nguồn `activity`), gợi ý mức đạt môn và nhận xét Tiểu học ghi qua sổ nhận xét (GD-141), báo cáo chủ nhiệm, tổ, toàn trường, giáo viên, tóm tắt cho phụ huynh và tóm tắt hằng tuần, báo cáo tổng kết học kỳ và hồ sơ dạy học trực tuyến (Thông tư 09), `question_usages` của bài tập; năm học 0180, 0181; e2e 213. Chưa làm: độ phủ kế hoạch theo tuần ở báo cáo tổ, tóm tắt qua tin nhắn |
| 28e | 2 | Đã làm (YCTD-275, phiên bản đề xuất 0.162.0): thông báo lớp tới học sinh, phụ huynh, diễn đàn, hỏi đáp có câu hỏi riêng và xác nhận câu trả lời, không gian học nhóm (bảng tin, việc, ghi chú có phiên bản, tệp), lọc thông tin liên lạc, báo cáo vi phạm, hàng chờ của trường, tạm khóa quyền viết, giờ mở do trường đặt (GD-144 đã chốt 2026-10-28, mặc định không giới hạn), phụ huynh theo GD-145, lịch học tập; năm học 0182 đến 0184, định danh 0182; e2e 214. Chưa làm: ảnh trong câu hỏi, giờ học trực tuyến (28g) và bài về nhà (28f) trong lịch |
| 28f | 3 | Đã làm (YCTD-276, phiên bản đề xuất 0.164.0): giao bài về nhà từ tiết của sổ đầu bài (gắn tiết, nhóm, hạn đầu tiết kế tiếp), quy tắc khối lượng do trường tự đặt theo cấp, khối (GD-143, cảnh báo hoặc chặn, Ban Giám hiệu cho vượt có lý do), lịch khối lượng 7 ngày của lớp, phụ huynh xem bài của con, đã xem cùng con, nộp thay khi con chưa có tài khoản, trao đổi trên bài, nhắc bốn loại có giờ yên lặng và gộp bài, gợi ý gia hạn, miễn khi vắng có phép; năm học 0185, 0186; e2e 215. Chưa làm: bài về nhà tách riêng trong lịch học tập, gắn học liệu ngay khi giao từ sổ đầu bài |
| 28g | 3 | Đã làm (YCTD-277, phiên bản đề xuất 0.172.0; GD-144 Eric đã chốt 2026-10-28: trường tự cấu hình): loại hoạt động `live_session` mở phòng của 27a (bộ giả lập khi kiểm thử), điểm danh gợi ý từ nhật ký phòng, giáo viên xác nhận; phòng chia nhỏ theo bộ nhóm hoặc ngẫu nhiên (lưu bộ `classroom`), thông báo, chuyển học sinh, gọi giáo viên, gọi về; phòng nhóm học sinh tự mở khi giáo viên bật và trong giờ mở, "giáo viên đang xem" luôn hiện, báo cáo vào hàng chờ 28e; không ghi hình; năm học 0187, 0188; e2e 220. Chưa làm: ghi hình giờ học (GD-131), gợi ý theo tiết của thời khoá biểu |
| 28h | 3 | Đã làm (YCTD-278, phiên bản đề xuất 0.167.0): gói SCORM 1.2, 2004 là học liệu loại `scorm` của kho 22h1 (kiểm bản kê, đường dẫn, loại tệp, cỡ; qua duyệt), phát cô lập (CSP sandbox, mã truy cập HMAC ngắn hạn theo trường, học sinh, hoạt động; nguồn gốc nội dung riêng cấu hình được), bộ chuyển API qua postMessage ghi kết quả hoạt động, nhiều SCO chạy tuần tự (GD-153); gói khoá học `school-management.course-package/1` xuất nhập khoá mẫu kèm học liệu, gói SCORM; hệ thống 0113, 0114, năm học 0189; e2e 217. Chưa làm: spec nhiều trường cho gói SCORM (mở rộng `MULTI_TENANT_SPEC`), cấu hình tên miền nội dung ở cổng biên |
| 28i | 4 | Đã làm (YCTD-279, phiên bản đề xuất 0.168.0): tắt mặc định, Ban Giám hiệu bật (GD-155); huy hiệu nội bộ tự động (hoàn thành chương, khoá, nộp đúng hạn 5 lần liên tiếp) và do giáo viên trao kèm lý do, chỉ em, phụ huynh, giáo viên thấy, không bảng xếp hạng; chứng nhận PDF cho khoá tự chọn đã hoàn thành theo mẫu của trường, mã kiểm tra, trang kiểm tra công khai chỉ họ tên viết tắt, thu hồi; năm học 0191, 0192; e2e 218. Chưa làm: tra chứng nhận năm học đã đóng, chứng nhận cho khoá của 27d, Open Badges |
| 28j | 4 | Đã làm (YCTD-280, phiên bản đề xuất 0.169.0; GD-148 Eric đã chốt 2026-10-27): tắt mặc định, Ban Giám hiệu bật; bản nháp, nội dung đã mở, thao tác chờ gửi của chính học sinh mã hoá trên máy tối đa 7 ngày, xoá khi nộp, đăng xuất, quá hạn; hàng đợi gửi lại có mã chống trùng; thời điểm bấm nộp trên máy; mô-đun riêng gỡ được; năm học 0193; e2e 219. Chưa làm: nộp thay ngoại tuyến của phụ huynh, gửi tệp từng phần |

Bản kế hoạch này là YCTD-270, chỉ đổi tài liệu (không tăng phiên bản phần mềm).

### 20.12 Việc Eric phải quyết hoặc làm

Không có việc cần tài khoản, thanh toán hay ký kết.

| Mã | Việc | Cần trước | Ghi chú |
|---|---|---|---|
| E-01 | Luật sư rà: theo dõi tiến độ, nhật ký học tập, quan sát không gian và phòng nhóm (câu hỏi PL-15, Nghị định 356/2025 Điều 21 khoản 5); LTI khi muốn bật | Đợt 2 lên trường thật; bật LTI | Có thể gộp với E-06 của DT-27 |
| E-02 | **Tuỳ chọn:** quy tắc bài về nhà do từng trường tự đối chiếu quy định và tự cấu hình (GD-143); nếu muốn, Eric hỏi Sở hoặc trường thử về văn bản đang áp dụng để hoàn thiện bảng mẫu trong hướng dẫn; xác nhận văn bản sửa Thông tư 09 năm 2025 | Không chặn phần nào | |
| E-03 | Chốt các giả định còn lại ở 20.13 nếu muốn khác | Khi làm từng phần | **Eric đã chốt 2026-10-26: GD-141, GD-142, GD-143, GD-145**; GD-151, GD-154 nên chốt trước đợt 2 |
| E-04 | Chọn một trường thử có tổ chuyên môn soạn một khoá mẫu thật và một lớp dùng thử | Điều kiện ra đợt 1, 2 | Dữ liệu thật chỉ ở môi trường của trường |
| E-05 | Xác nhận thứ tự mới với DT-27: 27d, 27e sau DT-28 đợt 2 | Trước khi giao DT-27 đợt 2 | 20.6 |

### 20.13 Giả định chưa chốt, làm cấu hình được

Số GD và RR của DT-28 bắt đầu từ GD-140 và RR-32 (DT-27 dùng GD-130 đến GD-138, RR-28 đến RR-31; DT-24, DT-25 đã gộp dùng GD-109 đến GD-115, RR-21 đến RR-23). Va thì đánh lại khi gộp.

| Mã | Mục chưa chốt | Giả định để làm | Cấu hình ở | Cần ai trả lời |
|---|---|---|---|---|
| GD-140 | Nguồn điểm khi chia nhóm theo năng lực, ai thấy mức | Điểm trung bình môn học kỳ gần nhất, mức đạt môn (Tiểu học) hoặc kết quả hoạt động gần nhất, giáo viên chọn; mức không lưu, không hiện cho học sinh, phụ huynh | Tham số bộ nhóm | Claude (theo ủy quyền) |
| GD-141 | Kết quả hoạt động vào sổ điểm, sổ nhận xét | **Eric chốt 2026-10-26: cho phép cả Tiểu học.** THCS, THPT: vào điểm thường xuyên (`regular`) qua `ScoresService`, không bao giờ giữa kỳ, cuối kỳ. Tiểu học: không ghi điểm số; kết quả hoạt động là căn cứ để máy gợi ý nhận xét thường xuyên và mức đạt môn, giáo viên xem, sửa, xác nhận. Công tắc theo trường **mặc định bật**; mỗi hoạt động mặc định không đưa vào sổ, giáo viên chọn từng hoạt động và xác nhận | `settings` của trường, theo hoạt động | Eric (đã chốt) |
| GD-142 | AI gợi ý nhận xét có được đọc bài làm | **Eric chốt 2026-10-26: không.** Chỉ gợi ý từ đề, thang tiêu chí, điểm hoặc mức giáo viên đã cho; không gửi bài làm, ảnh, ghi âm cho nhà cung cấp AI; không làm sẵn chế độ gửi bài làm | Mã 28c (quy tắc cố định) | Eric (đã chốt) |
| GD-143 | Quy tắc bài về nhà | **Eric chốt 2026-10-26: để trường tự cấu hình, nền tảng không đặt giới hạn mặc định.** Ban Giám hiệu đặt theo cấp, khối: số bài, số phút mỗi ngày, ngày không giao, chặn hay cảnh báo, căn cứ; bảng mẫu gợi ý chỉ ở hướng dẫn sử dụng, không bật sẵn; chưa đặt thì không chặn, không cảnh báo | `homework_policies` của trường | Eric (đã chốt) |
| GD-144 | Giờ mở thảo luận, không gian và phòng nhóm | **Eric đã chốt 2026-10-28 ("Trường tự cấu hình"):** mặc định không giới hạn giờ; mỗi trường tự đặt khung giờ mở thảo luận và phòng học nhóm, ngoài giờ chỉ đọc; phòng video học sinh tự mở chỉ khi giáo viên bật | Cấu hình trường, theo bộ nhóm | Eric (đã chốt) |
| GD-145 | Phụ huynh xem không gian nhóm của con | **Eric chốt 2026-10-26 theo đề xuất:** Tiểu học đọc toàn bộ (chỉ đọc); THCS, THPT thấy việc, hạn, bài nộp, không đọc thảo luận trừ khi có báo cáo liên quan con | Theo cấp | Eric (đã chốt) |
| GD-146 | Thời hạn lưu dữ liệu học tập (Thông tư 09 Điều 8 khoản 2 để trường quy định) | Kết quả, kế hoạch, báo cáo học kỳ theo PL-13 của trường; nhật ký học tập, bài nộp, thảo luận: hết năm học cộng 12 tháng | Cấu hình trường | Eric |
| GD-147 | Nộp muộn mặc định | Cho nộp đến khi giáo viên đóng, đánh dấu muộn, không tự trừ điểm | Theo bài | Claude (theo ủy quyền) |
| GD-148 | Bản nháp ngoại tuyến của học sinh (mở rộng GD-108) | **Eric đã chốt 2026-10-27 ("Đồng ý đề xuất"):** tắt mặc định, trường tự bật; cho phép ở màn hình học tập của học sinh; lưu trên máy tối đa 7 ngày; xóa khi nộp, đăng xuất | Cấu hình trường | Eric (đã chốt) |
| GD-149 | Giáo viên quan sát phòng nhóm có hiện cho học sinh | Luôn hiện | Cố định | Eric |
| GD-150 | Giới hạn tệp mỗi bài nộp, mỗi gói SCORM | Tối đa 10 ảnh, tổng 20 MB, ghi âm 5 phút, tài liệu 10 MB; gói SCORM 200 MB | Cấu hình trường, theo gói | Claude (theo ủy quyền) |
| GD-151 | Nội dung nào của giáo viên cần duyệt theo Thông tư 09 Điều 7 khoản 3 | Khoá học mẫu, học liệu, gói SCORM qua duyệt 22h1; trang nội dung ngắn, hướng dẫn, thông báo, câu hỏi thảo luận của chính giáo viên không cần duyệt; trường bật được "mọi trang nội dung phải duyệt" | Cấu hình trường | Eric (trường thử xác nhận) |
| GD-152 | LTI 1.3 | Để sau; chỉ làm khi có nhà cung cấp cụ thể, thỏa thuận xử lý dữ liệu và luật sư rà | — | Eric |
| GD-153 | SCORM 2004 trình tự và điều hướng | Không làm; gói nhiều SCO chạy tuần tự | Mã 28h | Claude (theo ủy quyền) |
| GD-154 | Lớp học trực tuyến tự sinh có hiện ngay cho học sinh | Ẩn đến khi giáo viên mở lớp hoặc thêm hoạt động đầu tiên | Cấu hình trường | Eric |
| GD-155 | Huy hiệu, chứng nhận | Tắt mặc định; không bảng xếp hạng; chứng nhận chỉ cho khoá tự chọn | Cấu hình trường | Eric |
| GD-156 | Ghi danh khoá tự chọn | Học sinh đăng ký, người phụ trách duyệt; Tiểu học cần phụ huynh xác nhận trên ứng dụng phụ huynh; khoá có thu tiền không làm ở DT-28 (thuộc 27b, 27c) | Theo khoá | Eric |
| GD-157 | Xuất lịch học tập ra lịch ngoài (iCal) | Không làm (đường dẫn lịch chứa dữ liệu trẻ em) | — | Claude (theo ủy quyền) |
