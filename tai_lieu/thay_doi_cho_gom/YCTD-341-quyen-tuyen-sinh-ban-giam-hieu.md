---
yctd: YCTD-341
tieu_de: Ban Giám hiệu xem và xét duyệt hồ sơ tuyển sinh
ngay: 2026-10-29
phien_ban_de_xuat: 0.221.0
---

## 02 Nhật ký

### 2026-10-29 — Ban Giám hiệu xem và xét duyệt hồ sơ tuyển sinh

#### Công việc đã thực hiện

- Sửa lỗi ở trang `/admissions` trong phần chạy thử của rà soát giao diện ngày 28/10/2026: với Hiệu trưởng (VT-02), `GET /admission-campaigns` trả 403. Ma trận quyền (tài liệu 08 mục 3) ghi VT-02, VT-15 được phê duyệt ("D") ở P16 Tuyển sinh, nhưng migration 0035 chỉ cấp `P16.application.review` cho VT-03; Ban Giám hiệu không có quyền P16 nào.
- Migration định danh `0184_add_admission_review_for_principals`: cấp `P16.application.review` cho VT-02, VT-15. Ban Giám hiệu thấy mục 1. Tuyển sinh, xem đợt và hồ sơ, xét đạt hoặc không đạt; lập đợt, tiếp nhận hồ sơ, tin tuyển sinh vẫn của VT-12, VT-03.
- Lỗi 500 của `GET /account-directory` ghi cùng trang: điểm cuối này thuộc trang 1.4 Danh sách người dùng (`/accounts`), không phải trang tuyển sinh; bộ dò ghi theo trang đang mở nên yêu cầu của trang trước rơi vào `/admissions`. Kiểm thử nhiều trường với tài khoản VT-02 trả 200; đo truy vấn trên cơ sở dữ liệu định danh của bản trên máy (49 nghìn tài khoản) đều dưới 100 ms, nên không phải quá hạn chờ 5 giây. Chưa tái hiện được, chưa sửa mã.
- Kiểm thử: CT-1610 trong `apps/api/src/admissions/admissions.test.ts`.

#### Quyết định

- Ô "D" của VT-02, VT-15 ứng với quyền xét duyệt hồ sơ (`P16.application.review`), quyền phê duyệt duy nhất của P16; không cấp quyền lập đợt hay tiếp nhận. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-341, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lỗi 500 của danh sách người dùng ở bản nhiều trường trên máy: khi chạy lại, đọc nhật ký máy chủ API và dịch vụ định danh theo mã tương quan của phản hồi lỗi.
- Các vai trò "X" (chỉ xem) ở dòng P16 của ma trận (VT-04, VT-05, VT-06, VT-09) chưa có quyền xem tuyển sinh vì P16 chưa có quyền chỉ xem.

## 24 Yêu cầu thay đổi

### YCTD-341: Ban Giám hiệu xem và xét duyệt hồ sơ tuyển sinh – 2026-10-29

- Lý do: Rà soát giao diện ngày 28/10/2026: Hiệu trưởng mở `/admissions` thì `GET /admission-campaigns` trả 403; ma trận quyền ghi Ban Giám hiệu được phê duyệt ở P16 nhưng không được cấp quyền.
- Nội dung thay đổi: cấp `P16.application.review` cho VT-02, VT-15 (migration định danh 0184); tài liệu 08 (PQ-49), 10 (P16-03); ca kiểm thử theo vai trò.
- Thành phần bị ảnh hưởng: `database/identity/migrations/0184_add_admission_review_for_principals.ts`, `apps/api/src/admissions/admissions.test.ts`; tài liệu `08`, `10`, `21`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: Ban Giám hiệu xem và xét duyệt hồ sơ tuyển sinh (YCTD-341).
- Thay đổi cơ sở dữ liệu: migration định danh 0184 cấp `P16.application.review` cho VT-02, VT-15.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Ban Giám hiệu xem và xét duyệt hồ sơ tuyển sinh | YCTD-341 |

## index Số đếm

| Ca kiểm thử khởi đầu | Số lượng | +1 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1610 | P16-03 | Hiệu trưởng, Phó Hiệu trưởng ở tuyển sinh: xem đợt, hồ sơ; lập đợt; tiếp nhận; xét không đạt thiếu lý do và có lý do; giáo viên xem đợt | Xem 200; lập đợt 403; tiếp nhận 403; thiếu lý do 400, có lý do 200 "không đạt"; giáo viên 403 | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` CT-1610 đạt ngày 29/10/2026 | Đạt |
