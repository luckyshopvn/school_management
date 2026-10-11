# Nháp tài liệu phần 10d: Kho, tài sản, mua hàng

## YCTD

### YCTD-77: Kho, tài sản và mua hàng – 2026-10-11

- Lý do: phần 10d theo cách chia ở YCTD-73. Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền dùng đã cấp trước ở tệp 0032 định danh: `P13.asset.manage` (VT-11) quản lý tài sản, cấp phát, thu hồi, mượn trả, hỏng mất, mặt hàng, nhập xuất, tồn ban đầu, lập biên bản kiểm kê, nhà cung cấp trong đơn vị; `P13.purchase-request.create` (mọi vai trò nhân sự) lập đề nghị mua hàng; `P13.purchase-request.approve` (VT-02, VT-15) duyệt đề nghị và duyệt xử lý hỏng mất; `P13.purchase-order.manage` (VT-11, VT-04) lập phiếu mua hàng, nhận hàng, quản lý nhà cung cấp; `P13.stocktake.approve` (VT-05) duyệt biên bản kiểm kê có chênh lệch. Phạm vi theo đơn vị được gán, gán ở Trường chính là toàn trường.
  - Tài sản (P13-01): mã tài sản do người dùng nhập, duy nhất toàn trường trong năm học; nhóm là chữ tự do; nguyên giá số nguyên đồng; ngày nhập không sau hôm nay. Trạng thái: trong kho, đang cấp phát, đang cho mượn, hỏng, mất, đã thanh lý. Sửa thông tin hoặc thanh lý (chỉ khi trong kho, hỏng hoặc mất) bằng `PUT /assets/{id}`.
  - Cấp phát và thu hồi (P13-02), mượn trả (P13-03): chỉ tài sản đang trong kho mới cấp phát hoặc cho mượn được, nếu không trả mã BR-61. Mỗi tài sản có tối đa một phiếu cấp phát đang mở và một phiếu mượn đang mở. Phiếu cấp phát ghi nơi nhận (phòng, lớp, nhân sự, đơn vị) và tên người nhận; thu hồi sinh mã phiếu thu hồi riêng trên cùng bản ghi. Người mượn ghi theo tên, có thể kèm tài khoản; quá hạn tính khi phiếu mượn còn mở và hạn trả trước hôm nay, không có tác vụ nhắc tự động.
  - Hỏng và mất (P13-04): thủ kho ghi nhận loại sự việc (hỏng, mất), mức độ (nhẹ, nặng, hỏng hoàn toàn), mô tả, đề xuất xử lý; mỗi tài sản một ghi nhận chờ duyệt; Phó Hiệu trưởng của đơn vị hoặc Hiệu trưởng duyệt hoặc từ chối kèm lý do, người ghi nhận không tự duyệt. Duyệt thì tài sản chuyển sang hỏng hoặc mất, phiếu cấp phát và phiếu mượn đang mở được đóng kèm ghi chú theo mã ghi nhận.
  - Đề nghị mua hàng (P13-05): mọi nhân sự lập cho đơn vị mình được gán (gán một đơn vị thì không cần chọn); gồm nhiều mặt hàng có số lượng, đơn vị tính, đơn giá dự kiến; giá trị đề nghị là tổng số lượng nhân đơn giá dự kiến làm tròn đồng; thời hạn cần không trước hôm nay. Đề nghị trình duyệt ngay khi lập (không có nháp). Hạn mức đọc ở `approval_thresholds` loại `purchase_request` của đơn vị: dưới hạn mức thì VT-15 của đơn vị hoặc VT-02 duyệt; từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức thì chỉ VT-02 duyệt (như phiếu chi); người lập không tự duyệt; từ chối bắt buộc lý do. Người lập xem đề nghị của mình; người duyệt thấy danh sách chờ duyệt của người khác trong phạm vi, VT-15 chỉ thấy đề nghị dưới hạn mức. Thông báo trình duyệt gửi theo vai trò VT-15 của đơn vị (khi dưới hạn mức) và VT-02 ở Trường chính; kết quả duyệt báo người lập, đề nghị được duyệt báo thêm VT-11 của đơn vị.
  - Phiếu mua hàng (P13-06): lập từ đúng một đề nghị đã duyệt (BR-63), mỗi đề nghị một phiếu; đề nghị chuyển sang trạng thái đã lập phiếu mua. Phiếu gồm nhà cung cấp đang dùng của đơn vị, ngày mua không sau hôm nay, các dòng mặt hàng với đơn giá mua thực tế, mỗi dòng có thể gắn mặt hàng kho để nhập kho. Nhận hàng một lần cho đủ cả phiếu: dòng gắn mặt hàng kho sinh phiếu nhập kho theo đơn giá mua, tham chiếu phiếu mua hàng.
  - Thanh toán phiếu mua hàng: hệ thống không tự tạo phiếu chi (BR-28). Phiếu mua hàng có trạng thái thanh toán `awaiting_payment` (công nợ phải trả nhà cung cấp) cho đến khi kế toán lập phiếu chi theo QT-05 và gắn phiếu chi đã phát hành, cùng đơn vị, đúng số tiền vào phiếu mua hàng bằng `POST /purchase-orders/{id}/payment` (quyền `P06.payment.manage`); mỗi phiếu chi chỉ gắn một phiếu mua hàng. Kế toán nhận thông báo theo vai trò VT-04 khi phiếu mua hàng đã nhận hàng.
  - Nhà cung cấp (P13-07): theo đơn vị, tên duy nhất trong đơn vị; mã số thuế, người liên hệ, điện thoại, địa chỉ, điều khoản là chữ tự do; ngừng dùng bằng trạng thái.
  - Nhập xuất tồn kho (P13-08): mặt hàng theo đơn vị, mã duy nhất trong đơn vị, có tồn tối thiểu (dùng để đánh dấu dưới tối thiểu). Tồn hiện tại lưu ở mặt hàng và luôn bằng tổng các giao dịch; mỗi giao dịch lưu số lượng có dấu và tồn sau giao dịch; ghi giao dịch khóa dòng mặt hàng. Một phiếu nhập hoặc xuất có nhiều dòng cùng mã phiếu. Xuất vượt tồn luôn bị từ chối mã BR-62 kèm câu "Xuất vượt tồn" (không làm cấu hình bật tắt kiểm tra như BR-62 nêu; ghi đề xuất ở mục Quy tắc). Ngày giao dịch không sau hôm nay.
  - Kiểm kê (P13-09): thủ kho lập biên bản với số thực tế của các mặt hàng chọn kiểm; số hệ thống lấy theo tồn lúc lập. Không chênh lệch thì biên bản ở trạng thái khớp. Có chênh lệch thì biên bản chờ duyệt, tồn chưa đổi, VT-05 của đơn vị nhận thông báo; VT-05 duyệt thì hệ thống ghi phiếu điều chỉnh theo chênh lệch của từng dòng (không đặt bằng số thực tế, để giao dịch phát sinh giữa lúc lập và lúc duyệt vẫn đúng); VT-05 từ chối kèm lý do thì tồn giữ nguyên. Người lập không tự duyệt.
  - Tồn kho ban đầu (P13-10): nhập theo mặt hàng với số lượng, đơn giá, ngày khóa sổ; chỉ nhập cho mặt hàng chưa có giao dịch kho nào, có giao dịch thì từ chối mã BR-62; ghi xong là khóa (lần nhập sau bị từ chối vì đã có giao dịch). Tài sản đầu kỳ nhập qua danh mục tài sản, không qua tồn kho ban đầu.
  - Mã chứng từ dùng `nextDocumentCode` theo năm học: cấp phát `CPTS`, thu hồi `THTS`, mượn `MTTS`, hỏng mất `HMTS`, tồn ban đầu `TDK`, nhập kho `PNK`, xuất kho `PXK`, điều chỉnh kiểm kê `DCK`, biên bản kiểm kê `KKK`, chuyển năm `CTK`, đề nghị mua hàng `DNMH`, phiếu mua hàng `PMH`.
  - Mở năm học mới chuyển nhà cung cấp, tài sản chưa thanh lý kèm vị trí và trạng thái, phiếu cấp phát và phiếu mượn đang mở, mặt hàng kèm tồn hiện tại; mỗi mặt hàng chuyển sang có một giao dịch chuyển năm ghi tồn đầu năm nên tồn ban đầu không nhập lại được. Phiếu nhập xuất, kiểm kê, hỏng mất, đề nghị và phiếu mua hàng tra ở năm cũ. Đề nghị chờ duyệt, phiếu mua hàng chưa nhận hàng không chặn mở năm học mới (chưa thêm vào BR-94).
  - Trang Kho và tài sản (`/inventory`) và Đề nghị mua hàng (`/purchase-requests`) trên cổng quản trị, nhóm điều hướng mới "KHO VÀ MUA HÀNG". Không có màn hình trên ứng dụng giáo viên, phụ huynh; giáo viên lập đề nghị mua hàng trên cổng quản trị.
