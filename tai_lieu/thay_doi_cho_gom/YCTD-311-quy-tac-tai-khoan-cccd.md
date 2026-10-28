---
yctd: YCTD-311
tieu_de: Quy tắc tài khoản theo số CCCD, mật khẩu mặc định có hạn, băm argon2id tường minh, nhân viên vận hành của công ty
ngay: 2026-10-28
phien_ban_de_xuat: 0.187.0
---

## 02 Nhật ký

### 2026-10-28 — Quy tắc tài khoản theo số CCCD và nhân viên vận hành

#### Công việc đã thực hiện

- Tên đăng nhập của tài khoản trường là số CCCD (số định danh cá nhân 12 chữ số). Dịch vụ định danh nhận `national_id` khi tạo tài khoản, hoặc nhận 12 chữ số gõ thẳng vào ô tên đăng nhập; kiểm 12 chữ số, mã tỉnh ở 3 số đầu (danh mục 63 tỉnh), năm sinh ở số thứ 4 đến 6 khi biết năm sinh; chỉ chặn khi sai rõ ràng. Phần kiểm thuần ở `packages/shared/src/national-id.ts` dùng chung cho dịch vụ định danh và máy chủ API.
- Tài khoản tạo theo số CCCD nhận mật khẩu mặc định từ biến môi trường `DEFAULT_INITIAL_PASSWORD` (chỉ ở `.env` của máy chủ, kho mã không có giá trị), phải đổi ở lần đăng nhập đầu; quá `initial_password_lifetime_days` ngày (mặc định 7, cấu hình từ 1 đến 90) mà chưa đổi thì không đăng nhập được, quản trị trường đặt lại. Cột mới `users.initial_password_expires_at`. Chưa đặt biến thì tài khoản mới nhận mật khẩu tạm ngẫu nhiên như trước, vẫn có hạn.
- Phân biệt loại tài khoản theo ứng dụng đang đăng nhập: cán bộ, giáo viên vào cổng quản trị và ứng dụng giáo viên; phụ huynh vào ứng dụng phụ huynh; học sinh chỉ vào ứng dụng học sinh. Một số CCCD vừa là giáo viên vừa là phụ huynh là một tài khoản có hai loại, mỗi ứng dụng mở phiên đúng loại; (số CCCD, loại) vì vậy là duy nhất. Sai loại thì báo như sai mật khẩu để không lộ tên đăng nhập thuộc loại nào.
- Hàng loạt: (a) "Tạo tài khoản cho nhân sự" (1.4 Danh sách người dùng, đồng bộ từ hồ sơ nhân sự) dùng số CCCD trong hồ sơ làm tên đăng nhập, hồ sơ chưa có số hợp lệ thì dùng mã nhân sự như trước; (b) "Khởi tạo" tài khoản học và thi dùng số định danh của học sinh, thiếu, sai hoặc lệch năm sinh thì dùng phương án dự phòng "hs" kèm mã Bộ GD&ĐT (CSDL ngành), rồi "hs" kèm số thứ tự; `STUDENT_USERNAME_RULE=ma_hoc_sinh` bỏ qua số định danh.
- Che số CCCD: danh sách tài khoản, danh sách tài khoản học và thi, kết quả tạo hàng loạt, nhật ký tài khoản, nhật ký thay đổi của hồ sơ nhân sự và sự kiện bảo mật (`security_events.login_identifier`) chỉ ghi `********` kèm 4 số cuối. Chi tiết tài khoản và tệp mật khẩu vừa cấp cho học sinh vẫn ghi đủ để trao tài khoản.
- Băm mật khẩu: tham số argon2id tường minh m=64 MiB, t=3, p=4 (khuyến nghị thứ hai của RFC 9106; đo trên máy phát triển khoảng 75 ms mỗi lần, mục tiêu dưới 250 ms), hạ được bằng `PASSWORD_HASH_MEMORY_KIB`, `PASSWORD_HASH_TIME_COST`, `PASSWORD_HASH_PARALLELISM` nhưng không thấp hơn mức tối thiểu OWASP (m=19 MiB, t=2). Đăng nhập đúng với giá trị băm tham số cũ thì băm lại: tài khoản trường, nhân viên vận hành nền tảng, tài khoản đơn vị cấp trên. Băm song song khi cấp tài khoản học sinh hàng loạt giảm từ 16 xuống 4 để giới hạn bộ nhớ.
- Nhân viên vận hành của công ty: thêm vai trò `platform_operators.role` (quản trị, hỗ trợ, kỹ thuật, kế toán; tài khoản đã có là quản trị). Trang "Nhân viên vận hành" ở cổng nền tảng (chỉ quản trị thấy): tạo nhân viên (đăng ký luôn xác thực hai lớp; mật khẩu tạm, khóa TOTP, mã khôi phục hiện một lần), đổi vai trò, khóa, mở khóa, cấp lại khóa hai lớp; tạo và cấp lại khóa phải nhập mã hai lớp của người thao tác. Tên đăng nhập là số CCCD, đổi sang thư điện tử công ty bằng `PLATFORM_OPERATOR_LOGIN_RULE=email`. Kế toán không mở được phiên hỗ trợ; chỉ quản trị sửa chính sách hỗ trợ. Nhân viên chỉ vào dữ liệu trường qua phiên hỗ trợ trường cấp (`support_access_grants`, `support-sessions`), không có tài khoản ở trường.
- Kiểm thử: `apps/identity/src/accounts/national-id-accounts.test.ts` CT-1511 đến CT-1518; `apps/api/src/student-records/student-records-so.test.ts` CT-1519; e2e `tests/e2e/221-tai-khoan-cccd.spec.ts` CT-1520 (lượt e2e dùng mật khẩu mặc định thử `E2E_DEFAULT_INITIAL_PASSWORD`).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: một người có một tài khoản ở trường (khóa là số CCCD), loại tài khoản suy từ vai trò và kênh đăng nhập, không tách thành nhiều bản ghi người dùng; giữ cách gán vai trò phụ huynh vào tài khoản sẵn có của giáo viên (YCTD-44, YCTD-45), tránh hai mật khẩu cho cùng một người.
- Tài khoản quản trị tổng `Admin` (YCTD-310, đọc từ `PLATFORM_SUPERADMIN_*`) là tài khoản vận hành nền tảng, không thuộc trường nào: quy tắc số CCCD và hạn mật khẩu mặc định không áp dụng (cột hạn trống, tên đăng nhập không phải 12 chữ số). Tài khoản trường đã có (tên đăng nhập tự do, số điện thoại) giữ nguyên; quy tắc áp cho tài khoản tạo mới bằng số CCCD.
- Tên đăng nhập lưu số CCCD dạng rõ ở dịch vụ định danh vì là định danh đăng nhập (như số điện thoại hiện nay) và máy chủ API đã lưu số CCCD mã hóa kèm giá trị băm có khóa ở hồ sơ. Chưa đổi sang so khớp bằng giá trị băm có khóa ở dịch vụ định danh: mất khóa là mọi người không đăng nhập được, cần quy trình xoay khóa riêng; ghi thành đề xuất.
- Pepper (khóa bí mật trộn vào băm mật khẩu) chưa làm: thư viện có tham số `secret` nhưng giá trị băm cũ không có pepper, cần đánh dấu phiên bản băm trong chuỗi và chuyển dần khi đăng nhập, cộng quy trình giữ và xoay khóa. Đề xuất làm thành phần riêng sau khi có kho bí mật của máy chủ chạy thật.
- Mật khẩu mặc định Eric đưa chỉ đặt ở `.env` cục bộ (đã nằm trong `.gitignore`), không có trong mã, dữ liệu mẫu, e2e hay tài liệu. Máy chủ chạy thật đặt qua biến môi trường. Biến sai chính sách (dưới 8 ký tự, thiếu chữ hoặc số) thì dịch vụ định danh không khởi động.

