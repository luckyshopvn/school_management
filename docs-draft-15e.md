# Nháp tài liệu DT-15 phần 15e — Quản trị hệ thống theo hệ thống của Sở: nhóm người dùng, phân quyền theo cây menu, danh sách người dùng (YCTD-109)

## YCTD

### YCTD-109: Phân hệ Quản trị hệ thống theo hệ thống của Sở (DT-15 phần 15e) – 2026-10-14

- Lý do: Eric quyết định ngày 2026-10-13 đồng bộ cổng quản trị theo hệ thống quản lý trường học của Sở GD&ĐT TP.HCM (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2 lựa chọn 3, mục 3.2, mục 5 đợt 15e; khảo sát `31_KHAO_SAT_HE_THONG_SO.md` mục 7). Phần 15e làm phân hệ Quản trị hệ thống: 1.1 Nhóm người dùng, 1.3 Phân quyền nhóm theo menu (ma trận quyền hiển thị theo cây menu, giữ mã quyền theo thao tác), 1.4 Danh sách người dùng (cột và bộ lọc theo Sở), tiêu đề có số menu cho các màn hình quản trị khác; sửa danh sách người dùng chậm khi có khoảng 30 nghìn tài khoản. Không đổi nghiệp vụ. Các điểm chi tiết dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi:
  - Điều kiện quyền của từng mục menu chuyển từ cổng quản trị (`apps/portal/src/pages/menu-permissions.ts`) sang gói dùng chung (`packages/shared/src/menu-permissions.ts`, `MENU_PERMISSION_RULES`) dưới dạng khai báo: một mã quyền, "một trong" (`anyOf`), "tất cả" (`allOf`) hoặc "cổng" (`gate`: điều kiện chung của cả nhóm menu cũ, ví dụ phải có một quyền tài chính bất kỳ). Kết quả hiện, ẩn mục giữ đúng như trước (kiểm thử so với điều kiện cũ trên hơn 3 nghìn tổ hợp quyền). Từ điều kiện suy ra "quyền của mục" (`menuPermissionCodes`: các mã trong điều kiện, không kể mã chỉ nằm ở cổng) và "quyền ở cổng" (`menuGatePermissionCodes`). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: quyền ở cổng không tính là quyền của mục, để tích một mục không cấp kèm cả nhóm quyền tài chính.
  - 1.1 Nhóm người dùng (vai trò): danh sách trên lưới dữ liệu chung (khóa lưới `roles`), cột theo Sở: Mã nhóm, Tên nhóm, Hiệu lực, Là nhóm quản trị, Là nhóm hệ thống; cột ẩn mặc định Số quyền; tìm theo mã, tên. "Là nhóm quản trị" là nhóm có quyền quản lý tài khoản (`P01.account.manage` hoặc `P01.account.manage-in-unit`); "Hiệu lực" luôn là "Có" vì chưa có chức năng ngừng dùng nhóm (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11). Nút Thêm mới mở biểu mẫu "Thêm nhóm người dùng" theo khối, nhãn bên trái (Mã nhóm, Tên nhóm), nút Ghi, Đóng. Nút "Phân quyền" trên dòng mở 1.3 với nhóm đó chọn sẵn (`/role-permissions?role=<mã nhóm>`). Ma trận quyền theo phân hệ chức năng cũ bỏ khỏi màn hình này.
  - 1.3 Phân quyền nhóm theo menu (mục menu mới, đường dẫn `/role-permissions`): chọn Nhóm người dùng và Phân hệ (mặc định tất cả phân hệ và quyền khác). Cây menu đánh số của từng phân hệ: nhóm menu hiện số và tên; mỗi mục lá có ô "Chọn mục <số> <tên>" (đánh dấu khi đã chọn hết quyền của mục, lưng chừng khi mới chọn một phần), dưới là từng quyền của mục (mô tả và mã) chỉnh được riêng; dòng "Mục chỉ hiện khi nhóm có thêm một trong các quyền: …" nêu quyền ở cổng; mục không có điều kiện ghi "mọi người dùng đều thấy mục này". Một quyền thuộc nhiều mục thì tích ở mục nào cũng đổi ở mọi mục. Quyền không gắn với mục menu nào nằm ở khối "Quyền khác", nhóm theo phân hệ chức năng, có ô chọn cả nhóm. Nút Ghi (ở đầu và cuối), Chọn tất cả quyền, Bỏ chọn tất cả, dòng "Đã chọn N/M quyền". Ghi bằng điểm cuối cũ `PUT /api/v1/roles/{id}/permissions` (thay toàn bộ quyền của nhóm). Chỉ người có `P01.account.manage` (VT-01, VT-02) sửa được; VT-03 xem ở chế độ chỉ đọc kèm thông báo; máy chủ vẫn kiểm tra như trước (PQ-13).
  - 1.4 Danh sách người dùng (tài khoản): cột theo Sở: Tên đăng nhập (tên đăng nhập, không có thì số điện thoại), Tên hiển thị (luôn hiện), Nhóm quyền (tên các nhóm), Loại tài khoản (Phụ huynh khi chỉ có VT-14; Cán bộ, nhân viên; Chưa có nhóm quyền), Trạng thái, Trạng thái đổi mật khẩu (Chờ đổi mật khẩu, Đã đổi); cột ẩn mặc định: Ngày hết hiệu lực, Số điện thoại, Đăng nhập gần nhất. "Mở rộng tìm kiếm" có bộ lọc theo Sở: Nhóm quyền, Trạng thái, Trạng thái đổi mật khẩu, Tên đăng nhập, Tên nhân sự; ô tìm kiếm chung giữ nguyên. Biểu mẫu tạo tài khoản và chi tiết tài khoản ở khung bên phải giữ như phần 15a.
  - Danh sách người dùng nhanh: `GET /api/v1/users` của dịch vụ định danh lọc, đếm và cắt trang ngay trong câu truy vấn (`count(*)`, `limit`, `offset`, sắp theo họ tên rồi mã), chỉ đọc vai trò của các tài khoản trên trang; trước đây đọc mọi tài khoản cùng vai trò, quyền rồi mới cắt trang. Phạm vi của VT-03 viết lại bằng điều kiện `exists` đúng như `canManageAccount`: tài khoản có ít nhất một vai trò, mọi vai trò nằm trong đơn vị được gán (gán ở Trường chính là toàn trường) và không phải VT-01, VT-02. Từ khóa thoát ký tự `%`, `_`. Thêm tham số `login`, `full_name`, `must_change_password`; dạng trả về giữ nguyên. Thêm hai chỉ mục (tệp `0041`). Với 30 nghìn tài khoản phụ huynh, một trang 50 dòng lọc theo nhóm quyền trả về dưới 1,5 giây trên máy phát triển (kiểm thử CT-15e-9).
  - Các màn hình quản trị khác có tiêu đề kèm số menu lấy từ cây menu (`apps/portal/src/pages/page-title.ts`): 2.1. Năm học, 2.2. Cây đơn vị, 2.3. Phòng ban và chức danh, 2.4. Danh mục dùng chung, 2.5. Phòng học và bậc học, 2.6. Hạn mức phê duyệt, 3.1. Khóa API cho đối tác, 3.2. Kết nối ngoài, 3.3. Nhật ký thao tác; 1.1, 1.3, 1.4 cũng vậy.
  - 3.1 Khóa API cho đối tác: danh sách khóa trên lưới dữ liệu chung (khóa lưới `api-clients`; cột Đối tác, Phạm vi, Khóa, Hết hạn, Trạng thái; cột ẩn mặc định Địa chỉ mạng cho phép, Căn cứ pháp lý, Dùng gần nhất; nút Thu hồi trên dòng). Biểu mẫu cấp khóa giữ nguyên.
  - 3.3 Nhật ký thao tác: hai thẻ Nghiệp vụ, Tài khoản và quyền giữ nguyên; mỗi thẻ là lưới dữ liệu chung (khóa lưới `audit-logs`, phân trang ở máy chủ, số dòng mỗi trang theo cấu hình lưới); "Mở rộng tìm kiếm" có Đối tượng (thẻ Nghiệp vụ), Từ ngày, Đến ngày (điểm cuối đã nhận `from_date`, `to_date` từ trước). Hai điểm cuối nhật ký nhận `page_size` đến 200 (trước là 100) để khớp số dòng của lưới.
  - Các màn hình Năm học, Cây đơn vị, Phòng ban và chức danh, Danh mục dùng chung, Phòng học và bậc học, Hạn mức phê duyệt, Kết nối ngoài không phải danh sách thuần (biểu mẫu, cây, bảng sửa tại chỗ) nên chỉ đổi tiêu đề (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).
