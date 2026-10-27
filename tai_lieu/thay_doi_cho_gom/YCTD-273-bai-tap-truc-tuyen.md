---
yctd: YCTD-273
tieu_de: DT-28 phần 28c: bài tập trực tuyến
ngay: 2026-10-27
phien_ban_de_xuat: 0.157.0
---

## 02 Nhật ký

### 2026-10-27 — DT-28 phần 28c: bài tập trực tuyến

#### Công việc đã thực hiện

- Làm phần 28c theo `32` mục 20.6, 20.7: bài tập là loại hoạt động `assignment` của lõi 28b; câu trắc nghiệm từ câu đã duyệt của 22g1 (bản chụp) chấm bằng hàm của 22g2, tự luận, ảnh hoặc tệp PDF, ghi âm, học liệu; phiên bản bài; giao lớp, nhóm, từng học sinh; hạn, nộp muộn, số lần nộp, miễn, đóng bài; bài nhóm do nhóm trưởng nộp, đánh giá đóng góp, điều chỉnh điểm cá nhân có lý do; chấm tay, thang tiêu chí 22h2, mức (Tiểu học); ngân hàng nhận xét (câu của trường 20c và câu của giáo viên); trả bài ghi kết quả hoạt động; trao đổi trên bài; gợi ý nhận xét AI qua 23d chỉ từ đề, thang tiêu chí, điểm đã chấm, ghi chú (GD-142).
- Giao diện: ứng dụng giáo viên (soạn, giao, chấm, trả, gợi ý AI), học sinh ở `#hoc-sinh` (làm, lưu nháp, ảnh vẽ lại để bỏ siêu dữ liệu, ghi âm có giới hạn, nộp, xem nhận xét, trao đổi, đánh giá đóng góp), phụ huynh (xem các lần nộp, điểm, nhận xét của con).
- Kiểm thử: 15/15 ca của `assignment-rules.test.ts`, `assignments.test.ts`; hồi quy 110/110 ca (`quick-links`, `school-plan`, `learning`, `online-exams`, `ai-assistant`, `child-groups`), `database/src/migrate.test.ts` 5/5; e2e `212-online-assignments` chưa chạy được trên máy (cổng của e2e bị tiến trình cũ chiếm), kết quả lấy ở CI. Chạy với cơ sở dữ liệu định danh, hệ thống riêng của phiên.

#### Quyết định

- Claude chọn theo ủy quyền: thêm **cửa công khai** ở cuối `LearningService` của lõi (`teacherActivity`, `studentContext`, `openActivityForChild`, `guardianOrStaff`, `writeResult`) thay vì chép quy tắc quyền của lõi sang 28c; kế hoạch ghi "không sửa lõi của 28b" để tránh va giữa các phần làm song song, đợt 2 làm tuần tự nên chỉ thêm hàm ở cuối lớp, không đổi hàm có sẵn. Mã khối riêng cho 28c (BR-280, AC-940, MH-390, CT-1190, BM-130, PQ-120) để không va với các PR đang mở; người gom đánh lại nếu cần.
- Hai kiểm thử của 28b coi `assignment` là loại chưa đăng ký nay đổi sang `discussion` (28e).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-273, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Màn hình soạn phiên bản bài, đích nhóm, từng học sinh và thang tiêu chí ở giao diện chưa làm (máy chủ đã có); nộp thay của phụ huynh, bài về nhà từ sổ đầu bài là 28f; đưa kết quả vào sổ điểm, sổ nhận xét là 28d.

## 24 Yêu cầu thay đổi

### YCTD-273: DT-28 phần 28c: bài tập trực tuyến – 2026-10-27

