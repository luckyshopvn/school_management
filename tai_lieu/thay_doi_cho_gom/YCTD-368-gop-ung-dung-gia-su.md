---
yctd: YCTD-368
tieu_de: Gộp ứng dụng Gia sư vào Chợ gia sư, phân quyền theo loại tài khoản
ngay: 2026-10-29
phien_ban_de_xuat: 0.248.0
---

## 02 Nhật ký

### 2026-10-29 — Gộp ứng dụng Gia sư vào Chợ gia sư

#### Công việc đã thực hiện

- Thêm GD-181, E-11 và mục 19.15 vào tài liệu 32; sửa bảng địa chỉ ở 16.10 và dòng Chợ gia sư ở tài liệu 34.
- Gộp `apps/tutor` vào `apps/market`, xóa `apps/tutor`:
  - các màn của gia sư chuyển sang `apps/market/src/tutor/`;
  - ứng dụng chung hiện bộ màn theo loại tài khoản của phiên: phụ huynh có thanh điều hướng ở đầu trang, gia sư có cột bên trái;
  - đăng ký có ô chọn "Phụ huynh tìm gia sư cho con" hoặc "Gia sư, kể cả giáo viên dạy kèm ngoài trường"; trang giới thiệu có nút "Đăng ký làm gia sư";
  - đăng nhập bằng định danh và lượt quay về `/dinh-danh`, `/xac-minh` gom về một chỗ;
  - ứng dụng chung cài được (PWA, manifest và biểu tượng chuyển từ ứng dụng Gia sư).
- Máy chủ API:
  - `MarketContext.assertMarketHost` chỉ nhận tên miền của chợ, không suy vai từ tên miền;
  - bỏ chặn đăng ký, đăng nhập mật khẩu, quên mật khẩu, đăng nhập định danh theo tên miền;
  - mỗi điểm cuối riêng của một vai vẫn kiểm loại tài khoản (`requireReady`, 403 khi sai loại);
  - mục đích định danh lấy theo loại tài khoản: gia sư xác minh, quay về `/xac-minh`; phụ huynh liên kết, quay về `/dinh-danh`; đăng nhập quay về `/dinh-danh`;
  - `/public/site` bỏ `tutor_url`, `application`.
- Cấu hình chợ: `tutor_host` không còn bắt buộc, chỉ ghi tên miền cũ. Trang Chợ gia sư của cổng vận hành đổi nhãn ô này.
- Tên miền cũ `gia-su.` chuyển 308 về chợ, giữ đường dẫn và truy vấn:
  - `scripts/chuyen-huong-gia-su.mjs` cho máy phát triển và e2e; `/sw.js` trả service worker tự gỡ;
  - `scripts/chay-nhieu-truong.mjs` mở bộ chuyển hướng ở cổng 5196 thay cho vite của ứng dụng Gia sư;
  - Caddy (`marketplace.caddy.example`, khối `TUTOR_SITE`) và Worker của hồ sơ thử nghiệm (`TUTOR_HOST`).
- Dockerfile ảnh web, ảnh máy chủ, ảnh gộp thử nghiệm và tập lệnh dựng tệp tĩnh Cloudflare bỏ `apps/tutor`; README bỏ dòng `apps/tutor`.
- Kiểm thử:
  - máy chủ CT-368-1: phiên gia sư dùng ở tên miền chung, tên miền cũ 404, sai loại tài khoản 403; các kiểm thử chợ gọi gia sư ở tên miền chung;
  - kiểm thử cấu hình chợ; kiểm thử Worker (tên miền cũ chuyển 308);
  - e2e CT-368-2 (spec 195): tên miền cũ chuyển hướng về chợ, gia sư đăng ký ở chợ và thấy bộ màn của gia sư, phụ huynh không thấy màn của gia sư; spec 196 đến 199 chạy trên tên miền chung.

#### Quyết định

