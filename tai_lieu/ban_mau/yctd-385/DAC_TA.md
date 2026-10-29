# YCTD-385: Biểu thống kê Thông tư 25/2024 cho phổ thông, luồng duyệt và khóa số liệu, EQMS

- Ngày: 2026-10-30
- Mức: Lớn (đổi cấu trúc khung biểu ở cơ sở dữ liệu hệ thống, thêm bảng ở cơ sở dữ liệu nền tảng, thêm quyền và màn hình cho tài khoản cấp trên, nhiều module)
- Trạng thái: Chờ Eric duyệt bản mẫu, danh sách lát và các câu hỏi ở mục 9
- Bản mẫu: `tai_lieu/ban_mau/yctd-385/index.html` (mở thẳng bằng trình duyệt; thanh trên cùng chọn màn hình, khổ, trạng thái)
- Bản chép biểu gốc: `BIEU_02_TIEU_HOC.md`, `BIEU_03_THCS.md`, `BIEU_04_THPT.md` cùng thư mục
- Đầu vào: báo cáo phân tích csdl.moet.gov.vn (mục 5, 6, 7) và báo cáo phân tích truong.hcm.edu.vn (mục 5, 8), cùng ngày 2026-10-30, lưu ngoài kho

## 1. Yêu cầu và căn cứ

Eric ngày 2026-10-30: để sau hồ sơ xin kết nối với Bộ, tập trung phát triển sản phẩm; làm các chỗ thiếu so với CSDL ngành mà báo cáo phân tích csdl.moet.gov.vn đã chỉ ra (mục 5, 6, 7 của báo cáo), theo thứ tự (a) biểu EMIS và mẫu nhập, xuất theo Thông tư 25/2024 cho Tiểu học, THCS, THPT; (b) luồng gửi, duyệt hoặc từ chối, khóa, xin mở khóa; (c) EQMS và báo cáo đội ngũ cuối năm; (d) cấp Giáo dục thường xuyên chỉ khảo sát, đề xuất.

Văn bản đã kiểm tình trạng hiệu lực ngày 2026-10-30:

| Văn bản | Nội dung dùng | Tình trạng | Nguồn kiểm |
|---|---|---|---|
| Thông tư 25/2024/TT-BGDĐT ngày 25/12/2024 | Chế độ báo cáo thống kê ngành giáo dục; Phụ lục I danh mục biểu, Phụ lục II biểu mẫu và giải thích | Có hiệu lực từ 09/02/2025, thay Thông tư 24/2018; chưa thấy văn bản sửa đổi, thay thế | Bản PDF gốc trên Cổng văn bản Chính phủ (vanban.chinhphu.vn, tệp `25-bgddt.pdf`, 225 trang, bản quét); Bộ đã triển khai kỳ cuối năm 2024-2025 theo Thông tư này (Công văn 2627/BGDĐT-KHCNTT ngày 26/5/2025) |
| Quyết định 4998/QĐ-BGDĐT ngày 31/12/2021 | Quy định kỹ thuật về dữ liệu của cơ sở dữ liệu giáo dục và đào tạo; danh mục dùng chung (137 danh mục) | Có hiệu lực từ ngày ký; Điều 4 thay Quyết định 1904/QĐ-BGDĐT (2019) và 501/QĐ-BGDĐT (2020); chưa thấy văn bản thay thế | Tóm tắt trên luatvietnam.vn; tệp gốc đã có trong thư mục khảo sát của phiên REA (ngoài kho) |
| Quyết định 1904/QĐ-BGDĐT | — | Hết hiệu lực từ 31/12/2021, không dùng | — |
| Thông tư 42/2021/TT-BGDĐT | Cơ sở dữ liệu giáo dục và đào tạo: mã trường, mã học sinh, trách nhiệm cập nhật | Đang dùng làm căn cứ của Quyết định 4998 | Báo cáo csdl.moet mục 6.1 |

