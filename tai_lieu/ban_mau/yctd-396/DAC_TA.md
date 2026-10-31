# YCTD-396: kho minh chứng dùng chung cho kiểm định chất lượng và các bộ tiêu chí khác

- Ngày: 2026-10-31
- Mức: Lớn (dữ liệu mới xuyên năm học ở cơ sở dữ liệu hệ thống, chuyển dữ liệu của phân hệ Bảo đảm chất lượng, quyền mới, nhiều module cung cấp nguồn minh chứng)
- Trạng thái: Đã phê duyệt (Eric, ngày 2026-10-31: bản mẫu, danh sách lát, câu trả lời mục 10)
- Bản mẫu: `tai_lieu/ban_mau/yctd-396/index.html` (mở thẳng bằng trình duyệt; thanh trên cùng chọn màn hình, khổ, trạng thái)
- Mã giữ: YCTD-396; AC-1420 đến AC-1459; CT-2130 đến CT-2179; BR-533 đến BR-549; BM-271 đến BM-275; MH-678 đến MH-689; vai trò VT-23 (đoàn đánh giá ngoài). Số database migration cấp ở lát viết mã theo `main` lúc đó.

## 1. Yêu cầu và căn cứ

Eric ngày 2026-10-31: "rất nhiều công việc đã làm xong nhưng không thể đưa vào làm minh chứng; xây dựng 1 hệ thống để quản lý minh chứng". Eric chọn: minh chứng kiểm định chất lượng của nhà trường, áp dụng được cho nhiều trường hợp khác.

Mục tiêu: nhà trường gắn những gì đã làm trong phần mềm (kế hoạch, văn bản đã ký, hồ sơ chuyên môn, sổ điểm, điểm danh, hồ sơ cán bộ, báo cáo EMIS, ghi nhận rèn luyện...) và tệp tải lên làm minh chứng cho một bộ tiêu chí; theo dõi tiêu chí còn thiếu; xuất danh mục và báo cáo theo mẫu hướng dẫn.

Văn bản dùng (chỉ trích tên, số hiệu; đã tra cứu ngày 2026-10-31 trên trang tra cứu văn bản, chưa đối chiếu bản gốc của Bộ):

| Văn bản | Nội dung dùng | Ghi chú |
|---|---|---|
| Thông tư 19/2018/TT-BGDĐT | Kiểm định chất lượng giáo dục và công nhận đạt chuẩn quốc gia đối với trường mầm non | Bộ mẫu `MN-KDCL` đã có (YCTD-149) |
| Thông tư 17/2018/TT-BGDĐT | Như trên, trường tiểu học | Chưa có bộ mẫu |
| Thông tư 18/2018/TT-BGDĐT | Như trên, trường trung học cơ sở, trung học phổ thông, trường phổ thông có nhiều cấp học | Chưa có bộ mẫu |
| Thông tư 22/2024/TT-BGDĐT | Sửa đổi, bổ sung một số điều của các quy định kèm theo Thông tư 17, 18, 19/2018 | Hiệu lực từ 25/01/2025 theo trang tra cứu; bộ mẫu theo bản đã sửa đổi (Q-396-1) |
| Công văn 5932/BGDĐT-QLCL (2018) | Hướng dẫn tự đánh giá và đánh giá ngoài cơ sở giáo dục phổ thông: cách mã minh chứng `[Hn-a.b-c]`, danh mục minh chứng, mẫu báo cáo | Đối chiếu bản gốc ở lát L5 |
| Công văn hướng dẫn tự đánh giá và đánh giá ngoài trường mầm non (2018) | Như trên cho mầm non | Các nguồn ghi số hiệu khác nhau (5942 hoặc 5492); đối chiếu bản gốc ở lát L5 |

Cách mã minh chứng theo hướng dẫn: `[Hn-a.b-c]`, trong đó `H` là hộp (cặp) đựng minh chứng, `n` là số hộp, `a.b` là mã tiêu chí, `c` là số thứ tự minh chứng trong tiêu chí, hai chữ số. Ví dụ `[H1-1.1-01]`. Minh chứng dùng cho tiêu chí khác giữ mã của tiêu chí đầu tiên.

## 2. Hiện trạng (đọc mã ngày 2026-10-31)

Phân hệ "Bảo đảm chất lượng" (YCTD-149, phần 22f, PR 128) đã có phần lõi:

