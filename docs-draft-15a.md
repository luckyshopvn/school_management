# Nháp tài liệu DT-15 phần 15a — Khung chung theo hệ thống của Sở: menu ngang đánh số, menu người dùng, lưới dữ liệu dùng chung (YCTD-107)

## YCTD

### YCTD-107: Khung chung của cổng quản trị theo hệ thống của Sở (DT-15 phần 15a) – 2026-10-14

- Lý do: Eric quyết định ngày 2026-10-13 đồng bộ giao diện cổng quản trị theo hệ thống quản lý trường học của Sở GD&ĐT TP.HCM (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, 3, 4, 5; khảo sát `31_KHAO_SAT_HE_THONG_SO.md` mục 2.2, 2.3): menu ngang nhiều cấp có đánh số thay thanh điều hướng bên trái (thay lựa chọn giữ thanh bên ở YCTD-99), cổng quản trị gọi "học sinh" thay "trẻ", giữ mã quyền theo thao tác. Phần 15a chỉ làm khung chung, không thêm nghiệp vụ mới. Các điểm chi tiết dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi:
  - Menu ngang: bỏ thanh điều hướng bên trái cùng nút ẩn, hiện thanh và thu gọn nhóm (YCTD-99). Dưới thanh đầu trang màu xanh là thanh menu của phân hệ đang chọn ở ô "Phân hệ" (YCTD-101). Mục cấp một mở menu sổ xuống, cấp sâu hơn bật sang bên phải; mục có số thứ bậc dạng 1., 1.1., 1.1.1. như của Sở. Đầu thanh có mục "Trang chủ". Trang đang mở được tô sáng ở mục lá (`aria-current="page"`) và ở mục cấp một chứa nó (gạch chân màu chủ đạo).
  - Chuột: bấm mục cấp một để mở hoặc đóng; khi đang mở một menu, rê sang mục cấp một khác thì chuyển menu; rê hoặc bấm mục có menu con để mở menu con; bấm ra ngoài hoặc mở trang khác thì đóng. Bàn phím theo mẫu menubar của WAI-ARIA (vai trò `menubar`, `menu`, `menuitem`): mũi tên trái, phải giữa các mục cấp một (vòng tròn), Home, End; Enter, Space, mũi tên xuống mở menu và đưa con trỏ tới mục đầu, mũi tên lên tới mục cuối; trong menu mũi tên lên, xuống (vòng tròn), mũi tên phải mở menu con hoặc sang menu cấp một bên phải, mũi tên trái đóng menu con hoặc sang menu cấp một bên trái; Esc đóng một cấp và trả con trỏ về mục cha; Tab đóng hết; Space trên mục lá mở trang. Chỉ mục cấp một đang chọn nằm trong thứ tự Tab (roving tabindex).
  - Cây menu (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, bảng ở mục "Cây menu"): mười một phân hệ. Bốn phân hệ của Sở giữ đúng số thứ tự của Sở, mục Sở có mà mình chưa có thì để trống số (ví dụ 1.2, 1.3 Phân hiệu, Điểm trường làm ở phần 15b); bảy phân hệ riêng (Tài chính – học phí; Nhân sự – chấm công, lương; Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng; Báo cáo) đánh số liên tục cùng kiểu. Nhãn mục dùng tên của Sở theo tài liệu 32 mục 3 (ví dụ "4.1.1. Quản lý hồ sơ học sinh", "1.4. Danh sách người dùng", "1.1. Nhóm người dùng"); tên tiêu đề của từng màn hình chưa đổi (đổi ở 15c, 15e).
  - Mỗi trang của cổng quản trị có đúng một mục menu (66 trang); Trang chủ ở đầu thanh menu; Thông báo, Đổi mật khẩu ở menu người dùng. Trang trước có ở hai nhóm ("Nhập dữ liệu" ở nhóm Trẻ và lớp và ở nhóm Nhân sự) nay chỉ còn mục "4.1.2. Nhập dữ liệu từ Excel", hiện cho người trước đây thấy ở một trong hai chỗ. Mục không có trong cây của Sở đặt vào nhóm gần nhất: Điểm danh (4.7), Thuốc và dặn thuốc (4.6.2), Y tế học đường (4.6.1) dưới 4. Học sinh; Bếp và thực đơn thành "4.5. Thực đơn bữa ăn" theo tài liệu 32; Năm học, Cây đơn vị, Phòng ban, Danh mục, Phòng học, Hạn mức, Khóa API, Kết nối ngoài, Nhật ký ở Quản trị hệ thống; Tuyển dụng ở phân hệ "Tuyển sinh, tuyển dụng" theo tài liệu 32 mục 3.2.
  - Quyền hiện mục giữ nguyên điều kiện của thanh điều hướng cũ, kể cả điều kiện của nhóm cũ (nhóm Trẻ và lớp, nhóm Học phí và tài chính) áp vào từng mục; nhóm không còn mục thì ẩn; phân hệ không còn mục thì không có trong ô Phân hệ. Bỏ lựa chọn "Tất cả chức năng" của ô Phân hệ vì menu ngang không đủ chỗ cho mọi nhóm; giá trị cũ đã lưu thì dùng phân hệ đầu tiên người dùng được thấy. Mở trang thuộc phân hệ khác (gõ đường dẫn, chuông thông báo, truy cập nhanh) thì menu tự chuyển sang phân hệ của trang, không ghi nhớ; chọn ở ô Phân hệ thì ghi nhớ trên trình duyệt như YCTD-101.
  - Cây menu đặt ở `@school-management/shared` (`PORTAL_WORKSPACES`) để cổng quản trị, kiểm thử đơn vị và trợ giúp kiểm thử giao diện dùng chung; điều kiện quyền ở cổng quản trị (`apps/portal/src/pages/menu-permissions.ts`). Mọi phân hệ người dùng được thấy đều dựng thanh menu trong cây giao diện, thanh của phân hệ khác bị ẩn.
  - Màn hình hẹp dưới 768 điểm ảnh: thanh menu ngang ẩn, nút "☰" (nhãn "Menu chức năng") ở đầu thanh đầu trang mở cây menu gập theo chiều dọc của phân hệ đang chọn; nhóm mở, đóng bằng nút có `aria-expanded`; nhánh chứa trang đang mở đã mở sẵn; chọn trang thì cây đóng lại.
  - Truy cập nhanh (YCTD-102): danh sách trang để ghim lấy thẳng từ cây menu đã lọc theo quyền nên có đủ mục kể cả khi các menu sổ xuống đang đóng; nhóm theo phân hệ mới; nhãn theo tên mục menu (không kèm số). `PORTAL_QUICK_LINK_PATHS` thêm 11 trang của DT-14 (cân đo, thống kê, hồ sơ chưa nhập đủ, hồ sơ trường, cơ sở vật chất, thiết bị dạy học, EMIS, hoàn thành chương trình, nhóm học sinh, chuẩn nghề nghiệp) để mọi mục menu đều ghim được; kiểm thử đơn vị bảo đảm điều này.
  - Menu người dùng theo Sở: bấm tên người dùng ở thanh đầu trang mở Thông báo, Đổi mật khẩu, Cấu hình hiển thị lưới, Thoát (thay nút "Đăng xuất" và liên kết "Đổi mật khẩu" trên thanh đầu trang). Chưa có mục Hồ sơ cá nhân vì cổng quản trị chưa có trang hồ sơ của chính người dùng. Menu dùng được bằng bàn phím (mũi tên, Home, End, Esc). Chuông thông báo và ô năm học giữ nguyên.
  - Lưới dữ liệu dùng chung (`DataGrid` ở `packages/ui`): thanh công cụ có ô tìm kiếm (nhãn mặc định "Tìm kiếm", màn hình đặt nhãn riêng), nút "Mở rộng tìm kiếm" mở vùng bộ lọc mở rộng do màn hình truyền vào, chỗ đặt nút riêng của màn hình (Thêm mới, Xuất Excel…), nút "Cấu hình cột hiển thị"; ô chọn từng dòng và ô "Chọn tất cả dòng trên trang" (trạng thái chọn một phần), dòng chữ "Đã chọn N dòng"; cột thao tác trên dòng; dòng chi tiết mở dưới dòng dữ liệu; số dòng mỗi trang 10, 20, 50, 100, 200 và phân trang (Trang trước, Trang x / y, Trang sau, tổng số dòng). Hai cách phân trang: tại chỗ khi màn hình có đủ dữ liệu (giữ lựa chọn khi đổi trang) và ở máy chủ (đổi trang thì bỏ lựa chọn vì chỉ có dữ liệu của trang đang xem). Bảng có `caption`, tiêu đề cột `scope="col"`, ô chọn có nhãn "Chọn <tên dòng>".
  - Hộp "Cấu hình cột hiển thị": tích để ẩn, hiện cột; nút lên, xuống đổi thứ tự; cột luôn hiện (ví dụ Họ tên) không bỏ được; nút Mặc định, Hủy, Ghi. Cấu hình trùng mặc định thì lưu là "theo mặc định" để cột mới thêm sau vẫn hiện.
  - Hộp xác nhận xóa dùng chung (`ConfirmDeleteDialog`): có ô "Tôi đã đọc và đồng ý xóa <đối tượng>", phải tích thì nút Xóa mới bấm được; mỗi lần mở phải tích lại.
  - Cấu hình lưới theo người dùng lưu ở máy chủ (cơ sở dữ liệu hệ thống, giữ qua các năm học, dùng trên mọi máy): mỗi lưới có khóa (`DATA_GRID_KEYS`: `accounts`, `staff`; lưới chuyển sang ở các phần sau thêm khóa), giữ danh sách cột hiển thị theo thứ tự và số dòng mỗi trang. Khóa `default` giữ số dòng mặc định cho mọi lưới, đặt ở hộp "Cấu hình hiển thị lưới" của menu người dùng. Số dòng của một lưới: số riêng của lưới, không có thì số mặc định của người dùng, không có nữa thì 20. Chỉ đổi cột thì số dòng vẫn theo mặc định.
  - Thí điểm lưới ở hai màn hình: Tài khoản (phân trang ở máy chủ; bộ lọc Trạng thái chuyển vào "Mở rộng tìm kiếm"; nút Thêm mới mở biểu mẫu tạo tài khoản; nút "Hồ sơ" trên dòng; bấm dòng vẫn mở chi tiết; cột ẩn mặc định: Tên đăng nhập, Số điện thoại, Ngày hết hiệu lực, Đổi mật khẩu; gỡ vai trò phải xác nhận bằng hộp xác nhận xóa) và Hồ sơ nhân sự (phân trang tại chỗ; ô chọn đơn vị và biểu mẫu thêm hồ sơ giữ nguyên; nút Chi tiết trên dòng mở hồ sơ ngay dưới dòng; cột ẩn mặc định: Ngày sinh, Giới tính, Điện thoại, Email, Ngày vào làm, Đơn vị). Dịch vụ định danh nhận tối đa 200 dòng mỗi trang ở danh sách tài khoản (trước là 100). Các màn hình khác chuyển sang lưới ở phần 15f.
