# 26. TRIỂN KHAI

- Mô tả: Các cách triển khai đang có trong kho, các bước chung, thứ tự database migration, phương án quay lui, kiểm tra sau triển khai và mẫu biên bản. Đây là tài liệu `26_TRIEN_KHAI` của quy trình Vibecoding_Flow (YCTD-369).
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-29
- Trạng thái: Đang cập nhật
- Người thực hiện: Claude, theo cách xử lý Eric duyệt ngày 2026-10-29

## 1. Hiện trạng

1. **Chưa có lần triển khai nào lên môi trường thật hoặc môi trường thử nghiệm dùng chung.** Việc `T6` (thuê máy chủ đám mây trong nước) chưa làm (`01` rủi ro RR-08). Các kiểm tay trên staging (ví dụ CT-989, CT-1042) còn chờ dựng VPS thử (`23` phiên bản của YCTD-198, YCTD-203).
2. Bản 1.0.0, 1.1.0, 1.2.0 được Eric nghiệm thu ngày 13/10/2026 (thẻ `v1.0.0`, `v1.1.0`, `v1.2.0`, YCTD-92) nhưng chưa triển khai; xác nhận sau triển khai của cổng CG-11 còn chờ việc `T6` (`01`, dòng giai đoạn 11 Nghiệm thu và phát hành).
3. Môi trường đang chạy duy nhất là máy phát triển của Eric: bản nhiều trường trên máy (mục 3.4), chỉ dữ liệu giả.
4. Mục 7 (biên bản) để trống cho tới lần triển khai đầu tiên.

## 2. Môi trường

| Môi trường | Mục đích | Dữ liệu | Hiện trạng |
|---|---|---|---|
| Phát triển | Lập trình, thử nhanh | Dữ liệu mẫu, dữ liệu giả | Đang dùng: bản nhiều trường trên máy (mục 3.4) |
| Tích hợp liên tục | Kiểm thử tự động mỗi PR | Dữ liệu giả sinh trong lượt chạy | GitHub Actions, không triển khai |
| Thử nghiệm (staging) | Kiểm thử chức năng, nghiệm thu, kiểm tay phần hạ tầng | Chỉ dữ liệu giả | Chưa dựng |
| Chạy thật | Vận hành | Dữ liệu thật | Chưa dựng |

Ba môi trường thử nghiệm, chạy thật, phát triển tách biệt cơ sở dữ liệu, kho tệp, cấu hình kênh thông báo (`12` mục 12).

## 3. Các cách triển khai có trong kho

### 3.1 Bản một máy (DT-12, YCTD-92)

- Hướng dẫn: `deploy/README.md`; Compose `deploy/docker-compose.production.yml`; cấu hình mẫu `deploy/.env.production.example`.
- Một máy Linux chạy Docker Compose: `migrate`, `identity`, `api`, `worker`, `web` (Caddy), PostgreSQL, Redis, SeaweedFS hoặc kho đối tượng của nhà cung cấp, coturn tuỳ chọn.
- Lần đầu: `deploy/README.md` mục 4, 5 (tạo tài khoản VT-01 đầu tiên bằng `create-platform-administrator`).
- Cập nhật: `deploy/README.md` mục 6.

### 3.2 Hồ sơ "Vận hành" nhiều trường trên VPS trong nước (DT-SaaS S7a, YCTD-198)

- Hướng dẫn: `deploy/profiles/production/README.md`, sao lưu và khôi phục theo thời điểm ở `deploy/profiles/production/PITR.md`.
- Ba cách đặt máy T1, T2, T3; PgBouncer trước PostgreSQL; Caddy bắt mọi tên miền; hai bản `api`, `identity`.
- Triển khai không gián đoạn: `deploy/profiles/production/scripts/deploy.sh --tag <phiên bản>`; kiểm cấu hình: `deploy/profiles/production/scripts/check-config.sh`.
- Staging dùng cùng `compose.yml`, tên dự án `school-staging`, cấu hình `staging.env` (mẫu `staging.env.example`), chỉ dữ liệu giả.

### 3.3 Hồ sơ thử nghiệm trên gói miễn phí (DT-SaaS S9, YCTD-203)

