---
yctd: YCTD-383
tieu_de: Gia sư AI trả phí, lát L5: lời nhờ cha mẹ, chủ đề và số lượt cho cha mẹ, báo cáo tháng cho trường
ngay: 2026-10-30
phien_ban_de_xuat: 0.255.0
---

## 02 Nhật ký

### 2026-10-30 — Gia sư AI trả phí, lát L5: lời nhờ cha mẹ, chủ đề và số lượt cho cha mẹ, báo cáo tháng cho trường (YCTD-383)

#### Công việc đã thực hiện

- Máy chủ API: `apps/api/src/ai-tutor/parent-requests.ts` (lời nhờ cha mẹ, BR-530); `tutor-chat.ts` thêm `parent_request` vào trang của em, điểm cuối `POST /student/ai-tutor/parent-requests` (`tutor-chat.controller.ts`) và `top_topics` cho trang chủ đề của cha mẹ (BR-531); `apps/api/src/ai-tutor/school-report.ts` (báo cáo tháng `GET /ai-tutor/school/report`, BR-532) dùng chung hàm tổng hợp token `tutor-usage.ts` (thêm khoảng thời gian) với việc nền ghi token lên nền tảng; đăng ký ở `apps/api/src/dang-ky/yctd-383-l5-hoan-thien.ts`. Không có database migration: lần gửi lời nhờ chính là thông báo trong ứng dụng đã có (`notifications`).
- Ứng dụng học sinh (MH-596, MH-597): nút "Gửi lời nhờ cha mẹ" (`apps/student/src/ai-tutor/ParentRequestButton.tsx`) ở thẻ trang chủ và trang Gia sư AI khi em chưa có gói hoặc đã hết lượt; trạng thái đã gửi, giờ gửi lại; dòng nhắc nói trực tiếp khi cha mẹ chưa có tài khoản.
- Ứng dụng phụ huynh (MH-598): khối "Tháng N của con" tách thành `apps/parent/src/ai-tutor/AiTutorChildUsage.tsx`, hiện chung dưới hai tab, thêm số lượt con đã hỏi trong tháng và "Chủ đề nhiều nhất".
- Cổng quản trị (MH-599): mục "Báo cáo tháng" (`apps/portal/src/ai-tutor/AiTutorSchoolReport.tsx`) theo hai ô số của bản mẫu: lượt hỏi tháng, token tháng vào hóa đơn dịch vụ; dòng chi tiết theo nguồn gói.
- Kiểm thử: `apps/api/src/ai-tutor/parent-requests.test.ts` (CT-2030 đến CT-2033, máy chủ API nhiều trường thật, bộ giả lập nhà cung cấp); e2e `tests/e2e/145-gia-su-ai-hoan-thien.spec.ts` (CT-2034, CT-2035, dự án nhiều trường; biểu thức chọn spec nhiều trường thêm 145). Hồi quy trên máy ngày 30/10/2026: `apps/api/src/ai-tutor/*.test.ts` và `apps/api/src/ai-assistant/*.test.ts` 137/137 đạt; kiểm thử thuần ứng dụng học sinh 7/7 đạt; e2e 145 đạt 3/3.
- Tài liệu: `14_DAC_TA_GIAO_DIEN.md` (đoạn bổ sung MH-596 đến MH-599 dưới bảng 2.3), `17_DAC_TA_API.md` mục 17.13.

#### Quyết định

