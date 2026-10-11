# 24. YÊU CẦU THAY ĐỔI

- Mô tả: Sổ quản lý yêu cầu thay đổi, ghi lý do, đánh giá ảnh hưởng và trạng thái của từng thay đổi trước khi triển khai.
- Phiên bản: 0.4
- Ngày cập nhật: 2026-10-11
- Trạng thái: Đang cập nhật

## Quy ước

Mã yêu cầu thay đổi dạng `YCTD-nn`, đánh số tăng dần, không tái sử dụng. Mục mới nhất ở trên cùng. Trạng thái dùng bốn giá trị: Chờ phê duyệt, Đã phê duyệt, Từ chối, Đã triển khai.

Các thay đổi trước phiên bản 0.4.0 chưa có sổ này; xem `23_LICH_SU_PHIEN_BAN.md` các phiên bản 0.1.0 đến 0.3.1.

### YCTD-63: Khóa API cho đối tác chỉ đọc – 2026-10-11

- Lý do: phần 7b theo cách chia ở YCTD-62. Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Khóa API do dịch vụ định danh quản lý: Hiệu trưởng cấp khóa gồm tên đối tác, loại đối tác (nhập tự do), phạm vi dữ liệu (`reports` báo cáo tổng hợp, `finance` thu chi và công nợ, `children` danh sách trẻ và phụ huynh, `staff` nhân sự và lương), căn cứ pháp lý (bắt buộc khi có phạm vi dữ liệu cá nhân), danh sách địa chỉ mạng cho phép (ít nhất một), ngày hết hạn sau hôm nay. Khóa dạng `sm_...` chỉ trả về một lần, lưu dạng băm SHA-256, hiển thị mười ký tự đầu để nhận biết; thu hồi có hiệu lực ngay; mọi thao tác ghi nhật ký tài khoản.
  - Đối tác gửi khóa ở tiêu đề `x-api-key` tới nhóm `/partner/` của máy chủ API; máy chủ API hỏi điểm cuối kiểm tra của dịch vụ định danh kèm địa chỉ mạng gọi tới. Khóa sai, đã thu hồi, hết hạn hoặc sai địa chỉ mạng trả `ERR_UNAUTHENTICATED`; khóa thiếu phạm vi trả `ERR_FORBIDDEN`; mỗi khóa tối đa 60 yêu cầu mỗi phút, vượt trả `ERR_RATE_LIMIT`.
  - Dữ liệu trả cho đối tác là toàn trường: báo cáo tổng hợp như bảng điều khiển của một tháng; thu chi theo khoản mục và công nợ tổng hợp theo lớp; danh sách trẻ đang học kèm lớp và phụ huynh (không có số định danh cá nhân); nhân sự đang làm kèm lương hợp đồng còn hiệu lực và thực nhận trên bảng lương đã duyệt gần nhất. Đọc danh sách trẻ và nhân sự luôn ghi nhật ký truy cập dữ liệu nhạy cảm kèm khóa, phạm vi, số bản ghi và căn cứ pháp lý (BR-73, BM-66).
  - Mã quyền mới: `P01.api-client.manage` cho VT-02. Cổng vào chuyển `/api/v1/api-clients` sang dịch vụ định danh.
  - Khi triển khai sau cổng vào hoặc bộ cân bằng tải, máy chủ API phải được cấu hình lấy đúng địa chỉ mạng của đối tác (việc của đợt triển khai, `T6`).
- Thành phần bị ảnh hưởng: `08`, `10`, `14`, `16`, `17`, `21`, `01`, `03`, `index.md`; dịch vụ định danh, máy chủ API, cổng quản trị.
- Dữ liệu bị ảnh hưởng: bảng `api_clients` ở cơ sở dữ liệu định danh; nhật ký `data_access_logs` ghi `api_client_id`.
- API bị ảnh hưởng: `GET, POST /api-clients`, `POST /api-clients/{id}/revoke`, `POST /api-clients/verify` (dịch vụ định danh); `GET /partner/reports/summary`, `/partner/finance`, `/partner/children`, `/partner/staff` (máy chủ API).
- Giao diện bị ảnh hưởng: MH-42 Khóa API của đối tác.
- Quyền bị ảnh hưởng: thêm `P01.api-client.manage`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CT-151, CT-152, CT-167.
- Trạng thái: Đã triển khai

### YCTD-62: DT-07 chia hai; bảng điều khiển và báo cáo cơ bản – 2026-10-11

- Lý do: thiết kế đợt DT-07. Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - DT-07 chia hai: 7a bảng điều khiển và báo cáo cơ bản giai đoạn 1 (P17-01 đến P17-07, P17-13, P17-14); 7b khóa API cho đối tác và nhóm điểm cuối `/partner/` (P01-14).
  - Số liệu tính trực tiếp từ dữ liệu gốc của năm học đang mở mỗi lần xem, không lưu bảng tổng hợp; lọc theo đơn vị trong phạm vi người xem (gán ở Trường chính là toàn trường).
  - Bảng điều khiển (trên trang chủ): số trẻ đang học, số lớp đang hoạt động, số nhân sự đang làm, học phí phải thu và đã thu của tháng, công nợ còn phải thu và quá hạn, tỷ lệ đi học của tháng (lượt có mặt kể cả đi muộn, về sớm chia tổng lượt điểm danh). Ban Giám hiệu xem theo đơn vị được gán; quản lý đơn vị xem đơn vị được gán.
  - Báo cáo học phí: hóa đơn đã phát hành của kỳ, theo lớp hiện tại của trẻ, lọc khối lớp: phải thu, giảm trừ, điều chỉnh, còn phải thu, đã thu, còn nợ. Báo cáo công nợ: theo trẻ và theo lớp, lọc số ngày quá hạn tối thiểu. Báo cáo thu chi: phiếu thu, phiếu chi đã phát hành hoặc chờ duyệt đảo trong khoảng ngày, theo khoản mục và danh sách chứng từ, lọc đơn vị, loại thu chi, người lập (BR-36). Báo cáo điểm danh: tỷ lệ đi học theo lớp và danh sách trẻ vắng trong khoảng ngày. Báo cáo chấm công: ngày đi làm, nghỉ theo đơn, vắng, số lần đi muộn, về sớm, phút làm thêm của tháng tính đến hôm nay. Báo cáo học thứ 7: từng ngày học bù trong khoảng, số trẻ đi học và vắng theo lớp. Sinh nhật trẻ đang học trong tháng.
  - Giáo viên chủ nhiệm và giáo viên bộ môn xem báo cáo điểm danh và sinh nhật của lớp được phân công mà không cần mã quyền riêng; không xem được báo cáo khác.
  - Mã quyền mới: `P17.dashboard.leadership` (VT-02, VT-15), `P17.dashboard.unit` (VT-03), `P17.report.tuition` và `P17.report.debt` (VT-02, VT-15, VT-04, VT-05), `P17.report.cash-flow` (VT-02, VT-04, VT-05), `P17.report.attendance` (VT-02, VT-15, VT-03), `P17.report.staff-attendance` (VT-02, VT-15, VT-03, VT-06), `P17.report.saturday` (VT-02, VT-15, VT-03, VT-04), `P17.birthday.view` (VT-02, VT-15, VT-03).
- Thành phần bị ảnh hưởng: `08`, `10`, `14`, `17`, `21`, `01`, `03`, `index.md`; máy chủ API (nhóm báo cáo), cổng quản trị (trang chủ, trang Báo cáo).
- Dữ liệu bị ảnh hưởng: không thêm bảng.
- API bị ảnh hưởng: `GET /dashboard/leadership`, `GET /dashboard/unit`, `GET /dashboard/birthdays`, `GET /reports/tuition`, `/reports/debts`, `/reports/cash-flow`, `/reports/attendance`, `/reports/staff-attendance`, `/reports/saturday-classes`.
- Giao diện bị ảnh hưởng: MH-01 Bảng điều khiển (trang chủ), MH-28 Báo cáo theo phân hệ.
- Quyền bị ảnh hưởng: thêm chín mã quyền P17 ở trên.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CT-125, CT-126, CT-128 và kiểm thử tự động của từng báo cáo.
- Trạng thái: Đã triển khai

### YCTD-61: Phiếu chi lương, bảng quyết toán khi nghỉ việc, phiếu thu thu hồi lương, khoản điều chỉnh kỳ sau – 2026-10-11

- Lý do: phần 6c-2 theo cách chia ở YCTD-60. Eric ủy quyền ngày 11/10/2026 cho Claude tự làm tới khi hoàn tất dự án, không chờ xác nhận; các điểm dưới đây Claude tự chọn theo ủy quyền, Eric rà lại khi cần.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Phiếu chi lương: bảng lương đã duyệt lập một phiếu chi loại lương nháp bằng tổng thực nhận, đơn vị là Trường chính, nguồn chi là quỹ hoặc tài khoản của Trường chính; sau đó đính chứng từ, trình và duyệt như phiếu chi thường theo hạn mức phiếu chi (QT-05). Mỗi bảng lương chỉ có một phiếu chi lương chưa đảo. Kế toán cần được gán ở Trường chính để lập phiếu chi của Trường chính.
  - Bảng quyết toán lập cho từng hợp đồng đã chấm dứt. Lương được hưởng của tháng nghỉ việc = lương hợp đồng × ngày công hưởng lương từ ngày 1 (hoặc ngày vào làm) đến ngày chấm dứt / ngày công chuẩn của tháng; phụ cấp cố định và khấu trừ cố định chia cùng tỷ lệ; khấu trừ theo phần trăm tính trên lương được hưởng; phụ cấp theo ngày đi làm; làm thêm giờ. Ngày công tính trực tiếp từ chấm công, đơn nghỉ đã duyệt, ngày lễ và lịch bù, không cần chốt bảng công của tháng đó; còn đơn nghỉ chờ duyệt thì chặn.
  - Phần đã trả trước là phần trả trước trên phiếu lương tháng nghỉ việc đã duyệt; chưa có phiếu lương tháng đó thì phần đã trả trước bằng 0 và bảng quyết toán tính luôn phần điều chỉnh theo công tháng trước. Thuế tính lại cho tháng nghỉ việc, trừ thuế đã khấu trừ trên phiếu lương; số phải trả = lương được hưởng − đã trả trước − chênh lệch thuế; dương là trả thêm, âm là khoản phải thu hồi.
  - Bảng quyết toán nháp tính lại được; trình duyệt theo hạn mức bảng lương của Trường chính trên giá trị tuyệt đối của số phải trả (BR-90): dưới hạn mức Phó Hiệu trưởng gán ở Trường chính duyệt, còn lại Hiệu trưởng; trả lại kèm lý do.
  - Đã duyệt mà trả thêm thì lập phiếu chi loại lương cho nhân sự; phải thu hồi thì lập phiếu thu không gắn trẻ, gắn nhân sự và bảng quyết toán, khoản mục thu do kế toán chọn, số dãy PT chung, thu nhiều lần đến khi hết; tiền vào quỹ hoặc tài khoản như phiếu thu thường. Phiếu thu thu hồi lương chưa đảo được ở chức năng đảo phiếu thu hiện có.
  - Khoản điều chỉnh lương cho kỳ sau (BR-45): kế toán lập cho một nhân sự, một tháng chưa có bảng lương đã trình, số tiền âm hoặc dương, lý do bắt buộc; Ban Giám hiệu duyệt theo hạn mức bảng lương của Trường chính, người lập không tự duyệt; khoản đã duyệt nằm ở phần điều chỉnh của phiếu lương tháng đó, có tính thuế.
  - Không thêm mã quyền: dùng `P08.payroll.manage`, `P08.payroll.view`, `P08.payroll.approve`, `P06.payment.manage`, `P06.receipt.manage`.
- Thành phần bị ảnh hưởng: `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md`, `27_BO_CA_KIEM_THU_CHI_TIET/05_P08.md`, `01`, `03`, `index.md`; máy chủ API (tiền lương, phiếu chi, phiếu thu), cổng quản trị.
- Dữ liệu bị ảnh hưởng: bảng mới `payroll_settlements`, `payroll_adjustments`; `payments` thêm `payroll_id`, `settlement_id`; `receipts` cho phép `child_id` trống, thêm `staff_id`, `settlement_id` (mỗi phiếu thu gắn đúng một trẻ hoặc một nhân sự).
- API bị ảnh hưởng: `POST /payrolls/{id}/payment`, `GET, POST /payroll-settlements` (thay cho `/payrolls/settlements`), `GET /payroll-settlements/{id}`, `POST /payroll-settlements/{id}/submit`, `approve`, `return`, `recovery-receipts`, `payment`, `GET, POST /payroll-adjustments`, `POST /payroll-adjustments/{id}/approve`, `reject`; `GET /payrolls/{id}` thêm `payments`.
- Giao diện bị ảnh hưởng: MH-15 (lập phiếu chi lương), MH-54 Quyết toán và điều chỉnh lương.
- Quyền bị ảnh hưởng: không thêm mã quyền.
- Ảnh hưởng chức năng cũ: phiếu thu có thể không gắn trẻ; danh sách phiếu thu của trẻ, công nợ và đảo phiếu thu chỉ xét phiếu thu gắn trẻ như cũ.
- Kiểm thử cần thực hiện: CTC-P08-039 đến 042, CTC-P06-034.
- Trạng thái: Đã triển khai

### YCTD-60: DT-06 phần 6c chia hai; danh mục lương, biểu thuế, bảng lương toàn trường, phiếu lương – 2026-10-11

- Lý do: thiết kế DT-06 phần 6c; Eric chốt ngày công chuẩn, cách áp phụ cấp và khấu trừ, đơn giá làm thêm, thuế thu nhập cá nhân, phạm vi và người duyệt bảng lương.
- Nội dung thay đổi:
  - Phần 6c chia hai: 6c-1 danh mục phụ cấp, thưởng, khấu trừ, biểu thuế, bảng lương trả trước kèm điều chỉnh, duyệt theo hạn mức, phiếu lương; 6c-2 phiếu chi lương, bảng quyết toán khi nghỉ việc, phiếu thu thu hồi lương, bảng điều chỉnh kỳ sau (BR-45).
  - Ngày công chuẩn của tháng là số ngày làm việc của tháng theo lịch (thứ hai đến thứ sáu theo lịch năm học, cộng học bù, trừ ngày lễ và nghỉ bù), thay cho số cố định 24 trong ví dụ.
  - Danh mục phụ cấp, thưởng, khấu trừ chung toàn trường do kế toán khai; cách tính: số tiền cố định mỗi tháng, số tiền mỗi ngày đi làm thực tế, phần trăm lương hợp đồng; phụ cấp có thể đánh dấu miễn thuế, khấu trừ có thể đánh dấu bảo hiểm bắt buộc. Thưởng tháng là một phụ cấp cố định. Phòng nhân sự gán khoản cho từng nhân sự, nhập mức riêng nếu khác mức chung, và nhập số người phụ thuộc. Phụ cấp ghi trong hợp đồng tính như khoản cố định.
  - Phụ cấp theo ngày công chỉ đếm ngày đi làm thực tế trong bảng công đã chốt của tháng trước (nghỉ nửa ngày theo đơn tính 0,5).
  - Tiền làm thêm giờ theo lương giờ từng người: lương hợp đồng / ngày công chuẩn / giờ làm chuẩn của đơn vị × hệ số làm thêm (cấu hình `overtime_rate_percent` theo đơn vị, phần trăm, không mặc định) × số giờ làm thêm; có giờ làm thêm mà chưa cấu hình thì chặn tính lương.
  - Thuế thu nhập cá nhân lũy tiến từng phần theo tháng. Biểu thuế có sẵn theo luật hiện hành, Eric xác nhận: giảm trừ bản thân 15 500 000, mỗi người phụ thuộc 6 200 000; bậc đến 10 triệu 5%, trên 10 đến 30 triệu 10%, trên 30 đến 60 triệu 20%, trên 60 đến 100 triệu 30%, trên 100 triệu 35%, hiệu lực 01/07/2026. Kế toán trưởng thêm phiên bản mới có ngày hiệu lực khi luật đổi. Thu nhập tính thuế = tổng thu nhập trên phiếu (lương, phụ cấp, thưởng, làm thêm, điều chỉnh) − phụ cấp miễn thuế − khấu trừ bảo hiểm bắt buộc − giảm trừ gia cảnh, âm thì bằng 0.
  - Bảng lương toàn trường một bảng mỗi tháng; chặn tính khi còn đơn vị có nhân sự làm việc trong tháng trước chưa chốt công (liệt kê). Phần trả trước cho nhân sự có hợp đồng hiệu lực ngày 1 tháng M và vào làm từ trước tháng M. Phần điều chỉnh theo bảng công tháng M−1: trừ ngày không hưởng lương, hoặc trả phần tháng đầu theo ngày công với nhân sự mới vào làm trong tháng M−1 (Q-155); cộng làm thêm giờ, phụ cấp và khấu trừ theo ngày công. Nhân sự chưa có hợp đồng hoặc đã chấm dứt hợp đồng vào danh sách chưa tính lương kèm lý do.
  - Kế toán tính lại được khi bảng còn nháp; trình duyệt thì xét hạn mức 'Bảng lương kỳ' của Trường chính: dưới hạn mức Phó Hiệu trưởng gán ở Trường chính duyệt, từ hạn mức hoặc chưa cấu hình thì Hiệu trưởng duyệt; người duyệt trả lại được kèm lý do. Duyệt xong phiếu lương hiện cho từng nhân sự và báo cho họ; bảng đã trình hoặc đã duyệt không tính lại (BR-45).
  - Người xem bảng lương: kế toán, kế toán trưởng, nhân sự, kiểm toán viên (VT-20), Hiệu trưởng, Phó Hiệu trưởng; mỗi người chỉ thấy phiếu của nhân sự trong phạm vi đơn vị được gán. Quản lý đơn vị, thủ quỹ, giáo viên không xem.
  - Mã quyền mới: `P08.pay-item-type.manage` cho VT-04; `P08.staff-pay-item.manage` cho VT-06; `P08.tax-table.manage` cho VT-05; `P08.payroll.manage` cho VT-04; `P08.payroll.view` cho VT-02, VT-15, VT-04, VT-05, VT-06, VT-20; `P08.payroll.approve` cho VT-02, VT-15.
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/05_P08.md`, `01`, `03`, `index.md`; máy chủ API, cổng quản trị, ứng dụng giáo viên.
- Dữ liệu bị ảnh hưởng: bảng mới `pay_item_types` (thay cho `allowance_types`, `deduction_types` của thiết kế), `staff_pay_items`, `tax_tables`, `payrolls` (thay cho `payroll_periods`), `payslips`, `payslip_lines`; `staff` thêm `dependents_count`; cấu hình `overtime_rate_percent`.
- API bị ảnh hưởng: `GET, POST /pay-item-types`, `PUT /pay-item-types/{id}`, `GET, POST /staff/{id}/pay-items`, `DELETE /staff-pay-items/{id}`, `PUT /staff/{id}/dependents`, `GET, POST /tax-tables`, `GET, POST /payrolls`, `GET /payrolls/{id}`, `POST /payrolls/{id}/submit`, `approve`, `return`, `GET /me/payslips`.
- Giao diện bị ảnh hưởng: MH-15 Bảng lương, MH-53 Danh mục lương và biểu thuế, MH-12 (khoản lương riêng), MH-44 (phiếu lương của tôi), MG-11.
- Quyền bị ảnh hưởng: thêm sáu mã quyền P08 ở trên.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P08-027 đến 038, CTC-P08-044 đến 049, CTC-P08-055, CTC-P08-057, CTC-P08-058; phần 6c-2: CTC-P08-039 đến 042, CTC-P06-034.
- Trạng thái: Đã triển khai

### YCTD-59: DT-06 phần 6b chia hai; ngày lễ, lịch học bù và nghỉ bù, chấm công, loại nghỉ và phép năm – 2026-10-11

- Lý do: thiết kế DT-06 phần 6b; Eric chốt ngày làm việc của nhân sự, lịch thứ bảy, ngày lễ, giờ làm, loại nghỉ, phép năm và đơn nghỉ.
- Nội dung thay đổi:
  - Phần 6b chia hai: 6b-1 ngày nghỉ lễ, lịch học bù và nghỉ bù, cấu hình giờ làm, thuộc tính loại nghỉ, chấm công; 6b-2 quy định và số ngày phép năm, đơn nghỉ phép, chốt và mở lại bảng công.
  - Ngày làm việc của nhân sự là các ngày học trong tuần của lịch năm học (mặc định thứ hai đến thứ sáu) cộng ngày học bù, trừ ngày nghỉ lễ và ngày nghỉ bù; áp dụng cả kỳ hè và tuần nghỉ của trẻ.
  - Thứ bảy mặc định nghỉ. Ban Giám hiệu bổ sung từng ngày vào lịch chung toàn trường: học bù chỉ chọn ngày thứ bảy trong học kỳ, là ngày học của mọi lớp và ngày làm việc của mọi nhân sự; nghỉ bù chọn ngày thứ hai đến thứ sáu, trẻ nghỉ học, nhân sự nghỉ có lương. Bỏ quy tắc nghỉ thứ bảy định kỳ.
  - Ngày nghỉ lễ là một danh sách chung toàn trường do phòng nhân sự gán ở Trường chính lập; ngày lễ không là ngày học của trẻ (không điểm danh, không tính vào số ngày học) và là ngày nghỉ lễ của nhân sự, có hưởng lương hoặc không theo từng ngày.
  - Ngày lễ, học bù, nghỉ bù chỉ lập, sửa, xóa cho ngày từ ngày mai trở đi; một ngày không vừa là ngày lễ vừa có lịch bù.
  - Giờ làm việc theo đơn vị, không có mặc định: `work_start_time`, `work_end_time`, `lunch_break_minutes`. Vào sau giờ vào làm là đi muộn, ra trước giờ tan làm là về sớm; số giờ làm bằng giờ ra trừ giờ vào trừ nghỉ trưa; giờ làm chuẩn bằng giờ tan làm trừ giờ vào làm trừ nghỉ trưa. Chưa cấu hình thì chưa xếp đi muộn, về sớm và chưa chốt được bảng công (6b-2).
  - Chấm công: nhân sự có hồ sơ liên kết tài khoản bấm vào ca một lần, ra ca (bấm lại lấy giờ mới nhất) cho ngày hôm nay trên cổng quản trị hoặc ứng dụng giáo viên, giờ theo máy chủ nên cần có mạng; phòng nhân sự nhập hoặc sửa giờ cho nhân sự của đơn vị cho hôm nay hoặc ngày đã qua trong thời gian làm việc, có nhật ký; mỗi nhân sự mỗi ngày một bản ghi.
  - Loại nghỉ phép giữ ở danh mục dùng chung do nhà trường tự khai (ví dụ nghỉ phép, không lương, thai sản, bệnh, hưởng chế độ bảo hiểm xã hội, cưới tang); mỗi loại có ba thuộc tính: trường trả lương, trừ số ngày phép năm, bảo hiểm xã hội chi trả. Trừ phép năm thì phải có lương; bảo hiểm chi trả thì trường không trả lương.
  - Phép năm (6b-2): cấp theo năm dương lịch; quy định số ngày theo chức danh và thâm niên chung toàn trường do phòng nhân sự gán ở Trường chính quản lý.
  - Đơn nghỉ (6b-2): nhân sự tự gửi trên ứng dụng giáo viên hoặc cổng quản trị, phòng nhân sự lập hộ; ngày đầu hoặc ngày cuối chọn được nửa ngày; số ngày chỉ đếm ngày làm việc; người gửi hủy được khi còn chờ duyệt.
  - Mở năm học mới chuyển ngày lễ, lịch học bù, nghỉ bù và chấm công sang để chốt được tháng giao giữa hai năm học.
  - Mã quyền mới: `P08.holiday.manage` cho VT-06 (phải gán ở Trường chính); `P08.school-day-change.manage` cho VT-02, VT-15; `P08.attendance.manage` cho VT-06; `P08.attendance.view` cho VT-02, VT-15, VT-03, VT-04, VT-05, VT-06.
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/05_P08.md`, `01`, `03`, `index.md`; máy chủ API (lịch ngày học, danh mục dùng chung, cấu hình), cổng quản trị, ứng dụng giáo viên.
- Dữ liệu bị ảnh hưởng: bảng mới `holidays`, `school_day_changes` (thay cho `saturday_schedules` của thiết kế), `attendance_logs`; `catalog_items` thêm `attributes`; cấu hình `work_start_time`, `work_end_time`, `lunch_break_minutes`.
- API bị ảnh hưởng: `GET /school-days`, `POST, PUT, DELETE /holidays`, `POST, DELETE /school-day-changes` (thay cho `/saturday-schedules`), `GET, PUT /attendance-logs`, `GET /me/attendance-logs`, `POST /me/attendance-logs/check-in`, `POST /me/attendance-logs/check-out`; danh mục dùng chung nhận `attributes`.
- Giao diện bị ảnh hưởng: MH-13 và MH-44 (trang Chấm công), MH-37 (trang Ngày lễ và lịch bù), MG-10 (thẻ chấm công hôm nay), MH-50 (thuộc tính loại nghỉ), MH-30 cấu hình đơn vị (giờ làm).
- Quyền bị ảnh hưởng: thêm `P08.holiday.manage`, `P08.school-day-change.manage`, `P08.attendance.manage`, `P08.attendance.view`.
- Ảnh hưởng chức năng cũ: ngày lễ và ngày nghỉ bù không còn là ngày học khi điểm danh, đón trả và tính học phí; ngày học bù thứ bảy thành ngày học. Chưa lập lịch thì không đổi gì.
- Kiểm thử cần thực hiện: CTC-P08-001 đến 006, CTC-P08-050 đến 053; phần 6b-2: CTC-P08-009 đến 026, CTC-P08-054.
- Chi tiết phần 6b-2:
  - Quy định phép năm: mỗi dòng gồm chức danh, thâm niên từ bao nhiêu năm đến dưới bao nhiêu năm (để trống là trở lên), số ngày phép theo nửa ngày; các khoảng của cùng chức danh đang dùng không chồng nhau. Thâm niên là số năm tròn từ ngày vào làm đến ngày 1 tháng 1 của năm.
  - Số ngày phép của một năm được cấp theo quy định khi đơn phép năm đầu tiên được duyệt; phòng nhân sự đơn vị chỉnh số ngày được cấp kèm lý do, không nhỏ hơn số ngày đã nghỉ. Chưa có quy định phù hợp thì chặn đơn phép năm (QT-06 E6).
  - Đơn nghỉ: nằm trong một năm dương lịch; thuộc tính của loại nghỉ chép vào đơn lúc gửi; không trùng ngày với đơn đang chờ hoặc đã duyệt (E5); đơn phép năm kiểm tra số ngày còn lại lúc gửi và lúc duyệt (E4); người duyệt không tự duyệt đơn của chính mình; từ chối phải có lý do; người gửi, chính nhân sự hoặc phòng nhân sự hủy được đơn còn chờ. Gửi đơn báo VT-15 của đơn vị và VT-02; duyệt hoặc từ chối báo nhân sự.
  - Chốt bảng công theo đơn vị và tháng, từ mùng 1 tháng sau; cần cấu hình giờ vào làm và giờ tan làm; còn đơn chờ duyệt có ngày trong tháng thì chặn và liệt kê (E7). Mỗi ngày làm việc trong thời gian làm việc của nhân sự ghi đi làm, nghỉ theo đơn đã duyệt, hoặc vắng không phép; ngày lễ ghi nghỉ lễ (không lương nếu ngày lễ không hưởng lương), ngày nghỉ bù ghi nghỉ bù; thứ bảy không học bù và chủ nhật không ghi. Mỗi ngày có số ngày nghỉ theo đơn, vắng, không hưởng lương (vắng, nghỉ trường không trả lương), bảo hiểm chi trả và số phút làm thêm (phần vượt giờ làm chuẩn, tối đa 60 phút, BR-82). Chốt xong báo kế toán và quản lý đơn vị.
  - Kỳ đã chốt chặn sửa chấm công và gửi, duyệt, hủy đơn có ngày trong kỳ (E8). Phòng nhân sự đề nghị mở lại kèm lý do, mỗi lúc một đề nghị chờ; Hiệu trưởng hoặc Phó Hiệu trưởng của đơn vị duyệt thì kỳ mở lại, từ chối phải có lý do; chốt lại thì bảng công tính lại.
  - Mã quyền thêm: `P08.leave-policy.manage` cho VT-06 (phải gán ở Trường chính); `P08.leave.approve` và `P08.timesheet-reopen.approve` cho VT-02, VT-15. Phòng nhân sự lập đơn hộ, chỉnh số ngày phép, chốt và đề nghị mở lại bằng `P08.attendance.manage`.
  - Dữ liệu: `leave_policies`, `leave_balances`, `leave_requests`, `timesheet_periods`, `timesheet_days`, `timesheet_reopen_requests`; mở năm học mới chuyển sang.
  - API: `GET, POST /leave-policies`, `PUT /leave-policies/{id}`, `GET, PUT /leave-balances`, `GET /me/leave-requests`, `GET, POST /leave-requests`, `POST /leave-requests/{id}/approve`, `reject`, `cancel`, `GET /timesheet-periods`, `POST /attendance-logs/lock`, `GET, POST /attendance-logs/reopen-requests`, `POST /attendance-logs/reopen-requests/{id}/approve`, `reject`.
  - Giao diện: trang Đơn nghỉ phép (MH-44, MH-13), trang Quy định phép năm (MH-52), phần kỳ công ở trang Chấm công (MH-13), màn hình đơn nghỉ trên ứng dụng giáo viên (MG-10).
