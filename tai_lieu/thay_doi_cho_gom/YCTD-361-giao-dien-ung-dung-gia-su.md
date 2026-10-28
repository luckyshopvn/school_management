---
yctd: YCTD-361
tieu_de: Áp bản thiết kế cho ứng dụng Gia sư
ngay: 2026-10-29
phien_ban_de_xuat: 0.241.0
---

## 02 Nhật ký

### 2026-10-29 — Áp bản thiết kế cho ứng dụng Gia sư

#### Công việc đã thực hiện

- Áp bản thiết kế "Chợ gia sư, Gia sư, Cấp trên" (Eric duyệt ngày 2026-10-28) cho `apps/tutor`: khu gia sư chia bảy trang theo cột điều hướng bên trái (Buổi dạy, Lịch, Hồ sơ và môn dạy, Thu nhập, Tin nhắn, Xác minh, An toàn, kiểm duyệt) thay cho một trang dài; trang đang mở ghi ở phần `#` của địa chỉ. Hồ sơ đã duyệt thì vào Buổi dạy, chưa duyệt thì vào Xác minh.
- Khung chung `MarketShell` thêm `navigationPlacement="side"` để đặt thanh điều hướng thành cột bên trái.
- Buổi dạy: thẻ từng buổi có ô ngày giờ, nhãn trạng thái, chia nhóm Sắp tới, Đã dạy và khiếu nại, Đã xong; khung tạm khóa hiện ở đầu trang khi có.
- Lịch: lưới bảy ngày của tuần đang xem, có giờ trống hằng tuần và buổi đã đặt, chuyển tuần trước, tuần sau (trước đây chỉ có danh sách).
- Thu nhập: ba ô tóm tắt (đã giải ngân, đang chờ, hoa hồng), bảng theo từng buổi (học phí, hoa hồng, thực nhận đã giải ngân hoặc dự kiến, trạng thái), dải "Giải ngân giả lập".
- Xác minh: cột các bước có nhãn trạng thái, biểu mẫu từng bước bên phải; nói rõ nền tảng nhận gì từ nhà cung cấp định danh.
- Hồ sơ và môn dạy: giới thiệu, cơ sở dạy thêm, hồ sơ dạy có nhãn trạng thái, khai giáo viên đang dạy ở trường; thêm nút "Bỏ khai báo" gọi `DELETE /market/tutor/school-role` đã có (việc T-T2 của rà soát giao diện).
- An toàn, kiểm duyệt: khối kiểm duyệt luôn hiện (kể cả khi chưa có báo cáo), chính sách an toàn trẻ em.
- Màu giống Chợ gia sư (ghi đè biến màu trong `apps/tutor/src/index.css`).
- Sửa kiểm thử giao diện 195, 196, 197, 198 theo cột điều hướng.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giờ trống vẫn sửa ở Hồ sơ dạy (máy chủ lưu giờ trống cùng hồ sơ dạy); trang Lịch chỉ xem, có nút sang trang sửa.
- Phòng dạy video làm ở YCTD-362; nút "Mở phòng học" giữ nguyên hành vi cũ trong phần này.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-361, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chưa làm vì cần API mới: ảnh hồ sơ gia sư (T-T1), giá theo gói buổi (T-M3), trả lời đánh giá, nhãn "giáo viên trường X đã xác minh" bằng liên kết tài khoản trường (T-T3), cột thuế khấu trừ ở Thu nhập, nghỉ một ngày.

## 24 Yêu cầu thay đổi

### YCTD-361: Áp bản thiết kế cho ứng dụng Gia sư – 2026-10-29

- Lý do: rà soát giao diện ngày 2026-10-28 ghi ứng dụng Gia sư chưa có thiết kế; Eric duyệt bản thiết kế ngày 2026-10-28 và cho làm mã.
- Nội dung thay đổi: bảy trang có cột điều hướng; trang Lịch dạng tuần; trang Thu nhập có bảng theo buổi; Xác minh dạng các bước; nút Bỏ khai báo giáo viên đang dạy ở trường.
- Thành phần bị ảnh hưởng: `packages/market-client/src/MarketShell.tsx`, `apps/tutor/src/*`, `tests/e2e/195-marketplace-isolation.spec.ts`, `tests/e2e/196-tutor-verification.spec.ts`, `tests/e2e/197-tutor-booking.spec.ts`, `tests/e2e/198-market-safety.spec.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không (chỉ gọi thêm `DELETE /market/tutor/school-role` đã có).
- Ảnh hưởng chức năng cũ: khu gia sư không còn là một trang dài; vùng "Buổi dạy và thu nhập" tách thành trang Buổi dạy và trang Thu nhập.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/tutor`, `apps/market`; kiểm thử giao diện 195, 196, 197, 198.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: ứng dụng Gia sư theo bản thiết kế đã duyệt: cột điều hướng bảy trang, lịch tuần, thu nhập theo buổi, xác minh dạng các bước, bỏ khai báo trường (YCTD-361).
- Không đổi dữ liệu, API, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Áp bản thiết kế cho ứng dụng Gia sư | YCTD-361 |
