# Nháp tài liệu phần 10j: báo cáo hoạt động, báo cáo hợp nhất, xuất dữ liệu

## YCTD

### YCTD-83: Báo cáo hoạt động, báo cáo hợp nhất nhiều đơn vị, xuất dữ liệu – 2026-10-12

- Lý do: phần 10j theo cách chia ở YCTD-73 (P17-10, P17-11, P17-12). Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền dùng như đã cấp trước ở tệp 0034 định danh: `P17.report.operations` (VT-03) xem báo cáo hoạt động và công việc; `P17.report.consolidated` (VT-02, VT-19) xem báo cáo hợp nhất; `P17.data.export` (VT-02, VT-04, VT-06) xuất dữ liệu. Không thêm quyền mới. Phạm vi theo đơn vị được gán như các báo cáo của YCTD-62 (gán ở Trường chính, VT-02, VT-19 là toàn trường).
  - Báo cáo hoạt động và công việc (P17-10, `GET /reports/activities`): lọc theo khoảng ngày (tối đa 366 ngày), đơn vị và lớp; lớp ngoài phạm vi trả `ERR_FORBIDDEN`. Không chọn lớp thì gồm mọi lớp đang hoạt động của các đơn vị trong phạm vi. Báo cáo gồm nhiều mục, mỗi mục là một bảng có danh sách cột và dòng do máy chủ trả về:
    - Điểm danh: sĩ số hiện tại, lượt đi học, vắng có báo, vắng không báo, tỷ lệ đi học theo lớp.
    - Sổ liên lạc hằng ngày: số bản đã công bố, còn nháp, số lần sửa sau công bố trong khoảng, tỷ lệ bản đã công bố trên số lượt đi học.
    - Y tế: số sự kiện y tế, số sự kiện mức nặng, số lượt chăm sóc hằng ngày; gắn theo lớp hiện tại của trẻ.
    - Dặn thuốc: số yêu cầu có hiệu lực trong khoảng (trừ yêu cầu bị từ chối), số liều đã cho uống, số liều bỏ.
    - Thông báo: theo đơn vị, số thông báo tạo trong khoảng, số tin nhắn đã gửi và gửi lỗi.
  - Nguồn số liệu của báo cáo hoạt động là các đối tượng theo giao diện `OperationsSectionProvider` (mã mục, tên mục, hàm tính trả cột và dòng) đăng ký ở `OPERATIONS_SECTION_PROVIDERS` trong `application.module.ts`. Dữ liệu hoạt động (P14, phần 10e) và công việc (P09, phần 10h) chưa có trong nhánh 10j nên chưa có mục hoạt động đã công bố (BR-64) và tiến độ công việc; khi gộp các phần đó, mỗi phần thêm một nguồn vào cuối danh sách, không phải sửa dịch vụ báo cáo, giao diện tự hiện thêm bảng mới. Quy ước cho người gộp: mục hoạt động chỉ đếm hoạt động đã duyệt (BR-64); mục công việc đếm việc theo trạng thái và việc quá hạn theo lớp hoặc đơn vị.
  - Báo cáo hợp nhất nhiều đơn vị (P17-11, `GET /reports/consolidated`): nhận `month` và `org_unit_ids` (danh sách mã cách nhau dấu phẩy, trống là mọi đơn vị trong phạm vi, kể cả Trường chính). Mỗi đơn vị một dòng: số trẻ đang học, số lớp, số nhân sự, lượt đi học, tỷ lệ đi học trong tháng, học phí phải thu, đã thu, còn nợ và tỷ lệ thu của hóa đơn kỳ tháng, công nợ và nợ quá hạn hiện tại, tổng thu, tổng chi, chênh lệch trong tháng; kèm dòng tổng các đơn vị đã chọn (tỷ lệ tính lại từ tổng, không lấy trung bình). Số liệu tính trực tiếp bằng cùng hàm của bảng điều khiển và báo cáo thu chi (YCTD-62), không dùng bảng `report_snapshots`.
  - Cán bộ quản lý cấp trên (VT-19) chỉ thấy số liệu tổng hợp: báo cáo hợp nhất không trả tên, mã của trẻ, phụ huynh, nhân sự hay người nộp tiền; VT-19 không có quyền các báo cáo có dữ liệu cá nhân (công nợ theo trẻ, điểm danh có danh sách trẻ vắng, thu chi có người nộp, chấm công, sinh nhật) nên gọi các điểm cuối đó trả `ERR_FORBIDDEN` (đã đúng theo tệp 0027, kiểm thử lại trong phần này). VT-19 không có quyền xuất dữ liệu. VT-15 có MH-29 trong `14` nhưng tệp 0034 không cấp `P17.report.consolidated` cho VT-15 nên giữ theo quyền đã cấp; ghi ở mục Màn hình.
  - Xuất dữ liệu (P17-12, `POST /reports/{code}/export`): xuất ra tệp Excel (`.xlsx`, thư viện exceljs có sẵn) các báo cáo `tuition`, `debts`, `cash-flow`, `attendance`, `staff-attendance`, `saturday-classes` của YCTD-62 và `consolidated` của P17-11. Thân yêu cầu là bộ lọc, cùng tên trường với chuỗi truy vấn khi xem báo cáo. Người xuất phải có cả `P17.data.export` lẫn quyền xem của báo cáo đó trong phạm vi đơn vị (ví dụ kế toán có quyền xuất nhưng không có quyền xem báo cáo điểm danh thì không xuất được báo cáo điểm danh); giáo viên không xuất theo lớp được phân công. Báo cáo hoạt động (P17-10) chưa xuất được vì không vai trò nào có đồng thời quyền xem báo cáo hoạt động và quyền xuất theo tệp 0034.
  - Tệp Excel gồm trang "Thông tin" (tên báo cáo, người xuất, thời điểm, từng bộ lọc, các dòng tổng, lời nhắc BR-74 khi tệp có dữ liệu cá nhân) và mỗi bảng của báo cáo một trang với tiêu đề cột tiếng Việt; báo cáo hợp nhất có thêm dòng "Tổng các đơn vị". Tên tệp `bao-cao-{code}-{YYYYMMDD-HHmm}.xlsx` (giờ quốc tế).
  - Nhật ký xuất (BR-74): mỗi lần xuất thành công ghi một dòng `export_logs` gồm người xuất và tên lúc xuất, mã báo cáo, bộ lọc, các đơn vị trong phạm vi của lần xuất, tổng số dòng dữ liệu, có dữ liệu cá nhân hay không (đánh dấu cố định theo báo cáo: công nợ, thu chi, điểm danh, chấm công là có; học phí theo lớp, học thứ 7, hợp nhất là không), tên tệp, địa chỉ mạng. Lần xuất bị từ chối (thiếu quyền, sai bộ lọc) không ghi nhật ký. Mã nhật ký trả ở tiêu đề `x-export-log-id`.
  - Tệp xuất không lưu lại trên hệ thống (không ghi bảng `files`, không có `file_id` như `16` dự kiến) để không giữ thêm bản sao dữ liệu cá nhân; muốn có lại thì xuất lần nữa và có thêm một dòng nhật ký.
  - Xem nhật ký xuất (`GET /reports/export-logs`, cần `P17.data.export`): người có phạm vi toàn trường theo quyền xuất (VT-02, người gán ở Trường chính) xem mọi lần xuất; người khác chỉ xem lần xuất của mình; lọc theo khoảng ngày, tối đa 500 dòng mới nhất.
  - Bảng `export_logs` ở cơ sở dữ liệu năm học (tệp 0039); mở năm học mới không chuyển nhật ký xuất, tra ở năm cũ (không thêm bước chuyển năm học).
  - Giao diện: trang Báo cáo (`/reports`) của cổng quản trị thêm thẻ "Hoạt động và công việc" (VT-03), "Hợp nhất đơn vị" (MH-29, người có `P17.report.consolidated`), "Nhật ký xuất" (người có quyền xuất) và nút "Xuất Excel" trên từng báo cáo khi người dùng có quyền xuất. Không thêm mục điều hướng mới. Không có màn hình trên ứng dụng giáo viên, phụ huynh.
  - Mã máy chủ: tách các hàm đọc bộ lọc của báo cáo ra `apps/api/src/reports/report-filters.ts` để dùng chung cho xem và xuất; `ReportsService.unitScope` chuyển thành hàm công khai dùng chung. Hành vi các báo cáo của YCTD-62 không đổi.
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị.
- Dữ liệu bị ảnh hưởng: một bảng mới của năm học `export_logs` (tệp 0039). Không đổi cơ sở dữ liệu định danh (quyền đã cấp ở tệp 0034).
- API bị ảnh hưởng: `GET /reports/activities`, `GET /reports/consolidated`, `POST /reports/{code}/export`, `GET /reports/export-logs` trong mục 17 của `17`.
- Giao diện bị ảnh hưởng: MH-28, MH-29.
- Quyền bị ảnh hưởng: PQ-48.
- Ảnh hưởng chức năng cũ: các báo cáo G1 giữ nguyên kết quả; `fetchWithSession` của cổng quản trị nhận thêm tham số tùy chọn để gửi yêu cầu POST tải tệp; `readError` của cổng quản trị được xuất ra để dùng chung. Thẻ báo cáo trên trang Báo cáo có thêm thẻ mới cho người có quyền.
- Kiểm thử cần thực hiện: CT-10j-1 đến CT-10j-6 (người điều phối đánh số CT chính thức, xem mục Kết quả kiểm thử); kiểm thử máy chủ `apps/api/src/reports/reports-g2.test.ts`; kiểm thử giao diện `tests/e2e/39-reports-g2.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

Thay dòng `export_logs` trong mục 18 của `16_CO_SO_DU_LIEU.md`:

| export_logs | Nhật ký xuất dữ liệu (BR-74, YCTD-83); tệp không lưu lại nên không có file_id | user_id, actor_name, report_code, filters_data, org_unit_ids, row_count, contains_personal_data, file_name, ip_address, exported_at |

Ghi chú cho dòng `report_snapshots`: G2 phần 10j chưa dùng, báo cáo hợp nhất tính trực tiếp từ dữ liệu gốc.

## Điểm cuối

Thay hai dòng có sẵn và thêm một dòng trong mục 17 của `17_DAC_TA_API.md`:

| GET | /api/v1/reports/activities | Báo cáo hoạt động và công việc theo lớp (P17-10, YCTD-83) |
| GET | /api/v1/reports/consolidated | Báo cáo hợp nhất so sánh chỉ số giữa các đơn vị, chỉ số liệu tổng hợp (P17-11, YCTD-83) |
| POST | /api/v1/reports/{code}/export | Xuất báo cáo ra tệp Excel, ghi nhật ký xuất (P17-12, BR-74, YCTD-83) |
| GET | /api/v1/reports/export-logs | Nhật ký xuất dữ liệu (BR-74, YCTD-83) |

Giao kèo của báo cáo hoạt động, báo cáo hợp nhất và xuất dữ liệu (DT-10 phần 10j, YCTD-83):

1. `GET /reports/activities` cần `P17.report.operations`; nhận `from`, `to` (bắt buộc, tối đa 366 ngày, quá trả `ERR_VALIDATION`), `org_unit_id`, `class_id` (tùy chọn); đơn vị hoặc lớp ngoài phạm vi trả `ERR_FORBIDDEN`. Trả `from`, `to`, `org_unit_ids`, `class_id`, `sections` (mảng `code`, `title`, `columns` gồm `key`, `label`, `rows`). Mục có sẵn: `attendance` (`children_count`, `present`, `absent_notified`, `absent_unnotified`, `total`, `rate_percent`), `journals` (`published_count`, `draft_count`, `amendment_count`, `present`, `coverage_percent`), `health` (`medical_event_count`, `severe_event_count`, `daily_care_count`), `medication` (`request_count`, `given_count`, `skipped_count`) theo lớp kèm `org_unit_name`, `class_name`; `notifications` (`org_unit_name`, `notification_count`, `sms_sent_count`, `sms_failed_count`) theo đơn vị. Phần hoạt động (P14) và công việc (P09) thêm mục mới cùng định dạng.
2. `GET /reports/consolidated` cần `P17.report.consolidated`; nhận `month` (`YYYY-MM`) và `org_unit_ids` (mã cách nhau dấu phẩy, trống là mọi đơn vị trong phạm vi); mã sai định dạng trả `ERR_VALIDATION`, đơn vị ngoài phạm vi trả `ERR_FORBIDDEN`. Trả `month`, `units` (mỗi dòng `org_unit_id`, `org_unit_code`, `org_unit_name`, `unit_type`, `children_count`, `classes_count`, `staff_count`, `attendance_present_count`, `attendance_record_count`, `attendance_rate_percent`, `tuition_payable_amount`, `tuition_paid_amount`, `tuition_outstanding_amount`, `tuition_collection_percent`, `debt_outstanding_amount`, `debt_overdue_amount`, `income_amount`, `expense_amount`, `difference_amount`) và `totals` (tổng các cột số, tỷ lệ tính lại từ tổng). Không có trường dữ liệu cá nhân.
3. `POST /reports/{code}/export` cần `P17.data.export` và quyền xem của báo cáo `code` trong phạm vi; `code` là `tuition`, `debts`, `cash-flow`, `attendance`, `staff-attendance`, `saturday-classes`, `consolidated`, khác trả `ERR_NOT_FOUND`. Thân là bộ lọc cùng tên trường với chuỗi truy vấn của báo cáo (mảng được nối bằng dấu phẩy); bộ lọc sai trả `ERR_VALIDATION`. Thành công trả `200` nội dung `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, tiêu đề `content-disposition: attachment; filename="bao-cao-{code}-{YYYYMMDD-HHmm}.xlsx"` và `x-export-log-id`. Mỗi lần thành công ghi một dòng `export_logs`; lần bị từ chối không ghi.
4. `GET /reports/export-logs` cần `P17.data.export`; nhận `from`, `to`; người có phạm vi toàn trường theo quyền xuất thấy mọi dòng, người khác chỉ thấy dòng của mình; mỗi dòng `id`, `user_id`, `actor_name`, `report_code`, `filters_data`, `org_unit_ids`, `row_count`, `contains_personal_data`, `file_name`, `exported_at`; tối đa 500 dòng mới nhất.