- Lý do: phần 28c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270); Eric yêu cầu bài tập là một trong bốn tính năng chính của DT-28. Áp các quyết định Eric chốt ngày 2026-10-26: GD-142 (trợ lý AI không đọc bài làm), GD-141 (Tiểu học dùng kết quả hoạt động làm căn cứ nhận xét: 28c chấm theo mức, không ghi điểm số vào sổ; đưa vào sổ là phần 28d).
- Căn cứ: Thông tư 09/2021/TT-BGDĐT (giao nhiệm vụ học tập, kiểm tra, đánh giá trong dạy học trực tuyến; đọc toàn văn bản gốc khi viết kế hoạch, mục 20.2). 28c không ghi điểm vào sổ điểm, sổ nhận xét nên chưa áp quy định của Thông tư 22/2021 và Thông tư 27/2020 về điểm thường xuyên; phần 28d đọc lại hai văn bản gốc trước khi làm. Cách chấm câu đúng sai bốn ý dùng lại hàm chấm của 22g2 (đã theo bậc của Thông tư 22).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Loại hoạt động** `assignment` đăng ký ở cuối `ACTIVITY_KINDS` của lõi (hoàn thành khi nộp, khi đạt điểm hoặc khi giáo viên trả bài; không đặt trong khoá mẫu). Cài đặt riêng ở bảng `assignments` (một dòng mỗi hoạt động).
  - **Soạn**: câu trắc nghiệm chỉ từ câu đã duyệt cùng cấp, cùng môn của lớp, lưu bản chụp; tự luận, ảnh hoặc tệp, ghi âm, học liệu đã công bố; tối đa 50 câu, 6 phiên bản; thang tiêu chí 22h2 lưu bản chụp (thang của trường hoặc của chính giáo viên).
  - **Giao**: đích lớp, nhóm, học sinh, phiên bản theo đích cụ thể nhất; phát hành chốt danh sách nhận bài và giao hoạt động; sau phát hành chỉ đổi nộp muộn, số lần nộp (chỉ tăng), cách hiện kết quả, hạn riêng, miễn.
  - **Nộp** (GD-147): cho nộp muộn đến khi đóng bài, đánh dấu muộn, không trừ điểm; giáo viên chặn được nộp muộn; 1 đến 5 lần nộp; nháp có khóa lạc quan (409 khi bản cũ).
  - **Tệp** (GD-150): mặc định 10 ảnh, tổng 20 MB, tài liệu 10 MB, ghi âm 5 phút, trường đổi ở `assignment_upload_limits`; nhận theo byte đầu; ảnh vẽ lại trên máy học sinh để bỏ siêu dữ liệu, máy chủ bỏ thêm khối EXIF, XMP, IPTC của JPEG; khóa kho `assignment-submissions/<bài nộp>/<mã>`.
  - **Chấm**: máy chấm trắc nghiệm bằng `gradeObjective` của 22g2; giáo viên chấm câu còn lại; điểm bài quy về thang 10; thang tiêu chí có trọng số; chấm theo mức cho Tiểu học; trả từng bài hoặc mọi bài đã chấm xong; kết quả hoạt động ghi qua `writeResult` của lõi.
  - **Bài nhóm**: bộ nhóm của lớp (28a, `GroupSetsReader`); một bài nộp cho cả nhóm, nhóm trưởng nộp (nhóm chưa có nhóm trưởng thì em nào cũng nộp); tự đánh giá và đánh giá bạn 1 đến 5 chỉ giáo viên xem; điều chỉnh điểm cá nhân bắt buộc lý do.
  - **AI** (GD-142): `AiAssistantService.draftFeedback` mới, loại yêu cầu `feedback` (hệ thống 0111 đổi ràng buộc `ai_requests_kind_check`); mẫu lời nhắc chỉ có cấp, khối, môn, đề, thang tiêu chí và mức đã chọn, kết quả đã chấm, ghi chú của giáo viên đã quét dữ liệu cá nhân; nháp chỉ trả cho giáo viên; nhận xét đã trả ghi có AI hỗ trợ.
  - **Quyền** (định danh 0181): `P02.assignment.manage` cho VT-07, VT-08, VT-17, gắn mục menu 9.1 để thuộc phân hệ học tập trực tuyến của gói; học sinh dùng `P02.learning.study`; phụ huynh xem theo học sinh.
  - **Cửa của lõi**: thêm năm hàm công khai ở cuối `LearningService` cho các phần sau (`teacherActivity`, `studentContext`, `openActivityForChild`, `guardianOrStaff`, `writeResult`).
