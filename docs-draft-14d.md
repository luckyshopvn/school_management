# Nháp tài liệu DT-14 phần 14d — Hồ sơ trường, cơ sở vật chất, thiết bị dạy học, báo cáo EMIS (YCTD-102)

## YCTD

### YCTD-102: Hồ sơ trường, khai báo cơ sở vật chất, thiết bị dạy học tối thiểu, báo cáo EMIS đầu năm – 2026-10-14

- Lý do: Eric yêu cầu ngày 2026-10-13, làm theo hệ thống quản lý trường học của Sở GD&ĐT TP.HCM (tài liệu 31): mục 3.1 dòng 1.1 (hồ sơ trường) và dòng 1.5 (đơn vị quản lý), mục 4 (phân hệ cơ sở vật chất, thiết bị dạy học: 1.1, 1.2, 2.1, 2.2), mục 5 dòng 1.1 (báo cáo EMIS đầu năm). Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi:
  - Hồ sơ trường (màn hình “1.1 Hồ sơ trường”): một hồ sơ mỗi năm học, gắn với Trường chính, sáu thẻ: Thông tin chung (cơ sở giáo dục mầm non, loại hình trường công lập, tư thục, dân lập, mã định danh, mã định danh điện tử, mã số thuế, tên theo quyết định thành lập, hiệu trưởng, điện thoại, địa chỉ, fax, thư điện tử, trang thông tin điện tử, diện tích đất, diện tích xây dựng, quyết định thành lập gồm số, ngày, cơ quan cấp, số giấy chứng nhận, lần thay đổi, chương trình giáo dục, và bốn trường của mục 1.5: đơn vị quản lý, Ủy ban nhân dân quản lý, tỉnh, thành phố, phường, xã); Thông tin khác (28 ô tích tiêu chí theo khảo sát); Trường có yếu tố nước ngoài; Kết nối internet; Hạ tầng, thiết bị, ứng dụng CNTT (số phòng máy, máy tính quản lý, máy để bàn, xách tay, máy tính bảng, máy chiếu, ti vi thông minh, phần mềm đang dùng); Tài khoản văn phòng điện tử (bảng nhiều dòng: tên tài khoản bắt buộc, người sử dụng, chức vụ, thư điện tử; không lưu mật khẩu). Danh sách trường của từng thẻ cố định trong gói dùng chung; máy chủ từ chối trường lạ, kiểu sai (số âm, số lẻ ở ô số nguyên, ngày không đúng dạng YYYY-MM-DD, giá trị chọn ngoài danh sách, chữ quá 500 ký tự). Nút “Ghi” gửi cả sáu thẻ; thẻ không gửi giữ nguyên, thẻ gửi thì thay toàn bộ (ô để trống bị xóa). Mỗi lần ghi ghi nhật ký thao tác.
  - Khai báo cơ sở vật chất (màn hình “1.1 Khai báo cơ sở vật chất”): mở rộng danh mục phòng học hiện có (`rooms`) với khối phòng (năm khối: nuôi dưỡng, chăm sóc và giáo dục trẻ; tổ chức ăn; phụ trợ; hành chính quản trị; khác), loại phòng (24 loại, mỗi loại thuộc một khối; loại phải thuộc khối đã chọn, khi sửa chỉ một trong hai thì so với giá trị đang lưu), hiện trạng (kiên cố, bán kiên cố, tạm, nhờ mượn thuê), diện tích (m², hai chữ số thập phân) và thuộc tính theo quy chuẩn (số chỗ ngủ, chiều cao thông thủy, kích thước sàn tập, số chỗ nhà ăn, vệ sinh khép kín hoặc liền kề, phòng đọc, sân chơi riêng, sân vườn khám phá, phòng học kết hợp nghỉ trưa, kho sách, số chỗ thư viện). Các trường mới không bắt buộc để phòng đã có vẫn dùng được. Danh sách gộp phòng của mọi đơn vị trong phạm vi, lọc đơn vị, khối, loại, hiện trạng, trạng thái; cột nhóm, lớp lấy từ lớp đang hoạt động gắn phòng. Bảng tổng hợp (theo dòng 1.2 của khảo sát) đếm phòng đang dùng theo khối và hiện trạng kèm tổng diện tích, phòng chưa chọn khối vào dòng “Chưa phân khối”. Thêm, sửa phòng vẫn qua `/rooms` với quyền cũ `P01.room.manage`. Xuất Excel hai trang (danh sách phòng, tổng hợp).
  - Thiết bị dạy học (màn hình “2.1 Tổng hợp thiết bị dạy học”):
    - Danh mục thiết bị dùng chung toàn trường, hai loại: danh mục tối thiểu (có định mức) và thiết bị ngoài danh mục (thẻ “2.2 Thiết bị ngoài danh mục tối thiểu”: tên, nhóm, loại thiết bị, đơn vị tính, nhóm tuổi, đối tượng sử dụng, số lượng một nhóm áp dụng). Mỗi thiết bị có nhóm tuổi (sáu nhóm theo Thông tư 02/2010/TT-BGDĐT, sửa đổi bởi Thông tư 34/2013/TT-BGDĐT: nhà trẻ 3–12, 12–24, 24–36 tháng; mẫu giáo 3–4, 4–5, 5–6 tuổi), nhóm thiết bị (đồ dùng; thiết bị dạy học, đồ chơi và học liệu; sách, tài liệu, băng đĩa), lĩnh vực phát triển (thay cho “môn học” của cấp phổ thông), định mức tính theo nhóm, lớp hoặc theo học sinh.
    - Gieo sẵn 56 thiết bị tối thiểu (khoảng chín, mười thiết bị mỗi nhóm tuổi) chỉ gồm tên ngắn và số lượng gợi ý, ghi chú **“Cần đối chiếu văn bản”**; không chép nội dung văn bản. Người có quyền quản lý thiết bị ở phạm vi toàn trường (Hiệu trưởng) sửa định mức, tên, ghi chú, ngừng hoặc dùng lại thiết bị, thêm thiết bị (mã tự đánh `TT-0001` cho danh mục tối thiểu, `NDM-0001` cho ngoài danh mục nếu không nhập).
    - Nhóm tuổi của lớp suy từ khối (bậc học) của lớp: lấy tháng tuổi giữa khoảng “từ – đến” của bậc học rồi xếp vào nhóm tuổi (ví dụ khối 18–36 tháng là nhà trẻ 24–36 tháng, khối 60–72 tháng là mẫu giáo 5–6 tuổi). Lớp có khối không có trong danh mục bậc học không tính định mức và được liệt kê để sửa.
    - Số lượng hiện có nhập tay theo đơn vị (kho chung) hoặc theo lớp; ghi lại thì thay số cũ. Nhu cầu bổ sung năm sau chỉ nhập ở dòng của đơn vị. Tài sản (P13) gắn với một thiết bị (`POST /equipment-assets`) được cộng một đơn vị vào số hiện có khi còn dùng được (trong kho, đã cấp phát, đang cho mượn); tài sản cấp phát cho lớp tính vào lớp đó; tài sản đã thanh lý không gắn được.
    - Quy tắc tính: định mức của một thiết bị = số lượng một nhóm, lớp × số nhóm, lớp đang hoạt động cùng nhóm tuổi; thiết bị tính theo học sinh thì = số lượng × sĩ số (học sinh đang học, lớp hiện tại) của từng lớp, làm tròn lên từng lớp. Hiện có = số nhập tay + số tài sản gắn. Thừa = hiện có vượt định mức; thiếu = định mức chưa có; tỷ lệ đáp ứng = min(hiện có, định mức) / định mức, tối đa 100%, một chữ số thập phân. Nhu cầu bổ sung năm sau = số nhập tay nếu có, nếu không bằng số thiếu. Thiết bị ngoài danh mục không có định mức, chỉ hiện số hiện có và nhu cầu nhập tay. Lọc theo lớp thì chỉ tính số nhập cho lớp và tài sản đặt tại lớp. Tỷ lệ đáp ứng chung và theo lớp tính trên các thiết bị tối thiểu.
    - Lọc theo đơn vị, nhóm tuổi, nhóm thiết bị, lĩnh vực phát triển, lớp, loại danh mục; xuất Excel hai trang (tổng hợp thiết bị, theo lớp).
  - Báo cáo EMIS đầu năm (màn hình “1.1 Báo cáo EMIS đầu năm”): Biểu 1 năm thẻ tính tại thời điểm xem từ dữ liệu của năm học đang dùng: Trường – lớp học; Học sinh; Học sinh theo độ tuổi; Đội ngũ; Phòng học. Cột: chỉ tiêu, đơn vị, mã số, tổng số, công lập, tư thục, dân lập, nữ, dân tộc thiểu số. Cả số của trường vào cột theo loại hình trong hồ sơ trường, hai cột còn lại là 0; chưa khai báo loại hình thì ba cột để trống và có cảnh báo. Chỉ tiêu (mã số do hệ thống đánh theo thẻ, **cần đối chiếu danh mục chỉ tiêu EMIS chính thức**):
    - 1.01 số trường, 1.02 số phân hiệu, 1.03 số điểm trường (đơn vị đang hoạt động), 1.04 tổng số nhóm, lớp, 1.05 nhóm trẻ, 1.06 lớp mẫu giáo, 1.07 trong đó lớp mẫu giáo 5–6 tuổi, 1.08 nhóm, lớp chưa xếp được nhóm tuổi;
    - 2.01 tổng số học sinh (trạng thái đang học), 2.02 nhà trẻ, 2.03 mẫu giáo, 2.04 trong đó mẫu giáo 5–6 tuổi, 2.05 học sinh khuyết tật học hòa nhập (có loại khuyết tật khác “Không” trong hồ sơ nhập từ CSDL ngành); nhà trẻ hay mẫu giáo theo nhóm tuổi của lớp hiện tại, chưa có lớp thì theo tuổi;
    - 3.01 đến 3.07 học sinh dưới 1 tuổi, 1, 2, 3, 4, 5 tuổi, từ 6 tuổi trở lên; tuổi = năm bắt đầu năm học − năm sinh;
    - 4.01 tổng số cán bộ quản lý, giáo viên, nhân viên (nhân sự đang làm việc), 4.02 cán bộ quản lý, 4.03 giáo viên, 4.04 nhân viên, 4.05 trong tổng số đảng viên; phân loại theo nhóm chức vụ của tệp CSDL ngành, không có thì theo tên chức danh (có “hiệu trưởng” là cán bộ quản lý, có “giáo viên” là giáo viên, còn lại là nhân viên);
    - 5.01 tổng số phòng đang dùng, 5.02 đến 5.06 theo hiện trạng (kiên cố, bán kiên cố, tạm, nhờ mượn thuê, chưa khai báo), 5.07 phòng sinh hoạt chung, 5.08 phòng giáo dục thể chất, 5.09 phòng giáo dục nghệ thuật, 5.10 bếp ăn, 5.11 tổng diện tích các phòng (m²).
    - Nữ theo giới tính; dân tộc thiểu số là có ghi dân tộc (từ tệp CSDL ngành) và không phải dân tộc Kinh. Xuất Excel năm trang theo năm thẻ, mỗi trang có dòng tiêu đề, tên trường, năm học và lưu ý đối chiếu. Không gửi lên Sở (chưa có giao diện lập trình của Sở).
  - Xuất Excel của phần này: người xem được báo cáo thì xuất được, không cần `P17.data.export`; mỗi lần xuất ghi một dòng nhật ký xuất (`export_logs`, mã `facility-rooms`, `equipment-summary`, `emis-start-of-year`, không có dữ liệu cá nhân) theo BR-74.
  - Mở năm học mới: phòng kèm khối, loại, hiện trạng, diện tích, thuộc tính chuyển ở bước danh mục; bước chuyển mới `facilities` (sau bước danh mục, trước bước kho) thay danh mục thiết bị gieo sẵn của năm mới bằng danh mục của năm cũ (giữ mã định danh và chỉnh sửa), chuyển số hiện có theo đơn vị (số nhập theo lớp cộng vào dòng của đơn vị vì lớp không chuyển; nhu cầu năm sau để trống) và chuyển hồ sơ trường.
