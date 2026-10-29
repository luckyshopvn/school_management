# PL-01. MẪU HỢP ĐỒNG CUNG CẤP DỊCH VỤ PHẦN MỀM QUẢN LÝ TRƯỜNG HỌC

- Mã mẫu: PL-01; phiên bản mẫu: S8a-1.0 (2026-10-25); YCTD-200.
- Trạng thái: **bản nháp, cần luật sư rà trước khi dùng.** Chỗ `[ ]` là chỗ điền; chú thích trong ngoặc vuông là hướng dẫn, xóa khi điền.
- Đi kèm: PL-02 (Thỏa thuận xử lý dữ liệu cá nhân, phụ lục bắt buộc của hợp đồng này); PL-08 (bản ghi vùng máy chủ, bên xử lý phụ); với trường dùng thử dữ liệu thật ở máy chủ ngoài Việt Nam thêm PL-03, PL-10.

---

CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc

**HỢP ĐỒNG CUNG CẤP DỊCH VỤ PHẦN MỀM QUẢN LÝ TRƯỜNG HỌC**

Số: `[số hợp đồng]`

Căn cứ Bộ luật Dân sự; Luật Thương mại; Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP; Luật An ninh mạng số 116/2025/QH15 và văn bản hướng dẫn; `[văn bản khác do luật sư bổ sung]`;

Căn cứ nhu cầu và khả năng của hai bên,

Hôm nay, ngày `[ ]` tháng `[ ]` năm `[ ]`, tại `[địa điểm]`, chúng tôi gồm:

**Bên A (Bên sử dụng dịch vụ, Nhà trường):** `[tên trường]`
- Địa chỉ: `[ ]`
- Mã số đơn vị (mã định danh, mã số thuế nếu có): `[ ]`
- Đại diện: `[họ tên]`, chức vụ: `[Hiệu trưởng hoặc người được ủy quyền]`; văn bản ủy quyền số `[ ]` (nếu có)

**Bên B (Bên cung cấp dịch vụ, Nền tảng):** `[tên pháp nhân vận hành nền tảng]` [chưa chốt; để trống đến khi có pháp nhân]
- Địa chỉ: `[ ]`; mã số doanh nghiệp: `[ ]`
- Đại diện: `[họ tên]`, chức vụ: `[ ]`
- Giấy chứng nhận đủ điều kiện kinh doanh dịch vụ xử lý dữ liệu cá nhân số `[ ]` ngày `[ ]` [nếu thuộc diện phải có, xem PL-15]

Hai bên thống nhất ký hợp đồng với các điều khoản sau.

## Điều 1. Giải thích từ ngữ

1. **Dịch vụ**: quyền truy cập và sử dụng phần mềm quản lý trường học `[tên sản phẩm, cấu hình ở `platform_settings`]` do Bên B vận hành, gồm cổng quản trị, ứng dụng web cho giáo viên và cha mẹ học sinh, theo gói ở Điều 3.
2. **Dữ liệu của Nhà trường**: mọi dữ liệu do Bên A, người dùng của Bên A nhập hoặc tạo ra trong Dịch vụ, gồm dữ liệu cá nhân của học sinh, cha mẹ, người giám hộ, cán bộ, giáo viên, nhân viên.
3. **Bên kiểm soát dữ liệu cá nhân, bên xử lý dữ liệu cá nhân, chủ thể dữ liệu cá nhân, dữ liệu cá nhân nhạy cảm**: theo nghĩa ở Luật Bảo vệ dữ liệu cá nhân và Nghị định 356/2025/NĐ-CP.
4. **Hồ sơ triển khai**: (a) "Thử nghiệm": hạ tầng của nhà cung cấp có máy chủ ngoài Việt Nam; (b) "Vận hành": máy chủ đặt tại Việt Nam. Hồ sơ đang dùng cho Bên A ghi ở Phụ lục 1.
5. **Phân loại dữ liệu của trường**: `synthetic` (dữ liệu giả), `consented` (dữ liệu thật có văn bản đồng ý, dùng ở hồ sơ Thử nghiệm), `production` (dữ liệu thật ở hồ sơ Vận hành).

