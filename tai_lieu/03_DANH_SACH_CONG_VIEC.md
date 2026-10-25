# 03. DANH SÁCH KIỂM TRA CÔNG VIỆC

- Mô tả: Danh sách công việc, trạng thái và thứ tự ưu tiên của dự án.
- Phiên bản: 0.72
- Ngày cập nhật: 2026-10-25
- Trạng thái: Đang cập nhật

## Quy ước trạng thái

Chỉ dùng năm trạng thái: Chưa bắt đầu, Đang thực hiện, Cần sửa, Bị chặn, Hoàn thành. Việc chờ tài khoản hoặc hạ tầng bên ngoài ghi Bị chặn kèm lý do. Hệ thống lớn làm theo đợt riêng ghi rõ ở cột ghi chú.

## 1. Tiến độ theo phân hệ

| Phân hệ | Trạng thái | Việc còn lại |
|---|---|---|
| P01 Nền tảng, đơn vị và phân quyền | Hoàn thành | Đợt DT-01 (YCTD-34 đến YCTD-42); DT-16 phần 16k (YCTD-130: phân hệ Quản lý kí hồ sơ, bản chạy nội bộ); DT-17 phần 17b (YCTD-133: kí hồ sơ theo bốn mẫu của Sở, tệp XML, nhà phát hành theo danh sách); kết nối ngoài ở DT-11 phần 11e; DT-14 phần 14d (YCTD-106: hồ sơ trường); DT-15 phần 15e (YCTD-109: quản trị hệ thống theo Sở: 1.1 Nhóm người dùng, 1.3 Phân quyền nhóm theo menu, 1.4 Danh sách người dùng, lưới dữ liệu chung cho Khóa API và Nhật ký thao tác); DT-15 phần 15g (YCTD-110: Gửi phản hồi ở chân trang, Danh sách ý kiến đã gửi, 3.4 Ý kiến phản hồi, hết hạn mật khẩu); DT-15 phần 15b (YCTD-111: 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường, 2.2 Nhập lớp học từ Excel); DT-16 phần 16b (YCTD-119: Xuất Excel 1.1, 1.2, 1.3; 2.1 đến 2.5, 3.2 Quản trị hệ thống theo lưới dữ liệu chung); DT-16 phần 16d (YCTD-120: quản trị hệ thống đủ theo Sở: 1.2, 1.6, 1.4 đủ cột, thao tác); DT-16 phần 16c (YCTD-123: thanh đầu trang, menu người dùng, hộp thông báo khi vào trang, mã xác nhận, quên mật khẩu, lịch sử mật khẩu, 3.6 Thông báo hệ thống, 3.7 Ứng dụng liên kết); DT-16 phần 16e (YCTD-127: 1.4 khối Cấu hình trường, 1.7 Rà soát thông tin kiểm định CLGD, 1.8 Tách trường (nội bộ), 2.2 nhập lớp đủ cột của Sở, 3.4 Khai báo tuần, 5.7 Chuyển hồ sơ lên năm học mới có Hủy); DT-17 phần 17e (YCTD-136: 1.7 Rà soát thông tin kiểm định CLGD đủ ô như Sở, hồ sơ trường thêm ô chuẩn quốc gia, kiểm định CLGD, diện tích sàn xây dựng); tách trường chưa nối hệ thống của Sở; DT-18 phần 18h (YCTD-145: đăng nhập thay, gói ZIP toàn bộ dữ liệu, bản trình diễn); DT-19 phần 19a (YCTD-151: cấp học của trường, phạm vi cấp của người dùng); DT-19 phần 19c (YCTD-153: menu và phân hệ theo cấp học, chọn cấp đang làm việc); DT-19 phần 19e (YCTD-155: ứng dụng phụ huynh, giáo viên theo cấp, tin tức có cấp nhận) |
| P02 Trẻ, phụ huynh và lớp học | Hoàn thành | Đợt DT-03 (YCTD-44 đến YCTD-46), DT-09 phần 9b, 9d, DT-14 phần 14c (YCTD-104: hoàn thành chương trình, nhóm học sinh), DT-15 phần 15c (YCTD-108: Quản lý hồ sơ học sinh theo Sở, điện thoại nhận tin, học 2 buổi/ngày và bán trú, biến động học sinh), DT-15 phần 15b (YCTD-111: 2.1 Hồ sơ lớp học theo Sở, 3.3 Phân công phụ trách lớp); kết nối tự động cơ sở dữ liệu ngành (G3-09) chưa có giao diện lập trình công khai, tiếp tục nhập từ tệp, DT-15 phần 15h1 (YCTD-116: 4.1.11 Cập nhật địa danh hành chính); DT-16 phần 16g (YCTD-126: học sinh đủ theo Sở, P02-18 đến P02-23), DT-16 phần 16e (YCTD-127: 2.1 chọn nhiều lớp, thay đổi hàng loạt, giải thể lớp đã chọn, xóa lớp; 3.3 giáo viên chưa phân công, lọc tình trạng phân công); DT-17 phần 17c (YCTD-134: phân hệ Tuyển sinh đầu cấp phần 1, bản chạy nội bộ: 1.1 hồ sơ học sinh cuối cấp, màn hình Hồ sơ cuối cấp của ứng dụng phụ huynh, 1.2, 1.8, 2.1, 3.1 đến 3.4, 4.1, 5.1; chưa nối phân tuyến của Sở, 1.3 đến 1.7 ở phần 17d); DT-17 phần 17d (YCTD-135: phân hệ Tuyển sinh đầu cấp phần 2, bản chạy nội bộ: 1.3 đến 1.7, 5.11 của phân hệ Mầm non; danh sách phân tuyến nhập từ Excel, chưa nối phân tuyến của Sở); DT-20 phần 20a (YCTD-158: môn học, số tiết theo khối, phân công giảng dạy theo môn); DT-20 phần 22c1 (YCTD-160: thời khoá biểu phần khung); DT-20 phần 20d (YCTD-162: sổ đầu bài, điểm danh theo tiết); DT-20 phần 22c2 (YCTD-164: máy xếp thời khoá biểu, dạy thay, đổi tiết, báo cáo, mã QR); DT-21 phần 22g1 (YCTD-168: kiểm tra, đánh giá phần đề); DT-21 phần 22g2 (YCTD-173: kiểm tra, đánh giá phần chấm) |
| P03 Giảng dạy | Hoàn thành | Đợt DT-10 phần 10g (YCTD-80), DT-15 phần 15f3 (YCTD-115: lưới và biểu mẫu chung cho giáo án chờ duyệt, bài học, lĩnh vực, nhóm, chủ đề, kế hoạch giảng dạy); tổ chuyên môn chưa làm |
| P04 Điểm danh và chăm sóc hằng ngày | Hoàn thành | Đợt DT-04 (YCTD-47, YCTD-48), DT-08 phần 8b |
| P05 Học phí, khoản thu và giảm trừ | Hoàn thành | Đợt DT-05 (YCTD-49 đến YCTD-57), DT-15 phần 15f1 (YCTD-114: giao diện chung của Sở cho biểu phí, đăng ký dịch vụ, học phí, miễn giảm, công nợ, nhắc nợ); cổng thanh toán thật chờ việc T1 |
| P06 Tài chính | Hoàn thành | Đợt DT-05 phần 5d đến 5f, DT-10 phần 10i, DT-11 phần 11c, 11d (YCTD-88, YCTD-89), DT-15 phần 15f1 (YCTD-114: lưới và biểu mẫu chung cho phiếu thu, phiếu chi, quỹ, nợ nhà cung cấp, khoản mục, sổ kế toán, chốt kỳ) |
| P07 Nhân sự | Hoàn thành | Đợt DT-06 phần 6a (YCTD-58), DT-10 phần 10h, DT-14 phần 14c (YCTD-104: đánh giá chuẩn nghề nghiệp), DT-15 phần 15d (YCTD-112: 3.1.1 Hồ sơ cán bộ, giáo viên theo Sở, mở rộng tìm kiếm 3.1.4, xuất Excel, hồ sơ hai thẻ); DT-16 phần 16f (YCTD-124: 3.1.1 Thay đổi, Xóa, Xuất tệp theo mẫu Bộ, Xuất file lỗi, danh mục của Bộ; 3.1.2 Nhân sự phân hiệu; 3.1.3 Nhập nhân sự từ Excel; 3.1.5 Xác thực số định danh (nội bộ); 3.2 nhập mức đánh giá từ Excel; 3.5 Biến động nhân sự (nội bộ); 5.2, 5.6, 5.9); chưa có kết nối thật tới CSDL Bộ, CSDLQG về dân cư |
| P08 Chấm công và tiền lương | Hoàn thành | Đợt DT-06 phần 6b, 6c (YCTD-59 đến YCTD-61), DT-15 phần 15f2 (YCTD-113: giao diện chung của Sở cho chấm công, nghỉ phép, lịch công tác, lương, quyết toán) |
| P09 Công việc, kế hoạch và đánh giá | Hoàn thành | Đợt DT-10 phần 10h (YCTD-81), DT-15 phần 15f2 (YCTD-113: lưới và biểu mẫu chung cho công việc, kế hoạch, đánh giá nhân sự), DT-15 phần 15h2 (YCTD-118: 5.10 Văn thư lưu trữ theo Sở), DT-18 phần 18a (YCTD-138: văn bản đến theo VNPT iOffice, phân hệ Quản lý văn bản và điều hành), DT-18 phần 18b (YCTD-140: văn bản đi theo VNPT iOffice), DT-18 phần 18e (YCTD-142: hồ sơ chuyên môn, đợt nộp, luồng duyệt, Việc của tôi); DT-18 phần 22i (YCTD-147: kế hoạch giáo dục); DT-18 phần 22d (YCTD-148: thi đua, khen thưởng); DT-18 phần 22f (YCTD-149: bảo đảm chất lượng, tự đánh giá, phân hệ Bảo đảm chất lượng); DT-22 phần 22e (YCTD-182: hồ sơ bồi dưỡng giáo viên); DT-22 phần 22h1 (YCTD-183: kho học liệu số, phần lõi); DT-22 phần 22h2 (YCTD-184: kho học liệu, câu hỏi và chia sẻ) |
| P10 Y tế học đường | Hoàn thành | Đợt DT-10 phần 10a, 10b (YCTD-74, YCTD-75), DT-14 phần 14a (YCTD-105: đợt cân đo, kênh tăng trưởng theo chuẩn WHO, tổng hợp cân nặng, chiều cao); DT-16 phần 16h (YCTD-125: 4.6.1 Nhập thông tin sức khỏe học sinh theo học kỳ, lấy số đo từ 4.3; 4.3.2 tổng hợp theo học kỳ, so sánh hai lần cân đo, được khám định kỳ) |
| P11 Xe đưa đón | Đã bỏ | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| P12 Bếp và dinh dưỡng | Hoàn thành | Đợt DT-10 phần 10c (YCTD-76); DT-16 phần 16h (YCTD-125: 4.5 thực đơn có tên, tháng, tuần, từ ngày, đến ngày, khối áp dụng, nhập thực đơn từ Excel); DT-18 phần 22b (YCTD-146: lô hàng, hồ sơ an toàn thực phẩm của nhà cung cấp, kiểm thực ba bước, lưu và hủy mẫu, truy xuất, sổ in) |
| P13 Kho, tài sản và mua hàng | Hoàn thành | Đợt DT-10 phần 10d (YCTD-77), DT-14 phần 14d (YCTD-106: khai báo cơ sở vật chất, thiết bị dạy học tối thiểu); DT-16 phần 16i (YCTD-128: 6.1 thực trạng và nhu cầu đầu tư, nhập phòng và danh mục thiết bị từ Excel, 1.2 báo cáo cơ sở vật chất, 2.3 gửi thiết bị dạy học lên cấp trên chạy nội bộ); DT-15 phần 15f3 (YCTD-115: lưới và biểu mẫu chung cho tồn kho, sổ kho, tài sản, hỏng và mất, kiểm kê, phiếu mua hàng, nhà cung cấp, đề nghị mua hàng; cột Thiết bị dạy học ở lưới tài sản) |; DT-18 phần 18g (YCTD-143: nơi để, tem QR, kiểm kê bằng điện thoại, đối sánh danh mục tối thiểu theo cấp học)
| P14 Hoạt động, nội dung và truyền thông | Hoàn thành | Đợt DT-10 phần 10e (YCTD-78), DT-15 phần 15f3 (YCTD-115: lưới và biểu mẫu chung cho danh mục, tin tức, thư viện, ngoại khóa); Fanpage ở DT-11 phần 11e, tài khoản thật chờ việc T1; DT-18 phần 18f (YCTD-144: website trường trên tên miền riêng, chế độ trình diễn) |
| P15 Tương tác và ý kiến | Hoàn thành | Đợt DT-10 phần 10f (YCTD-79), DT-15 phần 15f3 (YCTD-115: lưới và biểu mẫu chung cho bình chọn, khảo sát, góp ý, đồ bị mất, bình luận) |
| P16 Tuyển sinh | Hoàn thành | Đợt DT-11 phần 11a (YCTD-86), DT-15 phần 15f3 (YCTD-115: lưới và biểu mẫu chung cho hồ sơ, đợt, tin tuyển sinh; "học sinh" thay "trẻ" ở biểu mẫu chuyển hồ sơ); DT-17 phần 17d (YCTD-135: đợt thêm loại hình, năm học nhận trẻ; hồ sơ thêm nguồn phân tuyến, trạng thái Đã hủy nhập học, dùng ở phân hệ Tuyển sinh đầu cấp) |
| P17 Báo cáo và bảng điều khiển | Hoàn thành | Đợt DT-07 (YCTD-62, YCTD-63), DT-10 phần 10j (YCTD-83), DT-14 phần 14a (YCTD-105: thống kê theo tiêu chí ngành, hồ sơ chưa nhập đủ), 14d (YCTD-106: biểu EMIS đầu năm), DT-16 phần 16a (YCTD-121: Xuất PDF, tác vụ xuất nền, Tệp đã tạo, công cụ nhập Excel dùng chung, gửi lên cấp trên chạy nội bộ), DT-16 phần 16h (YCTD-125: 5.3 Thống kê học sinh đủ các phần; số liệu báo cáo sức khỏe học sinh đầu năm, màn hình và gửi lên cấp trên ở phần 16j), DT-16 phần 16j (YCTD-129: phân hệ Báo cáo số liệu đủ bảy biểu 1.1 đến 1.3, 2.1 đến 2.4, thẻ nhập tay, danh sách gửi báo cáo, Xuất file lỗi; chưa truyền lên Bộ, Sở, mã số chỉ tiêu chờ đối chiếu biểu mẫu chính thức); DT-17 phần 17a (YCTD-132: Biểu 01.ĐN-MN mã 01 đến 217, Biểu 08.ĐN-NSNN, 1.2.1 mã 01 đến 84, 2.1 đến 2.4 theo Sở, Xóa dữ liệu, 1.1.2 Gửi báo cáo đầu năm chạy nội bộ; Biểu 08 mã 24 đến 55 và khối B của 1.2.1 chờ đối chiếu); DT-15 phần 15f3 (YCTD-115: tiêu đề có số, lưới Nhật ký xuất) |
| P18 Tuyển dụng | Hoàn thành | Đợt DT-11 phần 11b (YCTD-87), DT-15 phần 15f3 (YCTD-115: lưới và biểu mẫu chung cho đề nghị, tin tuyển dụng, ứng viên) |
| P19 Kênh truy cập và thông báo | Hoàn thành | Đợt DT-08 (YCTD-64, YCTD-65), Zalo ở DT-11 phần 11e; DT-15 phần 15a (YCTD-107: menu ngang đánh số, menu người dùng, lưới dữ liệu dùng chung; các phần 15b đến 15h theo `32_KE_HOACH_THEO_HE_THONG_SO.md`); DT-16 phần 16b (YCTD-119: lưới dữ liệu chung, hộp xác nhận xóa cho các màn hình còn lại của Mầm non, Cơ sở vật chất, Quản trị hệ thống); bản cài riêng trên điện thoại (N2, G3-04) chờ Eric quyết định |

