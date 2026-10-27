# 22. BẢO MẬT

- Mô tả: Xác thực, phân quyền, phiên làm việc, kiểm tra dữ liệu đầu vào, bảo mật API, truy cập dữ liệu.
- Phiên bản: 1.20
- Ngày cập nhật: 2026-10-26
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Nguyên tắc

1. **Máy chủ quyết định.** Mọi kiểm tra quyền thực hiện ở máy chủ. Giao diện chỉ hiển thị theo quyền để thuận tiện.
2. **Quyền tối thiểu.** Mỗi vai trò chỉ nhận đúng quyền cần cho công việc của mình.
3. **Không tin dữ liệu vào.** Mọi dữ liệu từ giao diện đều phải kiểm tra lại ở máy chủ.
4. **Có dấu vết.** Mọi thay đổi dữ liệu và mọi truy cập dữ liệu nhạy cảm đều ghi nhật ký.
5. **Dữ liệu trẻ em là dữ liệu cần bảo vệ cao nhất.** Hồ sơ sức khỏe, hình ảnh và thông tin định danh của trẻ là nhóm dữ liệu được bảo vệ chặt nhất.

## 2. Xác thực

| Mã | Biện pháp |
|---|---|
| BM-01 | Đăng nhập bằng số điện thoại hoặc tên đăng nhập kèm mật khẩu; phụ huynh có thêm cách đăng nhập bằng mã một lần gửi qua tin nhắn |
| BM-02 | Mật khẩu lưu dưới dạng băm có muối, dùng thuật toán băm mật khẩu chuyên dụng, không dùng hàm băm thông thường |
| BM-03 | Mật khẩu tối thiểu 8 ký tự, có cả chữ và số (YCTD-35) |
| BM-04 | Sai mật khẩu 5 lần liên tiếp thì tạm khóa tài khoản 15 phút, hết thời gian tự mở (YCTD-35) |
| BM-05 | Mã phiên ngắn hạn kèm mã làm mới; mã làm mới thu hồi được khi đăng xuất hoặc khi phát hiện bất thường. Mã phiên hết hạn sau 15 phút; mã làm mới hết hạn sau 8 giờ với cổng quản trị và 30 ngày với ứng dụng giáo viên, ứng dụng phụ huynh (Q-120) |
| BM-71 | Mã làm mới gửi cho trình duyệt bằng cookie httpOnly, SameSite=Strict, Secure, đường dẫn `/api/v1/auth`; không trả trong nội dung phản hồi (YCTD-36). Mỗi kênh một cookie riêng vì ba kênh dùng chung tên miền; phiên khác kênh không làm mới được (YCTD-43) |
| BM-06 | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31); rủi ro chiếm tài khoản của vai trò phê duyệt được giảm bằng BM-03, BM-04, BM-36, BM-56 (RR-15) |
| BM-07 | Tài khoản phụ huynh mới bắt buộc đổi mật khẩu ở lần đăng nhập đầu bằng mật khẩu; tài khoản vừa được đặt lại mật khẩu (P01-06) bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp (Q-148) |
| BM-08 | Khóa tài khoản ngay khi nhân sự nghỉ việc, không xóa để giữ lịch sử |
| BM-09 | Tài khoản không dùng quá số ngày cấu hình thì tạm khóa |
| BM-54 | Dịch vụ định danh là nơi duy nhất xử lý mật khẩu và cấp phiên; máy chủ API nghiệp vụ không lưu mật khẩu và không tự xác thực mật khẩu |
| BM-55 | Khóa ký mã phiên của dịch vụ định danh lưu trong kho bí mật, tách theo môi trường, xoay định kỳ |
| BM-56 | Phiên bị thu hồi khi phát hiện đăng nhập từ địa chỉ mạng bất thường hoặc khi quyền của tài khoản thay đổi |
| BM-61 | Mã một lần: chỉ dùng một lần, hết hạn sau số phút cấu hình, lưu dạng băm, giới hạn số lần gửi theo số điện thoại và số lần nhập sai; không tiết lộ số điện thoại có tồn tại trong hệ thống hay không |
| BM-68 | Tài khoản kiểm toán viên (VT-20) bắt buộc có ngày hết hiệu lực; hết hạn thì tự khóa |
| BM-69 | Mật khẩu mặc định chung của tài khoản phụ huynh do nhà trường cấu hình, lưu dạng băm, không gửi qua tin nhắn; phiên đăng nhập bằng mật khẩu mặc định chỉ dùng được màn hình đổi mật khẩu; phiên đăng nhập bằng mã một lần dùng bình thường dù chưa đổi mật khẩu mặc định (Q-147); theo dõi đăng nhập sai bất thường trên tài khoản chưa đổi mật khẩu |
| BM-72 | Mật khẩu của tài khoản nhân sự hết hạn sau số ngày do VT-01, VT-02 đặt (0 đến 3650, mặc định 0 là không giới hạn); quá hạn thì bắt buộc đổi như BM-07, mật khẩu mới phải khác mật khẩu hiện tại; báo trước số ngày cấu hình (mặc định 7). Không áp cho tài khoản chỉ có vai trò Phụ huynh, tài khoản còn dùng mật khẩu mặc định chung, phiên đăng nhập bằng mã một lần. Đăng nhập bằng mật khẩu đã hết hạn ghi nhật ký bảo mật `login_password_expired` (YCTD-110, BR-110) |
| BM-95 | Đăng nhập bằng nhà cung cấp định danh bên ngoài (YCTD-225, tài liệu 32 mục 17; sẵn cho VNeID qua Trung tâm RAR): chuẩn OIDC authorization code + PKCE S256, `state` và `nonce` dùng một lần (hạn 10 phút), kiểm chữ ký `id_token` qua JWKS chỉ với thuật toán khóa bất đối xứng, kiểm `iss`, `aud`, `azp`, `exp`, `iat`, discovery có kiểm `issuer`, tải lại bộ khóa khi nhà cung cấp quay khóa; địa chỉ nhà cung cấp bắt buộc `https`. Nền tảng khai nhà cung cấp ở biến môi trường, khóa bí mật dùng chung ở biến riêng; trường tự bật (mặc định tắt), có thể dùng mã ứng dụng và khóa riêng mã hóa bằng khóa của trường. **Không tự tạo tài khoản**; người dùng tự liên kết sau khi nhập lại mật khẩu riêng và mã xác thực hai lớp (nếu đã bật); lượt liên kết chỉ hoàn tất trong đúng phiên đã bắt đầu; mỗi subject chỉ gắn một tài khoản. Người đã bật xác thực hai lớp vẫn nhập mã sau nhà cung cấp, trừ khi trường bật "coi là đạt xác thực hai lớp" và mức đảm bảo nằm trong danh sách nền tảng khai. Nhóm vai trò được dùng do trường chọn, mặc định mọi vai trò trừ học sinh; người nhà cung cấp trả ngày sinh dưới 14 tuổi bị từ chối. Đăng nhập mật khẩu cộng xác thực hai lớp luôn còn làm đường dự phòng |
| BM-96 | Dữ liệu định danh từ nhà cung cấp ngoài (YCTD-225): chỉ lưu mã liên kết (subject) mã hóa AES-256-GCM bằng khóa của trường cùng băm HMAC-SHA256 bằng khóa băm của trường để tra (cột `*_encrypted`, `*_hash` nên công cụ đổi khóa của S3 tự mã hóa và băm lại); không lưu số định danh, căn cước, họ tên, ngày sinh hay claim khác, không gọi `userinfo`; mọi lần liên kết, gỡ, đăng nhập, từ chối, sửa cấu hình ghi `external_identity_events` (sửa cấu hình ghi thêm `identity_audit_logs`, khóa bí mật chỉ ghi "đã đặt") |
| BM-97 | Kênh phiên `student` của học sinh (YCTD-211): cookie làm mới riêng (`__Secure-refresh_token_student`, thêm mã trường ở chế độ nhiều trường), mã làm mới 12 giờ, mã xác nhận ảnh và khóa tạm như cổng quản trị; tài khoản học sinh (VT-21) chỉ vào kênh này, kênh này chỉ nhận VT-21; nhóm `/student/*` chỉ nhận mã phiên kênh `student`, mã phiên kênh `student` chỉ gọi nhóm này; học sinh chỉ thấy dữ liệu của chính mình, đáp án đúng không xuống máy học sinh, đồng hồ ở máy chủ; mật khẩu do trường cấp phải đổi ở lần đầu, cấp lại thu hồi mọi phiên |
| BM-98 | Camera khi thi trực tuyến (YCTD-211, GD-106): hình chỉ vào bộ nhận diện chạy trong trình duyệt của học sinh để đếm khuôn mặt; không ghi hình, không tải hình hay video lên máy chủ; máy chủ chỉ nhận loại sự kiện, thời điểm, thời gian kéo dài, số khuôn mặt (từ chối mọi trường khác); học sinh được báo rõ trước khi vào bài; không có camera thì theo cấu hình của bài (chặn hoặc đánh dấu); sự kiện chỉ là căn cứ để giáo viên xét, không tự trừ điểm; ảnh chụp định kỳ chưa làm |
| BM-99 | Chống gian lận khi thi trực tuyến (YCTD-211): khóa toàn màn hình, ghi thoát toàn màn hình, rời trang, đổi cửa sổ, phiên đăng nhập thứ hai; thời lượng cứng theo đồng hồ máy chủ; điểm vào sổ điểm chỉ qua giáo viên xác nhận (22g2); không chặn thao tác của máy, không hứa chống gian lận tuyệt đối, khuyến nghị thi chính thức ở phòng máy có giám thị |

