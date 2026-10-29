---
yctd: YCTD-371
tieu_de: Ô Chu kỳ thu trong biểu mẫu gói dịch vụ (ĐX-CN-7)
ngay: 2026-10-29
phien_ban_de_xuat: 0.240.1
---

## 02 Nhật ký

### 2026-10-29 — Ô Chu kỳ thu trong biểu mẫu gói dịch vụ (ĐX-CN-7)

#### Công việc đã thực hiện

- Biểu mẫu lập, sửa gói ở trang Gói dịch vụ thêm ô "Chu kỳ thu" (Tháng, Học kỳ, Năm). Trước đây dữ liệu gói có `billing_cycle` nhưng biểu mẫu không có ô, gói mới luôn gửi `monthly`. Bảng gói ghi giá niêm yết kèm chu kỳ.
- Kiểm thử: CT-1705 ở `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt trên máy.

#### Quyết định

- Eric chọn lập phiếu riêng cho ĐX-CN-7 ngày 2026-10-29 (Q6 của YCTD-370). Mức Nhỏ: chỉ giao diện, máy chủ đã nhận `monthly`, `term`, `yearly`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-371, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` MH-323.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-371: Ô Chu kỳ thu trong biểu mẫu gói dịch vụ (ĐX-CN-7) – 2026-10-29

- Lý do: ĐX-CN-7 của YCTD-370; biểu mẫu gói thiếu ô chu kỳ thu dù dữ liệu và máy chủ đã có.
- Nội dung thay đổi: thêm ô chọn Chu kỳ thu (Tháng, Học kỳ, Năm) gửi `billing_cycle`; bảng gói ghi chu kỳ cạnh giá niêm yết.
- Thành phần bị ảnh hưởng: `apps/platform/src/PlansPage.tsx`, `tests/e2e/240-cong-van-hanh-dot-2.spec.ts`, tài liệu 14.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Mức: Nhỏ. Người phê duyệt: Eric, ngày 2026-10-29.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: ô Chu kỳ thu trong biểu mẫu gói dịch vụ (YCTD-371).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Ô Chu kỳ thu trong biểu mẫu gói dịch vụ | YCTD-371 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1705 | P19-06 | Quản trị sửa gói, chọn Chu kỳ thu Học kỳ, lưu | Ô hiện chu kỳ hiện tại; lưu gửi `billing_cycle: term`; bảng gói ghi chu kỳ | Kiểm thử giao diện `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt ngày 29/10/2026 | Đạt |