- Hướng dẫn: `deploy/profiles/trial/README.md`, ba tổ hợp ở `deploy/profiles/trial/to-hop-1/` đến `to-hop-3/`.
- Dùng chung mã và ảnh container với mục 3.2; chuyển một trường sang hồ sơ vận hành bằng `platform relayout` (`deploy/profiles/trial/README.md` mục 6).
- Trường dùng dữ liệu thật trên máy chủ ngoài Việt Nam cần hồ sơ đồng ý và luật sư rà (`48_HO_SO_PHAP_LY/`).

### 3.4 Bản nhiều trường trên máy (YCTD-310, YCTD-314)

- Hướng dẫn: `47_KE_HOACH_THEO_HE_THONG_SO.md` mục 16.10 (bảng địa chỉ, cách dựng, cách chạy, cách gỡ) và 16.11.
- Dựng: `pnpm --filter @school-management/database nhieu-truong-cuc-bo …` sau `pnpm build`; chạy: `node scripts/chay-nhieu-truong.mjs`.
- Tệp môi trường `.env.nhieu-truong` ở gốc kho, nằm trong `.gitignore`.
- Chỉ dùng để phát triển và thử trên máy, không phải môi trường triển khai.

## 4. Các bước triển khai chung

Áp dụng giống nhau cho staging và chạy thật (mục 8 của quy trình):

1. Điều kiện: phiên bản có thẻ và có mục ở `23`; đã qua cổng kiểm thử và nghiệm thu; Eric phê duyệt triển khai cho môi trường cụ thể; phiên bản chứa mọi bản vá khẩn cấp đã triển khai.
2. Triển khai lên staging trước, kiểm tay theo `deploy/profiles/production/README.md` mục 12, rồi mới lên chạy thật cùng phiên bản ảnh.
3. Sao lưu ngay trước khi triển khai lên mỗi môi trường: `bash deploy/scripts/backup.sh daily` (bản một máy) hoặc `platform backup-school --all` (hồ sơ vận hành, `PITR.md`).
4. Lấy mã theo thẻ: `git fetch --tags && git checkout <thẻ>`.
5. Triển khai: bản một máy theo `deploy/README.md` mục 6; hồ sơ vận hành bằng `scripts/deploy.sh --tag <phiên bản>`.
6. Kiểm tra sau triển khai (mục 6), ghi biên bản (mục 7).
7. Lỗi ảnh hưởng người dùng: báo Eric ngay, quay lui khi Eric đồng ý (mục 5.3).

## 5. Database migration và quay lui

### 5.1 Các loại cơ sở dữ liệu và lệnh chạy

| Loại | Thư mục tệp thay đổi cấu trúc | Lệnh |
|---|---|---|
| Định danh `school_identity` | `database/identity/migrations/` | `migrate-command` (dịch vụ `migrate`) |
| Hệ thống `school_system` | `database/system/migrations/` | `migrate-command` |
| Năm học `school_year_YYYY_YYYY` đang dùng | `database/school-year/migrations/` | `migrate-command`; năm học đã đóng giữ nguyên cấu trúc (QU-11) |
| Nền tảng `school_platform` | `database/platform/migrations/` | `pnpm --filter @school-management/database platform migrate` |
| Chợ gia sư `school_marketplace` | `database/marketplace/migrations/` | **Đã bỏ (YCTD-393):** sao lưu rồi xóa bằng `xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su --xoa-co-so-du-lieu` (mục 5.2 bước 1). Trước đó: Cùng lệnh `platform migrate` khi có `MARKETPLACE_DATABASE_URL` |
| Cơ sở dữ liệu của từng trường (nhiều trường) | Như định danh, hệ thống, năm học | `platform migrate-schools [--canary <mã>] [--continue]`, ghi kết quả vào `school_migrations` |

### 5.2 Thứ tự

1. Sao lưu (mục 4 bước 3). Phiên bản có YCTD-393: sao lưu mã hóa dữ liệu đã bỏ trước database migration, `pnpm --filter @school-management/database xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su` trước `platform migrate` (nền tảng `0255`), `-- --tinh-nang gia-su-trong-truong` trước `migrate-command` (năm học `0235`); database migration từ chối chạy khi chưa có bản ghi ở `removed_data_backups`.
2. `platform migrate` khi phiên bản có tệp mới ở `database/platform/` (chợ gia sư và `database/marketplace/` đã bỏ từ YCTD-393).
3. `migrate-command`: định danh, rồi hệ thống, rồi lần lượt từng năm học đang dùng (`database/src/migrate-command.ts`). Lỗi ở bước trước thì dừng, không chạy bước sau.
4. Nhiều trường: `platform migrate-schools --canary <mã trường thử>` cho một trường trước, đạt thì chạy cho mọi trường.
5. Khởi động lại dịch vụ: bản một máy thì `identity`, `api` chỉ chạy sau khi `migrate` thành công; hồ sơ vận hành thì `identity-a`, `identity-b`, `api-a`, `api-b` lần lượt, rồi `worker`, `web`.