| Phần | Có | Thiếu so với yêu cầu |
|---|---|---|
| Bộ tiêu chuẩn | `quality_frameworks`, `quality_standards`, `quality_criteria` (có `evidence_hint`), `quality_indicators` ở cơ sở dữ liệu năm học; chép sang năm mới khi chuyển năm học; bộ mẫu Mầm non `MN-KDCL` chỉ có tên tiêu chuẩn, tiêu chí | Chỉ một loại bộ (kiểm định); không có bộ mẫu Tiểu học, THCS, THPT; không có đối tượng cá nhân (chuẩn hiệu trưởng, chuẩn giáo viên); không nhập chỉ báo từ Excel |
| Minh chứng | `quality_evidences` (mã `Hn-a.b-c`, bốn trạng thái, số kí hiệu, ngày, nơi ban hành), `quality_evidence_criteria` (dùng chung nhiều tiêu chí); tệp tối đa 20 MB | **Gắn với một đợt tự đánh giá và một năm học**: năm sau phải "kế thừa" (chép lại); không có phiên bản, không có thời hạn hiệu lực, không có người phụ trách |
| Nguồn minh chứng | Tệp tải lên; hồ sơ chuyên môn đã duyệt (18e); văn bản đến đã vào sổ (18a); văn bản đi đã phát hành (18b) | **Không gắn được** kế hoạch, sổ điểm, điểm danh, hồ sơ cán bộ, đánh giá chuẩn nghề nghiệp, biểu EMIS đã gửi, ghi nhận rèn luyện, hồ sơ công việc, quyết định khen thưởng, kết quả chuẩn thư viện... Không có nút "Dùng làm minh chứng" ở trang nguồn |
| Phân công | Nhóm công tác của đợt, mỗi tiêu chí một nhóm | Không có người phụ trách từng tiêu chí, hạn nộp; không có bảng tiêu chí còn thiếu minh chứng |
| Xuất | Danh mục minh chứng Excel, CSV; báo cáo tự đánh giá Word, PDF (theo bố cục Mầm non) | Danh mục chưa theo đúng cột mẫu hướng dẫn; báo cáo chưa có mẫu phổ thông; không có gói hồ sơ theo hộp |
| Quyền | `P09.quality.use`, `P09.quality.manage` | Không tách quyền xem kho, gắn minh chứng từ phân hệ khác |

Nền tảng dùng lại được:

- Cơ sở dữ liệu hệ thống (`Databases.system`) giữ dữ liệu của trường qua nhiều năm (văn bản, ký số, lưu trữ, hồ sơ công việc). Cơ sở dữ liệu năm học khóa chỉ đọc khi năm học đóng.
- Kho tệp `FileStorage` (SeaweedFS qua S3), tải về qua API có kiểm quyền, không dùng đường dẫn ký sẵn; nhận diện loại tệp văn phòng bằng `detectArchiveFileType`.
- Xuất bảng `buildTableFile` (exceljs, pdfmake); văn bản Word, PDF dựng tay qua `buildDocx`, `buildDocumentPdf` (`apps/api/src/kpi/kpi-documents.ts`); tác vụ xuất nền `export-jobs.ts`.
- Nhật ký thao tác `audit_logs`, `writeAuditLog`.
- Kế hoạch cải tiến nối Quản lý công việc qua `PlansService.createDraftFromModule`.

## 3. Giải pháp có sẵn (mục 16 của quy trình)

| Phương án | Đánh giá | Kết luận |
|---|---|---|
| Mở rộng phân hệ Bảo đảm chất lượng đã có | Đã có bộ tiêu chuẩn, đợt, phiếu, mã minh chứng, xuất báo cáo, e2e 80; thiếu chính là kho xuyên năm học và nguồn từ phân hệ khác | **Đề xuất** |
| Làm phân hệ minh chứng mới riêng | Trùng hai bảng minh chứng, hai giao diện; trường phải nhập hai lần | Không chọn |
| Phần mềm kiểm định có sẵn của các công ty trong nước | Sản phẩm thương mại, không mã nguồn mở, không gắn được dữ liệu của hệ thống này | Không chọn |
| Phần mềm quản lý hồ sơ mã nguồn mở (ví dụ hệ thống quản lý tài liệu, kho lưu trữ số) | Giải bài toán lưu tệp, không có mô hình tiêu chí, mã `[Hn-a.b-c]`, độ phủ; thêm một dịch vụ phải vận hành | Không chọn |
| Thư viện cho phần xuất | Đã có exceljs, pdfmake, bộ dựng Word tự viết; gói ZIP dùng thư viện nén đang có ở phần "gói ZIP toàn bộ dữ liệu" (YCTD-145) | Dùng lại, không thêm thư viện |

## 4. Thiết kế

### 4.1 Khái niệm

- **Bộ tiêu chí**: cây nhiều cấp, cấu hình được, không viết mã riêng cho từng bộ. Thuộc một **loại** (kiểm định chất lượng, chuẩn hiệu trưởng, chuẩn giáo viên, thi đua khen thưởng, trường học an toàn, kế hoạch năm học, khác), một hoặc nhiều **cấp học**, một **đối tượng** (nhà trường hoặc cá nhân), có **mẫu mã minh chứng** và **chu kỳ** (số năm học của một lần đánh giá: kiểm định 5, chuẩn giáo viên 1).
- **Nút của cây**: tiêu chuẩn, tiêu chí, chỉ báo (tên cấp do bộ đặt, ví dụ bộ chuẩn giáo viên dùng "Tiêu chuẩn, Tiêu chí, Mức"). Minh chứng gắn vào tiêu chí; chỉ báo dùng để đánh dấu đạt ở phiếu.
- **Kho minh chứng của trường**: mỗi minh chứng tồn tại một lần, nhiều năm học, nhiều bộ tiêu chí. Có mã theo từng bộ (cùng một biên bản có thể là `[H1-1.1-01]` ở bộ kiểm định và `TĐ-2.3-04` ở bộ thi đua).
- **Phiên bản**: mỗi lần thay tệp hoặc chụp lại bản ghi nguồn là một phiên bản mới; danh mục, báo cáo dùng phiên bản hiện hành; phiên bản cũ giữ để tra.
- **Nguồn**: tệp tải lên, hoặc **bản ghi trong hệ thống** qua bộ đăng ký nguồn (mục 4.4). Bản ghi được chụp thành tệp PDF đầy đủ lúc gắn (Q-396-4, Q-396-5) và giữ liên kết để mở bản gốc.
- **Đợt** (đợt tự đánh giá của 22f, hoặc đợt của bộ khác): khoảng năm học được tính, hội đồng, phiếu đánh giá. Đợt đọc minh chứng từ kho, không chép.

