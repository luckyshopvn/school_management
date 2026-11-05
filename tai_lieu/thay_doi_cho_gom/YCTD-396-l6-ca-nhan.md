---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L6: minh chứng của cá nhân, bộ chuẩn giáo viên Thông tư 20/2018 và theo hạng Thông tư 30/2026
ngay: 2026-11-03
phien_ban_de_xuat: 0.266.0
---

## 02 Nhật ký

### 2026-11-03 — Kho minh chứng dùng chung, lát L6 (YCTD-396)

#### Công việc đã thực hiện

- Minh chứng có chủ thể là nhà trường hoặc một cán bộ (Q-396-11 A):
  - ở bộ của cá nhân, minh chứng thuộc người được đánh giá (mặc định người thêm; người quản lý kho thêm được cho cán bộ khác);
  - mã duy nhất theo bộ và người được đánh giá, mỗi người một dãy mã (Q-396-12 A);
  - chỉ người đó và người quản lý kho xem; gắn vào bộ của nhà trường thì người xem kho thấy;
  - minh chứng của nhà trường không gắn được vào bộ của cá nhân.
- Bộ mẫu chuẩn giáo viên nạp cùng bộ kiểm định khi chọn cấp Tiểu học, THCS, THPT:
  - "Chuẩn nghề nghiệp giáo viên phổ thông (Thông tư 20/2018)": 5 tiêu chuẩn, 15 tiêu chí, mức Đạt, Khá, Tốt; dùng cho dữ liệu đến hết năm học 2025-2026;
  - chín bộ "Chuẩn nghề nghiệp giáo viên … hạng III, II, I (Thông tư 30/2026)": mỗi cấp học, mỗi hạng một bộ; tiêu chuẩn đạo đức (Điều 6), trình độ đào tạo, bồi dưỡng, năng lực chuyên môn, nghiệp vụ; mỗi yêu cầu a, b, c… là một tiêu chí, đáp ứng hoặc chưa, không xếp loại.
- Danh sách, độ phủ, xuất danh mục của bộ cá nhân: người quản lý kho có ô "Người được đánh giá"; danh mục ghi họ tên người được đánh giá, dùng để nhập lên TEMIS (Q-396-14 A, phương án dự phòng: chưa có mẫu nhập công khai của TEMIS).
- Tổng quan có khung "Hồ sơ minh chứng của tôi": độ phủ các bộ của cá nhân mà người xem đã có minh chứng; tỉ lệ của trường chỉ tính bộ của nhà trường.
- Sửa dòng B ở mục 6 của bản đặc tả theo Thông tư 30/2026.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - mỗi cấp học, mỗi hạng một bộ, mã `GV-<cấp>-H<hạng>-2026`;
  - mã tiêu chí `1.1` đến `1.4` (đạo đức), `2.a`… (trình độ), `3.a`… (năng lực); điểm "hạng II và hạng I" của văn bản nạp cho cả hai hạng;
  - nội dung yêu cầu lấy từ bản Công báo số 256 ngày 29/4/2026 bằng tập lệnh; bộ Thông tư 20/2018 chỉ nạp tên tiêu chí, chưa nạp mô tả từng mức;
  - gói hồ sơ ZIP chỉ cho bộ của nhà trường; không phân công phụ trách ở bộ của cá nhân.
- Lát này dùng mã BR-552, BR-553 (cấp theo số tiếp theo trên `main`).

#### Thay đổi

