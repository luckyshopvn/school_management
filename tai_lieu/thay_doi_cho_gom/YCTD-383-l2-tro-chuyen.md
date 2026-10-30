---
yctd: YCTD-383
tieu_de: Gia sư AI trả phí, lát L2: học sinh trò chuyện bằng chữ với gia sư AI
ngay: 2026-10-30
phien_ban_de_xuat: 0.252.0
---

## 02 Nhật ký

### 2026-10-30 — Gia sư AI trả phí, lát L2: học sinh trò chuyện bằng chữ với gia sư AI (YCTD-383)

#### Công việc đã thực hiện

- Ứng dụng học sinh: thẻ "Gia sư AI" ở trang chủ (MH-596; chưa có gói thì nhờ cha mẹ đăng ký trong ứng dụng phụ huynh, có gói thì thấy số lượt còn lại); trang trò chuyện (MH-597): chọn môn, hỏi, nhận gợi ý từng bước, thanh số lượt còn lại, nút "Xem lời giải đầy đủ" (mở sau hai lượt tự làm), nút "Báo câu trả lời sai", danh sách hội thoại cũ. Công thức hiển thị bằng `react-markdown`, `remark-math`, `rehype-katex`, `katex` (giấy phép MIT), chuẩn hóa `\(...\)`, `\[...\]` trước khi hiển thị. Tệp `apps/student/src/ai-tutor/*`; `StudentHomeScreen.tsx` chỉ thêm thẻ.
- Máy chủ API: `apps/api/src/ai-tutor/tutor-chat.ts`, `tutor-chat.controller.ts`, `tutor-chat-rules.ts`, `tutor-usage.ts`, điểm kiểm tra khóa duy nhất `ai-tutor-access.ts`; đăng ký ở `apps/api/src/dang-ky/yctd-383-l2-tro-chuyen.ts`. Bộ nối nhà cung cấp AI gửi được các lượt cũ của hội thoại (`AiPrompt.history`); bộ giả lập có câu trả lời của gia sư và hàng kết quả định sẵn cho kiểm thử.
- Token: việc nền tổng hợp token của trợ lý AI cộng thêm token của gia sư, phân loại `tutor_school` (gói trường bán, tính lên hóa đơn dịch vụ, dòng phí "Gia sư AI học sinh") và `tutor_platform` (gói nền tảng bán, chi phí của nền tảng); trang Trợ lý AI của cổng vận hành ghi tên hai phân loại mới.
- Việc nền theo trường: hoàn lượt tạm giữ quá hạn, xóa lịch sử quá 12 tháng.
- Database migration: hệ thống `0133_add_ai_tutor_chat`; nền tảng `0252_add_ai_token_usage_tutor_configs`.
- Kiểm thử: `apps/api/src/ai-tutor/tutor-chat.test.ts` (CT-1767 đến CT-1776), `tutor-chat-rules.test.ts` (CT-1777), `database/src/billing/ai-pricing.test.ts` (dòng phí có tên riêng), `apps/student/src/ai-tutor/ai-tutor-math.test.ts`; e2e `tests/e2e/143-gia-su-ai-tro-chuyen.spec.ts` (CT-1778, dự án nhiều trường; cấu hình e2e nhiều trường chạy thêm ứng dụng học sinh ở cổng 5389).

#### Quyết định

