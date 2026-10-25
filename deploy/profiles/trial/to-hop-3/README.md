# Tổ hợp 3: Vercel (3a sau Worker, 3b làm cổng biên)

DT-SaaS phần S9, YCTD-203. Cơ sở dữ liệu, kho tệp, máy chủ chọn như tổ hợp 1 hoặc 2. Mọi tên, khóa là giả.

Gói Hobby của Vercel **chỉ cho dùng phi thương mại, cá nhân** (trang chính thức, tra ngày 2026-10-25). Thử nghiệm với trường thật có thể
bị coi là thương mại, nên dùng gói trả phí, hoặc chọn tổ hợp 1, 2.

## 3a (khuyến nghị khi dùng Vercel): Vercel chỉ lưu tệp tĩnh, đứng sau Worker

1. `sh ../cloudflare/build-assets.sh`, rồi đưa thư mục `../cloudflare/public` lên một dự án Vercel tĩnh. Ví dụ: `npx vercel deploy --prod ../cloudflare/public`, kèm [`vercel-3a/vercel.json`](vercel-3a/vercel.json).
2. Trong `wrangler.toml` của Worker, đặt `STATIC_ORIGIN = "https://<dự án>.vercel.app"`. Worker lấy tệp tĩnh từ đó thay cho `ASSETS`.
3. Các bước còn lại như tổ hợp 1: DNS và tên miền con ký tự đại diện vẫn ở Cloudflare; Cloudflare for SaaS cho tên miền riêng; Cron Triggers gọi `tick`.

## 3b: Vercel làm cổng biên

1. **Kiểm trước:** tài liệu Routing Middleware của Vercel (tra ngày 2026-10-25) cho phép viết lại sang địa chỉ ngoài và thêm tiêu đề yêu cầu. Dựng thử [`vercel-3b/`](vercel-3b/), rồi gọi `/api/v1/auth/me` của một trường. Máy chủ phải nhận được `x-school-host` và `x-edge-auth`: không có lỗi 404 chung của tên miền lạ. **Không làm được thì không dùng 3b**, vì không bảo vệ được tên miền gốc.
2. Ủy quyền một tên miền con cho Vercel bằng bản ghi NS (ví dụ `thu.<tên miền gốc>`), để tên miền gốc ở lại Cloudflare. Vercel cần máy chủ tên của mình để cấp chứng chỉ ký tự đại diện.
3. Tạo dự án Vercel từ thư mục `vercel-3b/`, chép tệp tĩnh đã dựng vào `vercel-3b/public`. Đặt biến dự án `ORIGIN_URL` (máy chủ Render hoặc Koyeb) và `EDGE_SHARED_SECRET`.
4. Máy chủ: `DOMAIN_PROVIDER=vercel-domains`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (nếu là nhóm), `PLATFORM_INGRESS_HOST=cname.vercel-dns.com`. Gói Hobby cho tối đa 50 tên miền mỗi dự án.
5. Việc định kỳ: không có Cron Triggers. Dùng [`github-actions-tick.yml.example`](github-actions-tick.yml.example): lịch GitHub Actions gọi `tick` mỗi 15 phút, bí mật `INTERNAL_JOB_TOKEN` ở kho.
6. Giới hạn của 3b so với Worker:
   - Phần mềm trung gian chỉ viết lại yêu cầu, không đọc được phản hồi của máy chủ. Vì vậy 3b **không có trang "đang khởi động"** (người dùng thấy lỗi cổng của Vercel trong lúc máy chủ thức dậy) và không chèn biểu ngữ thử nghiệm vào trang.
   - Cần biểu ngữ thì dùng 3a, hoặc chỉ dùng 3b với `PLATFORM_DATA_POLICY=synthetic-only`.
