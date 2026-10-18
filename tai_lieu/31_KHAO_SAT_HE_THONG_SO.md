# 31. KHẢO SÁT HỆ THỐNG THÔNG TIN QUẢN LÝ GIÁO DỤC CỦA SỞ GD&ĐT TP.HCM

- Mô tả: Kết quả khảo sát chi tiết chức năng và giao diện của Hệ thống thông tin quản lý giáo dục (cấp Trường, Mầm non) tại `truong.hcm.edu.vn`, đối chiếu với hệ thống School Management và đề xuất bổ sung; mục 9 phân tích kỹ thuật bằng REA (trang công khai, trang chủ và màn hình 2.1 sau đăng nhập).
- Phiên bản: 1.1
- Ngày cập nhật: 2026-10-15
- Trạng thái: Đã khảo sát
- Người khảo sát: Claude, theo yêu cầu của Eric ngày 2026-10-13

## 1. Phạm vi và cách khảo sát

1. Eric đăng nhập bằng tài khoản quản trị đơn vị của một trường mầm non; Claude chỉ đọc giao diện trong phiên đó: mở menu, tải từng trang bằng yêu cầu xem, đọc tiêu đề, ô lọc, ô nhập, tên cột, tên nút, thẻ. Không bấm Lưu, Xóa, Gửi, Lấy dữ liệu, Tạo hồ sơ; không đổi năm học.
2. Không ghi dữ liệu cá nhân hay số liệu của trường vào tài liệu này; chỉ ghi tên chức năng và cấu trúc màn hình.
3. Đã khảo sát: 6 phân hệ, 98 màn hình có đường dẫn. Không xem được: phân hệ Tuyển sinh đầu cấp (chỉ mở ở học kỳ II năm 2025-2026); nội dung chỉ tiêu của các biểu báo cáo EMIS (biểu trống tới khi bấm Lấy dữ liệu, thao tác ghi nên không thực hiện); phân hệ Hồ sơ điện tử (có trong phân quyền, không có trong ô chọn phân hệ của tài khoản này).

## 2. Giao diện chung

### 2.1 Đăng nhập

- Hai cách: tài khoản SSO Sở GD&ĐT và tài khoản QLTH (riêng của trường).
- Chọn đơn vị trước khi vào, lọc dần: Năm học → Cấp học (Mầm non, Tiểu học, THCS, THPT, GDTX) → Phường/Xã (địa giới mới, thêm "Trường trực thuộc sở", "Đặc khu Côn Đảo") → Trường (ghi kèm mã trường).
- Mã xác nhận dạng ảnh có nút làm mới; ghi nhớ tài khoản; quên mật khẩu; "Đăng nhập năm cũ"; đường dây nóng.

### 2.2 Khung trang

- Thanh đầu trang màu xanh: biểu tượng; tên trường màu vàng; ô chọn phân hệ (biểu tượng xanh lá, tên phân hệ, mũi tên); menu người dùng "Quản trị đơn vị" (Thông báo, Hồ sơ nhân sự cá nhân, Đổi mật khẩu, Cấu hình hiển thị lưới, Danh sách ý kiến đã gửi, Hướng dẫn, Thoát); ô ngữ cảnh "Cấp MN · 2026-2027 · Học kỳ I"; lưới ứng dụng liên kết (eNetViet).
- Menu ngang nhiều cấp, đánh số thứ bậc (1., 1.1., 1.1.1.), mỗi phân hệ một bộ menu.
- Trang chủ: "Truy cập nhanh" với ô "Thêm truy cập nhanh".
- Thông báo bật lên: thông báo hệ thống, hết hạn mật khẩu, bắt buộc cập nhật mã định danh tổ chức theo NĐ 69 (12 chữ số, do VNeID cấp).
- Chân mọi trang: biểu mẫu "Gửi phản hồi" (đường dẫn trang, số điện thoại, email, chủ đề, nội dung) gửi về đơn vị hỗ trợ.

### 2.3 Mẫu màn hình danh sách

- Lưới dữ liệu có: cấu hình hiển thị lưới (nhảy cột, nhảy dòng khi nhập trên lưới), cấu hình cột hiển thị, số bản ghi mỗi trang (10–200), phân trang, ô chọn từng dòng, Sửa và Hồ sơ trên từng dòng.
- Nút thường gặp: Tìm kiếm, Mở rộng tìm kiếm, Thêm mới, Thay đổi, Xóa (hộp xác nhận có ô "Tôi đã đọc và đồng ý xóa …"), Xuất Excel, Xuất PDF, Xuất file lỗi.
- Nhập từ Excel: Tải file mẫu (kèm dữ liệu), Tra cứu danh mục, chọn cột để nhập, Tải lên, xem lỗi.
- Tác vụ nền: xuất tệp lớn tạo "tác vụ", danh sách "Tệp đã tạo".
- Gửi lên cấp trên: danh sách biểu mẫu kèm "Hoàn thành dữ liệu", "Trạng thái", "Ngày gửi", nút Gửi hồ sơ/Gửi dữ liệu, Đặt trạng thái gửi lại, Gửi yêu cầu mở khóa.

## 3. Phân hệ Quản lý giáo dục Mầm Non

### 3.1 Trường học

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 1.1 | Hồ sơ trường | Sáu thẻ: Thông tin chung; Thông tin khác; Trường có yếu tố nước ngoài; Kết nối internet; Hạ tầng, thiết bị, ứng dụng CNTT; Tài khoản văn phòng điện tử. Trường: cơ sở GDMN, mã định danh, mã định danh điện tử (QĐ 20), mã số thuế, tên theo quyết định thành lập, hiệu trưởng, điện thoại, địa chỉ, fax, email, website, diện tích đất, diện tích xây dựng; khoảng 30 ô tích tiêu chí (xã ĐBKK, trường quốc tế, chi bộ Đảng, suất ăn công nghiệp hoặc bếp tại trường, máy tính, internet, điện lưới, nước sạch, nước uống, vệ sinh riêng theo giới, rửa tay, giáo dục giới tính và phòng chống xâm hại, phòng chống thiên tai, chương trình tích hợp, trường học an toàn, khu công nghiệp, hỗ trợ theo NĐ 105/2020, giữ trẻ ngoài giờ, chương trình tiên tiến, làm quen tiếng Anh, phòng tiếng Anh, sân chơi, khu vận động, bếp ăn, tăng cường tiếng Việt, đồ chơi ngoài trời tối thiểu, thư viện); quyết định thành lập (số, ngày, cơ quan cấp, số chứng nhận, lần thay đổi); chương trình; số phòng máy, máy tính quản lý, máy để bàn, xách tay, máy tính bảng; bảng tài khoản văn phòng điện tử. Nút Ghi, Thêm mới/Xóa điểm trường |
| 1.2 | Quản lý phân hiệu | Danh sách phân hiệu |
| 1.3 | Quản lý điểm trường | Cột: mã, tên, địa chỉ, khoảng cách đến cơ sở chính (km), diện tích, điện thoại |
| 1.4 | Cấu hình trường | Tên trường hiển thị, tên đơn vị hành chính, tính cân nặng/chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân |
| 1.5 | Cập nhật đơn vị quản lý | Đơn vị quản lý, UBND xã, tỉnh, phường/xã |
| 1.6 | Tài khoản đồng bộ của Bộ, của Sở | Tên đăng nhập, mật khẩu để đồng bộ hồ sơ lên CSDL Bộ, Sở |
| 1.7 | Rà soát thông tin kiểm định CLGD | Số lớp, phòng học, phòng bộ môn, diện tích đất, sàn, số học sinh, diện tích trên học sinh, ghi chú; Lấy dữ liệu, Ghi |
| 1.8 | Tách trường | Tạo yêu cầu tách hồ sơ (trường đến, lý do, danh sách đối tượng, trạng thái xác nhận đi, đã tiếp nhận); Tiếp nhận hồ sơ tách trường |