**Chỗ tạm về chuẩn mã:** chưa chép bảng mã của phụ lục Quyết định 4998. Các danh mục trong việc này (dân tộc, giới tính, trạng thái, lý do thôi học, loại khuyết tật, trình độ đào tạo) dùng theo mẫu Excel của hệ thống Bộ đã có trong mã (`apps/api/src/imports/moet-columns.ts`), ghi nhãn "Tạm theo mẫu Excel của hệ thống Bộ, đối chiếu phụ lục Quyết định 4998" ở chú thích mã và ở tài liệu `16`. Việc đối chiếu là một lát riêng sau (mục 7, L9).

**Tuổi:** Thông tư 25/2024 không nêu cách tính tuổi; biểu chỉ in đậm tuổi đúng độ tuổi của lớp (lớp 1 là 6 tuổi, lớp 6 là 11 tuổi, lớp 10 là 15 tuổi). Cách tính chờ Eric chọn (Q-385-3).

## 2. Hiện trạng (đọc mã ngày 2026-10-30)

| Phần | Có | Thiếu hoặc khác |
|---|---|---|
| Mầm non | Biểu 01.ĐN-MN, 08.ĐN-NSNN, cuối năm, đội ngũ, sức khỏe, cơ sở vật chất (`apps/api/src/emis/`), gửi từng thẻ, tệp lỗi | Báo cáo truong.hcm mục 8.2: 01.ĐN-MN mới khớp khoảng 38/217 dòng, một bộ 6 cột cho mọi thẻ; 08.ĐN-NSNN chưa đủ 71 mã. Ngoài thứ tự (a) đến (d) của Eric; đề xuất lát L10 (mục 7) |
| Tiểu học, THCS, THPT | Khung biểu cấu hình được ở cơ sở dữ liệu hệ thống (`report_forms`, `report_form_rows`, migration 0027, 0028); dòng công thức tính từ lớp, học sinh; dòng nhập tay; xuất Excel, PDF; gửi qua mẫu "gửi lên cấp trên" | Hai biểu khung mỗi cấp do Claude đặt, **không theo mẫu Bộ**; một bộ cột cho cả biểu (Thông tư 25 mỗi phần một bộ cột); công thức chỉ có đối tượng `students`, `classes`; không có tuổi, tuyển mới, lưu ban, chuyển đi, bỏ học, dạng khuyết tật, đối tượng chính sách, lớp ghép; không có phần Trường, Đội ngũ, Phòng học |
| Gửi lên cấp trên (`apps/api/src/submissions/upper-level-submissions.ts`) | Chưa gửi, Đã gửi, Đã gửi yêu cầu mở khóa, Cần gửi lại; xuất tệp gửi kèm bản chụp; đánh dấu đã gửi; trường tự mở khóa (quyền hồ sơ trường) | Không có phía cấp trên: không duyệt, không từ chối, không khóa; trạng thái Duyệt, Từ chối, Đã khóa không có |
| Cấp trên (`apps/api/src/parent-org/`, `apps/platform/src/ParentOrgApp.tsx`) | Tài khoản Bộ, Sở, xã gắn đơn vị hành chính; xem số liệu tổng hợp ẩn danh của trường đã đồng ý; xin xem chi tiết | Không có danh sách báo cáo trường gửi, không duyệt |
| Mẫu nhập, xuất CSDL ngành | Mẫu học sinh 82 cột, cán bộ 75 cột của mầm non TP.HCM; cột lạ lưu `extra_columns`; số căn cước mã hóa | Không có mẫu Tiểu học, THCS, THPT; không xuất tách theo cấp cho trường liên cấp |
| Kiểm tra trước khi gửi | Hoàn thành dữ liệu theo điều kiện từng biểu; tệp lỗi liệt kê điều kiện chưa đạt | Không kiểm theo trường bắt buộc của Bộ (mẹ hoặc người đỡ đầu, lý do thôi học, ngày sinh, trình độ); không liệt kê hồ sơ cụ thể; không chặn gửi |
| EQMS | Không có | Đầu năm 5 biểu, giữa năm 3, cuối năm 3 (theo hướng dẫn sử dụng Tiểu học của Bộ) |
| Báo cáo đội ngũ cuối năm | Mầm non có 2.2 (2.2.1 đến 2.2.3); phổ thông không có | Tổng hợp cán bộ quản lý, giáo viên, nhân viên; ngoại ngữ, tin học; chuẩn nghề nghiệp |
| Giáo dục thường xuyên | Chỉ có mã cấp trong danh mục nền tảng (`0210_create_school_catalog.ts`) | Toàn bộ (mục 8) |

