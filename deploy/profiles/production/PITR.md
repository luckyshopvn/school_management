# Sao lưu theo trường, khôi phục về một thời điểm, chuyển cụm (hồ sơ vận hành)

DT-SaaS phần S7b, YCTD-199; kế hoạch ở `tai_lieu/47_KE_HOACH_THEO_HE_THONG_SO.md` mục 14.5 "S7b". Mọi giá trị trong tệp mẫu là giả.

## 1. Ba lớp sao lưu

| Lớp                                   | Công cụ                                                                                     | Lịch                                                                                          | Giữ                                                                      | Khôi phục được                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Sao lưu logic theo từng trường        | `platform backup-school` (gọi từ `deploy/scripts/backup.sh` khi có `PLATFORM_DATABASE_URL`) | Hằng ngày mọi năm học (`all`), hằng giờ năm học còn ghi được (`active`)                       | `BACKUP_RETENTION_DAYS` (≥ 30), hằng giờ `BACKUP_HOURLY_RETENTION_HOURS` | Một trường, vào chính nó (trường tạm dừng) hoặc thành trường mới để xem lại; ở cả bố cục `database` và `schema` |
| Sao lưu cả máy (bản cũ của YCTD-92)   | `pg_dump` từng cơ sở dữ liệu trong `backup.sh`                                              | Như trên                                                                                      | Như trên                                                                 | Cả máy chủ                                                                                                      |
| Khôi phục về một thời điểm của cả cụm | WAL-G: bản cơ bản hằng ngày, nhật ký giao dịch đẩy liên tục (`compose.pitr.yml`)            | Bản cơ bản 02:30, nhật ký mỗi đoạn đầy hoặc sau `POSTGRES_ARCHIVE_TIMEOUT` giây (mặc định 60) | 7 bản cơ bản và nhật ký giữa chúng                                       | Cả cụm về thời điểm bất kỳ trong khoảng giữ; lấy riêng một trường bằng `scripts/pitr-extract-school.sh`         |

Mọi tệp đều mã hóa trước khi rời máy chủ:

- Tệp `.sbak` của từng trường: AES-256-GCM, khóa dẫn từ `BACKUP_ENCRYPTION_PASSPHRASE`. Tệp chứa cả khóa dữ liệu trẻ của trường.
- Tệp `pg_dump`: AES-256-CBC như cũ.
- WAL-G: libsodium với `WALG_LIBSODIUM_KEY`.

Giữ bản sao khóa giải mã ở nơi khác ngoài máy chủ (két, quản lý mật khẩu của Eric). Mất khóa là mất bản sao lưu.

## 2. Mục tiêu RPO, RTO (giả định, đo rồi chốt)

| Tình huống                                          | RPO (mất tối đa)                                        | RTO (khôi phục dịch vụ trong)                 | Căn cứ đo                                                                               |
| --------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Hỏng dữ liệu một trường, có WAL-G                   | ≤ 5 phút (`archive_timeout` 60 giây cộng thời gian đẩy) | ≤ 4 giờ ở T2, T3                              | `pitr-extract-school.sh` rồi `restore-school --in-place`; thời gian ghi ở `backup_runs` |
| Hỏng dữ liệu một trường, chỉ có sao lưu theo trường | ≤ 1 giờ (bản `active` hằng giờ)                         | ≤ 1 giờ cho một trường cỡ vừa                 | Diễn tập hằng tháng ghi `duration_ms` ở `backup_runs`                                   |
| Mất máy cơ sở dữ liệu, có bản sao (T3)              | Gần 0 (sao chép luồng)                                  | ≤ 1 giờ (nâng bản sao)                        | Diễn tập nâng bản sao (README mục Bản sao)                                              |
| Mất máy cơ sở dữ liệu, không bản sao                | ≤ 5 phút với WAL-G; ≤ 1 giờ nếu không                   | ≤ 4 giờ ở T2, T3; ≤ 8 giờ ở T1 (dựng máy mới) | Diễn tập khôi phục cả cụm trên staging                                                  |

Sẵn sàng mục tiêu (giả định, không cam kết trước khi đo): 99,5% ở T1, 99,9% ở T3 khi bản sao tự gánh được.

Kết quả diễn tập ghi vào bảng `backup_runs` của nền tảng (loại `drill`, `duration_ms`, số bảng, số dòng). Bảng điều khiển của S4 đọc dòng mới nhất của từng trường để cảnh báo sao lưu hoặc diễn tập quá hạn.

## 3. Bật lưu nhật ký giao dịch (WAL-G)

