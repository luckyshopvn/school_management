---
yctd: YCTD-313
tieu_de: Mã xác nhận ở đăng nhập cổng vận hành nền tảng
ngay: 2026-10-28
phien_ban_de_xuat: 0.189.0
---

## 02 Nhật ký

### 2026-10-28 — Mã xác nhận ở đăng nhập cổng vận hành nền tảng

#### Công việc đã thực hiện

- Dịch vụ định danh: thêm `POST /api/v1/auth/platform/captcha` (chỉ ở tên miền cổng nền tảng, giới hạn 30 ảnh mỗi địa chỉ mỗi phút); `POST /api/v1/auth/platform/login` nhận `captcha_id`, `captcha_text` và kiểm trước mật khẩu.
- Cùng cơ chế với đăng nhập cổng quản trị (PR 233, YCTD-310): dùng lại hàm sinh ảnh và đáp án lưu Redis 5 phút, dùng một lần; trang luôn hiện ô mã; có gửi mã thì phải đúng; không gửi mã chỉ được khi tên đăng nhập nhập sai chưa tới 3 lần trong 15 phút. Khóa Redis ở nhóm "platform" vì cổng không thuộc trường nào.
- Bước nhập mã xác thực hai lớp không phải giải ảnh lần nữa: bước 1 đúng mã ảnh và đúng mật khẩu thì máy chủ cấp "lượt đã qua" gắn với mã ảnh và tên đăng nhập trong 5 phút, bước 2 gửi lại mã ảnh đó.
- Cổng vận hành: ô "nhập mã xác nhận", ảnh mã và nút "Làm mới mã" cùng một hàng như mẫu; gửi lỗi thì lấy ảnh mới; sai mã hai lớp thì quay lại bước 1 với ảnh mới.
- Kiểm thử: kiểm thử đơn vị đăng nhập vận hành (gửi sai mã bị từ chối, sai mật khẩu ba lần thì bắt buộc mã, bước mã hai lớp dùng lượt đã qua); e2e `signInConsole` đọc đáp án ở Redis (`readPlatformCaptchaAnswerForTesting`), CT-26e-3 giả lập điểm cuối mã xác nhận.

#### Quyết định

- Không thêm đường vượt mã xác nhận bằng biến môi trường: kiểm thử đọc đáp án ở Redis như PR 233; các kiểm thử gọi thẳng API đăng nhập đúng mật khẩu không cần mã vì chưa tới ngưỡng nhập sai. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-313, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-313: Mã xác nhận ở đăng nhập cổng vận hành nền tảng – 2026-10-28

- Lý do: Gắn ô mã xác nhận vào trang đăng nhập cổng vận hành nền tảng theo mẫu đăng nhập mới (tiếp YCTD-312), cùng cơ chế mã xác nhận của đăng nhập trường (YCTD-310).
- Nội dung thay đổi: Điểm cuối lấy ảnh mã xác nhận của cổng vận hành; đăng nhập vận hành kiểm mã xác nhận (bắt buộc khi đã nhập sai 3 lần trong 15 phút, luôn kiểm khi có gửi); lượt đã qua cho bước mã hai lớp; ô mã, ảnh và nút làm mới ở trang đăng nhập.
- Thành phần bị ảnh hưởng: `apps/identity/src/authentication/captcha.service.ts`, `apps/identity/src/platform/platform-operators.ts`, `apps/identity/src/tenancy-route-policy.ts`, `apps/identity/src/test-support.ts`, `apps/platform/src/LoginPage.tsx`, `apps/platform/src/platform-api.ts`, `apps/platform/src/index.css`, `tests/e2e/platform-console.ts`, `tests/e2e/184-tablet-portal-platform.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: mã xác nhận ở đăng nhập cổng vận hành nền tảng (YCTD-313).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Mã xác nhận ở đăng nhập cổng vận hành nền tảng | YCTD-313 |
