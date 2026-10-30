# YCTD-392: Tài khoản dùng chung trên nền tảng (danh tính chung)

Ngày 2026-10-30. Eric duyệt phương án, các quyết định ở mục 3 và mục 13, bản mẫu MH-670 đến MH-675 và danh sách lát E0 đến E5 ngày 2026-10-30. Lát E0 (tài liệu này, bản nháp pháp lý `PHAP_LY.md`) không đổi mã nguồn. Mức: **Lớn** (bảng mới ở cơ sở dữ liệu `platform`, đổi cách đăng nhập của mọi kênh, đổi luật mật khẩu và xác thực hai lớp từ theo trường sang theo nền tảng, nền tảng giữ số định danh của mọi người dùng, đổi quyết định kiến trúc đã duyệt ở tài liệu `47` mục 14 và 16.5, chạm dịch vụ định danh, máy chủ API, bốn ứng dụng, vỏ ứng dụng cài đặt, cổng vận hành, hồ sơ pháp lý).

Bản mẫu: `index.html` cùng thư mục (sáu màn hình, nút chọn cỡ 1366, 1024, 390).

Căn cứ giao việc: quyết định Q3 của Eric ngày 2026-10-30 trong đặc tả liên thông học sinh (YCTD-390, `tai_lieu/ban_mau/yctd-390/DAC_TA.md`): hướng đích là danh tính chung trên nền tảng, làm ở đợt riêng; lát L3 của đợt liên thông tạo tài khoản phụ huynh tạm ở trường đến, danh tính chung phải gộp được các tài khoản đó. Bản đầu của đề xuất này chỉ cho phụ huynh; Eric mở rộng phạm vi ngày 2026-10-30 (mục 12).

Ký hiệu nguồn: **[Mã]** đọc từ mã nguồn nhánh `claude/loving-ptolemy-9e322a` (gốc `main` ở commit 9edc3577); **[Tài liệu]** đọc từ `tai_lieu/`; **[Văn bản]** điều luật đã đọc trong bộ hồ sơ pháp lý `tai_lieu/48_HO_SO_PHAP_LY`; **[Đề xuất]** chưa có trong mã, Eric đã duyệt ở lát E0.

---

## 1. Tóm tắt

1. Hiện mỗi trường một cơ sở dữ liệu định danh; mỗi người có một tài khoản riêng ở mỗi trường, đăng nhập ở tên miền của trường, luật mật khẩu và xác thực hai lớp do từng trường đặt. Tài liệu `47` mục 14 đã chốt "tài khoản không gộp giữa các trường". [Mã, Tài liệu]
2. Eric chốt: **một người một tài khoản trên nền tảng, chỉ khác phân quyền**; một người có nhiều quyền ở nhiều trường (ví dụ giáo viên ở trường A, phụ huynh ở trường A và B). Áp dụng cho nhân viên, giáo viên, phụ huynh, học sinh từ THCS trở lên.
3. Cách làm là **môi giới**: nền tảng giữ danh tính (số định danh, số điện thoại đã xác minh, mật khẩu, xác thực hai lớp, phiên, nhật ký) và liên kết tới dòng người dùng ở từng trường. Dòng người dùng ở trường vẫn mang vai trò, quyền, phạm vi đơn vị; mọi mã đang dùng `users.id` của trường giữ nguyên.
4. **Khóa gộp là số định danh cá nhân** (số căn cước, mã định danh 12 số). Trường bắt buộc nhập số định danh khi cấp tài khoản mới. Đăng nhập bằng số định danh hoặc số điện thoại đã xác minh, kèm mật khẩu riêng hoặc mã một lần.
5. Trang đăng nhập chung đặt ở tên miền chung hiện có, thay trang đăng nhập theo đơn vị; đăng nhập xong chọn trường và vai trò, rồi chuyển phiên một lần (`login_handoffs`) sang tên miền của trường. Đăng nhập kiểu cũ ở tên miền trường giữ song song lâu dài.
6. Thay đổi pháp lý lớn: nền tảng thành **bên kiểm soát** dữ liệu tài khoản chung, và giữ số định danh của mọi người dùng, kể cả học sinh 11 đến 18 tuổi; Eric chọn bật cả khi cơ sở dữ liệu nền tảng ở máy chủ ngoài nước. Đây là rủi ro pháp lý cao nhất của đợt, cần luật sư rà trước khi nhận số định danh thật (mục 7.3).
7. Sáu lát E0 đến E5, khoảng 8 đến 10 phiên làm việc; mọi điểm nghiệp vụ đã chốt (mục 3, mục 13).