### 3.2 Lớp học

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 2.1 | Hồ sơ lớp học | Cột: phân hiệu, mã lớp, tên lớp, nhóm lớp, nhóm trẻ, nhóm tuổi, thứ tự, giáo viên chủ nhiệm, học 2 buổi/ngày, lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, lớp ghép, ghép vào lớp, lớp bán trú, lớp giải thể, điểm trường. Thêm mới, Xóa lớp, Xuất Excel |
| 2.2 | Nhập lớp học từ Excel | Tải file mẫu, tra cứu danh mục, chọn cột, tải lên |

### 3.3 Nhân sự

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 3.1.1 | Hồ sơ cán bộ, giáo viên | Lọc: mã định danh Bộ, số định danh cá nhân, họ tên. Cột: mã định danh Bộ, họ tên, ngày sinh, giới tính, trạng thái, dân tộc, điện thoại, vị trí việc làm, nhóm chức vụ, hình thức hợp đồng, trình độ chuyên môn. Đồng bộ hồ sơ lên CSDL Bộ, Xuất file lỗi, Cấu hình cột, Thêm mới, Thay đổi, Xóa, Xuất Excel |
| 3.1.2 | Nhân sự phân hiệu | Gán phân hiệu, lấy theo phân hiệu giảng dạy |
| 3.1.3 | Nhập nhân sự từ Excel | Tải file mẫu kèm dữ liệu, tra cứu danh mục, tải lên (mẫu 75 cột, xem YCTD-100) |
| 3.1.4 | Tìm kiếm hồ sơ nhân sự | Thêm lọc: Đảng viên, tuổi từ–đến, xã ĐBKK |
| 3.1.5 | Xác thực số định danh nhân sự với CSDLQG về dân cư | Cột: CMND/CCCD, thông tin thường trú, trạng thái xác thực, ghi chú; nút Xác thực |
| 3.2 | Đánh giá chuẩn nghề nghiệp | Danh sách cán bộ với Đánh giá, Minh chứng, kết quả tự đánh giá, kết quả cấp trên; nhập từ Excel (file mẫu, file mẫu kèm dữ liệu) |
| 3.3 | Phân công phụ trách lớp | Giáo viên, lớp chủ nhiệm; Xuất Excel |
| 3.4 | Khai báo tuần (thời khóa biểu) | Tuần học, ngày bắt đầu, kết thúc, học kỳ, hiển thị, tuần đệm, tên tuần đệm |
| 3.5 | Biến động nhân sự | Tiếp nhận nhân sự chuyển đến (chuyển từ tỉnh, xã, trường; tiếp nhận; xem và in PDF); duyệt chuyển đi (ngày chuyển, đã xác nhận, trạng thái chuyển đến); giáo viên đi thỉnh giảng (môn dạy, trường đến, trạng thái duyệt); xác nhận giáo viên đến thỉnh giảng |

### 3.4 Học sinh

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 4.1.1 | Quản lý hồ sơ học sinh | Cột: mã định danh Bộ, họ tên, ngày sinh, giới tính, dân tộc, trạng thái, số điện thoại liên hệ. Cấp mã định danh Bộ, Xuất file lỗi, Cấu hình cột, Thêm mới, Thay đổi, Xóa, Xuất Excel |
| 4.1.2 | Nhập học sinh từ Excel | Mẫu 82 cột (YCTD-100), tra cứu danh mục, danh mục tổ thôn, xác nhận "đồng ý cập nhật dữ liệu học sinh" |
| 4.1.3 | Sắp xếp học sinh (A–Z) | Theo lớp chọn hoặc tất cả lớp |
| 4.1.4 | Tìm kiếm hồ sơ học sinh | Lọc mã định danh, họ tên, số định danh, học 2 buổi, bán trú, biết bơi; cột khối, lớp; Xuất Excel, PDF |
| 4.1.5 | Điện thoại nhận tin của phụ huynh | Số điện thoại nhận tin, thông tin bố, mẹ, người đỡ đầu; nhập từ Excel |
| 4.1.6–4.1.7 | Nhóm học sinh, xếp học sinh vào nhóm | Mã, tên nhóm; thêm, xóa học sinh khỏi nhóm |
| 4.1.8–4.1.9 | Thu thập và xác thực số định danh với CSDLQG về dân cư | Tải mẫu, tải lên; xác thực, tra cứu biến động cư trú |
| 4.1.10 | Tài khoản học và thi | Khởi tạo, cấp lại mật khẩu học sinh |
| 4.1.11 | Cập nhật địa danh hành chính | Chuyển địa danh cũ sang mới (sau sáp nhập) cho năm loại địa chỉ; nhập từ Excel |
| 4.1.12 | Học 2 buổi/ngày, bán trú | Đánh dấu hàng loạt |
| 4.2 | Biến động học sinh | Chuyển lớp (chọn nhanh lớp mới cho nhiều trẻ); quản lý chuyển đi, chuyển đến, thôi học; tiếp nhận học sinh chuyển đến (từ tỉnh, xã, trường); duyệt chuyển đi |
| 4.3.1 | Nhập kết quả sức khỏe nuôi dưỡng | Tháng tuổi, cân nặng, chiều cao, kết quả cân nặng, chiều cao, cân nặng theo chiều cao, BMI, kênh tăng trưởng, biểu đồ; nhập từ Excel; Tính và lưu |
| 4.3.2 | Tổng hợp cân nặng, chiều cao vào báo cáo | Lọc giới tính, kênh (suy dinh dưỡng thể nhẹ cân, cân nặng cao hơn tuổi); cột: được khám định kỳ, kênh tăng trưởng, suy dinh dưỡng thể thấp còi, thể còi cọc, béo phì; xuất theo lớp, theo khối |
| 4.4 | Hoàn thành chương trình mầm non | Theo lớp 5–6 tuổi: Hoàn thành (H) hoặc Chưa hoàn thành (C) |
| 4.5 | Thực đơn bữa ăn | Tên thực đơn, tháng, tuần, từ ngày–đến ngày, khối áp dụng; nhập từ Excel |
| 4.6 | Sức khỏe học sinh | Giáo dục thể chất, cân nặng, chiều cao; lấy dữ liệu từ 4.3 |

