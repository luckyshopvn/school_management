---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L6b: bộ chuẩn giáo viên, hiệu trưởng mầm non từ danh mục P07-05, minh chứng ở phiếu đánh giá chuẩn
ngay: 2026-11-03
phien_ban_de_xuat: 0.269.0
---

## 02 Nhật ký

### 2026-11-03 — Kho minh chứng dùng chung, lát L6b (YCTD-396)

#### Công việc đã thực hiện

- Nạp bộ mẫu cấp Mầm non tạo thêm hai bộ của cá nhân, chép từ danh mục chuẩn nghề nghiệp của phân hệ Nhân sự (P07-05, danh mục đã sửa ở YCTD-397):
  - "Chuẩn nghề nghiệp giáo viên mầm non (Thông tư 26/2018)", 15 tiêu chí;
  - "Chuẩn hiệu trưởng cơ sở giáo dục mầm non (Thông tư 25/2018)", 18 tiêu chí;
  - mã tiêu chí như phiếu đánh giá; danh mục chưa có thì không tạo, nạp lại không tạo trùng.
- Phiếu đánh giá chuẩn nghề nghiệp (P07-05) hiện ở từng tiêu chí các minh chứng của người được đánh giá trong bộ tương ứng (mã, tên, trạng thái), hoặc "Chưa có minh chứng ở kho".
- Phiếu tự đánh giá có liên kết "Thêm minh chứng ở kho" mở danh sách minh chứng của bộ đó.
- Danh sách minh chứng mở sẵn bộ ở đường dẫn (`?framework_id=`).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - phiếu chỉ hiện minh chứng (đọc), chưa lưu lựa chọn minh chứng vào phiếu; tệp vẫn theo quyền của kho;
  - người xem phiếu (chính người đó, người đánh giá trong phạm vi) xem được mã, tên, trạng thái minh chứng của người được đánh giá (Q-396-11: người đánh giá trực tiếp xem được).
- Theo điều phối ngày 2026-11-03: dùng danh mục đã sửa ở YCTD-397 làm nguồn, không nạp danh mục khác.
- Lát này dùng mã BR-556 (cấp theo số tiếp theo trên `main`).

#### Thay đổi

- Xem các tài liệu sau:
  - `24_YEU_CAU_THAY_DOI.md` YCTD-396;
  - `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN};
  - `07_QUY_TAC_NGHIEP_VU.md` BR-556;
  - `11_TIEU_CHI_NGHIEM_THU.md` AC-1452, AC-1453;
  - `17_DAC_TA_API.md` mục 17.17;
  - `21_KICH_BAN_KIEM_THU.md` CT-2157, CT-2158.

#### Vấn đề tồn đọng

- Chưa có:
  - kiểm "mức đã chọn phải có minh chứng" khi gửi tự đánh giá;
  - tổ trưởng chuyên môn xem minh chứng của giáo viên trong tổ;
  - bộ chuẩn hiệu trưởng phổ thông (Thông tư 14/2018).
- Sửa danh mục ở P07-05 sau khi đã nạp không cập nhật bộ đã chép; nạp lại bộ (xóa bộ cũ trước) để chép lại.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L6b: bộ chuẩn mầm non từ P07-05 – 2026-11-03

- Lý do: lát L6b của YCTD-396 (phần còn lại của L6); Q-396-13 A (mở rộng P07-05).
- Nội dung thay đổi:
  - hai bộ của cá nhân chép từ danh mục P07-05;
  - minh chứng theo tiêu chí ở phiếu đánh giá chuẩn;
  - liên kết thêm minh chứng.
- Thành phần bị ảnh hưởng:
  - `apps/api/src/quality-assurance/`: `quality-assurance.ts`, `evidence-store.ts`, `evidence-store.controller.ts`;
  - `apps/portal/src/professional-standards/ProfessionalStandardsPage.tsx`;
  - `apps/portal/src/quality-assurance/`: `EvidencePages.tsx`, `evidence-api.ts`;
  - `packages/shared/src/quality-assurance.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng:
  - không đổi cấu trúc dữ liệu;
  - điểm cuối mới `GET /quality/evidences/professional/{evaluationId}`;
  - `POST /quality/frameworks/defaults` cấp Mầm non tạo thêm tối đa hai bộ;
  - không thêm quyền.
