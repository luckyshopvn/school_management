---
yctd: YCTD-390
tieu_de: Liên thông dữ liệu học sinh, lát L2: hộp thư chuyển trường giữa các trường trên nền tảng
ngay: 2026-10-30
phien_ban_de_xuat: 0.254.0
---

## 02 Nhật ký

### 2026-10-30 — Liên thông dữ liệu học sinh, lát L2: hộp thư chuyển trường giữa các trường trên nền tảng (YCTD-390)

#### Công việc đã thực hiện

- Máy chủ API: `apps/api/src/student-records/transfer-mailbox-rules.ts` (khóa X25519 nhận gói, Ed25519 ký gói của từng trường; bọc mật khẩu gói bằng khóa công khai của trường đến), `transfer-mailbox.ts`, `transfer-mailbox.controller.ts`; đăng ký ở `apps/api/src/dang-ky/yctd-390-l2-hop-thu-chuyen-truong.ts`. `TransferPackagesService` tách `seal`, `acceptOpened`, `previewOpened` để dùng chung giữa tệp và hộp thư. `rewrapMasterKey` bọc lại cả khóa riêng chuyển trường khi đổi khóa gốc.
- Cổng quản trị, 4.2 Biến động học sinh, phần chuyển trường: khối "Chuyển trường trong hệ thống" (bật, tắt; hộp hồ sơ chuyển đến qua hệ thống với Xem gói, Từ chối); nút "Gửi qua hệ thống" ở đề nghị chuyển đi (tìm trường đến trong danh bạ, xác nhận đơn của cha mẹ, phần thêm có đồng ý), nút "Thu hồi gói", cột "Gửi qua hệ thống" (trạng thái, lý do từ chối). Hộp thoại xem gói và tiếp nhận của lát L1 dùng chung cho gói nhận qua hệ thống.
- Database migration: nền tảng `0258_create_student_transfer_mailbox` (`school_transfer_settings`, `school_transfer_keys`, `transfer_mailbox`); năm học `0242_add_student_transfer_mailbox` (`student_transfers.mailbox_id`, `partner_school_id`).
- Kiểm thử: `transfer-mailbox.test.ts` (CT-1950 đến CT-1954, hai trường giả trên nền tảng thử).

#### Quyết định

