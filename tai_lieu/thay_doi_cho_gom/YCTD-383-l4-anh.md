---
yctd: YCTD-383
tieu_de: Gia sư AI trả phí, lát L4: ảnh bài tập cho gói Nâng cao, xóa ảnh sau 30 ngày
ngay: 2026-10-30
phien_ban_de_xuat: 0.254.0
---

## 02 Nhật ký

### 2026-10-30 — Gia sư AI trả phí, lát L4: ảnh bài tập cho gói Nâng cao, xóa ảnh sau 30 ngày (YCTD-383)

#### Công việc đã thực hiện

- Máy chủ API: `POST /student/ai-tutor/messages` nhận thêm dạng nhiều phần, trường `images` (bộ nhận tệp có sẵn của NestJS, như tệp hồ sơ trẻ); quy tắc ảnh ở `apps/api/src/ai-tutor/tutor-images.ts`: nhận diện JPEG, PNG, WebP theo byte đầu, tối đa 3 ảnh mỗi câu, mỗi ảnh tối đa 4 MB, bỏ siêu dữ liệu (EXIF, vị trí chụp, XMP, IPTC, khối chữ PNG) trước khi lưu và gửi đi, ảnh hỏng cấu trúc bị từ chối.
- `tutor-chat.ts`: kiểm gói Nâng cao (gói tháng đang dùng có quyền gửi ảnh) trước khi giữ lượt, gói khác trả 422 `BR-500`, không trừ lượt, không gọi nhà cung cấp; gửi ảnh cho nhà cung cấp qua `AiProvider` (chỉ khóa AI của nền tảng, token tính theo nguồn gói như lát L2); gia sư chép đề bài trong ảnh (`image_text`), đề chép được quét dữ liệu cá nhân và kiểm duyệt như câu chữ; ảnh có thông tin cá nhân (nhà cung cấp báo, đề chép được hoặc câu trả lời có tên người trong trường, số điện thoại, số định danh) thì không lưu ảnh, không hiện câu trả lời của nhà cung cấp, hoàn lượt, trả lời theo mẫu nhắc em chụp lại chỉ phần đề bài (`BR-501`); ảnh chỉ lưu khi câu được trả lời bình thường, ở kho tệp của trường (`storageKey('ai-tutor-images', …)`); lượt sau không gửi lại ảnh, chỉ gửi đề đã chép.
- Bộ nối nhà cung cấp `apps/api/src/ai-assistant/ai-provider.ts`: `AiPrompt.images`; `AnthropicProvider` gửi khối `image` (base64) trước khối chữ của câu hỏi mới; bộ giả lập chép đề bài mẫu, cộng 100 token mỗi ảnh.
- Điểm cuối mới `GET /student/ai-tutor/images/{id}`: chỉ chính em (kênh student), không phiên xem hỗ trợ; ảnh của em khác hoặc đã xóa trả 404; cha mẹ, giáo viên không có điểm cuối xem ảnh; ảnh không nằm ở bảng `files` nên `GET /files/{id}` không trả ảnh.
- Việc nền 10 phút một lần (`ai-tutor-chat-maintenance`, có sẵn từ lát L2) thêm bước xóa ảnh từ đủ 30 ngày: xóa tệp ở kho, xóa khóa tệp, ghi `deleted_at`; tin nhắn còn lại hiện "Ảnh đã xóa sau 30 ngày". Ảnh xóa trước bước xóa lịch sử 12 tháng.
- Ứng dụng học sinh (MH-597): nút "Gửi ảnh bài tập" (khóa kèm lời nhắc nâng gói khi không phải gói Nâng cao), xem trước và bỏ ảnh, nén ảnh ở máy (vẽ lại bỏ siêu dữ liệu, cạnh dài 1.600 điểm ảnh, JPEG; hàm dùng chung `apps/student/src/clean-image.ts` tách từ màn hình bài tập), ảnh trong hội thoại, đề gia sư chép từ ảnh, trạng thái ảnh đã xóa; lời nhắc chỉ chụp phần đề bài.
- Database migration: hệ thống `0140_add_ai_tutor_images` (bảng `ai_tutor_message_images`, cột `ai_tutor_messages.image_text`, giá trị kiểm duyệt `personal_data`).
- Kiểm thử: `apps/api/src/ai-tutor/tutor-images.test.ts` (CT-1940), `tutor-images-chat.test.ts` (CT-1941 đến CT-1946), `apps/student/src/ai-tutor/ai-tutor-math.test.ts` (CT-1947). Chỉ dùng bộ giả lập nhà cung cấp; ảnh là byte giả. Hồi quy trên máy ngày 30/10/2026: `apps/api/src/ai-tutor/*.test.ts` và `apps/api/src/ai-assistant/*.test.ts` 133/133 đạt (ca đọc JSON của CT-1777 thêm kỳ vọng cho hai trường mới `imageText`, `personalData`); kiểm thử thuần ứng dụng học sinh 7/7 đạt.

