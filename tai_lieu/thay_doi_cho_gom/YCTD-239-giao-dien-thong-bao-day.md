---
yctd: YCTD-239
tieu_de: DT-26 phần 26b, phần giao diện: thông báo đẩy trên ứng dụng giáo viên, phụ huynh, học sinh
ngay: 2026-10-26
phien_ban_de_xuat: 0.153.0
---

## 02 Nhật ký

### 2026-10-26 — DT-26 phần 26b, phần giao diện: thông báo đẩy trên ứng dụng giáo viên, phụ huynh, học sinh

#### Công việc đã thực hiện

- Service worker dùng chung (`packages/pwa/service-worker.js`) nhận đẩy: hiện thông báo từ tiêu đề, nội dung, nhóm của máy chủ; chạm thông báo đưa ứng dụng đang mở lên trước hoặc mở trang đầu; trình duyệt đổi đăng ký thì báo trang đăng ký lại.
- `packages/pwa/src/push/`: xét trạng thái đẩy của máy, đăng ký, hủy, đồng bộ, thu hồi khi đăng xuất; khối "Cài đặt thông báo" (`PushSettings`, `PushSettingsPanel`) và móc `usePushSync`.
- Nối vào ứng dụng giáo viên (Lớp của tôi), phụ huynh (trang chủ), màn hình học sinh (danh sách bài); đăng xuất ở ba nơi thu hồi đăng ký trước khi xóa phiên.
- Kiểm thử: `packages/pwa` 15/15 (trạng thái đẩy, khóa VAPID, nhãn máy, sự kiện push, notificationclick, pushsubscriptionchange của service worker); e2e spec 187 (giao diện cài đặt thông báo) chạy trên máy cùng phần máy chủ của PR 191.

#### Quyết định

- Kiểm phần nhận đẩy của service worker bằng kiểm thử đơn vị chạy tệp mẫu trong môi trường giả lập của Node: Chromium chạy ẩn của e2e không hiện thông báo hệ thống (đã thử gửi đẩy qua giao thức gỡ lỗi).
- Một phạm vi service worker chỉ có một đăng ký đẩy nên ứng dụng phụ huynh và màn hình học sinh trên cùng máy chỉ một người nhận, người bật sau cùng.
- Ứng dụng giáo viên chỉ có service worker khi trường bật ngoại tuyến (GD-108 giữ nguyên); trường tắt thì khối cài đặt báo chưa sẵn sàng, không tự đăng ký service worker riêng cho đẩy.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-239, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-244, P19-08, AC-891, AC-892, CT-1120, CT-1121, MH-355, BM-104, mục 12H.

#### Vấn đề tồn đọng

- Phụ thuộc phần máy chủ ở PR 191 (YCTD-232): gộp PR 191 trước PR này. Thử đẩy thật trên máy (Android Chrome, iPhone đã cài) khi Eric bật khóa VAPID ở môi trường thử.

## 24 Yêu cầu thay đổi

### YCTD-239: DT-26 phần 26b, phần giao diện: thông báo đẩy trên ứng dụng giáo viên, phụ huynh, học sinh – 2026-10-26

- Lý do: phần 26b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 18.3, 18.4; phần máy chủ ở YCTD-232 (PR 191); phiên điều phối giao phần giao diện cho phiên chủ DT-26 ngày 2026-10-26. Số YCTD-239 lấy ở dải dự phòng của DT-26.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Service worker chung**: sự kiện `push` hiện thông báo (tiêu đề, nội dung, nhóm của máy chủ; tin rỗng, hỏng hiện "Thông báo mới"; chỉ giữ mã thông báo, bỏ địa chỉ trong tin); `notificationclick` đưa cửa sổ trong phạm vi lên trước và gửi `PUSH_OPENED`, không có thì mở trang đầu của ứng dụng; `pushsubscriptionchange` báo trang đăng ký lại.
  - **Thư viện `packages/pwa/src/push/`**: trạng thái đẩy (`unsupported`, `needs-install`, `no-service-worker`, `server-disabled`, `denied`, `off`, `on`); chờ service worker sẵn sàng tối đa 5 giây; bật chỉ khi người dùng bấm; gửi nhãn máy ngắn thay chuỗi nhận dạng trình duyệt; đồng bộ đăng ký khi mở ứng dụng và khi trình duyệt đổi đăng ký; thu hồi khi đăng xuất.
  - **Giao diện**: nút "Cài đặt thông báo" ở Lớp của tôi (giáo viên), trang chủ (phụ huynh), danh sách bài (học sinh): bật, tắt trên máy, tắt theo 8 nhóm (đổi ngay khi bấm, lưu ở máy chủ), danh sách máy đã bật và nút Gỡ, câu giải thích theo trạng thái (iPhone chưa cài thì hướng dẫn cài thay cho nút bật).
- Thành phần bị ảnh hưởng: `packages/pwa`, `apps/teacher`, `apps/parent` (phụ huynh, học sinh), `tests` (spec 187). Không đổi máy chủ, cơ sở dữ liệu.
- Dữ liệu bị ảnh hưởng: không (bảng của phần máy chủ YCTD-232).
- API bị ảnh hưởng: không thêm; dùng `/api/v1/public/push/vapid-public-key`, `/api/v1/push/subscriptions`, `/api/v1/push/subscriptions/unsubscribe`, `/api/v1/push/subscriptions/{id}`, `/api/v1/push/preferences` của YCTD-232.
- Giao diện bị ảnh hưởng: MH-355.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không đổi hành vi; người không mở "Cài đặt thông báo" không thấy khác ngoài một nút; công tắc ngoại tuyến của ứng dụng giáo viên (GD-108) giữ nguyên.
- Kiểm thử cần thực hiện: `packages/pwa` (CT-1120), e2e spec 187 (CT-1121) cùng spec 151, 181; typecheck, lint.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-26

- Phạm vi thay đổi: DT-26 phần 26b, phần giao diện của thông báo đẩy (YCTD-239).
- Chức năng mới: service worker chung nhận đẩy và mở ứng dụng khi chạm; khối "Cài đặt thông báo" ở ứng dụng giáo viên, phụ huynh, màn hình học sinh (P19-08, MH-355).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không.
- Thay đổi API: không (dùng API của YCTD-232).
- Kiểm thử: CT-1120 (`packages/pwa` 15/15), CT-1121 (e2e spec 187). Kết quả ngày 26/10/2026 trên máy, cùng phần máy chủ của PR 191: e2e spec 01 đến 09, 151, 181 đạt; spec 187 đạt phần giao diện (phần gửi đẩy qua giao thức gỡ lỗi bỏ vì Chromium chạy ẩn không hiện thông báo, chuyển sang kiểm thử đơn vị).
- Rủi ro: chưa thử đẩy thật trên máy (cần khóa VAPID ở môi trường thử); ứng dụng giáo viên của trường tắt ngoại tuyến không bật được đẩy.
- Khả năng tương thích: không đổi hành vi cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh; không có thay đổi dữ liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-26 phần 26b, phần giao diện: service worker nhận đẩy, cài đặt thông báo đẩy ở ứng dụng giáo viên, phụ huynh, học sinh | YCTD-239 |
