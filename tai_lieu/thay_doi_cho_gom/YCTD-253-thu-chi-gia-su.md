---
yctd: YCTD-253
tieu_de: DT-27 phần 27c: thu phí và chi trả gia sư trong trường theo quy định
ngay: 2026-10-27
phien_ban_de_xuat: 0.156.0
---

## 02 Nhật ký

### 2026-10-27 — DT-27 phần 27c: thu phí và chi trả gia sư trong trường theo quy định

#### Công việc đã thực hiện

- Đọc mục 19.2, 19.4, 19.5 (27c) của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà luồng tính học phí (`fees/fee-calculation.service.ts`, mẫu phí ngoại khóa `activities/extracurricular-fees.ts`), điều chỉnh hóa đơn (`fees/discounts.service.ts`), phiếu chi hoàn, thưởng và khấu trừ của bảng lương (`staff_bonus_deductions`), biểu thuế thu nhập cá nhân, tệp Excel và nhật ký xuất.
- Thêm năm học `0155` (giá của chương trình, dòng `tutoring` trên hóa đơn, buổi đã thu, khoản trừ buổi hủy, phần trừ đã áp) và `0156` (đơn giá thù lao theo tiết, nguồn chi, người dạy buổi, thù lao đã đẩy, khoản mục lương `THU_LAO_DAY_THEM`).
- Thêm hàm thuần `packages/shared/src/tutoring-fees.ts`, phần nối vào lần tính học phí `apps/api/src/tutoring/tutoring-fees.ts`, dịch vụ và điểm cuối thu chi `tutoring-finance.ts`, trang "5. Thu chi gia sư" ở cổng quản trị, ô giá và thù lao ở biểu mẫu chương trình, chọn giáo viên đã dạy khi xác nhận điểm danh, mức thu ở ứng dụng phụ huynh.
- Kiểm thử: CT-27c-1 đến CT-27c-9 (hàm thuần, luồng có cơ sở dữ liệu ở `apps/api`, e2e 192).

#### Quyết định

- Chương trình `curriculum` không có giá và không bật được thu tiền (ràng buộc của bảng, hàm thuần, máy chủ); nguồn chi thù lao luôn là kinh phí của trường; màn hình ghi căn cứ.
- Khoản thu của chương trình `enrichment` có thu là dòng `tutoring` trên hóa đơn chính của kỳ, do lần tính học phí lập (cùng cách phí ngoại khóa): theo buổi thu các buổi chưa hủy từ ngày duyệt đơn đến hết kỳ; trọn gói thu một lần. Thu qua cổng của trường như mọi hóa đơn.
- Buổi đã thu bị hủy thành khoản trừ: mặc định trừ vào khoản gia sư kỳ sau (dòng không âm); kế toán có thể lập điều chỉnh giảm hóa đơn qua luồng điều chỉnh hiện có (chờ duyệt), hoặc đóng sau khi đã hoàn qua phiếu chi hoàn. Buổi đã xác nhận điểm danh không hủy được.
- Thù lao theo tiết của buổi đã dạy (đã xác nhận điểm danh); kế toán đẩy vào bảng lương tháng thành dòng thưởng của khoản mục "Thù lao dạy phụ đạo, bồi dưỡng", chịu thuế thu nhập cá nhân theo biểu thuế sẵn có; bảng lương đã gửi duyệt hoặc đã duyệt thì đẩy vào tháng sau.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-253, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-253 đến BR-255, PQ-112, P02-89, P02-90, AC-901 đến AC-903, MH-362, CT-1146 đến CT-1154.

#### Vấn đề tồn đọng

- Thông tư 29/2024 chưa đối chiếu bản gốc (E-07); hoàn tiền mặt cho buổi đã thu vẫn do kế toán lập phiếu chi hoàn rồi đóng khoản trừ; đơn giá riêng của từng giáo viên có ở API, chưa có ô trên biểu mẫu.