### 3.5 Công cụ hỗ trợ (thống kê)

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 5.1 | Thống kê lớp học | Nhóm trẻ theo độ tuổi (3–12, 13–24, 25–36 tháng), lớp mẫu giáo (3–4, 4–5, 5–6 tuổi), số lượng, tỷ lệ |
| 5.2 | Thống kê nhân sự | Theo trình độ đào tạo (tiến sĩ … trung cấp sư phạm, có chứng chỉ bồi dưỡng nghiệp vụ sư phạm); theo vị trí việc làm (CBQL, giáo viên nhà trẻ, mẫu giáo, văn thư, kế toán, y tế, thủ quỹ, bảo vệ, nấu ăn, thư viện, thiết bị, cấp dưỡng, bảo mẫu); theo hình thức hợp đồng (viên chức có hoặc không xác định thời hạn, hợp đồng trên hoặc dưới 1 năm, NĐ 68, NĐ 06, NĐ 111, thỉnh giảng, thuê khoán); theo chuẩn nghề nghiệp CBQL (18 tiêu chí) và giáo viên (15 tiêu chí), xếp loại chung |
| 5.3 | Thống kê học sinh | Số lượng; trẻ trong độ tuổi theo nhóm, lớp; biểu đồ hoàn thành chương trình (số lớp, số trẻ 5–6 tuổi, nữ, khuyết tật, dân tộc, con thương binh liệt sĩ); diện chính sách theo độ tuổi; biết bơi, bệnh về mắt (cận, viễn, loạn, đục thủy tinh thể, thoái hóa điểm, khô mắt, lác) theo học kỳ; học sinh dân tộc; tìm học sinh thiếu thông tin |
| 5.4 | Mã định danh, mật khẩu mặc định | Theo trường, giáo viên, học sinh; tạo mật khẩu |
| 5.5–5.6 | Tiến độ xác thực số định danh học sinh, nhân sự | Theo lớp, bộ phận: tổng số, đã xác thực, tỷ lệ; danh sách trùng số định danh |
| 5.7 | Chuyển hồ sơ lên năm học mới | Thực hiện, Hủy |
| 5.8–5.9 | Thống kê hồ sơ chưa nhập đủ | Học sinh: thiếu họ tên, ngày sinh, giới tính, trạng thái, tôn giáo, các nhóm địa chỉ, điện thoại, số định danh, tên, nghề nghiệp, năm sinh, CCCD của cha mẹ. Nhân sự: thiếu dân tộc, tôn giáo, quê quán, thường trú, CCCD, email, di động, sổ BHXH, nhóm cán bộ, hợp đồng, tuyển dụng, trình độ, chuyên ngành, tài khoản ngân hàng, mã số thuế |
| 5.10 | Văn thư lưu trữ | Hồ sơ tài liệu hoàn thành, chưa hoàn thành (người giải quyết, thời hạn), báo cáo lưu trữ (phông, giai đoạn, tài liệu chỉnh lý, hết giá trị, vĩnh viễn, có thời hạn, bó, mét giá, hộp, nơi bảo quản) |
| 5.11 | Danh sách trúng tuyển tuyển sinh đầu cấp | Bước 1 xếp lớp học sinh trúng tuyển; bước 2 chuyển sang hồ sơ học sinh |

### 3.6 Cơ sở vật chất (trong phân hệ này)

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 6.1 | Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ | Chỉ tiêu theo kiên cố, bán kiên cố, cấp 4 xuống cấp, nhờ mượn; nhu cầu (lớp, phòng, triệu đồng) |
| 6.2 | Nhập liệu cơ sở vật chất | Xem mục 4 |

## 4. Phân hệ Quản lý cơ sở vật chất, TBDH

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 1.1 | Khai báo cơ sở vật chất | Năm khối phòng: nuôi dưỡng, chăm sóc và giáo dục trẻ; tổ chức ăn; phụ trợ; hành chính quản trị; khác. Lọc loại phòng/nhà, hiện trạng. Cột: tên phòng, loại, hiện trạng, diện tích, nhóm lớp, điểm trường, số chỗ ngủ, chiều cao thông thủy, kích thước sàn tập, số chỗ nhà ăn, vệ sinh khép kín hoặc liền kề, phòng đọc, sân chơi riêng, sân vườn khám phá, phòng học kết hợp nghỉ trưa, kho sách, số chỗ thư viện. Thêm mới, Nhập từ Excel, Xuất Excel |
| 1.2 | Báo cáo cơ sở vật chất | Lập báo cáo số liệu (chỉ tiêu, tổng số, kiên cố, bán kiên cố, tạm, nhờ mượn thuê, diện tích); tổng hợp mức độ đạt chuẩn; gửi lên cấp trên |
| 2.1 | Tổng hợp thiết bị dạy học | Lọc khối, môn học, nhóm tuổi. Cột: tên thiết bị, đơn vị tính, định mức của Bộ (số lượng theo đơn vị đếm, tối thiểu), hiện có, nhu cầu bổ sung năm sau, thừa, thiếu, tỷ lệ đáp ứng |
| 2.2 | Thiết bị ngoài danh mục tối thiểu | Tên, nhóm, loại thiết bị, số lượng, đơn vị tính, nhóm tuổi, đối tượng sử dụng, số lượng một nhóm áp dụng |
| 2.3 | Gửi thiết bị dạy học lên cấp trên | Biểu mẫu, hoàn thiện dữ liệu, "trường không có dữ liệu"; gửi dữ liệu, gửi yêu cầu mở khóa |

## 5. Phân hệ Báo cáo số liệu Mầm non

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 1.1 | Báo cáo EMIS đầu năm | Biểu 1 sáu thẻ: Trường – lớp học; Học sinh; Học sinh theo độ tuổi; Đội ngũ; Phòng học; Ngân sách nhà nước (quyết toán năm trước, dự toán và ước thực hiện năm nay). Cột: chỉ tiêu, đơn vị, mã số, tổng số, công lập, tư thục, dân lập, nữ, dân tộc thiểu số. Gửi báo cáo: danh sách hồ sơ, số đã gửi, số cần gửi, lần gửi cuối, trạng thái, xuất file lỗi, đặt trạng thái gửi lại |
| 1.2 | Báo cáo cơ sở vật chất | Năm thẻ: cơ sở vật chất, nhà vệ sinh, cơ sở vật chất khác, thiết bị dạy học, thông tin khác; lấy dữ liệu năm trước; gửi dữ liệu |
| 1.3 | Báo cáo sức khỏe học sinh đầu năm | Theo học sinh, công lập, tư thục, dân lập, nữ, dân tộc; gửi số liệu |
| 2.1 | Báo cáo EMIS cuối năm | Biểu cuối năm (mục I–VI), gửi |
| 2.2 | Báo cáo đội ngũ | Tổng hợp chung CBQL, giáo viên – nhân viên; ngoại ngữ – tin học; chuẩn nghề nghiệp (chưa đạt, đạt, khá, tốt); gửi |
| 2.3 | Đề án ngoại ngữ | Thống kê số trường, số trẻ; gửi, đánh dấu trường không có thông tin ngoại ngữ |
| 2.4 | Báo cáo giáo dục mầm non cuối năm | Lập biểu 1, gửi dữ liệu |