- Thành phần bị ảnh hưởng: `07`, `08`, `10`, `14`, `16`, `17`, `21`, `27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị.
- Dữ liệu bị ảnh hưởng: mười ba bảng mới của năm học (tệp 0033): `suppliers`, `assets`, `asset_assignments`, `asset_loans`, `asset_damages`, `stock_items`, `stock_transactions`, `stock_counts`, `stock_count_lines`, `purchase_requests`, `purchase_request_items`, `purchase_orders`, `purchase_order_items`. Không thêm quyền mới (đã cấp ở tệp 0032 định danh).
- API bị ảnh hưởng: nhóm điểm cuối kho, tài sản, mua hàng trong mục 15 của `17`.
- Giao diện bị ảnh hưởng: MH-20, MH-21, MH-22.
- Quyền bị ảnh hưởng: PQ-42.
- Ảnh hưởng chức năng cũ: thêm một bước chuyển năm học (sau bước y tế); phiếu chi không đổi.
- Kiểm thử cần thực hiện: CT-066, CT-067, CT-068, CT-120, CTC-P01-062; kiểm thử giao diện `tests/e2e/33-inventory.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

| suppliers | Nhà cung cấp của đơn vị (P13-07) | org_unit_id, name (duy nhất trong đơn vị), tax_code, contact_name, phone, address, payment_terms, status, created_by |
| assets | Tài sản (P13-01) | org_unit_id, code (duy nhất), name, category, unit, original_cost, purchase_date, location_type (store, room, class, staff, unit), location_id, location_name, status (in_stock, assigned, on_loan, damaged, lost, disposed) |
| asset_assignments | Phiếu cấp phát và thu hồi (P13-02) | code, asset_id, assigned_to_type, assigned_to_id, assigned_to_name, received_by_name, assigned_on, handed_by, return_code, returned_on, returned_by_name, return_received_by, return_note; một phiếu đang mở mỗi tài sản |
| asset_loans | Phiếu mượn trả (P13-03) | code, asset_id, borrower_name, borrower_user_id, from_date, due_date, status (open, returned), lent_by, returned_on, return_received_by; một phiếu đang mở mỗi tài sản |
| asset_damages | Ghi nhận hỏng và mất (P13-04) | code, asset_id, org_unit_id, incident_type (damaged, lost), severity (minor, major, total), description, occurred_on, proposed_handling, status (pending, approved, rejected), reported_by, decided_by, decided_at, decision_note |
| stock_items | Mặt hàng trong kho (P13-08) | org_unit_id, code (duy nhất trong đơn vị), name, unit, min_qty, current_qty (không âm), status |
| stock_transactions | Giao dịch kho (P13-08, P13-10) | code, stock_item_id, transaction_type (opening, receipt, issue, count_adjustment, carry_over), quantity (có dấu), unit_price, balance_after, reference_type, reference_id, transaction_date, note, created_by |
| stock_counts | Biên bản kiểm kê (P13-09) | code, org_unit_id, count_date, status (matched, pending, approved, rejected), note, created_by, decided_by, decided_at, reject_reason |
| stock_count_lines | Dòng kiểm kê | count_id, stock_item_id, system_qty, actual_qty, difference, note |
| purchase_requests | Đề nghị mua hàng (P13-05) | code, org_unit_id, requester_id, requester_name, needed_by, reason, total_amount, requires_principal, status (pending, approved, rejected, ordered), approved_by, approved_at, reject_reason |
| purchase_request_items | Mặt hàng đề nghị | request_id, item_name, quantity, unit, estimated_price, note |
| purchase_orders | Phiếu mua hàng (P13-06) | code, org_unit_id, request_id (duy nhất), supplier_id, order_date, total_amount, status (ordered, received), payment_status (awaiting_payment, paid), payment_id (duy nhất), note, created_by, received_by, received_at |
| purchase_order_items | Mặt hàng đã mua | order_id, stock_item_id, item_name, quantity, unit_price, amount, received_qty |

