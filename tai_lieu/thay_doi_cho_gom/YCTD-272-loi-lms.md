---
yctd: YCTD-272
tieu_de: DT-28 phần 28b: lõi hệ thống quản lý học tập
ngay: 2026-10-26
phien_ban_de_xuat: 0.154.0
---

## 02 Nhật ký

### 2026-10-26 — DT-28 phần 28b: lõi hệ thống quản lý học tập

#### Công việc đã thực hiện

- Làm phần 28b theo `32` mục 20.6, 20.7: lớp học trực tuyến tự sinh từ phân công giảng dạy, khoá tự chọn, khoá học mẫu của tổ qua duyệt hai bước, chương, hoạt động (trang, liên kết, học liệu), điều kiện mở, kết quả hoạt động chung, tiến độ, kế hoạch theo tuần, nhật ký học tập, quyết định dạy học trực tuyến thay thế và nội quy theo Thông tư 09/2021/TT-BGDĐT; cổng quản trị 9.1 đến 9.3, ứng dụng giáo viên, ứng dụng phụ huynh.
- Kiểm thử: 38/38 ca API (`learning.test.ts` có CT-28b-17 học sinh, `learning-rules.test.ts`, `learning-tenancy.test.ts` hai bố cục, `school-plan.test.ts`, `online-exams.test.ts`, `working-level.test.ts`); e2e `211-online-classes` đạt (chạy kèm spec nền 01 đến 09; lần đầu hỏng vì ứng dụng phụ huynh đăng nhập bằng số điện thoại, đã sửa spec), `134-school-plans` đạt ở chế độ nhiều trường. Chạy với CSDL định danh, hệ thống riêng của phần.

#### Quyết định

- Claude chọn theo ủy quyền: phân công giảng dạy là nguồn chính để sinh lớp học trực tuyến, thời khoá biểu là nguồn phụ; đồng bộ khi mở danh sách thay vì móc vào luồng ban hành thời khoá biểu; quy tắc duyệt khoá mẫu viết lại theo đúng quy tắc của 22h1 vì 28b không sửa tệp của 22h1; cách ly kiểm ở mức API cho cả hai bố cục thay vì e2e nhiều trường.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-272, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Sau khi 23a gộp: thêm học sinh tự học ở kênh `student` (`/student/learning`, quyền `P02.learning.study` cho VT-21, MH-354, CT-1137) trong cùng PR; sửa CI hỏng CT-S5a-8 (quy tắc menu khoá mẫu ghi quyền kho học liệu làm tuyến kho học liệu không còn bị chặn theo gói; tuyến nhân sự `/learning` nay chặn theo gói).

## 24 Yêu cầu thay đổi

### YCTD-272: DT-28 phần 28b: lõi hệ thống quản lý học tập – 2026-10-26

