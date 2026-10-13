# Bản nháp tài liệu DT-12 phần 12d (YCTD-92)

Tệp này để người phụ trách tài liệu đưa vào `tai_lieu/` (nhật ký dự án, lịch sử phiên bản, YCTD-92, kiến trúc mục 11 và 12). Không sửa `tai_lieu/` trong phần này.

## 1. Tóm tắt

Chuẩn bị cấu hình triển khai môi trường chạy thật trên một máy chủ Linux chạy Docker Compose (Eric quyết định ngày 2026-10-13: Claude chuẩn bị cấu hình trước, Eric thuê máy chủ đám mây trong nước sau, việc T6).

| Tệp                                                                   | Nội dung                                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy/docker/server.Dockerfile`                                     | Ảnh nhiều tầng cho máy chủ API (đích `api`) và dịch vụ định danh (đích `identity`): Node 24 Alpine, pnpm 10.12.1, chỉ thư viện chạy thật, chạy bằng tài khoản `node`, có `tini` và healthcheck                                   |
| `deploy/docker/web.Dockerfile`                                        | Dựng ba giao diện (portal, phụ huynh, giáo viên) rồi đặt vào ảnh Caddy 2.10                                                                                                                                                      |
| `deploy/caddy/Caddyfile`                                              | Bốn tên miền lấy từ biến môi trường, HTTPS tự động, chuyển `/api/v1` sang hai dịch vụ, tiêu đề bảo mật, lưu đệm tệp tĩnh, nhật ký JSON                                                                                           |
| `deploy/docker-compose.production.yml`                                | postgres 17, redis (appendonly, mật khẩu), seaweedfs (có kiểm tra khóa S3, bật bằng profile), migrate (chạy một lần), identity, api, web; healthcheck, `restart: unless-stopped`, xoay vòng nhật ký 5 × 20 MB; chỉ `web` mở cổng |
| `deploy/.env.production.example`                                      | Mọi biến môi trường của hai dịch vụ, Caddy, sao lưu, kèm chú thích tiếng Việt; chỗ để sẵn cho eSMS, cổng thanh toán, Facebook, Zalo                                                                                              |
| `deploy/scripts/generate-keys.sh`                                     | Sinh mật khẩu, cặp khóa Ed25519, khóa dữ liệu trẻ, khóa S3, mật khẩu mã hóa bản sao lưu; in ra hoặc điền vào biến trống của tệp `.env`                                                                                           |
| `deploy/scripts/backup.sh`, `restore.sh`, `lib.sh`, `crontab.example` | Sao lưu hằng ngày và hằng giờ theo SL-01 đến SL-05, khôi phục, lịch chạy mẫu                                                                                                                                                     |
| `deploy/README.md`                                                    | Cấu hình máy chủ, DNS, triển khai lần đầu, tạo tài khoản VT-01, cập nhật, sao lưu và diễn tập phục hồi, CT-086 đến CT-089, giám sát                                                                                              |
| `.github/workflows/ci.yml`                                            | Thêm việc `dung-anh-docker` dựng ba ảnh (không đẩy lên kho ảnh), kiểm tra cú pháp tệp Compose và cấu hình Caddy; việc `kiem-thu` giữ nguyên                                                                                      |
| `.dockerignore`, `.gitignore`                                         | Ngữ cảnh dựng ảnh gọn; bỏ qua `deploy/.env.*` trừ tệp mẫu                                                                                                                                                                        |
| `packages/server/src/trust-proxy.ts`, `apps/*/src/main.ts`            | Biến `TRUST_PROXY` để hai dịch vụ lấy địa chỉ người dùng từ `X-Forwarded-For` khi chạy sau Caddy                                                                                                                                 |
| `apps/api/package.json`, `pnpm-lock.yaml`                             | Chuyển `kysely` và `@school-management/database` từ thư viện phát triển sang thư viện chạy thật của máy chủ API                                                                                                                  |

## 2. Quyết định đã chọn (ghi vào YCTD-92)

1. Node 24 Alpine thay cho Node 22 nêu trong giao việc: `package.json` yêu cầu `node >=24` và CI chạy Node 24; Node 24 là bản LTS.
2. Một `server.Dockerfile` có hai đích `api` và `identity` để dùng chung tầng dựng. Thư viện chạy thật cài bằng `pnpm install --prod --config.node-linker=hoisted` theo bộ lọc của từng dịch vụ, vì gói `@school-management/server` dùng `@nestjs/common` qua phụ thuộc ngang hàng; cách dàn phẳng giúp gói dùng chung tìm được thư viện của dịch vụ.
3. Máy chủ API dùng `kysely` (`sql`) và `@school-management/database` (`createDatabase`) lúc chạy nhưng hai gói đang khai ở thư viện phát triển; đã chuyển sang `dependencies`, không thì ảnh chỉ có thư viện chạy thật sẽ lỗi khi khởi động.
4. Dịch vụ `migrate` dùng ảnh `identity` (đã có gói `database`) chạy `database/dist/src/migrate-command.js`; `identity` và `api` chờ `service_completed_successfully`. Lệnh tạo VT-01 đầu tiên cũng nằm trong ảnh `identity`: `docker compose ... exec identity node dist/create-platform-administrator.js` (hỏi qua bàn phím, cần TTY).
5. Định tuyến: mỗi giao diện một tên miền con (`portal.`, `phuhuynh.`, `giaovien.`), giao diện gọi `/api/v1` cùng tên miền và Caddy chuyển nhóm `auth`, `users`, `roles`, `permissions`, `api-clients` sang dịch vụ định danh, phần còn lại sang máy chủ API, đúng như cấu hình chuyển tiếp của Vite khi phát triển. Lý do: cookie mã làm mới đang đặt `SameSite=Strict`, `Secure`, không có `Domain`, đường dẫn `/api/v1/auth` (BM-71); giữ cùng tên miền thì không phải sửa cookie, không cần CORS. Không dựng tên miền `id.` riêng. Tên miền `api.` phục vụ API đối tác, webhook cổng thanh toán và kiểm tra sức khỏe từ ngoài; trang gốc trả 404.
6. Thêm biến `TRUST_PROXY` (mặc định trong Compose là `uniquelocal`) và hàm `applyTrustProxy` ở `packages/server`. Không có thì mọi yêu cầu sau Caddy mang địa chỉ của Caddy: giới hạn 10 lần đăng nhập mỗi phút theo địa chỉ sẽ chặn chung toàn trường và nhật ký ghi sai địa chỉ. Caddy ghi đè `X-Forwarded-For` do người dùng tự gửi nên không giả mạo được. Có kiểm thử `apps/identity/src/trust-proxy.test.ts`.
7. Giữ nguyên chốt chặn của YCTD-43, YCTD-93: `NODE_ENV=production` thì dịch vụ định danh và máy chủ API từ chối khởi động khi chưa đặt `SMS_PROVIDER=esms`. Môi trường thử nghiệm chưa có tài khoản eSMS đặt `NODE_ENV=staging`. Tệp biến môi trường mẫu có đủ biến của eSMS (YCTD-93), bốn cổng thanh toán (YCTD-94), Fanpage và Zalo thật (YCTD-95).
8. Kho tệp mặc định là SeaweedFS cùng máy, bật kiểm tra khóa S3 bằng tệp cấu hình sinh từ biến môi trường lúc khởi động, chạy theo profile `seaweedfs`. Dùng kho đối tượng của nhà cung cấp thì để trống `COMPOSE_PROFILES` và đặt `S3_*`; máy chủ API không phụ thuộc cứng vào dịch vụ seaweedfs (`required: false`).
9. Redis có mật khẩu (`REDIS_PASSWORD`, ghép vào `REDIS_URL`) và `appendonly yes`. Chỉ dịch vụ định danh dùng Redis.
10. Múi giờ `Asia/Ho_Chi_Minh` cho mọi vùng chứa, giống máy phát triển; cơ sở dữ liệu vẫn đặt múi giờ riêng qua tệp thay đổi cấu trúc.
11. Không triển khai `apps/worker`: tiến trình này hiện chỉ kết nối Redis, chưa có tác vụ; tiến trình gửi thông báo chạy trong máy chủ API (CB-05, CB-07).
12. Sao lưu theo SL-01 đến SL-05:
    - Hằng ngày: `pg_dump -Fc` mọi cơ sở dữ liệu tìm động (`school_identity`, `school_system`, mọi `school_year_*` trong `pg_database`), `pg_dumpall --globals-only`, kho tệp đóng gói; giữ 30 ngày. Năm học đã đóng (`academic_year_databases.status = 'read_only'`) chép một lần vào `archive/`, không xóa.
    - Hằng giờ (SL-02, RPO 1 giờ): cơ sở dữ liệu định danh, hệ thống và năm học đang dùng, bản đầy đủ thay cho sao lưu tăng dần vì dữ liệu nhỏ (dưới 1 000 trẻ, mỗi tệp dưới 1 MB khi thử); giữ 48 giờ. Bản chép kho tệp `files-mirror/` đồng bộ mỗi giờ.
    - Mã hóa AES-256 bằng `openssl enc -pbkdf2` (SL-05), kiểm tra giải mã và đọc mục lục ngay sau khi ghi (BR-76), `SHA256SUMS`, quyền tệp 600, khóa chống chạy chồng.
    - Kho ngoài máy chủ: rclone chạy trong vùng chứa đẩy bản đã mã hóa sang kho S3 khác (`OFFSITE_S3_*`), xóa bản quá hạn ở cả hai nơi.
13. Khôi phục: `pg_restore --clean --if-exists --create` để tạo lại cơ sở dữ liệu cùng chủ sở hữu, quyền kết nối và thiết lập chỉ đọc; đặt `PGOPTIONS=-c default_transaction_read_only=off` cho phiên khôi phục vì thiết lập chỉ đọc của năm học đã đóng được tạo lại trước khi nạp dữ liệu (lỗi đã gặp khi thử, đã sửa).
14. Ảnh dựng ngay trên máy chủ từ mã nguồn (`docker compose build`), gắn `IMAGE_TAG` theo phiên bản để quay lui; chưa dùng kho ảnh.
15. Việc CI mới `dung-anh-docker` chạy song song với `kiem-thu`, dùng bộ nhớ đệm GitHub Actions, không đẩy ảnh.

## 3. Kiểm tra đã làm (máy cục bộ, Docker Desktop 4.93, dự án `sm-prod-test`, cổng 18080/18443)

1. `docker compose -f deploy/docker-compose.production.yml config`: hợp lệ.
2. `docker compose ... build`: dựng được ba ảnh; `api` 407 MB, `identity` 396 MB, `web` 85 MB. Hai ảnh máy chủ chạy bằng `uid=1000(node)`.
3. `docker compose ... up -d --wait`: mọi dịch vụ `healthy`, `migrate` thoát mã 0 sau khi chạy hết tệp thay đổi cấu trúc của `school_identity` và `school_system`; chỉ `web` mở cổng; nhật ký `json-file` 20m × 5, `restart: unless-stopped`.
4. Qua Caddy: `GET /api/v1/health` 200 trên cả bốn tên miền; ba giao diện trả `index.html`, đường dẫn lạ trả `index.html` (định tuyến phía trình duyệt); tiêu đề bảo mật và `Cache-Control` đúng; trang gốc của `api.` trả 404; API đối tác không khóa trả 401.
5. Đăng nhập kênh portal qua `portal.localhost`: 200, cookie `refresh_token` có `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`; `GET /api/v1/auth/me` và `GET /api/v1/academic-years` bằng mã phiên đi đúng dịch vụ; `POST /api/v1/auth/refresh` bằng cookie 200.
6. Địa chỉ ghi ở bảng `sessions` là địa chỉ máy khách mà Caddy thấy (172.19.0.1), không phải địa chỉ vùng chứa Caddy (172.19.0.7); `X-Forwarded-For` giả do máy khách gửi bị Caddy ghi đè.
7. Tài khoản `api_service` tạo được cơ sở dữ liệu năm học (`CREATE DATABASE`, QĐ-21); chạy lại `migrate` nâng cấu trúc cho năm học đang dùng (44 tệp thay đổi cấu trúc).
8. SeaweedFS từ chối khóa sai (`InvalidAccessKeyId`), nhận khóa trong `.env`.
9. `backup.sh daily`: sao lưu bốn cơ sở dữ liệu (hai năm học tìm động), danh sách tài khoản, kho tệp; chép năm học đã đóng vào `archive/`; đẩy sang kho ngoài máy chủ giả lập (thùng chứa khác). `backup.sh hourly`: bỏ qua năm học đã đóng, đẩy sang kho ngoài máy chủ.
10. `restore.sh --files --yes` sau khi xóa dữ liệu thử, xóa phiên đăng nhập, xóa hẳn cơ sở dữ liệu năm học đã đóng và xóa tệp trong kho: khôi phục đủ bốn cơ sở dữ liệu và tệp trong 49 giây; năm học đã đóng có lại `default_transaction_read_only=on`; quyền kết nối của `school_identity`, `school_system` giữ nguyên; đăng nhập và gọi API lại được.
11. `shellcheck` (bash cho ba tệp sao lưu, sh cho `generate-keys.sh`): không cảnh báo.
12. `pnpm format:check`, `pnpm lint`, `pnpm build`, `pnpm typecheck`: đạt. Kiểm thử `apps/identity` `trust-proxy.test.ts` và `health.controller.test.ts`: đạt.
13. Đã `down -v` dự án `sm-prod-test`, xóa ba ảnh thử; vùng chứa phát triển không bị đụng tới.

## 4. Giới hạn và việc còn lại

1. Chưa thử HTTPS thật (cần tên miền và máy chủ có địa chỉ công khai); trên máy cục bộ chỉ thử `http://*.localhost`, trình duyệt không lưu cookie `Secure` trên http nên chỉ thử đăng nhập bằng `curl`.
2. Kết nối eSMS, bốn cổng thanh toán, Fanpage và Zalo đã có mã nguồn (YCTD-93 đến YCTD-95) nhưng chưa thử với tài khoản thật; cần khóa của nhà cung cấp khi triển khai.
3. CT-086 đến CT-089 chưa chạy: cần môi trường thử nghiệm trên máy chủ thuê (T6). README mục 7.4 và 8 ghi cách chạy và tiêu chí đạt. Lần thử cục bộ ở mục 3.10 chỉ là thử kịch bản khôi phục, chưa phải CT-089 có biên bản.
4. Tệp đính kèm chỉ đẩy ra kho ngoài máy chủ mỗi ngày; nếu mất hẳn máy chủ, tệp tải lên trong ngày có thể mất tới 24 giờ (cơ sở dữ liệu vẫn đạt 1 giờ). Dùng kho đối tượng của nhà cung cấp sẽ giảm rủi ro này.
5. Sao lưu hằng giờ là bản đầy đủ của cơ sở dữ liệu đang dùng, chưa dùng lưu trữ WAL; đủ cho quy mô hiện tại, cần xem lại nếu dữ liệu lớn lên nhiều.
6. Giám sát số đo (thời gian phản hồi từng điểm cuối, hàng đợi thông báo, tỷ lệ đăng nhập sai, 12_KIEN_TRUC_HE_THONG.md mục 10) chưa có công cụ; README chỉ nêu giám sát cơ bản (healthcheck, kiểm tra thời gian hoạt động từ ngoài, nhật ký, cảnh báo sao lưu).
7. Lệnh tạo VT-01 đầu tiên chỉ chạy được khi có bàn phím (TTY); không dùng được bằng đường ống.
8. Thử nghiệm làm trên Windows (Git Bash): `lib.sh` có dòng `pwd -W` để chạy được trên Git Bash, trên Linux tự dùng `pwd`.
