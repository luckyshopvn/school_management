---
yctd: YCTD-232
tieu_de: DT-26 phần 26b: thông báo đẩy Web Push, phần máy chủ
ngay: 2026-10-26
phien_ban_de_xuat: 0.148.0
---

## 02 Nhật ký

### 2026-10-26 — DT-26 phần 26b: thông báo đẩy Web Push, phần máy chủ

#### Công việc đã thực hiện

- Đọc mục 18 của `32` (26b), mã hàng đợi thông báo (`queueNotification`, `notification-dispatcher.ts`), khóa theo trường (S1a, S3), bộ lập lịch (S1b).
- Làm phần máy chủ: kênh `push`, bộ nối `PushSender`, đăng ký theo máy, tuỳ chọn theo nhóm, khóa VAPID, điểm cuối API, lệnh dòng lệnh, kiểm thử đơn vị và e2e 182.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: dùng thư viện `web-push` 3.6.7 thay vì tự viết mã hóa RFC 8291; tám nhóm loại ánh xạ theo tiền tố mã loại; loại khẩn lưu ở `notification_urgent_templates`; tối đa 20 máy mỗi người; kênh đẩy chỉ cho người nhận là tài khoản cụ thể ở phần này.
- Phiên điều phối: mở PR phần máy chủ trước, phần giao diện sau khi 26a (PR 185) gộp.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-232, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Kết quả kiểm thử

- `apps/api`: `notifications/push/push.test.ts` 6/6 (CT-26b-1 đến CT-26b-6); cùng `notification-dispatcher.test.ts`, `integrations.test.ts`, `notifications.test.ts`, ma trận cách ly (`tenancy-matrix.test.ts`, `tenancy.test.ts`): 27/27.
- Kiểm tĩnh đa thuê bao, quét bí mật: đạt. Typecheck, lint, định dạng: đạt.
- e2e nhiều trường (giữ khóa `e2e.lock`): 182 1/1 (CT-26b-7); 130, 131 đạt.

#### Vấn đề tồn đọng

- Giao diện cài đặt thông báo và mã nhận đẩy ở service worker: phiên của 26a làm tiếp sau khi PR này gộp.
- Kênh đẩy cho người nhận theo vai trò (`role_code`): chưa làm.
- Thử trên máy thật (iOS 16.4 trở lên đã cài, Android Chrome): điều kiện ra của đợt 1.

## 24 Yêu cầu thay đổi

### YCTD-232: DT-26 phần 26b: thông báo đẩy Web Push, phần máy chủ – 2026-10-26

