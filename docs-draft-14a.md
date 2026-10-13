# Nháp tài liệu DT-14 phần 14a — Cân nặng, chiều cao, thống kê theo tiêu chí ngành, hồ sơ chưa nhập đủ (YCTD-102)

## YCTD

### YCTD-102: Cân nặng, chiều cao theo đợt cân đo, thống kê theo tiêu chí ngành, hồ sơ chưa nhập đủ – 2026-10-14

- Lý do: Eric yêu cầu ngày 2026-10-13, làm theo phân hệ mầm non của hệ thống quản lý trường học của Sở GD&ĐT TP.HCM (tài liệu khảo sát `31_KHAO_SAT_HE_THONG_SO.md` mục 3.4 và 3.5): mục 4.3.1 (nhập kết quả sức khỏe nuôi dưỡng), 4.3.2 (tổng hợp cân nặng, chiều cao), 5.1 (thống kê lớp học), 5.2 (thống kê nhân sự), 5.3 (thống kê học sinh), 5.8, 5.9 (thống kê hồ sơ chưa nhập đủ). Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi:
  - Đợt cân đo: nhân viên y tế (`P10.health.manage` trong phạm vi đơn vị) lập đợt cân đo của một đơn vị gồm tên (duy nhất trong đơn vị), ngày cân đo (không sau hôm nay), ghi chú. Đợt chưa có số đo thì xóa được; đã có số đo thì không xóa.
  - Nhập số đo (4.3.1): chọn đợt, chọn lớp; bảng liệt kê học sinh đang học trong lớp vào ngày cân đo (theo khoảng ngày xếp lớp), mỗi học sinh nhập cân nặng (kg, 1 đến 150, làm tròn 2 chữ số thập phân) và chiều cao (cm, 30 đến 200, làm tròn 1 chữ số), chấp nhận dấu phẩy thập phân. Nút "Tính và lưu" ghi số đo của cả lớp một lần rồi hiển thị kết quả; để trống cả hai số là xóa số đo của học sinh trong đợt. Học sinh sinh sau ngày cân đo hoặc thuộc đơn vị khác bị từ chối.
  - Số đo của đợt lưu trong bảng số đo sức khỏe sẵn có (`health_measurements`, thêm cột `growth_round_id`, mỗi học sinh một dòng trong một đợt), không lưu hai nơi; số đo này cũng hiện trong hồ sơ sức khỏe của trẻ. Mở năm học mới thì số đo chuyển sang năm mới không kèm đợt (đợt ở lại năm cũ).
  - Kết quả tính theo chuẩn tăng trưởng của Tổ chức Y tế Thế giới (WHO), không lưu, tính lại mỗi lần đọc: tháng tuổi tròn (số ngày tuổi chia 30,4375); BMI; chỉ số Z cân nặng theo tuổi, chiều cao theo tuổi, cân nặng theo chiều cao (dưới 24 tháng theo chiều dài nằm, từ 24 tháng theo chiều cao đứng) và BMI theo tuổi, bằng phương pháp LMS, nội suy tuyến tính giữa hai tháng tuổi hoặc hai mốc 0,1 cm; chỉ số theo cân nặng và BMI ngoài ±3SD tính lại theo cách WHO giới hạn đuôi phân phối. Bảng tham số: chuẩn WHO 2006 (0 đến 60 tháng) và tham chiếu WHO 2007 (61 đến 84 tháng), dữ liệu công khai của gói WHO anthro, anthroplus; trên 84 tháng không tính.
  - Kênh tăng trưởng (nhãn như màn hình của Sở): cân nặng theo tuổi dưới −2SD là "Suy dinh dưỡng thể nhẹ cân", trên +2SD là "Cân nặng cao hơn tuổi"; chiều cao theo tuổi dưới −2SD là "Suy dinh dưỡng thể thấp còi"; cân nặng theo chiều cao (dưới 61 tháng) dưới −2SD là "Suy dinh dưỡng thể gầy còm", trên +2SD là "Thừa cân", trên +3SD là "Béo phì"; từ 61 tháng dùng BMI theo tuổi: dưới −2SD gầy còm, trên +1SD thừa cân, trên +2SD béo phì (ngưỡng WHO 2007). Còn lại là "Bình thường"; học sinh "bình thường cả ba kênh" khi đủ ba kênh và không kênh nào bất thường.
  - Nhập số đo từ Excel: tải tệp mẫu của lớp có sẵn mã học sinh trên hệ thống, họ tên, ngày sinh, lớp, số đo đã nhập; tải lên tệp cho cả đợt (mọi lớp của đơn vị). So khớp theo mã học sinh, để trống mã thì theo họ tên (không phân biệt dấu, hoa thường) và ngày sinh. Kiểm tra cả tệp trước: có lỗi (không tìm thấy học sinh, trùng học sinh, số đo sai) thì báo lỗi từng dòng và không lưu dòng nào; dòng để trống cả hai số đo được bỏ qua, không xóa số đã nhập.
  - Biểu đồ tăng trưởng của học sinh: cân nặng theo tuổi và chiều cao theo tuổi, đường trung vị, ±2SD, ±3SD theo WHO, các lần đo gồm số đo sức khỏe, số đo của đợt cân đo và kết quả khám định kỳ (phụ huynh chỉ thấy kết quả khám đã công bố, BR-69).
  - Quyền xem số đo theo BR-53: vai trò văn phòng được xem sức khỏe trong đơn vị (VT-02, VT-15, VT-03, VT-04, VT-09), nhân viên y tế của đơn vị, người có quyền báo cáo cân đo trong phạm vi, giáo viên chủ nhiệm (chỉ lớp mình chủ nhiệm, chỉ xem); phụ huynh xem biểu đồ của con mình. Chỉ nhân viên y tế ghi số đo.
  - Tổng hợp cân nặng, chiều cao (4.3.2): chọn một đợt hoặc một tháng (mọi đợt trong tháng của các đơn vị trong phạm vi; một đơn vị có nhiều đợt trong tháng thì mỗi học sinh lấy số đo của đợt muộn nhất có số đo, sĩ số xét theo ngày của đợt muộn nhất), lọc đơn vị, giới tính, kênh. Bảng theo lớp, theo khối (kèm dòng tổng cộng), theo đơn vị: số học sinh, nữ, số được cân đo, tỷ lệ cân đo, số và tỷ lệ từng kênh, số nữ của kênh nhẹ cân, thấp còi, béo phì, số bình thường cả ba kênh. Tỷ lệ kênh tính trên số học sinh có chỉ số tương ứng, phần trăm làm tròn 1 chữ số. Danh sách học sinh theo kênh đang lọc.
  - Xuất Excel tổng hợp: ba bảng "Theo lớp", "Theo khối", "Danh sách học sinh"; mỗi lần xuất ghi một dòng nhật ký xuất (`export_logs`, mã báo cáo `growth`, có dữ liệu cá nhân) theo BR-74. Người xem được tổng hợp thì xuất được, không cần `P17.data.export` vì là nghiệp vụ y tế học đường.
  - Thống kê lớp học (5.1): lớp đang hoạt động trong phạm vi chia theo nhóm tuổi của bậc học (theo tháng tuổi bắt đầu của bậc học trong danh mục: dưới 12 tháng là nhà trẻ 3–12 tháng, dưới 24 là 13–24 tháng, dưới 36 là 25–36 tháng, dưới 48 là mẫu giáo 3–4 tuổi, dưới 60 là 4–5 tuổi, còn lại 5–6 tuổi): số lớp, tỷ lệ lớp, số học sinh đang học, nữ, tỷ lệ học sinh.
  - Thống kê học sinh (5.3): học sinh trạng thái đang học trong phạm vi; tổng, nữ; theo độ tuổi tính bằng tháng tuổi tròn tại hôm nay (3–12, 13–24, 25–36 tháng; 37–48 tháng là 3–4 tuổi, 49–60 là 4–5 tuổi, 61–72 là 5–6 tuổi; nhóm dưới 3 tháng và trên 6 tuổi chỉ hiện khi có học sinh); theo dân tộc; khuyết tật (loại khuyết tật của tệp CSDL ngành, chưa có thì học sinh có ghi chú nhu cầu đặc biệt tính là "Có nhu cầu đặc biệt, chưa ghi loại"); diện chính sách (đối tượng chính sách); biết bơi; bệnh về mắt. Mỗi nhóm có số lượng, nữ, tỷ lệ; giá trị trống gom vào "Chưa nhập".
  - Thống kê nhân sự (5.2): nhân sự đang làm việc trong phạm vi theo trình độ chuyên môn nghiệp vụ, vị trí việc làm (chưa có thì theo chức danh), hình thức hợp đồng (chưa có thì theo loại hợp đồng lao động đang hiệu lực: thử việc, xác định thời hạn, không xác định thời hạn), nhóm chức vụ.
  - Dữ liệu chưa có cột riêng trong hồ sơ (dân tộc, tôn giáo, khuyết tật, đối tượng chính sách, biết bơi, bệnh về mắt, địa chỉ theo nhóm, trình độ, vị trí việc làm, hình thức hợp đồng, nhóm chức vụ, ngày tuyển dụng, chuyên ngành, sổ bảo hiểm xã hội) lấy từ hồ sơ CSDL ngành đã nhập (`moet_profile`, YCTD-100).
  - Hồ sơ học sinh chưa nhập đủ (5.8): với học sinh đang học trong phạm vi, đếm số hồ sơ thiếu từng trường: họ tên, ngày sinh, giới tính, dân tộc, tôn giáo, số định danh cá nhân, địa chỉ thường trú (tỉnh và xã), quê quán (tỉnh và xã), nơi khai sinh, chỗ ở hiện nay (địa chỉ trong hồ sơ hoặc tỉnh của tệp ngành), số điện thoại liên hệ (của tệp ngành hoặc của người giám hộ), họ tên, nghề nghiệp, năm sinh, số CCCD của cha, mẹ, người giám hộ (thiếu khi không người giám hộ nào đã gắn có thông tin đó). Bấm số lượng để xem danh sách (họ tên, đơn vị, lớp), bấm họ tên để mở hồ sơ trẻ ngay trên trang.
  - Hồ sơ nhân sự chưa nhập đủ (5.9): với nhân sự đang làm việc, các trường: ngày sinh, giới tính, dân tộc, tôn giáo, quê quán, địa chỉ thường trú, số CCCD, email, điện thoại di động, số sổ BHXH, nhóm chức vụ, hình thức hợp đồng (thiếu khi không có hợp đồng đang hiệu lực và tệp ngành không ghi), ngày tuyển dụng, trình độ chuyên môn, chuyên ngành chính. Bấm số lượng để xem danh sách, bấm họ tên để mở hồ sơ nhân sự.
  - Sửa bảng tham số WHO chiều cao theo tuổi tại tháng 24: dùng giá trị chiều cao đứng của bảng 2–5 tuổi (nội suy theo ngày ở mốc này rơi giữa chiều dài nằm và chiều cao đứng).
