# Hồ sơ "Vận hành" (b): VPS trong nước

- Mã việc: DT-SaaS phần S7a (YCTD-198); kế hoạch ở `tai_lieu/47_KE_HOACH_THEO_HE_THONG_SO.md` mục 14.4, 14.5.
- Phạm vi: phần dựng sẵn để chạy School Management nhiều trường trên VPS đặt tại Việt Nam. Không sửa mã nghiệp vụ. Bản một trường cũ (`deploy/docker-compose.production.yml`, `deploy/README.md`) vẫn dùng được; hồ sơ này chạy được cả bản một trường hiện nay (mục 5.2).
- Mọi giá trị trong tệp mẫu là giả (tên miền `*.test`, mật khẩu và khóa để trống). Không ghi bí mật vào kho mã.

## 1. Thành phần

| Tệp                                                                   | Nội dung                                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `compose.yml`                                                         | Mọi dịch vụ, chọn bằng `COMPOSE_PROFILES`: `db`, `replica`, `app`, `seaweedfs`, `monitoring`, `monitoring-agent`, `demo` |
| `compose.edge.yml`                                                    | Ghép thêm khi môi trường thử chạy cùng VPS (mạng `school-edge`)                                                          |
| `production.env.example`, `staging.env.example`                       | Biến cấu hình mẫu; sao chép thành `production.env`, `staging.env` (đã có trong `.gitignore`)                             |
| `caddy/Caddyfile`, `caddy/sites.d/`                                   | Caddy bắt mọi tên miền; tên miền cố định (bản một trường, môi trường thử) bật bằng tệp `*.caddy` trong `sites.d/`        |
| `monitoring/`                                                         | Prometheus, luật cảnh báo, Alertmanager, blackbox, Loki, Promtail, nguồn dữ liệu Grafana                                 |
| `scripts/deploy.sh`                                                   | Triển khai không gián đoạn                                                                                               |
| `scripts/check-config.sh`                                             | Kiểm cú pháp Compose (T1, T2, T3, staging), Caddyfile, Prometheus, Alertmanager, Loki bằng giá trị giả                   |
| `docker/pgbouncer/`                                                   | Ảnh PgBouncer (Alpine), cấu hình sinh từ biến môi trường                                                                 |
| `docker/postgres/create-replication-role.sh`, `replica-entrypoint.sh` | Vai trò sao chép trên máy chính, khởi động bản sao (T3)                                                                  |

Dịch vụ:

| Dịch vụ                                                                 | Hồ sơ                            | Vai trò                                                                                                     |
| ----------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `postgres`                                                              | `db`                             | PostgreSQL 17, cấu hình cho hàng trăm cơ sở dữ liệu nhỏ, WAL mức `replica`                                  |
| `pgbouncer`                                                             | `db`                             | Gom kết nối trước PostgreSQL (mục 4)                                                                        |
| `postgres-replica`                                                      | `replica`                        | Bản sao chỉ đọc (T3)                                                                                        |
| `migrate`                                                               | `app`                            | Thay đổi cấu trúc, nối thẳng PostgreSQL                                                                     |
| `identity-a`, `identity-b`                                              | `app`                            | Hai bản dịch vụ định danh                                                                                   |
| `api-a`, `api-b`                                                        | `app`                            | Hai bản máy chủ API; việc định kỳ (gửi thông báo, nhắc việc, lưu trữ, xuất tệp, máy xếp) chỉ chạy ở `api-a` |
| `worker`, `redis`                                                       | `app`                            | Tiến trình nền, Redis                                                                                       |
| `seaweedfs`                                                             | `seaweedfs`                      | Kho tệp tương thích S3 trên VPS                                                                             |
| `web`                                                                   | `app`                            | Caddy: ba giao diện, chuyển `/api/v1`, chứng chỉ HTTPS theo yêu cầu                                         |
| `node-exporter`, `postgres-exporter`                                    | `monitoring`, `monitoring-agent` | Số liệu máy chủ, PostgreSQL                                                                                 |
| `prometheus`, `alertmanager`, `blackbox`, `loki`, `promtail`, `grafana` | `monitoring`                     | Giám sát, cảnh báo, nhật ký tập trung; chạy trên chính VPS, không gửi ra dịch vụ ngoài                      |
| `demo-reset`                                                            | `demo`                           | Dữ liệu giả của môi trường thử                                                                              |