- Thành phần bị ảnh hưởng: `14`, `16`, `17`, `21`, `24`, `08` (nếu ghi mô tả ma trận quyền); cổng quản trị, dịch vụ định danh, máy chủ API, gói dùng chung, kiểm thử giao diện.
- Dữ liệu bị ảnh hưởng: tệp `database/identity/migrations/0041_add_account_list_indexes.ts` thêm chỉ mục `users_full_name_id_index` trên `users (full_name, id)` và `user_roles_role_id_index` trên `user_roles (role_id)`; không đổi bảng, không đổi dữ liệu.
- API bị ảnh hưởng: `GET /api/v1/users` thêm tham số lọc `login`, `full_name`, `must_change_password`, cách đọc đổi sang phân trang trong câu truy vấn (dạng trả về giữ nguyên); `GET /api/v1/audit-logs`, `GET /api/v1/users/audit-logs` nhận `page_size` đến 200; `DATA_GRID_KEYS` thêm `roles`, `api-clients`, `audit-logs` nên `GET`, `PUT /api/v1/me/grid-settings/{gridKey}` nhận thêm ba khóa.
- Giao diện bị ảnh hưởng: 1.1 Nhóm người dùng, 1.3 Phân quyền nhóm theo menu (mới), 1.4 Danh sách người dùng, Khóa API cho đối tác, Nhật ký thao tác; tiêu đề các màn hình quản trị.
- Quyền bị ảnh hưởng: không có quyền mới; mục 1.3 hiện cho người thấy 1.1, 1.4 (`P01.account.manage` hoặc `P01.account.manage-in-unit`); chỉ `P01.account.manage` sửa được quyền như trước.
- Ảnh hưởng chức năng cũ: ma trận quyền chuyển từ màn hình Vai trò và quyền sang 1.3; nút "Lưu quyền của vai trò", "Tạo vai trò" đổi thành "Ghi"; bộ lọc Trạng thái của Nhật ký thao tác và lựa chọn Đối tượng chuyển vào "Mở rộng tìm kiếm"; cột của danh sách người dùng đổi theo Sở (cấu hình cột đã lưu của lưới `accounts` có mã cột `username` không còn dùng thì bị bỏ qua).
- Kiểm thử cần thực hiện: CT-15e-1 đến CT-15e-14; cập nhật `tests/e2e/01-login.spec.ts`, `02-academic-years.spec.ts`, `04-accounts.spec.ts`, `05-settings.spec.ts` theo tiêu đề và bố cục mới.
- Trạng thái: Đã triển khai

