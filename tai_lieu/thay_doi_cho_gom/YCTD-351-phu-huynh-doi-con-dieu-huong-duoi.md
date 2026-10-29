---
yctd: YCTD-351
tieu_de: Ứng dụng phụ huynh có nút Đổi con và thanh điều hướng dưới
ngay: 2026-10-29
phien_ban_de_xuat: 0.231.0
---

## 02 Nhật ký

### 2026-10-29 — Ứng dụng phụ huynh có nút Đổi con và thanh điều hướng dưới

#### Công việc đã thực hiện

- Thanh điều hướng dưới cố định ("Điều hướng chính") bốn mục, mỗi mục cao 52 px, mục đang mở có `aria-current`:
  - Trang chủ: như trước.
  - Lịch học: thời khoá biểu của con cấp phổ thông, bảng Học tập của con Mầm non.
  - Tin nhắn: thông báo của trường, trao đổi với giáo viên của từng con.
  - Tài khoản: họ tên, cài lên màn hình chính, thông báo đẩy, liên kết đăng nhập ngoài, Đăng xuất.
- Phụ huynh có từ hai con có ô "Đổi con" ở thanh đầu. Mặc định "Tất cả các con"; chọn một con thì Trang chủ, Lịch học, Tin nhắn chỉ của con đó.
- Giữ ô chọn lớp, học sinh của phiên hỗ trợ (YCTD-315b) và tuyến `/support-login`. Không sửa màn hình đăng nhập, `api-client`, `session`.
- Kiểm thử giao diện 85 (thanh điều hướng, Lịch học theo cấp, Đổi con giữ khi về Trang chủ) và 86 (Đổi con lọc thẻ của con).

#### Quyết định

- "Đổi con" mặc định hiện mọi con. Cách này giữ thói quen cũ của phụ huynh có nhiều con và các kiểm thử giao diện đang tìm thẻ của từng con. Trang chủ giữ đủ các bảng như trước (Đăng xuất vẫn ở trang chủ); ba mục còn lại là trang gọn cho điện thoại. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, Eric đồng ý làm theo đề xuất ngày 2026-10-28.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-351, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-351: Ứng dụng phụ huynh có nút Đổi con và thanh điều hướng dưới – 2026-10-29

- Lý do: mẫu giao diện đã duyệt của ứng dụng phụ huynh có nút "Đổi con" và thanh điều hướng dưới (để lại ở YCTD-296, YCTD-320); Eric đồng ý làm theo đề xuất.
- Nội dung thay đổi: thanh điều hướng dưới bốn mục; ô Đổi con lọc theo một con.
- Thành phần bị ảnh hưởng: `apps/parent/src/screens/HomeScreen.tsx`, `tests/e2e/85-multi-level-apps.spec.ts`, `tests/e2e/86-multi-level.spec.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không; trang chủ giữ nội dung, mặc định hiện mọi con.
- Kiểm thử cần thực hiện: kiểm kiểu ứng dụng phụ huynh; kiểm thử giao diện 07, 15, 16, 18, 85, 86, 183, 184.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: ứng dụng phụ huynh có thanh điều hướng dưới và nút Đổi con (YCTD-351).
- Không đổi dữ liệu, API, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Ứng dụng phụ huynh có nút Đổi con và thanh điều hướng dưới | YCTD-351 |
