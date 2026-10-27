---
yctd: YCTD-213
tieu_de: DT-23 phần 23c: trò chơi kiến thức và thẻ đáp án giấy
ngay: 2026-10-27
phien_ban_de_xuat: 0.150.0
---

## 02 Nhật ký

### 2026-10-27 — DT-23 phần 23c: trò chơi kiến thức và thẻ đáp án giấy

#### Công việc đã thực hiện

- Nhận bản dở dang của phiên trước (nhánh `dt-23-phan-23c`, kiểm thử logic ứng dụng giáo viên đạt, kiểm thử API và e2e 152 đã viết nhưng chưa chạy, chưa có tài liệu); gộp origin/main (23e, 26a, 28a, 28b), chạy kiểm thử API, e2e 152, viết tài liệu.
- Cơ sở dữ liệu: năm học `0126`, `0127`. Máy chủ API: nhóm `/classroom-games`. Ứng dụng giáo viên: thẻ Trò chơi trong Công cụ lớp học (hỏi đáp theo vòng, vòng quay, ô chữ, thẻ đáp án giấy in và quét).
- Thêm quy tắc BR-280, chức năng P02-100 đến P02-102, biện pháp BM-140 đến BM-141, màn hình MH-400 đến MH-401, kịch bản CT-1200 đến CT-1204, tiêu chí AC-940 đến AC-944. Kết quả ngày 27/10/2026: kiểm thử đơn vị ứng dụng giáo viên `apps/teacher/src/tools/games/games.test.ts` (CT-23c-1 đến CT-23c-3) và `apps/api/src/classroom-games/classroom-games.test.ts` (CT-23c-4 đến CT-23c-6) đạt; kiểm thử đơn vị toàn kho đạt (bộ 23c, 23e, 23a chạy riêng; toàn bộ để CI chạy); kiểm thử giao diện `tests/e2e/152-classroom-games.spec.ts` (CT-23c-7) đạt cùng 02, 03, 06, 08, 101, 151 (14/14); kiểm tĩnh đa thuê bao, ma trận cách ly, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Trò chơi chạy trên máy giáo viên, học sinh không cần thiết bị; bộ đọc thẻ đáp án tự viết (không thư viện ngoài, không vấn đề giấy phép); hình quét không rời khỏi máy; điểm trò chơi không vào sổ điểm.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-213, `07_QUY_TAC_NGHIEP_VU.md` BR-280, `10_YEU_CAU_CHUC_NANG.md` P02-100 đến P02-102, `11_TIEU_CHI_NGHIEM_THU.md` AC-940 đến AC-944, `14_DAC_TA_GIAO_DIEN.md` MH-400 đến MH-401, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1200 đến CT-1204, `22_BAO_MAT.md` BM-140 đến BM-141, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Thử đọc thẻ trên nhiều mẫu camera và ánh sáng thật ở lớp; mẫu thẻ in cần thử in thật; ô chữ chỉ sinh từ câu trả lời ngắn.

## 24 Yêu cầu thay đổi

### YCTD-213: DT-23 phần 23c: trò chơi kiến thức và thẻ đáp án giấy – 2026-10-27

- Lý do: phần 23c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 15 (kế hoạch DT-23 ở YCTD-210). Giáo viên cần trò chơi ôn tập ở màn hình lớp mà học sinh không cần thiết bị, và cách kiểm tra nhanh bằng thẻ đáp án giấy.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - **Trò chơi** (thẻ "Trò chơi" trong Công cụ lớp học): hỏi đáp theo vòng (chia nhóm, vòng, điểm theo nhóm, bảng điểm), vòng quay (chọn câu, nhóm, phần thưởng), ô chữ (sinh lưới từ câu trả lời ngắn, chỉnh tay được); câu hỏi chỉ từ ngân hàng đã duyệt của khối của lớp, lọc theo môn, chủ đề, mức nhận thức, dạng câu.
  - **Thẻ đáp án giấy**: mẫu thẻ do dự án tự thiết kế (bốn đáp án, mã thẻ gắn số thứ tự trong lớp, không in họ tên đầy đủ), in A4 nhiều thẻ hoặc thẻ lẻ; giáo viên chiếu câu hỏi, học sinh giơ thẻ, giáo viên quét bằng camera điện thoại trong trình duyệt; bộ đọc tự viết chạy trên máy, không tải hình hay video lên máy chủ, sửa tay được trước khi lưu.
  - **Ghi kết quả**: lượt chơi lưu khi kết thúc (gửi lại từ hàng đợi ngoại tuyến không trùng); máy chủ chấm lại trắc nghiệm, đúng sai; mỗi câu đã dùng ghi lịch sử sử dụng câu hỏi (22g2) kèm tỷ lệ đúng của lớp; điểm trò chơi không vào sổ điểm Thông tư 22, 27, chỉ chuyển sang bảng điểm nhanh (23b) khi giáo viên chọn.
  - Quy tắc: trò chơi kiến thức ở màn hình lớp (ô chữ sinh từ câu trả lời ngắn, vòng quay, hỏi đáp theo vòng có chia nhóm và bảng điểm) và thẻ đáp án giấy (mẫu thẻ do dự án tự thiết kế: bốn đáp án A, B, C, D, mã thẻ gắn với số thứ tự trong lớp, không in họ tên đầy đủ; in A4 nhiều thẻ một trang hoặc thẻ lẻ; quét bằng camera điện thoại của giáo viên); câu hỏi chỉ lấy từ ngân hàng câu hỏi đã duyệt (22g1) của khối của lớp; giáo viên dùng với lớp mình phụ trách (cùng phạm vi công cụ lớp học 23b); hình quét thẻ xử lý hoàn toàn trên máy giáo viên, không tải hình hay video lên máy chủ, chỉ lưu kết quả (học sinh hoặc nhóm chọn gì cho câu nào); máy chủ chấm lại câu trắc nghiệm, đúng sai theo đáp án trong ngân hàng, gửi lại lượt chơi (ngoại tuyến) không trùng nhờ `client_id`; mỗi câu đã dùng ghi một dòng lịch sử sử dụng câu hỏi (22g2) kèm tỷ lệ đúng của lớp; điểm trò chơi không vào sổ điểm Thông tư 22, 27, chỉ chuyển sang bảng điểm nhanh của 23b khi giáo viên chọn.