## 2. Ba cách đặt máy

| Cách đặt | Máy                                                    | `COMPOSE_PROFILES`                                                         | Ghi chú                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1       | Một VPS                                                | `db,app,seaweedfs,monitoring`                                              | Đến vài chục trường (giả định, chưa đo; S7b đo)                                                                                                                                                                      |
| T2       | Máy ứng dụng; máy cơ sở dữ liệu                        | ứng dụng: `app,seaweedfs,monitoring`; cơ sở dữ liệu: `db,monitoring-agent` | Máy ứng dụng đặt `DATABASE_HOST`, `MIGRATE_DATABASE_HOST`, `POSTGRES_EXPORTER_HOST` là địa chỉ riêng của máy cơ sở dữ liệu; máy cơ sở dữ liệu đặt `DB_BIND_ADDRESS`, `MONITORING_AGENT_BIND` là địa chỉ riêng của nó |
| T3       | Hai máy ứng dụng; máy cơ sở dữ liệu chính; máy bản sao | như T2; máy bản sao: `replica,monitoring-agent`                            | Hai máy ứng dụng sau hai bản ghi A của tên miền (hoặc một địa chỉ nổi nếu cùng mạng); máy thứ hai không bật `monitoring` (khai báo ở `monitoring/targets.d/`)                                                        |

Giới hạn đã biết:

- Không giả định cân bằng tải hay cơ sở dữ liệu quản lý của nhà cung cấp. Hai bản ghi A không tự bỏ máy hỏng: trình duyệt thử địa chỉ kia khi một máy không trả lời, nhưng một phần yêu cầu có thể chậm cho tới khi gỡ bản ghi của máy hỏng (thao tác tay, hoặc dùng DNS có kiểm tra sức khỏe của nhà cung cấp).
- Ở T3 hai máy ứng dụng có Redis, SeaweedFS riêng: phải dùng chung một Redis và một kho tệp (đặt `REDIS_HOST`, `S3_ENDPOINT` là địa chỉ riêng của máy thứ nhất, mở cổng của hai dịch vụ này trên mạng riêng, hoặc kho S3 của nhà cung cấp trong nước) trước khi bật máy thứ hai; giới hạn đăng nhập, mã OTP, hàng đợi máy xếp lưu ở Redis.
- Chuyển sang bản sao khi máy chính hỏng là thao tác tay (mục 8); chưa tự chuyển.
- Mạng riêng giữa các VPS là bắt buộc ở T2, T3; cổng 5432, 6432, 9100, 9187 chỉ mở trên mạng riêng và chặn bằng tường lửa của nhà cung cấp.

## 3. Dựng lần đầu (T1)

1. Chọn nhà cung cấp theo checklist mục 11; tạo VPS Ubuntu 24.04 LTS (gợi ý 4 nhân, 8 GB, 160 GB SSD), cài Docker và Docker Compose v2, bật tường lửa chỉ mở 22, 80, 443.
2. DNS: bản ghi A `<tên miền hệ thống>` và `*.<tên miền hệ thống>` trỏ về VPS; tên miền riêng của trường trỏ bản ghi A hoặc CNAME về VPS sau khi được thêm vào danh sách của hệ thống.
3. Lấy mã nguồn, vào `deploy/profiles/production/`, sao chép `production.env.example` thành `production.env`, chạy `sh ../../scripts/generate-keys.sh production.env`, điền phần còn lại (tên miền, thư điện tử, kênh cảnh báo, tài khoản eSMS...), `chmod 600 production.env`.
4. Bản một trường: sao chép `caddy/sites.d/single-school.caddy.example` thành `single-school.caddy`, điền bốn tên miền trong `production.env`.
5. Kiểm tra: `scripts/check-config.sh`, rồi `docker compose --env-file production.env config --quiet`.
6. Chạy: `docker compose --env-file production.env up -d --build`. Lần đầu migrate tạo cơ sở dữ liệu, `api-a`, `api-b`, `identity-a`, `identity-b` chỉ chạy khi migrate thành công.
7. Giám sát: sao chép `monitoring/targets.d/domains.example.yml` thành `domains.yml`, ghi tên miền đang phục vụ; xem Grafana qua đường hầm SSH `ssh -L 3300:127.0.0.1:3300 <vps>` rồi mở `http://127.0.0.1:3300`.
8. Sao lưu: như bản một máy (`deploy/README.md` mục Sao lưu), chạy với biến của hồ sơ này:
   `COMPOSE_FILE=deploy/profiles/production/compose.yml ENV_FILE=deploy/profiles/production/production.env deploy/scripts/backup.sh`;
   khôi phục thêm `RESTORE_STOP_SERVICES="web api-a api-b identity-a identity-b worker"`. Sao lưu theo từng trường, khôi phục về một thời điểm (WAL-G), diễn tập khôi phục hằng tháng, chuyển trường sang cụm khác và mục tiêu RPO, RTO: xem [PITR.md](PITR.md) (S7b).