- Ảnh hưởng chức năng cũ: phiếu đánh giá chuẩn có thêm dòng minh chứng dưới mỗi tiêu chí khi đã nạp bộ.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/*.test.ts`; e2e 48, 243 đến 251, spec mới 252.
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-11-01 (Q-396-13 A).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: bộ chuẩn giáo viên, hiệu trưởng mầm non chép từ danh mục P07-05, minh chứng ở phiếu đánh giá chuẩn (YCTD-396 lát L6b).
- Database migration: không có.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L6b | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L6b (bộ chuẩn giáo viên, hiệu trưởng mầm non chép từ danh mục P07-05, minh chứng ở phiếu đánh giá chuẩn) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-556 | Bộ chuẩn mầm non từ P07-05 (YCTD-396 lát L6b): nạp bộ mẫu cấp Mầm non chép danh mục chuẩn nghề nghiệp đang có ở phân hệ Nhân sự thành bộ `GV-MN-TT26-2018` (giáo viên) và `HT-MN-TT25-2018` (hiệu trưởng), đối tượng cá nhân, ba mức, chu kỳ một năm, mã tiêu chuẩn bỏ tiền tố "TC", mã tiêu chí giữ nguyên; bộ cùng mã đã có hoặc danh mục trống thì không tạo. Phiếu đánh giá chuẩn hiện minh chứng của người được đánh giá ở bộ tương ứng theo mã tiêu chí cho người xem được phiếu |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1452 | Cho trường Mầm non nạp bộ mẫu / Khi xem danh sách bộ / Thì có bộ giáo viên 15 tiêu chí và bộ hiệu trưởng 18 tiêu chí cùng tên, mã với danh mục P07-05; nạp lại không tạo trùng (CT-2157; YCTD-396 lát L6b) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1453 | Cho giáo viên có minh chứng Đã đủ ở tiêu chí 1 của bộ giáo viên mầm non / Khi giáo viên, Hiệu trưởng xem minh chứng của phiếu đánh giá chuẩn / Thì tiêu chí 1 có [H1-1-01] kèm tên, trạng thái; giáo viên khác bị 403; giao diện phiếu tự đánh giá hiện "Chưa có minh chứng ở kho" và liên kết thêm minh chứng (CT-2157, CT-2158; YCTD-396 lát L6b) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2157 | P09-43 | CT-396-27 và CT-22f-2 (sửa): nạp bộ Mầm non; so bộ GV-MN-TT26-2018 với danh mục P07-05; giáo viên thêm minh chứng tiêu chí 1; Hiệu trưởng, giáo viên, giáo viên khác xem minh chứng của phiếu | Tạo 3 bộ, bộ giáo viên 15, bộ hiệu trưởng 18 tiêu chí, khớp danh mục; [H1-1-01]; 200, 200, 403 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts`, `quality-assurance.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2158 | P09-43 | CT-396-28 (giao diện): Hiệu trưởng nạp bộ Mầm non, mở phiếu cho giáo viên; giáo viên mở phiếu tự đánh giá | Hiện "Chưa có minh chứng ở kho" và liên kết "Thêm minh chứng ở kho" | Kiểm thử giao diện `tests/e2e/252-minh-chung-p07.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L6b | Kho minh chứng dùng chung, lát L6b: bộ chuẩn mầm non từ P07-05 | {PHIEN_BAN} | P09-43, P07-05 | AC-1452, AC-1453 | CT-2157, CT-2158 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/quality-assurance.ts`, `apps/portal/src/professional-standards/ProfessionalStandardsPage.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
