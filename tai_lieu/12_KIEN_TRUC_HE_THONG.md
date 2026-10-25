# 12. KIẾN TRÚC HỆ THỐNG

- Mô tả: Kiến trúc tổng thể, thành phần, xác thực, phân quyền, lưu trữ tệp, ghi nhật ký, giám sát, sao lưu, phục hồi, triển khai.
- Phiên bản: 1.21
- Ngày cập nhật: 2026-10-25
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Kiến trúc tổng thể

Kiến trúc tách biệt ba tầng: tầng giao diện, tầng dịch vụ ứng dụng và tầng dữ liệu. Tầng giao diện và tầng dịch vụ ứng dụng tách rời hoàn toàn; giao diện chỉ giao tiếp với máy chủ qua giao diện lập trình ứng dụng, không truy cập cơ sở dữ liệu.

```mermaid
flowchart TD
  subgraph KENH[Tang giao dien]
    CT[Cong quan tri tren trinh duyet]
    GV[Ung dung giao vien tren trinh duyet va dien thoai]
    PH[Ung dung phu huynh tren dien thoai]
  end
  subgraph DV[Tang dich vu ung dung]
    ID[Dich vu dinh danh doc lap]
    API[May chu API nghiep vu doc lap]
    WK[Tien trinh chay nen]
    NT[Trung tam thong bao]
  end
  subgraph DU_LIEU[Tang du lieu]
    DB[Co so du lieu nghiep vu, moi nam hoc mot co so du lieu]
    IDDB[Co so du lieu dinh danh]
    FS[Kho luu tru tep]
    RD[Hang doi va bo nho dem]
  end
  subgraph NGOAI[Dich vu ngoai]
    SMS[Kenh tin nhan]
    MAIL[Thu dien tu]
    FB[Facebook va Fanpage]
    PAY[Xac nhan chuyen khoan ma QR]
    DTAC[Doi tac doc qua API]
  end
  CT --> ID
  GV --> ID
  PH --> ID
  CT --> API
  GV --> API
  PH --> API
  API --> ID
  ID --> IDDB
  API --> DB
  API --> FS
  API --> RD
  WK --> DB
  WK --> RD
  NT --> RD
  NT --> SMS
  NT --> MAIL
  NT --> FB
  API --> PAY
  DTAC --> API
```

Nguyên tắc tách tầng:

1. Ba kênh giao diện là ứng dụng chạy trên trình duyệt, không chứa mã nghiệp vụ, không chứa quy tắc tính toán, không truy cập cơ sở dữ liệu.
2. Máy chủ API nghiệp vụ là nơi duy nhất thực thi quy tắc nghiệp vụ và kiểm tra phân quyền.
3. Dịch vụ định danh tách riêng, chịu trách nhiệm xác thực, cấp phiên, quản lý tài khoản, vai trò và phạm vi đơn vị. Đây là dịch vụ tự viết, không dùng sản phẩm định danh bên ngoài và không dùng dịch vụ đám mây.
4. Giao diện chỉ giữ mã phiên ngắn hạn; không giữ khóa bí mật của dịch vụ ngoài và không gọi trực tiếp dịch vụ ngoài.
5. Dịch vụ định danh chạy tiến trình riêng và dùng cơ sở dữ liệu riêng, không theo năm học; ở giai đoạn 1 có thể đặt cùng máy chủ (Q-115, QĐ-15). Máy chủ API nghiệp vụ dùng cơ sở dữ liệu theo năm học và một cơ sở dữ liệu hệ thống nhỏ chứa danh sách cơ sở dữ liệu năm học (QĐ-17). Khóa API của đối tác nằm ở cơ sở dữ liệu định danh. Hai bên dùng tài khoản kết nối riêng.
6. Đối tác bên ngoài chỉ đọc dữ liệu qua máy chủ API nghiệp vụ bằng khóa API có phạm vi (QĐ-16), không truy cập cơ sở dữ liệu.

## 2. Thành phần

| Mã | Thành phần | Tầng | Trách nhiệm |
|---|---|---|---|
| TP-01 | Cổng quản trị | Giao diện | Giao diện cho khối quản lý, tài chính, nhân sự, vận hành. Chỉ gọi API |
| TP-02 | Ứng dụng giáo viên | Giao diện | Giao diện tác nghiệp tại lớp, dùng được trên điện thoại. Chỉ gọi API |
| TP-03 | Ứng dụng phụ huynh | Giao diện | Giao diện theo dõi con, thanh toán, trao đổi. Chỉ gọi API |
| TP-04 | Máy chủ API nghiệp vụ | Dịch vụ ứng dụng | Kiểm tra dữ liệu, thực thi quy tắc nghiệp vụ, phân quyền ba lớp, phục vụ mọi điểm cuối nghiệp vụ. Một máy chủ duy nhất, chia mô đun bên trong |
| TP-11 | Dịch vụ định danh | Dịch vụ ứng dụng | Đăng ký, đăng nhập, cấp và thu hồi phiên, quản lý tài khoản, vai trò và phạm vi đơn vị. Tách riêng khỏi máy chủ API nghiệp vụ |
| TP-05 | Tiến trình chạy nền | Dịch vụ ứng dụng | Tính học phí, tính lương, kiểm tra công nợ quá hạn, tổng hợp báo cáo, xử lý tệp |
| TP-06 | Trung tâm thông báo | Dịch vụ ứng dụng | Sinh thông báo theo sự kiện, phân phối theo kênh, ghi nhận trạng thái đã đọc |
| TP-07 | Cơ sở dữ liệu quan hệ | Dữ liệu | Lưu toàn bộ dữ liệu nghiệp vụ, có ràng buộc và chỉ mục |
| TP-08 | Kho lưu trữ tệp | Dữ liệu | Hình ảnh hoạt động, chứng từ, tệp đính kèm; giao diện S3, khi phát triển và kiểm thử là SeaweedFS trong Docker (YCTD-45) |
| TP-09 | Hàng đợi và bộ nhớ đệm | Dữ liệu | Xử lý tác vụ dài, giảm tải truy vấn đọc nhiều |
| TP-10 | Cổng tích hợp ngoài | Dịch vụ ứng dụng | Tin nhắn, thư điện tử, xác nhận chuyển khoản mã QR; ở giai đoạn 3 thêm Facebook, Zalo, kết nối cơ sở dữ liệu ngành của Bộ Giáo dục và Đào tạo. Chỉ máy chủ API và trung tâm thông báo được gọi. Nhà cung cấp tin nhắn và dịch vụ xác nhận chuyển khoản (trung gian hoặc ngân hàng trực tiếp) cấu hình được, mỗi loại dùng một lớp kết nối chung |