## 3. Phân quyền

| Mã | Biện pháp |
|---|---|
| BM-10 | Kiểm tra ba lớp tại mọi yêu cầu: vai trò, phạm vi đơn vị, phạm vi bản ghi |
| BM-11 | Giới hạn phạm vi ở tầng truy vấn dữ liệu, không chỉ ở tầng nghiệp vụ, để chống sót điều kiện |
| BM-12 | Mọi truy vấn tới bảng có cột đơn vị đều phải kèm điều kiện đơn vị |
| BM-13 | Kiểm tra quyền trên từng bản ghi với dữ liệu của trẻ, không chỉ theo đơn vị |
| BM-14 | Thu hồi quyền có hiệu lực ngay tại yêu cầu kế tiếp |
| BM-15 | Mọi thay đổi vai trò và quyền ghi nhật ký thao tác kèm giá trị trước và sau |

## 4. Bảo vệ dữ liệu cá nhân

| Mã | Biện pháp |
|---|---|
| BM-16 | Dữ liệu cá nhân của trẻ gồm thông tin định danh, ngày sinh, địa chỉ, thông tin sức khỏe và hình ảnh |
| BM-17 | Chỉ giáo viên chủ nhiệm, nhân viên y tế, Ban Giám hiệu, quản lý đơn vị, kế toán và chính phụ huynh của trẻ được xem dữ liệu sức khỏe (BR-53) |
| BM-18 | Hình ảnh của trẻ chỉ được công bố khi phụ huynh đã đồng ý; cờ đồng ý kiểm tra ở cấp từng trẻ |
| BM-19 | Ghi nhật ký mọi lần đọc dữ liệu sức khỏe và dữ liệu tài chính khi đơn vị bật chế độ này; luôn ghi, không tắt được, khi đối tác đọc dữ liệu cá nhân qua API và khi xem đầy đủ số định danh cá nhân (BR-73) |
| BM-20 | Xuất dữ liệu cá nhân phải có quyền riêng và ghi nhật ký kèm người xuất, bộ lọc, thời điểm |
| BM-21 | Không đưa dữ liệu thật của trẻ ra môi trường phát triển và môi trường thử nghiệm |
| BM-22 | Khi cần dữ liệu để kiểm thử, phải dùng dữ liệu mô phỏng hoặc dữ liệu đã loại bỏ thông tin định danh |
| BM-64 | Số định danh cá nhân của trẻ được mã hóa khi lưu; chỉ giải mã cho vai trò được xem đầy đủ theo BR-81 và ghi nhật ký mỗi lần giải mã. Mã hóa AES-256-GCM; kiểm tra trùng bằng giá trị băm có khóa riêng; hai khóa đặt ở biến môi trường của máy chủ API, không ở mã nguồn (YCTD-45) |
| BM-67 | Hệ thống tuân thủ quy định bảo vệ dữ liệu cá nhân hiện hành; trước khi phát hành phải kiểm tra lại văn bản áp dụng (theo hiểu biết của nhóm thiết kế: Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân 2025) |
| BM-70 | Nhật ký thao tác, nhật ký truy cập dữ liệu nhạy cảm, nhật ký xuất dữ liệu và nhật ký bảo mật giữ tối thiểu 24 tháng; nhật ký lỗi hệ thống giữ tối thiểu 6 tháng (Q-109, `12_KIEN_TRUC_HE_THONG.md` mục nhật ký) |

