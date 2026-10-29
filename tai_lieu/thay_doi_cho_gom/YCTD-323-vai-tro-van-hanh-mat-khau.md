---
yctd: YCTD-323
tieu_de: Vai trò nhân viên vận hành theo từng điểm cuối, đổi mật khẩu vận hành, mã xác nhận khi đổi mật khẩu mặc định
ngay: 2026-10-29
phien_ban_de_xuat: 0.199.0
---

## 02 Nhật ký

### 2026-10-29 — Vai trò vận hành theo từng điểm cuối, đổi mật khẩu vận hành, mã xác nhận khi đổi mật khẩu mặc định

#### Công việc đã thực hiện

- Bảng quyền vận hành dùng chung `packages/shared/src/operator-permissions.ts` (`OPERATOR_PERMISSIONS`): mỗi việc của cổng vận hành ghi các vai trò được làm. Việc không ghi thì chỉ quản trị làm được; gọi xác thực người vận hành mà không truyền vai trò cũng chỉ cho quản trị.
  - Mọi vai trò: xem tổng quan, trường, danh mục, đơn vị cấp trên, gói, thông báo bảo trì, phiên hỗ trợ, tổng quan chợ.
  - Hỗ trợ: cấp lại liên kết kích hoạt, mở phiên hỗ trợ, duyệt hồ sơ gia sư, kiểm duyệt chợ, xem lỗi máy chủ.
  - Kỹ thuật: khởi tạo trường, tên miền, loại dữ liệu, hồ sơ đồng ý, vùng máy chủ (cùng YCTD-343), thông báo bảo trì, mở phiên hỗ trợ, xem lỗi máy chủ.
  - Kế toán: gói dịch vụ, thu phí, tính năng trả phí của trường, đơn giá và số token AI, thanh toán ở chợ.
  - Chỉ quản trị: tạm ngưng, mở lại, xóa trường; danh mục, trang đăng nhập; đơn vị cấp trên; bộ nối thanh toán; khóa và cấu hình AI; cấu hình và văn bản pháp lý của chợ; chính sách hỗ trợ; nhân viên vận hành.
- Dịch vụ định danh:
  - `PlatformOperatorsService.authorize` kiểm tên miền cổng, mã phiên, tài khoản đang hoạt động, đã đổi mật khẩu tạm, đúng vai trò.
  - Trường, đơn vị cấp trên, danh mục, bảng điều khiển, phiên hỗ trợ, gói, thu phí, AI, nhân viên vận hành gọi kèm danh sách vai trò của việc.
  - Máy chủ API: `MarketContext.operator` nhận vai trò, phần quản trị chợ chia theo cấu hình, duyệt hồ sơ, kiểm duyệt, thanh toán.
- Cổng vận hành:
  - Menu chỉ hiện trang vai trò được làm.
  - Trang Chợ gia sư chỉ hiện phần của vai trò.
- Đổi mật khẩu của nhân viên vận hành (T-P1 của rà soát giao diện):
  - Thêm `POST /api/v1/auth/platform/password`: cần mật khẩu hiện tại và mã xác thực hai lớp; mật khẩu mới theo chính sách, từ 12 ký tự, khác mật khẩu cũ.
  - Ghi nhật ký nền tảng `operator.password-change`, nhập sai mật khẩu hiện tại ghi `operator.password-change-failed`.
  - Nhân viên do quản trị tạo nhận mật khẩu tạm có cờ `must_change_password`. Còn cờ thì mọi điểm cuối của cổng (kể cả phần chợ ở máy chủ API) trả 403, cổng chỉ hiện màn Đổi mật khẩu (MH-546); đổi xong thì bỏ cờ.
  - Nút "Đổi mật khẩu" ở đầu cổng.
- Mật khẩu mặc định chung (YCTD-311, giữ theo quyết định của Eric):
  - Đổi mật khẩu lần đầu khi còn mật khẩu mặc định phải kèm mã gửi tới số điện thoại của tài khoản: `POST /api/v1/auth/change-password/code` gửi mã, `POST /api/v1/auth/change-password` nhận `otp_code`.
  - Mã dùng cấu hình hạn, số lần nhập sai, số lần gửi mỗi giờ của mã đăng nhập phụ huynh.
  - Tài khoản theo số CCCD không có số điện thoại nhận mật khẩu tạm ngẫu nhiên.
  - Hạn mật khẩu mặc định tính theo giờ: `initial_password_lifetime_hours` mặc định 24, từ 1 đến 720, thay `initial_password_lifetime_days`.
  - Migration định danh `0185`: mã một lần có mục đích `initial_password`.
  - Cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh hiện ô mã và nút gửi mã khi máy chủ đòi (thành phần `PhoneCodeField` của `packages/ui`).
