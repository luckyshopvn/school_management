# PL-08. MẪU BẢN GHI VÙNG MÁY CHỦ VÀ DANH SÁCH BÊN XỬ LÝ PHỤ

- Mã mẫu: PL-08; phiên bản mẫu: S8a-1.0 (2026-10-25); YCTD-200. Mẫu của bảng `school_hosting` (S9).
- Trạng thái: **bản nháp, cần luật sư rà trước khi dùng.** Tên nhà cung cấp, vùng là **giả định** theo kế hoạch (14.11 GD-96, GD-100); chưa ký với nhà cung cấp nào. Không ghi tài khoản, khóa, địa chỉ máy chủ thật vào bản lưu trong kho.
- Căn cứ: Điều 12 Nghị định 356/2025/NĐ-CP (hợp đồng với nhà cung cấp điện toán đám mây phải xác định luồng xử lý, vai trò các bên; nhà cung cấp đề nghị nhà thầu phụ thực hiện nghĩa vụ bảo vệ dữ liệu); điểm a khoản 3 Điều 18 Nghị định (thông tin các bên trong hồ sơ chuyển xuyên biên giới).

## Cách dùng

1. Nền tảng lập một bản cho mỗi hồ sơ triển khai, cập nhật khi thêm, đổi nhà cung cấp hoặc vùng; mỗi lần cập nhật tăng số phiên bản bản ghi, báo trước `[30]` ngày cho các trường bị ảnh hưởng (PL-02 Điều 7).
2. Khi một trường ký PL-03, chụp bản ghi tại ngày ký vào `school_consents.hosting_snapshot`.
3. Mỗi dòng dưới đây tương ứng một dòng `school_hosting` của trường.

---

**BẢN GHI VÙNG MÁY CHỦ VÀ BÊN XỬ LÝ PHỤ**

Hồ sơ triển khai: `[Thử nghiệm – tổ hợp 1 / tổ hợp 2 / tổ hợp 3a / tổ hợp 3b; Vận hành]`
Phiên bản bản ghi: `[ ]`  Ngày lập: `[ ]`  Người lập: `[ ]`

## 1. Danh sách

| Dịch vụ (`service`) | Nhà cung cấp (`provider`) | Vùng (`region`) | Vai trò (`role`) | Lưu dữ liệu cá nhân? (`stores_personal_data`) | Dữ liệu lưu | Mã hóa khi lưu | Hợp đồng, điều khoản xử lý dữ liệu | Từ ngày (`started_on`) |
|---|---|---|---|---|---|---|---|---|
| Mạng biên, định tuyến, tệp tĩnh giao diện | `[ ]` | Mạng biên toàn cầu | `transit` | Không lưu dữ liệu nghiệp vụ; nhật ký truy cập theo chính sách nhà cung cấp `[kiểm]` | Không | — | `[ ]` | `[ ]` |
| Máy chủ ứng dụng (định danh, API) | `[ ]` | `[Singapore]` | `subprocessor` | Có (trong bộ nhớ khi xử lý; nhật ký ứng dụng) | Nhật ký ứng dụng | `[ ]` | `[ ]` | `[ ]` |
| Cơ sở dữ liệu | `[ ]` | `[Singapore]` | `subprocessor` | Có | Toàn bộ dữ liệu nghiệp vụ của trường | `[theo nhà cung cấp]`; trường dữ liệu trẻ em mã hóa thêm bằng khóa riêng của trường (PL-14) | `[ ]` | `[ ]` |
| Kho tệp | `[ ]` | `[ ]` | `subprocessor` | Có | Tệp đính kèm, ảnh, tệp xuất | `[ ]` | `[ ]` | `[ ]` |
| Sao lưu | `[ ]` | `[ ]` | `subprocessor` | Có (bản mã) | Bản sao lưu mã hóa AES-256 | Có | `[ ]` | `[ ]` |
| Gửi thư điện tử | `[ ]` | `[ ]` | `subprocessor` | Có (địa chỉ, nội dung thư) | | | `[ ]` | `[ ]` |
| Tin nhắn | `[ ]` | `[ ]` | `subprocessor` | Có (số điện thoại, nội dung) | | | `[ ]` | `[ ]` |
| Trợ lý AI (DT-23 phần 23d, PL-16; chỉ khi trường chọn cấu hình do nền tảng cấp khóa; cấu hình trường tự nhập khóa thì nhà trường tự ký với nhà cung cấp) | `[ ]` | `[ ]` | `subprocessor` | Không theo thiết kế (chỉ nội dung chương trình; bộ quét chặn dữ liệu cá nhân) | Nội dung chương trình, yêu cầu của giáo viên | `[ ]` | `[ ]` | `[ ]` |
| Cổng thanh toán (của nền tảng, thu phí trường) | `[ ]` | `[ ]` | `[bên kiểm soát độc lập / bên xử lý phụ: luật sư xác định]` | Có | | | `[ ]` | `[ ]` |

Ghi chú hồ sơ Thử nghiệm theo kế hoạch (GD-100): mạng biên là Worker của Cloudflare (hoặc Vercel ở tổ hợp 3); cơ sở dữ liệu Neon hoặc Supabase; kho tệp R2 hoặc Supabase Storage; máy chủ ứng dụng Render, dự phòng Koyeb. Chọn vùng gần Việt Nam nhất mà nhà cung cấp có (thường là Singapore) khi tạo dịch vụ; **kiểm lại vùng thật trên bảng điều khiển của nhà cung cấp và ghi vào bảng**, không chép từ đây. Hồ sơ Vận hành: VPS trong nước `[nhà cung cấp chưa chốt]`, ghi vùng là `[Việt Nam, tỉnh/thành]`.

## 2. Xác nhận của Nhà trường (khi gắn với một trường)

Nhà trường `[tên trường]` đã nhận bản ghi này, phiên bản `[ ]`, ngày `[ ]`.

Đại diện Nhà trường: `[ ]` (ký)
