# Nháp tài liệu phần 10c: Bếp, thực đơn, định lượng và báo cáo ăn

## YCTD

### YCTD-76: Bếp, thực đơn, định lượng, suất ăn, phiếu đi chợ và báo cáo ăn – 2026-10-11

- Lý do: phần 10c theo cách chia ở YCTD-73 (P12-01 đến P12-09, P17-08). Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Quyền dùng bốn quyền đã cấp trước ở tệp 0032 của định danh: `P12.kitchen.manage` (VT-10) quản lý dữ liệu bếp của đơn vị; `P12.menu.approve` (VT-03) duyệt và công bố thực đơn, duyệt buffet; `P12.meal-report.submit` (VT-07) báo cơm lớp mình chủ nhiệm; `P17.report.kitchen` (VT-10, VT-04) xem báo cáo ăn và bếp. Phạm vi theo đơn vị được gán; gán ở Trường chính là toàn trường. Người có một trong ba quyền P12.kitchen.manage, P12.menu.approve, P17.report.kitchen của đơn vị thì xem được dữ liệu bếp của đơn vị.
  - Dữ liệu bếp theo đơn vị: nguyên liệu (mã duy nhất trong đơn vị, đơn vị tính, tồn hiện tại không âm), món ăn (tên duy nhất trong đơn vị, nhóm chất, cách chế biến), định lượng trên một suất của từng nguyên liệu trong món (nguyên liệu phải cùng đơn vị và đang dùng, sai trả mã BR-60).
  - Nhà cung cấp thực phẩm để ở bảng riêng `food_suppliers` theo đơn vị (tên duy nhất trong đơn vị, nhóm thực phẩm cung cấp, mã số thuế, người liên hệ, điện thoại, địa chỉ). Lý do: danh mục nhà cung cấp dùng chung (`suppliers`, P13) thuộc phần 10d làm song song; khi gộp, người điều phối có thể chuyển `food_suppliers` thành `suppliers` với `supplier_type = thực phẩm`.
  - Thực đơn tuần theo đơn vị, tuần bắt đầu thứ hai, độ tuổi là `all` (chung) hoặc mã khối học trong danh mục bậc học; mỗi đơn vị, tuần, độ tuổi một thực đơn. Món trong thực đơn theo thứ (1 thứ hai đến 6 thứ bảy) và bữa (sáng, trưa, xế; không có bữa tối); một món một lần trong cùng bữa của ngày.
  - Vòng đời thực đơn: nháp → bếp trình duyệt (cần ít nhất một món; quản lý đơn vị nhận thông báo) → quản lý đơn vị duyệt là công bố ngay (`published`, ghi người duyệt, thời điểm duyệt và công bố) hoặc trả lại kèm lý do về nháp (bếp nhận thông báo). Chỉ sửa món khi nháp; thực đơn đã trình hoặc đã công bố không sửa (mã BR-59). Công bố thì phụ huynh và bếp của đơn vị nhận thông báo trong ứng dụng theo vai trò (phạm vi đơn vị, BR-69). Chưa có thao tác thu hồi thực đơn đã công bố.
  - Phụ huynh xem thực đơn đã công bố của tuần theo đơn vị của con: thực đơn đúng mã khối của lớp, không có thì thực đơn chung; thực đơn nháp, chờ duyệt không trả về (CT-065). Kèm buffet đã duyệt trong tuần của toàn đơn vị hoặc lớp của con.
  - Số suất của một lớp trong ngày: điểm danh đã chốt thì lấy số trẻ có mặt (có mặt, đi muộn, về sớm) theo điểm danh; chưa chốt mà giáo viên chủ nhiệm đã báo cơm thì lấy số báo cơm; chưa báo cơm thì lấy số trẻ có mặt đã lưu trên bảng điểm danh. Số suất của đơn vị là tổng các lớp đang hoạt động; ba bữa sáng, trưa, xế cùng một số (BR-58). Mọi lớp đã chốt thì số suất là chính thức (`final`, nguồn điểm danh), còn lại là tạm tính (`provisional`, nguồn hỗn hợp).
  - Báo cơm (P12-07): giáo viên chủ nhiệm có quyền báo cơm báo số suất mỗi bữa cho lớp mình, ngày học không sau hôm nay, không quá sĩ số đang học; báo lại thì ghi đè; điểm danh của lớp đã chốt thì từ chối mã BR-58 vì số suất theo điểm danh. Bếp của đơn vị nhận thông báo. Báo cơm chỉ là số tạm cho bếp chuẩn bị, không thay điểm danh và không dùng tính tiền ăn.
  - Bếp bấm tính và lưu số suất của một ngày học không sau hôm nay (`meal_plans`, ba dòng theo bữa); lưu lại thì ghi đè. Xem suất ăn trả cả số tính tại thời điểm xem theo từng lớp kèm nguồn và số đã lưu gần nhất.
  - Định lượng (P12-04): định lượng của một thực đơn trong một ngày = định lượng trên một suất × số suất (gửi `servings` hoặc lấy số suất của các lớp dùng thực đơn đó), kèm số thiếu so với tồn. Định lượng của ngày cho cả đơn vị cộng theo các thực đơn đã công bố của tuần; lớp chưa có thực đơn đã công bố được liệt kê.
  - Buffet theo dịp (P12-06): bếp hoặc quản lý đơn vị lập (ngày không trước hôm nay, dịp, toàn đơn vị hoặc một lớp của đơn vị, thực đơn buffet); quản lý đơn vị duyệt thì phụ huynh của đơn vị nhận thông báo; bếp hoặc quản lý đơn vị hủy. Buffet nằm trong tiền ăn, không đăng ký, không thu riêng (BR-83).
  - Phiếu đi chợ (P12-09): bếp lập phiếu nháp theo một nhà cung cấp của đơn vị, từ 1 đến 100 dòng nguyên liệu của đơn vị (số lượng lớn hơn 0, đơn giá nguyên đồng); số phiếu cấp ngay khi lập, dạng `PDC-000001` liên tục toàn trường trong năm học; thành tiền làm tròn đồng. Mỗi dòng lưu định lượng của ngày đi chợ (theo thực đơn đã công bố và số suất lúc lập phiếu) để thấy chênh lệch thực mua so với định lượng (BR-60). Giao diện có nút lấy dòng theo định lượng của ngày.
  - Xác nhận nhập phiếu đi chợ (CT-119): phiếu chuyển sang đã nhập, tồn từng nguyên liệu tăng theo số lượng, phiếu có trạng thái thanh toán `awaiting_payment` (chờ thanh toán) — đó là đề nghị thanh toán; kế toán của đơn vị nhận thông báo. Không lập phiếu chi tự động: kế toán lập phiếu chi theo QT-05 (BR-28) rồi gắn phiếu chi đã phát hành có số tiền bằng tổng phiếu đi chợ (cần `P06.payment.manage` trong đơn vị); một phiếu chi chỉ gắn một phiếu đi chợ; gắn xong phiếu đi chợ thành đã thanh toán. Chỉ hủy được phiếu nháp. Phiếu đi chợ không qua duyệt đề nghị mua hàng theo hạn mức (BR-63 áp cho đề nghị mua hàng của P13).
  - Báo cáo ăn và bếp (P17-08) là một thẻ trong trang Bếp và thực đơn của cổng quản trị (không thêm vào trang Báo cáo chung): theo đơn vị và kỳ tối đa 62 ngày; mỗi ngày có điểm danh hoặc số suất đã lưu thì đối chiếu số suất đã lưu với số trẻ có mặt theo điểm danh đã chốt; khớp khi mọi lớp có điểm danh đã chốt và hai số bằng nhau; chưa lưu hoặc còn lớp chưa chốt thì chưa đối chiếu được; liệt kê ngày lệch để bếp tính lại (CT-081). Chi phí đi chợ của kỳ: số phiếu đã nhập, tổng tiền, đã thanh toán, chờ thanh toán, theo nhà cung cấp, chi phí nguyên liệu trên một suất ngày.
  - Trẻ nghỉ không tính tiền ăn ngày đó (vế sau của CT-064) do tính học phí của G1 bảo đảm: dịch vụ bán trú tính theo ngày có mặt (`per_present_day`, BR-23); phần 10c không đổi cách tính.
  - Mở năm học mới chuyển nhà cung cấp thực phẩm, nguyên liệu kèm tồn hiện tại, món ăn, định lượng, giữ nguyên mã định danh; bước chuyển đăng ký sau bước y tế. Thực đơn, suất ăn, báo cơm, buffet, phiếu đi chợ tra ở năm cũ.
  - Giao diện: trang Bếp và thực đơn (`/kitchen`, nhóm điều hướng mới BẾP) với các thẻ Thực đơn tuần, Suất ăn theo ngày, Món ăn và nguyên liệu, Phiếu đi chợ, Buffet theo dịp, Báo cáo ăn và bếp (thẻ báo cáo chỉ hiện khi có P17.report.kitchen); ứng dụng giáo viên có màn hình Báo cơm (MG-14) mở từ nút trên thẻ lớp; ứng dụng phụ huynh có bảng Thực đơn (MP-15) trong thẻ của trẻ.
