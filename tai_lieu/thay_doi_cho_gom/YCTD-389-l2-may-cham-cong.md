---
yctd: YCTD-389
tieu_de: Điểm danh bằng thiết bị, lát L2: khai báo thiết bị, khóa thiết bị, điểm nhận lượt, nhập tệp máy chấm công, chấm công cán bộ
ngay: 2026-10-30
phien_ban_de_xuat: 0.251.0
---

## 02 Nhật ký

### 2026-10-30 — Điểm danh bằng thiết bị, lát L2: thiết bị, điểm nhận lượt, nhập tệp máy chấm công, chấm công cán bộ (YCTD-389)

#### Công việc đã thực hiện

- Thêm bảng hệ thống `attendance_devices` (`0141_create_attendance_devices`), cột `gate_passes.device_id` và nguồn `device` cho `attendance_logs` (năm học `0245_add_gate_pass_device`), quyền `P04.gate-device.manage` (định danh `0197_add_gate_device_permission`).
- API (`apps/api/src/gate-passes/attendance-devices.*`, `punch-file.ts`):
  - khai báo, đổi khóa, tắt hoặc bật thiết bị; khóa chỉ hiện một lần, máy chủ lưu mã băm;
  - điểm nhận công khai `POST /api/v1/device-events` (khóa ở tiêu đề `x-device-key`);
  - nhập tệp CSV hoặc xlsx xuất từ máy chấm công;
  - lượt của học sinh đi qua cùng hàm ghi lượt với quét thẻ (tách `recordChildPass` từ lát L1, gộp lượt cùng hướng trong 5 phút trước hoặc sau);
  - lượt của cán bộ ghi chấm công (`recordDevicePunch`): sớm nhất là giờ vào, muộn nhất là giờ ra, giữ ngày nhập tay, từ chối tháng đã chốt.
- Cổng quản trị: nút "Thiết bị điểm danh" trên trang Điểm danh mở ngăn khai báo thiết bị, đổi khóa, tắt, nhập tệp (MH-641, ngăn Thiết bị).
- Bộ giả lập `scripts/gia-lap-may-cham-cong.mjs` gửi lượt như thiết bị thật.
- Kiểm thử tự động: `apps/api/src/gate-passes/punch-file.test.ts` (hàm thuần), `apps/api/src/gate-passes/attendance-devices.test.ts` (khai báo, quyền, khóa, điểm nhận, cán bộ, nhập tệp, đổi khóa, tắt).
- Cập nhật `16_CO_SO_DU_LIEU.md` mục 18U, `17_DAC_TA_API.md` mục 17.16; BM-232 (tệp mảnh lát L0) sửa theo cách xác thực thực tế.

#### Quyết định

