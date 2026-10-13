# DT-14 phần 14b: Năm học ở thanh đầu trang và Truy cập nhanh (YCTD-102)

Bản nháp để cập nhật vào bộ tài liệu `tai_lieu/` khi gộp. Eric yêu cầu ngày 13/10/2026 sau khi xem hệ thống của Sở
Giáo dục và Đào tạo TP.HCM: thanh đầu trang hiện cấp học, năm học và học kỳ; trang chủ có vùng "TRUY CẬP NHANH" với nút
"Thêm truy cập nhanh".

## Tóm tắt

1. **Năm học và học kỳ ở thanh đầu trang** (cổng quản trị, bên phải trước chuông thông báo): nút hiện
   "`<tên năm học>` · `<học kỳ>`", ví dụ "2026–2027 · Học kỳ I". Học kỳ là kỳ trong lịch năm học (bảng
   `academic_terms`) chứa ngày hôm nay theo giờ Việt Nam: Học kỳ I, Học kỳ II hoặc Kỳ hè; ngày nằm ngoài mọi kỳ thì
   hiện "Ngoài học kỳ"; chưa mở năm học nào thì hiện "Chưa có năm học đang dùng". Bấm nút mở danh sách các năm học đang
   dùng và đã đóng (không hiện năm học nháp), mỗi năm kèm các học kỳ và ngày bắt đầu, kết thúc; học kỳ hiện tại được đánh
   dấu "(hiện tại)". Màn hình hẹp hơn 768 điểm ảnh ẩn nút để thanh đầu trang không xuống dòng.
2. **Truy cập nhanh trên trang chủ**: vùng "Truy cập nhanh" ngay dưới lời chào. Nút "Thêm truy cập nhanh" mở bộ chọn
   liệt kê các trang người dùng đang thấy trên thanh điều hướng (đã lọc theo quyền), nhóm theo phân hệ (YCTD-101); bấm
   một trang để ghim. Mỗi ô có biểu tượng phân hệ, tên trang, nút đưa lên trước, đưa ra sau và bỏ; kéo thả ô để đổi chỗ.
   Tối đa 12 ô. Lối tắt lưu ở máy chủ theo tài khoản nên dùng được trên mọi máy và giữ qua các năm học.

## Thiết kế

- Bảng mới `user_quick_links` ở **cơ sở dữ liệu hệ thống** (tệp thay đổi cấu trúc
  `database/system/migrations/0004_create_user_quick_links.ts`): `id`, `user_id` (mã tài khoản ở dịch vụ định danh,
  không có khóa ngoại vì khác cơ sở dữ liệu), `path`, `label` (1-100 ký tự), `position` (từ 0), `created_at`; duy nhất
  theo (`user_id`, `path`); chỉ mục (`user_id`, `position`).
- Điểm cuối máy chủ API (chỉ cần đăng nhập, không cần quyền riêng; chỉ đọc và sửa lối tắt của chính tài khoản gọi):
  - `GET /api/v1/me/quick-links` trả danh sách `{ path, label, position }` theo thứ tự.
  - `PUT /api/v1/me/quick-links` với `{ links: [{ path, label }] }` thay cả danh sách trong một giao dịch (khóa theo tài
    khoản để hai lần lưu cùng lúc chạy lần lượt); thứ tự trong mảng là thứ tự hiển thị. Lỗi `ERR_VALIDATION` (400) khi
    `links` không phải mảng, quá 12 mục, đường dẫn ngoài danh sách cho phép, trùng đường dẫn, nhãn rỗng hoặc dài hơn 100
    ký tự.
- Danh sách đường dẫn cho phép `PORTAL_QUICK_LINK_PATHS` và giới hạn `MAX_QUICK_LINKS = 12` đặt ở gói dùng chung
  `@school-management/shared`, khớp các trang trên thanh điều hướng (không gồm Trang chủ và Đổi mật khẩu).
- Mục điều hướng tự đăng ký vào một ngữ cảnh khi hiện ra; bộ chọn và các ô chỉ dùng trang trong ngữ cảnh này. Thanh
  điều hướng khi ẩn vẫn giữ trong cây giao diện (thuộc tính `hidden`) để trang chủ biết các trang người dùng được mở.

## Quyết định

- **Không cho xem năm học đã đóng**: máy chủ API chỉ đọc và ghi cơ sở dữ liệu của năm học đang dùng (BR-93,
  `CurrentSchoolYearResolver`), chưa có tham số hay tiêu đề yêu cầu để đọc cơ sở dữ liệu năm học đã đóng. Theo hướng
  "làm bản tối thiểu an toàn", năm học đã đóng chỉ hiện trong danh sách, không chọn được, có chú thích "Chưa hỗ trợ xem
  năm học cũ". Không có đường nào ghi vào năm học đã đóng. Biểu ngữ "Đang xem năm học … (chỉ xem)" để dành khi làm
  được việc đọc năm học cũ.
