---
yctd: YCTD-383
tieu_de: Gia sư AI trả phí, lát L1b: nền tảng bán thẳng cho phụ huynh
ngay: 2026-10-30
phien_ban_de_xuat: 0.250.0
---

## 02 Nhật ký

### 2026-10-30 — Gia sư AI trả phí, lát L1b: nền tảng bán thẳng cho phụ huynh (YCTD-383)

#### Công việc đã thực hiện

- Cơ sở dữ liệu nền tảng (tệp `0251_create_ai_tutor_sales`): `platform_ai_tutor_orders` (giao dịch), `platform_ai_tutor_payments` (tiền vào của cổng, ghi một lần theo mã của cổng), `platform_ai_tutor_receipts` (biên lai), `platform_ai_tutor_refunds` (hoàn tiền, người thao tác). Tài liệu `16` mục 18R.
- Máy chủ API: `apps/api/src/ai-tutor/platform-sales-rules.ts` (hàm thuần), `platform-sales.ts` (dịch vụ, việc nền đóng giao dịch quá hạn), `platform-sales.controller.ts`; đăng ký ở `src/dang-ky/yctd-383-l1b-nen-tang-ban.ts`. Điểm nhận thông báo tiền vào của cổng nền tảng ở `billing.ts` hỏi bộ nhận của gia sư AI trước khi đối chiếu hóa đơn dịch vụ (`billing/platform-transfer-handler.ts`). Đường dẫn vận hành `/api/v1/platform-ai-tutor/*` không cần trường, khai ở `tenancy-route-policy.ts`. Việc mới `ai-tutor.sales` (quản trị, kế toán) và mục menu `ai-tutor` ở `packages/shared/src/operator-permissions.ts`. Tài liệu `17` mục 17.11.
- Cổng vận hành: trang "Gia sư AI" (`apps/platform/src/AiTutorSalesPage.tsx`, bản mẫu MH-600): tạo, sửa, ngừng bán, mở bán lại gói tháng và gói lượt theo cấp học; danh sách giao dịch có lọc; chi tiết giao dịch có biên lai, tiền vào của cổng; hủy giao dịch chờ, ghi hoàn tiền có lý do.
- Ứng dụng phụ huynh: `apps/parent/src/ai-tutor/AiTutorDirectPurchase.tsx` (tab "Mua trực tiếp" của MH-598, xuất mặc định thành phần nhận mã con): gói của nền tảng theo cấp học, chọn tháng này hoặc tháng sau, mã QR hoặc liên kết thanh toán, giữ chỗ 15 phút, nút giả lập khi cổng là bộ giả lập, lượt còn, nâng gói tháng này, giao dịch, biên lai. Lát L1a gắn thành phần vào khung trang và tab chọn nơi mua.
- Nâng gói giữa tháng (Eric chọn ngày 2026-10-30) dùng hàm chung của YCTD-386 (`upgradeQuote`, `createAiTutorUpgrade`, `applyAiTutorUpgrade`, `cancelAiTutorUpgrade`): phụ huynh chỉ trả phần chênh lệch theo số ngày còn lại của tháng, trả ngay qua cổng của nền tảng; tiền vào thì áp lần nâng, lượt cộng thêm cùng tỉ lệ; hoàn tiền lần nâng đưa gói về gói cũ.
- Kiểm thử tự động: `apps/api/src/ai-tutor/platform-sales-rules.test.ts` (8 ca), `apps/api/src/ai-tutor/platform-sales.test.ts` (CT-383-L1b-1 đến 7 và 9 trên máy chủ API nhiều trường thật: tạo, sửa, ngừng bán gói, vai trò hỗ trợ 403, tên miền trường 404; mua và kích hoạt qua cổng giả lập, biên lai, thông báo; mua trùng gói tháng với nguồn trường; hết hạn giữ chỗ và tiền đến muộn; hoàn tiền một phần, hoàn hai lần 409; hủy; cổng SePay của nền tảng với khóa sai 401, khóa đúng, gửi lặp, sai số tiền; nâng gói giữa tháng và hoàn tiền lần nâng), e2e `tests/e2e/142-ai-tutor-direct-purchase.spec.ts` (CT-383-L1b-8, dự án nhiều trường).
- `scripts/gom-thay-doi.mjs`: phiếu làm theo nhiều lát được thêm một tệp mảnh cho mỗi lát (`YCTD-<số>-l<lát>-<tên>.md`, cùng mã YCTD); trước đây bộ kiểm báo trùng mã với tệp của lát L0 còn chờ gom. Kiểm thử `tests/tai-lieu/gom-thay-doi.test.mjs` thêm một ca; `thay_doi_cho_gom/README.md` quy tắc 1.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - giữ chỗ chờ thanh toán 15 phút; nội dung chuyển khoản `GSAI` + ngày + số để không lẫn với hóa đơn dịch vụ (`HD...`); dùng chung điểm nhận thông báo tiền vào và cổng mặc định của nền tảng với thu phí dịch vụ (S5b), không bao giờ dùng cổng của trường;
  - tiền đến sau hạn giữ chỗ hoặc vào giao dịch đã đóng thì không kích hoạt, giao dịch chuyển "Chờ hoàn tiền"; sai số tiền thì giữ "Chờ thanh toán" để kế toán đối soát;
  - hoàn tiền do nhân viên vận hành ghi sau khi đã chuyển trả ngoài hệ thống, được hoàn một phần, mỗi giao dịch một lần; gói của con thôi dùng ngay (`refunded`);
  - giá gói nền tảng từ 1.000 đến 10.000.000 đồng (không bán gói 0 đồng qua cổng);
  - quyền: vai trò quản trị và kế toán (giống thanh toán ở chợ gia sư);
  - cơ sở dữ liệu nền tảng không lưu họ tên học sinh; biên lai ghi họ tên người mua (phụ huynh) và tên trường;
  - cổng vận hành dùng thành phần riêng của cổng (`platform-ui.tsx`) như các trang khác của cổng; ứng dụng phụ huynh dùng `packages/ui`.

