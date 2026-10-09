# 03. DANH SÁCH KIỂM TRA CÔNG VIỆC

- Mô tả: Danh sách công việc, trạng thái và thứ tự ưu tiên của dự án.
- Phiên bản: 0.4
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đang cập nhật

## Quy ước trạng thái

Chỉ dùng năm trạng thái: Chưa bắt đầu, Đang thực hiện, Cần sửa, Bị chặn, Hoàn thành. Việc chờ tài khoản hoặc hạ tầng bên ngoài ghi Bị chặn kèm lý do. Hệ thống lớn làm theo đợt riêng ghi rõ ở cột ghi chú.

## 1. Tiến độ theo phân hệ

| Phân hệ | Trạng thái | Việc còn lại |
|---|---|---|
| P01 Nền tảng, đơn vị và phân quyền | Chưa bắt đầu | Đặc tả đã có; chờ duyệt và chờ mã nguồn |
| P02 Trẻ, phụ huynh và lớp học | Chưa bắt đầu | Đặc tả đã có; chờ duyệt và chờ mã nguồn |
| P03 Giảng dạy | Chưa bắt đầu | Thuộc giai đoạn 2 |
| P04 Điểm danh và chăm sóc hằng ngày | Chưa bắt đầu | Đặc tả đã có; chờ duyệt và chờ mã nguồn |
| P05 Học phí, khoản thu và giảm trừ | Chưa bắt đầu | Đặc tả đã có; chờ duyệt và chờ mã nguồn |
| P06 Tài chính | Chưa bắt đầu | Sổ kế toán kép theo chế độ hành chính, sự nghiệp ở giai đoạn 3 |
| P07 Nhân sự | Chưa bắt đầu | Đặc tả đã có; chờ duyệt |
| P08 Chấm công và tiền lương | Chưa bắt đầu | Đặc tả đã có; chờ duyệt và chờ mã nguồn |
| P09 Công việc, kế hoạch và đánh giá | Chưa bắt đầu | Thuộc giai đoạn 2; thiếu chỉ số đánh giá |
| P10 Y tế học đường | Chưa bắt đầu | Thuộc giai đoạn 2 |
| P11 Xe đưa đón | Đã bỏ | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| P12 Bếp và dinh dưỡng | Chưa bắt đầu | Thuộc giai đoạn 2; định lượng do bếp cấu hình (Q-30) |
| P13 Kho, tài sản và mua hàng | Chưa bắt đầu | Thuộc giai đoạn 2 |
| P14 Hoạt động, nội dung và truyền thông | Chưa bắt đầu | Thuộc giai đoạn 2 |
| P15 Tương tác và ý kiến | Chưa bắt đầu | Thuộc giai đoạn 2 |
| P16 Tuyển sinh | Chưa bắt đầu | Thuộc giai đoạn 3 |
| P17 Báo cáo và bảng điều khiển | Chưa bắt đầu | Đặc tả đã có; chờ duyệt |
| P18 Tuyển dụng | Chưa bắt đầu | Thuộc giai đoạn 3 |
| P19 Kênh truy cập và thông báo | Chưa bắt đầu | Chờ quyết định về bản cài riêng trên điện thoại |

## 2. Việc còn lại

### 2.1 Làm được ngay, mã M<số phân hệ>