### 4.2 Mô hình dữ liệu (đề xuất, chốt ở lát L1)

Ở cơ sở dữ liệu hệ thống (Q-396-2), mọi bảng có `org_unit_id` của trường như các bảng văn bản:

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `evidence_frameworks` | `code`, `name`, `kind` (`accreditation`, `principal_standard`, `teacher_standard`, `emulation`, `safe_school`, `school_year_plan`, `other`), `school_levels` (mảng), `subject` (`school`, `person`), `legal_basis`, `max_level` (0 đến 4), `cycle_years`, `code_pattern`, `node_labels` (tên ba cấp), `template_code`, `template_version`, `status` (`active`, `inactive`) | Thay `quality_frameworks` ở năm học |
| `evidence_framework_nodes` | `framework_id`, `parent_id`, `depth` (1 tiêu chuẩn, 2 tiêu chí, 3 chỉ báo), `code`, `title`, `level` (mức của chỉ báo), `evidence_hint`, `suggested_sources` (mảng loại nguồn), `default_box`, `sort_order` | Thay `quality_standards`, `quality_criteria`, `quality_indicators` |
| `evidence_items` | `title`, `document_number`, `issued_date`, `issuer`, `description`, `school_year_names` (mảng năm học minh chứng thuộc về), `valid_from`, `valid_until`, `status` (`missing`, `collecting`, `sufficient`, `needs_update`), `owner_user_id`, `current_version_id`, `created_by`, `updated_at` | "Hết hiệu lực", "Sắp hết hiệu lực" tính từ `valid_until`, không lưu |
| `evidence_versions` | `evidence_id`, `version_no`, `source_kind` (`upload`, `record`), `storage_key`, `file_name`, `content_type`, `size_bytes`, `sha256`, `record_type`, `record_id`, `record_school_year`, `record_label`, `record_updated_at`, `has_personal_data`, `personal_data_permission` (quyền xem loại nguồn), `note`, `created_by`, `created_at` | Tệp lưu theo `storageKey` như hồ sơ công việc; không sửa, không xóa phiên bản đã có khi đợt đã hoàn thành |
| `evidence_codes` | `evidence_id`, `framework_id`, `primary_node_id`, `box`, `sequence`, `code` (duy nhất trong bộ) | Mã theo bộ; một minh chứng có tối đa một mã mỗi bộ |
| `evidence_node_links` | `evidence_id`, `node_id`, `is_primary` | Dùng cho nhiều tiêu chí |
| `evidence_assignments` | `framework_id`, `node_id`, `school_year_name`, `user_id`, `due_date`, `note` | Người phụ trách tiêu chí theo năm học |
| `evidence_events` | `evidence_id`, `action`, `actor`, `detail`, `created_at` | Lịch sử: tạo, thêm phiên bản, gắn, gỡ, đổi trạng thái, đánh lại số; **xem, tải tệp** (nhật ký truy cập, Q-396-5) |

Giữ ở cơ sở dữ liệu năm học (không đổi): `quality_assessments`, hội đồng, nhóm công tác, `quality_criterion_reports`. Phiếu, đợt tham chiếu nút của bộ ở hệ thống bằng mã định danh (không có khóa ngoại giữa hai cơ sở dữ liệu, như `system_document_id` đang làm).

Chuyển dữ liệu (lát L1): đọc mọi cơ sở dữ liệu năm học có bảng 22f, gộp bộ tiêu chuẩn cùng mã định danh (đã giữ khi chuyển năm), chép minh chứng sang kho: minh chứng kế thừa (`inherited_code`) gộp vào minh chứng gốc thành phiên bản; tệp giữ nguyên khóa ở kho tệp. Bảng cũ giữ chỉ đọc một phiên bản rồi mới xóa ở YCTD sau.

### 4.3 Mã minh chứng

- Mẫu mã của bộ dùng các ô `{hop}`, `{tieu_chuan}`, `{tieu_chi}`, `{stt}`; mặc định `H{hop}-{tieu_chi}-{stt}` hiển thị trong ngoặc vuông. Bộ mẫu kiểm định dùng mặc định; bộ khác trường tự đặt.
- Số hộp mặc định bằng số thứ tự tiêu chuẩn (`default_box` của nút), sửa được khi thêm minh chứng.
- Số thứ tự cấp tự động: số nhỏ nhất chưa dùng trong tiêu chí của bộ, hai chữ số (ba chữ số khi vượt 99).
- Minh chứng gắn thêm vào tiêu chí khác giữ mã của tiêu chí chính; danh mục của tiêu chí kia ghi lại mã đó.
- Mã đã cấp không tự đổi. Gỡ minh chứng để lại lỗ số; người quản lý có thao tác "Đánh lại số" cho một bộ (chỉ khi không có đợt đang ở trạng thái Đã hoàn thành dùng bộ đó), có xem trước mã cũ, mã mới, ghi lịch sử.

### 4.4 Nguồn là bản ghi trong hệ thống

