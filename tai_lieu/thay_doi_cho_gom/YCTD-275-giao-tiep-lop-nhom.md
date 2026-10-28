---
yctd: YCTD-275
tieu_de: DT-28 phần 28e: giao tiếp trong lớp và nhóm
ngay: 2026-10-28
phien_ban_de_xuat: 0.162.0
---

## 02 Nhật ký

### 2026-10-28 — DT-28 phần 28e: giao tiếp trong lớp và nhóm

#### Công việc đã thực hiện

- Làm phần 28e theo `32` mục 20.6, 20.7: một bộ máy thảo luận cho thông báo lớp, diễn đàn, hỏi đáp (lớp học trực tuyến) và bảng tin của không gian học nhóm (nhóm của bộ nhóm 28a):
  - Thông báo lớp tới học sinh, phụ huynh qua hàng đợi thông báo; tin đẩy không có nội dung.
  - Diễn đàn: học sinh mở chủ đề khi giáo viên cho.
  - Hỏi đáp: câu hỏi riêng, hàng chờ câu chưa trả lời (quá 48 giờ là quá hạn), giáo viên xác nhận câu trả lời.
  - Không gian học nhóm: bảng tin, việc chia việc, ghi chú chung có phiên bản, tệp chung.
- An toàn trẻ em:
  - Giáo viên của lớp và người lập bộ nhóm luôn thấy mọi nội dung; không có nhắn riêng giữa hai học sinh.
  - Lọc che số điện thoại, thư điện tử, liên kết, mạng xã hội, từ ngữ của trường (hàm thuần `scanContactInfo` ở `packages/shared`, 27i dùng lại).
  - Giờ mở do trường tự đặt (GD-144 Eric đã chốt 2026-10-28: trường tự cấu hình, mặc định không giới hạn); xóa của học sinh là ẩn, vẫn lưu.
  - Báo cáo vi phạm, hàng chờ của trường có hạn 2 ngày; tạm khóa quyền viết.
- Phụ huynh: thông báo lớp, không gian nhóm của con theo GD-145, lịch học tập của con. Học sinh có lịch học tập tuần (thời khoá biểu, ngày mở, hạn hoạt động; không iCal, GD-157).
- Giao diện:
  - Ứng dụng giáo viên: Thông báo, thảo luận, hỏi đáp.
  - Học sinh `#hoc-sinh`: thảo luận của lớp, nhóm của em, lịch học tập.
  - Phụ huynh: thông báo lớp, nhóm, lịch của con.
  - Cổng quản trị: mục 9.5 An toàn thảo luận (hàng chờ, giờ mở, từ ngữ lọc).
- Kiểm thử: 10/10 ca của `discussion-rules.test.ts`, `discussions.test.ts`; hồi quy `learning`, `assignments`, `progress`, `quick-links`, `school-levels`, `school-plan`, `child-groups`; `migrate.test.ts`; e2e `214-class-discussions` đạt (chạy kèm spec nền 01 đến 09; spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường).

#### Quyết định

- Claude chọn theo ủy quyền:
  - Báo cáo vi phạm do bộ lọc từ ngữ tự gửi (`source = filter`); thông tin liên lạc chỉ che, không gửi hàng chờ.
  - Chủ nhiệm (VT-07) có quyền xử lý nhưng máy chủ chỉ cho xem báo cáo của lớp mình; Ban Giám hiệu xem mọi báo cáo.
  - Trường chưa có vai trò người tư vấn tâm lý học đường; trường gán quyền `P02.discussion.moderate` cho vai trò đó ở phân quyền nhóm.
  - Mẫu thông báo mới `class_announcement` (trong ứng dụng) và `class_announcement_push` (đẩy, không nội dung); 28e là phần duy nhất thêm mẫu thông báo.
- Mã khối riêng (BR-340, AC-1000, MH-460, CT-1280, BM-180, PQ-140, P03-28) để không va với các PR đang mở; dòng bảng mới neo vào dòng của 28b như 28c, 28d.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-275, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Ảnh trong câu hỏi chưa làm (chỉ chữ); 28g thêm giờ học trực tuyến vào lịch, 28f thêm bài về nhà; báo cáo liên quan con chưa tự thông báo cho phụ huynh THCS, THPT.

