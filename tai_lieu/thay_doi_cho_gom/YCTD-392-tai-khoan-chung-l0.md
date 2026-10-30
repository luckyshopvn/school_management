---
yctd: YCTD-392
tieu_de: Tài khoản dùng chung trên nền tảng, lát E0: đặc tả, bảo mật, bản mẫu, bản nháp pháp lý
ngay: 2026-10-30
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-10-30 — Tài khoản dùng chung trên nền tảng, lát E0 (YCTD-392)

#### Công việc đã thực hiện

- Khảo sát mã: tài khoản ở cơ sở dữ liệu định danh của từng trường (`users.phone`, `users.username` duy nhất trong trường, mật khẩu mặc định chung của trường); phụ huynh tạo khi duyệt hồ sơ học sinh (`ensureGuardianAccount`); quyền xem con theo `guardians.user_id`; luật mật khẩu, xác thực hai lớp theo trường; liên kết VNeID băm bằng khóa của trường nên không so được giữa hai trường; đăng nhập theo đơn vị ở tên miền chung và mã chuyển phiên một lần (`login_handoffs`) chỉ cho cổng quản trị; `users` chưa có số định danh.
- Lập đặc tả `tai_lieu/ban_mau/yctd-392/DAC_TA.md`: mô hình môi giới (nền tảng giữ danh tính, trường giữ dòng người dùng mang vai trò), bảng ở cơ sở dữ liệu nền tảng và ở trường, luồng kích hoạt, thêm trường, gợi ý và gộp, chọn nơi làm việc, thay đổi ở phía trường và người dùng, ảnh hưởng phân quyền, tách dữ liệu, Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP, danh sách lát E0 đến E5.
- Bản mẫu `tai_lieu/ban_mau/yctd-392/index.html`: MH-670 đến MH-675 ở ba khổ 1366, 1024, 390.
- Bản nháp bổ sung PL-02, PL-04, PL-05, PL-06, PL-07, PL-09, PL-14 và sáu câu hỏi cho luật sư: `tai_lieu/ban_mau/yctd-392/PHAP_LY.md`.
- Thêm BM-250 đến BM-256 ở `22_BAO_MAT.md`; sửa quyết định ở `47_KE_HOACH_THEO_HE_THONG_SO.md` mục 14 ("tài khoản không gộp giữa các trường") và mục 16.5.

#### Quyết định

- Eric ngày 2026-10-30: mỗi người một tài khoản dùng chung, chỉ khác phân quyền, một người có nhiều quyền ở nhiều trường; mô hình môi giới; áp cho nhân viên, giáo viên, phụ huynh, học sinh từ THCS; khóa gộp là số định danh cá nhân, bắt buộc khi cấp tài khoản mới; đăng nhập bằng số định danh hoặc số điện thoại, mã một lần và mật khẩu riêng, mã một lần khi vào trường trên thiết bị mới; tự thêm trường, có gợi ý; đăng nhập kiểu cũ giữ song song lâu dài; công tắc bật cho mọi trường; nền tảng đặt một luật bảo mật chung (mật khẩu tối thiểu 10 ký tự, không trùng 5 mật khẩu gần nhất, khóa 15 phút sau 5 lần sai, hai lớp bắt buộc với người có vai trò nhân viên); nền tảng trả phí tin nhắn; bật cả khi cơ sở dữ liệu nền tảng ở ngoài nước nhưng chỉ nhận số định danh thật sau khi có PL-07 phần nền tảng và PL-09 bổ sung; trang đăng nhập chung ở tên miền chung hiện có; mã của học sinh gửi tới số phụ huynh nhận tin, phụ huynh xác nhận khi con kích hoạt.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: tên bảng `account_identity*` (tránh nhầm `parent_org`); liên kết cần số định danh khớp và mã một lần tới số điện thoại trường ghi; tối đa 20 liên kết mỗi danh tính, 10 lần thêm trường mỗi giờ; xóa danh tính sau 30 ngày chờ; mã chức năng, quy tắc, tiêu chí, kịch bản, dữ liệu, API cấp ở từng lát có mã.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-392, `22_BAO_MAT.md` BM-250 đến BM-256, `47_KE_HOACH_THEO_HE_THONG_SO.md` mục 14, 16.5, `tai_lieu/ban_mau/yctd-392/`.

#### Vấn đề tồn đọng

- Chưa viết mã; làm tiếp từ lát E1 (số định danh ở `users`). Lát E1 nên làm trước hoặc cùng lát L3 của YCTD-390.
- Luật sư chưa trả lời LS-1 đến LS-6 ở `PHAP_LY.md`; chưa đưa các đoạn bổ sung vào mẫu ở `48_HO_SO_PHAP_LY`.