## 5. Bảo mật giao diện lập trình

| Mã | Biện pháp |
|---|---|
| BM-23 | Bắt buộc mã hóa đường truyền bằng giao thức bảo mật |
| BM-24 | Kiểm tra và từ chối dữ liệu vào theo danh sách trường cho phép, không nhận trường lạ |
| BM-25 | Chống tiêm câu lệnh bằng truy vấn có tham số, không nối chuỗi câu truy vấn |
| BM-26 | Giới hạn tần suất cho các điểm cuối nhạy cảm: đăng nhập, gửi thông báo, gửi phiếu bình chọn, xuất dữ liệu |
| BM-27 | Giới hạn dung lượng và định dạng tệp tải lên; kiểm tra nội dung tệp, không chỉ kiểm tra phần mở rộng |
| BM-28 | Truy cập tệp qua đường dẫn có thời hạn, kiểm tra quyền trước khi trả tệp |
| BM-29 | Không trả về thông tin nội bộ trong phản hồi lỗi; chỉ trả mã lỗi và mã tương quan |
| BM-30 | Cấu hình chia sẻ tài nguyên nguồn gốc chỉ cho phép các tên miền của hệ thống |
| BM-57 | Tầng giao diện không truy cập cơ sở dữ liệu và không giữ thông tin đăng nhập cơ sở dữ liệu |
| BM-58 | Máy chủ API nghiệp vụ kiểm tra mã phiên với dịch vụ định danh hoặc kiểm tra chữ ký của mã trước khi xử lý mọi yêu cầu |
| BM-59 | Phê duyệt theo hạn mức được kiểm tra ở máy chủ; không tin giá trị hạn mức do giao diện gửi lên |
| BM-62 | Điểm cuối nhận thông báo tiền vào chỉ chấp nhận yêu cầu có chữ ký hợp lệ của nhà cung cấp và đến từ địa chỉ mạng cho phép; chống xử lý trùng theo mã giao dịch của nhà cung cấp; không tự lập phiếu thu khi số tiền hoặc nội dung không khớp. Điểm cuối giả lập chỉ bật với bộ giả lập nhà cung cấp, cần mã phiên có quyền lập phiếu thu; không bật ở môi trường chạy thật (YCTD-57) |
| BM-63 | Tệp Excel nhập dữ liệu ban đầu được kiểm tra định dạng và nội dung, giới hạn dung lượng; chỉ VT-02, VT-04, VT-06 được nhập; mỗi lần nhập ghi nhật ký |
| BM-65 | Khóa API của đối tác lưu dạng băm, chỉ hiển thị một lần khi cấp; mỗi khóa có phạm vi dữ liệu, địa chỉ mạng cho phép, ngày hết hạn và giới hạn tần suất; thu hồi có hiệu lực ngay |
| BM-66 | Đối tác chỉ đọc dữ liệu cá nhân khi khóa ghi căn cứ pháp lý; mỗi lần đọc ghi nhật ký truy cập dữ liệu nhạy cảm kèm khóa, phạm vi và số bản ghi |

## 6. Quản lý bí mật và cấu hình

| Mã | Biện pháp |
|---|---|
| BM-31 | Không đặt bí mật trong mã nguồn hoặc trong tệp cấu hình mẫu |
| BM-32 | Bí mật lưu trong biến môi trường hoặc kho bí mật của hạ tầng |
| BM-33 | Tách cấu hình theo môi trường; không dùng chung bí mật giữa các môi trường |
| BM-34 | Xoay khóa và mật khẩu định kỳ, tối thiểu mỗi năm một lần và ngay khi có người rời nhóm |
| BM-35 | Không ghi bí mật vào nhật ký, kể cả khi ghi lỗi kết nối |

## 7. Nhật ký và giám sát bảo mật

| Mã | Nội dung theo dõi |
|---|---|
| BM-36 | Số lần đăng nhập sai theo tài khoản và theo địa chỉ mạng |
| BM-37 | Truy cập dữ liệu ngoài phạm vi đơn vị được gán |
| BM-38 | Xuất dữ liệu với khối lượng bất thường |
| BM-39 | Thay đổi vai trò và quyền |
| BM-40 | Truy cập dữ liệu sức khỏe ngoài giờ làm việc hoặc với tần suất bất thường |
| BM-41 | Lỗi xác thực và lỗi phân quyền tăng đột biến |
| BM-60 | Phê duyệt chứng từ vượt hạn mức bị từ chối hoặc bị chuyển cấp bất thường |

