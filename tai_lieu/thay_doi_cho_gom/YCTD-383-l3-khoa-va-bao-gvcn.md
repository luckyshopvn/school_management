---
yctd: YCTD-383
tieu_de: Gia sư AI trả phí, lát L3: khóa theo phòng thi, bài tập, khung giờ; báo giáo viên chủ nhiệm
ngay: 2026-10-30
phien_ban_de_xuat: 0.253.0
---

## 02 Nhật ký

### 2026-10-30 — Gia sư AI trả phí, lát L3: khóa theo phòng thi, bài tập, khung giờ; báo giáo viên chủ nhiệm (YCTD-383)

#### Công việc đã thực hiện

- Máy chủ API: điểm kiểm tra khóa `apps/api/src/ai-tutor/ai-tutor-access.ts` thêm ba khóa (đang thi, bài tập không dùng AI, khung giờ) kèm tiêu đề và lý do theo bản mẫu MH-597; nguồn dữ liệu ở `ai-tutor-locks.ts` (thi trực tuyến DT-23, bài tập trực tuyến DT-28, cài đặt Gia sư AI 0132); `tutor-chat.ts` kiểm khóa trước khi giữ lượt, trang của em trả trạng thái khóa.
- Báo giáo viên chủ nhiệm: `apps/api/src/ai-tutor/safety-flags.ts`, `safety-flags.controller.ts` (đăng ký ở `apps/api/src/dang-ky/yctd-383-l3-khoa-bao-gvcn.ts`): tạo thông báo trong ứng dụng ngay khi có cờ, việc nền báo lại cờ chưa báo; danh sách cờ và đánh dấu đã xử lý; nhật ký thao tác.
- Bài tập trực tuyến: `assignment-rules.ts`, `assignments.ts` nhận `ai_blocked` khi lưu bài và khi đổi cài đặt sau phát hành.
- Ứng dụng học sinh: trang Gia sư AI hiện trạng thái khóa (tiêu đề đậm, lý do, giờ mở lại); vẫn báo được câu trả lời sai khi bị khóa vì thi, bài tập, khung giờ.
- Ứng dụng giáo viên: công tắc "Không dùng AI" ở màn hình soạn bài tập và ở bài đã giao (`AssignmentScreen.tsx`); màn hình mới "Gia sư AI: cờ cần xử lý" (MH-601, `AiTutorFlagsScreen.tsx`), nút ở màn hình Lớp của tôi chỉ hiện khi có cờ.
- Cổng quản trị, trang Gia sư AI (`/ai-tutor`, MH-599): ghi chú khung giờ theo giờ Việt Nam và các khóa; mục "Cờ cần xử lý của lớp chưa có giáo viên chủ nhiệm" cho Hiệu trưởng, Phó Hiệu trưởng (ẩn khi không có cờ). Khung giờ khóa vẫn chỉnh ở biểu mẫu cài đặt có sẵn của lát L1a.
- Database migration: hệ thống `0134_add_ai_tutor_safety_flag_resolution`.
- Kiểm thử: `apps/api/src/ai-tutor/ai-tutor-access.test.ts` (CT-1779), `ai-tutor-locks.test.ts` (CT-1780 đến CT-1786); e2e `tests/e2e/144-gia-su-ai-khoa.spec.ts` (CT-1787, dự án nhiều trường; biểu thức chọn spec nhiều trường thêm 144). Kiểm thử lát L2 `tutor-chat.test.ts`, e2e 143 đặt khung giờ khóa cách giờ chạy sáu tiếng để không phụ thuộc giờ chạy; ca CT-1773 đổi kỳ vọng `notified_at` từ trống sang đã báo.

#### Quyết định

