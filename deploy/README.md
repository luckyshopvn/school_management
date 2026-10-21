# Triển khai môi trường chạy thật

- Mã việc: DT-12 phần 12d (YCTD-92); dùng khi làm việc T6 (thuê máy chủ đám mây trong nước, QĐ-12).
- Mô hình: một máy chủ Linux chạy Docker Compose. Toàn bộ cấu hình nằm trong thư mục `deploy/`.

## 1. Thành phần

| Dịch vụ     | Ảnh                                                | Vai trò                                                                                                         | Cổng mở ra ngoài     |
| ----------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| `web`       | `deploy/docker/web.Dockerfile` (Caddy 2.10)        | Phục vụ ba giao diện, chuyển `/api/v1` sang hai dịch vụ, tự cấp chứng chỉ HTTPS                                 | 80, 443 (TCP và UDP) |
| `identity`  | `deploy/docker/server.Dockerfile`, đích `identity` | Dịch vụ định danh                                                                                               | Không                |
| `api`       | `deploy/docker/server.Dockerfile`, đích `api`      | Máy chủ API nghiệp vụ, tiến trình gửi thông báo                                                                 | Không                |
| `migrate`   | Cùng ảnh `identity`                                | Chạy tệp thay đổi cấu trúc cho mọi cơ sở dữ liệu rồi dừng; `identity` và `api` chỉ chạy khi bước này thành công | Không                |
| `postgres`  | `postgres:17-alpine`                               | `school_identity`, `school_system`, các `school_year_*`                                                         | Không                |
| `redis`     | `redis:7-alpine`                                   | Giới hạn đăng nhập, mã OTP; bật `appendonly`, có mật khẩu                                                       | Không                |
| `seaweedfs` | `chrislusf/seaweedfs:3.80`                         | Kho tệp tương thích S3, có kiểm tra khóa truy cập; bật bằng `COMPOSE_PROFILES=seaweedfs`                        | Không                |

Định tuyến của Caddy:

| Tên miền (biến trong `.env`)                | Nội dung                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `PORTAL_SITE`, ví dụ `portal.<tên miền>`    | Trang quản lý cho cán bộ                                                                                                    |
| `PARENT_SITE`, ví dụ `phuhuynh.<tên miền>`  | Ứng dụng phụ huynh                                                                                                          |
| `TEACHER_SITE`, ví dụ `giaovien.<tên miền>` | Ứng dụng giáo viên                                                                                                          |
| `API_SITE`, ví dụ `api.<tên miền>`          | API chỉ đọc cho đối tác (YCTD-63), địa chỉ cổng thanh toán gọi về, kiểm tra sức khỏe từ bên ngoài                           |
| Mọi tên miền khác (khối `https://`)         | Website công khai của trường (YCTD-144): chỉ tên miền đã thêm ở màn hình "Website trường → 1.2. Tên miền" của cổng quản trị |

Website của trường (DT-18 phần 18f, YCTD-144) không có biến trong `.env`: tên miền lưu trong cơ sở dữ liệu hệ thống. Khi có truy cập đầu tiên tới một tên miền lạ, Caddy hỏi `http://api:3000/api/v1/public/website/domain-check?domain=...` (cấp chứng chỉ theo yêu cầu, `on_demand_tls`) và chỉ xin chứng chỉ khi máy chủ API trả 200, tức tên miền đã được thêm và đang dùng. Mọi đường dẫn của tên miền website chuyển sang `/api/v1/public/site` của máy chủ API; các điểm cuối khác của `/api/v1` không mở trên tên miền website. Quy trình: quản trị thêm tên miền ở cổng quản trị, trỏ bản ghi A hoặc CNAME của tên miền về địa chỉ máy chủ, rồi bấm "Đánh dấu đã trỏ". Khi thử trên máy không có tên miền thật, dùng tên miền trình diễn dạng `<tên>.localhost` và mở thẳng `http://<tên>.localhost:3000/api/v1/public/site` của máy chủ API.