## 3. Bảng thiếu so với Thông tư 25/2024 theo biểu và cấp

Số dòng có mã số đếm từ bản chép biểu gốc. "Tính được" là tính từ dữ liệu hệ thống đã có hoặc sau khi mở rộng công thức ở lát của biểu; "Nhập tay" là dòng trường tự điền vì hệ thống không có nguồn hoặc nguồn ở cấp trên.

| Biểu | Dòng | Phần (số cột) | Hiện có | Tính được | Nhập tay | Ghi chú |
|---|---|---|---|---|---|---|
| 02.ĐN-TH | 164 | Trường (3), Lớp (3), Học sinh (12), Đội ngũ (15), Phòng học tập (12) | Khung 15 dòng, không khớp mã | khoảng 140 | khoảng 24: trường có tổ chức học trực tuyến, tư vấn tâm lý, kế hoạch phòng chống thiên tai (mã 06, 15, 16 nếu hồ sơ trường chưa có cờ); đối tượng chính sách (100-103) khi hồ sơ học sinh chưa ghi; kiêm nhiệm (134-137, 149) | Mã 27 và 28 cùng in "Lớp ghép" (lỗi in, đối chiếu phần mềm Bộ) |
| 02.CN-TH | 76 | Trường (3), Lớp (3), Học sinh (12), Đội ngũ (15) | Khung 13 dòng, không khớp | khoảng 60 | khoảng 16: sáp nhập, giải thể, chia tách, thành lập mới (03-06, số liệu địa bàn); chuyển đi ngoài tỉnh, ra nước ngoài khi hồ sơ chuyển chưa ghi nơi đến; học lại, thi lại hè (sau mốc 31/5); bồi dưỡng, tập huấn HIV (73-76) | Mã 02 in trên dòng "Trong đó" (lệch dòng khi in) |
| 03.ĐN-THCS | 167 | như 02.ĐN-TH | Khung chung THCS, THPT, không khớp | khoảng 140 | khoảng 27 | Nhóm trường theo các cấp trường có (THCS; TH và THCS) |
| 03.CN-THCS | 71 | Trường, Lớp, Học sinh, Đội ngũ | Không khớp | khoảng 55 | khoảng 16; thêm tốt nghiệp THCS (33-36) tính từ xét tốt nghiệp đã có | — |
| 04.ĐN-THPT | 168 | như 02.ĐN-TH; phần Trường chia ba nhóm (THPT; THCS và THPT; TH, THCS và THPT) | Không khớp | khoảng 140 | khoảng 28 (trường chuyên, nội trú là loại trường; kiêm nhiệm) | — |
| 04.CN-THPT | 70 | Trường, Lớp, Học sinh, Đội ngũ | Không khớp | khoảng 50 | khoảng 20: đủ điều kiện dự thi, công nhận tốt nghiệp, miễn thi (32-34, kết quả sau 31/5), thí sinh tự do (31, 35) | — |
| 05 GDTX | — | — | Không có | — | — | Mục 8, chỉ đề xuất |
| 06 GDKT, 07 TKTH, 08 NSNN | — | — | — | — | — | Biểu Sở lập; ngoài phạm vi trường. 07 là tổng hợp toàn tỉnh |

Một trường chỉ điền **một nhóm cột theo loại hình** (Công lập hoặc Tư thục). Cột Tổng số bằng nhóm của trường. Phần Trường của một trường là 0 hoặc 1 ở từng dòng.

