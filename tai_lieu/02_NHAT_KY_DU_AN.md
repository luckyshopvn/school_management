# 02. NHẬT KÝ DỰ ÁN

- Mô tả: Ghi nhận công việc, quyết định, thay đổi và vấn đề tồn đọng theo ngày, ngày mới nhất ở trên cùng.
- Phiên bản: 0.4
- Ngày cập nhật: 2026-10-17
- Trạng thái: Đang cập nhật

## Quy ước ghi nhật ký

- Mục mới ghi ở trên cùng; không sửa nội dung mục cũ.
- Từ ngày 2026-10-09, mỗi mục ghi theo mẫu của Vibecoding_Flow: công việc đã thực hiện, quyết định, thay đổi, vấn đề tồn đọng. Các mục cũ giữ nguyên dạng và tên tệp cũ.
- Mỗi mục ghi rõ ngày, người thực hiện, nội dung, tệp bị ảnh hưởng, kết quả kiểm thử.
- Không ghi thông tin tạm thời như kết quả tra cứu, đường dẫn tạm, thông báo lỗi của công cụ.

## Nhật ký theo ngày

### 2026-10-17 — DT-16 phần 16a: công cụ xuất, nhập dùng chung và mẫu gửi lên cấp trên

#### Công việc đã thực hiện

- Thêm nút "Xuất PDF" cho lưới dữ liệu dùng chung (bật bằng thuộc tính tùy chọn, năm màn hình), tác vụ xuất nền cho danh sách lớn với màn hình "3.5. Tệp đã tạo", thành phần nhập Excel dùng chung (tải file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập, xuất file lỗi) áp cho Nhập dữ liệu từ Excel và 2.2 Nhập lớp học từ Excel, mẫu "gửi lên cấp trên" chạy nội bộ áp cho Biểu 1 EMIS đầu năm. Ba bảng mới ở cơ sở dữ liệu hệ thống (tệp `0010`), không thêm quyền.
- Thêm chức năng P01-20, P17-19, P17-20, kịch bản CT-472 đến CT-482, tiêu chí AC-516 đến AC-526, quy tắc BR-119, quy tắc phân quyền PQ-70, màn hình MH-101, quy tắc bố cục BC-17. Kết quả ngày 17/10/2026 trên CI của PR 97: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 758/758 ca đạt (gồm 7 ca CT-472 đến CT-478 của `export-tools.test.ts`); toàn bộ kiểm thử giao diện 107/107 ca đạt (gồm 4 ca CT-479 đến CT-482 của `58-export-import-tools.spec.ts`; ca 23 quyết toán từng hỏng vì vượt giới hạn đăng nhập mỗi phút nên các ca 20 đến 24 chờ rồi đăng nhập lại qua `submitSignIn` của `tests/e2e/fixtures.ts`). Trên máy phát triển toàn bộ kiểm thử giao diện 107/107 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 16a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7 theo lựa chọn của Eric ngày 2026-10-16 (bản chạy nội bộ, nút ghi đúng việc làm, để sẵn chỗ nối). Tiến trình xuất nền chạy trong máy chủ API thay cho `apps/worker`; nhập lớp học cập nhật lớp đã có theo cột được chọn; quyền mở khóa của Biểu 1 EMIS là `P01.school-profile.manage`; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-121.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-121, `07_QUY_TAC_NGHIEP_VU.md` BR-119, `08_VAI_TRO_NGUOI_DUNG.md` PQ-70, `10_YEU_CAU_CHUC_NANG.md` P01-20, P17-19, P17-20, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-40, MH-82, MH-92, MH-101, BC-17, `16_CO_SO_DU_LIEU.md` mục 1, 18, `17_DAC_TA_API.md` mục 17, 17.1, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.71.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Xuất PDF, tác vụ nền còn bật dần ở các màn hình khác (16b, lượt 2, 3); tệp mẫu kèm dữ liệu mới có ở lớp học; gửi lên cấp trên mới có Biểu 1 EMIS, chưa truyền đi được.
### 2026-10-17 — DT-16 phần 16d: quản trị hệ thống đủ theo hệ thống của Sở

#### Công việc đã thực hiện

- 1.1 Nhóm người dùng: Hiệu lực theo dữ liệu, Sửa (tên, hiệu lực), Xóa qua hộp xác nhận xóa; không ngừng hiệu lực, không xóa nhóm hệ thống, không xóa nhóm đang có người dùng; nhóm hết hiệu lực không cấp quyền, phân hệ.
- Màn hình mới 1.2 Phân quyền nhóm theo phần mềm: tích phân hệ nhóm được dùng; phân hệ không nhóm nào của tài khoản được dùng thì ẩn khỏi ô chọn phân hệ và menu; máy chủ vẫn kiểm tra quyền theo thao tác; 1.3 nhắc khi nhóm chưa được dùng phân hệ.
- 1.4 Danh sách người dùng đủ theo Sở: cột Mã nhân sự, Mã Bộ, Thời gian đổi, Ngày hết hạn mật khẩu; lọc Mã định danh, ngày hết hạn mật khẩu; Phân nhóm quyền, Cấp mật khẩu hàng loạt, Lấy danh sách CBQL/GV, Xuất Excel qua máy chủ API ghép tài khoản với hồ sơ nhân sự.
- Màn hình mới 1.6 Tài khoản đồng bộ của Bộ, của Sở (bản chạy nội bộ): lưu tên đăng nhập, mật khẩu mã hóa ở bảng thông tin kết nối, không trả mật khẩu; ghi rõ chưa đồng bộ được, để sẵn chỗ nối.
- Thêm chức năng P01-18, P01-19, kịch bản CT-458 đến CT-471, tiêu chí AC-502 đến AC-515, quy tắc BR-118, quy tắc phân quyền PQ-69, màn hình MH-99, MH-100. Kết quả ngày 17/10/2026 trên CI của PR 96: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 748/748 ca đạt (thêm 10 ca CT-458 đến CT-467); toàn bộ kiểm thử giao diện 103/103 ca đạt (thêm 4 ca CT-468 đến CT-471); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt. Trên máy phát triển kiểm thử đơn vị 748 ca đạt; kiểm thử giao diện chạy trên CI vì các phiên khác dùng chung cổng và cơ sở dữ liệu kiểm thử giao diện.

#### Quyết định

- Thực hiện phần 16d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7 theo quyết định của Eric ngày 2026-10-16 (làm đủ tính năng đã khảo sát; tính năng cần hệ thống bên ngoài làm bản chạy nội bộ). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: lưu phân hệ bị bỏ thay vì phân hệ được dùng để phân hệ mới mặc định hiện; Phụ huynh bỏ mọi phân hệ; không thêm mã quyền; 1.6 dùng quyền `P01.integration.manage` và bảng `integration_credentials`; Mã định danh khớp mã nhân sự hoặc mã Bộ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-120, `07_QUY_TAC_NGHIEP_VU.md` BR-118, `08_VAI_TRO_NGUOI_DUNG.md` PQ-69, `10_YEU_CAU_CHUC_NANG.md` P01-18, P01-19, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-30, MH-99, MH-100, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.70.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa đồng bộ được lên CSDL ngành của Bộ, Sở (chưa có giao diện lập trình); 1.2 theo phân hệ của cổng quản trị, không theo sáu phần mềm của Sở; Lấy danh sách CBQL/GV dùng một nhóm quyền chung.
### 2026-10-16 — DT-16 phần 16b: lưới dữ liệu chung, hộp xác nhận xóa, Xuất Excel cho các màn hình còn lại theo hệ thống của Sở

#### Công việc đã thực hiện

- Chuyển danh sách của các màn hình còn lại sang lưới dữ liệu chung (38 khóa lưới mới): 1.1 Khai báo cơ sở vật chất, 2.1 Tổng hợp thiết bị dạy học của phân hệ Quản lý cơ sở vật chất, TBDH; 4.3.2, 5.8, 4.4, 4.1.6, 3.2, 4.5, 4.6.1, 4.6.2 của phân hệ Quản lý giáo dục Mầm non; 2.1 đến 2.5, 3.2 của phân hệ Quản trị hệ thống. Bỏ học sinh khỏi nhóm (một hoặc nhiều), bỏ món, bỏ nguyên liệu, xóa tiêu chuẩn sức khỏe, bỏ liên kết Zalo qua hộp xác nhận xóa; tiêu đề trang theo số menu.
- Thêm Xuất Excel theo cột đang hiện cho 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường, 4.1.11 Cập nhật địa danh hành chính, 1.4 Danh sách người dùng, 1.1 Nhóm người dùng (bốn điểm cuối mới, ghi nhật ký xuất).
- Thêm kịch bản CT-451 đến CT-457, tiêu chí AC-495 đến AC-501, quy tắc BR-117. Cơ sở dữ liệu ở máy phát triển không chạy được nên kết quả lấy trên CI của PR 94 ngày 16/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 742/742 ca đạt; toàn bộ kiểm thử giao diện 99/99 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 16b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7 theo yêu cầu của Eric ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống của Sở. Không thêm bảng, quyền; tìm kiếm trên các lưới mới tìm tại chỗ; bảng nhập theo ô và bảng số liệu cố định giữ dạng bảng; xuất 1.4, 1.1 do máy chủ API đọc lại ở dịch vụ định danh bằng mã phiên của người xuất, đường dẫn `/account-exports` để cổng vào không chuyển sang dịch vụ định danh; tệp phân hiệu, điểm trường, nhóm người dùng ghi không có dữ liệu cá nhân; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-119.

- Ngày 2026-10-17 gộp nhánh chính có phần 16d (YCTD-120): Xuất Excel 1.4 dùng `POST /account-directory/export` của phần 16d (đủ cột Mã nhân sự, Mã Bộ, hạn mật khẩu), bỏ `POST /account-exports/users` của phần này và kiểm thử CT-454 (thay bằng CT-466); tệp 1.1 lấy Hiệu lực theo dữ liệu, thêm cột Số người dùng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-119, `07_QUY_TAC_NGHIEP_VU.md` BR-117, `10_YEU_CAU_CHUC_NANG.md` P01-01, P01-06, P01-07, P02-17, `14_DAC_TA_GIAO_DIEN.md` BC-13, BC-15 và các MH ở YCTD-119, `17_DAC_TA_API.md` mục 5, 6, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.69.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa có Xuất PDF trên các lưới (chờ phần 16a gộp); 1.1, 1.4 còn thiếu cột, bộ lọc, thao tác của Sở (phần 16d); các màn hình tài chính dùng bảng danh mục chung chuyển ở phần 15f1.

### 2026-10-16 — DT-15 phần 15h2: văn thư lưu trữ theo hệ thống của Sở

#### Công việc đã thực hiện

- Thêm nhóm menu "5.10. Văn thư lưu trữ" với bốn màn hình: 5.10.1 Hồ sơ tài liệu (hai thẻ Chưa hoàn thành, Hoàn thành trên lưới dữ liệu chung phân trang ở máy chủ, nhãn Quá hạn, Mở rộng tìm kiếm, biểu mẫu theo khối với nút Ghi, Xóa qua hộp xác nhận, tệp đính kèm ở kho tệp, Xuất Excel), 5.10.2 Phông lưu trữ, 5.10.3 Thông tin lưu trữ, 5.10.4 Báo cáo lưu trữ có Xuất Excel. Bốn bảng mới ở cơ sở dữ liệu hệ thống (tệp `0009`), ba quyền mới (tệp định danh `0044`).
- Thêm chức năng P09-06 đến P09-08, kịch bản CT-438 đến CT-450, tiêu chí AC-482 đến AC-494, quy tắc BR-116, quy tắc phân quyền PQ-68, màn hình MH-95 đến MH-98. Kết quả ngày 16/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 738/738 ca đạt; toàn bộ kiểm thử giao diện 99/99 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15h2 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5. Dữ liệu ở cơ sở dữ liệu hệ thống vì không gắn năm học, nhật ký vẫn ghi ở năm học đang dùng; thông tin lưu trữ là màn hình nhập riêng để báo cáo cộng lại; quyền `P09.archive.view`, `P09.archive.manage`, `P09.archive.export` thuộc P09, gán đủ cho VT-02, VT-04, VT-06, xem và xuất cho VT-15, xem cho VT-03; người giải quyết là chữ tự do; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-118.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-118, `07_QUY_TAC_NGHIEP_VU.md` BR-116, `08_VAI_TRO_NGUOI_DUNG.md` PQ-68, `10_YEU_CAU_CHUC_NANG.md` P09-06 đến P09-08, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-95 đến MH-98, `16_CO_SO_DU_LIEU.md` mục 2, 20, `17_DAC_TA_API.md` mục 12, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.68.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Người giải quyết chưa chọn từ danh sách nhân sự; chưa có nhắc hạn; chưa có sổ văn bản đến, đi, biên bản giao nộp, tiêu hủy; hồ sơ chưa phân theo đơn vị.

### 2026-10-16 — Kế hoạch DT-16: bổ sung đủ tính năng theo hệ thống của Sở

#### Công việc đã thực hiện

- Đối chiếu từng dòng của `31_KHAO_SAT_HE_THONG_SO.md` (mục 2 đến 7) với mã nguồn hiện tại: liệt kê màn hình, thẻ, cột, bộ lọc, nút còn thiếu hoặc mới làm một phần.
- Thêm mục 7 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.4): đợt DT-16 gồm 11 phần (16a đến 16k), chia ba lượt.

#### Quyết định

- Eric yêu cầu ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của Sở.
- Eric chọn ngày 2026-10-16: tính năng cần hệ thống bên ngoài (đồng bộ lên CSDL Bộ, Sở; xác thực với CSDLQG về dân cư; ký số; tách trường; gửi lên cấp trên; biến động liên trường; đăng nhập chọn trường) làm bản chạy nội bộ, thay cho dòng "Không áp dụng" của mục 1 tài liệu 32.
- Eric chọn ngày 2026-10-16: phân hệ Tuyển sinh đầu cấp và Hồ sơ điện tử chờ khảo sát bổ sung.

#### Thay đổi

- `32_KE_HOACH_THEO_HE_THONG_SO.md`, `02_NHAT_KY_DU_AN.md`.

#### Vấn đề tồn đọng

- Lượt 1 (16a đến 16d) đang làm; lượt 2, 3 chờ lượt trước gộp.
### 2026-10-15 — DT-15 phần 15h1: cập nhật địa danh hành chính theo hệ thống của Sở

#### Công việc đã thực hiện

- Thêm danh mục địa danh hành chính ở cơ sở dữ liệu hệ thống (đơn vị cũ, đơn vị mới, bảng đối chiếu) và gieo sẵn Thành phố Hồ Chí Minh mới: 168 đơn vị cấp xã, 441 xã cũ của Thành phố Hồ Chí Minh, Bình Dương, Bà Rịa - Vũng Tàu, 493 dòng đối chiếu, lấy từ Nghị quyết 1685/NQ-UBTVQH15 và danh mục của Cục Thống kê (mã theo Quyết định 19/2025/QĐ-TTg).
- Thêm màn hình "4.1.11. Cập nhật địa danh hành chính": lưới địa chỉ học sinh còn theo địa danh cũ ở năm loại địa chỉ, đề xuất địa danh mới, chọn xã mới khi xã cũ chia cho nhiều xã, chuyển hàng loạt có nhật ký trước và sau; bảng đối chiếu, nhập bảng đối chiếu từ Excel.
- Thêm kịch bản CT-421 đến CT-430, tiêu chí AC-465 đến AC-474, quy tắc BR-115, quy tắc phân quyền PQ-67, chức năng P02-17, màn hình MH-94. Kết quả ngày 15/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 725/727 ca đạt, hai ca CTC-DD-041, PQ-10 chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này; tệp mới `administrative-units.test.ts` 8/8 ca đạt; toàn bộ kiểm thử giao diện 96/96 ca đạt (lần chạy trước 95/96, ca hỏng ở `50-facilities-emis.spec.ts` chờ thông báo "Đã lưu phòng", không liên quan, chạy lại đạt); tệp mới `56-administrative-units.spec.ts` 2/2 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15h phần 15h1 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5 (15h2 văn thư lưu trữ làm song song). Danh mục chỉ lấy từ văn bản và danh mục chính thức, phần chưa kiểm chứng (tỉnh khác) để người dùng nhập từ Excel; so khớp tên giữ dấu vì có tên chỉ khác dấu; dùng lại quyền lập, duyệt hồ sơ học sinh và quyền quản lý danh mục, không thêm quyền. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-116, `07_QUY_TAC_NGHIEP_VU.md` BR-115, `08_VAI_TRO_NGUOI_DUNG.md` PQ-67, `10_YEU_CAU_CHUC_NANG.md` P02-17, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-94, `16_CO_SO_DU_LIEU.md` mục P01, `17_DAC_TA_API.md` giao kèo địa danh hành chính, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.66.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chỉ gieo sẵn Thành phố Hồ Chí Minh; chưa đọc trực tiếp phụ lục Quyết định 19/2025/QĐ-TTg; chưa có nhập danh sách học sinh kèm địa chỉ mới từ Excel, xuất Excel lưới địa chỉ, sửa từng dòng đối chiếu; nhập lại tệp CSDL ngành ghi đè địa chỉ đã chuyển.

### 2026-10-15 — DT-15 phần 15d: nhân sự theo hệ thống của Sở

#### Công việc đã thực hiện

- Đổi màn hình hồ sơ nhân sự thành "3.1.1. Hồ sơ cán bộ, giáo viên": lưới dữ liệu chung phân trang ở máy chủ với cột của Sở, xếp A–Z theo tên, Mở rộng tìm kiếm gộp mục 3.1.4 (đơn vị, phòng ban, trạng thái, giới tính, vị trí việc làm, Đảng viên, tuổi từ–đến, mã định danh Bộ, số định danh), Xuất Excel theo cột đang hiện; hồ sơ hai thẻ "Hồ sơ cán bộ, giáo viên" (bảy khối theo thứ tự cột của tệp CSDL ngành, nút Ghi) và "Thông tin riêng của trường"; biểu mẫu Thêm mới theo khối. Ba điểm cuối mới `GET /staff/search`, `POST /staff/export`, `PATCH /staff/{id}/profile`; không có tệp thay đổi cấu trúc dữ liệu, không có quyền mới.
- Thêm kịch bản CT-409 đến CT-420, tiêu chí AC-453 đến AC-464, quy tắc BR-114, quy tắc phân quyền PQ-66; không có màn hình mới (MH-12 đổi). Kết quả ngày 15/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 659/659 ca đạt; toàn bộ kiểm thử giao diện 94/94 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5. Cột của Sở chưa có cột riêng lấy từ `staff.moet_profile` và biểu mẫu ghi lại đúng khóa của tệp CSDL ngành, không thêm cột; thêm cột Mã nhân sự của trường; gộp 3.1.4 vào Mở rộng tìm kiếm của 3.1.1; hợp đồng, lương ở thẻ riêng và chỉ người xem được hợp đồng thấy (BR-46); `GET /staff` giữ nguyên cho các màn hình khác; không làm cập nhật hàng loạt; không thêm quyền mới, Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-112.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-112, `07_QUY_TAC_NGHIEP_VU.md` BR-114, `08_VAI_TRO_NGUOI_DUNG.md` PQ-66, `10_YEU_CAU_CHUC_NANG.md` P07-01, P07-04, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-12, BC-16, `16_CO_SO_DU_LIEU.md` mục `staff`, `17_DAC_TA_API.md` giao kèo hồ sơ nhân sự, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.65.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chưa có Đồng bộ hồ sơ lên CSDL Bộ, Xuất file lỗi, Xóa hồ sơ, Xuất PDF; chưa có bộ lọc xã ĐBKK; chưa tách 3.1.2, 3.1.3, 3.1.5, 3.5; ô theo Sở là chữ tự do, chưa có danh mục của Bộ; nhập lại tệp CSDL ngành ghi đè các ô đã sửa ở biểu mẫu.

### 2026-10-15 — DT-15 phần 15b: trường học, lớp học theo hệ thống của Sở

#### Công việc đã thực hiện

- Thêm mục "1.2. Quản lý phân hiệu", "1.3. Quản lý điểm trường" (lưới theo cột của Sở, khoảng cách đến cơ sở chính, diện tích, Ngừng sử dụng, Dùng lại); chuyển "2.1. Hồ sơ lớp học" sang lưới dữ liệu chung và biểu mẫu theo khối với nhóm tuổi, nhóm lớp, thứ tự, học 2 buổi/ngày, lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, lớp ghép, lớp bán trú, Mở rộng tìm kiếm, Xuất Excel, "Giải thể lớp"; tách "2.2. Nhập lớp học từ Excel" khỏi màn hình Nhập dữ liệu; thêm "3.3. Phân công phụ trách lớp" lấy từ phân công giáo viên của lớp; tiêu đề 1.1, 1.4 kèm số menu. Cột mới ở cơ sở dữ liệu năm học (tệp 0051), không có quyền mới.
- Thêm kịch bản CT-398 đến CT-408, tiêu chí AC-442 đến AC-452, quy tắc BR-111 đến BR-113, quy tắc phân quyền PQ-65, màn hình MH-90 đến MH-93. Kết quả ngày 15/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 650/650 ca đạt; toàn bộ kiểm thử giao diện 91/91 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5. Phân hiệu, điểm trường là hai danh sách của cây đơn vị (Trường chính vẫn tạo ở Cây đơn vị), Ngừng sử dụng thay Xóa; lớp giải thể là lớp đã đóng; nhóm tuổi bỏ trống là theo bậc học; quy tắc ghép độ tuổi, lớp ghép; phân công phụ trách lớp lấy từ phân công giáo viên của lớp, không thêm bảng; nhập lớp học tách màn hình riêng giữ mẫu cũ; không thêm quyền mới, Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-111.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-111, `07_QUY_TAC_NGHIEP_VU.md` BR-111 đến BR-113, `08_VAI_TRO_NGUOI_DUNG.md` PQ-65, `10_YEU_CAU_CHUC_NANG.md` P01-01, P01-13, P02-05, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-03, MH-32, MH-40, MH-90 đến MH-93, BC-16, `16_CO_SO_DU_LIEU.md` mục 2, 3, `17_DAC_TA_API.md` mục 5, giao kèo lớp học theo Sở, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.64.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5.

#### Vấn đề tồn đọng

- 1.4 Cấu hình trường chưa có ba ô của Sở; 1.2, 1.3 chưa có Xuất Excel, chưa có Xóa; 2.1 chưa có thao tác hàng loạt, Xuất PDF, nhóm tuổi của lớp chưa dùng cho thống kê; mẫu nhập lớp học chưa có các ô mới; 3.3 chưa hiện giáo viên chưa được phân công.

### 2026-10-15 — DT-15 phần 15g: gửi phản hồi, hết hạn mật khẩu

#### Công việc đã thực hiện