## Điểm cuối

| GET, POST | /api/v1/suppliers | Danh sách và thêm nhà cung cấp của đơn vị |
| PUT | /api/v1/suppliers/{id} | Sửa hoặc ngừng dùng nhà cung cấp |
| GET, POST | /api/v1/assets | Danh sách (lọc đơn vị, trạng thái, mã hoặc tên) và thêm tài sản |
| GET, PUT | /api/v1/assets/{id} | Chi tiết tài sản kèm lịch sử cấp phát, mượn, hỏng mất; sửa thông tin hoặc thanh lý |
| POST | /api/v1/asset-assignments | Cấp phát tài sản |
| POST | /api/v1/asset-assignments/{id}/return | Thu hồi tài sản đã cấp phát |
| GET, POST | /api/v1/asset-loans | Danh sách phiếu mượn (đang mượn, quá hạn, đã trả) và cho mượn |
| POST | /api/v1/asset-loans/{id}/return | Nhận trả tài sản mượn |
| GET, POST | /api/v1/asset-damages | Danh sách và ghi nhận hỏng hoặc mất |
| POST | /api/v1/asset-damages/{id}/approve | Ban Giám hiệu duyệt xử lý hỏng mất |
| POST | /api/v1/asset-damages/{id}/reject | Từ chối xử lý hỏng mất kèm lý do |
| GET, POST | /api/v1/stock-items | Mặt hàng trong kho kèm tồn hiện tại |
| PUT | /api/v1/stock-items/{id} | Sửa mặt hàng |
| GET, POST | /api/v1/stock-transactions | Sổ kho; ghi phiếu nhập hoặc phiếu xuất |
| POST | /api/v1/stock-opening-balances | Nhập tồn kho ban đầu |
| GET, POST | /api/v1/stock-counts | Danh sách và lập biên bản kiểm kê |
| GET | /api/v1/stock-counts/{id} | Chi tiết biên bản kiểm kê |
| POST | /api/v1/stock-counts/{id}/approve | Kế toán trưởng duyệt biên bản có chênh lệch, điều chỉnh tồn |
| POST | /api/v1/stock-counts/{id}/reject | Từ chối biên bản kiểm kê kèm lý do |
| GET, POST | /api/v1/purchase-requests | Đề nghị của tôi, chờ duyệt, đã duyệt; lập đề nghị mua hàng |
| GET | /api/v1/purchase-requests/{id} | Chi tiết đề nghị |
| POST | /api/v1/purchase-requests/{id}/approve | Duyệt đề nghị mua hàng theo hạn mức |
| POST | /api/v1/purchase-requests/{id}/reject | Từ chối đề nghị mua hàng kèm lý do |
| GET, POST | /api/v1/purchase-orders | Danh sách và lập phiếu mua hàng từ đề nghị đã duyệt |
| GET | /api/v1/purchase-orders/{id} | Chi tiết phiếu mua hàng |
| POST | /api/v1/purchase-orders/{id}/receive | Nhận hàng vào kho |
| POST | /api/v1/purchase-orders/{id}/payment | Gắn phiếu chi đã phát hành, đánh dấu đã thanh toán |