## 6. Phân hệ Quản lý kí hồ sơ

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 1.1 | Chứng thư số nhà trường | Kiểu chữ ký (ký từ xa), nhà phát hành (ví dụ VNPT-CA), tên đăng nhập, trạng thái chữ ký, trạng thái đồng bộ với Bộ; tải ảnh con dấu; đăng ký |
| 2.1 | Đồng bộ chứng thư số | Đăng ký đồng bộ |
| 2.2 | Ký số hồ sơ trường, lớp, nhân sự, học sinh | Cột: đối tượng, trạng thái, xem hồ sơ, tệp hồ sơ, ngày tạo, ngày ký, ngày thay đổi. Tạo hồ sơ, Ký số, Đăng nhập và ký, Ký sổ đầu bài, Xuất dữ liệu sổ đầu bài, Hủy hồ sơ, Tải thông tin thay đổi |
| 2.3 | Xác nhận hoàn thành và gửi hồ sơ | Xác nhận hoàn thành, hủy xác nhận, gửi hồ sơ, mã định danh hồ sơ |

## 7. Phân hệ Quản trị hệ thống

| Mục | Màn hình | Nội dung chính |
|---|---|---|
| 1.1 | Nhóm người dùng | Mã, tên, hiệu lực, là nhóm quản trị, là nhóm hệ thống |
| 1.2 | Phân quyền nhóm theo phần mềm | Chọn nhóm, tích các phần mềm (Quản lý giáo dục Mầm Non, Cơ sở vật chất TBDH, Hồ sơ điện tử, Tuyển sinh đầu cấp, Báo cáo số liệu, Quản lý kí hồ sơ) |
| 1.3 | Phân quyền nhóm theo menu | Cây menu đầy đủ của phần mềm, tích từng mục |
| 1.4 | Danh sách người dùng | Lọc nhóm quyền, mã định danh, trạng thái, tên đăng nhập, tên nhân sự, trạng thái đổi mật khẩu, ngày hết hạn mật khẩu. Cột: tên đăng nhập, tên hiển thị, nhóm quyền, mã nhân sự, mã Bộ, loại tài khoản, trạng thái, thời gian đổi và ngày hết hạn mật khẩu. Phân nhóm quyền, cấp mật khẩu, lấy danh sách CBQL/GV, Xuất Excel |

## 8. Đối chiếu với School Management

### 8.1 Đã có tương đương

Hồ sơ trẻ, nhân sự, lớp; nhập Excel (kể cả nhập thẳng tệp ngành, YCTD-100); phân hiệu, điểm trường (cây đơn vị hai cấp); phân công chủ nhiệm; khai báo tuần học (lịch năm học, tuần nghỉ); chuyển lớp, chuyển đơn vị, thôi học; chuyển hồ sơ lên năm mới; thực đơn; khám sức khỏe; nhóm người dùng và phân quyền (ma trận quyền theo nhóm chức năng, YCTD-96); danh sách người dùng; menu phân hệ, truy cập nhanh, ô năm học (YCTD-101, YCTD-102); báo cáo điểm danh, suất ăn (YCTD-103).

### 8.2 Đang làm ở DT-14 (YCTD-102)

Hoàn thành chương trình mầm non; đánh giá chuẩn nghề nghiệp giáo viên, CBQL; nhóm học sinh; thống kê theo tiêu chí ngành; cân nặng, chiều cao và kênh tăng trưởng; thiết bị dạy học tối thiểu; mẫu báo cáo EMIS.

### 8.3 Chưa có, đề xuất bổ sung

| Số | Chức năng | Mức | Ghi chú |
|---|---|---|---|
| 1 | Hồ sơ trường đầy đủ (sáu thẻ, khoảng 30 tiêu chí, quyết định thành lập, hạ tầng CNTT) | Cao | Dữ liệu đầu vào cho EMIS và kiểm định |
| 2 | Khai báo cơ sở vật chất theo năm khối phòng (thuộc tính phòng theo quy chuẩn) và báo cáo thực trạng, nhu cầu đầu tư | Trung bình | Mở rộng danh mục phòng học hiện có |
| 3 | Thống kê hồ sơ chưa nhập đủ (trẻ, nhân sự) theo từng trường thông tin | Cao | Làm nhanh trên dữ liệu ngành |
| 4 | Cấu hình cột hiển thị và số dòng mỗi trang trên mọi danh sách, nhớ theo người dùng | Trung bình | Giao diện |
| 5 | Biến động nhân sự liên trường: tiếp nhận chuyển đến, duyệt chuyển đi, thỉnh giảng | Thấp | Cần liên thông giữa các trường |
| 6 | Sắp xếp trẻ A–Z trong lớp, cập nhật số điện thoại nhận tin hàng loạt, đánh dấu học 2 buổi và bán trú hàng loạt | Trung bình | Thao tác hàng loạt |
| 7 | Văn thư lưu trữ (hồ sơ tài liệu, phông lưu trữ) | Thấp | |
| 8 | Ký số hồ sơ bằng chứng thư số | Thấp | Cần nhà cung cấp ký số |
| 9 | Xác thực số định danh với CSDLQG về dân cư, đồng bộ lên CSDL Bộ, Sở | Không làm được | Cần giao diện lập trình của Bộ, Sở (G3-09) |
| 10 | Chuyển địa danh hành chính cũ sang mới | Trung bình | Danh mục tỉnh, xã sau sáp nhập |
| 11 | Biểu mẫu "Gửi phản hồi" ở chân trang, danh sách ý kiến đã gửi | Thấp | Kênh hỗ trợ người dùng |
| 12 | Thông báo hết hạn mật khẩu, bắt buộc đổi mật khẩu định kỳ | Thấp | Cấu hình bảo mật |

## 9. Phân tích kỹ thuật bằng REA (bổ sung ngày 2026-10-15)

### 9.1 Phạm vi và cách phân tích

