---
yctd: YCTD-278
tieu_de: DT-28 phần 28h: gói SCORM và gói khoá học
ngay: 2026-10-28
phien_ban_de_xuat: 0.167.0
---

## 02 Nhật ký

### 2026-10-28 — DT-28 phần 28h: gói SCORM và gói khoá học

#### Công việc đã thực hiện

- Làm phần 28h theo `32` mục 20.6, 20.7.
- **Gói SCORM 1.2 và 2004 là học liệu loại mới `scorm` của kho 22h1.** Gói zip tải lên học liệu, qua tổ chuyên môn, Ban Giám hiệu duyệt như mọi học liệu (Thông tư 09/2021/TT-BGDĐT Điều 7 khoản 3).
- **Kiểm gói khi tải lên:**
  - Bản kê `imsmanifest.xml`, chuẩn, danh sách SCO theo tổ chức mặc định.
  - Chặn đường dẫn thoát thư mục, đường dẫn tuyệt đối, loại tệp không cho phép, zip có mật khẩu, ZIP64.
  - Gói tối đa 200 MB (GD-150).
- **Phát cô lập:**
  - Tệp của gói phục vụ theo mã truy cập ngắn hạn ký HMAC (trường, gói, hoạt động, học sinh, nguồn gốc trang cha, hạn 4 giờ).
  - CSP `sandbox allow-scripts`: tài liệu luôn ở nguồn gốc riêng, không đọc được phiên, cookie, dữ liệu của ứng dụng; chỉ nạp mã, kiểu, ảnh từ chính gói; không gửi biểu mẫu, không gọi máy chủ ngoài.
  - Khung `iframe sandbox="allow-scripts"` ở trang học sinh và trang xem trước.
  - Nguồn gốc nội dung riêng cấu hình được (`SCORM_CONTENT_ORIGIN`). Ở chế độ nhiều trường, trường lấy theo mã truy cập trong đường dẫn, rồi kiểm chữ ký và mã trường.
- **Bộ chuyển API** `API` (1.2) và `API_1484_11` (2004) gắn vào trang SCO:
  - Gửi thay đổi lên trang cha bằng `postMessage`; trang cha kiểm khung nguồn và nguồn gốc.
  - Lưu trạng thái hoàn thành, đạt, điểm (quy về thang 10), thời gian phiên, vị trí, dữ liệu tạm có giới hạn cỡ.
  - Kết quả hoạt động của lõi 28b tính từ các SCO.
  - Gói nhiều SCO chạy lần lượt, không làm trình tự và điều hướng (GD-153).
- **Hoạt động loại `scorm`** trỏ tới học liệu gói SCORM đã công bố, đặt được trong khoá học mẫu.
- **Gói khoá học** `school-management.course-package/1`:
  - Xuất khoá học mẫu kèm học liệu đã công bố mà hoạt động tham chiếu (tệp, liên kết, gói SCORM); không chứa dữ liệu học sinh.
  - Nhập thành khoá mẫu nháp của người nhập. Học liệu trùng dùng lại; học liệu mới tạo nháp và gửi duyệt theo 22h1.
- **Giao diện:**
  - Cổng quản trị, kho học liệu: khối "Gói bài giảng SCORM" (tải gói, xem trước).
  - Thêm hoạt động "Gói bài giảng SCORM" ở lớp học trực tuyến.
  - Khoá học mẫu: "Xuất gói khoá học", "Nhập gói khoá học từ trường khác".
  - Học sinh `#hoc-sinh`: trình phát gói.
- **Kiểm thử:**
  - 8/8 ca của `scorm-rules.test.ts`, `scorm.test.ts`.
  - e2e `217-scorm-packages` (giáo viên tải gói và xem trước; học sinh học gói trong khung cô lập; gói không đọc được trang cha; kết quả "Đạt" ghi về máy chủ).

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-278):
  - Giải nén tối đa 2.000 tệp, 500 MB, mỗi tệp 200 MB.
  - Điểm theo `score.scaled` (2004) nếu có, không thì `raw` theo `min`, `max` (thiếu `max` coi thang 100).
  - Gói chỉ biết người học là "Học sinh" với mã ẩn danh, không biết tên thật.
  - Gói khoá học tối đa 300 MB.
  - Không có tuyến xuất riêng cho câu hỏi, thang tiêu chí vì khoá mẫu của 28b không chứa bài tập.