- Trạng thái: Đã triển khai

### YCTD-58: DT-06 chia ba phần; hồ sơ nhân sự và hợp đồng lao động – 2026-10-10

- Lý do: thiết kế DT-06; Eric chốt cách chia phần, liên kết tài khoản, cách chấm công và người duyệt đơn nghỉ phép.
- Nội dung thay đổi:
  - DT-06 chia ba phần: 6a hồ sơ nhân sự, hợp đồng, cảnh báo hết hạn, danh sách, nhập Excel nhân sự; 6b ngày nghỉ lễ, lịch nghỉ thứ 7 và học bù, chấm công, đơn nghỉ phép, quy định phép năm, chốt và mở lại bảng công; 6c danh mục phụ cấp và khấu trừ, làm thêm giờ, bảng lương trả trước và duyệt, phiếu lương, phiếu chi lương, quyết toán và phiếu thu thu hồi lương.
  - Chấm công (phần 6b): nhân viên tự bấm vào ca, ra ca trên ứng dụng giáo viên hoặc cổng quản trị, giờ lấy theo máy chủ, chỉ ngày hôm nay; phòng nhân sự nhập hoặc sửa giờ cho mọi người trong đơn vị khi kỳ chưa chốt, có nhật ký.
  - Đơn nghỉ phép (phần 6b) do Hiệu trưởng hoặc Phó Hiệu trưởng duyệt, thay cho quản lý đơn vị ở P08-03.
  - Hồ sơ nhân sự tạo độc lập, gắn một đơn vị chính, mã nhân sự không trùng; số định danh cá nhân mã hóa, chỉ hiện bốn số cuối; phòng ban và chức danh phải đang dùng ở đơn vị chính.
  - Liên kết tài khoản có sẵn: phòng nhân sự nhập tên đăng nhập hoặc số điện thoại, dịch vụ định danh trả tài khoản có vai trò nhân sự; tài khoản chỉ là phụ huynh bị từ chối; mỗi tài khoản gắn tối đa một hồ sơ. Nhân sự có tài khoản xem hồ sơ và hợp đồng của chính mình.
  - Hợp đồng lao động: thử việc, có thời hạn (bắt buộc ngày kết thúc), không thời hạn; lương thỏa thuận và danh sách phụ cấp theo hợp đồng; không trùng thời gian với hợp đồng còn hiệu lực; gia hạn là lập hợp đồng kế tiếp.
  - Chấm dứt hợp đồng: bắt buộc ngày và lý do; khóa tài khoản liên kết ngay và thu hồi phiên (BR-05); hồ sơ chuyển đã nghỉ; kế toán đơn vị nhận thông báo lập bảng quyết toán (phần 6c).
  - Cảnh báo hợp đồng sắp hết hạn theo cấu hình đơn vị `contract_expiry_warning_days` (chưa có mặc định), hiện trên trang chủ cho người xem được nhân sự.
  - Nhập nhân sự từ Excel: mã đơn vị, mã nhân sự, họ tên, ngày sinh, giới tính, điện thoại, thư điện tử, số định danh, tên phòng ban, tên chức danh, ngày vào làm; kiểm tra toàn bộ rồi mới ghi.
  - Mở năm học mới chuyển hồ sơ nhân sự và hợp đồng sang, giữ nguyên mã định danh.
  - Mã quyền mới: `P07.staff.manage` cho VT-06; `P07.staff.view` cho VT-02, VT-15, VT-03, VT-04, VT-05, VT-06; `P07.contract.view` cho VT-02, VT-15, VT-04, VT-05, VT-06 (quản lý đơn vị không thấy lương); `P01.import.staff` cho VT-06. Không dùng `P07.view` vì giáo viên có quyền này.
- Thành phần bị ảnh hưởng: `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `27_BO_CA_KIEM_THU_CHI_TIET/05_P08.md`, `01`, `03`, `index.md`; dịch vụ định danh, máy chủ API, cổng quản trị.
- Dữ liệu bị ảnh hưởng: bảng mới `staff`, `employment_contracts`; lần nhập thêm loại `staff`; cấu hình `contract_expiry_warning_days`.
- API bị ảnh hưởng: `GET, POST /staff`, `GET, PUT /staff/{id}`, `GET /staff/me`, `GET /staff/expiring-contracts`, `POST, DELETE /staff/{id}/account`, `POST /staff/{id}/contracts`, `POST /employment-contracts/{id}/terminate`; dịch vụ định danh `POST /users/staff-accounts/lookup`, `POST /users/{id}/terminate-employment`; nhập dữ liệu nhận loại `staff`.
- Giao diện bị ảnh hưởng: MH-12 Hồ sơ nhân sự, MH-40 (nhân sự), trang chủ (hợp đồng sắp hết hạn).
- Quyền bị ảnh hưởng: thêm `P07.staff.manage`, `P07.staff.view`, `P07.contract.view`, `P01.import.staff`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P08-043, CTC-P08-059, CTC-P01-082.
- Trạng thái: Đã triển khai phần 6a

### YCTD-57: Thanh toán trực tuyến qua tài khoản ảo và mã QR dùng một lần – 2026-10-10

- Lý do: thiết kế DT-05 phần 5f; nhà cung cấp xác nhận chuyển khoản chưa chọn (T1); Eric chốt cách nhận tiền và đối chiếu.
- Nội dung thay đổi:
  - Mỗi lần thanh toán một hóa đơn, nhà cung cấp cấp qua API một tài khoản ảo và mã QR dùng một lần, số tiền bằng số còn phải nộp, nội dung là mã hóa đơn bỏ dấu gạch (ví dụ HD000123). Tiền vào tài khoản ảo đều về một tài khoản ngân hàng duy nhất của trường. Mã QR mất hiệu lực khi đã thanh toán; số còn phải nộp đổi thì hủy mã cũ và xin mã mới.
  - Tài khoản nhận: một tài khoản ngân hàng của Trường chính được đánh dấu nhận thanh toán trực tuyến kèm khoản mục thu của phiếu thu tự lập; kế toán có quyền khai báo quỹ ở Trường chính cấu hình.
  - Đối chiếu: nội dung chứa mã hóa đơn của trẻ thì theo mã đó; không có mã thì theo hóa đơn của tài khoản ảo, số tiền không khớp mà khớp đúng một hóa đơn còn nợ khác của trẻ thì theo hóa đơn đó. Số tiền bằng đúng số còn phải nộp thì tự lập phiếu thu chuyển khoản vào tài khoản trường, phân bổ vào hóa đơn, gửi biên nhận cho phụ huynh. Sai số tiền, không xác định hóa đơn, hóa đơn đã thu đủ thì vào danh sách chờ, báo kế toán; gửi lại cùng mã giao dịch không xử lý lần hai.
  - Kế toán ghi đã xử lý giao dịch chờ kèm nội dung, có thể gắn phiếu thu đã lập tay.
  - Chưa nối nhà cung cấp thật: lớp nhà cung cấp có bản `development` giả lập (bật bằng biến môi trường `PAYMENT_GATEWAY=development`, dùng khi phát triển và kiểm thử) và bản chưa nối báo lỗi khi xin mã QR. Điểm cuối nhận thông báo của nhà cung cấp thật có chữ ký và địa chỉ mạng cho phép (BM-62) làm khi chọn xong nhà cung cấp; điểm cuối giả lập `POST /payment-webhooks/development` chỉ có với bản giả lập, người gọi phải có quyền lập phiếu thu.
- Thành phần bị ảnh hưởng: `10`, `13`, `14`, `16`, `17`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md`, `01`, `03`, `index.md`; mã nguồn tài chính, phiếu thu; cổng quản trị; ứng dụng phụ huynh (thư viện `qrcode`).
- Dữ liệu bị ảnh hưởng: bảng mới `payment_requests`, `online_payment_transactions`; `cash_accounts` thêm `receives_online_payments`, `online_payment_category_id`.
- API bị ảnh hưởng: `GET /invoices/{id}/payment-qr`, `GET, PUT /online-payment-settings`, `GET /online-payment-transactions`, `POST /online-payment-transactions/{id}/resolve`, `POST /payment-webhooks/development`.
- Giao diện bị ảnh hưởng: MH-09 (giao dịch chuyển khoản chờ xử lý), MH-11 (tài khoản nhận thanh toán trực tuyến), MP-11 (thanh toán bằng mã QR).
- Quyền bị ảnh hưởng: không thêm mã quyền; dùng `P06.receipt.manage`, `P06.cash-account.manage`, `P06.view` và quan hệ phụ huynh của trẻ.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P06-056 đến 065; CTC-P06-061 (chữ ký, địa chỉ mạng) chạy khi nối nhà cung cấp thật.
- Trạng thái: Đã triển khai, trừ bộ chuyển đổi nhà cung cấp thật

### YCTD-56: Phiếu đảo phiếu chi – 2026-10-10

- Lý do: phần 5e-2 theo cách chia đã chốt ở YCTD-55.
- Nội dung thay đổi:
  - Phiếu đảo phiếu chi lưu ở bảng `payment_reversals`, số `DPC-000001` dãy riêng toàn trường trong năm học, tham chiếu phiếu gốc. Kế toán, kế toán trưởng lập kèm lý do (tối đa 500 ký tự) cho phiếu chi đã phát hành; phiếu gốc chuyển chờ duyệt đảo; số dư nguồn chi chưa đổi (AC-214).
  - Duyệt theo hạn mức `payment_reversal` của đơn vị bằng quyền `P06.payment.approve`: dưới hạn mức Phó Hiệu trưởng hoặc Hiệu trưởng; từ hạn mức trở lên hoặc chưa đặt hạn mức chỉ Hiệu trưởng (YCTD-24). Từ chối phải có lý do, phiếu gốc về đã phát hành, người lập nhận thông báo.
  - Khi duyệt: cộng lại tiền vào nguồn chi, ghi giao dịch có số phiếu đảo trong sổ quỹ; phiếu gốc chuyển đã đảo. Đảo phiếu hoàn tiền thôi học thì số đã hoàn trở lại số dư có của trẻ.
  - Mã quyền mới: `P06.payment-reversal.create` cho VT-04, VT-05.
- Thành phần bị ảnh hưởng: `08`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md`, `01`, `03`, `index.md`; mã nguồn phiếu chi, sổ quỹ; cổng quản trị.
- Dữ liệu bị ảnh hưởng: bảng mới `payment_reversals`.
- API bị ảnh hưởng: `POST /payments/{id}/reverse`, `/reverse/approve`, `/reverse/reject`, `GET /payment-reversals/pending`; `GET /payments/{id}` thêm `reversals`.
- Giao diện bị ảnh hưởng: MH-10 (lập phiếu đảo, phiếu đảo phiếu chi chờ duyệt).
- Quyền bị ảnh hưởng: thêm `P06.payment-reversal.create`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P06-037, 038, 039.
- Trạng thái: Đã triển khai

### YCTD-55: Phiếu chi, duyệt theo hạn mức và sổ quỹ – 2026-10-10

- Lý do: thiết kế DT-05 phần 5e cần chốt cách phiếu chi hoàn tiền thôi học ảnh hưởng công nợ, mặc định kiểm tra số dư tài khoản ngân hàng, cách chia phần và thời điểm làm phiếu nộp, phiếu rút.
- Nội dung thay đổi:
  - Phần 5e chia hai: 5e-1 phiếu chi và sổ quỹ; 5e-2 phiếu đảo phiếu chi (số `DPC-000001`). Phiếu nộp tiền mặt vào ngân hàng và phiếu rút tiền về quỹ làm cùng P06-06 ở giai đoạn 2.
  - Phiếu chi gồm loại thường, hoàn tiền thôi học, lương; lập ở trạng thái nháp, sửa và xóa được khi còn nháp; trình duyệt phải có ít nhất một chứng từ (ảnh hoặc PDF, mục đích tệp `payment_voucher`). Nguồn chi là quỹ hoặc tài khoản đang dùng của đơn vị; khoản mục là khoản mục chi đang dùng. Thủ quỹ chỉ chi từ quỹ tiền mặt.
  - Duyệt theo hạn mức `payment` của đơn vị: dưới hạn mức Phó Hiệu trưởng hoặc Hiệu trưởng; từ hạn mức trở lên hoặc chưa đặt hạn mức chỉ Hiệu trưởng; phiếu hoàn tiền luôn Hiệu trưởng (BR-24). Người duyệt không được là người lập. Từ chối phải có lý do, phiếu về nháp kèm lý do.
  - Duyệt là phát hành: cấp số `PC-000001` (dãy toàn trường trong năm học), ngày chi là ngày duyệt, trừ số dư nguồn chi và ghi giao dịch. Quỹ tiền mặt không đủ thì luôn chặn; tài khoản ngân hàng không đủ thì chặn theo cấu hình `bank_balance_check` của đơn vị, mặc định bật (chặn). Duyệt lần hai báo người đã duyệt.
  - Phiếu chi hoàn tiền thôi học trừ vào số dư có của trẻ: số hoàn không vượt số dư có (không tính phiếu thu đang chờ duyệt đảo), lấy từ phiếu thu cũ nhất trước (bảng `payment_refund_sources`). Phiếu thu đã dùng để hoàn tiền thì không đảo được.
  - Sổ quỹ theo khoảng ngày cho từng quỹ hoặc tài khoản: số dư đầu kỳ, từng giao dịch kèm số phiếu, tổng thu, tổng chi, số dư cuối kỳ.
  - Mã quyền mới: `P06.payment.manage` cho VT-04, VT-05, VT-16; `P06.payment.approve` cho VT-02, VT-15. Xem phiếu chi và sổ quỹ theo `P06.view` hoặc quyền lập, duyệt trong phạm vi đơn vị.
- Thành phần bị ảnh hưởng: `07`, `08`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md`, `01`, `03`, `index.md`; mã nguồn tài chính, tệp, cấu hình; cổng quản trị.
- Dữ liệu bị ảnh hưởng: bảng mới `payments`, `payment_attachments`, `payment_refund_sources`; `files.purpose` thêm `payment_voucher`.
- API bị ảnh hưởng: `GET, POST /payments`, `GET, PATCH, DELETE /payments/{id}`, `POST /payments/{id}/submit`, `/approve`, `/reject`, `GET /payments/pending`, `GET /cash-books`; `POST /files` nhận mục đích `payment_voucher`.
- Giao diện bị ảnh hưởng: MH-10 Phiếu chi, MH-11 Sổ quỹ.
- Quyền bị ảnh hưởng: thêm `P06.payment.manage`, `P06.payment.approve`.
- Ảnh hưởng chức năng cũ: cấu hình kiểm tra số dư tài khoản ngân hàng có mặc định bật; số dư có của trẻ trừ số đã hoàn.
- Kiểm thử cần thực hiện: CTC-P06-025 đến 036, 040 đến 046.
- Trạng thái: Đã triển khai phần 5e-1; phần 5e-2 ở YCTD-56

