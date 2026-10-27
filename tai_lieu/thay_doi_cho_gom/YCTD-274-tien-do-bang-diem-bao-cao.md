---
yctd: YCTD-274
tieu_de: DT-28 phần 28d: tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo
ngay: 2026-10-28
phien_ban_de_xuat: 0.160.0
---

## 02 Nhật ký

### 2026-10-28 — DT-28 phần 28d: tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo

#### Công việc đã thực hiện

- Làm phần 28d theo `32` mục 20.6, 20.7:
  - Tiến độ từng em và cả lớp, theo chương, danh sách cần chú ý, không xếp hạng.
  - Bảng điểm hoạt động (trung bình có trọng số chỉ tham khảo), xuất Excel, PDF.
  - Đưa điểm thường xuyên vào sổ điểm (THCS, THPT) qua `ScoresService.recordActivityScores`, nguồn `activity`.
  - Tiểu học: gợi ý mức đạt môn và nhận xét thường xuyên, giáo viên sửa rồi ghi qua sổ nhận xét của 20c (GD-141).
  - Báo cáo chủ nhiệm, tổ chuyên môn, toàn trường, hoạt động dạy của giáo viên; tóm tắt cho phụ huynh và tóm tắt hằng tuần qua hàng đợi thông báo (bật theo trường).
  - Báo cáo tổng kết dạy học trực tuyến theo học kỳ (Ban Giám hiệu nhập đánh giá, khó khăn, nguyên nhân, kiến nghị), xuất PDF, Excel; hồ sơ dạy học trực tuyến của lớp, môn theo học kỳ.
  - Lượt dùng câu hỏi của bài tập ghi `question_usages` với tỷ lệ đúng.
- Giao diện: ứng dụng giáo viên (Tiến độ và bảng điểm), cổng quản trị mục 9.4 Báo cáo học tập trực tuyến, ứng dụng phụ huynh (sắp đến hạn, nhận xét gần đây).
- Kiểm thử:
  - 12/12 ca của `progress-rules.test.ts`, `progress.test.ts`.
  - Hồi quy đạt: `assignments` (có kiểm `question_usages`), `learning`, `scores`, `assessments`, `settings`, `quick-links`, `exam-grading`, `classroom-games`.
  - `migrate.test.ts` đạt; e2e `213-learning-progress` và `212-online-assignments` đạt (chạy kèm spec nền 01 đến 09; spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường).
  - Chạy với cơ sở dữ liệu định danh, hệ thống riêng của phiên.

#### Quyết định

- Claude chọn theo ủy quyền: thêm cửa `spaceAccess` ở cuối `LearningService` (như các cửa của 28c) để 28d không chép quy tắc ai xem lớp học trực tuyến.
- `ScoresService` thêm `recordActivityScores` dùng chung thân với `recordExamScores` (cùng quyền nhập, khoá sổ, hạn của 21c); 28d là phần duy nhất sửa `scores/`.
- Tiểu học ghi qua `AssessmentsService.saveSubject`, `addComment` có sẵn, giữ điểm bài kiểm tra và nhận xét môn đang có của từng em.
- Mã khối riêng (BR-320, AC-980, MH-440, CT-1260, BM-170, P03-23) để không va với các PR đang mở; dòng bảng mới neo vào dòng của 28b như 28c.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-274, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; đặc tả 07, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Báo cáo tổ chuyên môn chưa tính độ phủ kế hoạch theo tuần.
- Tóm tắt hằng tuần chỉ gửi trong ứng dụng (không tin nhắn).
- Mẫu thông báo `learning_weekly_summary` không thêm vào bảng mẫu: mã mẫu là chữ tự do, trường sửa nội dung được ở bảng mẫu riêng. Kế hoạch ghi 28e là phần duy nhất thêm mẫu thông báo mới.

## 24 Yêu cầu thay đổi

### YCTD-274: DT-28 phần 28d: tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo – 2026-10-28

- Lý do: phần 28d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270).
  - Áp GD-141 (Eric chốt 2026-10-26): THCS, THPT vào điểm thường xuyên; Tiểu học dùng kết quả hoạt động làm căn cứ nhận xét, mức đạt môn; giáo viên chọn từng hoạt động và xác nhận; công tắc theo trường mặc định bật.
