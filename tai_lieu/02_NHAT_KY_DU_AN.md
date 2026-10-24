# 02. NHẬT KÝ DỰ ÁN

- Mô tả: Ghi nhận công việc, quyết định, thay đổi và vấn đề tồn đọng theo ngày, ngày mới nhất ở trên cùng.
- Phiên bản: 0.41
- Ngày cập nhật: 2026-10-24
- Trạng thái: Đang cập nhật

## Quy ước ghi nhật ký

- Mục mới ghi ở trên cùng; không sửa nội dung mục cũ.
- Từ ngày 2026-10-09, mỗi mục ghi theo mẫu của Vibecoding_Flow: công việc đã thực hiện, quyết định, thay đổi, vấn đề tồn đọng. Các mục cũ giữ nguyên dạng và tên tệp cũ.
- Mỗi mục ghi rõ ngày, người thực hiện, nội dung, tệp bị ảnh hưởng, kết quả kiểm thử.
- Không ghi thông tin tạm thời như kết quả tra cứu, đường dẫn tạm, thông báo lỗi của công cụ.

## Nhật ký theo ngày

### 2026-10-24 — DT-20 phần 20d: sổ đầu bài và điểm danh theo tiết

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà thời khoá biểu của 22c1 (bản đang áp dụng, tiết theo giáo viên), điểm danh theo ngày Mầm non (`attendance_records`), báo vắng của phụ huynh (`absence_records`).
- Cơ sở dữ liệu: tệp năm học `0080`, định danh `0071`. Máy chủ API: sổ đầu bài theo tuần, tiết của tôi trong ngày, chi tiết tiết kèm điểm danh mặc định, ghi tiết, giáo viên ký tiết, Ban giám hiệu ký sổ tuần, tổng hợp chuyên cần, điểm danh theo tiết của con.
- Cổng quản trị: 7.6 Sổ đầu bài, 7.7 Chuyên cần theo tiết. Ứng dụng giáo viên: Sổ đầu bài. Ứng dụng phụ huynh: Điểm danh theo tiết, Báo vắng ở cấp phổ thông.
- Thêm quy tắc BR-174, chức năng P02-45 đến P02-47, quyền PQ-95, màn hình MH-265, MH-266, kịch bản CT-864 đến CT-869, tiêu chí AC-766 đến AC-768. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/class-logs/class-logs.test.ts` CT-20d-1 đến CT-20d-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã đạt 1069/1069; kiểm thử giao diện `tests/e2e/91-class-logs.spec.ts` (CT-20d-6) đạt; toàn bộ kiểm thử giao diện đạt 162/163 (CT-20b-7 `88-boarding-conduct.spec.ts` lỗi chập chờn: danh sách ăn chưa làm mới sau khi đổi ngày, không liên quan 20d; lượt chạy trước cùng mã đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Sổ đầu bài một dòng một lớp, ngày, tiết, lấy tiết theo bản thời khoá biểu đang áp dụng; điểm danh theo tiết là bảng riêng, không đổi điểm danh theo ngày của Mầm non; mặc định vắng có phép khi phụ huynh đã báo vắng ngày đó; Ban giám hiệu ký theo tuần và khoá cả tuần; quyền ký sổ tuần cho Hiệu trưởng, Phó Hiệu trưởng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-162, `07_QUY_TAC_NGHIEP_VU.md` BR-174, `08_VAI_TRO_NGUOI_DUNG.md` PQ-95, `10_YEU_CAU_CHUC_NANG.md` P02-45 đến P02-47, `11_TIEU_CHI_NGHIEM_THU.md` AC-766 đến AC-768, `14_DAC_TA_GIAO_DIEN.md` MH-265, MH-266, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-864 đến CT-869, `23_LICH_SU_PHIEN_BAN.md` 0.111.0.

#### Vấn đề tồn đọng

- 22c2: dạy thay, đổi tiết theo ngày để ghi sổ đầu bài cho tiết ngoài thời khoá biểu; thông báo điểm danh theo tiết cho phụ huynh; xuất sổ đầu bài.


### 2026-10-24 — Kế hoạch DT-22 thư viện, bồi dưỡng, kho học liệu số (22a, 22e, 22h)

#### Công việc đã thực hiện

- Đọc bản kế hoạch DT-22 đã được Eric duyệt (các phần còn lại 22a, 22e, 22h), mục 9 (DT-18), 11 (DT-20), 12 (DT-21, PR 140) và mã trên nhánh chính: kho hồ sơ 18e (`professional_*`, `DossierSigner`, `my-work`), `files` và `FileStorage`, giấy khen có mã tra cứu của 22d, `staff_certificates`, `lesson_plans`, `subjects` (20a); rà bảng có tên gần giống (`library_items` của Mầm non, `asset_loans`) để không dùng nhầm.
- Thêm mục 13 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.45): kế hoạch DT-22 gồm bốn phần 22a, 22e, 22h1, 22h2 chạy ba đợt; phạm vi chi tiết; quyết định thiết kế; rủi ro; bảng tiến độ.
- Ghi YCTD-180 (chỉ đổi tài liệu).

#### Quyết định

- AI là thành phần riêng, mặc định tắt (Eric chốt): ba phần của DT-22 không gọi AI, YCTD-185 giữ chỗ; khách hàng là trường đơn lẻ: chia sẻ liên trường chỉ làm gói tệp chạy nội bộ, bản thật chờ DT-SaaS. Claude tự chọn phần còn lại theo ủy quyền của Eric ngày 2026-10-11.
- Tách 22h thành 22h1 (lõi, không cần 22g1, làm ngay sau 22a hoặc 22e) và 22h2 (câu hỏi, gói; chờ 22g1 của DT-21 gộp); câu hỏi chỉ ở ngân hàng của 22g1, kho tham chiếu.
- Giữ sẵn YCTD-181 đến YCTD-185 (dự phòng đến YCTD-189), migration năm học từ 0100, hệ thống từ 0040, định danh từ 0090, e2e từ `120-`; chừa khoảng trống sau DT-21 để DT-20, DT-21 không va số.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-180, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 13. Không đổi mã nguồn, không đổi phiên bản phần mềm.

#### Vấn đề tồn đọng

- 22h2 chờ 22g1 (DT-21); đọc văn bản gốc (chuẩn thư viện phổ thông, quy chế bồi dưỡng thường xuyên, khung năng lực số, giấy phép học liệu) trước khi làm từng phần; PR này và PR 140 (YCTD-166) cùng sửa đầu `02`, `24`, `index.md` nên phần gộp sau xử lý xung đột và đánh lại số phiên bản tài liệu.

### 2026-10-24 — Kế hoạch DT-21 THCS và THPT (kèm 22g kiểm tra, đánh giá)

#### Công việc đã thực hiện

- Đọc dòng DT-21 của kế hoạch DT-18 và phần 22g của kế hoạch DT-22; đọc mục 10 (DT-19), mục 11 (DT-20) và mã trên nhánh chính: `subjects`, `curriculum_subjects`, phân công giảng dạy theo môn (20a), nề nếp và thi đua lớp (20b), khung giờ tiết, bản thời khoá biểu, hàm xung đột (22c1), khối K6 đến K12 và `curricula` (19b).
- Thêm mục 12 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.44): kế hoạch DT-21 gồm chín phần 21a, 22g1, 21b, 21c, 21d, 21e, 22g2, 21f, 21g chạy năm đợt; bảng tái dùng và làm mới; rủi ro, cách kiểm; bảng tiến độ.
- Ghi YCTD-166 (chỉ đổi tài liệu).

#### Quyết định

- THCS và THPT chung khung, tách phần theo chức năng; tách 22g thành 22g1 (đề, làm sớm) và 22g2 (chấm, chuyển điểm vào sổ điểm 21c, không có bảng điểm thứ hai); thi trực tuyến cho học sinh để lại; hồ sơ thi chạy nội bộ; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Giữ sẵn YCTD-167 đến YCTD-175, migration năm học 0084 đến 0092, hệ thống 0028 và 0029, định danh 0075 đến 0083, e2e `95-` đến `103-`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-166, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 12. Không đổi mã nguồn, không đổi phiên bản phần mềm.

#### Vấn đề tồn đọng

- Khảo sát hệ thống của Sở cấp THCS, THPT khi Eric có tài khoản; đọc toàn văn Thông tư 22/2021/TT-BGDĐT, quy chế xét tốt nghiệp, thi hiện hành trước khi làm 21c, 21e, 21f; 20c, 20d, 20e, 22c2, 20f của DT-20 chưa gộp, các phần DT-21 phụ thuộc ghi ở 12.3.

### 2026-10-23 — DT-20 phần 20c: đánh giá học sinh theo Thông tư 27/2020

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và Thông tư 27/2020/TT-BGDĐT; rà môn học, chương trình, phân công theo môn của 20a, lịch học kỳ theo cấp của 19b.
- Cơ sở dữ liệu: tệp năm học `0079_create_student_assessments`, tệp định danh `0070_add_assessment_permissions`.
- Máy chủ API: cấu hình đánh giá theo cấp, nạp mặc định; nhập kết quả định kỳ theo phân công, hạn nhập, khoá số liệu; nhận xét thường xuyên; tổng hợp cuối kỳ; gợi ý, xác nhận cuối năm; phụ huynh xem; chuyển cấu hình sang năm học mới.
- Cổng quản trị: 7.3 Đánh giá học sinh; ứng dụng giáo viên: màn hình đánh giá; ứng dụng phụ huynh: kết quả đánh giá.
- Thêm quy tắc BR-171 đến BR-173, chức năng P02-42 đến P02-44, kịch bản CT-857 đến CT-863, tiêu chí AC-762 đến AC-765. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/assessments/assessments.test.ts` CT-20c-1 đến CT-20c-6 đạt 6/6; kiểm thử đơn vị đang có không sửa kỳ vọng (thêm mục 7.3 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của Tiểu học của CT-19c-1); kiểm thử đơn vị toàn bộ kho mã đạt 1064/1064; kiểm thử giao diện `tests/e2e/90-student-assessments.spec.ts` (CT-20c-7) đạt; toàn bộ kiểm thử giao diện trước khi gộp 22c1 đạt 160/161 (spec 90 mới đạt; spec 38 nhắc nợ chập chờn, không liên quan), sau khi gộp chạy ở CI; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mức đạt có hạng để quy tắc cuối năm không phụ thuộc mã; chủ nhiệm nhập môn chưa có giáo viên bộ môn; hạn nhập trống theo ngày kết thúc học kỳ; khoá theo kỳ và lớp; phụ huynh chỉ thấy kỳ đã khoá.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-161, `07_QUY_TAC_NGHIEP_VU.md` BR-171 đến BR-173, `10_YEU_CAU_CHUC_NANG.md` P02-42 đến P02-44, `11_TIEU_CHI_NGHIEM_THU.md` AC-762 đến AC-765, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-857 đến CT-863, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.8. Phiên bản 0.110.0.

#### Vấn đề tồn đọng

- Nhập Excel theo mẫu lớp × môn, xuất bảng tổng hợp ra tệp; màn hình sửa thư viện câu nhận xét, mức đạt, danh mục ở cổng (điểm cuối đã có).

### 2026-10-23 — DT-20 phần 22c1: thời khoá biểu, phần khung

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và phần 22c của kế hoạch DT-22; rà bảng `timetables` của Giảng dạy, lịch theo cấp (YCTD-152), công cụ nhập Excel (16a), trang thời khoá biểu chờ sẵn của website (18f), môn học và phân công theo môn (YCTD-158).
- Cơ sở dữ liệu: tệp hệ thống `0026`, năm học `0078`, định danh `0069`. Máy chủ API: khung giờ tiết, bản thời khoá biểu, tiết theo lớp, kiểm tra xung đột (hàm thuần dùng chung với 22c2), ban hành, nhập Excel, xem bản đang áp dụng; trang website.
- Cổng quản trị: 7.3 Khung giờ tiết học, 7.4 Thời khoá biểu. Ứng dụng giáo viên: Lịch dạy của tôi. Ứng dụng phụ huynh: Thời khoá biểu của con.
- Thêm quy tắc BR-170, chức năng P02-39 đến P02-41, quyền PQ-94, màn hình MH-263, MH-264, kịch bản CT-851 đến CT-856, tiêu chí AC-759 đến AC-761. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/timetables/timetables.test.ts` CT-22c1-1 đến CT-22c1-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã đạt 1058/1058 (không sửa kỳ vọng của kiểm thử đang có, trừ danh sách đường dẫn của CT-19c-1); kiểm thử giao diện `tests/e2e/89-timetables.spec.ts` (CT-22c1-6) đạt; toàn bộ kiểm thử giao diện đạt 161/161; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22c1 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Thời khoá biểu theo môn là bảng mới, có phiên bản và ngày áp dụng; giáo viên của tiết theo phân công; ban hành chặn khi còn xung đột cứng; nhập Excel một dòng một tiết; khung giờ lưu ở cơ sở dữ liệu hệ thống cạnh lịch theo cấp; quyền lập, ban hành cho Hiệu trưởng, Phó Hiệu trưởng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-160, `07_QUY_TAC_NGHIEP_VU.md` BR-170, `08_VAI_TRO_NGUOI_DUNG.md` PQ-94, `10_YEU_CAU_CHUC_NANG.md` P02-39 đến P02-41, `11_TIEU_CHI_NGHIEM_THU.md` AC-759 đến AC-761, `14_DAC_TA_GIAO_DIEN.md` MH-263, MH-264, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-851 đến CT-856, `23_LICH_SU_PHIEN_BAN.md` 0.109.0.

#### Vấn đề tồn đọng

- 22c2: máy xếp tự động, chỉnh tay có kiểm tra ngay, dạy thay, đổi tiết, định mức tiết, báo cáo tiết dạy, mã QR; 20d dùng bản đang áp dụng làm nguồn sổ đầu bài, điểm danh theo tiết.


### 2026-10-23 — DT-20 phần 20b: bán trú Tiểu học; nề nếp và thi đua lớp

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà dịch vụ bán trú, số suất của bếp (`classCounts`), kiểm thực 22b, báo cơm, tính tiền ăn theo ngày có mặt.
- Cơ sở dữ liệu: tệp năm học `0077_create_boarding_and_conduct`, tệp định danh `0068_add_boarding_conduct_permissions`.
- Máy chủ API: bán trú lớp ngoài Mầm non (danh sách ăn, cắt suất, chốt, mở lại, phụ huynh cắt suất), bếp và tiền ăn đọc danh sách bán trú; nề nếp (cấu hình, tiêu chí, ghi điểm, xếp hạng), chuyển cấu hình sang năm học mới.
- Cổng quản trị: 4.8 Bán trú, 4.9 Nề nếp, thi đua lớp (chỉ Tiểu học), thẻ nề nếp ở 1.4 Cấu hình trường; ứng dụng giáo viên, phụ huynh theo cấp.
- Thêm quy tắc BR-167 đến BR-169, chức năng P04-07, P02-37, P02-38, kịch bản CT-844 đến CT-850, tiêu chí AC-755 đến AC-758. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/boarding/boarding.test.ts` CT-20b-1 đến CT-20b-6 đạt 6/6; kiểm thử đơn vị đang có không sửa kỳ vọng (thêm hai mục menu vào bảng đối chiếu điều kiện cũ của CT-15e-2; CT-19c-1, CT-19c-2 so cây menu Mầm non với cây gốc bỏ hai mục chỉ của Tiểu học, cây menu Mầm non giữ nguyên); kiểm thử đơn vị toàn bộ kho mã đạt 1053/1053; kiểm thử giao diện `tests/e2e/88-boarding-conduct.spec.ts` (CT-20b-7) đạt; toàn bộ kiểm thử giao diện đạt 160/160; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giờ chốt cắt suất trong ngày dùng giờ vào học của đơn vị; danh sách ăn là đăng ký trừ cắt suất, chốt thì lưu số suất; tiền ăn lớp ngoài Mầm non theo ngày đã chốt mà không cắt suất; điểm tuần là điểm nền cộng điểm ghi, tháng và học kỳ lấy trung bình tuần.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-159, `07_QUY_TAC_NGHIEP_VU.md` BR-167 đến BR-169, `10_YEU_CAU_CHUC_NANG.md` P04-07, P02-37, P02-38, `11_TIEU_CHI_NGHIEM_THU.md` AC-755 đến AC-758, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-844 đến CT-850, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.8. Phiên bản 0.108.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-23 — DT-20 phần 20a: nền Tiểu học

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà `curricula`, khối mẫu (YCTD-152), phân công phụ trách lớp, chuyển năm học, chi tiết hồ sơ học sinh; tra bảng thời lượng cấp Tiểu học của Chương trình giáo dục phổ thông 2018.
- Cơ sở dữ liệu: tệp năm học `0076_create_subjects`. Máy chủ API: môn học, nạp bộ mẫu, số tiết theo khối, phân công theo môn, tổng tiết của giáo viên, môn tự chọn; chép sang năm học mới.
- Cổng quản trị: 7.1 Môn học và hoạt động giáo dục, 7.2 Phân công giảng dạy theo môn, khối "Môn tự chọn" ở hồ sơ học sinh; nhóm menu Tiểu học.
- Thêm quy tắc BR-166, chức năng P02-34 đến P02-36, quyền PQ-93, màn hình MH-261, MH-262, kịch bản CT-838 đến CT-843, tiêu chí AC-752 đến AC-754. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/subjects/subjects.test.ts` CT-20a-1 đến CT-20a-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã đạt 1047/1047 (không sửa kỳ vọng của kiểm thử đang có, trừ CT-19c-1 như trên); kiểm thử giao diện `tests/e2e/87-primary-subjects.spec.ts` (CT-20a-6) đạt; toàn bộ kiểm thử giao diện 159 kịch bản: hai lượt chạy riêng cuối cùng mỗi lượt đạt 158/159, mỗi lượt hỏng một kịch bản khác nhau do môi trường máy (58 khi máy chủ giao diện từ chối kết nối, 23 khi quá thời gian 30 giây), mọi kịch bản đều đạt ở ít nhất một lượt; CI là kết quả chính; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Danh mục môn trống, nạp bộ mẫu bằng nút; mã môn có tiền tố cấp; một môn của lớp một giáo viên, một giáo viên nhiều môn; lớp Mầm non giữ tên môn tự do; không thêm quyền (dùng quyền quản lý danh mục, quản lý lớp, quản lý hồ sơ học sinh), để trống migration định danh 0067. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-158, `07_QUY_TAC_NGHIEP_VU.md` BR-166, `08_VAI_TRO_NGUOI_DUNG.md` PQ-93, `10_YEU_CAU_CHUC_NANG.md` P02-34 đến P02-36, `11_TIEU_CHI_NGHIEM_THU.md` AC-752 đến AC-754, `14_DAC_TA_GIAO_DIEN.md` MH-261, MH-262, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-838 đến CT-843, `23_LICH_SU_PHIEN_BAN.md` 0.107.0.

#### Vấn đề tồn đọng

- 22c1 dùng phân công theo môn làm nguồn thời khoá biểu và kiểm định mức tiết; 20c dùng cách đánh giá của môn; khảo sát Sở cấp Tiểu học để đánh lại số menu, thêm trường hồ sơ.


### 2026-10-23 — DT-19 phần 19f: chuyển và kiểm dữ liệu Mầm non, dữ liệu mẫu đa cấp

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà lệnh chạy tệp thay đổi cấu trúc (năm đã đóng không chạy, QU-11), bản trình diễn 18h.
- Cơ sở dữ liệu: tệp năm học `0075_backfill_school_levels`, tệp hệ thống `0025_backfill_school_levels`, lệnh `level-check`.
- Bản trình diễn: bước "Trường liên cấp: Tiểu học, THCS".
- Thêm quy tắc BR-164 đến BR-165, chức năng P01-45 đến P01-46, kịch bản CT-833 đến CT-837, tiêu chí AC-749 đến AC-751, QĐ-24, mục 10.10 của tài liệu 32. Kết quả ngày 23/10/2026: kiểm thử đơn vị `database/src/level-check.test.ts` CT-19f-1 đến CT-19f-3 đạt 3/3, `apps/api/src/demo/administration-18h.test.ts` CT-19f-4 đạt (CT-18h-1 đến CT-18h-9 vẫn đạt); kiểm thử đơn vị toàn bộ kho mã 1042/1042; kiểm thử giao diện `tests/e2e/86-multi-level.spec.ts` (CT-19f-5) đạt; toàn bộ kiểm thử giao diện 158/158; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: tệp vá chỉ vá phần còn thiếu, không tắt cấp; tệp định danh 0066 để trống vì phạm vi cấp không có dòng nghĩa là mọi cấp; năm đã đóng không chạy tệp năm học (QU-11), lệnh kiểm đọc được; trường liên cấp của bản trình diễn là điểm trường Hoa Mai có thêm Tiểu học, THCS vì mỗi bộ cơ sở dữ liệu là một trường.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-156, `07_QUY_TAC_NGHIEP_VU.md` BR-164 đến BR-165, `10_YEU_CAU_CHUC_NANG.md` P01-45 đến P01-46, `11_TIEU_CHI_NGHIEM_THU.md` AC-749 đến AC-751, `12_KIEN_TRUC_HE_THONG.md` QĐ-24, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `21_KICH_BAN_KIEM_THU.md` CT-833 đến CT-837, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.9, 10.10. Phiên bản 0.106.0.

#### Vấn đề tồn đọng

- DT-20, DT-21 bắt đầu theo mục 10.10 của tài liệu 32; khảo sát hệ thống của Sở cho Tiểu học khi Eric có tài khoản.

### 2026-10-23 — Kế hoạch DT-20 Tiểu học (kèm 22c thời khoá biểu)

#### Công việc đã thực hiện

- Đọc dòng DT-20 của kế hoạch DT-18 và phần 22c của kế hoạch DT-22 (cỡ khoảng 2 đơn vị, khung và nhập Excel trước, máy xếp sau); đọc mục 10 (DT-19) và mã hiện tại: `school_levels`, `SchoolLevelResolver`, khối, lớp, `curricula`, lịch theo cấp, `LEVEL_FEATURES`, `class_staff_assignments`, bảng `timetables` của phân hệ Giảng dạy, điểm danh theo ngày, bếp, 22b, bảng thi đua cán bộ 22d.
- Thêm mục 11 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.38): kế hoạch DT-20 gồm tám phần 20a, 20b, 22c1, 20c, 20d, 20e, 22c2, 20f chạy bốn đợt; rủi ro, cách kiểm; bảng tiến độ.
- Ghi YCTD-157 (chỉ đổi tài liệu).

#### Quyết định

- Tách 22c thành 22c1 (khung, nhập Excel, kiểm tra xung đột, ban hành) và 22c2 (máy xếp, chỉnh tay, dạy thay); thời khoá biểu theo môn là bảng mới, giữ bảng `timetables` của Mầm non; danh mục môn, mẫu nhận xét, học bạ, biểu EMIS cấu hình được vì chưa khảo sát Sở cấp Tiểu học; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Giữ sẵn YCTD-158 đến YCTD-165, migration năm học 0076 đến 0083, hệ thống 0026 và 0027, định danh 0067 đến 0074, e2e `87-` đến `94-`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-157, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11. Không đổi mã nguồn, không đổi phiên bản phần mềm.

#### Vấn đề tồn đọng

- Khảo sát hệ thống của Sở cấp Tiểu học khi Eric có tài khoản; đọc toàn văn Thông tư 27/2020/TT-BGDĐT và văn bản về học bạ số trước khi làm 20c, 20e.


### 2026-10-23 — DT-19 phần 19e: cổng phụ huynh và ứng dụng giáo viên đa cấp

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà danh sách con, các nút chức năng của ứng dụng phụ huynh, ứng dụng giáo viên, tin tức và người nhận thông báo.
- Gói dùng chung: `LEVEL_FEATURES`, `hasLevelFeature`, `levelOf`, `matchesAudienceLevels`. Ứng dụng phụ huynh, giáo viên dùng gói dùng chung.
- Cơ sở dữ liệu: tệp năm học `0074_add_news_audience_levels`. Máy chủ API: cấp của con ở danh sách học sinh; phạm vi xem tin theo cấp con học; người nhận tin theo cấp; `POST /news-recipients/count`.
- Ứng dụng phụ huynh: tên cấp ở thẻ con khi các con học nhiều cấp; ẩn chức năng chỉ của Mầm non ở con cấp khác. Ứng dụng giáo viên: lớp xếp theo cấp, tên cấp, ẩn chức năng chỉ của Mầm non ở lớp cấp khác. Cổng quản trị: ô "Cấp nhận tin" và số người nhận ở "Thêm tin tức".
- Thêm quy tắc BR-163, chức năng P01-43 đến P01-44, quyền PQ-92, màn hình MH-260, kịch bản CT-828 đến CT-832, tiêu chí AC-746 đến AC-748. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/school-levels/multi-level-apps.test.ts` CT-19e-1 đến CT-19e-4 đạt 4/4; kiểm thử đơn vị toàn bộ kho mã đạt 1038/1038 (không sửa kỳ vọng của kiểm thử đang có); kiểm thử giao diện `tests/e2e/85-multi-level-apps.spec.ts` (CT-19e-5) đạt; toàn bộ kiểm thử giao diện đạt 157/157; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Chức năng chỉ của Mầm non: điểm danh và báo vắng theo ngày, nhật ký, chăm sóc hằng ngày, báo cơm, báo cáo tăng trưởng theo tháng tuổi, hồ sơ cuối cấp; đưa đón, dặn thuốc, thực đơn dùng cho mọi cấp; cấp nhận tin lưu ở tin tức (chưa ở hoạt động lớp, thư viện); cấp nhận chỉ dùng cho phạm vi toàn trường, đơn vị; số người nhận đếm tài khoản phụ huynh của trẻ đang học. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-155, `07_QUY_TAC_NGHIEP_VU.md` BR-163, `08_VAI_TRO_NGUOI_DUNG.md` PQ-92, `10_YEU_CAU_CHUC_NANG.md` P01-43 đến P01-44, `11_TIEU_CHI_NGHIEM_THU.md` AC-746 đến AC-748, `14_DAC_TA_GIAO_DIEN.md` MH-260, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-828 đến CT-832, `23_LICH_SU_PHIEN_BAN.md` 0.105.0.

#### Vấn đề tồn đọng

- DT-20, DT-21 thêm chức năng của cấp khác (điểm danh theo tiết, sổ điểm, sổ đầu bài, học bạ) vào `LEVEL_FEATURES` và chặn ở máy chủ; tin gửi theo khối làm cùng DT-20.


### 2026-10-22 — DT-19 phần 19d: số liệu theo cấp học

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà các chỗ tính theo tháng tuổi, nhóm tuổi Mầm non ở thống kê, EMIS, chấm công và suất ăn, tăng trưởng, hồ sơ cuối cấp, biểu phí, nhập Excel, kí hồ sơ.
- Cơ sở dữ liệu: tệp năm học `0073_add_fee_schedule_school_level`.
- Máy chủ API: tham số cấp dùng chung, lọc cấp ở thống kê, chấm công và suất ăn; biểu mẫu Mầm non chỉ tính cấp Mầm non; biểu phí theo cấp; kí hồ sơ theo cấp; kiểm bốn mã ở danh mục văn bản.
- Cổng quản trị: ô "Cấp học" ở thống kê, báo cáo chấm công và suất ăn, biểu phí.
- Thêm quy tắc BR-160 đến BR-162, chức năng P17-29, P17-30, P05-14, kịch bản CT-820 đến CT-827, tiêu chí AC-742 đến AC-745. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/statistics/level-reports.test.ts` CT-19d-1 đến CT-19d-7 đạt 7/7; kiểm thử đơn vị đang có không sửa kỳ vọng; kiểm thử đơn vị toàn bộ kho mã 1034/1034; kiểm thử giao diện `tests/e2e/84-level-reports.spec.ts` (CT-19d-8) đạt; toàn bộ kiểm thử giao diện 154/156 ở lượt cuối trên máy (hai ca 59 quên mật khẩu, 65 gửi thiết bị lên cấp trên chập chờn, không thuộc phần sửa và đạt ở các lượt trước; spec 84 đạt), CI là kết quả chính thức; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: không có tham số cấp thì chỉ lọc khi người dùng bị giới hạn cấp; biểu mẫu Mầm non bỏ trẻ của lớp cấp khác, giữ trẻ chưa xếp lớp; biểu phí mỗi cấp một chuỗi phiên bản; lớp cấp khác ở báo cáo chấm công và suất ăn thành nhóm theo cấp.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-154, `07_QUY_TAC_NGHIEP_VU.md` BR-160 đến BR-162, `10_YEU_CAU_CHUC_NANG.md` P17-29, P17-30, P05-14, `11_TIEU_CHI_NGHIEM_THU.md` AC-742 đến AC-745, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-820 đến CT-827, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.9. Phiên bản 0.104.0.

#### Vấn đề tồn đọng

- Biểu EMIS, chuẩn tăng trưởng, hồ sơ chuyển cấp của Tiểu học, THCS, THPT ở DT-20, DT-21; lệnh kiểm đối chiếu nhiều năm học ở 19f.

### 2026-10-22 — DT-19 phần 19c: menu và phân hệ theo cấp học

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà cây menu (`portal-menu.ts`), ô ngữ cảnh, cây quyền, Truy cập nhanh và các chữ "Trẻ" ghi cứng ở cổng quản trị.
- Gói dùng chung: thuộc tính `levels`, `levelTitle` ở cây menu, `portalWorkspacesForLevels`, `portalMenuPathsOutsideLevels`; bảng nhãn `SCHOOL_LEVEL_TERMS`, `schoolLevelTerms`, `workingSchoolLevels`, tham số `school_level`.
- Cơ sở dữ liệu: tệp định danh `0065_create_user_preferences`. Dịch vụ định danh: `PUT /auth/me/working-school-level`, `/auth/me` trả `working_school_level`. Máy chủ API: `SchoolLevelResolver.requested`, `GET /portal-context/school-levels` trả cấp người dùng được xem, `/me/quick-links` lọc theo cấp bật.
- Cổng quản trị: bộ chọn "Cấp học" ở thanh đầu trang, menu và tên phân hệ theo cấp đang làm việc, ô ngữ cảnh theo cấp, cây quyền theo cấp bật, nhãn "Trẻ"/"Học sinh" ở 4.7 Điểm danh, phiếu thu, trang chủ.
- Thêm quy tắc BR-159, chức năng P01-41 đến P01-42, quyền PQ-91, màn hình MH-259, kịch bản CT-811 đến CT-819, tiêu chí AC-739 đến AC-741. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/school-levels/working-level.test.ts` CT-19c-1 đến CT-19c-8 đạt 8/8; kiểm thử đơn vị toàn bộ kho mã đạt 1027/1027 (không sửa kỳ vọng của kiểm thử đang có); kiểm thử giao diện `tests/e2e/83-school-level-menu.spec.ts` (CT-19c-9) đạt; toàn bộ kiểm thử giao diện đạt 155/155; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Lưu cấp đang làm việc ở cơ sở dữ liệu định danh (giữ qua các máy) thay vì chỉ ở trình duyệt; mục gắn Mầm non gồm hồ sơ cuối cấp mầm non, biểu EMIS đầu năm, cuối năm, báo cáo giáo dục mầm non cuối năm, cân nặng chiều cao, hoàn thành chương trình; "Tất cả" ở trường liên cấp dùng thuật ngữ "Học sinh", "Lớp"; tên mục menu theo Sở giữ nguyên ở mọi cấp; Truy cập nhanh và cây quyền lọc theo cấp bật, menu lọc theo cấp đang làm việc. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-153, `07_QUY_TAC_NGHIEP_VU.md` BR-159, `08_VAI_TRO_NGUOI_DUNG.md` PQ-91, `10_YEU_CAU_CHUC_NANG.md` P01-41 đến P01-42, `11_TIEU_CHI_NGHIEM_THU.md` AC-739 đến AC-741, `14_DAC_TA_GIAO_DIEN.md` MH-259, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-811 đến CT-819, `23_LICH_SU_PHIEN_BAN.md` 0.103.0.

#### Vấn đề tồn đọng

- 19d cho thống kê, báo cáo, EMIS nhận tham số `school_level` và chuyển chữ "Trẻ" còn lại ở trang thống kê, nhập Excel, báo cáo sang bảng nhãn; 19e đưa cấp vào ứng dụng phụ huynh, giáo viên.


### 2026-10-22 — DT-19 phần 19b: cấu trúc theo cấp học

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, mã khối, lớp, đơn vị, lịch năm học, bước chuyển năm học, nhập lớp từ Excel; rà mọi chỗ đọc `academic_terms`, `school_weeks`.
- Cơ sở dữ liệu: tệp năm học `0072_add_school_level_structure`, tệp hệ thống `0024_add_school_level_calendar`.
- Máy chủ API: khối theo cấp, nạp khối mẫu, chương trình theo cấp, lớp theo cấp, cấp của đơn vị, lịch theo cấp, khối kế tiếp; chỗ đọc lịch đang có chỉ đọc lịch chung.
- Cổng quản trị: danh mục bậc học (cấp học, khối mẫu, thẻ Chương trình), biểu mẫu lớp, lịch năm học, cây đơn vị.
- Thêm quy tắc BR-155 đến BR-158, chức năng P01-37 đến P01-40, kịch bản CT-801 đến CT-810, tiêu chí AC-734 đến AC-738. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/catalogs/level-structure.test.ts` CT-19b-1 đến CT-19b-8 đạt 8/8, `apps/api/src/academic-years/year-transition.test.ts` CT-19b-9 đạt; kiểm thử đơn vị đang có không sửa kỳ vọng; kiểm thử đơn vị toàn bộ kho mã 1019/1019; kiểm thử giao diện `tests/e2e/82-level-structure.spec.ts` (CT-19b-10) đạt; toàn bộ kiểm thử giao diện 154/154; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mã khối mẫu K1 đến K12; chương trình mặc định Mầm non `CT-GDMN`; lớp ngoài Mầm non từ chối ô riêng Mầm non thay vì bỏ qua; đơn vị mới lấy cấp của Trường chính; lịch riêng của cấp là bộ học kỳ, tuần riêng (trống là lịch chung); giao diện đa cấp chỉ hiện khi trường bật từ hai cấp.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-152, `07_QUY_TAC_NGHIEP_VU.md` BR-155 đến BR-158, `10_YEU_CAU_CHUC_NANG.md` P01-37 đến P01-40, `11_TIEU_CHI_NGHIEM_THU.md` AC-734 đến AC-738, `14_DAC_TA_GIAO_DIEN.md` (MH-34, MH-45, biểu mẫu lớp, cây đơn vị), `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-801 đến CT-810, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.9. Phiên bản 0.102.0.

#### Vấn đề tồn đọng

- Thống kê, báo cáo, EMIS, biểu phí theo cấp ở 19d; lệnh kiểm đối chiếu nhiều năm học ở 19f.

### 2026-10-22 — DT-19 phần 19a: nền cấp học của trường

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà các cột cấp rời (18d, 18f, 18g, 22i), ô ngữ cảnh `portal-shell`, phân quyền ở dịch vụ định danh.
- Cơ sở dữ liệu: tệp hệ thống `0023_create_school_levels`, tệp định danh `0064_add_user_school_levels`.
- Máy chủ API: `SchoolLevelResolver`, `GET, PUT /school-levels`; ô ngữ cảnh, website đọc cấp từ bảng mới. Dịch vụ định danh: `/auth/me` trả phạm vi cấp, `GET, PUT /users/{id}/school-levels`.
- Cổng quản trị: thẻ "Cấp học của trường" ở 1.4 Cấu hình trường; khối "Phạm vi cấp học" ở chi tiết tài khoản (trường từ hai cấp); ô cấp học ở cấu hình website chỉ hiển thị.
- Thêm quy tắc BR-154, chức năng P01-35 đến P01-36, quyền PQ-90, màn hình MH-258, kịch bản CT-795 đến CT-800, tiêu chí AC-731 đến AC-733. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/school-levels/school-levels.test.ts` CT-19a-1 đến CT-19a-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã 1010/1010 đạt (không sửa kỳ vọng của kiểm thử đang có); kiểm thử giao diện `tests/e2e/81-school-levels.spec.ts` (CT-19a-6) đạt; toàn bộ kiểm thử giao diện 153/153 đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Tắt cấp chỉ ẩn, không chặn khi cấp có lớp (cảnh báo số lớp); phải bật ít nhất một cấp; quyền cấu hình cấp học chỉ cho Hiệu trưởng; phạm vi cấp do người quản lý tài khoản đặt; bộ nhớ đệm trong tiến trình 30 giây. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-151, `07_QUY_TAC_NGHIEP_VU.md` BR-154, `08_VAI_TRO_NGUOI_DUNG.md` PQ-90, `10_YEU_CAU_CHUC_NANG.md` P01-35 đến P01-36, `11_TIEU_CHI_NGHIEM_THU.md` AC-731 đến AC-733, `14_DAC_TA_GIAO_DIEN.md` MH-258, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-795 đến CT-800, `23_LICH_SU_PHIEN_BAN.md` 0.101.0.

#### Vấn đề tồn đọng

- 19b thêm cột cấp ở khối, lớp thì đổi bộ đếm lớp theo cấp sang cột mới; 19c thêm bộ chọn cấp đang làm việc và menu theo cấp.


### 2026-10-22 — DT-18 phần 22f: bảo đảm chất lượng, tự đánh giá

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-22 (phần 22f và câu 4), khảo sát mục 1.7 của Sở, mã 17e (1.7) và 18e (kho hồ sơ chuyên môn); đối chiếu cấu trúc tiêu chuẩn, tiêu chí của Thông tư 19/2018/TT-BGDĐT (kiểm định chất lượng giáo dục và công nhận đạt chuẩn quốc gia đối với trường mầm non) và các văn bản sửa đổi, bổ sung.
- Cơ sở dữ liệu: tệp năm học `0071_create_quality_assurance`, tệp định danh `0063_add_quality_assurance_permissions`.
- Máy chủ API: bộ tiêu chuẩn, đợt, hội đồng, nhóm công tác, phiếu, minh chứng (tải tệp, nguồn văn bản, kế thừa), kế hoạch cải tiến, báo cáo Word, PDF, công nhận, bước chuyển năm học.
- Cổng quản trị: phân hệ "Bảo đảm chất lượng" với 1.1 đến 1.3, 2.1, 2.2.
- Thêm quy tắc BR-151 đến BR-153, chức năng P09-40 đến P09-44, quyền PQ-89, màn hình MH-253 đến MH-257, kịch bản CT-786 đến CT-794, tiêu chí AC-725 đến AC-730. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/quality-assurance/quality-assurance.test.ts` CT-22f-1 đến CT-22f-8 đạt 8/8; kiểm thử đơn vị toàn bộ kho mã 1005/1005; kiểm thử giao diện `tests/e2e/80-quality-assurance.spec.ts` (CT-22f-9) đạt; toàn bộ kiểm thử giao diện 150/152 trên máy (01-login lỗi tiêu điểm bàn phím chỉ trên máy, chạy lại đạt; 04-accounts lỗi do tài khoản trùng của các lượt chạy trước ở cơ sở dữ liệu định danh dùng lại, không liên quan 22f; CI là chuẩn); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo quyết định của Eric ngày 2026-10-19 (bộ tiêu chuẩn cấu hình được, trường tự nhập). Phân hệ riêng vì tự đánh giá là việc của cả trường, nhiều nhóm tham gia. Kế hoạch cải tiến tạo kế hoạch công việc nháp theo đơn vị của người phụ trách để Quản lý công việc giao việc. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-149, `07_QUY_TAC_NGHIEP_VU.md` BR-151 đến BR-153, `08_VAI_TRO_NGUOI_DUNG.md` PQ-89, `10_YEU_CAU_CHUC_NANG.md` P09-40 đến P09-44, `11_TIEU_CHI_NGHIEM_THU.md` AC-725 đến AC-730, `14_DAC_TA_GIAO_DIEN.md` MH-253 đến MH-257, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-786 đến CT-794, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.100.0.

#### Vấn đề tồn đọng

- Nội dung chỉ báo của bộ mẫu Mầm non chờ đối chiếu văn bản hiện hành; bộ mẫu cấp khác sau DT-19.
- Chưa có nguồn Việc của tôi, thông báo cho phiếu tiêu chí; chưa kí nội bộ báo cáo tự đánh giá; AI gợi ý chưa làm.

### 2026-10-22 — DT-18 phần 22d: thi đua, khen thưởng cán bộ, giáo viên

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-22 (phần 22d), Luật Thi đua, khen thưởng năm 2022 (Điều 22, 23, 24), Nghị định 368/2026/NĐ-CP ngày 25/9/2026 (Điều 5: tỉ lệ Chiến sĩ thi đua cơ sở không quá 10% số đạt Lao động tiên tiến), Thông tư 25/2026/TT-BNV; rà mã KPI (18d), hồ sơ chuyên môn (18e), văn bản đi (18b), kế hoạch giáo dục (22i).
- Cơ sở dữ liệu: tệp năm học `0070_create_emulation`, tệp định danh `0062_add_emulation_permissions`.
- Máy chủ API: danh mục, đợt, đăng ký, hồ sơ đề nghị (KPI, minh chứng, điều kiện), hội đồng, phiên họp, phiếu kín, biên bản, công bố, phúc khảo, khiếu nại, quyết định, tờ trình, dự thảo văn bản đi, giấy khen, tra cứu công khai, sổ nhiều năm, báo cáo, nguồn Việc của tôi, chép danh mục sang năm học mới.
- Cổng quản trị: phân hệ "Thi đua, khen thưởng" (1.1 đến 6.1) và trang tra cứu công khai.
- Thêm quy tắc BR-147 đến BR-150, chức năng P09-34 đến P09-39, quyền PQ-88, màn hình MH-241 đến MH-252, kịch bản CT-776 đến CT-785, tiêu chí AC-720 đến AC-724. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/emulation/emulation.test.ts` CT-22d-1 đến CT-22d-9 đạt 9/9 (sửa `system-admin-so.test.ts` CT-16d-3 đếm 18 phân hệ); kiểm thử đơn vị toàn bộ kho mã 997/997 đạt; kiểm thử giao diện `tests/e2e/79-emulation.spec.ts` (CT-22d-10) đạt; toàn bộ kiểm thử giao diện 151 ca: lần chạy đầu 148 đạt; spec 79 sửa bộ chọn nút rồi đạt; `61-health-nutrition-so`, `70-incoming-documents` lỗi chập chờn ở máy cục bộ, chạy lại 70 đạt, không liên quan 22d (spec 58 đếm 18 phân hệ); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4. Thêm phân hệ riêng (như KPI) thay vì gộp vào Hồ sơ chuyên môn vì có hội đồng, quyết định, sổ nhiều năm riêng. Điều kiện của danh hiệu chỉ là thông tin cho hội đồng, không chặn nộp; tỉ lệ phiếu tính trên tổng số thành viên. Sổ nhiều năm đọc mọi cơ sở dữ liệu năm học thay vì chép sổ sang năm mới. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-148, `07_QUY_TAC_NGHIEP_VU.md` BR-147 đến BR-150, `08_VAI_TRO_NGUOI_DUNG.md` PQ-88, `10_YEU_CAU_CHUC_NANG.md` P09-34 đến P09-39, `11_TIEU_CHI_NGHIEM_THU.md` AC-720 đến AC-724, `14_DAC_TA_GIAO_DIEN.md` MH-241 đến MH-252, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-776 đến CT-785, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.99.0.

#### Vấn đề tồn đọng

- Đối chiếu tiêu chuẩn, tỉ lệ mặc định với toàn văn Nghị định 368/2026/NĐ-CP, Thông tư 25/2026/TT-BNV và mẫu biểu kèm theo; chưa nhập phiếu giấy; giấy khen chưa kí số; thi đua khối, cụm và cấp trên để DT-SaaS S6.

### 2026-10-22 — Kế hoạch DT-19 nền đa cấp học

#### Công việc đã thực hiện

- Đọc mã hiện tại trước khi chia phần: lược đồ cơ sở dữ liệu hệ thống, định danh, năm học (`org_units`, `grade_levels`, `classes`, `academic_terms`, `school_weeks`, các cột `school_level`, `education_level`, `school_levels` đã có ở DT-18), nơi ngầm giả định Mầm non (nhóm tuổi, tháng tuổi, EMIS, thống kê, biểu phí, menu "Quản lý giáo dục Mầm non", `EDUCATION_LEVEL_LABEL`), hàm `cacheKey`, `storageKey`; đọc kế hoạch SaaS và dòng DT-19 của kế hoạch DT-18.
- Thêm mục 10 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.30): kế hoạch DT-19 gồm sáu phần 19a đến 19f chạy ba đợt; rủi ro và cách kiểm chuyển dữ liệu Mầm non; bảng phần mở đường cho DT-20, DT-21.
- Ghi YCTD-150 (chỉ đổi tài liệu).

#### Quyết định

- Giữ một cơ sở dữ liệu năm học cho cả trường (không tách theo cấp), một nguồn cấp học `school_levels` ở cơ sở dữ liệu hệ thống, bốn mã cấp cố định, không đổi tên bảng `children`; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Giữ sẵn YCTD-151 đến YCTD-156, migration năm học 0072 đến 0075, hệ thống 0023 đến 0025, định danh 0064 đến 0066, e2e `81-` đến `86-`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-150, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10. Không đổi mã nguồn, không đổi phiên bản phần mềm.

#### Vấn đề tồn đọng

- Chưa làm phần nào của DT-19. Chờ gộp 22d, 22f (PR khác) để rà lại giả định Mầm non ở hai phần đó khi làm 19d.

### 2026-10-21 — DT-18 phần 22b: bán trú, kiểm thực ba bước và an toàn thực phẩm

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-22 (phần 22b), Quyết định 1246/QĐ-BYT ngày 31/3/2017 của Bộ Y tế; rà mã bếp (thực đơn, định lượng, suất ăn, phiếu đi chợ), kho, tiền ăn.
- Cơ sở dữ liệu: tệp năm học `0068_create_food_safety`, tệp định danh `0060_add_food_safety_permission`.
- Máy chủ API: lô hàng (tạo khi nhập phiếu đi chợ), hồ sơ nhà cung cấp, tệp quét, kiểm thực ba bước có gợi ý dòng, lưu và hủy mẫu, truy xuất, sổ in PDF và Excel, nguồn Việc của tôi, chuyển giấy tờ sang năm học mới.
- Cổng quản trị: nhóm "3. Bán trú và an toàn thực phẩm" với 3.1 đến 3.5; cảnh báo giấy tờ và cột lô ở phiếu đi chợ.
- Thêm quy tắc BR-143 đến BR-146, chức năng P12-11 đến P12-15, quyền PQ-87, màn hình MH-236 đến MH-240, kịch bản CT-769 đến CT-775, tiêu chí AC-715 đến AC-719. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/kitchen/food-safety.test.ts` CT-22b-1 đến CT-22b-6 đạt 6/6; kiểm thử đơn vị toàn bộ kho mã 988/988; kiểm thử giao diện `tests/e2e/77-food-safety.spec.ts` (CT-22b-7) đạt; toàn bộ kiểm thử giao diện 150/150; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo Quyết định 1246/QĐ-BYT ngày 31/3/2017 của Bộ Y tế. Lô gắn với dòng phiếu đi chợ để truy xuất tới nhà cung cấp, chứng từ; lô dùng cho món ghi ở bước 2 (có gợi ý) để truy xuất chính xác. Tệp quét lưu bảng riêng để không đụng ràng buộc mục đích tệp của phần chạy song song. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-146, `07_QUY_TAC_NGHIEP_VU.md` BR-143 đến BR-146, `08_VAI_TRO_NGUOI_DUNG.md` PQ-87, `10_YEU_CAU_CHUC_NANG.md` P12-11 đến P12-15, `11_TIEU_CHI_NGHIEM_THU.md` AC-715 đến AC-719, `14_DAC_TA_GIAO_DIEN.md` MH-236 đến MH-240, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-769 đến CT-775, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.98.0.

#### Vấn đề tồn đọng

- Tiền ăn: chưa có luồng chi trả lại số dư có cho phụ huynh khi trẻ thôi học, chưa tách số dư tiền ăn với học phí (xem YCTD-146).
- Lô chưa trừ tồn theo lô; chưa có sổ phản ánh, sự cố ngộ độc riêng; phiếu kiểm thực đã xác nhận chưa có thao tác mở lại; người xác nhận phiếu chỉ lưu mã tài khoản.

### 2026-10-21 — DT-18 phần 22i: kế hoạch giáo dục

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-22 (phần 22i), mã hồ sơ chuyên môn 18e (luồng duyệt, kho tệp, nhóm công tác, Việc của tôi), quy trình kí nội bộ 16k, 17b, kế hoạch theo kỳ của Quản lý công việc.
- Cơ sở dữ liệu: tệp năm học `0069_create_education_plans`, tệp định danh `0061_add_education_plan_permissions`.
- Máy chủ API: thư viện mẫu, nạp mẫu Mầm non; lập, sửa, trình, duyệt nhiều bước, trả lại, rút lại; kí nội bộ, lưu vào kho hồ sơ; phiên bản, so sánh; sao chép từ năm trước; xuất Word, PDF; tiến độ duyệt, xuất Excel; tạo kế hoạch công việc; nguồn Việc của tôi; bước chuyển năm học.
- Cổng quản trị: nhóm 5 của phân hệ Hồ sơ chuyên môn (sáu màn hình).
- Thêm quy tắc BR-142, chức năng P09-31 đến P09-33, quyền PQ-86, màn hình MH-230 đến MH-235, kịch bản CT-759 đến CT-768, tiêu chí AC-711 đến AC-714. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/education-plans/education-plans.test.ts` CT-22i-1 đến CT-22i-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 982/982; kiểm thử giao diện `tests/e2e/78-education-plans.spec.ts` (CT-22i-10) đạt; toàn bộ kiểm thử giao diện 149/149 (148 ở lượt toàn bộ, spec 78 chạy lại sau khi sửa đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22i của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4, gộp vào phân hệ Hồ sơ chuyên môn thay vì thêm phân hệ; mẫu là cấu hình ở cơ sở dữ liệu năm học, chép sang năm mới; bản đã duyệt lưu vào kho hồ sơ 18e (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-147, `07_QUY_TAC_NGHIEP_VU.md` BR-142, `08_VAI_TRO_NGUOI_DUNG.md` PQ-86, `10_YEU_CAU_CHUC_NANG.md` P09-31 đến P09-33, `11_TIEU_CHI_NGHIEM_THU.md` AC-711 đến AC-714, `14_DAC_TA_GIAO_DIEN.md` MH-230 đến MH-235, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-759 đến CT-768.

#### Vấn đề tồn đọng

- Mẫu Tiểu học, THCS, THPT thêm sau DT-19; nội dung mẫu Mầm non chờ trường rà theo hướng dẫn năm học.

### 2026-10-21 — DT-18 phần 18h: quản trị và trình diễn

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-18 và DT-SaaS (S2, S5), mã xác thực của dịch vụ định danh, tác vụ xuất nền 16a, các bộ gửi SMS, Zalo, Fanpage, cổng thanh toán.
- Cơ sở dữ liệu: tệp định danh `0059_add_impersonation_and_data_export`, tệp hệ thống `0022_create_impersonation_export_demo_tables`.
- Dịch vụ định danh: đăng nhập thay, thoát, nhật ký; chặn thao tác mật khẩu khi đăng nhập thay; dữ liệu tài khoản cho gói ZIP; không gửi tin nhắn ở bản trình diễn.
- Máy chủ API: ghi thao tác và chặn kí số khi đăng nhập thay; dựng gói ZIP; bản trình diễn (dấu, chặn gửi tin, thanh toán), lệnh tạo và đặt lại dữ liệu trình diễn chạy máy chủ API trong tiến trình.
- Cổng quản trị: nút và hộp thoại đăng nhập thay, thanh báo, 4.1, 4.2, 4.3, trang chọn vai, dải trình diễn; ứng dụng giáo viên, phụ huynh: dải trình diễn, chọn vai.
- Triển khai: dịch vụ `demo-reset` (hồ sơ `demo`), `deploy/README.md` mục 11.
- Thêm quy tắc BR-141, chức năng P01-32 đến P01-34, quyền PQ-85, màn hình MH-225 đến MH-229, kịch bản CT-748 đến CT-758, tiêu chí AC-707 đến AC-710. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/demo/administration-18h.test.ts` CT-18h-1 đến CT-18h-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 973/973 đạt; kiểm thử giao diện `tests/e2e/76-administration-demo.spec.ts` (CT-18h-10, CT-18h-11) đạt; toàn bộ kiểm thử giao diện đạt 148/148; lệnh tạo dữ liệu trình diễn chạy trên cơ sở dữ liệu riêng đạt 25/25 bước; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18h của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4. Gói ZIP chạy ở tiến trình xuất nền của 16a theo mục 9.4; dấu bản trình diễn ở cơ sở dữ liệu thay vì biến môi trường để dùng lại cho dùng thử của DT-SaaS S5. "Quyền cao hơn" so theo thứ bậc vai trò và nhóm quyền quản trị, vì so từng quyền thì Hiệu trưởng không vào được tài khoản Quản lý đơn vị (vai trò này có quyền nghiệp vụ riêng). Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-145, `07_QUY_TAC_NGHIEP_VU.md` BR-141, `08_VAI_TRO_NGUOI_DUNG.md` PQ-85, `10_YEU_CAU_CHUC_NANG.md` P01-32 đến P01-34, `11_TIEU_CHI_NGHIEM_THU.md` AC-707 đến AC-710, `14_DAC_TA_GIAO_DIEN.md` MH-225 đến MH-229, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-748 đến CT-758, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.96.0.

#### Vấn đề tồn đọng

- Gói ZIP lớn (ZIP64, ghi luồng) và tùy chọn kèm số định danh đầy đủ để DT-SaaS S2. Đăng nhập thay ở ứng dụng giáo viên, phụ huynh chưa làm.

### 2026-10-21 — DT-18 phần 18e: hồ sơ chuyên môn và Việc của tôi

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0066_create_professional_records` tạo `professional_folders`, `professional_work_groups`, `professional_work_group_members`, `professional_rounds`, `professional_documents`, `professional_document_versions`, `professional_document_events`, `professional_record_settings`; mục đích tệp mới `professional_record`. Cơ sở dữ liệu định danh: tệp `0056_add_professional_record_permissions` (bốn quyền `P09.professional-record.*`, phân hệ `professional-records` không có ở phụ huynh).
- Máy chủ API: `apps/api/src/professional-records/` (thư mục, nhóm công tác, đợt nộp, hồ sơ, phiên bản, luồng duyệt, kí nội bộ qua `DossierSigner`, thống kê, khóa năm học, bước chuyển năm học); `apps/api/src/my-work/` (giao diện nguồn việc `MyWorkSource` và chín nguồn: văn bản đến, văn bản đi, giao việc, phòng họp, KPI, hồ sơ chuyên môn, kế hoạch bài dạy, kí hồ sơ, nghỉ phép; điểm cuối `/my-work`, `/my-work/count`).
- Cổng quản trị: phân hệ "Hồ sơ chuyên môn" (1. Việc của tôi, 2.1 đến 2.3 kho, 3.1 đến 3.3 đợt nộp, duyệt, thống kê, 4.1, 4.2 thiết lập); số việc đang chờ trên mục Việc của tôi và nút "Việc của tôi" ở đầu trang cạnh chuông thông báo.
- Thêm quy tắc BR-140, chức năng P09-28 đến P09-30, quyền PQ-84, màn hình MH-216 đến MH-224, kịch bản CT-738 đến CT-747, tiêu chí AC-702 đến AC-706. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/professional-records/professional-records.test.ts` CT-18e-1 đến CT-18e-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 963/964 đạt, ca chưa đạt CTC-P06-007 (phiếu thu phát hành đồng thời, ngoài phạm vi 18e) chạy lại tệp đạt 29/29; kiểm thử giao diện `tests/e2e/74-professional-records.spec.ts` (CT-18e-10) đạt 1/1; toàn bộ e2e chưa chạy lại toàn bộ sau khi gộp 18f; spec 02, 03, 58 quản trị hệ thống, 74 đạt 9/9 (lần đầu spec 02 quá thời gian chờ mở năm học, chạy lại đạt).

#### Quyết định

- Thực hiện phần 18e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-142: phân hệ riêng "Hồ sơ chuyên môn" chứa Việc của tôi; tổ là phòng ban đã khai báo, tổ trưởng là người có vai trò Tổ trưởng chuyên môn cùng phòng ban; kí ở bước duyệt cuối bằng chứng thư nhà trường đã đăng ký kí nội bộ; nguồn việc đọc thẳng điều kiện "chờ tôi" của từng phân hệ, không ghi dữ liệu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-142, `07_QUY_TAC_NGHIEP_VU.md` BR-140, `08_VAI_TRO_NGUOI_DUNG.md` PQ-84, `10_YEU_CAU_CHUC_NANG.md` P09-28 đến P09-30, `11_TIEU_CHI_NGHIEM_THU.md` AC-702 đến AC-706, `14_DAC_TA_GIAO_DIEN.md` MH-216 đến MH-224, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-738 đến CT-747, `23_LICH_SU_PHIEN_BAN.md` 0.95.0.

#### Vấn đề tồn đọng

- Thông báo cho tổ trưởng gửi theo vai trò Tổ trưởng chuyên môn của đơn vị (quyền ở dịch vụ định danh nên chưa lọc theo phòng ban); danh mục thư mục mặc định Tiểu học, THCS, THPT dùng chung một bản, sẽ tách khi làm DT-19; Việc của tôi chưa gom các hàng chờ duyệt theo quyền ở tài chính, kho, tuyển sinh (thêm nguồn sau qua `MyWorkSource`).
### 2026-10-21 — DT-18 phần 18f: website trường trên tên miền riêng

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-18, mã tuyển sinh trực tuyến (YCTD-86), văn bản đi (18b, cột `published`), cấu hình Caddy của môi trường chạy thật (YCTD-92); đọc mục lục Chương II của Thông tư 09/2024/TT-BGDĐT để lập nhóm công khai.
- Cơ sở dữ liệu: tệp hệ thống `0021_create_website_tables` (8 bảng), tệp định danh `0058_add_website_permissions` (ba quyền P14).
- Máy chủ API: thiết lập, tên miền, nội dung mẫu (`website-setup.ts`), bài, album, tệp, luồng duyệt, thư liên hệ (`website-content.ts`), trang công khai theo tên miền và điểm cuối kiểm tra tên miền cho Caddy (`website-public.ts`, `website-render.ts`), lọc HTML (`website-html.ts`).
- Cổng quản trị: phân hệ Website trường, 9 màn hình (`apps/portal/src/website/`).
- Triển khai: Caddy `on_demand_tls` hỏi máy chủ API trước khi xin chứng chỉ, khối `https://` cho mọi tên miền website.
- Thêm quy tắc BR-139, chức năng P14-13 đến P14-16, quyền PQ-83, màn hình MH-206 đến MH-215, kịch bản CT-727 đến CT-737, tiêu chí AC-696 đến AC-701. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/website/website.test.ts` CT-18f-1 đến CT-18f-10 đạt 10/10; kiểm thử đơn vị toàn bộ kho mã đạt 955/955 (CSDL riêng của 18f); kiểm thử giao diện `tests/e2e/75-school-website.spec.ts` (CT-18f-11) đạt; toàn bộ kiểm thử giao diện 144/145 trên máy (ca 04-accounts hỏng cục bộ vì cơ sở dữ liệu định danh riêng còn tài khoản trùng tên của lượt chạy trước; CI chạy trên cơ sở dữ liệu mới là kết quả chính); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; cấu hình Caddy kiểm tra bằng `caddy validate` (Caddy 2.10) hợp lệ.

#### Quyết định

- Thực hiện phần 18f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo quyết định của Eric ngày 2026-10-19 (mỗi trường một tên miền riêng, có chế độ trình diễn). Dựng trang công khai ở máy chủ API thay vì thêm ứng dụng giao diện mới; tên miền và cấu hình website ở cơ sở dữ liệu hệ thống. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-144.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-144, `07_QUY_TAC_NGHIEP_VU.md` BR-139, `08_VAI_TRO_NGUOI_DUNG.md` PQ-83, `10_YEU_CAU_CHUC_NANG.md` P14-13 đến P14-16, `11_TIEU_CHI_NGHIEM_THU.md` AC-696 đến AC-701, `14_DAC_TA_GIAO_DIEN.md` MH-206 đến MH-215, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-727 đến CT-737, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.94.0.

#### Vấn đề tồn đọng

- Đăng ký sự kiện qua QR (mục 9.4) chưa làm. Trang thời khóa biểu nối 22c (DT-20). Tên miền thật và chứng chỉ cần máy chủ chạy thật.

### 2026-10-20 — DT-18 phần 18g: thiết bị có nơi để, tem QR, kiểm kê, đối sánh danh mục tối thiểu

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0067_add_equipment_locations_stocktakes` tạo `equipment_locations`, `equipment_stocktakes`, `equipment_stocktake_lines`, thêm cột cấp học và mã mẫu cho `equipment_items`, nơi để và mã tem cho `equipment_holdings`, `assets`. Cơ sở dữ liệu định danh: tệp `0057_add_equipment_stocktake_permission` thêm quyền `P13.equipment.stocktake`.
- Máy chủ API (`apps/api/src/facilities/`): `equipment-locations.ts` (nơi để, gán nơi để, in tem QR PDF, tra mã tem), `equipment-stocktakes.ts` (đợt kiểm kê, quét, nộp, duyệt, trả lại, hủy, chốt chênh lệch, biên bản), `equipment-minimum.ts` (danh mục mẫu, nạp mẫu, đối sánh, xuất), `equipment-templates.ts` (mẫu Mầm non 515 thiết bị), `equipment-stocktake-calc.ts` (hàm tính); bước chuyển năm học `facilities` chuyển nơi để, nơi để và mã tem của lô.
- Cổng quản trị: 2.4 Nơi để và tem QR thiết bị, 2.5 Kiểm kê thiết bị (khối quét QR dùng trên điện thoại), 2.6 Đối sánh danh mục tối thiểu. Ứng dụng giáo viên: màn hình Kiểm kê thiết bị. Gói giao diện: thành phần `QrScanner` (máy ảnh, giải mã bằng jsQR trên trình duyệt, ô nhập mã).
- Đọc văn bản gốc trước khi nhập danh mục: Thông tư 02/2010/TT-BGDĐT (danh mục sáu nhóm tuổi) và Thông tư 34/2013/TT-BGDĐT (bãi bỏ 47 thiết bị, đổi tên hai thiết bị), bản đăng trên trang văn bản pháp luật.
- Thêm quy tắc BR-138, chức năng P13-16 đến P13-18, quyền PQ-82, màn hình MH-203 đến MH-205 và MG-18, kịch bản CT-720 đến CT-726, tiêu chí AC-691 đến AC-695. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/facilities/equipment-18g.test.ts` CT-18g-1 đến CT-18g-6 đạt 6/6; kiểm thử đơn vị toàn bộ kho mã 945/945 đạt; kiểm thử giao diện `tests/e2e/73-equipment-stocktake.spec.ts` (CT-18g-7) đạt; toàn bộ kiểm thử giao diện 144/144 đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18g của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-143: đối tượng của tem và kiểm kê là tài sản (từng thiết bị) và lô (số hiện có của một thiết bị tại đơn vị hoặc lớp); nơi để hai cấp; mã tem `TB-` 10 ký tự không có tên miền; mỗi đơn vị một đợt chưa chốt; chốt chênh lệch lấy số dùng được làm số hiện có của lô và chuyển tài sản hỏng, mất sang luồng ghi nhận hỏng, mất của Kho và tài sản; danh mục mẫu nạp chỉ thêm mã chưa có.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-143, `07_QUY_TAC_NGHIEP_VU.md` BR-138, `08_VAI_TRO_NGUOI_DUNG.md` PQ-82, `10_YEU_CAU_CHUC_NANG.md` P13-16 đến P13-18, `11_TIEU_CHI_NGHIEM_THU.md` AC-691 đến AC-695, `14_DAC_TA_GIAO_DIEN.md` MH-203 đến MH-205, MG-18, `16_CO_SO_DU_LIEU.md` mục 14 và mục 20, `17_DAC_TA_API.md` mục 15, `21_KICH_BAN_KIEM_THU.md` CT-720 đến CT-726, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.93.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.6.

#### Vấn đề tồn đọng

- Danh mục mẫu Mầm non cần đối chiếu bản gốc trên Công báo; chưa có mẫu Tiểu học, THCS, THPT (cột khối lớp làm ở DT-19); chưa khóa dòng khi hai người cùng quét một thiết bị.

### 2026-10-20 — DT-18 phần 18c: giao việc, lịch, hồ sơ công việc, báo cáo

#### Công việc đã thực hiện

- Đọc ghi chép khảo sát VNPT iOffice ngày 2026-10-19 (Giao việc, Lịch, Hồ sơ lưu trữ, Báo cáo), mã văn bản đến của 18a, phân hệ Quản lý công việc (YCTD-81) và văn thư lưu trữ 15h2.
- Cơ sở dữ liệu: tệp năm học `0065_extend_tasks_for_directives` (mở rộng `tasks`, thêm `task_assignments`, `task_files`), tệp hệ thống `0020_create_unit_schedules_and_work_files` (9 bảng), tệp định danh `0055_add_directive_schedule_permissions` (sáu quyền P09).
- Máy chủ API: giao việc, phân công, tiến độ, phê duyệt, nhắc việc chạy nền (`apps/api/src/work/directives.ts`); lịch đơn vị, phòng họp, mẫu lịch, xuất lịch (`apps/api/src/unit-schedules/`); hồ sơ công việc nối văn thư lưu trữ (`apps/api/src/work-files/`); báo cáo (`apps/api/src/document-reports/`).
- Cổng quản trị: 16 màn hình ở nhóm 4 đến 7 của phân hệ Quản lý văn bản và điều hành (`apps/portal/src/directives/`); chi tiết văn bản đến thêm Tạo công việc, Lưu vào hồ sơ công việc.
- Thêm quy tắc BR-137, chức năng P09-24 đến P09-27, quyền PQ-81, màn hình MH-187 đến MH-202, kịch bản CT-707 đến CT-719, tiêu chí AC-685 đến AC-690. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/work/directives.test.ts` và `apps/api/src/unit-schedules/unit-schedules.test.ts` CT-18c-1 đến CT-18c-12 đạt 12/12; kiểm thử đơn vị toàn bộ kho mã 939/939 đạt; kiểm thử giao diện `tests/e2e/72-directives.spec.ts` (CT-18c-13) đạt; toàn bộ kiểm thử giao diện 140/143 đạt trên máy (58 CT-16a-10, 68 CT-17a-6 lỗi không liên quan 18c; CI chạy lại); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo quyết định của Eric ngày 2026-10-19 (làm theo VNPT iOffice). Mở rộng bảng việc đã có thay vì tạo phân hệ việc thứ hai. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-141.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-141, `07_QUY_TAC_NGHIEP_VU.md` BR-137, `08_VAI_TRO_NGUOI_DUNG.md` PQ-81, `10_YEU_CAU_CHUC_NANG.md` P09-24 đến P09-27, `11_TIEU_CHI_NGHIEM_THU.md` AC-685 đến AC-690, `14_DAC_TA_GIAO_DIEN.md` MH-187 đến MH-202, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-707 đến CT-719, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.92.0.

#### Vấn đề tồn đọng

- Thêm văn bản đi (18b) vào thành phần hồ sơ công việc và báo cáo. Việc của tôi (18e) gom việc chờ của giao việc.

### 2026-10-20 — DT-18 phần 18b: Văn bản đi theo VNPT iOffice

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống: tệp `0019_create_outgoing_document_tables` tạo sáu bảng văn bản đi (văn bản, tệp, văn bản liên quan và văn bản gốc, lấy ý kiến, đơn vị nhận, lịch sử), thêm vào `incoming_documents` cột văn bản đi nguồn và đơn vị nhận, nguồn `internal` (liên thông nội bộ). Cơ sở dữ liệu định danh: tệp `0054_add_outgoing_document_permissions` thêm bốn quyền P09.
- Gói dùng chung: nhóm 3. Văn bản đi (3.1 đến 3.4) ở phân hệ "Quản lý văn bản và điều hành"; điều kiện hiện mục; nhãn ở `packages/shared/src/outgoing-documents.ts`; `PERMISSION_CODES`, `DATA_GRID_KEYS`, `PORTAL_QUICK_LINK_PATHS` thêm mục mới.
- Máy chủ API (`apps/api/src/outgoing-documents/`): `outgoing-documents.ts` (dự thảo, lấy ý kiến, trình ký, ký nội bộ, cấp số, phát hành, liên thông, public, đóng băng, lưu hồ sơ, tra cứu mã QR), `outgoing-print.ts` (phiếu trình ký PDF, sổ văn bản đi), `outgoing-fields.ts`, `outgoing-documents.controller.ts` (kèm điểm cuối công khai tra cứu mã). Dùng lại của 18a: sổ văn bản (chiều đi), danh mục văn bản, đơn vị bên ngoài, lãnh đạo nhận văn bản (danh sách người ký), chỗ nối `DocumentExchange` (thêm `send`), hàm `storageKey`; dùng lại của 16k, 17b: chứng thư nhà trường và chỗ nối `DossierSigner` (thêm mã QR ở khối xác nhận).
- Cổng quản trị: `apps/portal/src/outgoing-documents/` (danh sách 3.1 đến 3.4, biểu mẫu văn bản đi, chi tiết bốn thẻ và các hộp thoại lấy ý kiến, trình ký, ký, cấp số, lưu hồ sơ; trang công khai `/tra-cuu-van-ban`); 2.1 Sổ văn bản thêm thẻ Khai báo sổ văn bản đi, Sổ đăng ký văn bản đi; chi tiết văn bản đến ghi nguồn liên thông nội bộ.
- Thêm quy tắc BR-136, chức năng P09-20 đến P09-23, quyền PQ-80, màn hình MH-180 đến MH-186, kịch bản CT-697 đến CT-706, tiêu chí AC-679 đến AC-684. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/outgoing-documents/outgoing-documents.test.ts` CT-18b-1 đến CT-18b-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 927/927 đạt; kiểm thử giao diện `tests/e2e/72-outgoing-documents.spec.ts` (CT-18b-10) và `70-incoming-documents.spec.ts` đạt; KQ18B_E2E; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo khảo sát VNPT iOffice ngày 2026-10-19 (quyết định của Eric ngày 2026-10-19). Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-140: năm trạng thái văn bản đi; người ký chọn trong danh sách lãnh đạo nhận văn bản; ký cần chứng thư nhà trường đã đăng ký kí nội bộ như kí hồ sơ ở 16k; số ký hiệu là số đi ghép phần ký hiệu văn thư nhập; đơn vị nhận trong hệ thống là đơn vị trong cây đơn vị của trường (phân hiệu, điểm trường).
- Bản chạy nội bộ: không kết nối trục liên thông văn bản (văn thư gửi bằng cách khác rồi đánh dấu đã gửi; chỗ nối `DocumentExchange.send`), ký là ký xác nhận nội bộ, không phải chữ ký số.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-140, `07_QUY_TAC_NGHIEP_VU.md` BR-136, `08_VAI_TRO_NGUOI_DUNG.md` PQ-80, `10_YEU_CAU_CHUC_NANG.md` P09-20 đến P09-23, `11_TIEU_CHI_NGHIEM_THU.md` AC-679 đến AC-684, `14_DAC_TA_GIAO_DIEN.md` MH-180 đến MH-186, `16_CO_SO_DU_LIEU.md` mục 1 và mục 10, `17_DAC_TA_API.md` mục 12, `21_KICH_BAN_KIEM_THU.md` CT-697 đến CT-706, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.91.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.6.

#### Vấn đề tồn đọng

- Chưa kết nối trục liên thông văn bản và ký số của nhà cung cấp. "Tạo việc", "Tạo chỉ đạo điều hành", "Tạo lịch họp" từ văn bản đi chờ phần 18c; trang văn bản công khai của website chờ phần 18f (đọc cột `published`); ô số ký hiệu văn bản ở minh chứng KPI (18d) vẫn nhập chữ, chọn văn bản đi trong sổ làm sau.

### 2026-10-20 — DT-18 phần 18d: phân hệ KPI

#### Công việc đã thực hiện

- Khảo sát kho hệ thống KPI cũ (chỉ đọc, bản `7b2f948`): lược đồ, luồng giao việc, đăng ký, minh chứng, chấm, ủy quyền chấm, tự đánh giá, tham mưu, biểu quyết, chốt kỳ, mẫu báo cáo. Đối chiếu tiêu chí chung với Mẫu 01-A, 01-B của Hướng dẫn 06-HD/BTCTU do Eric gửi. Không mở, không chép tệp dữ liệu nào của hệ thống cũ.
- Cơ sở dữ liệu năm học: tệp `0064_create_kpi` tạo 12 bảng `kpi_*` và hai bộ quy tắc mặc định; cơ sở dữ liệu định danh: tệp `0053_add_kpi_permissions` thêm năm quyền P09.
- Gói dùng chung: kiểu cấu hình bộ quy tắc, nhãn (`packages/shared/src/kpi.ts`); phân hệ "Đánh giá KPI" 13 mục ở `PORTAL_WORKSPACES`, điều kiện hiện mục, `PERMISSION_CODES`, `DATA_GRID_KEYS`, `PORTAL_QUICK_LINK_PATHS`.
- Máy chủ API (`apps/api/src/kpi/`): máy chấm đọc mọi tham số từ cấu hình; thiết lập; danh mục; việc; phiếu đánh giá, tham mưu, biểu quyết, khóa kỳ; mẫu báo cáo Excel, Word, PDF; chuyển dữ liệu cũ. Hàm đặt tên khóa kho tệp dùng chung `resource-names.ts` (cùng tệp với phần 18a).
- Cổng quản trị: 13 trang của phân hệ "Đánh giá KPI" (`apps/portal/src/kpi/`).
- Thêm quy tắc BR-135, chức năng P09-13 đến P09-19, quyền PQ-79, màn hình MH-167 đến MH-179, kịch bản CT-678 đến CT-696, tiêu chí AC-669 đến AC-678. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/kpi/kpi.test.ts` CT-18d-1 đến CT-18d-18 đạt 18/18; kiểm thử đơn vị toàn bộ kho mã 918/918 đạt (sau khi gộp 18a; trước khi gộp 908/908, ca CT-16d-3 đổi số phân hệ thành 15); kiểm thử giao diện `tests/e2e/71-kpi.spec.ts` (CT-18d-19) đạt; toàn bộ kiểm thử giao diện 140/141 đạt ngày 20/10/2026 trên máy (ca 04-accounts hỏng do dữ liệu cũ trùng tên trong cơ sở dữ liệu định danh dùng riêng của phần 18d, CI là nguồn chuẩn); `58-system-admin-full-so.spec.ts` sửa số phân hệ thành 15; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo quyết định của Eric ngày 2026-10-19 (chuyển hẳn KPI vào, hai bộ quy tắc). Ngày 2026-10-20 Eric chọn tiêu chí chung theo Mẫu 01-A, 01-B làm tiêu chuẩn chung cho tất cả. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-139.
- Văn bản điều chỉnh Hướng dẫn 06 hạn chế phát tán: chỉ đưa tham số chấm điểm dạng cấu hình, đặt tên "Bộ quy tắc 1".

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-139, `07_QUY_TAC_NGHIEP_VU.md` BR-135, `08_VAI_TRO_NGUOI_DUNG.md` PQ-79, `10_YEU_CAU_CHUC_NANG.md` P09-13 đến P09-19, `11_TIEU_CHI_NGHIEM_THU.md` AC-669 đến AC-678, `14_DAC_TA_GIAO_DIEN.md` MH-167 đến MH-179, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-678 đến CT-696, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.90.0.

#### Vấn đề tồn đọng

- Chưa có danh sách 14 tiêu chí chung và chỉ báo theo cấp học của bản mẫu theo Nghị định 233/2026; bốn mức giữa của thang 6 mức là cấu hình tạm. Số ký hiệu văn bản nối sổ văn bản đi khi phần 18b gộp.

### 2026-10-20 — DT-18 phần 18a: Văn bản đến theo VNPT iOffice

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống: tệp `0018_create_incoming_document_tables` tạo 13 bảng (danh mục văn bản, đơn vị bên ngoài, nhóm đơn vị ban hành, sổ văn bản, người theo dõi và quản trị sổ, lãnh đạo nhận văn bản, văn bản đến, tệp, văn bản liên quan, luồng xử lý, đánh dấu và theo dõi, lịch sử tham mưu) kèm danh mục mặc định theo biểu mẫu của iOffice. Cơ sở dữ liệu định danh: tệp `0052_add_incoming_document_permissions` thêm bốn quyền P09, bỏ phân hệ mới khỏi nhóm VT-14.
- Gói dùng chung: phân hệ "Quản lý văn bản và điều hành" (khóa `documents`) ở `PORTAL_WORKSPACES` với nhóm 1. Văn bản đến (1.1 đến 1.7), 2. Quản trị văn bản (2.1 đến 2.5); điều kiện hiện mục ở `MENU_PERMISSION_RULES`; nhãn ở `packages/shared/src/incoming-documents.ts`; `PERMISSION_CODES`, `DATA_GRID_KEYS`, `PORTAL_QUICK_LINK_PATHS` thêm mục mới.
- Máy chủ API (`apps/api/src/incoming-documents/`): `document-admin.ts` (quản trị văn bản), `incoming-documents.ts` (vào sổ, luồng xử lý, danh sách, tệp, hạn chế xem, đánh dấu), `incoming-print.ts` (phiếu PDF, sổ văn bản đến), `document-exchange.ts` (chỗ nối trục liên thông, bản chạy nội bộ), `incoming-documents.controller.ts`; `apps/api/src/common/resource-names.ts` là hàm tạo tên chung cho khóa kho tệp và bộ nhớ đệm (viết sẵn cho đa thuê bao).
- Cổng quản trị: `apps/portal/src/incoming-documents/` (danh sách 1.1 đến 1.7, biểu mẫu THÔNG TIN VĂN BẢN ĐẾN, chi tiết văn bản có bốn thẻ và các hộp thoại chuyển, trả lại, gia hạn, lưu hồ sơ, vào sổ; năm trang Quản trị văn bản), `router.tsx`, biểu tượng phân hệ.
- Thêm quy tắc BR-134, chức năng P09-09 đến P09-12, quyền PQ-78, màn hình MH-158 đến MH-166, kịch bản CT-667 đến CT-677, tiêu chí AC-663 đến AC-668. Kết quả ngày 20/10/2026: kiểm thử đơn vị CT-18a-1 đến CT-18a-10 đạt 10/10 (cùng `menu-permissions.test.ts`, `quick-links.test.ts` 17/17 ca; sửa `system-admin-so.test.ts` CT-16d-3 đếm 14 phân hệ, 10/10 ca); kiểm thử đơn vị toàn bộ kho mã 900/900 đạt (sau khi sửa ca CT-16d-3); kiểm thử giao diện CT-18a-11 (`70-incoming-documents.spec.ts`) đạt; toàn bộ kiểm thử giao diện 140/140 đạt (spec 58 đếm 14 phân hệ); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo khảo sát VNPT iOffice ngày 2026-10-19 (quyết định của Eric ngày 2026-10-19: sổ văn bản, luồng văn bản làm theo iOffice). Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-138: dữ liệu ở cơ sở dữ liệu hệ thống để giữ qua năm học; lãnh đạo nhận văn bản là danh sách cấu hình; người nhận là nhân sự đang làm việc có tài khoản; mở văn bản là đã đọc, văn bản xem để biết mở là xong; "Đến hạn" là hạn trong 2 ngày tới.
- Bản chạy nội bộ: không kết nối trục liên thông văn bản (văn thư nhập văn bản nhận được, đánh dấu tiếp nhận bằng tay rồi vào sổ; chỗ nối `DocumentExchange`); không có ký số SmartCA. "Tạo việc" từ văn bản làm ở phần 18c; văn bản trả lời ghi số ký hiệu, ngày cho tới khi phần 18b có sổ văn bản đi.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-138, `07_QUY_TAC_NGHIEP_VU.md` BR-134, `08_VAI_TRO_NGUOI_DUNG.md` PQ-78, `10_YEU_CAU_CHUC_NANG.md` P09-09 đến P09-12, `11_TIEU_CHI_NGHIEM_THU.md` AC-663 đến AC-668, `14_DAC_TA_GIAO_DIEN.md` MH-158 đến MH-166, `16_CO_SO_DU_LIEU.md` mục 1 và mục 10, `17_DAC_TA_API.md` mục 12, `21_KICH_BAN_KIEM_THU.md` CT-667 đến CT-677, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.89.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.6.

#### Vấn đề tồn đọng

- Chưa kết nối trục liên thông văn bản và ký số; "Tạo việc", "Tạo lịch họp", "Cấp số và phát hành", báo cáo văn bản đến chờ phần 18b, 18c. Mẫu phiếu trình, phiếu xử lý, phiếu giao nhận tự đặt vì khảo sát chỉ ghi tên nút.

### 2026-10-20 — Kế hoạch DT-18 điều hành nhà trường

#### Công việc đã thực hiện

- Thêm mục 9 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.19): kế hoạch DT-18 gồm tám phần 18a đến 18h và bốn phần 22b, 22d, 22f, 22i chạy ở đợt 5; mỗi phần có phạm vi, đợt, phụ thuộc, YCTD và số migration giữ sẵn; nguyên tắc chung; bảng tiến độ.
- Ghi YCTD-137 (chỉ đổi tài liệu).

#### Quyết định

- Quyết định của Eric ngày 2026-10-19: lộ trình DT-18 → DT-19 → DT-20 → DT-21 → DT-22 → DT-SaaS; văn bản đến, đi, giao việc, lịch theo VNPT iOffice; KPI chuyển hẳn hệ thống của Eric vào School Management; website mỗi trường một tên miền riêng, có chế độ trình diễn; ký số chạy nội bộ; 22b, 22d, 22f, 22i ở đợt 5 của DT-18; AI là thành phần riêng, tắt mặc định.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: năm đợt, mỗi lúc tối đa hai phiên (đợt 1: 18a, 18d; đợt 2: 18b, 18c; đợt 3: 18e, 18g; đợt 4: 18f, 18h; đợt 5: 22b, 22i rồi 22d, 22f); YCTD-138 đến YCTD-149 đánh theo thứ tự đợt; migration giữ sẵn năm học 0064 đến 0071, hệ thống 0018 đến 0022, định danh 0052 đến 0063.
- Phần 18d chỉ ghi hai bộ quy tắc chấm cấu hình được (bộ HD 06-HD/BTCTU đã sửa đổi, bộ NĐ 233/2026); không đưa nội dung văn bản hạn chế phát tán vào kho, tham số chấm điểm để phiên làm 18d nhập thành cấu hình.

#### Thay đổi

- `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9; `24_YEU_CAU_THAY_DOI.md` YCTD-137; `index.md`. Chỉ đổi tài liệu, phiên bản phần mềm giữ nguyên.

#### Vấn đề tồn đọng

- Ghi chép khảo sát VNPT iOffice lưu ngoài kho; phiên làm 18a, 18b, 18c đọc trước khi viết phạm vi chi tiết.
- Văn bản gốc của thông tư danh mục thiết bị tối thiểu, thi đua khen thưởng, bộ tiêu chuẩn kiểm định cần đọc trước khi làm 18g, 22d, 22f.

### 2026-10-20 — DT-17 phần 17d: Tuyển sinh đầu cấp phần 2

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0062_add_entry_admission_intake` thêm loại hình, năm học nhận trẻ cho `admission_campaigns`; `admission_applications` nhận nguồn `routing`, trạng thái `cancelled` và thêm các cột cư trú, cuối cấp, họ tên cha mẹ, giấy tờ đã nộp, đồng ý nhập học, trường tiên tiến, nội dung thông báo, loại hồ sơ, điểm trường nhận, mã gói tin, mã GUID, hủy nhập học; tạo `admission_application_files`, `admission_transfer_results`, `entry_admission_contacts`, `entry_admission_notices`, `entry_admission_notice_recipients`; mục đích tệp `admission_document`. Cơ sở dữ liệu định danh: tệp `0051_add_entry_intake_permissions` thêm ba quyền P02.
- Gói dùng chung: mục 1.3 đến 1.7 của phân hệ "Tuyển sinh đầu cấp" và 5.11 của phân hệ Mầm non ở `PORTAL_WORKSPACES`; điều kiện hiện mục ở `MENU_PERMISSION_RULES`; nhãn loại hình, đồng ý nhập học, trạng thái trường duyệt và xã/phường, loại hồ sơ, giấy tờ đã nộp ở `packages/shared/src/entry-admissions.ts`; `PERMISSION_CODES`, `DATA_GRID_KEYS`, `PORTAL_QUICK_LINK_PATHS` thêm mục mới.
- Máy chủ API (`apps/api/src/entry-admissions/`): `entry-intake.ts` (hồ sơ theo màn hình, bộ lọc như Sở, Cập nhật, Lưu dữ liệu, xác nhận hồ sơ trường tiên tiến, Xóa, Hủy nhập học hồ sơ chưa chuyển, nhập danh sách phân tuyến, giấy tờ, minh chứng, Excel, phiếu PDF), `entry-intake-notices.ts` (1.5), `entry-intake-transfer.ts` (1.6, 1.7, 5.11), `entry-intake.controller.ts` (nhóm `/entry-intake`); `final-year-pdf.ts` nhận tiêu đề riêng của phiếu; tra cứu hồ sơ tuyển sinh công khai có nhãn "Đã hủy nhập học".
- Cổng quản trị: 1.3 đến 1.7 của phân hệ "Tuyển sinh đầu cấp" và 5.11 của phân hệ Mầm non (`apps/portal/src/entry-admissions/EntryIntakePages.tsx`, `entry-intake-api.ts`, `router.tsx`).
- Thêm quy tắc BR-133, chức năng P02-29 đến P02-33, quyền PQ-77, màn hình MH-152 đến MH-157, kịch bản CT-655 đến CT-666, tiêu chí AC-656 đến AC-662. Kết quả ngày 20/10/2026: kiểm thử đơn vị CT-17d-1 đến CT-17d-10 và CT-17d-12 (11 ca) đạt 11/11 (cùng `admissions.test.ts`, `year-transition.test.ts` 27/27 ca); kiểm thử đơn vị toàn bộ kho mã 890/890 đạt; kiểm thử giao diện CT-17d-11 đạt; toàn bộ kiểm thử giao diện 139/139 đạt (lượt chạy trước khi thêm việc chép giấy tờ khi mở năm học và chặn `GET /files/{id}` với tệp `admission_document`, hai thay đổi không đụng giao diện, đã chạy lại tệp kiểm thử đơn vị 17d đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 17d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.3 (khảo sát tài liệu 31 mục 10.2.4, chênh lệch mục 10.7.4). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-135: dùng lại đợt và hồ sơ tuyển sinh của phân hệ Tuyển sinh (YCTD-86); danh sách phân tuyến nhập từ Excel; hồ sơ phân tuyến của đợt đại trà, khảo sát đạt ngay, của đợt tiên tiến chờ trường xác nhận ở 1.3; trạng thái xã/phường nhập tay; năm học nhận trẻ phải đang mở vì chỉ năm học đang dùng ghi được dữ liệu (BR-93); điều kiện chuyển hồ sơ: số định danh, giấy khai sinh, quan hệ của người liên hệ, khai báo dị ứng; mã gói tin `GT-…`, `HN-…`, mỗi hồ sơ một mã GUID; Hủy nhập học hồ sơ đã chuyển xóa mềm hồ sơ học sinh chưa phát sinh dữ liệu; thông báo qua ứng dụng phụ huynh và Zalo OA tới tài khoản cùng số điện thoại, SMS chờ nhà cung cấp; loại hồ sơ Có tài khoản, Tự do chỉ để lọc và hiển thị; ba quyền mới cho VT-02, VT-15, VT-12, VT-03.
- Bản chạy nội bộ: không kết nối phân tuyến của Sở, của xã/phường; không gửi SMS, thư điện tử. Phần 17d là phần cuối của DT-17; DT-17 hoàn tất.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-135, `07_QUY_TAC_NGHIEP_VU.md` BR-133, `08_VAI_TRO_NGUOI_DUNG.md` PQ-77, `10_YEU_CAU_CHUC_NANG.md` P02-29 đến P02-33, `11_TIEU_CHI_NGHIEM_THU.md` AC-656 đến AC-662, `14_DAC_TA_GIAO_DIEN.md` MH-152 đến MH-157, `16_CO_SO_DU_LIEU.md` mục 3 và mục 17, `17_DAC_TA_API.md` mục 6, `21_KICH_BAN_KIEM_THU.md` CT-655 đến CT-666, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.88.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Chưa có kết nối phân tuyến của Sở, của xã/phường và nhà cung cấp SMS, thư điện tử; mẫu phiếu đăng ký, phiếu thông tin chờ mẫu của Sở. Kiểm thử đều đạt.

### 2026-10-19 — DT-17 phần 17c: Tuyển sinh đầu cấp phần 1

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0061_create_entry_admissions` tạo `final_year_records`, `final_year_record_files`, `final_year_record_events`, `final_year_class_confirmations`, `admission_support_requests`, `school_services`; `org_units` thêm tọa độ, tỉnh/thành phố, phường/xã, khu phố, lần xác nhận vị trí; mục đích tệp `final_year_document`. Cơ sở dữ liệu định danh: tệp `0050_add_entry_admission_permissions` thêm bốn quyền P02 và bỏ phân hệ mới khỏi nhóm VT-14.
- Gói dùng chung: phân hệ `entry-admissions` ở `PORTAL_WORKSPACES` (13 phân hệ), điều kiện hiện mục ở `MENU_PERMISSION_RULES`, nhãn và danh sách giá trị ở `packages/shared/src/entry-admissions.ts`.
- Máy chủ API (`apps/api/src/entry-admissions/`): quy tắc luồng sáu trạng thái, kiểm dò, điều kiện duyệt, hạn điều chỉnh (`final-year-rules.ts`); hồ sơ cuối cấp tự lập cho trẻ lớp năm cuối cấp, thao tác hàng loạt, giấy tờ, Excel, PDF A5 và A4 gập đôi, tệp nén, 1.2, 4.1 và điểm cuối của ứng dụng phụ huynh; 1.8, 2.1, 3.3, 3.4, 5.1 kèm chỗ nối `AdmissionSupportMailer`; `/files/{id}` từ chối giấy tờ hồ sơ cuối cấp.
- Cổng quản trị: phân hệ "Tuyển sinh đầu cấp" với 1.1, 1.2, 1.8, 2.1, 3.1 đến 3.4, 4.1, 5.1. Ứng dụng phụ huynh: nút "Hồ sơ cuối cấp" trên thẻ của con.
- Thêm quy tắc BR-132, chức năng P02-24 đến P02-28, quyền PQ-76, màn hình MH-142 đến MH-151, MP-22, kịch bản CT-642 đến CT-654, tiêu chí AC-650 đến AC-655. Kết quả ngày 19/10/2026: kiểm thử đơn vị CT-17c-1 đến CT-17c-12 đạt 12/12, cùng `menu-permissions.test.ts`, `system-admin-so.test.ts` 26/26 ca đạt (chạy cục bộ); kiểm thử đơn vị toàn bộ kho mã 874/874 đạt; kiểm thử giao diện CT-17c-13 đạt; toàn bộ kiểm thử giao diện 133/136 đạt (cục bộ; ba ca lỗi không thuộc 17c: 01-login CT-15a-7 lỗi cục bộ đã biết, 04-accounts và 59 CT-16c-17 do dữ liệu kiểm thử còn lại ở cơ sở dữ liệu định danh riêng của phần; lần chạy trước hai ca này đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 17c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.3 (khảo sát tài liệu 31 mục 10.2, chênh lệch mục 10.7.4). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-134: luồng sáu trạng thái và cách chuyển; "Xác nhận hồ sơ" là trường xác nhận thay phụ huynh khi phụ huynh xác nhận trên giấy; kiểm dò năm mục; điều kiện duyệt; hạn điều chỉnh lưu ở `settings` khóa `final_year_edit_deadline`; danh sách Diện cư trú; tên nhóm menu 1. đến 5.; quyền cho VT-02, VT-15, VT-12, VT-03; số định danh trên lưới luôn che, tệp Excel, PDF in đủ khi có quyền xem số định danh; cột "Mật khẩu" hiện tình trạng tài khoản phụ huynh; Khởi tạo mật khẩu dùng cấp mật khẩu hàng loạt của dịch vụ định danh; Cập nhật từ Excel dùng cột ID của tệp Xuất Excel, kiểm tra cả tệp, có lỗi không ghi; PDF A5 và A4 gập đôi, Tách file là tệp nén zip; mẫu phiếu kê khai, phiếu thông tin; "Xem vị trí" mở OpenStreetMap ở thẻ mới; 3.1 đến 3.4 chỉ hiển thị, 3.1, 3.2 cần thêm quyền quản lý tài khoản; 5.1 "Gửi email" gửi qua thông báo của ứng dụng phụ huynh, thư điện tử qua chỗ nối `AdmissionSupportMailer` chưa có nhà cung cấp.
- Bản chạy nội bộ: không kết nối phân tuyến của Sở; 1.2 là đánh dấu tay kèm xuất Excel; không có trang, đăng nhập riêng như `truong-tsdc`. Mục 1.3 đến 1.7 để phần 17d.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-134, `07_QUY_TAC_NGHIEP_VU.md` BR-132, `08_VAI_TRO_NGUOI_DUNG.md` PQ-76, `10_YEU_CAU_CHUC_NANG.md` P02-24 đến P02-28, `11_TIEU_CHI_NGHIEM_THU.md` AC-650 đến AC-655, `14_DAC_TA_GIAO_DIEN.md` MH-142 đến MH-151, MP-22, `16_CO_SO_DU_LIEU.md` mục 3, `17_DAC_TA_API.md` mục 6, `21_KICH_BAN_KIEM_THU.md` CT-642 đến CT-654, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.87.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Chưa có kết nối phân tuyến, cơ sở dữ liệu của Sở và nhà cung cấp gửi thư; Diện cư trú, mẫu phiếu PDF chờ đối chiếu danh sách, mẫu của Sở. Kiểm thử đơn vị toàn kho mã 874/874 đạt; kiểm thử giao diện CT-17c-13 đạt, toàn bộ kiểm thử giao diện 133/136 đạt (cục bộ; ba ca lỗi không thuộc 17c: 01-login CT-15a-7 lỗi cục bộ đã biết, 04-accounts và 59 CT-16c-17 do dữ liệu kiểm thử còn lại ở cơ sở dữ liệu định danh riêng của phần; lần chạy trước hai ca này đạt).

### 2026-10-19 — DT-17 phần 17a: báo cáo số liệu EMIS theo chỉ tiêu và mã số của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0060_add_emis_so_indicators` thêm `children.policy_benefits`, `staff.concurrent_disability_support`, `staff.concurrent_shared_position`, `rooms.built_this_year`, bảng `emis_record_submissions`; xóa số liệu nhập tay theo mã cũ của thẻ Ngân sách nhà nước, thẻ 1 của 1.2 và 2.3. Không có migration hệ thống, định danh; không thêm mã quyền.
- Máy chủ API: Biểu 01.ĐN-MN mã 01 đến 217, Biểu 08.ĐN-NSNN mã 1 đến 71, 1.2.1 thẻ 1 mã 01 đến 84 kèm cột Xây dựng mới, 2.1, 2.2, 2.3 theo cấu trúc của Sở, 2.4 trống ở học kỳ I; xóa số liệu của thẻ; năm điểm cuối của 1.1.2 Gửi báo cáo đầu năm; năm biểu mẫu gửi riêng thay biểu mẫu chung của 1.1.
- Cổng quản trị: trang lập theo cột, dòng của Sở, nút "Lấy dữ liệu từ hệ thống", "Xóa dữ liệu"; trang mới 1.1.2; 1.2 chỉ còn "Gửi dữ liệu"; ô mới ở hồ sơ học sinh, hồ sơ nhân sự, khai báo phòng.
- Thêm quy tắc BR-131, kịch bản CT-635 đến CT-641, tiêu chí AC-644 đến AC-649, màn hình MH-141; sửa P17-18, P17-20, P17-24 đến P17-28, PQ-63, MH-82, MH-131 đến MH-136. Kết quả ngày 19/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`) 867/867 ca đạt (lượt toàn kho 853 đạt; 14 ca chạy lại riêng đạt: CT-16a-7 sửa theo biểu mẫu gửi mới và 13 ca điểm danh bị hủy do dữ liệu cũ của cơ sở dữ liệu thử cục bộ); toàn bộ kiểm thử giao diện 137/137 ca đạt (lượt toàn bộ 136 đạt; CT-641 sửa hộp xác nhận Xóa dữ liệu rồi chạy lại spec 68 đạt 2/2); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Theo quyết định của Eric ngày 2026-10-16 (làm đủ mọi tính năng đã khảo sát; tính năng cần hệ thống ngoài làm bản chạy nội bộ), 1.1.2 là bản chạy nội bộ: "Gửi hồ sơ" xuất tệp và đánh dấu đã gửi, không truyền dữ liệu lên Bộ, Sở. Các điểm chi tiết (cách tính từng chỉ tiêu, bảng ánh xạ loại phòng, nhãn tạm cho Biểu 08 mã 24 đến 55, xóa số liệu nhập tay theo mã cũ) Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-132.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-132, `07_QUY_TAC_NGHIEP_VU.md` BR-131, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.86.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Tên mục 2 đến 5 của Biểu 08 (mã 24 đến 55), mã chi tiết khối B của 1.2.1 chờ đối chiếu; thẻ 2 đến 5 của 1.2.1, biểu 1.3, 2.4 chưa khảo sát được nội dung; 1.2.2 một dòng biểu mẫu cho cả năm thẻ (YCTD-132, Hạn chế).

### 2026-10-19 — DT-17 phần 17b: kí hồ sơ theo bốn mẫu của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống: tệp `0017_adjust_signing_to_so_templates` (chứng thư HSM chuyển REMOTE SIGNING, `signing_dossiers` thêm tệp XML và ghi chú, bảng `signing_create_errors`). Không có migration năm học, định danh.
- Máy chủ API: nội dung bốn loại hồ sơ theo phần và mục của Sở, tệp XML qua chỗ nối `DossierXmlWriter`, điểm cuối xem hồ sơ kí, tải file lỗi, kiểm tra quyền xem số định danh với hồ sơ nhân sự, học sinh, nhà phát hành trong năm giá trị, không tạo hồ sơ sổ đầu bài mới.
- Cổng quản trị: 1.1, 2.1 có thông tin trường; 1.1 chọn nhà phát hành, lịch sử yêu cầu đăng ký; 2.2 cột theo loại, lọc khối, lớp, cửa sổ "Xem hồ sơ kí", "Tải file lỗi"; 2.3 cột theo Sở.
- Thêm quy tắc BR-130, kịch bản CT-626 đến CT-634, tiêu chí AC-640 đến AC-643; sửa P01-28 đến P01-31, PQ-75, MH-137 đến MH-140. Kết quả ngày 19/10/2026 (trước khi gộp phần 17e): kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`) 856/856 ca đạt; toàn bộ kiểm thử giao diện 134/134 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; CI đạt trên nhánh đã gộp.

#### Quyết định

- Eric quyết định ngày 2026-10-19: "hồ sơ kí in đầy đủ số CCCD và số định danh như Sở, nhưng chỉ người có quyền xem số định danh (P02.national-id.view hoặc quyền tương đương hiện có) mới tạo và xem được hồ sơ kí"; vẫn giữ bản chạy nội bộ, không ký số thật. Đây là ngoại lệ có kiểm soát đối với quy định che số định danh của YCTD-13 (chỉ VT-02, VT-15, VT-03, VT-12 xem đầy đủ số định danh). Các điểm chi tiết khác Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-133.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-133, `07_QUY_TAC_NGHIEP_VU.md` BR-130, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.85.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Chưa có lược đồ XML của Bộ và nhà cung cấp kí số; một số mục của mẫu Sở chưa có dữ liệu nên để trống (YCTD-133, Hạn chế).

### 2026-10-19 — DT-17 phần 17e: 1.7 Rà soát thông tin kiểm định CLGD đủ ô như Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0063_add_accreditation_review_so_fields` thêm 12 cột được để trống vào `accreditation_reviews` (tên trường, mã trường, loại hình, cấp học; năm, ngày công nhận, mức độ chuẩn quốc gia; năm, ngày công nhận, cấp độ kiểm định CLGD; thời điểm đăng ký chuẩn quốc gia; diện tích sàn xây dựng trên học sinh) kèm ràng buộc kiểm tra. Hồ sơ trường thêm tám khóa ở jsonb `general`, không cần migration.
- Máy chủ API: `/accreditation-review`, `/accreditation-review/collect` trả, nhận thêm các ô mới; Ghi bắt buộc tên trường, mã trường, loại hình, ghi chú tối đa 500 ký tự; Lấy dữ liệu lấy tên Trường chính, mã định danh của hồ sơ trường (chưa có thì mã Trường chính), loại hình, chuẩn quốc gia, kiểm định CLGD, diện tích sàn xây dựng ở hồ sơ trường (chưa nhập thì tổng diện tích phòng đang dùng); `PUT /school-profile` từ chối năm công nhận ngoài 1900 đến 2100.
- Cổng quản trị: 1.7 có năm khối theo thứ tự của Sở (Thông tin trường, Chuẩn quốc gia, Kiểm định chất lượng giáo dục, Cơ sở vật chất và học sinh, Ghi chú) và bộ đếm ký tự của ghi chú; 1.1 Hồ sơ trường thẻ Thông tin chung có thêm tám ô.
- Thêm kịch bản CT-619 đến CT-625, tiêu chí AC-636 đến AC-639, quy tắc BR-129; không có chức năng, màn hình, quyền mới (sửa P01-15, P01-24, MH-79, MH-123). Kết quả ngày 19/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`) 854/854 ca đạt; toàn bộ kiểm thử giao diện 135/135 ca đạt (chạy cục bộ); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 17e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8 (chênh lệch R1–R5 ở tài liệu 31 mục 10.7.3). Mã mức độ, cấp độ theo Thông tư 19/2018/TT-BGDĐT; cấp học cố định "Mầm non"; tên trường lấy ở cây đơn vị, mã trường lấy mã định danh của hồ sơ trường; thời điểm đăng ký chuẩn quốc gia là chữ tự do tối đa 100 ký tự; "Diện tích xây dựng" cũ của hồ sơ trường giữ riêng với "Diện tích sàn xây dựng" mới; ghi chú đã ghi dài hơn 500 ký tự vẫn hiện nhưng phải rút gọn trước lần ghi sau. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-136.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-136, `07_QUY_TAC_NGHIEP_VU.md` BR-129, `10_YEU_CAU_CHUC_NANG.md` P01-15, P01-24, `11_TIEU_CHI_NGHIEM_THU.md` AC-636 đến AC-639, `14_DAC_TA_GIAO_DIEN.md` MH-79, MH-123, `16_CO_SO_DU_LIEU.md` mục 2, `17_DAC_TA_API.md` mục 5, 6, `21_KICH_BAN_KIEM_THU.md` CT-619 đến CT-625, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.84.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Thời điểm đăng ký chuẩn quốc gia chưa có định dạng của Sở để kiểm tra; cách tính phòng bộ môn chưa đối chiếu biểu mẫu kiểm định chính thức. Báo cáo EMIS (phần 17a) sẽ đọc các ô hồ sơ trường mới.

### 2026-10-19 — Khảo sát bổ sung hệ thống của Sở và kế hoạch DT-17

#### Công việc đã thực hiện

- Khảo sát thêm hệ thống của Sở GD&ĐT TP.HCM: Eric đăng nhập, Claude chỉ đọc giao diện, không bấm nút ghi. Đã xem phân hệ Tuyển sinh đầu cấp (15 màn hình), nội dung bốn loại hồ sơ kí, tên và mã số chỉ tiêu Biểu 01.ĐN-MN (mã 01 đến 217), Biểu 08.ĐN-NSNN (mã 1 đến 71), báo cáo cơ sở vật chất TP.HCM (mã 01 đến 84), các biểu EMIS khác, trang gửi báo cáo, màn hình 1.7. Phân hệ Hồ sơ điện tử không được cấp cho tài khoản trường nên không xem được.
- Thêm mục 10 vào `31_KHAO_SAT_HE_THONG_SO.md` (phiên bản 1.2), gồm bảng đối chiếu với mã nguồn của DT-16 (E1–E11 EMIS, K1–K10 kí hồ sơ, R1–R5 rà soát kiểm định, Tuyển sinh đầu cấp chưa có).
- Thêm mục 8 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.14): DT-17 gồm năm phần 17a đến 17e.

#### Quyết định

- DT-17 chia năm phần, giữ sẵn YCTD-132 đến YCTD-136 và số migration riêng; chạy tối đa hai phần cùng lúc: lượt 1 gồm 17e, 17b; lượt 2 gồm 17a, 17c; lượt 3 là 17d. Thứ tự gộp 17e, 17b, 17a, 17c, 17d.
- Kí hồ sơ: ẩn sổ đầu bài ở cấp Mầm non như Sở, giữ hồ sơ sổ đầu bài đã có; nội dung hồ sơ theo bốn mẫu của Sở, in đủ số định danh theo mẫu và cần thêm quyền xem số định danh; nhà phát hành chọn trong năm giá trị của Sở.
- Tuyển sinh đầu cấp là phân hệ mới dùng chung đăng nhập; phân tuyến, gửi lên cấp trên, chuyển hồ sơ sang CSDL làm bản chạy nội bộ; dùng lại đợt và hồ sơ của tuyển sinh trực tuyến (YCTD-86).
- Hồ sơ điện tử không làm ở DT-17.
- Các lựa chọn trên Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-131 và tài liệu 32 mục 8.

#### Thay đổi

- `31_KHAO_SAT_HE_THONG_SO.md` mục 1, mục 10; `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8; `24_YEU_CAU_THAY_DOI.md` YCTD-131; `index.md`. Chỉ đổi tài liệu, phiên bản phần mềm giữ nguyên.

#### Vấn đề tồn đọng

- Chưa đọc được thẻ 2 đến 5 của báo cáo cơ sở vật chất TP.HCM, dòng chi tiết của báo cáo sức khỏe đầu năm, cấu trúc biểu GDMN cuối năm (trống ở học kỳ I), tên các mục 2 đến 5 của chi thường xuyên trong Biểu 08.ĐN-NSNN.
- Phân hệ Hồ sơ điện tử chờ Sở cấp cho tài khoản trường.

### 2026-10-18 — DT-15 phần 15f3: các phân hệ Bếp – kho, Tương tác, Giảng dạy, Tuyển sinh – tuyển dụng, Báo cáo theo giao diện chung của Sở

#### Công việc đã thực hiện

- Đưa 8 trang của năm phân hệ Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng; Báo cáo sang giao diện chung của Sở: tiêu đề có số theo menu (1. Kho và tài sản, 2. Đề nghị mua hàng, 1. Tương tác với phụ huynh, 2. Hoạt động và tin tức, 1. Bài học và giáo án, 1. Tuyển sinh, 2. Tuyển dụng, 1. Báo cáo và bảng điều khiển); 32 lưới dữ liệu chung (tồn kho, sổ kho, tài sản, hỏng và mất, kiểm kê, phiếu mua hàng, nhà cung cấp, đề nghị mua hàng, bình chọn, khảo sát, góp ý, đồ bị mất, bình luận, danh mục nội dung, tin tức, thư viện, ngoại khóa, giáo án chờ duyệt, bài học, danh mục bài học, kế hoạch giảng dạy, tuyển sinh, tuyển dụng, nhật ký xuất); nút Thêm mới mở biểu mẫu theo khối, nút Ghi. Lưới Danh mục tài sản có cột "Thiết bị dạy học" khi người dùng có quyền quản lý thiết bị dạy học, giữ phần gắn tài sản với thiết bị dạy học của DT-16 phần 16i (YCTD-128). Thêm thành phần `FormPanel.tsx` của cổng quản trị. Nghiệp vụ, điểm cuối, quyền không đổi; không có tệp thay đổi cấu trúc dữ liệu.
- Thêm kịch bản CT-611 đến CT-618, tiêu chí AC-628 đến AC-635; không có quy tắc nghiệp vụ, quy tắc phân quyền, chức năng, màn hình mới (đổi MH-20 đến MH-29, MH-36, MH-57, MH-63); thêm kiểm thử giao diện `tests/e2e/67-communication-grids.spec.ts`. Kết quả: build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; kiểm thử đơn vị toàn bộ kho mã: 848/848 ca đạt; toàn bộ kiểm thử giao diện: 134/134 ca đạt.

#### Quyết định

- Phần 15f3 lấy mã YCTD-115 đã giữ cho phần này. Thẻ Duyệt hoạt động, thẻ Trao đổi, thời khóa biểu, các bảng báo cáo tổng hợp và hồ sơ ứng viên giữ bố cục vì không phải danh sách; lưới phân trang tại chỗ trên điểm cuối cũ; không thêm ô chọn dòng vì không có thao tác hàng loạt; trang Thực đơn bữa ăn (`/kitchen`, MH-18) không thuộc nhóm Bếp – kho, mua hàng nên không đổi trong 15f3. Cột "Thiết bị dạy học" của lưới Danh mục tài sản chỉ hiện khi người dùng có quyền quản lý thiết bị dạy học, cùng điều kiện với khối gắn tài sản của phần 16i. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-115.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-115, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-20 đến MH-29, MH-36, MH-57, MH-63, BC-13, BC-16, `11_TIEU_CHI_NGHIEM_THU.md` AC-628 đến AC-635, `16_CO_SO_DU_LIEU.md` mục `user_grid_settings`, `17_DAC_TA_API.md` giao kèo cấu hình lưới, `21_KICH_BAN_KIEM_THU.md` CT-611 đến CT-618, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.83.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chưa có Xuất Excel, thao tác hàng loạt ở các lưới của năm phân hệ; duyệt, từ chối có lý do vẫn nhập ở từng dòng; danh sách rất dài vẫn tải một lần.

### 2026-10-18 — DT-15 phần 15f1: phân hệ Tài chính – học phí theo giao diện chung của Sở

#### Công việc đã thực hiện

- Đưa 15 trang của phân hệ "Tài chính – học phí" sang giao diện chung của Sở: tiêu đề có số theo menu (1.1. Biểu phí và dịch vụ đến 3.2. Chốt kỳ tài chính); 20 lưới dữ liệu chung (dịch vụ, loại miễn giảm, hóa đơn, các danh sách chờ duyệt, công nợ, nhắc nợ, đề xuất xử lý, phiếu thu, phiếu chi, quỹ, nợ nhà cung cấp, khoản mục thu chi, tài khoản kế toán, quy tắc ghi sổ, kỳ tài chính); nút Thêm mới mở biểu mẫu theo khối, nút Ghi; xóa phiên bản biểu phí, phiếu chi nháp, dòng sao kê, bỏ quy tắc ghi sổ qua hộp xác nhận xóa dùng chung. Nghiệp vụ, điểm cuối, quyền không đổi; không có tệp thay đổi cấu trúc dữ liệu.
- Thêm kịch bản CT-599 đến CT-610, tiêu chí AC-616 đến AC-627; không có quy tắc nghiệp vụ, quy tắc phân quyền, chức năng, màn hình mới (đổi MH-04, MH-05, MH-06, MH-07, MH-08, MH-09, MH-10, MH-11, MH-39, MH-61, MH-62, MH-67, MH-68, MH-69). Kết quả ngày 18/10/2026 sau khi gộp nhánh chính: build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; kiểm thử đơn vị toàn bộ kho mã 848/848 ca đạt; toàn bộ kiểm thử giao diện 133/133 ca đạt.

#### Quyết định

- Phần 15f1 lấy mã YCTD-114 đã giữ sẵn. Màn hình không phải danh sách (bảng đăng ký dịch vụ, biểu phí theo phiên bản, sổ quỹ, đối chiếu ngân hàng, nhật ký chung, sổ cái, cân đối số phát sinh) giữ bố cục; lưới phân trang tại chỗ trên điểm cuối cũ; danh sách chờ duyệt đặt nhóm Duyệt, Từ chối dưới dòng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-114.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-114, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-04, MH-05, MH-06, MH-07, MH-08, MH-09, MH-10, MH-11, MH-39, MH-61, MH-62, MH-67, MH-68, MH-69, BC-13, BC-15, BC-16, `17_DAC_TA_API.md` giao kèo cấu hình lưới, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.82.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chưa có Xuất Excel, duyệt hàng loạt ở các lưới của phân hệ; chi tiết hóa đơn, lập phiếu thu, giao dịch chuyển khoản chờ xử lý, nhập tệp sao kê giữ giao diện cũ; danh sách rất dài vẫn tải một lần.

### 2026-10-18 — DT-15 phần 15f2: phân hệ Nhân sự – chấm công, lương theo giao diện chung của Sở

#### Công việc đã thực hiện

- Đưa 12 trang của phân hệ "Nhân sự – chấm công, lương" sang giao diện chung của Sở: tiêu đề có số theo menu (1.1. Chấm công đến 3.2. Đánh giá nhân sự); 17 lưới dữ liệu chung ở 10 trang (đơn nghỉ, quy định và số ngày phép năm, ngày lễ, lịch bù, lịch công tác, phiếu lương, quyết toán, điều chỉnh lương, khoản lương, thưởng và khấu trừ, việc, kế hoạch, chỉ số và phiếu đánh giá); nút Thêm mới mở biểu mẫu theo khối, nút Ghi; xóa ngày lễ, lịch bù, lịch công tác qua hộp xác nhận xóa dùng chung. Nghiệp vụ, điểm cuối, quyền không đổi; không có tệp thay đổi cấu trúc dữ liệu.
- Thêm kịch bản CT-431 đến CT-437, tiêu chí AC-475 đến AC-481; không có quy tắc nghiệp vụ, quy tắc phân quyền, chức năng, màn hình mới (đổi MH-13, MH-14, MH-15, MH-37, MH-44, MH-52, MH-53, MH-54, MH-56, MH-58, MH-59, MH-60). Kết quả ngày 15/10/2026 trên nhánh trước khi gộp phần 15h1: build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; kiểm thử đơn vị toàn bộ kho mã 709/710 ca đạt, ca không đạt CT-15g-11 (số ngày còn lại trước khi hết hạn mật khẩu, phụ thuộc thời điểm chạy ở ranh giới ngày) không liên quan phần này, chạy lại riêng tệp `password-expiry.test.js` 5/5 ca đạt; toàn bộ kiểm thử giao diện 91/91 ca đạt.

#### Quyết định

- Thực hiện đợt 15f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5, chia theo phân hệ thành 15f1, 15f2, 15f3 làm song song, giữ mã YCTD-113 đến YCTD-115; phần 15f2 gộp trước nên lấy YCTD-113 (bản nháp ghi YCTD-114). Màn hình không phải danh sách (bảng chấm công tháng, bảng lương tháng, bảng quyết toán, biểu thuế, phiếu lương của tôi, bảng tiến độ, kết quả đánh giá của tôi) giữ bố cục; lưới phân trang tại chỗ trên điểm cuối cũ; không thêm ô chọn dòng vì không có thao tác hàng loạt. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-113.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-113, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-13, MH-14, MH-15, MH-37, MH-44, MH-52, MH-53, MH-54, MH-56, MH-58, MH-59, MH-60, BC-13, BC-15, BC-16, `16_CO_SO_DU_LIEU.md` mục `user_grid_settings`, `17_DAC_TA_API.md` giao kèo cấu hình lưới, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.81.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chưa có Xuất Excel, xóa hàng loạt ở các lưới của phân hệ; duyệt, từ chối có lý do và cập nhật tiến độ việc vẫn là ô nhập trong cột thao tác; danh sách rất dài vẫn tải một lần; tiêu đề cột tiền canh trái trong khi số tiền canh phải.

### 2026-10-18 — 2.1 Hồ sơ lớp học: cột và số dòng mặc định theo Sở

#### Công việc đã thực hiện

- Claude đổi cột hiện, ẩn mặc định của lưới "2.1. Hồ sơ lớp học" theo quan sát màn hình của Sở (`31_KHAO_SAT_HE_THONG_SO.md` mục 9.8, 9.9): hiện Lớp ghép, Ghép vào lớp, Lớp giải thể; ẩn Phân hiệu, Giáo viên chủ nhiệm, Điểm trường. Số dòng mặc định của lưới 2.1 là 50; cột mặc định khi xuất Excel không chọn cột đổi theo.
- Sửa CT-403, CT-406, kiểm thử `classes-so.test.ts`, `08-classes.spec.ts`, `54-school-classes-so.spec.ts`. Kết quả trên máy ngày 15/10/2026: build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; `classes-so.test.ts` đạt; `08-classes.spec.ts`, `54-school-classes-so.spec.ts` đạt.

#### Quyết định

- Số dòng mặc định riêng của màn hình (50) chỉ dùng khi người dùng chưa chọn số dòng của lưới và chưa chọn số dòng mặc định chung; hằng số chung giữ 20. Cột Khối, Nhóm trẻ giữ hiện vì là hai phần của cột "Nhóm lớp" của Sở. Mã YCTD-113 đến YCTD-115 dành cho các phần 15f, YCTD-116 và phiên bản 0.66.0 đã dùng cho đợt 15h1 nên thay đổi này là YCTD-117, phiên bản 0.80.1.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-117, `14_DAC_TA_GIAO_DIEN.md` MH-03, `11_TIEU_CHI_NGHIEM_THU.md` AC-447, AC-450, `17_DAC_TA_API.md` mục 5, `21_KICH_BAN_KIEM_THU.md` CT-403, CT-406, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.80.1.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-18 — DT-16 phần 16k: phân hệ Quản lý kí hồ sơ, bản chạy nội bộ

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống: tệp `0015_create_signing_tables` tạo `signing_certificates` (chứng thư số nhà trường, một dòng), `signing_dossiers` (hồ sơ kí theo năm học), `signing_events` (lịch sử thao tác) và dãy số `signing_dossier_code` (mã định danh hồ sơ). Cơ sở dữ liệu định danh: tệp `0049_add_signing_permissions` thêm bốn quyền `P01.signing.view`, `P01.signing.manage`, `P01.signing.sign`, `P01.signing.certificate` và bỏ phân hệ mới khỏi nhóm Phụ huynh. Không có migration năm học.
- Máy chủ API: nhóm điểm cuối `/signing` (`apps/api/src/signing/`): chứng thư số (ghi, đăng ký kí nội bộ, hủy đăng ký, ảnh con dấu, đánh dấu đồng bộ), danh sách đối tượng theo loại, tạo hồ sơ (tệp PDF dựng bằng công cụ PDF của phần 16a, mã băm SHA-256), kí xác nhận nội bộ qua chỗ nối `DossierSigner`, tải thông tin thay đổi, hủy, xác nhận hoàn thành, hủy xác nhận, đánh dấu đã gửi, tải tệp (ghi nhật ký xuất), xuất dữ liệu sổ đầu bài. Công cụ PDF dùng chung nhận thêm khổ dọc và phần cuối tài liệu.
- Cổng quản trị: phân hệ mới "Quản lý kí hồ sơ" với "1.1. Chứng thư số nhà trường", "2.1. Đồng bộ chứng thư số", "2.2. Kí hồ sơ trường, lớp, nhân sự, học sinh", "2.3. Xác nhận hoàn thành và gửi hồ sơ".
- Thêm chức năng P01-28 đến P01-31, quyền PQ-75, kịch bản CT-589 đến CT-598, tiêu chí AC-612 đến AC-615, quy tắc BR-128, màn hình MH-137 đến MH-140. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 848/848 ca đạt; toàn bộ kiểm thử giao diện 133/133 ca đạt (CI, lượt chạy 39121128162); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ, có chỗ nối để cắm kết nối thật, nút ghi đúng việc làm. Áp dụng cho kí số: không có chữ ký số thật, nút "Kí xác nhận nội bộ" thay "Ký số", không có "Đăng nhập và kí"; gửi hồ sơ là "Đánh dấu đã gửi". Thực hiện phần 16k của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7, phần cuối của DT-16. Nội dung hồ sơ PDF, tên nhóm menu, quy trình trạng thái, quyền theo vai trò (BR-128, PQ-75) do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-130.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-130, `07_QUY_TAC_NGHIEP_VU.md` BR-128, `08_VAI_TRO_NGUOI_DUNG.md` PQ-75, `10_YEU_CAU_CHUC_NANG.md` P01-28 đến P01-31, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-137 đến MH-140, `16_CO_SO_DU_LIEU.md` mục 1, 2, 20, `17_DAC_TA_API.md` mục 5, 17, 17.1, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.80.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa có nhà cung cấp chữ ký số và giao diện lập trình của Bộ, Sở: tệp đã kí là xác nhận nội bộ, không có giá trị của chữ ký số; chỗ nối `DossierSigner` để thay bằng kí từ xa sau này. Khảo sát chưa có mẫu hồ sơ của Sở nên nội dung tệp PDF do Claude chọn; sổ đầu bài của trường mầm non lấy điểm danh và lịch hoạt động của lớp theo tháng.

### 2026-10-18 — DT-16 phần 16j: báo cáo số liệu EMIS theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0059_create_emis_report_values` tạo bảng `emis_report_values` (số liệu nhập tay theo biểu, thẻ, mã chỉ tiêu). Không có migration hệ thống (số 0014 dành cho phần 16j không dùng), không có migration định danh.
- Máy chủ API: dịch vụ bảy biểu EMIS (`apps/api/src/emis/`) với `/reports/emis/forms/{form}` (xem), `/tabs/{tab}` (ghi), `/tabs/{tab}/fill` (Lấy dữ liệu, Lấy dữ liệu năm trước, không lưu), `/export` (Excel mỗi thẻ một trang, in tên đơn vị hành chính); bảy biểu đăng ký gửi lên cấp trên; `/upper-level-submissions/{form}/error-file` (Xuất file lỗi dùng chung); màn hình nhập khóa khi biểu đã đánh dấu đã gửi hoặc đang chờ mở khóa.
- Cổng quản trị: phân hệ "Báo cáo số liệu" có nhóm "1. Báo cáo đầu năm" (1.1, 1.2, 1.3) và "2. Báo cáo cuối năm" (2.1 đến 2.4) dùng một màn hình chung; 1.1 thêm thẻ "Ngân sách nhà nước" và danh sách gửi báo cáo bảy biểu kèm dòng "Số đã gửi, Số cần gửi, Lần gửi cuối"; mỗi dòng biểu có "Xuất file lỗi".
- Thêm chức năng P17-24 đến P17-28 (sửa P17-18, P17-20, P17-22), kịch bản CT-580 đến CT-588, tiêu chí AC-607 đến AC-611, quy tắc BR-127, màn hình MH-131 đến MH-136. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 832/832 ca đạt; toàn bộ kiểm thử giao diện 131/131 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ, nút ghi đúng việc làm ("Xuất tệp gửi", "Đánh dấu đã gửi"), không có nút "Gửi". Thực hiện phần 16j của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Tên, mã số chỉ tiêu và cột của bảy biểu, sáu mục I đến VI của 2.1, ba thẻ của 2.2, dữ liệu nguồn của từng thẻ, cột của 1.3 theo khảo sát, quy tắc nhập số liệu (BR-127) do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-129.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-129, `07_QUY_TAC_NGHIEP_VU.md` BR-127, `10_YEU_CAU_CHUC_NANG.md` P17-18, P17-20, P17-22 đến P17-28, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-82, MH-131 đến MH-136, `16_CO_SO_DU_LIEU.md` mục 18, 20, `17_DAC_TA_API.md` mục 5, 17, 17.1, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.79.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa có giao diện lập trình của Bộ, Sở nên không truyền đi (chỗ nối `UpperLevelGateway` của phần 16a); tên, mã số chỉ tiêu của bảy biểu do Claude đặt, cần đối chiếu biểu mẫu chính thức; 1.3 đã khớp cột với khảo sát, chưa khớp dòng; 2.1, 2.4 tính tại thời điểm xem, không giữ số đầu năm; II.06 và II.07 có thể trùng (học sinh chuyển đi cũng có trạng thái thôi học); thẻ Nhà vệ sinh lấy đủ VS.01 đến VS.06 từ khai báo phòng (VS.05, VS.06 theo thuộc tính phòng vệ sinh của phần 16i: `toilet_users` = `staff`, `toilet_standard` = `met`); mức độ đạt chuẩn theo khối phòng của phần 16i chưa đưa vào biểu EMIS 1.2; thẻ Thông tin khác dùng 1, 0 cho có, không; Lấy dữ liệu năm trước cần năm học trước đã chạy migration 0059.

### 2026-10-18 — DT-16 phần 16i: cơ sở vật chất, thiết bị dạy học đủ theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0058_add_facilities_so_parity` tạo bảng `facility_investments` (6.1), `facility_standard_levels` (mức độ đạt chuẩn của 1.2), `facility_import_jobs` (lần nhập phòng, danh mục thiết bị).
- Máy chủ API: 1.2 Báo cáo cơ sở vật chất kèm nhà vệ sinh, mức độ đạt chuẩn và biểu mẫu gửi `facilities-report`; 6.1 thực trạng và nhu cầu đầu tư; nhập phòng, danh mục thiết bị từ Excel (`/facility-imports`); biểu mẫu gửi `equipment-summary` cho 2.3; thuộc tính nhà vệ sinh chỉ cho Phòng vệ sinh.
- Cổng quản trị: mục mới 1.2, 2.2, 2.3 của phân hệ Cơ sở vật chất, TBDH; nhóm mới 6 (6.1, 6.2) của phân hệ Mầm non; Nhập từ Excel ở 1.1, 2.1, 2.2; khối Gắn thiết bị dạy học ở Kho, thẻ Tài sản.
- Thêm chức năng P13-13 đến P13-15, P17-23, kịch bản CT-572 đến CT-579, tiêu chí AC-602 đến AC-606, quy tắc BR-126, màn hình MH-127 đến MH-130. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 832/832 ca đạt; toàn bộ kiểm thử giao diện 130/130 ca đạt (CI, lượt chạy 39103041728; CT-15a-8 của `01-login.spec.ts` sửa theo nhóm menu mới "6. Cơ sở vật chất"); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở; tính năng cần hệ thống ngoài làm bản chạy nội bộ với nút ghi đúng việc làm ("Xuất tệp gửi", "Đánh dấu đã gửi"). Thực hiện phần 16i của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Mức độ đạt chuẩn theo khối do Hiệu trưởng đánh giá, mức của trường là mức thấp nhất; thông tin nhà vệ sinh lưu ở thuộc tính phòng; nhập Excel dùng bảng lần nhập riêng (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-128, `07_QUY_TAC_NGHIEP_VU.md` BR-126, `10_YEU_CAU_CHUC_NANG.md` P13-13 đến P13-15, P17-23, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-127 đến MH-130, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.78.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Gửi 1.2, 2.3 chưa nối hệ thống của Sở; mức độ đạt chuẩn và thuộc tính nhà vệ sinh cần đối chiếu biểu mẫu chính thức; thẻ nhà vệ sinh của EMIS 1.2 đọc dữ liệu này từ YCTD-129 (phần 16j).

### 2026-10-18 — DT-16 phần 16e: trường, lớp và lịch năm học theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0054_create_accreditation_reviews_and_school_splits` tạo bảng `accreditation_reviews` (rà soát thông tin kiểm định CLGD), `school_split_requests`, `school_split_items` (tách trường). Cơ sở dữ liệu hệ thống: tệp `0013_add_school_week_fields_and_carry_over_time` thêm `school_weeks.term_type`, `school_weeks.is_visible`, `academic_year_databases.carried_over_at`.
- Máy chủ API: ba khóa cấu hình của Trường chính (tên trường hiển thị, tên đơn vị hành chính, tính cân nặng/chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân) kèm kiểu giá trị `text`; tên trường hiển thị ở `/portal-context`, `/public/login-info`; ô cân nặng/chiều cao áp cho 4.3.2; học kỳ, hiển thị của tuần ở `/academic-years/{id}/weeks`; trạng thái chuyển hồ sơ và Hủy chuyển hồ sơ (`/academic-years/rollover/status`, `/academic-years/{id}/cancel-open`); xóa lớp, thao tác hàng loạt trên lớp (`/classes/delete`, `/classes/bulk-update`); dòng giáo viên chưa phân công ở `/class-assignments`; bảy cột lớp theo Sở khi nhập lớp; `/accreditation-review`; nhóm `/school-splits` kèm xuất hồ sơ 82 cột, 75 cột.
- Cổng quản trị: khối "Cấu hình trường" ở 1.4; mục mới "1.7. Rà soát thông tin kiểm định CLGD", "1.8. Tách trường", "3.4. Khai báo tuần", "5.7. Chuyển hồ sơ lên năm học mới"; 2.1 có ô chọn dòng, nút Thay đổi, Giải thể lớp đã chọn, Xóa lớp; 3.3 có dòng "Chưa phân công" và lọc Tình trạng phân công.
- Thêm chức năng P01-24 đến P01-27 (sửa P01-08, P01-13, P02-05), kịch bản CT-551 đến CT-571, tiêu chí AC-595 đến AC-601, quy tắc BR-125, màn hình MH-123 đến MH-126. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 825/825 ca đạt; toàn bộ kiểm thử giao diện 129/129 ca đạt (CI, lượt chạy 39086989582); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ, gồm 1.8 Tách trường. Thực hiện phần 16e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Ba mục của khối "Cấu hình trường" chỉ đặt ở Trường chính; phòng bộ môn ở 1.7 là năm loại phòng giáo dục chuyên biệt, diện tích sàn là tổng diện tích phòng đang dùng; tách trường không truyền dữ liệu, xác nhận đi không đổi trạng thái hồ sơ học sinh, nhân sự; tuần đệm dùng lại cột tuần nghỉ; Hủy chuyển hồ sơ chỉ khi năm học mới chưa có dòng nào thêm hoặc sửa sau giờ chuyển xong và năm học đầu tiên không hủy được; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-127.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-127, `07_QUY_TAC_NGHIEP_VU.md` BR-125, `10_YEU_CAU_CHUC_NANG.md` P01-08, P01-13, P01-24 đến P01-27, P02-05, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-03, MH-30, MH-92, MH-93, MH-123 đến MH-126, `16_CO_SO_DU_LIEU.md` mục 2, 20, `17_DAC_TA_API.md` mục 5, 6, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.77.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Tách trường chưa nối hệ thống của Sở (chỗ nối `SchoolSplitTransport`); tên đơn vị hành chính chưa in lên đầu báo cáo (phần 16j); ô cân nặng/chiều cao cho trẻ nhẹ cân chưa áp cho so sánh hai lần cân đo và thống kê 5.3; "Hiển thị" của tuần chưa được các màn hình chọn tuần khác dùng; cách tính phòng bộ môn, diện tích sàn ở 1.7 chưa đối chiếu biểu mẫu kiểm định chính thức.

### 2026-10-18 — DT-16 phần 16g: nhóm Học sinh đủ theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0056_add_student_records_so` thêm số thứ tự trong lớp, cột xóa hồ sơ, xác thực số định danh, biến động cư trú của `children`, bảng `student_learning_accounts`, `student_transfers`, ba loại nhập mới.
- Máy chủ API: mô đun `student-records` (xóa hồ sơ nháp, mã Bộ, tệp 82 cột theo mẫu Bộ, file lỗi, sắp xếp học sinh, điện thoại nhận tin hàng loạt, chuyển lớp hàng loạt, số định danh, tài khoản học và thi, chuyển trường, công cụ nhập 82 cột); nhập điện thoại nhận tin, số định danh, địa chỉ mới bằng bộ nhập chung; sửa, xóa dòng đối chiếu địa danh.
- Cổng quản trị: 4.1.1 đủ nút; màn hình mới 4.1.2, 4.1.3, 4.1.5, 4.1.8, 4.1.10, 5.4, 5.5; 4.2 chuyển lớp hàng loạt và khối chuyển trường; 4.1.11 nhập địa chỉ mới, sửa, xóa dòng đối chiếu.
- Thêm chức năng P02-18 đến P02-23, kịch bản CT-534 đến CT-550, tiêu chí AC-578 đến AC-594, quy tắc BR-124, quy tắc phân quyền PQ-74, màn hình MH-116 đến MH-122. Kết quả ngày 18/10/2026: 13 ca kiểm thử đơn vị và 4 ca kiểm thử giao diện của phần 16g đạt; kiểm thử đơn vị toàn bộ 810/810, kiểm thử giao diện toàn bộ 122/123 ca đạt (ca hỏng là CT-15a-7 của `01-login.spec.ts`: trang đăng nhập chưa hiện kịp ở đầu lượt chạy, không liên quan phần này, đạt ở các lần chạy trước và sau; ở lần chạy khác hỏng `04-accounts` do tài khoản còn lại trong cơ sở dữ liệu định danh của lần chạy trước và CT-16a-10 do tiến trình xuất nền nhận tác vụ sớm, cũng không liên quan).

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ với nhãn đúng việc làm được. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: chỉ xóa hồ sơ nháp và không xóa cứng; tài khoản học và thi lưu nội bộ vì trẻ mầm non không tự đăng nhập; danh sách trùng là hồ sơ nghi trùng cùng họ tên, ngày sinh; danh mục tổ/thôn lấy từ hồ sơ đang có; trang nhập chung đánh số 4.1.13; không dùng tệp định danh `0048`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-126, `07_QUY_TAC_NGHIEP_VU.md` BR-124, `08_VAI_TRO_NGUOI_DUNG.md` PQ-74, `10_YEU_CAU_CHUC_NANG.md` P02-18 đến P02-23, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-02, MH-40, MH-85, MH-94, MH-116 đến MH-122, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.76.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Kết nối thật tới CSDL Bộ, CSDLQG về dân cư, liên thông giữa các trường chờ giao diện lập trình; tài khoản học và thi chờ phần mềm học, thi.

### 2026-10-17 — DT-16 phần 16h: sức khỏe, dinh dưỡng và thống kê học sinh theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0057_add_student_health_and_menu_fields` thêm tên thực đơn, tháng, tuần, từ ngày, đến ngày, khối áp dụng cho `menus`; tạo bảng `student_health_records` (thông tin sức khỏe học sinh theo học kỳ) và `menu_import_jobs` (lần nhập thực đơn từ Excel).
- Máy chủ API: 4.6 thông tin sức khỏe theo học kỳ (`/student-health`, "Lấy dữ liệu từ 4.3", Xuất Excel); 4.3.2 tổng hợp theo học kỳ, so sánh hai lần cân đo, số được khám định kỳ; 4.5 thông tin chung của thực đơn theo Sở, "Thay đổi" thực đơn nháp, nhập thực đơn từ Excel (`/menu-imports`); 5.3 thống kê học sinh đủ các phần, Xuất Excel, PDF (`/statistics/students`); số liệu báo cáo sức khỏe học sinh đầu năm (`/reports/emis/start-of-year-health`) làm điểm nối cho phần 16j.
- Cổng quản trị: màn hình "4.6.1. Nhập thông tin sức khỏe học sinh"; "5.3. Thống kê học sinh" sáu thẻ (dùng chung cho thẻ 5.3 của trang Thống kê theo tiêu chí ngành); 4.3.2 có ô Tổng hợp theo Tháng hoặc Học kỳ, ô So sánh với đợt, bảng so sánh, cột Được khám định kỳ; 4.5 có biểu mẫu lập thực đơn theo Sở, cột lưới mới, nút "Thay đổi", "Nhập từ Excel"; thành phần nhập Excel dùng chung nhận đường dẫn gốc riêng của phân hệ.
- Thêm chức năng P10-15, P12-10, P17-21, P17-22 (sửa P10-14), kịch bản CT-524 đến CT-533, tiêu chí AC-568 đến AC-577, quy tắc BR-123, màn hình MH-114, MH-115. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 787/787 ca đạt; toàn bộ kiểm thử giao diện 115/115 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ. Thực hiện phần 16h của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Kết quả giáo dục thể chất hai mức Đạt, Chưa đạt; học kỳ theo lịch năm học, chưa khai báo thì tháng 8 đến tháng 12 là học kỳ I; con thương binh, liệt sĩ nhận biết theo chữ trong đối tượng chính sách; thực đơn vẫn theo tuần, từ ngày đến ngày trong một tuần; lần nhập thực đơn dùng bảng riêng thay vì đổi ràng buộc loại nhập của `data_import_jobs`; tên và mã chỉ tiêu báo cáo sức khỏe đầu năm đặt theo dữ liệu có sẵn, màn hình và gửi lên cấp trên để phần 16j; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-125.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-125, `07_QUY_TAC_NGHIEP_VU.md` BR-123, `10_YEU_CAU_CHUC_NANG.md` P10-14, P10-15, P12-10, P17-21, P17-22, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-16, MH-17, MH-18, MH-76, MH-77, MH-114, MH-115, `16_CO_SO_DU_LIEU.md` mục 2, 11, 13, 20, `17_DAC_TA_API.md` mục 5, 13, 15, 17, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.75.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chỉ tiêu báo cáo sức khỏe đầu năm chưa đối chiếu biểu mẫu chính thức của Sở; màn hình 1.3, xuất tệp, gửi lên cấp trên chờ phần 16j; bệnh về mắt dạng chữ trong hồ sơ CSDL ngành chưa chuyển sang bảy loại; nhập thực đơn chưa cập nhật thực đơn đã có; 4.6.1 chưa có nhập từ Excel.

### 2026-10-17 — DT-16 phần 16f: nhóm Nhân sự đủ theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0055_add_staff_so_parity` thêm chín cột của `staff` (tài khoản ngân hàng, tên ngân hàng, mã số thuế, xã ĐBKK, trạng thái xác thực số định danh kèm ngày, người, ghi chú), hai bảng mới `staff_branch_assignments`, `staff_movements`, loại nhập `professional_ratings`. Không thêm tệp định danh (số `0047` giữ cho phần này không dùng), không thêm mã quyền.
- Gói dùng chung: danh mục của Bộ cho hồ sơ cán bộ (trạng thái cán bộ, dân tộc, tôn giáo, vị trí việc làm, nhóm chức vụ, hình thức hợp đồng, trình độ chuyên môn); biểu mẫu hồ sơ chọn theo danh mục, giữ giá trị cũ; khối "Tài khoản ngân hàng, mã số thuế", ô "Ở xã đặc biệt khó khăn (ĐBKK)"; menu thêm 3.1.2, 3.1.3, 3.1.5, 3.5, 5.2, 5.6.
- Máy chủ API: xóa hồ sơ nhập nhầm, Xuất tệp theo mẫu Bộ 75 cột kèm kiểm tra dữ liệu, Xuất file lỗi, tệp mẫu 75 cột kèm dữ liệu, tra cứu danh mục của Bộ; nhân sự phân hiệu; đánh dấu xác thực số định danh (bản chạy nội bộ, chỗ nối `IdentityVerificationGateway`), tiến độ và trùng số định danh; biến động nhân sự bốn loại; nhập mức đánh giá chuẩn nghề nghiệp từ Excel; thống kê nhân sự theo danh mục Bộ và chuẩn nghề nghiệp; 5.9 thêm tài khoản ngân hàng, mã số thuế.
- Cổng quản trị: 3.1.1 thêm Thay đổi, Xóa, Xuất tệp theo mẫu Bộ, Xuất file lỗi, lọc Xã ĐBKK, Xác thực số định danh; màn hình mới 3.1.2 Nhân sự phân hiệu, 3.1.3 Nhập nhân sự từ Excel, 3.1.5 Xác thực số định danh nhân sự với CSDLQG về dân cư, 3.5 Biến động nhân sự (bốn thẻ), 5.2 Thống kê nhân sự, 5.6 Tiến độ xác thực số định danh nhân sự; 3.2 thêm "Nhập mức đánh giá từ Excel"; 4.1.2 Nhập dữ liệu từ Excel bỏ hai phần nhân sự.
- Thêm chức năng P07-06 đến P07-10, kịch bản CT-510 đến CT-523, tiêu chí AC-554 đến AC-567, quy tắc BR-122, quy tắc phân quyền PQ-73, màn hình MH-108 đến MH-113. Kết quả ngày 17/10/2026: 10 ca kiểm thử đơn vị (`apps/api/src/staff/staff-parity.test.ts`) và 4 ca kiểm thử giao diện (`tests/e2e/60-staff-full-so.spec.ts`) của phần 16f đạt; kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 788/788 ca đạt; toàn bộ kiểm thử giao diện 118/118 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt. Kiểm thử giao diện `55-staff-so` sửa cách chọn Dân tộc, Vị trí việc làm vì hai ô thành danh sách chọn.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ với nhãn đúng việc làm được ("Đánh dấu đã xác thực", "Xuất tệp theo mẫu Bộ"), không giả như đã gửi đi. Thực hiện phần 16f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Xóa hồ sơ chỉ với hồ sơ chưa có dữ liệu liên quan; xã ĐBKK đánh dấu theo nhân sự; gán phân hiệu không đổi phạm vi quyền; duyệt chuyển đi cho nghỉ việc, chấm dứt hợp đồng, khóa tài khoản; tiếp nhận chuyển đến tạo hồ sơ nháp; không thêm mã quyền; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-124.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-124, `07_QUY_TAC_NGHIEP_VU.md` BR-122, `08_VAI_TRO_NGUOI_DUNG.md` PQ-73, `10_YEU_CAU_CHUC_NANG.md` P07-01, P07-04, P07-05, P07-06 đến P07-10, P17-17, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-12, MH-40, MH-74, MH-78, MH-108 đến MH-113, `16_CO_SO_DU_LIEU.md` mục 2, 8, 20, `17_DAC_TA_API.md` mục 11, 17, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.74.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa có kết nối thật tới CSDL Bộ, CSDLQG về dân cư, liên thông giữa các trường; 5.1 vẫn giữ thẻ nhân sự cũ; danh mục của Bộ cần đối chiếu bản chính thức; xã ĐBKK chưa có cờ ở danh mục địa danh hành chính; tệp hồ sơ chuyển đến một dòng; nhập mức đánh giá tối đa 20 tiêu chí.

### 2026-10-17 — DT-16 phần 16c: khung trang và đăng nhập theo hệ thống của Sở

#### Công việc đã thực hiện

- Dịch vụ định danh: mã xác nhận dạng ảnh tự vẽ ở máy chủ cho kênh cổng quản trị (bắt buộc khi bật "luôn hiện" hoặc sau số lần nhập sai cấu hình được), quên mật khẩu tự phục vụ bằng mã gửi qua tin nhắn, lịch sử mật khẩu (bảng mới `password_history`), bốn cấu hình mới (số lần sai thì hiện mã xác nhận, số mật khẩu gần nhất không được dùng lại, luôn hiện mã xác nhận, đường dây nóng), điểm cuối công khai `/auth/login-options`, `/auth/captcha`, `/auth/password-reset/request`, `/auth/password-reset/confirm`; tệp định danh `0045` thêm quyền `P01.announcement.manage`.
- Máy chủ API: thông báo hệ thống, ứng dụng liên kết (hai bảng mới ở cơ sở dữ liệu hệ thống, tệp `0011`), ngữ cảnh trường của cổng quản trị, thông tin công khai của trang đăng nhập, kiểm tra mã định danh điện tử của tổ chức 12 chữ số (Nghị định 69/2024/NĐ-CP), người dùng tự sửa thông tin liên hệ trên hồ sơ nhân sự của mình.
- Cổng quản trị: thanh đầu trang có tên trường, ô "Cấp MN · năm học · học kỳ", nút lưới ứng dụng liên kết; menu người dùng đủ bảy mục theo Sở (thêm Hồ sơ nhân sự cá nhân, Hướng dẫn); hộp "Thông báo" khi vào trang; trang đăng nhập có tên, mã trường, ghi nhớ tài khoản, mã xác nhận, liên kết Quên mật khẩu, đường dây nóng; trang Quên mật khẩu; mục "3.6. Thông báo hệ thống", "3.7. Ứng dụng liên kết" của Quản trị hệ thống; khối "Đăng nhập và bảo mật" ở 1.4 Cấu hình trường.
- Thêm chức năng P01-21 đến P01-23, kịch bản CT-489 đến CT-509, tiêu chí AC-533 đến AC-553, quy tắc BR-121, quy tắc phân quyền PQ-72, màn hình MH-102 đến MH-107. Kết quả ngày 17/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 778/778 ca đạt; toàn bộ kiểm thử giao diện 114/114 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Ngày 2026-10-17 gộp nhánh chính có phần 16b, 16d, 16a, 15h2: đổi số tài liệu của phần này (YCTD-123, phiên bản 0.73.0, P01-21 đến P01-23, CT-489 đến CT-509, AC-533 đến AC-553, BR-121, PQ-72, MH-102 đến MH-107); hai mục của Quản trị hệ thống thành "3.6. Thông báo hệ thống", "3.7. Ứng dụng liên kết" vì 3.5 là "Tệp đã tạo" của phần 16a; nút ở khối "Đăng nhập và bảo mật" đổi tên "Lưu đăng nhập và bảo mật"; kịch bản giao diện đổi tên `tests/e2e/59-portal-shell-login.spec.ts`; sửa kiểm thử giao diện `03-org-units` tìm tên trường trong danh sách đơn vị vì thanh đầu trang nay hiện tên trường.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ, gồm đăng nhập chọn trường của Sở. Thực hiện phần 16c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Trang đăng nhập hiện tên, mã trường và năm học đang dùng thay bước chọn trường; mã xác nhận tự sinh ở máy chủ, không dùng dịch vụ ngoài; quên mật khẩu chỉ qua tin nhắn; quyền `P01.announcement.manage` cho VT-01, VT-02; không làm "Đăng nhập năm cũ"; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-123.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-123, `07_QUY_TAC_NGHIEP_VU.md` BR-121, `08_VAI_TRO_NGUOI_DUNG.md` PQ-72, `10_YEU_CAU_CHUC_NANG.md` P01-21 đến P01-23, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-47, MH-83, MH-84, MH-102 đến MH-107, `16_CO_SO_DU_LIEU.md` mục 1, 2, 20, `17_DAC_TA_API.md` mục 4, 5, 11, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.73.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Quên mật khẩu chưa có kênh thư điện tử; chưa có "Đăng nhập năm cũ"; không có đăng nhập một lần của Sở; Cấu hình hiển thị lưới vẫn chỉ có số dòng mặc định; hướng dẫn là trang tĩnh ngắn.

### 2026-10-17 — DT-15 phần 15h2: sửa các hạn chế của văn thư lưu trữ

#### Công việc đã thực hiện

- Phông, hồ sơ văn thư chia theo đơn vị và lọc theo phạm vi; người giải quyết chọn từ nhân sự; nhắc sắp đến hạn, quá hạn; hàng chờ xóa lại tệp ở kho tệp. Tệp hệ thống `0016`.
- Thêm kịch bản CT-483 đến CT-488, tiêu chí AC-527 đến AC-532, quy tắc BR-120, quy tắc phân quyền PQ-71. Kết quả: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 743/743 ca đạt, toàn bộ kiểm thử giao diện 100/100 ca đạt ngày 17/10/2026 trước khi gộp PR 94, 96, 97; sau khi gộp, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt và CI chạy lại đủ kiểm thử đơn vị, giao diện.

#### Quyết định

- Eric chọn ngày 2026-10-16: sổ văn bản đến, đi và biên bản giao nộp, tiêu hủy chờ khảo sát; dùng tệp `0016`. Phạm vi đơn vị, nhắc 3 ngày trước, 20 lần thử xóa lại Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-122.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-122, `07_QUY_TAC_NGHIEP_VU.md` BR-120, `08_VAI_TRO_NGUOI_DUNG.md` PQ-71, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.72.0.

#### Vấn đề tồn đọng

- Sổ văn bản đến, đi và biên bản giao nộp, tiêu hủy chờ khảo sát bổ sung; nhắc hạn chưa gửi tin nhắn.

### 2026-10-17 — DT-16 phần 16a: công cụ xuất, nhập dùng chung và mẫu gửi lên cấp trên

#### Công việc đã thực hiện

- Thêm nút "Xuất PDF" cho lưới dữ liệu dùng chung (bật bằng thuộc tính tùy chọn, năm màn hình), tác vụ xuất nền cho danh sách lớn với màn hình "3.5. Tệp đã tạo", thành phần nhập Excel dùng chung (tải file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập, xuất file lỗi) áp cho Nhập dữ liệu từ Excel và 2.2 Nhập lớp học từ Excel, mẫu "gửi lên cấp trên" chạy nội bộ áp cho Biểu 1 EMIS đầu năm. Ba bảng mới ở cơ sở dữ liệu hệ thống (tệp `0010`), không thêm quyền.
- Thêm chức năng P01-20, P17-19, P17-20, kịch bản CT-472 đến CT-482, tiêu chí AC-516 đến AC-526, quy tắc BR-119, quy tắc phân quyền PQ-70, màn hình MH-101, quy tắc bố cục BC-17. Kết quả ngày 17/10/2026 trên CI của PR 97: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 758/758 ca đạt (gồm 7 ca CT-472 đến CT-478 của `export-tools.test.ts`); toàn bộ kiểm thử giao diện 107/107 ca đạt (gồm 4 ca CT-479 đến CT-482 của `58-export-import-tools.spec.ts`; ca 23 quyết toán từng hỏng vì vượt giới hạn đăng nhập mỗi phút nên các ca 20 đến 24 chờ rồi đăng nhập lại qua `submitSignIn` của `tests/e2e/fixtures.ts`). Trên máy phát triển toàn bộ kiểm thử giao diện 107/107 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 16a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7 theo lựa chọn của Eric ngày 2026-10-16 (bản chạy nội bộ, nút ghi đúng việc làm, để sẵn chỗ nối). Tiến trình xuất nền chạy trong máy chủ API thay cho `apps/worker`; nhập lớp học cập nhật lớp đã có theo cột được chọn; quyền mở khóa của Biểu 1 EMIS là `P01.school-profile.manage`; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-121.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-121, `07_QUY_TAC_NGHIEP_VU.md` BR-119, `08_VAI_TRO_NGUOI_DUNG.md` PQ-70, `10_YEU_CAU_CHUC_NANG.md` P01-20, P17-19, P17-20, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-40, MH-82, MH-92, MH-101, BC-17, `16_CO_SO_DU_LIEU.md` mục 1, 18, `17_DAC_TA_API.md` mục 17, 17.1, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.71.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Xuất PDF, tác vụ nền còn bật dần ở các màn hình khác (16b, lượt 2, 3); tệp mẫu kèm dữ liệu mới có ở lớp học; gửi lên cấp trên mới có Biểu 1 EMIS, chưa truyền đi được.
### 2026-10-17 — DT-16 phần 16d: quản trị hệ thống đủ theo hệ thống của Sở

#### Công việc đã thực hiện

- 1.1 Nhóm người dùng: Hiệu lực theo dữ liệu, Sửa (tên, hiệu lực), Xóa qua hộp xác nhận xóa; không ngừng hiệu lực, không xóa nhóm hệ thống, không xóa nhóm đang có người dùng; nhóm hết hiệu lực không cấp quyền, phân hệ.
- Màn hình mới 1.2 Phân quyền nhóm theo phần mềm: tích phân hệ nhóm được dùng; phân hệ không nhóm nào của tài khoản được dùng thì ẩn khỏi ô chọn phân hệ và menu; máy chủ vẫn kiểm tra quyền theo thao tác; 1.3 nhắc khi nhóm chưa được dùng phân hệ.
- 1.4 Danh sách người dùng đủ theo Sở: cột Mã nhân sự, Mã Bộ, Thời gian đổi, Ngày hết hạn mật khẩu; lọc Mã định danh, ngày hết hạn mật khẩu; Phân nhóm quyền, Cấp mật khẩu hàng loạt, Lấy danh sách CBQL/GV, Xuất Excel qua máy chủ API ghép tài khoản với hồ sơ nhân sự.
- Màn hình mới 1.6 Tài khoản đồng bộ của Bộ, của Sở (bản chạy nội bộ): lưu tên đăng nhập, mật khẩu mã hóa ở bảng thông tin kết nối, không trả mật khẩu; ghi rõ chưa đồng bộ được, để sẵn chỗ nối.
- Thêm chức năng P01-18, P01-19, kịch bản CT-458 đến CT-471, tiêu chí AC-502 đến AC-515, quy tắc BR-118, quy tắc phân quyền PQ-69, màn hình MH-99, MH-100. Kết quả ngày 17/10/2026 trên CI của PR 96: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 748/748 ca đạt (thêm 10 ca CT-458 đến CT-467); toàn bộ kiểm thử giao diện 103/103 ca đạt (thêm 4 ca CT-468 đến CT-471); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt. Trên máy phát triển kiểm thử đơn vị 748 ca đạt; kiểm thử giao diện chạy trên CI vì các phiên khác dùng chung cổng và cơ sở dữ liệu kiểm thử giao diện.

#### Quyết định

- Thực hiện phần 16d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7 theo quyết định của Eric ngày 2026-10-16 (làm đủ tính năng đã khảo sát; tính năng cần hệ thống bên ngoài làm bản chạy nội bộ). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: lưu phân hệ bị bỏ thay vì phân hệ được dùng để phân hệ mới mặc định hiện; Phụ huynh bỏ mọi phân hệ; không thêm mã quyền; 1.6 dùng quyền `P01.integration.manage` và bảng `integration_credentials`; Mã định danh khớp mã nhân sự hoặc mã Bộ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-120, `07_QUY_TAC_NGHIEP_VU.md` BR-118, `08_VAI_TRO_NGUOI_DUNG.md` PQ-69, `10_YEU_CAU_CHUC_NANG.md` P01-18, P01-19, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-30, MH-99, MH-100, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.70.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa đồng bộ được lên CSDL ngành của Bộ, Sở (chưa có giao diện lập trình); 1.2 theo phân hệ của cổng quản trị, không theo sáu phần mềm của Sở; Lấy danh sách CBQL/GV dùng một nhóm quyền chung.
### 2026-10-16 — DT-16 phần 16b: lưới dữ liệu chung, hộp xác nhận xóa, Xuất Excel cho các màn hình còn lại theo hệ thống của Sở

#### Công việc đã thực hiện

- Chuyển danh sách của các màn hình còn lại sang lưới dữ liệu chung (38 khóa lưới mới): 1.1 Khai báo cơ sở vật chất, 2.1 Tổng hợp thiết bị dạy học của phân hệ Quản lý cơ sở vật chất, TBDH; 4.3.2, 5.8, 4.4, 4.1.6, 3.2, 4.5, 4.6.1, 4.6.2 của phân hệ Quản lý giáo dục Mầm non; 2.1 đến 2.5, 3.2 của phân hệ Quản trị hệ thống. Bỏ học sinh khỏi nhóm (một hoặc nhiều), bỏ món, bỏ nguyên liệu, xóa tiêu chuẩn sức khỏe, bỏ liên kết Zalo qua hộp xác nhận xóa; tiêu đề trang theo số menu.
- Thêm Xuất Excel theo cột đang hiện cho 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường, 4.1.11 Cập nhật địa danh hành chính, 1.4 Danh sách người dùng, 1.1 Nhóm người dùng (bốn điểm cuối mới, ghi nhật ký xuất).
- Thêm kịch bản CT-451 đến CT-457, tiêu chí AC-495 đến AC-501, quy tắc BR-117. Cơ sở dữ liệu ở máy phát triển không chạy được nên kết quả lấy trên CI của PR 94 ngày 16/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 742/742 ca đạt; toàn bộ kiểm thử giao diện 99/99 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 16b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7 theo yêu cầu của Eric ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống của Sở. Không thêm bảng, quyền; tìm kiếm trên các lưới mới tìm tại chỗ; bảng nhập theo ô và bảng số liệu cố định giữ dạng bảng; xuất 1.4, 1.1 do máy chủ API đọc lại ở dịch vụ định danh bằng mã phiên của người xuất, đường dẫn `/account-exports` để cổng vào không chuyển sang dịch vụ định danh; tệp phân hiệu, điểm trường, nhóm người dùng ghi không có dữ liệu cá nhân; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-119.

- Ngày 2026-10-17 gộp nhánh chính có phần 16d (YCTD-120): Xuất Excel 1.4 dùng `POST /account-directory/export` của phần 16d (đủ cột Mã nhân sự, Mã Bộ, hạn mật khẩu), bỏ `POST /account-exports/users` của phần này và kiểm thử CT-454 (thay bằng CT-466); tệp 1.1 lấy Hiệu lực theo dữ liệu, thêm cột Số người dùng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-119, `07_QUY_TAC_NGHIEP_VU.md` BR-117, `10_YEU_CAU_CHUC_NANG.md` P01-01, P01-06, P01-07, P02-17, `14_DAC_TA_GIAO_DIEN.md` BC-13, BC-15 và các MH ở YCTD-119, `17_DAC_TA_API.md` mục 5, 6, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.69.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa có Xuất PDF trên các lưới (chờ phần 16a gộp); 1.1, 1.4 còn thiếu cột, bộ lọc, thao tác của Sở (phần 16d); các màn hình tài chính dùng bảng danh mục chung chuyển ở phần 15f1.

### 2026-10-16 — DT-15 phần 15h2: văn thư lưu trữ theo hệ thống của Sở

#### Công việc đã thực hiện

- Thêm nhóm menu "5.10. Văn thư lưu trữ" với bốn màn hình: 5.10.1 Hồ sơ tài liệu (hai thẻ Chưa hoàn thành, Hoàn thành trên lưới dữ liệu chung phân trang ở máy chủ, nhãn Quá hạn, Mở rộng tìm kiếm, biểu mẫu theo khối với nút Ghi, Xóa qua hộp xác nhận, tệp đính kèm ở kho tệp, Xuất Excel), 5.10.2 Phông lưu trữ, 5.10.3 Thông tin lưu trữ, 5.10.4 Báo cáo lưu trữ có Xuất Excel. Bốn bảng mới ở cơ sở dữ liệu hệ thống (tệp `0009`), ba quyền mới (tệp định danh `0044`).
- Thêm chức năng P09-06 đến P09-08, kịch bản CT-438 đến CT-450, tiêu chí AC-482 đến AC-494, quy tắc BR-116, quy tắc phân quyền PQ-68, màn hình MH-95 đến MH-98. Kết quả ngày 16/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 738/738 ca đạt; toàn bộ kiểm thử giao diện 99/99 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15h2 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5. Dữ liệu ở cơ sở dữ liệu hệ thống vì không gắn năm học, nhật ký vẫn ghi ở năm học đang dùng; thông tin lưu trữ là màn hình nhập riêng để báo cáo cộng lại; quyền `P09.archive.view`, `P09.archive.manage`, `P09.archive.export` thuộc P09, gán đủ cho VT-02, VT-04, VT-06, xem và xuất cho VT-15, xem cho VT-03; người giải quyết là chữ tự do; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-118.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-118, `07_QUY_TAC_NGHIEP_VU.md` BR-116, `08_VAI_TRO_NGUOI_DUNG.md` PQ-68, `10_YEU_CAU_CHUC_NANG.md` P09-06 đến P09-08, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-95 đến MH-98, `16_CO_SO_DU_LIEU.md` mục 2, 20, `17_DAC_TA_API.md` mục 12, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.68.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Người giải quyết chưa chọn từ danh sách nhân sự; chưa có nhắc hạn; chưa có sổ văn bản đến, đi, biên bản giao nộp, tiêu hủy; hồ sơ chưa phân theo đơn vị.

### 2026-10-16 — Kế hoạch DT-16: bổ sung đủ tính năng theo hệ thống của Sở

#### Công việc đã thực hiện

- Đối chiếu từng dòng của `31_KHAO_SAT_HE_THONG_SO.md` (mục 2 đến 7) với mã nguồn hiện tại: liệt kê màn hình, thẻ, cột, bộ lọc, nút còn thiếu hoặc mới làm một phần.
- Thêm mục 7 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.4): đợt DT-16 gồm 11 phần (16a đến 16k), chia ba lượt.

#### Quyết định

- Eric yêu cầu ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của Sở.
- Eric chọn ngày 2026-10-16: tính năng cần hệ thống bên ngoài (đồng bộ lên CSDL Bộ, Sở; xác thực với CSDLQG về dân cư; ký số; tách trường; gửi lên cấp trên; biến động liên trường; đăng nhập chọn trường) làm bản chạy nội bộ, thay cho dòng "Không áp dụng" của mục 1 tài liệu 32.
- Eric chọn ngày 2026-10-16: phân hệ Tuyển sinh đầu cấp và Hồ sơ điện tử chờ khảo sát bổ sung.

#### Thay đổi

- `32_KE_HOACH_THEO_HE_THONG_SO.md`, `02_NHAT_KY_DU_AN.md`.

#### Vấn đề tồn đọng

- Lượt 1 (16a đến 16d) đang làm; lượt 2, 3 chờ lượt trước gộp.
### 2026-10-15 — DT-15 phần 15h1: cập nhật địa danh hành chính theo hệ thống của Sở

#### Công việc đã thực hiện

- Thêm danh mục địa danh hành chính ở cơ sở dữ liệu hệ thống (đơn vị cũ, đơn vị mới, bảng đối chiếu) và gieo sẵn Thành phố Hồ Chí Minh mới: 168 đơn vị cấp xã, 441 xã cũ của Thành phố Hồ Chí Minh, Bình Dương, Bà Rịa - Vũng Tàu, 493 dòng đối chiếu, lấy từ Nghị quyết 1685/NQ-UBTVQH15 và danh mục của Cục Thống kê (mã theo Quyết định 19/2025/QĐ-TTg).
- Thêm màn hình "4.1.11. Cập nhật địa danh hành chính": lưới địa chỉ học sinh còn theo địa danh cũ ở năm loại địa chỉ, đề xuất địa danh mới, chọn xã mới khi xã cũ chia cho nhiều xã, chuyển hàng loạt có nhật ký trước và sau; bảng đối chiếu, nhập bảng đối chiếu từ Excel.
- Thêm kịch bản CT-421 đến CT-430, tiêu chí AC-465 đến AC-474, quy tắc BR-115, quy tắc phân quyền PQ-67, chức năng P02-17, màn hình MH-94. Kết quả ngày 15/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 725/727 ca đạt, hai ca CTC-DD-041, PQ-10 chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này; tệp mới `administrative-units.test.ts` 8/8 ca đạt; toàn bộ kiểm thử giao diện 96/96 ca đạt (lần chạy trước 95/96, ca hỏng ở `50-facilities-emis.spec.ts` chờ thông báo "Đã lưu phòng", không liên quan, chạy lại đạt); tệp mới `56-administrative-units.spec.ts` 2/2 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15h phần 15h1 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5 (15h2 văn thư lưu trữ làm song song). Danh mục chỉ lấy từ văn bản và danh mục chính thức, phần chưa kiểm chứng (tỉnh khác) để người dùng nhập từ Excel; so khớp tên giữ dấu vì có tên chỉ khác dấu; dùng lại quyền lập, duyệt hồ sơ học sinh và quyền quản lý danh mục, không thêm quyền. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-116, `07_QUY_TAC_NGHIEP_VU.md` BR-115, `08_VAI_TRO_NGUOI_DUNG.md` PQ-67, `10_YEU_CAU_CHUC_NANG.md` P02-17, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-94, `16_CO_SO_DU_LIEU.md` mục P01, `17_DAC_TA_API.md` giao kèo địa danh hành chính, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.66.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chỉ gieo sẵn Thành phố Hồ Chí Minh; chưa đọc trực tiếp phụ lục Quyết định 19/2025/QĐ-TTg; chưa có nhập danh sách học sinh kèm địa chỉ mới từ Excel, xuất Excel lưới địa chỉ, sửa từng dòng đối chiếu; nhập lại tệp CSDL ngành ghi đè địa chỉ đã chuyển.

### 2026-10-15 — DT-15 phần 15d: nhân sự theo hệ thống của Sở

#### Công việc đã thực hiện

- Đổi màn hình hồ sơ nhân sự thành "3.1.1. Hồ sơ cán bộ, giáo viên": lưới dữ liệu chung phân trang ở máy chủ với cột của Sở, xếp A–Z theo tên, Mở rộng tìm kiếm gộp mục 3.1.4 (đơn vị, phòng ban, trạng thái, giới tính, vị trí việc làm, Đảng viên, tuổi từ–đến, mã định danh Bộ, số định danh), Xuất Excel theo cột đang hiện; hồ sơ hai thẻ "Hồ sơ cán bộ, giáo viên" (bảy khối theo thứ tự cột của tệp CSDL ngành, nút Ghi) và "Thông tin riêng của trường"; biểu mẫu Thêm mới theo khối. Ba điểm cuối mới `GET /staff/search`, `POST /staff/export`, `PATCH /staff/{id}/profile`; không có tệp thay đổi cấu trúc dữ liệu, không có quyền mới.
- Thêm kịch bản CT-409 đến CT-420, tiêu chí AC-453 đến AC-464, quy tắc BR-114, quy tắc phân quyền PQ-66; không có màn hình mới (MH-12 đổi). Kết quả ngày 15/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 659/659 ca đạt; toàn bộ kiểm thử giao diện 94/94 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5. Cột của Sở chưa có cột riêng lấy từ `staff.moet_profile` và biểu mẫu ghi lại đúng khóa của tệp CSDL ngành, không thêm cột; thêm cột Mã nhân sự của trường; gộp 3.1.4 vào Mở rộng tìm kiếm của 3.1.1; hợp đồng, lương ở thẻ riêng và chỉ người xem được hợp đồng thấy (BR-46); `GET /staff` giữ nguyên cho các màn hình khác; không làm cập nhật hàng loạt; không thêm quyền mới, Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-112.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-112, `07_QUY_TAC_NGHIEP_VU.md` BR-114, `08_VAI_TRO_NGUOI_DUNG.md` PQ-66, `10_YEU_CAU_CHUC_NANG.md` P07-01, P07-04, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-12, BC-16, `16_CO_SO_DU_LIEU.md` mục `staff`, `17_DAC_TA_API.md` giao kèo hồ sơ nhân sự, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.65.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chưa có Đồng bộ hồ sơ lên CSDL Bộ, Xuất file lỗi, Xóa hồ sơ, Xuất PDF; chưa có bộ lọc xã ĐBKK; chưa tách 3.1.2, 3.1.3, 3.1.5, 3.5; ô theo Sở là chữ tự do, chưa có danh mục của Bộ; nhập lại tệp CSDL ngành ghi đè các ô đã sửa ở biểu mẫu.
### 2026-10-15 — Phân tích kỹ thuật hệ thống của Sở bằng REA

#### Công việc đã thực hiện

- Theo yêu cầu của Eric, Claude dùng REA tải các trang công khai của `truong.hcm.edu.vn` (đăng nhập, quên mật khẩu, đăng nhập năm cũ), không đăng nhập, không thao tác ghi; ghi kết quả vào mục 9 của `31_KHAO_SAT_HE_THONG_SO.md`: nền tảng ASP.NET Web Forms trên IIS 10, Telerik UI for ASP.NET AJAX 2025.1, tường lửa Imperva Incapsula, cách chọn đơn vị nối tầng, mã phường/xã 5 chữ số, bài học áp dụng.
- Eric tự đăng nhập trên Chrome mở cổng gỡ lỗi cục bộ; REA quan sát thụ động trang chủ phân hệ Mầm non: bảng 72 màn hình theo số mục, mã menu, đường dẫn; các phương thức trang gọi bằng JSON (ký số, xem tệp, kiểm tra dữ liệu chưa hợp lệ, xác thực tài khoản); cách đổi nhãn sau sáp nhập bằng thay chữ trên trình duyệt.
- REA quan sát thụ động màn hình 2.1 Hồ sơ lớp học do Eric tự mở: RadGrid 24 cột (10 cột ẩn mặc định), tên trường dữ liệu, phân trang 50 dòng, ô lọc Phân hiệu, Khối, Nhóm tuổi, xuất tệp bằng postback; không ghi dữ liệu trên lưới.

#### Quyết định

- Không ghi tên, mã từng trường vào tài liệu vì kho mã công khai; chỉ ghi số lượng và định dạng mã.

#### Thay đổi

- `31_KHAO_SAT_HE_THONG_SO.md` phiên bản 1.1, thêm mục 9 (9.1 đến 9.10); `index.md` cập nhật mô tả tài liệu 31.

#### Vấn đề tồn đọng

- Chưa quan sát màn hình nhập Excel, tác vụ nền và "Tệp đã tạo"; cột ẩn mặc định và 50 dòng mỗi trang của 2.1 chưa áp dụng vào School Management.

### 2026-10-15 — DT-15 phần 15b: trường học, lớp học theo hệ thống của Sở

#### Công việc đã thực hiện

- Thêm mục "1.2. Quản lý phân hiệu", "1.3. Quản lý điểm trường" (lưới theo cột của Sở, khoảng cách đến cơ sở chính, diện tích, Ngừng sử dụng, Dùng lại); chuyển "2.1. Hồ sơ lớp học" sang lưới dữ liệu chung và biểu mẫu theo khối với nhóm tuổi, nhóm lớp, thứ tự, học 2 buổi/ngày, lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, lớp ghép, lớp bán trú, Mở rộng tìm kiếm, Xuất Excel, "Giải thể lớp"; tách "2.2. Nhập lớp học từ Excel" khỏi màn hình Nhập dữ liệu; thêm "3.3. Phân công phụ trách lớp" lấy từ phân công giáo viên của lớp; tiêu đề 1.1, 1.4 kèm số menu. Cột mới ở cơ sở dữ liệu năm học (tệp 0051), không có quyền mới.
- Thêm kịch bản CT-398 đến CT-408, tiêu chí AC-442 đến AC-452, quy tắc BR-111 đến BR-113, quy tắc phân quyền PQ-65, màn hình MH-90 đến MH-93. Kết quả ngày 15/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 650/650 ca đạt; toàn bộ kiểm thử giao diện 91/91 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5. Phân hiệu, điểm trường là hai danh sách của cây đơn vị (Trường chính vẫn tạo ở Cây đơn vị), Ngừng sử dụng thay Xóa; lớp giải thể là lớp đã đóng; nhóm tuổi bỏ trống là theo bậc học; quy tắc ghép độ tuổi, lớp ghép; phân công phụ trách lớp lấy từ phân công giáo viên của lớp, không thêm bảng; nhập lớp học tách màn hình riêng giữ mẫu cũ; không thêm quyền mới, Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-111.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-111, `07_QUY_TAC_NGHIEP_VU.md` BR-111 đến BR-113, `08_VAI_TRO_NGUOI_DUNG.md` PQ-65, `10_YEU_CAU_CHUC_NANG.md` P01-01, P01-13, P02-05, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-03, MH-32, MH-40, MH-90 đến MH-93, BC-16, `16_CO_SO_DU_LIEU.md` mục 2, 3, `17_DAC_TA_API.md` mục 5, giao kèo lớp học theo Sở, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.64.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5.

#### Vấn đề tồn đọng

- 1.4 Cấu hình trường chưa có ba ô của Sở; 1.2, 1.3 chưa có Xuất Excel, chưa có Xóa; 2.1 chưa có thao tác hàng loạt, Xuất PDF, nhóm tuổi của lớp chưa dùng cho thống kê; mẫu nhập lớp học chưa có các ô mới; 3.3 chưa hiện giáo viên chưa được phân công.

### 2026-10-15 — DT-15 phần 15g: gửi phản hồi, hết hạn mật khẩu

#### Công việc đã thực hiện

- Thêm nút "Gửi phản hồi" ở chân mọi trang của cổng quản trị (hộp thoại theo biểu mẫu của Sở, kèm ảnh chụp màn hình, tối đa 10 ý kiến mỗi giờ mỗi tài khoản); mục "Danh sách ý kiến đã gửi" ở menu người dùng; mục "3.4. Ý kiến phản hồi" của Quản trị hệ thống để VT-01, VT-02 đổi trạng thái, trả lời, người gửi nhận thông báo trong ứng dụng; bảng `feedback` ở cơ sở dữ liệu hệ thống (tệp 0007), quyền mới `P01.feedback.manage`.
- Thêm hết hạn mật khẩu cho tài khoản nhân sự ở dịch vụ định danh: cột `users.password_changed_at`, chính sách số ngày hết hạn và số ngày báo trước (tệp 0042, mặc định tắt), sửa ở khối "Chính sách mật khẩu" của "1.4. Danh sách người dùng"; mật khẩu quá hạn thì bắt buộc đổi ở màn hình Đổi mật khẩu, sắp hết hạn thì đầu trang báo số ngày còn lại; cột ẩn "Thời gian đổi mật khẩu".
- Thêm kịch bản CT-382 đến CT-397, tiêu chí AC-426 đến AC-441, chức năng P01-16, P01-17, quy tắc BR-108 đến BR-110, quy tắc phân quyền PQ-64, màn hình MH-87 đến MH-89, biện pháp BM-72, XT-10. Kiểm thử đơn vị máy chủ API 642/643 ca đạt, dịch vụ định danh 45/46 ca đạt (hai ca CTC-DD-041, PQ-10 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này; ca PQ-10 đã sửa vì VT-01 nay có thêm `P01.feedback.manage`); toàn bộ kiểm thử giao diện 87/87 ca đạt ngày 15/10/2026.

#### Quyết định

- Thực hiện lựa chọn 4 của Eric ngày 13/10/2026 (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, 4, 5 đợt 15g): biểu mẫu Gửi phản hồi ở chân trang; hết hạn mật khẩu và bắt buộc đổi định kỳ. Các ô của biểu mẫu (thêm ảnh đính kèm, số điện thoại, thư điện tử), người xử lý ý kiến là VT-01, VT-02, giới hạn 10 ý kiến mỗi giờ, chỉ áp hết hạn mật khẩu cho tài khoản nhân sự, đặt chính sách ở Danh sách người dùng theo quyền `P01.account.manage` (không ở màn hình Cấu hình vì VT-01 không có `P01.setting.manage`), mặc định tắt Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-110.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-110, `07_QUY_TAC_NGHIEP_VU.md` BR-108 đến BR-110, `08_VAI_TRO_NGUOI_DUNG.md` PQ-10, PQ-64, `10_YEU_CAU_CHUC_NANG.md` P01-16, P01-17, `12_KIEN_TRUC_HE_THONG.md` XT-10, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-30, MH-48, MH-83, MH-84, MH-87 đến MH-89, `16_CO_SO_DU_LIEU.md` mục 1, 2 và 20, `17_DAC_TA_API.md` mục 4, 5, `22_BAO_MAT.md` BM-72, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.63.0.

#### Vấn đề tồn đọng

- Thông báo trả lời ý kiến cần năm học đang dùng; chưa gửi thư điện tử, tin nhắn; ý kiến chưa gửi về đơn vị hỗ trợ bên ngoài; đổi trạng thái, trả lời chưa ghi nhật ký thao tác; hai màn hình ý kiến phân trang ở trình duyệt.
- Ứng dụng giáo viên chưa hiện dòng "Mật khẩu đã hết hạn" và chưa báo sắp hết hạn; chưa chặn dùng lại mật khẩu cũ hơn mật khẩu hiện tại; chưa có bộ lọc Ngày hết hạn mật khẩu ở Danh sách người dùng; báo sắp hết hạn chưa là hộp thông báo bật lên như của Sở.

### 2026-10-15 — DT-15 phần 15e: quản trị hệ thống theo hệ thống của Sở

#### Công việc đã thực hiện

- Đưa phân hệ Quản trị hệ thống của cổng quản trị theo Sở: "1.1. Nhóm người dùng" trên lưới dữ liệu chung, biểu mẫu thêm nhóm theo khối; mục mới "1.3. Phân quyền nhóm theo menu" chọn quyền theo cây menu đánh số; "1.4. Danh sách người dùng" với cột, bộ lọc theo Sở; Khóa API cho đối tác và Nhật ký thao tác trên lưới dữ liệu chung; tiêu đề các màn hình quản trị kèm số menu; điều kiện hiện mục menu chuyển sang gói dùng chung `packages/shared/src/menu-permissions.ts`; dịch vụ định danh lọc, đếm, phân trang danh sách người dùng trong câu truy vấn, tệp chuyển đổi 0041 thêm hai chỉ mục của cơ sở dữ liệu định danh.
- Thêm kịch bản CT-368 đến CT-381, tiêu chí AC-412 đến AC-425, màn hình MH-86. Kiểm thử đơn vị máy chủ API 631/632 ca đạt, dịch vụ định danh 40/41 ca đạt (hai ca CTC-DD-041, PQ-10 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này); toàn bộ kiểm thử giao diện 84/84 ca đạt ngày 15/10/2026.

#### Quyết định

- Thực hiện lựa chọn 3 của Eric ngày 13/10/2026 (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, 3.2, 5 đợt 15e): giữ mã quyền theo thao tác, màn hình phân quyền hiển thị theo cây menu. Cách suy ra quyền của mục và quyền ở cổng (quyền ở cổng không tính là quyền của mục), cột Hiệu lực, Là nhóm quản trị, cột và bộ lọc của danh sách người dùng, việc chỉ đổi tiêu đề ở các màn hình quản trị không phải danh sách thuần Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-109.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-109, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-30, MH-31, MH-42, MH-86, `08_VAI_TRO_NGUOI_DUNG.md` PQ-13, `16_CO_SO_DU_LIEU.md` mục 2 và 20, `17_DAC_TA_API.md` mục 3, 5, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.62.0.

#### Vấn đề tồn đọng

- Chưa có cột Mã nhân sự, Mã Bộ, Thời gian đổi mật khẩu, Ngày hết hạn mật khẩu và bộ lọc Mã định danh, Ngày hết hạn mật khẩu của Sở (hết hạn mật khẩu làm ở phần 15g); chưa có Phân nhóm quyền hàng loạt, Cấp mật khẩu hàng loạt, Lấy danh sách CBQL/GV, Xuất Excel ở 1.4.
- Chưa có 1.2 Phân quyền nhóm theo phần mềm của Sở; chưa sửa, xóa, ngừng dùng nhóm người dùng (không có điểm cuối).
- Năm học, Cây đơn vị, Phòng ban và chức danh, Danh mục dùng chung, Phòng học và bậc học, Hạn mức phê duyệt, Kết nối ngoài chỉ đổi tiêu đề, chưa chuyển sang lưới dữ liệu chung; tìm theo từ khóa ở danh sách người dùng cần chỉ mục trigram khi nhiều hơn khoảng 30 nghìn tài khoản.

### 2026-10-15 — DT-15 phần 15c: học sinh theo hệ thống của Sở

#### Công việc đã thực hiện

- Đưa nhóm "4. Học sinh" của cổng quản trị theo Sở: màn hình "4.1.1. Quản lý hồ sơ học sinh" dùng lưới dữ liệu chung (cột, bộ lọc theo Sở, thứ tự A–Z theo tên, Xuất Excel theo cột đang hiện, cập nhật hàng loạt học 2 buổi/ngày và bán trú); hồ sơ học sinh hai thẻ theo khối của Sở và "Thông tin riêng của trường"; điện thoại nhận tin và chọn người nhận tin nhắn theo học sinh; mục mới "4.2. Biến động học sinh"; đổi chữ "trẻ" thành "học sinh" trên các màn hình học sinh; khối biểu mẫu dùng chung `FormBlock`, `FormRow`; tệp chuyển đổi 0050 của cơ sở dữ liệu năm học.
- Thêm kịch bản CT-354 đến CT-367, tiêu chí AC-398 đến AC-411, chức năng P02-15, P02-16, quy tắc BR-105 đến BR-107, màn hình MH-85. Kiểm thử đơn vị máy chủ API 622/623 ca đạt, dịch vụ định danh 40/41 ca đạt (hai ca CTC-DD-041, PQ-10 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này); toàn bộ kiểm thử giao diện 78/80 ca đạt, hai ca CT-365, CT-366 của `tests/e2e/51-students-so.spec.ts` hỏng do bộ chọn ô đánh dấu trong hộp cấu hình cột khớp nhiều phần tử, đã sửa và chạy lại tệp 3/3 ca đạt ngày 15/10/2026.

#### Quyết định

- Eric chọn ngày 13/10/2026 đồng bộ nhóm học sinh theo Sở và dùng chữ "học sinh" thay "trẻ" trên cổng quản trị (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 1, 5 đợt 15c); cột, bộ lọc, thứ tự A–Z, cách lưu điện thoại nhận tin, cập nhật hàng loạt và biến động học sinh dựng từ lịch sử đã có Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-108.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-108, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-02, MH-85 và BC-16, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.61.0.

#### Vấn đề tồn đọng

- Chưa có chuyển đến, chuyển đi giữa các trường ở mục 4.2 của Sở; chưa ghi số thứ tự cố định trong lớp; điện thoại nhận tin chưa nhập từ Excel; dân tộc, diện chính sách, khuyết tật, biết bơi chưa sửa được trên hồ sơ; chưa có Xuất PDF, Xuất file lỗi, Cấp mã định danh Bộ; thông báo lỗi của máy chủ API vẫn dùng chữ "trẻ".

### 2026-10-14 — DT-15 phần 15a: menu ngang đánh số, menu người dùng, lưới dữ liệu dùng chung

#### Công việc đã thực hiện

- Thay thanh điều hướng bên trái của cổng quản trị bằng menu ngang nhiều cấp đánh số theo phân hệ (mười một phân hệ, 66 trang), dùng được bằng chuột và bàn phím, cây menu gập trên màn hình hẹp; menu người dùng ở thanh đầu trang; lưới dữ liệu dùng chung, hộp cấu hình cột, hộp xác nhận xóa; cấu hình lưới lưu theo tài khoản ở cơ sở dữ liệu hệ thống; thí điểm lưới ở Tài khoản và Hồ sơ nhân sự; kiểm thử giao diện mở trang qua trợ giúp `tests/e2e/menu.ts`.
- Thêm kịch bản CT-340 đến CT-353. Kiểm thử đơn vị toàn bộ 667 ca, 665 đạt (hai ca PQ-10, CTC-DD-041 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu định danh dùng chung, không liên quan phần này); kiểm thử giao diện 77/77 đạt ngày 14/10/2026.

#### Quyết định

- Eric chọn menu ngang đánh số thay thanh điều hướng bên trái ngày 13/10/2026 (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, lựa chọn 1); cây menu, menu người dùng, lưới dữ liệu và bỏ lựa chọn "Tất cả chức năng" Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-107.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-107, `14_DAC_TA_GIAO_DIEN.md` mục 1.1 và BC-10 đến BC-15, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.60.0.

#### Vấn đề tồn đọng

- Menu người dùng chưa có Hồ sơ cá nhân, Danh sách ý kiến đã gửi, Hướng dẫn; các màn hình khác chuyển sang lưới ở phần 15f; nút Xuất Excel, Xuất PDF và thao tác hàng loạt của lưới chưa làm; danh sách tài khoản ở dịch vụ định danh vẫn đọc hết rồi cắt trang.

### 2026-10-14 — DT-14 phần 14d: hồ sơ trường, khai báo cơ sở vật chất, thiết bị dạy học, biểu EMIS đầu năm

#### Công việc đã thực hiện

- Hồ sơ trường sáu thẻ gắn với Trường chính; khai báo cơ sở vật chất trên danh mục phòng học (khối, loại, hiện trạng, diện tích, thuộc tính) kèm bảng tổng hợp; danh mục thiết bị dạy học tối thiểu gieo sẵn và thiết bị ngoài danh mục, số lượng hiện có theo đơn vị, lớp, tổng hợp theo định mức; báo cáo EMIS đầu năm Biểu 1 năm thẻ; xuất Excel kèm nhật ký xuất; chuyển hồ sơ, danh mục thiết bị, số hiện có khi mở năm học mới.
- Thêm kịch bản CT-330 đến CT-339.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026 (YCTD-102); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-106.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-106 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.59.0.

#### Vấn đề tồn đọng

- Danh mục thiết bị tối thiểu gieo sẵn và mã số chỉ tiêu EMIS cần đối chiếu văn bản; chưa gửi báo cáo EMIS lên Sở; chưa có thẻ Ngân sách nhà nước, biểu cuối năm; gắn tài sản với thiết bị chưa có trên màn hình Kho và tài sản.

### 2026-10-14 — DT-14 phần 14a: cân nặng, chiều cao theo chuẩn WHO, thống kê theo tiêu chí ngành, hồ sơ chưa nhập đủ

#### Công việc đã thực hiện

- Đợt cân đo, nhập cân nặng, chiều cao theo lớp và từ Excel, chỉ số Z và kênh tăng trưởng theo chuẩn WHO, biểu đồ tăng trưởng, tổng hợp cân nặng, chiều cao kèm xuất Excel; thống kê lớp học, học sinh, nhân sự theo tiêu chí ngành; hồ sơ học sinh, nhân sự chưa nhập đủ.
- Thêm kịch bản CT-320 đến CT-329.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026 (YCTD-102); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-105.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-105 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.58.0.

#### Vấn đề tồn đọng

- Dân tộc, khuyết tật, trình độ và các trường tương tự chưa có cột riêng, đọc từ hồ sơ CSDL ngành đã nhập; chưa có thông báo phụ huynh khi có kết quả cân đo, chưa tổng hợp theo học kỳ.

### 2026-10-13 — DT-14 phần 14c: hoàn thành chương trình mầm non, chuẩn nghề nghiệp, nhóm học sinh

#### Công việc đã thực hiện

- Hoàn thành chương trình mầm non theo lớp 5-6 tuổi, nhóm học sinh, đánh giá chuẩn nghề nghiệp giáo viên và hiệu trưởng.
- Thêm kịch bản CT-310 đến CT-319.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026 (YCTD-102); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-104.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-104 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.57.0.

#### Vấn đề tồn đọng

- Đối chiếu tên tiêu chí và quy tắc xếp loại với Thông tư 25, 26/2018/TT-BGDĐT; chưa có nhập mức đánh giá từ Excel.

### 2026-10-13 — DT-14 phần 14b: năm học ở thanh đầu trang và Truy cập nhanh trên trang chủ

#### Công việc đã thực hiện

- Ô năm học và học kỳ ở thanh đầu trang; vùng Truy cập nhanh trên trang chủ, lưu lối tắt theo tài khoản.
- Thêm kịch bản CT-300 đến CT-309.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026; các điểm kỹ thuật Claude tự chọn ghi ở YCTD-102.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-102 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.56.0.

#### Vấn đề tồn đọng

- Xem năm học đã đóng cần máy chủ API đọc được cơ sở dữ liệu năm học cũ ở chế độ chỉ xem.
### 2026-10-13 — Khảo sát hệ thống thông tin quản lý giáo dục của Sở

#### Công việc đã thực hiện

- Eric đăng nhập hệ thống của Sở GD&ĐT TP.HCM; Claude đọc giao diện 6 phân hệ, 98 màn hình, không thay đổi dữ liệu, không ghi dữ liệu cá nhân; viết `31_KHAO_SAT_HE_THONG_SO.md`.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng (đợt DT-14, YCTD-102); các đề xuất còn lại ở mục 8.3 của tài liệu khảo sát chờ Eric chọn.

#### Thay đổi

- Thêm `31_KHAO_SAT_HE_THONG_SO.md`.

#### Vấn đề tồn đọng

- Chưa xem được phân hệ Tuyển sinh đầu cấp (chỉ mở ở học kỳ II năm 2025-2026) và nội dung chỉ tiêu các biểu EMIS.

### 2026-10-13 — DT-13 phần 13c: báo cáo điểm danh và suất ăn theo ngày, tuần, tháng

#### Công việc đã thực hiện

- Báo cáo điểm danh và suất ăn theo ngày, tuần, tháng trên màn hình và Excel theo mẫu của trường; suất ăn theo lớp cho bếp.
- Thêm kịch bản CT-289 đến CT-299.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-103.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-103 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.55.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-13 phần 13a: nhập thẳng tệp học sinh, cán bộ theo mẫu CSDL ngành

#### Công việc đã thực hiện

- Nhập thẳng tệp học sinh, cán bộ theo mẫu CSDL ngành (.xls, .xlsx), lưu đủ 82 và 75 cột; chạy thử với tệp mẫu thật của trường trên cơ sở dữ liệu tạm.
- Thêm kịch bản CT-275 đến CT-288.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-100.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-100 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.54.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — Menu sổ xuống chọn phân hệ

#### Công việc đã thực hiện

- Thêm menu sổ xuống chọn phân hệ ở thanh đầu trang theo ảnh mẫu của Eric; kiểm thử giao diện 65/65 đạt.

#### Quyết định

- Eric yêu cầu ngày 2026-10-13; cách gom phân hệ Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 (YCTD-101).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-101.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-13 — Giao diện tông xanh, ẩn hiện thanh điều hướng

#### Công việc đã thực hiện

- Đổi bảng màu sang tông xanh theo ảnh mẫu của Eric; thanh đầu trang xanh có nút ẩn hoặc hiện thanh điều hướng; nhóm chức năng thu gọn được, trình duyệt nhớ lựa chọn.
- Kiểm thử giao diện 64/64 đạt.

#### Quyết định

- Eric yêu cầu ngày 2026-10-13; cách trình bày Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 (YCTD-99).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-99, `15_HE_THONG_THIET_KE.md` mục 2 và KC-08.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-13 — Ma trận quyền chọn nhanh, chuông thông báo, dữ liệu mẫu

#### Công việc đã thực hiện

- Ma trận quyền chọn nhanh theo nhóm, tên nhóm gồm mã và tên phân hệ; sửa lỗi báo nhầm mất kết nối ở Cây đơn vị (YCTD-96, yêu cầu gộp số 67).
- Chuông thông báo ở đầu trang cổng quản trị (YCTD-97).
- Chẩn đoán "chức năng chưa hoạt động" trên máy của Eric: cơ sở dữ liệu phát triển chưa có năm học đang dùng và tài khoản VT-01 chỉ có quyền quản lý tài khoản (PQ-10); dựng dữ liệu mẫu `pnpm demo:seed`.

#### Quyết định

- Eric yêu cầu hai thay đổi giao diện; cách trình bày Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-96, YCTD-97.

#### Vấn đề tồn đọng

- Cấp toàn quyền cho VT-01 trong mã nguồn chưa làm: Eric tự cấp trên ma trận quyền ở máy phát triển.
### 2026-10-13 — DT-12 phần 12d: cấu hình triển khai môi trường chạy thật

#### Công việc đã thực hiện

- Viết cấu hình triển khai Docker Compose, ảnh, Caddy, sao lưu và khôi phục, hướng dẫn triển khai; dựng thử, sao lưu và khôi phục thử trên máy cục bộ.
- Thêm kịch bản CT-269 đến CT-274.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-98.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-98 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.53.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-12 phần 12c: Fanpage và Zalo Official Account chạy thật

#### Công việc đã thực hiện

- Nâng kết nối Fanpage lên Graph API v21.0, thêm kho khóa và làm mới khóa Zalo tự động, nút kiểm tra kết nối trên MH-71.
- Thêm kịch bản CT-261 đến CT-268.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-95.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-95 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.52.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-12 phần 12b: cổng thanh toán PayOS, SePay, Casso, VNPay

#### Công việc đã thực hiện

- Viết bốn cổng thanh toán PayOS, SePay, Casso, VNPay và điểm cuối nhận thông báo; nút thanh toán VNPay trên ứng dụng phụ huynh.
- Thêm kịch bản CT-250 đến CT-260.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-94.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-94 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.51.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-12 phần 12a: nối nhà cung cấp tin nhắn eSMS.vn

#### Công việc đã thực hiện

- Viết `EsmsClient` và lớp gửi eSMS.vn cho dịch vụ định danh, máy chủ API; đọc cấu hình từ biến môi trường.
- Thêm kịch bản CT-236 đến CT-249.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-93.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-93 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.50.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — Nghiệm thu ba bản phát hành, chọn nhà cung cấp, lập đợt DT-12

#### Công việc đã thực hiện

- Gắn thẻ `v1.0.0`, `v1.1.0`, `v1.2.0` và tạo bản phát hành trên GitHub.
- Cập nhật bảng tiến độ phân hệ trong `03_DANH_SACH_CONG_VIEC.md` (yêu cầu gộp số 64).
- Lập đợt DT-12 bốn phần 12a đến 12d.

#### Quyết định

- Eric nghiệm thu ba bản; G3-04 chưa làm; chọn eSMS.vn, PayOS, SePay, Casso, VNPay; nối Fanpage và Zalo thật; Claude chuẩn bị cấu hình triển khai (YCTD-92).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-92 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.49.0.

#### Vấn đề tồn đọng

- Eric thuê máy chủ đám mây, cấp khóa của nhà cung cấp; triển khai, kiểm thử hiệu năng và phục hồi, xác nhận sau triển khai (việc T6, cổng CG-11).

### 2026-10-11 — DT-11: báo cáo kiểm thử giai đoạn 3, bản ứng viên 1.2.0

#### Công việc đã thực hiện

- Gộp năm phần 11a đến 11e vào `main` (yêu cầu gộp số 58 đến 62), quyền và kế hoạch ở yêu cầu gộp số 56, 57.
- Viết `30_BAO_CAO_KIEM_THU_G3.md`.
- Kết quả: máy chủ API 518/518, kiểm thử giao diện 62/62; kịch bản CT 224/235 đạt, ca chi tiết CTC 443/453 đạt.

#### Quyết định

- Claude tự chọn các điểm của YCTD-91 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-91 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.48.0.

#### Vấn đề tồn đọng

- Eric nghiệm thu ba bản ứng viên 1.0.0, 1.1.0, 1.2.0; quyết định G3-04; việc T1, T4, T6, T7.

### 2026-10-11 — DT-11 phần 11c: sổ kế toán kép

#### Công việc đã thực hiện

- Agent 11c viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11d (đã gồm 11a, 11b, 11e), thêm chức năng P06-12 và quy tắc BR-96, đánh số bảy kịch bản mới CT-229 đến CT-235 kèm AC-273 đến AC-279, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: bốn bảng (tệp 0042). Máy chủ API: hệ thống tài khoản, quy tắc ghi sổ theo loại chứng từ và khoản mục, ghi sổ tự động một lần cho mỗi chứng từ (phiếu thu, phiếu chi, phiếu đảo, hóa đơn, miễn giảm, điều chỉnh, bảng lương, quyết toán), bút toán thủ công cân, nhật ký chung, sổ cái, bảng cân đối số phát sinh, xuất Excel; bước chuyển năm học `ledger` kết chuyển số dư đầu kỳ.
- Cổng quản trị: trang Sổ kế toán.
- Kết quả: máy chủ API 518/518, kiểm thử giao diện 62/62.

#### Quyết định

- Claude tự chọn các điểm của YCTD-88 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-88 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.47.0.

#### Vấn đề tồn đọng

- Báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11d: nhập sao kê và đối soát

#### Công việc đã thực hiện

- Agent 11d viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11a (đã gồm 11b, 11e), đánh số bảy kịch bản mới CT-222 đến CT-228 kèm AC-266 đến AC-272, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tệp 0043. Máy chủ API: cấu hình cột sao kê theo tài khoản, nhập tệp xlsx và CSV bỏ dòng trùng, đối soát tự động theo mã chứng từ và khoảng ngày, đề xuất lập phiếu thu cho dòng có mã hóa đơn còn nợ (kế toán xác nhận), nhiều cổng thanh toán theo tài khoản (giả lập, VietQR tĩnh).
- Cổng quản trị: phần Nhập tệp sao kê ở trang Đối chiếu ngân hàng, chọn cổng thanh toán ở trang Quỹ và ngân hàng.
- Kết quả: máy chủ API 511/511, kiểm thử giao diện 61/61.

#### Quyết định

- Claude tự chọn các điểm của YCTD-89 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-89 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.46.0.

#### Vấn đề tồn đọng

- Gộp phần 11c; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11a: tuyển sinh trực tuyến

#### Công việc đã thực hiện

- Agent 11a viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11b (đã gồm 11e), đổi tên bộ giới hạn số lần gọi của tuyển sinh để không trùng tuyển dụng, đặt cả hai trang công khai trên màn hình đăng nhập phụ huynh, đánh số sáu kịch bản mới CT-216 đến CT-221 kèm AC-260 đến AC-265, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: ba bảng (tệp 0040). Máy chủ API: đợt tuyển sinh có chỉ tiêu, tin tuyển sinh, nộp và tra cứu hồ sơ TS-000001 không cần tài khoản có giới hạn số lần, tiếp nhận, xét đạt theo chỉ tiêu hoặc không đạt kèm lý do, chuyển hồ sơ đạt thành hồ sơ trẻ dùng lại quy trình hồ sơ trẻ (QT-01); bước chuyển năm học `admissions`.
- Cổng quản trị: trang Tuyển sinh. Ứng dụng phụ huynh: trang Tuyển sinh trực tuyến công khai.
- Kết quả: máy chủ API 504/504, kiểm thử giao diện 60/60.

#### Quyết định

- Claude tự chọn các điểm của YCTD-86 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-86 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.45.0.

#### Vấn đề tồn đọng

- Gộp các phần 11c, 11d; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11b: tuyển dụng

#### Công việc đã thực hiện

- Agent 11b viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11e, đánh số tám kịch bản mới CT-208 đến CT-215 kèm AC-252 đến AC-259, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: bốn bảng (tệp 0041). Máy chủ API: đề nghị tuyển dụng DNTD-000001 duyệt bởi Ban Giám hiệu, tin tuyển dụng công khai đến hết hạn, nộp hồ sơ không cần tài khoản có giới hạn số lần, hồ sơ ứng viên có ghi nhật ký truy cập dữ liệu cá nhân, phỏng vấn nhiều vòng, quyết định tuyển, tạo hồ sơ nhân sự; bước chuyển năm học `recruitment`.
- Cổng quản trị: trang Tuyển dụng. Ứng dụng phụ huynh: trang Tuyển dụng giáo viên và nhân viên công khai.
- Kết quả: máy chủ API 494/494, kiểm thử giao diện 59/59.

#### Quyết định

- Claude tự chọn các điểm của YCTD-87 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-87 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.44.0.

#### Vấn đề tồn đọng

- Gộp các phần 11a, 11c, 11d; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11e: kết nối Facebook và Zalo

#### Công việc đã thực hiện

- Agent 11e viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp `main`, đánh số sáu kịch bản mới CT-202 đến CT-207 kèm AC-246 đến AC-251, sửa KT-09 tính chung tin Zalo, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tệp 0044. Máy chủ API: cấu hình kết nối ngoài (khóa chỉ ở biến môi trường), đăng hoạt động và tin tức đã công bố lên Fanpage kèm loại ảnh theo đồng ý hình ảnh, thử lại khi lỗi; kênh Zalo cho thông báo và nhắc nợ, gửi tin nhắn thay khi chưa liên kết hoặc lỗi; bước chuyển năm học `integrations`.
- Cổng quản trị: trang Kết nối ngoài (MH-71), nút Đăng lên Fanpage ở trang Hoạt động và tin tức.
- Kết quả: máy chủ API 486/486, kiểm thử giao diện 58/58.

#### Quyết định

- Claude tự chọn các điểm của YCTD-90 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-90 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.43.0.

#### Vấn đề tồn đọng

- Gộp các phần 11a đến 11d; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-10: báo cáo kiểm thử giai đoạn 2, bản ứng viên 1.1.0

#### Công việc đã thực hiện

- Gộp mười phần 10a đến 10j vào `main` (yêu cầu gộp số 43, 45, 46, 48 đến 54); từ phần 10b làm song song ba phần một lượt bằng các agent, người điều phối gộp nối tiếp và chạy toàn bộ kiểm thử trước mỗi yêu cầu gộp.
- Bổ sung ca kiểm thử cho CT-041, CT-083, CT-085; đánh dấu CTC-P06-049 đạt.
- Viết `29_BAO_CAO_KIEM_THU_G2.md`.
- Kết quả: máy chủ API 480/480, kiểm thử giao diện 57/57; kịch bản CT 187/201 đạt, ca chi tiết CTC 443/453 đạt.

#### Quyết định

- Claude tự chọn các điểm của YCTD-84 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-84 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.42.0.

#### Vấn đề tồn đọng

- Eric nghiệm thu bản ứng viên 1.0.0 (0.31.0) và 1.1.0 (0.42.0); việc T1, T6; đợt DT-11 giai đoạn 3.

### 2026-10-11 — DT-10 phần 10i: tài chính giai đoạn 2

#### Công việc đã thực hiện

- Agent 10i viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 3, dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 10h (đã gồm 10b đến 10j), nối công nợ phải trả với phiếu đi chợ của bếp (thêm ca kiểm thử), đánh số màn hình MH-61, MH-62 và quy tắc mới BR-95 (thay mã lỗi tạm P06-09), chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: năm bảng (tệp 0038). Máy chủ API: nhắc nợ theo mốc, đề xuất và quyết định xử lý công nợ quá hạn, dòng sao kê và đối chiếu ngân hàng, công nợ phải trả từ phiếu mua hàng, phiếu mua thuốc, phiếu đi chợ hoặc lập tay, chốt kỳ tài chính và khóa số liệu kỳ đã chốt trên phiếu thu, phiếu chi, phiếu đảo, tính học phí, miễn giảm, điều chỉnh.
- Cổng quản trị: trang Nhắc nợ và xử lý quá hạn, Đối chiếu ngân hàng, Nợ nhà cung cấp, Chốt kỳ tài chính.
- Kết quả: máy chủ API 480/480, kiểm thử giao diện 57/57.

#### Quyết định

- Claude tự chọn các điểm của YCTD-82 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-82 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.41.0.

#### Vấn đề tồn đọng

- Kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10h: công việc và đánh giá

#### Công việc đã thực hiện

- Agent 10h viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 3, dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 10j (đã gồm 10b đến 10g), thêm bảng công việc được giao vào báo cáo hoạt động và công việc, đánh số màn hình MH-58 đến MH-60 và bảy kịch bản mới CT-195 đến CT-201 kèm AC-239 đến AC-245, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười bảng (tệp 0037). Máy chủ API: giao việc, việc cá nhân, tiến độ, kế hoạch kích hoạt thành việc, chỉ số và phiếu đánh giá, quá trình công tác và chứng chỉ, thưởng và khấu trừ đưa vào phiếu lương; bước chuyển năm học `work`.
- Cổng quản trị: trang Công việc và kế hoạch, Đánh giá nhân sự, Thưởng và khấu trừ, mục Quá trình công tác trong hồ sơ nhân sự. Ứng dụng giáo viên: Công việc của tôi.
- Kết quả: máy chủ API 474/474, kiểm thử giao diện 56/56.

#### Quyết định

- Claude tự chọn các điểm của YCTD-81 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-81 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.40.0.

#### Vấn đề tồn đọng

- Gộp phần 10i; kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10j: báo cáo giai đoạn 2

#### Công việc đã thực hiện

- Agent 10j viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 3); người điều phối gộp nhánh 10g (đã gồm 10b đến 10f), thêm bảng hoạt động của lớp vào báo cáo hoạt động và công việc qua giao diện nguồn số liệu, đánh số sáu kịch bản mới CT-189 đến CT-194 kèm AC-233 đến AC-238, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: bảng `export_logs` (tệp 0039). Máy chủ API: báo cáo hoạt động và công việc theo nguồn số liệu gắn thêm được, báo cáo hợp nhất theo đơn vị không có dữ liệu cá nhân, xuất Excel bảy báo cáo có nhật ký xuất.
- Cổng quản trị: trang Báo cáo thêm ba thẻ và nút xuất Excel.
- Kết quả: máy chủ API 466/466, kiểm thử giao diện 55/55.

#### Quyết định

- Claude tự chọn các điểm của YCTD-83 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-83 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.39.0.

#### Vấn đề tồn đọng

- Gộp phần 10h (thêm bảng công việc vào báo cáo hoạt động) và 10i; kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10g: giảng dạy

#### Công việc đã thực hiện

- Agent 10g viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 2); người điều phối gộp các nhánh 10b đến 10f, dựng lại các tệp giao diện dùng chung từ bản của 10f cộng phần thay đổi của 10g, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười bảng (tệp 0036). Máy chủ API: lĩnh vực, nhóm bài học, chủ đề, bài học dùng chung hoặc riêng, giáo án duyệt hai bước (tổ trưởng rồi quản lý đơn vị), thời khóa biểu theo phiên bản tuần, kế hoạch giảng dạy, tiến độ học tập theo kỳ, lịch hoạt động lớp, trang học tập của con; bước chuyển năm học `teaching`.
- Cổng quản trị: trang Bài học và giáo án (MH-57). Ứng dụng giáo viên: Giảng dạy lớp. Ứng dụng phụ huynh: Học tập.
- Sửa thêm: kiểm thử giao diện bếp chờ lưu món xong rồi mới trình duyệt; xóa cơ sở dữ liệu thử lại khi gặp tiến trình nền của PostgreSQL không kết thúc được (mã 42501), lỗi dọn dẹp thỉnh thoảng gặp khi chạy kiểm thử.
- Kết quả: máy chủ API 458/458, kiểm thử giao diện 54/54.

#### Quyết định

- Claude tự chọn các điểm của YCTD-80 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-80 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.38.0.

#### Vấn đề tồn đọng

- Lượt 3 (10h, 10i, 10j); kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10f: tương tác và đồ bị mất

#### Công việc đã thực hiện

- Agent 10f viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 2); người điều phối gộp các nhánh 10b, 10c, 10d, 10e, xử lý xung đột ở các tệp đăng ký dùng chung, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Bình luận: giữ hai bảng riêng, `content_comments` của 10e cho nội dung P14 (hoạt động, tin tức, thư viện, album) và `interaction_comments` của 10f cho đối tượng P15 (bình chọn); đổi tên kiểu và lớp của phần tương tác (`InteractionCommentTargetType`, `InteractionCommentsService`) để không trùng tên. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: gộp một bảng chung cần sửa lớn cả hai phần mà không thêm giá trị cho người dùng.
- Cơ sở dữ liệu: mười ba bảng (tệp 0035). Máy chủ API: luồng trao đổi theo trẻ và tài khoản phụ huynh, góp ý ẩn danh, bình chọn, biểu quyết, khảo sát và danh mục khảo sát, bình luận có bản ghi xử lý, lượt thích, phiếu đồ bị mất `DBM-000001`; bước chuyển năm học `interactions`.
- Cổng quản trị: trang Tương tác với phụ huynh. Ứng dụng giáo viên: trao đổi và đồ bị mất của lớp. Ứng dụng phụ huynh: trao đổi, góp ý, bình chọn, mất đồ.
- Kết quả: máy chủ API 452/452, kiểm thử giao diện 53/53.

#### Quyết định

- Claude tự chọn các điểm của YCTD-79 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-79 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.37.0.

#### Vấn đề tồn đọng

- Gộp phần 10g; lượt 3 (10h, 10i, 10j).

### 2026-10-11 — DT-10 phần 10e: hoạt động và nội dung

#### Công việc đã thực hiện

- Agent 10e viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 2, dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp các nhánh 10b, 10c, 10d, xử lý xung đột ở các tệp đăng ký dùng chung và kiểu `FilePurpose`, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tệp 0034. Máy chủ API: danh mục hoạt động, hoạt động trình duyệt và công bố, ảnh gắn thẻ trẻ theo đồng ý hình ảnh, tin tức, thư viện, album, hình tô màu, bình luận và thích, ngoại khóa có chỉ tiêu và phí đưa vào hóa đơn; bước chuyển năm học `activities`.
- Cổng quản trị: trang Hoạt động và tin tức. Ứng dụng giáo viên: hoạt động lớp. Ứng dụng phụ huynh: hoạt động và tin tức.
- Kết quả: máy chủ API 443/443, kiểm thử giao diện 52/52.

#### Quyết định

- Claude tự chọn các điểm của YCTD-78 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-78 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.36.0.

#### Vấn đề tồn đọng

- Gộp phần 10f, 10g; lượt 3 (10h, 10i, 10j) đang làm.

### 2026-10-11 — DT-10 phần 10c: bếp và thực đơn

#### Công việc đã thực hiện

- Agent 10c viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng; người điều phối gộp `main` cùng các nhánh 10b, 10d, xử lý xung đột ở các tệp đăng ký dùng chung, sửa kiểm thử giao diện chọn món, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười một bảng bếp (tệp 0032). Máy chủ API: nguyên liệu, món ăn, định lượng, thực đơn tuần trình duyệt và công bố, suất ăn theo ngày, báo cơm, buffet, nhà cung cấp thực phẩm, phiếu đi chợ chờ thanh toán, báo cáo ăn và bếp; bước chuyển năm học `kitchen`.
- Cổng quản trị: trang Bếp và thực đơn. Ứng dụng giáo viên: báo cơm của lớp. Ứng dụng phụ huynh: thực đơn.
- Kết quả: máy chủ API 431/431, kiểm thử giao diện 51/51.

#### Quyết định

- Claude tự chọn các điểm của YCTD-76 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-76 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.35.0.

#### Vấn đề tồn đọng

- Gộp lượt 2 (10e, 10f, 10g); các phần 10h đến 10j.

### 2026-10-11 — DT-10 phần 10b: thuốc

#### Công việc đã thực hiện

- Agent 10b viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng; người điều phối gộp `main` và nhánh 10d, xử lý xung đột ở các tệp đăng ký dùng chung, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tám bảng thuốc (tệp 0031). Máy chủ API: danh mục thuốc, nhà thuốc, yêu cầu dặn thuốc kèm ảnh, nhận thuốc, ghi liều và bỏ liều, xác nhận đã biết bỏ liều, đề nghị mua thuốc theo hạn mức, phiếu mua thuốc, phiếu cấp thuốc; bước chuyển năm học `medicines`.
- Cổng quản trị: trang Thuốc và dặn thuốc. Ứng dụng giáo viên: màn hình dặn thuốc của lớp. Ứng dụng phụ huynh: mục dặn thuốc.
- Kết quả: máy chủ API 424/424, kiểm thử giao diện 50/50.

#### Quyết định

- Claude tự chọn các điểm của YCTD-75 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-75 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.34.0.

#### Vấn đề tồn đọng

- Gộp phần 10c; các phần 10e đến 10j.

### 2026-10-11 — DT-10 phần 10d: kho, tài sản, mua hàng

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 43 (phần 10a). Lượt song song đầu của DT-10: ba agent làm 10b, 10c, 10d trong worktree riêng (YCTD-73); agent 10d viết mã, kiểm thử máy chủ và nháp tài liệu; người điều phối soát, gộp `main`, chạy toàn bộ kiểm thử và đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười ba bảng (tệp 0033). Máy chủ API: tài sản, cấp phát, mượn trả, hỏng mất, nhà cung cấp, mặt hàng, nhập xuất, tồn ban đầu, kiểm kê, đề nghị và phiếu mua hàng; bước chuyển năm học `inventory`. Cổng quản trị: trang Kho và tài sản, trang Đề nghị mua hàng.
- Kết quả: máy chủ API 416/416, kiểm thử giao diện 49/49.

#### Quyết định

- Claude tự chọn các điểm của YCTD-77 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-77 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.33.0.

#### Vấn đề tồn đọng

- Gộp phần 10b, 10c; các phần 10e đến 10j.

### 2026-10-11 — DT-10 phần 10a: y tế học đường

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 42 (phần 9g), gắn nhãn `v1.0.0-rc.1`; lập kế hoạch DT-10 (YCTD-73); viết phần 10a trên nhánh `dt-10-phan-10a`.
- Cơ sở dữ liệu: tám bảng y tế (tệp 0030 năm học); quyền P10 (tệp 0031 định danh).
- Máy chủ API: chỉ số, tiêu chuẩn, đợt khám, lịch khám, kết quả, sự kiện y tế, chăm sóc hằng ngày, tổng hợp sức khỏe, yêu cầu báo cáo; bước chuyển năm học `health`.
- Cổng quản trị: trang Y tế học đường. Ứng dụng giáo viên: màn hình chăm sóc và y tế của lớp. Ứng dụng phụ huynh: mục sức khỏe.
- Kết quả: máy chủ API 408/408, kiểm thử giao diện 48/48.

#### Quyết định

- Claude tự chọn các điểm của YCTD-73, YCTD-74 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-73, YCTD-74 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.32.0.

#### Vấn đề tồn đọng

- Phần 10b đến 10j của đợt DT-10.

### 2026-10-11 — DT-09 phần 9g: cổng CG-10 và bản ứng viên 1.0.0

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 41 (phần 9f); viết phần 9g trên nhánh `dt-09-phan-9g`.
- Thêm kiểm thử phạm vi báo cáo thu chi của kế toán (CTC-P06-050); ghi kết quả các ca đã có kiểm thử.
- Viết `28_BAO_CAO_KIEM_THU_CG_10.md`; cập nhật trạng thái công việc và giai đoạn.
- Kết quả: máy chủ API 401/401, kiểm thử giao diện 47/47.

#### Quyết định

- Claude đánh giá CG-10 đạt theo ủy quyền của Eric ngày 2026-10-11 (YCTD-72).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-72 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.31.0.

#### Vấn đề tồn đọng

- CG-11: Eric nghiệm thu bản ứng viên; việc T1 (nhà cung cấp tin nhắn, thanh toán) và T6 (môi trường đám mây, kiểm thử hiệu năng, phục hồi, triển khai).

### 2026-10-11 — DT-09 phần 9f: tiến trình gửi thông báo

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 40 (phần 9e); viết phần 9f trên nhánh `dt-09-phan-9f`.
- Cơ sở dữ liệu: `notification_recipients` thêm cột theo dõi lần gửi (tệp 0029).
- Máy chủ API: tiến trình gửi thông báo trong ứng dụng và tin nhắn, gửi lại khi lỗi, giới hạn 5 tin mỗi ngày, nhắc ghi nhật ký theo giờ cấu hình.
- Kết quả: máy chủ API 400/400, kiểm thử giao diện 47/47.

#### Quyết định

- Claude tự chọn các điểm của YCTD-71 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-71 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.9.

#### Vấn đề tồn đọng

- Phần 9g của đợt DT-09: báo cáo cổng CG-10 và phát hành 1.0.0.

### 2026-10-11 — DT-09 phần 9e: quy tắc theo cấu hình, báo cáo thu chi theo nhóm

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 39 (phần 9d); viết phần 9e trên nhánh `dt-09-phan-9e`.
- Máy chủ API: sĩ số tối đa theo cấu hình đơn vị; ghi nhật ký truy cập khi đơn vị bật; tra nhật ký truy cập; báo cáo thu chi theo nhóm và theo tháng.
- Cổng quản trị: hai bảng mới trong báo cáo thu chi.
- Kết quả: máy chủ API 395/395, kiểm thử giao diện 47/47.

#### Quyết định

- Claude tự chọn các điểm của YCTD-70 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-70 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.8.

#### Vấn đề tồn đọng

- Phần 9f, 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9d: chuyển dữ liệu sang năm học mới

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 38 (phần 9c); viết phần 9d trên nhánh `dt-09-phan-9d`.
- Cơ sở dữ liệu: năm học có cột `receipts.carried_over` (tệp 0028).
- Máy chủ API: bước chuyển trẻ, phụ huynh, lớp, đăng ký dịch vụ; bước chuyển quỹ, công nợ, số dư có kèm kiểm tra BR-89, BR-94; mẫu thông báo chuyển cùng cấu hình.
- Kết quả: máy chủ API 390/390.

#### Quyết định

- Claude tự chọn các điểm của YCTD-69 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-69 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.7.

#### Vấn đề tồn đọng

- Phần 9e đến 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9c: lịch nghỉ và lịch công tác

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 37 (phần 9b); viết phần 9c trên nhánh `dt-09-phan-9c`.
- Cơ sở dữ liệu: năm học có `work_schedules` (tệp 0027); định danh có quyền `P08.work-schedule.manage` (tệp 0030).
- Máy chủ API: lập, công bố, xóa lịch; lịch của tôi; bảng công tính ngày công tác đã công bố; mở năm học mới chuyển lịch sang.
- Cổng quản trị: màn hình Lịch công tác (MH-56). Ứng dụng giáo viên: mục lịch công tác ở thẻ chấm công.
- Kết quả: máy chủ API 384/384, kiểm thử giao diện 47/47.

#### Quyết định

- Claude tự chọn các điểm của YCTD-68 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-68 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.6.

#### Vấn đề tồn đọng

- Phần 9d đến 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9b: chuyển đơn vị, thôi học, đồng ý hình ảnh

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 36 (phần 9a); viết phần 9b trên nhánh `dt-09-phan-9b`.
- Cơ sở dữ liệu: năm học có `child_unit_transfers` (tệp 0026).
- Máy chủ API: chuyển đơn vị kèm kiểm tra công nợ, thôi học, đồng ý hình ảnh của phụ huynh và giấy ký tay, cờ trẻ con nhân viên; tính học phí và bảng đăng ký dịch vụ gồm trẻ thôi học trong kỳ.
- Cổng quản trị: các mục mới trong chi tiết trẻ. Ứng dụng phụ huynh: mục hình ảnh.
- Kết quả: máy chủ API 380/380, kiểm thử giao diện 46/46.

#### Quyết định

- Claude tự chọn các điểm của YCTD-67 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-67 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.5.

#### Vấn đề tồn đọng

- Phần 9c đến 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9a: kiểm thử bổ sung và ghi kết quả

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 35 (phần 8b). Rà soát 108 ca kiểm thử chi tiết và 175 kịch bản kiểm thử còn Chưa chạy; viết phần 9a trên nhánh `dt-09-phan-9a`.
- Viết thêm kiểm thử tự động cho phê duyệt theo hạn mức, phiếu thu nhiều hóa đơn, nhiều quỹ, sổ quỹ, phạm vi đơn vị, phiên đăng nhập, danh mục ngừng dùng, khóa API, tình huống tính học phí theo lịch, lương, quyết toán, lưu trữ dữ liệu nhạy cảm.
- Ghi kết quả Đạt cho 69 ca kiểm thử chi tiết và 116 kịch bản kiểm thử.
- Kết quả: máy chủ API 368/368, kiểm thử giao diện 45/45.

#### Quyết định

- Claude tự chọn các điểm của YCTD-66 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-66 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.4.

#### Vấn đề tồn đọng

- Phần 9b đến 9g của đợt DT-09.
- Cổng CG-11 cần Eric: thuê hạ tầng đám mây (T6), chọn nhà cung cấp tin nhắn và cổng thanh toán (T1), ký nghiệm thu.

### 2026-10-11 — DT-08 phần 8b: nhật ký của bé

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 34 (phần 8a); viết phần 8b trên nhánh `dt-08-phan-8b`.
- Cơ sở dữ liệu: năm học có `daily_journals`, `journal_amendments` (tệp 0025).
- Máy chủ API: nhật ký của lớp theo ngày, lưu nhật ký từng trẻ, công bố cả lớp kèm cảnh báo, nhật ký của trẻ theo tháng, lịch sử sửa.
- Ứng dụng giáo viên: màn hình nhật ký của lớp (MG-03). Ứng dụng phụ huynh: nhật ký của con (MP-03).
- Kết quả: máy chủ API 327/327, kiểm thử giao diện 45/45. Hoàn thành đợt DT-08.

#### Quyết định

- Claude tự chọn các điểm của YCTD-65 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-65 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.3.

#### Vấn đề tồn đọng

- Đợt DT-09: kiểm thử toàn bộ giai đoạn 1, nghiệm thu, phát hành 1.0.0.

### 2026-10-11 — DT-08 phần 8a: trung tâm thông báo và mẫu thông báo

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 33 (phần 7b, hoàn thành DT-07); viết phần 8a trên nhánh `dt-08-phan-8a`.
- Cơ sở dữ liệu: năm học có `notification_reads`, `notification_templates` (tệp 0024); định danh có hai mã quyền P19 (tệp 0029).
- Máy chủ API: danh sách thông báo theo người nhận trực tiếp và theo vai trò, đánh dấu đã đọc, ai đã đọc, mẫu thông báo.
- Cổng quản trị: trang Thông báo (MH-55) và số chưa đọc ở thanh điều hướng; ứng dụng giáo viên và phụ huynh: khung thông báo.
- Kết quả: máy chủ API 322/322, kiểm thử giao diện 44/44.

#### Quyết định

- Claude tự chọn các điểm của YCTD-64 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-64 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.2.

#### Vấn đề tồn đọng

- Phần 8b: nhật ký của bé.

### 2026-10-11 — DT-07 phần 7b: khóa API cho đối tác

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 32 (phần 7a; lần chạy đầu của CI lỗi ngẫu nhiên ở ca kiểm thử giao diện 20, chạy lại thì đạt); viết phần 7b trên nhánh `dt-07-phan-7b`.
- Cơ sở dữ liệu định danh: bảng `api_clients`, mã quyền `P01.api-client.manage` (tệp 0028).
- Dịch vụ định danh: cấp, xem, thu hồi, kiểm tra khóa. Máy chủ API: nhóm `/partner/` với giới hạn tần suất và nhật ký truy cập dữ liệu nhạy cảm.
- Cổng quản trị: trang Khóa API cho đối tác (MH-42).
- Kết quả: máy chủ API 318/318, dịch vụ định danh 37/37, kiểm thử giao diện 43/43. Hoàn thành đợt DT-07.

#### Quyết định

- Claude tự chọn các điểm của YCTD-63 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-63 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.1.

#### Vấn đề tồn đọng

- Đợt DT-08: ứng dụng giáo viên và ứng dụng phụ huynh.

### 2026-10-11 — DT-07 phần 7a: bảng điều khiển và báo cáo cơ bản

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 31 (phần 6c-2, hoàn thành DT-06); viết phần 7a trên nhánh `dt-07-phan-7a`.
- Cơ sở dữ liệu: định danh có chín mã quyền P17 (tệp 0027).
- Máy chủ API: bảng điều khiển Ban Giám hiệu và quản lý đơn vị, sinh nhật trẻ, báo cáo học phí, công nợ, thu chi, điểm danh, chấm công, học thứ 7.
- Cổng quản trị: bảng điều khiển và sinh nhật trên trang chủ (MH-01), trang Báo cáo (MH-28).
- Kết quả: máy chủ API 314/314, kiểm thử giao diện 42/42.

#### Quyết định

- Claude tự chọn các điểm của YCTD-62 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-62 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.0.

#### Vấn đề tồn đọng

- Phần 7b: khóa API cho đối tác.

### 2026-10-11 — DT-06 phần 6c-2: phiếu chi lương, quyết toán, thu hồi lương, điều chỉnh kỳ sau

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 30 (phần 6c-1). Eric ủy quyền tự làm tới khi hoàn tất dự án, không chờ xác nhận; viết phần 6c-2 trên nhánh `dt-06-phan-6c-2`.
- Cơ sở dữ liệu: năm học có `payroll_settlements`, `payroll_adjustments`; `payments` có `payroll_id`, `settlement_id`; `receipts` cho phép không gắn trẻ, có `staff_id`, `settlement_id` (tệp 0023).
- Máy chủ API: phiếu chi lương từ bảng lương và bảng quyết toán, bảng quyết toán, phiếu thu thu hồi lương, khoản điều chỉnh kỳ sau đưa vào bảng lương, chuyển năm học.
- Cổng quản trị: lập phiếu chi lương ở trang Bảng lương; trang Quyết toán và điều chỉnh lương (MH-54).
- Kết quả: máy chủ API 305/305, kiểm thử giao diện 41/41. Hoàn thành đợt DT-06.

#### Quyết định

- Claude tự chọn các điểm của YCTD-61 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-61 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.7.

#### Vấn đề tồn đọng

- Đợt DT-07: bảng điều khiển và báo cáo cơ bản, API chỉ đọc cho đối tác.

### 2026-10-11 — DT-06 phần 6c-1: danh mục lương, biểu thuế, bảng lương, phiếu lương

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 29 (phần 6b-2). Hỏi Eric các điểm của phần 6c; chia 6c-1 và 6c-2; viết phần 6c-1 trên nhánh `dt-06-phan-6c-1`.
- Cơ sở dữ liệu: năm học có `pay_item_types`, `staff_pay_items`, `tax_tables` (có sẵn biểu thuế hiện hành), `payrolls`, `payslips`, `payslip_lines`, `staff.dependents_count` (tệp 0022); định danh có sáu mã quyền P08 (tệp 0026).
- Máy chủ API: danh mục lương, khoản gán, số người phụ thuộc, biểu thuế, tính bảng lương toàn trường, trình, duyệt, trả lại, phiếu lương của tôi, chuyển năm học; cấu hình hệ số làm thêm.
- Cổng quản trị: trang Bảng lương (MH-15), Danh mục lương và biểu thuế (MH-53), Phiếu lương của tôi, khoản lương riêng ở hồ sơ nhân sự. Ứng dụng giáo viên: màn hình phiếu lương (MG-11).
- Kết quả: máy chủ API 299/299, kiểm thử giao diện 40/40.

#### Quyết định

- Theo YCTD-60 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-60 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.6.

#### Vấn đề tồn đọng

- Phần 6c-2: phiếu chi lương, bảng quyết toán, phiếu thu thu hồi lương, bảng điều chỉnh kỳ sau.

### 2026-10-11 — DT-06 phần 6b-2: phép năm, đơn nghỉ phép, chốt và mở lại bảng công

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 28 (phần 6b-1); viết phần 6b-2 trên nhánh `dt-06-phan-6b-2`.
- Cơ sở dữ liệu: năm học có `leave_policies`, `leave_balances`, `leave_requests`, `timesheet_periods`, `timesheet_days`, `timesheet_reopen_requests` (tệp 0021); định danh có `P08.leave-policy.manage`, `P08.leave.approve`, `P08.timesheet-reopen.approve` (tệp 0025).
- Máy chủ API: quy định phép năm, số ngày phép, đơn nghỉ phép, chốt bảng công, đề nghị và duyệt mở lại, chặn sửa kỳ đã chốt, chuyển năm học.
- Cổng quản trị: trang Đơn nghỉ phép, trang Quy định phép năm (MH-52), phần kỳ công ở trang Chấm công. Ứng dụng giáo viên: màn hình đơn nghỉ phép.
- Kết quả: máy chủ API 290/290, kiểm thử giao diện 39/39.

#### Quyết định

- Theo YCTD-59 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-59 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.5.

#### Vấn đề tồn đọng

- Phần 6c: tiền lương.

### 2026-10-11 — DT-06 phần 6b-1: ngày lễ, lịch học bù và nghỉ bù, chấm công

#### Công việc đã thực hiện

- Hỏi Eric các điểm của phần 6b; chia 6b-1 và 6b-2; viết phần 6b-1 trên nhánh `dt-06-phan-6b`.
- Cơ sở dữ liệu: năm học có `holidays`, `school_day_changes`, `attendance_logs`, `catalog_items.attributes` (tệp 0020); định danh có `P08.holiday.manage`, `P08.school-day-change.manage`, `P08.attendance.manage`, `P08.attendance.view` (tệp 0024).
- Máy chủ API: ngày lễ, lịch học bù và nghỉ bù; lịch ngày học của trẻ tính ngày lễ, nghỉ bù, học bù; ngày làm việc của nhân sự; chấm công tự bấm và nhập tay; cấu hình giờ làm; thuộc tính loại nghỉ; chuyển năm học.
- Cổng quản trị: trang Chấm công (MH-44, MH-13), trang Ngày lễ và lịch bù (MH-37), thuộc tính loại nghỉ ở Danh mục dùng chung. Ứng dụng giáo viên: thẻ chấm công hôm nay (MG-10).
- Kết quả: máy chủ API 279/279, kiểm thử giao diện 38/38.

#### Quyết định

- Ngày làm việc, lịch thứ bảy, ngày lễ, giờ làm, loại nghỉ, phép năm, đơn nghỉ theo YCTD-59 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-59 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.4.

#### Vấn đề tồn đọng

- Phần 6b-2 làm ngay sau đó.

### 2026-10-10 — DT-06 phần 6a: hồ sơ nhân sự và hợp đồng lao động

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 26 (đổi cổng kiểm thử giao diện).
- Tạo `.claude/launch.json` cho các máy chủ phát triển (không đưa vào kho mã).
- Hỏi Eric bốn điểm của DT-06; chia ba phần; viết phần 6a trên nhánh `dt-06-phan-6a`.
- Cơ sở dữ liệu: năm học có `staff`, `employment_contracts`, lần nhập loại `staff` (tệp 0019); định danh có `P07.staff.manage`, `P07.staff.view`, `P07.contract.view`, `P01.import.staff` (tệp 0023).
- Dịch vụ định danh: tra tài khoản nhân sự để liên kết; khóa tài khoản và thu hồi phiên khi chấm dứt hợp đồng.
- Máy chủ API: hồ sơ nhân sự, liên kết tài khoản, hợp đồng, chấm dứt hợp đồng, cảnh báo hết hạn, hồ sơ của tôi, nhập nhân sự từ Excel, chuyển năm học.
- Cổng quản trị: trang Hồ sơ nhân sự (MH-12), mục nhân sự ở trang Nhập dữ liệu, cảnh báo hợp đồng sắp hết hạn trên trang chủ.
- Kết quả: máy chủ API 266/266, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 36/36.

#### Quyết định

- DT-06 chia ba phần; hồ sơ liên kết tài khoản có sẵn; nhân viên tự chấm công, phòng nhân sự sửa; đơn nghỉ phép do Hiệu trưởng hoặc Phó Hiệu trưởng duyệt (YCTD-58) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-58 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.3.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — Đổi cổng kiểm thử giao diện

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 25 (phần 5f) sau khi mọi bước kiểm thử trên GitHub đạt; đợt DT-05 xong, còn bộ chuyển đổi nhà cung cấp thanh toán thật.
- Đổi cổng kiểm thử giao diện trong `tests/e2e-environment.mjs` để không trùng máy chủ phát triển đang chạy trên máy: dịch vụ định danh 3201, máy chủ API 3200, cổng quản trị 5373, ứng dụng phụ huynh 5375, ứng dụng giáo viên 5376.
- Kết quả: kiểm thử giao diện chạy trên máy đạt 35/35.

#### Quyết định

- Đổi cổng kiểm thử giao diện sang cổng khác – người quyết định: Eric.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — DT-05 phần 5f: thanh toán trực tuyến bằng mã QR

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 24 (phần 5e-2) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric hai lượt về nhà cung cấp, tài khoản nhận, đối chiếu và phạm vi; viết phần 5f trên nhánh `dt-05-phan-5f`.
- Cơ sở dữ liệu: năm học có `payment_requests`, `online_payment_transactions`, tài khoản nhận thanh toán trực tuyến trong `cash_accounts` (tệp 0018).
- Máy chủ API: lớp nhà cung cấp có bộ giả lập; cấu hình tài khoản nhận; cấp mã QR theo hóa đơn; đối chiếu giao dịch tiền vào, tự lập phiếu thu; danh sách chờ và ghi xử lý; tách phần ghi phiếu thu để dùng chung.
- Cổng quản trị: chọn tài khoản nhận ở trang Quỹ và ngân hàng; giao dịch chờ xử lý ở trang Phiếu thu. Ứng dụng phụ huynh: nút thanh toán bằng mã QR.
- Kết quả: máy chủ API 257/257, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Nhà cung cấp cấp tài khoản ảo và mã QR dùng một lần qua API, tiền về một tài khoản của trường; đối chiếu nội dung trước, số tiền sau; nội dung là mã hóa đơn bỏ gạch; điểm cuối nhận thông báo thật chờ chọn nhà cung cấp; làm đủ phần còn lại với bộ giả lập (YCTD-57) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-57 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.2.

#### Vấn đề tồn đọng

- Chọn nhà cung cấp tài khoản ảo và xác nhận chuyển khoản (T1), viết bộ chuyển đổi và điểm cuối nhận thông báo có chữ ký, địa chỉ mạng cho phép; chạy CTC-P06-061.

### 2026-10-10 — DT-05 phần 5e-2: phiếu đảo phiếu chi

#### Công việc đã thực hiện

- Sửa lỗi CI của yêu cầu gộp số 23: kiểm thử giao diện phiếu chi chờ nhãn cần Hiệu trưởng duyệt, nhưng dữ liệu kiểm thử đã đặt hạn mức phiếu chi ở `06-catalogs.spec.ts`; đổi sang kiểm tra nội dung phiếu.
- Viết phần 5e-2 trên nhánh `dt-05-phan-5e2`.
- Cơ sở dữ liệu: năm học có `payment_reversals` (tệp 0017); định danh có `P06.payment-reversal.create` (tệp 0022).
- Máy chủ API: lập, duyệt, từ chối phiếu đảo phiếu chi theo hạn mức; hoàn lại nguồn chi; đảo phiếu hoàn tiền trả lại số dư có; sổ quỹ ghi số phiếu đảo.
- Cổng quản trị: trang Phiếu chi có nút lập phiếu đảo và mục phiếu đảo phiếu chi chờ duyệt.
- Kết quả: máy chủ API 246/246, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Không có quyết định mới; làm theo YCTD-55.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-56 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.1.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — DT-05 phần 5e-1: phiếu chi và sổ quỹ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 22 (phần 5d-2) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 5e; chia 5e thành 5e-1 và 5e-2; viết phần 5e-1 trên nhánh `dt-05-phan-5e`.
- Cơ sở dữ liệu: năm học có `payments`, `payment_attachments`, `payment_refund_sources`, tệp mục đích `payment_voucher` (tệp 0016); định danh có `P06.payment.manage`, `P06.payment.approve` (tệp 0021); cấu hình kiểm tra số dư ngân hàng mặc định bật.
- Máy chủ API: lập, sửa, xóa phiếu chi nháp, trình duyệt, duyệt là phát hành, từ chối; hoàn tiền trừ số dư có; sổ quỹ theo khoảng ngày; tải và xem chứng từ phiếu chi.
- Cổng quản trị: trang Phiếu chi (MH-10) có biểu mẫu kèm chứng từ, danh sách và mục chờ duyệt; trang Sổ quỹ (MH-11).
- Kết quả: máy chủ API 242/242, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Hoàn tiền thôi học trừ vào số dư có; kiểm tra số dư ngân hàng mặc định chặn; chia 5e-1, 5e-2; phiếu nộp, phiếu rút để giai đoạn 2 (YCTD-55) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-55 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.0.

#### Vấn đề tồn đọng

- CTC-P06-034 (phiếu chi lương từ bảng lương đã duyệt) chờ phân hệ lương; CTC-P01-049 (tắt kiểm tra số dư ngân hàng) chưa có kiểm thử tự động.

### 2026-10-10 — DT-05 phần 5d-2: đảo phiếu thu và nhập công nợ đầu kỳ

#### Công việc đã thực hiện

- Sửa lỗi CI của yêu cầu gộp số 21: mục điều hướng "Quỹ và tài khoản" trùng tên với mục "Tài khoản" trong kiểm thử giao diện, đổi thành "Quỹ và ngân hàng"; gộp yêu cầu gộp số 21 sau khi mọi bước đạt.
- Hỏi Eric ba điểm của phần 5d-2; viết phần 5d-2 trên nhánh `dt-05-phan-5d2`.
- Cơ sở dữ liệu: năm học có `receipt_reversals`, hóa đơn và dòng khoản loại đầu kỳ, lần nhập loại công nợ đầu kỳ (tệp 0015); định danh có `P06.receipt-reversal.create`, `P06.receipt-reversal.approve`, `P05.opening-debt.import` (tệp 0020).
- Máy chủ API: lập, duyệt, từ chối phiếu đảo theo hạn mức, chặn khi quỹ không đủ; danh sách phiếu đảo chờ duyệt; nhập công nợ đầu kỳ từ Excel theo quy trình kiểm tra rồi ghi; hàm cấp số chứng từ dùng chung.
- Cổng quản trị: trang Phiếu thu có lập phiếu đảo và mục phiếu đảo chờ duyệt; trang Nhập dữ liệu có mục công nợ đầu kỳ cho kế toán.
- Kết quả: máy chủ API 227/227, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Quỹ tiền mặt không đủ thì chặn duyệt phiếu đảo; số phiếu đảo `DPT-000001` riêng; tệp công nợ đầu kỳ dùng số định danh cá nhân, chỉ số dương (YCTD-54) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-54 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.9.

#### Vấn đề tồn đọng

- CTC-P01-082 còn phần nhập tệp nhân sự, làm khi xây dựng P07.

### 2026-10-10 — DT-05 phần 5d-1: phiếu thu, phân bổ, quỹ và công nợ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 20 (phần 5c-2) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 5d; chia 5d thành 5d-1 và 5d-2; viết phần 5d-1 trên nhánh `dt-05-phan-5d1`.
- Cơ sở dữ liệu: năm học có `cash_accounts`, `receipts`, `receipt_allocations`, `account_transactions` (tệp 0014); định danh có `P06.receipt.manage`, `P06.cash-account.manage`, `P05.debt.view` (tệp 0019).
- Máy chủ API: khai báo quỹ và tài khoản; lập phiếu thu kèm phân bổ, chống gửi lặp, ghi giao dịch tài khoản, thông báo phụ huynh và báo tất toán; dùng số dư có; danh sách và chi tiết phiếu thu; công nợ theo đơn vị và theo trẻ; số đã thu và còn phải nộp của hóa đơn; chặn giảm vượt số còn phải nộp.
- Cổng quản trị: trang Công nợ (MH-08) có chi tiết của trẻ, lập phiếu thu, dùng số dư có; trang Phiếu thu (MH-09); trang Quỹ và ngân hàng (MH-11). Ứng dụng phụ huynh: số còn phải nộp, hóa đơn đã thu đủ, số dư có, lịch sử đã nộp.
- Kết quả: máy chủ API 219/219, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 31.

#### Quyết định

- Làm quỹ và tài khoản ở phần 5d; số phiếu thu `PT-000001` toàn trường; phân bổ theo hóa đơn; công nợ đầu kỳ nhập thành hóa đơn loại đầu kỳ (YCTD-53) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-53 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.8.

#### Vấn đề tồn đọng

- CTC-P06-066 (đánh số lại khi mở năm học mới) chưa có kiểm thử tự động; số phiếu nằm trong cơ sở dữ liệu năm học nên năm mới bắt đầu từ `PT-000001`.

### 2026-10-10 — DT-05 phần 5c-2: miễn giảm và phiếu điều chỉnh hóa đơn

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 19 (phần 5c-1) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric hai điểm của phần 5c-2; viết phần 5c-2 trên nhánh `dt-05-phan-5c2`.
- Cơ sở dữ liệu: năm học có `discounts`, `invoice_adjustments` (tệp 0013); định danh có `P05.discount.manage`, `P05.invoice-adjustment.create`, `P05.fee-document.approve` (tệp 0018).
- Máy chủ API: lập miễn giảm, chép miễn giảm kỳ trước, lập phiếu điều chỉnh, duyệt và từ chối theo hạn mức, danh sách chờ duyệt; số phải nộp của hóa đơn; tính lại miễn giảm chờ duyệt khi chạy lại tính học phí.
- Cổng quản trị: chi tiết hóa đơn trong MH-06 có miễn giảm, điều chỉnh, số phải nộp và biểu mẫu lập; trang MH-07 Duyệt miễn giảm và điều chỉnh. Ứng dụng phụ huynh: số phải nộp và miễn giảm đã duyệt.
- Kết quả: máy chủ API 200/200, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 30/30.

#### Quyết định

- Miễn giảm lập trên cả hóa đơn nháp và đã phát hành; lập theo từng hóa đơn, có chép từ kỳ trước (YCTD-52) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-52 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.7.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — DT-05 phần 5c-1: tính học phí và phát hành hóa đơn

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 18 (phần 5b) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 5c; chia phần 5c thành 5c-1 và 5c-2; viết 5c-1 trên nhánh `dt-05-phan-5c1`.
- Sửa lỗi phân quyền của phần 5b: phụ huynh xem được bảng đăng ký của cả đơn vị vì VT-14 gán theo đơn vị của con và có `P05.view`; phạm vi xem của nhân sự nay bỏ vai trò phụ huynh.
- Cơ sở dữ liệu: năm học có `fee_calculation_runs`, `invoices`, `invoice_items`, `document_sequences` (tệp 0012); định danh có `P05.fee-calculation.manage` (tệp 0017).
- Máy chủ API: tính học phí theo kỳ và đơn vị, hóa đơn nháp và dòng cần kiểm tra, phát hành, hóa đơn bổ sung, xem hóa đơn; chặn đăng ký khi nợ quá hạn.
- Cổng quản trị: MH-06 Học phí. Ứng dụng phụ huynh: mục Học phí của con (MP-11).
- Kết quả: máy chủ API 185/185, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 30/30.

#### Quyết định

- Ngày học thực tế của BR-23 là ngày học trong thời gian đang học; tính học phí chạy ngay có ghi lần chạy; dòng cần kiểm tra theo mốc cố định; làm tròn đến đồng (YCTD-51) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-51 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.6.

#### Vấn đề tồn đọng

- CTC-P05-032 (giả lập lỗi giữa lần tính) chưa có kiểm thử tự động. Kiểm thử giao diện chưa chạy trọn luồng tính học phí vì cần một tháng đã qua chốt đủ điểm danh; đã phủ bằng kiểm thử máy chủ API.

### 2026-10-10 — DT-05 phần 5b: đăng ký dịch vụ và học hè

#### Công việc đã thực hiện

- Yêu cầu gộp số 17 (phần 5a) lần đầu thất bại trên GitHub vì kiểm thử hồ sơ trẻ sinh tên ngẫu nhiên trùng nhau; sửa bằng tên đánh số tuần tự, chạy lại đạt rồi gộp.
- Hỏi Eric hai điểm của phần 5b; viết phần 5b trên nhánh `dt-05-phan-5b`.
- Cơ sở dữ liệu: năm học có `service_registrations`, `registration_periods`, `summer_registrations` (tệp 0011); định danh có `P05.registration.manage`, `P05.late-registration.approve` (tệp 0016); cấu hình `service_registration_closing_day`.
- Máy chủ API: bảng đăng ký theo kỳ, đăng ký và hủy, đăng ký và hủy trễ chờ duyệt, chốt kỳ, học hè; điểm danh ngày hè cho trẻ đăng ký học hè.
- Cổng quản trị: MH-05 Đăng ký dịch vụ. Ứng dụng phụ huynh: mục Dịch vụ của con (MP-12).
- Kiểm thử giao diện phát hiện lỗi chạy đua khi tải dữ liệu: kết quả của tháng hoặc ngày cũ về sau ghi đè dữ liệu mới, ở màn hình dịch vụ của ứng dụng phụ huynh và bảng điểm danh của ứng dụng giáo viên; đã sửa bằng cách chỉ nhận kết quả của lần tải mới nhất.
- Kết quả: máy chủ API 174/174, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 29/29.

#### Quyết định

- Hủy dịch vụ sau ngày chốt cần Ban Giám hiệu duyệt; tháng hè không tự giữ dịch vụ không bắt buộc (YCTD-50) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-50 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.5.

#### Vấn đề tồn đọng

- CTC-P05-015 (thu theo ngày thực tế), 017, 018 (chặn khi nợ quá hạn), 065 cần tính học phí và hóa đơn; chạy ở phần 5c, 5d.

### 2026-10-10 — DT-05 phần 5a: danh mục học phí và tài chính

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 16 (phần 4b) sau khi mọi bước kiểm thử trên GitHub đạt; DT-04 xong phần điểm danh và đón trả.
- Hỏi Eric bốn điểm của DT-05; viết phần 5a trên nhánh `dt-05-phan-5a`.
- Cơ sở dữ liệu: năm học có `services` (bán trú tạo sẵn), `fee_schedules`, `fee_schedule_items`, `discount_types`, `cashflow_categories` (tệp 0010); định danh có ba quyền mới (tệp 0015). Mở năm học mới chuyển các danh mục này sang.
- Máy chủ API: dịch vụ, biểu phí theo phiên bản, loại miễn giảm, khoản mục thu chi.
- Cổng quản trị: MH-04 Biểu phí và dịch vụ, MH-39 Khoản mục thu chi.
- Kết quả: máy chủ API 158/158, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 28/28.

#### Quyết định

- DT-05 chia sáu phần; đăng ký dịch vụ tự giữ tới khi hủy; ngày chốt đăng ký là cấu hình đơn vị mặc định ngày 25; danh mục dùng chung toàn trường (YCTD-49) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-49 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.4.

#### Vấn đề tồn đọng

- CTC-P05-002, 003, 007, 045, CTC-P06-052 đến 054 có phần phụ thuộc hóa đơn, đăng ký, phiếu thu chi; chạy ở các phần sau.

### 2026-10-10 — DT-04 phần 4b: người được ủy quyền đón trẻ và đón trả

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 15 (phần 4a) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 4b; viết phần 4b trên nhánh `dt-04-phan-4b`.
- Cơ sở dữ liệu: năm học có `authorized_pickups`, `pickup_confirmation_requests`, `pickup_records`, tệp mục đích `pickup_photo` (tệp 0009); định danh có quyền `P02.authorized-pickup.manage`, `P04.pickup.gate-confirm` (tệp 0014).
- Máy chủ API: khai báo, hủy người được ủy quyền; bàn giao trẻ; yêu cầu và trả lời xác nhận của phụ huynh; danh sách người đón cho bảo vệ; ảnh bàn giao.
- Ứng dụng giáo viên: màn hình Đón trả trẻ (MG-04), Xác nhận người đón tại cổng (MG-16). Ứng dụng phụ huynh: người đón của con, xác nhận người đón ngoài danh sách (MP-18). Cổng quản trị: mục người được ủy quyền trong hồ sơ trẻ.
- Kết quả: máy chủ API 142/142, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 26/26.

#### Quyết định

- Chỉ ghi bàn giao chiều; bảo vệ xác nhận độc lập; mọi phụ huynh có tài khoản của trẻ xác nhận người đón ngoài danh sách, hiệu lực trong ngày; VT-02, VT-15, VT-03 khai báo phía nhà trường (YCTD-48) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-48 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.3.

#### Vấn đề tồn đọng

- Thông báo mới vào hàng đợi; gửi thật khi làm phân hệ thông báo. Kiểm thử giao diện chưa phủ bàn giao của giáo viên vì phụ thuộc hôm nay là ngày học; đã phủ bằng kiểm thử máy chủ API.

### 2026-10-10 — DT-04 phần 4a: điểm danh và báo vắng

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 13 (phần 3c). Yêu cầu gộp số 13 được gộp nhầm khi kiểm thử trên GitHub thất bại; nguyên nhân là các tệp kiểm thử chạy song song cùng sửa mật khẩu mặc định; đã sửa ở yêu cầu gộp số 14 (kiểm thử chạy từng tệp lần lượt) và chỉ gộp khi mọi bước đạt.
- Hỏi Eric bốn điểm của DT-04; viết phần 4a trên nhánh `dt-04-phan-4a`.
- Cơ sở dữ liệu: năm học có `attendance_records`, `attendance_days`, `absence_records`, người nhận thông báo theo vai trò (tệp 0008); định danh có quyền `P04.attendance.manage` (tệp 0013).
- Máy chủ API: lịch ngày học, bảng điểm danh, lưu chống trùng, chốt và mở lại, sửa sau khi chốt kèm lý do, báo vắng, điểm danh của trẻ theo tháng; cấu hình giờ bắt đầu học.
- Ứng dụng giáo viên: đăng nhập, Lớp của tôi, Bảng điểm danh có lưu tạm khi mất mạng. Ứng dụng phụ huynh: danh sách con, báo vắng, điểm danh tháng này. Cổng quản trị: màn hình Điểm danh.
- Kết quả: máy chủ API 129/129, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 24/24.

#### Quyết định

- DT-04 chia hai phần; giờ bắt đầu học cấu hình theo đơn vị mặc định 07:30; bảng ban đầu chưa đánh dấu; chưa điểm danh kỳ hè (YCTD-47) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-47 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.2.

#### Vấn đề tồn đọng

- CTC-P04-007, 008 chờ lịch học bù thứ bảy (P08-10); CTC-P04-046 chờ đăng ký học hè (P05-13).

### 2026-10-10 — DT-03 phần 3c: nhập dữ liệu

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 12 (phần 3b) vào nhánh chính. Eric yêu cầu làm song song: viết phần sau trong lúc phần trước chạy kiểm thử trên GitHub.
- Hỏi Eric ba điểm của phần 3c; viết trên nhánh `dt-03-phan-3c`.
- Cơ sở dữ liệu: năm học có `data_import_jobs`, giấy khai sinh cho phép trống với trẻ nhập (tệp 0007); định danh có quyền `P01.import.children` (tệp 0012).
- Máy chủ API: mẫu Excel, kiểm tra và ghi tệp lớp, tệp trẻ kèm phụ huynh, nhập mã ngành, bộ lọc thiếu giấy khai sinh; tệp vượt dung lượng trả `ERR_VALIDATION`.
- Cổng quản trị: màn hình Nhập dữ liệu (MH-40); Hồ sơ trẻ có bộ lọc và bổ sung giấy khai sinh.
- Kết quả: máy chủ API 116/116, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 22/22.

#### Quyết định

- Trẻ nhập vào thẳng đang học, bổ sung giấy khai sinh sau; mẫu mã ngành của hệ thống; nhập lớp và trẻ kèm phụ huynh (YCTD-46) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-46 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.1.

#### Vấn đề tồn đọng

- CTC-P01-079, 082 (nhập công nợ, nhân sự) làm ở P05, P07; chuyển trẻ sang năm mới (GD-90) làm cùng lên lớp.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-03 phần 3b: hồ sơ trẻ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 11 (phần 3a) vào nhánh chính.
- Hỏi Eric năm điểm của phần 3b; Eric duyệt thiết kế; viết trên nhánh `dt-03-phan-3b`.
- Hạ tầng: SeaweedFS trong docker compose và GitHub Actions; khóa mã hóa số định danh; lệnh `generate-data-keys`.
- Cơ sở dữ liệu: năm học có mười bảng của hồ sơ trẻ (tệp 0006); định danh có quyền `P02.child.manage`, `P02.national-id.view` (tệp 0011).
- Dịch vụ định danh: tạo tài khoản phụ huynh khi duyệt hồ sơ, thêm vai trò VT-14 cho tài khoản nhân sự trùng số điện thoại.
- Máy chủ API: hồ sơ trẻ, phụ huynh, sức khỏe, đồng ý hình ảnh, trình duyệt, duyệt và phân lớp, từ chối, chuyển lớp, xem đầy đủ số định danh, tệp đính kèm, hàng đợi thông báo.
- Cổng quản trị: màn hình Hồ sơ trẻ (MH-02); màn hình Lớp học hiện sĩ số đang học.
- Kết quả: máy chủ API 107/107, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 21/21.

#### Quyết định

- Đồng ý hình ảnh ba trạng thái; phạm vi xem trẻ theo lớp với giáo viên; kho tệp SeaweedFS thay MinIO; chuyển trẻ sang năm mới để lại đợt sau (YCTD-45) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-45 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.0.

#### Vấn đề tồn đọng

- CTC-P02-013 (gán mã ngành trùng qua nhập tệp) làm ở phần 3c; CTC-P02-033 cần nhà cung cấp tin nhắn.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-03 phần 3a: lớp học

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 10 (DT-02) vào nhánh chính.
- Hỏi Eric năm điểm của DT-03; Eric duyệt thiết kế phần 3a; viết trên nhánh `dt-03-phan-3a`.
- Cơ sở dữ liệu: năm học có `classes`, `class_staff_assignments` (tệp 0005); định danh có quyền `P02.class.manage` (tệp 0010).
- Dịch vụ định danh: danh bạ nhân sự theo vai trò và đơn vị.
- Máy chủ API: lớp học, phân công giáo viên, kiểm tra bậc học, phòng học, vai trò người được phân công.
- Cổng quản trị: nhóm điều hướng Trẻ và lớp, màn hình Lớp học (MH-03).
- Kết quả: máy chủ API 87/87, dịch vụ định danh 35/35, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 19/19.

#### Quyết định

- DT-03 chia ba phần; giáo viên chọn theo tài khoản; một lớp nhiều giáo viên chủ nhiệm; số điện thoại phụ huynh trùng tài khoản nhân sự thì thêm vai trò VT-14; thông báo ghi hàng đợi (YCTD-44) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-44 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.9.

#### Vấn đề tồn đọng

- Phần điểm danh của CTC-P02-042 chạy khi có P04.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-02: đăng nhập của phụ huynh

#### Công việc đã thực hiện

- Gộp các yêu cầu gộp số 4 đến 9 vào nhánh chính, hoàn tất DT-01.
- Hỏi Eric bốn điểm của DT-02; Eric duyệt thiết kế; viết trên nhánh `dt-02`.
- Cơ sở dữ liệu định danh: tệp 0009 cho mật khẩu mặc định, `sessions.login_method`, bảng `one_time_codes`.
- Dịch vụ định danh: đăng nhập bằng mật khẩu mặc định, mã một lần, lớp gửi tin nhắn, cấu hình chung mới, tạo tài khoản phụ huynh dùng mật khẩu mặc định, cookie mã làm mới riêng theo kênh.
- Cổng quản trị: màn hình Cấu hình phần Tài khoản có mật khẩu mặc định và thông số mã một lần; màn hình Tài khoản báo tài khoản phụ huynh dùng mật khẩu mặc định.
- Ứng dụng phụ huynh: đăng nhập bằng mật khẩu hoặc mã, đặt mật khẩu mới khi kích hoạt, trang chủ tạm.
- Kiểm thử giao diện phát hiện cổng quản trị và ứng dụng phụ huynh dùng chung cookie mã làm mới; đã sửa bằng cookie riêng theo kênh.
- Kết quả: dịch vụ định danh 35/35, máy chủ API 80/80, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 17/17.

#### Quyết định

- Mật khẩu mặc định toàn trường; thông số mã một lần có mặc định, Hiệu trưởng sửa được; lớp gửi tin nhắn nối sau; làm màn hình ứng dụng phụ huynh; bỏ `POST /auth/activate` (YCTD-43) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-43 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.8.

#### Vấn đề tồn đọng

- P19-06 chỉ nghiệm thu xong khi có tài khoản nhà cung cấp tin nhắn (T1).
- CTC-DD-011, 042 còn phần cần P02; CTC-DD-013, 015, 024 chưa chạy.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-01 phần 6b: các danh mục

#### Công việc đã thực hiện

- Hỏi Eric bốn điểm tài liệu chưa rõ trước khi thiết kế; Eric duyệt thiết kế; viết trên nhánh `dt-01-phan-6b`.
- Cơ sở dữ liệu: năm học có `departments`, `job_titles`, `catalog_items`, `approval_thresholds`, `rooms`, `grade_levels` (tệp 0004); định danh có bốn mã quyền mới (tệp 0008).
- Máy chủ API: điểm cuối của sáu danh mục, kiểm tra phạm vi đơn vị, ghi nhật ký thao tác, chuyển danh mục khi mở năm học mới.
- Cổng quản trị: MH-49 Phòng ban và chức danh, MH-50 Danh mục dùng chung, MH-33 Hạn mức phê duyệt, MH-34 Phòng học và bậc học; bộ lọc nhật ký thao tác thêm các danh mục.
- Kết quả: máy chủ API 80/80 (gồm 16 ca của danh mục), dịch vụ định danh 21/21, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 15/15.

#### Quyết định

- Danh mục dùng chung có bốn loại do hệ thống định nghĩa; VT-06 quản lý phòng ban và chức danh trong đơn vị; hạn mức có hiệu lực ngay; độ tuổi bậc học theo tháng (YCTD-42) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-42 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.7.

#### Vấn đề tồn đọng

- CTC-P01-023, 027, 060 đến 066, 068, 070, 071, 074 và phần chọn bậc học của 073 cần hồ sơ nhân sự, lớp học, chứng từ ở các đợt sau.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Ngày chốt học phí và chốt công

#### Công việc đã thực hiện

- Eric cho biết ngày chốt học phí là mùng 1 tháng sau; hỏi lại hai điểm và sửa tài liệu, mã nguồn phần 6a.

#### Quyết định

- Chốt học phí mặc định mùng 1 tháng sau, vẫn cấu hình được; chốt công cố định mùng 1 tháng sau (YCTD-41) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-41 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.6.

#### Vấn đề tồn đọng

- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — DT-01 phần 6a: cấu hình và nhật ký thao tác

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 6a. Viết trên nhánh `dt-01-phan-6a`.
- Cơ sở dữ liệu: năm học có `settings` và cột `audit_logs.actor_name`; định danh có `identity_settings`, cột `identity_audit_logs.actor_name`, quyền `P01.setting.manage` cho VT-02, VT-03.
- Máy chủ API: danh mục mười mục cấu hình, kế thừa đơn vị, Trường chính, mặc định; ghi nhật ký; chuyển cấu hình khi mở năm học; tra nhật ký thao tác theo phạm vi đơn vị.
- Dịch vụ định danh: số ngày tự khóa đọc, sửa trên cổng; khóa tài khoản lâu không đăng nhập ở lần đăng nhập kế tiếp; tra nhật ký tài khoản và quyền.
- Cổng quản trị: màn hình Cấu hình và MH-31 Nhật ký thao tác, nhật ký chỉ hiện các trường thay đổi.
- Kết quả: máy chủ API 64/64 (gồm CTC-P01-044 đến 048, 051, 053, 054), dịch vụ định danh 21/21 (gồm CTC-DD-006), cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 12/12.

#### Quyết định

- Không có quyết định mới ngoài YCTD-40.

#### Thay đổi

- `17` ghi giao kèo cấu hình và nhật ký; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.5.

#### Vấn đề tồn đọng

- CTC-P01-049, 050, 052, 055 đến 058 cần dữ liệu tài chính, lớp, hóa đơn và nhật ký truy cập ở các đợt sau.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 6a: cấu hình và nhật ký

#### Công việc đã thực hiện

- Trình thiết kế phần 6a và bốn câu hỏi về cấu hình.

#### Quyết định

- Cấu hình chưa có mặc định trong tài liệu để trống, bắt buộc cấu hình; kế thừa từ Trường chính; VT-02, VT-03 sửa cấu hình; số ngày tự khóa mặc định 90, Hiệu trưởng sửa trên cổng (YCTD-40) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-40 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.4.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 6a.

### 2026-10-09 — DT-01 phần 5: tài khoản, vai trò, quyền

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 5. Viết trên nhánh `dt-01-phan-5`.
- Cơ sở dữ liệu định danh: `0006_add_account_management` tạo `identity_audit_logs` và thêm `P01.account.manage-in-unit` cho VT-03.
- Dịch vụ định danh: tạo, sửa, khóa, mở khóa tài khoản, đặt lại mật khẩu bằng mật khẩu tạm, gán và gỡ vai trò, tạo vai trò, sửa ma trận quyền, danh sách quyền; kiểm tra phạm vi theo PQ-13 bằng cây đơn vị đọc qua máy chủ API; thu hồi phiên khi khóa, đặt lại mật khẩu, đổi vai trò; giới hạn đăng nhập đọc được từ biến môi trường `LOGIN_REQUESTS_PER_MINUTE`, mặc định 10.
- Cổng quản trị: MH-30 gồm màn hình Tài khoản và Vai trò và quyền; mục điều hướng chỉ hiện với người có quyền quản lý tài khoản; máy chủ phát triển chuyển `users`, `roles`, `permissions` sang dịch vụ định danh.
- Kết quả: máy chủ API 54/54 (gồm CTC-P01-030 đến 035, 037 đến 039, 041, 042, CTC-DD-035, 039, 040), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 10/10.

#### Quyết định

- Không có quyết định mới ngoài YCTD-39.

#### Thay đổi

- `17` ghi giao kèo nhóm tài khoản, vai trò, quyền, điểm cuối gỡ vai trò và quy tắc chuyển tiếp của cổng vào; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.3.

#### Vấn đề tồn đọng

- CTC-P01-036 (khóa khi chấm dứt hợp đồng) làm ở DT-06; CTC-P01-040, 043 cần điểm cuối nghiệp vụ của kế toán và hồ sơ trẻ.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 5: tài khoản, vai trò, quyền

#### Công việc đã thực hiện

- Trình thiết kế phần 5 và bốn câu hỏi về phân quyền quản lý tài khoản.

#### Quyết định

- VT-01, VT-02 quản lý mọi tài khoản và sửa ma trận quyền; VT-03 tạo tài khoản với mọi vai trò trừ VT-01, VT-02 trong đơn vị được gán; hệ thống sinh mật khẩu tạm khi đặt lại (YCTD-39) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-39 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.2.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 5.

### 2026-10-09 — DT-01 phần 4: cây đơn vị hai cấp

#### Công việc đã thực hiện

- Eric duyệt YCTD-38 và thiết kế phần 4. Viết trên nhánh `dt-01-phan-4`.
- Cơ sở dữ liệu năm học: `0002_create_org_units_and_audit_logs` tạo `org_units` có ràng buộc một Trường chính, đơn vị cấp 2 chỉ trực thuộc Trường chính ở tầng dữ liệu, và `audit_logs`. Cơ sở dữ liệu định danh: `0005_add_org_unit_permission` thêm `P01.org-unit.manage` cho VT-02.
- Máy chủ API: tạo, sửa, ngừng sử dụng đơn vị; cây và danh sách phẳng lọc theo loại; ghi nhật ký thao tác; bước chuyển cây đơn vị khi mở năm học, giữ nguyên mã định danh; lớp đơn vị của phân quyền: gán ở Trường chính là toàn trường, gán ở đơn vị cấp 2 chỉ có đơn vị đó.
- Cổng quản trị: MH-32 Cây đơn vị, dạng cây và danh sách phẳng.
- Kết quả: máy chủ API 41/41 (gồm CTC-P01-001 đến 005, 007, 008, 012 và lớp đơn vị theo CTC-P01-009 đến 011 với điểm cuối kiểm thử), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 7/7.

#### Quyết định

- Không có quyết định mới ngoài YCTD-38.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối cây đơn vị; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.1.

#### Vấn đề tồn đọng

- CTC-P01-009 đến 011 kiểm lại với danh sách lớp và trẻ ở DT-03.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 4: cây đơn vị

#### Công việc đã thực hiện

- Trình thiết kế phần 4; Eric cho biết trường chỉ có hai cấp; đánh giá ảnh hưởng và trình YCTD-38.

#### Quyết định

- Cây đơn vị hai cấp, cấp 2 chọn loại Phân hiệu hoặc Điểm trường, Trường chính có lớp, nhãn cố định; chặn ngừng sử dụng đơn vị còn đơn vị con đang hoạt động (YCTD-38) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-38 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.0.

#### Vấn đề tồn đọng

- Viết mã phần 4.

### 2026-10-09 — DT-01 phần 3: năm học

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 3. Viết trên nhánh `dt-01-phan-3`.
- Cơ sở dữ liệu hệ thống: `0002_create_academic_year_tables` tạo `academic_years`, `academic_terms`, `school_weeks`, `academic_year_databases`, có chỉ mục bảo đảm chỉ một năm đang dùng. Cơ sở dữ liệu định danh: `0004_add_academic_year_permission` thêm `P01.academic-year.manage` cho VT-02.
- Tài khoản `api_service` có quyền tạo cơ sở dữ liệu; bỏ cơ sở dữ liệu năm học tạo tay trong Docker và biến `SCHOOL_YEAR_DATABASE_URL`; công cụ thay đổi cấu trúc chạy trên năm học đang dùng (QU-11).
- Máy chủ API: tạo năm học, lưu lịch, đánh số tuần, đánh dấu tuần nghỉ, mở năm học gồm kiểm tra, tạo cơ sở dữ liệu, chạy tệp thay đổi cấu trúc, chuyển dữ liệu, đóng năm cũ và chuyển sang chỉ đọc; khung bước chuyển năm học để các phân hệ sau tự thêm bước.
- Cổng quản trị: màn hình Năm học gồm MH-45 và MH-43; thêm `StatusBadge`, `ConfirmDialog`, `Toast` vào `packages/ui`.
- Kiểm thử giao diện chạy trên cơ sở dữ liệu hệ thống riêng `school_system_e2e` và cổng riêng, chuẩn bị lại trước mỗi lần chạy.
- Kết quả: máy chủ API 26/26 (gồm CTC-P01-013, 018, 099 đến 104 và khung kiểm tra, chuyển dữ liệu của CTC-P01-096, 097), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 5/5.

#### Quyết định

- Không có quyết định mới ngoài YCTD-37.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối năm học và trường `rule_code`; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.6.

#### Vấn đề tồn đọng

- CTC-P01-014 đến 017, 096 đến 098 cần dữ liệu trẻ và công nợ, chạy ở DT-03 và DT-05; CTC-P01-019 chạy khi có tệp thay đổi cấu trúc năm học thứ hai.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 3: năm học

#### Công việc đã thực hiện

- Đọc tài liệu cho phần 3, phát hiện mâu thuẫn giữa AC-194, CB-10 và BR-89, CTC-P01-096 đến 098 về việc năm cũ còn ghi được sau khi mở năm mới; trình Eric thiết kế phần 3.

#### Quyết định

- Mở năm học mới là đóng năm cũ trong một thao tác; lịch năm học sửa được cho tới khi đóng (YCTD-37) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-37 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.5.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 3.

### 2026-10-09 — DT-01 phần 2: kiểm tra mã phiên, quyền và màn hình đăng nhập

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 2. Viết trên nhánh `dt-01-phan-2`.
- Thêm gói `packages/server`: mô hình lỗi, bộ lọc lỗi, đồng hồ, kiểm tra mã phiên bằng khóa công khai; dịch vụ định danh chuyển sang dùng gói này.
- Dịch vụ định danh trả mã làm mới bằng cookie httpOnly, SameSite=Strict, Secure, đường dẫn `/api/v1/auth`; đăng xuất xóa cookie (BM-71).
- Máy chủ API: kiểm tra mã phiên ở mọi điểm cuối trừ kiểm tra sức khỏe; hỏi `GET /api/v1/auth/me` ở mỗi yêu cầu (QĐ-20); khai báo quyền cần có cho từng điểm cuối; trả phạm vi đơn vị của từng quyền; từ chối mã phiên còn bắt buộc đổi mật khẩu.
- Cổng quản trị: MH-47 Đăng nhập, MH-48 Đổi mật khẩu, khung trang điều hướng dọc bên trái, tự làm mới mã phiên, đăng xuất; thêm thành phần `Button`, `TextField`, `Alert` và mã màu theo `15` vào `packages/ui`.
- Thêm gói `tests` chạy Playwright; GitHub Actions sinh khóa tạm, cài Chromium và chạy kiểm thử giao diện.
- Kết quả: dịch vụ định danh 20/20, máy chủ API 9/9 (gồm CTC-DD-035, 036, 037, 041), cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 3/3; kiểm tra kiểu, quy tắc viết mã, định dạng đạt.

#### Quyết định

- Cookie mã làm mới áp dụng cho cả ba kênh trình duyệt – người quyết định: Eric.

#### Thay đổi

- Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.4.

#### Vấn đề tồn đọng

- CTC-DD-035 mới kiểm được phần từ chối ngay khi mất vai trò; phần thu hồi mã làm mới khi đổi quyền làm cùng điểm cuối gán vai trò ở phần 5. CTC-DD-041 kiểm lại khi có điểm cuối nghiệp vụ thật.
- Lớp đơn vị mới trả đơn vị được gán; mở rộng sang đơn vị con làm ở phần 4 khi có cây đơn vị.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 2

#### Công việc đã thực hiện

- Trình thiết kế phần 2: máy chủ API kiểm tra mã phiên và quyền, màn hình đăng nhập và đổi mật khẩu trên cổng quản trị.

#### Quyết định

- Mã làm mới lưu trong cookie httpOnly; thêm gói `packages/server`; điều hướng dọc bên trái; làm kiểm thử Playwright ngay (YCTD-36) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-36 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.3.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 2.

### 2026-10-09 — DT-01 phần 1: phần lõi dịch vụ định danh

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 1. Viết trên nhánh `dt-01-phan-1`.
- Cơ sở dữ liệu định danh: tệp thay đổi cấu trúc `0002_create_account_tables` tạo `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `security_events`; `0003_seed_roles_and_permissions` tạo 19 vai trò và 55 mã quyền theo ma trận ở `08` mục 3.
- Dịch vụ định danh: `login`, `refresh`, `logout`, `change-password`, `me`; băm mật khẩu argon2id; mã phiên ký Ed25519; mã làm mới đổi mới sau mỗi lần làm mới; tạm khóa 15 phút sau 5 lần sai; giới hạn 10 yêu cầu đăng nhập mỗi phút trên một địa chỉ mạng; mô hình lỗi kèm mã tương quan.
- Lệnh `create-platform-administrator` tạo tài khoản VT-01 đầu tiên; lệnh `generate-token-keys` sinh cặp khóa ký mã phiên.
- Kết quả: 19/19 kiểm thử của dịch vụ định danh đạt, gồm CTC-DD-001 đến 004, 007, 008, 009, 031 đến 034, 043; toàn bộ 24 kiểm thử của dự án đạt; kiểm tra kiểu, quy tắc viết mã, định dạng đạt.

#### Quyết định

- Không có quyết định mới ngoài YCTD-35.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối xác thực; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.2.

#### Vấn đề tồn đọng

- Kiểm thử để lại tài khoản kiểm thử trong cơ sở dữ liệu định danh của môi trường phát triển.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Kế hoạch đợt DT-01

#### Công việc đã thực hiện

- Đọc tài liệu cho đợt DT-01, phát hiện DT-01 phụ thuộc phần lõi dịch vụ định danh ở DT-02; trình Eric cách chia sáu phần.

#### Quyết định

- Gộp phần lõi dịch vụ định danh vào DT-01, làm theo sáu phần (YCTD-34) – người quyết định: Eric.
- QĐ-20, QĐ-21, QĐ-22 – người quyết định: Eric.
- Mật khẩu tối thiểu 8 ký tự có chữ và số; sai 5 lần tạm khóa 15 phút rồi tự mở; mã quyền theo phân hệ và hành động; tài khoản đầu tiên là VT-01 (YCTD-35) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-34, YCTD-35 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.0 đến 0.26.1.

#### Vấn đề tồn đọng

- Việc tiếp theo: trình thiết kế chi tiết DT-01 phần 1.

### 2026-10-09 — Qua cổng CG-08

#### Công việc đã thực hiện

- Eric đồng ý commit; đẩy nhánh `main` và `dt-00-nen-mong` lên GitHub sau khi Eric cấp quyền ghi.
- GitHub Actions chạy kiểm thử trên yêu cầu gộp số 1: đạt.
- Cài đặt sẵn công cụ `gh`; Eric đăng nhập bằng tài khoản `luckyshopvn`.
- Eric gộp yêu cầu gộp số 1 vào `main`. M01-3 hoàn thành, CG-08 đạt.

#### Quyết định

- Eric là người bấm gộp yêu cầu gộp vào `main` (QĐ-19).

#### Thay đổi

- Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.5.

#### Vấn đề tồn đọng

- Việc tiếp theo: trình thiết kế đợt DT-01 (`M01`). Các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — M01-3 nền móng kỹ thuật

#### Công việc đã thực hiện

- Eric duyệt thiết kế DT-00. Khởi tạo Git tại gốc dự án, nối kho https://github.com/luckyshopvn/school_management, làm trên nhánh `dt-00-nen-mong`.
- Dựng cấu trúc nhiều gói bằng pnpm theo `13` mục 4: `apps/api`, `apps/identity`, `apps/worker`, `apps/portal`, `apps/teacher`, `apps/parent`, `packages/shared`, `packages/ui`, `packages/config`, `database/`.
- Docker Compose chạy PostgreSQL 17 và Redis 7; tệp `docker/postgres/create-databases.sh` tạo ba cơ sở dữ liệu `school_identity`, `school_system`, `school_year_2026_2027` với hai tài khoản kết nối riêng.
- Tệp thay đổi cấu trúc đầu tiên của ba cơ sở dữ liệu đặt giờ Việt Nam; chạy bằng Kysely.
- GitHub Actions chạy kiểm tra định dạng, kiểm tra quy tắc viết mã, xây dựng, kiểm tra kiểu, chạy tệp thay đổi cấu trúc và kiểm thử.
- Kết quả trên máy: xây dựng, kiểm tra kiểu, kiểm tra quy tắc viết mã, kiểm tra định dạng đạt; tệp thay đổi cấu trúc chạy được trên ba cơ sở dữ liệu; 6/6 kiểm thử đạt: kiểm tra sức khỏe của `api` và `identity`, tệp thay đổi cấu trúc chạy hai lần không lỗi và đặt giờ Việt Nam trên ba cơ sở dữ liệu, tiến trình chạy nền kết nối Redis.

#### Quyết định

- Dùng TypeScript 6.0, NestJS 11, Vite 8, ESLint 10; không dùng TypeScript 7 và NestJS 12 vì vừa phát hành và chưa được các công cụ kiểm tra hỗ trợ.

#### Thay đổi

- `17` thêm điểm cuối `GET /api/v1/health`; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.4.

#### Vấn đề tồn đọng

- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Lịch năm học

#### Công việc đã thực hiện

- Eric cho biết năm học gồm hai học kỳ, bắt đầu khoảng 05/09, kết thúc khoảng tháng 5 năm sau; hỏi bốn điểm và trình thiết kế YCTD-30.
- Áp dụng YCTD-30 vào các tài liệu liên quan và thêm 15 ca vào bộ ca kiểm thử chi tiết.

#### Quyết định

- Tuần học gồm tự đánh số tuần, tuần nghỉ, ngày học trong tuần – người quyết định: Eric.
- Có kỳ hè riêng, đăng ký học hè theo từng tháng – người quyết định: Eric.
- Số phiếu thu, phiếu chi đánh theo năm học – người quyết định: Eric.
- Hiệu trưởng lập lịch năm học chung toàn trường – người quyết định: Eric.
- Đăng ký học hè đặt ở P05-13 vì gắn với tính học phí.
- Bỏ xác thực hai lớp (YCTD-31) – người quyết định: Eric.
- Chỉ dùng GitHub trước; Eric tự tạo kho riêng; môi trường phát triển chạy Docker trên máy cục bộ; GitHub Actions chỉ chạy kiểm thử; hạ tầng đám mây khi triển khai (YCTD-32) – người quyết định: Eric.
- Kho mã nguồn https://github.com/luckyshopvn/school_management; dùng Kysely (QĐ-18); nhánh theo việc, gộp qua yêu cầu gộp (QĐ-19); commit đứng tên thư công ty của Eric (YCTD-33) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-30 đến YCTD-33 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.0 đến 0.25.3.

#### Vấn đề tồn đọng

- Việc tiếp theo: Eric cài Docker Desktop; sau đó M01-3 dựng nền móng DT-00 để qua CG-08. Các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — N21 bộ ca kiểm thử chi tiết

#### Công việc đã thực hiện

- Lập thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`; viết đợt 1 `01_DINH_DANH_VA_P01.md`: 42 ca dịch vụ định danh, 98 ca P01, bảng truy xuất tiêu chí nghiệm thu.
- Phát hiện ba điểm căn cứ chưa rõ, ghi thành Q-147 đến Q-149, áp dụng câu trả lời theo YCTD-26.
- Viết đợt 2 `02_P02_VA_P04.md`: 68 ca P02, 43 ca P04, bảng truy xuất tiêu chí nghiệm thu.
- Viết đợt 3 `03_P05.md`: 62 ca P05; phát hiện Q-150, Q-151, áp dụng câu trả lời theo YCTD-27.
- Viết đợt 4 `04_P06.md`: 65 ca P06; phát hiện Q-152, áp dụng câu trả lời theo YCTD-28.
- Khi chuẩn bị đợt 5, Q-153 làm rõ lương trả trước đầu tháng; hỏi thêm Q-154 đến Q-156; trình và áp dụng YCTD-29.
- Viết đợt 5 `05_P08.md`: 59 ca P08 theo cách chi lương trả trước.

#### Quyết định

- Đợt 1 `01_DINH_DANH_VA_P01.md`, đợt 2 `02_P02_VA_P04.md`, đợt 3 `03_P05.md`, đợt 4 `04_P06.md` và đợt 5 `05_P08.md` phiên bản 1.0 được phê duyệt; N21 hoàn thành – người quyết định: Eric.
- N21 chỉ viết cho chức năng giai đoạn 1, đặt ở thư mục 27, mã `CTC-...`, chia năm đợt và duyệt từng đợt – người quyết định: Eric.
- Q-147: phụ huynh chưa đổi mật khẩu mặc định vẫn đăng nhập bằng mã một lần và dùng bình thường – người quyết định: Eric.
- Q-148: người được đặt lại mật khẩu bắt buộc đổi ở lần đăng nhập kế tiếp – người quyết định: Eric.
- Q-149: công nợ của trẻ đã thôi học không chuyển sang năm mới; chặn đóng năm khi còn nợ loại này – người quyết định: Eric.
- Q-150: đăng ký trễ thu theo ngày thực tế tính từ ngày bắt đầu học dịch vụ – người quyết định: Eric.
- Q-151: còn ngày chưa chốt điểm danh thì chặn tính học phí – người quyết định: Eric.
- Q-152: thủ quỹ chọn hóa đơn và phân bổ khi lập phiếu thu tiền mặt – người quyết định: Eric.
- YCTD-29: lương trả trước đầu tháng, điều chỉnh theo công tháng trước; tháng trước chưa chốt công thì chặn tính lương; nhân sự mới không trả trước tháng đầu; nghỉ việc lập bảng quyết toán; vẫn chặn chốt công khi còn đơn chờ duyệt (Q-153 đến Q-156) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-26 đến YCTD-29 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.23.0 đến 0.24.1.

#### Vấn đề tồn đọng

- N21 hoàn thành. Việc tiếp theo: M01-3 tạo kho mã nguồn và ba môi trường để qua CG-08; các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — Rà duyệt từng tài liệu

#### Công việc đã thực hiện

- Rà `04_TONG_QUAN_DU_AN.md`: sửa cây đơn vị không giới hạn cấp, bỏ nhắc ứng lương, cập nhật nhóm đối tượng theo vai trò mới, cập nhật tích hợp bên ngoài.
- Rà `05_PHAM_VI.md`: bổ sung vào giai đoạn 1 các chức năng đã gắn G1 ở tài liệu 10 (G1-17 API cho đối tác, G1-18 nhập mã định danh, làm thêm giờ, hạn mức, năm học, chuyển đơn vị, nhật ký của bé); sửa đơn vị của trẻ theo QĐ-14; cập nhật mục chưa xác minh theo Q-02, Q-08, Q-09.
- Rà `06_YEU_CAU_NGHIEP_VU.md`: sửa cây đơn vị, QTN-03 theo BR-23, QTN-12 theo Q-09, thêm vai trò mới vào các nghiệp vụ, cập nhật mục chưa xác minh; phát hiện dịch vụ học thứ bảy mâu thuẫn với lịch học bù, áp dụng YCTD-16.
- Rà `07_QUY_TAC_NGHIEP_VU.md`: sửa BR-01, BR-03, BR-20, BR-24, BR-46, BR-53, BR-73, BR-77, trạng thái đơn nghỉ phép, mục chưa xác minh; sửa ma trận quyền phân hệ Y tế; đồng bộ phiên bản quy trình QT-01, QT-02, QT-04, QT-06 trong mục lục (mục lục ghi thấp hơn tệp).
- Rà `08_VAI_TRO_NGUOI_DUNG.md`: ma trận thêm quyền duyệt của quản lý đơn vị ở P02, P08 và quyền đăng nhập của VT-19, VT-20 ở P19; thêm ghi chú lịch nghỉ thứ 7, nhập dữ liệu ban đầu; PQ-03 và phạm vi toàn trường của VT-19, VT-20; bảng phê duyệt có ngoại lệ hoàn tiền; cập nhật mục chưa xác minh. BR-01 ở tài liệu 07 sửa theo.
- Rà `09_LUONG_NGHIEP_VU.md`: nhân sự chốt công; không chặn trẻ đi học khi nợ; đăng ký giữa tháng theo BR-26; LP-11, LP-12 gắn P13; mất mạng theo Q-09; sửa sơ đồ luồng; thêm thủ quỹ; cập nhật mục chưa xác minh.
- Rà `10_YEU_CAU_CHUC_NANG.md`: sửa người dùng, quy tắc và bước phê duyệt của P01-01, P01-08, P02-03, P02-08, P04-01, P05-02, P05-03, P05-07, P05-08, P06-01, P06-04, P06-05, P08-03, P08-04, P08-06, P08-08, P17-01, P18-01, P18-03, P19-01, P19-06; cập nhật mục chưa xác minh.
- Rà `11_TIEU_CHI_NGHIEM_THU.md`: sửa AC-26, AC-29, AC-41, AC-43, AC-58, AC-89, AC-147, AC-166, AC-180; thêm AC-206 đến AC-209 và CT-162 đến CT-165; phát hiện công thức suất ăn trừ hai lần, áp dụng YCTD-20.
- Rà `12_KIEN_TRUC_HE_THONG.md`: định danh dùng cơ sở dữ liệu riêng; sơ đồ thêm đối tác, cơ sở dữ liệu theo năm học và cơ sở dữ liệu định danh; phạm vi đơn vị theo YCTD-18; nhật ký nhạy cảm theo BR-73; thêm CB-09, CB-10; sao lưu gồm mọi cơ sở dữ liệu; cập nhật mục chưa xác minh.
- Rà `13_CONG_NGHE_SU_DUNG.md`: đổi tên mục 2 thành công nghệ đã chốt; tách thư mục `database/` theo định danh và năm học; thêm QU-11; cập nhật mục chưa xác minh.
- Rà `14_DAC_TA_GIAO_DIEN.md`: sửa vai trò ở MH-05, MH-07, MH-09, MH-10, MH-11, MH-13, MH-15, MH-28, MH-29, MH-30; MH-32 theo QĐ-14; đặt nhập mã ngành, buffet, đồng ý hình ảnh vào màn hình sẵn có; sửa BC-01, BC-08, XL-05; bỏ mục xe trong sơ đồ; cập nhật mục chưa xác minh.
- Rà `15_HE_THONG_THIET_KE.md`: nâng mọi cỡ chữ lên tối thiểu 14 theo Q-89; ghi mức tương phản 4,5:1; nút chính nền cam dùng chữ tối; thêm TD-16, TD-17, MC-06; TD-14 theo Q-119; cập nhật mục chưa xác minh.
- Rà `16_CO_SO_DU_LIEU.md`: phân ba loại cơ sở dữ liệu; giữ nguyên mã khi mở năm học; thêm `sessions`, `one_time_codes`, `class_staff_assignments`, `teaching_groups`, `teaching_group_members`; thêm cột cho trẻ con nhân viên, phiếu chi, nhật ký truy cập; hóa đơn chính và bổ sung; bỏ bảng trống ở mục P11; cập nhật mục chưa xác minh.
- Rà `17_DAC_TA_API.md`: thêm điểm cuối duyệt và từ chối giảm trừ, phiếu điều chỉnh, mở lại kỳ công, đề nghị mua hàng, hồ sơ tuyển sinh; thêm điểm cuối phân công giáo viên, tổ chuyên môn, đề nghị mua thuốc, phỏng vấn, ẩn bình luận; ghi khóa API do dịch vụ định danh quản lý; thêm KT-09; bỏ bảng trống mục xe; cập nhật mục chưa xác minh.
- Rà `18_QUY_TAC_PHAT_TRIEN_AI.md`: thêm AI-41 về cơ sở dữ liệu theo năm học, AI-42 về quyết định kiến trúc; AI-13 dẫn BR-81; mục 6 dùng tên trạng thái của quy trình; AI-10 bỏ từ tiếng Anh.
- Rà `19_CHI_DAN_HE_THONG_AI.md`: cập nhật ngữ cảnh theo QĐ-14 đến QĐ-17 và thư mục 26; câu lệnh hệ thống bỏ từ tiếng Anh, thêm ngoại lệ hạn mức và nguyên tắc 17; bảng quy ước mã bỏ dạng không dùng và thêm mười bốn nhóm tiền tố.
- Rà `20_KE_HOACH_KIEM_THU.md`: thêm PV-13 đến PV-15 cho API đối tác, cơ sở dữ liệu theo năm học, nhập dữ liệu; bổ sung phạm vi đăng nhập, thanh toán mã QR, công việc, tuyển dụng; dữ liệu kiểm thử theo GD-79 và thêm DL-11 đến DL-13; đưa câu trả lời Q-101 đến Q-104 vào nội dung; bỏ mục chưa xác minh đã lỗi thời.
- Rà `21_KICH_BAN_KIEM_THU.md`: sửa CT-007, CT-021, CT-031, CT-049, CT-067, CT-082, CT-089, CT-150 cho khớp quy tắc và tiêu chí nghiệm thu; thêm AC-211 và CT-167 cho khóa API đã thu hồi; AC-194 thêm giữ nguyên mã định danh, tài liệu 11 lên phiên bản 1.1; cập nhật mục chưa xác minh.
- Rà `22_BAO_MAT.md`: BM-17 thêm Ban Giám hiệu theo BR-53; chuyển BM-61 đến BM-69 khỏi mục giám sát về đúng mục; BM-05 ghi thời hạn phiên theo Q-120; BM-19 ghi hai trường hợp luôn ghi nhật ký; BM-42 khớp SL-01 đến SL-04; SL-01 thêm cơ sở dữ liệu hệ thống, tài liệu 12 lên phiên bản 1.1; thêm BM-70 thời hạn lưu nhật ký và dòng trách nhiệm bên thứ ba; bỏ mục chưa xác minh đã lỗi thời.
- Rà `23_LICH_SU_PHIEN_BAN.md`: hạ cấp tiêu đề các mục phiên bản từ 0.4.0; quy ước 2 dùng tên mục "thay đổi API"; quy ước 5 ghi lý do giữ tên tệp cũ; `index.md` sửa phạm vi tài liệu 24 thành YCTD-01 đến YCTD-22.
- Rà `01_KE_HOACH_TONG_THE.md`: cập nhật mô tả sản phẩm, mốc 1.0.0 và 1.1.0, trạng thái cổng, phạm vi mã; tên trạng thái theo quy trình; bỏ nội dung chờ duyệt và mục chưa xác minh đã lỗi thời; xếp năm chức năng giai đoạn 1 mới vào đợt; RR-07 theo kịch bản hiệu năng của tài liệu 20.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md`: bước 2 nhập số định danh, giấy khai sinh và từ chối trùng số định danh khi lưu; số điện thoại đã có tài khoản thì gắn phụ huynh có sẵn theo BR-08, thay cho chặn; bỏ chữ kích hoạt tài khoản và quy trình tiếp nhận lại không tồn tại; thêm AC-201.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-02_DIEM_DANH_BAO_VANG.md`: BR-56 chép đủ vế phụ huynh xác nhận người đón ngoài danh sách, sửa E6 và sơ đồ; thêm ngày học bù thứ 7 theo BR-84; thêm Ban Giám hiệu vào tác nhân; gộp dòng dữ liệu trùng, thêm ảnh bàn giao tùy chọn; quản lý đơn vị được chốt và sửa sau chốt, tài liệu 08 thêm ghi chú 15 và lên phiên bản 1.1.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-03_DANG_KY_DICH_VU_VA_TINH_HOC_PHI.md`: đăng ký trễ chờ Ban Giám hiệu duyệt và lập hóa đơn bổ sung cùng kỳ thay cho phát sinh kỳ sau; AC-29 chép theo bản đã sửa; biểu phí dùng chung toàn trường; thêm kiểm tra bán trú bắt buộc và chặn khi nợ quá hạn; quản lý đơn vị chỉ xem; Hiệu trưởng duyệt khi chưa cấu hình hạn mức; ràng buộc chống trùng áp cho hóa đơn chính.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-04_THU_HOC_PHI_VA_CONG_NO.md`: thêm thủ quỹ; luồng lỗi thanh toán mã QR E10, E11 và AC-186 đến AC-189; nhắc nợ ghi rõ giai đoạn 2; phiếu đảo chờ Ban Giám hiệu duyệt; xử lý công nợ quá hạn qua P05-12 (YCTD-23).
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-05_PHIEU_CHI_VA_QUY.md`: AC-37 theo BR-34 bắt buộc; thêm thủ quỹ và kế toán trưởng lập phiếu; phiếu chi hoàn tiền và loại chưa cấu hình hạn mức do Hiệu trưởng duyệt; phiếu đảo phiếu chi chờ Ban Giám hiệu duyệt (YCTD-24); thêm loại phiếu chi, khoản mục, nhiều quỹ; ghi rõ giai đoạn của từng phần.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-06_CHAM_CONG_VA_TINH_LUONG.md`: thêm tiền làm thêm giờ vào bước tính lương; nhân sự đề nghị và Ban Giám hiệu duyệt mở lại kỳ công; chốt công áp lịch nghỉ lễ, nghỉ thứ 7 và học bù (BR-84); phiếu chi loại lương trình duyệt theo QT-05; Hiệu trưởng duyệt khi chưa cấu hình hạn mức; thêm MH-44; chép AC-41, AC-43, AC-46 theo bản mới.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-07_DAN_THUOC_VA_CHAM_SOC_SUC_KHOE.md`: áp dụng YCTD-25: giáo viên chủ nhiệm nhận thuốc khi đơn vị không có nhân viên y tế, ảnh thuốc bắt buộc, chăm sóc hằng ngày P10-12, phụ huynh xác nhận đã biết; thêm Ban Giám hiệu vào tác nhân; GD-32 không còn hiệu lực.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-09_NHAT_KY_VA_TRAO_DOI.md`: bỏ chữ kích hoạt tài khoản; ghi nhật ký thuộc giai đoạn 1, trao đổi và góp ý thuộc giai đoạn 2; quản lý đơn vị sửa nhật ký quá hạn theo Q-67, ghi chú 15 của tài liệu 08 mở rộng và lên phiên bản 1.4.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md`: Ban Giám hiệu duyệt, ẩn và công bố lại hoạt động theo ma trận và Q-72, P14-02 thêm VT-15, VT-02; ẩn bình luận vi phạm kèm lý do (Q-70); tự ẩn hình khi phụ huynh rút đồng ý (BR-65, AC-190); giới hạn ảnh theo Q-71; ghi giai đoạn; tài liệu 17 thêm điểm cuối ẩn và công bố lại hoạt động.

#### Quyết định

- `04_TONG_QUAN_DU_AN.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `05_PHAM_VI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `06_YEU_CAU_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- Bỏ dịch vụ học thứ bảy; thứ bảy chỉ có lịch học bù chung toàn trường do Ban Giám hiệu lập – người quyết định: Eric (YCTD-16).
- `07_QUY_TAC_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt; dữ liệu sức khỏe chỉ cho giáo viên chủ nhiệm, y tế, Ban Giám hiệu, quản lý đơn vị, kế toán và phụ huynh; hoàn tiền khi trẻ thôi học luôn do Hiệu trưởng phê duyệt – người quyết định: Eric (YCTD-17).
- `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.0 được phê duyệt; kiểm toán viên luôn xem số liệu toàn trường (Q-145) – người quyết định: Eric (YCTD-18).
- `09_LUONG_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `10_YEU_CAU_CHUC_NANG.md` phiên bản 1.0 được phê duyệt; phiếu chi và quỹ tiền mặt chuyển sang giai đoạn 1 – người quyết định: Eric (YCTD-19).
- `11_TIEU_CHI_NGHIEM_THU.md` phiên bản 1.0 được phê duyệt; trường không có bữa tối; ba bữa sáng, trưa, xế thuộc bán trú; số suất bằng số trẻ có mặt; buffet là tiệc theo dịp không thu riêng – người quyết định: Eric (YCTD-20).
- `12_KIEN_TRUC_HE_THONG.md` phiên bản 1.0 được phê duyệt; chốt QĐ-01, QĐ-03, QĐ-05 – người quyết định: Eric.
- `13_CONG_NGHE_SU_DUNG.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `14_DAC_TA_GIAO_DIEN.md` phiên bản 1.0 được phê duyệt; nhân sự tự phục vụ ở cả hai kênh, thêm MH-44 (Q-146) – người quyết định: Eric (YCTD-21).
- `15_HE_THONG_THIET_KE.md` phiên bản 1.0 được phê duyệt; mọi cỡ chữ tối thiểu 14 điểm ảnh – người quyết định: Eric.
- `16_CO_SO_DU_LIEU.md` phiên bản 1.0 được phê duyệt; khoản phát sinh sau phát hành lập hóa đơn bổ sung cùng kỳ (BR-85); khóa API đặt ở cơ sở dữ liệu định danh, danh sách năm học đặt ở cơ sở dữ liệu hệ thống (QĐ-17) – người quyết định: Eric (YCTD-22).
- `17_DAC_TA_API.md` phiên bản 1.0 được phê duyệt; không thêm chức năng tự lấy lại mật khẩu – người quyết định: Eric.
- `18_QUY_TAC_PHAT_TRIEN_AI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `19_CHI_DAN_HE_THONG_AI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `20_KE_HOACH_KIEM_THU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `21_KICH_BAN_KIEM_THU.md` phiên bản 1.0 được phê duyệt; thêm ca kiểm thử khóa API đã thu hồi – người quyết định: Eric.
- `22_BAO_MAT.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `23_LICH_SU_PHIEN_BAN.md` đã rà duyệt, giữ trạng thái Đang cập nhật theo quy định của `index.md` – người quyết định: Eric.
- `01_KE_HOACH_TONG_THE.md` phiên bản 1.0 được phê duyệt; G1-15 đến G1-19 xếp vào DT-00, DT-03, DT-05, DT-06, DT-07 theo phân hệ; kiểm thử hiệu năng theo dữ liệu môi trường thử nghiệm của tài liệu 20, không dùng dữ liệu gấp năm lần – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md` phiên bản 1.3 được phê duyệt; phụ huynh nhiều con dùng một tài khoản – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-02_DIEM_DANH_BAO_VANG.md` phiên bản 1.4 được phê duyệt; quản lý đơn vị được chốt điểm danh ngày và sửa điểm danh đã chốt kèm lý do, ma trận P04 của VT-03 thành X, S – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-03_DANG_KY_DICH_VU_VA_TINH_HOC_PHI.md` phiên bản 1.7 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-04_THU_HOC_PHI_VA_CONG_NO.md` phiên bản 1.3 được phê duyệt; phiếu đảo phiếu thu do Ban Giám hiệu duyệt theo hạn mức; xử lý công nợ quá hạn do Ban Giám hiệu quyết, thêm P05-12 ở giai đoạn 2 (YCTD-23) – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-05_PHIEU_CHI_VA_QUY.md` phiên bản 1.2 được phê duyệt; phiếu đảo phiếu chi do Ban Giám hiệu duyệt theo hạn mức (YCTD-24) – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-06_CHAM_CONG_VA_TINH_LUONG.md` phiên bản 1.4 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-07_DAN_THUOC_VA_CHAM_SOC_SUC_KHOE.md` phiên bản 1.2 được phê duyệt; bổ sung nội dung gửi thuốc và chăm sóc sức khỏe theo YCTD-25, giữ giai đoạn 2: giáo viên nhận thuốc theo cấu hình đơn vị, ảnh thuốc bắt buộc và đơn tùy chọn, chăm sóc hằng ngày, phụ huynh xác nhận đã biết chỉ hiển thị trạng thái – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-09_NHAT_KY_VA_TRAO_DOI.md` phiên bản 1.1 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md` phiên bản 1.1 được phê duyệt; hoàn tất rà duyệt các đặc tả QT, CG-03 đạt – người quyết định: Eric.

#### Thay đổi

- `04_TONG_QUAN_DU_AN.md`, `05_PHAM_VI.md`, `06_YEU_CAU_NGHIEP_VU.md`, `index.md`.
- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-16 đến YCTD-25 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.13.0 đến 0.22.2.

#### Vấn đề tồn đọng

- Rà duyệt toàn bộ tài liệu đã xong; CG-01 đến CG-07 đã đạt.
- Việc tiếp theo: N21 viết bộ ca kiểm thử chi tiết; M01-3 tạo kho mã nguồn và ba môi trường để qua CG-08; các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — Xử lý hết giả định

#### Công việc đã thực hiện

- N22: hỏi Eric năm lượt (lượt 17 đến lượt 21) về giả định và các điểm cần làm rõ; cập nhật trạng thái toàn bộ 92 giả định; áp dụng các quyết định mới.
- Kiểm tra bằng truy vấn văn bản: không còn câu hỏi mở, không còn giả định chờ xác nhận, không còn quy tắc ghi chờ xác nhận; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Nhân sự chốt công; bán trú bắt buộc; đăng ký trễ do Ban Giám hiệu duyệt; trẻ nhận diện bằng số định danh và mã ngành; tài khoản phụ huynh dùng mật khẩu mặc định chung; không chia mốc trong ngày – người quyết định: Eric (YCTD-15).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-15 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.12.0.

#### Vấn đề tồn đọng

- Eric phê duyệt bộ tài liệu `04` đến `23` để qua các cổng CG-01 đến CG-07 – trạng thái: chờ xác nhận.
- N21: viết bộ ca kiểm thử chi tiết cho bốn nhóm phân hệ – trạng thái: chưa bắt đầu.
- RR-14: mật khẩu mặc định chung là rủi ro bảo mật đã được ghi nhận – trạng thái: chấp nhận theo quyết định của Eric.

### 2026-10-09 — Trả lời toàn bộ câu hỏi mở

#### Công việc đã thực hiện

- N20: hỏi Eric tám lượt (lượt 9 đến lượt 16), dùng hình thức tích chọn đề xuất cho các câu có đề xuất hợp lý và hỏi riêng các câu không được chọn; áp dụng câu trả lời vào toàn bộ bộ tài liệu.
- Sự cố khi chạy script phần A: lệnh khôi phục tự động xóa nội dung thư mục `tai_lieu` nhưng không chép lại được vì thư mục đang được dùng. Đã chép lại từ bản sao lưu ngay trước khi chạy, đối chiếu khớp hoàn toàn rồi chạy lại. Đã đổi cách chạy: script chạy trong tiến trình con và khôi phục chỉ xóa nội dung bên trong thư mục.
- Kiểm tra bằng truy vấn văn bản: không còn câu hỏi mở; không còn tham chiếu xe đưa đón ngoài các dòng ghi đã bỏ; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Bỏ phân hệ xe đưa đón; thêm năm vai trò; cây đơn vị không giới hạn cấp; mỗi năm học một cơ sở dữ liệu; API chỉ đọc cho đối tác ngay giai đoạn 1; tiền làm thêm giờ tối đa 1 giờ mỗi ngày; AI phải xin xác nhận trước mọi thay đổi mã nguồn; cùng các quyết định khác ở YCTD-14 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-14 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.11.0.

#### Vấn đề tồn đọng

- 85 giả định chưa xác nhận – trạng thái: chờ xác nhận.
- N21: viết bộ ca kiểm thử chi tiết cho bốn nhóm phân hệ – trạng thái: chưa bắt đầu.

### 2026-10-09 — Chốt các quyết định lượt 8

#### Công việc đã thực hiện

- N19: áp dụng câu trả lời lượt 8; bỏ chức năng ứng lương theo yêu cầu, giữ mã kèm ghi chú; cập nhật quy tắc quỹ tiền mặt, đồng ý hình ảnh, số định danh của trẻ.
- Kiểm tra bằng truy vấn văn bản: không còn tham chiếu ứng lương ngoài các dòng ghi "Bỏ ngày 09/10/2026"; đếm lại câu hỏi mở, giả định, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Không cho ứng lương; lương trả một lần mỗi tháng – người quyết định: Eric (Q-54, Q-56).
- Quỹ tiền mặt không âm, bắt buộc – người quyết định: Eric (Q-19).
- Đồng ý hình ảnh trên ứng dụng hoặc giấy ký tay, rút lại được – người quyết định: Eric (Q-20).
- Lưu số định danh và giấy khai sinh của trẻ, che với vai trò không cần – người quyết định: Eric (Q-35, Q-37).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-13 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.10.0.

#### Vấn đề tồn đọng

- GD-88, GD-89 mới – trạng thái: chờ xác nhận.
- 76 câu hỏi mở và 84 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 6 và lượt 7

#### Công việc đã thực hiện

- N18: áp dụng câu trả lời lượt 6 và lượt 7; thêm P01-13, P06-11 cùng dữ liệu, điểm cuối, màn hình, biện pháp bảo mật, tiêu chí và ca kiểm thử; đổi quy tắc thu tiền sang luôn trả đủ.
- Kiểm tra bằng truy vấn văn bản: đếm lại chức năng, bảng, màn hình, câu hỏi mở, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Nhập dữ liệu ban đầu từ Excel ở giai đoạn 1 – người quyết định: Eric (Q-02).
- Zalo để giai đoạn 3 – người quyết định: Eric (Q-05).
- Mốc nhắc nợ mặc định 3, 7, 15 ngày, cấu hình được – người quyết định: Eric (Q-11, Q-45).
- Thanh toán trực tuyến bằng chuyển khoản mã QR có xác nhận tự động ở giai đoạn 1 – người quyết định: Eric (Q-48, Q-81).
- Luôn phải trả đủ – người quyết định: Eric (Q-47).
- Quản lý đơn vị không xem bảng lương – người quyết định: Eric (Q-23).
- Hiệu trưởng và kế toán trưởng cùng nghiệm thu – người quyết định: Eric (Q-129).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-12 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.9.0.

#### Vấn đề tồn đọng

- Q-142: chọn nhà cung cấp tin nhắn và dịch vụ xác nhận chuyển khoản; cần trước khi nghiệm thu P19-06 và P06-11 – trạng thái: chờ xác nhận.
- 82 câu hỏi mở và 82 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 4 và lượt 5

#### Công việc đã thực hiện

- N16: áp dụng câu trả lời lượt 4 và lượt 5; đổi điểm danh sang một lần mỗi ngày trên toàn bộ tài liệu; thêm đăng nhập bằng mã một lần cho phụ huynh; chốt hạ tầng và nơi lưu mã nguồn.
- Kiểm tra bằng truy vấn văn bản: không còn tham chiếu điểm danh theo buổi; đếm lại câu hỏi mở, giả định, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Git trên GitHub kèm tích hợp và triển khai tự động từ đợt DT-00 – người quyết định: Eric (Q-130).
- Máy chủ đám mây trong nước, dữ liệu lưu tại Việt Nam – người quyết định: Eric (Q-74, Q-76).
- Phụ huynh đăng nhập bằng mật khẩu hoặc mã một lần – người quyết định: Eric (Q-24, Q-117).
- Ứng dụng phụ huynh và giáo viên dạng web ở giai đoạn 1 – người quyết định: Eric (Q-04).
- Điểm danh một lần mỗi ngày – người quyết định: Eric (Q-38).
- Đi muộn hoặc về sớm vẫn tính đủ ngày ăn – người quyết định: Eric (Q-39).
- Chốt công và học phí ngày cuối tháng – người quyết định: Eric (Q-25).
- Chặn đăng ký dịch vụ khi nợ quá hạn cấu hình theo đơn vị – người quyết định: Eric (Q-27, Q-46).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-11 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.8.0.

#### Vấn đề tồn đọng

- T1: chọn nhà cung cấp tin nhắn, cần cho thông báo và đăng nhập bằng mã một lần – trạng thái: chờ xác nhận.
- T6: thuê máy chủ đám mây trong nước – trạng thái: chờ xác nhận.
- 93 câu hỏi mở và 82 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 3

#### Công việc đã thực hiện

- N15: áp dụng câu trả lời lượt 3; thêm P05-11, P08-11 cùng bảng dữ liệu, điểm cuối, tiêu chí nghiệm thu và ca kiểm thử.
- Kiểm tra bằng truy vấn văn bản: đếm lại câu hỏi mở, chức năng, bảng, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp – người quyết định: Eric (Q-140).
- Học phí chính khóa cấu hình được, mức có thể bằng không – người quyết định: Eric (Q-141).
- Mức miễn giảm do nhà trường tự cấu hình – người quyết định: Eric (Q-16).
- Danh mục khấu trừ và số ngày phép năm do nhà trường tự cấu hình – người quyết định: Eric (Q-17, Q-18).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-10 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.7.0.

#### Vấn đề tồn đọng

- Không còn việc xây dựng nào bị chặn bởi câu hỏi nghiệp vụ. Còn 105 câu hỏi mở, 85 giả định chưa xác nhận và việc Eric phê duyệt bộ tài liệu – trạng thái: chờ xác nhận.
- Q-130: hệ thống quản lý phiên bản mã nguồn – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định ưu tiên lượt 1 và lượt 2

#### Công việc đã thực hiện

- N14: hỏi Eric hai lượt câu hỏi ưu tiên, áp dụng câu trả lời vào quy tắc nghiệp vụ, phạm vi, kiến trúc, công nghệ, dữ liệu, quy trình QT-02, QT-03, QT-05, kế hoạch tổng thể và danh sách công việc.
- Kiểm tra bằng truy vấn văn bản: đếm lại câu hỏi mở và giả định; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Phương án lưu trữ A – người quyết định: Eric (Q-77).
- Bộ công nghệ đề xuất – người quyết định: Eric (Q-79).
- Học phí giữa tháng theo ngày học thực tế – người quyết định: Eric (Q-14, Q-41).
- Lập sổ kế toán kép ở giai đoạn 3 – người quyết định: Eric (Q-01, Q-51).
- Chưa đặt mức hạn mức, cấu hình sau – người quyết định: Eric (Q-112, Q-26).
- Nhà trường tự tạo cây đơn vị; các đơn vị dùng chung biểu phí – người quyết định: Eric (Q-113, Q-122).
- Tiền ăn thu theo ngày ăn thực tế – người quyết định: Eric (Q-15, Q-43).
- Đồng ý cách xếp ba giai đoạn – người quyết định: Eric (Q-07).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-09 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.6.0.

#### Vấn đề tồn đọng

- Q-140: sổ kế toán kép theo chế độ kế toán nào; trường công lập thường áp dụng chế độ kế toán hành chính, sự nghiệp, khác Thông tư 99/2025/TT-BTC dành cho doanh nghiệp – trạng thái: chờ xác nhận.
- Q-16: mức miễn giảm và thẩm quyền, đang chặn M05 – trạng thái: chờ xác nhận.
- Q-17, Q-18: danh mục khấu trừ và số ngày phép năm, đang chặn M08 – trạng thái: chờ xác nhận.

### 2026-10-09 — Trả lời Q-139 và xác nhận GD-86

#### Công việc đã thực hiện

- N13: cập nhật P14-11; thêm AC-175, CT-131; đánh dấu GD-86 đã xác nhận.
- Kiểm tra bằng truy vấn văn bản: không có lỗi bảng, liên kết hỏng hay khối mã lẻ; đếm lại câu hỏi mở và giả định.

#### Quyết định

- Phí ngoại khóa thu theo tháng không giảm trừ khi trẻ nghỉ buổi hoặc thôi giữa tháng – người quyết định: Eric (Q-139).
- Lịch nghỉ thứ 7 và lịch học bù áp dụng cho mọi nhân sự của đơn vị – người quyết định: Eric (GD-86).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-08 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.3.

#### Vấn đề tồn đọng

- 126 câu hỏi mở và 85 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Bổ sung điểm cuối cho phân hệ Giảng dạy

#### Công việc đã thực hiện

- N12: thêm mục 7 Giảng dạy với mười tám điểm cuối vào `17_DAC_TA_API.md`; thêm bảng `class_activity_schedules` cho P03-07.
- Kiểm tra bằng truy vấn văn bản: không có lỗi bảng, liên kết hỏng hay khối mã lẻ; không tài liệu nào trỏ tới số mục cũ từ 7 trở đi của `17_DAC_TA_API.md`.

#### Quyết định

- Bổ sung điểm cuối cho phân hệ Giảng dạy – người quyết định: Eric (YCTD-07).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-07 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.2.

#### Vấn đề tồn đọng

- Q-139 và GD-86 – trạng thái: chờ xác nhận.
- Vấn đề thiếu điểm cuối P03 ghi ở hai mục nhật ký trước – trạng thái: đã xử lý.

### 2026-10-09 — Áp dụng câu trả lời Q-136 đến Q-138

#### Công việc đã thực hiện

- N11: cập nhật P08-10, P10-11, P14-10, P14-11 cùng dữ liệu, tiêu chí nghiệm thu và ca kiểm thử liên quan.
- Kiểm tra bằng truy vấn văn bản: đếm lại mã câu hỏi, giả định, tiêu chí và ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Tiêu chuẩn sức khỏe theo Bộ Y tế – người quyết định: Eric (Q-136).
- Hoạt động ngoại khóa thu phí theo từng hoạt động hoặc theo tháng – người quyết định: Eric (Q-137).
- Nghỉ thứ bảy định kỳ, trừ lịch học bù – người quyết định: Eric (Q-138).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-06 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.1.

#### Vấn đề tồn đọng

- Q-139: phí ngoại khóa theo tháng có giảm trừ khi trẻ nghỉ không – trạng thái: chờ xác nhận.
- GD-86: lịch nghỉ thứ 7 và học bù áp dụng cho mọi nhân sự của đơn vị – trạng thái: chờ xác nhận.
- `17_DAC_TA_API.md` chưa có nhóm điểm cuối cho phân hệ P03 Giảng dạy – trạng thái: chờ xác nhận.

### 2026-10-09 — Bổ sung chức năng theo tám ảnh sơ đồ chức năng

#### Công việc đã thực hiện

- N10: đối chiếu tám ảnh sơ đồ chức năng với danh sách chức năng, tìm ra mười hai nhóm mục còn thiếu; bổ sung hai mươi chức năng cùng tiêu chí nghiệm thu, ca kiểm thử, bảng dữ liệu, điểm cuối, màn hình và phạm vi.
- N10: lưu tám ảnh vào `26_SO_DO_CHUC_NANG/`.
- N10: sửa số liệu ghi nhầm về số chức năng và số bảng dữ liệu.
- Kiểm tra bằng truy vấn văn bản: đếm lại chức năng, bảng, màn hình, mã câu hỏi và giả định; không có liên kết hỏng, hàng bảng thiếu dấu `|`, khối mã lẻ.

#### Quyết định

- Bổ sung cả mười hai nhóm mục từ ảnh vào phạm vi, theo giai đoạn đề xuất – người quyết định: Eric (YCTD-05).
- Lưu tám ảnh sơ đồ chức năng vào dự án – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-05 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.0.

#### Vấn đề tồn đọng

- Q-136, Q-137, Q-138 – trạng thái: chờ xác nhận.
- `17_DAC_TA_API.md` chưa có nhóm điểm cuối cho phân hệ P03 Giảng dạy (bài học, giáo án, thời khóa biểu) – trạng thái: chờ xác nhận.

### 2026-10-09 — Chuyển sang quy trình Vibecoding_Flow và sửa các chỗ chưa khớp

#### Công việc đã thực hiện

- N9: chuyển bộ tài liệu từ `tai-lieu-thiet-ke/` sang `tai_lieu/`, đổi tên và đánh số lại theo Vibecoding_Flow, đổi phần đầu tài liệu sang mẫu mới, gộp mục lục quy trình vào `index.md`, tạo `24_YEU_CAU_THAY_DOI.md`.
- N9: sửa các chỗ chưa khớp: thuật ngữ cũ trong sơ đồ, số câu hỏi mở và giả định cũ, trạng thái mốc 0.3.0, số ứng dụng giao diện trong `13_CONG_NGHE_SU_DUNG.md`, bảng trỏ tới AC-94 đến AC-134 trong `11_TIEU_CHI_NGHIEM_THU.md`.
- N9: thống nhất phân cấp phê duyệt theo quyết định của Eric.
- Kiểm tra bằng truy vấn văn bản: không còn tên tệp cũ ngoài các mục lịch sử và bảng đối chiếu; không còn thuật ngữ "cơ sở" theo nghĩa đơn vị và "Chủ trường"; không có liên kết hỏng, hàng bảng thiếu dấu `|`, khối mã lẻ; có đủ 135 mã câu hỏi mở, sáu mã đã trả lời; đủ 84 giả định.

#### Quyết định

- Chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow – người quyết định: Eric (YCTD-01).
- Chỉ Ban Giám hiệu phê duyệt chứng từ theo hạn mức; kế toán trưởng không nằm trong luồng phê duyệt, chỉ chốt kỳ tài chính – người quyết định: Eric (YCTD-02).
- Mã dự án đổi từ SKG thành SM – người quyết định: Eric (YCTD-03, trả lời Q-132).
- Chốt kỳ tài chính do kế toán trưởng đề nghị, Hiệu trưởng phê duyệt; quản lý đơn vị không phê duyệt chứng từ thuộc danh mục hạn mức; Ban Giám hiệu phê duyệt mở lại kỳ công – người quyết định: Eric (YCTD-04, trả lời Q-133 đến Q-135).

#### Thay đổi

- Toàn bộ bộ tài liệu: đổi tên tệp theo bảng đối chiếu ở `24_YEU_CAU_THAY_DOI.md` YCTD-01; cập nhật mọi tham chiếu, trừ các mục lịch sử.
- `07_QUY_TAC_NGHIEP_VU.md`: ghi rõ chỉ Ban Giám hiệu phê duyệt chứng từ thuộc danh mục hạn mức; Hiệu trưởng phê duyệt chốt kỳ tài chính; thêm và trả lời Q-133, Q-134.
- `08_VAI_TRO_NGUOI_DUNG.md`: VT-05 mất quyền phê duyệt, thêm ghi chú 8; VT-03 chỉ phê duyệt việc không có giá trị tiền; bảng phân cấp phê duyệt mục 5 viết lại.
- `10_YEU_CAU_CHUC_NANG.md` P06-09, `16_CO_SO_DU_LIEU.md` bảng `fiscal_periods`, `17_DAC_TA_API.md` điểm cuối chốt kỳ: theo luồng đề nghị và phê duyệt chốt kỳ.
- `QT-03`, `QT-04`, `QT-05`, `QT-06` lên phiên bản 1.1: bỏ kế toán trưởng khỏi luồng phê duyệt; QT-06 thêm và trả lời Q-135; QT-05 trả lời Q-49.
- `11_TIEU_CHI_NGHIEM_THU.md` AC-35, `21_KICH_BAN_KIEM_THU.md` CT-038, `14_DAC_TA_GIAO_DIEN.md` MH-10: theo luồng phê duyệt mới.
- `04_TONG_QUAN_DU_AN.md`, `QT-01` GD-20: mã dự án SM.
- `23_LICH_SU_PHIEN_BAN.md`: thêm phiên bản 0.4.0.

#### Vấn đề tồn đọng

- Q-06: cần Eric xem lại sơ đồ chức năng để xác nhận "hình tổ màu" có phải "hình tô màu" ở P14-09 – trạng thái: chờ xác nhận. Bốn ảnh sơ đồ chức năng không có trong thư mục dự án.
- Ghi chú của công cụ khác trong `.workbuddy-ai/` vẫn trỏ đường dẫn `tai-lieu-thiet-ke/` cũ – trạng thái: chờ xác nhận có cần cập nhật không.

### 2026-10-09 — Đổi tên dự án thành School Management

**Người thực hiện:** Minh

**Nội dung:**

- Đổi tên dự án từ Sun KinderGarten thành School Management theo yêu cầu của Eric, để khớp với tên thư mục gốc `D:\School_Management`.
- Thay thế toàn bộ 43 chỗ ghi tên cũ trên 36 tệp, gồm hai mươi bốn dòng tiêu đề "Dự án:", phần thân của `01_Tong_quan_du_an.md`, `16_Cau_lenh_he_thong_AI.md` và `21_Ke_hoach_tong_the_du_an.md`, cùng cây thư mục mã nguồn dự kiến trong `10_Cong_nghe_su_dung.md`.
- Trong cây thư mục mã nguồn dự kiến, thư mục gốc đổi từ `SunKinderGarten/` thành `School_Management/`.
- Giữ nguyên phần thân của hai mục nhật ký cũ có nhắc tên cũ, vì nhật ký chỉ ghi thêm, không ghi đè. Tên cũ trong hai mục đó là ghi chép lịch sử, không phải tham chiếu còn hiệu lực.
- Cập nhật `GD-84` trong `01_Tong_quan_du_an.md` để ghi nhận tên dự án mới; đánh dấu `Q-131` đã được trả lời; thêm câu hỏi mở `Q-132` về mã dự án.
- Thêm một hàng vào bảng "Quyết định đã chốt" của `index.md`.
- Ghi phiên bản 0.3.1 vào `20_Lich_su_thay_doi.md`; thêm mã công việc `N8` vào `Checklist_cong_viec.md`.

**Tệp bị ảnh hưởng:**

- Sửa 36 tệp trong `tai-lieu-thiet-ke/`: hai mươi mốt tài liệu đánh số, `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md`, `Quy_trinh_nghiep_vu/index.md`, `Quy_trinh_nghiep_vu/Phieu_yeu_cau.md` và mười đặc tả `QT-01` đến `QT-10`.
- Không tệp nào bị đổi tên hay di chuyển.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: tên cũ chỉ còn xuất hiện ở những chỗ cố ý, gồm hai mục nhật ký lịch sử, chính mục nhật ký này, mục 0.3.1 của `20_Lich_su_thay_doi.md` và câu hỏi `Q-132`; mã `SKG` vẫn giữ nguyên tại hai mươi hai chỗ.
- Đã kiểm tra khung mã ba chấm cân bằng và không có hàng bảng thiếu dấu `|` kết thúc sau khi thay thế.

**Ghi chú:**

- Mã dự án vẫn là `SKG`, vốn là chữ viết tắt của tên cũ. Đây là điểm chưa khớp, đã ghi thành `Q-132` để Eric quyết; chưa tự đổi vì mã dự án còn được dùng trong quy tắc sinh mã trẻ tại `GD-20` của `QT-01`.
- Không đổi mã phiên bản tài liệu thành số chính vì việc đổi tên không phá vỡ nội dung nghiệp vụ, thiết kế dữ liệu hay giao diện lập trình.

### 2026-10-09 — Dời thư mục dự án sang ổ D

**Người thực hiện:** Minh

**Nội dung:**

- Dời toàn bộ thư mục dự án theo yêu cầu của Eric.
- Đường dẫn cũ: `C:\Users\vinhn\WorkBuddy AI\2026-10-09-08-11-58\SunKinderGarten\`.
- Đường dẫn mới: `D:\School_Management\`.
- Cách làm: sao chép sang ổ D trước, đối chiếu mã băm của từng tệp, xác nhận khớp hoàn toàn rồi mới xóa thư mục nguồn. Không dùng lệnh dời trực tiếp vì hai ổ khác nhau nên thao tác dời sẽ là sao chép rồi xóa, dễ mất dữ liệu nếu gián đoạn.
- Sao chép kèm thư mục `.workbuddy-ai` chứa nhật ký phiên và ghi chú dài hạn, để dự án tự chứa đủ ngữ cảnh khi mở tại vị trí mới. Thư mục `.workbuddy-ai` ở vị trí cũ vẫn giữ nguyên, không xóa.
- Thêm giả định `GD-84` và câu hỏi mở `Q-131` vào `01_Tong_quan_du_an.md`: thư mục gốc đổi tên nhưng tên sản phẩm trong tài liệu chưa đổi.

**Tệp bị ảnh hưởng:**

- Toàn bộ 36 tệp trong `tai-lieu-thiet-ke/` được dời nguyên trạng sang `D:\School_Management\tai-lieu-thiet-ke\`.
- Sửa: `01_Tong_quan_du_an.md` (thêm `GD-84`, `Q-131`), `index.md` (cập nhật số đếm giả định và câu hỏi mở), `Nhat_ky_du_an.md`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng mã băm: 36 tệp ở vị trí mới có mã băm giống từng byte so với vị trí cũ; danh sách đường dẫn tệp khớp hoàn toàn; tổng số dòng tài liệu vẫn là 6 402.
- Đã kiểm tra không có tài liệu nào chứa đường dẫn tuyệt đối tới vị trí cũ, nên việc dời không làm hỏng tham chiếu chéo. Mọi tham chiếu trong tài liệu đều là đường dẫn tương đối.

**Ghi chú:**

- Tên thư mục gốc nay là School_Management, khác tên sản phẩm Sun KinderGarten; đã ghi thành `Q-131` để Eric quyết.
- Nếu mở `D:\School_Management` làm thư mục làm việc mới, ghi chú dài hạn và nhật ký phiên nằm sẵn trong `.workbuddy-ai` ở đó.

### 2026-10-09 — Lập kế hoạch tổng thể dự án

**Người thực hiện:** Minh

**Nội dung:**

- Soạn tài liệu `21_Ke_hoach_tong_the_du_an.md`: kế hoạch tổng thể của toàn bộ dự án theo yêu cầu của Eric.
- Dựng bảng mười hai giai đoạn kèm đầu ra bắt buộc, cổng kiểm soát `CG-01` đến `CG-12` và trạng thái hiện tại của từng giai đoạn. Kết luận: dự án đang đứng ở cổng `CG-04` và `CG-05`, chưa qua được.
- Dựng bảng sáu mốc phát hành: 0.1.0, 0.2.0, 0.3.0, 1.0.0, 1.1.0, 1.2.0, gắn với ba giai đoạn sản phẩm tại `02_Pham_vi.md`.
- Dựng kế hoạch thực thi giai đoạn xây dựng thành mười hai đợt `DT-00` đến `DT-11`, mỗi đợt ghi rõ nội dung, phân hệ, mã công việc, phụ thuộc và điều kiện ra.
- Vẽ đường găng bằng sơ đồ và liệt kê bảy mắt xích đang chặn dự án, trong đó ba việc `M05`, `M06`, `M08` đang tạm dừng.
- Dựng ma trận trách nhiệm theo giai đoạn với bốn ký hiệu A, R, C, I.
- Dựng bảng ngưỡng phê duyệt thay đổi gồm sáu loại thay đổi và người phê duyệt tương ứng.
- Ghi mười hai rủi ro `RR-01` đến `RR-12` kèm mức đánh giá, ảnh hưởng và ứng phó.
- Ghi mục "Trạng thái hiện tại và việc trước mắt" với mười việc xếp theo thứ tự, ghi rõ việc nào của Eric và việc nào của Minh.
- Ghi hai giả định mới `GD-82`, `GD-83` và ba câu hỏi mở mới `Q-128` đến `Q-130`.
- Bổ sung `AI-38` và `AI-39` vào `15_Quy_tac_phat_trien_AI.md`, nguyên tắc 15 vào câu lệnh hệ thống tại `16_Cau_lenh_he_thong_AI.md`, và ba tiền tố mã `CG-xx`, `DT-xx`, `RR-xx` vào bảng quy ước mã.
- Cập nhật `index.md`: thêm tài liệu số 21, sửa số giả định từ 80 lên 83 do `GD-81` trước đây chưa được đếm, sửa số câu hỏi mở từ 127 lên 130, thêm ba hàng đếm cổng, đợt và rủi ro.
- Ghi phiên bản 0.3.0 vào `20_Lich_su_thay_doi.md`; thêm mã công việc `N7` vào `Checklist_cong_viec.md`.

**Tệp bị ảnh hưởng:**

- Tạo mới: `21_Ke_hoach_tong_the_du_an.md`.
- Sửa: `index.md`, `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md`, `20_Lich_su_thay_doi.md`, `Checklist_cong_viec.md`, `Nhat_ky_du_an.md`.

**Kết quả kiểm thử:**

- Không áp dụng. Tài liệu này là kế hoạch, chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: mã `CG-01` đến `CG-12`, `DT-00` đến `DT-11`, `RR-01` đến `RR-12` không trùng với bất kỳ tiền tố nào đã dùng; mọi bảng trong tài liệu mới đều có hàng phân cách; khối mã và sơ đồ cân bằng.

**Ghi chú:**

- Kế hoạch dùng thứ tự và điều kiện vào, điều kiện ra thay cho hạn ngày vì chưa có nguồn lực và ngày bắt đầu được xác nhận, ghi tại `GD-83` và `Q-128`.
- Tài liệu đặt trong bộ tài liệu thiết kế dưới số 21 theo quy tắc "phát sinh tài liệu mới thì đánh số tiếp theo"; xếp vào nhóm quản lý trong `index.md` vì điều phối toàn bộ vòng đời dự án.
- Ba việc Eric cần làm trước để mở đợt đầu tiên: trả lời nhóm câu hỏi ưu tiên, chốt phương án lưu trữ nhiều đơn vị và bộ công nghệ, xác nhận cách xếp ba giai đoạn.

### 2026-10-09 — Cập nhật theo bốn yêu cầu mới

**Người thực hiện:** Minh

**Nội dung:**

- Đổi vai trò Chủ trường thành Ban Giám hiệu gồm hai vai trò tách riêng: Hiệu trưởng (VT-02) và Phó Hiệu trưởng (VT-15), vì đây là trường công lập.
- Bổ sung phân cấp phê duyệt theo hạn mức: Phó Hiệu trưởng phê duyệt chứng từ dưới hạn mức, Hiệu trưởng phê duyệt từ hạn mức trở lên; thêm BR-77 đến BR-80 tại `04_Quy_tac_nghiep_vu.md` mục 12.1 và mục 5 mới trong `05_Vai_tro_nguoi_dung.md`.
- Chuyển mô hình đơn vị tổ chức từ một cấp sang ba cấp: Trường chính, Phân hiệu, Điểm trường. Cả ba cấp đều có thể có lớp; đơn vị của trẻ là đơn vị ở cấp thấp nhất nơi trẻ học.
- Thay thuật ngữ "cơ sở" bằng "đơn vị" trên toàn bộ bộ tài liệu, giữ nguyên các cụm "cơ sở dữ liệu" và "cơ sở hạ tầng". Tổng cộng sửa 31 tệp.
- Đổi bảng `branches` thành `org_units` kèm trường `unit_type` và `parent_id` tự tham chiếu; đổi cột `branch_id` thành `org_unit_id` tại `13_Luoc_do_co_so_du_lieu.md`.
- Sửa mâu thuẫn nội bộ giữa BR-01, BR-02 và GD-05 bằng cách viết lại theo mô hình ba cấp.
- Tách hoàn toàn tầng giao diện khỏi tầng máy chủ; giao diện chỉ gọi giao diện lập trình ứng dụng, không truy cập cơ sở dữ liệu. Ghi tại `09_Kien_truc_he_thong.md` mục 1 và 2, `10_Cong_nghe_su_dung.md` mục 2 và 4, `11_Dac_ta_giao_dien.md` mục 7 mới.
- Tách dịch vụ định danh độc lập tự viết khỏi máy chủ API nghiệp vụ; ghi tại `09_Kien_truc_he_thong.md` TP-11 và mục 4, `14_Dac_ta_API.md` mục 1 và 4, `19_Bao_mat.md` BM-54 đến BM-59.
- Bổ sung mã mới: BR-77 đến BR-80, GD-61 đến GD-80, Q-112 đến Q-127, AC-135 đến AC-148, CT-091 đến CT-104, PCF-11 đến PCF-13, RG-01 đến RG-06, P01-10, MH-32 và MH-33, PV-10 đến PV-12, XT-08, QU-09 và QU-10, QĐ-06 đến QĐ-10.
- Ghi phiên bản 0.2.0 vào `20_Lich_su_thay_doi.md`.

**Tệp bị ảnh hưởng:**

- Toàn bộ bộ tài liệu: `01` đến `20`, `index.md`, `Checklist_cong_viec.md`, `Nhat_ky_du_an.md` và toàn bộ thư mục `Quy_trinh_nghiep_vu/`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: không còn chỗ nào dùng "cơ sở" theo nghĩa đơn vị tổ chức; không còn "Chủ trường"; các cụm "cơ sở dữ liệu" và "cơ sở hạ tầng" giữ nguyên.

**Ghi chú:**

- Bốn quyết định này do Eric chốt ngày 09/10/2026, ghi tại `09_Kien_truc_he_thong.md` QĐ-06 đến QĐ-10.
- Mức hạn mức phê duyệt cụ thể chưa có, đã ghi thành Q-112 và Q-123.
- Số Phân hiệu và Điểm trường thực tế chưa có, đã ghi thành Q-113 và Q-122.

### 2026-10-09 — Soạn bộ tài liệu thiết kế

**Người thực hiện:** Minh

**Nội dung:**

- Phân tích nguồn đầu vào: danh sách tính năng bốn nhóm và bốn ảnh sơ đồ chức năng (Tương tác và Nội dung, Chức năng dành cho giáo viên, Chức năng dành cho phụ huynh, Chức năng dành cho kế toán) do Eric gửi.
- Xác định sản phẩm là mới hoàn toàn, không kế thừa mã nguồn của hệ thống nào; ghi nhận trong `01_Tong_quan_du_an.md` mục 1.
- Xác định 19 phân hệ, mã P01 đến P19, và xếp vào ba giai đoạn tại `02_Pham_vi.md`.
- Xác định 14 vai trò người dùng, mã VT-01 đến VT-14, kèm ma trận quyền theo phân hệ tại `05_Vai_tro_nguoi_dung.md`.
- Soạn nhóm tài liệu phân tích nghiệp vụ: `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md`.
- Soạn nhóm tài liệu thiết kế: `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md`.
- Soạn nhóm tài liệu quy tắc, kiểm thử và vận hành: `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md`.
- Soạn 10 đặc tả quy trình nghiệp vụ theo khuôn đặc tả, mã QT-01 đến QT-10, mỗi tệp đủ mười lăm mục.
- Ghi nhận 76 quy tắc nghiệp vụ, 134 tiêu chí nghiệm thu, 90 ca kiểm thử khởi đầu, 60 giả định và 111 câu hỏi mở.
- Ghi nhận ba đề xuất cần phê duyệt trước khi xây dựng: mô hình nhiều đơn vị chọn phương án tách bằng cột đơn vị, bộ công nghệ đề xuất, và cách xếp giai đoạn 1, 2, 3.

**Tệp bị ảnh hưởng:**

- Toàn bộ thư mục `tai-lieu-thiet-ke/`, gồm 20 tài liệu đánh số, ba tệp quản lý và 11 tệp trong thư mục `Quy_trinh_nghiep_vu/`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.

**Ghi chú:**

- Mọi tài liệu để ở trạng thái Chờ duyệt, chưa có nội dung nào được phê duyệt.
- Chưa xác minh được nghiệp vụ thật của trường: không có biểu mẫu, không có phỏng vấn người dùng. Đã ghi rõ ở mục "Chưa xác minh được" của từng tài liệu phân tích.
- Các điểm cần Eric quyết định trước khi chuyển bước: công thức học phí giữa tháng, mốc giảm trừ tiền ăn, mức miễn giảm và thẩm quyền phê duyệt, mốc nhắc nợ, có lập sổ kế toán kép theo Thông tư 99/2025/TT-BTC hay không, số ngày phép năm, các khoản khấu trừ trên bảng lương.

### 2026-10-09

**Người thực hiện:**

**Nội dung:**

- Khởi tạo bộ tài liệu thiết kế cho dự án Sun KinderGarten - Hệ thống quản lý trường mầm non.

**Tệp bị ảnh hưởng:**

- Toàn bộ thư mục tai-lieu-thiet-ke.

**Kết quả kiểm thử:**

- Không áp dụng.

**Ghi chú:**

- Không có.