Ranh giới bắt buộc: TP-01, TP-02 và TP-03 không chứa quy tắc nghiệp vụ. Mọi quy tắc tính học phí, tính lương, hạn mức phê duyệt và kiểm tra quyền đều nằm ở TP-04 và TP-11.

## 3. Mô hình nhiều đơn vị

Ba phương án, chọn theo mức độ tách biệt dữ liệu và chi phí vận hành.

| Phương án | Cách làm | Ưu điểm | Nhược điểm |
|---|---|---|---|
| A. Một cơ sở dữ liệu, tách bằng cột đơn vị | Mọi bảng có cột đơn vị, kiểm tra ở tầng truy vấn | Chi phí thấp, báo cáo hợp nhất đơn giản, nâng cấp một lần | Cần kỷ luật kiểm tra đơn vị ở mọi truy vấn; rủi ro rò dữ liệu nếu sót |
| B. Một cơ sở dữ liệu, tách bằng lược đồ theo đơn vị | Mỗi đơn vị một lược đồ riêng | Tách biệt rõ hơn, ít rủi ro sót điều kiện | Nâng cấp phải chạy nhiều lần, báo cáo hợp nhất phức tạp |
| C. Mỗi đơn vị một cơ sở dữ liệu | Tách hoàn toàn | Tách biệt cao nhất | Chi phí và độ phức tạp vận hành cao nhất, báo cáo hợp nhất khó |

**Đã chốt ngày 09/10/2026:** phương án A kèm ràng buộc bắt buộc ở tầng dữ liệu để chống sót điều kiện đơn vị, ví dụ chính sách bảo vệ ở mức bản ghi và chỉ mục bắt buộc trên cột `org_unit_id`.

Theo QĐ-15, mỗi năm học có một cơ sở dữ liệu nghiệp vụ riêng. Khi mở năm học mới, hệ thống tạo cơ sở dữ liệu năm học và chuyển sang dữ liệu dùng chung: cây đơn vị, trẻ đang học, phụ huynh, nhân sự, hợp đồng còn hiệu lực, danh mục, cấu hình, số dư công nợ chưa tất toán, số dư quỹ và tài khoản. Cơ sở dữ liệu năm học đã đóng chuyển sang chỉ đọc. Báo cáo nhiều năm đọc từ nhiều cơ sở dữ liệu năm học.

Quy tắc phạm vi đơn vị (QĐ-23): người dùng được gán ở Trường chính có quyền toàn trường; người dùng được gán ở một Phân hiệu hoặc Điểm trường chỉ có quyền ở đơn vị đó. Người cần quyền ở nhiều đơn vị cấp 2 được gán ở từng đơn vị.

## 4. Xác thực

Xác thực do dịch vụ định danh đảm nhiệm, tách khỏi máy chủ API nghiệp vụ.

| Mã | Nội dung |
|---|---|
| XT-01 | Đăng nhập bằng số điện thoại hoặc tên đăng nhập kèm mật khẩu, thực hiện tại dịch vụ định danh. Phụ huynh có thêm cách đăng nhập bằng số điện thoại và mã một lần gửi qua tin nhắn |
| XT-02 | Cấp phiên ngắn hạn kèm mã làm mới; mã làm mới thu hồi được khi cần. Mã phiên hết hạn sau 15 phút; mã làm mới hết hạn sau 8 giờ với cổng quản trị, 30 ngày với ứng dụng giáo viên và phụ huynh |
| XT-03 | Tài khoản phụ huynh tạo với mật khẩu mặc định chung toàn trường do Hiệu trưởng đặt, lưu dạng băm ở dịch vụ định danh; bắt buộc đổi mật khẩu ở lần đăng nhập đầu; kích hoạt là đăng nhập bằng mật khẩu mặc định rồi đổi mật khẩu (YCTD-43) |
| XT-04 | Mật khẩu lưu dưới dạng băm có muối, không lưu bản rõ |
| XT-05 | Sai mật khẩu 5 lần liên tiếp thì tạm khóa tài khoản 15 phút rồi tự mở; giới hạn 10 yêu cầu đăng nhập mỗi phút trên một địa chỉ mạng (YCTD-35) |
| XT-06 | Mọi yêu cầu tới máy chủ API nghiệp vụ đều kiểm tra phiên còn hiệu lực: kiểm tra chữ ký của mã bằng khóa công khai, sau đó hỏi dịch vụ định danh vai trò và quyền hiện hành qua `GET /api/v1/auth/me` (QĐ-20, QĐ-22) |
| XT-07 | Bỏ ngày 09/10/2026: không dùng xác thực hai lớp (YCTD-31); Hiệu trưởng, Phó Hiệu trưởng, kế toán trưởng và quản trị nền tảng đăng nhập bằng mật khẩu như các vai trò khác |
| XT-08 | Dịch vụ định danh phát hành mã có thời hạn ngắn; máy chủ API nghiệp vụ không lưu mật khẩu và không tự xác thực mật khẩu |
| XT-09 | Mã một lần gồm sáu chữ số, chỉ dùng một lần; mặc định hết hạn sau 5 phút, nhập sai tối đa 5 lần, gửi tối đa 5 lần mỗi giờ cho một số điện thoại, Hiệu trưởng sửa được (YCTD-43); gửi qua lớp gửi tin nhắn của dịch vụ định danh, nối nhà cung cấp thật khi có tài khoản ở việc T1 |
| XT-10 | Hết hạn mật khẩu (YCTD-110): dịch vụ định danh lưu thời điểm đặt mật khẩu gần nhất của từng tài khoản (`users.password_changed_at`) và chính sách chung số ngày hết hạn, số ngày báo trước ở `identity_settings` (mặc định 0 là tắt, 7). Đăng nhập, làm mới phiên bằng mật khẩu của tài khoản nhân sự đã quá hạn thì cấp phiên chỉ được đổi mật khẩu như XT-03, ghi nhật ký bảo mật `login_password_expired`; phản hồi có `password_expired`, `password_expires_in_days` để giao diện báo (BR-110, BM-72) |

## 5. Phân quyền

Ba lớp kiểm tra, thực hiện ở máy chủ API nghiệp vụ tại mọi yêu cầu:

1. **Vai trò.** Vai trò quyết định nhóm chức năng được gọi. Danh sách vai trò do dịch vụ định danh cung cấp.
2. **Đơn vị.** Người dùng chỉ truy cập dữ liệu của đơn vị được gán và các đơn vị cấp dưới trực thuộc, trừ Hiệu trưởng, cán bộ quản lý cấp trên và kiểm toán viên ở phạm vi toàn trường. Quản trị nền tảng chỉ thao tác cấu hình kỹ thuật, không xem dữ liệu nghiệp vụ.
3. **Bản ghi.** Giáo viên chỉ tới lớp được phân công; tổ trưởng chuyên môn chỉ tới lớp thuộc tổ; phụ huynh chỉ tới trẻ có quan hệ; bảo vệ chỉ tới danh sách đón trả của đơn vị được gán.

Cơ chế bắt buộc: mọi truy vấn dữ liệu nghiệp vụ phải đi qua tầng kiểm tra phạm vi, không viết truy vấn trực tiếp trong tầng giao diện. Tầng giao diện không có thông tin đăng nhập cơ sở dữ liệu.

Phê duyệt theo hạn mức được kiểm tra ở lớp vai trò: vai trò Phó Hiệu trưởng chỉ phê duyệt được chứng từ dưới hạn mức cấu hình; chứng từ từ hạn mức trở lên, chứng từ thuộc loại chưa cấu hình hạn mức và phiếu chi hoàn tiền khi trẻ thôi học do vai trò Hiệu trưởng phê duyệt (BR-24, BR-77 đến BR-80, Q-112).

## 6. Lưu trữ tệp

| Loại tệp | Nơi lưu | Quy tắc |
|---|---|---|
| Hình ảnh hoạt động | Kho lưu trữ tệp | Nén trước khi lưu, sinh nhiều kích thước hiển thị, xóa mềm khi hoạt động bị xóa |
| Chứng từ phiếu thu, phiếu chi | Kho lưu trữ tệp | Không cho sửa hoặc thay thế sau khi phiếu phát hành, chỉ thêm tệp mới |
| Tệp đính kèm trao đổi | Kho lưu trữ tệp | Giới hạn định dạng và dung lượng |
| Tệp xuất báo cáo | Kho lưu trữ tệp | Có thời hạn lưu, ghi nhật ký ai đã xuất |

Truy cập tệp phải qua đường dẫn có thời hạn, không để đường dẫn công khai vĩnh viễn.

## 7. Ghi nhật ký

| Loại nhật ký | Nội dung | Thời gian lưu |
|---|---|---|
| Nhật ký thao tác | Người thực hiện, thời điểm, đối tượng, hành động, giá trị trước, giá trị sau | Tối thiểu hai mươi bốn tháng |
| Nhật ký truy cập dữ liệu nhạy cảm | Ai đọc dữ liệu sức khỏe, dữ liệu tài chính, hồ sơ trẻ; luôn ghi khi đối tác đọc dữ liệu cá nhân qua API và khi xem đầy đủ số định danh (BR-73) | Tối thiểu hai mươi bốn tháng |
| Nhật ký xuất dữ liệu | Ai xuất, loại dữ liệu, bộ lọc, thời điểm | Tối thiểu hai mươi bốn tháng |
| Nhật ký lỗi hệ thống | Lỗi, thời điểm, đường dẫn yêu cầu, mã tương quan | Tối thiểu sáu tháng |

## 8. Thông báo

```mermaid
flowchart LR
  SK[Su kien nghiep vu] --> M[Bo sinh thong bao]
  M --> L[Luu thong bao trong he thong]
  M --> H[Hang doi gui]
  H --> SMS[Tin nhan]
  H --> MAIL[Thu dien tu]
  H --> PUSH[Thong bao day]
  H --> FB[Facebook]
  L --> D[Danh dau da doc]
```

Kênh gửi và loại sự kiện cấu hình được theo đơn vị. Thông báo quan trọng bắt buộc ghi nhận trạng thái đã đọc theo từng người nhận.

## 9. Tiến trình chạy nền

| Mã | Tác vụ | Tần suất | Ghi chú |
|---|---|---|---|
| CB-01 | Tính học phí theo kỳ và đơn vị | Theo yêu cầu | Chạy theo lô, ghi trạng thái từng lô, cho chạy lại |
| CB-02 | Tính bảng lương theo kỳ | Theo yêu cầu, đầu mỗi tháng | Chỉ chạy khi bảng công của tháng trước đã chốt (BR-43, YCTD-29) |
| CB-03 | Kiểm tra công nợ quá hạn và gửi nhắc nợ | Hằng ngày | Theo mốc cấu hình của đơn vị |
| CB-04 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — |
| CB-05 | Nhắc giáo viên chưa ghi nhật ký | Hằng ngày | Theo giờ cấu hình `journal_reminder_time` của đơn vị; chạy cùng tiến trình gửi thông báo của máy chủ API, mỗi lớp một lần mỗi ngày (YCTD-71) |
| CB-06 | Tổng hợp số liệu bảng điều khiển | Hằng giờ | Lưu sẵn số liệu tổng hợp để đọc nhanh |
| CB-07 | Gửi thông báo và gửi lại thông báo thất bại | Mỗi chu kỳ `NOTIFICATION_DISPATCH_INTERVAL_SECONDS` (mặc định 60 giây); thử lại sau mười lăm phút | Tối đa 5 lần thử; tối đa 5 tin nhắn mỗi người nhận mỗi ngày (KT-09, YCTD-71) |
| CB-08 | Sao lưu dữ liệu | Hằng ngày | Kèm kiểm tra phục hồi định kỳ hằng tháng |
| CB-09 | Khóa tài khoản hết hiệu lực | Hằng ngày | Khóa tài khoản kiểm toán viên quá ngày hết hiệu lực (BM-68) và tài khoản không dùng quá số ngày cấu hình (PQ-07) |
| CB-10 | Mở năm học mới | Theo yêu cầu | Tạo cơ sở dữ liệu năm học, chuyển dữ liệu dùng chung, chuyển cơ sở dữ liệu năm cũ sang chỉ đọc (QĐ-15) |
| CB-11 | Máy xếp thời khoá biểu | Theo yêu cầu | Tiến trình chạy nền `apps/worker` lấy việc từ hàng đợi Redis, chạy có giới hạn thời gian, ghi tiến độ và kết quả vào Redis; máy chủ API lưu phương án vào cơ sở dữ liệu năm học, định kỳ đọc lần xếp chưa xong; lần xếp không được nhận sau 10 phút thì ghi lỗi (YCTD-164) |

