---
yctd: YCTD-365
tieu_de: Gói buổi ở chợ gia sư
ngay: 2026-10-29
phien_ban_de_xuat: 0.245.0
---

## 02 Nhật ký

### 2026-10-29 — Gói buổi ở chợ gia sư

#### Công việc đã thực hiện

- Thêm GD-165 và mục 19.14 vào tài liệu 32. Cơ sở dữ liệu chợ marketplace 0051: bảng `market_packages`, giá gói ở `market_tutor_subjects`, cột `market_bookings.package_id`; cấu hình chợ `package_valid_days` (mặc định 56 ngày).
- Máy chủ API, `market-bookings.ts`:
  - mua gói, trả tiền giả lập, đặt buổi từ gói, hủy gói;
  - hủy buổi trong gói thì trả lượt về gói;
  - việc định kỳ hoàn phần buổi chưa học khi gói hết hạn; gia sư bị tạm khóa thì hoàn phần còn lại;
  - chuyển tiền của buổi trong gói dùng lệnh thu của gói.
- Hồ sơ dạy của gia sư nhận số buổi và giá cả gói cho từng môn; trang gia sư công khai và tìm gia sư trả giá gói.
- Chợ gia sư: thẻ đặt buổi chọn buổi lẻ hoặc gói; trang Buổi học của con có khối Gói buổi (trả tiền giả lập, đặt buổi từ gói, hủy gói); thẻ gia sư ghi "Có giá theo gói buổi"; buổi đặt từ gói có nhãn "Buổi trong gói".
- Ứng dụng Gia sư: hồ sơ dạy có số buổi và giá cả gói cho từng môn.
- Kiểm thử máy chủ: CT-365-1 (mua, đặt, hủy trả lượt, hết hạn hoàn phần chưa học), CT-365-2 (hủy gói trước buổi đầu hoàn đủ); kiểm thử cấu hình chợ `package_valid_days`.

#### Quyết định

- GD-165 do Eric chốt ngày 2026-10-29: dùng trong 8 tuần; hết hạn hoàn các buổi chưa học theo giá mỗi buổi của gói; hủy trước buổi đầu hoàn đủ; gia sư bị tạm khóa hoàn phần còn lại; mỗi buổi giải ngân riêng sau hạn khiếu nại; các mốc chỉnh được ở cấu hình chợ.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giá mỗi buổi của gói là giá gói chia số buổi, làm tròn xuống, phần dư hoàn khi gói kết thúc; phụ huynh hủy buổi trong gói phải trước giờ học 24 giờ mới được trả lượt.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-365, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Gói buổi chạy với bộ giả lập; khi có nhà cung cấp có giấy phép (E-02) cần nối giải ngân, hoàn từng phần theo một lệnh thu của gói.
- Ô chỉnh `package_valid_days` ở cổng vận hành làm cùng YCTD-363.

## 24 Yêu cầu thay đổi

### YCTD-365: Gói buổi ở chợ gia sư – 2026-10-29

- Lý do: chức năng gói buổi trong bản thiết kế Eric duyệt ngày 2026-10-28; Eric chốt quy tắc ngày 2026-10-29 (GD-165); phiên điều phối tách thành YCTD-365.
- Nội dung thay đổi: gia sư bán gói nhiều buổi; phụ huynh mua gói, đặt từng buổi từ gói; hoàn tiền theo GD-165.
- Thành phần bị ảnh hưởng: `database/marketplace/migrations/0051_create_market_packages.ts`, `database/marketplace/schema-parts/yctd-365-goi-buoi.ts`, `database/src/marketplace/market-settings.ts`, `apps/api/src/market/market-bookings.ts`, `market-tutor-rules.ts`, `market-listing.ts`, `market-public.ts`, `market-admin.ts`, `apps/api/src/tenancy-route-policy.ts`, `apps/market/src/*`, `apps/tutor/src/*`.
- Dữ liệu, API, quyền bị ảnh hưởng: marketplace 0051. API mới: `POST/GET /market/packages`, `POST /market/packages/:id/mock-pay`, `POST /market/packages/:id/cancel`. Thay đổi API cũ: `POST /market/bookings` nhận `package_id`; môn dạy của gia sư có `package_sessions`, `package_price`.
- Ảnh hưởng chức năng cũ: buổi lẻ không đổi.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/api`, `apps/market`, `apps/tutor`; kiểm thử máy chủ chợ; kiểm thử cấu hình chợ.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: gói buổi ở chợ gia sư (YCTD-365, GD-165).
- Cơ sở dữ liệu chợ: marketplace 0051.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gói buổi ở chợ gia sư | YCTD-365 |