#### Quyết định

- Eric duyệt phương án, bản mẫu MH-597 (nút gửi ảnh) và danh sách lát ngày 2026-10-30; Q5: chỉ gói Nâng cao, ảnh xóa sau 30 ngày; Q8: chỉ khóa AI của nền tảng.
- Claude tự chọn theo ủy quyền của Eric (chọn phương án an toàn nhất cho học sinh, cần Eric xác nhận):
  - "Gói Nâng cao" là gói tháng đang dùng có quyền gửi ảnh (`allow_images`); gói lượt dùng quyền của gói tháng (như L0, L1a); em chỉ có gói lượt thì không gửi được ảnh;
  - tối đa 3 ảnh mỗi câu, mỗi ảnh tối đa 4 MB (dưới giới hạn 5 MB mỗi ảnh của Anthropic), chỉ JPEG, PNG, WebP; ứng dụng nén về JPEG trước khi gửi;
  - không có công cụ đọc chữ trong ảnh ở máy chủ, nên ảnh phải gửi nhà cung cấp mới biết có thông tin cá nhân hay không. Để an toàn nhất trong giới hạn đó: máy chủ bỏ siêu dữ liệu trước khi gửi; nhắc em trước khi chọn ảnh; gia sư chép đề và tự báo thông tin cá nhân; đề chép được và câu trả lời được quét như câu chữ; có thông tin cá nhân thì không lưu ảnh, không lưu đề chép, không hiện câu trả lời của nhà cung cấp, hoàn lượt (token đã dùng vẫn ghi như quy định của lát L2);
  - đề chép từ ảnh có dấu hiệu tự hại, bị bắt nạt thì xử lý như câu chữ (trả lời theo mẫu có 111, ghi cờ, báo giáo viên chủ nhiệm và cha mẹ theo lát L3), không lưu ảnh;
  - ảnh chỉ lưu khi câu được trả lời bình thường; câu bị kiểm duyệt, ngoài học tập, lỗi nhà cung cấp thì không lưu ảnh;
  - xem lời giải đầy đủ không gửi kèm ảnh; câu có ảnh mà em không gõ chữ thì câu hỏi là "Em gửi ảnh bài tập, nhờ gia sư gợi ý.";
  - lượt sau không gửi lại ảnh cho nhà cung cấp (giảm token và dữ liệu gửi đi), chỉ gửi đề đã chép;
  - "xóa sau 30 ngày" tính từ lúc gửi: ảnh gửi từ đủ 30 ngày trước (tính theo giờ, không làm tròn ngày) bị xóa ở lần chạy việc nền đầu tiên sau mốc đó; lỗi kho tệp thì lần chạy sau xóa lại;
  - bản mẫu MH-597 có bước "xác nhận đề" (chép đề, em bấm "Đúng, bắt đầu" hoặc "Sửa đề" trước khi gia sư hướng dẫn). Lát này làm gọn: đề chép hiện ngay dưới câu hỏi của em kèm dòng "Đề chưa đúng thì em gõ lại đề ở câu tiếp theo nhé", không thêm một lần gọi nhà cung cấp và không đổi cách tính lượt.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-383, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md` mục 18S, `17_DAC_TA_API.md` mục 17.13, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Eric xác nhận các lựa chọn ở mục Quyết định, đặc biệt: giới hạn 3 ảnh, 4 MB; ảnh vẫn tới nhà cung cấp trước khi biết có thông tin cá nhân; bước xác nhận đề làm gọn so với bản mẫu MH-597 (nếu cần đúng bản mẫu thì làm thêm một lát nhỏ: một lần gọi chép đề không trừ lượt, em xác nhận rồi mới hỏi).
- Lời nhắc cho nhà cung cấp khi có ảnh chưa thử với mô hình thật (chỉ thử với bộ giả lập); cần thử với khóa nền tảng ở môi trường thử nghiệm trước khi bật cho trường.

## 24 Yêu cầu thay đổi

### YCTD-383: Gia sư AI trả phí, lát L4: ảnh bài tập cho gói Nâng cao, xóa ảnh sau 30 ngày – 2026-10-30

- Lý do: lát L4 của YCTD-383 theo danh sách lát Eric duyệt ngày 2026-10-30 (Q5).
- Nội dung thay đổi: em gói Nâng cao gửi kèm tối đa 3 ảnh bài tập (JPEG, PNG, WebP, mỗi ảnh tối đa 4 MB) với câu hỏi; gói khác bị từ chối trước khi giữ lượt, không trừ lượt; máy chủ bỏ siêu dữ liệu ảnh, gửi ảnh cho nhà cung cấp bằng khóa AI của nền tảng; gia sư chép đề từ ảnh, đề chép được quét dữ liệu cá nhân và kiểm duyệt; ảnh có thông tin cá nhân không được lưu, lượt được hoàn, em được nhắc chụp lại; ảnh lưu ở kho tệp của trường, chỉ em xem lại; việc nền xóa ảnh sau 30 ngày, tin nhắn ghi "Ảnh đã xóa sau 30 ngày".
- Thành phần bị ảnh hưởng: `apps/api/src/ai-tutor/tutor-chat.ts`, `tutor-chat.controller.ts`, `tutor-chat-rules.ts`, `tutor-images.ts`, `apps/api/src/ai-assistant/ai-provider.ts`, `database/system/migrations/0140_add_ai_tutor_images.ts`, `database/system/schema-parts/yctd-383-gia-su-ai.ts`, `yctd-383-l4-anh.ts`, `apps/student/src/ai-tutor/StudentAiTutorScreen.tsx`, `ai-tutor-api.ts`, `ai-tutor-math.ts`, `apps/student/src/clean-image.ts`, `apps/student/src/StudentAssignmentView.tsx`, tài liệu 07, 10, 11, 16, 17, 21, 22, 27.
- Dữ liệu, API, quyền bị ảnh hưởng: bảng mới `ai_tutor_message_images`, cột `ai_tutor_messages.image_text`, giá trị `personal_data` của `ai_tutor_messages.moderation` (hệ thống); `GET /student/ai-tutor` thêm `images { allowed, max_count, max_bytes, retention_days }`; tin nhắn thêm `image_text`, `images [{ id, content_type, deleted, deleted_label }]`; `POST /student/ai-tutor/messages` nhận dạng nhiều phần với `images`; điểm cuối mới `GET /student/ai-tutor/images/{id}`; lỗi 422 `BR-500`, 400 khi sai loại, quá số ảnh, quá cỡ; không đổi quyền có sẵn.
- Ảnh hưởng chức năng cũ: câu hỏi chỉ có chữ gửi JSON như cũ; màn hình bài tập của học sinh dùng hàm nén ảnh tách ra tệp chung, hành vi không đổi.
- Kiểm thử cần thực hiện: kiểm kiểu các gói bị chạm; `apps/api/src/ai-tutor/*.test.ts`, `apps/api/src/ai-assistant/*.test.ts`; kiểm thử thuần của ứng dụng học sinh; e2e 143, 144 (dự án nhiều trường) không đổi.
- Mức: Lớn (thuộc YCTD-383). Người phê duyệt: Eric, ngày 2026-10-30 (phương án, bản mẫu MH-597, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gia sư AI trả phí, lát L4: ảnh bài tập cho gói Nâng cao, bỏ siêu dữ liệu, kiểm thông tin cá nhân qua đề chép từ ảnh, xóa ảnh sau 30 ngày (YCTD-383).
- Database migration: hệ thống `0140_add_ai_tutor_images`. Quay lui: xóa tệp ảnh còn khóa ở kho (`ai_tutor_message_images.storage_key` khác trống) trước, rồi chạy `down` (đổi `personal_data` thành `unsafe`, trả ràng buộc kiểm duyệt cũ, xóa cột `image_text` và bảng ảnh); bản trước của máy chủ không nhận ảnh.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gia sư AI trả phí, lát L4: ảnh bài tập cho gói Nâng cao, xóa ảnh sau 30 ngày | YCTD-383 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-500 | Gia sư AI, ảnh bài tập (YCTD-383 lát L4, Q5): chỉ em có gói tháng đang dùng có quyền gửi ảnh (gói Nâng cao; gói lượt dùng quyền của gói tháng) mới gửi ảnh kèm câu hỏi; kiểm ở máy chủ trước khi giữ lượt, gói khác bị từ chối 422 và không trừ lượt; tối đa 3 ảnh mỗi câu, mỗi ảnh tối đa 4 MB, chỉ JPEG, PNG, WebP nhận diện theo byte đầu; máy chủ bỏ siêu dữ liệu trước khi lưu và gửi đi; xem lời giải đầy đủ không kèm ảnh; lượt sau không gửi lại ảnh |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-501 | Gia sư AI, an toàn và hạn giữ ảnh (YCTD-383 lát L4, Q5): gia sư chép đề trong ảnh; đề chép được quét dữ liệu cá nhân và kiểm duyệt như câu chữ (BR-468); nhà cung cấp báo ảnh có thông tin cá nhân, hoặc đề chép, câu trả lời có dữ liệu cá nhân thì không lưu ảnh, không lưu đề chép, không hiện câu trả lời của nhà cung cấp, hoàn lượt, trả lời theo mẫu nhắc em chụp lại chỉ phần đề bài; ảnh chỉ lưu khi câu được trả lời bình thường; ảnh gửi từ đủ 30 ngày bị xóa tệp và khóa tệp, tin nhắn ghi "Ảnh đã xóa sau 30 ngày"; chỉ em xem ảnh của mình, cha mẹ và giáo viên không xem |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-26 | Gia sư AI: ảnh bài tập (YCTD-383 lát L4) | VT-21 (kênh student, gói Nâng cao); hệ thống (việc nền xóa ảnh) | Ảnh JPEG, PNG, WebP kèm câu hỏi | Kiểm gói trước khi giữ lượt, kiểm loại, cỡ, số ảnh, bỏ siêu dữ liệu, gửi nhà cung cấp, kiểm thông tin cá nhân qua đề chép, lưu ở kho tệp, xóa sau 30 ngày | Nút gửi ảnh, xem trước, ảnh trong hội thoại, đề chép, ảnh đã xóa (MH-597); 422 `BR-500` | BR-500, BR-501 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1300 | Cho em có gói tháng không có quyền gửi ảnh (gói Cơ bản) / Khi em gửi câu hỏi kèm ảnh / Thì máy chủ trả 422 `BR-500` "chỉ có ở gói Nâng cao", không tạo dòng sổ lượt, số lượt không đổi, không gọi nhà cung cấp; nút gửi ảnh ở ứng dụng khóa kèm lời nhắc nâng gói; gõ chữ vẫn hỏi được (CT-1941, CT-1947; YCTD-383 lát L4) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1301 | Cho em có gói Nâng cao / Khi em gửi 1 đến 3 ảnh JPEG, PNG hoặc WebP (có hoặc không kèm chữ) / Thì câu được trả lời, trừ một lượt, ảnh tới nhà cung cấp đã bỏ siêu dữ liệu bằng khóa AI của nền tảng, token có phần ảnh và tính theo nguồn gói, ảnh lưu ở kho tệp của trường, tin nhắn có ảnh và đề chép từ ảnh; lượt sau không gửi lại ảnh (CT-1940, CT-1942; YCTD-383 lát L4) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1302 | Cho em có gói Nâng cao / Khi em gửi ảnh GIF, 4 ảnh, ảnh quá 4 MB, ảnh hỏng, hoặc ảnh kèm yêu cầu xem lời giải / Thì máy chủ trả 400 kèm lý do, không giữ lượt, không gọi nhà cung cấp (CT-1940, CT-1943; YCTD-383 lát L4) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1303 | Cho ảnh có thông tin cá nhân (nhà cung cấp báo, hoặc đề chép có tên người trong trường, số điện thoại) / Khi em gửi / Thì không lưu ảnh và đề chép, không hiện câu trả lời của nhà cung cấp, lượt được hoàn, em nhận câu nhắc chụp lại chỉ phần đề bài (CT-1944; YCTD-383 lát L4) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1304 | Cho ảnh gửi cách đây 29, 30, 31 ngày / Khi việc nền chạy / Thì ảnh 29 ngày còn nguyên; ảnh 30 và 31 ngày bị xóa tệp ở kho và khóa tệp, tin nhắn ghi "Ảnh đã xóa sau 30 ngày", tải ảnh trả 404; lần chạy sau không xóa lại (CT-1940, CT-1945; YCTD-383 lát L4) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1305 | Cho ảnh của em / Khi em khác, cha mẹ, giáo viên tải ảnh hoặc cha mẹ xem chủ đề / Thì em khác bị 404, cha mẹ và giáo viên bị từ chối ở nhóm điểm cuối của học sinh, điểm cuối tệp chung trả 404, trang chủ đề của cha mẹ không có ảnh (CT-1946; YCTD-383 lát L4) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1940 | P05-26 | Hàm thuần: nhận diện JPEG, PNG, WebP, GIF, PDF; bỏ siêu dữ liệu ba định dạng; ảnh hỏng; 3 và 4 ảnh; ảnh quá 4 MB; mốc xóa 30 ngày | Đúng từng trường hợp; ảnh đã bỏ không còn chữ EXIF, vị trí, chú thích | Kiểm thử tự động `apps/api/src/ai-tutor/tutor-images.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1941 | P05-26 | Em gói Cơ bản xem trang, gửi câu kèm ảnh, rồi gửi chữ | `images.allowed` sai; 422 "chỉ có ở gói Nâng cao", "không bị trừ", không có dòng sổ lượt, số lượt không đổi, không gọi nhà cung cấp; gửi chữ 201 | Kiểm thử tự động `apps/api/src/ai-tutor/tutor-images-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1942 | P05-26 | Em gói Nâng cao (nền tảng bán) gửi hai ảnh không kèm chữ, xem lại ảnh, hỏi tiếp | 201, trừ một lượt, nhà cung cấp nhận hai ảnh không còn EXIF và lời nhắc có dòng ảnh, khóa của nền tảng, token có phần ảnh; tin nhắn có câu hỏi mặc định, đề chép, hai ảnh; tệp có ở kho; tải ảnh 200 `image/jpeg`, `no-store`; lượt sau không gửi ảnh, lịch sử có đề chép | Kiểm thử tự động `tutor-images-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1943 | P05-26 | Gửi GIF; 4 ảnh; ảnh quá 4 MB; ảnh kèm xem lời giải | 400 "JPEG, PNG hoặc WebP"; 400 "tối đa 3 ảnh"; 400 "vượt dung lượng"; 400; không giữ lượt, không gọi nhà cung cấp | Kiểm thử tự động `tutor-images-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1944 | P05-26 | Nhà cung cấp báo `personal_data`; đề chép có họ tên học sinh và số điện thoại | 201 lượt `released`, câu nhắc thông tin cá nhân, không có ảnh và đề chép trong tin nhắn, không lộ họ tên, số điện thoại; không thêm dòng ảnh, không thêm tệp ở kho | Kiểm thử tự động `tutor-images-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1945 | P05-26 | Ba ảnh gửi cách 29, 30, 31 ngày; chạy việc nền xóa ảnh hai lần | Xóa 2; ảnh 29 ngày còn tệp và khóa; ảnh 30, 31 ngày không còn tệp, khóa trống, có `deleted_at`; hội thoại ghi "Ảnh đã xóa sau 30 ngày"; tải ảnh 404; lần sau xóa 0 | Kiểm thử tự động `tutor-images-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1946 | P05-26 | Em khác, cha mẹ, giáo viên tải ảnh của em; giáo viên gọi điểm cuối tệp chung; cha mẹ xem chủ đề | Em khác 404; cha mẹ, giáo viên 401 hoặc 403; tệp chung 404; chủ đề không có ảnh, đề chép | Kiểm thử tự động `tutor-images-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1947 | P05-26 | Ứng dụng học sinh chọn ảnh: 1 ảnh có sẵn thêm 2 ảnh; 2 có sẵn thêm 2; GIF; PDF | Hợp lệ; "tối đa 3 ảnh"; "Chỉ gửi ảnh JPEG, PNG hoặc WebP" | Kiểm thử tự động `apps/student/src/ai-tutor/ai-tutor-math.test.ts` | Đạt |
| 22_BAO_MAT.md | BM-141 | BM-245 | Gia sư AI, ảnh bài tập (YCTD-383 lát L4, BR-500, BR-501): nhận diện định dạng theo byte đầu, giới hạn số ảnh và cỡ ảnh ở bộ nhận tệp và ở nghiệp vụ; bỏ EXIF, vị trí chụp, XMP, IPTC, khối chữ PNG trước khi lưu và gửi đi; ảnh lưu ở kho tệp của trường với khóa có tiền tố của trường, không qua bảng `files`; chỉ chính em tải ảnh, phản hồi `no-store`, `nosniff`; ảnh có thông tin cá nhân không được lưu; xóa tệp và khóa tệp sau 30 ngày. Rủi ro còn lại: ảnh tới nhà cung cấp trước khi biết có thông tin cá nhân (máy chủ không có công cụ đọc chữ trong ảnh); giảm thiểu bằng lời nhắc trước khi chọn ảnh, bỏ siêu dữ liệu, chỉ gói Nâng cao do cha mẹ mua |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-383 lát L4 | Gia sư AI trả phí, lát L4: ảnh bài tập cho gói Nâng cao, xóa ảnh sau 30 ngày | {PHIEN_BAN} | P05-26 | AC-1300 đến AC-1305 | CT-1940 đến CT-1947 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/ai-tutor/tutor-images.ts`, `tutor-chat.ts`, `apps/api/src/ai-assistant/ai-provider.ts`, `apps/student/src/ai-tutor/StudentAiTutorScreen.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 30/10/2026; CI của PR |
