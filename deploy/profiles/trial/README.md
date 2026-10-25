# Hồ sơ thử nghiệm (a): nền tảng nhiều trường trên gói miễn phí

DT-SaaS phần S9, YCTD-203; kế hoạch ở `tai_lieu/32_KE_HOACH_THEO_HE_THONG_SO.md` mục 14.4, 14.5 "S9" và 14.11 (GD-100, GD-101). Hồ sơ này
dùng chung mã nguồn và ảnh container với hồ sơ vận hành (b) ở `deploy/profiles/production/`. Mọi khác biệt chọn bằng biến cấu hình
của nền tảng, không rẽ nhánh trong mã nghiệp vụ.

Mọi tệp trong thư mục này chỉ chứa **giá trị giả**. Tệp thật (biến môi trường, `wrangler.toml`, khóa) để ngoài kho mã nguồn.

## 1. Thành phần và bộ nối

| Thành phần                | Lựa chọn                                                                                                                     | Chọn bằng                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Cổng biên, tệp tĩnh       | Cloudflare Worker (`cloudflare/`, mặc định), hoặc Vercel (tổ hợp 3)                                                          | Cách triển khai                                         |
| Máy chủ                   | Một container gộp `identity` + `api` (`container/Dockerfile.all-in-one`). Chạy trên Render (chọn đầu) hoặc Koyeb (dự phòng). | Tệp mẫu `container/`                                    |
| PostgreSQL                | Neon hoặc Supabase, bố cục `schema`                                                                                          | `DB_HOST_ADAPTER=neon` hoặc `supabase`                  |
| Kho tệp                   | Cloudflare R2 hoặc Supabase Storage (giao thức S3)                                                                           | `S3_ENDPOINT`, `S3_REGION`                              |
| Tên miền riêng của trường | Cloudflare for SaaS hoặc Vercel Domains                                                                                      | `DOMAIN_PROVIDER=cloudflare-saas` hoặc `vercel-domains` |
| Việc định kỳ              | Cloudflare Cron Triggers (Worker gọi `tick`) hoặc GitHub Actions                                                             | `SCHEDULER_MODE=external`, `INTERNAL_JOB_TOKEN`         |
| Redis                     | Không dùng. Dịch vụ định danh giữ bộ đếm trong bộ nhớ, vì chỉ có một bản container.                                          | `REDIS_URL=memory://`                                   |
| Dữ liệu                   | Dữ liệu giả, hoặc dữ liệu thật khi trường đủ hồ sơ đồng ý (mục 5)                                                            | `PLATFORM_DATA_POLICY`                                  |

Ba tổ hợp có tệp mẫu và các bước riêng:

| Tổ hợp       | Thư mục                           | Web, tên miền                                | Cơ sở dữ liệu      | Tệp                      | Máy chủ             | Việc định kỳ                        |
| ------------ | --------------------------------- | -------------------------------------------- | ------------------ | ------------------------ | ------------------- | ----------------------------------- |
| 1 (mặc định) | [`to-hop-1/`](to-hop-1/README.md) | Cloudflare Worker, Cloudflare for SaaS       | Neon               | R2                       | Render              | Cron Triggers                       |
| 2            | [`to-hop-2/`](to-hop-2/README.md) | Cloudflare Worker, Cloudflare for SaaS       | Supabase           | Supabase Storage         | Koyeb (hoặc Render) | Cron Triggers                       |
| 3            | [`to-hop-3/`](to-hop-3/README.md) | Vercel: 3a đứng sau Worker, 3b làm cổng biên | Neon hoặc Supabase | R2 hoặc Supabase Storage | Render hoặc Koyeb   | 3a Cron Triggers; 3b GitHub Actions |

### Đường đi của một yêu cầu

1. Người dùng gọi `https://<mã>.<tên miền hệ thống>/quan-ly/…`.
2. Worker xử lý theo đường dẫn:
   - `/quan-ly`, `/giao-vien`, `/phu-huynh`: trả tệp tĩnh.
   - `/api/v1/*`: chuyển về máy chủ. Worker xóa tiêu đề do người dùng tự đặt, ghi tên miền gốc vào `x-school-host` và kèm bí mật `x-edge-auth`.
