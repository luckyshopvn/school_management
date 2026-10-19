# 31. KHẢO SÁT HỆ THỐNG THÔNG TIN QUẢN LÝ GIÁO DỤC CỦA SỞ GD&ĐT TP.HCM

- Mô tả: Kết quả khảo sát chi tiết chức năng và giao diện của Hệ thống thông tin quản lý giáo dục (cấp Trường, Mầm non) tại `truong.hcm.edu.vn`, đối chiếu với hệ thống School Management và đề xuất bổ sung; mục 9 phân tích kỹ thuật bằng REA (trang công khai, trang chủ và màn hình 2.1 sau đăng nhập); mục 10 là khảo sát bổ sung ngày 2026-10-19 (Tuyển sinh đầu cấp, mẫu nội dung hồ sơ kí, chỉ tiêu và mã số các biểu EMIS, 1.7 kiểm định) và đối chiếu với mã nguồn.
- Phiên bản: 1.2
- Ngày cập nhật: 2026-10-19
- Trạng thái: Đã khảo sát
- Người khảo sát: Claude, theo yêu cầu của Eric ngày 2026-10-13

## 1. Phạm vi và cách khảo sát

1. Eric đăng nhập bằng tài khoản quản trị đơn vị của một trường mầm non; Claude chỉ đọc giao diện trong phiên đó: mở menu, tải từng trang bằng yêu cầu xem, đọc tiêu đề, ô lọc, ô nhập, tên cột, tên nút, thẻ. Không bấm Lưu, Xóa, Gửi, Lấy dữ liệu, Tạo hồ sơ; không đổi năm học.
2. Không ghi dữ liệu cá nhân hay số liệu của trường vào tài liệu này; chỉ ghi tên chức năng và cấu trúc màn hình.
3. Đã khảo sát ngày 2026-10-13: 6 phân hệ, 98 màn hình có đường dẫn. Khi đó chưa xem được phân hệ Tuyển sinh đầu cấp và nội dung chỉ tiêu của các biểu báo cáo EMIS; ngày 2026-10-19 đã xem cả hai, kết quả ở mục 10. Phân hệ Hồ sơ điện tử vẫn không xem được (có trong phân quyền, không có trong ô chọn phân hệ của tài khoản này; mục 10.6).

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

## 10. Khảo sát bổ sung ngày 2026-10-19

### 10.1 Phạm vi và cách khảo sát

1. Cách làm như mục 1: Eric đăng nhập; Claude chỉ đọc giao diện (menu, tiêu đề, ô lọc, ô nhập, tên cột, tên nút, thẻ, nhãn trong hồ sơ). Không bấm Lấy dữ liệu, Ghi, Gửi, Tạo hồ sơ, Ký, Chuyển hồ sơ hay nút ghi nào khác.
2. Chỉ ghi tên chức năng, cấu trúc màn hình, tên mục trong hồ sơ, tên và mã số chỉ tiêu của biểu mẫu. Không ghi tên trường, mã trường, tên người hay số liệu.
3. Phạm vi: phân hệ Tuyển sinh đầu cấp (mục 10.2); nội dung bốn loại hồ sơ của phân hệ Quản lý kí hồ sơ (mục 10.3); tên, mã số chỉ tiêu của Biểu 01.ĐN-MN và các biểu EMIS khác, trang gửi báo cáo (mục 10.4); màn hình 1.7 Rà soát thông tin phục vụ kiểm định CLGD (mục 10.5); kiểm tra lại phân hệ Hồ sơ điện tử (mục 10.6). Mục 10.7 đối chiếu với mã nguồn của School Management.

### 10.2 Phân hệ Tuyển sinh đầu cấp

#### 10.2.1 Giao diện chung

- Trang riêng `truong-tsdc.hcm.edu.vn`, đăng nhập riêng: tên đăng nhập, mật khẩu, chọn đơn vị (cấp học, phường/xã, trường), mã xác nhận, ghi nhớ tài khoản, quên mật khẩu, nút "Đăng nhập SSO".
- Hệ thống chính chỉ mở phân hệ này ở học kỳ II của năm học cũ.
- Thanh đầu trang: cấp học, năm học và học kỳ, Đổi mật khẩu, Thoát. Mọi trang có biểu mẫu "Gửi phản hồi" như mục 2.2.
- Phân hệ Mầm non của hệ thống chính có thêm 5.11 "Danh sách trúng tuyển Tuyển sinh đầu cấp" (mục 3.5).

#### 10.2.2 Menu

| Mục | Màn hình | Đường dẫn |
|---|---|---|
| 1.1 | Hồ sơ học sinh cuối cấp mầm non | `TuyenSinhDauCap/mn/HoSoTuyenSinh.aspx` |
| 1.2 | Gửi xác nhận hoàn thành hồ sơ cuối cấp lên cấp trên | `TuyenSinhDauCap/mn/XacNhanHoanThanhHoSoCuoiCap.aspx` |
| 1.3 | Danh sách học sinh đăng ký trường tiên tiến | `TuyenSinhDauCap/MN/DanhSachHSDangKyTruongTienTien.aspx` |
| 1.4 | Tiếp nhận hồ sơ tuyển sinh | `TuyenSinhDauCap/mn/HoSoTuyenSinhSauPhanTuyen.aspx` |
| 1.5 | Gửi thông báo tuyển sinh đầu cấp | `TuyenSinhDauCap/mn/GuiThongBaoTuyenSinhDauCap.aspx` |
| 1.6 | Chuyển hồ sơ trúng tuyển sang CSDL | `TuyenSinhDauCap/mn/TiepNhanHoSoTuyenSinhLenNamMoi.aspx` |
| 1.7 | Danh sách kết quả chuyển hồ sơ | `TuyenSinhDauCap/MN/DanhSachKetQuaChuyenHoSo.aspx` |
| 1.8 | Thông tin trường tuyển sinh theo bản đồ GIS | `TuyenSinhDauCap/ThongTinTruongTuyenSinh.aspx` |
| 2.1 | Các dịch vụ được đăng ký tại trường | `TuyenSinhDauCap/SoGD/HCM/DichVuTruong.aspx` |
| 3.1 | Nhóm người dùng | `TuyenSinhDauCap/NguoiDung/DSNhomQuyen.aspx` |
| 3.2 | Danh sách người dùng | `TuyenSinhDauCap/NguoiDung/DSNguoiDung.aspx` |
| 3.3 | Danh sách nhân sự | `TuyenSinhDauCap/NguoiDung/DSNhanSu.aspx` |
| 3.4 | Danh sách lớp | `TuyenSinhDauCap/Lop/DSLop.aspx` |
| 4.1 | Thống kê hồ sơ cuối cấp | `TuyenSinhDauCap/ThongKeSoLuongHoSoTuyenSinh.aspx` |
| 5.1 | Danh sách hỗ trợ tuyển sinh | `TuyenSinhDauCap/SoGD/HCM/PhuHuynhGuiPhanAnh.aspx` |

