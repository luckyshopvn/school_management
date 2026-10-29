---
yctd: YCTD-331
tieu_de: Thiết kế lại cổng quản trị trường, khung bổ sung: dải thông báo, một nút ngữ cảnh, phông Be Vietnam Pro
ngay: 2026-10-29
phien_ban_de_xuat: 0.207.0
---

## 02 Nhật ký

### 2026-10-29 — Cổng quản trị: dải thông báo, một nút ngữ cảnh, phông Be Vietnam Pro (YCTD-331)

#### Công việc đã thực hiện

- Thông báo khi vào trang (DT-16 phần 16c) đổi từ hộp bật lên che trang sang dải ở đầu nội dung: mỗi thông báo một dòng, có nút Đóng; nhắc cập nhật mã định danh tổ chức vẫn có đường dẫn "Cập nhật hồ sơ trường". Nhắc mật khẩu sắp hết hạn chỉ còn ở dải cảnh báo đầu trang (trước hiện cả hai nơi).
- Bộ chọn cấp học chuyển vào hộp ngữ cảnh "cấp · năm học · học kỳ" ở thanh đầu trang, nên thanh đầu trang chỉ còn một nút ngữ cảnh.
- Phông chữ của cổng quản trị đổi sang Be Vietnam Pro, tự phục vụ cùng ứng dụng bằng gói `@fontsource/be-vietnam-pro` 5.3.0 (giấy phép OFL-1.1), không tải từ máy chủ ngoài.
- Trợ giúp e2e `openWorkingContext`; `selectSchoolLevel` mở hộp ngữ cảnh trước; sửa kịch bản 59, 83, 86.

#### Quyết định

- Phông tự phục vụ thay Google Fonts để trình duyệt của người dùng không gửi yêu cầu ra máy chủ ngoài (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-331, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Ô tìm chung, trang "Tất cả chức năng", nhóm "Hay dùng" làm ở PR sau; các trang theo canvas làm ở các PR sau nữa.

## 24 Yêu cầu thay đổi

### YCTD-331: Cổng quản trị: dải thông báo, một nút ngữ cảnh, phông Be Vietnam Pro – 2026-10-29

- Lý do: áp tiếp thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28 (sau phần khung chung YCTD-330).
- Nội dung thay đổi: dải thông báo thay hộp bật lên; bộ chọn cấp vào hộp ngữ cảnh năm học; phông Be Vietnam Pro tự phục vụ. Kịch bản CT-16c-19, CT-16c-20, CT-16c-21 kiểm dải thông báo (vùng "Thông báo") thay hộp; CT-19c-9 mở hộp ngữ cảnh trước khi chọn cấp.
- Thành phần bị ảnh hưởng: `apps/portal/src/portal-shell/StartupNotices.tsx`, `pages/AppShell.tsx`, `pages/AcademicYearSwitcher.tsx`, `school-levels/working-level.tsx`, `main.tsx`, `index.css`, `apps/portal/package.json`; `tests/e2e/menu.ts`, `59-portal-shell-login`, `83-school-level-menu`, `86-multi-level`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: khung bổ sung của cổng quản trị trường (YCTD-331).
- Dải thông báo thay hộp bật lên; một nút ngữ cảnh cấp, năm học, học kỳ; phông Be Vietnam Pro tự phục vụ.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng quản trị: dải thông báo, một nút ngữ cảnh, phông Be Vietnam Pro | YCTD-331 |
