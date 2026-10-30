---
yctd: YCTD-386
tieu_de: Gia sư AI trả phí: nâng gói tháng giữa tháng, phần dùng chung cho trường bán và nền tảng bán
ngay: 2026-10-30
phien_ban_de_xuat: 0.250.0
---

## 02 Nhật ký

### 2026-10-30 — Gia sư AI trả phí: nâng gói tháng giữa tháng, phần dùng chung (YCTD-386, thuộc YCTD-383)

#### Công việc đã thực hiện

- Thêm bảng `ai_tutor_upgrades` ở cơ sở dữ liệu hệ thống của trường (tệp `0131_create_ai_tutor_upgrades`): mỗi lần nâng gói một dòng, chụp gói cũ, gói mới, số ngày còn lại, phần chênh lệch và số lượt cộng thêm; mỗi đăng ký chỉ một lần nâng đang chờ.
- Thêm hàm thuần ở `apps/api/src/ai-tutor/ai-tutor-rules.ts`: `daysInMonth`, `remainingDaysOfMonth`, `prorate`, `upgradeQuote`.
- Thêm hàm ở `apps/api/src/ai-tutor/ai-tutor-turns.ts`: `currentMonthlyTerms`, `createAiTutorUpgrade`, `applyAiTutorUpgrade`, `cancelAiTutorUpgrade`. Lát L1a (trường bán) ghi rồi áp ngay; lát L1b (nền tảng bán) ghi ở trạng thái chờ, áp khi đã thu tiền.
- Kiểm thử tự động: `ai-tutor-rules.test.ts` (ngày còn lại theo giờ Việt Nam ở đầu tháng, cuối tháng, tháng 2, tháng chưa tới, tháng đã qua; làm tròn; mọi lý do chặn) và `ai-tutor-turns.test.ts` (nâng một lần, nâng hai lần, lần nâng đang chờ, quá hạn giữ chỗ, hủy, đăng ký bị hủy giữa chừng, hai lần nâng đồng thời, ràng buộc của cơ sở dữ liệu).

#### Quyết định

- Eric chọn ngày 2026-10-30: cho nâng gói giữa tháng, phụ huynh trả phần chênh lệch theo số ngày còn lại của tháng, lượt cộng thêm theo cùng tỉ lệ.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - ngày còn lại tính cả hôm nay, theo lịch Việt Nam; tháng dùng chưa tới thì trả đủ chênh lệch;
  - phần chênh lệch làm tròn tới đồng, số lượt cộng thêm làm tròn tới lượt (làm tròn thông thường);
  - chỉ nâng lên gói tháng cùng nguồn bán, giá cao hơn và số lượt không ít hơn; không cho hạ gói giữa tháng;
  - giá trên dòng đăng ký giữ giá mua ban đầu để không thu trùng; giá tháng đang dùng là giá đích của lần nâng gần nhất đã áp.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-386, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md` mục 18Q.

#### Vấn đề tồn đọng

- Điểm cuối API, giao diện nâng gói và dòng thu phần chênh lệch làm ở lát L1a (trường bán) và L1b (nền tảng bán).

## 24 Yêu cầu thay đổi

### YCTD-386: Gia sư AI trả phí (YCTD-383), bổ sung nâng gói tháng giữa tháng – 2026-10-30

- Lý do: Eric chọn ngày 2026-10-30 cho phép nâng gói giữa tháng (ví dụ Cơ bản lên Nâng cao); lát L0 coi việc này là mua trùng.
- Nội dung thay đổi: bảng `ai_tutor_upgrades`; hàm tính tỉ lệ theo số ngày còn lại và luật nâng gói dùng chung cho hai nguồn bán.
- Thành phần bị ảnh hưởng: `database/system/migrations/0131_create_ai_tutor_upgrades.ts`, `database/system/schema-parts/yctd-383-gia-su-ai.ts`, `apps/api/src/ai-tutor/ai-tutor-rules.ts`, `apps/api/src/ai-tutor/ai-tutor-turns.ts`, tài liệu 16.
- Dữ liệu, API, quyền bị ảnh hưởng: một bảng mới ở cơ sở dữ liệu hệ thống; chưa đổi API, quyền.
- Ảnh hưởng chức năng cũ: không; chặn mua trùng gói tháng giữ nguyên.
- Kiểm thử cần thực hiện: kiểm kiểu `database`, `apps/api`; `apps/api/src/ai-tutor/*.test.ts`; chạy database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn (thuộc YCTD-383). Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gia sư AI trả phí, phần dùng chung của nâng gói tháng giữa tháng: tính phần chênh lệch và số lượt cộng thêm theo số ngày còn lại (YCTD-386, thuộc YCTD-383).
- Database migration: hệ thống `0131_create_ai_tutor_upgrades`. Quay lui: chạy `down` (xóa bảng mới; chưa có dữ liệu thật vì chưa có điểm cuối ghi).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gia sư AI trả phí: nâng gói giữa tháng, phần dùng chung | YCTD-386 |

## Thêm dòng

| 16_CO_SO_DU_LIEU.md | ai_tutor_messages (hệ thống, từ YCTD-383) | ai_tutor_upgrades (hệ thống, từ YCTD-383) | Mỗi lần nâng gói tháng giữa tháng, của cả hai nguồn bán | id, subscription_id, child_id, plan_source, from_plan_id, from_plan_name, from_price, from_turns, to_plan_id, to_plan_name, to_price, to_turns, to_allow_images (to_price > from_price, to_turns ≥ from_turns, khác gói), remaining_days, days_in_month (28 đến 31; ngày còn lại 1 đến số ngày của tháng), price_difference, extra_turns (không âm), status (`pending`, `applied`, `cancelled`, `refunded`), pending_expires_at, buyer_user_id, buyer_name, external_reference (mã dòng thu trên hóa đơn học phí hoặc mã giao dịch của nền tảng), applied_at, cancelled_at, cancel_reason, created_at, updated_at; chỉ mục duy nhất `ai_tutor_upgrades_one_pending` (subscription_id) với dòng `pending`; chỉ mục (subscription_id, status, applied_at) |
