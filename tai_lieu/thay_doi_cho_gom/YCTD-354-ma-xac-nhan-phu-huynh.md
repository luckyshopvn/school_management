---
yctd: YCTD-354
tieu_de: Mã xác nhận ở đăng nhập bằng mật khẩu của ứng dụng phụ huynh
ngay: 2026-10-29
phien_ban_de_xuat: 0.234.0
---

## 02 Nhật ký

### 2026-10-29 — Mã xác nhận ở đăng nhập bằng mật khẩu của ứng dụng phụ huynh

#### Công việc đã thực hiện

- Dịch vụ định danh: đăng nhập bằng mật khẩu ở kênh `parent` dùng cùng quy tắc mã xác nhận với cổng quản trị và ứng dụng giáo viên (YCTD-353). Tên đăng nhập nhập sai đủ `captcha_failure_threshold` lần trong 15 phút thì bắt nhập mã; lần sai đếm theo tên đăng nhập, cộng chung mọi kênh. Đăng nhập bằng mã một lần qua tin nhắn không đổi.
- Ứng dụng phụ huynh: màn đăng nhập bằng mật khẩu hiện ảnh mã, nút "Làm mới mã" và ô "Mã xác nhận" từ lần nhập sai đầu tiên; `api-client` lấy ảnh mã và gửi kèm câu trả lời; `session` chuyển câu trả lời đi.
- BR-121 (`07`): mã xác nhận áp dụng cả ứng dụng phụ huynh khi đăng nhập bằng mật khẩu.
- Kiểm thử: CT-1529 (sai 3 lần ở kênh phụ huynh thì phải nhập mã; có mã đúng thì vào được; đăng nhập đúng thì xóa bộ đếm).

#### Quyết định

- Phiên điều phối giao ngày 2026-10-29, tách khỏi YCTD-353 để làm việc tồn đọng của YCTD-353. Không sửa `App.tsx` và màn trang chủ của ứng dụng phụ huynh vì PR khác đang sửa hai tệp đó.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-354, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-354: Mã xác nhận ở đăng nhập bằng mật khẩu của ứng dụng phụ huynh – 2026-10-29

- Lý do: Tồn đọng của YCTD-353: tài khoản phụ huynh (kể cả tài khoản theo số CCCD) đăng nhập bằng mật khẩu ở ứng dụng phụ huynh chưa gặp mã xác nhận.
- Nội dung thay đổi: Kênh phụ huynh đòi mã xác nhận theo cùng quy tắc; màn đăng nhập của ứng dụng phụ huynh có ô mã.
- Thành phần bị ảnh hưởng: `apps/identity/src/authentication/authentication.controller.ts`, `apps/parent/src/screens/LoginScreen.tsx`, `apps/parent/src/session/api-client.ts`, `apps/parent/src/session/session.tsx`, `apps/identity/src/authentication/login-security.test.ts`, `tai_lieu/07_QUY_TAC_NGHIEP_VU.md`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: mã xác nhận ở đăng nhập bằng mật khẩu của ứng dụng phụ huynh (YCTD-354).
- Phụ huynh nhập sai mật khẩu nhiều lần thì phải nhập mã xác nhận như cổng quản trị và ứng dụng giáo viên.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Mã xác nhận ở đăng nhập bằng mật khẩu của ứng dụng phụ huynh | YCTD-354 |

## Thêm dòng

| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1119 | Cho tài khoản phụ huynh / Khi nhập sai mật khẩu 3 lần ở ứng dụng phụ huynh rồi đăng nhập đúng không mã, có mã đúng, đăng nhập đúng lần nữa / Thì 400 ở ô mã, vào được, không còn đòi mã (CT-1529; YCTD-354) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1529 | P01-06 | Ứng dụng phụ huynh: sai mật khẩu 3 lần, đăng nhập đúng không mã, có mã đúng, đăng nhập đúng lần nữa | 401 ba lần; 400 ở ô mã; 200; 200 không cần mã | Kiểm thử tự động `apps/identity/src/authentication/login-security.test.ts` CT-1529 đạt ngày 29/10/2026 | Đạt |
