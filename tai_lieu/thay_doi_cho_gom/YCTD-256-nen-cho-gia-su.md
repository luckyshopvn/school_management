---
yctd: YCTD-256
tieu_de: DT-27 phần 27f: nền chợ gia sư (cơ sở dữ liệu marketplace, ứng dụng apps/market, tài khoản, hồ sơ con, đồng ý, cấu hình chợ)
ngay: 2026-10-28
phien_ban_de_xuat: 0.173.0
---

## 02 Nhật ký

### 2026-10-28 — DT-27 phần 27f: nền chợ gia sư

#### Công việc đã thực hiện

- Đọc mục 19.3 đến 19.11 (27f) của `32_KE_HOACH_THEO_HE_THONG_SO.md`. Eric quyết ngày 2026-10-28 (qua phiên điều phối): làm phần mã của chợ ngay, thanh toán chạy giả lập; không bật tiền thật trước khi xong E-01 đến E-07.
- Cơ sở dữ liệu chung mới `marketplace`: loại migration thứ năm (`database/marketplace/`, chỉ mục sinh bằng `database/sinh-chi-muc.mjs` như bốn loại cũ), `migrateToLatest('marketplace', …)`, biến `MARKETPLACE_DATABASE_URL`; `platform migrate` chạy luôn chợ khi có biến. Tệp 0001 (múi giờ) đến 0005: `market_accounts`, `market_verification_codes`, `market_sessions`, `market_external_identities`, `market_legal_documents`, `market_consents`, `market_children`, `market_school_links`, `market_tutor_profiles`, `market_providers`, `market_audit_log`.
- `provisionMarketplaceDatabase` tạo vai trò riêng (mặc định `marketplace_service`, không CREATEDB, không CREATEROLE) là chủ cơ sở dữ liệu chợ, thu quyền kết nối của PUBLIC.
- Máy chủ API `apps/api/src/market/` (đăng ký ở `src/dang-ky/dt-27f-cho-gia-su.ts`): đường dẫn `/api/v1/market/*` không cần trường; tài khoản phụ huynh, gia sư (đăng ký có đồng ý văn bản bắt buộc, mã xác nhận 6 số, đăng nhập khóa 15 phút sau 5 lần sai, phiên riêng), hồ sơ con, đồng ý của cha mẹ theo con, rút đồng ý, liên kết với trường bằng mã ký, hồ sơ gia sư và cơ sở dạy thêm tối thiểu, quản trị ở cổng nền tảng (cấu hình, đăng văn bản pháp lý, số tài khoản). Phía trường: `GET`, `POST /api/v1/children/{id}/market-link` cho cha mẹ lấy mã liên kết.
- Cấu hình chợ ở `platform_settings` khóa `market` (`database/src/marketplace/market-settings.ts`): bật tắt, tên miền dành riêng, hạn giữ bản ghi (GD-132), hạn khiếu nại (GD-133), tỷ lệ hoa hồng mặc định (E-01, để trống); thu tiền thật luôn tắt.
- `PlatformOperatorTokenVerifier` ở `packages/server` để máy chủ API kiểm mã phiên vận hành (cùng đối tượng, loại với dịch vụ định danh).
- Giao diện: ứng dụng mới `apps/market` (cổng phát triển 5178): trang giới thiệu, văn bản pháp lý, đăng ký, xác nhận, đăng nhập, khu phụ huynh (hồ sơ con, đồng ý, liên kết trường), khu gia sư; trang Chợ gia sư ở cổng nền tảng; nút Lấy mã liên kết ở khối gia sư của con (ứng dụng phụ huynh).
- Kiểm thử: CT-27f-1 (`database/src/marketplace/market-settings.test.ts`), CT-27f-2 đến CT-27f-5 (`apps/api/src/market/market.test.ts`), CT-27f-6 (e2e `195-marketplace-isolation.spec.ts`, dự án nhiều trường; bước dựng tạo cơ sở dữ liệu `school_marketplace_e2e` và vai trò `marketplace_e2e`).

#### Quyết định

