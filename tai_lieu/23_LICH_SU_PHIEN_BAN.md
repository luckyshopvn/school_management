# 23. LỊCH SỬ PHIÊN BẢN

- Mô tả: Mã phiên bản, ngày phát hành, danh sách thay đổi, chức năng mới, lỗi đã sửa, thay đổi dữ liệu, thay đổi API, rủi ro, khả năng tương thích, phương án quay lui.
- Phiên bản: 0.4
- Ngày cập nhật: 2026-10-11
- Trạng thái: Đang cập nhật
- Đã rà duyệt: Eric, ngày 2026-10-09

## 1. Quy ước

1. Mỗi phiên bản phát hành ghi một mục, xếp mới nhất lên đầu.
2. Mỗi mục ghi rõ: mã phiên bản, ngày phát hành, phạm vi thay đổi, chức năng mới, lỗi đã sửa, thay đổi dữ liệu, thay đổi API, rủi ro, khả năng tương thích và phương án quay lui.
3. Phiên bản đánh số theo dạng chính.phụ.sửa. Tăng số chính khi thay đổi phá vỡ tương thích, tăng số phụ khi thêm chức năng, tăng số sửa khi sửa lỗi.
4. Chưa có phiên bản phần mềm nào được phát hành. Các mục dưới đây ghi các mốc của bộ tài liệu thiết kế.
5. Từ phiên bản 0.4.0, mỗi mục ghi theo mẫu của Vibecoding_Flow; các mục trước giữ nguyên dạng bảng và tên tệp cũ vì là ghi nhận lịch sử.

## 2. Danh sách phiên bản

### Phiên bản 0.29.7 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6c-2, phiếu chi lương, quyết toán, thu hồi lương, điều chỉnh kỳ sau (YCTD-61).
- Chức năng mới: phiếu chi lương từ bảng lương và bảng quyết toán; bảng quyết toán khi chấm dứt hợp đồng; phiếu thu thu hồi lương không gắn trẻ; khoản điều chỉnh lương kỳ sau.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `payroll_settlements`, `payroll_adjustments`; cột liên kết ở `payments`, `receipts`; `receipts.child_id` được trống.
- Thay đổi API: nhóm điểm cuối quyết toán, điều chỉnh, phiếu chi lương.
- Rủi ro: phiếu thu không gắn trẻ chưa đảo được bằng chức năng đảo phiếu thu.
- Khả năng tương thích: phiếu thu cũ đều gắn trẻ, không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6c-2`; chạy ngược tệp thay đổi cấu trúc 0023 của cơ sở dữ liệu năm học.

### Phiên bản 0.29.6 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6c-1, danh mục lương, biểu thuế, bảng lương toàn trường, phiếu lương (YCTD-60).
- Chức năng mới: danh mục phụ cấp, thưởng, khấu trừ; khoản gán cho nhân sự; biểu thuế thu nhập cá nhân; tính bảng lương trả trước kèm điều chỉnh; trình, duyệt theo hạn mức, trả lại; phiếu lương của tôi.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: sáu bảng tiền lương, `staff.dependents_count`; sáu mã quyền P08; cấu hình `overtime_rate_percent`.
- Thay đổi API: nhóm điểm cuối danh mục lương, biểu thuế, bảng lương, phiếu lương.
- Rủi ro: biểu thuế có sẵn phải được kế toán trưởng cập nhật khi luật thay đổi.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6c-1`; chạy ngược tệp thay đổi cấu trúc 0022 của cơ sở dữ liệu năm học và 0026 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.5 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6b-2, phép năm, đơn nghỉ phép, chốt và mở lại bảng công (YCTD-59).
- Chức năng mới: quy định phép năm theo chức danh và thâm niên; số ngày phép năm; đơn nghỉ tự gửi hoặc lập hộ, duyệt, từ chối, hủy; chốt bảng công; đề nghị và duyệt mở lại kỳ công.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: sáu bảng phép năm, đơn nghỉ, bảng công; ba mã quyền P08.
- Thay đổi API: nhóm điểm cuối phép năm, đơn nghỉ, kỳ công.
- Rủi ro: kỳ đã chốt chặn sửa chấm công và đơn nghỉ của tháng đó.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6b-2`; chạy ngược tệp thay đổi cấu trúc 0021 của cơ sở dữ liệu năm học và 0025 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.4 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6b-1, ngày lễ, lịch học bù và nghỉ bù, chấm công (YCTD-59).
- Chức năng mới: ngày nghỉ lễ, ngày học bù thứ bảy, ngày nghỉ bù; nhân sự tự vào ca, ra ca; phòng nhân sự nhập, sửa giờ; bảng chấm công theo tháng; cấu hình giờ làm; thuộc tính tính công của loại nghỉ.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `holidays`, `school_day_changes`, `attendance_logs`, `catalog_items.attributes`; bốn mã quyền P08; ba mục cấu hình giờ làm.
- Thay đổi API: nhóm điểm cuối ngày lễ, lịch bù, chấm công; danh mục dùng chung nhận `attributes`.
- Rủi ro: ngày lễ, nghỉ bù, học bù đổi ngày học khi điểm danh và tính học phí; chỉ lập được cho ngày từ ngày mai.
- Khả năng tương thích: chưa lập lịch thì ngày học không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6b`; chạy ngược tệp thay đổi cấu trúc 0020 của cơ sở dữ liệu năm học và 0024 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.3 – 2026-10-10

- Phạm vi thay đổi: DT-06 phần 6a, hồ sơ nhân sự và hợp đồng lao động (YCTD-58).
- Chức năng mới: hồ sơ nhân sự, liên kết tài khoản có sẵn, hợp đồng lao động, chấm dứt hợp đồng khóa tài khoản, cảnh báo hợp đồng sắp hết hạn, nhập nhân sự từ Excel.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `staff`, `employment_contracts`; mã quyền `P07.staff.manage`, `P07.staff.view`, `P07.contract.view`, `P01.import.staff`; cấu hình `contract_expiry_warning_days`.
- Thay đổi API: nhóm điểm cuối nhân sự và hợp đồng; hai điểm cuối mới ở dịch vụ định danh.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6a`; chạy ngược tệp thay đổi cấu trúc 0019 của cơ sở dữ liệu năm học và 0023 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.2 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5f, thanh toán trực tuyến bằng mã QR (YCTD-57).
- Chức năng mới: tài khoản ảo và mã QR dùng một lần theo hóa đơn; đối chiếu giao dịch tiền vào tự lập phiếu thu; danh sách giao dịch chờ kế toán xử lý; phụ huynh thanh toán bằng mã QR.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `payment_requests`, `online_payment_transactions`; `cash_accounts` thêm tài khoản nhận thanh toán trực tuyến.
- Thay đổi API: mã QR của hóa đơn, cấu hình tài khoản nhận, giao dịch chuyển khoản và xử lý, điểm cuối giả lập.
- Rủi ro: chưa nối nhà cung cấp thật; ở môi trường chạy thật không đặt `PAYMENT_GATEWAY` thì phụ huynh nhận thông báo chưa nối.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5f`; chạy ngược tệp thay đổi cấu trúc 0018 của cơ sở dữ liệu năm học.