## 24 Yêu cầu thay đổi

### YCTD-275: DT-28 phần 28e: giao tiếp trong lớp và nhóm – 2026-10-28

- Lý do: phần 28e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270); Eric yêu cầu học nhóm không video là một trong bốn tính năng chính của DT-28.
- Căn cứ:
  - Thông tư 09/2021/TT-BGDĐT Điều 15 khoản 1 điểm e (thông tin, hướng dẫn tới học sinh, cha mẹ học sinh); toàn văn đọc khi viết kế hoạch, mục 20.2.
  - Luật Trẻ em và Luật 91/2025 Điều 24 về dữ liệu cá nhân của trẻ: phiên này không đọc lại văn bản gốc; ràng buộc theo phần đã tóm tắt ở 20.2 (bài viết của trẻ là dữ liệu của trẻ, phạm vi xem theo 20.7, không công bố ra ngoài lớp).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Bộ máy thảo luận** (`discussion_threads`, `discussion_posts`, `discussion_reports`):
    - Phạm vi `course_space` (thông báo, diễn đàn, hỏi đáp) hoặc `group` (bảng tin của nhóm).
    - Trả lời một tầng; khoá chủ đề; ẩn, hiện lại.
  - **Thông báo lớp**: chỉ giáo viên của lớp học trực tuyến đăng.
    - Hàng đợi thông báo trong ứng dụng tới phụ huynh và tài khoản học sinh (mẫu `class_announcement`).
    - Tin đẩy cho phụ huynh không có nội dung (mẫu `class_announcement_push`).
  - **Hỏi đáp**:
    - Học sinh hỏi, gắn chương hoặc hoạt động; câu hỏi riêng chỉ người hỏi và giáo viên thấy, trả lời.
    - Giáo viên xác nhận câu trả lời đúng.
    - Hàng chờ câu chưa có giáo viên trả lời, quá 48 giờ là quá hạn.
  - **Không gian học nhóm**:
    - Thành viên nhóm của bộ nhóm đang dùng.
    - Việc (người làm phải trong nhóm, hạn, trạng thái); ghi chú chung có phiên bản (409 khi bản cũ).
    - Tệp JPEG, PNG, PDF tối đa 10 MB.
  - **An toàn trẻ em** (trường không tắt được):
    - Giáo viên của lớp, người lập bộ nhóm luôn thấy; không có tuyến nhắn riêng giữa hai học sinh.
    - Chữ học sinh viết được che số điện thoại, thư điện tử, liên kết ngoài, tài khoản mạng xã hội và từ ngữ của trường (`discussion_blocked_words`).
    - Xóa của học sinh là ẩn.
  - **Giờ mở (GD-144, Eric đã chốt 2026-10-28: trường tự cấu hình)**: Ban Giám hiệu đặt ở mục 9.5 (`discussion_open_hours`: khung giờ ngày học, cuối tuần). Chưa đặt là không giới hạn; ngoài giờ học sinh chỉ đọc, giáo viên vẫn viết.
  - **Hàng chờ báo cáo**:
    - Học sinh, giáo viên báo cáo; bộ lọc từ ngữ tự gửi; hạn xử lý 2 ngày.
    - Người xử lý (`P02.discussion.moderate`) ghi kết quả, ẩn nội dung, tạm khóa quyền viết 1 đến 30 ngày.
    - Chủ nhiệm chỉ thấy báo cáo của lớp mình.
  - **Phụ huynh** (GD-145, Eric chốt 2026-10-26): đọc thông báo lớp. Không gian nhóm của con: Tiểu học đọc toàn bộ; THCS, THPT thấy thành viên, việc, hạn, tệp, không đọc thảo luận.
  - **Lịch học tập**:
    - Tuần bắt đầu thứ Hai: tiết của thời khoá biểu đang áp dụng (cả lớp), ngày mở và hạn của hoạt động đã giao.
    - Phụ huynh xem lịch của con; không xuất iCal (GD-157).
  - **Quyền** (định danh 0182): `P02.discussion.moderate` cho VT-02, VT-15, VT-07; gắn quy tắc menu 9.1 và mục 9.5 để thuộc phân hệ học tập trực tuyến của gói.