- Migration hệ thống 0113 (loại học liệu `scorm`, bảng `scorm_packages`), 0114 (`course_package_transfers`); năm học 0189 (`scorm_attempts`). Không dùng năm học 0190 giữ sẵn.
- Mã khối riêng (BR-380, AC-1040, MH-495, CT-1340, BM-200, PQ-160, P03-50) để không va với PR đang mở; dòng bảng mới neo vào dòng của 28b; mục mới 12N, 18M, 17.7 đặt sau mục của 28e (28f giữ 12M, 18L, 17.6).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-278, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Chưa mở rộng `MULTI_TENANT_SPEC` bằng spec nhiều trường (mã truy cập của trường A mở ở trường B). Phần này mới có kiểm thử đơn vị: chữ ký, mã trường trong mã truy cập.
- Chưa có cấu hình tên miền nội dung ở cổng biên (Caddy, Worker) của hồ sơ triển khai; khi đặt `SCORM_CONTENT_ORIGIN` cần trỏ tên miền đó về máy chủ API.
- Trình tự và điều hướng SCORM 2004 không làm (GD-153); xAPI, cmi5, LTI để sau.

## 24 Yêu cầu thay đổi

### YCTD-278: DT-28 phần 28h: gói SCORM và gói khoá học – 2026-10-28

- Lý do: phần 28h của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270): phát được gói SCORM là mức kỳ vọng của trường Việt Nam (K12Online), nhập xuất khoá học giữa các trường.
- Căn cứ:
  - Thông tư 09/2021/TT-BGDĐT Điều 7 khoản 3 (học liệu qua tổ chuyên môn, người đứng đầu duyệt): gói SCORM là học liệu, qua duyệt 22h1.
  - Đặc tả SCORM 1.2, SCORM 2004 bản 4 của ADL: phiên này không đọc lại văn bản gốc; làm theo phần kế hoạch đã tóm tắt ở 20.6 (API `LMSInitialize`, `LMSGetValue`, `LMSSetValue`, `LMSCommit`, `LMSFinish`; `API_1484_11`; mô hình dữ liệu trạng thái, điểm, thời gian, dữ liệu tạm).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Nhập gói** (học liệu loại `scorm`):
    - Đọc zip có kiểm cỡ, mã CRC từng tệp.
    - Loại tệp cho phép: trang, mã, kiểu, dữ liệu, ảnh, âm thanh, video, phông, PDF.
    - Bản kê đọc tổ chức mặc định, `item` trỏ tài nguyên `sco` theo thứ tự, `xml:base`; mọi SCO phải trỏ tới tệp có trong gói.
    - Tệp đã giải nén lưu ở kho tệp theo `storageKey('scorm', gói, số thứ tự)` (có tiền tố trường ở chế độ nhiều trường).
    - Mỗi lần tải là một phiên bản của học liệu; người soạn gửi duyệt như mọi học liệu.
  - **Mã truy cập:**
    - `base64url(JSON).HMAC-SHA256` với khóa dẫn xuất từ khóa băm của nền tảng.
    - Giữ: trường (`single` ở chế độ một trường), gói, hoạt động, học sinh (trống khi xem trước), nguồn gốc trang cha (lấy từ tiêu đề `Origin` khi mở bài), hạn 4 giờ.
    - Sai, hết hạn, của trường khác thì 404.
  - **Phát tệp** (`GET /api/v1/scorm-content/{mã}/{đường dẫn}`, không cần mã phiên):
    - CSP `sandbox allow-scripts; default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'; form-action 'none'; object-src 'none'; frame-ancestors …`.
    - Bỏ chặn khung chung (`X-Frame-Options`); `Access-Control-Allow-Origin: *` cho tệp của gói (không kèm cookie).
    - Trang SCO không lưu đệm.
  - **Bộ chuyển API:**
    - Chạy trong khung, nhận giá trị ban đầu do máy chủ gắn vào trang (đã thoát `<`).
    - Ghi, đọc trong bộ nhớ; chặn ghi khóa chỉ đọc.
    - Gửi `set`, `commit`, `finish` lên trang cha bằng `postMessage` tới đúng nguồn gốc trang cha.
    - Trang cha chỉ nhận tin từ khung đang mở và nguồn gốc `null` (hoặc nguồn gốc nội dung riêng); gửi lên máy chủ khi gói lưu, kết thúc hoặc mỗi 30 giây.
  - **Kết quả:**
    - `scorm_attempts` theo hoạt động, học sinh, SCO.
    - Hoạt động: chưa SCO nào chạy là chưa làm; đủ SCO xong là hoàn thành (`submit`).
    - `pass`: mọi SCO đạt; gói không báo đạt thì so điểm trung bình với điểm đạt của hoạt động.
    - `teacher`: gói không tự hoàn thành.
    - Hoạt động giáo viên đã miễn hoặc đã ghi kết quả không bị ghi đè.
  - **Gói khoá học:**
    - JSON nén gzip; dùng lại định dạng mục và cách kiểm mã băm của gói học liệu 22h2 (`resource-sharing-rules.ts`), thêm `ref`, `scorm`.
    - Xuất: chỉ học liệu đã công bố, giấy phép không bị chặn, không "không rõ".
    - Nhập: cần quyền soạn khoá mẫu; học liệu trùng mã băm tệp hoặc liên kết thì dùng lại; gói SCORM qua cùng bước kiểm, giải nén.
    - Hoạt động trỏ tới học liệu không nhập được thì bỏ, ghi lý do.
    - Nhật ký xuất, nhập ở `course_package_transfers`.