Nhóm 1.1, 1.2, 4.1 lo hồ sơ của trẻ lớp Lá (5 tuổi) chuẩn bị vào lớp 1; phụ huynh xác nhận hồ sơ trên cổng phụ huynh. Nhóm 1.3 đến 1.7 lo hồ sơ trẻ được phân tuyến vào trường.

#### 10.2.3 Hồ sơ cuối cấp (1.1, 1.2, 4.1)

| Mục | Nội dung chính |
|---|---|
| 1.1 | Nhãn: hạn điều chỉnh thông tin, kiểm dò, diện cư trú, xem theo (A–Z toàn trường hoặc A–Z theo lớp). Lọc: lớp, số định danh, họ tên, trạng thái kiểm dò (đủ, thiếu thông tin), loại định danh (đã có số ĐDCN, chưa có, đã cấp số tạm), trạng thái hồ sơ (sáu giá trị: PHHS chưa xác nhận, chờ đơn vị chỉnh sửa, chờ PHHS xác nhận lại, PHHS đã xác nhận, đã chỉnh sửa, PHHS đã xác nhận sau chỉnh sửa), nguồn đăng ký (PHHS đăng ký, phổ cập đăng ký, chưa đăng ký), trạng thái rà soát (đã, chưa duyệt), vị trí (có, không), đồng ý nhập học (đã, chưa). Cột: mã định danh, họ tên, ngày sinh, giới tính, mật khẩu, nơi sinh, lớp, số định danh cá nhân (do công an phường/xã cấp), nơi ở hiện tại (theo VNeID), xem vị trí, thông tin liên hệ, nội dung kiểm dò, PHHS đề xuất, trạng thái hồ sơ, trạng thái duyệt, PHHS đăng ký, giấy khai sinh, ảnh thông tin cư trú trên VNeID (hoặc giấy xác nhận cư trú), trường phân tuyến, PH đồng ý nhập học, minh chứng, đối tượng, hình thức ưu tiên, số nhà, đường, tổ, khu phố, phường/xã, tỉnh/thành phố. Nút: Tìm kiếm, Cập nhật từ Excel, Xác nhận hồ sơ, Đã chỉnh sửa thông tin, Duyệt hồ sơ, Hủy duyệt hồ sơ, Xuất Excel, Thông tin tài khoản, Khởi tạo mật khẩu, sáu nút Xuất PDF (khổ A5 hoặc A4 gập đôi; toàn bộ hoặc hồ sơ chọn; một tệp hoặc tách tệp), Tải danh sách lỗi, In phiếu kê khai, In phiếu thông tin |
| 1.2 | Lưới theo lớp: tổng số hồ sơ cuối cấp, số hồ sơ đủ thông tin trên tổng số, hồ sơ thiếu thông tin. Ô "Xác nhận hoàn thành hồ sơ cuối cấp", người xác nhận, ngày xác nhận; nút Ghi |
| 4.1 | Theo đơn vị: tổng số hồ sơ cuối cấp đã lấy sang tuyển sinh đầu cấp, số hồ sơ thiếu thông tin, tỷ lệ hồ sơ đủ thông tin (%); Xuất Excel |

#### 10.2.4 Tuyển sinh vào trường (1.3 đến 1.7, 5.11)

| Mục | Nội dung chính |
|---|---|
| 1.3 | Lọc: số định danh, họ tên, trường duyệt và xã/phường đồng ý (trúng tuyển, không trúng tuyển, chưa xác nhận). Cột: thông tin học sinh, nơi sinh, thông tin cuối cấp, số ĐDCN, nơi ở hiện tại (VNeID), họ tên cha, mẹ, số điện thoại, loại trường, tên trường, tiêu chí, kết quả học tập và thành tích, ngày đăng ký, ảnh minh chứng, trạng thái trường, trạng thái xã/phường, đồng ý nhập học, trường, lớp, tổ, khu phố, phường/xã, tỉnh/thành phố. Nút: Tìm kiếm, Xóa, Xuất Excel, In phiếu, Tải minh chứng, Xác nhận hồ sơ, Không đồng ý, Chưa xác nhận |
| 1.4 | Nhận hồ sơ được phân tuyến về trường. Lọc: đợt tuyển sinh, trường cuối cấp, diện cư trú, phường, khu phố, số ĐDCN, họ tên, ngày sinh, họ tên cha, mẹ; bốn lọc đã/chưa: PH đồng ý nhập học, nộp giấy báo nhập học, nộp phiếu kê khai, nộp giấy khai sinh. Cột: thông tin học sinh, số ĐDCN, nơi ở hiện tại, liên hệ, hồ sơ nhập học, phường/xã và trường cuối cấp, giấy khai sinh, ảnh cư trú VNeID, minh chứng, địa chỉ (tổ, khu phố, phường/xã, tỉnh); ô tích giấy tờ đã nộp (giấy báo nhập học, phiếu kê khai, bản sao giấy khai sinh, học bạ tiểu học, giấy xác nhận hoàn thành chương trình tiểu học – mẫu dùng chung các cấp); phụ huynh đồng ý, từ chối nhập học. Nút: Tìm kiếm, Lưu dữ liệu, Xuất Excel, Tải phiếu thông tin, Hủy nhập học, In phiếu đăng ký, Mở rộng tìm kiếm |
| 1.5 | Hai khối "Soạn nội dung tin nhắn" và "Danh sách người nhận". Lọc: loại hình (đại trà, tiên tiến, khảo sát), phân tuyến (đã, chưa), có số điện thoại, đã gửi thông báo, PH đồng ý nhập học, phường/xã, khu phố, số ĐDCN, họ tên. Cột: số ĐDCN, họ tên, ngày sinh, giới tính, số điện thoại, nội dung gửi, cuối cấp, mã của Bộ. Nút: Tìm kiếm, Gửi thông báo, Nhập từ Excel, Nhập từ Excel học sinh ngoài hệ thống, Sao chép nội dung |
| 1.6 | Hai thẻ "Đồng bộ hồ sơ sang CSDL", "Xem kết quả đồng bộ". Lọc: đã/chưa chuyển, loại hồ sơ (có tài khoản, tự do), nơi ở hiện nay (tỉnh, phường/xã, khu phố), mã gói tin, họ tên hoặc số ĐDCN. Cột: mã học sinh, họ tên, số ĐDCN, giới tính, ngày sinh, chuyển hồ sơ sang CSDL, tự do, điểm trường, tỉnh thường trú, nơi ở hiện nay, phường/xã, khu phố, tổ. Lưới kết quả: mã học sinh, họ tên, số ĐDCN, kết quả, ghi chú. Nút: Tìm kiếm, Cập nhật, Chuyển hồ sơ sang CSDL (hộp xác nhận), Xuất Excel, Bảng kết quả, Mở rộng tìm kiếm; có hộp hỏi xóa lớp đã xếp. Số dòng mỗi trang 100 đến 1000 |
| 1.7 | Hai thẻ "Danh sách kết quả chuyển hồ sơ", "Xem kết quả hủy nhập học". Lọc: họ tên, mã học sinh, số ĐDCN, loại hồ sơ, mã gói tin, mã GUID. Cột: mã học sinh, họ tên, số ĐDCN, giới tính, ngày sinh, lớp cuối cấp, tự do, điện thoại liên hệ, xếp lớp, mã GUID. Lưới kết quả: mã GUID, kết quả, ghi chú. Nút: Tìm kiếm, Hủy nhập học (hộp xác nhận), Xuất Excel |
| 5.11 (hệ thống chính) | Bước 1 xếp lớp học sinh trúng tuyển; bước 2 chuyển sang hồ sơ học sinh (mục 3.5) |