**EQMS và đội ngũ (không có trong Thông tư 25/2024; là biểu của phần mềm Bộ, theo hướng dẫn sử dụng Tiểu học 7/2019):**

| Kỳ | Biểu | Nguồn trong hệ thống | Nhập tay |
|---|---|---|---|
| Đầu năm | 1.2.1 Nhân sự (thêm giáo viên tiếng Anh chuẩn năng lực); 1.2.3 Lớp, học sinh theo điểm trường; 1.2.4 Lớp, học sinh | Hồ sơ nhân sự, lớp, học sinh, điểm trường (`org_units`) | — |
| Đầu năm | 1.2.2 Cơ sở vật chất theo điểm trường; 1.2.5 Cơ sở vật chất (diện tích đất, phòng, nhà vệ sinh) | Phòng, công trình ở phân hệ Cơ sở vật chất (đếm từng phòng) | Diện tích đất, sân chơi |
| Giữa năm | 2.2.1 Chất lượng giáo dục học kỳ I (môn, hoạt động 3 mức; năng lực, phẩm chất 3 mức; khen thưởng; bỏ học theo lý do); 2.2.2 Điểm kiểm tra định kỳ học kỳ I | Đánh giá Thông tư 27 (Tiểu học), Thông tư 22 (THCS, THPT); cột nữ, dân tộc, nữ dân tộc, lớp ghép, khuyết tật | — |
| Giữa năm, cuối năm | 2.2.3, 3.2.3 Chuyên môn, cộng đồng, mô-đun tập huấn | — | Toàn bộ |
| Cuối năm | 3.2.1, 3.2.2 như giữa năm cho cả năm | như trên | — |
| Cuối năm | 3.3.1 Tổng hợp cán bộ quản lý, giáo viên, nhân viên theo trình độ, đánh giá viên chức; 3.3.2 Ngoại ngữ, tin học; 3.3.3 Chuẩn nghề nghiệp (tự đánh giá, cấp trên đánh giá) | Hồ sơ nhân sự, `professional_evaluations` | — |

Tên chỉ tiêu EQMS do hệ thống đặt theo hướng dẫn sử dụng; mỗi biểu ghi chú "Mẫu EQMS chưa có văn bản công bố, đối chiếu mẫu thật trước khi gửi".

## 4. Thiết kế (a): biểu Thông tư 25/2024 và mẫu nhập, xuất

### 4.1 Khung biểu nhiều phần

- Mở rộng khung có sẵn thay vì làm module mới: `report_forms` thêm phần (`report_form_sections`: mã phần, tên, thứ tự, bộ cột riêng); `report_form_rows` gắn phần. Biểu cũ chuyển thành một phần duy nhất, hành vi không đổi.
- Thêm cột `source` cho biểu (`tt25` khóa sửa dòng, mã; `custom` như hiện nay) để người dùng không sửa nhầm mẫu pháp định; vẫn sửa được dòng nhập tay và ghi chú.
- Kỳ thêm `mid_year` (EQMS giữa năm).
- Phòng học dùng chung nhiều cấp chỉ báo một lần, vào cấp dùng nhiều hơn (giải thích Phần V của Thông tư; báo cáo truong.hcm mục 8.2 "Liên cấp"): thêm ô "cấp báo cáo" cho phòng ở phân hệ Cơ sở vật chất, mặc định cấp có nhiều lớp dùng phòng nhất.
- Bộ cột theo phần dùng **nhóm cột của trường**: màn hình chỉ hiện nhóm theo loại hình của trường (công lập hoặc tư thục); tệp Excel xuất đủ cột của mẫu (nhóm kia để trống) cho cấp trên cộng dồn.
- Biểu khung cũ (`emis-th-dau-nam`, `emis-th-cuoi-nam`, khung THCS, THPT) giữ nguyên, đổi tên thêm "(khung cũ)", ẩn khỏi danh sách mặc định; số đã nhập không mất.

### 4.2 Công thức

