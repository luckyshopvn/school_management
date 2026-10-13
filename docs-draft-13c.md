# Bản nháp tài liệu DT-13 phần 13c: báo cáo điểm danh và suất ăn (YCTD-100)

## Tóm tắt

- Báo cáo "Điểm danh và suất ăn" trên cổng quản trị (Báo cáo, thẻ "Điểm danh và suất ăn"): chọn kỳ Ngày, Tuần, Tháng; lọc đơn vị, lớp; bảng theo lớp nhóm theo khối (Khối Nhà trẻ, các khối mẫu giáo, Khối Mẫu giáo, Toàn trường) với sĩ số, có mặt, vắng P, K, B, chưa điểm danh, suất ăn, tỷ lệ và số có mặt từng ngày; chọn một lớp thì xem thêm bảng mã từng trẻ.
- Nút "Xuất Excel" tải tệp theo mẫu điểm danh của nhà trường: bảng `Data`, `Tổng hợp`, `Tổng hợp tháng` (kỳ tuần là `Tổng hợp tuần`, kỳ ngày là `Tổng hợp ngày`) và một bảng cho mỗi lớp (tiêu đề "BẢNG ĐIỂM DANH BỆNH"). Tên tệp `diem-danh-suat-an-thang-YYYY-MM.xlsx`, `diem-danh-suat-an-tuan-YYYY-MM-DD.xlsx`, `diem-danh-suat-an-ngay-YYYY-MM-DD.xlsx`. Mỗi lần xuất ghi một dòng nhật ký xuất (mã báo cáo `attendance-meals`, có dữ liệu cá nhân).
- Bếp: thẻ "Suất ăn theo lớp" trong màn hình Bếp và thực đơn, xem một ngày hoặc cả tuần của đơn vị theo lớp, theo khối và cả đơn vị.
- Điểm cuối mới: `GET /api/v1/reports/attendance-meals` (period = day | week | month, date, org_unit_id, class_id), `GET /api/v1/reports/attendance-meals/children` (bảng mã từng trẻ của một lớp, bắt buộc class_id), `GET /api/v1/kitchen/meal-counts` (org_unit_id bắt buộc, period = day | week), `POST /api/v1/reports/attendance-meals/export` (qua cơ chế xuất dữ liệu sẵn có).

## Quy tắc

### Loại ngày (bảng `Data` của mẫu)

| Mã  | Ý nghĩa                                                                                      | Tính ngày ăn |
| --- | -------------------------------------------------------------------------------------------- | ------------ |
| NH  | Ngày học: thuộc học kỳ 1, học kỳ 2 hoặc kỳ hè, là ngày học trong tuần, không thuộc tuần nghỉ | 1            |
| HB  | Thứ bảy học bù (school_day_changes = makeup_school_day)                                      | 1            |
| T7  | Thứ bảy không học                                                                            | 0            |
| CN  | Chủ nhật không học                                                                           | 0            |
| NL  | Ngày nghỉ lễ, Tết (holidays)                                                                 | 0            |
| NB  | Ngày nghỉ bù (school_day_changes = compensatory_day_off)                                     | 0            |
| NK  | Ngày nghỉ khác: ngày thường không học trong tuần, ngoài học kỳ, thuộc tuần nghỉ              | 0            |

Thứ tự xét: học bù, ngày không học trong tuần (T7, CN, NK), nghỉ lễ, nghỉ bù, ngoài học kỳ hoặc tuần nghỉ, còn lại là NH. Thứ bảy, chủ nhật đứng trước ngày lễ như công thức của mẫu. Số ngày ăn = số ngày NH + HB. "Số ngày nghỉ lễ" = số ngày NL + NK như mẫu.

### Trẻ thuộc lớp trong ngày, sĩ số

- Trẻ thuộc lớp trong ngày khi quá trình lớp có ngày vào lớp không sau ngày đó và chưa rời lớp (ngày rời lớp là ngày đầu không còn thuộc lớp, đúng cách ghi `to_date` khi chuyển lớp, thôi học), hoặc có bản ghi điểm danh của lớp trong ngày đó. Trẻ ở trạng thái nháp, chờ duyệt, bảo lưu mà không có bản ghi điểm danh thì không tính. Ngày kỳ hè chỉ tính trẻ đã đăng ký học hè tháng đó (BR-92).
- Sĩ số trên báo cáo là sĩ số của ngày tham chiếu: hôm nay nếu thuộc kỳ, ngày cuối kỳ nếu kỳ đã qua, ngày đầu kỳ nếu kỳ chưa tới.

