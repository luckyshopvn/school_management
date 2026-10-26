---
yctd: YCTD-215
tieu_de: DT-23 phần 23e: giám thị camera cho thi trực tuyến
ngay: 2026-10-26
phien_ban_de_xuat: 0.151.0
---

## 02 Nhật ký

### 2026-10-26 — DT-23 phần 23e: giám thị camera cho thi trực tuyến

#### Công việc đã thực hiện

- Đọc mục 15 của `32_KE_HOACH_THEO_HE_THONG_SO.md` (15.3, 15.4, 15.6 dòng "Học sinh gian lận khi thi ở nhà", GD-106, mục 19 về coturn dùng chung với 27a, GD-132) và mã 23a (`student-exams.ts`, `proctoring.ts`, `ExamRoom.tsx`, kho tệp, bộ lập lịch); viết mục 15.4 "23e".
- Cơ sở dữ liệu: năm học `0129`. Máy chủ API: dịch vụ giám thị (phiên xem trực tiếp, báo hiệu, đồng ý, ghi hình mã hoá, xem lại, dọn quá hạn), cấu hình máy chủ ICE. Ứng dụng phụ huynh: thông báo, bộ trả lời WebRTC, bộ ghi hình, màn hình đồng ý của phụ huynh. Cổng quản trị: lưới camera, đồng ý của cha mẹ, nhật ký người xem, xem lại bản ghi, cấu hình. Hồ sơ vận hành: coturn.
- Thêm quy tắc BR-250, chức năng P02-95 đến P02-98, quyền PQ-115, biện pháp BM-101 đến BM-103, màn hình MH-360 đến MH-362, kịch bản CT-1140 đến CT-1145, tiêu chí AC-900 đến AC-904. Kết quả ngày 26/10/2026: kiểm thử đơn vị `apps/api/src/online-exams/exam-proctoring.test.ts` (CT-23e-1a đến CT-23e-1c) và `online-exams.test.ts` (CT-23e-1 đến CT-23e-4) đạt; kiểm thử đơn vị toàn kho đạt (bộ 23e, 23a, 22g, định danh chạy riêng; toàn bộ để CI chạy); kiểm thử giao diện `tests/e2e/154-online-exam-proctoring.spec.ts` (CT-23e-5) cùng 02, 03, 06, 08, 150 đạt; toàn bộ kiểm thử giao diện để CI chạy toàn bộ; trên máy chạy riêng 02, 03, 06, 08, 101, 102, 103, 150 và 154 (14/14 đạt); kiểm tĩnh đa thuê bao, ma trận cách ly, kiểm thử hai bố cục cơ sở dữ liệu `database` và `schema`, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 23e theo đề xuất của phiên điều phối (Eric yêu cầu): hình xem trực tiếp đi thẳng giữa hai trình duyệt, không qua máy chủ API (nhẹ tải, ít rủi ro lộ hình); báo hiệu bằng hỏi định kỳ vì máy chủ chưa có kênh web socket; ghi hình do trình duyệt học sinh tải từng đoạn (không dựng máy chủ ghi hình riêng); đồng ý của cha mẹ kiểm cả lúc xem và lúc ghi; mặc định tắt và cần luật sư rà trước khi bật ở trường thật.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-215, `07_QUY_TAC_NGHIEP_VU.md` BR-250, `08_VAI_TRO_NGUOI_DUNG.md` PQ-115, `10_YEU_CAU_CHUC_NANG.md` P02-95 đến P02-98, `11_TIEU_CHI_NGHIEM_THU.md` AC-900 đến AC-904, `14_DAC_TA_GIAO_DIEN.md` MH-360 đến MH-362, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1140 đến CT-1145, `22_BAO_MAT.md` BM-101 đến BM-103, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `33_HO_SO_PHAP_LY/` PL-13, PL-15.

#### Vấn đề tồn đọng

- Luật sư rà quy định dữ liệu trẻ em, ghi hình và giám sát (PL-15) trước khi bật ở trường thật; thử coturn và thử tải ở môi trường thật; ảnh chụp định kỳ, AI cảnh báo bất thường không làm.

## 24 Yêu cầu thay đổi

### YCTD-215: DT-23 phần 23e: giám thị camera cho thi trực tuyến – 2026-10-26