3. Máy chủ (`TENANT_HOST_SOURCE=header:x-school-host`, `EDGE_SHARED_SECRET`) nhận ra trường. Thiếu hoặc sai bí mật thì máy chủ không nhận ra trường nào, nên gọi thẳng địa chỉ công khai của Render không đọc được dữ liệu.
4. Bộ định tuyến trong container (`container/router.mjs`) chia tuyến như Caddy ở hồ sơ vận hành:
   - `/api/v1/auth`, `/users`, `/roles`, `/permissions`, `/api-clients` sang dịch vụ định danh;
   - phần còn lại sang máy chủ API.

Phần còn lại của tên miền trường là website công khai (18f), chuyển về `/api/v1/public/site`. Cổng nền tảng `platform.<tên miền hệ thống>` phục vụ `apps/platform`. Tên miền hệ thống phục vụ trang chọn trường của S1b.

### Máy chủ ngủ khi rảnh

Máy chủ miễn phí ngủ khi rảnh: Render sau 15 phút, Koyeb sau 1 giờ. Khi máy chủ ngủ:

- Worker chờ `ORIGIN_TIMEOUT_MS` (mặc định 10 giây), hoặc nhận lỗi cổng 502, 504, 520 đến 524.
- Worker trả trang "Hệ thống đang khởi động": mã 503, tự tải lại sau 10 giây.
- Lời gọi API nhận `ERR_SERVICE_WAKING`.
- Worker gọi `/api/v1/health` để đánh thức máy chủ.

Lỗi 503 của chính ứng dụng (ví dụ trường tạm dừng) vẫn trả nguyên cho người dùng. Mặc định **không giữ thức máy chủ bằng cách gọi liên tục**. Lịch `tick` mỗi 5 phút đã đánh thức máy chủ khi có việc nền.

## 2. Giới hạn gói miễn phí

Tra **trang chính thức ngày 2026-10-25**. Các giới hạn này đổi thường xuyên, nên kiểm lại khi dựng.

| Dịch vụ                      | Giới hạn                                                                                                                                                                                                                                                                                                                                                                                       | Nguồn                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Render, dịch vụ web miễn phí | Ngủ sau 15 phút không có yêu cầu, thức dậy khoảng 1 phút. 750 giờ máy mỗi tháng cho cả không gian làm việc; dịch vụ đang ngủ không tính giờ, hết giờ thì tạm dừng đến đầu tháng. Tệp ghi trên đĩa mất khi triển khai lại, khởi động lại hoặc ngủ; không gắn ổ đĩa. Render có thể khởi động lại bất kỳ lúc nào. PostgreSQL miễn phí hết hạn sau 30 ngày (không dùng). Trang không ghi RAM, CPU. | render.com/docs/free                                                           |
| Koyeb, bản miễn phí          | Mỗi tổ chức một bản: 512 MB RAM, 0,1 vCPU, 2 GB SSD. Chỉ một vùng, Frankfurt hoặc Washington, D.C. (không có Singapore). Ngủ sau 1 giờ không có yêu cầu; chỉ dịch vụ web; không gắn ổ đĩa. Có tin Mistral AI mua Koyeb tháng 2/2026. Trang giá không ghi rõ có cần thẻ thanh toán.                                                                                                             | koyeb.com/docs/reference/instances                                             |
| Neon Free                    | 100 dự án mỗi tổ chức. Mỗi dự án 1 GB, cả tài khoản 20 GB. 100 giờ máy tính mỗi dự án. Tự tạm dừng sau 5 phút rảnh, không tắt được. Có bộ gom kết nối (PgBouncer, chế độ theo giao dịch). Trang giá không ghi vùng: kiểm có Singapore (AWS ap-southeast-1) khi tạo dự án.                                                                                                                      | neon.com/pricing, neon.com/docs/connect/connection-pooling                     |
| Supabase Free                | Mỗi dự án 500 MB cơ sở dữ liệu. 2 dự án đang hoạt động. Tạm dừng sau 1 tuần không hoạt động. Kho tệp 1 GB, mỗi tệp tối đa 50 MB. 5 GB lưu lượng ra. Bộ gom dùng chung cổng 6543, tên đăng nhập `<vai trò>.<mã dự án>`, không hỗ trợ câu lệnh chuẩn bị có tên.                                                                                                                                  | supabase.com/pricing, supabase.com/docs/guides/database/connecting-to-postgres |
| Cloudflare R2                | 10 GB-tháng lưu trữ (lớp Standard). 1 triệu thao tác loại A, 10 triệu loại B mỗi tháng. Không tính phí lưu lượng ra.                                                                                                                                                                                                                                                                           | developers.cloudflare.com/r2/pricing                                           |
| Cloudflare Workers Free      | 100.000 yêu cầu mỗi ngày. 10 ms CPU mỗi yêu cầu, không tính thời gian chờ mạng. 50 yêu cầu con ra ngoài mỗi lần chạy. 5 Cron Triggers mỗi tài khoản. Tệp tĩnh: 20.000 tệp, mỗi tệp tối đa 25 MiB.                                                                                                                                                                                              | developers.cloudflare.com/workers/platform/limits                              |
| Cloudflare for SaaS          | 100 tên miền riêng miễn phí, mỗi tên thêm 0,10 USD. Tên miền riêng ký tự đại diện chỉ có ở gói Enterprise (không cần).                                                                                                                                                                                                                                                                         | developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans   |
| Vercel Hobby                 | Chỉ dùng phi thương mại, cá nhân. 50 tên miền mỗi dự án; 1 triệu yêu cầu CDN; 100 GB truyền nhanh mỗi tháng. Vượt hạn mức thì chờ 30 ngày.                                                                                                                                                                                                                                                     | vercel.com/docs/plans/hobby                                                    |

