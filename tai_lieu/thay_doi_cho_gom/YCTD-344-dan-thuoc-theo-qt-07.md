---
yctd: YCTD-344
tieu_de: Dặn thuốc theo QT-07: trạng thái Đã nhận thuốc, báo phụ huynh khi cho uống, leo thang sự kiện y tế nặng
ngay: 2026-10-29
phien_ban_de_xuat: 0.224.0
---

## 02 Nhật ký

### 2026-10-29 — Dặn thuốc theo QT-07: trạng thái Đã nhận thuốc, báo phụ huynh khi cho uống, leo thang sự kiện y tế nặng

#### Công việc đã thực hiện

- Rà soát giao diện ngày 2026-10-28 (mục 3.1 C3, mức Cao) ghi `/medicines` lệch QT-07 và "chưa kiểm lại phía máy chủ". Kiểm lại máy chủ: nhận thuốc chuyển thẳng `pending` sang `administering`; cho uống không báo phụ huynh; từ chối, bỏ liều chỉ báo trong ứng dụng; gửi yêu cầu chỉ báo một bên (y tế hoặc giáo viên chủ nhiệm); không tự hoàn thành khi hết thời gian dùng; sự kiện y tế không báo quản lý đơn vị, sự kiện nặng không leo thang.
- Máy chủ (`apps/api/src/medicines/medication-requests.ts`): thêm trạng thái `received` (Đã nhận thuốc). Nhận thuốc chuyển `pending` → `received`; liều đầu tiên chuyển `received` → `administering`; ghi liều, lịch cho uống, kết thúc sớm nhận cả `received` và `administering`; từ chối chỉ từ `pending`. Hết thời gian dùng thì yêu cầu `received`, `administering` tự chuyển `completed`. Gửi yêu cầu báo cả y tế của đơn vị và giáo viên chủ nhiệm, ghi rõ người nhận thuốc. Mỗi liều cho uống báo phụ huynh trong ứng dụng (`medication_dose_given`); bỏ liều và từ chối báo thêm tin nhắn.
- Sự kiện y tế (`apps/api/src/health/health-care.ts`): mọi sự kiện báo quản lý đơn vị (VT-03) trong ứng dụng; sự kiện nặng leo thang VT-03, Hiệu trưởng (VT-02), Phó Hiệu trưởng phụ trách đơn vị (VT-15).
- Cơ sở dữ liệu năm học: migration `0224_add_medication_received_status` mở ràng buộc trạng thái, chuyển phiếu `administering` chưa có liều nào về `received`.
- Cổng quản trị `/medicines`: trạng thái Chờ nhận thuốc, Đã nhận thuốc; "Nhận thuốc" mở biểu mẫu dưới dòng (Số lượng thực nhận, Tình trạng thuốc, "Xác nhận đã nhận thuốc"); cột trạng thái hiện thuốc thực nhận; "Kết thúc" có ở phiếu đã nhận và đang cho uống. Ứng dụng phụ huynh (MP-07) hiện "Nhà trường đã nhận thuốc"; ứng dụng giáo viên (MG-09) hiện "Đã nhận thuốc" trong danh sách đang thực hiện.
- Kiểm thử: `apps/api/src/medicines/medicines.test.ts` (cập nhật CT-055, CT-171; thêm CT-1660 đến CT-1666), `apps/api/src/health/health.test.ts` (cập nhật CT-058; thêm CT-1667); e2e spec 31 thêm bước nhập thuốc thực nhận và phụ huynh thấy Nhà trường đã nhận thuốc.

#### Quyết định

Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ QT-07 không nói rõ:

- Hoàn thành khi hết thời gian dùng: hệ thống chuyển lúc đọc danh sách, chi tiết, lịch cho uống (mọi nơi trạng thái hiện ra), không thêm việc nền theo giờ. Phiếu Đã nhận thuốc chưa ghi liều nào mà hết thời gian dùng cũng chuyển Hoàn thành (QT-07 chỉ vẽ Đang cho uống → Hoàn thành; giữ Đã nhận thuốc mãi thì danh sách đọng). Phiếu chờ nhận hết hạn giữ nguyên để người nhận thuốc từ chối kèm lý do.
- Kết thúc sớm (phụ huynh dặn ngừng thuốc) được từ Đã nhận thuốc và Đang cho uống.
- Tin nhắn cho phụ huynh khi từ chối, bỏ liều theo QT-07 mục 9; người nhận theo quy tắc chọn phụ huynh nhận tin nhắn sẵn có (như sự kiện y tế nặng). Cho uống, nhận thuốc chỉ trong ứng dụng.
- Sự kiện y tế: QT-07 mục 9 ghi kênh "trong ứng dụng và tin nhắn" cho phụ huynh; giữ quy tắc sẵn có (tin nhắn chỉ khi sự kiện nặng, YCTD-74), chỉ thêm người nhận ở trường. Quản lý đơn vị nhận mọi sự kiện (QT-07 bước 8); sự kiện nặng báo thêm Ban Giám hiệu (VT-02, VT-15 theo đơn vị). Thông báo gửi theo vai trò nên chỉ trong ứng dụng (bộ gửi tin nhắn cần tài khoản cụ thể).
- E8 (sự kiện nặng chưa xử lý quá thời gian cấu hình): sự kiện y tế bắt buộc nhập cách xử lý ngay khi ghi nên không có trạng thái "chưa xử lý"; leo thang làm ngay khi ghi sự kiện nặng thay cho cảnh báo trễ. Không thêm cấu hình thời gian.
- Nhãn trạng thái `pending` trên cổng quản trị đổi "Chờ nhận" thành "Chờ nhận thuốc" (khớp ứng dụng phụ huynh, giáo viên); trạng thái "Phụ huynh gửi" của QT-07.
- Số migration 0224 theo phiên bản đề xuất, tránh dải 0202 trở đi các phần song song có thể dùng; kho mã bật `allowUnorderedMigrations`. Không cần migration định danh.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-344, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-52 (sửa tại chỗ), P10-04, P10-07, MH-17, MP-07, CT-1660 đến CT-1667.

#### Vấn đề tồn đọng

- Nhắc giờ cho uống thuốc (QT-07 mục 15, việc chạy nền) chưa làm, ngoài phạm vi C3.

## 24 Yêu cầu thay đổi

### YCTD-344: Dặn thuốc theo QT-07: trạng thái Đã nhận thuốc, báo phụ huynh khi cho uống, leo thang sự kiện y tế nặng – 2026-10-29

- Lý do: rà soát giao diện cổng quản trị ngày 2026-10-28, mục 3.1 C3 (mức Cao): `/medicines` lệch QT-07 (thiếu Đã nhận thuốc, không báo phụ huynh khi cho uống, không leo thang sự kiện nặng); kiểm lại thấy phần lớn lệch ở máy chủ.
- Nội dung thay đổi:
  - Trạng thái yêu cầu dặn thuốc theo QT-07 mục 7: `pending` → `received` (xác nhận đã nhận, ghi thuốc thực nhận) → `administering` (liều đầu tiên) → `completed` (hết thời gian dùng, đủ liều, hoặc kết thúc sớm); `rejected` chỉ từ `pending`. Ghi liều khi chưa nhận thuốc trả mã BR-49.
  - Thông báo theo QT-07 mục 9: gửi yêu cầu báo cả y tế và giáo viên chủ nhiệm; nhận thuốc, cho uống báo phụ huynh trong ứng dụng; từ chối, bỏ liều báo thêm tin nhắn.
  - Sự kiện y tế báo quản lý đơn vị; sự kiện nặng leo thang Ban Giám hiệu (QT-07 bước 8).
  - Giao diện `/medicines`, ứng dụng phụ huynh, ứng dụng giáo viên hiện trạng thái mới; cổng quản trị nhập thuốc thực nhận khi nhận thuốc.
- Thành phần bị ảnh hưởng: `apps/api` (medicines, health), `database` (năm học), `apps/portal`, `apps/parent`, `apps/teacher`, `tests` (spec 31).
- Dữ liệu bị ảnh hưởng: `medication_requests.status` thêm `received` (migration năm học 0224); phiếu đang cho uống chưa có liều chuyển về đã nhận thuốc.
- API bị ảnh hưởng: `GET /medication-requests` nhận `status=received`; `POST /medication-requests/{id}/receive` trả `received`; `POST /medication-requests/{id}/complete` nhận cả `received`; `POST /medication-administrations` nhận phiếu `received`; `GET /medication-schedules` gồm phiếu `received`. Không thêm điểm cuối.
- Giao diện bị ảnh hưởng: MH-17, MP-07, MG-09.
- Quyền bị ảnh hưởng: không (người nhận thuốc vẫn theo BR-49, BR-86).
- Ảnh hưởng chức năng cũ: phiếu vừa nhận thuốc hiện "Đã nhận thuốc" thay cho "Đang cho uống" đến liều đầu tiên; phụ huynh nhận thêm thông báo mỗi liều; quản lý đơn vị nhận thông báo sự kiện y tế.
- Kiểm thử cần thực hiện: CT-1660 đến CT-1667, CT-055, CT-058, CT-171 (kiểm thử API); e2e spec 31; typecheck, lint.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: dặn thuốc và sự kiện y tế theo QT-07 (YCTD-344).
- Chức năng mới: trạng thái Đã nhận thuốc; thông báo phụ huynh mỗi liều cho uống; leo thang sự kiện y tế nặng tới Ban Giám hiệu, báo quản lý đơn vị mọi sự kiện.
- Lỗi đã sửa: nhận thuốc chuyển thẳng sang đang cho uống; không tự hoàn thành khi hết thời gian dùng; từ chối, bỏ liều không gửi tin nhắn; yêu cầu mới chỉ báo một bên.
- Thay đổi dữ liệu: migration năm học 0224 (trạng thái `received`).
- Thay đổi API: trạng thái `received` ở các điểm cuối dặn thuốc (không thêm điểm cuối).
- Kiểm thử: CT-1660 đến CT-1667 cùng CT-055, CT-058, CT-171 (`medicines.test.ts` 9/9, `health.test.ts` 8/8, `reports-g2.test.ts` 8/8 trên máy ngày 29/10/2026); e2e spec 31 cập nhật.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Dặn thuốc theo QT-07: Đã nhận thuốc, báo phụ huynh khi cho uống, leo thang sự kiện y tế nặng | YCTD-344 |

