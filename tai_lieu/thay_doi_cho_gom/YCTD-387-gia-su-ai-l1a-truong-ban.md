---
yctd: YCTD-387
tieu_de: Gia sư AI trả phí, lát L1a: trường bán gói qua hóa đơn học phí
ngay: 2026-10-30
phien_ban_de_xuat: 0.251.0
---

## 02 Nhật ký

### 2026-10-30 — Gia sư AI trả phí, lát L1a: trường bán gói qua hóa đơn học phí (YCTD-387, thuộc YCTD-383)

#### Công việc đã thực hiện

- Cổng quản trị trường, trang "Gia sư AI" (menu Quản trị hệ thống, mục 3.9, đường dẫn `/ai-tutor`, MH-599): bật theo cấp học, khung giờ khóa (mặc định 22:00 đến 6:00), tạo, sửa, ngừng bán, bán lại gói tháng và gói lượt, xem các lần mua và lần nâng gói theo tháng.
- Ứng dụng phụ huynh, nút "Gia sư AI" ở thẻ của con cấp Tiểu học, Trung học cơ sở, Trung học phổ thông (MH-598): tab "Mua qua trường" và "Mua trực tiếp"; mua gói tháng (tháng này hoặc tháng sau) và gói lượt, mua là đồng ý cho con dùng; hủy khi chưa lên hóa đơn học phí và con chưa dùng lượt; nâng gói tháng giữa tháng; xem số lượt đã dùng và lượt mua thêm còn lại. Tab "Mua trực tiếp" dùng bản giữ chỗ `apps/parent/src/ai-tutor/AiTutorDirectPurchase.tsx`, lát L1b thay.
- Máy chủ API: `apps/api/src/ai-tutor/school-sales.ts`, `school-sales.controller.ts`, `school-sales-rules.ts`, `school-sales-fees.ts`; đăng ký ở `apps/api/src/dang-ky/yctd-383-l1a-truong-ban.ts`.
- Dòng thu Gia sư AI (`item_type` `ai_tutor`) trên hóa đơn học phí của kỳ: lần tính học phí lập một dòng cho mỗi lần mua và mỗi lần nâng gói chưa thu; ghi ở `ai_tutor_invoice_charges` để không thu trùng. Sửa `apps/api/src/fees/fee-calculation.service.ts` để gọi phần này.
- Database migration: hệ thống `0132_create_ai_tutor_school_settings`; năm học `0231_add_ai_tutor_invoice_charges`.
- Kiểm thử: `apps/api/src/ai-tutor/school-sales.test.ts` (CT-1757 đến CT-1764), e2e `tests/e2e/241-gia-su-ai-truong-ban.spec.ts` (CT-1765, CT-1766).
- e2e `190-video-room`, `191-tutoring`, `192-tutoring-finance` tìm nút "Gia sư" theo đúng tên (`exact: true`) vì thẻ của con có thêm nút "Gia sư AI"; không đổi điều kiện kiểm.

#### Quyết định