- Thành phần bị ảnh hưởng: `apps/api` (thư mục mới `learning/assignments`, một dòng ở `learning-activity-kinds.ts`, cửa ở cuối `learning.ts`, `ai-assistant` thêm loại `feedback`, đăng ký thêm cuối `application.module.ts`, hai kiểm thử của 28b), `apps/teacher` (`AssignmentScreen.tsx`, `OnlineClassesScreen.tsx`), `apps/parent` (`StudentAssignmentView.tsx`, `StudentLearningPanel.tsx`, `student-api.ts`, `OnlineLearningPanel.tsx`), `packages/shared` (mã quyền, quy tắc menu 9.1), `database` (năm học 0176 đến 0179, định danh 0181, hệ thống 0111), `tests/e2e/212-online-assignments.spec.ts`.
- Dữ liệu bị ảnh hưởng: năm học `0176` đến `0179`; định danh `0181`; hệ thống `0111`.
- API bị ảnh hưởng: `/api/v1/learning/activities/{id}/assignment...`, `/api/v1/learning/submissions...`, `/api/v1/learning/children/{childId}/assignments/{activityId}`, `/api/v1/student/assignments...` (xem `17_DAC_TA_API.md` mục 17.3).
- Giao diện bị ảnh hưởng: MH-390 đến MH-393.
- Quyền bị ảnh hưởng: PQ-120.
- Ảnh hưởng chức năng cũ: không đổi hành vi; hoạt động loại bài tập mới tạo được; nhật ký AI có thêm loại `feedback`.
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho; e2e `single` (spec 212 cùng các spec hiện có); kiểm tĩnh đa thuê bao; typecheck, lint, build.
- Chưa làm (YCTD sau): giao diện soạn phiên bản, đích nhóm, từng học sinh, thang tiêu chí (máy chủ đã có); nộp thay của phụ huynh, bài về nhà (28f); đưa kết quả vào sổ điểm, sổ nhận xét (28d); học khi mạng yếu (28j).
- Trạng thái: Đã triển khai (PR chờ)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-28 phần 28c, bài tập trực tuyến (YCTD-273).
- Chức năng mới: soạn và giao bài tập (P03-18, MH-390); học sinh làm, nộp bài có ảnh, tệp, ghi âm (P03-19, MH-392); chấm, nhận xét, trả bài, ngân hàng nhận xét (P03-20, MH-391, MH-393); bài tập nhóm (P03-21); gợi ý nhận xét bằng trợ lý AI không gửi bài làm (P03-22).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0176` đến `0179` (mười bảng); định danh `0181` (quyền `P02.assignment.manage`); hệ thống `0111` (loại yêu cầu AI `feedback`); xem `16_CO_SO_DU_LIEU.md` mục 18I.
- Thay đổi API: tuyến bài tập của giáo viên, học sinh, phụ huynh (xem `17_DAC_TA_API.md` mục 17.3).
- Kiểm thử: kịch bản CT-1190 đến CT-1199 (CT-28c-1 đến CT-28c-16 trong mã kiểm thử). Kết quả ngày 27/10/2026: `apps/api` 15/15 ca của `assignment-rules.test.ts`, `assignments.test.ts`; hồi quy 110/110; `migrate.test.ts` 5/5; e2e `212-online-assignments` chờ CI.
- Rủi ro: giao diện chưa soạn được phiên bản, đích nhóm, thang tiêu chí (chỉ qua máy chủ); ghi âm phụ thuộc trình duyệt có `MediaRecorder`.
- Khả năng tương thích: không đổi hành vi các phân hệ cũ; hai kiểm thử của 28b đổi loại "chưa đăng ký" sang `discussion`.
- Phương án quay lui: hoàn lại commit gộp của nhánh 28c; migration chỉ thêm bảng, quyền và nới ràng buộc loại yêu cầu AI.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28c: bài tập trực tuyến (câu đã duyệt của ngân hàng câu hỏi chấm tự động, tự luận, ảnh, tệp, ghi âm, phiên bản, giao lớp, nhóm, học sinh, nộp muộn, bài nhóm, chấm, thang tiêu chí, ngân hàng nhận xét, trả bài, gợi ý nhận xét AI không gửi bài làm) (YCTD-273) | Đã triển khai |

## index Số đếm

| 10 | mã chức năng | +5 |
| 10 | còn hiệu lực | +5 |
| 14 | màn hình | +4 |
| 16 | bảng dự kiến | +10 |
| Chức năng đã liệt kê | Số lượng | +5 |
| Chức năng đã liệt kê | mã; | +5 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +7 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +6 |
| Bảng dữ liệu dự kiến | Số lượng | +10 |
| Màn hình dự kiến | Số lượng | +4 |
| Ca kiểm thử khởi đầu | Số lượng | +10 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-390 đến MH-393 (YCTD-273) |