- Thêm nút "Gửi phản hồi" ở chân mọi trang của cổng quản trị (hộp thoại theo biểu mẫu của Sở, kèm ảnh chụp màn hình, tối đa 10 ý kiến mỗi giờ mỗi tài khoản); mục "Danh sách ý kiến đã gửi" ở menu người dùng; mục "3.4. Ý kiến phản hồi" của Quản trị hệ thống để VT-01, VT-02 đổi trạng thái, trả lời, người gửi nhận thông báo trong ứng dụng; bảng `feedback` ở cơ sở dữ liệu hệ thống (tệp 0007), quyền mới `P01.feedback.manage`.
- Thêm hết hạn mật khẩu cho tài khoản nhân sự ở dịch vụ định danh: cột `users.password_changed_at`, chính sách số ngày hết hạn và số ngày báo trước (tệp 0042, mặc định tắt), sửa ở khối "Chính sách mật khẩu" của "1.4. Danh sách người dùng"; mật khẩu quá hạn thì bắt buộc đổi ở màn hình Đổi mật khẩu, sắp hết hạn thì đầu trang báo số ngày còn lại; cột ẩn "Thời gian đổi mật khẩu".
- Thêm kịch bản CT-382 đến CT-397, tiêu chí AC-426 đến AC-441, chức năng P01-16, P01-17, quy tắc BR-108 đến BR-110, quy tắc phân quyền PQ-64, màn hình MH-87 đến MH-89, biện pháp BM-72, XT-10. Kiểm thử đơn vị máy chủ API 642/643 ca đạt, dịch vụ định danh 45/46 ca đạt (hai ca CTC-DD-041, PQ-10 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này; ca PQ-10 đã sửa vì VT-01 nay có thêm `P01.feedback.manage`); toàn bộ kiểm thử giao diện 87/87 ca đạt ngày 15/10/2026.

#### Quyết định

- Thực hiện lựa chọn 4 của Eric ngày 13/10/2026 (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, 4, 5 đợt 15g): biểu mẫu Gửi phản hồi ở chân trang; hết hạn mật khẩu và bắt buộc đổi định kỳ. Các ô của biểu mẫu (thêm ảnh đính kèm, số điện thoại, thư điện tử), người xử lý ý kiến là VT-01, VT-02, giới hạn 10 ý kiến mỗi giờ, chỉ áp hết hạn mật khẩu cho tài khoản nhân sự, đặt chính sách ở Danh sách người dùng theo quyền `P01.account.manage` (không ở màn hình Cấu hình vì VT-01 không có `P01.setting.manage`), mặc định tắt Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-110.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-110, `07_QUY_TAC_NGHIEP_VU.md` BR-108 đến BR-110, `08_VAI_TRO_NGUOI_DUNG.md` PQ-10, PQ-64, `10_YEU_CAU_CHUC_NANG.md` P01-16, P01-17, `12_KIEN_TRUC_HE_THONG.md` XT-10, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-30, MH-48, MH-83, MH-84, MH-87 đến MH-89, `16_CO_SO_DU_LIEU.md` mục 1, 2 và 20, `17_DAC_TA_API.md` mục 4, 5, `22_BAO_MAT.md` BM-72, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.63.0.

#### Vấn đề tồn đọng

- Thông báo trả lời ý kiến cần năm học đang dùng; chưa gửi thư điện tử, tin nhắn; ý kiến chưa gửi về đơn vị hỗ trợ bên ngoài; đổi trạng thái, trả lời chưa ghi nhật ký thao tác; hai màn hình ý kiến phân trang ở trình duyệt.
- Ứng dụng giáo viên chưa hiện dòng "Mật khẩu đã hết hạn" và chưa báo sắp hết hạn; chưa chặn dùng lại mật khẩu cũ hơn mật khẩu hiện tại; chưa có bộ lọc Ngày hết hạn mật khẩu ở Danh sách người dùng; báo sắp hết hạn chưa là hộp thông báo bật lên như của Sở.

### 2026-10-15 — DT-15 phần 15e: quản trị hệ thống theo hệ thống của Sở

#### Công việc đã thực hiện

- Đưa phân hệ Quản trị hệ thống của cổng quản trị theo Sở: "1.1. Nhóm người dùng" trên lưới dữ liệu chung, biểu mẫu thêm nhóm theo khối; mục mới "1.3. Phân quyền nhóm theo menu" chọn quyền theo cây menu đánh số; "1.4. Danh sách người dùng" với cột, bộ lọc theo Sở; Khóa API cho đối tác và Nhật ký thao tác trên lưới dữ liệu chung; tiêu đề các màn hình quản trị kèm số menu; điều kiện hiện mục menu chuyển sang gói dùng chung `packages/shared/src/menu-permissions.ts`; dịch vụ định danh lọc, đếm, phân trang danh sách người dùng trong câu truy vấn, tệp chuyển đổi 0041 thêm hai chỉ mục của cơ sở dữ liệu định danh.
- Thêm kịch bản CT-368 đến CT-381, tiêu chí AC-412 đến AC-425, màn hình MH-86. Kiểm thử đơn vị máy chủ API 631/632 ca đạt, dịch vụ định danh 40/41 ca đạt (hai ca CTC-DD-041, PQ-10 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này); toàn bộ kiểm thử giao diện 84/84 ca đạt ngày 15/10/2026.

#### Quyết định

- Thực hiện lựa chọn 3 của Eric ngày 13/10/2026 (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, 3.2, 5 đợt 15e): giữ mã quyền theo thao tác, màn hình phân quyền hiển thị theo cây menu. Cách suy ra quyền của mục và quyền ở cổng (quyền ở cổng không tính là quyền của mục), cột Hiệu lực, Là nhóm quản trị, cột và bộ lọc của danh sách người dùng, việc chỉ đổi tiêu đề ở các màn hình quản trị không phải danh sách thuần Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-109.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-109, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-30, MH-31, MH-42, MH-86, `08_VAI_TRO_NGUOI_DUNG.md` PQ-13, `16_CO_SO_DU_LIEU.md` mục 2 và 20, `17_DAC_TA_API.md` mục 3, 5, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.62.0.

#### Vấn đề tồn đọng

- Chưa có cột Mã nhân sự, Mã Bộ, Thời gian đổi mật khẩu, Ngày hết hạn mật khẩu và bộ lọc Mã định danh, Ngày hết hạn mật khẩu của Sở (hết hạn mật khẩu làm ở phần 15g); chưa có Phân nhóm quyền hàng loạt, Cấp mật khẩu hàng loạt, Lấy danh sách CBQL/GV, Xuất Excel ở 1.4.
- Chưa có 1.2 Phân quyền nhóm theo phần mềm của Sở; chưa sửa, xóa, ngừng dùng nhóm người dùng (không có điểm cuối).
- Năm học, Cây đơn vị, Phòng ban và chức danh, Danh mục dùng chung, Phòng học và bậc học, Hạn mức phê duyệt, Kết nối ngoài chỉ đổi tiêu đề, chưa chuyển sang lưới dữ liệu chung; tìm theo từ khóa ở danh sách người dùng cần chỉ mục trigram khi nhiều hơn khoảng 30 nghìn tài khoản.

### 2026-10-15 — DT-15 phần 15c: học sinh theo hệ thống của Sở

#### Công việc đã thực hiện

- Đưa nhóm "4. Học sinh" của cổng quản trị theo Sở: màn hình "4.1.1. Quản lý hồ sơ học sinh" dùng lưới dữ liệu chung (cột, bộ lọc theo Sở, thứ tự A–Z theo tên, Xuất Excel theo cột đang hiện, cập nhật hàng loạt học 2 buổi/ngày và bán trú); hồ sơ học sinh hai thẻ theo khối của Sở và "Thông tin riêng của trường"; điện thoại nhận tin và chọn người nhận tin nhắn theo học sinh; mục mới "4.2. Biến động học sinh"; đổi chữ "trẻ" thành "học sinh" trên các màn hình học sinh; khối biểu mẫu dùng chung `FormBlock`, `FormRow`; tệp chuyển đổi 0050 của cơ sở dữ liệu năm học.
- Thêm kịch bản CT-354 đến CT-367, tiêu chí AC-398 đến AC-411, chức năng P02-15, P02-16, quy tắc BR-105 đến BR-107, màn hình MH-85. Kiểm thử đơn vị máy chủ API 622/623 ca đạt, dịch vụ định danh 40/41 ca đạt (hai ca CTC-DD-041, PQ-10 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này); toàn bộ kiểm thử giao diện 78/80 ca đạt, hai ca CT-365, CT-366 của `tests/e2e/51-students-so.spec.ts` hỏng do bộ chọn ô đánh dấu trong hộp cấu hình cột khớp nhiều phần tử, đã sửa và chạy lại tệp 3/3 ca đạt ngày 15/10/2026.

#### Quyết định

- Eric chọn ngày 13/10/2026 đồng bộ nhóm học sinh theo Sở và dùng chữ "học sinh" thay "trẻ" trên cổng quản trị (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 1, 5 đợt 15c); cột, bộ lọc, thứ tự A–Z, cách lưu điện thoại nhận tin, cập nhật hàng loạt và biến động học sinh dựng từ lịch sử đã có Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-108.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-108, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-02, MH-85 và BC-16, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.61.0.

#### Vấn đề tồn đọng

- Chưa có chuyển đến, chuyển đi giữa các trường ở mục 4.2 của Sở; chưa ghi số thứ tự cố định trong lớp; điện thoại nhận tin chưa nhập từ Excel; dân tộc, diện chính sách, khuyết tật, biết bơi chưa sửa được trên hồ sơ; chưa có Xuất PDF, Xuất file lỗi, Cấp mã định danh Bộ; thông báo lỗi của máy chủ API vẫn dùng chữ "trẻ".

### 2026-10-14 — DT-15 phần 15a: menu ngang đánh số, menu người dùng, lưới dữ liệu dùng chung

#### Công việc đã thực hiện

- Thay thanh điều hướng bên trái của cổng quản trị bằng menu ngang nhiều cấp đánh số theo phân hệ (mười một phân hệ, 66 trang), dùng được bằng chuột và bàn phím, cây menu gập trên màn hình hẹp; menu người dùng ở thanh đầu trang; lưới dữ liệu dùng chung, hộp cấu hình cột, hộp xác nhận xóa; cấu hình lưới lưu theo tài khoản ở cơ sở dữ liệu hệ thống; thí điểm lưới ở Tài khoản và Hồ sơ nhân sự; kiểm thử giao diện mở trang qua trợ giúp `tests/e2e/menu.ts`.
- Thêm kịch bản CT-340 đến CT-353. Kiểm thử đơn vị toàn bộ 667 ca, 665 đạt (hai ca PQ-10, CTC-DD-041 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu định danh dùng chung, không liên quan phần này); kiểm thử giao diện 77/77 đạt ngày 14/10/2026.

#### Quyết định

- Eric chọn menu ngang đánh số thay thanh điều hướng bên trái ngày 13/10/2026 (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, lựa chọn 1); cây menu, menu người dùng, lưới dữ liệu và bỏ lựa chọn "Tất cả chức năng" Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-107.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-107, `14_DAC_TA_GIAO_DIEN.md` mục 1.1 và BC-10 đến BC-15, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.60.0.

#### Vấn đề tồn đọng

- Menu người dùng chưa có Hồ sơ cá nhân, Danh sách ý kiến đã gửi, Hướng dẫn; các màn hình khác chuyển sang lưới ở phần 15f; nút Xuất Excel, Xuất PDF và thao tác hàng loạt của lưới chưa làm; danh sách tài khoản ở dịch vụ định danh vẫn đọc hết rồi cắt trang.

### 2026-10-14 — DT-14 phần 14d: hồ sơ trường, khai báo cơ sở vật chất, thiết bị dạy học, biểu EMIS đầu năm

#### Công việc đã thực hiện

- Hồ sơ trường sáu thẻ gắn với Trường chính; khai báo cơ sở vật chất trên danh mục phòng học (khối, loại, hiện trạng, diện tích, thuộc tính) kèm bảng tổng hợp; danh mục thiết bị dạy học tối thiểu gieo sẵn và thiết bị ngoài danh mục, số lượng hiện có theo đơn vị, lớp, tổng hợp theo định mức; báo cáo EMIS đầu năm Biểu 1 năm thẻ; xuất Excel kèm nhật ký xuất; chuyển hồ sơ, danh mục thiết bị, số hiện có khi mở năm học mới.
- Thêm kịch bản CT-330 đến CT-339.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026 (YCTD-102); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-106.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-106 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.59.0.

#### Vấn đề tồn đọng

- Danh mục thiết bị tối thiểu gieo sẵn và mã số chỉ tiêu EMIS cần đối chiếu văn bản; chưa gửi báo cáo EMIS lên Sở; chưa có thẻ Ngân sách nhà nước, biểu cuối năm; gắn tài sản với thiết bị chưa có trên màn hình Kho và tài sản.

### 2026-10-14 — DT-14 phần 14a: cân nặng, chiều cao theo chuẩn WHO, thống kê theo tiêu chí ngành, hồ sơ chưa nhập đủ

#### Công việc đã thực hiện

- Đợt cân đo, nhập cân nặng, chiều cao theo lớp và từ Excel, chỉ số Z và kênh tăng trưởng theo chuẩn WHO, biểu đồ tăng trưởng, tổng hợp cân nặng, chiều cao kèm xuất Excel; thống kê lớp học, học sinh, nhân sự theo tiêu chí ngành; hồ sơ học sinh, nhân sự chưa nhập đủ.
- Thêm kịch bản CT-320 đến CT-329.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026 (YCTD-102); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-105.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-105 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.58.0.

#### Vấn đề tồn đọng

- Dân tộc, khuyết tật, trình độ và các trường tương tự chưa có cột riêng, đọc từ hồ sơ CSDL ngành đã nhập; chưa có thông báo phụ huynh khi có kết quả cân đo, chưa tổng hợp theo học kỳ.

### 2026-10-13 — DT-14 phần 14c: hoàn thành chương trình mầm non, chuẩn nghề nghiệp, nhóm học sinh

#### Công việc đã thực hiện

- Hoàn thành chương trình mầm non theo lớp 5-6 tuổi, nhóm học sinh, đánh giá chuẩn nghề nghiệp giáo viên và hiệu trưởng.
- Thêm kịch bản CT-310 đến CT-319.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026 (YCTD-102); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-104.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-104 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.57.0.

#### Vấn đề tồn đọng

- Đối chiếu tên tiêu chí và quy tắc xếp loại với Thông tư 25, 26/2018/TT-BGDĐT; chưa có nhập mức đánh giá từ Excel.

### 2026-10-13 — DT-14 phần 14b: năm học ở thanh đầu trang và Truy cập nhanh trên trang chủ

#### Công việc đã thực hiện

- Ô năm học và học kỳ ở thanh đầu trang; vùng Truy cập nhanh trên trang chủ, lưu lối tắt theo tài khoản.
- Thêm kịch bản CT-300 đến CT-309.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026; các điểm kỹ thuật Claude tự chọn ghi ở YCTD-102.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-102 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.56.0.

#### Vấn đề tồn đọng

- Xem năm học đã đóng cần máy chủ API đọc được cơ sở dữ liệu năm học cũ ở chế độ chỉ xem.
### 2026-10-13 — Khảo sát hệ thống thông tin quản lý giáo dục của Sở

#### Công việc đã thực hiện

- Eric đăng nhập hệ thống của Sở GD&ĐT TP.HCM; Claude đọc giao diện 6 phân hệ, 98 màn hình, không thay đổi dữ liệu, không ghi dữ liệu cá nhân; viết `31_KHAO_SAT_HE_THONG_SO.md`.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng (đợt DT-14, YCTD-102); các đề xuất còn lại ở mục 8.3 của tài liệu khảo sát chờ Eric chọn.

#### Thay đổi

- Thêm `31_KHAO_SAT_HE_THONG_SO.md`.

#### Vấn đề tồn đọng

- Chưa xem được phân hệ Tuyển sinh đầu cấp (chỉ mở ở học kỳ II năm 2025-2026) và nội dung chỉ tiêu các biểu EMIS.

### 2026-10-13 — DT-13 phần 13c: báo cáo điểm danh và suất ăn theo ngày, tuần, tháng

#### Công việc đã thực hiện

- Báo cáo điểm danh và suất ăn theo ngày, tuần, tháng trên màn hình và Excel theo mẫu của trường; suất ăn theo lớp cho bếp.
- Thêm kịch bản CT-289 đến CT-299.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-103.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-103 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.55.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-13 phần 13a: nhập thẳng tệp học sinh, cán bộ theo mẫu CSDL ngành

#### Công việc đã thực hiện

- Nhập thẳng tệp học sinh, cán bộ theo mẫu CSDL ngành (.xls, .xlsx), lưu đủ 82 và 75 cột; chạy thử với tệp mẫu thật của trường trên cơ sở dữ liệu tạm.
- Thêm kịch bản CT-275 đến CT-288.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-100.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-100 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.54.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — Menu sổ xuống chọn phân hệ

#### Công việc đã thực hiện

- Thêm menu sổ xuống chọn phân hệ ở thanh đầu trang theo ảnh mẫu của Eric; kiểm thử giao diện 65/65 đạt.

#### Quyết định

- Eric yêu cầu ngày 2026-10-13; cách gom phân hệ Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 (YCTD-101).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-101.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-13 — Giao diện tông xanh, ẩn hiện thanh điều hướng

#### Công việc đã thực hiện

- Đổi bảng màu sang tông xanh theo ảnh mẫu của Eric; thanh đầu trang xanh có nút ẩn hoặc hiện thanh điều hướng; nhóm chức năng thu gọn được, trình duyệt nhớ lựa chọn.
- Kiểm thử giao diện 64/64 đạt.

#### Quyết định

- Eric yêu cầu ngày 2026-10-13; cách trình bày Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 (YCTD-99).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-99, `15_HE_THONG_THIET_KE.md` mục 2 và KC-08.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-13 — Ma trận quyền chọn nhanh, chuông thông báo, dữ liệu mẫu

#### Công việc đã thực hiện

- Ma trận quyền chọn nhanh theo nhóm, tên nhóm gồm mã và tên phân hệ; sửa lỗi báo nhầm mất kết nối ở Cây đơn vị (YCTD-96, yêu cầu gộp số 67).
- Chuông thông báo ở đầu trang cổng quản trị (YCTD-97).
- Chẩn đoán "chức năng chưa hoạt động" trên máy của Eric: cơ sở dữ liệu phát triển chưa có năm học đang dùng và tài khoản VT-01 chỉ có quyền quản lý tài khoản (PQ-10); dựng dữ liệu mẫu `pnpm demo:seed`.

#### Quyết định

- Eric yêu cầu hai thay đổi giao diện; cách trình bày Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-96, YCTD-97.

#### Vấn đề tồn đọng

- Cấp toàn quyền cho VT-01 trong mã nguồn chưa làm: Eric tự cấp trên ma trận quyền ở máy phát triển.
### 2026-10-13 — DT-12 phần 12d: cấu hình triển khai môi trường chạy thật

#### Công việc đã thực hiện

- Viết cấu hình triển khai Docker Compose, ảnh, Caddy, sao lưu và khôi phục, hướng dẫn triển khai; dựng thử, sao lưu và khôi phục thử trên máy cục bộ.
- Thêm kịch bản CT-269 đến CT-274.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-98.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-98 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.53.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-12 phần 12c: Fanpage và Zalo Official Account chạy thật

#### Công việc đã thực hiện

- Nâng kết nối Fanpage lên Graph API v21.0, thêm kho khóa và làm mới khóa Zalo tự động, nút kiểm tra kết nối trên MH-71.
- Thêm kịch bản CT-261 đến CT-268.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-95.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-95 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.52.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-12 phần 12b: cổng thanh toán PayOS, SePay, Casso, VNPay

#### Công việc đã thực hiện

- Viết bốn cổng thanh toán PayOS, SePay, Casso, VNPay và điểm cuối nhận thông báo; nút thanh toán VNPay trên ứng dụng phụ huynh.
- Thêm kịch bản CT-250 đến CT-260.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-94.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-94 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.51.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-12 phần 12a: nối nhà cung cấp tin nhắn eSMS.vn

#### Công việc đã thực hiện

- Viết `EsmsClient` và lớp gửi eSMS.vn cho dịch vụ định danh, máy chủ API; đọc cấu hình từ biến môi trường.
- Thêm kịch bản CT-236 đến CT-249.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-93.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-93 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.50.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — Nghiệm thu ba bản phát hành, chọn nhà cung cấp, lập đợt DT-12

#### Công việc đã thực hiện

- Gắn thẻ `v1.0.0`, `v1.1.0`, `v1.2.0` và tạo bản phát hành trên GitHub.
- Cập nhật bảng tiến độ phân hệ trong `03_DANH_SACH_CONG_VIEC.md` (yêu cầu gộp số 64).
- Lập đợt DT-12 bốn phần 12a đến 12d.

#### Quyết định

- Eric nghiệm thu ba bản; G3-04 chưa làm; chọn eSMS.vn, PayOS, SePay, Casso, VNPay; nối Fanpage và Zalo thật; Claude chuẩn bị cấu hình triển khai (YCTD-92).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-92 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.49.0.

#### Vấn đề tồn đọng

- Eric thuê máy chủ đám mây, cấp khóa của nhà cung cấp; triển khai, kiểm thử hiệu năng và phục hồi, xác nhận sau triển khai (việc T6, cổng CG-11).

### 2026-10-11 — DT-11: báo cáo kiểm thử giai đoạn 3, bản ứng viên 1.2.0

#### Công việc đã thực hiện

- Gộp năm phần 11a đến 11e vào `main` (yêu cầu gộp số 58 đến 62), quyền và kế hoạch ở yêu cầu gộp số 56, 57.
- Viết `30_BAO_CAO_KIEM_THU_G3.md`.
- Kết quả: máy chủ API 518/518, kiểm thử giao diện 62/62; kịch bản CT 224/235 đạt, ca chi tiết CTC 443/453 đạt.

#### Quyết định

- Claude tự chọn các điểm của YCTD-91 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-91 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.48.0.

#### Vấn đề tồn đọng

- Eric nghiệm thu ba bản ứng viên 1.0.0, 1.1.0, 1.2.0; quyết định G3-04; việc T1, T4, T6, T7.

### 2026-10-11 — DT-11 phần 11c: sổ kế toán kép

#### Công việc đã thực hiện

- Agent 11c viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11d (đã gồm 11a, 11b, 11e), thêm chức năng P06-12 và quy tắc BR-96, đánh số bảy kịch bản mới CT-229 đến CT-235 kèm AC-273 đến AC-279, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: bốn bảng (tệp 0042). Máy chủ API: hệ thống tài khoản, quy tắc ghi sổ theo loại chứng từ và khoản mục, ghi sổ tự động một lần cho mỗi chứng từ (phiếu thu, phiếu chi, phiếu đảo, hóa đơn, miễn giảm, điều chỉnh, bảng lương, quyết toán), bút toán thủ công cân, nhật ký chung, sổ cái, bảng cân đối số phát sinh, xuất Excel; bước chuyển năm học `ledger` kết chuyển số dư đầu kỳ.
- Cổng quản trị: trang Sổ kế toán.
- Kết quả: máy chủ API 518/518, kiểm thử giao diện 62/62.

