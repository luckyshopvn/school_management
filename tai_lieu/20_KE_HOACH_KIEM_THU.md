# 20. KẾ HOẠCH KIỂM THỬ

- Mô tả: Phạm vi kiểm thử, các lớp kiểm thử, môi trường kiểm thử, dữ liệu kiểm thử, tiêu chí đạt.
- Phiên bản: 1.2
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Mục tiêu kiểm thử

1. Xác nhận mỗi chức năng làm đúng nghiệp vụ đã đặc tả.
2. Xác nhận phân quyền đúng ở cả ba lớp: vai trò, đơn vị, bản ghi.
3. Xác nhận dữ liệu tài chính khớp giữa các phân hệ: điểm danh, học phí, phiếu thu, công nợ, quỹ.
4. Xác nhận dữ liệu cũ không bị ảnh hưởng khi thêm chức năng mới.
5. Xác nhận hệ thống chịu được tải đỉnh vào giờ điểm danh sáng và giờ chốt học phí cuối tháng.

## 2. Phạm vi kiểm thử

| Mã | Phạm vi | Giai đoạn áp dụng |
|---|---|---|
| PV-01 | Nền tảng, đơn vị, tài khoản, vai trò, quyền; đăng nhập, cấp và thu hồi phiên, mã một lần (Q-126) | Giai đoạn 1 |
| PV-02 | Trẻ, phụ huynh, lớp học, phân lớp | Giai đoạn 1 |
| PV-03 | Điểm danh, báo vắng, đón trả trẻ, nhật ký | Giai đoạn 1 |
| PV-04 | Học phí, khoản thu, giảm trừ, công nợ | Giai đoạn 1 |
| PV-05 | Phiếu thu, thanh toán chuyển khoản mã QR, phiếu chi, quỹ tiền mặt, ngân hàng, công nợ phải trả | Giai đoạn 1 và 2 |
| PV-06 | Nhân sự, hợp đồng, chấm công, nghỉ phép, lương | Giai đoạn 1 |
| PV-07 | Giảng dạy, y tế, bếp, kho | Giai đoạn 2 |
| PV-08 | Hoạt động, nội dung, tương tác, công việc và đánh giá, đồ bị mất, tuyển sinh, tuyển dụng | Giai đoạn 2 và 3 |
| PV-09 | Báo cáo và bảng điều khiển | Giai đoạn 1 và 2 |
| PV-10 | Cây đơn vị nhiều cấp và phạm vi dữ liệu theo cấp | Giai đoạn 1 |
| PV-11 | Phân cấp phê duyệt theo hạn mức | Giai đoạn 1 |
| PV-12 | Ranh giới giao diện và máy chủ, dịch vụ định danh độc lập | Giai đoạn 1 |
| PV-13 | API chỉ đọc cho đối tác: cấp và thu hồi khóa, giới hạn phạm vi, nhật ký đọc dữ liệu cá nhân (QĐ-16) | Giai đoạn 1 |
| PV-14 | Cơ sở dữ liệu định danh, cơ sở dữ liệu hệ thống, cơ sở dữ liệu theo năm học; mở năm học giữ nguyên mã định danh (QĐ-15, QĐ-17) | Giai đoạn 1 |
| PV-15 | Nhập dữ liệu ban đầu từ Excel, nhập mã định danh của Bộ Giáo dục và Đào tạo | Giai đoạn 1 |

## 3. Các lớp kiểm thử

| Mã | Lớp | Phạm vi | Công cụ |
|---|---|---|---|
| LT-01 | Kiểm thử đơn vị | Hàm tính học phí, tính lương, tính công nợ, kiểm tra quyền, hàm kiểm tra dữ liệu | Bộ kiểm thử của Node |
| LT-02 | Kiểm thử tích hợp | Điểm cuối giao diện lập trình kèm cơ sở dữ liệu thật trên môi trường thử nghiệm, đủ cơ sở dữ liệu định danh, hệ thống và ít nhất hai năm học | Bộ kiểm thử của Node kèm cơ sở dữ liệu thử nghiệm |
| LT-03 | Kiểm thử giao diện | Luồng thao tác chính trên ba kênh | Playwright |
| LT-04 | Kiểm thử phân quyền | Gọi trực tiếp điểm cuối bằng tài khoản sai quyền và sai đơn vị | Bộ kiểm thử tích hợp |
| LT-05 | Kiểm thử dữ liệu | Đối chiếu số liệu giữa các phân hệ bằng câu truy vấn đối chiếu | Câu lệnh kiểm tra tự động |
| LT-06 | Kiểm thử hiệu năng | Tải đỉnh theo kịch bản ở mục 7 | Công cụ đo tải |
| LT-07 | Kiểm thử hồi quy | Chạy lại toàn bộ ca kiểm thử sau mỗi lần phát hành | Bộ kiểm thử tự động |
| LT-08 | Kiểm thử khả năng phục hồi | Khôi phục mọi cơ sở dữ liệu từ bản sao lưu trên môi trường tách biệt (SL-01) | Thủ công có biên bản |