### Phiên bản 0.29.1 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5e-2, phiếu đảo phiếu chi (YCTD-56).
- Chức năng mới: lập phiếu đảo phiếu chi kèm lý do; Ban Giám hiệu duyệt theo hạn mức; hoàn lại nguồn chi và số dư có khi đảo phiếu hoàn tiền.
- Lỗi đã sửa: kiểm thử giao diện phiếu chi không còn phụ thuộc việc đơn vị chưa đặt hạn mức.
- Thay đổi dữ liệu: `payment_reversals`; mã quyền `P06.payment-reversal.create`.
- Thay đổi API: điểm cuối đảo phiếu chi, phiếu đảo phiếu chi chờ duyệt.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5e2`; chạy ngược tệp thay đổi cấu trúc 0017 của cơ sở dữ liệu năm học và 0022 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.0 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5e-1, phiếu chi và sổ quỹ (YCTD-55).
- Chức năng mới: phiếu chi kèm chứng từ, trình duyệt, Ban Giám hiệu duyệt theo hạn mức thì phát hành và trừ nguồn chi; phiếu chi hoàn tiền thôi học trừ số dư có của trẻ; sổ quỹ theo khoảng ngày.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `payments`, `payment_attachments`, `payment_refund_sources`; tệp mục đích `payment_voucher`; mã quyền `P06.payment.manage`, `P06.payment.approve`; mặc định của `bank_balance_check` là bật.
- Thay đổi API: nhóm điểm cuối phiếu chi, `GET /cash-books`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5e`; chạy ngược tệp thay đổi cấu trúc 0016 của cơ sở dữ liệu năm học và 0021 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.9 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5d-2, đảo phiếu thu và nhập công nợ đầu kỳ (YCTD-54).
- Chức năng mới: lập phiếu đảo phiếu thu, Ban Giám hiệu duyệt theo hạn mức; nhập công nợ đầu kỳ từ Excel thành hóa đơn đầu kỳ.
- Lỗi đã sửa: mục điều hướng "Quỹ và tài khoản" trùng với mục "Tài khoản", đổi thành "Quỹ và ngân hàng".
- Thay đổi dữ liệu: `receipt_reversals`; loại hóa đơn, loại dòng khoản và loại lần nhập thêm đầu kỳ; mã quyền `P06.receipt-reversal.create`, `P06.receipt-reversal.approve`, `P05.opening-debt.import`.
- Thay đổi API: điểm cuối đảo phiếu thu, phiếu đảo chờ duyệt; nhập dữ liệu nhận loại `opening_debts`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5d2`; chạy ngược tệp thay đổi cấu trúc 0015 của cơ sở dữ liệu năm học và 0020 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.8 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5d-1, phiếu thu, phân bổ, quỹ và công nợ phải thu (YCTD-53).
- Chức năng mới: khai báo quỹ tiền mặt và tài khoản ngân hàng; lập phiếu thu và phân bổ vào hóa đơn, số dư có; công nợ theo đơn vị và theo trẻ; màn hình Công nợ, Phiếu thu, Quỹ và ngân hàng; phụ huynh xem số còn phải nộp và lịch sử đã nộp.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `cash_accounts`, `receipts`, `receipt_allocations`, `account_transactions`; mã quyền `P06.receipt.manage`, `P06.cash-account.manage`, `P05.debt.view`.
- Thay đổi API: nhóm điểm cuối phiếu thu, quỹ và tài khoản, công nợ; hóa đơn thêm số đã thu và còn phải nộp; bỏ `POST /receipts/{id}/issue`.
- Rủi ro: không.
- Khả năng tương thích: miễn giảm và điều chỉnh giảm bị chặn khi vượt số còn phải nộp của hóa đơn đã thu.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5d1`; chạy ngược tệp thay đổi cấu trúc 0014 của cơ sở dữ liệu năm học và 0019 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.7 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5c-2, miễn giảm và phiếu điều chỉnh hóa đơn (YCTD-52).
- Chức năng mới: lập miễn giảm trên hóa đơn nháp và đã phát hành, chép miễn giảm kỳ trước; phiếu điều chỉnh tăng, giảm; Ban Giám hiệu duyệt theo hạn mức; số phải nộp trên hóa đơn; màn hình duyệt MH-07.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `discounts`, `invoice_adjustments`; mã quyền `P05.discount.manage`, `P05.invoice-adjustment.create`, `P05.fee-document.approve`.
- Thay đổi API: nhóm điểm cuối miễn giảm, phiếu điều chỉnh, chờ duyệt; hóa đơn thêm số phải nộp.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5c2`; chạy ngược tệp thay đổi cấu trúc 0013 của cơ sở dữ liệu năm học và 0018 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.6 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5c-1, tính học phí và phát hành hóa đơn (YCTD-51).
- Chức năng mới: tính học phí kỳ theo đơn vị; hóa đơn nháp kèm dòng cần kiểm tra; phát hành hóa đơn chính và bổ sung; xem hóa đơn trên cổng quản trị và ứng dụng phụ huynh; chặn đăng ký thêm khi nợ quá hạn.
- Lỗi đã sửa: phụ huynh xem được bảng đăng ký dịch vụ của cả đơn vị.
- Thay đổi dữ liệu: `fee_calculation_runs`, `invoices`, `invoice_items`, `document_sequences`; mã quyền `P05.fee-calculation.manage`.
- Thay đổi API: nhóm điểm cuối tính học phí và hóa đơn.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ ngoài sửa lỗi phân quyền.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5c1`; chạy ngược tệp thay đổi cấu trúc 0012 của cơ sở dữ liệu năm học và 0017 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.5 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5b, đăng ký dịch vụ và học hè (YCTD-50).
- Chức năng mới: đăng ký dịch vụ theo tháng tự giữ tới khi hủy; đăng ký và hủy sau ngày chốt chờ Ban Giám hiệu duyệt; chốt danh sách kỳ; đăng ký học hè; điểm danh ngày hè; màn hình MH-05, MP-12.
- Lỗi đã sửa: kiểm thử hồ sơ trẻ thất bại ngẫu nhiên do tên trùng; ứng dụng phụ huynh và ứng dụng giáo viên hiển thị nhầm dữ liệu của tháng hoặc ngày cũ khi kết quả tải về không theo thứ tự.
- Thay đổi dữ liệu: `service_registrations`, `registration_periods`, `summer_registrations`; cấu hình `service_registration_closing_day`; mã quyền `P05.registration.manage`, `P05.late-registration.approve`.
- Thay đổi API: nhóm điểm cuối đăng ký dịch vụ và học hè; bảng điểm danh ngày hè có dữ liệu.
- Rủi ro: không.
- Khả năng tương thích: ngày kỳ hè có bảng điểm danh cho trẻ đăng ký học hè; chức năng khác không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5b`; chạy ngược tệp thay đổi cấu trúc 0011 của cơ sở dữ liệu năm học và 0016 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.4 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5a, danh mục học phí và tài chính (YCTD-49).
- Chức năng mới: danh mục dịch vụ có bán trú tạo sẵn; biểu phí theo phiên bản; loại miễn giảm; khoản mục thu chi; màn hình MH-04, MH-39.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `services`, `fee_schedules`, `fee_schedule_items`, `discount_types`, `cashflow_categories`; mã quyền `P05.fee-catalog.manage`, `P05.discount-type.manage`, `P06.cashflow-category.manage`.
- Thay đổi API: nhóm điểm cuối dịch vụ, biểu phí, loại miễn giảm, khoản mục thu chi.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5a`; chạy ngược tệp thay đổi cấu trúc 0010 của cơ sở dữ liệu năm học và 0015 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.3 – 2026-10-10

- Phạm vi thay đổi: DT-04 phần 4b, người được ủy quyền đón trẻ và đón trả (YCTD-48).
- Chức năng mới: khai báo, hủy người được ủy quyền trên ứng dụng phụ huynh và cổng quản trị; giáo viên chủ nhiệm bàn giao trẻ kèm ảnh tùy chọn; phụ huynh xác nhận người đón ngoài danh sách; bảo vệ xác nhận người đón tại cổng.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `authorized_pickups`, `pickup_confirmation_requests`, `pickup_records`; tệp mục đích `pickup_photo`; mã quyền `P02.authorized-pickup.manage`, `P04.pickup.gate-confirm`.
- Thay đổi API: nhóm điểm cuối đón trả; `POST /files` nhận ảnh bàn giao.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-04-phan-4b`; chạy ngược tệp thay đổi cấu trúc 0009 của cơ sở dữ liệu năm học và 0014 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.2 – 2026-10-10

- Phạm vi thay đổi: DT-04 phần 4a, điểm danh, chốt ngày, báo vắng (YCTD-47).
- Chức năng mới: bảng điểm danh theo ngày học; lưu chống trùng và lưu tạm khi mất mạng; chốt ngày, sửa sau khi chốt, mở lại; báo vắng nhiều ngày; ứng dụng giáo viên; màn hình báo vắng và điểm danh trong ứng dụng phụ huynh; màn hình Điểm danh trên cổng quản trị.
- Lỗi đã sửa: kiểm thử các tệp chạy song song làm hỏng cấu hình dùng chung (yêu cầu gộp số 14).
- Thay đổi dữ liệu: `attendance_records`, `attendance_days`, `absence_records`; người nhận thông báo theo vai trò; mục cấu hình `school_start_time`; mã quyền `P04.attendance.manage`.
- Thay đổi API: nhóm điểm cuối điểm danh và báo vắng.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-04-phan-4a`; chạy ngược tệp thay đổi cấu trúc 0008 của cơ sở dữ liệu năm học và 0013 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.1 – 2026-10-10

