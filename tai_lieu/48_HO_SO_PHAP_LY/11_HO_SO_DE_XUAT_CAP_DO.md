# PL-11. MẪU HỒ SƠ ĐỀ XUẤT CẤP ĐỘ HỆ THỐNG THÔNG TIN VÀ PHƯƠNG ÁN BẢO VỆ

- Mã mẫu: PL-11; phiên bản mẫu: S8a-1.0 (2026-10-25); YCTD-200.
- Trạng thái: **bản nháp, cần luật sư và chuyên gia an ninh mạng rà trước khi dùng.**
- Lưu ý về căn cứ: kế hoạch (14.3) ghi Nghị định 85/2016/NĐ-CP và Thông tư 12/2022/TT-BTTTT. Đến ngày 2026-10-25:
  - **Nghị định 331/2026/NĐ-CP** về bảo vệ an ninh mạng đối với hệ thống thông tin (ban hành, hiệu lực 19/08/2026; thuộc tính đọc trên `chinhphu.vn`) quy định tiêu chí, thẩm quyền, trình tự xác định cấp độ và biện pháp bảo vệ theo cấp độ, hướng dẫn Luật An ninh mạng số 116/2025/QH15 (hiệu lực 01/07/2026).
  - Theo bài của Bộ Công an về Nghị định 331/2026 (`mps.gov.vn`, đọc ngày 2026-10-25): có năm cấp độ; **cấp độ 2** gồm hệ thống cung cấp dịch vụ trực tuyến cho người dân, doanh nghiệp không thuộc ngành nghề kinh doanh có điều kiện và xử lý dữ liệu cá nhân **dưới 100.000 chủ thể** (dữ liệu cơ bản) **hoặc dưới 10.000 chủ thể** (dữ liệu nhạy cảm); **cấp độ 3** gồm hệ thống từ các ngưỡng đó trở lên, hoặc dịch vụ thuộc ngành nghề kinh doanh có điều kiện; hệ thống đáp ứng nhiều tiêu chí áp dụng **cấp độ cao nhất**, cấm tách hệ thống hình thức để giảm cấp (Điều 8); vượt ngưỡng thì lập lại hồ sơ đề xuất cấp độ; chuyển tiếp ở Điều 39 (hệ thống đang đầu tư trước 01/07/2026 hoàn thành thẩm định theo Nghị định 85/2016 trong 06 tháng, đáp ứng cấp độ mới trong 12 tháng kể từ ngày Luật có hiệu lực).
  - Claude **chưa đọc toàn văn** Nghị định 331/2026 (tệp gốc là ảnh quét), nên thành phần hồ sơ, cơ quan thẩm định, phê duyệt dưới đây là khung để luật sư, chuyên gia điền theo Chương III Nghị định; chưa xác định được Nghị định 85/2016, Thông tư 12/2022 đã bị bãi bỏ chính thức hay chưa.

## Nhận định ban đầu về cấp độ (để chuyên gia kiểm)

- Nền tảng xử lý dữ liệu cá nhân nhạy cảm (tình trạng sức khỏe trẻ em; hình ảnh thẻ căn cước nếu trường tải lên; thông tin tài khoản ngân hàng nhận lương). Với một trường mầm non vài trăm trẻ thì dưới ngưỡng, nhưng nền tảng nhiều trường **tính tổng chủ thể của mọi trường** trên cùng hệ thống; khi tổng dữ liệu nhạy cảm từ 10.000 chủ thể trở lên thì **dự kiến cấp độ 3**.
- Nếu kinh doanh dịch vụ xử lý dữ liệu cá nhân là ngành nghề kinh doanh có điều kiện (PL-15) thì có thể thuộc cấp độ 3 ngay từ đầu.
- Hồ sơ Thử nghiệm và hồ sơ Vận hành là **một hệ thống** hay hai hệ thống: chuyên gia xác định; không tách hình thức để giảm cấp.
- Mỗi trường có thể phải xác định cấp độ cho hệ thống của trường khi thuê dịch vụ: theo bài của Bộ Công an, Nghị định 331/2026 có quy định cách xác định đơn vị vận hành khi thuê dịch vụ công nghệ thông tin; luật sư đọc điều khoản này.

---