Hệ quả:

- Chỉ nuôi **vài trường thử**, mỗi trường một năm học đang dùng. Dung lượng thật của một trường đo sau khi dựng và ghi vào YCTD-203.
- Trường có dữ liệu lớn phải dùng gói trả phí hoặc chuyển sang hồ sơ vận hành (mục 6).
- Thử nghiệm với trường thật có thể bị coi là dùng thương mại, nên **không dùng Vercel Hobby cho trường thật**: chọn tổ hợp 1, 2 hoặc trả phí Vercel.

## 3. Chuẩn bị chung

Các bước làm trên máy của người vận hành, có kho mã nguồn và `pnpm install`.

1. Sinh khóa (không đưa lên kho):
   - khóa gốc nền tảng: `node database/dist/src/platform-command.js generate-master-key`;
   - khóa ký mã phiên: `node apps/identity/dist/generate-token-keys.js`;
   - `EDGE_SHARED_SECRET` và `INTERNAL_JOB_TOKEN`: hai chuỗi ngẫu nhiên khác nhau, ví dụ `openssl rand -base64 32`.
2. Tạo cơ sở dữ liệu `school_platform` và cơ sở dữ liệu dùng chung (theo tổ hợp). Đặt `PLATFORM_DATABASE_URL` trỏ tới địa chỉ trực tiếp, rồi chạy `node database/dist/src/platform-command.js migrate`. Máy chủ cũng tự chạy lệnh này khi khởi động (`MIGRATE_ON_START=true`).
3. Tạo tài khoản vận hành nền tảng đầu tiên từ máy của người vận hành: `PLATFORM_DATABASE_URL=… node apps/identity/dist/create-platform-operator.js`. Lệnh hỏi họ tên, tên đăng nhập, mật khẩu. Render miễn phí không có cửa sổ lệnh vào container.
4. Dựng ảnh: `docker build -f deploy/profiles/trial/container/Dockerfile.all-in-one -t <kho ảnh>/school-trial .`. Đẩy lên kho ảnh, hoặc để Render dựng từ kho Git.
5. Dựng tệp tĩnh: `sh deploy/profiles/trial/cloudflare/build-assets.sh`. Lệnh dựng ba ứng dụng với `APP_BASE_PATH` `/quan-ly/`, `/giao-vien/`, `/phu-huynh/`, và cổng nền tảng ở `/`.
6. Làm các bước của tổ hợp đã chọn.
7. Kiểm tra sau khi dựng:
   - Đăng nhập cổng nền tảng; khởi tạo một trường dữ liệu giả ở menu "Trường"; kích hoạt quản trị viên.
   - Đăng nhập `/quan-ly/` của trường.
   - Gọi `/api/v1/auth/me` bằng mã phiên của trường A ở tên miền trường B phải nhận 401.
   - Để máy chủ ngủ rồi mở lại: thấy trang "đang khởi động".
   - `npx wrangler tail` thấy Cron gọi `tick` thành công.

Mẫu biến chung: [`env.trial.example`](env.trial.example). Mỗi tổ hợp có tệp ghi đè riêng.

## 4. Bố cục `schema` và bộ gom kết nối