#### 10.2.5 Các màn hình còn lại

| Mục | Nội dung chính |
|---|---|
| 1.8 | Thông tin trường: tên, vĩ độ, kinh độ, tỉnh/thành phố, phường/xã, khu phố (bắt buộc), điện thoại, địa chỉ; Cập nhật, Tìm kiếm, Xác nhận. Lưới điểm trường: mã, tên, địa chỉ, kinh tuyến, vĩ tuyến, xem vị trí, trạng thái kiểm dò |
| 2.1 | Dịch vụ đăng ký tại trường: mã, tên, thứ tự; Tìm kiếm, Thêm mới, Xóa, Xuất Excel |
| 3.1 | Nhóm người dùng: sửa, phân quyền, mã, tên, hiệu lực, là nhóm quản trị; Thêm mới, Xóa |
| 3.2 | Danh sách người dùng: lọc mã nhân sự, họ tên, nhóm quyền; cột mã nhân sự, họ tên, tên đăng nhập, nhóm quyền, tài khoản gốc; Phân nhóm quyền, Ghi, Tìm kiếm, Đồng bộ dữ liệu, Xóa, Xuất Excel |
| 3.3 | Danh sách nhân sự: lọc mã định danh, họ tên, điện thoại; cột mã định danh, họ tên, ngày sinh, giới tính, điện thoại, chức vụ; Đồng bộ dữ liệu, Xóa, Xuất Excel |
| 3.4 | Danh sách lớp: lọc khối; cột tên lớp, khối, thứ tự, giáo viên chủ nhiệm; Đồng bộ dữ liệu, Xóa |
| 5.1 | Hỗ trợ tuyển sinh (phụ huynh gửi phản ánh): lọc họ tên, số ĐDCN, trạng thái; cột họ tên, ngày sinh, số ĐDCN, email, điện thoại, nội dung đề xuất, ngày gửi, nội dung trả lời, trạng thái, người trả lời, thời gian trả lời; Tìm kiếm, Cập nhật, Gửi email, Xuất Excel |

### 10.3 Phân hệ Quản lý kí hồ sơ: chi tiết

#### 10.3.1 Menu và chứng thư số

- Menu: 1.1 Quản lý chứng thư số nhà trường (`ChuKyDienTu/MN/DanhMucConDau.aspx`); 2.1 Đồng bộ chứng thư số (`KyHoSo/GuiDuLieuChungThuSo.aspx`); 2.2 Ký số hồ sơ gồm Ký hồ sơ trường, lớp, nhân sự, học sinh (`KyHoSo/HoSoTruong.aspx`, `HoSoLop.aspx`, `HoSoNhanSu.aspx`, `HoSoHocSinh.aspx`; mục học sinh Sở đánh nhầm số 2.3.4); 2.3 Xác nhận hoàn thành và gửi hồ sơ (`KyHoSo/XacNhanHoanThanh.aspx`).
- 1.1 và 2.1: hướng dẫn, mã trường, tên trường, email, website, trạng thái chữ ký, kiểu chữ ký, nhà phát hành, tên đăng nhập, trạng thái đồng bộ với Bộ (2.1 thêm trạng thái đồng bộ), thông tin đăng ký, lịch sử yêu cầu đăng ký chứng thư số.
- Biểu mẫu đăng ký: kiểu chữ ký (bắt buộc; hai giá trị REMOTE SIGNING, USB TOKEN), tên đăng nhập (bắt buộc), nhà phát hành (bắt buộc; năm giá trị VNPT-CA, BkavCA, VIETTEL, Ban Cơ yếu Chính phủ, MISA), mật khẩu, lý do.
- Nút 1.1: Đăng ký tài khoản, Chỉnh sửa ảnh, Chọn ảnh, Tải ảnh con dấu, Ghi, Đăng ký. Nút 2.1: Đăng ký.

#### 10.3.2 Ký hồ sơ (2.2) và gửi (2.3)

| Màn hình | Nội dung chính |
|---|---|
| 2.2 chung | Nút: Tải file lỗi, Tải thông tin thay đổi, Hủy hồ sơ, Ký hồ sơ, Tạo hồ sơ. Hộp kí: nhà phát hành, tên đăng nhập, mật khẩu, Ký số, Đăng nhập và ký. Trạng thái thấy được: "Chưa tạo hồ sơ", "Chờ ký". Số dòng mỗi trang 10, 20, 50, 100 |
| Lưới trường | Mã trường, tên trường, tên hiệu trưởng, trạng thái, xem hồ sơ, tệp hồ sơ, ngày tạo, ngày ký, ghi chú, ngày thay đổi |
| Lưới lớp | Lọc khối (nhóm trẻ, lớp mẫu giáo). Lớp, khối, trạng thái, xem hồ sơ, tệp hồ sơ, ngày tạo, ngày ký, ghi chú, ngày thay đổi |
| Lưới nhân sự | Mã nhân sự, họ tên, ngày sinh, trạng thái nhân sự, vị trí việc làm, trạng thái, xem hồ sơ, tệp hồ sơ, ngày tạo, ngày ký, ghi chú, ngày thay đổi |
| Lưới học sinh | Lọc khối, lớp. Mã học sinh, tên học sinh, ngày sinh, lớp, trạng thái học sinh, trạng thái, xem hồ sơ, tệp hồ sơ, ngày tạo, ngày ký, ghi chú, ngày thay đổi |
| Xem hồ sơ | Cửa sổ "Xem hồ sơ ký": bên trái "Thông tin chữ ký số"; bên phải nội dung hồ sơ dựng từ tệp XML theo mã định danh hồ sơ và loại hồ sơ (`HO_SO_TRUONG`, `HO_SO_LOP`, `HO_SO_NHAN_SU`, `HO_SO_HOC_SINH`); phóng to, Tải xuống, In |
| Sổ đầu bài | Nút "Ký sổ đầu bài", "Xuất dữ liệu sổ đầu bài" có trong trang nhưng bị ẩn ở cấp Mầm non: cấp Mầm non không kí sổ đầu bài |
| 2.3 | Nút: Tìm kiếm, Xác nhận hoàn thành, Hủy xác nhận hoàn thành, Gửi hồ sơ ("Xuất dữ liệu sổ đầu bài" bị ẩn). Cột: tên trường, tên hiệu trưởng, trạng thái, xem hồ sơ, tệp hồ sơ, xác nhận hoàn thành, trạng thái gửi, mã định danh hồ sơ, ghi chú, ngày xác nhận hoàn thành, xác nhận gửi, ngày gửi |

