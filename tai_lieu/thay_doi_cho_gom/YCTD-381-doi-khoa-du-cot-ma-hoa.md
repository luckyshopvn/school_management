---
yctd: YCTD-381
tieu_de: Đổi khóa dữ liệu trẻ và bọc lại khóa gốc xử lý đủ giá trị mã hóa
ngay: 2026-10-29
phien_ban_de_xuat: 0.248.1
---

## 02 Nhật ký

### 2026-10-29 — Đổi khóa dữ liệu trẻ và bọc lại khóa gốc xử lý đủ giá trị mã hóa

#### Công việc đã thực hiện

- Sửa lỗi L-31 (mức Nghiêm trọng) và L-32 (mức Cao) theo đợt rà soát mã ngày 29/10/2026, ở `database/src/key-rotation.ts`:
  - `rotate-child-key` mã hóa lại cả giá trị ở khóa con `*_encrypted` (kể cả lồng nhau) trong cột jsonb `children.moet_profile`, `staff.moet_profile`, `staff_movements.dossier`: số CCCD, hộ chiếu, bảo hiểm xã hội và số định danh trong ảnh chụp hồ sơ phiếu chuyển; làm tiếp được khi bị gián đoạn như cột thường;
  - `rewrap-master-key` bọc lại thêm `platform_integration_secrets` (khóa cổng thanh toán, AI của nền tảng), `platform_push_keys` và `platform_native_push_keys` (kể cả khóa đã thôi dùng), trong cùng giao dịch;
  - danh sách cột bọc lại bằng khóa gốc (`MASTER_KEY_COLUMNS`) được kiểm thử đối chiếu với mọi cột `*_encrypted` của cơ sở dữ liệu nền tảng, nên bảng thêm sau mà thiếu thì kiểm thử hỏng.
- Kiểm thử `database/src/key-rotation.test.ts`: CT-1721, CT-1722 hỏng trên mã cũ, đạt trên mã mới.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: cột jsonb chứa giá trị mã hóa khai rõ trong `ENCRYPTED_JSON_COLUMNS`, không tự dò mọi cột jsonb, để giá trị không phải bản mã ở bảng khác (nhật ký) không làm dừng việc đổi khóa.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-381, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Đoạn ghi hình bài thi lưu ở kho tệp, mã hóa bằng khóa dữ liệu trẻ, chưa được mã hóa lại khi đổi khóa; xử lý ở đợt sửa lỗi mức Trung bình.

## 24 Yêu cầu thay đổi

### YCTD-381: Đổi khóa dữ liệu trẻ và bọc lại khóa gốc xử lý đủ giá trị mã hóa – 2026-10-29

- Lý do: sửa lỗi L-31, L-32 của đợt rà soát mã ngày 29/10/2026; BM-34 yêu cầu đổi khóa định kỳ.
- Nội dung thay đổi: đổi khóa dữ liệu trẻ mã hóa lại giá trị mã hóa trong jsonb hồ sơ CSDL ngành và phiếu chuyển nhân viên; bọc lại khóa gốc gồm khóa cổng thanh toán, AI, thông báo đẩy của nền tảng.
- Thành phần bị ảnh hưởng: `database/src/key-rotation.ts`, `database/src/key-rotation.test.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không đổi cấu trúc dữ liệu, API, quyền. Kết quả `rewrapMasterKey` có thêm số đếm của ba bảng.
- Ảnh hưởng chức năng cũ: không có.
- Kiểm thử cần thực hiện: kiểm kiểu `database`; kiểm thử đổi khóa.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: đổi khóa dữ liệu trẻ và bọc lại khóa gốc xử lý đủ giá trị mã hóa (YCTD-381, L-31, L-32).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Đổi khóa và bọc lại khóa gốc đủ giá trị mã hóa | YCTD-381 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1721 | P01-63 | Trường có số CCCD trong hồ sơ CSDL ngành của trẻ, số định danh và số bảo hiểm xã hội lồng trong ảnh chụp hồ sơ phiếu chuyển; đổi khóa dữ liệu trẻ, có lượt bị gián đoạn rồi làm tiếp | Mọi giá trị đọc được bằng khóa mới; khóa con khác của jsonb giữ nguyên | Kiểm thử tự động `database/src/key-rotation.test.ts` đạt ngày 29/10/2026 (L-31) | Đạt |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.1 Nghiêm trọng | L-31 | Đổi khóa dữ liệu trẻ chưa mã hóa lại giá trị mã hóa nằm trong jsonb hồ sơ CSDL ngành và phiếu chuyển nhân viên (đã xác minh) | CT-1721 | Sau khi đổi khóa, các số định danh này không đọc lại được | Đã sửa ở YCTD-381 |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1722 | P01-63 | Bọc lại khóa gốc khi có khóa cổng thanh toán, khóa VAPID đang dùng và đã thôi dùng, khóa đẩy gốc thiết bị; đối chiếu danh sách cột với cơ sở dữ liệu nền tảng | Ba bảng đọc được bằng khóa gốc mới; danh sách khớp mọi cột `*_encrypted` | Kiểm thử tự động `database/src/key-rotation.test.ts` đạt ngày 29/10/2026 (L-32) | Đạt |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-32 | Bọc lại khóa gốc chưa gồm khóa cổng thanh toán, AI và thông báo đẩy của nền tảng (đã xác minh) | CT-1722 | Sau khi đổi khóa gốc, các khóa này không đọc được | Đã sửa ở YCTD-381 |
