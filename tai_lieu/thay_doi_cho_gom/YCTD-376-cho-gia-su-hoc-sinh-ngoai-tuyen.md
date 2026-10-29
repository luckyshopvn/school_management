---
yctd: YCTD-376
tieu_de: Chợ gia sư hoàn tất bản ghi buổi học từ sự kiện của máy chủ video, giới hạn thử mã đặt lại mật khẩu, giới hạn tần suất; dữ liệu học khi mạng yếu gắn với học sinh
ngay: 2026-10-29
phien_ban_de_xuat: 0.238.1
---

## 02 Nhật ký

### 2026-10-29 — Bản ghi buổi học, mã đặt lại mật khẩu, giới hạn tần suất của chợ; dữ liệu trên máy của học sinh (YCTD-376)

#### Công việc đã thực hiện

- Bản ghi buổi học ở chợ gia sư: khi máy chủ video báo ghi xong (`recording_ended`, như LiveKit), `MarketSafetyService.finishRecording` mã hóa tệp sang khóa mới bằng `MARKET_FILES_KEY`, xóa tệp thô, đặt `ready` (đọc tệp lỗi hoặc ghi lỗi thì `failed`), đặt hạn giữ 30 ngày. `MarketRoomsService.handleEvent` chuyển sự kiện này cho dịch vụ an toàn trẻ em; dừng ghi ở `endSession` không ghi đè trạng thái đã chốt. Bộ giả lập video có chế độ trả kết quả qua sự kiện như LiveKit (`deferRecordingCompletion`).
- Đặt lại mật khẩu ở chợ: mã lưu bằng argon2; mỗi lần nhập mã giành một lượt bằng câu lệnh cập nhật có điều kiện trước khi so mã; mỗi tài khoản tối đa 10 lượt thử và 10 mã trong 24 giờ, lấy mã mới không làm mới số lượt; đánh dấu đã dùng có điều kiện.
- Giới hạn tần suất theo địa chỉ mạng cho `market/*` (`MarketRateLimiter`): 600 yêu cầu mỗi phút; điểm cuối nhận hoặc gửi mã, mật khẩu 30 yêu cầu mỗi phút; sự kiện gọi lại của cổng thanh toán không tính.
- Ứng dụng học sinh, học khi mạng yếu: bản ghi và khóa mã hoá trên máy gắn với người dùng của mã phiên; chỉ đọc, gửi phần của em đang đăng nhập. Đăng xuất xoá dữ liệu trên máy kể cả khi mất mạng; mở ứng dụng mà máy chủ từ chối phiên thì cũng xoá.
- Kiểm thử CT-1716, CT-1717, CT-1718 (`apps/api/src/market/market-safety.test.ts`), CT-1719 (`apps/student/src/offline/offline-rules.test.ts`, `tests/e2e/219-offline-learning.spec.ts`) hỏng trước khi sửa, đạt sau khi sửa. Spec 219 tách phần chuẩn bị dữ liệu thành hàm dùng chung cho hai kịch bản.

#### Quyết định

- Hạn mức 24 giờ của mã đặt lại (10 lượt thử, 10 mã), giới hạn 30 và 600 yêu cầu mỗi phút; mã người dùng lấy từ `sub` của mã phiên, không gọi thêm máy chủ. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Tệp bản ghi đã mã hóa lưu ở khóa `<khóa cũ>.enc` để sự kiện gửi lại không mã hóa hai lần.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-376, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Bộ đếm tần suất nằm trong bộ nhớ từng tiến trình như các bộ giới hạn công khai khác.

## 24 Yêu cầu thay đổi

### YCTD-376: Bản ghi buổi học, mã đặt lại mật khẩu, giới hạn tần suất của chợ gia sư; dữ liệu trên máy của học sinh – 2026-10-29