## Màn hình

Dòng thay thế trong `14_DAC_TA_GIAO_DIEN.md`:

| MH-28 | Báo cáo theo phân hệ: học phí, công nợ, thu chi, điểm danh, chấm công, học thứ 7; mỗi báo cáo một thẻ theo quyền (YCTD-62); báo cáo thu chi có bảng theo nhóm và theo tháng (YCTD-70); thẻ "Hoạt động và công việc" gồm các bảng điểm danh, sổ liên lạc, y tế, dặn thuốc, thông báo theo lớp và đơn vị; nút "Xuất Excel" trên từng báo cáo và thẻ "Nhật ký xuất" cho người có quyền xuất dữ liệu (YCTD-83) | VT-02, VT-15, VT-03, VT-04, VT-05, VT-06, VT-07, VT-08, VT-19, VT-20 |
| MH-29 | Báo cáo hợp nhất nhiều đơn vị: thẻ "Hợp nhất đơn vị" trên trang Báo cáo, chọn tháng và các đơn vị so sánh (không chọn là mọi đơn vị), bảng so sánh theo đơn vị kèm dòng tổng, chỉ số liệu tổng hợp; nút "Xuất Excel" khi có quyền xuất (YCTD-83). VT-15 chưa được cấp quyền ở tệp 0034 nên chưa thấy thẻ này | VT-02, VT-19 |

