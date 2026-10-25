# PL-14. HƯỚNG DẪN MÃ HÓA TRƯỜNG DỮ LIỆU TRẺ EM BẰNG KHÓA RIÊNG CỦA TRƯỜNG VÀ GIỚI HẠN

- Mã mẫu: PL-14; phiên bản mẫu: S8a-1.0 (2026-10-25); YCTD-200.
- Đọc cùng: kế hoạch 14.5 "S9" mục 4, S1a (`school_keys`), S8b (bảo mật mã). Tài liệu này mô tả biện pháp để đưa vào hồ sơ PL-06, PL-07 và để trường hiểu giới hạn; **không phải đặc tả kỹ thuật**, phần mã do S1a, S9 làm.
- Căn cứ (đã đọc ngày 2026-10-25): Điều 12 Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (mã hóa, giải mã dữ liệu cá nhân; chưa đọc toàn văn điều này); khoản 4 Điều 12 Nghị định 356/2025/NĐ-CP (dữ liệu cá nhân trên điện toán đám mây phải được mã hóa ở trạng thái nghỉ và truyền, kèm phân quyền truy cập nghiêm ngặt); khoản 2 Điều 7 Nghị định (chuyển giao dữ liệu nhạy cảm cần biện pháp mã hóa).

## 1. Những gì được mã hóa thêm bằng khóa riêng của trường

| Dữ liệu | Hiện trạng trong mã | Sau S1a, S9 |
|---|---|---|
| Số định danh cá nhân của trẻ (`national_id_encrypted`) | Mã hóa bằng `CHILD_DATA_ENCRYPTION_KEY` chung của bản triển khai; tra trùng qua `national_id_hash` (khóa băm `CHILD_DATA_HASH_KEY`) | Mã hóa bằng khóa riêng của từng trường ở `school_keys` |
| Khóa truy cập tích hợp của trường (`integration_credentials`) | Mã hóa AES-GCM bằng khóa dữ liệu trẻ (`secret-encryption.ts`) | Như trên |
| Danh sách trường dữ liệu nên mã hóa thêm cho `consented` | — | S9 rà và ghi vào YCTD của S9 |

## 2. Quản lý khóa

1. Mỗi trường một khóa dữ liệu, sinh khi khởi tạo trường.
2. Khóa của trường được **bọc** bằng `PLATFORM_MASTER_KEY`; khóa gốc chỉ có ở môi trường chạy của máy chủ ứng dụng, **không lưu cùng nhà cung cấp cơ sở dữ liệu**, không ghi vào kho mã, không in ra nhật ký.
3. Xoay khóa: `[chu kỳ, cách làm: S8b chốt]`.
4. Xóa khóa của trường khi xóa trường (PL-13 mục 5).
5. Ai được giải mã: chỉ tiến trình ứng dụng khi người dùng có quyền xem; nhân sự nền tảng không có công cụ giải mã thủ công ngoài quy trình sự cố có phê duyệt.

## 3. Giới hạn (bắt buộc ghi vào PL-03, PL-06, PL-07)

1. **Phần lớn dữ liệu nằm dạng rõ trong cơ sở dữ liệu của nhà cung cấp**: họ tên, ngày sinh, lớp, điểm danh, sức khỏe, học phí, liên lạc của cha mẹ, hồ sơ nhân sự. Nhà cung cấp cơ sở dữ liệu hoặc người chiếm được quyền quản trị cơ sở dữ liệu có thể đọc các dữ liệu này.
2. Mã hóa khi lưu của nhà cung cấp (đĩa, bản sao lưu) bảo vệ khi mất thiết bị, **không** bảo vệ trước chính nhà cung cấp hoặc tài khoản quản trị cơ sở dữ liệu bị lộ.
3. Máy chủ ứng dụng giữ khóa gốc trong bộ nhớ khi chạy; nếu máy chủ ứng dụng bị chiếm quyền thì khóa có thể bị lộ.
4. Đây là **biện pháp giảm rủi ro**, không phải mã hóa toàn bộ, và không thay thế việc chuyển dữ liệu về máy chủ trong nước (PL-10).