Trên mỗi tên miền, `/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`, `/api/v1/permissions`, `/api/v1/api-clients` chuyển sang dịch vụ định danh, phần còn lại của `/api/v1` sang máy chủ API, giống cấu hình chuyển tiếp khi phát triển (17_DAC_TA_API.md quy ước 8). Giao diện gọi `/api/v1` cùng tên miền nên không cần CORS, và cookie mã làm mới (`SameSite=Strict`, `Secure`, đường dẫn `/api/v1/auth`, mỗi kênh một tên cookie, BM-71) luôn là cookie cùng tên miền. Không cần tên miền riêng cho dịch vụ định danh.

## 2. Cấu hình máy chủ gợi ý

Quy mô: dưới 1 000 trẻ, khoảng 100 người dùng đồng thời (12_KIEN_TRUC_HE_THONG.md mục 14).

| Hạng mục     | Tối thiểu                                                                           | Khuyến nghị                                                            |
| ------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| CPU          | 2 nhân                                                                              | 4 nhân                                                                 |
| Bộ nhớ       | 4 GB (đặt `POSTGRES_SHARED_BUFFERS=256MB`, `POSTGRES_EFFECTIVE_CACHE_SIZE=1GB`)     | 8 GB (giá trị mặc định trong `.env.production.example`)                |
| Ổ đĩa        | 80 GB SSD                                                                           | 160 GB SSD; bản sao lưu 30 ngày cộng kho tệp chiếm phần lớn dung lượng |
| Hệ điều hành | Ubuntu 24.04 LTS                                                                    | Ubuntu 24.04 LTS                                                       |
| Phần mềm     | Docker Engine 27 trở lên kèm Docker Compose v2.24 trở lên, `git`, `openssl`, `curl` |                                                                        |

Nơi cất bản sao lưu ngoài máy chủ (SL-05): một kho đối tượng S3 ở nhà cung cấp khác hoặc vùng khác (dữ liệu vẫn ở Việt Nam, QĐ-12).

## 3. Tên miền

Tạo bốn bản ghi DNS loại A (và AAAA nếu có IPv6) trỏ về địa chỉ máy chủ: `portal`, `phuhuynh`, `giaovien`, `api`. Bản ghi phải có hiệu lực trước lần khởi động đầu để Caddy xin được chứng chỉ Let's Encrypt. Tường lửa chỉ mở 22 (SSH, nên giới hạn địa chỉ), 80 và 443.

## 4. Triển khai lần đầu

```bash
# 1. Cài Docker theo hướng dẫn chính thức, thêm tài khoản vận hành vào nhóm docker, đặt múi giờ
sudo timedatectl set-timezone Asia/Ho_Chi_Minh

# 2. Lấy mã nguồn (kho riêng trên GitHub, dùng khóa triển khai chỉ đọc)
sudo mkdir -p /opt/school-management && sudo chown "$USER" /opt/school-management
git clone git@github.com:luckyshopvn/school_management.git /opt/school-management
cd /opt/school-management
git checkout <thẻ phiên bản phát hành>

# 3. Tạo cấu hình
cp deploy/.env.production.example deploy/.env
sh deploy/scripts/generate-keys.sh deploy/.env   # điền mật khẩu và khóa còn trống
nano deploy/.env                                  # tên miền, ACME_EMAIL, kho ngoài máy chủ, NODE_ENV, ...
chmod 600 deploy/.env

# 4. Dựng ảnh và khởi động
docker compose -f deploy/docker-compose.production.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.production.yml --env-file deploy/.env ps
docker compose -f deploy/docker-compose.production.yml --env-file deploy/.env logs migrate
```

Để gõ ngắn hơn, đặt bí danh trong `~/.bashrc`:

```bash
alias dc='docker compose -f /opt/school-management/deploy/docker-compose.production.yml --env-file /opt/school-management/deploy/.env'
```

Các mục dưới dùng bí danh `dc`.

Lưu ý:

1. `NODE_ENV=production` thì dịch vụ định danh và máy chủ API từ chối khởi động khi chưa đặt `SMS_PROVIDER=esms` với khóa eSMS.vn (YCTD-43, YCTD-93). Môi trường thử nghiệm chưa có tài khoản eSMS đặt `NODE_ENV=staging`; mã OTP khi đó chỉ ghi vào nhật ký `dc logs identity`. Có tài khoản thì thử trước với `ESMS_SANDBOX=true`.
2. `PAYMENT_GATEWAY`, `FACEBOOK_PUBLISHER`, `ZALO_SENDER` không được đặt `development` ở môi trường chạy thật (đó là bộ giả lập).
3. Cất bản sao `CHILD_DATA_ENCRYPTION_KEY`, `CHILD_DATA_HASH_KEY`, `BACKUP_ENCRYPTION_PASSPHRASE` ở nơi khác máy chủ (két mật khẩu của nhà trường). Mất hai khóa đầu thì không đọc được số định danh của trẻ; mất khóa thứ ba thì không khôi phục được bản sao lưu.
4. Kiểm tra sau khi chạy: `curl -fsS https://api.<tên miền>/api/v1/health` trả `{"status":"ok","service":"api"}`; mở `https://portal.<tên miền>` thấy trang đăng nhập.

### 4.1. Dùng kho đối tượng của nhà cung cấp đám mây thay SeaweedFS

Trong `deploy/.env`: để trống `COMPOSE_PROFILES`, đặt `S3_ENDPOINT` (địa chỉ của nhà cung cấp), `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` do nhà cung cấp cấp. Nhà cung cấp phải hỗ trợ kiểu đường dẫn (path-style). Thùng chứa nên đặt riêng tư, bật mã hóa phía máy chủ nếu có. Máy chủ API tự tạo thùng chứa ở lần ghi đầu nếu khóa có quyền; không thì tạo trước trên trang quản trị của nhà cung cấp.

## 5. Tạo tài khoản VT-01 đầu tiên

Tài khoản đầu tiên tạo bằng lệnh của dịch vụ định danh (PQ-10), hỏi họ tên, tên đăng nhập, mật khẩu (8 ký tự trở lên, có chữ và số, YCTD-35):

```bash
dc exec identity node dist/create-platform-administrator.js
```

Đăng nhập trang quản lý bằng tài khoản này, tạo tài khoản Hiệu trưởng (VT-02) và các tài khoản khác trên giao diện, mở năm học đầu tiên (máy chủ API tạo cơ sở dữ liệu `school_year_YYYY_YYYY`). Nên chạy sao lưu ngay trước khi mở năm học (RR-13).

## 6. Cập nhật phiên bản

```bash
cd /opt/school-management
bash deploy/scripts/backup.sh daily              # bản sao lưu ngay trước khi cập nhật để quay lui được
git fetch --tags && git checkout <thẻ phiên bản mới>
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<phiên bản mới>/' deploy/.env
dc build
dc up -d                                          # migrate chạy trước, identity và api khởi động lại sau khi migrate thành công
dc ps && dc logs --tail 50 migrate identity api
```

Quay lui: `git checkout <thẻ cũ>`, đặt lại `IMAGE_TAG` cũ (ảnh cũ vẫn còn trên máy), `dc up -d`. Nếu phiên bản mới đã đổi cấu trúc cơ sở dữ liệu, khôi phục bản sao lưu vừa chụp theo mục 7.3 trước khi chạy ảnh cũ.

## 7. Sao lưu và khôi phục

Yêu cầu (12_KIEN_TRUC_HE_THONG.md mục 11, 22_BAO_MAT.md BM-42 đến BM-45): sao lưu toàn bộ hằng ngày, giữ tối thiểu 30 ngày (SL-01); sao lưu dữ liệu tài chính mỗi giờ (SL-02); kiểm tra phục hồi hằng tháng trên môi trường tách biệt, có biên bản (SL-03); khôi phục trong 4 giờ, mất tối đa 1 giờ dữ liệu (SL-04); bản sao lưu mã hóa, đặt ngoài máy chủ (SL-05); chỉ quản trị nền tảng truy cập bản sao lưu (BM-45).