### YCTD-54: Đảo phiếu thu và nhập công nợ đầu kỳ – 2026-10-10

- Lý do: thiết kế DT-05 phần 5d-2 cần chốt cách xử lý khi quỹ không đủ tiền lúc duyệt phiếu đảo, dạng số phiếu đảo và mẫu tệp công nợ đầu kỳ.
- Nội dung thay đổi:
  - Phiếu đảo phiếu thu lưu ở bảng riêng `receipt_reversals`, số `DPT-000001` dãy riêng toàn trường trong năm học, tham chiếu phiếu gốc. Kế toán, kế toán trưởng lập kèm lý do (tối đa 500 ký tự); phiếu gốc chuyển chờ duyệt đảo; công nợ và quỹ chưa đổi (AC-212).
  - Duyệt theo hạn mức `receipt_reversal` của đơn vị: dưới hạn mức Phó Hiệu trưởng hoặc Hiệu trưởng; từ hạn mức trở lên hoặc chưa đặt hạn mức chỉ Hiệu trưởng. Từ chối phải có lý do, phiếu gốc về đã phát hành, người lập nhận thông báo.
  - Khi duyệt: trừ tiền khỏi quỹ hoặc tài khoản nhận; quỹ tiền mặt không đủ số dư thì chặn, phiếu đảo vẫn chờ duyệt (BR-34). Phiếu gốc chuyển đã đảo, các phân bổ của phiếu gốc không còn tính vào số đã thu nên hóa đơn trở lại còn phải nộp. Phụ huynh và kế toán trưởng nhận thông báo kèm lý do.
  - Phiếu đang chờ duyệt đảo không dùng làm nguồn số dư có.
  - Nhập công nợ đầu kỳ: tệp gồm số định danh cá nhân của trẻ (bắt buộc), họ tên để đối chiếu, số tiền (số nguyên dương), ngày đến hạn, ghi chú. Trẻ phải thuộc phạm vi của người nhập; mỗi trẻ tối đa một hóa đơn đầu kỳ trong năm học; chưa nhận số dư có đầu kỳ. Mỗi dòng tạo một hóa đơn loại đầu kỳ đã phát hành ở tháng đầu năm học, số `HD-`, một dòng khoản "Công nợ đầu kỳ".
  - Mã quyền mới: `P06.receipt-reversal.create` cho VT-04, VT-05; `P06.receipt-reversal.approve` cho VT-02, VT-15; `P05.opening-debt.import` cho VT-04.
- Thành phần bị ảnh hưởng: `08`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md`, `01`, `03`, `index.md`; mã nguồn phiếu thu, nhập dữ liệu; cổng quản trị.
- Dữ liệu bị ảnh hưởng: bảng mới `receipt_reversals`; `invoices.invoice_kind` thêm `opening`, `invoice_items.item_type` thêm `opening`, `data_import_jobs.import_type` thêm `opening_debts`.
- API bị ảnh hưởng: `POST /receipts/{id}/reverse`, `/reverse/approve`, `/reverse/reject`, `GET /receipt-reversals/pending`; `GET /receipts/{id}` thêm `reversals`; `POST /imports`, `GET /imports/templates/opening_debts` nhận loại `opening_debts`.
- Giao diện bị ảnh hưởng: MH-09 (lập phiếu đảo, phiếu đảo chờ duyệt), MH-40 (công nợ đầu kỳ).
- Quyền bị ảnh hưởng: thêm `P06.receipt-reversal.create`, `P06.receipt-reversal.approve`, `P05.opening-debt.import`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P06-019 đến 024, CTC-P01-079, 082.
- Trạng thái: Đã triển khai

### YCTD-53: Phiếu thu, phân bổ, quỹ và công nợ phải thu – 2026-10-10

- Lý do: thiết kế DT-05 phần 5d cần chốt nơi nhận tiền của phiếu thu (bảng `cash_accounts` đang xếp cho phần 5e), dạng số phiếu thu, cấp phân bổ khi miễn giảm và điều chỉnh tính ở cấp hóa đơn, và cách nhập công nợ đầu kỳ.
- Nội dung thay đổi:
  - Phần 5d chia hai: 5d-1 quỹ và tài khoản, phiếu thu, phân bổ, công nợ; 5d-2 đảo phiếu thu và nhập công nợ đầu kỳ.
  - Quỹ tiền mặt và tài khoản ngân hàng (`cash_accounts`) cùng giao dịch tài khoản (`account_transactions`) làm ở phần 5d-1: kế toán, kế toán trưởng khai báo; số dư đầu chỉ nhập khi khai báo; phiếu thu ghi giao dịch và cộng số dư. Sổ quỹ theo ngày và phiếu chi làm ở phần 5e.
  - Số phiếu thu dạng `PT-000001`, một dãy số toàn trường trong năm học nên không trùng trong đơn vị (BR-30); phiếu đảo phần 5d-2.
  - Phân bổ theo hóa đơn: `receipt_allocations` lưu `invoice_id` thay cho `invoice_item_id`. Số phân bổ của mỗi hóa đơn bằng đúng số còn phải nộp (BR-31, Q-47); tổng phân bổ không vượt số thu. Tiền chưa phân bổ là số dư có của trẻ, dùng để thanh toán hóa đơn kỳ sau, lấy từ phiếu thu cũ nhất trước (GD-27).
  - Phiếu thu phát hành ngay khi lập, không có bản nháp; màn hình gửi mã yêu cầu để gửi lại không tạo phiếu thứ hai (QT-04 E5). Bỏ điểm cuối `POST /receipts/{id}/issue`.
  - Thu tiền mặt thì tài khoản nhận là quỹ tiền mặt, chuyển khoản thì là tài khoản ngân hàng, cùng đơn vị của trẻ; khoản mục phải là khoản mục thu đang dùng; ngày thu không sau hôm nay. Thủ quỹ chỉ lập phiếu thu tiền mặt (Q-152).
  - Còn phải nộp của hóa đơn = số phải nộp − số đã phân bổ từ phiếu thu chưa bị đảo; trạng thái đã thu đủ, quá hạn tính ra, không lưu riêng. Chặn đăng ký khi nợ quá hạn (BR-33) tính theo số còn phải nộp. Miễn giảm hoặc điều chỉnh giảm vượt số còn phải nộp thì chặn; hóa đơn đã thu thì đảo phiếu thu trước.
  - Mã quyền mới: `P06.receipt.manage` cho VT-04, VT-16; `P06.cash-account.manage` cho VT-04, VT-05; `P05.debt.view` cho VT-02, VT-15, VT-03, VT-04, VT-05, VT-16. Không dùng `P05.view` cho công nợ vì giáo viên có quyền này (CTC-P05-062).
  - Nhập công nợ đầu kỳ (phần 5d-2): mỗi dòng của tệp tạo một hóa đơn loại đầu kỳ đã phát hành, thu bằng phiếu thu như hóa đơn thường.
- Thành phần bị ảnh hưởng: `08`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md`, `27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md`, `01`, `03`, `index.md`; mã nguồn DT-05 phần 5d-1, số tiền hóa đơn, miễn giảm, đăng ký dịch vụ; cổng quản trị, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: bảng mới `cash_accounts`, `receipts`, `receipt_allocations`, `account_transactions`.
- API bị ảnh hưởng: `GET, POST /cash-accounts`, `PATCH /cash-accounts/{id}`, `GET, POST /receipts`, `GET, DELETE /receipts/{id}`, `GET /children/{id}/receipts`, `POST /children/{id}/credit-allocations`, `GET /debts`, `GET /children/{id}/debt`; `GET /invoices`, `GET /invoices/{id}` thêm `paid_amount`, `outstanding_amount`.
- Giao diện bị ảnh hưởng: MH-08 Công nợ (danh sách, chi tiết của trẻ, lập phiếu thu, dùng số dư có), MH-09 Phiếu thu, MH-11 Quỹ và tài khoản, MP-11.
- Quyền bị ảnh hưởng: thêm `P06.receipt.manage`, `P06.cash-account.manage`, `P05.debt.view`.
- Ảnh hưởng chức năng cũ: miễn giảm và phiếu điều chỉnh giảm bị chặn khi vượt số còn phải nộp của hóa đơn đã thu.
- Kiểm thử cần thực hiện: CTC-P06-001 đến 018, CTC-P05-061, 062.
- Trạng thái: Đã triển khai phần 5d-1; phần 5d-2 ở YCTD-54

### YCTD-52: Miễn giảm và phiếu điều chỉnh hóa đơn – 2026-10-10

- Lý do: thiết kế DT-05 phần 5c-2 cần chốt thời điểm lập miễn giảm, cách xử lý miễn giảm lặp lại mỗi tháng và quyền duyệt khác với `P05.approve` hiện có (kế toán, kế toán trưởng cũng có quyền này).
- Nội dung thay đổi:
  - Miễn giảm lập được trên hóa đơn nháp và hóa đơn đã phát hành; không sửa dòng khoản phải thu. Số phải nộp bằng tổng hóa đơn trừ miễn giảm đã duyệt, cộng điều chỉnh đã duyệt; số đã thu trừ thêm ở phần 5d. Chạy lại tính học phí thì miễn giảm chờ duyệt được tính lại theo dòng mới, miễn giảm đã duyệt giữ nguyên số tiền; tổng miễn giảm vượt tổng hóa đơn thì đánh dấu dòng cần kiểm tra.
  - Miễn giảm lập theo từng hóa đơn, mỗi khoản có căn cứ và người duyệt (BR-20); có nút chép miễn giảm đã duyệt của hóa đơn chính kỳ trước sang hóa đơn kỳ này, bản chép vẫn chờ duyệt.
  - Số tiền miễn giảm tính trên tổng các dòng thuộc khoản áp dụng của loại miễn giảm: phần trăm làm tròn đến đồng, số tiền cố định giữ nguyên; vượt các khoản áp dụng hoặc tổng miễn giảm chờ duyệt và đã duyệt vượt tổng hóa đơn thì chặn (BR-22).
  - Phiếu điều chỉnh chỉ cho hóa đơn đã phát hành, tăng hoặc giảm kèm lý do, số `DC-000001` liên tục trong năm học; giảm vượt số phải nộp thì chặn.
  - Duyệt theo hạn mức đang hiệu lực của đơn vị của hóa đơn (`tuition_discount`, `invoice_adjustment`): dưới hạn mức thì Phó Hiệu trưởng hoặc Hiệu trưởng duyệt; từ hạn mức trở lên hoặc chưa đặt hạn mức thì chỉ Hiệu trưởng (Q-112). Từ chối phải có lý do. Phó Hiệu trưởng chỉ thấy khoản dưới hạn mức trong danh sách chờ duyệt.
  - Mã quyền mới: `P05.discount.manage` cho VT-04 (lập miễn giảm); `P05.invoice-adjustment.create` cho VT-04, VT-05 (lập phiếu điều chỉnh); `P05.fee-document.approve` cho VT-02 toàn trường và VT-15 trong đơn vị được gán (duyệt). Quản lý đơn vị chỉ xem (Q-134).
  - Phụ huynh chỉ thấy miễn giảm và điều chỉnh đã duyệt; chặn đăng ký khi nợ quá hạn tính theo số phải nộp.
- Thành phần bị ảnh hưởng: `07`, `08`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md`, `01`, `03`, `index.md`; mã nguồn DT-05 phần 5c-2, tính học phí, đăng ký dịch vụ; cổng quản trị, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: bảng mới `discounts`, `invoice_adjustments`.
- API bị ảnh hưởng: `POST /invoices/{id}/discounts`, `POST /invoices/{id}/discounts/copy-previous`, `POST /discounts/{id}/approve`, `/reject`, `POST /invoice-adjustments`, `POST /invoice-adjustments/{id}/approve`, `/reject`, `GET /fee-approvals/pending`; `GET /invoices`, `GET /invoices/{id}` thêm `discount_amount`, `adjustment_amount`, `payable_amount`, `discounts`, `adjustments`.
- Giao diện bị ảnh hưởng: MH-06 (chi tiết hóa đơn có miễn giảm, điều chỉnh, số phải nộp), MH-07 Duyệt miễn giảm và điều chỉnh, MP-11.
- Quyền bị ảnh hưởng: thêm `P05.discount.manage`, `P05.invoice-adjustment.create`, `P05.fee-document.approve`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P05-043 đến 060.
- Trạng thái: Đã triển khai

### YCTD-51: Tính học phí, phát hành hóa đơn và chặn đăng ký khi nợ quá hạn – 2026-10-10

- Lý do: thiết kế DT-05 phần 5c cần chốt cách đếm ngày học của BR-23, cách chạy tính học phí, mốc đánh dấu dòng cần kiểm tra và cách làm tròn; khi rà phần 5b phát hiện phụ huynh xem được bảng đăng ký của cả đơn vị vì VT-14 gán theo đơn vị của con.
- Nội dung thay đổi:
  - Phần 5c chia hai: 5c-1 tính học phí, phát hành hóa đơn chính và bổ sung, xem hóa đơn, chặn đăng ký khi nợ quá hạn; 5c-2 miễn giảm và phiếu điều chỉnh hóa đơn.
  - BR-23: số ngày học thực tế là số ngày học theo lịch năm học trong thời gian trẻ đang học (từ ngày nhập học hoặc đầu tháng tới ngày thôi học hoặc cuối tháng), không trừ ngày vắng; trẻ học trọn tháng thu đủ học phí chính khóa, vắng chỉ trừ tiền ăn.
  - Tiền ăn bằng đơn giá bán trú nhân số ngày có mặt, đi muộn, về sớm theo điểm danh đã chốt. Dịch vụ theo tháng thu đủ; đăng ký trễ được duyệt thu theo ngày thực tế thì tính theo số ngày học từ ngày bắt đầu học dịch vụ. Dịch vụ đang chờ duyệt hủy vẫn thu. Mỗi dòng làm tròn đến đồng; học phí chính khóa bằng 0 thì không có dòng.
  - Tính học phí chạy ngay trong yêu cầu, có ghi lần chạy (thành công hoặc thất bại kèm lỗi); lỗi giữa chừng thì giữ kết quả cũ, chạy lại được. Điều kiện: danh sách đăng ký của kỳ đã chốt; có biểu phí hiệu lực cho mọi bậc học và dịch vụ (thiếu thì chặn, chỉ rõ bậc học, dịch vụ thiếu); mọi ngày học của các lớp đã chốt điểm danh (Q-151); kỳ chưa phát hành.
  - Kết quả tính là hóa đơn nháp; chạy lại thay kết quả, không sinh trùng. Dòng cần kiểm tra theo mốc cố định, không chặn phát hành: vắng từ 5 ngày học; tổng chênh hơn 30% so với hóa đơn chính kỳ trước; không có dịch vụ không bắt buộc và không có ngày ăn.
  - Phát hành cấp số hóa đơn dạng `HD-000001` liên tục trong năm học, ghi ngày đến hạn (không nhỏ hơn ngày phát hành), khóa kỳ, báo phụ huynh trong ứng dụng và tin nhắn. Hóa đơn bổ sung lập cho đăng ký trễ đã duyệt chưa lập khoản thu, phát hành ngay.
  - Hóa đơn không sửa trực tiếp: hóa đơn nháp sửa bằng chạy lại tính, hóa đơn đã phát hành lập phiếu điều chỉnh (BR-25).
  - Mã quyền mới `P05.fee-calculation.manage` cho VT-04 trong đơn vị được gán. Nhân sự xem hóa đơn bằng `P05.view` trong phạm vi đơn vị, không tính vai trò phụ huynh; phụ huynh chỉ xem hóa đơn đã phát hành của con mình. Bảng đăng ký dịch vụ của đơn vị cũng không còn cho phụ huynh xem.
  - Chặn phụ huynh đăng ký thêm dịch vụ khi đơn vị bật chặn và trẻ có hóa đơn đã phát hành quá hạn (BR-33); số đã thu trừ vào khi có phiếu thu ở phần 5d.
- Thành phần bị ảnh hưởng: `07`, `08`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md`, `01`, `03`, `index.md`; mã nguồn DT-05 phần 5c-1, đăng ký dịch vụ; cổng quản trị, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: bảng mới `fee_calculation_runs`, `invoices`, `invoice_items`, `document_sequences`.
- API bị ảnh hưởng: `POST /fee-calculations`, `GET /fee-calculations/{id}`, `GET /invoices`, `GET`, `PATCH /invoices/{id}`, `POST /invoices/issue`, `POST /invoices/supplementary`; `POST /service-registrations` thêm chặn BR-33; `GET /service-registrations` không cho phụ huynh.
- Giao diện bị ảnh hưởng: MH-06 Học phí, MP-11 trong ứng dụng phụ huynh.
- Quyền bị ảnh hưởng: thêm `P05.fee-calculation.manage`.
- Ảnh hưởng chức năng cũ: phụ huynh không còn xem được bảng đăng ký dịch vụ của cả đơn vị (sửa lỗi phân quyền).
- Kiểm thử cần thực hiện: CTC-P05-015, 017, 018, 023 đến 026, 029 đến 031, 033 đến 042.
- Trạng thái: Đã triển khai phần 5c-1; phần 5c-2 ở YCTD-52

### YCTD-50: Đăng ký dịch vụ, hủy trễ và học hè – 2026-10-10

- Lý do: thiết kế DT-05 phần 5b cần chốt cách hủy dịch vụ sau ngày chốt, dịch vụ trong tháng hè và quyền duyệt đăng ký trễ khác với quyền `P05.approve` hiện có (kế toán cũng có quyền này).
- Nội dung thay đổi:
  - Hủy dịch vụ không bắt buộc sau ngày chốt hoặc khi kỳ đã chốt danh sách thì chờ Ban Giám hiệu duyệt, như đăng ký trễ; từ chối thì đăng ký giữ nguyên, duyệt thì hủy. Rút đăng ký trễ chưa duyệt thì hủy ngay.
  - Tháng hè không tự giữ dịch vụ không bắt buộc từ năm học; chỉ trẻ đã đăng ký học hè tháng đó mới có dòng đăng ký (tự có bán trú) và đăng ký thêm dịch vụ được.
  - Mã quyền mới `P05.registration.manage` cho VT-04 trong đơn vị được gán: đăng ký, hủy dịch vụ và học hè thay phụ huynh, chốt danh sách kỳ. Mã quyền mới `P05.late-registration.approve` cho VT-02 toàn trường và VT-15 trong đơn vị được gán: duyệt, từ chối đăng ký trễ và hủy trễ. Quản lý đơn vị chỉ xem (Q-134).
  - Mục cấu hình mới `service_registration_closing_day` theo đơn vị, mặc định 25, nhận 1 đến 28 hoặc ngày cuối tháng.
  - Trạng thái dòng đăng ký: đang hiệu lực, chờ duyệt đăng ký trễ, chờ duyệt hủy, đã hủy, bị từ chối. Dòng của kỳ được tạo khi mở bảng, xem của trẻ, đăng ký hoặc chốt kỳ: dịch vụ bắt buộc cho mọi trẻ học trong kỳ, dịch vụ không bắt buộc giữ từ tháng gần nhất có đăng ký đang hiệu lực.
  - Ngày kỳ hè trở thành ngày học cho trẻ đã đăng ký học hè tháng đó: bảng điểm danh và báo vắng ngày hè chỉ gồm các trẻ này (CTC-P04-046).
  - Hủy học hè chỉ trước ngày chốt của tháng đó; hủy thì các dòng đăng ký dịch vụ của tháng hè cũng hủy.
  - Chặn đăng ký thêm khi trẻ còn nợ quá hạn (BR-33, CTC-P05-017, 018) làm khi có hóa đơn ở phần 5c, 5d.
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md`, `03_P05.md`, `01`, `03`, `index.md`; mã nguồn DT-05 phần 5b, điểm danh; cổng quản trị, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: bảng mới `service_registrations`, `registration_periods`, `summer_registrations`.
- API bị ảnh hưởng: `GET /service-registrations/periods`, `GET /service-registrations`, `GET /service-registrations/pending`, `GET /children/{id}/service-registrations`, `POST /service-registrations`, `POST /service-registrations/lock`, `POST /service-registrations/{id}/cancel`, `/approve-late`, `/reject-late`; `GET`, `POST /summer-registrations`, `DELETE /summer-registrations/{id}`; bảng điểm danh ngày hè.
- Giao diện bị ảnh hưởng: MH-05 Đăng ký dịch vụ, MP-12 trong ứng dụng phụ huynh, màn hình Cấu hình có mục ngày chốt đăng ký dịch vụ.
- Quyền bị ảnh hưởng: thêm `P05.registration.manage`, `P05.late-registration.approve`.
- Ảnh hưởng chức năng cũ: ngày kỳ hè trước đây không có bảng điểm danh, nay có bảng gồm trẻ đăng ký học hè.
- Kiểm thử cần thực hiện: CTC-P05-009 đến 022, 064 đến 067; CTC-P04-046.
- Trạng thái: Đã triển khai

### YCTD-49: Chia đợt DT-05 và danh mục học phí, tài chính – 2026-10-10

- Lý do: thiết kế DT-05 cần chốt cách chia đợt, cách giữ đăng ký dịch vụ qua các tháng, nguồn của ngày chốt đăng ký và phạm vi của danh mục loại miễn giảm, khoản mục thu chi.
- Nội dung thay đổi:
  - DT-05 chia sáu phần: 5a danh mục (khoản mục thu chi, dịch vụ, biểu phí, loại miễn giảm); 5b đăng ký dịch vụ, chốt, đăng ký trễ, đăng ký học hè; 5c tính học phí, miễn giảm, phát hành hóa đơn, điều chỉnh hóa đơn; 5d phiếu thu, phân bổ, đảo phiếu thu, công nợ, nhập công nợ đầu kỳ; 5e phiếu chi, quỹ tiền mặt; 5f thanh toán mã QR.
  - Đăng ký dịch vụ không bắt buộc tự giữ sang các tháng sau cho tới khi phụ huynh hoặc kế toán hủy trước ngày chốt; mỗi tháng vẫn có một dòng đăng ký theo kỳ (làm ở phần 5b).
  - Ngày chốt đăng ký dịch vụ là mục cấu hình theo đơn vị, mặc định ngày 25 của tháng trước kỳ, kế thừa như các cấu hình khác; sau ngày đó hoặc khi kế toán đã chốt danh sách thì đăng ký thêm là đăng ký trễ (làm ở phần 5b).
  - Danh mục dịch vụ, biểu phí, loại miễn giảm, khoản mục thu chi dùng chung toàn trường, chuyển sang năm học mới. Bán trú do hệ thống tạo sẵn: bắt buộc, tính theo ngày có mặt, không ngừng và không đổi cách tính được.
  - Biểu phí theo phiên bản: phiên bản bắt đầu ngày 1 của một tháng, sau phiên bản mới nhất; phiên bản trước tự kết thúc ngay trước đó; mỗi phiên bản có học phí chính khóa theo tháng và giá từng dịch vụ theo bậc học; phiên bản đã tới ngày hiệu lực không sửa được, phiên bản chưa tới sửa và xóa được.
  - Loại miễn giảm theo phần trăm (1 đến 100) hoặc số tiền, áp dụng cho học phí chính khóa và các dịch vụ được chọn; mã và cách tính không đổi sau khi tạo.
  - Mã quyền mới: `P05.fee-catalog.manage` cho VT-04 (dịch vụ, biểu phí); `P05.discount-type.manage` cho VT-04, VT-02; `P06.cashflow-category.manage` cho VT-04, VT-05. Mọi người đã đăng nhập xem được dịch vụ và biểu phí; nhân sự xem được loại miễn giảm và khoản mục thu chi.
- Thành phần bị ảnh hưởng: `07`, `08`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md`, `04_P06.md`, `01`, `03`, `index.md`; mã nguồn DT-05 phần 5a; cổng quản trị.
- Dữ liệu bị ảnh hưởng: bảng mới `services`, `fee_schedules`, `fee_schedule_items`, `discount_types`, `cashflow_categories`; các bảng này không có `org_unit_id` vì dùng chung toàn trường.
- API bị ảnh hưởng: `GET`, `POST /services`, `PATCH /services/{id}`; `GET`, `POST /fee-schedules`, `GET`, `PUT`, `DELETE /fee-schedules/{id}`; `GET`, `POST /discount-types`, `PATCH /discount-types/{id}`; `GET`, `POST /cashflow-categories`, `PATCH /cashflow-categories/{id}`.
- Giao diện bị ảnh hưởng: MH-04 Biểu phí và dịch vụ (thêm loại miễn giảm), MH-39 Khoản mục thu chi.
- Quyền bị ảnh hưởng: thêm `P05.fee-catalog.manage`, `P05.discount-type.manage`, `P06.cashflow-category.manage`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P05-001 đến 008, 043 đến 045; CTC-P06-052 đến 055.
- Trạng thái: Đã triển khai phần 5a, 5b

