# Nháp tài liệu phần 10h — Công việc, đánh giá, quá trình công tác, thưởng và khấu trừ

## YCTD

### YCTD-81: Công việc, kế hoạch, đánh giá nhân sự, quá trình công tác, thưởng và khấu trừ – 2026-10-12

- Lý do: phần 10h theo cách chia ở YCTD-73 (P09-01 đến P09-05, P07-03, P08-07). Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền đã cấp trước ở tệp 0034 của định danh (YCTD-73): `P09.task.assign` (VT-03, VT-06), `P09.plan.manage` (VT-03), `P09.evaluation.manage` (VT-03, VT-06), `P07.work-history.manage` (VT-06), `P08.bonus-deduction.manage` (VT-04, VT-05). Việc cá nhân không cần quyền riêng.
  - Việc gắn với hồ sơ nhân sự (`staff`), không gắn tài khoản trực tiếp: người nhận việc, người phụ trách đầu việc, người được đánh giá đều là hồ sơ nhân sự. Tài khoản chưa gắn hồ sơ nhân sự không có việc cá nhân (trả 404) và danh sách "việc của tôi" trống.
  - Giao việc (P09-01): người có `P09.task.assign` giao cho nhân sự có đơn vị chính trong phạm vi đơn vị được gán (gán ở Trường chính là toàn trường); người nhận phải đang làm và có tài khoản liên kết, nếu không trả 422 mã `P09-01`. Bắt buộc có hạn, hạn không trước hôm nay; mức ưu tiên thấp, bình thường (mặc định), cao. Người nhận nhận thông báo trong ứng dụng `task_assigned`; trung tâm thông báo ghi ai đã đọc (BR-70).
  - Người giao (hoặc người có quyền giao việc trong đơn vị) sửa nội dung, mô tả, hạn, ưu tiên, hoặc hủy việc kèm lý do bắt buộc; người nhận nhận thông báo `task_changed`/`task_cancelled`. Việc đã hoàn thành hoặc đã hủy không sửa được. Người giao không đặt trạng thái khác "đã hủy"; tiến độ do người nhận cập nhật.
  - Việc cá nhân (P09-02): mọi nhân sự có hồ sơ liên kết tài khoản tự tạo (không chọn người nhận hoặc chọn chính mình), hạn không bắt buộc; chỉ chính người đó xem, sửa, đổi trạng thái kể cả mở lại; không hiện cho quản lý, Ban Giám hiệu (BR-46).
  - Theo dõi tiến độ (P09-04): chỉ người nhận cập nhật phần trăm hoàn thành (0–100) kèm ghi chú; 0% là chưa làm, 1–99% đang làm, 100% hoàn thành và người giao nhận thông báo `task_done`; việc đã xong hoặc đã hủy không cập nhật được nữa (422 mã `P09-04`). Mỗi lần cập nhật lưu ở `task_updates`. Việc quá hạn là việc chưa xong có hạn trước hôm nay. Bảng tiến độ theo từng người nhận (tổng, chưa làm, đang làm, hoàn thành, quá hạn, tiến độ trung bình), không tính việc đã hủy, lọc theo đơn vị và khoảng hạn.
  - Người xem việc được giao của đơn vị và bảng tiến độ: người có `P09.task.assign` hoặc `P09.plan.manage` trong phạm vi, và Ban Giám hiệu (VT-02, VT-15) chỉ xem trong phạm vi đơn vị được gán. Kế toán, kế toán trưởng (ô X của ma trận P09) chưa được xem công việc của đơn vị vì không có quyền xem riêng; chỉ xem việc của mình.
  - Kế hoạch (P09-03): người có `P09.plan.manage` lập kế hoạch nháp của đơn vị trong phạm vi với loại kỳ tháng (`YYYY-MM`), học kỳ (`HK1 2026-2027`, `HK2 …`, `HE …`), năm học (`2026-2027`), tên, mục tiêu và tối đa 100 đầu việc (nội dung, người phụ trách là nhân sự đang làm có đơn vị chính là đơn vị lập kế hoạch, hạn). Kích hoạt thì mỗi đầu việc thành một việc được giao cho người phụ trách (người phụ trách phải có tài khoản); kế hoạch đang thực hiện chỉ thêm đầu việc (giao việc ngay), không sửa; đóng kế hoạch thì không thêm được nữa. Tiến độ kế hoạch là trung bình phần trăm các việc của đầu việc, không tính việc đã hủy.
  - Đánh giá (P09-05, BR-47): mỗi đơn vị cấu hình chỉ số (mã duy nhất trong đơn vị, viết hoa; tên; trọng số; điểm tối đa; đang dùng hoặc ngừng dùng). Người có `P09.evaluation.manage` đánh giá nhân sự có đơn vị chính trong phạm vi, không tự đánh giá mình; phải chấm đủ mọi chỉ số đang dùng của đơn vị chính của nhân sự, điểm từ 0 đến điểm tối đa. Điểm tổng thang 100 = tổng (điểm / điểm tối đa × trọng số) / tổng trọng số × 100, làm tròn 2 chữ số; không xếp loại (chưa có quy định xếp loại). Phiếu lưu bản chép mã, tên, trọng số, điểm tối đa của chỉ số lúc chấm nên sửa chỉ số không đổi phiếu cũ.
  - Phiếu nháp sửa được; công bố thì nhân sự nhận thông báo `evaluation_published` và thấy phiếu. Đã công bố thì không sửa (422 `BR-47`); lập đánh giá lại cho cùng kỳ bắt buộc ghi lý do, phiếu mới ghi `replaces_id`; công bố phiếu mới thì phiếu cũ chuyển "đã thay thế". Mỗi nhân sự mỗi kỳ tối đa một phiếu nháp và một phiếu đã công bố. Công bố do chính người quản lý đánh giá thực hiện, không cần duyệt thêm.
  - Quá trình công tác (P07-03, BR-37): phòng nhân sự (`P07.work-history.manage` trong phạm vi đơn vị chính của nhân sự) ghi thêm mốc công tác: đơn vị (mặc định đơn vị chính; đơn vị khác là ghi nhận làm nhiều đơn vị theo BR-37), phòng ban, chức danh (phải thuộc đơn vị của mốc), từ ngày, đến ngày, nội dung; mốc đã ghi không sửa, chỉ ghi ngày kết thúc cho mốc đang mở (mốc đã có ngày kết thúc trả 409). Chứng chỉ: tên, số hiệu, nơi cấp, ngày cấp, ngày hết hạn, ghi chú; ghi nhầm thì xóa (có nhật ký). Người có `P07.staff.view` trong phạm vi và chính nhân sự đó xem được.
  - Chưa đính kèm tệp cho việc được giao và chứng chỉ: việc này phải thêm mục đích tệp mới vào ràng buộc `files_purpose_check`, trong khi nhiều phần của DT-10 cùng sửa ràng buộc này song song nên dễ ghi đè lẫn nhau; để lại cho lượt sau khi gộp xong.
  - Thưởng và khấu trừ (P08-07, BR-44, BR-45): kế toán, kế toán trưởng ghi khoản cho một nhân sự đang làm vào bảng lương của một tháng `YYYY-MM`: loại khoản chọn trong danh mục lương `pay_item_types` (loại phụ cấp là thưởng, loại khấu trừ là khấu trừ khác) đang dùng, số tiền nguyên đồng dương, căn cứ bắt buộc. Khoản đang hiệu lực của tháng M được cộng (thưởng) hoặc trừ (khấu trừ) vào phiếu lương tháng M khi tính hoặc tính lại bảng lương nháp, dòng ở mục "điều chỉnh", căn cứ ghi trên dòng phiếu lương. Thưởng là thu nhập chịu thuế trừ khi loại khoản được đánh dấu miễn thuế; khấu trừ khác không giảm thu nhập tính thuế trừ khi là bảo hiểm bắt buộc. Hủy khoản phải có lý do. Tháng đã có bảng lương chờ duyệt hoặc đã duyệt thì không ghi, không hủy được (422 `BR-45`), sai thì lập khoản điều chỉnh cho kỳ sau. Ghi khoản trên bảng lương nháp thì phải tính lại bảng lương để áp dụng. Nhân sự đã chấm dứt hợp đồng không ghi được (422 `BR-90`, ghi ở bảng quyết toán). Không cần duyệt riêng vì cả bảng lương được duyệt theo hạn mức.
  - Mở năm học mới chuyển quá trình công tác, chứng chỉ, khoản thưởng và khấu trừ, chỉ số và phiếu đánh giá kèm điểm, việc chưa xong (bỏ liên kết kế hoạch) kèm cập nhật tiến độ; kế hoạch và việc đã xong tra ở năm cũ.
  - Giao diện: cổng quản trị thêm ba trang (Công việc và kế hoạch, Đánh giá nhân sự, Thưởng và khấu trừ) và mục quá trình công tác, chứng chỉ trong chi tiết hồ sơ nhân sự; ứng dụng giáo viên thêm màn hình Công việc của tôi (mở từ thẻ chấm công).
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị, ứng dụng giáo viên.
- Dữ liệu bị ảnh hưởng: mười bảng mới của năm học (tệp 0037): `tasks`, `task_updates`, `plans`, `plan_items`, `evaluation_criteria`, `evaluations`, `evaluation_scores`, `staff_work_history`, `staff_certificates`, `staff_bonus_deductions`.
- API bị ảnh hưởng: điểm cuối P09 trong mục 12 của `17`; quá trình công tác, chứng chỉ; thưởng và khấu trừ; tính bảng lương cộng trừ khoản thưởng, khấu trừ của tháng.
- Giao diện bị ảnh hưởng: MH-44 (phần công việc), MH-12 (quá trình công tác, chứng chỉ), MG-12; đề xuất màn hình mới MH-57 Công việc và kế hoạch, MH-58 Đánh giá nhân sự, MH-59 Thưởng và khấu trừ (người điều phối đánh số lại).
- Quyền bị ảnh hưởng: PQ-46.
- Ảnh hưởng chức năng cũ: phiếu lương có thêm dòng thưởng, khấu trừ ghi riêng của tháng; không đổi cách tính các dòng cũ.
- Kiểm thử cần thực hiện: CT-10H-01 đến CT-10H-07 (đề xuất, người điều phối đánh số lại), kiểm thử giao diện `tests/e2e/37-work.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

| tasks | Công việc được giao và việc cá nhân (YCTD-81) | org_unit_id, task_type (được giao, cá nhân), title, description, assigner_user_id, assigner_name, assignee_staff_id, due_date, priority (thấp, bình thường, cao), status (chưa làm, đang làm, hoàn thành, đã hủy), progress_percent, plan_item_id, completed_at, cancel_reason |
| task_updates | Cập nhật tiến độ công việc (YCTD-81) | task_id, content, progress_percent, status, created_by, created_by_name, created_at |
| plans | Kế hoạch của đơn vị theo kỳ (YCTD-81) | org_unit_id, period_type (tháng, học kỳ, năm học), period_value, title, objectives, status (nháp, đang thực hiện, đã đóng), created_by, activated_at, closed_at |
| plan_items | Đầu việc trong kế hoạch (YCTD-81) | plan_id, content, owner_staff_id, due_date, task_id (việc được giao khi kích hoạt), order_no |
| evaluation_criteria | Chỉ số đánh giá của đơn vị (YCTD-81) | org_unit_id, code (duy nhất cùng org_unit_id), name, weight, max_score, status |
| evaluations | Phiếu đánh giá nhân sự theo kỳ (BR-47, YCTD-81) | staff_id, org_unit_id, period_type, period_value, total_score (thang 100), comment, status (nháp, đã công bố, đã thay thế), replaces_id, reevaluation_reason, evaluated_by, evaluated_by_name, published_by, published_at; mỗi nhân sự mỗi kỳ tối đa một phiếu nháp và một phiếu đã công bố |
| evaluation_scores | Điểm từng chỉ số của phiếu đánh giá (YCTD-81) | evaluation_id, criterion_id (duy nhất cùng evaluation_id), criterion_code, criterion_name, weight, max_score (chép lúc chấm), score, comment |
| staff_work_history | Quá trình công tác (BR-37, YCTD-81) | staff_id, org_unit_id, from_date, to_date, department_id, job_title_id, note, created_by |
| staff_certificates | Chứng chỉ (YCTD-81) | staff_id, name, certificate_no, issued_by, issued_date, expire_date, note, created_by |
| staff_bonus_deductions | Thưởng và khấu trừ ghi riêng cho bảng lương một tháng (BR-44, BR-45, YCTD-81) | staff_id, pay_item_type_id, target_year, target_month, amount (dương), basis (căn cứ), status (hiệu lực, đã hủy), created_by, cancelled_by, cancelled_at, cancel_reason |

Ghi chú: thay các dòng `tasks`, `task_updates`, `plans`, `plan_items`, `evaluations`, `evaluation_criteria` ở mục 10 và `staff_work_history`, `staff_certificates` ở mục 8; thêm `staff_bonus_deductions` vào mục 9.

## Điểm cuối

| GET, POST | /api/v1/tasks | Danh sách việc theo `view` (`mine` việc của tôi, `assigned` việc tôi giao, `unit` việc được giao trong đơn vị), lọc `status`, `org_unit_id`, `assignee_staff_id`; tạo việc cá nhân (không có `assignee_staff_id`) hoặc giao việc |
| GET | /api/v1/tasks/{id} | Chi tiết việc kèm các lần cập nhật tiến độ, `can_edit`, `can_update_progress` |
| PATCH | /api/v1/tasks/{id} | Sửa việc; người giao chỉ hủy kèm `cancel_reason`; việc cá nhân đổi được trạng thái |
| POST | /api/v1/tasks/{id}/updates | Người nhận cập nhật `progress_percent` (0–100) kèm `content` |
| GET | /api/v1/task-progress | Bảng tiến độ việc được giao theo người nhận, lọc `org_unit_id`, `from`, `to` (theo hạn) |
| GET, POST | /api/v1/plans | Danh sách kế hoạch kèm tiến độ; lập kế hoạch nháp kèm đầu việc |
| GET, PATCH | /api/v1/plans/{id} | Chi tiết kế hoạch kèm đầu việc và tiến độ; sửa kế hoạch nháp (thay toàn bộ đầu việc) |
| POST | /api/v1/plans/{id}/items | Thêm đầu việc; kế hoạch đang thực hiện thì giao việc ngay |
| POST | /api/v1/plans/{id}/activate | Kích hoạt kế hoạch, giao việc cho người phụ trách từng đầu việc |
| POST | /api/v1/plans/{id}/close | Đóng kế hoạch đang thực hiện |
| GET, POST | /api/v1/evaluation-criteria | Chỉ số đánh giá theo đơn vị; thêm chỉ số |
| PATCH | /api/v1/evaluation-criteria/{id} | Sửa tên, trọng số, điểm tối đa, ngừng dùng chỉ số |
| GET, POST | /api/v1/evaluations | Phiếu đánh giá theo đơn vị, nhân sự, kỳ, trạng thái; lập phiếu nháp (đánh giá lại kèm `reevaluation_reason`) |
| GET, PATCH | /api/v1/evaluations/{id} | Chi tiết phiếu kèm điểm từng chỉ số; sửa phiếu nháp |
| POST | /api/v1/evaluations/{id}/publish | Công bố kết quả đánh giá, phiếu cũ của kỳ chuyển đã thay thế |
| GET | /api/v1/me/evaluations | Phiếu đánh giá đã công bố của chính người đăng nhập |
| GET, POST | /api/v1/staff/{id}/work-history | Quá trình công tác và chứng chỉ của nhân sự; ghi thêm mốc công tác |
| PATCH | /api/v1/staff-work-history/{id} | Ghi ngày kết thúc cho mốc công tác đang mở |
| POST | /api/v1/staff/{id}/certificates | Thêm chứng chỉ |
| DELETE | /api/v1/staff-certificates/{id} | Xóa chứng chỉ ghi nhầm |
| GET, POST | /api/v1/bonus-deductions | Khoản thưởng, khấu trừ theo `month` và `staff_id` kèm `can_cancel`; ghi khoản |
| POST | /api/v1/bonus-deductions/{id}/cancel | Hủy khoản kèm lý do khi bảng lương của tháng còn nháp |

Giao kèo:

1. Việc trả `{ id, task_type: assigned | personal, title, description, org_unit_id, assigner_user_id, assigner_name, assignee_staff_id, assignee_name, due_date, priority: low | normal | high, status: todo | in_progress | done | cancelled, progress_percent, plan_item_id, completed_at, cancel_reason, overdue }`; chi tiết thêm `can_edit`, `can_update_progress`, `updates`.
2. Bảng tiến độ trả `{ rows: [{ staff_id, full_name, total, todo, in_progress, done, overdue, average_progress }], total, done, overdue, average_progress }`.
3. Kế hoạch trả `{ ..., status: draft | active | closed, item_count, done_count, progress_percent }`; chi tiết thêm `can_manage`, `items: [{ id, content, owner_staff_id, owner_name, due_date, task_id, task_status, progress_percent }]`. Kỳ: `period_type` month (`YYYY-MM`), term (`HK1|HK2|HE YYYY-YYYY`), year (`YYYY-YYYY`).
4. Phiếu đánh giá trả `{ id, staff_id, full_name, staff_code, period_type, period_value, total_score, comment, status: draft | published | superseded, replaces_id, reevaluation_reason, evaluated_by_name, published_at, scores: [{ criterion_id, criterion_code, criterion_name, weight, max_score, score, comment }] }`. Lập phiếu gửi `scores: [{ criterion_id, score, comment }]` đủ mọi chỉ số đang dùng.
5. Quá trình công tác trả `{ staff_id, can_manage, history: [{ id, org_unit_id, unit_name, department_name, job_title_name, from_date, to_date, note, is_main_unit }], certificates: [...] }`.
6. Khoản thưởng, khấu trừ trả `{ id, staff_id, full_name, staff_code, pay_item_type_id, kind: allowance | deduction, item_code, item_name, target_year, target_month, amount, basis, status: active | cancelled, cancel_reason, can_cancel }`. Phiếu lương có dòng `line_type` `bonus` hoặc `deduction`, mục `adjustment`, `code` là mã loại khoản.
7. Mã lỗi: `ERR_RULE_VIOLATION` kèm `P09-01` (người nhận nghỉ việc hoặc chưa có tài khoản; việc đã xong hoặc đã hủy), `P09-03` (kế hoạch không ở trạng thái phù hợp), `P09-04` (cập nhật tiến độ việc đã xong), `BR-47` (sửa phiếu đã công bố, đánh giá lại thiếu lý do, đơn vị chưa có chỉ số), `BR-45` (tháng đã trình duyệt bảng lương), `BR-90` (nhân sự đã chấm dứt hợp đồng); `ERR_CONFLICT` khi trùng mã chỉ số, đã có phiếu nháp của kỳ, mốc công tác đã có ngày kết thúc.

## Màn hình

| MH-44 | Cá nhân: chấm công và đơn nghỉ của tôi, phiếu lương của tôi; việc của tôi (được giao và cá nhân) cập nhật tiến độ ở trang Công việc và kế hoạch, kết quả đánh giá của tôi ở trang Đánh giá nhân sự (YCTD-81) | Mọi nhân sự dùng cổng quản trị |
| MH-12 | (thêm vào mô tả hiện có) mục Quá trình công tác và chứng chỉ: phòng nhân sự ghi thêm mốc công tác, ghi chứng chỉ; nhân sự và người xem hồ sơ xem (YCTD-81) | (giữ như cũ) |
| MH-57 (đề xuất) | Công việc và kế hoạch: việc của tôi, thêm việc cá nhân, cập nhật tiến độ; giao việc, bảng tiến độ theo người nhận, việc đã giao trong đơn vị; lập, kích hoạt, đóng kế hoạch theo kỳ kèm tiến độ (YCTD-81) | Mọi nhân sự; VT-03, VT-06 giao việc; VT-03 lập kế hoạch; VT-02, VT-15 xem |
| MH-58 (đề xuất) | Đánh giá nhân sự: chỉ số đánh giá của đơn vị, lập phiếu nháp, công bố, đánh giá lại có lý do; kết quả đánh giá của tôi (YCTD-81) | VT-03, VT-06; VT-02, VT-15 xem; mọi nhân sự xem phiếu của mình |
| MH-59 (đề xuất) | Thưởng và khấu trừ theo tháng bảng lương: ghi khoản có căn cứ, hủy khi bảng lương còn nháp (YCTD-81) | VT-04, VT-05; người xem bảng lương xem |
| MG-12 | Công việc của tôi: việc được giao và việc cá nhân, cập nhật phần trăm hoàn thành, thêm việc cá nhân, kết quả đánh giá đã công bố (YCTD-81) | Mọi nhân sự có hồ sơ liên kết tài khoản dùng ứng dụng giáo viên |

## Quyền

| PQ-46 | Công việc, đánh giá, quá trình công tác, thưởng và khấu trừ (YCTD-81): `P09.task.assign` cho VT-03, VT-06 giao việc cho nhân sự có tài khoản trong đơn vị được gán, sửa, hủy việc đã giao, xem việc được giao và bảng tiến độ của đơn vị; `P09.plan.manage` cho VT-03 lập, kích hoạt, đóng kế hoạch của đơn vị và xem tiến độ; `P09.evaluation.manage` cho VT-03, VT-06 cấu hình chỉ số, đánh giá, công bố trong đơn vị (không tự đánh giá mình); `P07.work-history.manage` cho VT-06 ghi quá trình công tác và chứng chỉ; `P08.bonus-deduction.manage` cho VT-04, VT-05 ghi, hủy thưởng và khấu trừ của tháng chưa trình duyệt bảng lương. Mọi nhân sự có hồ sơ liên kết tài khoản tạo việc cá nhân, cập nhật tiến độ việc của mình, xem phiếu đánh giá đã công bố, quá trình công tác của mình (BR-46). VT-02, VT-15 xem công việc, kế hoạch, phiếu đánh giá trong phạm vi đơn vị được gán; người có `P08.payroll.view` xem thưởng và khấu trừ |

## Kết quả kiểm thử

Kiểm thử máy chủ `apps/api/src/work/work.test.ts`: 8/8 ca đạt ngày 12/10/2026. Tài liệu 21 chưa có kịch bản cho P09, P07-03, P08-07 nên đề xuất thêm (người điều phối đánh số lại):

| Mã đề xuất | Chức năng | Kịch bản | Kết quả mong đợi | Tệp |
|---|---|---|---|---|
| CT-10H-01 | P09-01 | Quản lý giao việc cho nhân sự trong đơn vị; quản lý đơn vị khác, giáo viên giao; người nhận chưa có tài khoản; hạn đã qua | Giao được, người nhận có thông báo; ngoài đơn vị và giáo viên bị chặn 403; chưa có tài khoản 422 `P09-01`; hạn đã qua 400 | `work.test.ts` |
| CT-10H-02 | P09-02 | Giáo viên tạo việc cá nhân; quản lý xem, sửa việc đó | Chỉ giáo viên xem, sửa được; quản lý bị chặn và không thấy trong danh sách đơn vị | `work.test.ts` |
| CT-10H-03 | P09-04 | Người nhận cập nhật 50% rồi 100%; người khác cập nhật; việc quá hạn; người giao hủy không lý do | Đang làm rồi hoàn thành, người giao nhận thông báo; người khác 403; bảng tiến độ đếm quá hạn; hủy thiếu lý do 400 | `work.test.ts` |
| CT-10H-04 | P09-03 | Quản lý lập kế hoạch tháng 2 đầu việc, kích hoạt, một việc xong; thêm đầu việc sau khi đóng | Kích hoạt giao 2 việc; tiến độ 50%; thêm sau khi đóng 422 `P09-03`; phòng nhân sự không lập được | `work.test.ts` |
| CT-10H-05 | P09-05 | Chấm 2 chỉ số trọng số 2 và 1; công bố; sửa sau công bố; đánh giá lại không lý do và có lý do | Điểm 86,67; sửa bị chặn `BR-47`; thiếu lý do `BR-47`; có lý do được, phiếu cũ đã thay thế, nhân sự chỉ thấy phiếu mới | `work.test.ts` |
| CT-10H-06 | P07-03 | Phòng nhân sự ghi mốc ở đơn vị chính và đơn vị khác, chứng chỉ; giáo viên khác xem | Hai mốc, một mốc kiêm nhiệm; nhân sự xem của mình; người khác 403; mốc đã kết thúc không đóng lại được 409 | `work.test.ts` |
| CT-10H-07 | P08-07 | Thưởng 1 000 000 và khấu trừ 300 000 tháng này, một khoản hủy; tính bảng lương; trình duyệt rồi ghi thêm | Phiếu lương có dòng thưởng, khấu trừ kèm căn cứ, không có khoản đã hủy; sau trình duyệt bị chặn `BR-45` | `work.test.ts` |

Kiểm thử phép tính điểm (BR-47) và kiểm thử hồi quy `payroll.test.ts`, `settlements.test.ts`, `staff.test.ts` (29 ca) đạt. Kiểm thử giao diện `tests/e2e/37-work.spec.ts` (quản lý giao việc trên cổng quản trị, giáo viên cập nhật hoàn thành trên ứng dụng giáo viên) đã viết, chưa chạy theo hướng dẫn chung (người điều phối chạy).

## Quy tắc

Không sửa nội dung BR. Đề xuất ghi chú thêm ở BR-47: "Điểm tổng thang 100 là trung bình có trọng số của tỷ lệ điểm trên điểm tối đa từng chỉ số; mỗi nhân sự mỗi kỳ chỉ một phiếu đã công bố còn hiệu lực, phiếu đánh giá lại thay thế phiếu cũ khi công bố (YCTD-81)."