Bộ đăng ký nguồn ở máy chủ: mỗi module khai báo một loại nguồn gồm mã loại, tên, quyền cần để xem nguồn, hàm tìm, hàm lấy nhãn, hàm dựng tệp chụp (PDF), hàm kiểm bản ghi đã đổi sau lần chụp. Thêm loại nguồn mới là thêm một khai báo, không sửa kho.

| Nhóm | Loại nguồn | Bản chụp | Lát |
|---|---|---|---|
| Đã có ở 22f | Văn bản đến đã vào sổ, văn bản đi đã phát hành (kèm bản đã ký), hồ sơ chuyên môn đã duyệt | Tệp gốc (bản ký nếu có) | L1 |
| Kế hoạch, điều hành | Kế hoạch công việc, kế hoạch giáo dục, kế hoạch năm học của trường, hồ sơ công việc | PDF tóm tắt kế hoạch, danh mục văn bản trong hồ sơ | L2 |
| Dạy học | Sổ điểm của lớp (một học kỳ), điểm danh của lớp (một tháng), sổ đầu bài | PDF bảng đầy đủ có tên học sinh (Q-396-5) | L2 |
| Đội ngũ | Hồ sơ cán bộ (danh sách đội ngũ theo trình độ), đánh giá chuẩn nghề nghiệp một kỳ, hồ sơ bồi dưỡng | PDF danh sách có tên, không có số định danh | L2 |
| Báo cáo | Biểu EMIS đã gửi (Thông tư 25/2024), báo cáo cơ sở vật chất, kết quả chuẩn thư viện | PDF biểu đã gửi | L2 |
| Học sinh | Ghi nhận rèn luyện một học kỳ, khám sức khỏe định kỳ, cân đo | PDF đầy đủ có tên học sinh | L7 |
| Khác | Quyết định khen thưởng, biên bản bình xét thi đua, kiểm thực ba bước, kiểm kê tài sản, kết quả kiểm tra đánh giá | Tệp đã có hoặc PDF | L7 |

Ở trang của bản ghi nguồn có nút **Dùng làm minh chứng** (MH-686): chọn bộ, tiêu chí (gợi ý tiêu chí có `suggested_sources` khớp), xem mã sẽ cấp, ghi. Nếu bản ghi đã là minh chứng thì nút thành **Minh chứng [H1-1.1-01]** mở chi tiết.

Bản ghi đổi sau lần chụp: kho gắn nhãn "Nguồn đã thay đổi", gợi ý "Chụp lại thành phiên bản mới"; không tự chụp lại.

### 4.5 Phân công và theo dõi thiếu

- Người quản lý phân công người phụ trách cho từng tiêu chí của một bộ trong năm học (MH-683), hạn hoàn thành. Nhóm công tác của đợt 22f vẫn dùng: phân công nhóm ở đợt đặt sẵn người phụ trách là trưởng nhóm, sửa được.
- Bảng độ phủ (MH-682): mỗi tiêu chí một dòng với số minh chứng đã đủ, đang thu thập, chưa có, cần cập nhật, hết hiệu lực, gợi ý minh chứng còn thiếu (theo `evidence_hint`), người phụ trách, hạn. Tiêu chí **thiếu** khi không có minh chứng ở trạng thái Đã đủ còn hiệu lực trong các năm học của chu kỳ.
- Tổng quan (MH-678): tỉ lệ tiêu chí đủ minh chứng theo từng bộ, tiêu chuẩn; tiêu chí thiếu; minh chứng sắp hết hiệu lực (30 ngày); việc của tôi.
- Việc của tôi: nguồn mới "Minh chứng": tiêu chí tôi phụ trách còn thiếu, minh chứng của tôi sắp hết hiệu lực hoặc nguồn đã thay đổi.

### 4.6 Xuất

- **Danh mục minh chứng** theo bộ, đợt (Excel, Word): cột Số thứ tự, Mã minh chứng, Tên minh chứng, Số, ngày ban hành hoặc thời điểm khảo sát, điều tra, phỏng vấn, quan sát, Nơi ban hành hoặc nhóm, cá nhân thực hiện, Ghi chú; nhóm theo tiêu chuẩn, tiêu chí; minh chứng dùng chung ghi lại mã gốc. Cột đối chiếu theo phụ lục của công văn hướng dẫn ở lát L5.
- **Báo cáo tự đánh giá** (Word, PDF): mẫu Mầm non đã có; thêm mẫu phổ thông theo Công văn 5932/BGDĐT-QLCL. Mã minh chứng trong phần mô tả hiện trạng viết dạng `[H1-1.1-01]`; khi xuất kiểm mọi mã trích dẫn có trong danh mục, mã không có thì báo trước khi xuất.
- **Gói hồ sơ minh chứng** (ZIP, tác vụ nền): thư mục theo hộp `H1`, `H2`..., tệp đặt tên theo mã, kèm danh mục; dùng khi đoàn đánh giá ngoài cần bản số. Minh chứng có dữ liệu cá nhân chỉ vào gói khi người xuất có quyền xem loại nguồn đó; lần xuất ghi nhật ký truy cập.

### 4.7 Quyền theo vai (Q-396-7, phương án A)

| Quyền | Nội dung | Vai trò mặc định |
|---|---|---|
| `P09.evidence.view` | Xem kho minh chứng, độ phủ, tải tệp (minh chứng có dữ liệu cá nhân cần thêm quyền xem nguồn) | VT-02, VT-15, VT-03, VT-17, và người được phân công tiêu chí |
| `P09.evidence.contribute` | Thêm minh chứng, phiên bản, gắn từ trang nguồn cho tiêu chí mình phụ trách | Mọi vai trò đang có `P09.quality.use` |
| `P09.evidence.manage` | Bộ tiêu chí, nạp bộ mẫu, phân công, đánh lại số, sửa, gỡ mọi minh chứng, xuất gói | VT-02, VT-15 |

