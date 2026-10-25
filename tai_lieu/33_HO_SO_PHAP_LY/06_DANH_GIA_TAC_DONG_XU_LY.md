# PL-06. MẪU HỒ SƠ ĐÁNH GIÁ TÁC ĐỘNG XỬ LÝ DỮ LIỆU CÁ NHÂN

- Mã mẫu: PL-06; phiên bản mẫu: S8a-1.0 (2026-10-25); YCTD-200. Bằng chứng: `school_consents` loại `impact-assessment`.
- Trạng thái: **bản nháp, cần luật sư rà trước khi dùng.** Báo cáo chính thức phải theo **Mẫu số 10** Phụ lục Nghị định 356/2025/NĐ-CP; Claude **chưa đọc** Mẫu số 10, nên phần dưới dựng theo nội dung bắt buộc ở thân Nghị định (khoản 3 Điều 19). Luật sư chép lại vào đúng Mẫu số 10 trước khi nộp.
- Căn cứ (đã đọc ngày 2026-10-25):
  - Điều 21 Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15: bên kiểm soát, bên kiểm soát và xử lý lập, lưu, **gửi 01 bản chính cho cơ quan chuyên trách bảo vệ dữ liệu cá nhân trong 60 ngày kể từ ngày đầu tiên xử lý**; làm 01 lần cho suốt thời gian hoạt động và cập nhật; **bên xử lý lập và lưu hồ sơ theo thỏa thuận với bên kiểm soát**.
  - Điều 19 Nghị định 356/2025/NĐ-CP: thành phần hồ sơ (báo cáo theo Mẫu số 10; bản sao hợp đồng, thỏa thuận xử lý; chính sách, quy trình, biểu mẫu bảo vệ dữ liệu); nộp kèm **Mẫu số 02a/02b**; cơ quan chuyên trách trả kết quả đạt hoặc không đạt trong 15 ngày; yêu cầu hoàn thiện trong 30 ngày nếu chưa đủ.
  - Điều 20 Nghị định 356/2025/NĐ-CP: cập nhật **định kỳ 06 tháng** kể từ lần đầu nộp khi phát sinh mục đích mới hoặc thay đổi các bên; cập nhật **trong 10 ngày** khi tổ chức lại, giải thể, thay đổi tổ chức cung cấp dịch vụ bảo vệ dữ liệu, thay đổi ngành nghề, dịch vụ đã đăng ký; theo **Mẫu số 03a/03b**.
  - Khoản 2 Điều 38 Luật, Điều 41 Nghị định: doanh nghiệp nhỏ, khởi nghiệp được chọn không làm Điều 21, 22 Luật trong 05 năm, **trừ** doanh nghiệp kinh doanh dịch vụ xử lý dữ liệu cá nhân, trực tiếp xử lý dữ liệu nhạy cảm hoặc xử lý từ 100 nghìn chủ thể. **Nền tảng không dựa vào miễn trừ này** (xử lý dữ liệu sức khỏe của trẻ em; có thể là dịch vụ xử lý dữ liệu, xem PL-15).
  - Khoản 6 Điều 21 Luật: cơ quan nhà nước có thẩm quyền không phải làm đánh giá tác động. **Trường công lập có thuộc "cơ quan nhà nước có thẩm quyền" hay không: luật sư xác định** (ảnh hưởng việc trường có phải nộp hồ sơ hay không).

## Cách dùng

1. **Bản của Nền tảng** (bên xử lý): Nền tảng lập một bản chung cho hoạt động vận hành phần mềm, lưu sẵn, cập nhật theo Điều 20 Nghị định; nộp khi bên kiểm soát yêu cầu theo thỏa thuận hoặc theo yêu cầu của cơ quan chuyên trách.
2. **Bản của Nhà trường** (bên kiểm soát): Nhà trường lập cho hoạt động xử lý của trường, phần kỹ thuật lấy từ bản của Nền tảng (mục 4, 5, 6 dưới đây); nộp trong 60 ngày kể từ ngày đầu tiên xử lý (với trường mới: ngày đầu tiên nhập dữ liệu thật).
3. Lưu bản đã nộp, ngày nộp, số tiếp nhận vào `school_consents` (`submitted_to_authority_on`, `authority_reference`).

---

**BÁO CÁO ĐÁNH GIÁ TÁC ĐỘNG XỬ LÝ DỮ LIỆU CÁ NHÂN**
(Dựng theo khoản 3 Điều 19 Nghị định 356/2025/NĐ-CP; chép vào Mẫu số 10 khi nộp)

Bên lập: `[Nhà trường / Nền tảng]`  Ngày lập: `[ ]`  Lần: `[lập lần đầu / cập nhật lần ...]`