## 24 Yêu cầu thay đổi

### YCTD-253: DT-27 phần 27c: thu phí và chi trả gia sư trong trường theo quy định – 2026-10-27

- Lý do: phần 27c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 19.4, 19.5; ràng buộc "dạy thêm trong nhà trường không thu tiền" của Thông tư 29/2024/TT-BGDĐT sửa đổi bởi Thông tư 19/2026/TT-BGDĐT (bảng 19.2).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Khóa không thu tiền:** `curriculum` không có giá, không bật thu tiền (ràng buộc `tutoring_programs_fee_check` và `tutoring_programs_curriculum_check`, hàm thuần `feeRuleViolations`, máy chủ); nguồn chi thù lao luôn `school_budget` (`tutoring_programs_funding_check`); biểu mẫu và trang thu chi ghi căn cứ.
  - **Giá của chương trình bổ trợ có thu** (năm học `0155`): `fee_basis` (`per_session` theo buổi, `per_program` trọn gói), `fee_amount`, `cancel_refund` (`deduct_next` trừ kỳ sau, `adjust_invoice` điều chỉnh hóa đơn); nháp lưu được khi chưa có giá, duyệt thì bắt buộc có giá.
  - **Khoản thu trên hóa đơn của trường:** lần tính học phí của kỳ thêm dòng `tutoring` vào hóa đơn chính (`invoice_items.tutoring_registration_id`), theo buổi thu các buổi chưa hủy từ ngày duyệt đơn đến hết kỳ (đơn đã rút thì đến ngày rút, buổi kỳ trước chưa thu thì thu bù), trọn gói thu một lần ở kỳ đầu sau khi chương trình bắt đầu; `tutoring_charge_sessions` ghi buổi đã thu để không thu trùng, tính lại hóa đơn nháp thì lập lại. Cha mẹ trả qua cổng của trường như mọi hóa đơn (S3).
  - **Buổi hủy sau khi đã thu:** lập khoản trừ (`tutoring_credits`; theo buổi đúng số đã thu, trọn gói chia đều theo số buổi lúc thu). Trừ kỳ sau: lần tính học phí sau trừ vào các dòng gia sư của học sinh, không để dòng âm (`tutoring_credit_applications`), chỉ dùng khoản trừ của hóa đơn đã phát hành. Kế toán ở trang thu chi: lập điều chỉnh giảm hóa đơn đã thu buổi qua `DiscountsService.createAdjustment` (luồng điều chỉnh hiện có, chờ duyệt; hóa đơn đã thu hết thì luồng hiện có từ chối), chuyển sang trừ kỳ sau, hoặc đóng sau khi đã hoàn qua phiếu chi hoàn (ghi số phiếu). Buổi đã xác nhận điểm danh không hủy được.
  - **Thù lao giáo viên** (`0156`): đơn giá mỗi tiết ở chương trình, giáo viên có đơn giá riêng thì dùng đơn giá riêng; người dạy buổi ghi khi xác nhận điểm danh (Ban Giám hiệu xác nhận thay thì chọn giáo viên); kế toán (quyền `P08.bonus-deduction.manage`) xem trước và đẩy thù lao buổi đã dạy đến hết tháng vào bảng lương tháng: một dòng `staff_bonus_deductions` mỗi giáo viên, khoản mục `THU_LAO_DAY_THEM` "Thù lao dạy phụ đạo, bồi dưỡng" (phụ cấp, chịu thuế thu nhập cá nhân, không đóng bảo hiểm), `tutoring_teacher_pay` ghi buổi đã đẩy; bảng lương đã gửi duyệt hoặc đã duyệt thì không đẩy (BR-45); giáo viên chưa có hồ sơ nhân sự hoặc chương trình chưa có đơn giá thì liệt kê để bổ sung.
  - **Báo cáo:** thu trên hóa đơn đã phát hành, trừ kỳ sau, điều chỉnh giảm, đã hoàn, chờ trừ hoặc hoàn, thu thuần, thù lao đã đẩy và chưa đẩy, theo chương trình và khoảng tháng; tổng thù lao theo nguồn chi; xuất Excel (ghi nhật ký xuất có dữ liệu cá nhân, BR-74).