### Mã của trẻ trong ngày (bảng từng lớp)

- Để trống: có mặt (có mặt, đi muộn, về sớm). Mỗi lượt có mặt ngày ăn là một suất ăn (BR-58).
- B (nghỉ bệnh): vắng mà lý do báo vắng hoặc ghi chú điểm danh có từ khóa bệnh: ốm, bệnh, sốt, ho, cảm, cúm, viêm, tiêu chảy, nôn, ói, sổ mũi, đau, tay chân miệng, thủy đậu, sởi, nhập viện, nằm viện (so khớp theo từ, không phân biệt hoa thường).
- P (nghỉ có phép): điểm danh "vắng có báo", hoặc lớp chưa điểm danh mà phụ huynh đã báo vắng trước giờ bắt đầu học.
- K (nghỉ không phép): điểm danh "vắng không báo", hoặc lớp chưa điểm danh mà báo vắng sau giờ bắt đầu học.
- N (không tính): ngày nghỉ rơi vào ngày thường (NL, NB, NK), hoặc ngày ăn mà trẻ chưa vào lớp, đã rời lớp, không học hè.
- ?: ngày ăn đã qua (kể cả hôm nay) mà lớp chưa điểm danh trẻ và không có báo vắng.
- Thứ bảy, chủ nhật không học và ngày chưa tới để trống, tô xám ngày không tính.

Hệ thống không có trường riêng phân biệt nghỉ bệnh, nên B suy từ lý do như trên.

### Số liệu và tỷ lệ

- Chỉ cộng các ngày ăn đã tới (đến hết hôm nay).
- Lượt phải có mặt = tổng số trẻ thuộc lớp của từng ngày ăn đã tới. Có mặt = số lượt có mặt. Suất ăn = có mặt những ngày ăn.
- Tổng vắng mặt = lượt phải có mặt − có mặt (giống công thức "sĩ số × số ngày ăn − có mặt" của mẫu, gồm cả trẻ chưa điểm danh); tách thêm P, K, B và chưa điểm danh.
- Tỷ lệ = có mặt / lượt phải có mặt (mẫu: có mặt / (sĩ số × số ngày ăn)); làm tròn hai chữ số thập phân của phần trăm.
- Khối: khối lớp có độ tuổi bắt đầu dưới 36 tháng là Khối Nhà trẻ, còn lại là Khối Mẫu giáo. Khi một nhóm có từ hai khối lớp trở lên thì có dòng cộng từng khối lớp ("Khối Mầm", "Khối Chồi", "Khối Lá") rồi dòng cộng nhóm, như mẫu.

### Suất ăn của bếp

- Số suất từng lớp từng ngày = số trẻ có mặt ngày ăn, cùng con số với báo cáo. Hôm nay tính theo điểm danh đã lưu đến lúc xem, kèm số trẻ chưa điểm danh mà không báo vắng ("+n chưa điểm danh") để bếp dự tính.

## Quyết định

- Không thêm quyền mới, không có migration. Xem báo cáo dùng `P17.report.attendance` (VT-02, VT-15, VT-03 theo phạm vi đơn vị); giáo viên không có quyền này xem lớp được phân công như báo cáo điểm danh sẵn có. Xuất Excel dùng cơ chế xuất dữ liệu sẵn có: cần `P17.data.export` (VT-02, VT-04, VT-06) cùng quyền xem báo cáo, có ghi nhật ký xuất (BR-74); quản lý đơn vị VT-03 xem được nhưng không xuất được, giống các báo cáo khác.
- Suất ăn của bếp dùng quyền đọc dữ liệu bếp của đơn vị sẵn có: `P12.kitchen.manage` (VT-10), `P12.menu.approve` (VT-03), `P17.report.kitchen` (VT-10, VT-04). Bếp xem theo ngày hoặc tuần, không theo tháng.
- Quản lý đơn vị chọn đơn vị hoặc lớp ngoài phạm vi thì bị từ chối (403); không chọn thì chỉ thấy các lớp của đơn vị mình. Giáo viên chọn lớp không được phân công thì bị từ chối.
- Tên trường trên tệp lấy theo tên Trường chính đã cấu hình. Khối ký tên giữ bố cục mẫu (Người lập bảng, ngày lập, HIỆU TRƯỞNG) nhưng để trống họ tên người ký và không ghi địa danh; ngày lập là ngày xuất.
- Ô Excel ghi giá trị đã tính, không ghi công thức, để số liệu khớp màn hình. Ngày không tính được tô xám thay cho định dạng có điều kiện của mẫu. Bảng ẩn "File gốc" của mẫu không xuất.
- Kỳ tuần là từ thứ hai đến chủ nhật chứa ngày chọn. Xuất ngày và tuần dùng cùng bố cục, giới hạn ở các ngày của kỳ.
- Danh sách "Ngày lễ trong năm" của bảng `Data` lấy toàn bộ ngày lễ của năm học đang mở.