#### 10.3.3 Nội dung bốn loại hồ sơ (tên mục, không có giá trị)

| Hồ sơ | Phần và mục |
|---|---|
| Hồ sơ trường | Phần "Thông tin chung": tên trường, mã trường, mã định danh tổ chức (theo NĐ 69), điện thoại, fax, website, email, mã số thuế, loại hình trường, loại trường, tên và điện thoại hiệu trưởng; tỉnh, phường/xã, địa chỉ, khu vực, chi bộ đảng, chuẩn quốc gia mức độ, vùng, vùng đặc biệt khó khăn, diện tích (m²); các ô có/không: trường quốc tế, có học sinh khuyết tật, có học sinh bán trú, có dạy 2 buổi/ngày, dùng máy vi tính phục vụ quản lý và giáo dục trẻ, có điện lưới, kết nối Internet, có công trình vệ sinh, có chỗ rửa tay thuận tiện (nước và xà phòng), có nguồn nước sạch, có chương trình giáo dục về giới tính, phòng chống bạo lực, xâm hại. Mỗi điểm trường một phần "Thông tin điểm trường": tên, mã, địa chỉ, điện thoại, diện tích, phương tiện đi lại, khoảng cách đến trường chính (km) |
| Hồ sơ lớp | Tên trường, mã trường, khối, tên lớp, mã và tên phân hiệu, điểm trường; lớp dạy tăng cường tiếng Việt, lớp ghép, tên lớp ghép, nhóm trẻ ghép, bán trú, học 2 buổi, dạy chương trình làm quen tiếng Anh, có trẻ khuyết tật, chương trình giáo dục mầm non mới, chương trình chăm sóc giáo dục. Không có danh sách học sinh, giáo viên |
| Hồ sơ nhân sự | Mười hai phần: thông tin chung; vị trí việc làm, tiêu chuẩn chức danh; phụ cấp; quy trình đào tạo; đánh giá, phân loại; đánh giá chuẩn nghề nghiệp (giáo viên); quá trình lương; quá trình bồi dưỡng; quá trình ngoại ngữ; quá trình khen thưởng; quan hệ gia đình; quá trình công tác. Thông tin chung: tên trường, họ tên, ngày sinh, đoàn viên, đảng viên, giới tính, số sổ BHXH, trạng thái cán bộ, nơi thường trú (tỉnh, xã, chi tiết), số CMND/CCCD, điện thoại, email, số định danh cá nhân, dân tộc, tôn giáo, quê quán. Vị trí việc làm: vị trí, cấp dạy, biên chế cấp dạy chính, dạy nhóm lớp, dạy nhóm lớp kiêm nhiệm, đã tập huấn kĩ năng sống, dạy học sinh khuyết tật hòa nhập, số buổi dạy/ngày, nhóm chức vụ, hình thức hợp đồng, ngày và cơ quan tuyển dụng, nghề nghiệp khi tuyển, mã số, ngạch/hạng. Phụ cấp: thu hút, thâm niên, ưu đãi nghề, hệ số phụ cấp chức vụ, phần trăm vượt khung, mã và tên bậc lương, hệ số lương, ngày hưởng lương. Đào tạo: kết quả bồi dưỡng thường xuyên, chuyên ngành chính, khác, trình độ chính, khác, lý luận chính trị, quản lý giáo dục, ngoại ngữ chính, trình độ ngoại ngữ, chứng chỉ ngoại ngữ (nhóm, loại), điểm, khung năng lực. Đánh giá: đánh giá viên chức/công chức, danh hiệu phong tặng, giáo viên dạy giỏi. Bảng: chuẩn nghề nghiệp (tiêu chí, mức tự đánh giá, mức cấp trên), lương, đào tạo/bồi dưỡng, ngoại ngữ, khen thưởng, quan hệ gia đình, quá trình công tác |
| Hồ sơ học sinh | Phần "Thông tin chung": tên trường, khối, tên lớp, mã và tên phân hiệu; họ tên, ngày sinh, giới tính, trạng thái, dân tộc, dân tộc khai sinh, quốc tịch, điện thoại liên hệ; số CMND/CCCD, số định danh cá nhân, ngày cấp, nơi cấp; quê quán (tỉnh, xã, tổ thôn), nơi thường trú (tỉnh, xã, chi tiết), chỗ ở hiện nay, nơi sinh, khu vực; loại khuyết tật, đối tượng chính sách, có cha dân tộc, có mẹ dân tộc, bán trú. Phần "Thông tin gia đình": tên, nghề nghiệp, năm sinh của cha, mẹ, người đỡ đầu |

### 10.4 Báo cáo số liệu Mầm non: chỉ tiêu và mã số

#### 10.4.1 Menu và nút

| Mục | Lập | Gửi |
|---|---|---|
| 1.1 Báo cáo EMIS đầu năm | 1.1.1 `MN/BaoCaoMNBieu1.aspx` | 1.1.2 `baocao/mn/baocaoemisdaunam.aspx` |
| 1.2 Báo cáo cơ sở vật chất | 1.2.1 `MN/BaoCaoHCM_CSVC_PhongHoc.aspx` | 1.2.2 `MN/BaoCaoHCM_CSVC_GuiDuLieu.aspx` |
| 1.3 Báo cáo sức khỏe học sinh | 1.3.1 `GiaoDucTheChat/mn/LapBaoCaoSoLieu.aspx` | 1.3.2 `baocao/mn/BaoCaoGiaoDucTheChatDauNam.aspx` |
| 2.1 Báo cáo EMIS cuối năm | 2.1.1 `MN/BaoCaoMNBieu1_CN.aspx` | 2.1.2 `baocao/mn/baocaoemiscuoinam.aspx` |
| 2.2 Báo cáo đội ngũ | 2.2.1 Tổng hợp chung CBQL – giáo viên; 2.2.2 Tổng hợp ngoại ngữ – tin học; 2.2.3 Chuẩn nghề nghiệp nhân sự | 2.2.4 |
| 2.3 Báo cáo đề án ngoại ngữ | 2.3.1 Thống kê số trường, số trẻ (`MN/DANN_BieuBaoCao.aspx`) | 2.3.2 |
| 2.4 Báo cáo GDMN | 2.4.1 Lập báo cáo cuối năm (`VuGiaoDucMamNon/BaoCaoCuoiNamBieu1.aspx`); trống ở học kỳ I | 2.4.2 |

- Trang lập: "Lấy dữ liệu" (1.1.1 ghi "Lấy dữ liệu từ hệ thống"), "Xóa dữ liệu", "Xuất Excel". 2.3.1 có thêm "Ghi" và ghi chú "Chỉ tiêu số 5: thầy/cô nhập trực tiếp vào cột Tổng số". 1.2.1 có "Lấy dữ liệu năm trước", "Xóa dữ liệu", "Ghi", "Xuất Excel".
- Trang gửi: "Gửi hồ sơ", "Xuất file lỗi", "Xuất file lỗi 4", "Đặt trạng thái gửi lại", "Hủy", "Thực hiện". 1.2.2 chỉ có "Gửi dữ liệu".

