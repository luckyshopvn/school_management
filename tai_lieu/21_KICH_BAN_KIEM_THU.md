# 21. KỊCH BẢN KIỂM THỬ

- Mô tả: Danh sách ca kiểm thử theo chức năng, dữ liệu đầu vào, kết quả mong đợi, kết quả thực tế.
- Phiên bản: 1.9
- Ngày cập nhật: 2026-10-09
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-09

## 1. Quy ước

1. Ca kiểm thử đánh mã `CT-nnn`, đánh số tăng dần, không tái sử dụng mã đã cấp.
2. Cột "Kết quả thực tế" và "Trạng thái" chỉ được điền khi đã chạy thử thật. Trạng thái dùng ba giá trị: Chưa chạy, Đạt, Không đạt.
3. Mọi ca kiểm thử tham chiếu tới tiêu chí nghiệm thu tương ứng trong `11_TIEU_CHI_NGHIEM_THU.md`.
4. Ca kiểm thử về quyền bắt buộc phải gọi thẳng điểm cuối, không thao tác qua giao diện.
5. Bộ ca kiểm thử chi tiết theo việc N21 nằm ở thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`, mã `CTC-...`.

## 2. Nền tảng và phân quyền

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-001 | Truy vấn trẻ theo phạm vi đơn vị | Tài khoản quản lý đơn vị A | Chỉ trả về trẻ của đơn vị A | | Chưa chạy |
| CT-002 | Gọi điểm cuối cập nhật hồ sơ trẻ | Tài khoản kế toán đơn vị A | Trả lỗi không có quyền | | Chưa chạy |
| CT-003 | Gọi điểm cuối điểm danh lớp không phụ trách | Tài khoản giáo viên lớp khác | Trả lỗi không có quyền | | Chưa chạy |
| CT-004 | Xem dữ liệu nghiệp vụ bằng quản trị nền tảng | Tài khoản quản trị nền tảng | Không trả về dữ liệu nghiệp vụ nào | | Chưa chạy |
| CT-005 | Hiệu lực thu hồi quyền | Thu hồi vai trò rồi gửi yêu cầu kế tiếp | Yêu cầu bị từ chối ngay, không chờ hết phiên | | Chưa chạy |
| CT-006 | Đăng nhập sai quá số lần cấu hình | Sai mật khẩu năm lần | Tài khoản tạm khóa, thông báo liên hệ nhà trường | | Chưa chạy |
| CT-007 | Đăng nhập lần đầu của phụ huynh | Mật khẩu mặc định chung | Bắt buộc đổi mật khẩu trước khi dùng | | Chưa chạy |

## 3. Trẻ, phụ huynh và lớp học

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-008 | Tạo hồ sơ trẻ thiếu ngày sinh | Hồ sơ thiếu ngày sinh | Từ chối và chỉ rõ trường thiếu | | Chưa chạy |
| CT-009 | Số định danh cá nhân trùng | Hồ sơ mới có số định danh trùng | Từ chối, chỉ ra hồ sơ trùng | | Chưa chạy |
| CT-010 | Chuyển lớp cho trẻ | Trẻ đang học lớp Mầm 1 sang Mầm 2 | Sĩ số hai lớp đổi, lịch sử lớp ghi thêm dòng mới | | Chưa chạy |
| CT-011 | Phân lớp vượt sĩ số | Lớp đã đủ hai mươi lăm trẻ | Cảnh báo và yêu cầu xác nhận quản lý đơn vị | | Chưa chạy |
| CT-012 | Chuyển đơn vị khi còn công nợ | Trẻ còn công nợ ba triệu đồng | Chặn, yêu cầu tất toán trước | | Chưa chạy |
| CT-013 | Phụ huynh xem danh sách trẻ | Tài khoản phụ huynh của trẻ A | Chỉ thấy trẻ A | | Chưa chạy |
| CT-014 | Phụ huynh gọi điểm cuối hồ sơ trẻ khác | Tài khoản phụ huynh của trẻ A, gọi hồ sơ trẻ B | Trả lỗi không có quyền | | Chưa chạy |

## 4. Điểm danh và chăm sóc

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-015 | Lưu điểm danh hai lần | Bấm lưu hai lần liên tiếp | Chỉ một bản ghi cho mỗi trẻ trong ngày | | Chưa chạy |
| CT-016 | Sửa điểm danh đã chốt | Sửa trạng thái của một trẻ | Yêu cầu lý do và ghi nhật ký kèm giá trị trước sau | | Chưa chạy |
| CT-017 | Báo vắng trước giờ học | Phụ huynh báo vắng lúc sáu giờ ba mươi | Trẻ ở trạng thái nghỉ có báo | | Chưa chạy |
| CT-018 | Báo vắng sau khi đã điểm danh | Phụ huynh báo vắng lúc mười giờ | Ghi nhận và đánh dấu báo muộn | | Chưa chạy |
| CT-019 | Phụ huynh xem nhật ký của con | Tài khoản phụ huynh của trẻ A | Chỉ thấy nhật ký của trẻ A | | Chưa chạy |
| CT-020 | Ghi nhật ký cho trẻ ngoài lớp | Giáo viên lớp Mầm 1 ghi cho trẻ lớp Mầm 2 | Từ chối | | Chưa chạy |
| CT-021 | Bàn giao trẻ cho người không ủy quyền | Người nhận không có trong danh sách | Chặn bàn giao, yêu cầu xác nhận của phụ huynh | | Chưa chạy |
| CT-022 | Nhập bù điểm danh sau khi mất mạng | Ghi tạm trên thiết bị rồi đồng bộ | Bản ghi có đánh dấu nhập bù, không trùng | | Chưa chạy |

## 5. Học phí, khoản thu và giảm trừ

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-023 | Tính học phí có ba dịch vụ | Trẻ đăng ký bán trú, STEM, Anh văn | Khoản phải thu có đúng ba khoản dịch vụ cộng học phí chính khóa | | Chưa chạy |
| CT-024 | Tính tiền ăn theo ngày ăn thực tế | Trẻ có mười tám ngày ăn thực tế, nghỉ có báo hai ngày, nghỉ không báo một ngày | Tiền ăn bằng đơn giá nhân mười tám | | Chưa chạy |
| CT-025 | Giảm trừ trẻ con nhân sự | Trẻ có cờ con nhân sự | Áp dụng mức giảm trừ và ghi người phê duyệt | | Chưa chạy |
| CT-026 | Sửa hóa đơn đã phát hành | Sửa số tiền trực tiếp | Chặn, yêu cầu lập phiếu điều chỉnh | | Chưa chạy |
| CT-027 | Tính học phí trẻ nhập học giữa tháng | Trẻ nhập học ngày mười lăm | Tính theo tỷ lệ ngày học thực tế | | Chưa chạy |
| CT-028 | Chạy tính học phí hai lần | Chạy lại cùng kỳ và cùng đơn vị | Không sinh khoản phải thu trùng | | Chưa chạy |
| CT-029 | Thiếu biểu phí cho một khối lớp | Khối lớp chưa có biểu phí hiệu lực | Chặn phát hành, chỉ rõ khối lớp thiếu | | Chưa chạy |
| CT-030 | Giảm trừ vượt khoản phải thu | Tổng giảm trừ lớn hơn tổng phải thu | Chặn lưu, yêu cầu điều chỉnh | | Chưa chạy |
| CT-031 | Đăng ký dịch vụ sau ngày chốt | Phụ huynh đăng ký dịch vụ không bắt buộc sau ngày chốt | Chờ Ban Giám hiệu duyệt; khi duyệt sinh hóa đơn bổ sung cùng kỳ, không sửa hóa đơn đã phát hành (BR-26, BR-85) | | Chưa chạy |
| CT-032 | Phụ huynh xem học phí của con | Tài khoản phụ huynh của trẻ A | Chỉ thấy khoản phải thu của trẻ A | | Chưa chạy |

## 6. Thu chi, quỹ và công nợ

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-033 | Cấp số phiếu thu | Hai phiếu thu trong cùng đơn vị và năm | Số phiếu khác nhau, không trùng | | Chưa chạy |
| CT-034 | Phân bổ vượt số tiền thu | Thu một triệu, phân bổ một triệu hai trăm nghìn | Từ chối, nêu tổng phân bổ vượt | | Chưa chạy |
| CT-035 | Tính số dư công nợ sau khi thu | Hai hóa đơn một triệu và hai triệu, thu đủ hóa đơn một triệu | Hóa đơn đó đã thu đủ, công nợ còn hai triệu | | Chưa chạy |
| CT-036 | Xóa phiếu thu đã phát hành | Bấm xóa | Chặn, yêu cầu lập phiếu đảo | | Chưa chạy |
| CT-037 | Đảo phiếu thu | Lập phiếu đảo có lý do | Phiếu gốc còn nguyên, công nợ tăng trở lại | | Chưa chạy |
| CT-038 | Phiếu chi từ hạn mức trở lên | Phiếu chi mười lăm triệu với hạn mức mười triệu | Chuyển Hiệu trưởng phê duyệt | | Chưa chạy |
| CT-039 | Phiếu chi vượt số dư quỹ | Số dư một triệu, chi hai triệu | Từ chối, báo số dư không đủ | | Chưa chạy |
| CT-040 | Phiếu chi thiếu chứng từ | Không đính kèm chứng từ | Chặn phát hành | | Chưa chạy |
| CT-041 | Chốt kỳ tài chính | Chốt kỳ tháng chín | Không sửa được phiếu trong kỳ đã chốt | | Chưa chạy |
| CT-042 | Giáo viên gọi điểm cuối danh sách phiếu chi | Tài khoản giáo viên | Trả lỗi không có quyền | | Chưa chạy |

## 7. Nhân sự, chấm công và lương

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-043 | Cảnh báo hợp đồng sắp hết hạn | Hợp đồng còn mười ngày, cảnh báo mười lăm ngày | Hiển thị cảnh báo trên trang chủ | | Chưa chạy |
| CT-044 | Tính số giờ làm | Giờ vào bảy giờ ba mươi, giờ ra mười bảy giờ | Tính đúng số giờ và trạng thái ngày công | | Chưa chạy |
| CT-045 | Giờ ra nhỏ hơn giờ vào | Giờ vào mười bảy giờ, giờ ra bảy giờ ba mươi | Chặn lưu | | Chưa chạy |
| CT-046 | Chốt công khi còn đơn chờ duyệt | Một đơn nghỉ phép chưa duyệt | Chặn chốt, liệt kê đơn còn chờ | | Chưa chạy |
| CT-047 | Sửa chấm công của kỳ đã chốt | Sửa giờ của kỳ đã chốt | Chặn, yêu cầu mở lại kỳ | | Chưa chạy |
| CT-048 | Bỏ ngày 09/10/2026: nhà trường không cho ứng lương (Q-54) | — | — | | Không áp dụng |
| CT-049 | Tính lương trả trước có đủ thành phần | Bảng công tháng trước đã chốt, có phụ cấp, thưởng, làm thêm giờ, ngày không hưởng lương, khấu trừ | Lương bằng phần trả trước cộng trừ điều chỉnh theo công tháng trước (BR-43) | | Chưa chạy |
| CT-050 | Nhân sự xem phiếu lương của người khác | Tài khoản giáo viên A gọi phiếu lương giáo viên B | Trả lỗi không có quyền | | Chưa chạy |
| CT-051 | Tính lương khi thiếu hợp đồng | Nhân sự không có hợp đồng hiệu lực trong kỳ | Đưa vào danh sách chờ xử lý, không tính lương | | Chưa chạy |
| CT-052 | Sửa bảng lương đã chốt | Sửa trực tiếp | Chặn, yêu cầu lập bảng điều chỉnh | | Chưa chạy |

## 8. Y tế học đường

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-053 | Gửi yêu cầu dặn thuốc thiếu giờ | Yêu cầu không có giờ cho uống | Từ chối, yêu cầu bổ sung | | Chưa chạy |
| CT-054 | Cho uống thuốc khi chưa nhận thuốc | Phiếu chưa xác nhận nhận thuốc | Chặn ghi nhận liều | | Chưa chạy |
| CT-055 | Ghi trùng một liều | Ghi hai liều cùng thời điểm | Chặn, hiển thị liều đã ghi | | Chưa chạy |
| CT-056 | Bỏ liều không nhập lý do | Bấm bỏ liều | Chặn lưu, yêu cầu lý do | | Chưa chạy |
| CT-057 | Giáo viên không liên quan xem hồ sơ sức khỏe | Tài khoản giáo viên lớp khác | Trả lỗi không có quyền | | Chưa chạy |
| CT-058 | Ghi sự kiện y tế | Trẻ sốt tại trường | Phụ huynh nhận thông báo, bản ghi có người xử lý | | Chưa chạy |

## 9. Xe đưa đón (đã bỏ ngày 09/10/2026)

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-059 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | | Không áp dụng |
| CT-060 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | | Không áp dụng |
| CT-061 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | | Không áp dụng |
| CT-062 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | | Không áp dụng |
| CT-063 | Bỏ ngày 09/10/2026: trường không có xe đưa đón (Q-62) | — | — | | Không áp dụng |

## 10. Bếp, kho và mua hàng

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-064 | Tính số suất ăn | Ba mươi trẻ có mặt, hai trẻ nghỉ | Mỗi bữa sáng, trưa, xế có ba mươi suất; hai trẻ nghỉ không tính tiền ăn ngày đó | | Chưa chạy |
| CT-065 | Phụ huynh xem thực đơn chưa duyệt | Thực đơn ở trạng thái chưa duyệt | Không hiển thị | | Chưa chạy |
| CT-066 | Xuất kho vượt tồn | Tồn mười, xuất mười lăm | Từ chối, báo vượt tồn | | Chưa chạy |
| CT-067 | Đề nghị mua hàng vượt hạn mức | Đề nghị có giá trị từ hạn mức trở lên | Chuyển Hiệu trưởng phê duyệt, ở trạng thái chờ duyệt | | Chưa chạy |
| CT-068 | Kiểm kê có chênh lệch | Số thực tế khác số hệ thống | Biên bản ghi chênh lệch, cần phê duyệt | | Chưa chạy |

## 11. Nội dung, tương tác, tuyển sinh

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-069 | Tạo hoạt động | Giáo viên tạo hoạt động của lớp | Ở trạng thái chờ duyệt, chưa hiển thị cho phụ huynh | | Chưa chạy |
| CT-070 | Phụ huynh xem hoạt động đã duyệt | Hoạt động đã công bố của lớp con | Hiển thị kèm hình ảnh | | Chưa chạy |
| CT-071 | Tải ảnh có trẻ chưa đồng ý | Trẻ chưa có cờ đồng ý hình ảnh | Cảnh báo, không công bố hình của trẻ đó | | Chưa chạy |
| CT-072 | Giáo viên bộ môn duyệt hoạt động | Tài khoản giáo viên bộ môn | Trả lỗi không có quyền | | Chưa chạy |
| CT-073 | Gửi phiếu bình chọn hai lần | Cùng tài khoản gửi hai phiếu | Từ chối phiếu thứ hai | | Chưa chạy |
| CT-074 | Gửi phiếu sau khi hết thời gian | Bình chọn đã kết thúc | Từ chối, báo đã hết thời gian | | Chưa chạy |
| CT-075 | Xử lý bình luận tiêu cực | Quản lý đơn vị xử lý | Bình luận còn nguyên, có bản ghi xử lý | | Chưa chạy |
| CT-076 | Chuyển hồ sơ tuyển sinh đã đạt | Hồ sơ ở trạng thái đạt | Sinh hồ sơ trẻ, gắn phụ huynh, phân lớp | | Chưa chạy |
| CT-077 | Chuyển hồ sơ tuyển sinh chưa đạt | Hồ sơ chưa đạt | Từ chối | | Chưa chạy |

## 12. Báo cáo và đối chiếu số liệu

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-078 | Bảng điều khiển Ban Giám hiệu | Tài khoản Hiệu trưởng | Thấy số liệu của mọi đơn vị ở mọi cấp | | Chưa chạy |
| CT-079 | Bảng điều khiển quản lý đơn vị | Tài khoản quản lý đơn vị A | Chỉ thấy số liệu đơn vị A và các đơn vị cấp dưới trực thuộc | | Chưa chạy |
| CT-080 | Đối chiếu công nợ | Báo cáo công nợ kỳ tháng mười | Tổng công nợ khớp tổng theo từng trẻ | | Chưa chạy |
| CT-081 | Đối chiếu tiền ăn và điểm danh | Số suất ăn của ngày so với điểm danh đã chốt | Khớp nhau | | Chưa chạy |
| CT-082 | Đối chiếu phiếu thu và sổ quỹ | Tổng phiếu thu tiền mặt và phiếu chi tiền mặt trong ngày so với biến động sổ quỹ tiền mặt | Khớp nhau | | Chưa chạy |
| CT-083 | Xuất báo cáo và ghi nhật ký | Kế toán xuất báo cáo thu chi | Tệp được sinh và có bản ghi nhật ký xuất | | Chưa chạy |
| CT-084 | Giáo viên gọi điểm cuối báo cáo thu chi | Tài khoản giáo viên | Trả lỗi không có quyền | | Chưa chạy |
| CT-085 | Báo cáo hợp nhất nhiều đơn vị | Hiệu trưởng chọn hai đơn vị | Chỉ số tách biệt và có dòng tổng | | Chưa chạy |

## 13. Ca kiểm thử đơn vị tổ chức, phân cấp phê duyệt và kiến trúc

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-091 | Tạo Trường chính | Tài khoản Hiệu trưởng | Tạo được đơn vị cấp cao nhất, đơn vị cha trống | | Chưa chạy |
| CT-092 | Đổi đơn vị cha tạo vòng lặp | Đơn vị A là cha của B, đổi cha của A thành B | Trả lỗi tạo vòng lặp | | Chưa chạy |
| CT-093 | Xem cây đơn vị nhiều cấp | Tài khoản Hiệu trưởng | Thấy đủ nhiều cấp, mỗi đơn vị nằm đúng dưới đơn vị cha | | Chưa chạy |
| CT-094 | Xếp trẻ vào lớp thuộc Điểm trường | Trẻ mới và lớp của Điểm trường | Đơn vị của trẻ được ghi là Điểm trường đó | | Chưa chạy |
| CT-095 | Phạm vi cấp trên bao gồm cấp dưới | Tài khoản gán ở Trường chính, truy vấn Điểm trường trực thuộc | Được phép trả dữ liệu | | Chưa chạy |
| CT-096 | Phạm vi cấp dưới không bao gồm cấp trên | Tài khoản gán ở Điểm trường A, truy vấn Phân hiệu chứa A | Trả lỗi không có quyền | | Chưa chạy |
| CT-097 | Phó Hiệu trưởng duyệt dưới hạn mức | Phiếu chi có giá trị dưới hạn mức | Phiếu chi được duyệt | | Chưa chạy |
| CT-098 | Phó Hiệu trưởng duyệt bằng hạn mức | Phiếu chi có giá trị bằng hạn mức | Bị từ chối, yêu cầu chuyển lên Hiệu trưởng | | Chưa chạy |
| CT-099 | Người lập tự phê duyệt chứng từ của mình | Phiếu chi do chính người phê duyệt lập | Bị từ chối | | Chưa chạy |
| CT-100 | Phó Hiệu trưởng duyệt chứng từ ngoài đơn vị được gán | Phiếu chi của đơn vị B | Bị từ chối | | Chưa chạy |
| CT-101 | Kiểm tra mã nguồn gói giao diện | Gói giao diện của ba kênh | Không có thông tin đăng nhập cơ sở dữ liệu, không có truy vấn trực tiếp | | Chưa chạy |
| CT-102 | Máy chủ API kiểm tra mã phiên với dịch vụ định danh | Yêu cầu thay đổi dữ liệu kèm mã phiên hợp lệ | Xử lý thành công sau khi kiểm tra mã phiên | | Chưa chạy |
| CT-103 | Gọi điểm cuối quản lý tài khoản của người khác | Tài khoản giáo viên | Bị từ chối ở dịch vụ định danh | | Chưa chạy |
| CT-104 | Nhật ký từ chối phê duyệt vượt hạn mức | Chứng từ vượt hạn mức bị từ chối | Nhật ký ghi người từ chối, thời điểm và lý do | | Chưa chạy |

## 14. Ca kiểm thử hiệu năng và phục hồi

| Mã | Kịch bản | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|
| CT-086 | Một trăm giáo viên điểm danh đồng thời | Thời gian phản hồi dưới hai giây, không lỗi | | Chưa chạy |
| CT-087 | Tính học phí cho năm trăm trẻ | Hoàn thành dưới năm phút, không chặn giao diện | | Chưa chạy |
| CT-088 | Tạo một nghìn phiếu thu trong ngày | Không lỗi, số phiếu không trùng | | Chưa chạy |
| CT-089 | Khôi phục từ bản sao lưu | Mọi cơ sở dữ liệu khôi phục đầy đủ, có biên bản (SL-01) | | Chưa chạy |
| CT-090 | Gửi lại thông báo thất bại | Hàng đợi gửi lại thành công trong thời gian cấu hình | | Chưa chạy |

## 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-105 | P01-11 | Phòng học của đơn vị A gán cho lớp đơn vị B | Từ chối | | Chưa chạy |
| CT-106 | P01-12 | Ngừng sử dụng bậc học đang gắn với lớp | Lớp cũ giữ nguyên, lớp mới không chọn được | | Chưa chạy |
| CT-107 | P02-11 | Phụ huynh báo mất đồ của con | Phiếu đã báo, giáo viên chủ nhiệm nhận thông báo | | Chưa chạy |
| CT-108 | P02-11 | Phụ huynh trẻ A gọi phiếu đồ bị mất của trẻ B | Trả lỗi không có quyền | | Chưa chạy |
| CT-109 | P02-11 | Xóa phiếu đồ bị mất đã đóng | Chặn xóa | | Chưa chạy |
| CT-110 | P03-08 | Lọc bài học theo lĩnh vực | Chỉ trả bài học thuộc lĩnh vực | | Chưa chạy |
| CT-111 | P06-10 | Phát hành phiếu thu chưa chọn khoản mục | Từ chối | | Chưa chạy |
| CT-112 | P06-10 | Báo cáo thu chi nhóm theo nhóm thu chi | Tổng các nhóm bằng tổng kỳ | | Chưa chạy |
| CT-113 | P08-09 | Chốt bảng công có ngày nghỉ lễ hưởng lương | Ngày đó ghi nghỉ lễ | | Chưa chạy |
| CT-114 | P08-10 | Chốt bảng công có ngày thứ bảy nghỉ định kỳ | Không tính vắng không phép | | Chưa chạy |
| CT-115 | P08-09 | Giáo viên gọi điểm cuối sửa ngày nghỉ lễ | Trả lỗi không có quyền | | Chưa chạy |
| CT-116 | P10-09 | Ghi nhận thuốc đã mua mười hộp | Số lượng thuốc tăng mười | | Chưa chạy |
| CT-117 | P10-10 | Công bố lịch khám lớp Mầm 1 | Phụ huynh lớp Mầm 1 nhận thông báo | | Chưa chạy |
| CT-118 | P10-11 | Lưu kết quả khám có cân nặng dưới ngưỡng | Chỉ số được đánh dấu cần theo dõi | | Chưa chạy |
| CT-119 | P12-09 | Xác nhận nhập phiếu đi chợ | Tồn nguyên liệu tăng, có đề nghị thanh toán | | Chưa chạy |
| CT-120 | P13-10 | Nhập tồn ban đầu cho mặt hàng đã có giao dịch | Từ chối | | Chưa chạy |
| CT-121 | P14-11 | Đăng ký hoạt động ngoại khóa đã đủ chỉ tiêu | Từ chối, báo hết chỗ | | Chưa chạy |
| CT-122 | P14-11 | Đăng ký hoạt động ngoại khóa có phí | Phí vào khoản phải thu như khoản phát sinh | | Chưa chạy |
| CT-123 | P14-12 | Xóa bình luận của phụ huynh trên tin tức | Chặn xóa | | Chưa chạy |
| CT-124 | P16-05 | Mở danh sách tin tuyển sinh của đợt đang mở | Thấy tin kèm thời hạn | | Chưa chạy |
| CT-125 | P17-13 | Giáo viên lớp Mầm 1 mở bảng tin | Chỉ thấy sinh nhật trẻ lớp Mầm 1 | | Chưa chạy |
| CT-126 | P17-14 | Kế toán mở báo cáo học thứ 7 | Có các ngày học bù, số trẻ đi học và vắng của từng ngày | | Chưa chạy |
| CT-127 | P17-15 | Bỏ ngày 09/10/2026: trường không có bữa tối (YCTD-20) | — | | Không áp dụng |
| CT-128 | P17-14 | Giáo viên gọi điểm cuối báo cáo học thứ 7 | Trả lỗi không có quyền | | Chưa chạy |
| CT-129 | P08-10 | Chốt bảng công có ngày thứ bảy học bù, một nhân sự không chấm công | Ngày đó là ngày làm việc, nhân sự bị tính vắng | | Chưa chạy |
| CT-130 | P14-11 | Tính học phí kỳ kế tiếp với đăng ký ngoại khóa thu theo tháng | Phí hoạt động có trong khoản phải thu của kỳ | | Chưa chạy |
| CT-131 | P14-11 | Trẻ đăng ký ngoại khóa thu theo tháng, nghỉ ba buổi, thôi giữa tháng | Phí tháng thu đủ, không có dòng giảm trừ | | Chưa chạy |
| CT-132 | P05-05 | Tính học phí kỳ với học phí chính khóa bằng không | Hóa đơn chỉ có khoản dịch vụ | | Chưa chạy |
| CT-133 | P05-11 | Áp dụng loại miễn giảm mười phần trăm tiền bán trú | Dòng giảm trừ đúng mười phần trăm | | Chưa chạy |
| CT-134 | P08-11 | Cấp phép năm cho giáo viên sáu năm thâm niên | Được mười ba ngày theo quy định cấu hình | | Chưa chạy |
| CT-135 | P08-11 | Tính lương có khấu trừ theo tỷ lệ | Khấu trừ bằng tỷ lệ nhân lương hợp đồng | | Chưa chạy |
| CT-136 | P19-06 | Phụ huynh đăng nhập bằng mã một lần đúng, còn hạn | Đăng nhập thành công | | Chưa chạy |
| CT-137 | P19-06 | Nhập sai mã một lần quá số lần cấu hình | Từ chối, yêu cầu mã mới | | Chưa chạy |
| CT-138 | P05-03 | Đơn vị bật chặn, trẻ nợ quá hạn, phụ huynh đăng ký thêm dịch vụ | Từ chối kèm thông báo công nợ | | Chưa chạy |
| CT-139 | P01-13 | Nhập tệp trẻ có dòng thiếu ngày sinh | Báo dòng lỗi, không ghi dòng nào | | Chưa chạy |
| CT-140 | P01-13 | Nhập tệp công nợ đầu kỳ hợp lệ | Khoản phải thu đầu kỳ đúng, có nhật ký | | Chưa chạy |
| CT-141 | P01-13 | Giáo viên gọi điểm cuối nhập dữ liệu | Trả lỗi không có quyền | | Chưa chạy |
| CT-142 | P06-11 | Chuyển khoản đủ theo mã QR | Phiếu thu tự lập, hóa đơn đã thu đủ | | Chưa chạy |
| CT-143 | P06-11 | Gửi lại thông báo cùng mã giao dịch | Không tạo phiếu thu thứ hai | | Chưa chạy |
| CT-144 | P06-11 | Chuyển khoản sai số tiền | Vào danh sách chờ kế toán xử lý | | Chưa chạy |
| CT-145 | P06-01 | Lập phiếu thu một phần cho hóa đơn | Từ chối | | Chưa chạy |
| CT-146 | P02-09 | Phụ huynh rút đồng ý hình ảnh | Hình của trẻ bị ẩn, có lịch sử đồng ý | | Chưa chạy |
| CT-147 | P02-09 | Phụ huynh trẻ A đổi đồng ý của trẻ B | Trả lỗi không có quyền | | Chưa chạy |
| CT-148 | P02-02 | Kế toán xem số định danh của trẻ | Chỉ thấy số đã che | | Chưa chạy |
| CT-149 | P02-02 | Quản lý đơn vị xem đầy đủ số định danh | Có bản ghi nhật ký truy cập | | Chưa chạy |
| CT-150 | P01-02 | Mở năm học mới | Cơ sở dữ liệu năm mới có dữ liệu chuyển sang, giữ nguyên mã định danh; năm cũ chỉ đọc | | Chưa chạy |
| CT-151 | P01-14 | Khóa phạm vi báo cáo gọi danh sách trẻ | Từ chối | | Chưa chạy |
| CT-152 | P01-14 | Khóa phạm vi danh sách trẻ đọc dữ liệu | Có nhật ký kèm khóa và căn cứ | | Chưa chạy |
| CT-153 | P08-12 | Làm vượt giờ 2 giờ trong ngày | Chỉ tính 1 giờ làm thêm | | Chưa chạy |
| CT-154 | P05-03 | Đăng ký STEM sau ngày chốt | Chờ Ban Giám hiệu duyệt | | Chưa chạy |
| CT-155 | P05-05 | Đăng ký trễ duyệt thu theo ngày thực tế | Phí theo tỷ lệ ngày còn lại | | Chưa chạy |
| CT-156 | P05-03 | Bỏ chọn bán trú | Không cho bỏ | | Chưa chạy |
| CT-157 | P02-02 | Trẻ chưa có mã ngành | Ô mã ngành tô đỏ | | Chưa chạy |
| CT-158 | P02-12 | Nhập tệp mã ngành có dòng không khớp | Báo dòng lỗi | | Chưa chạy |
| CT-159 | P19-06 | Đăng nhập lần đầu bằng mật khẩu mặc định | Chỉ vào màn hình đổi mật khẩu | | Chưa chạy |
| CT-160 | P08-10 | Ban Giám hiệu tạo ngày học bù, giáo viên mở điểm danh ngày đó | Mọi lớp có danh sách điểm danh; ngày đó tính vào số ngày học của tháng | | Chưa chạy |
| CT-161 | P08-10 | Quản lý đơn vị gọi điểm cuối tạo lịch học bù | Trả lỗi không có quyền | | Chưa chạy |
| CT-162 | P10-01 | Kế toán trưởng, nhân sự, giáo viên bộ môn gọi điểm cuối hồ sơ sức khỏe | Trả lỗi không có quyền | | Chưa chạy |
| CT-163 | P06-04 | Phó Hiệu trưởng duyệt phiếu chi hoàn tiền dưới hạn mức | Bị từ chối, chuyển Hiệu trưởng | | Chưa chạy |
| CT-164 | P01-10 | Trình duyệt chứng từ thuộc loại chưa cấu hình hạn mức | Chuyển Hiệu trưởng | | Chưa chạy |
| CT-165 | P19-06 | Kiểm toán viên đăng nhập sau ngày hết hiệu lực | Bị từ chối, tài khoản khóa | | Chưa chạy |
| CT-166 | P05-06 | Phát hành khoản phát sinh sau khi hóa đơn chính đã phát hành | Sinh hóa đơn bổ sung cùng kỳ, hóa đơn chính không đổi | | Chưa chạy |
| CT-167 | P01-14 | Đối tác gọi danh sách trẻ bằng khóa đã thu hồi | Bị từ chối ngay | | Chưa chạy |
| CT-168 | P06-03 | Kế toán lập phiếu đảo, kế toán trưởng gọi điểm cuối duyệt | Bị từ chối; phiếu gốc và công nợ chưa đổi | | Chưa chạy |
| CT-169 | P05-12 | Quản lý đơn vị gọi điểm cuối ghi quyết định xử lý công nợ | Bị từ chối; Phó Hiệu trưởng ghi được, số tiền công nợ không đổi | | Chưa chạy |
| CT-170 | P06-04 | Kế toán lập phiếu đảo phiếu chi, kế toán trưởng gọi điểm cuối duyệt | Bị từ chối; phiếu gốc và số dư quỹ chưa đổi | | Chưa chạy |
| CT-171 | P10-04 | Đơn vị bật không có nhân viên y tế, phụ huynh gửi yêu cầu dặn thuốc | Giáo viên chủ nhiệm nhận, xác nhận và ghi liều được | | Chưa chạy |
| CT-172 | P10-04 | Đơn vị tắt cấu hình, giáo viên chủ nhiệm gọi điểm cuối xác nhận nhận thuốc | Trả lỗi không có quyền | | Chưa chạy |
| CT-173 | P10-03 | Gửi yêu cầu dặn thuốc không có ảnh thuốc; gửi yêu cầu có ảnh thuốc, không có đơn | Lần đầu bị từ chối; lần sau gửi được | | Chưa chạy |
| CT-174 | P10-12 | Giáo viên ghi nhiệt độ trẻ A; phụ huynh trẻ A và trẻ B mở ứng dụng | Phụ huynh trẻ A thấy, phụ huynh trẻ B không thấy | | Chưa chạy |
| CT-175 | P10-07 | Phụ huynh bấm đã biết sự kiện y tế | Y tế thấy đã xác nhận kèm thời điểm; không có lần nhắc lại nào | | Chưa chạy |
| CT-176 | P01-06 | Đặt lại mật khẩu cho giáo viên, giáo viên đăng nhập bằng mật khẩu mới | Chỉ vào được màn hình đổi mật khẩu | | Chưa chạy |
| CT-177 | P01-02 | Mở năm học mới khi năm đang dùng còn trẻ đã thôi học nợ 500 000 (YCTD-37) | Bị chặn, liệt kê trẻ còn nợ | | Chưa chạy |
| CT-178 | P05-05 | Chạy tính học phí khi lớp L-A1 còn hai ngày chưa chốt điểm danh | Bị chặn, liệt kê lớp và ngày | | Chưa chạy |
| CT-179 | P06-02 | Thủ quỹ lập phiếu thu tiền mặt và chọn hóa đơn | Hóa đơn đã thu đủ, quỹ tăng | | Chưa chạy |
| CT-180 | P08-06 | Tính bảng lương tháng 10 khi bảng công tháng 9 chưa chốt | Bị chặn, liệt kê đơn vị chưa chốt | | Chưa chạy |
| CT-181 | P08-06 | Lương hợp đồng 12 000 000, ngày công chuẩn 24, 3 ngày không hưởng lương tháng 9 | Bảng lương tháng 10 trừ 1 500 000 | | Chưa chạy |
| CT-182 | P08-06 | Nhân sự vào làm ngày 15/10 | Tháng 10 không trả trước; tháng 11 có phần tháng 10 theo công | | Chưa chạy |
| CT-183 | P08-06 | Nhân sự nghỉ việc ngày 10/10 đã nhận lương trả trước tháng 10 | Bảng quyết toán ghi khoản phải thu hồi, chờ Ban Giám hiệu duyệt | | Chưa chạy |
| CT-184 | P01-02 | Lưu lịch năm học có học kỳ 1, học kỳ 2, kỳ hè | Tuần được đánh số liên tục; học kỳ chồng nhau bị từ chối | | Chưa chạy |
| CT-185 | P04-01 | Mở điểm danh ngày thuộc tuần nghỉ | Không có bảng điểm danh | | Chưa chạy |
| CT-186 | P04-01 | Mở điểm danh ngày sau học kỳ 2, ngoài kỳ hè | Không có bảng điểm danh | | Chưa chạy |
| CT-187 | P05-13 | Tháng hè có một trẻ đăng ký, một trẻ không | Chỉ trẻ đã đăng ký có điểm danh và hóa đơn | | Chưa chạy |
| CT-188 | P06-01 | Phiếu thu đầu năm học mới | Số phiếu đánh lại từ đầu | | Chưa chạy |

Ca CT-105 đến CT-188 lần lượt kiểm tra AC-149 đến AC-232.

## 16. Chưa xác minh được

1. Kết quả thực tế của mọi ca kiểm thử: chưa chạy ca nào vì chưa có mã nguồn. Đã tìm trong: toàn bộ thư mục dự án.
2. Bộ ca kiểm thử chi tiết theo Q-105 và Q-125 chưa viết, theo dõi ở việc N21. Mục số lượng ca và mục trình duyệt trước đây đã được trả lời tại Q-105 và Q-106.

## 17. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-56 | Đã xác nhận ngày 09/10/2026: Danh sách ca kiểm thử ở tài liệu này là bản khởi đầu, sẽ bổ sung theo từng nhiệm vụ | Eric |
| GD-57 | Đã xác nhận ngày 09/10/2026: Mọi ca kiểm thử quyền phải gọi thẳng điểm cuối, không thao tác qua giao diện | Eric |
| GD-77 | Đã xác nhận ngày 09/10/2026: Bộ ca kiểm thử phải có ca cho cây đơn vị nhiều cấp, phạm vi cấp trên và cấp dưới, và hạn mức phê duyệt | Eric |
| Q-105 | Đã trả lời ngày 09/10/2026: cần bộ ca kiểm thử chi tiết cho P01, P02 và P04, P05 và P06, P08 (việc N21) | Eric |
| Q-106 | Đã trả lời ngày 09/10/2026: trình duyệt Chrome, Safari, Edge | Eric |
| Q-125 | Đã trả lời ngày 09/10/2026: có bộ ca kiểm thử riêng cho dịch vụ định danh | Eric |