- Eric duyệt phương án, bản mẫu MH-598, MH-599 và danh sách lát ngày 2026-10-30.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - lần mua của trường kích hoạt ngay khi phụ huynh mua; phí vào hóa đơn học phí kỳ tới; gói tháng mua cho tháng sau dùng từ ngày đầu tháng sau;
  - "hủy trước ngày lập hóa đơn" hiểu là: lần mua chưa lên hóa đơn học phí nào, kể cả hóa đơn nháp; thêm điều kiện con chưa dùng lượt nào để tránh dùng miễn phí rồi hủy;
  - dòng thu lập ở lần tính học phí đầu tiên của kỳ kết thúc sau ngày mua; hóa đơn nháp tính lại thì lập lại; hóa đơn đã phát hành không bị ghi đè; lần mua giá 0 đồng không lập dòng; lần mua trước ngày bắt đầu năm học đang dùng không thu ở năm này;
  - quản trị Gia sư AI dùng quyền quản lý kết nối ngoài (`P01.integration.manage`) như trang Trợ lý AI, không thêm quyền mới;
  - chưa có cấp nào được bật thì phụ huynh không mua được gói của trường; khung giờ khóa chỉ lưu, lát L3 dùng để khóa.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-387, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md` mục 18Q, `17_DAC_TA_API.md`, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Lát L1b thay tệp `AiTutorDirectPurchase.tsx`.
- Phiên gỡ module gia sư trong trường đang sửa ràng buộc `invoice_items_type_check`: database migration của phiên đó phải giữ giá trị `ai_tutor`.
- Eric xác nhận hai điều kiện hủy (chưa lên hóa đơn, chưa dùng lượt) và cách tính lần mua gần cuối năm học.

## 24 Yêu cầu thay đổi

### YCTD-387: Gia sư AI trả phí (YCTD-383), lát L1a: trường bán gói – 2026-10-30

- Lý do: lát L1a của YCTD-383 theo danh sách lát Eric duyệt ngày 2026-10-30.
- Nội dung thay đổi: cài đặt và gói của trường; phụ huynh mua, hủy, nâng gói cho từng con; dòng thu Gia sư AI trên hóa đơn học phí của kỳ.
- Thành phần bị ảnh hưởng: `apps/api/src/ai-tutor/school-sales*.ts`, `apps/api/src/fees/fee-calculation.service.ts`, `apps/portal/src/ai-tutor/`, `apps/parent/src/ai-tutor/`, `apps/parent/src/screens/HomeScreen.tsx`, `packages/shared` (menu, quyền của mục, đường dẫn truy cập nhanh), database migration hệ thống `0132`, năm học `0231`, tài liệu 07, 10, 11, 14, 16, 17, 21, 27.
- Dữ liệu, API, quyền bị ảnh hưởng: bảng `ai_tutor_school_settings` (hệ thống), `ai_tutor_invoice_charges` (năm học), giá trị `ai_tutor` của `invoice_items.item_type`; điểm cuối mới `/ai-tutor/school/*` (quyền `P01.integration.manage`) và `/children/{id}/ai-tutor/*` (người giám hộ của con); không đổi quyền có sẵn.
- Ảnh hưởng chức năng cũ: lần tính học phí có thêm dòng Gia sư AI khi có lần mua của trường; hóa đơn không có lần mua thì không đổi.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/ai-tutor/*.test.ts`, `apps/api/src/fees/*.test.ts`, `apps/api/src/quick-links/menu-permissions.test.ts`; e2e `241-gia-su-ai-truong-ban.spec.ts`.
- Mức: Lớn (thuộc YCTD-383). Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: gia sư AI trả phí, lát L1a: trường bán gói tháng và gói lượt cho phụ huynh, nâng gói giữa tháng, dòng thu trên hóa đơn học phí (YCTD-387, thuộc YCTD-383).
- Database migration: hệ thống `0132_create_ai_tutor_school_settings`, năm học `0231_add_ai_tutor_invoice_charges`. Quay lui: chạy `down` của hai tệp (xóa bảng mới, xóa dòng `ai_tutor` của hóa đơn rồi trả ràng buộc loại dòng về như cũ); hóa đơn đã phát hành có dòng Gia sư AI phải điều chỉnh bằng phiếu điều chỉnh trước khi quay lui.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Gia sư AI trả phí, lát L1a: trường bán gói | YCTD-387 |

## index Số đếm

| 14 | màn hình | +2 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-461 | Gia sư AI trường bán, bật theo cấp (YCTD-387): quản trị trường bật Gia sư AI cho từng cấp Tiểu học, Trung học cơ sở, Trung học phổ thông; phụ huynh chỉ mua được gói của trường khi cấp của lớp con đang học đã bật và gói có cấp đó; chưa bật cấp nào là tắt; khung giờ khóa mặc định 22:00 đến 6:00 giờ Việt Nam, giờ mở lại khác giờ bắt đầu |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-462 | Gia sư AI trường bán, mua (YCTD-387): phụ huynh mua cho từng con; mua là đồng ý cho con dùng (bắt buộc xác nhận); lần mua kích hoạt ngay, phí vào hóa đơn học phí kỳ tới; mỗi con một gói tháng trong một tháng bất kể trường bán hay nền tảng bán; không mua gói ngừng bán, tháng đã qua; gói lượt mua không giới hạn |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-463 | Gia sư AI trường bán, hủy (YCTD-387): phụ huynh hủy được lần mua của trường khi lần mua chưa lên hóa đơn học phí nào (kể cả nháp) và con chưa dùng lượt; lần mua của nền tảng hủy ở mục Mua trực tiếp |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-464 | Gia sư AI, nâng gói giữa tháng (YCTD-386, YCTD-387): chỉ nâng gói tháng đang dùng lên gói tháng cùng nguồn, giá cao hơn, số lượt không ít hơn; trả (giá mới − giá đang dùng) × ngày còn lại ÷ số ngày của tháng, làm tròn tới đồng; lượt cộng thêm cùng tỉ lệ; ngày còn lại tính cả hôm nay theo lịch Việt Nam; trường bán: phần chênh lệch vào hóa đơn học phí kỳ tới |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-465 | Gia sư AI trường bán, dòng thu (YCTD-387): lần tính học phí của kỳ lập dòng "Gia sư AI" cho mỗi lần mua còn hiệu lực và mỗi lần nâng gói ghi trước khi hết kỳ mà chưa thu; mỗi lần mua, lần nâng chỉ thu một lần; tính lại hóa đơn nháp thì lập lại; hóa đơn đã phát hành không bị ghi đè; giá 0 đồng không lập dòng; lần mua trước ngày bắt đầu năm học đang dùng không thu ở năm này |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-15 | Gia sư AI trường bán: cài đặt và gói (YCTD-387) | Quản trị trường (`P01.integration.manage`) | Cấp học bật, khung giờ khóa; tên, loại, giá, số lượt, cho gửi ảnh, cấp học, trạng thái của gói | Lưu cài đặt; tạo, sửa, ngừng bán, bán lại gói; liệt kê lần mua, lần nâng theo tháng | Trang Gia sư AI (MH-599) | BR-461 |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-16 | Gia sư AI trường bán: phụ huynh mua, hủy, nâng gói (YCTD-387) | VT-14 (người giám hộ của con) | Con, gói, tháng dùng, xác nhận đồng ý | Mua gói tháng, gói lượt; hủy; báo giá và nâng gói tháng; xem số lượt | Tab Mua qua trường (MH-598) | BR-462, BR-463, BR-464 |
| 10_YEU_CAU_CHUC_NANG.md | P05-14 | P05-17 | Dòng thu Gia sư AI trên hóa đơn học phí (YCTD-387) | VT-04 (qua lần tính học phí) | Lần mua, lần nâng gói của trường chưa thu | Lập dòng `ai_tutor` trong lần tính học phí của kỳ, ghi đã thu ở dòng nào | Dòng "Gia sư AI" trên hóa đơn | BR-465 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1179 | Cho quản trị trường có quyền quản lý kết nối ngoài / Khi bật Gia sư AI cho THCS, đặt khung giờ, tạo gói tháng và gói lượt / Thì lưu đúng, khung giờ mặc định 22:00 đến 6:00, gói lượt không cho gửi ảnh, dữ liệu sai bị từ chối; kế toán, phụ huynh không vào được (CT-1757, CT-1758, CT-1765; YCTD-387) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1180 | Cho phụ huynh của con lớp THCS khi trường đã bật THCS / Khi mở Gia sư AI, tab Mua qua trường / Thì thấy gói đang bán cho cấp của con; con ở cấp chưa bật không mua được; phụ huynh khác bị từ chối (CT-1759, CT-1765; YCTD-387) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1181 | Cho phụ huynh xác nhận đồng ý / Khi mua gói tháng / Thì gói dùng được ngay, thấy số lượt đã dùng; mua gói tháng thứ hai cùng tháng bị chặn; thiếu xác nhận đồng ý bị từ chối (CT-1760, CT-1765; YCTD-387) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1182 | Cho lần mua chưa lên hóa đơn và con chưa dùng lượt / Khi phụ huynh hủy / Thì lần mua đã hủy, không lên hóa đơn; đã lên hóa đơn (kể cả nháp) hoặc đã dùng lượt thì không hủy được (CT-1762, CT-1763, CT-1765; YCTD-387) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1183 | Cho con đang dùng gói tháng Cơ bản của trường / Khi phụ huynh nâng lên Nâng cao giữa tháng / Thì trả phần chênh lệch theo số ngày còn lại (tính cả hôm nay), cộng lượt cùng tỉ lệ, đổi quyền gửi ảnh; hạ gói, cùng gói bị chặn (CT-1761, CT-1766; YCTD-387) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1184 | Cho các lần mua, lần nâng của trường chưa thu / Khi tính học phí của kỳ / Thì hóa đơn có một dòng "Gia sư AI" cho mỗi lần; tính lại nháp không trùng; hóa đơn đã phát hành không bị ghi đè, kỳ sau không thu lại (CT-1762; YCTD-387) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1185 | Cho quản trị trường / Khi xem các lần mua theo tháng / Thì thấy tên học sinh, gói, số tiền, lượt đã dùng, lần nâng và dấu đã lên hóa đơn (CT-1764, CT-1766; YCTD-387) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-599 | Cổng quản trị: Gia sư AI (YCTD-387, `/ai-tutor`): cài đặt cấp học được dùng và khung giờ khóa; bảng gói (giá, lượt, ảnh, đang dùng, trạng thái, Sửa, Ngừng bán hoặc Bán lại); biểu mẫu Tạo gói, Sửa gói; bảng Các lần mua lọc theo tháng mua | Quản trị trường (`P01.integration.manage`) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.3 Ứng dụng phụ huynh | MH-598 | Gia sư AI cho con (YCTD-387, nút "Gia sư AI" ở thẻ của con cấp TH, THCS, THPT): tab Mua qua trường, Mua trực tiếp (lát L1b); lượt đã dùng của tháng, lượt mua thêm còn; gói tháng chọn tháng này hoặc tháng sau, gói lượt; hộp xác nhận mua là đồng ý; Nâng lên gói này kèm báo giá theo ngày còn lại; các lần mua, Hủy lần mua | Phụ huynh |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1757 | P05-15 | Cài đặt mặc định; giờ 24:00, giờ trùng, cấp MN; kế toán, phụ huynh gọi điểm cuối quản trị | Mặc định tắt, 22:00 đến 06:00; dữ liệu sai 400; vai trò khác 403 | Kiểm thử tự động `apps/api/src/ai-tutor/school-sales.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1758 | P05-15 | Tạo gói tháng, gói lượt, gói 0 đồng; gói lượt cho gửi ảnh, giá âm, 0 lượt, không cấp, tên 81 ký tự; đổi loại gói; ngừng bán | Gói hợp lệ tạo được; dữ liệu sai 400; không đổi loại; ngừng bán được | Kiểm thử tự động `school-sales.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1759 | P05-16 | Phụ huynh xem gói của con THCS (cấp đã bật) và con Tiểu học (chưa bật); phụ huynh khác, kế toán xem con | Con THCS thấy gói đang bán; con Tiểu học không mua được (BR-461); vai trò khác 403 | Kiểm thử tự động `school-sales.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1760 | P05-16 | Mua không xác nhận đồng ý; mua gói tháng; mua gói tháng thứ hai cùng tháng; gói ngừng bán; tháng đã qua; tháng giữa tháng; gói lượt | Thiếu đồng ý 400; gói tháng kích hoạt ngay, 100 lượt; trùng tháng 422 BR-462; gói lượt cộng 50 lượt | Kiểm thử tự động `school-sales.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1761 | P05-16 | Báo giá và nâng Cơ bản lên Nâng cao trong tháng; nâng cùng gói, hạ gói, nâng gói lượt; phụ huynh khác nâng | Chênh lệch, lượt cộng thêm đúng theo ngày còn lại; giá mua ban đầu giữ nguyên; các trường hợp sai 422 BR-464; phụ huynh khác 403 | Kiểm thử tự động `school-sales.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1762 | P05-17 | Lần mua gói tháng, gói lượt, lần nâng; một gói lượt đã hủy; tính dòng thu của kỳ, ghi vào hóa đơn nháp, tính lại, sang kỳ sau, phát hành | Ba dòng `ai_tutor`; tính lại nháp vẫn đủ; kỳ sau và sau khi phát hành không thu lại; lần mua đã hủy không thu | Kiểm thử tự động `school-sales.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1763 | P05-16 | Hủy lần mua đã lên hóa đơn; hủy gói đã dùng một lượt; mã lần mua lạ; phụ huynh khác hủy | 422 BR-463; 422; 404; 403 | Kiểm thử tự động `school-sales.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1764 | P05-15 | Quản trị xem lần mua theo tháng; tháng sai mẫu; kế toán xem | Có tên học sinh, lần nâng, dấu đã lên hóa đơn, số đang dùng theo gói; tháng sai 400; kế toán 403 | Kiểm thử tự động `school-sales.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1765 | P05-15, P05-16 | Quản trị bật THCS, tạo ba gói trên trang Gia sư AI; phụ huynh mua gói tháng qua trường, mua thêm gói lượt rồi hủy | Khung giờ mặc định 22:00, 06:00; con dùng gói ngay, Đã dùng 0 / 100 lượt; gói lượt hủy được, còn 0 lượt mua thêm | e2e `tests/e2e/241-gia-su-ai-truong-ban.spec.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1766 | P05-16 | Phụ huynh nâng gói tháng Cơ bản lên Nâng cao giữa tháng; quản trị xem các lần mua | Hộp xác nhận ghi số tiền chênh lệch và số ngày còn lại; lượt tăng đúng; quản trị thấy lần nâng chờ lên hóa đơn | e2e `tests/e2e/241-gia-su-ai-truong-ban.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-387 | Gia sư AI trả phí, lát L1a: trường bán gói qua hóa đơn học phí (thuộc YCTD-383) | {PHIEN_BAN} | P05-15, P05-16, P05-17 | AC-1179 đến AC-1185 | CT-1757 đến CT-1766 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/ai-tutor/school-sales.ts`, `apps/portal/src/ai-tutor/AiTutorSchoolPage.tsx`, `apps/parent/src/ai-tutor/AiTutorPanel.tsx` và các tệp khác | Kiểm thử tự động và e2e trên máy ngày 30/10/2026; CI của PR |
| 16_CO_SO_DU_LIEU.md | ai_tutor_messages (hệ thống, từ YCTD-383) | ai_tutor_school_settings (hệ thống, từ YCTD-387) | Cài đặt Gia sư AI của trường, một dòng | id (luôn 1), enabled_levels (mảng con của `TH`, `THCS`, `THPT`; rỗng là tắt), quiet_start, quiet_end (giờ Việt Nam `HH:MM`, mặc định 22:00, 06:00), updated_by, updated_by_name, updated_at |
| 16_CO_SO_DU_LIEU.md | ai_tutor_messages (hệ thống, từ YCTD-383) | ai_tutor_invoice_charges (năm học, từ YCTD-387) | Lần mua, lần nâng gói Gia sư AI của trường đã thu ở dòng hóa đơn nào | id, invoice_item_id (xóa theo dòng khi tính lại hóa đơn nháp), child_id, subscription_id, upgrade_id (trống là dòng của lần mua), amount, created_at; chỉ mục duy nhất (subscription_id) với upgrade_id trống, (upgrade_id) với upgrade_id có giá trị; chỉ mục (invoice_item_id) |