- Kiểm thử:
  - CT-1524: đổi mật khẩu mặc định cần mã. CT-1514 sửa: hạn 24 giờ, không số điện thoại thì mật khẩu tạm.
  - CT-1521 thêm phần đổi mật khẩu tạm.
  - CT-1525: mọi điểm cuối vận hành của dịch vụ định danh × 4 vai trò theo bảng quyền.
  - CT-1526: phần quản trị chợ theo vai trò.
  - CT-S4-4: thông báo bảo trì do kỹ thuật tạo, hỗ trợ bị 403.
  - e2e 221: đổi mật khẩu mặc định kèm mã.

#### Quyết định

- Eric duyệt ngày 2026-10-28 theo rà soát bảo mật và rà soát giao diện (T-P1): vai trò theo từng điểm cuối, mặc định chỉ quản trị; giữ mật khẩu mặc định chung, thêm mã xác nhận, hạn 24 giờ; đổi mật khẩu vận hành cần mã hai lớp, từ 12 ký tự, có nhật ký.
- Việc của từng vai trò: Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, theo ghi chú vai trò ở migration nền tảng `0241` và nhóm menu của bản thiết kế cổng vận hành. Loại dữ liệu, hồ sơ đồng ý, vùng máy chủ giữ như YCTD-343 (quản trị, kỹ thuật).
- Bảng quyền đặt ở `packages/shared` để menu của cổng và máy chủ dùng cùng một danh sách; cổng vận hành thêm phụ thuộc `@school-management/shared`.
- Ứng dụng hiện ô mã khi máy chủ báo lỗi ở ô `otp_code`, không thêm trường vào phản hồi đăng nhập.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-323, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Các nút ở trang chi tiết trường (tạm ngưng, tên miền, cấp lại liên kết) chưa ẩn theo vai trò; máy chủ đã chặn và báo rõ lý do.
- Nhân viên vận hành quên mật khẩu vẫn phải nhờ quản trị; chưa có điểm cuối quản trị đặt lại mật khẩu của nhân viên.

## 24 Yêu cầu thay đổi

### YCTD-323: Vai trò nhân viên vận hành theo từng điểm cuối, đổi mật khẩu vận hành, mã xác nhận khi đổi mật khẩu mặc định – 2026-10-29

- Lý do: Rà soát bảo mật ngày 2026-10-28: vai trò vận hành mới kiểm ở vài điểm cuối, mật khẩu mặc định chung đổi lần đầu chỉ cần mật khẩu mặc định. Rà soát giao diện T-P1: nhân viên vận hành không đổi được mật khẩu, mật khẩu tạm không bị bắt đổi.
- Nội dung thay đổi:
  - Bảng quyền vận hành dùng chung; mọi điểm cuối của cổng vận hành và phần quản trị chợ kiểm vai trò, mặc định chỉ quản trị.
  - Menu và trang chợ theo vai trò.
  - Đổi mật khẩu vận hành có mã hai lớp và nhật ký; bắt đổi mật khẩu tạm.
  - Mã xác nhận gửi tới số điện thoại khi đổi mật khẩu mặc định lần đầu; không số điện thoại thì mật khẩu tạm ngẫu nhiên; hạn mật khẩu mặc định 24 giờ.