- Mỗi trường có các lược đồ `s_<mã>_identity`, `s_<mã>_system`, `s_<mã>_year_<năm>`, mỗi lược đồ một vai trò riêng. Múi giờ và `search_path` đặt ở mức vai trò (S1a), nên chạy đúng qua bộ gom kết nối ở chế độ theo giao dịch.
- Tệp thay đổi cấu trúc khóa bằng `pg_advisory_xact_lock` trong giao dịch. Thư viện `pg` dùng câu lệnh chuẩn bị không tên. Vì vậy migrate chạy được qua bộ gom và mã nguồn không đổi.
- `DB_HOST_ADAPTER` quyết định địa chỉ ghi vào `school_databases`:
  - `neon`: máy chủ có hậu tố `-pooler`.
  - `supabase`: bộ gom dùng chung `DB_POOLER_HOST`, cổng 6543, tên đăng nhập `<vai trò>.<SUPABASE_PROJECT_REF>` (cột `login_name`, tệp nền tảng 0100). Bộ nối này không thu hồi quyền kết nối mặc định của `PUBLIC` vào cơ sở dữ liệu `postgres`, vì dịch vụ của Supabase dùng chung cơ sở dữ liệu đó. Cách ly vẫn bằng quyền trên lược đồ và `search_path`.
  - `plain`: máy chủ tự dựng.
- Tài khoản quản trị (`PLATFORM_ADMIN_DATABASE_URL`) cần quyền tạo vai trò:
  - Neon: vai trò chủ của dự án thuộc `neon_superuser`.
  - Supabase: vai trò `postgres`.

## 5. Trường dùng dữ liệu thật: hồ sơ đồng ý và vùng máy chủ

Theo `tai_lieu/33_HO_SO_PHAP_LY/00_MUC_LUC.md` mục 2 (PL-00). Bộ mẫu là bản nháp; **luật sư của Eric rà trước khi dùng**.

1. Nền tảng hoàn tất các hồ sơ sau, và phiếu chấp nhận rủi ro của Eric (PL-09) còn hiệu lực. PL-09 ghi căn cứ lưu trữ dữ liệu tại Việt Nam theo Luật An ninh mạng số 116/2025/QH15 và Nghị định 333/2026/NĐ-CP; Nghị định 53/2022/NĐ-CP chưa rõ còn hiệu lực, luật sư kiểm:
   - PL-15: điều kiện của chính nền tảng;
   - PL-11: cấp độ hệ thống;
   - PL-12: quy trình xử lý sự cố;
   - PL-13: chính sách lưu giữ và xóa.
2. Hai bên ký hợp đồng PL-01 kèm thỏa thuận xử lý dữ liệu PL-02. Trường ký văn bản đồng ý PL-03 và gửi thông báo cho cha mẹ. Trường lập PL-06, PL-07 theo Nghị định 13/2023/NĐ-CP và nộp cơ quan chuyên trách.
3. Người vận hành lập bản ghi vùng máy chủ PL-08 cho tổ hợp đang dùng, kiểm vùng thật trên bảng điều khiển của từng nhà cung cấp. Mẫu dòng `school_hosting` cho từng tổ hợp ở `to-hop-*/hosting.example.json`.
4. Ở bước setup của cổng nền tảng (hoặc `platform provision --file`, mẫu [`setup.consented.example.json`](setup.consented.example.json)):
   - chọn loại dữ liệu "Dữ liệu thật có đồng ý";
   - nhập đủ bốn hồ sơ `dpa`, `consent`, `impact-assessment`, `risk-acceptance` kèm mã băm SHA-256 của bản quét;
   - nhập các dòng vùng máy chủ.

   Thiếu hồ sơ thì máy chủ từ chối (S2). Với `PLATFORM_DATA_POLICY=consent-required` (mặc định của hồ sơ này), máy chủ không nhận loại `production`, vì máy chủ đặt ngoài Việt Nam. `synthetic-only` khóa chặt chỉ cho dữ liệu giả.

5. Số định danh của trẻ mã hóa bằng khóa riêng của trường. Khóa này bọc bằng `PLATFORM_MASTER_KEY`, chỉ đặt ở máy chủ ứng dụng (Render, Koyeb), không ở nhà cung cấp cơ sở dữ liệu (PL-14). Phần dữ liệu còn lại nằm dạng rõ trong cơ sở dữ liệu. Đây là biện pháp giảm rủi ro, không phải mã hóa toàn bộ.
6. Cổng biên hiện biểu ngữ "Môi trường thử nghiệm, máy chủ đặt ngoài Việt Nam" ở mọi trang (`DATA_POLICY` của Worker).

## 6. Chuyển một trường sang hồ sơ vận hành (VPS trong nước) không sửa mã