## 4. Môi trường kiểm thử

| Môi trường | Dữ liệu | Người dùng |
|---|---|---|
| Phát triển | Dữ liệu mẫu nhỏ, sinh tự động | Lập trình viên |
| Thử nghiệm | Dữ liệu mẫu gần với thật: sáu đơn vị theo GD-79, ba mươi lớp, năm trăm trẻ, một trăm nhân sự | Nhóm kiểm thử và người nghiệm thu |
| Thiết bị thật | Dữ liệu của môi trường thử nghiệm, chạy trên điện thoại Android và iPhone phổ biến (Q-103) | Nhóm kiểm thử |

Không dùng dữ liệu thật của trẻ trên môi trường thử nghiệm.

## 5. Dữ liệu kiểm thử

| Mã | Bộ dữ liệu | Nội dung |
|---|---|---|
| DL-01 | Danh mục nền | Một Trường chính, hai Phân hiệu, ba Điểm trường, có lớp ở mọi cấp (GD-79); hai năm học; mười hai phòng ban, hai mươi chức danh |
| DL-02 | Trẻ và phụ huynh | Năm trăm trẻ, bảy trăm phụ huynh, có trường hợp nhiều con và trẻ con nhân viên |
| DL-03 | Lớp và phân lớp | Ba mươi lớp, có lớp đủ sĩ số và lớp còn chỗ |
| DL-04 | Điểm danh | Ba tháng điểm danh có đủ trường hợp: đi đủ, nghỉ có báo, nghỉ không báo, đi muộn, ngày học bù thứ 7 toàn trường (BR-84) |
| DL-05 | Học phí | Ba kỳ học phí có đủ loại giảm trừ, trường hợp nhập học giữa tháng, trừ tiền suất ăn ngày vắng (BR-58) và hóa đơn bổ sung cùng kỳ (BR-85) |
| DL-06 | Thu chi | Hai trăm phiếu thu, một trăm phiếu chi, có trường hợp vượt hạn mức, thanh toán chuyển khoản mã QR và phiếu chi hoàn tiền khi trẻ thôi học (BR-24) |
| DL-07 | Nhân sự và lương | Ba kỳ lương trả trước có đủ trường hợp: nghỉ không lương, vắng không phép, làm thêm, nhân sự vào làm giữa tháng, nhân sự nghỉ việc giữa tháng có quyết toán, hợp đồng hết hạn (YCTD-29) |
| DL-08 | Y tế | Yêu cầu dặn thuốc đủ thông tin, thiếu thông tin, thiếu ảnh thuốc, bỏ liều, sự kiện y tế đã và chưa xác nhận; đơn vị bật và tắt cấu hình không có nhân viên y tế; nhật ký chăm sóc hằng ngày |
| DL-09 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — |
| DL-10 | Tương tác | Bình chọn, biểu quyết, khảo sát đã và chưa hết thời gian |
| DL-11 | Một năm học đầy đủ | Mô phỏng từ mở năm học đến mở năm học kế tiếp: điểm danh, học phí, thu chi, lương từng tháng; kiểm tra giữ nguyên mã định danh khi chuyển năm (Q-104) |
| DL-12 | Khóa API đối tác | Khóa còn hiệu lực, khóa đã thu hồi, khóa gọi ngoài phạm vi được cấp |
| DL-13 | Tệp nhập | Tệp Excel dữ liệu ban đầu đúng mẫu và sai mẫu; tệp mã định danh của Bộ có dòng khớp và không khớp số định danh cá nhân |

## 6. Tiêu chí đạt

| Mã | Tiêu chí |
|---|---|
| TCĐ-01 | Không còn lỗi nghiêm trọng và lỗi cao chưa xử lý |
| TCĐ-02 | Mọi tiêu chí nghiệm thu bắt buộc đều đạt |
| TCĐ-03 | Mọi ca kiểm thử phân quyền đều đạt, không có trường hợp truy cập chéo đơn vị hoặc chéo bản ghi |
| TCĐ-04 | Số liệu tài chính đối chiếu khớp giữa điểm danh, học phí, phiếu thu và công nợ |
| TCĐ-05 | Không có lỗi hồi quy trên chức năng đã nghiệm thu trước đó |
| TCĐ-06 | Thời gian phản hồi các màn hình chính đạt ngưỡng đã đặt trong kịch bản hiệu năng |
| TCĐ-07 | Mọi lỗi còn lại đã được phân loại theo mức nghiêm trọng và có quyết định xử lý rõ ràng |