- Thành phần bị ảnh hưởng: `05`, `07`, `08`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị.
- Dữ liệu bị ảnh hưởng: ba bảng mới và cột mới của `rooms`, `assets` trong cơ sở dữ liệu năm học (tệp 0049); bốn quyền mới (tệp 0039 của định danh).
- API bị ảnh hưởng: `/school-profile`, `/facilities/rooms`, `/equipment-items`, `/equipment-holdings`, `/equipment-assets`, `/equipment-report`, `/reports/emis/start-of-year`; `POST /rooms`, `PATCH /rooms/{id}`, `GET /rooms` thêm trường khối phòng, loại phòng, hiện trạng, diện tích, thuộc tính.
- Giao diện bị ảnh hưởng: bốn màn hình mới trên cổng quản trị; thanh điều hướng thêm nhóm CƠ SỞ VẬT CHẤT (thuộc phân hệ Cơ sở vật chất), mục “1.1 Hồ sơ trường” ở nhóm THIẾT LẬP, mục “1.1 Biểu EMIS đầu năm” ở nhóm BÁO CÁO.
- Quyền bị ảnh hưởng: PQ mới (xem mục Quyền).
- Ảnh hưởng chức năng cũ: danh mục phòng học giữ nguyên hành vi, chỉ thêm trường không bắt buộc.
- Kiểm thử cần thực hiện: CT-14d-1 đến CT-14d-10; kiểm thử giao diện `tests/e2e/50-facilities-emis.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

| equipment_items | Danh mục thiết bị dạy học dùng chung toàn trường (YCTD-102); gieo sẵn 56 thiết bị tối thiểu ghi chú “Cần đối chiếu văn bản” | code (duy nhất), name, unit, equipment_group (do_dung, thiet_bi_do_choi, sach_tai_lieu), development_area, age_group (nt_3_12, nt_12_24, nt_24_36, mg_3_4, mg_4_5, mg_5_6), quantity, norm_basis (class, child), target_users (tre, giao_vien, tre_giao_vien), equipment_type, is_minimum, is_seeded, order_no, status, note, created_by |
| equipment_holdings | Số lượng hiện có nhập tay theo đơn vị (class_id trống) hoặc theo lớp; duy nhất theo thiết bị, đơn vị, lớp | equipment_item_id, org_unit_id, class_id, quantity, next_year_need (chỉ dòng của đơn vị), note, updated_by |
| school_profiles | Hồ sơ trường của Trường chính, một dòng mỗi năm học; mỗi thẻ một cột jsonb khóa cố định | org_unit_id (duy nhất), general, other_info, foreign_elements, internet, it_infrastructure, office_accounts (mảng), updated_by |
| rooms (thêm cột) | Khai báo cơ sở vật chất | room_block (care_education, meal, support, administration, other), room_type, condition (permanent, semi_permanent, temporary, borrowed), area_m2, facility_attributes (jsonb khóa cố định) |
| assets (thêm cột) | Tài sản tính vào số hiện có của thiết bị | equipment_item_id |

## Điểm cuối

| GET, PUT | /api/v1/school-profile | Đọc hồ sơ trường (kèm Trường chính); ghi các thẻ gửi lên (`general`, `other_info`, `foreign_elements`, `internet`, `it_infrastructure`, `office_accounts`) |
| GET | /api/v1/facilities/rooms | Phòng của các đơn vị trong phạm vi kèm tổng hợp theo khối và hiện trạng (lọc org_unit_id, room_block, room_type, condition, status) |
| POST | /api/v1/facilities/rooms/export | Xuất Excel danh sách phòng và tổng hợp, ghi nhật ký xuất |
| POST, PATCH | /api/v1/rooms, /api/v1/rooms/{id} | Thêm trường room_block, room_type, condition, area_m2, facility_attributes |
| GET, POST | /api/v1/equipment-items | Danh mục thiết bị (lọc age_group, is_minimum); thêm thiết bị |
| PATCH | /api/v1/equipment-items/{id} | Sửa thiết bị, ngừng hoặc dùng lại |
| GET, PUT | /api/v1/equipment-holdings | Số hiện có của một đơn vị (org_unit_id); ghi nhiều dòng (`org_unit_id`, `items`: equipment_item_id, class_id, quantity, next_year_need, note; 1 đến 500 dòng) |
| POST | /api/v1/equipment-assets | Gắn hoặc bỏ gắn tài sản với thiết bị (`asset_id`, `equipment_item_id` hoặc trống) |
| GET | /api/v1/equipment-report | Tổng hợp thiết bị dạy học (lọc org_unit_id, class_id, age_group, equipment_group, development_area, is_minimum) |
| POST | /api/v1/equipment-report/export | Xuất Excel tổng hợp thiết bị, ghi nhật ký xuất |
| GET | /api/v1/reports/emis/start-of-year | Biểu 1 EMIS đầu năm: năm thẻ, cảnh báo |
| POST | /api/v1/reports/emis/start-of-year/export | Xuất Excel năm trang, ghi nhật ký xuất |

Vi phạm quy tắc nghiệp vụ của phần này trả `ERR_RULE_VIOLATION` với mã `YCTD-102` (ghi số lượng hoặc gắn tài sản cho thiết bị ngừng dùng, gắn tài sản đã thanh lý). Ghi số hiện có cho đơn vị ngừng sử dụng trả BR-75.

## Màn hình

| MH mới | 1.1 Hồ sơ trường (nhóm THIẾT LẬP, `/school-profile`): sáu thẻ, nút Ghi, bảng tài khoản văn phòng điện tử thêm, xóa dòng | VT-02 ghi; VT-15 (quyền EMIS) xem |
| MH mới | 1.1 Khai báo cơ sở vật chất (nhóm CƠ SỞ VẬT CHẤT, `/facility-rooms`): thẻ năm khối phòng, lọc đơn vị, loại phòng, hiện trạng, thêm và sửa phòng kèm thuộc tính, bảng tổng hợp, Xuất Excel | VT-02, VT-03 thêm, sửa; VT-15, VT-11 xem |
| MH mới | 2.1 Tổng hợp thiết bị dạy học (nhóm CƠ SỞ VẬT CHẤT, `/equipment`): thẻ Tổng hợp (lọc, tỷ lệ đáp ứng chung, Xuất Excel), Nhập số hiện có (theo đơn vị hoặc lớp), 2.2 Thiết bị ngoài danh mục tối thiểu, Danh mục tối thiểu (sửa định mức) | VT-02 sửa danh mục; VT-02, VT-03, VT-11 nhập số hiện có; VT-15 xem |
| MH mới | 1.1 Báo cáo EMIS đầu năm (nhóm BÁO CÁO, mục “1.1 Biểu EMIS đầu năm”, `/emis`): năm thẻ của Biểu 1, cảnh báo, Xuất Excel | VT-02, VT-15 (phạm vi toàn trường) |

Số MH do người điều phối đánh khi gộp tài liệu. Tên mục trên thanh điều hướng của báo cáo EMIS là “1.1 Biểu EMIS đầu năm” để không chứa chữ “Báo cáo” của mục báo cáo hiện có (kiểm thử giao diện tìm mục theo chữ).

## Quyền

| PQ mới | Thiết bị dạy học (YCTD-102): `P13.equipment.manage` cho VT-02, VT-03, VT-11: nhập số hiện có, gắn tài sản trong phạm vi đơn vị; sửa danh mục thiết bị (thêm, sửa, ngừng) cần phạm vi toàn trường (VT-02, hoặc VT-11 gán ở Trường chính) |
| PQ mới | Báo cáo cơ sở vật chất (YCTD-102): `P17.report.facilities` cho VT-02, VT-15, VT-03, VT-11: xem, xuất tổng hợp thiết bị dạy học và khai báo cơ sở vật chất trong phạm vi đơn vị; người có `P01.room.manage` cũng xem được khai báo cơ sở vật chất |
| PQ mới | Hồ sơ trường (YCTD-102): `P01.school-profile.manage` cho VT-02, ghi cần phạm vi toàn trường; người có quyền EMIS xem được hồ sơ |
| PQ mới | Báo cáo EMIS (YCTD-102): `P17.report.emis` cho VT-02, VT-15; cần phạm vi toàn trường (gán ở Trường chính) |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/facilities/facilities.test.ts` ngày 14/10/2026:

- CT-14d-1: Hàm tính với hai lớp Lá (25 và 20 học sinh), một lớp Mầm, thiết bị tính theo học sinh, theo lớp, ngoài danh mục, số nhập theo đơn vị và theo lớp, một tài sản; lọc một lớp; tổng hợp phòng; dân tộc, nhóm nhân sự, chỉ tiêu EMIS: định mức 23, hiện có 24, thừa 1, tỷ lệ 100%, nhu cầu lấy số nhập tay hoặc số thiếu, thiết bị ngoài danh mục không có định mức, lớp Lá 1 đáp ứng 72,2%, lọc lớp chỉ tính số của lớp; khối 18–36 tháng là nhà trẻ 24–36 tháng; Kinh không là dân tộc thiểu số; cột tư thục nhận cả số khi trường tư thục, chưa khai báo loại hình thì để trống và cảnh báo — đạt.
- CT-14d-2: Thêm phòng có khối, loại, hiện trạng, diện tích, thuộc tính; loại không thuộc khối; thuộc tính lạ; hiện trạng sai; sửa chỉ loại phòng hoặc chỉ khối phòng không khớp giá trị đang lưu; sửa thuộc tính và diện tích: thêm được, đọc lại đúng; lỗi dữ liệu bốn trường hợp; lỗi dữ liệu hai trường hợp; sửa được, loại phòng giữ nguyên — đạt.
- CT-14d-3: Hiệu trưởng xem danh sách cơ sở vật chất, lọc khối, loại, hiện trạng, giá trị lọc sai; quản lý PH-A xem; giáo viên xem; xuất Excel khối nuôi dưỡng: 4 phòng, cột nhóm lớp, tổng hợp 3 phòng đang dùng (1 kiên cố, 1 bán kiên cố, 1 chưa khai báo, 82,75 m²); lọc đúng; lỗi dữ liệu; danh sách trống, đơn vị khác bị từ chối; bị từ chối; tệp có trang danh sách và tổng hợp, nhật ký xuất 7 dòng — đạt.
- CT-14d-4: Xem danh mục gieo sẵn; giáo viên xem; quản lý đơn vị thêm thiết bị; Hiệu trưởng thêm thiết bị ngoài danh mục, giá trị sai, trùng mã; thủ kho xem thiết bị ngoài danh mục; Hiệu trưởng sửa định mức, quản lý đơn vị sửa: thiết bị gieo sẵn là danh mục tối thiểu ghi “Cần đối chiếu văn bản”; bị từ chối; bị từ chối; thêm được mã NDM, lỗi dữ liệu, xung đột; thấy đúng một thiết bị; sửa được, bị từ chối, nhật ký thao tác 2 dòng — đạt.
- CT-14d-5: Quản lý PH-A ghi số hiện có theo đơn vị và theo lớp, ghi lại; ghi cho đơn vị khác; lớp của đơn vị khác; nhu cầu ở dòng lớp; giáo viên ghi; thiết bị ngừng dùng; thủ kho gắn tài sản, quản lý đơn vị khác gắn: ghi 4 dòng, thay số cũ; bị từ chối; lỗi dữ liệu; lỗi dữ liệu; bị từ chối; trả YCTD-102; gắn được, bị từ chối — đạt.
- CT-14d-6: Tổng hợp thiết bị mẫu giáo 5–6 tuổi của PH-A; lọc lớp Lá; lớp, đơn vị ngoài phạm vi; giáo viên; Phó Hiệu trưởng PH-A; xuất Excel: giá đồ chơi định mức 4, hiện có 6, thừa 2; bàn định mức 1 có 1 tài sản, nhu cầu nhập tay 2; thiết bị ngoài danh mục không có định mức; lớp chưa xếp nhóm tuổi được liệt kê; lọc lớp chỉ tính số của lớp; bị từ chối; bị từ chối; xem được; tệp hai trang, nhật ký xuất đúng đơn vị, không có dữ liệu cá nhân — đạt.
- CT-14d-7: Đọc hồ sơ chưa ghi; Hiệu trưởng Ghi sáu thẻ; ghi một thẻ; bảy trường hợp sai (trường lạ, kiểu sai, số lẻ, giá trị chọn sai, ngày sai dạng, mật khẩu trong tài khoản, thẻ lạ); quản lý đơn vị, Phó Hiệu trưởng ghi; Phó Hiệu trưởng, giáo viên đọc: thẻ trống kèm Trường chính; ghi được, đọc lại đúng; thẻ khác giữ nguyên; lỗi dữ liệu cả bảy; bị từ chối; đọc được, bị từ chối; nhật ký thao tác tạo rồi sửa — đạt.
- CT-14d-8: Phó Hiệu trưởng PH-A, quản lý đơn vị xem EMIS; Phó Hiệu trưởng toàn trường xem; xuất Excel: bị từ chối; năm học bắt đầu 2026, loại hình tư thục, 1 trường, 1 phân hiệu, 1 điểm trường, 4 nhóm lớp (1 nhà trẻ, 2 mẫu giáo, 1 lớp 5–6 tuổi, 1 chưa xếp), 3 học sinh đang học (2 nữ, 1 dân tộc thiểu số, 1 khuyết tật), theo tuổi 2, 3, 5 tuổi, 3 nhân sự (1 quản lý, 1 giáo viên, 1 nhân viên, 1 đảng viên), 3 phòng đang dùng, 82,75 m², cột tư thục bằng tổng số; tệp năm trang đúng cột — đạt.
- CT-14d-9: Mở năm học mới: hồ sơ trường, khai báo phòng (khối, hiện trạng, diện tích, thuộc tính), danh mục thiết bị đã sửa (cùng mã định danh), số hiện có chuyển sang; số theo lớp cộng vào dòng đơn vị (4 + 2 = 6), nhu cầu năm sau để trống — đạt.