- Thành phần bị ảnh hưởng: `05`, `08`, `10`, `14`, `15`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `24`, `index.md`; cổng quản trị, máy chủ API, dịch vụ định danh, gói giao diện dùng chung, gói dùng chung, kiểm thử giao diện.
- Dữ liệu bị ảnh hưởng: bảng mới `user_grid_settings` ở cơ sở dữ liệu hệ thống (tệp `database/system/migrations/0005_create_user_grid_settings.ts`).
- API bị ảnh hưởng: điểm cuối mới `GET`, `PUT /api/v1/me/grid-settings/{gridKey}`; `GET /api/v1/users` nhận `page_size` đến 200.
- Giao diện bị ảnh hưởng: khung trang của mọi màn hình cổng quản trị (thanh menu ngang, menu người dùng, màn hình hẹp); màn hình Tài khoản, Hồ sơ nhân sự; trang chủ (Truy cập nhanh). Ứng dụng giáo viên, phụ huynh không đổi.
- Quyền bị ảnh hưởng: không có quyền mới; điều kiện hiện mục menu giữ như thanh điều hướng cũ.
- Ảnh hưởng chức năng cũ: đường dẫn các trang không đổi; lối tắt Truy cập nhanh đã ghim giữ nguyên, nhãn hiện theo tên mục menu mới; lựa chọn ẩn thanh điều hướng, nhóm đã thu gọn lưu trên trình duyệt (YCTD-99) không còn dùng; lựa chọn "Tất cả chức năng" của ô Phân hệ (YCTD-101) bỏ; gỡ vai trò ở màn hình Tài khoản thêm bước xác nhận.
- Kiểm thử cần thực hiện: CT-15a-1 đến CT-15a-14; kiểm thử giao diện viết lại các ca thanh điều hướng ở `tests/e2e/01-login.spec.ts`, thêm ca lưới ở `tests/e2e/04-accounts.spec.ts`; mọi tệp kiểm thử giao diện mở trang qua trợ giúp `tests/e2e/menu.ts`.
- Trạng thái: Đã triển khai