## 4. PgBouncer

- Ảnh tự dựng từ gói pgbouncer của Alpine (`docker/pgbouncer/Dockerfile`), cấu hình sinh lúc khởi động. Xác thực SCRAM; tài khoản lấy từ `PGBOUNCER_USERS`. Khi có vai trò riêng cho từng trường (S1a, S2) thì danh sách xác thực sinh từ cơ sở dữ liệu nền tảng.
- Chế độ gom: **theo giao dịch** cho cơ sở dữ liệu định danh và mọi cơ sở dữ liệu năm học (khai báo `*`, cơ sở dữ liệu mở sau tự có); **theo phiên** cho `school_system` (`PGBOUNCER_SESSION_DATABASES`).
- Kết quả rà mã trước khi bật gom theo giao dịch (YCTD-198, ngày 2026-10-25):

| Hạng mục                   | Chỗ trong mã                                                                                                                                                  | Kết luận                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Múi giờ                    | `database/src/timezone.ts`: `alter database ... set timezone` trong migration                                                                                 | Áp ở mức cơ sở dữ liệu cho mọi kết nối máy chủ; không có `SET timezone` theo phiên. Chạy đúng                                          |
| `SET` theo phiên           | Không có (`SET`, `set_config`, `search_path`, `statement_timeout`)                                                                                            | Chạy đúng                                                                                                                              |
| Khóa tư vấn theo giao dịch | `pg_advisory_xact_lock` ở sổ cái, văn bản đến, văn bản đi, lưu trữ, giao việc, lịch đơn vị, đơn vị hành chính, liên kết nhanh, góp ý                          | Nằm trong giao dịch. Chạy đúng                                                                                                         |
| Khóa tư vấn theo phiên     | `apps/api/src/academic-years/academic-years.service.ts`: `pg_try_advisory_lock` rồi `pg_advisory_unlock` trên một kết nối, ngoài giao dịch, ở `school_system` | Không chạy đúng khi gom theo giao dịch (khóa và mở khóa có thể ở hai kết nối máy chủ khác nhau). Vì vậy `school_system` gom theo phiên |
| `LISTEN`, `NOTIFY`         | Không có                                                                                                                                                      | Chạy đúng                                                                                                                              |
| Câu lệnh chuẩn bị có tên   | node-postgres dùng câu lệnh không tên                                                                                                                         | Chạy đúng; PgBouncer bật `max_prepared_statements` phòng sau này                                                                       |
| Migrate                    | Kysely Migrator dùng khóa trong giao dịch                                                                                                                     | Vẫn nối thẳng PostgreSQL (không qua PgBouncer) như kế hoạch                                                                            |
| Tạo cơ sở dữ liệu năm học  | `CREATE DATABASE` khi mở năm học, qua kết nối `school_system`                                                                                                 | Không chạy trong giao dịch; đi qua kết nối gom theo phiên. Chạy đúng                                                                   |

