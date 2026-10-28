---
yctd: YCTD-259
tieu_de: DT-27 phần 27i: an toàn trẻ em và kiểm duyệt ở chợ gia sư (tin nhắn có lọc, báo cáo vi phạm, tạm khóa gia sư, ghi hình bắt buộc với trẻ vị thành niên, quyền xem bản ghi)
ngay: 2026-10-28
phien_ban_de_xuat: 0.182.0
---

## 02 Nhật ký

### 2026-10-28 — DT-27 phần 27i: an toàn trẻ em và kiểm duyệt ở chợ

#### Công việc đã thực hiện

- Đọc mục 19.2 (ghi hình, báo cáo vi phạm), 19.5 (27i), 19.6, 20.5 (lọc thông tin liên lạc của 28e) của `32_KE_HOACH_THEO_HE_THONG_SO.md`. Phiên điều phối giao ngày 2026-10-28 sau 27h (PR 229): báo cáo vi phạm, tạm khóa gia sư, lọc thông tin liên lạc (dùng lại hàm thuần `scanContactInfo` của 28e trong `packages/shared`), ghi hình bắt buộc với buổi có trẻ vị thành niên theo 19.2, quyền xem bản ghi; giao diện ở `apps/tutor`, `apps/market` và cổng nền tảng.
- Văn bản pháp lý: Luật 91/2025/QH15 Điều 24 (dữ liệu trẻ em) đã đọc toàn văn ở S8a ngày 2026-10-25 (19.2); Nghị định 356/2025 Điều 21 khoản 5 (phần mềm giáo dục có ghi hình) theo 19.2. Luật Trẻ em 102/2016 và căn cứ của Tổng đài 111 **chưa đọc lại bản gốc trong phiên này** (19.2 ghi chưa xác minh số điều); sản phẩm chỉ hướng dẫn gọi 111 và 113, không trích điều luật.
- Marketplace `0030`: `market_message_threads`, `market_messages`, `market_reports`, `market_tutor_suspensions`, `market_moderation_log`, `market_session_recordings`, `market_recording_views`, `market_evidence_exports`; thêm `recording_required`, `recording_consented` vào `market_bookings`; kiểu bảng ở `database/marketplace/schema-parts/dt-27i-an-toan-tre-em.ts`.
- Máy chủ API (đăng ký ở `src/dang-ky/dt-27i-an-toan-tre-em.ts`):
  - `market-safety-rules.ts`: hàm thuần (hạn xử lý theo mức, mức tối thiểu của an toàn trẻ em, tạm khóa ngay, trẻ vị thành niên theo năm sinh, hạn giữ bản ghi, giờ mở phòng, lọc tin nhắn, điều kiện "gia sư không bị tạm khóa");
  - `market-safety.ts`: tin nhắn, báo cáo vi phạm, kháng nghị, tạm khóa và gỡ khóa, phòng học có ghi hình qua bộ nối video của 27a, xem bản ghi, xóa bản ghi hết hạn, hàng chờ kiểm duyệt, xuất hồ sơ;
  - `market-bookings.ts` (27h): đặt buổi với trẻ vị thành niên phải đồng ý ghi hình; gia sư đang tạm khóa không đặt được; hủy buổi sắp tới khi tạm khóa (hoàn đủ); không giải ngân trong lúc tạm khóa; `market-public.ts`: ẩn gia sư đang tạm khóa.
