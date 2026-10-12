# Nháp tài liệu phần 10g: Giảng dạy

## YCTD

### YCTD-80: Giảng dạy – 2026-10-12

- Lý do: phần 10g theo cách chia ở YCTD-73. Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền dùng đã cấp trước ở tệp 0033 định danh: `P03.lesson.manage` (VT-07, VT-08) soạn bài học và giáo án; `P03.lesson-plan.review` (VT-17, VT-03) duyệt hoặc trả lại giáo án; `P03.curriculum.manage` (VT-03, VT-07) quản lý lĩnh vực, nhóm bài học, chủ đề, thời khóa biểu, kế hoạch giảng dạy, lịch hoạt động lớp; `P03.progress.record` (VT-07) ghi tiến độ học tập. Phạm vi theo đơn vị được gán, gán ở Trường chính là toàn trường. Không thêm quyền mới. VT-02, VT-15 (ô D của ma trận P03) chưa có quyền duyệt giáo án vì tệp 0033 không cấp; họ xem dữ liệu giảng dạy của lớp theo phạm vi đơn vị.
  - Lĩnh vực, nhóm bài học, chủ đề (P03-03, P03-08) thuộc đơn vị; danh mục và bài học của Trường chính dùng chung cho mọi đơn vị. Tên lĩnh vực duy nhất trong đơn vị, tên nhóm duy nhất trong lĩnh vực; nhóm thuộc đúng một lĩnh vực, cùng đơn vị với lĩnh vực. Ngừng dùng bằng trạng thái (BR-75), thêm điểm cuối PATCH cho ba danh mục. VT-07 có quyền quản lý danh mục ở đơn vị mình theo quyền được cấp.
  - Bài học (P03-01): giáo viên soạn cho đơn vị (mặc định đơn vị được gán đầu tiên, ứng dụng giáo viên gửi đơn vị của lớp); chủ đề, lĩnh vực, nhóm phải đang dùng và thuộc đơn vị của bài học hoặc Trường chính; chọn nhóm mà không chọn lĩnh vực thì lấy lĩnh vực của nhóm, nhóm khác lĩnh vực đã chọn bị từ chối. "Chia sẻ" là cờ `is_shared`: bài học riêng chỉ người soạn thấy và dùng (cùng người có vai trò văn phòng hoặc tổ trưởng trong đơn vị xem được); bài học chia sẻ thì giáo viên khác trong đơn vị thấy và dùng cho giáo án. Chỉ người soạn sửa bài học. Lọc theo chủ đề, lĩnh vực, nhóm, độ tuổi, `mine`; lọc lĩnh vực chỉ trả bài học thuộc lĩnh vực đó (CT-110). Độ tuổi là chữ tự do (mã bậc học).
  - Giáo án (P03-02, BR-64) duyệt hai bước đúng như dòng P03-02: giáo viên được phân công lớp (chủ nhiệm hoặc bộ môn) soạn từ bài học của mình hoặc bài học chia sẻ, trạng thái nháp; gửi duyệt thì chờ tổ trưởng duyệt, VT-17 và VT-03 của đơn vị nhận thông báo theo vai trò; tổ trưởng duyệt thì chuyển "tổ trưởng đã duyệt, chờ quản lý duyệt" và VT-03 nhận thông báo; quản lý đơn vị duyệt thì giáo án đã duyệt và công bố (công bố là trạng thái `approved`, phụ huynh không xem giáo án). Quản lý đơn vị duyệt được cả giáo án chưa qua tổ trưởng để đơn vị chưa có tổ trưởng không bị tắc. Trả lại (góp ý) bắt buộc nội dung góp ý, ở bước nào cũng về trạng thái bị trả lại; giáo viên sửa rồi gửi lại. Không ai duyệt giáo án của chính mình. Mỗi lần duyệt, trả lại ghi một dòng lịch sử `lesson_plan_reviews` (bước, quyết định, góp ý). Chỉ sửa giáo án nháp hoặc bị trả lại.
  - Phạm vi của tổ trưởng chuyên môn: chưa có bảng tổ chuyên môn (điểm cuối `/teaching-groups` ở mục 6 của `17` chưa làm), nên VT-17 duyệt giáo án của mọi lớp trong đơn vị được gán. Tổ trưởng vẫn không xem hồ sơ trẻ, tiến độ học tập (giữ nguyên `child-scope.ts`); tổ trưởng xem được giáo án, thời khóa biểu, kế hoạch giảng dạy, lịch hoạt động của lớp trong đơn vị.
  - Thời khóa biểu (P03-04) lưu theo phiên bản áp dụng từ thứ Hai của một tuần, mỗi dòng là một tiết (thứ 1–7, tiết 1–20, giờ HH:MM, hoạt động, giáo viên tùy chọn là người đang được phân công lớp). `PUT` thay toàn bộ bản nháp của phiên bản; trong lớp không trùng thứ và tiết, không trùng khung giờ trong cùng thứ; một giáo viên không có tiết chồng giờ ở lớp khác (so với phiên bản đang áp dụng của lớp kia tại ngày áp dụng); vi phạm trả mã P03-04. Không lập cho tuần đã qua. Phiên bản đã công bố không sửa được, lập phiên bản từ tuần khác. Đọc theo tuần lấy phiên bản mới nhất có ngày áp dụng không sau thứ Hai của tuần; phụ huynh chỉ thấy phiên bản đã công bố. Người lập: VT-03 trong đơn vị hoặc giáo viên chủ nhiệm của lớp (VT-07).
  - Lịch hoạt động lớp (P03-07): VT-03 hoặc giáo viên chủ nhiệm lập hoạt động nháp theo ngày (không trước hôm nay), không trùng giờ với hoạt động chưa hủy của lớp trong ngày (mã P03-07); công bố theo khoảng ngày; hoạt động nháp sửa được, đã công bố chỉ hủy được (phụ huynh nhận thông báo hủy). Phụ huynh chỉ thấy hoạt động đã công bố.
  - Kế hoạch giảng dạy (P03-05): theo lớp và kỳ (học kỳ HK1, HK2, HE; tháng YYYY-MM; tuần YYYY-Www), mỗi lớp một kế hoạch mỗi kỳ; trạng thái đã lập, đang thực hiện, hoàn thành; ghi tiến độ bằng `progress_note`. Người lập, sửa: VT-03 hoặc giáo viên chủ nhiệm. Không qua duyệt.
  - Tiến độ học tập (P03-06): giáo viên có `P03.progress.record` và đang được phân công lớp hiện tại của trẻ ghi các chỉ số theo kỳ (học kỳ hoặc tháng); chỉ số là chữ tự do tối đa 200 ký tự (chưa có danh mục chỉ số phát triển), gắn lĩnh vực tùy chọn, mức Đạt, Đang phát triển, Chưa đạt, nhận xét. Ghi lại cùng chỉ số thì cập nhật. Công bố cả phiếu của kỳ, phụ huynh nhận thông báo; kỳ đã công bố không ghi thêm, không sửa (mã P03-06). Nhân sự xem theo phạm vi xem trẻ (BR-72), phụ huynh chỉ xem phiếu đã công bố của con (BR-15).
  - Thêm điểm cuối `GET /children/{id}/learning` cho ứng dụng phụ huynh: lớp hiện tại, thời khóa biểu tuần này và lịch hoạt động 14 ngày tới đã công bố, phiếu tiến độ đã công bố.
  - Mở năm học mới chuyển lĩnh vực, nhóm bài học, chủ đề, bài học (giữ mã); giáo án, thời khóa biểu, kế hoạch giảng dạy, tiến độ, lịch hoạt động gắn với lớp của năm cũ nên tra ở năm cũ. Bước chạy sau bước chuyển kho. Giáo án đang chờ duyệt không chặn mở năm học mới.
  - Giao diện: cổng quản trị trang Bài học và giáo án (`/teaching`), nhóm điều hướng mới "GIẢNG DẠY"; ứng dụng giáo viên màn hình Giảng dạy lớp (soạn bài học, giáo án, gửi duyệt, xem góp ý; thời khóa biểu tuần này; lịch hoạt động; tiến độ học tập); ứng dụng phụ huynh bảng Học tập trên thẻ của trẻ. Tổ trưởng duyệt giáo án trên cổng quản trị (MG-17 trên ứng dụng giáo viên chưa làm).
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: mười bảng mới của năm học (tệp 0036): `lesson_domains`, `lesson_groups`, `themes`, `lessons`, `lesson_plans`, `lesson_plan_reviews`, `timetables`, `teaching_plans`, `child_progress`, `class_activity_schedules`. Không thêm quyền mới.
- API bị ảnh hưởng: mục 7 Giảng dạy của `17`.
- Giao diện bị ảnh hưởng: MG-05, MG-06, MG-17, MP-04, MP-05; thêm trang cổng quản trị Bài học và giáo án.
- Quyền bị ảnh hưởng: PQ-45.
- Ảnh hưởng chức năng cũ: thêm một bước chuyển năm học (sau bước kho); thêm nút Giảng dạy trên danh sách lớp của ứng dụng giáo viên và nút Học tập trên thẻ của trẻ ở ứng dụng phụ huynh.
- Kiểm thử cần thực hiện: CT-110; kiểm thử máy chủ `apps/api/src/teaching/teaching.test.ts`; kiểm thử giao diện `tests/e2e/36-teaching.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

| lesson_domains | Lĩnh vực bài học (P03-08) | org_unit_id, name (duy nhất trong đơn vị), order_no, status, created_by |
| lesson_groups | Nhóm bài học (P03-08) | org_unit_id, domain_id, name (duy nhất trong lĩnh vực), order_no, status, created_by |
| themes | Chủ đề giảng dạy (P03-03) | org_unit_id, name, age_group, start_date, end_date, status, created_by |
| lessons | Bài học (P03-01) | org_unit_id, theme_id, domain_id, lesson_group_id, name, age_group, objectives, materials, is_shared, status, created_by |
| lesson_plans | Giáo án theo lớp (P03-02) | lesson_id, class_id, org_unit_id, teacher_id, teacher_name, planned_date, activities, duration_minutes (5–480), materials, status (draft, submitted, leader_approved, approved, returned), submitted_at, leader_reviewed_by, leader_reviewed_at, approved_by, approved_at, review_comment |
| lesson_plan_reviews | Lịch sử duyệt và góp ý giáo án | lesson_plan_id, reviewer_id, reviewer_name, stage (leader, manager), decision (approved, returned), comment, created_at |
| timetables | Thời khóa biểu theo phiên bản tuần (P03-04) | class_id, effective_from (thứ Hai), weekday (1–7), period_no, start_time, end_time (HH:MM), activity_name, teacher_id, teacher_name, status (draft, published), published_at, created_by; duy nhất theo lớp, ngày áp dụng, thứ, tiết |
| teaching_plans | Kế hoạch giảng dạy (P03-05) | class_id, org_unit_id, period_type (term, month, week), period_value, objectives, content, progress_note, status (planned, in_progress, completed); duy nhất theo lớp và kỳ |
| child_progress | Tiến độ học tập của trẻ (P03-06) | child_id, class_id, period_type (term, month), period_value, domain_id, indicator_code, level (achieved, developing, not_yet), comment, recorded_by, published_at, published_by; duy nhất theo trẻ, kỳ, chỉ số |
| class_activity_schedules | Lịch hoạt động lớp (P03-07) | class_id, activity_date, start_time, end_time, activity_name, note, status (draft, published, cancelled), published_at, created_by |

## Điểm cuối

| GET, POST | /api/v1/lesson-domains | Danh mục lĩnh vực bài học của đơn vị và Trường chính; thêm lĩnh vực |
| PATCH | /api/v1/lesson-domains/{id} | Sửa tên, thứ tự, ngừng dùng lĩnh vực |
| GET, POST | /api/v1/lesson-groups | Danh mục nhóm bài học, lọc theo lĩnh vực; thêm nhóm |
| PATCH | /api/v1/lesson-groups/{id} | Sửa tên, thứ tự, ngừng dùng nhóm |
| GET, POST | /api/v1/themes | Danh sách và tạo chủ đề giảng dạy |
| PATCH | /api/v1/themes/{id} | Sửa hoặc ngừng dùng chủ đề |
| GET, POST | /api/v1/lessons | Danh sách bài học, lọc theo chủ đề, lĩnh vực, nhóm, độ tuổi, của tôi; tạo bài học |
| PATCH | /api/v1/lessons/{id} | Người soạn cập nhật, chia sẻ hoặc ngừng dùng bài học |
| GET, POST | /api/v1/lesson-plans | Danh sách giáo án của tôi, chờ tôi duyệt hoặc theo lớp và khoảng ngày; soạn giáo án |
| GET, PATCH | /api/v1/lesson-plans/{id} | Chi tiết kèm lịch sử duyệt; cập nhật giáo án nháp hoặc bị trả lại |
| POST | /api/v1/lesson-plans/{id}/submit | Gửi duyệt giáo án |
| POST | /api/v1/lesson-plans/{id}/approve | Tổ trưởng duyệt bước trước; quản lý đơn vị duyệt và công bố |
| POST | /api/v1/lesson-plans/{id}/reject | Trả lại giáo án kèm góp ý |
| GET, PUT | /api/v1/classes/{id}/timetable | Đọc thời khóa biểu theo tuần; lưu bản nháp phiên bản áp dụng từ thứ Hai |
| POST | /api/v1/classes/{id}/timetable/publish | Công bố phiên bản thời khóa biểu cho phụ huynh |
| GET, POST | /api/v1/classes/{id}/activity-schedules | Lịch hoạt động của lớp theo khoảng ngày; thêm hoạt động nháp |
| POST | /api/v1/classes/{id}/activity-schedules/publish | Công bố hoạt động nháp trong khoảng ngày |
| PATCH | /api/v1/class-activity-schedules/{id} | Sửa hoạt động nháp hoặc hủy hoạt động |
| GET, POST | /api/v1/teaching-plans | Kế hoạch giảng dạy của lớp; lập kế hoạch theo lớp và kỳ |
| PATCH | /api/v1/teaching-plans/{id} | Cập nhật kế hoạch, tiến độ, trạng thái |
| GET, POST | /api/v1/children/{id}/progress | Tiến độ học tập của trẻ theo kỳ; ghi chỉ số và nhận xét |
| POST | /api/v1/children/{id}/progress/publish | Công bố phiếu tiến độ của kỳ cho phụ huynh |
| GET | /api/v1/children/{id}/learning | Trang học tập của con: thời khóa biểu, lịch hoạt động, tiến độ đã công bố |

Giao kèo của nhóm điểm cuối giảng dạy (DT-10 phần 10g, YCTD-80):

1. `GET /lesson-domains`, `/lesson-groups`, `/themes`, `/lessons` cho mọi nhân sự (không tính vai trò phụ huynh) trong phạm vi đơn vị, trả bản ghi của đơn vị trong phạm vi và của Trường chính; phụ huynh trả `ERR_FORBIDDEN`. Lọc `org_unit_id`, `status` (mặc định bài học `active`); nhóm lọc thêm `domain_id`; bài học lọc `theme_id`, `domain_id`, `lesson_group_id`, `age_group`, `mine=true`. Người chỉ có vai trò giáo viên thấy bài học của mình và bài học `is_shared`.
2. `POST /lesson-domains` nhận `org_unit_id`, `name`, `order_no`; `POST /lesson-groups` nhận `domain_id`, `name`, `order_no` (đơn vị lấy theo lĩnh vực; lĩnh vực ngừng dùng trả mã BR-75); `POST /themes` nhận `org_unit_id`, `name`, `age_group`, `start_date`, `end_date`. Cần `P03.curriculum.manage` ở đơn vị; trùng tên trả `ERR_CONFLICT`. `PATCH` nhận `name`, `order_no` (chủ đề nhận `start_date`, `end_date`, `age_group`), `status`.
3. `POST /lessons` nhận `org_unit_id` (bỏ trống thì lấy đơn vị đầu tiên trong phạm vi `P03.lesson.manage`), `name`, `objectives`, `materials`, `age_group`, `theme_id`, `domain_id`, `lesson_group_id`, `is_shared`; cần `P03.lesson.manage` ở đơn vị. Tham chiếu không đang dùng hoặc khác đơn vị, nhóm khác lĩnh vực trả `ERR_VALIDATION`. `PATCH /lessons/{id}` chỉ người soạn, nhận thêm `status`.
4. `POST /lesson-plans` nhận `lesson_id`, `class_id`, `planned_date`, `activities`, `duration_minutes` (5–480), `materials`; cần `P03.lesson.manage` và phân công đang hiệu lực ở lớp, nếu không trả `ERR_FORBIDDEN`; bài học ngừng dùng, khác đơn vị, hoặc riêng của người khác trả `ERR_VALIDATION`. `PATCH` chỉ người soạn khi nháp hoặc bị trả lại (khác trả mã P03-02). `submit` chỉ người soạn từ nháp hoặc bị trả lại.
5. `approve` (`comment` tùy chọn), `reject` (`comment` bắt buộc) cần `P03.lesson-plan.review`: vai trò VT-03 có quyền ở đơn vị của giáo án là bước quản lý (từ `submitted` hoặc `leader_approved`, duyệt thành `approved`); vai trò VT-17 là bước tổ trưởng (chỉ từ `submitted`, duyệt thành `leader_approved`); ngoài phạm vi trả `ERR_FORBIDDEN`; tự duyệt hoặc sai trạng thái trả mã P03-02.
6. `GET /lesson-plans?view=mine` giáo án của người gọi; `view=review` giáo án của người khác chờ người gọi duyệt theo bước; không có `view` thì bắt buộc `class_id` và người gọi xem được lớp (nhân sự văn phòng hoặc tổ trưởng ở đơn vị của lớp, giáo viên được phân công). Lọc thêm `from`, `to`, `status`. `GET /lesson-plans/{id}` có `lesson`, `class_name`, `reviews`.
7. `PUT /classes/{id}/timetable` nhận `effective_from` (thứ Hai, không trước tuần hiện tại), `slots` (tối đa 100 dòng `weekday`, `period_no`, `start_time`, `end_time`, `activity_name`, `teacher_id`); cần `P03.curriculum.manage` ở đơn vị hoặc chủ nhiệm lớp. Trùng tiết, trùng giờ trong lớp, giáo viên trùng giờ ở lớp khác, tuần đã qua, phiên bản đã công bố trả mã P03-04. `GET` nhận `week` (mặc định hôm nay), trả `effective_from`, `status`, `slots`, `versions` (chỉ nhân sự). `publish` nhận `effective_from`; không có bản nháp trả mã P03-04; phụ huynh của lớp nhận thông báo.
8. `POST /classes/{id}/activity-schedules` nhận `activity_date` (không trước hôm nay), `start_time`, `end_time`, `activity_name`, `note`; trùng giờ trả mã P03-07. `publish` nhận `from`, `to`. `PATCH /class-activity-schedules/{id}` sửa khi nháp hoặc `status=cancelled`. `GET` nhận `from` (mặc định hôm nay), `to` (mặc định 7 ngày); nhân sự thấy nháp và đã công bố, phụ huynh có con trong lớp chỉ thấy đã công bố.
9. `POST /teaching-plans` nhận `class_id`, `period_type`, `period_value`, `objectives`, `content`; trùng kỳ trả `ERR_CONFLICT`. `PATCH` nhận `objectives`, `content`, `progress_note`, `status`. `GET /teaching-plans?class_id=` cho người xem được lớp.
10. `POST /children/{id}/progress` nhận `period_type` (`term`, `month`), `period_value`, `items` (1–50 dòng `indicator_code`, `level`, `comment`, `domain_id`); cần `P03.progress.record` và phân công lớp hiện tại của trẻ; kỳ đã công bố trả mã P03-06. `publish` nhận kỳ; không có chỉ số chưa công bố trả mã P03-06. `GET` nhận kỳ tùy chọn; phụ huynh chỉ thấy chỉ số đã công bố; nhân sự theo phạm vi xem trẻ.
11. `GET /children/{id}/learning` cho phụ huynh của trẻ (hoặc nhân sự xem được trẻ): `class_id`, `class_name`, `timetable` đã công bố của tuần, `activities` đã công bố 14 ngày tới, `progress`.

## Màn hình

| MG-05 | Giáo án, bài học, thời khóa biểu: màn hình Giảng dạy lớp (nút "Giảng dạy" trên danh sách lớp) tạo bài học, soạn giáo án, gửi duyệt, xem trạng thái và góp ý; thời khóa biểu tuần này (YCTD-80) | VT-07, VT-08 |
| MG-06 | Tiến độ và kế hoạch giảng dạy: trên màn hình Giảng dạy lớp, lập và công bố lịch hoạt động 14 ngày tới, ghi chỉ số tiến độ theo học kỳ cho từng trẻ và công bố phiếu; kế hoạch giảng dạy lập trên cổng quản trị (YCTD-80) | VT-07 |
| MG-17 | Duyệt giáo án của tổ: làm trên cổng quản trị, trang Bài học và giáo án, thẻ Giáo án chờ duyệt (duyệt hoặc trả lại kèm góp ý); chưa có trên ứng dụng giáo viên (YCTD-80) | VT-17, VT-03 |
| MH-57 | Bài học và giáo án: thẻ Giáo án chờ duyệt, thẻ Bài học lọc theo lĩnh vực, thẻ Lĩnh vực và chủ đề (thêm lĩnh vực, nhóm, chủ đề của đơn vị), thẻ Thời khóa biểu và kế hoạch (chọn lớp và tuần, lưu bản nháp, công bố thời khóa biểu; lập kế hoạch học kỳ) (YCTD-80) | VT-17, VT-03, VT-07 |
| MP-04 | Thời khóa biểu và lịch hoạt động lớp: bảng Học tập trên thẻ của trẻ, chỉ bản đã công bố (YCTD-80) | VT-14 |
| MP-05 | Tiến độ học tập: bảng Học tập trên thẻ của trẻ, phiếu đã công bố (YCTD-80) | VT-14 |

Ghi chú: mã MH-57 là đề xuất (mã MH lớn nhất hiện có là MH-56); người điều phối đổi nếu phần khác đã dùng.

## Quyền

| PQ-45 | Giảng dạy (YCTD-80): `P03.lesson.manage` cho VT-07, VT-08 soạn bài học (chỉ người soạn sửa) và giáo án cho lớp đang được phân công; `P03.lesson-plan.review` cho VT-17 duyệt bước trước và VT-03 duyệt bước sau, công bố giáo án trong đơn vị được gán, không tự duyệt; `P03.curriculum.manage` cho VT-03 trong đơn vị và VT-07 (chủ nhiệm lớp với dữ liệu của lớp) quản lý lĩnh vực, nhóm bài học, chủ đề, thời khóa biểu, kế hoạch giảng dạy, lịch hoạt động lớp; `P03.progress.record` cho VT-07 ghi và công bố tiến độ học tập của trẻ trong lớp đang được phân công; phụ huynh chỉ đọc thời khóa biểu, lịch hoạt động, tiến độ đã công bố của lớp và của con |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/teaching/teaching.test.ts` đạt 6/6 ca ngày 12/10/2026:

- CT-110: lọc `GET /lessons?domain_id=` chỉ trả bài học thuộc lĩnh vực (bài học có lĩnh vực khác và bài học không có lĩnh vực bị loại). Đạt. Kèm: trùng tên lĩnh vực trả 409, ngoài đơn vị trả 403; nhóm khác lĩnh vực trả 400; giáo viên khác chỉ thấy bài học chia sẻ; người khác không sửa được bài học; phụ huynh không xem được.
- Giáo án: giáo viên không được phân công lớp không soạn được; không dùng được bài học riêng của người khác; gửi duyệt báo VT-17 theo vai trò; tổ trưởng đơn vị khác bị từ chối; trả lại bắt buộc góp ý; sửa và gửi lại; tổ trưởng duyệt thành chờ quản lý duyệt, duyệt lại trả P03-02; quản lý đơn vị duyệt thành đã duyệt; giáo án đã duyệt không sửa được; lịch sử ba lần duyệt. Đạt.
- Thời khóa biểu: trùng khung giờ trong lớp trả P03-04; ngày áp dụng không phải thứ Hai trả 400; giáo viên không chủ nhiệm và giáo viên bộ môn không lập được; giáo viên bộ môn trùng giờ ở lớp khác trả 422; phụ huynh chỉ thấy bản đã công bố, không xem lớp không có con; phiên bản đã công bố không sửa được. Đạt.
- Lịch hoạt động: trùng giờ và ngày đã qua trả 422; phụ huynh chỉ thấy sau công bố; đã công bố không sửa, hủy được. Đạt.
- Kế hoạch giảng dạy: trùng kỳ 409, kỳ sai 400, cập nhật trạng thái, tổ trưởng cùng đơn vị xem được, tổ trưởng đơn vị khác 403. Đạt.
- Tiến độ học tập: chỉ giáo viên được phân công lớp của trẻ có quyền ghi (giáo viên lớp khác, giáo viên bộ môn, trẻ lớp khác đều 403); phụ huynh chỉ thấy sau công bố; tổ trưởng không xem được; kỳ đã công bố không ghi được (P03-06); trang học tập của con trả lớp và tiến độ, con người khác 403. Đạt.

Bước chuyển năm học `teachingTransitionStep` chưa có ca kiểm thử riêng (giống bước y tế). Kiểm thử giao diện `tests/e2e/36-teaching.spec.ts` đã viết (giáo viên tạo bài học, soạn giáo án và gửi duyệt trên ứng dụng giáo viên; tổ trưởng duyệt trên cổng quản trị, giáo án chuyển chờ quản lý duyệt), chưa chạy theo hướng dẫn chung; người điều phối chạy.

## Quy tắc

- Không sửa BR. Các ràng buộc riêng của phân hệ dùng mã chức năng làm mã quy tắc khi trả `ERR_RULE_VIOLATION`: P03-02 (trạng thái giáo án, tự duyệt), P03-04 (trùng khung giờ thời khóa biểu, phiên bản đã công bố), P03-06 (phiếu tiến độ đã công bố), P03-07 (trùng giờ lịch hoạt động). Đề xuất nếu cần thêm quy tắc: "BR mới: Thời khóa biểu của lớp không có hai tiết trùng khung giờ trong cùng thứ, một giáo viên không có hai tiết chồng giờ ở hai lớp; phiên bản đã công bố không sửa".