## Điều 2. Phạm vi dịch vụ

1. Bên B cung cấp Dịch vụ theo gói Bên A chọn: phân hệ được bật, giới hạn số học sinh đang học, dung lượng tệp, số cấp học (Phụ lục 1).
2. Bên B khởi tạo đường dẫn riêng của Bên A theo mẫu `[mã trường].[tên miền hệ thống]` hoặc tên miền riêng của Bên A (Bên A tự trỏ bản ghi DNS).
3. Bên B **không** dùng Dữ liệu của Nhà trường cho mục đích nào khác ngoài cung cấp Dịch vụ cho Bên A, không bán, không chia sẻ cho bên thứ ba ngoài các bên xử lý phụ ghi ở PL-08, không dùng để huấn luyện mô hình trí tuệ nhân tạo.
4. Các tích hợp với bên thứ ba (cổng thanh toán, tin nhắn, mạng xã hội) chỉ bật khi Bên A cấu hình và tự ký hợp đồng với nhà cung cấp đó, trừ khi Phụ lục 1 ghi khác.

## Điều 3. Gói dịch vụ, phí và thanh toán

1. Gói, cách tính phí (theo số học sinh đang học, theo trường hoặc theo phân hệ), kỳ thanh toán, đơn giá ghi ở Phụ lục 1. [Giả định GD-94: mặc định theo số học sinh đang học chốt cuối kỳ cộng phí tối thiểu theo trường.]
2. Thời gian dùng thử miễn phí: `[30]` ngày kể từ ngày khởi tạo [giả định GD-99].
3. Bên B xuất hóa đơn điện tử theo quy định; Bên A thanh toán trong `[ ]` ngày kể từ ngày nhận hóa đơn.
4. Quá hạn thanh toán: Bên B nhắc trước hạn `[15, 7, 1]` ngày; sau hạn `[7]` ngày chuyển Dịch vụ sang chế độ **chỉ đọc** (xem, xuất dữ liệu, thanh toán vẫn được); sau hạn `[30]` ngày tạm ngưng [giả định GD-99]. Bên B **không xóa** Dữ liệu của Nhà trường vì lý do chậm thanh toán trong thời hạn ở Điều 9.

## Điều 4. Thời hạn hợp đồng

1. Hợp đồng có hiệu lực từ ngày ký đến ngày `[ ]`; tự gia hạn từng kỳ `[ ]` tháng nếu không bên nào báo chấm dứt trước `[30]` ngày.
2. Với trường dùng thử dữ liệu thật ở hồ sơ Thử nghiệm, thời hạn dùng thử dữ liệu thật không vượt quá thời hạn ghi trong văn bản đồng ý (PL-03) và phiếu chấp nhận rủi ro còn hiệu lực (PL-09).

## Điều 5. Quyền và nghĩa vụ của Bên A

1. Là **bên kiểm soát dữ liệu cá nhân** đối với Dữ liệu của Nhà trường: quyết định mục đích, căn cứ xử lý; bảo đảm có căn cứ hợp pháp để đưa dữ liệu vào Dịch vụ (sự đồng ý của chủ thể dữ liệu, của người đại diện theo pháp luật của trẻ em, hoặc trường hợp không cần đồng ý theo Điều 19 Luật Bảo vệ dữ liệu cá nhân).
2. Thông báo cho cha mẹ, người giám hộ, cán bộ về việc xử lý dữ liệu, bên xử lý, vùng máy chủ (mẫu ở PL-03 phần B).
3. Lập, lưu, nộp hồ sơ đánh giá tác động xử lý dữ liệu cá nhân và, khi dùng hồ sơ Thử nghiệm, hồ sơ đánh giá tác động chuyển dữ liệu cá nhân xuyên biên giới theo Luật và Nghị định 356/2025/NĐ-CP; Bên B cung cấp phần thông tin kỹ thuật (PL-06, PL-07).
4. Quản lý tài khoản người dùng của Bên A; cấp, thu hồi quyền; giữ bí mật mật khẩu.
5. Không đưa vào Dịch vụ dữ liệu trái pháp luật; không dùng Dịch vụ để xâm phạm quyền của người khác.
6. Thanh toán đúng hạn.