Giữ cú pháp `đối tượng.điều kiện` ở `packages/shared/src/primary-reports.ts`, thêm:

| Đối tượng | Điều kiện mới | Nguồn |
|---|---|---|
| `students` | `age=<n>`, `age>=<n>`, `new_entrant`, `repeater` (lưu ban năm trước), `disability=<dạng>`, `policy=<loại>`, `multigrade`, `transfer_in_province`, `transfer_out_province`, `transfer_abroad`, `dropout`, `level_completed` | Ngày sinh; lớp năm trước ở cơ sở dữ liệu năm học trước; `moet_profile` (loại khuyết tật, chế độ); hồ sơ lớp; biến động học sinh |
| `classes` | `multigrade`, `boarding_ethnic`, `specialized`, `multi_level_school` | Hồ sơ lớp, hồ sơ trường |
| `school` (mới) | `standard=1`, `standard=2`, `electricity`, `internet`, `computers`, `accessible`, `drinking_water`, `separate_toilets`, `handwashing`, `sex_education`, `online_learning`, `counseling`, `disaster_plan`, `sites` (số điểm trường) | Hồ sơ trường (đã dùng cho 01.ĐN-MN ở `emis-01-calc.ts`); cờ chưa có thì dòng là nhập tay |
| `staff` (mới) | `role=principal|vice_principal|teacher|academic_affairs|counselor|disability_support`, `job=<vị trí việc làm>`, `qualification=<trình độ>`, `rank=1|2|3`, `age_from`, `age_to`, `standard=<mức>`, `new_hire`, `retired`, `left`, `contract=indefinite|fixed|labor` | Hồ sơ nhân sự, `moet_profile`, `professional_evaluations` |
| `rooms` (mới) | `kind=classroom|subject|multipurpose`, `subject=<môn>`, `borrowed`, `construction=permanent|semi|temporary` | Phân hệ Cơ sở vật chất (từng phòng) |

Cột tách số cho học sinh, đội ngũ: tổng, nữ, dân tộc thiểu số, nữ dân tộc thiểu số (đã có); cột phân loại hợp đồng của nhóm công lập; cột cơ sở vật chất kiên cố, bán kiên cố, tạm.

### 4.3 Kiểm tra trước khi gửi (chặn gửi, tệp thiếu thông tin)

- Bộ điều kiện theo trường bắt buộc của Bộ (báo cáo csdl.moet mục 6.2): học sinh thiếu họ tên, ngày sinh, giới tính, trạng thái; thôi học không có lý do; thiếu mẹ hoặc người đỡ đầu; cán bộ thiếu trình độ đào tạo, vị trí việc làm, hình thức hợp đồng.
- Biểu cuối năm: còn điều kiện chưa đạt thì **chặn gửi** (như Bộ chặn lập báo cáo); biểu đầu năm: cảnh báo, vẫn gửi được (giữ hành vi hiện nay). Tệp thiếu thông tin liệt kê từng hồ sơ (mã, họ tên, lớp, trường còn thiếu), không có số định danh.

### 4.4 Mẫu nhập, xuất CSDL ngành theo cấp

- Tách `moet-columns.ts` thành bộ cột theo cấp: Mầm non (giữ 82, 75 cột TP.HCM), Tiểu học, THCS, THPT (học sinh, cán bộ, lớp, kết quả học tập, khen thưởng).
- Bộ cột Tiểu học, THCS, THPT dựng theo danh sách trường dữ liệu trong hướng dẫn của Bộ, đánh dấu **mẫu tạm** đến khi có tệp mẫu tải từ tài khoản của một trường thật; cột lạ vẫn lưu `extra_columns`.
- Trường liên cấp: xuất tách mỗi cấp một tệp (như Bộ tách theo phân hệ).

## 5. Thiết kế (b): luồng duyệt, khóa, mở khóa

### 5.1 Trạng thái

