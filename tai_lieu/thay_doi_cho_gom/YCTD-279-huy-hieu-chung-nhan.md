---
yctd: YCTD-279
tieu_de: DT-28 phần 28i: huy hiệu và chứng nhận hoàn thành
ngay: 2026-10-28
phien_ban_de_xuat: 0.168.0
---

## 02 Nhật ký

### 2026-10-28 — DT-28 phần 28i: huy hiệu và chứng nhận hoàn thành

#### Công việc đã thực hiện

- Làm phần 28i theo `32` mục 20.6, 20.7. Tắt mặc định (GD-155); Ban Giám hiệu bật ở mục 9.3, đặt mẫu chứng nhận (tên chứng nhận, chức danh, họ tên người ký).
- **Huy hiệu nội bộ:**
  - Tự động theo tiêu chí có sẵn: hoàn thành chương, hoàn thành khoá, nộp bài đúng hạn 5 lần liên tiếp trong một lớp học trực tuyến. Máy tính khi mở danh sách, mỗi tiêu chí ghi một lần.
  - Giáo viên của lớp học trực tuyến trao huy hiệu kèm lý do, thu hồi có lý do.
  - Chỉ học sinh đó, phụ huynh, giáo viên thấy; không bảng xếp hạng, không đếm hay so sánh giữa học sinh.
- **Chứng nhận hoàn thành khoá tự chọn:**
  - Giáo viên của khoá cấp cho học sinh đã hoàn thành mọi hoạt động bắt buộc.
  - Tệp PDF theo mẫu của trường, có mã kiểm tra, đường dẫn trang kiểm tra.
  - Thu hồi có lý do; thu hồi rồi cấp lại được.
- **Trang kiểm tra công khai** `/api/v1/public/certificates/{mã}` theo tên miền của trường: chỉ tên khoá, ngày cấp, tên trường, họ tên viết tắt, trạng thái (hợp lệ, đã thu hồi); có giới hạn tần suất.
- **Giao diện:**
  - Ứng dụng giáo viên: màn hình "Huy hiệu, chứng nhận" của lớp học trực tuyến.
  - Học sinh `#hoc-sinh` và ứng dụng phụ huynh: khối huy hiệu, chứng nhận của em.
  - Cổng quản trị: khối cấu hình ở mục 9.3.
- **Kiểm thử:** 5/5 ca của `recognition-rules.test.ts`, `recognition.test.ts`; e2e `218-badges-certificates`.

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-279):
  - Ngưỡng nộp đúng hạn liên tiếp là 5, mỗi lớp học trực tuyến một huy hiệu.
  - Huy hiệu tự động đã thu hồi không trao lại.
  - Họ tên viết tắt là chữ đầu của họ, tên đệm cộng tên (Nguyễn Văn An thành N. V. An), lưu sẵn lúc cấp.
  - Mã kiểm tra `CN-` cộng 10 ký tự, bỏ ký tự dễ nhầm.
  - Cấu hình lưu ở `settings` khóa `learning_recognition`.
- Migration năm học 0191 (`learning_badges`), 0192 (`course_certificates`); không thêm quyền.
- Mã khối riêng (BR-390, AC-1050, MH-500, CT-1350, BM-205, PQ-165, P03-55) để không va với PR đang mở; dòng bảng mới neo vào dòng của 28b; mục mới 12O, 18N, 17.8 đặt sau mục của 28h.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-279, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Trang kiểm tra chỉ tra chứng nhận ở cơ sở dữ liệu năm học hiện tại; chứng nhận của năm học đã đóng chưa tra được.
- Chứng nhận cho khoá của 27d (khoá học ghi sẵn của gia sư) để khi 27d cần.
- Huy hiệu tương thích Open Badges không làm.
- Việc sau của 28h (ghi ở YCTD-278): spec nhiều trường cho gói SCORM; tên miền nội dung ở cổng biên.

## 24 Yêu cầu thay đổi

### YCTD-279: DT-28 phần 28i: huy hiệu và chứng nhận hoàn thành – 2026-10-28

