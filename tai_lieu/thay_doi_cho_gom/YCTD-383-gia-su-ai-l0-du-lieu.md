---
yctd: YCTD-383
tieu_de: Gia sư AI trả phí trong ứng dụng học sinh, lát L0: dữ liệu chung, sổ lượt, chặn mua trùng
ngay: 2026-10-30
phien_ban_de_xuat: 0.249.0
---

## 02 Nhật ký

### 2026-10-30 — Gia sư AI trả phí trong ứng dụng học sinh, lát L0: dữ liệu chung, sổ lượt, chặn mua trùng (YCTD-383)

#### Công việc đã thực hiện

- Thêm bảng ở cơ sở dữ liệu hệ thống của trường (tệp `0130_create_ai_tutor`): `ai_tutor_plans` (gói trường bán), `ai_tutor_subscriptions` (mỗi lần mua cho một con, cả hai nguồn), `ai_tutor_turn_ledger` (sổ lượt), `ai_tutor_conversations`, `ai_tutor_messages`. Thêm `platform_ai_tutor_plans` ở cơ sở dữ liệu nền tảng (tệp `0250_create_ai_tutor_plans`) và cột `assignments.ai_blocked` ở cơ sở dữ liệu năm học (tệp `0230_add_assignment_ai_blocked`).
- Thêm dịch vụ `apps/api/src/ai-tutor/ai-tutor-rules.ts` (hàm thuần: khoảng dùng của gói, chặn mua trùng, thứ tự trừ lượt, số lượt còn) và `apps/api/src/ai-tutor/ai-tutor-turns.ts` (ghi lần mua, kích hoạt, tạm giữ, trừ, hoàn lượt, hoàn lượt tạm giữ quá hạn). Chưa có điểm cuối API, chưa có giao diện, chưa thanh toán.
- Kiểm thử tự động: `apps/api/src/ai-tutor/ai-tutor-rules.test.ts` (đúng, sai, giá trị biên: chuyển tháng theo giờ Việt Nam, 29/02, hết hạn giữ chỗ đúng thời điểm) và `apps/api/src/ai-tutor/ai-tutor-turns.test.ts` trên cơ sở dữ liệu hệ thống tạm (chặn mua trùng giữa hai nguồn, hai lần mua đồng thời, hai yêu cầu hỏi đồng thời khi còn một lượt, gói tháng trước lượt mua thêm, ràng buộc của cơ sở dữ liệu).
- Cập nhật `16_CO_SO_DU_LIEU.md` mục 18Q.

#### Quyết định

- Eric duyệt phương án, bản mẫu MH-596 đến MH-600 và danh sách lát ngày 2026-10-30: trường bán và nền tảng bán song song, gói tháng và gói lượt, lượt mua thêm giữ 12 tháng từ ngày mua, chỉ khóa AI của nền tảng.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - lần mua của cả hai nguồn ghi vào một bảng ở cơ sở dữ liệu hệ thống của trường có con, để một chỉ mục duy nhất chặn mua trùng gói tháng (kể cả hai lần mua đồng thời) và chế độ một trường vẫn chạy được phía trường bán; gói của nền tảng ở cơ sở dữ liệu nền tảng, lần mua chụp lại gói;
  - dòng chờ thanh toán có hạn giữ chỗ; quá hạn thì được hủy khi có lần mua mới cho cùng tháng;
  - số lượt đã dùng, đang giữ nằm ngay trên dòng đăng ký; sổ lượt ghi từng lượt; tạm giữ bằng câu cập nhật có điều kiện còn lượt; lượt tạm giữ quá 10 phút được hoàn;
  - giá ở cơ sở dữ liệu trường là số thập phân hai chữ số (quy ước 5 của `16`), ở cơ sở dữ liệu nền tảng là số nguyên đồng như `plans`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-383, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md` mục 18Q, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Đổi gói tháng giữa tháng (ví dụ Cơ bản lên Nâng cao) đang bị chặn như mua trùng; cần Eric quyết định ở lát L1a, L1b.
- Hủy, hoàn tiền một lần mua đã dùng lượt thuộc lát L1b; xóa tin nhắn theo hạn 12 tháng thuộc lát L2.
- Mã chức năng (`10`), tiêu chí nghiệm thu (`11`), kịch bản kiểm thử (`21`) của gia sư AI cấp khi làm các lát có điểm cuối API và giao diện.

## 24 Yêu cầu thay đổi

### YCTD-383: Gia sư AI trả phí trong ứng dụng học sinh – 2026-10-30

- Lý do: Eric muốn bán gia sư AI cho học sinh: trường bán qua hóa đơn học phí và nền tảng bán thẳng cho phụ huynh; gói tháng có số lượt và gói lượt mua thêm.
- Nội dung thay đổi: chức năng mới chạm bốn ứng dụng (học sinh, phụ huynh, cổng quản trị trường, cổng vận hành), làm theo lát L0, L1a, L1b, L2, L3, L4, L5. Lát L0: bảng gói, đăng ký, sổ lượt, hội thoại, tin nhắn, cột `assignments.ai_blocked`; dịch vụ sổ lượt và chặn mua trùng có kiểm thử tự động.
- Thành phần bị ảnh hưởng ở lát L0: `database/system/migrations/0130_create_ai_tutor.ts`, `database/platform/migrations/0250_create_ai_tutor_plans.ts`, `database/school-year/migrations/0230_add_assignment_ai_blocked.ts`, ba tệp `schema-parts/yctd-383-gia-su-ai.ts`, `apps/api/src/ai-tutor/`, tài liệu 16, 27.
- Dữ liệu, API, quyền bị ảnh hưởng: năm bảng mới ở cơ sở dữ liệu hệ thống, một bảng mới ở cơ sở dữ liệu nền tảng, một cột mới có giá trị mặc định ở `assignments`; chưa đổi API, quyền.
- Ảnh hưởng chức năng cũ: không; cột mới mặc định "không" nên bài tập có sẵn không đổi.
- Kiểm thử cần thực hiện: kiểm kiểu `database`, `apps/api`; `apps/api/src/ai-tutor/*.test.ts`; chạy database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-30 (phương án, bản mẫu MH-596 đến MH-600, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gia sư AI trả phí, lát L0: dữ liệu gói, đăng ký, sổ lượt, hội thoại; quy tắc chặn mua trùng gói tháng giữa trường bán và nền tảng bán (YCTD-383).
- Database migration: hệ thống `0130_create_ai_tutor`, nền tảng `0250_create_ai_tutor_plans`, năm học `0230_add_assignment_ai_blocked`. Quay lui: chạy `down` của ba tệp (xóa bảng mới, cột mới; chưa có dữ liệu thật vì chưa có điểm cuối ghi).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gia sư AI trả phí, lát L0: dữ liệu và sổ lượt | YCTD-383 |

## Thêm dòng

| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-383 | Gia sư AI trả phí trong ứng dụng học sinh, lát L0: dữ liệu chung, sổ lượt, chặn mua trùng | {PHIEN_BAN} | chưa cấp (lát có điểm cuối API) | chưa cấp | chưa cấp; kiểm thử tự động `apps/api/src/ai-tutor/ai-tutor-rules.test.ts`, `apps/api/src/ai-tutor/ai-tutor-turns.test.ts` | PR, commit merge ghi khi gom; tệp mã: `database/system/migrations/0130_create_ai_tutor.ts`, `apps/api/src/ai-tutor/ai-tutor-turns.ts` và 7 tệp khác | Kiểm thử tự động đạt trên máy ngày 30/10/2026; CI của PR |