- Phạm vi thay đổi: DT-03 phần 3c, nhập dữ liệu ban đầu và mã định danh ngành (YCTD-46).
- Chức năng mới: tải mẫu Excel; nhập lớp; nhập trẻ kèm phụ huynh vào thẳng trạng thái đang học; nhập mã ngành; bộ lọc và bổ sung giấy khai sinh; màn hình Nhập dữ liệu.
- Lỗi đã sửa: tệp tải lên vượt dung lượng trả lỗi hệ thống thay vì lỗi dữ liệu.
- Thay đổi dữ liệu: bảng `data_import_jobs`; `children.birth_certificate_file_id` cho phép trống; mã quyền `P01.import.children`.
- Thay đổi API: nhóm điểm cuối `/imports`; bộ lọc `missing_birth_certificate`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-03-phan-3c`; chạy ngược tệp thay đổi cấu trúc 0007 của cơ sở dữ liệu năm học và 0012 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.0 – 2026-10-10

- Phạm vi thay đổi: DT-03 phần 3b, hồ sơ trẻ từ lúc tiếp nhận đến khi vào lớp (YCTD-45).
- Chức năng mới: lập hồ sơ trẻ, phụ huynh, sức khỏe cơ bản, cờ trẻ con nhân viên, đồng ý hình ảnh; gửi trình duyệt, duyệt và phân lớp, từ chối; tạo tài khoản phụ huynh khi duyệt; chuyển lớp; xem đầy đủ số định danh có ghi nhật ký; tải giấy khai sinh; màn hình Hồ sơ trẻ.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười bảng mới ở cơ sở dữ liệu năm học; mã quyền `P02.child.manage`, `P02.national-id.view`.
- Thay đổi API: nhóm điểm cuối hồ sơ trẻ và tệp; `GET /classes/{id}/children`; `POST /users/guardian-accounts`; danh sách lớp trả thêm `enrolled_count`.
- Rủi ro: hai khóa mã hóa số định danh phải được sao lưu cùng cơ sở dữ liệu; mất khóa thì không giải mã được.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-03-phan-3b`; chạy ngược tệp thay đổi cấu trúc 0006 của cơ sở dữ liệu năm học và 0011 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.9 – 2026-10-10

- Phạm vi thay đổi: DT-03 phần 3a, lớp học và phân công giáo viên (YCTD-44).
- Chức năng mới: tạo, sửa, đóng, mở lại lớp; phân công và kết thúc phân công giáo viên chủ nhiệm, bộ môn; lớp của tôi; màn hình Lớp học.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `classes`, `class_staff_assignments`; mã quyền `P02.class.manage`.
- Thay đổi API: `GET`, `POST /classes`; `PATCH /classes/{id}`; `GET`, `POST /classes/{id}/staff-assignments`; `PATCH /classes/{id}/staff-assignments/{assignmentId}`; `GET /users/directory`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-03-phan-3a`; chạy ngược tệp thay đổi cấu trúc 0005 của cơ sở dữ liệu năm học và 0010 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.8 – 2026-10-10

- Phạm vi thay đổi: DT-02, đăng nhập của phụ huynh (YCTD-43).
- Chức năng mới: mật khẩu mặc định chung của phụ huynh; đăng nhập bằng mã một lần; kích hoạt tài khoản; ứng dụng phụ huynh có màn hình đăng nhập, đặt mật khẩu mới, trang chủ tạm.
- Lỗi đã sửa: ba kênh dùng chung một cookie mã làm mới.
- Thay đổi dữ liệu: `users.password_hash` cho phép để trống; `sessions.login_method`; bảng `one_time_codes`; khóa mới trong `identity_settings`.
- Thay đổi API: thêm `POST /auth/otp/request`, `POST /auth/otp/login`; bỏ `POST /auth/activate`; mở rộng `/auth/settings`, `POST /users`, `refresh`.
- Rủi ro: chưa có nhà cung cấp tin nhắn nên mã một lần chưa gửi được thật.
- Khả năng tương thích: cổng quản trị giữ nguyên cookie và cách làm mới.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-02`; chạy ngược tệp thay đổi cấu trúc 0009 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.7 – 2026-10-10

- Phạm vi thay đổi: DT-01 phần 6b, các danh mục của P01 (YCTD-42).
- Chức năng mới: phòng ban dạng cây, chức danh, danh mục dùng chung, hạn mức phê duyệt theo đơn vị và loại chứng từ, phòng học, bậc học; màn hình MH-33, MH-34, MH-49, MH-50.
- Lỗi đã sửa: tài liệu 08 mục 5 thiếu phiếu đảo phiếu thu và phiếu đảo phiếu chi.
- Thay đổi dữ liệu: sáu bảng danh mục ở cơ sở dữ liệu năm học; mã quyền `P01.department.manage`, `P01.catalog.manage`, `P01.approval-threshold.manage`, `P01.room.manage`.
- Thay đổi API: điểm cuối phòng ban, chức danh, danh mục dùng chung, hạn mức phê duyệt, phòng học, bậc học.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-6b`; chạy ngược tệp thay đổi cấu trúc 0004 của cơ sở dữ liệu năm học và 0008 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.6 – 2026-10-09

- Phạm vi thay đổi: YCTD-41, ngày chốt học phí và ngày chốt công.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bỏ mục cấu hình `attendance_closing_day`; mặc định `tuition_closing_day` là `next_month_first`.
- Thay đổi API: `GET /settings` không còn mục ngày chốt công.
- Rủi ro: không.
- Khả năng tương thích: phần 6a chưa phát hành nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-41 và danh mục cấu hình về phiên bản trước.

### Phiên bản 0.27.5 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 6a, cấu hình theo đơn vị và nhật ký thao tác.
- Chức năng mới: cấu hình theo đơn vị có kế thừa; tra nhật ký thao tác; tự khóa tài khoản lâu không đăng nhập; màn hình Cấu hình, Nhật ký thao tác.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `settings`, `identity_settings`, cột `actor_name` ở hai bảng nhật ký; mã quyền `P01.setting.manage`.
- Thay đổi API: `GET`, `PUT /settings`; `GET /audit-logs`; `GET`, `PUT /auth/settings`; `GET /users/audit-logs`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-6a`; chạy ngược tệp thay đổi cấu trúc 0003 của cơ sở dữ liệu năm học và 0007 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.4 – 2026-10-09

- Phạm vi thay đổi: YCTD-40, cấu hình theo đơn vị và tự khóa tài khoản.
- Chức năng mới: không.
- Lỗi đã sửa: P01-08 chưa có giá trị mặc định, cách kế thừa và người sửa thống nhất với ma trận quyền.
- Thay đổi dữ liệu: `identity_settings`; mã quyền `P01.setting.manage`.
- Thay đổi API: không.
- Rủi ro: chức năng dùng cấu hình chưa có giá trị phải báo thiếu cấu hình.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-40 về phiên bản trước.

### Phiên bản 0.27.3 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 5, tài khoản, vai trò, quyền.
- Chức năng mới: quản lý tài khoản, mật khẩu tạm, gán và gỡ vai trò, ma trận quyền; màn hình Tài khoản và Vai trò và quyền.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `identity_audit_logs`; mã quyền `P01.account.manage-in-unit`.
- Thay đổi API: nhóm điểm cuối `users`, `roles`, `permissions`; thêm `DELETE /api/v1/users/{id}/roles/{assignmentId}`.
- Rủi ro: dịch vụ định danh gọi máy chủ API để đọc cây đơn vị khi quản lý tài khoản.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-5`; chạy ngược tệp thay đổi cấu trúc 0006 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.2 – 2026-10-09

- Phạm vi thay đổi: YCTD-39, phân quyền quản lý tài khoản.
- Chức năng mới: không.
- Lỗi đã sửa: P01-06 và ma trận quyền chưa thống nhất về VT-15.
- Thay đổi dữ liệu: `identity_audit_logs`; mã quyền `P01.account.manage-in-unit`.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-39 về phiên bản trước.

### Phiên bản 0.27.1 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 4, cây đơn vị hai cấp.
- Chức năng mới: quản lý cây đơn vị, nhật ký thao tác, lớp đơn vị của phân quyền, màn hình Cây đơn vị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `org_units`, `audit_logs` ở cơ sở dữ liệu năm học; mã quyền `P01.org-unit.manage`.
- Thay đổi API: nhóm điểm cuối `org-units`.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-4`; chạy ngược tệp thay đổi cấu trúc 0002 của cơ sở dữ liệu năm học và 0005 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-38, cây đơn vị hai cấp.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `org_units.unit_type` ba giá trị cố định.
- Thay đổi API: không thêm điểm cuối; quy tắc của `org-units` đổi theo cây hai cấp.
- Rủi ro: phạm vi quyền thu hẹp: gán ở Phân hiệu không còn gồm Điểm trường.
- Khả năng tương thích: chưa có mã cây đơn vị nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-38 về phiên bản trước.

