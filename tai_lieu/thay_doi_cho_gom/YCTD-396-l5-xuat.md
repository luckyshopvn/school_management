---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L5: danh mục theo mẫu hướng dẫn, báo cáo tự đánh giá, kiểm mã trích dẫn, gói hồ sơ theo hộp
ngay: 2026-11-03
phien_ban_de_xuat: 0.265.0
---

## 02 Nhật ký

### 2026-11-03 — Kho minh chứng dùng chung, lát L5 (YCTD-396)

#### Công việc đã thực hiện

- Danh mục minh chứng theo mẫu của hướng dẫn tự đánh giá (Excel, Word, PDF):
  - cột TT, Mã minh chứng, Tên minh chứng, Số, ngày ban hành hoặc thời điểm khảo sát, điều tra, phỏng vấn, quan sát, Nơi ban hành hoặc nhóm, cá nhân thực hiện, Ghi chú;
  - nhóm theo tiêu chuẩn, tiêu chí; minh chứng dùng chung ghi lại ở tiêu chí dùng, kèm mã gốc.
- Báo cáo tự đánh giá:
  - thêm mục "I. Tự đánh giá tiêu chí Mức 1, 2 và 3";
  - bộ kiểm định có thêm mục "II. Tự đánh giá tiêu chí Mức 4" để trống cho trường ghi;
  - phụ lục danh mục mã minh chứng theo mẫu mới.
- Kiểm mã trích dẫn trước khi xuất báo cáo: mã trong ngoặc vuông ở phần đặt vấn đề, kết luận chung và ba mục của phiếu tiêu chí mà không có trong danh mục của bộ thì báo kèm chỗ trích dẫn; người dùng chọn Vẫn xuất hoặc Hủy.
- Gói hồ sơ minh chứng (ZIP, tác vụ nền, tải ở Tệp đã tạo):
  - thư mục theo hộp; mỗi minh chứng một tệp đặt tên theo mã, kèm danh mục;
  - minh chứng chưa có tệp hoặc có dữ liệu cá nhân mà người xuất không có quyền xem nguồn ghi ở tệp `khong-dua-vao-goi.txt`;
  - mỗi tệp đưa vào gói ghi nhật ký tải.
- Menu "Minh chứng và kiểm định" thêm 3.4 Xuất danh mục và báo cáo (MH-685).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - cột danh mục theo mô tả ở mục 4.6 của bản đặc tả;
  - gói chỉ chứa bản mới nhất có tệp của minh chứng chính, một lần cho mỗi minh chứng;
  - chỉ người quản lý kho toàn trường tạo gói;
  - mẫu báo cáo phổ thông dùng chung bố cục với mẫu Mầm non, thêm hai mục I, II của phần Tự đánh giá.
- Lát này dùng mã BR-550, BR-551: dải BR-533 đến BR-549 đã hết; cấp theo số tiếp theo trên `main`.

#### Thay đổi

- Xem các tài liệu sau:
  - `24_YEU_CAU_THAY_DOI.md` YCTD-396;
  - `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN};
  - `07_QUY_TAC_NGHIEP_VU.md` BR-550, BR-551;
  - `11_TIEU_CHI_NGHIEM_THU.md` AC-1440 đến AC-1442;
  - `14_DAC_TA_GIAO_DIEN.md` MH-685;
  - `17_DAC_TA_API.md` mục 17.17;
  - `21_KICH_BAN_KIEM_THU.md` CT-2149, CT-2150.

#### Vấn đề tồn đọng

- Chưa đối chiếu cột danh mục và bố cục báo cáo với bản gốc Công văn 5932/BGDĐT-QLCL và công văn hướng dẫn mầm non (số hiệu các nguồn ghi khác nhau); trường đối chiếu trước khi nộp.
- Lát L6 đến L8 chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L5: xuất danh mục, báo cáo, gói hồ sơ – 2026-11-03

- Lý do: lát L5 của YCTD-396 (mục 4.6 của bản đặc tả `tai_lieu/ban_mau/yctd-396/DAC_TA.md`).
- Nội dung thay đổi:
  - danh mục theo mẫu hướng dẫn, thêm định dạng Word;
  - kiểm mã trích dẫn của báo cáo tự đánh giá;
  - mục Mức 1 đến 3 và Mức 4 của báo cáo;
  - gói hồ sơ minh chứng theo hộp.
- Thành phần bị ảnh hưởng:
  - `apps/api/src/quality-assurance/`: `evidence-store.ts`, `evidence-store.controller.ts`, `quality-assurance.ts`, `quality-assurance.controller.ts`;
  - `apps/portal/src/quality-assurance/`: `EvidenceExportPage.tsx`, `EvidenceCoveragePages.tsx`, `evidence-api.ts`;
  - `apps/portal/src/router.tsx`;
  - `packages/shared/src/`: `evidence-store.ts`, `portal-menu.ts`, `menu-permissions.ts`, `index.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng:
  - không đổi cấu trúc dữ liệu;
  - `GET /quality/evidences/export` đổi bố cục, nhận thêm `format=docx`;
  - điểm cuối mới `POST /quality/evidences/package`, `GET /quality/assessments/{id}/report/citations`;
  - tác vụ xuất nền mã `quality-evidence-package`;
  - không thêm quyền.
