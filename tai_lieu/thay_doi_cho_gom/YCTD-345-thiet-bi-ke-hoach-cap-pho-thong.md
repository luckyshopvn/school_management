---
yctd: YCTD-345
tieu_de: Danh mục thiết bị tối thiểu và mẫu kế hoạch giáo dục cho Tiểu học, THCS, THPT (trường tự nhập)
ngay: 2026-10-29
phien_ban_de_xuat: 0.225.0
---

## 02 Nhật ký

### 2026-10-29 — Danh mục thiết bị tối thiểu và mẫu kế hoạch giáo dục cho Tiểu học, THCS, THPT

#### Công việc đã thực hiện

- Rà nguồn dữ liệu mẫu Mầm non: danh mục thiết bị tối thiểu là hằng trong mã (`apps/api/src/facilities/equipment-templates.ts`, mẫu `MN-TT02-2010`, 515 thiết bị, YCTD-143) cộng 56 dòng gieo sẵn của migration năm học 0049; mẫu kế hoạch giáo dục là hằng `EDUCATION_PLAN_DEFAULT_TEMPLATES` (bảy mẫu Mầm non do dự án soạn ở YCTD-147). Không có seed hay migration nào chứa dữ liệu của cấp phổ thông.
- Rà tài liệu yêu cầu (tai_lieu 06, 10, 14, 31, 32, 34 và tài liệu khảo sát 31): chỉ có số văn bản căn cứ cho Tiểu học, THCS, THPT (Thông tư 37, 38, 39/2021/TT-BGDĐT, tài liệu 32 mục 18g) và danh sách loại mẫu kế hoạch cần có (tài liệu 32 mục 22i); không có nội dung danh mục thiết bị hay nội dung mẫu kế hoạch của ba cấp này. Khảo sát hệ thống của Sở (tài liệu 31) chỉ xem cấp Mầm non.
- Thiết bị: cột `age_group` nhận thêm mã khối K1 đến K12 (migration năm học 0215, ràng buộc gắn nhóm với cấp); thiết bị có cấp học khi thêm, sửa, nhập Excel (suy từ nhóm tuổi hoặc khối); lớp của cấp phổ thông áp định mức theo mã khối; đối sánh 2.6 theo cấp đang bật, chỉ lớp của cấp đó; API mới `GET /equipment-minimum/levels` trả nguồn danh mục từng cấp. Cấp chưa bật bị từ chối (422), khối không thuộc cấp, lĩnh vực phát triển ở cấp phổ thông bị từ chối (400).
- Cổng quản trị: 2.1 thẻ Danh mục tối thiểu có ô Cấp học, Nhóm tuổi hoặc Khối, thông báo nguồn danh mục, khối "Thêm thiết bị vào danh mục tối thiểu"; 2.2 thêm ô Cấp học; 2.6 ô Cấp học chỉ có cấp đang bật, cấp chưa có danh mục chuẩn hiện "Chưa có danh mục chuẩn, trường tự nhập" kèm liên kết tới 2.1; 5.6 Thư viện mẫu kế hoạch chỉ có cấp đang bật, cấp phổ thông có nút "Nạp khung rỗng" và thông báo "Chưa có mẫu chuẩn cho cấp học này, trường tự nhập".
- Kế hoạch giáo dục: Tiểu học, THCS, THPT nạp sáu khung rỗng theo các loại mẫu nêu ở tài liệu 32 mục 22i (nhà trường, tổ chuyên môn, dự giờ thao giảng, giáo viên, chủ nhiệm, bài dạy), mỗi khung một mục văn bản trống; tạo, sửa mẫu, nạp mặc định kiểm cấp học đang bật.
- Kiểm thử máy chủ API mới `apps/api/src/facilities/equipment-levels-345.test.ts` (CT-1640 đến CT-1646); sửa `education-plans.test.ts` theo cách kiểm cấp mới.

#### Nguồn dữ liệu đã dùng và phần để trường tự nhập

| Phần | Có nguồn tài liệu | Nguồn | Để trường tự nhập |
|---|---|---|---|
| Danh mục thiết bị tối thiểu Mầm non | Có (giữ nguyên, không đổi) | Mẫu `MN-TT02-2010` của YCTD-143 | Không |
| Văn bản căn cứ danh mục Tiểu học, THCS, THPT (chỉ số văn bản) | Có | Tài liệu 32 mục 18g: Thông tư 37/2021 (TH), 38/2021 (THCS), 39/2021 (THPT) | Không |
| Danh mục thiết bị tối thiểu Tiểu học, THCS, THPT (tên, đơn vị, số lượng) | Không | Không có trong tai_lieu, kể cả tài liệu khảo sát 31 | Có: thêm từng thiết bị ở 2.1 hoặc nhập Excel; không nạp mẫu nào |
| Khối áp định mức K1 đến K12 | Có | Khối mẫu của DT-19 (`GRADE_LEVEL_TEMPLATES`, YCTD-152) | Không |
| Loại mẫu kế hoạch cấp phổ thông (tên sáu khung) | Có | Tài liệu 32 mục 22i: năm học, tổ chuyên môn gồm dự giờ, thao giảng, giáo viên, chủ nhiệm, bài dạy | Không |
| Thư mục lưu kho của khung | Có | Thư mục mặc định cấp phổ thông của kho hồ sơ chuyên môn (`PROFESSIONAL_DEFAULT_FOLDERS`, YCTD-142) | Khung dự giờ, thao giảng không gắn thư mục |
| Mục, cột, chỉ tiêu của mẫu kế hoạch cấp phổ thông | Không | Không có trong tai_lieu | Có: mỗi khung một mục trống, trường sửa mẫu, thêm mục, cột hoặc tự tạo mẫu |