Kiểm thử giao diện `tests/e2e/50-facilities-emis.spec.ts`:

- CT-14d-10: Hiệu trưởng ghi hồ sơ trường (loại hình, tên, diện tích, một tiêu chí), thêm phòng khối nuôi dưỡng có thuộc tính, nhập số hiện có một thiết bị, xem tổng hợp và danh mục tối thiểu, xem và xuất báo cáo EMIS: hồ sơ đọc lại đúng sau tải lại trang; phòng hiện trong danh sách lọc kiên cố kèm số chỗ ngủ; tổng hợp có thiết bị vừa nhập; danh mục ghi “Cần đối chiếu văn bản”; tệp EMIS năm trang — đạt.

Cả bộ 570 ca kiểm thử của máy chủ API đạt (kể cả kiểm thử chuyển năm học, danh mục phòng học, kho và tài sản); cả bộ 68 ca kiểm thử giao diện đạt ngày 14/10/2026.

## Hạn chế

- Danh mục thiết bị tối thiểu gieo sẵn chỉ là một phần (56 thiết bị), tên ngắn và số lượng gợi ý do Claude đặt, **cần đối chiếu văn bản** (Thông tư 02/2010/TT-BGDĐT sửa đổi bởi Thông tư 34/2013/TT-BGDĐT hoặc văn bản thay thế hiện hành) rồi Hiệu trưởng chỉnh, bổ sung trên màn hình. Chưa có nhập danh mục từ Excel.
- Báo cáo EMIS: mã số và tên chỉ tiêu do hệ thống đặt, **cần đối chiếu danh mục chỉ tiêu EMIS chính thức** của Bộ; chưa có thẻ Ngân sách nhà nước, chưa có biểu cuối năm, báo cáo đội ngũ, báo cáo sức khỏe; chưa gửi lên Sở (chưa có giao diện lập trình), chưa lưu lại số đã nộp; số liệu tính tại thời điểm xem.
- Dân tộc, khuyết tật, nhóm chức vụ, đảng viên chỉ có khi hồ sơ nhập từ tệp CSDL ngành (YCTD-100); hồ sơ nhập tay không có các trường này nên cột dân tộc thiểu số, dòng khuyết tật, đảng viên có thể thiếu. Phân loại cán bộ quản lý, giáo viên, nhân viên theo chữ trong nhóm chức vụ hoặc tên chức danh.
- Tuổi học sinh tính theo năm sinh (năm bắt đầu năm học − năm sinh), không theo ngày sinh cụ thể.
- Nhóm tuổi của lớp suy từ tháng tuổi giữa khoảng của bậc học; bậc học khai báo khoảng tuổi rộng có thể xếp nhóm tuổi chưa đúng ý.
- Báo cáo cơ sở vật chất (dòng 1.2) chỉ có bảng tổng hợp theo khối và hiện trạng; chưa có mức độ đạt chuẩn, nhu cầu đầu tư (6.1), nhà vệ sinh, gửi lên cấp trên; chưa có nhập phòng từ Excel.
- Gắn tài sản với thiết bị chỉ qua giao diện lập trình (`POST /equipment-assets`), màn hình Kho và tài sản chưa có ô chọn thiết bị.
- Mục 1.2, 1.3 (phân hiệu, điểm trường) dùng cây đơn vị hiện có; khoảng cách đến cơ sở chính, diện tích của điểm trường chưa có.
- Kiểm thử chạy với cơ sở dữ liệu định danh riêng (`school_identity_dt14d`) để không chạy tệp 0039 trên cơ sở dữ liệu định danh dùng chung khi tệp 0036 đến 0038 của nhánh khác chưa gộp (Kysely từ chối tệp thay đổi cấu trúc chạy không theo thứ tự).
