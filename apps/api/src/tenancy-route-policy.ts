// Chính sách trường của các tuyến API công khai (DT-SaaS phần S1a, tài liệu 32 mục 14.7 lớp 3): tuyến không đòi mã phiên của đúng
// trường phải khai ở đây kèm lý do. Mọi tuyến còn lại phải đòi mã phiên mang mã trường khớp tên miền (kiểm thử ma trận cách ly tự
// liệt kê tuyến và đối chiếu danh sách này). Thêm tuyến công khai mới là một quyết định có lý do, không phải lỡ tay
export interface PublicRoute {
  method: string;
  path: string;
  reason: string;
}

const HOST_PUBLIC =
  'Công khai theo tên miền của trường: nhận diện trường ở đầu yêu cầu (tên miền lạ 404), chỉ trả nội dung công khai của trường đó';
const LOOKUP_BY_CODE =
  'Tra cứu công khai theo mã, theo tên miền của trường; có giới hạn tần suất, chỉ trả trường tối thiểu, không liệt kê';
const WEBHOOK =
  'Gọi lại của cổng thanh toán, nhận theo tên miền của trường; xác thực bằng chữ ký hoặc khóa của cổng. Khóa riêng từng trường làm ở S3, S1b chuyển gọi lại sang tên miền của trường';

function get(path: string, reason: string): PublicRoute {
  return { method: 'GET', path, reason };
}

function post(path: string, reason: string): PublicRoute {
  return { method: 'POST', path, reason };
}