| Trạng thái | Phía trường thấy | Ai chuyển |
|---|---|---|
| Chưa gửi | Sửa, xuất, gửi | — |
| Chờ duyệt | Khóa ô nhập | Trường bấm Gửi |
| Từ chối | Mở lại, hiện lý do | Cấp trên (lý do bắt buộc, tối đa 500 ký tự) |
| Đã duyệt, đã khóa | Khóa; nút Gửi yêu cầu mở khóa | Cấp trên duyệt (Q-385-2) hoặc khóa hàng loạt khi đến hạn |
| Chờ mở khóa | Khóa; hiện lý do đã gửi | Trường gửi yêu cầu kèm lý do |
| Cần gửi lại | Mở lại | Cấp trên đồng ý mở khóa |

Cấp trên từ chối yêu cầu mở khóa thì về Đã duyệt, đã khóa kèm lý do.

### 5.2 Ai duyệt

Thực tế ở TP.HCM (báo cáo truong.hcm mục 5.4): xã duyệt Mầm non, Tiểu học, THCS; Sở duyệt THPT, GDTX và trường trực thuộc Sở. Đề xuất: duyệt theo cấp của biểu; biểu Mầm non, Tiểu học, THCS gửi đơn vị xã (hoặc Phòng ở năm học cũ) mà trường đang gắn (`schools.admin_unit_id`); biểu THPT gửi Sở là đơn vị cha của đơn vị đó; trường gắn thẳng với Sở thì mọi biểu gửi Sở. Chờ Eric chọn (Q-385-1). Đơn vị cha xem được; chỉ đơn vị duyệt mới duyệt được.

Hạn gửi: cấp trên đặt hạn riêng cho trường thuộc đơn vị mình theo từng kỳ (TP.HCM năm học 2025-2026 đặt 06/10, sớm hơn hạn Bộ 30/10); chưa đặt thì dùng hạn của Thông tư. Hạn này dùng cho nút khóa hàng loạt và nhắc ở trang của trường.

### 5.3 Dữ liệu và đường đi

- Cơ sở dữ liệu nền tảng thêm `report_submissions` (trường, năm học, mã biểu, tên biểu, đơn vị duyệt, trạng thái, bản chụp số liệu tổng hợp của biểu, người gửi, giờ gửi, người duyệt, lý do, lý do xin mở khóa) và `report_submission_events` (lịch sử).
- Khi trường gửi (chế độ nhiều trường, trường đã gắn đơn vị): máy chủ API ghi bản ghi vào `report_submissions` cùng giao dịch với trạng thái ở cơ sở dữ liệu hệ thống của trường. Trạng thái duyệt đọc từ bản ghi nền tảng; trường mở trang thì đồng bộ về `upper_level_submissions`.
- Chỉ biểu số liệu tổng hợp mới gửi bản chụp lên nền tảng; biểu có hồ sơ cá nhân (lưới hồ sơ của 1.1.2 Mầm non) chỉ gửi trạng thái, cấp trên không thấy nội dung.
- Cấp trên dùng `/api/v1/parent-org/submissions` (danh sách, xem, duyệt, từ chối, khóa đến hạn, đồng ý hoặc từ chối mở khóa); mỗi thao tác ghi nhật ký nền tảng.
- Không cần trường đồng ý chia sẻ cho việc này: gửi báo cáo là việc trường chủ động làm cho đúng đơn vị quản lý.
- Chế độ một trường (không có nền tảng): giữ luồng thủ công như hiện nay, thêm nút "Ghi kết quả của cấp trên" (Duyệt hoặc Từ chối kèm lý do) để trạng thái ở trường khớp với hệ thống Bộ, Sở. Quyền mở khóa tại trường chỉ còn ở chế độ này.

## 6. Thiết kế (c): EQMS và báo cáo đội ngũ cuối năm

- Dùng cùng khung biểu nhiều phần (mục 4.1), kỳ đầu năm, giữa năm, cuối năm; gửi, duyệt theo mục 5.
- Biểu EQMS và đội ngũ ghi `source = eqms` (khóa mã do hệ thống đặt), có ghi chú cần đối chiếu.
- Điểm kiểm tra định kỳ: Tiểu học theo mức và điểm cuối học kỳ (Thông tư 27); THCS, THPT theo điểm trung bình môn (Thông tư 22).