## 2. Hiện trạng đăng nhập [Mã]

| Mảng | Hiện có | Tệp |
|---|---|---|
| Tài khoản | `users` ở cơ sở dữ liệu định danh của từng trường; `phone` và `username` duy nhất trong trường; mật khẩu để trống nghĩa là dùng mật khẩu mặc định chung của trường | `database/identity/migrations/0002_create_account_tables.ts:11`, `0009_add_parent_sign_in.ts:9` |
| Vai trò, kênh | Bốn kênh phiên `portal`, `teacher`, `parent`, `student`; phụ huynh `VT-14`, học sinh `VT-21` chỉ vào được kênh của mình; vai trò gán theo đơn vị (`user_roles.org_unit_id`) | `0120_add_student_channel.ts`, `0002_create_account_tables.ts` |
| Tạo tài khoản phụ huynh | Hiệu trưởng duyệt hồ sơ học sinh: `ensureGuardianAccount` theo số điện thoại, ghi `guardians.user_id` | `apps/api/src/children/children.service.ts:623-659` |
| Tài khoản học sinh | Tài khoản học và thi ở cơ sở dữ liệu năm học nối một-một với người dùng kênh `student` qua `student_accounts.learning_username` | `0121_create_student_accounts.ts` |
| Quyền xem con | Theo `guardians.user_id` qua `child_guardians` | `apps/api/src/children/child-scope.ts:133-142` |
| Số định danh đang có | Học sinh: `children.national_id_encrypted`; phụ huynh: `guardians.id_number_encrypted` ở cơ sở dữ liệu năm học, mã hóa và băm bằng khóa của trường; `users` ở cơ sở dữ liệu định danh **không có** số định danh | `database/school-year/schema.ts:716-727`, `0002_create_schools.ts:71-103` (khóa từng trường) |
| Luật mật khẩu, hai lớp | Theo trường: `identity_settings`, `user_totp`, `user_recovery_codes`, hết hạn mật khẩu, lịch sử mật khẩu, mã đổi mật khẩu lần đầu | `0042`, `0045`, `0101`, `0102`, `0183`, `0185` |
| Cách đăng nhập | Mật khẩu kèm mã xác nhận hình; mã một lần (chỉ `VT-14`); OIDC sẵn cho VNeID, chủ thể băm bằng khóa của trường | `one-time-code.service.ts:11-40`, `0140_create_external_identities.ts` |
| Phiên | Mã truy cập mang mã trường `tid`; cookie mã làm mới cùng tên miền | `token.service.ts:45-52,128-133` |
| Đăng nhập theo đơn vị | Tên miền chung: chọn Sở, cấp, xã, trường; đăng nhập trong ngữ cảnh trường; chuyển phiên một lần sang tên miền trường. Chỉ cho cổng quản trị | `apps/identity/src/directory/unit-directory.ts:39-58`, `0130_create_login_handoffs.ts` |
| Ứng dụng cài đặt | Danh sách địa chỉ trường lưu trên máy, chọn trường và vai trò | `apps/mobile/capacitor.config.ts` |
| Quyết định đã duyệt | Không gộp tài khoản giữa các trường; không làm đăng nhập theo đơn vị cho giáo viên, phụ huynh | `tai_lieu/47_KE_HOACH_THEO_HE_THONG_SO.md:1393`, mục 16.5 [Tài liệu] |

## 3. Quyết định của Eric ngày 2026-10-30

| Số | Câu hỏi | Quyết định |
|---|---|---|
| D1 | Tài khoản chung cho ai | Mọi người dùng: "tài khoản là dùng chung, chỉ khác phân quyền; một người có nhiều quyền tại nhiều trường" |
| D1a | Giữ tài khoản ở đâu | Môi giới: nền tảng giữ danh tính, trường giữ dòng người dùng mang vai trò, quyền |
| D1b | Học sinh | Có, từ THCS trở lên; Mầm non, Tiểu học giữ tài khoản theo trường |
| D1c | Khóa nhận diện | Số căn cước, mã định danh cá nhân |
| D1d | Ô đăng nhập | Số định danh hoặc số điện thoại đã xác minh |
| D1e | Tài khoản thiếu số định danh | Bắt buộc nhập số định danh |
| D2 | Tìm trường | Tự thêm, có gợi ý |
| D3 | Đăng nhập cũ ở tên miền trường | Giữ song song lâu dài |
| D4 | Công tắc của trường | Bật cho mọi trường |
| D5 | Cách đăng nhập | Mã một lần và mật khẩu riêng; bắt buộc mã một lần khi vào trường trên thiết bị mới; bỏ mật khẩu mặc định chung |
| D5a | Luật mật khẩu, hai lớp | Nền tảng đặt một luật chung |
| D6 | Phí tin nhắn mã một lần | Nền tảng trả |
| D7 | Cơ sở dữ liệu nền tảng ở máy chủ ngoài nước | Bật ngay |
| D8 | Tên miền trang đăng nhập chung | Tên miền chung hiện có |