Các trường hợp trên phải đẩy cảnh báo cho quản trị nền tảng và ghi vào nhật ký bảo mật riêng.

## 8. Sao lưu và khôi phục

| Mã | Biện pháp |
|---|---|
| BM-42 | Sao lưu theo SL-01 đến SL-04: sao lưu toàn bộ hằng ngày, giữ tối thiểu ba mươi ngày, gồm cơ sở dữ liệu định danh, cơ sở dữ liệu hệ thống, cơ sở dữ liệu năm học đang dùng và kho tệp; cơ sở dữ liệu năm học đã đóng sao lưu một lần khi đóng và giữ lâu dài; sao lưu tăng dần mỗi giờ với dữ liệu tài chính; khôi phục trong 4 giờ, mất tối đa dữ liệu của 1 giờ gần nhất |
| BM-43 | Bản sao lưu được mã hóa và lưu ở nơi khác với máy chủ chính |
| BM-44 | Kiểm tra phục hồi định kỳ hằng tháng trên môi trường tách biệt, có biên bản |
| BM-45 | Giới hạn quyền truy cập bản sao lưu; chỉ quản trị nền tảng được truy cập |
| BM-46 | Có phương án quay lui cho mỗi lần phát hành |

## 9. Ứng phó sự cố

| Mã | Bước | Nội dung |
|---|---|---|
| BM-47 | Phát hiện | Cảnh báo tự động hoặc báo cáo từ người dùng |
| BM-48 | Khoanh vùng | Xác định phạm vi ảnh hưởng: tài khoản, đơn vị, loại dữ liệu |
| BM-49 | Ngăn chặn | Khóa tài khoản liên quan, thu hồi phiên, tạm dừng kênh bị ảnh hưởng |
| BM-50 | Điều tra | Đọc nhật ký thao tác, nhật ký truy cập, nhật ký lỗi |
| BM-51 | Khắc phục | Sửa lỗi gốc, khôi phục dữ liệu nếu cần |
| BM-52 | Thông báo | Thông báo cho nhà trường và phụ huynh bị ảnh hưởng theo mức độ sự cố |
| BM-53 | Rà soát | Ghi biên bản sự cố, xác định nguyên nhân gốc, bổ sung biện pháp phòng ngừa |
| BM-73 | Nền đa thuê bao (YCTD-191, BR-201): dữ liệu mỗi trường nằm ở cơ sở dữ liệu hoặc lược đồ riêng với vai trò PostgreSQL chỉ có quyền trên phần của mình; mã phiên mang mã trường và bị từ chối ở tên miền trường khác; cookie mã làm mới, khóa Redis, khóa tệp có tiền tố của trường; khóa mã hóa và khóa băm số định danh của trẻ riêng từng trường; thiếu ngữ cảnh trường là lỗi; kiểm tra tĩnh mã nguồn và ma trận cách ly chạy ở mọi lần gộp |
| BM-74 | Bí mật của nền tảng (YCTD-191): mật khẩu kết nối cơ sở dữ liệu của từng trường và khóa dữ liệu trẻ chỉ lưu bản mã AES-256-GCM bằng khóa gốc `PLATFORM_MASTER_KEY` (32 byte, đặt ở môi trường của máy chủ ứng dụng, không lưu cùng cơ sở dữ liệu); khóa gốc sai thì không đọc được; tên miền của cổng biên kèm bí mật chung `EDGE_SHARED_SECRET` so sánh thời gian hằng; không ghi bí mật vào kho mã nguồn |
| BM-75 | Tài khoản vận hành nền tảng (YCTD-191, PQ-105): ở cơ sở dữ liệu nền tảng, mật khẩu argon2id theo chính sách BM-03, khóa 15 phút sau 5 lần sai, mã phiên đối tượng riêng hạn 8 giờ, chỉ phục vụ ở tên miền cổng nền tảng, mọi lần đăng nhập ghi nhật ký nền tảng; xác thực hai lớp bắt buộc làm ở phần S8b |
| BM-76 | Việc nền và điểm công khai nhiều trường (YCTD-192, BR-203 đến BR-205): việc nền chạy trong ngữ cảnh của đúng trường và tiến trình máy xếp nhận tiền tố khóa kèm phần tử hàng đợi nên không đọc hay ghi khóa của trường khác; điểm tick đòi `INTERNAL_JOB_TOKEN` so sánh thời gian hằng và giới hạn tần suất, không có mã thì không tồn tại; trang chọn trường chỉ đổi mã thành địa chỉ, không liệt kê trường; `domain-check` chỉ trả 200 hoặc 404; hạn mức tần suất công khai tách theo trường; hạn mức lần xếp đang chạy mỗi trường chống một trường chiếm máy xếp |
| BM-77 | Kích hoạt quản trị viên đầu tiên (YCTD-193, BR-208): tài khoản mới có mã băm của mật khẩu ngẫu nhiên đã bỏ nên không đăng nhập được trước khi kích hoạt; mã kích hoạt 24 byte ngẫu nhiên, chỉ lưu mã băm SHA-256, hạn 72 giờ, dùng một lần (đánh dấu có điều kiện nên hai yêu cầu cùng lúc chỉ một được), chỉ dùng ở tên miền của đúng trường, có giới hạn tần suất; cổng nền tảng chỉ hiện đường kích hoạt một lần, chi tiết trường không trả mã; không gửi mật khẩu qua kênh nào |
| BM-78 | Quản lý vòng đời trường (YCTD-193, PQ-106): thao tác chỉ ở tên miền cổng nền tảng bằng mã phiên vận hành, mọi thao tác ghi sự kiện vòng đời và nhật ký nền tảng; hồ sơ đồng ý chỉ lưu mã băm và khóa tệp của bản quét; việc khởi tạo không lưu mật khẩu; xóa vĩnh viễn chỉ sau thời gian chờ, xóa cả vai trò PostgreSQL, khóa dữ liệu trẻ, tệp của trường (khóa Redis của trường đều có hạn sống tối đa 2 giờ nên tự hết, không xóa), bản ghi chứng minh chỉ giữ mã băm tên trường; trường số 1 không xóa bằng lệnh này |
| BM-79 | Cổng biên hồ sơ thử nghiệm (YCTD-203): máy chủ có địa chỉ công khai chỉ nhận ra trường khi tiêu đề tên miền đi kèm bí mật `x-edge-auth` khớp `EDGE_SHARED_SECRET` (so sánh thời gian hằng); cổng biên bỏ `x-edge-auth`, `x-school-host`, `x-forwarded-host`, `x-website-root` do người dùng tự đặt và ghi đè `x-forwarded-for`; `tick` cần `INTERNAL_JOB_TOKEN`; bí mật đặt bằng `wrangler secret`, biến bí mật của Render, Koyeb, không có trong kho; tệp mẫu chỉ có giá trị giả |
| BM-80 | Dữ liệu thật ở máy chủ ngoài nước (YCTD-203, BR-207, BR-209, PL-00 đến PL-15 của `33_HO_SO_PHAP_LY/`): chỉ trường đủ hồ sơ đồng ý; `PLATFORM_MASTER_KEY` chỉ ở máy chủ ứng dụng, không ở nhà cung cấp cơ sở dữ liệu, nên nhà cung cấp chỉ thấy bản mã của số định danh trẻ; phần dữ liệu còn lại dạng rõ (biện pháp giảm rủi ro, đề xuất mã hóa thêm số điện thoại cha mẹ, địa chỉ nhà, hồ sơ sức khỏe ở S3, S8b); biểu ngữ môi trường thử nghiệm; chuyển về trong nước bằng `platform relayout` (khóa bọc lại bằng khóa gốc của đích); kho khóa trong bộ nhớ (`REDIS_URL=memory://`) chỉ dùng với một bản dịch vụ; `SMS_ALLOW_LOG` chỉ cho trường dữ liệu giả |
| BM-81 | Khóa kết nối ngoài của trường (YCTD-195, BR-211): mã hóa AES-256-GCM bằng khóa của trường trước khi lưu, không bao giờ trả lại qua API hay ghi vào nhật ký, chỉ bốn ký tự cuối để nhận biết; chế độ nhiều trường không rơi về khóa ở biến môi trường của cả bản triển khai hay của trường khác; chỉ người có quyền P01.integration.manage xem và đổi |
| BM-82 | Đổi khóa dữ liệu trẻ và khóa gốc (YCTD-195, BR-212): khóa mới sinh ngẫu nhiên và bọc bằng khóa gốc ngay khi tạo; chỉ làm khi trường tạm dừng; thay khóa hiện tại nguyên tử khi xong; khóa gốc đổi bằng lệnh bọc lại trong một giao dịch; mọi bước ghi nhật ký nền tảng |
| BM-83 | Bản sao lưu theo trường (YCTD-199, BR-217): tệp `.sbak` mã hóa AES-256-GCM bằng khóa dẫn từ `BACKUP_ENCRYPTION_PASSPHRASE` (scrypt, muối ngẫu nhiên, ít nhất 16 ký tự), quyền tệp 600, thư mục 700; tệp chứa cả khóa dữ liệu trẻ của trường (đã giải mã khỏi khóa gốc) nên bảo vệ khóa sao lưu như khóa gốc, giữ bản sao khóa ngoài máy chủ; mã xác thực kiểm cả tệp trước khi khôi phục, tệp bị sửa hoặc sai khóa thì từ chối; WAL-G mã hóa bằng libsodium (`WALG_LIBSODIUM_KEY`) trước khi đẩy; bản khôi phục tạm của cả cụm chạy trong mạng Docker riêng không nối hệ thống đang chạy; khôi phục, chuyển cụm chỉ khi trường tạm dừng; mỗi lần ghi `backup_runs` và nhật ký nền tảng |
| BM-84 | Xác thực hai lớp (YCTD-201, BR-219, GD-97): bắt buộc cho tài khoản vận hành nền tảng; tuỳ chọn bật theo trường, mặc định tắt (YCTD-31 giữ nguyên). TOTP chuẩn RFC 6238 (SHA-1, 30 giây, 6 chữ số, lệch một bước), mỗi mã một lần, cập nhật bước dùng cuối có điều kiện để hai yêu cầu cùng lúc không cùng dùng một mã; khóa mã hóa AES-256-GCM (khóa của trường hoặc khóa gốc nền tảng); mã khôi phục chỉ lưu bản băm; sai mã tính vào bộ đếm khóa tạm |
| BM-85 | Mật khẩu và khóa tạm theo trường (YCTD-201, BR-220): độ dài tối thiểu, ngưỡng sai và thời gian khóa cấu hình theo trường trong giới hạn; tài khoản vận hành tối thiểu 12 ký tự theo ASVS 2.1.1 |
| BM-86 | Tiêu đề bảo mật và cookie (YCTD-201, BR-221): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS (`includeSubDomains`) khi qua HTTPS, `Cache-Control: no-store` ở nhóm xác thực, bỏ `X-Powered-By`; Caddy đặt lớp tiêu đề tương ứng; cookie mã làm mới `__Secure-`, httpOnly, SameSite=Strict, Secure |
| BM-87 | Xoay khóa (YCTD-201): khóa ký mã phiên theo quy trình hai pha (mục 10A); khóa gốc nền tảng bằng `platform rewrap-master-key`; khóa dữ liệu trẻ bằng `platform rotate-child-key` (gồm cơ sở dữ liệu định danh, nơi có khóa TOTP); khóa tích hợp của trường nhập lại ở màn hình quản trị |
| BM-88 | Thu phí của nền tảng (YCTD-196): khóa cổng thanh toán của nền tảng lưu mã hóa AES-256-GCM bằng khóa gốc của nền tảng, chỉ trả gợi ý bốn ký tự cuối, đổi khóa ghi nhật ký; điểm nhận tiền vào không cần trường nhưng xác thực bằng chữ ký hoặc khóa của cổng (so sánh thời gian hằng), cổng chưa bật trả 404; trùng mã giao dịch không ghi lại; trường chỉ thấy hóa đơn của mình; mọi điều chỉnh tay cần lý do và ghi nhật ký nền tảng |
| BM-89 | Phiên hỗ trợ của nhân viên nền tảng (YCTD-197, BR-227, QĐ-32): chỉ khi trường đồng ý (lưu ở cơ sở dữ liệu của trường, có hạn, rút được); mã một lần chỉ lưu mã băm, hạn 5 phút, đánh dấu đã dùng nguyên tử, chỉ dùng ở tên miền của đúng trường; tài khoản hỗ trợ riêng không đăng nhập được bằng mật khẩu; kiểm phiên còn hiệu lực ở mỗi yêu cầu; phiên chỉ đọc chặn ghi ở cả hai dịch vụ; không đăng nhập thay, đổi mật khẩu, kí số, xuất toàn bộ, đổi cho phép; nhật ký hai phía. Số liệu và lỗi theo trường không chứa nội dung dữ liệu: lỗi chỉ ghi mẫu đường dẫn đã bỏ tham số, mã trạng thái, mã lỗi |
| BM-90 | Đơn vị cấp trên (YCTD-202, BR-228 đến BR-230, QĐ-33): tài khoản cấp trên xác thực hai lớp bắt buộc (khóa TOTP mã hóa bằng khóa gốc, bọc lại khi đổi khóa gốc; mã khôi phục chỉ lưu bản băm; mỗi mã dùng một lần), mật khẩu tối thiểu 12 ký tự, khóa tạm khi sai 5 lần; chỉ phục vụ ở tên miền cổng nền tảng, mã phiên có đối tượng riêng; phạm vi là cây con của nút, kiểm ở mọi yêu cầu; chỉ số liệu tổng hợp có đồng ý của trường, không dữ liệu cá nhân, ẩn nhóm nhỏ; xem chi tiết chỉ qua phiên hỗ trợ chỉ đọc theo đề nghị trường duyệt, rút được; mọi đăng nhập, xem, xuất, đề nghị, duyệt ghi nhật ký nền tảng và nhật ký của trường | Kiểm thử CT-1069 đến CT-1077 |
| BM-100 | Ứng dụng web cài được (YCTD-231, BR-238): service worker dùng chung không bao giờ giữ phản hồi `/api` (kiểm bằng e2e spec 181); mỗi ứng dụng một tiền tố bộ nhớ đệm, gỡ chỉ xóa của ứng dụng đó; manifest, biểu tượng là dữ liệu công khai theo tên miền của trường, không có dữ liệu cá nhân; đường dẫn gốc nhận vào chỉ dạng `/…/` nên manifest không trỏ được ra ngoài nguồn gốc của trường; biểu tượng SVG thoát ký tự, chỉ nhúng ảnh biểu trưng loại ảnh dưới 512 KB, trả kèm `content-security-policy` chặn mã; lời mời cài chỉ ghi thời điểm "Để sau" ở localStorage của máy |
| BM-120 | Xem camera trực tiếp khi thi (YCTD-215): hình đi thẳng giữa trình duyệt giáo viên và học sinh (WebRTC mã hoá DTLS-SRTP), máy chủ API không nhận hay lưu hình, chỉ chuyển thông điệp báo hiệu sống ngắn (xoá khi kết thúc và sau 1 giờ); chỉ người giao bài, người dạy lớp được giao và người quản lý mở được phiên, chỉ người mở phiên đọc, gửi thông điệp của phiên đó; học sinh thấy dòng thông báo khi có người xem; mỗi phiên ghi nhật ký người xem; máy chủ kiểm lại đồng ý của cha mẹ và công tắc của trường ở mỗi lần mở; thông tin TURN là tên đăng nhập có hạn tính từ khoá dùng chung đặt ở biến môi trường |
| BM-121 | Bản ghi camera khi thi (YCTD-215): mặc định tắt; mã hoá AES-256-GCM bằng khoá dữ liệu trẻ em trước khi vào kho tệp, mỗi đoạn một số dùng một lần; khoá lưu trữ không đoán được; chỉ người giao bài và người quản lý đề, kiểm tra xem lại, qua máy chủ có kiểm quyền (không có đường dẫn công khai, không lưu đệm, không có nút tải xuống, chặn nhấp phải), mỗi lần xem ghi nhật ký người xem và nhật ký thao tác; tự xoá theo hạn của trường (7 đến 90 ngày) bằng việc nền; không nhận diện danh tính sinh trắc; khuyến nghị đặt ngăn truy cập công khai và mã hoá phía kho tệp |
| BM-122 | Thông báo và đồng ý khi giám sát bằng camera (YCTD-215): học sinh phải xác nhận thông báo (ghi thời điểm), học sinh dưới 16 tuổi hoặc chưa rõ ngày sinh cần cha mẹ đồng ý từng loại, đồng ý do phụ huynh thực hiện (kiểm quan hệ phụ huynh của từng con) hoặc người quản lý ghi nhận văn bản (ghi người đồng ý và người ghi nhận); thu hồi có hiệu lực ngay; mọi thay đổi đồng ý vào nhật ký thao tác; **cần luật sư rà (PL-15) trước khi bật ở trường thật** |
| BM-101 | Dữ liệu học tập trực tuyến (YCTD-272): nhật ký học tập chỉ ghi người, động từ, hoạt động, kết quả, thời điểm, không ghi vị trí, chuỗi nhận dạng thiết bị; phụ huynh chỉ đọc việc học của con mình, hoạt động khóa không lộ hướng dẫn; khoá mẫu không chứa dữ liệu học sinh; liên kết ngoài chỉ https và theo danh sách tên miền của trường khi trường đặt; mọi bảng ở cơ sở dữ liệu của trường, cách ly ở cả hai bố cục (CT-28b-15) |
| BM-130 | Bài nộp của học sinh (YCTD-273, BR-284): bài làm, ảnh, tệp, ghi âm là dữ liệu của trẻ; chỉ học sinh của bài (hoặc nhóm em), giáo viên của lớp học trực tuyến xem; phụ huynh chỉ thấy trạng thái, điểm, nhận xét đã trả; ảnh bỏ siêu dữ liệu trên máy và ở máy chủ (không lưu vị trí, máy chụp); tệp nhận theo byte đầu, trả về với `no-store`; đáp án, hướng dẫn chấm không xuống máy học sinh; đánh giá đóng góp chỉ giáo viên xem; không bảng xếp hạng |
| BM-131 | Trợ lý AI không thấy bài làm (YCTD-273, BR-285, GD-142): yêu cầu gợi ý nhận xét không có trường nào cho bài làm; chữ giáo viên nhập bị quét dữ liệu cá nhân như 23d; nhật ký `ai_requests` chỉ lưu mã băm lời nhắc, loại `feedback` |
| BM-104 | Giao diện thông báo đẩy (YCTD-239, BR-244): chỉ hỏi quyền thông báo khi người dùng bấm; đăng ký đẩy gửi lên máy chủ kèm nhãn máy ngắn (loại máy, trình duyệt), không gửi nguyên chuỗi nhận dạng trình duyệt; đăng xuất thu hồi đăng ký ở máy chủ (cần mã phiên nên gọi trước khi đăng xuất) và hủy ở trình duyệt để máy dùng chung không nhận đẩy của người trước; service worker không mở địa chỉ do nội dung đẩy gửi tới, chỉ mở hoặc đưa lên trước ứng dụng trong phạm vi của nó; nội dung hiện chỉ là tiêu đề, câu chung của máy chủ |
| BM-91 | Dữ liệu công cụ lớp học trên máy giáo viên (YCTD-212, BR-233, GD-108): bản chụp danh sách lớp chỉ gồm số thứ tự, họ tên, mã học sinh, cờ vắng, không điểm, nhận xét, thông tin phụ huynh; hết hạn theo cấu hình trường (mặc định 24 giờ) và bị xóa khi đăng xuất, phiên hết hạn, trường tắt ngoại tuyến; service worker không bao giờ giữ lời gọi API nên mã phiên và dữ liệu không nằm trong bộ nhớ đệm; tuyến `/classroom-tools` chỉ trả dữ liệu của lớp mà người gọi có phạm vi xem, ngoài phạm vi 403, và nằm trong ma trận cách ly giữa các trường; rủi ro còn lại: máy bị mất khi chưa hết hạn lộ họ tên và mã học sinh của lớp đã mở, giảm bằng hạn ngắn, xóa khi đăng xuất, công tắc tắt theo trường |
| BM-92 | Trợ lý AI (YCTD-214, BR-234 đến BR-236, QĐ-35): lời nhắc dựng từ mẫu cố định, chữ nhập bị quét thư điện tử, số điện thoại, số định danh, mã học sinh và họ tên đầy đủ trong danh sách trường ở máy chủ rồi mới gửi, thấy thì từ chối; không đưa bài làm, điểm, nhận xét, danh sách lớp, ảnh vào lời nhắc; khóa AI của trường mã hóa bằng khóa của trường, khóa chung của nền tảng mã hóa bằng khóa gốc và không xuống cơ sở dữ liệu trường, không bao giờ trả lại giá trị (chỉ bốn ký tự cuối), lỗi của nhà cung cấp chỉ giữ mã trạng thái; thiếu ngữ cảnh trường thì đóng chặt; tắt mặc định; nhật ký chỉ giữ mã băm lời nhắc; kết quả luôn là bản nháp, người yêu cầu không tự duyệt; `AI_MOCK` bị từ chối ở môi trường chạy thật |