## index Số đếm

| Ca kiểm thử khởi đầu | Số lượng | +8 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1660 | P10-04 | Phụ huynh, phụ huynh trẻ khác, giáo viên chủ nhiệm khi đơn vị có y tế, kế toán gọi xác nhận nhận thuốc | 403 với cả bốn; chỉ y tế của đơn vị (hoặc giáo viên chủ nhiệm khi bật BR-86) nhận được | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts`, `apps/api/src/health/health.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1661 | P10-04 | Phiếu chờ nhận thuốc: kết thúc sớm, xem lịch cho uống | Kết thúc trả 422 (P10-04); phiếu không có trong lịch cho uống (BR-49) | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts`, `apps/api/src/health/health.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1662 | P10-04 | Y tế nhận thuốc kèm số lượng thực nhận; phụ huynh lọc `status=received`; phụ huynh trẻ khác mở phiếu; phụ huynh, giáo viên ghi liều | Phiếu sang Đã nhận thuốc, vào lịch cho uống (`can_administer`); phụ huynh của trẻ thấy, phụ huynh khác 403; phụ huynh, giáo viên ghi liều 403; nhận lại, từ chối phiếu đã nhận 422 | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts`, `apps/api/src/health/health.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1663 | P10-04 | Ghi liều đầu tiên của phiếu đã nhận; kết thúc sớm phiếu đã nhận rồi ghi liều | Liều đầu chuyển Đang cho uống, phụ huynh của trẻ nhận "Con đã được cho uống thuốc" trong ứng dụng, phụ huynh khác không; kết thúc sớm được, ghi liều sau đó 422 | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts`, `apps/api/src/health/health.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1664 | P10-04 | Y tế từ chối nhận thuốc không lý do, rồi có lý do; bỏ liều kèm lý do | Không lý do 400; có lý do thì phụ huynh nhận thông báo trong ứng dụng và tin nhắn kèm lý do, nhận lại phiếu đã từ chối 422; bỏ liều báo trong ứng dụng và tin nhắn | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts`, `apps/api/src/health/health.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1665 | P10-04 | Phiếu đã nhận, đang cho uống, chờ nhận có ngày kết thúc trước hôm nay; đọc danh sách | Hai phiếu đầu chuyển Hoàn thành; phiếu chờ nhận giữ nguyên | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts`, `apps/api/src/health/health.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1666 | P10-03 | Phụ huynh gửi dặn thuốc ở đơn vị bật không có nhân viên y tế; lọc trạng thái lạ | Thông báo tới cả y tế (VT-09 của đơn vị) và giáo viên chủ nhiệm, nội dung ghi "Người nhận thuốc: giáo viên chủ nhiệm"; `status=waiting` trả 400 | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts`, `apps/api/src/health/health.test.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1667 | P10-07 | Ghi sự kiện y tế nhẹ, rồi sự kiện nặng | Sự kiện nhẹ báo quản lý đơn vị (VT-03) trong ứng dụng; sự kiện nặng báo VT-03, VT-02, VT-15 của đơn vị (mẫu `medical_event_severe`); phụ huynh vẫn nhận như cũ | Kiểm thử tự động `apps/api/src/medicines/medicines.test.ts`, `apps/api/src/health/health.test.ts` đạt ngày 29/10/2026 | Đạt |
