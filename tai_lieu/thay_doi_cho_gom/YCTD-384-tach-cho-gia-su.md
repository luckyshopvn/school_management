---
yctd: YCTD-384
tieu_de: Tách Chợ gia sư thành sản phẩm riêng, bỏ chương trình gia sư trong trường
ngay: 2026-10-30
phien_ban_de_xuat: 0.240.0
---

## 02 Nhật ký

### 2026-10-30 — Bỏ chương trình gia sư trong trường, lát L3: database migration xóa bảng gia sư kèm sao lưu (YCTD-384)

#### Công việc đã thực hiện

- Lệnh `pnpm --filter @school-management/database xoa-du-lieu-da-bo -- --tinh-nang gia-su-trong-truong` (`database/src/removed-tutoring-backup.ts`): sao lưu các bảng gia sư của mọi cơ sở dữ liệu năm học sẽ chạy database migration (nhiều trường khi có `PLATFORM_DATABASE_URL`: trường không ở trạng thái đang khởi tạo, đã xóa, năm học không chỉ đọc; một trường: năm học đang dùng) vào `<BACKUP_DIR>/removed[/<mã trường>]/gia-su-trong-truong/`, tệp nén, mã hóa bằng `BACKUP_ENCRYPTION_PASSPHRASE`, đọc lại kiểm tra; ghi số dòng, tổng kiểm từng bảng vào `removed_data_backups` của chính cơ sở dữ liệu đó; in tóm tắt từng cơ sở dữ liệu (số bảng, số dòng, dòng liên kết, đường dẫn tệp, mã băm).
- Tệp sao lưu gồm trọn 23 bảng bị xóa, kèm ở phần `extra` của dòng đầu các dòng bảng còn giữ bị đổi hoặc xóa: `invoice_item_tutoring_links` (cặp `invoice_item_id`, `tutoring_registration_id`), `session_video_rooms`, `session_video_room_admissions`, `session_video_room_events` (trọn dòng dạng JSON).
- Database migration năm học 0235: dừng khi bảng còn dữ liệu chưa có bản ghi sao lưu khớp số dòng; bỏ cột `invoice_items.tutoring_registration_id` (dòng `item_type = 'tutoring'` giữ số tiền, nội dung; ràng buộc vẫn nhận `tutoring`); xóa phòng video loại `session` cùng phòng chờ, nhật ký vào ra của phòng đó, bỏ cột `video_rooms.tutoring_session_id`, chỉ mục duy nhất, ràng buộc phòng của buổi, `video_rooms_kind_check` chỉ còn `instant`; xóa `tutoring_rules`, `tutoring_programs`, `tutoring_program_teachers`, `tutoring_program_classes`, `tutoring_program_candidates`, `tutoring_sessions`, `tutoring_exemptions`, `tutoring_exemption_children`, `tutoring_registrations`, `tutoring_attendance`, `tutoring_room_events`, `tutoring_charge_sessions`, `tutoring_credits`, `tutoring_credit_applications`, `tutoring_teacher_pay`, `video_recording_consents`, `video_recordings`, `video_recording_views`, `tutoring_program_courses`, `tutoring_media_views`, `tutoring_question_marks`, `tutoring_ai_answers`, `tutoring_ai_consents`; khoản mục lương `THU_LAO_DAY_THEM` chuyển `inactive`.
- Database migration định danh 0190: gỡ quyền `P02.tutoring.manage`, `P02.tutoring.teach`, phần gán cho vai trò và việc ẩn phân hệ `tutoring` với VT-14, VT-21 do 0172 thêm.
- Kiểu bảng: gỡ các bảng trên, `invoice_items.tutoring_registration_id`, `video_rooms.tutoring_session_id` khỏi `database/school-year/schema.ts` và kiểu `Tutoring*` khỏi `database/src/index.ts`; tính học phí bỏ bước xóa `tutoring_credits` tạm thời của lát L2.
- Kiểm thử `database/src/removed-tutoring-backup.test.ts`: chưa sao lưu thì 0235 từ chối; sao lưu đủ bảng và dòng liên kết, 0235 xóa bảng, giữ dòng hóa đơn, phòng tức thời; chạy lại không lỗi; định danh tạo mới không còn quyền gia sư.

#### Quyết định