- Eric duyệt phạm vi lát L5 ngày 2026-10-30: nút "Gửi lời nhờ cha mẹ" khi hết lượt hoặc cần gói; màn hình phụ huynh xem chủ đề và số lượt, không bao giờ xem nội dung hội thoại hay trích đoạn; cờ an toàn đến cha mẹ cùng lúc với giáo viên chủ nhiệm, chỉ loại cờ, thời gian, lời khuyên (đã làm ở lát L3, lát L5 giữ nguyên); báo cáo cho trường về lượt dùng và token theo quy tắc tính của lát L2 (token của câu được hoàn lượt vẫn tính phí); bản mẫu MH-596, MH-598, MH-599 đã duyệt.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 (cần Eric xác nhận):
  - lý do nhờ do máy chủ xác định: chưa có gói đang dùng thì nhờ đăng ký, có gói mà hết lượt thì nhờ mua thêm lượt hoặc gia hạn; còn lượt thì không gửi được; em không tự gõ nội dung, thông báo là câu cố định có tên em, không có câu em đã hỏi;
  - mỗi lý do gửi tối đa một lần trong 24 giờ cho mỗi em; không thêm bảng mới, lần gửi đọc lại từ thông báo đã tạo; hai lần bấm cùng lúc chỉ tạo một thông báo;
  - người nhận là cha mẹ, người giám hộ có tài khoản liên kết với em (như thông báo cờ của lát L3); chưa có ai thì không tạo thông báo, em được nhắc nói trực tiếp;
  - gửi được cả khi gia sư đang khóa (thi, bài tập, khung giờ) vì không gọi nhà cung cấp và không dùng lượt; phiên xem hỗ trợ không gửi được;
  - thông báo cho cha mẹ chỉ là thông báo trong ứng dụng (không tin nhắn, không Zalo); ứng dụng phụ huynh chưa có liên kết từ thông báo tới trang Gia sư AI của con nên câu thông báo hướng dẫn mở mục Gia sư AI;
  - "Chủ đề nhiều nhất" là ba chủ đề có nhiều lượt đã trừ nhất trong tháng (giờ Việt Nam), chủ đề do gia sư đặt; khối "Tháng N của con" hiện chung cho hai nơi mua thay vì chỉ ở tab "Mua qua trường" như lát L1a, đúng vị trí trong bản mẫu MH-598;
  - báo cáo tháng: lượt hỏi là lượt đã trừ có thời điểm trừ trong tháng; token tính theo ngày giờ Việt Nam của câu trả lời, gồm câu được hoàn lượt; tách gói trường bán (vào hóa đơn dịch vụ) và gói nền tảng bán (chi phí của nền tảng, không tính cho trường); báo cáo không có số tiền vì số tiền phụ thuộc token miễn phí và phí tối thiểu dùng chung với trợ lý AI của giáo viên, xem ở hóa đơn dịch vụ; không có tên học sinh; quyền xem như trang Gia sư AI (`P01.integration.manage`).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-383, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` mục 2.3, `17_DAC_TA_API.md` mục 17.13, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Ứng dụng phụ huynh không chạy ở dự án e2e nhiều trường: e2e 145 kiểm phần cha mẹ bằng gọi thẳng máy chủ API (như e2e 142); giao diện khối "Tháng N của con" mới kiểm kiểu, chưa có e2e trên trình duyệt.
- Báo cáo cho nền tảng (toàn bộ các trường) chưa làm; phân loại token `tutor_school`, `tutor_platform` ở trang Trợ lý AI của cổng vận hành đã có từ lát L2.
- Các việc pháp lý và vận hành khi nền tảng bán thẳng (lát L1b) và thử lời nhắc có ảnh với mô hình thật (lát L4) vẫn chờ Eric.

## 24 Yêu cầu thay đổi

### YCTD-383: Gia sư AI trả phí, lát L5: lời nhờ cha mẹ, chủ đề và số lượt cho cha mẹ, báo cáo tháng cho trường – 2026-10-30

- Lý do: lát L5 của YCTD-383 theo danh sách lát Eric duyệt ngày 2026-10-30; Eric chọn để nút "Gửi lời nhờ cha mẹ" và màn hình phụ huynh xem chủ đề, số lượt ở lát này.
- Nội dung thay đổi: em chưa có gói hoặc hết lượt gửi lời nhờ cha mẹ, cha mẹ có tài khoản nhận thông báo trong ứng dụng, mỗi lý do một lần trong 24 giờ; cha mẹ thấy số lượt con đã hỏi trong tháng và ba chủ đề nhiều nhất, không thấy nội dung; trường xem báo cáo tháng: lượt hỏi, token theo nguồn gói, câu được hoàn lượt vẫn tính token.
- Thành phần bị ảnh hưởng: `apps/api/src/ai-tutor/parent-requests.ts`, `school-report.ts`, `tutor-chat.ts`, `tutor-chat.controller.ts`, `tutor-usage.ts`, `apps/api/src/dang-ky/yctd-383-l5-hoan-thien.ts`, `apps/student/src/ai-tutor/ParentRequestButton.tsx`, `StudentAiTutorCard.tsx`, `StudentAiTutorScreen.tsx`, `ai-tutor-api.ts`, `apps/parent/src/ai-tutor/AiTutorChildUsage.tsx`, `AiTutorPanel.tsx`, `apps/portal/src/ai-tutor/AiTutorSchoolReport.tsx`, `AiTutorSchoolPage.tsx`, `tests/e2e/145-gia-su-ai-hoan-thien.spec.ts`, `tests/e2e-multi-environment.mjs`, tài liệu 07, 10, 11, 14, 17, 21, 22, 27.
- Dữ liệu, API, quyền bị ảnh hưởng: không đổi cấu trúc dữ liệu (thông báo dùng bảng `notifications` có sẵn, hai mã mẫu mới `ai_tutor_parent_request_plan`, `ai_tutor_parent_request_turns`); `GET /student/ai-tutor` thêm `parent_request`; điểm cuối mới `POST /student/ai-tutor/parent-requests` (kênh student, `P02.learning.study`); `GET /children/{id}/ai-tutor/topics` thêm `top_topics`; điểm cuối mới `GET /ai-tutor/school/report` (`P01.integration.manage`); không đổi quyền có sẵn.
- Ảnh hưởng chức năng cũ: khối "Tháng N của con" ở MH-598 chuyển xuống dưới hai tab (trước đây chỉ ở tab "Mua qua trường"); hàm tổng hợp token của gia sư nhận thêm khoảng thời gian tùy chọn, việc nền ghi token gọi như cũ.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/api`, `apps/student`, `apps/parent`, `apps/portal`, `tests`; `apps/api/src/ai-tutor/*.test.ts`, `apps/api/src/ai-assistant/*.test.ts`; e2e 143, 144, 145 (dự án nhiều trường).
- Mức: Lớn (thuộc YCTD-383). Người phê duyệt: Eric, ngày 2026-10-30 (phạm vi lát L5, bản mẫu MH-596, MH-598, MH-599).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gia sư AI trả phí, lát L5: em gửi lời nhờ cha mẹ khi chưa có gói hoặc hết lượt; cha mẹ xem số lượt và chủ đề nhiều nhất của con; báo cáo tháng về lượt hỏi và token cho trường (YCTD-383).
- Không có database migration. Quay lui: triển khai lại bản trước; thông báo lời nhờ đã gửi giữ nguyên trong hộp thông báo của cha mẹ.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gia sư AI trả phí, lát L5: lời nhờ cha mẹ, chủ đề cho cha mẹ, báo cáo tháng cho trường | YCTD-383 |