- `packages/market-client`: `SafetyWidgets.tsx` (tin nhắn, báo cáo vi phạm, phát bản ghi, chính sách an toàn trẻ em), `marketBlob`.
- Giao diện: Chợ gia sư (đồng ý ghi hình khi đặt; Nhắn tin, Báo cáo hồ sơ ở trang gia sư; Vào phòng học, Xem bản ghi, Báo cáo vi phạm ở buổi học; Tin nhắn; Chính sách an toàn trẻ em); ứng dụng Gia sư (Kiểm duyệt và an toàn, Mở và kết thúc phòng học, Xem bản ghi, Báo cáo phụ huynh, Tin nhắn, Chính sách); cổng nền tảng (Kiểm duyệt và an toàn trẻ em: chỉ số, hàng chờ, bằng chứng, quyết định, tạm khóa ngay, xuất hồ sơ, xem bản ghi).
- Sửa cổng phát triển trùng (phiên điều phối phát hiện khi chạy toàn hệ thống): `apps/tutor` và `apps/student` cùng đặt `server.port: 5179` vì PR 223 và PR 224 gộp song song; đổi `apps/tutor` sang **5181** (5180 dành cho portal chạy nhanh). Đã rà: e2e dùng cổng riêng 5388 (không đổi), máy chủ API và dịch vụ định danh không có danh sách CORS hay origin theo cổng (giao diện gọi cùng tên miền qua proxy), `apps/mobile` chỉ chuyển cổng 5174, 5175, 5179 (không có ứng dụng Gia sư); cập nhật `README.md` và bảng cổng ở `34_TONG_HOP_CHUC_NANG_HE_THONG/01_TONG_QUAN_VA_NEN_TANG.md` (thêm dòng Chợ gia sư, Ứng dụng Gia sư). Mảnh YCTD-262 còn ghi 5179 là lịch sử, không sửa.
- Kiểm thử: CT-27i-1 (`market-safety-rules.test.ts`), CT-27i-2 đến CT-27i-5 (`market-safety.test.ts`), CT-27i-6 (e2e `198-market-safety.spec.ts`); sửa `market-bookings.test.ts` và e2e 197 cho đồng ý ghi hình.

#### Quyết định

- Tin nhắn chỉ có luồng phụ huynh với gia sư, phụ huynh mở luồng; trẻ không có tài khoản ở chợ nên không có luồng gia sư với trẻ. Chữ đã che lưu ở `body`; chữ gốc chỉ lưu khi có che, chỉ nhân viên kiểm duyệt xem (bằng chứng). Lần thứ 3 trong một luồng một người gửi thông tin liên lạc ngoài thì gắn cờ luồng và tự tạo báo cáo né hoa hồng (mức trung bình).
- Báo cáo vi phạm: năm loại (an toàn trẻ em, quấy rối, gian lận, né hoa hồng, nội dung sai), bốn mức; hạn xử lý nghiêm trọng 4 giờ, cao 24 giờ, trung bình 3 ngày, thấp 7 ngày; an toàn trẻ em không thấp hơn mức cao. Gia sư chỉ báo phụ huynh đã có buổi hoặc tin nhắn với mình.
- Mức nghiêm trọng tạm khóa gia sư ngay, không chờ nhân viên: ẩn khỏi chợ, không đặt buổi, không nhắn tin, không mở phòng, hủy buổi sắp tới (hoàn đủ như gia sư hủy), giữ tiền chưa giải ngân, báo phụ huynh đã có buổi với gia sư (kèm 111, 113). Tạm khóa là dòng riêng, không khóa tài khoản, để gia sư đăng nhập xem và kháng nghị.
- Quyết định: tạm khóa, cảnh cáo, bác; bắt buộc có lý do; cảnh cáo hoặc bác thì gỡ khóa đang có. Một lần kháng nghị trong 7 ngày (gia sư kháng nghị tạm khóa, cảnh cáo; người báo kháng nghị bác), nhân viên khác người quyết định lần đầu xét. Mọi bước ghi nhật ký kiểm duyệt.
- Ghi hình (19.2): mọi buổi có trẻ dưới 18 tuổi (theo năm sinh, năm tròn 18 vẫn tính) phải ghi; phụ huynh đồng ý khi đặt, không đồng ý thì không đặt được. Phòng chỉ mở khi bắt đầu ghi được (có bộ nối video, kho tệp, khóa mã hóa của chợ); phụ huynh chỉ vào phòng khi đang ghi. Bản ghi mã hóa AES-256-GCM bằng `MARKET_FILES_KEY`, giữ 30 ngày, giữ tiếp khi buổi đang tranh chấp, có báo cáo chưa chốt (trừ đã bác) về một trong hai bên, hoặc gia sư đang tạm khóa. Chỉ phụ huynh, gia sư của buổi, nhân viên nền tảng xem; phát `inline`, `no-store`, giao diện không có nút tải; mỗi lượt xem ghi nhật ký.
- Xuất hồ sơ cho cơ quan có thẩm quyền phải ghi cơ quan và số văn bản yêu cầu, có nhật ký; tệp xuất gồm báo cáo, tin nhắn gốc, buổi học, siêu dữ liệu bản ghi; bàn giao bản ghi theo thủ tục riêng (E-08).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-259, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-444 đến BR-447, PQ-191, P02-136, AC-1106 đến AC-1110, MH-543 đến MH-545, CT-1407 đến CT-1412, QĐ-49.