1. Dùng công cụ REA (rea-agents) mở trình duyệt Chrome không giao diện, chỉ tải các trang công khai không cần đăng nhập: `/` (chuyển về `Login.aspx`), `QuenMatKhau.aspx`, `LoginTruongSapNhap.aspx`, `robots.txt`. Không nhập tài khoản, không bấm Đăng nhập, Khôi phục mật khẩu hay thao tác ghi nào.
2. REA ghi lại 31 yêu cầu mạng của trang đăng nhập, tiêu đề phản hồi, cấu trúc trang (DOM), cây trợ năng và tên cookie (giá trị chỉ lưu dạng băm). Mã bằng chứng: `ev_1a2daec6…f194e380` (trang đăng nhập), `ev_f827ecb9…e34805` (các trang công khai còn lại).
3. Phần sau đăng nhập: chỉ quan sát thụ động trang chủ (mục 9.6) và màn hình 2.1 Hồ sơ lớp học (mục 9.8). Mục 2 đến mục 7 vẫn là kết quả đọc giao diện ngày 2026-10-13.
4. Mỗi nhận định ghi rõ là quan sát (thấy trực tiếp trong dữ liệu thu được) hay suy luận.

### 9.2 Nền tảng công nghệ (quan sát)

| Thành phần | Giá trị quan sát | Nguồn |
|---|---|---|
| Máy chủ web | Microsoft-IIS/10.0 | Tiêu đề `Server` |
| Nền tảng | ASP.NET Web Forms, .NET Framework 4 (`X-AspNet-Version: 4.0.30319`, `X-Powered-By: ASP.NET`) | Tiêu đề phản hồi; trang `.aspx`, `__VIEWSTATE`, `__EVENTVALIDATION`, `__doPostBack` |
| Bộ điều khiển giao diện | Telerik UI for ASP.NET AJAX bản 2025.1.416.462, giao diện (skin) `Bootstrap`: RadScriptManager, RadAjaxManager, RadAjaxPanel, RadAjaxLoadingPanel, RadComboBox, RadTabStrip | Đường dẫn `Telerik.Web.UI.WebResource.axd`, lệnh `$create(Telerik.Web.UI.…)` |
| Thư viện phía trình duyệt | jQuery 2.1.4, Bootstrap 3 (phông glyphicons), toastr (thông báo góc dưới phải), tinyfade (ảnh trình chiếu) | Tệp tải về |
| Mã xác nhận | Ảnh do `CaptchaImage.axd?guid=…` sinh ra, làm mới bằng postback | Yêu cầu mạng |
| Tường lửa ứng dụng | Imperva Incapsula (`_Incapsula_Resource`, cookie `___utmvc`, `___utmvm`, `TBMCookie_…`) | Yêu cầu mạng, cookie |
| Phiên làm việc | Cookie `ASP.NET_SessionId`; cookie riêng `NAM_HOC`, `MA_SO_GD` lưu năm học và mã Sở đã chọn | Kho cookie |

### 9.3 Cách trang đăng nhập hoạt động (quan sát)

1. Một biểu mẫu `form1` duy nhất gửi lại chính trang (postback). Thẻ `form` có lớp `SoGD-79`; 79 là mã tỉnh của TP.HCM.
2. Hai thẻ đăng nhập (RadTabStrip): đăng nhập SSO và tài khoản QLTH. Trường ẩn `isDangNhapSSO` quyết định phím Enter bấm nút nào. Mã trang có tên các nút `btnDangNhapSSOHcm`, `btLoginIDP`, `btLoginVNEID`, tức là có ba kiểu đăng nhập liên kết: SSO của Sở TP.HCM, một nhà cung cấp định danh (IdP) khác và VNeID.
3. Bốn ô chọn nối tầng: Năm học (giá trị `2026`, `2025`, bị khóa) → Cấp học (`01` Mầm non đến `05`) → Phường/Xã (169 mục) → Trường. Đổi một ô thì RadAjaxManager gửi postback không đồng bộ để nạp lại các ô sau. Ô Phường/Xã dùng mã đơn vị hành chính cấp xã 5 chữ số theo danh mục mới (ví dụ `26732` Đặc khu Côn Đảo). Ô Trường có tính năng lọc khi gõ.
4. Danh sách trường của cấp Mầm non được nhúng sẵn trong trang: 4.839 mục, mỗi mục ghi tên, mã trường trong ngoặc và phường/xã. Mã trường dài 8 chữ số (2.828 mục), 10 chữ số (1.787), 9 (145), 12 (11), 7 (7), 11 (1). Tên bắt đầu bằng "Lớp", "Trường", "MN", "LMG", "Nhóm", "LMN", "NT", tức là danh sách gồm cả trường, nhóm trẻ và lớp mầm non độc lập.
5. Trang đăng nhập nặng khoảng 2,1 MB: riêng `__VIEWSTATE` khoảng 1,16 MB (giải mã base64 được 867 KB dữ liệu không đọc được, nhiều khả năng đã mã hóa), thêm một đoạn mã nội tuyến khoảng 410 KB chứa dữ liệu các ô chọn.
6. Kiểm tra dữ liệu bằng bộ kiểm tra của Web Forms (RequiredFieldValidator: "Thông tin bắt buộc", "Nhập mật khẩu"). Có ô "Ghi nhớ tài khoản" mặc định được tích.
7. "Quên mật khẩu" yêu cầu chọn Sở GD&ĐT, Phường/Xã, Cấp học, Đơn vị, nhập tài khoản, email và mã xác nhận. "Đăng nhập năm cũ" (`LoginTruongSapNhap.aspx`) là trang đăng nhập riêng cho năm học 2025-2026, có thêm ô chọn tỉnh/thành, dùng cho dữ liệu trước sáp nhập địa giới.
8. `robots.txt` trả về 404.

### 9.4 Suy luận

1. Đây là sản phẩm dùng chung cho nhiều Sở: trang Quên mật khẩu có ô "Chọn sở", trang có lớp `SoGD-79`, cookie `MA_SO_GD`, đường dẫn ảnh `images/CSDLDiaPhuong/HoChiMinh/`. Mỗi Sở có thể có tên miền và bộ ảnh riêng trên cùng mã nguồn.
2. Dữ liệu năm học được tách theo năm (trang đăng nhập năm cũ riêng, cookie `NAM_HOC`), tương tự cách School Management tách cơ sở dữ liệu theo năm học.
3. Màn hình nghiệp vụ phía sau đăng nhập nhiều khả năng cũng là Web Forms dùng RadGrid của Telerik (lưới có cấu hình cột, số dòng 10–200, xuất Excel/PDF như mục 2.3). Mã dùng chung `main.js` có các hàm xử lý RadGrid (`keyDownRadgrid`, `RepaintGrid`, `setCssTotalRadGrid`), mục 9.8 xác nhận màn hình 2.1 dùng RadGrid.

### 9.5 Bài học cho School Management

