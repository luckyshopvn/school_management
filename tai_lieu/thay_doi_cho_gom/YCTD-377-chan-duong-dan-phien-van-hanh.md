---
yctd: YCTD-377
tieu_de: Lệnh chặn theo đường dẫn so như Express định tuyến; khóa hoặc đổi vai trò người mở phiên hỗ trợ thì phiên kết thúc
ngay: 2026-10-29
phien_ban_de_xuat: 0.238.1
---

## 02 Nhật ký

### 2026-10-29 — Chặn theo đường dẫn và phiên hỗ trợ của người bị khóa (YCTD-377)

#### Công việc đã thực hiện

- Thêm `apps/api/src/common/request-path.ts`: `routingPath` đưa đường dẫn về chữ thường, bỏ "/" cuối, đúng cách Express 5 khớp tuyến; `matchesRoutingPath` so danh sách mẫu trên dạng đó.
- Lệnh chặn kí số, chứng thư số, xuất toàn bộ dữ liệu khi đăng nhập thay (`impersonation.ts`) và trong phiên hỗ trợ (`platform-dashboard.ts`) dùng hàm chung. Phép nhận biết lần tải tệp để ghi vết đăng nhập thay cũng dùng hàm chung.
- Khóa nhân viên vận hành hoặc đổi sang vai trò không được mở phiên hỗ trợ: mọi phiên hỗ trợ đang mở của người đó kết thúc, phiên đăng nhập ở trường bị thu hồi (`platform-operator-admin.ts`, `SupportSessionsService.endForRequester`). Khóa tài khoản cấp trên cũng kết thúc phiên xem chi tiết đang mở (`parent-orgs.ts`).
- `activeSupportSession` (`database/src/platform-dashboard.ts`) không nhận phiên của nhân viên vận hành hoặc tài khoản cấp trên không còn hoạt động.
- Kiểm thử `apps/api/src/impersonation/blocked-paths.test.ts` (CT-1711, CT-1712) và CT-1713 trong `apps/identity/src/platform/support-sessions.test.ts`, `parent-orgs.test.ts` hỏng trước khi sửa, đạt sau khi sửa.

#### Quyết định

- Bỏ mọi dấu "/" cuối (Express chỉ chấp nhận một) để phép so chặt hơn; chữ thường theo `toLowerCase` bao trùm cách so không phân biệt hoa thường của Express. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Đổi giữa các vai trò vẫn được mở phiên hỗ trợ (quan_tri, ho_tro, ky_thuat) thì phiên giữ nguyên.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-377, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-377: Chặn theo đường dẫn như Express định tuyến; phiên hỗ trợ kết thúc khi người mở bị khóa hoặc đổi vai trò – 2026-10-29

- Lý do: sửa lỗi L-25, L-26, L-27 (rà soát mã ngày 2026-10-29) để chạy đúng YCTD-145 (đăng nhập thay không kí số, không xuất toàn bộ dữ liệu), YCTD-197 và YCTD-315 (phiên hỗ trợ).
- Nội dung thay đổi: lệnh chặn theo đường dẫn ở máy chủ API so trên đường dẫn chữ thường, bỏ "/" cuối; khóa hoặc hạ vai trò nhân viên vận hành, khóa tài khoản cấp trên thì phiên hỗ trợ đang mở kết thúc; phiên của người không còn hoạt động không dùng được. API không đổi.
- Thành phần bị ảnh hưởng: `apps/api/src/common/request-path.ts`, `apps/api/src/impersonation/impersonation.ts`, `apps/api/src/platform-dashboard/platform-dashboard.ts`; `apps/identity/src/platform/platform-operator-admin.ts`, `support-sessions.ts`, `parent-orgs.ts`; `database/src/platform-dashboard.ts`; kiểm thử nêu ở trên.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: chặn theo đường dẫn và phiên hỗ trợ của người bị khóa (YCTD-377).
- Đăng nhập thay và phiên hỗ trợ không kí số, không thao tác chứng thư số, không xuất toàn bộ dữ liệu ở mọi cách viết đường dẫn.
- Khóa hoặc đổi vai trò nhân viên vận hành, khóa tài khoản cấp trên thì phiên vào trường đang mở kết thúc.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Chặn theo đường dẫn như Express định tuyến; phiên hỗ trợ kết thúc khi người mở bị khóa | YCTD-377 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P01 Nền tảng, đơn vị và phân quyền | YCTD-377: chặn theo đường dẫn như Express định tuyến, kết thúc phiên hỗ trợ khi khóa hoặc đổi vai trò người mở |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1711 | P01-32 | Trong phiên đăng nhập thay gửi yêu cầu ghi tới kí số, chứng thư số, xuất toàn bộ dữ liệu với đường dẫn chữ hoa, có "/" cuối; gửi yêu cầu ghi tới chức năng khác | Mọi cách viết tới kí số, chứng thư số, xuất toàn bộ dữ liệu bị chặn; chức năng khác chạy bình thường | Kiểm thử tự động `apps/api/src/impersonation/blocked-paths.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1712 | P01-81 | Phiên hỗ trợ toàn quyền gửi yêu cầu tới kí số, chứng thư số, xuất toàn bộ dữ liệu, cho phép hỗ trợ với đường dẫn chữ hoa, có "/" cuối | Bị chặn ở mọi cách viết; chức năng khác chạy bình thường | Kiểm thử tự động `apps/api/src/impersonation/blocked-paths.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1713 | P01-81 | Quản trị nền tảng khóa nhân viên đang có phiên hỗ trợ; hạ nhân viên khác sang Kế toán; đổi nhân viên thứ ba sang Kỹ thuật; khóa tài khoản cấp trên đang có phiên xem chi tiết | Khóa, hạ sang Kế toán, khóa tài khoản cấp trên: phiên kết thúc, phiên đăng nhập ở trường bị từ chối; đổi sang Kỹ thuật: phiên giữ nguyên; nhân viên không còn hoạt động thì phiên không dùng được | Kiểm thử tự động `apps/identity/src/platform/support-sessions.test.ts`, `parent-orgs.test.ts` đạt ngày 29/10/2026 | Đạt |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-25 | Lệnh chặn kí số, chứng thư số, xuất toàn bộ dữ liệu khi đăng nhập thay so đường dẫn khác cách Express định tuyến | Rà soát mã 29/10/2026 | Trái YCTD-145 | Đã sửa ở YCTD-377, CT-1711 |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-26 | Lệnh chặn của phiên hỗ trợ so đường dẫn khác cách Express định tuyến | Rà soát mã 29/10/2026 | Trái YCTD-197, YCTD-315 | Đã sửa ở YCTD-377, CT-1712 |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-27 | Khóa hoặc hạ vai trò nhân viên vận hành, khóa tài khoản cấp trên không kết thúc phiên hỗ trợ đang mở | Rà soát mã 29/10/2026 | Phiên vào trường còn hiệu lực sau khi người mở bị khóa | Đã sửa ở YCTD-377, CT-1713 |