- Căn cứ:
  - Thông tư 09/2021/TT-BGDĐT Điều 8 khoản 1 (lưu hồ sơ dạy học trực tuyến), Điều 15 khoản 6 (báo cáo tổng kết); toàn văn đọc khi viết kế hoạch, mục 20.2.
  - Thông tư 22/2021/TT-BGDĐT (đánh giá thường xuyên THCS, THPT) và Thông tư 27/2020/TT-BGDĐT (Tiểu học đánh giá bằng nhận xét, mức đạt môn): 28d dùng lại quy tắc đã cài ở sổ điểm 21c và sổ nhận xét 20c (số lần, thang, mức, khoá sổ, hạn). Phiên này không đọc lại hai văn bản gốc; quy định đi theo mã đã có của 21c, 20c.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Tiến độ**:
    - Từng em: phần trăm hoạt động bắt buộc đã xong, quá hạn, bài tập chờ chấm, theo chương.
    - "Cần chú ý" khi quá hạn từ 2 hoạt động, hoặc đã có ít nhất 3 hoạt động đến hạn mà xong dưới một nửa, hoặc 14 ngày chưa mở hoạt động nào.
    - Không có thứ hạng.
  - **Bảng điểm hoạt động**:
    - Cột là hoạt động tính điểm và bài tập.
    - Trung bình có trọng số (`weight` của hoạt động) chỉ tham khảo; Tiểu học đếm mức.
    - Xuất Excel, PDF.
  - **Vào sổ điểm**:
    - Một hoạt động lấy đúng điểm; nhiều hoạt động lấy trung bình có trọng số.
    - Miễn ở mọi hoạt động, hoặc còn hoạt động chưa có điểm, thì bỏ trống.
    - Học kỳ, lần đánh giá thường xuyên 1 đến 10, chỉ `kind = regular`.
    - Xem trước có điểm đang có trong sổ.
    - Nhật ký `activity_score_transfers` và nhật ký thao tác.
  - **Tiểu học**:
    - Gợi ý mức T, H, C theo mức hoặc điểm của hoạt động (hòa nghiêng về mức thấp); câu nhận xét gợi ý kèm số hoạt động đã xong.
    - Hiện nhận xét bài tập đã trả và thư viện câu nhận xét 20c.
    - Giáo viên sửa rồi ghi mức đạt môn (`subject_results`) và nhận xét thường xuyên (`regular_comments`).
  - **Báo cáo**:
    - Chủ nhiệm của lớp: mọi môn, học sinh cần chú ý.
    - Tổ chuyên môn: tổ trưởng xem tổ mình, Ban Giám hiệu xem mọi tổ; số lớp có hoạt động, dùng khoá mẫu, hoàn thành bình quân.
    - Toàn trường: lớp đang dùng, hoạt động theo tuần, theo hình thức, tỷ lệ tham gia, trung vị giờ trả bài.
    - Hoạt động dạy của giáo viên.
    - Phụ huynh: tiến độ, hạn trong 7 ngày tới, nhận xét đã trả.
  - **Tóm tắt hằng tuần** (cấu hình `learning_weekly_summary_enabled`, mặc định tắt): sáng thứ Hai từ 7 giờ, mỗi em một thông báo trong ứng dụng mỗi tuần, mẫu `learning_weekly_summary`; chạy theo lịch mỗi giờ.
  - **Hồ sơ Thông tư 09**:
    - Báo cáo tổng kết học kỳ: số liệu tự tổng hợp theo khoảng ngày của học kỳ; bốn ô do Ban Giám hiệu nhập, mỗi ô tối đa 4.000 ký tự.
    - Hồ sơ dạy học trực tuyến của lớp, môn theo học kỳ: kế hoạch theo tuần, hoạt động có lượt xem, lượt nộp, kết quả từng em.
  - **Câu hỏi**: khi trả bài tập, mỗi câu đã duyệt của bài ghi `question_usages` nguồn `activity` (số bài, tỷ lệ đúng của lớp).
  - **Cấu hình**: `learning_gradebook_enabled` (mặc định bật), `learning_weekly_summary_enabled` (mặc định tắt).
