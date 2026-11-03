---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L11: bộ chuẩn hiệu trưởng cơ sở giáo dục phổ thông (Thông tư 14/2018)
ngay: 2026-11-03
phien_ban_de_xuat: 0.272.0
---

## 02 Nhật ký

### 2026-11-03 — Kho minh chứng dùng chung, lát L11 (YCTD-396)

#### Công việc đã thực hiện

- Bộ mẫu "Chuẩn hiệu trưởng cơ sở giáo dục phổ thông (Thông tư 14/2018)" (`HT-PT-TT14-2018`):
  - bộ của cá nhân; năm tiêu chuẩn, mười tám tiêu chí; mức Đạt, Khá, Tốt;
  - nạp cùng bộ kiểm định khi chọn cấp Tiểu học, THCS, THPT.
- Tên tiêu chuẩn, tiêu chí đối chiếu biểu mẫu tự đánh giá của Công văn 4529/BGDĐT-NGCBQLGD ngày 01/10/2018 (bản đăng lại đã đọc đủ ở báo cáo khảo sát TEMIS mục 13).

#### Quyết định

- Theo điều phối ngày 2026-11-03 (Eric đồng ý): đọc nguồn gốc trước khi nạp; toàn văn Thông tư 14/2018 chưa tải được (các liên kết trả trang trống), dùng biểu mẫu của Công văn 4529 hướng dẫn chính Thông tư đó.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - chưa nạp mô tả từng mức và ví dụ minh chứng (bản chữ của biểu mẫu chia cột, không tách đúng được); trường nhập từ Excel nếu cần;
  - tiêu chí quan trọng và dung sai 1/3 khi xếp loại ghi trong chú thích của bộ, không xếp loại ở kho (xếp loại thuộc phân hệ đánh giá chuẩn).
- Lát này dùng mã BR-559 (cấp theo số tiếp theo trên `main`).

#### Thay đổi

- Xem các tài liệu sau:
  - `24_YEU_CAU_THAY_DOI.md` YCTD-396;
  - `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN};
  - `07_QUY_TAC_NGHIEP_VU.md` BR-559;
  - `11_TIEU_CHI_NGHIEM_THU.md` AC-1456;
  - `21_KICH_BAN_KIEM_THU.md` CT-2163.

#### Vấn đề tồn đọng

- Chưa đối chiếu với toàn văn Thông tư 14/2018 trên cổng văn bản của Chính phủ.
- Lát L12 chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L11: chuẩn hiệu trưởng phổ thông – 2026-11-03

- Lý do: việc tiếp theo Eric đồng ý ngày 2026-11-03 (qua điều phối); dòng A mục 6 của bản đặc tả.
- Nội dung thay đổi: bộ mẫu chuẩn hiệu trưởng cơ sở giáo dục phổ thông, bộ của cá nhân, nạp cùng bộ mẫu phổ thông.
- Thành phần bị ảnh hưởng: `packages/shared/src/quality-templates/tt14-hieu-truong.ts`, `packages/shared/src/quality-assurance.ts`; `tests/e2e/246-bo-tieu-chi-mau.spec.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không đổi cấu trúc dữ liệu; nạp bộ mẫu Tiểu học, THCS, THPT tạo thêm một bộ; không thêm quyền.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/evidence-store.test.ts`; e2e 246.
- Mức: Nhỏ (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-11-03 (qua điều phối).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: bộ mẫu chuẩn hiệu trưởng cơ sở giáo dục phổ thông theo Thông tư 14/2018 (YCTD-396 lát L11).
- Database migration: không có.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L11 | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L11 (bộ mẫu chuẩn hiệu trưởng cơ sở giáo dục phổ thông, Thông tư 14/2018) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-559 | Bộ chuẩn hiệu trưởng phổ thông (YCTD-396 lát L11): bộ của cá nhân `HT-PT-TT14-2018` theo Thông tư 14/2018/TT-BGDĐT, năm tiêu chuẩn (phẩm chất nghề nghiệp; quản trị nhà trường; xây dựng môi trường giáo dục; phát triển mối quan hệ nhà trường, gia đình, xã hội; sử dụng ngoại ngữ và công nghệ thông tin), mười tám tiêu chí đánh số 1 đến 18, ba mức Đạt, Khá, Tốt, chu kỳ một năm; nạp cùng bộ mẫu Tiểu học, THCS, THPT |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1456 | Cho trường chưa có bộ / Khi nạp bộ mẫu Tiểu học / Thì tạo 6 bộ, trong đó chuẩn hiệu trưởng phổ thông 18 tiêu chí; lưới bộ tiêu chuẩn hiện tên bộ (CT-2163, CT-2146 sửa; YCTD-396 lát L11) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2163 | P09-40 | CT-396-15 (sửa): nạp bộ mẫu Tiểu học; CT-396-16 (sửa, giao diện): lưới bộ tiêu chuẩn sau khi nạp | Tạo 6 bộ, HT-PT-TT14-2018 có 18 tiêu chí; lưới có "Chuẩn hiệu trưởng cơ sở giáo dục phổ thông (Thông tư 14/2018)" | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts`; giao diện `tests/e2e/246-bo-tieu-chi-mau.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L11 | Kho minh chứng dùng chung, lát L11: chuẩn hiệu trưởng phổ thông | {PHIEN_BAN} | P09-40, P09-43 | AC-1456 | CT-2163 | PR, commit merge ghi khi gom; tệp mã: `packages/shared/src/quality-templates/tt14-hieu-truong.ts` | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