- Lý do: Eric yêu cầu thêm phần giám thị camera cho thi trực tuyến (tách khỏi 23a ngày 2026-10-26; mục 15 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, GD-106 và rủi ro "Học sinh gian lận khi thi ở nhà"). Giáo viên coi thi cần xem được camera của học sinh đang làm bài; nhà trường cần ghi hình tuỳ chọn có thời hạn; dữ liệu hình của trẻ em phải có đồng ý của cha mẹ và minh bạch với học sinh.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - **Cấu hình của trường** (`/online-exams/settings`): cho phép giáo viên xem camera trực tiếp, cho phép ghi hình, thời hạn giữ bản ghi (7 đến 90 ngày, mặc định 30, GD-132); mặc định tắt cả hai. Bài giao có thêm hai ô chọn (xem trực tiếp, ghi hình), chỉ hiện khi trường đã bật và bài có kiểm tra camera.
  - **Thông báo và đồng ý**: học sinh đọc thông báo và xác nhận trước khi vào bài có giám sát (máy chủ ghi thời điểm xác nhận ở lượt làm bài); học sinh dưới 16 tuổi hoặc chưa rõ ngày sinh cần cha mẹ đồng ý từng loại. Phụ huynh đồng ý hoặc thu hồi ở ứng dụng phụ huynh (nút "Giám sát thi trực tuyến" của từng con); người quản lý đề, kiểm tra ghi nhận văn bản đồng ý (nhập họ tên người đồng ý). Máy chủ kiểm lại ở mọi lần mở phiên xem và nhận đoạn ghi, nên thu hồi có hiệu lực ngay.
  - **Xem trực tiếp**: ở "Theo dõi bài làm" giáo viên chọn từng học sinh hoặc xem tất cả học sinh đang làm bài (tối đa 60 camera); hình đi thẳng giữa trình duyệt qua WebRTC (giáo viên gửi offer, học sinh trả lời bằng camera đã bật cho bài), thông điệp báo hiệu đi qua máy chủ API (bảng sống ngắn, hỏi định kỳ, không cần kết nối web socket); máy chủ chuyển tiếp coturn tự host trong hồ sơ vận hành `deploy/` giúp qua tường lửa và dùng chung về sau cho 27a (tên đăng nhập, mật khẩu TURN có hạn theo khoá dùng chung). Học sinh thấy dòng "Giáo viên coi thi đang xem camera của em"; mỗi phiên xem ghi nhật ký người xem.
  - **Phát hiện trên máy** (23a) giữ nguyên: vắng mặt, nhiều khuôn mặt, rời màn hình ghi thành sự kiện của lượt làm, không gửi hình, không tự trừ điểm.
  - **Ghi hình tuỳ chọn**: trình duyệt học sinh ghi từng đoạn khoảng 10 giây và tải lên; máy chủ kiểm quyền, mã hoá AES-256-GCM rồi lưu ở kho tệp theo khoá lưu trữ `exam-recordings/…`, giữ theo số ngày của trường; việc nền hằng giờ xoá đoạn quá hạn (cả tệp ở kho). Chỉ người giao bài và người quản lý đề, kiểm tra xem lại: máy chủ giải mã và phát một video WebM, không lưu đệm, không có nút tải xuống, mỗi lần xem ghi nhật ký người xem và nhật ký thao tác. Không nhận diện danh tính sinh trắc.
  - Quy tắc: giám sát bằng camera khi thi trực tuyến mặc định tắt: trường bật xem trực tiếp và ghi hình ở Cấu hình thi trực tuyến (kèm thời hạn giữ bản ghi từ 7 đến 90 ngày, mặc định 30), giáo viên bật theo từng bài giao (cần bật camera cho bài); trước khi vào thi học sinh phải đọc thông báo và xác nhận; học sinh dưới 16 tuổi (hoặc chưa rõ ngày sinh) cần cha mẹ đồng ý từng loại (xem trực tiếp, ghi hình) trên ứng dụng phụ huynh hoặc do người quản lý đề, kiểm tra ghi nhận văn bản, thu hồi có hiệu lực ngay (máy chủ kiểm lại lúc mở phiên xem và lúc nhận mỗi đoạn bản ghi); xem trực tiếp bằng WebRTC giữa trình duyệt giáo viên và học sinh (hình không qua máy chủ API, thông điệp báo hiệu sống ngắn), mỗi phiên xem ghi nhật ký người xem, học sinh thấy thông báo khi có người xem, tối đa 60 camera cùng lúc cho một bài; ghi hình tuỳ chọn, mã hoá AES-256-GCM ở kho tệp, chỉ người giao bài và người quản lý đề, kiểm tra xem lại (phát qua máy chủ, không tải xuống, mỗi lần xem ghi nhật ký), tự xoá khi hết hạn; không nhận diện danh tính sinh trắc; sự kiện và hình chỉ là căn cứ để giáo viên xét, không tự trừ điểm, như 23a.