- **Học kỳ chỉ để hiển thị**: chưa trang nào của cổng quản trị lọc theo học kỳ nên chọn học kỳ không đổi gì; danh sách
  chỉ hiện học kỳ và ngày.
- **Lưu ở cơ sở dữ liệu hệ thống**, không ở cơ sở dữ liệu năm học (để giữ qua các năm) và không ở dịch vụ định danh (lối
  tắt là thiết lập giao diện của cổng quản trị, không phải dữ liệu định danh).
- **Máy chủ không đối chiếu quyền theo từng trang**: mỗi trang vẫn tự kiểm tra quyền khi mở và gọi dữ liệu; máy chủ chỉ
  kiểm tra đường dẫn nằm trong danh sách cho phép. Giao diện chỉ hiện ô của trang người dùng còn thấy trên thanh điều
  hướng; mất quyền thì ô tự ẩn và bị bỏ ở lần lưu sau. Tên ô lấy theo thanh điều hướng hiện hành.
- **Thay cả danh sách mỗi lần lưu** (PUT) thay vì thêm, bớt từng mục: đơn giản, thứ tự luôn liền mạch.
- Sắp xếp bằng nút lên/xuống (dùng được bằng bàn phím) và kéo thả (chuột).

## Kịch bản kiểm thử

- CT-14b-1: Gọi `GET` hoặc `PUT /me/quick-links` không có mã phiên: 401 — đạt.
- CT-14b-2: Tài khoản mới đọc lối tắt: danh sách rỗng — đạt.
- CT-14b-3: Lưu ba lối tắt rồi đọc lại: đúng thứ tự gửi lên, vị trí 0, 1, 2 — đạt.
- CT-14b-4: Gửi lại danh sách đã đổi thứ tự và bỏ một mục: máy chủ lưu đúng thứ tự mới, còn hai mục — đạt.
- CT-14b-5: Tài khoản khác đọc và lưu lối tắt: không thấy và không đổi lối tắt của tài khoản thứ nhất — đạt.
- CT-14b-6: Lưu đường dẫn ngoài danh sách cho phép (`/../admin`, địa chỉ ngoài, `/`, `/change-password`): 400
  `ERR_VALIDATION` tại `links[0].path`, dữ liệu cũ giữ nguyên — đạt.
- CT-14b-7: Lưu 13 lối tắt hoặc hai mục trùng trang, nhãn rỗng hoặc quá 100 ký tự: 400 — đạt.
- CT-14b-8: Lưu danh sách rỗng: xóa hết lối tắt — đạt.
- CT-14b-9: Thanh đầu trang của Hiệu trưởng hiện tên năm học đang dùng; mở danh sách thấy năm học đó được đánh dấu đang
  dùng kèm các học kỳ; phím Esc đóng danh sách — đạt.
- CT-14b-10: Hiệu trưởng ghim "Hồ sơ trẻ" và "Công nợ", đưa "Công nợ" lên trước, tải lại vẫn còn đúng thứ tự; bỏ "Công
  nợ", tải lại chỉ còn "Hồ sơ trẻ"; bấm ô mở trang Hồ sơ trẻ — đạt.

Kiểm thử đơn vị: `apps/api/src/quick-links/quick-links.test.ts` (CT-14b-1 đến CT-14b-8 và kiểm tra hàm
`parseQuickLinks`). Kiểm thử giao diện: `tests/e2e/47-quick-access.spec.ts` (CT-14b-9, CT-14b-10).

## Giới hạn

- Chưa xem được năm học đã đóng; cần máy chủ API nhận năm học cần đọc (ví dụ tiêu đề yêu cầu) và mở kết nối chỉ đọc tới
  cơ sở dữ liệu năm học đã đóng, đồng thời chặn mọi thao tác ghi.
- Chưa có trang nào lọc theo học kỳ, nên học kỳ ở thanh đầu trang chỉ để xem.
- Học kỳ hiện tại tính theo đồng hồ của trình duyệt (giờ Việt Nam); máy người dùng sai giờ thì có thể hiện sai kỳ.
- Không hiện cấp học ("Cấp MN") như hệ thống của Sở vì trường chỉ có cấp mầm non.
- Trên điện thoại (màn hình hẹp hơn 768 điểm ảnh) nút năm học ẩn.
