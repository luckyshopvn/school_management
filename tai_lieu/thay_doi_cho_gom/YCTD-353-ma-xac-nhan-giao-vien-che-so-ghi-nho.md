---
yctd: YCTD-353
tieu_de: Mã xác nhận ở ứng dụng giáo viên, che số định danh trong nhật ký và chi tiết tài khoản, giới hạn "Ghi nhớ"
ngay: 2026-10-29
phien_ban_de_xuat: 0.233.0
---

## 02 Nhật ký

### 2026-10-29 — Mã xác nhận ở ứng dụng giáo viên, che số định danh, giới hạn "Ghi nhớ"

#### Công việc đã thực hiện

- Mã xác nhận ở kênh giáo viên (L-07 của tài liệu 35):
  - Đăng nhập kênh `teacher` dùng cùng quy tắc với cổng quản trị: tên đăng nhập nhập sai đủ `captcha_failure_threshold` lần trong 15 phút thì bắt nhập mã. Lần sai đếm theo tên đăng nhập, cộng chung mọi kênh có mã.
  - Ứng dụng giáo viên hiện ảnh mã, nút "Làm mới mã" và ô "Mã xác nhận" từ lần nhập sai đầu tiên, như ứng dụng học sinh.
- Số định danh của học sinh (L-05): nhật ký cấp tài khoản học và thi (máy chủ API), nhật ký đồng bộ tài khoản học sinh và thông báo trùng tên đăng nhập (dịch vụ định danh) chỉ ghi dạng che (`maskLoginIdentifier`).
- Số CCCD của nhân sự ở dịch vụ định danh (L-08):
  - `GET /api/v1/users/:id` trả tên đăng nhập dạng che như danh sách.
  - Thêm `GET /api/v1/users/:id/login-identifier` để xem đủ: chỉ người quản lý được tài khoản đó, mỗi lần xem ghi nhật ký tài khoản `view_login_identifier` (nhật ký chỉ ghi dạng che).
  - Tìm theo từ khóa toàn chữ số chỉ khớp đủ cả tên đăng nhập, không dò được từng chữ số.
  - Cổng quản trị có nút "Xem đủ tên đăng nhập" ở chi tiết tài khoản.
- "Ghi nhớ" (L-04, quyết định của Eric, GD-172):
  - Cổng quản trị: mã làm mới giữ 30 ngày khi tích "Ghi nhớ"; `PORTAL_REMEMBER_DAYS` chỉ hạ được, không quá 30 (trước cho tới 90).
  - Cổng vận hành nền tảng: phiên tối đa 8 giờ như cũ, "Ghi nhớ" chỉ nhớ tên đăng nhập trên trình duyệt.
  - Sửa BM-05 (`22`) và BR-121 (`07`): mã xác nhận áp dụng cổng quản trị, ứng dụng giáo viên, ứng dụng học sinh, cổng vận hành.
- Kiểm thử:
  - CT-16c-3 sửa: kênh giáo viên đòi mã sau 3 lần sai; sai ở cổng rồi sang kênh giáo viên vẫn phải nhập mã.
  - CT-1527: chi tiết che số CCCD, xem đủ có nhật ký, người không quản lý bị 403, tìm một phần chữ số không ra.
  - CT-1528: trần 30 ngày của "Ghi nhớ", phiên vận hành 8 giờ.

#### Quyết định

- Eric chốt ngày 2026-10-29 (GD-172): tài khoản trường giữ phiên 30 ngày khi chọn "Ghi nhớ"; tài khoản vận hành nền tảng tối đa 8 giờ, "Ghi nhớ" không kéo dài.
- Eric duyệt ngày 2026-10-29 sửa L-05, L-07, L-08 theo rà soát quy trình (tài liệu 35, PR 250).
- Quyền xem đủ số CCCD của nhân sự là quyền quản lý được tài khoản đó (cùng điều kiện của xem chi tiết); không thêm mã quyền mới. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Giữ biến `PORTAL_REMEMBER_DAYS` để bản triển khai hạ được thời hạn, trần 30 ngày.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-353, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Ứng dụng phụ huynh chưa có mã xác nhận ở đăng nhập bằng mật khẩu (tài khoản phụ huynh theo số CCCD); lần sai vẫn được đếm chung theo tên đăng nhập. Đã làm ở YCTD-354.

## 24 Yêu cầu thay đổi

### YCTD-353: Mã xác nhận ở ứng dụng giáo viên, che số định danh trong nhật ký và chi tiết tài khoản, giới hạn "Ghi nhớ" – 2026-10-29

