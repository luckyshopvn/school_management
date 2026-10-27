---
yctd: YCTD-254
tieu_de: DT-27 phần 27d1: khoá học ghi sẵn của chương trình gia sư (phần riêng của gia sư)
ngay: 2026-10-27
phien_ban_de_xuat: 0.161.0
---

## 02 Nhật ký

### 2026-10-27 — DT-27 phần 27d1: khoá học ghi sẵn của chương trình gia sư

#### Công việc đã thực hiện

- Đọc lại mục 19.4, 19.5 (27d) và 20 (28b, 28d) của `32_KE_HOACH_THEO_HE_THONG_SO.md`; 27d dựa trên lõi LMS của 28b và 28d (YCTD-270), 28d chưa gộp.
- Theo đồng ý của phiên điều phối ngày 2026-10-27, tách 27d thành **27d1** (phần riêng của gia sư, chỉ cần 28b, làm ở đây) và **27d2** (tiến độ đã xem, bài đã nộp, điểm cho học sinh, giáo viên, phụ huynh; làm sau khi 28d gộp).
- Năm học `0200` (sau dải 0170 đến 0199 của DT-28 vì khoá ngoại tới `course_spaces` 0172, `course_activities` 0173; dải 0150 đến 0169 của DT-27 chạy trước nên không dùng được; 27d2 không thêm bảng): `tutoring_program_courses`, `tutoring_media_views`.
- Máy chủ `apps/api/src/tutoring/tutoring-courses.ts`: gắn chương trình gia sư với khoá tự chọn của 28b, đồng bộ ghi danh khi duyệt hoặc rút đơn, bài video của khoá, đường dẫn xem ký 5 phút có nhật ký, phát theo đoạn (HTTP Range).
- Giao diện: khối Khoá học ghi sẵn ở chi tiết chương trình (cổng quản trị), khoá học của con (ứng dụng phụ huynh), khoá học gia sư (kênh học sinh); thành phần dùng chung `LessonVideoList`.
- Kiểm thử: CT-27d1-1 đến CT-27d1-3.

#### Quyết định

- Khoá học ghi sẵn là một `course_spaces` loại `elective` của 28b; chương, bài, điều kiện mở, kết quả hoạt động soạn ở Học trực tuyến của 28b; không dựng bảng khoá học thứ hai; không dùng bảng hệ thống 0101 đến 0103 (không còn phần riêng cần dùng qua nhiều năm học).
- Bài video là hoạt động `resource` của khoá trỏ tới học liệu 22h1 là tệp video đã công bố (đi qua kiểm duyệt, giấy phép của 22h1).
- Phát theo đoạn bằng đường dẫn ký 5 phút (khoá băm dữ liệu trẻ của trường), `inline`, không lưu đệm, giao diện không có nút tải; chuyển mã nhiều độ phân giải là tuỳ chọn, mặc định tắt (phát tệp gốc), chưa làm.
- Không đụng tiến độ, bảng điểm hoạt động của 28d; nhật ký xem chỉ ghi lần lấy đường dẫn.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-254, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-350, PQ-145, P02-115, AC-1010, AC-1011, MH-470, MH-471, CT-1295 đến CT-1297.

#### Vấn đề tồn đọng

- 27d2 sau khi 28d gộp; đọc cả tệp video vào bộ nhớ khi phát (chưa phát thẳng từ kho tệp theo đoạn); chuyển mã tuỳ chọn.

## 24 Yêu cầu thay đổi

### YCTD-254: DT-27 phần 27d1: khoá học ghi sẵn của chương trình gia sư (phần riêng của gia sư) – 2026-10-27

- Lý do: phần 27d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 19.4, 19.5, xây trên lõi LMS của DT-28 (YCTD-270). 27d cần 28b và 28d; 28d chưa gộp nên tách: **27d1** (phần này, chỉ cần 28b) và **27d2** (tiến độ cho học sinh, giáo viên, phụ huynh dùng 28d; làm sau khi 28d gộp; không thêm bảng, YCTD-261). Phiên điều phối đồng ý ngày 2026-10-27.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Gắn khoá** (năm học `0200`, sau dải của DT-28 vì khoá ngoại tới bảng của 28b; dải DT-27 chạy trước nên không dùng được): giáo viên dạy chương trình hoặc Ban Giám hiệu tạo khoá học ghi sẵn cho chương trình đã duyệt: một `course_spaces` loại `elective` (tên, mô tả của chương trình, hiện với học sinh, giáo viên ghi danh), giáo viên của chương trình là giáo viên của khoá; `tutoring_program_courses` (một chương trình một khoá). Tạo lại thì trả khoá đã có.
  - **Ghi danh**: học sinh có đơn được duyệt là học sinh của khoá (`course_enrollments` của 28b đang học); rút đơn hoặc không duyệt thì gỡ (giữ lịch sử); đồng bộ khi tạo khoá, khi duyệt đơn, khi rút đơn.
  - **Bài video**: hoạt động `resource` đã công bố của khoá, học liệu 22h1 là tệp video đã công bố; giáo viên dạy, Ban Giám hiệu, cha mẹ của học sinh có đơn được duyệt, học sinh đang học khoá (kênh student) lấy đường dẫn xem ký 5 phút; mỗi lần lấy ghi `tutoring_media_views` và nhật ký thao tác; phát theo đoạn (HTTP Range, 206, 416), `inline`, không lưu đệm, không có nút tải.
  - **Không làm ở 27d1**: tiến độ đã xem, bài tập đã nộp, điểm cho học sinh, giáo viên, phụ huynh (27d2, sau 28d); chuyển mã nhiều độ phân giải (tuỳ chọn, mặc định tắt).
