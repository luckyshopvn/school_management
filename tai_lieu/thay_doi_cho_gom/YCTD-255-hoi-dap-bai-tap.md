---
yctd: YCTD-255
tieu_de: DT-27 phần 27e: hỏi đáp bài tập của chương trình gia sư, gợi ý AI nháp
ngay: 2026-10-27
phien_ban_de_xuat: 0.166.0
---

## 02 Nhật ký

### 2026-10-27 — DT-27 phần 27e: hỏi đáp bài tập của chương trình gia sư

#### Công việc đã thực hiện

- Đọc mục 19.4, 19.5 (27e) và 20.7 (28e) của `32_KE_HOACH_THEO_HE_THONG_SO.md`; 27e xây trên bộ máy hỏi đáp 28e (PR 207) và khoá học ghi sẵn 27d1 (PR 208).
- Năm học `0201`: `tutoring_programs.answer_hours`, `tutoring_question_marks`, `tutoring_ai_answers`, `tutoring_ai_consents`. Hệ thống `0120`: thêm loại yêu cầu AI `answer`.
- Máy chủ `apps/api/src/tutoring/tutoring-questions.ts`: hàng chờ theo chương trình, thời hạn trả lời theo chương trình, gợi ý AI nháp, gửi câu trả lời có dấu "có AI hỗ trợ", học sinh đánh dấu đã hiểu, cha mẹ xem câu hỏi của con và bật tắt AI cho con. `AiAssistantService.draftAnswer` và mẫu lời nhắc `buildAnswerPrompt` ở 23d.
- Giao diện: khối Hỏi đáp bài tập ở trang Chương trình gia sư (cổng quản trị); Hỏi đáp bài tập của con (ứng dụng phụ huynh); Hỏi đáp bài tập ở trang chủ học sinh (kênh student).
- Kiểm thử: CT-27e-1 đến CT-27e-3.

#### Quyết định

- Câu hỏi, trả lời, xác nhận câu trả lời, lọc thông tin liên lạc, báo cáo, giờ mở dùng bộ máy hỏi đáp 28e ở khoá học ghi sẵn của chương trình; 27e không dựng bảng câu hỏi thứ hai.
- Migration năm học `0201` (không phải `0158`, `0159` của kế hoạch) vì khoá ngoại tới bảng của 28e (`0182`); hệ thống `0120` (không phải dải `0100` đến `0109`) vì phải chạy sau `0111` của 28c cùng ràng buộc loại yêu cầu AI.
- Gợi ý AI qua `AiProvider` của 23d: lời nhắc chỉ có cấp, môn, chữ của câu hỏi và ghi chú của giáo viên đã quét dữ liệu cá nhân; không gửi ảnh, không gửi tên học sinh; có dữ liệu cá nhân thì từ chối. Nhật ký và hạn mức theo 23d. Bản nháp không lưu vào câu hỏi; giáo viên sửa rồi mới gửi.
- Phụ huynh tắt AI cho con; chưa chọn thì cho phép (mặc định của trường); trường tắt AI thì không có nút gợi ý.
- Học sinh báo chưa hiểu thì câu trở lại hàng chờ cho đến khi giáo viên trả lời thêm.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-255, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-370, PQ-155, P02-120, AC-1035 đến AC-1037, MH-490, CT-1325 đến CT-1327.

#### Vấn đề tồn đọng

- Ảnh trong câu hỏi, câu trả lời và liên kết học liệu, câu trong ngân hàng chưa làm vì bộ máy hỏi đáp 28e chưa có tệp đính kèm; nhắc quá hạn chỉ hiện trong hàng chờ, chưa gửi thông báo.

## 24 Yêu cầu thay đổi

### YCTD-255: DT-27 phần 27e: hỏi đáp bài tập của chương trình gia sư, gợi ý AI nháp – 2026-10-27