## 1. Thông tin và liên lạc của các bên (điểm a)

| Vai trò | Tên | Địa chỉ | Mã số | Người đại diện | Liên lạc |
|---|---|---|---|---|---|
| Bên kiểm soát | `[tên trường]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Bên xử lý | `[tên pháp nhân vận hành nền tảng]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Bên xử lý phụ | Theo PL-08 | | | | |
| Bên thứ ba nhận dữ liệu | `[cơ quan quản lý giáo dục nhận báo cáo; ngân hàng, cổng thanh toán nếu bật; ...]` | | | | |

## 2. Bộ phận, nhân sự bảo vệ dữ liệu cá nhân (điểm b)

| Bên | Bộ phận hoặc người phụ trách | Văn bản chỉ định | Liên lạc | Tổ chức cung cấp dịch vụ bảo vệ dữ liệu (nếu có) |
|---|---|---|---|---|
| Nhà trường | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Nền tảng | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

Điều kiện nhân sự theo Điều 13 Nghị định 356/2025/NĐ-CP (cao đẳng trở lên, 02 năm kinh nghiệm ở lĩnh vực liên quan, đã được đào tạo về bảo vệ dữ liệu cá nhân).

## 3. Mục đích, loại dữ liệu, hoạt động xử lý, sơ đồ luồng (điểm c)

### 3.1 Mục đích và luận giải

| Mục đích | Phân hệ | Luận giải sự cần thiết |
|---|---|---|
| Quản lý hồ sơ học sinh, lớp | Hồ sơ trẻ, lớp | Thực hiện nhiệm vụ của nhà trường theo quy định ngành giáo dục |
| Điểm danh, đón trả | Điểm danh, đón trả | An toàn học sinh, thông tin cho gia đình |
| Chăm sóc sức khỏe | Sức khỏe, dặn thuốc | `[ ]` |
| Học phí, thu chi | Học phí, công nợ, phiếu thu | `[ ]` |
| Nhân sự, chấm công, lương | Nhân sự | `[ ]` |
| Học tập, đánh giá | Sổ điểm, nhận xét | `[ ]` |
| Liên lạc với gia đình | Ứng dụng phụ huynh, thông báo | `[ ]` |
| Báo cáo cơ quan quản lý | Báo cáo, xuất dữ liệu | `[ ]` |

### 3.2 Loại dữ liệu

Theo Phụ lục A của PL-02. Đánh dấu dữ liệu nhạy cảm theo Điều 4 Nghị định 356/2025/NĐ-CP.

### 3.3 Hoạt động xử lý

Thu thập (nhập tay, nhập tệp Excel, phụ huynh tự khai qua ứng dụng); lưu trữ; chỉnh sửa; tra cứu, tổng hợp; xuất báo cáo; gửi thông báo (thư điện tử, tin nhắn, ứng dụng); chuyển giao cho bên thứ ba ở mục 1; xóa, hủy khi hết thời hạn.

### 3.4 Sơ đồ luồng dữ liệu

```
Người dùng (trình duyệt, ứng dụng web)
   │ HTTPS
   ▼
Mạng biên [nhà cung cấp, chỉ chuyển tiếp]  ──►  Máy chủ ứng dụng [nhà cung cấp, vùng]
                                                   │            │
                                                   ▼            ▼
                                   Cơ sở dữ liệu của trường   Kho tệp của trường
                                   [nhà cung cấp, vùng]       [nhà cung cấp, vùng]
                                                   │
                                                   ▼
                                   Sao lưu mã hóa [nơi lưu, vùng]
Gửi ra ngoài (nếu bật): thư điện tử [ ], tin nhắn [ ], cổng thanh toán [ ], báo cáo cho cơ quan quản lý [ ]
```

[Thay bằng sơ đồ thật của hồ sơ triển khai đang dùng, lấy từ PL-08.]

## 4. Sự đồng ý; lưu trữ, xóa, hủy (điểm d)

- Căn cứ xử lý theo từng mục đích (đồng ý của chủ thể hoặc người đại diện; trường hợp không cần đồng ý theo Điều 19 Luật): `[Nhà trường điền]`.
- Phương thức xin và lưu đồng ý (Điều 6 Nghị định 356/2025/NĐ-CP): `[văn bản / ứng dụng có thiết lập kỹ thuật xin đồng ý / ...]`; nơi lưu bằng chứng: `[ ]`.
- Thời hạn lưu trữ, cách xóa, hủy: theo PL-13.

## 5. Phương án bảo đảm an toàn, biện pháp bảo vệ, sơ đồ thiết kế hệ thống, tiêu chuẩn áp dụng (điểm đ)