## 2. Việc còn lại

### 2.1 Làm được ngay, mã M<số phân hệ>

| Mã | Công việc | Phân hệ | Trạng thái | Ghi chú |
|---|---|---|---|---|
| M00 | Trả lời câu hỏi mở và xác nhận giả định | Toàn dự án | Hoàn thành | Là điều kiện bắt buộc trước khi xây dựng |
| M00-2 | Phê duyệt phương án lưu trữ nhiều đơn vị và bộ công nghệ | Toàn dự án | Hoàn thành | Chốt ngày 2026-10-09: phương án A (QĐ-02) và bộ công nghệ đề xuất (QĐ-11) |
| M00-3 | Phê duyệt cách xếp ba giai đoạn | Toàn dự án | Hoàn thành | Eric đồng ý ngày 2026-10-09 (Q-07) |
| M00-4 | Xác nhận cây đơn vị thực tế | Toàn dự án | Hoàn thành | Nhà trường tự tạo trong phần Cấu hình; biểu phí dùng chung (Q-113, Q-122) |
| M00-5 | Chốt mức hạn mức phê duyệt theo loại chứng từ | Toàn dự án | Hoàn thành | Để nhà trường cấu hình sau; khi chưa cấu hình Hiệu trưởng duyệt mọi chứng từ (Q-112). Q-123 vẫn mở |
| M01 | Xây dựng nền tảng, cây đơn vị hai cấp, tài khoản, vai trò, quyền | P01 | Hoàn thành | Đợt DT-01 sáu phần (YCTD-34 đến YCTD-42), yêu cầu gộp số 3 đến 9; sĩ số và nhật ký truy cập theo cấu hình ở DT-09 (YCTD-70) |
| M01-2 | Xây dựng dịch vụ định danh độc lập tự viết | P01 | Hoàn thành | Phần lõi ở DT-01 phần 1; phần phụ huynh ở DT-02 (YCTD-43); nhà cung cấp tin nhắn thật chờ việc T1 |
| M01-3 | Nền móng kỹ thuật DT-00: kho mã nguồn GitHub, cấu trúc nhiều gói, ranh giới giao diện và máy chủ, gói mã dùng chung, môi trường phát triển Docker, tích hợp liên tục chỉ chạy kiểm thử | Toàn dự án | Hoàn thành | Giao diện chỉ gọi giao diện lập trình ứng dụng; kho https://github.com/luckyshopvn/school_management; 6/6 kiểm thử đạt trên máy và GitHub Actions; Eric gộp yêu cầu gộp số 1 vào `main` ngày 09/10/2026 (YCTD-32) |
| M02 | Xây dựng hồ sơ trẻ, phụ huynh, lớp học, phân lớp | P02 | Hoàn thành | Đợt DT-03 ba phần (YCTD-44 đến YCTD-46); chuyển đơn vị, thôi học, đồng ý hình ảnh ở DT-09 phần 9b (YCTD-67); chuyển trẻ sang năm học mới (GD-90) ở DT-09 phần 9d (YCTD-69) |
| M04 | Xây dựng điểm danh, báo vắng, đón trả trẻ | P04 | Hoàn thành | Đợt DT-04 (YCTD-47, YCTD-48); nhật ký của bé ở DT-08 phần 8b (YCTD-65); nhắc ghi nhật ký ở DT-09 phần 9f (YCTD-71) |
| M05 | Xây dựng học phí, khoản thu, giảm trừ | P05 | Hoàn thành | Đợt DT-05 sáu phần (YCTD-49 đến YCTD-57) đã gộp vào main; còn bộ chuyển đổi nhà cung cấp thanh toán thật khi chọn xong ở T1 |
| M06 | Xây dựng phiếu thu, phiếu chi, công nợ, quỹ tiền mặt | P06 | Hoàn thành | Đợt DT-05 phần 5d, 5e, 5f (YCTD-53 đến YCTD-57); báo cáo thu chi theo nhóm ở DT-09 phần 9e (YCTD-70); nhắc nợ, xử lý công nợ quá hạn, đối chiếu ngân hàng, công nợ phải trả, chốt kỳ tài chính ở DT-10 phần 10i (YCTD-82) |
| M07 | Xây dựng hồ sơ nhân sự và hợp đồng lao động | P07 | Hoàn thành | Đợt DT-06 phần 6a (YCTD-58) đã gộp vào main |
| M08 | Xây dựng chấm công, nghỉ phép, bảng lương | P08 | Hoàn thành | Đợt DT-06 phần 6b-1, 6b-2, 6c-1, 6c-2 (YCTD-59 đến YCTD-61) |
| M17 | Xây dựng bảng điều khiển và báo cáo cơ bản | P17 | Hoàn thành | Đợt DT-07 phần 7a, 7b (YCTD-62, YCTD-63); báo cáo hoạt động và công việc, báo cáo hợp nhất, xuất dữ liệu ở DT-10 phần 10j (YCTD-83) |
| M19 | Xây dựng ứng dụng phụ huynh và ứng dụng giáo viên | P19 | Hoàn thành | Đợt DT-08 phần 8a, 8b (YCTD-64, YCTD-65); các màn hình của phân hệ giai đoạn 2 làm cùng phân hệ đó |
| M03 | Xây dựng giảng dạy, giáo án, thời khóa biểu | P03 | Hoàn thành | Đợt DT-10 phần 10g (YCTD-80): lĩnh vực, nhóm bài học, chủ đề, bài học, giáo án duyệt hai bước, thời khóa biểu, kế hoạch giảng dạy, tiến độ học tập, lịch hoạt động lớp; tổ chuyên môn chưa làm |
| M09 | Xây dựng công việc, kế hoạch, đánh giá | P09 | Hoàn thành | Đợt DT-10 phần 10h (YCTD-81): giao việc, việc cá nhân, kế hoạch, tiến độ, đánh giá theo chỉ số; kèm quá trình công tác và chứng chỉ (P07-03), thưởng và khấu trừ (P08-07) |
| M10 | Xây dựng y tế học đường | P10 | Hoàn thành | Đợt DT-10 phần 10a hồ sơ, khám, sự kiện, chăm sóc, báo cáo (YCTD-74); phần 10b thuốc (YCTD-75) |
| M11 | Xây dựng xe đưa đón | P11 | Đã bỏ | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| M12 | Xây dựng bếp, thực đơn, định lượng | P12 | Hoàn thành | Đợt DT-10 phần 10c (YCTD-76), gồm báo cáo ăn và bếp P17-08 |
| M13 | Xây dựng kho, tài sản, mua hàng | P13 | Hoàn thành | Đợt DT-10 phần 10d (YCTD-77) |
| M14 | Xây dựng hoạt động, tin tức, thư viện, thông báo | P14 | Hoàn thành | Đợt DT-10 phần 10e (YCTD-78): hoạt động và hình ảnh, tin tức, thư viện, album, hình tô màu, ngoại khóa có phí |
| M15 | Xây dựng tương tác, góp ý, bình chọn, khảo sát | P15 | Hoàn thành | Đợt DT-10 phần 10f (YCTD-79): trao đổi hai chiều, góp ý, bình chọn, biểu quyết, khảo sát, bình luận và thích; đồ bị mất của trẻ (P02-11) |
| M16 | Xây dựng tuyển sinh trực tuyến | P16 | Hoàn thành | Đợt DT-11 phần 11a (YCTD-86): đợt tuyển sinh, tin tuyển sinh, nộp hồ sơ trực tuyến không cần tài khoản, xét duyệt theo chỉ tiêu, chuyển thành hồ sơ trẻ theo QT-01 |
| M18 | Xây dựng tuyển dụng | P18 | Hoàn thành | Đợt DT-11 phần 11b (YCTD-87): đề nghị tuyển dụng, tin tuyển dụng công khai, hồ sơ ứng viên, phỏng vấn, tạo hồ sơ nhân sự từ ứng viên đã tuyển |