- Lý do: phần 27e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 19.4, 19.5, xây trên bộ máy hỏi đáp của 28e (YCTD-270, YCTD-275) sau khi 28e gộp (PR 207). Phiên điều phối giao ngày 2026-10-27.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Hỏi**: học sinh hỏi ở khoá học ghi sẵn của chương trình (27d1) bằng hỏi đáp của 28e (lọc thông tin liên lạc, giờ mở, báo cáo như mọi câu hỏi).
  - **Hàng chờ của giáo viên**: câu hỏi của chương trình mình dạy (Ban Giám hiệu thấy mọi chương trình), câu chưa có giáo viên trả lời hoặc học sinh báo chưa hiểu sau câu trả lời mới nhất; thời hạn trả lời theo chương trình (mặc định 48 giờ, từ 1 đến 336 giờ, năm học `0201`); quá hạn hiện trong hàng chờ.
  - **Gợi ý bằng AI**: bản nháp chỉ giáo viên thấy, qua bộ nối AI của 23d (loại yêu cầu `answer`, hệ thống `0120`); lời nhắc chỉ có cấp, môn, chữ của câu hỏi, ghi chú của giáo viên sau khi quét dữ liệu cá nhân; không gửi ảnh, tên học sinh; nhật ký, hạn mức theo 23d. Câu trả lời gửi từ bản nháp của chính giáo viên mang dấu "có AI hỗ trợ" (`tutoring_ai_answers`).
  - **Học sinh**: xem câu trả lời, báo đã hiểu hoặc chưa hiểu (`tutoring_question_marks`).
  - **Cha mẹ**: xem câu hỏi, câu trả lời của con; tắt, bật việc dùng AI cho câu hỏi của con (`tutoring_ai_consents`, chưa chọn là cho phép).
  - **Chưa làm**: ảnh trong câu hỏi, câu trả lời; liên kết học liệu, câu trong ngân hàng; thông báo nhắc quá hạn.
- Thành phần bị ảnh hưởng: `database` (năm học `0201`, hệ thống `0120`), `apps/api` (`tutoring/tutoring-questions*.ts`; `ai-assistant` thêm `draftAnswer`, loại `answer` ở bộ giả lập; đăng ký ở `application.module.ts`), `apps/portal` (khối Hỏi đáp bài tập; nhãn loại yêu cầu AI `feedback`, `answer` ở nhật ký AI), `apps/parent`.
- Dữ liệu bị ảnh hưởng: năm học thêm 3 bảng và cột `tutoring_programs.answer_hours`; hệ thống đổi ràng buộc `ai_requests_kind_check`.
- API bị ảnh hưởng: `GET /api/v1/tutoring/questions`, `GET /api/v1/tutoring/questions/{id}`, `POST /api/v1/tutoring/questions/{id}/ai-draft`, `POST /api/v1/tutoring/questions/{id}/answer`, `PUT /api/v1/tutoring/programs/{id}/answer-hours`, `GET /api/v1/children/{id}/tutoring/questions`, `PUT /api/v1/children/{id}/tutoring/ai-consent`, `GET /api/v1/student/tutoring/questions`, `POST /api/v1/student/tutoring/questions/{id}/understood`.
- Giao diện bị ảnh hưởng: MH-349, MH-354, MH-490.
- Quyền bị ảnh hưởng: PQ-155 (không thêm mã quyền).
- Ảnh hưởng chức năng cũ: nhật ký AI của 23d có thêm loại `answer`; hỏi đáp của 28e không đổi.
- Kiểm thử cần thực hiện: `apps/api` (`tutoring-questions`, `ai-assistant`, `ai-prompt`, `discussions`, `tenancy-matrix`); kiểm tĩnh.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-27 phần 27e, hỏi đáp bài tập của chương trình gia sư (YCTD-255).
- Chức năng mới: hàng chờ câu hỏi theo chương trình, thời hạn trả lời, gợi ý AI nháp chỉ giáo viên thấy, dấu "có AI hỗ trợ", học sinh báo đã hiểu, cha mẹ tắt AI cho con (P02-120).
- Lỗi đã sửa: nhật ký AI ở cổng quản trị chưa có nhãn cho loại `feedback` của 28c.
- Thay đổi dữ liệu: năm học `0201`; hệ thống `0120`.
- Thay đổi API: nhóm hỏi đáp của `/tutoring`, `/children/{id}/tutoring`, `/student/tutoring`.
- Kiểm thử: CT-1325 đến CT-1327 (CT-27e-1 đến CT-27e-3).
- Rủi ro: thấp; AI chỉ chạy khi trường bật, dùng bộ nối và hạn mức của 23d.
- Khả năng tương thích: không đổi hành vi cũ.
- Phương án quay lui: hoàn lại commit gộp; câu hỏi, câu trả lời vẫn là dữ liệu hỏi đáp bình thường của 28e.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27e: hỏi đáp bài tập của chương trình gia sư (hàng chờ theo chương trình, gợi ý AI nháp chỉ giáo viên thấy, dấu có AI hỗ trợ, học sinh báo đã hiểu, cha mẹ tắt AI cho con) | YCTD-255 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +1 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +3 |
| Màn hình dự kiến | Số lượng | +1 |
| Ca kiểm thử khởi đầu | Số lượng | +3 |
| Chức năng đã liệt kê | Số lượng | +1 |
| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +1 |
| 16 | bảng dự kiến | +3 |

