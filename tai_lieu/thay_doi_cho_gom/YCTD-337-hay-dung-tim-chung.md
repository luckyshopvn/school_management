---
yctd: YCTD-337
tieu_de: Cổng quản trị: nhóm Hay dùng và ô tìm chung học sinh, cán bộ
ngay: 2026-10-29
phien_ban_de_xuat: 0.213.0
---

## 02 Nhật ký

### 2026-10-29 — Cổng quản trị: nhóm Hay dùng và ô tìm chung học sinh, cán bộ (YCTD-337)

#### Công việc đã thực hiện

- Bảng `user_recent_pages` ở cơ sở dữ liệu hệ thống (thay đổi cấu trúc 0125): trang mỗi tài khoản mở gần đây, khóa (user_id, path), giữ tối đa 20 dòng mỗi tài khoản.
- API: `GET /me/recent-pages` (tối đa 8 trang mới nhất, bỏ trang của cấp chưa bật), `POST /me/recent-pages` (ghi lần mở trang, chỉ nhận đường dẫn là mục menu của cổng quản trị), `DELETE /me/recent-pages?path=` (bỏ một trang); chỉ của chính tài khoản đang đăng nhập.
- API: `GET /search?q=` (từ khóa 2 đến 100 ký tự) tìm học sinh, cán bộ theo tên bằng chính danh sách học sinh, danh sách cán bộ nên theo đúng phạm vi xem của người dùng; tối đa 5 mỗi nhóm; không có quyền xem nhóm nào thì nhóm đó trống; chỉ trả mã, tên, lớp hoặc đơn vị, đường dẫn.
- Cổng quản trị: khung trang ghi mỗi lần mở trang là mục menu; khối "Hay dùng" trên trang chủ có nút bỏ từng trang; ô tìm ở thanh đầu trang hiện "Hay dùng" khi chưa gõ, gõ từ 2 ký tự thì có thêm nhóm Học sinh, Cán bộ, giáo viên; mở học sinh thì trang 4.1.1 điền sẵn ô tìm (`/children?q=`), mở cán bộ thì vào hồ sơ.
- Kiểm thử đơn vị CT-337-1 đến CT-337-6 (`apps/api/src/recent-pages/recent-pages.test.ts`), e2e CT-337-7 (`tests/e2e/237-hay-dung-tim-chung.spec.ts`).

#### Quyết định

- GD-180 (Eric, 2026-10-29): "Hay dùng" theo trang mỗi người dùng mở gần nhất, lưu ở máy chủ, không cấu hình theo nhóm; ô tìm chung tìm học sinh, cán bộ theo quyền xem, không trả số định danh. Ghi ở `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 21.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-337, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-337: Cổng quản trị: nhóm Hay dùng và ô tìm chung học sinh, cán bộ – 2026-10-29

- Lý do: Eric chốt phương án đề xuất cho nhóm "Hay dùng" và ô tìm chung của thiết kế "Cổng quản trị trường".
- Nội dung thay đổi: bảng `user_recent_pages`; điểm cuối `me/recent-pages`, `search`; khối Hay dùng trên trang chủ; ô tìm chung có học sinh, cán bộ.
- Thành phần bị ảnh hưởng: `database/system/migrations/0125_create_user_recent_pages.ts`, `database/system/schema-parts/yctd-337-hay-dung.ts`; `apps/api/src/recent-pages/`, `apps/api/src/global-search/`, `application.module.ts`; `apps/portal/src/pages/AppShell.tsx`, `FunctionSearch.tsx`, `RecentPages.tsx`, `recent-pages-api.ts`, `HomePage.tsx`, `children/ChildrenPage.tsx`; `tests/e2e/237-hay-dung-tim-chung.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: nhóm Hay dùng và ô tìm chung học sinh, cán bộ của cổng quản trị (YCTD-337).
- Cơ sở dữ liệu hệ thống thêm bảng `user_recent_pages` (thay đổi cấu trúc 0125).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng quản trị: nhóm Hay dùng, ô tìm chung học sinh, cán bộ | YCTD-337 |