## 4. Nguyên tắc thiết kế [Đề xuất]

1. **Trường vẫn quyết định quyền.** Danh tính chung chỉ mở được phiên vào dòng người dùng mà trường đã tạo; vai trò, phạm vi đơn vị, quan hệ phụ huynh và học sinh vẫn ở trường. Trường khóa tài khoản, gỡ vai trò thì quyền ở trường đó mất ngay.
2. **Một người, một danh tính, nhiều liên kết.** Mỗi liên kết là một cặp (trường, `users.id` ở trường). Một trường có tối đa một liên kết cho một danh tính.
3. **Số định danh là khóa gộp, không phải bằng chứng.** Biết số định danh của người khác không đủ để chiếm tài khoản: tạo liên kết cần số định danh khớp **và** chứng minh sở hữu số điện thoại mà trường đã ghi cho tài khoản đó (mục 6.2).
4. **Nền tảng không giữ số định danh dạng rõ trong cơ sở dữ liệu:** mã hóa bằng khóa của nền tảng, kèm băm có khóa để tra, bốn số cuối để hiện.
5. **Không có chỉ mục số định danh của người chưa dùng tài khoản chung.** Trường báo bản băm khi tạo tài khoản; nền tảng chỉ giữ khi đã có danh tính khớp (thành gợi ý), không khớp thì bỏ (D2).
6. **Một luật bảo mật chung cho tài khoản chung** (D5a); luật của trường chỉ còn áp cho đăng nhập kiểu cũ ở tên miền trường.
7. **Giữ tách nguồn gốc theo tên miền:** trang chung không gọi chéo tên miền vào trường; vào trường bằng chuyển phiên một lần.

## 5. Thiết kế dữ liệu [Đề xuất]

Tên bảng dùng `account_identity` (không dùng `parent`, tránh nhầm với `parent_org` là đơn vị cấp trên).

### 5.1. Cơ sở dữ liệu `platform`

| Bảng | Nội dung | Không chứa |
|---|---|---|
| `account_identities` | Mã; số định danh mã hóa bằng khóa nền tảng, băm có khóa (duy nhất), bốn số cuối; số điện thoại đã xác minh (mã hóa, băm có khóa, duy nhất); họ tên hiển thị; băm mật khẩu; trạng thái (chờ kích hoạt, đang dùng, khóa, chờ xóa); số lần sai, khóa đến; mật khẩu đổi lúc nào; phiên bản điều khoản đã đồng ý và thời điểm; với học sinh: thời điểm phụ huynh đồng ý | Vai trò, trường, lớp, dữ liệu học tập |
| `account_identity_links` | Danh tính, `school_id`, `school_user_id`, trạng thái (`suggested`, `active`, `suspended`, `revoked`), nguồn (`added_by_user`, `school_session_opt_in`, `school_account_created`), các mốc thời gian, ai gỡ và lý do. Duy nhất theo (danh tính, trường) và (trường, `school_user_id`) | Tên vai trò dạng rõ (đọc từ trường mỗi lần) |
| `account_identity_totp`, `account_identity_recovery_codes` | Xác thực hai lớp của danh tính (thay `user_totp` của trường cho đăng nhập chung) | — |
| `account_identity_password_history` | Lịch sử mật khẩu theo luật chung | — |
| `account_identity_sessions` | Phiên trang chung: băm mã làm mới, hạn, thiết bị, địa chỉ mạng, thu hồi | — |
| `account_identity_devices` | Thiết bị đã dùng để vào từng trường (băm định danh thiết bị) để áp D5 | — |
| `account_identity_codes` | Mã một lần: băm mã, mục đích (`login`, `activate`, `link`, `phone_change`, `password_reset`, `delete`), hạn, số lần thử | — |
| `account_identity_events` | Nhật ký: kích hoạt, đăng nhập, từ chối, thêm trường, xác nhận gợi ý, vào trường, đổi số, đổi mật khẩu, bật tắt hai lớp, xóa | Nội dung trường trả về |
| `account_security_policy` (trong `platform_settings`) | Luật chung: độ dài, hết hạn, lịch sử mật khẩu; số lần sai; hai lớp bắt buộc với ai | — |

