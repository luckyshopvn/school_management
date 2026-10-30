---
yctd: YCTD-385
tieu_de: Biểu thống kê Thông tư 25/2024, lát L2: biểu 03.ĐN-THCS và 03.CN-THCS
ngay: 2026-10-30
phien_ban_de_xuat: 0.254.0
---

## 02 Nhật ký

### 2026-10-30 — Biểu thống kê Thông tư 25/2024, lát L2: biểu 03.ĐN-THCS và 03.CN-THCS (YCTD-385)

#### Công việc đã thực hiện

- Database migration hệ thống 0136: nạp 03.ĐN-THCS (167 mã) và 03.CN-THCS (71 mã) chép từ bản gốc Thông tư 25/2024 (`database/system/data/tt25-thcs.ts`, đã so tên chỉ tiêu tự động với bản chép); hai biểu khung THCS cũ đổi tên "(khung cũ)" và ẩn, số đã nhập giữ nguyên.
- Công thức cấp THCS, THPT thêm tuổi, mới tuyển, lưu ban năm trước, dạng khuyết tật, 2 buổi/ngày, học lại hoặc thi lại hè, chuyển đến từ tỉnh khác, đủ điều kiện xét tốt nghiệp; lớp 2 buổi/ngày, lớp ghép, lớp trong trường nhiều cấp; loại trường theo các cấp trường có (nhóm 1.1, 1.2 của phần Trường); nhân viên thiết bị, thí nghiệm.
- Số liệu nền: lớp đầu cấp theo cấp (lớp 1, 6, 10); 2 buổi/ngày lấy từ lớp hoặc hồ sơ học sinh; đủ điều kiện xét tốt nghiệp từ danh sách xét tốt nghiệp.
- Kiểm thử: CT-1920 đến CT-1923 (`apps/api/src/secondary-reports/tt25-thcs.test.ts`) đạt; cùng hồi quy `secondary-reports`, `primary-reports`, `tt25-bieu`, `emis-16j`, `emis-17a` đạt 33/33; hồi quy `secondary-reports` sửa CT-21g-4 (danh sách biểu THCS mới) và ví dụ công thức sai ở CT-21g-1 (`classes.two_sessions` nay hợp lệ ở THCS, THPT).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, phiên điều phối duyệt thay Eric (Eric có thể đổi): trường nhiều cấp đếm cán bộ quản lý, nhân viên và giáo viên chưa phân công lớp ở cấp cao nhất của trường, theo giải thích biểu THCS, THPT ("trường nhiều cấp có cấp cao nhất là ..."); thay quy tắc "cấp thấp nhất" của lát L1.
- Dòng 33 của 03.CN-THCS có mã ở bản in nhưng là dòng nhóm của 34, 35: nhập tay. Học sinh dân tộc học bán trú, nội trú (88, 89): nhập tay vì hồ sơ chưa tách bán trú với nội trú.
- Yêu cầu chuyển từ phiên rea-truong-hcm-2 (biểu Mầm non 01 đủ 217 chỉ tiêu, 08.ĐN-NSNN, 05 GDTX, 06.GDKT) không thuộc lát L2: Mầm non thuộc L10; GDTX thuộc phần (d) chưa duyệt làm; 06.GDKT là biểu Sở lập.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-385, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` MH-312, `17_DAC_TA_API.md`.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-385: Biểu thống kê Thông tư 25/2024, lát L2: biểu 03.ĐN-THCS và 03.CN-THCS – 2026-10-30

- Lý do: lát L2 của YCTD-385 (danh sách lát đã duyệt ngày 2026-10-30).
- Nội dung thay đổi: nạp hai biểu THCS theo Thông tư 25/2024; điều kiện công thức cấp THCS, THPT; loại trường theo cấp; quy tắc đếm đội ngũ trường nhiều cấp theo cấp cao nhất.
- Thành phần bị ảnh hưởng: `database/system/migrations/0136_add_tt25_thcs_forms.ts` (mới), `database/system/data/tt25-thcs.ts` (mới), `packages/shared/src/primary-reports.ts`, `apps/api/src/primary-reports/tt25-facts.ts`, `apps/api/src/secondary-reports/secondary-reports.test.ts`, `apps/api/src/secondary-reports/tt25-thcs.test.ts` (mới); tài liệu 11, 14, 16, 17, 21.
- Dữ liệu bị ảnh hưởng: database migration hệ thống 0136 nạp hai biểu, đổi tên và ẩn hai biểu khung THCS cũ; số đã nhập giữ nguyên.
- API bị ảnh hưởng: `/api/v1/secondary-reports/emis` có thêm hai biểu; không đổi giao kèo.
- Quyền bị ảnh hưởng: không.
- Mức: Vừa. Người phê duyệt: Eric, ngày 2026-10-30 (danh sách lát).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: biểu thống kê Thông tư 25/2024 cấp THCS 03.ĐN-THCS, 03.CN-THCS (YCTD-385 lát L2).
- Quay lui: chạy `down` của database migration hệ thống 0136 (xóa hai biểu, khôi phục tên và hiện hai biểu khung THCS cũ), rồi hoàn tác commit hợp nhất của PR.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Biểu thống kê Thông tư 25/2024 cấp THCS | YCTD-385 |

## Thêm dòng

| 16_CO_SO_DU_LIEU.md | report_forms, report_form_rows (bổ sung YCTD-175) | report_forms, report_form_rows (bổ sung YCTD-385 lát L2) | Biểu THCS theo Thông tư 25/2024 (tệp hệ thống `0136`): `tt25-03-dn-thcs`, `tt25-03-cn-thcs`; hai biểu khung THCS cũ đổi tên "(khung cũ)", `archived` | Không thêm cột |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1280 | Cho biểu 03.ĐN-THCS, 03.CN-THCS / Khi so với bản gốc Thông tư 25/2024 / Thì đủ 167 và 71 mã số, tên chỉ tiêu, đơn vị tính, các phần với bộ cột của từng phần (Bắt buộc; CT-1920, CT-1921; YCTD-385) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1281 | Cho trường có Tiểu học và THCS / Khi mở biểu THCS / Thì phần Trường ghi ở nhóm 1.2 (trường chỉ có THCS ở nhóm 1.1, trường có THPT không tính); học sinh theo tuổi, mới tuyển lớp 6, 2 buổi/ngày, khuyết tật; đội ngũ theo cấp cao nhất; nhân viên thiết bị, thí nghiệm có dòng riêng (Bắt buộc; CT-1920, CT-1922, CT-1923; YCTD-385) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1920 | P17-32 | Loại trường theo cấp; nhân viên thiết bị ở THCS và Tiểu học; điều kiện mới của học sinh, lớp THCS | Loại đúng; thiết bị thí nghiệm ở THCS, nhân viên khác ở Tiểu học; công thức hợp lệ; đếm tốt nghiệp đúng | Kiểm thử đơn vị CT-1920 (`apps/api/src/secondary-reports/tt25-thcs.test.ts`) đạt ngày 30/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1921 | P17-32 | Danh sách biểu THCS; mở biểu THCS ở đường Tiểu học | Có hai biểu Thông tư 25, biểu khung THCS cũ ẩn; 404 | Kiểm thử đơn vị CT-1921 đạt ngày 30/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1922 | P17-32 | Trường tư thục Tiểu học và THCS chuẩn mức 1, lớp 6 hai buổi, lớp 9; học sinh nữ dân tộc 11 tuổi, nam khuyết tật vận động 14 tuổi; giáo viên hạng III, nhân viên thiết bị | Nhóm 1.2 đúng, nhóm 1.1 bằng 0; cột Tư thục bốn cột đội ngũ; tuổi, mới tuyển, 2 buổi, khuyết tật, thiết bị đúng | Kiểm thử đơn vị CT-1922 đạt ngày 30/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1923 | P17-32 | 03.CN-THCS cùng dữ liệu | Loại trường, lớp, quy mô, thiết bị thí nghiệm, dòng cộng đúng; tốt nghiệp chưa xét là 0 | Kiểm thử đơn vị CT-1923 đạt ngày 30/10/2026 | Đạt |