Giao kèo của nhóm điểm cuối kho, tài sản và mua hàng (DT-10 phần 10d, YCTD-77):

1. `POST /purchase-requests` nhận `org_unit_id` (bỏ trống khi người lập chỉ được gán một đơn vị), `needed_by` (không trước hôm nay), `reason`, `items` (1 đến 100 dòng `item_name`, `quantity` lớn hơn 0 tối đa hai chữ số thập phân, `unit`, `estimated_price` số nguyên đồng lớn hơn 0, `note`); cần `P13.purchase-request.create` ở đơn vị. Kết quả có `code` (DNMH-000001), `status` `pending`, `total_amount`, `requires_principal` (đúng khi từ hạn mức loại `purchase_request` trở lên hoặc đơn vị chưa đặt hạn mức).
2. `GET /purchase-requests?view=` nhận `mine` (mặc định, đề nghị của người gọi), `pending` (chờ duyệt của người khác trong phạm vi `P13.purchase-request.approve`; VT-15 chỉ thấy `requires_principal` sai), `approved` (đã duyệt trong phạm vi `P13.purchase-order.manage`), `all`; lọc thêm `status`, `org_unit_id`. `GET /purchase-requests/{id}` cho người lập hoặc người có quyền duyệt, lập phiếu mua, `P06.payment.manage` ở đơn vị.
3. `POST /purchase-requests/{id}/approve`, `reject` (`reason` bắt buộc) cần `P13.purchase-request.approve` ở đơn vị; `requires_principal` đúng mà người gọi không có vai trò VT-02 trả `ERR_FORBIDDEN`; người lập tự duyệt trả `ERR_FORBIDDEN`; đề nghị không chờ duyệt trả `ERR_RULE_VIOLATION` mã BR-63.
4. `POST /purchase-orders` nhận `request_id`, `supplier_id` (nhà cung cấp đang dùng của đơn vị), `order_date` (không sau hôm nay), `note`, `items` (`item_name`, `stock_item_id` tùy chọn là mặt hàng kho đang dùng của đơn vị, `quantity`, `unit_price`); cần `P13.purchase-order.manage`. Đề nghị chưa duyệt hoặc đã lập phiếu trả mã BR-63. Kết quả có `code` (PMH-000001), `total_amount`, `status` `ordered`, `payment_status` `awaiting_payment`.
5. `POST /purchase-orders/{id}/receive` nhận `received_date` (từ ngày mua đến hôm nay); nhận đủ cả phiếu một lần, dòng có `stock_item_id` sinh phiếu nhập kho; đã nhận trả mã BR-62. `POST /purchase-orders/{id}/payment` nhận `payment_id`; cần `P06.payment.manage`; phiếu chi chưa phát hành, khác đơn vị, khác số tiền hoặc phiếu mua đã thanh toán trả mã BR-28; phiếu chi đã gắn phiếu mua khác trả `ERR_CONFLICT`.
6. `POST /stock-transactions` nhận `org_unit_id`, `transaction_type` (`receipt`, `issue`), `transaction_date` (không sau hôm nay), `note`, `lines` (`stock_item_id`, `quantity`, `unit_price` tùy chọn); cần `P13.asset.manage`. Một dòng xuất vượt tồn thì cả phiếu bị từ chối mã BR-62 với câu báo "Xuất vượt tồn" và tồn hiện tại. Kết quả có `code` (PNK- hoặc PXK-) và các dòng kèm `balance_after`.
7. `POST /stock-opening-balances` nhận `org_unit_id`, `balance_date`, `lines` (`stock_item_id` không trùng, `quantity`, `unit_price` bắt buộc); mặt hàng đã có bất kỳ giao dịch nào (kể cả chuyển năm) trả mã BR-62.
8. `POST /stock-counts` nhận `org_unit_id`, `count_date`, `note`, `lines` (`stock_item_id`, `actual_qty` từ 0, `note`); kết quả có `lines` với `system_qty`, `actual_qty`, `difference` và `status` `matched` hoặc `pending`. `approve` cần `P13.stocktake.approve` ở đơn vị, người lập không tự duyệt, ghi phiếu điều chỉnh DCK theo `difference`; `reject` nhận `reason` bắt buộc; biên bản không chờ duyệt trả mã BR-62.
9. `POST /assets` nhận `org_unit_id`, `code` (trùng trả `ERR_CONFLICT`), `name`, `category`, `unit`, `original_cost`, `purchase_date`; `PUT /assets/{id}` nhận các trường trên trừ mã và đơn vị, `status` chỉ nhận `disposed`. `POST /asset-assignments` nhận `asset_id`, `assigned_to_type` (`room`, `class`, `staff`, `unit`), `assigned_to_id`, `assigned_to_name`, `received_by_name`, `assigned_on`, `note`; `POST /asset-loans` nhận `asset_id`, `borrower_name`, `borrower_user_id`, `from_date`, `due_date`, `note`; tài sản không trong kho trả mã BR-61. `return` của hai loại phiếu nhận ngày trả và ghi chú; đã trả trả mã BR-61. `GET /asset-loans` có `overdue`.
10. `POST /asset-damages` nhận `asset_id`, `incident_type`, `severity`, `description`, `occurred_on`, `proposed_handling`; tài sản đã mất, đã thanh lý hoặc đang có ghi nhận chờ duyệt trả mã BR-61. `approve` (ghi chú tùy chọn), `reject` (`note` bắt buộc) cần `P13.purchase-request.approve` ở đơn vị, người ghi nhận không tự duyệt.
11. Danh sách tài sản, phiếu mượn, hỏng mất cho người có `P13.asset.manage` hoặc `P13.purchase-request.approve`; mặt hàng và sổ kho cho `P13.asset.manage`, `P13.purchase-order.manage`, `P13.stocktake.approve`; kiểm kê cho `P13.asset.manage`, `P13.stocktake.approve`; nhà cung cấp cho `P13.asset.manage`, `P13.purchase-order.manage`; phiếu mua hàng cho `P13.purchase-order.manage`, `P06.payment.manage`; đều trong phạm vi đơn vị.

