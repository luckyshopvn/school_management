---
yctd: YCTD-368
tieu_de: Gộp ứng dụng Gia sư vào Chợ gia sư, phân quyền theo loại tài khoản
ngay: 2026-10-29
phien_ban_de_xuat: 0.248.0
---

## 02 Nhật ký

### 2026-10-29 — Gộp ứng dụng Gia sư vào Chợ gia sư

#### Công việc đã thực hiện

- Thêm GD-185, E-11 và mục 19.15 vào tài liệu 47; sửa bảng địa chỉ ở 16.10 và dòng Chợ gia sư ở tài liệu 49.
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
  - e2e CT-368-2 (spec 195): tên miền cũ chuyển hướng về chợ, gia sư đăng ký ở chợ và thấy bộ màn của gia sư, phụ huynh không thấy màn của gia sư; mở trang của vai kia thì có thông báo và mở trang của vai mình; spec 196 đến 199 chạy trên tên miền chung.
- Mở trang của vai kia (phần # của địa chỉ) thì báo "Trang bạn mở dành cho tài khoản …" và mở trang của vai mình (bản mẫu MH-593, MH-594).
- Sửa lỗi có sẵn từ YCTD-360: dưới 1280 px thanh điều hướng của phụ huynh bị ép thành cột hẹp; nay xuống một hàng riêng, cuộn ngang được.
- Manifest và biểu tượng của chợ dùng đường dẫn tuyệt đối như ứng dụng phụ huynh, giáo viên, học sinh.
- Tài liệu 11, 14, 21: tiêu chí AC-1170 đến AC-1178, màn hình MH-590 đến MH-594, kịch bản CT-1740 đến CT-1756; AC-1075, MH-510, MH-513 ghi thay đổi.

#### Quyết định

- GD-185 theo yêu cầu của Eric ngày 2026-10-29 ("gộp 2 ứng dụng gia sư lại làm 1 … phân quyền cho phù hợp"): một ứng dụng, một tên miền; quyền theo loại tài khoản ở máy chủ. Thay quyết định tách ứng dụng của YCTD-262.
- Một người có cả hai vai (E-11): Eric chọn phương án (a) ngày 2026-10-29, mỗi tài khoản một loại; đăng ký thêm tài khoản loại kia bằng thư điện tử hoặc số điện thoại khác. Không gộp tài khoản.
- Eric duyệt phiếu, bản mẫu `tai_lieu/ban_mau/yctd-368/` (MH-590 đến MH-595; MH-595 chỉ để tham khảo vì không chọn phương án b) và năm lát L1 đến L5 ngày 2026-10-29; xem ảnh từng lát trước khi làm lát sau. Mã lát L1 đến L5 merge ở PR 298, tài liệu của lát L5 ở PR sau.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - giữ cột `tutor_host` làm tên miền cũ để cổng vận hành còn thấy, không thêm migration;
  - đăng nhập bằng định danh mở phiên cho tài khoản đã gắn, loại nào cũng được;
  - tìm gia sư công khai cho mọi người mở tên miền chung;
  - trang ở phần # của địa chỉ không thuộc bộ màn của loại tài khoản thì mở trang mặc định của loại đó.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-368, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Nhà cung cấp định danh thật cần khai thêm địa chỉ quay về trên tên miền của chợ trước khi tắt tên miền cũ.
- Bản nhiều trường trên máy cần chạy lại `scripts/chay-nhieu-truong.mjs` sau khi gộp nhánh; tài khoản gia sư đăng nhập lại ở tên miền chợ (phiên cũ nằm ở bộ nhớ của tên miền cũ).

## 24 Yêu cầu thay đổi

### YCTD-368: Gộp ứng dụng Gia sư vào Chợ gia sư, phân quyền theo loại tài khoản – 2026-10-29

- Lý do: Eric yêu cầu ngày 2026-10-29 một ứng dụng dùng chung cho giáo viên (gia sư) và phụ huynh, phân quyền theo loại tài khoản (GD-185).
- Nội dung thay đổi: gộp `apps/tutor` vào `apps/market`, xóa `apps/tutor`; ứng dụng hiện bộ màn theo `kind`; máy chủ bỏ quy tắc chặn theo tên miền, giữ kiểm loại tài khoản ở từng điểm cuối; tên miền cũ chuyển hướng về chợ.
- Thành phần bị ảnh hưởng: `apps/market/*` (thêm `src/tutor/`, `public/`), `apps/tutor` (xóa), `packages/market-client/src/MarketShell.tsx`, `AccountForms.tsx`, `market-api.ts`, `apps/api/src/market/market-context.ts`, `market-accounts.ts`, `market-identity.ts`, `market-password.ts`, `market-public.ts` và kiểm thử, `database/src/marketplace/market-settings.ts`, `apps/platform/src/MarketPage.tsx`, `scripts/chay-nhieu-truong.mjs`, `scripts/chuyen-huong-gia-su.mjs` (mới), `deploy/docker/*.Dockerfile`, `deploy/profiles/production/*`, `deploy/profiles/trial/*`, `tests/playwright.multi.config.ts`, `tests/e2e-multi-environment.mjs`, `tests/e2e/195` đến `199`, `tests/trial/edge-worker.test.mjs`, README, tài liệu 47, 49.
- Dữ liệu, API, quyền bị ảnh hưởng: không có migration. `GET /market/public/site` bỏ `tutor_url`, `application`. `POST /market/auth/register` nhận `kind` do người dùng chọn ở mọi tên miền của chợ. `POST /market/auth/login`, `POST /market/identity/complete` (đăng nhập) không còn chặn theo tên miền. `POST /market/identity/start` lấy mục đích theo loại tài khoản. Máy chủ API không phục vụ tên miền cũ của ứng dụng Gia sư (404). Quyền theo loại tài khoản ở từng điểm cuối không đổi.
- Ảnh hưởng chức năng cũ: tài khoản gia sư đăng nhập ở tên miền của chợ; liên kết cũ ở tên miền `gia-su.` chuyển hướng về chợ. Phiên gia sư cũ phải đăng nhập lại.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/api`, `apps/market`, `packages/market-client`, `apps/platform`, `tests`; kiểm thử máy chủ chợ; kiểm thử cấu hình chợ; kiểm thử Worker; e2e 195 đến 199.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: gộp ứng dụng Gia sư vào Chợ gia sư, phân quyền theo loại tài khoản (YCTD-368, GD-185).
- Gỡ ứng dụng `apps/tutor`; tên miền cũ chuyển hướng về chợ.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gộp ứng dụng Gia sư vào Chợ gia sư, phân quyền theo loại tài khoản | YCTD-368 |

## Thêm dòng

| 14_DAC_TA_GIAO_DIEN.md | MH-545 | MH-590 | Chợ gia sư: trang công khai (YCTD-368): tìm gia sư; dải "Đăng ký làm gia sư" thay liên kết sang ứng dụng Gia sư | Người chưa đăng nhập |
| 14_DAC_TA_GIAO_DIEN.md | MH-545 | MH-591 | Chợ gia sư: đăng ký chọn vai (YCTD-368): "Phụ huynh tìm gia sư cho con" hoặc "Gia sư, kể cả giáo viên dạy kèm ngoài trường"; văn bản phải đồng ý đổi theo vai | Người chưa đăng nhập |
| 14_DAC_TA_GIAO_DIEN.md | MH-545 | MH-592 | Chợ gia sư: đăng nhập chung (YCTD-368): mật khẩu, quên mật khẩu, đăng nhập bằng định danh cho cả hai vai | Người chưa đăng nhập |
| 14_DAC_TA_GIAO_DIEN.md | MH-545 | MH-593 | Chợ gia sư: khung phụ huynh (YCTD-368): thanh điều hướng đầu trang Tìm gia sư, Buổi học của con, Tin nhắn, Hồ sơ con, An toàn; dưới 1280 px thanh xuống hàng riêng, cuộn ngang; thông báo khi mở trang của gia sư | Phụ huynh |
| 14_DAC_TA_GIAO_DIEN.md | MH-545 | MH-594 | Chợ gia sư: khung gia sư (YCTD-368): cột điều hướng trái Buổi dạy, Lịch, Hồ sơ và môn dạy, Thu nhập, Tin nhắn, Đánh giá, Xác minh, An toàn, kiểm duyệt (gộp MH-513, MH-530, MH-531, MH-541, MH-544); thông báo khi mở trang của phụ huynh | Gia sư, giáo viên dạy kèm ngoài trường |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1170 | Cho chợ bật ở tên miền của chợ / Khi phụ huynh hoặc gia sư đăng ký, đăng nhập ở tên miền này / Thì tài khoản có đúng loại đã chọn, đăng nhập được, thấy đúng bộ màn của vai (CT-1740, CT-1741, CT-1745; YCTD-368) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1171 | Cho phiên gia sư / Khi gọi điểm cuối của phụ huynh / Thì 403, không lộ dữ liệu con (CT-1746; YCTD-368) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1172 | Cho phiên phụ huynh / Khi gọi điểm cuối của gia sư / Thì 403, kể cả khi đăng nhập bằng định danh đã liên kết (CT-1747, CT-1752; YCTD-368) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1173 | Cho địa chỉ ở tên miền cũ của ứng dụng Gia sư / Khi mở bất kỳ đường dẫn nào / Thì chuyển 308 về cùng đường dẫn, cùng truy vấn ở tên miền của chợ; máy chủ API trả 404 cho tên miền cũ (CT-1748, CT-1749; YCTD-368) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1174 | Cho gia sư xác minh danh tính / Khi quay về từ nhà cung cấp ở `/xac-minh` của tên miền chợ, hoặc bắt đầu với địa chỉ quay về ở tên miền cũ / Thì ghi kết quả cho đúng tài khoản và mở trang Xác minh; địa chỉ ở tên miền cũ bị từ chối (CT-1750, CT-1751; YCTD-368) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1175 | Cho đăng ký / Khi loại tài khoản không phải phụ huynh hay gia sư, thiếu điều khoản của gia sư, hoặc thư điện tử đã có tài khoản loại khác / Thì từ chối với lỗi ở đúng ô (CT-1742, CT-1743, CT-1744; YCTD-368) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1176 | Cho tài khoản đã đăng nhập / Khi mở phần # của địa chỉ thuộc vai kia / Thì báo trang dành cho vai kia, mở trang của vai mình, không hiện màn của vai kia (CT-1753, CT-1754; YCTD-368) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1177 | Cho tin nhắn, phòng học sau khi gộp / Khi chạy lại kiểm thử an toàn trẻ em / Thì không có kênh gia sư với trẻ, phòng học vẫn ghi hình theo GD-164 (CT-1755; YCTD-368) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1178 | Cho máy đã cài ứng dụng Gia sư cũ / Khi trình duyệt kiểm bản mới ở tên miền cũ / Thì nhận service worker tự gỡ (CT-1756; YCTD-368) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1740 | P02-125 | Phụ huynh đăng ký chọn "Phụ huynh", xác nhận mã | Thấy thanh điều hướng phụ huynh, không có "Hồ sơ và môn dạy" | Kiểm thử tự động `tests/e2e/195-marketplace-isolation.spec.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1741 | P02-125 | Mở tên miền cũ, bấm "Đăng ký làm gia sư", đồng ý ba văn bản, xác nhận mã | Ô gia sư chọn sẵn; thấy cột điều hướng gia sư, không có thanh của phụ huynh | Kiểm thử tự động `tests/e2e/195-marketplace-isolation.spec.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1742 | P02-125 | Đăng ký gia sư thiếu Điều khoản dành cho gia sư | 400 | Kiểm thử tự động `apps/api/src/market/market.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1743 | P02-125 | Đăng ký với loại tài khoản `teacher` | 400 "Chọn loại tài khoản" | Kiểm thử tự động `apps/api/src/market/market.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1744 | P02-125 | Đăng ký phụ huynh bằng thư điện tử của một gia sư | 400 "Đã có tài khoản dùng thư điện tử hoặc số điện thoại này" | Kiểm thử tự động `apps/api/src/market/market.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1745 | P02-125 | Gia sư đăng nhập mật khẩu ở tên miền chợ, gọi `GET /me` | 200, `kind = tutor` | Kiểm thử tự động `apps/api/src/market/market.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1746 | P02-125 | Phiên gia sư gọi `GET /children` | 403 | Kiểm thử tự động `apps/api/src/market/market.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1747 | P02-125 | Phiên phụ huynh gọi `GET /tutor/profile`, `GET /tutor/bookings` | 403 (kể cả khi chưa đồng ý văn bản mới) | Kiểm thử tự động `apps/api/src/market/market.test.ts` đạt ngày 29/10/2026, `market-bookings.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1748 | P02-125 | Gọi API chợ ở tên miền cũ `gia-su.` (đăng nhập, `/me`, buổi dạy, định danh, tìm gia sư) | 404 | Kiểm thử tự động `apps/api/src/market/market.test.ts` đạt ngày 29/10/2026, `market-bookings.test.ts`, `market-verification.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1749 | P02-125 | Mở `gia-su.…/xac-minh?code=a&state=b` và `/api/v1/…` qua bộ chuyển hướng, Worker, Caddy | 308 về cùng đường dẫn, cùng truy vấn ở tên miền chợ | Kiểm thử tự động `tests/trial/edge-worker.test.mjs` đạt ngày 29/10/2026; e2e 195; `caddy validate` với `marketplace.caddy` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1750 | P02-125 | Gia sư xác minh danh tính qua nhà cung cấp giả lập | "Đã xác minh danh tính", mở trang Xác minh | Kiểm thử tự động `tests/e2e/196-tutor-verification.spec.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1751 | P02-125 | Gia sư bắt đầu xác minh với địa chỉ quay về ở tên miền cũ | 400 | Kiểm thử tự động `apps/api/src/market/market-verification.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1752 | P02-125 | Phụ huynh đăng nhập bằng định danh đã liên kết rồi gọi `GET /tutor/listing` | Đăng nhập được, `kind = parent`; gọi điểm cuối gia sư 403 | Kiểm thử tự động `apps/api/src/market/market-verification.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1753 | P02-125 | Gia sư mở `/#ho-so-con` | Báo trang dành cho phụ huynh; mở trang của gia sư, không có biểu mẫu hồ sơ con | Kiểm thử tự động `tests/e2e/195-marketplace-isolation.spec.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1754 | P02-125 | Phụ huynh mở `/#thu-nhap` | Báo trang dành cho gia sư; mở trang của phụ huynh | Kiểm thử tự động `tests/e2e/195-marketplace-isolation.spec.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1755 | P02-125 | Chạy lại e2e 198 (báo cáo an toàn, tạm khóa) và 199 (phòng học, ghi hình) trên tên miền chung | Đạt, không sửa kỳ vọng an toàn | CI của PR 298 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1756 | P02-125 | Gọi `/sw.js` ở tên miền cũ | 200, service worker tự gỡ bộ nhớ đệm `gia-su-v-` | Kiểm thủ công (curl) ngày 29/10/2026 | Đạt |