## 10. Giám sát

1. Theo dõi thời gian phản hồi của các điểm cuối quan trọng: điểm danh, tính học phí, thu học phí, bảng điều khiển.
2. Cảnh báo khi tác vụ chạy nền thất bại hoặc chạy quá thời gian cấu hình.
3. Cảnh báo khi hàng đợi gửi thông báo tồn đọng vượt ngưỡng.
4. Theo dõi tỷ lệ lỗi xác thực và số lần đăng nhập sai bất thường.
5. Bảng theo dõi tình trạng hệ thống dành cho quản trị nền tảng.

6. Hồ sơ "Vận hành" trên VPS (YCTD-198): Prometheus, node-exporter, postgres-exporter, blackbox, Loki, Promtail, Grafana, Alertmanager chạy trên chính VPS, không gửi số liệu ra ngoài; cảnh báo qua email, Telegram hoặc webhook (Zalo); chi tiết ở `deploy/profiles/production/``README.md` mục 8.

## 11. Sao lưu và phục hồi

| Mã | Nội dung |
|---|---|
| SL-01 | Sao lưu toàn bộ hằng ngày, giữ tối thiểu ba mươi ngày; gồm cơ sở dữ liệu định danh, cơ sở dữ liệu hệ thống, cơ sở dữ liệu năm học đang dùng và kho tệp; cơ sở dữ liệu năm học đã đóng sao lưu một lần khi đóng và giữ lâu dài |
| SL-02 | Sao lưu tăng dần mỗi giờ với dữ liệu tài chính |
| SL-03 | Kiểm tra phục hồi định kỳ hằng tháng trên môi trường tách biệt, có ghi biên bản |
| SL-04 | Khôi phục hoạt động trong 4 giờ kể từ khi sự cố, mất tối đa dữ liệu của 1 giờ gần nhất |
| SL-05 | Bản sao lưu phải được mã hóa và không đặt cùng nơi với máy chủ chính |

## 12. Triển khai

| Môi trường | Mục đích | Dữ liệu |
|---|---|---|
| Phát triển | Lập trình và thử nhanh | Dữ liệu mẫu |
| Thử nghiệm | Kiểm thử chức năng, kiểm thử nghiệm thu | Dữ liệu mẫu gần với thật |
| Chạy thật | Vận hành | Dữ liệu thật |

Ba môi trường tách biệt về cơ sở dữ liệu, kho tệp và cấu hình kênh thông báo. Không dùng dữ liệu thật trên môi trường phát triển và thử nghiệm.

Thứ tự dựng (YCTD-32): môi trường phát triển chạy Docker trên máy cục bộ từ đợt DT-00; tích hợp liên tục trên GitHub Actions chỉ chạy kiểm thử; môi trường thử nghiệm và chạy thật dựng trên máy chủ đám mây trong nước khi triển khai (việc T6).

Hồ sơ "Vận hành" (b) cho nhiều trường trên VPS trong nước (DT-SaaS S7a, YCTD-198, `deploy/profiles/production/`): cùng ảnh container với bản một máy; một tệp Compose cho ba cách đặt máy (T1 một VPS; T2 máy ứng dụng và máy cơ sở dữ liệu; T3 hai máy ứng dụng, máy chính và bản sao); PgBouncer trước PostgreSQL (gom theo giao dịch, riêng `school_system` theo phiên); Caddy bắt mọi tên miền với chứng chỉ theo yêu cầu, chỉ cấp cho tên miền có trong danh sách; hai bản `api`, `identity` và triển khai không gián đoạn (migrate trước, khởi động lại lần lượt); môi trường thử cùng Compose, tên dự án khác, chỉ dữ liệu giả.

## 12A. Nhiều trường trên một nền tảng (DT-SaaS phần S1a, YCTD-191)

Có `PLATFORM_DATABASE_URL` thì dịch vụ định danh và máy chủ API chạy nhiều trường; không có thì chế độ một trường như trước. Luồng một yêu cầu: tên miền → bảng `school_domains` của cơ sở dữ liệu nền tảng (đệm có hạn) → ngữ cảnh trường (mã, trạng thái, tiền tố khóa, khóa dữ liệu trẻ) đặt vào `AsyncLocalStorage` → `Databases` (máy chủ API), `Infrastructure` (dịch vụ định danh), `cacheKey`, `storageKey` đọc ngữ cảnh → mã phiên phải mang cùng `tid`. Nhóm kết nối có giới hạn mỗi cơ sở dữ liệu của trường (`TENANT_POOL_MAX`) và tổng số trường mở cùng lúc (`TENANT_POOL_SCHOOLS`), tự đóng khi không dùng. Bố cục cơ sở dữ liệu cấu hình bằng `TENANT_DB_LAYOUT`: `database` (hồ sơ vận hành) hoặc `schema` (hồ sơ thử nghiệm), mô tả kết nối nằm ở `school_databases` nên mã nghiệp vụ không biết bố cục. Quy tắc ở BR-200 đến BR-202, bảo mật ở BM-73 đến BM-75, bảng ở `16_CO_SO_DU_LIEU.md` mục 18A.

## 12B. Việc nền và công khai nhiều trường (DT-SaaS phần S1b, YCTD-192)

`JobScheduler` (máy chủ API) giữ danh sách việc do các lớp việc nền đăng ký lúc khởi động. Mỗi lượt (bộ đếm giờ trong tiến trình hoặc điểm tick) duyệt các trường đang phục vụ qua `TenancyRuntime.forEachServingSchool`, với từng trường chiếm việc đến hạn ở `scheduler_state` bằng `insert ... on conflict do update ... where last_run_at <= now() - chu kỳ` rồi chạy trong ngữ cảnh trường và ghi kết quả. Ngữ cảnh trường dùng `TenantRegistry.contextOf` (đệm có hạn, gộp lượt nạp đồng thời) nên yêu cầu nội bộ giữa máy chủ API và dịch vụ định danh không đọc cơ sở dữ liệu nền tảng mỗi lần. Hàng đợi Redis của máy xếp thời khóa biểu giữ một khóa chung; phần tử `<tiền tố>|<mã lần xếp>` cho tiến trình `apps/worker` (không có ngữ cảnh trường) tính đúng khóa của trường. Quy tắc ở BR-203 đến BR-205, bảng `scheduler_state` ở `16_CO_SO_DU_LIEU.md` mục 18A.
## 12C. Khởi tạo và vòng đời trường (DT-SaaS phần S2, YCTD-193)

