---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L9: mức tự đánh giá chuẩn nghề nghiệp phải có minh chứng ở kho
ngay: 2026-11-03
phien_ban_de_xuat: 0.270.0
---

## 02 Nhật ký

### 2026-11-03 — Kho minh chứng dùng chung, lát L9 (YCTD-396)

#### Công việc đã thực hiện

- Gửi tự đánh giá chuẩn nghề nghiệp (P07-05):
  - tiêu chí chọn mức Đạt, Khá hoặc Tốt phải có ít nhất một minh chứng của người được đánh giá ở bộ tương ứng của kho, trạng thái khác "Chưa có";
  - thiếu thì báo các tiêu chí thiếu và không gửi;
  - chọn Chưa đạt không cần minh chứng.
- Chỉ kiểm khi trường đã nạp bộ chuẩn của cá nhân chép từ danh mục P07-05 (lát L6b); trường chưa nạp thì như trước.
- Phiếu tự đánh giá có dòng nhắc quy tắc cạnh liên kết thêm minh chứng.
- Bản đặc tả thêm các lát L6b, L9 đến L12 (điều phối ngày 2026-11-03, Eric đồng ý).

#### Quyết định

- Căn cứ quy tắc của Công văn 4529/BGDĐT-NGCBQLGD, 4530/BGDĐT-NGCBQLGD (đã đối chiếu ở báo cáo khảo sát TEMIS mục 13.2): mức tự chọn phải có minh chứng.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - minh chứng "Chưa có" không tính;
  - kiểm ở máy chủ khi gửi, không kiểm khi lưu nháp.
- Spec e2e 48 đổi mức tự đánh giá thành Chưa đạt vì chạy sau các spec nạp bộ Mầm non.
- Lát này dùng mã BR-557 (cấp theo số tiếp theo trên `main`).

#### Thay đổi

- Xem các tài liệu sau:
  - `24_YEU_CAU_THAY_DOI.md` YCTD-396;
  - `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN};
  - `07_QUY_TAC_NGHIEP_VU.md` BR-557;
  - `11_TIEU_CHI_NGHIEM_THU.md` AC-1454;
  - `21_KICH_BAN_KIEM_THU.md` CT-2159, CT-2160;
  - `tai_lieu/ban_mau/yctd-396/DAC_TA.md` mục 7.

#### Vấn đề tồn đọng

- Lát L10 đến L12 chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L9: mức tự đánh giá phải có minh chứng – 2026-11-03

- Lý do: việc tiếp theo Eric đồng ý ngày 2026-11-03 (qua điều phối).
- Nội dung thay đổi: chặn gửi tự đánh giá chuẩn nghề nghiệp khi tiêu chí chọn mức từ Đạt trở lên chưa có minh chứng ở kho.
- Thành phần bị ảnh hưởng:
  - `apps/api/src/professional-standards/professional-standards.ts`, `apps/api/src/quality-assurance/personal-evidence.ts`;
  - `apps/portal/src/professional-standards/ProfessionalStandardsPage.tsx`;
  - `tests/e2e/48-standards-groups.spec.ts`, `tests/e2e/252-minh-chung-p07.spec.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không đổi cấu trúc dữ liệu; `POST /professional-evaluations/{id}/submit-self` trả 422 khi thiếu minh chứng; không thêm quyền.
- Ảnh hưởng chức năng cũ: trường đã nạp bộ chuẩn của cá nhân ở kho phải có minh chứng trước khi gửi tự đánh giá mức Đạt trở lên.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/evidence-store.test.ts`, `apps/api/src/professional-standards/standards-groups.test.ts`; e2e 48, 252.
- Mức: Nhỏ (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-11-03 (qua điều phối).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: mức tự đánh giá chuẩn nghề nghiệp phải có minh chứng ở kho (YCTD-396 lát L9).
- Database migration: không có.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L9 | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P07 Nhân sự | YCTD-396 lát L9 (gửi tự đánh giá chuẩn nghề nghiệp: mức từ Đạt trở lên phải có minh chứng ở kho) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-557 | Mức tự đánh giá cần minh chứng (YCTD-396 lát L9; Công văn 4529, 4530/BGDĐT-NGCBQLGD): khi gửi tự đánh giá chuẩn nghề nghiệp, mọi tiêu chí chọn mức Đạt, Khá hoặc Tốt phải có ít nhất một minh chứng của người được đánh giá ở bộ chuẩn của cá nhân tương ứng (BR-556), trạng thái khác "Chưa có"; thiếu thì báo mã các tiêu chí thiếu, không gửi; chỉ áp dụng khi bộ đã nạp |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1454 | Cho giáo viên tự đánh giá tiêu chí 1 mức Khá (có minh chứng Đang thu thập) và tiêu chí 2 mức Đạt (chưa có minh chứng) / Khi gửi tự đánh giá / Thì bị 422 báo tiêu chí 2; đổi tiêu chí 2 thành Chưa đạt thì gửi được; giao diện chọn Khá mọi tiêu chí khi chưa có minh chứng hiện thông báo thiếu minh chứng (CT-2159, CT-2160; YCTD-396 lát L9) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2159 | P07-05 | CT-396-29: phiếu giáo viên mầm non hai tiêu chí (Khá có minh chứng, Đạt chưa có); gửi; đổi tiêu chí 2 thành Chưa đạt; gửi lại | 422 báo tiêu chí 2; 200, trạng thái đã gửi | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2160 | P07-05 | CT-396-30 (giao diện): giáo viên chọn Khá mọi tiêu chí khi chưa có minh chứng, bấm Gửi tự đánh giá | Thông báo "… đã chọn mức từ Đạt trở lên nhưng chưa có minh chứng ở kho" | Kiểm thử giao diện `tests/e2e/252-minh-chung-p07.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L9 | Kho minh chứng dùng chung, lát L9: mức tự đánh giá cần minh chứng | {PHIEN_BAN} | P07-05, P09-43 | AC-1454 | CT-2159, CT-2160 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/professional-standards/professional-standards.ts`, `apps/api/src/quality-assurance/personal-evidence.ts` | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