- Eric duyệt phương án, bản mẫu MH-597 (trạng thái khóa) và danh sách lát ngày 2026-10-30; quyết định Q7 giữ cả bốn khóa và báo.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 (chọn phương án an toàn nhất cho học sinh, cần Eric xác nhận):
  - đang thi gồm ba trường hợp: em có lượt làm bài kiểm tra trực tuyến chưa hết giờ; em có tên trong phòng thi chưa đóng, chưa hết hạn; bài kiểm tra trực tuyến giao cho lớp hoặc cho em đang trong giờ mở mà em còn lượt làm. Trường hợp thứ ba khóa suốt giờ mở của bài (bài thi từ xa mở nhiều ngày thì khóa nhiều ngày) đến khi em dùng hết lượt làm;
  - bài kiểm tra trên giấy không có lịch thi trong hệ thống (bảng `exam_sessions` là đợt chấm, không có giờ thi) nên không khóa theo bài trên giấy;
  - gia sư AI chưa có ngữ cảnh bài tập (em hỏi theo môn), nên chọn cách chặt chẽ hơn: khóa toàn bộ gia sư, mọi môn, trong thời gian em còn bài tập "Không dùng AI" đang mở với em. "Đang mở" theo đúng quy tắc nộp của bài: đã phát hành, đã đến giờ mở, em không được miễn, chưa đóng, còn lần nộp, chưa quá hạn khi bài chặn nộp muộn. Bài cho nộp muộn không có giờ đóng thì khóa đến khi em nộp đủ số lần;
  - giáo viên bật, tắt "Không dùng AI" được cả sau khi đã giao bài;
  - thứ tự khi nhiều khóa cùng lúc: chỉ đọc, đang thi, bài tập, khung giờ; khung giờ tính cả phút bắt đầu, không tính phút kết thúc (22:00 khóa, 6:00 mở); khung giờ của trường áp dụng cho cả gói nền tảng bán;
  - lớp chưa có giáo viên chủ nhiệm (hoặc em chưa xếp lớp) thì báo Hiệu trưởng (VT-02) và Phó Hiệu trưởng (VT-15) của đơn vị: hai vai trò sẵn có có quyền quản lý hồ sơ học sinh (`P02.child.manage`) và chịu trách nhiệm chung về học sinh; không chọn VT-03 (quản lý đơn vị) và VT-12 (tuyển sinh);
  - thông báo chỉ có tên em, lớp và lời nhắc mở danh sách cờ, không có loại dấu hiệu, không có câu em gửi; thông báo đẩy vốn chỉ có câu chung của nhóm "Thông báo";
  - quyền xem cờ tính lúc xem theo lớp hiện tại của em: em chuyển lớp thì giáo viên chủ nhiệm lớp mới thấy; lớp có giáo viên chủ nhiệm thì Ban Giám hiệu không thấy cờ của lớp đó trong danh sách;
  - đoạn trích tối đa 160 ký tự của chính câu em gửi;
  - lỗi khi tạo thông báo không làm hỏng câu trả lời của em; việc nền 10 phút một lần báo lại cờ chưa báo;
  - lúc bị khóa (thi, bài tập, khung giờ) em không gửi được câu nào, kể cả câu có dấu hiệu tự hại, nên trạng thái khóa có thêm dòng cố định nhắc em nói với bố mẹ, thầy cô hoặc gọi Tổng đài 111; câu chữ này chưa có trong bản mẫu MH-597.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-383, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md` mục 18S, `17_DAC_TA_API.md` mục 17.3 (bài tập), 17.13, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Eric xác nhận các lựa chọn ở mục Quyết định, đặc biệt: khóa suốt giờ mở của bài kiểm tra trực tuyến (kể cả bài thi từ xa nhiều ngày); khóa toàn bộ gia sư khi có bài tập "Không dùng AI" đang mở; người nhận thay khi lớp chưa có giáo viên chủ nhiệm là VT-02, VT-15.
- Bài kiểm tra trên giấy chưa có lịch thi để khóa; cần chức năng lịch thi nếu muốn khóa theo ca thi trên giấy.
- Giáo viên chủ nhiệm chưa có thông báo đẩy riêng cho cờ (dùng nhóm "Thông báo chung").

## 24 Yêu cầu thay đổi

### YCTD-383: Gia sư AI trả phí, lát L3: khóa theo phòng thi, bài tập, khung giờ; báo giáo viên chủ nhiệm – 2026-10-30

- Lý do: lát L3 của YCTD-383 theo danh sách lát Eric duyệt ngày 2026-10-30 (Q7).
- Nội dung thay đổi: gia sư AI khóa khi em đang thi (lượt làm bài, phòng thi, bài kiểm tra trực tuyến đang mở), khi em còn bài tập giáo viên đánh dấu "Không dùng AI" đang mở, và trong khung giờ khóa của trường (mặc định 22:00 đến 6:00 giờ Việt Nam); khóa kiểm ở máy chủ trước khi giữ lượt, câu bị khóa không trừ lượt; cờ tự hại, bị bắt nạt báo giáo viên chủ nhiệm (không có thì Hiệu trưởng, Phó Hiệu trưởng), giáo viên xem danh sách cờ và đánh dấu đã xử lý; giáo viên bật "Không dùng AI" ở bài tập.
- Thành phần bị ảnh hưởng: `apps/api/src/ai-tutor/ai-tutor-access.ts`, `ai-tutor-locks.ts`, `safety-flags.ts`, `safety-flags.controller.ts`, `tutor-chat.ts`, `apps/api/src/dang-ky/yctd-383-l3-khoa-bao-gvcn.ts`, `apps/api/src/learning/assignments/assignment-rules.ts`, `assignments.ts`, `database/system/migrations/0134_add_ai_tutor_safety_flag_resolution.ts`, `database/system/schema-parts/yctd-383-l2-tro-chuyen.ts`, `apps/student/src/ai-tutor/StudentAiTutorScreen.tsx`, `ai-tutor-api.ts`, `apps/teacher/src/screens/AssignmentScreen.tsx`, `AiTutorFlagsScreen.tsx`, `ClassesScreen.tsx`, `apps/teacher/src/Application.tsx`, `apps/portal/src/ai-tutor/AiTutorSchoolPage.tsx`, `tests/e2e/143-gia-su-ai-tro-chuyen.spec.ts`, `tests/e2e/144-gia-su-ai-khoa.spec.ts`, `tests/e2e-multi-environment.mjs`, tài liệu 07, 10, 11, 14, 16, 17, 21, 27.
- Dữ liệu, API, quyền bị ảnh hưởng: ba cột mới của `ai_tutor_safety_flags` (hệ thống); `access` của `GET /student/ai-tutor` có thêm `title` và ba mã khóa; trường `ai_blocked` của `PUT`, `PATCH /learning/activities/{id}/assignment`; điểm cuối mới `GET /ai-tutor/safety-flags`, `POST /ai-tutor/safety-flags/{id}/resolve` (mã phiên của nhân viên, không gắn quyền mới, máy chủ lọc theo lớp chủ nhiệm và vai trò VT-02, VT-15); không đổi quyền có sẵn.
- Ảnh hưởng chức năng cũ: học sinh không hỏi được gia sư AI trong khung giờ khóa mặc định 22:00 đến 6:00 (trước lát L3 hỏi được mọi giờ); cờ cảnh báo được báo ngay thay vì chờ.
- Kiểm thử cần thực hiện: kiểm kiểu các gói bị chạm; `apps/api/src/ai-tutor/*.test.ts`, `apps/api/src/learning/assignments/*.test.ts`; e2e 143, 144 (dự án nhiều trường).
- Mức: Lớn (thuộc YCTD-383). Người phê duyệt: Eric, ngày 2026-10-30 (phương án, bản mẫu MH-597, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gia sư AI trả phí, lát L3: khóa khi đang thi, khi có bài tập "Không dùng AI" đang mở, theo khung giờ của trường; báo giáo viên chủ nhiệm khi có cờ tự hại, bị bắt nạt (YCTD-383).
- Database migration: hệ thống `0134_add_ai_tutor_safety_flag_resolution`. Quay lui: chạy `down` (xóa chỉ mục và ba cột đánh dấu đã xử lý); thông báo đã tạo giữ nguyên; bản trước của máy chủ không khóa theo thi, bài tập, khung giờ.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gia sư AI trả phí, lát L3: khóa theo phòng thi, bài tập, khung giờ; báo giáo viên chủ nhiệm | YCTD-383 |

## index Số đếm

| 14 | màn hình | +1 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-471 | Gia sư AI, khóa khi đang thi (YCTD-383 lát L3, Q7): em có lượt làm bài kiểm tra trực tuyến chưa hết giờ, có tên trong phòng thi chưa đóng và chưa hết hạn, hoặc bài kiểm tra trực tuyến giao cho lớp hay cho em đang trong giờ mở mà em còn lượt làm thì gia sư AI khóa; nộp bài hết lượt hoặc hết giờ mở thì mở lại; khóa kiểm ở máy chủ trước khi giữ lượt, câu bị khóa không trừ lượt |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-472 | Gia sư AI, bài tập không dùng AI (YCTD-383 lát L3, Q7): giáo viên bật "Không dùng AI" khi soạn hoặc sau khi giao bài tập trực tuyến; trong thời gian bài còn mở với em (đã phát hành, đã đến giờ mở, em không được miễn, chưa đóng, còn lần nộp, chưa quá hạn khi bài chặn nộp muộn) gia sư AI khóa toàn bộ, mọi môn |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-473 | Gia sư AI, khung giờ khóa (YCTD-383 lát L3, Q7): theo giờ Việt Nam, mặc định 22:00 đến 6:00, trường đổi ở trang Gia sư AI của cổng quản trị; tính cả phút bắt đầu, không tính phút kết thúc; giờ bắt đầu lớn hơn giờ kết thúc là khung qua nửa đêm; áp dụng cho cả gói trường bán và gói nền tảng bán. Nhiều khóa cùng lúc thì báo theo thứ tự: đang thi, bài tập, khung giờ |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-474 | Gia sư AI, báo giáo viên chủ nhiệm (YCTD-383 lát L3, Q7): cờ tự hại hoặc bị bắt nạt tạo thông báo trong ứng dụng cho giáo viên chủ nhiệm của lớp hiện tại của em; lớp chưa có giáo viên chủ nhiệm thì cho Hiệu trưởng, Phó Hiệu trưởng của đơn vị; thông báo không có loại dấu hiệu và câu em gửi; giáo viên chỉ thấy học sinh, lớp, loại dấu hiệu, thời điểm, đoạn trích tối đa 160 ký tự của câu em gửi, không thấy hội thoại; đánh dấu đã xử lý; báo và đánh dấu ghi nhật ký thao tác; cha mẹ không thấy cờ |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-22 | Gia sư AI: khóa theo phòng thi, bài tập, khung giờ (YCTD-383 lát L3) | Hệ thống (điểm kiểm tra khóa), VT-21 xem trạng thái khóa | Lượt làm bài, phòng thi, bài kiểm tra trực tuyến, bài tập không dùng AI, khung giờ của trường | Kiểm khóa trước khi giữ lượt; trả mã khóa, tiêu đề, lý do | Trạng thái khóa ở trang Gia sư AI (MH-597); 422 có mã khóa | BR-471, BR-472, BR-473 |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-23 | Gia sư AI: giáo viên đánh dấu bài tập "Không dùng AI" (YCTD-383 lát L3) | Giáo viên dạy lớp học trực tuyến (`P02.learning.teach`) | Cờ `ai_blocked` của bài tập | Lưu khi soạn bài; đổi sau khi giao | Công tắc ở màn hình soạn bài tập và bài đã giao (ứng dụng giáo viên) | BR-472 |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-24 | Gia sư AI: báo giáo viên chủ nhiệm, danh sách cờ cần xử lý (YCTD-383 lát L3) | Hệ thống (báo); VT-07 chủ nhiệm, VT-02, VT-15 (lớp chưa có chủ nhiệm) | Cờ cảnh báo | Tạo thông báo, báo lại cờ chưa báo; liệt kê cờ trong phạm vi; đánh dấu đã xử lý; ghi nhật ký | Thông báo trong ứng dụng; MH-601; mục cờ ở trang Gia sư AI của cổng quản trị (MH-599) | BR-474 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1196 | Cho khung giờ mặc định 22:00 đến 6:00 giờ Việt Nam / Khi em mở gia sư lúc 21:59, 22:00, 05:59, 06:00 / Thì 21:59 và 06:00 dùng được, 22:00 và 05:59 khóa với "Ngoài giờ dùng. Gia sư AI mở lại lúc 6:00."; trường đổi khung giờ thì khóa theo khung mới (CT-1779, CT-1780, CT-1781, CT-1787; YCTD-383 lát L3) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1197 | Cho lớp của em có bài kiểm tra trực tuyến đang mở, em đang làm bài, hoặc em có tên trong phòng thi đang mở / Khi em mở gia sư / Thì gia sư khóa với "Đang trong giờ kiểm tra." và tên bài; lớp khác không bị khóa; em nộp hết lượt, bài hết giờ mở hoặc phòng đóng thì mở lại (CT-1782, CT-1787; YCTD-383 lát L3) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1198 | Cho em được giao bài tập "Không dùng AI" còn mở / Khi em mở gia sư / Thì gia sư khóa với "Bài tập này không dùng AI." và tên bài; em không được giao, được miễn, đã nộp đủ lần, bài đóng hoặc giáo viên tắt cờ thì không khóa vì bài (CT-1783; YCTD-383 lát L3) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1199 | Cho gia sư đang khóa vì bất kỳ lý do nào / Khi em gửi câu hỏi / Thì máy chủ trả 422 có mã khóa, không tạo dòng sổ lượt, số lượt không đổi, không gọi nhà cung cấp (CT-1780 đến CT-1783; YCTD-383 lát L3) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1200 | Cho giáo viên soạn bài tập / Khi bật "Không dùng AI" rồi lưu, hoặc đổi sau khi giao / Thì cờ được lưu; màn hình cũ không gửi cờ thì giữ cờ đã có; giá trị không phải đúng, sai thì bị từ chối (CT-1784; YCTD-383 lát L3) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1201 | Cho em gửi câu có dấu hiệu tự hại hoặc bị bắt nạt / Khi máy chủ ghi cờ / Thì giáo viên chủ nhiệm lớp của em nhận thông báo trong ứng dụng (lớp chưa có chủ nhiệm thì Hiệu trưởng, Phó Hiệu trưởng), thông báo không có loại dấu hiệu và câu em gửi, có nhật ký thao tác; cờ chưa báo được thì việc nền báo lại, không báo trùng (CT-1785; YCTD-383 lát L3) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1202 | Cho cờ của em lớp 8A / Khi giáo viên chủ nhiệm 8A, giáo viên chủ nhiệm lớp khác, giáo viên bộ môn, cha mẹ, học sinh xem / Thì chủ nhiệm 8A thấy học sinh, lớp, loại dấu hiệu, thời điểm, đoạn trích (không có hội thoại) và đánh dấu được đã xử lý (có nhật ký); người khác thấy danh sách trống, đánh dấu bị 404; học sinh bị 403; cha mẹ không thấy cờ ở trang chủ đề (CT-1786; YCTD-383 lát L3) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.2 Ứng dụng giáo viên | MH-601 | Gia sư AI: cờ cần xử lý (YCTD-383 lát L3): nút "Gia sư AI: cờ cần xử lý (số chưa xử lý)" ở Lớp của tôi chỉ hiện khi có cờ; danh sách cờ chưa xử lý lên trước: học sinh, lớp, nhãn loại dấu hiệu, thời điểm, đoạn trích câu em gửi, nút Đã xử lý; cờ đã xử lý ghi người và lúc xử lý. Màn hình soạn bài tập có công tắc "Không dùng AI" (cả khi đã giao) | VT-07 chủ nhiệm |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1779 | P05-22 | Hàm thuần: giờ Việt Nam từ giờ UTC, biên 21:59, 22:00, 05:59, 06:00, khung trong ngày, khung bằng nhau, thông báo khóa, thứ tự khóa, đoạn trích 160 ký tự | Đúng từng trường hợp | Kiểm thử tự động `apps/api/src/ai-tutor/ai-tutor-access.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1780 | P05-22 | Đồng hồ máy chủ lúc 21:59, 22:00, 05:59, 06:00 giờ Việt Nam, em có gói hỏi bài | 21:59, 06:00 mở; 22:00, 05:59 khóa `quiet_hours`, gửi 422, không có dòng sổ lượt, số lượt không đổi, không gọi nhà cung cấp; 06:00 gửi 201, trừ một lượt | Kiểm thử tự động `apps/api/src/ai-tutor/ai-tutor-locks.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1781 | P05-22 | Trường đặt khung 21:00 đến 07:00 ở cổng quản trị; 21:30, 06:30, 07:00 | 21:30, 06:30 khóa "mở lại lúc 7:00"; 07:00 mở | Kiểm thử tự động `ai-tutor-locks.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1782 | P05-22 | Bài kiểm tra trực tuyến của 8A mở 9:00 đến 11:00; lượt làm còn giờ lúc 11:00; nộp xong; em 8B có tên trong phòng thi đang mở, rồi phòng đóng | Khóa `exam` có tên bài; 8B không khóa; 11:00 mở; lượt đang làm khóa; nộp xong mở; phòng thi khóa em 8B; phòng đóng mở | Kiểm thử tự động `ai-tutor-locks.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1783 | P05-22 | Bài tập "Không dùng AI" giao cho em 8A: tắt, bật cờ; miễn; bản nháp; nộp; bài cho nộp hai lần lúc 22:30; đóng bài | Khóa `assignment` có tên bài; em 8B mở; tắt cờ mở; miễn mở; bản nháp vẫn khóa; nộp xong mở; còn lần nộp thì khóa bài tập trước khung giờ; đóng bài thì khóa khung giờ | Kiểm thử tự động `ai-tutor-locks.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1784 | P05-23 | Lưu bài có `ai_blocked: true`; lưu lại không gửi cờ; gửi `'co'`; PATCH `false`; PATCH `1` | 200 cờ bật; cờ giữ nguyên; 400; 200 cờ tắt; 422 | Kiểm thử tự động `ai-tutor-locks.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1785 | P05-24 | Em 8A (có chủ nhiệm) gửi câu tự hại; em 8C (chưa có chủ nhiệm) gửi câu bị bắt nạt; việc nền với cờ chưa báo | Thông báo cho chủ nhiệm 8A, không có loại dấu hiệu và câu em gửi; cờ 8C báo VT-02, VT-15 của đơn vị; nhật ký `notified_to`; việc nền báo một cờ, lần sau không báo trùng | Kiểm thử tự động `ai-tutor-locks.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1786 | P05-24 | Chủ nhiệm 8A, chủ nhiệm 8B, giáo viên bộ môn 8A, cha mẹ, học sinh, Hiệu trưởng xem cờ; chủ nhiệm 8A đánh dấu đã xử lý | Chủ nhiệm 8A thấy đúng các trường (không có hội thoại); người khác danh sách trống, đánh dấu 404; học sinh 403; Hiệu trưởng chỉ thấy cờ 8C; đã xử lý có nhật ký đúng người; trang chủ đề của cha mẹ không có cờ | Kiểm thử tự động `ai-tutor-locks.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1787 | P05-22 | Em có gói, lớp có bài kiểm tra trực tuyến đang mở mở trang Gia sư AI; trường đặt khung giờ khóa trùm giờ chạy | "Đang trong giờ kiểm tra." và tên bài, ô câu hỏi và nút Gửi tắt, còn 10/10 lượt; "Ngoài giờ dùng." và giờ mở lại | e2e `tests/e2e/144-gia-su-ai-khoa.spec.ts` (dự án nhiều trường) | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-383 lát L3 | Gia sư AI trả phí, lát L3: khóa theo phòng thi, bài tập, khung giờ; báo giáo viên chủ nhiệm | {PHIEN_BAN} | P05-22, P05-23, P05-24 | AC-1196 đến AC-1202 | CT-1779 đến CT-1787 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/ai-tutor/ai-tutor-access.ts`, `ai-tutor-locks.ts`, `safety-flags.ts`, `apps/teacher/src/screens/AiTutorFlagsScreen.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 30/10/2026; CI của PR |