Thư viện `database/src/school-lifecycle.ts` dùng chung cho dịch vụ định danh (điểm cuối của cổng nền tảng), lệnh `platform` và kiểm thử. Khởi tạo gồm hai pha: `startProvisioning` kiểm tra bước setup, ghi trường ở trạng thái `provisioning`, khóa dữ liệu trẻ, hồ sơ đồng ý và một việc ở `provisioning_jobs`; `runProvisioningJob` chạy lần lượt mười một bước (`database:identity`, `migrate:identity`, `database:system`, `migrate:system`, `database:year`, `migrate:year`, `seed:system`, `seed:year`, `admin`, `domain`, `activate`), ghi bước đã xong vào `completed_steps`; mỗi bước kiểm tra việc đã làm nên gọi lại sau lỗi thì chạy tiếp; `rollbackProvisioningJob` xóa sạch. Tạo cơ sở dữ liệu đi qua `SchoolDatabaseLayout` nên chạy được ở cả hai bố cục. Tên miền riêng đi qua bộ nối `DomainProvider` chọn bằng `DOMAIN_PROVIDER`: `dns-check` (hồ sơ vận hành; tra CNAME về `PLATFORM_INGRESS_HOST` và TXT `_school-verify.<tên miền>`, Caddy cấp chứng chỉ theo yêu cầu), `cloudflare-saas`, `vercel-domains` (S9). Xóa vĩnh viễn gọi móc xóa tệp do lệnh của máy chủ API truyền vào: `FileStorage.deletePrefix(tenantStoragePrefix())` chạy trong ngữ cảnh của trường, tiền tố lấy từ `resource-names.ts` như `storageKey`; khóa Redis của trường đều có hạn sống tối đa 2 giờ nên tự hết, không xóa. Cấu hình vòng đời đọc một lần ở tệp cấu hình của từng dịch vụ hoặc lệnh (`lifecycleSettingsFrom`), không đọc biến môi trường rải rác, đúng kiểm tĩnh của S1a. Migrate cuốn chiếu (`migrateSchools`) chạy trường canary trước, ghi từng cơ sở dữ liệu vào `school_migrations`, bỏ qua năm học chỉ đọc, dừng khi lỗi. Biến môi trường: `PLATFORM_ROOT_DOMAIN`, `PLATFORM_INGRESS_HOST`, `DOMAIN_PROVIDER`, `SCHOOL_DELETION_GRACE_DAYS`. Quy tắc ở BR-206 đến BR-208, bảo mật ở BM-77, BM-78.

## 12D. Hồ sơ triển khai thử nghiệm (DT-SaaS phần S9, YCTD-203)

Hồ sơ `deploy/profiles/trial/` chạy cùng mã nguồn với hồ sơ vận hành, khác ở biến cấu hình của nền tảng. Cổng biên Cloudflare Worker (`cloudflare/src/worker.mjs`) nhận mọi tên miền: `/quan-ly`, `/giao-vien`, `/phu-huynh` là ba ứng dụng tĩnh dựng với `APP_BASE_PATH`; cổng nền tảng phục vụ `apps/platform`; tên miền hệ thống phục vụ trang chọn trường; `/api/v1` và website chuyển về máy chủ với tiêu đề `x-school-host` và `x-edge-auth` (`TENANT_HOST_SOURCE=header:x-school-host`); máy chủ ngủ thì trả trang đang khởi động; `scheduled()` gọi `tick`. Máy chủ là một container gộp (`container/Dockerfile.all-in-one`): `router.mjs` chia tuyến như Caddy (nhóm định danh sang `identity`, còn lại sang `api`), chạy migrate nền tảng khi khởi động, không `worker`, không Redis (`REDIS_URL=memory://`). `DB_HOST_ADAPTER` (`plain`, `neon`, `supabase`) quyết định địa chỉ qua bộ gom kết nối ghi vào `school_databases` (cột `login_name` cho Supabase); bộ gom chế độ theo giao dịch chạy được vì `search_path`, múi giờ đặt ở mức vai trò và migrate khóa bằng `pg_advisory_xact_lock`. Tên miền riêng qua `cloudflare-saas` hoặc `vercel-domains`. `platform relayout` chuyển một trường sang nền tảng và bố cục khác (hồ sơ vận hành), so số dòng và tổng kiểm từng bảng. Quy tắc ở BR-209, BR-210, bảo mật ở BM-79, BM-80.

Bảng khóa của PostgreSQL (`max_locks_per_transaction`, mặc định 64; Supabase đổi được bằng `supabase postgres-config update`, Neon chưa có tài liệu cho đổi): mã không dựa vào mức này, chạy tệp thay đổi cấu trúc mỗi tệp một giao dịch (`database/src/migrate.ts`), gỡ lược đồ theo lô 40 bảng mỗi giao dịch (`dropSchemaInBatches`), nạp khôi phục mỗi bảng một giao dịch; hồ sơ vận hành và CI đặt 256 (DT-SaaS phần S4, sửa lỗi "out of shared memory" ở bố cục `schema`).

## 12E. Sao lưu, khôi phục và chuyển cụm theo trường (DT-SaaS phần S7b, YCTD-199)

Ba lớp sao lưu ở hồ sơ vận hành (`deploy/profiles/production/PITR.md`): (1) sao lưu logic theo từng trường bằng `platform backup-school` (hằng ngày phạm vi `all`, hằng giờ phạm vi `active`, gọi từ `deploy/scripts/backup.sh` khi có `PLATFORM_DATABASE_URL`, đẩy thư mục `schools/` ra kho ngoài); (2) `pg_dump` cả máy như YCTD-92; (3) khôi phục về một thời điểm của cả cụm bằng WAL-G (bản cơ bản hằng ngày, nhật ký giao dịch đẩy liên tục, `archive_timeout` 60 giây, `compose.pitr.yml`, ảnh `docker/postgres-walg`); lấy riêng một trường về thời điểm T bằng `scripts/pitr-extract-school.sh` (dựng bản khôi phục tạm trong mạng riêng rồi `backup-school` đọc ở máy chủ tạm qua `BACKUP_SOURCE_HOST`). Ở hồ sơ thử nghiệm lớp (1) là lớp chính, chạy từ GitHub Actions và đẩy lên R2 (Neon Free chỉ giữ lịch sử 6 giờ, Supabase Free không có sao lưu tự động).