#### Việc pháp lý và vận hành chờ Eric quyết khi triển khai

Khi nền tảng là bên bán cho phụ huynh, mã hiện có chưa làm các việc sau:

1. Hóa đơn điện tử cho từng giao dịch (Nghị định 123/2020/NĐ-CP, Thông tư 78/2021/TT-BTC): biên lai trong ứng dụng chỉ là chứng từ nội bộ. Cần chọn nhà cung cấp hóa đơn điện tử, thông tin người mua (họ tên, có thể kèm mã số thuế), thời điểm xuất (khi thu tiền), cách xử lý hóa đơn khi hoàn tiền (hóa đơn điều chỉnh hoặc thay thế). Cấu hình `einvoiceProvider` của thu phí dịch vụ hiện là `none`.
2. Thuế suất giá trị gia tăng áp cho gói gia sư AI và giá hiển thị đã gồm thuế hay chưa.
3. Điều khoản sử dụng và chính sách bảo vệ dữ liệu cá nhân của nền tảng cho phụ huynh và học sinh (Nghị định 13/2023/NĐ-CP, dữ liệu trẻ em): hiện chỉ có câu "Đăng ký là đồng ý cho con dùng gia sư AI".
4. Chính sách hoàn tiền công bố cho phụ huynh: trường hợp được hoàn (mua nhầm, lỗi dịch vụ, tiền đến muộn), cách tính khi đã dùng một phần lượt, thời hạn xử lý, kênh yêu cầu. Mã cho phép kế toán ghi số hoàn bất kỳ không quá số đã thu.
5. Cách chuyển tiền hoàn thật: qua ngân hàng hay qua cổng thanh toán (cổng thật có điểm cuối hoàn tiền); mã chỉ ghi sổ.
6. Hồ sơ thương mại điện tử: thông báo hoặc đăng ký website, ứng dụng bán hàng với Bộ Công Thương; thông tin bên bán trên biên lai (tên pháp nhân, mã số thuế, địa chỉ) đang để chữ chung "Nền tảng quản lý trường học".
7. Hợp đồng và khóa của cổng thanh toán thật cho nền tảng (PayOS, SePay, Casso hoặc VNPay), tài khoản nhận tiền của nền tảng; bật ở trang Thu phí, mục bộ nối thanh toán. Trên máy chỉ dùng cổng giả lập.
8. Đối soát hằng ngày giữa tiền vào của cổng và giao dịch (giao dịch "Chờ hoàn tiền", "Sai số tiền"); người chịu trách nhiệm và kênh hỗ trợ phụ huynh.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-383, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md` mục 18R, `17_DAC_TA_API.md` mục 17.11, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Hoàn tiền giao dịch mua gói tháng không tự hoàn các lần nâng đã trả của cùng gói; kế toán hoàn từng giao dịch nâng (lần nâng gần nhất trước).
- Thành phần mua trực tiếp chưa hiện ở ứng dụng phụ huynh cho tới khi lát L1a gắn vào khung trang; e2e phần phụ huynh gọi thẳng máy chủ API.
- Các việc pháp lý và vận hành ở trên.

## 24 Yêu cầu thay đổi

### YCTD-383: Gia sư AI trả phí, lát L1b: nền tảng bán thẳng cho phụ huynh – 2026-10-30

- Lý do: Eric chọn cả hai cách bán (Q1, ngày 2026-10-30); lát L1b là phần nền tảng bán thẳng cho phụ huynh qua cổng thanh toán của nền tảng.
- Nội dung thay đổi: cổng vận hành tạo, sửa, ngừng bán gói nền tảng; phụ huynh mua cho từng con, trả bằng mã QR hoặc liên kết qua cổng của nền tảng (giả lập trên máy), tiền vào hợp lệ thì kích hoạt, có biên lai trong ứng dụng; nâng gói tháng giữa tháng chỉ trả phần chênh lệch theo số ngày còn lại; hủy, hoàn tiền có ghi người thao tác.
- Thành phần bị ảnh hưởng: `database/platform/migrations/0251_create_ai_tutor_sales.ts`, `apps/api/src/ai-tutor/platform-sales*.ts`, `apps/api/src/billing/billing.ts`, `apps/api/src/create-application.ts`, `apps/api/src/tenancy-route-policy.ts`, `packages/shared/src/operator-permissions.ts`, `apps/platform` (trang, menu, proxy), `apps/parent/src/ai-tutor/AiTutorDirectPurchase.tsx`, tài liệu 16, 17.
- Dữ liệu, API, quyền bị ảnh hưởng: bốn bảng mới, hai dãy số ở cơ sở dữ liệu nền tảng; 14 điểm cuối mới; việc vận hành mới `ai-tutor.sales` cho quản trị, kế toán; điểm nhận tiền vào của cổng nền tảng thêm nhánh cho nội dung `GSAI...`.
- Ảnh hưởng chức năng cũ: thu phí dịch vụ không đổi (nội dung `HD...` vẫn đối chiếu như cũ, kiểm thử `billing.test.ts` đạt).
- Kiểm thử cần thực hiện: `apps/api/src/ai-tutor/*.test.ts`, `billing.test.ts`, `tenancy-matrix.test.ts`, `tenancy.test.ts`, e2e 142 (dự án nhiều trường).
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-30 (phương án, bản mẫu MH-598, MH-600, danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gia sư AI trả phí, lát L1b: nền tảng bán thẳng gói cho phụ huynh, giao dịch, biên lai, hủy, hoàn tiền (YCTD-383).
- Database migration: nền tảng `0251_create_ai_tutor_sales`. Quay lui: chạy `down` (xóa bốn bảng, hai dãy số); chưa có tiền thật vì chỉ bật cổng giả lập.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gia sư AI trả phí, lát L1b: nền tảng bán thẳng cho phụ huynh | YCTD-383 |

## Thêm dòng

| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-383 lát L1b | Gia sư AI trả phí, lát L1b: nền tảng bán thẳng cho phụ huynh | {PHIEN_BAN} | chưa cấp | MH-598 (tab Mua trực tiếp), MH-600 | CT-383-L1b-1 đến 7 và 9 ở `apps/api/src/ai-tutor/platform-sales.test.ts`, CT-383-L1b-8 ở `tests/e2e/142-ai-tutor-direct-purchase.spec.ts`, `apps/api/src/ai-tutor/platform-sales-rules.test.ts` | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/ai-tutor/platform-sales.ts` và 15 tệp khác | Kiểm thử tự động và e2e 142 đạt trên máy ngày 30/10/2026; CI của PR |