1. Tạo kho ngoài máy chủ tương thích S3, khác nhà cung cấp hoặc khác vùng với VPS (ví dụ kho của một nhà cung cấp khác trong nước). Đặt `WALG_S3_*` trong `production.env`, rồi sinh `WALG_LIBSODIUM_KEY` bằng `openssl rand -base64 32`.
2. Dựng ảnh: `docker compose -f compose.yml -f compose.pitr.yml --env-file production.env build postgres`. Ảnh dùng `docker/postgres-walg/Dockerfile`, với WAL-G ghim phiên bản và mã băm.
3. Khởi động lại PostgreSQL với lớp phủ: `docker compose -f compose.yml -f compose.pitr.yml --env-file production.env up -d postgres`.
4. Chạy bản cơ bản đầu tiên ngay: dòng WAL-G trong `deploy/scripts/crontab.example`. Kiểm `wal-g backup-list` trong container.
5. Thêm dòng cron diễn tập hằng tháng (`deploy/scripts/restore-drill.sh`).

## 4. Khôi phục một trường

- **Từ sao lưu theo trường:**
  1. Tạm dừng trường ở cổng nền tảng.
  2. `platform_command restore-school --file /backup/schools/<mã>/<tệp>.sbak --in-place`, gọi qua hàm trong `deploy/scripts/lib.sh` hoặc chạy `node database/dist/src/platform-command.js` với biến của nền tảng.
  3. Kiểm tra, rồi mở lại.

  Muốn xem lại mà không đụng trường đang chạy thì dùng `--as <mã mới>`: bản khôi phục là trường mới, đang tạm dừng, tên miền `<mã mới>.<tên miền hệ thống>`. Xóa nó khi xong.

- **Về một thời điểm:**
  1. `bash deploy/profiles/production/scripts/pitr-extract-school.sh <mã> '<thời điểm>'`. Lệnh dựng bản khôi phục tạm của cả cụm trong mạng riêng và sao lưu riêng trường đó ra tệp `.sbak`.
  2. `platform verify-backup --file <tệp>`.
  3. Khôi phục như trên.

  Các trường khác không bị đụng.

- **Kho tệp** (tệp đính kèm của trường, `tenants/<tiền tố>/`): lấy từ bản đồng bộ `files-mirror` hoặc kho ngoài bằng rclone, chỉ thư mục của trường.

Khôi phục không ghi vào cùng một giao dịch cho mọi bảng, để không vượt giới hạn khóa của máy chủ. Cụ thể:

- mỗi bảng nạp trong một giao dịch;
- khóa ngoại gỡ trước, gắn lại sau cùng, và PostgreSQL kiểm lại toàn bộ quan hệ khi gắn;
- lỗi giữa chừng thì trường vẫn tạm dừng, chạy lại lệnh là nạp lại từ đầu.

## 5. Chuyển một trường sang cụm cơ sở dữ liệu khác

Dùng khi một máy cơ sở dữ liệu đầy.

1. Dựng máy PostgreSQL mới (cùng phiên bản lớn) và mở mạng riêng tới máy ứng dụng.
2. Đặt `TARGET_CLUSTER_ADMIN_URL`: tài khoản tạo cơ sở dữ liệu, vai trò ở máy mới. Nếu dùng bố cục `schema` thì đặt thêm `TARGET_CLUSTER_LAYOUT` và `TARGET_CLUSTER_SHARED_DATABASE`.
3. Chạy `platform move-school --school <mã>`. Lệnh:
   - tạm dừng trường;
   - tạo cơ sở dữ liệu ở cụm đích và chạy migrate;
   - chép dữ liệu, so số dòng và tổng kiểm;
   - đổi mô tả kết nối và `schools.cluster_id`;
   - trả trường về trạng thái cũ.

   Lỗi thì xóa phần đã tạo ở cụm đích và giữ cụm cũ.

4. Kiểm tra trường ở cụm mới, rồi chạy lại với `--drop-source` để xóa bản ở cụm cũ, hoặc xóa tay.
5. PgBouncer của máy ứng dụng phải trỏ được tới cụm mới. Nếu mô tả kết nối dùng PgBouncer, thêm máy chủ mới vào cấu hình của nó.

Mỗi lần chuyển ghi một dòng `backup_runs` loại `cluster-move` kèm thời gian.

## 6. Hồ sơ thử nghiệm (Neon, Supabase)

Xem `deploy/profiles/trial/README.md` mục 7. Nhà cung cấp miễn phí chỉ giữ lịch sử ngắn: Neon Free 6 giờ; Supabase Free không có sao lưu tự động. Vì vậy sao lưu theo trường (`backup-school`) là lớp chính, chạy từ GitHub Actions hoặc máy của người vận hành, đẩy tệp ra R2.