`database/src/school-data-copy.ts` là bộ đọc và nạp dùng chung cho sao lưu, khôi phục, diễn tập, chuyển cụm và `platform relayout` (S9): đọc mỗi cơ sở dữ liệu trong một giao dịch `REPEATABLE READ` chỉ đọc, mọi cột ở dạng văn bản của PostgreSQL, múi giờ UTC; nạp bằng vai trò của trường (chủ các bảng, không cần quyền siêu người dùng): gỡ khóa ngoại, mỗi bảng một giao dịch (tắt trigger người dùng nếu bảng có, xóa dữ liệu cũ, chèn theo trang, đặt lại bộ đếm tự tăng), cuối cùng gắn lại khóa ngoại có kiểm; lỗi thì gắn lại không kiểm (`NOT VALID`), đích không phục vụ nên chạy lại là nạp lại. Tổng kiểm mỗi bảng là số dòng và md5 của các dòng dạng văn bản đã sắp. `school-backup.ts` ghi tệp `.sbak` (dòng JSON nén gzip, mã hóa AES-256-GCM, khóa dẫn bằng scrypt từ `BACKUP_ENCRYPTION_PASSPHRASE`; gồm thông tin trường, khóa dữ liệu trẻ, tên miền, từng bảng và tổng kiểm). `school-cluster-move.ts` chuyển trường sang cụm khác. Mọi lần chạy ghi `backup_runs` ở cơ sở dữ liệu nền tảng; cổng nền tảng hiện 20 lần gần nhất ở chi tiết trường, bảng điều khiển S4 dùng để cảnh báo.

Mục tiêu (giả định, đo bằng diễn tập rồi chốt): RPO ≤ 5 phút khi có WAL-G, ≤ 1 giờ khi chỉ có sao lưu theo trường hằng giờ, ≤ 24 giờ ở hồ sơ thử nghiệm (≤ 6 giờ nếu dùng lịch sử của Neon); RTO ≤ 4 giờ ở T2, T3, ≤ 8 giờ ở T1, ≤ 2 giờ cho một trường ở hồ sơ thử nghiệm; sẵn sàng 99,5% ở T1, 99,9% ở T3. Quy tắc ở BR-217, BR-218, bảo mật ở BM-83.

Bảng khóa của PostgreSQL (`max_locks_per_transaction`, mặc định 64; Supabase đổi được bằng `supabase postgres-config update`, Neon chưa có tài liệu cho đổi): mã không dựa vào mức này, chạy tệp thay đổi cấu trúc mỗi tệp một giao dịch (`database/src/migrate.ts`), gỡ lược đồ theo lô 40 bảng mỗi giao dịch (`dropSchemaInBatches`), nạp khôi phục mỗi bảng một giao dịch; hồ sơ vận hành và CI đặt 256 (DT-SaaS phần S4, sửa lỗi "out of shared memory" ở bố cục `schema`).

## 13. Quyết định kiến trúc