| Số | Quan sát ở hệ thống của Sở | Áp dụng cho School Management |
|---|---|---|
| 1 | Nhúng toàn bộ 4.839 trường và ViewState lớn vào trang đăng nhập, trang nặng 2,1 MB | Giữ cách tải danh sách đơn vị theo yêu cầu, có lọc ở máy chủ và phân trang; không nhúng danh mục lớn vào trang |
| 2 | Chọn năm học, cấp học, phường/xã, trường ngay khi đăng nhập | Giữ cách hiện tại: đăng nhập trước, chọn đơn vị và năm học sau trong ô ngữ cảnh (YCTD-101) |
| 3 | Mã phường/xã 5 chữ số theo danh mục hành chính mới | Dùng cùng mã khi làm đợt 15h chuyển địa danh hành chính, để dữ liệu nhập/xuất khớp với hệ thống của Sở |
| 4 | Cookie `ASP.NET_SessionId`, `NAM_HOC`, `MA_SO_GD` không có cờ `Secure`; tiêu đề lộ phiên bản ASP.NET; trang HTML trả `Access-Control-Allow-Origin: *` | Giữ cookie mã làm mới `HttpOnly`, `Secure`, `SameSite=Strict` (BM-71); khi triển khai, kiểm tra máy chủ không trả tiêu đề lộ phiên bản và CORS chỉ cho nguồn được phép (đối chiếu `22_BAO_MAT.md`) |
| 5 | jQuery 2.1.4 (đã hết hỗ trợ) | Giữ quy trình cập nhật thư viện và kiểm tra lỗ hổng phụ thuộc |
| 6 | Liên kết tải TeamViewer, UltraViewer qua `http://` từ máy chủ bên thứ ba ở chân trang | Kênh hỗ trợ dùng biểu mẫu "Gửi phản hồi" (đợt 15g), không đặt liên kết tải tệp chạy từ nguồn ngoài |
| 7 | Có ba kiểu đăng nhập liên kết (SSO Sở, IdP, VNeID) | Ghi nhận cho giai đoạn sau; hiện chưa có giao diện lập trình của Sở (G3-09) |

### 9.6 Trang chủ sau đăng nhập (quan sát thụ động)

1. Eric tự đăng nhập trên một cửa sổ Chrome riêng mở cổng gỡ lỗi cục bộ; REA chỉ đọc trang đang mở (`Default.aspx`, phân hệ Quản lý giáo dục Mầm Non), không điều hướng, không bấm, không chạy mã trên trang. Mã bằng chứng: `ev_45c7080f…c8862b9661`. Giá trị cookie, kho lưu trữ, nội dung mạng không được giữ lại.
2. Trang tải 25 đoạn mã, khoảng 1,35 MB, trong đó gói mã Telerik gộp khoảng 845 KB. Thư viện thêm so với trang đăng nhập: lodash, js.cookie, SweetAlert, Bootstrap 3 JS. Bộ điều khiển Telerik dùng thêm: RadMenu (menu ngang), RadWindow, RadWindowManager (cửa sổ bật lên trong trang).
3. Menu ngang đánh số là RadMenu nhận cây mục từ máy chủ; mỗi mục có một mã menu dạng số (ví dụ 80251, 178696), trùng với cây "Phân quyền nhóm theo menu" ở mục 7. Mã nhỏ (80xxx) là chức năng cũ, mã lớn (178xxx) là chức năng thêm sau sáp nhập địa giới (phân hiệu, tách trường, cập nhật đơn vị quản lý, tài khoản SSO học sinh). Phân hệ Mầm non có 6 nhóm, 72 màn hình có đường dẫn:

| Mục | Mã menu | Đường dẫn |
|---|---|---|
| 1.1 | 80251 | `/MN/HoSoTruongDetail.aspx` |
| 1.2 | 178696 | `/MN/QuanLyPhanHieu.aspx` |
| 1.3 | 178697 | `/QuanLyDiemTruongPhanHieu.aspx` |
| 1.4 | 164680 | `/MN/CaiDatTruongHoc.aspx` |
| 1.5 | 178217 | `/XaNQ76/CapNhatDonViQuanLy.aspx` |
| 1.6.1 | 178478 | `/MN/QuanLyTaiKhoanDongBo.aspx` |
| 1.6.2 | 178479 | `/MN/QuanLyTaiKhoanDongBoSoGD.aspx` |
| 1.7 | 178319 | `/baocao/MN/kiemdinhchatluong.aspx` |
| 1.8.1 | 178714 | `/PhanTachHoSo/DanhSachYeuCauChuyenTruong.aspx` |
| 1.8.2 | 178715 | `/PhanTachHoSo/DanhSachYeuCauChuyenTruongDen.aspx` |
| 2.1 | 161598 | `/MN/Lop.aspx` |
| 2.2 | 161599 | `/MN/LopImportExcel.aspx` |
| 3.1.1 | 80260 | `/MN/DSGiaoVien.aspx` |
| 3.1.2 | 178698 | `/QuanLyNhanSuPhanHieu.aspx` |
| 3.1.3 | 80262 | `/MN/GiaoVienImportExcel.aspx` |
| 3.1.4 | 161784 | `/MN/TimKiemHoSoGiaoVien.aspx` |
| 3.1.5 | 176699 | `/LienThongDanCu/MN/NhanSuDongBoSoDinhDanhCaNhan.aspx` |
| 3.2.1 | 163283 | `/MN/TimKiemDanhGiaGiaoVien.aspx` |
| 3.2.2 | 163284 | `/MN/ImportKetQuaChuanNNExcel.aspx` |
| 3.3 | 163785 | `/MN/phancongchunhiem.aspx` |
| 3.4.1 | 175050 | `/ThoiKhoaBieu/MN/QuanLyTKBTuanHoc.aspx` |
| 3.5.1 | 176146 | `/MN/NhapThongTinNhanSuChuyenDen.aspx` |
| 3.5.2 | 176147 | `/MN/NhapThongTinNhanSuChuyenDi.aspx` |
| 3.5.3 | 178257 | `/MN/NhapThongTinNhanSuThinhGiangTruongDi.aspx` |
| 3.5.4 | 178266 | `/MN/NhapThongTinNhanSuThinhGiangTruongDen.aspx` |
| 4.1.1 | 141188 | `/MN/DSHocSinh.aspx` |
| 4.1.2 | 141189 | `/MN/HocSinhImportExcel.aspx` |
| 4.1.3 | 141190 | `/MN/SapXepHocSinh.aspx` |
| 4.1.4 | 161840 | `/MN/TraCuuHoSoKQHTHocSinh.aspx` |
| 4.1.5 | 163888 | `/MN/CapnhatSDThocsinh.aspx` |
| 4.1.6 | 174984 | `/MN/NhomHocSinh.aspx` |
| 4.1.7 | 174985 | `/MN/GhepHocSinhNhom.aspx` |
| 4.1.8 | 176519 | `/MN/ThuThapThongDinhDanhCDHocSinh.aspx` |
| 4.1.9 | 176708 | `/LienThongDanCu/MN/HocSinhDongBoSoDinhDanhCaNhan.aspx` |
| 4.1.10 | 178528 | `/SSO/MN/QuanLyTaiKhoanHocSinhSSO.aspx` |
| 4.1.11 | 178203 | `/MN/CapNhatDiaDanhHanhChinhHocSinh.aspx` |
| 4.1.12 | 164465 | `/MN/CapNhatTieuChiDSHocSinh.aspx` |
| 4.2.1 | 141192 | `/MN/ChuyenLop.aspx` |
| 4.2.2 | 163844 | `/MN/QuanLyHocSinhChuyenDenChuyenDiThoiHoc.aspx` |
| 4.2.3 | 163845 | `/MN/nhapthongtinhocsinhchuyenden.aspx` |
| 4.2.4 | 163846 | `/MN/nhapthongtinhocsinhchuyendi.aspx` |
| 4.3.1 | 163579 | `/MN/NhapCanNang.aspx` |
| 4.3.2 | 164516 | `/MN/TongHopKetQuaSucKhoeNuoiDuong.aspx` |
| 4.4 | 100368 | `/MN/XetHoanThanhChuongTrinhMamNon.aspx` |
| 4.5 | 175245 | `/ThucDonBuaAn/MN/DanhMucThucDonBuaAn.aspx` |
| 4.6.1 | 176176 | `/giaoducthechat/mn/nhapthongtinsuckhoehocsinh.aspx` |
| 5.1 | 161645 | `/MN/ThongKeLopHoc.aspx` |
| 5.2.1 | 161651 | `/MN/ThongKeGiaoVienTheoTrinhDoDaoTao.aspx` |
| 5.2.2 | 161652 | `/MN/ThongKeCBQL_GV_NV.aspx` |
| 5.2.3 | 163000 | `/MN/ThongKeNhanSuTheoHinhThucHopDong.aspx` |
| 5.2.4 | 163230 | `/MN/BaoCaoCNG_CNN_CBQL_TongHop.aspx` |
| 5.2.5 | 163223 | `/MN/BaoCaoCNG_CNN_TongHop.aspx` |
| 5.3.1 | 161842 | `/MN/ThongKeTongHopSoLuongHocSinh.aspx` |
| 5.3.2 | 161843 | `/MN/ThongKeTreEmTrongDoTuoi.aspx` |
| 5.3.3 | 161844 | `/MN/ThongKeHocSinhHoanThanhCTMN.aspx` |
| 5.3.4 | 161845 | `/MN/ThongKeHocSinhDienChinhSach.aspx` |
| 5.3.5 | 164433 | `/MN/ThongKeHocSinhBenhVeMatBietBoi.aspx` |
| 5.3.6 | 177761 | `/VuGiaoDucDanToc/BaoCaoThongKeHocSinhDanToc.aspx` |
| 5.3.7 | 177813 | `/MN/TimKiemHocSinhThieuThongTin.aspx` |
| 5.4.1 | 175268 | `/MN/DanhSachMaDinhDanh.aspx` |
| 5.5 | 176785 | `/MN/ThongKeTienDoNhapThongTinCaNhan.aspx` |
| 5.6 | 176786 | `/MN/ThongKeTienDoNhapThongTinCaNhanGiaoVien.aspx` |
| 5.7 | 163317 | `/MN/ChuyenHoSoLenNamHocMoiV2.aspx` |
| 5.8 | 177978 | `/MN/ThongKeHocSinhChuaHoanThanhNhapDuLieu.aspx` |
| 5.9.1 | 177987 | `/MN/ThongKeNhanSuChuaHoanThanhNhapDuLieu.aspx` |
| 5.9.2 | 177988 | `/MN/ThongKeHocSinhChuaHoanThanhNhapDuLieu.aspx` |
| 5.10.1 | 178153 | `/HoSoTaiLieu/mn/BaoCaoHoSoTaiLieuHoanThanh.aspx` |
| 5.10.2 | 178154 | `/HoSoTaiLieu/mn/BaoCaoHoSoTaiLieuChuaHoanThanh.aspx` |
| 5.10.3 | 178163 | `/hoSoTaiLieu/MN/BaoCaoHoSoTaiLieuLuuTru.aspx` |
| 5.11 | 178626 | `/tiepNhanHoSo/MN/TiepNhanHoSoHocSinhTuyenSinh.aspx` |
| 6.1 | 177531 | `/MN/BaoCaoThucTrangPhongHocNhaCongVu.aspx` |
| 6.2 | 178075 | `/VuCoSoVatchat/MN/NhapLieuCoSoVatChat.aspx` |

4. Đường dẫn chia thư mục theo mảng nghiệp vụ: `MN/` (màn hình cấp Mầm non), `LienThongDanCu/` (đồng bộ số định danh với CSDL dân cư), `SSO/`, `PhanTachHoSo/` (tách trường), `XaNQ76/` (đơn vị quản lý cấp xã sau sắp xếp), `ThoiKhoaBieu/`, `ThucDonBuaAn/`, `HoSoTaiLieu/`, `tiepNhanHoSo/`, `VuCoSoVatchat/`, `VuGiaoDucDanToc/`, `giaoducthechat/`, `baocao/`. Một số màn hình dùng chung cho mọi cấp học nằm ở gốc (`QuanLyDiemTruongPhanHieu.aspx`, `QuanLyNhanSuPhanHieu.aspx`).
5. Gọi máy chủ không qua postback dùng phương thức trang của ASP.NET (`Trang.aspx/TenHam`, gửi và nhận JSON, kết quả nằm trong `d`):
   - `ApiKySo.aspx/Authentication`: lấy mã truy cập dịch vụ ký số;
   - `SysGetTokenViewFile.aspx`: lấy mã một lần để mở tệp trong RadWindow, ví dụ học bạ số dạng XML qua `HocBaViewXML.aspx?chuc_nang=ckdt|hbs&maGuid=…`;
   - `WebServicesExtend.aspx/CheckHasInvalid`: đếm học sinh có dữ liệu chưa hợp lệ (`TOTAL_INVALID_HOC_SINH`), gọi đồng bộ (chặn trang) trước khi cho thao tác tiếp;
   - `VerifyAccountEnv.aspx`: xác thực tài khoản, có đếm ngược rồi chuyển trang.
6. `main.js` (khoảng 90 KB) là thư viện dùng chung cho mọi cấp học: chỉnh chiều cao lưới, nhảy ô khi nhập trên lưới (cookie `is_jump_col` lưu lựa chọn "nhảy cột/nhảy dòng"), kiểm tra giá trị nhập theo từng loại đánh giá (điểm 0–10, hạnh kiểm, xếp loại theo Thông tư 22, VNEN…), kiểm tra số điện thoại, CCCD phụ huynh, hộ chiếu học sinh, cộng tổng dòng/cột, khóa ô, khóa dòng. Có cờ `hdSmisBaseEdu` chọn bố cục lưới mới.
7. `sapnhap.js` đổi chữ ngay trên trình duyệt sau khi trang hiện ra: "Phòng GD&ĐT" thành "UBND Xã", "Trưởng phòng" thành "Chủ tịch"… khi trường thuộc diện sáp nhập. Nghĩa là nhãn ở máy chủ chưa đổi, chỉ thay khi hiển thị.

### 9.7 Bài học bổ sung cho School Management