#### 10.4.2 Biểu 01.ĐN-MN (1.1.1): năm thẻ

Các dòng ghi dạng TT, chỉ tiêu, mã số, đơn vị. Mã số đánh liên tục 01 đến 217 qua bốn thẻ đầu (thẻ 4 mở đầu bằng dòng Tổng số mã 201); thẻ 5 đánh lại từ 1.

| Thẻ | Cột giá trị | Nhóm chỉ tiêu (mã số) |
|---|---|---|
| 1. Trường – Lớp | Tổng số, Công lập, Tư thục, Dân lập | I. Cơ sở giáo dục mầm non: 1.1 Trường (01); 1.1.1 Nhà trẻ (02), trong đó trường có điện, kết nối internet, dùng máy vi tính phục vụ quản lý và giáo dục trẻ, có nước uống, hệ thống vệ sinh tiện lợi, chỗ rửa tay thuận tiện (03–08); 1.1.2 Trường mẫu giáo (09), trong đó đạt chuẩn quốc gia mức độ 1, mức độ 2, có lớp giáo dục chuyên biệt, có điện, internet, máy vi tính, nước uống, vệ sinh tiện lợi và riêng theo giới, chỗ rửa tay (nước và xà phòng), chương trình giáo dục về giới tính và phòng chống bạo lực, xâm hại, kế hoạch phòng chống thiên tai và ứng phó biến đổi khí hậu (10–20); 1.1.3 Trường mầm non (21), cùng các dòng con như 1.1.2 (22–32); 1.2 Cơ sở GDMN độc lập (33): nhóm trẻ độc lập tối đa 7 trẻ, trên 7 trẻ, lớp mẫu giáo độc lập, lớp mầm non độc lập (34–37); 1.3 Số phân hiệu (38); 1.4 Số điểm trường (39). II. Nhóm, lớp: tổng số (40); 2.1 Nhóm trẻ (41) chia 3–12, 13–24, 25–36 tháng, ghép 2, ghép 3 độ tuổi, độc lập tối đa 7, trên 7 trẻ, có 01, có 02 trẻ khuyết tật học hòa nhập (42–50); 2.2 Lớp mẫu giáo (51) chia 3–4, 4–5, 5–6 tuổi, lớp giáo dục chuyên biệt, ghép 2, ghép 3 độ tuổi, lớp MG độc lập, lớp MN độc lập, có 01, có 02 trẻ khuyết tật hòa nhập (52–61) |
| 2. Trẻ em | Tổng số (Tổng, Nữ), Dân tộc thiểu số (Tổng, Nữ) | 3.1 Quy mô trẻ (62): 3.1.1 nhà trẻ (63) gồm học 2 buổi/ngày, bán trú (có tổ chức ăn trưa), khuyết tật học hòa nhập, học trong nhóm trẻ, lớp mầm non độc lập (64–67); 3.1.2 mẫu giáo (68) gồm học 2 buổi, bán trú, khuyết tật hòa nhập, khuyết tật học lớp chuyên biệt, học trong lớp MG, MN độc lập, học lớp MG 5 tuổi (69–74). 3.2 Theo độ tuổi: 3.2.1 nhà trẻ (75) chia 3–12, 13–24, 25–36 tháng, 3, 4, 5, trên 5 tuổi (76–82); 3.2.2 mẫu giáo (83) chia dưới 2, 2, 3, 4, 5, 6, 7, trên 7 tuổi (84–91); 3.2.3 tổng quy mô theo độ tuổi (92) chia dưới 1, dưới 2, 2 đến 7, trên 7 tuổi (93–101). 3.3 Dinh dưỡng: nhà trẻ được khám và đánh giá (102) chia suy dinh dưỡng thể nhẹ cân, thấp còi, còi cọc, thừa cân béo phì (103–106); mẫu giáo (107) chia như trên (108–111). 3.4 Đối tượng chính sách: hỗ trợ chi phí học tập (Điều 17 NĐ 238/2025) (112), nhà trẻ bán trú (NĐ 66/2025/NĐ-CP) (113), mẫu giáo dân tộc rất ít người (NĐ 57/2017/NĐ-CP) (114), mẫu giáo được hỗ trợ ăn trưa (NĐ 105/2020/NĐ-CP) (115), mầm non được hưởng trợ cấp (NĐ 105/2020/NĐ-CP) (116) |
| 3. Đội ngũ | Tổng số, Nữ, Dân tộc, Phân loại (Viên chức, Hợp đồng lao động, HĐLV không xác định thời hạn, HĐLV xác định thời hạn) | 4.1 Cán bộ quản lý (117): 4.1.1 nhà trẻ (118) gồm hiệu trưởng, phó hiệu trưởng, trình độ trung cấp SP, cao đẳng, đại học, thạc sĩ, tiến sĩ, khác (119–126); 4.1.2 mẫu giáo, mầm non (127), cùng các dòng con (128–135). 4.2 Vị trí chức danh nghề nghiệp chuyên ngành (136): 4.2.1 giáo viên nhà trẻ (137) gồm trình độ trung cấp đến tiến sĩ, chưa qua đào tạo, hạng I, II, III, độ tuổi 20–29, 30–39, 40–49, 50–59, từ 60, kiêm nhiệm hỗ trợ giáo dục người khuyết tật, kiêm nhiệm vị trí chuyên môn dùng chung (138–153); 4.2.2 giáo viên mẫu giáo (154), cùng các dòng con (155–170); 4.2.3 hỗ trợ giáo dục người khuyết tật (171) tại nhà trẻ, trường MG, trường MN (172–174). 4.3 Vị trí chuyên môn dùng chung (175): nhà trẻ (176) gồm văn thư, kế toán, thủ quỹ, thư viện, y tế trường học, kiêm nhiệm 2 hoặc 3 vị trí (177–182); mẫu giáo, mầm non (183), cùng các dòng con (184–189). 4.4 Vị trí hỗ trợ, phục vụ (190): nhà trẻ (191) gồm nấu ăn, phục vụ, bảo vệ, khác (192–195); mẫu giáo, mầm non (196), cùng các dòng con (197–200) |
| 4. Cơ sở vật chất | Tổng số, Kiên cố, Bán kiên cố, Tạm | Tổng số phòng (201). 5.1 Nhà trẻ: phòng học (nuôi, dạy, chăm sóc trẻ) (202), trong đó nhờ, mượn (203); phòng giáo dục thể chất, giáo dục nghệ thuật (204) gồm GDTC, GDNT, phòng đa năng (205–207); sân chơi riêng (208, đơn vị sân); phòng tin học (209). 5.2 Mẫu giáo: cùng các dòng (210–217) |
| 5. Ngân sách nhà nước | Dự toán, Ước thực hiện (triệu đồng) | Tổng chi các nguồn thuộc NSNN (1). I. Chi đầu tư (2): vốn đầu tư từ ngân sách địa phương (3), trong cân đối ngân sách địa phương (4) gồm cấp tỉnh quản lý (5), cấp xã quản lý (7), vốn trái phiếu chính quyền địa phương (8); nguồn vốn ngân sách trung ương (9) gồm chương trình mục tiêu quốc gia, chương trình mục tiêu, ODA, trái phiếu Chính phủ, ngân sách khác (10–14). II. Chi thường xuyên (15): 1. Giáo dục mầm non (16) chia theo nguồn (NSNN, phí và lệ phí để lại, khác: 17–19) và theo nhóm chi (thanh toán cá nhân, hàng hóa dịch vụ, hỗ trợ và bổ sung, khác: 20–23); các mục 2 đến 7 lặp cùng cách chia, trong đó 6. Đào tạo khác trong nước (56–63), 7. Đào tạo lại, bồi dưỡng nghiệp vụ cho cán bộ, công chức, viên chức (64–71) |

