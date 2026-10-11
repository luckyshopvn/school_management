# Nháp tài liệu phần 10b: Thuốc (YCTD-75)

## YCTD

### YCTD-75: Thuốc: danh mục thuốc, dặn thuốc, cho uống thuốc, mua và cấp thuốc – 2026-10-11

- Lý do: phần 10b theo cách chia ở YCTD-73 (P10-02, P10-03, P10-04, P10-05, P10-09). Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền dùng như đã cấp trước ở tệp 0032 định danh: `P10.medicine.manage` (VT-09) quản lý danh mục thuốc, nhà thuốc, đề nghị mua, phiếu mua, phiếu cấp trong đơn vị được gán; `P10.medication.administer` (VT-09, VT-07) nhận thuốc, từ chối, ghi liều, bỏ liều; `P10.medicine-purchase.approve` (VT-02, VT-15) duyệt đề nghị mua thuốc. Không thêm quyền mới.
  - Yêu cầu dặn thuốc (P10-03, BR-48): phụ huynh của trẻ đang học gửi tên thuốc, liều lượng, giờ cho uống (một đến sáu giờ dạng HH:MM, không trùng), ngày bắt đầu (không trước hôm nay) và ngày kết thúc (tối đa 30 ngày), tình trạng dị ứng (bắt buộc, ghi "Không" nếu không dị ứng), ghi chú, một đến năm ảnh thuốc (bắt buộc) và một ảnh đơn thuốc (tùy chọn). Thiếu trường bắt buộc trả `ERR_VALIDATION`.
  - Ảnh thuốc (`medicine_photo`, chỉ JPEG hoặc PNG) và ảnh đơn thuốc (`prescription`, JPEG, PNG hoặc PDF) là hai mục đích tệp mới; phụ huynh có con đang học trong đơn vị mới tải lên được. Khi gửi yêu cầu, tệp phải đúng mục đích, do chính phụ huynh tải lên và thuộc đơn vị của trẻ. Tải tệp: tệp đã gắn yêu cầu xem theo quyền xem sức khỏe của trẻ (BR-53: phụ huynh của trẻ, giáo viên chủ nhiệm, y tế, Ban Giám hiệu, quản lý đơn vị, kế toán trong phạm vi); tệp chưa gắn yêu cầu chỉ người tải lên xem.
  - Người nhận yêu cầu (BR-86): đơn vị của trẻ tắt hoặc chưa đặt cấu hình `no_medical_staff` thì yêu cầu chuyển cho y tế (thông báo theo vai trò VT-09 của đơn vị), bật thì chuyển cho giáo viên chủ nhiệm đang được phân công lớp hiện tại của trẻ (thông báo tới từng giáo viên chủ nhiệm). Trường `assigned_role` ghi người nhận lúc gửi để hiển thị; quyền nhận thuốc và ghi liều xét theo cấu hình tại thời điểm thao tác.
  - Quyền nhận thuốc, từ chối, ghi liều: y tế có `P10.medication.administer` ở đơn vị của trẻ hoặc ở Trường chính (toàn trường) luôn làm được, kể cả khi đơn vị bật cấu hình (y tế cấp trên vẫn xem và hỗ trợ được); giáo viên chủ nhiệm của lớp hiện tại của trẻ chỉ làm được khi đơn vị của trẻ đang bật cấu hình, tắt thì trả `ERR_FORBIDDEN`.
  - Trạng thái theo `07` mục chuyển trạng thái: Chờ nhận (`pending`) → Đang cho uống (`administering`) khi người nhận xác nhận đã nhận thuốc (kèm thuốc thực nhận và ghi chú, tùy chọn) → Hoàn thành (`completed`) tự động khi đã ghi đủ mọi liều theo lịch (số ngày nhân số giờ) hoặc người nhận bấm kết thúc sớm (khi phụ huynh dặn ngừng); hoặc Từ chối (`rejected`) kèm lý do khi đang chờ nhận. Nhận, từ chối báo phụ huynh trong ứng dụng.
  - Ghi liều (BR-49, BR-50): chỉ khi yêu cầu đang cho uống (chờ nhận trả mã BR-49); mỗi liều theo ngày và giờ của yêu cầu, ngày trong thời gian dùng thuốc và không sau hôm nay; giờ phải là một trong các giờ của yêu cầu; thời điểm cho uống là giờ máy chủ, người thực hiện là người ghi; mỗi ngày và giờ chỉ một bản ghi, trùng trả `ERR_CONFLICT` kèm mã liều đã ghi và nội dung đã ghi; bỏ liều bắt buộc lý do. Bỏ liều thì phụ huynh nhận thông báo trong ứng dụng; liều đã cho uống không gửi thông báo, phụ huynh xem trên ứng dụng.
  - Xác nhận đã biết bỏ liều (BR-88): chỉ phụ huynh của trẻ, chỉ với liều bỏ (liều đã cho uống trả mã BR-88), gọi lại trả thời điểm xác nhận lần đầu; y tế và giáo viên thấy trạng thái, không nhắc lại.
  - Danh sách liều cần cho uống theo ngày (`medication-schedules`): các yêu cầu đang cho uống có ngày trong thời gian dùng thuốc, mỗi giờ một dòng kèm liều đã ghi và cờ `can_administer`.
  - Người xem yêu cầu dặn thuốc: y tế theo phạm vi quyền, Ban Giám hiệu và quản lý đơn vị (VT-02, VT-15, VT-03) theo đơn vị được gán, giáo viên chủ nhiệm theo lớp đang chủ nhiệm (xem được cả khi đơn vị tắt cấu hình), phụ huynh theo con mình.
  - Danh mục thuốc (P10-02) theo đơn vị: mã thuốc duy nhất trong đơn vị, tên, hoạt chất, đơn vị tính, nhà thuốc (cùng đơn vị, đang dùng), trạng thái dùng hoặc ngừng. Số lượng tồn chỉ nhập khi tạo (tồn đầu), sau đó chỉ thay đổi qua phiếu mua thuốc (tăng) và phiếu cấp thuốc (giảm); sửa thuốc không nhận `stock_qty`. Nhà thuốc theo đơn vị: tên, điện thoại, địa chỉ, trạng thái. Danh mục là tủ thuốc của phòng y tế, tách với kho của P13. Thuốc trong yêu cầu dặn thuốc do phụ huynh gửi là chữ tự do, không liên kết danh mục.
  - Đề nghị mua thuốc (P10-05, BR-63): y tế chọn thuốc trong danh mục, số lượng, đơn giá dự kiến, lý do; thành tiền dự kiến = số lượng nhân đơn giá. Duyệt theo hạn mức loại `purchase_request` của đơn vị như phiếu chi: dưới hạn mức Phó Hiệu trưởng (phạm vi đơn vị) hoặc Hiệu trưởng duyệt, từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức thì chỉ Hiệu trưởng; việc cần Hiệu trưởng ghi lúc lập đề nghị (`requires_principal`); người duyệt không được là người lập; từ chối bắt buộc lý do. Lập xong báo người duyệt theo vai trò; duyệt hoặc từ chối báo người lập. Đề nghị dùng điểm cuối `/approve` và `/reject` riêng.
  - Phiếu mua thuốc (P10-09, BR-28): y tế lập từ đề nghị đã duyệt, mỗi đề nghị một phiếu (đề nghị chuyển sang "đã lập phiếu mua"), chọn nhà thuốc của đơn vị, ngày mua (trống là hôm nay, không sau hôm nay), các dòng thuốc của danh mục đơn vị (mỗi thuốc một dòng) với số lượng và đơn giá; phiếu lập xong là đã nhận thuốc (trạng thái `received`), số lượng thực nhận bằng số lượng mua, tồn tăng ngay. Mã phiếu `MT-000001` theo năm học qua `nextDocumentCode`. Thanh toán không tự sinh: kế toán lập phiếu chi theo QT-05 (P06-04) và ghi mã phiếu mua trong nội dung; người có `P06.view` xem được danh mục, đề nghị và phiếu mua để thanh toán.
  - Phiếu cấp thuốc (phần "cấp thuốc" của P10-05): y tế cấp thuốc từ tủ thuốc cho người nhận (lớp, trẻ, cá nhân) kèm lý do, trừ tồn ngay, không cho cấp quá tồn (mã P10-05). Mã phiếu `CTH-000001` theo năm học. Không có bước duyệt.
  - Mở năm học mới chuyển nhà thuốc và danh mục thuốc kèm tồn (bước `medicines`, sau bước y tế); yêu cầu dặn thuốc, nhật ký cho uống, đề nghị mua, phiếu mua, phiếu cấp tra ở năm cũ.
  - Trang Thuốc và dặn thuốc trên cổng quản trị (MH-17) cho người có một trong ba quyền P10 của phần, đặt trong nhóm Y TẾ; ứng dụng giáo viên thêm màn hình dặn thuốc của lớp (MG-09 phần thuốc); ứng dụng phụ huynh thêm mục Dặn thuốc trong thẻ của con (MP-07, kèm xác nhận bỏ liều của MP-08).
