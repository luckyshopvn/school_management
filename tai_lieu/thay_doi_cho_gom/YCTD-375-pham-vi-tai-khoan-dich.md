---
yctd: YCTD-375
tieu_de: Dịch vụ định danh kiểm phạm vi đơn vị của tài khoản đích khi cấp lại mật khẩu học sinh và khi chấm dứt hợp đồng
ngay: 2026-10-29
phien_ban_de_xuat: 0.238.1
---

## 02 Nhật ký

### 2026-10-29 — Phạm vi đơn vị của tài khoản đích ở dịch vụ định danh (YCTD-375)

#### Công việc đã thực hiện

- Cấp lại mật khẩu tài khoản học và thi (`student-accounts/sync`) với tên đăng nhập đã có: người gọi phải có quyền quản lý tài khoản ở đơn vị hiện tại của học sinh; chuyển học sinh sang đơn vị khác cần quyền ở cả hai đơn vị.
- Khóa tài khoản khi chấm dứt hợp đồng (`terminate-employment`): chỉ nhận tài khoản có vai trò nhân sự; mọi vai trò nhân sự của tài khoản phải nằm trong phạm vi quản lý nhân sự của người thao tác, không dựa vào đơn vị gửi lên.
- `assertPermissionAtUnit` nhận đơn vị trống (vai trò gán toàn trường): chỉ người có phạm vi toàn trường mới qua.
- Kiểm thử `apps/identity/src/accounts/account-unit-scope.test.ts` (CT-1714, CT-1715) hỏng trước khi sửa, đạt sau khi sửa.

#### Quyết định

- Vai trò không phải nhân sự là VT-14 (phụ huynh) và VT-21 (học sinh); vai trò phụ huynh của một nhân viên không tính vào phạm vi khi khóa do chấm dứt hợp đồng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-375, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-375: Dịch vụ định danh kiểm phạm vi đơn vị của tài khoản đích – 2026-10-29

- Lý do: sửa lỗi L-28, L-29 (rà soát mã ngày 2026-10-29) để chạy đúng PQ-13 và BM-10: thao tác trên tài khoản phải nằm trong phạm vi đơn vị của người thao tác.
- Nội dung thay đổi: cấp lại mật khẩu, mở khóa, chuyển đơn vị tài khoản học và thi kiểm quyền ở đơn vị hiện tại của học sinh; khóa do chấm dứt hợp đồng chỉ áp cho tài khoản có vai trò nhân sự trong phạm vi người thao tác. API không đổi.
- Thành phần bị ảnh hưởng: `apps/identity/src/accounts/student-accounts.service.ts`, `staff-accounts.service.ts`, `permission-scope.ts`; kiểm thử `account-unit-scope.test.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: phạm vi đơn vị của tài khoản đích ở dịch vụ định danh (YCTD-375).
- Cấp lại mật khẩu học sinh và khóa tài khoản khi chấm dứt hợp đồng chỉ làm được trong phạm vi đơn vị của người thao tác.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Phạm vi đơn vị của tài khoản đích ở dịch vụ định danh | YCTD-375 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P01 Nền tảng, đơn vị và phân quyền | YCTD-375: kiểm phạm vi đơn vị của tài khoản đích khi cấp lại mật khẩu học sinh, chấm dứt hợp đồng |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1714 | P02-22 | Người quản lý tài khoản ở đơn vị A cấp lại mật khẩu, chuyển đơn vị cho tài khoản học và thi của học sinh đơn vị B; đơn vị B cấp lại cho học sinh của mình, chuyển sang đơn vị A; người có phạm vi toàn trường chuyển | Đơn vị A bị từ chối, mật khẩu và đơn vị không đổi; đơn vị B cấp lại được, không chuyển được sang A; người toàn trường chuyển được | Kiểm thử tự động `apps/identity/src/accounts/account-unit-scope.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1715 | P07-02 | Nhân sự đơn vị A chấm dứt hợp đồng (khóa tài khoản) của giáo viên đơn vị B, của tài khoản chỉ là phụ huynh, của giáo viên đơn vị A | Giáo viên đơn vị B: từ chối; tài khoản phụ huynh: từ chối vì không có vai trò nhân sự; giáo viên đơn vị A: khóa | Kiểm thử tự động `apps/identity/src/accounts/account-unit-scope.test.ts` đạt ngày 29/10/2026 | Đạt |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-28 | Cấp lại mật khẩu tài khoản học và thi không kiểm đơn vị hiện tại của học sinh | Rà soát mã 29/10/2026 | Thao tác ngoài phạm vi đơn vị (PQ-13, BM-10) | Đã sửa ở YCTD-375, CT-1714 |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-29 | Khóa tài khoản khi chấm dứt hợp đồng không kiểm vai trò và đơn vị của tài khoản đích | Rà soát mã 29/10/2026 | Thao tác ngoài phạm vi đơn vị (PQ-13, BM-10) | Đã sửa ở YCTD-375, CT-1715 |