### Phiên bản 0.26.6 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 3, năm học.
- Chức năng mới: tạo năm học, lịch năm học, đánh số tuần, tuần nghỉ, mở năm học mới; màn hình Năm học trên cổng quản trị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bốn bảng mới ở cơ sở dữ liệu hệ thống; mã quyền `P01.academic-year.manage`; cơ sở dữ liệu năm học do máy chủ API tạo.
- Thay đổi API: nhóm điểm cuối `academic-years`; phản hồi `ERR_RULE_VIOLATION` có `rule_code`.
- Rủi ro: mở năm học tạo cơ sở dữ liệu mới; lỗi giữa chừng thì xóa cơ sở dữ liệu vừa tạo và giữ nguyên năm đang dùng.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-3`; chạy ngược tệp thay đổi cấu trúc 0002 của cơ sở dữ liệu hệ thống và 0004 của cơ sở dữ liệu định danh.

### Phiên bản 0.26.5 – 2026-10-09

- Phạm vi thay đổi: YCTD-37, quy tắc mở và đóng năm học.
- Chức năng mới: không.
- Lỗi đã sửa: mâu thuẫn giữa AC-194, CB-10 và BR-89 về trạng thái năm cũ sau khi mở năm mới; `index.md` còn ghi BR-01 đến BR-85 trong khi đã có tới BR-92.
- Thay đổi dữ liệu: `academic_years.status` ba giá trị; mã quyền `P01.academic-year.manage`.
- Thay đổi API: bỏ `POST /api/v1/academic-years/{id}/close`.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-37 về phiên bản trước.

### Phiên bản 0.26.4 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 2.
- Chức năng mới: máy chủ API kiểm tra mã phiên và quyền; màn hình đăng nhập, đổi mật khẩu, khung trang của cổng quản trị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: `login`, `refresh`, `logout` dùng cookie `refresh_token`; mọi điểm cuối của máy chủ API trừ kiểm tra sức khỏe yêu cầu mã phiên.
- Rủi ro: máy chủ API phụ thuộc dịch vụ định danh ở mọi yêu cầu.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-2`.

### Phiên bản 0.26.3 – 2026-10-09

- Phạm vi thay đổi: YCTD-36, thiết kế DT-01 phần 2.
- Chức năng mới: không.
- Lỗi đã sửa: sơ đồ mục 1 của `14` ghi điều hướng ngang trái với BC-01; `14` thiếu màn hình đăng nhập và đổi mật khẩu.
- Thay đổi dữ liệu: không.
- Thay đổi API: mã làm mới chuyển sang cookie httpOnly.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-36 về phiên bản trước.

### Phiên bản 0.26.2 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 1, phần lõi dịch vụ định danh.
- Chức năng mới: đăng nhập bằng mật khẩu, làm mới phiên, đăng xuất, đổi mật khẩu, đọc tài khoản và quyền hiện hành; tạo tài khoản quản trị nền tảng đầu tiên bằng lệnh.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: cơ sở dữ liệu định danh có bảy bảng mới, 19 vai trò và 55 mã quyền.
- Thay đổi API: năm điểm cuối nhóm `auth`; `17` ghi giao kèo chi tiết.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-1`; chạy ngược tệp thay đổi cấu trúc 0003, 0002 của cơ sở dữ liệu định danh.

### Phiên bản 0.26.1 – 2026-10-09

- Phạm vi thay đổi: YCTD-35, chốt giá trị cho dịch vụ định danh.
- Chức năng mới: không.
- Lỗi đã sửa: BM-03, BM-04 chưa có giá trị cụ thể; chưa có quy ước mã quyền.
- Thay đổi dữ liệu: thêm `security_events`, `users.locked_until`.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-35 về phiên bản trước.

### Phiên bản 0.26.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-34, chia lại đợt DT-01 và DT-02; QĐ-20 đến QĐ-22.
- Chức năng mới: không.
- Lỗi đã sửa: DT-01 yêu cầu đăng nhập được trong khi dịch vụ định danh xếp ở đợt sau.
- Thay đổi dữ liệu: tài khoản `api_service` có quyền tạo cơ sở dữ liệu.
- Thay đổi API: không.
- Rủi ro: máy chủ API phụ thuộc dịch vụ định danh ở mọi yêu cầu; dịch vụ định danh dừng thì máy chủ API từ chối yêu cầu.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-34 về phiên bản trước.

### Phiên bản 0.25.5 – 2026-10-09

- Phạm vi thay đổi: hoàn thành đợt DT-00 (M01-3), qua cổng CG-08; mã nguồn gộp vào nhánh `main`.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: ba cơ sở dữ liệu định danh, hệ thống, năm học có tệp thay đổi cấu trúc đầu tiên đặt giờ Việt Nam.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của yêu cầu gộp số 1 trên `main`.

### Phiên bản 0.25.4 – 2026-10-09

- Phạm vi thay đổi: đợt DT-00, thêm điểm cuối kiểm tra sức khỏe.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `GET /api/v1/health` ở máy chủ API nghiệp vụ và dịch vụ định danh, không cần mã phiên.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục `17` về phiên bản 1.7.

### Phiên bản 0.25.3 – 2026-10-09

- Phạm vi thay đổi: YCTD-33, chọn Kysely và quy ước nhánh.
- Chức năng mới: không.
- Lỗi đã sửa: cây thư mục ở `13` thiếu `database/system/`; `packages/shared` ghi chứa hàm dùng chung, trái ranh giới giao diện và máy chủ.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-33 về phiên bản trước.

### Phiên bản 0.25.2 – 2026-10-09

- Phạm vi thay đổi: YCTD-32, chỉ dùng GitHub trước, hạ tầng đám mây khi triển khai.
- Chức năng mới: không.
- Lỗi đã sửa: mã M01-3 trong `03` mang nội dung khác `01`; thứ tự ưu tiên trong `03` còn các việc đã xong và một dòng trùng.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: RR-08 giữ nguyên, nghiệm thu vẫn cần hạ tầng T6.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-32 về phiên bản trước.

### Phiên bản 0.25.1 – 2026-10-09

- Phạm vi thay đổi: YCTD-31, bỏ xác thực hai lớp.
- Chức năng mới: không. Bỏ xác thực hai lớp cho bốn vai trò.
- Lỗi đã sửa: việc N1 ghi chưa bắt đầu dù đã chốt.
- Thay đổi dữ liệu: `one_time_codes.purpose` chỉ còn đăng nhập.
- Thay đổi API: bỏ `/api/v1/auth/verify-otp`.
- Rủi ro: RR-15, chiếm tài khoản vai trò phê duyệt khi lộ mật khẩu.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-31 về phiên bản trước.

### Phiên bản 0.25.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-30, lịch năm học có học kỳ, kỳ hè và tuần học.
- Chức năng mới: lịch năm học trong P01-02; P05-13 Đăng ký học hè.
- Lỗi đã sửa: năm học chỉ có ngày bắt đầu và kết thúc, không có học kỳ, tuần học; số phiếu theo năm tài chính không khớp cơ sở dữ liệu theo năm học.
- Thay đổi dữ liệu: thêm `academic_terms`, `school_weeks`, `summer_registrations`; `academic_years` chuyển sang cơ sở dữ liệu hệ thống.
- Thay đổi API: thêm ba điểm cuối theo YCTD-30.
- Rủi ro: lịch năm học cấu hình sai làm sai số ngày học và học phí; giảm bằng AC-228 đến AC-232.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-30 về phiên bản trước.

### Phiên bản 0.24.1 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 5, thêm `27_BO_CA_KIEM_THU_CHI_TIET/05_P08.md` với 59 ca.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 5.

### Phiên bản 0.24.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-29, đổi cách chi lương sang trả trước đầu tháng.
- Chức năng mới: bảng quyết toán cuối cùng khi chấm dứt hợp đồng; phiếu thu thu hồi lương.
- Lỗi đã sửa: AC-40 mâu thuẫn AC-115; BR-43 chưa có công thức ngày công.
- Thay đổi dữ liệu: `payroll_periods`, `payslips`, `receipts` thêm cột theo YCTD-29.
- Thay đổi API: thêm `/api/v1/payrolls/settlements`; `/api/v1/payrolls` đổi cách tính.
- Rủi ro: tính sai phần điều chỉnh tháng trước làm sai lương thực nhận; giảm bằng AC-224 đến AC-227 và bộ ca chi tiết P08.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-29 về phiên bản trước.

### Phiên bản 0.23.3 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 4, thêm `27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md` với 65 ca; YCTD-28.
- Chức năng mới: không.
- Lỗi đã sửa: P06-02 thiếu thủ quỹ trong khi thủ quỹ lập phiếu thu tiền mặt.
- Thay đổi dữ liệu: không.
- Thay đổi API: không đổi đường dẫn.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 4 và khôi phục các tài liệu nêu ở YCTD-28 về phiên bản trước.

### Phiên bản 0.23.2 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 3, thêm `27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md` với 62 ca; YCTD-27.
- Chức năng mới: không. Bổ sung hành vi đã chốt: ngày bắt đầu học dịch vụ khi đăng ký trễ; chặn tính học phí khi còn ngày chưa chốt điểm danh.
- Lỗi đã sửa: AC-199 chưa nói rõ mốc tính số ngày học còn lại.
- Thay đổi dữ liệu: `service_registrations` thêm `service_start_date`.
- Thay đổi API: không đổi đường dẫn; thêm lỗi khi còn ngày chưa chốt điểm danh.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 3 và khôi phục các tài liệu nêu ở YCTD-27 về phiên bản trước.

### Phiên bản 0.23.1 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 2, thêm `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md` với 111 ca.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 2.

### Phiên bản 0.23.0 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 1, thêm thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`; YCTD-26.
- Chức năng mới: không. Bổ sung hành vi đã chốt: bắt buộc đổi mật khẩu sau khi đặt lại; chặn đóng năm học khi còn nợ của trẻ đã thôi học.
- Lỗi đã sửa: BM-69 và AC-203 chưa phân biệt đăng nhập bằng mật khẩu mặc định và bằng mã một lần.
- Thay đổi dữ liệu: không.
- Thay đổi API: không đổi đường dẫn; thêm lỗi BR-89 khi đóng năm học.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa thư mục 27 và khôi phục các tài liệu nêu ở YCTD-26 về phiên bản trước.

