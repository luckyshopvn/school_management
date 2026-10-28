---
yctd: YCTD-316
tieu_de: Thẻ Phân công giảng dạy ở trang hồ sơ cán bộ, giáo viên
ngay: 2026-10-28
phien_ban_de_xuat: 0.192.0
---

## 02 Nhật ký

### 2026-10-28 — Thẻ Phân công giảng dạy ở trang hồ sơ cán bộ, giáo viên

#### Công việc đã thực hiện

- Máy chủ API thêm `GET /api/v1/staff/:id/teaching-assignments`: phân công giảng dạy, chủ nhiệm đang hiệu lực của nhân sự ở năm học hiện tại (lớp, khối, cấp, vai trò, môn, số tiết mỗi tuần, từ ngày, đến ngày) kèm tổng số tiết. Số tiết trống ở phân công thì lấy số tiết của chương trình theo khối. Phân công gắn với tài khoản nên hồ sơ chưa liên kết tài khoản trả danh sách trống kèm `has_account: false`.
- Quyền xem giống hồ sơ nhân sự: người có `P07.staff.view` trong phạm vi đơn vị của nhân sự hoặc chính nhân sự đó; người khác nhận 403.
- Trang `/staff/$staffId` thêm thẻ Phân công giảng dạy (`?tab=teaching`): bảng Lớp, Vai trò (Chủ nhiệm, Bộ môn), Môn, Số tiết/tuần, Từ ngày và dòng tổng số tiết mỗi tuần. Hồ sơ chưa liên kết tài khoản thì thẻ nhắc liên kết ở thẻ Thông tin chung. Liên kết, bỏ liên kết tài khoản làm mới danh sách.
- Kiểm thử máy chủ API: phân công đang hiệu lực, tổng số tiết, bỏ phân công đã kết thúc, chính giáo viên xem được, hồ sơ chưa liên kết trả trống, giáo viên khác bị từ chối.

#### Quyết định

- Thẻ chỉ hiện khi nhân sự có phân công đang hiệu lực hoặc hồ sơ chưa liên kết tài khoản; nhân sự đã liên kết mà không dạy lớp nào (kế toán, nhân viên) thì ẩn thẻ. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Xong việc "Chưa làm" ghi ở YCTD-309.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-316, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-316: Thẻ Phân công giảng dạy ở trang hồ sơ cán bộ, giáo viên – 2026-10-28

- Lý do: Eric yêu cầu làm nốt phần còn thiếu của trang hồ sơ cán bộ, giáo viên chia thẻ (YCTD-309).
- Nội dung thay đổi: API phân công giảng dạy theo một nhân sự; thẻ Phân công giảng dạy ở trang hồ sơ.
- Thành phần bị ảnh hưởng: `apps/api/src/staff/staff.service.ts`, `apps/api/src/staff/staff.controller.ts`, `apps/api/src/staff/staff.test.ts`, `apps/portal/src/staff/StaffDetailPage.tsx`, `apps/portal/src/staff/staff-api.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: thêm API chỉ đọc `GET /api/v1/staff/:id/teaching-assignments`, dùng quyền `P07.staff.view` có sẵn; không đổi dữ liệu.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: kiểm kiểu máy chủ API và cổng quản trị; kiểm thử máy chủ API `staff.test.ts`; kiểm thử giao diện 19, 55, 60.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: thẻ Phân công giảng dạy ở trang hồ sơ cán bộ, giáo viên; API `GET /api/v1/staff/:id/teaching-assignments` (YCTD-316).
- Không đổi dữ liệu, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Thẻ Phân công giảng dạy ở trang hồ sơ cán bộ, giáo viên | YCTD-316 |