- Lý do: phần 28i của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270): huy hiệu, chứng nhận tuỳ chọn (GD-155: tắt mặc định, không bảng xếp hạng, chứng nhận chỉ cho khoá tự chọn).
- Căn cứ: Luật 91/2025 Điều 24 về dữ liệu cá nhân của trẻ, theo phần tóm tắt ở 20.2 (không công bố, so sánh học sinh; trang công khai chỉ có họ tên viết tắt). Phiên này không đọc lại văn bản gốc.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Cấu hình:** `learning_recognition` (bật huy hiệu, bật chứng nhận, tên chứng nhận, chức danh và họ tên người ký); chỉ Ban Giám hiệu đọc, ghi.
  - **Huy hiệu tự động** (`learning_badges`, mỗi em, mỗi lớp học trực tuyến, mỗi tiêu chí một dòng):
    - Hoàn thành chương: chương có hoạt động bắt buộc, mọi hoạt động bắt buộc xong (hoàn thành, đạt, được miễn).
    - Hoàn thành khoá: mọi chương có hoạt động bắt buộc đều xong.
    - Nộp đúng hạn 5 lần liên tiếp: bài nộp không muộn theo thời điểm nộp, tính cả bài nhóm của nhóm em.
  - **Huy hiệu của giáo viên:**
    - Giáo viên dạy được lớp học trực tuyến trao cho học sinh của lớp; tên 1 đến 120 ký tự, lý do 1 đến 500 ký tự.
    - Thu hồi có lý do; thu hồi thì ẩn với học sinh, phụ huynh, vẫn lưu.
  - **Phạm vi xem:** học sinh (kênh `student`), phụ huynh của em, giáo viên của lớp học trực tuyến (danh sách theo tên, không xếp hạng, không đếm).
  - **Chứng nhận** (`course_certificates`):
    - Chỉ khoá tự chọn, chỉ học sinh đã hoàn thành khoá; mỗi em, mỗi khoá một chứng nhận còn hiệu lực.
    - Lưu sẵn tên khoá, tên trường, họ tên, họ tên viết tắt lúc cấp.
    - PDF A4 ngang theo mẫu của trường cho giáo viên xem được lớp, phụ huynh của em, chính học sinh.
    - Thu hồi có lý do.
  - **Trang kiểm tra công khai:**
    - Mã sai dạng hay không có thì 404.
    - Trang chỉ có tên khoá, người nhận (họ tên viết tắt), ngày cấp, tên trường, ngày thu hồi nếu có.
    - CSP không cho mã, `noindex`; giới hạn 60 yêu cầu mỗi phút mỗi địa chỉ.
- Thành phần bị ảnh hưởng:
  - `apps/api`: thư mục mới `learning/recognition`; đăng ký thêm cuối `application.module.ts`; khai báo tuyến công khai ở `tenancy-route-policy.ts`.
  - `apps/teacher`: `RecognitionScreen.tsx`, `OnlineClassesScreen.tsx`.
  - `apps/parent`: `RecognitionList.tsx`, `OnlineLearningPanel.tsx`, `StudentLearningPanel.tsx`.
  - `apps/portal`: `RecognitionSettings.tsx`, `OnlineTeachingPage.tsx`.
  - `database`: năm học 0191, 0192.
  - `tests/e2e/218-badges-certificates.spec.ts`.