- Gắn bản ghi làm minh chứng cần cả quyền xem bản ghi đó ở phân hệ nguồn; máy chủ kiểm ở mọi yêu cầu (AI-12).
- Bản chụp luôn đầy đủ, có tên học sinh (Q-396-5). Minh chứng có dữ liệu cá nhân chỉ người có quyền xem loại nguồn đó ở phân hệ nguồn tải được, kể cả người có `P09.evidence.manage`; người không đủ quyền vẫn thấy tên, mã, không tải được tệp. Mọi lần xem, tải tệp ghi `evidence_events` (người, thời điểm, phiên bản). Căn cứ và biện pháp: Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân, tài liệu `22` BM-271.
- Đoàn đánh giá ngoài (Q-396-9): vai trò mới VT-23, tài khoản chỉ đọc có ngày hết hạn, chỉ thấy bộ và đợt được giao; lát L8.
- `P09.quality.use`, `P09.quality.manage` giữ nguyên cho đợt, phiếu, hội đồng.
- Phụ huynh, học sinh không có phân hệ.

### 4.8 Menu (Q-396-3, phương án A)

Phân hệ "Bảo đảm chất lượng" đổi tên **"Minh chứng và kiểm định"**, khóa `quality-assurance` giữ nguyên:

1. Kho minh chứng: 1.1 Tổng quan (MH-678), 1.2 Danh sách minh chứng (MH-679, thay MH-255), 1.3 Độ phủ theo tiêu chí (MH-682)
2. Tự đánh giá: 2.1 Đợt tự đánh giá (MH-253), 2.2 Phiếu đánh giá tiêu chí (MH-254)
3. Thiết lập: 3.1 Bộ tiêu chí (MH-684, thay MH-257), 3.2 Phân công phụ trách (MH-683), 3.3 Theo dõi công nhận (MH-256), 3.4 Xuất danh mục và báo cáo (MH-685)

Đường dẫn cũ `/quality/evidences`, `/quality/frameworks` chuyển tới trang mới.

### 4.9 Màn hình

| Mã | Màn hình | Bản mẫu |
|---|---|---|
| MH-678 | Tổng quan minh chứng | Có |
| MH-679 | Danh sách minh chứng | Có |
| MH-680 | Chi tiết minh chứng: thông tin, tiêu chí đang dùng, phiên bản, lịch sử | Có |
| MH-681 | Thêm minh chứng: chọn nguồn (tệp hoặc dữ liệu trong phần mềm), tiêu chí, mã | Có |
| MH-682 | Độ phủ theo tiêu chí, tiêu chí còn thiếu | Có |
| MH-683 | Phân công phụ trách tiêu chí | Có |
| MH-684 | Bộ tiêu chí: danh sách, cây, nạp bộ mẫu | Có |
| MH-685 | Xuất danh mục, báo cáo tự đánh giá, gói hồ sơ | Có |
| MH-686 | Hộp thoại "Dùng làm minh chứng" ở trang nguồn (ví dụ văn bản đi) | Có |
| MH-687 đến MH-689 | Để dành cho bộ tiêu chí cá nhân (L6) | Chưa |

## 5. Quy tắc nghiệp vụ dự kiến (cấp số BR-533 trở đi khi duyệt)

1. Mã minh chứng duy nhất trong một bộ; không tự đổi khi sửa minh chứng.
2. Số thứ tự cấp số nhỏ nhất chưa dùng trong tiêu chí; đánh lại số chỉ người quản lý, có xem trước, ghi lịch sử.
3. Minh chứng dùng chung giữ mã của tiêu chí chính; gỡ tiêu chí chính khi còn tiêu chí khác thì người quản lý chọn tiêu chí chính mới, mã giữ nguyên.
4. Trạng thái Đã đủ cần có ít nhất một phiên bản; thêm phiên bản đầu tiên chuyển Chưa có thành Đã đủ.
5. Hết hiệu lực khi `valid_until` trước hôm nay; sắp hết hiệu lực trong 30 ngày; minh chứng hết hiệu lực không tính vào độ phủ.
6. Phiên bản đã dùng trong một đợt Đã hoàn thành không xóa được.
7. Không xóa minh chứng đang được trích dẫn trong phiếu đã duyệt; gỡ khỏi tiêu chí thì được.
8. Gắn bản ghi làm minh chứng cần quyền xem bản ghi; bản chụp luôn đầy đủ; minh chứng có dữ liệu cá nhân chỉ người có quyền xem loại nguồn tải được; mọi lần xem, tải ghi nhật ký truy cập.
9. Tệp tải lên: PDF, ảnh, Word, Excel, tối đa 20 MB một tệp như 22f.
10. Bộ tiêu chí đã có minh chứng hoặc đợt thì không xóa, chỉ ngừng dùng; nút đã có minh chứng thì không xóa.
11. Nạp lại bộ mẫu không tạo trùng mã; nút trường đã sửa thì giữ bản của trường, báo khác biệt.

## 6. Bộ tiêu chí khác để Eric chọn (Q-396-8)

