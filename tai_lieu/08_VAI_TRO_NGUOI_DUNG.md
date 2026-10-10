# 08. VAI TRÒ NGƯỜI DÙNG

- Mô tả: Nhóm người dùng, vai trò, trách nhiệm, quyền hạn.
- Phiên bản: 1.13
- Ngày cập nhật: 2026-10-10
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Danh sách vai trò

| Mã | Tên vai trò | Kênh sử dụng | Phạm vi dữ liệu |
|---|---|---|---|
| VT-01 | Quản trị nền tảng | Cổng quản trị | Toàn trường về cấu hình kỹ thuật, không xem dữ liệu nghiệp vụ của trường |
| VT-02 | Hiệu trưởng | Cổng quản trị | Toàn trường, mọi cấp đơn vị |
| VT-03 | Quản lý đơn vị | Cổng quản trị | Một hoặc nhiều đơn vị được gán, ở cấp 1 hoặc cấp 2 |
| VT-04 | Kế toán | Cổng quản trị | Một hoặc nhiều đơn vị được gán, toàn bộ dữ liệu tài chính trong phạm vi đó |
| VT-05 | Kế toán trưởng | Cổng quản trị | Như kế toán, thêm quyền đề nghị chốt kỳ tài chính; không phê duyệt chứng từ |
| VT-06 | Nhân sự | Cổng quản trị | Một hoặc nhiều đơn vị được gán, toàn bộ dữ liệu nhân sự |
| VT-07 | Giáo viên chủ nhiệm | Ứng dụng giáo viên | Lớp được phân công và trẻ trong lớp đó |
| VT-08 | Giáo viên bộ môn | Ứng dụng giáo viên | Lớp được phân công, chỉ phần giảng dạy |
| VT-09 | Nhân viên y tế | Cổng quản trị, ứng dụng giáo viên | Trẻ thuộc các đơn vị được gán, toàn bộ dữ liệu y tế |
| VT-10 | Nhân viên bếp | Cổng quản trị, ứng dụng giáo viên | Dữ liệu bếp, thực đơn, suất ăn của đơn vị được gán |
| VT-11 | Nhân viên kho và mua hàng | Cổng quản trị | Dữ liệu tài sản, kho, mua hàng của đơn vị được gán |
| VT-12 | Nhân viên tuyển sinh | Cổng quản trị | Hồ sơ tuyển sinh của đơn vị được gán |
| VT-13 | Tài xế và người đưa đón — Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — |
| VT-14 | Phụ huynh | Ứng dụng phụ huynh | Chỉ bản ghi của con mình |
| VT-15 | Phó Hiệu trưởng | Cổng quản trị | Một hoặc nhiều đơn vị được gán; phê duyệt chứng từ dưới hạn mức cấu hình |
| VT-16 | Thủ quỹ | Cổng quản trị | Quỹ tiền mặt của các đơn vị được gán; lập phiếu thu, phiếu chi tiền mặt; không lập hóa đơn, không xem lương |
| VT-17 | Tổ trưởng chuyên môn | Ứng dụng giáo viên, cổng quản trị | Giáo án và kế hoạch giảng dạy của các lớp trong tổ; duyệt trước quản lý đơn vị |
| VT-18 | Bảo vệ | Ứng dụng giáo viên | Danh sách người được ủy quyền đón trẻ của đơn vị được gán; xác nhận người đón tại cổng |
| VT-19 | Cán bộ quản lý cấp trên | Cổng quản trị | Chỉ xem báo cáo tổng hợp toàn trường, không xem dữ liệu cá nhân |
| VT-20 | Kiểm toán viên | Cổng quản trị | Toàn trường, chỉ xem số liệu học phí, thu chi và bảng lương trong thời hạn tài khoản; tài khoản tự hết hiệu lực |

Ghi chú: VT-02 và VT-15 hợp thành **Ban Giám hiệu**. Trường công lập nên Ban Giám hiệu gồm một Hiệu trưởng và một hoặc nhiều Phó Hiệu trưởng. Hai vai trò tách riêng để áp dụng hạn mức phê duyệt quy định tại `07_QUY_TAC_NGHIEP_VU.md` mục 12.1 (BR-77 đến BR-80).