#### Vấn đề tồn đọng

- Chưa làm: giao diện phòng video trong ứng dụng Chợ gia sư và Gia sư (máy chủ đã cấp mã vào phòng, bộ nối của 27a), điểm danh tự động từ sự kiện vào ra; nhận sự kiện kết thúc ghi của LiveKit cho phòng của chợ (bộ giả lập trả tệp ngay; LiveKit thật để bản ghi ở trạng thái `processing`); mã hóa tệp do LiveKit Egress ghi thẳng vào kho (hiện dựa vào mã hóa của kho); danh sách từ ngữ cấm của chợ; trẻ đọc tin nhắn khi phụ huynh cho; báo cáo từ đánh giá (chưa có đánh giá sau buổi); văn bản PL-19 đầy đủ (luật sư của Eric rà, E-08); thủ tục chuyển cơ quan có thẩm quyền.
- Đọc lại bản gốc Luật Trẻ em 102/2016 và căn cứ Tổng đài 111 trước khi mở chợ.

## 24 Yêu cầu thay đổi

### YCTD-259: DT-27 phần 27i: an toàn trẻ em và kiểm duyệt ở chợ gia sư – 2026-10-28

- Lý do: phần 27i của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 19.4, 19.5; ràng buộc ghi hình ở 19.2; phiên điều phối giao ngày 2026-10-28 sau 27h (PR 229).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Tin nhắn** phụ huynh với gia sư, che thông tin liên lạc ngoài bằng hàm thuần của 28e, cảnh báo, gắn cờ khi lặp lại.
  - **Báo cáo vi phạm** có loại, mức, hạn xử lý; hướng dẫn 111, 113.
  - **Tạm khóa gia sư** ngay khi báo cáo nghiêm trọng hoặc theo quyết định: ẩn, chặn đặt và nhắn, hủy buổi sắp tới hoàn đủ, giữ tiền, báo phụ huynh.
  - **Kiểm duyệt**: hàng chờ, nhận xử lý, quyết định có lý do, kháng nghị do nhân viên khác xét, nhật ký, chỉ số, xuất hồ sơ có nhật ký.
  - **Ghi hình bắt buộc** với trẻ vị thành niên, đồng ý khi đặt; phòng chỉ mở khi đang ghi; bản ghi mã hóa, giữ 30 ngày, giữ tiếp khi có bằng chứng đang mở; chỉ người của buổi và nhân viên xem, không tải.
  - **Chính sách an toàn trẻ em** (bản tóm tắt) ở hai ứng dụng.
  - **Cổng phát triển của `apps/tutor`** đổi từ 5179 (trùng `apps/student`) sang 5181.