#### Quyết định

- Claude tự chọn các điểm của YCTD-88 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-88 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.47.0.

#### Vấn đề tồn đọng

- Báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11d: nhập sao kê và đối soát

#### Công việc đã thực hiện

- Agent 11d viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11a (đã gồm 11b, 11e), đánh số bảy kịch bản mới CT-222 đến CT-228 kèm AC-266 đến AC-272, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tệp 0043. Máy chủ API: cấu hình cột sao kê theo tài khoản, nhập tệp xlsx và CSV bỏ dòng trùng, đối soát tự động theo mã chứng từ và khoảng ngày, đề xuất lập phiếu thu cho dòng có mã hóa đơn còn nợ (kế toán xác nhận), nhiều cổng thanh toán theo tài khoản (giả lập, VietQR tĩnh).
- Cổng quản trị: phần Nhập tệp sao kê ở trang Đối chiếu ngân hàng, chọn cổng thanh toán ở trang Quỹ và ngân hàng.
- Kết quả: máy chủ API 511/511, kiểm thử giao diện 61/61.

#### Quyết định

- Claude tự chọn các điểm của YCTD-89 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-89 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.46.0.

#### Vấn đề tồn đọng

- Gộp phần 11c; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11a: tuyển sinh trực tuyến

#### Công việc đã thực hiện

- Agent 11a viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11b (đã gồm 11e), đổi tên bộ giới hạn số lần gọi của tuyển sinh để không trùng tuyển dụng, đặt cả hai trang công khai trên màn hình đăng nhập phụ huynh, đánh số sáu kịch bản mới CT-216 đến CT-221 kèm AC-260 đến AC-265, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: ba bảng (tệp 0040). Máy chủ API: đợt tuyển sinh có chỉ tiêu, tin tuyển sinh, nộp và tra cứu hồ sơ TS-000001 không cần tài khoản có giới hạn số lần, tiếp nhận, xét đạt theo chỉ tiêu hoặc không đạt kèm lý do, chuyển hồ sơ đạt thành hồ sơ trẻ dùng lại quy trình hồ sơ trẻ (QT-01); bước chuyển năm học `admissions`.
- Cổng quản trị: trang Tuyển sinh. Ứng dụng phụ huynh: trang Tuyển sinh trực tuyến công khai.
- Kết quả: máy chủ API 504/504, kiểm thử giao diện 60/60.

#### Quyết định

- Claude tự chọn các điểm của YCTD-86 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-86 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.45.0.

#### Vấn đề tồn đọng

- Gộp các phần 11c, 11d; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11b: tuyển dụng

#### Công việc đã thực hiện

- Agent 11b viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11e, đánh số tám kịch bản mới CT-208 đến CT-215 kèm AC-252 đến AC-259, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: bốn bảng (tệp 0041). Máy chủ API: đề nghị tuyển dụng DNTD-000001 duyệt bởi Ban Giám hiệu, tin tuyển dụng công khai đến hết hạn, nộp hồ sơ không cần tài khoản có giới hạn số lần, hồ sơ ứng viên có ghi nhật ký truy cập dữ liệu cá nhân, phỏng vấn nhiều vòng, quyết định tuyển, tạo hồ sơ nhân sự; bước chuyển năm học `recruitment`.
- Cổng quản trị: trang Tuyển dụng. Ứng dụng phụ huynh: trang Tuyển dụng giáo viên và nhân viên công khai.
- Kết quả: máy chủ API 494/494, kiểm thử giao diện 59/59.

#### Quyết định

- Claude tự chọn các điểm của YCTD-87 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-87 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.44.0.

#### Vấn đề tồn đọng

- Gộp các phần 11a, 11c, 11d; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11e: kết nối Facebook và Zalo

#### Công việc đã thực hiện

- Agent 11e viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp `main`, đánh số sáu kịch bản mới CT-202 đến CT-207 kèm AC-246 đến AC-251, sửa KT-09 tính chung tin Zalo, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tệp 0044. Máy chủ API: cấu hình kết nối ngoài (khóa chỉ ở biến môi trường), đăng hoạt động và tin tức đã công bố lên Fanpage kèm loại ảnh theo đồng ý hình ảnh, thử lại khi lỗi; kênh Zalo cho thông báo và nhắc nợ, gửi tin nhắn thay khi chưa liên kết hoặc lỗi; bước chuyển năm học `integrations`.
- Cổng quản trị: trang Kết nối ngoài (MH-71), nút Đăng lên Fanpage ở trang Hoạt động và tin tức.
- Kết quả: máy chủ API 486/486, kiểm thử giao diện 58/58.

#### Quyết định

- Claude tự chọn các điểm của YCTD-90 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-90 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.43.0.

#### Vấn đề tồn đọng

- Gộp các phần 11a đến 11d; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-10: báo cáo kiểm thử giai đoạn 2, bản ứng viên 1.1.0

#### Công việc đã thực hiện

- Gộp mười phần 10a đến 10j vào `main` (yêu cầu gộp số 43, 45, 46, 48 đến 54); từ phần 10b làm song song ba phần một lượt bằng các agent, người điều phối gộp nối tiếp và chạy toàn bộ kiểm thử trước mỗi yêu cầu gộp.
- Bổ sung ca kiểm thử cho CT-041, CT-083, CT-085; đánh dấu CTC-P06-049 đạt.
- Viết `29_BAO_CAO_KIEM_THU_G2.md`.
- Kết quả: máy chủ API 480/480, kiểm thử giao diện 57/57; kịch bản CT 187/201 đạt, ca chi tiết CTC 443/453 đạt.

#### Quyết định

- Claude tự chọn các điểm của YCTD-84 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-84 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.42.0.

#### Vấn đề tồn đọng

- Eric nghiệm thu bản ứng viên 1.0.0 (0.31.0) và 1.1.0 (0.42.0); việc T1, T6; đợt DT-11 giai đoạn 3.

### 2026-10-11 — DT-10 phần 10i: tài chính giai đoạn 2

#### Công việc đã thực hiện

- Agent 10i viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 3, dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 10h (đã gồm 10b đến 10j), nối công nợ phải trả với phiếu đi chợ của bếp (thêm ca kiểm thử), đánh số màn hình MH-61, MH-62 và quy tắc mới BR-95 (thay mã lỗi tạm P06-09), chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: năm bảng (tệp 0038). Máy chủ API: nhắc nợ theo mốc, đề xuất và quyết định xử lý công nợ quá hạn, dòng sao kê và đối chiếu ngân hàng, công nợ phải trả từ phiếu mua hàng, phiếu mua thuốc, phiếu đi chợ hoặc lập tay, chốt kỳ tài chính và khóa số liệu kỳ đã chốt trên phiếu thu, phiếu chi, phiếu đảo, tính học phí, miễn giảm, điều chỉnh.
- Cổng quản trị: trang Nhắc nợ và xử lý quá hạn, Đối chiếu ngân hàng, Nợ nhà cung cấp, Chốt kỳ tài chính.
- Kết quả: máy chủ API 480/480, kiểm thử giao diện 57/57.

#### Quyết định

- Claude tự chọn các điểm của YCTD-82 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-82 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.41.0.

#### Vấn đề tồn đọng

- Kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10h: công việc và đánh giá

#### Công việc đã thực hiện

- Agent 10h viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 3, dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 10j (đã gồm 10b đến 10g), thêm bảng công việc được giao vào báo cáo hoạt động và công việc, đánh số màn hình MH-58 đến MH-60 và bảy kịch bản mới CT-195 đến CT-201 kèm AC-239 đến AC-245, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười bảng (tệp 0037). Máy chủ API: giao việc, việc cá nhân, tiến độ, kế hoạch kích hoạt thành việc, chỉ số và phiếu đánh giá, quá trình công tác và chứng chỉ, thưởng và khấu trừ đưa vào phiếu lương; bước chuyển năm học `work`.
- Cổng quản trị: trang Công việc và kế hoạch, Đánh giá nhân sự, Thưởng và khấu trừ, mục Quá trình công tác trong hồ sơ nhân sự. Ứng dụng giáo viên: Công việc của tôi.
- Kết quả: máy chủ API 474/474, kiểm thử giao diện 56/56.

#### Quyết định

- Claude tự chọn các điểm của YCTD-81 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-81 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.40.0.

#### Vấn đề tồn đọng

- Gộp phần 10i; kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10j: báo cáo giai đoạn 2

#### Công việc đã thực hiện

- Agent 10j viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 3); người điều phối gộp nhánh 10g (đã gồm 10b đến 10f), thêm bảng hoạt động của lớp vào báo cáo hoạt động và công việc qua giao diện nguồn số liệu, đánh số sáu kịch bản mới CT-189 đến CT-194 kèm AC-233 đến AC-238, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: bảng `export_logs` (tệp 0039). Máy chủ API: báo cáo hoạt động và công việc theo nguồn số liệu gắn thêm được, báo cáo hợp nhất theo đơn vị không có dữ liệu cá nhân, xuất Excel bảy báo cáo có nhật ký xuất.
- Cổng quản trị: trang Báo cáo thêm ba thẻ và nút xuất Excel.
- Kết quả: máy chủ API 466/466, kiểm thử giao diện 55/55.

#### Quyết định

- Claude tự chọn các điểm của YCTD-83 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-83 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.39.0.

#### Vấn đề tồn đọng

- Gộp phần 10h (thêm bảng công việc vào báo cáo hoạt động) và 10i; kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10g: giảng dạy

#### Công việc đã thực hiện

- Agent 10g viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 2); người điều phối gộp các nhánh 10b đến 10f, dựng lại các tệp giao diện dùng chung từ bản của 10f cộng phần thay đổi của 10g, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười bảng (tệp 0036). Máy chủ API: lĩnh vực, nhóm bài học, chủ đề, bài học dùng chung hoặc riêng, giáo án duyệt hai bước (tổ trưởng rồi quản lý đơn vị), thời khóa biểu theo phiên bản tuần, kế hoạch giảng dạy, tiến độ học tập theo kỳ, lịch hoạt động lớp, trang học tập của con; bước chuyển năm học `teaching`.
- Cổng quản trị: trang Bài học và giáo án (MH-57). Ứng dụng giáo viên: Giảng dạy lớp. Ứng dụng phụ huynh: Học tập.
- Sửa thêm: kiểm thử giao diện bếp chờ lưu món xong rồi mới trình duyệt; xóa cơ sở dữ liệu thử lại khi gặp tiến trình nền của PostgreSQL không kết thúc được (mã 42501), lỗi dọn dẹp thỉnh thoảng gặp khi chạy kiểm thử.
- Kết quả: máy chủ API 458/458, kiểm thử giao diện 54/54.

#### Quyết định

- Claude tự chọn các điểm của YCTD-80 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-80 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.38.0.

#### Vấn đề tồn đọng

- Lượt 3 (10h, 10i, 10j); kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10f: tương tác và đồ bị mất

#### Công việc đã thực hiện

- Agent 10f viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 2); người điều phối gộp các nhánh 10b, 10c, 10d, 10e, xử lý xung đột ở các tệp đăng ký dùng chung, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Bình luận: giữ hai bảng riêng, `content_comments` của 10e cho nội dung P14 (hoạt động, tin tức, thư viện, album) và `interaction_comments` của 10f cho đối tượng P15 (bình chọn); đổi tên kiểu và lớp của phần tương tác (`InteractionCommentTargetType`, `InteractionCommentsService`) để không trùng tên. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: gộp một bảng chung cần sửa lớn cả hai phần mà không thêm giá trị cho người dùng.
- Cơ sở dữ liệu: mười ba bảng (tệp 0035). Máy chủ API: luồng trao đổi theo trẻ và tài khoản phụ huynh, góp ý ẩn danh, bình chọn, biểu quyết, khảo sát và danh mục khảo sát, bình luận có bản ghi xử lý, lượt thích, phiếu đồ bị mất `DBM-000001`; bước chuyển năm học `interactions`.
- Cổng quản trị: trang Tương tác với phụ huynh. Ứng dụng giáo viên: trao đổi và đồ bị mất của lớp. Ứng dụng phụ huynh: trao đổi, góp ý, bình chọn, mất đồ.
- Kết quả: máy chủ API 452/452, kiểm thử giao diện 53/53.

#### Quyết định

- Claude tự chọn các điểm của YCTD-79 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-79 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.37.0.

#### Vấn đề tồn đọng

- Gộp phần 10g; lượt 3 (10h, 10i, 10j).

### 2026-10-11 — DT-10 phần 10e: hoạt động và nội dung

#### Công việc đã thực hiện

- Agent 10e viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 2, dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp các nhánh 10b, 10c, 10d, xử lý xung đột ở các tệp đăng ký dùng chung và kiểu `FilePurpose`, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tệp 0034. Máy chủ API: danh mục hoạt động, hoạt động trình duyệt và công bố, ảnh gắn thẻ trẻ theo đồng ý hình ảnh, tin tức, thư viện, album, hình tô màu, bình luận và thích, ngoại khóa có chỉ tiêu và phí đưa vào hóa đơn; bước chuyển năm học `activities`.
- Cổng quản trị: trang Hoạt động và tin tức. Ứng dụng giáo viên: hoạt động lớp. Ứng dụng phụ huynh: hoạt động và tin tức.
- Kết quả: máy chủ API 443/443, kiểm thử giao diện 52/52.

#### Quyết định

- Claude tự chọn các điểm của YCTD-78 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-78 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.36.0.

#### Vấn đề tồn đọng

- Gộp phần 10f, 10g; lượt 3 (10h, 10i, 10j) đang làm.

### 2026-10-11 — DT-10 phần 10c: bếp và thực đơn

#### Công việc đã thực hiện

- Agent 10c viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng; người điều phối gộp `main` cùng các nhánh 10b, 10d, xử lý xung đột ở các tệp đăng ký dùng chung, sửa kiểm thử giao diện chọn món, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười một bảng bếp (tệp 0032). Máy chủ API: nguyên liệu, món ăn, định lượng, thực đơn tuần trình duyệt và công bố, suất ăn theo ngày, báo cơm, buffet, nhà cung cấp thực phẩm, phiếu đi chợ chờ thanh toán, báo cáo ăn và bếp; bước chuyển năm học `kitchen`.
- Cổng quản trị: trang Bếp và thực đơn. Ứng dụng giáo viên: báo cơm của lớp. Ứng dụng phụ huynh: thực đơn.
- Kết quả: máy chủ API 431/431, kiểm thử giao diện 51/51.

#### Quyết định

- Claude tự chọn các điểm của YCTD-76 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-76 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.35.0.

#### Vấn đề tồn đọng

- Gộp lượt 2 (10e, 10f, 10g); các phần 10h đến 10j.

### 2026-10-11 — DT-10 phần 10b: thuốc

#### Công việc đã thực hiện

- Agent 10b viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng; người điều phối gộp `main` và nhánh 10d, xử lý xung đột ở các tệp đăng ký dùng chung, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tám bảng thuốc (tệp 0031). Máy chủ API: danh mục thuốc, nhà thuốc, yêu cầu dặn thuốc kèm ảnh, nhận thuốc, ghi liều và bỏ liều, xác nhận đã biết bỏ liều, đề nghị mua thuốc theo hạn mức, phiếu mua thuốc, phiếu cấp thuốc; bước chuyển năm học `medicines`.
- Cổng quản trị: trang Thuốc và dặn thuốc. Ứng dụng giáo viên: màn hình dặn thuốc của lớp. Ứng dụng phụ huynh: mục dặn thuốc.
- Kết quả: máy chủ API 424/424, kiểm thử giao diện 50/50.

#### Quyết định

- Claude tự chọn các điểm của YCTD-75 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-75 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.34.0.

#### Vấn đề tồn đọng

- Gộp phần 10c; các phần 10e đến 10j.

### 2026-10-11 — DT-10 phần 10d: kho, tài sản, mua hàng

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 43 (phần 10a). Lượt song song đầu của DT-10: ba agent làm 10b, 10c, 10d trong worktree riêng (YCTD-73); agent 10d viết mã, kiểm thử máy chủ và nháp tài liệu; người điều phối soát, gộp `main`, chạy toàn bộ kiểm thử và đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười ba bảng (tệp 0033). Máy chủ API: tài sản, cấp phát, mượn trả, hỏng mất, nhà cung cấp, mặt hàng, nhập xuất, tồn ban đầu, kiểm kê, đề nghị và phiếu mua hàng; bước chuyển năm học `inventory`. Cổng quản trị: trang Kho và tài sản, trang Đề nghị mua hàng.
- Kết quả: máy chủ API 416/416, kiểm thử giao diện 49/49.

#### Quyết định

- Claude tự chọn các điểm của YCTD-77 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-77 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.33.0.

#### Vấn đề tồn đọng

- Gộp phần 10b, 10c; các phần 10e đến 10j.

### 2026-10-11 — DT-10 phần 10a: y tế học đường

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 42 (phần 9g), gắn nhãn `v1.0.0-rc.1`; lập kế hoạch DT-10 (YCTD-73); viết phần 10a trên nhánh `dt-10-phan-10a`.
- Cơ sở dữ liệu: tám bảng y tế (tệp 0030 năm học); quyền P10 (tệp 0031 định danh).
- Máy chủ API: chỉ số, tiêu chuẩn, đợt khám, lịch khám, kết quả, sự kiện y tế, chăm sóc hằng ngày, tổng hợp sức khỏe, yêu cầu báo cáo; bước chuyển năm học `health`.
- Cổng quản trị: trang Y tế học đường. Ứng dụng giáo viên: màn hình chăm sóc và y tế của lớp. Ứng dụng phụ huynh: mục sức khỏe.
- Kết quả: máy chủ API 408/408, kiểm thử giao diện 48/48.

#### Quyết định

- Claude tự chọn các điểm của YCTD-73, YCTD-74 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-73, YCTD-74 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.32.0.

#### Vấn đề tồn đọng

- Phần 10b đến 10j của đợt DT-10.

### 2026-10-11 — DT-09 phần 9g: cổng CG-10 và bản ứng viên 1.0.0

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 41 (phần 9f); viết phần 9g trên nhánh `dt-09-phan-9g`.
- Thêm kiểm thử phạm vi báo cáo thu chi của kế toán (CTC-P06-050); ghi kết quả các ca đã có kiểm thử.
- Viết `28_BAO_CAO_KIEM_THU_CG_10.md`; cập nhật trạng thái công việc và giai đoạn.
- Kết quả: máy chủ API 401/401, kiểm thử giao diện 47/47.

#### Quyết định

- Claude đánh giá CG-10 đạt theo ủy quyền của Eric ngày 2026-10-11 (YCTD-72).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-72 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.31.0.

#### Vấn đề tồn đọng

- CG-11: Eric nghiệm thu bản ứng viên; việc T1 (nhà cung cấp tin nhắn, thanh toán) và T6 (môi trường đám mây, kiểm thử hiệu năng, phục hồi, triển khai).

### 2026-10-11 — DT-09 phần 9f: tiến trình gửi thông báo

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 40 (phần 9e); viết phần 9f trên nhánh `dt-09-phan-9f`.
- Cơ sở dữ liệu: `notification_recipients` thêm cột theo dõi lần gửi (tệp 0029).
- Máy chủ API: tiến trình gửi thông báo trong ứng dụng và tin nhắn, gửi lại khi lỗi, giới hạn 5 tin mỗi ngày, nhắc ghi nhật ký theo giờ cấu hình.
- Kết quả: máy chủ API 400/400, kiểm thử giao diện 47/47.

#### Quyết định

- Claude tự chọn các điểm của YCTD-71 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-71 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.9.

#### Vấn đề tồn đọng

- Phần 9g của đợt DT-09: báo cáo cổng CG-10 và phát hành 1.0.0.

### 2026-10-11 — DT-09 phần 9e: quy tắc theo cấu hình, báo cáo thu chi theo nhóm

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 39 (phần 9d); viết phần 9e trên nhánh `dt-09-phan-9e`.
- Máy chủ API: sĩ số tối đa theo cấu hình đơn vị; ghi nhật ký truy cập khi đơn vị bật; tra nhật ký truy cập; báo cáo thu chi theo nhóm và theo tháng.
- Cổng quản trị: hai bảng mới trong báo cáo thu chi.
- Kết quả: máy chủ API 395/395, kiểm thử giao diện 47/47.

#### Quyết định

- Claude tự chọn các điểm của YCTD-70 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-70 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.8.

#### Vấn đề tồn đọng

- Phần 9f, 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9d: chuyển dữ liệu sang năm học mới

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 38 (phần 9c); viết phần 9d trên nhánh `dt-09-phan-9d`.
- Cơ sở dữ liệu: năm học có cột `receipts.carried_over` (tệp 0028).
- Máy chủ API: bước chuyển trẻ, phụ huynh, lớp, đăng ký dịch vụ; bước chuyển quỹ, công nợ, số dư có kèm kiểm tra BR-89, BR-94; mẫu thông báo chuyển cùng cấu hình.
- Kết quả: máy chủ API 390/390.

#### Quyết định

- Claude tự chọn các điểm của YCTD-69 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-69 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.7.

#### Vấn đề tồn đọng

- Phần 9e đến 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9c: lịch nghỉ và lịch công tác

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 37 (phần 9b); viết phần 9c trên nhánh `dt-09-phan-9c`.
- Cơ sở dữ liệu: năm học có `work_schedules` (tệp 0027); định danh có quyền `P08.work-schedule.manage` (tệp 0030).
- Máy chủ API: lập, công bố, xóa lịch; lịch của tôi; bảng công tính ngày công tác đã công bố; mở năm học mới chuyển lịch sang.
- Cổng quản trị: màn hình Lịch công tác (MH-56). Ứng dụng giáo viên: mục lịch công tác ở thẻ chấm công.
- Kết quả: máy chủ API 384/384, kiểm thử giao diện 47/47.

#### Quyết định

- Claude tự chọn các điểm của YCTD-68 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-68 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.6.

#### Vấn đề tồn đọng

- Phần 9d đến 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9b: chuyển đơn vị, thôi học, đồng ý hình ảnh

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 36 (phần 9a); viết phần 9b trên nhánh `dt-09-phan-9b`.
- Cơ sở dữ liệu: năm học có `child_unit_transfers` (tệp 0026).
- Máy chủ API: chuyển đơn vị kèm kiểm tra công nợ, thôi học, đồng ý hình ảnh của phụ huynh và giấy ký tay, cờ trẻ con nhân viên; tính học phí và bảng đăng ký dịch vụ gồm trẻ thôi học trong kỳ.
- Cổng quản trị: các mục mới trong chi tiết trẻ. Ứng dụng phụ huynh: mục hình ảnh.
- Kết quả: máy chủ API 380/380, kiểm thử giao diện 46/46.

#### Quyết định

- Claude tự chọn các điểm của YCTD-67 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-67 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.5.

#### Vấn đề tồn đọng