| Mã | Công việc | Phân hệ | Trạng thái | Ghi chú |
|---|---|---|---|---|
| M00 | Trả lời câu hỏi mở và xác nhận giả định | Toàn dự án | Hoàn thành | Là điều kiện bắt buộc trước khi xây dựng |
| M00-2 | Phê duyệt phương án lưu trữ nhiều đơn vị và bộ công nghệ | Toàn dự án | Hoàn thành | Chốt ngày 2026-10-09: phương án A (QĐ-02) và bộ công nghệ đề xuất (QĐ-11) |
| M00-3 | Phê duyệt cách xếp ba giai đoạn | Toàn dự án | Hoàn thành | Eric đồng ý ngày 2026-10-09 (Q-07) |
| M00-4 | Xác nhận cây đơn vị thực tế | Toàn dự án | Hoàn thành | Nhà trường tự tạo trong phần Cấu hình; biểu phí dùng chung (Q-113, Q-122) |
| M00-5 | Chốt mức hạn mức phê duyệt theo loại chứng từ | Toàn dự án | Hoàn thành | Để nhà trường cấu hình sau; khi chưa cấu hình Hiệu trưởng duyệt mọi chứng từ (Q-112). Q-123 vẫn mở |
| M01 | Xây dựng nền tảng, cây đơn vị nhiều cấp, tài khoản, vai trò, quyền | P01 | Chưa bắt đầu | Nhiệm vụ đầu tiên của giai đoạn 1 |
| M01-2 | Xây dựng dịch vụ định danh độc lập tự viết | P01 | Chưa bắt đầu | Tách khỏi máy chủ API nghiệp vụ; phụ thuộc M01 |
| M01-3 | Nền móng kỹ thuật DT-00: kho mã nguồn GitHub, cấu trúc nhiều gói, ranh giới giao diện và máy chủ, gói mã dùng chung, môi trường phát triển Docker, tích hợp liên tục chỉ chạy kiểm thử | Toàn dự án | Đang thực hiện | Giao diện chỉ gọi giao diện lập trình ứng dụng; kho https://github.com/luckyshopvn/school_management, nhánh `dt-00-nen-mong`; 6/6 kiểm thử đạt trên máy; chờ commit và GitHub Actions (YCTD-32) |
| M02 | Xây dựng hồ sơ trẻ, phụ huynh, lớp học, phân lớp | P02 | Chưa bắt đầu | Phụ thuộc M01 |
| M04 | Xây dựng điểm danh, báo vắng, đón trả trẻ | P04 | Chưa bắt đầu | Phụ thuộc M02 |
| M05 | Xây dựng học phí, khoản thu, giảm trừ | P05 | Chưa bắt đầu | Phụ thuộc M02 |
| M06 | Xây dựng phiếu thu, phiếu chi, công nợ, quỹ tiền mặt | P06 | Chưa bắt đầu | Phụ thuộc M05 |
| M07 | Xây dựng hồ sơ nhân sự và hợp đồng lao động | P07 | Chưa bắt đầu | Phụ thuộc M01 |
| M08 | Xây dựng chấm công, nghỉ phép, bảng lương | P08 | Chưa bắt đầu | Phụ thuộc M07 |
| M17 | Xây dựng bảng điều khiển và báo cáo cơ bản | P17 | Chưa bắt đầu | Phụ thuộc M04, M05, M08 |
| M19 | Xây dựng ứng dụng phụ huynh và ứng dụng giáo viên | P19 | Chưa bắt đầu | Phụ thuộc M02, M04, M05 |
| M03 | Xây dựng giảng dạy, giáo án, thời khóa biểu | P03 | Chưa bắt đầu | Giai đoạn 2 |
| M09 | Xây dựng công việc, kế hoạch, đánh giá | P09 | Chưa bắt đầu | Giai đoạn 2 |
| M10 | Xây dựng y tế học đường | P10 | Chưa bắt đầu | Giai đoạn 2 |
| M11 | Xây dựng xe đưa đón | P11 | Đã bỏ | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) |
| M12 | Xây dựng bếp, thực đơn, định lượng | P12 | Chưa bắt đầu | Giai đoạn 2 |
| M13 | Xây dựng kho, tài sản, mua hàng | P13 | Chưa bắt đầu | Giai đoạn 2 |
| M14 | Xây dựng hoạt động, tin tức, thư viện, thông báo | P14 | Chưa bắt đầu | Giai đoạn 2 |
| M15 | Xây dựng tương tác, góp ý, bình chọn, khảo sát | P15 | Chưa bắt đầu | Giai đoạn 2 |
| M16 | Xây dựng tuyển sinh trực tuyến | P16 | Chưa bắt đầu | Giai đoạn 3 |
| M18 | Xây dựng tuyển dụng | P18 | Chưa bắt đầu | Giai đoạn 3 |

### 2.2 Tính năng mới, mã N<số>