- Chợ ở máy chủ API (không dựng dịch vụ thứ ba), đường dẫn không cần trường như `/api/v1/parent-org/*`: không có ngữ cảnh trường nên `Databases` không mở được kết nối của trường nào; chỉ phục vụ khi chạy nhiều trường, có `MARKETPLACE_DATABASE_URL`, chợ bật và đúng tên miền dành riêng (tên miền khác 404). Quản trị chợ cũng ở máy chủ API (`/api/v1/market/admin`), chỉ ở tên miền cổng nền tảng với mã phiên vận hành, để chỉ một tiến trình giữ vai trò của chợ.
- Phiên của chợ là chuỗi ngẫu nhiên 32 byte, chỉ lưu băm; không dùng mã phiên ký của trường nên hai bên không dùng chéo được.
- Một tài khoản một vai (phụ huynh hoặc gia sư); trẻ không có tài khoản (GD-135); hồ sơ con chỉ tên hiển thị, năm sinh, cấp, lớp (lớp đúng cấp: Tiểu học 1 đến 5, THCS 6 đến 9, THPT 10 đến 12).
- Văn bản pháp lý có phiên bản, phiên bản đã đăng không sửa; có phiên bản mới của văn bản bắt buộc thì người dùng phải đồng ý lại mới dùng tiếp (409 cho đến khi đồng ý).
- Liên kết với trường bằng mã ký HMAC hạn 10 phút do ứng dụng phụ huynh của trường cấp (`MARKET_LINK_SECRET`), mã chỉ mang mã trường, mã học sinh băm HMAC theo mã trường, cấp, lớp; chợ không gọi vào trường. Thay cho luồng chuyển đăng nhập của DT-24 và bảng định danh `0170` của kế hoạch (không cần lưu ở trường; nhật ký cấp mã ghi ở nhật ký của trường). Luồng chuyển tự động có thể thêm sau mà không đổi dạng mã.
- Mã xác nhận gửi qua hộp thư giả lập trong bộ nhớ của máy chủ (không ghi mã ra nhật ký); nối thư điện tử, tin nhắn thật làm khi mở chợ (E-04).
- Đăng nhập bằng OIDC (bộ nối DT-25) chuyển sang 27g, làm cùng xác minh danh tính gia sư; bảng `market_external_identities` đã có.
- Thu tiền thật: lưu `real_payments_enabled = true` bị từ chối, đọc cấu hình luôn trả tắt kể cả khi giá trị ở cơ sở dữ liệu bị sửa tay; bỏ chặn là thay đổi mã có YCTD riêng sau E-01 đến E-07.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-256, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-410, PQ-175, P02-125, AC-1070 đến AC-1074, MH-510 đến MH-512, CT-1370 đến CT-1375, QĐ-44.

#### Vấn đề tồn đọng

- Gửi mã xác nhận thật (thư điện tử, tin nhắn), đăng nhập OIDC, đặt lại mật khẩu chưa làm; giới hạn tần suất đăng ký theo địa chỉ mạng chưa làm.
- Ảnh dựng `deploy/docker/web.Dockerfile`, Caddy, hồ sơ thử nghiệm chưa phục vụ `apps/market`; tạo vai trò, cơ sở dữ liệu chợ ở môi trường thật làm khi mở chợ (E-04).

## 24 Yêu cầu thay đổi

### YCTD-256: DT-27 phần 27f: nền chợ gia sư – 2026-10-28

- Lý do: phần 27f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 19.4, 19.5; Eric quyết ngày 2026-10-28 làm phần mã của chợ, tiền giả lập.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Cơ sở dữ liệu `marketplace`** riêng, vai trò riêng, loại migration mới (marketplace 0001 đến 0005).
  - **Tài khoản**: phụ huynh, gia sư đăng ký bằng thư điện tử hoặc số điện thoại, mật khẩu, đồng ý phiên bản mới nhất của điều khoản, chính sách dữ liệu (gia sư thêm điều khoản của gia sư), mã xác nhận 6 số; phiên riêng của chợ.
  - **Hồ sơ con** tối thiểu, đồng ý của cha mẹ theo con, rút và đồng ý lại.
  - **Liên kết tùy chọn với trường** bằng mã ký 10 phút lấy ở ứng dụng phụ huynh của trường.
  - **Gia sư**: hồ sơ, cơ sở dạy thêm tối thiểu (chưa công khai).
  - **Cấu hình chợ** ở cổng nền tảng; thu tiền thật luôn tắt.