- Lý do: phần 28b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270); Eric yêu cầu ngày 2026-10-26 phát triển hệ thống quản lý học tập, lõi LMS đi trước cùng mô hình nhóm (28a). Căn cứ: Thông tư 09/2021/TT-BGDĐT (đọc toàn văn bản gốc khi viết kế hoạch, mục 20.2).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Lớp học trực tuyến** (`course_spaces`): sinh từ phân công giảng dạy (`class_staff_assignments` có môn) là nguồn chính, thời khoá biểu đang áp dụng là nguồn phụ (kế hoạch ghi ngược lại; đổi vì phân công là nơi trường ghi ai dạy lớp, môn nào); đồng bộ lúc giáo viên mở danh sách và khi Ban Giám hiệu bấm (không móc vào luồng ban hành thời khoá biểu để không sửa phân hệ thời khoá biểu); khoá tự chọn có ghi danh, số chỗ.
  - **Nội dung**: chương, hoạt động; danh mục loại hoạt động `ACTIVITY_KINDS` có `resource`, `page`, `link`; ràng buộc cột `kind` liệt kê sẵn mọi loại của DT-28; học liệu chỉ dùng bản đã công bố của 22h1; liên kết theo `learning_link_domains` (chưa đặt thì cho mọi https); điều kiện mở tối đa 10 điều kiện; mở riêng, gia hạn có lý do.
  - **Kết quả và tiến độ**: bảng `activity_results` chung; giáo viên đánh dấu hoàn thành, miễn, điểm, mức; `recordView` (xem xong thì hoàn thành) dùng cho màn hình học sinh khi 23a gộp; kế hoạch theo tuần; nhật ký `learning_events` dạng gần xAPI.
  - **Khoá học mẫu** (hệ thống): nội dung JSON có phiên bản, bản đã duyệt tách riêng; duyệt hai bước dùng quyền duyệt học liệu của 22h1 với cùng quy tắc người duyệt (viết lại quy tắc trong `learning.ts` vì 28b không sửa tệp của 22h1); đẩy, nhận cập nhật không ghi đè hoạt động giáo viên đã sửa, hoạt động đẩy xuống là nháp, hình thức hỗ trợ.
  - **Thông tư 09/2021**: quyết định dạy học trực tuyến thay thế (`online_teaching_decisions`) chặn hình thức thay thế khi chưa có; nội quy có phiên bản, phụ huynh xác nhận thay con.
  - **Quyền** (định danh 0180): `P02.learning.teach`, `P02.learning.template` (có cả Ban Giám hiệu), `P02.learning.decide`, `P02.learning.view`, `P02.learning.study` (học sinh VT-21, kênh `student` của 23a); tổ trưởng xem lớp của môn trong tổ bộ môn.
  - **Chặn theo gói (S5a)**: mọi tuyến nhân sự của `/learning` khai báo bốn quyền nhân sự để bộ chặn theo gói chạy (trường có gói không gồm phân hệ của nhóm menu 9 nhận `MODULE_NOT_IN_PLAN`); tuyến phụ huynh `children/...` kiểm ở dịch vụ theo học sinh. Quy tắc menu 9.2 Khoá học mẫu chỉ ghi `P02.learning.template`: ghi thêm quyền duyệt học liệu thì bảng quyền → phân hệ của gói gắn quyền kho học liệu vào cả phân hệ này, trường không có kho học liệu trong gói vẫn gọi được tuyến kho học liệu (CI hỏng CT-S5a-8).
  - **Học sinh** (sau khi 23a gộp): nhóm `/student/learning` ở kênh `student`: xem lớp đã mở cho em, mở hoạt động đang mở (ghi đã xem, hoạt động "xem xong" thì hoàn thành, trả nội dung trang, liên kết, tên học liệu), xác nhận nội quy; không đòi cấp học bật thi trực tuyến như phía thi của 23a. Màn hình nằm ở trang chủ học sinh của 23a (`#hoc-sinh` trong ứng dụng phụ huynh).
  - **Giao diện**: cổng quản trị nhóm menu 9. Học tập trực tuyến (9.1, 9.2, 9.3) cho TH, THCS, THPT; ứng dụng giáo viên Lớp học trực tuyến; ứng dụng phụ huynh Học trực tuyến (mã chức năng theo cấp `online_learning`).
  - **Cách ly**: kiểm thử API ở nền tảng nhiều trường, cả hai bố cục (`learning-tenancy.test.ts`) thay cho mở rộng `MULTI_TENANT_SPEC` của e2e (kế hoạch ghi spec 211 nhiều trường; spec 211 chạy một trường, cách ly kiểm ở mức API đủ phủ các tuyến mới).
- Thành phần bị ảnh hưởng: `apps/api` (phân hệ mới `learning`, đăng ký thêm cuối `application.module.ts`, một danh sách trong `working-level.test.ts`), `apps/portal` (ba trang, `router.tsx`), `apps/teacher`, `apps/parent`, `packages/shared` (mã quyền, đường dẫn menu, quyền menu, nhóm menu 9, `online_learning`), `database` (hệ thống 0110, năm học 0172 đến 0175, định danh 0180, kiểu và xuất kiểu), `tests` (spec 211). Không sửa `child-groups/`, `learning-resources/`, `timetables/`, `online-exams/`.
- Dữ liệu bị ảnh hưởng: hệ thống `0110`; năm học `0172` đến `0175`; định danh `0180`.
- API bị ảnh hưởng: nhóm `/api/v1/learning` (xem `17_DAC_TA_API.md` mục 17.2).
- Giao diện bị ảnh hưởng: MH-349 đến MH-354.
- Quyền bị ảnh hưởng: PQ-110.
- Ảnh hưởng chức năng cũ: không đổi hành vi; trường chỉ có Mầm non không thấy gì mới.
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho; e2e `single` (spec 211 cùng các spec hiện có); kiểm tĩnh đa thuê bao, ma trận cách ly; typecheck, lint, build.
- Chưa làm (YCTD sau): học sinh xem tệp học liệu từ hoạt động (mới hiện tên, mô tả; tải tệp cần quyền kho học liệu); đính kèm tệp quyết định dạy thay thế; loại hoạt động `exam` (khi 23a gộp); đẩy khoá mẫu chọn nhiều lớp của người khác (chỉ lớp người đẩy dạy hoặc quản lý); trình soạn khoá mẫu đủ loại hoạt động ở cổng quản trị (mới có chương, trang nội dung); duyệt yêu cầu ghi danh của học sinh (`request`); báo cáo, sổ điểm, hồ sơ Thông tư 09 (28d).
- Trạng thái: Đã triển khai (PR 193)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-26