#### Quyết định

- Không nạp danh mục thiết bị hay nội dung mẫu kế hoạch nào cho Tiểu học, THCS, THPT vì tài liệu dự án không có; không chép lại thông tư từ trí nhớ. Chỉ thêm mẫu khi danh mục được đưa vào tài liệu của dự án (theo quy tắc của Eric).
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: định mức cấp phổ thông áp theo khối dùng chung cột `age_group` (mã K1 đến K12), không thêm cột môn học (ghi môn ở ô Loại thiết bị); lĩnh vực phát triển chỉ cho Mầm non; khung kế hoạch cấp phổ thông có loại kế hoạch, kì, luồng duyệt theo mẫu Mầm non cùng loại, không kí nội bộ; cấp chưa bật trả 422 theo quy tắc cấp học `YCTD-152`; đối sánh không gửi cấp lấy cấp đầu tiên đang bật; số migration năm học 0215 để cách xa các PR song song; giữ tiêu đề cột Excel "Nhóm tuổi" (tệp mẫu cũ vẫn nhập được), ghi chú cột nói thêm khối.
- Không làm xuất Excel kế hoạch giáo dục (ngoài phạm vi theo giao việc).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-345, `10_YEU_CAU_CHUC_NANG.md` P09-31, P13-12, `14_DAC_TA_GIAO_DIEN.md` MH-81, MH-205, MH-235, `16_CO_SO_DU_LIEU.md` (equipment_items, migration 0215), `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1640 đến CT-1646, `32_KE_HOACH_THEO_HE_THONG_SO.md` 18g, `34_TONG_HOP_CHUC_NANG_HE_THONG/` 02, 04, 07, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Danh mục thiết bị tối thiểu và mẫu kế hoạch chuẩn của Tiểu học, THCS, THPT cần được đưa vào tài liệu dự án (bản gốc Thông tư 37, 38, 39/2021 và hướng dẫn kế hoạch giáo dục) thì mới thêm mẫu nạp sẵn.
- Khối tự đặt mã khác K1 đến K12 chưa khớp định mức thiết bị (hiện ở cảnh báo lớp chưa xếp được); chưa có cột môn học riêng; kế hoạch giáo dục chưa xuất Excel.

## 24 Yêu cầu thay đổi

### YCTD-345: Danh mục thiết bị tối thiểu và mẫu kế hoạch giáo dục cho Tiểu học, THCS, THPT (trường tự nhập) – 2026-10-29

- Lý do: rà soát giao diện ngày 2026-10-28 (mục 6, mức Cao): `/equipment-minimum`, `/equipment` chỉ có danh mục Mầm non, thiết bị mới luôn cấp Mầm non, trường Tiểu học, THCS, THPT không đối sánh được (MH-205, YCTD-143, P13-12); `/education-plan-templates` chỉ có mẫu Mầm non, cấp khác nạp mặc định báo lỗi (MH-235, YCTD-147). Eric yêu cầu chỉ đưa vào dữ liệu tài liệu dự án thực sự có, chỗ không có thì để trường tự nhập và giao diện nói rõ.
- Nội dung thay đổi: thiết bị có cấp học; cấp phổ thông áp định mức theo khối K1 đến K12; thêm, sửa, nhập Excel, đối sánh theo cấp đang bật; nguồn danh mục từng cấp (`GET /equipment-minimum/levels`); giao diện 2.1, 2.2, 2.6 ghi "Chưa có danh mục chuẩn, trường tự nhập" và cho thêm thiết bị theo cấp, khối; mẫu kế hoạch Tiểu học, THCS, THPT là sáu khung rỗng, giao diện 5.6 ghi "Chưa có mẫu chuẩn cho cấp học này, trường tự nhập"; kiểm cấp học đang bật ở thiết bị và mẫu kế hoạch.
- Thành phần bị ảnh hưởng: `packages/shared/src/facilities.ts`, `packages/shared/src/education-plans.ts`, `database/school-year/migrations/0215_add_equipment_grade_groups.ts`, `apps/api/src/facilities/equipment.ts`, `equipment-minimum.ts`, `equipment-report-calc.ts`, `equipment-templates.ts`, `facilities-data.ts`, `facility-imports.ts`, `apps/api/src/education-plans/education-plans.ts`, `apps/portal/src/facilities/EquipmentPage.tsx`, `EquipmentMinimumPage.tsx`, `equipment-18g-api.ts`, `facilities-api.ts`, `apps/portal/src/education-plans/EducationPlanPages.tsx`, `education-plan-api.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: migration năm học 0215 thay ràng buộc `equipment_items_age_group_check` (không đổi dữ liệu); API mới `GET /api/v1/equipment-minimum/levels` (quyền `P13.equipment.manage` hoặc `P17.report.facilities`); `equipment-items` nhận, trả `school_level`; `POST /education-plan-templates/defaults` trả thêm `kind`; không thêm quyền.
- Ảnh hưởng chức năng cũ: trường chỉ có Mầm non giữ như cũ; nạp mặc định cấp chưa bật trả 422 `YCTD-152` (trước là 422 `YCTD-147` "chưa có mẫu"); báo cáo EMIS không đổi (nhóm tuổi của lớp giữ nghĩa cũ).
- Kiểm thử cần thực hiện: kiểm kiểu gói dùng chung, máy chủ API, cổng quản trị; kiểm thử máy chủ API `equipment-levels-345.test.ts`, `equipment-18g.test.ts`, `facilities-so.test.ts`, `facilities.test.ts`, `education-plans.test.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: danh mục thiết bị tối thiểu và mẫu kế hoạch giáo dục cho Tiểu học, THCS, THPT theo hướng trường tự nhập (YCTD-345).
- Chức năng mới: thiết bị theo cấp học, định mức cấp phổ thông theo khối; thêm thiết bị vào danh mục tối thiểu trên 2.1; nguồn danh mục từng cấp ở 2.6; khung rỗng mẫu kế hoạch cho ba cấp phổ thông.
- Cơ sở dữ liệu: năm học 0215 (ràng buộc nhóm tuổi, khối theo cấp).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Danh mục thiết bị tối thiểu và mẫu kế hoạch giáo dục cho Tiểu học, THCS, THPT (trường tự nhập) | YCTD-345 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1640 | P13-12 | Trường liên cấp Mầm non, Tiểu học: xem nguồn danh mục; đối sánh Tiểu học khi chưa có danh mục; tự thêm hai thiết bị khối 1, khối 2 (một không gửi cấp); nhập số hiện có; xuất Excel | Tiểu học `standard` false, căn cứ Thông tư 37/2021, ghi "trường tự nhập"; thiết bị lưu cấp TH; định mức 4 (hai lớp khối 1) Chưa có rồi Đủ; khối 2 không áp dụng; đối sánh Mầm non không lẫn lớp Tiểu học | Kiểm thử tự động `apps/api/src/facilities/equipment-levels-345.test.ts` CT-1640 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1641 | P13-12 | Thêm thiết bị cấp TH với nhóm tuổi Mầm non; khối 3 kèm lĩnh vực phát triển; cấp "DH"; khối K13; đối sánh cấp "DH"; đổi cấp thiết bị khối 4 sang MN; đổi sang khối 5 | 400 ở các ca sai; đổi khối trong cùng cấp 200 | Kiểm thử tự động `apps/api/src/facilities/equipment-levels-345.test.ts` CT-1641 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1642 | P13-12, P09-31 | Cấp không thuộc trường (THCS, THPT chưa bật): thêm thiết bị khối 10, đối sánh THCS, nạp mặc định THPT, tạo mẫu kế hoạch THCS | 422 quy tắc YCTD-152 | Kiểm thử tự động `apps/api/src/facilities/equipment-levels-345.test.ts` CT-1642 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1643 | P09-31, P09-32 | Trường có Tiểu học nạp mẫu mặc định Tiểu học hai lần; tự tạo mẫu kế hoạch Tiểu học; giáo viên lập kế hoạch theo mẫu đó | sáu khung `kind` frame, lần hai bỏ qua sáu; mỗi khung một mục trống ghi chưa có mẫu chuẩn; khung giáo viên nối thư mục "Kế hoạch giáo dục của giáo viên"; mẫu tự tạo 201, kế hoạch 201 | Kiểm thử tự động `apps/api/src/facilities/equipment-levels-345.test.ts` CT-1643 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1644 | P09-31 | Nạp mặc định cấp "DH"; tạo mẫu mã có dấu cách, tên trống, không có mục | 400, lỗi ở `code`, `name`, `sections` | Kiểm thử tự động `apps/api/src/facilities/equipment-levels-345.test.ts` CT-1644 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1645 | P13-12, P09-31 | Giáo viên thêm thiết bị, xem nguồn danh mục, đối sánh, nạp và tạo mẫu kế hoạch; quản lý một đơn vị thêm thiết bị | 403 ở mọi ca | Kiểm thử tự động `apps/api/src/facilities/equipment-levels-345.test.ts` CT-1645 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1646 | P13-12 | Hàm thuần: cấp của khối K1, K9, K12, K13; nguồn danh mục bốn cấp; nhóm áp định mức của lớp; nhập Excel khối 1, K10 khi chưa bật THPT, khối 2 kèm lĩnh vực, K99 | khối đúng cấp; chỉ Mầm non có danh mục chuẩn; dòng khối 1 nhận cấp TH, ba dòng còn lại lỗi | Kiểm thử tự động `apps/api/src/facilities/equipment-levels-345.test.ts` CT-1646 đạt ngày 29/10/2026 | Đạt |
