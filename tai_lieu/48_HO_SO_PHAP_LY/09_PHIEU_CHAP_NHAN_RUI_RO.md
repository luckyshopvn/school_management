# PL-09. MẪU PHIẾU CHẤP NHẬN RỦI RO PHÁP LÝ VỀ LƯU TRỮ DỮ LIỆU NGOÀI VIỆT NAM

- Mã mẫu: PL-09; phiên bản mẫu: S8a-1.0 (2026-10-25); YCTD-200. Bằng chứng: `school_consents` loại `risk-acceptance` (một phiếu cho nền tảng, gắn tham chiếu vào từng trường `consented`).
- Trạng thái: **bản nháp, cần luật sư rà trước khi dùng.**
- Người chấp nhận rủi ro: **Eric**, theo quyết định ngày 2026-10-25 (kế hoạch 14.1 mục 2, 14.5 "S9" mục 6, 14.11 GD-101).
- Lưu ý về căn cứ: kế hoạch ghi rủi ro theo Nghị định 53/2022/NĐ-CP. Đến ngày 2026-10-25 khung pháp lý đã đổi: **Luật An ninh mạng số 116/2025/QH15** có hiệu lực từ 01/07/2026 và **Nghị định 333/2026/NĐ-CP** (hiệu lực 19/08/2026) quy định chi tiết, gồm lưu trữ dữ liệu tại Việt Nam. Claude chưa đọc toàn văn Nghị định 333/2026 (tệp gốc là ảnh quét) và chưa xác định được Nghị định 53/2022 còn hiệu lực hay không; phiếu này ghi theo tóm tắt chính thức của Bộ Công an. **Luật sư kiểm lại căn cứ ở mục 2 trước khi Eric ký.**

---

**PHIẾU CHẤP NHẬN RỦI RO PHÁP LÝ**
Số: `[ ]`

## 1. Hoạt động được chấp nhận rủi ro

Vận hành nền tảng `[tên sản phẩm]` ở hồ sơ triển khai "Thử nghiệm", lưu trữ và xử lý **dữ liệu thật** của các trường đã có văn bản đồng ý (PL-03) trên máy chủ của nhà cung cấp đặt **ngoài lãnh thổ Việt Nam** (vùng `[Singapore]`, danh sách ở PL-08 phiên bản `[ ]`).

## 2. Rủi ro pháp lý đã được nhận diện

| Mã | Rủi ro | Căn cứ (luật sư kiểm) | Hậu quả có thể xảy ra |
|---|---|---|---|
| RP-1 | Không đáp ứng yêu cầu lưu trữ dữ liệu người dùng tại Việt Nam của doanh nghiệp trong nước cung cấp dịch vụ trên không gian mạng | Luật An ninh mạng số 116/2025/QH15 (số điều chưa kiểm trên văn bản gốc; tài liệu tư vấn ngoài nhà nước nêu khoản 3 Điều 25); Nghị định 333/2026/NĐ-CP Điều 19, 20 (theo tóm tắt của Bộ Công an: dữ liệu thông tin cá nhân của người sử dụng tại Việt Nam và dữ liệu do người sử dụng tại Việt Nam tạo ra; doanh nghiệp trong nước phải lưu tại Việt Nam; thời gian lưu dữ liệu tối thiểu 24 tháng, nhật ký hệ thống tối thiểu 12 tháng); Nghị định 53/2022/NĐ-CP `[còn hiệu lực hay không]` | Xử phạt vi phạm hành chính theo nghị định xử phạt về an ninh mạng `[luật sư tra]`; yêu cầu chuyển dữ liệu về trong nước; gián đoạn dịch vụ |
| RP-2 | Chuyển dữ liệu cá nhân xuyên biên giới không lập, không nộp, nộp muộn hoặc hồ sơ không đạt | Điều 20, khoản 4 Điều 8 Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15; Điều 17, 18 Nghị định 356/2025/NĐ-CP | Phạt tới 5% doanh thu năm trước liền kề của tổ chức; cơ quan chuyên trách yêu cầu ngừng chuyển |
| RP-3 | Nền tảng thuộc diện kinh doanh dịch vụ xử lý dữ liệu cá nhân mà chưa có Giấy chứng nhận đủ điều kiện | Điều 21 đến 26 Nghị định 356/2025/NĐ-CP (PL-15) | Xử phạt; buộc ngừng cung cấp dịch vụ |
| RP-4 | Cơ quan của nước nơi đặt máy chủ yêu cầu nhà cung cấp cung cấp dữ liệu | Pháp luật nước sở tại của nhà cung cấp `[ ]` | Lộ dữ liệu dạng rõ (trừ trường dữ liệu trẻ em đã mã hóa bằng khóa riêng) |
| RP-5 | Hồ sơ đồng ý, thông báo của trường không đủ căn cứ với dữ liệu trẻ em | Điều 9, 24 Luật 91/2025 | Trường, nền tảng bị xử phạt; phải xóa dữ liệu |

## 3. Biện pháp giảm rủi ro đã áp dụng

1. Chỉ nhận dữ liệu thật của trường có đủ PL-01, PL-02, PL-03, PL-06, PL-07, bản ghi PL-08 (S2, S9 chặn khi thiếu).
2. Mã hóa trường dữ liệu trẻ em bằng khóa riêng của trường, khóa gốc không ở nhà cung cấp cơ sở dữ liệu (PL-14).
3. Giới hạn thời gian dùng thử dữ liệu thật; lộ trình và công cụ chuyển về trong nước (PL-10), thời hạn mục tiêu 30 ngày.
4. Biểu ngữ "môi trường thử nghiệm, máy chủ ngoài Việt Nam" trên mọi giao diện (`PLATFORM_DATA_POLICY=consent-required`).
5. Luật sư rà toàn bộ hồ sơ trước khi nhận dữ liệu thật của trường đầu tiên.

## 4. Giới hạn của việc chấp nhận

- Số trường `consented` tối đa: `[ ]`; số học sinh tối đa: `[ ]`.
- Thời hạn chấp nhận: từ `[ ]` đến `[ ]` (khuyến nghị không quá `[6]` tháng; gia hạn bằng phiếu mới).
- Phiếu tự hết hiệu lực khi: cơ quan có thẩm quyền yêu cầu; luật sư kết luận không được tiếp tục; xảy ra sự cố lộ dữ liệu của trường `consented`; hết thời hạn.

## 5. Xác nhận

Tôi đã đọc các rủi ro ở mục 2, ý kiến của luật sư ngày `[ ]` (số văn bản `[ ]`), và chấp nhận các rủi ro này trong giới hạn ở mục 4. Tôi hiểu việc chấp nhận rủi ro **không làm mất** nghĩa vụ tuân thủ pháp luật và không loại trừ trách nhiệm với trường, chủ thể dữ liệu.

Người chấp nhận rủi ro: Eric, chức danh `[ ]` tại `[tên pháp nhân vận hành nền tảng]`
Ngày ký: `[ ]`  Chữ ký: `[ ]`

Ý kiến luật sư (đính kèm): `[ ]`