## Nối dòng

| 32_KE_HOACH_THEO_HE_THONG_SO.md | 27e | Đã làm (YCTD-255): hàng chờ theo chương trình trên hỏi đáp 28e ở khoá học ghi sẵn 27d1, thời hạn trả lời theo chương trình, gợi ý AI nháp qua 23d (loại `answer`), dấu có AI hỗ trợ, đã hiểu, phụ huynh tắt AI; năm học 0201, hệ thống 0120 (không dùng 0158, 0159); ảnh, liên kết học liệu và câu ngân hàng chưa làm |
| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27 phần 27e (YCTD-255: hỏi đáp bài tập của chương trình gia sư) |
| 14_DAC_TA_GIAO_DIEN.md | MH-349 | YCTD-255: khối Hỏi đáp bài tập (thời hạn trả lời theo chương trình, câu đang chờ, trả lời, Gợi ý bằng AI với bản nháp chỉ giáo viên thấy) |
| 14_DAC_TA_GIAO_DIEN.md | MH-354 | YCTD-255: Hỏi đáp bài tập của con (câu trả lời có dấu có AI hỗ trợ, con đã hiểu chưa), ô cho phép giáo viên dùng trợ lý AI |
| 16_CO_SO_DU_LIEU.md | ai_requests (từ YCTD-214) | YCTD-255: thêm loại `answer` (gợi ý trả lời câu hỏi bài tập của gia sư; hệ thống `0120`) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-370 | Hỏi đáp bài tập của chương trình gia sư (YCTD-255): câu hỏi, trả lời, lọc, báo cáo theo hỏi đáp 28e ở khoá học ghi sẵn; hàng chờ của giáo viên dạy gồm câu chưa trả lời và câu học sinh báo chưa hiểu sau câu trả lời mới nhất; thời hạn trả lời theo chương trình (1 đến 336 giờ, mặc định 48); gợi ý AI là bản nháp chỉ giáo viên thấy, chỉ gửi cấp, môn, chữ của câu hỏi và ghi chú đã quét dữ liệu cá nhân, không gửi ảnh, tên học sinh; câu gửi từ bản nháp mang dấu có AI hỗ trợ; phụ huynh tắt được AI cho con (chưa chọn là cho phép); trường tắt AI thì không gợi ý |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-115 | PQ-155 | Hỏi đáp bài tập của chương trình gia sư (YCTD-255, DT-27 phần 27e): không thêm mã quyền; hàng chờ, gợi ý AI, trả lời cho giáo viên dạy chương trình (`P02.tutoring.teach`) và Ban Giám hiệu (`P02.tutoring.manage`); học sinh hỏi, đánh dấu đã hiểu bằng `P02.learning.study` ở kênh student; cha mẹ theo quan hệ phụ huynh |
| 10_YEU_CAU_CHUC_NANG.md | P02-102 | P02-120 | Hỏi đáp bài tập của chương trình gia sư (YCTD-255) | Học sinh; giáo viên; Ban Giám hiệu; cha mẹ | Câu hỏi ở khoá học ghi sẵn, bản nháp AI | Hàng chờ theo chương trình, gợi ý AI nháp, trả lời có dấu có AI hỗ trợ, đã hiểu, tắt AI cho con | Câu trả lời, dấu đã hiểu, lựa chọn AI | BR-370, PQ-155 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1035 | Cho chương trình gia sư có khoá học ghi sẵn / Khi học sinh hỏi, giáo viên dạy đặt thời hạn 24 giờ, giáo viên khác xem / Thì câu vào hàng chờ của giáo viên dạy với hạn 24 giờ, giáo viên khác không thấy, không đặt được thời hạn (CT-1325; YCTD-255) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1036 | Cho trường bật AI / Khi giáo viên xin gợi ý, ghi chú có tên học sinh, gửi câu trả lời từ bản nháp, phụ huynh tắt AI / Thì bản nháp chỉ giáo viên thấy, lời nhắc không có tên học sinh, ghi chú có tên bị từ chối, câu trả lời mang dấu có AI hỗ trợ, sau khi tắt thì không gợi ý được (CT-1326; YCTD-255) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1037 | Cho câu hỏi đã được trả lời / Khi học sinh báo chưa hiểu, giáo viên trả lời thêm, học sinh báo đã hiểu, cha mẹ xem / Thì câu trở lại hàng chờ rồi ra khỏi hàng chờ, cha mẹ thấy đã hiểu và dấu có AI hỗ trợ từng câu trả lời (CT-1327; YCTD-255) |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-490 | Ứng dụng phụ huynh, kênh học sinh: Hỏi đáp bài tập (YCTD-255): gửi câu hỏi cho giáo viên của khoá gia sư, câu trả lời có dấu có AI hỗ trợ, nút Em đã hiểu, Em chưa hiểu | Học sinh |
| 16_CO_SO_DU_LIEU.md | tutoring_attendance, tutoring_room_events (từ YCTD-252) | tutoring_question_marks, tutoring_ai_answers, tutoring_ai_consents (từ YCTD-255) | Hỏi đáp bài tập của chương trình gia sư (BR-370; năm học `0201`, thêm cột `tutoring_programs.answer_hours`) | đã hiểu: thread_id (khoá chính), child_id, understood, marked_at; có AI hỗ trợ: post_id (khoá chính), thread_id, ai_request_id, teacher_user_id; lựa chọn AI: child_id (khoá chính), allowed, người chọn, lúc chọn |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1325 | P02-120 | CT-27e-1: học sinh hỏi ở khoá gia sư; giáo viên dạy, giáo viên khác xem hàng chờ, đặt thời hạn | câu trong hàng chờ, hạn 24 giờ; 403; 400; hàng chờ rỗng, 404 | Đạt; `apps/api/src/tutoring/tutoring-questions.test.ts`; 1035 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1326 | P02-120 | CT-27e-2: gợi ý AI (bộ giả lập), ghi chú có tên, gửi từ bản nháp, phụ huynh tắt AI | 200, lời nhắc không có tên; 422; dấu có AI hỗ trợ; 409 | Đạt; `apps/api/src/tutoring/tutoring-questions.test.ts`; 1036 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1327 | P02-120 | CT-27e-3: chưa hiểu, trả lời thêm, đã hiểu, cha mẹ xem | trở lại hàng chờ; ra khỏi hàng chờ; đã hiểu, dấu AI từng câu | Đạt; `apps/api/src/tutoring/tutoring-questions.test.ts`; 1037 | Cao |
