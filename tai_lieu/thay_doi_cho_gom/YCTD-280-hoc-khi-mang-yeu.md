---
yctd: YCTD-280
tieu_de: DT-28 phần 28j: học khi mạng yếu
ngay: 2026-10-28
phien_ban_de_xuat: 0.169.0
---

## 02 Nhật ký

### 2026-10-28 — DT-28 phần 28j: học khi mạng yếu

#### Công việc đã thực hiện

- Làm phần 28j theo `32` mục 20.6, 20.7. **GD-148 đang chờ Eric chốt**; làm theo đề xuất mặc định:
  - Tắt mặc định, Ban Giám hiệu bật ở mục 9.3.
  - Dữ liệu chỉ ở trên máy tối đa 7 ngày (trường đặt 1 đến 7), xoá khi nộp xong, khi đăng xuất, khi quá hạn.
  - Khóa bản ghi không có tên học sinh; dữ liệu mã hoá AES-GCM khi trình duyệt có WebCrypto.
- **Mô-đun riêng** `apps/parent/src/student/offline/` (quy tắc thuần, kho IndexedDB, cửa `offline.ts`), gọi từ ba chỗ: màn hình làm bài tập, danh sách học trực tuyến, đăng xuất. Nếu Eric không đồng ý GD-148 thì gỡ thư mục này và các dòng gọi; phía máy chủ chỉ là cấu hình và mã chống trùng, giữ lại không ảnh hưởng.
- **Màn hình học tập của học sinh** (khi trường bật):
  - Bản nháp câu trả lời tự lưu trên máy, mở lại thì khôi phục.
  - Nội dung hoạt động đã mở được giữ (trừ bài tập, video, gói SCORM); mất mạng thì mở lại bản đã giữ.
  - Mất mạng khi gửi tệp hoặc bấm nộp: thao tác vào hàng đợi trên máy, có mạng lại thì tự gửi theo thứ tự.
- **Máy chủ** (năm học 0193):
  - Mã chống trùng do máy sinh cho lần nộp và tệp; gửi lại cùng mã thì trả bản đã nhận, không ghi lần hai.
  - Thời điểm em bấm nộp trên máy được ghi để giáo viên xét khi bài muộn do mạng; máy chủ vẫn tính muộn theo lúc nhận.
- **Kiểm thử:** 2/2 ca thuần ở `apps/parent` (`node --test`), 2/2 ca API (`offline.test.ts`); e2e `219-offline-learning` đạt, chạy kèm spec nền 01 đến 09 (spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường); hồi quy `assignments`, `homework` cùng `offline` 26/26 ca.

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-280):
  - Thời điểm bấm nộp trên máy chỉ nhận trong 7 ngày gần đây và không sau lúc nhận quá 5 phút.
  - Hàng đợi: lỗi mạng thì dừng chờ lần sau; máy chủ từ chối (bài đóng, hết lượt) thì bỏ thao tác và báo cho em.
  - Khóa mã hoá sinh trên máy, không xuất được, xoá cùng dữ liệu khi đăng xuất.
  - Nộp thay của phụ huynh chưa dùng chế độ này.
  - Gửi tệp từng phần không làm (tệp của bài nộp tối đa 10 MB, gửi một lần).
- Migration năm học 0193; không thêm quyền.
- Mã khối riêng (BR-400, AC-1060, MH-505, CT-1360, BM-210, PQ-170, P03-60); mục mới 12P, 18O, 17.9 đặt sau mục của 28i.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-280, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- **GD-148 chờ Eric chốt**; nếu không đồng ý thì gỡ mô-đun `offline` của ứng dụng học sinh trước khi merge.
- Nộp thay ngoại tuyến của phụ huynh; gửi tệp từng phần.
- Giáo viên chưa thấy thời điểm bấm nộp trên máy trong danh sách bài nộp (cột đã có ở cơ sở dữ liệu).

## 24 Yêu cầu thay đổi

### YCTD-280: DT-28 phần 28j: học khi mạng yếu – 2026-10-28