### YCTD-48: Người được ủy quyền đón trẻ và đón trả – 2026-10-10

- Lý do: thiết kế DT-04 phần 4b cần chốt lượt đón trả được ghi, vai trò của bảo vệ, ai xác nhận người đón ngoài danh sách và ai phía nhà trường khai báo người được ủy quyền.
- Nội dung thay đổi:
  - Nhật ký đón trả chỉ ghi lượt bàn giao chiều của giáo viên chủ nhiệm cho trẻ có mặt; thời điểm đón không trước thời điểm điểm danh; mỗi trẻ một lượt mỗi ngày. Lượt nhận trẻ buổi sáng đã có ở điểm danh.
  - Phụ huynh có đánh dấu được đón trẻ trong hồ sơ và người được ủy quyền còn hiệu lực được bàn giao ngay. Người khác, kể cả ủy quyền đã hủy hoặc hết hạn, thì máy chủ chặn và gửi yêu cầu xác nhận tới các phụ huynh có tài khoản của trẻ; bất kỳ phụ huynh nào của trẻ xác nhận hoặc từ chối trên ứng dụng phụ huynh. Xác nhận chỉ có hiệu lực cho trẻ, người đón và ngày đó; phụ huynh từ chối thì vẫn chặn.
  - Bảo vệ xác nhận người đón tại cổng độc lập với bàn giao của giáo viên: tra trẻ trong đơn vị được gán, chỉ xác nhận được phụ huynh được đón và người được ủy quyền còn hiệu lực; người ngoài danh sách thì báo giáo viên chủ nhiệm. Bảo vệ không xem hồ sơ trẻ.
  - Phụ huynh tự khai báo và hủy người được ủy quyền cho con mình, có hiệu lực ngay. Phía nhà trường dùng mã quyền mới `P02.authorized-pickup.manage` cho VT-02, VT-15 toàn trường và VT-03 trong đơn vị được gán. Mã quyền mới `P04.pickup.gate-confirm` cho VT-18 trong đơn vị được gán.
  - Người được ủy quyền gồm họ tên, quan hệ (chữ tự nhập), số điện thoại bắt buộc, hiệu lực từ ngày (mặc định hôm nay) đến ngày (trống là không thời hạn).
  - Ảnh bàn giao tùy chọn, ảnh JPEG hoặc PNG tải lên kho tệp với mục đích `pickup_photo`; ai xem được trẻ thì xem được ảnh.
- Thành phần bị ảnh hưởng: `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md`, `01`, `03`, `index.md`; mã nguồn DT-04 phần 4b; ứng dụng giáo viên, ứng dụng phụ huynh, cổng quản trị.
- Dữ liệu bị ảnh hưởng: bảng mới `authorized_pickups`, `pickup_confirmation_requests`, `pickup_records`; `files.purpose` thêm `pickup_photo`.
- API bị ảnh hưởng: `GET`, `POST /children/{id}/authorized-pickups`; `DELETE /authorized-pickups/{id}`; `GET /classes/{id}/pickups`; `POST /children/{id}/pickups`; `GET /pickup-directory`; `GET /pickup-confirmations`; `POST /pickup-confirmations/{id}/confirm`, `/refuse`; `POST /files` nhận ảnh bàn giao của giáo viên chủ nhiệm.
- Giao diện bị ảnh hưởng: MG-01, MG-04, MG-16, MP-01, MP-18; chi tiết hồ sơ trẻ trên cổng quản trị có mục người được ủy quyền.
- Quyền bị ảnh hưởng: thêm `P02.authorized-pickup.manage`, `P04.pickup.gate-confirm`.
- Ảnh hưởng chức năng cũ: tải tệp lên kiểm tra quyền theo mục đích ở tầng nghiệp vụ; tệp của hồ sơ trẻ vẫn cần `P02.child.manage`.
- Kiểm thử cần thực hiện: CTC-P02-034 đến 038, CTC-P04-024 đến 031.
- Trạng thái: Đã triển khai

### YCTD-47: Điểm danh, chốt ngày và báo vắng – 2026-10-10

- Lý do: thiết kế DT-04 cần chốt cách chia đợt, nguồn của giờ học trong BR-13, trạng thái ban đầu của bảng điểm danh và cách xử lý kỳ hè khi chưa có đăng ký học hè (P05-13).
- Nội dung thay đổi:
  - DT-04 chia hai phần: 4a điểm danh, chốt ngày, báo vắng; 4b người được ủy quyền đón và đón trả.
  - Thêm mục cấu hình theo đơn vị `school_start_time` (giờ bắt đầu học), mặc định 07:30; báo vắng trước giờ này là nghỉ có báo, sau là báo muộn.
  - Bảng điểm danh ban đầu chưa đánh dấu; trẻ đã báo vắng hiện sẵn là nghỉ có báo; còn trẻ chưa đánh dấu thì không chốt được ngày.
  - Chỉ có bảng điểm danh vào ngày học theo lịch năm học; kỳ hè chưa có bảng cho tới khi có P05-13; ngày học bù thứ bảy chờ P08-10.
  - Mã quyền mới `P04.attendance.manage` cho VT-03: chốt thay giáo viên, sửa sau khi chốt kèm lý do, mở lại ngày đã chốt. Giáo viên chủ nhiệm đang được phân công điểm danh và chốt lớp mình.
  - Ứng dụng giáo viên lưu tạm điểm danh trên thiết bị khi mất mạng và tự gửi lại; bản ghi gửi bù được đánh dấu nhập bù.
  - Người nhận thông báo có thể là mọi tài khoản có một vai trò ở đơn vị, phân hệ thông báo xác định khi gửi.
  - Thêm MH-51 Điểm danh trên cổng quản trị.
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md`, `01`, `03`, `index.md`; mã nguồn DT-04 phần 4a; ứng dụng giáo viên, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: bảng `attendance_records` thêm `org_unit_id`; bảng mới `attendance_days`; `absence_records` thêm `org_unit_id`, `reported_by`; `notification_recipients` thêm `role_code`, `org_unit_id`.
- API bị ảnh hưởng: `GET`, `PUT /classes/{id}/attendance`; `POST /classes/{id}/attendance/lock`, `/unlock`; `GET`, `POST /absences`; `GET /children/{id}/attendance`.
- Giao diện bị ảnh hưởng: MG-01, MG-02, MP-02, MP-06, MH-51; màn hình Cấu hình có mục giờ bắt đầu học.
- Quyền bị ảnh hưởng: thêm `P04.attendance.manage`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P04-001 đến 006, 009 đến 023, 044, 045.
- Trạng thái: Đã triển khai

### YCTD-46: Nhập dữ liệu ban đầu và nhập mã định danh ngành – 2026-10-10

- Lý do: trẻ nhập từ Excel là trẻ đang học sẵn nhưng BR-81 bắt buộc bản chụp giấy khai sinh mà tệp Excel không mang được; tài liệu chưa có mẫu tệp mã định danh ngành; chưa rõ phần 3c nhập những loại dữ liệu nào.
- Nội dung thay đổi:
  - Phần 3c nhập hai loại: lớp học; trẻ kèm tối đa hai phụ huynh trên một dòng. Nhân sự và công nợ đầu kỳ nhập ở phân hệ P07, P05.
  - Trẻ nhập vào thẳng trạng thái đang học, xếp vào lớp ghi trong tệp; phụ huynh có số điện thoại được tạo tài khoản như khi duyệt; đồng ý hình ảnh chờ phụ huynh xác nhận; giấy khai sinh bổ sung sau, danh sách trẻ có bộ lọc thiếu giấy khai sinh.
  - Mẫu tệp mã ngành của hệ thống gồm số định danh cá nhân, mã định danh ngành, họ tên để đối chiếu; dòng khớp được gán ngay, dòng không khớp hoặc trùng mã được báo.
  - Nhập dữ liệu ban đầu hai bước: tải lên để kiểm tra toàn bộ và nhận báo cáo dòng lỗi; ghi khi không còn dòng lỗi, hệ thống kiểm tra lại trước khi ghi. Tệp gốc lưu ở kho tệp, báo cáo lỗi không chứa số định danh ở dạng rõ.
  - Mã quyền mới `P01.import.children` chỉ VT-02 (BM-63); nhập mã ngành dùng `P02.child.manage`.
  - Tệp nhập tối đa 5 MB, 2 000 dòng, nhận diện Excel theo nội dung tệp; tệp vượt dung lượng trả `ERR_VALIDATION`.
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md`, `01`, `03`, `index.md`; mã nguồn DT-03 phần 3c.
- Dữ liệu bị ảnh hưởng: `children.birth_certificate_file_id` cho phép trống với trẻ nhập; `files.purpose` thêm `import`; bảng `data_import_jobs` thêm `errors`, `committed_by`.
- API bị ảnh hưởng: `GET /imports/templates/{type}`, `POST /imports`, `GET /imports/{id}`, `POST /imports/{id}/commit`, `POST /imports/moet-codes`; `GET /children` thêm bộ lọc `missing_birth_certificate`.
- Giao diện bị ảnh hưởng: MH-40; MH-02 thêm bộ lọc và bổ sung giấy khai sinh.
- Quyền bị ảnh hưởng: thêm `P01.import.children`.
- Ảnh hưởng chức năng cũ: BR-81 có ngoại lệ cho trẻ nhập từ dữ liệu ban đầu.
- Kiểm thử cần thực hiện: CTC-P01-076 đến 078, 080, 081, 083, 084; CTC-P02-065 đến 068.
- Trạng thái: Đã triển khai

### YCTD-45: Hồ sơ trẻ từ lúc tiếp nhận đến khi vào lớp – 2026-10-10

- Lý do: thiết kế DT-03 phần 3b gặp các điểm chưa rõ: đồng ý hình ảnh bắt buộc khi lập hồ sơ nhưng phụ huynh chưa có tài khoản; nhiều vai trò có `P02.view` nhưng chưa rõ phạm vi xem trẻ; chưa có kho tệp cho giấy khai sinh; GD-90 chuyển trẻ sang năm mới cùng lớp gần nhất mâu thuẫn với việc lớp không chuyển sang năm mới (YCTD-44). Ảnh Docker của MinIO không còn tải được.
- Nội dung thay đổi:
  - Đồng ý hình ảnh khi lập hồ sơ có ba trạng thái: đồng ý bằng giấy ký tay kèm bản chụp, không đồng ý, chờ phụ huynh xác nhận trên ứng dụng (xem như chưa đồng ý, BR-65).
  - Phạm vi xem trẻ: Ban Giám hiệu, quản lý đơn vị, tuyển sinh, kế toán, kế toán trưởng, nhân sự, y tế, bếp, kho xem trẻ trong đơn vị; giáo viên chủ nhiệm và bộ môn xem trẻ trong lớp được phân công; phụ huynh xem con mình; tổ trưởng chuyên môn và bảo vệ chưa xem được. Dữ liệu sức khỏe theo BR-53; người lập hồ sơ xem được khi hồ sơ còn nháp hoặc chờ duyệt.
  - Kho tệp tương thích S3; khi phát triển và kiểm thử dùng SeaweedFS trong Docker thay MinIO; chỉ nhận ảnh JPEG, PNG hoặc PDF tối đa 10 MB, nhận diện theo nội dung tệp.
  - Chuyển trẻ sang năm học mới (GD-90) để lại làm cùng chức năng lên lớp ở đợt sau.
  - Mã quyền mới `P02.child.manage` (VT-02, VT-15, VT-03, VT-12) và `P02.national-id.view` (VT-02, VT-15, VT-03, VT-12); duyệt, từ chối, chuyển lớp, sửa thông tin định danh của trẻ đang học dùng `P02.approve`.
  - Số định danh mã hóa AES-256-GCM, kiểm tra trùng bằng giá trị băm có khóa; hai khóa đọc từ biến môi trường.
  - Dịch vụ định danh thêm `POST /users/guardian-accounts` để tạo tài khoản phụ huynh khi duyệt hồ sơ, bằng mã phiên của người duyệt.
  - Chuyển lớp chỉ trong cùng đơn vị; chuyển sang lớp của đơn vị khác dùng P02-07. Không đóng được lớp còn trẻ đang học.
  - Kiểm thử các gói chạy lần lượt vì cùng dùng cơ sở dữ liệu định danh khi phát triển.
- Thành phần bị ảnh hưởng: `08`, `12`, `13`, `16`, `17`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md`, `01`, `03`, `index.md`; mã nguồn DT-03 phần 3b; docker compose và GitHub Actions.
- Dữ liệu bị ảnh hưởng: bảng `files`, `children`, `health_profiles`, `guardians`, `child_guardians`, `class_enrollments`, `photo_consent_histories`, `data_access_logs`, `notifications`, `notification_recipients`.
- API bị ảnh hưởng: nhóm điểm cuối hồ sơ trẻ, `POST /files`, `GET /files/{id}`, `GET /classes/{id}/children`, `PATCH /children/{id}/guardians/{guardianId}`; dịch vụ định danh thêm `POST /users/guardian-accounts`.
- Giao diện bị ảnh hưởng: MH-02; MH-03 hiện sĩ số đang học.
- Quyền bị ảnh hưởng: thêm `P02.child.manage`, `P02.national-id.view`.
- Ảnh hưởng chức năng cũ: danh sách lớp trả thêm `enrolled_count`.
- Kiểm thử cần thực hiện: CTC-P02-001 đến 012, 014 đến 032, 044 đến 048.
- Trạng thái: Đã triển khai

### YCTD-44: Chia DT-03, giáo viên của lớp và phụ huynh trùng số điện thoại nhân sự – 2026-10-10

- Lý do: DT-03 lớn hơn một yêu cầu gộp; chưa có hồ sơ nhân sự (P07) nhưng lớp cần giáo viên; bảng `classes` có một cột giáo viên chủ nhiệm trong khi bảng phân công cho phép nhiều giáo viên; số điện thoại phụ huynh có thể đã thuộc tài khoản nhân sự; chưa có phân hệ thông báo.
- Nội dung thay đổi:
  - DT-03 chia ba phần: 3a lớp học; 3b hồ sơ trẻ đến khi duyệt và phân lớp; 3c nhập Excel và nhập mã ngành.
  - Giáo viên trong lớp tạm chọn theo tài khoản: chủ nhiệm là tài khoản có vai trò VT-07, bộ môn là VT-08, cùng đơn vị với lớp hoặc ở Trường chính; khi có P07 thì chuyển sang hồ sơ nhân sự. Nhân sự liên quan của cờ trẻ con nhân viên cũng chọn theo tài khoản.
  - Một lớp có một hoặc nhiều giáo viên chủ nhiệm cùng lúc; bỏ cột `classes.homeroom_teacher_id`, dùng bảng `class_staff_assignments`.
  - Số điện thoại phụ huynh đã thuộc tài khoản nhân sự thì hệ thống tự thêm vai trò VT-14 vào tài khoản đó và ghi nhật ký.
  - Thông báo trong ứng dụng và tin nhắn chỉ ghi vào hàng đợi; gửi thật làm ở phân hệ thông báo.
  - Mã quyền mới `P02.class.manage` cho VT-02 toàn trường, VT-15 và VT-03 trong đơn vị được gán.
  - Lớp và phân công không chuyển sang năm học mới vì lớp gắn với một năm học (BR-02).
- Thành phần bị ảnh hưởng: `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md`, `01`, `03`, `index.md`; mã nguồn DT-03.
- Dữ liệu bị ảnh hưởng: bảng `classes` không có `homeroom_teacher_id`; `class_staff_assignments` dùng `staff_user_id`, thêm `staff_name`.
- API bị ảnh hưởng: thêm `PATCH /classes/{id}/staff-assignments/{assignmentId}`; dịch vụ định danh thêm `GET /users/directory`.
- Giao diện bị ảnh hưởng: MH-03.
- Quyền bị ảnh hưởng: thêm `P02.class.manage`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P02-039 đến 043.
- Trạng thái: Đã triển khai phần 3a

### YCTD-43: Đăng nhập của phụ huynh – 2026-10-10

- Lý do: thiết kế DT-02 gặp các điểm chưa rõ: chưa có tài khoản nhà cung cấp tin nhắn (T1); P01-08 ghi mật khẩu mặc định của phụ huynh trong cấu hình theo đơn vị nhưng mật khẩu chỉ được nằm ở dịch vụ định danh; thông số mã một lần chưa có mặc định; điểm cuối `POST /auth/activate` trùng chức năng với đăng nhập và đổi mật khẩu. Khi kiểm thử giao diện phát hiện thêm: ba kênh dùng chung tên miền (Q-118) và chung một cookie mã làm mới, nên đăng nhập kênh này dùng hoặc đè phiên kênh kia.
- Nội dung thay đổi:
  - Mật khẩu mặc định của phụ huynh là một mật khẩu toàn trường, Hiệu trưởng đặt ở cấu hình chung của dịch vụ định danh, lưu dạng băm; bỏ khỏi cấu hình theo đơn vị P01-08. Tài khoản chưa kích hoạt dùng mật khẩu mặc định đang có, nên đổi mật khẩu mặc định thì phụ huynh chưa kích hoạt dùng mật khẩu mới.
  - Thông số mã một lần có mặc định 5 phút, nhập sai tối đa 5 lần, gửi tối đa 5 lần mỗi giờ cho một số điện thoại; Hiệu trưởng sửa được. Đếm số lần gửi theo số điện thoại cho mọi số để báo vượt giới hạn mà không lộ số có tồn tại hay không.
  - Tin nhắn gửi qua một lớp gửi riêng; khi phát triển ghi ra nhật ký máy chủ; môi trường chạy thật không khởi động khi chưa có nhà cung cấp; P19-06 chỉ nghiệm thu xong khi có T1.
  - Bỏ `POST /auth/activate`; kích hoạt là đăng nhập bằng mật khẩu mặc định rồi đổi mật khẩu.
  - Mã một lần chỉ dùng cho tài khoản có duy nhất vai trò VT-14.
  - Tạo tài khoản chỉ có vai trò VT-14 thì dùng mật khẩu mặc định, không sinh mật khẩu tạm; chưa đặt mật khẩu mặc định thì từ chối.
  - Mỗi kênh một cookie mã làm mới (`refresh_token`, `refresh_token_teacher`, `refresh_token_parent`); `refresh` nhận `channel`, mặc định `portal`; phiên khác kênh bị từ chối.
- Thành phần bị ảnh hưởng: `08`, `10`, `12`, `16`, `17`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `01`, `03`, `index.md`; mã nguồn DT-02.
- Dữ liệu bị ảnh hưởng: `users.password_hash` cho phép để trống; `sessions.login_method`; bảng `one_time_codes`; bốn khóa mới trong `identity_settings`.
- API bị ảnh hưởng: thêm `POST /auth/otp/request`, `POST /auth/otp/login`; bỏ `POST /auth/activate`; `GET`, `PUT /auth/settings` thêm thông số mã một lần và mật khẩu mặc định; `POST /users` trả thêm `uses_default_password`; `refresh` nhận `channel`.
- Giao diện bị ảnh hưởng: màn hình Cấu hình phần Tài khoản, màn hình Tài khoản; ứng dụng phụ huynh có MH-47, MH-48.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: cổng quản trị vẫn dùng cookie `refresh_token` và gọi `refresh` không kèm kênh như trước.
- Kiểm thử cần thực hiện: CTC-DD-010 đến 012, 014, 016 đến 023, 042.
- Trạng thái: Đã triển khai

### YCTD-42: Các danh mục của P01 – 2026-10-10

- Lý do: thiết kế DT-01 phần 6b gặp bốn điểm tài liệu chưa rõ: danh mục dùng chung chưa có loại và chưa có bảng; P01-03, P01-04 ghi VT-06 nhưng ma trận quyền ghi VT-06 không truy cập P01; chưa rõ cách hiệu lực của hạn mức phê duyệt; chưa rõ đơn vị của độ tuổi bậc học. Tài liệu 08 mục 5 còn thiếu phiếu đảo phiếu thu và phiếu đảo phiếu chi so với tài liệu 07 mục 12.1.
- Nội dung thay đổi:
  - Danh mục dùng chung có loại do hệ thống định nghĩa, ban đầu gồm quan hệ với trẻ, loại nghỉ phép, loại hợp đồng, nhóm tài sản; phân hệ nào cần loại mới thì thêm khi xây phân hệ đó; không tạo sẵn mục.
  - VT-06 tạo, sửa phòng ban và chức danh trong đơn vị được gán (`P01.department.manage`).
  - Hạn mức phê duyệt có hiệu lực ngay khi lưu; bản cũ chuyển sang hết hiệu lực; không kế thừa từ Trường chính.
  - Độ tuổi bậc học ghi theo tháng tuổi; mã bậc học không đổi được vì lớp và biểu phí tham chiếu theo mã.
  - Mã quyền mới `P01.department.manage` (VT-02, VT-06), `P01.catalog.manage` (VT-02), `P01.approval-threshold.manage` (VT-02), `P01.room.manage` (VT-02, VT-03).
  - Thêm MH-49 Phòng ban và chức danh, MH-50 Danh mục dùng chung.
  - Tài liệu 08 mục 5 bổ sung phiếu đảo phiếu thu và phiếu đảo phiếu chi cho khớp tài liệu 07.
- Thành phần bị ảnh hưởng: `01`, `08`, `10`, `14`, `16`, `17`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`; mã nguồn DT-01 phần 6b.
- Dữ liệu bị ảnh hưởng: bảng mới `catalog_items`; `grade_levels` dùng `age_from_months`, `age_to_months`; bốn mã quyền mới.
- API bị ảnh hưởng: thêm `PATCH` cho phòng ban, chức danh, phòng học, bậc học; thêm `GET /catalog-types`, `GET`, `POST /catalog-items`, `PATCH /catalog-items/{id}`.
- Giao diện bị ảnh hưởng: MH-33, MH-34, MH-49, MH-50.
- Quyền bị ảnh hưởng: VT-06 có quyền ở P01 cho phòng ban và chức danh; ghi chú 13 của tài liệu 08 sửa theo.
- Ảnh hưởng chức năng cũ: không, các danh mục chưa có mã nguồn.
- Kiểm thử cần thực hiện: CTC-P01-020 đến 022, 024 đến 026, 028, 029, 059, 067, 069, 072, 073, 075.
- Trạng thái: Đã triển khai