## Màn hình

| MH-20 | Tài sản, mượn trả, hỏng và mất: trang Kho và tài sản, thẻ Tài sản: thêm tài sản, cấp phát, cho mượn, thu hồi hoặc nhận trả, ghi nhận hỏng; Ban Giám hiệu duyệt hoặc từ chối hỏng mất chờ duyệt (YCTD-77) | VT-11, VT-02, VT-15 |
| MH-21 | Đề nghị mua hàng, phiếu mua hàng, nhà cung cấp: trang Đề nghị mua hàng cho mọi nhân sự lập và xem đề nghị của mình, Ban Giám hiệu duyệt hoặc từ chối đề nghị chờ duyệt; trang Kho và tài sản, thẻ Phiếu mua hàng lập phiếu từ đề nghị đã duyệt, nhận hàng, xem trạng thái chờ thanh toán; thẻ Nhà cung cấp (YCTD-77) | Mọi nhân sự, VT-11, VT-04, VT-02, VT-15 |
| MH-22 | Nhập xuất tồn kho và kiểm kê: trang Kho và tài sản, thẻ Mặt hàng và tồn kho (thêm mặt hàng, ghi phiếu nhập, phiếu xuất, tồn kho ban đầu, sổ kho) và thẻ Kiểm kê (lập biên bản, kế toán trưởng duyệt hoặc từ chối chênh lệch) (YCTD-77) | VT-11, VT-05 |

