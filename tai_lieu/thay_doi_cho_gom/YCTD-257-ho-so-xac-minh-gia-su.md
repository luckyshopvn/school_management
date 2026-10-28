---
yctd: YCTD-257
tieu_de: DT-27 phần 27g: hồ sơ gia sư, xác minh qua OIDC giả lập, hàng chờ duyệt, tìm gia sư theo Mẫu 02
ngay: 2026-10-28
phien_ban_de_xuat: 0.179.0
---

## 02 Nhật ký

### 2026-10-28 — DT-27 phần 27g: hồ sơ, xác minh, tìm gia sư

#### Công việc đã thực hiện

- Đọc mục 19.2 (xác minh lý lịch gia sư ở chợ mở), 19.5 (27g) của `32_KE_HOACH_THEO_HE_THONG_SO.md`. Làm trên ứng dụng Gia sư `apps/tutor` (YCTD-262); phiên điều phối giao ngày 2026-10-28, ưu tiên của Eric là giao diện web.
- Bộ nối OIDC của DT-25 (`identity-provider`, `oidc-provider`, `provider-profiles` và kiểm thử) chuyển bằng `git mv` sang `packages/server/src/external-identity/` (đường nhập `@school-management/server/external-identity`) để máy chủ API dùng; dịch vụ định danh nhập từ gói, hành vi không đổi. `readProviderDefinitions` nhận tiền tố biến (`EXTERNAL_IDENTITY` mặc định, `MARKET_IDENTITY` cho chợ).
- Marketplace `0010`: thêm cột duyệt, ngôn ngữ dạy cho `market_tutor_profiles` (trạng thái thêm đã duyệt, bị từ chối); bảng `market_tutor_subjects`, `market_tutor_availability`, `market_tutor_documents`, `market_tutor_verifications`, `market_tutor_school_roles`, `market_oidc_requests`. Kiểu bảng ở `database/marketplace/schema-parts/dt-27g-xac-minh-gia-su.ts`.
- Máy chủ API (`apps/api/src/market/`, đăng ký ở `src/dang-ky/dt-27g-xac-minh-gia-su.ts`):
  - `market-identity.ts`: xác minh danh tính và đăng nhập bằng OIDC ở ứng dụng Gia sư (`/api/v1/market/identity/*`);
  - `market-listing.ts`: hồ sơ dạy, gửi duyệt, nộp giấy tờ (mã hóa AES-256-GCM bằng `MARKET_FILES_KEY`, kho chung của bản triển khai), khai giáo viên đang dạy ở trường, Mẫu 03 (`/api/v1/market/tutor/*`);
  - `market-review.ts`: hàng chờ duyệt, xem tệp có nhật ký, duyệt hoặc từ chối có lý do (`/api/v1/market/admin/reviews/*`);
  - `market-public.ts`: tìm gia sư, trang công khai theo Mẫu 02 ở Chợ gia sư (`/api/v1/market/public/tutors*`);
  - `market-tutor-rules.ts`: quy tắc thuần (kiểm hồ sơ, trạng thái xác minh có hạn, điều kiện gửi duyệt, duyệt, hiện công khai).
- `TenantFileStorage.deploymentStorage()`: kho chung của bản triển khai cho phần không thuộc trường nào (tệp của chợ không đi qua cấu hình kho riêng của trường).
- Giao diện: ứng dụng Gia sư (Xác minh, Hồ sơ dạy, Giáo viên đang dạy ở trường với báo cáo Mẫu 03 in được, đăng nhập bằng định danh, trang quay về `/xac-minh`); Chợ gia sư (Tìm gia sư, trang gia sư theo Mẫu 02); cổng nền tảng (Hàng chờ duyệt gia sư trong trang Chợ gia sư).
- Kiểm thử: CT-27g-1 (`market-tutor-rules.test.ts`), CT-27g-2 đến CT-27g-4 (`market-verification.test.ts`, nhà cung cấp OIDC giả lập), CT-27g-5 (e2e `196-tutor-verification.spec.ts`).

#### Quyết định