- Thành phần bị ảnh hưởng: `07`, `08`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh.
- Dữ liệu bị ảnh hưởng: mười một bảng mới của năm học (tệp `0032_create_kitchen`): `ingredients`, `dishes`, `ingredient_norms`, `menus`, `menu_items`, `meal_reports`, `meal_plans`, `buffet_events`, `food_suppliers`, `market_purchases`, `market_purchase_items`; loại số chứng từ mới `market_purchase` trong `document_sequences`. Không thêm quyền (đã cấp ở tệp 0032 của định danh).
- API bị ảnh hưởng: các điểm cuối P12 và `GET /reports/meals` trong `17`.
- Giao diện bị ảnh hưởng: MH-18, MH-38, MG-14, MP-15; báo cáo ăn và bếp là thẻ trong MH-18.
- Quyền bị ảnh hưởng: PQ-41.
- Ảnh hưởng chức năng cũ: không đổi hành vi G1.
- Kiểm thử cần thực hiện: CT-064, CT-065, CT-081, CT-119.
- Trạng thái: Đã triển khai

## Bảng

Thay mục 13 Phân hệ P12 của `16_CO_SO_DU_LIEU.md`:

| ingredients | Nguyên liệu và tồn của bếp (YCTD-76) | org_unit_id, code (duy nhất trong đơn vị), name, unit, current_stock (không âm, tăng khi nhập phiếu đi chợ), status |
| dishes | Món ăn (YCTD-76) | org_unit_id, name (duy nhất trong đơn vị), group_name (nhóm chất), recipe_note (cách chế biến), status |
| ingredient_norms | Định lượng trên một suất (YCTD-76) | dish_id, ingredient_id (duy nhất cùng dish_id), quantity_per_serving (lớn hơn 0, theo đơn vị tính của nguyên liệu) |
| menus | Thực đơn tuần (YCTD-76) | org_unit_id, week_start_date (thứ hai), age_group (all hoặc mã khối học), status (nháp, chờ duyệt, đã công bố), note, submitted_by, submitted_at, approved_by, approved_at, published_at, reject_reason, created_by |
| menu_items | Món trong thực đơn (YCTD-76) | menu_id, weekday (1 thứ hai đến 6 thứ bảy), meal_type (sáng, trưa, xế), dish_id, note; duy nhất trên menu_id, weekday, meal_type, dish_id |
| meal_reports | Báo cơm của lớp (YCTD-76) | class_id, org_unit_id, report_date (duy nhất cùng class_id), headcount (không quá sĩ số), note, reported_by, reported_at |
| meal_plans | Số suất ăn theo ngày đã lưu (YCTD-76) | org_unit_id, meal_date, meal_type (sáng, trưa, xế), headcount, computed_from (điểm danh, hỗn hợp), status (tạm tính, chính thức), computed_by, computed_at |
| buffet_events | Tiệc buffet theo dịp (YCTD-76) | org_unit_id, buffet_date, occasion, class_id (trống khi toàn đơn vị), menu_note, status (nháp, đã duyệt, đã hủy), created_by, approved_by, approved_at |
| food_suppliers | Nhà cung cấp thực phẩm (YCTD-76; gộp vào `suppliers` khi có danh mục dùng chung) | org_unit_id, name (duy nhất trong đơn vị), food_groups, tax_code, contact_name, phone, address, status |
| market_purchases | Phiếu đi chợ (YCTD-76) | code (PDC-000001, cấp khi lập), org_unit_id, purchase_date, supplier_id (food_suppliers), total_amount, note, status (nháp, đã nhập, đã hủy), payment_status (chờ thanh toán, đã thanh toán; chỉ khi đã nhập), payment_id (phiếu chi đã phát hành, duy nhất), created_by, received_by, received_at, paid_linked_by, paid_linked_at |
| market_purchase_items | Dòng phiếu đi chợ (YCTD-76) | purchase_id, ingredient_id (duy nhất cùng purchase_id), quantity, planned_quantity (định lượng của ngày lúc lập phiếu, BR-60), unit_price, amount |

