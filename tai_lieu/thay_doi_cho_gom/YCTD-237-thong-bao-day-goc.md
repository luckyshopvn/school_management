---
yctd: YCTD-237
tieu_de: DT-26 phần 26g: thông báo đẩy gốc FCM, APNs cho ứng dụng cài đặt (phần mã)
ngay: 2026-10-27
phien_ban_de_xuat: 0.170.0
---

## 02 Nhật ký

### 2026-10-27 — DT-26 phần 26g: thông báo đẩy gốc FCM, APNs cho ứng dụng cài đặt (phần mã)

#### Công việc đã thực hiện

- Máy chủ API: bộ nối `fcm` (Firebase Cloud Messaging HTTP v1, tài khoản dịch vụ ký JWT RS256 đổi mã truy cập OAuth) và `apns` (HTTP/2, khóa `.p8` ký JWT ES256) của `PushSender`; bộ định tuyến chọn bộ nối theo loại đăng ký (`web_push`, `fcm`, `apns`); biến PUSH_NATIVE_PROVIDER (`native`, `development`), tệp khóa cho bản một trường (FCM_SERVICE_ACCOUNT_FILE, APNS_KEY_FILE, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_ENVIRONMENT).
- Đăng ký mã thiết bị qua cùng điểm cuối của 26b: `POST /push/subscriptions` nhận `kind` (`fcm`, `apns`), `token`, `origin` (địa chỉ gốc của ứng dụng web của trường); `unsubscribe` nhận `kind`, `token`; `GET /public/push/vapid-public-key` trả thêm `native` (máy chủ có khóa cho FCM, APNs chưa). Nội dung đẩy kèm `app_url` là địa chỉ gốc lúc đăng ký.
- Cơ sở dữ liệu nền tảng 0232 `platform_native_push_keys`: khóa FCM, APNs của nền tảng lưu mã hóa bằng khóa gốc; lệnh `platform set-native-push-key`, `retire-native-push-key`.
- `packages/pwa`: `native-push.ts` (xin quyền, lấy mã thiết bị qua plugin PushNotifications, gửi, thu hồi khi tắt hoặc đăng xuất, lấy lại mã khi mở ứng dụng, chạm thông báo); `push-client.ts` tự chuyển sang đẩy gốc khi chạy trong vỏ; khối Cài đặt thông báo hướng dẫn mở quyền ở cài đặt của máy.
- `apps/mobile`: plugin `@capacitor/push-notifications` 8.1.3; `MainActivity` chèn cầu nối Capacitor kèm riêng plugin đẩy vào trang của các tên miền được phép, báo trang khi bản dựng chưa có cấu hình Firebase; trang khởi động mở đúng ứng dụng của trường đã lưu khi chạm thông báo; iOS chuyển mã thiết bị APNs cho plugin (`AppDelegate.swift`).
- Kiểm thử: `native-push.test.ts` của máy chủ API (máy chủ FCM, APNs giả lập trả mã lỗi thật), `native-push.test.ts` của `packages/pwa`, e2e spec 186 (cách ly mã thiết bị giữa hai trường), sửa spec 182 theo phản hồi khóa công khai mới.

#### Quyết định

- Eric cho làm trước phần mã 26g ngày 2026-10-27 khi chưa có tài khoản nhà phát triển; bộ nối chạy với bộ giả lập, chưa nối FCM, APNs thật, không có khóa, `google-services.json`, `.p8` trong kho (QĐ-43).
- Không cần migration hệ thống 0093: bảng `push_subscriptions` của 26b đã có loại `fcm`, `apns`; mã thiết bị lưu mã hóa ở cột địa chỉ đăng ký.
- Chạy thử trên máy giả lập phát hiện gọi `register` khi bản dựng chưa có `google-services.json` làm ứng dụng dừng (Firebase chưa khởi tạo); vỏ báo trang `DAY_GOC_SAN_SANG = false`, khối Cài đặt thông báo báo hệ thống chưa bật đẩy.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-237, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-405, P19-12, AC-1065, AC-1066, CT-1365, CT-1366, QĐ-43.

#### Vấn đề tồn đọng

- Gửi thật cần Eric: tạo dự án Firebase (thêm ứng dụng Android `vn.schoolmanagement.demo`, tải `google-services.json` đặt vào `apps/mobile/android/app/`, tạo khóa tài khoản dịch vụ rồi nạp bằng `platform set-native-push-key --provider fcm`), tạo khóa APNs `.p8` ở Apple Developer và bật năng lực Push Notifications trong Xcode. iOS chưa dựng được (không có máy Mac). Máy chủ chưa kiểm với FCM, APNs thật.

## 24 Yêu cầu thay đổi

### YCTD-237: DT-26 phần 26g: thông báo đẩy gốc FCM, APNs cho ứng dụng cài đặt (phần mã) – 2026-10-27