- Phần 9c đến 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9a: kiểm thử bổ sung và ghi kết quả

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 35 (phần 8b). Rà soát 108 ca kiểm thử chi tiết và 175 kịch bản kiểm thử còn Chưa chạy; viết phần 9a trên nhánh `dt-09-phan-9a`.
- Viết thêm kiểm thử tự động cho phê duyệt theo hạn mức, phiếu thu nhiều hóa đơn, nhiều quỹ, sổ quỹ, phạm vi đơn vị, phiên đăng nhập, danh mục ngừng dùng, khóa API, tình huống tính học phí theo lịch, lương, quyết toán, lưu trữ dữ liệu nhạy cảm.
- Ghi kết quả Đạt cho 69 ca kiểm thử chi tiết và 116 kịch bản kiểm thử.
- Kết quả: máy chủ API 368/368, kiểm thử giao diện 45/45.

#### Quyết định

- Claude tự chọn các điểm của YCTD-66 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-66 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.4.

#### Vấn đề tồn đọng

- Phần 9b đến 9g của đợt DT-09.
- Cổng CG-11 cần Eric: thuê hạ tầng đám mây (T6), chọn nhà cung cấp tin nhắn và cổng thanh toán (T1), ký nghiệm thu.

### 2026-10-11 — DT-08 phần 8b: nhật ký của bé

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 34 (phần 8a); viết phần 8b trên nhánh `dt-08-phan-8b`.
- Cơ sở dữ liệu: năm học có `daily_journals`, `journal_amendments` (tệp 0025).
- Máy chủ API: nhật ký của lớp theo ngày, lưu nhật ký từng trẻ, công bố cả lớp kèm cảnh báo, nhật ký của trẻ theo tháng, lịch sử sửa.
- Ứng dụng giáo viên: màn hình nhật ký của lớp (MG-03). Ứng dụng phụ huynh: nhật ký của con (MP-03).
- Kết quả: máy chủ API 327/327, kiểm thử giao diện 45/45. Hoàn thành đợt DT-08.

#### Quyết định

- Claude tự chọn các điểm của YCTD-65 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-65 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.3.

#### Vấn đề tồn đọng

- Đợt DT-09: kiểm thử toàn bộ giai đoạn 1, nghiệm thu, phát hành 1.0.0.

### 2026-10-11 — DT-08 phần 8a: trung tâm thông báo và mẫu thông báo

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 33 (phần 7b, hoàn thành DT-07); viết phần 8a trên nhánh `dt-08-phan-8a`.
- Cơ sở dữ liệu: năm học có `notification_reads`, `notification_templates` (tệp 0024); định danh có hai mã quyền P19 (tệp 0029).
- Máy chủ API: danh sách thông báo theo người nhận trực tiếp và theo vai trò, đánh dấu đã đọc, ai đã đọc, mẫu thông báo.
- Cổng quản trị: trang Thông báo (MH-55) và số chưa đọc ở thanh điều hướng; ứng dụng giáo viên và phụ huynh: khung thông báo.
- Kết quả: máy chủ API 322/322, kiểm thử giao diện 44/44.

#### Quyết định

- Claude tự chọn các điểm của YCTD-64 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-64 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.2.

#### Vấn đề tồn đọng

- Phần 8b: nhật ký của bé.

### 2026-10-11 — DT-07 phần 7b: khóa API cho đối tác

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 32 (phần 7a; lần chạy đầu của CI lỗi ngẫu nhiên ở ca kiểm thử giao diện 20, chạy lại thì đạt); viết phần 7b trên nhánh `dt-07-phan-7b`.
- Cơ sở dữ liệu định danh: bảng `api_clients`, mã quyền `P01.api-client.manage` (tệp 0028).
- Dịch vụ định danh: cấp, xem, thu hồi, kiểm tra khóa. Máy chủ API: nhóm `/partner/` với giới hạn tần suất và nhật ký truy cập dữ liệu nhạy cảm.
- Cổng quản trị: trang Khóa API cho đối tác (MH-42).
- Kết quả: máy chủ API 318/318, dịch vụ định danh 37/37, kiểm thử giao diện 43/43. Hoàn thành đợt DT-07.

#### Quyết định

- Claude tự chọn các điểm của YCTD-63 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-63 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.1.

#### Vấn đề tồn đọng

- Đợt DT-08: ứng dụng giáo viên và ứng dụng phụ huynh.

### 2026-10-11 — DT-07 phần 7a: bảng điều khiển và báo cáo cơ bản

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 31 (phần 6c-2, hoàn thành DT-06); viết phần 7a trên nhánh `dt-07-phan-7a`.
- Cơ sở dữ liệu: định danh có chín mã quyền P17 (tệp 0027).
- Máy chủ API: bảng điều khiển Ban Giám hiệu và quản lý đơn vị, sinh nhật trẻ, báo cáo học phí, công nợ, thu chi, điểm danh, chấm công, học thứ 7.
- Cổng quản trị: bảng điều khiển và sinh nhật trên trang chủ (MH-01), trang Báo cáo (MH-28).
- Kết quả: máy chủ API 314/314, kiểm thử giao diện 42/42.

#### Quyết định

- Claude tự chọn các điểm của YCTD-62 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-62 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.0.

#### Vấn đề tồn đọng

- Phần 7b: khóa API cho đối tác.

### 2026-10-11 — DT-06 phần 6c-2: phiếu chi lương, quyết toán, thu hồi lương, điều chỉnh kỳ sau

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 30 (phần 6c-1). Eric ủy quyền tự làm tới khi hoàn tất dự án, không chờ xác nhận; viết phần 6c-2 trên nhánh `dt-06-phan-6c-2`.
- Cơ sở dữ liệu: năm học có `payroll_settlements`, `payroll_adjustments`; `payments` có `payroll_id`, `settlement_id`; `receipts` cho phép không gắn trẻ, có `staff_id`, `settlement_id` (tệp 0023).
- Máy chủ API: phiếu chi lương từ bảng lương và bảng quyết toán, bảng quyết toán, phiếu thu thu hồi lương, khoản điều chỉnh kỳ sau đưa vào bảng lương, chuyển năm học.
- Cổng quản trị: lập phiếu chi lương ở trang Bảng lương; trang Quyết toán và điều chỉnh lương (MH-54).
- Kết quả: máy chủ API 305/305, kiểm thử giao diện 41/41. Hoàn thành đợt DT-06.

#### Quyết định

- Claude tự chọn các điểm của YCTD-61 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-61 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.7.

#### Vấn đề tồn đọng

- Đợt DT-07: bảng điều khiển và báo cáo cơ bản, API chỉ đọc cho đối tác.

### 2026-10-11 — DT-06 phần 6c-1: danh mục lương, biểu thuế, bảng lương, phiếu lương

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 29 (phần 6b-2). Hỏi Eric các điểm của phần 6c; chia 6c-1 và 6c-2; viết phần 6c-1 trên nhánh `dt-06-phan-6c-1`.
- Cơ sở dữ liệu: năm học có `pay_item_types`, `staff_pay_items`, `tax_tables` (có sẵn biểu thuế hiện hành), `payrolls`, `payslips`, `payslip_lines`, `staff.dependents_count` (tệp 0022); định danh có sáu mã quyền P08 (tệp 0026).
- Máy chủ API: danh mục lương, khoản gán, số người phụ thuộc, biểu thuế, tính bảng lương toàn trường, trình, duyệt, trả lại, phiếu lương của tôi, chuyển năm học; cấu hình hệ số làm thêm.
- Cổng quản trị: trang Bảng lương (MH-15), Danh mục lương và biểu thuế (MH-53), Phiếu lương của tôi, khoản lương riêng ở hồ sơ nhân sự. Ứng dụng giáo viên: màn hình phiếu lương (MG-11).
- Kết quả: máy chủ API 299/299, kiểm thử giao diện 40/40.

#### Quyết định

- Theo YCTD-60 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-60 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.6.

#### Vấn đề tồn đọng

- Phần 6c-2: phiếu chi lương, bảng quyết toán, phiếu thu thu hồi lương, bảng điều chỉnh kỳ sau.

### 2026-10-11 — DT-06 phần 6b-2: phép năm, đơn nghỉ phép, chốt và mở lại bảng công

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 28 (phần 6b-1); viết phần 6b-2 trên nhánh `dt-06-phan-6b-2`.
- Cơ sở dữ liệu: năm học có `leave_policies`, `leave_balances`, `leave_requests`, `timesheet_periods`, `timesheet_days`, `timesheet_reopen_requests` (tệp 0021); định danh có `P08.leave-policy.manage`, `P08.leave.approve`, `P08.timesheet-reopen.approve` (tệp 0025).
- Máy chủ API: quy định phép năm, số ngày phép, đơn nghỉ phép, chốt bảng công, đề nghị và duyệt mở lại, chặn sửa kỳ đã chốt, chuyển năm học.
- Cổng quản trị: trang Đơn nghỉ phép, trang Quy định phép năm (MH-52), phần kỳ công ở trang Chấm công. Ứng dụng giáo viên: màn hình đơn nghỉ phép.
- Kết quả: máy chủ API 290/290, kiểm thử giao diện 39/39.

#### Quyết định

- Theo YCTD-59 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-59 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.5.

#### Vấn đề tồn đọng

- Phần 6c: tiền lương.

### 2026-10-11 — DT-06 phần 6b-1: ngày lễ, lịch học bù và nghỉ bù, chấm công

#### Công việc đã thực hiện

- Hỏi Eric các điểm của phần 6b; chia 6b-1 và 6b-2; viết phần 6b-1 trên nhánh `dt-06-phan-6b`.
- Cơ sở dữ liệu: năm học có `holidays`, `school_day_changes`, `attendance_logs`, `catalog_items.attributes` (tệp 0020); định danh có `P08.holiday.manage`, `P08.school-day-change.manage`, `P08.attendance.manage`, `P08.attendance.view` (tệp 0024).
- Máy chủ API: ngày lễ, lịch học bù và nghỉ bù; lịch ngày học của trẻ tính ngày lễ, nghỉ bù, học bù; ngày làm việc của nhân sự; chấm công tự bấm và nhập tay; cấu hình giờ làm; thuộc tính loại nghỉ; chuyển năm học.
- Cổng quản trị: trang Chấm công (MH-44, MH-13), trang Ngày lễ và lịch bù (MH-37), thuộc tính loại nghỉ ở Danh mục dùng chung. Ứng dụng giáo viên: thẻ chấm công hôm nay (MG-10).
- Kết quả: máy chủ API 279/279, kiểm thử giao diện 38/38.

#### Quyết định

- Ngày làm việc, lịch thứ bảy, ngày lễ, giờ làm, loại nghỉ, phép năm, đơn nghỉ theo YCTD-59 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-59 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.4.

#### Vấn đề tồn đọng

- Phần 6b-2 làm ngay sau đó.

### 2026-10-10 — DT-06 phần 6a: hồ sơ nhân sự và hợp đồng lao động

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 26 (đổi cổng kiểm thử giao diện).
- Tạo `.claude/launch.json` cho các máy chủ phát triển (không đưa vào kho mã).
- Hỏi Eric bốn điểm của DT-06; chia ba phần; viết phần 6a trên nhánh `dt-06-phan-6a`.
- Cơ sở dữ liệu: năm học có `staff`, `employment_contracts`, lần nhập loại `staff` (tệp 0019); định danh có `P07.staff.manage`, `P07.staff.view`, `P07.contract.view`, `P01.import.staff` (tệp 0023).
- Dịch vụ định danh: tra tài khoản nhân sự để liên kết; khóa tài khoản và thu hồi phiên khi chấm dứt hợp đồng.
- Máy chủ API: hồ sơ nhân sự, liên kết tài khoản, hợp đồng, chấm dứt hợp đồng, cảnh báo hết hạn, hồ sơ của tôi, nhập nhân sự từ Excel, chuyển năm học.
- Cổng quản trị: trang Hồ sơ nhân sự (MH-12), mục nhân sự ở trang Nhập dữ liệu, cảnh báo hợp đồng sắp hết hạn trên trang chủ.
- Kết quả: máy chủ API 266/266, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 36/36.

#### Quyết định

- DT-06 chia ba phần; hồ sơ liên kết tài khoản có sẵn; nhân viên tự chấm công, phòng nhân sự sửa; đơn nghỉ phép do Hiệu trưởng hoặc Phó Hiệu trưởng duyệt (YCTD-58) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-58 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.3.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — Đổi cổng kiểm thử giao diện

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 25 (phần 5f) sau khi mọi bước kiểm thử trên GitHub đạt; đợt DT-05 xong, còn bộ chuyển đổi nhà cung cấp thanh toán thật.
- Đổi cổng kiểm thử giao diện trong `tests/e2e-environment.mjs` để không trùng máy chủ phát triển đang chạy trên máy: dịch vụ định danh 3201, máy chủ API 3200, cổng quản trị 5373, ứng dụng phụ huynh 5375, ứng dụng giáo viên 5376.
- Kết quả: kiểm thử giao diện chạy trên máy đạt 35/35.

#### Quyết định

- Đổi cổng kiểm thử giao diện sang cổng khác – người quyết định: Eric.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — DT-05 phần 5f: thanh toán trực tuyến bằng mã QR

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 24 (phần 5e-2) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric hai lượt về nhà cung cấp, tài khoản nhận, đối chiếu và phạm vi; viết phần 5f trên nhánh `dt-05-phan-5f`.
- Cơ sở dữ liệu: năm học có `payment_requests`, `online_payment_transactions`, tài khoản nhận thanh toán trực tuyến trong `cash_accounts` (tệp 0018).
- Máy chủ API: lớp nhà cung cấp có bộ giả lập; cấu hình tài khoản nhận; cấp mã QR theo hóa đơn; đối chiếu giao dịch tiền vào, tự lập phiếu thu; danh sách chờ và ghi xử lý; tách phần ghi phiếu thu để dùng chung.
- Cổng quản trị: chọn tài khoản nhận ở trang Quỹ và ngân hàng; giao dịch chờ xử lý ở trang Phiếu thu. Ứng dụng phụ huynh: nút thanh toán bằng mã QR.
- Kết quả: máy chủ API 257/257, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Nhà cung cấp cấp tài khoản ảo và mã QR dùng một lần qua API, tiền về một tài khoản của trường; đối chiếu nội dung trước, số tiền sau; nội dung là mã hóa đơn bỏ gạch; điểm cuối nhận thông báo thật chờ chọn nhà cung cấp; làm đủ phần còn lại với bộ giả lập (YCTD-57) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-57 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.2.

#### Vấn đề tồn đọng

- Chọn nhà cung cấp tài khoản ảo và xác nhận chuyển khoản (T1), viết bộ chuyển đổi và điểm cuối nhận thông báo có chữ ký, địa chỉ mạng cho phép; chạy CTC-P06-061.

### 2026-10-10 — DT-05 phần 5e-2: phiếu đảo phiếu chi

#### Công việc đã thực hiện

- Sửa lỗi CI của yêu cầu gộp số 23: kiểm thử giao diện phiếu chi chờ nhãn cần Hiệu trưởng duyệt, nhưng dữ liệu kiểm thử đã đặt hạn mức phiếu chi ở `06-catalogs.spec.ts`; đổi sang kiểm tra nội dung phiếu.
- Viết phần 5e-2 trên nhánh `dt-05-phan-5e2`.
- Cơ sở dữ liệu: năm học có `payment_reversals` (tệp 0017); định danh có `P06.payment-reversal.create` (tệp 0022).
- Máy chủ API: lập, duyệt, từ chối phiếu đảo phiếu chi theo hạn mức; hoàn lại nguồn chi; đảo phiếu hoàn tiền trả lại số dư có; sổ quỹ ghi số phiếu đảo.
- Cổng quản trị: trang Phiếu chi có nút lập phiếu đảo và mục phiếu đảo phiếu chi chờ duyệt.
- Kết quả: máy chủ API 246/246, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Không có quyết định mới; làm theo YCTD-55.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-56 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.1.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — DT-05 phần 5e-1: phiếu chi và sổ quỹ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 22 (phần 5d-2) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 5e; chia 5e thành 5e-1 và 5e-2; viết phần 5e-1 trên nhánh `dt-05-phan-5e`.
- Cơ sở dữ liệu: năm học có `payments`, `payment_attachments`, `payment_refund_sources`, tệp mục đích `payment_voucher` (tệp 0016); định danh có `P06.payment.manage`, `P06.payment.approve` (tệp 0021); cấu hình kiểm tra số dư ngân hàng mặc định bật.
- Máy chủ API: lập, sửa, xóa phiếu chi nháp, trình duyệt, duyệt là phát hành, từ chối; hoàn tiền trừ số dư có; sổ quỹ theo khoảng ngày; tải và xem chứng từ phiếu chi.
- Cổng quản trị: trang Phiếu chi (MH-10) có biểu mẫu kèm chứng từ, danh sách và mục chờ duyệt; trang Sổ quỹ (MH-11).
- Kết quả: máy chủ API 242/242, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Hoàn tiền thôi học trừ vào số dư có; kiểm tra số dư ngân hàng mặc định chặn; chia 5e-1, 5e-2; phiếu nộp, phiếu rút để giai đoạn 2 (YCTD-55) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-55 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.0.

#### Vấn đề tồn đọng

- CTC-P06-034 (phiếu chi lương từ bảng lương đã duyệt) chờ phân hệ lương; CTC-P01-049 (tắt kiểm tra số dư ngân hàng) chưa có kiểm thử tự động.

### 2026-10-10 — DT-05 phần 5d-2: đảo phiếu thu và nhập công nợ đầu kỳ

#### Công việc đã thực hiện

- Sửa lỗi CI của yêu cầu gộp số 21: mục điều hướng "Quỹ và tài khoản" trùng tên với mục "Tài khoản" trong kiểm thử giao diện, đổi thành "Quỹ và ngân hàng"; gộp yêu cầu gộp số 21 sau khi mọi bước đạt.
- Hỏi Eric ba điểm của phần 5d-2; viết phần 5d-2 trên nhánh `dt-05-phan-5d2`.
- Cơ sở dữ liệu: năm học có `receipt_reversals`, hóa đơn và dòng khoản loại đầu kỳ, lần nhập loại công nợ đầu kỳ (tệp 0015); định danh có `P06.receipt-reversal.create`, `P06.receipt-reversal.approve`, `P05.opening-debt.import` (tệp 0020).
- Máy chủ API: lập, duyệt, từ chối phiếu đảo theo hạn mức, chặn khi quỹ không đủ; danh sách phiếu đảo chờ duyệt; nhập công nợ đầu kỳ từ Excel theo quy trình kiểm tra rồi ghi; hàm cấp số chứng từ dùng chung.
- Cổng quản trị: trang Phiếu thu có lập phiếu đảo và mục phiếu đảo chờ duyệt; trang Nhập dữ liệu có mục công nợ đầu kỳ cho kế toán.
- Kết quả: máy chủ API 227/227, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Quỹ tiền mặt không đủ thì chặn duyệt phiếu đảo; số phiếu đảo `DPT-000001` riêng; tệp công nợ đầu kỳ dùng số định danh cá nhân, chỉ số dương (YCTD-54) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-54 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.9.

#### Vấn đề tồn đọng

- CTC-P01-082 còn phần nhập tệp nhân sự, làm khi xây dựng P07.

### 2026-10-10 — DT-05 phần 5d-1: phiếu thu, phân bổ, quỹ và công nợ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 20 (phần 5c-2) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 5d; chia 5d thành 5d-1 và 5d-2; viết phần 5d-1 trên nhánh `dt-05-phan-5d1`.
- Cơ sở dữ liệu: năm học có `cash_accounts`, `receipts`, `receipt_allocations`, `account_transactions` (tệp 0014); định danh có `P06.receipt.manage`, `P06.cash-account.manage`, `P05.debt.view` (tệp 0019).
- Máy chủ API: khai báo quỹ và tài khoản; lập phiếu thu kèm phân bổ, chống gửi lặp, ghi giao dịch tài khoản, thông báo phụ huynh và báo tất toán; dùng số dư có; danh sách và chi tiết phiếu thu; công nợ theo đơn vị và theo trẻ; số đã thu và còn phải nộp của hóa đơn; chặn giảm vượt số còn phải nộp.
- Cổng quản trị: trang Công nợ (MH-08) có chi tiết của trẻ, lập phiếu thu, dùng số dư có; trang Phiếu thu (MH-09); trang Quỹ và ngân hàng (MH-11). Ứng dụng phụ huynh: số còn phải nộp, hóa đơn đã thu đủ, số dư có, lịch sử đã nộp.
- Kết quả: máy chủ API 219/219, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 31.

#### Quyết định

- Làm quỹ và tài khoản ở phần 5d; số phiếu thu `PT-000001` toàn trường; phân bổ theo hóa đơn; công nợ đầu kỳ nhập thành hóa đơn loại đầu kỳ (YCTD-53) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-53 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.8.

#### Vấn đề tồn đọng

- CTC-P06-066 (đánh số lại khi mở năm học mới) chưa có kiểm thử tự động; số phiếu nằm trong cơ sở dữ liệu năm học nên năm mới bắt đầu từ `PT-000001`.

### 2026-10-10 — DT-05 phần 5c-2: miễn giảm và phiếu điều chỉnh hóa đơn

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 19 (phần 5c-1) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric hai điểm của phần 5c-2; viết phần 5c-2 trên nhánh `dt-05-phan-5c2`.
- Cơ sở dữ liệu: năm học có `discounts`, `invoice_adjustments` (tệp 0013); định danh có `P05.discount.manage`, `P05.invoice-adjustment.create`, `P05.fee-document.approve` (tệp 0018).
- Máy chủ API: lập miễn giảm, chép miễn giảm kỳ trước, lập phiếu điều chỉnh, duyệt và từ chối theo hạn mức, danh sách chờ duyệt; số phải nộp của hóa đơn; tính lại miễn giảm chờ duyệt khi chạy lại tính học phí.
- Cổng quản trị: chi tiết hóa đơn trong MH-06 có miễn giảm, điều chỉnh, số phải nộp và biểu mẫu lập; trang MH-07 Duyệt miễn giảm và điều chỉnh. Ứng dụng phụ huynh: số phải nộp và miễn giảm đã duyệt.
- Kết quả: máy chủ API 200/200, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 30/30.

#### Quyết định

- Miễn giảm lập trên cả hóa đơn nháp và đã phát hành; lập theo từng hóa đơn, có chép từ kỳ trước (YCTD-52) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-52 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.7.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — DT-05 phần 5c-1: tính học phí và phát hành hóa đơn

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 18 (phần 5b) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 5c; chia phần 5c thành 5c-1 và 5c-2; viết 5c-1 trên nhánh `dt-05-phan-5c1`.
- Sửa lỗi phân quyền của phần 5b: phụ huynh xem được bảng đăng ký của cả đơn vị vì VT-14 gán theo đơn vị của con và có `P05.view`; phạm vi xem của nhân sự nay bỏ vai trò phụ huynh.
- Cơ sở dữ liệu: năm học có `fee_calculation_runs`, `invoices`, `invoice_items`, `document_sequences` (tệp 0012); định danh có `P05.fee-calculation.manage` (tệp 0017).
- Máy chủ API: tính học phí theo kỳ và đơn vị, hóa đơn nháp và dòng cần kiểm tra, phát hành, hóa đơn bổ sung, xem hóa đơn; chặn đăng ký khi nợ quá hạn.
- Cổng quản trị: MH-06 Học phí. Ứng dụng phụ huynh: mục Học phí của con (MP-11).
- Kết quả: máy chủ API 185/185, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 30/30.