## Quyền

| PQ-42 | Kho, tài sản và mua hàng (YCTD-77): `P13.asset.manage` cho VT-11 quản lý tài sản, cấp phát, mượn trả, hỏng mất, mặt hàng, nhập xuất, tồn ban đầu, lập kiểm kê, nhà cung cấp trong đơn vị; `P13.purchase-request.create` cho mọi vai trò nhân sự lập đề nghị mua hàng của đơn vị mình; `P13.purchase-request.approve` cho VT-15 (dưới hạn mức, trong đơn vị) và VT-02 (mọi mức) duyệt đề nghị và duyệt xử lý hỏng mất, người lập không tự duyệt; `P13.purchase-order.manage` cho VT-11, VT-04 lập phiếu mua hàng và nhận hàng; `P13.stocktake.approve` cho VT-05 duyệt biên bản kiểm kê có chênh lệch; `P06.payment.manage` gắn phiếu chi vào phiếu mua hàng |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/inventory/inventory.test.ts` đạt 8/8 ca ngày 11/10/2026:

- CTC-P01-062: PH-A chưa có hạn mức đề nghị mua hàng, KT-A trình 1 000 thì `requires_principal` đúng, chỉ báo VT-02; PHT-A duyệt bị `ERR_FORBIDDEN`, không thấy trong danh sách chờ duyệt; Hiệu trưởng duyệt được. Đạt.
- CT-067: đặt hạn mức 5 000 000; đề nghị 5 000 000 ở trạng thái chờ duyệt, chuyển Hiệu trưởng; PHT-A duyệt bị từ chối; đề nghị dưới hạn mức PHT-A duyệt được; người lập không tự duyệt; phụ huynh không lập được. Đạt.
- CT-066: tồn 10, xuất 15 bị từ chối mã BR-62 kèm "Xuất vượt tồn", tồn giữ 10; xuất 4 còn 6. Đạt.
- CT-068: kiểm kê 17 so với 20 thì biên bản chờ duyệt, chênh lệch −3, tồn chưa đổi; thủ kho duyệt bị từ chối; kế toán trưởng duyệt thì tồn còn 17; biên bản không chênh lệch ở trạng thái khớp; biên bản bị từ chối giữ nguyên tồn. Đạt.
- CT-120: mặt hàng đã có phiếu nhập thì nhập tồn ban đầu bị từ chối mã BR-62. Đạt.
- Thêm: phiếu mua hàng chỉ lập từ đề nghị đã duyệt, nhận hàng tăng tồn, chờ thanh toán; tài sản cấp phát, thu hồi, mượn quá hạn, hỏng được duyệt; mở năm học mới chuyển tài sản, phiếu mượn đang mở, nhà cung cấp, mặt hàng kèm tồn, tồn ban đầu không nhập lại được.

Kiểm thử giao diện `tests/e2e/33-inventory.spec.ts` đã viết (giáo viên lập đề nghị, Hiệu trưởng duyệt, thủ kho thêm mặt hàng, nhà cung cấp, lập phiếu mua và nhận hàng vào kho), chưa chạy theo hướng dẫn chung; người điều phối chạy.

## Quy tắc

- BR-62 đề xuất sửa: "Tồn kho tính từ phiếu nhập, phiếu xuất, tồn ban đầu, phiếu chuyển năm và phiếu điều chỉnh kiểm kê đã duyệt. Không cho xuất quá số lượng tồn. Tồn ban đầu chỉ nhập cho mặt hàng chưa có giao dịch và khóa ngay khi ghi. Kiểm kê có chênh lệch chỉ điều chỉnh tồn sau khi kế toán trưởng duyệt" (bỏ vế "nếu đơn vị bật kiểm tra này" vì luôn chặn, YCTD-77).
- BR-63 đề xuất bổ sung: "... Dưới hạn mức thì Phó Hiệu trưởng của đơn vị hoặc Hiệu trưởng duyệt; từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức thì Hiệu trưởng duyệt; người lập không tự duyệt. Mỗi đề nghị đã duyệt lập một phiếu mua hàng" (YCTD-77).
- BR-61 đề xuất bổ sung: "... Chỉ tài sản đang trong kho mới cấp phát hoặc cho mượn được; hỏng hoặc mất do Ban Giám hiệu của đơn vị duyệt xử lý" (YCTD-77).
