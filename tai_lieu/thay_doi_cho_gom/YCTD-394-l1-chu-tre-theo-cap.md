---
yctd: YCTD-394
tieu_de: Chữ "trẻ" theo cấp học, lát L1: giao diện và tệp Excel
ngay: 2026-10-30
phien_ban_de_xuat: 0.253.0
---

## 02 Nhật ký

### 2026-10-30 — Chữ "trẻ" theo cấp học, lát L1: giao diện và tệp Excel

#### Công việc đã thực hiện

- Rà các chỗ còn ghi cứng chữ "trẻ" hoặc nội dung chỉ của Mầm non mà trường Tiểu học, Trung học cơ sở, Trung học phổ thông và trường liên cấp vẫn thấy (danh sách tách ra từ YCTD-388).
- Thêm `fillLearnerTerm` (`packages/shared/src/school-level-terms.ts`): chữ có chỗ giữ `{Người học}`, `{người học}` điền theo thuật ngữ của cấp ("Trẻ", "Học sinh" hoặc thuật ngữ trường đặt ở 1.4). Cổng quản trị thêm `useLearnerWord`, `useHasPreschool` (`apps/portal/src/school-levels/working-level.tsx`); API thêm `SchoolLevelResolver.requestedTerms`.
- Đổi theo cấp đang làm việc: bảng báo cáo (`ReportTable` điền chỗ giữ cho mọi bảng của MH-28 và báo cáo hợp nhất), Điểm danh và suất ăn, thẻ "Sinh nhật trẻ trong tháng", thẻ độ tuổi của 5.3, phần "Trẻ và phụ huynh", "Trẻ từ CSDL ngành" của 4.1.2, ô "Năm học nhận trẻ" và câu của Tuyển sinh đầu cấp 1.4, 1.6.
- Tệp Excel xuất báo cáo (`POST /reports/{code}/export`): nút "Xuất Excel" gửi kèm `school_level` của cấp đang làm việc; API đặt tên trang, nhãn cột theo thuật ngữ của cấp đó.
- Ẩn khi không có Mầm non: ô tính cân nặng, chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân ở 1.4 Cấu hình trường (trường không bật Mầm non), nút "Lấy dữ liệu từ 4.3" ở 4.6.1 và vế câu "học sinh mầm non chưa dùng phần mềm học" ở 4.1.10 (cấp đang làm việc không có Mầm non).
- Kiểm thử: CT-1970, CT-1971 (`apps/api/src/reports/report-export-levels.test.ts`), CT-1972 (e2e `tests/e2e/83-school-level-menu.spec.ts` CT-19c-12).

#### Quyết định

