---
yctd: YCTD-258
tieu_de: DT-27 phần 27h: đặt buổi, thanh toán giữ tiền giả lập, giải ngân, hoàn tiền, tranh chấp, hoa hồng ở chợ gia sư
ngay: 2026-10-28
phien_ban_de_xuat: 0.181.0
---

## 02 Nhật ký

### 2026-10-28 — DT-27 phần 27h: đặt buổi, thanh toán, tranh chấp

#### Công việc đã thực hiện

- Đọc mục 19.3 (tiền đi theo mô hình), 19.5 (27h), GD-133, GD-134 của `32_KE_HOACH_THEO_HE_THONG_SO.md`. Quyết định của Eric ngày 2026-10-28: làm mã, tiền giả lập; không bật tiền thật trước khi xong E-01 đến E-07. Giao diện phụ huynh ở `apps/market`, gia sư ở `apps/tutor`.
- Marketplace `0020`: `market_bookings`, `market_payments`, `market_payment_events`, `market_disputes`, `market_dispute_statements`, `market_commission_rules`; kiểu bảng ở `database/marketplace/schema-parts/dt-27h-dat-buoi-thanh-toan.ts`.
- Máy chủ API (đăng ký ở `src/dang-ky/dt-27h-dat-buoi-thanh-toan.ts`):
  - `market-payment-provider.ts`: lớp `MarketplacePaymentProvider` (tạo lệnh thu có giữ, giải ngân chia hoa hồng, hoàn, giữ khi tranh chấp, kiểm sự kiện có chữ ký) và bộ giả lập `MockMarketplacePaymentProvider`;
  - `market-booking-rules.ts`: hàm thuần (chọn quy tắc hoa hồng, tính hoa hồng, hoàn khi hủy theo GD-134, chia tiền, giờ Việt Nam, giờ trống, trùng giờ, điều kiện nội dung theo Thông tư 29/2024);
  - `market-bookings.ts`: đặt buổi, thanh toán giả lập, nhận sự kiện của nhà cung cấp, hủy, gia sư đánh dấu đã dạy, tranh chấp, trình bày, khiếu nại lại, việc định kỳ (nhả chỗ, giải ngân, chốt quyết định);
  - `market-payments-admin.ts`: thanh toán, tranh chấp, quy tắc hoa hồng, chạy ngay việc định kỳ ở cổng nền tảng.
- `market-tutor-rules.ts` (27g): hồ sơ gia sư không có môn `curriculum` cho cấp Tiểu học; trang công khai trả mã môn để đặt buổi.
- Giao diện: Chợ gia sư (Đặt buổi ở trang gia sư, Buổi học của con: thanh toán giả lập, hủy, tranh chấp, trình bày, khiếu nại lại); ứng dụng Gia sư (Buổi dạy và thu nhập); cổng nền tảng (Buổi học và thanh toán: tranh chấp, quyết định, chốt, quy tắc hoa hồng, chạy giải ngân).
- Kiểm thử: CT-27h-1 (`market-booking-rules.test.ts`), CT-27h-2 đến CT-27h-6 (`market-bookings.test.ts`), CT-27h-7 (e2e `197-tutor-booking.spec.ts`).

#### Quyết định

