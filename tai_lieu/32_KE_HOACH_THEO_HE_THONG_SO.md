# 32. KẾ HOẠCH ĐỒNG BỘ CHỨC NĂNG VÀ GIAO DIỆN THEO HỆ THỐNG CỦA SỞ (DT-15)

- Mô tả: Kế hoạch điều chỉnh School Management theo kết quả khảo sát `31_KHAO_SAT_HE_THONG_SO.md`; từ mục 9 thêm kế hoạch DT-18 điều hành nhà trường, mục 10 thêm kế hoạch DT-19 nền đa cấp học, mục 11 thêm kế hoạch DT-20 Tiểu học (kèm 22c thời khoá biểu), mục 12 thêm kế hoạch DT-21 THCS và THPT (kèm 22g kiểm tra, đánh giá), mục 13 thêm kế hoạch DT-22 (22a thư viện, 22e hồ sơ bồi dưỡng, 22h kho học liệu số), mục 14 thêm kế hoạch DT-SaaS (Enterprise SaaS nhiều trường: S1a, S1b, S2, S3, S4, S5a, S5b, S6, S7a, S7b, S8a, S8b, S9; hai hồ sơ triển khai: thử nghiệm miễn phí và vận hành).
- Phiên bản: 1.65
- Ngày cập nhật: 2026-10-25
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
- **AI là thành phần riêng, tắt mặc định:** chỉ gợi ý, người dùng duyệt trước khi ghi; chỉ dùng dữ liệu đã khử định danh; không gửi dữ liệu trẻ em ra dịch vụ ngoài. Các phần chạy đủ khi AI tắt.
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
   - **AI là thành phần riêng, mặc định tắt**: chỉ gợi ý, có người duyệt, dùng dữ liệu đã khử định danh, không gửi dữ liệu trẻ em ra dịch vụ ngoài. Ba phần của DT-22 **không gọi AI**; chỗ AI có thể gợi ý sau này (gắn thẻ và chủ đề cho học liệu, soạn câu hỏi nháp, gợi ý nội dung bồi dưỡng) chỉ để sẵn điểm nối, không làm trong DT-22 (13.5).
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

Giữ chỗ chưa giao phiên: **YCTD-185** cho thành phần AI riêng (13.5), migration năm học 0104, hệ thống 0043, định danh 0094, e2e `124-`; YCTD-186 đến YCTD-189, năm học 0105 đến 0109, hệ thống 0044 đến 0049, định danh 0095 đến 0099, e2e `125-` đến `129-` dự phòng cho bổ sung của DT-22. Khi thành phần AI được giao phiên thì ghi bản kế hoạch riêng, không sửa mục này.

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
- **Không dùng AI trong DT-22**; điểm nối để sẵn: danh mục chủ đề, thẻ và từ khoá của học liệu (22h1) và danh sách khoảng trống năng lực (22e) là dữ liệu đã khử định danh có thể làm đầu vào cho gợi ý sau này; không thêm cột hay bảng riêng cho AI. Khi Eric cho làm thành phần AI (YCTD-185): bản kế hoạch riêng, tắt mặc định, chỉ gợi ý, người duyệt, chỉ dữ liệu đã khử định danh.
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
- **Dịch vụ định danh theo trường:** mỗi trường một cơ sở dữ liệu định danh; mã phiên mang `sid` (mã trường), máy chủ API và dịch vụ định danh từ chối mã phiên khác trường với 401; cặp khóa ký **dùng chung của nền tảng** (khóa công khai phát cho `api`); cookie mã làm mới gắn mã trường (cookie của trường khác bị từ chối kể cả khi bị đặt từ tên miền anh em); khóa giới hạn đăng nhập gồm mã trường.
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
- **Lưu ở đâu:** nền tảng 0090 đến 0099 (`admin_units`, `parent_org_users`, `school_aggregate_consents`, `aggregate_snapshots`); định danh 0103 nếu cần; hệ thống của trường: cấu hình đồng ý ở hệ thống 0055 (dự phòng).

### 14.6 Quyết định thiết kế và phương án đã loại

Các lựa chọn dưới đây do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, trừ các quyết định của Eric ở 14.1.