**HỒ SƠ ĐỀ XUẤT CẤP ĐỘ HỆ THỐNG THÔNG TIN**
(Khung; thay bằng thành phần, mẫu ở Chương III Nghị định 331/2026/NĐ-CP)

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên hệ thống | `[tên sản phẩm]` – nền tảng quản lý trường học nhiều trường |
| Chủ quản hệ thống | `[tên pháp nhân vận hành nền tảng]`; người đứng đầu `[ ]` |
| Đơn vị vận hành | `[ ]` |
| Phạm vi | Các thành phần ở PL-08 của hồ sơ triển khai `[ ]`: mạng biên, máy chủ ứng dụng (định danh, API, tiến trình nền), cơ sở dữ liệu `platform` và cơ sở dữ liệu của từng trường, kho tệp, sao lưu, giám sát |
| Người dùng | Quản trị nền tảng; quản trị, cán bộ, giáo viên, nhân viên của trường; cha mẹ, người giám hộ |
| Quy mô | Số trường `[ ]`; tổng chủ thể dữ liệu cơ bản `[ ]`; tổng chủ thể dữ liệu nhạy cảm `[ ]` |
| Kết nối | Cổng thanh toán, tin nhắn, thư điện tử, cổng dữ liệu ngành giáo dục `[ ]` |

## 2. Mô tả hệ thống

Kiến trúc: theo `12_KIEN_TRUC_HE_THONG.md` và kế hoạch 14.4 (sơ đồ đính kèm). Phân vùng mạng, luồng dữ liệu, điểm kết nối ra ngoài.

## 3. Đề xuất cấp độ và thuyết minh

| Tiêu chí (theo Nghị định 331/2026) | Hệ thống đáp ứng? | Thuyết minh |
|---|---|---|
| Dịch vụ trực tuyến cho người dân, doanh nghiệp; có thuộc ngành nghề kinh doanh có điều kiện | `[ ]` | `[ ]` |
| Số chủ thể dữ liệu cơ bản so với ngưỡng 100.000 | `[ ]` | `[ ]` |
| Số chủ thể dữ liệu nhạy cảm so với ngưỡng 10.000 | `[ ]` | `[ ]` |
| Tiêu chí khác `[ ]` | | |

Cấp độ đề xuất: `[ ]` (áp dụng cấp độ cao nhất trong các tiêu chí đáp ứng).

## 4. Phương án bảo vệ theo cấp độ

| Nhóm biện pháp | Hiện trạng | Kế hoạch | Thời hạn |
|---|---|---|---|
| Quy định bảo đảm an ninh mạng trong vòng đời hệ thống (thiết kế, xây dựng, vận hành, hủy bỏ) | `[ ]` | `[ ]` | `[ ]` |
| Quản lý tài khoản, xác thực, phân quyền (xác thực hai lớp cho vận hành; GD-97) | `[ ]` | | |
| Tách dữ liệu từng trường; kiểm thử cách ly (kế hoạch 14.7) | `[ ]` | | |
| Mã hóa khi truyền, khi lưu; mã hóa trường dữ liệu trẻ em (PL-14) | `[ ]` | | |
| Nhật ký hệ thống, lưu tối thiểu 12 tháng có khả năng truy xuất (theo tóm tắt Nghị định 333/2026, luật sư kiểm) | `[ ]` | | |
| Sao lưu, khôi phục theo tiêu chuẩn quốc gia `[ ]` (PL-13) | `[ ]` | | |
| Giám sát, phát hiện, ứng cứu sự cố (PL-12) | `[ ]` | | |
| Kiểm tra, đánh giá an ninh mạng trước khi đưa vào vận hành; định kỳ | `[ ]` | | |
| Quản lý bên cung cấp dịch vụ (PL-08) | `[ ]` | | |

## 5. Đối chiếu tiêu chuẩn, quy chuẩn

| Tiêu chuẩn, quy chuẩn | Yêu cầu theo cấp độ | Đáp ứng | Ghi chú |
|---|---|---|---|
| `[tiêu chuẩn quốc gia về an ninh mạng cho hệ thống thông tin theo cấp độ, bản hiện hành]` | | | |
| `[tiêu chuẩn, quy chuẩn về bảo vệ dữ liệu cá nhân]` | | | |

## 6. Thẩm định, phê duyệt

| Bước | Cơ quan, người thực hiện | Thời hạn | Kết quả |
|---|---|---|---|
| Lập hồ sơ | Đơn vị vận hành | | |
| Thẩm định | `[theo Nghị định 331/2026]` | | |
| Phê duyệt | `[theo Nghị định 331/2026]` | | |

Đơn vị lập: `[ ]`  Chủ quản hệ thống: `[ ]` (ký)