### Phiên bản 0.22.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-10; hoàn tất rà duyệt toàn bộ tài liệu, CG-01 đến CG-07 đạt.
- Chức năng mới: không.
- Lỗi đã sửa: QT-10 và P14-02 thiếu Ban Giám hiệu trong bước duyệt; chưa có điểm cuối ẩn hoạt động theo Q-72; thiếu ẩn bình luận, tự ẩn hình khi rút đồng ý, giới hạn ảnh.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `/api/v1/activities/{id}/hide`, `/api/v1/activities/{id}/republish`.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-10 phiên bản 1.0, `10_YEU_CAU_CHUC_NANG.md` phiên bản 1.3 và `17_DAC_TA_API.md` phiên bản 1.3.

### Phiên bản 0.22.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-09.
- Chức năng mới: không.
- Lỗi đã sửa: QT-09 còn chữ kích hoạt tài khoản, chưa ghi giai đoạn; ma trận quyền chưa có quyền sửa nhật ký quá hạn của quản lý đơn vị theo Q-67.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-09 phiên bản 1.0 và `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.3.

### Phiên bản 0.22.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-25 bổ sung nội dung gửi thuốc và chăm sóc sức khỏe; rà duyệt và phê duyệt QT-07.
- Chức năng mới: P10-12 Theo dõi chăm sóc hằng ngày (giai đoạn 2); giáo viên nhận thuốc khi đơn vị không có y tế; ảnh thuốc; phụ huynh xác nhận đã biết.
- Lỗi đã sửa: QT-07 thiếu Ban Giám hiệu trong tác nhân.
- Thay đổi dữ liệu: thêm bảng `daily_care_logs`; thêm cột ảnh thuốc, người nhận thuốc, xác nhận của phụ huynh.
- Thay đổi API: thêm ba điểm cuối theo YCTD-25.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-07 phiên bản 1.1 và các tài liệu nêu ở YCTD-25 về phiên bản trước.

### Phiên bản 0.21.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-06.
- Chức năng mới: không.
- Lỗi đã sửa: QT-06 thiếu tiền làm thêm giờ, người đề nghị mở lại kỳ công, cách áp lịch nghỉ lễ và thứ 7; ba tiêu chí nghiệm thu chép bản cũ.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-06 phiên bản 1.3.

### Phiên bản 0.21.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-05; YCTD-24.
- Chức năng mới: không.
- Lỗi đã sửa: QT-05 có AC-37 trái BR-34; thiếu thủ quỹ, phiếu chi hoàn tiền, trường hợp chưa cấu hình hạn mức; bước đảo phiếu chi lệch bảng trạng thái.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm hai điểm cuối duyệt và từ chối phiếu đảo phiếu chi.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-05 phiên bản 1.1 và các tài liệu nêu ở YCTD-24 về phiên bản trước.

### Phiên bản 0.21.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-04; YCTD-23.
- Chức năng mới: P05-12 Xử lý công nợ quá hạn (giai đoạn 2); bước duyệt phiếu đảo phiếu thu.
- Lỗi đã sửa: QT-04 lệch danh mục hạn mức và thiếu chức năng cho bước xử lý công nợ; thiếu thủ quỹ và luồng lỗi thanh toán mã QR.
- Thay đổi dữ liệu: thêm bảng `debt_resolutions`; `receipts` thêm `approved_by`, `approved_at`.
- Thay đổi API: thêm bốn điểm cuối theo YCTD-23.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-04 phiên bản 1.2 và các tài liệu nêu ở YCTD-23 về phiên bản trước.

### Phiên bản 0.20.3 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-03.
- Chức năng mới: không.
- Lỗi đã sửa: QT-03 còn ghi đăng ký trễ thành phát sinh kỳ sau, biểu phí theo đơn vị, quản lý đơn vị đề xuất miễn giảm; thiếu kiểm tra bán trú bắt buộc và chặn khi nợ quá hạn.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-03 phiên bản 1.6.

### Phiên bản 0.20.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-02.
- Chức năng mới: không.
- Lỗi đã sửa: QT-02 chép thiếu BR-56, thiếu ngày học bù thứ 7; ma trận P04 của VT-03 lệch P04-06.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-02 phiên bản 1.3 và `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.0.

### Phiên bản 0.20.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-01.
- Chức năng mới: không.
- Lỗi đã sửa: QT-01 kiểm tra trùng số định danh muộn, chặn phụ huynh nhiều con, còn chữ kích hoạt tài khoản và tham chiếu quy trình không tồn tại.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-01 phiên bản 1.2.

### Phiên bản 0.20.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 01; xếp G1-15 đến G1-19 vào các đợt xây dựng.
- Chức năng mới: không.
- Lỗi đã sửa: kế hoạch còn ghi tài liệu chờ duyệt, ba cấp đơn vị cố định, phạm vi mã cũ, mốc 1.1.0 còn phần chi của tài chính; năm chức năng giai đoạn 1 chưa thuộc đợt nào; RR-07 lệch kế hoạch kiểm thử.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `01_KE_HOACH_TONG_THE.md` phiên bản 0.4.

### Phiên bản 0.19.7 – 2026-10-09

- Phạm vi thay đổi: rà duyệt tài liệu 23; tài liệu giữ trạng thái Đang cập nhật theo quy định của `index.md`.
- Chức năng mới: không.
- Lỗi đã sửa: tiêu đề các mục phiên bản từ 0.4.0 sai cấp; quy ước 2 dùng tên mục khác với các mục phiên bản; `index.md` ghi phạm vi tài liệu 24 đến YCTD-15 trong khi đã có YCTD-22.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: đưa tiêu đề các mục phiên bản về cấp 2.

### Phiên bản 0.19.6 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 22; tài liệu 12 lên phiên bản 1.1 vì SL-01 thiếu cơ sở dữ liệu hệ thống.
- Chức năng mới: không.
- Lỗi đã sửa: BM-17 thiếu Ban Giám hiệu; biện pháp BM-61 đến BM-69 đặt sai mục giám sát; BM-05, BM-19, BM-42 chưa khớp Q-120, BR-73, SL-01 đến SL-04; câu trả lời Q-109, Q-110 chưa vào nội dung.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `22_BAO_MAT.md` phiên bản 0.4.

### Phiên bản 0.19.5 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 21; tài liệu 11 lên phiên bản 1.1.
- Chức năng mới: không. Thêm AC-211 và CT-167 kiểm tra chức năng thu hồi khóa API đã có ở G1-17.
- Lỗi đã sửa: tám ca kiểm thử lệch quy tắc nghiệp vụ hoặc tiêu chí nghiệm thu; AC-194 thiếu yêu cầu giữ nguyên mã định danh; mục chưa xác minh lỗi thời.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `21_KICH_BAN_KIEM_THU.md` phiên bản 0.4 và `11_TIEU_CHI_NGHIEM_THU.md` phiên bản 1.0.

### Phiên bản 0.19.4 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 20.
- Chức năng mới: không.
- Lỗi đã sửa: phạm vi kiểm thử thiếu API đối tác, cơ sở dữ liệu theo năm học, nhập dữ liệu; dữ liệu kiểm thử lệch GD-79 và thiếu trường hợp theo BR-24, BR-58, BR-84, BR-85; câu trả lời Q-101 đến Q-104 chưa vào nội dung.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `20_KE_HOACH_KIEM_THU.md` phiên bản 0.4.

### Phiên bản 0.19.3 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 19.
- Chức năng mới: không.
- Lỗi đã sửa: ngữ cảnh dự án còn ba cấp đơn vị và thiếu cơ sở dữ liệu theo năm học; câu lệnh hệ thống có từ tiếng Anh và thiếu ngoại lệ hạn mức; bảng quy ước mã thiếu tiền tố và có dạng mã không dùng.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `19_CHI_DAN_HE_THONG_AI.md` phiên bản 0.4.

### Phiên bản 0.19.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 18.
- Chức năng mới: không.
- Lỗi đã sửa: thiếu quy tắc AI cho cơ sở dữ liệu theo năm học; GD-81 đếm sai số quyết định kiến trúc; tên trạng thái lệch quy trình.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `18_QUY_TAC_PHAT_TRIEN_AI.md` phiên bản 0.4.

