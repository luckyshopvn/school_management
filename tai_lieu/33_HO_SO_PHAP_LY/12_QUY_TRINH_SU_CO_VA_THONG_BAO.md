# PL-12. QUY TRÌNH XỬ LÝ SỰ CỐ VÀ THÔNG BÁO VI PHẠM DỮ LIỆU CÁ NHÂN

- Mã mẫu: PL-12; phiên bản mẫu: S8a-1.0 (2026-10-25); YCTD-200.
- Trạng thái: **bản nháp, cần luật sư rà trước khi dùng.**
- Căn cứ (đã đọc ngày 2026-10-25):
  - Điều 23 Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15: bên kiểm soát, bên kiểm soát và xử lý, bên thứ ba phát hiện vi phạm có thể gây tổn hại quốc phòng, an ninh, trật tự, an toàn xã hội hoặc xâm phạm tính mạng, sức khỏe, danh dự, nhân phẩm, tài sản của chủ thể dữ liệu thì **thông báo cơ quan chuyên trách chậm nhất 72 giờ kể từ khi phát hiện**; **bên xử lý phát hiện thì thông báo kịp thời cho bên kiểm soát**; bên kiểm soát lập **biên bản xác nhận** vi phạm, phối hợp xử lý.
  - Điều 28 Nghị định 356/2025/NĐ-CP: nội dung thông báo; gửi cơ quan chuyên trách hoặc qua **Cổng thông tin quốc gia về bảo vệ dữ liệu cá nhân** theo **Mẫu số 08**. Claude **chưa đọc Mẫu số 08**; mẫu ở mục 5 dựng theo khoản 1 Điều 28.
  - Điều 29 Nghị định 356/2025/NĐ-CP (thông báo vi phạm với dữ liệu vị trí, sinh trắc học): chưa đọc; luật sư đọc nếu nền tảng xử lý loại dữ liệu này.
  - Pháp luật an ninh mạng (Luật 116/2025/QH15, Nghị định 331/2026/NĐ-CP, 333/2026/NĐ-CP) có quy định riêng về báo cáo, ứng cứu sự cố an ninh mạng; Claude chưa đọc toàn văn; luật sư bổ sung đầu mối, thời hạn báo cáo sự cố an ninh mạng ở mục 4.

## 1. Phạm vi

Mọi sự cố ảnh hưởng tính bảo mật, toàn vẹn, sẵn sàng của dữ liệu trên nền tảng: lộ dữ liệu (kể cả lộ giữa các trường), truy cập trái phép, mất dữ liệu, mã độc, tấn công từ chối dịch vụ, nhân sự xử lý sai mục đích, sự cố của nhà cung cấp hạ tầng.

## 2. Vai trò

| Vai trò | Người | Nhiệm vụ |
|---|---|---|
| Trực sự cố | `[ ]` | Tiếp nhận cảnh báo, phân loại ban đầu, mở hồ sơ sự cố |
| Phụ trách xử lý | `[ ]` | Khoanh vùng, khắc phục, quyết định kỹ thuật |
| Phụ trách bảo vệ dữ liệu cá nhân của nền tảng | `[ ]` | Đánh giá ảnh hưởng tới dữ liệu cá nhân, soạn thông báo cho trường |
| Người quyết định | Eric hoặc người được ủy quyền | Quyết định thông báo, chuyển chỉ đọc, tạm ngưng |
| Đầu mối của trường | Theo Phụ lục C PL-02 | Nhận thông báo, quyết định thông báo cơ quan chuyên trách, chủ thể dữ liệu |

## 3. Các bước và thời hạn

Mốc tính giờ: **T0 = thời điểm phát hiện** (ghi chính xác vào hồ sơ sự cố).

