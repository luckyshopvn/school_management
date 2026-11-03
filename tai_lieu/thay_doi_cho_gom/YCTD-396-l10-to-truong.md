---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L10: tổ trưởng chuyên môn xem minh chứng của giáo viên trong tổ
ngay: 2026-11-03
phien_ban_de_xuat: 0.271.0
---

## 02 Nhật ký

### 2026-11-03 — Kho minh chứng dùng chung, lát L10 (YCTD-396)

#### Công việc đã thực hiện

- Minh chứng ở bộ của cá nhân xem được bởi người đánh giá trực tiếp (Q-396-11 A):
  - người có quyền đánh giá chuẩn nghề nghiệp giáo viên hoặc quản lý chuẩn (P07-05) ở đơn vị của cán bộ, cùng phạm vi xem phiếu đánh giá chuẩn;
  - tổ trưởng chuyên môn được giao quyền đánh giá ở tổ của mình thấy giáo viên trong tổ.
- Ô "Người được đánh giá" ở danh sách, độ phủ, xuất danh mục hiện cho người đánh giá trực tiếp với các cán bộ trong phạm vi (trước chỉ người quản lý kho).
- Người đánh giá trực tiếp chỉ xem; thêm minh chứng cho người khác vẫn chỉ người quản lý kho; nút Thêm minh chứng ẩn khi đang xem của người khác.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: dùng phạm vi quyền đánh giá chuẩn của P07-05 thay vì danh sách tổ riêng (phân hệ chưa có bảng tổ chuyên môn với tổ trưởng); đoàn đánh giá ngoài không có phạm vi này.
- Lát này dùng mã BR-558 (cấp theo số tiếp theo trên `main`).

#### Thay đổi

- Xem các tài liệu sau:
  - `24_YEU_CAU_THAY_DOI.md` YCTD-396;
  - `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN};
  - `07_QUY_TAC_NGHIEP_VU.md` BR-558;
  - `11_TIEU_CHI_NGHIEM_THU.md` AC-1455;
  - `17_DAC_TA_API.md` mục 17.17;
  - `21_KICH_BAN_KIEM_THU.md` CT-2161, CT-2162.

#### Vấn đề tồn đọng

- Lát L11, L12 chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L10: tổ trưởng xem minh chứng – 2026-11-03

- Lý do: việc tiếp theo Eric đồng ý ngày 2026-11-03 (qua điều phối); Q-396-11 A.
- Nội dung thay đổi: người đánh giá chuẩn trong phạm vi xem minh chứng cá nhân của cán bộ trong phạm vi; ô người được đánh giá cho họ.
- Thành phần bị ảnh hưởng:
  - `apps/api/src/quality-assurance/`: `evidence-store.ts`, `evidence-store.controller.ts`;
  - `apps/portal/src/quality-assurance/`: `EvidenceCoveragePages.tsx`, `EvidencePages.tsx`, `evidence-api.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng:
  - không đổi cấu trúc dữ liệu;
  - điểm cuối mới `GET /quality/evidences/people`;
  - `subject_user_id` ở danh sách, độ phủ, xuất nhận cán bộ trong phạm vi đánh giá chuẩn;
  - không thêm quyền.
- Ảnh hưởng chức năng cũ: người có quyền đánh giá chuẩn xem thêm được minh chứng cá nhân của cán bộ trong phạm vi.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/evidence-store.test.ts`; e2e 243 đến 252, spec mới 253.
- Mức: Vừa (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-11-03 (qua điều phối).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: tổ trưởng chuyên môn, người đánh giá chuẩn xem minh chứng cá nhân của cán bộ trong phạm vi (YCTD-396 lát L10).
- Database migration: không có.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L10 | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L10 (tổ trưởng chuyên môn, người đánh giá chuẩn xem minh chứng cá nhân của cán bộ trong phạm vi) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-558 | Người đánh giá trực tiếp xem minh chứng cá nhân (YCTD-396 lát L10, Q-396-11 A): người có quyền đánh giá chuẩn nghề nghiệp giáo viên hoặc quản lý chuẩn ở đơn vị của cán bộ (phạm vi xem phiếu P07-05) xem danh sách, chi tiết, độ phủ, danh mục minh chứng ở bộ của cá nhân của cán bộ đó; không thêm thay; tệp theo quyền xem nguồn; ngoài phạm vi 403 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1455 | Cho người đánh giá chuẩn ở một tổ và giáo viên trong tổ có minh chứng 3.k / Khi người đánh giá xem / Thì ô người được đánh giá chỉ có giáo viên trong tổ; xem danh sách, chi tiết, độ phủ của giáo viên đó được; xem của giáo viên ngoài tổ, thêm thay bị 403; giáo viên trong tổ không xem được của nhau; giao diện chọn giáo viên thấy minh chứng (CT-2161, CT-2162; YCTD-396 lát L10) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2161 | P09-43 | CT-396-31: tổ thử có người đánh giá (VT-03) và giáo viên có minh chứng 3.k bộ hạng II; người đánh giá xem danh sách cán bộ, danh sách minh chứng, chi tiết, độ phủ; xem giáo viên ngoài tổ; thêm thay; giáo viên xem danh sách cán bộ | Một cán bộ; 200, 1 minh chứng; 200; 1 tiêu chí đủ; 403; 403; rỗng | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2162 | P09-43 | CT-396-32 (giao diện): giáo viên thêm minh chứng vào bộ giáo viên mầm non; người đánh giá của đơn vị chọn giáo viên ở ô Người được đánh giá | Lưới hiện minh chứng của giáo viên | Kiểm thử giao diện `tests/e2e/253-to-truong-xem-minh-chung.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L10 | Kho minh chứng dùng chung, lát L10: tổ trưởng xem minh chứng | {PHIEN_BAN} | P09-43, P07-05 | AC-1455 | CT-2161, CT-2162 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/evidence-store.ts` | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
