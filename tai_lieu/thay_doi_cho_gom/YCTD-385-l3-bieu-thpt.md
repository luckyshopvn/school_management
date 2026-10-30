---
yctd: YCTD-385
tieu_de: Biểu thống kê Thông tư 25/2024, lát L3: biểu 04.ĐN-THPT và 04.CN-THPT
ngay: 2026-10-30
phien_ban_de_xuat: 0.255.0
---

## 02 Nhật ký

### 2026-10-30 — Biểu thống kê Thông tư 25/2024, lát L3: biểu 04.ĐN-THPT và 04.CN-THPT (YCTD-385)

#### Công việc đã thực hiện

- Database migration hệ thống 0142: nạp 04.ĐN-THPT (168 mã) và 04.CN-THPT (70 mã) chép từ bản gốc Thông tư 25/2024 (`database/system/data/tt25-thpt.ts`, đã so tên chỉ tiêu tự động với bản chép); hai biểu khung THPT cũ đổi tên "(khung cũ)" và ẩn, số đã nhập giữ nguyên.
- Phần Trường chia ba nhóm theo loại trường (THPT; THCS và THPT; Tiểu học, THCS và THPT), dùng điều kiện loại trường của lát L2; dòng tạo từ hàm chung với biểu THCS.
- Kiểm thử: CT-2010 đến CT-2012 (`apps/api/src/secondary-reports/tt25-thpt.test.ts`) đạt; cùng `tt25-thcs`, `secondary-reports`, `tt25-bieu` đạt 18/18; hồi quy `secondary-reports` sửa CT-21g-4 (danh sách biểu THCS, THPT mặc định nay là bốn biểu Thông tư 25/2024, bốn biểu khung cũ lấy bằng `?archived=true`).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, phiên điều phối duyệt thay Eric (Eric có thể đổi): dòng 132 bản in ghi "> 60 tuổi", tính từ 60 tuổi như biểu Tiểu học, THCS; dòng 149 bản in ghi "Kiểm nhiệm", ghi theo nghĩa "Kiêm nhiệm"; dòng 34 giữ chữ "cua" của bản in.
- Nhập tay vì hồ sơ chưa có nguồn: trường chuyên, phổ thông dân tộc nội trú, học sinh dân tộc học nội trú, học sinh được tư vấn hướng nghiệp, thí sinh tự do, miễn thi tốt nghiệp, đối tượng chính sách, phòng bộ môn, kiêm nhiệm, trình độ đào tạo.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-385, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` MH-312, `17_DAC_TA_API.md`.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-385: Biểu thống kê Thông tư 25/2024, lát L3: biểu 04.ĐN-THPT và 04.CN-THPT – 2026-10-30

- Lý do: lát L3 của YCTD-385 (danh sách lát đã duyệt ngày 2026-10-30).
- Nội dung thay đổi: nạp hai biểu THPT theo Thông tư 25/2024; ẩn hai biểu khung THPT cũ.
- Thành phần bị ảnh hưởng: `database/system/migrations/0142_add_tt25_thpt_forms.ts` (mới), `database/system/data/tt25-thpt.ts` (mới), `database/system/data/tt25-thcs.ts` (xuất hàm dựng dòng dùng chung, dữ liệu không đổi), `apps/api/src/secondary-reports/secondary-reports.test.ts`, `apps/api/src/secondary-reports/tt25-thpt.test.ts` (mới); tài liệu 11, 14, 16, 17, 21.
- Dữ liệu bị ảnh hưởng: database migration hệ thống 0142 nạp hai biểu, đổi tên và ẩn hai biểu khung THPT cũ; số đã nhập giữ nguyên.
- API bị ảnh hưởng: `/api/v1/secondary-reports/emis` có thêm hai biểu; không đổi giao kèo.
- Quyền bị ảnh hưởng: không.
- Mức: Vừa. Người phê duyệt: Eric, ngày 2026-10-30 (danh sách lát).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: biểu thống kê Thông tư 25/2024 cấp THPT 04.ĐN-THPT, 04.CN-THPT (YCTD-385 lát L3).
- Quay lui: chạy `down` của database migration hệ thống 0142 (xóa hai biểu, khôi phục tên và hiện hai biểu khung THPT cũ), rồi hoàn tác commit hợp nhất của PR.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Biểu thống kê Thông tư 25/2024 cấp THPT | YCTD-385 |

## Thêm dòng

| 16_CO_SO_DU_LIEU.md | report_forms, report_form_rows (bổ sung YCTD-175) | report_forms, report_form_rows (bổ sung YCTD-385 lát L3) | Biểu THPT theo Thông tư 25/2024 (tệp hệ thống `0142`): `tt25-04-dn-thpt`, `tt25-04-cn-thpt`; hai biểu khung THPT cũ đổi tên "(khung cũ)", `archived` | Không thêm cột |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1360 | Cho biểu 04.ĐN-THPT, 04.CN-THPT / Khi so với bản gốc Thông tư 25/2024 / Thì đủ 168 và 70 mã số, tên chỉ tiêu, đơn vị tính, các phần với bộ cột của từng phần; chỗ nghi lỗi in có ghi chú (Bắt buộc; CT-2010, CT-2011; YCTD-385) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1361 | Cho trường THCS và THPT / Khi mở biểu THPT / Thì phần Trường ghi ở nhóm 1.2 (trường chỉ có THPT ở 1.1, có cả Tiểu học ở 1.3); học sinh theo tuổi, mới tuyển lớp 10, 2 buổi/ngày, khuyết tật; đội ngũ ở cấp cao nhất; biểu khung THPT cũ vẫn mở được theo mã (Bắt buộc; CT-2010, CT-2011, CT-2012; YCTD-385) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-2010 | P17-32 | Loại trường THPT theo cấp; công thức của biểu 04 ở cấp THPT | Loại đúng; công thức hợp lệ; đếm theo cột đúng | Kiểm thử đơn vị CT-2010 (`apps/api/src/secondary-reports/tt25-thpt.test.ts`) đạt ngày 30/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-2011 | P17-32 | Trường công lập THCS và THPT chuẩn mức 2, lớp 10 hai buổi, lớp 12; học sinh nữ dân tộc 15 tuổi, nam khuyết tật vận động 17 tuổi; hiệu trưởng, giáo viên hạng II chưa phân công lớp | Danh sách có biểu mới, khung cũ ẩn; đường Tiểu học 404; nhóm 1.2 đúng, 1.1 và 1.3 bằng 0; tuổi, mới tuyển, 2 buổi, khuyết tật, đội ngũ ở cấp THPT đúng | Kiểm thử đơn vị CT-2011 đạt ngày 30/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-2012 | P17-32 | 04.CN-THPT cùng dữ liệu | Loại trường, lớp, quy mô, đội ngũ đúng; tốt nghiệp chưa xét là 0 | Kiểm thử đơn vị CT-2012 đạt ngày 30/10/2026 | Đạt |
