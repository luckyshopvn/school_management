# 13. CÔNG NGHỆ SỬ DỤNG

- Mô tả: Ngôn ngữ lập trình, khuôn khổ, cơ sở dữ liệu, thư viện, công cụ xây dựng, công cụ kiểm thử, môi trường triển khai.
- Phiên bản: 1.4
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Nguyên tắc chọn công nghệ

1. Chọn công nghệ đã phổ biến và có nhiều người biết, để tuyển và bàn giao được.
2. Phần lõi nghiệp vụ tự viết, phần phổ thông dùng thư viện có sẵn.
3. Ưu tiên một ngôn ngữ cho cả máy chủ và giao diện để giảm chi phí chuyển đổi.
4. Không đưa công nghệ mới chưa được kiểm chứng vào phần tài chính và phần dữ liệu trẻ.
5. Bộ công nghệ ở mục 2 đã được Eric chốt ngày 09/10/2026 (QĐ-11).

## 2. Công nghệ đã chốt

| Lớp | Công nghệ | Lý do |
|---|---|---|
| Ngôn ngữ | TypeScript | Một ngôn ngữ cho cả máy chủ và giao diện, kiểm tra kiểu tĩnh giúp giảm lỗi ở phần tài chính |
| Dịch vụ định danh | NestJS kèm thư viện băm mật khẩu và thư viện ký mã phiên | Dịch vụ tự viết, tách riêng; chỉ làm xác thực, cấp phiên, quản lý tài khoản, vai trò và phạm vi đơn vị |
| Máy chủ API nghiệp vụ | NestJS | Cấu trúc mô đun rõ, phù hợp hệ thống nhiều phân hệ, có sẵn cơ chế kiểm tra dữ liệu và phân quyền. Một máy chủ duy nhất, chia mô đun bên trong |
| Giao diện | React kèm Vite | Phổ biến, hệ sinh thái lớn, tách được gói theo vai trò |
| Kiểu dáng giao diện | Tailwind | Dựng nhanh, thống nhất theo hệ thống thiết kế |
| Quản lý trạng thái và dữ liệu phía giao diện | TanStack Query kèm bộ định tuyến TanStack | Bộ nhớ đệm truy vấn, tải lại theo sự kiện, phù hợp màn hình dạng danh sách |
| Cơ sở dữ liệu | PostgreSQL | Ràng buộc mạnh, hỗ trợ chính sách bảo vệ ở mức bản ghi, phù hợp mô hình nhiều đơn vị |
| Truy cập dữ liệu | Truy vấn có tham số kèm tầng ánh xạ mỏng Kysely, dùng cả để chạy tệp thay đổi cấu trúc (QĐ-18) | Kiểm soát được câu truy vấn ở các báo cáo nặng, không bị che khuất bởi tầng trừu tượng |
| Hàng đợi và bộ nhớ đệm | Redis | Chạy tác vụ nền, giới hạn tần suất, bộ nhớ đệm số liệu tổng hợp |
| Xác thực | Mã phiên ngắn hạn kèm mã làm mới do dịch vụ định danh phát hành | Phổ biến, thu hồi được, không phụ thuộc nhà cung cấp |
| Lưu trữ tệp | Kho lưu trữ tệp tương thích giao diện S3 | Chuẩn phổ biến, đổi nhà cung cấp dễ |
| Kiểm thử | Bộ kiểm thử của Node kèm Playwright | Kiểm thử đơn vị, kiểm thử tích hợp và kiểm thử giao diện |
| Đóng gói và triển khai | Docker kèm quy trình tích hợp và triển khai tự động | Ba môi trường tách biệt, triển khai lặp lại được; trước khi có hạ tầng, GitHub Actions chỉ chạy kiểm thử (YCTD-32) |
| Giám sát | Bảng theo dõi lỗi và số liệu vận hành | Phát hiện lỗi sớm, đo thời gian phản hồi |

Ranh giới giao diện và máy chủ:

1. Giao diện và máy chủ là hai sản phẩm triển khai riêng, giao tiếp qua giao diện lập trình ứng dụng có phiên bản.
2. Giao diện không chứa quy tắc nghiệp vụ, không tính toán số tiền, không quyết định quyền.
3. Gói mã dùng chung chỉ chứa kiểu dữ liệu và hằng số, không chứa truy vấn cơ sở dữ liệu.
4. Giao diện không giữ thông tin đăng nhập cơ sở dữ liệu, không giữ khóa bí mật của dịch vụ ngoài.

## 3. Phương án thay thế đã cân nhắc