## Kịch bản kiểm thử

- CT-13c-1: Phân loại ngày theo lịch có ngày lễ, nghỉ bù, thứ bảy học bù, tuần nghỉ, ngoài học kỳ, kỳ hè: đúng mã NH, HB, T7, CN, NL, NB, NK; chủ nhật trùng ngày lễ là CN — đạt.
- CT-13c-2: Khoảng ngày của kỳ ngày, tuần, tháng (kể cả tháng 2): tuần từ thứ hai đến chủ nhật, tháng từ ngày 1 đến ngày cuối — đạt.
- CT-13c-3: Suy mã vắng từ trạng thái điểm danh, báo vắng và lý do: P, K, B đúng quy tắc; "cho" không bị nhận là "ho" — đạt.
- CT-13c-4: Tính số liệu từ dữ liệu giả (trẻ vào lớp giữa kỳ, ngày lễ, học bù, lớp chưa điểm danh): lượt phải có mặt, có mặt, vắng P, K, B, chưa điểm danh, tỷ lệ 62,5%, nhóm khối và toàn trường đúng — đạt.
- CT-13c-5: Đặt tên bảng tính của lớp có ký tự không hợp lệ, trùng tên, quá dài: tên hợp lệ, không trùng, tối đa 31 ký tự — đạt.
- CT-13c-6: Hiệu trưởng xem báo cáo tháng toàn trường: loại ngày đúng, Mầm có 4 lượt có mặt, 1 B, 1 P, suất ăn 4, tỷ lệ đúng; nhóm Khối Nhà trẻ, Khối Mầm, Khối Chồi, Khối Mẫu giáo — đạt.
- CT-13c-7: Xem báo cáo tuần (7 ngày từ thứ hai), ngày, bảng mã từng trẻ của lớp; tham số sai bị từ chối (400) — đạt.
- CT-13c-8: Quản lý đơn vị chỉ thấy lớp của đơn vị mình; chọn đơn vị hoặc lớp khác bị từ chối (403); giáo viên chỉ thấy lớp được phân công; bếp không xem được báo cáo điểm danh — đạt.
- CT-13c-9: Bếp xem suất ăn tuần của đơn vị mình theo lớp và khối; đơn vị khác, kỳ tháng, giáo viên bị từ chối — đạt.
- CT-13c-10: Xuất Excel tháng: tên tệp đúng, có các bảng Data, Tổng hợp, Tổng hợp tháng và một bảng mỗi lớp; tiêu đề, tên trường, sĩ số, tổng có mặt, mã B của trẻ đúng; ghi nhật ký xuất có dữ liệu cá nhân; xuất tuần có bảng "Tổng hợp tuần"; quản lý đơn vị không có quyền xuất bị từ chối — đạt.
- CT-13c-11: Giao diện (46-attendance-report.spec.ts): mở báo cáo, chuyển Ngày, Tuần, Tháng, tải tệp Excel đúng tên, mở được bằng exceljs và có bảng "Tổng hợp tháng" — đạt.

## Giới hạn

- Nghỉ bệnh chỉ suy từ lý do bằng từ khóa; lý do không có từ khóa thì tính P hoặc K.
- Trẻ bảo lưu không có ngày bắt đầu, kết thúc nên không tính vào sĩ số những ngày không có điểm danh.
- Sĩ số trên dòng lớp là sĩ số ngày tham chiếu; lượt phải có mặt tính theo sĩ số từng ngày nên có thể khác "sĩ số × số ngày ăn" khi sĩ số thay đổi trong kỳ.
- Tệp Excel không giữ công thức của mẫu (ghi giá trị), không có bảng ẩn "File gốc".
- Chưa có bảng từng trẻ trên màn hình của bếp; bếp xem số suất theo lớp và khối.