## Điều 6. Quyền và nghĩa vụ của Bên B

1. Là **bên xử lý dữ liệu cá nhân**: chỉ xử lý theo PL-02 và chỉ dẫn bằng văn bản của Bên A.
2. Bảo đảm Dịch vụ hoạt động theo mức cam kết ở Phụ lục 2; sao lưu dữ liệu theo PL-13; khôi phục khi có sự cố.
3. Áp dụng biện pháp quản lý, kỹ thuật bảo vệ dữ liệu (PL-02 Điều 6), tách dữ liệu của từng trường, mã hóa khi truyền và khi lưu theo khả năng của hồ sơ triển khai, mã hóa trường dữ liệu trẻ em bằng khóa riêng của trường (PL-14).
4. Thông báo sự cố theo PL-12; phối hợp với Bên A và cơ quan có thẩm quyền.
5. Cung cấp công cụ để Bên A xuất toàn bộ dữ liệu bất kỳ lúc nào trong thời hạn hợp đồng và thời hạn giữ dữ liệu sau chấm dứt.
6. Báo trước cho Bên A ít nhất `[30]` ngày khi thêm, đổi bên xử lý phụ hoặc vùng máy chủ (PL-08); Bên A có quyền phản đối và chấm dứt không bị phạt.
7. Không cho nhân sự của Bên B truy cập dữ liệu của Bên A, trừ khi cần để hỗ trợ theo yêu cầu của Bên A hoặc xử lý sự cố; mọi lần truy cập được ghi nhật ký.

## Điều 7. Bảo vệ dữ liệu cá nhân và hồ sơ triển khai

1. Việc xử lý dữ liệu cá nhân thực hiện theo PL-02, là phụ lục không tách rời của hợp đồng.
2. Hồ sơ triển khai, vùng máy chủ, bên xử lý phụ ghi ở PL-08 tại ngày ký.
3. **Nếu Bên A dùng hồ sơ Thử nghiệm với dữ liệu thật**: Bên A đã được thông báo rằng máy chủ đặt ngoài Việt Nam (vùng gần nhất `[Singapore]`), rủi ro pháp lý về lưu trữ dữ liệu trong nước và chuyển dữ liệu xuyên biên giới, và đã ký PL-03. Bên B chuyển dữ liệu của Bên A về máy chủ trong nước theo PL-10 khi một điều kiện kích hoạt xảy ra.
4. Bên A có thể chọn dùng hồ sơ Vận hành (máy chủ tại Việt Nam) khi Bên B đã cung cấp; giá có thể khác (Phụ lục 1).

## Điều 8. Sở hữu trí tuệ

1. Bên A giữ toàn quyền đối với Dữ liệu của Nhà trường.
2. Bên B giữ quyền đối với phần mềm, giao diện, tài liệu của Dịch vụ; Bên A được quyền sử dụng trong thời hạn hợp đồng.

## Điều 9. Chấm dứt hợp đồng và trả dữ liệu

1. Hợp đồng chấm dứt khi hết hạn không gia hạn; khi hai bên thỏa thuận; khi một bên vi phạm nghiêm trọng và không khắc phục trong `[30]` ngày kể từ ngày nhận thông báo; khi Bên A rút văn bản đồng ý (PL-03) mà không chuyển sang hồ sơ Vận hành; khi cơ quan có thẩm quyền yêu cầu.
2. Trong `[30]` ngày kể từ ngày chấm dứt [giả định GD-99], Bên A được xuất toàn bộ dữ liệu (gói tệp ZIP gồm dữ liệu và tệp đính kèm); Bên B hỗ trợ chuyển giao cho nhà cung cấp mới nếu Bên A yêu cầu.
3. Hết thời hạn ở khoản 2, Bên B xóa Dữ liệu của Nhà trường khỏi hệ thống đang chạy; bản sao lưu bị xóa theo vòng quay sao lưu, chậm nhất `[ ]` ngày [giả định: tối thiểu 30 ngày theo SL-01]; Bên B gửi biên bản xác nhận xóa. Bên B chỉ giữ lại dữ liệu pháp luật buộc phải lưu (ví dụ chứng từ kế toán của chính giao dịch giữa hai bên) và bằng chứng tuân thủ ở `school_consents`.
4. Với hồ sơ Thử nghiệm, Bên B đồng thời yêu cầu nhà cung cấp hạ tầng xóa dữ liệu, giữ biên bản (PL-10 bước 6).

