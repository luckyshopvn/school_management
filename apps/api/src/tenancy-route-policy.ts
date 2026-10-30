// Chính sách trường của các tuyến API công khai (DT-SaaS phần S1a, tài liệu 47 mục 14.7 lớp 3): tuyến không đòi mã phiên của đúng
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
  post(
    '/api/v1/device-events',
    'Thiết bị điểm danh của trường gửi lượt qua cổng (YCTD-389 lát L2, BM-232): nhận theo tên miền của trường, xác thực bằng khóa riêng của thiết bị (chỉ lưu mã băm), thiết bị tắt bị từ chối, chỉ nhận mã người, hướng, thời điểm',
  ),
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
    '/api/v1/parent-org/exports',
    'Danh sách tệp xuất chạy nền của tài khoản cấp trên (YCTD-367): cùng điều kiện tên miền cổng nền tảng và mã phiên cấp trên; chỉ việc của chính tài khoản',
  ),
  post(
    '/api/v1/parent-org/exports',
    'Tạo việc xuất báo cáo chạy nền cho tài khoản cấp trên (YCTD-367): đơn vị phải trong phạm vi; tệp chỉ có số liệu tổng hợp, cùng quy tắc ẩn ô nhỏ',
  ),
  get(
    '/api/v1/parent-org/exports/:id/file',
    'Tải tệp xuất chạy nền của tài khoản cấp trên (YCTD-367): chỉ người tạo, đơn vị còn trong phạm vi, tệp chưa hết hạn; ghi nhật ký',
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
  // Chợ gia sư (DT-27 phần 27f): đường dẫn không cần trường, cơ sở dữ liệu marketplace riêng, không có ngữ cảnh trường nên không với tới
  // dữ liệu của trường nào; phần người dùng chỉ ở tên miền dành riêng của chợ khi chợ bật, phần quản trị chỉ ở tên miền cổng nền tảng
  ...(
    [
      ['GET', '/api/v1/market/public/site'],
      ['GET', '/api/v1/market/public/documents/:kind'],
      ['POST', '/api/v1/market/auth/register'],
      ['POST', '/api/v1/market/auth/verify'],
      ['POST', '/api/v1/market/auth/resend'],
      ['POST', '/api/v1/market/auth/login'],
      ['POST', '/api/v1/market/auth/logout'],
      ['GET', '/api/v1/market/me'],
      ['POST', '/api/v1/market/me/consents/:documentId'],
      ['GET', '/api/v1/market/children'],
      ['POST', '/api/v1/market/children'],
      ['PUT', '/api/v1/market/children/:id'],
      ['DELETE', '/api/v1/market/children/:id'],
      ['POST', '/api/v1/market/children/:id/consent'],
      ['POST', '/api/v1/market/children/:id/consent/withdraw'],
      ['POST', '/api/v1/market/children/:id/school-link'],
      ['DELETE', '/api/v1/market/children/:id/school-link'],
      ['GET', '/api/v1/market/tutor/profile'],
      ['PUT', '/api/v1/market/tutor/profile'],
      ['PUT', '/api/v1/market/tutor/provider'],
      // Hồ sơ, xác minh gia sư, tìm gia sư (DT-27 phần 27g)
      ['GET', '/api/v1/market/tutor/listing'],
      ['PUT', '/api/v1/market/tutor/listing'],
      ['POST', '/api/v1/market/tutor/listing/submit'],
      ['POST', '/api/v1/market/tutor/verifications/:kind'],
      ['PUT', '/api/v1/market/tutor/school-role'],
      ['DELETE', '/api/v1/market/tutor/school-role'],
      ['GET', '/api/v1/market/tutor/form-03'],
      ['GET', '/api/v1/market/identity/providers'],
      ['POST', '/api/v1/market/identity/start'],
      ['POST', '/api/v1/market/identity/complete'],
      ['GET', '/api/v1/market/public/tutors'],
      ['GET', '/api/v1/market/public/tutors/:id'],
      // Đặt buổi, thanh toán, tranh chấp (DT-27 phần 27h)
      ['POST', '/api/v1/market/bookings'],
      ['GET', '/api/v1/market/bookings'],
      ['POST', '/api/v1/market/bookings/:id/mock-pay'],
      ['POST', '/api/v1/market/bookings/:id/cancel'],
      ['POST', '/api/v1/market/bookings/:id/dispute'],
      ['GET', '/api/v1/market/bookings/:id/dispute'],
      ['POST', '/api/v1/market/disputes/:id/statements'],
      ['POST', '/api/v1/market/disputes/:id/appeal'],
      ['GET', '/api/v1/market/tutor/bookings'],
      ['POST', '/api/v1/market/tutor/bookings/:id/complete'],
      ['POST', '/api/v1/market/tutor/bookings/:id/cancel'],
      ['GET', '/api/v1/market/tutor/bookings/:id/dispute'],
      // Tin nhắn, báo cáo vi phạm, phòng học có ghi hình (DT-27 phần 27i)
      ['GET', '/api/v1/market/messages/threads'],
      ['POST', '/api/v1/market/messages/threads'],
      ['GET', '/api/v1/market/messages/threads/:id'],
      ['POST', '/api/v1/market/messages/threads/:id'],
      ['POST', '/api/v1/market/reports'],
      ['GET', '/api/v1/market/reports'],
      ['POST', '/api/v1/market/reports/:id/appeal'],
      ['GET', '/api/v1/market/tutor/safety'],
      ['POST', '/api/v1/market/tutor/bookings/:id/session/start'],
      ['POST', '/api/v1/market/tutor/bookings/:id/session/end'],
      ['POST', '/api/v1/market/bookings/:id/session/join'],
      ['GET', '/api/v1/market/bookings/:id/recording'],
      ['GET', '/api/v1/market/bookings/:id/recording/stream'],
      ['GET', '/api/v1/market/tutor/bookings/:id/recording'],
      ['GET', '/api/v1/market/tutor/bookings/:id/recording/stream'],
      // Phòng học video: đồng ý ghi hình, phòng chờ, vào ra, gia sư vắng, xác nhận buổi (DT-27 phần 27j, YCTD-362)
      ['GET', '/api/v1/market/bookings/:id/room'],
      ['POST', '/api/v1/market/bookings/:id/room/consent'],
      ['POST', '/api/v1/market/bookings/:id/room/decline-recording'],
      ['POST', '/api/v1/market/bookings/:id/room/enter'],
      ['POST', '/api/v1/market/bookings/:id/room/leave'],
      ['POST', '/api/v1/market/bookings/:id/tutor-no-show'],
      ['GET', '/api/v1/market/recording-consents'],
      ['POST', '/api/v1/market/recording-consents/:id/withdraw'],
      ['GET', '/api/v1/market/tutor/bookings/:id/room'],
      ['POST', '/api/v1/market/tutor/bookings/:id/room/participants/:identity'],
      ['POST', '/api/v1/market/tutor/bookings/:id/room/confirm'],
      // Đánh giá, con đọc tin nhắn, mật khẩu, tên hiển thị, định danh của phụ huynh (YCTD-364)
      ['POST', '/api/v1/market/bookings/:id/review'],
      ['GET', '/api/v1/market/bookings/:id/review'],
      ['GET', '/api/v1/market/public/reviews/:tutorId'],
      ['GET', '/api/v1/market/tutor/reviews'],
      ['POST', '/api/v1/market/tutor/reviews/:id/reply'],
      ['POST', '/api/v1/market/children/:id/reads-messages'],
      ['GET', '/api/v1/market/children/:id/messages'],
      ['POST', '/api/v1/market/auth/password/change'],
      ['POST', '/api/v1/market/auth/password/confirm'],
      ['POST', '/api/v1/market/auth/password/forgot'],
      ['POST', '/api/v1/market/auth/password/reset'],
      ['PUT', '/api/v1/market/me'],
      ['GET', '/api/v1/market/identity/linked'],
      // Gói buổi (YCTD-365, GD-165)
      ['POST', '/api/v1/market/packages'],
      ['GET', '/api/v1/market/packages'],
      ['POST', '/api/v1/market/packages/:id/mock-pay'],
      ['POST', '/api/v1/market/packages/:id/cancel'],
    ] as const
  ).map(([method, path]) => ({
    method,
    path,
    reason:
      'Chợ gia sư (DT-27 phần 27f): không thuộc trường nào, phiên riêng của chợ (bảng market_sessions), chỉ ở tên miền dành riêng của chợ khi chợ bật (tên miền khác 404); cơ sở dữ liệu marketplace bằng vai trò riêng',
  })),
  post(
    '/api/v1/market/payments/webhooks/:provider',
    'Sự kiện của nhà cung cấp thanh toán của chợ gia sư (DT-27 phần 27h): không thuộc trường nào, đi qua đường dẫn không cần trường; xác thực bằng chữ ký của nhà cung cấp, ghi một lần theo mã sự kiện; chợ chưa nối thì 404',
  ),
  ...(
    [
      ['GET', '/api/v1/market/admin'],
      ['PUT', '/api/v1/market/admin/settings'],
      ['POST', '/api/v1/market/admin/documents'],
      ['GET', '/api/v1/market/admin/reviews'],
      ['GET', '/api/v1/market/admin/reviews/tutors/:id'],
      ['GET', '/api/v1/market/admin/reviews/documents/:id'],
      ['POST', '/api/v1/market/admin/reviews/tutors/:id/profile'],
      ['POST', '/api/v1/market/admin/reviews/tutors/:id/verifications/:kind'],
      ['GET', '/api/v1/market/admin/payments'],
      ['GET', '/api/v1/market/admin/payments/disputes/:id'],
      ['POST', '/api/v1/market/admin/payments/disputes/:id/decide'],
      ['POST', '/api/v1/market/admin/payments/disputes/:id/finalize'],
      ['POST', '/api/v1/market/admin/payments/commission-rules'],
      ['POST', '/api/v1/market/admin/payments/run-due'],
      ['GET', '/api/v1/market/admin/safety'],
      ['GET', '/api/v1/market/admin/safety/reports/:id'],
      ['POST', '/api/v1/market/admin/safety/reports/:id/assign'],
      ['POST', '/api/v1/market/admin/safety/reports/:id/decide'],
      // Duyệt đánh giá gia sư (YCTD-364)
      ['GET', '/api/v1/market/admin/reviews-moderation'],
      ['POST', '/api/v1/market/admin/reviews-moderation/:id'],
      ['POST', '/api/v1/market/admin/safety/reports/:id/suspend'],
      ['POST', '/api/v1/market/admin/safety/reports/:id/export'],
      ['GET', '/api/v1/market/admin/safety/recordings/:bookingId'],
      ['POST', '/api/v1/market/admin/safety/run-due'],
    ] as const
  ).map(([method, path]) => ({
    method,
    path,
    reason:
      'Quản trị chợ gia sư ở cổng nền tảng (DT-27 phần 27f): mã phiên vận hành (đối tượng riêng), chỉ ở tên miền PLATFORM_CONSOLE_HOST (tên miền khác 404)',
  })),
  // Gói gia sư AI nền tảng bán thẳng cho phụ huynh (YCTD-383 lát L1b)
  ...(
    [
      ['GET', '/api/v1/platform-ai-tutor/plans'],
      ['POST', '/api/v1/platform-ai-tutor/plans'],
      ['PUT', '/api/v1/platform-ai-tutor/plans/:id'],
      ['POST', '/api/v1/platform-ai-tutor/plans/:id/status'],
      ['GET', '/api/v1/platform-ai-tutor/orders'],
      ['GET', '/api/v1/platform-ai-tutor/orders/:id'],
      ['POST', '/api/v1/platform-ai-tutor/orders/:id/cancel'],
      ['POST', '/api/v1/platform-ai-tutor/orders/:id/refund'],
    ] as const
  ).map(([method, path]) => ({
    method,
    path,
    reason:
      'Quản lý gói gia sư AI nền tảng bán, giao dịch, hoàn tiền ở cổng nền tảng (YCTD-383 lát L1b): không thuộc trường nào; mã phiên vận hành vai trò quản trị hoặc kế toán, chỉ ở tên miền PLATFORM_CONSOLE_HOST (tên miền khác 404)',
  })),
];