Từ YCTD-200 (DT-SaaS phần S8a), quy trình xử lý sự cố và thông báo vi phạm dữ liệu cá nhân của nền tảng nhiều trường (thời hạn 72 giờ theo Điều 23 Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, nội dung theo Điều 28 Nghị định 356/2025/NĐ-CP) ở `33_HO_SO_PHAP_LY/12_QUY_TRINH_SU_CO_VA_THONG_BAO.md` (bản nháp chờ luật sư rà).

## 10. Trách nhiệm của các bên

| Bên | Trách nhiệm |
|---|---|
| Nhà trường | Hiệu trưởng chịu trách nhiệm bảo vệ dữ liệu cá nhân tại trường (Q-108); quản lý tài khoản nhân sự, gán đúng vai trò và đơn vị, thu hồi quyền khi nhân sự rời đi, xử lý yêu cầu của phụ huynh về dữ liệu, cấp và thu hồi khóa API cho đối tác |
| Nhóm phát triển | Thực hiện đúng các biện pháp ở tài liệu này, không tự ý nới lỏng kiểm tra quyền, báo cáo rủi ro phát hiện được |
| Quản trị nền tảng | Vận hành hạ tầng, sao lưu, giám sát, ứng phó sự cố, không truy cập dữ liệu nghiệp vụ |
| Bên thứ ba | Cơ quan quản lý giáo dục và phần mềm kế toán chỉ đọc qua API theo khóa hoặc qua vai trò VT-19; đơn vị kiểm toán dùng vai trò VT-20 có ngày hết hiệu lực; bảo hiểm xã hội và cơ quan thuế chỉ nhận tệp xuất, không có tài khoản (Q-110) |