- Thành phần bị ảnh hưởng: cơ sở dữ liệu (`database/school-year/migrations/0126_create_classroom_games.ts`, `0127_add_game_question_usages.ts`, `schema.ts`), máy chủ API (`apps/api/src/classroom-games/`), ứng dụng giáo viên (`apps/teacher/src/tools/games/`, `ClassroomToolsScreen.tsx`).
- Dữ liệu bị ảnh hưởng: hai bảng mới ở năm học (`classroom_game_sessions`, `classroom_game_answers`); `question_usages` cho phép `exam_id` trống và thêm `source`, `game_session_id`, `correct_rate`. Dòng cũ giữ nguyên (nguồn `exam`).
- API bị ảnh hưởng: nhóm mới `/classroom-games` (danh mục, câu hỏi, lưu và xem lượt chơi).
- Giao diện bị ảnh hưởng: MH-400 đến MH-401.
- Quyền bị ảnh hưởng: không thêm quyền; giáo viên dùng với lớp mình phụ trách như công cụ lớp học.
- Ảnh hưởng chức năng cũ: thống kê chất lượng câu của 22g2 đọc `question_usages` nay có thể có dòng nguồn `game` không có đề; mã đọc theo `exam_id` bỏ qua dòng không có đề.
- Hạn chế:
  - ô chữ chỉ sinh từ câu có đáp án ngắn; từ không xếp được báo lại để giáo viên chỉnh;
  - bộ đọc thẻ phụ thuộc ánh sáng, độ nét camera và độ phẳng của thẻ; sửa tay được; chưa thử với nhiều mẫu máy thật;
  - mẫu thẻ cần thử in thật ở máy in của trường; thẻ lẻ và A4 theo khổ chuẩn;
  - trò chơi chỉ chạy ở ứng dụng giáo viên (màn hình lớp), chưa có chế độ nhiều thiết bị;
  - điểm trò chơi không vào sổ điểm (theo kế hoạch).
- Kiểm thử cần thực hiện: kịch bản CT-1200 đến CT-1204 (trong mã kiểm thử là CT-23c-1 đến CT-23c-7); kiểm thử đơn vị `apps/teacher/src/tools/games/games.test.ts`, `apps/api/src/classroom-games/classroom-games.test.ts`; kiểm thử giao diện `tests/e2e/152-classroom-games.spec.ts`; chạy lại kiểm thử đa thuê bao, ma trận cách ly, toàn bộ kiểm thử đơn vị và giao diện, build, kiểm tra kiểu, lint, kiểm tra định dạng.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-23 phần 23c, trò chơi kiến thức và thẻ đáp án giấy (YCTD-213).
- Chức năng mới: thẻ Trò chơi trong Công cụ lớp học (hỏi đáp theo vòng, vòng quay, ô chữ, thẻ đáp án giấy in và quét bằng camera trên máy); lưu lượt chơi, lịch sử sử dụng câu hỏi kèm tỷ lệ đúng.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0126`, `0127`.
- Thay đổi API: `/classroom-games/…`.
- Kiểm thử: kịch bản CT-1200 đến CT-1204. Kết quả ngày 27/10/2026: kiểm thử đơn vị ứng dụng giáo viên `apps/teacher/src/tools/games/games.test.ts` (CT-23c-1 đến CT-23c-3) và `apps/api/src/classroom-games/classroom-games.test.ts` (CT-23c-4 đến CT-23c-6) đạt; kiểm thử đơn vị toàn kho đạt (bộ 23c, 23e, 23a chạy riêng; toàn bộ để CI chạy); kiểm thử giao diện `tests/e2e/152-classroom-games.spec.ts` (CT-23c-7) đạt cùng 02, 03, 06, 08, 101, 151 (14/14); kiểm tĩnh đa thuê bao, ma trận cách ly, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: lộ hình quét thẻ (hình chỉ xử lý trên máy giáo viên, máy chủ không nhận hình); kết quả đọc thẻ sai (giáo viên sửa tay được trước khi lưu); dòng lịch sử sử dụng câu hỏi không có đề làm sai thống kê của 22g2 (mã đọc bỏ qua dòng nguồn `game`).
- Khả năng tương thích: không đổi hành vi cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 23c; chạy phần quay lui của tệp năm học `0127`, `0126`.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-23 phần 23c: trò chơi kiến thức và thẻ đáp án giấy (hỏi đáp theo vòng, vòng quay, ô chữ, thẻ đáp án giấy quét bằng camera trên máy) | YCTD-213 |

## index Số đếm

| Chức năng đã liệt kê | Số lượng | +3 |
| 10 | mã chức năng | +3 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +5 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +1 |
| Ca kiểm thử khởi đầu | Số lượng | +5 |
| Bảng dữ liệu dự kiến | Số lượng | +2 |
| Màn hình dự kiến | Số lượng | +2 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-23 phần 23c (YCTD-213: trò chơi kiến thức và thẻ đáp án giấy) |
