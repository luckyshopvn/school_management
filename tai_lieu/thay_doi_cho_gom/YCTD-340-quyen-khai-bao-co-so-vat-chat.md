---
yctd: YCTD-340
tieu_de: Khai báo cơ sở vật chất mở được với quyền quản lý thiết bị
ngay: 2026-10-28
phien_ban_de_xuat: 0.220.0
---

## 02 Nhật ký

### 2026-10-28 — Khai báo cơ sở vật chất mở được với quyền quản lý thiết bị

#### Công việc đã thực hiện

- Sửa lỗi mức Cao số 7 của rà soát giao diện ngày 28/10/2026: mục menu 1.1 Khai báo cơ sở vật chất (`/facility-rooms`) hiện cho người có `P13.equipment.manage`, nhưng `GET /facilities/rooms` và `POST /facilities/rooms/export` chỉ nhận `P17.report.facilities` hoặc `P01.room.manage`, nên vai trò chỉ có quyền thiết bị (vai trò trường tự tạo) mở trang thì bị 403.
- Máy chủ API nhận thêm `P13.equipment.manage` cho hai điểm cuối chỉ đọc này; phạm vi đơn vị tính theo cùng bộ quyền. Thêm, sửa phòng vẫn qua danh mục phòng học (`P01.room.manage`).
- Kiểm thử: CT-14d-3 thêm vai trò thử chỉ có quyền thiết bị (xem, lọc sai bị 400, xuất được) và vai trò chỉ có quyền báo cáo EMIS (xem, xuất đều 403).

#### Quyết định

- Mở rộng quyền ở máy chủ thay vì thu hẹp menu: MH-80 và P13-11 đã ghi VT-11 (nhân viên kho, người quản lý thiết bị) được xem, và người quản lý thiết bị cần danh sách phòng để đặt thiết bị. Điểm cuối chỉ đọc, không có dữ liệu cá nhân. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-340, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-340: Khai báo cơ sở vật chất mở được với quyền quản lý thiết bị – 2026-10-28

- Lý do: Rà soát giao diện ngày 28/10/2026 (mức Cao, số 7): menu `/facility-rooms` và quyền của API lệch nhau, người chỉ có quyền thiết bị bị 403.
- Nội dung thay đổi: `GET /facilities/rooms`, `POST /facilities/rooms/export` nhận thêm `P13.equipment.manage`; đặc tả 14 (MH-80), 17 cập nhật; ca kiểm thử theo vai trò.
- Thành phần bị ảnh hưởng: `apps/api/src/facilities/facility-rooms.ts`, `apps/api/src/facilities/facilities.test.ts`; tài liệu `14`, `17`, `21`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: khai báo cơ sở vật chất mở được với quyền quản lý thiết bị, khớp điều kiện hiện mục menu (YCTD-340).
- Thay đổi API: `GET /facilities/rooms`, `POST /facilities/rooms/export` nhận thêm quyền `P13.equipment.manage`.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Khai báo cơ sở vật chất mở được với quyền quản lý thiết bị | YCTD-340 |

## index Số đếm

| Ca kiểm thử khởi đầu | Số lượng | +1 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1600 | P13-11 | Khai báo cơ sở vật chất theo vai trò: vai trò chỉ có `P13.equipment.manage`; vai trò chỉ có `P17.report.emis` | Quyền thiết bị: 200 danh sách, lọc sai 400, xuất 200; quyền EMIS: danh sách và xuất 403 | Kiểm thử tự động `apps/api/src/facilities/facilities.test.ts` CT-14d-3 đạt ngày 28/10/2026 | Đạt |