### 7.1. Cách làm

| Lệnh                                   | Nội dung                                                                                                                                                                                     | Giữ                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `bash deploy/scripts/backup.sh daily`  | `pg_dump -Fc` mọi cơ sở dữ liệu: `school_identity`, `school_system`, mọi `school_year_*` tìm thấy trong PostgreSQL (năm học mới mở tự có mặt); danh sách tài khoản kết nối; kho tệp đóng gói | `BACKUP_RETENTION_DAYS` ngày (mặc định 30)        |
| `bash deploy/scripts/backup.sh hourly` | `school_identity`, `school_system` và năm học đang dùng (chứa dữ liệu tài chính); đồng bộ bản chép kho tệp `files-mirror/`                                                                   | `BACKUP_HOURLY_RETENTION_HOURS` giờ (mặc định 48) |

- Mỗi tệp mã hóa AES-256 (`openssl enc -pbkdf2`) bằng `BACKUP_ENCRYPTION_PASSPHRASE` và được giải mã, đọc thử mục lục ngay sau khi ghi (BR-76). Thư mục bản sao lưu có `manifest.txt` và `SHA256SUMS`.
- Năm học đã đóng (`read_only`) được chép thêm một lần vào `archive/` và không bao giờ bị xóa (SL-01).
- Có `OFFSITE_S3_BUCKET` thì đẩy sang kho ngoài máy chủ bằng rclone (chạy trong vùng chứa), xóa bản quá hạn ở cả hai nơi. Kho ngoài máy chủ nên bật khóa chống xóa (object lock) hoặc phiên bản tệp nếu nhà cung cấp hỗ trợ.
- `BACKUP_DIR` đặt quyền chỉ tài khoản vận hành đọc được (`chmod 700`); tệp sinh ra có quyền 600 (BM-45).
- RPO: bản hằng giờ đáp ứng mất tối đa 1 giờ dữ liệu cơ sở dữ liệu. Tệp đính kèm tải lên trong giờ được giữ ở bản chép cục bộ `files-mirror/` mỗi giờ nhưng chỉ đẩy ra ngoài máy chủ mỗi ngày; nếu mất hẳn máy chủ, tệp đính kèm có thể mất tới 24 giờ. Muốn chặt hơn thì dùng kho đối tượng của nhà cung cấp (mục 4.1, nhà cung cấp tự nhân bản dữ liệu).
- RTO: dựng máy chủ mới và khôi phục theo mục 7.3 mất khoảng 1 đến 2 giờ với quy mô hiện tại, trong giới hạn 4 giờ (SL-04). Ghi thời gian thực tế ở mỗi lần diễn tập.

### 7.2. Lịch chạy

```bash
sudo mkdir -p /var/backups/school-management /var/log/school-management
sudo chown "$USER" /var/backups/school-management /var/log/school-management
chmod 700 /var/backups/school-management
crontab -e   # dán nội dung deploy/scripts/crontab.example, sửa đường dẫn
```

Đặt `BACKUP_HEALTHCHECK_URL` (ví dụ một kiểm tra trên healthchecks.io với chu kỳ 1 giờ) để được báo khi sao lưu ngừng chạy.

### 7.3. Khôi phục

```bash
# Bản trên máy chủ
bash deploy/scripts/restore.sh /var/backups/school-management/daily/2026-11-01_013000 --files

# Bản ở kho ngoài máy chủ: tải về trước (ví dụ bằng rclone cài trên máy, cấu hình kho `offsite` giống backup)
rclone copy offsite:<bucket>/school-management/daily/2026-11-01_013000 /var/backups/khoi-phuc/2026-11-01_013000
bash deploy/scripts/restore.sh /var/backups/khoi-phuc/2026-11-01_013000 --files

# Chỉ một cơ sở dữ liệu (ví dụ quay về bản hằng giờ của năm học đang dùng)
bash deploy/scripts/restore.sh /var/backups/school-management/hourly/2026-11-01_101500 --only school_year_2026_2027
```