Mọi bộ dưới đây là cấu hình (bộ mẫu nạp sẵn), không viết mã riêng. Số hiệu đối chiếu bản gốc khi nạp. Eric ngày 2026-10-31 chọn làm A, B, C, D, E, thứ tự B, C trước (Q-396-8); F, G chưa làm.

| Mã đề xuất | Bộ | Đối tượng | Căn cứ (đối chiếu khi nạp) | Nối với phần đã có |
|---|---|---|---|---|
| A | Chuẩn hiệu trưởng cơ sở giáo dục phổ thông; chuẩn hiệu trưởng mầm non | Cá nhân | Thông tư 14/2018/TT-BGDĐT; Thông tư 25/2018/TT-BGDĐT | Hồ sơ cán bộ |
| B | Chuẩn nghề nghiệp giáo viên phổ thông; giáo viên mầm non | Cá nhân | Thông tư 20/2018/TT-BGDĐT; Thông tư 26/2018/TT-BGDĐT | Đánh giá chuẩn nghề nghiệp (YCTD-104) đọc minh chứng từ kho |
| C | Thi đua, khen thưởng | Cá nhân, tập thể | Luật Thi đua, khen thưởng 2022 và văn bản hướng dẫn | Hồ sơ đề nghị của 22d chọn minh chứng từ kho thay vì chỉ từ 18e |
| D | Trường học an toàn, phòng chống tai nạn thương tích | Nhà trường | Văn bản hiện hành theo cấp học | Kiểm thực, cơ sở vật chất, y tế |
| E | Kế hoạch năm học, kiểm tra nội bộ | Nhà trường | Hướng dẫn nhiệm vụ năm học của Bộ, Sở | Kế hoạch giáo dục, kế hoạch công việc |
| F | Chuẩn thư viện | Nhà trường | Thông tư 16/2022/TT-BGDĐT | Kết quả chuẩn thư viện của 22a ghi thẳng làm minh chứng |
| G | Chuyển đổi số cơ sở giáo dục | Nhà trường | Bộ chỉ số đánh giá chuyển đổi số của Bộ | Nhiều phân hệ |

Bộ cá nhân (A, B) thêm khái niệm "người được đánh giá": mỗi người có kho minh chứng riêng trong cùng bộ; người được đánh giá tự gắn, người đánh giá xem. Làm ở lát L6 sau khi Eric chọn.

## 7. Danh sách lát

| Lát | Nội dung | Mức | Điểm xem trước |
|---|---|---|---|
| L0 | Tài liệu này, bản mẫu, phiếu YCTD-396 | — | Bản mẫu |
| L1 | Bảng kho ở cơ sở dữ liệu hệ thống, chuyển dữ liệu 22f, quyền mới, đổi tên phân hệ và menu; MH-679, MH-680, MH-681 với nguồn tệp và ba nguồn có sẵn; phiên bản, hiệu lực, lịch sử, nhật ký truy cập tệp; đợt và phiếu 22f đọc từ kho | Lớn | Danh sách, chi tiết, thêm minh chứng; e2e 80 vẫn đạt |
| L2 | Bộ đăng ký nguồn, bản chụp PDF, mười nguồn của nhóm kế hoạch, dạy học, đội ngũ, báo cáo; MH-686 ở trang nguồn | Lớn | Gắn sổ điểm, văn bản đi, biểu EMIS từ trang nguồn |
| L3 | Bộ tiêu chí nhiều loại, nhiều cấp học, mẫu mã; bộ mẫu Mầm non, Tiểu học, THCS và THPT đủ tiêu chuẩn, tiêu chí, chỉ báo theo văn bản đã sửa đổi bởi Thông tư 22/2024 (Q-396-6); nhập chỉ báo từ Excel; MH-684 | Vừa | Nạp bộ mẫu Tiểu học, sửa cây |
| L4 | Phân công phụ trách, độ phủ, tiêu chí thiếu, tổng quan, Việc của tôi; MH-678, MH-682, MH-683 | Vừa | Tổng quan và độ phủ của trường mẫu |
| L5 | Xuất danh mục theo mẫu hướng dẫn, báo cáo tự đánh giá mẫu phổ thông, kiểm mã trích dẫn, gói ZIP theo hộp; MH-685 | Vừa | Tệp Word, Excel, ZIP |
| L6 | Bộ tiêu chí ở Q-396-8 theo thứ tự B (chuẩn giáo viên, bộ cá nhân), C (thi đua), A (chuẩn hiệu trưởng), D (trường học an toàn), E (kế hoạch năm học); tách L6a đến L6e khi làm | Vừa đến Lớn | Theo bộ |
| L7 | Nguồn còn lại (học sinh, khen thưởng, kiểm thực, kiểm kê) | Vừa | Gắn từ trang nguồn |
| L8 | Vai trò VT-23 đoàn đánh giá ngoài: tài khoản chỉ đọc có ngày hết hạn, giao bộ và đợt, chỉ xem, tải trong phạm vi được giao, nhật ký truy cập, tự khóa khi hết hạn (Q-396-9) | Lớn | Đăng nhập bằng tài khoản đoàn, xem danh mục |

Mỗi lát một PR đích `main`, có e2e (spec mới số tiếp theo, giữ spec 80). Lát Lớn chờ Eric nghiệm thu trước khi gộp; lát Vừa gộp khi đủ kiểm tra CI.