## Quyền

| PQ-48 | Báo cáo giai đoạn 2 (YCTD-83): `P17.report.operations` cho VT-03 xem báo cáo hoạt động và công việc của các lớp trong đơn vị được gán; `P17.report.consolidated` cho VT-02, VT-19 xem báo cáo hợp nhất toàn trường, chỉ số liệu tổng hợp, không có dữ liệu cá nhân; `P17.data.export` cho VT-02, VT-04, VT-06 xuất ra Excel các báo cáo mình có quyền xem trong phạm vi, mỗi lần xuất ghi nhật ký (BR-74); người có phạm vi toàn trường xem mọi nhật ký xuất, người khác chỉ xem lần xuất của mình. VT-19 không có quyền xem các báo cáo có dữ liệu cá nhân và không có quyền xuất |

## Kết quả kiểm thử

Kiểm thử máy chủ `apps/api/src/reports/reports-g2.test.ts`: 8 ca đạt ngày 12/10/2026. `apps/api/src/reports/reports.test.ts` (G1) chạy lại 9 ca đạt, `partner` đạt (sau khi tách hàm đọc bộ lọc).

`21_KICH_BAN_KIEM_THU.md` chưa có kịch bản CT cho P17-10, P17-11, P17-12. Đề xuất thêm sáu kịch bản (mã tạm CT-10j-1 đến CT-10j-6 ghi trong tên ca kiểm thử; người điều phối đánh số CT chính thức nối tiếp và thêm tiêu chí AC tương ứng):