#### Quyết định

- Ngày học thực tế của BR-23 là ngày học trong thời gian đang học; tính học phí chạy ngay có ghi lần chạy; dòng cần kiểm tra theo mốc cố định; làm tròn đến đồng (YCTD-51) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-51 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.6.

#### Vấn đề tồn đọng

- CTC-P05-032 (giả lập lỗi giữa lần tính) chưa có kiểm thử tự động. Kiểm thử giao diện chưa chạy trọn luồng tính học phí vì cần một tháng đã qua chốt đủ điểm danh; đã phủ bằng kiểm thử máy chủ API.

### 2026-10-10 — DT-05 phần 5b: đăng ký dịch vụ và học hè

#### Công việc đã thực hiện

- Yêu cầu gộp số 17 (phần 5a) lần đầu thất bại trên GitHub vì kiểm thử hồ sơ trẻ sinh tên ngẫu nhiên trùng nhau; sửa bằng tên đánh số tuần tự, chạy lại đạt rồi gộp.
- Hỏi Eric hai điểm của phần 5b; viết phần 5b trên nhánh `dt-05-phan-5b`.
- Cơ sở dữ liệu: năm học có `service_registrations`, `registration_periods`, `summer_registrations` (tệp 0011); định danh có `P05.registration.manage`, `P05.late-registration.approve` (tệp 0016); cấu hình `service_registration_closing_day`.
- Máy chủ API: bảng đăng ký theo kỳ, đăng ký và hủy, đăng ký và hủy trễ chờ duyệt, chốt kỳ, học hè; điểm danh ngày hè cho trẻ đăng ký học hè.
- Cổng quản trị: MH-05 Đăng ký dịch vụ. Ứng dụng phụ huynh: mục Dịch vụ của con (MP-12).
- Kiểm thử giao diện phát hiện lỗi chạy đua khi tải dữ liệu: kết quả của tháng hoặc ngày cũ về sau ghi đè dữ liệu mới, ở màn hình dịch vụ của ứng dụng phụ huynh và bảng điểm danh của ứng dụng giáo viên; đã sửa bằng cách chỉ nhận kết quả của lần tải mới nhất.
- Kết quả: máy chủ API 174/174, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 29/29.

#### Quyết định

- Hủy dịch vụ sau ngày chốt cần Ban Giám hiệu duyệt; tháng hè không tự giữ dịch vụ không bắt buộc (YCTD-50) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-50 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.5.

#### Vấn đề tồn đọng

- CTC-P05-015 (thu theo ngày thực tế), 017, 018 (chặn khi nợ quá hạn), 065 cần tính học phí và hóa đơn; chạy ở phần 5c, 5d.

### 2026-10-10 — DT-05 phần 5a: danh mục học phí và tài chính

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 16 (phần 4b) sau khi mọi bước kiểm thử trên GitHub đạt; DT-04 xong phần điểm danh và đón trả.
- Hỏi Eric bốn điểm của DT-05; viết phần 5a trên nhánh `dt-05-phan-5a`.
- Cơ sở dữ liệu: năm học có `services` (bán trú tạo sẵn), `fee_schedules`, `fee_schedule_items`, `discount_types`, `cashflow_categories` (tệp 0010); định danh có ba quyền mới (tệp 0015). Mở năm học mới chuyển các danh mục này sang.
- Máy chủ API: dịch vụ, biểu phí theo phiên bản, loại miễn giảm, khoản mục thu chi.
- Cổng quản trị: MH-04 Biểu phí và dịch vụ, MH-39 Khoản mục thu chi.
- Kết quả: máy chủ API 158/158, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 28/28.

#### Quyết định

- DT-05 chia sáu phần; đăng ký dịch vụ tự giữ tới khi hủy; ngày chốt đăng ký là cấu hình đơn vị mặc định ngày 25; danh mục dùng chung toàn trường (YCTD-49) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-49 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.4.

#### Vấn đề tồn đọng

- CTC-P05-002, 003, 007, 045, CTC-P06-052 đến 054 có phần phụ thuộc hóa đơn, đăng ký, phiếu thu chi; chạy ở các phần sau.

### 2026-10-10 — DT-04 phần 4b: người được ủy quyền đón trẻ và đón trả

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 15 (phần 4a) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 4b; viết phần 4b trên nhánh `dt-04-phan-4b`.
- Cơ sở dữ liệu: năm học có `authorized_pickups`, `pickup_confirmation_requests`, `pickup_records`, tệp mục đích `pickup_photo` (tệp 0009); định danh có quyền `P02.authorized-pickup.manage`, `P04.pickup.gate-confirm` (tệp 0014).
- Máy chủ API: khai báo, hủy người được ủy quyền; bàn giao trẻ; yêu cầu và trả lời xác nhận của phụ huynh; danh sách người đón cho bảo vệ; ảnh bàn giao.
- Ứng dụng giáo viên: màn hình Đón trả trẻ (MG-04), Xác nhận người đón tại cổng (MG-16). Ứng dụng phụ huynh: người đón của con, xác nhận người đón ngoài danh sách (MP-18). Cổng quản trị: mục người được ủy quyền trong hồ sơ trẻ.
- Kết quả: máy chủ API 142/142, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 26/26.

#### Quyết định

- Chỉ ghi bàn giao chiều; bảo vệ xác nhận độc lập; mọi phụ huynh có tài khoản của trẻ xác nhận người đón ngoài danh sách, hiệu lực trong ngày; VT-02, VT-15, VT-03 khai báo phía nhà trường (YCTD-48) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-48 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.3.

#### Vấn đề tồn đọng

- Thông báo mới vào hàng đợi; gửi thật khi làm phân hệ thông báo. Kiểm thử giao diện chưa phủ bàn giao của giáo viên vì phụ thuộc hôm nay là ngày học; đã phủ bằng kiểm thử máy chủ API.

### 2026-10-10 — DT-04 phần 4a: điểm danh và báo vắng

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 13 (phần 3c). Yêu cầu gộp số 13 được gộp nhầm khi kiểm thử trên GitHub thất bại; nguyên nhân là các tệp kiểm thử chạy song song cùng sửa mật khẩu mặc định; đã sửa ở yêu cầu gộp số 14 (kiểm thử chạy từng tệp lần lượt) và chỉ gộp khi mọi bước đạt.
- Hỏi Eric bốn điểm của DT-04; viết phần 4a trên nhánh `dt-04-phan-4a`.
- Cơ sở dữ liệu: năm học có `attendance_records`, `attendance_days`, `absence_records`, người nhận thông báo theo vai trò (tệp 0008); định danh có quyền `P04.attendance.manage` (tệp 0013).
- Máy chủ API: lịch ngày học, bảng điểm danh, lưu chống trùng, chốt và mở lại, sửa sau khi chốt kèm lý do, báo vắng, điểm danh của trẻ theo tháng; cấu hình giờ bắt đầu học.
- Ứng dụng giáo viên: đăng nhập, Lớp của tôi, Bảng điểm danh có lưu tạm khi mất mạng. Ứng dụng phụ huynh: danh sách con, báo vắng, điểm danh tháng này. Cổng quản trị: màn hình Điểm danh.
- Kết quả: máy chủ API 129/129, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 24/24.

#### Quyết định

- DT-04 chia hai phần; giờ bắt đầu học cấu hình theo đơn vị mặc định 07:30; bảng ban đầu chưa đánh dấu; chưa điểm danh kỳ hè (YCTD-47) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-47 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.2.

#### Vấn đề tồn đọng

- CTC-P04-007, 008 chờ lịch học bù thứ bảy (P08-10); CTC-P04-046 chờ đăng ký học hè (P05-13).

### 2026-10-10 — DT-03 phần 3c: nhập dữ liệu

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 12 (phần 3b) vào nhánh chính. Eric yêu cầu làm song song: viết phần sau trong lúc phần trước chạy kiểm thử trên GitHub.
- Hỏi Eric ba điểm của phần 3c; viết trên nhánh `dt-03-phan-3c`.
- Cơ sở dữ liệu: năm học có `data_import_jobs`, giấy khai sinh cho phép trống với trẻ nhập (tệp 0007); định danh có quyền `P01.import.children` (tệp 0012).
- Máy chủ API: mẫu Excel, kiểm tra và ghi tệp lớp, tệp trẻ kèm phụ huynh, nhập mã ngành, bộ lọc thiếu giấy khai sinh; tệp vượt dung lượng trả `ERR_VALIDATION`.
- Cổng quản trị: màn hình Nhập dữ liệu (MH-40); Hồ sơ trẻ có bộ lọc và bổ sung giấy khai sinh.
- Kết quả: máy chủ API 116/116, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 22/22.

#### Quyết định

- Trẻ nhập vào thẳng đang học, bổ sung giấy khai sinh sau; mẫu mã ngành của hệ thống; nhập lớp và trẻ kèm phụ huynh (YCTD-46) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-46 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.1.

#### Vấn đề tồn đọng

- CTC-P01-079, 082 (nhập công nợ, nhân sự) làm ở P05, P07; chuyển trẻ sang năm mới (GD-90) làm cùng lên lớp.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-03 phần 3b: hồ sơ trẻ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 11 (phần 3a) vào nhánh chính.
- Hỏi Eric năm điểm của phần 3b; Eric duyệt thiết kế; viết trên nhánh `dt-03-phan-3b`.
- Hạ tầng: SeaweedFS trong docker compose và GitHub Actions; khóa mã hóa số định danh; lệnh `generate-data-keys`.
- Cơ sở dữ liệu: năm học có mười bảng của hồ sơ trẻ (tệp 0006); định danh có quyền `P02.child.manage`, `P02.national-id.view` (tệp 0011).
- Dịch vụ định danh: tạo tài khoản phụ huynh khi duyệt hồ sơ, thêm vai trò VT-14 cho tài khoản nhân sự trùng số điện thoại.
- Máy chủ API: hồ sơ trẻ, phụ huynh, sức khỏe, đồng ý hình ảnh, trình duyệt, duyệt và phân lớp, từ chối, chuyển lớp, xem đầy đủ số định danh, tệp đính kèm, hàng đợi thông báo.
- Cổng quản trị: màn hình Hồ sơ trẻ (MH-02); màn hình Lớp học hiện sĩ số đang học.
- Kết quả: máy chủ API 107/107, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 21/21.

#### Quyết định

- Đồng ý hình ảnh ba trạng thái; phạm vi xem trẻ theo lớp với giáo viên; kho tệp SeaweedFS thay MinIO; chuyển trẻ sang năm mới để lại đợt sau (YCTD-45) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-45 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.0.

#### Vấn đề tồn đọng

- CTC-P02-013 (gán mã ngành trùng qua nhập tệp) làm ở phần 3c; CTC-P02-033 cần nhà cung cấp tin nhắn.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-03 phần 3a: lớp học

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 10 (DT-02) vào nhánh chính.
- Hỏi Eric năm điểm của DT-03; Eric duyệt thiết kế phần 3a; viết trên nhánh `dt-03-phan-3a`.
- Cơ sở dữ liệu: năm học có `classes`, `class_staff_assignments` (tệp 0005); định danh có quyền `P02.class.manage` (tệp 0010).
- Dịch vụ định danh: danh bạ nhân sự theo vai trò và đơn vị.
- Máy chủ API: lớp học, phân công giáo viên, kiểm tra bậc học, phòng học, vai trò người được phân công.
- Cổng quản trị: nhóm điều hướng Trẻ và lớp, màn hình Lớp học (MH-03).
- Kết quả: máy chủ API 87/87, dịch vụ định danh 35/35, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 19/19.

#### Quyết định

- DT-03 chia ba phần; giáo viên chọn theo tài khoản; một lớp nhiều giáo viên chủ nhiệm; số điện thoại phụ huynh trùng tài khoản nhân sự thì thêm vai trò VT-14; thông báo ghi hàng đợi (YCTD-44) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-44 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.9.

#### Vấn đề tồn đọng

- Phần điểm danh của CTC-P02-042 chạy khi có P04.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-02: đăng nhập của phụ huynh

#### Công việc đã thực hiện

- Gộp các yêu cầu gộp số 4 đến 9 vào nhánh chính, hoàn tất DT-01.
- Hỏi Eric bốn điểm của DT-02; Eric duyệt thiết kế; viết trên nhánh `dt-02`.
- Cơ sở dữ liệu định danh: tệp 0009 cho mật khẩu mặc định, `sessions.login_method`, bảng `one_time_codes`.
- Dịch vụ định danh: đăng nhập bằng mật khẩu mặc định, mã một lần, lớp gửi tin nhắn, cấu hình chung mới, tạo tài khoản phụ huynh dùng mật khẩu mặc định, cookie mã làm mới riêng theo kênh.
- Cổng quản trị: màn hình Cấu hình phần Tài khoản có mật khẩu mặc định và thông số mã một lần; màn hình Tài khoản báo tài khoản phụ huynh dùng mật khẩu mặc định.
- Ứng dụng phụ huynh: đăng nhập bằng mật khẩu hoặc mã, đặt mật khẩu mới khi kích hoạt, trang chủ tạm.
- Kiểm thử giao diện phát hiện cổng quản trị và ứng dụng phụ huynh dùng chung cookie mã làm mới; đã sửa bằng cookie riêng theo kênh.
- Kết quả: dịch vụ định danh 35/35, máy chủ API 80/80, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 17/17.

#### Quyết định

- Mật khẩu mặc định toàn trường; thông số mã một lần có mặc định, Hiệu trưởng sửa được; lớp gửi tin nhắn nối sau; làm màn hình ứng dụng phụ huynh; bỏ `POST /auth/activate` (YCTD-43) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-43 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.8.

#### Vấn đề tồn đọng

- P19-06 chỉ nghiệm thu xong khi có tài khoản nhà cung cấp tin nhắn (T1).
- CTC-DD-011, 042 còn phần cần P02; CTC-DD-013, 015, 024 chưa chạy.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-01 phần 6b: các danh mục

#### Công việc đã thực hiện

- Hỏi Eric bốn điểm tài liệu chưa rõ trước khi thiết kế; Eric duyệt thiết kế; viết trên nhánh `dt-01-phan-6b`.
- Cơ sở dữ liệu: năm học có `departments`, `job_titles`, `catalog_items`, `approval_thresholds`, `rooms`, `grade_levels` (tệp 0004); định danh có bốn mã quyền mới (tệp 0008).
- Máy chủ API: điểm cuối của sáu danh mục, kiểm tra phạm vi đơn vị, ghi nhật ký thao tác, chuyển danh mục khi mở năm học mới.
- Cổng quản trị: MH-49 Phòng ban và chức danh, MH-50 Danh mục dùng chung, MH-33 Hạn mức phê duyệt, MH-34 Phòng học và bậc học; bộ lọc nhật ký thao tác thêm các danh mục.
- Kết quả: máy chủ API 80/80 (gồm 16 ca của danh mục), dịch vụ định danh 21/21, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 15/15.

#### Quyết định

- Danh mục dùng chung có bốn loại do hệ thống định nghĩa; VT-06 quản lý phòng ban và chức danh trong đơn vị; hạn mức có hiệu lực ngay; độ tuổi bậc học theo tháng (YCTD-42) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-42 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.7.

#### Vấn đề tồn đọng

- CTC-P01-023, 027, 060 đến 066, 068, 070, 071, 074 và phần chọn bậc học của 073 cần hồ sơ nhân sự, lớp học, chứng từ ở các đợt sau.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Ngày chốt học phí và chốt công

#### Công việc đã thực hiện

- Eric cho biết ngày chốt học phí là mùng 1 tháng sau; hỏi lại hai điểm và sửa tài liệu, mã nguồn phần 6a.

#### Quyết định

- Chốt học phí mặc định mùng 1 tháng sau, vẫn cấu hình được; chốt công cố định mùng 1 tháng sau (YCTD-41) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-41 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.6.

#### Vấn đề tồn đọng

- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — DT-01 phần 6a: cấu hình và nhật ký thao tác

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 6a. Viết trên nhánh `dt-01-phan-6a`.
- Cơ sở dữ liệu: năm học có `settings` và cột `audit_logs.actor_name`; định danh có `identity_settings`, cột `identity_audit_logs.actor_name`, quyền `P01.setting.manage` cho VT-02, VT-03.
- Máy chủ API: danh mục mười mục cấu hình, kế thừa đơn vị, Trường chính, mặc định; ghi nhật ký; chuyển cấu hình khi mở năm học; tra nhật ký thao tác theo phạm vi đơn vị.
- Dịch vụ định danh: số ngày tự khóa đọc, sửa trên cổng; khóa tài khoản lâu không đăng nhập ở lần đăng nhập kế tiếp; tra nhật ký tài khoản và quyền.
- Cổng quản trị: màn hình Cấu hình và MH-31 Nhật ký thao tác, nhật ký chỉ hiện các trường thay đổi.
- Kết quả: máy chủ API 64/64 (gồm CTC-P01-044 đến 048, 051, 053, 054), dịch vụ định danh 21/21 (gồm CTC-DD-006), cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 12/12.

#### Quyết định

- Không có quyết định mới ngoài YCTD-40.

#### Thay đổi

- `17` ghi giao kèo cấu hình và nhật ký; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.5.

#### Vấn đề tồn đọng

- CTC-P01-049, 050, 052, 055 đến 058 cần dữ liệu tài chính, lớp, hóa đơn và nhật ký truy cập ở các đợt sau.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 6a: cấu hình và nhật ký

#### Công việc đã thực hiện

- Trình thiết kế phần 6a và bốn câu hỏi về cấu hình.

#### Quyết định

- Cấu hình chưa có mặc định trong tài liệu để trống, bắt buộc cấu hình; kế thừa từ Trường chính; VT-02, VT-03 sửa cấu hình; số ngày tự khóa mặc định 90, Hiệu trưởng sửa trên cổng (YCTD-40) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-40 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.4.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 6a.

### 2026-10-09 — DT-01 phần 5: tài khoản, vai trò, quyền

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 5. Viết trên nhánh `dt-01-phan-5`.
- Cơ sở dữ liệu định danh: `0006_add_account_management` tạo `identity_audit_logs` và thêm `P01.account.manage-in-unit` cho VT-03.
- Dịch vụ định danh: tạo, sửa, khóa, mở khóa tài khoản, đặt lại mật khẩu bằng mật khẩu tạm, gán và gỡ vai trò, tạo vai trò, sửa ma trận quyền, danh sách quyền; kiểm tra phạm vi theo PQ-13 bằng cây đơn vị đọc qua máy chủ API; thu hồi phiên khi khóa, đặt lại mật khẩu, đổi vai trò; giới hạn đăng nhập đọc được từ biến môi trường `LOGIN_REQUESTS_PER_MINUTE`, mặc định 10.
- Cổng quản trị: MH-30 gồm màn hình Tài khoản và Vai trò và quyền; mục điều hướng chỉ hiện với người có quyền quản lý tài khoản; máy chủ phát triển chuyển `users`, `roles`, `permissions` sang dịch vụ định danh.
- Kết quả: máy chủ API 54/54 (gồm CTC-P01-030 đến 035, 037 đến 039, 041, 042, CTC-DD-035, 039, 040), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 10/10.

#### Quyết định

- Không có quyết định mới ngoài YCTD-39.

#### Thay đổi

- `17` ghi giao kèo nhóm tài khoản, vai trò, quyền, điểm cuối gỡ vai trò và quy tắc chuyển tiếp của cổng vào; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.3.

#### Vấn đề tồn đọng

- CTC-P01-036 (khóa khi chấm dứt hợp đồng) làm ở DT-06; CTC-P01-040, 043 cần điểm cuối nghiệp vụ của kế toán và hồ sơ trẻ.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 5: tài khoản, vai trò, quyền

#### Công việc đã thực hiện

- Trình thiết kế phần 5 và bốn câu hỏi về phân quyền quản lý tài khoản.

#### Quyết định

- VT-01, VT-02 quản lý mọi tài khoản và sửa ma trận quyền; VT-03 tạo tài khoản với mọi vai trò trừ VT-01, VT-02 trong đơn vị được gán; hệ thống sinh mật khẩu tạm khi đặt lại (YCTD-39) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-39 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.2.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 5.

### 2026-10-09 — DT-01 phần 4: cây đơn vị hai cấp

#### Công việc đã thực hiện

- Eric duyệt YCTD-38 và thiết kế phần 4. Viết trên nhánh `dt-01-phan-4`.
- Cơ sở dữ liệu năm học: `0002_create_org_units_and_audit_logs` tạo `org_units` có ràng buộc một Trường chính, đơn vị cấp 2 chỉ trực thuộc Trường chính ở tầng dữ liệu, và `audit_logs`. Cơ sở dữ liệu định danh: `0005_add_org_unit_permission` thêm `P01.org-unit.manage` cho VT-02.
- Máy chủ API: tạo, sửa, ngừng sử dụng đơn vị; cây và danh sách phẳng lọc theo loại; ghi nhật ký thao tác; bước chuyển cây đơn vị khi mở năm học, giữ nguyên mã định danh; lớp đơn vị của phân quyền: gán ở Trường chính là toàn trường, gán ở đơn vị cấp 2 chỉ có đơn vị đó.
- Cổng quản trị: MH-32 Cây đơn vị, dạng cây và danh sách phẳng.
- Kết quả: máy chủ API 41/41 (gồm CTC-P01-001 đến 005, 007, 008, 012 và lớp đơn vị theo CTC-P01-009 đến 011 với điểm cuối kiểm thử), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 7/7.

#### Quyết định

- Không có quyết định mới ngoài YCTD-38.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối cây đơn vị; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.1.

#### Vấn đề tồn đọng

- CTC-P01-009 đến 011 kiểm lại với danh sách lớp và trẻ ở DT-03.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 4: cây đơn vị

#### Công việc đã thực hiện

- Trình thiết kế phần 4; Eric cho biết trường chỉ có hai cấp; đánh giá ảnh hưởng và trình YCTD-38.

#### Quyết định

- Cây đơn vị hai cấp, cấp 2 chọn loại Phân hiệu hoặc Điểm trường, Trường chính có lớp, nhãn cố định; chặn ngừng sử dụng đơn vị còn đơn vị con đang hoạt động (YCTD-38) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-38 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.0.

#### Vấn đề tồn đọng

- Viết mã phần 4.

