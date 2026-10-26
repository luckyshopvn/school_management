---
yctd: YCTD-252
tieu_de: DT-27 phần 27b: chương trình gia sư trong trường, lịch và đặt buổi, điểm danh
ngay: 2026-10-26
phien_ban_de_xuat: 0.152.0
---

## 02 Nhật ký

### 2026-10-26 — DT-27 phần 27b: chương trình gia sư trong trường, lịch và đặt buổi, điểm danh

#### Công việc đã thực hiện

- Đọc mục 19.2, 19.3, 19.4, 19.5 (27b), 19.11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà thời khoá biểu (`timetable_lessons`, `period_slots`, `applyingVersions`), sổ điểm (`subject_term_results`), quan hệ phụ huynh, luồng trao đổi, thông báo, góp ý, phân hệ của gói dịch vụ (S5a), mẫu phần 23a.
- Thêm năm học 0152 đến 0154, định danh 0172, hàm thuần quy định dạy thêm, máy chủ API `tutoring/`, bốn trang ở cổng quản trị, màn hình ở ứng dụng giáo viên, mục Gia sư ở ứng dụng phụ huynh, kiểm thử đơn vị và e2e 191.
- Thêm BR-239 đến BR-241, PQ-110, P02-86 đến P02-88, AC-883 đến AC-885, MH-349 đến MH-354, CT-1122 đến CT-1129; phiên bản {PHIEN_BAN}.

#### Quyết định