## 2. Phạm vi dữ liệu

Ba lớp kiểm soát, áp dụng đồng thời:

1. **Lớp vai trò.** Vai trò quyết định được gọi nhóm chức năng nào.
2. **Lớp đơn vị.** Người dùng được gán vào một hoặc nhiều đơn vị ở bất kỳ cấp nào. Mọi truy vấn tự động giới hạn trong các đơn vị được gán và các đơn vị cấp dưới trực thuộc, trừ VT-02, VT-19 và VT-20 luôn ở phạm vi toàn trường, và VT-01 chỉ thao tác cấu hình kỹ thuật. Ví dụ gán ở Trường chính thì bao gồm mọi Phân hiệu và Điểm trường trực thuộc.
3. **Lớp bản ghi.** Một số vai trò bị giới hạn tới từng bản ghi: VT-07 và VT-08 chỉ tới lớp được phân công; VT-14 chỉ tới trẻ có quan hệ phụ huynh; VT-17 chỉ tới lớp thuộc tổ chuyên môn; VT-18 chỉ tới danh sách đón trả của đơn vị được gán.

Nguyên tắc bắt buộc: cả ba lớp đều được kiểm tra ở máy chủ. Giao diện chỉ hiển thị theo quyền để thuận tiện, không thay thế việc kiểm tra ở máy chủ.

## 3. Ma trận quyền theo phân hệ

Ký hiệu: **Q** toàn quyền, **S** được tạo và sửa, **D** được phê duyệt, **X** chỉ xem, **–** không truy cập. Một ô ghi hai ký hiệu khi vai trò có cả hai quyền tách biệt.

Cột VT-02 và VT-15 đặt cạnh nhau vì hai vai trò hợp thành Ban Giám hiệu.

| Phân hệ | VT-02 | VT-15 | VT-03 | VT-04 | VT-05 | VT-06 | VT-07 | VT-08 | VT-09 | VT-10 | VT-11 | VT-12 | VT-13 (bỏ) | VT-14 | VT-16 | VT-17 | VT-18 | VT-19 | VT-20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 Nền tảng và phân quyền | Q | S | S | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – |
| P02 Trẻ, phụ huynh, lớp học | Q | Q | S, D | X | X | X | S | X | X | X | X | S | – | X | – | X | X | – | – |
| P03 Giảng dạy | D | D | D | – | – | – | S | S | – | – | – | – | – | X | – | D | – | – | – |
| P04 Điểm danh và chăm sóc | X | X | X, S | X | X | – | S | X | S | X | – | – | – | S | – | X | S | – | – |
| P05 Học phí và khoản thu | D | D | X, S | Q | Q | – | X | – | – | – | – | X | – | X | X | – | – | – | X |
| P06 Tài chính, quỹ, ngân hàng | D | D | X | S | S | – | – | – | – | – | – | – | – | – | S | – | – | – | X |
| P07 Nhân sự và hợp đồng | X | X | X | X | X | Q | X | X | X | X | X | – | – | – | – | – | – | – | – |
| P08 Chấm công và tiền lương | D | D | X, D | S | S | Q | X | X | X | X | X | – | – | – | – | – | – | – | X |
| P09 Công việc, kế hoạch, đánh giá | X | X | S | X | X | S | S | S | S | S | S | S | – | – | S | S | – | – | – |
| P10 Y tế học đường | X | X | X | X | – | – | S | – | Q | – | – | – | – | S | – | – | – | – | – |
| P11 Xe đưa đón (bỏ) | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – |
| P12 Bếp và dinh dưỡng | X | X | S | X | X | – | X | – | X | Q | X | – | – | X | – | – | – | – | – |
| P13 Kho, tài sản, mua hàng | D | D | D | X | X | – | S | – | X | X | Q | – | – | – | – | – | – | – | – |
| P14 Hoạt động, nội dung, truyền thông | D | D | D | – | – | – | S | S | S | S | S | S | – | X | – | S | – | – | – |
| P15 Tương tác và ý kiến | X | X | S | X | X | X | S | X | X | X | X | X | – | S | – | – | – | – | – |
| P16 Tuyển sinh | D | D | D | X | X | X | – | – | X | – | – | Q | – | – | – | – | – | – | – |
| P17 Báo cáo và bảng điều khiển | Q | Q | X | X | X | X | X | X | X | X | X | X | – | – | X | X | – | X | X |
| P18 Tuyển dụng | D | D | D | – | – | Q | – | – | – | – | – | X | – | – | – | – | – | – | – |
| P19 Kênh truy cập và thông báo | Q | Q | S | X | X | X | S | S | S | S | S | S | – | X | X | S | X | X | X |

