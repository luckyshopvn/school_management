---
yctd: YCTD-389
tieu_de: Điểm danh bằng thẻ, máy chấm công, camera, lát L1: thẻ QR, lượt qua cổng, gợi ý điểm danh, thông báo đến và về
ngay: 2026-10-30
phien_ban_de_xuat: 0.250.0
---

## 02 Nhật ký

### 2026-10-30 — Điểm danh bằng thẻ, lát L1: thẻ QR, lượt qua cổng, gợi ý điểm danh, thông báo đến và về (YCTD-389)

#### Công việc đã thực hiện

- Thêm bảng năm học `gate_cards`, `gate_passes` (tệp `0240_create_gate_passes`), quyền `P04.gate-pass.record`, `P04.gate-card.manage` (định danh `0195_add_gate_pass_permissions`).
- Thêm phân hệ `apps/api/src/gate-passes/`: cấp, cấp lại thẻ QR; quét thẻ ghi lượt vào, ra (gộp lượt quét lại trong 5 phút); tự ghi "Đi muộn" khi lượt vào bằng thẻ sau giờ bắt đầu học; báo phụ huynh `gate_arrived`, `gate_left`; báo nhận nhầm kèm đính chính `gate_pass_corrected`; lượt của một học sinh; bảng điểm danh thêm `gate` mỗi dòng. Nhóm đẩy mới "Con đến và về trường".
- Giao diện: cổng quản trị (trang Điểm danh có cột "Cổng trường", nút "Điền theo cổng trường", "Báo nhận nhầm", ngăn "Thẻ QR của lớp" để cấp, cấp lại, in thẻ); ứng dụng giáo viên (màn hình "Quét thẻ vào, ra cổng", nhãn giờ vào cổng ở bảng điểm danh); ứng dụng phụ huynh (mục "Đến và về trường" 7 ngày). Thành phần `QrScanner` thêm chữ gợi ý của ô nhập tay.
- Kiểm thử tự động: `apps/api/src/gate-passes/gate-pass-rules.test.ts` (hàm thuần theo giờ Việt Nam, giá trị biên), `apps/api/src/gate-passes/gate-passes.test.ts` (cấp thẻ, quét, quyền, nhận nhầm, phụ huynh), `push.test.ts` (nhóm đẩy).
- Cập nhật `16_CO_SO_DU_LIEU.md` mục 18T, `17_DAC_TA_API.md` mục 17.15.

#### Quyết định