- Quy định dạy thêm là dữ liệu có ngày hiệu lực (`tutoring_rules`); khóa kiểm ở máy chủ bằng hàm thuần dùng chung với giao diện.
- Giới hạn tiết đếm cả chương trình khác cùng môn; kiểm khi xếp buổi và khi duyệt đơn.
- Đơn đăng ký lưu bản chụp văn bản và mã băm; người duyệt là giáo viên chủ nhiệm, giáo viên dạy hoặc Ban Giám hiệu.
- Tin nhắn của chương trình dùng luồng trao đổi giáo viên với cha mẹ hiện có; không có luồng riêng với học sinh.
- Điểm danh tự động là chỗ nối `recordRoomEvents` cho 27a, có điểm cuối giả lập; không dựng video.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-252, `07_QUY_TAC_NGHIEP_VU.md` BR-239 đến BR-241, `08_VAI_TRO_NGUOI_DUNG.md` PQ-110, `10_YEU_CAU_CHUC_NANG.md` P02-86 đến P02-88, `11_TIEU_CHI_NGHIEM_THU.md` AC-883 đến AC-885, `14_DAC_TA_GIAO_DIEN.md` MH-349 đến MH-354, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1122 đến CT-1129; phiên bản {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Thông tư 29/2024 chưa đối chiếu bản gốc (E-07); điểm danh tự động khi 27a gộp; thu phí, thù lao ở 27c.

## 24 Yêu cầu thay đổi

### YCTD-252: DT-27 phần 27b: chương trình gia sư trong trường, lịch và đặt buổi, điểm danh – 2026-10-26

- Lý do: phần 27b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 19.4, 19.5 (kế hoạch DT-27 ở YCTD-250); ràng buộc của Thông tư 29/2024/TT-BGDĐT sửa đổi bởi Thông tư 19/2026/TT-BGDĐT theo bảng 19.2 mục 1. Văn bản căn cứ: dùng bảng 19.2 do Claude tra ngày 2026-10-26 (Thông tư 19/2026 đọc toàn văn; Thông tư 29/2024 qua nguồn thứ cấp, **chưa đọc lại bản gốc trong phần này**, các dòng ghi "chưa xác minh" ở 19.2 giữ nguyên; luật sư đối chiếu theo việc E-07 trước khi dùng ở trường thật).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Chương trình** (năm học `0152_create_tutoring_programs`): tên, cấp, môn, chủ đề, **loại nội dung bắt buộc** `curriculum` (môn học trong chương trình, chịu Thông tư 29) hoặc `enrichment` (bổ trợ ngoài chương trình), nhóm đối tượng (chưa đạt môn học kỳ liền kề, bồi dưỡng học sinh giỏi, lớp cuối cấp ôn thi), có thu tiền hay không, hình thức, sĩ số tối đa, thời gian, mẫu đơn đăng ký, lớp đối tượng, giáo viên dạy; danh sách học sinh được đăng ký do giáo viên xác nhận, có gợi ý học sinh chưa đạt môn ở kỳ gần nhất từ sổ điểm (`subject_term_results`); giáo viên lập, nộp; Ban Giám hiệu duyệt trước khi mở đăng ký.
  - **Khóa của Thông tư 29 ở máy chủ** (hàm thuần ở `@school-management/shared`, kiểm thử theo từng dòng của bảng 19.2): `curriculum` không thu tiền (cả ràng buộc của bảng), bắt buộc nhóm đối tượng và môn, không cho cấp Tiểu học; mỗi môn không quá 02 tiết/tuần/học sinh cộng mọi chương trình `curriculum` cùng môn, trừ khi có **quyết định tăng thời lượng của Sở** (số, ngày, môn, số tiết tối đa mới, tệp ở kho tệp, học sinh áp dụng; năm học `0153`); số liệu (2 tiết, cấp bị chặn, độ dài tiết mặc định) là dữ liệu có ngày hiệu lực ở `tutoring_rules`, dòng đầu hiệu lực 15/05/2026.
  - **Buổi học** (`0153`): buổi lẻ hoặc lặp theo tuần (tối đa 200 buổi một lần), số tiết quy đổi theo khung giờ tiết của trường (chưa khai thì theo độ dài tiết mặc định); kiểm trùng thời khoá biểu chính khoá đang áp dụng (chỉ đọc) của giáo viên dạy và của lớp đối tượng theo khung giờ tiết; hủy buổi có lý do, báo cha mẹ; chỗ nối phòng video của 27a (`video_room_ref`).
  - **Đăng ký** (`0154`): cha mẹ thấy chương trình đã duyệt mở cho con (theo lớp đối tượng hoặc danh sách học sinh), đọc nội dung và mẫu đơn, tích xác nhận rồi gửi; máy chủ lưu bản chụp văn bản đơn và mã băm; giáo viên chủ nhiệm, giáo viên dạy hoặc Ban Giám hiệu duyệt (kiểm sĩ số và giới hạn tiết); cha mẹ rút đơn; mỗi học sinh một đơn còn hiệu lực ở mỗi chương trình.
  - **Điểm danh** (`0154`): giáo viên xác nhận (có mặt, vào muộn, về sớm, vắng) ở cổng quản trị hoặc ứng dụng giáo viên; vắng thì báo cha mẹ một lần qua thông báo hiện có; **chỗ nối của 27a**: hàm `recordRoomEvents` nhận sự kiện vào, ra phòng và suy ra điểm danh gợi ý (vào muộn, về sớm theo ngưỡng 10 phút), chưa dựng video; trước khi 27a gộp có điểm cuối giả lập cho giáo viên của buổi.
  - **Tin nhắn luôn có cha mẹ:** giáo viên của chương trình nhắn qua luồng trao đổi giáo viên với cha mẹ của học sinh (`message_threads` hiện có), không có luồng riêng với học sinh.
  - **Đường dây nóng, phản ánh:** ứng dụng phụ huynh hiện đường dây nóng của trường (cấu hình đăng nhập hiện có) và ô "Phản ánh dạy thêm" gửi vào hộp thư góp ý của trường (Thông tư 19/2026 Điều 5).
  - **Phân hệ và quyền:** phân hệ "Gia sư trực tuyến" ở cổng quản trị (từ Tiểu học, gói dịch vụ bật tắt được, S5a), quyền `P02.tutoring.manage` (Hiệu trưởng, Phó Hiệu trưởng) và `P02.tutoring.teach` (giáo viên chủ nhiệm, bộ môn, tổ trưởng, Ban Giám hiệu) ở tệp định danh `0172_add_tutoring_permissions` (dải định danh 0170 đến 0179 của DT-27; 27a không dùng định danh); không hiện cho Phụ huynh, Học sinh.
- Thành phần bị ảnh hưởng: `database` (năm học 0152 đến 0154, định danh 0172), `packages/shared` (`tutoring.ts`, quyền, menu), `apps/api` (`tutoring/`), `apps/portal` (`tutoring/`, bốn trang), `apps/teacher` (màn hình Gia sư trong trường), `apps/parent` (mục Gia sư của con), `tests` (e2e 191); tài liệu `01`, `02`, `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `23`, `24`, `32`, `index.md`.
- Dữ liệu bị ảnh hưởng: cơ sở dữ liệu năm học thêm 11 bảng `tutoring_*`; định danh thêm hai quyền; không đổi bảng hiện có.
- API bị ảnh hưởng: thêm nhóm `/api/v1/tutoring` và `/api/v1/children/{id}/tutoring`.
- Giao diện bị ảnh hưởng: MH-349 đến MH-352 (cổng quản trị), MH-353 (ứng dụng giáo viên), MH-354 (ứng dụng phụ huynh).
- Quyền bị ảnh hưởng: PQ-110.
- Ảnh hưởng chức năng cũ: không (trường không bật phân hệ hoặc không có chương trình thì không thấy gì mới); số phân hệ của cổng quản trị tăng một nên các kiểm thử đếm phân hệ cập nhật số.
- Kiểm thử cần thực hiện: kiểm thử đơn vị `apps/api` (quy tắc thuần và luồng có cơ sở dữ liệu), `database`; kiểm tĩnh; e2e 191 và các spec bị ảnh hưởng (01, 58, 59, 83, 134 nhiều trường); CI chạy toàn bộ e2e.
- Còn lại: điểm danh tự động khi 27a gộp (gọi `recordRoomEvents` từ nhật ký phòng); thu phí `enrichment` và thù lao ở 27c.
- Trạng thái: Đã triển khai (PR 196)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-26

- Phạm vi thay đổi: DT-27 phần 27b, chương trình gia sư trong trường, lịch và đặt buổi, điểm danh (YCTD-252).
- Chức năng mới: chương trình gia sư theo Thông tư 29/2024 sửa bởi Thông tư 19/2026 (P02-86); buổi học lặp theo tuần không trùng thời khoá biểu, không quá 2 tiết/tuần/môn, quyết định tăng thời lượng của Sở (P02-87); đơn đăng ký của cha mẹ, điểm danh, báo vắng, tin nhắn qua cha mẹ, đường dây nóng (P02-88).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0152` đến `0154` (11 bảng `tutoring_*`), định danh `0172` (hai quyền).
- Thay đổi API: nhóm `/tutoring`, `/children/{id}/tutoring` (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-1122 đến CT-1129 (CT-27b-1 đến CT-27b-8 trong mã kiểm thử): quy tắc thuần, luồng có cơ sở dữ liệu ở `apps/api`, e2e 191; e2e toàn bộ do CI chạy.
- Rủi ro: Thông tư 29/2024 chưa đối chiếu bản gốc (E-07); trường chưa khai khung giờ tiết thì không so được giờ với thời khoá biểu; điểm danh tự động chờ 27a.
- Khả năng tương thích: không đổi hành vi cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 27b; gói dịch vụ tắt phân hệ "Gia sư trực tuyến".

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27b: chương trình gia sư trong trường (loại nội dung, nhóm đối tượng, không thu tiền với môn học), buổi lặp theo tuần không trùng thời khoá biểu, giới hạn 2 tiết/tuần/môn, quyết định của Sở, đơn của cha mẹ, điểm danh, báo vắng | YCTD-252 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +3 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +3 |
| Màn hình dự kiến | Số lượng | +6 |
| Ca kiểm thử khởi đầu | Số lượng | +8 |
| Chức năng đã liệt kê | Số lượng | +3 |
