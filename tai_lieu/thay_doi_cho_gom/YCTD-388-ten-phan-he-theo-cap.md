---
yctd: YCTD-388
tieu_de: Tên phân hệ Quản lý giáo dục theo cấp ở mọi chỗ hiện tên
ngay: 2026-10-30
phien_ban_de_xuat: 0.252.1
---

## 02 Nhật ký

### 2026-10-30 — Tên phân hệ Quản lý giáo dục theo cấp ở mọi chỗ hiện tên

#### Công việc đã thực hiện

- Tái hiện trên bản nhiều trường (cổng 5190, tài khoản thử Hiệu trưởng), tạm bật Tiểu học, Trung học cơ sở rồi trả lại chỉ Mầm non: ô chọn phân hệ, tổng quan phân hệ, Tất cả chức năng đã đúng tên theo cấp; hộp chọn trang của Truy cập nhanh, 1.2 Phân quyền nhóm theo phần mềm, trang Hướng dẫn mục 2 và lúc ngữ cảnh trường đang tải vẫn hiện "Quản lý giáo dục Mầm non" ở trường liên cấp và khi chọn cấp khác.
- Nguyên nhân: các chỗ này đọc thẳng `PORTAL_WORKSPACES[].label` (tên dự phòng của trường mầm non) hoặc ghi cứng, không qua `portalWorkspacesForLevels`.
- Sửa: mục điều hướng mang tên phân hệ đã đặt theo cấp (`navigation-registry.tsx`), Truy cập nhanh nhóm theo tên đó; 1.2 lấy tên theo cấp trường đã bật (`useEnabledLevelWorkspaces`); thêm `portalWorkspacesWithoutLevelName` (`packages/shared/src/portal-menu.ts`) để lúc đang tải chỉ hiện "Quản lý giáo dục"; trang Hướng dẫn mô tả quy tắc đặt tên. Tài liệu 14 mục 1.1 đổi cột Phân hệ về tên gốc "Quản lý giáo dục" và thêm đoạn giải thích; tài liệu 49 phần 02, 07 cập nhật.
- Kiểm thử: CT-1788 (`apps/api/src/school-levels/working-level.test.ts` CT-19c-10), CT-1789 (e2e `tests/e2e/83-school-level-menu.spec.ts` CT-19c-11).

#### Quyết định

- Eric chọn ngày 2026-10-30 phương án A: giữ quy tắc tên hiện có (một cấp "Quản lý giáo dục <tên cấp>", nhiều cấp chọn "Tất cả" là "Quản lý giáo dục"), sửa các chỗ còn hiện tên Mầm non. Không đổi khóa phân hệ, số thứ bậc, quyền, dữ liệu đã lưu (trình duyệt nhớ khóa `education`, không nhớ tên).
- Eric chọn tách phiếu riêng cho nội dung Mầm non đang hiện ở cấp khác: chữ "trẻ" ghi cứng (Báo cáo, 5.3, 4.1.2, bảng điều khiển "Sinh nhật trẻ"), tên và mô tả quyền P02 "Trẻ, phụ huynh và lớp học", biểu mẫu EMIS 1.2, 1.3, 2.2, 2.3, cơ sở vật chất theo Thông tư 13/2020, kiểm định 1.7 cố định cấp "Mầm non", bộ tiêu chuẩn mặc định MN, chuẩn nghề nghiệp 3.2.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-388, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` mục 1.1.

#### Vấn đề tồn đọng

- Nội dung Mầm non ở cấp khác (danh sách ở mục Quyết định) chờ lập phiếu riêng.

## 24 Yêu cầu thay đổi

### YCTD-388: Tên phân hệ Quản lý giáo dục theo cấp ở mọi chỗ hiện tên – 2026-10-30

- Lý do: Eric phản ánh ngày 2026-10-30: trường Tiểu học, Trung học cơ sở, Trung học phổ thông và trường liên cấp vẫn thấy tên "Quản lý giáo dục Mầm non" ở một số chỗ. Quy tắc tên theo cấp của DT-19 phần 19c (YCTD-153) chưa áp dụng ở hộp chọn trang của Truy cập nhanh, 1.2 Phân quyền nhóm theo phần mềm, trang Hướng dẫn và lúc ngữ cảnh trường đang tải.
- Nội dung thay đổi: các chỗ trên lấy tên phân hệ đặt theo cấp; lúc đang tải chỉ hiện "Quản lý giáo dục"; tài liệu 14 mục 1.1 ghi tên gốc kèm quy tắc.
- Thành phần bị ảnh hưởng: `packages/shared/src/portal-menu.ts`, `apps/portal/src/pages/navigation-registry.tsx`, `apps/portal/src/pages/QuickAccess.tsx`, `apps/portal/src/pages/menu-permissions.ts`, `apps/portal/src/school-levels/working-level.tsx`, `apps/portal/src/accounts/RoleWorkspacesPage.tsx`, `apps/portal/src/portal-shell/HelpPage.tsx`; kiểm thử `apps/api/src/school-levels/working-level.test.ts`, `tests/e2e/83-school-level-menu.spec.ts`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Mức: Nhỏ. Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: tên phân hệ Quản lý giáo dục theo cấp ở Truy cập nhanh, 1.2 Phân quyền nhóm theo phần mềm, trang Hướng dẫn và lúc đang tải (YCTD-388).
- Quay lui: hoàn tác commit hợp nhất của PR; không có database migration.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Tên phân hệ Quản lý giáo dục theo cấp ở mọi chỗ hiện tên | YCTD-388 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P01 Nền tảng, đơn vị và phân quyền | YCTD-388: tên phân hệ Quản lý giáo dục theo cấp ở Truy cập nhanh, 1.2, trang Hướng dẫn, lúc đang tải |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1788 | P01-41 | Đặt tên phân hệ cho MN; TH; THCS; THPT; THCS và THPT; cây Mầm non lúc đang tải | "Quản lý giáo dục Mầm non", "... Tiểu học", "... Trung học cơ sở", "... Trung học phổ thông", "Quản lý giáo dục"; lúc tải chỉ "Quản lý giáo dục", phân hệ khác và mục giữ nguyên | Kiểm thử tự động `apps/api/src/school-levels/working-level.test.ts` CT-19c-10 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1789 | P01-41 | Hiệu trưởng, trường bật MN và TH: mở Thêm truy cập nhanh ở "Tất cả", chọn TH; mở 1.2; trả lại chỉ MN rồi mở 1.2 | Nhóm "Phân hệ Quản lý giáo dục", rồi "Phân hệ Quản lý giáo dục Tiểu học", không có nhóm Mầm non; 1.2 có "Quản lý giáo dục"; trường chỉ MN: 1.2 có "Quản lý giáo dục Mầm non" | Kiểm thử giao diện `tests/e2e/83-school-level-menu.spec.ts` CT-19c-11 | Chưa chạy |