- Lý do: Rà soát quy trình ngày 2026-10-28 (tài liệu 35 mục 6, L-04, L-05, L-07, L-08) và quyết định "Ghi nhớ" của Eric.
- Nội dung thay đổi:
  - Mã xác nhận ở kênh giáo viên.
  - Che số định danh học sinh trong nhật ký và thông báo lỗi.
  - Chi tiết tài khoản che số CCCD; xem đủ có nhật ký; tìm theo chữ số chỉ khớp đủ.
  - "Ghi nhớ" tối đa 30 ngày ở cổng quản trị, 8 giờ ở cổng vận hành.
  - Sửa BM-05, BR-121.
- Thành phần bị ảnh hưởng: `apps/identity/src/authentication/authentication.controller.ts`, `authentication.service.ts`, `token.service.ts`, `apps/identity/src/common/configuration.ts`, `apps/identity/src/accounts/accounts.service.ts`, `accounts.controller.ts`, `student-accounts.service.ts`, `apps/api/src/student-records/learning-accounts.ts`, `apps/teacher/src/screens/LoginScreen.tsx`, `apps/teacher/src/session/*`, `apps/portal/src/accounts/AccountsPage.tsx`, `accounts-api.ts`, kiểm thử định danh, `tai_lieu/07_QUY_TAC_NGHIEP_VU.md`, `tai_lieu/22_BAO_MAT.md`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: mã xác nhận ở ứng dụng giáo viên, che số định danh, giới hạn "Ghi nhớ" (YCTD-353).
- Ứng dụng giáo viên hỏi mã xác nhận sau nhiều lần nhập sai mật khẩu.
- Nhật ký không còn ghi đủ số định danh của học sinh; chi tiết tài khoản che số CCCD, xem đủ có ghi nhật ký.
- "Ghi nhớ" ở cổng quản trị giữ phiên tối đa 30 ngày.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Mã xác nhận ở ứng dụng giáo viên, che số định danh, giới hạn "Ghi nhớ" | YCTD-353 |

## Thêm dòng

| 32_KE_HOACH_THEO_HE_THONG_SO.md | GD-112 | GD-172 | Thời hạn "Ghi nhớ" | **Eric đã chốt 2026-10-29:** tài khoản trường tích "Ghi nhớ" thì giữ phiên 30 ngày (cấu hình chỉ hạ được); tài khoản vận hành nền tảng tối đa 8 giờ, "Ghi nhớ" không kéo dài phiên | Không | Eric (đã chốt) |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-451 | Che số định danh (YCTD-353, bổ sung YCTD-311): nhật ký cấp tài khoản học và thi, nhật ký đồng bộ tài khoản học sinh và thông báo lỗi chỉ ghi số định danh dạng che; chi tiết tài khoản trả tên đăng nhập dạng che, xem đủ số CCCD phải gọi riêng, chỉ người quản lý được tài khoản đó, mỗi lần xem ghi nhật ký; tìm tài khoản theo từ khóa toàn chữ số chỉ khớp đủ cả tên đăng nhập |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1116 | Cho tài khoản cán bộ / Khi nhập sai mật khẩu 3 lần ở ứng dụng giáo viên, hoặc sai 2 lần ở cổng quản trị rồi 1 lần ở ứng dụng giáo viên, rồi đăng nhập đúng / Thì phải nhập mã xác nhận; có mã đúng thì vào được (CT-16c-3; YCTD-353) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1117 | Cho tài khoản tạo theo số CCCD / Khi xem chi tiết, xem đủ tên đăng nhập, người không quản lý xem đủ, tìm theo 8 chữ số đầu, tìm đủ 12 số / Thì dạng che, đủ số và một dòng nhật ký không chứa số đủ, 403, không ra, ra (CT-1527; YCTD-353) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1118 | Cho cấu hình "Ghi nhớ" / Khi để trống, đặt 90, đặt 7 ngày; phiên vận hành / Thì 30 ngày, 30 ngày, 7 ngày; 8 giờ (CT-1528; YCTD-353) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1527 | P01-06 | Tài khoản theo số CCCD: xem chi tiết, xem đủ tên đăng nhập, người không quản lý xem đủ, tìm 8 chữ số đầu, tìm đủ 12 số | dạng che; đủ số, nhật ký `view_login_identifier` chỉ dạng che; 403; không ra; ra | Kiểm thử tự động `apps/identity/src/accounts/national-id-accounts.test.ts` CT-1527 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1528 | P01-06 | Thời hạn "Ghi nhớ" của cổng quản trị với cấu hình trống, 90, 7, 0 ngày; thời hạn phiên vận hành | 30, 30, 7, 1 ngày; 8 giờ | Kiểm thử tự động `apps/identity/src/authentication/login-security.test.ts` CT-1528 đạt ngày 29/10/2026 | Đạt |