| Số | Quan sát | Áp dụng |
|---|---|---|
| 8 | Cây menu và cây phân quyền là một, mỗi mục một mã | DT-15 hiển thị mã quyền theo cây menu kiểu Sở; giữ mã quyền dạng `module.action`, không dùng mã số |
| 9 | Đổi nhãn sau sáp nhập bằng thay chữ trên trình duyệt | Đợt 15h đổi tên đơn vị hành chính ở dữ liệu và danh mục, không thay chữ ở giao diện |
| 10 | Kiểm tra dữ liệu chưa hợp lệ trước khi thao tác bằng lệnh gọi chặn trang | Dùng thông báo không chặn, kèm danh sách cần sửa (tương tự "Thống kê hồ sơ chưa nhập đủ", mục 8.3 số 3) |
| 11 | Đường dẫn và số mục ổn định cho từng màn hình | Dùng bảng ở mục 9.6 khi đặt số mục, tên màn hình của các đợt 15d, 15f, 15h |

### 9.8 Màn hình 2.1 Hồ sơ lớp học (quan sát thụ động)

1. Eric tự mở `/MN/Lop.aspx` trên cửa sổ Chrome gỡ lỗi; REA chỉ đọc cấu trúc trang và mã, không đọc văn bản trên lưới, không ghi nội dung mạng. Mã bằng chứng: `ev_69a5cdf9…f7835a2`. Không ghi tên lớp, tên giáo viên hay giá trị khóa vào tài liệu.
2. Lưới là một RadGrid (`RadGrid1`), khóa dòng là cột `ID` (số nguyên), cho chọn nhiều dòng, chọn bằng cách kéo chuột, tiêu đề cột cố định khi cuộn, sửa bằng biểu mẫu (`EditMode: EditForms`). Phân trang bật, 50 dòng mỗi trang, 10 nút số trang, thanh phân trang luôn hiện; không dùng đếm ảo (`VirtualItemCount` bằng 0), không lọc theo cột, không sắp xếp nhiều cột. Có phím tắt bàn phím của Telerik (Insert, Delete, Enter, Esc, mũi tên).
3. Cột của lưới theo thứ tự (tên trường dữ liệu; "ẩn" là cột có nhưng không hiện mặc định, người dùng bật ở "Cấu hình cột hiển thị"):

| Thứ tự | Cột | Kiểu | Hiện mặc định |
|---|---|---|---|
| 1 | `STT` | mẫu | có |
| 2 | `chkChon` (ô chọn dòng) | chọn | có |
| 3 | `EditCommandColumn` (Sửa) | lệnh | có |
| 4 | `MA_PHAN_HIEU` | dữ liệu | ẩn |
| 5 | `TEN_PHAN_HIEU` | dữ liệu | ẩn |
| 6 | `MA_GIAO_VIEN_CHU_NHIEM` | dữ liệu | ẩn |
| 7 | `MA` (mã lớp) | dữ liệu | có |
| 8 | `TEN` (tên lớp) | dữ liệu | có |
| 9 | `MA_KHOI` | dữ liệu | ẩn |
| 10 | `TEN_KHOI` (nhóm lớp) | mẫu | có |
| 11 | `MA_NHOM_TUOI_MN` | dữ liệu | ẩn |
| 12 | `TEN_NHOM_TUOI_MN` (nhóm tuổi) | mẫu | có |
| 13 | `THU_TU` | dữ liệu | có |
| 14 | `HO_TEN` (giáo viên chủ nhiệm) | dữ liệu | ẩn |
| 15 | `IS_DAY_2_BUOI_NGAY` | mẫu (ô tích) | có |
| 16 | `IS_LOP_GHEP_2_TUOI` | mẫu (ô tích) | ẩn |
| 17 | `IS_LOP_GHEP_3_TUOI` | mẫu (ô tích) | ẩn |
| 18 | `IS_LOP_GHEP` | mẫu (ô tích) | có |
| 19 | `GHEP_VAO_LOP` | mẫu | có |
| 20 | `ID_LOP_GHEP` | dữ liệu | ẩn |
| 21 | `IS_BAN_TRU` | mẫu (ô tích) | có |
| 22 | `TRANG_THAI` (lớp giải thể) | mẫu | có |
| 23 | `MA_DIEM_TRUONG` | dữ liệu | ẩn |
| 24 | cột mẫu cuối (Hồ sơ) | mẫu | có |

4. Ô lọc trên lưới: Phân hiệu (`rcbPhanHieu`), Khối (`rcbKhoi`), Nhóm tuổi (`rcbNhomTuoi`); đổi ô nào thì RadAjaxManager gửi postback không đồng bộ để nạp lại lưới. Nút có trên trang: `btnOK`, `btnDongBoKy2` (đồng bộ học kỳ II), ô xác nhận `chkDelete` của hộp thoại xóa. Mọi thao tác đều là postback của Web Forms, trang này không gọi giao diện lập trình JSON.
5. "Mở rộng tìm kiếm" chỉ ẩn/hiện khối lọc thêm trên trình duyệt (`Open_ShowExtentFilter`). Xuất tệp chạy bằng postback trả về tệp tải xuống; trong lúc chờ, trang hiện màn hình chờ và cứ mỗi giây kiểm tra cookie `downloadStarted` do máy chủ đặt để tắt màn hình chờ.

### 9.9 Đối chiếu màn hình 2.1 với School Management (đợt 15b)

| Số | Hệ thống của Sở | School Management |
|---|---|---|
| 1 | 24 cột, 10 cột ẩn mặc định, người dùng bật thêm. Hiện mặc định Lớp ghép, Ghép vào lớp, Lớp giải thể; ẩn mặc định Phân hiệu, Giáo viên chủ nhiệm, Điểm trường, Lớp ghép 2/3 độ tuổi | Lưới dữ liệu chung có cấu hình cột hiển thị (đợt 15a), nhưng `ClassesPage.tsx` đang làm ngược: hiện Phân hiệu, Giáo viên chủ nhiệm, Điểm trường; ẩn Lớp ghép, Ghép vào lớp, Lớp giải thể. Nên đổi cờ ẩn mặc định cho giống Sở |
| 2 | Phân trang, mặc định 50 dòng | Số dòng mặc định của lưới chung là 20 khi người dùng chưa chọn; nên đặt mặc định 50 dòng cho 2.1 để giống Sở |
| 3 | Lọc theo Phân hiệu, Khối, Nhóm tuổi, nạp lại cả lưới | Giữ ô lọc tương ứng; nạp lại lưới qua API, bỏ qua phản hồi cũ |
| 4 | Xuất tệp bằng postback, theo dõi bằng cookie | Giữ cách tải tệp qua API; tác vụ lớn chạy nền như mục 2.3 |
| 5 | Có nút đồng bộ học kỳ II | Chưa có; chỉ cần khi liên thông với CSDL ngành (G3-09) |

### 9.10 Việc còn lại

- Chưa quan sát màn hình nhập Excel, tác vụ nền và "Tệp đã tạo"; cách làm như mục 9.8 (Eric tự mở màn hình, Claude chỉ đọc).