- Thiết kế sao lưu theo quyết định của Eric ngày 2026-10-30 (lệnh riêng, tệp mã hóa ngoài kho mã, ghi số dòng, database migration từ chối khi thiếu bản ghi).
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: `tutoring_rules` chỉ có dòng 0152 nạp sẵn thì không cần sao lưu (cấu hình dựng lại được, có ở mọi năm học kể cả năm mới tạo); quyền ở cơ sở dữ liệu định danh là cấu hình nạp sẵn nên không sao lưu; khoản mục lương giữ lại vì dòng lương đã lập có thể trỏ tới; phòng video tức thời giữ nguyên.
- Năm học đã đóng (chỉ đọc) không chạy database migration (QU-11) nên giữ nguyên bảng gia sư, không cần sao lưu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-384, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lát L4 (đánh dấu chức năng đã bỏ ở tài liệu).
- Không gian khóa học loại `elective` từng gắn với chương trình gia sư (`tutoring_program_courses`) còn ở phần học trực tuyến; liên kết nằm trong tệp sao lưu.
- Bản ghi video ở kho tệp (`video-recordings/…`) không bị xóa bởi database migration; danh sách khóa tệp nằm trong tệp sao lưu (`video_recordings.storage_key`).

### 2026-10-30 — Bỏ chương trình gia sư trong trường, lát L2: gỡ mã gia sư trong trường (YCTD-384)

#### Công việc đã thực hiện

- Máy chủ API: gỡ `apps/api/src/tutoring` (chương trình, quy định dạy thêm, buổi học, đơn đăng ký, điểm danh, quyết định tăng thời lượng, thu chi và thù lao, khóa học ghi sẵn, câu hỏi gửi thầy cô, đồng ý AI của cha mẹ) cùng bộ điều khiển, dịch vụ ở `application.module.ts` và đường dẫn không cần trường `/api/v1/tutoring/course-media/:activityId/stream`, `/api/v1/video/recordings/:id/stream`.
- Tính học phí không còn lập dòng thu gia sư và khoản trừ gia sư; hóa đơn đã phát hành giữ nguyên dòng `item_type = 'tutoring'`, hiện theo nội dung dòng như trước.
- Trợ lý AI: gỡ `draftAnswer` và mẫu lời nhắc gợi ý trả lời câu hỏi; kiểu `answer` chỉ còn trong ràng buộc cơ sở dữ liệu hệ thống và nhãn lịch sử của cổng trường.
- Lớp video: gỡ phòng của buổi gia sư, ghi hình, danh sách và phát bản ghi, đồng ý ghi hình, việc nền xóa bản ghi hết hạn, điểm cuối `children/:id/video`, `student/video`. Giữ cấu hình của trường (số người dự tối đa), phòng tức thời, phút người dự theo gói, bộ nối máy chủ video, `video/webhook` và phần mở rộng cho giờ học trực tuyến (DT-28 phần 28g). Nhóm `/video` chuyển sang quyền `P02.learning.teach`, `P02.learning.decide` và gói `online-learning`.
- Cổng trường: gỡ nhóm menu "Gia sư trực tuyến" và năm trang; thẻ cấu hình lớp video chuyển sang trang 9.3 Hình thức và nội quy dạy học trực tuyến (Ban Giám hiệu). Lối tắt Truy cập nhanh tới trang đã gỡ không hiện, lần lưu sau bỏ hẳn.
- Ứng dụng giáo viên bỏ màn hình và nút "Gia sư trong trường"; ứng dụng phụ huynh bỏ mục "Gia sư" (khóa học, câu hỏi, lớp video theo buổi); ứng dụng học sinh bỏ khóa học, câu hỏi và lớp video của chương trình gia sư.
- Gói dùng chung: gỡ `PERMISSION_CODES.tutoringManage`, `tutoringTeach`, tệp `tutoring.ts`, `tutoring-fees.ts`, quy tắc menu, mục Truy cập nhanh, tính năng theo cấp `school_tutoring`, văn bản đồng ý ghi hình; `packages/ui` bỏ `VideoRecordingList` và thuộc tính `recordingLocked`.
- Kiểm thử: gỡ kiểm thử của mã đã bỏ (`apps/api/src/tutoring/*.test.ts`, kịch bản giao diện 190, 191, 192); viết lại kịch bản máy chủ CT-27a-3 đến CT-27a-6 theo phần video còn lại; sửa kiểm thử cây menu theo cấp và kiểm thử mở danh mục.

#### Quyết định

