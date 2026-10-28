---
yctd: YCTD-346
tieu_de: Giáo viên trả lời trao đổi trên bài nộp ở ứng dụng giáo viên
ngay: 2026-10-28
phien_ban_de_xuat: 0.226.0
---

## 02 Nhật ký

### 2026-10-28 — Giáo viên trả lời trao đổi trên bài nộp ở ứng dụng giáo viên

#### Công việc đã thực hiện

- Sửa lỗi mức Cao T1 của rà soát giao diện ngày 2026-10-28 (phụ lục giáo viên, phụ huynh, học sinh, mục H3): ở màn Chấm bài của Bài tập trực tuyến (MH-421), khối "Trao đổi trên bài" chỉ liệt kê, học sinh và phụ huynh hỏi được mà giáo viên không trả lời được.
- Ứng dụng giáo viên: khối "Trao đổi trên bài" luôn hiện ở màn Chấm bài, gồm các lời trao đổi (tên kèm Giáo viên, Học sinh hoặc Phụ huynh), dòng "Chưa có lời trao đổi nào" khi trống, ô "Trả lời học sinh, phụ huynh" (tối đa 2000 ký tự) và nút "Gửi trả lời". Nút khoá khi ô trống hoặc đang gửi. Gửi xong, lời trả lời hiện ngay ở cuối luồng lấy từ phản hồi của máy chủ, ô soạn được xoá, báo "Đã gửi trả lời"; lỗi báo "Chưa gửi được trả lời: <lý do của máy chủ>".
- Máy chủ API: tuyến `POST /api/v1/learning/submissions/{id}/comments` đã có từ YCTD-273 và đã kiểm đúng quyền (`P02.assignment.manage` cộng giáo viên của lớp học trực tuyến có hoạt động, qua cửa `teacherActivity` của lõi 28b); không đổi mã máy chủ, bổ sung kiểm thử.
- Kiểm thử máy chủ API (CT-28c-18): giáo viên của lớp gửi được (201, bỏ khoảng trắng hai đầu, ghi `author_kind: teacher`); giáo viên khác lớp, phụ huynh, học sinh 403; lời rỗng, thiếu nội dung, quá 2000 ký tự 422, đúng 2000 ký tự được; bài không có 404; giáo viên đọc lại bài thấy lời trả lời sau lời của học sinh; học sinh thấy lời trả lời ở lần nộp.
- Kiểm thử đơn vị ứng dụng giáo viên (CT-28c-17): hàm kiểm lời trả lời và hàm nối lời vừa gửi vào luồng.
- Kiểm thử giao diện `212-online-assignments` (CT-28c-16) thêm bước: học sinh hỏi trên bài đã trả, giáo viên mở bài thấy câu hỏi, nút gửi khoá khi ô trống, gửi trả lời, lời hiện ngay, ô soạn trống; học sinh mở lại thấy lời trả lời.

#### Quyết định

- Sau khi gửi, màn hình nối lời trả lời vào luồng từ phản hồi của máy chủ thay vì đọc lại cả bài nộp, để không ghi đè điểm, nhận xét giáo viên đang chấm dở. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Không sửa máy chủ vì tuyến đã chặn đúng giáo viên khác lớp; chỉ bổ sung kiểm thử theo vai trò. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Ô trả lời nằm ngay trong màn Chấm bài, không tách màn mới; không đụng hộp công cụ giảng dạy (PR 246).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-346, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chưa báo cho học sinh, phụ huynh khi giáo viên trả lời (chỉ thấy khi mở bài); cần thì làm cùng đợt thông báo của học trực tuyến.

## 24 Yêu cầu thay đổi

### YCTD-346: Giáo viên trả lời trao đổi trên bài nộp ở ứng dụng giáo viên – 2026-10-28

