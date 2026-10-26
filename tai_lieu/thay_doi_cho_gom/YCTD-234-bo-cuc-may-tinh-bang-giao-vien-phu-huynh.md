---
yctd: YCTD-234
tieu_de: DT-26 phần 26d: bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh
ngay: 2026-10-27
phien_ban_de_xuat: 0.155.0
---

## 02 Nhật ký

### 2026-10-27 — DT-26 phần 26d: bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh

#### Công việc đã thực hiện

- Ứng dụng giáo viên: màn hình Chế độ lớp học (chọn sẵn lớp của tiết đang dạy theo thời khoá biểu, khung phải điểm danh, sổ đầu bài, công cụ lớp học, trình chiếu toàn màn hình, giữ màn hình sáng); trang chủ hai khung từ 1024 px, danh sách lớp hai cột từ 768 px; màn hình điểm danh, sổ đầu bài, công cụ lớp học có tuỳ chọn nhúng.
- Ứng dụng phụ huynh: trang chủ hai cột từ 768 px. Cả hai ứng dụng: các màn hình nới rộng từ 768 px; vùng chạm 44 px, chữ ô nhập 16 px, màu báo, chữ phụ, liên kết, nút chính đủ tương phản 4,5:1, đặt ở `index.css` của từng ứng dụng, không sửa `packages/ui`.
- Kiểm thử: `apps/teacher` 14/14 (chọn tiết đang dạy, giờ Việt Nam); e2e spec 183 (bốn khổ thiết bị) và spec 180 không còn cần đường cơ sở cho 26d.

#### Quyết định

- Yêu cầu truy cập đặt ở CSS của từng ứng dụng, viết ngoài lớp để thắng lớp tiện ích; màu của bộ chủ đề ghi đè bằng biến trong ứng dụng; `packages/ui` để phần 26e sửa (QĐ-38).
- Giờ Việt Nam tính bằng UTC+7 cố định thay cho `Intl.DateTimeFormat` vì Safari cho kết quả khác.
- Spec 183 giả lập danh sách lớp và thời khoá biểu bằng `page.route` vì việc CI theo khổ thiết bị không có năm học.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-234, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-250, P19-09, AC-900 đến AC-902, CT-1135 đến CT-1137, MH-360, QĐ-38.

#### Vấn đề tồn đọng

- Trò chơi kiến thức (23c) chưa có trên nhánh chính nên chưa có thẻ trong chế độ lớp học; thêm khi 23c gộp. Thử trên máy tính bảng thật khi Eric có máy.

## 24 Yêu cầu thay đổi

### YCTD-234: DT-26 phần 26d: bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh – 2026-10-27

- Lý do: phần 26d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 18.3, 18.4 (đợt 2 của DT-26); đợt 1 (26a, 26b, 26c) đã gộp; phiên điều phối giao cho phiên chủ DT-26 ngày 2026-10-27.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Chế độ lớp học** (`apps/teacher/src/screens/ClassroomModeScreen.tsx`): nút "Chế độ lớp học" ở Lớp của tôi; khung "Lớp của tiết" chọn sẵn lớp của tiết đang dạy, không có thì tiết sắp tới trong ngày (hàm thuần `classroom-mode-logic.ts`, giờ Việt Nam UTC+7); khung phải có thẻ Điểm danh (lớp có điểm danh theo ngày), Sổ đầu bài (giáo viên có lớp điểm danh theo tiết), Công cụ lớp học; trình chiếu chỉ công cụ lớp học, phóng to gấp rưỡi, toàn màn hình, ẩn danh sách lớp và các thẻ có thông tin riêng; Screen Wake Lock giữ màn hình sáng khi trình duyệt cho phép. Màn hình điểm danh, sổ đầu bài, công cụ lớp học thêm tuỳ chọn `embedded` (bỏ đầu trang, nút quay lại).
  - **Bố cục**: dưới 768 px giữ nguyên; từ 768 px các màn hình nới rộng (`md:max-w-3xl`), danh sách lớp hai cột, trang chủ phụ huynh hai cột; từ 1024 px trang chủ giáo viên hai khung.
  - **Truy cập** (`apps/teacher/src/index.css`, `apps/parent/src/index.css`): nút, ô nhập, thẻ chọn cao tối thiểu 44 px; chữ ô nhập tối thiểu 16 px; biến màu báo lỗi, cảnh báo, thông tin, thành công, chữ phụ, liên kết, nút chính đậm hơn để đạt 4,5:1 (axe không còn lỗi tương phản). Gỡ các mục của 26d khỏi `tests/e2e/device-baseline.json`.
  - Trò chơi kiến thức (23c) chưa có trên nhánh chính: thêm thẻ khi 23c gộp.
- Thành phần bị ảnh hưởng: `apps/teacher`, `apps/parent`, `tests` (spec 183, đường cơ sở). Không sửa `packages/ui`, máy chủ, cơ sở dữ liệu.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không (dùng `/api/v1/classes?mine=true`, `/api/v1/timetables/mine` sẵn có).
- Giao diện bị ảnh hưởng: MH-360; bố cục các màn hình của hai ứng dụng ở khổ từ 768 px; màu của hai ứng dụng đậm hơn một bậc.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: khổ điện thoại giữ bố cục cũ; nút nhỏ hơn 44 px được nới; e2e khổ máy tính hiện có đạt không sửa kỳ vọng.
- Kiểm thử cần thực hiện: `apps/teacher` (CT-1135), e2e spec 183 ở bốn khổ thiết bị (CT-1136, CT-1137), spec 180, e2e khổ máy tính của hai ứng dụng; typecheck, lint.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-26 phần 26d, bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh (YCTD-234).
- Chức năng mới: chế độ lớp học của giáo viên (P19-09, MH-360); trang chủ giáo viên hai khung, trang chủ phụ huynh hai cột; vùng chạm, cỡ chữ ô nhập, màu tương phản đạt yêu cầu truy cập.
- Lỗi đã sửa: nút, ô nhập dưới 44 px, chữ ô nhập dưới 16 px (iOS tự phóng to), màu chữ thiếu tương phản ở hai ứng dụng.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Kiểm thử: CT-1135 đến CT-1137. Kết quả: kiểm thử đơn vị ứng dụng giáo viên 14/14 đạt; e2e thiết bị (E2E_DEVICES=full, spec 180 và 183, bốn dự án `dien-thoai`, `may-tinh-bang-doc`, `may-tinh-bang-ngang`, `dien-thoai-webkit`) 24/24 đạt, chạy lặp spec 183 hai lần 16/16 đạt; e2e máy tính 01–09, 151, 181, 187 30/30 đạt (spec 02 nới thời gian chờ tại máy, không đưa vào mã); typecheck, lint, prettier của `apps/teacher`, `apps/parent`, `tests` đạt. Spec 183 chặn service worker (`serviceWorkers: block`) vì ở WebKit yêu cầu do service worker gửi không đi qua `page.route`, và giả lập Fullscreen API vì WebKit chạy không giao diện có thể treo khi vào toàn màn hình thật.
- Rủi ro: màu hai ứng dụng đậm hơn cổng quản trị cho tới khi 26e sửa `packages/ui`; chưa thử trên máy tính bảng thật.
- Khả năng tương thích: khổ điện thoại giữ bố cục cũ; không đổi API, dữ liệu.
- Phương án quay lui: hoàn lại commit gộp của nhánh; không có thay đổi dữ liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-26 phần 26d: chế độ lớp học, bố cục máy tính bảng và yêu cầu truy cập của ứng dụng giáo viên, phụ huynh | YCTD-234 |

## index Số đếm

| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +1 |
