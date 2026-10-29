---
yctd: YCTD-372
tieu_de: Ô tìm trường ở thẻ Gói của từng trường (ĐX-CN-6)
ngay: 2026-10-29
phien_ban_de_xuat: 0.240.2
---

## 02 Nhật ký

### 2026-10-29 — Ô tìm trường ở thẻ Gói của từng trường (ĐX-CN-6)

#### Công việc đã thực hiện

- Thẻ "Gói của từng trường" ở trang Gói dịch vụ thêm ô tìm theo tên hoặc mã trường (như bảng vẽ Gói dịch vụ đã duyệt), lọc trên danh sách đã tải, không gọi máy chủ; không khớp thì hiện khối rỗng.
- Kiểm thử: CT-1706 ở `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt trên máy.

#### Quyết định

- Eric chọn lập phiếu riêng cho ĐX-CN-6 ngày 2026-10-29 (Q6 của YCTD-370). Mức Nhỏ: chỉ giao diện.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-372, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` MH-323.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-372: Ô tìm trường ở thẻ Gói của từng trường (ĐX-CN-6) – 2026-10-29

- Lý do: ĐX-CN-6 của YCTD-370; bảng vẽ Gói dịch vụ đã duyệt có ô tìm trường.
- Nội dung thay đổi: ô tìm theo tên hoặc mã, lọc trên danh sách đã tải.
- Thành phần bị ảnh hưởng: `apps/platform/src/PlansPage.tsx`, `tests/e2e/240-cong-van-hanh-dot-2.spec.ts`, tài liệu 14.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Mức: Nhỏ. Người phê duyệt: Eric, ngày 2026-10-29.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: ô tìm trường ở thẻ Gói của từng trường (YCTD-372).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Ô tìm trường ở thẻ Gói của từng trường | YCTD-372 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1706 | P19-06 | Hỗ trợ mở thẻ Gói của từng trường, gõ "HOA", rồi từ không khớp | Bảng chỉ còn trường khớp tên hoặc mã (không phân biệt hoa thường); không khớp hiện khối rỗng | Kiểm thử giao diện `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt ngày 29/10/2026 | Đạt |