#### Đánh giá dùng số CCCD theo Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân 2025

- Số CCCD (số định danh cá nhân) là dữ liệu cá nhân cơ bản (khoản 3 Điều 2 Nghị định 13/2023/NĐ-CP), không phải dữ liệu nhạy cảm; Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực từ 01/01/2026) giữ cách phân loại này. Trường xử lý để định danh người dùng của hệ thống quản lý trường học theo nhiệm vụ của cơ sở giáo dục; nhà trường là bên kiểm soát dữ liệu, nhà cung cấp phần mềm là bên xử lý theo hợp đồng.
- Nguyên tắc tối thiểu và mục đích: chỉ dùng số CCCD làm tên đăng nhập, không hiện trên danh sách, nhật ký, không đưa vào đường dẫn khi tạo tài khoản; lưu mã hóa ở hồ sơ (máy chủ API), dạng rõ ở cột tên đăng nhập của dịch vụ định danh có phân quyền cơ sở dữ liệu riêng.
- Còn phải làm khi triển khai thật: (a) văn bản thông báo xử lý dữ liệu cá nhân của trường nêu việc dùng số CCCD làm tên đăng nhập; (b) bộ lọc "Tên đăng nhập" của danh sách người dùng đang gửi qua tham số đường dẫn, khi tìm theo số CCCD thì nên chuyển sang thân yêu cầu (đề xuất); (c) đánh giá tác động xử lý dữ liệu cá nhân của nhà trường cập nhật mục số CCCD; (d) trẻ dưới 16 tuổi (học sinh): số định danh của trẻ do cha mẹ hoặc người giám hộ cung cấp khi nhập học, cần có trong nội dung đồng ý của hồ sơ nhập học.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-311, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Màn hình tạo tài khoản ở cổng quản trị chưa có ô "Số CCCD" riêng (gõ 12 chữ số vào ô Tên đăng nhập là đủ); màn hình cấu hình chưa có ô sửa số ngày hạn mật khẩu mặc định (đặt qua `PUT /auth/settings`).
- Nhân viên vận hành chưa có màn hình tự đổi mật khẩu tạm ở cổng nền tảng; phân vai mới chặn ở quản lý nhân viên và phiên hỗ trợ, các trang khác (gói, thu phí, trường) còn mở cho mọi vai trò.
- Đề xuất: so khớp tên đăng nhập bằng giá trị băm có khóa; pepper cho băm mật khẩu; chuyển bộ lọc tên đăng nhập sang thân yêu cầu.