- Xác minh danh tính chỉ nhận nhà cung cấp khai `birthdate_claim` (chợ phải biết đủ 18 tuổi); dưới 18 tuổi hoặc không có ngày sinh thì từ chối. Chợ chỉ lưu băm của mã đối tượng, "đủ 18 tuổi", không lưu ngày sinh; một người chỉ gắn một tài khoản gia sư.
- Lượt OIDC lưu ở cơ sở dữ liệu chợ (máy chủ API không có Redis riêng của chợ), chỉ lưu băm của state, hạn 10 phút, dùng một lần; địa chỉ quay về phải là `/xac-minh` trên tên miền của ứng dụng Gia sư.
- Đăng nhập bằng OIDC chỉ cho tài khoản gia sư đã xác minh bằng đúng nhà cung cấp đó; không tự tạo tài khoản.
- Hiện công khai khi hồ sơ đã duyệt, danh tính đã xác minh, lý lịch tư pháp đã duyệt còn hiệu lực (GD-136: cấp trong 6 tháng khi nộp, hiệu lực 12 tháng từ ngày duyệt). Sửa hồ sơ đã duyệt thì về chờ duyệt, ẩn khỏi tìm kiếm.
- Môn `curriculum` cần nộp đăng ký kinh doanh trước khi gửi duyệt và cần đăng ký kinh doanh đã duyệt trước khi duyệt hồ sơ.
- Giáo viên đang dạy ở trường (Eric làm rõ ngày 2026-10-28: giáo viên dạy kèm ngoài trường dùng ứng dụng Gia sư bằng tài khoản chợ riêng): khai tên trường, công lập hay không, môn, lớp; giáo viên trường công lập không có môn `curriculum` (Thông tư 29/2024 khoản 3 Điều 4) ở cả lúc lưu hồ sơ và lúc khai; báo cáo Mẫu 03 là bản in để nộp Hiệu trưởng. Chợ không đọc dữ liệu trường.
- Trang công khai theo Mẫu 02: cơ sở đứng tên, số đăng ký kinh doanh nếu có, môn, khối lớp, thời lượng, mức thu, địa điểm (trực tuyến), hình thức, thời gian, người dạy; không có thư điện tử, số điện thoại, địa chỉ của gia sư.
- Tệp giấy tờ: nhận PDF, JPEG, PNG theo các byte đầu (không tin phần mở rộng), tối đa 10 MB; nộp lại thì thay bản cũ, xóa tệp cũ khỏi kho.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-257, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-430 đến BR-432, PQ-185, P02-130, AC-1090 đến AC-1094, MH-530 đến MH-533, CT-1390 đến CT-1394, QĐ-47.

#### Vấn đề tồn đọng

- Chưa làm: ảnh hồ sơ gia sư; đánh giá sau buổi và sắp xếp theo đánh giá (cần buổi đã học, 27h); liên kết tài khoản chợ với tài khoản trường để hiện nhãn "giáo viên trường X đã xác minh"; nhắc gia sư nộp lại lý lịch tư pháp trước khi hết hiệu lực.
- Nhà cung cấp định danh thật (VNeID qua tổ chức cung cấp dịch vụ xác thực) chờ E-04; bản này chỉ chạy nhà cung cấp OIDC giả lập.

## 24 Yêu cầu thay đổi

### YCTD-257: DT-27 phần 27g: hồ sơ gia sư, xác minh, hàng chờ duyệt, tìm gia sư – 2026-10-28

- Lý do: phần 27g của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 19.4, 19.5; phiên điều phối giao ngày 2026-10-28 sau khi tách ứng dụng Gia sư (YCTD-262).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Hồ sơ dạy**: môn theo cấp và khối, loại nội dung, giá mỗi buổi, thời lượng, giờ trống theo tuần, ngôn ngữ dạy; gửi duyệt.
  - **Xác minh bốn bậc**: danh tính (OIDC, đủ 18 tuổi, tự động), bằng cấp, lý lịch tư pháp, đăng ký kinh doanh (nhân viên nền tảng duyệt); huy hiệu theo bậc.
  - **Hàng chờ duyệt** ở cổng nền tảng: xem tệp có nhật ký, duyệt hoặc từ chối có lý do.
  - **Giáo viên đang dạy ở trường**: khai trường, chặn môn `curriculum` với giáo viên công lập, Mẫu 03.
  - **Tìm gia sư, trang theo Mẫu 02** ở Chợ gia sư.
  - **Đăng nhập OIDC** cho gia sư đã xác minh.
  - **Chưa làm**: ảnh hồ sơ, đánh giá, liên kết tài khoản trường.
