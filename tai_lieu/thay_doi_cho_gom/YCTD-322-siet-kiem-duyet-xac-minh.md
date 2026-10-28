---
yctd: YCTD-322
tieu_de: Siết kiểm duyệt và xác minh danh tính ở chợ gia sư
ngay: 2026-10-28
phien_ban_de_xuat: 0.198.0
---

## 02 Nhật ký

### 2026-10-28 — Siết kiểm duyệt và xác minh danh tính ở chợ gia sư

#### Công việc đã thực hiện

- Kiểm duyệt (27i, YCTD-259): báo cáo mức nghiêm trọng về gia sư chỉ tạm khóa ngay khi phụ huynh báo đã thực sự học với gia sư, tức có buổi đã nhận tiền hoặc luồng tin nhắn gia sư đã trả lời. Các báo cáo nghiêm trọng khác vào hàng chờ 4 giờ như trước.
- Tạm khóa tự động chỉ ẩn gia sư, chặn đặt buổi, nhắn tin, mở phòng và giữ tiền chưa giải ngân. Việc hủy buổi sắp tới (hoàn đủ) và báo phụ huynh có buổi với gia sư chỉ chạy khi nhân viên nền tảng tạm khóa hoặc quyết định tạm khóa, mỗi lần khóa một lần. Nhân viên bác hoặc cảnh cáo thì gỡ khóa như trước.
- Nhãn mức "Nghiêm trọng" ở form báo cáo đổi thành "Nghiêm trọng (xử lý trong 4 giờ)".
- Xác minh danh tính và đăng nhập OIDC (27g, YCTD-257): lúc bắt đầu, máy chủ đặt cookie httpOnly gắn lượt với trình duyệt. Lúc hoàn tất, cookie phải khớp `state`. Với mục đích xác minh còn phải có phiên của đúng tài khoản đã bắt đầu. Không khớp thì báo lượt đã hết hạn và không ghi kết quả.
- Kiểm thử:
  - CT-27i-3 sửa theo luồng giữ rồi xác nhận;
  - thêm CT-27i-7 cho người báo chưa học với gia sư, luồng chỉ phụ huynh nhắn, buổi giữ chỗ chưa trả tiền, luồng gia sư đã trả lời, bác thì gỡ khóa;
  - thêm CT-27g-6 cho hoàn tất ở trình duyệt khác, phiên của tài khoản khác, chưa đăng nhập, cookie của lượt khác;
  - e2e 198 kiểm hoàn tiền sau quyết định của nhân viên.

#### Quyết định

- Eric duyệt ngày 2026-10-28 theo kết quả rà soát bảo mật các PR ngày 2026-10-28.
- Quan hệ "đã học" không tính luồng chỉ phụ huynh nhắn và buổi giữ chỗ chưa trả tiền, vì người báo tự tạo được. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Không thêm cột: lần báo phụ huynh của mỗi lần khóa nhận ra qua nhật ký kiểm duyệt `tutor.suspend.notify` từ lúc bắt đầu khóa. Cookie chứa chính `state` (vốn đã nằm ở địa chỉ quay về), không cần lưu thêm ở cơ sở dữ liệu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-322, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Trong lúc chờ nhân viên xác nhận, buổi đã trả tiền của gia sư bị tạm khóa không mở phòng được nhưng chưa hủy. Hạn xử lý 4 giờ của mức nghiêm trọng giới hạn khoảng chờ này.

## 24 Yêu cầu thay đổi

### YCTD-322: Siết kiểm duyệt và xác minh danh tính ở chợ gia sư – 2026-10-28

- Lý do: Rà soát bảo mật các thay đổi ngày 2026-10-28. Eric duyệt siết điều kiện tạm khóa tự động của kiểm duyệt (YCTD-259) và gắn lượt xác minh danh tính OIDC với trình duyệt, tài khoản đã bắt đầu (YCTD-257).
- Nội dung thay đổi:
  - Tạm khóa tự động chỉ khi người báo đã học với gia sư.
  - Hủy buổi và báo phụ huynh chờ nhân viên xác nhận.
  - Cookie gắn lượt OIDC; xác minh phải đúng phiên của tài khoản đã bắt đầu.
  - Đổi nhãn mức nghiêm trọng.
  - Thêm và sửa kiểm thử.
