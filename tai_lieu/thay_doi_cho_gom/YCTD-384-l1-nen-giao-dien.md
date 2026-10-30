---
yctd: YCTD-384
tieu_de: Thiết kế lại giao diện, lát L1: biến thiết kế và thành phần dùng chung mới ở packages/ui
ngay: 2026-10-30
phien_ban_de_xuat: 0.253.0
---

## 02 Nhật ký

### 2026-10-30 — Thiết kế lại giao diện, lát L1: biến thiết kế và thành phần dùng chung mới (YCTD-384)

#### Công việc đã thực hiện

- Nguồn biến duy nhất `packages/ui/tokens.json` (GT-01) theo tài liệu `15` mục 2.6: phong cách hành chính, phong cách theo vai, ba vai giáo viên, phụ huynh, học sinh, màu trạng thái; mỗi màu có giá trị sáng và tối, chế độ tối chưa bật (GT-06). Tập lệnh `packages/ui/scripts/sinh-bien-thiet-ke.mjs` sinh `src/bien-thiet-ke.css` (biến `--pc-*`, dùng được ở ứng dụng không dùng Tailwind) và `src/bien-thiet-ke-tailwind.css` (lớp tiện ích `bg-pc-*`, `text-pc-co-*`, `rounded-pc-*`, `min-h-pc-cham`); `theme.css` nhập hai tệp này.
- Kiểm thử `packages/ui/scripts/sinh-bien-thiet-ke.test.mjs`: tệp sinh khớp nguồn; mọi cặp chữ, nền đạt 4,5:1 và viền ô nhập 3:1 ở cả chế độ sáng và tối; cỡ chữ từ 14 điểm ảnh, chữ ô nhập 16, vùng chạm 44. Kiểm thử bắt được chữ mục đang chọn của thanh bên ở chế độ tối chỉ đạt 1,42:1, đã tách biến riêng.
- Phông Be Vietnam Pro đóng gói qua `@fontsource` (`packages/ui/src/phong-chu.css`), ứng dụng nhập ở lát của mình.
- Sáu thành phần mới ở `packages/ui`: `ShortcutTiles` (TD-22), `NoticeStrip` (TD-24), `ChoiceGroup` (TD-26), `BottomSheet` (TD-27), `SelectionBar` (TD-28), `SectionIndex` (TD-31). Trang thử tạm chụp ở 1366, 1024, 390 điểm ảnh, hai phong cách: hiện đúng, không nút nào dưới 44 điểm ảnh.

#### Quyết định

- Lát L1 chỉ thêm, chưa ứng dụng nào đổi giao diện; tên biến cũ của `theme.css` giữ nguyên giá trị. Việc cập nhật thành phần có sẵn (Button, TextField, StatusBadge, Alert, `DataGrid`) và quy tắc 44, 16 điểm ảnh ở mọi khổ dời sang lát L2 cùng cổng quản trị, để ứng dụng chưa tới lượt không đổi giao diện (cập nhật đặc tả `tai_lieu/ban_mau/yctd-384/DAC_TA.md` mục 5).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-384, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lát L2 (cổng quản trị, khung và lưới) chờ Eric xem điểm xem trước của L1.

## 24 Yêu cầu thay đổi

### YCTD-384: Thiết kế lại giao diện, lát L1: biến thiết kế và thành phần dùng chung mới – 2026-10-30

- Lý do: lát L1 của YCTD-384 theo danh sách lát Eric duyệt ngày 2026-10-30.
- Nội dung thay đổi: nguồn biến `tokens.json` và tập lệnh sinh biến CSS, lớp tiện ích Tailwind; kiểm thử tương phản; phông đóng gói; sáu thành phần dùng chung mới.
- Thành phần bị ảnh hưởng: `packages/ui/tokens.json`, `packages/ui/scripts/*`, `packages/ui/src/bien-thiet-ke.css`, `bien-thiet-ke-tailwind.css`, `phong-chu.css`, `theme.css`, `BottomSheet.tsx`, `ChoiceGroup.tsx`, `NoticeStrip.tsx`, `SectionIndex.tsx`, `SelectionBar.tsx`, `ShortcutTiles.tsx`, `index.ts`, `package.json`; `pnpm-lock.yaml`.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không; biến cũ giữ giá trị, thành phần mới chưa được dùng.
- Kiểm thử cần thực hiện: kiểm thử gói `ui`, kiểm kiểu, lint, toàn bộ kiểm thử của CI.
- Mức: Lớn (thuộc YCTD-384). Người phê duyệt: Eric, ngày 2026-10-30 (bản mẫu, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: thiết kế lại giao diện, lát L1: biến thiết kế sinh từ `tokens.json`, kiểm thử tương phản, phông Be Vietnam Pro đóng gói, sáu thành phần dùng chung mới; chưa ứng dụng nào đổi giao diện (YCTD-384).
- Thư viện mới ở `packages/ui`: `@fontsource/be-vietnam-pro` 5.3.0 (giấy phép OFL-1.1, đã dùng ở `apps/portal`).
- Quay lui: hoàn tác commit hợp nhất của PR; không có database migration.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Thiết kế lại giao diện, lát L1: biến thiết kế, thành phần dùng chung mới | YCTD-384 |
