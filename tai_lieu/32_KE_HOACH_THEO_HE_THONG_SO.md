# 32. KẾ HOẠCH ĐỒNG BỘ CHỨC NĂNG VÀ GIAO DIỆN THEO HỆ THỐNG CỦA SỞ (DT-15)

- Mô tả: Kế hoạch điều chỉnh School Management theo kết quả khảo sát `31_KHAO_SAT_HE_THONG_SO.md`; từ mục 9 thêm kế hoạch DT-18 điều hành nhà trường.
- Phiên bản: 1.22
- Ngày cập nhật: 2026-10-20
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
| 18c | 2 | Chưa làm, chờ 18a |
| 18e | 3 | Chưa làm, chờ đợt 2 |
| 18g | 3 | Chưa làm |
| 18f | 4 | Chưa làm, chờ 18b |
| 18h | 4 | Chưa làm |
| 22b | 5 | Chưa làm |
| 22i | 5 | Chưa làm, chờ 18e |
| 22d | 5 | Chưa làm, chờ 18d, 18e |
| 22f | 5 | Chưa làm, chờ 18e |