- Thành phần bị ảnh hưởng:
  - `apps/api`: thư mục mới `learning/discussions`; đăng ký thêm cuối `application.module.ts`; danh sách ở `working-level.test.ts`.
  - `apps/teacher`: `DiscussionsScreen.tsx`, `OnlineClassesScreen.tsx`.
  - `apps/parent`: `StudentDiscussions.tsx`, `StudentLearningPanel.tsx`, `StudentHomeScreen.tsx`, `ChildCommunicationPanel.tsx`, `OnlineLearningPanel.tsx`.
  - `apps/portal`: `DiscussionSafetyPage.tsx`, `router.tsx`.
  - `packages/shared`: `contact-filter.ts`, mã quyền, đường dẫn, quy tắc menu, mục 9.5.
  - `database`: năm học 0182 đến 0184, định danh 0182.
  - `tests/e2e/214-class-discussions.spec.ts`.
- Dữ liệu bị ảnh hưởng: năm học `0182` đến `0184`; định danh `0182`.
- API bị ảnh hưởng: nhóm `/api/v1/learning` (thảo luận, nhóm, báo cáo, cấu hình), `/api/v1/student/discussions`, `/student/groups`, `/student/calendar` (xem `17_DAC_TA_API.md` mục 17.5).
- Giao diện bị ảnh hưởng: MH-460 đến MH-463.
- Quyền bị ảnh hưởng: PQ-140.
- Ảnh hưởng chức năng cũ: không đổi hành vi; thêm hai mẫu thông báo.
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho; e2e `single` (spec 214 cùng các spec hiện có); typecheck, lint, build.
- Chưa làm (YCTD sau): ảnh trong câu hỏi; giờ học trực tuyến (28g), bài về nhà (28f) trong lịch; tự báo phụ huynh THCS, THPT khi báo cáo liên quan con.
- Trạng thái: Đã triển khai (PR chờ)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-28 phần 28e, giao tiếp trong lớp và nhóm (YCTD-275).
- Chức năng mới:
  - Thông báo lớp (P03-28).
  - Diễn đàn, hỏi đáp (P03-29, MH-460, MH-461).
  - Không gian học nhóm (P03-30).
  - An toàn thảo luận (P03-31, MH-463).
  - Lịch học tập (P03-32, MH-462).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0182` đến `0184` (tám bảng); định danh `0182`; xem `16_CO_SO_DU_LIEU.md` mục 18K.
- Thay đổi API: xem `17_DAC_TA_API.md` mục 17.5.
- Kiểm thử: kịch bản CT-1280 đến CT-1290 (CT-28e-1 đến CT-28e-11 trong mã kiểm thử); `apps/api` 10/10 ca của 28e ngày 28/10/2026.
- Rủi ro: lọc chữ bằng mẫu có thể sót cách viết lách (số viết bằng chữ, dấu cách lạ); người xử lý vẫn cần hàng chờ báo cáo.
- Khả năng tương thích: không đổi hành vi các phân hệ cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 28e; migration chỉ thêm bảng và quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28e: giao tiếp trong lớp và nhóm (thông báo lớp tới học sinh, phụ huynh, diễn đàn, hỏi đáp có câu hỏi riêng và xác nhận câu trả lời, không gian học nhóm có việc, ghi chú, tệp, lọc thông tin liên lạc, báo cáo vi phạm và hàng chờ của trường, giờ mở do trường đặt, lịch học tập) (YCTD-275) | Đã triển khai |

## index Số đếm

| 10 | mã chức năng | +5 |
| 10 | còn hiệu lực | +5 |
| 14 | màn hình | +4 |
| 16 | bảng dự kiến | +8 |
| Chức năng đã liệt kê | Số lượng | +5 |
| Chức năng đã liệt kê | mã; | +5 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +7 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +6 |
| Bảng dữ liệu dự kiến | Số lượng | +8 |
| Màn hình dự kiến | Số lượng | +4 |
| Ca kiểm thử khởi đầu | Số lượng | +11 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-460 đến MH-463 (YCTD-275) |

## Thêm dòng

| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-28 | Thông báo lớp (YCTD-275, DT-28 phần 28e) | Giáo viên của lớp học trực tuyến; học sinh, phụ huynh nhận | Tiêu đề, nội dung | Đăng ở lớp học trực tuyến; gửi thông báo trong ứng dụng tới phụ huynh, tài khoản học sinh; tin đẩy không có nội dung | Thông báo lớp, thông báo trong ứng dụng | BR-340 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-29 | Diễn đàn và hỏi đáp của lớp học trực tuyến (YCTD-275) | Giáo viên; học sinh của lớp | Chủ đề, câu hỏi (có thể riêng), trả lời | Học sinh mở chủ đề khi giáo viên cho; câu hỏi riêng chỉ người hỏi và giáo viên thấy; hàng chờ câu chưa trả lời; giáo viên xác nhận câu trả lời, khoá, ẩn | Chủ đề, trả lời, câu trả lời được xác nhận | BR-341, BR-343 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-30 | Không gian học nhóm (YCTD-275) | Học sinh trong nhóm; người lập bộ nhóm, giáo viên của lớp | Tin, việc, ghi chú, tệp | Chỉ thành viên nhóm của bộ nhóm đang dùng; việc giao cho thành viên; ghi chú có phiên bản; tệp ảnh, PDF | Bảng tin, việc, ghi chú, tệp của nhóm | BR-342 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-31 | An toàn thảo luận (YCTD-275) | Học sinh, giáo viên báo cáo; Ban Giám hiệu, chủ nhiệm xử lý | Báo cáo, kết quả xử lý, giờ mở, từ ngữ lọc | Lọc che thông tin liên lạc, từ ngữ; hàng chờ có hạn; ẩn nội dung, tạm khóa quyền viết; ngoài giờ mở học sinh chỉ đọc | Hàng chờ, nội dung đã che hoặc ẩn | BR-343, BR-344 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-32 | Lịch học tập của học sinh (YCTD-275) | Học sinh; phụ huynh | Tuần | Ghép tiết của thời khoá biểu, ngày mở, hạn của hoạt động đã giao | Lịch tuần | BR-345 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-340 | Thông báo lớp và bộ máy thảo luận (YCTD-275, DT-28 phần 28e): mọi chủ đề thuộc một lớp học trực tuyến (thông báo, diễn đàn, hỏi đáp) hoặc một nhóm của bộ nhóm (bảng tin); không có nhắn riêng giữa hai học sinh; tiêu đề 1 đến 200 ký tự, nội dung 1 đến 5.000 ký tự, trả lời một tầng; thông báo lớp chỉ giáo viên của lớp đăng, không có trả lời, gửi thông báo trong ứng dụng tới phụ huynh và tài khoản học sinh của lớp, tin đẩy chỉ ghi "Có thông báo lớp mới"; vi phạm: 403, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-341 | Diễn đàn và hỏi đáp (YCTD-275): học sinh mở chủ đề diễn đàn chỉ khi giáo viên cho ở lớp đó; câu hỏi riêng chỉ người hỏi và giáo viên thấy, trả lời; giáo viên xác nhận một câu trả lời đúng; câu hỏi chưa có giáo viên trả lời và chưa xác nhận nằm trong hàng chờ của giáo viên, quá 48 giờ là quá hạn; chủ đề khoá thì học sinh không trả lời; vi phạm: 422, 404 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-342 | Không gian học nhóm (YCTD-275): thành viên nhóm thuộc bộ nhóm đang dùng; việc có người làm là thành viên của nhóm, hạn, trạng thái chưa làm, đang làm, xong; ghi chú chung lưu mỗi lần một phiên bản, gửi phiên bản cũ thì 409; tệp JPEG, PNG, PDF tối đa 10 MB, nhận theo byte đầu; nhóm khác không vào được; vi phạm: 404, 409, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-343 | An toàn trẻ em ở thảo luận (YCTD-275, trường không tắt được): giáo viên của lớp học trực tuyến và người lập bộ nhóm luôn thấy mọi nội dung kể cả đã ẩn, câu hỏi riêng; chữ học sinh viết được che số điện thoại, thư điện tử, liên kết ngoài, tài khoản mạng xã hội, từ ngữ trong danh sách của trường; có từ ngữ thì gửi hàng chờ của trường; học sinh xóa trả lời là ẩn, vẫn lưu; vi phạm: chữ bị che |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-344 | Hàng chờ báo cáo vi phạm và giờ mở (YCTD-275, GD-144): học sinh, giáo viên báo cáo chủ đề hoặc trả lời; hạn xử lý 2 ngày; người có `P02.discussion.moderate` ghi kết quả (đã xử lý, bỏ qua), ẩn nội dung, tạm khóa quyền viết của học sinh 1 đến 30 ngày có lý do; chủ nhiệm chỉ thấy báo cáo của lớp mình; giờ mở do Ban Giám hiệu đặt (khung ngày học, cuối tuần), chưa đặt là không giới hạn; ngoài giờ mở hoặc đang bị khóa thì học sinh chỉ đọc; vi phạm: 403, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-345 | Phụ huynh và lịch học tập (YCTD-275, GD-145, GD-157): phụ huynh đọc thông báo lớp của con; không gian nhóm của con: Tiểu học đọc toàn bộ (chỉ đọc), THCS, THPT thấy thành viên, việc, hạn, tệp, không đọc thảo luận; lịch học tập tuần (thứ Hai đến Chủ nhật) ghép tiết của thời khoá biểu đang áp dụng (tiết cả lớp), ngày mở, hạn của hoạt động đã giao; không xuất iCal; vi phạm: 403 |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-111 | PQ-140 | Giao tiếp trong lớp và nhóm (YCTD-275, DT-28 phần 28e): quyền mới `P02.discussion.moderate` (xử lý hàng chờ báo cáo vi phạm: ẩn, tạm khóa quyền viết, ghi kết quả) cho VT-02, VT-15, VT-07 (chủ nhiệm chỉ thấy báo cáo của lớp mình); trường gán thêm cho vai trò người tư vấn tâm lý học đường ở phân quyền nhóm; cấu hình giờ mở, từ ngữ lọc chỉ Ban Giám hiệu; giáo viên của lớp học trực tuyến đăng thông báo, khoá, ẩn, xác nhận câu trả lời ở lớp mình không cần quyền mới; học sinh dùng `P02.learning.study` (kênh `student`); phụ huynh kiểm theo học sinh |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1000 | Cho lớp 7A có phụ huynh của An, ba tài khoản học sinh / Khi giáo viên đăng thông báo lớp, học sinh xem, trả lời, đăng thông báo, phụ huynh xem, phụ huynh khác xem / Thì phụ huynh và ba học sinh nhận thông báo trong ứng dụng, tin đẩy không có nội dung; học sinh thấy thông báo, trả lời 422, đăng 400; phụ huynh của An thấy, phụ huynh khác 403 | CT-1284 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1001 | Cho diễn đàn của lớp / Khi học sinh mở chủ đề, giáo viên cho mở, học sinh viết số điện thoại, từ ngữ của trường, viết ngoài giờ mở, giáo viên viết ngoài giờ, Ban Giám hiệu, giáo viên lưu cấu hình / Thì bị chặn rồi mở được; số điện thoại bị che; từ ngữ bị che và vào hàng chờ; ngoài giờ học sinh 422, giáo viên viết được; Ban Giám hiệu lưu được, giáo viên 403 | CT-1285 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1002 | Cho câu hỏi riêng của An / Khi Bình mở, giáo viên xem hàng chờ, trả lời, xác nhận / Thì Bình 404 và không thấy trong danh sách; hàng chờ có câu hỏi; sau khi xác nhận hàng chờ trống, An thấy câu trả lời được xác nhận | CT-1286 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1003 | Cho Bình báo cáo trả lời của An / Khi chủ nhiệm 7A, chủ nhiệm khác, giáo viên bộ môn mở hàng chờ; Hiệu trưởng xử lý ẩn và khóa 3 ngày; An viết / Thì chủ nhiệm 7A thấy, chủ nhiệm khác không, giáo viên bộ môn 403; An bị chặn "tạm không viết được"; học sinh không thấy trả lời đã ẩn, giáo viên vẫn thấy | CT-1287 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1004 | Cho nhóm 1 (An, Bình), nhóm 2 (Chi) / Khi An đăng tin, giao việc cho Bình, giao việc cho Chi, Bình đổi trạng thái, lưu ghi chú bản cũ, gửi tệp; Chi mở nhóm 1; giáo viên, phụ huynh THCS của An xem / Thì giao cho Chi 422; ghi chú bản cũ 409; Chi 404; giáo viên thấy tin, tệp; phụ huynh thấy việc, không thấy thảo luận | CT-1288 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1005 | Cho hoạt động có hạn ngày mai / Khi học sinh xem lịch tuần có ngày đó, phụ huynh xem, phụ huynh khác xem / Thì có mục "Hạn nộp" của hoạt động; phụ huynh 200; phụ huynh khác 403 | CT-1289 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1006 | Cho giáo viên ở ứng dụng giáo viên, học sinh ở `#hoc-sinh`, phụ huynh / Khi giáo viên đăng thông báo; học sinh đọc, đặt câu hỏi riêng, trả lời có số điện thoại; giáo viên trả lời từ hàng chờ, xác nhận; phụ huynh mở Học trực tuyến của con / Thì số điện thoại hiện "***"; có nhãn "Câu trả lời đúng"; phụ huynh thấy thông báo lớp | CT-1290 |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-460 | Ứng dụng giáo viên: Thông báo, thảo luận, hỏi đáp (YCTD-275, nút ở chi tiết lớp học trực tuyến): khối "Câu hỏi chờ trả lời" (quá hạn); thẻ Thông báo lớp, Diễn đàn, Hỏi đáp; ô "Cho học sinh mở chủ đề" (diễn đàn); danh sách chủ đề (riêng, đã ẩn, đã khoá); biểu mẫu "Đăng thông báo lớp" hoặc "Mở chủ đề mới"; chi tiết chủ đề: "Khoá chủ đề", "Ẩn chủ đề", từng trả lời có "Xác nhận đúng", "Ẩn", ô trả lời (người dùng: Giáo viên) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-461 | Học sinh (`#hoc-sinh`): nút "Thông báo, thảo luận, hỏi đáp" ở mỗi lớp học trực tuyến (thẻ Thông báo lớp, Diễn đàn, Hỏi đáp; biểu mẫu "Đặt câu hỏi" có ô "Chỉ hỏi riêng thầy cô", "Mở chủ đề" khi giáo viên cho; chi tiết chủ đề có nhãn "Thầy cô", "Câu trả lời đúng", nút "Báo cáo", ô trả lời có dòng nhắc không ghi thông tin liên lạc); khối "Nhóm của em" (việc, người làm, trạng thái, ghi chú chung có phiên bản, tệp chung, bảng tin); khối "Lịch học tập" (tuần trước, tuần sau) (người dùng: Học sinh) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-462 | Ứng dụng phụ huynh: trong khung Học trực tuyến của con (YCTD-275): khối "Thông báo lớp"; mỗi nhóm của con (thành viên, việc, hạn, tệp; Tiểu học có thêm ghi chú, thảo luận; THCS, THPT có dòng giải thích không đọc thảo luận); "Lịch học tập" tuần (người dùng: Phụ huynh) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-463 | Cổng quản trị: 9.5 An toàn thảo luận (YCTD-275, `/online-discussion-safety`): dòng giải thích an toàn trẻ em; "Hàng chờ báo cáo vi phạm" (nhãn Bộ lọc hoặc Báo cáo, Quá hạn xử lý; nội dung bị báo cáo; ô ghi chú xử lý, "Ẩn nội dung bị báo cáo", số ngày tạm khóa; nút "Đã xử lý", "Bỏ qua"); ô "Xem báo cáo đã xử lý"; khối "Giờ mở thảo luận và từ ngữ lọc" (giờ ngày học, cuối tuần, danh sách từ ngữ, "Lưu cấu hình") (người dùng: Ban Giám hiệu, chủ nhiệm) |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1280 | P03-31 | CT-28e-1: lọc che số điện thoại, thư điện tử, liên kết, mạng xã hội, từ ngữ của trường không phân biệt dấu, hoa thường; chỉ khớp nguyên từ; chữ bình thường không bị che | Đúng | Đạt 28/10/2026; `apps/api/src/learning/discussions/discussion-rules.test.ts`; AC-1001 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1281 | P03-31 | CT-28e-2: giờ mở theo giờ Việt Nam (ngày học, cuối tuần); chưa cấu hình là luôn mở; giờ sai dạng bị bỏ | Đúng | Đạt 28/10/2026; `discussion-rules.test.ts`; AC-1001 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1282 | P03-29, P03-30 | CT-28e-3: học sinh không thấy chủ đề đã ẩn, câu hỏi riêng của bạn; câu chờ quá 48 giờ là quá hạn; phụ huynh xem nhóm theo GD-145 | Đúng | Đạt 28/10/2026; `discussion-rules.test.ts`; AC-1002, AC-1004 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1283 | P03-32 | CT-28e-4: lịch tuần ghép tiết theo thứ, ngày mở, hạn theo giờ Việt Nam, xếp theo ngày giờ | Đúng | Đạt 28/10/2026; `discussion-rules.test.ts`; AC-1005 | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1284 | P03-28 | CT-28e-5: thông báo lớp tới phụ huynh, học sinh; tin đẩy không nội dung; học sinh không trả lời, không đăng thông báo; phụ huynh khác 403 | Đúng | Đạt 28/10/2026; `apps/api/src/learning/discussions/discussions.test.ts`; AC-1000 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1285 | P03-29, P03-31 | CT-28e-6: diễn đàn mở khi giáo viên cho; che số điện thoại; từ ngữ vào hàng chờ; ngoài giờ mở học sinh chỉ đọc; cấu hình chỉ Ban Giám hiệu | Đúng | Đạt 28/10/2026; `discussions.test.ts`; AC-1001 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1286 | P03-29 | CT-28e-7: câu hỏi riêng, hàng chờ câu chưa trả lời, giáo viên trả lời và xác nhận | Đúng | Đạt 28/10/2026; `discussions.test.ts`; AC-1002 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1287 | P03-31 | CT-28e-8: báo cáo vi phạm; phạm vi chủ nhiệm; xử lý ẩn, tạm khóa quyền viết; nội dung ẩn vẫn lưu cho giáo viên | Đúng | Đạt 28/10/2026; `discussions.test.ts`; AC-1003 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1288 | P03-30 | CT-28e-9: không gian học nhóm: tin, việc, ghi chú có phiên bản, tệp; nhóm khác 404; giáo viên thấy; phụ huynh THCS không đọc thảo luận | Đúng | Đạt 28/10/2026; `discussions.test.ts`; AC-1004 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1289 | P03-32 | CT-28e-10: lịch học tập có hạn hoạt động; phụ huynh xem lịch của con; phụ huynh khác 403 | Đúng | Đạt 28/10/2026; `discussions.test.ts`; AC-1005 | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1290 | P03-28, P03-29, P03-31 | CT-28e-11: giao diện: giáo viên đăng thông báo; học sinh đặt câu hỏi riêng, trả lời có số điện thoại bị che; giáo viên trả lời từ hàng chờ, xác nhận; phụ huynh đọc thông báo | Đúng | Đạt 28/10/2026; e2e `tests/e2e/214-class-discussions.spec.ts`; AC-1006 | Cao |
| 22_BAO_MAT.md | BM-101 | BM-180 | Dữ liệu thảo luận của trẻ (YCTD-275, BR-343): bài viết, câu hỏi, ghi chú, tệp nhóm là dữ liệu của trẻ; chỉ học sinh của lớp hoặc nhóm, giáo viên của lớp, người lập bộ nhóm, người xử lý vi phạm xem; câu hỏi riêng chỉ người hỏi và giáo viên; không có nhắn riêng giữa hai học sinh; nội dung ẩn vẫn lưu làm bằng chứng; tệp nhóm trả về với `no-store`; tạm khóa quyền viết có lý do, hạn, người đặt |
| 22_BAO_MAT.md | BM-101 | BM-181 | Lọc thông tin liên lạc và tin đẩy (YCTD-275): chữ học sinh viết được che số điện thoại, thư điện tử, liên kết ngoài, tài khoản mạng xã hội trước khi lưu (giữ cờ để người xử lý biết); tin đẩy của thông báo lớp không có nội dung, tên học sinh, tên lớp |
