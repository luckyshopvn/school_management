---
yctd: YCTD-385
tieu_de: Biểu thống kê Thông tư 25/2024 cho phổ thông, luồng duyệt và khóa số liệu, EQMS
ngay: 2026-10-30
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-10-30 — Biểu thống kê Thông tư 25/2024 cho phổ thông, luồng duyệt và khóa số liệu, EQMS

#### Công việc đã thực hiện

- Kiểm tình trạng hiệu lực ngày 2026-10-30: Thông tư 25/2024/TT-BGDĐT có hiệu lực từ 09/02/2025, thay Thông tư 24/2018; Quyết định 4998/QĐ-BGDĐT ngày 31/12/2021 có hiệu lực từ ngày ký, thay Quyết định 1904/QĐ-BGDĐT và 501/QĐ-BGDĐT; chưa thấy văn bản thay thế hai văn bản này.
- Tải bản PDF gốc Thông tư 25/2024 từ Cổng văn bản Chính phủ (bản quét 225 trang), dựng ảnh trang và chép nguyên văn sáu biểu phổ thông: 02.ĐN-TH (164 dòng), 02.CN-TH (76), 03.ĐN-THCS (167), 03.CN-THCS (71), 04.ĐN-THPT (168), 04.CN-THPT (70), kèm tóm tắt phần giải thích (`tai_lieu/ban_mau/yctd-385/BIEU_0*.md`).
- Khảo sát mã: khung biểu Tiểu học, THCS, THPT hiện có một bộ cột và dòng do hệ thống đặt; luồng gửi chỉ có phía trường; cổng cấp trên chưa có duyệt; chưa có EQMS, mẫu Excel CSDL ngành cho phổ thông; GDTX chỉ có mã cấp.
- Lập bảng thiếu theo biểu và cấp, thiết kế khung biểu nhiều phần, luồng duyệt, EQMS, đề xuất GDTX, danh sách lát L1 đến L9 (`tai_lieu/ban_mau/yctd-385/DAC_TA.md`); bản mẫu tám màn hình MH-620 đến MH-627 ở ba khổ (`tai_lieu/ban_mau/yctd-385/index.html`).

#### Quyết định

- Eric ngày 2026-10-30: để sau hồ sơ xin kết nối với Bộ, tập trung phát triển sản phẩm; thứ tự (a) biểu và mẫu nhập, xuất Thông tư 25/2024, (b) luồng duyệt, khóa, (c) EQMS và đội ngũ cuối năm, (d) GDTX chỉ khảo sát, đề xuất.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mở rộng khung biểu cấu hình được có sẵn thay vì làm module mới; danh mục chưa đối chiếu phụ lục Quyết định 4998 ghi nhãn tạm theo mẫu Excel của hệ thống Bộ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-385.

#### Vấn đề tồn đọng

- Chờ Eric duyệt bản mẫu, danh sách lát và câu hỏi Q-385-1 đến Q-385-5; chưa viết mã.
- Đối chiếu thêm báo cáo truong.hcm.edu.vn: cấp duyệt theo cấp học, hạn của cấp trên sớm hơn hạn Bộ, phòng dùng chung báo một cấp; biểu 01.ĐN-MN mới khớp khoảng 38/217 dòng (đề xuất L10).
- Bản in Thông tư có hai chỗ nghi lỗi in (02.ĐN-TH mã 27, 28; 02.CN-TH mã 02); mẫu EQMS và mẫu Excel phổ thông là bản tạm.

## 24 Yêu cầu thay đổi

### YCTD-385: Biểu thống kê Thông tư 25/2024 cho phổ thông, luồng duyệt và khóa số liệu, EQMS – 2026-10-30

- Lý do: báo cáo phân tích csdl.moet.gov.vn ngày 2026-10-30 (mục 5, 6, 7) chỉ ra School Management thiếu biểu thống kê theo Thông tư 25/2024 cho Tiểu học, THCS, THPT, mẫu nhập, xuất CSDL ngành cho phổ thông, luồng duyệt và khóa của cấp trên, EQMS, báo cáo đội ngũ cuối năm, cấp GDTX.
- Nội dung thay đổi: khung biểu nhiều phần (mỗi phần một bộ cột) và công thức mới cho trường, đội ngũ, phòng học tập; nạp sáu biểu 02, 03, 04 đầu năm, cuối năm; kiểm tra trước khi gửi theo trường bắt buộc của Bộ; luồng gửi, duyệt, từ chối kèm lý do, khóa, xin mở khóa giữa trường và đơn vị cấp trên; EQMS đầu năm, giữa năm, cuối năm; báo cáo đội ngũ cuối năm; mẫu nhập, xuất CSDL ngành phổ thông (tạm), xuất tách theo cấp; đề xuất GDTX (chưa làm). Chi tiết, danh sách lát: `tai_lieu/ban_mau/yctd-385/DAC_TA.md`.
- Thành phần bị ảnh hưởng (dự kiến): `packages/shared/src/primary-reports.ts`, `apps/api/src/primary-reports`, `apps/api/src/secondary-reports`, `apps/api/src/submissions`, `apps/api/src/parent-org`, `apps/api/src/imports`, `apps/portal/src/primary-reports`, `apps/portal/src/secondary-reports`, `apps/portal/src/submissions`, `apps/platform/src/ParentOrgApp.tsx`; database migration ở cơ sở dữ liệu hệ thống (`report_form_sections`, cột `source`, kỳ `mid_year`) và nền tảng (`report_submissions`, `report_submission_events`); tài liệu `10`, `11`, `14`, `16`, `17`, `21`, `22`.
- Dữ liệu bị ảnh hưởng: biểu khung cũ giữ nguyên, đổi tên thêm "(khung cũ)"; số đã nhập không mất. Bản chụp gửi lên nền tảng chỉ gồm số liệu tổng hợp.
- Quyền bị ảnh hưởng: thêm thao tác duyệt, từ chối, khóa, xử lý mở khóa cho tài khoản cấp trên của đơn vị trường gắn; quyền mở khóa tại trường chỉ còn ở chế độ một trường.
- Mức: Lớn.
- Trạng thái: Chờ phê duyệt