## 7. Danh sách lát

| Lát | Nội dung | Mức | Điểm xem trước |
|---|---|---|---|
| L0 | Tài liệu này, bản mẫu, bản chép biểu gốc, phiếu YCTD-385 (chờ duyệt) | — | Bản mẫu |
| L1 | Khung biểu nhiều phần (`report_form_sections`, `source`, kỳ giữa năm), đối tượng `school`, `staff`, `rooms`, điều kiện mới của `students`, `classes`; xuất Excel đủ cột mẫu; nạp 02.ĐN-TH, 02.CN-TH; biểu khung cũ đổi tên, ẩn | Lớn | 02.ĐN-TH của trường mẫu ở ba khổ |
| L2 | 03.ĐN-THCS, 03.CN-THCS; nhóm trường theo các cấp trường có; tốt nghiệp THCS | Vừa | 03.ĐN-THCS |
| L3 | 04.ĐN-THPT, 04.CN-THPT; trường chuyên, nội trú; dự thi, công nhận tốt nghiệp | Vừa | 04.ĐN-THPT |
| L4 | Kiểm tra trước khi gửi theo trường bắt buộc, chặn gửi biểu cuối năm, tệp thiếu thông tin theo hồ sơ | Vừa | MH-622 |
| L5 | Luồng duyệt: bảng nền tảng, điểm cuối cấp trên, trang Duyệt báo cáo ở cổng cấp trên, trạng thái mới phía trường, ghi kết quả thủ công ở chế độ một trường | Lớn | MH-623, MH-624, MH-621 các trạng thái |
| L6 | EQMS đầu năm, giữa năm | Vừa | MH-625 |
| L7 | EQMS cuối năm, báo cáo đội ngũ cuối năm | Vừa | MH-626 |
| L8 | Mẫu nhập, xuất CSDL ngành Tiểu học, THCS, THPT (mẫu tạm), xuất tách theo cấp | Vừa | MH-627 |
| L9 | Đối chiếu danh mục với phụ lục Quyết định 4998, bỏ nhãn "tạm" ở chỗ khớp | Nhỏ | Bảng đối chiếu |
| L10 (đề xuất, ngoài thứ tự của Eric) | Mầm non: 01.ĐN-MN đủ 217 mã và cột theo thẻ, 08.ĐN-NSNN đủ 71 mã, 01.CN-MN đúng mẫu, chuyển sang khung nhiều phần | Vừa | 01.ĐN-MN |

Lát Lớn chờ Eric nghiệm thu trước khi gộp; lát Vừa, Nhỏ tự gộp khi đủ 11 kiểm tra CI và nhánh có `origin/main` mới nhất (AI-44). Không sửa `packages/shared/src/portal-menu.ts` (phiên tên phân hệ theo cấp đang sửa): các biểu mới nằm trong trang 7.15 và 7.18 có sẵn; mục 7.16 "Mẫu nhập, xuất CSDL ngành" ở L8 sẽ phối hợp với phiên đó.

## 8. Đề xuất (d): cấp Giáo dục thường xuyên (chỉ khảo sát, chờ Eric duyệt riêng)

Hiện trạng: mã cấp `GDTX` (mã Bộ 05) chỉ có ở danh mục nền tảng. Kiểu cấp học `'MN' | 'TH' | 'THCS' | 'THPT'` nằm ở `packages/shared/src/school-levels.ts`, `database/src/school-lifecycle.ts`, `database/school-year/schema.ts` và ràng buộc kiểm tra của khoảng 36 database migration ở ba loại cơ sở dữ liệu.

