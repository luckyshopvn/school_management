# 21. KỊCH BẢN KIỂM THỬ

- Mô tả: Danh sách ca kiểm thử theo chức năng, dữ liệu đầu vào, kết quả mong đợi, kết quả thực tế.
- Phiên bản: 1.34
- Ngày cập nhật: 2026-10-13
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
| CT-001 | Truy vấn trẻ theo phạm vi đơn vị | Tài khoản quản lý đơn vị A | Chỉ trả về trẻ của đơn vị A | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-002 | Gọi điểm cuối cập nhật hồ sơ trẻ | Tài khoản kế toán đơn vị A | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-003 | Gọi điểm cuối điểm danh lớp không phụ trách | Tài khoản giáo viên lớp khác | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/attendance/attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-004 | Xem dữ liệu nghiệp vụ bằng quản trị nền tảng | Tài khoản quản trị nền tảng | Không trả về dữ liệu nghiệp vụ nào | Kiểm thử tự động `apps/api/src/authentication/authentication.guard.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-005 | Hiệu lực thu hồi quyền | Thu hồi vai trò rồi gửi yêu cầu kế tiếp | Yêu cầu bị từ chối ngay, không chờ hết phiên | Kiểm thử tự động `apps/api/src/authentication/authentication.guard.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-006 | Đăng nhập sai quá số lần cấu hình | Sai mật khẩu năm lần | Tài khoản tạm khóa 15 phút, thông báo thử lại sau 15 phút (YCTD-35, YCTD-66) | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-007 | Đăng nhập lần đầu của phụ huynh | Mật khẩu mặc định chung | Bắt buộc đổi mật khẩu trước khi dùng | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 11/10/2026 | Đạt |

## 3. Trẻ, phụ huynh và lớp học

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-008 | Tạo hồ sơ trẻ thiếu ngày sinh | Hồ sơ thiếu ngày sinh | Từ chối và chỉ rõ trường thiếu | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-009 | Số định danh cá nhân trùng | Hồ sơ mới có số định danh trùng | Từ chối, chỉ ra hồ sơ trùng | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-010 | Chuyển lớp cho trẻ | Trẻ đang học lớp Mầm 1 sang Mầm 2 | Sĩ số hai lớp đổi, lịch sử lớp ghi thêm dòng mới | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-011 | Phân lớp vượt sĩ số | Lớp đã đủ hai mươi lăm trẻ | Cảnh báo và yêu cầu xác nhận quản lý đơn vị | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-012 | Chuyển đơn vị khi còn công nợ | Trẻ còn công nợ ba triệu đồng | Chặn, yêu cầu tất toán trước | Kiểm thử tự động `apps/api/src/children/child-lifecycle.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-013 | Phụ huynh xem danh sách trẻ | Tài khoản phụ huynh của trẻ A | Chỉ thấy trẻ A | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-014 | Phụ huynh gọi điểm cuối hồ sơ trẻ khác | Tài khoản phụ huynh của trẻ A, gọi hồ sơ trẻ B | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |

## 4. Điểm danh và chăm sóc

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-015 | Lưu điểm danh hai lần | Bấm lưu hai lần liên tiếp | Chỉ một bản ghi cho mỗi trẻ trong ngày | Kiểm thử tự động `apps/api/src/attendance/attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-016 | Sửa điểm danh đã chốt | Sửa trạng thái của một trẻ | Yêu cầu lý do và ghi nhật ký kèm giá trị trước sau | Kiểm thử tự động `apps/api/src/attendance/attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-017 | Báo vắng trước giờ học | Phụ huynh báo vắng lúc sáu giờ ba mươi | Trẻ ở trạng thái nghỉ có báo | Kiểm thử tự động `apps/api/src/attendance/attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-018 | Báo vắng sau khi đã điểm danh | Phụ huynh báo vắng lúc mười giờ | Ghi nhận và đánh dấu báo muộn | Kiểm thử tự động `apps/api/src/attendance/attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-019 | Phụ huynh xem nhật ký của con | Tài khoản phụ huynh của trẻ A | Chỉ thấy nhật ký của trẻ A | Kiểm thử tự động `apps/api/src/journals/journals.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-020 | Ghi nhật ký cho trẻ ngoài lớp | Giáo viên lớp Mầm 1 ghi cho trẻ lớp Mầm 2 | Từ chối | Kiểm thử tự động `apps/api/src/journals/journals.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-021 | Bàn giao trẻ cho người không ủy quyền | Người nhận không có trong danh sách | Chặn bàn giao, yêu cầu xác nhận của phụ huynh | Kiểm thử tự động `apps/api/src/pickups/pickups.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-022 | Nhập bù điểm danh sau khi mất mạng | Ghi tạm trên thiết bị rồi đồng bộ | Bản ghi có đánh dấu nhập bù, không trùng | Kiểm thử tự động `apps/api/src/attendance/attendance.test.ts` đạt ngày 11/10/2026 | Đạt |

## 5. Học phí, khoản thu và giảm trừ

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-023 | Tính học phí có ba dịch vụ | Trẻ đăng ký bán trú, STEM, Anh văn | Khoản phải thu có đúng ba khoản dịch vụ cộng học phí chính khóa | Kiểm thử tự động `apps/api/src/fees/fee-scenarios.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-024 | Tính tiền ăn theo ngày ăn thực tế | Trẻ có mười tám ngày ăn thực tế, nghỉ có báo hai ngày, nghỉ không báo một ngày | Tiền ăn bằng đơn giá nhân mười tám | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-025 | Giảm trừ trẻ con nhân sự | Trẻ có cờ con nhân sự | Áp dụng mức giảm trừ và ghi người phê duyệt | Kiểm thử tự động `apps/api/src/fees/discounts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-026 | Sửa hóa đơn đã phát hành | Sửa số tiền trực tiếp | Chặn, yêu cầu lập phiếu điều chỉnh | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-027 | Tính học phí trẻ nhập học giữa tháng | Trẻ nhập học ngày mười lăm | Tính theo tỷ lệ ngày học thực tế | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-028 | Chạy tính học phí hai lần | Chạy lại cùng kỳ và cùng đơn vị | Không sinh khoản phải thu trùng | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-029 | Thiếu biểu phí cho một khối lớp | Khối lớp chưa có biểu phí hiệu lực | Chặn phát hành, chỉ rõ khối lớp thiếu | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-030 | Giảm trừ vượt khoản phải thu | Tổng giảm trừ lớn hơn tổng phải thu | Chặn lưu, yêu cầu điều chỉnh | Kiểm thử tự động `apps/api/src/fees/discounts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-031 | Đăng ký dịch vụ sau ngày chốt | Phụ huynh đăng ký dịch vụ không bắt buộc sau ngày chốt | Chờ Ban Giám hiệu duyệt; khi duyệt sinh hóa đơn bổ sung cùng kỳ, không sửa hóa đơn đã phát hành (BR-26, BR-85) | Kiểm thử tự động `apps/api/src/fees/registrations.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-032 | Phụ huynh xem học phí của con | Tài khoản phụ huynh của trẻ A | Chỉ thấy khoản phải thu của trẻ A | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |

## 6. Thu chi, quỹ và công nợ

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-033 | Cấp số phiếu thu | Hai phiếu thu trong cùng đơn vị và năm | Số phiếu khác nhau, không trùng | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-034 | Phân bổ vượt số tiền thu | Thu một triệu, phân bổ một triệu hai trăm nghìn | Từ chối, nêu tổng phân bổ vượt | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-035 | Tính số dư công nợ sau khi thu | Hai hóa đơn một triệu và hai triệu, thu đủ hóa đơn một triệu | Hóa đơn đó đã thu đủ, công nợ còn hai triệu | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-036 | Xóa phiếu thu đã phát hành | Bấm xóa | Chặn, yêu cầu lập phiếu đảo | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-037 | Đảo phiếu thu | Lập phiếu đảo có lý do | Phiếu gốc còn nguyên, công nợ tăng trở lại | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-038 | Phiếu chi từ hạn mức trở lên | Phiếu chi mười lăm triệu với hạn mức mười triệu | Chuyển Hiệu trưởng phê duyệt | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-039 | Phiếu chi vượt số dư quỹ | Số dư một triệu, chi hai triệu | Từ chối, báo số dư không đủ | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-040 | Phiếu chi thiếu chứng từ | Không đính kèm chứng từ | Chặn phát hành | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-041 | Chốt kỳ tài chính | Chốt kỳ tháng chín | Không sửa được phiếu trong kỳ đã chốt | Kiểm thử tự động `apps/api/src/finance/finance-g2.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-042 | Giáo viên gọi điểm cuối danh sách phiếu chi | Tài khoản giáo viên | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |

## 7. Nhân sự, chấm công và lương

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-043 | Cảnh báo hợp đồng sắp hết hạn | Hợp đồng còn mười ngày, cảnh báo mười lăm ngày | Hiển thị cảnh báo trên trang chủ | Kiểm thử tự động `apps/api/src/staff/staff.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-044 | Tính số giờ làm | Giờ vào bảy giờ ba mươi, giờ ra mười bảy giờ | Tính đúng số giờ và trạng thái ngày công | Kiểm thử tự động `apps/api/src/staff-attendance/staff-attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-045 | Giờ ra nhỏ hơn giờ vào | Giờ vào mười bảy giờ, giờ ra bảy giờ ba mươi | Chặn lưu | Kiểm thử tự động `apps/api/src/staff-attendance/staff-attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-046 | Chốt công khi còn đơn chờ duyệt | Một đơn nghỉ phép chưa duyệt | Chặn chốt, liệt kê đơn còn chờ | Kiểm thử tự động `apps/api/src/staff-attendance/leave.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-047 | Sửa chấm công của kỳ đã chốt | Sửa giờ của kỳ đã chốt | Chặn, yêu cầu mở lại kỳ | Kiểm thử tự động `apps/api/src/staff-attendance/leave.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-048 | Bỏ ngày 09/10/2026: nhà trường không cho ứng lương (Q-54) | — | — | | Không áp dụng |
| CT-049 | Tính lương trả trước có đủ thành phần | Bảng công tháng trước đã chốt, có phụ cấp, thưởng, làm thêm giờ, ngày không hưởng lương, khấu trừ | Lương bằng phần trả trước cộng trừ điều chỉnh theo công tháng trước (BR-43) | Kiểm thử tự động `apps/api/src/payroll/payroll.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-050 | Nhân sự xem phiếu lương của người khác | Tài khoản giáo viên A gọi phiếu lương giáo viên B | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/payroll/payroll.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-051 | Tính lương khi thiếu hợp đồng | Nhân sự không có hợp đồng hiệu lực trong kỳ | Đưa vào danh sách chờ xử lý, không tính lương | Kiểm thử tự động `apps/api/src/payroll/payroll.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-052 | Sửa bảng lương đã chốt | Sửa trực tiếp | Chặn, yêu cầu lập bảng điều chỉnh | Kiểm thử tự động `apps/api/src/payroll/payroll.test.ts` đạt ngày 11/10/2026 | Đạt |