- Mã phân hệ gói `tutoring` giữ là mã đã bỏ: gói và tính năng riêng của trường đã lưu mã này vẫn sửa lại được, mã không hiện để chọn, không còn là tính năng trả phí. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Bảng dữ liệu, kiểu bảng ở `database/school-year/schema.ts` và quyền ở cơ sở dữ liệu định danh giữ nguyên đến lát L3.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-384, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lát L3 (database migration xóa bảng gia sư, bảng bản ghi video, quyền `P02.tutoring.*` kèm lệnh sao lưu), L4 (đánh dấu chức năng đã bỏ ở tài liệu).
- Giới hạn dung lượng bản ghi video của gói (`video_max_recording_mb`) còn ở cổng nền tảng nhưng không còn chức năng nào dùng.

### 2026-10-30 — Tách Chợ gia sư thành sản phẩm riêng, lát L1: gỡ mã chợ khỏi School Management (YCTD-384)

#### Công việc đã thực hiện

- Chợ gia sư chuyển sang kho riêng tư `luckyshopvn/cho-gia-su` (máy chủ, cơ sở dữ liệu, đăng nhập, ứng dụng quản trị riêng; dữ liệu bắt đầu trống). Kho mới chạy được trên máy, kiểm thử máy chủ và kiểm thử đầu cuối của chợ đạt ở kho mới.
- Gỡ khỏi School Management: `apps/market`, `packages/market-client`, `apps/api/src/market`, tệp đăng ký phần `dt-27f` đến `dt-27j`, `yctd-364-danh-gia-tai-khoan`, năm trang chợ và mục menu "Chợ gia sư" của cổng vận hành, liên kết hồ sơ con với chợ ở ứng dụng phụ huynh (`ChildMarketLink`, điểm cuối `children/:id/market-link`), chuyển sự kiện phòng `market-` ở `video/webhook`, quyền vận hành `market.*`, cấu hình `MARKETPLACE_DATABASE_URL`, `MARKET_LINK_SECRET`, `MARKET_IDENTITY_*`, `MARKET_FILES_KEY`, `MARKET_JOB_INTERVAL_SECONDS`, đường dẫn không cần trường `/api/v1/market/*`, cơ sở dữ liệu `marketplace` (tệp thay đổi cấu trúc, kiểu bảng, cấp phát, chạy ở lệnh nền tảng và lệnh dựng nhiều trường), `scripts/chuyen-huong-gia-su.mjs`, tên miền `cho-gia-su.`, `gia-su.` trong `scripts/chay-nhieu-truong.mjs`, `MARKET_SITE`, `TUTOR_SITE` của hồ sơ vận hành, `MARKET_HOST`, `TUTOR_HOST` của cổng biên thử nghiệm, Dockerfile, kiểm thử giao diện 195 đến 199 và cấu hình kiểm thử nhiều trường.
- Công cụ sao lưu dữ liệu của chức năng đã bỏ (`database/src/removed-data-backup.ts`): xuất bảng ra tệp nén, mã hóa cùng định dạng bản sao lưu trường (BACKUP_ENCRYPTION_PASSPHRASE), đọc lại kiểm tra số dòng, ghi số dòng và tổng kiểm từng bảng vào `removed_data_backups`; hàm `assertRemovedDataBackedUp` cho database migration xóa bảng.
- Lệnh `pnpm --filter @school-management/database xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su [--xoa-co-so-du-lieu]`: sao lưu mọi bảng của cơ sở dữ liệu chợ kèm cấu hình khóa `market`, ghi nhận ở cơ sở dữ liệu nền tảng, tùy chọn xóa cơ sở dữ liệu và vai trò của chợ.
- Database migration nền tảng 0255: xóa khóa `market` của `platform_settings`, dừng khi khóa còn mà chưa có bản ghi sao lưu chức năng `cho-gia-su`.

#### Quyết định

- Eric ngày 2026-10-30: tách Chợ gia sư ra kho riêng tư, không liên hệ gì với School Management, dữ liệu chợ không chuyển; bỏ hẳn chương trình gia sư trong trường (DT-27) có sao lưu trước khi xóa bảng; School Management chỉ giữ Gia sư AI (YCTD-383).
- Eric duyệt phiếu và danh sách lát; sao lưu bằng lệnh xuất tệp mã hóa, database migration từ chối khi chưa có bản ghi sao lưu; quản trị chợ bằng ứng dụng và tài khoản riêng có TOTP; giữ Mẫu 03 ở chợ.
- Số giữ cho YCTD-384: nền tảng 0255 đến 0259, năm học 0235 đến 0239, định danh 0190 đến 0194, hệ thống 0135 đến 0139. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-384, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lát L2 (gỡ mã chương trình gia sư trong trường), L3 (database migration xóa bảng gia sư kèm lệnh sao lưu), L4 (đánh dấu chức năng đã bỏ ở 07, 08, 10, 11, 14, 16, 17, 21, 27, 47, 48, 49).
- Bản nhiều trường trên máy của Eric có cơ sở dữ liệu `school_marketplace`: chạy lệnh `xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su --xoa-co-so-du-lieu` trước `pnpm database:migrate` nền tảng.

