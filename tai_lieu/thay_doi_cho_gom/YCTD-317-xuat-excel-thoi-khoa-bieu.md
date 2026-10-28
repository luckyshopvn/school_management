---
yctd: YCTD-317
tieu_de: Xuất Excel thời khoá biểu theo lớp, giáo viên, phòng
ngay: 2026-10-28
phien_ban_de_xuat: 0.193.0
---

## 02 Nhật ký

### 2026-10-28 — Xuất Excel thời khoá biểu theo lớp, giáo viên, phòng

#### Công việc đã thực hiện

- Máy chủ API thêm `GET /api/v1/timetable-versions/:id/export`, cùng bộ lọc `class_id`, `teacher_user_id`, `room_id` với màn hình xem. Tệp `thoi-khoa-bieu.xlsx` có mỗi lớp, giáo viên hoặc phòng một trang tính. Mỗi trang có hai dòng tiêu đề (đối tượng; tên bản, ngày áp dụng), dòng là tiết kèm giờ theo khung giờ của cấp, cột là Thứ Hai đến Thứ Bảy (thêm Chủ nhật khi có tiết). Ô ghi môn kèm giáo viên, phòng (xem theo lớp), lớp, phòng (theo giáo viên) hoặc lớp, giáo viên (theo phòng); tiết học theo nhóm ghi "(nhóm N)". Không lọc thì mọi lớp.
- Quyền như xem thời khoá biểu (nhân sự xem được lớp); phụ huynh nhận 403.
- Màn hình 7.4. Thời khoá biểu thêm nút "Xuất Excel" cạnh ô chọn lớp, giáo viên, phòng; chưa chọn thì nút là "Xuất Excel mọi lớp".
- Dựng trang tính tách ở `apps/api/src/timetables/timetable-export.ts`, có kiểm thử đơn vị; kiểm thử máy chủ API cho đường dẫn xuất.

#### Quyết định

- Dùng bộ dựng tệp bảng dùng chung (`exports/table-file.ts`) và nhãn thứ dùng chung `TIMETABLE_WEEKDAY_LABELS` để tệp khớp màn hình. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-317, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-317: Xuất Excel thời khoá biểu theo lớp, giáo viên, phòng – 2026-10-28

- Lý do: mẫu giao diện đã duyệt của màn hình Thời khoá biểu có nút "Xuất Excel" nhưng mã chưa có chức năng này (để lại ở YCTD-296); Eric yêu cầu làm nốt.
- Nội dung thay đổi: API xuất Excel bản thời khoá biểu theo bộ lọc; nút "Xuất Excel" ở màn hình 7.4.
- Thành phần bị ảnh hưởng: `apps/api/src/timetables/timetables.ts`, `apps/api/src/timetables/timetable-export.ts`, `apps/api/src/timetables/timetable-export.test.ts`, `apps/api/src/timetables/timetables.test.ts`, `apps/portal/src/timetables/TimetablesPage.tsx`, `apps/portal/src/timetables/timetables-api.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: thêm API chỉ đọc; không đổi dữ liệu, quyền.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: kiểm kiểu máy chủ API, cổng quản trị; kiểm thử đơn vị `timetable-export.test.ts`, kiểm thử máy chủ API `timetables.test.ts`; kiểm thử giao diện thời khoá biểu.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: xuất Excel thời khoá biểu theo lớp, giáo viên, phòng (YCTD-317).
- Không đổi dữ liệu, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Xuất Excel thời khoá biểu theo lớp, giáo viên, phòng | YCTD-317 |