- GD-181 theo yêu cầu của Eric ngày 2026-10-29 ("gộp 2 ứng dụng gia sư lại làm 1 … phân quyền cho phù hợp"): một ứng dụng, một tên miền; quyền theo loại tài khoản ở máy chủ. Thay quyết định tách ứng dụng của YCTD-262.
- Một người có cả hai vai: chờ Eric (E-11). Mặc định mỗi tài khoản một loại; đăng ký thêm tài khoản loại kia bằng thư điện tử hoặc số điện thoại khác. Không tự gộp tài khoản.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - giữ cột `tutor_host` làm tên miền cũ để cổng vận hành còn thấy, không thêm migration;
  - đăng nhập bằng định danh mở phiên cho tài khoản đã gắn, loại nào cũng được;
  - tìm gia sư công khai cho mọi người mở tên miền chung;
  - trang ở phần # của địa chỉ không thuộc bộ màn của loại tài khoản thì mở trang mặc định của loại đó.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-368, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- E-11: cách cho một người dùng cả hai vai.
- Nhà cung cấp định danh thật cần khai thêm địa chỉ quay về trên tên miền của chợ trước khi tắt tên miền cũ.
- Bản nhiều trường trên máy cần chạy lại `scripts/chay-nhieu-truong.mjs` sau khi gộp nhánh; tài khoản gia sư đăng nhập lại ở tên miền chợ (phiên cũ nằm ở bộ nhớ của tên miền cũ).

## 24 Yêu cầu thay đổi

### YCTD-368: Gộp ứng dụng Gia sư vào Chợ gia sư, phân quyền theo loại tài khoản – 2026-10-29

- Lý do: Eric yêu cầu ngày 2026-10-29 một ứng dụng dùng chung cho giáo viên (gia sư) và phụ huynh, phân quyền theo loại tài khoản (GD-181).
- Nội dung thay đổi: gộp `apps/tutor` vào `apps/market`, xóa `apps/tutor`; ứng dụng hiện bộ màn theo `kind`; máy chủ bỏ quy tắc chặn theo tên miền, giữ kiểm loại tài khoản ở từng điểm cuối; tên miền cũ chuyển hướng về chợ.
- Thành phần bị ảnh hưởng: `apps/market/*` (thêm `src/tutor/`, `public/`), `apps/tutor` (xóa), `packages/market-client/src/MarketShell.tsx`, `AccountForms.tsx`, `market-api.ts`, `apps/api/src/market/market-context.ts`, `market-accounts.ts`, `market-identity.ts`, `market-password.ts`, `market-public.ts` và kiểm thử, `database/src/marketplace/market-settings.ts`, `apps/platform/src/MarketPage.tsx`, `scripts/chay-nhieu-truong.mjs`, `scripts/chuyen-huong-gia-su.mjs` (mới), `deploy/docker/*.Dockerfile`, `deploy/profiles/production/*`, `deploy/profiles/trial/*`, `tests/playwright.multi.config.ts`, `tests/e2e-multi-environment.mjs`, `tests/e2e/195` đến `199`, `tests/trial/edge-worker.test.mjs`, README, tài liệu 32, 34.
- Dữ liệu, API, quyền bị ảnh hưởng: không có migration. `GET /market/public/site` bỏ `tutor_url`, `application`. `POST /market/auth/register` nhận `kind` do người dùng chọn ở mọi tên miền của chợ. `POST /market/auth/login`, `POST /market/identity/complete` (đăng nhập) không còn chặn theo tên miền. `POST /market/identity/start` lấy mục đích theo loại tài khoản. Máy chủ API không phục vụ tên miền cũ của ứng dụng Gia sư (404). Quyền theo loại tài khoản ở từng điểm cuối không đổi.
- Ảnh hưởng chức năng cũ: tài khoản gia sư đăng nhập ở tên miền của chợ; liên kết cũ ở tên miền `gia-su.` chuyển hướng về chợ. Phiên gia sư cũ phải đăng nhập lại.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/api`, `apps/market`, `packages/market-client`, `apps/platform`, `tests`; kiểm thử máy chủ chợ; kiểm thử cấu hình chợ; kiểm thử Worker; e2e 195 đến 199.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: gộp ứng dụng Gia sư vào Chợ gia sư, phân quyền theo loại tài khoản (YCTD-368, GD-181).
- Gỡ ứng dụng `apps/tutor`; tên miền cũ chuyển hướng về chợ.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gộp ứng dụng Gia sư vào Chợ gia sư, phân quyền theo loại tài khoản | YCTD-368 |