| Mã | Quyết định | Trạng thái |
|---|---|---|
| QĐ-01 | Dùng một máy chủ ứng dụng cho cả ba kênh, không tách dịch vụ theo kênh | Đã chốt ngày 2026-10-09; cùng nội dung với QĐ-07 |
| QĐ-02 | Chọn phương án A ở mục 3 cho mô hình nhiều đơn vị | Đã chốt ngày 2026-10-09; điều chỉnh bởi QĐ-15 |
| QĐ-03 | Dùng hàng đợi cho mọi tác vụ dài thay vì chạy đồng bộ trong yêu cầu | Đã chốt ngày 2026-10-09 |
| QĐ-04 | Ứng dụng phụ huynh và giáo viên làm dạng web chạy trên trình duyệt điện thoại ở giai đoạn 1; bản cài riêng để giai đoạn 3 | Đã chốt ngày 2026-10-09 |
| QĐ-05 | Không dùng cơ chế sự kiện ở mức cơ sở dữ liệu cho nghiệp vụ; mọi nghiệp vụ đi qua tầng ứng dụng | Đã chốt ngày 2026-10-09 |
| QĐ-06 | Tách hoàn toàn tầng giao diện và tầng máy chủ; giao diện chỉ gọi giao diện lập trình ứng dụng, không truy cập cơ sở dữ liệu | Đã chốt theo yêu cầu ngày 2026-10-09 |
| QĐ-07 | Xây dựng một máy chủ API nghiệp vụ độc lập duy nhất, chia mô đun bên trong, không tách thành nhiều dịch vụ theo miền nghiệp vụ | Đã chốt theo yêu cầu ngày 2026-10-09 |
| QĐ-08 | Xây dựng dịch vụ định danh độc lập tự viết, không dùng sản phẩm định danh bên ngoài và không dùng dịch vụ đám mây cho xác thực | Đã chốt theo yêu cầu ngày 2026-10-09 |
| QĐ-09 | Đơn vị tổ chức ba cấp Trường chính, Phân hiệu, Điểm trường; cả ba cấp đều có thể có lớp; một trẻ gắn với đúng một đơn vị ở cấp thấp nhất nơi trẻ học | Thay bằng QĐ-14 ngày 2026-10-09 |
| QĐ-10 | Ban Giám hiệu tách thành hai vai trò Hiệu trưởng và Phó Hiệu trưởng kèm hạn mức phê duyệt | Đã chốt theo yêu cầu ngày 2026-10-09 |
| QĐ-11 | Bộ công nghệ TypeScript, NestJS, React kèm Vite, PostgreSQL, Redis, Docker theo `13_CONG_NGHE_SU_DUNG.md` mục 2 | Đã chốt ngày 2026-10-09 |
| QĐ-12 | Hạ tầng thuê máy chủ đám mây của nhà cung cấp trong nước; dữ liệu lưu tại Việt Nam | Đã chốt ngày 2026-10-09 |
| QĐ-13 | Mã nguồn quản lý bằng Git trên GitHub, kho riêng; tích hợp và triển khai tự động dựng ngay từ đợt DT-00 | Đã chốt ngày 2026-10-09 |
| QĐ-14 | Đơn vị tổ chức là cây không giới hạn cấp; nhãn mặc định Trường chính, Phân hiệu, Điểm trường; đơn vị ở cấp nào cũng có thể có lớp; trẻ gắn với đơn vị của lớp trẻ đang học | Thay bằng QĐ-23 ngày 2026-10-09 |
| QĐ-15 | Mỗi năm học một cơ sở dữ liệu nghiệp vụ; trong mỗi cơ sở dữ liệu vẫn tách đơn vị bằng `org_unit_id` theo phương án A; dịch vụ định danh dùng một cơ sở dữ liệu riêng không theo năm học | Đã chốt ngày 2026-10-09 |
| QĐ-16 | Mở API chỉ đọc cho đối tác ngay giai đoạn 1, xác thực bằng khóa riêng có phạm vi dữ liệu | Đã chốt ngày 2026-10-09 |
| QĐ-17 | Bảng không theo năm học: khóa API đối tác đặt ở cơ sở dữ liệu định danh; danh sách cơ sở dữ liệu năm học đặt ở một cơ sở dữ liệu hệ thống riêng của máy chủ API; khi mở năm học giữ nguyên mã định danh của bản ghi chuyển sang | Đã chốt ngày 2026-10-09 |
| QĐ-18 | Truy cập dữ liệu và chạy tệp thay đổi cấu trúc dùng Kysely trên PostgreSQL (YCTD-33) | Đã chốt ngày 2026-10-09 |
| QĐ-19 | Nhánh `main` được bảo vệ; mỗi việc làm trên một nhánh riêng, gộp vào `main` qua yêu cầu gộp khi kiểm thử đạt và Eric duyệt (YCTD-33) | Đã chốt ngày 2026-10-09 |
| QĐ-20 | Máy chủ API hỏi dịch vụ định danh vai trò và quyền hiện hành ở mọi yêu cầu, không lưu bộ nhớ đệm, để thu hồi quyền có hiệu lực ngay (PQ-04, YCTD-34) | Đã chốt ngày 2026-10-09 |
| QĐ-21 | Tài khoản kết nối của máy chủ API có quyền tạo cơ sở dữ liệu để mở năm học; không có quyền quản trị toàn hệ thống (YCTD-34) | Đã chốt ngày 2026-10-09 |
| QĐ-22 | Mã phiên ký bằng khóa bất đối xứng Ed25519; dịch vụ định danh giữ khóa bí mật, máy chủ API chỉ giữ khóa công khai (YCTD-34) | Đã chốt ngày 2026-10-09 |
| QĐ-23 | Đơn vị tổ chức là cây hai cấp: cấp 1 là Trường chính, chỉ một đơn vị; cấp 2 là Phân hiệu hoặc Điểm trường, chọn loại cho từng đơn vị, trực thuộc thẳng Trường chính; nhãn cố định; cả hai cấp có lớp; trẻ gắn với đơn vị của lớp trẻ đang học (YCTD-38) | Đã chốt ngày 2026-10-09 |
| QĐ-24 | Nền đa cấp học (DT-19, YCTD-151 đến YCTD-156): bốn mã cấp cố định; cấp của trường ở `school_levels` (cơ sở dữ liệu hệ thống), đọc qua `SchoolLevelResolver`; cấp là thuộc tính của khối, lớp, đơn vị, chương trình, lịch, biểu phí; tham số cấp dùng chung `school_level`; một năm học một cơ sở dữ liệu cho cả trường, không tách theo cấp; chuyển dữ liệu bằng tệp vá chạy lặp được và lệnh kiểm đối chiếu chỉ đọc | Đã chốt ngày 2026-10-23 theo `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10, 10.10 |
| QĐ-25 | Nền đa thuê bao (DT-SaaS phần S1a, YCTD-191): mô hình A, mỗi trường một bộ cơ sở dữ liệu và một vai trò PostgreSQL, thêm cơ sở dữ liệu nền tảng `platform`; ngữ cảnh trường đặt bằng `AsyncLocalStorage` ở đầu yêu cầu nên `Databases`, `cacheKey`, `storageKey` giữ chữ ký; đóng chặt khi thiếu ngữ cảnh; mã phiên mang `tid`, cặp khóa ký dùng chung; chế độ một trường là mặc định và bản đang chạy thành trường số 1 không chuyển dữ liệu; bố cục `schema` (mỗi lược đồ một vai trò, `search_path` mức vai trò) cho hồ sơ thử nghiệm; chi tiết ở `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 14 | Đã chốt, làm ở S1a |
| QĐ-26 | Việc nền nhiều trường (DT-SaaS phần S1b, YCTD-192): bộ lập lịch trong máy chủ API chiếm việc đến hạn ở bảng `scheduler_state` của cơ sở dữ liệu nền tảng thay vì đếm số lần gọi, nên chạy được cả khi có nhiều bản máy chủ lẫn khi máy chủ ngủ và được gọi bằng điểm tick; việc khởi động của tiến trình (đăng ký biểu EMIS) là loại `perProcess` không chiếm qua cơ sở dữ liệu; hàng đợi máy xếp giữ một khóa chung, phần tử mang tiền tố trường; thêm bộ đệm ngữ cảnh trường `contextOf` có gộp lượt nạp đồng thời để mỗi yêu cầu nội bộ không đọc cơ sở dữ liệu nền tảng | Đã chốt, làm ở S1b |
| QĐ-27 | Khởi tạo và vòng đời trường (DT-SaaS phần S2, YCTD-193): khởi tạo là việc có bước lưu ở cơ sở dữ liệu nền tảng, chạy lặp được, chạy tiếp hoặc hoàn tác; điểm cuối quản lý trường ở dịch vụ định danh dưới `/api/v1/auth/platform/schools` (không thêm dịch vụ); tên miền riêng qua bộ nối `DomainProvider`; quản trị viên đầu tiên kích hoạt bằng đường liên kết một lần, không gửi mật khẩu; xóa có thời gian chờ, giữ hàng của trường ở trạng thái đã xóa kèm bản ghi chứng minh; xuất và xóa tệp chạy ở máy chủ API vì kho tệp nằm ở đó | Đã chốt, làm ở S2 |
| QĐ-28 | Hồ sơ thử nghiệm (DT-SaaS phần S9, YCTD-203): một ảnh gộp `identity` + `api` sau cổng biên Cloudflare Worker (hoặc Vercel), bố cục `schema` qua bộ gom kết nối của nhà cung cấp, không Redis, việc định kỳ do Cron gọi `tick`; nhà cung cấp chọn bằng bộ nối cấu hình (`DB_HOST_ADAPTER`, `DOMAIN_PROVIDER`, `S3_*`); chuyển sang hồ sơ vận hành bằng `platform relayout`, không sửa mã | Đã áp dụng |
| QĐ-29 | Cấu hình kết nối ngoài theo trường (DT-SaaS phần S3, YCTD-195): một lớp `SchoolSettings` đọc `integration_secrets` (đệm 15 giây, xóa đệm khi ghi) và các bộ nối `Tenant*` (tin nhắn, Fanpage, Zalo, cổng thanh toán, kho tệp) chọn nguồn theo từng lần dùng: cấu hình của trường, rồi bộ giả lập, rồi (chỉ chế độ một trường) biến môi trường, còn lại tắt; `ZaloTokenStore` nhận cấu hình ban đầu bằng hàm bất đồng bộ; bảng cổng thanh toán có `prepare()` trả bảng của trường; đổi khóa dữ liệu trẻ tự tìm cột `*_encrypted` ở `information_schema` nên bảng thêm sau tự được xử lý | Đã chốt, làm ở S3 |
| QĐ-30 | Sao lưu theo trường (DT-SaaS phần S7b, YCTD-199): sao lưu logic viết bằng Node (không `pg_dump`) để chạy được ở hai bố cục và qua bộ gom của Neon, Supabase; nạp bằng vai trò của trường, mỗi bảng một giao dịch để không vượt giới hạn khóa của máy chủ, khóa ngoại gắn lại sau cùng có kiểm; khôi phục về một thời điểm của cả cụm bằng WAL-G và lấy riêng một trường từ bản khôi phục tạm; chuyển cụm dùng cùng bộ chép, đổi mô tả kết nối trong một giao dịch khi mọi bảng khớp | Đã áp dụng |
| QĐ-31 | Bảo mật mã (DT-SaaS phần S8b, YCTD-201): TOTP tự cài bằng `node:crypto` ở `packages/server/src/totp.ts` (không thêm thư viện); khóa TOTP người dùng trường mã hóa bằng khóa mã hóa của trường nên đi theo công cụ đổi khóa của S3 (mở rộng sang cơ sở dữ liệu định danh); tài khoản vận hành nhận khóa TOTP qua lệnh dòng lệnh thay vì màn hình đăng ký vì tài khoản này do Eric tạo; chính sách theo trường lưu ở `identity_settings` hiện có, không thêm bảng hệ thống 0054; xoay khóa ký hai pha qua `TOKEN_PREVIOUS_PUBLIC_KEY`; tiêu đề bảo mật đặt cả ở ứng dụng lẫn Caddy | Đã chốt, làm ở S8b |
| QĐ-32 | Đăng nhập hỗ trợ của nhân viên nền tảng (DT-SaaS phần S4, YCTD-197): không đăng nhập thay một người dùng thật mà dùng tài khoản hỗ trợ riêng của mỗi trường (`ho-tro-nen-tang`, vai trò Hiệu trưởng, mật khẩu không dùng được), tạo khi dùng lần đầu; cổng nền tảng cấp mã một lần (chỉ lưu mã băm, hạn 5 phút) đổi ở tên miền của trường lấy phiên đăng nhập kênh cổng; mã phiên mang claim `spt` (`read` hoặc `full`); dịch vụ định danh (`AccessTokenGuard`, làm mới phiên, `/auth/me`) và máy chủ API (`SupportSessionInterceptor`, qua `/auth/me`) kiểm phiên hỗ trợ còn hiệu lực ở cơ sở dữ liệu nền tảng ở mỗi yêu cầu nên rút cho phép có hiệu lực ngay; đồng ý lưu ở cơ sở dữ liệu hệ thống của trường, phiên và thao tác ở nền tảng | Đã chốt, làm ở S4 |