Ràng buộc duy nhất: `menus` trên bộ ba đơn vị, tuần, độ tuổi; `meal_plans` trên bộ ba đơn vị, ngày, bữa; `meal_reports` trên lớp và ngày.

## Điểm cuối

Thay bảng phần bếp ở mục 15 của `17_DAC_TA_API.md`:

| GET, POST | /api/v1/ingredients | Danh sách nguyên liệu của đơn vị và thêm nguyên liệu |
| PATCH | /api/v1/ingredients/{id} | Sửa tên, đơn vị tính, ngừng hoặc dùng lại nguyên liệu |
| GET, POST | /api/v1/dishes | Món ăn của đơn vị kèm định lượng; thêm món (có thể kèm định lượng) |
| PATCH | /api/v1/dishes/{id} | Sửa món, ngừng hoặc dùng lại |
| PUT | /api/v1/dishes/{id}/norms | Thay toàn bộ định lượng trên một suất của món |
| GET, POST | /api/v1/food-suppliers | Nhà cung cấp thực phẩm của đơn vị |
| PATCH | /api/v1/food-suppliers/{id} | Sửa, ngừng hoặc dùng lại nhà cung cấp thực phẩm |
| GET, POST | /api/v1/menus | Thực đơn tuần của đơn vị; lập thực đơn nháp |
| GET | /api/v1/menus/{id} | Chi tiết thực đơn kèm món |
| PUT | /api/v1/menus/{id}/items | Thay toàn bộ món của thực đơn nháp |
| POST | /api/v1/menus/{id}/submit | Bếp trình duyệt thực đơn |
| POST | /api/v1/menus/{id}/approve | Duyệt và công bố thực đơn |
| POST | /api/v1/menus/{id}/reject | Trả lại thực đơn kèm lý do |
| GET | /api/v1/menus/{id}/norms | Định lượng nguyên liệu của thực đơn trong một ngày theo số suất |
| GET | /api/v1/children/{id}/menus | Thực đơn đã công bố và buffet đã duyệt của tuần cho phụ huynh của trẻ |
| GET | /api/v1/meal-plans | Số suất ăn theo ngày của đơn vị theo từng lớp |
| POST | /api/v1/meal-plans/compute | Tính và lưu số suất ăn của ngày |
| GET | /api/v1/kitchen/daily-norms | Định lượng nguyên liệu của ngày cho cả đơn vị |
| GET, POST | /api/v1/classes/{id}/meal-report | Xem và gửi báo cơm của lớp |
| GET, POST | /api/v1/buffet-events | Tiệc buffet theo dịp |
| POST | /api/v1/buffet-events/{id}/approve | Duyệt buffet |
| POST | /api/v1/buffet-events/{id}/cancel | Hủy buffet |
| GET, POST | /api/v1/market-purchases | Phiếu đi chợ của đơn vị; lập phiếu nháp |
| GET | /api/v1/market-purchases/{id} | Chi tiết phiếu đi chợ kèm chênh lệch với định lượng |
| POST | /api/v1/market-purchases/{id}/receive | Xác nhận nhập nguyên liệu, chuyển đề nghị thanh toán |
| POST | /api/v1/market-purchases/{id}/cancel | Hủy phiếu nháp |
| POST | /api/v1/market-purchases/{id}/link-payment | Kế toán gắn phiếu chi đã phát hành |
| GET | /api/v1/reports/meals | Báo cáo ăn và bếp: đối chiếu suất ăn với điểm danh đã chốt, chi phí đi chợ |