### Phiên bản 0.19.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 17.
- Chức năng mới: không.
- Lỗi đã sửa: thiếu điểm cuối cho các bước phê duyệt và chức năng đã duyệt; chưa ghi khóa API do dịch vụ định danh quản lý; cây đơn vị ghi ba cấp; thiếu giới hạn tin nhắn theo Q-96.
- Thay đổi dữ liệu: `one_time_codes.purpose` bỏ giá trị đặt lại mật khẩu.
- Thay đổi API: thêm mười lăm điểm cuối, chuyển một điểm cuối sang nhóm trẻ và lớp.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `17_DAC_TA_API.md` phiên bản 0.4.

### Phiên bản 0.19.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 16, xem `24_YEU_CAU_THAY_DOI.md` YCTD-22.
- Chức năng mới: hóa đơn bổ sung cùng kỳ.
- Lỗi đã sửa: bảng không theo năm học nằm chung cơ sở dữ liệu năm học; thiếu bảng phân công giáo viên, tổ chuyên môn, phiên đăng nhập, mã một lần; mục P11 còn bảng trống.
- Thay đổi dữ liệu: thêm năm bảng và bảy cột; thêm cơ sở dữ liệu hệ thống.
- Thay đổi API: thêm một điểm cuối.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-22 về phiên bản 0.18.1.

### Phiên bản 0.18.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 15.
- Chức năng mới: không.
- Lỗi đã sửa: cỡ chữ nhãn và ghi chú nhỏ hơn mức tối thiểu 14 điểm ảnh (Q-89); nút chính chữ trắng trên nền cam không đủ tương phản; thiếu thành phần cho mã ngành còn trống và số định danh đã che.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `15_HE_THONG_THIET_KE.md` phiên bản 0.4.

### Phiên bản 0.18.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 14, xem `24_YEU_CAU_THAY_DOI.md` YCTD-21.
- Chức năng mới: màn hình MH-44 Cá nhân trên cổng quản trị.
- Lỗi đã sửa: vai trò màn hình chưa theo quyết định mới; BC-01 tự mâu thuẫn; BC-08 lệch mục 6; sơ đồ còn mục xe.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-21 về phiên bản 0.17.2.

### Phiên bản 0.17.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 13.
- Chức năng mới: không.
- Lỗi đã sửa: cấu trúc mã nguồn và quy ước chưa tính cơ sở dữ liệu theo năm học và cơ sở dữ liệu định danh riêng; mục chưa xác minh còn điểm đã có câu trả lời.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `13_CONG_NGHE_SU_DUNG.md` phiên bản 0.4.

### Phiên bản 0.17.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 12; chốt QĐ-01, QĐ-03, QĐ-05.
- Chức năng mới: không.
- Lỗi đã sửa: nguyên tắc dùng chung cơ sở dữ liệu giữa định danh và API trái QĐ-15; sơ đồ thiếu đối tác và cơ sở dữ liệu theo năm học; phạm vi đơn vị chưa theo YCTD-18; thiếu tác vụ khóa tài khoản hết hạn và mở năm học.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `12_KIEN_TRUC_HE_THONG.md` phiên bản 0.4.

### Phiên bản 0.17.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 11, xem `24_YEU_CAU_THAY_DOI.md` YCTD-20.
- Chức năng mới: không. Chức năng bỏ: P17-15 Báo cáo ăn tối; dịch vụ ăn sáng và ăn tối.
- Lỗi đã sửa: công thức suất ăn trừ trẻ nghỉ hai lần; AC-29 trái BR-26; AC-147 trái P01-06; tiêu chí còn nhắc kích hoạt tài khoản.
- Thay đổi dữ liệu: gỡ `meal_registrations`; `buffet_registrations` thay bằng `buffet_events`.
- Thay đổi API: gỡ hai điểm cuối, đổi một điểm cuối.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-20 về phiên bản 0.16.0.

### Phiên bản 0.16.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 10, xem `24_YEU_CAU_THAY_DOI.md` YCTD-19.
- Chức năng mới: không. Chức năng đổi giai đoạn: P06-04 Phiếu chi, P06-05 Quỹ tiền mặt sang giai đoạn 1.
- Lỗi đã sửa: quản lý đơn vị tham gia miễn giảm trái Q-134; thiếu bước phê duyệt theo hạn mức ở điều chỉnh hóa đơn và bảng lương; dẫn chiếu quy tắc sai ở ba chức năng; P19-06 còn mã kích hoạt.
- Thay đổi dữ liệu: không.
- Thay đổi API: điểm cuối phiếu chi và sổ quỹ có từ giai đoạn 1.
- Rủi ro: khối lượng giai đoạn 1 tăng.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-19 về phiên bản 0.15.1.

### Phiên bản 0.15.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 09.
- Chức năng mới: không.
- Lỗi đã sửa: tài liệu 09 ghi kế toán chốt công, chặn trẻ đi học khi nợ, đăng ký giữa tháng chuyển kỳ sau, gắn nhầm hai luồng phụ kho vào luồng hoạt động, sơ đồ luồng sai một mũi tên.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `09_LUONG_NGHIEP_VU.md` phiên bản 0.4.

### Phiên bản 0.15.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 08, xem `24_YEU_CAU_THAY_DOI.md` YCTD-18.
- Chức năng mới: không.
- Lỗi đã sửa: ma trận quyền thiếu quyền duyệt của quản lý đơn vị, thiếu quyền đăng nhập của cán bộ quản lý cấp trên và kiểm toán viên; kế hoạch tổng thể ghi sai số quy tắc nghiệp vụ.
- Thay đổi dữ liệu: không.
- Thay đổi API: không thêm điểm cuối; cập nhật quyền theo ma trận.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-18 về phiên bản 0.14.0.

### Phiên bản 0.14.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 07, xem `24_YEU_CAU_THAY_DOI.md` YCTD-17.
- Chức năng mới: không.
- Lỗi đã sửa: BR-53 mâu thuẫn ma trận quyền; BR-24 mâu thuẫn Q-134; BR-01 mâu thuẫn quyền Quản trị nền tảng; mục lục ghi sai phiên bản bốn quy trình.
- Thay đổi dữ liệu: không.
- Thay đổi API: thu hẹp quyền phân hệ Y tế và quyền phê duyệt phiếu chi hoàn tiền.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-17 về phiên bản 0.13.0.

### Phiên bản 0.13.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 04, 05, 06; bỏ dịch vụ học thứ bảy, xem `24_YEU_CAU_THAY_DOI.md` YCTD-16.
- Chức năng mới: không. Chức năng bỏ: dịch vụ học thứ bảy thu phí theo trẻ.
- Lỗi đã sửa: tài liệu 04, 05, 06 còn ghi ba cấp đơn vị cố định, còn nhắc ứng lương, thiếu chức năng giai đoạn 1 đã gắn ở tài liệu 10, còn mục chưa xác minh đã có câu trả lời; mục lục ghi sai phiên bản QT-03.
- Thay đổi dữ liệu: `saturday_schedules` dùng chung toàn trường.
- Thay đổi API: đổi quyền và mô tả hai điểm cuối.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-16 về phiên bản 0.12.0.

### Phiên bản 0.12.0 – 2026-10-09

- Phạm vi thay đổi: xử lý hết giả định, xem `24_YEU_CAU_THAY_DOI.md` YCTD-15.
- Chức năng mới: P02-12 Nhập mã định danh ngành từ tệp; duyệt đăng ký trễ trong P05-03.
- Lỗi đã sửa: GD-16 mâu thuẫn với QT-06 về người chốt công.
- Thay đổi dữ liệu: mã trẻ theo số định danh và mã ngành; cột dịch vụ bắt buộc và đăng ký trễ.
- Thay đổi API: thêm hai điểm cuối.
- Rủi ro: RR-14 mật khẩu mặc định chung.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-15 về phiên bản 0.11.0.

### Phiên bản 0.11.0 – 2026-10-09

- Phạm vi thay đổi: trả lời toàn bộ câu hỏi mở, xem `24_YEU_CAU_THAY_DOI.md` YCTD-14.
- Chức năng mới: P01-14 Khóa API cho đối tác; P08-12 Tiền làm thêm giờ; mở và đóng năm học kèm chuyển dữ liệu. Chức năng bỏ: P11-01 đến P11-07, P17-09.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: gỡ tám bảng xe đưa đón; thêm ba bảng và ba cột; mỗi năm học một cơ sở dữ liệu.
- Thay đổi API: gỡ mười điểm cuối, thêm tám điểm cuối.
- Rủi ro: RR-13 mỗi năm học một cơ sở dữ liệu; API đối tác đọc dữ liệu cá nhân.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-14 về phiên bản 0.10.0.

### Phiên bản 0.10.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 8, xem `24_YEU_CAU_THAY_DOI.md` YCTD-13.
- Chức năng mới: đồng ý hoặc rút đồng ý hình ảnh trên ứng dụng phụ huynh; xem đầy đủ số định danh có ghi nhật ký. Chức năng bỏ: P08-05 Ứng lương.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: gỡ `advance_requests`, `payslips.advance_amount`; thêm `photo_consent_histories` và các cột mới của `children`.
- Thay đổi API: gỡ hai điểm cuối ứng lương, thêm hai điểm cuối hồ sơ trẻ.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-13 về phiên bản 0.9.0.