| Bước | Việc | Thời hạn |
|---|---|---|
| 1 | Tiếp nhận, mở hồ sơ sự cố (mã, T0, người phát hiện, mô tả) | Ngay |
| 2 | Phân loại: có dữ liệu cá nhân bị ảnh hưởng không; trường nào; loại dữ liệu; dữ liệu trẻ em, dữ liệu nhạy cảm | T0 + `[4]` giờ |
| 3 | Ngăn chặn: khóa tài khoản, thu hồi khóa, chặn truy cập, chuyển trường bị ảnh hưởng sang chỉ đọc nếu cần; giữ nguyên chứng cứ (nhật ký, bản chụp) | Càng sớm càng tốt |
| 4 | **Nền tảng thông báo cho từng trường bị ảnh hưởng** (bên kiểm soát) theo mẫu mục 5 | Chậm nhất T0 + `[24]` giờ (PL-02 Điều 8) |
| 5 | **Trường (bên kiểm soát) thông báo cơ quan chuyên trách** khi thuộc trường hợp ở khoản 1 Điều 23 Luật, theo Mẫu số 08; Nền tảng soạn sẵn nội dung kỹ thuật | Chậm nhất **T0 + 72 giờ** |
| 6 | Lập **biên bản xác nhận** vi phạm (khoản 2 Điều 23 Luật) | Cùng bước 5 |
| 7 | Báo cáo sự cố an ninh mạng theo pháp luật an ninh mạng `[đầu mối, thời hạn: luật sư bổ sung]` | `[ ]` |
| 8 | Thông báo chủ thể dữ liệu (cha mẹ, cán bộ) khi trường quyết định hoặc cơ quan yêu cầu | `[ ]` |
| 9 | Khắc phục, khôi phục; xác nhận hết ảnh hưởng | |
| 10 | Rà soát sau sự cố: nguyên nhân, biện pháp phòng ngừa; cập nhật PL-06, PL-07 nếu thay đổi biện pháp | Trong `[14]` ngày |

Nếu một bên thứ ba (nhà cung cấp hạ tầng) báo sự cố, T0 là lúc Nền tảng nhận được thông báo.

## 4. Đầu mối bên ngoài

| Nơi nhận | Kênh | Ghi chú |
|---|---|---|
| Cơ quan chuyên trách bảo vệ dữ liệu cá nhân (Bộ Công an) | Cổng thông tin quốc gia về bảo vệ dữ liệu cá nhân `[địa chỉ: luật sư kiểm]` | Mẫu số 08 |
| Cơ quan tiếp nhận báo cáo sự cố an ninh mạng | `[ ]` | `[ ]` |
| Nhà cung cấp hạ tầng | Theo PL-08 | Yêu cầu nhật ký, hỗ trợ điều tra |

## 5. Mẫu thông báo vi phạm (nội dung theo khoản 1 Điều 28 Nghị định 356/2025/NĐ-CP)

**THÔNG BÁO VI PHẠM QUY ĐỊNH VỀ BẢO VỆ DỮ LIỆU CÁ NHÂN**
Số hồ sơ sự cố: `[ ]`  Gửi: `[tên trường / cơ quan chuyên trách]`  Thời điểm gửi: `[ ]`

1. **Tính chất vi phạm** (điểm a): thời gian xảy ra `[ ]`, thời gian phát hiện (T0) `[ ]`, địa điểm (hệ thống, thành phần, vùng máy chủ) `[ ]`, hành vi `[ ]`, tổ chức, cá nhân liên quan `[ ]`, loại dữ liệu cá nhân `[ ]`, số lượng dữ liệu, số chủ thể `[ ]` (trong đó trẻ em `[ ]`, dữ liệu nhạy cảm `[ ]`).
2. **Đầu mối** (điểm b): bộ phận, nhân sự bảo vệ dữ liệu cá nhân hoặc tổ chức cung cấp dịch vụ bảo vệ dữ liệu cá nhân: `[ ]`.
3. **Hậu quả, thiệt hại có thể xảy ra** (điểm c): `[ ]`.
4. **Biện pháp đã và sẽ thực hiện** (điểm d): `[ ]`.

Người gửi: `[ ]` (ký)

## 6. Mẫu biên bản xác nhận vi phạm

| Mục | Nội dung |
|---|---|
| Thời gian, địa điểm lập | `[ ]` |
| Thành phần | Đại diện trường `[ ]`; đại diện nền tảng `[ ]` |
| Diễn biến | `[ ]` |
| Dữ liệu, chủ thể bị ảnh hưởng | `[ ]` |
| Nguyên nhân xác định đến thời điểm lập | `[ ]` |
| Biện pháp đã thực hiện | `[ ]` |
| Việc tiếp theo, người chịu trách nhiệm, thời hạn | `[ ]` |

Chữ ký các bên.

## 7. Diễn tập

Diễn tập quy trình `[6 tháng/lần]`, có kịch bản lộ dữ liệu giữa hai trường dùng dữ liệu giả; ghi kết quả.
