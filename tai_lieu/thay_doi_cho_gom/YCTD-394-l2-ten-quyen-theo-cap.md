---
yctd: YCTD-394
tieu_de: Chữ "trẻ" theo cấp học, lát L2: tên nhóm quyền P02 và mô tả quyền
ngay: 2026-10-30
phien_ban_de_xuat: 0.254.0
---

## 02 Nhật ký

### 2026-10-30 — Chữ "trẻ" theo cấp học, lát L2: tên nhóm quyền P02 và mô tả quyền

#### Công việc đã thực hiện

- Database migration định danh `0199_learner_term_in_permission_descriptions.ts`: 21 mô tả quyền có chữ "trẻ" đổi thành chỗ giữ `{người học}` (hoặc `{Người học}` ở đầu cụm), chỉ đổi dòng còn đúng mô tả cũ; quay lui trả chữ cũ.
- `MODULE_NAMES.P02` (`packages/shared/src/index.ts`) thành "{Người học}, phụ huynh và lớp học".
- 1.3 Phân quyền nhóm theo menu (`RolePermissionsPage.tsx`) điền chỗ giữ theo các cấp trường đã bật (`useEnabledLevelTerms`, `apps/portal/src/school-levels/working-level.tsx`), dùng `fillLearnerTerm` của lát L1.
- Kiểm thử: CT-1973 (`database/src/learner-term-permissions.test.ts`).

#### Quyết định

- Eric chọn ngày 2026-10-30 phương án thay theo cấp: quyền dùng chung cho cả trường nên điền theo các cấp trường đã bật, không theo cấp đang làm việc; trường chỉ có Mầm non thấy y như trước.
- Giữ "trẻ" ở hai quyền riêng của Mầm non: `P02.program-completion.manage` (hoàn thành chương trình giáo dục mầm non), `P17.report.growth` (cân nặng, chiều cao theo kênh tăng trưởng). Không đổi mã quyền, gán quyền, bảng `modules` (tên ở bảng này không hiển thị).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-394 lát L2, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` (đoạn YCTD-394 lát L2), `16_CO_SO_DU_LIEU.md` bảng `permissions`.

#### Vấn đề tồn đọng

- Ngoài phạm vi (như lát L1): danh mục "Quan hệ với trẻ"; chữ "trẻ" phía API ở `emis-so-calc.ts`, `program-completion.ts`, `attendance.service.ts`, `imports.service.ts`, `education-plans.ts`.

## 24 Yêu cầu thay đổi

### YCTD-394: Chữ "trẻ" theo cấp học, lát L2: tên nhóm quyền P02 và mô tả quyền – 2026-10-30

- Lý do: trang 1.3 Phân quyền nhóm theo menu của trường Tiểu học, Trung học cơ sở, Trung học phổ thông vẫn ghi tên nhóm "Trẻ, phụ huynh và lớp học" và mô tả quyền có chữ "trẻ".
- Nội dung thay đổi: mô tả quyền lưu chỗ giữ người học, cổng quản trị điền theo các cấp trường đã bật; tên nhóm P02 dùng cùng chỗ giữ. Trường chỉ có Mầm non thấy y như trước.
- Thành phần bị ảnh hưởng: `database/identity/migrations/0199_learner_term_in_permission_descriptions.ts`, `packages/shared/src/index.ts`, `apps/portal/src/accounts/RolePermissionsPage.tsx`, `apps/portal/src/school-levels/working-level.tsx`; kiểm thử `database/src/learner-term-permissions.test.ts`; tài liệu `14`, `16`.
- Dữ liệu bị ảnh hưởng: cột `permissions.description` của 21 quyền (cơ sở dữ liệu định danh), có database migration quay lui.
- API bị ảnh hưởng: `GET` danh sách quyền của dịch vụ định danh trả mô tả có chỗ giữ; mã, cấu trúc không đổi.
- Quyền bị ảnh hưởng: không đổi mã quyền, gán quyền; chỉ đổi chữ mô tả.
- Mức: Vừa. Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: tên nhóm quyền P02 và mô tả quyền ở 1.3 Phân quyền nhóm theo menu ghi người học theo cấp trường đã bật (YCTD-394 lát L2).
- Database migration: định danh `0199_learner_term_in_permission_descriptions`.
- Quay lui: chạy `down` của database migration 0199 (trả mô tả cũ) rồi hoàn tác commit hợp nhất của PR.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Chữ "trẻ" theo cấp học, lát L2: tên nhóm quyền P02 và mô tả quyền | YCTD-394 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P01 Nền tảng, đơn vị và phân quyền | YCTD-394 lát L2: tên nhóm quyền P02 và mô tả quyền theo cấp trường đã bật |

## Thêm dòng

| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1332 | Cho trường có cấp phổ thông / Khi mở 1.3 Phân quyền nhóm theo menu / Thì tên nhóm P02 và mô tả quyền ghi "học sinh" thay "trẻ" (trừ hai quyền riêng của Mầm non); trường chỉ có Mầm non thấy chữ như trước; quay lui database migration trả mô tả cũ (CT-1973; YCTD-394) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1973 | P01-41 | Cơ sở dữ liệu định danh mới chạy mọi database migration; điền chỗ giữ cho Tiểu học, Mầm non; chạy `down` của 0199 | Chỉ `P02.program-completion.manage`, `P17.report.growth` còn chữ "trẻ"; "Xem sinh nhật học sinh trong tháng của đơn vị"; điền cho Mầm non bằng đúng mô tả sau quay lui, không còn chỗ giữ | Kiểm thử tự động `database/src/learner-term-permissions.test.ts` CT-1973 | Chưa chạy |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-394 (lát L2) | Chữ "trẻ" theo cấp học, lát L2: tên nhóm quyền P02 và mô tả quyền | {PHIEN_BAN} | P01-41 | AC-1332 | CT-1973 | PR, commit merge ghi khi gom; tệp mã: `database/identity/migrations/0199_learner_term_in_permission_descriptions.ts`, `apps/portal/src/accounts/RolePermissionsPage.tsx` | Kiểm thử tự động CT-1973 đạt trên máy; CI của PR |