- Thành phần bị ảnh hưởng:
  - `apps/api`:
    - Thư mục mới `learning/content-packages`.
    - Thêm loại `scorm` ở cuối danh mục loại hoạt động.
    - Cửa `addTypedFileVersion` ở `LearningResourcesService`.
    - Bộ phân giải trường theo mã truy cập ở `create-application.ts`.
    - Cấu hình `SCORM_CONTENT_ORIGIN`; đăng ký thêm cuối `application.module.ts`.
  - `apps/parent`: `ScormPlayer.tsx`, `StudentLearningPanel.tsx`.
  - `apps/portal`: `ScormPanel.tsx`, `LearningResourcePages.tsx`, `CoursePackagePanel.tsx`, `CourseTemplatesPage.tsx`, `OnlineClassesPage.tsx`.
  - `database`: hệ thống 0113, 0114; năm học 0189.
  - `tests/e2e/217-scorm-packages.spec.ts`.
- Dữ liệu bị ảnh hưởng: hệ thống `0113` (thêm loại học liệu `scorm` cần Ban Giám hiệu duyệt, bảng `scorm_packages`), `0114` (`course_package_transfers`); năm học `0189` (`scorm_attempts`).
- API bị ảnh hưởng: `/api/v1/learning-resources/{id}/scorm`, `/api/v1/learning/activities/{id}/scorm-attempts`, `/api/v1/student/scorm`, `/api/v1/scorm-content`, `/api/v1/learning/templates/{id}/package`, `/api/v1/learning/template-packages` (xem `17_DAC_TA_API.md` mục 17.7).
- Giao diện bị ảnh hưởng: MH-495 đến MH-497.
- Quyền bị ảnh hưởng: PQ-160 (không thêm mã quyền).
- Ảnh hưởng chức năng cũ: thêm loại học liệu, loại hoạt động; không đổi hành vi các loại cũ.
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho; e2e `single` (spec 217 cùng các spec hiện có); typecheck, lint, build.
- Chưa làm (YCTD sau):
  - Spec nhiều trường cho gói SCORM.
  - Cấu hình tên miền nội dung ở cổng biên.
  - Trình tự SCORM 2004; xAPI, cmi5, LTI (GD-152).
  - Câu hỏi, thang tiêu chí trong gói khoá học.
- Trạng thái: Đã triển khai (PR chờ)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-28 phần 28h, gói SCORM và gói khoá học (YCTD-278).
- Chức năng mới:
  - Nhập gói SCORM vào kho học liệu (P03-50, MH-495).
  - Phát gói SCORM cô lập, ghi kết quả (P03-51, MH-497).
  - Hoạt động gói SCORM (P03-52).
  - Xuất, nhập gói khoá học (P03-53, MH-496).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: hệ thống `0113`, `0114`; năm học `0189`; xem `16_CO_SO_DU_LIEU.md` mục 18M.