- Biện pháp: theo Điều 6 của PL-02 (tách dữ liệu từng trường, mã hóa khi truyền và khi lưu, mã hóa trường dữ liệu trẻ em bằng khóa riêng của trường theo PL-14, phân quyền, xác thực hai lớp cho vận hành, nhật ký, sao lưu, giám sát, quy trình sự cố PL-12).
- Sơ đồ thiết kế hệ thống: `[đính kèm từ tài liệu kiến trúc 12_KIEN_TRUC_HE_THONG.md và kế hoạch 14.4]`.
- Tiêu chuẩn, quy chuẩn áp dụng: `[luật sư, chuyên gia bổ sung tiêu chuẩn quốc gia về an ninh mạng, bảo vệ dữ liệu cá nhân hiện hành]`.
- Cấp độ hệ thống thông tin đề xuất: theo PL-11.

## 6. Kết quả đánh giá tuân thủ (điểm e)

| Yêu cầu | Đáp ứng? | Bằng chứng |
|---|---|---|
| Có thỏa thuận xử lý dữ liệu giữa bên kiểm soát và bên xử lý (khoản 2 Điều 37 Luật) | `[ ]` | PL-02 đã ký |
| Có căn cứ xử lý cho từng mục đích | `[ ]` | |
| Chủ thể dữ liệu được thông báo (Điều 9 Luật) | `[ ]` | PL-03 phần B, PL-05 |
| Thực hiện được các quyền của chủ thể dữ liệu (Điều 4 Luật) | `[ ]` | Chức năng phần mềm, quy trình |
| Có nhân sự hoặc bộ phận bảo vệ dữ liệu đủ điều kiện (Điều 13 Nghị định) | `[ ]` | |
| Có quy trình thông báo vi phạm trong 72 giờ (Điều 23 Luật) | `[ ]` | PL-12 |
| Dữ liệu trên điện toán đám mây được mã hóa khi nghỉ và khi truyền, phân quyền nghiêm ngặt (khoản 4 Điều 12 Nghị định) | `[ ]` | Bằng chứng cấu hình nhà cung cấp |
| Có hồ sơ chuyển dữ liệu xuyên biên giới nếu máy chủ ngoài Việt Nam (Điều 20 Luật) | `[ ]` | PL-07 |

## 7. Đánh giá ảnh hưởng, rủi ro; hậu quả có thể xảy ra; biện pháp giảm thiểu (điểm g)

| Rủi ro | Khả năng | Mức ảnh hưởng | Biện pháp giảm thiểu | Rủi ro còn lại |
|---|---|---|---|---|
| Lộ dữ liệu của một trường sang trường khác | `[ ]` | Cao | Tách cơ sở dữ liệu hoặc lược đồ; kiểm thử cách ly (kế hoạch 14.7); đóng chặt khi thiếu ngữ cảnh trường | `[ ]` |
| Tài khoản người dùng bị chiếm | `[ ]` | `[ ]` | Giới hạn đăng nhập sai, mã xác nhận, nhật ký | `[ ]` |
| Nhân sự nền tảng truy cập dữ liệu không cần thiết | `[ ]` | `[ ]` | Phân quyền tối thiểu, xác thực hai lớp, nhật ký truy cập | `[ ]` |
| Nhà cung cấp hạ tầng ở nước ngoài bị yêu cầu cung cấp hoặc bị xâm nhập | `[ ]` | Cao | Mã hóa trường dữ liệu trẻ em bằng khóa riêng, khóa gốc không ở nhà cung cấp cơ sở dữ liệu; dữ liệu còn lại vẫn dạng rõ | `[ ]` |
| Mất dữ liệu | `[ ]` | `[ ]` | Sao lưu mã hóa ra ngoài, thử khôi phục | `[ ]` |
| Vi phạm quy định lưu trữ trong nước | `[ ]` | `[ ]` | Phiếu PL-09, lộ trình PL-10 | `[ ]` |
| Dữ liệu sức khỏe, hình ảnh trẻ em bị dùng sai mục đích | `[ ]` | Cao | Phân quyền theo lớp, theo vai trò; không công bố khi chưa có đồng ý | `[ ]` |

Người lập: `[ ]`  Người đứng đầu bên lập: `[ ]` (ký, đóng dấu)

## Danh mục hồ sơ nộp kèm

1. Báo cáo theo Mẫu số 10 (chép từ trên).
2. Bản sao PL-02 đã ký (điểm b khoản 2 Điều 19 Nghị định).
3. Chính sách, quy trình, biểu mẫu: PL-05, PL-12, PL-13, PL-14 và quy định nội bộ của bên lập (điểm c khoản 2 Điều 19 Nghị định).
4. Văn bản đề nghị theo Mẫu số 02a hoặc 02b.