- Tiền nằm ở nhà cung cấp thanh toán, nền tảng chỉ ra lệnh (19.3); bản này chỉ có bộ giả lập `mock`, ghi sổ trong bộ nhớ, ký sự kiện HMAC-SHA256. Nhà cung cấp chuyển tiền thật bị từ chối khi cấu hình chợ chưa bật thu tiền thật (luôn tắt), kiểm ở mỗi lần đặt buổi.
- Đặt buổi lẻ trước ít nhất 2 giờ, trong 60 ngày, nằm trọn trong giờ trống của gia sư theo giờ Việt Nam, không trùng buổi khác của gia sư hoặc của con (khóa theo gia sư khi ghi); giữ chỗ 30 phút chờ trả tiền; tiền về sau khi chỗ đã nhả thì hoàn ngay.
- Hồ sơ con phải còn đồng ý của cha mẹ; cấp, lớp của con thuộc môn đã chọn; không dạy thêm môn `curriculum` cho học sinh Tiểu học (Thông tư 29/2024 khoản 1 Điều 4); gia sư đang dạy ở trường dạy môn `curriculum` thì phụ huynh cam kết con không do gia sư dạy ở trường (khoản 2 Điều 4) vì chợ chưa có phân công của trường để so khớp.
- Giá, môn, hoa hồng chụp lại lúc đặt. Quy tắc hoa hồng cụ thể nhất (theo gia sư, theo loại nội dung, chung), ngày hiệu lực gần nhất không sau ngày đặt; không có quy tắc thì theo tỷ lệ mặc định của cấu hình chợ (để trống là 0). Làm tròn đến đồng, tối thiểu, không vượt giá.
- Hủy (GD-134): phụ huynh hủy trước 24 giờ hoàn đủ, trong 24 giờ hoàn 50% (phần còn lại chia hoa hồng và gia sư), gia sư hủy hoàn đủ; từ giờ bắt đầu không hủy, chỉ mở tranh chấp.
- Gia sư đánh dấu đã dạy sau giờ kết thúc; hạn khiếu nại tính từ giờ kết thúc (GD-133); hết hạn mà không có tranh chấp thì giải ngân (trừ hoa hồng). Điểm danh bằng phòng video của 27a ở ngữ cảnh chợ chưa làm, nên giải ngân dựa vào đánh dấu của gia sư và quyền khiếu nại của phụ huynh.
- Tranh chấp: phụ huynh mở từ giờ bắt đầu đến hết hạn khiếu nại, tiền bị giữ; hai bên trình bày; nhân viên quyết định hoàn đủ, hoàn một phần hoặc giải ngân, có lý do; quyết định lần đầu chưa chuyển tiền, một bên được khiếu nại lại trong 7 ngày, do nhân viên khác xét; hết 7 ngày (hoặc nhân viên chốt) thì chuyển tiền theo quyết định.
- Việc định kỳ chạy trong máy chủ API (`MARKET_JOB_INTERVAL_SECONDS`, mặc định 300 giây); nhân viên cũng chạy ngay được ở cổng nền tảng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-258, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-440 đến BR-443, PQ-190, P02-135, AC-1100 đến AC-1105, MH-540 đến MH-542, CT-1400 đến CT-1406, QĐ-48.

#### Vấn đề tồn đọng

- Chưa làm: gói nhiều buổi; phòng video của 27a ở ngữ cảnh chợ và điểm danh tự động (có bản ghi cho tranh chấp); so khớp phân công qua liên kết tài khoản trường; khấu trừ thuế (công tắc tắt, GD-138, chờ E-03) và hóa đơn hoa hồng (chờ E-09); phương án B "trả thẳng gia sư"; đánh giá sau buổi và sắp xếp theo đánh giá; báo cáo doanh thu theo gia sư.
- Nhà cung cấp thanh toán thật chờ E-02 và chỉ dùng khi xong E-01 đến E-07.

## 24 Yêu cầu thay đổi

### YCTD-258: DT-27 phần 27h: đặt buổi, thanh toán giữ tiền giả lập, giải ngân, hoàn tiền, tranh chấp, hoa hồng – 2026-10-28

- Lý do: phần 27h của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 19.4, 19.5; phiên điều phối giao ngày 2026-10-28 sau 27g (PR 227).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Đặt buổi lẻ** ở Chợ gia sư: giữ chỗ có hạn, giờ Việt Nam, giờ trống, không trùng; điều kiện theo Thông tư 29/2024.
  - **Thanh toán giữ tiền** qua `MarketplacePaymentProvider`, bộ giả lập `mock`; sự kiện có chữ ký nhận một lần; thu tiền thật không bật được.
  - **Hoa hồng** là quy tắc cấu hình có ngày hiệu lực; hàm tính thuần, số nguyên đồng.
  - **Hủy, hoàn** theo GD-134; **giải ngân** sau hạn khiếu nại (GD-133).
  - **Tranh chấp** giữ tiền, trình bày hai bên, quyết định có lý do, khiếu nại lại do nhân viên khác xét.
  - **Giao diện**: phụ huynh (đặt, trả giả lập, hủy, khiếu nại), gia sư (buổi dạy, thu nhập, trình bày), nền tảng (thanh toán, tranh chấp, hoa hồng).