export const PUBLIC_ROUTES: PublicRoute[] = [
  get(
    '/api/v1/health',
    'Kiểm tra sức khỏe do máy chủ chuyển tiếp gọi bằng địa chỉ nội bộ, không cần trường, không trả dữ liệu',
  ),
  get('/api/v1/payment-webhooks/vnpay-ipn', WEBHOOK),
  post('/api/v1/payment-webhooks/casso', WEBHOOK),
  post('/api/v1/payment-webhooks/payos', WEBHOOK),
  post('/api/v1/payment-webhooks/sepay', WEBHOOK),
  get(
    '/api/v1/public/website/domain-check',
    'Caddy hỏi trước khi cấp chứng chỉ theo yêu cầu (18f); gọi bằng địa chỉ nội bộ nên không cần trường: ở chế độ nhiều trường tra danh mục tên miền của cơ sở dữ liệu nền tảng, chỉ trả 200 hoặc 404, không trả dữ liệu (S1b)',
  ),
  get(
    '/api/v1/public/schools/picker',
    'Trang chọn trường ở tên miền gốc của hệ thống: trang tĩnh không dữ liệu, không cần trường; chưa đặt tên miền gốc thì 404 (S1b)',
  ),
  get(
    '/api/v1/public/schools/resolve',
    'Đổi mã trường thành địa chỉ trường ở trang chọn trường: chỉ trả địa chỉ của trường đang phục vụ, không liệt kê trường, có giới hạn tần suất theo địa chỉ mạng (S1b)',
  ),
  post(
    '/api/v1/internal/jobs/tick',
    'Điểm gọi của bộ hẹn giờ bên ngoài chạy việc nền đến hạn của mọi trường; đòi bí mật dùng chung INTERNAL_JOB_TOKEN (so sánh thời gian hằng), chưa đặt bí mật thì 404 (S1b)',
  ),
  post(
    '/api/v1/platform-billing/webhooks/:provider',
    'Thông báo tiền vào của cổng thanh toán của nền tảng (thu phí dịch vụ, S5b): không thuộc trường nào, đi qua đường dẫn không cần trường; xác thực bằng chữ ký hoặc khóa của cổng lưu mã hóa ở cơ sở dữ liệu nền tảng, cổng chưa bật thì 404; chỉ ghi tiền vào hóa đơn theo nội dung chuyển khoản',
  ),
  get(
    '/api/v1/parent-org/aggregate',
    'Số liệu tổng hợp cho tài khoản cấp trên (Bộ, Sở, Phòng; DT-SaaS S6): không thuộc trường nào, chỉ phục vụ ở tên miền PLATFORM_CONSOLE_HOST (tên miền khác 404), mã phiên cấp trên có đối tượng riêng; chỉ trường đã đồng ý trong cây con',
  ),
  get(
    '/api/v1/parent-org/aggregate/export',
    'Xuất Excel, PDF số liệu tổng hợp cho tài khoản cấp trên (DT-SaaS S6): cùng điều kiện tên miền cổng nền tảng và mã phiên cấp trên',
  ),
  get(
    '/api/v1/public/branding',
    'Tên hiển thị, màu chủ đạo và địa chỉ biểu trưng của trường cho trang đăng nhập (S3), theo tên miền của trường; không trả dữ liệu cá nhân',
  ),
  get('/api/v1/public/branding/logo', 'Ảnh biểu trưng của trường (S3), theo tên miền của trường'),
  get(
    '/api/v1/public/pwa/:file',
    'Manifest và biểu tượng SVG của ứng dụng giáo viên, phụ huynh cài lên màn hình chính (DT-26 phần 26a), theo tên miền của trường: tên, tên ngắn, màu, biểu trưng; không có dữ liệu cá nhân',
  ),
  get('/api/v1/public/demo', 'Thông tin bản trình diễn của trường (18h), theo tên miền của trường'),
  get(
    '/api/v1/public/login-info',
    'Thông tin trang đăng nhập của trường (đường dây nóng, tên trường), theo tên miền của trường',
  ),
  get('/api/v1/public/admissions', HOST_PUBLIC),
  get('/api/v1/public/admission-applications/lookup', LOOKUP_BY_CODE),
  post(
    '/api/v1/public/admission-applications',
    'Phụ huynh nộp hồ sơ tuyển sinh trực tuyến, theo tên miền của trường; có giới hạn tần suất',
  ),
  get('/api/v1/public/job-posts', HOST_PUBLIC),
  get('/api/v1/public/job-posts/:id', HOST_PUBLIC),
  post(
    '/api/v1/public/job-posts/:id/applications',
    'Ứng viên nộp hồ sơ tuyển dụng, theo tên miền của trường; có giới hạn tần suất',
  ),
  get('/api/v1/public/emulation-awards/verify', LOOKUP_BY_CODE),
  get('/api/v1/public/outgoing-documents/verify', LOOKUP_BY_CODE),
  get('/api/v1/public/student-awards/verify', LOOKUP_BY_CODE),
  get('/api/v1/public/training-certificates/verify', LOOKUP_BY_CODE),
  get('/api/v1/public/timetable-lookup/:code', LOOKUP_BY_CODE),
  ...[
    '/api/v1/public/site',
    '/api/v1/public/site/co-cau-to-chuc',
    '/api/v1/public/site/cong-khai',
    '/api/v1/public/site/cong-khai/:slug',
    '/api/v1/public/site/gioi-thieu',
    '/api/v1/public/site/lien-he',
    '/api/v1/public/site/robots.txt',
    '/api/v1/public/site/sitemap.xml',
    '/api/v1/public/site/tep/:id',
    '/api/v1/public/site/thoi-khoa-bieu',
    '/api/v1/public/site/thong-bao',
    '/api/v1/public/site/thong-bao/:slug',
    '/api/v1/public/site/thu-vien-anh',
    '/api/v1/public/site/thu-vien-anh/:slug',
    '/api/v1/public/site/tin-tuc',
    '/api/v1/public/site/tin-tuc/:slug',
    '/api/v1/public/site/tuyen-sinh',
    '/api/v1/public/site/van-ban',
    '/api/v1/public/site/van-ban/:id/tep',
  ].map((path) => get(path, 'Website công khai của trường (18f), theo tên miền của trường')),
  // Thông báo đẩy (DT-26 phần 26b): khóa công khai VAPID của nền tảng, không có dữ liệu của trường
  get('/api/v1/public/push/vapid-public-key', 'Khóa công khai VAPID cho đăng ký đẩy, không có dữ liệu của trường'),
  post(
    '/api/v1/public/site/lien-he',
    'Biểu mẫu liên hệ của website công khai, theo tên miền của trường; có giới hạn tần suất',
  ),
  // Lớp video trực tiếp (DT-27 phần 27a)
  post(
    '/api/v1/video/webhook',
    'Sự kiện gọi lại của máy chủ video (vào ra phòng, ghi xong): một địa chỉ cho mọi trường, đi qua đường dẫn không cần trường, trường lấy từ tên phòng; xác thực bằng chữ ký của máy chủ video, video chưa bật thì 404',
  ),
  get(
    '/api/v1/tutoring/course-media/:activityId/stream',
    'Phát video bài học của khoá gia sư bằng đường dẫn ký 5 phút do điểm cuối có đăng nhập cấp (thẻ video không gửi được mã phiên), theo tên miền của trường, theo đoạn; mỗi lần cấp đường dẫn đã ghi nhật ký xem (DT-27 phần 27d1)',
  ),
  get(
    '/api/v1/video/recordings/:id/stream',
    'Phát bản ghi video bằng đường dẫn ký 5 phút do điểm cuối có đăng nhập cấp (thẻ video không gửi được mã phiên), theo tên miền của trường; mỗi lần cấp đường dẫn đã ghi nhật ký xem',
  ),
  // Gói bài giảng SCORM (DT-28 phần 28h): tệp của gói mở bằng mã truy cập ký HMAC 4 giờ trong đường dẫn (khung sandbox không gửi được
  // mã phiên); mã gắn trường, sai hoặc của trường khác thì 404; tệp có CSP sandbox nên không đọc được phiên của ứng dụng
  get(
    '/api/v1/scorm-content/:token/*path',
    'Tệp của gói SCORM theo mã truy cập ký trong đường dẫn, gắn trường, học sinh, hoạt động; theo tên miền của trường hoặc nguồn gốc nội dung riêng (DT-28 phần 28h)',
  ),
  // Trang kiểm tra chứng nhận hoàn thành khoá tự chọn (DT-28 phần 28i): chỉ tên khoá, ngày cấp, tên trường, họ tên viết tắt
  get(
    '/api/v1/public/certificates/:code',
    'Trang kiểm tra chứng nhận theo mã in trên chứng nhận, theo tên miền của trường; có giới hạn tần suất (DT-28 phần 28i)',
  ),
];
