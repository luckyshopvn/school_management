---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L2: bộ đăng ký nguồn, năm nguồn mới, nút "Dùng làm minh chứng" ở trang nguồn
ngay: 2026-11-01
phien_ban_de_xuat: 0.261.0
---

## 02 Nhật ký

### 2026-11-01 — Kho minh chứng dùng chung, lát L2 (YCTD-396)

#### Công việc đã thực hiện

- Bộ đăng ký nguồn (`apps/api/src/quality-assurance/evidence-sources.ts`): mỗi loại bản ghi khai báo quyền xem, có dữ liệu cá nhân hay không, cách tìm, cách chụp thành tệp và thời điểm sửa gần nhất; ba nguồn của lát L1 chuyển sang bộ này.
- Năm nguồn mới đọc qua dịch vụ của phân hệ nguồn nên giữ nguyên quyền và phạm vi xem: kế hoạch giáo dục (cá nhân, tổ, trường; dùng bản PDF có sẵn), kế hoạch công việc, thống kê đội ngũ theo trình độ (toàn trường hoặc từng đơn vị), phiếu đánh giá chuẩn nghề nghiệp (có dữ liệu cá nhân), báo cáo cơ sở vật chất (dùng bản PDF có sẵn).
- Mã bản ghi nguồn lưu dạng chữ (database migration hệ thống `0144`) để nhận khóa ghép ở lát sau.
- Nút "Dùng làm minh chứng" (MH-686) ở trang kế hoạch giáo dục, phiếu đánh giá chuẩn nghề nghiệp, báo cáo cơ sở vật chất, thống kê đội ngũ; bản ghi đã là minh chứng thì hiện mã.

#### Quyết định

- Eric ngày 2026-11-01 trả lời A cả bốn câu Q-396-11 đến Q-396-14: một kho của trường, mỗi minh chứng có chủ thể là nhà trường hoặc một cán bộ; ở bộ chuẩn của cá nhân, mã duy nhất theo bộ và người được đánh giá; mở rộng đánh giá chuẩn nghề nghiệp đã có ở phân hệ Nhân sự (P07-05); xuất đúng mẫu nhập của TEMIS nếu tìm được mẫu công khai, nếu không thì xuất phiếu tự đánh giá PDF kèm danh mục minh chứng.
- Eric sau khảo sát TEMIS: Thông tư 30/2026/TT-BGDĐT bãi bỏ chuẩn giáo viên Thông tư 20/2018 từ năm học 2026-2027; lát L6 làm cả bộ Thông tư 20/2018 (dữ liệu đến hết năm học 2025-2026) và bộ hồ sơ minh chứng theo hạng I, II, III theo Thông tư 30/2026 (chưa xếp loại theo hạng); chuẩn hiệu trưởng (Thông tư 14/2018) làm sau cùng; lỗi xếp loại ở `standard-rating.ts` do phiên riêng sửa.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: lát L2 làm năm nguồn có sẵn dịch vụ kiểm quyền; hồ sơ công việc, sổ điểm, điểm danh, biểu EMIS đã gửi (khóa ghép, dữ liệu học sinh) chuyển sang lát L2b. "Kế hoạch năm học của trường" là kế hoạch giáo dục phạm vi trường vì hệ thống không có bảng kế hoạch năm học riêng. Phiếu đánh giá chuẩn nghề nghiệp: người được tải bản chụp là người có quyền quản lý hoặc đánh giá chuẩn; người được đánh giá tự xem bản chụp của mình làm ở lát L6.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-396, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `07_QUY_TAC_NGHIEP_VU.md` BR-543, `11_TIEU_CHI_NGHIEM_THU.md` AC-1428 đến AC-1430, `14_DAC_TA_GIAO_DIEN.md` MH-686, `16_CO_SO_DU_LIEU.md` mục 18V, `17_DAC_TA_API.md` mục 17.17, `21_KICH_BAN_KIEM_THU.md` CT-2138 đến CT-2140, `tai_lieu/ban_mau/yctd-396/DAC_TA.md` mục 10.1.

#### Vấn đề tồn đọng

- Lát L2b (hồ sơ công việc, sổ điểm, điểm danh, biểu EMIS đã gửi), L3 đến L8 chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L2: bộ đăng ký nguồn, nút "Dùng làm minh chứng" – 2026-11-01

- Lý do: lát L2 của YCTD-396 theo danh sách lát Eric duyệt ngày 2026-10-31.
- Nội dung thay đổi: bộ đăng ký nguồn; năm nguồn mới (kế hoạch giáo dục, kế hoạch công việc, thống kê đội ngũ theo trình độ, phiếu đánh giá chuẩn nghề nghiệp, báo cáo cơ sở vật chất); mã bản ghi dạng chữ; điểm cuối tra minh chứng theo bản ghi; nút "Dùng làm minh chứng" ở bốn trang nguồn.
- Thành phần bị ảnh hưởng: `apps/api/src/quality-assurance/` (thêm `evidence-sources.ts`; `evidence-store.ts`, `evidence-store.controller.ts`), `apps/api/src/application.module.ts`; `apps/portal/src/quality-assurance/` (thêm `UseAsEvidence.tsx`; `evidence-api.ts`), `apps/portal/src/education-plans/EducationPlanPages.tsx`, `apps/portal/src/professional-standards/ProfessionalStandardsPage.tsx`, `apps/portal/src/facilities/FacilityReportPage.tsx`, `apps/portal/src/statistics/StaffStatisticsPage.tsx`; `packages/shared/src/evidence-store.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: `evidence_versions.record_id` đổi từ uuid sang chữ (tối đa 200 ký tự); điểm cuối mới `GET /quality/evidences/by-record`; `record_type` nhận thêm năm loại; không thêm quyền.
- Ảnh hưởng chức năng cũ: ba nguồn của lát L1 giữ hành vi; phân hệ nguồn không đổi ngoài nút mới (chỉ hiện với người có quyền đóng góp hoặc quản lý kho).
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/*.test.ts`; e2e spec 243 và spec mới 244; database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-10-31 (danh sách lát); quyết định Q-396-11 đến Q-396-14 ngày 2026-11-01.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-01