### YCTD-41: Ngày chốt học phí và ngày chốt công – 2026-10-09

- Lý do: Eric cho biết ngày chốt học phí là mùng 1 của tháng tiếp theo; trước đó tài liệu ghi chốt học phí và chốt công mặc định ngày cuối tháng (Q-25).
- Nội dung thay đổi: ngày chốt học phí mặc định mùng 1 tháng sau, đơn vị vẫn cấu hình được; ngày chốt công cố định mùng 1 tháng sau, bỏ khỏi cấu hình theo đơn vị.
- Thành phần bị ảnh hưởng: `01`, `09`, `10`, `QT-06`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`; mã nguồn danh mục cấu hình.
- Dữ liệu bị ảnh hưởng: mục cấu hình `attendance_closing_day` bỏ; `tuition_closing_day` có thêm giá trị `next_month_first` làm mặc định.
- API bị ảnh hưởng: `GET /settings` không còn mục ngày chốt công.
- Giao diện bị ảnh hưởng: màn hình Cấu hình.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: phần 6a chưa gộp nên chỉ sửa trên nhánh đang làm.
- Kiểm thử cần thực hiện: CTC-P01-044, 045.
- Trạng thái: Đã triển khai

### YCTD-40: Cấu hình theo đơn vị và tự khóa tài khoản – 2026-10-09

- Lý do: thiết kế DT-01 phần 6a cần giá trị mặc định, cách kế thừa, người sửa cấu hình và nơi cấu hình số ngày tự khóa; tài liệu chưa ghi.
- Nội dung thay đổi: chỉ ngày chốt học phí, ngày chốt công và mốc nhắc nợ có mặc định; các mục khác để trống, bắt buộc nhà trường cấu hình; đơn vị chưa cấu hình lấy giá trị của Trường chính rồi mặc định; thêm PQ-15 và quyền `P01.setting.manage` cho VT-02, VT-03; số ngày tự khóa (PQ-07) mặc định 90, Hiệu trưởng sửa trên cổng, lưu ở bảng mới `identity_settings`; mật khẩu mặc định của phụ huynh làm ở DT-02.
- Thành phần bị ảnh hưởng: `01`, `08`, `10`, `16`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng `settings` ở cơ sở dữ liệu năm học, `identity_settings` ở cơ sở dữ liệu định danh; mã quyền mới.
- API bị ảnh hưởng: `GET`, `PUT /api/v1/settings`; điểm cuối cấu hình của dịch vụ định danh.
- Giao diện bị ảnh hưởng: màn hình cấu hình trong MH-30; MH-31.
- Quyền bị ảnh hưởng: VT-15 chỉ xem cấu hình.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P01-044 đến 048, 051, 053, 054; CTC-DD-006.
- Trạng thái: Đã triển khai

### YCTD-39: Phân quyền quản lý tài khoản – 2026-10-09

- Lý do: thiết kế DT-01 phần 5 cần chốt ai tạo tài khoản, VT-03 được cấp vai trò nào, ai sửa ma trận quyền, cách đặt lại mật khẩu; tài liệu chỉ ghi VT-02, VT-03 cho P01-06 trong khi ma trận cho VT-15 quyền S ở P01.
- Nội dung thay đổi: thêm PQ-13, PQ-14; mã quyền `P01.account.manage-in-unit` cho VT-03; VT-01 và VT-02 sửa được ma trận quyền và tạo vai trò; mật khẩu tạm do hệ thống sinh; bảng `identity_audit_logs` trong cơ sở dữ liệu định danh; khóa, gán, gỡ vai trò, đặt lại mật khẩu thì thu hồi mọi phiên (BM-56).
- Thành phần bị ảnh hưởng: `01`, `08`, `16`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng mới `identity_audit_logs`; mã quyền mới.
- API bị ảnh hưởng: không thêm điểm cuối; các điểm cuối `users`, `roles` kiểm quyền theo PQ-13.
- Giao diện bị ảnh hưởng: MH-30.
- Quyền bị ảnh hưởng: VT-15 không quản lý tài khoản dù có `P01.edit`.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: CTC-P01-030 đến 035, 037 đến 042; CTC-DD-035, 039, 040.
- Trạng thái: Đã triển khai

### YCTD-38: Cây đơn vị hai cấp – 2026-10-09

- Lý do: Eric cho biết trường chỉ có hai cấp: Trường chính và các Phân hiệu, Điểm trường; trước đó QĐ-14 ghi cây không giới hạn cấp.
- Nội dung thay đổi: QĐ-23 thay QĐ-14: cấp 1 là Trường chính duy nhất; cấp 2 là Phân hiệu hoặc Điểm trường, chọn loại cho từng đơn vị, trực thuộc thẳng Trường chính; nhãn cố định; cả hai cấp có lớp. Phạm vi quyền theo đúng đơn vị được gán, gán ở Trường chính là toàn trường. Không ngừng sử dụng được đơn vị còn đơn vị con đang hoạt động. Thêm PQ-12 và quyền `P01.org-unit.manage` chỉ VT-02 có. Dữ liệu kiểm thử: ba Điểm trường trực thuộc TC; tài khoản phạm vi "nhóm A" gán ở PH-A, ĐT-A1, ĐT-A2. CTC-P01-006 không áp dụng.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `08`, `10`, `11`, `12`, `14`, `16`, `17`, `18`, `19`, `20`, `21`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `02_P02_VA_P04.md`, `04_P06.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: `org_units.unit_type` chỉ ba giá trị cố định; không cần đường dẫn phân cấp.
- API bị ảnh hưởng: `org-units` chặn tạo đơn vị dưới đơn vị cấp 2.
- Giao diện bị ảnh hưởng: MH-32 thành cây hai cấp, lọc theo loại.
- Quyền bị ảnh hưởng: gán ở một Phân hiệu không còn bao gồm Điểm trường; VT-15 và VT-03 không quản lý đơn vị dù có `P01.edit`.
- Ảnh hưởng chức năng cũ: chưa có mã cây đơn vị nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CTC-P01-001 đến 005, 007, 008, 012; 009 đến 011 khi có lớp và trẻ.
- Trạng thái: Đã triển khai

### YCTD-37: Mở năm học mới là đóng năm cũ – 2026-10-09

- Lý do: AC-194 và CB-10 ghi mở năm mới thì năm cũ chỉ đọc, trong khi BR-89 và CTC-P01-096 đến 098 ngụ ý năm cũ còn ghi được tới khi đóng riêng; nếu năm cũ vẫn ghi được thì thu nợ của trẻ đang học có thể ghi trùng ở hai năm.
- Nội dung thay đổi: thêm BR-93, mỗi thời điểm chỉ một năm học đang dùng; mở năm mới gồm kiểm tra BR-89, tạo cơ sở dữ liệu, chuyển dữ liệu, chuyển năm cũ sang đã đóng và chỉ đọc; bỏ điểm cuối đóng năm học riêng; BR-89 chuyển từ chặn đóng sang chặn mở; lịch năm học sửa được cho tới khi đóng, sửa ngày thì đánh số lại tuần và giữ cờ nghỉ; thêm PQ-11 và quyền `P01.academic-year.manage` chỉ VT-02 có.
- Thành phần bị ảnh hưởng: `01`, `07`, `08`, `10`, `11`, `16`, `17`, `21`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: `academic_years.status` có ba giá trị; thêm mã quyền mới trong cơ sở dữ liệu định danh.
- API bị ảnh hưởng: bỏ `POST /api/v1/academic-years/{id}/close`; `open` đóng năm đang dùng.
- Giao diện bị ảnh hưởng: MH-43 không có nút đóng năm học.
- Quyền bị ảnh hưởng: VT-15 và VT-03 không quản lý năm học dù có `P01.edit`.
- Ảnh hưởng chức năng cũ: chưa có mã năm học nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CTC-P01-013, 018, 019, 099 đến 104; 014 đến 017, 096 đến 098 khi có dữ liệu trẻ và công nợ.
- Trạng thái: Đã triển khai

### YCTD-36: Thiết kế DT-01 phần 2 – 2026-10-09

- Lý do: thiết kế phần 2 cần chốt nơi lưu mã làm mới trên trình duyệt, nơi đặt mã dùng chung của hai dịch vụ máy chủ, cách điều hướng của cổng quản trị đang mâu thuẫn trong `14`, và màn hình đăng nhập chưa có trong `14`.
- Nội dung thay đổi: mã làm mới gửi bằng cookie httpOnly cho cả ba kênh trình duyệt, không trả trong nội dung phản hồi (BM-71, RG-04); thêm gói `packages/server`; cổng quản trị điều hướng dọc bên trái theo BC-01, sửa sơ đồ mục 1 của `14`; thêm MH-47 Đăng nhập, MH-48 Đổi mật khẩu; kiểm thử giao diện bằng Playwright làm ngay từ phần 2.
- Thành phần bị ảnh hưởng: `01`, `13`, `14`, `17`, `22`, `index.md`; mã nguồn `apps/identity` đổi cách trả mã làm mới.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: `login`, `refresh`, `logout` dùng cookie `refresh_token` thay cho trường `refresh_token`.
- Giao diện bị ảnh hưởng: thêm MH-47, MH-48.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: kiểm thử phần 1 sửa theo cookie.
- Kiểm thử cần thực hiện: CTC-DD-031 đến 037, 041; kiểm thử giao diện luồng đăng nhập.
- Trạng thái: Đã triển khai

### YCTD-35: Quy tắc mật khẩu, tạm khóa, mã quyền và tài khoản đầu tiên – 2026-10-09

- Lý do: thiết kế DT-01 phần 1 cần các giá trị mà tài liệu chưa chốt.
- Nội dung thay đổi: mật khẩu tối thiểu 8 ký tự có chữ và số (BM-03); sai 5 lần tạm khóa 15 phút rồi tự mở (BM-04, XT-05); giới hạn 10 yêu cầu đăng nhập mỗi phút trên một địa chỉ mạng; mã quyền dạng phân hệ và hành động (PQ-09); VT-01 có thêm quyền `P01.account.manage`, tài khoản đầu tiên là VT-01 tạo bằng lệnh (PQ-10); thêm bảng `security_events` và cột `users.locked_until`; sửa kết quả mong đợi của CTC-DD-004.
- Thành phần bị ảnh hưởng: `01`, `08`, `12`, `16`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng mới `security_events`, cột mới `users.locked_until`.
- API bị ảnh hưởng: không thêm điểm cuối.
- Giao diện bị ảnh hưởng: thông báo tạm khóa ghi thời gian thử lại.
- Quyền bị ảnh hưởng: VT-01 có thêm `P01.account.manage`.
- Ảnh hưởng chức năng cũ: chưa có mã nghiệp vụ nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CTC-DD-001 đến 004, 009, 031 đến 034, 043.
- Trạng thái: Đã triển khai

### YCTD-34: Gộp phần lõi dịch vụ định danh vào DT-01 – 2026-10-09

- Lý do: điều kiện ra của DT-01 là đăng nhập được và phân quyền ba lớp chạy đúng, nhưng đăng nhập, tài khoản, vai trò, quyền thuộc dịch vụ định danh ở DT-02; ngoài ra `org_units` nằm trong cơ sở dữ liệu năm học nên phải có năm học trước cây đơn vị.
- Nội dung thay đổi: DT-01 làm theo sáu phần, mỗi phần một yêu cầu gộp: (1) phần lõi dịch vụ định danh; (2) máy chủ API kiểm tra phiên và quyền; (3) năm học; (4) cây đơn vị; (5) quản lý tài khoản, vai trò, quyền; (6) cấu hình, nhật ký thao tác và danh mục. DT-02 chỉ còn mã một lần và kích hoạt tài khoản phụ huynh. Chốt QĐ-20 hỏi dịch vụ định danh quyền hiện hành ở mọi yêu cầu, QĐ-21 cấp quyền tạo cơ sở dữ liệu cho tài khoản kết nối của máy chủ API, QĐ-22 ký mã phiên bằng Ed25519.
- Thành phần bị ảnh hưởng: `01`, `03`, `12`, `index.md`.
- Dữ liệu bị ảnh hưởng: không đổi cấu trúc; tài khoản `api_service` có thêm quyền tạo cơ sở dữ liệu.
- API bị ảnh hưởng: không thêm điểm cuối; máy chủ API dùng `GET /api/v1/auth/me` của dịch vụ định danh để lấy quyền hiện hành.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không đổi quy tắc; PQ-04 được bảo đảm bằng QĐ-20.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: ca CTC-DD và CTC-P01 tương ứng từng phần.
- Trạng thái: Đã triển khai

### YCTD-33: Thư viện truy cập dữ liệu và quy ước nhánh – 2026-10-09

- Lý do: chuẩn bị đợt DT-00; tài liệu chưa chọn thư viện truy cập dữ liệu và chưa có quy ước nhánh trên GitHub.
- Nội dung thay đổi: chọn Kysely cho truy cập dữ liệu và chạy tệp thay đổi cấu trúc (QĐ-18); nhánh `main` được bảo vệ, mỗi việc một nhánh, gộp qua yêu cầu gộp khi kiểm thử đạt và Eric duyệt (QĐ-19); cây thư mục ở `13` mục 4 thêm `database/system/` và sửa `packages/shared` chỉ chứa kiểu dữ liệu và hằng số cho khớp ranh giới ở mục 2.
- Thành phần bị ảnh hưởng: `01`, `12`, `13`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: kiểm thử mẫu của DT-00 chạy tệp thay đổi cấu trúc trên ba cơ sở dữ liệu.
- Trạng thái: Đã triển khai

### YCTD-32: Chỉ dùng GitHub trước, hạ tầng đám mây khi triển khai – 2026-10-09

- Lý do: Eric quyết định trước mắt chỉ dùng GitHub; hạ tầng đám mây cung cấp khi triển khai.
- Nội dung thay đổi: CG-08 và DT-00 chỉ cần kho mã nguồn riêng trên GitHub do Eric tạo và môi trường phát triển chạy Docker trên máy cục bộ (PostgreSQL, Redis qua Docker Compose); GitHub Actions chỉ chạy kiểm thử, chưa triển khai; môi trường thử nghiệm và chạy thật dựng khi có hạ tầng (T6). Việc M01-3 gộp nền móng DT-00 với ranh giới giao diện và máy chủ.
- Thành phần bị ảnh hưởng: `01`, `03`, `12`, `13`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng. Kiểm thử nghiệm thu trên môi trường thử nghiệm và cổng CG-11 vẫn cần T6 (RR-08).
- Kiểm thử cần thực hiện: dựng được môi trường phát triển trống, chạy được một kiểm thử mẫu trên máy và trên GitHub Actions.
- Trạng thái: Đã triển khai

### YCTD-31: Bỏ xác thực hai lớp – 2026-10-09

- Lý do: Eric quyết định hệ thống không cần xác thực hai lớp.
- Nội dung thay đổi: bỏ XT-07, BM-06; điểm cuối `/api/v1/auth/verify-otp` không dùng; mã một lần chỉ còn dùng cho phụ huynh đăng nhập (XT-09); việc N1 ghi đã bỏ; ca CTC-DD-025 đến CTC-DD-030 không áp dụng, thêm CTC-DD-043; ghi rủi ro RR-15.
- Thành phần bị ảnh hưởng: `01`, `03`, `12`, `13`, `16`, `17`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: `one_time_codes.purpose` chỉ còn giá trị đăng nhập.
- API bị ảnh hưởng: bỏ `/api/v1/auth/verify-otp`.
- Giao diện bị ảnh hưởng: không có bước nhập mã sau khi đăng nhập trên cổng quản trị.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CTC-DD-043.
- Trạng thái: Đã triển khai

### YCTD-30: Lịch năm học có học kỳ, kỳ hè và tuần học – 2026-10-09

- Lý do: Eric cho biết năm học không chạy theo năm dương lịch mà gồm hai học kỳ, bắt đầu khoảng 05/09 và kết thúc khoảng tháng 5 năm sau; cần cấu hình thời gian từng học kỳ và tuần học khi tạo năm học. Năm học trước đây chỉ có ngày bắt đầu và kết thúc.
- Nội dung thay đổi:
  - BR-91: Hiệu trưởng lập lịch năm học chung toàn trường gồm học kỳ 1, học kỳ 2, kỳ hè không bắt buộc, ngày học trong tuần; hệ thống tự đánh số tuần; đánh dấu tuần nghỉ.
  - BR-23: số ngày học của tháng tính theo lịch năm học, trừ tuần nghỉ và ngày lễ, cộng ngày học bù thứ bảy.
  - BR-92 và P05-13 Đăng ký học hè (G1): đăng ký theo từng tháng hè; chỉ trẻ đã đăng ký mới được điểm danh và tính học phí tháng hè.
  - BR-30: số phiếu không trùng trong đơn vị và năm học, đánh lại từ đầu mỗi năm học.
  - Sửa P01-02, AC-30, QT-02, QT-03, QT-04, QT-05; thêm G1-20, MH-45, MH-46, AC-228 đến AC-232, CT-184 đến CT-188 và 15 ca chi tiết.
- Thành phần bị ảnh hưởng: `01`, `05`, `07`, `10`, `11`, `14`, `16`, `17`, `21`, QT-02 đến QT-05, `27_BO_CA_KIEM_THU_CHI_TIET/`, `index.md`.
- Dữ liệu bị ảnh hưởng: `academic_years` chuyển sang cơ sở dữ liệu hệ thống, chung toàn trường, thêm `school_days_of_week`; thêm bảng `academic_terms`, `school_weeks`, `summer_registrations`; số bảng từ 159 lên 162.
- API bị ảnh hưởng: thêm `/api/v1/academic-years/{id}/calendar`, `/api/v1/academic-years/{id}/weeks`, `/api/v1/summer-registrations`.
- Giao diện bị ảnh hưởng: thêm MH-45 Lịch năm học, MH-46 Đăng ký học hè; MP-12 có đăng ký học hè.
- Quyền bị ảnh hưởng: chỉ Hiệu trưởng lập lịch năm học; kế toán và phụ huynh đăng ký học hè.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-184 đến CT-188, CTC-P01-099 đến CTC-P01-104, CTC-P04-044 đến CTC-P04-046, CTC-P05-063 đến CTC-P05-067, CTC-P06-066.
- Trạng thái: Đã triển khai