Khóa mã hóa và khóa băm của nền tảng bọc bằng khóa gốc như `platform_push_keys`.

### 5.2. Cơ sở dữ liệu định danh của từng trường

| Thay đổi | Lý do |
|---|---|
| `users` thêm `national_id_encrypted` (khóa của trường), `national_id_last4`, `national_id_platform_hash` (băm bằng khóa nền tảng) | Khóa gộp; trường tra được số của nhân viên mình như với học sinh |
| Tài khoản mới bắt buộc có số định danh (D1e), trừ học sinh Mầm non, Tiểu học | Quyết định D1e. Tài khoản đã có không bị chặn; danh sách tài khoản thiếu số hiện ở màn hình quản lý tài khoản để trường bổ sung |
| `sessions.login_method` thêm `account_identity` | Phân biệt phiên mở từ danh tính chung; phiên này không áp luật mật khẩu của trường |
| `security_events` thêm loại cho đăng nhập, liên kết, gỡ liên kết qua danh tính chung | Trường tra được ai vào bằng đường nào |
| `identity_settings` thêm `account_identity` (mặc định bật, D4) | Trường vẫn tắt được nếu cần |

Số định danh ở `guardians`, `children` (cơ sở dữ liệu năm học) dùng để điền sẵn khi tạo tài khoản phụ huynh, học sinh; không đổi các bảng đó.

## 6. Luồng [Đề xuất]

### 6.1. Kích hoạt lần đầu

1. Người dùng mở tên miền chung, nhập số điện thoại, nhận mã một lần.
2. Lần đầu: khai số định danh, họ tên, đặt mật khẩu, đồng ý điều khoản. Học sinh: phụ huynh xác nhận (mục 7.3).
3. Nền tảng chưa tìm trường nào (D2); người dùng thêm trường (6.2) hoặc xác nhận gợi ý (6.3).
4. Một số định danh đã có danh tính khác: từ chối, hướng dẫn liên hệ hỗ trợ; người vận hành xử lý tranh chấp bằng xác minh qua trường.

### 6.2. Thêm trường

1. Chọn trường trong danh mục đơn vị (dùng lại ô chọn của `unit-directory.ts`).
2. Trong ngữ cảnh trường đó, tìm tài khoản đang dùng có `national_id_platform_hash` bằng của danh tính.
3. Có, và số điện thoại của tài khoản ở trường bằng số đã xác minh: liên kết `active`.
4. Có, số điện thoại khác: gửi mã một lần tới số trường đang ghi; nhập đúng mới liên kết.
5. Không có hoặc trường tắt: một câu báo chung "Trường chưa có tài khoản với số định danh này. Liên hệ nhà trường."
6. Giới hạn 10 lần mỗi giờ mỗi danh tính.

### 6.3. Gợi ý và gộp tài khoản

| Trường hợp | Cách gộp |
|---|---|
| Trường tạo tài khoản mới (nhân viên, phụ huynh khi duyệt hồ sơ, học sinh THCS trở lên, tài khoản tạm ở lát L3 của liên thông) | Dịch vụ định danh của trường gửi băm số định danh; có danh tính khớp thì tạo liên kết `suggested`, không thì bỏ. Người dùng thấy "Trường Y có tài khoản của bạn" ở lần đăng nhập sau |
| Người dùng đang đăng nhập kiểu cũ ở tên miền trường | Thẻ mời "Dùng một tài khoản cho mọi trường": mã một lần tới số của tài khoản; chưa có danh tính thì kích hoạt (6.1) với số định danh trường đã ghi |
| Tài khoản ở trường thiếu số định danh | Không liên kết được; thẻ mời báo "Nhờ nhà trường cập nhật số định danh" |

### 6.4. Đăng nhập và chọn nơi làm việc

```mermaid
sequenceDiagram
    actor ND as Người dùng
    participant C as Trang chung (tên miền chung)
    participant NT as Dịch vụ định danh, ngữ cảnh nền tảng
    participant T as Dịch vụ định danh, ngữ cảnh trường Y
    participant A as Máy chủ API, ngữ cảnh trường Y
    ND->>C: Số định danh hoặc số điện thoại, mật khẩu hoặc mã một lần
    NT->>NT: Luật chung: khóa tạm, hai lớp nếu bắt buộc
    C->>NT: Nơi làm việc của tôi
    loop Mỗi liên kết đang dùng
        NT->>T: Tài khoản còn dùng? Vai trò, kênh được vào?
        NT->>A: Nếu có vai trò phụ huynh: các con (họ tên, lớp, cấp, trạng thái)
    end
    NT-->>C: Danh sách theo trường: vai trò, kênh, các con (không lưu)
    ND->>C: Chọn trường Y, kênh (quản trị, giáo viên, phụ huynh, học sinh)
    NT->>NT: Thiết bị mới với trường Y thì đòi mã một lần (D5)
    NT->>T: Mở phiên kênh đã chọn, cách đăng nhập account_identity; mã chuyển phiên 2 phút
    C->>ND: Sang tên miền trường Y kèm mã
```