- Thành phần bị ảnh hưởng: `05`, `07`, `08`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị.
- Dữ liệu bị ảnh hưởng: bảng mới `growth_rounds`, cột mới `health_measurements.growth_round_id` (tệp 0048 của năm học); ba quyền mới (tệp 0038 của định danh).
- API bị ảnh hưởng: nhóm điểm cuối `/growth-rounds`, `/children/{id}/growth`, `/reports/growth`, `/statistics`.
- Giao diện bị ảnh hưởng: bốn màn hình mới trên cổng quản trị; thanh điều hướng thêm "Nhập cân đo", "Tổng hợp cân đo" (nhóm Y TẾ), "Thống kê theo tiêu chí ngành", "Hồ sơ chưa nhập đủ" (nhóm BÁO CÁO).
- Quyền bị ảnh hưởng: PQ mới (xem mục Quyền).
- Ảnh hưởng chức năng cũ: chuyển năm học bỏ liên kết đợt của số đo chuyển sang; không đổi hành vi khác.
- Kiểm thử cần thực hiện: CT-14a-1 đến CT-14a-10; kiểm thử giao diện `tests/e2e/49-growth-statistics.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

| growth_rounds | Đợt cân đo cân nặng, chiều cao của đơn vị (YCTD-102) | org_unit_id, name (duy nhất trong đơn vị), measured_on, note, created_by |
| health_measurements (thêm cột) | Số đo thuộc đợt cân đo; mỗi học sinh một dòng trong một đợt (chỉ mục duy nhất `growth_round_id`, `child_id` khi có đợt) | growth_round_id |

## Điểm cuối

| GET | /api/v1/growth-rounds | Đợt cân đo của đơn vị (`org_unit_id` bắt buộc) kèm số số đo, `can_manage` |
| POST | /api/v1/growth-rounds | Lập đợt (`org_unit_id`, `name`, `measured_on`, `note`) |
| DELETE | /api/v1/growth-rounds/{id} | Xóa đợt chưa có số đo |
| GET | /api/v1/growth-rounds/{id}/measurements | Bảng nhập của một lớp (`class_id`): học sinh, số đo, tháng tuổi, BMI, chỉ số Z, kênh; `can_edit` |
| PUT | /api/v1/growth-rounds/{id}/measurements | Tính và lưu (`rows`: child_id, weight_kg, height_cm, note; 1 đến 500 dòng); trả `saved_count`, `removed_count` |
| GET | /api/v1/growth-rounds/{id}/template | Tệp mẫu Excel của lớp (`class_id`) |
| POST | /api/v1/growth-rounds/{id}/import | Nhập số đo từ Excel (biểu mẫu nhiều phần, `file`); trả số dòng đã lưu và lỗi từng dòng |
| GET | /api/v1/children/{id}/growth | Biểu đồ tăng trưởng: các lần đo kèm kết quả, đường chuẩn WHO |
| GET | /api/v1/reports/growth | Tổng hợp 4.3.2 (`round_id` hoặc `month`; lọc `org_unit_id`, `gender`, `channel`) |
| GET | /api/v1/reports/growth/export | Xuất Excel tổng hợp, ghi nhật ký xuất (tiêu đề `x-export-log-id`) |
| GET | /api/v1/statistics/classes | Thống kê lớp học 5.1 (lọc `org_unit_id`) |
| GET | /api/v1/statistics/children | Thống kê học sinh 5.3 |
| GET | /api/v1/statistics/staff | Thống kê nhân sự 5.2 |
| GET | /api/v1/statistics/missing-child-fields | Hồ sơ học sinh chưa nhập đủ 5.8; `field` để lấy danh sách |
| GET | /api/v1/statistics/missing-staff-fields | Hồ sơ nhân sự chưa nhập đủ 5.9; `field` để lấy danh sách |

Vi phạm quy tắc nghiệp vụ của phần này trả `ERR_RULE_VIOLATION` với mã `YCTD-102` (trùng tên đợt trong đơn vị, xóa đợt đã có số đo, học sinh không thuộc đơn vị của đợt).

## Màn hình

| MH mới | 4.3.1 Nhập kết quả sức khỏe nuôi dưỡng (nhóm Y TẾ, mục "Nhập cân đo", `/growth`): chọn đơn vị, đợt, lớp; lập đợt; bảng nhập cân nặng, chiều cao, tháng tuổi, BMI, kết quả cân nặng, chiều cao, cân nặng theo chiều cao, kênh tăng trưởng; "Tính và lưu"; tải tệp mẫu, nhập từ Excel; biểu đồ tăng trưởng | VT-09 nhập; VT-02, VT-15, VT-03, VT-04 và giáo viên chủ nhiệm xem |
| MH mới | 4.3.2 Tổng hợp cân nặng, chiều cao (nhóm Y TẾ, mục "Tổng hợp cân đo", `/growth-report`): lọc đơn vị, đợt hoặc tháng, giới tính, kênh; bảng theo khối, theo lớp, danh sách học sinh; xuất Excel | VT-02, VT-15, VT-03, VT-09 |
| MH mới | 5.1 Thống kê lớp học, 5.2 Thống kê nhân sự, 5.3 Thống kê học sinh (nhóm BÁO CÁO, mục "Thống kê theo tiêu chí ngành", `/statistics`): ba thẻ, tiêu đề trang theo thẻ đang chọn, lọc đơn vị | VT-02, VT-15, VT-03; VT-06 thẻ nhân sự |
| MH mới | 5.8 Thống kê hồ sơ học sinh chưa nhập đủ, 5.9 Thống kê hồ sơ nhân sự chưa nhập đủ (nhóm BÁO CÁO, mục "Hồ sơ chưa nhập đủ", `/missing-profiles`): số hồ sơ thiếu theo trường, bấm số để xem danh sách, bấm tên để mở hồ sơ | VT-02, VT-15, VT-03; VT-06 thẻ nhân sự |

Số MH do người điều phối đánh khi gộp tài liệu. Màn hình mới dùng chữ "học sinh" như hệ thống của Sở.

## Quyền

| PQ mới | Báo cáo cân đo (YCTD-102): `P17.report.growth` cho VT-02, VT-15, VT-03, VT-09 xem và xuất tổng hợp cân nặng, chiều cao trong phạm vi đơn vị. Ghi số đo, lập đợt, nhập Excel dùng quyền sẵn có `P10.health.manage` (VT-09) trong phạm vi đơn vị |
| PQ mới | Thống kê học sinh (YCTD-102): `P17.child-statistics.view` cho VT-02, VT-15, VT-03 xem thống kê lớp học, học sinh và hồ sơ học sinh chưa nhập đủ trong phạm vi đơn vị; mở hồ sơ trẻ vẫn theo phạm vi xem trẻ |
| PQ mới | Thống kê nhân sự (YCTD-102): `P17.staff-statistics.view` cho VT-02, VT-15, VT-03, VT-06 xem thống kê nhân sự và hồ sơ nhân sự chưa nhập đủ trong phạm vi đơn vị; mở hồ sơ nhân sự vẫn theo quyền xem nhân sự |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/health/growth-calc.test.ts` và `apps/api/src/health/growth-statistics.test.ts` ngày 14/10/2026:

- CT-14a-1: Tham số LMS của bảng WHO tại các mốc công bố (cân nặng bé trai 0 và 12 tháng, chiều cao bé gái 24 tháng, cân nặng theo chiều cao bé trai 100 cm), Z tại trung vị, tại ±2,5SD, ngoài +3SD, nội suy nửa tháng, ngoài 84 tháng: khớp bảng công bố; Z = 0, ±2,5; Z = 4 theo cách giới hạn đuôi; nội suy đúng; không tính — đạt.
- CT-14a-2: Xếp kênh tại các ngưỡng −2SD, +2SD, +3SD và BMI +1SD, +2SD; học sinh 36 tháng đúng trung vị; 24 tháng 9 kg 78 cm; 48 tháng 25 kg 103 cm; 66 tháng; chỉ có cân nặng; số đo dấu phẩy, ngoài khoảng, trống: đúng nhãn; bình thường cả ba kênh; nhẹ cân và thấp còi; cân nặng cao hơn tuổi và béo phì; dùng BMI theo tuổi; chỉ xếp kênh cân nặng; 12,35, lỗi, trống — đạt.
- CT-14a-3: Tổng hợp bốn học sinh hai khối, một chưa cân đo; lọc nữ; lọc kênh; nhóm tuổi học sinh và lớp tại các mốc; đếm theo dân tộc; hồ sơ thiếu với hai người giám hộ bổ sung cho nhau: số được cân đo 3 (75%), nhẹ cân 1 (nữ 1), bình thường 2; theo lớp, khối đúng; 2 học sinh nữ; đúng học sinh; đúng nhóm; 66,67% và 33,33%; thiếu tôn giáo, CCCD cha mẹ, đủ nghề nghiệp, năm sinh, điện thoại — đạt.
- CT-14a-4: Y tế lập đợt; lập trùng tên; ngày sau hôm nay; y tế đơn vị khác, giáo viên lập; xóa đợt chưa có số đo; giáo viên chủ nhiệm, kế toán xem danh sách đợt; phụ huynh xem: lập được; trả YCTD-102; lỗi dữ liệu; bị từ chối; xóa được; xem được; bị từ chối — đạt.
- CT-14a-5: Y tế nhập số đo hai học sinh (có dấu phẩy); giáo viên chủ nhiệm xem bảng lớp mình; giáo viên ghi; giáo viên xem lớp khác; ghi cho học sinh đơn vị khác; cân nặng 500; xóa đợt đã có số đo; để trống cả hai số; phụ huynh xem biểu đồ: lưu 2; 40 tháng tuổi, nhẹ cân, thấp còi, không sửa được; bị từ chối; bị từ chối; bị từ chối; lỗi dữ liệu; trả YCTD-102; xóa số đo 1 học sinh; 1 lần đo kèm đường chuẩn — đạt.
- CT-14a-6: Tải tệp mẫu lớp; nhập tệp có cân nặng sai; sửa lại, bỏ mã để so khớp theo họ tên và ngày sinh; giáo viên nhập: tệp có 2 học sinh; không lưu dòng nào, 1 lỗi; lưu 2 dòng; bị từ chối — đạt.
- CT-14a-7: Quản lý đơn vị xem tổng hợp một đợt; Hiệu trưởng xem theo tháng lọc nữ và kênh nhẹ cân; thiếu đợt và tháng; quản lý đơn vị khác, kế toán xem; xuất Excel: 3 học sinh, 2 được cân đo, nhẹ cân 1 (nữ 1), theo lớp, theo khối đúng; 2 học sinh nữ, danh sách 1 học sinh; lỗi dữ liệu; bị từ chối; tệp ba bảng, nhãn kênh tiếng Việt, nhật ký xuất mã `growth` 3 dòng có dữ liệu cá nhân — đạt.
- CT-14a-8: Thống kê lớp học toàn trường; thống kê học sinh của đơn vị; quản lý đơn vị khác, giáo viên, nhân sự (VT-06) xem thống kê học sinh: nhóm 25–36 tháng 1 lớp, 3–4 tuổi 2 học sinh, 5–6 tuổi 1 lớp, tổng 3 lớp; 3 học sinh (nữ 2), theo độ tuổi, dân tộc Kinh 2, Hoa 1, khuyết tật 1, chính sách 1, biết bơi 1, bệnh mắt 1; bị từ chối ba trường hợp — đạt.
- CT-14a-9: Nhân sự (VT-06) xem thống kê nhân sự đơn vị; Hiệu trưởng xem toàn trường; y tế xem: 3 người (nữ 2), trình độ Cao đẳng 1, Đại học 1, Chưa nhập 1, hợp đồng theo tệp ngành hoặc hợp đồng lao động; 4 người; bị từ chối — đạt.
- CT-14a-10: Hồ sơ học sinh chưa nhập đủ của đơn vị; danh sách thiếu tôn giáo; trường không có trong danh sách; hồ sơ nhân sự thiếu email; giáo viên xem: 3 học sinh, thiếu tôn giáo 2, thiếu thông tin người giám hộ 2, họ tên 0; 2 học sinh kèm lớp; lỗi dữ liệu; thiếu email 2 (danh sách đúng), hợp đồng 1, ngày sinh 1; bị từ chối — đạt.

