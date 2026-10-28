---
yctd: YCTD-300
tieu_de: Tách riêng ứng dụng học sinh khỏi ứng dụng phụ huynh
ngay: 2026-10-28
phien_ban_de_xuat: 0.174.0
---

## 02 Nhật ký

### 2026-10-28 — Tách riêng ứng dụng học sinh

#### Công việc đã thực hiện

- Dựng ứng dụng web `apps/student` (Vite, React, `packages/ui`, `packages/pwa`) cùng kiểu với ứng dụng giáo viên, phụ huynh. Chuyển bằng `git mv` (giữ lịch sử) toàn bộ màn hình học sinh từ `apps/parent/src/student/`: đăng nhập, đặt mật khẩu mới, thi trực tuyến có giám thị camera, bài tập, SCORM, thảo luận lớp, lớp video, hỏi đáp gia sư, khoá học ghi sẵn, học khi mạng yếu (IndexedDB), cùng `student-api.ts`, `student-session.tsx` và mô hình nhận diện khuôn mặt ở `public/models`.
- Phần dùng chung của hai ứng dụng: danh sách huy hiệu, chứng nhận (`RecognitionList`) chuyển sang `packages/ui`.
- Ứng dụng học sinh có manifest riêng (tên "… – Học sinh", mở thẳng gốc của ứng dụng), service worker riêng (tiền tố bộ nhớ đệm `hoc-sinh-v-`), đăng ký thông báo đẩy `usePushSync('student')` theo phạm vi của mình.
- Ứng dụng phụ huynh bỏ nhánh `#hoc-sinh`. Địa chỉ cũ `<ứng dụng phụ huynh>#hoc-sinh` (thẻ QR, liên kết kích hoạt, lối tắt đã cài) chuyển sang ứng dụng học sinh trước khi dựng ứng dụng phụ huynh; liên kết "Học sinh làm bài thi trực tuyến" ở màn hình đăng nhập phụ huynh trỏ thẳng sang ứng dụng học sinh, liên kết "Ứng dụng phụ huynh" ở màn hình đăng nhập học sinh trỏ ngược lại.
- Chạy thật: ảnh `web` dựng ứng dụng học sinh với đường dẫn gốc `/hoc-sinh/`, Caddy phục vụ ở `/hoc-sinh/` của tên miền phụ huynh (`deploy/caddy`, bản một trường của hồ sơ vận hành) và của tên miền trường khi `TENANT_PATHS=on`; trang học sinh mở quyền camera, micro của chính trang (giám thị camera 23e, lớp video 27a), các trang khác giữ chính sách chặt như cũ. Hồ sơ thử nghiệm: `build-assets.sh` dựng thêm `hoc-sinh`, cổng biên Cloudflare và proxy Vercel 3b nhận tiền tố `/hoc-sinh`.
- Máy chủ API: manifest `student` mở thẳng gốc của ứng dụng (bỏ `#hoc-sinh`). Dịch vụ định danh không đổi: kênh `student`, cookie làm mới riêng, xác thực địa chỉ quay về theo tên miền của yêu cầu nên ứng dụng ở cùng tên miền không cần khai thêm. CSP của tệp SCORM lấy `frame-ancestors` từ nguồn gốc trang mở gói nên tự đúng với ứng dụng mới.
- Cổng phát triển 5179, cổng e2e 5379 (chưa ứng dụng nào dùng). Vỏ ứng dụng `apps/mobile` không mở màn hình học sinh; chỉ thêm cổng 5179 vào danh sách điều hướng được và chuyển cổng khi chạy máy giả lập.
- Kiểm thử giao diện có học sinh (150, 154, 181, 212, 214, 217, 218, 219) mở thẳng ứng dụng học sinh; 181 kiểm địa chỉ cũ `#hoc-sinh` chuyển sang ứng dụng mới, manifest và service worker riêng; 180 đo thêm trang đăng nhập học sinh theo khổ thiết bị (chạy ở `kiem-thu-thiet-bi`).

#### Quyết định

- Anh Eric quyết định ngày 2026-10-28 tách riêng ứng dụng học sinh, thay ghi chú cũ của DT-23 phần 23a "không dựng ứng dụng thứ tư" (QĐ-45).
- Ứng dụng học sinh nằm ở `/hoc-sinh/` cùng tên miền với ứng dụng phụ huynh thay vì tên miền con riêng: địa chỉ cũ chuyển hướng được trong cùng tên miền, cookie kênh `student` vẫn là cookie cùng tên miền, không cần biến môi trường mới khi triển khai.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-300, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Đăng ký đẩy của học sinh tạo trước khi tách gắn với service worker của ứng dụng phụ huynh: chạm thông báo mở ứng dụng phụ huynh; học sinh muốn nhận đẩy ở ứng dụng mới thì bật lại ở mục thông báo của ứng dụng học sinh.
- Hồ sơ vận hành bật `TENANT_PATHS=on` vẫn chờ S1b dựng các ứng dụng khác với đường dẫn gốc riêng; ứng dụng học sinh đã dựng sẵn với `/hoc-sinh/`.