- Thành phần bị ảnh hưởng: `apps/api/src/market/market-safety.ts`, `apps/api/src/market/market-identity.ts`, `apps/api/src/market/market-safety.test.ts`, `apps/api/src/market/market-verification.test.ts`, `apps/api/src/tenant-test-support.ts`, `packages/market-client/src/SafetyWidgets.tsx`, `tests/e2e/198-market-safety.spec.ts`, `tai_lieu/32_KE_HOACH_THEO_HE_THONG_SO.md`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: siết kiểm duyệt và xác minh danh tính ở chợ gia sư (YCTD-322).
- Báo cáo nghiêm trọng chỉ tạm khóa ngay gia sư mà người báo đã học; hủy buổi, báo phụ huynh khi nhân viên xác nhận.
- Lượt xác minh danh tính, đăng nhập OIDC của ứng dụng Gia sư gắn với trình duyệt và tài khoản đã bắt đầu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Siết kiểm duyệt và xác minh danh tính ở chợ gia sư | YCTD-322 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-448 | Điều kiện tạm khóa tự động ở chợ (YCTD-322, sửa BR-446): báo cáo nghiêm trọng về gia sư chỉ tạm khóa ngay khi người báo đã học với gia sư (buổi đã nhận tiền hoặc luồng tin nhắn gia sư đã trả lời), các báo cáo khác vào hàng chờ theo hạn; tạm khóa tự động chỉ ẩn, chặn đặt buổi, nhắn tin, mở phòng và giữ tiền; nhân viên tạm khóa hoặc quyết định tạm khóa thì mới hủy buổi sắp tới (hoàn đủ) và báo phụ huynh có buổi, mỗi lần khóa một lần; lượt xác minh danh tính, đăng nhập OIDC chỉ hoàn tất ở trình duyệt đã bắt đầu, xác minh chỉ ghi cho đúng tài khoản đã bắt đầu |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1111 | Cho gia sư có buổi đã trả tiền với phụ huynh / Khi phụ huynh báo mức nghiêm trọng, rồi nhân viên tạm khóa và quyết định tạm khóa / Thì gia sư bị khóa ngay, buổi chưa hủy; sau xác nhận buổi hoàn đủ, phụ huynh khác được báo đúng một lần; phụ huynh chưa học với gia sư (không buổi, luồng chỉ mình nhắn, buổi giữ chỗ chưa trả tiền) báo nghiêm trọng thì chỉ vào hàng chờ 4 giờ, gia sư vẫn hiện; bác thì gỡ khóa (CT-1522; YCTD-322) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1112 | Cho lượt xác minh danh tính OIDC đã bắt đầu / Khi hoàn tất không có cookie của lượt, có cookie nhưng phiên của tài khoản khác, có cookie nhưng chưa đăng nhập, cookie của lượt khác, đúng trình duyệt và tài khoản / Thì 400, 400, 401, 400 và không ghi kết quả cho tài khoản nào; đúng thì xác minh được (CT-1523; YCTD-322) |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1522 | P02-136 | CT-27i-3 (sửa), CT-27i-7: báo cáo nghiêm trọng của phụ huynh đã trả tiền, nhân viên xác nhận, quyết định tạm khóa lần nữa; người lạ, luồng chỉ phụ huynh nhắn, buổi giữ chỗ, luồng gia sư đã trả lời báo nghiêm trọng; bác | khóa ngay, buổi còn trả tiền; hoàn 150 000, báo 1 lần; không báo thêm; không khóa, hàng chờ 4 giờ, vẫn hiện; khóa; gỡ khóa | Đạt; `apps/api/src/market/market-safety.test.ts`, e2e 198; 1111 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1523 | P02-130 | CT-27g-6: hoàn tất OIDC không cookie (có và không có phiên), cookie đúng nhưng phiên tài khoản khác, cookie đúng nhưng chưa đăng nhập, đăng nhập OIDC không cookie, cookie của lượt khác, đúng trình duyệt và tài khoản | 400, 400, không xác minh; 400; 401; 400; 400; đã xác minh | Đạt; `apps/api/src/market/market-verification.test.ts`; 1112 | Cao |