Từ YCTD-200, khi chạy nhiều trường (DT-SaaS): trường là bên kiểm soát dữ liệu cá nhân, nền tảng là bên xử lý; quyền, nghĩa vụ theo thỏa thuận xử lý dữ liệu `33_HO_SO_PHAP_LY/02_THOA_THUAN_XU_LY_DU_LIEU.md`.

## 10A. Bảo mật mã cho nhiều trường (DT-SaaS phần S8b, YCTD-201)

### Quy trình xoay khóa ký mã phiên (hai pha, không ngừng dịch vụ)

1. Sinh cặp khóa mới bằng `pnpm --filter @school-management/identity generate-token-keys`.
2. Triển khai dịch vụ định danh với `IDENTITY_TOKEN_PRIVATE_KEY` mới và `TOKEN_PUBLIC_KEY` mới; đặt `TOKEN_PREVIOUS_PUBLIC_KEY` bằng khóa công khai cũ ở dịch vụ định danh **và** máy chủ API. Mã phiên mới ký bằng khóa mới, mã phiên cũ vẫn được nhận.
3. Chờ quá hạn mã phiên (15 phút) với mã vận hành 8 giờ thì chờ 8 giờ, rồi gỡ `TOKEN_PREVIOUS_PUBLIC_KEY` và triển khai lại. Mã làm mới dài hơn không phụ thuộc khóa ký.
4. Nghi lộ khóa: bỏ qua bước chờ, gỡ khóa cũ ngay; mọi người dùng phải đăng nhập lại.

