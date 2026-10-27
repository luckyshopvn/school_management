---
yctd: YCTD-262
tieu_de: DT-27: tách ứng dụng Gia sư (apps/tutor) khỏi ứng dụng Chợ gia sư (apps/market)
ngay: 2026-10-28
phien_ban_de_xuat: 0.175.0
---

## 02 Nhật ký

### 2026-10-28 — DT-27: tách ứng dụng Gia sư khỏi Chợ gia sư

#### Công việc đã thực hiện

- Quyết định của Eric ngày 2026-10-28 (qua phiên điều phối): "làm thêm ứng dụng cho gia sư". `apps/market` (27f) đang gộp khu phụ huynh và khu gia sư; tách khu gia sư thành ứng dụng riêng `apps/tutor` theo cách của `apps/teacher`, `apps/parent` (Vite, React, `packages/ui`, `packages/pwa`, PWA riêng tên "Chợ gia sư – Gia sư"). Làm trước 27g vì 27g chưa bắt đầu; 27g, 27h, 27i làm phần gia sư trên `apps/tutor`.
- `git mv` khu gia sư (`TutorArea.tsx`) sang `apps/tutor`; phần dùng chung (gọi máy chủ API của chợ, phiên của chợ, biểu mẫu đăng ký, xác nhận mã, đăng nhập, khung trang công khai và văn bản pháp lý) chuyển bằng `git mv` sang gói mới `packages/market-client` (`MarketShell`, `RegisterForm` theo vai, `LoginForm`, `VerifyForm`, `marketRequest`).
- `apps/tutor`: cổng phát triển 5179, manifest tĩnh (không theo trường), biểu tượng, service worker dùng chung với tiền tố bộ nhớ đệm `gia-su-v-`, khung cập nhật bản mới.
- Máy chủ API: cấu hình chợ thêm `tutor_host` (tên miền của ứng dụng Gia sư, bắt buộc khi bật chợ, khác tên miền của chợ); `assertMarketHost` trả vai theo tên miền; đăng ký, đăng nhập, phiên chỉ nhận tài khoản phụ huynh ở tên miền của chợ, tài khoản gia sư ở tên miền của ứng dụng Gia sư; `GET /api/v1/market/public/site` trả thêm `application`, `market_url`, `tutor_url`. Cổng nền tảng: ô tên miền của ứng dụng Gia sư.
- Triển khai: ảnh `web` dựng thêm `apps/market` (`/srv/market`), `apps/tutor` (`/srv/tutor`); ảnh máy chủ, ảnh gộp của hồ sơ thử nghiệm chép thêm `package.json` của hai ứng dụng và gói mới; hồ sơ vận hành thêm `caddy/sites.d/marketplace.caddy.example`, biến `MARKET_SITE`, `TUTOR_SITE`; cổng biên Cloudflare của hồ sơ thử nghiệm phục vụ hai ứng dụng ở gốc theo `MARKET_HOST`, `TUTOR_HOST` (`build-assets.sh` dựng thêm hai thư mục `cho-gia-su`, `gia-su`).
- Kiểm thử: CT-27f-1, CT-27f-2, CT-27f-5 cập nhật theo hai tên miền; e2e 195 thêm ứng dụng Gia sư (cổng 5388, tên miền `gia-su.e2e.localhost`); `tests/trial/edge-worker.test.mjs` thêm hai tên miền.

#### Quyết định

