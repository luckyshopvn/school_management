---
yctd: YCTD-335
tieu_de: Cổng quản trị: trang Cấu hình trường theo thiết kế mới
ngay: 2026-10-29
phien_ban_de_xuat: 0.211.0
---

## 02 Nhật ký

### 2026-10-29 — Cổng quản trị: trang Cấu hình trường theo thiết kế mới (YCTD-335)

#### Công việc đã thực hiện

- 1.4 Cấu hình trường: ô Đơn vị ("Áp dụng cho") và nút Lưu cấu hình lên cạnh tiêu đề trang; các khối chia thành bảy nhóm (Thông tin chung; Cấp học; Học phí, dịch vụ; Nhân sự, chấm công; Y tế, bán trú, kho; Nề nếp, thi đua; Nhật ký, bảo mật), danh sách nhóm ở bên trái từ 1280 px (hẹp hơn thì ở trên cùng), bấm nhóm thì cuộn tới nhóm.
- Bảng cấu hình theo đơn vị tách theo nhóm; bỏ cột Nguồn, nguồn ghi gọn sau giá trị đang áp dụng (ví dụ "25 · mặc định", "Chưa cấu hình").
- Các đoạn giải thích dài rút thành một dòng gợi ý dưới mục liên quan, giữ quy tắc nhập ngày, "tắt cấp chỉ ẩn, lớp và học sinh giữ nguyên", ngày chốt công cố định mùng 1 tháng sau.
- Kịch bản e2e 05 kiểm danh sách nhóm, bấm nhóm cuộn tới, mục nằm đúng nhóm và cách ghi nguồn mới.

#### Quyết định

- Bấm nhóm thì cuộn tới (mọi nhóm vẫn hiện) thay vì chỉ hiện nhóm đó, để các kịch bản mở thẳng `/settings` rồi dùng thẻ "Cấp học của trường", "Nề nếp, thi đua lớp" không phải chọn nhóm trước (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).
- Mục theo đơn vị xếp vào nhóm theo khóa (bảng ở `settings-groups.ts`); khóa mới chưa có trong bảng thì xếp theo từ khóa trong tên mục, không khớp thì vào Thông tin chung. Hộp công cụ giảng dạy xếp vào nhóm Cấp học vì công cụ hiện theo cấp của lớp.
- Một nút Lưu cấu hình ở đầu trang ghi mọi mục theo đơn vị đã sửa ở mọi nhóm (như trước là một nút cho cả bảng); các khối áp cho cả trường giữ nút Ghi, Lưu riêng và tên nút như cũ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-335, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-335: Cổng quản trị: trang Cấu hình trường theo thiết kế mới – 2026-10-29

- Lý do: thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28: trang cấu hình là một trang dài nhiều đoạn giải thích, khó tìm mục.
- Nội dung thay đổi: ô Đơn vị cạnh tiêu đề; bảy nhóm có danh sách nhóm bên trái; bảng theo đơn vị tách theo nhóm, bỏ cột Nguồn; giải thích rút thành dòng gợi ý. Không bỏ chức năng hay ô nào; tên nút Ghi, Ghi cấp học, Lưu nề nếp, Lưu cấu hình, Lưu, Lưu đăng nhập và bảo mật giữ nguyên.
- Thành phần bị ảnh hưởng: `apps/portal/src/settings/SettingsPage.tsx`, `settings/settings-groups.ts`, `settings/TeachingToolsSettingsBlock.tsx`, `school-levels/SchoolLevelsBlock.tsx`, `conduct/ConductSettingsBlock.tsx`; `tests/e2e/05-settings.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: trang Cấu hình trường của cổng quản trị theo thiết kế mới (YCTD-335).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng quản trị: trang Cấu hình trường theo thiết kế mới | YCTD-335 |