| Phương án | Cách làm | Ưu | Nhược |
|---|---|---|---|
| A. GDTX là cấp học thứ năm | Thêm `GDTX` vào mọi kiểu và ràng buộc; menu, thuật ngữ "học viên", đánh giá riêng | Đúng mô hình Bộ (phân hệ riêng) | Sửa khoảng 36 ràng buộc, mọi màn hình theo cấp; rủi ro hồi quy lớn |
| B. GDTX là loại cơ sở và chương trình | Trung tâm GDTX là loại đơn vị; lớp vẫn cấp THCS, THPT, thêm `program = gdtx` (chương trình GDTX cấp THCS, THPT, xóa mù chữ, bồi dưỡng); thuật ngữ "học viên" theo loại cơ sở; biểu 05.ĐN-GDTX, 05.CN-GDTX dựng trên khung biểu nhiều phần | Ít đụng mã; dùng lại sổ điểm, đánh giá Thông tư 22 (áp dụng cả GDTX cấp THCS, THPT) | Chương trình không theo khối (xóa mù chữ, bồi dưỡng) cần khối riêng |

Đề xuất: B, làm sau khi có khách hàng là trung tâm GDTX; cần chép biểu 05 của Thông tư 25/2024 trước khi ước lượng.

## 9. Câu hỏi chờ Eric quyết

- Q-385-1: Ai duyệt báo cáo của trường? Đề xuất: theo cấp của biểu như TP.HCM đang làm (xã duyệt Mầm non, Tiểu học, THCS; Sở duyệt THPT và trường trực thuộc).
- Q-385-5: Có làm L10 (biểu Mầm non đủ mã theo Thông tư 25/2024) không?
- Q-385-2: Duyệt và khóa? Đề xuất: duyệt là khóa ngay; đến hạn, cấp trên có nút khóa hàng loạt biểu chưa duyệt (như phần mềm Bộ: "đến hạn hoặc đã duyệt thì khóa").
- Q-385-3: Tính tuổi học sinh, giáo viên? Đề xuất: theo năm sinh (năm đầu của năm học trừ năm sinh), như quy ước độ tuổi của ngành (lớp 1 năm học 2026-2027 là sinh năm 2020).
- Q-385-4: Duyệt danh sách lát và thứ tự L1 đến L9?

## 10. Tiêu chí nghiệm thu dự kiến (cấp mã AC khi duyệt)

- Biểu 02, 03, 04 đầu năm và cuối năm có đủ dòng, mã số, tên chỉ tiêu, đơn vị tính, bộ cột từng phần đúng bản gốc Thông tư 25/2024 (so từng dòng với bản chép).
- Với dữ liệu mẫu cố định, mọi dòng tính được cho đúng số ở từng cột; dòng nhập tay lưu, khóa theo trạng thái.
- Tệp Excel xuất đủ cột của mẫu, nhóm cột không thuộc loại hình của trường để trống.
- Cấp trên chỉ thấy báo cáo của trường thuộc đơn vị mình; từ chối không có lý do bị chặn; trường thấy lý do; đã khóa thì máy chủ từ chối sửa số; mở khóa đổi trạng thái về Cần gửi lại.
- Biểu cuối năm chặn gửi khi hồ sơ thiếu trường bắt buộc; tệp thiếu thông tin không chứa số định danh.
- Mọi màn hình mới đạt rà soát giao diện ở 1366, 1024, 390 điểm ảnh.

## 11. Rủi ro

- Bản quét Thông tư có hai chỗ nghi lỗi in (02.ĐN-TH mã 27, 28; 02.CN-TH mã 02); giữ đúng bản in, ghi chú, đối chiếu phần mềm Bộ khi có tài khoản trường.
- Mẫu EQMS và mẫu Excel Tiểu học, THCS, THPT là bản tạm; có thể phải đổi cột khi có tệp thật.
- Kết quả tốt nghiệp THPT, học lại hè có sau mốc 31/5: dòng tính theo dữ liệu đã có lúc lập, cho sửa tay.
- Lưu ban năm trước đọc cơ sở dữ liệu năm học trước (AI-41): năm học đầu tiên trên hệ thống không có thì là nhập tay.