- **Mô hình A (Eric chốt), loại B và C:** B (dùng chung cơ sở dữ liệu, thêm cột `tenant_id`, hoặc bảo vệ ở mức dòng) loại vì phải sửa và kiểm thử mọi truy vấn, sót một chỗ là lộ dữ liệu trẻ giữa các trường, lại mâu thuẫn với cơ sở dữ liệu theo năm học. C (mỗi trường một bản triển khai riêng) vẫn dùng được cho khách lớn muốn máy riêng: cùng mã nguồn, chỉ khác nơi đặt, chạy ở chế độ một trường; không phải việc của DT-SaaS.
- **Tên miền con theo mã trường là mặc định; tên miền riêng cấu hình tay (Eric chốt):** loại "đường dẫn `/<mã trường>` trên một tên miền" vì cookie, bộ nhớ trình duyệt và chứng chỉ chung cho mọi trường (một trường lỗi chạy mã giao diện có thể đọc dữ liệu cục bộ của trường kia). Tên miền con tách nguồn gốc (origin) từng trường.
- **Ba ứng dụng chung một tên miền theo tiền tố đường dẫn** (`/quan-ly`, `/giao-vien`, `/phu-huynh`, gốc là website): giữ mọi thứ của một trường ở một tên miền, một chứng chỉ, cookie không cần `Domain`, không gọi chéo tên miền (khớp quy ước 8 của tài liệu 17). Phải đặt đường dẫn gốc (`base`) cho ba ứng dụng web và chỉnh Caddy; ghi vào S1b. Phương án loại: mỗi ứng dụng một tên miền con (`quan-ly-<mã>.…`) vì nhân số tên miền, chứng chỉ và hướng dẫn CNAME lên gấp ba.
- **Cặp khóa ký mã phiên dùng chung của nền tảng, mã trường (`sid`) bắt buộc khớp:** đơn giản cho `api` (một khóa công khai), xoay khóa một nơi. Phương án loại: mỗi trường một cặp khóa (cách ly mạnh hơn khi lộ khóa, nhưng nhân việc phát khóa và xoay khóa; có thể thêm sau vì mã phiên đã có `sid`). Rủi ro lộ khóa ký ghi ở 14.8.
- **Một vai trò PostgreSQL mỗi trường:** hàng rào thứ hai ngoài mã; một lỗi trong ứng dụng cũng không đọc được cơ sở dữ liệu trường khác. Phải xử lý PgBouncer xác thực theo vai trò (danh sách xác thực sinh từ `platform`). Phương án loại: một vai trò chung cho mọi trường (đơn giản nhưng bỏ hàng rào).
- **Ngữ cảnh trường qua `AsyncLocalStorage`, giữ chữ ký `Databases`, `cacheKey`, `storageKey`:** không phải sửa hàng trăm chỗ gọi; nhược điểm là việc nền phải tự bọc ngữ cảnh, nên **đóng chặt** (lỗi khi thiếu) và có kiểm tĩnh. Phương án loại: truyền `school` làm tham số khắp nơi (sửa quá lớn, dễ sót).
- **Một tiến trình `api` phục vụ mọi trường, không một tiến trình mỗi trường:** gom kết nối bằng nhóm có giới hạn và PgBouncer; mở rộng bằng thêm bản `api`. Phương án loại: một vùng chứa mỗi trường (tốn bộ nhớ, cập nhật phải lặp).
- **Bản triển khai hiện có thành trường số 1, không chuyển dữ liệu:** lệnh nhận bản đang chạy chỉ ghi `platform` và dùng lại cơ sở dữ liệu cũ, khóa tên cũ (tiền tố trống). Phương án loại: đổi tên và chép cơ sở dữ liệu (rủi ro, thời gian dừng).
- **Chế độ một trường là mặc định:** mọi bản triển khai hiện nay và e2e hiện có chạy không đổi; kiểm thử nhiều trường là bộ riêng (14.7).
- **Tài khoản không gộp giữa các trường:** một người dạy hai trường có hai tài khoản, đăng nhập ở hai tên miền; không có danh tính chung (làm thế phải có kho tài khoản chung, trái mô hình A và nguyên tắc tách dữ liệu). Trang chọn trường chỉ chuyển hướng. Tài khoản chuyên viên Phòng, Sở nằm ở S6.
- **Ứng dụng di động:** hiện chỉ có ứng dụng web; "nhập mã trường hoặc quét QR" của bản nháp chỉ làm ở trang chọn trường và mã QR của đường dẫn trường (in được ở S2); vỏ ứng dụng di động gốc nằm ngoài DT-SaaS.
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
- **Không làm ở DT-SaaS:** mô hình dùng chung cơ sở dữ liệu; danh tính chung nhiều trường; ứng dụng di động gốc; thị trường học liệu liên trường thật (22h2 chỉ có gói tệp, danh mục chung liên trường là việc sau DT-SaaS, thêm bằng YCTD riêng); tự động mở rộng máy chủ, dịch vụ đám mây quản lý (Eric chọn VPS trong nước); thành phần AI (YCTD-185 của DT-22 vẫn giữ chỗ).