- Đã thử trên máy (2026-10-25): kết nối qua PgBouncer vào `school_system` (giữ và mở khóa tư vấn theo phiên trên cùng kết nối) và `school_identity` (tự thêm cơ sở dữ liệu, gom theo giao dịch); sai mật khẩu bị từ chối; kiểm tra sức khỏe đạt.
- Tinh chỉnh: `PGBOUNCER_DEFAULT_POOL_SIZE` (mỗi cặp cơ sở dữ liệu, tài khoản), `PGBOUNCER_MAX_DB_CONNECTIONS`, `autodb_idle_timeout` 600 giây (đóng kết nối của cơ sở dữ liệu năm học rảnh). Tổng kết nối thật tới PostgreSQL phải dưới `POSTGRES_MAX_CONNECTIONS`.

## 5. Caddy

### 5.1 Bắt mọi tên miền

- Khối địa chỉ bắt chung (`CATCH_ALL_ADDRESS=https://`) nhận mọi tên miền và xin chứng chỉ theo yêu cầu. Trước khi xin, Caddy hỏi `DOMAIN_CHECK_URL?domain=<tên>`; chỉ khi trả 200 mới cấp, nên chứng chỉ chỉ cấp cho tên miền có trong danh sách của hệ thống. Hiện điểm cuối là danh sách tên miền website của trường (YCTD-144); khi có cơ sở dữ liệu nền tảng (S1b) đổi biến này sang điểm cuối kiểm tra tên miền của nền tảng, không sửa tệp.
- Không ghi tên miền trong `Caddyfile`. Tên miền cố định để ở `caddy/sites.d/*.caddy` (không đưa lên kho mã).
- `TENANT_PATHS=on` mở `/quan-ly`, `/giao-vien`, `/phu-huynh`, `/hoc-sinh` (ứng dụng học sinh, YCTD-300), `/api/v1` trên tên miền của từng trường; chỉ bật sau S1b (giao diện dựng với đường dẫn gốc này). Gốc tên miền là website của trường.
- Hai bản `api`, `identity`: kiểm tra sức khỏe chủ động mỗi 5 giây; yêu cầu gặp bản đang khởi động lại được thử sang bản kia trong 15 giây.
- Chỉ số của Caddy ở `:9180/metrics`, chỉ trong mạng nội bộ của Docker.

### 5.2 Bản một trường hiện nay

Bật `sites.d/single-school.caddy` với bốn tên miền như bản cũ; website trên tên miền riêng đi qua khối bắt chung. `TENANT_PATHS=off`.

### 5.3 Cấp chứng chỉ

- Chứng chỉ Let's Encrypt, thư báo hết hạn gửi `ACME_EMAIL`; Caddy tự gia hạn. Cảnh báo "ChungChiSapHetHan" khi còn dưới 14 ngày (blackbox đọc từ ngoài vào).
- Tên miền mới của trường: thêm vào danh sách của hệ thống, trỏ DNS, truy cập lần đầu sẽ cấp. Tên miền chưa trong danh sách nhận lỗi bắt tay TLS, không lộ tên trường.
- Giới hạn tốc độ cấp của Let's Encrypt: nhiều tên miền con mới cùng lúc có thể chạm giới hạn mỗi tuần; khi số trường lớn, cân nhắc chứng chỉ ký tự đại diện qua DNS (cần mô-đun DNS của nhà cung cấp, S1b).

## 6. Môi trường thử (staging)

- Cùng `compose.yml`, tên dự án `school-staging` (vùng chứa, ổ dữ liệu, cơ sở dữ liệu tách hẳn), tên miền `*.staging.<tên miền hệ thống>`, **chỉ dữ liệu giả** (hồ sơ `demo`), khóa và mật khẩu sinh riêng.
- Cùng VPS: tạo mạng `docker network create school-edge`; bật `caddy/sites.d/staging-proxy.caddy` ở môi trường chạy thật và đặt `STAGING_SITES`; chạy cả hai dự án kèm `-f compose.edge.yml`. Caddy của staging chạy HTTP trong mạng nội bộ, Caddy chính cấp chứng chỉ cho tên miền thử.
- Máy riêng: dùng `staging.env` với `CATCH_ALL_ADDRESS=https://`, `TLS_MODE=on-demand`, mở cổng 80, 443, bật thêm `monitoring`.
- Quy trình: triển khai bản mới lên staging trước (`scripts/deploy.sh --env-file staging.env --tag <phiên bản>`), kiểm tay (mục 12), rồi lên môi trường chạy thật cùng phiên bản ảnh.