| Hạng mục | Phương án đề xuất | Phương án thay thế | Đánh giá |
|---|---|---|---|
| Máy chủ ứng dụng | NestJS | Express thuần | Express nhẹ hơn nhưng thiếu cấu trúc cho hệ thống nhiều phân hệ, dễ phân tán khi nhóm đông |
| Cơ sở dữ liệu | PostgreSQL | MySQL | PostgreSQL hỗ trợ chính sách bảo vệ mức bản ghi và kiểu dữ liệu phong phú hơn, phù hợp hơn cho tách dữ liệu theo đơn vị |
| Truy cập dữ liệu | Truy vấn có tham số | Bộ ánh xạ thực thể đầy đủ | Bộ ánh xạ thực thể thuận tiện khi viết nhanh nhưng khó kiểm soát ở báo cáo nặng và khó kiểm tra phạm vi đơn vị |
| Ứng dụng phụ huynh | Web chạy trên trình duyệt điện thoại | Ứng dụng cài riêng | Ứng dụng cài riêng cho trải nghiệm tốt hơn và thông báo đẩy tin cậy hơn, nhưng chi phí phát triển và phát hành cao hơn; để giai đoạn sau |
| Kênh thông báo | Thông báo trong ứng dụng kèm tin nhắn | Chỉ thông báo trong ứng dụng | Chỉ thông báo trong ứng dụng không đủ với phụ huynh ít mở ứng dụng |
| Dịch vụ định danh | Tự viết bằng NestJS | Dùng sản phẩm định danh có sẵn, ví dụ Keycloak | Sản phẩm có sẵn đầy đủ tính năng nhưng thêm một hệ thống phải vận hành và phải đồng bộ vai trò sang hệ thống; tự viết giữ được mô hình vai trò và phạm vi đơn vị thống nhất, đổi lại phải tự chịu trách nhiệm về bảo mật xác thực. Đã chốt tự viết ngày 2026-10-09 |
| Cách tách dịch vụ máy chủ | Một máy chủ API nghiệp vụ duy nhất, chia mô đun bên trong | Tách nhiều dịch vụ theo miền nghiệp vụ | Tách theo miền phù hợp nhóm lớn nhưng tăng chi phí vận hành, độ phức tạp gọi liên dịch vụ và giao dịch phân tán; quy mô một trường không cần. Đã chốt một máy chủ ngày 2026-10-09 |

## 4. Cấu trúc mã nguồn dự kiến

```
School_Management/
├── apps/
│   ├── api/            # Máy chủ API nghiệp vụ
│   ├── identity/       # Dịch vụ định danh
│   ├── portal/         # Cổng quản trị
│   ├── teacher/        # Ứng dụng giáo viên
│   ├── parent/         # Ứng dụng phụ huynh
│   └── worker/         # Tiến trình chạy nền
├── packages/
│   ├── shared/         # Kiểu dữ liệu, hằng số dùng chung
│   ├── ui/             # Thành phần giao diện dùng chung
│   ├── server/         # Mã dùng chung của hai dịch vụ máy chủ: mô hình lỗi, kiểm tra mã phiên (YCTD-36)
│   └── config/         # Cấu hình dùng chung
├── database/
│   ├── identity/       # Thay đổi cấu trúc và dữ liệu khởi tạo của cơ sở dữ liệu định danh
│   ├── system/         # Thay đổi cấu trúc của cơ sở dữ liệu hệ thống (QĐ-17)
│   └── school-year/    # Thay đổi cấu trúc và dữ liệu khởi tạo của cơ sở dữ liệu năm học
├── tai_lieu/           # Bộ tài liệu thiết kế
└── tests/              # Kiểm thử tích hợp và kiểm thử giao diện
```

Quản lý gói theo không gian làm việc, một kho mã nguồn cho toàn bộ sản phẩm. Ba ứng dụng giao diện (`portal`, `teacher`, `parent`) và hai dịch vụ máy chủ (`api`, `identity`) là các gói triển khai độc lập; gói `shared` không được chứa mã truy cập cơ sở dữ liệu; gói `server` chỉ dùng cho `api` và `identity`, giao diện không được dùng (YCTD-36).

## 5. Quy ước kỹ thuật

