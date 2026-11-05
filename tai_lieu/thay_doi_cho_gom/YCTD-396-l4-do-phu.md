---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L4: phân công phụ trách tiêu chí, độ phủ, tiêu chí thiếu, tổng quan, Việc của tôi
ngay: 2026-11-01
phien_ban_de_xuat: 0.264.0
---

## 02 Nhật ký

### 2026-11-01 — Kho minh chứng dùng chung, lát L4 (YCTD-396)

#### Công việc đã thực hiện

- Phân công phụ trách tiêu chí (3.2): người quản lý kho chọn một hoặc nhiều tiêu chí của bộ, giao một cán bộ có tài khoản với hạn hoàn thành, ghi chú; bỏ phân công; nút lấy trưởng nhóm công tác của đợt tự đánh giá chưa hoàn thành làm người phụ trách cho tiêu chí chưa có người.
- Người được phân công sửa được minh chứng của tiêu chí mình phụ trách trong năm học đang dùng (thêm vào quy tắc người tạo, người phụ trách minh chứng, nhóm công tác của 22f).
- Độ phủ theo tiêu chí (1.3): mỗi tiêu chí một dòng với số minh chứng Đã đủ, Đang thu thập, Chưa có, Cần cập nhật, Hết hiệu lực, Ngoài chu kỳ, gợi ý minh chứng, người phụ trách, hạn; lọc tiêu chí còn thiếu.
- Tổng quan (1.1): tỉ lệ tiêu chí đủ minh chứng của từng bộ và tiêu chuẩn, tiêu chí còn thiếu kèm người phụ trách, minh chứng sắp hết hoặc đã hết hiệu lực, tiêu chí người đang xem phụ trách.
- Việc của tôi có nguồn mới "Minh chứng": tiêu chí được phân công còn thiếu (hạn là hạn hoàn thành), minh chứng mình tạo hoặc phụ trách sắp hết, đã hết hiệu lực.
- Menu "Minh chứng và kiểm định": 1.1 Tổng quan, 1.2 Danh sách minh chứng, 1.3 Độ phủ theo tiêu chí; 3.2 Phân công phụ trách tiêu chí, Theo dõi công nhận chuyển thành 3.3.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: chu kỳ của bộ tính theo tên năm học (năm đang dùng và các năm liền trước, đủ số năm của chu kỳ); minh chứng không ghi năm học dùng cho mọi năm; mỗi tiêu chí một người phụ trách mỗi năm học; người phụ trách phải là cán bộ đang làm việc có tài khoản; minh chứng Đã đủ nhưng chỉ dùng cho năm ngoài chu kỳ đếm riêng ở cột Ngoài chu kỳ, không làm tiêu chí đủ. Nguồn "Minh chứng" của Việc của tôi chưa báo bản ghi nguồn đã sửa sau lần chụp (phải gọi từng phân hệ nguồn), xem ở chi tiết minh chứng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-396, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `07_QUY_TAC_NGHIEP_VU.md` BR-548, BR-549, `11_TIEU_CHI_NGHIEM_THU.md` AC-1436 đến AC-1439, `14_DAC_TA_GIAO_DIEN.md` MH-678, MH-682, MH-683, MH-256, `16_CO_SO_DU_LIEU.md` mục 22f, `17_DAC_TA_API.md` mục 17.17, `21_KICH_BAN_KIEM_THU.md` CT-2147, CT-2148.

#### Vấn đề tồn đọng

- Mục "1.1." ghi ở MH-679 (mảnh lát L1) nay là "1.2.".
- Lát L5 đến L8 chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L4: phân công, độ phủ, tổng quan – 2026-11-01

