# 32. KẾ HOẠCH ĐỒNG BỘ CHỨC NĂNG VÀ GIAO DIỆN THEO HỆ THỐNG CỦA SỞ (DT-15)

- Mô tả: Kế hoạch điều chỉnh School Management theo kết quả khảo sát `31_KHAO_SAT_HE_THONG_SO.md`.
- Phiên bản: 1.10
- Ngày cập nhật: 2026-10-18
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
| 15b | Đã triển khai (YCTD-111): 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường, 2.1 Hồ sơ lớp học, 2.2 Nhập lớp học từ Excel, 3.3 Phân công phụ trách lớp; 1.1, 1.4 chỉ đổi tiêu đề, 1.4 chưa có ba ô của Sở; 1.6 đến 1.8 không làm theo mục 1 |
| 15c | Đã triển khai (YCTD-108) |
| 15d | Đã triển khai (YCTD-112): 3.1.1 Hồ sơ cán bộ, giáo viên (lưới theo cột của Sở, Xuất Excel, hồ sơ hai thẻ, biểu mẫu Thêm mới theo khối), 3.1.4 gộp vào Mở rộng tìm kiếm của 3.1.1 (chưa có lọc xã ĐBKK); 5.9 đã có từ DT-14a; chưa tách 3.1.2, 3.1.3, 3.1.5, 3.5 |
| 15e | Đã triển khai (YCTD-109) |
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
| 16e | Trường, lớp, lịch: 1.4, 1.7 Rà soát thông tin kiểm định CLGD, 1.8 Tách trường (nội bộ), 2.1, 2.2, 3.3, 3.4 Khai báo tuần, 5.7 | 2 | Chưa làm |
| 16f | Nhân sự: 3.1.1 đủ nút, 3.1.2, 3.1.3, 3.1.4 lọc xã ĐBKK, 3.1.5 (nội bộ), 3.2 nhập Excel, 3.5 Biến động nhân sự (nội bộ), 5.2, 5.6, 5.9 | 2 | Đã triển khai (YCTD-124): 3.1.1 Thay đổi, Xóa hồ sơ nhập nhầm, Xuất tệp theo mẫu Bộ 75 cột kèm kiểm tra dữ liệu, Xuất file lỗi, lọc xã ĐBKK (đánh dấu theo nhân sự), trạng thái xác thực, danh mục của Bộ, tài khoản ngân hàng, mã số thuế; 3.1.2 Nhân sự phân hiệu (gán tay, lấy theo phân hiệu giảng dạy); 3.1.3 Nhập nhân sự từ Excel (mẫu 75 cột kèm dữ liệu, tra cứu danh mục); 3.1.5 Đánh dấu đã xác thực, sai thông tin (bản chạy nội bộ); 3.2 Nhập mức đánh giá từ Excel; 3.5 Biến động nhân sự bốn thẻ (bản chạy nội bộ, hồ sơ chuyển trao bằng tệp 75 cột); 5.2 Thống kê nhân sự theo danh mục Bộ và chuẩn nghề nghiệp; 5.6 Tiến độ xác thực, trùng số định danh; 5.9 thêm tài khoản ngân hàng, mã số thuế; chưa có kết nối CSDL Bộ, CSDLQG, liên thông giữa các trường; 5.1 giữ thẻ nhân sự cũ |
| 16g | Học sinh: 4.1.1 đủ nút, 4.1.2, 4.1.3, 4.1.5, 4.1.8–4.1.10 (nội bộ), 4.1.11 nhập danh sách, 4.2 đủ thao tác, 5.4, 5.5 | 2 | Chưa làm |
| 16h | Sức khỏe, dinh dưỡng, thống kê: 4.5, 4.6, 5.3, báo cáo sức khỏe đầu năm | 2 | Đã triển khai (YCTD-125): 4.6.1 Nhập thông tin sức khỏe học sinh theo học kỳ (giáo dục thể chất, cân nặng, chiều cao, biết bơi, bệnh về mắt, lấy dữ liệu từ 4.3); 4.3.2 tổng hợp theo học kỳ, so sánh hai lần cân đo, cột được khám định kỳ; 4.5 thực đơn có tên, tháng, tuần, từ ngày–đến ngày, khối áp dụng, nhập từ Excel bằng công cụ nhập chung; 5.3 Thống kê học sinh đủ sáu phần; số liệu báo cáo sức khỏe đầu năm (dòng 1.3) có điểm cuối riêng, màn hình và gửi lên cấp trên ở phần 16j; thực đơn vẫn theo tuần, chỉ tiêu 1.3 chưa đối chiếu biểu mẫu chính thức |
| 16i | Cơ sở vật chất: 1.1 nhập Excel, 1.2 Báo cáo cơ sở vật chất, 2.2, 2.3 (nội bộ), 6.1 Thực trạng và nhu cầu đầu tư | 3 | Chưa làm |
| 16j | Báo cáo số liệu (EMIS): 1.1 thẻ ngân sách, 1.2, 1.3, 2.1–2.4, gửi báo cáo (nội bộ) | 3 | Chưa làm |
| 16k | Phân hệ Quản lý kí hồ sơ (nội bộ): chứng thư số nhà trường, ảnh con dấu, tạo hồ sơ PDF, xác nhận hoàn thành, khóa hồ sơ | 3 | Chưa làm |

Lượt 2 bắt đầu khi phần 16a đã gộp và dùng lại công cụ của phần này; lượt 3 bắt đầu khi lượt 2 đã gộp. Mỗi phần ghi YCTD, chạy đủ kiểm thử đơn vị và e2e, mở PR, gộp khi mọi kiểm tra CI đạt; các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và ghi vào YCTD của từng phần.
