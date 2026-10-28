---
yctd: YCTD-342
tieu_de: Xem dữ liệu năm học đã đóng ở cổng quản trị
ngay: 2026-10-28
phien_ban_de_xuat: 0.222.0
---

## 02 Nhật ký

### 2026-10-28 — Xem dữ liệu năm học đã đóng ở cổng quản trị

#### Công việc đã thực hiện

- Sửa lỗi mức Cao số 4 của rà soát giao diện ngày 28/10/2026: ô năm học ở thanh đầu trang liệt kê năm học đã đóng nhưng bấm không làm gì (BC-09 ghi "chưa hỗ trợ xem năm học cũ").
- Máy chủ API: tiêu đề `x-academic-year-id` gắn vào ngữ cảnh của yêu cầu; bộ giải năm học đang dùng (`CurrentSchoolYearResolver`, nơi mọi phân hệ lấy cơ sở dữ liệu năm học) trả cơ sở dữ liệu của năm đã đóng cho yêu cầu đọc, từ chối yêu cầu ghi theo BR-93; mã sai dạng 400, năm không có hoặc còn nháp 404. Bộ chặn đổi lỗi cơ sở dữ liệu chỉ đọc (25006) và thiếu bảng, cột (42703, 42P01) khi đang xem năm cũ thành lỗi nghiệp vụ BR-93 có thông điệp rõ.
- Cổng quản trị: chọn được năm đã đóng ở ô năm học; mọi yêu cầu (kể cả tải tệp) mang mã năm đang xem; đổi năm thì tải lại mọi truy vấn; nút đổi màu cảnh báo, dải "chỉ xem" ở cuối màn hình có nút về năm đang dùng; giữ năm đang xem khi tải lại trang trong cùng thẻ, bỏ khi đăng xuất.
- Kiểm thử: `apps/api/src/academic-years/viewed-year.test.ts` (CT-1620 đến CT-1624).

#### Quyết định

- Chọn năm theo tiêu đề yêu cầu và một chỗ giải năm học chung thay vì thêm tham số năm học cho từng điểm cuối: hơn 1.700 chỗ gọi đi qua bộ giải nên mọi màn đọc được năm cũ mà không sửa từng phân hệ. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Không chạy tệp thay đổi cấu trúc cho năm đã đóng (giữ QU-11): chức năng làm sau ngày đóng năm học báo "Năm học đang xem đóng trước khi có chức năng này…" thay cho lỗi hệ thống. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Năm đang xem giữ trong sessionStorage của thẻ trình duyệt (không phải localStorage) để thẻ khác và lần đăng nhập sau mặc định về năm đang dùng, tránh nhầm năm khi nhập liệu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-342, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Ứng dụng giáo viên, phụ huynh, học sinh chưa có ô chọn năm học; chỉ cổng quản trị xem được năm cũ.
- Màn có nút ghi vẫn hiện nút khi xem năm cũ; bấm thì máy chủ từ chối kèm thông báo. Ẩn nút theo từng màn để làm khi áp thiết kế mới.

## 24 Yêu cầu thay đổi

### YCTD-342: Xem dữ liệu năm học đã đóng ở cổng quản trị – 2026-10-28

- Lý do: Rà soát giao diện ngày 28/10/2026 (mức Cao, số 4): không xem được dữ liệu năm học đã đóng; mục năm cũ trong ô năm học bấm không có tác dụng (BC-09, kế hoạch 32 phần 16c).
- Nội dung thay đổi: tiêu đề `x-academic-year-id` chọn năm học cho yêu cầu ở máy chủ API (đọc năm đã đóng, từ chối ghi theo BR-93); đổi lỗi cơ sở dữ liệu khi xem năm cũ thành lỗi nghiệp vụ; ô năm học chọn được năm đã đóng, dải "chỉ xem" và nút về năm đang dùng.
- Thành phần bị ảnh hưởng: `apps/api/src/common/current-school-year.ts`, `apps/api/src/common/viewed-school-year.ts` (mới), `apps/api/src/create-application.ts`, `apps/api/src/application.module.ts`, `apps/api/src/academic-years/viewed-year.test.ts` (mới); `apps/portal/src/session/viewed-year.ts` (mới), `apps/portal/src/session/api-client.ts`, `apps/portal/src/pages/AcademicYearSwitcher.tsx`; tài liệu `07` (BR-93), `14` (BC-09), `17` (mục 1), `21`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: xem dữ liệu năm học đã đóng ở cổng quản trị (YCTD-342).
- Thay đổi API: mọi điểm cuối của máy chủ API nhận tiêu đề `x-academic-year-id` để đọc năm học đã đóng; ghi kèm năm đã đóng trả 422 BR-93.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Xem dữ liệu năm học đã đóng ở cổng quản trị | YCTD-342 |

## index Số đếm

| Ca kiểm thử khởi đầu | Số lượng | +5 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1620 | P01-02 | Xem năm học đã đóng: danh sách lớp không có tiêu đề, có tiêu đề năm đã đóng, có tiêu đề năm đang dùng | Năm đang dùng không có lớp năm cũ; năm đã đóng trả đúng lớp năm cũ; tiêu đề năm đang dùng ghi được và không đổi năm cũ | Kiểm thử tự động `apps/api/src/academic-years/viewed-year.test.ts` CT-1620 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1621 | P01-02 | Thêm lớp kèm tiêu đề năm học đã đóng | 422 mã quy tắc BR-93 "đã đóng, chỉ xem"; dữ liệu năm cũ không đổi | Kiểm thử tự động `apps/api/src/academic-years/viewed-year.test.ts` CT-1621 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1622 | P01-02 | Tiêu đề năm học sai dạng, mã không có, năm còn nháp | 400; 404; 404 | Kiểm thử tự động `apps/api/src/academic-years/viewed-year.test.ts` CT-1622 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1623 | P01-02 | Xem năm cũ theo vai trò: không mã phiên; giáo viên mở khai báo cơ sở vật chất; Hiệu trưởng mở cùng màn | 401; 403; 200 | Kiểm thử tự động `apps/api/src/academic-years/viewed-year.test.ts` CT-1623 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1624 | P01-02 | Đổi lỗi cơ sở dữ liệu 25006, 42703, 42P01 khi xem năm cũ; lỗi khác giữ nguyên | Ba mã thành lỗi nghiệp vụ BR-93; lỗi khác không đổi | Kiểm thử tự động `apps/api/src/academic-years/viewed-year.test.ts` CT-1624 đạt ngày 28/10/2026 | Đạt |
