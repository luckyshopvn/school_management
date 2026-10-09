# 18. QUY TẮC PHÁT TRIỂN AI

- Mô tả: Các quy tắc AI phải tuân thủ trong dự án này.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Quy tắc bất biến

| Mã | Quy tắc |
|---|---|
| AI-01 | Con người quyết định nghiệp vụ, phạm vi, quyền hạn và nghiệm thu. Trí tuệ nhân tạo thực hiện phân tích, thiết kế kỹ thuật, viết mã nguồn, kiểm thử và tài liệu hóa |
| AI-02 | Không đoán. Gặp yêu cầu không rõ, hai yêu cầu mâu thuẫn, thiếu quy tắc nghiệp vụ thì dừng lại, mô tả vấn đề, nêu thành phần bị ảnh hưởng, đưa phương án và yêu cầu xác nhận |
| AI-03 | Không phá vỡ. Mọi thay đổi phải bảo toàn dữ liệu, giao diện, phân quyền và chức năng đang chạy |
| AI-04 | Không xóa chức năng nếu người dùng không yêu cầu rõ ràng |
| AI-05 | Không tự phát sinh chức năng ngoài phạm vi đã duyệt; chức năng mới phải được đề xuất và chờ phê duyệt |
| AI-06 | Xây nhỏ, kiểm tra, tiếp tục. Không xây toàn bộ hệ thống trong một lần |
| AI-07 | Không đánh dấu hoàn thành khi chưa chạy thử thật và chưa đạt tiêu chí nghiệm thu |

## 2. Quy tắc nghiệp vụ không được vi phạm

| Mã | Quy tắc |
|---|---|
| AI-08 | Không xóa cứng dữ liệu nghiệp vụ; sai thì đảo hoặc điều chỉnh có lưu vết |
| AI-09 | Không sửa hóa đơn học phí, phiếu thu, phiếu chi, bảng lương đã phát hành hoặc đã chốt |
| AI-10 | Không gán cứng mã tài khoản, mức phí, mức miễn giảm, số ngày phép hay bất kỳ tham số nào thuộc về đơn vị; đọc từ dữ liệu cấu hình |
| AI-11 | Mọi truy vấn dữ liệu nghiệp vụ phải kiểm tra phạm vi đơn vị và phạm vi bản ghi |
| AI-12 | Không coi việc ẩn nút trên giao diện là biện pháp phân quyền |
| AI-13 | Dữ liệu sức khỏe trẻ và dữ liệu tài chính là dữ liệu nhạy cảm; mọi truy cập phải theo quy tắc `BR-53`, `BR-73` và `BR-81` |
| AI-14 | Không tự chạy thay đổi cấu trúc dữ liệu trên môi trường chạy thật; mọi thay đổi phải qua tệp thay đổi có số thứ tự và được duyệt |

## 3. Quy tắc viết mã nguồn

| Mã | Quy tắc |
|---|---|
| AI-15 | Tuân thủ quy ước kỹ thuật tại `13_CONG_NGHE_SU_DUNG.md` mục 5 |
| AI-16 | Không viết truy vấn dữ liệu trong tầng giao diện |
| AI-17 | Không đặt logic nghiệp vụ trong bộ điều khiển; logic nghiệp vụ nằm ở tầng nghiệp vụ |
| AI-18 | Mọi hàm xử lý nghiệp vụ phải kiểm tra dữ liệu đầu vào và trả lỗi có mã |
| AI-19 | Không nuốt lỗi im lặng; mọi lỗi phải được ghi nhật ký kèm mã tương quan |
| AI-20 | Không để bí mật trong mã nguồn, kể cả trong tệp cấu hình mẫu |
| AI-21 | Mọi chức năng mới phải kèm kiểm thử tự động tương ứng |
| AI-22 | Không sửa tệp thay đổi cấu trúc dữ liệu đã chạy trên môi trường chạy thật |

## 4. Quy tắc viết tài liệu

| Mã | Quy tắc |
|---|---|
| AI-23 | Tiếng Việt, không viết tắt, không rườm rà, không dùng tiếng Anh trừ thuật ngữ chuyên môn |
| AI-24 | Mọi phát biểu về hiện trạng hệ thống phải trỏ được đường dẫn tệp và số dòng; không trỏ được thì không đưa vào tài liệu |
| AI-25 | Mọi tài liệu phân tích phải có mục "Chưa xác minh được" ghi rõ điều chưa kiểm chứng và đã tìm ở đâu |
| AI-26 | Điều gì chưa rõ phải thành giả định `GD-xx` hoặc câu hỏi mở `Q-xx`, không được bịa |
| AI-27 | Cập nhật tài liệu cùng lượt với việc thay đổi mã nguồn, không để tài liệu đi sau mã nguồn |
| AI-28 | Ghi nhật ký dự án ngay sau khi hoàn thành việc có giá trị lâu dài |

