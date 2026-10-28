---
yctd: YCTD-364
tieu_de: Đánh giá gia sư, mật khẩu, đăng nhập định danh của phụ huynh, con đọc tin nhắn
ngay: 2026-10-29
phien_ban_de_xuat: 0.244.0
---

## 02 Nhật ký

### 2026-10-29 — Đánh giá gia sư, mật khẩu, đăng nhập định danh của phụ huynh, con đọc tin nhắn

#### Công việc đã thực hiện

- Thêm mục 19.13 vào tài liệu 32. Cơ sở dữ liệu chợ marketplace 0050: bảng `market_reviews`, mục đích `link` của lượt chuyển hướng OIDC, cột `market_children.reads_messages`.
- Máy chủ API:
  - `market-reviews.ts`: phụ huynh đánh giá buổi đã dạy; trang gia sư có đánh giá đã duyệt và điểm trung bình; gia sư xem và trả lời một lần; nhân viên nền tảng có hàng chờ, hiện hoặc từ chối có lý do; phụ huynh bật cho con đọc tin nhắn và lấy các luồng tin chỉ đọc;
  - `market-password.ts`: đổi mật khẩu, quên mật khẩu bằng mã, xác nhận lại mật khẩu, sửa tên hiển thị;
  - `market-identity.ts` mở cho ứng dụng Chợ gia sư: phụ huynh liên kết định danh, đăng nhập bằng định danh, xem định danh đã liên kết;
  - tìm gia sư trả điểm đánh giá và sắp `rating_desc`.
- Chợ gia sư:
  - thẻ gia sư có điểm, sắp "Đánh giá cao trước"; trang gia sư có khối đánh giá kèm trả lời và nút báo cáo đánh giá;
  - buổi đã dạy có biểu mẫu đánh giá;
  - trang Hồ sơ con có tùy chọn "con đọc tin nhắn" và chế độ con đọc (chỉ đọc, thoát bằng mật khẩu), khối tài khoản (tên hiển thị, đổi mật khẩu, liên kết định danh);
  - đăng nhập có "Quên mật khẩu?" và "Đăng nhập bằng" định danh; trang `/dinh-danh` hoàn tất đăng nhập, liên kết.
- Ứng dụng Gia sư: trang Đánh giá có ô trả lời, khối Tài khoản ở trang Hồ sơ và môn dạy, "Quên mật khẩu?" ở trang đăng nhập.
- Kiểm thử máy chủ: CT-364-1 (đánh giá, con đọc tin nhắn), CT-364-2 (mật khẩu, tên hiển thị), CT-364-3 (đăng nhập định danh của phụ huynh); sửa CT-27g-2 (ứng dụng phụ huynh nay có danh sách nhà cung cấp định danh).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - đánh giá chờ duyệt rồi mới hiện (theo bản vẽ đã duyệt);
  - con đọc tin nhắn trên máy của phụ huynh, bằng phiên của phụ huynh, thoát phải nhập mật khẩu; không cấp tài khoản hay đường dẫn riêng cho trẻ;
  - quên mật khẩu không cho biết tài khoản có tồn tại hay không.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-364, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Gói buổi chưa làm, chờ Eric chốt quy tắc hạn dùng và hoàn tiền phần chưa học.
- Giao diện duyệt đánh giá ở cổng vận hành làm cùng YCTD-363; trước đó đánh giá nằm ở hàng chờ, chưa hiện.
- Đổi thư điện tử, số điện thoại của tài khoản chợ chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-364: Đánh giá gia sư, mật khẩu, đăng nhập định danh của phụ huynh, con đọc tin nhắn – 2026-10-29

- Lý do: các chức năng trong bản thiết kế Eric duyệt ngày 2026-10-28 cần API mới (việc T-M2, T-M5, T-M6, T-M9 của rà soát giao diện ngày 2026-10-28); phiên điều phối xếp thành YCTD-364.
- Nội dung thay đổi: đánh giá sau buổi có duyệt, gia sư trả lời; đổi, đặt lại mật khẩu, sửa tên hiển thị; phụ huynh liên kết và đăng nhập bằng định danh; con đọc tin nhắn chỉ đọc khi phụ huynh cho.
- Thành phần bị ảnh hưởng: `database/marketplace/migrations/0050_create_market_reviews.ts`, `database/marketplace/schema-parts/yctd-364-danh-gia.ts`, `dt-27g-xac-minh-gia-su.ts`, `apps/api/src/market/market-reviews.ts`, `market-password.ts`, `market-identity.ts`, `market-public.ts`, `market-family.ts`, `apps/api/src/dang-ky/yctd-364-danh-gia-tai-khoan.ts`, `apps/api/src/tenancy-route-policy.ts`, `packages/market-client/src/*`, `apps/market/src/*`, `apps/tutor/src/*`.
- Dữ liệu, API, quyền bị ảnh hưởng: marketplace 0050. API mới:
  - đánh giá: `POST/GET /market/bookings/:id/review`, `GET /market/public/reviews/:tutorId`, `GET /market/tutor/reviews`, `POST /market/tutor/reviews/:id/reply`, `GET /market/admin/reviews-moderation`, `POST /market/admin/reviews-moderation/:id`;
  - con đọc tin nhắn: `POST /market/children/:id/reads-messages`, `GET /market/children/:id/messages`;
  - mật khẩu và tài khoản: `POST /market/auth/password/change|confirm|forgot|reset`, `PUT /market/me`;
  - định danh: `GET /market/identity/linked`.

  Thay đổi API cũ: `/market/identity/*` dùng được ở tên miền của chợ (phụ huynh); tìm gia sư thêm `rating` và `sort=rating_desc`.
- Ảnh hưởng chức năng cũ: không đổi luồng cũ; `GET /market/identity/providers` ở tên miền của chợ trả danh sách thay cho 404.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/api`, `apps/market`, `apps/tutor`; kiểm thử máy chủ chợ; kiểm thử giao diện 195 đến 199.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: đánh giá gia sư có duyệt, đổi và đặt lại mật khẩu, đăng nhập định danh của phụ huynh, con đọc tin nhắn ở chợ gia sư (YCTD-364).
- Cơ sở dữ liệu chợ: marketplace 0050.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Đánh giá gia sư, mật khẩu, đăng nhập định danh của phụ huynh, con đọc tin nhắn | YCTD-364 |