- Lý do: phần 28j của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270): học sinh ở nơi mạng yếu vẫn làm, nộp được bài.
- Căn cứ:
  - GD-148 (mở rộng GD-108): **chờ Eric chốt**; làm theo đề xuất mặc định đã ghi ở 32.
  - Luật 91/2025 Điều 24 về dữ liệu cá nhân của trẻ theo phần tóm tắt ở 20.2: dữ liệu trên máy chỉ của chính em, tối thiểu, có hạn, xoá khi đăng xuất. Phiên này không đọc lại văn bản gốc.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Cấu hình** `learning_offline`: `enabled` (mặc định tắt), `retention_days` 1 đến 7 (mặc định 7); chỉ Ban Giám hiệu ghi; học sinh đọc ở `/student/offline`.
  - **Trên máy của học sinh** (IndexedDB `hoc-khi-mang-yeu` theo nguồn gốc của trường):
    - Bản ghi bản nháp (`draft:<hoạt động>`), nội dung (`content:<hoạt động>`), thao tác chờ gửi (`queue:<hoạt động>:<mã>`); không có tên, mã học sinh.
    - Mỗi bản ghi mã hoá AES-GCM 256 bằng khóa không xuất được.
    - Xoá khi mở ứng dụng nếu quá số ngày của trường; xoá bản nháp và thao tác của hoạt động khi nộp xong; xoá hết khi đăng xuất.
  - **Hàng đợi:**
    - Gửi theo lúc tạo, tệp trước lần nộp.
    - Gửi khi vào màn hình học tập và khi trình duyệt báo có mạng.
    - Lỗi mạng thì dừng; máy chủ từ chối thì bỏ, báo lý do.
  - **Chống trùng:**
    - `client_submit_key` của lần nộp (duy nhất); gửi lại thì trả lần nộp đã nhận kèm `replayed`.
    - `client_key` của tệp (duy nhất theo bản nháp); gửi lại thì trả tệp đã nhận.
  - **Thời điểm bấm nộp:** `client_submitted_at` ghi khi có mã chống trùng và nằm trong khoảng hợp lệ; muộn vẫn tính theo lúc máy chủ nhận.
- Thành phần bị ảnh hưởng:
  - `apps/api`: thư mục mới `learning/offline`; `learning/assignments` (chống trùng khi nộp, gửi tệp); đăng ký thêm cuối `application.module.ts`.
  - `apps/parent`: thư mục mới `student/offline`; `StudentAssignmentView.tsx`, `StudentLearningPanel.tsx`, `student-session.tsx`; thêm lệnh `test`, cấu hình `allowImportingTsExtensions`.
  - `apps/portal`: `OfflineSettings.tsx`, `OnlineTeachingPage.tsx`.
  - `database`: năm học 0193.
  - `tests/e2e/219-offline-learning.spec.ts`.