- Thành phần bị ảnh hưởng: `database` (`marketplace/`, `src/marketplace/`, `migrate.ts`, `environment.ts`, `platform-command.ts`, `sinh-chi-muc.mjs`), `packages/server` (`platform-operator-token.ts`), `apps/api` (`market/`, `dang-ky/dt-27f-cho-gia-su.ts`, `create-application.ts`, `common/configuration.ts`, `tenancy-route-policy.ts`, phụ thuộc `@node-rs/argon2`), `apps/market` (mới), `apps/platform`, `apps/parent`, `tests` (môi trường nhiều trường, spec 195).
- Dữ liệu bị ảnh hưởng: cơ sở dữ liệu mới `marketplace` (11 bảng); `platform_settings` thêm khóa `market`.
- API bị ảnh hưởng: nhóm `/api/v1/market/*` (công khai của chợ, `auth`, `me`, `children`, `tutor`, `admin`); `GET`, `POST /api/v1/children/{id}/market-link`.
- Giao diện bị ảnh hưởng: MH-510, MH-511, MH-512.
- Quyền bị ảnh hưởng: PQ-175 (không thêm mã quyền của trường).
- Ảnh hưởng chức năng cũ: không; chợ tắt mặc định, thiếu `MARKETPLACE_DATABASE_URL` thì mọi điểm cuối của chợ 404.
- Kiểm thử cần thực hiện: `database` (`market-settings`), `apps/api` (`market`, `tenancy-matrix`), e2e nhiều trường 195, kiểm tĩnh.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-27 phần 27f, nền chợ gia sư (YCTD-256).
- Chức năng mới: cơ sở dữ liệu `marketplace`, ứng dụng `apps/market`, tài khoản phụ huynh, gia sư, hồ sơ con, đồng ý theo phiên bản, liên kết với trường, cấu hình chợ ở cổng nền tảng (P02-125).
- Thay đổi dữ liệu: cơ sở dữ liệu mới `marketplace` 0001 đến 0005; `platform_settings.market`.
- Thay đổi API: nhóm `/api/v1/market`; `/api/v1/children/{id}/market-link`.
- Kiểm thử: CT-1370 đến CT-1375 (CT-27f-1 đến CT-27f-6).
- Rủi ro: thấp; chợ tắt mặc định, thanh toán chỉ giả lập, thu tiền thật không bật được.
- Khả năng tương thích: không đổi hành vi cũ.
- Phương án quay lui: tắt chợ ở cổng nền tảng hoặc bỏ `MARKETPLACE_DATABASE_URL`; hoàn lại commit gộp.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27f: nền chợ gia sư (cơ sở dữ liệu marketplace, ứng dụng apps/market, tài khoản, hồ sơ con có đồng ý, liên kết với trường, cấu hình chợ; thu tiền thật luôn tắt) | YCTD-256 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +1 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +5 |
| Màn hình dự kiến | Số lượng | +3 |
| Ca kiểm thử khởi đầu | Số lượng | +6 |
| Chức năng đã liệt kê | Số lượng | +1 |
| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +3 |
| 16 | bảng dự kiến | +11 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27 phần 27f (YCTD-256: nền chợ gia sư) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-410 | Nền chợ gia sư (YCTD-256): chợ dùng cơ sở dữ liệu `marketplace` và vai trò riêng, không đọc cơ sở dữ liệu của trường; chỉ phục vụ ở tên miền dành riêng khi chợ bật; một tài khoản một vai (phụ huynh hoặc gia sư), đăng ký phải đồng ý phiên bản mới nhất của văn bản bắt buộc và xác nhận mã 6 số (10 phút, 5 lần sai); phiên bản văn bản mới thì phải đồng ý lại mới dùng tiếp; trẻ không có tài khoản, hồ sơ con chỉ tên hiển thị, năm sinh, cấp, lớp, cần đồng ý của cha mẹ theo con, rút được; liên kết với trường chỉ bằng mã ký 10 phút do cha mẹ lấy ở trường, chỉ giữ mã trường, mã học sinh băm, lớp; thu tiền thật luôn tắt đến khi xong E-01 đến E-07 |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-115 | PQ-175 | Chợ gia sư (YCTD-256, DT-27 phần 27f): không thêm mã quyền của trường; tài khoản chợ (phụ huynh, gia sư) là người dùng riêng của cơ sở dữ liệu `marketplace` với phiên riêng; quản trị chợ là người vận hành nền tảng (mã phiên vận hành); phía trường chỉ cha mẹ của học sinh lấy được mã liên kết |
| 10_YEU_CAU_CHUC_NANG.md | P02-102 | P02-125 | Nền chợ gia sư (YCTD-256) | Phụ huynh, gia sư ngoài trường; người vận hành nền tảng; cha mẹ ở trường | Thông tin đăng ký, hồ sơ con, mã liên kết, cấu hình chợ | Đăng ký có đồng ý theo phiên bản, xác nhận mã, hồ sơ con, rút đồng ý, liên kết trường, hồ sơ gia sư, cấu hình chợ | Tài khoản, hồ sơ con, đồng ý, liên kết | BR-410, PQ-175 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1070 | Cho nền tảng có chợ gia sư / Khi người vận hành lưu cấu hình bật thu tiền thật, hoặc giá trị bật bị ghi tay vào cơ sở dữ liệu / Thì máy chủ từ chối (400, nêu E-01 đến E-07) và cấu hình đọc ra vẫn tắt (CT-1370, CT-1371; YCTD-256) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1071 | Cho chợ tắt hoặc gọi ở tên miền của trường / Khi gọi điểm cuối của chợ / Thì 404; vai trò cơ sở dữ liệu của chợ không kết nối được cơ sở dữ liệu của trường; mã phiên của trường không dùng được ở chợ và ngược lại (CT-1372, CT-1375; YCTD-256) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1072 | Cho phụ huynh mới / Khi đăng ký thiếu đồng ý văn bản bắt buộc, chưa nhập mã, nhập mã sai / Thì không đăng ký được, chưa dùng được khu phụ huynh, mã sai bị từ chối; nhập đúng mã thì tài khoản dùng được (CT-1373; YCTD-256) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1073 | Cho phụ huynh đã xác nhận / Khi tạo hồ sơ con không đồng ý, lớp sai cấp, rút đồng ý, dán mã liên kết sai, hết hạn, đúng / Thì hai lần đầu bị từ chối, hồ sơ chỉ có tên hiển thị, năm sinh, cấp, lớp; rút thì hồ sơ thành chưa đồng ý; mã sai, hết hạn bị từ chối, mã đúng chỉ để lại mã trường, lớp (CT-1373; YCTD-256) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1074 | Cho gia sư / Khi đăng ký thiếu điều khoản của gia sư, lưu hồ sơ, nền tảng đăng phiên bản điều khoản mới, đăng nhập sai 5 lần / Thì không đăng ký được; lưu được; phải đồng ý lại mới dùng tiếp; tài khoản tạm khóa 15 phút (CT-1374; YCTD-256) |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-510 | Ứng dụng Chợ gia sư (apps/market, YCTD-256): giới thiệu, văn bản pháp lý, đăng ký có đồng ý từng văn bản, xác nhận mã, đăng nhập, văn bản mới cần đồng ý, hồ sơ con (đồng ý, rút đồng ý, liên kết với trường), hồ sơ gia sư và cơ sở dạy thêm | Phụ huynh, gia sư |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-511 | Cổng nền tảng: trang Chợ gia sư (YCTD-256): cấu hình (bật, tên miền, hạn giữ bản ghi, hạn khiếu nại, hoa hồng mặc định), thu tiền thật luôn tắt, đăng phiên bản văn bản pháp lý, số tài khoản | Người vận hành nền tảng |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-512 | Ứng dụng phụ huynh: khối Liên kết với Chợ gia sư ở khối gia sư của con (YCTD-256): Lấy mã liên kết 10 phút; chỉ hiện khi nền tảng đã nối chợ | Cha mẹ |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_accounts, market_verification_codes, market_sessions, market_external_identities (marketplace, từ YCTD-256) | Tài khoản, mã xác nhận, phiên, danh tính ngoài của chợ gia sư (BR-410; marketplace `0002`) | tài khoản: id, kind (`parent`, `tutor`), email, phone (duy nhất), password_hash (argon2id), display_name, status (`pending`, `active`, `locked`, `closed`), đếm sai, khóa đến; mã: account_id, channel, purpose, code_hash, attempts, expires_at; phiên: token_hash (duy nhất), expires_at, revoked_at |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_legal_documents, market_consents (marketplace, từ YCTD-256) | Văn bản pháp lý có phiên bản và đồng ý (BR-410; marketplace `0003`) | văn bản: kind (`terms`, `privacy`, `parent_consent`, `tutor_terms`), version (duy nhất theo loại), title, body, published_by; đồng ý: account_id, document_id, child_id, accepted_at, withdrawn_at |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_children, market_school_links (marketplace, từ YCTD-256) | Hồ sơ con và liên kết với trường (BR-410; marketplace `0004`) | hồ sơ con: parent_account_id, display_name, birth_year, school_level, grade; liên kết: child_id (một liên kết đang dùng), school_code, student_hash, grade, revoked_at |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_tutor_profiles, market_providers, market_audit_log (marketplace, từ YCTD-256) | Hồ sơ gia sư, cơ sở dạy thêm tối thiểu, nhật ký chợ (BR-410; marketplace `0005`) | hồ sơ: account_id (khóa chính), headline, bio, status; cơ sở: owner_account_id (duy nhất), kind (`individual`, `organization`), name, business_registration_no; nhật ký: actor_type, actor_id, action, target, details |
| 12_KIEN_TRUC_HE_THONG.md | QĐ-43 | QĐ-44 | Chợ gia sư (DT-27 phần 27f, YCTD-256): cơ sở dữ liệu chung thứ hai `marketplace` (loại migration thứ năm, vai trò riêng là chủ, thu quyền kết nối của PUBLIC) ở máy chủ API, đường dẫn `/api/v1/market/*` không cần trường, chỉ ở tên miền dành riêng; phiên riêng là chuỗi ngẫu nhiên chỉ lưu băm; quản trị ở cùng máy chủ API với mã phiên vận hành (`PlatformOperatorTokenVerifier`) để chỉ một tiến trình giữ vai trò của chợ; cấu hình ở `platform_settings.market`; phương án đã loại: bảng chợ trong `platform` (trộn người dùng cuối với dữ liệu vận hành), dịch vụ thứ ba riêng cho chợ (thêm tiến trình, ảnh dựng ở bản đầu), quản trị chợ ở dịch vụ định danh (thêm một tiến trình giữ vai trò chợ) | Đã chọn |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1370 | P02-125 | CT-27f-1: cấu hình chợ: mặc định, bật thu tiền thật, bật chợ thiếu tên miền, giá trị ngoài khoảng | tắt; lỗi nêu E-01 đến E-07; lỗi; lỗi | Đạt; `database/src/marketplace/market-settings.test.ts`; 1070 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1371 | P02-125 | CT-27f-2: cổng nền tảng: chợ tắt, sai tên miền, bật thu tiền thật, ghi tay giá trị bật, đăng văn bản | 404; 400; cấu hình đọc ra vẫn tắt; phiên bản 1 | Đạt; `apps/api/src/market/market.test.ts`; 1070, 1071 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1372 | P02-125 | CT-27f-3: cách ly: vai trò chợ vào cơ sở dữ liệu trường, mã phiên dùng chéo | không kết nối được; 401 hai chiều | Đạt; `apps/api/src/market/market.test.ts`; 1071 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1373 | P02-125 | CT-27f-4: phụ huynh: thiếu đồng ý, chưa xác nhận, hồ sơ con, rút đồng ý, mã liên kết sai, hết hạn, đúng; cấp mã ở trường khi không phải cha mẹ | 400; 403; chỉ bốn trường dữ liệu; chưa đồng ý; 400; 400; mã trường, lớp; 403 | Đạt; `apps/api/src/market/market.test.ts`; 1072, 1073 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1374 | P02-125 | CT-27f-5: gia sư: thiếu điều khoản gia sư, hồ sơ, cơ sở dạy thêm, phiên bản điều khoản mới, đăng nhập sai 5 lần | 400; lưu được; 409 rồi đồng ý lại; khóa 15 phút | Đạt; `apps/api/src/market/market.test.ts`; 1074 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1375 | P02-125 | CT-27f-6 (e2e 195, nhiều trường): người vận hành bật chợ, đăng văn bản; phụ huynh đăng ký, xác nhận, tạo hồ sơ con, rút đồng ý; chợ ở tên miền trường; phiên dùng chéo; vai trò chợ vào cơ sở dữ liệu trường | chợ mở ở tên miền dành riêng; hồ sơ chưa đồng ý; 404; 401; không kết nối được | `tests/e2e/195-marketplace-isolation.spec.ts`; 1071 | Cao |