- Xem các tài liệu sau:
  - `24_YEU_CAU_THAY_DOI.md` YCTD-396;
  - `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN};
  - `07_QUY_TAC_NGHIEP_VU.md` BR-552, BR-553;
  - `11_TIEU_CHI_NGHIEM_THU.md` AC-1443 đến AC-1446;
  - `16_CO_SO_DU_LIEU.md` mục 22f;
  - `17_DAC_TA_API.md` mục 17.17;
  - `21_KICH_BAN_KIEM_THU.md` CT-2151, CT-2152;
  - `tai_lieu/ban_mau/yctd-396/DAC_TA.md` mục 6.

#### Vấn đề tồn đọng

- Chưa làm:
  - mở rộng đánh giá chuẩn nghề nghiệp ở phân hệ Nhân sự (P07-05) để chọn minh chứng từ kho (Q-396-13 A);
  - tổ trưởng chuyên môn xem minh chứng của giáo viên trong tổ;
  - bộ chuẩn hiệu trưởng (Thông tư 14/2018, 25/2018) và bộ giáo viên mầm non (Thông tư 26/2018).
  Đề xuất làm ở lát L6b.
- Chưa có mẫu nhập công khai của TEMIS; danh mục cá nhân là phương án dự phòng của Q-396-14.
- Bộ Thông tư 20/2018 chưa có mô tả mức Đạt, Khá, Tốt của từng tiêu chí; trường nhập từ Excel nếu cần.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L6: minh chứng của cá nhân, bộ chuẩn giáo viên – 2026-11-03

- Lý do: lát L6 của YCTD-396; Q-396-11 đến Q-396-14 (Eric chọn A ngày 2026-11-01), quyết định về Thông tư 30/2026 ngày 2026-10-31.
- Nội dung thay đổi:
  - chủ thể của minh chứng, mã theo người được đánh giá, quyền xem minh chứng của cá nhân;
  - mười bộ mẫu chuẩn giáo viên;
  - ô người được đánh giá ở danh sách, độ phủ, xuất;
  - hồ sơ minh chứng của tôi ở Tổng quan.
- Thành phần bị ảnh hưởng:
  - `database/system/migrations/0146_add_evidence_subject.ts`, `database/system/schema-parts/yctd-396-kho-minh-chung.ts`;
  - `apps/api/src/quality-assurance/`: `evidence-store.ts`, `evidence-store.controller.ts`, `quality-assurance.ts`;
  - `apps/portal/src/quality-assurance/`: `EvidencePages.tsx`, `EvidenceCoveragePages.tsx`, `EvidenceExportPage.tsx`, `evidence-api.ts`;
  - `packages/shared/src/`: `quality-assurance.ts`, `quality-templates/tt20-giao-vien.ts`, `quality-templates/tt30-giao-vien-hang.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng:
  - cột mới `subject_user_id`, `subject_name` ở `evidence_items`, `subject_user_id` ở `evidence_codes`; ràng buộc duy nhất của mã tính cả chủ thể;
  - `GET /quality/evidences`, `/coverage`, `/export` nhận `subject_user_id`; `POST /quality/evidences` nhận `subject_user_id`; `/frameworks` trả `kind`, `subject`; `/overview` trả thêm `personal`;
  - không thêm quyền.