- Eric duyệt phương án, bản mẫu MH-596, MH-597 và danh sách lát ngày 2026-10-30; quyết định Q3, Q4, Q6, Q7, Q8.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - thứ tự xử lý một câu hỏi: kiểm khóa và sẵn sàng (không giữ lượt) → tạm giữ lượt → quét dữ liệu cá nhân → kiểm duyệt câu hỏi → gọi nhà cung cấp → kiểm duyệt câu trả lời → kiểm tra lộ đáp án → lưu → trừ hoặc hoàn lượt;
  - câu có dữ liệu cá nhân không được lưu; câu bị kiểm duyệt, câu tự hại, bị bắt nạt được lưu để em xem lại và để lát L3 báo giáo viên, nhưng không gửi lại nhà cung cấp ở lượt sau;
  - "lượt tự làm" là các câu em gửi sau câu hỏi đầu tiên của hội thoại, không tính câu bị chặn và câu xin lời giải; xin lời giải đầy đủ cũng tính một lượt hỏi;
  - kiểm tra lộ đáp án: nhà cung cấp trả JSON có `final_answer` chỉ để máy chủ so; câu trả lời có cụm "đáp án là", "kết quả là"… hoặc chứa đúng đáp án (khi đáp án không có sẵn trong đề) thì gọi viết lại một lần; vẫn lộ thì thay bằng câu cố định; token của cả hai lần gọi đều tính;
  - kiểm duyệt bằng danh sách cụm từ ở máy chủ (có dấu và không dấu, so trọn cụm để không nhầm "từ từ", "tủ sắt"), cộng lời nhắc yêu cầu nhà cung cấp từ chối nội dung ngoài học tập;
  - câu đã gọi nhà cung cấp nhưng được hoàn lượt (ngoài học tập, câu trả lời bị chặn) vẫn tính token vào phân loại theo nguồn gói vì đã tốn;
  - cha mẹ thấy môn, chủ đề do gia sư đặt (đã quét dữ liệu cá nhân), số lượt từng hội thoại và số lượt tháng này; không thấy toàn văn, không thấy cờ cảnh báo;
  - phiên xem hỗ trợ của quản trị nền tảng không gửi câu hỏi, không thấy hội thoại của em;
  - thẻ ở trang chủ chỉ hiện lời nhờ cha mẹ, chưa làm nút "Gửi lời nhờ cha mẹ" của bản mẫu vì cần thêm thông báo cho phụ huynh;
  - gói trường bán vẫn dùng được khi gói dịch vụ của trường chưa đặt đơn giá AI; khi đó token chưa tính được thành tiền (như trợ lý AI với mô hình chưa có đơn giá).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-383, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md` mục 18Q, 18S, `17_DAC_TA_API.md` mục 17.13, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Lát L3: khóa theo phòng thi, bài tập, khung giờ (thêm vào `aiTutorAccess`), báo giáo viên chủ nhiệm từ `ai_tutor_safety_flags`.
- Eric xác nhận: gói trường bán khi gói dịch vụ chưa có đơn giá AI thì cho dùng (token chưa thành tiền) hay chặn; nút "Gửi lời nhờ cha mẹ".
- Ứng dụng phụ huynh chưa có màn hình chủ đề và số lượt (điểm cuối đã có).
- Quét thư viện: `katex` 0.16.47 có cảnh báo mức Thấp GHSA-238p-pmpm-9mq7 (bản vá 0.18.2; `rehype-katex` 7 chỉ nhận 0.16); không bật chế độ `trust` của KaTeX; chờ Eric quyết định chấp nhận rủi ro.

## 24 Yêu cầu thay đổi

### YCTD-383: Gia sư AI trả phí, lát L2: học sinh trò chuyện bằng chữ với gia sư AI – 2026-10-30

- Lý do: lát L2 của YCTD-383 theo danh sách lát Eric duyệt ngày 2026-10-30.
- Nội dung thay đổi: học sinh hỏi gia sư AI bằng chữ theo môn, nhận gợi ý từng bước theo cấp (Tiểu học lời nhắc riêng), xem lời giải đầy đủ sau hai lượt tự làm, báo câu trả lời sai, xem lại hội thoại 12 tháng; mỗi câu hỏi một lượt (giữ, trừ, hoàn); quét dữ liệu cá nhân, kiểm duyệt câu hỏi và câu trả lời, từ chối ngoài học tập, mẫu trả lời có số 111 và cờ cảnh báo khi có dấu hiệu tự hại hoặc bị bắt nạt; cha mẹ xem chủ đề và số lượt; token phân loại theo nguồn gói.
- Thành phần bị ảnh hưởng: `apps/api/src/ai-tutor/tutor-chat*.ts`, `tutor-usage.ts`, `ai-tutor-access.ts`, `apps/api/src/ai-assistant/ai-provider.ts`, `ai-assistant.ts` (`syncUsage`), `database/src/billing/ai-pricing.ts`, `billing.ts`, `platform-ai.ts`, `database/platform/schema.ts`, `apps/student/src/ai-tutor/*`, `apps/student/src/StudentHomeScreen.tsx`, `apps/student/package.json`, `apps/platform/src/AiPage.tsx`, `tests/playwright.multi.config.ts`, `tests/e2e-multi-environment.mjs`, database migration hệ thống `0133`, nền tảng `0252`, tài liệu 07, 10, 11, 14, 16, 17, 21, 27.
- Dữ liệu, API, quyền bị ảnh hưởng: cột mới của `ai_tutor_messages`, bảng `ai_tutor_safety_flags` (hệ thống); hai giá trị mới của `ai_token_usage.config` (nền tảng); điểm cuối mới `/student/ai-tutor/*` (kênh student, `P02.learning.study`) và `/children/{id}/ai-tutor/topics` (người giám hộ); không đổi quyền có sẵn.
- Ảnh hưởng chức năng cũ: hóa đơn dịch vụ có thêm dòng "Gia sư AI học sinh" khi trường có lượt dùng từ gói trường bán và gói dịch vụ đã đặt đơn giá AI; trợ lý AI của giáo viên không đổi.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/ai-tutor/*.test.ts`, `apps/api/src/ai-assistant/*.test.ts`, `database/src/billing/*.test.ts`, `apps/student` kiểm thử đơn vị; e2e 143, 142, 153 (dự án nhiều trường).
- Mức: Lớn (thuộc YCTD-383). Người phê duyệt: Eric, ngày 2026-10-30 (phương án, bản mẫu MH-596, MH-597, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gia sư AI trả phí, lát L2: học sinh trò chuyện bằng chữ với gia sư AI, gợi ý từng bước, an toàn cho trẻ, lịch sử 12 tháng, token theo nguồn gói (YCTD-383).
- Thư viện mới ở `apps/student`: `react-markdown` 10.1.0, `remark-math` 6.0.0, `rehype-katex` 7.0.1, `katex` 0.16.47, đều giấy phép MIT.
- Database migration: hệ thống `0133_add_ai_tutor_chat`, nền tảng `0252_add_ai_token_usage_tutor_configs`. Quay lui: chạy `down` của hai tệp (xóa bảng cờ, xóa cột mới của tin nhắn; xóa dòng token `tutor_school`, `tutor_platform` rồi trả ràng buộc về như cũ); hóa đơn dịch vụ đã phát hành có dòng "Gia sư AI học sinh" giữ nguyên.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gia sư AI trả phí, lát L2: học sinh trò chuyện với gia sư AI | YCTD-383 |

## index Số đếm

| 14 | màn hình | +2 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-466 | Gia sư AI, lượt hỏi (YCTD-383 lát L2): mỗi câu hỏi tạm giữ một lượt trước khi gọi nhà cung cấp, trừ khi nhà cung cấp trả lời, hoàn khi lỗi, khi có dữ liệu cá nhân, khi kiểm duyệt chặn câu hỏi hoặc câu trả lời, khi ngoài học tập; hết lượt thì không gọi; chỉ dùng khóa AI của nền tảng; điểm kiểm tra khóa duy nhất quyết định em có được hỏi (phiên xem hỗ trợ chỉ đọc; lát L3 thêm phòng thi, bài tập, khung giờ) |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-467 | Gia sư AI, gợi ý từng bước (YCTD-383 lát L2): lời nhắc cố định theo cấp, khối, môn, Tiểu học câu ngắn, ví dụ gần gũi, không thuật ngữ; gợi ý theo thang nhắc khái niệm, gợi ý cách làm, làm mẫu bài tương tự, không giải bài gốc; "Xem lời giải đầy đủ" chỉ mở sau ít nhất hai lượt tự làm trong hội thoại; câu trả lời lộ đáp án cuối quá sớm thì viết lại, viết lại vẫn lộ thì thay bằng câu cố định |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-468 | Gia sư AI, an toàn cho trẻ (YCTD-383 lát L2): câu hỏi có số điện thoại, thư điện tử, số định danh, tên người trong trường bị chặn trước khi gửi, không lưu; kiểm duyệt câu hỏi và câu trả lời, từ chối chủ đề ngoài học tập; câu có dấu hiệu tự hại hoặc bị bắt nạt nhận câu trả lời theo mẫu có Tổng đài quốc gia bảo vệ trẻ em 111, không gửi nhà cung cấp, ghi cờ cảnh báo (lát L3 báo giáo viên chủ nhiệm) |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-469 | Gia sư AI, lịch sử (YCTD-383 lát L2): hội thoại giữ 12 tháng, việc nền xóa quá hạn theo ngày trọn vẹn giờ Việt Nam; em xem lại hội thoại của mình; cha mẹ chỉ xem môn, chủ đề, số lượt; giáo viên không xem |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-470 | Gia sư AI, token theo nguồn gói (YCTD-383 lát L2, Q8): token của lượt dùng từ gói trường bán tính lên hóa đơn dịch vụ của trường cùng đơn giá AI của gói dịch vụ, dòng phí "Gia sư AI học sinh"; token của lượt dùng từ gói nền tảng bán là chi phí của nền tảng, không tính cho trường |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-18 | Gia sư AI: học sinh hỏi và nhận gợi ý (YCTD-383 lát L2) | VT-21 (kênh student, `P02.learning.study`) | Môn, câu hỏi, câu tự làm, yêu cầu xem lời giải | Kiểm khóa, giữ lượt, gọi nhà cung cấp bằng lời nhắc theo cấp, kiểm tra lộ đáp án, trừ hoặc hoàn lượt | Trang Gia sư AI (MH-597), thẻ ở trang chủ (MH-596) | BR-466, BR-467 |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-19 | Gia sư AI: an toàn cho trẻ (YCTD-383 lát L2) | Hệ thống | Câu hỏi, câu trả lời | Quét dữ liệu cá nhân, kiểm duyệt, mẫu trả lời có số 111, cờ cảnh báo | Câu trả lời theo mẫu; dòng `ai_tutor_safety_flags` | BR-468 |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-20 | Gia sư AI: lịch sử, báo câu trả lời sai, chủ đề cho cha mẹ (YCTD-383 lát L2) | VT-21 (hội thoại của mình), VT-14 (người giám hộ của con) | Hội thoại, câu trả lời, con | Liệt kê, xem lại, báo sai; cha mẹ xem chủ đề và số lượt; xóa quá 12 tháng | Danh sách hội thoại cũ (MH-597); điểm cuối chủ đề cho ứng dụng phụ huynh | BR-469 |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-21 | Gia sư AI: token theo nguồn gói (YCTD-383 lát L2) | Hệ thống (việc nền tổng hợp token, chốt kỳ thu phí dịch vụ) | Token của câu trả lời, nguồn gói của lượt | Ghi `tutor_school`, `tutor_platform`; tính dòng phí của gói trường bán | Dòng "Gia sư AI học sinh" trên hóa đơn dịch vụ; trang Trợ lý AI của cổng vận hành | BR-470 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1186 | Cho em có gói còn lượt / Khi hỏi một câu / Thì một lượt được tạm giữ rồi trừ khi gia sư trả lời; gia sư nhắc khái niệm hoặc gợi ý cách làm, không có đáp án; em chưa có gói thì trang chủ nhờ cha mẹ đăng ký, không giữ lượt (CT-1767, CT-1768, CT-1778; YCTD-383 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1187 | Cho câu trả lời của nhà cung cấp lộ đáp án cuối ở chế độ gợi ý / Khi máy chủ kiểm tra / Thì câu trả lời được viết lại; viết lại vẫn lộ thì thay bằng câu cố định; token của các lần gọi đều ghi (CT-1769; YCTD-383 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1188 | Cho hội thoại có ít hơn hai lượt tự làm / Khi em bấm "Xem lời giải đầy đủ" / Thì bị từ chối; đủ hai lượt thì nút mở và gia sư trình bày lời giải đầy đủ (CT-1770, CT-1778; YCTD-383 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1189 | Cho câu hỏi có số điện thoại hoặc tên người trong trường / Khi em gửi / Thì bị chặn trước khi gửi đi, không lưu, lượt được hoàn (CT-1771; YCTD-383 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1190 | Cho câu hỏi có nội dung không phù hợp, câu trả lời không phù hợp, câu ngoài học tập hoặc nhà cung cấp lỗi / Khi em gửi / Thì gia sư từ chối hoặc báo lỗi, lượt được hoàn, không còn lượt treo (CT-1772; YCTD-383 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1191 | Cho câu có dấu hiệu tự hại hoặc bị bắt nạt / Khi em gửi / Thì nhận câu trả lời theo mẫu có số 111, có cờ cảnh báo chưa báo, câu không gửi nhà cung cấp và không gửi lại ở lượt sau (CT-1773; YCTD-383 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1192 | Cho em còn một lượt / Khi gửi hai câu hỏi cùng lúc / Thì chỉ một câu được trả lời, câu kia báo hết lượt, số lượt không âm (CT-1774; YCTD-383 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1193 | Cho em Tiểu học, em Trung học / Khi hỏi / Thì lời nhắc Tiểu học có câu ngắn, ví dụ gần gũi, không thuật ngữ; Trung học dùng thuật ngữ đúng chương trình (CT-1775, CT-1777; YCTD-383 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1194 | Cho lượt dùng từ gói trường bán và gói nền tảng bán / Khi việc nền tổng hợp token / Thì token ghi riêng `tutor_school`, `tutor_platform`; chỉ `tutor_school` vào dòng phí "Gia sư AI học sinh" của hóa đơn dịch vụ (CT-1775; YCTD-383 lát L2) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1195 | Cho hội thoại của em / Khi em khác, cha mẹ, phụ huynh khác, giáo viên muốn xem / Thì em khác không thấy (404), cha mẹ chỉ thấy chủ đề và số lượt, phụ huynh khác và giáo viên bị từ chối; lịch sử quá 12 tháng bị xóa (CT-1776; YCTD-383 lát L2) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.3 Ứng dụng phụ huynh | MH-596 | Ứng dụng học sinh: thẻ Gia sư AI ở trang chủ (YCTD-383 lát L2): chưa có gói thì "Em chưa có gói. Nhờ cha mẹ đăng ký Gia sư AI trong ứng dụng phụ huynh."; có gói thì thanh "Còn X/Y lượt hỏi" và nút Mở gia sư AI; hết gói mà còn hội thoại thì nút Xem hội thoại cũ; học sinh không ở cấp TH, THCS, THPT thì không hiện | Học sinh |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.3 Ứng dụng phụ huynh | MH-597 | Ứng dụng học sinh: trang Gia sư AI (YCTD-383 lát L2): thanh số lượt; Hội thoại cũ (chủ đề, môn, thời gian), Hỏi bài mới; chọn môn (nút bấm theo môn của cấp); tin nhắn của em và của gia sư (nhãn bậc gợi ý, công thức KaTeX, Báo câu trả lời sai); Xem lời giải đầy đủ (mở sau hai lượt tự làm, có dòng nhắc số lượt còn thiếu); ô nhập và Gửi; thông báo khóa, hết lượt, câu không tính lượt | Học sinh |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1767 | P05-18 | Em chưa có gói xem trang và gửi câu hỏi | Trang báo chưa có gói; gửi 422 hết lượt, không có dòng sổ lượt, không gọi nhà cung cấp | Kiểm thử tự động `apps/api/src/ai-tutor/tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1768 | P05-18 | Em THCS có gói tháng hỏi một câu | 201, lượt `captured`, đã dùng 1, bậc `concept`, không có đáp án, có chủ đề; lời nhắc THCS lớp 8 chế độ gợi ý, khóa của nền tảng; token, mô hình ghi trên câu trả lời | Kiểm thử tự động `tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1769 | P05-18 | Nhà cung cấp trả câu lộ đáp án; lần viết lại vẫn lộ | Gọi viết lại, hiển thị câu đã viết lại, token cộng cả hai lần; vẫn lộ thì câu cố định | Kiểm thử tự động `tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1770 | P05-18 | Xin lời giải ngay sau câu đầu; sau một, hai lượt tự làm | 422 BR-467; một lượt chưa mở; hai lượt mở, bậc `solution`, lời nhắc chế độ lời giải; lượt cũ gửi kèm | Kiểm thử tự động `tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1771 | P05-19 | Câu có số điện thoại; câu có họ tên học sinh của trường | 422 BR-468, lượt `released` lý do "Có dữ liệu cá nhân", số lượt không đổi, không lưu tin nhắn, không gọi nhà cung cấp | Kiểm thử tự động `tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1772 | P05-19 | Câu hỏi không phù hợp; câu trả lời không phù hợp; nhà cung cấp từ chối vì ngoài học tập; nhà cung cấp lỗi | Lượt hoàn với lý do đúng từng trường hợp; câu trả lời không phù hợp không hiển thị; lỗi 422; không còn lượt treo | Kiểm thử tự động `tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1773 | P05-19 | Câu "muốn chết", câu "bị bắt nạt", rồi câu hỏi bài trong cùng hội thoại | Câu trả lời theo mẫu có 111, lượt hoàn, cờ `self_harm`, `bullying` chưa báo; không gọi nhà cung cấp; lượt sau không gửi kèm hai câu đó | Kiểm thử tự động `tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1774 | P05-18 | Gói lượt còn 1, gửi hai câu đồng thời | Một 201, một 422; đã dùng 1, đang giữ 0 | Kiểm thử tự động `tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1775 | P05-18, P05-21 | Em Tiểu học (gói nền tảng) hỏi; tổng hợp token | Lời nhắc Tiểu học lớp 3 có câu ngắn, ví dụ chia kẹo; token ghi `tutor_school`, `tutor_platform` riêng, đúng số; chỉ `tutor_school` thành dòng "Gia sư AI học sinh" | Kiểm thử tự động `tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1776 | P05-20 | Em khác xem, báo sai hội thoại của em; báo sai câu của em; cha mẹ, phụ huynh khác, giáo viên xem chủ đề; mã phiên sai kênh; việc nền với tin nhắn 400 ngày trước và lượt treo một giờ | 404; 404; cha mẹ thấy chủ đề và số lượt, không có toàn văn; 403; 403; xóa hội thoại cũ, hoàn một lượt | Kiểm thử tự động `tutor-chat.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1777 | P05-18, P05-19 | Hàm thuần: lời nhắc theo cấp, kiểm duyệt (cả "từ từ", "tủ sắt"), đọc JSON, lộ đáp án, đếm lượt tự làm, mốc xóa, điểm kiểm tra khóa | Đúng từng trường hợp | Kiểm thử tự động `apps/api/src/ai-tutor/tutor-chat-rules.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1778 | P05-18, P05-20 | Em chưa có gói mở trang chủ; em có gói 10 lượt hỏi, tự làm hai lượt, xem lời giải, báo sai, mở lại hội thoại cũ | Lời nhờ cha mẹ; gợi ý có công thức KaTeX, không đáp án, còn 9/10; nút lời giải mở sau hai lượt, còn 6/10; báo sai được ghi; hội thoại cũ mở lại đúng | e2e `tests/e2e/143-gia-su-ai-tro-chuyen.spec.ts` (dự án nhiều trường) | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-383 lát L2 | Gia sư AI trả phí, lát L2: học sinh trò chuyện với gia sư AI | {PHIEN_BAN} | P05-18, P05-19, P05-20, P05-21 | AC-1186 đến AC-1195 | CT-1767 đến CT-1778 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/ai-tutor/tutor-chat.ts`, `apps/student/src/ai-tutor/StudentAiTutorScreen.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 30/10/2026; CI của PR |