### 2026-10-09 — DT-01 phần 3: năm học

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 3. Viết trên nhánh `dt-01-phan-3`.
- Cơ sở dữ liệu hệ thống: `0002_create_academic_year_tables` tạo `academic_years`, `academic_terms`, `school_weeks`, `academic_year_databases`, có chỉ mục bảo đảm chỉ một năm đang dùng. Cơ sở dữ liệu định danh: `0004_add_academic_year_permission` thêm `P01.academic-year.manage` cho VT-02.
- Tài khoản `api_service` có quyền tạo cơ sở dữ liệu; bỏ cơ sở dữ liệu năm học tạo tay trong Docker và biến `SCHOOL_YEAR_DATABASE_URL`; công cụ thay đổi cấu trúc chạy trên năm học đang dùng (QU-11).
- Máy chủ API: tạo năm học, lưu lịch, đánh số tuần, đánh dấu tuần nghỉ, mở năm học gồm kiểm tra, tạo cơ sở dữ liệu, chạy tệp thay đổi cấu trúc, chuyển dữ liệu, đóng năm cũ và chuyển sang chỉ đọc; khung bước chuyển năm học để các phân hệ sau tự thêm bước.
- Cổng quản trị: màn hình Năm học gồm MH-45 và MH-43; thêm `StatusBadge`, `ConfirmDialog`, `Toast` vào `packages/ui`.
- Kiểm thử giao diện chạy trên cơ sở dữ liệu hệ thống riêng `school_system_e2e` và cổng riêng, chuẩn bị lại trước mỗi lần chạy.
- Kết quả: máy chủ API 26/26 (gồm CTC-P01-013, 018, 099 đến 104 và khung kiểm tra, chuyển dữ liệu của CTC-P01-096, 097), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 5/5.

#### Quyết định

- Không có quyết định mới ngoài YCTD-37.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối năm học và trường `rule_code`; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.6.

#### Vấn đề tồn đọng

- CTC-P01-014 đến 017, 096 đến 098 cần dữ liệu trẻ và công nợ, chạy ở DT-03 và DT-05; CTC-P01-019 chạy khi có tệp thay đổi cấu trúc năm học thứ hai.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 3: năm học

#### Công việc đã thực hiện

- Đọc tài liệu cho phần 3, phát hiện mâu thuẫn giữa AC-194, CB-10 và BR-89, CTC-P01-096 đến 098 về việc năm cũ còn ghi được sau khi mở năm mới; trình Eric thiết kế phần 3.

#### Quyết định

- Mở năm học mới là đóng năm cũ trong một thao tác; lịch năm học sửa được cho tới khi đóng (YCTD-37) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-37 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.5.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 3.

### 2026-10-09 — DT-01 phần 2: kiểm tra mã phiên, quyền và màn hình đăng nhập

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 2. Viết trên nhánh `dt-01-phan-2`.
- Thêm gói `packages/server`: mô hình lỗi, bộ lọc lỗi, đồng hồ, kiểm tra mã phiên bằng khóa công khai; dịch vụ định danh chuyển sang dùng gói này.
- Dịch vụ định danh trả mã làm mới bằng cookie httpOnly, SameSite=Strict, Secure, đường dẫn `/api/v1/auth`; đăng xuất xóa cookie (BM-71).
- Máy chủ API: kiểm tra mã phiên ở mọi điểm cuối trừ kiểm tra sức khỏe; hỏi `GET /api/v1/auth/me` ở mỗi yêu cầu (QĐ-20); khai báo quyền cần có cho từng điểm cuối; trả phạm vi đơn vị của từng quyền; từ chối mã phiên còn bắt buộc đổi mật khẩu.
- Cổng quản trị: MH-47 Đăng nhập, MH-48 Đổi mật khẩu, khung trang điều hướng dọc bên trái, tự làm mới mã phiên, đăng xuất; thêm thành phần `Button`, `TextField`, `Alert` và mã màu theo `15` vào `packages/ui`.
- Thêm gói `tests` chạy Playwright; GitHub Actions sinh khóa tạm, cài Chromium và chạy kiểm thử giao diện.
- Kết quả: dịch vụ định danh 20/20, máy chủ API 9/9 (gồm CTC-DD-035, 036, 037, 041), cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 3/3; kiểm tra kiểu, quy tắc viết mã, định dạng đạt.

#### Quyết định

- Cookie mã làm mới áp dụng cho cả ba kênh trình duyệt – người quyết định: Eric.

#### Thay đổi

- Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.4.

#### Vấn đề tồn đọng

- CTC-DD-035 mới kiểm được phần từ chối ngay khi mất vai trò; phần thu hồi mã làm mới khi đổi quyền làm cùng điểm cuối gán vai trò ở phần 5. CTC-DD-041 kiểm lại khi có điểm cuối nghiệp vụ thật.
- Lớp đơn vị mới trả đơn vị được gán; mở rộng sang đơn vị con làm ở phần 4 khi có cây đơn vị.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 2

#### Công việc đã thực hiện

- Trình thiết kế phần 2: máy chủ API kiểm tra mã phiên và quyền, màn hình đăng nhập và đổi mật khẩu trên cổng quản trị.

#### Quyết định

- Mã làm mới lưu trong cookie httpOnly; thêm gói `packages/server`; điều hướng dọc bên trái; làm kiểm thử Playwright ngay (YCTD-36) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-36 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.3.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 2.

### 2026-10-09 — DT-01 phần 1: phần lõi dịch vụ định danh

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 1. Viết trên nhánh `dt-01-phan-1`.
- Cơ sở dữ liệu định danh: tệp thay đổi cấu trúc `0002_create_account_tables` tạo `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `security_events`; `0003_seed_roles_and_permissions` tạo 19 vai trò và 55 mã quyền theo ma trận ở `08` mục 3.
- Dịch vụ định danh: `login`, `refresh`, `logout`, `change-password`, `me`; băm mật khẩu argon2id; mã phiên ký Ed25519; mã làm mới đổi mới sau mỗi lần làm mới; tạm khóa 15 phút sau 5 lần sai; giới hạn 10 yêu cầu đăng nhập mỗi phút trên một địa chỉ mạng; mô hình lỗi kèm mã tương quan.
- Lệnh `create-platform-administrator` tạo tài khoản VT-01 đầu tiên; lệnh `generate-token-keys` sinh cặp khóa ký mã phiên.
- Kết quả: 19/19 kiểm thử của dịch vụ định danh đạt, gồm CTC-DD-001 đến 004, 007, 008, 009, 031 đến 034, 043; toàn bộ 24 kiểm thử của dự án đạt; kiểm tra kiểu, quy tắc viết mã, định dạng đạt.

#### Quyết định

- Không có quyết định mới ngoài YCTD-35.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối xác thực; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.2.

#### Vấn đề tồn đọng

- Kiểm thử để lại tài khoản kiểm thử trong cơ sở dữ liệu định danh của môi trường phát triển.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Kế hoạch đợt DT-01

#### Công việc đã thực hiện

- Đọc tài liệu cho đợt DT-01, phát hiện DT-01 phụ thuộc phần lõi dịch vụ định danh ở DT-02; trình Eric cách chia sáu phần.

#### Quyết định

- Gộp phần lõi dịch vụ định danh vào DT-01, làm theo sáu phần (YCTD-34) – người quyết định: Eric.
- QĐ-20, QĐ-21, QĐ-22 – người quyết định: Eric.
- Mật khẩu tối thiểu 8 ký tự có chữ và số; sai 5 lần tạm khóa 15 phút rồi tự mở; mã quyền theo phân hệ và hành động; tài khoản đầu tiên là VT-01 (YCTD-35) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-34, YCTD-35 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.0 đến 0.26.1.

#### Vấn đề tồn đọng

- Việc tiếp theo: trình thiết kế chi tiết DT-01 phần 1.

### 2026-10-09 — Qua cổng CG-08

#### Công việc đã thực hiện

- Eric đồng ý commit; đẩy nhánh `main` và `dt-00-nen-mong` lên GitHub sau khi Eric cấp quyền ghi.
- GitHub Actions chạy kiểm thử trên yêu cầu gộp số 1: đạt.
- Cài đặt sẵn công cụ `gh`; Eric đăng nhập bằng tài khoản `luckyshopvn`.
- Eric gộp yêu cầu gộp số 1 vào `main`. M01-3 hoàn thành, CG-08 đạt.

#### Quyết định

- Eric là người bấm gộp yêu cầu gộp vào `main` (QĐ-19).

#### Thay đổi

- Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.5.

#### Vấn đề tồn đọng

- Việc tiếp theo: trình thiết kế đợt DT-01 (`M01`). Các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — M01-3 nền móng kỹ thuật

#### Công việc đã thực hiện

- Eric duyệt thiết kế DT-00. Khởi tạo Git tại gốc dự án, nối kho https://github.com/luckyshopvn/school_management, làm trên nhánh `dt-00-nen-mong`.
- Dựng cấu trúc nhiều gói bằng pnpm theo `13` mục 4: `apps/api`, `apps/identity`, `apps/worker`, `apps/portal`, `apps/teacher`, `apps/parent`, `packages/shared`, `packages/ui`, `packages/config`, `database/`.
- Docker Compose chạy PostgreSQL 17 và Redis 7; tệp `docker/postgres/create-databases.sh` tạo ba cơ sở dữ liệu `school_identity`, `school_system`, `school_year_2026_2027` với hai tài khoản kết nối riêng.
- Tệp thay đổi cấu trúc đầu tiên của ba cơ sở dữ liệu đặt giờ Việt Nam; chạy bằng Kysely.
- GitHub Actions chạy kiểm tra định dạng, kiểm tra quy tắc viết mã, xây dựng, kiểm tra kiểu, chạy tệp thay đổi cấu trúc và kiểm thử.
- Kết quả trên máy: xây dựng, kiểm tra kiểu, kiểm tra quy tắc viết mã, kiểm tra định dạng đạt; tệp thay đổi cấu trúc chạy được trên ba cơ sở dữ liệu; 6/6 kiểm thử đạt: kiểm tra sức khỏe của `api` và `identity`, tệp thay đổi cấu trúc chạy hai lần không lỗi và đặt giờ Việt Nam trên ba cơ sở dữ liệu, tiến trình chạy nền kết nối Redis.

#### Quyết định

- Dùng TypeScript 6.0, NestJS 11, Vite 8, ESLint 10; không dùng TypeScript 7 và NestJS 12 vì vừa phát hành và chưa được các công cụ kiểm tra hỗ trợ.

#### Thay đổi

- `17` thêm điểm cuối `GET /api/v1/health`; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.4.

#### Vấn đề tồn đọng

- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Lịch năm học

#### Công việc đã thực hiện

- Eric cho biết năm học gồm hai học kỳ, bắt đầu khoảng 05/09, kết thúc khoảng tháng 5 năm sau; hỏi bốn điểm và trình thiết kế YCTD-30.
- Áp dụng YCTD-30 vào các tài liệu liên quan và thêm 15 ca vào bộ ca kiểm thử chi tiết.

#### Quyết định

- Tuần học gồm tự đánh số tuần, tuần nghỉ, ngày học trong tuần – người quyết định: Eric.
- Có kỳ hè riêng, đăng ký học hè theo từng tháng – người quyết định: Eric.
- Số phiếu thu, phiếu chi đánh theo năm học – người quyết định: Eric.
- Hiệu trưởng lập lịch năm học chung toàn trường – người quyết định: Eric.
- Đăng ký học hè đặt ở P05-13 vì gắn với tính học phí.
- Bỏ xác thực hai lớp (YCTD-31) – người quyết định: Eric.
- Chỉ dùng GitHub trước; Eric tự tạo kho riêng; môi trường phát triển chạy Docker trên máy cục bộ; GitHub Actions chỉ chạy kiểm thử; hạ tầng đám mây khi triển khai (YCTD-32) – người quyết định: Eric.
- Kho mã nguồn https://github.com/luckyshopvn/school_management; dùng Kysely (QĐ-18); nhánh theo việc, gộp qua yêu cầu gộp (QĐ-19); commit đứng tên thư công ty của Eric (YCTD-33) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-30 đến YCTD-33 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.0 đến 0.25.3.

#### Vấn đề tồn đọng

- Việc tiếp theo: Eric cài Docker Desktop; sau đó M01-3 dựng nền móng DT-00 để qua CG-08. Các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — N21 bộ ca kiểm thử chi tiết

#### Công việc đã thực hiện

- Lập thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`; viết đợt 1 `01_DINH_DANH_VA_P01.md`: 42 ca dịch vụ định danh, 98 ca P01, bảng truy xuất tiêu chí nghiệm thu.
- Phát hiện ba điểm căn cứ chưa rõ, ghi thành Q-147 đến Q-149, áp dụng câu trả lời theo YCTD-26.
- Viết đợt 2 `02_P02_VA_P04.md`: 68 ca P02, 43 ca P04, bảng truy xuất tiêu chí nghiệm thu.
- Viết đợt 3 `03_P05.md`: 62 ca P05; phát hiện Q-150, Q-151, áp dụng câu trả lời theo YCTD-27.
- Viết đợt 4 `04_P06.md`: 65 ca P06; phát hiện Q-152, áp dụng câu trả lời theo YCTD-28.
- Khi chuẩn bị đợt 5, Q-153 làm rõ lương trả trước đầu tháng; hỏi thêm Q-154 đến Q-156; trình và áp dụng YCTD-29.
- Viết đợt 5 `05_P08.md`: 59 ca P08 theo cách chi lương trả trước.

#### Quyết định

- Đợt 1 `01_DINH_DANH_VA_P01.md`, đợt 2 `02_P02_VA_P04.md`, đợt 3 `03_P05.md`, đợt 4 `04_P06.md` và đợt 5 `05_P08.md` phiên bản 1.0 được phê duyệt; N21 hoàn thành – người quyết định: Eric.
- N21 chỉ viết cho chức năng giai đoạn 1, đặt ở thư mục 27, mã `CTC-...`, chia năm đợt và duyệt từng đợt – người quyết định: Eric.
- Q-147: phụ huynh chưa đổi mật khẩu mặc định vẫn đăng nhập bằng mã một lần và dùng bình thường – người quyết định: Eric.
- Q-148: người được đặt lại mật khẩu bắt buộc đổi ở lần đăng nhập kế tiếp – người quyết định: Eric.
- Q-149: công nợ của trẻ đã thôi học không chuyển sang năm mới; chặn đóng năm khi còn nợ loại này – người quyết định: Eric.
- Q-150: đăng ký trễ thu theo ngày thực tế tính từ ngày bắt đầu học dịch vụ – người quyết định: Eric.
- Q-151: còn ngày chưa chốt điểm danh thì chặn tính học phí – người quyết định: Eric.
- Q-152: thủ quỹ chọn hóa đơn và phân bổ khi lập phiếu thu tiền mặt – người quyết định: Eric.
- YCTD-29: lương trả trước đầu tháng, điều chỉnh theo công tháng trước; tháng trước chưa chốt công thì chặn tính lương; nhân sự mới không trả trước tháng đầu; nghỉ việc lập bảng quyết toán; vẫn chặn chốt công khi còn đơn chờ duyệt (Q-153 đến Q-156) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-26 đến YCTD-29 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.23.0 đến 0.24.1.

#### Vấn đề tồn đọng

- N21 hoàn thành. Việc tiếp theo: M01-3 tạo kho mã nguồn và ba môi trường để qua CG-08; các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — Rà duyệt từng tài liệu

#### Công việc đã thực hiện

