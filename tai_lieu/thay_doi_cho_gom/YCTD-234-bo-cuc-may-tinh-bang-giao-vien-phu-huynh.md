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

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-234, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-253, P19-09, AC-905 đến AC-907, CT-1146 đến CT-1148, MH-363, QĐ-38.

#### Vấn đề tồn đọng

- Trò chơi kiến thức (23c) là một công cụ trong Công cụ lớp học nên có sẵn ở thẻ Công cụ lớp học và khi trình chiếu của chế độ lớp học. Thử trên máy tính bảng thật khi Eric có máy.

## 24 Yêu cầu thay đổi

### YCTD-234: DT-26 phần 26d: bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh – 2026-10-27

- Lý do: phần 26d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 18.3, 18.4 (đợt 2 của DT-26); đợt 1 (26a, 26b, 26c) đã gộp; phiên điều phối giao cho phiên chủ DT-26 ngày 2026-10-27.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Chế độ lớp học** (`apps/teacher/src/screens/ClassroomModeScreen.tsx`): nút "Chế độ lớp học" ở Lớp của tôi; khung "Lớp của tiết" chọn sẵn lớp của tiết đang dạy, không có thì tiết sắp tới trong ngày (hàm thuần `classroom-mode-logic.ts`, giờ Việt Nam UTC+7); khung phải có thẻ Điểm danh (lớp có điểm danh theo ngày), Sổ đầu bài (giáo viên có lớp điểm danh theo tiết), Công cụ lớp học; trình chiếu chỉ công cụ lớp học, phóng to gấp rưỡi, toàn màn hình, ẩn danh sách lớp và các thẻ có thông tin riêng; Screen Wake Lock giữ màn hình sáng khi trình duyệt cho phép. Màn hình điểm danh, sổ đầu bài, công cụ lớp học thêm tuỳ chọn `embedded` (bỏ đầu trang, nút quay lại).
  - **Bố cục**: dưới 768 px giữ nguyên; từ 768 px các màn hình nới rộng (`md:max-w-3xl`), danh sách lớp hai cột, trang chủ phụ huynh hai cột; từ 1024 px trang chủ giáo viên hai khung.
  - **Truy cập** (`apps/teacher/src/index.css`, `apps/parent/src/index.css`): nút, ô nhập, thẻ chọn cao tối thiểu 44 px; chữ ô nhập tối thiểu 16 px; biến màu báo lỗi, cảnh báo, thông tin, thành công, chữ phụ, liên kết, nút chính đậm hơn để đạt 4,5:1 (axe không còn lỗi tương phản). Gỡ các mục của 26d khỏi `tests/e2e/device-baseline.json`.
  - Trò chơi kiến thức (23c) có sẵn trong thẻ Công cụ lớp học (công cụ "Trò chơi").