- Thành phần bị ảnh hưởng:
  - `apps/api`: thư mục mới `learning/progress`; cửa `spaceAccess` ở cuối `learning.ts`; `scores/scores.ts` thêm `recordActivityScores`; `assignments.ts` ghi lượt dùng câu hỏi khi trả bài; `settings/setting-definitions.ts`; đăng ký thêm cuối `application.module.ts`; danh sách ở `working-level.test.ts`.
  - `apps/portal`: `OnlineLearningReportsPage.tsx`, `router.tsx`.
  - `apps/teacher`: `LearningProgressScreen.tsx`, `OnlineClassesScreen.tsx`.
  - `apps/parent`: `OnlineLearningPanel.tsx`.
  - `packages/shared`: đường dẫn, quy tắc menu, mục 9.4.
  - `database`: năm học 0180, 0181.
  - `tests/e2e/213-learning-progress.spec.ts`.
- Dữ liệu bị ảnh hưởng: năm học `0180` (nguồn `activity` cho `score_entries`, `question_usages`), `0181` (`online_teaching_term_reports`, `activity_score_transfers`).
- API bị ảnh hưởng: nhóm `/api/v1/learning` (xem `17_DAC_TA_API.md` mục 17.4).
- Giao diện bị ảnh hưởng: MH-440 đến MH-442.
- Quyền bị ảnh hưởng: không thêm quyền. Tuyến nhân sự cần một trong `P02.learning.teach`, `P02.learning.view`, `P02.learning.decide`, `P02.assignment.manage`; báo cáo nào xem được kiểm theo vai trò ở máy chủ; ghi sổ dùng quyền nhập của 21c, 20c.
- Ảnh hưởng chức năng cũ: sổ điểm nhận thêm nguồn `activity`; không đổi hành vi khác.
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho; e2e `single` (spec 213 cùng các spec hiện có); typecheck, lint, build.
- Chưa làm (YCTD sau): độ phủ kế hoạch theo tuần ở báo cáo tổ; tóm tắt hằng tuần qua tin nhắn; xuất hồ sơ dạy học trực tuyến cả trường một lần.
- Trạng thái: Đã triển khai (PR chờ)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-28 phần 28d, tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (YCTD-274).
- Chức năng mới:
  - Tiến độ và học sinh cần chú ý (P03-23, MH-440).
  - Bảng điểm hoạt động (P03-24).
  - Đưa kết quả hoạt động vào sổ điểm, sổ nhận xét (P03-25).
  - Báo cáo theo vai trò, tóm tắt cho phụ huynh (P03-26, MH-441, MH-442).
  - Hồ sơ dạy học trực tuyến theo Thông tư 09 (P03-27).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0180`, `0181`; xem `16_CO_SO_DU_LIEU.md` mục 18J.
- Thay đổi API: xem `17_DAC_TA_API.md` mục 17.4.
- Kiểm thử: kịch bản CT-1260 đến CT-1268 (CT-28d-1 đến CT-28d-13 trong mã kiểm thử); `apps/api` 12/12 ca của 28d ngày 28/10/2026.
- Rủi ro: tóm tắt hằng tuần chạy theo giờ của máy chủ mỗi giờ một lần, chỉ gửi trong ứng dụng; báo cáo đọc trực tiếp từ bảng kết quả, trường lớn có thể chậm.
- Khả năng tương thích: không đổi hành vi các phân hệ cũ; sổ điểm có thêm nguồn `activity`.
- Phương án quay lui: hoàn lại commit gộp của nhánh 28d; migration 0180 trả ràng buộc nguồn về như cũ, 0181 chỉ thêm bảng.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28d: tiến độ học trực tuyến và học sinh cần chú ý, bảng điểm hoạt động, đưa kết quả vào sổ điểm (điểm thường xuyên) và sổ nhận xét (Tiểu học), báo cáo theo vai trò, tóm tắt cho phụ huynh, báo cáo tổng kết và hồ sơ dạy học trực tuyến theo Thông tư 09 (YCTD-274) | Đã triển khai |

## index Số đếm

| 10 | mã chức năng | +5 |
| 10 | còn hiệu lực | +5 |
| 14 | màn hình | +3 |
| 16 | bảng dự kiến | +2 |
| Chức năng đã liệt kê | Số lượng | +5 |
| Chức năng đã liệt kê | mã; | +5 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +7 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +6 |
| Bảng dữ liệu dự kiến | Số lượng | +2 |
| Màn hình dự kiến | Số lượng | +3 |
| Ca kiểm thử khởi đầu | Số lượng | +9 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-440 đến MH-442 (YCTD-274) |

## Thêm dòng

| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-23 | Tiến độ học trực tuyến và học sinh cần chú ý (YCTD-274, DT-28 phần 28d) | Giáo viên của lớp học trực tuyến, chủ nhiệm, tổ trưởng, Ban Giám hiệu | Lớp học trực tuyến | Phần trăm hoạt động bắt buộc đã xong, quá hạn, chờ chấm, theo chương từng em; danh sách cần chú ý; không xếp hạng | Lưới tiến độ, danh sách cần chú ý | BR-320 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-24 | Bảng điểm hoạt động (YCTD-274) | Giáo viên của lớp học trực tuyến | Lớp học trực tuyến | Cột theo hoạt động tính điểm, bài tập; trung bình có trọng số chỉ tham khảo; Tiểu học đếm mức | Bảng điểm, tệp Excel, PDF | BR-321 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-25 | Đưa kết quả hoạt động vào sổ điểm, sổ nhận xét (YCTD-274, GD-141) | Giáo viên của lớp học trực tuyến theo lớp, môn | Hoạt động, cách gộp, học kỳ, lần đánh giá thường xuyên (THCS, THPT); kỳ đánh giá, mức, nhận xét đã sửa (Tiểu học) | Xem trước rồi xác nhận; ghi qua sổ điểm 21c (chỉ điểm thường xuyên) hoặc sổ nhận xét 20c với cùng quyền, khoá, hạn; công tắc theo trường | Điểm thường xuyên, mức đạt môn, nhận xét thường xuyên; nhật ký chuyển | BR-322, BR-323 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-26 | Báo cáo học tập trực tuyến theo vai trò, tóm tắt cho phụ huynh (YCTD-274) | Chủ nhiệm, tổ trưởng, Ban Giám hiệu; phụ huynh | Lớp, tổ, toàn trường; học sinh | Tổng hợp tiến độ, quá hạn, cần chú ý, hoạt động theo tuần, tỷ lệ tham gia, thời gian trả bài; tóm tắt hằng tuần qua hàng đợi thông báo khi trường bật | Báo cáo, thông báo trong ứng dụng | BR-324 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-27 | Hồ sơ dạy học trực tuyến theo Thông tư 09 (YCTD-274) | Ban Giám hiệu; giáo viên của lớp học trực tuyến | Học kỳ; đánh giá, khó khăn, nguyên nhân, kiến nghị | Báo cáo tổng kết học kỳ có số liệu tự tổng hợp; hồ sơ dạy học trực tuyến của lớp, môn theo học kỳ; lượt dùng câu hỏi của bài tập | Tệp PDF, Excel | BR-325 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-320 | Tiến độ học trực tuyến (YCTD-274, DT-28 phần 28d): phần trăm tính trên hoạt động bắt buộc đã giao; hoàn thành gồm hoàn thành, đạt, miễn; "cần chú ý" khi quá hạn từ 2 hoạt động bắt buộc, hoặc đã có ít nhất 3 hoạt động bắt buộc đến hạn mà xong dưới một nửa, hoặc 14 ngày chưa mở hoạt động nào; chỉ giáo viên, chủ nhiệm, Ban Giám hiệu thấy; không có thứ hạng, bảng xếp hạng ở bất kỳ màn hình nào; vi phạm: người không xem được lớp học trực tuyến nhận 403 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-321 | Bảng điểm hoạt động (YCTD-274): cột là hoạt động tính điểm và bài tập đã giao; trung bình có trọng số theo trọng số của hoạt động chỉ tham khảo, ghi rõ không phải điểm trung bình môn của Thông tư 22; Tiểu học hiện mức, không tính trung bình; vi phạm: không có |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-322 | Đưa kết quả hoạt động vào sổ điểm (YCTD-274, GD-141, THCS, THPT): chỉ giáo viên của lớp học trực tuyến theo lớp, môn; chỉ điểm đánh giá thường xuyên, lần 1 đến 10 của học kỳ; một hoạt động lấy đúng điểm, nhiều hoạt động (tối đa 20) lấy trung bình có trọng số, làm tròn một chữ số thập phân; em được miễn mọi hoạt động đã chọn hoặc còn hoạt động chưa có điểm thì bỏ trống; ghi qua sổ điểm với cùng quyền nhập môn, khoá sổ, hạn nhập của 21c, nguồn `activity`; xem trước trước khi ghi; không có gì tự ghi; trường tắt `learning_gradebook_enabled` thì không ghi được; vi phạm: 422, 403 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-323 | Sổ nhận xét Tiểu học từ kết quả hoạt động (YCTD-274, GD-141): không ghi điểm số; gợi ý mức đạt môn Hoàn thành tốt, Hoàn thành, Chưa hoàn thành theo mức hoặc điểm của hoạt động (9 trở lên là tốt, 5 trở lên là hoàn thành; mức chiếm nhiều nhất, hòa nghiêng về mức thấp); câu nhận xét gợi ý kèm số hoạt động đã xong; giáo viên sửa, chọn kỳ đánh giá rồi ghi qua sổ nhận xét của 20c với cùng quyền, khoá, hạn; giữ điểm bài kiểm tra, nhận xét môn đang có; vi phạm: 422, 403 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-324 | Báo cáo học tập trực tuyến theo vai trò (YCTD-274): chủ nhiệm xem lớp mình; tổ trưởng xem các lớp của môn trong tổ; Ban Giám hiệu xem toàn trường, mọi tổ, hoạt động dạy của giáo viên; phụ huynh xem con; tóm tắt hằng tuần cho phụ huynh khi trường bật `learning_weekly_summary_enabled` (mặc định tắt), gửi sáng thứ Hai từ 7 giờ, mỗi em một thông báo trong ứng dụng mỗi tuần; vi phạm: 403 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-325 | Hồ sơ dạy học trực tuyến (YCTD-274, Thông tư 09/2021/TT-BGDĐT Điều 8 khoản 1, Điều 15 khoản 6): báo cáo tổng kết theo học kỳ có số liệu tự tổng hợp trong khoảng ngày của học kỳ và bốn ô đánh giá, khó khăn, nguyên nhân, kiến nghị do Ban Giám hiệu nhập (mỗi ô tối đa 4.000 ký tự), xuất PDF, Excel; hồ sơ của lớp, môn theo học kỳ gồm kế hoạch theo tuần, hoạt động có lượt xem, lượt nộp, kết quả từng em; khi trả bài tập, mỗi câu đã duyệt của bài ghi lượt dùng với tỷ lệ đúng của lớp; vi phạm: 403, 422 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-980 | Cho lớp 6A có hai hoạt động quá hạn, An xong cả bốn hoạt động, Bình chưa làm hai bài quá hạn / Khi giáo viên mở lưới tiến độ, giáo viên khác mở / Thì An 4/4 (100%), Bình quá hạn 2 và có trong danh sách cần chú ý; không có thứ hạng; giáo viên khác 403 | CT-1263 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-981 | Cho An có điểm 8 (trọng số 1) và 9 (trọng số 2) / Khi giáo viên mở bảng điểm hoạt động, tải Excel, mở lớp Tiểu học / Thì trung bình tham khảo 8,7 kèm dòng ghi không phải điểm trung bình môn; tệp Excel tải được; lớp Tiểu học đếm mức | CT-1263 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-982 | Cho hai hoạt động tính điểm, Bình chưa có điểm một hoạt động / Khi xem trước đưa vào sổ (lần 2, học kỳ I), giáo viên khác ghi, giáo viên ghi, lớp Tiểu học xem trước, trường tắt công tắc / Thì An 8,7, Bình bỏ trống; giáo viên khác 403; ghi 1 em, bỏ trống 1, sổ có điểm nguồn `activity` lần 2; Tiểu học 422; tắt công tắc 422 | CT-1264 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-983 | Cho lớp 3A, Chi đạt mức tốt ở bài đọc hiểu / Khi giáo viên xem gợi ý, ghi với kỳ giữa học kỳ I / Thì gợi ý mức Hoàn thành tốt, câu nhận xét có "hoàn thành 1/1 hoạt động"; sổ có mức T và nhận xét thường xuyên đã sửa | CT-1265 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-984 | Cho chủ nhiệm 6A, giáo viên khác, Hiệu trưởng / Khi xem báo cáo chủ nhiệm, toàn trường, hoạt động dạy, tổ chuyên môn / Thì chủ nhiệm thấy các môn và Bình cần chú ý; giáo viên khác 403; Hiệu trưởng thấy 2 lớp đang dùng, 5 hoạt động; giáo viên xem toàn trường, tổ 403 | CT-1266 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-985 | Cho Hiệu trưởng, giáo viên / Khi Hiệu trưởng lưu báo cáo tổng kết học kỳ I, xuất PDF, xem học kỳ sai; giáo viên lưu; giáo viên xuất hồ sơ dạy học trực tuyến của lớp / Thì báo cáo lưu, có số liệu 5 hoạt động; tệp PDF; học kỳ sai 422; giáo viên 403; tệp Excel hồ sơ tải được | CT-1267 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-986 | Cho phụ huynh của An, phụ huynh khác / Khi xem tóm tắt việc học / Thì phụ huynh của An thấy tiến độ 4 hoạt động đã xong; phụ huynh khác 403 | CT-1267 |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-440 | Ứng dụng giáo viên: Tiến độ và bảng điểm (YCTD-274, nút "Tiến độ và bảng điểm" ở chi tiết lớp học trực tuyến): danh sách "Tiến độ từng em" (xong, phần trăm, quá hạn, chờ chấm, nhãn "Cần chú ý" kèm lý do); khối "Bảng điểm hoạt động" (dòng ghi chỉ tham khảo, điểm hoặc mức từng hoạt động, trung bình tham khảo, nút "Tải bảng điểm Excel"); THCS, THPT: khối "Đưa vào sổ điểm (điểm thường xuyên)" (chọn hoạt động, học kỳ, lần đánh giá, "Xem trước", "Ghi vào sổ điểm"); Tiểu học: khối "Gợi ý mức đạt môn và nhận xét" (kỳ đánh giá, mức và nhận xét từng em sửa được, nhận xét bài tập đã trả, "Ghi vào sổ nhận xét") (người dùng: Giáo viên) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-441 | Cổng quản trị: 9.4 Báo cáo học tập trực tuyến (YCTD-274, `/online-learning-reports`): thẻ Chủ nhiệm (chọn lớp; bảng các môn; học sinh cần chú ý), Tổ chuyên môn (mỗi tổ: số lớp có hoạt động, dùng khoá mẫu, hoàn thành bình quân, bảng lớp), Toàn trường (số liệu), Hoạt động dạy của giáo viên (bảng), Tổng kết học kỳ (chọn học kỳ, số liệu, bốn ô Đánh giá, Khó khăn, Nguyên nhân, Kiến nghị, nút "Lưu báo cáo tổng kết", "Xuất PDF", "Xuất Excel") (người dùng: Chủ nhiệm, tổ trưởng, Ban Giám hiệu) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-442 | Ứng dụng phụ huynh: tóm tắt trong khung Học trực tuyến của con (YCTD-274): khối "Sắp đến hạn (7 ngày tới)" (hoạt động, lớp học trực tuyến, hạn) và "Nhận xét gần đây của thầy cô" (nhận xét bài tập đã trả) (người dùng: Phụ huynh) |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1260 | P03-23, P03-24 | CT-28d-1, CT-28d-2: cần chú ý theo quá hạn, tỷ lệ xong số đã đến hạn, 14 ngày chưa mở; tiến độ theo chương; trung bình có trọng số chỉ hoạt động tính điểm có điểm; đếm mức | Đúng | Đạt 28/10/2026; `apps/api/src/learning/progress/progress-rules.test.ts`; AC-980, AC-981 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1261 | P03-25 | CT-28d-3, CT-28d-4: điểm một hoạt động, trung bình có trọng số, bỏ trống khi chưa có điểm hoặc miễn mọi hoạt động; đọc yêu cầu đưa vào sổ; Tiểu học gợi ý mức theo mức, điểm, hòa nghiêng về mức thấp, câu nhận xét | Đúng | Đạt 28/10/2026; `progress-rules.test.ts`; AC-982, AC-983 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1262 | P03-26, P03-27 | CT-28d-5: tuần bắt đầu thứ Hai giờ Việt Nam, trung vị giờ trả bài, tỷ lệ đúng của lớp mỗi câu, giới hạn chữ của báo cáo tổng kết | Đúng | Đạt 28/10/2026; `progress-rules.test.ts`; AC-984, AC-985 | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1263 | P03-23, P03-24 | CT-28d-6, CT-28d-7: lưới tiến độ, cần chú ý, không thứ hạng, giáo viên khác 403; bảng điểm hoạt động, trung bình 8,7, tệp Excel, Tiểu học đếm mức | Đúng | Đạt 28/10/2026; `apps/api/src/learning/progress/progress.test.ts`; AC-980, AC-981 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1264 | P03-25 | CT-28d-8: đưa điểm thường xuyên vào sổ điểm: xem trước, giáo viên khác 403, ghi nguồn `activity` lần 2, bỏ trống em chưa có điểm, Tiểu học 422, tắt công tắc 422 | Đúng | Đạt 28/10/2026; `progress.test.ts`; AC-982 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1265 | P03-25 | CT-28d-9: Tiểu học: gợi ý mức đạt môn và nhận xét, ghi mức T và nhận xét thường xuyên qua sổ nhận xét | Đúng | Đạt 28/10/2026; `progress.test.ts`; AC-983 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1266 | P03-26 | CT-28d-10: báo cáo chủ nhiệm (giáo viên khác 403), toàn trường (giáo viên 403), hoạt động dạy của giáo viên, tổ chuyên môn (giáo viên không là tổ trưởng 403) | Đúng | Đạt 28/10/2026; `progress.test.ts`; AC-984 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1267 | P03-26, P03-27 | CT-28d-11, CT-28d-12: báo cáo tổng kết học kỳ lưu, xuất PDF, học kỳ sai 422, giáo viên 403; hồ sơ dạy học trực tuyến Excel; phụ huynh xem tóm tắt của con, phụ huynh khác 403 | Đúng | Đạt 28/10/2026; `progress.test.ts`; AC-985, AC-986 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1268 | P03-23, P03-24, P03-26, P03-27 | CT-28d-13: giao diện: giáo viên mở Tiến độ và bảng điểm, thấy em quá hạn cần chú ý, trung bình tham khảo; Hiệu trưởng mở 9.4, xem toàn trường, lưu tổng kết học kỳ, tải lại vẫn còn | Đúng | Đạt 28/10/2026; e2e `tests/e2e/213-learning-progress.spec.ts`; AC-980, AC-984, AC-985 | Cao |
| 22_BAO_MAT.md | BM-101 | BM-170 | Báo cáo học tập trực tuyến (YCTD-274, BR-320, BR-324): không có thứ hạng, bảng xếp hạng học sinh; danh sách cần chú ý chỉ giáo viên của lớp, chủ nhiệm, Ban Giám hiệu thấy; báo cáo kiểm vai trò ở máy chủ (chủ nhiệm lớp mình, tổ trưởng tổ mình); tóm tắt cho phụ huynh chỉ về con mình, gửi trong ứng dụng, không qua tin nhắn; tệp bảng điểm, hồ sơ trả về với `no-store`; ghi sổ có nhật ký chuyển và nhật ký thao tác |
