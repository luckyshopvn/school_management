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

- Claude chọn theo ủy quyền: thêm **cửa công khai** ở cuối `LearningService` của lõi (`teacherActivity`, `studentContext`, `openActivityForChild`, `guardianOrStaff`, `writeResult`) thay vì chép quy tắc quyền của lõi sang 28c; kế hoạch ghi "không sửa lõi của 28b" để tránh va giữa các phần làm song song, đợt 2 làm tuần tự nên chỉ thêm hàm ở cuối lớp, không đổi hàm có sẵn. Mã khối riêng cho 28c (BR-300, AC-960, MH-420, CT-1230, BM-160, PQ-130) để không va với các PR đang mở; người gom đánh lại nếu cần.
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
- Giao diện bị ảnh hưởng: MH-420 đến MH-423.
- Quyền bị ảnh hưởng: PQ-130.
- Ảnh hưởng chức năng cũ: không đổi hành vi; hoạt động loại bài tập mới tạo được; nhật ký AI có thêm loại `feedback`.
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho; e2e `single` (spec 212 cùng các spec hiện có); kiểm tĩnh đa thuê bao; typecheck, lint, build.
- Chưa làm (YCTD sau): giao diện soạn phiên bản, đích nhóm, từng học sinh, thang tiêu chí (máy chủ đã có); nộp thay của phụ huynh, bài về nhà (28f); đưa kết quả vào sổ điểm, sổ nhận xét (28d); học khi mạng yếu (28j).
- Trạng thái: Đã triển khai (PR chờ)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-28 phần 28c, bài tập trực tuyến (YCTD-273).
- Chức năng mới: soạn và giao bài tập (P03-18, MH-420); học sinh làm, nộp bài có ảnh, tệp, ghi âm (P03-19, MH-422); chấm, nhận xét, trả bài, ngân hàng nhận xét (P03-20, MH-421, MH-423); bài tập nhóm (P03-21); gợi ý nhận xét bằng trợ lý AI không gửi bài làm (P03-22).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0176` đến `0179` (mười bảng); định danh `0181` (quyền `P02.assignment.manage`); hệ thống `0111` (loại yêu cầu AI `feedback`); xem `16_CO_SO_DU_LIEU.md` mục 18I.
- Thay đổi API: tuyến bài tập của giáo viên, học sinh, phụ huynh (xem `17_DAC_TA_API.md` mục 17.3).
- Kiểm thử: kịch bản CT-1230 đến CT-1239 (CT-28c-1 đến CT-28c-16 trong mã kiểm thử). Kết quả ngày 27/10/2026: `apps/api` 15/15 ca của `assignment-rules.test.ts`, `assignments.test.ts`; hồi quy 110/110; `migrate.test.ts` 5/5; e2e `212-online-assignments` chờ CI.
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

| index.md | Màn hình dự kiến | MH-420 đến MH-423 (YCTD-273) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-300 | Soạn bài tập trực tuyến (YCTD-273, DT-28 phần 28c): bài tập là hoạt động loại `assignment` của lõi 28b (tên, hướng dẫn, hạn, điều kiện mở ở hoạt động); câu trắc nghiệm chỉ lấy câu đã duyệt của ngân hàng câu hỏi cùng cấp, cùng môn của lớp và lưu bản chụp (sửa câu ở ngân hàng không đổi bài đã giao); học liệu chỉ bản đã công bố; tối đa 50 câu, 6 phiên bản (mã một chữ cái); chấm điểm thì mỗi phiên bản phải có câu có điểm; thang tiêu chí 22h2 lưu bản chụp khi chọn, chỉ thang của trường hoặc của chính giáo viên; vi phạm: Từ chối 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-301 | Phát hành bài tập (YCTD-273): phát hành chốt danh sách học sinh nhận bài từ các đích (lớp, nhóm, từng học sinh), chỉ học sinh của lớp học trực tuyến; phiên bản theo đích cụ thể nhất (học sinh, rồi nhóm, rồi lớp); bài có phiên bản thì mọi em phải có phiên bản; bài nhóm: mọi em nhận bài phải có đúng một nhóm trong bộ nhóm của bài (thiếu thì nêu tên để giáo viên xếp); phát hành là giao hoạt động; sau phát hành không đổi câu, phiên bản, đích, chỉ đổi nộp muộn, số lần nộp (chỉ tăng), cách hiện kết quả, hạn riêng, miễn; vi phạm: Từ chối 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-302 | Nộp và chấm bài tập (YCTD-273, GD-147): nộp đến khi giáo viên đóng bài, quá hạn thì đánh dấu muộn, không tự trừ điểm; giáo viên chọn "chặn nộp muộn" thì quá hạn không nộp được; tối đa 1 đến 5 lần nộp, lần mới bắt đầu từ câu trả lời của lần trước; được miễn thì không nộp, kết quả hoạt động là miễn; máy chấm câu trắc nghiệm bằng hàm chấm của 22g2 (đúng sai bốn ý theo bậc của Thông tư 22), giáo viên chấm câu còn lại; điểm bài là tổng điểm các câu quy về thang 10 theo tổng điểm tối đa của phiên bản; chấm theo thang tiêu chí quy tổng có trọng số về 10; chấm theo mức (Hoàn thành tốt, Hoàn thành, Chưa hoàn thành) cho Tiểu học; chưa trả thì học sinh, phụ huynh chưa thấy điểm, nhận xét; kết quả hoạt động: nộp là hoàn thành khi cách tính là "nộp", trả bài là đạt hoặc chưa đạt theo điểm đạt khi cách tính là "đạt điểm"; vi phạm: Chặn nộp 422; đáp án không xuống máy học sinh |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-303 | Bài tập nhóm (YCTD-273): một bài nộp cho cả nhóm, cả nhóm cùng sửa một bản nháp (khóa lạc quan theo số phiên bản, sửa trùng thì báo tải lại); nhóm trưởng nộp (nhóm chưa có nhóm trưởng thì em nào cũng nộp được); mỗi em tự đánh giá đóng góp và đánh giá các bạn cùng nhóm từ 1 đến 5, chỉ giáo viên xem; điểm của từng em là điểm của nhóm, giáo viên điều chỉnh điểm cá nhân bắt buộc ghi lý do; vi phạm: Từ chối 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-304 | Tệp của bài nộp (YCTD-273, GD-150): ảnh JPEG, PNG, tài liệu PDF cho câu "ảnh hoặc tệp", ghi âm (WebM, Ogg, MP4, MP3) cho câu "ghi âm", nhận theo byte đầu; mặc định tối đa 10 ảnh, tổng 20 MB, tài liệu 10 MB, ghi âm 5 phút (máy chủ chặn tệp ghi âm quá 6 MB), trường đổi ở cấu hình `assignment_upload_limits`; ảnh được máy học sinh vẽ lại để bỏ siêu dữ liệu, máy chủ bỏ thêm khối EXIF, XMP, IPTC của JPEG; chỉ xóa tệp của bản nháp; tệp chỉ học sinh của bài (hoặc nhóm) và giáo viên của lớp xem; vi phạm: Từ chối 422; người khác 404 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-305 | Gợi ý nhận xét bài tập bằng AI (YCTD-273, GD-142, Eric chốt 2026-10-26): lời nhắc dựng từ mẫu cố định chỉ gồm cấp, khối, môn, đề (yêu cầu, nội dung câu, không đáp án), thang tiêu chí và mức đã chọn, điểm hoặc mức giáo viên đã cho, ghi chú ngắn (tối đa 500 ký tự) của giáo viên; ghi chú có tên học sinh, phụ huynh, cán bộ, số điện thoại, thư điện tử, số định danh thì từ chối, không gửi; không bao giờ gửi bài làm, ảnh, ghi âm của học sinh, không làm chế độ gửi bài làm; bản nháp chỉ trả cho giáo viên, không lưu vào bài; nhận xét đã trả ghi "có trợ lý AI hỗ trợ"; hạn mức, nhật ký theo 23d (loại yêu cầu `feedback`); vi phạm: Từ chối 422 |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-111 | PQ-130 | Bài tập trực tuyến (YCTD-273, DT-28 phần 28c): quyền mới `P02.assignment.manage` (soạn, giao, chấm, trả bài tập, gợi ý nhận xét AI) cho VT-07, VT-08, VT-17; bài nào của giáo viên do lớp học trực tuyến quyết định (giáo viên của lớp đó, kiểm qua cửa của lõi 28b), quyền chỉ là điều kiện cần; quyền gắn mục menu 9.1 nên thuộc phân hệ học tập trực tuyến của gói. Học sinh làm, nộp bằng `P02.learning.study` sẵn có (kênh `student`); phụ huynh xem bài, nhận xét của con không cần quyền, kiểm theo học sinh |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-18 | Soạn và giao bài tập trực tuyến (YCTD-273, DT-28 phần 28c) | Giáo viên của lớp học trực tuyến có `P02.assignment.manage` | Hoạt động loại bài tập; câu đã duyệt của ngân hàng câu hỏi, yêu cầu tự luận, ảnh hoặc tệp, ghi âm, học liệu; phiên bản; đích lớp, nhóm, học sinh; cách làm cá nhân hoặc nhóm; nộp muộn, số lần nộp, cách chấm | Kiểm câu đã duyệt cùng cấp, cùng môn, chụp bản câu; kiểm bộ nhóm, thang tiêu chí; phát hành chốt danh sách học sinh nhận bài, phiên bản theo đích cụ thể nhất, giao hoạt động | Bài tập đã giao; số học sinh nhận bài | BR-300, BR-301 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-19 | Học sinh làm và nộp bài tập (YCTD-273) | Học sinh (kênh `student`, `P02.learning.study`) | Câu trả lời, ảnh, tệp PDF, ghi âm | Chỉ bài đã giao cho em hoặc nhóm em, hoạt động đang mở; lưu nháp có khóa lạc quan; ảnh bỏ siêu dữ liệu; kiểm giới hạn tệp; nộp trong hạn hoặc muộn có đánh dấu, chặn khi giáo viên chặn nộp muộn, đã đóng, hết lượt, được miễn; máy chấm câu trắc nghiệm | Bản nháp, lần nộp; kết quả hoạt động đã nộp | BR-302, BR-304 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-20 | Chấm, nhận xét, trả bài tập (YCTD-273) | Giáo viên của lớp học trực tuyến | Điểm từng câu giáo viên chấm, mức theo tiêu chí, mức (Tiểu học), nhận xét, câu của ngân hàng nhận xét | Quy điểm về thang 10; thang tiêu chí có trọng số; trả từng bài hoặc mọi bài đã chấm xong; ghi kết quả hoạt động; trao đổi trên bài | Bài đã trả; kết quả hoạt động; nhận xét cho học sinh, phụ huynh | BR-302, BR-303 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-21 | Bài tập nhóm (YCTD-273) | Giáo viên; học sinh trong nhóm | Bộ nhóm của lớp (28a); đánh giá đóng góp; điểm điều chỉnh có lý do | Một bài nộp cho cả nhóm, nhóm trưởng nộp; đánh giá đóng góp chỉ giáo viên xem; điểm cá nhân là điểm nhóm trừ khi giáo viên điều chỉnh | Kết quả hoạt động của từng em | BR-303 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-22 | Gợi ý nhận xét bài tập bằng trợ lý AI (YCTD-273) | Giáo viên | Bài đã chấm; ghi chú ngắn của giáo viên | Lời nhắc chỉ có cấp, khối, môn, đề, thang tiêu chí, kết quả đã chấm, ghi chú đã quét dữ liệu cá nhân; không gửi bài làm, ảnh, ghi âm (GD-142); hạn mức, nhật ký của 23d | Bản nháp nhận xét chỉ giáo viên thấy; nhận xét đã trả ghi có AI hỗ trợ | BR-305 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-960 | Cho lớp học trực tuyến Toán 7A, câu đã duyệt, câu đang soạn, câu môn Văn / Khi giáo viên tìm câu, lưu bài dùng câu đang soạn hoặc câu môn khác, giáo viên khác lưu bài, giáo viên lưu bài đúng rồi sửa câu ở ngân hàng, phát hành, sửa bài sau phát hành / Thì chỉ thấy câu đã duyệt cùng môn; câu không hợp lệ 422; giáo viên khác 403; bài giữ bản chụp câu; phát hành chốt 3 học sinh và giao hoạt động; sửa câu sau phát hành 422 | CT-1234 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-961 | Cho học sinh nhận bài / Khi xem bài, lưu nháp, gửi bản nháp cũ, tải ảnh có EXIF, tải tệp HTML, nộp, nộp lần hai, bạn khác mở tệp / Thì không thấy đáp án, hướng dẫn chấm; nháp lưu; bản cũ 409; ảnh lưu không còn vị trí; HTML 422; nộp được, không muộn; lần hai 422 (bài một lần nộp); bạn khác 404; chưa trả thì chưa thấy điểm | CT-1235 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-962 | Cho bài đã nộp / Khi giáo viên chấm câu tự luận, ảnh, chấm quá điểm câu, xin gợi ý nhận xét AI, ghi chú có tên học sinh, trả bài / Thì điểm 8 (thang 10); quá điểm 422; lời nhắc AI có đề, điểm, không có bài làm, tên học sinh; ghi chú có tên 422, không gửi; trả bài ghi kết quả "đạt" điểm 8; học sinh thấy điểm, nhận xét "có trợ lý AI hỗ trợ", đúng sai câu trắc nghiệm; phụ huynh của con thấy, phụ huynh khác 403 | CT-1236 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-963 | Cho bộ nhóm hai nhóm, nhóm 1 có nhóm trưởng / Khi bạn thường lưu nháp, nhóm trưởng mở, bạn thường nộp, nhóm trưởng nộp, bạn thường đánh giá đóng góp (cả bạn nhóm khác), giáo viên điều chỉnh không lý do, có lý do, trả bài / Thì nhóm trưởng thấy cùng bản nháp; bạn thường nộp 422; nhóm trưởng nộp được; đánh giá bạn nhóm khác 422; em không thấy bạn đánh giá mình; không lý do 422; kết quả: nhóm trưởng 8, bạn được điều chỉnh 6 | CT-1237 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-964 | Cho bài đã quá hạn, chặn nộp muộn / Khi học sinh nộp, giáo viên đổi sang cho nộp muộn, học sinh nộp, giáo viên miễn một em, em đó nộp, giáo viên đóng bài, em khác nộp / Thì bị chặn "quá hạn"; nộp được và đánh dấu muộn; kết quả của em được miễn là "miễn", em đó bị chặn; sau khi đóng bị chặn "đóng bài" | CT-1238 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-965 | Cho giáo viên / Khi thêm câu vào ngân hàng nhận xét, mở ngân hàng nhận xét của bài, giáo viên khác xóa câu đó / Thì thấy câu của mình cùng câu nhận xét của trường theo cấp; giáo viên khác 404 | CT-1238 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-966 | Cho giáo viên ở ứng dụng giáo viên, học sinh ở `#hoc-sinh`, phụ huynh / Khi giáo viên tạo bài từ câu đã duyệt và một câu tự luận, giao; học sinh làm, nộp; giáo viên chấm, nhận xét, trả; học sinh mở lại; phụ huynh xem / Thì học sinh thấy "Đã trả bài", điểm 8, nhận xét; phụ huynh thấy nhận xét | CT-1239 |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-420 | Ứng dụng giáo viên: Bài tập ở lớp học trực tuyến (YCTD-273): biểu mẫu "Thêm bài tập" (tên, hạn nộp) ở chi tiết lớp học trực tuyến, nút "Mở bài tập" ở hoạt động loại bài tập; khối "Soạn bài tập": cách chấm (điểm thang 10, theo mức, chỉ ghi hoàn thành), cách làm (mỗi em một bài, theo nhóm của bộ nhóm), ô "Cho nộp muộn", danh sách câu (điểm, bỏ câu), thêm yêu cầu tự luận, ảnh hoặc tệp, ghi âm, tìm câu đã duyệt trong ngân hàng câu hỏi và nút "Thêm"; nút "Lưu bài tập", "Giao bài cho học sinh" (người dùng: Giáo viên) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-421 | Ứng dụng giáo viên: Bài nộp và chấm bài (YCTD-273): số học sinh nhận bài, nút "Trả các bài đã chấm", "Đóng bài" hoặc "Mở lại bài"; danh sách theo học sinh hoặc theo nhóm (Chưa nộp, Đang làm, Đã nộp, muộn, Đã trả, điểm, Được miễn) với nút "Chấm"; khối "Chấm bài": từng câu (lựa chọn, đáp án, điểm máy chấm; bài làm chữ; nút "Xem" tệp), ô "Điểm câu" cho câu giáo viên chấm, mức (Tiểu học), ô "Nhận xét", ngân hàng nhận xét bấm để thêm, ô ghi chú cho trợ lý AI kèm dòng giải thích AI không nhận bài làm, nút "Gợi ý nhận xét (AI)", "Lưu điểm, nhận xét"; khối "Trao đổi trên bài": các lời trao đổi (tên, Giáo viên, Học sinh hoặc Phụ huynh), dòng "Chưa có lời trao đổi nào" khi trống, ô "Trả lời học sinh, phụ huynh" (tối đa 2000 ký tự) và nút "Gửi trả lời" (khoá khi ô trống hoặc đang gửi); gửi xong lời trả lời hiện ngay ở cuối luồng, báo "Đã gửi trả lời", lỗi báo "Chưa gửi được trả lời: …" (YCTD-346) (người dùng: Giáo viên) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-422 | Học sinh: làm bài tập (YCTD-273, `#hoc-sinh` của ứng dụng phụ huynh, nút "Mở" ở hoạt động loại bài tập trong khung Học trực tuyến): hướng dẫn, nhóm và người nộp (bài nhóm); từng câu: ô chọn đáp án, Đúng hoặc Sai từng ý, ô trả lời, ô chọn hoặc chụp ảnh, PDF, nút ghi âm có đếm giây và giới hạn; tệp đã gửi (Xem, Xóa); nút "Lưu nháp", "Nộp bài" (hoặc "Nộp bài (muộn)"; bài nhóm chỉ nhóm trưởng); các lần nộp (Đã nộp, chờ chấm; Đã trả bài; Nộp muộn; điểm, mức, số câu trắc nghiệm đúng, nhận xét có ghi AI hỗ trợ); ô trao đổi với thầy cô; tự đánh giá đóng góp (bài nhóm) (người dùng: Học sinh) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-423 | Ứng dụng phụ huynh: bài tập của con (YCTD-273, trong khung Học trực tuyến của con): nút "Xem bài và nhận xét" ở hoạt động bài tập; danh sách lần nộp (đã nộp, chờ chấm hoặc đã trả bài, nộp muộn, điểm hoặc mức, nhận xét có ghi AI hỗ trợ), "Con được miễn bài này", "Con chưa nộp bài"; phụ huynh chỉ xem (người dùng: Phụ huynh) |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1230 | P03-18 | CT-28c-1, CT-28c-2: danh mục có loại bài tập (không đặt trong khoá mẫu); đọc bài: bài nhóm phải chọn bộ nhóm, chấm theo tiêu chí phải chọn thang, câu thiếu yêu cầu, loại lạ bị chặn; chấm điểm mà không câu nào có điểm bị chặn; phiên bản không trùng mã, câu và đích trỏ đúng phiên bản | Đúng | Đạt 27/10/2026; `apps/api/src/learning/assignments/assignment-rules.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1231 | P03-18, P03-19 | CT-28c-3, CT-28c-4: chốt người nhận theo đích cụ thể nhất, loại học sinh ngoài lớp, bài nhóm liệt kê em chưa có nhóm; nộp đúng hạn, muộn được nhận và đánh dấu, chặn nộp muộn, đã đóng, hết lượt, được miễn | Đúng | Đạt 27/10/2026; `assignment-rules.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1232 | P03-19, P03-20 | CT-28c-5 đến CT-28c-8: câu gửi học sinh không có đáp án, hướng dẫn chấm; câu theo phiên bản; trả lời chỉ nhận câu của bài; chấm trắc nghiệm bằng hàm của 22g2 (đúng sai bốn ý theo bậc), quy về thang 10, chưa chấm đủ thì chưa có điểm; thang tiêu chí có trọng số; kết quả hoạt động khi nộp, khi trả, điểm điều chỉnh | Đúng | Đạt 27/10/2026; `assignment-rules.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1233 | P03-19, P03-22 | CT-28c-9, CT-28c-10: tệp nhận theo byte đầu, bỏ khối EXIF của JPEG, giới hạn ảnh, tổng dung lượng, ghi âm theo cấu hình; đề gửi AI không có đáp án, lời nhắc không có chỗ cho bài làm, ghi chú không tự thêm dòng giả | Đúng | Đạt 27/10/2026; `assignment-rules.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1234 | P03-18 | CT-28c-11: soạn bài từ câu đã duyệt, tự luận, ảnh; câu đang soạn, khác môn 422; giáo viên khác 403; bản chụp câu; phát hành chốt danh sách, giao hoạt động; sửa câu sau phát hành 422 | Đúng | Đạt 27/10/2026; `apps/api/src/learning/assignments/assignments.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1235 | P03-19 | CT-28c-12: học sinh không thấy đáp án; nháp khóa lạc quan (409); ảnh bỏ EXIF; tệp lạ 422; nộp một lần; bạn khác không xem được tệp; chưa trả chưa thấy điểm | Đúng | Đạt 27/10/2026; `assignments.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1236 | P03-20, P03-22 | CT-28c-13: chấm câu tự luận, ảnh, quá điểm 422; gợi ý nhận xét AI (bộ giả lập) không có bài làm, tên học sinh; ghi chú có tên 422; trả bài ghi kết quả đạt; học sinh, phụ huynh thấy nhận xét; trao đổi trên bài; phụ huynh khác 403 | Đúng | Đạt 27/10/2026; `assignments.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1237 | P03-21 | CT-28c-14: bài nhóm: nháp chung, chỉ nhóm trưởng nộp, đánh giá đóng góp chỉ bạn cùng nhóm, chỉ giáo viên thấy, điều chỉnh điểm cá nhân phải có lý do, kết quả từng em | Đúng | Đạt 27/10/2026; `assignments.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1238 | P03-19, P03-20 | CT-28c-15: quá hạn, chặn nộp muộn rồi cho nộp muộn (đánh dấu muộn); miễn bài; đóng bài; ngân hàng nhận xét của giáo viên | Đúng | Đạt 27/10/2026; `assignments.test.ts` | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1239 | P03-18 đến P03-20 | CT-28c-16: giao diện: giáo viên tạo bài từ câu đã duyệt và tự luận, giao; học sinh làm, nộp ở `#hoc-sinh`; giáo viên chấm, nhận xét, trả; học sinh thấy điểm 8 và nhận xét; phụ huynh xem nhận xét | Đúng | Chưa chạy trên máy (cổng e2e bị tiến trình cũ chiếm), chờ CI; e2e `tests/e2e/212-online-assignments.spec.ts`; AC-966 | Cao |
| 22_BAO_MAT.md | BM-101 | BM-160 | Bài nộp của học sinh (YCTD-273, BR-304): bài làm, ảnh, tệp, ghi âm là dữ liệu của trẻ; chỉ học sinh của bài (hoặc nhóm em), giáo viên của lớp học trực tuyến xem; phụ huynh chỉ thấy trạng thái, điểm, nhận xét đã trả; ảnh bỏ siêu dữ liệu trên máy và ở máy chủ (không lưu vị trí, máy chụp); tệp nhận theo byte đầu, trả về với `no-store`; đáp án, hướng dẫn chấm không xuống máy học sinh; đánh giá đóng góp chỉ giáo viên xem; không bảng xếp hạng |
| 22_BAO_MAT.md | BM-101 | BM-161 | Trợ lý AI không thấy bài làm (YCTD-273, BR-305, GD-142): yêu cầu gợi ý nhận xét không có trường nào cho bài làm; chữ giáo viên nhập bị quét dữ liệu cá nhân như 23d; nhật ký `ai_requests` chỉ lưu mã băm lời nhắc, loại `feedback` |