## 24 Yêu cầu thay đổi

### YCTD-392: Tài khoản dùng chung trên nền tảng – 2026-10-30

- Lý do: Eric quyết định ngày 2026-10-30 (khi duyệt YCTD-390, câu Q3) hướng đích là danh tính chung trên nền tảng; sau đó mở rộng thành một tài khoản cho mọi người dùng, chỉ khác phân quyền theo trường. Hiện mỗi người có một tài khoản ở mỗi trường, đăng nhập ở tên miền từng trường, mật khẩu và xác thực hai lớp theo trường.
- Nội dung thay đổi: danh tính chung ở cơ sở dữ liệu nền tảng (số định danh, số điện thoại đã xác minh, mật khẩu, xác thực hai lớp, phiên, nhật ký) liên kết tới dòng người dùng ở từng trường; trang đăng nhập chung ở tên miền chung, chọn trường và vai trò rồi chuyển phiên một lần sang tên miền trường; thêm trường, gợi ý liên kết khi trường tạo tài khoản; luật bảo mật chung; số định danh bắt buộc khi cấp tài khoản mới; học sinh từ THCS dùng tài khoản chung với đồng ý của phụ huynh. Làm theo lát E0 đến E5; chi tiết ở `tai_lieu/ban_mau/yctd-392/DAC_TA.md`. Lát E0: đặc tả, bảo mật, bản mẫu, bản nháp pháp lý.
- Yêu cầu bị thay đổi: `47_KE_HOACH_THEO_HE_THONG_SO.md` mục 14 "Tài khoản không gộp giữa các trường" và mục 16.5 "không làm đăng nhập theo đơn vị cho ứng dụng giáo viên, phụ huynh"; cấu hình mật khẩu, hai lớp của trường (YCTD-311, YCTD-323) chỉ còn áp cho đăng nhập kiểu cũ; PL-14 thêm bản số định danh mã hóa bằng khóa nền tảng.
- Thành phần bị ảnh hưởng (dự kiến): dịch vụ định danh, máy chủ API, cổng quản trị, ứng dụng giáo viên, phụ huynh, học sinh, vỏ ứng dụng cài đặt, cổng vận hành, cơ sở dữ liệu nền tảng và định danh; tài liệu `07`, `08`, `09`, `10`, `11`, `14`, `16`, `17`, `21`, `22`, `27`, `47`, `48`.
- Dữ liệu, API, quyền bị ảnh hưởng (dự kiến): nền tảng thêm `account_identities`, `account_identity_links`, `account_identity_totp`, `account_identity_recovery_codes`, `account_identity_password_history`, `account_identity_sessions`, `account_identity_devices`, `account_identity_codes`, `account_identity_events`; định danh của trường thêm số định danh ở `users`, cách đăng nhập `account_identity`, cấu hình `account_identity`; quyền mới ở cổng vận hành để tra, khóa danh tính. Lát E0 không đổi dữ liệu, API, quyền.
- Ảnh hưởng chức năng cũ: không ở lát E0. Từ E1: đăng nhập kiểu cũ ở tên miền trường, đăng nhập theo đơn vị, mã một lần của phụ huynh, VNeID, đổi mật khẩu lần đầu, phiên hỗ trợ của người vận hành giữ hành vi cũ ngoài các điểm ở "Yêu cầu bị thay đổi"; tạo tài khoản mới đòi số định danh.
- Kiểm thử cần thực hiện: lát E0 chỉ đổi tài liệu, chạy `node scripts/gom-thay-doi.mjs --kiem`; từ E1 chạy lại kiểm thử đăng nhập, mã một lần, hai lớp, đổi mật khẩu, VNeID, đăng nhập theo đơn vị, phiên hỗ trợ, ma trận tách trường, duyệt hồ sơ học sinh, e2e đăng nhập bốn ứng dụng.
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-30 (phương án, quyết định D1 đến D8 và M1 đến M3, bản mẫu MH-670 đến MH-675, danh sách lát).
- Trạng thái: Đã phê duyệt

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P01 Nền tảng, đơn vị và phân quyền | YCTD-392 lát E0 (tài khoản dùng chung trên nền tảng: đặc tả, bảo mật, bản mẫu, bản nháp pháp lý; E1 đến E5 chưa làm) |

## Thêm dòng