- Phạm vi thay đổi: kho minh chứng nhận thêm năm loại bản ghi làm nguồn qua bộ đăng ký nguồn, nút "Dùng làm minh chứng" ở trang nguồn (YCTD-396 lát L2).
- Database migration: hệ thống `0144_evidence_record_key_text`. Quay lui: chạy `down` (phiên bản có khóa ghép không đổi về uuid được thì giữ tệp đã chụp, bỏ liên kết nguồn).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L2 | YCTD-396 |

## index Số đếm

| 14 | màn hình | +1 |
| Màn hình dự kiến | Số lượng | +1 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L2 (bộ đăng ký nguồn, năm nguồn mới, nút "Dùng làm minh chứng") |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-543 | Bộ đăng ký nguồn minh chứng (YCTD-396 lát L2): mỗi loại bản ghi khai báo quyền xem, có dữ liệu cá nhân hay không, cách tìm, chụp, thời điểm sửa; nguồn có dịch vụ kiểm phạm vi (kế hoạch công việc, phiếu đánh giá chuẩn nghề nghiệp) gọi dịch vụ đó ở mỗi lần tìm và chụp, người ngoài phạm vi bị từ chối; bản chụp của phiếu đánh giá chuẩn nghề nghiệp có dữ liệu cá nhân, tải cần `P07.professional-standard.manage` hoặc `P07.professional-standard.assess`; mã bản ghi là chữ tối đa 200 ký tự, mã không hợp lệ thì từ chối |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1428 | Cho Hiệu trưởng / Khi gắn thống kê đội ngũ toàn trường làm minh chứng / Thì phiên bản 1 là tệp PDF, minh chứng "Đã đủ", tra theo bản ghi thấy mã; giáo viên không có quyền xem thống kê bị 403; mã bản ghi sai bị 400 (CT-2138; YCTD-396 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1429 | Cho phiếu đánh giá chuẩn nghề nghiệp của một giáo viên / Khi Hiệu trưởng gắn làm minh chứng / Thì minh chứng có dữ liệu cá nhân; giáo viên khác không tải được (403), Hiệu trưởng tải được (CT-2139; YCTD-396 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1430 | Cho Hiệu trưởng ở trang Báo cáo cơ sở vật chất / Khi bấm "Dùng làm minh chứng", chọn bộ, tiêu chí, gắn / Thì trang báo mã đã cấp và hiện "Minh chứng [mã]"; kho có minh chứng mới; giao diện đạt ở 1366, 1024, 390 điểm ảnh (CT-2140; YCTD-396 lát L2) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-686 | Dùng làm minh chứng (YCTD-396 lát L2): nút ở trang kế hoạch giáo dục, phiếu đánh giá chuẩn nghề nghiệp, báo cáo cơ sở vật chất, thống kê đội ngũ; hộp thoại chọn bộ tiêu chí, tiêu chí chính, tên minh chứng, Gắn minh chứng; bản ghi đã là minh chứng thì hiện "Minh chứng [mã]" | `P09.evidence.contribute`, `P09.evidence.manage`, kèm quyền xem dữ liệu nguồn |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2138 | P09-43 | CT-396-8: ô chọn nguồn thống kê đội ngũ; giáo viên gắn; mã bản ghi sai; Hiệu trưởng gắn toàn trường; tải tệp; tra theo bản ghi | Có "toan-truong"; 403; 400; 201, không có dữ liệu cá nhân, "Đã đủ"; PDF; đúng mã | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2139 | P09-43 | CT-396-9: Hiệu trưởng gắn phiếu đánh giá chuẩn của một giáo viên; giáo viên khác xem, tải; Hiệu trưởng tải | Có dữ liệu cá nhân; không có nút tải, 403; 200 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2140 | P09-43 | CT-396-10 (giao diện): Hiệu trưởng dùng báo cáo cơ sở vật chất làm minh chứng từ trang báo cáo | Báo mã đã cấp; trang hiện "Minh chứng [mã]"; kho có dòng nguồn báo cáo cơ sở vật chất | Kiểm thử giao diện `tests/e2e/244-dung-lam-minh-chung.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L2 | Kho minh chứng dùng chung, lát L2: bộ đăng ký nguồn, năm nguồn mới, nút "Dùng làm minh chứng" | {PHIEN_BAN} | P09-43 | AC-1428 đến AC-1430 | CT-2138 đến CT-2140 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/evidence-sources.ts`, `apps/portal/src/quality-assurance/UseAsEvidence.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 01/11/2026; CI của PR |
