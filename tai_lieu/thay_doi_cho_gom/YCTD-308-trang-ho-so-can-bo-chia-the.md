---
yctd: YCTD-308
tieu_de: Hồ sơ cán bộ, giáo viên mở ở trang riêng chia thẻ
ngay: 2026-10-28
phien_ban_de_xuat: 0.185.0
---

## 02 Nhật ký

### 2026-10-28 — Hồ sơ cán bộ, giáo viên mở ở trang riêng chia thẻ

#### Công việc đã thực hiện

- Thêm trang `/staff/$staffId` (`apps/portal/src/staff/StaffDetailPage.tsx`, đổi tên từ `StaffDetailPanel.tsx`). Đầu trang có nút quay lại danh sách, họ tên, trạng thái, dòng chức danh · phòng ban · đơn vị và mã nhân sự.
- Các thẻ: Thông tin chung (thông tin riêng của trường, tài khoản liên kết), Hồ sơ CSDL Bộ (hồ sơ cán bộ, giáo viên theo Sở, thông tin theo CSDL ngành), Hợp đồng (hợp đồng lao động, lương thỏa thuận), Lương và phụ cấp (khoản lương riêng, người phụ thuộc), Quá trình công tác (mốc công tác, chứng chỉ).
- Thẻ đang mở lưu ở `?tab=` (`moet`, `contracts`, `pay`, `history`; thẻ Thông tin chung không ghi), tải lại hay chia sẻ đường dẫn vẫn mở đúng thẻ. Thẻ ngang cuộn được trên màn hình hẹp, phím mũi tên chuyển thẻ.
- Danh sách 3.1.1 bỏ khung hồ sơ dưới dòng, lưới dùng toàn chiều rộng. Bấm dòng, nút "Thay đổi" hay liên kết "Hồ sơ" mở trang hồ sơ; tạo hồ sơ mới xong thì mở trang hồ sơ vừa tạo. Quyền, thao tác ghi, xóa, xuất giữ nguyên.
- 5.9 Thống kê hồ sơ nhân sự chưa nhập đủ: bấm tên mở trang hồ sơ ở thẻ Hồ sơ CSDL Bộ thay cho khung bên dưới lưới.
- Sửa kiểm thử giao diện 19, 55, 60 theo trang mới; thêm bước kiểm tra địa chỉ có `?tab=`, tải lại trang vẫn ở thẻ Hợp đồng, người không xem được hợp đồng không thấy thẻ Hợp đồng.

#### Quyết định

- Thẻ Hợp đồng chỉ hiện khi máy chủ trả danh sách hợp đồng (BR-46); thẻ Lương và phụ cấp, Quá trình công tác ẩn khi máy chủ từ chối quyền xem (dùng cùng truy vấn với phần bên trong).
- Chưa có thẻ Phân công giảng dạy: máy chủ chưa có API phân công theo một nhân sự (chỉ có theo lớp và tổng số tiết theo giáo viên).
- Thẻ đang mở chỉ dựng nội dung của thẻ đó, các thẻ khác tải khi mở.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-308, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chưa làm: thẻ Phân công giảng dạy (lớp, môn, số tiết của một giáo viên) ở trang hồ sơ cán bộ, giáo viên. Làm khi máy chủ có API trả phân công giảng dạy theo một nhân sự; hiện chỉ có phân công theo lớp (`/api/v1/teaching-assignments?class_id=`) và tổng số tiết theo giáo viên (`/api/v1/teaching-assignments/teachers`).

## 24 Yêu cầu thay đổi

### YCTD-308: Hồ sơ cán bộ, giáo viên mở ở trang riêng chia thẻ – 2026-10-28

- Lý do: Eric yêu cầu "thiết lập lại màn hình chi tiết của giáo viên, mở sang một trang mới, sử dụng dạng thẻ để bớt rối"; khung hồ sơ dưới dòng của lưới dồn nhiều phần vào một chỗ.
- Nội dung thay đổi: trang `/staff/$staffId` có đầu trang và năm thẻ, thẻ đang mở ở `?tab=`, ẩn thẻ không có quyền xem; danh sách cán bộ dùng toàn chiều rộng, bấm dòng mở trang hồ sơ.
- Thành phần bị ảnh hưởng: `apps/portal/src/staff/StaffDetailPage.tsx` (thay `StaffDetailPanel.tsx`), `apps/portal/src/staff/StaffPage.tsx`, `apps/portal/src/statistics/MissingProfilesPage.tsx`, `apps/portal/src/router.tsx`, `tests/e2e/19-staff.spec.ts`, `tests/e2e/55-staff-so.spec.ts`, `tests/e2e/60-staff-full-so.spec.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: hồ sơ không còn mở dưới dòng của lưới; các thao tác ghi hồ sơ, liên kết tài khoản, lập và chấm dứt hợp đồng, khoản lương, quá trình công tác giữ nguyên.
- Kiểm thử cần thực hiện: kiểm kiểu cổng quản trị; kiểm thử giao diện 19, 55, 60, 49; kiểm thử theo khổ thiết bị.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: hồ sơ cán bộ, giáo viên mở ở trang riêng `/staff/$staffId` chia thẻ, thẻ đang mở ở địa chỉ (YCTD-308).
- Không đổi dữ liệu, API, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Hồ sơ cán bộ, giáo viên mở ở trang riêng chia thẻ | YCTD-308 |