## 14. Chưa xác minh được

1. Quy mô: dưới 1 000 trẻ, khoảng 100 người dùng đồng thời (Q-31). Số đơn vị, số nhân sự, số giao dịch mỗi ngày: chưa có thông tin.
2. Đã có câu trả lời: thuê máy chủ đám mây của nhà cung cấp trong nước (Q-74). Người vận hành: chưa có thông tin.
3. Đã có câu trả lời: khôi phục trong 4 giờ, mất tối đa dữ liệu của 1 giờ (Q-75).
4. Đã có câu trả lời: dữ liệu lưu tại Việt Nam (Q-76).
5. Ngân sách hạ tầng hằng tháng. Không có thông tin.
6. Số lượng Phân hiệu và Điểm trường thực tế: chưa có thông tin. Không tách máy chủ theo đơn vị hay theo kênh (Q-78, QĐ-02).

## 15. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-40 | Đã xác nhận ngày 09/10/2026: hệ thống triển khai trên máy chủ đám mây trong nước, có môi trường thử nghiệm tách biệt | Eric |
| GD-41 | Đã xác nhận ngày 09/10/2026: Mọi tác vụ tính toán lớn chạy nền, không chặn giao diện | Eric |
| GD-63 | Đã xác nhận ngày 09/10/2026 (theo QĐ-06): Tầng giao diện và tầng máy chủ triển khai tách biệt, giao tiếp qua giao diện lập trình ứng dụng có phiên bản | Eric |
| GD-64 | Không còn hiệu lực từ ngày 09/10/2026: dịch vụ định danh dùng cơ sở dữ liệu riêng (Q-115, QĐ-15) | Eric |
| Q-74 | Đã trả lời ngày 09/10/2026: thuê máy chủ đám mây của nhà cung cấp trong nước | Eric |
| Q-75 | Đã trả lời ngày 09/10/2026: khôi phục hoạt động trong 4 giờ, mất tối đa dữ liệu của 1 giờ gần nhất | Eric |
| Q-76 | Đã trả lời ngày 09/10/2026: dữ liệu lưu tại Việt Nam | Eric |
| Q-77 | Đã trả lời ngày 09/10/2026: chọn phương án A | Eric |
| Q-78 | Đã trả lời ngày 09/10/2026: không tách máy chủ riêng cho ứng dụng phụ huynh | Eric |
| Q-115 | Đã trả lời ngày 09/10/2026: dịch vụ định danh chạy tiến trình và cơ sở dữ liệu riêng, có thể cùng máy chủ ở giai đoạn 1 | Eric |
| Q-116 | Đã trả lời ngày 09/10/2026: không làm đăng nhập một lần; một tài khoản đăng nhập được vào kênh phù hợp vai trò | Eric |