| 22_BAO_MAT.md | BM-215 | BM-250 | Số định danh làm khóa gộp tài khoản (YCTD-392): ở nền tảng mã hóa bằng khóa mã hóa của nền tảng, băm bằng khóa băm của nền tảng, chỉ hiện bốn số cuối; ở trường lưu bản mã hóa bằng khóa của trường và bản băm bằng khóa nền tảng; hai khóa nền tảng bọc bằng khóa gốc, không lưu cùng nhà cung cấp cơ sở dữ liệu; không ghi số định danh dạng rõ vào nhật ký |
| 22_BAO_MAT.md | BM-215 | BM-251 | Liên kết tài khoản dùng chung với tài khoản ở trường (YCTD-392): cần số định danh khớp và người dùng nhận đúng mã một lần gửi tới số điện thoại trường ghi cho tài khoản đó (bỏ qua khi số đó bằng số đã xác minh của danh tính); không khớp hoặc trường tắt thì trả một câu báo chung; tối đa 10 lần thêm trường mỗi giờ, 20 liên kết mỗi danh tính |
| 22_BAO_MAT.md | BM-215 | BM-252 | Luật bảo mật chung của tài khoản dùng chung (YCTD-392, Eric duyệt 2026-10-30): mật khẩu tối thiểu 10 ký tự, không trùng 5 mật khẩu gần nhất; khóa tạm 15 phút sau 5 lần sai; bắt buộc xác thực hai lớp khi có vai trò nhân viên ở bất kỳ trường nào; mã một lần khi vào một trường trên thiết bị mới; không có mật khẩu mặc định chung; cấu hình mật khẩu, hai lớp của trường chỉ áp cho đăng nhập kiểu cũ |
| 22_BAO_MAT.md | BM-215 | BM-253 | Đọc nhiều trường cho một người dùng (YCTD-392): mỗi trường một lần chạy trong ngữ cảnh trường với vai trò cơ sở dữ liệu của trường, tuần tự; kiểm tĩnh đa thuê bao chỉ cho phép đúng các hàm kiểm tài khoản, liệt kê vai trò, liệt kê con; chỉ trả họ tên, lớp, cấp, trạng thái; không ghi đệm, không ghi nhật ký nội dung trả về; kiểm thử ma trận: không đọc được trường không liên kết, không đọc được tài khoản khác trong cùng trường |
| 22_BAO_MAT.md | BM-215 | BM-254 | Vào trường từ tài khoản dùng chung (YCTD-392): phiên mở ở cơ sở dữ liệu định danh của trường đích với cách đăng nhập `account_identity`, mã chuyển phiên một lần hạn 2 phút chỉ đổi được ở tên miền trường đó; kênh `student` chỉ nhận tài khoản có `VT-21`; trường khóa tài khoản, gỡ vai trò thì từ chối; trường tắt tài khoản dùng chung thì treo liên kết và thu hồi phiên đã mở; nhật ký ở cả nền tảng và trường |
| 22_BAO_MAT.md | BM-215 | BM-255 | Gợi ý liên kết khi trường tạo tài khoản (YCTD-392): trường chỉ gửi bản băm có khóa của số định danh; nền tảng chỉ giữ khi đã có danh tính khớp (thành gợi ý chờ người dùng xác nhận), hủy ngay trong trường hợp khác; không có chỉ mục số định danh của người chưa dùng tài khoản dùng chung |
| 22_BAO_MAT.md | BM-215 | BM-256 | Dữ liệu thật và trẻ em ở tài khoản dùng chung (YCTD-392; khoản 2 Điều 24 Luật 91/2025/QH15): không nhận số định danh thật khi chưa có PL-07 phần nền tảng và PL-09 bổ sung do Eric ký; học sinh dưới 18 tuổi kích hoạt khi phụ huynh xác nhận bằng mã một lần gửi tới số phụ huynh nhận tin; người dùng xóa được tài khoản dùng chung, xóa sau 30 ngày chờ |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-392 | Tài khoản dùng chung trên nền tảng, lát E0: đặc tả, bảo mật, bản mẫu, bản nháp pháp lý | Không áp dụng (tài liệu) | Chưa cấp (cấp ở lát E1 đến E5) | Chưa cấp | Chưa cấp | PR, commit merge ghi khi gom; tệp: `tai_lieu/ban_mau/yctd-392/DAC_TA.md`, `tai_lieu/ban_mau/yctd-392/index.html`, `tai_lieu/ban_mau/yctd-392/PHAP_LY.md` | `node scripts/gom-thay-doi.mjs --kiem` đạt; CI của PR |