- Eric duyệt ngày 2026-10-30: xếp mức Vừa, làm hai lát (L1 giao diện và Excel; L2 tên nhóm quyền P02 và mô tả quyền); quyền dùng phương án thay theo cấp (database migration đổi chữ "trẻ" thành chỗ giữ, trang Phân quyền điền theo các cấp trường đã bật).
- Giữ chữ "trẻ" ở thẻ và trang Excel hoàn thành chương trình của 5.3 (lớp mẫu giáo 5–6 tuổi, nội dung riêng của Mầm non) và ở thông báo lỗi API "chưa chọn năm học nhận trẻ" (kiểm thử CT-17d-7 khớp chữ). Tham số `school_level` của tệp xuất chỉ đổi nhãn, không lọc số liệu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-394, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` (đoạn YCTD-394 sau đoạn YCTD-153), `17_DAC_TA_API.md` mục xuất báo cáo.

#### Vấn đề tồn đọng

- Lát L2: tên nhóm quyền P02 và khoảng 25 mô tả quyền có chữ "trẻ".
- Ngoài phạm vi: danh mục "Quan hệ với trẻ" (API, mẫu nhập Excel, ứng dụng phụ huynh, giáo viên); chữ "trẻ" phía API ở `emis-so-calc.ts`, `program-completion.ts`, `attendance.service.ts`, `imports.service.ts`, `education-plans.ts`.

## 24 Yêu cầu thay đổi

### YCTD-394: Chữ "trẻ" theo cấp học, lát L1: giao diện và tệp Excel – 2026-10-30

- Lý do: sau YCTD-388, Eric chọn tách phiếu riêng cho nội dung Mầm non đang hiện ở cấp khác. Trường Tiểu học, Trung học cơ sở, Trung học phổ thông và trường liên cấp chọn một cấp phổ thông vẫn thấy chữ "trẻ" ghi cứng ở Báo cáo, tệp Excel, 5.3, 4.1.2, bảng điều khiển, Tuyển sinh đầu cấp, và thấy nút, ô, câu chỉ dành cho Mầm non ở 1.4, 4.6.1, 4.1.10.
- Nội dung thay đổi: các chữ trên ghi theo thuật ngữ của cấp đang làm việc; tệp xuất báo cáo nhận `school_level` tùy chọn để ghi nhãn theo cấp; nút, ô, câu chỉ dành cho Mầm non ẩn khi không có cấp Mầm non. Trường chỉ có Mầm non thấy y như trước.
- Thành phần bị ảnh hưởng: `packages/shared/src/school-level-terms.ts`, `apps/api/src/common/school-levels.ts`, `apps/api/src/reports/report-export.ts`, `apps/portal/src/school-levels/working-level.tsx`, `apps/portal/src/reports/` (`ReportsPage.tsx`, `ReportTable.tsx`, `PhaseTwoReports.tsx`, `AttendanceMealsReport.tsx`, `DashboardCards.tsx`), `apps/portal/src/statistics/StudentStatisticsPage.tsx`, `apps/portal/src/imports/` (`ImportsPage.tsx`, `MoetImportSection.tsx`), `apps/portal/src/entry-admissions/EntryIntakePages.tsx`, `apps/portal/src/settings/SettingsPage.tsx`, `apps/portal/src/health/StudentHealthPage.tsx`, `apps/portal/src/students/LearningAccountsPage.tsx`; kiểm thử `apps/api/src/reports/report-export-levels.test.ts`, `tests/e2e/83-school-level-menu.spec.ts`; tài liệu `14`, `17`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: `POST /reports/{code}/export` nhận thêm `school_level` tùy chọn (tương thích ngược).
- Quyền bị ảnh hưởng: không (tên, mô tả quyền ở lát L2).
- Mức: Vừa. Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: chữ "trẻ" ghi theo cấp đang làm việc ở Báo cáo, tệp Excel xuất báo cáo, 5.3, 4.1.2, bảng điều khiển, Tuyển sinh đầu cấp; ẩn nút, ô, câu chỉ của Mầm non ở 1.4, 4.6.1, 4.1.10 khi không có Mầm non (YCTD-394 lát L1).
- Quay lui: hoàn tác commit hợp nhất của PR; không có database migration.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Chữ "trẻ" theo cấp học, lát L1: giao diện và tệp Excel | YCTD-394 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P01 Nền tảng, đơn vị và phân quyền | YCTD-394 lát L1: chữ "trẻ" theo cấp ở Báo cáo, tệp Excel, 5.3, 4.1.2, bảng điều khiển, Tuyển sinh đầu cấp; ẩn mục chỉ Mầm non ở 1.4, 4.6.1, 4.1.10 |

## Thêm dòng

| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1330 | Cho trường liên cấp chọn Tiểu học, Trung học cơ sở hoặc Trung học phổ thông / Khi xem Báo cáo, tệp Excel xuất báo cáo, 5.3, 4.1.2, thẻ sinh nhật, Tuyển sinh đầu cấp / Thì chữ người học là "học sinh" (hoặc thuật ngữ trường đặt ở 1.4); trường chỉ có Mầm non vẫn là "trẻ" (CT-1970 đến CT-1972; YCTD-394) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1331 | Cho cấp đang làm việc không có Mầm non / Khi mở 4.6.1, 4.1.10 (hoặc 1.4 ở trường không bật Mầm non) / Thì không có nút "Lấy dữ liệu từ 4.3", câu "học sinh mầm non chưa dùng phần mềm học", ô tính cân nặng, chiều cao cho trẻ suy dinh dưỡng (CT-1972; YCTD-394) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1970 | P17-12 | Hiệu trưởng trường chỉ có Mầm non xuất báo cáo công nợ ra Excel | Trang "Theo trẻ", cột "Trẻ" như trước | Kiểm thử tự động `apps/api/src/reports/report-export-levels.test.ts` CT-1970 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1971 | P17-12 | Trường bật Mầm non và Tiểu học: xuất công nợ với `school_level` TH; MN; không gửi; THCS (chưa bật) | "Theo học sinh", cột "Học sinh"; cột "Trẻ"; cột "Học sinh"; 403 | Kiểm thử tự động `apps/api/src/reports/report-export-levels.test.ts` CT-1971 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1972 | P01-41 | Hiệu trưởng, trường bật Mầm non và Tiểu học, chọn Tiểu học: trang chủ, Báo cáo công nợ, 4.1.10; trả lại chỉ Mầm non | "Sinh nhật học sinh trong tháng", bảng "Theo học sinh", không có câu học sinh mầm non; trường chỉ Mầm non: "Sinh nhật trẻ trong tháng", có câu học sinh mầm non | Kiểm thử giao diện `tests/e2e/83-school-level-menu.spec.ts` CT-19c-12 | Chưa chạy |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-394 | Chữ "trẻ" theo cấp học, lát L1: giao diện và tệp Excel | {PHIEN_BAN} | P01-41, P17-12 | AC-1330, AC-1331 | CT-1970 đến CT-1972 | PR, commit merge ghi khi gom; tệp mã: `packages/shared/src/school-level-terms.ts`, `apps/api/src/reports/report-export.ts`, `apps/portal/src/reports/ReportTable.tsx`, `apps/portal/src/school-levels/working-level.tsx` | Kiểm thử tự động CT-1970, CT-1971 ghi khi chạy; CI của PR |