### YCTD-29: Lương trả trước đầu tháng, điều chỉnh theo công tháng trước – 2026-10-09

- Lý do: khi viết bộ ca kiểm thử P08 (N21), Q-153 về AC-40 làm rõ cách chi lương thực tế: lương chi từ đầu tháng, không đợi chốt công; ngày công bị trừ vào tháng tiếp theo. Eric trả lời thêm Q-154 đến Q-156 và duyệt bản đánh giá ảnh hưởng ngày 09/10/2026.
- Nội dung thay đổi:
  - BR-43 viết lại: lương tháng M trả trước đầu tháng M; điều chỉnh theo bảng công đã chốt tháng M−1 gồm trừ ngày không hưởng lương theo tỷ lệ ngày công (Q-154), cộng tiền làm thêm giờ, phụ cấp và khấu trừ theo ngày công; tháng M−1 chưa chốt công thì chặn tính lương tháng M; nhân sự mới không được trả trước tháng đầu (Q-155).
  - BR-82: tiền làm thêm giờ cộng vào bảng lương tháng kế tiếp.
  - BR-90: bảng quyết toán cuối cùng khi chấm dứt hợp đồng; trả thừa ghi khoản phải thu hồi, thu bằng phiếu thu không gắn trẻ (Q-156).
  - Q-153: vẫn chặn chốt công khi còn đơn nghỉ chờ duyệt; AC-40 sửa cho đơn bị từ chối hoặc đã hủy.
  - Sửa P07-02, P08-06, P08-12, AC-43, AC-197, CB-02, N-05, CT-049, DL-07, QT-06; thêm AC-224 đến AC-227, CT-180 đến CT-183.
- Thành phần bị ảnh hưởng: `01`, `07`, `09`, `10`, `11`, `12`, `16`, `17`, `20`, `21`, QT-06, `index.md`.
- Dữ liệu bị ảnh hưởng: `payroll_periods` thêm `payroll_type`, `adjustment_year`, `adjustment_month`, bỏ `attendance_locked_at`; `payslips` thêm `adjustment_amount`, `recovery_amount`; `receipts` thêm `staff_id`, `child_id` được để trống với phiếu thu thu hồi lương.
- API bị ảnh hưởng: `/api/v1/payrolls` tính bảng lương trả trước và trả lỗi khi tháng trước chưa chốt công; thêm `/api/v1/payrolls/settlements`.
- Giao diện bị ảnh hưởng: bảng lương hiển thị phần trả trước và phần điều chỉnh theo công tháng trước; màn hình lập bảng quyết toán.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-049, CT-180 đến CT-183 và bộ ca chi tiết P08.
- Trạng thái: Đã triển khai

### YCTD-28: Thủ quỹ phân bổ phiếu thu tiền mặt (Q-152) – 2026-10-09

- Lý do: viết bộ ca kiểm thử chi tiết đợt 4 (N21) phát hiện P06-01 cho thủ quỹ lập phiếu thu tiền mặt nhưng P06-02 chỉ cho kế toán phân bổ, trong khi BR-31 yêu cầu chọn hóa đơn khi lập phiếu. Eric chốt: thủ quỹ được chọn hóa đơn và phân bổ.
- Nội dung thay đổi: P06-02 thêm VT-16; QT-04 ghi thủ quỹ phân bổ; thêm AC-223, CT-179.
- Thành phần bị ảnh hưởng: `01`, `10`, `11`, `21`, QT-04, `27_BO_CA_KIEM_THU_CHI_TIET/`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: `/api/v1/receipts` nhận danh sách phân bổ từ VT-16 khi phương thức là tiền mặt.
- Giao diện bị ảnh hưởng: biểu mẫu phiếu thu của thủ quỹ có bước chọn hóa đơn.
- Quyền bị ảnh hưởng: VT-16 có quyền phân bổ phiếu thu tiền mặt; không lập, không sửa hóa đơn.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-179, CTC-P06-011, CTC-P06-012.
- Trạng thái: Đã triển khai

### YCTD-27: Trả lời Q-150, Q-151 khi viết bộ ca kiểm thử P05 – 2026-10-09

- Lý do: viết bộ ca kiểm thử chi tiết đợt 3 (N21) phát hiện hai điểm căn cứ chưa rõ về cách tính tiền. Eric trả lời ngày 09/10/2026.
- Nội dung thay đổi:
  - Q-150: đăng ký trễ phải ghi ngày bắt đầu học dịch vụ; thu theo ngày thực tế tính từ ngày đó, kể cả ngày đó, đến cuối tháng. Sửa BR-26, P05-03, AC-199.
  - Q-151: còn ngày chưa chốt điểm danh trong kỳ thì chặn tính học phí và liệt kê lớp, ngày chưa chốt. Sửa P05-05; thêm AC-222, CT-178, QT-03 E12.
- Thành phần bị ảnh hưởng: `01`, `07`, `10`, `11`, `16`, `21`, QT-03, `27_BO_CA_KIEM_THU_CHI_TIET/`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng `service_registrations` thêm cột `service_start_date`.
- API bị ảnh hưởng: không đổi đường dẫn; `/api/v1/service-registrations` nhận ngày bắt đầu học dịch vụ khi đăng ký trễ; `/api/v1/fee-calculations` trả `ERR_RULE_VIOLATION` khi còn ngày chưa chốt điểm danh.
- Giao diện bị ảnh hưởng: màn hình đăng ký dịch vụ của phụ huynh có ô ngày bắt đầu khi đăng ký trễ; màn hình chạy tính học phí hiển thị danh sách lớp, ngày chưa chốt.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-178, CTC-P05-013, CTC-P05-015, CTC-P05-031.
- Trạng thái: Đã triển khai

### YCTD-26: Trả lời Q-147 đến Q-149 khi viết bộ ca kiểm thử chi tiết – 2026-10-09

- Lý do: viết bộ ca kiểm thử chi tiết đợt 1 (N21) phát hiện ba điểm căn cứ chưa rõ. Eric trả lời ngày 09/10/2026.
- Nội dung thay đổi:
  - Q-147: phụ huynh chưa đổi mật khẩu mặc định vẫn đăng nhập bằng mã một lần và dùng bình thường; sửa BM-69, AC-203, P19-06, RR-14.
  - Q-148: người được đặt lại mật khẩu bắt buộc đổi ở lần đăng nhập kế tiếp; sửa BM-07, P01-06; thêm AC-220, CT-176.
  - Q-149: công nợ của trẻ đã thôi học không chuyển sang năm mới; chặn đóng năm học khi còn nợ loại này; thêm BR-89, AC-221, CT-177; sửa P01-02.
- Thành phần bị ảnh hưởng: `01`, `07`, `10`, `11`, `21`, `22`, `27_BO_CA_KIEM_THU_CHI_TIET/`, `index.md`.
- Dữ liệu bị ảnh hưởng: không đổi bảng.
- API bị ảnh hưởng: không đổi đường dẫn; `/api/v1/academic-years/{id}/close` trả `ERR_RULE_VIOLATION` kèm BR-89; `/api/v1/users/{id}/reset-password` đặt cờ bắt buộc đổi mật khẩu.
- Giao diện bị ảnh hưởng: màn hình năm học hiển thị danh sách trẻ còn nợ khi bị chặn đóng.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-176, CT-177, CTC-DD-042, CTC-P01-035, CTC-P01-096 đến CTC-P01-098.
- Trạng thái: Đã triển khai

### YCTD-25: Bổ sung nội dung gửi thuốc cho y tế và chăm sóc sức khỏe – 2026-10-09

- Lý do: Eric yêu cầu bổ sung nội dung cho chức năng gửi thuốc và chăm sóc sức khỏe, giữ ở giai đoạn 2.
- Nội dung thay đổi:
  - BR-86: cấu hình đơn vị "không có nhân viên y tế"; khi bật, giáo viên chủ nhiệm nhận thuốc, cho uống và ghi liều.
  - BR-48: bắt buộc ít nhất một ảnh thuốc; ảnh đơn thuốc không bắt buộc (giữ Q-60).
  - BR-87 và P10-12 Theo dõi chăm sóc hằng ngày (G2): nhiệt độ, tình trạng khi ốm, chăm sóc đặc biệt; phụ huynh xem trên ứng dụng.
  - BR-88: phụ huynh xác nhận đã biết sự kiện y tế và bỏ liều; chỉ hiển thị trạng thái, không nhắc lại.
  - Sửa BR-49, BR-50, P01-08, P10-03, P10-04, P10-07, G2-02; GD-32 không còn hiệu lực.
  - Thêm AC-215 đến AC-219, CT-171 đến CT-175.
- Thành phần bị ảnh hưởng: `01`, `05`, `07`, `08`, `10`, `11`, `14`, `16`, `17`, `20`, `21`, QT-07, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `daily_care_logs`; `medication_requests` thêm `medicine_photo_ids`, `prescription_photo_id`, `assigned_role`; `medication_administrations` và `medical_events` thêm `parent_acknowledged_at`, `parent_acknowledged_by`; số bảng từ 158 lên 159.
- API bị ảnh hưởng: thêm `/api/v1/medication-administrations/{id}/acknowledge`, `/api/v1/medical-events/{id}/acknowledge`, `/api/v1/children/{id}/daily-care-logs`.
- Giao diện bị ảnh hưởng: MG-09, MP-08.
- Quyền bị ảnh hưởng: ghi chú 17 của ma trận: quyền S của VT-07 ở P10.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-171 đến CT-175.
- Trạng thái: Đã triển khai

### YCTD-24: Ban Giám hiệu duyệt phiếu đảo phiếu chi – 2026-10-09

- Lý do: rà duyệt QT-05 phát hiện bảng trạng thái ghi Ban Giám hiệu duyệt phiếu đảo phiếu chi, nhưng bước 8, danh mục hạn mức và tài liệu 17 không có bước duyệt. Eric chốt: làm giống phiếu đảo phiếu thu (YCTD-23).
- Nội dung thay đổi: thêm phiếu đảo phiếu chi vào danh mục chứng từ áp dụng hạn mức; P06-04 thêm bước duyệt phiếu đảo; số dư chỉ hoàn lại khi đã duyệt; thêm AC-214, CT-170.
- Thành phần bị ảnh hưởng: `01`, `07`, `10`, `11`, `17`, `21`, QT-05, `index.md`.
- Dữ liệu bị ảnh hưởng: không đổi bảng; phiếu đảo là một dòng `payments` có `approved_by`, `approved_at`.
- API bị ảnh hưởng: thêm `/api/v1/payments/{id}/reverse/approve`, `/api/v1/payments/{id}/reverse/reject`.
- Giao diện bị ảnh hưởng: MH-10 hiển thị phiếu đảo chờ duyệt cho Ban Giám hiệu.
- Quyền bị ảnh hưởng: không; Ban Giám hiệu đã có quyền D ở P06.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-170.
- Trạng thái: Đã triển khai

### YCTD-23: Ban Giám hiệu duyệt phiếu đảo phiếu thu và quyết định xử lý công nợ quá hạn – 2026-10-09

- Lý do: rà duyệt QT-04 phát hiện QT-04 ghi Ban Giám hiệu duyệt phiếu đảo và xử lý công nợ, nhưng danh mục hạn mức, P06-03 và tài liệu 17 không có bước duyệt; bước xử lý công nợ không có chức năng, bảng và điểm cuối. Eric chốt: phiếu đảo phiếu thu do Ban Giám hiệu duyệt theo hạn mức; xử lý công nợ quá hạn do Ban Giám hiệu quyết, thêm chức năng ở giai đoạn 2.
- Nội dung thay đổi:
  - Thêm phiếu đảo phiếu thu vào danh mục chứng từ áp dụng hạn mức; P06-03 thêm bước duyệt; LP-05 cập nhật.
  - Thêm P05-12 Xử lý công nợ quá hạn (G2) và G2-17: quản lý đơn vị hoặc kế toán lập đề xuất, Phó Hiệu trưởng hoặc Hiệu trưởng ghi quyết định, không thay đổi số tiền công nợ.
  - Thêm AC-212, AC-213, CT-168, CT-169.
- Thành phần bị ảnh hưởng: `01`, `05`, `07`, `08`, `09`, `10`, `11`, `14`, `16`, `17`, `21`, QT-04, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `debt_resolutions`; bảng `receipts` thêm `approved_by`, `approved_at`; số bảng từ 157 lên 158.
- API bị ảnh hưởng: thêm `/api/v1/receipts/{id}/reverse/approve`, `/api/v1/receipts/{id}/reverse/reject`, `/api/v1/debt-resolutions`, `/api/v1/debt-resolutions/{id}/decide`.
- Giao diện bị ảnh hưởng: MH-08 thêm lập đề xuất và ghi quyết định; thêm VT-15, VT-02.
- Quyền bị ảnh hưởng: ma trận P05 của VT-03 thành X, S, ghi chú 16.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-168, CT-169.
- Trạng thái: Đã triển khai

### YCTD-22: Hóa đơn bổ sung, cơ sở dữ liệu hệ thống, bổ sung bảng khi rà duyệt tài liệu 16 – 2026-10-09

- Lý do: rà duyệt `16_CO_SO_DU_LIEU.md` phát hiện bảng không theo năm học nằm chung cơ sở dữ liệu năm học, ràng buộc mỗi tháng một hóa đơn chặn khoản phát sinh sau phát hành, và thiếu bảng cho phân công giáo viên, tổ chuyên môn, phiên đăng nhập, mã một lần.
- Nội dung thay đổi:
  - QĐ-17: khóa API đối tác ở cơ sở dữ liệu định danh; danh sách cơ sở dữ liệu năm học ở cơ sở dữ liệu hệ thống của máy chủ API; giữ nguyên mã định danh khi mở năm học.
  - BR-85: mỗi trẻ mỗi kỳ một hóa đơn chính; khoản phát sinh sau phát hành lập hóa đơn bổ sung cùng kỳ. Cập nhật P05-06, P14-11; thêm AC-210, CT-166.
  - Thêm bảng `sessions`, `one_time_codes`, `class_staff_assignments`, `teaching_groups`, `teaching_group_members`.
  - Thêm cột `children.related_staff_id`, `invoices.invoice_kind`, `payments.payment_type`, `payments.child_id`, `data_access_logs.api_client_id`, `scope`, `record_count`.
- Thành phần bị ảnh hưởng: `01`, `03`, `07`, `10`, `11`, `12`, `16`, `17`, `21`, `index.md`.
- Dữ liệu bị ảnh hưởng: như trên; số bảng từ 152 lên 157.
- API bị ảnh hưởng: thêm `/api/v1/invoices/supplementary`.
- Giao diện bị ảnh hưởng: MH-06 có thao tác lập hóa đơn bổ sung.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-166.
- Trạng thái: Đã triển khai

### YCTD-21: Màn hình cá nhân cho nhân sự dùng cổng quản trị; chỉnh sửa khi rà duyệt tài liệu 14 – 2026-10-09

- Lý do: rà duyệt `14_DAC_TA_GIAO_DIEN.md` phát hiện MG-10 đến MG-12 ghi cho vai trò không dùng ứng dụng giáo viên, còn nhân sự dùng cổng quản trị chưa có nơi xem phiếu lương và xin nghỉ. Eric chọn tự phục vụ ở cả hai kênh (Q-146).
- Nội dung thay đổi:
  - Thêm MH-44 Cá nhân trên cổng quản trị; MG-10 đến MG-12 dành cho mọi nhân sự dùng ứng dụng giáo viên.
  - Sửa vai trò màn hình theo YCTD-17 đến YCTD-19: MH-05, MH-07, MH-09, MH-10, MH-11, MH-13, MH-15, MH-28, MH-29, MH-30.
  - MH-19 có buffet theo dịp; MH-40 có nhập mã định danh ngành; MP-18 có đồng ý sử dụng hình ảnh; MH-32 theo QĐ-14.
  - Sửa BC-01, BC-08, XL-05; bỏ mục xe trong sơ đồ điều hướng.
- Thành phần bị ảnh hưởng: `01`, `14`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không thêm điểm cuối; MH-44 dùng các điểm cuối tự phục vụ sẵn có.
- Giao diện bị ảnh hưởng: thêm MH-44.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: bổ sung khi viết bộ ca kiểm thử chi tiết N21.
- Trạng thái: Đã triển khai

### YCTD-20: Bỏ bữa tối, ba bữa thuộc bán trú, buffet theo dịp; chỉnh sửa khi rà duyệt tài liệu 11 – 2026-10-09

- Lý do: rà duyệt `11_TIEU_CHI_NGHIEM_THU.md` phát hiện công thức suất ăn (BR-58, AC-58) trừ trẻ nghỉ hai lần. Eric cho biết trường không có bữa tối; suất ăn một ngày gồm ba bữa sáng, trưa, xế; số suất bằng số trẻ có mặt; vắng ngày nào không tính tiền ăn ngày đó; buffet là tiệc theo dịp không thu riêng. Câu trả lời này thay phần ăn tối của Q-06.
- Nội dung thay đổi:
  - Bỏ dịch vụ ăn tối và ăn sáng riêng; ba bữa thuộc bán trú (BR-83); BR-58 viết lại.
  - P17-15 Báo cáo ăn tối, AC-171, CT-127 ghi bỏ; P12-07 chỉ còn báo cơm; P12-06 đổi thành buffet theo dịp.
  - AC-21, CT-023, QT-03 đổi ví dụ dịch vụ thành bán trú, STEM, Anh văn; AC-58, CT-064 viết lại.
  - Sửa tài liệu 11: AC-26 ghi công thức cụ thể, AC-29 theo BR-26, AC-41 Ban Giám hiệu mở lại kỳ công, AC-43 có tiền làm thêm giờ, AC-89 và AC-180 bỏ kích hoạt tài khoản, AC-147 theo P01-06, AC-166 chỉ cho phí theo từng hoạt động.
  - Thêm AC-206 đến AC-209 và CT-162 đến CT-165 cho quyết định YCTD-17, YCTD-18, Q-112, BM-68.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `10`, `11`, `16`, `17`, `21`, `QT-02`, `QT-03`, `index.md`.
- Dữ liệu bị ảnh hưởng: gỡ `meal_registrations`; `buffet_registrations` thay bằng `buffet_events`; `meal_plans.meal_type` nhận sáng, trưa, xế.
- API bị ảnh hưởng: gỡ `/api/v1/meal-registrations`, `/api/v1/reports/dinners`; `/api/v1/buffet-registrations` thay bằng `/api/v1/buffet-events`.
- Giao diện bị ảnh hưởng: MG-14 chỉ còn suất ăn và báo cơm theo điểm danh.
- Quyền bị ảnh hưởng: phụ huynh không còn đăng ký hoặc hủy bữa.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-023, CT-064, CT-162 đến CT-165.
- Trạng thái: Đã triển khai

### YCTD-19: Phiếu chi và quỹ tiền mặt chuyển sang giai đoạn 1; chỉnh sửa khi rà duyệt tài liệu 10 – 2026-10-09

- Lý do: rà duyệt `10_YEU_CAU_CHUC_NANG.md` phát hiện giai đoạn 1 có thôi học kèm hoàn tiền (BR-24), thu tiền mặt và phiếu chi lương (QT-06) nhưng phiếu chi và quỹ tiền mặt nằm ở giai đoạn 2. Eric chọn đưa vào giai đoạn 1.
- Nội dung thay đổi:
  - P06-04 Phiếu chi và P06-05 Quỹ tiền mặt chuyển sang G1; thêm G1-19; G2-09 chỉ còn tài khoản ngân hàng và công nợ phải trả; đợt DT-05 và module M06 gồm phiếu chi và quỹ tiền mặt.
  - Sửa chức năng cho khớp quyết định đã chốt: P05-07 và P05-08 do Ban Giám hiệu phê duyệt theo hạn mức (bỏ quản lý đơn vị khỏi P05-07); P08-06 phê duyệt bảng lương theo hạn mức; P08-04 mở lại kỳ công do Ban Giám hiệu duyệt; P08-03 quản lý trực tiếp duyệt nghỉ phép; P02-08 hoàn tiền theo BR-24; P06-01, P06-04, P06-05 thêm thủ quỹ.
  - Bổ sung chi tiết đã chốt: công tắc cấu hình BR-34, BR-62, BR-73 trong P01-08; tạo tài khoản phụ huynh trong P02-03; lưu tạm điểm danh và ngày học bù trong P04-01; cờ dịch vụ bắt buộc trong P05-02; chặn đăng ký khi nợ trong P05-03; P19-06 bỏ mã kích hoạt, bắt buộc đổi mật khẩu mặc định.
  - Sửa dẫn chiếu sai ở P06-04, P18-01, P18-03; thêm vai trò còn thiếu ở P08-08, P17-01, P19-01.
- Thành phần bị ảnh hưởng: `01`, `03`, `05`, `10`, `index.md`.
- Dữ liệu bị ảnh hưởng: bảng `payments` và sổ quỹ tiền mặt cần có từ giai đoạn 1.
- API bị ảnh hưởng: các điểm cuối `/api/v1/payments` và sổ quỹ chuyển sang giai đoạn 1.
- Giao diện bị ảnh hưởng: MH-10 Phiếu chi và phê duyệt cần có từ giai đoạn 1.
- Quyền bị ảnh hưởng: quản lý đơn vị không còn tham gia miễn giảm.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng; khối lượng giai đoạn 1 tăng.
- Kiểm thử cần thực hiện: CT-038 đến CT-042, CT-097 đến CT-100 chạy ở giai đoạn 1.
- Trạng thái: Đã triển khai

### YCTD-18: Bổ sung quyền còn thiếu khi rà duyệt tài liệu 08 – 2026-10-09

