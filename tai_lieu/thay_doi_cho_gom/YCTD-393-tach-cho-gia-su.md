---
yctd: YCTD-393
tieu_de: Tách Chợ gia sư thành sản phẩm riêng, bỏ chương trình gia sư trong trường
ngay: 2026-10-30
phien_ban_de_xuat: 0.240.0
---

## 02 Nhật ký

### 2026-10-30 — Tách Chợ gia sư thành sản phẩm riêng, lát L1: gỡ mã chợ khỏi School Management (YCTD-393)

#### Công việc đã thực hiện

- Chợ gia sư chuyển sang kho riêng tư `luckyshopvn/cho-gia-su` (máy chủ, cơ sở dữ liệu, đăng nhập, ứng dụng quản trị riêng; dữ liệu bắt đầu trống). Kho mới chạy được trên máy, kiểm thử máy chủ và kiểm thử đầu cuối của chợ đạt ở kho mới.
- Gỡ khỏi School Management: `apps/market`, `packages/market-client`, `apps/api/src/market`, tệp đăng ký phần `dt-27f` đến `dt-27j`, `yctd-364-danh-gia-tai-khoan`, năm trang chợ và mục menu "Chợ gia sư" của cổng vận hành, liên kết hồ sơ con với chợ ở ứng dụng phụ huynh (`ChildMarketLink`, điểm cuối `children/:id/market-link`), chuyển sự kiện phòng `market-` ở `video/webhook`, quyền vận hành `market.*`, cấu hình `MARKETPLACE_DATABASE_URL`, `MARKET_LINK_SECRET`, `MARKET_IDENTITY_*`, `MARKET_FILES_KEY`, `MARKET_JOB_INTERVAL_SECONDS`, đường dẫn không cần trường `/api/v1/market/*`, cơ sở dữ liệu `marketplace` (tệp thay đổi cấu trúc, kiểu bảng, cấp phát, chạy ở lệnh nền tảng và lệnh dựng nhiều trường), `scripts/chuyen-huong-gia-su.mjs`, tên miền `cho-gia-su.`, `gia-su.` trong `scripts/chay-nhieu-truong.mjs`, `MARKET_SITE`, `TUTOR_SITE` của hồ sơ vận hành, `MARKET_HOST`, `TUTOR_HOST` của cổng biên thử nghiệm, Dockerfile, kiểm thử giao diện 195 đến 199 và cấu hình kiểm thử nhiều trường.
- Công cụ sao lưu dữ liệu của chức năng đã bỏ (`database/src/removed-data-backup.ts`): xuất bảng ra tệp nén, mã hóa cùng định dạng bản sao lưu trường (BACKUP_ENCRYPTION_PASSPHRASE), đọc lại kiểm tra số dòng, ghi số dòng và tổng kiểm từng bảng vào `removed_data_backups`; hàm `assertRemovedDataBackedUp` cho database migration xóa bảng.
- Lệnh `pnpm --filter @school-management/database xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su [--xoa-co-so-du-lieu]`: sao lưu mọi bảng của cơ sở dữ liệu chợ kèm cấu hình khóa `market`, ghi nhận ở cơ sở dữ liệu nền tảng, tùy chọn xóa cơ sở dữ liệu và vai trò của chợ.
- Database migration nền tảng 0255: xóa khóa `market` của `platform_settings`, dừng khi khóa còn mà chưa có bản ghi sao lưu chức năng `cho-gia-su`.

#### Quyết định

- Eric ngày 2026-10-30: tách Chợ gia sư ra kho riêng tư, không liên hệ gì với School Management, dữ liệu chợ không chuyển; bỏ hẳn chương trình gia sư trong trường (DT-27) có sao lưu trước khi xóa bảng; School Management chỉ giữ Gia sư AI (YCTD-383).
- Eric duyệt phiếu và danh sách lát; sao lưu bằng lệnh xuất tệp mã hóa, database migration từ chối khi chưa có bản ghi sao lưu; quản trị chợ bằng ứng dụng và tài khoản riêng có TOTP; giữ Mẫu 03 ở chợ.
- Mã yêu cầu thay đổi đổi từ YCTD-384 sang YCTD-393 vì phiên thiết kế lại giao diện đã gộp YCTD-384 trước; PR 307 và các commit đầu còn ghi YCTD-384.
- Số giữ cho YCTD-393: nền tảng 0255 đến 0259, năm học 0235 đến 0239, định danh 0190 đến 0194, hệ thống 0135 đến 0139. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-393, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lát L2 (gỡ mã chương trình gia sư trong trường), L3 (database migration xóa bảng gia sư kèm lệnh sao lưu), L4 (đánh dấu chức năng đã bỏ ở 07, 08, 10, 11, 14, 16, 17, 21, 27, 47, 48, 49).
- Bản nhiều trường trên máy của Eric có cơ sở dữ liệu `school_marketplace`: chạy lệnh `xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su --xoa-co-so-du-lieu` trước `pnpm database:migrate` nền tảng.

## 24 Yêu cầu thay đổi