- Lý do: lát L4 của YCTD-396 (mục 4.5 của bản đặc tả `tai_lieu/ban_mau/yctd-396/DAC_TA.md`).
- Nội dung thay đổi: bảng phân công phụ trách tiêu chí theo năm học; độ phủ, tiêu chí thiếu; tổng quan; nguồn "Minh chứng" của Việc của tôi; người được phân công sửa minh chứng của tiêu chí.
- Thành phần bị ảnh hưởng: `database/system/migrations/0145_create_evidence_assignments.ts`, `database/system/schema-parts/yctd-396-phan-cong.ts`; `apps/api/src/quality-assurance/` (`evidence-store.ts`, `evidence-store.controller.ts`); `apps/api/src/my-work/my-work-sources.ts`; `apps/portal/src/quality-assurance/` (`EvidenceCoveragePages.tsx`, `evidence-api.ts`), `apps/portal/src/router.tsx`; `packages/shared/src/` (`evidence-store.ts`, `professional-records.ts`, `portal-menu.ts`, `menu-permissions.ts`, `index.ts`).
- Dữ liệu, API, quyền bị ảnh hưởng: bảng mới `evidence_assignments` ở cơ sở dữ liệu hệ thống; điểm cuối mới `GET /quality/evidences/overview`, `/coverage`, `/assignees`, `PUT /quality/evidences/assignments`, `POST /quality/evidences/assignments/from-groups`; nguồn Việc của tôi `evidence`; không thêm quyền (phân công dùng `P09.evidence.manage`).
- Ảnh hưởng chức năng cũ: Danh sách minh chứng đổi số mục thành 1.2, Theo dõi công nhận thành 3.3; quy tắc sửa minh chứng thêm người được phân công.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/evidence-store.test.ts`; e2e 243 (đổi số mục), spec mới 247; database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-10-31 (danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-01

- Phạm vi thay đổi: phân công phụ trách tiêu chí, độ phủ theo tiêu chí, tổng quan kho minh chứng, nguồn "Minh chứng" của Việc của tôi (YCTD-396 lát L4).
- Database migration: hệ thống `0145_create_evidence_assignments`. Quay lui: chạy `down` (xóa bảng phân công; minh chứng không đổi).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L4 | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L4 (phân công phụ trách tiêu chí, độ phủ, tiêu chí thiếu, tổng quan kho minh chứng, nguồn Minh chứng ở Việc của tôi) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-548 | Độ phủ minh chứng (YCTD-396 lát L4): tiêu chí đủ khi có ít nhất một minh chứng ở trạng thái Đã đủ, chưa hết hiệu lực, dùng cho một năm học trong chu kỳ của bộ (năm đang dùng và các năm liền trước, đủ số năm của chu kỳ); minh chứng không ghi năm học dùng cho mọi năm; còn lại là tiêu chí thiếu |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-549 | Phân công phụ trách tiêu chí (YCTD-396 lát L4): mỗi tiêu chí của một bộ một người phụ trách mỗi năm học, là cán bộ đang làm việc có tài khoản; chỉ người quản lý kho toàn trường phân công, bỏ phân công; người phụ trách (có quyền đóng góp) sửa được minh chứng của tiêu chí đó trong năm học đang dùng; lấy trưởng nhóm công tác chỉ điền tiêu chí chưa có người |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1436 | Cho giáo viên không tạo minh chứng của tiêu chí 5.1 / Khi Hiệu trưởng phân công giáo viên phụ trách 5.1 / Thì giáo viên sửa được minh chứng đó; bỏ phân công thì lại bị 403; giáo viên phân công bị 403; giao cho người không phải cán bộ bị 422 (CT-2147; YCTD-396 lát L4) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1437 | Cho tiêu chí chỉ có minh chứng Đã đủ đã hết hiệu lực và minh chứng Đã đủ của năm học ngoài chu kỳ / Khi xem độ phủ / Thì tiêu chí thiếu, đếm 1 Hết hiệu lực, 1 Ngoài chu kỳ; tiêu chí có minh chứng Đã đủ còn hiệu lực thì đủ (CT-2147; YCTD-396 lát L4) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1438 | Cho giáo viên phụ trách tiêu chí 5.1 (đủ) và 5.2 (thiếu, hạn ngày mai) / Khi mở Tổng quan, Việc của tôi / Thì Tổng quan có cả hai tiêu chí; Việc của tôi có "Tiêu chí thiếu minh chứng" của 5.2, sắp đến hạn; Tổng quan của Hiệu trưởng có tỉ lệ đủ và 5.2 trong tiêu chí còn thiếu (CT-2147; YCTD-396 lát L4) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1439 | Cho bộ kiểm định Mầm non đã nạp / Khi Hiệu trưởng phân công giáo viên phụ trách tiêu chí 1.1 trên giao diện / Thì lưới phân công và độ phủ hiện người phụ trách; giáo viên thấy 1.1 ở Tổng quan (CT-2148; YCTD-396 lát L4) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-678 | Tổng quan minh chứng (YCTD-396 lát L4; mục "1.1." của Minh chứng và kiểm định, `/quality/evidence-overview`): năm học; Tiêu chí tôi phụ trách (liên kết tới độ phủ, hạn, Đủ minh chứng hoặc Thiếu); mỗi bộ một khung với tỉ lệ tiêu chí đủ, tỉ lệ theo tiêu chuẩn, tối đa 20 tiêu chí còn thiếu kèm người phụ trách, hạn; minh chứng sắp hết, đã hết hiệu lực | Người có một trong ba quyền kho minh chứng (`P09.evidence.view`, `.contribute`, `.manage`) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-682 | Độ phủ theo tiêu chí (YCTD-396 lát L4; mục "1.3.", `/quality/evidence-coverage`, nhận `?framework_id=`, lưới khóa `quality-evidence-coverage`): chọn bộ, Chỉ tiêu chí còn thiếu, tìm theo mã, nội dung; dòng tỉ lệ đủ và năm học của chu kỳ; cột tiêu chí, nội dung, độ phủ, Đã đủ, Đang thu thập, Chưa có, Cần cập nhật, Hết hiệu lực, Ngoài chu kỳ (ẩn), Gợi ý minh chứng (ẩn), người phụ trách, hạn | Người có một trong ba quyền kho minh chứng |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-683 | Phân công phụ trách tiêu chí (YCTD-396 lát L4; mục "3.2.", `/quality/evidence-assignments`, lưới khóa `quality-evidence-assignments`): chọn bộ; cột tiêu chí, nội dung, người phụ trách, hạn, ghi chú (ẩn), trưởng nhóm công tác, độ phủ; chọn nhiều dòng hoặc nút Phân công từng dòng mở biểu mẫu Người phụ trách, Hạn hoàn thành, Ghi chú với Ghi phân công, Bỏ phân công, Hủy; nút Lấy trưởng nhóm công tác làm người phụ trách | Người quản lý kho minh chứng (`P09.evidence.manage`) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2147 | P09-43 | CT-396-17: bộ có tiêu chí 5.1 (minh chứng Đang thu thập của giáo viên A), 5.2 (minh chứng Đã đủ năm 2000-2001, minh chứng Đã đủ hết hạn hôm qua); giáo viên B sửa minh chứng 5.1; giáo viên A phân công; giao cho phụ huynh; Hiệu trưởng giao 5.1, 5.2 cho B hạn ngày mai; B sửa 5.1 thành Đã đủ; xem độ phủ, Tổng quan, Việc của tôi; bỏ phân công | 403; 403; 422; giao 2; 200; 5.1 đủ, 5.2 thiếu với 1 Hết hiệu lực, 1 Ngoài chu kỳ, 50%; Tổng quan có 5.2 thiếu, B thấy 5.1, 5.2; Việc của tôi có 5.2 sắp đến hạn; bỏ 2, B sửa lại bị 403 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2148 | P09-43 | CT-396-18 (giao diện): Hiệu trưởng nạp bộ Mầm non, phân công giáo viên phụ trách 1.1 hạn 31/12/2099, mở Độ phủ; giáo viên mở Tổng quan | Thông báo đã phân công 1 tiêu chí; lưới phân công và độ phủ có tên giáo viên, dòng tỉ lệ trên 22 tiêu chí; Tổng quan của giáo viên có 1.1 | Kiểm thử giao diện `tests/e2e/247-phan-cong-do-phu.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L4 | Kho minh chứng dùng chung, lát L4: phân công phụ trách tiêu chí, độ phủ, tổng quan | {PHIEN_BAN} | P09-43 | AC-1436 đến AC-1439 | CT-2147, CT-2148 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/evidence-store.ts`, `apps/portal/src/quality-assurance/EvidenceCoveragePages.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 01/11/2026; CI của PR |