## 7. Triển khai không gián đoạn

`scripts/deploy.sh --tag <phiên bản>`:

1. dựng ảnh (hoặc `--pull` kéo ảnh đã dựng);
2. chạy migrate một lần, nối thẳng PostgreSQL;
3. khởi động lại lần lượt `identity-a`, `identity-b`, `api-a`, `api-b`, mỗi dịch vụ chờ báo khỏe mới sang dịch vụ sau; dừng ngay nếu một bản không khỏe (bản còn lại vẫn phục vụ);
4. `worker`, rồi `web`.

Quy tắc thay đổi cấu trúc tương thích lùi: chỉ thêm bảng, thêm cột có mặc định hoặc cho phép trống, chỉ mục không khóa; bỏ cột, đổi tên làm ở bản phát hành sau khi không còn mã đọc. Quay lui: `scripts/deploy.sh --tag <phiên bản trước>` (cấu trúc mới vẫn tương thích với bản trước).

Ở T3: chạy `deploy.sh` ở máy ứng dụng thứ nhất (có migrate), rồi máy thứ hai với `--skip-build`; máy cơ sở dữ liệu chỉ cần chạy khi đổi ảnh PgBouncer.

## 8. Giám sát và cảnh báo

- Chạy trên chính VPS: Prometheus (giữ 30 ngày), Alertmanager, blackbox (dịch vụ nội bộ, tên miền và hạn chứng chỉ từ ngoài vào), Loki và Promtail (nhật ký của mọi vùng chứa trong dự án, giữ 30 ngày), Grafana (chỉ nghe 127.0.0.1).
- Cảnh báo (ngưỡng giả định, chỉnh sau khi đo ở S7b): máy không trả lời; ổ đĩa còn dưới 15% và 5%; bộ nhớ, CPU trên 90% kéo dài; một bản dịch vụ không khỏe; cả hai bản api không khỏe; lỗi 5xx trên 5%; PostgreSQL không chạy; kết nối trên 80% giới hạn; bản sao trễ hơn 5 phút; tên miền không truy cập được; chứng chỉ sắp hết hạn.
- Kênh: email (SMTP), Telegram (bot), webhook (chuyển tiếp sang Zalo OA hoặc kênh khác). Kênh để trống thì không gửi. Bí mật ghi ra tệp quyền 600 trong vùng chứa, không nằm trong tệp cấu hình.
- Sao lưu không chạy: dùng `BACKUP_HEALTHCHECK_URL` như bản một máy; theo dõi trong giám sát của nền tảng ở S7b.

## 9. Quy mô gợi ý (giả định, chưa đo; S7b đo và chốt)

| Cách đặt | Máy                                                            | Gợi ý số trường                                                  |
| -------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| T1       | 4 nhân, 8 GB, 160 GB SSD                                       | đến 20 trường                                                    |
| T2       | ứng dụng 4 nhân, 8 GB; cơ sở dữ liệu 4 nhân, 16 GB, 320 GB SSD | đến 100 trường                                                   |
| T3       | hai máy ứng dụng như T2; cơ sở dữ liệu và bản sao như T2       | trên 100 trường; mở thêm cụm cơ sở dữ liệu khi một máy đầy (S7b) |

## 10. Thao tác thường gặp