- Thành phần bị ảnh hưởng: `database` (`marketplace/migrations/0020`, `marketplace/schema-parts/dt-27h-dat-buoi-thanh-toan.ts`), `apps/api` (`market/market-bookings.ts`, `market-booking-rules.ts`, `market-payment-provider.ts`, `market-payments-admin.ts`, `market-public.ts`, `market-tutor-rules.ts`, `common/configuration.ts`, `tenancy-route-policy.ts`, `dang-ky/dt-27h-dat-buoi-thanh-toan.ts`), `apps/market`, `apps/tutor`, `apps/platform`, `tests` (spec 197).
- Dữ liệu bị ảnh hưởng: marketplace `0020` (6 bảng).
- API bị ảnh hưởng: `POST`, `GET /api/v1/market/bookings`, `POST /api/v1/market/bookings/{id}/mock-pay`, `POST /api/v1/market/bookings/{id}/cancel`, `POST`, `GET /api/v1/market/bookings/{id}/dispute`, `POST /api/v1/market/disputes/{id}/statements`, `POST /api/v1/market/disputes/{id}/appeal`, `GET /api/v1/market/tutor/bookings`, `POST /api/v1/market/tutor/bookings/{id}/complete`, `POST /api/v1/market/tutor/bookings/{id}/cancel`, `GET /api/v1/market/tutor/bookings/{id}/dispute`, `POST /api/v1/market/payments/webhooks/{provider}`, `GET /api/v1/market/admin/payments`, `GET /api/v1/market/admin/payments/disputes/{id}`, `POST /api/v1/market/admin/payments/disputes/{id}/decide`, `POST /api/v1/market/admin/payments/disputes/{id}/finalize`, `POST /api/v1/market/admin/payments/commission-rules`, `POST /api/v1/market/admin/payments/run-due`; `GET /api/v1/market/public/tutors/{id}` trả thêm mã môn.
- Cấu hình: `MARKET_JOB_INTERVAL_SECONDS` (mặc định 300, 0 là tắt).
- Giao diện bị ảnh hưởng: MH-540, MH-541, MH-542; MH-532 (trang gia sư có Đặt buổi).
- Quyền bị ảnh hưởng: PQ-190 (không thêm mã quyền của trường).
- Ảnh hưởng chức năng cũ: hồ sơ gia sư không nhận môn `curriculum` cấp Tiểu học (trước đây nhận).
- Kiểm thử cần thực hiện: `apps/api` (`market-booking-rules`, `market-bookings`, `market-tutor-rules`, `market-verification`, `market`, `tenancy-matrix`), e2e nhiều trường 197, 196, 195, kiểm tĩnh.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-27 phần 27h, đặt buổi, thanh toán giữ tiền giả lập, giải ngân, hoàn tiền, tranh chấp, hoa hồng (YCTD-258).
- Chức năng mới: đặt buổi lẻ, thanh toán giả lập, hủy và hoàn theo chính sách, giải ngân sau hạn khiếu nại, tranh chấp và khiếu nại lại, quy tắc hoa hồng, buổi dạy và thu nhập của gia sư (P02-135).
- Thay đổi dữ liệu: marketplace `0020`.
- Thay đổi API: nhóm `/api/v1/market/bookings*`, `/api/v1/market/tutor/bookings*`, `/api/v1/market/disputes/*`, `/api/v1/market/payments/webhooks/*`, `/api/v1/market/admin/payments*`.
- Kiểm thử: CT-1400 đến CT-1406 (CT-27h-1 đến CT-27h-7).
- Rủi ro: thấp; chỉ thanh toán giả lập, thu tiền thật không bật được.
- Khả năng tương thích: hồ sơ gia sư đã có môn `curriculum` cấp Tiểu học phải sửa khi lưu lại.
- Phương án quay lui: hoàn lại commit gộp; bảng marketplace `0020` không ảnh hưởng phần khác.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27h: đặt buổi lẻ ở Chợ gia sư, thanh toán giữ tiền giả lập, hủy và hoàn theo chính sách, giải ngân sau hạn khiếu nại, tranh chấp có khiếu nại lại, quy tắc hoa hồng; thu tiền thật không bật được | YCTD-258 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +4 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +6 |
| Màn hình dự kiến | Số lượng | +3 |
| Ca kiểm thử khởi đầu | Số lượng | +7 |
| Chức năng đã liệt kê | Số lượng | +1 |
| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +3 |
| 16 | bảng dự kiến | +6 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27 phần 27h (YCTD-258: đặt buổi, thanh toán giả lập, tranh chấp) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-440 | Đặt buổi ở chợ gia sư (YCTD-258): buổi lẻ, trước ít nhất 2 giờ, trong 60 ngày, nằm trọn trong giờ trống của gia sư theo giờ Việt Nam, không trùng buổi khác của gia sư hoặc của con; giữ chỗ 30 phút chờ trả tiền; hồ sơ con còn đồng ý của cha mẹ, cấp và lớp thuộc môn; không dạy thêm môn của chương trình phổ thông cho học sinh Tiểu học; gia sư đang dạy ở trường dạy môn của chương trình thì phụ huynh cam kết con không do gia sư dạy ở trường; giá, môn, hoa hồng chụp lúc đặt |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-441 | Tiền của buổi học ở chợ (YCTD-258): tiền nằm ở nhà cung cấp thanh toán, nền tảng chỉ ra lệnh; nhà cung cấp chuyển tiền thật chỉ dùng khi cấu hình chợ bật thu tiền thật (luôn tắt đến khi xong E-01 đến E-07); sự kiện của nhà cung cấp phải đúng chữ ký, xử lý một lần theo mã sự kiện; tiền về sau khi chỗ đã nhả thì hoàn ngay |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-442 | Hoa hồng, hủy, giải ngân (YCTD-258): quy tắc hoa hồng cụ thể nhất (theo gia sư, theo loại nội dung, chung) có ngày hiệu lực gần nhất, không có thì theo tỷ lệ mặc định; làm tròn đến đồng, có tối thiểu, không vượt giá; phụ huynh hủy trước 24 giờ hoàn đủ, trong 24 giờ hoàn 50% (GD-134), gia sư hủy hoàn đủ; gia sư đánh dấu đã dạy sau giờ kết thúc; hết hạn khiếu nại (GD-133) mà không có tranh chấp thì giải ngân phần gia sư sau khi trừ hoa hồng |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-443 | Tranh chấp buổi học ở chợ (YCTD-258): phụ huynh mở từ giờ bắt đầu đến hết hạn khiếu nại, tiền bị giữ; hai bên trình bày; nhân viên nền tảng quyết định hoàn đủ, hoàn một phần hoặc giải ngân, bắt buộc có lý do, ghi nhật ký; một bên khiếu nại lại một lần trong 7 ngày, do nhân viên khác người quyết định lần đầu xét; tiền chuyển khi quyết định chốt |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-115 | PQ-190 | Đặt buổi, thanh toán, tranh chấp ở chợ (YCTD-258, DT-27 phần 27h): không thêm mã quyền của trường; phụ huynh (tài khoản chợ) đặt, trả, hủy, khiếu nại buổi của con mình; gia sư (tài khoản chợ) xem, đánh dấu đã dạy, hủy buổi của mình, trình bày; nhân viên nền tảng (mã phiên vận hành) quyết định tranh chấp, đặt quy tắc hoa hồng; nhà cung cấp thanh toán gửi sự kiện bằng chữ ký |
| 10_YEU_CAU_CHUC_NANG.md | P02-102 | P02-135 | Đặt buổi, thanh toán giả lập, tranh chấp ở chợ gia sư (YCTD-258) | Phụ huynh; gia sư; nhân viên nền tảng | Gia sư, con, môn, giờ học; sự kiện thanh toán; quyết định tranh chấp | Giữ chỗ, thanh toán giữ tiền, hủy và hoàn, đánh dấu đã dạy, giải ngân, tranh chấp, khiếu nại lại, hoa hồng | Buổi học, khoản tiền đã chia | BR-440, BR-441, BR-442, BR-443, PQ-190 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1100 | Cho gia sư đã duyệt và phụ huynh có hồ sơ con / Khi đặt buổi trong giờ trống, trả tiền giả lập, gia sư đánh dấu đã dạy, hết hạn khiếu nại / Thì buổi giữ chỗ, đã trả tiền, đã dạy, rồi giải ngân phần gia sư sau khi trừ hoa hồng theo quy tắc (CT-1401; YCTD-258) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1101 | Cho phụ huynh đặt buổi / Khi đặt trước dưới 2 giờ, trùng giờ, con Tiểu học với môn của chương trình, gia sư đang dạy ở trường mà không cam kết, hồ sơ con đã rút đồng ý / Thì bị từ chối kèm lý do; giữ chỗ quá hạn thì nhả chỗ và hoàn tiền nếu tiền về muộn (CT-1402; YCTD-258) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1102 | Cho buổi đã trả tiền / Khi phụ huynh hủy trước 24 giờ, trong 24 giờ, gia sư hủy / Thì hoàn đủ, hoàn 50%, hoàn đủ (CT-1403; YCTD-258) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1103 | Cho buổi đã học / Khi phụ huynh mở tranh chấp, hai bên trình bày, nhân viên quyết định không lý do, có lý do, một bên khiếu nại lại, cùng nhân viên xét lại, nhân viên khác xét lại / Thì tiền bị giữ, thiếu lý do bị từ chối, quyết định ghi lại, cùng nhân viên bị từ chối, nhân viên khác chốt và tiền chuyển theo quyết định (CT-1404; YCTD-258) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1104 | Cho sự kiện của nhà cung cấp / Khi sai chữ ký, đúng chữ ký, gửi lại cùng sự kiện / Thì bị từ chối (401), buổi thành đã trả tiền, chỉ ghi một lần; bật thu tiền thật bị từ chối (CT-1405; YCTD-258) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1105 | Cho quy tắc hoa hồng và chính sách hủy / Khi tính hoa hồng, hoàn, chia tiền, giờ Việt Nam, nhà cung cấp tiền thật khi chưa bật / Thì đúng quy tắc cụ thể nhất có hiệu lực, làm tròn đến đồng, tối thiểu, tổng chia bằng số đã thu; nhà cung cấp tiền thật bị chặn (CT-1400; YCTD-258) |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-540 | Chợ gia sư: Đặt buổi ở trang gia sư và Buổi học của con (YCTD-258): chọn con, môn, giờ (giờ Việt Nam), cam kết khi cần; giữ chỗ, thanh toán giả lập, hủy, mở tranh chấp, trình bày, khiếu nại lại, trạng thái và số đã hoàn | Phụ huynh |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-541 | Ứng dụng Gia sư: Buổi dạy và thu nhập (YCTD-258): buổi đã trả tiền, đánh dấu đã dạy, hủy, tranh chấp và trình bày, khiếu nại lại; thu nhập đã giải ngân, đang chờ, hoa hồng nền tảng | Gia sư |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-542 | Cổng nền tảng: Buổi học và thanh toán trong trang Chợ gia sư (YCTD-258): chạy giải ngân đến hạn, quy tắc hoa hồng, tranh chấp (trình bày, quyết định có lý do, chốt), buổi học gần đây với số hoàn, gia sư nhận, hoa hồng | Người vận hành nền tảng |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_bookings, market_payments (marketplace, từ YCTD-258) | Buổi học đã đặt và khoản tiền giữ ở nhà cung cấp (BR-440, BR-441, BR-442; marketplace `0020`) | buổi: phụ huynh, con (tên chụp lại), gia sư, môn, cấp, lớp, loại nội dung, starts_at, minutes, price, commission, status (`held`, `paid`, `completed`, `disputed`, `disbursed`, `refunded`, `cancelled`, `expired`), hold_expires_at, complaint_deadline, hủy; tiền: booking_id (duy nhất), provider, provider_ref, amount, status, held_for_dispute, refunded_amount, released_amount, commission_taken |
| 16_CO_SO_DU_LIEU.md | scorm_attempts (năm học, từ YCTD-278) | market_payment_events, market_disputes, market_dispute_statements, market_commission_rules (marketplace, từ YCTD-258) | Sự kiện thanh toán, tranh chấp, quy tắc hoa hồng (BR-441, BR-442, BR-443; marketplace `0020`) | sự kiện: (provider, event_id) duy nhất, type, provider_ref, payload; tranh chấp: booking_id (duy nhất), reason, status (`open`, `decided`, `appealed`, `final`), quyết định lần đầu và cuối, lý do, người quyết định; trình bày: dispute_id, role, body; hoa hồng: content_kind, tutor_account_id, percent, minimum, effective_from |
| 12_KIEN_TRUC_HE_THONG.md | QĐ-43 | QĐ-48 | Thanh toán của chợ gia sư (DT-27 phần 27h, YCTD-258): lớp `MarketplacePaymentProvider` (lệnh thu có giữ, giải ngân chia hoa hồng, hoàn, giữ khi tranh chấp, sự kiện có chữ ký) với bộ giả lập `mock`; nhà cung cấp có cờ chuyển tiền thật, bị từ chối khi chợ chưa bật thu tiền thật; sự kiện ghi một lần theo mã; quy tắc nghiệp vụ là hàm thuần; việc định kỳ chạy trong máy chủ API (không thuộc trường nào nên không qua bộ lập lịch theo trường); phương án đã loại: nền tảng nhận tiền vào tài khoản của mình rồi chi lại (nguy cơ thu hộ chi hộ không phép, 19.3), dùng cổng thanh toán theo trường của S3 cho tiền chợ (tiền của trường và của chợ phải tách) | Đã chọn |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1400 | P02-135 | CT-27h-1: hàm thuần: chọn và tính hoa hồng, hoàn khi hủy, chia tiền, giờ Việt Nam, giờ trống, trùng giờ, điều kiện nội dung; nhà cung cấp tiền thật bị chặn; chữ ký sự kiện giả lập | đúng theo quy tắc | Đạt; `apps/api/src/market/market-booking-rules.test.ts`; 1105 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1401 | P02-135 | CT-27h-2: đặt, trùng giờ, trả giả lập, đánh dấu trước giờ kết thúc, đánh dấu, chạy giải ngân trước và sau hạn khiếu nại | giữ chỗ, hoa hồng 10%; 409; đã trả; 409; đã dạy; chưa giải ngân; giải ngân 135 000 và hoa hồng 15 000 | Đạt; `apps/api/src/market/market-bookings.test.ts`; 1100 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1402 | P02-135 | CT-27h-3: đặt trước dưới 2 giờ, thiếu cam kết, có cam kết, Tiểu học với môn của chương trình, rút đồng ý, giữ chỗ quá hạn rồi trả | 400; 400; 201; 400; 400; hết hạn và hoàn đủ | Đạt; `apps/api/src/market/market-bookings.test.ts`; 1101 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1403 | P02-135 | CT-27h-4: hủy trước 24 giờ, trong 24 giờ, gia sư hủy | hoàn đủ; hoàn 50%, hoa hồng theo phần còn lại; hoàn đủ | Đạt; `apps/api/src/market/market-bookings.test.ts`; 1102 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1404 | P02-135 | CT-27h-5: tranh chấp trước giờ học, mở, đánh dấu đã dạy khi đang tranh chấp, trình bày hai bên, quyết định thiếu lý do, hoàn một phần, khiếu nại lại, cùng nhân viên xét lại, nhân viên khác giải ngân | 409; giữ tiền; 409; 2 trình bày; 400; đã quyết định; khiếu nại lại; 403; chốt, giải ngân 180 000 | Đạt; `apps/api/src/market/market-bookings.test.ts`; 1103 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1405 | P02-135 | CT-27h-6: sự kiện sai chữ ký, đúng chữ ký, gửi lại; bật thu tiền thật | 401; đã trả; một lần; 400 | Đạt; `apps/api/src/market/market-bookings.test.ts`; 1104 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1406 | P02-135 | CT-27h-7 (e2e 197, nhiều trường): phụ huynh đăng ký, tạo hồ sơ con, tìm, đặt, trả giả lập; gia sư đánh dấu đã dạy; phụ huynh khiếu nại; nhân viên hoàn đủ, chốt | các bước đạt; phụ huynh thấy đã hoàn 150 000 đồng | `tests/e2e/197-tutor-booking.spec.ts`; 1100, 1103 | Cao |