- Lý do: phần 26b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 18 (kế hoạch DT-26, YCTD-230). Phiên điều phối giao làm phần máy chủ trước; phần giao diện (màn hình "Cài đặt thông báo" ở ứng dụng giáo viên, phụ huynh và mã nhận đẩy ở service worker `packages/pwa/src/push/`) nối sau khi 26a (PR 185) gộp, ở PR tiếp theo.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Kênh `push`** của hàng đợi thông báo chung (năm học 0140: `NotificationChannel`, ràng buộc `channel`, `delivered_via`): tiến trình `notification-dispatch` khi xử lý dòng `in_app` của một tài khoản cụ thể có máy đăng ký đẩy còn hiệu lực và chưa tắt nhóm của loại thì thêm dòng kênh `push`; dòng `push` gửi tới mọi máy của người đó qua `PushSender`, cùng khóa dòng, thử lại 15 phút tối đa 5 lần; không tính vào giới hạn 5 tin nhắn mỗi ngày; cùng người, cùng nhóm đã đẩy trong `PUSH_COALESCE_MINUTES` (mặc định 5) phút thì gộp (ghi `limited`). Người nhận theo vai trò (không phải tài khoản cụ thể) chưa có kênh đẩy ở phần này.
  - **Bộ nối `PushSender`** (`apps/api/src/notifications/push/push-sender.ts`): `web-push` (thư viện `web-push` 3.6.7: RFC 8030, mã hóa RFC 8291, VAPID RFC 8292) và `development` (giả lập, ghi trong bộ nhớ và tệp `PUSH_DEVELOPMENT_OUTBOX`); chọn bằng `PUSH_PROVIDER` qua bảng ánh xạ, không có `if` theo nhà cung cấp trong mã nghiệp vụ; chừa `fcm`, `apns` cho 26g; dịch vụ đẩy báo 404, 410 thì thu hồi đăng ký.
  - **Đăng ký theo máy** (hệ thống 0091 `push_subscriptions`): người dùng, ứng dụng (`teacher`, `parent`, `student`), loại (`web_push`, chừa `fcm`, `apns`), địa chỉ đăng ký và khóa nhận mã hóa bằng khóa của trường, mã băm có khóa chống trùng, nguồn gốc, nhãn máy ngắn, lần thấy gần nhất, số lần lỗi, thu hồi kèm lý do (`user`, `logout`, `reassigned`, `expired`, `stale`, `device-limit`); một địa chỉ còn hiệu lực chỉ thuộc một người (máy dùng chung đổi người thì thu hồi đăng ký cũ); tối đa 20 máy mỗi người; không thấy quá `PUSH_SUBSCRIPTION_RETENTION_DAYS` (mặc định 90, GD-126) ngày thì dọn.
  - **Tuỳ chọn theo nhóm** (hệ thống 0092 `notification_preferences`, `notification_urgent_templates`): tám nhóm cố định ánh xạ từ `template_code` theo tiền tố (điểm danh và đón trả, học phí, sức khỏe và thuốc, học tập và điểm, thi trực tuyến, tin nhắn, công việc của cán bộ, thông báo chung); mặc định bật, chỉ áp cho kênh đẩy; loại do quản trị trường (P01.setting.manage) đánh dấu khẩn không tắt được.
  - **Nội dung đẩy** (`push-groups.ts`): tiêu đề theo nhóm và tên trường, một câu chung, mã thông báo; không lấy tiêu đề, nội dung gốc (không có họ tên, số tiền, điểm, sức khỏe) (GD-122).
  - **Khóa VAPID** (nền tảng 0230 `platform_push_keys`): một cặp khóa của nền tảng, khóa riêng mã hóa bằng khóa gốc; lệnh `platform generate-vapid-keys --subject mailto:<thư>` (thay khóa đang dùng, đăng ký cũ phải đăng ký lại) và `--print-only` cho bản một trường (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); không ghi khóa vào kho.
  - **API:** `GET /public/push/vapid-public-key`; `GET, POST /push/subscriptions`, `POST /push/subscriptions/unsubscribe` (ứng dụng gọi khi đăng xuất), `DELETE /push/subscriptions/:id`; `GET, PUT /push/preferences`; `GET, PUT /push/urgent-templates`.
  - Cấu hình: `PUSH_PROVIDER` (`development` bị chặn khi `NODE_ENV=production`), `VAPID_*`, `PUSH_DEVELOPMENT_OUTBOX`, `PUSH_COALESCE_MINUTES`, `PUSH_SUBSCRIPTION_RETENTION_DAYS`. Chưa đặt `PUSH_PROVIDER` thì không có kênh đẩy, mọi thứ như cũ.
  - Tài liệu: tệp mảnh này (`01`, `02`, `23`, `24` khi gom), `16` (mục 18F), `17` (điểm cuối mới), `32` (tiến độ 26b).
  - Kiểm thử: e2e `182-push-isolation.spec.ts` ở dự án nhiều trường (`MULTI_TENANT_SPEC` thêm 182), `playwright.multi.config.ts` bật bộ giả lập đẩy ghi ra tệp.