- Thành phần bị ảnh hưởng: `database` (năm học `0155`, `0156`), `packages/shared` (`tutoring-fees.ts`, menu, quyền menu), `apps/api` (`tutoring/`, `fees/fee-calculation.service.ts`), `apps/portal` (`tutoring/`), `apps/parent` (`TutoringPanel.tsx`), `tests/e2e/192-tutoring-finance.spec.ts`.
- Dữ liệu bị ảnh hưởng: năm học thêm cột ở `tutoring_programs`, `tutoring_program_teachers`, `tutoring_sessions`, `invoice_items`; thêm bảng `tutoring_charge_sessions`, `tutoring_credits`, `tutoring_credit_applications`, `tutoring_teacher_pay`; thêm khoản mục lương `THU_LAO_DAY_THEM`.
- API bị ảnh hưởng: thêm nhóm `/api/v1/tutoring/finance`; chương trình nhận thêm `fee_basis`, `fee_amount`, `cancel_refund`, `pay_rate_per_period`, `funding_source`, `teacher_pay_rates`; điểm danh nhận `taught_by_user_id`.
- Giao diện bị ảnh hưởng: MH-362 (mới), MH-349, MH-350, MH-354.
- Quyền bị ảnh hưởng: PQ-112 (không thêm mã quyền).
- Ảnh hưởng chức năng cũ: trường không có chương trình bổ trợ có thu thì hóa đơn không đổi; buổi đã xác nhận điểm danh không hủy được nữa.
- Kiểm thử cần thực hiện: kiểm thử đơn vị `apps/api` (`tutoring-fees-rules`, `tutoring-finance`, `tutoring`, `fees`, `working-level`); kiểm tĩnh; e2e 192, 191.
- Còn lại: điểm danh tự động khi 27a gộp; ô đơn giá riêng của giáo viên trên biểu mẫu.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-27 phần 27c, thu phí và chi trả gia sư trong trường theo quy định (YCTD-253).
- Chức năng mới: giá của chương trình bổ trợ có thu, dòng gia sư trên hóa đơn của kỳ, khoản trừ buổi hủy (trừ kỳ sau, điều chỉnh hóa đơn, đóng sau khi hoàn), thù lao giáo viên vào bảng lương, trang Thu chi gia sư có báo cáo và tệp Excel (P02-89, P02-90).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0155`, `0156`.
- Thay đổi API: nhóm `/tutoring/finance` (xem `17_DAC_TA_API.md`).
- Kiểm thử: CT-1146 đến CT-1154 (CT-27c-1 đến CT-27c-9): hàm thuần, luồng có cơ sở dữ liệu ở `apps/api`, e2e 192; e2e toàn bộ do CI chạy.
- Rủi ro: Thông tư 29/2024 chưa đối chiếu bản gốc (E-07); hoàn tiền mặt vẫn qua phiếu chi hoàn do kế toán lập.
- Khả năng tương thích: không đổi hóa đơn của trường không có chương trình có thu.
- Phương án quay lui: hoàn lại commit gộp; chương trình đặt lại không thu tiền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27c: thu phí chương trình bổ trợ trên hóa đơn của trường, khoản trừ buổi hủy, thù lao giáo viên vào bảng lương, báo cáo thu chi gia sư | YCTD-253 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +3 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +3 |
| Màn hình dự kiến | Số lượng | +1 |
| Ca kiểm thử khởi đầu | Số lượng | +9 |
| Chức năng đã liệt kê | Số lượng | +2 |
| 10 | mã chức năng | +2 |
| 10 | còn hiệu lực | +2 |
| 14 | màn hình | +1 |
| 16 | bảng dự kiến | +4 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27 phần 27c (YCTD-253: thu phí và chi trả gia sư trong trường) |
| 14_DAC_TA_GIAO_DIEN.md | MH-349 | YCTD-253: biểu mẫu có mức thu (cách tính, số tiền, cách xử lý buổi hủy) khi bổ trợ có thu, đơn giá thù lao mỗi tiết, nguồn chi; môn học ghi căn cứ không thu tiền |
| 14_DAC_TA_GIAO_DIEN.md | MH-350 | YCTD-253: buổi đã xác nhận điểm danh không hủy được; chương trình nhiều giáo viên thì chọn giáo viên đã dạy khi xác nhận |
| 14_DAC_TA_GIAO_DIEN.md | MH-354 | YCTD-253: hiện mức thu theo buổi hoặc trọn gói trên hóa đơn học phí của trường |
| 16_CO_SO_DU_LIEU.md | tutoring_programs (từ YCTD-252) | YCTD-253: fee_basis, fee_amount, cancel_refund, pay_rate_per_period, funding_source (`curriculum` không giá, nguồn chi `school_budget`) |
| 16_CO_SO_DU_LIEU.md | tutoring_sessions (từ YCTD-252) | YCTD-253: taught_by_user_id, taught_by_name (người dạy buổi, tính thù lao) |
| 16_CO_SO_DU_LIEU.md | invoice_items | YCTD-253: item_type thêm `tutoring`, tutoring_registration_id |
| 16_CO_SO_DU_LIEU.md | pay_item_types | YCTD-253: khoản mục hệ thống `THU_LAO_DAY_THEM` (thù lao dạy phụ đạo, bồi dưỡng) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-253 | Thu phí gia sư trong trường (YCTD-253, Thông tư 29/2024 sửa bởi Thông tư 19/2026): chương trình `curriculum` không có giá, không bật thu tiền, nguồn chi thù lao là kinh phí của trường; chương trình `enrichment` có thu phải có cách tính và số tiền trước khi duyệt; khoản thu là dòng `tutoring` trên hóa đơn chính của kỳ do lần tính học phí lập, theo buổi chưa hủy từ ngày duyệt đơn hoặc trọn gói một lần, không thu trùng buổi đã thu |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-254 | Buổi gia sư bị hủy sau khi đã thu (YCTD-253): buổi đã xác nhận điểm danh không hủy được; buổi đã thu bị hủy thành khoản trừ (trọn gói chia đều theo số buổi lúc thu); mặc định trừ vào khoản gia sư kỳ sau, dòng không âm, chỉ dùng khoản trừ của hóa đơn đã phát hành; kế toán lập điều chỉnh giảm hóa đơn qua luồng điều chỉnh hiện có hoặc đóng sau khi đã hoàn qua phiếu chi hoàn (ghi số phiếu) |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-255 | Thù lao gia sư (YCTD-253): thù lao một buổi là số tiết quy đổi nhân đơn giá (đơn giá riêng của giáo viên thay đơn giá của chương trình), chỉ buổi chưa hủy đã xác nhận điểm danh, ghi cho giáo viên đã dạy; đẩy vào bảng lương tháng thành dòng thưởng khoản mục "Thù lao dạy phụ đạo, bồi dưỡng" chịu thuế thu nhập cá nhân; bảng lương đã gửi duyệt hoặc đã duyệt thì không đẩy (BR-45); không đẩy trùng buổi |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-111 | PQ-112 | Thu chi gia sư trong trường (YCTD-253, DT-27 phần 27c): không thêm mã quyền; báo cáo, xem trước thù lao cho `P02.tutoring.manage`, `P08.bonus-deduction.manage`, `P06.payment.manage`; đẩy thù lao vào bảng lương cần `P08.bonus-deduction.manage`; khoản trừ buổi hủy cho `P02.tutoring.manage`, `P05.invoice-adjustment.create`, `P06.payment.manage` (lập điều chỉnh hóa đơn cần `P05.invoice-adjustment.create`) |
| 10_YEU_CAU_CHUC_NANG.md | P02-88 | P02-89 | Thu phí và khoản trừ gia sư (YCTD-253) | Giáo viên; Ban Giám hiệu; kế toán | Cách tính, số tiền, cách xử lý buổi hủy | Dòng gia sư trên hóa đơn của kỳ, khoản trừ buổi hủy, điều chỉnh hóa đơn, đóng sau khi hoàn | Hóa đơn, khoản trừ, phiếu điều chỉnh | BR-253, BR-254, PQ-112 |
| 10_YEU_CAU_CHUC_NANG.md | P02-88 | P02-90 | Thù lao gia sư và báo cáo thu chi (YCTD-253) | Kế toán; Ban Giám hiệu | Đơn giá mỗi tiết, nguồn chi, tháng lương, khoảng tháng | Xem trước, đẩy thù lao vào bảng lương; báo cáo theo chương trình và kỳ; xuất Excel | Dòng thưởng của bảng lương, báo cáo, tệp Excel | BR-255, PQ-112 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-901 | Cho chương trình gia sư / Khi lập môn học có giá hoặc nguồn chi khác kinh phí trường, duyệt chương trình bổ trợ có thu chưa có giá / Thì máy chủ chặn theo từng dòng, bổ trợ có giá thì duyệt được và cha mẹ thấy mức thu (CT-1146, CT-1148, CT-1154; YCTD-253) | P02-89 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-902 | Cho học sinh có đơn được duyệt ở chương trình có thu theo buổi / Khi tính học phí kỳ, tính lại nháp, phát hành, hủy một buổi đã thu / Thì dòng gia sư đúng số buổi chưa hủy, không thu trùng, buổi hủy thành khoản trừ trừ vào kỳ sau không để dòng âm, kế toán lập được điều chỉnh hoặc đóng sau khi hoàn (CT-1147, CT-1149, CT-1150, CT-1151; YCTD-253) | P02-89 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-903 | Cho buổi đã dạy đã xác nhận điểm danh / Khi kế toán đẩy thù lao tháng, đẩy lại, đẩy vào bảng lương đã chốt, xem báo cáo / Thì một dòng thưởng mỗi giáo viên đúng số tiết nhân đơn giá, chịu thuế thu nhập cá nhân, không đẩy trùng, bảng lương đã chốt bị chặn, báo cáo đúng thu, hoàn, chi theo nguồn (CT-1152, CT-1153, CT-1154; YCTD-253) | P02-90 |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-362 | Cổng: Gia sư trực tuyến › 5. Thu chi gia sư (YCTD-253): báo cáo thu, trừ, điều chỉnh, hoàn, thu thuần, thù lao theo chương trình và khoảng tháng, xuất Excel; thù lao giáo viên chưa đẩy của tháng lương (giáo viên, số tiết, đơn giá, lý do chưa đẩy được), nút đẩy vào bảng lương; khoản trừ buổi hủy với nút lập điều chỉnh hóa đơn, trừ kỳ sau, đã hoàn và đóng |
| 16_CO_SO_DU_LIEU.md | tutoring_attendance, tutoring_room_events (từ YCTD-252) | tutoring_charge_sessions (từ YCTD-253) | Buổi đã thu ở dòng hóa đơn nào (BR-253; năm học `0155`) | invoice_item_id (xóa theo dòng), registration_id, session_id (trống là trọn gói), amount, sessions_total (trọn gói); một buổi một lần mỗi đơn |
| 16_CO_SO_DU_LIEU.md | tutoring_attendance, tutoring_room_events (từ YCTD-252) | tutoring_credits, tutoring_credit_applications (từ YCTD-253) | Khoản trừ buổi hủy đã thu và phần đã trừ vào hóa đơn sau (BR-254; `0155`) | child_id, registration_id, session_id, charged_invoice_id, amount, reason, mode (`deduct_next`, `adjust_invoice`), status (`open`, `adjusted`, `closed`), invoice_adjustment_id, ghi chú đóng; phần trừ: credit_id, invoice_item_id, amount |
| 16_CO_SO_DU_LIEU.md | tutoring_attendance, tutoring_room_events (từ YCTD-252) | tutoring_teacher_pay (từ YCTD-253) | Thù lao buổi đã đẩy vào bảng lương (BR-255; `0156`) | session_id, program_id, teacher_user_id, staff_id, periods, rate, amount, funding_source, bonus_deduction_id (dòng thưởng bị hủy thì buổi đẩy lại), target_year, target_month |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1146 | P02-89 | CT-27c-1: quy tắc thu phí: môn học không giá, nguồn chi kinh phí trường; bổ trợ có thu phải có giá; số tiền, đơn giá hợp lệ | Mã vi phạm theo dòng | Đạt; `apps/api/src/tutoring/tutoring-fees-rules.test.ts`; 901 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1147 | P02-89 | CT-27c-2: khoản thu theo buổi, trọn gói; chia khoản trừ; trừ không để dòng âm; thù lao theo tiết, đơn giá riêng | Đúng số tiền | Đạt; `apps/api/src/tutoring/tutoring-fees-rules.test.ts`; 902, 903 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1148 | P02-89 | CT-27c-3: lập chương trình qua API: môn học có giá, nguồn chi khác; nháp có thu chưa giá lưu được, duyệt bị chặn | 422 `curriculum_fee`, `funding_source`, `fee_missing` | Đạt; `apps/api/src/tutoring/tutoring-finance.test.ts`; 901 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1149 | P02-89 | CT-27c-4: dòng gia sư của kỳ theo buổi chưa hủy; tính lại nháp; hóa đơn đã phát hành không thu lại | 4 buổi 200.000 đ; không thu trùng | Đạt; `apps/api/src/tutoring/tutoring-finance.test.ts`; 902 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1150 | P02-89 | CT-27c-5: buổi đã dạy không hủy được; buổi đã thu bị hủy thành khoản trừ, trừ vào kỳ sau | 409; khoản trừ 50.000 đ; dòng kỳ sau 0 đ | Đạt; `apps/api/src/tutoring/tutoring-finance.test.ts`; 902 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1151 | P02-89 | CT-27c-6: kế toán lập điều chỉnh giảm hóa đơn, đóng khoản trừ sau khi hoàn | Phiếu điều chỉnh −50.000 đ chờ duyệt; khoản đã đóng không trừ nữa | Đạt; `apps/api/src/tutoring/tutoring-finance.test.ts`; 902 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1152 | P02-90 | CT-27c-7: thù lao buổi đã dạy vào bảng lương tháng, không đẩy trùng, bảng lương đã chốt bị chặn | Dòng thưởng `THU_LAO_DAY_THEM` 100.000 đ chịu thuế; 422 `payroll_locked` | Đạt; `apps/api/src/tutoring/tutoring-finance.test.ts`; 903 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1153 | P02-90 | CT-27c-8: báo cáo thu, hoàn, chi theo chương trình và kỳ; tệp Excel ghi nhật ký xuất | Đúng số; nhật ký có dữ liệu cá nhân | Đạt; `apps/api/src/tutoring/tutoring-finance.test.ts`; 903 | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1154 | P02-89, P02-90 | CT-27c-9: giao diện: lập câu lạc bộ có thu, cha mẹ thấy mức thu và gửi đơn, xác nhận điểm danh, kế toán đẩy thù lao | Báo cáo hiện 100.000 đ (1 tiết) | Do CI chạy; `tests/e2e/192-tutoring-finance.spec.ts`; 901, 903 | Cao |