- Eric ngày 2026-10-30 duyệt danh sách lát; phiên điều phối giao lát L2 cùng ngày: thiết bị thật chỉ dùng bộ giả lập.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - thiết bị ở cơ sở dữ liệu hệ thống để không phải khai lại mỗi năm học;
  - xác thực bằng khóa bí mật gửi ở tiêu đề qua HTTPS, máy chủ chỉ lưu mã băm, thay cho chữ ký HMAC ghi ở BM-232 bản đầu (HMAC buộc máy chủ giữ được khóa gốc);
  - mã người trên thiết bị là mã thẻ QR của học sinh hoặc mã cán bộ, không thêm bảng ánh xạ;
  - thiết bị ở trường chính nhận người của mọi đơn vị, thiết bị ở đơn vị cấp 2 chỉ nhận người của đơn vị đó;
  - nhận lượt gửi bù trong 7 ngày; lượt cũ quá 30 phút không báo phụ huynh.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-389, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md` mục 18U, `17_DAC_TA_API.md` mục 17.16, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Chưa nối thiết bị thật (giao thức đẩy của từng hãng); khi nối, bộ chuyển đổi gửi đúng định dạng `device-events`.
- Lát L3 (đồng ý dùng khuôn mặt) chưa làm; máy chấm công khuôn mặt dùng cho học sinh cần đồng ý của cha mẹ trước khi trường đăng ký khuôn mặt trên máy.

## 24 Yêu cầu thay đổi

### YCTD-389: Điểm danh bằng thiết bị, lát L2: thiết bị, điểm nhận lượt, nhập tệp máy chấm công, chấm công cán bộ – 2026-10-30

- Lý do: lát L2 của YCTD-389 theo danh sách lát Eric duyệt ngày 2026-10-30 (phương án C: máy chấm công có sẵn của trường).
- Nội dung thay đổi: khai báo thiết bị, cấp và đổi khóa; điểm nhận công khai cho thiết bị; nhập tệp xuất từ máy chấm công; lượt của học sinh đi qua lượt qua cổng của lát L1; lượt của cán bộ thành chấm công nguồn thiết bị; bộ giả lập.
- Thành phần bị ảnh hưởng: `apps/api/src/gate-passes/` (thêm `attendance-devices.*`, `punch-file.ts`; `gate-passes.service.ts` tách hàm ghi lượt), `apps/api/src/staff-attendance/staff-attendance.service.ts`, `apps/api/src/tenancy-route-policy.ts`, `apps/api/src/application.module.ts`, `apps/portal/src/attendance/`, `packages/shared/src/index.ts`, `database/school-year/schema.ts` (kiểu `source`), `scripts/gia-lap-may-cham-cong.mjs`; database migration hệ thống `0141`, năm học `0245`, định danh `0197`; tài liệu `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `27`.
- Dữ liệu, API, quyền bị ảnh hưởng: một bảng mới ở cơ sở dữ liệu hệ thống; một cột mới ở `gate_passes`; ràng buộc `attendance_logs.source` thêm `device`; sáu điểm cuối mới (một công khai); một quyền mới.
- Ảnh hưởng chức năng cũ: chấm công tự bấm và nhập tay giữ nguyên, ngày đã nhập tay không bị thiết bị ghi đè; gộp lượt quét thẻ của lát L1 nay so với lượt cùng hướng trong 5 phút trước hoặc sau.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/gate-passes/*.test.ts`, `apps/api/src/staff-attendance/staff-attendance.test.ts`, kiểm thử ma trận cách ly (`tenancy-matrix.test.ts`); database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn (thuộc YCTD-389). Người phê duyệt: Eric, ngày 2026-10-30 (phương án, bản mẫu MH-640 đến MH-643, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: thiết bị điểm danh, điểm nhận lượt từ thiết bị, nhập tệp máy chấm công, chấm công cán bộ nguồn thiết bị (YCTD-389 lát L2).
- Database migration: hệ thống `0141_create_attendance_devices`, năm học `0245_add_gate_pass_device`, định danh `0197_add_gate_device_permission`. Quay lui: chạy `down` của ba tệp (xóa bảng thiết bị, cột `device_id`, quyền; xóa chấm công nguồn `device` rồi trả ràng buộc cũ).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Điểm danh bằng thiết bị, lát L2: máy chấm công | YCTD-389 |

## index Số đếm

| 10 | mã chức năng | +2 |
| Chức năng đã liệt kê | Số lượng | +2 |
| 14 | màn hình | +1 |
| Màn hình dự kiến | Số lượng | +1 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P04 Điểm danh và chăm sóc hằng ngày | YCTD-389 lát L2 (thiết bị điểm danh, máy chấm công, nhập tệp) |
| 03_DANH_SACH_CONG_VIEC.md | P08 Chấm công và tiền lương | YCTD-389 lát L2 (chấm công cán bộ từ máy chấm công) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-520 | Thiết bị điểm danh (YCTD-389 lát L2): mỗi thiết bị một khóa bí mật, chỉ hiện một lần khi khai báo hoặc đổi, máy chủ lưu mã băm; thiết bị đã tắt, khóa cũ bị từ chối; thiết bị ở trường chính nhận người của mọi đơn vị, ở đơn vị cấp 2 chỉ nhận người của đơn vị đó; mã người là mã thẻ QR của học sinh hoặc mã cán bộ |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-521 | Lượt từ thiết bị (YCTD-389 lát L2): nhận lượt trong 7 ngày gần nhất, lệch đồng hồ tối đa 5 phút về sau; mã sự kiện của thiết bị chống ghi trùng khi gửi lại; thiết bị hai chiều phải gửi hướng cho lượt của học sinh; lượt của học sinh theo BR-485, chỉ báo phụ huynh khi lượt không cũ quá 30 phút; nhập lại cùng tệp không ghi trùng |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-522 | Chấm công cán bộ từ thiết bị (YCTD-389 lát L2): lượt sớm nhất trong ngày là giờ vào, lượt muộn nhất là giờ ra, nguồn `device`; ngày phòng nhân sự đã nhập tay giữ nguyên; tháng đã chốt bảng công thì từ chối; nhân sự chưa vào làm hoặc đã nghỉ thì từ chối |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-191 | PQ-195 | Thiết bị điểm danh (YCTD-389 lát L2): `P04.gate-device.manage` (VT-02, VT-15, VT-03) khai báo, đổi khóa, tắt thiết bị, nhập tệp máy chấm công trong đơn vị được gán; điểm nhận `device-events` không dùng mã phiên, xác thực bằng khóa thiết bị |
| 10_YEU_CAU_CHUC_NANG.md | P04-07 | P04-12 | Thiết bị điểm danh, điểm nhận lượt, nhập tệp máy chấm công (YCTD-389 lát L2) | VT-02, VT-15, VT-03 (`P04.gate-device.manage`); thiết bị (khóa riêng) | Thiết bị, khóa, lượt (mã người, hướng, thời điểm), tệp CSV hoặc xlsx | Khai báo, đổi khóa, tắt; xác thực khóa; ghi lượt của học sinh và chấm công của cán bộ; báo kết quả từng lượt, từng dòng | Ngăn Thiết bị điểm danh (MH-641); kết quả nhập tệp; bộ giả lập | BR-520, BR-521 |
| 10_YEU_CAU_CHUC_NANG.md | P08-12 | P08-13 | Chấm công cán bộ từ máy chấm công (YCTD-389 lát L2) | Thiết bị; VT-02, VT-15, VT-03 khi nhập tệp | Mã cán bộ, thời điểm | Giờ vào sớm nhất, giờ ra muộn nhất trong ngày, nguồn thiết bị; giữ ngày nhập tay | Dòng chấm công nguồn `device` trên bảng chấm công | BR-522 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1340 | Cho quản lý đơn vị / Khi khai báo thiết bị / Thì nhận khóa một lần, danh sách thiết bị không bao giờ trả khóa hay mã băm; bảo vệ, quản lý đơn vị khác không khai báo, không thấy được (CT-1990, CT-1991; YCTD-389 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1341 | Cho lượt gửi không có khóa, sai khóa, khóa cũ sau khi đổi, thiết bị đã tắt / Khi gửi / Thì bị từ chối 401, không ghi gì (CT-1992, CT-1999; YCTD-389 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1342 | Cho máy chấm công gửi lượt vào của học sinh / Khi máy chủ nhận / Thì lượt được ghi phương thức máy chấm công kèm mã thiết bị; gửi lại cùng mã sự kiện là trùng, không ghi thêm (CT-1993; YCTD-389 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1343 | Cho lượt thiếu hướng ở thiết bị hai chiều, học sinh đơn vị khác, mã không có, lượt cũ quá 7 ngày / Khi gửi cùng một lần / Thì từng lượt có kết quả riêng, không lượt nào được ghi (CT-1994; YCTD-389 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1344 | Cho cán bộ chấm công hai lượt trong ngày / Khi thiết bị gửi / Thì giờ vào là lượt sớm, giờ ra là lượt muộn, nguồn thiết bị; ngày phòng nhân sự đã nhập tay giữ nguyên (CT-1995, CT-1996; YCTD-389 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1345 | Cho tệp xuất từ máy chấm công có dòng đúng và dòng sai / Khi quản lý nhập / Thì dòng đúng được ghi, dòng sai báo số dòng và lý do; nhập lại cùng tệp không ghi trùng (CT-1997, CT-1998; YCTD-389 lát L2) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-641 | Thiết bị điểm danh (YCTD-389 lát L2): nút "Thiết bị điểm danh" trên trang Điểm danh khi có `P04.gate-device.manage`; danh sách thiết bị (loại, hướng, vị trí, bốn ký tự cuối của khóa, "Gửi lần cuối" hoặc "Chưa gửi lần nào", "Đã tắt"); Đổi khóa, Tắt có hộp xác nhận, Bật lại; Nhập tệp máy chấm công kèm kết quả và lỗi theo dòng; biểu mẫu khai báo; khóa mới hiện một lần kèm nút Sao chép. Ngăn ngưỡng, vùng cảnh báo của bản mẫu làm ở lát L4, L5 | VT-02, VT-15, VT-03 |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1990 | P04-12 | Bảo vệ xem, khai báo thiết bị; quản lý đơn vị A khai báo máy chấm công hai chiều; xem danh sách | 403; 201 có `key` bắt đầu `tbd_`; danh sách không có `key`, `key_hash`, có `key_hint` đúng | Kiểm thử tự động `apps/api/src/gate-passes/attendance-devices.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1991 | P04-12 | Quản lý đơn vị B khai báo ở đơn vị A, xem danh sách; khai báo loại, hướng sai | 403, không thấy thiết bị của A; 400 | Kiểm thử tự động `attendance-devices.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1992 | P04-12 | Gửi lượt không có khóa, khóa sai, không có lượt nào | 401, 401, 400 | Kiểm thử tự động `attendance-devices.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1993 | P04-12 | Thiết bị gửi lượt vào của T1 bằng mã thẻ, gửi lại cùng mã sự kiện | `recorded`, lượt `method = device`, có `device_id`, không có `recorded_by`; lần hai `duplicate` | Kiểm thử tự động `attendance-devices.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1994 | P04-12 | Một lần gửi bốn lượt: T2 không hướng, T3 đơn vị khác, mã lạ, T2 cũ 10 ngày | `rejected`, `rejected`, `unknown_code`, `rejected` | Kiểm thử tự động `attendance-devices.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1995 | P08-13 | Cán bộ NS-TB-1 hai lượt cách nhau 3 phút | Hai `recorded`; giờ vào là lượt sớm theo giờ Việt Nam, giờ ra lớn hơn, nguồn `device` | Kiểm thử tự động `attendance-devices.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1996 | P08-13 | Cán bộ NS-TB-2 đã có chấm công nhập tay, thiết bị gửi lượt | `manual_kept`, dòng chấm công không đổi | Kiểm thử tự động `attendance-devices.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1997 | P04-12, P08-13 | Nhập CSV chấm phẩy: một dòng cán bộ, một dòng học sinh, một dòng thời điểm sai; nhập lại | Lần một ghi 2, từ chối 1 kèm dòng 4; lần hai ghi 0, trùng 1 | Kiểm thử tự động `attendance-devices.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1998 | P04-12 | Hàm thuần đọc tệp: giờ Việt Nam hai dạng, ngày 31/02, giờ 24:00; hướng có dấu, không dấu, tiếng Anh; CSV chấm phẩy có BOM, ô trong ngoặc kép; thiếu cột; xlsx có ô ngày giờ; tệp txt | Đúng từng trường hợp | Kiểm thử tự động `apps/api/src/gate-passes/punch-file.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1999 | P04-12 | Đổi khóa rồi gửi bằng khóa cũ, khóa mới; quản lý đơn vị B tắt; quản lý đơn vị A tắt rồi gửi | 401, 200; 403; 200 rồi 401 | Kiểm thử tự động `attendance-devices.test.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-389 lát L2 | Điểm danh bằng thiết bị, lát L2: thiết bị, điểm nhận lượt, nhập tệp máy chấm công, chấm công cán bộ | {PHIEN_BAN} | P04-12, P08-13 | AC-1340 đến AC-1345 | CT-1990 đến CT-1999 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/gate-passes/attendance-devices.service.ts`, `apps/portal/src/attendance/AttendanceDevicesPanel.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 30/10/2026; CI của PR |