- Thành phần bị ảnh hưởng: `07`, `08`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: tám bảng mới của năm học (tệp 0031: `pharmacies`, `medicines`, `medication_requests`, `medication_administrations`, `medicine_purchase_requests`, `medicine_purchase_orders`, `medicine_purchase_order_items`, `medicine_issues`); thêm hai giá trị `medicine_photo`, `prescription` vào ràng buộc mục đích của bảng `files`. Không đổi cơ sở dữ liệu định danh.
- API bị ảnh hưởng: các điểm cuối thuốc, dặn thuốc, mua thuốc, cấp thuốc trong `17`; `POST /files` nhận thêm hai mục đích; `GET /files/{id}` thêm luật xem ảnh thuốc.
- Giao diện bị ảnh hưởng: MH-17, MG-09 phần dặn thuốc, MP-07, MP-08 phần xác nhận bỏ liều.
- Quyền bị ảnh hưởng: PQ-40.
- Ảnh hưởng chức năng cũ: ứng dụng phụ huynh gửi biểu mẫu nhiều phần không còn bị đặt kiểu nội dung JSON (sửa trong `api-client.ts` của ứng dụng phụ huynh, giống cổng quản trị và ứng dụng giáo viên); nhóm Y TẾ trên cổng quản trị hiện cả khi người dùng chỉ có quyền thuốc. Không đổi hành vi G1.
- Kiểm thử cần thực hiện: CT-053, CT-054, CT-055, CT-056, CT-116, CT-171, CT-172, CT-173; kiểm thử giao diện `tests/e2e/31-medication.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

| medicines | Danh mục thuốc của tủ thuốc phòng y tế theo đơn vị (YCTD-75) | org_unit_id, code (duy nhất trong đơn vị), name, active_ingredient, unit, pharmacy_id, stock_qty (không âm, chỉ đổi qua phiếu mua và phiếu cấp), status, created_by |
| pharmacies | Nhà thuốc theo đơn vị (YCTD-75) | org_unit_id, name, phone, address, status, created_by |
| medication_requests | Yêu cầu dặn thuốc (YCTD-75) | child_id, org_unit_id, class_id, requested_by, medicine_name, dosage, times (giờ HH:MM, ít nhất một), from_date, to_date, allergy_note, note, medicine_photo_ids (ít nhất một), prescription_photo_id (tùy chọn), assigned_role (nurse, homeroom), status (pending, administering, completed, rejected), received_quantity, received_note, received_by, received_at, reject_reason, rejected_by, rejected_at, completed_at |
| medication_administrations | Nhật ký cho uống thuốc (YCTD-75) | request_id, scheduled_date, scheduled_time (duy nhất cùng request_id và scheduled_date), administered_at, administered_by, dose_note, is_skipped, skip_reason (bắt buộc khi bỏ liều), parent_acknowledged_at, parent_acknowledged_by |
| medicine_purchase_requests | Đề nghị mua thuốc (YCTD-75) | org_unit_id, medicine_id, quantity, estimated_unit_price, estimated_amount, reason, status (pending, approved, rejected, ordered), requires_principal, created_by, approved_by, approved_at, reject_reason |
| medicine_purchase_orders | Phiếu mua thuốc (YCTD-75) | code (MT-000001), org_unit_id, request_id (duy nhất), pharmacy_id, order_date, total_amount, status (received), note, created_by |
| medicine_purchase_order_items | Thuốc đã mua (YCTD-75) | order_id, medicine_id, quantity, unit_price, amount, received_qty |
| medicine_issues | Phiếu cấp thuốc từ tủ thuốc (YCTD-75) | code (CTH-000001), org_unit_id, medicine_id, quantity, recipient, reason, issued_by, issued_at |

## Điểm cuối

| GET, POST | /api/v1/medicines | Danh mục thuốc theo đơn vị; tạo thuốc kèm tồn đầu (YCTD-75) |
| PATCH | /api/v1/medicines/{id} | Sửa tên, hoạt chất, đơn vị tính, nhà thuốc, trạng thái; không sửa tồn |
| GET, POST | /api/v1/pharmacies | Nhà thuốc theo đơn vị |
| PATCH | /api/v1/pharmacies/{id} | Sửa nhà thuốc |
| GET, POST | /api/v1/medication-requests | Danh sách và gửi yêu cầu dặn thuốc |
| GET | /api/v1/medication-requests/{id} | Chi tiết yêu cầu kèm các liều đã ghi và `can_administer` |
| POST | /api/v1/medication-requests/{id}/receive | Xác nhận đã nhận thuốc |
| POST | /api/v1/medication-requests/{id}/reject | Từ chối nhận thuốc kèm lý do |
| POST | /api/v1/medication-requests/{id}/complete | Kết thúc sớm yêu cầu đang cho uống |
| GET | /api/v1/medication-schedules | Danh sách trẻ cần cho uống thuốc theo khung giờ của một ngày |
| POST | /api/v1/medication-administrations | Ghi nhận một lần cho uống thuốc hoặc bỏ liều; giáo viên chủ nhiệm chỉ gọi được khi đơn vị bật cấu hình không có nhân viên y tế |
| POST | /api/v1/medication-administrations/{id}/acknowledge | Phụ huynh xác nhận đã biết thông báo bỏ liều (YCTD-25) |
| GET, POST | /api/v1/medicine-purchase-requests | Đề nghị mua thuốc |
| POST | /api/v1/medicine-purchase-requests/{id}/approve | Duyệt đề nghị mua thuốc theo hạn mức |
| POST | /api/v1/medicine-purchase-requests/{id}/reject | Từ chối đề nghị mua thuốc kèm lý do |
| GET, POST | /api/v1/medicine-purchase-orders | Phiếu mua thuốc và thuốc đã mua |
| GET, POST | /api/v1/medicine-issues | Phiếu cấp thuốc từ tủ thuốc |

Giao kèo của thuốc và dặn thuốc (DT-10 phần 10b, YCTD-75):

1. `POST /files` nhận thêm `purpose` `medicine_photo` (JPEG, PNG) và `prescription` (JPEG, PNG, PDF); chỉ phụ huynh có con đang học trong `org_unit_id` tải được, khác trả `ERR_FORBIDDEN`. `GET /files/{id}` của hai mục đích này theo quyền xem sức khỏe của trẻ của yêu cầu chứa tệp; tệp chưa gắn yêu cầu chỉ người tải lên xem.
2. `POST /medication-requests` nhận `child_id`, `medicine_name`, `dosage`, `times` (mảng một đến sáu giờ `HH:MM`, không trùng), `from_date` (không trước hôm nay), `to_date` (tối đa 30 ngày), `allergy_note` (bắt buộc), `note`, `medicine_photo_ids` (mảng một đến năm mã tệp `medicine_photo`), `prescription_photo_id` (tùy chọn, tệp `prescription`); tệp phải do người gọi tải lên và thuộc đơn vị của trẻ. Thiếu trường bắt buộc trả `ERR_VALIDATION`; không phải phụ huynh của trẻ trả `ERR_FORBIDDEN`; trẻ không đang học trả mã P10-03. Trả `assigned_role` (`nurse` hoặc `homeroom`).
3. `GET /medication-requests` nhận `child_id`, `status`, `org_unit_id`, `class_id` (lọc theo lớp hiện tại của trẻ); mỗi dòng có `full_name`, `class_name`, `current_class_id`, `administrations` (mảng liều đã ghi). Tối đa 200 dòng mới nhất.
4. `POST /medication-requests/{id}/receive` nhận `received_quantity`, `received_note` (tùy chọn); `POST /medication-requests/{id}/reject` nhận `reason` (bắt buộc); `POST /medication-requests/{id}/complete` không nhận thân. Không ở trạng thái phù hợp trả `ERR_RULE_VIOLATION` (nhận: mã BR-49; từ chối, kết thúc: mã P10-04). Không có quyền theo BR-86 trả `ERR_FORBIDDEN`.
5. `POST /medication-administrations` nhận `request_id`, `scheduled_date` (trống là hôm nay, không sau hôm nay), `scheduled_time` (một trong `times`), `is_skipped`, `skip_reason` (bắt buộc khi bỏ liều), `dose_note`. Yêu cầu chờ nhận trả mã BR-49; yêu cầu đã kết thúc hoặc ngày ngoài thời gian dùng thuốc trả mã P10-04; liều đã ghi trả `ERR_CONFLICT` với `details` gồm `administration_id` và `existing` (nội dung đã ghi). Ghi đủ liều theo lịch thì yêu cầu tự chuyển `completed`.
6. `POST /medication-administrations/{id}/acknowledge` chỉ phụ huynh của trẻ, chỉ với liều bỏ (liều đã cho uống trả mã BR-88); gọi lại trả thời điểm xác nhận lần đầu.
7. `GET /medication-schedules` nhận `date` (trống là hôm nay), `org_unit_id`, `class_id`; trả từng giờ của các yêu cầu đang cho uống trong ngày: `request_id`, `child_id`, `full_name`, `class_name`, `medicine_name`, `dosage`, `scheduled_date`, `scheduled_time`, `administration` (liều đã ghi hoặc `null`), `can_administer`.
8. `POST /medicines` nhận `org_unit_id`, `code`, `name`, `active_ingredient`, `unit`, `pharmacy_id`, `stock_qty` (tồn đầu, 0 trở lên); trùng mã trong đơn vị trả `ERR_CONFLICT`. `PATCH /medicines/{id}` gửi `stock_qty` trả `ERR_VALIDATION`. `GET /medicines`, `GET /pharmacies` nhận `org_unit_id`, `status`; người có `P10.medicine.manage`, `P10.medicine-purchase.approve` hoặc `P06.view` xem theo phạm vi.
9. `POST /medicine-purchase-requests` nhận `medicine_id`, `quantity`, `estimated_unit_price`, `reason`; trả `estimated_amount`, `requires_principal`. `POST .../approve` không nhận thân; `POST .../reject` nhận `reason` (bắt buộc). Cần Hiệu trưởng mà người duyệt không phải Hiệu trưởng, hoặc người duyệt là người lập, trả `ERR_FORBIDDEN`; đề nghị không chờ duyệt trả mã BR-63.
10. `POST /medicine-purchase-orders` nhận `request_id` (đề nghị đã duyệt, chưa lập phiếu; khác trả mã BR-63), `pharmacy_id`, `order_date`, `note`, `items` (mảng `medicine_id`, `quantity`, `unit_price`, mỗi thuốc một dòng, thuốc thuộc đơn vị của đề nghị); trả `code` dạng `MT-000001`, `total_amount`, `items`; tồn của từng thuốc tăng theo số lượng.
11. `POST /medicine-issues` nhận `medicine_id`, `quantity`, `recipient`, `reason`; trả `code` dạng `CTH-000001` và `stock_qty` sau khi cấp; không đủ tồn trả mã P10-05.

## Màn hình

| MH-17 | Thuốc và dặn thuốc: yêu cầu dặn thuốc chờ nhận, nhận hoặc từ chối, xem ảnh thuốc và đơn thuốc; liều cần cho uống theo ngày, ghi đã cho uống hoặc bỏ liều kèm lý do, trạng thái phụ huynh đã biết; danh mục thuốc, nhà thuốc; đề nghị mua thuốc, duyệt theo hạn mức, phiếu mua thuốc; phiếu cấp thuốc (YCTD-75) | VT-09; người có quyền duyệt mua thuốc, người có quyền ghi liều |
| MG-09 | Chăm sóc và y tế của lớp: ghi nhiệt độ, tình trạng, chăm sóc đặc biệt, sự kiện y tế cho từng trẻ (YCTD-74); màn hình dặn thuốc của lớp: xem yêu cầu và ảnh thuốc, nhận thuốc, từ chối, ghi liều hoặc bỏ liều khi đơn vị không có nhân viên y tế (YCTD-75) | VT-07 |
| MP-07 | Dặn thuốc: gửi yêu cầu kèm ảnh thuốc, ảnh đơn thuốc nếu có; xem trạng thái, liều đã cho uống, liều bỏ và nút đã biết (YCTD-75) | VT-14 |
| MP-08 | Sức khỏe của con: dị ứng, chỉ số và kết quả khám kèm đánh giá, sự kiện y tế và nút đã biết, chăm sóc hằng ngày, yêu cầu và xem báo cáo sức khỏe (YCTD-74); xác nhận bỏ liều ở mục Dặn thuốc (MP-07, YCTD-75) | VT-14 |

## Quyền

| PQ-40 | Thuốc và dặn thuốc (YCTD-75): `P10.medicine.manage` cho VT-09 quản lý danh mục thuốc, nhà thuốc, đề nghị mua thuốc, phiếu mua thuốc, phiếu cấp thuốc trong đơn vị được gán; `P10.medication.administer` cho VT-09 nhận thuốc, từ chối, ghi liều, bỏ liều trong đơn vị được gán (gán ở Trường chính là toàn trường) và VT-07 chỉ cho trẻ của lớp mình chủ nhiệm khi đơn vị bật "không có nhân viên y tế" (BR-86); `P10.medicine-purchase.approve` cho VT-15 duyệt đề nghị dưới hạn mức `purchase_request` trong đơn vị và VT-02 duyệt mọi đề nghị (BR-63); xem yêu cầu dặn thuốc theo BR-53; người có `P06.view` xem danh mục, đề nghị, phiếu mua để thanh toán |

## Kết quả kiểm thử

Kiểm thử máy chủ `apps/api/src/medicines/medicines.test.ts`: 8/8 ca đạt (chạy 2026-10-11).

- CT-053: đạt (thiếu `times` hoặc mảng rỗng trả `ERR_VALIDATION` trường `times`; thiếu tình trạng dị ứng cũng bị chặn).
- CT-054: đạt (ghi liều khi chưa nhận thuốc trả 422 mã BR-49).
- CT-055: đạt (ghi trùng liều 08:00 trả 409 kèm mã liều đã ghi).
- CT-056: đạt (bỏ liều không lý do trả 400 trường `skip_reason`).
- CT-116: đạt (phiếu mua 10 hộp, tồn tăng từ 5 lên 15; mã MT-000001).
- CT-171: đạt (đơn vị bật cấu hình: yêu cầu chuyển cho giáo viên chủ nhiệm, giáo viên nhận và ghi liều được; y tế ở Trường chính vẫn xem; tắt lại thì giáo viên bị chặn).
- CT-172: đạt (đơn vị tắt cấu hình: giáo viên chủ nhiệm gọi nhận thuốc trả 403).
- CT-173: đạt (không ảnh thuốc bị từ chối; có ảnh thuốc, không đơn thuốc gửi được).
- Thêm: duyệt đề nghị theo hạn mức (chưa có hạn mức chỉ Hiệu trưởng; dưới hạn mức Phó Hiệu trưởng duyệt; từ hạn mức trở lên Phó Hiệu trưởng bị chặn), cấp thuốc quá tồn bị chặn, xác nhận đã biết bỏ liều, quyền tải ảnh thuốc.

Hồi quy đã chạy: `children.test`, `pickups.test`, `finance/payments.test`, `health/health.test`, `academic-years.test` đều đạt.

Kiểm thử giao diện `tests/e2e/31-medication.spec.ts`: đã viết (phụ huynh gửi yêu cầu kèm ảnh, y tế nhận thuốc và ghi liều trên cổng quản trị, phụ huynh thấy liều đã cho uống); chưa chạy theo hướng dẫn, người điều phối chạy.

## Quy tắc

Không cần sửa nội dung BR. Đề xuất ghi chú thêm (tùy người điều phối):

- BR-48: thêm "tình trạng dị ứng bắt buộc nhập, ghi Không nếu không dị ứng; mỗi yêu cầu dùng thuốc tối đa 30 ngày (YCTD-75)".
- Mục chuyển trạng thái "Yêu cầu dặn thuốc" của `07`: thêm "Đang cho uống → Hoàn thành tự động khi ghi đủ liều theo lịch hoặc khi người nhận kết thúc sớm (YCTD-75)".