## 8. Tiêu chí nghiệm thu dự kiến (cấp AC-1420 trở đi khi duyệt)

- Một minh chứng gắn cho hai tiêu chí của một bộ hiện ở cả hai tiêu chí với cùng mã; gắn sang bộ khác có mã riêng của bộ đó.
- Mã cấp tự động đúng dạng `[H1-1.1-01]`, không trùng trong bộ; đánh lại số cho kết quả liên tục, có lịch sử.
- Minh chứng thêm năm học 2025-2026 vẫn thấy ở năm học 2026-2027 mà không cần kế thừa; dữ liệu 22f cũ chuyển sang kho đủ số lượng, mã, tệp.
- Gắn sổ điểm của lớp làm minh chứng tạo phiên bản PDF đầy đủ có tên; sửa điểm sau đó hiện "Nguồn đã thay đổi"; chụp lại tạo phiên bản 2, phiên bản 1 còn tải được.
- Người không có quyền xem sổ điểm không gắn được sổ điểm và không tải được bản chụp sổ điểm, kể cả khi có `P09.evidence.manage` (máy chủ trả 403); mỗi lần xem, tải ghi nhật ký truy cập.
- Minh chứng hết hiệu lực không tính vào độ phủ; tiêu chí không còn minh chứng đủ hiện trong danh sách thiếu.
- Người phụ trách thấy tiêu chí thiếu ở Việc của tôi.
- Danh mục xuất đủ cột mẫu, nhóm theo tiêu chuẩn; báo cáo có mã trích dẫn không có trong danh mục thì báo trước khi xuất.
- Mọi màn hình mới đạt rà soát giao diện ở 1366, 1024, 390 điểm ảnh.

## 9. Rủi ro

- Chuyển dữ liệu 22f đọc nhiều cơ sở dữ liệu năm học: chạy được nhiều lần không tạo trùng, có báo cáo số dòng; bảng cũ giữ một phiên bản.
- Bản chụp PDF của bảng lớn (sổ điểm cả khối) có thể chậm: dựng ở tác vụ nền như xuất PDF hiện có.
- Nội dung chỉ báo nạp theo văn bản (Q-396-6: Eric bỏ ràng buộc không chép nguyên văn cho phần bộ tiêu chí, vì văn bản quy phạm pháp luật không thuộc đối tượng bảo hộ quyền tác giả); phải đối chiếu bản gốc đã sửa đổi bởi Thông tư 22/2024 trước khi nạp.
- Bản chụp có tên học sinh làm tăng dữ liệu cá nhân trong kho: chặn theo quyền xem nguồn, ghi nhật ký truy cập (BM-271).
- Số hiệu công văn hướng dẫn mầm non chưa thống nhất giữa các nguồn; đối chiếu bản gốc trước lát L5.
- Phạm vi lớn: L1, L2 chạm nhiều module; làm tuần tự, không chạy song song với phiên đang sửa cùng module nguồn.

## 10. Câu hỏi và quyết định của Eric

Eric trả lời ngày 2026-10-31 (qua phiên điều phối): Q-396-1 A; Q-396-2 A; Q-396-3 A; Q-396-4 A; **Q-396-5 B** (luôn bản đầy đủ có tên học sinh, vẫn chặn theo quyền xem nguồn, ghi nhật ký truy cập, ghi vào tài liệu `22` kèm lưu ý Nghị định 13/2023/NĐ-CP); **Q-396-6 B** (nạp đủ nội dung chỉ báo, bỏ ràng buộc không chép nguyên văn cho phần bộ tiêu chí); Q-396-7 A; Q-396-8 làm A, B, C, D, E, thứ tự B, C trước; **Q-396-9 B** (tài khoản chỉ đọc có thời hạn, vai trò mới, lát riêng L8); Q-396-10 duyệt.

Các câu hỏi đã hỏi (giữ để tra):

- **Q-396-1. "Thông tư 22" trong yêu cầu là văn bản nào?**
  A (đề xuất): Thông tư 22/2024/TT-BGDĐT sửa đổi Thông tư 17, 18, 19/2018 về kiểm định; bộ mẫu theo bản đã sửa đổi.
  B: Thông tư 22/2018/TT-BGDĐT hướng dẫn thi đua, khen thưởng ngành giáo dục; khi đó đây là bộ C ở mục 6.
- **Q-396-2. Kho minh chứng lưu ở đâu?**
  A (đề xuất): cơ sở dữ liệu hệ thống của trường, xuyên năm học; một minh chứng dùng cho chu kỳ kiểm định 5 năm mà không chép.
  B: giữ ở cơ sở dữ liệu năm học như 22f, mỗi năm kế thừa (chép) sang năm mới.
- **Q-396-3. Quan hệ với phân hệ Bảo đảm chất lượng?**
  A (đề xuất): mở rộng phân hệ đó, đổi tên "Minh chứng và kiểm định", chuyển minh chứng cũ sang kho.
  B: tách phân hệ mới "Kho minh chứng", phân hệ Bảo đảm chất lượng đọc từ kho.
- **Q-396-4. Bản ghi trong phần mềm làm minh chứng thế nào?**
  A (đề xuất): chụp bản PDF lúc gắn (đóng băng nội dung để nộp đoàn đánh giá), giữ liên kết tới bản gốc, báo khi nguồn thay đổi.
  B: chỉ liên kết, mở là thấy dữ liệu hiện tại.
