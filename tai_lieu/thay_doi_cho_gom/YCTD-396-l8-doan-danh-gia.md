---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L8: vai trò đoàn đánh giá ngoài (VT-23), giao bộ tiêu chí có thời hạn, chỉ đọc
ngay: 2026-11-03
phien_ban_de_xuat: 0.268.0
---

## 02 Nhật ký

### 2026-11-03 — Kho minh chứng dùng chung, lát L8 (YCTD-396)

#### Công việc đã thực hiện

- Vai trò mẫu VT-23 "Đoàn đánh giá ngoài" với quyền `P09.evidence.review`. Tài khoản của vai này:
  - gán toàn trường, không chọn đơn vị;
  - bắt buộc có ngày hết hiệu lực như kiểm toán viên (VT-20);
  - tự khóa đăng nhập khi hết hạn (quy tắc tài khoản có sẵn).
- Giao bộ tiêu chí cho đoàn (3.5 Đoàn đánh giá ngoài, MH-687):
  - người quản lý kho chọn tài khoản đoàn, bộ tiêu chí, ngày hết hạn giao, ghi chú;
  - giao lại cùng bộ thì gia hạn;
  - thu hồi được.
- Đoàn đánh giá chỉ xem bộ được giao còn hạn của năm học đang dùng:
  - danh sách, chi tiết, tệp, xuất danh mục;
  - không thêm, sửa, không xem độ phủ, tổng quan, nguồn bản ghi;
  - không tải tệp có dữ liệu cá nhân (không có quyền xem nguồn);
  - mỗi lần xem, tải tệp ghi nhật ký truy cập như người dùng khác.
- Menu: thêm 3.5; Tổng quan và Độ phủ không hiện cho đoàn.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - giao theo bộ tiêu chí và năm học, chưa giao theo đợt tự đánh giá (đoàn xem minh chứng, báo cáo tự đánh giá xuất cho đoàn ở 3.4);
  - danh sách tài khoản đoàn đọc từ Quản lý tài khoản, nên người giao cần quyền quản lý tài khoản;
  - hết hạn giao tính đến hết ngày giao, độc lập với ngày hết hiệu lực của tài khoản (cái nào đến trước thì dừng trước).
- Lát này dùng mã BR-555 (cấp theo số tiếp theo trên `main`).

#### Thay đổi

- Xem các tài liệu sau:
  - `24_YEU_CAU_THAY_DOI.md` YCTD-396;
  - `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN};
  - `07_QUY_TAC_NGHIEP_VU.md` BR-555;
  - `11_TIEU_CHI_NGHIEM_THU.md` AC-1449 đến AC-1451;
  - `14_DAC_TA_GIAO_DIEN.md` MH-687;
  - `16_CO_SO_DU_LIEU.md` mục 22f;
  - `17_DAC_TA_API.md` mục 17.17;
  - `21_KICH_BAN_KIEM_THU.md` CT-2155, CT-2156.

#### Vấn đề tồn đọng

- Chưa giao theo đợt tự đánh giá, chưa có màn hình riêng cho đoàn xem phiếu đánh giá tiêu chí.
- Lát L6b chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L8: đoàn đánh giá ngoài – 2026-11-03

- Lý do: lát L8 của YCTD-396; Q-396-9 B (Eric ngày 2026-10-31).
- Nội dung thay đổi:
  - vai trò VT-23, quyền `P09.evidence.review`;
  - bảng giao bộ tiêu chí có thời hạn;
  - phạm vi chỉ đọc của đoàn ở kho minh chứng;
  - màn hình 3.5.
- Thành phần bị ảnh hưởng:
  - `database/identity/migrations/0201_add_external_reviewer_role.ts`;
  - `database/system/migrations/0147_create_evidence_review_grants.ts`, `database/system/schema-parts/yctd-396-doan-danh-gia.ts`;
  - `apps/identity/src/accounts/accounts.service.ts`;
  - `apps/api/src/quality-assurance/`: `evidence-store.ts`, `evidence-store.controller.ts`;
  - `apps/portal/src/quality-assurance/`: `EvidenceReviewersPage.tsx`, `evidence-api.ts`;
  - `apps/portal/src/router.tsx`;
  - `packages/shared/src/`: `index.ts`, `menu-permissions.ts`, `portal-menu.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng:
  - vai trò, quyền mới ở cơ sở dữ liệu định danh;
  - bảng `evidence_review_grants` ở cơ sở dữ liệu hệ thống;
  - điểm cuối `GET`, `PUT /quality/evidences/reviewers`, `DELETE /quality/evidences/reviewers/{id}`;
  - `/frameworks` trả thêm `reviewer`.
