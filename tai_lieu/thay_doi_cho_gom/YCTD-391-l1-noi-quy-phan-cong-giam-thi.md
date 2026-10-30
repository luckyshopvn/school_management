---
yctd: YCTD-391
tieu_de: Giám thị và rèn luyện từng học sinh, lát L1: nội quy, khu vực, phân công giám thị trực
ngay: 2026-10-30
phien_ban_de_xuat: 0.252.0
---

## 02 Nhật ký

### 2026-10-30 — Giám thị và rèn luyện từng học sinh, lát L1: nội quy, khu vực, phân công giám thị trực (YCTD-391)

#### Công việc đã thực hiện

- Cổng quản trị, trang "Nội quy, phân công giám thị" (menu Quản lý giáo dục, mục 4.10, đường dẫn `/supervision`, MH-660, cấp TH, THCS, THPT): ba thẻ Nội quy (theo cấp; thêm, nạp bộ mặc định, đổi cách báo phụ huynh, gắn hoặc bỏ gắn tiêu chí nề nếp lớp, ngừng, dùng lại), Khu vực (thêm, ngừng, dùng lại; ô "Ai đang trực" tra người trực một khu vực ở một thời điểm), Phân công trực (giám thị, thứ, giờ, khối, khu vực; ngừng, dùng lại).
- Máy chủ API: `apps/api/src/supervision/supervision.ts` (nhóm `/supervision`), `supervision-calc.ts` (bộ nội quy mặc định theo cấp, đổi thời điểm sang giờ Việt Nam, kiểm phân công phủ khu vực). Hàm `SupervisionService.findOnDutySupervisors(zoneId, at?)` trả người đang trực khu vực, cho phiên camera (YCTD-389) gọi khi gửi cảnh báo.
- Database migration: năm học `0232_create_supervision_catalogs` (bảng `school_zones`, `student_rule_items`, `supervision_assignments`); định danh `0186_add_supervision_role_and_permissions` (vai VT-22, quyền `P02.supervision.record`, `P02.supervision.manage`).
- Kiểm thử: `apps/api/src/supervision/supervision.test.ts` (CT-1850 đến CT-1855).

#### Quyết định