- Ứng dụng Gia sư ở tên miền con riêng (không ở đường dẫn con của tên miền chợ): PWA cài riêng, phạm vi service worker riêng, phiên ở `sessionStorage` riêng của nguồn gốc; máy chủ biết vai của ứng dụng theo tên miền.
- Mỗi ứng dụng một vai: tài khoản phụ huynh chỉ đăng ký, đăng nhập, dùng phiên ở Chợ gia sư; tài khoản gia sư chỉ ở ứng dụng Gia sư. Đăng nhập đúng mật khẩu ở sai ứng dụng thì 403 kèm chỉ dẫn, không mở phiên; phiên mang sang ứng dụng kia thì 401.
- Gói `packages/market-client` dùng chung thay vì chép mã; không tách thêm gói giao diện.
- Không đổi CORS, cookie: hai ứng dụng gọi `/api/v1` cùng tên miền của mình, phiên là mã trong `sessionStorage`, không có cookie. Chưa có máy khách OIDC (đăng nhập OIDC của gia sư làm ở 27g).
- Phạm vi theo lời Eric làm rõ ngày 2026-10-28 (nguyên văn): "giáo viên dạy kèm cũng dùng ứng dụng gia sư như 1 kênh ngoài. đối với học sinh trong trường vẫn cho phép giáo viên sử dụng ứng dụng giáo viên". Do đó:
  - giáo viên dạy kèm ngoài trường (kênh ngoài, chợ) dùng `apps/tutor` như mọi gia sư khác, đăng nhập bằng **tài khoản chợ riêng** (không dùng tài khoản của trường);
  - dạy kèm học sinh trong trường của mình (27a đến 27e) vẫn làm ở ứng dụng giáo viên; không bỏ chức năng nào của ứng dụng giáo viên;
  - liên kết tùy chọn tài khoản chợ với tài khoản trường để hiện nhãn "giáo viên trường X đã xác minh" làm ở 27g (cùng phần khai là giáo viên trường nào, báo cáo Mẫu 03); dữ liệu chợ và dữ liệu trường vẫn cách ly (chợ chỉ nhận kết quả xác minh, không đọc cơ sở dữ liệu trường);
  - giữ các chặn theo Thông tư 29/2024 của kế hoạch: giáo viên công lập không đứng tên cơ sở dạy thêm cho nội dung `curriculum` (27g, khi gia sư khai loại nội dung); giáo viên đang được phân công dạy trẻ thì không nhận buổi `curriculum` có thu tiền của trẻ đó (27h, so khớp qua liên kết trường của hồ sơ con).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-262, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-411, AC-1075, MH-513, CT-1376, QĐ-45.

#### Vấn đề tồn đọng

- Ảnh dựng `web` phục vụ được hai ứng dụng, nhưng tạo vai trò, cơ sở dữ liệu chợ và đặt tên miền ở môi trường thật vẫn chờ mở chợ (E-04).

## 24 Yêu cầu thay đổi

### YCTD-262: DT-27: tách ứng dụng Gia sư khỏi Chợ gia sư – 2026-10-28

- Lý do: Eric yêu cầu ngày 2026-10-28 "làm thêm ứng dụng cho gia sư"; gia sư và phụ huynh dùng chợ theo hai cách khác nhau (hồ sơ, xác minh, lịch dạy, thu nhập so với tìm gia sư, đặt buổi).
- Nội dung thay đổi:
  - Ứng dụng mới `apps/tutor` (ứng dụng Gia sư) ở tên miền con riêng, PWA riêng, cho mọi gia sư của chợ kể cả giáo viên dạy kèm ngoài trường (tài khoản chợ riêng); `apps/market` giữ phần phụ huynh; dạy kèm trong trường vẫn ở ứng dụng giáo viên.
  - Gói dùng chung `packages/market-client`.
  - Cấu hình chợ thêm tên miền của ứng dụng Gia sư; máy chủ ràng vai tài khoản theo tên miền.
  - Ảnh dựng, Caddy hồ sơ vận hành, cổng biên hồ sơ thử nghiệm, e2e nhiều trường thêm hai ứng dụng.