## 5. Quy tắc phạm vi và thay đổi

| Mã | Quy tắc |
|---|---|
| AI-29 | Mọi thay đổi ngoài phạm vi đã duyệt phải qua quy trình quản lý thay đổi: lý do, nội dung, thành phần bị ảnh hưởng, dữ liệu bị ảnh hưởng, giao diện bị ảnh hưởng, quyền bị ảnh hưởng, kiểm thử cần làm |
| AI-30 | Khi phát hiện thiết kế xung đột với nghiệp vụ thật hoặc với tài liệu khác, phải nói ra ngay, không làm theo cho xong |
| AI-31 | Khi có nhiều phương án, phải trình bày ưu điểm và nhược điểm của từng phương án, không tự chọn thay người quyết định |
| AI-32 | Trước khi triển khai, phải xác nhận phạm vi với người yêu cầu |
| AI-33 | Đơn vị tổ chức là cây không giới hạn cấp; không viết mã giả định số cấp cố định |
| AI-34 | Tầng giao diện không truy cập cơ sở dữ liệu và không chứa quy tắc nghiệp vụ; mọi thao tác dữ liệu đi qua máy chủ API nghiệp vụ |
| AI-35 | Không lưu mật khẩu và không tự xác thực mật khẩu ở máy chủ API nghiệp vụ; việc đó thuộc dịch vụ định danh |
| AI-36 | Phê duyệt theo hạn mức phải kiểm tra ở máy chủ; không tin giá trị hạn mức hay cấp phê duyệt do giao diện gửi lên |
| AI-37 | Không tách máy chủ API nghiệp vụ thành nhiều dịch vụ theo miền khi chưa được phê duyệt; giữ một máy chủ, chia mô đun bên trong |
| AI-38 | Bám kế hoạch tổng thể tại `01_KE_HOACH_TONG_THE.md`; không mở một đợt xây dựng khi cổng kiểm soát của giai đoạn trước chưa đạt |
| AI-39 | Không đổi thứ tự đợt, không bỏ qua cổng kiểm soát và không gộp nhiều đợt làm một khi chưa được Eric phê duyệt |
| AI-40 | Trước mọi thay đổi mã nguồn, kể cả sửa lỗi nhỏ, AI trình thiết kế và chờ Eric xác nhận; AI không tự commit hay đẩy mã lên kho |
| AI-41 | Mã nguồn không được giả định chỉ có một cơ sở dữ liệu: có cơ sở dữ liệu định danh, cơ sở dữ liệu hệ thống và mỗi năm học một cơ sở dữ liệu; thay đổi cấu trúc dữ liệu theo QU-11; khi mở năm học phải giữ nguyên mã định danh của bản ghi chuyển sang (QĐ-15, QĐ-17) |
| AI-42 | Mọi quyết định kiến trúc đã chốt tại `12_KIEN_TRUC_HE_THONG.md` mục 13 là ràng buộc; quyết định đã bị thay thế thì theo quyết định thay thế |

## 6. Quy tắc tự kiểm trước khi báo hoàn thành

Trước khi báo một việc đã xong, phải tự kiểm đủ mười một điều kiện:

1. Đúng yêu cầu.
2. Đúng nghiệp vụ.
3. Đúng giao diện.
4. Đúng phân quyền.
5. Đúng dữ liệu.
6. Đã xử lý lỗi.
7. Đã kiểm thử.
8. Không phá vỡ chức năng cũ.
9. Đạt tiêu chí nghiệm thu.
10. Đã rà soát.
11. Đã cập nhật tài liệu.

Thiếu bất kỳ điều kiện nào thì trạng thái phải là Đang thực hiện, Cần sửa hoặc Bị chặn, không được là Hoàn thành.

## 7. Chưa xác minh được

Không áp dụng. Tài liệu này là quy tắc làm việc, không mô tả hiện trạng hệ thống.

## 8. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-52 | Đã xác nhận ngày 09/10/2026: Bộ quy tắc này áp dụng cho mọi công việc trên dự án, kể cả sửa nhỏ | Eric |
| GD-81 | Đã xác nhận ngày 09/10/2026 (theo QĐ-06 đến QĐ-10): Bốn quyết định kiến trúc QĐ-06 đến QĐ-10 là ràng buộc, mọi mã nguồn viết sau phải tuân theo. Mở rộng thành AI-42: mọi quyết định đã chốt, QĐ-09 đã được QĐ-14 thay thế | Eric |
| Q-97 | Đã trả lời ngày 09/10/2026: siết chặt quy tắc cho AI, xem AI-40 | Eric |
| Q-98 | Đã trả lời ngày 09/10/2026: có, siết chặt: AI phải được Eric xác nhận trước mọi thay đổi mã nguồn và không tự commit (AI-40) | Eric |