- Dữ liệu bị ảnh hưởng: năm học `0191`, `0192`.
- API bị ảnh hưởng: `/api/v1/learning/recognition/config`, `/learning/spaces/{id}/recognition`, `/badges`, `/certificates`, `/learning/children/{childId}/recognition`, `/student/recognition`, `/public/certificates/{mã}` (xem `17_DAC_TA_API.md` mục 17.8).
- Giao diện bị ảnh hưởng: MH-500 đến MH-502.
- Quyền bị ảnh hưởng: PQ-165 (không thêm mã quyền).
- Ảnh hưởng chức năng cũ: không đổi; tắt mặc định nên trường không bật thì không thấy gì.
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho; e2e `single` (spec 218 cùng các spec hiện có); typecheck, lint, build.
- Chưa làm (YCTD sau): tra chứng nhận của năm học đã đóng; chứng nhận cho khoá của 27d; Open Badges.
- Trạng thái: Đã triển khai (PR chờ)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-28 phần 28i, huy hiệu và chứng nhận hoàn thành (YCTD-279).
- Chức năng mới:
  - Huy hiệu nội bộ (P03-55, MH-500, MH-501).
  - Chứng nhận hoàn thành khoá tự chọn (P03-56, MH-500, MH-501).
  - Trang kiểm tra chứng nhận công khai, cấu hình của trường (P03-57, MH-502).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0191`, `0192`; xem `16_CO_SO_DU_LIEU.md` mục 18N.
- Thay đổi API: xem `17_DAC_TA_API.md` mục 17.8.
- Kiểm thử: kịch bản CT-1350 đến CT-1355 (CT-28i-1 đến CT-28i-6 trong mã kiểm thử).
- Rủi ro: huy hiệu tự động tính khi mở danh sách nên có độ trễ tới lần mở kế tiếp; chứng nhận năm học cũ chưa tra được.
- Khả năng tương thích: tắt mặc định, không đổi hành vi cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 28i; migration chỉ thêm bảng.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28i: huy hiệu và chứng nhận hoàn thành (tắt mặc định; huy hiệu nội bộ tự động và do giáo viên trao, không bảng xếp hạng; chứng nhận PDF cho khoá tự chọn, mã kiểm tra, trang kiểm tra công khai chỉ họ tên viết tắt, thu hồi được) (YCTD-279) | Đã triển khai |

## index Số đếm

| 10 | mã chức năng | +3 |
| 10 | còn hiệu lực | +3 |
| 14 | màn hình | +3 |
| 16 | bảng dự kiến | +2 |
| Chức năng đã liệt kê | Số lượng | +3 |
| Chức năng đã liệt kê | mã; | +3 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +6 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +6 |
| Bảng dữ liệu dự kiến | Số lượng | +2 |
| Màn hình dự kiến | Số lượng | +3 |
| Ca kiểm thử khởi đầu | Số lượng | +6 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-500 đến MH-502 (YCTD-279) |

## Thêm dòng

| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-55 | Huy hiệu nội bộ của học tập trực tuyến (YCTD-279, DT-28 phần 28i) | Học sinh, phụ huynh xem; giáo viên của lớp học trực tuyến trao, thu hồi | Tiến độ hoạt động, bài nộp; tên và lý do khi giáo viên trao | Tự động khi hoàn thành chương, khoá, nộp đúng hạn 5 lần liên tiếp; giáo viên trao kèm lý do; chỉ em, phụ huynh, giáo viên thấy; không bảng xếp hạng | Huy hiệu của em | BR-390, BR-391, BR-392 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-56 | Chứng nhận hoàn thành khoá tự chọn (YCTD-279) | Giáo viên của khoá tự chọn cấp, thu hồi; học sinh, phụ huynh tải | Học sinh đã hoàn thành khoá, mẫu của trường | Cấp một chứng nhận còn hiệu lực mỗi em mỗi khoá; PDF có mã kiểm tra; thu hồi có lý do | Chứng nhận PDF, mã kiểm tra | BR-393, BR-394 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-57 | Trang kiểm tra chứng nhận công khai, cấu hình huy hiệu, chứng nhận (YCTD-279) | Người bất kỳ có mã; Ban Giám hiệu cấu hình | Mã kiểm tra; bật, tắt, mẫu chứng nhận | Trang theo tên miền của trường chỉ hiện tên khoá, ngày cấp, tên trường, họ tên viết tắt, trạng thái; tắt mặc định | Trang kiểm tra, cấu hình | BR-390, BR-395 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-390 | Huy hiệu, chứng nhận tắt mặc định (YCTD-279, DT-28 phần 28i, GD-155): chỉ Ban Giám hiệu (người có `P02.learning.decide`, hoặc có cả `P02.learning.view` và quyền duyệt học liệu) bật huy hiệu, bật chứng nhận, đặt tên chứng nhận, chức danh và họ tên người ký (mỗi mục tối đa 120 ký tự); chưa bật thì học sinh, phụ huynh không thấy, giáo viên không trao, không cấp được; vi phạm: 403, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-391 | Huy hiệu tự động (YCTD-279): hoàn thành chương khi chương có hoạt động bắt buộc và mọi hoạt động bắt buộc đã hoàn thành, đạt hoặc được miễn; hoàn thành khoá khi mọi chương có hoạt động bắt buộc đều xong; nộp bài đúng hạn 5 lần liên tiếp trong một lớp học trực tuyến (tính bài nhóm của nhóm em); mỗi tiêu chí một huy hiệu cho mỗi em, mỗi lớp học trực tuyến; đã thu hồi thì không trao lại |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-392 | Huy hiệu do giáo viên trao và phạm vi xem (YCTD-279): chỉ giáo viên dạy được lớp học trực tuyến trao cho học sinh của lớp, tên 1 đến 120 ký tự, lý do 1 đến 500 ký tự; thu hồi có lý do; huy hiệu chỉ hiện với chính học sinh, phụ huynh của em, giáo viên của lớp; danh sách của giáo viên xếp theo tên, không xếp hạng, không đếm, không so sánh giữa học sinh; vi phạm: 403, 404, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-393 | Cấp chứng nhận (YCTD-279, GD-155): chỉ khoá tự chọn; chỉ giáo viên dạy được khoá cấp; học sinh phải học khoá và hoàn thành mọi hoạt động bắt buộc; mỗi em, mỗi khoá một chứng nhận còn hiệu lực; chứng nhận giữ tên khoá, tên trường, họ tên, họ tên viết tắt lúc cấp, mã `CN-` cộng 10 ký tự chữ hoa, số (bỏ 0, O, 1, I); vi phạm: 403, 404, 409, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-394 | Tệp và thu hồi chứng nhận (YCTD-279): tệp PDF theo mẫu của trường (tên chứng nhận, họ tên học sinh, tên khoá, ngày cấp, chức danh và họ tên người ký, mã kiểm tra, đường dẫn trang kiểm tra) cho giáo viên xem được lớp, phụ huynh của em, chính học sinh; chứng nhận đã thu hồi không tải được; thu hồi cần lý do tối đa 500 ký tự, giữ dòng, cấp lại được; vi phạm: 403, 404, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-395 | Trang kiểm tra chứng nhận công khai (YCTD-279): không cần đăng nhập, theo tên miền của trường, tra trong năm học hiện tại; chỉ hiện tên khoá, họ tên viết tắt, ngày cấp, tên trường, trạng thái hợp lệ hoặc đã thu hồi (kèm ngày); không hiện họ tên đầy đủ, ngày sinh, lớp; mã sai dạng hoặc không có thì 404; tối đa 60 yêu cầu mỗi phút mỗi địa chỉ mạng; vi phạm: 404, 429 |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-111 | PQ-165 | Huy hiệu, chứng nhận (YCTD-279, DT-28 phần 28i): không thêm mã quyền; cấu hình chỉ Ban Giám hiệu; trao, thu hồi huy hiệu, cấp, thu hồi chứng nhận cho giáo viên dạy được lớp học trực tuyến (quyền dạy hoặc xem học tập trực tuyến, kiểm qua cửa của lõi 28b); học sinh xem của mình bằng `P02.learning.study` (kênh `student`); phụ huynh kiểm theo học sinh; trang kiểm tra chứng nhận công khai |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1050 | Cho trường chưa bật / Khi học sinh xem huy hiệu, giáo viên trao huy hiệu, giáo viên bật cấu hình, Ban Giám hiệu bật / Thì học sinh thấy tắt, danh sách trống; 422; 403; lưu được, có họ tên người ký | CT-1352 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1051 | Cho khoá tự chọn một chương một trang nội dung / Khi học sinh mở trang rồi xem huy hiệu hai lần / Thì có huy hiệu hoàn thành chương, hoàn thành khoá, lần sau không thêm | CT-1350, CT-1353 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1052 | Cho học sinh đã hoàn thành khoá / Khi giáo viên trao huy hiệu có lý do, không lý do; giáo viên khác trao; phụ huynh, phụ huynh khác xem; giáo viên thu hồi / Thì 201, 422, 403; phụ huynh thấy ba huy hiệu kèm lý do, phụ huynh khác 403; danh sách của giáo viên không có xếp hạng; sau thu hồi học sinh còn hai huy hiệu | CT-1353 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1053 | Cho học sinh chưa hoàn thành, rồi đã hoàn thành khoá tự chọn / Khi giáo viên cấp chứng nhận, cấp lần hai, phụ huynh, học sinh, phụ huynh khác tải PDF / Thì 422; 201 mã `CN-`; 409; PDF; PDF; 403 | CT-1354 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1054 | Cho chứng nhận của Nguyễn Văn An / Khi mở trang kiểm tra, mã không có, thu hồi không lý do, thu hồi có lý do, mở lại trang, cấp lại / Thì trang hợp lệ có "N. V. An", tên khoá, không có họ tên đầy đủ; 404; 422; thu hồi; trang "đã bị thu hồi"; cấp lại được | CT-1351, CT-1354 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1055 | Cho Ban Giám hiệu ở cổng quản trị, học sinh ở `#hoc-sinh`, giáo viên ở ứng dụng giáo viên / Khi bật ở mục 9.3; học sinh mở bài duy nhất của khoá tự chọn; giáo viên trao huy hiệu, cấp chứng nhận; mở trang kiểm tra / Thì học sinh thấy "Hoàn thành khoá học"; giáo viên thấy "Đã hoàn thành khoá", mã chứng nhận; trang "Chứng nhận hợp lệ" không có họ tên đầy đủ | CT-1355 |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-500 | Ứng dụng giáo viên: Huy hiệu, chứng nhận của lớp học trực tuyến (YCTD-279, nút ở chi tiết lớp học trực tuyến): dòng giải thích khi trường chưa bật; mỗi học sinh (xếp theo tên): nhãn "Đã hoàn thành khoá" hoặc "Chưa hoàn thành" (khoá tự chọn), huy hiệu kèm lý do, nút "Thu hồi"; nút "Trao huy hiệu" mở biểu mẫu tên huy hiệu, lý do, "Trao"; "Cấp chứng nhận", mã chứng nhận, "Tải chứng nhận" (người dùng: Giáo viên) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-501 | Học sinh (`#hoc-sinh`) và ứng dụng phụ huynh: khối "Huy hiệu, chứng nhận của em" hoặc "... của {tên con}" (chỉ khi trường bật): huy hiệu (tên, lớp học trực tuyến, lý do), chứng nhận (tên khoá, mã, nút "Tải chứng nhận") (người dùng: Học sinh, Phụ huynh) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-502 | Cổng quản trị: 9.3 Hình thức và nội quy dạy học trực tuyến, khối "Huy hiệu và chứng nhận hoàn thành" (YCTD-279, chỉ Ban Giám hiệu): dòng giải thích phạm vi xem; "Bật huy hiệu", "Bật chứng nhận hoàn thành khoá tự chọn"; "Tên chứng nhận", "Chức danh người ký", "Họ tên người ký"; nút "Lưu cấu hình huy hiệu, chứng nhận". Trang kiểm tra công khai `/api/v1/public/certificates/{mã}` (người dùng: Ban Giám hiệu; người bất kỳ có mã) |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1350 | P03-55 | CT-28i-1: tắt mặc định; huy hiệu chương, khoá khi xong mọi hoạt động bắt buộc; chương không có hoạt động bắt buộc không tính; nộp đúng hạn 5 lần liên tiếp | Đúng | Đạt 28/10/2026; `apps/api/src/learning/recognition/recognition-rules.test.ts`; AC-1051 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1351 | P03-56, P03-57 | CT-28i-2: họ tên viết tắt; mã kiểm tra không có ký tự dễ nhầm; trang kiểm tra chỉ có tên khoá, ngày, trường, tên viết tắt, thoát ký tự HTML | Đúng | Đạt 28/10/2026; `recognition-rules.test.ts`; AC-1054 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1352 | P03-57 | CT-28i-3: tắt mặc định với học sinh, phụ huynh, giáo viên; chỉ Ban Giám hiệu bật | Đúng | Đạt 28/10/2026; `apps/api/src/learning/recognition/recognition.test.ts`; AC-1050 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1353 | P03-55 | CT-28i-4: huy hiệu tự động khi xong chương, khoá; giáo viên trao kèm lý do, thu hồi; phụ huynh khác 403; không xếp hạng | Đúng | Đạt 28/10/2026; `recognition.test.ts`; AC-1051, AC-1052 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1354 | P03-56, P03-57 | CT-28i-5: chứng nhận khoá tự chọn: cấp, không cấp trùng, PDF, trang kiểm tra công khai chỉ tên viết tắt, thu hồi, cấp lại | Đúng | Đạt 28/10/2026; `recognition.test.ts`; AC-1053, AC-1054 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1355 | P03-55, P03-56, P03-57 | CT-28i-6: giao diện: Ban Giám hiệu bật; học sinh có huy hiệu hoàn thành khoá; giáo viên trao huy hiệu, cấp chứng nhận; trang kiểm tra công khai | Đúng | Đạt 28/10/2026; e2e `tests/e2e/218-badges-certificates.spec.ts`; AC-1055 | Cao |
| 22_BAO_MAT.md | BM-101 | BM-205 | Huy hiệu không thành bảng xếp hạng (YCTD-279, BR-392, GD-155): huy hiệu là dữ liệu của trẻ, chỉ chính học sinh, phụ huynh của em, giáo viên của lớp xem; không có tuyến liệt kê, đếm, xếp hạng huy hiệu giữa học sinh; thu hồi giữ dòng, có người, lý do |
| 22_BAO_MAT.md | BM-101 | BM-206 | Trang kiểm tra chứng nhận công khai (YCTD-279, BR-395): không cần đăng nhập nên chỉ hiện họ tên viết tắt, tên khoá, ngày cấp, tên trường, trạng thái; mã ngẫu nhiên 10 ký tự (khoảng 50 bit) khó đoán; giới hạn tần suất theo địa chỉ mạng; trang không có mã, không cho nhúng khung, `noindex`, không lưu đệm |