Lệnh dừng `web`, `api`, `identity`, khôi phục từng cơ sở dữ liệu bằng `pg_restore --clean --create` (giữ chủ sở hữu, quyền kết nối và thiết lập chỉ đọc của năm học đã đóng), khôi phục kho tệp nếu có `--files`, rồi chạy lại toàn bộ hệ thống (dịch vụ `migrate` nâng cấu trúc nếu bản sao lưu cũ hơn mã nguồn). Máy chủ mới hoàn toàn: làm mục 4 với cùng `deploy/.env` (cùng khóa) rồi chạy khôi phục.

### 7.4. Diễn tập phục hồi hằng tháng (SL-03) và CT-089

Chạy trên máy tách biệt (máy chủ thử nghiệm hoặc máy chủ thuê theo giờ), không chạy trên máy chủ chính:

1. Dựng hệ thống theo mục 4 với bản sao `deploy/.env` của môi trường chạy thật nhưng đổi `COMPOSE_PROJECT_NAME` (ví dụ `school-dien-tap`), tên miền thử hoặc `http://...localhost`, cổng `HTTP_PORT`/`HTTPS_PORT`, `OFFSITE_S3_BUCKET` để trống (tránh ghi đè bản thật). Giữ nguyên khóa `CHILD_DATA_*`, `TOKEN_*` và `BACKUP_ENCRYPTION_PASSPHRASE`.
2. Tải bản sao lưu hằng ngày mới nhất từ kho ngoài máy chủ (không lấy từ máy chủ chính, để kiểm tra đúng đường cất giữ của SL-05).
3. Bấm giờ, chạy `ENV_FILE=deploy/.env.dien-tap bash deploy/scripts/restore.sh <thư mục> --files --yes`.
4. Đối chiếu: mọi tệp `*.dump.enc` đã khôi phục; số bản ghi các bảng chính (tài khoản, trẻ, hóa đơn, phiếu thu, phiếu chi) khớp với số liệu ghi tại thời điểm sao lưu; đăng nhập được bằng một tài khoản cán bộ; mở được một hồ sơ trẻ có ảnh (kiểm tra kho tệp và khóa giải mã số định danh); xem được báo cáo công nợ của năm học đang dùng và một năm học đã đóng.
5. Ghi biên bản: ngày, người thực hiện, bản sao lưu dùng (thời điểm, nơi lấy), thời gian khôi phục, kết quả từng mục đối chiếu, sự cố và cách xử lý. Kết quả CT-089 đạt khi mọi cơ sở dữ liệu khôi phục đầy đủ và thời gian trong 4 giờ.
6. Hủy môi trường diễn tập: `docker compose -p school-dien-tap ... down -v`.

## 8. Kiểm thử hiệu năng CT-086 đến CT-088

Chạy trên môi trường thử nghiệm có cấu hình giống môi trường chạy thật (21_KICH_BAN_KIEM_THU.md, 30_BAO_CAO_KIEM_THU_G3.md mục 41), dữ liệu mẫu gần với thật, không dùng dữ liệu thật. Công cụ gợi ý: k6 chạy bằng Docker từ một máy khác trong cùng vùng mạng (`docker run --rm -i grafana/k6 run - < kich-ban.js`).