Giao kèo của nhóm điểm cuối bếp, thực đơn, suất ăn, phiếu đi chợ (DT-10 phần 10c):

1. Ghi danh mục bếp, thực đơn, tính suất, phiếu đi chợ cần `P12.kitchen.manage` trong phạm vi đơn vị; đọc cần một trong `P12.kitchen.manage`, `P12.menu.approve`, `P17.report.kitchen` của đơn vị. Các điểm cuối danh sách bắt buộc `org_unit_id`. Ngoài phạm vi trả `ERR_FORBIDDEN`; trùng mã nguyên liệu, tên món, tên nhà cung cấp, thực đơn cùng đơn vị, tuần, độ tuổi trả `ERR_CONFLICT`.
2. `POST /dishes` nhận `org_unit_id`, `name`, `group_name`, `recipe_note`, `norms` (mỗi phần tử `ingredient_id`, `quantity_per_serving` lớn hơn 0, tối đa 50 dòng); `PUT /dishes/{id}/norms` nhận `norms`. Nguyên liệu khác đơn vị hoặc ngừng dùng trả `ERR_RULE_VIOLATION` mã BR-60.
3. `POST /menus` nhận `org_unit_id`, `week_start_date` (thứ hai, sai trả `ERR_VALIDATION`), `age_group` (mặc định `all`, hoặc mã khối học), `note`, `items` (mỗi phần tử `weekday` 1 đến 6, `meal_type` `breakfast`, `lunch`, `snack`, `dish_id` cùng đơn vị, `note`; tối đa 120). `status` là `draft`, `submitted`, `published`.
4. `PUT /menus/{id}/items` chỉ khi `draft`; `submit` chỉ khi `draft` và có món; `approve`, `reject` (nhận `reason` bắt buộc) chỉ khi `submitted` và cần `P12.menu.approve`. Sai trạng thái trả `ERR_RULE_VIOLATION` mã BR-59. Duyệt là công bố.
5. `GET /menus/{id}/norms` nhận `date` trong tuần của thực đơn (mặc định thứ hai) và `servings` (số nguyên 0 đến 5000, mặc định số suất của các lớp dùng thực đơn trong ngày); trả `lines` theo món và `totals` theo nguyên liệu kèm `shortage` so với tồn.
6. `GET /children/{id}/menus` nhận `week_start_date` là một ngày bất kỳ của tuần (mặc định hôm nay); chỉ phụ huynh của trẻ hoặc người đọc dữ liệu bếp của đơn vị; trả `menu` là thực đơn đã công bố đúng mã khối của lớp, không có thì thực đơn chung, không có thì `null`; `buffets` là buffet đã duyệt trong tuần của toàn đơn vị hoặc lớp của trẻ.
7. `GET /meal-plans` nhận `org_unit_id`, `date` (mặc định hôm nay); trả `headcount` (mỗi bữa), `meals` ba bữa, `status` (`final` khi mọi lớp đang hoạt động đã chốt điểm danh, còn lại `provisional`), `computed_from`, `classes` (mỗi lớp `enrolled_count`, `attendance_meal_count`, `meal_report_headcount`, `source` `attendance_locked` | `meal_report` | `attendance_open`, `headcount`) và `stored` là số đã lưu. `POST /meal-plans/compute` nhận `org_unit_id`, `date` (ngày học không sau hôm nay, ngày không phải ngày học trả mã BR-91) và ghi đè số đã lưu.
8. `POST /classes/{id}/meal-report` nhận `date` (mặc định hôm nay, không sau hôm nay, phải là ngày học), `headcount` (số nguyên), `note`; chỉ giáo viên chủ nhiệm đang được phân công có `P12.meal-report.submit`, sai trả `ERR_FORBIDDEN`; quá sĩ số hoặc điểm danh đã chốt trả `ERR_RULE_VIOLATION` mã BR-58. `GET` cho giáo viên chủ nhiệm hoặc người đọc dữ liệu bếp.
9. `POST /buffet-events` nhận `org_unit_id`, `buffet_date` (không trước hôm nay), `occasion`, `class_id` (trống là toàn đơn vị), `menu_note`; cần `P12.kitchen.manage` hoặc `P12.menu.approve`. `approve` cần `P12.menu.approve`, chỉ khi `draft`; `cancel` cần một trong hai quyền. Sai trạng thái trả mã P12-06.
10. `POST /market-purchases` nhận `org_unit_id`, `purchase_date`, `supplier_id` (nhà cung cấp thực phẩm cùng đơn vị đang dùng), `note`, `items` (1 đến 100 dòng, mỗi dòng `ingredient_id`, `quantity` lớn hơn 0, `unit_price` nguyên đồng không âm; mỗi nguyên liệu một dòng); trả `code` dạng `PDC-000001`, `total_amount`, mỗi dòng có `planned_quantity` và `difference`.
11. `receive` chỉ khi `draft`: `status` thành `received`, `payment_status` thành `awaiting_payment`, tồn nguyên liệu tăng, kế toán (VT-04) của đơn vị nhận thông báo; `cancel` chỉ khi `draft`. Sai trạng thái trả mã P12-09. `GET /market-purchases` lọc `status`, `payment_status=awaiting_payment`; người có `P06.payment.manage` của đơn vị cũng đọc được.
12. `link-payment` nhận `payment_id`; cần `P06.payment.manage` trong đơn vị; phiếu đi chợ phải chờ thanh toán, phiếu chi đã phát hành, số tiền bằng `total_amount`, chưa gắn phiếu đi chợ khác, sai trả `ERR_RULE_VIOLATION` mã BR-28; xong thì `payment_status` thành `paid`.
13. `GET /reports/meals` nhận `org_unit_id`, `from`, `to` (mặc định đầu tháng đến hôm nay, tối đa 62 ngày); cần `P17.report.kitchen` trong đơn vị. Trả `days` (mỗi ngày `class_count`, `locked_class_count`, `attendance_locked`, `attendance_meal_count` theo điểm danh đã chốt, `absent_count`, `meal_headcount` đã lưu, `meal_plan_status`, `matched` là `true`, `false` hoặc `null` khi chưa đối chiếu được), `mismatched_days`, `total_meal_days`, `purchases` (`count`, `total_amount`, `awaiting_payment_amount`, `paid_amount`, `by_supplier`) và `cost_per_meal_day`.
14. Mọi thao tác ghi ghi `audit_logs` kèm giá trị trước và sau (QU-04).