- Lý do: phần 26g của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 18 (đợt 3 của DT-26); Eric cho làm trước phần mã ngày 2026-10-27; phiên điều phối cấp phiên bản 0.170.0.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Bộ nối**: FCM HTTP v1 (Android), APNs HTTP/2 với khóa dạng mã thông báo (iOS); cùng bộ phát, nhóm loại, tuỳ chọn tắt, gộp của 26b; nội dung chỉ có nhóm, tên trường, mã thông báo (nội dung FCM, APNs không mã hóa đầu cuối). Mã hết hạn (FCM `UNREGISTERED`, `SENDER_ID_MISMATCH`, mã sai; APNs 410, `BadDeviceToken`, `DeviceTokenNotForTopic`) thì thu hồi đăng ký; lỗi xác thực, quá tải, lỗi máy chủ thì thử lại, lần sau ký lại mã xác thực.
  - **Chọn bộ nối theo loại đăng ký**: Web Push theo PUSH_PROVIDER, FCM, APNs theo PUSH_NATIVE_PROVIDER; thiếu bộ nối hoặc khóa thì bỏ qua máy đó (không tính lỗi), kênh khác chạy như cũ.
  - **Khóa**: một ứng dụng chung cho mọi trường nên khóa ở cơ sở dữ liệu nền tảng, mã hóa bằng khóa gốc, không xuống cơ sở dữ liệu trường; bản một trường đọc tệp khóa theo biến môi trường.
  - **Ứng dụng cài đặt**: xin quyền khi người dùng bấm, gửi mã thiết bị, lấy lại khi mở ứng dụng, thu hồi khi tắt hoặc đăng xuất; chạm thông báo mở ứng dụng của trường đã lưu trên máy, không mở địa chỉ nào khác do nội dung đẩy gửi tới; thông báo đến khi đang mở vẫn hiện trên thanh thông báo của máy.
  - **Không làm**: nối FCM, APNs thật (chờ tài khoản), mở màn hình chi tiết của từng thông báo (cùng mức của Web Push 26b: mở ứng dụng, báo trang tải lại thông báo).
- Thành phần bị ảnh hưởng: `apps/api` (`notifications/push`, cấu hình, tiến trình gửi), `database` (nền tảng 0232, `native-push-keys.ts`, lệnh `platform`), `packages/pwa`, `apps/mobile` (plugin, `MainActivity.java`, `app/build.gradle`, `AppDelegate.swift`, `capacitor.config.ts`, trang khởi động), `tests` (spec 182, 186, cấu hình nhiều trường), `pnpm-lock.yaml`.
- Dữ liệu bị ảnh hưởng: bảng mới `platform_native_push_keys` ở cơ sở dữ liệu nền tảng; `push_subscriptions` của trường có thêm dòng loại `fcm`, `apns`.
- API bị ảnh hưởng: `POST /push/subscriptions`, `POST /push/subscriptions/unsubscribe` nhận thêm `kind`, `token`; `GET /public/push/vapid-public-key` trả thêm `native`.
- Giao diện bị ảnh hưởng: khối Cài đặt thông báo trong ứng dụng cài đặt (dòng hướng dẫn mở quyền ở cài đặt của máy); trang khởi động của vỏ (mở ứng dụng khi chạm thông báo).
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: Web Push trên trình duyệt như cũ; phản hồi khóa công khai thêm trường `native`.
- Kiểm thử cần thực hiện: kiểm thử đơn vị của máy chủ API (CT-1365), `packages/pwa`; e2e spec 186 ở dự án nhiều trường (CT-1366), spec 182; dựng APK và chạy trên máy giả lập.
- Trạng thái: Đã triển khai (phần mã; chưa gửi thật qua FCM, APNs)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-26 phần 26g phần mã, thông báo đẩy gốc FCM, APNs cho ứng dụng cài đặt (YCTD-237).
- Chức năng mới: đẩy gốc tới ứng dụng cài đặt (P19-12): bộ nối FCM, APNs, khóa của nền tảng, đăng ký mã thiết bị, chạm thông báo mở đúng ứng dụng của trường.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: cơ sở dữ liệu nền tảng 0232 `platform_native_push_keys`.
- Thay đổi API: `POST /push/subscriptions`, `/push/subscriptions/unsubscribe` nhận `kind`, `token`; khóa công khai trả thêm `native`.
- Kiểm thử: CT-1365, CT-1366. Kết quả: kiểm thử đơn vị đẩy của máy chủ API (`native-push.test.ts`, `push.test.ts`, `notification-dispatcher.test.ts`) 16/16 đạt; `packages/pwa` 17/17 đạt; typecheck `apps/api`, `database`, `packages/pwa`, `apps/mobile`, `apps/teacher`, `tests`, lint, prettier đạt; e2e spec 186, 182 chạy ở CI (dự án nhiều trường). Chạy thật trên máy giả lập Android ngày 2026-10-27 (APK debug có plugin đẩy, máy chủ API với `PUSH_NATIVE_PROVIDER=development`): trang của trường trong ứng dụng có cầu nối gốc chỉ với plugin PushNotifications, gọi được plugin; bấm Bật thì Android hỏi quyền thông báo; tìm thấy và sửa lỗi ứng dụng dừng khi lấy mã thiết bị lúc bản dựng chưa có `google-services.json` (sau sửa: khối Cài đặt thông báo báo hệ thống chưa bật đẩy). Chưa nhận thông báo thật (chưa có dự án Firebase).
- Rủi ro: chưa gửi qua FCM, APNs thật; trang của trường có cầu nối gốc (chỉ plugin đẩy) nên chỉ khai tên miền trường tin cậy ở `allowNavigation`; một máy có một mã thiết bị nên giáo viên và phụ huynh dùng chung máy, chung trường thì người bật sau cùng nhận đẩy (như Web Push của 26b).
- Khả năng tương thích: Web Push, ứng dụng web trên trình duyệt không đổi; ứng dụng cài đặt cũ (26f) không có plugin đẩy nên trang dùng như trước.
- Phương án quay lui: hoàn lại commit gộp của nhánh; bảng `platform_native_push_keys` để lại không ảnh hưởng.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-26 phần 26g phần mã: thông báo đẩy gốc FCM, APNs cho ứng dụng cài đặt | YCTD-237 |