### Danh sách kiểm ASVS mức 2 cho phần đa thuê bao (Eric thuê bên ngoài kiểm thử xâm nhập; phần này chỉ ghi hồ sơ và sửa lỗi tìm ra)

| Nhóm ASVS | Yêu cầu | Trạng thái | Bằng chứng |
|---|---|---|---|
| V2 Xác thực | Mật khẩu tối thiểu, khóa tạm, xác thực hai lớp cho tài khoản đặc quyền | Có | `totp.test.ts`, `platform-operators.test.ts`, spec 138 |
| V3 Phiên | Cookie `__Secure-`, httpOnly, SameSite; phiên gắn trường (`tid`); thu hồi khi đổi mật khẩu | Có | `tenancy.test.ts`, spec 130 |
| V4 Kiểm soát truy cập | Vượt trường: mã phiên trường A ở trường B, tuyến nào cũng 401 | Có | ma trận cách ly `tenancy-matrix.test.ts` |
| V5 Kiểm tra đầu vào | Giả `Host`, `X-Forwarded-Host` chỉ tin khi có bí mật cổng biên; tên miền lạ 404 | Có | `tenancy.test.ts`, spec 130 |
| V8 Bảo vệ dữ liệu | Khóa tích hợp, khóa TOTP, số định danh mã hóa; khóa của trường tách nhau; đổi khóa được | Có | `school-settings.test.ts`, `key-rotation.test.ts` |
| V9 Truyền thông | HSTS qua HTTPS, chứng chỉ theo yêu cầu chỉ cho tên miền đã xác minh | Có | `security-headers.test.ts`, spec 131 |
| V12 Tệp | Khóa tệp có tiền tố trường; xuất, xóa theo tiền tố | Có | `school-lifecycle` (S2) |
| V14 Cấu hình | Tiêu đề bảo mật, quét bí mật, quét thành phần phụ thuộc ở CI, kiểm tĩnh nhiều trường | Có | `secret-scan.test.mjs`, `static-guard.test.mjs`, việc CI `quet-phu-thuoc` |
| Kiểm thử xâm nhập bên ngoài | Vượt trường, đổi tên miền, giả Host, tải tệp độc hại, kênh phụ thời gian | Chờ Eric thuê | hồ sơ bàn giao sau khi có báo cáo |