| Mã     | Chuẩn bị                                                                                     | Cách chạy                                                                                                                                                                                                  | Đạt khi                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| CT-086 | 100 lớp, mỗi lớp một tài khoản giáo viên chủ nhiệm (VT-07) và khoảng 10 trẻ; năm học đang mở | Mỗi người dùng ảo đăng nhập (`POST /api/v1/auth/login` kênh `teacher`), đọc rồi ghi sổ điểm danh lớp mình (`GET` rồi `PUT /api/v1/classes/{id}/attendance`); 100 người dùng ảo chạy đồng thời trong 5 phút | Phân vị 95 thời gian phản hồi dưới 2 giây, không có lỗi 5xx                                                                     |
| CT-087 | 500 trẻ đang học có đăng ký dịch vụ, biểu phí hiệu lực                                       | Kế toán (VT-04) gọi `POST /api/v1/fee-calculations` cho tháng thử; trong lúc chạy, một kịch bản khác đọc trang chủ portal và danh sách trẻ                                                                 | Hoàn thành dưới 5 phút; các yêu cầu khác vẫn phản hồi dưới 2 giây                                                               |
| CT-088 | Hóa đơn đã phát hành cho đủ số trẻ                                                           | Gửi 1 000 yêu cầu `POST /api/v1/receipts` trong ngày thử (chia đều cho 5 đến 10 người dùng ảo, mỗi yêu cầu một `request_key` khác nhau)                                                                    | Không lỗi; truy vấn `select code, count(*) from receipts group by code having count(*) > 1` trên cơ sở dữ liệu năm học trả rỗng |

Trong lúc chạy, theo dõi `docker stats`, nhật ký câu lệnh chậm của PostgreSQL (`dc logs postgres | grep duration`) và ghi kết quả vào biên bản kiểm thử.

## 9. Giám sát cơ bản

1. Kiểm tra sức khỏe: mỗi dịch vụ có healthcheck trong Docker (`dc ps` cột STATUS). Từ bên ngoài, đặt một dịch vụ kiểm tra thời gian hoạt động (ví dụ UptimeRobot) gọi `https://api.<tên miền>/api/v1/health` và trang chủ ba giao diện mỗi phút.
2. Nhật ký: `dc logs -f --tail 100 api identity web`. Nhật ký Docker xoay vòng 5 tệp × 20 MB mỗi dịch vụ; Caddy ghi nhật ký truy cập dạng JSON; PostgreSQL ghi câu lệnh chạy quá `POSTGRES_LOG_MIN_DURATION_MS`.
3. Tài nguyên: `docker stats`, `df -h` (cảnh báo khi ổ đĩa đầy trên 80%), `du -sh /var/backups/school-management`.
4. Sao lưu: `tail /var/log/school-management/backup.log`; cảnh báo qua `BACKUP_HEALTHCHECK_URL`.
5. Chứng chỉ: Caddy tự gia hạn; thư báo hết hạn gửi về `ACME_EMAIL` nếu gia hạn thất bại.
6. Bảo mật máy chủ: chỉ đăng nhập SSH bằng khóa, bật `unattended-upgrades`, cài `fail2ban`; không mở cổng PostgreSQL, Redis, SeaweedFS ra ngoài (tệp Compose đã không mở).
7. Các yêu cầu giám sát ở 12_KIEN_TRUC_HE_THONG.md mục 10 (thời gian phản hồi từng điểm cuối, hàng đợi thông báo tồn đọng, tỷ lệ đăng nhập sai) cần thêm công cụ thu thập số đo (ví dụ Prometheus và Grafana, hoặc dịch vụ giám sát của nhà cung cấp); chưa có trong cấu hình này.

## 10. Thử cấu hình trên máy cục bộ

```bash
cp deploy/.env.production.example /tmp/sm.env && sh deploy/scripts/generate-keys.sh /tmp/sm.env
# Sửa trong /tmp/sm.env: COMPOSE_PROJECT_NAME=sm-prod-test, NODE_ENV=staging, HTTP_PORT=18080, HTTPS_PORT=18443,
# PORTAL_SITE=http://portal.localhost, PARENT_SITE=http://phuhuynh.localhost, TEACHER_SITE=http://giaovien.localhost,
# API_SITE=http://api.localhost
docker compose -f deploy/docker-compose.production.yml --env-file /tmp/sm.env -p sm-prod-test up -d --build
curl -H 'Host: api.localhost' http://127.0.0.1:18080/api/v1/health
docker compose -f deploy/docker-compose.production.yml --env-file /tmp/sm.env -p sm-prod-test down -v
```

Trình duyệt không lưu cookie `Secure` trên `http://`, nên đăng nhập bằng giao diện chỉ thử được khi có HTTPS (tên miền thật hoặc `tls internal`).