- Thành phần bị ảnh hưởng: `packages/shared/src/operator-permissions.ts`, `apps/identity/src/platform/*`, `apps/identity/src/authentication/initial-password-code.service.ts`, `authentication.service.ts`, `authentication.controller.ts`, `apps/identity/src/accounts/accounts.service.ts`, `apps/identity/src/settings/identity-settings.service.ts`, `apps/identity/src/tenancy-route-policy.ts`, `database/identity/migrations/0185_add_initial_password_code_purpose.ts`, `apps/api/src/market/market-context.ts` và phần quản trị chợ, `apps/platform/src/Application.tsx`, `OperatorPasswordPage.tsx`, `MarketPage.tsx`, `platform-api.ts`, `packages/ui/src/PhoneCodeField.tsx`, màn đổi mật khẩu của `apps/portal`, `apps/teacher`, `apps/parent`, kiểm thử định danh, chợ, e2e 221.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: vai trò vận hành theo từng điểm cuối, đổi mật khẩu vận hành, mã xác nhận khi đổi mật khẩu mặc định (YCTD-323).
- Cổng vận hành chỉ cho mỗi vai trò đúng việc của mình; nhân viên tự đổi mật khẩu, bắt đổi mật khẩu tạm.
- Đổi mật khẩu mặc định lần đầu cần mã gửi tới số điện thoại; mật khẩu mặc định hết hạn sau 24 giờ.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Vai trò vận hành theo từng điểm cuối, đổi mật khẩu vận hành, mã xác nhận khi đổi mật khẩu mặc định | YCTD-323 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-449 | Vai trò nhân viên vận hành (YCTD-323): mỗi điểm cuối của cổng vận hành và phần quản trị chợ chỉ cho các vai trò ghi ở bảng `OPERATOR_PERMISSIONS`, việc không ghi chỉ quản trị làm; hỗ trợ: hỗ trợ trường, phiên hỗ trợ, duyệt hồ sơ gia sư, kiểm duyệt chợ; kỹ thuật: khởi tạo trường, tên miền, loại dữ liệu, bảo trì, phiên hỗ trợ; kế toán: gói, thu phí, tính năng trả phí, đơn giá AI, thanh toán ở chợ; nhân viên còn mật khẩu tạm chỉ đổi được mật khẩu; đổi mật khẩu vận hành cần mật khẩu hiện tại và mã hai lớp, từ 12 ký tự, ghi nhật ký |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-450 | Mật khẩu mặc định theo số CCCD (YCTD-323, bổ sung YCTD-311): chỉ cấp cho tài khoản có số điện thoại, không có thì mật khẩu tạm ngẫu nhiên; hết hạn sau 24 giờ (cấu hình 1 đến 720 giờ); đổi lần đầu phải nhập mã gửi tới số điện thoại của tài khoản, hạn và số lần nhập sai, số lần gửi mỗi giờ theo cấu hình mã một lần |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1113 | Cho tài khoản theo số CCCD còn mật khẩu mặc định / Khi đổi mật khẩu không có mã, gửi mã, nhập sai mã, nhập đúng mã, gửi mã khi đã đổi / Thì 400 ở ô mã, mã tới đúng số điện thoại và phản hồi chỉ hiện số đã che, 400, đổi được, 409; tạo tài khoản không số điện thoại thì mật khẩu tạm, không hạn mật khẩu mặc định (CT-1524; YCTD-323) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1114 | Cho nhân viên vận hành bốn vai trò / Khi gọi từng điểm cuối của cổng vận hành / Thì vai trò không có trong bảng quyền nhận 403 kèm lời báo vai trò, vai trò có trong bảng không bị chặn; phần chợ: hỗ trợ kiểm duyệt, kế toán xem thanh toán, cấu hình chỉ quản trị (CT-1525, CT-1526; YCTD-323) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1115 | Cho nhân viên do quản trị tạo với mật khẩu tạm / Khi vào trang trường, đổi mật khẩu thiếu mã hai lớp, mật khẩu ngắn, sai mật khẩu hiện tại, đủ điều kiện / Thì 403, 401, 400, 400, đổi được và vào được trang của vai trò; nhật ký có lần đổi và lần sai (CT-1521; YCTD-323) |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-546 | Cổng vận hành: Đổi mật khẩu (YCTD-323): mật khẩu hiện tại, mật khẩu mới từ 12 ký tự nhập hai lần, mã xác thực hai lớp; còn mật khẩu tạm thì là màn duy nhất của cổng; nút "Đổi mật khẩu" ở đầu cổng | Người vận hành nền tảng |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1524 | P01-06 | Đổi mật khẩu mặc định lần đầu: không mã, gửi mã, sai mã, đúng mã; gửi mã sau khi đã đổi | 400 ở ô mã; mã tới đúng số, phản hồi che số; 400; đổi được; 409 | Kiểm thử tự động `apps/identity/src/accounts/national-id-accounts.test.ts` CT-1524 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1525 | P19-06 | Mọi điểm cuối vận hành của dịch vụ định danh với bốn vai trò | đúng bảng quyền: không có vai trò thì 403 kèm lời báo vai trò | Kiểm thử tự động `apps/identity/src/platform/platform-operator-admin.test.ts` CT-1525 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1526 | P19-06 | Phần quản trị chợ với hỗ trợ và kế toán: tổng quan, kiểm duyệt, thanh toán, cấu hình | tổng quan 200; hỗ trợ kiểm duyệt 200, thanh toán 403; kế toán thanh toán 200, kiểm duyệt 403; cấu hình 403 | Kiểm thử tự động `apps/api/src/market/market-safety.test.ts` CT-1526 | Đạt |