## Điều 10. Trách nhiệm do vi phạm, bồi thường

1. Bên vi phạm bồi thường thiệt hại thực tế, trực tiếp cho bên kia theo quy định của pháp luật.
2. Tổng mức bồi thường của Bên B trong một năm không vượt quá `[ ]` [luật sư cân nhắc; không áp dụng giới hạn cho vi phạm do cố ý, cho thiệt hại về tính mạng, sức khỏe, và cho trách nhiệm không được giới hạn theo luật].
3. Phạt vi phạm: `[ ]` [luật sư cân nhắc theo Luật Thương mại].

## Điều 11. Bất khả kháng

Theo Bộ luật Dân sự; bên gặp sự kiện bất khả kháng thông báo cho bên kia trong `[3]` ngày làm việc. Sự cố của nhà cung cấp hạ tầng không tự động là bất khả kháng.

## Điều 12. Giải quyết tranh chấp

Hai bên thương lượng; không thành thì đưa ra `[Tòa án nhân dân có thẩm quyền tại ... hoặc Trung tâm trọng tài ...]`.

## Điều 13. Điều khoản chung

1. Hợp đồng gồm Phụ lục 1 (gói, phí), Phụ lục 2 (mức cam kết dịch vụ), PL-02, PL-08 và (nếu có) PL-03, PL-10.
2. Sửa đổi bằng văn bản có chữ ký hai bên hoặc chữ ký số.
3. Hợp đồng lập thành `[ ]` bản có giá trị như nhau, mỗi bên giữ `[ ]` bản; hoặc ký bằng chữ ký số.

| ĐẠI DIỆN BÊN A | ĐẠI DIỆN BÊN B |
|---|---|
| (Ký, ghi rõ họ tên, đóng dấu) | (Ký, ghi rõ họ tên, đóng dấu) |

---

## Phụ lục 1. Gói dịch vụ, phí, hồ sơ triển khai

| Mục | Nội dung |
|---|---|
| Gói | `[tên gói ở bảng plans]` |
| Phân hệ được bật | `[danh sách]` |
| Giới hạn | Học sinh đang học: `[ ]`; dung lượng tệp: `[ ]`; số cấp học: `[ ]` |
| Cách tính phí | `[theo học sinh / theo trường / theo phân hệ]`; đơn giá `[ ]`; phí tối thiểu `[ ]`; kỳ `[ ]` |
| Hồ sơ triển khai | `[Thử nghiệm / Vận hành]` |
| Phân loại dữ liệu | `[synthetic / consented / production]` |
| Đường dẫn | `[mã trường].[tên miền hệ thống]` hoặc `[tên miền riêng]` |

## Phụ lục 2. Mức cam kết dịch vụ

| Mục | Cam kết | Ghi chú |
|---|---|---|
| Thời gian hoạt động | Hồ sơ Vận hành: `[ ]`% mỗi tháng; hồ sơ Thử nghiệm: **không cam kết** | Hồ sơ Thử nghiệm dùng gói miễn phí, máy chủ có thể ngủ khi rảnh (khoảng 1 phút để thức dậy) |
| Sao lưu | Hằng ngày, giữ tối thiểu `[30]` ngày | PL-13 |
| Mục tiêu khôi phục | RPO `[ ]` giờ, RTO `[ ]` giờ | Theo kết quả đo của S7b |
| Hỗ trợ | Kênh `[ ]`, giờ `[ ]`, thời gian phản hồi `[ ]` | |
| Thông báo bảo trì | Trước `[ ]` giờ | |