Ghi chú: ghi chép thẻ 5 không có mã 6; tên các mục 2 đến 5 của chi thường xuyên (mã 24–55) chưa ghi, chỉ biết cách chia giống mục 1.

#### 10.4.3 Gửi báo cáo đầu năm (1.1.2)

- Lưới 1, hồ sơ cần gửi: chọn, tên hồ sơ, tổng số, số đã gửi thành công, số cần gửi, lần gửi cuối, trạng thái, hành động. Năm dòng: hồ sơ trường, hồ sơ giáo viên, hồ sơ lớp, hồ sơ học sinh, sức khỏe nuôi dưỡng kỳ I.
- Lưới 2, biểu mẫu: biểu mẫu báo cáo, ngày gửi, trạng thái, hoàn thành dữ liệu ("Đã đầy đủ dữ liệu", "Không có dữ liệu"), trạng thái dữ liệu. Năm dòng: Biểu 01.ĐN-MN Trường – nhóm, lớp; Biểu 01.ĐN-MN Trẻ em; Biểu 01.ĐN-MN Đội ngũ; Biểu 01.ĐN-MN Phòng học; Biểu 08.ĐN-NSNN Ngân sách nhà nước.

#### 10.4.4 Báo cáo cơ sở vật chất của TP.HCM (1.2.1, 1.2.2)

- Năm thẻ: 1. Cơ sở vật chất, 2. Nhà vệ sinh, 3. Cơ sở vật chất khác, 4. Thiết bị dạy học, 5. Thông tin khác. Thẻ 2 đến 5 chỉ tải khi bấm vào thẻ, chưa đọc.
- Thẻ 1, cột: Tổng số; Kiên cố (Tổng số, Xây dựng mới); Bán kiên cố (Tổng số, Xây dựng mới); Tạm. Mã số 01 đến 84:

| Khối (mã) | Dòng |
|---|---|
| A. Khối phòng nuôi dưỡng, chăm sóc trẻ (01) | Chia nhà trẻ (02), mẫu giáo (08); mỗi phần: số phòng theo chức năng, phòng học (nuôi, dạy, chăm sóc trẻ), phòng vệ sinh, phòng ngủ, phòng khác |
| B. Khối phòng phục vụ học tập (14) | Số phòng theo chức năng, thư viện, phòng giáo dục thể chất, phòng đa chức năng (nghệ thuật), phòng khác; chia nhà trẻ (thêm phòng giáo dục nghệ thuật) và mẫu giáo (thêm phòng hỗ trợ giáo dục hòa nhập) |
| C. Khối phòng tổ chức ăn (35) | Số phòng, nhà bếp, nhà kho, phòng khác; chia nhà trẻ, mẫu giáo |
| D. Khối phòng khác (50) | Phòng y tế, khu vệ sinh giáo viên, khu vệ sinh học sinh (trong đó bố trí trong lớp học); chia nhà trẻ, mẫu giáo |
| E. Khối phòng hành chính quản trị (68) | Phòng hiệu trưởng, phó hiệu trưởng, văn phòng, phòng họp, phòng hành chính quản trị, phòng bảo vệ, phòng truyền thống, nhà công vụ giáo viên, phòng nhân viên, nhà kho, phòng khác |
| F. Khối công trình công cộng (81) | Nhà xe giáo viên, phòng khác |

- 1.2.2 Gửi: biểu mẫu, ngày gửi, trạng thái, hoàn thành dữ liệu; mỗi thẻ một dòng.

#### 10.4.5 Các biểu khác

| Biểu | Cấu trúc |
|---|---|
| 1.3.1 Sức khỏe đầu năm | Cột Học sinh (Tổng số, Nữ, Dân tộc); nhóm I. Trường, II. Học sinh, III. Nhân viên y tế. Dòng chi tiết chỉ hiện sau khi Lấy dữ liệu, chưa ghi |
| 2.1.1 EMIS cuối năm | Cột STT, mã, nội dung, đơn vị. I Trường: nhà trẻ, trường mẫu giáo, trường mầm non, nhóm trẻ độc lập, lớp mẫu giáo độc lập, nhóm trẻ và lớp MG độc lập, số điểm trường. II Nhóm, lớp: nhóm trẻ, lớp mẫu giáo. III Trẻ em: quy mô (nhà trẻ, mẫu giáo, trong đó 5–6 tuổi); dinh dưỡng của nhà trẻ, mẫu giáo được khám (nhẹ cân, thấp còi, còi cọc, thừa cân béo phì). VI (Sở ghi VI, mục con đánh 4.x) Cán bộ quản lý, giáo viên, nhân viên: hiệu trưởng, phó hiệu trưởng (nhà trẻ; MG, MN); giáo viên nhà trẻ, mẫu giáo theo đánh giá chuẩn nghề nghiệp (tốt, khá, đạt, chưa đạt); giáo viên nghỉ hưu, tuyển mới trong năm (trong đó nữ); nhân viên (trong đó nữ) |
| 2.2.1 Tổng hợp chung CBQL – giáo viên | Cột Tổng số, Nữ. Thẻ "1. Cán bộ quản lý": tổng số trường, lớp; cán bộ quản lý, hiệu trưởng, phó hiệu trưởng, mỗi khối chia trình độ (trung cấp, cao đẳng, đại học, thạc sĩ, tiến sĩ, khác), độ tuổi (dưới 31, 31–35, 36–40, 41–45, 46–50, 51–55, 56–60, khác), hạng chức danh (hạng II, III, IV, hạng I, II, III theo TT01, khác), kết quả đánh giá viên chức theo NĐ 90 (hoàn thành xuất sắc, tốt, hoàn thành, không hoàn thành). Thẻ "2. Giáo viên – Nhân viên": số trường, lớp, giáo viên theo nhóm dạy (nhà trẻ, mẫu giáo), trình độ, hạng, kết quả đánh giá, giáo viên dạy giỏi (cấp trường, huyện, tỉnh, toàn quốc); nhân viên (văn thư, kế toán, y tế, thủ quỹ, khác) |
| 2.2.2 Ngoại ngữ – tin học | Cột Tổng số, Nữ. Thẻ CBQL (CBQL, hiệu trưởng, phó hiệu trưởng): ngoại ngữ theo khung 6 bậc (bậc 1–6, khác), tin học (cơ bản, nâng cao, khác). Thẻ giáo viên: ngoại ngữ (trên đại học, đại học, cao đẳng, khác, khung 6 bậc), tin học (trên đại học, đại học, cao đẳng, trung cấp, chứng chỉ cơ bản, nâng cao, khác) |
| 2.2.3 Chuẩn nghề nghiệp | Thẻ CBQL: tổng số lớp; hiệu trưởng tự đánh giá, phó hiệu trưởng tự đánh giá, cấp trên đánh giá phó hiệu trưởng, mỗi khối có xếp loại chung và tiêu chí 1–18. Thẻ giáo viên: lớp, giáo viên; giáo viên tự đánh giá, cấp trên đánh giá, mỗi khối có xếp loại chung và tiêu chí 1–15 |
| 2.3.1 Đề án ngoại ngữ | Năm chỉ tiêu: 1. tổng số trường mầm non; 2. số trường cho trẻ mẫu giáo làm quen tiếng Anh; 3. tổng số trẻ; 4. số trẻ được làm quen tiếng Anh; 5. số giáo viên tham gia (nhập tay vào cột Tổng số) |
| 2.4.1 GDMN cuối năm | Trống ở học kỳ I, chưa có cấu trúc |