## index Số đếm

| 10 | mã chức năng | +3 |
| 10 | còn hiệu lực | +3 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-530 | Gia sư AI, lời nhờ cha mẹ (YCTD-383 lát L5): em chưa có gói đang dùng thì nhờ cha mẹ đăng ký, có gói mà hết lượt thì nhờ mua thêm lượt hoặc gia hạn; còn lượt thì không gửi được; máy chủ tạo thông báo trong ứng dụng cho cha mẹ, người giám hộ có tài khoản liên kết với em, câu cố định có tên em, không có nội dung em gõ hay câu em đã hỏi; mỗi lý do một lần trong 24 giờ cho mỗi em; chưa có cha mẹ có tài khoản thì không gửi; gửi được cả khi gia sư đang khóa; phiên xem hỗ trợ không gửi được |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-531 | Gia sư AI, cha mẹ xem chủ đề và số lượt (YCTD-383 lát L5, Q6): cha mẹ, người giám hộ của con thấy số lượt đã dùng của gói tháng, lượt mua thêm còn lại, số lượt con đã hỏi trong tháng (lượt đã trừ, giờ Việt Nam), ba chủ đề có nhiều lượt nhất trong tháng; không bao giờ thấy nội dung câu hỏi, câu trả lời, trích đoạn hay ảnh; cờ tự hại, bị bắt nạt chỉ đến cha mẹ bằng thông báo riêng có loại cờ, thời gian, lời khuyên (BR-474) |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-532 | Gia sư AI, báo cáo tháng cho trường (YCTD-383 lát L5): theo quy tắc tính của BR-470; lượt hỏi là lượt đã trừ có thời điểm trừ trong tháng (giờ Việt Nam); token gồm mọi câu trả lời đã gọi nhà cung cấp trong tháng, kể cả câu được hoàn lượt; tách token của gói trường bán (vào hóa đơn dịch vụ) và gói nền tảng bán (chi phí của nền tảng, không tính cho trường); không có tên học sinh, không có nội dung, không có số tiền (xem hóa đơn dịch vụ); chỉ quản trị trường có quyền trang Gia sư AI xem |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-27 | Gia sư AI: gửi lời nhờ cha mẹ (YCTD-383 lát L5) | VT-21 (kênh student, `P02.learning.study`); VT-14 nhận thông báo | Số lượt của em, cha mẹ có tài khoản | Xác định lý do, chặn gửi lặp trong 24 giờ, tạo thông báo trong ứng dụng | Nút "Gửi lời nhờ cha mẹ" ở MH-596, MH-597; thông báo của cha mẹ; 422 `BR-530` | BR-530 |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-28 | Gia sư AI: cha mẹ xem số lượt và chủ đề nhiều nhất (YCTD-383 lát L5) | VT-14 (người giám hộ của con) | Con | Đếm lượt đã trừ trong tháng, ba chủ đề nhiều lượt nhất | Khối "Tháng N của con" ở MH-598 | BR-531 |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-29 | Gia sư AI: báo cáo tháng cho trường (YCTD-383 lát L5) | Quản trị trường (`P01.integration.manage`) | Tháng | Đếm lượt hỏi, học sinh, tổng hợp token theo nguồn gói bằng hàm dùng chung với việc nền ghi token | Mục "Báo cáo tháng" ở MH-599 | BR-532 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1380 | Cho em chưa có gói, mẹ có tài khoản ứng dụng phụ huynh / Khi em bấm "Gửi lời nhờ cha mẹ" / Thì mẹ nhận thông báo "Gia sư AI: con nhờ cha mẹ" có tên em và lời nhờ đăng ký gói; em thấy "Đã gửi lời nhờ cha mẹ lúc …", nút ẩn; gửi lại trong 24 giờ bị từ chối 422 `BR-530`, không thêm thông báo (CT-2030, CT-2034; YCTD-383 lát L5) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1381 | Cho em có gói / Khi em còn lượt, rồi hỏi hết lượt và bấm "Gửi lời nhờ cha mẹ" / Thì lúc còn lượt bị từ chối 422 và không có nút; hết lượt thì mẹ nhận lời nhờ mua thêm lượt hoặc gia hạn, thông báo không có câu em đã hỏi, phụ huynh khác không nhận; sau 24 giờ gửi lại được (CT-2031, CT-2034; YCTD-383 lát L5) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1382 | Cho em chưa có cha mẹ có tài khoản, hoặc em bấm hai lần cùng lúc, hoặc giáo viên, phụ huynh gọi điểm cuối của em / Khi gửi lời nhờ / Thì em chưa có cha mẹ có tài khoản nhận 422 kèm lời nhắc nói trực tiếp, không tạo thông báo; hai lần cùng lúc chỉ tạo một thông báo; giáo viên, phụ huynh bị từ chối (CT-2030; YCTD-383 lát L5) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1383 | Cho con đã hỏi ba lượt về hai chủ đề và một câu ngoài học tập / Khi cha mẹ mở Gia sư AI của con / Thì thấy con đã hỏi 3 lượt trong tháng, chủ đề nhiều nhất theo thứ tự số lượt; không có nội dung câu hỏi, câu trả lời, trích đoạn; phụ huynh khác bị từ chối 403 (CT-2032, CT-2034; YCTD-383 lát L5) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1384 | Cho tháng có lượt dùng từ gói trường bán, gói nền tảng bán và một câu được hoàn lượt / Khi quản trị trường xem báo cáo tháng / Thì lượt hỏi chỉ đếm lượt đã trừ; token tách gói trường bán (vào hóa đơn dịch vụ) và gói nền tảng bán, khớp tổng token của các câu trả lời, gồm cả câu được hoàn lượt; không có tên học sinh; tháng khác không có số liệu; tháng sai dạng 400; giáo viên 403; trang Gia sư AI hiện "Lượt hỏi tháng N", "Token tháng N (vào hóa đơn dịch vụ)" (CT-2033, CT-2035; YCTD-383 lát L5) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2030 | P05-27 | Em chưa có gói, mẹ có tài khoản: xem trang, gửi, gửi lại; em khác bấm hai lần cùng lúc; em chưa có cha mẹ có tài khoản; giáo viên, phụ huynh gọi điểm cuối của em | `parent_request.reason` `no_plan`; 201 `notified` 1, mẹ có thông báo đúng tiêu đề, câu nhờ đăng ký, không gọi nhà cung cấp; lần hai 422 "đã gửi … gửi lại được sau", vẫn một thông báo; hai lần cùng lúc một 201, một 422, một thông báo; 422 "chưa có tài khoản ứng dụng phụ huynh", không có thông báo; 401 hoặc 403 | Kiểm thử tự động `apps/api/src/ai-tutor/parent-requests.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2031 | P05-27 | Em có gói lượt 1 lượt: gửi khi còn lượt; hỏi một câu; gửi; gửi lại; lùi thông báo 25 giờ rồi gửi | 422 "còn lượt hỏi"; 201 `captured`; `reason` `no_turns`, 201, mẫu `ai_tutor_parent_request_turns`, câu nhờ mua thêm lượt hoặc gia hạn, không có câu em hỏi, phụ huynh khác không nhận; 422; 201, hai thông báo | Kiểm thử tự động `parent-requests.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2032 | P05-28 | Em (gói nền tảng) hỏi hai câu chủ đề "Phương trình bậc nhất", một câu "Định lý Pytago", một câu ngoài học tập; cha mẹ, phụ huynh khác xem chủ đề | `turns_this_month` 3; `top_topics` đúng thứ tự, không có câu ngoài học tập; không có câu hỏi, câu trả lời; phụ huynh khác 403 | Kiểm thử tự động `parent-requests.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2033 | P05-29 | Báo cáo tháng này, tháng sau, tháng `2026-13`; giáo viên, phụ huynh xem báo cáo | Lượt hỏi 4 (trường 1, nền tảng 3), học sinh 2, câu được hoàn lượt có token 1, token từng nguồn khớp tổng token câu trả lời; tháng sau 0; 400; giáo viên 403; phụ huynh 401 hoặc 403 | Kiểm thử tự động `parent-requests.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2034 | P05-27, P05-28 | Em chưa có gói bấm "Gửi lời nhờ cha mẹ" ở trang chủ; em có gói một lượt hỏi một câu, bấm "Gửi lời nhờ cha mẹ" ở trang Gia sư AI; cha mẹ xem thông báo và chủ đề | "Đã gửi lời nhờ cha mẹ lúc", nút ẩn; mẹ có thông báo nhờ đăng ký; "Em đã dùng hết lượt hỏi", gửi được; mẹ có thông báo nhờ mua thêm; `turns_this_month` 1, chủ đề "Phương trình bậc nhất một ẩn", không có câu em hỏi | e2e `tests/e2e/145-gia-su-ai-hoan-thien.spec.ts` (dự án nhiều trường) | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2035 | P05-29 | Hiệu trưởng mở trang Gia sư AI của cổng quản trị | Mục "Báo cáo tháng" có "Lượt hỏi tháng N" ít nhất 1, "Token tháng N (vào hóa đơn dịch vụ)", dòng "không tính cho trường" | e2e `tests/e2e/145-gia-su-ai-hoan-thien.spec.ts` (dự án nhiều trường) | Đạt |
| 22_BAO_MAT.md | BM-141 | BM-270 | Gia sư AI, lời nhờ cha mẹ và báo cáo (YCTD-383 lát L5, BR-530, BR-531, BR-532): em không gõ nội dung lời nhờ, thông báo là câu cố định có tên em, không có câu em đã hỏi; chỉ gửi cho tài khoản cha mẹ có liên kết với em; giới hạn một lần mỗi lý do trong 24 giờ, khóa theo em trong giao dịch để không gửi trùng; phiên xem hỗ trợ không gửi được; trang chủ đề của cha mẹ không có nội dung, trích đoạn, ảnh; báo cáo của trường chỉ có số tổng, không có tên học sinh, chỉ quyền `P01.integration.manage` |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-383 lát L5 | Gia sư AI trả phí, lát L5: lời nhờ cha mẹ, chủ đề cho cha mẹ, báo cáo tháng cho trường | {PHIEN_BAN} | P05-27, P05-28, P05-29 | AC-1380 đến AC-1384 | CT-2030 đến CT-2035 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/ai-tutor/parent-requests.ts`, `school-report.ts`, `apps/student/src/ai-tutor/ParentRequestButton.tsx`, `apps/parent/src/ai-tutor/AiTutorChildUsage.tsx`, `apps/portal/src/ai-tutor/AiTutorSchoolReport.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 30/10/2026; CI của PR |