- Ảnh hưởng chức năng cũ:
  - tệp danh mục đổi cột: bỏ cột trạng thái, hiệu lực, nguồn; trạng thái chưa đủ và hết hiệu lực ghi ở Ghi chú;
  - phụ lục danh mục của báo cáo tự đánh giá đổi theo.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/*.test.ts`; e2e 80, 243 đến 247, spec mới 248.
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-10-31 (danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: danh mục minh chứng theo mẫu hướng dẫn, kiểm mã trích dẫn, gói hồ sơ minh chứng theo hộp (YCTD-396 lát L5).
- Database migration: không có.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L5 | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L5 (danh mục minh chứng theo mẫu hướng dẫn, kiểm mã trích dẫn của báo cáo tự đánh giá, gói hồ sơ minh chứng theo hộp) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-550 | Mã trích dẫn trong báo cáo tự đánh giá (YCTD-396 lát L5): mọi chuỗi trong ngoặc vuông không có khoảng trắng, 1 đến 50 ký tự, ở phần đặt vấn đề, kết luận chung và mô tả hiện trạng, điểm mạnh, điểm yếu của phiếu tiêu chí; mã không có trong danh mục của bộ thì báo kèm chỗ trích dẫn trước khi xuất, người dùng vẫn xuất được |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-551 | Danh mục và gói hồ sơ minh chứng (YCTD-396 lát L5): danh mục nhóm theo tiêu chuẩn, tiêu chí, minh chứng chính trước, minh chứng dùng chung ghi "Dùng chung, mã gốc của tiêu chí …"; Ghi chú có trạng thái khi chưa Đã đủ và Hết hiệu lực; gói ZIP thư mục `H<số hộp>`, tệp `<mã>.<phần mở rộng>` là bản mới nhất có tệp của minh chứng chính, kèm `danh-muc-minh-chung.xlsx`; minh chứng chưa có tệp hoặc có dữ liệu cá nhân mà người xuất không có quyền xem nguồn ghi ở `khong-dua-vao-goi.txt`; mỗi tệp đưa vào gói ghi nhật ký tải; chỉ người quản lý kho toàn trường tạo gói, tạo ở tác vụ nền |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1440 | Cho minh chứng của tiêu chí 6.1 dùng chung cho 6.2 / Khi xuất danh mục Excel / Thì có dòng Tiêu chuẩn 6, Tiêu chí 6.1 với minh chứng [H6-6.1-01] "12/QĐ, 05/09/2026", và ở Tiêu chí 6.2 dòng [H6-6.1-01] ghi "Dùng chung, mã gốc của tiêu chí 6.1"; xuất Word được (CT-2149; YCTD-396 lát L5) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1441 | Cho bộ có một minh chứng có tệp và một minh chứng chưa có tệp / Khi Hiệu trưởng tạo gói hồ sơ / Thì tác vụ nền tạo ZIP có `H6/H6-6.1-01.pdf`, danh mục, tệp ghi minh chứng chưa có tệp; lịch sử minh chứng có lần tải "Gói hồ sơ minh chứng XK-THU"; giáo viên tạo gói bị 403 (CT-2149; YCTD-396 lát L5) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1442 | Cho báo cáo trích [H6-6.1-01] (có) và [H9-9.9-09] (không có) / Khi kiểm mã trích dẫn / Thì có 2 mã được trích, 1 mã chưa có ở "Tiêu chí 6.2, mô tả hiện trạng"; giao diện xuất danh mục Word, Excel và tạo gói (CT-2149, CT-2150; YCTD-396 lát L5) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-685 | Xuất danh mục và báo cáo (YCTD-396 lát L5; mục "3.4." của Minh chứng và kiểm định, `/quality/evidence-exports`): chọn bộ; khung Danh mục minh chứng với Xuất danh mục Excel, Word, PDF; khung Gói hồ sơ minh chứng (người quản lý kho) với Tạo gói hồ sơ minh chứng và liên kết Tệp đã tạo; khung Báo cáo tự đánh giá (người có quyền tự đánh giá) chọn đợt của bộ, Kiểm mã trích dẫn, Xuất báo cáo Word, PDF; có mã chưa có thì báo danh sách mã và chỗ trích dẫn với Vẫn xuất, Hủy | Người có một trong ba quyền kho minh chứng; khung báo cáo cần quyền tự đánh giá (`P09.quality.*`) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2149 | P09-43 | CT-396-19: bộ có tiêu chí 6.1, 6.2; minh chứng 12/QĐ ngày 05/09/2026 của 6.1 dùng chung cho 6.2, có tệp PDF; minh chứng 6.2 chưa có tệp; xuất Excel, Word; giáo viên rồi Hiệu trưởng tạo gói, chạy tác vụ nền, tải; báo cáo trích [H6-6.1-01], [H9-9.9-09], kiểm mã, xuất Word | Dòng nhóm, mã gốc của minh chứng dùng chung; Word hợp lệ; 403, 202; ZIP có `H6/H6-6.1-01.pdf`, danh mục, tệp không đưa vào gói; nhật ký tải; 2 mã trích, 1 mã chưa có; báo cáo 200 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2150 | P09-43 | CT-396-20 (giao diện): Hiệu trưởng mở 3.4, chọn bộ Mầm non, xuất danh mục Word, Excel, tạo gói hồ sơ | Tải tệp docx, xlsx; thông báo đang tạo gói | Kiểm thử giao diện `tests/e2e/248-xuat-danh-muc.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L5 | Kho minh chứng dùng chung, lát L5: danh mục theo mẫu hướng dẫn, kiểm mã trích dẫn, gói hồ sơ theo hộp | {PHIEN_BAN} | P09-43 | AC-1440 đến AC-1442 | CT-2149, CT-2150 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/evidence-store.ts`, `apps/portal/src/quality-assurance/EvidenceExportPage.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