### 10.5 Màn hình 1.7 Rà soát thông tin phục vụ kiểm định CLGD

- Đường dẫn `baocao/MN/kiemdinhchatluong.aspx`; nút Lấy dữ liệu, Ghi.
- Trường: tên trường (bắt buộc, tối đa 200 ký tự), mã trường (bắt buộc, tối đa 20 ký tự), loại hình (bắt buộc), cấp học, số lớp; năm, ngày công nhận chuẩn quốc gia, mức độ; năm, ngày công nhận kiểm định chất lượng giáo dục, cấp độ; số phòng học, số phòng bộ môn; diện tích đất (m²), diện tích sàn xây dựng (m²); số học sinh, diện tích đất trên học sinh (m²), diện tích sàn xây dựng trên học sinh (m²); thời điểm đăng ký chuẩn quốc gia; ghi chú "Trường chưa đạt tiêu chí nào, lý do và nội dung đề nghị hỗ trợ để đạt chuẩn" (tối đa 500 ký tự).

### 10.6 Hồ sơ điện tử

- Ô chọn phân hệ của tài khoản có 6 phân hệ: Quản lý giáo dục Mầm Non, CSVC-TBDH, Tuyển sinh đầu cấp, Báo cáo số liệu Mầm non, Quản lý kí hồ sơ, Quản trị hệ thống.
- "Hồ sơ điện tử" chỉ có trong 1.2 Phân quyền nhóm theo phần mềm: tài khoản trường chưa được cấp phần mềm này, không xem được màn hình, không khảo sát thêm được.

### 10.7 Đối chiếu với mã nguồn School Management (ngày 2026-10-19)

#### 10.7.1 Báo cáo số liệu EMIS (DT-16 phần 16j, YCTD-129; `apps/api/src/emis`, `apps/api/src/facilities/emis-calc.ts`, `packages/shared/src/emis.ts`)

| Số | Hệ thống của Sở | School Management |
|---|---|---|
| E1 | Biểu 01.ĐN-MN năm thẻ: Trường – Lớp, Trẻ em, Đội ngũ, Cơ sở vật chất, Ngân sách nhà nước | Sáu thẻ: Trường – lớp học, Học sinh, Học sinh theo độ tuổi, Đội ngũ, Phòng học, Ngân sách nhà nước; độ tuổi tách thẻ riêng |
| E2 | Mã số 01 đến 217 liên tục, khoảng 217 dòng | Mã tự đặt theo thẻ (1.01 đến 5.11), khoảng 38 dòng; tên chỉ tiêu tự đặt, có cảnh báo "cần đối chiếu" |
| E3 | Cột khác nhau theo thẻ (thẻ 1 chỉ theo loại hình; thẻ 2 có Tổng, Nữ cho tổng số và cho dân tộc thiểu số; thẻ 3 có bốn cột phân loại hợp đồng; thẻ 4 Kiên cố, Bán kiên cố, Tạm) | Một bộ sáu cột cho mọi thẻ (tổng số, công lập, tư thục, dân lập, nữ, dân tộc thiểu số) |
| E4 | Biểu 08.ĐN-NSNN: hai cột Dự toán, Ước thực hiện; mã 1 đến 71 theo nguồn vốn và nhóm chi | Ba cột (quyết toán năm trước, dự toán, ước thực hiện); sáu dòng 6.01 đến 6.06 |
| E5 | Chỉ tiêu cần: tiêu chí trường (điện, nước uống, vệ sinh, rửa tay, chuẩn quốc gia mức độ), nhóm lớp ghép, độc lập, có trẻ khuyết tật; trẻ học 2 buổi, bán trú; dinh dưỡng theo thể; đối tượng chính sách theo NĐ 238/2025, 66/2025, 57/2017, 105/2020; đội ngũ theo trình độ, hạng chức danh, độ tuổi, kiêm nhiệm, vị trí việc làm, loại hợp đồng; sân chơi, phòng tin học | Phần lớn dữ liệu đã có ở hồ sơ trường (16e), lớp (15b), học sinh (16g), cân đo (16h), nhân sự theo danh mục Bộ (16f), phòng (16i) nhưng Biểu 1 chưa dùng; chưa có danh mục đối tượng chính sách theo từng nghị định |
| E6 | 1.2.1 cơ sở vật chất của TP.HCM: sáu khối A đến F, mã 01 đến 84; cột Kiên cố, Bán kiên cố có thêm "Xây dựng mới" | Khối, loại phòng theo danh mục của mình (mã CS.x.yy); cột có nhờ mượn, diện tích, không có xây dựng mới. Thẻ 2 đến 5 tự đặt (của Sở chưa đọc) |
| E7 | 2.1 cuối năm: I Trường, II Nhóm lớp, III Trẻ em, VI Cán bộ – giáo viên – nhân viên (chuẩn nghề nghiệp, nghỉ hưu, tuyển mới) | Sáu mục I đến VI tự đặt (có kết quả giáo dục, cơ sở vật chất; chưa có nghỉ hưu, tuyển mới, giáo viên theo mức chuẩn nghề nghiệp) |
| E8 | 2.2 đội ngũ: ba biểu (tổng hợp chung có bốn cách chia; ngoại ngữ – tin học theo khung 6 bậc; chuẩn nghề nghiệp theo từng tiêu chí 1–18, 1–15) | Ba thẻ với cột tự đặt (trình độ gộp, có ngoại ngữ, tiếng Anh, bậc 3 trở lên; số được đánh giá theo mức); chưa có độ tuổi, hạng, đánh giá viên chức, dạy giỏi, theo tiêu chí |
| E9 | 2.3 đề án ngoại ngữ: năm chỉ tiêu, chỉ tiêu 5 nhập tay | Hai thẻ theo nhóm tuổi (số nhóm lớp, số trẻ, trẻ nữ, số tiết/tuần) và giáo viên (của trường, thuê ngoài, người nước ngoài) |
| E10 | 2.4 GDMN cuối năm trống ở học kỳ I | Luôn tính số liệu |
| E11 | Trang gửi 1.1.2: lưới hồ sơ (hồ sơ trường, giáo viên, lớp, học sinh, sức khỏe kỳ I) và lưới biểu (năm dòng theo Biểu 01, 08); nút Gửi hồ sơ, Xuất file lỗi, Đặt trạng thái gửi lại, Hủy, Thực hiện; trang lập có "Xóa dữ liệu" | Danh sách gửi bảy biểu theo màn hình, mỗi biểu một dòng; chưa có lưới hồ sơ, chưa có "Xóa dữ liệu"; trạng thái gửi đánh dấu tay (đúng hướng bản chạy nội bộ) |