- Ảnh hưởng chức năng cũ: tài khoản có vai trò VT-23 bắt buộc có ngày hết hiệu lực; người có quyền kho như trước.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/evidence-store.test.ts`; e2e 243 đến 250, spec mới 251; database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-10-31 (Q-396-9 B, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: vai trò đoàn đánh giá ngoài VT-23, giao bộ tiêu chí có thời hạn, chỉ đọc (YCTD-396 lát L8).
- Database migration: định danh `0201_add_external_reviewer_role`; hệ thống `0147_create_evidence_review_grants`. Quay lui: chạy `down` (bỏ vai trò, quyền, gán vai trò VT-23; xóa bảng giao).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L8 | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L8 (vai trò đoàn đánh giá ngoài VT-23, giao bộ tiêu chí có thời hạn, chỉ đọc) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-555 | Đoàn đánh giá ngoài (YCTD-396 lát L8, Q-396-9 B): tài khoản vai trò VT-23 gán toàn trường, bắt buộc có ngày hết hiệu lực; người quản lý kho giao bộ tiêu chí của năm học đang dùng cho tài khoản đoàn đến hết ngày giao (từ hôm nay trở đi), giao lại thì gia hạn, thu hồi được; người chỉ có quyền `P09.evidence.review` chỉ xem danh sách, chi tiết, tệp, danh mục của minh chứng có mã ở bộ được giao còn hạn; không thêm, sửa, không xem độ phủ, tổng quan, nguồn bản ghi; tệp có dữ liệu cá nhân theo quyền xem nguồn; mọi lần xem, tải tệp ghi nhật ký |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1449 | Cho tài khoản VT-23 chưa được giao / Khi xem kho / Thì danh sách bộ trống, xem minh chứng bị 403; giáo viên giao bộ bị 403; giao với ngày hết hạn hôm qua bị 422 (CT-2155; YCTD-396 lát L8) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1450 | Cho đoàn được giao bộ Mầm non đến 10 ngày sau / Khi xem / Thì chỉ thấy bộ đó, xem danh sách, chi tiết, xuất danh mục được; bộ khác, độ phủ, tổng quan, nguồn, thêm minh chứng bị 403; tệp có dữ liệu cá nhân bị 403; khi hết hạn giao thì không thấy bộ, xem minh chứng bị 403, danh sách giao hiện Hết hạn (CT-2155; YCTD-396 lát L8) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1451 | Cho Hiệu trưởng giao bộ Mầm non cho tài khoản đoàn trên giao diện / Khi đoàn đăng nhập mở danh sách minh chứng / Thì ô bộ tiêu chí chỉ có bộ Mầm non, không có nút Thêm minh chứng (CT-2156; YCTD-396 lát L8) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-687 | Đoàn đánh giá ngoài (YCTD-396 lát L8; mục "3.5." của Minh chứng và kiểm định, `/quality/evidence-reviewers`, lưới khóa `quality-evidence-reviewers`): biểu mẫu Giao bộ tiêu chí cho đoàn đánh giá (Tài khoản đoàn: tài khoản vai trò VT-23 đang hoạt động, Bộ tiêu chí, Hết hạn giao, Ghi chú, Giao bộ); lưới tài khoản đoàn, bộ, hết hạn giao, trạng thái Còn hạn hoặc Hết hạn, ghi chú (ẩn), người giao (ẩn), nút Thu hồi | Người quản lý kho minh chứng (`P09.evidence.manage`); đọc danh sách tài khoản cần quyền quản lý tài khoản |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2155 | P09-43 | CT-396-25: tài khoản VT-23 xem kho trước khi giao; giáo viên giao; Hiệu trưởng giao hết hạn hôm qua rồi đến 10 ngày sau; đoàn xem bộ được giao, bộ khác, chi tiết, tệp có dữ liệu cá nhân, độ phủ, tổng quan, nguồn, thêm minh chứng, xuất danh mục; đổi hạn giao thành hôm qua | Bộ trống, 403; 403; 422, 200; chỉ bộ được giao, 403 bộ khác, chi tiết 200, tệp 403, ba trang 403, thêm 403, xuất 200; sau hết hạn: bộ trống, 403, danh sách giao Hết hạn, thu hồi 204 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2156 | P09-43 | CT-396-26 (giao diện): Hiệu trưởng nạp bộ Mầm non, mở 3.5, giao cho tài khoản đoàn đến 31/12/2099; đoàn đăng nhập mở danh sách minh chứng | Thông báo đã giao; ô bộ tiêu chí chỉ có bộ Mầm non; không có nút Thêm minh chứng | Kiểm thử giao diện `tests/e2e/251-doan-danh-gia.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L8 | Kho minh chứng dùng chung, lát L8: đoàn đánh giá ngoài | {PHIEN_BAN} | P09-43 | AC-1449 đến AC-1451 | CT-2155, CT-2156 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/evidence-store.ts`, `apps/portal/src/quality-assurance/EvidenceReviewersPage.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
