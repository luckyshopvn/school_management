---
yctd: YCTD-367
tieu_de: Trang cấp trên rút đề nghị xem chi tiết, xuất báo cáo chạy nền
ngay: 2026-10-29
phien_ban_de_xuat: 0.247.0
---

## 02 Nhật ký

### 2026-10-29 — Trang cấp trên rút đề nghị xem chi tiết, xuất báo cáo chạy nền

#### Công việc đã thực hiện

- Cơ sở dữ liệu nền tảng 0245:
  - đề nghị xem chi tiết thêm trạng thái `withdrawn` (cấp trên rút, khác `revoked` là trường rút) và cột `withdrawn_at`;
  - bảng `parent_org_exports` cho việc xuất chạy nền.
- Dịch vụ định danh: `POST /api/v1/auth/parent-org/access-requests/:id/withdraw`.
  - Chỉ người gửi rút được, với đề nghị đang chờ hoặc đã duyệt còn hạn.
  - Phiên xem chi tiết đang mở kết thúc ngay.
  - Ghi nhật ký `parent-org.access-withdrawn`.
- Máy chủ API, `parent-org-exports.ts`:
  - tạo việc xuất (nhiều nhóm số liệu trong một tệp; bố cục tổng hợp theo đơn vị hoặc so sánh từng trường; Excel hoặc PDF);
  - việc định kỳ dựng tệp, chiếm việc bằng `for update skip locked`, dựng lại việc bị dừng giữa chừng tối đa 3 lần;
  - lưu tệp ở kho tệp chung theo thư mục của đơn vị cấp trên, giữ 7 ngày rồi xóa;
  - danh sách tệp của chính tài khoản, tải về có ghi nhật ký;
  - bảng của tệp xuất dùng chung với tải trực tiếp (`aggregateSheets`).
- Trang `/cap-tren`:
  - trang Xuất báo cáo có chọn bố cục, danh sách "Tệp đã xuất" tự làm mới khi còn tệp đang tạo, nút tải về; bản triển khai chưa có kho tệp thì tải trực tiếp như trước;
  - thẻ đề nghị có "Rút đề nghị" (hỏi lại một lần), trạng thái "Bạn đã rút".
- Cổng quản trị của trường: bảng đề nghị ghi "Cấp trên đã rút".
- Kiểm thử máy chủ: CT-367-1 (xuất chạy nền), CT-367-2 (rút đề nghị chờ duyệt và đã duyệt, phiên xem chi tiết kết thúc).
- Kiểm lại trang Chợ gia sư của cổng vận hành sau YCTD-323 và YCTD-324:
  - các khối theo vai trò khớp quyền ở máy chủ;
  - ô mốc phòng học và hạn dùng gói vẫn còn.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - quyền theo tài khoản cấp trên và cây đơn vị, không theo vai trò vận hành; bảng quyền vận hành của YCTD-323 không cần mục mới;
  - mỗi tài khoản tối đa 3 tệp đang tạo; tệp giữ 7 ngày (`PARENT_ORG_EXPORT_RETENTION_DAYS`), việc định kỳ chạy mỗi 30 giây (`PARENT_ORG_EXPORT_INTERVAL_SECONDS`, 0 là tắt);
  - rút đề nghị đã duyệt là kết thúc phiên đang mở ngay, như khi trường rút.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-367, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không có.

## 24 Yêu cầu thay đổi

### YCTD-367: Trang cấp trên rút đề nghị xem chi tiết, xuất báo cáo chạy nền – 2026-10-29

- Lý do: hai việc còn lại của YCTD-363; Eric cho làm ngày 2026-10-29.
- Nội dung thay đổi: cấp trên rút đề nghị xem chi tiết của mình; xuất báo cáo chạy nền có danh sách tệp đã xuất.
- Thành phần bị ảnh hưởng: `database/platform/migrations/0245_add_parent_org_exports_and_withdraw.ts`, `database/platform/schema.ts`, `apps/identity/src/platform/parent-orgs.ts`, `apps/identity/src/tenancy-route-policy.ts`, `apps/api/src/parent-org/*`, `apps/api/src/dang-ky/yctd-367-xuat-nen-cap-tren.ts`, `apps/api/src/common/configuration.ts`, `apps/api/src/tenancy-route-policy.ts`, `apps/platform/src/ParentOrgApp.tsx`, `apps/platform/src/parent-org-api.ts`, `apps/portal/src/support/parent-org-consents.tsx`.
- Dữ liệu, API, quyền bị ảnh hưởng: nền tảng 0245. API mới:
  - `POST /api/v1/auth/parent-org/access-requests/:id/withdraw`;
  - `GET/POST /api/v1/parent-org/exports`, `GET /api/v1/parent-org/exports/:id/file`.
- Ảnh hưởng chức năng cũ: tải trực tiếp không đổi; tệp tải trực tiếp có thêm dòng tiêu đề ở trang Tổng hợp.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/api`, `apps/identity`, `apps/platform`, `apps/portal`; kiểm thử máy chủ đơn vị cấp trên.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: cấp trên rút đề nghị xem chi tiết, xuất báo cáo chạy nền (YCTD-367).
- Cơ sở dữ liệu nền tảng: 0245.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cấp trên rút đề nghị, xuất báo cáo chạy nền | YCTD-367 |