Chưa xác định: `scripts/deploy.sh` của hồ sơ vận hành chỉ chạy dịch vụ `migrate` (bước 3), chưa gọi `platform migrate` và `platform migrate-schools` (bước 2, 4). Lần triển khai đầu cần chạy tay hai lệnh này hoặc bổ sung vào script; việc bổ sung chưa được duyệt.

### 5.3 Quay lui

1. Quy tắc thay đổi cấu trúc tương thích lùi (`deploy/profiles/production/README.md` mục 7): chỉ thêm bảng, thêm cột có mặc định hoặc cho phép trống, chỉ mục không khóa; bỏ cột, đổi tên làm ở bản phát hành sau. Nhờ vậy phiên bản trước vẫn chạy trên cấu trúc mới.
2. Hồ sơ vận hành: `scripts/deploy.sh --tag <phiên bản trước>`. Migrate không quay lui tự động.
3. Bản một máy: `git checkout <thẻ cũ>`, đặt lại `IMAGE_TAG` cũ, `dc up -d`. Nếu phiên bản mới có thay đổi cấu trúc không tương thích lùi thì khôi phục bản sao lưu vừa chụp (`deploy/README.md` mục 7.3) trước khi chạy ảnh cũ.
4. Một trường bị lỗi dữ liệu sau migrate: khôi phục riêng trường đó theo `deploy/profiles/production/PITR.md` mục 4.
5. Mỗi phiên bản ghi phương án quay lui riêng ở `23`.

## 6. Kiểm tra sau triển khai

1. Phiên bản đang chạy đúng thẻ: `docker compose ps` và `IMAGE_TAG`.
2. `curl -fsS https://api.<tên miền>/api/v1/health` trả `{"status":"ok","service":"api"}`; mở cổng quản trị thấy trang đăng nhập.
3. Nhật ký `migrate` báo mọi cơ sở dữ liệu "đã ở phiên bản cấu trúc mới nhất"; `school_migrations` không có trường lỗi.
4. Kiểm tay theo `deploy/profiles/production/README.md` mục 12 (staging).
5. Cổng bảo mật phần D của quy trình: cấu hình không dùng bộ giả lập (`PAYMENT_GATEWAY`, `FACEBOOK_PUBLISHER`, `ZALO_SENDER` khác `development`), `NODE_ENV=production` có nhà cung cấp tin nhắn thật, tệp cấu hình quyền 600, khóa dữ liệu trẻ và khóa sao lưu có bản cất ngoài máy chủ.

## 7. Biên bản triển khai

Chưa có biên bản: chưa có lần triển khai nào (mục 1). Mỗi lần triển khai thêm một mục theo mẫu, mới nhất ở trên cùng.

```markdown
### <YYYY-MM-DD> — Triển khai <phiên bản> lên <staging | chạy thật>

- Phiên bản, thẻ, commit: <phiên bản>, `v<phiên bản>`, `<commit>`
- Môi trường, cách triển khai: <mục 3.x>, <máy, tên miền>
- Người phê duyệt: Eric, ngày <YYYY-MM-DD>
- Người thực hiện: <tên>
- Sao lưu trước khi triển khai: <tệp hoặc mã bản sao lưu>, <thời điểm>
- Database migration: <danh sách tệp đã chạy theo từng loại cơ sở dữ liệu, kết quả>
- Kiểm tra sau triển khai (mục 6): <kết quả từng điểm>
- Cổng bảo mật phần D: <kết quả>
- Sự cố, quay lui: <không | mô tả, thời điểm, phiên bản quay về>
- Kết luận: <Đạt | Không đạt>
```

## 8. Chưa xác minh được

- Các hướng dẫn ở `deploy/` chưa chạy trên VPS thật; thời gian triển khai, thời gian quay lui, mục tiêu khôi phục (RPO, RTO ở `PITR.md`) là giả định.
- Thứ tự `platform migrate` so với `migrate-command` ở mục 5.2 lấy theo phụ thuộc trong mã (`database/src/platform-command.ts`, `database/src/migrate-command.ts`), chưa có tài liệu nào chốt.
