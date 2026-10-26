---
yctd: YCTD-292
tieu_de: Mở năm học nhanh hơn: chạy tệp thay đổi cấu trúc theo lô
ngay: 2026-10-27
phien_ban_de_xuat: 0.147.1
---

## 02 Nhật ký

### 2026-10-27 — Mở năm học nhanh hơn: chạy tệp thay đổi cấu trúc theo lô (YCTD-292)

#### Công việc đã thực hiện

- Tìm nguyên nhân e2e `02-academic-years.spec.ts` hỏng ở bước mở năm học (chờ quá 30 giây thông báo "Đã mở năm học…", CI của PR 193 và PR 196): mở năm học tạo cơ sở dữ liệu năm học mới rồi chạy toàn bộ tệp thay đổi cấu trúc ngay trong yêu cầu; `migrateToLatest` chạy mỗi tệp một giao dịch bằng `migrateUp()`, mỗi lần Kysely lại kiểm bảng ghi tệp đã chạy, bảng khóa, đọc trạng thái.
- Đo trên máy làm việc ngày 2026-10-27 với 100 tệp năm học: mỗi tệp một giao dịch 40,5 đến 41,3 giây; mọi tệp trong một giao dịch 4,7 giây; theo lô 10 tệp 8,6 giây; theo lô 20 tệp 6,3 giây. Gần 90% thời gian là chi phí lặp của từng lần chạy, không phải câu lệnh tạo bảng.
- Sửa `database/src/migrate.ts`: `migrateToLatest` chạy theo lô, mỗi lô tối đa `MIGRATIONS_PER_TRANSACTION` (10) tệp trong một giao dịch bằng `migrateTo` đến tệp cuối của lô; danh sách tệp chờ đọc một lần. Thêm kiểm thử chạy theo lô (đủ tệp, đúng thứ tự tên, lô cuối thiếu, chạy lại không còn tệp).

#### Quyết định

- Không tăng thời gian chờ của e2e: thời gian thật đã giảm khoảng 4,7 lần, còn khoảng 9 giây ở máy làm việc.
- Chọn lô 10 thay vì một giao dịch hay lô 20: vẫn tránh lỗi "out of shared memory" khi nhiều trường tạo cơ sở dữ liệu cùng lúc (lý do cũ của cách chạy từng tệp), chấp nhận chậm hơn lô 20 khoảng 2 giây.
- Không đổi mở năm học sang việc nền có theo dõi tiến trình: khi chạy nhanh như hiện nay thì chưa cần; ghi ở vấn đề tồn đọng nếu số tệp còn tăng nhiều.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-292, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Nếu số tệp năm học tiếp tục tăng mạnh, cân nhắc dựng sẵn cơ sở dữ liệu mẫu đã chạy tệp ở môi trường vận hành hoặc đưa mở năm học sang việc nền có tiến trình.

## 24 Yêu cầu thay đổi

### YCTD-292: Mở năm học nhanh hơn: chạy tệp thay đổi cấu trúc theo lô – 2026-10-27

- Lý do: e2e `02-academic-years.spec.ts` ("Hiệu trưởng tạo năm học, lưu lịch, đánh dấu tuần nghỉ Tết và mở năm học") hỏng hai lần trên CI vì bước mở năm học quá 30 giây. Mở năm học chạy 100 tệp thay đổi cấu trúc năm học, mỗi tệp một giao dịch; các đợt DT-23 đến DT-28 thêm tệp nên thời gian vượt ngưỡng. Đo được: mỗi tệp một giao dịch khoảng 41 giây, theo lô 10 tệp khoảng 8,6 giây (máy làm việc, 2026-10-27).
- Nội dung thay đổi: `migrateToLatest` (`database/src/migrate.ts`) chạy theo lô tối đa 10 tệp mỗi giao dịch (`MIGRATIONS_PER_TRANSACTION`), dùng `migrateTo` đến tệp cuối của lô theo thứ tự tên; vẫn giữ giới hạn số tệp mỗi giao dịch để không vượt bảng khóa dùng chung khi nhiều trường tạo cơ sở dữ liệu cùng lúc. Áp dụng cho mọi loại cơ sở dữ liệu (định danh, hệ thống, năm học, nền tảng) ở mọi chỗ gọi: mở năm học, lệnh `migrate`, khởi tạo trường, cơ sở dữ liệu mẫu của kiểm thử. Thêm kiểm thử chạy theo lô ở `database/src/migrate.test.ts`.
- Thành phần bị ảnh hưởng: `database` (`src/migrate.ts`, `src/migrate.test.ts`).
- Dữ liệu bị ảnh hưởng: không (cùng tệp, cùng thứ tự; tệp lỗi giữa lô thì cả lô hoàn tác, chạy lại từ đầu lô).
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: mở năm học, khởi tạo trường, lệnh `migrate` nhanh hơn; kết quả không đổi.
- Kiểm thử cần thực hiện: kiểm thử đơn vị `database`; e2e `single` (spec 02 mở năm học); kiểm thử nhiều trường.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: chạy tệp thay đổi cấu trúc theo lô để mở năm học nhanh hơn (YCTD-292).
- Chức năng mới: không có.
- Lỗi đã sửa: mở năm học quá 30 giây làm e2e spec 02 hỏng; mở năm học chạy 100 tệp từ khoảng 41 giây còn khoảng 9 giây.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Kiểm thử: `database/src/migrate.test.ts` thêm ca chạy theo lô.
- Rủi ro: một lô giữ nhiều khóa hơn một tệp; giới hạn 10 tệp mỗi lô.
- Khả năng tương thích: tương thích hoàn toàn.
- Phương án quay lui: hoàn lại commit; đặt `MIGRATIONS_PER_TRANSACTION` về 1 cho cách chạy cũ.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Mở năm học nhanh hơn: chạy tệp thay đổi cấu trúc theo lô 10 tệp mỗi giao dịch | YCTD-292 |