- Thành phần bị ảnh hưởng: cơ sở dữ liệu (`database/school-year/migrations/0129_create_exam_proctoring.ts`, `schema.ts`), gói dùng chung (`packages/shared/src/online-exams.ts`: hằng, `ageOn`, `needsParentConsent`), máy chủ API (`apps/api/src/online-exams/exam-proctoring.ts`, `exam-proctoring.controller.ts`, `proctor-consent.ts`, `student-exams.ts`, `online-exams.ts`, `common/configuration.ts`), ứng dụng phụ huynh (`apps/parent/src/student/proctoring.ts`, `ExamRoom.tsx`, `screens/ProctorConsentPanel.tsx`), cổng quản trị (`apps/portal/src/online-exams/ProctorPanel.tsx` và trang giao đề, theo dõi, cấu hình), hồ sơ vận hành (`deploy/docker-compose.production.yml`, `deploy/coturn/`), hồ sơ pháp lý (PL-13, PL-15).
- Dữ liệu bị ảnh hưởng: bốn bảng mới ở năm học (`exam_proctor_consents`, `exam_proctor_views`, `exam_proctor_signals`, `exam_recording_chunks`); cột mới `exam_assignments.proctor_live`, `proctor_record`, `exam_attempts.proctor_notice_at`, `online_exam_school_settings.allow_live_proctoring`, `allow_recording`, `recording_retention_days`; tệp bản ghi ở kho tệp (mã hoá). Không đổi dữ liệu cũ (mặc định tắt).
- API bị ảnh hưởng: `/online-exams/…` (xem trực tiếp, báo hiệu, thông tin giám sát của lượt, xem lại bản ghi, đồng ý), `/student/…` (hỏi báo hiệu, trả lời, tải đoạn bản ghi, máy chủ ICE), `/parent/exam-proctor-consents`; `proctor_live`, `proctor_record` ở giao đề; `proctor_notice` ở `POST /student/exams/{id}/start`; biến môi trường `STUN_URLS`, `TURN_URLS`, `TURN_SHARED_SECRET`, `TURN_TTL_SECONDS`.
- Giao diện bị ảnh hưởng: MH-360 đến MH-362; phòng làm bài của học sinh (thông báo, ô xác nhận, dòng thông báo có người xem).
- Quyền bị ảnh hưởng: PQ-115 (không thêm quyền mới: dùng `P02.exam.assign`, `P02.exam.manage`, `P02.exam.take`). Máy chủ kiểm quyền ở mọi yêu cầu (AI-12).
- Ảnh hưởng chức năng cũ: không đổi hành vi (mặc định tắt); bài thi, camera kiểm tra có mặt của 23a chạy như trước.
- Hạn chế:
  - chưa có ảnh chụp định kỳ, nhận diện cảm xúc, nhận diện danh tính, AI cảnh báo bất thường (không làm theo quyết định tách phần);
  - xem trực tiếp cần cả hai trình duyệt hỗ trợ WebRTC; mạng chặn UDP cần coturn (cấu hình ở `deploy/`, chưa thử ở môi trường thật); số camera xem cùng lúc giới hạn 60 cho một bài, một giáo viên xem nhiều camera tốn băng thông và bộ xử lý máy giáo viên;
  - báo hiệu bằng hỏi định kỳ (khoảng 1 đến 2 giây) nên kết nối mất vài giây; máy chủ API không là điểm trung chuyển hình;
  - bản ghi là video WebM ghép từ các đoạn của trình duyệt (Chrome, Edge, Firefox ghi được; Safari cũ có thể không ghi, khi đó học sinh thấy thông báo và giáo viên được báo); đoạn bị mất mạng quá ba lần thử bị bỏ, bản ghi có thể thiếu đoạn;
  - việc xoá bản ghi quá hạn chạy mỗi giờ; sao lưu của kho tệp có thể giữ lâu hơn hạn (cần quy định ở PL-13);
  - thử tải 45 học sinh xem trực tiếp cùng lúc và thử hiệu năng ghi hình chưa chạy;
  - **cần luật sư rà trước khi bật ở trường thật** (PL-15, câu hỏi E-06 mở rộng; Điều 24 Luật 91/2025/QH15 về dữ liệu của trẻ em, Nghị định 356/2025/NĐ-CP Điều 21 khoản 5 coi phần mềm giáo dục có yếu tố giám sát, ghi hình là dịch vụ xử lý dữ liệu cá nhân): đồng ý của cha mẹ, thời hạn giữ bản ghi, quyền của học sinh (xem, xoá), có cần giấy chứng nhận dịch vụ hay không; mặc định tắt để không bật nhầm.