- Dữ liệu bị ảnh hưởng: năm học `0193` (thêm cột `assignment_submissions.client_submit_key`, `client_submitted_at`, `submission_files.client_key`).
- API bị ảnh hưởng: `/api/v1/learning/offline/config`, `/api/v1/student/offline`; tuyến nộp, gửi tệp của học sinh nhận thêm mã chống trùng (xem `17_DAC_TA_API.md` mục 17.9).
- Giao diện bị ảnh hưởng: MH-505, MH-506.
- Quyền bị ảnh hưởng: PQ-170 (không thêm mã quyền).
- Ảnh hưởng chức năng cũ: tắt mặc định nên không đổi; tuyến nộp, gửi tệp cũ không gửi mã thì như trước.
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho (cả `apps/parent`); e2e `single` (spec 219 cùng các spec hiện có); typecheck, lint, build.
- Chưa làm (YCTD sau): nộp thay ngoại tuyến của phụ huynh; gửi tệp từng phần; hiện thời điểm bấm nộp trên máy cho giáo viên.
- Trạng thái: Đã triển khai (PR chờ; GD-148 chờ Eric chốt)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-28 phần 28j, học khi mạng yếu (YCTD-280; GD-148 chờ Eric chốt).
- Chức năng mới:
  - Giữ bản nháp, nội dung, thao tác chờ gửi của học sinh trên máy (P03-60, MH-505).
  - Cấu hình học khi mạng yếu của trường (P03-61, MH-506).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0193`; xem `16_CO_SO_DU_LIEU.md` mục 18O.
- Thay đổi API: xem `17_DAC_TA_API.md` mục 17.9.
- Kiểm thử: kịch bản CT-1360 đến CT-1364 (CT-28j-1 đến CT-28j-5 trong mã kiểm thử).
- Rủi ro: máy dùng chung mà học sinh không đăng xuất thì dữ liệu còn trên máy tới khi quá hạn; trình duyệt chặn IndexedDB (chế độ riêng tư) thì chế độ này không chạy.
- Khả năng tương thích: tắt mặc định, không đổi hành vi cũ.
- Phương án quay lui: tắt ở cấu hình; hoặc hoàn lại commit gộp của nhánh 28j (migration chỉ thêm cột).

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28j: học khi mạng yếu (tắt mặc định; bản nháp, nội dung đã mở, thao tác chờ gửi của học sinh mã hoá trên máy tối đa 7 ngày, xoá khi nộp, đăng xuất; hàng đợi gửi lại có mã chống trùng; thời điểm bấm nộp trên máy; GD-148 chờ Eric chốt) (YCTD-280) | Đã triển khai |

## index Số đếm

| 10 | mã chức năng | +2 |
| 10 | còn hiệu lực | +2 |
| 14 | màn hình | +2 |
| Chức năng đã liệt kê | Số lượng | +2 |
| Chức năng đã liệt kê | mã; | +2 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +4 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +4 |
| Màn hình dự kiến | Số lượng | +2 |
| Ca kiểm thử khởi đầu | Số lượng | +5 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-505, MH-506 (YCTD-280) |

## Thêm dòng

| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-60 | Giữ bài làm trên máy khi mạng yếu (YCTD-280, DT-28 phần 28j; GD-148 chờ Eric chốt) | Học sinh | Câu trả lời, ảnh, ghi âm, lần bấm nộp, nội dung đã mở | Khi trường bật: tự lưu bản nháp trên máy, giữ nội dung đã mở, mất mạng thì xếp hàng gửi lại có mã chống trùng; xoá khi nộp xong, đăng xuất, quá hạn | Bản ghi mã hoá trên máy, bài nộp một lần | BR-400, BR-401, BR-402 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-61 | Cấu hình học khi mạng yếu (YCTD-280) | Ban Giám hiệu | Bật, số ngày giữ (1 đến 7) | Tắt mặc định; học sinh đọc cấu hình khi vào màn hình học tập | Cấu hình của trường | BR-403 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-400 | Dữ liệu học tập trên máy (YCTD-280, DT-28 phần 28j, GD-148 chờ Eric chốt): chỉ khi trường bật; chỉ bản nháp câu trả lời, ảnh, ghi âm chờ gửi, lần bấm nộp và nội dung hoạt động đã mở (không bài tập, video, gói SCORM) của chính học sinh đang đăng nhập; khóa bản ghi chỉ có loại và mã hoạt động, mã thao tác, không có tên, mã học sinh; mã hoá AES-GCM bằng khóa sinh trên máy không xuất được khi trình duyệt có WebCrypto |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-401 | Xoá dữ liệu trên máy (YCTD-280): bản ghi quá số ngày của trường (tối đa 7) xoá khi mở màn hình học tập; nộp xong thì xoá bản nháp và thao tác chờ của hoạt động; đăng xuất thì xoá mọi bản ghi và khóa mã hoá, kể cả thao tác chưa gửi |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-402 | Hàng đợi gửi lại và chống trùng (YCTD-280): thao tác gửi theo lúc tạo, tệp trước lần nộp; lỗi mạng thì dừng, gửi tiếp khi có mạng; máy chủ từ chối thì bỏ thao tác và báo em; lần nộp kèm `client_submit_key`, tệp kèm `client_key` do máy sinh, gửi lại cùng mã thì máy chủ trả bản đã nhận, không ghi lần hai; thời điểm bấm nộp trên máy chỉ nhận trong 7 ngày gần đây, không sau lúc nhận quá 5 phút; nộp muộn vẫn tính theo lúc máy chủ nhận |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-403 | Cấu hình học khi mạng yếu (YCTD-280): chỉ Ban Giám hiệu bật, tắt và đặt số ngày giữ 1 đến 7 (mặc định 7, mặc định tắt); học sinh đọc ở kênh `student`; vi phạm: 403, 422 |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-111 | PQ-170 | Học khi mạng yếu (YCTD-280, DT-28 phần 28j): không thêm mã quyền; cấu hình chỉ Ban Giám hiệu (người có `P02.learning.decide`, hoặc có cả `P02.learning.view` và quyền duyệt học liệu); học sinh đọc cấu hình, gửi lại bằng `P02.learning.study` (kênh `student`) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1060 | Cho khóa bản ghi, bản ghi lưu 4 ngày, trường giữ 3 ngày, đặt 30 ngày; hàng đợi có tệp và lần nộp / Khi tính khóa, quá hạn, thứ tự / Thì khóa không có tên học sinh; bản ghi 4 ngày quá hạn; 30 ngày tính 7; tệp gửi trước lần nộp | CT-1360 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1061 | Cho hàng đợi ba thao tác / Khi thao tác 1 gửi được, thao tác 2 bị từ chối, thao tác 3 lỗi mạng / Thì 1 xoá, 2 bỏ kèm lý do, 3 còn lại chờ gửi | CT-1361 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1062 | Cho trường chưa bật / Khi học sinh đọc cấu hình, giáo viên bật, Ban Giám hiệu đặt 30 ngày, đặt 5 ngày; gửi tệp hai lần cùng mã, nộp hai lần cùng mã kèm thời điểm bấm nộp / Thì tắt, 7 ngày; 403; 422; bật 5 ngày; một tệp; một lần nộp, lần hai trả `replayed`, thời điểm bấm nộp được ghi | CT-1362, CT-1363 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1063 | Cho trường đã bật, học sinh ở `#hoc-sinh` / Khi em gõ câu trả lời, mất mạng, bấm nộp, có mạng lại, đăng xuất / Thì có dòng "Bản nháp tự lưu trên máy này"; báo "Chưa có mạng: bài đã lưu trên máy và sẽ tự nộp khi có mạng"; tự nộp một lần, có thời điểm bấm nộp; sau đăng xuất trên máy không còn bản ghi | CT-1364 |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-505 | Học sinh (`#hoc-sinh`), học khi mạng yếu (YCTD-280, khi trường bật): màn hình làm bài có dòng "Bản nháp tự lưu trên máy này..."; mở lại thì "Đã khôi phục bản nháp lưu trên máy"; mất mạng khi gửi tệp, nộp bài thì báo đã lưu trên máy, tự gửi khi có mạng; danh sách học trực tuyến báo số phần bài làm đã tự gửi hoặc phần không gửi được kèm lý do; mất mạng khi mở trang nội dung thì hiện bản đã giữ kèm dòng báo (người dùng: Học sinh) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-506 | Cổng quản trị: 9.3 Hình thức và nội quy dạy học trực tuyến, khối "Học khi mạng yếu" (YCTD-280, chỉ Ban Giám hiệu): dòng giải thích dữ liệu giữ trên máy; ô "Bật học khi mạng yếu", "Số ngày giữ trên máy (1 đến 7)"; nút "Lưu cấu hình học khi mạng yếu" (người dùng: Ban Giám hiệu) |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1360 | P03-60 | CT-28j-1: khóa bản ghi không có tên; quá hạn theo số ngày của trường, tối đa 7, đồng hồ lùi; thứ tự hàng đợi; nhận biết lỗi mạng | Đúng | Đạt 28/10/2026; `apps/parent/src/student/offline/offline-rules.test.ts`; AC-1060 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1361 | P03-60 | CT-28j-2: gửi hàng đợi: thành công xoá, mạng lỗi dừng giữ phần còn lại, máy chủ từ chối bỏ kèm lý do | Đúng | Đạt 28/10/2026; `offline-rules.test.ts`; AC-1061 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1362 | P03-61 | CT-28j-3: tắt mặc định; chỉ Ban Giám hiệu bật, tối đa 7 ngày; học sinh đọc cấu hình | Đúng | Đạt 28/10/2026; `apps/api/src/learning/offline/offline.test.ts`; AC-1062 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1363 | P03-60 | CT-28j-4: gửi lại tệp, lần nộp kèm mã chống trùng chỉ ghi một lần; thời điểm bấm nộp trên máy được ghi | Đúng | Đạt 28/10/2026; `offline.test.ts`; AC-1062 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1364 | P03-60, P03-61 | CT-28j-5: giao diện: mất mạng khi nộp bài, bài giữ trên máy, có mạng tự nộp một lần; đăng xuất xoá dữ liệu trên máy | Đúng | Đạt 28/10/2026; e2e `tests/e2e/219-offline-learning.spec.ts`; AC-1063 | Cao |
| 22_BAO_MAT.md | BM-101 | BM-210 | Dữ liệu của học sinh trên máy (YCTD-280, BR-400, BR-401; GD-148 chờ Eric chốt): tắt mặc định; chỉ của chính em, tối thiểu (không lưu điểm, nhận xét, danh sách lớp), mã hoá AES-GCM bằng khóa không xuất được, khóa bản ghi không có tên; IndexedDB theo nguồn gốc của trường nên các trường tách nhau; xoá khi nộp xong, đăng xuất, quá hạn (tối đa 7 ngày) |
| 22_BAO_MAT.md | BM-101 | BM-211 | Chống trùng và thời điểm từ máy (YCTD-280, BR-402): mã chống trùng chỉ có giá trị trong bài của chính em (kiểm chủ bài nộp); thời điểm bấm nộp trên máy chỉ là thông tin cho giáo viên, không đổi cách tính muộn; nhận trong khoảng hợp lệ để máy không gửi thời điểm giả quá xa |