- Thành phần bị ảnh hưởng: `database` (`marketplace/migrations/0030`, `marketplace/schema-parts/dt-27i-an-toan-tre-em.ts`, `dt-27h-dat-buoi-thanh-toan.ts`), `apps/api` (`market/market-safety.ts`, `market-safety-rules.ts`, `market-bookings.ts`, `market-public.ts`, `tenancy-route-policy.ts`, `dang-ky/dt-27i-an-toan-tre-em.ts`), `packages/market-client`, `apps/market`, `apps/tutor` (cả `vite.config.ts`: cổng 5181), `apps/platform`, `tests` (spec 197, 198), `README.md`, tài liệu 34.
- Dữ liệu bị ảnh hưởng: marketplace `0030` (8 bảng, 2 cột ở `market_bookings`).
- API bị ảnh hưởng: `GET`, `POST /api/v1/market/messages/threads`, `GET`, `POST /api/v1/market/messages/threads/{id}`, `POST`, `GET /api/v1/market/reports`, `POST /api/v1/market/reports/{id}/appeal`, `GET /api/v1/market/tutor/safety`, `POST /api/v1/market/tutor/bookings/{id}/session/start`, `POST /api/v1/market/tutor/bookings/{id}/session/end`, `POST /api/v1/market/bookings/{id}/session/join`, `GET /api/v1/market/bookings/{id}/recording`, `GET /api/v1/market/bookings/{id}/recording/stream`, `GET /api/v1/market/tutor/bookings/{id}/recording`, `GET /api/v1/market/tutor/bookings/{id}/recording/stream`, `GET /api/v1/market/admin/safety`, `GET /api/v1/market/admin/safety/reports/{id}`, `POST /api/v1/market/admin/safety/reports/{id}/assign`, `POST /api/v1/market/admin/safety/reports/{id}/decide`, `POST /api/v1/market/admin/safety/reports/{id}/suspend`, `POST /api/v1/market/admin/safety/reports/{id}/export`, `GET /api/v1/market/admin/safety/recordings/{bookingId}`, `POST /api/v1/market/admin/safety/run-due`; `POST /api/v1/market/bookings` nhận thêm `recording_consented`.
- Cấu hình: dùng lại `VIDEO_PROVIDER` (27a), `MARKET_FILES_KEY` (27g), `MARKET_JOB_INTERVAL_SECONDS` (27h).
- Giao diện bị ảnh hưởng: MH-543, MH-544, MH-545; MH-540, MH-541 (thêm phòng học, bản ghi, báo cáo).
- Quyền bị ảnh hưởng: PQ-191 (không thêm mã quyền của trường).
- Ảnh hưởng chức năng cũ: đặt buổi cho trẻ dưới 18 tuổi phải đồng ý ghi hình (trước đây không hỏi); gia sư đang tạm khóa không hiện ở chợ và không được giải ngân đến khi gỡ khóa.
- Kiểm thử cần thực hiện: `apps/api` (`market-safety-rules`, `market-safety`, `market-booking-rules`, `market-bookings`, `market`, `tenancy-matrix`), e2e nhiều trường 195 đến 198, kiểm tĩnh.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-27 phần 27i, an toàn trẻ em và kiểm duyệt ở chợ gia sư (YCTD-259).
- Chức năng mới: tin nhắn có lọc thông tin liên lạc, báo cáo vi phạm, tạm khóa gia sư, kiểm duyệt có kháng nghị, ghi hình bắt buộc với trẻ vị thành niên, xem bản ghi có nhật ký, xuất hồ sơ, chính sách an toàn trẻ em (P02-136).
- Thay đổi dữ liệu: marketplace `0030`.
- Thay đổi API: nhóm `/api/v1/market/messages/*`, `/api/v1/market/reports*`, `/api/v1/market/tutor/safety`, phòng học và bản ghi dưới `/api/v1/market/bookings/*` và `/api/v1/market/tutor/bookings/*`, `/api/v1/market/admin/safety*`.
- Kiểm thử: CT-1407 đến CT-1412 (CT-27i-1 đến CT-27i-6).
- Rủi ro: trung bình; tạm khóa tự động hủy buổi và hoàn tiền (giả lập); đặt buổi cho trẻ vị thành niên phải đồng ý ghi hình.
- Khả năng tương thích: buổi đã đặt trước bản này có `recording_required = false`.
- Phương án quay lui: hoàn lại commit gộp; bảng marketplace `0030` không ảnh hưởng phần khác.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27i: an toàn trẻ em và kiểm duyệt ở chợ gia sư: tin nhắn che thông tin liên lạc ngoài, báo cáo vi phạm, tạm khóa gia sư ngay khi nghiêm trọng, kiểm duyệt có kháng nghị, ghi hình bắt buộc với trẻ vị thành niên, xem bản ghi có nhật ký | YCTD-259 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +4 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +5 |
| Màn hình dự kiến | Số lượng | +3 |
| Ca kiểm thử khởi đầu | Số lượng | +6 |
| Chức năng đã liệt kê | Số lượng | +1 |
| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +3 |
| 16 | bảng dự kiến | +8 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27 phần 27i (YCTD-259: an toàn trẻ em, kiểm duyệt ở chợ) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-444 | Tin nhắn ở chợ gia sư (YCTD-259): chỉ có luồng giữa phụ huynh và gia sư, phụ huynh mở luồng; số điện thoại, thư điện tử, liên kết ngoài, tài khoản mạng xã hội bị che, người gửi được cảnh báo; chữ gốc chỉ nhân viên kiểm duyệt xem; lần thứ 3 trong một luồng một người gửi thông tin liên lạc ngoài thì gắn cờ và tạo báo cáo né hoa hồng; gia sư đang tạm khóa không nhắn được |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-445 | Báo cáo vi phạm ở chợ (YCTD-259): loại an toàn trẻ em, quấy rối, gian lận, né hoa hồng, nội dung sai; mức thấp, trung bình, cao, nghiêm trọng với hạn xử lý 7 ngày, 3 ngày, 24 giờ, 4 giờ; an toàn trẻ em không thấp hơn mức cao; gia sư chỉ báo phụ huynh đã có buổi hoặc tin nhắn với mình; mọi màn hình báo cáo hướng dẫn gọi 111, 113 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-446 | Tạm khóa gia sư và kiểm duyệt (YCTD-259): báo cáo nghiêm trọng tạm khóa ngay; khi tạm khóa gia sư bị ẩn, không nhận đặt buổi, không nhắn tin, không mở phòng, buổi sắp tới bị hủy và hoàn đủ, tiền chưa giải ngân bị giữ, phụ huynh có buổi với gia sư được báo; quyết định tạm khóa, cảnh cáo, bác bắt buộc có lý do, cảnh cáo hoặc bác thì gỡ khóa; một lần kháng nghị trong 7 ngày do nhân viên khác xét; xuất hồ sơ cho cơ quan có thẩm quyền phải ghi cơ quan, số văn bản; mọi bước ghi nhật ký |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-447 | Ghi hình buổi học ở chợ (YCTD-259; 32 mục 19.2): buổi có trẻ dưới 18 tuổi (theo năm sinh) luôn ghi, phụ huynh đồng ý khi đặt; phòng chỉ mở khi bắt đầu ghi được, phụ huynh chỉ vào khi đang ghi; bản ghi mã hóa, giữ 30 ngày, giữ tiếp khi tranh chấp, báo cáo chưa chốt hoặc tạm khóa đang mở; chỉ phụ huynh, gia sư của buổi và nhân viên nền tảng xem, không tải xuống, mỗi lượt xem ghi nhật ký |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-115 | PQ-191 | An toàn trẻ em ở chợ (YCTD-259, DT-27 phần 27i): không thêm mã quyền của trường; phụ huynh nhắn tin, báo cáo, vào phòng, xem bản ghi buổi của con mình; gia sư trả lời tin nhắn, báo cáo phụ huynh đã liên hệ, mở phòng, xem bản ghi buổi của mình, kháng nghị; nhân viên nền tảng (mã phiên vận hành) xử lý hàng chờ, tạm khóa, quyết định, xem bằng chứng và bản ghi, xuất hồ sơ |
| 10_YEU_CAU_CHUC_NANG.md | P02-102 | P02-136 | An toàn trẻ em và kiểm duyệt ở chợ gia sư (YCTD-259) | Phụ huynh; gia sư; nhân viên nền tảng | Tin nhắn, báo cáo, quyết định, buổi học | Che thông tin liên lạc, gắn cờ, báo cáo, tạm khóa, kháng nghị, ghi hình, xem bản ghi, xóa khi hết hạn giữ, xuất hồ sơ | Tin nhắn đã che, báo cáo và quyết định, bản ghi | BR-444, BR-445, BR-446, BR-447, PQ-191 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1106 | Cho phụ huynh và gia sư có luồng tin nhắn / Khi gia sư tự mở luồng, phụ huynh khác xem luồng, gửi số điện thoại, Zalo, thư điện tử ba lần / Thì bị từ chối, 404, chữ bị che kèm cảnh báo, lần thứ 3 gắn cờ và vào hàng chờ, nhân viên thấy chữ gốc (CT-1408; YCTD-259) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1107 | Cho gia sư có buổi sắp tới và buổi đã dạy / Khi phụ huynh báo cáo mức nghiêm trọng / Thì gia sư bị tạm khóa ngay, buổi sắp tới hoàn đủ, gia sư bị ẩn và không đặt được, phụ huynh có buổi được báo kèm 111, tiền buổi đã dạy không giải ngân (CT-1409; YCTD-259) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1108 | Cho báo cáo đang mở / Khi quyết định không lý do, bác có lý do, gia sư kháng nghị quyết định bác, người báo kháng nghị, cùng nhân viên xét, nhân viên khác tạm khóa, xuất hồ sơ thiếu số văn bản, đủ thông tin / Thì 400, đã quyết định, 409, đã kháng nghị, 403, chốt và tạm khóa, 400, xuất có nhật ký (CT-1410; YCTD-259) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1109 | Cho buổi đã trả tiền với trẻ dưới 18 tuổi / Khi đặt không đồng ý ghi hình, mở phòng trước giờ, phụ huynh vào trước khi gia sư mở, gia sư mở, kết thúc, người của buổi và người khác xem bản ghi, hết hạn giữ khi đang và hết tranh chấp / Thì 400, 409, 409, đang ghi, bản ghi sẵn sàng giữ 30 ngày, xem được (inline, no-store) và 404, giữ rồi xóa (CT-1411; YCTD-259) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1110 | Cho quy tắc an toàn / Khi tính hạn xử lý, mức tối thiểu, tạm khóa ngay, trẻ vị thành niên theo năm sinh, hạn giữ bản ghi, giờ mở phòng, lọc tin nhắn / Thì đúng mốc đã chọn (CT-1407; YCTD-259) |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-543 | Chợ gia sư: an toàn trẻ em (YCTD-259): đồng ý ghi hình ở Đặt buổi; Nhắn tin cho gia sư, Báo cáo hồ sơ ở trang gia sư; Vào phòng học, Xem bản ghi (không nút tải), Báo cáo vi phạm ở Buổi học của con; Tin nhắn; Chính sách an toàn trẻ em có 111, 113 | Phụ huynh |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-544 | Ứng dụng Gia sư: Kiểm duyệt và an toàn (tạm khóa, quyết định, kháng nghị); Mở, kết thúc phòng học, Xem bản ghi, Báo cáo phụ huynh ở Buổi dạy; Tin nhắn; Chính sách an toàn trẻ em (YCTD-259) | Gia sư |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-545 | Cổng nền tảng: Kiểm duyệt và an toàn trẻ em trong trang Chợ gia sư (YCTD-259): chỉ số an toàn, hàng chờ theo hạn, chi tiết kèm tin nhắn gốc, buổi học, bản ghi, nhận xử lý, tạm khóa ngay, quyết định có lý do, xuất hồ sơ, nhật ký, gia sư đang tạm khóa, xóa bản ghi hết hạn | Người vận hành nền tảng |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_message_threads, market_messages (marketplace, từ YCTD-259) | Tin nhắn giữa phụ huynh và gia sư (BR-444; marketplace `0030`) | luồng: (parent_account_id, tutor_account_id) duy nhất, flagged_at, last_message_at; tin: thread_id, author_account_id, role, body (đã che), original_body (chỉ khi có che), findings |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_reports, market_tutor_suspensions, market_moderation_log, market_evidence_exports (marketplace, từ YCTD-259) | Báo cáo vi phạm, tạm khóa, nhật ký kiểm duyệt, xuất hồ sơ (BR-445, BR-446; marketplace `0030`) | báo cáo: người báo (trống là hệ thống), người bị báo, nơi xảy ra, loại, mức, status (`open`, `decided`, `appealed`, `final`), due_at, người nhận, quyết định lần đầu và cuối, kháng nghị; tạm khóa: một dòng đang hiệu lực mỗi gia sư, lý do, người bật, người gỡ; nhật ký: báo cáo, người bị báo, người làm, hành động; xuất: cơ quan, số văn bản |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_session_recordings, market_recording_views (marketplace, từ YCTD-259) | Bản ghi buổi học và lượt xem (BR-447; marketplace `0030`; thêm `recording_required`, `recording_consented` ở `market_bookings`) | bản ghi: booking_id (duy nhất), room_name, status (`recording`, `processing`, `ready`, `failed`, `deleted`), egress_id, file_key, size_bytes, retain_until; lượt xem: người xem (tài khoản hoặc nhân viên), thời điểm |
| 12_KIEN_TRUC_HE_THONG.md | QĐ-43 | QĐ-49 | An toàn trẻ em của chợ gia sư (DT-27 phần 27i, YCTD-259): lọc tin nhắn bằng hàm thuần dùng chung của 28e; tạm khóa là dòng riêng có chỉ mục duy nhất một dòng đang hiệu lực, các truy vấn chợ lọc bằng điều kiện "không bị tạm khóa"; phòng học của chợ dùng lại bộ nối video của 27a (cấp chung cho bản triển khai), ghi hình bắt buộc theo cờ của buổi, bản ghi mã hóa bằng khóa của chợ trong kho tệp chung, phát `inline` có nhật ký; phương án đã loại: khóa tài khoản gia sư (gia sư mất quyền xem và kháng nghị), lưu tin nhắn gốc cho cả hai bên (lộ thông tin liên lạc), cho phụ huynh vào phòng khi chưa ghi (mất bằng chứng) | Đã chọn |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1407 | P02-136 | CT-27i-1: hàm thuần: hạn xử lý theo mức, mức tối thiểu an toàn trẻ em, tạm khóa ngay, trẻ vị thành niên theo năm sinh giờ Việt Nam, hạn giữ bản ghi, giờ mở phòng, lọc tin nhắn | đúng theo quy tắc | Đạt; `apps/api/src/market/market-safety-rules.test.ts`; 1110 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1408 | P02-136 | CT-27i-2: gia sư mở luồng, phụ huynh nhắn, gia sư gửi số điện thoại và Zalo, phụ huynh khác xem, lần thứ 3, nhân viên xem chi tiết | 403; 201; che và cảnh báo; 404; gắn cờ và báo cáo né hoa hồng; thấy chữ gốc | Đạt; `apps/api/src/market/market-safety.test.ts`; 1106 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1409 | P02-136 | CT-27i-3: báo cáo nghiêm trọng về an toàn trẻ em; xem trang gia sư, đặt lại, thư cho phụ huynh khác, chạy giải ngân | tạm khóa; hoàn 150 000; 404; 404; có 111; buổi đã dạy chưa giải ngân | Đạt; `apps/api/src/market/market-safety.test.ts`; 1107 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1410 | P02-136 | CT-27i-4: gia sư báo phụ huynh lạ, báo cáo mức thấp về an toàn trẻ em, quyết định thiếu lý do, bác, gia sư kháng nghị, người báo kháng nghị, cùng nhân viên xét, nhân viên khác tạm khóa, xuất thiếu số văn bản, xuất đủ | 404; mức cao; 400; đã quyết định; 409; đã kháng nghị; 403; chốt, tạm khóa; 400; có nhật ký | Đạt; `apps/api/src/market/market-safety.test.ts`; 1108 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1411 | P02-136 | CT-27i-5: mở phòng trước giờ, phụ huynh vào trước, gia sư mở, phụ huynh vào, kết thúc, xem bởi phụ huynh, gia sư, phụ huynh khác, nhân viên; hết hạn giữ khi đang tranh chấp và sau đó | 409; 409; đang ghi; mã vào phòng; sẵn sàng, giữ 30 ngày; 200 inline no-store, 200, 404, 200, 3 lượt xem; giữ; xóa | Đạt; `apps/api/src/market/market-safety.test.ts`; 1109 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1412 | P02-136 | CT-27i-6 (e2e 198, nhiều trường): phụ huynh nhắn tin có số điện thoại, đặt buổi có đồng ý ghi hình, báo cáo nghiêm trọng; gia sư thấy tạm khóa; nhân viên thấy chỉ số, chữ gốc, quyết định | che và cảnh báo; buổi hoàn đủ; gia sư thấy đang tạm khóa; quyết định ghi nhật ký | `tests/e2e/198-market-safety.spec.ts`; 1106, 1107, 1108 | Cao |