| Mã tạm | Chức năng | Kịch bản | Kết quả mong đợi | Kết quả |
|---|---|---|---|---|
| CT-10j-1 | P17-10 | Quản lý đơn vị ĐT-A1 mở báo cáo hoạt động 10 ngày gần nhất | Có các bảng điểm danh, sổ liên lạc, y tế, dặn thuốc, thông báo; chỉ các lớp của ĐT-A1; lọc theo lớp chỉ còn lớp đó | Đạt, `apps/api/src/reports/reports-g2.test.ts` |
| CT-10j-2 | P17-10 | Quản lý đơn vị ĐT-A1 xem đơn vị hoặc lớp của ĐT-B1; giáo viên, kế toán, VT-19 mở báo cáo hoạt động; khoảng ngày quá 366 ngày | Trả lỗi không có quyền; khoảng ngày quá dài trả lỗi dữ liệu | Đạt, `apps/api/src/reports/reports-g2.test.ts` |
| CT-10j-3 | P17-11 | Cán bộ quản lý cấp trên mở báo cáo hợp nhất tháng này | Mỗi đơn vị một dòng kèm dòng tổng; không có tên trẻ, tên người nộp tiền, mã trẻ | Đạt, `apps/api/src/reports/reports-g2.test.ts`; giao diện `tests/e2e/39-reports-g2.spec.ts` |
| CT-10j-4 | P17-11 | Cán bộ quản lý cấp trên gọi báo cáo công nợ, điểm danh, thu chi, chấm công, sinh nhật; quản lý đơn vị gọi báo cáo hợp nhất | Trả lỗi không có quyền | Đạt, `apps/api/src/reports/reports-g2.test.ts` |
| CT-10j-5 | P17-12 | Kế toán xuất báo cáo công nợ của đơn vị mình ra Excel | Tải được tệp xlsx có trang theo trẻ; nhật ký xuất ghi người xuất, báo cáo, bộ lọc, đơn vị, số dòng, có dữ liệu cá nhân | Đạt, `apps/api/src/reports/reports-g2.test.ts`; giao diện (Hiệu trưởng xuất báo cáo hợp nhất, thấy nhật ký) `tests/e2e/39-reports-g2.spec.ts` |
| CT-10j-6 | P17-12 | Giáo viên, quản lý đơn vị, VT-19 xuất dữ liệu; kế toán xuất báo cáo điểm danh, báo cáo hợp nhất, công nợ đơn vị khác | Trả lỗi không có quyền, không ghi nhật ký xuất | Đạt, `apps/api/src/reports/reports-g2.test.ts` |

Ca thêm (không cần CT riêng): gắn thêm nguồn số liệu mới vào báo cáo hoạt động không phải sửa dịch vụ; nhật ký xuất theo phạm vi người xem. Cả hai đạt trong `reports-g2.test.ts`.

Kiểm thử giao diện `tests/e2e/39-reports-g2.spec.ts` đã viết, chưa chạy (người điều phối chạy).

## Quy tắc

Đề xuất bổ sung BR-74 trong `07_QUY_TAC_NGHIEP_VU.md`:

| BR-74 | Dữ liệu cá nhân của trẻ và phụ huynh không được xuất ra ngoài hệ thống nếu không có quyền xuất dữ liệu và không ghi nhật ký xuất. Người xuất phải có cả quyền xuất dữ liệu và quyền xem báo cáo trong phạm vi đơn vị; mỗi lần xuất ghi người xuất, báo cáo, bộ lọc, đơn vị, số dòng và có dữ liệu cá nhân hay không; tệp xuất không lưu lại trên hệ thống (YCTD-83) |