| Mã | Công việc | Trạng thái | Ghi chú |
|---|---|---|---|
| N1 | Xác thực hai lớp cho Hiệu trưởng, Phó Hiệu trưởng, kế toán trưởng, quản trị nền tảng | Đã bỏ | Bỏ ngày 09/10/2026 theo quyết định của Eric (YCTD-31) |
| N2 | Bản cài riêng trên điện thoại cho phụ huynh | Chưa bắt đầu | Giai đoạn 3, chờ quyết định |
| N3 | Kết nối Facebook và Fanpage để đăng nội dung đã duyệt | Chưa bắt đầu | Giai đoạn 3 |
| N21 | Viết bộ ca kiểm thử chi tiết cho P01, P02 và P04, P05 và P06, P08 (Q-105) | Hoàn thành | Thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`, 437 ca, năm đợt đã duyệt; xem mục 7 |
| N17 | Gửi thông báo và nhắc nợ qua Zalo Official Account | Chưa bắt đầu | Giai đoạn 3 (G3-08), cần T7 |
| N4 | Đối soát thanh toán tự động qua ngân hàng hoặc cổng thanh toán | Chưa bắt đầu | Giai đoạn 3 |
| N5 | Sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp | Chưa bắt đầu | Giai đoạn 3 (G3-06) |
| N6 | Cập nhật bộ tài liệu theo bốn yêu cầu ngày 09/10/2026 | Hoàn thành | Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.2.0 |
| N7 | Lập kế hoạch tổng thể dự án | Hoàn thành | Xem `01_KE_HOACH_TONG_THE.md`; gồm 12 giai đoạn, 12 cổng, 12 đợt, 12 rủi ro |
| N8 | Đổi tên dự án thành School Management | Hoàn thành | Thay 43 chỗ trên 36 tệp; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.3.1 |

### 2.3 Cần tài khoản hoặc hạ tầng bên ngoài

| Mã | Công việc | Cần gì | Trạng thái |
|---|---|---|---|
| T1 | Gửi thông báo và mã đăng nhập một lần qua tin nhắn tới phụ huynh | Tài khoản nhà cung cấp tin nhắn thương hiệu | Bị chặn, cần tài khoản; cần trước khi nghiệm thu P19-06 |
| T2 | Gửi thư điện tử thông báo | Tài khoản gửi thư | Bị chặn, cần tài khoản |
| T3 | Thông báo đẩy trên điện thoại | Khóa dịch vụ thông báo đẩy | Bị chặn, cần tài khoản |
| T4 | Kết nối Facebook và Fanpage | Tài khoản quản trị trang và quyền ứng dụng | Bị chặn, cần tài khoản |
| T5 | Xác nhận chuyển khoản tự động cho thanh toán bằng mã QR | Tài khoản dịch vụ của ngân hàng hoặc đơn vị trung gian, xem Q-142 | Bị chặn, cần tài khoản; cần trước khi nghiệm thu P06-11 ở giai đoạn 1 |
| T6 | Hạ tầng chạy thật | Thuê máy chủ đám mây trong nước cho môi trường thử nghiệm và chạy thật: máy chủ, cơ sở dữ liệu, kho lưu trữ tệp | Chờ đến khi triển khai (YCTD-32) |
| T7 | Gửi thông báo qua Zalo | Tài khoản Zalo Official Account đã xác thực của trường | Bị chặn, cần tài khoản; giai đoạn 3 |
| T8 | Kết nối tự động với cơ sở dữ liệu ngành | Tài khoản và tài liệu kết nối do Sở Giáo dục cung cấp | Bị chặn, cần tài khoản; giai đoạn 3 (G3-09) |

### 2.4 Hệ thống lớn, làm theo đợt riêng

| Mã | Công việc | Trạng thái | Ghi chú |
|---|---|---|---|
| L1 | Nhập dữ liệu ban đầu từ Excel theo mẫu | Chưa bắt đầu | Đã đưa vào giai đoạn 1 ngày 2026-10-09 (P01-13) |
| L2 | Ứng dụng phụ huynh bản cài riêng | Chưa bắt đầu, làm theo đợt riêng | Trùng mã N2 |
| L3 | Sổ kế toán kép | Chưa bắt đầu, làm theo đợt riêng | Trùng mã N5 |

## 3. Thứ tự ưu tiên tiếp theo

Chỉ liệt kê việc chưa xong. Thứ tự lấy theo đường găng và mục 13 của `01_KE_HOACH_TONG_THE.md`.

1. M01-3 — Eric tạo kho riêng trên GitHub; dựng nền móng kỹ thuật DT-00 và môi trường phát triển Docker để qua CG-08.
2. M01 — Xây dựng nền tảng, cây đơn vị nhiều cấp, tài khoản, vai trò, quyền.
3. M01-2 — Xây dựng dịch vụ định danh độc lập.
4. M02 — Xây dựng hồ sơ trẻ, phụ huynh, lớp học.
5. T6 — Thuê máy chủ đám mây trong nước khi triển khai; T1 — chọn nhà cung cấp tin nhắn.

## 4. Đang thực hiện

| Mã | Công việc | Giai đoạn | Người thực hiện | Trạng thái | Hạn | Ghi chú |
|---|---|---|---|---|---|---|
| M00 | Soạn bộ tài liệu thiết kế và ghi nhận câu hỏi mở | Phân tích nghiệp vụ và thiết kế | Minh | Đang thực hiện | Chưa đặt | Tài liệu đã soạn xong, chờ Eric duyệt |

## 5. Bị chặn

| Mã | Công việc | Giai đoạn | Người thực hiện | Lý do bị chặn |
|---|---|---|---|---|
| — | Không có việc nào bị chặn từ ngày 2026-10-09 | — | — | — |

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