- **Mở thêm VPS (T1 sang T2):** dựng máy cơ sở dữ liệu với `db,monitoring-agent`, sao lưu và khôi phục dữ liệu sang (thời gian dừng theo dung lượng), đổi `DATABASE_HOST`, `MIGRATE_DATABASE_HOST`, `POSTGRES_EXPORTER_HOST` ở máy ứng dụng, bỏ `db` khỏi `COMPOSE_PROFILES`, chạy lại.
- **Chuyển cụm, chuyển một trường sang máy cơ sở dữ liệu khác:** `platform move-school` ([PITR.md](PITR.md) mục 5).
- **Chuyển sang bản sao khi máy chính hỏng (thao tác tay):** dừng ghi (dừng `api-*`, `identity-*`), trên máy bản sao chạy `docker compose exec -u postgres postgres-replica pg_ctl promote -D /var/lib/postgresql/data`, chạy PgBouncer trỏ máy mới (`PGBOUNCER_UPSTREAM_HOST`), đổi `DATABASE_HOST`, `MIGRATE_DATABASE_HOST` ở máy ứng dụng, chạy lại; dựng bản sao mới từ máy chính mới.
- **Thay khóa:** khóa ký mã phiên (`IDENTITY_TOKEN_PRIVATE_KEY`, `TOKEN_PUBLIC_KEY`) đổi làm mọi phiên hết hiệu lực, làm ngoài giờ học; khóa dữ liệu trẻ (`CHILD_DATA_*`) không đổi được bằng cách thay biến (cần công cụ mã hóa lại, S8b). Mật khẩu PostgreSQL: đổi trong PostgreSQL (`alter role ... password`), sửa `production.env`, chạy lại `pgbouncer`, `api-*`, `identity-*`, `migrate`.
- **Xử lý sự cố:** xem cảnh báo, nhật ký ở Grafana (nguồn Loki, lọc theo `service`); `docker compose ps`; `docker compose logs --tail 200 <dịch vụ>`; PgBouncer: `psql -h 127.0.0.1 -p 6432 -U pgbouncer_stats pgbouncer -c 'show pools'`; hết chỗ ổ đĩa: kiểm tra `BACKUP_DIR`, nhật ký Docker (giới hạn 5 × 20 MB mỗi vùng chứa), dữ liệu Prometheus, Loki.

## 11. Chọn nhà cung cấp VPS trong nước

Nghị định 53/2022/NĐ-CP (đọc lại văn bản còn hiệu lực trước khi ký hợp đồng) yêu cầu một số loại dữ liệu của người dùng tại Việt Nam lưu trữ trong nước; hồ sơ (b) đặt mọi dữ liệu thật và bản sao lưu ở Việt Nam. Checklist:

- [ ] Trung tâm dữ liệu đặt tại Việt Nam (ghi tỉnh, thành phố); hợp đồng nêu rõ vị trí lưu trữ và không chuyển dữ liệu ra nước ngoài.
- [ ] Có mạng riêng giữa các VPS cùng vùng (bắt buộc cho T2, T3) và tường lửa theo máy.
- [ ] Có kho đối tượng tương thích S3 ở vùng hoặc nhà cung cấp khác trong nước cho bản sao lưu ngoài máy chủ.
- [ ] Ảnh chụp ổ đĩa (snapshot) và khôi phục máy; cam kết thời gian hoạt động, thời gian xử lý sự cố.
- [ ] Hỗ trợ IPv4 cố định, bản ghi PTR, mở cổng 80, 443; không chặn Let's Encrypt.
- [ ] Hóa đơn điện tử, hợp đồng với pháp nhân; thỏa thuận xử lý dữ liệu cá nhân (bên xử lý phụ, S8a).
- [ ] Chứng nhận an toàn thông tin của trung tâm dữ liệu (ví dụ cấp độ theo quy định hiện hành, ISO 27001) nếu có.

## 12. Kiểm tay trên staging (thay e2e cho phần hạ tầng)

1. `scripts/check-config.sh` đạt.
2. Dựng T1 trên staging với dữ liệu giả; mở website, cổng quản trị qua tên miền thử; chứng chỉ được cấp; tên miền không có trong danh sách không được cấp.
3. Chạy `scripts/deploy.sh` trong lúc gọi liên tục `/api/v1/health` (ví dụ mỗi 200 ms): không có lần trả lỗi.
4. Dừng `api-a`: cảnh báo "DichVuKhongKhoe" tới kênh đã cấu hình; yêu cầu vẫn được phục vụ bởi `api-b`.
5. Mở năm học mới trên staging qua PgBouncer: thành công, cơ sở dữ liệu năm học mới đọc được qua PgBouncer.
6. (T3) Ghi ở máy chính, đọc ở bản sao; độ trễ bản sao hiện trong Grafana.