Ghi chú áp dụng cho bảng:

1. VT-04 và VT-05 xem được toàn bộ dữ liệu trẻ và nhân sự trong phạm vi đơn vị để phục vụ tính học phí và bảng lương, nhưng không sửa hồ sơ trẻ.
2. VT-07 được sửa hồ sơ trẻ trong lớp mình phụ trách ở mức cập nhật thông tin chăm sóc, không được sửa thông tin định danh và thông tin tài chính.
3. VT-14 được tạo yêu cầu dặn thuốc, báo vắng, gửi góp ý và trao đổi, nhưng chỉ xem dữ liệu của con mình.
4. VT-09 xem được thông tin định danh của trẻ để phục vụ y tế, không sửa được hồ sơ trẻ.
5. Quyền phê duyệt và quyền sửa là hai quyền tách biệt; một người có thể có cả hai nhưng hệ thống kiểm tra riêng.
6. VT-15 có cùng tập quyền với VT-02, trừ P01 chỉ ở mức S. Quyền phê duyệt của VT-15 giới hạn trong các đơn vị được gán và chỉ áp dụng với chứng từ dưới hạn mức cấu hình.
7. VT-03 phê duyệt việc nghiệp vụ không có giá trị tiền trong phạm vi đơn vị mình quản lý, ví dụ hồ sơ trẻ, đơn nghỉ phép, hoạt động của lớp. VT-03 không phê duyệt chứng từ thuộc danh mục áp dụng hạn mức; quyền D của VT-03 ở P13 không gồm đề nghị mua hàng.
8. VT-05 có tập quyền như VT-04 và thêm quyền đề nghị chốt kỳ tài chính; Hiệu trưởng phê duyệt chốt kỳ. VT-05 không phê duyệt chứng từ; chứng từ thuộc danh mục áp dụng hạn mức do Ban Giám hiệu phê duyệt theo BR-77, quyết định ngày 2026-10-09.
9. Quyền X của VT-03 ở P08 chỉ gồm chấm công, lịch nghỉ và đơn nghỉ; quyền D chỉ gồm đơn nghỉ phép của nhân sự trong đơn vị (BR-40); VT-03 không xem bảng lương và phiếu lương của nhân sự (Q-23). Quyền D của VT-03 ở P02 là duyệt hồ sơ trẻ.
10. VT-13 đã bỏ cùng phân hệ P11. VT-16 đến VT-20 thêm ngày 09/10/2026 (Q-21, Q-110). VT-19 và VT-20 là người ngoài trường: VT-19 chỉ thấy số liệu tổng hợp, không thấy dữ liệu cá nhân; tài khoản VT-20 có ngày hết hiệu lực bắt buộc.
11. Quyền X của VT-20 ở P08 gồm bảng lương. Xem GD-92.
12. VT-02 và VT-15 được tạo và sửa lịch nghỉ thứ 7 và lịch học bù chung toàn trường trong P08 (P08-10, BR-84); các phần khác của P08 chỉ ở mức phê duyệt.
13. VT-04 và VT-06 được dùng P01-13 để nhập dữ liệu ban đầu thuộc phạm vi của mình (kế toán: công nợ đầu kỳ; nhân sự: hồ sơ nhân sự); ngoài P01-13 không truy cập P01, trừ VT-06 được tạo, sửa phòng ban và chức danh trong đơn vị được gán (P01-03, P01-04, YCTD-42).
14. Quyền X của VT-19 và VT-20 ở P19 chỉ gồm đăng nhập và sử dụng cổng quản trị, không gửi thông báo.
15. Quyền S của VT-03 ở P04 chỉ gồm chốt điểm danh ngày thay giáo viên, sửa điểm danh đã chốt kèm lý do (P04-06, QT-02) và sửa nhật ký đã công bố quá thời hạn sửa của giáo viên (Q-67, QT-09).
16. Quyền S của VT-03 ở P05 chỉ gồm lập đề xuất xử lý công nợ quá hạn (P05-12); quyết định do VT-15 hoặc VT-02 ghi.
17. Quyền S của VT-07 ở P10 gồm ghi sự kiện y tế ban đầu, ghi chăm sóc hằng ngày (BR-87), và nhận thuốc, ghi liều chỉ khi đơn vị bật cấu hình không có nhân viên y tế (BR-86).

