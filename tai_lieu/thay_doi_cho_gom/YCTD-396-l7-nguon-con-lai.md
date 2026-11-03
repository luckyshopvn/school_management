---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L7: nguồn khen thưởng, biên bản thi đua, kiểm thực ba bước, kiểm kê thiết bị, sức khỏe, rèn luyện
ngay: 2026-11-03
phien_ban_de_xuat: 0.267.0
---

## 02 Nhật ký

### 2026-11-03 — Kho minh chứng dùng chung, lát L7 (YCTD-396)

#### Công việc đã thực hiện

- Bộ đăng ký nguồn có thêm sáu loại bản ghi:
  - quyết định, tờ trình khen thưởng đã ban hành;
  - biên bản họp hội đồng thi đua, khen thưởng đã kết thúc;
  - kiểm thực ba bước của một bếp trong một ngày;
  - biên bản kiểm kê thiết bị đã nộp, đã duyệt hoặc đã chốt;
  - cân đo, sức khỏe của một lớp trong một học kỳ;
  - ghi nhận rèn luyện của một lớp trong một học kỳ.
- Bản chụp lúc gắn:
  - dùng tệp có sẵn của phân hệ nguồn: quyết định khen thưởng, biên bản hội đồng, sổ kiểm thực ba bước, biên bản kiểm kê;
  - dựng bảng PDF cho sức khỏe và rèn luyện;
  - sức khỏe và rèn luyện là bản có tên học sinh, chỉ người có quyền xem nguồn tải được.
- Nút "Dùng làm minh chứng" ở các trang: chi tiết quyết định khen thưởng, danh sách họp hội đồng thi đua, kiểm thực ba bước, chi tiết đợt kiểm kê thiết bị, sức khỏe học sinh.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - mã bản ghi của kiểm thực ba bước là `<đơn vị>:<ngày>` (gộp ba bước của ngày); sức khỏe, rèn luyện là `<lớp>:<học kỳ>`;
  - chụp sổ kiểm thực và biên bản kiểm kê ghi một dòng nhật ký xuất của phân hệ nguồn như khi tải;
  - quyết định khen thưởng không đánh dấu có dữ liệu cá nhân (đã ban hành, công khai trong trường).
- Lát này dùng mã BR-554 (cấp theo số tiếp theo trên `main`).

#### Thay đổi

- Xem các tài liệu sau:
  - `24_YEU_CAU_THAY_DOI.md` YCTD-396;
  - `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN};
  - `07_QUY_TAC_NGHIEP_VU.md` BR-554;
  - `11_TIEU_CHI_NGHIEM_THU.md` AC-1447, AC-1448;
  - `21_KICH_BAN_KIEM_THU.md` CT-2153, CT-2154.

#### Vấn đề tồn đọng

- Ghi nhận rèn luyện chưa có trang trên cổng quản trị nên chưa có nút "Dùng làm minh chứng"; chọn được ở ô nguồn của biểu mẫu thêm minh chứng.
- Kiểm thử tự động mới có kiểm thực ba bước và kiểm kê thiết bị; bốn nguồn còn lại đã kiểm kiểu, chưa có ca riêng.
- Lát L8, L6b chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L7: nguồn còn lại – 2026-11-03

- Lý do: lát L7 của YCTD-396 (mục 5 của bản đặc tả `tai_lieu/ban_mau/yctd-396/DAC_TA.md`, dòng Học sinh và Khác).
- Nội dung thay đổi: sáu loại bản ghi nguồn mới và nút "Dùng làm minh chứng" ở trang nguồn.
- Thành phần bị ảnh hưởng:
  - `apps/api/src/quality-assurance/evidence-sources.ts`;
  - `packages/shared/src/evidence-store.ts`;
  - `apps/portal/src/`: `emulation/EmulationPages.tsx`, `kitchen/FoodInspectionsPage.tsx`, `facilities/EquipmentStocktakesPage.tsx`, `health/StudentHealthPage.tsx`.
- Dữ liệu, API, quyền bị ảnh hưởng:
  - không đổi cấu trúc dữ liệu;
  - `record_type` thêm `emulation_decision`, `emulation_minutes`, `food_inspection`, `equipment_stocktake`, `student_health`, `student_conduct`;
  - không thêm quyền.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/evidence-store.test.ts`; e2e 243 đến 249, spec mới 250.
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-10-31 (danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: nguồn minh chứng khen thưởng, biên bản thi đua, kiểm thực ba bước, kiểm kê thiết bị, sức khỏe, rèn luyện (YCTD-396 lát L7).
- Database migration: không có.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L7 | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L7 (nguồn minh chứng khen thưởng, biên bản hội đồng thi đua, kiểm thực ba bước, kiểm kê thiết bị, sức khỏe, rèn luyện) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-554 | Nguồn minh chứng lát L7 (YCTD-396): quyết định, tờ trình khen thưởng đã ban hành (người quản lý hoặc người quyết định thi đua); biên bản họp hội đồng thi đua đã kết thúc (thành viên hội đồng, người quản lý, người quyết định); kiểm thực ba bước của một bếp một ngày, mã `<đơn vị>:<ngày>` (quyền bếp, thực đơn, báo cáo bếp, kiểm thực trong phạm vi đơn vị); biên bản kiểm kê thiết bị đã nộp, duyệt, chốt (quyền thiết bị trong phạm vi đơn vị); cân đo, sức khỏe và ghi nhận rèn luyện của một lớp một học kỳ, mã `<lớp>:<học kỳ>`, có dữ liệu cá nhân (tải theo quyền xem nguồn); bản chụp dùng tệp của phân hệ nguồn khi có, không thì bảng PDF |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1447 | Cho kiểm thực ba bước đã xác nhận của một bếp hôm nay và đợt kiểm kê thiết bị đã chốt / Khi Hiệu trưởng tìm và gắn làm minh chứng / Thì ô nguồn có "Kiểm thực ba bước … ngày …" và "Biên bản kiểm kê thiết bị KK-THU …"; minh chứng có bản chụp PDF; giáo viên tìm nguồn kiểm thực bị 403; mã bản ghi sai bị 400 (CT-2153; YCTD-396 lát L7) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1448 | Cho đợt kiểm kê thiết bị đã chốt / Khi Hiệu trưởng thêm minh chứng chọn nguồn "Biên bản kiểm kê thiết bị" trên giao diện / Thì ghi được minh chứng có Bản 1 (CT-2154; YCTD-396 lát L7) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2153 | P09-43 | CT-396-23: thêm kiểm thực ba bước bước 1 đã xác nhận hôm nay và đợt kiểm kê KK-THU đã chốt; Hiệu trưởng tìm nguồn, gắn; giáo viên tìm nguồn kiểm thực; gắn mã sai | Có hai nguồn đúng nhãn; 201 kèm tệp PDF; 403; 400 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2154 | P09-43 | CT-396-24 (giao diện): Hiệu trưởng thêm minh chứng, chọn nguồn biên bản kiểm kê thiết bị đã chốt | Thông báo đã ghi mã, chi tiết có Bản 1 | Kiểm thử giao diện `tests/e2e/250-nguon-kiem-ke.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L7 | Kho minh chứng dùng chung, lát L7: nguồn còn lại | {PHIEN_BAN} | P09-43 | AC-1447, AC-1448 | CT-2153, CT-2154 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/evidence-sources.ts` và các tệp khác | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