## 8. Y tế học đường

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-053 | Gửi yêu cầu dặn thuốc thiếu giờ | Yêu cầu không có giờ cho uống | Từ chối, yêu cầu bổ sung | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-054 | Cho uống thuốc khi chưa nhận thuốc | Phiếu chưa xác nhận nhận thuốc | Chặn ghi nhận liều | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-055 | Ghi trùng một liều | Ghi hai liều cùng thời điểm | Chặn, hiển thị liều đã ghi | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-056 | Bỏ liều không nhập lý do | Bấm bỏ liều | Chặn lưu, yêu cầu lý do | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-057 | Giáo viên không liên quan xem hồ sơ sức khỏe | Tài khoản giáo viên lớp khác | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/health/health.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-058 | Ghi sự kiện y tế | Trẻ sốt tại trường | Phụ huynh nhận thông báo, bản ghi có người xử lý | Kiểm thử tự động `apps/api/src/health/health.test.ts` đạt ngày 11/10/2026 | Đạt |

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
| CT-064 | Tính số suất ăn | Ba mươi trẻ có mặt, hai trẻ nghỉ | Mỗi bữa sáng, trưa, xế có ba mươi suất; hai trẻ nghỉ không tính tiền ăn ngày đó | Kiểm thử tự động `apps/api/src/kitchen/kitchen.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-065 | Phụ huynh xem thực đơn chưa duyệt | Thực đơn ở trạng thái chưa duyệt | Không hiển thị | Kiểm thử tự động `apps/api/src/kitchen/kitchen.test.ts` đạt ngày 11/10/2026; Kiểm thử giao diện `tests/e2e/32-kitchen.spec.ts` đạt ngày 11/10/2026 | Đạt |
| CT-066 | Xuất kho vượt tồn | Tồn mười, xuất mười lăm | Từ chối, báo vượt tồn | Kiểm thử tự động `apps/api/src/inventory/inventory.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-067 | Đề nghị mua hàng vượt hạn mức | Đề nghị có giá trị từ hạn mức trở lên | Chuyển Hiệu trưởng phê duyệt, ở trạng thái chờ duyệt | Kiểm thử tự động `apps/api/src/inventory/inventory.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-068 | Kiểm kê có chênh lệch | Số thực tế khác số hệ thống | Biên bản ghi chênh lệch, cần phê duyệt | Kiểm thử tự động `apps/api/src/inventory/inventory.test.ts` đạt ngày 11/10/2026 | Đạt |

## 11. Nội dung, tương tác, tuyển sinh

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-069 | Tạo hoạt động | Giáo viên tạo hoạt động của lớp | Ở trạng thái chờ duyệt, chưa hiển thị cho phụ huynh | Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-070 | Phụ huynh xem hoạt động đã duyệt | Hoạt động đã công bố của lớp con | Hiển thị kèm hình ảnh | Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt ngày 11/10/2026; Kiểm thử giao diện `tests/e2e/34-activities.spec.ts` đạt ngày 11/10/2026 | Đạt |
| CT-071 | Tải ảnh có trẻ chưa đồng ý | Trẻ chưa có cờ đồng ý hình ảnh | Cảnh báo, không công bố hình của trẻ đó | Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-072 | Giáo viên bộ môn duyệt hoạt động | Tài khoản giáo viên bộ môn | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-073 | Gửi phiếu bình chọn hai lần | Cùng tài khoản gửi hai phiếu | Từ chối phiếu thứ hai | Kiểm thử tự động `apps/api/src/interactions/interactions.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-074 | Gửi phiếu sau khi hết thời gian | Bình chọn đã kết thúc | Từ chối, báo đã hết thời gian | Kiểm thử tự động `apps/api/src/interactions/interactions.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-075 | Xử lý bình luận tiêu cực | Quản lý đơn vị xử lý | Bình luận còn nguyên, có bản ghi xử lý | Kiểm thử tự động `apps/api/src/interactions/interactions.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-076 | Chuyển hồ sơ tuyển sinh đã đạt | Hồ sơ ở trạng thái đạt | Sinh hồ sơ trẻ, gắn phụ huynh, phân lớp | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` đạt ngày 12/10/2026; Kiểm thử giao diện `tests/e2e/40-admissions.spec.ts` đạt ngày 12/10/2026 | Đạt |
| CT-077 | Chuyển hồ sơ tuyển sinh chưa đạt | Hồ sơ chưa đạt | Từ chối | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` đạt ngày 12/10/2026 | Đạt |

