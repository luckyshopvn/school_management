---
yctd: YCTD-324
tieu_de: Giao diện cổng vận hành theo thiết kế
ngay: 2026-10-29
phien_ban_de_xuat: 0.200.0
---

## 02 Nhật ký

### 2026-10-29 — Giao diện cổng vận hành theo thiết kế

#### Công việc đã thực hiện

- Cổng vận hành theo thiết kế Eric duyệt ngày 2026-10-29: thanh bên xanh đậm, mục chia ba nhóm Điều hành (Tổng quan, Trường học, Bảng điều khiển, Đơn vị cấp trên, Danh mục đơn vị), Kinh doanh (Gói dịch vụ, Thu phí, Chợ gia sư, Trợ lý AI), Hệ thống (Bảo trì, Nhật ký truy cập, Nhân viên vận hành); tên, vai trò của nhân viên, Đổi mật khẩu, Đăng xuất ở chân thanh bên; máy tính bảng chỉ còn biểu tượng, điện thoại là ngăn kéo. Giữ mọi trang, tính năng có sẵn và lọc menu theo vai trò của YCTD-323; trang đăng nhập giữ nguyên.
- Trang Tổng quan: bốn ô chỉ số từ dữ liệu thật (đơn vị trong danh mục, trường đã khởi tạo và số khởi tạo hôm nay, trường bật tính năng trả phí, lượt quản trị vào trường 7 ngày); ô không có nguồn thì ẩn. Bảng trường mở gần đây có nút Vào trường, mục gói tính năng, truy cập gần đây (chỉ vai trò xem được nhật ký).
- Trang Nhật ký truy cập mới: lọc theo nhóm việc (vào trường, khởi tạo, tính năng trả phí), mã trường, khoảng ngày; phân trang; xuất CSV đúng bộ lọc (có BOM, chặn công thức bảng tính). Dịch vụ định danh thêm `GET /api/v1/auth/platform/audit-log` và `GET /api/v1/auth/platform/overview`; quyền mới `audit.view` (quản trị, hỗ trợ).
- Trang Trường học: tìm theo tên, mã, mã Bộ; lọc trạng thái; phân trang 50 dòng; nhãn trạng thái; nút Vào trường cho Admin. Trang chi tiết trường có bốn thẻ: Tổng quan (thông tin, thao tác, tên miền, loại dữ liệu, phiên hỗ trợ, sao lưu, nhật ký vòng đời), Gói và tính năng (gói hiện hành, phân hệ miễn phí, công tắc từng tính năng trả phí), Tài khoản quản trị trường (mở phiên vào thẳng tới trang Tài khoản của trường để tạo tài khoản theo đúng quy tắc của trường), Nhật ký truy cập của trường.
- Cổng quản trị: trang `/support-login` nhận `next` (chỉ đường dẫn trong trang) để mở thẳng trang Tài khoản.
- Kiểm thử: CT-1571, CT-1572 ở `apps/identity/src/platform/platform-audit.test.ts`; e2e 184 sửa theo trang Tổng quan mới.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: tạo tài khoản quản trị đầu tiên làm ở cổng quản trị của trường trong phiên vào thẳng thay cho biểu mẫu riêng ở cổng vận hành, để dùng chung quy tắc tài khoản của trường (mật khẩu mặc định, mã xác nhận đổi mật khẩu lần đầu, GD-163) và nhật ký; màu nhấn dùng màu thương hiệu của trang đăng nhập cổng vận hành.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-324, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Danh sách Trường học chỉ gồm trường đã khởi tạo; trường chưa khởi tạo vẫn tìm và mở ở Danh mục đơn vị.

## 24 Yêu cầu thay đổi

### YCTD-324: Giao diện cổng vận hành theo thiết kế – 2026-10-29

- Lý do: Eric yêu cầu áp thiết kế cổng vận hành đã duyệt ngày 2026-10-29 vào ứng dụng thật, giữ mọi trang và tính năng có sẵn.
- Nội dung thay đổi: Khung thanh bên chia nhóm; trang Tổng quan có ô chỉ số từ dữ liệu thật; trang Nhật ký truy cập có lọc, phân trang, xuất CSV; trang Trường học có tìm, lọc, phân trang, Vào trường; trang chi tiết trường chia bốn thẻ với công tắc tính năng trả phí.
- Thành phần bị ảnh hưởng: `apps/platform/src/Application.tsx`, `apps/platform/src/platform-menu.ts`, `apps/platform/src/cong-van-hanh.css`, `apps/platform/src/OverviewPage.tsx`, `apps/platform/src/AuditLogPage.tsx`, `apps/platform/src/audit-api.ts`, `apps/platform/src/SchoolsPage.tsx`, `apps/platform/src/platform-icons.tsx`, `apps/platform/src/main.tsx`, `apps/identity/src/platform/platform-audit.ts`, `apps/identity/src/platform/platform-schools.ts`, `apps/identity/src/tenancy-route-policy.ts`, `packages/shared/src/operator-permissions.ts`, `apps/portal/src/support/support.tsx`, `tests/e2e/184-tablet-portal-platform.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: giao diện cổng vận hành theo thiết kế, trang Nhật ký truy cập, Tổng quan có chỉ số (YCTD-324).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Giao diện cổng vận hành theo thiết kế | YCTD-324 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1571 | P19-06 | Nhật ký truy cập: lọc nhóm việc, trường, ngày sai dạng, xuất CSV; kế toán, không mã phiên | đúng dòng, tên người làm, địa chỉ mạng; 400 khi tham số sai; CSV có BOM, tiêu đề, chặn công thức; kế toán 403, không mã phiên 401 | Kiểm thử tự động `apps/identity/src/platform/platform-audit.test.ts` CT-324-1 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1572 | P19-06 | Số liệu Tổng quan với quản trị và kế toán | số trường, trường bật tính năng trả phí, lượt vào trường 7 ngày đúng dữ liệu; kế toán không thấy truy cập gần đây | Kiểm thử tự động CT-324-2 đạt ngày 29/10/2026 | Đạt |