- Thành phần bị ảnh hưởng: `packages/server` (`external-identity/` chuyển từ `apps/identity`), `apps/identity` (đường nhập), `database` (`marketplace/migrations/0010`, `marketplace/schema.ts`, `marketplace/schema-parts/dt-27g-xac-minh-gia-su.ts`), `apps/api` (`market/market-identity.ts`, `market-listing.ts`, `market-review.ts`, `market-public.ts`, `market-tutor-rules.ts`, `market-files.ts`, `market-accounts.ts`, `common/configuration.ts`, `school-settings/tenant-connectors.ts`, `tenancy-route-policy.ts`, `dang-ky/dt-27g-xac-minh-gia-su.ts`), `apps/tutor`, `apps/market`, `apps/platform`, `packages/market-client` (`MarketShell` thêm `loginExtras`), `tests` (môi trường nhiều trường, spec 196).
- Dữ liệu bị ảnh hưởng: marketplace `0010` (6 bảng mới, 5 cột mới ở `market_tutor_profiles`).
- API bị ảnh hưởng: `GET`, `PUT /api/v1/market/tutor/listing`, `POST /api/v1/market/tutor/listing/submit`, `POST /api/v1/market/tutor/verifications/{kind}`, `PUT`, `DELETE /api/v1/market/tutor/school-role`, `GET /api/v1/market/tutor/form-03`, `GET /api/v1/market/identity/providers`, `POST /api/v1/market/identity/start`, `POST /api/v1/market/identity/complete`, `GET /api/v1/market/public/tutors`, `GET /api/v1/market/public/tutors/{id}`, `GET /api/v1/market/admin/reviews`, `GET /api/v1/market/admin/reviews/tutors/{id}`, `GET /api/v1/market/admin/reviews/documents/{id}`, `POST /api/v1/market/admin/reviews/tutors/{id}/profile`, `POST /api/v1/market/admin/reviews/tutors/{id}/verifications/{kind}`.
- Cấu hình: `MARKET_IDENTITY_PROVIDERS` (cùng dạng `EXTERNAL_IDENTITY_PROVIDERS`, phải có `birthdate_claim`), `MARKET_IDENTITY_<MÃ>_CLIENT_SECRET`, `MARKET_FILES_KEY` (32 byte base64).
- Giao diện bị ảnh hưởng: MH-530, MH-531, MH-532, MH-533.
- Quyền bị ảnh hưởng: PQ-185 (không thêm mã quyền của trường).
- Ảnh hưởng chức năng cũ: dịch vụ định danh dùng bộ nối OIDC từ gói chung, hành vi không đổi (kiểm thử DT-25 đạt).
- Kiểm thử cần thực hiện: `packages/server` (`provider-profiles`), `apps/identity` (`external-identity`, `external-identity-tenancy`), `apps/api` (`market-tutor-rules`, `market-verification`, `market`, `tenancy-matrix`), e2e nhiều trường 196, 195, 130, kiểm tĩnh.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-27 phần 27g, hồ sơ gia sư, xác minh, hàng chờ duyệt, tìm gia sư (YCTD-257).
- Chức năng mới: xác minh danh tính gia sư qua OIDC (đủ 18 tuổi), xác minh bằng cấp, lý lịch tư pháp, đăng ký kinh doanh; hồ sơ dạy, gửi duyệt; hàng chờ duyệt ở cổng nền tảng; tìm gia sư và trang theo Mẫu 02; Mẫu 03 cho giáo viên đang dạy ở trường; đăng nhập OIDC cho gia sư (P02-130).
- Thay đổi dữ liệu: marketplace `0010`.
- Thay đổi API: nhóm `/api/v1/market/tutor/*`, `/api/v1/market/identity/*`, `/api/v1/market/public/tutors*`, `/api/v1/market/admin/reviews*`.
- Kiểm thử: CT-1390 đến CT-1394 (CT-27g-1 đến CT-27g-5).
- Rủi ro: thấp; chợ chưa mở thật, nhà cung cấp định danh giả lập.
- Khả năng tương thích: không đổi hành vi cũ; bộ nối OIDC của dịch vụ định danh chỉ đổi chỗ đặt mã.
- Phương án quay lui: hoàn lại commit gộp; bảng marketplace `0010` không ảnh hưởng phần khác.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27g: hồ sơ gia sư, xác minh bốn bậc (danh tính qua OIDC đủ 18 tuổi, bằng cấp, lý lịch tư pháp, đăng ký kinh doanh), hàng chờ duyệt ở cổng nền tảng, tìm gia sư theo Mẫu 02, Mẫu 03 cho giáo viên đang dạy ở trường | YCTD-257 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +3 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +5 |
| Màn hình dự kiến | Số lượng | +4 |
| Ca kiểm thử khởi đầu | Số lượng | +5 |
| Chức năng đã liệt kê | Số lượng | +1 |
| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +4 |
| 16 | bảng dự kiến | +6 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27 phần 27g (YCTD-257: hồ sơ, xác minh, tìm gia sư) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-430 | Xác minh gia sư ở chợ (YCTD-257): danh tính qua nhà cung cấp OIDC trả ngày sinh, đủ 18 tuổi, một người một tài khoản gia sư, chợ chỉ lưu băm mã đối tượng và "đủ 18 tuổi"; phiếu lý lịch tư pháp cấp trong 6 tháng khi nộp, hiệu lực 12 tháng từ ngày duyệt; bằng cấp, đăng ký kinh doanh do nhân viên nền tảng duyệt, từ chối phải có lý do; tệp giấy tờ mã hóa, mỗi lần nhân viên xem ghi nhật ký |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-431 | Hồ sơ gia sư hiện công khai (YCTD-257): chỉ khi hồ sơ đã duyệt, danh tính đã xác minh, lý lịch tư pháp đã duyệt còn hiệu lực; có môn `curriculum` thì phải nộp đăng ký kinh doanh trước khi gửi duyệt và có đăng ký kinh doanh đã duyệt trước khi duyệt; sửa hồ sơ đã duyệt thì về chờ duyệt, ẩn khỏi tìm kiếm; trang công khai theo Mẫu 02, không có thư điện tử, số điện thoại, địa chỉ của gia sư |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-432 | Giáo viên đang dạy ở trường dạy kèm qua chợ (YCTD-257; Eric làm rõ ngày 2026-10-28): dùng ứng dụng Gia sư bằng tài khoản chợ riêng, khai tên trường, công lập hay không, môn, lớp; giáo viên trường công lập không có môn của chương trình phổ thông có thu tiền (Thông tư 29/2024 khoản 3 Điều 4); lập báo cáo Mẫu 03 nộp Hiệu trưởng; dạy kèm học sinh trong trường mình vẫn ở ứng dụng giáo viên |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-115 | PQ-185 | Xác minh, duyệt gia sư (YCTD-257, DT-27 phần 27g): không thêm mã quyền của trường; gia sư (tài khoản chợ) khai hồ sơ, nộp giấy tờ ở ứng dụng Gia sư; nhân viên nền tảng (mã phiên vận hành) xem giấy tờ, duyệt ở cổng nền tảng; phụ huynh, người chưa đăng nhập xem gia sư đã duyệt ở Chợ gia sư |
| 10_YEU_CAU_CHUC_NANG.md | P02-102 | P02-130 | Hồ sơ, xác minh, tìm gia sư ở chợ (YCTD-257) | Gia sư; nhân viên nền tảng; phụ huynh | Hồ sơ dạy, giấy tờ, định danh OIDC, quyết định duyệt | Xác minh bốn bậc, gửi duyệt, duyệt, tìm gia sư, trang theo Mẫu 02, Mẫu 03 | Trạng thái xác minh, hồ sơ công khai | BR-430, BR-431, BR-432, PQ-185 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1090 | Cho gia sư ở ứng dụng Gia sư / Khi xác minh danh tính bằng định danh dưới 18 tuổi, không có ngày sinh, đủ 18 tuổi, cùng định danh cho tài khoản thứ hai, rồi đăng nhập bằng định danh / Thì hai lần đầu và lần thứ tư bị từ chối, lần thứ ba được xác minh, đăng nhập vào đúng tài khoản đã xác minh (CT-1391; YCTD-257) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1091 | Cho gia sư khai là giáo viên trường công lập / Khi thêm môn của chương trình phổ thông hoặc khai công lập khi đang có môn đó / Thì bị từ chối, nêu Thông tư 29; lập được báo cáo Mẫu 03 (CT-1392; YCTD-257) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1092 | Cho gia sư đã xác minh danh tính / Khi nộp lý lịch tư pháp cấp quá 6 tháng, tệp không phải PDF, JPEG, PNG, rồi tệp hợp lệ / Thì hai lần đầu bị từ chối, lần sau chờ duyệt; nhân viên mở tệp đúng bản gốc và có nhật ký (CT-1393; YCTD-257) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1093 | Cho hồ sơ chờ duyệt / Khi nhân viên duyệt hồ sơ trước khi duyệt lý lịch, từ chối không lý do, duyệt lý lịch rồi duyệt hồ sơ / Thì hai lần đầu bị từ chối, sau đó gia sư hiện ở tìm kiếm của Chợ gia sư theo Mẫu 02, không lộ thư điện tử; sửa hồ sơ thì ẩn đến khi duyệt lại (CT-1393, CT-1394; YCTD-257) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1094 | Cho dữ liệu hồ sơ / Khi khối ngoài cấp, giá, thời lượng ngoài khoảng, khung giờ trùng, gửi duyệt thiếu danh tính, môn hoặc đăng ký kinh doanh cho môn của chương trình / Thì bị từ chối kèm lý do (CT-1390; YCTD-257) |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-530 | Ứng dụng Gia sư: Xác minh (YCTD-257): danh tính qua nhà cung cấp định danh (quay về `/xac-minh`), nộp bằng cấp, phiếu lý lịch tư pháp, đăng ký kinh doanh kèm tệp, trạng thái từng bậc | Gia sư |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-531 | Ứng dụng Gia sư: Hồ sơ dạy (YCTD-257): ngôn ngữ dạy, môn (cấp, khối, loại nội dung, giá, thời lượng), giờ trống, lưu, gửi nền tảng duyệt, việc cần làm trước khi gửi; Giáo viên đang dạy ở trường và báo cáo Mẫu 03 in được; đăng nhập bằng định danh | Gia sư |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-532 | Chợ gia sư: Tìm gia sư (YCTD-257): lọc theo môn, cấp, lớp, giá tối đa, sắp xếp; thẻ gia sư có huy hiệu xác minh; trang gia sư với thông tin công khai theo Mẫu 02 | Phụ huynh, người chưa đăng nhập |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-533 | Cổng nền tảng: Hàng chờ duyệt gia sư trong trang Chợ gia sư (YCTD-257): danh sách chờ, chi tiết gia sư, xem tệp giấy tờ, duyệt hoặc từ chối từng bậc và hồ sơ có lý do | Người vận hành nền tảng |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_tutor_subjects, market_tutor_availability (marketplace, từ YCTD-257) | Môn dạy và giờ trống của gia sư (BR-431; marketplace `0010`) | môn: account_id, subject, school_level, grade_from, grade_to, content_kind (`curriculum`, `enrichment`), price_per_session (đồng), session_minutes; giờ trống: weekday (1 đến 7), start_minute, end_minute |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_tutor_documents, market_tutor_verifications (marketplace, từ YCTD-257) | Giấy tờ mã hóa và xác minh từng bậc của gia sư (BR-430; marketplace `0010`) | giấy tờ: account_id, kind, file_key (kho tệp, bản mã hóa), file_name, content_type, size_bytes; xác minh: (account_id, kind) khóa chính, status (`pending`, `approved`, `rejected`), details, document_id, decided_by, note, valid_until |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_tutor_school_roles, market_oidc_requests (marketplace, từ YCTD-257) | Khai giáo viên đang dạy ở trường, lượt OIDC của chợ (BR-430, BR-432; marketplace `0010`) | giáo viên: account_id (khóa chính), school_name, is_public, subjects, grades, form03_generated_at; lượt OIDC: state_hash (khóa chính), purpose (`verify`, `login`), provider, account_id, nonce, code_verifier, redirect_uri, expires_at, used_at |
| 12_KIEN_TRUC_HE_THONG.md | QĐ-43 | QĐ-47 | Bộ nối OIDC dùng chung (DT-27 phần 27g, YCTD-257): bộ nối của DT-25 chuyển sang `packages/server/src/external-identity/` để máy chủ API xác minh danh tính gia sư ở chợ; dịch vụ định danh nhập từ gói; chợ khai nhà cung cấp riêng (`MARKET_IDENTITY_*`, ứng dụng đăng ký là của chợ, địa chỉ quay về trên tên miền ứng dụng Gia sư); lượt OIDC của chợ lưu ở cơ sở dữ liệu chợ; tệp giấy tờ mã hóa AES-256-GCM ở kho chung của bản triển khai (`TenantFileStorage.deploymentStorage`); phương án đã loại: chép mã bộ nối vào máy chủ API (hai bản cần sửa song song), gọi dịch vụ định danh của trường để xác minh (chợ không thuộc trường nào), lưu lượt OIDC ở Redis của dịch vụ định danh (máy chủ API không dùng chung Redis đó) | Đã chọn |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1390 | P02-130 | CT-27g-1: quy tắc hồ sơ gia sư: dữ liệu hợp lệ, giáo viên công lập, khối, giá, thời lượng, khung giờ, hạn lý lịch, điều kiện gửi duyệt và duyệt | đúng, từ chối kèm lý do | Đạt; `apps/api/src/market/market-tutor-rules.test.ts`; 1094 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1391 | P02-130 | CT-27g-2: xác minh danh tính qua OIDC giả lập: dưới 18 tuổi, không ngày sinh, đủ 18 tuổi, cùng định danh tài khoản thứ hai, state dùng lại, đăng nhập OIDC | từ chối; từ chối; xác minh; từ chối; 400; đúng tài khoản, người lạ 403 | Đạt; `apps/api/src/market/market-verification.test.ts`; 1090 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1392 | P02-130 | CT-27g-3: giáo viên công lập và môn của chương trình, Mẫu 03, gửi duyệt khi chưa xác minh danh tính | 400 nêu Thông tư 29; Mẫu 03 có tên trường; 409 | Đạt; `apps/api/src/market/market-verification.test.ts`; 1091 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1393 | P02-130 | CT-27g-4: lý lịch tư pháp quá hạn, tệp sai loại, tệp đúng; nhân viên xem tệp, duyệt trước khi đủ điều kiện, từ chối không lý do, duyệt; tìm kiếm, Mẫu 02, sửa hồ sơ | 400; 400; chờ duyệt; đúng bản gốc; 409; 400; hiện ở tìm kiếm, không lộ thư điện tử; ẩn | Đạt; `apps/api/src/market/market-verification.test.ts`; 1092, 1093 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1394 | P02-130 | CT-27g-5 (e2e 196, nhiều trường): gia sư đăng ký, xác minh danh tính qua nhà cung cấp giả lập, khai hồ sơ, nộp lý lịch, gửi duyệt; nhân viên duyệt ở cổng nền tảng; phụ huynh tìm thấy, mở trang Mẫu 02 | các bước đạt; thẻ có giá và huy hiệu; trang không có thư điện tử | `tests/e2e/196-tutor-verification.spec.ts`; 1093 | Cao |