## 12. Báo cáo và đối chiếu số liệu

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-078 | Bảng điều khiển Ban Giám hiệu | Tài khoản Hiệu trưởng | Thấy số liệu của mọi đơn vị ở mọi cấp | Kiểm thử tự động `apps/api/src/reports/reports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-079 | Bảng điều khiển quản lý đơn vị | Tài khoản quản lý đơn vị A | Chỉ thấy số liệu đơn vị A và các đơn vị cấp dưới trực thuộc | Kiểm thử tự động `apps/api/src/reports/reports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-080 | Đối chiếu công nợ | Báo cáo công nợ kỳ tháng mười | Tổng công nợ khớp tổng theo từng trẻ | Kiểm thử tự động `apps/api/src/reports/reports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-081 | Đối chiếu tiền ăn và điểm danh | Số suất ăn của ngày so với điểm danh đã chốt | Khớp nhau | Kiểm thử tự động `apps/api/src/kitchen/kitchen.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-082 | Đối chiếu phiếu thu và sổ quỹ | Tổng phiếu thu tiền mặt và phiếu chi tiền mặt trong ngày so với biến động sổ quỹ tiền mặt | Khớp nhau | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-083 | Xuất báo cáo và ghi nhật ký | Kế toán xuất báo cáo thu chi | Tệp được sinh và có bản ghi nhật ký xuất | Kiểm thử tự động `apps/api/src/reports/reports-g2.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-084 | Giáo viên gọi điểm cuối báo cáo thu chi | Tài khoản giáo viên | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/reports/reports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-085 | Báo cáo hợp nhất nhiều đơn vị | Hiệu trưởng chọn hai đơn vị | Chỉ số tách biệt và có dòng tổng | Kiểm thử tự động `apps/api/src/reports/reports-g2.test.ts` đạt ngày 12/10/2026 | Đạt |

## 13. Ca kiểm thử đơn vị tổ chức, phân cấp phê duyệt và kiến trúc

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-091 | Tạo Trường chính | Tài khoản Hiệu trưởng | Tạo được đơn vị cấp cao nhất, đơn vị cha trống | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-092 | Tạo đơn vị dưới đơn vị cấp 2 | Tạo đơn vị có đơn vị cha là một Điểm trường (YCTD-38) | Trả lỗi vi phạm BR-01 vì cây chỉ có hai cấp | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-093 | Xem cây đơn vị hai cấp | Tài khoản Hiệu trưởng | Thấy Trường chính và các đơn vị cấp 2 kèm loại; lọc được theo loại (YCTD-38) | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-094 | Xếp trẻ vào lớp thuộc Điểm trường | Trẻ mới và lớp của Điểm trường | Đơn vị của trẻ được ghi là Điểm trường đó | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-095 | Phạm vi cấp trên bao gồm cấp dưới | Tài khoản gán ở Trường chính, truy vấn Điểm trường trực thuộc | Được phép trả dữ liệu | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-096 | Phạm vi đơn vị cấp 2 không gồm đơn vị khác | Tài khoản gán ở Điểm trường A, truy vấn Trường chính và Phân hiệu (YCTD-38) | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/organization/org-units.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-097 | Phó Hiệu trưởng duyệt dưới hạn mức | Phiếu chi có giá trị dưới hạn mức | Phiếu chi được duyệt | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-098 | Phó Hiệu trưởng duyệt bằng hạn mức | Phiếu chi có giá trị bằng hạn mức | Bị từ chối, yêu cầu chuyển lên Hiệu trưởng | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-099 | Người lập tự phê duyệt chứng từ của mình | Phiếu chi do chính người phê duyệt lập | Bị từ chối | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-100 | Phó Hiệu trưởng duyệt chứng từ ngoài đơn vị được gán | Phiếu chi của đơn vị B | Bị từ chối | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-101 | Kiểm tra mã nguồn gói giao diện | Gói giao diện của ba kênh | Không có thông tin đăng nhập cơ sở dữ liệu, không có truy vấn trực tiếp | Kiểm thử tự động `apps/api/src/security/data-storage.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-102 | Máy chủ API kiểm tra mã phiên với dịch vụ định danh | Yêu cầu thay đổi dữ liệu kèm mã phiên hợp lệ | Xử lý thành công sau khi kiểm tra mã phiên | Kiểm thử tự động `apps/api/src/authentication/authentication.guard.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-103 | Gọi điểm cuối quản lý tài khoản của người khác | Tài khoản giáo viên | Bị từ chối ở dịch vụ định danh | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-104 | Nhật ký từ chối phê duyệt vượt hạn mức | Chứng từ vượt hạn mức bị từ chối | Nhật ký ghi người từ chối, thời điểm và lý do | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |

## 14. Ca kiểm thử hiệu năng và phục hồi

| Mã | Kịch bản | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|
| CT-086 | Một trăm giáo viên điểm danh đồng thời | Thời gian phản hồi dưới hai giây, không lỗi | | Chưa chạy |
| CT-087 | Tính học phí cho năm trăm trẻ | Hoàn thành dưới năm phút, không chặn giao diện | | Chưa chạy |
| CT-088 | Tạo một nghìn phiếu thu trong ngày | Không lỗi, số phiếu không trùng | | Chưa chạy |
| CT-089 | Khôi phục từ bản sao lưu | Mọi cơ sở dữ liệu khôi phục đầy đủ, có biên bản (SL-01) | | Chưa chạy |
| CT-090 | Gửi lại thông báo thất bại | Hàng đợi gửi lại thành công trong thời gian cấu hình | Kiểm thử tự động `apps/api/src/notifications/notification-dispatcher.test.ts` đạt ngày 11/10/2026 | Đạt |

## 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng

| Mã | Chức năng | Dữ liệu đầu vào | Kết quả mong đợi | Thực tế | Trạng thái |
|---|---|---|---|---|---|
| CT-105 | P01-11 | Phòng học của đơn vị A gán cho lớp đơn vị B | Từ chối | Kiểm thử tự động `apps/api/src/classes/classes.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-106 | P01-12 | Ngừng sử dụng bậc học đang gắn với lớp | Lớp cũ giữ nguyên, lớp mới không chọn được | Kiểm thử tự động `apps/api/src/classes/classes.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-107 | P02-11 | Phụ huynh báo mất đồ của con | Phiếu đã báo, giáo viên chủ nhiệm nhận thông báo | Kiểm thử tự động `apps/api/src/interactions/interactions.test.ts` đạt ngày 11/10/2026; Kiểm thử giao diện `tests/e2e/35-interactions.spec.ts` đạt ngày 11/10/2026 | Đạt |
| CT-108 | P02-11 | Phụ huynh trẻ A gọi phiếu đồ bị mất của trẻ B | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/interactions/interactions.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-109 | P02-11 | Xóa phiếu đồ bị mất đã đóng | Chặn xóa | Kiểm thử tự động `apps/api/src/interactions/interactions.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-110 | P03-08 | Lọc bài học theo lĩnh vực | Chỉ trả bài học thuộc lĩnh vực | Kiểm thử tự động `apps/api/src/teaching/teaching.test.ts` đạt ngày 11/10/2026; Kiểm thử giao diện `tests/e2e/36-teaching.spec.ts` đạt ngày 11/10/2026 | Đạt |
| CT-111 | P06-10 | Phát hành phiếu thu chưa chọn khoản mục | Từ chối | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-112 | P06-10 | Báo cáo thu chi nhóm theo nhóm thu chi | Tổng các nhóm bằng tổng kỳ | Kiểm thử tự động `apps/api/src/settings/configurable-rules.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-113 | P08-09 | Chốt bảng công có ngày nghỉ lễ hưởng lương | Ngày đó ghi nghỉ lễ | Kiểm thử tự động `apps/api/src/staff-attendance/leave.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-114 | P08-10 | Chốt bảng công có ngày thứ bảy nghỉ định kỳ | Không tính vắng không phép | Kiểm thử tự động `apps/api/src/staff-attendance/leave.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-115 | P08-09 | Giáo viên gọi điểm cuối sửa ngày nghỉ lễ | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/staff-attendance/staff-attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-116 | P10-09 | Ghi nhận thuốc đã mua mười hộp | Số lượng thuốc tăng mười | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-117 | P10-10 | Công bố lịch khám lớp Mầm 1 | Phụ huynh lớp Mầm 1 nhận thông báo | Kiểm thử tự động `apps/api/src/health/health.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-118 | P10-11 | Lưu kết quả khám có cân nặng dưới ngưỡng | Chỉ số được đánh dấu cần theo dõi | Kiểm thử tự động `apps/api/src/health/health.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-119 | P12-09 | Xác nhận nhập phiếu đi chợ | Tồn nguyên liệu tăng, có đề nghị thanh toán | Kiểm thử tự động `apps/api/src/kitchen/kitchen.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-120 | P13-10 | Nhập tồn ban đầu cho mặt hàng đã có giao dịch | Từ chối | Kiểm thử tự động `apps/api/src/inventory/inventory.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-121 | P14-11 | Đăng ký hoạt động ngoại khóa đã đủ chỉ tiêu | Từ chối, báo hết chỗ | Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-122 | P14-11 | Đăng ký hoạt động ngoại khóa có phí | Phí vào khoản phải thu như khoản phát sinh | Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-123 | P14-12 | Xóa bình luận của phụ huynh trên tin tức | Chặn xóa | Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-124 | P16-05 | Mở danh sách tin tuyển sinh của đợt đang mở | Thấy tin kèm thời hạn | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-125 | P17-13 | Giáo viên lớp Mầm 1 mở bảng tin | Chỉ thấy sinh nhật trẻ lớp Mầm 1 | Kiểm thử tự động `apps/api/src/reports/reports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-126 | P17-14 | Kế toán mở báo cáo học thứ 7 | Có các ngày học bù, số trẻ đi học và vắng của từng ngày | Kiểm thử tự động `apps/api/src/reports/reports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-127 | P17-15 | Bỏ ngày 09/10/2026: trường không có bữa tối (YCTD-20) | — | | Không áp dụng |
| CT-128 | P17-14 | Giáo viên gọi điểm cuối báo cáo học thứ 7 | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/reports/reports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-129 | P08-10 | Chốt bảng công có ngày thứ bảy học bù, một nhân sự không chấm công | Ngày đó là ngày làm việc, nhân sự bị tính vắng | Kiểm thử tự động `apps/api/src/staff-attendance/leave.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-130 | P14-11 | Tính học phí kỳ kế tiếp với đăng ký ngoại khóa thu theo tháng | Phí hoạt động có trong khoản phải thu của kỳ | Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-131 | P14-11 | Trẻ đăng ký ngoại khóa thu theo tháng, nghỉ ba buổi, thôi giữa tháng | Phí tháng thu đủ, không có dòng giảm trừ | Kiểm thử tự động `apps/api/src/activities/activities.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-132 | P05-05 | Tính học phí kỳ với học phí chính khóa bằng không | Hóa đơn chỉ có khoản dịch vụ | Kiểm thử tự động `apps/api/src/fees/fee-scenarios.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-133 | P05-11 | Áp dụng loại miễn giảm mười phần trăm tiền bán trú | Dòng giảm trừ đúng mười phần trăm | Kiểm thử tự động `apps/api/src/fees/discounts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-134 | P08-11 | Cấp phép năm cho giáo viên sáu năm thâm niên | Được mười ba ngày theo quy định cấu hình | Kiểm thử tự động `apps/api/src/staff-attendance/leave.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-135 | P08-11 | Tính lương có khấu trừ theo tỷ lệ | Khấu trừ bằng tỷ lệ nhân lương hợp đồng | Kiểm thử tự động `apps/api/src/payroll/payroll.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-136 | P19-06 | Phụ huynh đăng nhập bằng mã một lần đúng, còn hạn | Đăng nhập thành công | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-137 | P19-06 | Nhập sai mã một lần quá số lần cấu hình | Từ chối, yêu cầu mã mới | Kiểm thử tự động `apps/identity/src/authentication/parent-sign-in.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-138 | P05-03 | Đơn vị bật chặn, trẻ nợ quá hạn, phụ huynh đăng ký thêm dịch vụ | Từ chối kèm thông báo công nợ | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-139 | P01-13 | Nhập tệp trẻ có dòng thiếu ngày sinh | Báo dòng lỗi, không ghi dòng nào | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-140 | P01-13 | Nhập tệp công nợ đầu kỳ hợp lệ | Khoản phải thu đầu kỳ đúng, có nhật ký | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-141 | P01-13 | Giáo viên gọi điểm cuối nhập dữ liệu | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-142 | P06-11 | Chuyển khoản đủ theo mã QR | Phiếu thu tự lập, hóa đơn đã thu đủ | Kiểm thử tự động `apps/api/src/finance/online-payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-143 | P06-11 | Gửi lại thông báo cùng mã giao dịch | Không tạo phiếu thu thứ hai | Kiểm thử tự động `apps/api/src/finance/online-payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-144 | P06-11 | Chuyển khoản sai số tiền | Vào danh sách chờ kế toán xử lý | Kiểm thử tự động `apps/api/src/finance/online-payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-145 | P06-01 | Lập phiếu thu một phần cho hóa đơn | Từ chối | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-146 | P02-09 | Phụ huynh rút đồng ý hình ảnh | Hình của trẻ bị ẩn, có lịch sử đồng ý | Kiểm thử tự động `apps/api/src/children/child-lifecycle.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-147 | P02-09 | Phụ huynh trẻ A đổi đồng ý của trẻ B | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/children/child-lifecycle.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-148 | P02-02 | Kế toán xem số định danh của trẻ | Chỉ thấy số đã che | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-149 | P02-02 | Quản lý đơn vị xem đầy đủ số định danh | Có bản ghi nhật ký truy cập | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-150 | P01-02 | Mở năm học mới | Cơ sở dữ liệu năm mới có dữ liệu chuyển sang, giữ nguyên mã định danh; năm cũ chỉ đọc | Kiểm thử tự động `apps/api/src/academic-years/year-transition.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-151 | P01-14 | Khóa phạm vi báo cáo gọi danh sách trẻ | Từ chối | Kiểm thử tự động `apps/api/src/partner/partner.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-152 | P01-14 | Khóa phạm vi danh sách trẻ đọc dữ liệu | Có nhật ký kèm khóa và căn cứ | Kiểm thử tự động `apps/api/src/partner/partner.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-153 | P08-12 | Làm vượt giờ 2 giờ trong ngày | Chỉ tính 1 giờ làm thêm | Kiểm thử tự động `apps/api/src/staff-attendance/leave.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-154 | P05-03 | Đăng ký STEM sau ngày chốt | Chờ Ban Giám hiệu duyệt | Kiểm thử tự động `apps/api/src/fees/registrations.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-155 | P05-05 | Đăng ký trễ duyệt thu theo ngày thực tế | Phí theo tỷ lệ ngày còn lại | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-156 | P05-03 | Bỏ chọn bán trú | Không cho bỏ | Kiểm thử tự động `apps/api/src/fees/registrations.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-157 | P02-02 | Trẻ chưa có mã ngành | Ô mã ngành tô đỏ | Kiểm thử giao diện `tests/e2e/09-children.spec.ts` đạt ngày 11/10/2026 | Đạt |
| CT-158 | P02-12 | Nhập tệp mã ngành có dòng không khớp | Báo dòng lỗi | Kiểm thử tự động `apps/api/src/imports/imports.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-159 | P19-06 | Đăng nhập lần đầu bằng mật khẩu mặc định | Chỉ vào màn hình đổi mật khẩu | Kiểm thử tự động `tests/e2e/07-parent-sign-in.spec.ts` đạt ngày 11/10/2026 | Đạt |
| CT-160 | P08-10 | Ban Giám hiệu tạo ngày học bù, giáo viên mở điểm danh ngày đó | Mọi lớp có danh sách điểm danh; ngày đó tính vào số ngày học của tháng | Kiểm thử tự động `apps/api/src/fees/fee-scenarios.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-161 | P08-10 | Quản lý đơn vị gọi điểm cuối tạo lịch học bù | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/staff-attendance/staff-attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-162 | P10-01 | Kế toán trưởng, nhân sự, giáo viên bộ môn gọi điểm cuối hồ sơ sức khỏe | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/health/health.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-163 | P06-04 | Phó Hiệu trưởng duyệt phiếu chi hoàn tiền dưới hạn mức | Bị từ chối, chuyển Hiệu trưởng | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-164 | P01-10 | Trình duyệt chứng từ thuộc loại chưa cấu hình hạn mức | Chuyển Hiệu trưởng | Kiểm thử tự động `apps/api/src/fees/discounts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-165 | P19-06 | Kiểm toán viên đăng nhập sau ngày hết hiệu lực | Bị từ chối, tài khoản khóa | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-166 | P05-06 | Phát hành khoản phát sinh sau khi hóa đơn chính đã phát hành | Sinh hóa đơn bổ sung cùng kỳ, hóa đơn chính không đổi | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-167 | P01-14 | Đối tác gọi danh sách trẻ bằng khóa đã thu hồi | Bị từ chối ngay | Kiểm thử tự động `apps/api/src/partner/partner.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-168 | P06-03 | Kế toán lập phiếu đảo, kế toán trưởng gọi điểm cuối duyệt | Bị từ chối; phiếu gốc và công nợ chưa đổi | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-169 | P05-12 | Quản lý đơn vị gọi điểm cuối ghi quyết định xử lý công nợ | Bị từ chối; Phó Hiệu trưởng ghi được, số tiền công nợ không đổi | Kiểm thử tự động `apps/api/src/finance/finance-g2.test.ts` đạt ngày 12/10/2026; Kiểm thử giao diện `tests/e2e/38-finance-g2.spec.ts` đạt ngày 12/10/2026 | Đạt |
| CT-170 | P06-04 | Kế toán lập phiếu đảo phiếu chi, kế toán trưởng gọi điểm cuối duyệt | Bị từ chối; phiếu gốc và số dư quỹ chưa đổi | Kiểm thử tự động `apps/api/src/finance/payments.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-171 | P10-04 | Đơn vị bật không có nhân viên y tế, phụ huynh gửi yêu cầu dặn thuốc | Giáo viên chủ nhiệm nhận, xác nhận và ghi liều được | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts` đạt ngày 11/10/2026; Kiểm thử giao diện `tests/e2e/31-medication.spec.ts` đạt ngày 11/10/2026 | Đạt |
| CT-172 | P10-04 | Đơn vị tắt cấu hình, giáo viên chủ nhiệm gọi điểm cuối xác nhận nhận thuốc | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-173 | P10-03 | Gửi yêu cầu dặn thuốc không có ảnh thuốc; gửi yêu cầu có ảnh thuốc, không có đơn | Lần đầu bị từ chối; lần sau gửi được | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-174 | P10-12 | Giáo viên ghi nhiệt độ trẻ A; phụ huynh trẻ A và trẻ B mở ứng dụng | Phụ huynh trẻ A thấy, phụ huynh trẻ B không thấy | Kiểm thử tự động `apps/api/src/health/health.test.ts` đạt ngày 11/10/2026; Kiểm thử giao diện `tests/e2e/30-health.spec.ts` đạt ngày 11/10/2026 | Đạt |
| CT-175 | P10-07 | Phụ huynh bấm đã biết sự kiện y tế | Y tế thấy đã xác nhận kèm thời điểm; không có lần nhắc lại nào | Kiểm thử tự động `apps/api/src/health/health.test.ts` đạt ngày 11/10/2026; Kiểm thử giao diện `tests/e2e/30-health.spec.ts` đạt ngày 11/10/2026 | Đạt |
| CT-176 | P01-06 | Đặt lại mật khẩu cho giáo viên, giáo viên đăng nhập bằng mật khẩu mới | Chỉ vào được màn hình đổi mật khẩu | Kiểm thử tự động `apps/api/src/accounts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-177 | P01-02 | Mở năm học mới khi năm đang dùng còn trẻ đã thôi học nợ 500 000 (YCTD-37) | Bị chặn, liệt kê trẻ còn nợ | Kiểm thử tự động `apps/api/src/academic-years/year-transition.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-178 | P05-05 | Chạy tính học phí khi lớp L-A1 còn hai ngày chưa chốt điểm danh | Bị chặn, liệt kê lớp và ngày | Kiểm thử tự động `apps/api/src/fees/fee-calculation.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-179 | P06-02 | Thủ quỹ lập phiếu thu tiền mặt và chọn hóa đơn | Hóa đơn đã thu đủ, quỹ tăng | Kiểm thử tự động `apps/api/src/finance/receipts.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-180 | P08-06 | Tính bảng lương tháng 10 khi bảng công tháng 9 chưa chốt | Bị chặn, liệt kê đơn vị chưa chốt | Kiểm thử tự động `apps/api/src/payroll/payroll.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-181 | P08-06 | Lương hợp đồng 12 000 000, ngày công chuẩn 24, 3 ngày không hưởng lương tháng 9 | Bảng lương tháng 10 trừ 1 500 000 | Kiểm thử tự động `apps/api/src/payroll/payroll.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-182 | P08-06 | Nhân sự vào làm ngày 15/10 | Tháng 10 không trả trước; tháng 11 có phần tháng 10 theo công | Kiểm thử tự động `apps/api/src/payroll/payroll.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-183 | P08-06 | Nhân sự nghỉ việc ngày 10/10 đã nhận lương trả trước tháng 10 | Bảng quyết toán ghi khoản phải thu hồi, chờ Ban Giám hiệu duyệt | Kiểm thử tự động `apps/api/src/payroll/settlements.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-184 | P01-02 | Lưu lịch năm học có học kỳ 1, học kỳ 2, kỳ hè | Tuần được đánh số liên tục; học kỳ chồng nhau bị từ chối | Kiểm thử tự động `apps/api/src/academic-years/calendar.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-185 | P04-01 | Mở điểm danh ngày thuộc tuần nghỉ | Không có bảng điểm danh | Kiểm thử tự động `apps/api/src/attendance/attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-186 | P04-01 | Mở điểm danh ngày sau học kỳ 2, ngoài kỳ hè | Không có bảng điểm danh | Kiểm thử tự động `apps/api/src/attendance/attendance.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-187 | P05-13 | Tháng hè có một trẻ đăng ký, một trẻ không | Chỉ trẻ đã đăng ký có điểm danh và hóa đơn | Kiểm thử tự động `apps/api/src/fees/fee-scenarios.test.ts` đạt ngày 11/10/2026 | Đạt |
| CT-188 | P06-01 | Phiếu thu đầu năm học mới | Số phiếu đánh lại từ đầu | Kiểm thử tự động `apps/api/src/academic-years/year-transition.test.ts` đạt ngày 11/10/2026: phiếu thu đầu tiên của năm mới có số PT-000001 | Đạt |
| CT-189 | P17-10 | Quản lý đơn vị mở báo cáo hoạt động và công việc 10 ngày gần nhất, rồi lọc theo một lớp | Có các bảng điểm danh, sổ liên lạc, hoạt động, y tế, dặn thuốc, thông báo; chỉ các lớp của đơn vị mình; lọc theo lớp chỉ còn lớp đó | Kiểm thử tự động `apps/api/src/reports/reports-g2.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-190 | P17-10 | Quản lý đơn vị xem đơn vị hoặc lớp ngoài phạm vi; giáo viên, kế toán, cán bộ quản lý cấp trên mở báo cáo; khoảng ngày quá 366 ngày | Trả lỗi không có quyền; khoảng ngày quá dài trả lỗi dữ liệu | Kiểm thử tự động `apps/api/src/reports/reports-g2.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-191 | P17-11 | Cán bộ quản lý cấp trên mở báo cáo hợp nhất tháng này | Mỗi đơn vị một dòng kèm dòng tổng; không có tên trẻ, tên người nộp tiền, mã trẻ | Kiểm thử tự động `apps/api/src/reports/reports-g2.test.ts` đạt ngày 12/10/2026; Kiểm thử giao diện `tests/e2e/39-reports-g2.spec.ts` đạt ngày 12/10/2026 | Đạt |
| CT-192 | P17-11 | Cán bộ quản lý cấp trên gọi báo cáo công nợ, điểm danh, thu chi, chấm công, sinh nhật; quản lý đơn vị gọi báo cáo hợp nhất | Trả lỗi không có quyền | Kiểm thử tự động `apps/api/src/reports/reports-g2.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-193 | P17-12 | Kế toán xuất báo cáo công nợ của đơn vị mình ra Excel | Tải được tệp xlsx; nhật ký xuất ghi người xuất, báo cáo, bộ lọc, đơn vị, số dòng, có dữ liệu cá nhân | Kiểm thử tự động `apps/api/src/reports/reports-g2.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-194 | P17-12 | Giáo viên, quản lý đơn vị, cán bộ quản lý cấp trên xuất dữ liệu; kế toán xuất báo cáo không có quyền xem hoặc của đơn vị khác | Trả lỗi không có quyền, không ghi nhật ký xuất | Kiểm thử tự động `apps/api/src/reports/reports-g2.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-195 | P09-01 | Quản lý giao việc cho nhân sự trong đơn vị; quản lý đơn vị khác, giáo viên giao việc; người nhận chưa có tài khoản; hạn đã qua | Giao được, người nhận có thông báo; ngoài đơn vị và giáo viên bị chặn; người nhận chưa có tài khoản bị từ chối mã P09-01; hạn đã qua bị từ chối | Kiểm thử tự động `apps/api/src/work/work.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-196 | P09-02 | Giáo viên tạo việc cá nhân; quản lý xem, sửa việc đó | Chỉ giáo viên xem, sửa được; quản lý bị chặn và không thấy trong danh sách đơn vị | Kiểm thử tự động `apps/api/src/work/work.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-197 | P09-04 | Người nhận cập nhật 50% rồi 100%; người khác cập nhật; việc quá hạn; người giao hủy không lý do | Đang làm rồi hoàn thành, người giao nhận thông báo; người khác bị chặn; bảng tiến độ đếm việc quá hạn; hủy thiếu lý do bị từ chối | Kiểm thử tự động `apps/api/src/work/work.test.ts` đạt ngày 12/10/2026; Kiểm thử giao diện `tests/e2e/37-work.spec.ts` đạt ngày 12/10/2026 | Đạt |
| CT-198 | P09-03 | Quản lý lập kế hoạch tháng có 2 đầu việc, kích hoạt, một việc xong; thêm đầu việc sau khi đóng; phòng nhân sự lập kế hoạch | Kích hoạt giao 2 việc; tiến độ kế hoạch 50%; thêm sau khi đóng bị từ chối mã P09-03; phòng nhân sự không lập được | Kiểm thử tự động `apps/api/src/work/work.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-199 | P09-05 | Chấm 2 chỉ số trọng số 2 và 1; công bố; sửa sau công bố; đánh giá lại không lý do và có lý do | Điểm 86,67; sửa sau công bố bị chặn mã BR-47; đánh giá lại thiếu lý do bị chặn; có lý do thì phiếu mới thay phiếu cũ khi công bố | Kiểm thử tự động `apps/api/src/work/work.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-200 | P07-03 | Phòng nhân sự ghi mốc công tác ở đơn vị chính và đơn vị khác, ghi chứng chỉ; nhân sự và người khác xem; đóng lại mốc đã kết thúc | Hai mốc, một mốc kiêm nhiệm; nhân sự xem được của mình; người khác bị chặn; mốc đã kết thúc không đóng lại được | Kiểm thử tự động `apps/api/src/work/work.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-201 | P08-07 | Kế toán ghi thưởng 1 000 000 và khấu trừ 300 000 tháng này, hủy một khoản; tính bảng lương; ghi thêm sau khi trình duyệt | Phiếu lương có dòng thưởng, khấu trừ kèm căn cứ, không có khoản đã hủy; ghi thêm sau khi trình duyệt bị chặn mã BR-45 | Kiểm thử tự động `apps/api/src/work/work.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-202 | P14-08 | Hiệu trưởng cấu hình Fanpage và Zalo Official Account; gửi trường lạ như khóa truy cập; bật thiếu mã; quản lý đơn vị cấu hình | Lưu được mã trang, mã Official Account; trường lạ và bật thiếu mã bị từ chối; quản lý đơn vị bị chặn; API không trả khóa truy cập | Kiểm thử tự động `apps/api/src/integrations/integrations.test.ts` đạt ngày 12/10/2026; Kiểm thử giao diện `tests/e2e/44-integrations.spec.ts` đạt ngày 12/10/2026 | Đạt |
| CT-203 | P14-08 | Đăng hoạt động lên Fanpage khi chưa bật, khi chưa duyệt, khi đã duyệt có ảnh của trẻ chưa đồng ý; người không có quyền đăng; đăng lại | Chưa bật và chưa duyệt bị chặn; đã duyệt thì đăng, ảnh có trẻ chưa đồng ý bị loại; người không có quyền bị chặn; đăng lại bị chặn | Kiểm thử tự động `apps/api/src/integrations/integrations.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-204 | P14-08 | Facebook trả lỗi khi đăng rồi thử lại; đăng tin tức phạm vi lớp | Lỗi được ghi, thử lại thành công; tin phạm vi lớp không đăng công khai | Kiểm thử tự động `apps/api/src/integrations/integrations.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-205 | P19-04 | Liên kết Zalo theo số điện thoại phụ huynh; gửi thông báo khi Zalo tắt, khi bật với người đã và chưa liên kết, khi Zalo lỗi | Zalo tắt gửi tin nhắn; bật thì người đã liên kết nhận qua Zalo, chưa liên kết nhận tin nhắn; Zalo lỗi thì gửi ngay bằng tin nhắn | Kiểm thử tự động `apps/api/src/integrations/integrations.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-206 | P19-04 | Một phụ huynh nhận nhiều tin trong ngày qua Zalo và tin nhắn | Tin Zalo và tin nhắn tính chung giới hạn 5 tin mỗi ngày | Kiểm thử tự động `apps/api/src/integrations/integrations.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-207 | P05-10 | Kế toán gửi nhắc nợ quá hạn khi Zalo bật | Phụ huynh đã liên kết nhận nhắc nợ qua Zalo | Kiểm thử tự động `apps/api/src/integrations/integrations.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-208 | P18-01 | Quản lý đơn vị lập đề nghị; giáo viên lập; nhân sự duyệt; Phó Hiệu trưởng duyệt; người lập tự duyệt; duyệt lại | Giáo viên, nhân sự bị từ chối; Phó Hiệu trưởng duyệt được, nhật ký có người duyệt, thời điểm, số lượng (BR-80); người lập không tự duyệt; duyệt lại trả BR-80 | Kiểm thử tự động `apps/api/src/recruitment/recruitment.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-209 | P18-02 | Nhân sự đơn vị khác soạn tin; soạn tin hạn nộp đã qua; công bố tin; xem trang công khai không đăng nhập; tin hết hạn | Bị từ chối, lỗi dữ liệu; tin đang soạn không hiện công khai; tin đã công bố hiện kèm vị trí, đơn vị; tin hết hạn trả không tìm thấy | Kiểm thử tự động `apps/api/src/recruitment/recruitment.test.ts` đạt ngày 12/10/2026; Kiểm thử giao diện `tests/e2e/41-recruitment.spec.ts` đạt ngày 12/10/2026 | Đạt |
| CT-210 | P18-03 | Người ngoài nộp hồ sơ thiếu đồng ý, số điện thoại sai, thiếu tệp, tệp không phải ảnh hoặc PDF, hợp lệ, nộp lại | Bốn trường hợp đầu lỗi dữ liệu; hợp lệ được nhận, không trả mã; nộp lại trả xung đột; nhân sự nhận thông báo | Kiểm thử tự động `apps/api/src/recruitment/recruitment.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-211 | P18-03 | Giáo viên, nhân sự đơn vị khác xem ứng viên; nhân sự xem danh sách; quản lý đơn vị xem chi tiết; tải hồ sơ xin việc; tải qua điểm cuối tệp chung | Bị từ chối; danh sách không có số điện thoại; chi tiết và tải tệp ghi nhật ký truy cập (BR-74); tải qua tệp chung bị từ chối | Kiểm thử tự động `apps/api/src/recruitment/recruitment.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-212 | P18-03 | Nhân sự nhập ứng viên; quản lý đơn vị nhập; loại không lý do; loại có lý do; mở lại; xóa | Nhân sự nhập được, quản lý đơn vị bị từ chối; thiếu lý do lỗi dữ liệu; mở lại trả BR-75; không có điểm cuối xóa | Kiểm thử tự động `apps/api/src/recruitment/recruitment.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-213 | P18-04 | Lên lịch với người phỏng vấn không phải nhân sự; giáo viên lên lịch; quyết định khi còn lịch chờ; vòng 1 không đạt rồi quyết định tuyển; vòng 2 đạt rồi quyết định tuyển | Lỗi dữ liệu; bị từ chối; trả BR-80 hai lần; tuyển được, nhật ký có người và thời điểm quyết định; đề nghị có số đã tuyển 1 | Kiểm thử tự động `apps/api/src/recruitment/recruitment.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-214 | P18-04 | Quản lý đơn vị tạo hồ sơ nhân sự từ ứng viên đã tuyển; nhân sự tạo; tạo lần hai | Bị từ chối; hồ sơ nhân sự có họ tên, điện thoại, đơn vị của ứng viên; lần hai trả BR-37 | Kiểm thử tự động `apps/api/src/recruitment/recruitment.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-215 | P18-01, P18-02 | Giáo viên đóng đề nghị; nhân sự đóng đề nghị; nộp hồ sơ vào tin đã đóng; nộp liên tục nhiều lần | Bị từ chối; đề nghị và tin đều đóng; tin đã đóng trả không tìm thấy; vượt giới hạn trả `ERR_RATE_LIMIT` | Kiểm thử tự động `apps/api/src/recruitment/recruitment.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-216 | P16-01 | Lập đợt nháp, mở đợt; giáo viên hoặc quản lý đơn vị khác lập đợt | Đợt nháp chưa nhận hồ sơ; mở xong nhận hồ sơ; người ngoài quyền hoặc ngoài đơn vị bị từ chối | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-217 | P16-02 | Phụ huynh không đăng nhập nộp hồ sơ, tra cứu bằng mã và số điện thoại | Nhận mã TS-000001; nộp trùng bị báo; sai số điện thoại không tra được; số định danh hiện dạng che | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-218 | P16-03 | Nhân viên tuyển sinh xét hồ sơ; quản lý đơn vị xét không đạt không ghi lý do | Bị từ chối; không đạt cần lý do, phụ huynh tra cứu thấy lý do | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-219 | P16-03 | Xét đạt khi đã đủ chỉ tiêu; đóng đợt rồi nộp trực tuyến | Bị chặn mã P16-03; hồ sơ trực tuyến bị chặn mã P16-02, đợt không còn trên trang công khai | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-220 | P16-04 | Nhân viên tuyển sinh chuyển hồ sơ đạt | Hồ sơ trẻ chờ duyệt; quản lý đơn vị duyệt ở trang Hồ sơ trẻ thì trẻ đang học | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-221 | P16 | Gửi quá 10 hồ sơ trong một giờ từ một địa chỉ mạng | Bị chặn `ERR_RATE_LIMIT` | Kiểm thử tự động `apps/api/src/admissions/admissions.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-222 | P06-06 | đọc số tiền (phân cách hàng nghìn, phần lẻ ,00, số âm, ngoặc đơn, phần lẻ khác 0 bị từ chối), ngày theo ba cách ghi, tệp CSV có BOM và ngoặc kép, mã hóa đơn trong diễn giải, chuỗi VietQR đúng mã kiểm tra CRC | đọc số tiền (phân cách hàng nghìn, phần lẻ ,00, số âm, ngoặc đơn, phần lẻ khác 0 bị từ chối), ngày theo ba cách ghi, tệp CSV có BOM và ngoặc kép, mã hóa đơn trong diễn giải, chuỗi VietQR đúng mã kiểm tra CRC | Kiểm thử tự động `apps/api/src/finance/bank-statement-import.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-223 | P06-06 | chưa có cấu hình cột thì nhập tệp trả 422 P06-06 | chưa có cấu hình cột thì nhập tệp trả 422 P06-06; quản lý đơn vị (VT-03) lưu cấu hình hoặc nhập tệp bị từ chối 403; cấu hình thiếu cột tiền ra trả 400; kế toán lưu được | Kiểm thử tự động `apps/api/src/finance/bank-statement-import.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-224 | P06-06 | nhập tệp CSV 8 dòng | nhập tệp CSV 8 dòng: 6 dòng ghi, 2 dòng lỗi (số tiền không đọc được, ngày sau hôm nay) báo đúng số dòng; khớp tự động 3 dòng, dòng có số phiếu PT trong diễn giải khớp đúng phiếu đó dù có phiếu khác cùng số tiền cùng ngày lập trước; 1 đề xuất lập phiếu thu; dòng 500 000 cho hóa đơn còn nợ 900 000 không có đề xuất; số dư tài khoản không đổi; nhập lại cùng tệp: 0 dòng ghi, 6 dòng trùng | Kiểm thử tự động `apps/api/src/finance/bank-statement-import.test.ts` đạt ngày 12/10/2026; Kiểm thử giao diện `tests/e2e/43-statement-import.spec.ts` đạt ngày 12/10/2026 | Đạt |
| CT-225 | P06-06 | nhập tệp Excel cấu hình một cột số tiền có dấu, ngày năm-tháng-ngày; dòng trùng số tham chiếu với dòng đã có bỏ qua; tệp thiếu cột đã cấu hình trả 400 | nhập tệp Excel cấu hình một cột số tiền có dấu, ngày năm-tháng-ngày; dòng trùng số tham chiếu với dòng đã có bỏ qua; tệp thiếu cột đã cấu hình trả 400 | Kiểm thử tự động `apps/api/src/finance/bank-statement-import.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-226 | P06-06 | quản lý đơn vị xác nhận đề xuất bị từ chối | quản lý đơn vị xác nhận đề xuất bị từ chối; kế toán xác nhận thì lập phiếu thu PT, dòng đã khớp, hóa đơn hết nợ, số dư tài khoản tăng đúng; xác nhận lần hai trả 409; dòng số tiền nhỏ hơn số còn nợ trả 422 BR-31; dòng gõ tay có mã hóa đơn được đề xuất, bỏ đề xuất được, bỏ lần hai trả 409 | Kiểm thử tự động `apps/api/src/finance/bank-statement-import.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-227 | P06-06 | cấu hình `bank_match_days` = 1 thì dòng lệch 2 ngày không khớp; bỏ cấu hình (mặc định 3) thì khớp | cấu hình `bank_match_days` = 1 thì dòng lệch 2 ngày không khớp; bỏ cấu hình (mặc định 3) thì khớp | Kiểm thử tự động `apps/api/src/finance/bank-statement-import.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-228 | P06-11 | máy chủ bật hai cổng (giả lập là mặc định, VietQR tĩnh) | máy chủ bật hai cổng (giả lập là mặc định, VietQR tĩnh); chọn VietQR tĩnh thiếu mã BIN, mã BIN sai, cổng chưa bật trả 400, kế toán đơn vị khác trả 403; mã QR của tài khoản chọn VietQR tĩnh là chuỗi EMVCo chứa mã BIN, số tài khoản thật, nội dung là mã hóa đơn bỏ gạch, CRC đúng; bỏ chọn thì về cổng giả lập, mã cũ bị hủy; điểm cuối giả lập vẫn chạy | Kiểm thử tự động `apps/api/src/finance/bank-statement-import.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-229 | P06-12 | Xem hệ thống tài khoản khởi tạo; kế toán đơn vị thêm tài khoản chi tiết; kế toán trưởng ở Trường chính thêm 1121 dưới 111, thêm 1111, thêm trùng; sửa tài khoản theo chế độ; đổi tên tài khoản chi tiết | Có 111, 131, 334, 3335, 421, 531, 642; giáo viên 403; kế toán đơn vị 403; sai cha 422; thêm 1111 được; trùng 409; sửa tài khoản theo chế độ 422 | Kiểm thử tự động `apps/api/src/ledger/ledger.test.ts` đạt ngày 12/10/2026; Kiểm thử giao diện `tests/e2e/42-ledger.spec.ts` đạt ngày 12/10/2026 | Đạt |
| CT-230 | P06-12 | Có hóa đơn 1 000 000, phiếu thu tiền mặt 600 000, miễn giảm 100 000, phiếu chi ngân hàng 200 000, đảo phiếu thu 50 000, bảng lương thu nhập 5 000 000 khấu trừ 500 000 thuế 100 000; ghi sổ chứng từ hai lần; xem bảng cân đối của đơn vị và đơn vị khác | Lần đầu 6 bút toán đúng quy tắc mặc định, lần hai 0; mọi bút toán cân; 131 dư Nợ 350 000, 111 dư Nợ 550 000, 112 dư Có 200 000, 334 dư Có 4 400 000; sổ cân; đơn vị khác không có số liệu; kế toán đơn vị khác 403 | Kiểm thử tự động `apps/api/src/ledger/ledger.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-231 | P06-12 | Sửa quy tắc phiếu chi điền phía tiền; quy tắc theo khoản mục cho hóa đơn; kế toán đơn vị sửa quy tắc; kế toán trưởng đặt phiếu thu khoản mục tài trợ Có 3371 và tiền mặt 1111; phiếu thu mới 300 000; ngừng dùng 1111; bỏ quy tắc chung và quy tắc theo khoản mục | 400, 400, 403; bút toán mới Nợ 1111 / Có 3371, bút toán cũ không đổi; ngừng dùng 422; bỏ quy tắc chung 422, theo khoản mục 200 | Kiểm thử tự động `apps/api/src/ledger/ledger.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-232 | P06-12 | Ghi bút toán thủ công lệch, dòng ghi hai phía, ngày mai, đơn vị ngoài phạm vi, bút toán đúng, gửi lại cùng mã yêu cầu; hủy không lý do, có lý do, hủy lần hai; hủy bút toán tự động | 400, 400, 400, 403; ghi được 300 000; gửi lại trả cùng bút toán; 400; hủy được; 409; 409; bút toán đã hủy không vào bảng cân đối | Kiểm thử tự động `apps/api/src/ledger/ledger.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-233 | P06-12 | Ghi bút toán ngày tháng trước; chốt kỳ tháng trước; ghi thêm và hủy bút toán ngày thuộc kỳ | Trước chốt ghi được; sau chốt 422 mã BR-95 cho cả ghi và hủy | Kiểm thử tự động `apps/api/src/ledger/ledger.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-234 | P06-12 | Xem sổ cái tài khoản 111 trong ngày; thiếu tài khoản; bảng cân đối toàn trường; kế toán xuất Excel bảng cân đối của đơn vị; kế toán đơn vị khác xuất sổ nhật ký chung của đơn vị | Gồm dòng 1111 đối ứng 3371 và dòng đối ứng 131; đầu kỳ dư Có 1 000 000, phát sinh Nợ 900 000, Có 50 000, cuối kỳ dư Có 150 000; thiếu tài khoản 400; toàn trường cân; tệp xlsx; 403 | Kiểm thử tự động `apps/api/src/ledger/ledger.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-235 | P06-12 | Mở năm học mới | Năm mới giữ tài khoản 1111 (cùng mã) và quy tắc tiền mặt 1111; bút toán số dư đầu năm của đơn vị cân, 131 dư Nợ 350 000, 3371 dư Có 300 000, không còn tài khoản loại 5–9, 421 dư Nợ 4 300 000; ngày bằng ngày bắt đầu năm học | Kiểm thử tự động `apps/api/src/ledger/ledger.test.ts` đạt ngày 12/10/2026 | Đạt |
| CT-236 | P19-06 | Gửi thành công | trả mã tin; yêu cầu gửi đúng địa chỉ, phương thức POST, đủ các trường, SmsType 2, số điện thoại dạng 84 | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-237 | P19-06 | eSMS.vn trả CodeResult khác 100 | báo lỗi kèm mã và nội dung lỗi | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-238 | P19-06 | eSMS.vn trả mã HTTP lỗi | báo lỗi | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-239 | P19-06 | Nội dung có dấu khi chưa bật ESMS_UNICODE | gửi nội dung đã bỏ dấu, gồm chữ đ, IsUnicode 0 | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-240 | P19-06 | Bật ESMS_UNICODE và ESMS_SANDBOX | giữ nguyên nội dung có dấu, IsUnicode 1, Sandbox 1 | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-241 | P19-06 | Số điện thoại các dạng 0..., +84..., 84... | chuẩn hóa về 84...; số sai dạng báo lỗi và không gọi eSMS.vn | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-242 | P19-06 | eSMS.vn không phản hồi trong thời hạn | hủy yêu cầu, báo lỗi quá thời hạn | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-243 | P19-06 | SMS_PROVIDER=esms mà thiếu ESMS_API_KEY, ESMS_SECRET_KEY hoặc ESMS_BRANDNAME | báo lỗi nêu tên biến thiếu | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-244 | P19-06 | SMS_PROVIDER=esms đủ biến ở môi trường chạy thật | đọc được cấu hình eSMS.vn | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-245 | P19-06 | Không đặt SMS_PROVIDER | mặc định log khi phát triển; ở môi trường chạy thật thì dừng; nhà cung cấp lạ thì báo chưa hỗ trợ | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-246 | P19-06 | Dịch vụ định danh với SMS_PROVIDER=esms | dùng lớp gửi eSMS.vn; mặc định dùng lớp ghi nhật ký | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-247 | P19-06 | Dịch vụ định danh gửi mã đăng nhập qua eSMS.vn | gửi nội dung bỏ dấu; eSMS.vn trả lỗi thì luồng gửi nhận lỗi | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-248 | P19-06 | Máy chủ API với SMS_PROVIDER=esms | dùng lớp gửi eSMS.vn; chưa cấu hình hoặc log thì ghi nhật ký | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-249 | P19-06 | Máy chủ API gửi thông báo có dấu qua eSMS.vn | giữ nội dung có dấu khi bật ESMS_UNICODE; eSMS.vn trả lỗi thì tiến trình gửi nhận lỗi | Kiểm thử tự động `packages/server/src/esms-client.test.ts`, `apps/identity/src/messaging/sms-sender.test.ts`, `apps/api/src/notifications/sms-gateway.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-250 | P06-11 | PayOS tạo mã thanh toán với fetch giả lập | gửi đúng địa chỉ, tiêu đề x-client-id, x-api-key, mã đơn là số nguyên dương an toàn, chữ ký HMAC-SHA256 của `amount&cancelUrl&description&orderCode&returnUrl`; trả chuỗi VietQR và tài khoản nhận của PayOS | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-251 | P06-11 | PayOS trả mã lỗi hoặc không kết nối được | báo lỗi quy tắc P06-11 | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-252 | P06-11 | thông báo PayOS đúng chữ ký | thành giao dịch tiền vào (mã `payos-<reference>`, giờ giao dịch theo giờ Việt Nam); sửa số tiền hoặc thiếu chữ ký bị từ chối; giao dịch không thành công bị bỏ qua | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-253 | P06-11 | SePay dựng VietQR tới tài khoản trường có số tiền và nội dung; thông báo đúng khóa thành giao dịch tiền vào; thiếu khóa, sai khóa, sai kiểu tiêu đề bị từ chối; giao dịch tiền ra bị bỏ qua | SePay dựng VietQR tới tài khoản trường có số tiền và nội dung; thông báo đúng khóa thành giao dịch tiền vào; thiếu khóa, sai khóa, sai kiểu tiêu đề bị từ chối; giao dịch tiền ra bị bỏ qua | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-254 | P06-11 | Casso kiểm chữ ký HMAC-SHA512 khớp bộ dữ liệu mẫu chính thức; thông báo đúng thành giao dịch; sửa dữ liệu hoặc thiếu chữ ký bị từ chối; dữ liệu dạng mảng chỉ lấy giao dịch tiền vào; nội dung có dấu ký kiểu \uXXXX cũng được nhận | Casso kiểm chữ ký HMAC-SHA512 khớp bộ dữ liệu mẫu chính thức; thông báo đúng thành giao dịch; sửa dữ liệu hoặc thiếu chữ ký bị từ chối; dữ liệu dạng mảng chỉ lấy giao dịch tiền vào; nội dung có dấu ký kiểu \uXXXX cũng được nhận | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-255 | P06-11 | VNPay dựng địa chỉ thanh toán | số tiền nhân 100, nội dung là mã hóa đơn bỏ gạch, giờ tạo và giờ hết hạn (sau 15 phút) theo giờ Việt Nam, tham số xếp theo tên và mã hóa khoảng trắng thành dấu cộng, chữ ký HMAC-SHA512 đúng | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-256 | P06-11 | IPN VNPay đúng chữ ký (chữ ký viết hoa vẫn nhận) thành giao dịch tiền vào; sửa tham số thì báo sai chữ ký; thanh toán không thành công không tạo giao dịch | IPN VNPay đúng chữ ký (chữ ký viết hoa vẫn nhận) thành giao dịch tiền vào; sửa tham số thì báo sai chữ ký; thanh toán không thành công không tạo giao dịch | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-257 | P06-11 | bật cổng mà thiếu biến môi trường thì dừng khởi động và liệt kê biến thiếu; đủ biến thì tạo được cổng của cả bốn mã | bật cổng mà thiếu biến môi trường thì dừng khởi động và liệt kê biến thiếu; đủ biến thì tạo được cổng của cả bốn mã | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-258 | P06-11 | điểm cuối PayOS không cần mã phiên | sai chữ ký trả 401 và không ghi giao dịch; đúng chữ ký thì tự lập phiếu thu, hóa đơn hết nợ; gửi lại không lập phiếu thu thứ hai; mã đơn không có yêu cầu thanh toán (dữ liệu thử) vẫn ghi và vào danh sách chờ; giao dịch có code khác 00 hoặc success false bị bỏ qua | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-259 | P06-11 | điểm cuối SePay | thiếu hoặc sai khóa trả 401; đúng khóa thì tự lập phiếu thu, hóa đơn hết nợ; tiền ra bỏ qua; điểm cuối Casso khi chưa bật cổng trả 404 | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-260 | P06-11 | IPN VNPay qua máy chủ | sai chữ ký 97, đơn lạ 01, sai số tiền 04, đúng thì 00 và tự lập phiếu thu, gửi lại 02 | Kiểm thử tự động `apps/api/src/finance/payment-providers.test.ts`, `apps/api/src/finance/online-payments.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-261 | P14-08 | Kho khóa trống, gửi một tin Zalo | máy chủ làm mới bằng `ZALO_OA_REFRESH_TOKEN`, lưu khóa truy cập và khóa làm mới mới ở dạng mã hóa, hạn bằng thời điểm làm mới cộng `expires_in`. Lần gửi tiếp theo dùng lại khóa. Khi khóa còn dưới 5 phút, máy chủ làm mới bằng khóa làm mới mới nhất. Sau khi tiến trình khởi động lại, máy chủ dùng khóa đã lưu | Kiểm thử tự động `apps/api/src/integrations/external-connections.test.ts`, `apps/api/src/integrations/integrations.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-262 | P14-08 | Tám tin gửi đồng thời từ hai tiến trình khi chưa có khóa truy cập | Zalo chỉ nhận một lần làm mới, cả tám tin dùng chung khóa mới | Kiểm thử tự động `apps/api/src/integrations/external-connections.test.ts`, `apps/api/src/integrations/integrations.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-263 | P14-08 | Zalo báo -216 với khóa đang dùng | máy chủ làm mới rồi gửi lại thành công bằng khóa mới. Nếu khóa mới vẫn bị từ chối, máy chủ dừng sau một lần thử lại và báo "Khóa truy cập Zalo không hợp lệ hoặc đã hết hạn (mã -216)" | Kiểm thử tự động `apps/api/src/integrations/external-connections.test.ts`, `apps/api/src/integrations/integrations.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-264 | P14-08 | Tin bị Zalo từ chối với mã -230 | máy chủ báo lỗi tiếng Việt về thời hạn tương tác. Khóa làm mới sai báo "Zalo từ chối làm mới khóa … nhập khóa làm mới mới". Chưa có khóa làm mới thì báo "Chưa có khóa làm mới Zalo" | Kiểm thử tự động `apps/api/src/integrations/external-connections.test.ts`, `apps/api/src/integrations/integrations.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-265 | P14-08 | Người quản trị dán khóa làm mới khi kho trống | dòng khóa được tạo, kiểm tra kết nối trả tên Official Account. Khi dán lại khóa, khóa truy cập cũ bị bỏ và mã dòng giữ nguyên | Kiểm thử tự động `apps/api/src/integrations/external-connections.test.ts`, `apps/api/src/integrations/integrations.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-266 | P14-08 | Facebook đăng bài không hình | máy chủ chỉ gọi `/v21.0/{page_id}/feed` với nội dung, không có `attached_media`. Bài có hình: máy chủ tải hình rồi đăng kèm hình. Kiểm tra kết nối gọi `?fields=id,name` với khóa ở tiêu đề và trả tên trang. Lỗi 190 báo khóa không hợp lệ hoặc hết hạn | Kiểm thử tự động `apps/api/src/integrations/external-connections.test.ts`, `apps/api/src/integrations/integrations.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-267 | P14-08 | `ZALO_SENDER=zalo_oa` thiếu `ZALO_APP_SECRET` và `ZALO_OA_REFRESH_TOKEN`, hoặc `FACEBOOK_PUBLISHER=graph` thiếu khóa, hoặc `FACEBOOK_GRAPH_VERSION` sai dạng | máy chủ không khởi động và báo tên biến thiếu hoặc sai | Kiểm thử tự động `apps/api/src/integrations/external-connections.test.ts`, `apps/api/src/integrations/integrations.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-268 | P14-08 | VT-02 kiểm tra kết nối Fanpage, Zalo và thay khóa làm mới thành công. VT-03, VT-04, VT-07, VT-14 nhận 403. Facebook lỗi trả 422 kèm lời báo. Khóa có khoảng trắng trả 400. Khóa không xuất hiện trong phản hồi, trong danh sách kết nối hay trong nhật ký. Cơ sở dữ liệu hệ thống chỉ lưu bản mã và ghi người thay | VT-02 kiểm tra kết nối Fanpage, Zalo và thay khóa làm mới thành công. VT-03, VT-04, VT-07, VT-14 nhận 403. Facebook lỗi trả 422 kèm lời báo. Khóa có khoảng trắng trả 400. Khóa không xuất hiện trong phản hồi, trong danh sách kết nối hay trong nhật ký. Cơ sở dữ liệu hệ thống chỉ lưu bản mã và ghi người thay | Kiểm thử tự động `apps/api/src/integrations/external-connections.test.ts`, `apps/api/src/integrations/integrations.test.ts` đạt ngày 13/10/2026 | Đạt |
| CT-269 | XT-04 | Dựng ba ảnh và khởi động bộ Compose của môi trường chạy thật trên máy cục bộ | mọi dịch vụ healthy, migrate chạy hết tệp thay đổi cấu trúc rồi thoát mã 0, chỉ dịch vụ web mở cổng | Dựng thử bộ Compose của môi trường chạy thật trên máy cục bộ (Docker Desktop) đạt ngày 13/10/2026; `apps/identity/src/trust-proxy.test.ts` đạt | Đạt |
| CT-270 | XT-04 | Gọi qua Caddy trên bốn tên miền | kiểm tra sức khỏe trả 200, ba giao diện trả trang ứng dụng kể cả đường dẫn lạ, trang gốc của tên miền API trả 404, API đối tác không khóa trả 401 | Dựng thử bộ Compose của môi trường chạy thật trên máy cục bộ (Docker Desktop) đạt ngày 13/10/2026; `apps/identity/src/trust-proxy.test.ts` đạt | Đạt |
| CT-271 | XT-04 | Đăng nhập cổng quản trị qua Caddy | cookie mã làm mới có HttpOnly, Secure, SameSite=Strict, đường dẫn /api/v1/auth; làm mới phiên bằng cookie trả 200 | Dựng thử bộ Compose của môi trường chạy thật trên máy cục bộ (Docker Desktop) đạt ngày 13/10/2026; `apps/identity/src/trust-proxy.test.ts` đạt | Đạt |
| CT-272 | XT-04 | Đặt TRUST_PROXY sau Caddy | phiên đăng nhập ghi địa chỉ máy khách, không ghi địa chỉ của Caddy; X-Forwarded-For giả do máy khách gửi bị ghi đè | Dựng thử bộ Compose của môi trường chạy thật trên máy cục bộ (Docker Desktop) đạt ngày 13/10/2026; `apps/identity/src/trust-proxy.test.ts` đạt | Đạt |
| CT-273 | XT-04 | Sao lưu hằng ngày và hằng giờ | mã hóa, đọc lại được ngay sau khi ghi, chép năm học đã đóng vào lưu trữ, đẩy sang kho ngoài máy chủ | Dựng thử bộ Compose của môi trường chạy thật trên máy cục bộ (Docker Desktop) đạt ngày 13/10/2026; `apps/identity/src/trust-proxy.test.ts` đạt | Đạt |
| CT-274 | XT-04 | Xóa dữ liệu, phiên, tệp và xóa hẳn cơ sở dữ liệu năm học đã đóng rồi khôi phục | đủ bốn cơ sở dữ liệu và tệp trong 49 giây, năm học đã đóng giữ chỉ đọc, đăng nhập lại được | Dựng thử bộ Compose của môi trường chạy thật trên máy cục bộ (Docker Desktop) đạt ngày 13/10/2026; `apps/identity/src/trust-proxy.test.ts` đạt | Đạt |

Ca CT-105 đến CT-274 lần lượt kiểm tra AC-149 đến AC-318.

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