- Thành phần bị ảnh hưởng: `apps/tutor` (mới), `apps/market`, `packages/market-client` (mới), `apps/api` (`market/market-context.ts`, `market-accounts.ts`, `market-admin.ts`), `database` (`src/marketplace/market-settings.ts`), `apps/platform` (`MarketPage.tsx`), `deploy` (`docker/web.Dockerfile`, `docker/server.Dockerfile`, `profiles/trial/container/Dockerfile.all-in-one`, `profiles/production/compose.yml`, `profiles/production/production.env.example`, `profiles/production/caddy/sites.d/marketplace.caddy.example`, `profiles/trial/cloudflare/`), `tests`.
- Dữ liệu bị ảnh hưởng: `platform_settings.market` thêm `tutor_host`; không đổi cấu trúc cơ sở dữ liệu.
- API bị ảnh hưởng: `GET /api/v1/market/public/site` thêm `application`, `market_url`, `tutor_url`; `PUT /api/v1/market/admin/settings` nhận `tutor_host`; `POST /api/v1/market/auth/register`, `POST /api/v1/market/auth/login` ràng vai theo tên miền.
- Giao diện bị ảnh hưởng: MH-510 (chỉ còn phần phụ huynh), MH-511 (thêm ô tên miền của ứng dụng Gia sư), MH-513 (mới).
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chợ đã bật mà chưa đặt tên miền của ứng dụng Gia sư thì gia sư chưa đăng nhập được cho đến khi người vận hành lưu lại cấu hình (chợ mới có ở môi trường thử, chưa mở thật).
- Kiểm thử cần thực hiện: `database` (`market-settings`), `apps/api` (`market`, `tenancy-matrix`), e2e nhiều trường 195, 130, `tests/trial/edge-worker.test.mjs`, dựng `apps/market`, `apps/tutor`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-27, tách ứng dụng Gia sư khỏi Chợ gia sư (YCTD-262).
- Chức năng mới: ứng dụng Gia sư `apps/tutor` (PWA riêng "Chợ gia sư – Gia sư"); mỗi ứng dụng một vai tài khoản.
- Thay đổi dữ liệu: `platform_settings.market.tutor_host`.
- Thay đổi API: nhóm `/api/v1/market` ràng vai theo tên miền; cấu hình thêm `tutor_host`.
- Kiểm thử: CT-1376 (CT-YCTD262-1), cập nhật CT-1370, CT-1371, CT-1374, CT-1375.
- Rủi ro: thấp; chợ chưa mở thật.
- Khả năng tương thích: nền tảng thử đã bật chợ cần đặt thêm tên miền của ứng dụng Gia sư.
- Phương án quay lui: hoàn lại commit gộp; cấu hình `tutor_host` thừa không ảnh hưởng.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27: tách ứng dụng Gia sư (apps/tutor, PWA riêng, tên miền riêng) khỏi Chợ gia sư (apps/market, phần phụ huynh); gói dùng chung packages/market-client; mỗi ứng dụng một vai tài khoản | YCTD-262 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +1 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +1 |
| Màn hình dự kiến | Số lượng | +1 |
| Ca kiểm thử khởi đầu | Số lượng | +1 |
| 14 | màn hình | +1 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27: tách ứng dụng Gia sư (YCTD-262) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-411 | Ứng dụng của chợ gia sư theo vai (YCTD-262): phụ huynh dùng ứng dụng Chợ gia sư ở tên miền của chợ, gia sư (kể cả giáo viên dạy kèm ngoài trường, bằng tài khoản chợ riêng; dạy kèm học sinh trong trường mình vẫn ở ứng dụng giáo viên) dùng ứng dụng Gia sư ở tên miền riêng (đặt ở cổng nền tảng, bắt buộc khi bật chợ, khác tên miền của chợ); máy chủ chỉ nhận đăng ký, đăng nhập, phiên của tài khoản đúng vai với tên miền; đăng nhập đúng mật khẩu ở sai ứng dụng thì từ chối kèm chỉ dẫn, không mở phiên |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1075 | Cho chợ bật với tên miền của chợ và của ứng dụng Gia sư / Khi gia sư đăng ký ở Chợ gia sư, đăng nhập ở Chợ gia sư, dùng phiên gia sư ở tên miền của chợ, phụ huynh dùng phiên ở ứng dụng Gia sư / Thì đăng ký bị từ chối (400), đăng nhập bị từ chối kèm chỉ dẫn sang ứng dụng Gia sư (403), phiên bị từ chối (401) cả hai chiều; gia sư đăng ký, xác nhận, lưu hồ sơ ở ứng dụng Gia sư được (CT-1376; YCTD-262) |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-513 | Ứng dụng Gia sư (apps/tutor, YCTD-262): ứng dụng cài được "Chợ gia sư – Gia sư" ở tên miền riêng; giới thiệu, văn bản pháp lý, đăng ký gia sư (thêm điều khoản dành cho gia sư), xác nhận mã, đăng nhập, văn bản mới cần đồng ý, hồ sơ gia sư và cơ sở dạy thêm; 27g, 27h, 27i thêm xác minh, lịch dạy, buổi, thu nhập, báo cáo an toàn | Gia sư |
| 12_KIEN_TRUC_HE_THONG.md | QĐ-43 | QĐ-45 | Ứng dụng Gia sư tách khỏi Chợ gia sư (YCTD-262): hai ứng dụng tĩnh ở hai tên miền con riêng của nền tảng, cùng nhóm điểm cuối `/api/v1/market`, máy chủ biết vai theo tên miền (`assertMarketHost`); phần dùng chung ở `packages/market-client`; phương án đã loại: một ứng dụng hai khu (PWA, tên, biểu tượng chung cho hai đối tượng), ứng dụng Gia sư ở đường dẫn con của tên miền chợ (chung phạm vi service worker, phiên), chép mã dùng chung vào từng ứng dụng | Đã chọn |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1376 | P02-125 | CT-YCTD262-1: hai ứng dụng: gia sư đăng ký, đăng nhập ở Chợ gia sư; phiên dùng chéo; gia sư đăng ký, xác nhận, lưu hồ sơ ở ứng dụng Gia sư (e2e 195) | 400; 403 kèm chỉ dẫn; 401 hai chiều; lưu được | `apps/api/src/market/market.test.ts` (CT-27f-5), `tests/e2e/195-marketplace-isolation.spec.ts`; 1075 | Cao |