- Thành phần bị ảnh hưởng: `database/school-year` (0140, schema), `database/system` (0091, 0092, schema), `database/platform` (0230, schema), `database/src/push-keys.ts`, `platform-command.ts`; `apps/api` (`notifications/push/`, `notification-dispatcher.ts`, `application.module.ts`, `common/configuration.ts`, `tenancy-route-policy.ts`, `test-support.ts`, phụ thuộc `web-push`); `tests` (spec 182, `e2e-multi-environment.mjs`, `playwright.multi.config.ts`); `.gitignore`.
- Dữ liệu bị ảnh hưởng: ba bảng mới ở cơ sở dữ liệu hệ thống của trường, một bảng ở nền tảng; ràng buộc kênh ở `notification_recipients`.
- API bị ảnh hưởng: thêm các điểm cuối ở trên; không đổi điểm cuối cũ.
- Giao diện bị ảnh hưởng: chưa (màn hình "Cài đặt thông báo" và mã nhận đẩy ở service worker ở PR nối sau 26a).
- Quyền bị ảnh hưởng: `P01.setting.manage` đánh dấu loại khẩn; mỗi người chỉ đọc, gỡ máy của mình.
- Ảnh hưởng chức năng cũ: không; người chưa đăng ký đẩy hoặc bản chưa đặt `PUSH_PROVIDER` không có dòng kênh `push`.
- Kiểm thử cần thực hiện: `apps/api` `notifications/push/push.test.ts` (CT-26b-1 đến CT-26b-6), `notification-dispatcher.test.ts`, ma trận cách ly của API; e2e 182 (CT-26b-7) ở dự án nhiều trường; typecheck, lint, định dạng.
- Trạng thái: Đã triển khai (phần máy chủ)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-26

- Phạm vi thay đổi: DT-26 phần 26b, thông báo đẩy Web Push, phần máy chủ (YCTD-232).
- Chức năng mới: kênh `push` của hàng đợi thông báo chung; bộ nối `PushSender` (`web-push`, `development`); đăng ký đẩy theo máy mã hóa bằng khóa của trường; tuỳ chọn tắt theo tám nhóm loại, loại khẩn không tắt được; gộp đẩy cùng nhóm trong 5 phút; khóa VAPID của nền tảng và lệnh `platform generate-vapid-keys`.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học 0140 (kênh `push`); hệ thống 0091 `push_subscriptions`, 0092 `notification_preferences`, `notification_urgent_templates`; nền tảng 0230 `platform_push_keys`.
- Thay đổi API: `/public/push/vapid-public-key`, `/push/subscriptions`, `/push/subscriptions/unsubscribe`, `/push/subscriptions/{id}`, `/push/preferences`, `/push/urgent-templates`; biến `PUSH_PROVIDER`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_DEVELOPMENT_OUTBOX`, `PUSH_COALESCE_MINUTES`, `PUSH_SUBSCRIPTION_RETENTION_DAYS`.
- Kiểm thử: CT-26b-1 đến CT-26b-7 trong mã kiểm thử. Kết quả ghi ở `02_NHAT_KY_DU_AN.md` mục cùng ngày.
- Rủi ro: nội dung đẩy đi qua máy chủ của nhà cung cấp trình duyệt ở nước ngoài (chỉ tiêu đề nhóm và tên trường); người nhận theo vai trò chưa có kênh đẩy; giao diện bật đẩy chờ 26a.
- Khả năng tương thích: chưa đặt `PUSH_PROVIDER` hoặc người chưa đăng ký đẩy thì như cũ.
- Phương án quay lui: bỏ `PUSH_PROVIDER` để ngừng kênh đẩy không cần quay lui mã; hoàn lại commit gộp để bỏ cả tính năng.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-26 phần 26b: thông báo đẩy Web Push, phần máy chủ (kênh push của hàng đợi chung, bộ nối web-push và giả lập, đăng ký theo máy mã hóa bằng khóa của trường, tuỳ chọn tắt theo nhóm, khóa VAPID của nền tảng) | YCTD-232 |