- Thành phần bị ảnh hưởng: `apps/teacher`, `apps/parent`, `tests` (spec 183, đường cơ sở). Không sửa `packages/ui`, máy chủ, cơ sở dữ liệu.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không (dùng `/api/v1/classes?mine=true`, `/api/v1/timetables/mine` sẵn có).
- Giao diện bị ảnh hưởng: MH-363; bố cục các màn hình của hai ứng dụng ở khổ từ 768 px; màu của hai ứng dụng đậm hơn một bậc.
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: khổ điện thoại giữ bố cục cũ; nút nhỏ hơn 44 px được nới; e2e khổ máy tính hiện có đạt không sửa kỳ vọng.
- Kiểm thử cần thực hiện: `apps/teacher` (CT-1146), e2e spec 183 ở bốn khổ thiết bị (CT-1147, CT-1148), spec 180, e2e khổ máy tính của hai ứng dụng; typecheck, lint.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-26 phần 26d, bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh (YCTD-234).
- Chức năng mới: chế độ lớp học của giáo viên (P19-09, MH-363); trang chủ giáo viên hai khung, trang chủ phụ huynh hai cột; vùng chạm, cỡ chữ ô nhập, màu tương phản đạt yêu cầu truy cập.
- Lỗi đã sửa: nút, ô nhập dưới 44 px, chữ ô nhập dưới 16 px (iOS tự phóng to), màu chữ thiếu tương phản ở hai ứng dụng.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Kiểm thử: CT-1146 đến CT-1148. Kết quả: kiểm thử đơn vị ứng dụng giáo viên 14/14 đạt; e2e thiết bị (E2E_DEVICES=full, spec 180 và 183, bốn dự án `dien-thoai`, `may-tinh-bang-doc`, `may-tinh-bang-ngang`, `dien-thoai-webkit`) 24/24 đạt, chạy lặp spec 183 hai lần 16/16 đạt; e2e máy tính 01–09, 151, 181, 187 30/30 đạt (spec 02 nới thời gian chờ tại máy, không đưa vào mã); typecheck, lint, prettier của `apps/teacher`, `apps/parent`, `tests` đạt. Spec 183 chặn service worker (`serviceWorkers: block`) vì ở WebKit yêu cầu do service worker gửi không đi qua `page.route`, và giả lập Fullscreen API vì WebKit chạy không giao diện có thể treo khi vào toàn màn hình thật. Sau khi gộp origin/main (PR 192, 196, 198): spec 183 ở bốn dự án thiết bị 8/8, e2e máy tính 01–09, 151, 181 29/29 đạt.
- Rủi ro: màu hai ứng dụng đậm hơn cổng quản trị cho tới khi 26e sửa `packages/ui`; chưa thử trên máy tính bảng thật.
- Khả năng tương thích: khổ điện thoại giữ bố cục cũ; không đổi API, dữ liệu.
- Phương án quay lui: hoàn lại commit gộp của nhánh; không có thay đổi dữ liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-26 phần 26d: chế độ lớp học, bố cục máy tính bảng và yêu cầu truy cập của ứng dụng giáo viên, phụ huynh | YCTD-234 |

## index Số đếm

| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +1 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | cuối bảng 12.1 Quy tắc về phân cấp phê duyệt | BR-253 | Bố cục máy tính bảng của ứng dụng giáo viên, phụ huynh (YCTD-234, DT-26 phần 26d): dưới 768 px giữ bố cục điện thoại; từ 768 px các màn hình nới rộng (khung nội dung tối đa 768 px), danh sách lớp của giáo viên và trang chủ phụ huynh chia hai cột; từ 1024 px trang chủ giáo viên và chế độ lớp học chia hai khung; chế độ lớp học chọn sẵn lớp của tiết đang dạy theo thời khoá biểu của giáo viên (giờ Việt Nam), không có tiết đang dạy thì tiết sắp tới trong ngày, không có thì lớp đầu; khung phải chuyển giữa điểm danh (lớp có điểm danh theo ngày), sổ đầu bài (giáo viên có lớp điểm danh theo tiết), công cụ lớp học; trình chiếu chỉ hiện công cụ lớp học của lớp đang chọn, phóng to gấp rưỡi, toàn màn hình, ẩn danh sách lớp, điểm danh, sổ đầu bài; giữ màn hình sáng khi trình duyệt cho phép. Truy cập: nút, ô nhập, thẻ chọn cao tối thiểu 44 px, chữ trong ô nhập tối thiểu 16 px, tương phản chữ tối thiểu 4,5:1 |
| 10_YEU_CAU_CHUC_NANG.md | cuối bảng 20. Phân hệ P19 — Kênh truy cập và thông báo | P19-09 | Chế độ lớp học và bố cục máy tính bảng (YCTD-234, DT-26 phần 26d) | Giáo viên (chế độ lớp học); mọi người dùng ứng dụng giáo viên, phụ huynh (bố cục) | Lớp của tôi, thời khoá biểu của giáo viên (`/api/v1/timetables/mine`) | Chọn lớp theo tiết đang dạy; khung phải điểm danh, sổ đầu bài, công cụ lớp học; trình chiếu; bố cục hai cột, hai khung theo khổ màn hình | Dùng được trên máy tính bảng, màn hình lớn, máy chiếu | BR-253 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-905 | Cho giáo viên có hai lớp, thời khoá biểu có tiết của lớp thứ hai đang diễn ra / Khi đăng nhập ở khổ điện thoại 390 × 844, máy tính bảng dọc 820 × 1180, ngang 1180 × 820, mở Chế độ lớp học, chọn Công cụ lớp học, bấm Trình chiếu rồi Thoát / Thì trang chủ một cột ở khổ hẹp, hai khung (thông báo, chấm công bên trái; lớp của tôi bên phải) từ 1024 px; chế độ lớp học báo "Đang dạy: tiết …" và chọn sẵn lớp thứ hai, khung lớp và khung việc xếp trên dưới ở khổ hẹp, cạnh nhau từ 1024 px; trình chiếu ẩn danh sách lớp và thẻ Sổ đầu bài, thoát thì hiện lại | P19-09 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-906 | Cho phụ huynh đã đăng nhập / Khi mở trang chủ ở khổ điện thoại và máy tính bảng / Thì dưới 768 px một cột như trước, từ 768 px hai cột (thông báo, đón trả, khảo sát bên trái; thẻ của từng con bên phải) | P19-09 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-907 | Cho trang đăng nhập, trang chủ giáo viên, chế độ lớp học, trang chủ phụ huynh ở bốn khổ thiết bị / Khi đo bằng bộ kiểm của 26c / Thì không cuộn ngang cả trang, không ô nhập chữ dưới 16 px, không nút, ô nhập, thẻ chọn dưới 44 × 44 px, axe không lỗi nghiêm trọng (gồm tương phản màu); đường cơ sở của 26c không còn mục nào của 26d | P19-09 |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-363 | Ứng dụng giáo viên: Chế độ lớp học (YCTD-234, nút "Chế độ lớp học" ở Lớp của tôi): đầu trang "Chế độ lớp học"; khung "Lớp của tiết" (nút Lớp của tôi, dải "Đang dạy: tiết N (giờ) môn, lớp …" hoặc "Tiết tới: …", nút từng lớp có trạng thái được chọn); khung lớp đang chọn: thẻ Điểm danh, Sổ đầu bài, Công cụ lớp học (màn hình đã có, bỏ đầu trang), nút Trình chiếu; trình chiếu: tên lớp, nút Thoát trình chiếu, công cụ lớp học phóng to gấp rưỡi, toàn màn hình. Bố cục chung của ứng dụng giáo viên, phụ huynh: dưới 768 px như trước; từ 768 px màn hình nới rộng, danh sách lớp và trang chủ phụ huynh hai cột; từ 1024 px trang chủ giáo viên hai khung; nút, ô nhập cao tối thiểu 44 px, chữ ô nhập 16 px; màu báo lỗi, cảnh báo, thông tin, thành công, chữ phụ, liên kết, nút chính đậm hơn bộ chủ đề chung để đạt tương phản 4,5:1 | P19-09 |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1146 | P19-09 | CT-26d-1: chọn tiết đang dạy (trong giờ tiết, giữa hai tiết chọn tiết tới theo giờ, hết tiết, ngày không tiết, thiếu giờ tiết), giờ Việt Nam theo UTC+7 | Đúng | Đạt; `apps/teacher/src/screens/classroom-mode-logic.test.ts` | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1147 | P19-09 | CT-26d-2: giáo viên ở bốn khổ thiết bị: trang chủ, chế độ lớp học (lớp theo tiết, thẻ, hai khung từ 1024 px, trình chiếu), không cuộn ngang, vùng chạm, cỡ chữ, axe | Đúng | Đạt; e2e spec 183 (`tests/e2e/183-tablet-teacher-parent.spec.ts`), dự án `dien-thoai`, `may-tinh-bang-doc`, `may-tinh-bang-ngang`, `dien-thoai-webkit`; AC-905, AC-907 | Cao |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1148 | P19-09 | CT-26d-3: trang chủ phụ huynh hai cột từ 768 px; trang đăng nhập hai ứng dụng không còn vi phạm (spec 180 không cần đường cơ sở cho 26d) | Đúng | Đạt; e2e spec 183, 180; AC-906, AC-907 | Cao |