### YCTD-393: Tách Chợ gia sư thành sản phẩm riêng, bỏ chương trình gia sư trong trường – 2026-10-30

- Lý do: Eric quyết định ngày 2026-10-30: Chợ gia sư thành sản phẩm riêng ở kho riêng tư `luckyshopvn/cho-gia-su`, không liên hệ gì với School Management, bắt đầu dữ liệu trống; bỏ hẳn chương trình gia sư bổ trợ trong trường (DT-27). School Management chỉ giữ Gia sư AI trả phí (YCTD-383). Thay các quyết định YCTD-250 đến 255, 261, 262, 368.
- Nội dung thay đổi:
  - Kho mới `cho-gia-su`: chép phần chợ (ứng dụng web, máy chủ API, cơ sở dữ liệu `market_*`, trang quản trị chợ của cổng vận hành), bỏ mọi điểm nối với trường; đăng nhập quản trị riêng; dữ liệu trống.
  - School Management: gỡ toàn bộ mã chợ; gỡ chương trình gia sư trong trường (lớp gia sư, đơn đăng ký, buổi học, điểm danh, miễn tham gia, tài chính gia sư, khoản thu gia sư trên hóa đơn, tiền công giáo viên, khóa học ghi sẵn, câu hỏi gửi thầy cô, sự đồng ý AI của cha mẹ, soạn nháp trả lời bằng AI `draftAnswer`, phòng học video theo buổi gia sư và bản ghi hình).
- Thành phần bị ảnh hưởng: `apps/market`, `packages/market-client`, `apps/api/src/market`, `apps/api/src/tutoring`, `apps/api/src/ai-assistant`, `apps/api/src/video`, `apps/api/src/fees`, `apps/platform`, `apps/portal`, `apps/teacher`, `apps/parent`, `apps/student`, `packages/shared`, `packages/ui`, `database`, `deploy`, `scripts`, `tests`, CI.
- Dữ liệu bị ảnh hưởng:
  - Cơ sở dữ liệu chợ `school_marketplace`: sao lưu rồi xóa toàn bộ bằng lệnh `xoa-du-lieu-da-bo`; khóa `market` của `platform_settings` xóa ở database migration nền tảng 0255.
  - Cơ sở dữ liệu năm học: xóa các bảng `tutoring_*`, `video_recordings`, `video_recording_consents`, `video_recording_views` sau khi sao lưu; `video_rooms` bỏ phòng loại `session` và cột `tutoring_session_id`; `invoice_items.tutoring_registration_id` gỡ liên kết, dòng thu `item_type = 'tutoring'` đã phát hành giữ nguyên số tiền và nội dung.
  - Định danh: gỡ quyền `P02.tutoring.manage`, `P02.tutoring.teach` khỏi vai. Hệ thống: kiểu yêu cầu AI `answer` giữ trong ràng buộc để không mất lịch sử. Nền tảng: mô-đun gói `tutoring` bỏ; giữ giới hạn video của gói.
- API bị ảnh hưởng: bỏ `/api/v1/market/*`, `/children/:id/market-link`, `/tutoring/*`, `/children/:id/tutoring/*`, `/student/tutoring/*`, `/children/:id/video`, `/student/video`; `/video/webhook` chỉ còn phòng của trường.
- Giao diện bị ảnh hưởng: cổng vận hành bỏ "Chợ gia sư"; cổng trường bỏ nhóm "Gia sư"; ứng dụng giáo viên, phụ huynh, học sinh bỏ phần gia sư, câu hỏi, khóa học ghi sẵn, phòng học video theo buổi gia sư, liên kết Chợ gia sư.
- Quyền bị ảnh hưởng: quyền vận hành `market.*`; PQ-110, 120, 145, 155 thôi hiệu lực.
- Kiểm thử cần thực hiện: kiểm kiểu toàn kho; kiểm thử máy chủ (học phí, AI, video, lớp học trực tuyến, cấp học); kiểm thử cổng biên; kiểm thử giao diện còn lại; database migration trên bản sao có dữ liệu mẫu (thiếu sao lưu thì dừng, có sao lưu thì xóa, hóa đơn cũ không đổi số tiền).
- Mã cũ không xóa, đánh dấu "Đã bỏ (YCTD-393)" ở lát L4.
- Trạng thái: Đã duyệt (Eric, 2026-10-30); lát L1 đã triển khai.

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gỡ Chợ gia sư khỏi School Management, chợ chuyển sang kho riêng (YCTD-393, lát L1).
- Dữ liệu: cần chạy lệnh `xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su` trước database migration nền tảng 0255 ở bản triển khai có cơ sở dữ liệu chợ.
- Quay lui: triển khai lại phiên bản trước; dữ liệu chợ khôi phục từ tệp sao lưu (`verifyRemovedDataBackup` kiểm tệp, nạp bằng `loadDatabase` của school-data-copy.ts vào cơ sở dữ liệu chợ tạo lại bằng phiên bản trước).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gỡ Chợ gia sư khỏi School Management, chợ chuyển sang kho riêng (lát L1) | YCTD-393 |
