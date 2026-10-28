---
yctd: YCTD-307
tieu_de: Chọn phân hệ ở cổng quản trị thì về bảng điều khiển của phân hệ
ngay: 2026-10-28
phien_ban_de_xuat: 0.184.0
---

## 02 Nhật ký

### 2026-10-28 — Chọn phân hệ ở cổng quản trị thì về bảng điều khiển của phân hệ

#### Công việc đã thực hiện

- Sửa lỗi Eric báo: chọn phân hệ khác ở ô Phân hệ chỉ đổi menu ngang, vùng nội dung vẫn là trang của phân hệ cũ nên phải tự bấm.
- Theo yêu cầu "bảng điều khiển phải cập nhật theo phân hệ": chọn phân hệ khác thì về trang chủ; trang chủ có vùng "Tổng quan phân hệ" đổi theo phân hệ đang chọn. Chọn lại phân hệ đang mở thì giữ nguyên trang.
- Khối theo phân hệ, chỉ hiện khi menu đã lọc theo quyền có trang tương ứng:
  - Quản lý văn bản và điều hành: "Công văn đến của tôi" (văn bản chờ xử lý như thẻ Chờ xử lý của 1.1, số chờ xử lý, 5 dòng mới nhất) và "Công văn đi của tôi" (chờ xử lý và dự thảo của tôi), mỗi khối có "Xem tất cả".
  - Quản lý giáo dục, Tài chính, Báo cáo: bảng điều khiển MH-01; Quản lý giáo dục thêm sinh nhật trong tháng.
  - Phân hệ có trang Hồ sơ cán bộ, giáo viên: hợp đồng sắp hết hạn.
  - Mọi phân hệ: Việc cần xử lý và Lối tắt tới 8 trang đầu của phân hệ.
- Khối không có số liệu ghi "Trống" thay vì ẩn hoặc để trống.
- Khung trang chỉ tự chuyển menu theo trang khi trang không thuộc phân hệ đang chọn.
- Kiểm thử e2e: CT-15a-9 (chọn phân hệ về trang chủ, khối văn bản ghi "Trống" với tài khoản mới), kịch bản văn bản đến (khối Công văn đến hiện văn bản vừa trình lãnh đạo), kịch bản văn bản đi (khối Công văn đi hiện dự thảo chờ cho ý kiến).

#### Quyết định

- Bảng điều khiển của phân hệ nằm ở trang chủ `/` theo phân hệ đang chọn (đã lưu trên trình duyệt), không thêm đường dẫn riêng cho từng phân hệ. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Vùng ngoài đặt tên "Tổng quan phân hệ …" để không trùng tên vùng "Bảng điều khiển" của MH-01 mà kiểm thử đang dùng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-307, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Các phân hệ ngoài văn bản, giáo dục, tài chính, báo cáo mới có Việc cần xử lý và Lối tắt; khối số liệu riêng cần thêm khi có yêu cầu cụ thể.

## 24 Yêu cầu thay đổi

### YCTD-307: Chọn phân hệ ở cổng quản trị thì về bảng điều khiển của phân hệ – 2026-10-28

- Lý do: Eric báo chuyển phân hệ mà màn hình chưa chuyển, phải tự bấm; yêu cầu bảng điều khiển cập nhật theo phân hệ; hỏi công văn đến, đi của tôi ở phân hệ Quản lý văn bản và điều hành, chốt "tự động hiển thị. nếu trống thì cứ ghi trống".
- Nội dung thay đổi: Ô Phân hệ chọn phân hệ khác thì về trang chủ; trang chủ hiện vùng Tổng quan phân hệ theo phân hệ đang chọn với các khối theo quyền; khối trống ghi "Trống".
- Thành phần bị ảnh hưởng: `apps/portal/src/pages/workspaces.tsx`, `apps/portal/src/pages/AppShell.tsx`, `apps/portal/src/pages/HomePage.tsx`, `apps/portal/src/pages/WorkspaceDashboard.tsx` (mới), `apps/portal/src/reports/DashboardCards.tsx`, `apps/portal/src/my-work/MyWorkSummary.tsx`, `tests/e2e/01-login.spec.ts`, `tests/e2e/70-incoming-documents.spec.ts`, `tests/e2e/72-outgoing-documents.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: chọn phân hệ ở cổng quản trị thì về bảng điều khiển của phân hệ; công văn đến, đi của tôi trên phân hệ văn bản; khối trống ghi "Trống" (YCTD-307).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Chọn phân hệ thì về bảng điều khiển của phân hệ | YCTD-307 |