## 4. Quy tắc phân quyền

| Mã | Quy tắc |
|---|---|
| PQ-01 | Quyền được cấp theo vai trò, không cấp trực tiếp cho từng người, trừ trường hợp đặc biệt có ghi nhật ký thao tác |
| PQ-02 | Một người có thể giữ nhiều vai trò. Quyền có hiệu lực là hợp của các vai trò |
| PQ-03 | Khi gán vai trò có phạm vi đơn vị, phải chỉ định rõ đơn vị. Không có vai trò nào mặc định toàn trường ngoài VT-02, VT-19, VT-20 và VT-01 (chỉ cấu hình kỹ thuật) |
| PQ-04 | Thu hồi quyền có hiệu lực ngay tại yêu cầu kế tiếp; hệ thống không chờ phiên làm việc hết hạn |
| PQ-05 | Mọi thay đổi về vai trò và quyền phải ghi nhật ký thao tác kèm người thực hiện, thời điểm, giá trị trước và giá trị sau |
| PQ-06 | Nhà trường tạo tài khoản cho mọi phụ huynh có số điện thoại trong hồ sơ, với mật khẩu mặc định chung toàn trường do Hiệu trưởng đặt ở cấu hình chung của dịch vụ định danh (YCTD-43); phụ huynh bắt buộc đổi mật khẩu ở lần đăng nhập đầu. Chỉ tài khoản có duy nhất vai trò VT-14 mới đăng nhập được bằng mã một lần |
| PQ-07 | Tài khoản không đăng nhập quá số ngày cấu hình (mặc định 90, Hiệu trưởng sửa trên cổng quản trị) thì bị tạm khóa ở lần đăng nhập kế tiếp và phải được mở khóa lại (YCTD-40) |
| PQ-08 | Phụ huynh không tự đổi số điện thoại đăng nhập; muốn đổi phải gửi yêu cầu để nhà trường xác nhận |
| PQ-09 | Mã quyền có dạng `<phân hệ>.<hành động>`: `view` ứng với X, `edit` ứng với S, `approve` ứng với D; Q gồm cả ba. Giới hạn chi tiết trong ghi chú của ma trận mục 3 kiểm tra trong mã nghiệp vụ (YCTD-35) |
| PQ-10 | VT-01 có thêm quyền `P01.account.manage`: tạo tài khoản, khóa, mở khóa, đặt lại mật khẩu, gán vai trò (P01-06, P01-07); không xem dữ liệu nghiệp vụ. Tài khoản đầu tiên của hệ thống là VT-01, tạo bằng lệnh trên máy chủ (YCTD-35) |
| PQ-11 | Quyền `P01.academic-year.manage` chỉ VT-02 có: tạo năm học, lưu lịch năm học, đánh dấu tuần nghỉ, mở năm học mới (BR-91, BR-93). Mọi người đã đăng nhập đều xem được lịch năm học (YCTD-37) |
| PQ-12 | Quyền `P01.org-unit.manage` chỉ VT-02 có: tạo, sửa, ngừng sử dụng đơn vị (P01-01). Mọi người đã đăng nhập đều xem được cây đơn vị (YCTD-38) |
| PQ-13 | Quản lý tài khoản (P01-06, P01-07, YCTD-39): VT-01 và VT-02 có `P01.account.manage`, tạo và quản lý mọi tài khoản, gán và gỡ vai trò, tạo vai trò, sửa ma trận quyền. VT-03 có `P01.account.manage-in-unit`: tạo tài khoản với mọi vai trò trừ VT-01, VT-02, chỉ trong các đơn vị được gán; khóa, mở khóa, đặt lại mật khẩu tài khoản có mọi vai trò nằm trong đơn vị của mình; không gán, gỡ vai trò sau khi tạo (CTC-P01-042). VT-15 không quản lý tài khoản |
| PQ-14 | Đặt lại mật khẩu thì hệ thống sinh mật khẩu tạm, hiển thị một lần cho người đặt lại; người được đặt lại bắt buộc đổi ở lần đăng nhập kế tiếp (BM-07, YCTD-39) |
| PQ-15 | Quyền `P01.setting.manage`: VT-02 sửa cấu hình mọi đơn vị và cấu hình chung toàn trường, VT-03 sửa cấu hình của đơn vị được gán; VT-15 và vai trò khác chỉ xem cấu hình của đơn vị trong phạm vi (P01-08, YCTD-40) |
| PQ-16 | Quyền quản lý danh mục (YCTD-42): `P01.department.manage` cho VT-02 toàn trường và VT-06 trong đơn vị được gán, dùng cho phòng ban và chức danh; `P01.catalog.manage` chỉ VT-02, dùng cho danh mục dùng chung và bậc học; `P01.approval-threshold.manage` chỉ VT-02; `P01.room.manage` cho VT-02 toàn trường và VT-03 trong đơn vị được gán. Ai có vai trò ở đơn vị đều xem được phòng ban, chức danh, phòng học của đơn vị đó; mọi người đã đăng nhập xem được danh mục dùng chung và bậc học; hạn mức phê duyệt xem bằng `P01.view` trong phạm vi đơn vị |
| PQ-17 | Quyền `P02.class.manage` (YCTD-44): VT-02 toàn trường, VT-15 và VT-03 trong đơn vị được gán; tạo, sửa, đóng lớp và phân công giáo viên. Ai có vai trò ở đơn vị đều xem được lớp của đơn vị; giáo viên xem các lớp mình đang được phân công |
| PQ-18 | Hồ sơ trẻ (YCTD-45): `P02.child.manage` cho VT-02, VT-15 toàn trường và VT-03, VT-12 trong đơn vị được gán, dùng để tạo, sửa hồ sơ nháp, gửi trình duyệt; `P02.approve` dùng để duyệt, từ chối, phân lớp, chuyển lớp và sửa thông tin định danh của trẻ đang học kèm lý do; `P02.national-id.view` cho VT-02, VT-15, VT-03, VT-12 xem đầy đủ số định danh và giấy khai sinh. Phạm vi xem trẻ: VT-02, VT-15, VT-03, VT-12, VT-04, VT-05, VT-06, VT-09, VT-10, VT-11 trong đơn vị; VT-07, VT-08 trong lớp được phân công; VT-14 con mình; VT-17, VT-18 chưa xem được |