- Lý do: rà soát giao diện ngày 2026-10-28 (mục 3.1, lỗi mức Cao T1, H3): học sinh, phụ huynh gửi được lời trao đổi trên bài nộp nhưng giáo viên không trả lời được ở ứng dụng giáo viên, luồng hai chiều của YCTD-273 (MH-421, P03-20) bị đứt.
- Nội dung thay đổi: ô soạn và nút "Gửi trả lời" trong khối "Trao đổi trên bài" của màn Chấm bài; lời trả lời hiện ngay; báo lỗi rõ ràng; kiểm thử theo vai trò cho tuyến giáo viên trao đổi trên bài.
- Thành phần bị ảnh hưởng: `apps/teacher/src/screens/AssignmentScreen.tsx`, `apps/teacher/src/screens/submission-thread-logic.ts` (mới), `apps/teacher/src/screens/submission-thread-logic.test.ts` (mới), `apps/api/src/learning/assignments/assignments.test.ts`, `tests/e2e/212-online-assignments.spec.ts`; tài liệu `17_DAC_TA_API.md` mục 17.3, dòng MH-421 (tệp mảnh YCTD-273, chưa gom vào `14_DAC_TA_GIAO_DIEN.md`), `21_KICH_BAN_KIEM_THU.md` (dòng mới qua tệp mảnh).
- Dữ liệu, API, quyền bị ảnh hưởng: không đổi dữ liệu, quyền; tuyến `POST /api/v1/learning/submissions/{id}/comments` giữ nguyên, ghi rõ ở đặc tả giới hạn nội dung, mã lỗi và phản hồi.
- Ảnh hưởng chức năng cũ: không; lời trao đổi của học sinh, phụ huynh giữ nguyên.
- Kiểm thử cần thực hiện: kiểm thử máy chủ API `assignments.test.ts` (CT-28c-18); kiểm thử đơn vị `apps/teacher` (CT-28c-17); e2e `212-online-assignments` (CT-28c-16 có bước trao đổi).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: giáo viên trả lời trao đổi trên bài nộp ở ứng dụng giáo viên (YCTD-346).
- Sửa lỗi: màn Chấm bài (MH-421) có ô "Trả lời học sinh, phụ huynh" và nút "Gửi trả lời"; lời trả lời hiện ngay, lỗi báo rõ.
- Kiểm thử: CT-1650 đến CT-1652.
- Không đổi dữ liệu, quyền, API.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Giáo viên trả lời trao đổi trên bài nộp | YCTD-346 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1650 | P03-20 | CT-28c-18: giáo viên của lớp học trực tuyến trả lời trao đổi trên bài nộp (201, bỏ khoảng trắng hai đầu, ghi là giáo viên, học sinh thấy ở lần nộp); giáo viên khác lớp, phụ huynh, học sinh gọi tuyến giáo viên 403; lời rỗng, thiếu, quá 2000 ký tự 422; đúng 2000 ký tự được; bài không có 404 (YCTD-346) | Đúng | Đạt 28/10/2026; `apps/api/src/learning/assignments/assignments.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1651 | P03-20 | CT-28c-17: ứng dụng giáo viên kiểm lời trả lời trước khi gửi (rỗng, chỉ khoảng trắng, quá 2000 ký tự bị chặn kèm câu báo; đúng giới hạn hợp lệ); lời vừa gửi nối cuối luồng, không lặp (YCTD-346) | Đúng | Đạt 28/10/2026; `apps/teacher/src/screens/submission-thread-logic.test.ts` | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1652 | P03-20 | CT-28c-16 (bước trao đổi): học sinh hỏi trên bài đã trả; giáo viên mở Chấm bài thấy câu hỏi, nút "Gửi trả lời" khoá khi ô trống, gửi thì lời hiện ngay, báo "Đã gửi trả lời", ô soạn trống; học sinh mở lại thấy lời trả lời (YCTD-346) | Đúng | Chờ CI; e2e `tests/e2e/212-online-assignments.spec.ts` | Cao |