1. Dựng hồ sơ vận hành theo `deploy/profiles/production/README.md`, với cùng phiên bản mã.
2. Ở cổng nền tảng thử nghiệm, **tạm dừng** trường (hoặc để chỉ đọc), để dữ liệu không đổi trong lúc chép.
3. Chạy `sh deploy/profiles/trial/scripts/relayout.sh <mã trường>` từ máy có kết nối tới cả hai nơi, với biến `TARGET_PLATFORM_*` của đích. Lệnh `platform relayout`:
   - ghi trường ở nền tảng đích;
   - bọc lại khóa dữ liệu trẻ bằng khóa gốc của đích;
   - tạo cơ sở dữ liệu theo bố cục `database` và chạy migrate;
   - chép từng bảng trong một giao dịch;
   - so số dòng và tổng kiểm (md5) từng bảng. Lệch thì dừng, không bật trường.
4. Chép tệp từ R2 hoặc Supabase Storage sang kho tệp của VPS, giữ nguyên khóa. Ví dụ `rclone sync r2:school-files/tenants/<tiền tố>/ vps:school-files/tenants/<tiền tố>/`, rồi so số tệp.
5. Chuyển tên miền:
   - bản ghi DNS trỏ về VPS;
   - gỡ tên miền riêng khỏi Cloudflare for SaaS hoặc Vercel, hoặc để Caddy đứng sau.
6. Ở nền tảng đích:
   - ghi `school_hosting` mới (Việt Nam);
   - đổi loại dữ liệu sang `production`;
   - mở lại trường.
7. Ở nền tảng thử nghiệm: yêu cầu xóa trường, rồi xóa vĩnh viễn sau thời gian chờ. Yêu cầu nhà cung cấp xóa bản sao lưu nếu có, và giữ biên bản (PL-10).

Trường dữ liệu giả có thể dựng lại bằng khởi tạo, thay cho chuyển.

## 7. Sao lưu và khôi phục ở hồ sơ thử nghiệm

Giới hạn sao lưu của nhà cung cấp, tra trang chính thức ngày 2026-10-25:

- **Neon Free:** khoảng lịch sử 6 giờ, giới hạn 1 GB, để khôi phục về một thời điểm. Một bản chụp thủ công mỗi dự án, không có bản chụp theo lịch, không có khôi phục tức thì. Nguồn: neon.com/pricing.
- **Supabase Free:** không có sao lưu tự động hằng ngày (chỉ gói Pro, Team, Enterprise: giữ 7, 14, đến 30 ngày), không có khôi phục về một thời điểm (tiện ích thêm của gói trả phí). Supabase khuyên dự án miễn phí tự xuất dữ liệu định kỳ. Nguồn: supabase.com/docs/guides/platform/backups.
- **Render Free:** đĩa mất khi khởi động lại, nên không giữ bản sao lưu trong container.

Vì vậy lớp chính là **sao lưu logic theo từng trường** (`platform backup-school`), chạy bên ngoài nền tảng:

1. Sao chép [`github-actions-backup.yml.example`](github-actions-backup.yml.example) vào kho triển khai. Lịch hằng ngày chạy `backup-school --all` với biến của nền tảng (địa chỉ trực tiếp của Neon hoặc bộ gom ở chế độ phiên của Supabase), rồi đẩy tệp `.sbak` lên R2 bằng rclone.
2. Tệp mã hóa AES-256-GCM bằng `BACKUP_ENCRYPTION_PASSPHRASE`; đặt khóa này ở bí mật của GitHub. Lưu khóa và `PLATFORM_MASTER_KEY` ở nơi khác ngoài GitHub.
3. Hằng tháng chạy `restore-drill --all` trong cùng luồng việc. Kết quả ghi vào bảng `backup_runs` của nền tảng. Diễn tập tạo lược đồ tạm trong cơ sở dữ liệu dùng chung, nên cần dư dung lượng của gói (Neon 1 GB một dự án, Supabase 500 MB).

Mục tiêu ở hồ sơ thử nghiệm (giả định): RPO ≤ 24 giờ (sao lưu hằng ngày), hoặc ≤ 6 giờ nếu dùng lịch sử của Neon Free cho cả cơ sở dữ liệu; RTO ≤ 2 giờ cho một trường. Trường dữ liệu thật cần RPO nhỏ hơn thì chạy sao lưu dày hơn, hoặc chuyển sang hồ sơ vận hành (mục 6).
