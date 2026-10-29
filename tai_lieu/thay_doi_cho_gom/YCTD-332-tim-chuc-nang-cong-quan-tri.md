---
yctd: YCTD-332
tieu_de: Cổng quản trị: ô tìm chức năng và trang Tất cả chức năng
ngay: 2026-10-29
phien_ban_de_xuat: 0.208.0
---

## 02 Nhật ký

### 2026-10-29 — Cổng quản trị: ô tìm chức năng và trang Tất cả chức năng (YCTD-332)

#### Công việc đã thực hiện

- Ô "Tìm chức năng" ở thanh đầu trang: gõ tên hoặc số thứ bậc của mục menu, gõ không dấu vẫn khớp; mũi tên lên, xuống, Enter, Esc theo mẫu combobox; chỉ tìm trong cây menu đã lọc theo quyền của mọi phân hệ người dùng được thấy; mở trang thuộc phân hệ khác thì thanh bên tự chuyển phân hệ.
- Trang "Tất cả chức năng" (`/all-functions`): toàn bộ cây menu đánh số của mọi phân hệ người dùng được thấy, phân hệ đang chọn đứng đầu, ô lọc theo tên hoặc số; đường vào ở cuối thanh bên. Đây là đường vào cho các mục sẽ gom khỏi thanh bên ở các phần áp thiết kế từng trang.
- Kịch bản e2e CT-332-1 ở `01-login.spec.ts`.

#### Quyết định

- Ô tìm ở phần này chỉ tìm chức năng (trang); tìm học sinh, cán bộ theo tên làm sau khi có điểm cuối tìm chung ở máy chủ (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-332, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Nhóm "Hay dùng" khi chọn phân hệ (theo vai trò) chưa làm: cần nơi cấu hình phân hệ hay dùng cho từng nhóm người dùng (ở 1.2 Phân quyền nhóm theo phần mềm) và điểm cuối máy chủ tương ứng.

## 24 Yêu cầu thay đổi

### YCTD-332: Cổng quản trị: ô tìm chức năng và trang Tất cả chức năng – 2026-10-29

- Lý do: áp tiếp thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28: ô tìm ở đầu trang, trang "Tất cả chức năng" làm đường vào cho mọi mục.
- Nội dung thay đổi: ô tìm chức năng ở thanh đầu trang; trang `/all-functions` có ô lọc; đường vào ở cuối thanh bên.
- Thành phần bị ảnh hưởng: `apps/portal/src/pages/FunctionSearch.tsx`, `function-search.ts`, `AllFunctionsPage.tsx`, `AppShell.tsx`, `router.tsx`; `tests/e2e/01-login.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: ô tìm chức năng và trang Tất cả chức năng của cổng quản trị (YCTD-332).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng quản trị: ô tìm chức năng, trang Tất cả chức năng | YCTD-332 |