## Bảng

| user_grid_settings | Cấu hình lưới dữ liệu riêng từng tài khoản, giữ qua các năm học (DT-15 phần 15a); `user_id` là mã tài khoản ở dịch vụ định danh, không có khóa ngoại vì khác cơ sở dữ liệu | user_id, grid_key (1 đến 64 ký tự; duy nhất cùng user_id), settings (jsonb đối tượng: `columns` mảng mã cột theo thứ tự, `page_size`), created_at, updated_at |

## Điểm cuối

| GET | /api/v1/me/grid-settings/{gridKey} | Cấu hình lưới của chính tài khoản đang đăng nhập: `columns` (mảng mã cột hoặc null), `page_size` (số hoặc null); chưa lưu thì cả hai null |
| PUT | /api/v1/me/grid-settings/{gridKey} | Ghi đè cấu hình: `columns` (1 đến 100 mã cột, không trùng, mỗi mã 1 đến 64 ký tự chữ, số, `_`, `.`, `-`; null là theo mặc định; lưới `default` không nhận cột), `page_size` (10, 20, 50, 100, 200 hoặc null) |

`gridKey` phải thuộc `DATA_GRID_KEYS` (`default`, `accounts`, `staff`); khóa lạ, dữ liệu sai trả `ERR_VALIDATION` (400) kèm trường lỗi. Không cần quyền riêng; chỉ đọc, ghi cấu hình của chính mình. `GET /api/v1/users` của dịch vụ định danh nhận `page_size` từ 1 đến 200.