### 2.2 Tính năng mới, mã N<số>

| Mã | Công việc | Trạng thái | Ghi chú |
|---|---|---|---|
| N1 | Xác thực hai lớp cho Hiệu trưởng, Phó Hiệu trưởng, kế toán trưởng, quản trị nền tảng | Đã bỏ | Bỏ ngày 09/10/2026 theo quyết định của Eric (YCTD-31) |
| N2 | Bản cài riêng trên điện thoại cho phụ huynh | Đã bỏ | Eric quyết định ngày 13/10/2026 chưa làm, phụ huynh dùng ứng dụng trên trình duyệt; xem lại khi bản trên trình duyệt không đáp ứng (G3-04, YCTD-92) |
| N3 | Kết nối Facebook và Fanpage để đăng nội dung đã duyệt | Hoàn thành | Đợt DT-11 phần 11e (YCTD-90), bản giả lập; nối tài khoản thật ở việc T1 |
| N21 | Viết bộ ca kiểm thử chi tiết cho P01, P02 và P04, P05 và P06, P08 (Q-105) | Hoàn thành | Thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`, 437 ca, năm đợt đã duyệt; xem mục 7 |
| N17 | Gửi thông báo và nhắc nợ qua Zalo Official Account | Hoàn thành | Đợt DT-11 phần 11e (YCTD-90), bản giả lập; nối Official Account thật ở việc T7 |
| N4 | Đối soát thanh toán tự động qua ngân hàng hoặc cổng thanh toán | Hoàn thành | Đợt DT-11 phần 11d (YCTD-89): nhập tệp sao kê, đối soát tự động, đề xuất lập phiếu thu, nhiều cổng thanh toán; cổng có thông báo tiền vào thật chờ việc T1 |
| N5 | Sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp | Hoàn thành | Đợt DT-11 phần 11c (YCTD-88): hệ thống tài khoản theo Thông tư 24/2024/TT-BTC (kế toán trưởng rà lại danh mục), quy tắc ghi sổ, ghi sổ tự động, bút toán thủ công, nhật ký chung, sổ cái, bảng cân đối số phát sinh |
| N6 | Cập nhật bộ tài liệu theo bốn yêu cầu ngày 09/10/2026 | Hoàn thành | Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.2.0 |
| N7 | Lập kế hoạch tổng thể dự án | Hoàn thành | Xem `01_KE_HOACH_TONG_THE.md`; gồm 12 giai đoạn, 12 cổng, 12 đợt, 12 rủi ro |
| N8 | Đổi tên dự án thành School Management | Hoàn thành | Thay 43 chỗ trên 36 tệp; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.3.1 |

### 2.3 Cần tài khoản hoặc hạ tầng bên ngoài

| Mã | Công việc | Cần gì | Trạng thái |
|---|---|---|---|
| T1 | Gửi thông báo và mã đăng nhập một lần qua tin nhắn tới phụ huynh | Tài khoản nhà cung cấp tin nhắn thương hiệu | Đang thực hiện: Eric chọn eSMS.vn ngày 13/10/2026; kết nối đã viết ở DT-12 phần 12a (YCTD-93); cần tài khoản và tên thương hiệu đã đăng ký khi triển khai |
| T2 | Gửi thư điện tử thông báo | Tài khoản gửi thư | Bị chặn, cần tài khoản |
| T3 | Thông báo đẩy trên điện thoại | Khóa dịch vụ thông báo đẩy | Bị chặn, cần tài khoản |
| T4 | Kết nối Facebook và Fanpage | Tài khoản quản trị trang và quyền ứng dụng | Đang thực hiện: kết nối thật đã viết ở DT-12 phần 12c (YCTD-95); cần khóa trang khi triển khai |
| T5 | Xác nhận chuyển khoản tự động cho thanh toán bằng mã QR | Tài khoản dịch vụ của ngân hàng hoặc đơn vị trung gian, xem Q-142 | Đang thực hiện: Eric chọn PayOS, SePay, Casso, VNPay ngày 13/10/2026; kết nối đã viết ở DT-12 phần 12b (YCTD-94); cần tài khoản khi triển khai |
| T6 | Hạ tầng chạy thật | Thuê máy chủ đám mây trong nước cho môi trường thử nghiệm và chạy thật: máy chủ, cơ sở dữ liệu, kho lưu trữ tệp | Cấu hình triển khai đã có ở `deploy/` (DT-12 phần 12d, YCTD-98); Eric thuê máy chủ, tên miền, rồi triển khai theo `deploy/README.md` |
| T7 | Gửi thông báo qua Zalo | Tài khoản Zalo Official Account đã xác thực của trường | Đang thực hiện: kết nối thật và làm mới khóa đã viết ở DT-12 phần 12c (YCTD-95); cần Official Account đã xác thực khi triển khai |
| T8 | Kết nối tự động với cơ sở dữ liệu ngành | Tài khoản và tài liệu kết nối do Sở Giáo dục cung cấp | Bị chặn, cần tài khoản; giai đoạn 3 (G3-09) |

### 2.4 Hệ thống lớn, làm theo đợt riêng

| Mã | Công việc | Trạng thái | Ghi chú |
|---|---|---|---|
| L1 | Nhập dữ liệu ban đầu từ Excel theo mẫu | Hoàn thành | Đợt DT-03 phần 3c (YCTD-46), nhân sự ở DT-06 phần 6a, số dư nợ đầu kỳ ở DT-05 phần 5d (P01-13) |
| L2 | Ứng dụng phụ huynh bản cài riêng | Đã bỏ | Trùng mã N2 (YCTD-92) |
| L3 | Sổ kế toán kép | Hoàn thành | Trùng mã N5, đợt DT-11 phần 11c (YCTD-88) |

## 3. Thứ tự ưu tiên tiếp theo

Chỉ liệt kê việc chưa xong. Mọi đợt xây dựng DT-00 đến DT-11 đã hoàn thành; bản ứng viên phát hành 1.0.0, 1.1.0, 1.2.0 đã đóng gói (`28_BAO_CAO_KIEM_THU_CG_10.md`, `29_BAO_CAO_KIEM_THU_G2.md`, `30_BAO_CAO_KIEM_THU_G3.md`).

1. DT-12 — Nối nhà cung cấp thật và chuẩn bị cấu hình triển khai (YCTD-92).
2. T6 — Thuê máy chủ đám mây trong nước, triển khai, chạy kịch bản hiệu năng và phục hồi CT-086 đến CT-089.
3. T1, T5, T4, T7 — Chọn nhà cung cấp tin nhắn, cổng thanh toán, nối Facebook và Zalo Official Account thật thay bộ giả lập.

## 4. Đang thực hiện

| Mã | Công việc | Giai đoạn | Người thực hiện | Trạng thái | Hạn | Ghi chú |
|---|---|---|---|---|---|---|
| DT-12 | Nối nhà cung cấp thật (eSMS, PayOS, SePay, Casso, VNPay, Fanpage, Zalo) và cấu hình triển khai | Sau giai đoạn 3 | Claude | Đang thực hiện | Chưa đặt | Bốn phần 12a đến 12d (YCTD-92) |

## 5. Bị chặn

| Mã | Công việc | Giai đoạn | Người thực hiện | Lý do bị chặn |
|---|---|---|---|---|
| — | Không có việc nào bị chặn từ ngày 2026-10-13 | — | — | — |

## 6. Chờ phê duyệt (đề xuất của AI)

| Mã | Đề xuất | Lý do | Ảnh hưởng | Quyết định |
|---|---|---|---|---|
| M00-2 | Phương án lưu trữ A: một cơ sở dữ liệu, tách bằng cột `org_unit_id` kèm ràng buộc ở tầng dữ liệu | Chi phí thấp, báo cáo hợp nhất đơn giản | Toàn bộ lược đồ dữ liệu, xem `12_KIEN_TRUC_HE_THONG.md` mục 3 | Đồng ý ngày 2026-10-09 |
| M00-2 | Bộ công nghệ TypeScript, NestJS, React kèm Vite, PostgreSQL, Redis, Docker | Một ngôn ngữ cho máy chủ và giao diện | Toàn bộ mã nguồn, xem `13_CONG_NGHE_SU_DUNG.md` | Đồng ý ngày 2026-10-09 |
| M00-3 | Cách xếp ba giai đoạn sản phẩm | Giai đoạn 1 đủ để vận hành thật | Thứ tự các đợt xây dựng, xem `05_PHAM_VI.md` | Đồng ý ngày 2026-10-09 |
| N1 | Xác thực hai lớp cho vai trò nhạy cảm | Giảm rủi ro chiếm tài khoản | Dịch vụ định danh | Không làm, bỏ ngày 09/10/2026 (YCTD-31) |

## 7. Hoàn thành

| Mã | Công việc | Phân hệ | Ngày hoàn thành | Phiên bản | Ghi chú |
|---|---|---|---|---|---|
| — | Khởi tạo bộ tài liệu thiết kế | Toàn dự án | 2026-10-09 | 0.1.0 | 25 tệp khung do script khởi tạo |
| — | Soạn 20 tài liệu thiết kế và 10 đặc tả quy trình nghiệp vụ | Toàn dự án | 2026-10-09 | 0.1.0 | Chờ Eric duyệt, chưa phải bản chốt |
| N6 | Cập nhật theo bốn yêu cầu: Ban Giám hiệu, nhiều cấp đơn vị, tách giao diện và máy chủ, dịch vụ định danh | Toàn dự án | 2026-10-09 | 0.2.0 | Sửa 31 tệp, thêm mã mới BR-77 đến BR-80 và các mã liên quan |
| N7 | Lập kế hoạch tổng thể dự án | Toàn dự án | 2026-10-09 | 0.3.0 | Tạo `01_KE_HOACH_TONG_THE.md`; thêm mã CG-xx, DT-xx, RR-xx, GD-82, GD-83, Q-128 đến Q-130, AI-38, AI-39 |
| N8 | Đổi tên dự án thành School Management | Toàn dự án | 2026-10-09 | 0.3.1 | Thay tên cũ trên 36 tệp, 43 chỗ; thêm `GD-84`, `Q-132`; `Q-131` đã trả lời |
| N24 | Lịch năm học có học kỳ, kỳ hè, tuần học; đăng ký học hè; số phiếu theo năm học | Toàn dự án | 2026-10-09 | 0.25.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-30; thêm BR-91, BR-92, P05-13, G1-20, MH-45, MH-46, AC-228 đến AC-232, CT-184 đến CT-188, 15 ca chi tiết |
| N21 | Bộ ca kiểm thử chi tiết giai đoạn 1 cho dịch vụ định danh, P01, P02, P04, P05, P06, P08 | Toàn dự án | 2026-10-09 | 0.24.1 | 437 ca `CTC-...` trong `27_BO_CA_KIEM_THU_CHI_TIET/`; phát sinh Q-147 đến Q-156, YCTD-26 đến YCTD-29 |
| N23 | Rà duyệt tài liệu 01, 04 đến 23 và các đặc tả QT; bỏ dịch vụ học thứ bảy; phiếu chi sang giai đoạn 1; bỏ bữa tối | Toàn dự án | 2026-10-09 | 0.22.2 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-16 đến YCTD-25; thêm BR-84, BR-85, AC-204 đến AC-219, CT-160 đến CT-175, BM-70, P05-12, P10-12; tài liệu 11 và 12 lên phiên bản 1.1; xếp năm chức năng giai đoạn 1 mới vào đợt; rà duyệt và phê duyệt QT-01 đến QT-10 (QT-08 đã bỏ) |
| N22 | Áp dụng câu trả lời lượt 17 đến lượt 21, xử lý hết giả định | Toàn dự án | 2026-10-09 | 0.12.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-15; thêm P02-12, BR-83, AC-198 đến AC-203, CT-154 đến CT-159, `Q-144` |
| N20 | Áp dụng câu trả lời lượt 9 đến lượt 16, trả lời hết câu hỏi mở | Toàn dự án | 2026-10-09 | 0.11.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-14 |
| N19 | Áp dụng câu trả lời lượt 8: bỏ ứng lương, quỹ không âm, đồng ý hình ảnh, số định danh của trẻ | Toàn dự án | 2026-10-09 | 0.10.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-13; thêm BR-81, AC-190 đến AC-193, CT-146 đến CT-149 |
| N18 | Áp dụng câu trả lời lượt 6 và lượt 7 | Toàn dự án | 2026-10-09 | 0.9.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-12; thêm P01-13, P06-11, AC-183 đến AC-189, CT-139 đến CT-145, `Q-142` |
| N16 | Áp dụng câu trả lời lượt 4 và lượt 5 | Toàn dự án | 2026-10-09 | 0.8.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-11; thêm AC-180 đến AC-182, CT-136 đến CT-138 |
| N15 | Áp dụng câu trả lời lượt 3: chế độ kế toán, học phí chính khóa, miễn giảm, khấu trừ, phép năm | Toàn dự án | 2026-10-09 | 0.7.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-10; thêm P05-11, P08-11, `Q-141` |
| N14 | Áp dụng câu trả lời lượt 1 và lượt 2: phương án lưu trữ, bộ công nghệ, học phí giữa tháng, sổ kế toán kép, hạn mức, cây đơn vị, tiền ăn, ba giai đoạn | Toàn dự án | 2026-10-09 | 0.6.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-09; thêm `Q-140`, `GD-87` |
| N13 | Áp dụng câu trả lời Q-139 và xác nhận GD-86 | P14, P08 | 2026-10-09 | 0.5.3 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-08; thêm `AC-175`, `CT-131` |
| N12 | Bổ sung điểm cuối cho phân hệ Giảng dạy và bảng lịch hoạt động lớp | P03 | 2026-10-09 | 0.5.2 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-07 |
| N11 | Áp dụng câu trả lời Q-136 đến Q-138 vào P08-10, P10-11, P14-10, P14-11 | Toàn dự án | 2026-10-09 | 0.5.1 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-06; thêm `Q-139`, `GD-86`, `AC-173`, `AC-174`, `CT-129`, `CT-130` |
| N10 | Bổ sung hai mươi chức năng theo tám ảnh sơ đồ chức năng, lưu ảnh vào `26_SO_DO_CHUC_NANG/` | Toàn dự án | 2026-10-09 | 0.5.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-05; thêm `Q-136` đến `Q-138`, `GD-85`; `Q-06`, `Q-28`, `Q-29` đã trả lời |
| N9 | Chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow, sửa các chỗ chưa khớp, thống nhất phân cấp phê duyệt, đổi mã dự án thành SM | Toàn dự án | 2026-10-09 | 0.4.0 | Xem `24_YEU_CAU_THAY_DOI.md` YCTD-01 đến YCTD-04; `Q-49`, `Q-132` đến `Q-135` đã trả lời |


## 8. Quy ước mã

- M<số> cho việc thuộc phân hệ đã có.
- N<số> cho tính năng mới ngoài kế hoạch gốc.
- Mã N đang dùng đến: N22
- Không đổi mã đã cấp.
- Không tái sử dụng mã N đã dùng, kể cả khi tính năng bị bỏ.
- Bỏ việc theo yêu cầu: gạch ngang và ghi ngày, không xóa im lặng.

## 9. Quy tắc cập nhật

- Chỉ đánh dấu hoàn thành khi đã chạy thử thật và đạt tiêu chí nghiệm thu.
  Chưa kiểm chứng thì để trạng thái Đang thực hiện kèm ghi chú.
- Cập nhật trong cùng lượt làm việc với việc code, không để lệch với thực tế.
- Cập nhật ngày ở phần đầu sau mỗi lần sửa.
- Phát hành phiên bản mới thì ghi thêm một mục vào 23_LICH_SU_PHIEN_BAN.md.
- Sau khi cập nhật, báo lại một dòng: mã công việc và trạng thái mới.