- Phạm vi thay đổi: DT-28 phần 28b, lõi hệ thống quản lý học tập (YCTD-272).
- Chức năng mới: lớp học trực tuyến theo lớp, môn tự sinh từ phân công giảng dạy và khoá tự chọn (P03-12, MH-349); chương, hoạt động trang nội dung, liên kết, học liệu, điều kiện mở, giao cho học sinh (P03-13); tiến độ, kết quả hoạt động, kế hoạch dạy học trực tuyến theo tuần, nhật ký học tập (P03-14); khoá học mẫu của tổ chuyên môn qua duyệt hai bước rồi đẩy xuống lớp (P03-15, MH-350); quyết định dạy học trực tuyến thay thế và nội quy theo Thông tư 09/2021/TT-BGDĐT (P03-16, MH-351); ứng dụng giáo viên Lớp học trực tuyến (MH-352); ứng dụng phụ huynh Học trực tuyến của con (P03-17, MH-353); học sinh tự học ở kênh `student` (MH-354).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: hệ thống `0110`; năm học `0172` đến `0175`; định danh `0180` (năm quyền `P02.learning.*`); xem `16_CO_SO_DU_LIEU.md` mục 18H.
- Thay đổi API: nhóm `/learning` và `/student/learning` của học sinh (xem `17_DAC_TA_API.md` mục 17.2); tuyến nhân sự chặn theo gói của trường.
- Kiểm thử: kịch bản CT-1130 đến CT-1137 (CT-28b-1 đến CT-28b-17 trong mã kiểm thử). Kết quả ngày 26/10/2026: `apps/api` 14/14 ca của `learning-rules.test.ts`, `learning.test.ts`; `learning-tenancy.test.ts` 2/2 (hai bố cục); `working-level.test.ts` 8/8, `menu-permissions.test.ts` và `secondary-class-records.test.ts` đạt; e2e: `211-online-classes` (CT-28b-16) và `151-classroom-tools` (CT-23b-14, có màn Lớp của tôi thêm nút mới) đạt, chạy kèm spec nền 01 đến 09.
- Rủi ro: học sinh mới thấy tên, mô tả học liệu, chưa tải được tệp; tệp quyết định dạy thay thế chưa đính kèm được; báo cáo theo vai trò, sổ điểm, hồ sơ Thông tư 09 là phần 28d; trình soạn nội dung khoá mẫu ở cổng quản trị mới có chương và trang nội dung.
- Khả năng tương thích: không đổi hành vi các phân hệ cũ; lớp học trực tuyến tự sinh ẩn với học sinh đến khi giáo viên mở; trường chỉ có Mầm non không thấy nhóm menu 9. Học tập trực tuyến.
- Phương án quay lui: hoàn lại commit gộp của nhánh 28b; các tệp migration chỉ thêm bảng và quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28b: lõi hệ thống quản lý học tập (lớp học trực tuyến tự sinh từ phân công giảng dạy, khoá tự chọn, khoá học mẫu của tổ chuyên môn qua duyệt tổ và Ban Giám hiệu rồi đẩy xuống lớp, chương và hoạt động trang nội dung, liên kết, học liệu đã công bố, điều kiện mở, kết quả hoạt động chung, tiến độ, kế hoạch dạy học trực tuyến theo tuần, nhật ký học tập dạng gần xAPI, quyết định dạy học trực tuyến thay thế và nội quy theo Thông tư 09/2021/TT-BGDĐT; phụ huynh xem việc học trực tuyến của con) (YCTD-272) | Đã triển khai |

## index Số đếm

| 10 | mã chức năng | +6 |
| 10 | còn hiệu lực | +6 |
| 14 | màn hình | +6 |
| 16 | bảng dự kiến | +13 |
| Chức năng đã liệt kê | Số lượng | +6 |
| Chức năng đã liệt kê | mã; | +6 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +8 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +5 |
| Bảng dữ liệu dự kiến | Số lượng | +13 |
| Màn hình dự kiến | Số lượng | +6 |
| Ca kiểm thử khởi đầu | Số lượng | +8 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-349 đến MH-354 (YCTD-272) |