## Màn hình

Dòng thay thế trong `14_DAC_TA_GIAO_DIEN.md`:

| MH-18 | Bếp và thực đơn: thực đơn tuần (lập, thêm món theo thứ và bữa, trình duyệt; quản lý đơn vị duyệt và công bố hoặc trả lại), định lượng theo ngày, suất ăn theo ngày theo lớp và tính lưu số suất, món ăn, nguyên liệu, định lượng trên một suất, buffet theo dịp, thẻ báo cáo ăn và bếp (YCTD-76) | VT-10, VT-03; VT-04 xem |
| MH-38 | Phiếu đi chợ và nhà cung cấp thực phẩm: thẻ trong trang Bếp và thực đơn; lập phiếu theo định lượng của ngày, xác nhận nhập, chênh lệch với định lượng, kế toán gắn phiếu chi (YCTD-76) | VT-10; VT-04 gắn phiếu chi |
| MG-14 | Báo cơm của lớp: sĩ số, số trẻ có mặt theo điểm danh đã lưu, gửi số suất cho bếp khi chưa chốt điểm danh (YCTD-76) | VT-07 chủ nhiệm |
| MP-15 | Thực đơn: thực đơn tuần đã công bố theo độ tuổi của lớp, buffet đã duyệt trong tuần (YCTD-76) | VT-14 |