## 24 Yêu cầu thay đổi

### YCTD-300: Tách riêng ứng dụng học sinh khỏi ứng dụng phụ huynh – 2026-10-28

- Lý do: anh Eric quyết định ngày 2026-10-28 tách riêng ứng dụng cho học sinh; màn hình học sinh (khoảng 19 tệp: thi trực tuyến có giám thị camera, SCORM, lớp học trực tuyến, ngoại tuyến bằng IndexedDB, video, hỏi đáp gia sư) đã lớn, dùng kênh đăng nhập và cookie riêng, phải đổi manifest khi vào `#hoc-sinh`.
- Nội dung thay đổi: ứng dụng `apps/student` ở `/hoc-sinh/`; ứng dụng phụ huynh bỏ nhánh `#hoc-sinh`, địa chỉ cũ chuyển sang ứng dụng mới; `RecognitionList` sang `packages/ui`; manifest, service worker, đăng ký đẩy riêng; ảnh `web`, Caddy, hồ sơ thử nghiệm, kiểm thử giao diện cập nhật theo.
- Thành phần bị ảnh hưởng: `apps/student`, `apps/parent`, `packages/ui`, `packages/pwa` (chú thích), `apps/api/src/school-settings/pwa-manifest.ts`, `apps/portal` (câu hướng dẫn ở thi trực tuyến), `apps/mobile`, `deploy/docker/*.Dockerfile`, `deploy/caddy/Caddyfile`, `deploy/profiles/production/caddy/`, `deploy/profiles/trial/`, `tests/playwright.config.ts`, `tests/e2e-environment.mjs`, các spec e2e có học sinh.
- Dữ liệu, API, quyền bị ảnh hưởng: không đổi dữ liệu, quyền; manifest `student` đổi `start_url` sang gốc của ứng dụng học sinh.
- Ảnh hưởng chức năng cũ: thẻ QR, liên kết kích hoạt, lối tắt đã cài mở `#hoc-sinh` vẫn tới màn hình học sinh qua chuyển hướng; bộ nhớ ngoại tuyến IndexedDB của 28j gắn với nguồn gốc nên bài làm lưu trên máy trước khi tách mà chưa gửi chỉ còn ở nguồn gốc cũ khi ứng dụng học sinh chạy ở nguồn gốc khác (khi phát triển); chạy thật cùng nguồn gốc nên giữ nguyên.
- Kiểm thử cần thực hiện: kiểm kiểu, quy tắc viết mã, kiểm thử đơn vị ba ứng dụng web; dựng ảnh `web` và kiểm cấu hình Caddy; kiểm thử giao diện 150, 154, 180, 181, 212, 214, 217, 218, 219.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: tách riêng ứng dụng học sinh `apps/student` khỏi ứng dụng phụ huynh (YCTD-300).
- Địa chỉ cũ `#hoc-sinh` của ứng dụng phụ huynh chuyển sang `/hoc-sinh/`; manifest, service worker, đăng ký đẩy riêng.
- Ảnh `web` và Caddy phục vụ `/hoc-sinh/`; trang học sinh mở quyền camera, micro của chính trang.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Tách riêng ứng dụng học sinh khỏi ứng dụng phụ huynh | YCTD-300 |

## Thêm dòng

| 12_KIEN_TRUC_HE_THONG.md | cuối bảng 13. Quyết định kiến trúc | QĐ-45 | Tách riêng ứng dụng học sinh (YCTD-300), thay cách đặt màn hình học sinh trong ứng dụng phụ huynh của DT-23 phần 23a: `apps/student` chạy ở `/hoc-sinh/` cùng tên miền với ứng dụng phụ huynh (chuyển hướng địa chỉ cũ `#hoc-sinh` trong cùng tên miền, cookie kênh `student` vẫn cùng tên miền, không thêm biến môi trường); manifest, service worker, đăng ký đẩy riêng; phần dùng chung đưa vào `packages/*`; phương án đã loại: tên miền con riêng cho học sinh (thêm biến `STUDENT_SITE`, địa chỉ cũ phải chuyển khác tên miền) | Đã chốt ngày 2026-10-28 (anh Eric) |