- Thay đổi API: xem `17_DAC_TA_API.md` mục 17.7.
- Kiểm thử: kịch bản CT-1340 đến CT-1348 (CT-28h-1 đến CT-28h-9 trong mã kiểm thử).
- Rủi ro:
  - Gói của bên thứ ba có thể dùng cách gọi API lạ (gọi `window.parent.API` thay vì tìm từ chính khung) nên không chạy; gói như vậy cần chỉnh lại.
  - Gói tải tài nguyên ngoài (phông, mã từ máy chủ khác) bị CSP chặn.
- Khả năng tương thích: không đổi hành vi học liệu, hoạt động cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 28h; migration chỉ thêm bảng, dòng loại học liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28h: gói SCORM và gói khoá học (nhập gói SCORM 1.2, 2004 vào kho học liệu qua duyệt, phát cô lập ở nguồn gốc riêng có mã truy cập ngắn hạn, bộ chuyển API ghi kết quả hoạt động, xuất nhập gói khoá học giữa các trường) (YCTD-278) | Đã triển khai |

## index Số đếm

| 10 | mã chức năng | +4 |
| 10 | còn hiệu lực | +4 |
| 14 | màn hình | +3 |
| 16 | bảng dự kiến | +3 |
| Chức năng đã liệt kê | Số lượng | +4 |
| Chức năng đã liệt kê | mã; | +4 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +6 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +6 |
| Bảng dữ liệu dự kiến | Số lượng | +3 |
| Màn hình dự kiến | Số lượng | +3 |
| Ca kiểm thử khởi đầu | Số lượng | +9 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-495 đến MH-497 (YCTD-278) |

## Thêm dòng

| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-50 | Nhập gói SCORM vào kho học liệu (YCTD-278, DT-28 phần 28h) | Giáo viên (người soạn học liệu); tổ trưởng, Ban Giám hiệu duyệt | Tệp zip SCORM 1.2 hoặc 2004 | Kiểm bản kê, SCO, đường dẫn, loại tệp, cỡ; lưu tệp đã giải nén; mỗi lần tải là một phiên bản của học liệu loại "Gói bài giảng SCORM", gửi duyệt như mọi học liệu; xem trước trong khung cô lập | Gói SCORM của phiên bản học liệu | BR-380, BR-381 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-51 | Phát gói SCORM cô lập (YCTD-278) | Học sinh; giáo viên xem lượt chạy | Hoạt động gói SCORM đã mở | Mã truy cập ngắn hạn; tệp phục vụ ở nguồn gốc riêng (CSP sandbox), chỉ nạp từ gói; bộ chuyển API SCORM 1.2, 2004 qua postMessage; lưu trạng thái, điểm, thời gian, dữ liệu tạm | Lượt chạy theo SCO, kết quả hoạt động | BR-382, BR-383, BR-384 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-52 | Hoạt động gói SCORM (YCTD-278) | Giáo viên của lớp học trực tuyến; người soạn khoá mẫu | Học liệu gói SCORM đã công bố, cách tính hoàn thành | Hoàn thành khi xong mọi SCO, đạt khi mọi SCO đạt hoặc đủ điểm đạt, hoặc giáo viên ghi; đặt được trong khoá mẫu | Hoạt động loại `scorm` | BR-384 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-53 | Xuất, nhập gói khoá học giữa các trường (YCTD-278) | Người xem được khoá mẫu xuất; người soạn khoá mẫu nhập | Khoá học mẫu; tệp `.khoahoc.gz` | Xuất khoá mẫu kèm học liệu đã công bố (tệp, liên kết, gói SCORM), không có dữ liệu học sinh; nhập thành khoá mẫu nháp, học liệu trùng dùng lại, học liệu mới gửi duyệt | Gói khoá học, khoá mẫu nháp, nhật ký | BR-385 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-380 | Gói SCORM là học liệu (YCTD-278, DT-28 phần 28h): học liệu loại `scorm` (cần Ban Giám hiệu duyệt) nhận tệp zip SCORM 1.2 hoặc 2004 tối đa 200 MB (GD-150); chỉ người soạn tải khi học liệu còn sửa được; mỗi lần tải là một phiên bản; học liệu loại khác không nhận gói; hoạt động chỉ dùng bản đã công bố theo Thông tư 09/2021/TT-BGDĐT Điều 7 khoản 3; vi phạm: 403, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-381 | Kiểm gói SCORM (YCTD-278): phải có `imsmanifest.xml` ở thư mục gốc; chuẩn 2004 khi bản kê ghi `2004`, `CAM 1.3` hoặc dùng `adlcp_v1p3`, còn lại 1.2; SCO lấy theo tổ chức mặc định (không có thì tổ chức đầu), mỗi SCO trỏ tới tệp có trong gói, mã SCO không trùng; tối đa 2.000 tệp, giải nén 500 MB, mỗi tệp 200 MB; không nhận zip mật khẩu, ZIP64, cách nén khác lưu thẳng và deflate, đường dẫn tuyệt đối hay có `..`, loại tệp ngoài danh sách bài giảng web; vi phạm: 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-382 | Phát gói SCORM cô lập (YCTD-278): tệp chỉ mở được bằng mã truy cập ký HMAC còn hạn (4 giờ) của đúng trường; mọi tệp có CSP `sandbox allow-scripts` (nguồn gốc riêng), chỉ nạp mã, kiểu, ảnh, âm thanh, phông từ chính gói, không gửi biểu mẫu, không gọi máy chủ ngoài; khung ở ứng dụng có `sandbox="allow-scripts"`, không có `allow-same-origin`; mở bài cần tiêu đề `Origin` của trang mở; vi phạm: 404, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-383 | Bộ chuyển API SCORM (YCTD-278): gói gọi `API` (1.2) hoặc `API_1484_11` (2004) ngay trong khung; giá trị ban đầu do máy chủ gắn; người học chỉ là "Học sinh" với mã ẩn danh; không ghi được khóa chỉ đọc; thay đổi gửi lên trang cha bằng `postMessage`, trang cha chỉ nhận từ khung đang mở và nguồn gốc của nội dung; dữ liệu tạm tối đa 4.096 ký tự (1.2) hoặc 64.000 ký tự (2004), vị trí 1.000 ký tự; thời gian phiên quá 24 giờ tính 24 giờ; vi phạm: 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-384 | Kết quả hoạt động gói SCORM (YCTD-278, GD-153): điểm mỗi SCO quy về thang 10 (`score.scaled` của 2004, không thì `raw` theo `min`, `max`, thiếu `max` coi thang 100); điểm hoạt động là trung bình các SCO có điểm; chưa SCO nào chạy là chưa làm, chưa xong hết là đang làm; `submit` xong mọi SCO là hoàn thành; `pass` mọi SCO đạt là đạt, có SCO chưa đạt là chưa đạt, gói không báo đạt thì so điểm với điểm đạt; `teacher` gói không tự hoàn thành; kết quả giáo viên đã miễn không bị ghi đè; nhiều SCO chạy lần lượt, không trình tự và điều hướng |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-385 | Gói khoá học `school-management.course-package/1` (YCTD-278): xuất khoá mẫu người xem thấy được kèm học liệu đã công bố mà hoạt động tham chiếu (học liệu chưa công bố, giấy phép chặn hoặc không rõ, kế hoạch bài dạy tham chiếu thì không đóng gói, báo số bỏ qua); tối đa 300 MB; không chứa dữ liệu học sinh, kết quả, bài nộp; nhập cần quyền soạn khoá mẫu, tạo khoá mẫu nháp của người nhập qua duyệt như khoá tự soạn; học liệu trùng mã băm tệp hoặc liên kết dùng lại, còn lại tạo nháp, gửi duyệt; mã băm sai, giấy phép không có ở trường thì bỏ học liệu và hoạt động trỏ tới nó; vi phạm: 400, 403, 422 |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-111 | PQ-160 | Gói SCORM, gói khoá học (YCTD-278, DT-28 phần 28h): không thêm mã quyền; tải gói, xem gói, xem trước theo quyền kho học liệu (`P09.learning-resource.*`, người soạn mới tải được, người xem được học liệu theo 22h1 mới xem trước); lượt chạy của lớp cho giáo viên dạy được hoạt động (`P02.learning.teach` hoặc `P02.learning.view`); học sinh mở, ghi kết quả bằng `P02.learning.study` (kênh `student`); xuất gói khoá học cho người xem được khoá mẫu, nhập cho người có `P02.learning.template`; tệp của gói không cần mã phiên, chỉ cần mã truy cập ngắn hạn |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1040 | Cho học liệu loại Gói bài giảng SCORM của giáo viên / Khi tải tệp không phải zip, gói có `../ngoai.html`, gói lên học liệu loại phiếu, giáo viên khác tải, gói hợp lệ / Thì 422, 422, 422, 403; gói hợp lệ ghi chuẩn 1.2 và một SCO | CT-1340, CT-1345 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1041 | Cho gói đã tải / Khi xem trước, mở trang SCO, tệp mã, mã truy cập bị sửa, tệp không có / Thì trang có CSP `sandbox allow-scripts`, không có `X-Frame-Options`, bộ chuyển API đứng trước mã của gói; tệp mã đúng nội dung; mã sửa 404; tệp không có 404 | CT-1343, CT-1345 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1042 | Cho hoạt động gói SCORM cách tính đạt / Khi học liệu chưa công bố; đã công bố; học sinh mở bài, gửi đang làm, mở lại, gửi đạt 85 điểm có thời gian 5 phút; gửi SCO lạ; giáo viên khác xem lượt chạy / Thì 422; tạo được; trang có tên "Học sinh", nguồn gốc trang mở; đang làm; mở lại có `resume`; đạt, điểm 8,5, kết quả hoạt động nguồn `scorm`; SCO lạ 422; 403 | CT-1342, CT-1346 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1043 | Cho khoá mẫu có hoạt động gói SCORM và trang nội dung / Khi tổ trưởng xuất gói khoá học, nhập lại, phụ huynh nhập, nhập tệp không phải gói / Thì tệp gzip không bỏ qua học liệu nào; khoá mẫu nháp mới trỏ tới gói đã có (dùng lại); 403; 400; nhật ký có xuất và nhập | CT-1344, CT-1347 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1044 | Cho mã truy cập ký cho trường A / Khi sửa mã trường thành trường B, dùng khóa khác, quá hạn / Thì không mở được | CT-1343 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1045 | Cho giáo viên ở cổng quản trị, học sinh ở `#hoc-sinh` / Khi giáo viên tải gói ở học liệu và xem trước; học sinh mở hoạt động gói, gói thử đọc trang cha rồi báo đạt 90 điểm / Thì xem trước chạy trong khung `sandbox="allow-scripts"`; gói không đọc được trang cha; học sinh thấy "Đạt", "Điểm 9"; máy chủ có lượt chạy đạt, một phiên | CT-1348 |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-495 | Cổng quản trị: kho học liệu, chi tiết học liệu loại Gói bài giảng SCORM (YCTD-278): khối "Gói bài giảng SCORM" (mỗi gói: phiên bản, chuẩn, tên, số phần, số tệp, cỡ, nút "Xem trước"; người soạn: ô "Tệp zip của gói SCORM", nút "Tải gói SCORM"); khung xem trước cô lập, nút "Đóng xem trước"; thêm hoạt động ở lớp học trực tuyến có loại "Gói bài giảng SCORM" (người dùng: Giáo viên, tổ trưởng, Ban Giám hiệu) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-496 | Cổng quản trị: khoá học mẫu (YCTD-278): mỗi khoá mở ra có nút "Xuất gói khoá học" (tải tệp `.khoahoc.gz`, báo số học liệu không đóng gói được); khối "Nhập gói khoá học từ trường khác" (ô tệp, nút "Nhập gói", kết quả: số học liệu mới đã gửi duyệt, số dùng lại, mục bỏ qua kèm lý do) (người dùng: Người soạn khoá mẫu) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-497 | Học sinh (`#hoc-sinh`): mở hoạt động gói SCORM hiện khối "Bài giảng {tên}" (nhãn trạng thái, điểm; các phần khi gói nhiều SCO; khung nội dung cô lập; dòng nhắc bài chạy trong khung riêng, tự lưu; nút "Phần tiếp theo", "Đóng bài giảng") (người dùng: Học sinh) |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1340 | P03-50 | CT-28h-1: đọc gói zip; chặn thoát thư mục, loại tệp không cho phép, thiếu bản kê, SCO trỏ tới tệp không có, tệp không phải zip | Đúng | Đạt 28/10/2026; `apps/api/src/learning/content-packages/scorm-rules.test.ts`; AC-1040 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1341 | P03-50 | CT-28h-2: SCORM 2004 nhiều SCO theo tổ chức mặc định, `xml:base`, tên tệp có dấu cách; bỏ tài nguyên asset | Đúng | Đạt 28/10/2026; `scorm-rules.test.ts` | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1342 | P03-51, P03-52 | CT-28h-3: mô hình dữ liệu 1.2, 2004: trạng thái, điểm về thang 10, thời gian phiên, giới hạn dữ liệu tạm; kết quả hoạt động theo cách tính | Đúng | Đạt 28/10/2026; `scorm-rules.test.ts`; AC-1042 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1343 | P03-51 | CT-28h-4: mã truy cập HMAC có hạn, sửa mã trường hoặc khóa khác thì không mở; CSP sandbox; bộ chuyển API đứng trước mã của gói, dữ liệu không đóng được thẻ script | Đúng | Đạt 28/10/2026; `scorm-rules.test.ts`; AC-1041, AC-1044 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1344 | P03-53 | CT-28h-5: gói khoá học: đọc, kiểm mã băm từng học liệu, nối lại mã học liệu, bỏ hoạt động có học liệu không nhập được | Đúng | Đạt 28/10/2026; `scorm-rules.test.ts`; AC-1043 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1345 | P03-50, P03-51 | CT-28h-6: tải gói lên học liệu loại SCORM; gói sai, thoát thư mục, loại học liệu khác, người khác bị chặn; xem trước có CSP sandbox, không chặn khung chung | Đúng | Đạt 28/10/2026; `apps/api/src/learning/content-packages/scorm.test.ts`; AC-1040, AC-1041 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1346 | P03-51, P03-52 | CT-28h-7: hoạt động SCORM chỉ dùng học liệu đã công bố; học sinh mở bài, gửi giá trị, mở lại tiếp tục; kết quả hoạt động; lượt chạy cho giáo viên | Đúng | Đạt 28/10/2026; `scorm.test.ts`; AC-1042 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1347 | P03-53 | CT-28h-8: xuất khoá mẫu thành gói khoá học kèm gói SCORM; nhập lại thành khoá mẫu nháp, học liệu trùng dùng lại; người không soạn khoá mẫu 403 | Đúng | Đạt 28/10/2026; `scorm.test.ts`; AC-1043 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1348 | P03-50, P03-51 | CT-28h-9: giao diện: giáo viên tải gói, xem trước trong khung cô lập; học sinh học gói, gói không đọc được trang cha, kết quả đạt ghi về máy chủ | Đúng | Đạt 28/10/2026; e2e `tests/e2e/217-scorm-packages.spec.ts`; AC-1045 | Cao |
| 22_BAO_MAT.md | BM-101 | BM-200 | Cô lập gói SCORM (YCTD-278, BR-382): gói là mã của bên thứ ba chạy trên máy học sinh; tệp phục vụ với CSP `sandbox allow-scripts` nên luôn ở nguồn gốc riêng (kể cả khi mở thẳng đường dẫn), không đọc được mã phiên, cookie, bộ nhớ của ứng dụng; chỉ nạp từ chính gói, không gọi máy chủ ngoài, không gửi biểu mẫu, không nhúng đối tượng; khung ở ứng dụng không có `allow-same-origin`; trang cha chỉ nhận tin từ đúng khung, đúng nguồn gốc; gói không biết tên thật của học sinh |
| 22_BAO_MAT.md | BM-101 | BM-201 | Mã truy cập gói SCORM (YCTD-278): ký HMAC-SHA256 bằng khóa dẫn xuất từ khóa băm của nền tảng, hạn 4 giờ, gắn trường, gói, hoạt động, học sinh, nguồn gốc trang cha; ở chế độ nhiều trường máy chủ lấy trường từ mã rồi kiểm chữ ký và mã trường trùng trường của yêu cầu; tệp của gói lưu ở kho theo tiền tố trường; gói khoá học không chứa dữ liệu học sinh |