### Phiên bản 0.9.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 6 và lượt 7, xem `24_YEU_CAU_THAY_DOI.md` YCTD-12.
- Chức năng mới: P01-13 Nhập dữ liệu ban đầu từ Excel; P06-11 Thanh toán trực tuyến bằng mã QR.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: thêm `data_import_jobs`, `online_payment_transactions`; bỏ trạng thái thu một phần của hóa đơn.
- Thay đổi API: thêm tám điểm cuối.
- Rủi ro: thanh toán bằng mã QR và tin nhắn phụ thuộc nhà cung cấp chưa chọn (Q-142, T1, T5).
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-12 về phiên bản 0.8.0.

### Phiên bản 0.8.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 4 và lượt 5, xem `24_YEU_CAU_THAY_DOI.md` YCTD-11.
- Chức năng mới: phụ huynh đăng nhập bằng mã một lần (mở rộng P19-06); cờ chặn đăng ký dịch vụ khi nợ quá hạn (mở rộng P01-08).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bỏ cột `session` của `attendance_records`, `absence_records`.
- Thay đổi API: thêm hai điểm cuối mã một lần; điểm danh không còn tham số buổi.
- Rủi ro: đăng nhập bằng mã một lần phụ thuộc nhà cung cấp tin nhắn chưa chọn (T1).
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-11 về phiên bản 0.7.0.

### Phiên bản 0.7.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 3, xem `24_YEU_CAU_THAY_DOI.md` YCTD-10.
- Chức năng mới: P05-11 Danh mục loại miễn giảm; P08-11 Danh mục khấu trừ và quy định số ngày phép năm.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: thêm `discount_types`, `leave_policies`; `discounts.discount_type_id`.
- Thay đổi API: thêm hai điểm cuối.
- Rủi ro: số hiệu văn bản chế độ kế toán hành chính, sự nghiệp cần kế toán trưởng kiểm tra lại.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-10 về phiên bản 0.6.0.

### Phiên bản 0.6.0 – 2026-10-09

- Phạm vi thay đổi: chốt các quyết định ưu tiên, xem `24_YEU_CAU_THAY_DOI.md` YCTD-09.
- Chức năng mới: không. Sổ kế toán kép (G3-06) được đưa chính thức vào phạm vi giai đoạn 3.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: biểu phí dùng chung toàn trường.
- Thay đổi API: không.
- Rủi ro: chế độ kế toán chưa xác định (Q-140); mức miễn giảm chưa có (Q-16).
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-09 về phiên bản 0.5.3.

### Phiên bản 0.5.3 – 2026-10-09

- Phạm vi thay đổi: trả lời Q-139, xác nhận GD-86, xem `24_YEU_CAU_THAY_DOI.md` YCTD-08.
- Chức năng mới: không. Sửa đặc tả P14-11.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên P14-11, GD-86, Q-139 về phiên bản 0.5.2; xóa AC-175, CT-131.

### Phiên bản 0.5.2 – 2026-10-09

- Phạm vi thay đổi: bổ sung điểm cuối cho phân hệ Giảng dạy, xem `24_YEU_CAU_THAY_DOI.md` YCTD-07.
- Chức năng mới: không.
- Lỗi đã sửa: `17_DAC_TA_API.md` thiếu nhóm điểm cuối P03; chức năng P03-07 thiếu bảng dữ liệu.
- Thay đổi dữ liệu: thêm bảng `class_activity_schedules`.
- Thay đổi API: thêm mười tám điểm cuối ở mục 7; các mục sau đánh số lại từ 8 đến 21.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa mục 7 của `17_DAC_TA_API.md`, đánh số lại các mục, xóa bảng `class_activity_schedules`.

### Phiên bản 0.5.1 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời Q-136 đến Q-138, xem `24_YEU_CAU_THAY_DOI.md` YCTD-06.
- Chức năng mới: không. Sửa đặc tả P08-10, P10-11, P14-10, P14-11.
- Lỗi đã sửa: `01_KE_HOACH_TONG_THE.md` mục 13 còn ghi 84 giả định.
- Thay đổi dữ liệu: `saturday_schedules` theo đơn vị; thêm `fee_type`, `effective_from`, `effective_to`; đổi `health_standards.source` thành `source_document`.
- Thay đổi API: không đổi đường dẫn.
- Rủi ro: Q-139 chưa trả lời; GD-86 chưa xác nhận.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-06 về nội dung của phiên bản 0.5.0.

### Phiên bản 0.5.0 – 2026-10-09

- Phạm vi thay đổi: bổ sung hai mươi chức năng theo tám ảnh sơ đồ chức năng, xem `24_YEU_CAU_THAY_DOI.md` YCTD-05.
- Chức năng mới: P01-11, P01-12, P02-11, P03-08, P06-10, P08-09, P08-10, P10-09 đến P10-11, P12-08, P12-09, P13-10, P14-10 đến P14-12, P16-05, P17-13 đến P17-15.
- Lỗi đã sửa: số chức năng ghi nhầm 106 (thực tế 141 trước bổ sung); số bảng dữ liệu ghi nhầm 92 (thực tế 134 trước bổ sung); trả lời Q-06, Q-28, Q-29.
- Thay đổi dữ liệu: thêm mười chín bảng và sáu cột, xem YCTD-05.
- Thay đổi API: thêm hai mươi hai điểm cuối.
- Rủi ro: ba câu hỏi mới Q-136 đến Q-138; giai đoạn của các chức năng mới là đề xuất.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa các dòng chức năng, tiêu chí, ca kiểm thử, bảng, điểm cuối và màn hình liệt kê ở YCTD-05.

### Phiên bản 0.4.0 – 2026-10-09

- Phạm vi thay đổi: chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow; sửa các chỗ chưa khớp; thống nhất phân cấp phê duyệt; đổi mã dự án thành SM. Chi tiết ở `24_YEU_CAU_THAY_DOI.md` YCTD-01 đến YCTD-04.
- Chức năng mới: không áp dụng.
- Lỗi đã sửa: sơ đồ trong `09_LUONG_NGHIEP_VU.md` và các đặc tả QT-01, QT-03, QT-04, QT-05, QT-08, QT-09, QT-10 còn thuật ngữ cũ "cơ sở" và "Chủ trường"; `01_KE_HOACH_TONG_THE.md` và `03_DANH_SACH_CONG_VIEC.md` còn số câu hỏi mở và giả định cũ; mốc 0.3.0 còn ghi Đang soạn; `13_CONG_NGHE_SU_DUNG.md` ghi bốn ứng dụng giao diện nhưng liệt kê ba; `11_TIEU_CHI_NGHIEM_THU.md` không trỏ tới AC-94 đến AC-134; mâu thuẫn người phê duyệt phiếu chi, miễn giảm, phiếu đảo và bảng lương.
- Thay đổi dữ liệu: bảng `fiscal_periods` thêm `close_requested_by`, `close_requested_at`. Mã trẻ sinh theo dạng `SM-<mã đơn vị>-<số thứ tự>`.
- Thay đổi API: thêm `POST /api/v1/fiscal-periods/{id}/request-close`. Các điểm cuối phê duyệt chứng từ phải từ chối vai trò kế toán, kế toán trưởng và quản lý đơn vị.
- Rủi ro: việc xem "hình tổ màu" là "hình tô màu" ở P14-09 vẫn chưa được xác nhận (Q-06). Ba câu hỏi Q-133 đến Q-135 phát sinh và đã được trả lời trong cùng phiên bản.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng. Mục lịch sử trong `02_NHAT_KY_DU_AN.md` và tệp này giữ nguyên tên tệp cũ.
- Phương án quay lui: đổi tên ngược theo bảng đối chiếu ở YCTD-01; hoàn nguyên QT-03 đến QT-06 về phiên bản 1.0; hoàn nguyên VT-03 và VT-05 về quyền phê duyệt.

### 0.3.1 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Đổi tên dự án từ Sun KinderGarten thành School Management theo yêu cầu của Eric, để khớp với tên thư mục gốc `D:\School_Management` |
| Chức năng mới | Không áp dụng |
| Lỗi đã sửa | Không áp dụng. Đây là thay đổi cách gọi tên, không phải sửa lỗi |
| Thay đổi dữ liệu | Không áp dụng. Không có bảng, cột hay ràng buộc nào bị đổi |
| Thay đổi giao diện lập trình | Không áp dụng. Không có điểm cuối nào bị đổi |
| Rủi ro | Mã dự án vẫn là `SKG`, vốn là chữ viết tắt của tên cũ, nay không còn khớp tên mới; đã ghi thành `Q-132`. Mã này còn dùng trong quy tắc sinh mã trẻ tại `GD-20` của `QT-01`, nên nếu đổi mã thì phải sửa cả quy tắc đó |
| Khả năng tương thích | Không ảnh hưởng nội dung nghiệp vụ, lược đồ dữ liệu hay giao diện lập trình. Hai mục nhật ký cũ còn nhắc tên cũ được giữ nguyên vì nhật ký chỉ ghi thêm. Các mã đã cấp không bị tái sử dụng |
| Phương án quay lui | Thay ngược "School Management" về "Sun KinderGarten" trên cùng 36 tệp; hoàn nguyên `index.md`, `01_Tong_quan_du_an.md`, `Checklist_cong_viec.md` và `Nhat_ky_du_an.md` về trạng thái phiên bản 0.3.0 |