- Lý do: rà duyệt `08_VAI_TRO_NGUOI_DUNG.md` phát hiện ma trận quyền thiếu quyền đã được quyết định ở nơi khác; Eric trả lời phạm vi của kiểm toán viên (Q-145).
- Nội dung thay đổi:
  - VT-20 luôn ở phạm vi toàn trường; VT-19 ghi rõ phạm vi toàn trường trong PQ-03; BR-01 sửa theo.
  - Ma trận: VT-03 có quyền D ở P02 (duyệt hồ sơ trẻ) và P08 (duyệt đơn nghỉ phép); VT-19, VT-20 có quyền X ở P19 để đăng nhập cổng quản trị.
  - Ghi chú mới: Ban Giám hiệu lập lịch nghỉ thứ 7 trong P08; kế toán và nhân sự dùng P01-13 cho dữ liệu của mình.
  - Bảng phân cấp phê duyệt ghi ngoại lệ phiếu chi hoàn tiền khi trẻ thôi học.
- Thành phần bị ảnh hưởng: `01`, `07`, `08`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: kiểm tra quyền của các điểm cuối duyệt hồ sơ trẻ, duyệt đơn nghỉ phép, nhập dữ liệu ban đầu, lịch nghỉ thứ 7 theo ma trận mới.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: như trên.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: bổ sung khi viết bộ ca kiểm thử chi tiết N21.
- Trạng thái: Đã triển khai

### YCTD-17: Quyền xem sức khỏe, quyền hoàn tiền và các chỉnh sửa khi rà duyệt tài liệu 07 – 2026-10-09

- Lý do: rà duyệt `07_QUY_TAC_NGHIEP_VU.md` phát hiện BR-53 mâu thuẫn ma trận quyền, BR-24 mâu thuẫn Q-134 và một số quy tắc chưa theo quyết định đã chốt.
- Nội dung thay đổi:
  - BR-53: thêm Ban Giám hiệu vào nhóm được xem dữ liệu sức khỏe; ma trận quyền P10 bỏ quyền xem của kế toán trưởng, nhân sự, giáo viên bộ môn.
  - BR-24: bù trừ hoặc hoàn tiền khi trẻ thôi học do Hiệu trưởng quyết định; phiếu chi hoàn tiền luôn do Hiệu trưởng phê duyệt, không xét hạn mức; BR-77 ghi ngoại lệ này và quy tắc Q-112.
  - BR-01: Quản trị nền tảng không xem dữ liệu nghiệp vụ. BR-03: bỏ cụm cấp thấp nhất. BR-20: loại giảm trừ do nhà trường cấu hình. BR-46: thêm kế toán trưởng, Ban Giám hiệu, kiểm toán viên. BR-73: API đối tác và xem đầy đủ số định danh luôn ghi nhật ký.
  - Đơn nghỉ phép thêm trạng thái Từ chối.
- Thành phần bị ảnh hưởng: `07`, `08`, `QT-03`, `QT-06`, `QT-07`, `index.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: điểm cuối phân hệ Y tế từ chối kế toán trưởng, nhân sự, giáo viên bộ môn; điểm cuối phê duyệt phiếu chi hoàn tiền chỉ nhận Hiệu trưởng.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: như trên.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: bổ sung khi viết bộ ca kiểm thử chi tiết N21.
- Trạng thái: Đã triển khai

### YCTD-16: Bỏ dịch vụ học thứ bảy, lịch học bù chung toàn trường – 2026-10-09

- Lý do: khi rà duyệt `06_YEU_CAU_NGHIEP_VU.md`, Eric xác nhận thứ bảy là lịch học bù chung toàn trường do Ban Giám hiệu lập trên hệ thống, không phải dịch vụ từng trẻ đăng ký.
- Nội dung thay đổi:
  - Bỏ dịch vụ học thứ bảy thu phí theo trẻ: BR-27 và QTN-05 ghi bỏ; BR-19, QT-03, NV-06 gỡ khoản tiền học thứ bảy.
  - Thêm BR-84: Ban Giám hiệu lập lịch nghỉ thứ bảy định kỳ và lịch học bù chung toàn trường; ngày học bù là ngày học bình thường của mọi lớp, tính vào số ngày học của tháng, không thu phí riêng; với nhân sự là ngày làm việc.
  - P08-10 chuyển người thực hiện sang Ban Giám hiệu (VT-02, VT-15); GD-86 ghi thay thế.
  - P17-14 Báo cáo học thứ 7 đổi nội dung thành số trẻ đi học và vắng của từng ngày học bù.
  - AC-21, CT-023 thay học thứ bảy bằng ăn tối; sửa AC-158, AC-170, CT-126; thêm AC-204, AC-205, CT-160, CT-161.
- Thành phần bị ảnh hưởng: `01`, `06`, `07`, `10`, `11`, `14`, `16`, `17`, `21`, `QT-03`, `index.md`.
- Dữ liệu bị ảnh hưởng: `saturday_schedules.org_unit_id` luôn là đơn vị gốc; danh mục dịch vụ không còn dịch vụ học thứ bảy.
- API bị ảnh hưởng: `/api/v1/saturday-schedules` chỉ Ban Giám hiệu được tạo và sửa; đổi mô tả `/api/v1/reports/saturday-classes`.
- Giao diện bị ảnh hưởng: MH-37 phần lịch nghỉ thứ 7 do Ban Giám hiệu thao tác.
- Quyền bị ảnh hưởng: nhân sự và quản lý đơn vị không còn lập lịch nghỉ thứ bảy.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng.
- Kiểm thử cần thực hiện: CT-023, CT-114, CT-126, CT-129, CT-160, CT-161.
- Trạng thái: Đã triển khai

### YCTD-15: Xác nhận giả định và áp dụng câu trả lời lượt 17 đến lượt 21 – 2026-10-09

- Lý do: Eric xác nhận các giả định qua năm lượt tích chọn và trả lời các điểm cần làm rõ.
- Nội dung thay đổi:
  - 57 giả định được Eric xác nhận trực tiếp; 19 giả định đánh dấu đã xác nhận theo quyết định đã chốt trước đó (dẫn quyết định gốc trong dòng); GD-16 sửa thành nhân sự chốt công, kế toán chốt học phí và tính lương; 8 giả định ghi không còn hiệu lực (GD-11, GD-15, GD-20, GD-21, GD-34, GD-35, GD-64, GD-88).
  - Bán trú bắt buộc với mọi trẻ (BR-83); sau ngày chốt chỉ đăng ký thêm dịch vụ không bắt buộc như STEM, Anh văn, 7 môn phối hợp, phải được Ban Giám hiệu duyệt và Ban Giám hiệu chọn thu cả tháng hay theo ngày thực tế (BR-26); QT-03 lên 1.3.
  - Trẻ nhận diện bằng số định danh cá nhân bắt buộc và mã định danh ngành không bắt buộc, tô đỏ khi trống (BR-07); số định danh và giấy khai sinh bắt buộc khi tạo hồ sơ (BR-81); thêm P02-12 nhập mã ngành từ tệp ở giai đoạn 1, kết nối tự động để giai đoạn 3 (G3-09, Q-144, T8).
  - Tạo tài khoản cho mọi phụ huynh có số điện thoại với mật khẩu mặc định chung, bắt buộc đổi lần đầu (PQ-06, XT-03, BM-69); thêm rủi ro RR-14; QT-01 lên 1.2.
  - Không chia mốc trong ngày; nhân sự chỉ chấm công vào và ra.
- Thành phần bị ảnh hưởng: `01`, `03`, `05`, `07`, `08`, `09`, `10`, `11`, `12`, `16`, `17`, `21`, `22`, `QT-01`, `QT-03`, `index.md` và dòng giả định trong mọi tài liệu.
- Dữ liệu bị ảnh hưởng: `children.code` thay bằng `moet_student_code` và `national_id_hash`; `services.is_mandatory`; `service_registrations` thêm cột đăng ký trễ.
- API bị ảnh hưởng: thêm `/api/v1/service-registrations/{id}/approve-late`, `/api/v1/imports/moet-codes`; đổi mô tả `/api/v1/auth/activate`.
- Giao diện bị ảnh hưởng: danh sách và hồ sơ trẻ tô đỏ ô mã ngành trống; màn hình đăng nhập lần đầu chỉ cho đổi mật khẩu.
- Quyền bị ảnh hưởng: Ban Giám hiệu duyệt đăng ký trễ.
- Ảnh hưởng chức năng cũ: hệ thống không còn tự sinh mã trẻ.
- Kiểm thử cần thực hiện: CT-009, CT-154 đến CT-159.
- Trạng thái: Đã triển khai

### YCTD-14: Áp dụng câu trả lời lượt 9 đến lượt 16 – 2026-10-09

- Lý do: Eric trả lời toàn bộ 76 câu hỏi mở còn lại và câu mới Q-143. Phần lớn chấp nhận đề xuất; các quyết định có tác động lớn liệt kê dưới đây.
- Nội dung thay đổi:
  - Bỏ phân hệ P11 Xe đưa đón (Q-62): giữ mã kèm ghi chú đã bỏ ở P11-01 đến P11-07, P17-09, BR-54, BR-55, BR-57, AC-53 đến AC-57, CT-059 đến CT-063, CB-04, MG-13, MP-13, NV-15, QTP-09, QTN-07, LN-08, N-07, LP-09, LE-06, DL-09, G2-03, M11; QT-08 đánh dấu đã bỏ; QT-02 thay bước xác nhận lên xe bằng bảo vệ xác nhận người đón; gỡ tám bảng và mười điểm cuối.
  - Vai trò (Q-21, Q-110): bỏ VT-13; thêm VT-16 Thủ quỹ, VT-17 Tổ trưởng chuyên môn, VT-18 Bảo vệ, VT-19 Cán bộ quản lý cấp trên, VT-20 Kiểm toán viên; ma trận quyền thêm năm cột; P03-02 thêm bước tổ trưởng duyệt; thêm MG-16, MG-17; GD-92.
  - Cây đơn vị không giới hạn cấp (Q-124): QĐ-14 thay QĐ-09; viết lại BR-01, AC-136, AC-137, CT-092, AI-33, nguyên tắc 11 của câu lệnh hệ thống; GD-76 hết hiệu lực; cụm "ba cấp" trong tài liệu đổi thành "nhiều cấp", trừ các ghi chép lịch sử.
  - Mỗi năm học một cơ sở dữ liệu (Q-90): QĐ-15 điều chỉnh QĐ-02; P01-02 mở và đóng năm học kèm chuyển dữ liệu; bảng `academic_year_databases`; hai điểm cuối mở, đóng năm học; MH-43; AC-194, CT-150; rủi ro RR-13 mức cao; GD-90.
  - API chỉ đọc cho đối tác ngay giai đoạn 1 (Q-94, Q-143): QĐ-16; P01-14; bảng `api_clients`; sáu điểm cuối; MH-42; BM-65, BM-66; AC-195, AC-196, CT-151, CT-152.
  - Tiền làm thêm giờ tối đa 1 giờ mỗi ngày, không có phụ cấp dạy thay (Q-57): BR-82, P08-12, cột `attendance_logs.overtime_minutes`, AC-197, CT-153, GD-91.
  - Quy tắc AI chặt hơn (Q-97 đến Q-99): AI-40, nguyên tắc 16; sửa lỗi trong phạm vi đã duyệt cũng cần Eric xác nhận.
  - Các câu còn lại: BR-06 bắt buộc khai dị ứng; trường nhu cầu đặc biệt; BR-66 cho ẩn bình luận vi phạm; học phí không giảm khi nghỉ ốm; XT-02 thời hạn phiên; SL-04 khôi phục trong 4 giờ; XD-04 giữ hồ sơ trẻ 5 năm rồi ẩn danh; PCF-01 theo quy mô dưới 1 000 trẻ; bảng `approval_thresholds`; nhà cung cấp tin nhắn và xác nhận chuyển khoản cấu hình được; BM-67 tuân thủ bảo vệ dữ liệu cá nhân; BM-68 tài khoản kiểm toán có hạn; Hiệu trưởng chịu trách nhiệm dữ liệu cá nhân; việc N21 viết ca kiểm thử chi tiết.
- Thành phần bị ảnh hưởng: gần như toàn bộ bộ tài liệu và các quy trình QT-01, QT-02, QT-06, QT-07, QT-08, QT-09, QT-10.
- Dữ liệu bị ảnh hưởng: gỡ tám bảng xe đưa đón; thêm `approval_thresholds`, `api_clients`, `academic_year_databases`; thêm cột `users.valid_until`, `attendance_logs.overtime_minutes`, `children.special_needs_note`; `org_units.unit_type` thành nhãn.
- API bị ảnh hưởng: gỡ mười điểm cuối xe đưa đón; thêm tám điểm cuối năm học và đối tác.
- Giao diện bị ảnh hưởng: bỏ MG-13, MP-13; thêm MH-42, MH-43, MG-16, MG-17.
- Quyền bị ảnh hưởng: năm vai trò mới, bỏ VT-13; đối tác đọc dữ liệu qua khóa API.
- Ảnh hưởng chức năng cũ: chưa có mã nguồn nên không ảnh hưởng dữ liệu thật.
- Kiểm thử cần thực hiện: CT-092, CT-150 đến CT-153; bộ ca chi tiết ở việc N21.
- Trạng thái: Đã triển khai

### YCTD-13: Áp dụng câu trả lời lượt 8 – 2026-10-09

- Lý do: Eric trả lời: không cho ứng lương (Q-54), lương trả một lần mỗi tháng (Q-56); quỹ tiền mặt bắt buộc không âm, không tắt được (Q-19); phụ huynh đồng ý hình ảnh trên ứng dụng hoặc giấy ký tay (Q-20); lưu số định danh cá nhân và giấy khai sinh của trẻ, che với vai trò không cần (Q-35, Q-37).
- Nội dung thay đổi: bỏ chức năng P08-05 Ứng lương theo yêu cầu của Eric, giữ mã kèm ghi chú "Bỏ ngày 09/10/2026" ở P08-05, BR-42, AC-42, CT-048, QTP-06, LP-06; bỏ "đề nghị ứng lương" khỏi danh mục chứng từ áp dụng hạn mức; BR-43 và QT-06 không còn trừ tạm ứng, QT-06 lên 1.2 và đánh số lại luồng chính; BR-34 quỹ tiền mặt không âm bắt buộc; BR-65 viết lại; thêm BR-81 về số định danh của trẻ; P02-02, P02-09 cập nhật; QT-01 lên 1.1; thêm BM-64, AC-190 đến AC-193, CT-146 đến CT-149; thêm GD-88, GD-89.
- Thành phần bị ảnh hưởng: `01`, `03`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `14`, `16`, `17`, `20`, `21`, `22`, `QT-01`, `QT-04`, `QT-05`, `QT-06`, `QT-10`, `index.md`.
- Dữ liệu bị ảnh hưởng: gỡ bảng `advance_requests` và cột `payslips.advance_amount`; `children` thêm cột đồng ý hình ảnh, `national_id_encrypted`, `birth_certificate_file_id`; thêm bảng `photo_consent_histories`.
- API bị ảnh hưởng: gỡ `/api/v1/advance-requests` và `/api/v1/advance-requests/{id}/approve`; thêm `/api/v1/children/{id}/national-id`, `/api/v1/children/{id}/photo-consent`.
- Giao diện bị ảnh hưởng: MH-15 chỉ còn bảng lương; MP-18 có thêm đồng ý hoặc rút đồng ý hình ảnh; hồ sơ trẻ hiển thị số định danh đã che.
- Quyền bị ảnh hưởng: chỉ VT-02, VT-15, VT-03, VT-12 xem đầy đủ số định danh của trẻ.
- Ảnh hưởng chức năng cũ: bảng lương không còn khoản tạm ứng. Ảnh sơ đồ chức năng của giáo viên có mục "Ứng lương" nhưng Eric đã quyết định bỏ.
- Kiểm thử cần thực hiện: CT-037, CT-039, CT-049, CT-146 đến CT-149.
- Trạng thái: Đã triển khai

### YCTD-12: Áp dụng câu trả lời lượt 6 và lượt 7 – 2026-10-09

- Lý do: Eric trả lời: nhập dữ liệu cũ từ Excel theo mẫu (Q-02); Zalo để giai đoạn 3 (Q-05); mốc nhắc nợ cấu hình, mặc định 3, 7, 15 ngày (Q-11, Q-45); thanh toán trực tuyến ngay giai đoạn 1 (Q-48, Q-03) bằng chuyển khoản mã QR có xác nhận tự động (Q-81); luôn phải trả đủ (Q-47); quản lý đơn vị không xem bảng lương (Q-23); Eric, Hiệu trưởng và kế toán trưởng cùng nghiệm thu (Q-129, Q-32, Q-101).
- Nội dung thay đổi: thêm P01-13 Nhập dữ liệu ban đầu từ Excel và P06-11 Thanh toán trực tuyến bằng mã QR, cùng G1-15, G1-16; G3-05 thu hẹp thành đối soát sao kê và cổng khác; thêm G3-08 Zalo; BR-31 không nhận thanh toán một phần; bỏ trạng thái "thu một phần" của hóa đơn; sửa AC-32, CT-035; thêm AC-183 đến AC-189, CT-139 đến CT-145, BM-62, BM-63, MH-40, MH-41; QT-04 lên phiên bản 1.2 với bước thanh toán bằng mã QR; thêm người cùng nghiệm thu vào kế hoạch tổng thể.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `08`, `10`, `11`, `13`, `14`, `16`, `17`, `20`, `21`, `22`, `23`, `QT-04`, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `data_import_jobs`, `online_payment_transactions`.
- API bị ảnh hưởng: thêm tám điểm cuối cho nhập dữ liệu và thanh toán trực tuyến; điểm cuối nhận thông báo tiền vào không dùng mã phiên, xác thực bằng chữ ký.
- Giao diện bị ảnh hưởng: thêm MH-40, MH-41; MP-11 hiển thị mã QR cho hóa đơn còn phải nộp.
- Quyền bị ảnh hưởng: VT-03 không xem bảng lương.
- Ảnh hưởng chức năng cũ: phiếu thu không còn thu một phần; P01-08 có mốc nhắc nợ mặc định.
- Kiểm thử cần thực hiện: CT-035, CT-139 đến CT-145.
- Câu hỏi phát sinh: Q-142 (chọn nhà cung cấp tin nhắn và dịch vụ xác nhận chuyển khoản).
- Trạng thái: Đã triển khai

### YCTD-11: Áp dụng câu trả lời lượt 4 và lượt 5 – 2026-10-09

- Lý do: Eric trả lời: Git trên GitHub kèm tích hợp và triển khai tự động từ đợt DT-00 (Q-130); máy chủ đám mây trong nước (Q-74, Q-76); phụ huynh đăng nhập bằng cả mật khẩu và mã một lần (Q-24, Q-117); ứng dụng dạng web ở giai đoạn 1 (Q-04); điểm danh một lần mỗi ngày (Q-38); đi muộn hoặc về sớm vẫn tính đủ ngày ăn (Q-39); chốt công và học phí ngày cuối tháng (Q-25); chặn khi nợ quá hạn cấu hình theo đơn vị (Q-27, Q-46). Q-111 được đánh dấu đã trả lời theo Q-07.
- Nội dung thay đổi: điểm danh đổi từ hai buổi sáng, chiều sang một lần mỗi ngày (BR-12, P04-01, P04-02, QT-02 lên phiên bản 1.1, AC-14, AC-98, CT-015); GD-22 hết hiệu lực; thêm XT-09, BM-61 và hai điểm cuối đăng nhập bằng mã một lần; chốt QĐ-04, thêm QĐ-12, QĐ-13; P01-08 thêm ngày chốt công, mặc định ngày cuối tháng, và cờ chặn đăng ký dịch vụ khi nợ quá hạn; BR-33 bổ sung; thêm AC-180 đến AC-182, CT-136 đến CT-138; GD-40, GD-87 đã xác nhận.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, `13`, `16`, `17`, `21`, `22`, `23`, `QT-02`, `QT-04`, `QT-08`, `index.md`.
- Dữ liệu bị ảnh hưởng: bỏ cột `session` khỏi `attendance_records` và `absence_records`; ràng buộc duy nhất đổi sang trẻ và ngày.
- API bị ảnh hưởng: điểm cuối điểm danh không còn tham số buổi; thêm `/api/v1/auth/otp/request`, `/api/v1/auth/otp/login`.
- Giao diện bị ảnh hưởng: MG-02, MP-06 bỏ chọn buổi; màn hình đăng nhập của ứng dụng phụ huynh có thêm cách đăng nhập bằng mã một lần.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn. Đăng nhập bằng mã một lần cần nhà cung cấp tin nhắn (T1).
- Kiểm thử cần thực hiện: CT-015, CT-136 đến CT-138.
- Trạng thái: Đã triển khai

### YCTD-10: Áp dụng câu trả lời lượt 3 – 2026-10-09

- Lý do: Eric trả lời: sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp (Q-140); học phí chính khóa cấu hình được, mức có thể bằng không (Q-141, câu hỏi mới vì trẻ mầm non trường công lập có thể được miễn học phí từ năm học 2025–2026); mức miễn giảm do nhà trường tự cấu hình (Q-16, Q-10, Q-42); danh mục khấu trừ và số ngày phép năm do nhà trường tự cấu hình (Q-17, Q-18, Q-53, Q-55).
- Nội dung thay đổi: thêm P05-11 Danh mục loại miễn giảm (G1) và P08-11 Danh mục khấu trừ và quy định số ngày phép năm (G1), vì bảng lương và tính học phí ở giai đoạn 1 cần các danh mục này trong khi P08-07 thuộc giai đoạn 2; bổ sung BR-19 về học phí chính khóa bằng không; viết lại BR-41; thêm AC-176 đến AC-179, CT-132 đến CT-135; `M05`, `M08` hết bị chặn.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `10`, `11`, `16`, `17`, `21`, `QT-03`, `QT-06`, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `discount_types`, `leave_policies`; `discounts.discount_type` đổi thành `discounts.discount_type_id`.
- API bị ảnh hưởng: thêm `/api/v1/discount-types`, `/api/v1/leave-policies`.
- Giao diện bị ảnh hưởng: MH-07 có thêm danh mục loại miễn giảm; MH-15 có thêm danh mục khấu trừ và quy định phép năm.
- Quyền bị ảnh hưởng: không đổi ma trận theo phân hệ.
- Ảnh hưởng chức năng cũ: P05-07 chỉ chọn loại miễn giảm trong danh mục; P08-03 cấp phép năm theo quy định cấu hình.
- Kiểm thử cần thực hiện: CT-132 đến CT-135.
- Trạng thái: Đã triển khai

### YCTD-09: Áp dụng câu trả lời lượt 1 và lượt 2 – 2026-10-09

- Lý do: Eric trả lời tám câu hỏi ưu tiên: phương án lưu trữ A (Q-77); bộ công nghệ đề xuất (Q-79); học phí giữa tháng theo ngày học thực tế (Q-14, Q-41); có lập sổ kế toán kép (Q-01, Q-51); chưa có mức hạn mức, cấu hình sau (Q-112, Q-26); nhà trường tự tạo cây đơn vị trong Cấu hình, các đơn vị dùng chung biểu phí (Q-113, Q-122); tiền ăn thu theo ngày ăn thực tế (Q-15, Q-43); đồng ý cách xếp ba giai đoạn (Q-07). Q-22 được đánh dấu đã trả lời theo YCTD-02 và YCTD-04.
- Nội dung thay đổi: chốt QĐ-02 và thêm QĐ-11; viết lại BR-14, BR-17, BR-23; bỏ "giảm trừ do nghỉ có báo" khỏi BR-20; G3-06 được duyệt và bỏ mục 1 của phạm vi ngoài; biểu phí dùng chung toàn trường; sửa AC-22, CT-024, E8 của QT-03; QT-03 lên phiên bản 1.2; cập nhật kế hoạch tổng thể, rủi ro RR-02, RR-03, RR-05, RR-06, RR-07; `M00-2` đến `M00-5` hoàn thành; `M06` hết bị chặn.
- Thành phần bị ảnh hưởng: `01`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, `13`, `16`, `21`, `QT-02`, `QT-03`, `QT-05`, `index.md`.
- Dữ liệu bị ảnh hưởng: `fee_schedules.org_unit_id` luôn là Trường chính. Không thêm bảng.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: màn hình biểu phí (MH-04) không còn chọn đơn vị.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: tính học phí không còn khoản giảm trừ tiền ăn do nghỉ có báo; tiền ăn tính trực tiếp từ số ngày ăn thực tế.
- Kiểm thử cần thực hiện: CT-024, CT-027.
- Câu hỏi phát sinh: Q-140 (chế độ kế toán cho sổ kế toán kép); giả định GD-87 (định nghĩa ngày ăn thực tế).
- Trạng thái: Đã triển khai

### YCTD-08: Áp dụng câu trả lời Q-139 và xác nhận GD-86 – 2026-10-09

- Lý do: Eric trả lời phí ngoại khóa thu theo tháng không giảm trừ khi trẻ nghỉ buổi hoặc thôi tham gia giữa tháng, và xác nhận lịch nghỉ thứ 7 cùng lịch học bù áp dụng cho mọi nhân sự của đơn vị.
- Nội dung thay đổi: P14-11 ghi rõ không giảm trừ phí ngoại khóa theo tháng; GD-86 đánh dấu đã xác nhận; thêm AC-175, CT-131.
- Thành phần bị ảnh hưởng: `10_YEU_CAU_CHUC_NANG.md`, `11_TIEU_CHI_NGHIEM_THU.md`, `21_KICH_BAN_KIEM_THU.md`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: tính học phí kỳ (P05-05) không áp dụng giảm trừ do nghỉ có báo cho phí ngoại khóa thu theo tháng.
- Kiểm thử cần thực hiện: CT-131.
- Trạng thái: Đã triển khai

### YCTD-07: Bổ sung điểm cuối cho phân hệ Giảng dạy – 2026-10-09

- Lý do: `17_DAC_TA_API.md` không có điểm cuối nào cho phân hệ P03 Giảng dạy, trong khi `10_YEU_CAU_CHUC_NANG.md` có tám chức năng P03-01 đến P03-08. Chức năng P03-07 Lịch hoạt động lớp chưa có bảng dữ liệu. Eric yêu cầu bổ sung.
- Nội dung thay đổi: thêm mục 7 Giảng dạy với mười tám điểm cuối vào `17_DAC_TA_API.md`, đánh số lại các mục sau từ 8 đến 21; thêm bảng `class_activity_schedules` vào `16_CO_SO_DU_LIEU.md`.
- Thành phần bị ảnh hưởng: `17_DAC_TA_API.md`, `16_CO_SO_DU_LIEU.md`.
- Dữ liệu bị ảnh hưởng: thêm bảng `class_activity_schedules`.
- API bị ảnh hưởng: thêm mười tám điểm cuối, không đổi điểm cuối đã có.
- Giao diện bị ảnh hưởng: không; MG-05, MG-06, MP-04, MP-05 đã có.
- Quyền bị ảnh hưởng: không đổi; áp dụng ma trận P03 và phạm vi bản ghi của giáo viên và phụ huynh.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn.
- Kiểm thử cần thực hiện: khi xây dựng P03, thêm ca kiểm thử giáo viên không phụ trách lớp gọi điểm cuối giáo án và thời khóa biểu của lớp đó phải bị từ chối.
- Trạng thái: Đã triển khai

### YCTD-06: Áp dụng câu trả lời Q-136 đến Q-138 – 2026-10-09

- Lý do: Eric trả lời ba câu hỏi phát sinh từ YCTD-05: tiêu chuẩn sức khỏe theo Bộ Y tế; hoạt động ngoại khóa thu phí theo cả hai cách, theo từng hoạt động và theo tháng; nghỉ thứ bảy định kỳ, trừ lịch học bù.
- Nội dung thay đổi: P10-11 ghi nguồn tiêu chuẩn là Bộ Y tế. P14-10 và P14-11 cho mỗi hoạt động chọn cách thu phí; phí theo tháng đưa vào khoản phải thu mỗi kỳ khi đăng ký còn hiệu lực. P08-10 đổi từ lịch theo từng nhân sự sang lịch nghỉ thứ bảy định kỳ của đơn vị kèm danh sách ngày học bù là ngày làm việc. Sửa AC-158, CT-114; thêm AC-173, AC-174, CT-129, CT-130.
- Thành phần bị ảnh hưởng: `10_YEU_CAU_CHUC_NANG.md`, `11_TIEU_CHI_NGHIEM_THU.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md`.
- Dữ liệu bị ảnh hưởng: `saturday_schedules` đổi `staff_id` thành `org_unit_id`, `schedule_type` nhận nghỉ định kỳ hoặc học bù; `health_standards` đổi `source` thành `source_document`; `extracurricular_activities` thêm `fee_type`; `extracurricular_registrations` thêm `effective_from`, `effective_to`.
- API bị ảnh hưởng: không đổi đường dẫn; `/api/v1/saturday-schedules` làm việc theo đơn vị thay vì theo nhân sự.
- Giao diện bị ảnh hưởng: MH-36 có thêm lựa chọn cách thu phí; MH-37 nhập lịch theo đơn vị.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: tính học phí kỳ (P05-05) phải đọc thêm đăng ký ngoại khóa thu theo tháng. Chưa có mã nguồn nên không ảnh hưởng dữ liệu thật.
- Kiểm thử cần thực hiện: CT-114, CT-122, CT-129, CT-130.
- Câu hỏi phát sinh: Q-139 (giảm trừ phí ngoại khóa theo tháng); giả định GD-86 (lịch nghỉ thứ 7 áp dụng cho mọi nhân sự của đơn vị).
- Trạng thái: Đã triển khai

### YCTD-05: Bổ sung hai mươi chức năng theo tám ảnh sơ đồ chức năng – 2026-10-09

- Lý do: Eric gửi tám ảnh sơ đồ chức năng (trước đây bộ tài liệu chỉ ghi nhận bốn ảnh). Đối chiếu cho thấy mười hai nhóm mục chưa có trong danh sách chức năng; Eric chọn bổ sung cả mười hai nhóm. Ảnh cũng trả lời Q-06 và Q-29: "mật độ" là "mất đồ", "hình tổ màu" là "hình tô màu", "ăn tối" là dịch vụ bữa tối có đăng ký và thu phí.
- Nội dung thay đổi: thêm P01-11, P01-12, P02-11, P03-08, P06-10, P08-09, P08-10, P10-09 đến P10-11, P12-08, P12-09, P13-10, P14-10 đến P14-12, P16-05, P17-13 đến P17-15; thêm AC-149 đến AC-172, CT-105 đến CT-128; thêm G1-13, G1-14, G2-11 đến G2-16, G3-07 vào phạm vi; lưu tám ảnh vào `26_SO_DO_CHUC_NANG/`. Sửa số liệu ghi nhầm: số chức năng trước bổ sung là 141, không phải 106; số bảng dữ liệu là 134, không phải 92.
- Thành phần bị ảnh hưởng: `05_PHAM_VI.md`, `10_YEU_CAU_CHUC_NANG.md`, `11_TIEU_CHI_NGHIEM_THU.md`, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md`, `04_TONG_QUAN_DU_AN.md`, `06_YEU_CAU_NGHIEP_VU.md`, `01_KE_HOACH_TONG_THE.md`, `index.md`.
- Dữ liệu bị ảnh hưởng: thêm mười chín bảng `rooms`, `grade_levels`, `lost_items`, `lesson_domains`, `lesson_groups`, `cashflow_categories`, `holidays`, `saturday_schedules`, `medicine_purchase_orders`, `medicine_purchase_order_items`, `health_check_schedules`, `health_standards`, `market_purchases`, `market_purchase_items`, `extracurricular_activities`, `extracurricular_registrations`, `library_albums`, `content_comments`, `admission_posts`; thêm cột `classes.room_id`, `lessons.domain_id`, `lessons.lesson_group_id`, `receipts.category_id`, `payments.category_id`, `suppliers.supplier_type`.
- API bị ảnh hưởng: thêm hai mươi hai điểm cuối, xem `17_DAC_TA_API.md`.
- Giao diện bị ảnh hưởng: thêm MH-34 đến MH-39, MG-15, MP-19, MP-20.
- Quyền bị ảnh hưởng: không đổi ma trận theo phân hệ; quyền của từng chức năng theo cột "Người dùng" trong `10_YEU_CAU_CHUC_NANG.md`.
- Ảnh hưởng chức năng cũ: phiếu thu và phiếu chi bắt buộc chọn khoản mục (P06-10); lớp và biểu phí chọn bậc học từ danh mục (P01-12). Chưa có mã nguồn nên không ảnh hưởng dữ liệu thật.
- Kiểm thử cần thực hiện: CT-105 đến CT-128.
- Câu hỏi phát sinh: Q-136 (nguồn bảng tiêu chuẩn sức khỏe), Q-137 (cách thu phí hoạt động ngoại khóa), Q-138 (nghĩa của lịch nghỉ thứ 7).
- Trạng thái: Đã triển khai