- Eric duyệt đề xuất, bản mẫu (màn hình 8) và danh sách lát ngày 2026-10-30; các mặc định Q5 đến Q8 do phiên điều phối duyệt thay Eric theo khuyến nghị, Eric có thể đổi.
- Theo quyết định của Eric: vai mẫu "Giám thị, nề nếp" (VT-22), màn hình giám thị ở ứng dụng giáo viên (lát sau), cấu hình ở cổng quản trị; người ghi nhận là giám thị, giáo viên chủ nhiệm, giáo viên bộ môn; mục nội quy có gắn tiêu chí nề nếp lớp thì ghi nhận từng học sinh ghi thêm điểm cho lớp.
- Claude tự chọn theo ủy quyền:
  - vai VT-22 có phạm vi đơn vị như Bảo vệ, nhận các quyền nền của nhân viên như VT-18 trừ quyền ở cổng đón trẻ, thêm quyền ghi điểm nề nếp lớp; Quản lý đơn vị (VT-03) có quyền ghi nhận như ở nề nếp lớp;
  - khu vực chỉ có tên, mô tả; không có tọa độ (vị trí chính xác là dữ liệu nhạy cảm theo Điều 4 Nghị định 356/2025/NĐ-CP);
  - phân công không chọn khối hoặc khu vực nghĩa là mọi khối, mọi khu vực; giờ theo giờ Việt Nam, khoảng [bắt đầu, kết thúc); không đổi nhân sự của phân công đã có (ngừng rồi tạo mới để giữ lịch sử);
  - mục nội quy chỉ gắn tiêu chí nề nếp cùng cấp, đang dùng, vi phạm gắn tiêu chí trừ điểm, khen gắn tiêu chí cộng điểm; không đổi mã, loại, cấp của mục;
  - bộ nội quy mặc định báo phụ huynh ngay với đánh nhau, hút thuốc; còn lại gộp tin cuối ngày; Tiểu học không có mục hút thuốc;
  - không ai trực thì `findOnDutySupervisors` trả danh sách trống, nơi gọi báo người có quyền quản lý rèn luyện (Ban Giám hiệu).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-391, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `08_VAI_TRO_NGUOI_DUNG.md` VT-22, PQ-192, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md` mục 17.14, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Lát L2 (ghi nhận từng học sinh trên ứng dụng giáo viên) chưa làm.
- Ma trận quyền theo phân hệ ở mục 3 của `08` chưa có cột VT-22; cập nhật khi gom hoặc ở lát L7.

## 24 Yêu cầu thay đổi

### YCTD-391: Ứng dụng giám thị và theo dõi rèn luyện từng học sinh, lát L1: nội quy, khu vực, phân công giám thị trực – 2026-10-30

- Lý do: Eric yêu cầu ngày 2026-10-30 ứng dụng cho giám thị và theo dõi hạnh kiểm, rèn luyện từng học sinh; đề xuất, bản mẫu, danh sách lát được duyệt ngày 2026-10-30.
- Nội dung thay đổi: vai mẫu VT-22 "Giám thị, nề nếp" và hai quyền mới; danh mục nội quy theo cấp, khu vực trong trường, phân công giám thị trực, tra người đang trực; trang 4.10 ở cổng quản trị.
- Thành phần bị ảnh hưởng: `apps/api/src/supervision/`, `apps/api/src/application.module.ts`, `apps/portal/src/supervision/`, `apps/portal/src/router.tsx`, `packages/shared` (mã quyền, menu, quyền của mục, đường dẫn truy cập nhanh), `database/school-year` (bảng mới), `database/identity` (vai, quyền), tài liệu 07, 08, 10, 11, 14, 16, 17, 21, 27.
- Dữ liệu, API, quyền bị ảnh hưởng: bảng năm học `school_zones`, `student_rule_items`, `supervision_assignments`; điểm cuối mới `/supervision/*`; vai mới VT-22, quyền mới `P02.supervision.record` (VT-02, VT-15, VT-03, VT-07, VT-08, VT-22), `P02.supervision.manage` (VT-02, VT-15); không đổi quyền có sẵn.
- Ảnh hưởng chức năng cũ: không; nề nếp, thi đua lớp giữ nguyên, chỉ được đọc tiêu chí để gắn vào mục nội quy.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/supervision/supervision.test.ts`, `apps/api/src/quick-links/menu-permissions.test.ts`, `apps/api/src/boarding/boarding.test.ts` (nề nếp).
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: giám thị và rèn luyện từng học sinh, lát L1: vai mẫu Giám thị, danh mục nội quy, khu vực, phân công giám thị trực (YCTD-391).
- Database migration: năm học `0232_create_supervision_catalogs`, định danh `0186_add_supervision_role_and_permissions`. Quay lui: chạy `down` của hai tệp (xóa ba bảng mới; xóa quyền, vai VT-22 và các gán quyền, gán vai của VT-22 phải gỡ trước).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Giám thị và rèn luyện từng học sinh, lát L1: nội quy, phân công giám thị | YCTD-391 |

## index Số đếm

| 14 | màn hình | +1 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-391 lát L1 (nội quy, khu vực, phân công giám thị trực) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-476 | Danh mục nội quy (YCTD-391): mỗi cấp TH, THCS, THPT có danh mục riêng, mã duy nhất trong cấp; mục là vi phạm hoặc khen, có cách báo phụ huynh (không báo, báo ngay, gộp tin cuối ngày); không đổi mã, loại, cấp của mục đã tạo; mục có thể gắn một tiêu chí nề nếp lớp cùng cấp đang dùng (vi phạm gắn tiêu chí trừ điểm, khen gắn tiêu chí cộng điểm); ghi nhận vi phạm, khen không tự trừ điểm, không tự xếp mức rèn luyện của học sinh |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-477 | Khu vực trong trường (YCTD-391): tên duy nhất, có mô tả; không lưu tọa độ; ghi nhận rèn luyện và cảnh báo camera chỉ ghi khu vực; khu vực ngừng dùng không chọn được khi phân công |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-478 | Phân công giám thị trực (YCTD-391): nhân sự đang làm việc, đã có tài khoản, trong phạm vi đơn vị của người phân công; cấp TH, THCS hoặc THPT; khối của cấp đó và khu vực đang dùng (không chọn là mọi khối, mọi khu vực); ít nhất một thứ trong tuần; giờ bắt đầu trước giờ kết thúc (giờ Việt Nam); ngày hiệu lực tùy chọn; không đổi nhân sự của phân công. Người đang trực khu vực ở thời điểm T là người có phân công đang dùng đúng thứ, T trong [bắt đầu, kết thúc), trong ngày hiệu lực và phủ khu vực; không ai trực thì báo người có quyền quản lý rèn luyện |
| 08_VAI_TRO_NGUOI_DUNG.md | VT-20 | VT-22 | Giám thị, nề nếp | Ứng dụng giáo viên; cổng quản trị (xem) | Đơn vị được gán; ghi nhận vi phạm, khen của học sinh trong phạm vi được phân công trực; ghi điểm nề nếp lớp (YCTD-391). Trường đổi tên hiển thị được (tổng phụ trách Đội, giám thị) |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-191 | PQ-192 | Giám thị và rèn luyện từng học sinh (YCTD-391): `P02.supervision.record` cho VT-02, VT-15, VT-03, VT-07, VT-08, VT-22 đọc danh mục nội quy, khu vực (lát sau: ghi nhận vi phạm, khen trong phạm vi); `P02.supervision.manage` cho VT-02, VT-15 khai danh mục nội quy, khu vực, phân công giám thị trực, tra người đang trực. Vai VT-22 có thêm `P02.view`, `P04.view`, `P09.kpi.participate`, `P13.purchase-request.create`, `P19.view`, `P02.conduct.record` |
| 10_YEU_CAU_CHUC_NANG.md | P02-136 | P02-137 | Danh mục nội quy theo cấp (YCTD-391) | VT-02, VT-15 (`P02.supervision.manage`); đọc: người có `P02.supervision.record` | Mã, tên, loại, cấp, cách báo phụ huynh, tiêu chí nề nếp lớp | Tạo, sửa, ngừng, dùng lại; nạp bộ mặc định theo cấp | Thẻ Nội quy (MH-660) | BR-476 |
| 10_YEU_CAU_CHUC_NANG.md | P02-136 | P02-138 | Khu vực trong trường (YCTD-391) | VT-02, VT-15 (`P02.supervision.manage`) | Tên, mô tả | Tạo, sửa, ngừng, dùng lại | Thẻ Khu vực (MH-660) | BR-477 |
| 10_YEU_CAU_CHUC_NANG.md | P02-136 | P02-139 | Phân công giám thị trực, tra người đang trực (YCTD-391) | VT-02, VT-15 (`P02.supervision.manage`); hàm tra cho cảnh báo camera (YCTD-389) | Nhân sự, cấp, khối, khu vực, thứ, giờ, ngày hiệu lực; khu vực và thời điểm cần tra | Tạo, sửa, ngừng phân công; trả người đang trực | Thẻ Phân công trực, ô Ai đang trực (MH-660) | BR-478 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1240 | Cho Hiệu trưởng / Khi nạp bộ nội quy mặc định THCS rồi nạp lại / Thì có các mục mặc định (có hút thuốc, báo phụ huynh ngay), lần sau không thêm trùng; cấp MN bị từ chối; không đổi được loại của mục (CT-1850, CT-1852; YCTD-391) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1241 | Cho mục nội quy vi phạm THCS / Khi gắn tiêu chí nề nếp lớp / Thì chỉ gắn được tiêu chí trừ điểm cùng cấp; tiêu chí cộng điểm hoặc khác cấp bị từ chối; bỏ gắn được (CT-1853; YCTD-391) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1242 | Cho Hiệu trưởng / Khi thêm, sửa khu vực / Thì lưu đúng, trùng tên bị từ chối; giám thị, giáo viên chủ nhiệm chỉ đọc, không thêm được (CT-1851; YCTD-391) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1243 | Cho Hiệu trưởng / Khi phân công giám thị trực / Thì chỉ chọn được nhân sự đã có tài khoản; khối khác cấp, giờ kết thúc trước giờ bắt đầu, không chọn thứ bị từ chối; sửa giờ giữ các trường còn lại (CT-1854; YCTD-391) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1244 | Cho giám thị trực sân trước thứ hai đến thứ sáu 06:30 đến 11:30 / Khi tra người trực sân trước lúc 07:30 thứ năm / Thì có giám thị đó; khu vực khác, thứ bảy, phân công đã ngừng thì không có ai; giám thị không gọi được điểm tra (CT-1850, CT-1855; YCTD-391) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-660 | Cổng quản trị: Nội quy, phân công giám thị (YCTD-391, `/supervision`, mục 4.10, cấp TH, THCS, THPT): chọn cấp; thẻ Nội quy (bảng mục, đổi báo phụ huynh và tiêu chí nề nếp lớp ngay trên dòng, thêm mục, nạp bộ mặc định, ngừng, dùng lại); thẻ Khu vực (bảng, thêm, ngừng; ô Ai đang trực); thẻ Phân công trực (biểu mẫu giám thị, giờ, thứ, khối, khu vực; bảng phân công, ngừng, dùng lại) | VT-02, VT-15 (`P02.supervision.manage`) |
| 16_CO_SO_DU_LIEU.md | class_log_settings (từ YCTD-171) | school_zones (từ YCTD-391) | Khu vực trong trường (tệp năm học `0232`) | id, name (duy nhất, tối đa 100 ký tự), description, order_no, status (`active`, `inactive`); không có tọa độ |
| 16_CO_SO_DU_LIEU.md | class_log_settings (từ YCTD-171) | student_rule_items (từ YCTD-391) | Danh mục nội quy theo cấp | id, code (duy nhất trong cấp), name, kind (`violation`, `commendation`), school_level (`TH`, `THCS`, `THPT`), parent_notice (`none`, `immediate`, `daily_digest`, mặc định `daily_digest`), class_criterion_id (tiêu chí nề nếp lớp, tùy chọn), order_no, status |
| 16_CO_SO_DU_LIEU.md | class_log_settings (từ YCTD-171) | supervision_assignments (từ YCTD-391) | Phân công giám thị trực | id, staff_id, school_level, grade_levels (mảng mã khối, trống là mọi khối), zone_ids (mảng khu vực, trống là mọi khu vực), weekdays (1 là thứ hai đến 7 là chủ nhật), start_time, end_time (HH:MM giờ Việt Nam, bắt đầu trước kết thúc), from_date, to_date, note, status, updated_by_name |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1850 | P02-139 | CT-391-1: đổi thời điểm UTC sang ngày, thứ, giờ Việt Nam; phân công phủ khu vực theo thứ, giờ biên, ngày hiệu lực; bộ nội quy mặc định theo cấp | 07:30 thứ năm; giờ kết thúc không tính; ngoài ngày hiệu lực không phủ; TH không có hút thuốc | Kiểm thử tự động `apps/api/src/supervision/supervision.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1851 | P02-138 | CT-391-2: Hiệu trưởng thêm, sửa khu vực; trùng tên; giám thị, giáo viên chủ nhiệm đọc và thêm khu vực, xem phân công | Thêm, sửa đạt; trùng 409; đọc 200; thêm và xem phân công 403 | Kiểm thử tự động `supervision.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1852 | P02-137 | CT-391-3: nạp nội quy mặc định THCS hai lần, cấp MN; đổi loại mục; đổi cách báo phụ huynh | Lần đầu có HUT_THUOC, lần sau không thêm; MN 400; đổi loại 400; đổi báo phụ huynh đạt | Kiểm thử tự động `supervision.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1853 | P02-137 | CT-391-4: gắn tiêu chí nề nếp lớp trừ điểm, cộng điểm, khác cấp vào mục vi phạm THCS; bỏ gắn | Trừ điểm cùng cấp đạt; ngược chiều, khác cấp 422 (YCTD-391); bỏ gắn đạt | Kiểm thử tự động `supervision.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1854 | P02-139 | CT-391-5: phân công nhân sự chưa có tài khoản, khối khác cấp, giờ ngược, không chọn thứ; phân công đúng; sửa giờ kết thúc, sửa giờ bắt đầu sau giờ kết thúc | 422, 400, 400, 400; tạo 201; sửa giữ giờ bắt đầu; giờ ngược 400 | Kiểm thử tự động `supervision.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1855 | P02-139 | CT-391-6: tra người trực sân trước 07:30 thứ năm, khu vực khác, thứ bảy, sau khi ngừng phân công; giám thị gọi điểm tra | Có giám thị; còn lại trống; giám thị 403 | Kiểm thử tự động `supervision.test.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-391 | Ứng dụng giám thị và rèn luyện từng học sinh, lát L1: nội quy, khu vực, phân công giám thị trực | {PHIEN_BAN} | P02-137, P02-138, P02-139 | AC-1240 đến AC-1244 | CT-1850 đến CT-1855 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/supervision/supervision.ts`, `apps/portal/src/supervision/SupervisionPage.tsx` | Kiểm thử tự động trên máy ngày 30/10/2026; CI của PR |