## 5. Phân cấp phê duyệt

Ban Giám hiệu gồm hai vai trò tách riêng để áp dụng hạn mức phê duyệt. Quy tắc nghiệp vụ tương ứng ở `07_QUY_TAC_NGHIEP_VU.md` mục 12.1.

| Loại phê duyệt | Vai trò | Phạm vi đơn vị | Giá trị chứng từ |
|---|---|---|---|
| Không thuộc danh mục hạn mức | Quản lý đơn vị (VT-03) | Đơn vị mình quản lý | Việc nghiệp vụ không có giá trị tiền: hồ sơ trẻ, đơn nghỉ phép, hoạt động của lớp. Không phê duyệt chứng từ thuộc danh mục áp dụng hạn mức |
| Chứng từ dưới hạn mức | Phó Hiệu trưởng (VT-15) | Các đơn vị được gán | Chứng từ có giá trị **dưới** hạn mức cấu hình |
| Chứng từ từ hạn mức trở lên | Hiệu trưởng (VT-02) | Toàn trường | Chứng từ có giá trị **từ** hạn mức cấu hình trở lên, mọi chứng từ do Phó Hiệu trưởng chuyển lên, chốt kỳ tài chính, và phiếu chi hoàn tiền khi trẻ thôi học ở mọi giá trị (BR-24) |