## 11. Chưa xác minh được

Không còn mục chưa xác minh. Bốn mục trước đây đã được trả lời tại Q-107 đến Q-110; văn bản pháp luật áp dụng phải kiểm tra lại trước khi phát hành theo BM-67.

## 12. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-58 | Đã xác nhận ngày 09/10/2026: Hệ thống triển khai trên hạ tầng có mã hóa đường truyền và sao lưu tự động | Eric |
| GD-59 | Đã xác nhận ngày 09/10/2026: Nhà trường là bên kiểm soát dữ liệu, nhóm phát triển là bên xử lý dữ liệu theo yêu cầu của nhà trường | Eric |
| GD-69 | Đã xác nhận ngày 09/10/2026 (theo QĐ-08): Dịch vụ định danh tự viết nên toàn bộ trách nhiệm bảo mật xác thực thuộc nhóm phát triển, không dựa vào nhà cung cấp ngoài | Eric |
| Q-107 | Đã trả lời ngày 09/10/2026: tuân thủ quy định bảo vệ dữ liệu cá nhân hiện hành; kiểm tra lại văn bản trước khi phát hành (BM-67) | Eric |
| Q-108 | Đã trả lời ngày 09/10/2026: Hiệu trưởng chịu trách nhiệm bảo vệ dữ liệu cá nhân tại trường | Eric |
| Q-109 | Đã trả lời ngày 09/10/2026: nhật ký giữ tối thiểu 24 tháng | Eric |
| Q-110 | Đã trả lời ngày 09/10/2026: cơ quan quản lý giáo dục và phần mềm kế toán đọc qua API hoặc vai trò VT-19; đơn vị kiểm toán dùng vai trò VT-20; bảo hiểm xã hội, cơ quan thuế chỉ nhận tệp xuất | Eric |
| Q-120 | Đã trả lời ngày 09/10/2026: mã phiên 15 phút; mã làm mới 8 giờ cho cổng quản trị, 30 ngày cho ứng dụng giáo viên và phụ huynh | Eric |