### 14.7 Kiểm thử cách ly dữ liệu giữa các trường

Nguyên tắc: **cách ly là điều phải chứng minh bằng kiểm thử tự động, ở nhiều lớp, và phần nào làm yếu đi thì CI đỏ.** Bộ kiểm thử đặt ở `tests/tenancy/` và các spec `130-` đến `139-`, S1a dựng khung.

**Dữ liệu mồi (canary).** Mỗi trường giả (`alpha`, `beta`, `gamma`) được nạp một bộ dữ liệu có **chuỗi nhận dạng riêng** (ví dụ `CANARY-ALPHA-…`) ở mọi loại nơi lưu: tên học sinh, phụ huynh, nhân viên; tệp ở kho tệp; thông báo ở hàng đợi; khóa trong Redis; tác vụ xuất nền; nhật ký kiểm toán; cấu hình tích hợp (bộ nối giả lập có dấu riêng từng trường); tên miền. Kiểm thử khẳng định chuỗi của trường này **không bao giờ** xuất hiện ở nơi của trường khác.

Các lớp kiểm thử:

1. **Đơn vị:** bộ phân giải trường (tên miền lạ, tên miền ở trạng thái chưa xác nhận, `Host` giả, `X-Forwarded-Host` khi không tin proxy); `Databases` không bao giờ trả kết nối của trường khác và lỗi khi thiếu ngữ cảnh ở chế độ nhiều trường; `cacheKey`, `storageKey` luôn có tiền tố; nhóm kết nối tôn trọng giới hạn và đóng đúng; mã phiên khác `sid` bị từ chối.
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
| Lộ khóa ký mã phiên dùng chung làm giả được phiên của mọi trường | Khóa ký chỉ ở dịch vụ định danh, API chỉ giữ khóa công khai; `sid` bắt buộc; xoay khóa có quy trình (S8b); có thể chuyển sang khóa riêng từng trường vì mã phiên đã có `sid` |
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
| S1a | 1 | Chưa làm, YCTD-191 |
| S7a | 1 | Chưa làm, YCTD-198 |
| S8a | 1 | Đã làm, YCTD-200, PR 162: bộ mẫu `33_HO_SO_PHAP_LY/` (PL-00 đến PL-15, S8a-1.0, bản nháp chờ luật sư rà); không tăng phiên bản phần mềm |
| S1b | 2 | Chưa làm, YCTD-192; bắt đầu khi S1a gộp |
| S2 | 2 | Chưa làm, YCTD-193; bắt đầu khi S1a gộp, gộp sau S1b |
| S9 | 3 | Chưa làm, YCTD-203; bắt đầu khi S1a, S1b, S2 gộp, giao đầu tiên của đợt 3 |
| S5a | 2 | Chưa làm, YCTD-194; bắt đầu khi S1a gộp |
| S3 | 3 | Chưa làm, YCTD-195; bắt đầu khi S1b, S2 gộp |
| S5b | 4 | Chưa làm, YCTD-196; bắt đầu khi S5a, S3, S1b gộp |
| S4 | 3 | Chưa làm, YCTD-197; bắt đầu khi S2, S5a gộp |
| S7b | 4 | Chưa làm, YCTD-199; bắt đầu khi S1b, S2, S7a gộp |
| S8b | 4 | Chưa làm, YCTD-201; bắt đầu khi S1a, S2, S3 gộp |
| S6 | 5 | Chưa làm, YCTD-202; **đợt 5, Eric đã duyệt ngày 2026-10-25**; bắt đầu khi S1a, S4, S8b gộp |

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