Danh mục chứng từ áp dụng hạn mức: phiếu chi, phiếu đảo phiếu thu, phiếu đảo phiếu chi, đề nghị mua hàng, phiếu điều chỉnh hóa đơn, miễn giảm học phí, bảng lương kỳ, chốt kỳ tài chính.

Nguyên tắc áp dụng:

1. Hạn mức cấu hình theo từng đơn vị và từng loại chứng từ; có thể khác nhau giữa Trường chính, Phân hiệu và Điểm trường.
2. Người lập chứng từ không tự phê duyệt chứng từ của mình (BR-78).
3. Không có hạn mức thì mặc định Hiệu trưởng phê duyệt; đây là quy tắc an toàn, không phải cấu hình mặc định của nghiệp vụ.
4. Mức hạn mức cụ thể chưa có, xem Q-112.

## 6. Chưa xác minh được

1. Cơ cấu tổ chức thật của trường: số Phân hiệu, số Điểm trường, tên từng đơn vị và người phụ trách: không có sơ đồ tổ chức. Đã tìm trong: tám ảnh sơ đồ chức năng và danh sách tính năng.
2. Đã có câu trả lời: thêm VT-16 đến VT-20 (Q-21, Q-110).
3. Đã có câu trả lời: Ban Giám hiệu phê duyệt theo hạn mức (Q-22); mức hạn mức do nhà trường cấu hình sau (Q-112).
4. Đã có câu trả lời: một người có thể giữ nhiều vai trò và làm nhiều đơn vị (GD-14).

## 7. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-13 | Đã xác nhận ngày 09/10/2026: Đơn vị tổ chức nhiều cấp: Trường chính, Phân hiệu, Điểm trường; Ban Giám hiệu gồm Hiệu trưởng và Phó Hiệu trưởng ở trên, quản lý đơn vị ở dưới | Eric |
| GD-14 | Đã xác nhận ngày 09/10/2026: Một người có thể giữ nhiều vai trò và làm nhiều đơn vị | Eric |
| GD-61 | Đã xác nhận ngày 09/10/2026: Mỗi đơn vị có một người phụ trách (quản lý đơn vị); một Phó Hiệu trưởng có thể phụ trách một hoặc nhiều đơn vị | Eric |
| Q-21 | Đã trả lời ngày 09/10/2026: thêm VT-16 thủ quỹ, VT-17 tổ trưởng chuyên môn, VT-18 bảo vệ, VT-19 cán bộ quản lý cấp trên | Eric |
| Q-22 | Đã trả lời ngày 09/10/2026: chỉ Ban Giám hiệu phê duyệt theo hạn mức, xem YCTD-02 và YCTD-04 | Eric |
| Q-23 | Đã trả lời ngày 09/10/2026: không; quản lý đơn vị chỉ xem chấm công, không xem bảng lương | Eric |
| Q-24 | Đã trả lời ngày 09/10/2026: phụ huynh đăng nhập bằng số điện thoại và mật khẩu, hoặc bằng số điện thoại và mã một lần gửi qua tin nhắn | Eric |
| Q-113 | Đã trả lời ngày 09/10/2026: nhà trường tự tạo cây đơn vị trong phần Cấu hình | Eric |
| GD-92 | Đã xác nhận ngày 09/10/2026: Kiểm toán viên (VT-20) được xem học phí, thu chi và bảng lương trong thời hạn tài khoản | Eric |
| Q-145 | Đã trả lời ngày 09/10/2026: kiểm toán viên luôn xem số liệu toàn trường, không gán đơn vị | Eric |