- Màn hình chọn nhóm theo trường; mỗi trường liệt kê kênh được vào (Quản trị, Giáo viên, Phụ huynh của …, Học sinh). Chỉ một lựa chọn thì vào thẳng.
- Kênh `student` vẫn chỉ nhận tài khoản có `VT-21`; một danh tính có thể là học sinh ở trường A và không có vai trò nào khác.
- Ứng dụng của trường có mục "Đổi trường, đổi vai trò": chuyển trang về tên miền chung, không gọi chéo.
- Đọc nhiều trường: mỗi trường một lần `runAsSchool`, tuần tự, tối đa 20 liên kết mỗi danh tính, không ghi đệm.

### 6.5. Thay đổi ở phía trường

| Việc ở trường | Ảnh hưởng |
|---|---|
| Khóa tài khoản, gỡ hết vai trò | Liên kết giữ; trang chung hiện "Trường đã khóa tài khoản" |
| Đổi số định danh của tài khoản | Liên kết `revoked`; gửi gợi ý mới theo số mới |
| Đổi số điện thoại | Liên kết giữ (đã chứng minh khi liên kết); ghi nhật ký hai phía |
| Xóa tài khoản | Liên kết `revoked` |
| Tắt danh tính chung | Liên kết `suspended`, thu hồi phiên đã mở từ danh tính chung |
| Học sinh, phụ huynh rời trường | Liên kết giữ để xem dữ liệu năm cũ (nguyên tắc 3 của đề xuất liên thông) |

### 6.6. Thay đổi ở phía người dùng

- Gỡ một trường: liên kết `revoked`, thu hồi phiên ở trường đó.
- Đổi số điện thoại: mã một lần tới số mới.
- Quên mật khẩu: mã một lần tới số đã xác minh.
- Xóa danh tính: mã một lần, liên kết `revoked`, xóa sau 30 ngày chờ; nhật ký giữ theo PL-13. Tài khoản ở trường không bị xóa.

### 6.7. Ứng dụng cài đặt

Trang khởi động mở trang chung ở tên miền chung; bỏ danh sách địa chỉ trường tự nhập (giữ cho môi trường phát triển). Mã làm mới của trang chung lưu ở Keychain, Keystore khi phần 26f làm xong.

## 7. Ảnh hưởng

### 7.1. Phân quyền và bảo mật

- Không thêm vai trò ở trường. Vai trò, quyền, phạm vi đơn vị, phân hệ (`role_workspace_exclusions`) giữ nguyên ở trường.
- **Luật chung thay luật của trường cho đăng nhập chung (D5a).** Nội dung luật (Eric duyệt, M1): mật khẩu tối thiểu 10 ký tự, không trùng 5 mật khẩu gần nhất; khóa tạm 15 phút sau 5 lần sai; bắt buộc xác thực hai lớp khi danh tính có ít nhất một vai trò nhân viên ở bất kỳ trường nào; phụ huynh, học sinh dùng mã một lần khi vào trường trên thiết bị mới. Các cấu hình mật khẩu, hai lớp của trường (`identity_settings`, YCTD-311, YCTD-323) chỉ còn áp cho đăng nhập kiểu cũ.- Người có quyền nhân viên dùng mã hai lớp của danh tính; mã hai lớp đã cài ở trường không chuyển sang (người dùng cài lại một lần).
- Phiên hỗ trợ của người vận hành (`support_sessions`), đóng vai người dùng (`impersonation`) giữ nguyên, không đi qua danh tính chung.
- Cổng vận hành: quyền mới tra danh tính theo bốn số cuối và số điện thoại, khóa, mở khóa, xử lý tranh chấp số định danh, xem nhật ký; không xem dữ liệu của trường.

### 7.2. Tách dữ liệu giữa trường