## Màn hình

| Khung trang | Thanh đầu trang (tên phần mềm, ô Phân hệ, ô năm học, chuông thông báo, menu người dùng) và thanh menu ngang đánh số của phân hệ đang chọn; màn hình hẹp có nút "☰" mở cây menu gập | Mọi người dùng cổng quản trị |
| Menu người dùng | Thông báo, Đổi mật khẩu, Cấu hình hiển thị lưới (hộp chọn số dòng mỗi trang mặc định), Thoát | Mọi người dùng cổng quản trị |
| MH-30 Tài khoản | Danh sách dùng lưới dữ liệu chung (tìm kiếm, mở rộng tìm kiếm theo trạng thái, Thêm mới, chọn dòng, Hồ sơ trên dòng, cấu hình cột, số dòng mỗi trang); gỡ vai trò qua hộp xác nhận xóa | Như cũ |
| MH-12 Hồ sơ nhân sự | Danh sách dùng lưới dữ liệu chung (tìm theo tên hoặc mã, chọn dòng, Chi tiết trên dòng, cấu hình cột, số dòng mỗi trang) | Như cũ |

Số MH do người điều phối đánh khi gộp tài liệu. Màn hình thanh điều hướng bên trái của YCTD-99 thay bằng khung trang trên.

### Cây menu

Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, dựa trên tài liệu 32 mục 3. "(nhóm)" là mục mở menu con.