- Rà `04_TONG_QUAN_DU_AN.md`: sửa cây đơn vị không giới hạn cấp, bỏ nhắc ứng lương, cập nhật nhóm đối tượng theo vai trò mới, cập nhật tích hợp bên ngoài.
- Rà `05_PHAM_VI.md`: bổ sung vào giai đoạn 1 các chức năng đã gắn G1 ở tài liệu 10 (G1-17 API cho đối tác, G1-18 nhập mã định danh, làm thêm giờ, hạn mức, năm học, chuyển đơn vị, nhật ký của bé); sửa đơn vị của trẻ theo QĐ-14; cập nhật mục chưa xác minh theo Q-02, Q-08, Q-09.
- Rà `06_YEU_CAU_NGHIEP_VU.md`: sửa cây đơn vị, QTN-03 theo BR-23, QTN-12 theo Q-09, thêm vai trò mới vào các nghiệp vụ, cập nhật mục chưa xác minh; phát hiện dịch vụ học thứ bảy mâu thuẫn với lịch học bù, áp dụng YCTD-16.
- Rà `07_QUY_TAC_NGHIEP_VU.md`: sửa BR-01, BR-03, BR-20, BR-24, BR-46, BR-53, BR-73, BR-77, trạng thái đơn nghỉ phép, mục chưa xác minh; sửa ma trận quyền phân hệ Y tế; đồng bộ phiên bản quy trình QT-01, QT-02, QT-04, QT-06 trong mục lục (mục lục ghi thấp hơn tệp).
- Rà `08_VAI_TRO_NGUOI_DUNG.md`: ma trận thêm quyền duyệt của quản lý đơn vị ở P02, P08 và quyền đăng nhập của VT-19, VT-20 ở P19; thêm ghi chú lịch nghỉ thứ 7, nhập dữ liệu ban đầu; PQ-03 và phạm vi toàn trường của VT-19, VT-20; bảng phê duyệt có ngoại lệ hoàn tiền; cập nhật mục chưa xác minh. BR-01 ở tài liệu 07 sửa theo.
- Rà `09_LUONG_NGHIEP_VU.md`: nhân sự chốt công; không chặn trẻ đi học khi nợ; đăng ký giữa tháng theo BR-26; LP-11, LP-12 gắn P13; mất mạng theo Q-09; sửa sơ đồ luồng; thêm thủ quỹ; cập nhật mục chưa xác minh.
- Rà `10_YEU_CAU_CHUC_NANG.md`: sửa người dùng, quy tắc và bước phê duyệt của P01-01, P01-08, P02-03, P02-08, P04-01, P05-02, P05-03, P05-07, P05-08, P06-01, P06-04, P06-05, P08-03, P08-04, P08-06, P08-08, P17-01, P18-01, P18-03, P19-01, P19-06; cập nhật mục chưa xác minh.
- Rà `11_TIEU_CHI_NGHIEM_THU.md`: sửa AC-26, AC-29, AC-41, AC-43, AC-58, AC-89, AC-147, AC-166, AC-180; thêm AC-206 đến AC-209 và CT-162 đến CT-165; phát hiện công thức suất ăn trừ hai lần, áp dụng YCTD-20.
- Rà `12_KIEN_TRUC_HE_THONG.md`: định danh dùng cơ sở dữ liệu riêng; sơ đồ thêm đối tác, cơ sở dữ liệu theo năm học và cơ sở dữ liệu định danh; phạm vi đơn vị theo YCTD-18; nhật ký nhạy cảm theo BR-73; thêm CB-09, CB-10; sao lưu gồm mọi cơ sở dữ liệu; cập nhật mục chưa xác minh.
- Rà `13_CONG_NGHE_SU_DUNG.md`: đổi tên mục 2 thành công nghệ đã chốt; tách thư mục `database/` theo định danh và năm học; thêm QU-11; cập nhật mục chưa xác minh.
- Rà `14_DAC_TA_GIAO_DIEN.md`: sửa vai trò ở MH-05, MH-07, MH-09, MH-10, MH-11, MH-13, MH-15, MH-28, MH-29, MH-30; MH-32 theo QĐ-14; đặt nhập mã ngành, buffet, đồng ý hình ảnh vào màn hình sẵn có; sửa BC-01, BC-08, XL-05; bỏ mục xe trong sơ đồ; cập nhật mục chưa xác minh.
- Rà `15_HE_THONG_THIET_KE.md`: nâng mọi cỡ chữ lên tối thiểu 14 theo Q-89; ghi mức tương phản 4,5:1; nút chính nền cam dùng chữ tối; thêm TD-16, TD-17, MC-06; TD-14 theo Q-119; cập nhật mục chưa xác minh.
- Rà `16_CO_SO_DU_LIEU.md`: phân ba loại cơ sở dữ liệu; giữ nguyên mã khi mở năm học; thêm `sessions`, `one_time_codes`, `class_staff_assignments`, `teaching_groups`, `teaching_group_members`; thêm cột cho trẻ con nhân viên, phiếu chi, nhật ký truy cập; hóa đơn chính và bổ sung; bỏ bảng trống ở mục P11; cập nhật mục chưa xác minh.
- Rà `17_DAC_TA_API.md`: thêm điểm cuối duyệt và từ chối giảm trừ, phiếu điều chỉnh, mở lại kỳ công, đề nghị mua hàng, hồ sơ tuyển sinh; thêm điểm cuối phân công giáo viên, tổ chuyên môn, đề nghị mua thuốc, phỏng vấn, ẩn bình luận; ghi khóa API do dịch vụ định danh quản lý; thêm KT-09; bỏ bảng trống mục xe; cập nhật mục chưa xác minh.
- Rà `18_QUY_TAC_PHAT_TRIEN_AI.md`: thêm AI-41 về cơ sở dữ liệu theo năm học, AI-42 về quyết định kiến trúc; AI-13 dẫn BR-81; mục 6 dùng tên trạng thái của quy trình; AI-10 bỏ từ tiếng Anh.
- Rà `19_CHI_DAN_HE_THONG_AI.md`: cập nhật ngữ cảnh theo QĐ-14 đến QĐ-17 và thư mục 26; câu lệnh hệ thống bỏ từ tiếng Anh, thêm ngoại lệ hạn mức và nguyên tắc 17; bảng quy ước mã bỏ dạng không dùng và thêm mười bốn nhóm tiền tố.
- Rà `20_KE_HOACH_KIEM_THU.md`: thêm PV-13 đến PV-15 cho API đối tác, cơ sở dữ liệu theo năm học, nhập dữ liệu; bổ sung phạm vi đăng nhập, thanh toán mã QR, công việc, tuyển dụng; dữ liệu kiểm thử theo GD-79 và thêm DL-11 đến DL-13; đưa câu trả lời Q-101 đến Q-104 vào nội dung; bỏ mục chưa xác minh đã lỗi thời.
- Rà `21_KICH_BAN_KIEM_THU.md`: sửa CT-007, CT-021, CT-031, CT-049, CT-067, CT-082, CT-089, CT-150 cho khớp quy tắc và tiêu chí nghiệm thu; thêm AC-211 và CT-167 cho khóa API đã thu hồi; AC-194 thêm giữ nguyên mã định danh, tài liệu 11 lên phiên bản 1.1; cập nhật mục chưa xác minh.
- Rà `22_BAO_MAT.md`: BM-17 thêm Ban Giám hiệu theo BR-53; chuyển BM-61 đến BM-69 khỏi mục giám sát về đúng mục; BM-05 ghi thời hạn phiên theo Q-120; BM-19 ghi hai trường hợp luôn ghi nhật ký; BM-42 khớp SL-01 đến SL-04; SL-01 thêm cơ sở dữ liệu hệ thống, tài liệu 12 lên phiên bản 1.1; thêm BM-70 thời hạn lưu nhật ký và dòng trách nhiệm bên thứ ba; bỏ mục chưa xác minh đã lỗi thời.
- Rà `23_LICH_SU_PHIEN_BAN.md`: hạ cấp tiêu đề các mục phiên bản từ 0.4.0; quy ước 2 dùng tên mục "thay đổi API"; quy ước 5 ghi lý do giữ tên tệp cũ; `index.md` sửa phạm vi tài liệu 24 thành YCTD-01 đến YCTD-22.
- Rà `01_KE_HOACH_TONG_THE.md`: cập nhật mô tả sản phẩm, mốc 1.0.0 và 1.1.0, trạng thái cổng, phạm vi mã; tên trạng thái theo quy trình; bỏ nội dung chờ duyệt và mục chưa xác minh đã lỗi thời; xếp năm chức năng giai đoạn 1 mới vào đợt; RR-07 theo kịch bản hiệu năng của tài liệu 20.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md`: bước 2 nhập số định danh, giấy khai sinh và từ chối trùng số định danh khi lưu; số điện thoại đã có tài khoản thì gắn phụ huynh có sẵn theo BR-08, thay cho chặn; bỏ chữ kích hoạt tài khoản và quy trình tiếp nhận lại không tồn tại; thêm AC-201.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-02_DIEM_DANH_BAO_VANG.md`: BR-56 chép đủ vế phụ huynh xác nhận người đón ngoài danh sách, sửa E6 và sơ đồ; thêm ngày học bù thứ 7 theo BR-84; thêm Ban Giám hiệu vào tác nhân; gộp dòng dữ liệu trùng, thêm ảnh bàn giao tùy chọn; quản lý đơn vị được chốt và sửa sau chốt, tài liệu 08 thêm ghi chú 15 và lên phiên bản 1.1.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-03_DANG_KY_DICH_VU_VA_TINH_HOC_PHI.md`: đăng ký trễ chờ Ban Giám hiệu duyệt và lập hóa đơn bổ sung cùng kỳ thay cho phát sinh kỳ sau; AC-29 chép theo bản đã sửa; biểu phí dùng chung toàn trường; thêm kiểm tra bán trú bắt buộc và chặn khi nợ quá hạn; quản lý đơn vị chỉ xem; Hiệu trưởng duyệt khi chưa cấu hình hạn mức; ràng buộc chống trùng áp cho hóa đơn chính.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-04_THU_HOC_PHI_VA_CONG_NO.md`: thêm thủ quỹ; luồng lỗi thanh toán mã QR E10, E11 và AC-186 đến AC-189; nhắc nợ ghi rõ giai đoạn 2; phiếu đảo chờ Ban Giám hiệu duyệt; xử lý công nợ quá hạn qua P05-12 (YCTD-23).
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-05_PHIEU_CHI_VA_QUY.md`: AC-37 theo BR-34 bắt buộc; thêm thủ quỹ và kế toán trưởng lập phiếu; phiếu chi hoàn tiền và loại chưa cấu hình hạn mức do Hiệu trưởng duyệt; phiếu đảo phiếu chi chờ Ban Giám hiệu duyệt (YCTD-24); thêm loại phiếu chi, khoản mục, nhiều quỹ; ghi rõ giai đoạn của từng phần.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-06_CHAM_CONG_VA_TINH_LUONG.md`: thêm tiền làm thêm giờ vào bước tính lương; nhân sự đề nghị và Ban Giám hiệu duyệt mở lại kỳ công; chốt công áp lịch nghỉ lễ, nghỉ thứ 7 và học bù (BR-84); phiếu chi loại lương trình duyệt theo QT-05; Hiệu trưởng duyệt khi chưa cấu hình hạn mức; thêm MH-44; chép AC-41, AC-43, AC-46 theo bản mới.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-07_DAN_THUOC_VA_CHAM_SOC_SUC_KHOE.md`: áp dụng YCTD-25: giáo viên chủ nhiệm nhận thuốc khi đơn vị không có nhân viên y tế, ảnh thuốc bắt buộc, chăm sóc hằng ngày P10-12, phụ huynh xác nhận đã biết; thêm Ban Giám hiệu vào tác nhân; GD-32 không còn hiệu lực.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-09_NHAT_KY_VA_TRAO_DOI.md`: bỏ chữ kích hoạt tài khoản; ghi nhật ký thuộc giai đoạn 1, trao đổi và góp ý thuộc giai đoạn 2; quản lý đơn vị sửa nhật ký quá hạn theo Q-67, ghi chú 15 của tài liệu 08 mở rộng và lên phiên bản 1.4.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md`: Ban Giám hiệu duyệt, ẩn và công bố lại hoạt động theo ma trận và Q-72, P14-02 thêm VT-15, VT-02; ẩn bình luận vi phạm kèm lý do (Q-70); tự ẩn hình khi phụ huynh rút đồng ý (BR-65, AC-190); giới hạn ảnh theo Q-71; ghi giai đoạn; tài liệu 17 thêm điểm cuối ẩn và công bố lại hoạt động.

#### Quyết định

- `04_TONG_QUAN_DU_AN.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `05_PHAM_VI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `06_YEU_CAU_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- Bỏ dịch vụ học thứ bảy; thứ bảy chỉ có lịch học bù chung toàn trường do Ban Giám hiệu lập – người quyết định: Eric (YCTD-16).
- `07_QUY_TAC_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt; dữ liệu sức khỏe chỉ cho giáo viên chủ nhiệm, y tế, Ban Giám hiệu, quản lý đơn vị, kế toán và phụ huynh; hoàn tiền khi trẻ thôi học luôn do Hiệu trưởng phê duyệt – người quyết định: Eric (YCTD-17).
- `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.0 được phê duyệt; kiểm toán viên luôn xem số liệu toàn trường (Q-145) – người quyết định: Eric (YCTD-18).
- `09_LUONG_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `10_YEU_CAU_CHUC_NANG.md` phiên bản 1.0 được phê duyệt; phiếu chi và quỹ tiền mặt chuyển sang giai đoạn 1 – người quyết định: Eric (YCTD-19).
- `11_TIEU_CHI_NGHIEM_THU.md` phiên bản 1.0 được phê duyệt; trường không có bữa tối; ba bữa sáng, trưa, xế thuộc bán trú; số suất bằng số trẻ có mặt; buffet là tiệc theo dịp không thu riêng – người quyết định: Eric (YCTD-20).
- `12_KIEN_TRUC_HE_THONG.md` phiên bản 1.0 được phê duyệt; chốt QĐ-01, QĐ-03, QĐ-05 – người quyết định: Eric.
- `13_CONG_NGHE_SU_DUNG.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `14_DAC_TA_GIAO_DIEN.md` phiên bản 1.0 được phê duyệt; nhân sự tự phục vụ ở cả hai kênh, thêm MH-44 (Q-146) – người quyết định: Eric (YCTD-21).
- `15_HE_THONG_THIET_KE.md` phiên bản 1.0 được phê duyệt; mọi cỡ chữ tối thiểu 14 điểm ảnh – người quyết định: Eric.
- `16_CO_SO_DU_LIEU.md` phiên bản 1.0 được phê duyệt; khoản phát sinh sau phát hành lập hóa đơn bổ sung cùng kỳ (BR-85); khóa API đặt ở cơ sở dữ liệu định danh, danh sách năm học đặt ở cơ sở dữ liệu hệ thống (QĐ-17) – người quyết định: Eric (YCTD-22).
- `17_DAC_TA_API.md` phiên bản 1.0 được phê duyệt; không thêm chức năng tự lấy lại mật khẩu – người quyết định: Eric.
- `18_QUY_TAC_PHAT_TRIEN_AI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `19_CHI_DAN_HE_THONG_AI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `20_KE_HOACH_KIEM_THU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `21_KICH_BAN_KIEM_THU.md` phiên bản 1.0 được phê duyệt; thêm ca kiểm thử khóa API đã thu hồi – người quyết định: Eric.
- `22_BAO_MAT.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `23_LICH_SU_PHIEN_BAN.md` đã rà duyệt, giữ trạng thái Đang cập nhật theo quy định của `index.md` – người quyết định: Eric.
- `01_KE_HOACH_TONG_THE.md` phiên bản 1.0 được phê duyệt; G1-15 đến G1-19 xếp vào DT-00, DT-03, DT-05, DT-06, DT-07 theo phân hệ; kiểm thử hiệu năng theo dữ liệu môi trường thử nghiệm của tài liệu 20, không dùng dữ liệu gấp năm lần – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md` phiên bản 1.3 được phê duyệt; phụ huynh nhiều con dùng một tài khoản – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-02_DIEM_DANH_BAO_VANG.md` phiên bản 1.4 được phê duyệt; quản lý đơn vị được chốt điểm danh ngày và sửa điểm danh đã chốt kèm lý do, ma trận P04 của VT-03 thành X, S – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-03_DANG_KY_DICH_VU_VA_TINH_HOC_PHI.md` phiên bản 1.7 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-04_THU_HOC_PHI_VA_CONG_NO.md` phiên bản 1.3 được phê duyệt; phiếu đảo phiếu thu do Ban Giám hiệu duyệt theo hạn mức; xử lý công nợ quá hạn do Ban Giám hiệu quyết, thêm P05-12 ở giai đoạn 2 (YCTD-23) – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-05_PHIEU_CHI_VA_QUY.md` phiên bản 1.2 được phê duyệt; phiếu đảo phiếu chi do Ban Giám hiệu duyệt theo hạn mức (YCTD-24) – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-06_CHAM_CONG_VA_TINH_LUONG.md` phiên bản 1.4 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-07_DAN_THUOC_VA_CHAM_SOC_SUC_KHOE.md` phiên bản 1.2 được phê duyệt; bổ sung nội dung gửi thuốc và chăm sóc sức khỏe theo YCTD-25, giữ giai đoạn 2: giáo viên nhận thuốc theo cấu hình đơn vị, ảnh thuốc bắt buộc và đơn tùy chọn, chăm sóc hằng ngày, phụ huynh xác nhận đã biết chỉ hiển thị trạng thái – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-09_NHAT_KY_VA_TRAO_DOI.md` phiên bản 1.1 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md` phiên bản 1.1 được phê duyệt; hoàn tất rà duyệt các đặc tả QT, CG-03 đạt – người quyết định: Eric.

#### Thay đổi

- `04_TONG_QUAN_DU_AN.md`, `05_PHAM_VI.md`, `06_YEU_CAU_NGHIEP_VU.md`, `index.md`.
- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-16 đến YCTD-25 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.13.0 đến 0.22.2.

#### Vấn đề tồn đọng

- Rà duyệt toàn bộ tài liệu đã xong; CG-01 đến CG-07 đã đạt.
- Việc tiếp theo: N21 viết bộ ca kiểm thử chi tiết; M01-3 tạo kho mã nguồn và ba môi trường để qua CG-08; các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — Xử lý hết giả định

#### Công việc đã thực hiện

- N22: hỏi Eric năm lượt (lượt 17 đến lượt 21) về giả định và các điểm cần làm rõ; cập nhật trạng thái toàn bộ 92 giả định; áp dụng các quyết định mới.
- Kiểm tra bằng truy vấn văn bản: không còn câu hỏi mở, không còn giả định chờ xác nhận, không còn quy tắc ghi chờ xác nhận; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Nhân sự chốt công; bán trú bắt buộc; đăng ký trễ do Ban Giám hiệu duyệt; trẻ nhận diện bằng số định danh và mã ngành; tài khoản phụ huynh dùng mật khẩu mặc định chung; không chia mốc trong ngày – người quyết định: Eric (YCTD-15).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-15 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.12.0.

#### Vấn đề tồn đọng

- Eric phê duyệt bộ tài liệu `04` đến `23` để qua các cổng CG-01 đến CG-07 – trạng thái: chờ xác nhận.
- N21: viết bộ ca kiểm thử chi tiết cho bốn nhóm phân hệ – trạng thái: chưa bắt đầu.
- RR-14: mật khẩu mặc định chung là rủi ro bảo mật đã được ghi nhận – trạng thái: chấp nhận theo quyết định của Eric.

### 2026-10-09 — Trả lời toàn bộ câu hỏi mở

#### Công việc đã thực hiện

- N20: hỏi Eric tám lượt (lượt 9 đến lượt 16), dùng hình thức tích chọn đề xuất cho các câu có đề xuất hợp lý và hỏi riêng các câu không được chọn; áp dụng câu trả lời vào toàn bộ bộ tài liệu.
- Sự cố khi chạy script phần A: lệnh khôi phục tự động xóa nội dung thư mục `tai_lieu` nhưng không chép lại được vì thư mục đang được dùng. Đã chép lại từ bản sao lưu ngay trước khi chạy, đối chiếu khớp hoàn toàn rồi chạy lại. Đã đổi cách chạy: script chạy trong tiến trình con và khôi phục chỉ xóa nội dung bên trong thư mục.
- Kiểm tra bằng truy vấn văn bản: không còn câu hỏi mở; không còn tham chiếu xe đưa đón ngoài các dòng ghi đã bỏ; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Bỏ phân hệ xe đưa đón; thêm năm vai trò; cây đơn vị không giới hạn cấp; mỗi năm học một cơ sở dữ liệu; API chỉ đọc cho đối tác ngay giai đoạn 1; tiền làm thêm giờ tối đa 1 giờ mỗi ngày; AI phải xin xác nhận trước mọi thay đổi mã nguồn; cùng các quyết định khác ở YCTD-14 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-14 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.11.0.

#### Vấn đề tồn đọng

- 85 giả định chưa xác nhận – trạng thái: chờ xác nhận.
- N21: viết bộ ca kiểm thử chi tiết cho bốn nhóm phân hệ – trạng thái: chưa bắt đầu.

### 2026-10-09 — Chốt các quyết định lượt 8

#### Công việc đã thực hiện

- N19: áp dụng câu trả lời lượt 8; bỏ chức năng ứng lương theo yêu cầu, giữ mã kèm ghi chú; cập nhật quy tắc quỹ tiền mặt, đồng ý hình ảnh, số định danh của trẻ.
- Kiểm tra bằng truy vấn văn bản: không còn tham chiếu ứng lương ngoài các dòng ghi "Bỏ ngày 09/10/2026"; đếm lại câu hỏi mở, giả định, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Không cho ứng lương; lương trả một lần mỗi tháng – người quyết định: Eric (Q-54, Q-56).
- Quỹ tiền mặt không âm, bắt buộc – người quyết định: Eric (Q-19).
- Đồng ý hình ảnh trên ứng dụng hoặc giấy ký tay, rút lại được – người quyết định: Eric (Q-20).
- Lưu số định danh và giấy khai sinh của trẻ, che với vai trò không cần – người quyết định: Eric (Q-35, Q-37).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-13 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.10.0.

#### Vấn đề tồn đọng

- GD-88, GD-89 mới – trạng thái: chờ xác nhận.
- 76 câu hỏi mở và 84 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 6 và lượt 7

#### Công việc đã thực hiện

- N18: áp dụng câu trả lời lượt 6 và lượt 7; thêm P01-13, P06-11 cùng dữ liệu, điểm cuối, màn hình, biện pháp bảo mật, tiêu chí và ca kiểm thử; đổi quy tắc thu tiền sang luôn trả đủ.
- Kiểm tra bằng truy vấn văn bản: đếm lại chức năng, bảng, màn hình, câu hỏi mở, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Nhập dữ liệu ban đầu từ Excel ở giai đoạn 1 – người quyết định: Eric (Q-02).
- Zalo để giai đoạn 3 – người quyết định: Eric (Q-05).
- Mốc nhắc nợ mặc định 3, 7, 15 ngày, cấu hình được – người quyết định: Eric (Q-11, Q-45).
- Thanh toán trực tuyến bằng chuyển khoản mã QR có xác nhận tự động ở giai đoạn 1 – người quyết định: Eric (Q-48, Q-81).
- Luôn phải trả đủ – người quyết định: Eric (Q-47).
- Quản lý đơn vị không xem bảng lương – người quyết định: Eric (Q-23).
- Hiệu trưởng và kế toán trưởng cùng nghiệm thu – người quyết định: Eric (Q-129).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-12 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.9.0.

#### Vấn đề tồn đọng

- Q-142: chọn nhà cung cấp tin nhắn và dịch vụ xác nhận chuyển khoản; cần trước khi nghiệm thu P19-06 và P06-11 – trạng thái: chờ xác nhận.
- 82 câu hỏi mở và 82 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 4 và lượt 5

#### Công việc đã thực hiện

- N16: áp dụng câu trả lời lượt 4 và lượt 5; đổi điểm danh sang một lần mỗi ngày trên toàn bộ tài liệu; thêm đăng nhập bằng mã một lần cho phụ huynh; chốt hạ tầng và nơi lưu mã nguồn.
- Kiểm tra bằng truy vấn văn bản: không còn tham chiếu điểm danh theo buổi; đếm lại câu hỏi mở, giả định, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Git trên GitHub kèm tích hợp và triển khai tự động từ đợt DT-00 – người quyết định: Eric (Q-130).
- Máy chủ đám mây trong nước, dữ liệu lưu tại Việt Nam – người quyết định: Eric (Q-74, Q-76).
- Phụ huynh đăng nhập bằng mật khẩu hoặc mã một lần – người quyết định: Eric (Q-24, Q-117).
- Ứng dụng phụ huynh và giáo viên dạng web ở giai đoạn 1 – người quyết định: Eric (Q-04).
- Điểm danh một lần mỗi ngày – người quyết định: Eric (Q-38).
- Đi muộn hoặc về sớm vẫn tính đủ ngày ăn – người quyết định: Eric (Q-39).
- Chốt công và học phí ngày cuối tháng – người quyết định: Eric (Q-25).
- Chặn đăng ký dịch vụ khi nợ quá hạn cấu hình theo đơn vị – người quyết định: Eric (Q-27, Q-46).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-11 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.8.0.

#### Vấn đề tồn đọng

- T1: chọn nhà cung cấp tin nhắn, cần cho thông báo và đăng nhập bằng mã một lần – trạng thái: chờ xác nhận.
- T6: thuê máy chủ đám mây trong nước – trạng thái: chờ xác nhận.
- 93 câu hỏi mở và 82 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 3

#### Công việc đã thực hiện

- N15: áp dụng câu trả lời lượt 3; thêm P05-11, P08-11 cùng bảng dữ liệu, điểm cuối, tiêu chí nghiệm thu và ca kiểm thử.
- Kiểm tra bằng truy vấn văn bản: đếm lại câu hỏi mở, chức năng, bảng, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp – người quyết định: Eric (Q-140).
- Học phí chính khóa cấu hình được, mức có thể bằng không – người quyết định: Eric (Q-141).
- Mức miễn giảm do nhà trường tự cấu hình – người quyết định: Eric (Q-16).
- Danh mục khấu trừ và số ngày phép năm do nhà trường tự cấu hình – người quyết định: Eric (Q-17, Q-18).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-10 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.7.0.

#### Vấn đề tồn đọng

- Không còn việc xây dựng nào bị chặn bởi câu hỏi nghiệp vụ. Còn 105 câu hỏi mở, 85 giả định chưa xác nhận và việc Eric phê duyệt bộ tài liệu – trạng thái: chờ xác nhận.
- Q-130: hệ thống quản lý phiên bản mã nguồn – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định ưu tiên lượt 1 và lượt 2

#### Công việc đã thực hiện

- N14: hỏi Eric hai lượt câu hỏi ưu tiên, áp dụng câu trả lời vào quy tắc nghiệp vụ, phạm vi, kiến trúc, công nghệ, dữ liệu, quy trình QT-02, QT-03, QT-05, kế hoạch tổng thể và danh sách công việc.
- Kiểm tra bằng truy vấn văn bản: đếm lại câu hỏi mở và giả định; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Phương án lưu trữ A – người quyết định: Eric (Q-77).
- Bộ công nghệ đề xuất – người quyết định: Eric (Q-79).
- Học phí giữa tháng theo ngày học thực tế – người quyết định: Eric (Q-14, Q-41).
- Lập sổ kế toán kép ở giai đoạn 3 – người quyết định: Eric (Q-01, Q-51).
- Chưa đặt mức hạn mức, cấu hình sau – người quyết định: Eric (Q-112, Q-26).
- Nhà trường tự tạo cây đơn vị; các đơn vị dùng chung biểu phí – người quyết định: Eric (Q-113, Q-122).
- Tiền ăn thu theo ngày ăn thực tế – người quyết định: Eric (Q-15, Q-43).
- Đồng ý cách xếp ba giai đoạn – người quyết định: Eric (Q-07).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-09 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.6.0.

#### Vấn đề tồn đọng

- Q-140: sổ kế toán kép theo chế độ kế toán nào; trường công lập thường áp dụng chế độ kế toán hành chính, sự nghiệp, khác Thông tư 99/2025/TT-BTC dành cho doanh nghiệp – trạng thái: chờ xác nhận.
- Q-16: mức miễn giảm và thẩm quyền, đang chặn M05 – trạng thái: chờ xác nhận.
- Q-17, Q-18: danh mục khấu trừ và số ngày phép năm, đang chặn M08 – trạng thái: chờ xác nhận.

### 2026-10-09 — Trả lời Q-139 và xác nhận GD-86

#### Công việc đã thực hiện

- N13: cập nhật P14-11; thêm AC-175, CT-131; đánh dấu GD-86 đã xác nhận.
- Kiểm tra bằng truy vấn văn bản: không có lỗi bảng, liên kết hỏng hay khối mã lẻ; đếm lại câu hỏi mở và giả định.

#### Quyết định

- Phí ngoại khóa thu theo tháng không giảm trừ khi trẻ nghỉ buổi hoặc thôi giữa tháng – người quyết định: Eric (Q-139).
- Lịch nghỉ thứ 7 và lịch học bù áp dụng cho mọi nhân sự của đơn vị – người quyết định: Eric (GD-86).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-08 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.3.

#### Vấn đề tồn đọng

- 126 câu hỏi mở và 85 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Bổ sung điểm cuối cho phân hệ Giảng dạy

#### Công việc đã thực hiện

- N12: thêm mục 7 Giảng dạy với mười tám điểm cuối vào `17_DAC_TA_API.md`; thêm bảng `class_activity_schedules` cho P03-07.
- Kiểm tra bằng truy vấn văn bản: không có lỗi bảng, liên kết hỏng hay khối mã lẻ; không tài liệu nào trỏ tới số mục cũ từ 7 trở đi của `17_DAC_TA_API.md`.

#### Quyết định

- Bổ sung điểm cuối cho phân hệ Giảng dạy – người quyết định: Eric (YCTD-07).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-07 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.2.

#### Vấn đề tồn đọng

- Q-139 và GD-86 – trạng thái: chờ xác nhận.
- Vấn đề thiếu điểm cuối P03 ghi ở hai mục nhật ký trước – trạng thái: đã xử lý.

### 2026-10-09 — Áp dụng câu trả lời Q-136 đến Q-138

#### Công việc đã thực hiện

- N11: cập nhật P08-10, P10-11, P14-10, P14-11 cùng dữ liệu, tiêu chí nghiệm thu và ca kiểm thử liên quan.
- Kiểm tra bằng truy vấn văn bản: đếm lại mã câu hỏi, giả định, tiêu chí và ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Tiêu chuẩn sức khỏe theo Bộ Y tế – người quyết định: Eric (Q-136).
- Hoạt động ngoại khóa thu phí theo từng hoạt động hoặc theo tháng – người quyết định: Eric (Q-137).
- Nghỉ thứ bảy định kỳ, trừ lịch học bù – người quyết định: Eric (Q-138).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-06 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.1.

#### Vấn đề tồn đọng

- Q-139: phí ngoại khóa theo tháng có giảm trừ khi trẻ nghỉ không – trạng thái: chờ xác nhận.
- GD-86: lịch nghỉ thứ 7 và học bù áp dụng cho mọi nhân sự của đơn vị – trạng thái: chờ xác nhận.
- `17_DAC_TA_API.md` chưa có nhóm điểm cuối cho phân hệ P03 Giảng dạy – trạng thái: chờ xác nhận.

### 2026-10-09 — Bổ sung chức năng theo tám ảnh sơ đồ chức năng

#### Công việc đã thực hiện

- N10: đối chiếu tám ảnh sơ đồ chức năng với danh sách chức năng, tìm ra mười hai nhóm mục còn thiếu; bổ sung hai mươi chức năng cùng tiêu chí nghiệm thu, ca kiểm thử, bảng dữ liệu, điểm cuối, màn hình và phạm vi.
- N10: lưu tám ảnh vào `26_SO_DO_CHUC_NANG/`.
- N10: sửa số liệu ghi nhầm về số chức năng và số bảng dữ liệu.
- Kiểm tra bằng truy vấn văn bản: đếm lại chức năng, bảng, màn hình, mã câu hỏi và giả định; không có liên kết hỏng, hàng bảng thiếu dấu `|`, khối mã lẻ.

#### Quyết định

- Bổ sung cả mười hai nhóm mục từ ảnh vào phạm vi, theo giai đoạn đề xuất – người quyết định: Eric (YCTD-05).
- Lưu tám ảnh sơ đồ chức năng vào dự án – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-05 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.0.

#### Vấn đề tồn đọng

- Q-136, Q-137, Q-138 – trạng thái: chờ xác nhận.
- `17_DAC_TA_API.md` chưa có nhóm điểm cuối cho phân hệ P03 Giảng dạy (bài học, giáo án, thời khóa biểu) – trạng thái: chờ xác nhận.

### 2026-10-09 — Chuyển sang quy trình Vibecoding_Flow và sửa các chỗ chưa khớp

#### Công việc đã thực hiện

- N9: chuyển bộ tài liệu từ `tai-lieu-thiet-ke/` sang `tai_lieu/`, đổi tên và đánh số lại theo Vibecoding_Flow, đổi phần đầu tài liệu sang mẫu mới, gộp mục lục quy trình vào `index.md`, tạo `24_YEU_CAU_THAY_DOI.md`.
- N9: sửa các chỗ chưa khớp: thuật ngữ cũ trong sơ đồ, số câu hỏi mở và giả định cũ, trạng thái mốc 0.3.0, số ứng dụng giao diện trong `13_CONG_NGHE_SU_DUNG.md`, bảng trỏ tới AC-94 đến AC-134 trong `11_TIEU_CHI_NGHIEM_THU.md`.
- N9: thống nhất phân cấp phê duyệt theo quyết định của Eric.
- Kiểm tra bằng truy vấn văn bản: không còn tên tệp cũ ngoài các mục lịch sử và bảng đối chiếu; không còn thuật ngữ "cơ sở" theo nghĩa đơn vị và "Chủ trường"; không có liên kết hỏng, hàng bảng thiếu dấu `|`, khối mã lẻ; có đủ 135 mã câu hỏi mở, sáu mã đã trả lời; đủ 84 giả định.

#### Quyết định

- Chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow – người quyết định: Eric (YCTD-01).
- Chỉ Ban Giám hiệu phê duyệt chứng từ theo hạn mức; kế toán trưởng không nằm trong luồng phê duyệt, chỉ chốt kỳ tài chính – người quyết định: Eric (YCTD-02).
- Mã dự án đổi từ SKG thành SM – người quyết định: Eric (YCTD-03, trả lời Q-132).
- Chốt kỳ tài chính do kế toán trưởng đề nghị, Hiệu trưởng phê duyệt; quản lý đơn vị không phê duyệt chứng từ thuộc danh mục hạn mức; Ban Giám hiệu phê duyệt mở lại kỳ công – người quyết định: Eric (YCTD-04, trả lời Q-133 đến Q-135).

#### Thay đổi

- Toàn bộ bộ tài liệu: đổi tên tệp theo bảng đối chiếu ở `24_YEU_CAU_THAY_DOI.md` YCTD-01; cập nhật mọi tham chiếu, trừ các mục lịch sử.
- `07_QUY_TAC_NGHIEP_VU.md`: ghi rõ chỉ Ban Giám hiệu phê duyệt chứng từ thuộc danh mục hạn mức; Hiệu trưởng phê duyệt chốt kỳ tài chính; thêm và trả lời Q-133, Q-134.
- `08_VAI_TRO_NGUOI_DUNG.md`: VT-05 mất quyền phê duyệt, thêm ghi chú 8; VT-03 chỉ phê duyệt việc không có giá trị tiền; bảng phân cấp phê duyệt mục 5 viết lại.
- `10_YEU_CAU_CHUC_NANG.md` P06-09, `16_CO_SO_DU_LIEU.md` bảng `fiscal_periods`, `17_DAC_TA_API.md` điểm cuối chốt kỳ: theo luồng đề nghị và phê duyệt chốt kỳ.
- `QT-03`, `QT-04`, `QT-05`, `QT-06` lên phiên bản 1.1: bỏ kế toán trưởng khỏi luồng phê duyệt; QT-06 thêm và trả lời Q-135; QT-05 trả lời Q-49.
- `11_TIEU_CHI_NGHIEM_THU.md` AC-35, `21_KICH_BAN_KIEM_THU.md` CT-038, `14_DAC_TA_GIAO_DIEN.md` MH-10: theo luồng phê duyệt mới.
- `04_TONG_QUAN_DU_AN.md`, `QT-01` GD-20: mã dự án SM.
- `23_LICH_SU_PHIEN_BAN.md`: thêm phiên bản 0.4.0.

#### Vấn đề tồn đọng

- Q-06: cần Eric xem lại sơ đồ chức năng để xác nhận "hình tổ màu" có phải "hình tô màu" ở P14-09 – trạng thái: chờ xác nhận. Bốn ảnh sơ đồ chức năng không có trong thư mục dự án.
- Ghi chú của công cụ khác trong `.workbuddy-ai/` vẫn trỏ đường dẫn `tai-lieu-thiet-ke/` cũ – trạng thái: chờ xác nhận có cần cập nhật không.

### 2026-10-09 — Đổi tên dự án thành School Management

**Người thực hiện:** Minh

**Nội dung:**

- Đổi tên dự án từ Sun KinderGarten thành School Management theo yêu cầu của Eric, để khớp với tên thư mục gốc `D:\School_Management`.
- Thay thế toàn bộ 43 chỗ ghi tên cũ trên 36 tệp, gồm hai mươi bốn dòng tiêu đề "Dự án:", phần thân của `01_Tong_quan_du_an.md`, `16_Cau_lenh_he_thong_AI.md` và `21_Ke_hoach_tong_the_du_an.md`, cùng cây thư mục mã nguồn dự kiến trong `10_Cong_nghe_su_dung.md`.
- Trong cây thư mục mã nguồn dự kiến, thư mục gốc đổi từ `SunKinderGarten/` thành `School_Management/`.
- Giữ nguyên phần thân của hai mục nhật ký cũ có nhắc tên cũ, vì nhật ký chỉ ghi thêm, không ghi đè. Tên cũ trong hai mục đó là ghi chép lịch sử, không phải tham chiếu còn hiệu lực.
- Cập nhật `GD-84` trong `01_Tong_quan_du_an.md` để ghi nhận tên dự án mới; đánh dấu `Q-131` đã được trả lời; thêm câu hỏi mở `Q-132` về mã dự án.
- Thêm một hàng vào bảng "Quyết định đã chốt" của `index.md`.
- Ghi phiên bản 0.3.1 vào `20_Lich_su_thay_doi.md`; thêm mã công việc `N8` vào `Checklist_cong_viec.md`.

**Tệp bị ảnh hưởng:**

- Sửa 36 tệp trong `tai-lieu-thiet-ke/`: hai mươi mốt tài liệu đánh số, `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md`, `Quy_trinh_nghiep_vu/index.md`, `Quy_trinh_nghiep_vu/Phieu_yeu_cau.md` và mười đặc tả `QT-01` đến `QT-10`.
- Không tệp nào bị đổi tên hay di chuyển.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: tên cũ chỉ còn xuất hiện ở những chỗ cố ý, gồm hai mục nhật ký lịch sử, chính mục nhật ký này, mục 0.3.1 của `20_Lich_su_thay_doi.md` và câu hỏi `Q-132`; mã `SKG` vẫn giữ nguyên tại hai mươi hai chỗ.
- Đã kiểm tra khung mã ba chấm cân bằng và không có hàng bảng thiếu dấu `|` kết thúc sau khi thay thế.

**Ghi chú:**

- Mã dự án vẫn là `SKG`, vốn là chữ viết tắt của tên cũ. Đây là điểm chưa khớp, đã ghi thành `Q-132` để Eric quyết; chưa tự đổi vì mã dự án còn được dùng trong quy tắc sinh mã trẻ tại `GD-20` của `QT-01`.
- Không đổi mã phiên bản tài liệu thành số chính vì việc đổi tên không phá vỡ nội dung nghiệp vụ, thiết kế dữ liệu hay giao diện lập trình.

### 2026-10-09 — Dời thư mục dự án sang ổ D

**Người thực hiện:** Minh

**Nội dung:**

- Dời toàn bộ thư mục dự án theo yêu cầu của Eric.
- Đường dẫn cũ: `C:\Users\vinhn\WorkBuddy AI\2026-10-09-08-11-58\SunKinderGarten\`.
- Đường dẫn mới: `D:\School_Management\`.
- Cách làm: sao chép sang ổ D trước, đối chiếu mã băm của từng tệp, xác nhận khớp hoàn toàn rồi mới xóa thư mục nguồn. Không dùng lệnh dời trực tiếp vì hai ổ khác nhau nên thao tác dời sẽ là sao chép rồi xóa, dễ mất dữ liệu nếu gián đoạn.
- Sao chép kèm thư mục `.workbuddy-ai` chứa nhật ký phiên và ghi chú dài hạn, để dự án tự chứa đủ ngữ cảnh khi mở tại vị trí mới. Thư mục `.workbuddy-ai` ở vị trí cũ vẫn giữ nguyên, không xóa.
- Thêm giả định `GD-84` và câu hỏi mở `Q-131` vào `01_Tong_quan_du_an.md`: thư mục gốc đổi tên nhưng tên sản phẩm trong tài liệu chưa đổi.

**Tệp bị ảnh hưởng:**

- Toàn bộ 36 tệp trong `tai-lieu-thiet-ke/` được dời nguyên trạng sang `D:\School_Management\tai-lieu-thiet-ke\`.
- Sửa: `01_Tong_quan_du_an.md` (thêm `GD-84`, `Q-131`), `index.md` (cập nhật số đếm giả định và câu hỏi mở), `Nhat_ky_du_an.md`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng mã băm: 36 tệp ở vị trí mới có mã băm giống từng byte so với vị trí cũ; danh sách đường dẫn tệp khớp hoàn toàn; tổng số dòng tài liệu vẫn là 6 402.
- Đã kiểm tra không có tài liệu nào chứa đường dẫn tuyệt đối tới vị trí cũ, nên việc dời không làm hỏng tham chiếu chéo. Mọi tham chiếu trong tài liệu đều là đường dẫn tương đối.

**Ghi chú:**

- Tên thư mục gốc nay là School_Management, khác tên sản phẩm Sun KinderGarten; đã ghi thành `Q-131` để Eric quyết.
- Nếu mở `D:\School_Management` làm thư mục làm việc mới, ghi chú dài hạn và nhật ký phiên nằm sẵn trong `.workbuddy-ai` ở đó.

### 2026-10-09 — Lập kế hoạch tổng thể dự án

**Người thực hiện:** Minh

**Nội dung:**

- Soạn tài liệu `21_Ke_hoach_tong_the_du_an.md`: kế hoạch tổng thể của toàn bộ dự án theo yêu cầu của Eric.
- Dựng bảng mười hai giai đoạn kèm đầu ra bắt buộc, cổng kiểm soát `CG-01` đến `CG-12` và trạng thái hiện tại của từng giai đoạn. Kết luận: dự án đang đứng ở cổng `CG-04` và `CG-05`, chưa qua được.
- Dựng bảng sáu mốc phát hành: 0.1.0, 0.2.0, 0.3.0, 1.0.0, 1.1.0, 1.2.0, gắn với ba giai đoạn sản phẩm tại `02_Pham_vi.md`.
- Dựng kế hoạch thực thi giai đoạn xây dựng thành mười hai đợt `DT-00` đến `DT-11`, mỗi đợt ghi rõ nội dung, phân hệ, mã công việc, phụ thuộc và điều kiện ra.
- Vẽ đường găng bằng sơ đồ và liệt kê bảy mắt xích đang chặn dự án, trong đó ba việc `M05`, `M06`, `M08` đang tạm dừng.
- Dựng ma trận trách nhiệm theo giai đoạn với bốn ký hiệu A, R, C, I.
- Dựng bảng ngưỡng phê duyệt thay đổi gồm sáu loại thay đổi và người phê duyệt tương ứng.
- Ghi mười hai rủi ro `RR-01` đến `RR-12` kèm mức đánh giá, ảnh hưởng và ứng phó.
- Ghi mục "Trạng thái hiện tại và việc trước mắt" với mười việc xếp theo thứ tự, ghi rõ việc nào của Eric và việc nào của Minh.
- Ghi hai giả định mới `GD-82`, `GD-83` và ba câu hỏi mở mới `Q-128` đến `Q-130`.
- Bổ sung `AI-38` và `AI-39` vào `15_Quy_tac_phat_trien_AI.md`, nguyên tắc 15 vào câu lệnh hệ thống tại `16_Cau_lenh_he_thong_AI.md`, và ba tiền tố mã `CG-xx`, `DT-xx`, `RR-xx` vào bảng quy ước mã.
- Cập nhật `index.md`: thêm tài liệu số 21, sửa số giả định từ 80 lên 83 do `GD-81` trước đây chưa được đếm, sửa số câu hỏi mở từ 127 lên 130, thêm ba hàng đếm cổng, đợt và rủi ro.
- Ghi phiên bản 0.3.0 vào `20_Lich_su_thay_doi.md`; thêm mã công việc `N7` vào `Checklist_cong_viec.md`.

**Tệp bị ảnh hưởng:**

- Tạo mới: `21_Ke_hoach_tong_the_du_an.md`.
- Sửa: `index.md`, `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md`, `20_Lich_su_thay_doi.md`, `Checklist_cong_viec.md`, `Nhat_ky_du_an.md`.

**Kết quả kiểm thử:**

- Không áp dụng. Tài liệu này là kế hoạch, chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: mã `CG-01` đến `CG-12`, `DT-00` đến `DT-11`, `RR-01` đến `RR-12` không trùng với bất kỳ tiền tố nào đã dùng; mọi bảng trong tài liệu mới đều có hàng phân cách; khối mã và sơ đồ cân bằng.

**Ghi chú:**

- Kế hoạch dùng thứ tự và điều kiện vào, điều kiện ra thay cho hạn ngày vì chưa có nguồn lực và ngày bắt đầu được xác nhận, ghi tại `GD-83` và `Q-128`.
- Tài liệu đặt trong bộ tài liệu thiết kế dưới số 21 theo quy tắc "phát sinh tài liệu mới thì đánh số tiếp theo"; xếp vào nhóm quản lý trong `index.md` vì điều phối toàn bộ vòng đời dự án.
- Ba việc Eric cần làm trước để mở đợt đầu tiên: trả lời nhóm câu hỏi ưu tiên, chốt phương án lưu trữ nhiều đơn vị và bộ công nghệ, xác nhận cách xếp ba giai đoạn.

### 2026-10-09 — Cập nhật theo bốn yêu cầu mới

**Người thực hiện:** Minh

**Nội dung:**

- Đổi vai trò Chủ trường thành Ban Giám hiệu gồm hai vai trò tách riêng: Hiệu trưởng (VT-02) và Phó Hiệu trưởng (VT-15), vì đây là trường công lập.
- Bổ sung phân cấp phê duyệt theo hạn mức: Phó Hiệu trưởng phê duyệt chứng từ dưới hạn mức, Hiệu trưởng phê duyệt từ hạn mức trở lên; thêm BR-77 đến BR-80 tại `04_Quy_tac_nghiep_vu.md` mục 12.1 và mục 5 mới trong `05_Vai_tro_nguoi_dung.md`.
- Chuyển mô hình đơn vị tổ chức từ một cấp sang ba cấp: Trường chính, Phân hiệu, Điểm trường. Cả ba cấp đều có thể có lớp; đơn vị của trẻ là đơn vị ở cấp thấp nhất nơi trẻ học.
- Thay thuật ngữ "cơ sở" bằng "đơn vị" trên toàn bộ bộ tài liệu, giữ nguyên các cụm "cơ sở dữ liệu" và "cơ sở hạ tầng". Tổng cộng sửa 31 tệp.
- Đổi bảng `branches` thành `org_units` kèm trường `unit_type` và `parent_id` tự tham chiếu; đổi cột `branch_id` thành `org_unit_id` tại `13_Luoc_do_co_so_du_lieu.md`.
- Sửa mâu thuẫn nội bộ giữa BR-01, BR-02 và GD-05 bằng cách viết lại theo mô hình ba cấp.
- Tách hoàn toàn tầng giao diện khỏi tầng máy chủ; giao diện chỉ gọi giao diện lập trình ứng dụng, không truy cập cơ sở dữ liệu. Ghi tại `09_Kien_truc_he_thong.md` mục 1 và 2, `10_Cong_nghe_su_dung.md` mục 2 và 4, `11_Dac_ta_giao_dien.md` mục 7 mới.
- Tách dịch vụ định danh độc lập tự viết khỏi máy chủ API nghiệp vụ; ghi tại `09_Kien_truc_he_thong.md` TP-11 và mục 4, `14_Dac_ta_API.md` mục 1 và 4, `19_Bao_mat.md` BM-54 đến BM-59.
- Bổ sung mã mới: BR-77 đến BR-80, GD-61 đến GD-80, Q-112 đến Q-127, AC-135 đến AC-148, CT-091 đến CT-104, PCF-11 đến PCF-13, RG-01 đến RG-06, P01-10, MH-32 và MH-33, PV-10 đến PV-12, XT-08, QU-09 và QU-10, QĐ-06 đến QĐ-10.
- Ghi phiên bản 0.2.0 vào `20_Lich_su_thay_doi.md`.

**Tệp bị ảnh hưởng:**

- Toàn bộ bộ tài liệu: `01` đến `20`, `index.md`, `Checklist_cong_viec.md`, `Nhat_ky_du_an.md` và toàn bộ thư mục `Quy_trinh_nghiep_vu/`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: không còn chỗ nào dùng "cơ sở" theo nghĩa đơn vị tổ chức; không còn "Chủ trường"; các cụm "cơ sở dữ liệu" và "cơ sở hạ tầng" giữ nguyên.

**Ghi chú:**

- Bốn quyết định này do Eric chốt ngày 09/10/2026, ghi tại `09_Kien_truc_he_thong.md` QĐ-06 đến QĐ-10.
- Mức hạn mức phê duyệt cụ thể chưa có, đã ghi thành Q-112 và Q-123.
- Số Phân hiệu và Điểm trường thực tế chưa có, đã ghi thành Q-113 và Q-122.

### 2026-10-09 — Soạn bộ tài liệu thiết kế

**Người thực hiện:** Minh

**Nội dung:**

- Phân tích nguồn đầu vào: danh sách tính năng bốn nhóm và bốn ảnh sơ đồ chức năng (Tương tác và Nội dung, Chức năng dành cho giáo viên, Chức năng dành cho phụ huynh, Chức năng dành cho kế toán) do Eric gửi.
- Xác định sản phẩm là mới hoàn toàn, không kế thừa mã nguồn của hệ thống nào; ghi nhận trong `01_Tong_quan_du_an.md` mục 1.
- Xác định 19 phân hệ, mã P01 đến P19, và xếp vào ba giai đoạn tại `02_Pham_vi.md`.
- Xác định 14 vai trò người dùng, mã VT-01 đến VT-14, kèm ma trận quyền theo phân hệ tại `05_Vai_tro_nguoi_dung.md`.
- Soạn nhóm tài liệu phân tích nghiệp vụ: `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md`.
- Soạn nhóm tài liệu thiết kế: `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md`.
- Soạn nhóm tài liệu quy tắc, kiểm thử và vận hành: `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md`.
- Soạn 10 đặc tả quy trình nghiệp vụ theo khuôn đặc tả, mã QT-01 đến QT-10, mỗi tệp đủ mười lăm mục.
- Ghi nhận 76 quy tắc nghiệp vụ, 134 tiêu chí nghiệm thu, 90 ca kiểm thử khởi đầu, 60 giả định và 111 câu hỏi mở.
- Ghi nhận ba đề xuất cần phê duyệt trước khi xây dựng: mô hình nhiều đơn vị chọn phương án tách bằng cột đơn vị, bộ công nghệ đề xuất, và cách xếp giai đoạn 1, 2, 3.

**Tệp bị ảnh hưởng:**

- Toàn bộ thư mục `tai-lieu-thiet-ke/`, gồm 20 tài liệu đánh số, ba tệp quản lý và 11 tệp trong thư mục `Quy_trinh_nghiep_vu/`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.

**Ghi chú:**

- Mọi tài liệu để ở trạng thái Chờ duyệt, chưa có nội dung nào được phê duyệt.
- Chưa xác minh được nghiệp vụ thật của trường: không có biểu mẫu, không có phỏng vấn người dùng. Đã ghi rõ ở mục "Chưa xác minh được" của từng tài liệu phân tích.
- Các điểm cần Eric quyết định trước khi chuyển bước: công thức học phí giữa tháng, mốc giảm trừ tiền ăn, mức miễn giảm và thẩm quyền phê duyệt, mốc nhắc nợ, có lập sổ kế toán kép theo Thông tư 99/2025/TT-BTC hay không, số ngày phép năm, các khoản khấu trừ trên bảng lương.

### 2026-10-09

**Người thực hiện:**

**Nội dung:**

- Khởi tạo bộ tài liệu thiết kế cho dự án Sun KinderGarten - Hệ thống quản lý trường mầm non.

**Tệp bị ảnh hưởng:**

- Toàn bộ thư mục tai-lieu-thiet-ke.

**Kết quả kiểm thử:**

- Không áp dụng.

**Ghi chú:**

- Không có.