- Thành phần bị ảnh hưởng: `database` (năm học `0200`), `packages/ui` (`LessonVideoList`), `apps/api` (`tutoring/tutoring-courses*.ts`, hai chỗ đồng bộ ghi danh ở `tutoring.ts`, đăng ký ở `application.module.ts`, chính sách tuyến), `apps/portal`, `apps/parent`.
- Dữ liệu bị ảnh hưởng: năm học thêm 2 bảng; khoá tạo ra là dòng của `course_spaces`, `course_space_teachers`, `course_enrollments` của 28b.
- API bị ảnh hưởng: `POST, GET /api/v1/tutoring/programs/{id}/course`, `POST /api/v1/tutoring/course-media/{activityId}/link`, `GET /api/v1/tutoring/course-media/{activityId}/stream` (đường dẫn ký), `GET /api/v1/children/{id}/tutoring/programs/{pid}/course`, `POST /api/v1/children/{id}/tutoring/course-media/{aid}/link`, `GET /api/v1/student/tutoring/courses`, `POST /api/v1/student/tutoring/course-media/{aid}/link`.
- Giao diện bị ảnh hưởng: MH-470, MH-471, MH-349, MH-354.
- Quyền bị ảnh hưởng: PQ-145 (không thêm mã quyền).
- Ảnh hưởng chức năng cũ: không (chương trình chưa tạo khoá thì không có gì mới).
- Kiểm thử cần thực hiện: `apps/api` (`tutoring-courses`, `tutoring`, `learning`, `tenancy-matrix`); kiểm tĩnh.
- Còn lại: 27d2 (sau 28d); phát thẳng từ kho tệp theo đoạn; chuyển mã tuỳ chọn.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-27 phần 27d1, khoá học ghi sẵn của chương trình gia sư, phần riêng của gia sư (YCTD-254).
- Chức năng mới: khoá học ghi sẵn gắn với chương trình gia sư trên lõi LMS 28b, ghi danh theo đơn được duyệt, xem bài video theo đoạn bằng đường dẫn ký có nhật ký cho giáo viên, cha mẹ, học sinh (P02-115).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0200`.
- Thay đổi API: nhóm khoá học của `/tutoring`, `/children/{id}/tutoring`, `/student/tutoring`.
- Kiểm thử: CT-1295 đến CT-1297 (CT-27d1-1 đến CT-27d1-3).
- Rủi ro: thấp; tệp video lớn đọc cả tệp vào bộ nhớ khi phát.
- Khả năng tương thích: không đổi hành vi cũ.
- Phương án quay lui: hoàn lại commit gộp; khoá đã tạo vẫn là khoá tự chọn bình thường của 28b.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27d1: khoá học ghi sẵn của chương trình gia sư (khoá tự chọn của lõi LMS, ghi danh theo đơn, xem video theo đoạn có nhật ký); tiến độ ở 27d2 sau 28d | YCTD-254 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +1 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +2 |
| Màn hình dự kiến | Số lượng | +2 |
| Ca kiểm thử khởi đầu | Số lượng | +3 |
| Chức năng đã liệt kê | Số lượng | +1 |
| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +2 |
| 16 | bảng dự kiến | +2 |

## Nối dòng

| 32_KE_HOACH_THEO_HE_THONG_SO.md | 27d | Tách ngày 2026-10-27 (YCTD-254): **27d1** phần riêng của gia sư chỉ cần 28b (gắn khoá tự chọn với chương trình, ghi danh theo đơn, phát video theo đoạn có đường dẫn ký; năm học 0200) đã làm; **27d2** tiến độ cho học sinh, giáo viên, phụ huynh làm sau khi 28d gộp (YCTD-261; dùng kết quả hoạt động của 28b, 28d, không thêm bảng; số 0157 của kế hoạch không dùng) |
| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27 phần 27d1 (YCTD-254: khoá học ghi sẵn của chương trình gia sư) |
| 14_DAC_TA_GIAO_DIEN.md | MH-349 | YCTD-254: khối Khoá học ghi sẵn ở chi tiết chương trình đã duyệt (MH-470) |
| 14_DAC_TA_GIAO_DIEN.md | MH-354 | YCTD-254: khoá học ghi sẵn của chương trình con có đơn được duyệt (MH-471) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-350 | Khoá học ghi sẵn của chương trình gia sư (YCTD-254): khoá là khoá tự chọn của lõi LMS 28b, mỗi chương trình đã duyệt một khoá, do giáo viên dạy hoặc Ban Giám hiệu tạo; học sinh của khoá là học sinh có đơn được duyệt (rút đơn hoặc không duyệt thì gỡ); bài video là học liệu 22h1 là tệp video đã công bố; xem bằng đường dẫn ký 5 phút theo đoạn, không tải xuống, mỗi lần lấy đường dẫn ghi nhật ký; chỉ giáo viên dạy, Ban Giám hiệu, cha mẹ của học sinh có đơn được duyệt, học sinh đang học khoá xem được |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-115 | PQ-145 | Khoá học ghi sẵn của chương trình gia sư (YCTD-254, DT-27 phần 27d1): không thêm mã quyền; tạo, xem khoá cho giáo viên dạy chương trình (`P02.tutoring.teach`) và Ban Giám hiệu (`P02.tutoring.manage`); học sinh xem bằng `P02.learning.study` ở kênh student; cha mẹ theo quan hệ phụ huynh với học sinh có đơn được duyệt; soạn nội dung khoá theo quyền của Học trực tuyến (28b) |
| 10_YEU_CAU_CHUC_NANG.md | P02-102 | P02-115 | Khoá học ghi sẵn của chương trình gia sư (YCTD-254) | Giáo viên; Ban Giám hiệu; cha mẹ; học sinh | Chương trình đã duyệt, bài video của khoá | Tạo khoá tự chọn gắn chương trình, ghi danh theo đơn, xem bài video theo đoạn | Khoá, ghi danh, nhật ký xem | BR-350, PQ-145 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1010 | Cho chương trình gia sư đã duyệt có đơn được duyệt / Khi giáo viên dạy tạo khoá học ghi sẵn, tạo lại, giáo viên khác tạo, cha mẹ rút đơn rồi gửi lại và được duyệt / Thì khoá là khoá tự chọn của lõi LMS có giáo viên của chương trình, không tạo trùng, giáo viên khác bị chặn, học sinh bị gỡ khi rút đơn và ghi danh lại khi đơn mới được duyệt (CT-1295, CT-1296; YCTD-254) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1011 | Cho khoá có bài video đã công bố / Khi cha mẹ của học sinh có đơn, người khác, giáo viên dạy lấy đường dẫn xem; trình duyệt tải theo đoạn; đường dẫn sửa / Thì chỉ người được xem có đường dẫn, phát 206 đúng đoạn, 416 khi ngoài tệp, đường dẫn sửa bị từ chối, mỗi lần lấy đường dẫn có nhật ký (CT-1297; YCTD-254) |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-470 | Cổng: Gia sư trực tuyến › 1. Chương trình gia sư › Khoá học ghi sẵn (YCTD-254): nút Tạo khoá học ghi sẵn (chương trình đã duyệt), số học sinh được ghi danh, nhắc soạn ở Học trực tuyến, danh sách bài video và xem (không có nút tải) | Giáo viên dạy, Ban Giám hiệu |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-471 | Ứng dụng phụ huynh: khoá học ghi sẵn của con (mục Gia sư) và Khoá học gia sư ở trang chủ học sinh (YCTD-254): bài video theo chương, xem (không có nút tải) | Cha mẹ, học sinh |
| 16_CO_SO_DU_LIEU.md | tutoring_attendance, tutoring_room_events (từ YCTD-252) | tutoring_program_courses, tutoring_media_views (từ YCTD-254) | Khoá học ghi sẵn của chương trình gia sư và nhật ký xem video bài học (BR-350; năm học `0200`) | khoá: program_id (khoá chính), course_space_id (khoá tự chọn của 28b, duy nhất), created_by_name; nhật ký: activity_id, viewer_user_id, viewer_name, child_id, viewed_at |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1295 | P02-115 | CT-27d1-1: tạo khoá cho chương trình chưa duyệt, đã duyệt, giáo viên khác, tạo lại | 409; 403; khoá tự chọn có giáo viên, một học sinh | Đạt; `apps/api/src/tutoring/tutoring-courses.test.ts`; 1010 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1296 | P02-115 | CT-27d1-2: rút đơn thì gỡ khỏi khoá, đơn mới chờ duyệt chưa ghi danh, được duyệt thì ghi danh lại | removed, removed, active | Đạt; `apps/api/src/tutoring/tutoring-courses.test.ts`; 1010 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1297 | P02-115 | CT-27d1-3: bài video đã công bố, đường dẫn ký, phát theo đoạn, người không được xem, đường dẫn sửa, nhật ký | 206 bytes 0-99/1000; 416; 403; hai dòng nhật ký | Đạt; `apps/api/src/tutoring/tutoring-courses.test.ts`; 1011 | Cao |