| Phân hệ                      | Số     | Mục                              | Đường dẫn                 |
| ---------------------------- | ------ | -------------------------------- | ------------------------- |
| Quản lý giáo dục Mầm non     | 1.     | Trường học                       | (nhóm)                    |
| Quản lý giáo dục Mầm non     | 1.1.   | Hồ sơ trường                     | `/school-profile`         |
| Quản lý giáo dục Mầm non     | 1.4.   | Cấu hình trường                  | `/settings`               |
| Quản lý giáo dục Mầm non     | 2.     | Lớp học                          | (nhóm)                    |
| Quản lý giáo dục Mầm non     | 2.1.   | Hồ sơ lớp học                    | `/classes`                |
| Quản lý giáo dục Mầm non     | 3.     | Nhân sự                          | (nhóm)                    |
| Quản lý giáo dục Mầm non     | 3.1.   | Hồ sơ nhân sự                    | (nhóm)                    |
| Quản lý giáo dục Mầm non     | 3.1.1. | Hồ sơ cán bộ, giáo viên          | `/staff`                  |
| Quản lý giáo dục Mầm non     | 3.2.   | Đánh giá chuẩn nghề nghiệp       | `/professional-standards` |
| Quản lý giáo dục Mầm non     | 4.     | Học sinh                         | (nhóm)                    |
| Quản lý giáo dục Mầm non     | 4.1.   | Hồ sơ học sinh                   | (nhóm)                    |
| Quản lý giáo dục Mầm non     | 4.1.1. | Quản lý hồ sơ học sinh           | `/children`               |
| Quản lý giáo dục Mầm non     | 4.1.2. | Nhập dữ liệu từ Excel            | `/imports`                |
| Quản lý giáo dục Mầm non     | 4.1.6. | Nhóm học sinh                    | `/child-groups`           |
| Quản lý giáo dục Mầm non     | 4.3.   | Cân nặng, chiều cao              | (nhóm)                    |
| Quản lý giáo dục Mầm non     | 4.3.1. | Nhập kết quả sức khỏe nuôi dưỡng | `/growth`                 |
| Quản lý giáo dục Mầm non     | 4.3.2. | Tổng hợp cân nặng, chiều cao     | `/growth-report`          |
| Quản lý giáo dục Mầm non     | 4.4.   | Hoàn thành chương trình          | `/program-completion`     |
| Quản lý giáo dục Mầm non     | 4.5.   | Thực đơn bữa ăn                  | `/kitchen`                |
| Quản lý giáo dục Mầm non     | 4.6.   | Sức khỏe học sinh                | (nhóm)                    |
| Quản lý giáo dục Mầm non     | 4.6.1. | Y tế học đường                   | `/health`                 |
| Quản lý giáo dục Mầm non     | 4.6.2. | Thuốc và dặn thuốc               | `/medicines`              |
| Quản lý giáo dục Mầm non     | 4.7.   | Điểm danh                        | `/attendance`             |
| Quản lý giáo dục Mầm non     | 5.     | Công cụ hỗ trợ                   | (nhóm)                    |
| Quản lý giáo dục Mầm non     | 5.1.   | Thống kê lớp, nhân sự, học sinh  | `/statistics`             |
| Quản lý giáo dục Mầm non     | 5.8.   | Thống kê hồ sơ chưa nhập đủ      | `/missing-profiles`       |
| Quản lý cơ sở vật chất, TBDH | 1.     | Cơ sở vật chất                   | (nhóm)                    |
| Quản lý cơ sở vật chất, TBDH | 1.1.   | Khai báo cơ sở vật chất          | `/facility-rooms`         |
| Quản lý cơ sở vật chất, TBDH | 2.     | Thiết bị dạy học                 | (nhóm)                    |
| Quản lý cơ sở vật chất, TBDH | 2.1.   | Tổng hợp thiết bị dạy học        | `/equipment`              |
| Báo cáo số liệu              | 1.     | Báo cáo đầu năm                  | (nhóm)                    |
| Báo cáo số liệu              | 1.1.   | Báo cáo EMIS đầu năm             | `/emis`                   |
| Quản trị hệ thống            | 1.     | Người dùng và phân quyền         | (nhóm)                    |
| Quản trị hệ thống            | 1.1.   | Nhóm người dùng                  | `/roles`                  |
| Quản trị hệ thống            | 1.4.   | Danh sách người dùng             | `/accounts`               |
| Quản trị hệ thống            | 2.     | Thiết lập                        | (nhóm)                    |
| Quản trị hệ thống            | 2.1.   | Năm học                          | `/academic-years`         |
| Quản trị hệ thống            | 2.2.   | Cây đơn vị                       | `/org-units`              |
| Quản trị hệ thống            | 2.3.   | Phòng ban và chức danh           | `/departments`            |
| Quản trị hệ thống            | 2.4.   | Danh mục dùng chung              | `/catalogs`               |
| Quản trị hệ thống            | 2.5.   | Phòng học và bậc học             | `/rooms`                  |
| Quản trị hệ thống            | 2.6.   | Hạn mức phê duyệt                | `/approval-thresholds`    |
| Quản trị hệ thống            | 3.     | Kết nối và nhật ký               | (nhóm)                    |
| Quản trị hệ thống            | 3.1.   | Khóa API cho đối tác             | `/api-clients`            |
| Quản trị hệ thống            | 3.2.   | Kết nối ngoài                    | `/integrations`           |
| Quản trị hệ thống            | 3.3.   | Nhật ký thao tác                 | `/audit-logs`             |
| Tài chính – học phí          | 1.     | Học phí và dịch vụ               | (nhóm)                    |
| Tài chính – học phí          | 1.1.   | Biểu phí và dịch vụ              | `/fees`                   |
| Tài chính – học phí          | 1.2.   | Đăng ký dịch vụ                  | `/registrations`          |
| Tài chính – học phí          | 1.3.   | Học phí                          | `/invoices`               |
| Tài chính – học phí          | 1.4.   | Duyệt miễn giảm và điều chỉnh    | `/fee-approvals`          |
| Tài chính – học phí          | 1.5.   | Công nợ                          | `/debts`                  |
| Tài chính – học phí          | 1.6.   | Nhắc nợ và xử lý quá hạn         | `/debt-collection`        |
| Tài chính – học phí          | 2.     | Thu chi                          | (nhóm)                    |
| Tài chính – học phí          | 2.1.   | Phiếu thu                        | `/receipts`               |
| Tài chính – học phí          | 2.2.   | Phiếu chi                        | `/payments`               |
| Tài chính – học phí          | 2.3.   | Quỹ và ngân hàng                 | `/cash-accounts`          |
| Tài chính – học phí          | 2.4.   | Sổ quỹ                           | `/cash-book`              |
| Tài chính – học phí          | 2.5.   | Đối chiếu ngân hàng              | `/bank-reconciliation`    |
| Tài chính – học phí          | 2.6.   | Nợ nhà cung cấp                  | `/payables`               |
| Tài chính – học phí          | 2.7.   | Khoản mục thu chi                | `/cashflow-categories`    |
| Tài chính – học phí          | 3.     | Kế toán                          | (nhóm)                    |
| Tài chính – học phí          | 3.1.   | Sổ kế toán                       | `/ledger`                 |
| Tài chính – học phí          | 3.2.   | Chốt kỳ tài chính                | `/fiscal-periods`         |
| Nhân sự – chấm công, lương   | 1.     | Chấm công và nghỉ phép           | (nhóm)                    |
| Nhân sự – chấm công, lương   | 1.1.   | Chấm công                        | `/staff-attendance`       |
| Nhân sự – chấm công, lương   | 1.2.   | Đơn nghỉ phép                    | `/leave-requests`         |
| Nhân sự – chấm công, lương   | 1.3.   | Quy định phép năm                | `/leave-policies`         |
| Nhân sự – chấm công, lương   | 1.4.   | Ngày lễ và lịch bù               | `/school-days`            |
| Nhân sự – chấm công, lương   | 1.5.   | Lịch công tác                    | `/work-schedules`         |
| Nhân sự – chấm công, lương   | 2.     | Lương                            | (nhóm)                    |
| Nhân sự – chấm công, lương   | 2.1.   | Bảng lương                       | `/payrolls`               |
| Nhân sự – chấm công, lương   | 2.2.   | Quyết toán và điều chỉnh lương   | `/payroll-settlements`    |
| Nhân sự – chấm công, lương   | 2.3.   | Danh mục lương và biểu thuế      | `/pay-items`              |
| Nhân sự – chấm công, lương   | 2.4.   | Thưởng và khấu trừ               | `/bonus-deductions`       |
| Nhân sự – chấm công, lương   | 2.5.   | Phiếu lương của tôi              | `/my-payslips`            |
| Nhân sự – chấm công, lương   | 3.     | Công việc và đánh giá            | (nhóm)                    |
| Nhân sự – chấm công, lương   | 3.1.   | Công việc và kế hoạch            | `/work`                   |
| Nhân sự – chấm công, lương   | 3.2.   | Đánh giá nhân sự                 | `/evaluations`            |
| Bếp – kho, mua hàng          | 1.     | Kho và tài sản                   | `/inventory`              |
| Bếp – kho, mua hàng          | 2.     | Đề nghị mua hàng                 | `/purchase-requests`      |
| Tương tác – truyền thông     | 1.     | Tương tác với phụ huynh          | `/interactions`           |
| Tương tác – truyền thông     | 2.     | Hoạt động và tin tức             | `/activities`             |
| Giảng dạy                    | 1.     | Bài học và giáo án               | `/teaching`               |
| Tuyển sinh, tuyển dụng       | 1.     | Tuyển sinh                       | `/admissions`             |
| Tuyển sinh, tuyển dụng       | 2.     | Tuyển dụng                       | `/recruitment`            |
| Báo cáo                      | 1.     | Báo cáo và bảng điều khiển       | `/reports`                |