## Bảng

| users | Thêm chỉ mục `users_full_name_id_index (full_name, id)` cho danh sách người dùng sắp theo họ tên và phân trang (DT-15 phần 15e) | Không đổi cột |
| user_roles | Thêm chỉ mục `user_roles_role_id_index (role_id)` cho lọc theo nhóm quyền (DT-15 phần 15e) | Không đổi cột |

## Điểm cuối

| GET | /api/v1/users | Thêm tham số `login` (khớp một phần tên đăng nhập hoặc số điện thoại), `full_name` (khớp một phần họ tên), `must_change_password` (`true`, `false`); `q`, `status`, `role_code`, `page`, `page_size` (1 đến 200) giữ nguyên. Lọc, đếm, phân trang trong câu truy vấn; `total` là số tài khoản sau lọc và sau phạm vi; giá trị sai trả `ERR_VALIDATION` (400) |
| GET | /api/v1/audit-logs | `page_size` từ 1 đến 200 (trước là 100) |
| GET | /api/v1/users/audit-logs | `page_size` từ 1 đến 200 (trước là 100) |

`gridKey` của `GET`, `PUT /api/v1/me/grid-settings/{gridKey}` nhận thêm `roles`, `api-clients`, `audit-logs`.

## Màn hình

| 1.1 Nhóm người dùng | Lưới dữ liệu chung: Mã nhóm, Tên nhóm, Hiệu lực, Là nhóm quản trị, Là nhóm hệ thống (ẩn mặc định Số quyền); tìm theo mã, tên; Thêm mới mở biểu mẫu nhãn bên trái, nút Ghi; nút Phân quyền trên dòng mở 1.3 | Người có `P01.account.manage` hoặc `P01.account.manage-in-unit`; chỉ `P01.account.manage` thêm được nhóm |
| 1.3 Phân quyền nhóm theo menu | Chọn nhóm, phân hệ; cây menu đánh số, mỗi mục có ô chọn cả mục và các quyền của mục, quyền ở cổng; khối Quyền khác; Ghi, Chọn tất cả quyền, Bỏ chọn tất cả | Như 1.1; chỉ `P01.account.manage` sửa được, người khác xem chỉ đọc |
| 1.4 Danh sách người dùng | Lưới dữ liệu chung, phân trang ở máy chủ: Tên đăng nhập, Tên hiển thị, Nhóm quyền, Loại tài khoản, Trạng thái, Trạng thái đổi mật khẩu (ẩn mặc định Ngày hết hiệu lực, Số điện thoại, Đăng nhập gần nhất); Mở rộng tìm kiếm: Nhóm quyền, Trạng thái, Trạng thái đổi mật khẩu, Tên đăng nhập, Tên nhân sự | Như cũ |
| 3.1 Khóa API cho đối tác | Danh sách khóa trên lưới dữ liệu chung, Thu hồi trên dòng | Như cũ |
| 3.3 Nhật ký thao tác | Mỗi thẻ là lưới dữ liệu chung phân trang ở máy chủ; Mở rộng tìm kiếm: Đối tượng, Từ ngày, Đến ngày | Như cũ |

