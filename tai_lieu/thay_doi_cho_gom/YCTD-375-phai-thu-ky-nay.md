---
yctd: YCTD-375
tieu_de: Ô Phải thu kỳ này, Đã thu ở trang Thu phí (ĐX-CN-2)
ngay: 2026-10-29
phien_ban_de_xuat: 0.240.5
---

## 02 Nhật ký

### 2026-10-29 — Ô Phải thu kỳ này, Đã thu ở trang Thu phí (ĐX-CN-2)

#### Công việc đã thực hiện

- Trang Thu phí thêm hai ô "Phải thu kỳ này" và "Đã thu" (theo bảng vẽ Thu phí đã duyệt), tính trên giao diện từ danh sách hóa đơn đang có (`GET billing/invoices`), không thêm API.
- Kiểm thử: CT-1708 ở `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt trên máy.

#### Quyết định

- Eric chọn phương án (a) ngày 2026-10-29: "kỳ này" là các hóa đơn chưa hủy có kỳ (`period_start` đến `period_end`) chứa ngày hôm nay, theo kỳ thu của từng trường; "Phải thu kỳ này" là tổng tiền các hóa đơn đó; "Đã thu" là số tiền đã trả của chính các hóa đơn đó. Chỉ sửa giao diện.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-375, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` MH-328.

#### Vấn đề tồn đọng

- Máy chủ chỉ trả 200 hóa đơn mới nhất (`listInvoices`). Khi danh sách chạm 200 hóa đơn, ô ghi "tính trên 200 hóa đơn mới nhất, có thể thiếu". Muốn số đủ khi có hơn 200 hóa đơn thì cần thêm tổng hợp ở `GET billing` (phiếu riêng, cần đổi API).

## 24 Yêu cầu thay đổi

### YCTD-375: Ô Phải thu kỳ này, Đã thu ở trang Thu phí (ĐX-CN-2) – 2026-10-29

- Lý do: ĐX-CN-2 của YCTD-370; bảng vẽ Thu phí đã duyệt có hai ô này.
- Định nghĩa (Eric chọn phương án a ngày 2026-10-29): kỳ này là các hóa đơn chưa hủy có kỳ chứa ngày hôm nay, theo kỳ thu của từng trường. "Phải thu kỳ này" là tổng tiền (`total`) các hóa đơn đó; "Đã thu" là số đã trả (`amount_paid`) của chính các hóa đơn đó; kèm tỉ lệ phần trăm.
- Nội dung thay đổi: hai ô mới ở đầu trang Thu phí, tính trên giao diện.
- Thành phần bị ảnh hưởng: `apps/platform/src/BillingPage.tsx`, `tests/e2e/240-cong-van-hanh-dot-2.spec.ts`, tài liệu 11, 14.
- Dữ liệu, API, quyền bị ảnh hưởng: không. Giới hạn: tính trên tối đa 200 hóa đơn mới nhất mà máy chủ trả.
- Mức: Nhỏ. Người phê duyệt: Eric, ngày 2026-10-29.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: ô Phải thu kỳ này, Đã thu ở trang Thu phí (YCTD-375).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Ô Phải thu kỳ này, Đã thu ở trang Thu phí | YCTD-375 |

## Thêm dòng

| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1161 | Cho hóa đơn của các trường / Khi mở trang Thu phí / Thì "Phải thu kỳ này" là tổng tiền các hóa đơn chưa hủy có kỳ chứa ngày hôm nay (theo kỳ thu của từng trường), "Đã thu" là số đã trả của chính các hóa đơn đó; hóa đơn đã hủy, hóa đơn kỳ khác không tính; danh sách chạm 200 hóa đơn thì ghi có thể thiếu (Bắt buộc; CT-1708; YCTD-375) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1708 | P19-06 | Kế toán mở Thu phí: hóa đơn kỳ hiện tại 3.000 đ đã trả 1.000 đ, hóa đơn đã hủy cùng kỳ 5.000 đ, hóa đơn kỳ khác | Phải thu kỳ này 3.000 đ; Đã thu 1.000 đ (33%); 1 hóa đơn có kỳ chứa hôm nay | Kiểm thử giao diện `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt ngày 29/10/2026 | Đạt |
