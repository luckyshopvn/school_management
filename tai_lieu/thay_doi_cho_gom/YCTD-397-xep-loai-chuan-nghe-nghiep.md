---
yctd: YCTD-397
tieu_de: Danh mục chuẩn nghề nghiệp mầm non theo Thông tư 25, 26/2018: tiêu chí trọng yếu, cấu trúc chuẩn hiệu trưởng
ngay: 2026-11-01
phien_ban_de_xuat: 0.260.1
---

## 02 Nhật ký

### 2026-11-01 — Danh mục chuẩn nghề nghiệp mầm non theo Thông tư 25, 26/2018 (YCTD-397)

#### Công việc đã thực hiện

- Đối chiếu bản gốc Thông tư 26/2018 (giáo viên mầm non) và Thông tư 25/2018 (hiệu trưởng mầm non), bản của Bộ đặt trên TEMIS, Điều 4 đến 8 và Điều 10 khoản 2. Cách xếp loại ở `standard-rating.ts` đúng với cả hai chuẩn; lỗi nằm ở danh mục gieo sẵn (L-41).
- Danh mục gieo sẵn ở tệp 0047: tiêu chí trọng yếu theo số tiêu chí (giáo viên 1, 3 đến 9; hiệu trưởng 1, 4, 5, 6, 7, 9, 11, 13, 14, 15) thay cho mọi tiêu chí thuộc tiêu chuẩn 1, 2; chuẩn hiệu trưởng đúng cấu trúc (tiêu chuẩn 2 có 8 tiêu chí, tách quản trị hoạt động nuôi dưỡng, chăm sóc sức khỏe và quản trị hoạt động giáo dục; tiêu chuẩn 5 có 2 tiêu chí, bỏ "Thể hiện khả năng nghệ thuật"); tên tiêu chí theo văn bản.
- Database migration 0246 sửa danh mục của năm học đã gieo theo bản cũ, chỉ khi danh mục của chuẩn còn nguyên bản gieo cũ; giữ dòng và mã tiêu chí, đổi tên, tiêu chuẩn và cờ trọng yếu; không động vào phiếu.
- Kiểm thử CT-2180, CT-2181 (`database/src/professional-standards-seed.test.ts`) hỏng trước khi sửa, đạt sau khi sửa; CT-2182 chạy tệp 0246 trên cơ sở dữ liệu tạo mới.

#### Quyết định

- Eric chọn phương án A ngày 01/11/2026: sửa danh mục, không sửa phiếu đã mở, không tính lại xếp loại phiếu đã chốt.
- Quy tắc dung sai 1/3 của hiệu trưởng phổ thông (Thông tư 14/2018) không áp dụng: phân hệ chỉ dùng chuẩn mầm non.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-397, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Trường có danh mục Hiệu trưởng đã sửa tay: tệp 0246 bỏ qua, Hiệu trưởng tự rà danh mục; chuẩn hiệu trưởng không chèn được tiêu chí vào giữa qua giao diện.
- Phiếu mở trước khi sửa giữ tiêu chí và cờ cũ; phiếu đã chốt giữ xếp loại cũ.

## 24 Yêu cầu thay đổi

### YCTD-397: Danh mục chuẩn nghề nghiệp mầm non theo Thông tư 25, 26/2018 – 2026-11-01

- Lý do: sửa lỗi L-41 (khảo sát TEMIS ngày 31/10/2026) để chạy đúng BR-99 và Điều 10 khoản 2 của Thông tư 25, 26/2018.
- Nội dung thay đổi: tiêu chí trọng yếu và cấu trúc danh mục gieo sẵn theo văn bản; database migration 0246 sửa danh mục còn nguyên bản gieo cũ. API không đổi.
- Thành phần bị ảnh hưởng: `database/school-year/migrations/0047_create_standards_and_groups.ts`, `0246_fix_professional_standards_catalog.ts` (mới), `database/src/professional-standards-seed.test.ts` (mới), chú thích `apps/api/src/professional-standards/standard-rating.ts`, BR-99 ở `07`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-01

- Phạm vi thay đổi: danh mục chuẩn nghề nghiệp mầm non (YCTD-397).
- Tiêu chí trọng yếu khi xếp loại Khá, Tốt đúng theo Thông tư 25, 26/2018; danh mục chuẩn hiệu trưởng đủ 18 tiêu chí đúng tiêu chuẩn.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Danh mục chuẩn nghề nghiệp mầm non theo Thông tư 25, 26/2018 | YCTD-397 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P07 Nhân sự | YCTD-397: danh mục chuẩn nghề nghiệp mầm non theo Thông tư 25, 26/2018 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2180 | P07-05 | Lấy danh mục gieo sẵn của chuẩn giáo viên mầm non | 15 tiêu chí; tiêu chuẩn 2 gồm tiêu chí 3 đến 8; tiêu chí trọng yếu 1, 3, 4, 5, 6, 7, 8, 9 | Kiểm thử tự động `database/src/professional-standards-seed.test.ts` đạt ngày 01/11/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2181 | P07-05 | Lấy danh mục gieo sẵn của chuẩn hiệu trưởng mầm non | 18 tiêu chí; tiêu chuẩn 1 đến 5 gồm 3, 8, 3, 2, 2 tiêu chí; tiêu chí 5, 6 là nuôi dưỡng, giáo dục; tiêu chí trọng yếu 1, 4, 5, 6, 7, 9, 11, 13, 14, 15 | Kiểm thử tự động `database/src/professional-standards-seed.test.ts` đạt ngày 01/11/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2182 | P07-05 | Cơ sở dữ liệu năm học có danh mục gieo cũ; danh mục giáo viên đã sửa tên tiêu chí 1; chạy tệp 0246 hai lần | Danh mục hiệu trưởng giống bản gieo mới, cùng dòng và mã tiêu chí; danh mục giáo viên đã sửa giữ nguyên; lần chạy thứ hai không đổi gì | Kiểm thử tự động `database/src/professional-standards-seed.test.ts` đạt ngày 01/11/2026 | Đạt |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-41 | Danh mục chuẩn nghề nghiệp mầm non gieo sẵn sai tiêu chí trọng yếu (lấy tiêu chuẩn 1, 2) và sai cấu trúc chuẩn hiệu trưởng, nên xếp loại Khá, Tốt xét sai tiêu chí | Khảo sát TEMIS 31/10/2026 | Trái BR-99, Điều 10 khoản 2 Thông tư 25, 26/2018 | Đã sửa ở YCTD-397, CT-2180 đến CT-2182 |