- **Q-396-5. Minh chứng có dữ liệu cá nhân học sinh (sổ điểm, điểm danh, rèn luyện)?**
  A (đề xuất): mặc định bản tổng hợp không tên; chọn bản có tên thì minh chứng ở mức hạn chế, chỉ người có quyền xem nguồn tải được.
  B: luôn bản đầy đủ có tên.
- **Q-396-6. Nội dung chỉ báo của bộ mẫu?**
  A (đề xuất): nạp mã, tên tiêu chuẩn, tiêu chí và gợi ý minh chứng; nội dung chỉ báo trường nhập hoặc nhập từ tệp Excel mẫu (đúng ràng buộc không chép nguyên văn dài).
  B: nạp đủ nội dung chỉ báo theo văn bản (cần Eric đồng ý bỏ ràng buộc cho phần này).
- **Q-396-7. Quyền?**
  A (đề xuất): thêm ba quyền `P09.evidence.view`, `.contribute`, `.manage` (mục 4.7), tự cấp cho vai trò đang có quyền 22f.
  B: dùng lại `P09.quality.use`, `P09.quality.manage`, không thêm quyền.
- **Q-396-8. Làm thêm bộ tiêu chí nào ở L6?** Chọn trong A đến G mục 6. Đề xuất: B (chuẩn giáo viên) và C (thi đua) trước, vì đã có phân hệ và dữ liệu để gắn.
- **Q-396-9. Đoàn đánh giá ngoài xem minh chứng thế nào?**
  A (đề xuất): trường xuất gói ZIP theo hộp và danh mục (L5); chưa làm tài khoản cho đoàn.
  B: thêm tài khoản chỉ đọc có thời hạn cho thành viên đoàn (thêm vai trò, lát riêng).
- **Q-396-10. Duyệt danh sách lát L1 đến L7 và thứ tự?**

### 10.1 Đánh giá chuẩn nghề nghiệp, TEMIS (Eric nhắn ngày 2026-10-31, chờ trả lời)

Eric: kho minh chứng liên quan tới đánh giá chuẩn nghề nghiệp (TEMIS: giáo viên tự đánh giá theo Thông tư 20/2018/TT-BGDĐT, cán bộ quản lý theo Thông tư 14/2018/TT-BGDĐT). Yêu cầu: bộ chuẩn giáo viên, chuẩn hiệu trưởng (L6) gắn vào quy trình tự đánh giá theo tiêu chí, mức Đạt, Khá, Tốt, có minh chứng, cấp trên đánh giá, xếp loại, tổng hợp theo trường; minh chứng của cá nhân (phiếu dự giờ, sáng kiến, chứng chỉ bồi dưỡng, kết quả học sinh) dùng lại cho cả kiểm định trường và chuẩn nghề nghiệp, không chép hai lần; cân nhắc xuất theo khuôn của TEMIS, không kết nối trực tiếp. Báo cáo khảo sát TEMIS của phiên REA đọc trước khi làm L6.

Hiện trạng: phân hệ Nhân sự đã có đánh giá chuẩn nghề nghiệp (P07-05, YCTD-104: bảng `professional_standards`, `professional_criteria` ở cơ sở dữ liệu năm học, mức xếp loại, nhập mức từ Excel), chưa có minh chứng. Mô hình kho của L1 không phải làm lại: L6 thêm cột người được đánh giá và nới ràng buộc mã bằng một database migration mới.

- **Q-396-11. Minh chứng của cá nhân thuộc ai?**
  A (đề xuất): một kho của trường; mỗi minh chứng có thêm "chủ thể" là nhà trường hoặc một cán bộ. Minh chứng của cá nhân do người đó thêm và sở hữu; người đó, người đánh giá trực tiếp (tổ trưởng, Ban Giám hiệu) và người quản lý kho xem được; khi gắn vào bộ kiểm định của trường thì người xem kho của trường thấy. Một bản ghi, nhiều nơi dùng.
  B: hai kho tách (kho của trường, hồ sơ minh chứng cá nhân), liên kết chéo khi dùng chung.
- **Q-396-12. Mã minh chứng ở bộ chuẩn của cá nhân?**
  A (đề xuất): mã duy nhất theo bộ và người được đánh giá; mỗi giáo viên có dãy mã riêng (ví dụ `[H1-1.1-01]` của từng người).
  B: mã duy nhất theo bộ trên toàn trường.
- **Q-396-13. Quy trình tự đánh giá, cấp trên đánh giá, xếp loại ở đâu?**
  A (đề xuất): mở rộng đánh giá chuẩn nghề nghiệp đã có ở phân hệ Nhân sự (P07-05): thêm tự đánh giá theo tiêu chí, mức Đạt, Khá, Tốt, ô chọn minh chứng từ kho, đánh giá của cấp trên, tổng hợp theo trường; bộ tiêu chí lấy từ kho (L6).
  B: làm quy trình đánh giá mới trong phân hệ "Minh chứng và kiểm định", phân hệ Nhân sự chỉ đọc kết quả.
- **Q-396-14. Xuất cho TEMIS?**
  A (đề xuất): nếu báo cáo khảo sát tìm được mẫu nhập của TEMIS thì xuất tệp đúng mẫu đó; nếu không, xuất phiếu tự đánh giá PDF kèm danh mục minh chứng để giáo viên nhập tay lên TEMIS.
  B: chỉ xuất phiếu PDF, không theo mẫu TEMIS.
