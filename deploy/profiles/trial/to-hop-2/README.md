# Tổ hợp 2: Cloudflare Worker, Supabase (cơ sở dữ liệu và kho tệp), Koyeb hoặc Render

DT-SaaS phần S9, YCTD-203. Như [tổ hợp 1](../to-hop-1/README.md), chỉ khác các bước sau. Mọi tên, khóa là giả.

1. **Supabase:**
   - Tạo dự án ở vùng Southeast Asia (Singapore).
   - Ở hộp "Connect", lấy địa chỉ trực tiếp `db.<mã dự án>.supabase.co:5432`, đặt cho `PLATFORM_ADMIN_DATABASE_URL` (vai trò `postgres`, cơ sở dữ liệu `postgres`).
   - Lấy máy chủ bộ gom dùng chung `aws-<số>-<vùng>.pooler.supabase.com`, đặt cho `DB_POOLER_HOST`. Không tự ghép tên máy chủ này; chép từ hộp Connect.
   - Đặt `DB_HOST_ADAPTER=supabase`, `SUPABASE_PROJECT_REF=<mã dự án>`, `PLATFORM_SHARED_DATABASE=postgres`.
   - Địa chỉ trực tiếp của gói miễn phí có thể chỉ có IPv6. Máy chủ không có IPv6 ra ngoài thì dùng bộ gom ở chế độ phiên (cổng 5432 của máy chủ bộ gom, tên đăng nhập `postgres.<mã dự án>`) cho `PLATFORM_ADMIN_DATABASE_URL`.
   - Cơ sở dữ liệu `school_platform`: tạo bằng `create database school_platform` nếu dự án cho phép. Nếu không, đặt nền tảng ở lược đồ riêng của một dự án Supabase thứ hai; gói miễn phí cho 2 dự án đang hoạt động.
2. **Supabase Storage** thay cho R2:
   - Tạo bộ chứa `school-files` (riêng tư).
   - Ở phần S3 của Storage, tạo khóa truy cập (khóa có toàn quyền mọi bộ chứa, chỉ đặt ở máy chủ).
   - Đặt `S3_ENDPOINT=https://<mã dự án>.storage.supabase.co/storage/v1/s3` và `S3_REGION=<vùng của dự án>`. Máy chủ đã dùng kiểu đường dẫn (path-style).
   - Mỗi tệp tối đa 50 MB, tổng 1 GB ở gói miễn phí.
3. **Koyeb** (hoặc Render như tổ hợp 1):
   - Dựng ảnh gộp, đẩy lên kho ảnh, chạy [`../container/koyeb.sh.example`](../container/koyeb.sh.example).
   - Gói miễn phí chỉ có Frankfurt hoặc Washington, D.C., không có Singapore: ghi đúng vùng vào bản ghi vùng máy chủ.
   - 0,1 vCPU rất yếu: tắt phân hệ máy xếp thời khoá biểu cho trường thử.
4. **Giữ dự án không tạm dừng:** Supabase tạm dừng dự án sau 1 tuần không hoạt động. Cron Triggers gọi `tick` mỗi 5 phút, việc này truy vấn cơ sở dữ liệu nên dự án không bị tạm dừng. Kiểm lại sau tuần đầu.

Biến ghi đè: [`env.to-hop-2.example`](env.to-hop-2.example). Mẫu dòng vùng máy chủ: [`hosting.example.json`](hosting.example.json).