| Rủi ro | Biện pháp |
|---|---|
| Đường mới đọc nhiều trường trong một yêu cầu | Mỗi trường một `runAsSchool` với vai trò PostgreSQL của trường; kiểm tĩnh đa thuê bao chỉ cho phép đúng các hàm kiểm tài khoản, liệt kê vai trò, liệt kê con; kiểm thử ma trận: danh tính không đọc được trường không liên kết, không đọc được tài khoản khác trong cùng trường |
| Số định danh bị dùng để dò trường đang dùng nền tảng | Câu báo chung, giới hạn tần suất, liên kết cần thêm mã một lần tới số của trường |
| Lộ cơ sở dữ liệu `platform` | Số định danh và số điện thoại mã hóa, khóa ngoài cơ sở dữ liệu; liên kết chỉ có mã trường, mã tài khoản. Kẻ có cả khóa gốc biết danh sách số định danh của người dùng và nơi họ có tài khoản: rủi ro mới, ghi vào đánh giá tác động |
| Một danh tính bị chiếm mở được nhiều trường | Hai lớp bắt buộc cho người có quyền nhân viên; mã một lần khi vào trường trên thiết bị mới; tin báo khi đăng nhập từ thiết bị mới |
| Trường nhập nhầm số định danh của người khác | Liên kết vẫn cần mã một lần tới số điện thoại trường ghi cho tài khoản; người bị nhầm không tự liên kết được nếu không có số đó |

### 7.3. Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP

Chỉ dẫn các điều đã đọc trong bộ hồ sơ pháp lý (`tai_lieu/48_HO_SO_PHAP_LY/00_MUC_LUC.md` mục 4). Đây là đề xuất để luật sư rà, không phải tư vấn pháp lý.

| Điểm | Phân tích | Việc cần làm |
|---|---|---|
| Vai trò của nền tảng | Hiện nền tảng là bên xử lý cho từng trường (khoản 2 Điều 37). Tài khoản chung do nền tảng tự quyết mục đích nên với dữ liệu tài khoản, **nền tảng là bên kiểm soát**; đọc vai trò, danh sách con trong ngữ cảnh trường vẫn là xử lý theo chỉ dẫn của trường | Ghi hai vai trò trong PL-02, PL-04, PL-05 |
| Giữ số định danh của mọi người dùng | Nền tảng thu thập số định danh cho mục đích của mình (khóa gộp). Cần căn cứ: đồng ý (Điều 9) khi kích hoạt; nêu rõ trong thông tin cho chủ thể (khoản 7 Điều 23 Nghị định 356/2025). Luật sư xác nhận số định danh có thuộc danh mục dữ liệu nhạy cảm ở Điều 4 Nghị định 356/2025 hay không [chưa xác minh] | Màn hình kích hoạt; PL-05 |
| Trường gửi băm số định danh cho nền tảng (gợi ý ở 6.3) | Chuyển giao giữa hai bên kiểm soát, cần nội dung thỏa thuận theo Điều 7 Nghị định 356/2025. Vì công tắc bật cho mọi trường (D4), điều này phải có trong PL-02 của **mọi** trường | Thêm điều vào PL-02; trường chưa ký bản mới thì tắt gợi ý, người dùng vẫn tự thêm trường |
| Học sinh THCS, THPT (11 đến 18 tuổi) | Dữ liệu trẻ em; trẻ từ đủ 7 tuổi cần đồng ý của cả trẻ và người đại diện (khoản 2 Điều 24). Đề xuất: học sinh dưới 18 tuổi kích hoạt cần phụ huynh xác nhận bằng mã một lần tới số phụ huynh nhận tin của trường | Luồng đồng ý kép; PL-14 bổ sung số định danh trẻ em ở nền tảng |
| Đánh giá tác động | Nền tảng lập hồ sơ của chính mình (khoản 3 Điều 21 Luật 91/2025; nội dung theo khoản 3 Điều 19 Nghị định 356/2025) | Bổ sung PL-06 phần nền tảng |
| Máy chủ ngoài nước, bật ngay (D7) | Danh tính ở `platform`; nếu `platform` ở ngoài nước thì đây là chuyển dữ liệu cá nhân xuyên biên giới do nền tảng kiểm soát (khoản 1 Điều 20 Luật 91/2025), gồm số định danh của trẻ em. **Rủi ro cao nhất của đợt.** Đề xuất: làm mã ngay, nhưng chỉ nhận số định danh thật sau khi có PL-07 phần nền tảng và phiếu chấp nhận rủi ro PL-09 bổ sung do Eric ký | PL-07, PL-09 |
| Xóa | Xóa, hủy an toàn khi chủ thể yêu cầu (khoản 3 Điều 14) | Luồng 6.6 |
| Nhân sự bảo vệ dữ liệu | Đầu mối theo Điều 13 Nghị định 356/2025 phụ trách cả phần bên kiểm soát | PL-02 Phụ lục C, PL-05 |
| Điều kiện kinh doanh dịch vụ xử lý dữ liệu | Câu hỏi PL-15 (Điều 21 đến 26 Nghị định 356/2025) vẫn mở; xét cùng | Danh sách câu hỏi cho luật sư |