## 24 Yêu cầu thay đổi

### YCTD-311: Quy tắc tài khoản theo số CCCD, mật khẩu mặc định có hạn, băm argon2id tường minh, nhân viên vận hành – 2026-10-28

- Lý do: Eric yêu cầu "user là số CCCD của người dùng, mật khẩu mặc định … yêu cầu đổi mật khẩu đăng nhập lần đầu. Nhớ phân biệt loại tài khoản. Trừ tài khoản admin tổng quan", hỏi cách tạo tài khoản cho nhân viên công ty vận hành hỗ trợ các trường, và "nhớ thêm hàm băm mật khẩu".
- Nội dung thay đổi: tên đăng nhập là số CCCD có kiểm cấu trúc; mật khẩu mặc định từ biến môi trường, bắt đổi lần đầu, hết hạn sau số ngày cấu hình; phân loại tài khoản theo kênh đăng nhập; tạo hàng loạt từ hồ sơ nhân sự và học sinh theo số CCCD có phương án dự phòng; che số CCCD ở danh sách, nhật ký; tham số argon2id tường minh và băm lại khi đăng nhập; vai trò và màn hình quản lý nhân viên vận hành ở cổng nền tảng.
- Thành phần bị ảnh hưởng: `apps/identity` (đăng nhập, tạo tài khoản, cấu hình, băm mật khẩu, quản lý nhân viên vận hành, phiên hỗ trợ), `apps/api` (tạo tài khoản cho nhân sự, tài khoản học và thi), `apps/platform` (trang Nhân viên vận hành), `packages/shared` (kiểm số CCCD), `database` (identity 0183, platform 0241), `.env.example`, e2e.
- Dữ liệu, API, giao diện, quyền bị ảnh hưởng: cột `users.initial_password_expires_at`, `platform_operators.role`; `POST /api/v1/users` nhận `national_id`, trả `uses_initial_password`; cấu hình `initial_password_lifetime_days`; điểm cuối mới `GET, POST /api/v1/auth/platform/operators`, `PATCH /api/v1/auth/platform/operators/:id`, `POST /api/v1/auth/platform/operators/:id/totp-reset`; `GET /auth/platform/me` trả `role`; biến môi trường `DEFAULT_INITIAL_PASSWORD`, `PASSWORD_HASH_*`, `STUDENT_USERNAME_RULE`, `PLATFORM_OPERATOR_LOGIN_RULE`.
- Ảnh hưởng chức năng cũ: tài khoản chỉ có vai trò phụ huynh không vào được cổng quản trị, ứng dụng giáo viên; tài khoản không có vai trò phụ huynh không vào được ứng dụng phụ huynh. Danh sách tài khoản hiện tên đăng nhập 12 chữ số dạng che. Học sinh có số định danh hợp lệ được cấp tên đăng nhập là số định danh thay cho "hs" kèm mã Bộ.
- Kiểm thử cần thực hiện: `apps/identity` CT-1511 đến CT-1518 và toàn bộ kiểm thử của gói; `apps/api` CT-1519; e2e 221 (CT-1520), 01, 04; typecheck, lint, định dạng; `node scripts/gom-thay-doi.mjs --kiem`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Thay đổi chức năng: tên đăng nhập là số CCCD; mật khẩu mặc định từ biến môi trường, bắt đổi lần đầu, hết hạn sau 7 ngày (cấu hình được); phân biệt loại tài khoản theo ứng dụng; tạo hàng loạt theo số CCCD; che số CCCD ở danh sách, nhật ký (YCTD-311).
- Bảo mật: tham số argon2id tường minh m=64 MiB, t=3, p=4, băm lại khi đăng nhập nếu giá trị băm cũ yếu hơn.
- Cổng nền tảng: trang Nhân viên vận hành (vai trò quản trị, hỗ trợ, kỹ thuật, kế toán; xác thực hai lớp bắt buộc).
- Cấu trúc dữ liệu: identity 0183 (`users.initial_password_expires_at`), platform 0241 (`platform_operators.role`).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Quy tắc tài khoản theo số CCCD, mật khẩu mặc định có hạn, băm argon2id tường minh, nhân viên vận hành của công ty | YCTD-311 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1511 | P01-06 | Số CCCD: 12 chữ số, mã tỉnh trong danh mục, khớp năm sinh khi biết; che còn 4 số cuối | sai rõ ràng thì có lý do; tên khác không che | Kiểm thử tự động `apps/identity/src/accounts/national-id-accounts.test.ts` CT-1511 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1512 | P01-06 | Loại tài khoản theo vai trò: giáo viên kiêm phụ huynh có hai loại; học sinh; tài khoản chưa có vai trò | đúng tập loại | Kiểm thử tự động CT-1512 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1513 | P01-06 | Tham số argon2id tường minh; giá trị băm m=19 MiB, t=2, p=1 cần băm lại, giá trị băm hiện hành không cần | đúng | Kiểm thử tự động CT-1513 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1514 | P01-06 | Tạo tài khoản bằng `national_id` hoặc 12 chữ số ở tên đăng nhập | tên đăng nhập là số CCCD, mật khẩu mặc định, bắt đổi, hạn 7 ngày; nhật ký, danh sách chỉ hiện dạng che | Kiểm thử tự động CT-1514 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1515 | P01-06 | Số CCCD sai (thiếu số, mã tỉnh lạ, có chữ); trùng số CCCD | 400; trùng thì 409 | Kiểm thử tự động CT-1515 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1516 | P01-06 | Đăng nhập lần đầu bằng mật khẩu mặc định; quá hạn; quản trị đặt lại rồi đổi mật khẩu | bắt đổi; quá hạn thì 401, sự kiện bảo mật che số CCCD; đổi xong hết bắt đổi, xóa hạn | Kiểm thử tự động CT-1516 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1517 | P01-06 | Loại tài khoản theo ứng dụng: phụ huynh vào cổng quản trị, giáo viên vào ứng dụng phụ huynh, người có cả hai loại | sai loại thì 401 như sai mật khẩu; người có hai loại vào được cả ba kênh của mình, không vào kênh học sinh | Kiểm thử tự động CT-1517 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1518 | P01-06 | Đăng nhập đúng với giá trị băm tham số cũ | giá trị băm thay bằng tham số hiện hành, đăng nhập lại vẫn được | Kiểm thử tự động CT-1518 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1519 | P02-01 | Khởi tạo tài khoản học và thi cho học sinh có số định danh khớp năm sinh | tên đăng nhập là số định danh; danh sách hiện dạng che; học sinh có số lệch năm sinh vẫn dùng "hs" kèm mã Bộ | Kiểm thử tự động `apps/api/src/student-records/student-records-so.test.ts` CT-1519 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1520 | P01-06 | Giao diện: tài khoản theo số CCCD đăng nhập lần đầu bằng mật khẩu mặc định | chuyển tới MH-48 Đổi mật khẩu, đổi xong vào trang chủ; danh sách che số CCCD | Kiểm thử giao diện `tests/e2e/221-tai-khoan-cccd.spec.ts` | Đạt |
