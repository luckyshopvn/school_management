---
yctd: YCTD-380
tieu_de: Tính lại học phí không thay hóa đơn chính đã phát hành
ngay: 2026-10-29
phien_ban_de_xuat: 0.248.1
---

## 02 Nhật ký

### 2026-10-29 — Tính lại học phí không thay hóa đơn chính đã phát hành

#### Công việc đã thực hiện

- Sửa lỗi L-30 (mức Nghiêm trọng) theo đợt rà soát mã ngày 29/10/2026:
  - lần tính học phí chỉ thay hóa đơn chính còn nháp; hóa đơn chính đã phát hành của trẻ (kể cả hóa đơn lập ở đơn vị cũ trước khi trẻ chuyển đơn vị) giữ nguyên tổng tiền, đơn vị, dòng chi tiết; trẻ đó không tính vào số trẻ của lần tính;
  - phép kiểm "kỳ đã phát hành" (BR-25) chạy lại trong giao dịch ghi;
  - tính và phát hành hóa đơn chính của cùng đơn vị, cùng kỳ chạy lần lượt (khóa theo đơn vị và kỳ); phát hành chỉ đổi hóa đơn còn nháp của đúng đơn vị.
- Kiểm thử máy chủ CT-1720 (`apps/api/src/fees/fee-calculation.test.ts`): chạy trên mã cũ thì hỏng (hóa đơn đã phát hành bị đổi đơn vị, dòng chi tiết), trên mã mới thì đạt.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: trẻ đã có hóa đơn chính phát hành trong kỳ thì lần tính của đơn vị mới bỏ qua trẻ đó, không báo lỗi cho cả lần tính; phần chênh lệch xử lý bằng phiếu điều chỉnh như BR-25.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-380, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không có.

## 24 Yêu cầu thay đổi

### YCTD-380: Tính lại học phí không thay hóa đơn chính đã phát hành – 2026-10-29

- Lý do: sửa lỗi L-30 của đợt rà soát mã ngày 29/10/2026; hệ thống chạy lại đúng BR-25 (hóa đơn đã phát hành chỉ sửa bằng phiếu điều chỉnh).
- Nội dung thay đổi: lần tính học phí chỉ ghi lên hóa đơn chính còn nháp; kiểm "kỳ đã phát hành" trong giao dịch; tính và phát hành cùng đơn vị, cùng kỳ chạy lần lượt.
- Thành phần bị ảnh hưởng: `apps/api/src/fees/fee-calculation.service.ts`, `apps/api/src/fees/fee-calculation.test.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không đổi cấu trúc dữ liệu, API, quyền.
- Ảnh hưởng chức năng cũ: số trẻ của lần tính không đếm trẻ đã có hóa đơn chính phát hành trong kỳ.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/api`; kiểm thử máy chủ tính học phí.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: tính lại học phí không thay hóa đơn chính đã phát hành (YCTD-380, L-30).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Tính lại học phí không thay hóa đơn đã phát hành | YCTD-380 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1720 | P05-05 | Hóa đơn chính tháng trước của trẻ đã phát hành ở đơn vị A; trẻ chuyển sang đơn vị B; kế toán B tính học phí kỳ đó | Lần tính thành công, không đếm trẻ; hóa đơn đã phát hành giữ đơn vị, mã số, tổng tiền, lần tính và dòng chi tiết | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 29/10/2026 (L-30) | Đạt |
