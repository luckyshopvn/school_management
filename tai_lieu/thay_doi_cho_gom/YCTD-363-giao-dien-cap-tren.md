---
yctd: YCTD-363
tieu_de: Giao diện trang đơn vị cấp trên, cấu hình và duyệt đánh giá của chợ ở cổng vận hành
ngay: 2026-10-29
phien_ban_de_xuat: 0.243.0
---

## 02 Nhật ký

### 2026-10-29 — Giao diện trang đơn vị cấp trên, cấu hình và duyệt đánh giá của chợ ở cổng vận hành

#### Công việc đã thực hiện

- Trang `/cap-tren` của cổng nền tảng làm lại theo bản vẽ Eric duyệt ngày 2026-10-28 (`ParentOrgApp.tsx`, kiểu riêng `parent-org.css`):
  - đăng nhập hai bước: tên đăng nhập, mật khẩu rồi mã xác thực; có lối dùng mã khôi phục (máy chủ đã nhận mã khôi phục ở cùng ô);
  - đầu trang xanh đậm có bốn trang: Tổng hợp, So sánh trường, Xuất báo cáo, Đề nghị xem chi tiết;
  - Tổng hợp: cây phạm vi (đơn vị và đơn vị con, số trường), bốn chỉ số chính (trường có số liệu, học sinh, tỉ lệ chuyên cần, nhân sự), bảng theo nhóm số liệu có dòng cộng, chú giải ô "ẩn", khối trường chưa có số liệu (đếm, không hiện tên trường chưa đồng ý);
  - So sánh trường: bảng sắp được theo từng cột, ô ẩn và trường chưa có số liệu xếp cuối; trường đang được xem chi tiết ghi hạn, trường khác có nút đề nghị xem chi tiết;
  - Xuất báo cáo: chọn đơn vị, nhiều nhóm số liệu (mỗi nhóm một tệp), Excel hoặc PDF;
  - Đề nghị xem chi tiết: biểu mẫu, danh sách đề nghị có nhãn trạng thái; "Mở phiên xem chi tiết" mở cổng quản trị của trường ở tab mới.
- Trang Chợ gia sư của cổng vận hành:
  - biểu mẫu cấu hình thêm các mốc phòng học video (GD-164) và hạn dùng gói buổi (GD-165); biểu mẫu gửi đủ các ô để lần lưu không đưa mốc về mặc định;
  - khối "Đánh giá gia sư chờ duyệt" (`MarketReviewModeration.tsx`): hiện hoặc từ chối có lý do, xem bản gốc trước khi che thông tin liên hệ.
- Kiểm thử giao diện 139 đổi theo đăng nhập hai bước và trang So sánh trường.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - bảng số liệu, không vẽ biểu đồ (theo bản vẽ đã duyệt);
  - xuất báo cáo vẫn tải trực tiếp, mỗi nhóm một tệp; chưa làm danh sách tệp đã xuất ở máy chủ và lựa chọn bố cục "so sánh từng trường" trong tệp;
  - dùng phông Be Vietnam Pro nếu máy có, không tải phông từ dịch vụ ngoài.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-363, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- "Rút đề nghị" của cấp trên chưa làm: cần điểm cuối mới ở `apps/identity/src/platform`, đang dành cho phiên bảo mật YCTD-323.
- Danh sách tệp đã xuất và bố cục so sánh trong tệp cần API xuất nền ở máy chủ.

## 24 Yêu cầu thay đổi

### YCTD-363: Giao diện trang đơn vị cấp trên, cấu hình và duyệt đánh giá của chợ ở cổng vận hành – 2026-10-29

- Lý do: bản thiết kế "Chợ gia sư, Gia sư, Cấp trên" Eric duyệt ngày 2026-10-28; mốc phòng học (YCTD-362), gói buổi (YCTD-365), duyệt đánh giá (YCTD-364) cần chỗ chỉnh ở cổng vận hành.
- Nội dung thay đổi: làm lại giao diện `/cap-tren`; thêm ô cấu hình mốc phòng học, hạn dùng gói buổi và khối duyệt đánh giá ở trang Chợ gia sư của cổng vận hành.
- Thành phần bị ảnh hưởng: `apps/platform/src/ParentOrgApp.tsx`, `apps/platform/src/parent-org.css`, `apps/platform/src/MarketPage.tsx`, `apps/platform/src/MarketReviewModeration.tsx`, `tests/e2e/139-parent-orgs.spec.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không đổi API; dùng `PUT /market/admin/settings` (thêm ô của YCTD-362, YCTD-365) và `/market/admin/reviews-moderation` của YCTD-364.
- Ảnh hưởng chức năng cũ: đăng nhập cấp trên thành hai bước trên giao diện (máy chủ không đổi); bảng so sánh chuyển sang trang riêng.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/platform`; kiểm thử giao diện 139.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: giao diện trang đơn vị cấp trên; cấu hình mốc phòng học, hạn dùng gói buổi và duyệt đánh giá gia sư ở cổng vận hành (YCTD-363).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Giao diện trang đơn vị cấp trên, cấu hình và duyệt đánh giá của chợ | YCTD-363 |