Nội dung đã cập nhật trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Phân tích nghiệp vụ | `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md` |
| Thiết kế | `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md`, `21_Ke_hoach_tong_the_du_an.md` |
| Quy tắc và vận hành | `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md` |
| Quy trình nghiệp vụ | `Quy_trinh_nghiep_vu/index.md`, `Phieu_yeu_cau.md` và `QT-01` đến `QT-10` |
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |

### 0.3.0 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Lập kế hoạch tổng thể dự án theo yêu cầu của Eric: mười hai giai đoạn kèm cổng kiểm soát, sáu mốc phát hành, mười hai đợt xây dựng, đường găng, ma trận trách nhiệm, ngưỡng phê duyệt thay đổi và mười hai rủi ro |
| Chức năng mới | Không áp dụng. Đây là tài liệu kế hoạch, không sinh chức năng phần mềm |
| Lỗi đã sửa | Sửa số giả định trong `index.md` từ 80 lên 83 vì `GD-81` trong `15_Quy_tac_phat_trien_AI.md` trước đây chưa được đếm |
| Thay đổi dữ liệu | Không áp dụng. Không có bảng, cột hay ràng buộc nào bị đổi |
| Thay đổi giao diện lập trình | Không áp dụng. Không có điểm cuối nào bị đổi |
| Rủi ro | Kế hoạch chưa có mốc thời gian nên khó đo tiến độ, ghi tại `RR-12`; ba việc `M05`, `M06`, `M08` đang tạm dừng và nằm trên đường găng; kế hoạch là đề xuất, chưa được Eric phê duyệt, ghi tại `GD-82` |
| Khả năng tương thích | Không ảnh hưởng tài liệu `01` đến `20`; chỉ thêm một tài liệu mới, hai quy tắc phát triển mới và ba tiền tố mã mới. Các mã đã cấp không bị tái sử dụng |
| Phương án quay lui | Xóa `21_Ke_hoach_tong_the_du_an.md`, hoàn nguyên `index.md`, `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md`, `Checklist_cong_viec.md` và `Nhat_ky_du_an.md` về trạng thái phiên bản 0.2.0 |

Nội dung đã cập nhật trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Kế hoạch | `21_Ke_hoach_tong_the_du_an.md` (tạo mới) |
| Quy tắc và vận hành | `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md` |
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |

### 0.2.0 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Cập nhật bộ tài liệu thiết kế theo bốn yêu cầu của Eric ngày 09/10/2026: đổi vai trò Chủ trường thành Ban Giám hiệu, chuyển mô hình một cấp sang ba cấp đơn vị, tách tầng giao diện khỏi tầng máy chủ, tách dịch vụ định danh |
| Chức năng mới | Quản lý cây đơn vị ba cấp (P01-01); cấu hình hạn mức phê duyệt (P01-10); màn hình cây đơn vị (MH-32); màn hình hạn mức phê duyệt (MH-33) |
| Lỗi đã sửa | Sửa mâu thuẫn giữa BR-01, BR-02 và GD-05 về cấp đơn vị; sửa cách gọi vai trò Ban Giám hiệu thành hai vai trò riêng |
| Thay đổi dữ liệu | Bảng `branches` đổi thành `org_units` kèm `unit_type` và `parent_id` tự tham chiếu; cột `branch_id` đổi thành `org_unit_id`; thêm khái niệm hạn mức phê duyệt theo đơn vị và loại chứng từ |
| Thay đổi giao diện lập trình | `/api/v1/branches` đổi thành `/api/v1/org-units`; thêm `/api/v1/org-units/tree` và `/api/v1/approval-thresholds`; `/api/v1/children/{id}/transfer-branch` đổi thành `/api/v1/children/{id}/transfer-unit`; `/api/v1/dashboard/owner` đổi thành `/api/v1/dashboard/leadership`; `/api/v1/dashboard/branch` đổi thành `/api/v1/dashboard/unit` |
| Rủi ro | Việc đổi thuật ngữ "cơ sở" thành "đơn vị" ảnh hưởng toàn bộ bộ tài liệu, cần rà soát lại khi có mã nguồn; mức hạn mức phê duyệt chưa có nên chưa kiểm thử được; số cấp đơn vị thật chưa xác nhận |
| Khả năng tương thích | Bộ tài liệu chưa có mã nguồn nên không có vấn đề tương thích; các mã đã cấp không bị tái sử dụng |
| Phương án quay lui | Giữ nguyên phiên bản 0.1.0 trong lịch sử; nếu cần, khôi phục theo mục 0.1.0 |

Nội dung đã cập nhật trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Phân tích nghiệp vụ | `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md` |
| Thiết kế | `09_Kien_truc_he_thong.md`, `10_Cong_nghe_su_dung.md`, `11_Dac_ta_giao_dien.md`, `13_Luoc_do_co_so_du_lieu.md`, `14_Dac_ta_API.md` |
| Quy tắc và vận hành | `16_Cau_lenh_he_thong_AI.md`, `17_Ke_hoach_kiem_thu.md`, `18_Ca_kiem_thu.md`, `19_Bao_mat.md` |
| Quy trình nghiệp vụ | `QT-01` đến `QT-10` |
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |

### 0.1.0 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Khởi tạo bộ tài liệu thiết kế, chưa có mã nguồn |
| Chức năng mới | Không áp dụng |
| Lỗi đã sửa | Không áp dụng |
| Thay đổi dữ liệu | Không áp dụng |
| Thay đổi giao diện lập trình | Không áp dụng |
| Rủi ro | Bộ tài liệu dựa trên danh sách tính năng và bốn ảnh sơ đồ chức năng, chưa có nghiệp vụ thật để đối chiếu; nhiều giả định và câu hỏi mở chưa được trả lời |
| Khả năng tương thích | Không áp dụng, đây là bản khởi tạo |
| Phương án quay lui | Không áp dụng |

Nội dung đã tạo trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |
| Phân tích nghiệp vụ | `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md` |
| Thiết kế | `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md` |
| Quy tắc và vận hành | `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md` |
| Quy trình nghiệp vụ | `Quy_trinh_nghiep_vu/QT-01` đến `QT-10` và `Quy_trinh_nghiep_vu/index.md` |

## 3. Chưa xác minh được

Không áp dụng. Tài liệu này ghi lịch sử thay đổi, không mô tả hiện trạng hệ thống.

## 4. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-60 | Đã xác nhận ngày 09/10/2026 (theo ghi nhận lịch sử): Phiên bản 0.1.0 đánh dấu mốc khởi tạo tài liệu, chưa phải phiên bản phần mềm | Eric |
| GD-80 | Đã xác nhận ngày 09/10/2026 (theo ghi nhận lịch sử): Phiên bản 0.2.0 ghi nhận bốn thay đổi kiến trúc và mô hình tổ chức đã được Eric chốt ngày 09/10/2026 | Eric |
| GD-82 | Đã xác nhận ngày 09/10/2026 (theo Q-07): Kế hoạch tổng thể là đề xuất, thứ tự đợt và cách xếp giai đoạn có thể đổi sau khi Eric xác nhận | Eric |
| GD-83 | Đã xác nhận ngày 09/10/2026 (theo Q-128): Kế hoạch dùng thứ tự và điều kiện vào, điều kiện ra thay cho hạn ngày | Eric |
| Q-111 | Đã trả lời ngày 09/10/2026: phiên bản 1.0 gồm các phân hệ của giai đoạn 1 theo `05_PHAM_VI.md` mục 4, đã xác nhận tại Q-07 | Eric |
| Q-127 | Đã trả lời ngày 09/10/2026: không tách bản 0.2.0 thành bản phát hành riêng | Eric |
| Q-128 | Đã trả lời ngày 09/10/2026: giữ cách dùng điều kiện vào, điều kiện ra, không đặt mốc ngày | Eric |
| Q-129 | Đã trả lời ngày 09/10/2026: Eric duyệt mọi cổng; Hiệu trưởng cùng nghiệm thu nghiệp vụ; kế toán trưởng cùng nghiệm thu phân hệ học phí, tài chính, lương | Eric |
| Q-130 | Đã trả lời ngày 09/10/2026: dùng Git trên GitHub, kho riêng; dựng tích hợp và triển khai tự động ngay từ đợt DT-00 | Eric |
| Q-132 | Đã trả lời ngày 09/10/2026: mã dự án đổi thành SM | Eric |