## Quyền

| PQ | Không có quyền mới. Mục menu hiện theo đúng điều kiện của thanh điều hướng cũ (`apps/portal/src/pages/menu-permissions.ts`); máy chủ vẫn kiểm tra quyền ở mọi yêu cầu (AI-12). Cấu hình lưới không cần quyền riêng, mỗi tài khoản chỉ đọc, ghi cấu hình của mình |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/grid-settings/grid-settings.test.ts` và `apps/api/src/quick-links/quick-links.test.ts` ngày 14/10/2026:

- CT-15a-1: Gọi đọc, ghi cấu hình lưới khi chưa đăng nhập: bị từ chối 401 — đạt.
- CT-15a-2: Tài khoản mới đọc cấu hình lưới Hồ sơ nhân sự: trả `columns` null, `page_size` null — đạt.
- CT-15a-3: Lưu cột theo thứ tự và 50 dòng mỗi trang, lưu lần hai, gửi hai giá trị null: đọc lại đúng thứ tự; lần hai ghi đè; trở về mặc định — đạt.
- CT-15a-4: Hai tài khoản, hai lưới và lưới `default`: cấu hình riêng từng tài khoản, từng lưới; tài khoản khác không thấy — đạt.
- CT-15a-5: Khóa lưới ngoài danh sách khi đọc, ghi: lỗi dữ liệu 400, trường `gridKey` — đạt.
- CT-15a-6: Số dòng 30, cột trùng, cột rỗng, cột ở lưới `default`, quá 100 cột: lỗi dữ liệu kèm trường lỗi, cấu hình cũ giữ nguyên — đạt.
- CT-15a-13: Cây menu của cổng quản trị: mỗi trang chỉ có ở một mục, mọi mục ghim được vào Truy cập nhanh, số thứ bậc nối tiếp mục cha và không trùng, nhóm có mục con, lá có đường dẫn — đạt.

Kiểm thử giao diện ngày 14/10/2026:

- CT-15a-7: Hiệu trưởng bấm "4. Học sinh", bấm ra ngoài, mở lại, rê "4.1. Hồ sơ học sinh", chọn "4.1.1. Quản lý hồ sơ học sinh"; mở trang qua trợ giúp theo tên mục và theo đường dẫn: menu mở, đóng khi bấm ra ngoài, menu cấp hai bật ra, vào `/children`, mục được tô sáng (`aria-current`, gạch chân mục cấp một), phân hệ tự chuyển — đạt.
- CT-15a-8: Chỉ dùng bàn phím: mũi tên trái, phải vòng quanh mục cấp một; Enter mở menu; mũi tên phải mở menu con; mũi tên xuống; Esc hai lần; mũi tên lên; mũi tên trái sang menu "3. Nhân sự"; Space trên "3.1.1. Hồ sơ cán bộ, giáo viên": con trỏ đúng mục ở từng bước, Esc đóng từng cấp và trả con trỏ về mục cha, Space mở `/staff` — đạt.
- CT-15a-9: Chọn phân hệ Quản trị hệ thống, tải lại, mở `/children` bằng đường dẫn; giáo viên đăng nhập: chỉ thanh menu của phân hệ đang chọn hiện, tải lại vẫn giữ, menu tự chuyển sang Quản lý giáo dục Mầm non; giáo viên không có mục Danh sách người dùng — đạt.
- CT-15a-10: Màn hình rộng 375 điểm ảnh, bấm nút "Menu chức năng", mở "4. Học sinh", "4.1. Hồ sơ học sinh", chọn trang, mở lại: không có thanh menu ngang; cây menu gập mở, đóng từng nhóm; vào `/children`, cây đóng; mở lại thì nhánh của trang đã mở sẵn — đạt.
- CT-15a-11: Mở menu người dùng, Esc, Cấu hình hiển thị lưới chọn 50 rồi tải lại, mở Tài khoản, Thông báo, Đổi mật khẩu: menu có đúng bốn mục, Esc đóng, số dòng mặc định 50 giữ sau khi tải lại và áp cho lưới Tài khoản, mở đúng trang — đạt.
- CT-15a-12: Ở Tài khoản lọc 11 tài khoản cùng từ khóa, ẩn cột Vai trò, hiện Tên đăng nhập, đưa Trạng thái lên, chọn 10 dòng, tải lại, chọn cả trang, bỏ một dòng, sang trang 2, mở rộng tìm kiếm lọc trạng thái, tìm tài khoản, gỡ vai trò: thứ tự cột và số dòng giữ sau khi tải lại; "Đã chọn 10 dòng" rồi "9 dòng", sang trang thì bỏ lựa chọn; nút Gỡ chỉ bấm được sau khi tích "Tôi đã đọc và đồng ý xóa …", vai trò bị gỡ, vai trò còn lại giữ nguyên — đạt.
- CT-15a-14: Mọi tệp kiểm thử giao diện mở trang qua trợ giúp `openMenu` (theo đường dẫn), kiểm tra người không có quyền bằng `expectNoMenuLink`; Truy cập nhanh ghim "Quản lý hồ sơ học sinh", "Công nợ" từ cây menu khi các menu đóng: các luồng cũ chạy như trước — đạt.

Kiểm thử đơn vị toàn bộ (`pnpm -r --workspace-concurrency=1 --no-bail test`): 667 ca, 665 đạt; hai ca không đạt là PQ-10 và CTC-DD-041, đã biết chỉ hỏng trên máy phát triển (cơ sở dữ liệu định danh dùng chung), không liên quan phần này. Kiểm thử giao diện cả bộ 77 ca: 77 ca đạt ngày 14/10/2026 (`pnpm test:e2e`); hai lần chạy trước đó có ca của `05-settings.spec.ts` (giáo viên đăng nhập) chậm quá 5 giây vì ca lưới Tài khoản tải cả danh sách tài khoản nhiều lần làm dịch vụ định danh bận; đã sửa ca lưới lọc theo từ khóa.

## Hạn chế

- Chưa có mục Hồ sơ cá nhân, Danh sách ý kiến đã gửi, Hướng dẫn trong menu người dùng (cổng quản trị chưa có các trang này; Gửi phản hồi làm ở phần 15g).
- Hộp "Cấu hình hiển thị lưới" mới có số dòng mỗi trang mặc định; chưa có "nhảy cột, nhảy dòng khi nhập trên lưới" của Sở vì lưới chưa cho nhập trực tiếp.
- Chỉ hai màn hình Tài khoản và Hồ sơ nhân sự dùng lưới mới; các màn hình khác vẫn dùng bảng riêng đến phần 15f. Cột của hai màn hình chưa đổi theo đúng danh sách cột của Sở (làm ở 15d, 15e). Chọn nhiều dòng chưa có thao tác hàng loạt; nút Xuất Excel, Xuất PDF của lưới chưa làm.
- Mục "4.1.2. Nhập dữ liệu từ Excel" dùng chung cho nhập học sinh, nhân sự, công nợ đầu kỳ; tách thành 2.2 Nhập lớp học, 3.1.3 Nhập nhân sự, 4.1.2 Nhập học sinh khi màn hình nhập dữ liệu được tách (15b, 15c, 15d). Khai báo tuần (3.4) và Chuyển hồ sơ lên năm học mới (5.7) vẫn nằm trong màn hình Năm học.
- Danh sách tài khoản đọc ở dịch vụ định danh có lúc chậm khi cơ sở dữ liệu định danh có rất nhiều tài khoản (cơ sở dữ liệu dùng chung của máy phát triển); kiểm thử giao diện của lưới Tài khoản lọc theo từ khóa và chờ đến 30 giây. Cách đọc danh sách ở dịch vụ định danh (đọc hết rồi cắt trang) chưa đổi trong phần này.
- Thứ tự Tab: chỉ một mục của thanh menu nằm trong thứ tự Tab; menu sổ xuống bên phải có thể tràn khỏi màn hình rộng vừa đủ khi mở cấp ba ở mục cuối thanh (chưa tự lật sang trái).