- Ảnh hưởng chức năng cũ: nạp bộ mẫu Tiểu học, THCS, THPT tạo thêm mười bộ của cá nhân; minh chứng có sẵn là của nhà trường, mã không đổi.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/*.test.ts`; e2e 80, 243 đến 248, spec mới 249; database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-10-31 (danh sách lát), 2026-11-01 (Q-396-11 đến Q-396-14).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: minh chứng của cá nhân, bộ chuẩn giáo viên Thông tư 20/2018 và theo hạng Thông tư 30/2026 (YCTD-396 lát L6).
- Database migration: hệ thống `0146_add_evidence_subject`. Quay lui: chạy `down` (xóa mã ở bộ của cá nhân, khôi phục ràng buộc mã cũ, bỏ cột chủ thể).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L6 | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L6 (minh chứng của cá nhân, bộ chuẩn giáo viên Thông tư 20/2018 và theo hạng I, II, III của Thông tư 30/2026) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-552 | Minh chứng của cá nhân (YCTD-396 lát L6, Q-396-11, Q-396-12): ở bộ có đối tượng Cá nhân, minh chứng thuộc người được đánh giá (mặc định người thêm; chỉ người quản lý kho chọn cán bộ khác, phải là cán bộ đang làm việc có tài khoản); mã duy nhất theo bộ và người được đánh giá; chỉ người đó và người quản lý kho xem, tải; đã gắn vào bộ của nhà trường thì người xem kho xem được; minh chứng của nhà trường không gắn vào bộ của cá nhân; gói hồ sơ ZIP chỉ cho bộ của nhà trường |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-553 | Bộ chuẩn giáo viên theo hạng (YCTD-396 lát L6): mỗi cấp học (Tiểu học, THCS, THPT), mỗi hạng (III, II, I) một bộ của cá nhân theo Thông tư 30/2026/TT-BGDĐT; tiêu chuẩn 1 đạo đức (Điều 6), 2 trình độ đào tạo, bồi dưỡng, 3 năng lực chuyên môn, nghiệp vụ; mỗi yêu cầu là một tiêu chí, một mức (đáp ứng), chu kỳ một năm; không xếp loại theo hạng đến khi có hướng dẫn của Bộ. Bộ Thông tư 20/2018 (15 tiêu chí, 3 mức) dùng cho minh chứng đến hết năm học 2025-2026 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1443 | Cho bộ giáo viên tiểu học hạng II / Khi hai giáo viên cùng thêm minh chứng cho yêu cầu 3.k / Thì mỗi người có mã [H3-3.k-01]; Hiệu trưởng thêm cho giáo viên thứ hai được mã [H3-3.k-02]; giáo viên thêm cho người khác bị 403 (CT-2151; YCTD-396 lát L6) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1444 | Cho minh chứng của cá nhân / Khi người khác xem danh sách, chi tiết / Thì chỉ thấy minh chứng của mình, xem của người khác bị 403; Hiệu trưởng xem được; gắn vào bộ kiểm định của trường thì người khác xem được; minh chứng của trường gắn vào bộ cá nhân bị 422 (CT-2151; YCTD-396 lát L6) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1445 | Cho giáo viên có minh chứng Đã đủ ở yêu cầu 3.k / Khi xem độ phủ, Tổng quan, xuất danh mục / Thì độ phủ của mình có 1 tiêu chí đủ; Tổng quan có bộ ở "Hồ sơ minh chứng của tôi", không có trong tỉ lệ của trường; danh mục ghi "Người được đánh giá: …"; tạo gói cho bộ cá nhân bị 422 (CT-2151; YCTD-396 lát L6) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1446 | Cho trường nạp bộ mẫu Tiểu học / Khi giáo viên thêm minh chứng cho yêu cầu 3.k của bộ hạng II trên giao diện / Thì mã [H3-3.k-01], Tổng quan có bộ đó trong hồ sơ của tôi (CT-2152; YCTD-396 lát L6) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2151 | P09-43 | CT-396-21: bộ GV-TH-H2-2026; giáo viên A, B thêm minh chứng 3.k; Hiệu trưởng thêm cho B; A thêm cho B; xem danh sách, chi tiết, độ phủ, Tổng quan, xuất danh mục của B, tạo gói; A gắn minh chứng vào bộ Mầm non; Hiệu trưởng gắn minh chứng của trường vào bộ hạng II | H3-3.k-01 cho cả hai, H3-3.k-02; 403; A thấy 1, B xem của A 403; độ phủ 1; Tổng quan có bộ ở hồ sơ của tôi; danh mục có họ tên; gói 422; B xem được sau khi gắn; 422 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2152 | P09-43 | CT-396-22 (giao diện): Hiệu trưởng nạp bộ mẫu Tiểu học; giáo viên chọn bộ hạng II, thêm minh chứng 3.k, mở Tổng quan | Thông báo đã ghi [H3-3.k-01]; khung Hồ sơ minh chứng của tôi có bộ hạng II | Kiểm thử giao diện `tests/e2e/249-minh-chung-ca-nhan.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L6 | Kho minh chứng dùng chung, lát L6: minh chứng của cá nhân, bộ chuẩn giáo viên | {PHIEN_BAN} | P09-43 | AC-1443 đến AC-1446 | CT-2151, CT-2152 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/evidence-store.ts`, `packages/shared/src/quality-templates/tt30-giao-vien-hang.ts` và các tệp khác | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