- Eric ngày 2026-10-30: làm các lát L0 đến L6 đã duyệt; phiên điều phối giao lát L2 (lượt 5), chọn phương án an toàn nhất cho dữ liệu học sinh.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, theo phương án an toàn:
  - mỗi trường tự bật chuyển trường trong hệ thống, mặc định tắt; chưa bật thì không gửi, không nhận, không có trong danh bạ; người bật là người có quyền duyệt hồ sơ, ghi nhật ký;
  - không trường nào ghi vào cơ sở dữ liệu của trường kia: trường đến tiếp nhận thì thư chuyển sang "đã tiếp nhận", trường đi thấy trạng thái rồi tự bấm "Duyệt" chuyển đi như lát L1;
  - khóa riêng của trường bọc bằng khóa gốc của nền tảng như khóa dữ liệu trẻ đang có (đặc tả BM-241); gói chỉ trường đến giải mã được, nền tảng chỉ giữ bản mã hóa;
  - thư chưa ai xử lý hết hạn sau 90 ngày; gói đã tiếp nhận, từ chối xóa sau 30 ngày, thu hồi thì xóa ngay; việc xóa chạy mỗi lần trường mở hộp thư;
  - lý do từ chối trường đi thấy được, giao diện nhắc không ghi thông tin cá nhân;
  - giới hạn 200 yêu cầu chuyển hồ sơ một ngày của đặc tả thuộc lát L4 (yêu cầu từ trường mới), chưa làm ở lát này.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-390, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `07_QUY_TAC_NGHIEP_VU.md` BR-510 đến BR-514, `11_TIEU_CHI_NGHIEM_THU.md` AC-1310 đến AC-1314, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md` giao kèo hộp thư chuyển trường, `21_KICH_BAN_KIEM_THU.md` CT-1950 đến CT-1954, `22_BAO_MAT.md` BM-260 đến BM-262.

#### Vấn đề tồn đọng

- Lát L3 (ứng dụng phụ huynh) đến L6 chưa làm.
- Luật sư chưa trả lời câu hỏi ở đặc tả mục 16; trường thật chưa nên bật chuyển trường trong hệ thống.
- Bảng 14 chưa có dòng riêng cho khối hộp thư: MH-652 (dòng thêm ở lát L1) mô tả lại khi gom.

## 24 Yêu cầu thay đổi

### YCTD-390: Liên thông dữ liệu học sinh, lát L2: hộp thư chuyển trường giữa các trường trên nền tảng – 2026-10-30

- Lý do: lát L2 của YCTD-390 (đặc tả `tai_lieu/ban_mau/yctd-390/DAC_TA.md` mục 5.2, 7.3; Eric duyệt ngày 2026-10-30).
- Nội dung thay đổi: trường bật chuyển trường trong hệ thống (mặc định tắt); danh bạ trường đã bật; trường đi gửi gói đã ký, mã hóa cho đúng trường đến qua hộp thư ở cơ sở dữ liệu nền tảng; trường đến xem (kiểm chữ ký), tiếp nhận hoặc từ chối có lý do; trường đi thấy trạng thái, thu hồi được khi trường đến chưa xử lý; gói tự xóa theo hạn.
- Yêu cầu bị thay đổi: không (thực hiện đặc tả đã duyệt).
- Thành phần bị ảnh hưởng: 4.2 Biến động học sinh (cổng quản trị), `student_transfers`, cơ sở dữ liệu nền tảng, đổi khóa gốc nền tảng (`rewrapMasterKey`).
- Dữ liệu, API, quyền bị ảnh hưởng: migration nền tảng `0258_create_student_transfer_mailbox`, năm học `0242_add_student_transfer_mailbox`; điểm cuối `/student-transfers/mailbox/*`, `/student-transfers/{id}/send`, `/{id}/revoke`; không thêm quyền.
- Ảnh hưởng chức năng cũ: lập gói bằng tệp, tiếp nhận gói bằng tệp, duyệt chuyển đi giữ nguyên; bản một trường không đổi.
- Kiểm thử cần thực hiện: CT-1950 đến CT-1954; chạy lại `transfer-packages.test.ts`, `transfer-package-rules.test.ts`, `database/src/key-rotation.test.ts`, `tenancy-matrix.test.ts`.
- Mức: Lớn (thuộc YCTD-390). Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: liên thông dữ liệu học sinh, lát L2: hộp thư chuyển trường giữa các trường trên nền tảng (YCTD-390).
- Database migration: nền tảng `0258_create_student_transfer_mailbox`, năm học `0242_add_student_transfer_mailbox`. Quay lui: chạy `down` của hai tệp (xóa ba bảng nền tảng, hai cột của `student_transfers`); học sinh đã tiếp nhận qua hộp thư giữ nguyên hồ sơ.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Liên thông dữ liệu học sinh, lát L2: hộp thư chuyển trường | YCTD-390 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-510 | Chuyển trường trong hệ thống (YCTD-390 lát L2): chỉ ở bản nhiều trường; mỗi trường tự bật, mặc định tắt, người bật có quyền duyệt hồ sơ, ghi nhật ký; trường chưa bật không gửi, không nhận, không xem danh bạ, không có trong danh bạ; danh bạ chỉ có trường khác đã bật, đang hoạt động hoặc dùng thử, gồm tên, mã trường của Bộ, xã, cấp học, không có dữ liệu học sinh |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-511 | Thư chuyển trường (YCTD-390 lát L2): gửi theo cùng điều kiện lập gói (BR-480, BR-481); mỗi đề nghị chuyển đi tối đa một thư đang chờ (`sent`, `opened`) hoặc đã tiếp nhận; trường đi thu hồi được thư đang chờ, gửi lại được sau khi bị từ chối, thu hồi, hết hạn; thư đã xử lý không mở, không tiếp nhận, không từ chối lại |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-512 | Mở thư chuyển trường (YCTD-390 lát L2): chỉ trường đến thấy, mở thư gửi cho mình (trường khác nhận 404); trước khi giải mã kiểm chữ ký Ed25519 của trường đi trên mã gói, hai trường, mã băm của gói; chữ ký sai hoặc mã băm không khớp thì không mở |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-513 | Kết quả của trường đến (YCTD-390 lát L2): tiếp nhận theo BR-482 rồi thư chuyển sang "đã tiếp nhận"; từ chối cần lý do 1 đến 500 ký tự, trường đi thấy lý do; không trường nào ghi vào cơ sở dữ liệu của trường kia, trường đi tự duyệt chuyển đi khi thấy "đã tiếp nhận" |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-514 | Thời hạn giữ gói ở hộp thư (YCTD-390 lát L2): thư chưa xử lý hết hạn sau 90 ngày; gói đã tiếp nhận, từ chối xóa sau 30 ngày; thu hồi, hết hạn xóa ngay; chỉ giữ phần mô tả không có dữ liệu cá nhân để hai trường xem trạng thái |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1310 | Cho hai trường trên nền tảng / Khi chưa bật chuyển trường trong hệ thống / Thì không gửi được, không xem được danh bạ; bật rồi thì danh bạ chỉ có trường khác đã bật (CT-1951; YCTD-390) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1311 | Cho đề nghị chuyển đi đã nhận đơn của cha mẹ / Khi Hiệu trưởng gửi qua hệ thống cho trường trong danh bạ / Thì trường đến thấy thư trong hộp; hộp thư không có dữ liệu cá nhân dạng rõ; trường đi không mở được thư; gửi lại khi đang chờ bị từ chối (CT-1950, CT-1952; YCTD-390) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1312 | Cho thư đang chờ / Khi trường đến xem gói và tiếp nhận vào lớp / Thì học sinh Đang học ở trường đến, trường đi thấy "Trường đến đã tiếp nhận", không thu hồi được; tiếp nhận lần hai bị từ chối (CT-1953; YCTD-390) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1313 | Cho thư đang chờ / Khi trường đến từ chối không ghi lý do hoặc có lý do / Thì không ghi lý do bị từ chối; có lý do thì trường đi thấy lý do và gửi lại được (CT-1954; YCTD-390) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1314 | Cho thư có chữ ký sai, hoặc thư trường đi thu hồi / Khi trường đến mở / Thì không mở được; thư thu hồi bị xóa gói ngay (CT-1954; YCTD-390) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1950 | P02-23 | Bọc mật khẩu bằng khóa của trường đến, mở bằng khóa của trường đến và trường khác | Trường đến mở được; trường khác bị từ chối; khóa riêng lưu ở dạng bọc | Kiểm thử tự động `transfer-mailbox.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1951 | P02-23 | Cài đặt mặc định; xem danh bạ, gửi khi chưa bật; bật hai trường, xem danh bạ | Mặc định tắt; 422 BR-510; danh bạ chỉ có trường kia | Kiểm thử tự động `transfer-mailbox.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1952 | P02-23 | Gửi thiếu xác nhận đơn; gửi đúng; đọc hộp thư ở nền tảng; gửi lại; trường đi mở thư | 400; 200; không có họ tên học sinh dạng rõ; 422 BR-511; 404, hộp nhận của trường đi rỗng | Kiểm thử tự động `transfer-mailbox.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1953 | P02-23 | Trường đến xem hộp, xem gói, tiếp nhận; trường đi xem trạng thái, thu hồi; tiếp nhận lần hai | Gói đúng học sinh; Đang học; "accepted"; 422 BR-511; 422 BR-511 | Kiểm thử tự động `transfer-mailbox.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1954 | P02-23 | Từ chối không lý do, có lý do; gửi lại; sửa chữ ký rồi mở; thu hồi | 400; trường đi thấy lý do; gửi lại được; 422 BR-512; gói bị xóa | Kiểm thử tự động `transfer-mailbox.test.ts` | Đạt |
| 22_BAO_MAT.md | BM-215 | BM-260 | Khóa chuyển trường của trường (YCTD-390 lát L2): mỗi trường một cặp khóa X25519 nhận gói và một cặp Ed25519 ký gói, tạo khi bật lần đầu; khóa riêng bọc AES-256-GCM bằng khóa gốc của nền tảng ở `school_transfer_keys`, được bọc lại khi đổi khóa gốc (`rewrapMasterKey`); mật khẩu gói ngẫu nhiên 32 ký tự bọc bằng khóa công khai của trường đến (khóa tạm thời X25519, HKDF-SHA256, AES-256-GCM) |
| 22_BAO_MAT.md | BM-215 | BM-261 | Cách ly giữa trường ở hộp thư (YCTD-390 lát L2): mọi truy vấn hộp thư lọc theo trường của phiên (trường đến cho hộp nhận, trường đi cho trạng thái đã gửi); mở thư của trường khác trả 404; trường không ghi vào cơ sở dữ liệu của trường khác; kiểm thử hai trường giả |
| 22_BAO_MAT.md | BM-215 | BM-262 | Chống giả mạo và thời hạn ở hộp thư (YCTD-390 lát L2): kiểm chữ ký của trường đi và mã băm trước khi giải mã; thư hết hạn sau 90 ngày, gói xóa theo BR-514; mặc định tắt, trường thật chưa bật khi luật sư chưa trả lời câu hỏi ở đặc tả YCTD-390 mục 16 |
| 16_CO_SO_DU_LIEU.md | school_keys (từ YCTD-191) | school_transfer_settings (từ YCTD-390) | Trường bật chuyển trường trong hệ thống (BR-510) | school_id (khóa chính), enabled (mặc định tắt), updated_by_name, updated_at |
| 16_CO_SO_DU_LIEU.md | school_keys (từ YCTD-191) | school_transfer_keys (từ YCTD-390) | Khóa nhận và ký gói chuyển trường của trường (BM-260) | school_id (khóa chính), encryption_public_key, encryption_private_key_encrypted, signing_public_key, signing_private_key_encrypted, created_at |
| 16_CO_SO_DU_LIEU.md | school_keys (từ YCTD-191) | transfer_mailbox (từ YCTD-390) | Hộp thư chuyển trường, không có dữ liệu cá nhân dạng rõ (BR-511 đến BR-514) | id, kind (`student_transfer`), package_code (duy nhất), from_school_id, to_school_id, state (`sent`, `opened`, `accepted`, `rejected`, `revoked`, `expired`), envelope (gói đã mã hóa, trống khi đã xóa), wrapped_secret, envelope_sha256, signature, decision_note, sent_at, decided_at, expires_at, purge_after, updated_at |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-390 lát L2 | Liên thông dữ liệu học sinh, lát L2: hộp thư chuyển trường | {PHIEN_BAN} | P02-23 | AC-1310 đến AC-1314 | CT-1950 đến CT-1954 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/student-records/transfer-mailbox.ts`, `transfer-mailbox-rules.ts`, `transfer-mailbox.controller.ts`, `apps/portal/src/students/TransferMailboxPanel.tsx`, `database/platform/migrations/0258_create_student_transfer_mailbox.ts`, `database/school-year/migrations/0242_add_student_transfer_mailbox.ts` | Kiểm thử tự động, CI của PR |