- Eric ngày 2026-10-30 cho bắt đầu lát L1 sau khi duyệt bản mẫu và danh sách lát; tự ghi "Đi muộn" chỉ từ thẻ QR, thẻ RFID, máy chấm công (đã duyệt cùng ngày).
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - "Đi muộn" tự ghi vào điểm danh ngày (`attendance_records`, `source = system`, người ghi là người quét), không ghi đè điểm danh đã có; điểm danh theo tiết chưa tự ghi;
  - bảo vệ quét bằng ứng dụng giáo viên như màn hình xác nhận người đón; chưa có máy quét riêng (lát L2);
  - tùy chọn tắt thông báo đến và về dùng nhóm đẩy "Con đến và về trường" có sẵn ở cài đặt thông báo đẩy, chưa có công tắc riêng cho vào và ra;
  - thẻ in bằng cửa sổ in của trình duyệt (khổ danh thiếp, hai cột), mã in thành bốn nhóm bốn ký tự để gõ tay khi thẻ mờ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-389, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md` mục 18T, `17_DAC_TA_API.md` mục 17.15, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Lát L2 (máy chấm công, khóa thiết bị, nhập tệp, chấm công cán bộ) chưa làm.
- Công tắc riêng "báo khi vào", "báo khi ra" trên ứng dụng phụ huynh như bản mẫu MH-643 chưa làm; hiện tắt chung bằng nhóm đẩy.
- Báo nhận nhầm mới có ở cổng quản trị; ứng dụng giáo viên chỉ hiện giờ vào cổng.

## 24 Yêu cầu thay đổi

### YCTD-389: Điểm danh bằng thẻ, lát L1: thẻ QR, lượt qua cổng, gợi ý điểm danh, thông báo đến và về – 2026-10-30

- Lý do: lát L1 của YCTD-389 theo danh sách lát Eric duyệt ngày 2026-10-30.
- Nội dung thay đổi: cấp, cấp lại, in thẻ QR; bảo vệ quét thẻ vào, ra ở ứng dụng giáo viên; gộp lượt quét lại trong 5 phút; tự ghi "Đi muộn" từ thẻ; bảng điểm danh có gợi ý từ cổng, điền theo cổng, báo nhận nhầm; phụ huynh nhận thông báo đến và về, xem lượt 7 ngày, nhận đính chính.
- Thành phần bị ảnh hưởng: `apps/api/src/gate-passes/`, `apps/api/src/attendance/attendance.service.ts` (thêm `gate` vào bảng điểm danh), `apps/api/src/notifications/push/push-groups.ts`, `apps/portal/src/attendance/`, `apps/teacher/src/screens/GateScanScreen.tsx`, `AttendanceScreen.tsx`, `ClassesScreen.tsx`, `Application.tsx`, `apps/parent/src/screens/GatePassesPanel.tsx`, `HomeScreen.tsx`, `packages/ui/src/QrScanner.tsx`, `packages/shared/src/index.ts`; database migration năm học `0240_create_gate_passes`, định danh `0195_add_gate_pass_permissions`; tài liệu `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `27`.
- Dữ liệu, API, quyền bị ảnh hưởng: hai bảng mới ở cơ sở dữ liệu năm học; sáu điểm cuối mới, bảng điểm danh thêm trường `gate`; hai quyền mới; điểm danh ngày có thêm dòng nguồn `system` (giá trị đã có).
- Ảnh hưởng chức năng cũ: điểm danh tay, chốt ngày, báo vắng, đưa đón giữ nguyên; trường không quét thẻ thì bảng điểm danh không đổi (cột "Cổng trường" ghi "Chưa thấy qua cổng").
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/gate-passes/*.test.ts`, `apps/api/src/attendance/attendance.test.ts`, `apps/api/src/notifications/push/push.test.ts`, `apps/api/src/pickups/pickups.test.ts`; database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn (thuộc YCTD-389). Người phê duyệt: Eric, ngày 2026-10-30 (phương án, bản mẫu MH-640 đến MH-643, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: điểm danh bằng thẻ QR ở cổng, lát L1: cấp và in thẻ, quét thẻ vào, ra, gợi ý điểm danh, tự ghi đi muộn, thông báo đến và về, báo nhận nhầm (YCTD-389).
- Database migration: năm học `0240_create_gate_passes`, định danh `0195_add_gate_pass_permissions`. Quay lui: chạy `down` của hai tệp (xóa hai bảng mới và hai quyền); bản ghi điểm danh "Đi muộn" đã tự ghi giữ nguyên.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Điểm danh bằng thẻ QR ở cổng, lát L1 | YCTD-389 |

## index Số đếm

| 10 | mã chức năng | +4 |
| Chức năng đã liệt kê | Số lượng | +4 |
| 14 | màn hình | +3 |
| Màn hình dự kiến | Số lượng | +3 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P04 Điểm danh và chăm sóc hằng ngày | YCTD-389 lát L1 (thẻ QR, lượt qua cổng, gợi ý điểm danh, thông báo đến và về) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-484 | Thẻ QR điểm danh (YCTD-389 lát L1): mã 16 ký tự base32 ngẫu nhiên, không chứa thông tin cá nhân; mỗi học sinh tối đa một thẻ còn hiệu lực; cấp lại thì thẻ cũ bị thu hồi, quét thẻ đã thu hồi bị từ chối; chỉ người có `P04.gate-card.manage` ở đơn vị của lớp cấp, xem mã |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-485 | Lượt qua cổng (YCTD-389 lát L1): hai lượt cùng hướng trong 5 phút là một lượt; lượt chỉ là gợi ý cho giáo viên, học sinh không có lượt thì để trống, không gợi ý vắng; tự ghi "Đi muộn" chỉ khi lượt vào bằng thẻ QR, thẻ RFID hoặc máy chấm công, sau giờ bắt đầu học, trong ngày học, học sinh chưa có điểm danh ngày, ngày của lớp chưa chốt, không ghi đè; không bao giờ tự ghi vắng; báo nhận nhầm hủy lượt, không xóa |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-486 | Thông báo đến và về (YCTD-389 lát L1): lượt vào, ra gửi phụ huynh trong ứng dụng và đẩy theo nhóm "Con đến và về trường" (tắt được), không gửi tin nhắn SMS; lượt gộp không báo lần hai; báo nhận nhầm một lượt đã báo thì gửi đính chính; "ra khỏi cổng" không có nghĩa con đã về đến nhà |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-191 | PQ-193 | Điểm danh bằng thẻ ở cổng (YCTD-389 lát L1): `P04.gate-pass.record` (VT-18, VT-03, VT-02, VT-15) quét thẻ ghi lượt của học sinh trong đơn vị được gán, xem lượt hôm nay của đơn vị; `P04.gate-card.manage` (VT-02, VT-15, VT-03) cấp, cấp lại, in thẻ; báo nhận nhầm cần là giáo viên chủ nhiệm đang được phân công lớp hoặc có `P04.attendance.manage` ở đơn vị; phụ huynh xem lượt của con mình theo phạm vi xem hồ sơ trẻ |
| 10_YEU_CAU_CHUC_NANG.md | P04-07 | P04-08 | Quét thẻ vào, ra cổng (YCTD-389 lát L1) | VT-18, VT-03, VT-02, VT-15 (`P04.gate-pass.record`) | Mã thẻ (quét hoặc gõ tay), hướng vào hoặc ra | Ghi lượt, gộp lượt quét lại trong 5 phút, tự ghi "Đi muộn", báo phụ huynh | Lượt qua cổng; màn hình Quét thẻ vào, ra cổng (MH-644) | BR-485, BR-486 |
| 10_YEU_CAU_CHUC_NANG.md | P04-07 | P04-09 | Cấp, cấp lại, in thẻ QR điểm danh (YCTD-389 lát L1) | VT-02, VT-15, VT-03 (`P04.gate-card.manage`) | Lớp, học sinh cần cấp lại | Cấp mã ngẫu nhiên cho học sinh chưa có, thu hồi thẻ cũ khi cấp lại | Thẻ in khổ danh thiếp có tên, lớp, mã QR, mã chữ (MH-640) | BR-484 |
| 10_YEU_CAU_CHUC_NANG.md | P04-07 | P04-10 | Gợi ý điểm danh từ lượt qua cổng, báo nhận nhầm (YCTD-389 lát L1) | VT-07 chủ nhiệm, VT-03 (`P04.attendance.manage`) | Lớp, ngày | Hiện giờ vào, ra và gợi ý từng học sinh; điền theo cổng cho dòng chưa đánh dấu; báo nhận nhầm | Cột "Cổng trường" ở trang Điểm danh (MH-640), nhãn giờ vào cổng ở bảng điểm danh của ứng dụng giáo viên (MG-02) | BR-485 |
| 10_YEU_CAU_CHUC_NANG.md | P04-07 | P04-11 | Con đến và về trường (YCTD-389 lát L1) | VT-14 | Con | Lượt vào, ra của con trong 7 ngày, thông báo khi có lượt, đính chính khi nhận nhầm | Mục "Đến và về trường" ở ứng dụng phụ huynh (MH-643) | BR-486 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1258 | Cho học sinh trong lớp chưa có thẻ / Khi quản lý đơn vị cấp thẻ / Thì mỗi em có một mã 16 ký tự ngẫu nhiên, cấp lần nữa không cấp trùng; cấp lại cho một em thì thẻ cũ không quét được; bảo vệ và quản lý đơn vị khác không cấp được (CT-1891, CT-1892; YCTD-389 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1259 | Cho bảo vệ của đơn vị / Khi quét thẻ vào / Thì lượt được ghi, phụ huynh nhận "đã vào trường lúc HH:MM"; quét lại trong 5 phút không ghi thêm, không báo lại; quét ra là lượt mới (CT-1893, CT-1894; YCTD-389 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1260 | Cho mã sai dạng, mã không có, bảo vệ đơn vị khác, giáo viên, phụ huynh / Khi quét / Thì bị từ chối với thông báo rõ; danh sách lượt hôm nay chỉ trong đơn vị của người quét (CT-1895, CT-1896; YCTD-389 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1261 | Cho lượt vào bằng thẻ sau giờ bắt đầu học trong ngày học, học sinh chưa được điểm danh / Khi ghi lượt / Thì điểm danh ngày được tự ghi "Đi muộn"; lượt từ camera, lượt đúng giờ, ngày không học, học sinh đã có điểm danh thì không; không bao giờ tự ghi vắng (CT-1900; YCTD-389 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1262 | Cho lớp có học sinh đã qua cổng / Khi giáo viên mở bảng điểm danh / Thì thấy giờ vào, ra và gợi ý có mặt hoặc đi muộn; học sinh chưa qua cổng để trống (CT-1897; YCTD-389 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1263 | Cho một lượt bị nhận nhầm / Khi giáo viên chủ nhiệm báo nhận nhầm / Thì lượt bị hủy, phụ huynh nhận đính chính, báo lần hai bị từ chối; bảo vệ không báo được (CT-1899; YCTD-389 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1264 | Cho phụ huynh / Khi xem "Đến và về trường" / Thì thấy lượt của con mình, lượt đã đính chính có nhãn; không xem được lượt của con người khác; khoảng quá 31 ngày bị từ chối (CT-1898; YCTD-389 lát L1) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-640 | Trang Điểm danh, phần lượt qua cổng (YCTD-389 lát L1): cột "Cổng trường" (nhãn "Vào HH:MM · thẻ QR" xanh khi đúng giờ, vàng khi muộn; "Ra HH:MM"; "Chưa thấy qua cổng"), nút "Điền theo cổng trường" cho dòng chưa đánh dấu, "Báo nhận nhầm" có hộp xác nhận; nút "Thẻ QR của lớp" (người có `P04.gate-card.manage`) mở ngăn cấp thẻ, cấp lại có xác nhận, In thẻ | VT-07, VT-03, VT-02, VT-15 |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.2 Ứng dụng giáo viên | MH-644 | Quét thẻ vào, ra cổng (YCTD-389 lát L1): nút "Quét thẻ vào, ra cổng" ở Lớp của tôi khi có `P04.gate-pass.record`; chọn Vào trường hoặc Ra cổng; quét bằng máy ảnh hoặc gõ mã 16 ký tự; thông báo tên, lớp, giờ, "đã ghi đi muộn", quét trùng; danh sách lượt hôm nay | VT-18, VT-03 |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.3 Ứng dụng phụ huynh | MH-643 | Đến và về trường (YCTD-389 lát L1): nút "Đến và về trường" trên thẻ của con; lượt 7 ngày theo ngày (giờ, Vào trường hoặc Ra khỏi cổng, phương thức), lượt đã đính chính gạch ngang có nhãn; nhắc tắt thông báo ở nhóm "Con đến và về trường" | VT-14 |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1891 | P04-09 | Bảo vệ xem, cấp thẻ; quản lý đơn vị cấp hai lần; quản lý đơn vị khác cấp | 403; lần một cấp 2 thẻ mã 16 ký tự, lần hai 0; 403 | Kiểm thử tự động `apps/api/src/gate-passes/gate-passes.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1892 | P04-09 | Cấp lại thẻ T2 rồi quét thẻ cũ; cấp lại cho học sinh lớp khác | Mã mới khác mã cũ, quét thẻ cũ 422; 422 | Kiểm thử tự động `gate-passes.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1893 | P04-08 | Bảo vệ quét thẻ T1 vào | 200, không trùng; phụ huynh T1 có một thông báo `gate_arrived` "Trẻ T1 đã vào trường lúc HH:MM" | Kiểm thử tự động `gate-passes.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1894 | P04-08 | Quét lại mã T1 chữ thường có khoảng trắng; quét ra | Trùng, cùng mã lượt, vẫn một thông báo; lượt ra mới, một `gate_left` | Kiểm thử tự động `gate-passes.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1895 | P04-08 | Mã 3 ký tự; mã đúng dạng không có; thiếu hướng | 422; 404; 400 `ERR_VALIDATION` | Kiểm thử tự động `gate-passes.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1896 | P04-08 | Bảo vệ đơn vị khác, giáo viên, phụ huynh quét T1; danh sách hôm nay của hai bảo vệ, của phụ huynh | 403 cả ba; bảo vệ đơn vị A thấy T1, đơn vị B không thấy; phụ huynh 403 | Kiểm thử tự động `gate-passes.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1897 | P04-10 | Giáo viên chủ nhiệm mở bảng điểm danh hôm nay | Ngày học: dòng T1 có `gate.first_in`, T2 `gate` rỗng; ngày không học: 422 BR-91 | Kiểm thử tự động `gate-passes.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1898 | P04-11 | Phụ huynh T1, phụ huynh T2 xem lượt của T1; khoảng 3 tháng | Hai lượt; 403; 422 | Kiểm thử tự động `gate-passes.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1899 | P04-10 | Bảo vệ, giáo viên chủ nhiệm báo nhận nhầm lượt vào của T1; báo lần hai | 403; 200 và phụ huynh có `gate_pass_corrected`, lượt `rejected` ở dòng thời gian; 422 | Kiểm thử tự động `gate-passes.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1900 | P04-08, P04-10 | Hàm thuần: mã thẻ, chuẩn hóa mã, giờ Việt Nam qua nửa đêm, gộp đúng 5 phút và 5 phút 1 giây, gợi ý đúng giờ và muộn một phút, tự ghi đi muộn (thẻ QR, RFID, máy chấm công; camera, đúng giờ, lượt ra, ngày nghỉ, đã có điểm danh) | Đúng từng trường hợp | Kiểm thử tự động `apps/api/src/gate-passes/gate-pass-rules.test.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-389 lát L1 | Điểm danh bằng thẻ, lát L1: thẻ QR, lượt qua cổng, gợi ý điểm danh, thông báo đến và về | {PHIEN_BAN} | P04-08, P04-09, P04-10, P04-11 | AC-1258 đến AC-1264 | CT-1891 đến CT-1900 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/gate-passes/gate-passes.service.ts`, `apps/teacher/src/screens/GateScanScreen.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 30/10/2026; CI của PR |