#### 10.7.2 Quản lý kí hồ sơ (DT-16 phần 16k, YCTD-130; `apps/api/src/signing`, `apps/portal/src/signing`)

| Số | Hệ thống của Sở | School Management |
|---|---|---|
| K1 | Cấp Mầm non ẩn "Ký sổ đầu bài", "Xuất dữ liệu sổ đầu bài" ở 2.2 và 2.3 | Có thẻ "Sổ đầu bài" theo tháng (điểm danh, hoạt động) và nút Xuất dữ liệu sổ đầu bài: làm thừa so với Sở |
| K2 | Hồ sơ trường: phần thông tin chung theo danh sách mục cố định và một phần cho mỗi điểm trường | In cây đơn vị, sáu thẻ của 1.1 Hồ sơ trường và bảng phân hiệu, điểm trường |
| K3 | Hồ sơ lớp: thông tin lớp và các ô chương trình, lớp ghép; không có danh sách | Thông tin lớp, giáo viên phụ trách, danh sách học sinh |
| K4 | Hồ sơ nhân sự mười hai phần (lương, phụ cấp, đào tạo, ngoại ngữ, khen thưởng, gia đình, công tác, chuẩn nghề nghiệp), có CCCD, số định danh, sổ BHXH | Khoảng 15 mục thông tin chính và lớp phụ trách; cố ý không in số định danh, tài khoản ngân hàng, mã số thuế |
| K5 | Hồ sơ học sinh: thông tin chung (có CCCD, số định danh, ngày cấp, nơi cấp, quê quán, thường trú, dân tộc, quốc tịch, khuyết tật, đối tượng chính sách) và gia đình (tên, nghề nghiệp, năm sinh cha, mẹ, người đỡ đầu) | 13 mục chính và bảng cha mẹ (họ tên, quan hệ, liên hệ chính); không in số định danh, số điện thoại |
| K6 | Kiểu chữ ký hai giá trị (REMOTE SIGNING, USB TOKEN); nhà phát hành chọn trong năm giá trị (VNPT-CA, BkavCA, VIETTEL, Ban Cơ yếu Chính phủ, MISA) | Ba kiểu (thêm HSM); nhà phát hành là ô chữ tự do |
| K7 | 1.1 hiện mã trường, tên trường, email, website; lịch sử yêu cầu đăng ký chứng thư số | Không hiện thông tin trường; có lịch sử thao tác |
| K8 | Xem hồ sơ dựng từ XML theo loại `HO_SO_TRUONG`, `HO_SO_LOP`, `HO_SO_NHAN_SU`, `HO_SO_HOC_SINH`; khung "Thông tin chữ ký số" | Tệp PDF có khối "Xác nhận kí nội bộ"; không có tệp dữ liệu XML |
| K9 | Trạng thái "Chưa tạo hồ sơ", "Chờ ký"; lưới có cột ghi chú và cột riêng theo loại (tên hiệu trưởng; khối; ngày sinh, trạng thái nhân sự, vị trí việc làm; mã học sinh, ngày sinh, lớp, trạng thái học sinh); lọc khối ở lớp, khối và lớp ở học sinh; nút Tải file lỗi | Trạng thái "Đã tạo, chưa kí"; lưới chung một cột thông tin phụ; chưa có cột ghi chú, cột riêng, lọc khối, Tải file lỗi |
| K10 | 2.3 có cột tên trường, tên hiệu trưởng, xác nhận hoàn thành, trạng thái gửi, ngày xác nhận hoàn thành, xác nhận gửi, ngày gửi | Lưới hồ sơ đã kí với mã định danh, trạng thái, ngày gửi; tên cột khác |

#### 10.7.3 Rà soát kiểm định 1.7 (DT-16 phần 16e, YCTD-127; `apps/api/src/facilities/accreditation-review.ts`)

| Số | Hệ thống của Sở | School Management |
|---|---|---|
| R1 | Tên trường, mã trường, loại hình (bắt buộc), cấp học | Không có trên màn hình |
| R2 | Năm, ngày công nhận chuẩn quốc gia, mức độ; năm, ngày công nhận kiểm định CLGD, cấp độ; thời điểm đăng ký chuẩn quốc gia | Không có; hồ sơ trường cũng chưa có các ô này |
| R3 | Hai chỉ số trên học sinh: diện tích đất/học sinh và diện tích sàn xây dựng/học sinh | Một chỉ số (diện tích đất/học sinh) |
| R4 | Diện tích sàn xây dựng | Tính bằng tổng diện tích các phòng đang dùng; ô "Diện tích xây dựng" của hồ sơ trường chưa dùng |
| R5 | Ghi chú tối đa 500 ký tự, nội dung là tiêu chí chưa đạt, lý do, đề nghị hỗ trợ | Ghi chú tối đa 1.000 ký tự, nhãn chung |

#### 10.7.4 Tuyển sinh đầu cấp

- Chưa có phân hệ tương ứng. Đã có phân hệ riêng "Tuyển sinh" (YCTD-86): đợt tuyển sinh, hồ sơ trực tuyến của phụ huynh (nhận, đạt, không đạt, chuyển thành hồ sơ trẻ), tin tuyển sinh; dùng lại được cho 1.4 và 1.6 (chuyển hồ sơ trúng tuyển thành hồ sơ học sinh).
- Chưa có: hồ sơ cuối cấp của trẻ 5 tuổi và luồng phụ huynh xác nhận, đề xuất sửa; kiểm dò thông tin; giấy tờ đính kèm (khai sinh, cư trú VNeID, minh chứng); diện cư trú, trường phân tuyến, đối tượng, ưu tiên; đăng ký trường tiên tiến; gửi thông báo theo danh sách lọc; mã gói tin, mã GUID, kết quả chuyển; tọa độ trường, điểm trường; danh mục dịch vụ tại trường; hỗ trợ tuyển sinh (phụ huynh gửi phản ánh, trường trả lời); thống kê hồ sơ cuối cấp; PDF khổ A5, A4 gập đôi.
- 3.1 đến 3.4 là bản sao người dùng, nhân sự, lớp của hệ thống chính kèm nút "Đồng bộ dữ liệu"; School Management dùng chung một cơ sở dữ liệu nên chỉ cần hiển thị.