- Kiểm thử cần thực hiện: kịch bản CT-1140 đến CT-1145 (trong mã kiểm thử là CT-23e-1 đến CT-23e-5 và CT-23e-1a đến CT-23e-1c); kiểm thử đơn vị mới `apps/api/src/online-exams/exam-proctoring.test.ts` và phần bổ sung của `online-exams.test.ts`; kiểm thử giao diện mới `tests/e2e/154-online-exam-proctoring.spec.ts`; chạy lại kiểm thử đa thuê bao, ma trận cách ly, hai bố cục cơ sở dữ liệu, toàn bộ kiểm thử đơn vị và giao diện, build, kiểm tra kiểu, lint, kiểm tra định dạng.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-26

- Phạm vi thay đổi: DT-23 phần 23e, giám thị camera cho thi trực tuyến (YCTD-215).
- Chức năng mới: cấu hình của trường (xem trực tiếp, ghi hình, thời hạn giữ), bật theo bài giao; thông báo trước khi vào thi; đồng ý của cha mẹ (ứng dụng phụ huynh, trường ghi nhận văn bản); giáo viên xem lưới camera trực tiếp qua WebRTC, nhật ký người xem; ghi hình mã hoá có thời hạn, xem lại có kiểm quyền; coturn trong hồ sơ vận hành.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0129`.
- Thay đổi API: `/online-exams/attempts/{id}/proctor…`, `/online-exams/proctor/…`, `/student/attempts/{id}/proctor…`, `/student/attempts/{id}/recording/chunks`, `/parent/exam-proctor-consents`.
- Kiểm thử: kịch bản CT-1140 đến CT-1145. Kết quả ngày 26/10/2026: kiểm thử đơn vị `apps/api/src/online-exams/exam-proctoring.test.ts` (CT-23e-1a đến CT-23e-1c) và `online-exams.test.ts` (CT-23e-1 đến CT-23e-4) đạt; kiểm thử đơn vị toàn kho đạt (bộ 23e, 23a, 22g, định danh chạy riêng; toàn bộ để CI chạy); kiểm thử giao diện `tests/e2e/154-online-exam-proctoring.spec.ts` (CT-23e-5) cùng 02, 03, 06, 08, 150 đạt; toàn bộ kiểm thử giao diện để CI chạy toàn bộ; trên máy chạy riêng 02, 03, 06, 08, 101, 102, 103, 150 và 154 (14/14 đạt); kiểm tĩnh đa thuê bao, ma trận cách ly, kiểm thử hai bố cục cơ sở dữ liệu `database` và `schema`, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: lộ hình ảnh trẻ em (hình xem trực tiếp không qua máy chủ API, bản ghi mã hoá và giới hạn người xem, có nhật ký; mặc định tắt; cần luật sư rà trước khi bật); giáo viên xem khi cha mẹ đã thu hồi (máy chủ kiểm lại mỗi lần); khoá TURN dùng chung bị lộ (chỉ cấp tên đăng nhập có hạn, khoá đặt ở biến môi trường).
- Khả năng tương thích: không đổi hành vi cũ; máy chủ mới cần chạy tệp năm học `0129`; coturn là tuỳ chọn (không có thì chỉ kết nối trực tiếp trong cùng mạng).
- Phương án quay lui: hoàn lại commit gộp của nhánh 23e; chạy phần quay lui của tệp năm học `0129`; bản ghi đã tải tự hết hạn hoặc xoá theo tiền tố `exam-recordings/` ở kho tệp.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-23 phần 23e: giám thị camera cho thi trực tuyến (xem trực tiếp WebRTC, ghi hình mã hoá có hạn, thông báo và đồng ý của cha mẹ) | YCTD-215 |

## index Số đếm

| Chức năng đã liệt kê | Số lượng | +4 |
| 10 | mã chức năng | +4 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +5 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +1 |
| Ca kiểm thử khởi đầu | Số lượng | +6 |
| Bảng dữ liệu dự kiến | Số lượng | +4 |
| Màn hình dự kiến | Số lượng | +3 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-23 phần 23e (YCTD-215: giám thị camera cho thi trực tuyến) |
