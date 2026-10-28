---
yctd: YCTD-350
tieu_de: Điểm danh đầu ngày ở mọi cấp, điểm danh theo tiết lấy mặc định từ điểm danh đầu ngày
ngay: 2026-10-28
phien_ban_de_xuat: 0.230.0
---

## 02 Nhật ký

### 2026-10-28 — Điểm danh đầu ngày ở mọi cấp, điểm danh theo tiết lấy mặc định từ điểm danh đầu ngày

#### Công việc đã thực hiện

- `packages/shared/src/level-features.ts`: bật `daily_attendance` cho mọi cấp. Ứng dụng giáo viên mở bảng điểm danh theo ngày ở lớp mọi cấp (thẻ lớp, chế độ lớp học). Ứng dụng phụ huynh hiện "Điểm danh tháng này" và dòng điểm danh hôm nay ở con mọi cấp.
- Bảng điểm danh của ứng dụng giáo viên ghi "Điểm danh cả ngày" ở lớp Mầm non, "Điểm danh đầu ngày" ở lớp Tiểu học, THCS, THPT.
- `GET /class-logs/lesson`: tiết chưa ghi điểm danh lấy trạng thái theo điểm danh đầu ngày của học sinh ở lớp:
  - có mặt, đi muộn giữ nguyên;
  - về sớm là có mặt; đi muộn và về sớm là đi muộn;
  - nghỉ có báo là vắng có phép; nghỉ không báo là vắng không phép.
  Ngày chưa điểm danh đầu ngày thì như trước: có báo vắng là vắng có phép, không có là có mặt. Mỗi học sinh có thêm `status_source`, `daily_status`; ghi chú mặc định là ghi chú của điểm danh đầu ngày. Logic tách ở `apps/api/src/class-logs/period-defaults.ts`.
- Sổ đầu bài của ứng dụng giáo viên ghi "Theo điểm danh đầu ngày: …" dưới tên học sinh. Học sinh về sớm được tô màu, nhắc chọn vắng có phép ở các tiết sau. Giáo viên tiết vẫn sửa được trạng thái (điểm danh lại).
- Kiểm thử đơn vị `period-defaults.test.ts`, kiểm thử máy chủ API ở `class-logs.test.ts`. Sửa `multi-level-apps.test.ts` và kiểm thử giao diện 85 theo quy tắc mới.

#### Quyết định

- Eric chốt ngày 2026-10-28: Mầm non điểm danh cả ngày; các cấp khác điểm danh theo tiết, chủ yếu lấy từ điểm danh đầu ngày, trừ khi giáo viên muốn điểm danh lại hoặc học sinh có phép về sớm.
- Điểm danh đầu ngày đã ghi đứng trước báo vắng của phụ huynh, vì giáo viên đã xác nhận tại lớp. Về sớm không biết từ tiết nào nên các tiết vẫn mặc định có mặt; giáo viên tiết sau sửa. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-350, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chưa ghi giờ về sớm ở điểm danh đầu ngày; nếu cần tự đánh vắng các tiết sau giờ về thì làm phần riêng.

## 24 Yêu cầu thay đổi

### YCTD-350: Điểm danh đầu ngày ở mọi cấp, điểm danh theo tiết lấy mặc định từ điểm danh đầu ngày – 2026-10-28

- Lý do: Eric chốt cách điểm danh theo cấp: Mầm non cả ngày; Tiểu học, THCS, THPT điểm danh theo tiết lấy từ điểm danh đầu ngày, trừ khi giáo viên điểm danh lại hoặc học sinh có phép về sớm.
- Nội dung thay đổi: điểm danh theo ngày ở mọi cấp; trạng thái mặc định của tiết theo điểm danh đầu ngày; nhãn ở ứng dụng giáo viên.
- Thành phần bị ảnh hưởng: `packages/shared/src/level-features.ts`, `apps/api/src/class-logs/class-logs.ts`, `apps/api/src/class-logs/period-defaults.ts`, `apps/api/src/class-logs/period-defaults.test.ts`, `apps/api/src/class-logs/class-logs.test.ts`, `apps/api/src/school-levels/multi-level-apps.test.ts`, `apps/teacher/src/screens/AttendanceScreen.tsx`, `apps/teacher/src/screens/ClassLogScreen.tsx`, `tests/e2e/85-multi-level-apps.spec.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: `GET /class-logs/lesson` thêm `status_source`, `daily_status`; không đổi dữ liệu, quyền.
- Ảnh hưởng chức năng cũ: tiết đã ghi giữ nguyên; tiết chưa ghi của ngày đã điểm danh đầu ngày đổi trạng thái mặc định; lớp, con các cấp khác Mầm non có thêm điểm danh theo ngày.
- Kiểm thử cần thực hiện: kiểm kiểu máy chủ API, ứng dụng giáo viên, phụ huynh, cổng quản trị; kiểm thử đơn vị, kiểm thử máy chủ API sổ đầu bài, chức năng theo cấp; kiểm thử giao diện 11, 85, 99.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: điểm danh đầu ngày ở mọi cấp; điểm danh theo tiết lấy mặc định từ điểm danh đầu ngày (YCTD-350).
- Không đổi dữ liệu, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Điểm danh đầu ngày ở mọi cấp, điểm danh theo tiết lấy mặc định từ điểm danh đầu ngày | YCTD-350 |