## 8. Bản mẫu

Tệp `index.html` cùng thư mục, chọn màn hình và cỡ (1366, 1024, 390) ở thanh trên. Màu theo tài liệu `15` (M-01 #0670C0, N-01 #F5F7FA, C-01 #0F172A, trạng thái T-01 đến T-05). Khi bộ biến thiết kế mới của YCTD-384 vào `main`, lát E2, E4 dựng giao diện theo bộ biến đó.

| Mã | Màn hình |
|---|---|
| MH-670 | Đăng nhập: số định danh hoặc số điện thoại; mật khẩu hoặc mã một lần; liên kết "Đăng nhập theo từng trường" |
| MH-671 | Kích hoạt lần đầu: số định danh, họ tên, mật khẩu, đồng ý; học sinh cần phụ huynh xác nhận |
| MH-672 | Chọn nơi làm việc: nhóm theo trường, kênh được vào, các con; gợi ý liên kết; trạng thái từng trường |
| MH-673 | Thêm trường: chọn đơn vị; mã một lần khi số điện thoại ở trường khác |
| MH-674 | Xác nhận gợi ý liên kết |
| MH-675 | Tài khoản: số định danh (bốn số cuối), số điện thoại, mật khẩu, hai lớp, trường đã liên kết, lần vào gần đây, xóa |

## 9. Danh sách lát

| Lát | Nội dung | Chạy được sau lát | Phụ thuộc |
|---|---|---|---|
| E0 | Phiếu `24` sửa quyết định ở tài liệu `47` mục 14, 16.5; luật bảo mật chung (M1); quy tắc `07`, luồng `09`, `16`, `17`, `22` phần A, `11`, `21`, `14`, `08`; bản mẫu vào `tai_lieu/ban_mau/`; bản nháp bổ sung PL-02, PL-04, PL-05, PL-06, PL-07, PL-09, PL-14 cho luật sư | Tài liệu duyệt | — (mục 13 đã duyệt) |
| E1 | Trường: số định danh ở `users` (mã hóa, băm hai khóa), bắt buộc khi tạo tài khoản mới ở cổng quản trị, ở duyệt hồ sơ (lấy từ `guardians`, `children`), danh sách tài khoản thiếu số | Trường nhập được số định danh cho mọi tài khoản | — |
| E2 | Nền tảng: bảng ở 5.1, khóa nền tảng; trang chung ở tên miền chung: kích hoạt, đăng nhập bằng số định danh hoặc số điện thoại, mật khẩu, mã một lần, hai lớp, luật chung, đăng xuất, quên mật khẩu; trang đăng nhập theo đơn vị chuyển thành liên kết phụ | Tạo danh tính, đăng nhập, chưa có trường | E1 |
| E3 | Thêm trường (6.2), vào trường bằng `account_identity` và mã chuyển phiên cho cả bốn kênh, thiết bị mới (D5), phản ứng với thay đổi ở trường (6.5), kiểm thử ma trận tách trường | Một người là giáo viên ở trường A, phụ huynh ở trường A và B, vào được cả ba nơi | E2 |
| E4 | Màn hình chọn nơi làm việc với các con (6.4); "Đổi trường, đổi vai trò" ở bốn ứng dụng; vỏ ứng dụng cài đặt mở trang chung | Một lần đăng nhập, chuyển qua lại giữa trường và vai trò | E3; sau phiên thiết kế lại giao diện |
| E5 | Gợi ý và gộp (6.3), thẻ mời ở bốn ứng dụng, nối lát L3 của liên thông; học sinh THCS trở lên và đồng ý của phụ huynh; quyền của chủ thể (6.6); màn hình ở cổng vận hành; e2e trọn luồng; cập nhật `25`, `27` | Nghiệm thu | E4 |

VNeID ở mức danh tính chung để sau (cần hợp đồng thật).

Mỗi lát dừng ở điểm xem trước trên bản nhiều trường ở máy (cổng 3100, 3101, 5190; `tc-demo` và một trường thử thứ hai). Tệp dễ đụng phiên khác: `apps/parent`, `apps/teacher`, `apps/portal`, `apps/student` (phiên thiết kế lại giao diện), `unit-directory.ts`. Ước lượng 8 đến 10 phiên; rủi ro lớn nhất là E2 (thay luật bảo mật của trường bằng luật chung mà không làm hỏng đăng nhập kiểu cũ) và đường đọc nhiều trường ở E3, E4.

## 10. Liên hệ với đề xuất liên thông học sinh

- Gói chuyển trường đã mang số định danh của học sinh và phụ huynh (mã hóa trong gói). Trường đến tạo tài khoản với số định danh đó, gợi ý liên kết tự đến với người đã có danh tính chung: phụ huynh, học sinh THCS trở lên thấy trường mới ngay khi đăng nhập.
- Lát L3 của liên thông làm trước thì vẫn tạo tài khoản theo số điện thoại như đã duyệt, nhưng phải ghi số định danh vào `users` (cần E1). Đề xuất làm E1 trước hoặc cùng L3.

## 11. Thay đổi quyết định đã duyệt

| Chỗ | Đang ghi | Đổi thành |
|---|---|---|
| Tài liệu `47` mục 14 (dòng 1393) | Tài khoản không gộp giữa các trường; không có danh tính chung | Một người một danh tính chung trên nền tảng; trường giữ dòng người dùng mang quyền (môi giới); không có kho tài khoản chung |
| Tài liệu `47` mục 16.5 | Không làm đăng nhập theo đơn vị cho giáo viên, phụ huynh | Trang đăng nhập chung cho mọi kênh ở tên miền chung; đăng nhập theo đơn vị thành liên kết phụ |
| Cấu hình mật khẩu, hai lớp của trường | Áp cho mọi đăng nhập ở trường | Chỉ áp cho đăng nhập kiểu cũ; đăng nhập chung theo luật nền tảng |
| PL-14 | Số định danh trẻ em chỉ mã hóa bằng khóa của trường | Thêm bản mã hóa bằng khóa nền tảng ở `platform` cho học sinh THCS trở lên đã kích hoạt |

## 12. Câu hỏi ban đầu (bản chỉ cho phụ huynh)

Bản đầu đề xuất danh tính chỉ cho phụ huynh, khóa là số điện thoại, liên kết theo yêu cầu, không có chỉ mục toàn nền tảng, công tắc bật theo điều kiện, chờ máy chủ trong nước, tên miền con riêng. Eric chọn khác ở D1, D4, D7, D8; kết quả ở mục 3.

## 13. Điểm đã chốt sau vòng hai (Eric duyệt ngày 2026-10-30)

| Số | Điểm | Quyết định |
|---|---|---|
| M1 | Nội dung luật bảo mật chung | Như mục 7.1: mật khẩu tối thiểu 10 ký tự, không trùng 5 mật khẩu gần nhất; khóa tạm 15 phút sau 5 lần sai; bắt buộc xác thực hai lớp khi có vai trò nhân viên ở bất kỳ trường nào; phụ huynh, học sinh dùng mã một lần khi vào trường trên thiết bị mới |
| M2 | Học sinh THCS trở lên không có số điện thoại riêng | Mã kích hoạt, mã quên mật khẩu gửi tới số phụ huynh nhận tin (`child_guardians.receives_sms`); học sinh dùng mật khẩu hằng ngày; phụ huynh xác nhận khi con kích hoạt (đồng ý kép) |
| M3 | Nhận số định danh thật khi `platform` ở ngoài nước | Làm mã ngay; chỉ nhận số định danh thật sau khi có PL-07 phần nền tảng và PL-09 bổ sung do Eric ký |

Không còn điểm mở về nghiệp vụ. Lát E0 là tài liệu này, bản mẫu và `PHAP_LY.md`. Mã chức năng, quy tắc, tiêu chí, kịch bản, bảng dữ liệu, API cấp ở từng lát có mã (E1 đến E5), như cách làm của YCTD-390.

## 14. Nguồn

- Mã nguồn nhánh `claude/loving-ptolemy-9e322a`, các tệp dẫn ở mục 2.
- `tai_lieu/ban_mau/yctd-390/DAC_TA.md` (liên thông học sinh) mục 6, 12, 13.
- Bản nháp pháp lý cho luật sư: `PHAP_LY.md` cùng thư mục.
- `tai_lieu/47_KE_HOACH_THEO_HE_THONG_SO.md` mục 14 (dòng 1385-1406), mục 16.5.
- `tai_lieu/48_HO_SO_PHAP_LY/00_MUC_LUC.md` mục 4; `02_THOA_THUAN_XU_LY_DU_LIEU.md`.
- `tai_lieu/15_HE_THONG_THIET_KE.md` (màu).
