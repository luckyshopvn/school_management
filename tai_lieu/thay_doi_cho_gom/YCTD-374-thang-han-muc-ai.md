---
yctd: YCTD-374
tieu_de: Chọn tháng và thanh so với hạn mức ở trang Trợ lý AI (ĐX-CN-3)
ngay: 2026-10-29
phien_ban_de_xuat: 0.240.4
---

## 02 Nhật ký

### 2026-10-29 — Chọn tháng và thanh so với hạn mức ở trang Trợ lý AI (ĐX-CN-3)

#### Công việc đã thực hiện

- Thẻ "Token đã dùng trong tháng" ở trang Trợ lý AI có ô chọn tháng; trang gửi `from`, `to` (ngày đầu, ngày cuối tháng) cho `GET ai/usage` mà máy chủ đã nhận sẵn.
- Bảng "So với hạn mức của gói": mỗi trường một dòng, gộp mọi cấu hình và mô hình (như máy chủ của trường tính hạn mức theo tháng), thanh yêu cầu và token so với `ai_max_requests`, `ai_max_tokens` của gói; dưới 80% tông nhấn, từ 80% cảnh báo, từ 100% nguy hiểm; gói không giới hạn ghi "không giới hạn". Gói của trường đọc từ `GET plan-schools`.
- Kiểm thử: CT-1707 ở `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt trên máy.

#### Quyết định

- Eric chọn lập phiếu riêng cho ĐX-CN-3 ngày 2026-10-29 (Q6 của YCTD-370). Khảo sát cho thấy không cần đổi API (điểm cuối đã nhận khoảng ngày), nên mức Nhỏ.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: số trên thanh lấy từ bảng tổng hợp token của nền tảng; máy chủ của trường chặn theo nhật ký AI của trường, hai nguồn có thể lệch nhỏ khi có lượt gọi lỗi.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-374, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` MH-341, `15_HE_THONG_THIET_KE.md` VH-TP-07.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-374: Chọn tháng và thanh so với hạn mức ở trang Trợ lý AI (ĐX-CN-3) – 2026-10-29

- Lý do: ĐX-CN-3 của YCTD-370; bảng vẽ Trợ lý AI đã duyệt có chọn tháng và thanh "So với hạn mức".
- Nội dung thay đổi: ô chọn tháng cho bảng token; bảng so với hạn mức của gói theo trường.
- Thành phần bị ảnh hưởng: `apps/platform/src/AiPage.tsx`, `apps/platform/src/cong-van-hanh.css`, `tests/e2e/240-cong-van-hanh-dot-2.spec.ts`, tài liệu 14, 15.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Mức: Nhỏ. Người phê duyệt: Eric, ngày 2026-10-29.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: chọn tháng và thanh so với hạn mức ở trang Trợ lý AI (YCTD-374).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Chọn tháng và thanh so với hạn mức ở trang Trợ lý AI | YCTD-374 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1707 | P19-06 | Kế toán mở Trợ lý AI: trường dùng 85 yêu cầu, gói giới hạn 100; chọn tháng 02/2030 | Thanh 85 / 100 (85%), token "không giới hạn"; gửi `from=2030-02-01&to=2030-02-28` | Kiểm thử giao diện `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt ngày 29/10/2026 | Đạt |