## 24 Yêu cầu thay đổi

### YCTD-384: Tách Chợ gia sư thành sản phẩm riêng, bỏ chương trình gia sư trong trường – 2026-10-30

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
- Mã cũ không xóa, đánh dấu "Đã bỏ (YCTD-384)" ở lát L4.
- Trạng thái: Đã duyệt (Eric, 2026-10-30); lát L1 đã triển khai.

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gỡ Chợ gia sư khỏi School Management, chợ chuyển sang kho riêng (YCTD-384, lát L1).
- Dữ liệu: cần chạy lệnh `xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su` trước database migration nền tảng 0255 ở bản triển khai có cơ sở dữ liệu chợ.
- Phạm vi thay đổi (lát L2): gỡ mã chương trình gia sư trong trường ở máy chủ API, cổng trường, ứng dụng giáo viên, phụ huynh, học sinh; tính học phí không lập dòng thu gia sư; lớp video chỉ còn phòng tức thời, cấu hình và phần dùng chung cho giờ học trực tuyến.
- Dữ liệu (lát L2): không đổi cấu trúc dữ liệu; bảng gia sư và bản ghi video giữ nguyên đến lát L3.
- Quay lui (lát L2): triển khai lại phiên bản trước, dữ liệu không đổi.
- Phạm vi thay đổi (lát L3): database migration năm học 0235 xóa bảng gia sư, bảng ghi hình video, phòng video của buổi gia sư, cột nối của dòng hóa đơn; định danh 0190 gỡ quyền `P02.tutoring.*`; lệnh sao lưu `xoa-du-lieu-da-bo -- --tinh-nang gia-su-trong-truong`.
- Thứ tự triển khai (lát L3): dừng ghi vào trường hoặc chạy trong khung bảo trì; chạy `pnpm --filter @school-management/database xoa-du-lieu-da-bo -- --tinh-nang gia-su-trong-truong` (cần `BACKUP_ENCRYPTION_PASSPHRASE`, `BACKUP_DIR`; nhiều trường cần `PLATFORM_DATABASE_URL`, `PLATFORM_ADMIN_DATABASE_URL`, `PLATFORM_MASTER_KEY` như `platform migrate-schools`); giữ tệp sao lưu ngoài máy chủ; rồi mới chạy database migration các cơ sở dữ liệu năm học (`pnpm database:migrate` hoặc `platform migrate-schools`). Dữ liệu đổi giữa lúc sao lưu và lúc chạy thì 0235 dừng: chạy lại lệnh sao lưu.
- Dữ liệu (lát L3): năm học đã đóng giữ nguyên bảng gia sư (QU-11); hóa đơn đã phát hành giữ dòng gia sư cũ, chỉ mất liên kết tới đơn đăng ký.
- Quay lui (lát L3): database migration 0235 không có bước lùi; triển khai lại phiên bản trước cần dựng lại bảng bằng 0152 đến 0156, 0160, 0161, 0200, 0201 rồi nạp dữ liệu từ tệp sao lưu (`verifyRemovedDataBackup` kiểm tệp, `loadDatabase` của school-data-copy.ts nạp bảng; liên kết hóa đơn, phòng video của buổi lấy từ phần `extra`); quyền định danh dựng lại bằng bước lùi của 0190.
- Quay lui: triển khai lại phiên bản trước; dữ liệu chợ khôi phục từ tệp sao lưu (`verifyRemovedDataBackup` kiểm tệp, nạp bằng `loadDatabase` của school-data-copy.ts vào cơ sở dữ liệu chợ tạo lại bằng phiên bản trước).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gỡ Chợ gia sư khỏi School Management, chợ chuyển sang kho riêng (lát L1); gỡ mã gia sư trong trường (lát L2); xóa bảng gia sư kèm sao lưu (lát L3) | YCTD-384 |