## index Số đếm

| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | cuối bảng 12.1 Quy tắc về phân cấp phê duyệt | BR-405 | Thông báo đẩy gốc tới ứng dụng cài đặt (YCTD-237, DT-26 phần 26g): ứng dụng chỉ xin quyền thông báo khi người dùng bấm bật; mã thiết bị FCM (Android) hoặc APNs (iOS) gửi về trường đang mở, lưu mã hóa; một mã thiết bị còn hiệu lực chỉ thuộc một người ở mỗi trường; tắt, đăng xuất thì thu hồi; dịch vụ đẩy báo mã hết hạn thì thu hồi; nội dung chỉ có nhóm thông báo, tên trường, không có họ tên, số tiền, nội dung gốc; cùng nhóm loại, tuỳ chọn tắt, loại khẩn, gộp của Web Push; khóa FCM, APNs là của nền tảng, thiếu khóa thì không gửi đẩy gốc, các kênh khác như cũ; chạm thông báo chỉ mở ứng dụng của trường đã lưu trên máy |
| 10_YEU_CAU_CHUC_NANG.md | cuối bảng 20. Phân hệ P19 — Kênh truy cập và thông báo | P19-12 | Thông báo đẩy gốc tới ứng dụng cài đặt (YCTD-237, DT-26 phần 26g) | Giáo viên, phụ huynh; quản trị nền tảng (khóa) | Quyền thông báo của máy, mã thiết bị; tệp khóa FCM, APNs | Bật, tắt đẩy trên máy ở khối Cài đặt thông báo; nhận thông báo đẩy của trường; chạm mở đúng ứng dụng; lệnh nạp, thôi dùng khóa | Thông báo đến máy qua FCM, APNs khi nền tảng có khóa | BR-405 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-1065 | Cho máy chủ FCM, APNs giả lập trả mã lỗi theo tài liệu của Google, Apple / Khi gửi thông báo tới mã bình thường, mã hết hạn, mã sai, khi máy chủ báo lỗi xác thực, quá tải / Thì mã bình thường nhận nội dung không có dữ liệu cá nhân (FCM: mã truy cập từ JWT RS256 ký bằng tài khoản dịch vụ; APNs: JWT ES256 đúng mã khóa, mã đội, tiêu đề `apns-topic`, `apns-push-type`); mã hết hạn, mã sai thì thu hồi; lỗi xác thực, quá tải thì thử lại và lần sau lấy mã xác thực mới; loại chưa có bộ nối hoặc khóa thì bỏ qua | P19-12 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-1066 | Cho trường alpha, beta và một máy Android đăng ký cùng mã FCM ở cả hai trường / Khi beta xem, gỡ đăng ký của alpha và alpha gửi thông báo / Thì beta không thấy, không gỡ được; chỉ đăng ký ở alpha nhận, nội dung kèm địa chỉ ứng dụng của alpha, không có nội dung gốc; đăng xuất ở alpha không ảnh hưởng đăng ký ở beta; khóa FCM của nền tảng lưu mã hóa ở cơ sở dữ liệu nền tảng | P19-12 |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1365 | P19-12 | CT-26g-1 đến CT-26g-5: đọc tệp khóa FCM, APNs; bộ nối FCM, APNs với máy chủ giả lập (mã lỗi thật, ký lại mã xác thực); bộ định tuyến theo loại đăng ký; đăng ký mã thiết bị kiểm tra dữ liệu, lưu mã hóa, gửi qua bộ nối theo loại kèm địa chỉ ứng dụng, hết hạn thì thu hồi, đăng xuất thu hồi | Đúng | Đạt; `apps/api/src/notifications/push/native-push.test.ts`, `packages/pwa/src/push/native-push.test.ts`; AC-1065 | Cao |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1366 | P19-12 | CT-26g-6: cách ly mã thiết bị đẩy gốc giữa hai trường, khóa FCM của nền tảng lưu mã hóa | Đúng | e2e spec 186 (`tests/e2e/186-native-push-isolation.spec.ts`, dự án nhiều trường); AC-1066 | Cao |