### YCTD-04: Mở rộng phạm vi phê duyệt chỉ của Ban Giám hiệu – 2026-10-09

- Lý do: YCTD-02 để lại ba câu hỏi Q-133, Q-134, Q-135. Eric trả lời: chốt kỳ tài chính vẫn thuộc danh mục hạn mức và do Hiệu trưởng phê duyệt; quản lý đơn vị không phê duyệt chứng từ thuộc danh mục hạn mức; Ban Giám hiệu phê duyệt mở lại kỳ công.
- Nội dung thay đổi: kế toán trưởng chuyển từ "chốt kỳ" sang "đề nghị chốt kỳ"; Hiệu trưởng phê duyệt chốt kỳ. Quản lý đơn vị chỉ phê duyệt việc không có giá trị tiền như hồ sơ trẻ, đơn nghỉ phép, hoạt động của lớp, đổi tuyến xe. Mở lại kỳ công do Phó Hiệu trưởng hoặc Hiệu trưởng phê duyệt.
- Thành phần bị ảnh hưởng: `07_QUY_TAC_NGHIEP_VU.md` mục 12.1; `08_VAI_TRO_NGUOI_DUNG.md` VT-05, ghi chú 7 và 8, bảng phân cấp phê duyệt mục 5; `10_YEU_CAU_CHUC_NANG.md` P06-09; `QT-03`, `QT-05`, `QT-06`.
- Dữ liệu bị ảnh hưởng: bảng `fiscal_periods` thêm `close_requested_by`, `close_requested_at` trong `16_CO_SO_DU_LIEU.md`.
- API bị ảnh hưởng: thêm `POST /api/v1/fiscal-periods/{id}/request-close`; `POST /api/v1/fiscal-periods/{id}/close` chỉ dành cho Hiệu trưởng.
- Giao diện bị ảnh hưởng: màn hình chốt kỳ tài chính trong QT-05 có thêm bước đề nghị và bước phê duyệt.
- Quyền bị ảnh hưởng: VT-03 mất quyền phê duyệt miễn giảm, ứng lương, đề nghị mua hàng; VT-05 mất quyền tự chốt kỳ và mở lại kỳ công.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn.
- Kiểm thử cần thực hiện: `CT-041` phải kiểm tra kế toán trưởng không tự chốt được kỳ; thêm ca kiểm thử quản lý đơn vị gọi điểm cuối phê duyệt miễn giảm, ứng lương, đề nghị mua hàng phải bị từ chối khi xây dựng `P05-07`, `P08-05`, `P13-05`.
- Trạng thái: Đã triển khai

### YCTD-03: Đổi mã dự án từ SKG thành SM – 2026-10-09

- Lý do: SKG là chữ viết tắt của tên cũ Sun KinderGarten, không còn khớp tên School Management. Eric chốt đổi thành SM, trả lời `Q-132`.
- Nội dung thay đổi: dòng "Mã dự án" trong `04_TONG_QUAN_DU_AN.md` ghi SM; quy tắc sinh mã trẻ `GD-20` đổi thành dạng `SM-<mã đơn vị>-<số thứ tự>`.
- Thành phần bị ảnh hưởng: `04_TONG_QUAN_DU_AN.md`, `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md`.
- Dữ liệu bị ảnh hưởng: định dạng cột `children.code` khi sinh mã trẻ. Chưa có dữ liệu thật nên không phải chuyển đổi.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn.
- Kiểm thử cần thực hiện: khi xây dựng `P02-02`, ca `CT-009` phải kiểm tra mã trẻ có tiền tố SM.
- Trạng thái: Đã triển khai

### YCTD-02: Chỉ Ban Giám hiệu phê duyệt chứng từ theo hạn mức – 2026-10-09

- Lý do: tài liệu mâu thuẫn. `QT-05`, `AC-35`, `CT-038` ghi phiếu chi vượt hạn mức do kế toán trưởng duyệt; `BR-77` và mục 5 của `08_VAI_TRO_NGUOI_DUNG.md` ghi Phó Hiệu trưởng duyệt dưới hạn mức, Hiệu trưởng duyệt từ hạn mức trở lên. Eric chốt: chỉ Ban Giám hiệu duyệt, kế toán trưởng không nằm trong luồng phê duyệt và chỉ chốt kỳ tài chính.
- Nội dung thay đổi: bỏ kế toán trưởng khỏi luồng phê duyệt giảm trừ, phiếu đảo, phiếu chi và bảng lương; bỏ kế toán khỏi luồng phê duyệt ứng lương. Mọi phiếu chi đều phải trình duyệt, không còn trường hợp kế toán tự phát hành khi trong hạn mức. Hạn mức cấu hình theo đơn vị và loại chứng từ, không theo vai trò.
- Thành phần bị ảnh hưởng: `07_QUY_TAC_NGHIEP_VU.md` mục 12.1; `08_VAI_TRO_NGUOI_DUNG.md` mô tả VT-05, ma trận quyền, ghi chú 8; `11_TIEU_CHI_NGHIEM_THU.md` AC-35; `21_KICH_BAN_KIEM_THU.md` CT-038; `QT-03`, `QT-04`, `QT-05`, `QT-06` lên phiên bản 1.1.
- Dữ liệu bị ảnh hưởng: không đổi bảng. Cột `approved_by` của `payments`, `discounts`, `invoice_adjustments`, `payroll_periods` chỉ nhận tài khoản có vai trò VT-15 hoặc VT-02.
- API bị ảnh hưởng: không đổi đường dẫn. `/api/v1/payments/{id}/approve`, `/api/v1/payrolls/{period_id}/approve` và các điểm cuối phê duyệt khác phải từ chối vai trò VT-05.
- Giao diện bị ảnh hưởng: `MH-10` không hiển thị nút phê duyệt cho kế toán trưởng.
- Quyền bị ảnh hưởng: VT-05 mất quyền D ở P05, P06, P08, P13; nhận quyền như VT-04 và thêm quyền chốt kỳ tài chính.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn.
- Kiểm thử cần thực hiện: `CT-038`, `CT-097` đến `CT-100`; thêm ca kiểm thử kế toán trưởng gọi điểm cuối phê duyệt phiếu chi phải bị từ chối khi xây dựng `P06-04`.
- Câu hỏi phát sinh: `Q-133`, `Q-134`, `Q-135`, đã được trả lời và triển khai ở YCTD-04.
- Trạng thái: Đã triển khai

### YCTD-01: Chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow – 2026-10-09

- Lý do: Eric yêu cầu áp dụng quy trình Vibecoding_Flow. Quy trình quy định thư mục `tai_lieu/`, tên tệp in hoa không dấu, thứ tự đánh số và mẫu phần đầu tài liệu khác với bộ tài liệu cũ.
- Nội dung thay đổi: chuyển `tai-lieu-thiet-ke/` thành `tai_lieu/`; đổi tên và đánh số lại toàn bộ tài liệu theo bảng dưới; thêm `24_YEU_CAU_THAY_DOI.md`; đặt các đặc tả quy trình vào `25_QUY_TRINH_NGHIEP_VU/` và gộp mục lục con vào `index.md`; đổi phần đầu mỗi tài liệu sang mẫu "Số. Tên, Mô tả, Phiên bản, Ngày cập nhật, Trạng thái"; đổi trạng thái tài liệu sang Bản nháp, Chờ phê duyệt, Đã phê duyệt; đổi trạng thái công việc sang Chưa bắt đầu, Đang thực hiện, Cần sửa, Bị chặn, Hoàn thành; nhật ký dự án xếp ngày mới nhất ở trên cùng.
- Thành phần bị ảnh hưởng: toàn bộ bộ tài liệu. Mọi tham chiếu tên tệp đã được cập nhật, trừ các mục lịch sử trong `02_NHAT_KY_DU_AN.md` và `23_LICH_SU_PHIEN_BAN.md`, nơi tên cũ được giữ nguyên vì là ghi chép lịch sử.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không, chưa có mã nguồn. Ghi chú của công cụ khác trong `.workbuddy-ai/` vẫn trỏ đường dẫn cũ.
- Kiểm thử cần thực hiện: rà văn bản không còn tham chiếu tên tệp cũ ngoài mục lịch sử; bảng không thiếu dấu `|` kết thúc; khối mã cân bằng.
- Trạng thái: Đã triển khai

Bảng đối chiếu tên tệp cũ và mới:

| Tên cũ trong `tai-lieu-thiet-ke/` | Tên mới trong `tai_lieu/` |
|---|---|
| index.md | index.md |
| 21_Ke_hoach_tong_the_du_an.md | 01_KE_HOACH_TONG_THE.md |
| Nhat_ky_du_an.md | 02_NHAT_KY_DU_AN.md |
| Checklist_cong_viec.md | 03_DANH_SACH_CONG_VIEC.md |
| 01_Tong_quan_du_an.md | 04_TONG_QUAN_DU_AN.md |
| 02_Pham_vi.md | 05_PHAM_VI.md |
| 03_Yeu_cau_nghiep_vu.md | 06_YEU_CAU_NGHIEP_VU.md |
| 04_Quy_tac_nghiep_vu.md | 07_QUY_TAC_NGHIEP_VU.md |
| 05_Vai_tro_nguoi_dung.md | 08_VAI_TRO_NGUOI_DUNG.md |
| 06_Luong_nghiep_vu.md | 09_LUONG_NGHIEP_VU.md |
| 07_Yeu_cau_chuc_nang.md | 10_YEU_CAU_CHUC_NANG.md |
| 08_Tieu_chi_nghiem_thu.md | 11_TIEU_CHI_NGHIEM_THU.md |
| 09_Kien_truc_he_thong.md | 12_KIEN_TRUC_HE_THONG.md |
| 10_Cong_nghe_su_dung.md | 13_CONG_NGHE_SU_DUNG.md |
| 11_Dac_ta_giao_dien.md | 14_DAC_TA_GIAO_DIEN.md |
| 12_He_thong_thiet_ke.md | 15_HE_THONG_THIET_KE.md |
| 13_Luoc_do_co_so_du_lieu.md | 16_CO_SO_DU_LIEU.md |
| 14_Dac_ta_API.md | 17_DAC_TA_API.md |
| 15_Quy_tac_phat_trien_AI.md | 18_QUY_TAC_PHAT_TRIEN_AI.md |
| 16_Cau_lenh_he_thong_AI.md | 19_CHI_DAN_HE_THONG_AI.md |
| 17_Ke_hoach_kiem_thu.md | 20_KE_HOACH_KIEM_THU.md |
| 18_Ca_kiem_thu.md | 21_KICH_BAN_KIEM_THU.md |
| 19_Bao_mat.md | 22_BAO_MAT.md |
| 20_Lich_su_thay_doi.md | 23_LICH_SU_PHIEN_BAN.md |
| Không có | 24_YEU_CAU_THAY_DOI.md |
| Quy_trinh_nghiep_vu/index.md | Gộp vào index.md |
| Quy_trinh_nghiep_vu/Phieu_yeu_cau.md | 25_QUY_TRINH_NGHIEP_VU/PHIEU_YEU_CAU.md |
| Quy_trinh_nghiep_vu/QT-nn_Ten_quy_trinh.md | 25_QUY_TRINH_NGHIEP_VU/QT-nn_TEN_QUY_TRINH.md |