## Quyền

| PQ-41 | Bếp và thực đơn (YCTD-76): `P12.kitchen.manage` cho VT-10 quản lý nguyên liệu, món, định lượng, thực đơn nháp, tính suất ăn, buffet, nhà cung cấp thực phẩm, phiếu đi chợ trong đơn vị; `P12.menu.approve` cho VT-03 duyệt và công bố thực đơn, duyệt buffet trong đơn vị; `P12.meal-report.submit` cho VT-07 báo cơm lớp mình chủ nhiệm; `P17.report.kitchen` cho VT-10, VT-04 xem báo cáo ăn và bếp; kế toán có `P06.payment.manage` gắn phiếu chi cho phiếu đi chợ chờ thanh toán; phụ huynh chỉ xem thực đơn đã công bố của con |

## Kết quả kiểm thử

Kiểm thử máy chủ `apps/api/src/kitchen/kitchen.test.ts`: 7 ca, đạt 7.

- CT-064: Đạt — ca "P12-07, CT-064": 32 trẻ, 30 có mặt (28 có mặt, 2 đi muộn), 2 nghỉ; chốt điểm danh thì mỗi bữa sáng, trưa, xế 30 suất. Vế "hai trẻ nghỉ không tính tiền ăn" do tính học phí G1 (dịch vụ bán trú theo ngày có mặt, BR-23) bảo đảm.
- CT-065: Đạt — ca "P12-02, P12-03, CT-065" (máy chủ) và `tests/e2e/32-kitchen.spec.ts` (giao diện, người điều phối chạy).
- CT-119: Đạt — ca "P12-09, CT-119": tồn gạo, thịt tăng; phiếu chờ thanh toán; kế toán nhận thông báo đề nghị thanh toán; gắn phiếu chi đúng số tiền.
- CT-081: Đạt — ca "P17-08, CT-081": số lưu khi chưa chốt (31) bị báo lệch; tính lại sau khi chốt thì 30 khớp 30.

Kiểm thử giao diện `tests/e2e/32-kitchen.spec.ts`: bếp lập thực đơn, thêm món, trình duyệt; phụ huynh chưa thấy; quản lý đơn vị duyệt và công bố; phụ huynh thấy món. Chưa chạy (người điều phối chạy).

## Quy tắc

Đề xuất bổ sung ghi chú cho BR-58 trong `07_QUY_TAC_NGHIEP_VU.md`: "Số suất của lớp trong ngày lấy theo điểm danh đã chốt; trước khi chốt, bếp dùng báo cơm của giáo viên chủ nhiệm hoặc số trẻ có mặt đã lưu làm số tạm; báo cáo ăn và bếp đối chiếu số suất đã lưu với điểm danh đã chốt (YCTD-76)."
