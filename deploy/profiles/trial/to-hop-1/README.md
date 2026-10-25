# Tổ hợp 1 (mặc định): Cloudflare Worker, Neon, R2, Render

DT-SaaS phần S9, YCTD-203. Làm sau phần "Chuẩn bị chung" ở [`../README.md`](../README.md). Mọi tên, khóa dưới đây là giả.

1. **Tên miền về Cloudflare:** thêm tên miền thử (ví dụ `thu.example.test`) vào Cloudflare, đổi máy chủ tên ở nơi đăng ký sang Cloudflare.
2. **Neon:**
   - Tạo dự án ở vùng gần Việt Nam nhất có trên bảng điều khiển (AWS Singapore `ap-southeast-1` nếu có; ghi vùng thật vào bản ghi PL-08).
   - Tạo cơ sở dữ liệu `school_platform` và `school_shared`.
   - Lấy địa chỉ trực tiếp, đặt cho `PLATFORM_ADMIN_DATABASE_URL`. Lấy địa chỉ gom kết nối (máy chủ có `-pooler`), đặt cho `PLATFORM_DATABASE_URL`.
   - Đặt `DB_HOST_ADAPTER=neon`. Địa chỉ của từng trường do nền tảng tự sinh qua bộ gom.
   - Neon tạm dừng tính toán sau 5 phút rảnh và mất vài trăm mili giây để chạy lại; không cần làm gì thêm.
3. **R2:**
   - Tạo bộ chứa `school-files`; chọn gợi ý vị trí châu Á - Thái Bình Dương nếu có.
   - Tạo khóa truy cập API cho R2 (quyền đọc ghi đối tượng của bộ chứa này).
   - Đặt `S3_ENDPOINT=https://<mã tài khoản>.r2.cloudflarestorage.com` và `S3_REGION=auto`.
   - Bật R2 có thể cần thêm phương thức thanh toán, dù dùng trong hạn mức miễn phí.
4. **Render:** tạo dịch vụ web từ kho Git theo [`../container/render.yaml.example`](../container/render.yaml.example):
   - Vùng Singapore, gói Free, Dockerfile `deploy/profiles/trial/container/Dockerfile.all-in-one`.
   - Nhập biến từ [`../env.trial.example`](../env.trial.example) và [`env.to-hop-1.example`](env.to-hop-1.example).
   - Kiểm tra sức khỏe ở `/api/v1/health`.
5. **Nền tảng:** chạy `platform migrate` và tạo tài khoản vận hành đầu tiên từ máy của người vận hành (Chuẩn bị chung, bước 2 và 3).
6. **Worker:**
   - `cd deploy/profiles/trial/cloudflare`.
   - Chép `wrangler.toml.example` thành `wrangler.toml`; sửa tên miền và `ORIGIN_URL` (địa chỉ `*.onrender.com`).
   - `sh build-assets.sh`.
   - `npx wrangler secret put EDGE_SHARED_SECRET`, rồi `npx wrangler secret put INTERNAL_JOB_TOKEN`.
   - `npx wrangler deploy`.
7. **DNS:** tạo bản ghi `*`, `@` (và `platform` nếu muốn tách) kiểu `AAAA 100::` hoặc `CNAME` tới chính tên miền, bật proxy (đám mây cam), để Worker nhận yêu cầu theo tuyến trong `wrangler.toml`.
8. **Cloudflare for SaaS** (tên miền riêng của trường):
   - Bật Custom Hostnames cho vùng.
   - Tạo bản ghi `vao.thu.example.test` (proxy) làm fallback origin; đặt `PLATFORM_INGRESS_HOST` bằng tên này.
   - Thêm tuyến Worker `*/*` cho vùng, để yêu cầu của tên miền riêng cũng qua Worker.
   - Tạo khóa API có quyền "SSL and Certificates Write" cho vùng; đặt `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` ở máy chủ.
   - Ở cổng nền tảng, thêm tên miền riêng cho trường. Người quản trị của trường trỏ CNAME về `vao.thu.example.test` và thêm bản ghi TXT xác nhận hiện ở trang chi tiết trường, rồi bấm "Kiểm tra".
9. **Trường thử:** khởi tạo ở cổng nền tảng. Trường dữ liệu thật làm theo mục 5 của README chung; mẫu dòng vùng máy chủ ở [`hosting.example.json`](hosting.example.json).
10. **Kiểm tra:** theo bước 7 của "Chuẩn bị chung".
