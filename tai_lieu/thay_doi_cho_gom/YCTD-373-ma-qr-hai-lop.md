---
yctd: YCTD-373
tieu_de: Mã QR khi tạo nhân viên vận hành, cấp lại khóa hai lớp (ĐX-CN-5)
ngay: 2026-10-29
phien_ban_de_xuat: 0.240.3
---

## 02 Nhật ký

### 2026-10-29 — Mã QR khi tạo nhân viên vận hành, cấp lại khóa hai lớp (ĐX-CN-5)

#### Công việc đã thực hiện

- Hộp thông tin hiện một lần ở trang Nhân viên vận hành (tạo nhân viên, cấp lại khóa hai lớp) hiện mã QR của địa chỉ `otpauth` để quét bằng ứng dụng xác thực. Ảnh tạo ngay trên trình duyệt, không gửi đi, không lưu.
- Dùng lại thư viện `qrcode` 1.5.4 (giấy phép MIT) đã có ở `apps/portal`, `apps/parent`; `apps/platform` khai cùng phiên bản, không thêm thư viện mới cho dự án.
- Kiểm thử: CT-1694 ở `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` kiểm thêm ảnh mã QR, đạt trên máy.

#### Quyết định

- Eric chọn lập phiếu riêng cho ĐX-CN-5 ngày 2026-10-29 (Q6 của YCTD-370). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: dùng lại thư viện `qrcode` đang có trong dự án thay cho tìm thư viện khác (nguyên tắc dùng lại), nên mức Nhỏ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-373, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` MH-581.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-373: Mã QR khi tạo nhân viên vận hành, cấp lại khóa hai lớp (ĐX-CN-5) – 2026-10-29

- Lý do: ĐX-CN-5 của YCTD-370; trước đây phải chép tay khóa hai lớp hoặc địa chỉ `otpauth` vào ứng dụng xác thực.
- Nội dung thay đổi: hiện mã QR của `otpauth_uri` trong hộp thông tin hiện một lần.
- Thành phần bị ảnh hưởng: `apps/platform/src/OperatorsPage.tsx`, `apps/platform/package.json`, `pnpm-lock.yaml`, `tests/e2e/240-cong-van-hanh-dot-2.spec.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Bảo mật: mã QR chứa khóa hai lớp như ô "Địa chỉ thêm vào ứng dụng xác thực" đang có; tạo trên trình duyệt, không gửi, không ghi bộ nhớ, mất khi đóng hộp.
- Mức: Nhỏ. Người phê duyệt: Eric, ngày 2026-10-29.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: mã QR khi tạo nhân viên vận hành, cấp lại khóa hai lớp (YCTD-373).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Mã QR khi tạo nhân viên vận hành, cấp lại khóa hai lớp | YCTD-373 |