Tiêu đề các màn hình 2.1 đến 2.6, 3.2 có số menu. Số MH do người điều phối đánh khi gộp tài liệu.

## Quyền

| PQ | Không có quyền mới. Điều kiện hiện mục menu ở `packages/shared/src/menu-permissions.ts`, kết quả như trước; mục 1.3 theo điều kiện của 1.1, 1.4. Sửa quyền của nhóm vẫn chỉ VT-01, VT-02 (`P01.account.manage`), máy chủ kiểm tra lại (AI-12, PQ-13); danh sách người dùng của VT-03 vẫn chỉ gồm tài khoản có mọi vai trò trong đơn vị của mình |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/quick-links/menu-permissions.test.ts` và `apps/api/src/accounts-list.test.ts` ngày 14/10/2026:

- CT-15e-1: Duyệt mọi điều kiện quyền của mục menu: mọi mã quyền là mã có thật, mọi điều kiện gắn với một mục của cây menu, mục có điều kiện có ít nhất một quyền — đạt.
- CT-15e-2: So điều kiện mới với điều kiện cũ của thanh điều hướng trên hơn 3 nghìn tổ hợp quyền (không quyền, đủ quyền, từng quyền một, tổ hợp ngẫu nhiên cố định hạt): mục hiện hay ẩn giống hệt; mục không có điều kiện luôn hiện — đạt.
- CT-15e-3: Quyền của mục 1.4, 3.1, Duyệt chứng từ học phí, Phiếu thu: là các mã trong điều kiện, quyền ở cổng (nhóm tài chính, quản lý tài khoản) tách riêng; mã vừa ở điều kiện vừa ở cổng chỉ tính là quyền của mục — đạt.
- CT-15e-4: Với mọi mục menu, chỉ có các quyền của mục và một quyền ở cổng: mục hiện — đạt.
- CT-15e-5: Mười tài khoản cùng nhãn, lọc theo tên nhân sự, 4 dòng mỗi trang, trang 1, 2, 3, 9: tổng 10, 3 trang, sắp theo họ tên, trang sau nối tiếp trang trước, trang vượt quá trống vẫn trả tổng; dòng vẫn kèm vai trò — đạt.
- CT-15e-6: Lọc theo nhóm quyền, trạng thái khóa, trạng thái đổi mật khẩu, tên đăng nhập (kể cả có ký tự `%`, `_`), từ khóa, kết hợp nhiều bộ lọc: đúng tài khoản, đúng tổng số — đạt.
- CT-15e-7: VT-03 gán ở Phân hiệu A, VT-03 gán ở Trường chính, Hiệu trưởng xem cùng danh sách: VT-03 Phân hiệu A chỉ thấy 5 tài khoản có mọi vai trò ở Phân hiệu A (tổng và số trang tính sau phạm vi); VT-03 Trường chính thấy mọi tài khoản có vai trò trừ VT-01, VT-02; Hiệu trưởng thấy cả tài khoản chưa có vai trò — đạt.
- CT-15e-8: Tham số sai (`must_change_password=co`, `page=0`, `page_size=201`, `status=khac`): lỗi dữ liệu 400 — đạt.
- CT-15e-9: Thêm 30 nghìn tài khoản phụ huynh, đọc trang 2 cỡ 50 lọc theo VT-14, tìm theo tên: dưới 1,5 giây, tổng từ 30 nghìn, đúng 50 dòng, tìm đúng 10 tài khoản — đạt.

Kiểm thử giao diện `tests/e2e/52-system-admin-so.spec.ts` ngày 14/10/2026:

- CT-15e-10: Hiệu trưởng mở 1.1 Nhóm người dùng, tìm VT-02, thêm nhóm mới bằng biểu mẫu nút Ghi: tiêu đề "1.1. Nhóm người dùng", cột theo Sở, VT-02 là nhóm quản trị và nhóm hệ thống, nhóm mới hiện trên lưới — đạt.
- CT-15e-11: Bấm Phân quyền của nhóm mới, tích mục "1.4. Danh sách người dùng", bỏ một quyền, Ghi, tải lại; người dùng của nhóm đăng nhập: mở đúng 1.3 với nhóm chọn sẵn, tích mục chọn cả hai quyền của mục và mục 1.1 cùng quyền cũng được chọn, bỏ một quyền thì mục lưng chừng, có khối Quyền khác, ghi xong tải lại vẫn còn quyền, người dùng của nhóm mở được 1.4 — đạt.
- CT-15e-12: Ba tài khoản cùng nhãn, lọc theo Tên nhân sự, Nhóm quyền, Trạng thái đổi mật khẩu, Tên đăng nhập: tổng 3, 2, 1, 1 dòng; cột Tên đăng nhập, Nhóm quyền, Loại tài khoản, Trạng thái đổi mật khẩu đúng — đạt.
- CT-15e-13: VT-03 mở 1.3: thông báo chỉ Hiệu trưởng và quản trị nền tảng sửa được, không có nút Ghi, ô chọn bị khóa — đạt.
- CT-15e-14: Mở lần lượt chín màn hình quản trị, Nhật ký thao tác lọc từ ngày 01/01/2100 rồi bỏ lọc, chuyển thẻ Tài khoản và quyền, mở Khóa API: tiêu đề đúng số menu; lưới nhật ký có đủ cột, lọc ra 0 dòng rồi có dòng; lưới khóa API có đủ cột — đạt.

Kiểm thử đơn vị toàn bộ (`pnpm -r --workspace-concurrency=1 --no-bail test`) và kiểm thử giao diện cả bộ (`pnpm test:e2e`): xem báo cáo cuối phần.

## Hạn chế

- Chưa có cột Mã nhân sự, Mã Bộ, Thời gian đổi mật khẩu, Ngày hết hạn mật khẩu và bộ lọc Mã định danh, Ngày hết hạn mật khẩu của Sở: dịch vụ định danh chưa lưu các thông tin này (hết hạn mật khẩu làm ở phần 15g). Chưa có nút Phân nhóm quyền hàng loạt, Cấp mật khẩu hàng loạt, Lấy danh sách CBQL/GV, Xuất Excel.
- Chưa có 1.2 Phân quyền nhóm theo phần mềm của Sở (tích cả phân hệ); ô Phân hệ ở 1.3 chỉ để lọc hiển thị.
- Cột Hiệu lực của nhóm người dùng luôn là "Có" vì chưa có chức năng ngừng dùng nhóm; chưa sửa, xóa nhóm người dùng (không có điểm cuối).
- Biểu mẫu tạo tài khoản và chi tiết tài khoản ở 1.4 vẫn ở khung bên phải, nhãn phía trên, nút "Tạo tài khoản" như phần 15a.
- Danh sách người dùng tìm theo từ khóa vẫn so khớp một phần (`like '%…%'`) nên không dùng được chỉ mục; với 30 nghìn tài khoản vẫn nhanh, nhiều hơn nữa cần chỉ mục trigram.
- Năm học, Cây đơn vị, Phòng ban và chức danh, Danh mục dùng chung, Phòng học và bậc học, Hạn mức phê duyệt, Kết nối ngoài chỉ đổi tiêu đề, chưa chuyển sang lưới dữ liệu chung.
