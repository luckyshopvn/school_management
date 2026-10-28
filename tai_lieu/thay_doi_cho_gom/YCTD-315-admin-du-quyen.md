---
yctd: YCTD-315
tieu_de: Admin đủ quyền ở mọi ứng dụng của trường
ngay: 2026-10-29
phien_ban_de_xuat: 0.191.0
---

## 02 Nhật ký

### 2026-10-29 — Admin đủ quyền ở mọi ứng dụng của trường

#### Công việc đã thực hiện

- Dịch vụ định danh: phiên Admin vào thẳng nhận ở `/auth/me` vai trò tổng hợp có mọi mã quyền của trường ở toàn trường và mọi phân hệ; kiểm lại ở mỗi yêu cầu theo vai trò, trạng thái hiện hành của nhân viên vận hành. Đổi đường liên kết hỗ trợ nhận kênh `portal`, `teacher`, `parent` (kênh học sinh từ chối), nhật ký phiên ghi kèm kênh.
- Ứng dụng giáo viên, phụ huynh: trang `/support-login` (thành phần dùng chung `SupportSignIn` ở `packages/ui`).
- Cổng vận hành: nhóm nút "Ứng dụng của trường" ở mục Phiên hỗ trợ của trang chi tiết trường; `scripts/chay-nhieu-truong.mjs` đặt cổng của hai ứng dụng.
- Phần 315b (Eric phàn nàn không vào được ứng dụng phụ huynh, học sinh): chế độ xem của nhân viên hỗ trợ ở hai ứng dụng: chọn lớp, rồi học sinh, chỉ đọc; kênh học sinh nhận phiên hỗ trợ; điểm cuối `/support-view` và `/student/support-view`; tiêu đề `x-support-view-child` chỉ nhận ở phiên Admin; hồ sơ trang đầu ứng dụng học sinh không chặn theo gói thi trực tuyến; nút "Ứng dụng học sinh" ở cổng vận hành.
- Kiểm thử: CT-1551, CT-1552 ở `apps/identity`; CT-1553 ở `apps/api`.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: quyền đầy đủ là vai trò tổng hợp tính khi đọc, không thêm vai trò vào cơ sở dữ liệu của trường; mã vai trò Hiệu trưởng để lớp phạm vi dữ liệu là toàn trường; mỗi ứng dụng một phiên vào thẳng riêng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-315, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-315: Admin đủ quyền ở mọi ứng dụng của trường – 2026-10-29

- Lý do: Eric yêu cầu ngày 2026-10-29 "cấp quyền cho user admin vào tất cả hệ thống, đảm bảo đầy đủ phân quyền" (thuộc GD-159).
- Nội dung thay đổi: Phiên Admin vào thẳng có mọi mã quyền của trường, mọi phân hệ (phân hệ ngoài gói vẫn chặn theo gói); vào được cổng quản trị, ứng dụng giáo viên bằng đường liên kết một lần của từng ứng dụng; ở ứng dụng phụ huynh, học sinh là chế độ xem của nhân viên hỗ trợ (chọn lớp, học sinh, chỉ đọc), không đăng nhập thành phụ huynh, học sinh cụ thể; mọi thao tác ghi của tài khoản hỗ trợ trong nhật ký phiên hỗ trợ.
- Thành phần bị ảnh hưởng: `database/src/platform-dashboard.ts`, `apps/identity/src/authentication/authentication.service.ts`, `apps/identity/src/platform/support-sessions.ts`, `packages/ui/src/SupportSignIn.tsx`, `apps/teacher/src/main.tsx`, `apps/parent/src/main.tsx`, `apps/parent/src/screens/HomeScreen.tsx`, `apps/parent/src/screens/SupportViewPicker.tsx`, `apps/student/src/main.tsx`, `apps/student/src/StudentApplication.tsx`, `apps/student/src/SupportViewPicker.tsx`, `apps/student/src/student-api.ts`, `apps/api/src/support-view/support-view.controller.ts`, `apps/api/src/common/student-account.ts`, `apps/api/src/authentication/authentication.guard.ts`, `apps/api/src/online-exams/student-exams.controller.ts`, `apps/platform/src/OpenSchoolButton.tsx`, `apps/platform/src/SupportPanel.tsx`, `scripts/chay-nhieu-truong.mjs`, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 16.12.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: quản trị nền tảng đủ quyền ở mọi ứng dụng của nhân viên trường; chế độ xem của nhân viên hỗ trợ ở ứng dụng phụ huynh, học sinh (YCTD-315).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Admin đủ quyền ở mọi ứng dụng của trường | YCTD-315 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1551 | P19-06 | Admin vào thẳng ở cổng quản trị, ứng dụng giáo viên, phụ huynh, học sinh | `/auth/me` có mọi mã quyền đã khai và mọi mã ở bảng permissions của trường, mọi phân hệ; phụ huynh, học sinh phạm vi chỉ đọc; nhật ký của trường ghi kênh | Kiểm thử tự động `apps/identity/src/platform/catalog-open.test.ts` CT-315-1 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1552 | P19-06 | Phiên hỗ trợ theo cho phép của trường | không có quyền đầy đủ (`full_access` false) | Kiểm thử tự động `apps/identity/src/platform/support-sessions.test.ts` CT-S4-2 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1553 | P19-06 | Chế độ xem của nhân viên hỗ trợ ở kênh phụ huynh, học sinh; tài khoản thường thử dùng | chọn được lớp; yêu cầu ghi 403 chỉ đọc; học sinh không có thì 403; tài khoản thường 403; kênh portal không gọi nhóm /student | Kiểm thử tự động `apps/api/src/support-view/support-view.test.ts` CT-315b-1 đạt ngày 29/10/2026 | Đạt |