| Mã | Quy ước |
|---|---|
| QU-01 | Mọi thay đổi cấu trúc dữ liệu viết thành tệp thay đổi có số thứ tự, chạy được nhiều lần mà không gây lỗi |
| QU-02 | Không sửa tệp thay đổi đã chạy trên môi trường chạy thật, chỉ thêm tệp mới |
| QU-03 | Mọi điểm cuối phải kiểm tra quyền ở máy chủ, không tin dữ liệu do giao diện gửi lên |
| QU-04 | Mọi thao tác thay đổi dữ liệu phải ghi nhật ký thao tác |
| QU-05 | Không đặt bí mật trong mã nguồn; dùng biến môi trường và kho bí mật |
| QU-06 | Mã nguồn phải qua kiểm tra kiểu và kiểm tra quy tắc viết mã trước khi gộp vào nhánh chính |
| QU-07 | Tên bảng, tên cột và tên điểm cuối dùng tiếng Anh; nội dung hiển thị dùng tiếng Việt |
| QU-08 | Mọi chức năng mới phải kèm kiểm thử tự động trước khi được coi là xong |
| QU-09 | Giao diện không truy cập cơ sở dữ liệu và không chứa quy tắc nghiệp vụ; mọi thao tác dữ liệu đi qua máy chủ API nghiệp vụ |
| QU-10 | Dịch vụ định danh là nơi duy nhất xử lý mật khẩu và cấp phiên; máy chủ API nghiệp vụ không lưu mật khẩu |
| QU-11 | Thay đổi cấu trúc dữ liệu năm học chạy trên cơ sở dữ liệu năm học đang dùng; cơ sở dữ liệu năm đã đóng giữ nguyên cấu trúc và ghi số phiên bản cấu trúc; báo cáo nhiều năm đọc theo số phiên bản đó để đọc được cấu trúc cũ (QĐ-15, RR-13) |

## 6. Chưa xác minh được

1. Đã có câu trả lời: nhóm phát triển vận hành hệ thống; nhà trường quản trị tài khoản và cấu hình (Q-80).
2. Ngân sách cho hạ tầng và dịch vụ ngoài. Không có thông tin.
3. Đã có câu trả lời: thanh toán bằng chuyển khoản mã QR chuẩn VietQR; dịch vụ xác nhận chuyển khoản và nhà cung cấp tin nhắn cấu hình được (Q-81, Q-142). Nhà cung cấp cụ thể chưa chọn (T1, T5).
4. Đã có câu trả lời: Android 9 hoặc iOS 14 trở lên; Chrome, Safari, Edge hai phiên bản gần nhất (Q-82).
5. Đã có câu trả lời: dữ liệu lưu tại Việt Nam (Q-76).
6. Đã xử lý: dịch vụ định danh tự sinh mã một lần cho phụ huynh, gửi qua kết nối tin nhắn dùng chung của TP-10 (XT-09); xác thực hai lớp đã bỏ (YCTD-31).

## 7. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-42 | Đã xác nhận ngày 09/10/2026: bộ công nghệ ở mục 2 được chốt | Eric |
| GD-43 | Đã xác nhận ngày 09/10/2026: Hệ thống dùng một kho mã nguồn cho tất cả các kênh và dịch vụ | Eric |
| GD-65 | Đã xác nhận ngày 09/10/2026 (theo QĐ-08): Dịch vụ định danh tự viết, không dùng sản phẩm định danh bên ngoài | Eric |
| GD-66 | Đã xác nhận ngày 09/10/2026 (theo QĐ-07): Một máy chủ API nghiệp vụ duy nhất, chia mô đun bên trong | Eric |
| Q-79 | Đã trả lời ngày 09/10/2026: dùng bộ công nghệ đề xuất ở mục 2 | Eric |
| Q-80 | Đã trả lời ngày 09/10/2026: nhóm phát triển vận hành hệ thống; nhà trường quản trị tài khoản và cấu hình | Eric |
| Q-81 | Đã trả lời ngày 09/10/2026: thanh toán dùng chuyển khoản mã QR chuẩn VietQR có xác nhận tự động; nhà cung cấp tin nhắn và dịch vụ xác nhận chuyển khoản cụ thể xem Q-142 | Eric |
| Q-142 | Đã trả lời ngày 09/10/2026: cho cấu hình cả dịch vụ trung gian và ngân hàng trực tiếp để xác nhận chuyển khoản; nhà cung cấp tin nhắn cũng cấu hình được | Eric |
| Q-82 | Đã trả lời ngày 09/10/2026: điện thoại Android 9 hoặc iOS 14 trở lên; trình duyệt Chrome, Safari, Edge hai phiên bản gần nhất | Eric |
| Q-117 | Đã trả lời ngày 09/10/2026: có, phụ huynh đăng nhập được bằng mã một lần qua tin nhắn bên cạnh mật khẩu | Eric |