Kiểm thử giao diện `tests/e2e/49-growth-statistics.spec.ts`: y tế lập đợt, nhập số đo, "Tính và lưu" ra kênh nhẹ cân và thấp còi, mở biểu đồ; quản lý đơn vị lọc tổng hợp theo kênh, xuất Excel, xem 5.1, 5.3, mở hồ sơ học sinh từ danh sách 5.8, chuyển thẻ 5.9 — đạt.

## Hạn chế

- Chưa có cột riêng cho dân tộc, tôn giáo, khuyết tật, đối tượng chính sách, biết bơi, bệnh về mắt của học sinh và trình độ, vị trí việc làm, hình thức hợp đồng, nhóm chức vụ của nhân sự: thống kê và kiểm tra hồ sơ thiếu đọc từ hồ sơ CSDL ngành đã nhập (YCTD-100); trường chưa nhập tệp ngành thì các mục này là "Chưa nhập" hoặc bị tính thiếu. Chưa có màn hình sửa các trường này ngoài nhập lại tệp ngành.
- Hồ sơ nhân sự chưa có tài khoản ngân hàng và mã số thuế nên 5.9 chưa kiểm tra hai trường này; 5.8 chưa kiểm tra "trạng thái" vì mọi hồ sơ đều có trạng thái.
- Thống kê nhân sự chưa có phần chuẩn nghề nghiệp (18 tiêu chí cán bộ quản lý, 15 tiêu chí giáo viên) của mục 5.2; phần này thuộc DT-14 phần 14c. Thống kê học sinh chưa có biểu đồ hoàn thành chương trình, con thương binh liệt sĩ, bệnh mắt theo học kỳ (tệp ngành chỉ có một giá trị), chưa có "tìm học sinh thiếu thông tin" ngoài 5.8.
- Nhóm tuổi của lớp xét theo tháng tuổi bắt đầu của bậc học, chưa xét lớp ghép nhiều độ tuổi; nhóm tuổi học sinh tính theo tháng tuổi tròn tại hôm nay, chưa theo năm sinh như một số biểu mẫu thống kê của ngành.
- Ngưỡng kênh tăng trưởng cố định trong mã theo chuẩn WHO (−2SD, +2SD, +3SD; BMI theo tuổi +1SD, +2SD từ 61 tháng), chưa cấu hình được; "cân nặng cao hơn tuổi" là kênh trên +2SD của cân nặng theo tuổi. Học sinh trên 84 tháng tuổi không tính chỉ số. Chưa đối chiếu nhãn "thể còi cọc" của màn hình Sở (dùng chung với thấp còi).
- Tháng tuổi tròn tính theo số ngày chia 30,4375 như WHO, có thể lệch một tháng so với cách đếm theo lịch ở màn hình khác (hồ sơ sức khỏe dùng cách đếm theo lịch cho tiêu chuẩn sức khỏe của trường).
- Chưa có thông báo cho phụ huynh khi có kết quả cân đo; chưa khóa đợt cân đo sau khi báo cáo.
- Tổng hợp theo tháng gom mọi đợt trong tháng; chưa có tổng hợp theo học kỳ hoặc so sánh hai đợt.
- Kiểm thử chạy với cơ sở dữ liệu định danh riêng (`school_identity_dt14a`) để không chạy tệp 0038 trên cơ sở dữ liệu định danh dùng chung khi tệp 0036, 0037 của nhánh khác chưa gộp (Kysely từ chối tệp thay đổi cấu trúc chạy không theo thứ tự).