- Lý do: sửa lỗi L-38, L-39, L-40 (rà soát mã ngày 2026-10-29) để chạy đúng YCTD-259 (bản ghi buổi học mã hóa, xem được), YCTD-364 (giới hạn số lần nhập mã đặt lại) và YCTD-280 (dữ liệu trên máy là của chính em, xoá khi đăng xuất).
- Nội dung thay đổi: hoàn tất bản ghi từ sự kiện ghi xong của máy chủ video; mã đặt lại lưu bằng argon2, giành lượt thử nguyên tử, hạn mức 24 giờ; giới hạn tần suất `market/*`; dữ liệu học khi mạng yếu gắn với người dùng, xoá khi đăng xuất kể cả mất mạng. API không đổi.
- Thành phần bị ảnh hưởng: `apps/api/src/market/market-safety.ts`, `market-rooms.ts`, `market-password.ts`, `market-rate-limit.ts` (mới), `apps/api/src/dang-ky/dt-27f-cho-gia-su.ts`, `apps/api/src/video/video-provider.ts`; `apps/student/src/offline/offline.ts`, `offline-store.ts`, `offline-rules.ts`, `apps/student/src/student-session.tsx`; kiểm thử nêu ở trên.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: chợ gia sư và học khi mạng yếu (YCTD-376).
- Bản ghi buổi học ở chợ chuyển sang xem được khi máy chủ video báo ghi xong; tệp lưu đã mã hóa.
- Mã đặt lại mật khẩu ở chợ giới hạn lượt thử chặt chẽ; điểm cuối của chợ có giới hạn tần suất.
- Bài chờ gửi trên máy của học sinh gắn với em, xoá khi đăng xuất kể cả lúc mất mạng.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Chợ gia sư: bản ghi buổi học, mã đặt lại, giới hạn tần suất; dữ liệu trên máy của học sinh | YCTD-376 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-376: bản ghi buổi học, mã đặt lại mật khẩu, giới hạn tần suất ở chợ gia sư |
| 03_DANH_SACH_CONG_VIEC.md | P03 Giảng dạy | YCTD-376: dữ liệu học khi mạng yếu gắn với học sinh, xoá khi đăng xuất kể cả mất mạng |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1716 | P02-136 | Máy chủ video dừng ghi không trả tệp; tệp thô có ở kho; máy chủ video gửi sự kiện ghi xong, gửi lại lần hai | Bản ghi chuyển từ đang xử lý sang xem được, tệp lưu đã mã hóa, tệp thô bị xóa, phụ huynh xem đúng nội dung; sự kiện lần hai không đổi gì | Kiểm thử tự động `apps/api/src/market/market-safety.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1717 | P02-125 | Lấy mã đặt lại; gửi đồng thời 8 lần mã sai; nhập mã đúng; lấy mã mới, nhập sai 5 lần; lấy mã lần nữa | Mã lưu bằng argon2; tối đa 5 lần được so mã; mã đúng sau khi hết lượt bị từ chối; hết 10 lượt trong 24 giờ thì không cấp mã mới; mật khẩu không đổi | Kiểm thử tự động `apps/api/src/market/market-safety.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1718 | P02-125 | Một địa chỉ mạng gửi 31 yêu cầu đặt lại mật khẩu trong một phút | 30 yêu cầu đầu được xử lý, yêu cầu thứ 31 bị từ chối vì quá tần suất | Kiểm thử tự động `apps/api/src/market/market-safety.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1719 | P03-60 | Học sinh mất mạng, bấm Nộp bài (bài giữ trên máy), bấm Đăng xuất khi vẫn mất mạng; có mạng lại | Dữ liệu trên máy bị xoá; không có lần nộp nào được gửi; khóa bản ghi gắn với người dùng của mã phiên | Kiểm thử tự động `apps/student/src/offline/offline-rules.test.ts`, kiểm thử giao diện `tests/e2e/219-offline-learning.spec.ts` đạt ngày 29/10/2026 | Đạt |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-38 | Bản ghi buổi học ở chợ không chuyển sang xem được khi máy chủ video báo ghi xong qua sự kiện | Rà soát mã 29/10/2026 | Trái YCTD-259 | Đã sửa ở YCTD-376, CT-1716 |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-39 | Giới hạn số lần nhập mã đặt lại mật khẩu ở chợ không chặt chẽ; chợ chưa có giới hạn tần suất | Rà soát mã 29/10/2026 | Trái YCTD-364 | Đã sửa ở YCTD-376, CT-1717, CT-1718 |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-40 | Dữ liệu học khi mạng yếu trên máy dùng chung không gắn với học sinh, không bị xoá khi đăng xuất lúc mất mạng | Rà soát mã 29/10/2026 | Trái YCTD-280 | Đã sửa ở YCTD-376, CT-1719 |