## 7. Kịch bản hiệu năng

| Mã | Kịch bản | Ngưỡng |
|---|---|---|
| HN-01 | Một trăm giáo viên điểm danh cùng lúc trong ba mươi phút đầu buổi sáng | Thời gian phản hồi dưới hai giây, không lỗi |
| HN-02 | Kế toán chạy tính học phí cho năm trăm trẻ của một đơn vị | Hoàn thành dưới năm phút, không chặn giao diện |
| HN-03 | Ba trăm phụ huynh mở ứng dụng trong khung giờ buổi tối | Thời gian phản hồi dưới hai giây |
| HN-04 | Một nghìn phiếu thu được tạo trong một ngày | Không lỗi, số phiếu không trùng |
| HN-05 | Tính lương cho một trăm nhân sự của một đơn vị | Hoàn thành dưới hai phút |

Ngưỡng ở mục này đã được Eric chấp nhận ngày 09/10/2026 (Q-102).

## 8. Phân loại mức nghiêm trọng của lỗi

| Mức | Định nghĩa | Xử lý |
|---|---|---|
| Nghiêm trọng | Sai số liệu tài chính, rò dữ liệu giữa các đơn vị, lộ dữ liệu cá nhân ngoài phạm vi khóa API đối tác, mất dữ liệu, không đăng nhập được | Phải sửa trước khi phát hành |
| Cao | Chức năng chính không dùng được, không có đường vòng | Phải sửa trước khi phát hành |
| Trung bình | Chức năng dùng được nhưng sai sót ở trường hợp ít gặp | Sửa trong phiên bản gần nhất |
| Thấp | Lỗi hiển thị, lỗi chữ, không ảnh hưởng nghiệp vụ | Sửa theo lô |

## 9. Lịch kiểm thử theo giai đoạn

| Giai đoạn | Việc kiểm thử | Đầu ra |
|---|---|---|
| Trước khi viết mã | Rà soát đặc tả và tiêu chí nghiệm thu | Danh sách điểm chưa rõ |
| Trong khi viết mã | Kiểm thử đơn vị và kiểm thử tích hợp theo từng nhiệm vụ | Kết quả kiểm thử từng nhiệm vụ |
| Trước khi nghiệm thu phân hệ | Kiểm thử giao diện, phân quyền, dữ liệu, hồi quy | Báo cáo kiểm thử phân hệ |
| Trước khi phát hành | Kiểm thử hiệu năng, kiểm thử khả năng phục hồi, kiểm thử chấp nhận | Báo cáo nghiệm thu |

Kiểm thử chấp nhận do Eric, Hiệu trưởng và kế toán trưởng thực hiện; kế toán trưởng nghiệm thu P05, P06, P08 (Q-101).

## 10. Chưa xác minh được

Không còn mục chưa xác minh. Bốn mục trước đây đã được trả lời tại Q-101 đến Q-104.

## 11. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-54 | Đã xác nhận ngày 09/10/2026 (theo Q-102): Ngưỡng hiệu năng ở mục 7 là đề xuất của nhóm thiết kế | Eric |
| GD-55 | Đã xác nhận ngày 09/10/2026: Bộ dữ liệu kiểm thử ở mục 5 dùng chung cho cả ba giai đoạn | Eric |
| GD-79 | Đã xác nhận ngày 09/10/2026: Bộ dữ liệu kiểm thử phải có ít nhất một Trường chính, hai Phân hiệu và ba Điểm trường, có lớp ở mọi cấp | Eric |
| Q-101 | Đã trả lời ngày 09/10/2026: Eric, Hiệu trưởng và kế toán trưởng tham gia kiểm thử chấp nhận; kế toán trưởng nghiệm thu P05, P06, P08 | Eric |
| Q-102 | Đã trả lời ngày 09/10/2026: chấp nhận ngưỡng ở mục 7 | Eric |
| Q-103 | Đã trả lời ngày 09/10/2026: kiểm thử trên điện thoại Android và iPhone thật phổ biến | Eric |
| Q-104 | Đã trả lời ngày 09/10/2026: có bộ dữ liệu mô phỏng một năm học đầy đủ | Eric |
| Q-126 | Đã trả lời ngày 09/10/2026: có ca kiểm thử riêng cho đăng nhập, cấp và thu hồi phiên, mã một lần | Eric |
