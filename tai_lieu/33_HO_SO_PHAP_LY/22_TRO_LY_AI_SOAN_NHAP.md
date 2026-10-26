# PL-22. BẢN NHÁP: TRỢ LÝ AI SOẠN CÂU HỎI VÀ KẾ HOẠCH BÀI DẠY (DT-23 phần 23d)

- Mã mẫu: PL-22; phiên bản: 23d-1.0 (2026-10-26); YCTD-214 (`24_YEU_CAU_THAY_DOI.md`); kế hoạch ở `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 15, quyết định GD-102 đến GD-104.
- Trạng thái: **bản nháp do Claude soạn để luật sư của Eric rà; không phải tư vấn pháp lý.** Không bật AI ở trường thật khi luật sư chưa rà phần này (phần mềm tắt AI mặc định theo trường).
- Phạm vi: tính năng AI chỉ **soạn bản nháp** câu hỏi kiểm tra và kế hoạch bài dạy từ **nội dung chương trình**; không chấm điểm, không nhận xét học sinh, không dự đoán, không tuyển sinh, không trả lời học sinh, **không nhận dữ liệu cá nhân**.

## 1. Văn bản căn cứ đã đọc (ngày 2026-10-26)

| Văn bản | Đã đọc đến đâu | Điều dùng ở bản nháp này |
|---|---|---|
| Luật Trí tuệ nhân tạo số 134/2025/QH15 (Quốc hội thông qua 10/12/2025; hiệu lực 01/03/2026, Điều 34) | **Toàn văn** (bản Word đăng ở `luatvietnam.vn`, đối chiếu mục lục ở `thuvienphapluat.vn`) | Điều 3 (bên triển khai, người sử dụng), Điều 4 (con người kiểm soát), Điều 7 khoản 2 điểm c và khoản 3 (cấm lợi dụng điểm yếu của trẻ em; cấm xử lý dữ liệu trái pháp luật về dữ liệu cá nhân), Điều 9 (ba mức rủi ro), Điều 11 (minh bạch), Điều 15 (rủi ro trung bình, thấp), Điều 35 (chuyển tiếp: giáo dục 18 tháng cho hệ thống đã vận hành) |
| Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15; Nghị định 356/2025/NĐ-CP | Như bộ mẫu (`00_MUC_LUC.md` mục 4); chưa đọc các mẫu ở Phụ lục | Điều 20 Luật (chuyển dữ liệu ra nước ngoài), Điều 21 (đánh giá tác động), Điều 24 (trẻ em), Điều 37 (bên xử lý); Điều 17 đến 19 Nghị định |
| Nghị định 142/2026/NĐ-CP hướng dẫn Luật Trí tuệ nhân tạo (30/04/2026) | **Chỉ thuộc tính và tóm tắt** (`thuviennhadat.vn`); chưa đọc toàn văn | Điều 8 (tiêu chí và trường hợp loại trừ rủi ro cao) chỉ qua dẫn chiếu |
| Quyết định 33/2026/QĐ-TTg danh mục hệ thống trí tuệ nhân tạo rủi ro cao (hiệu lực 15/08/2026) | **Chỉ tóm tắt** của báo chính thống; có lĩnh vực **giáo dục** nhưng **chưa đọc phụ lục** nên chưa biết trường hợp cụ thể | Điều 4: hệ thống giáo dục đã vận hành trước 15/08/2026 tuân thủ chậm nhất 01/09/2027 |
| Luật Bảo vệ trẻ em 2016 (quy định về bí mật đời sống riêng tư của trẻ em) | **Chưa tra lại** trong lần này | Luật sư kiểm |

## 2. Phân tích sơ bộ (để luật sư xác nhận hoặc bác)

1. **Vai trò theo Luật 134/2025.** Nhà trường dùng tính năng là **bên triển khai** (khoản 5 Điều 3), giáo viên là **người sử dụng** (khoản 6); nhà cung cấp mô hình là nhà cung cấp hoặc nhà phát triển của hệ thống AI; nền tảng School Management là bên tích hợp (có thể là **nhà cung cấp** theo khoản 4 Điều 3 vì đưa vào sử dụng dưới tên của mình; luật sư xác định).
2. **Mức rủi ro (Điều 9).** Tính năng chỉ soạn nháp, người duyệt, không ra quyết định về học sinh, không đánh giá năng lực: **dự kiến rủi ro thấp**; nếu coi nội dung do AI tạo ra có thể gây nhầm lẫn cho người dùng về nguồn thì **trung bình** (Điều 11, 15). Cách làm giảm rủi ro đã đưa vào phần mềm: mọi bản nháp ghi rõ "do AI soạn, cần giáo viên kiểm tra", đi qua duyệt của người khác, không tự trừ điểm hay chấm. **Cần luật sư đối chiếu phụ lục Quyết định 33/2026/QĐ-TTg (lĩnh vực giáo dục) và Điều 8 Nghị định 142/2026/NĐ-CP** trước khi kết luận không thuộc danh mục rủi ro cao.
3. **Con người kiểm soát (Điều 4, khoản 4 Điều 7).** Bản nháp không dùng được trong đề thi trước khi người thẩm định khác duyệt; kế hoạch bài dạy ở trạng thái nháp riêng tư, qua kiểm duyệt của kho học liệu trước khi chia sẻ; người yêu cầu AI không tự duyệt câu mình yêu cầu.
4. **Dữ liệu cá nhân (khoản 3 Điều 7 Luật 134/2025; Luật 91/2025).** Máy chủ dựng lời nhắc từ mẫu cố định chỉ có cấp, khối, môn, chủ đề, yêu cầu cần đạt, mức nhận thức, dạng câu, số câu và mô tả thêm của giáo viên; mô tả thêm bị quét số điện thoại, thư điện tử, số định danh, mã học sinh và **họ tên đầy đủ có trong danh sách học sinh, phụ huynh, cán bộ của trường** (so ở máy chủ). Thấy thì từ chối, không gửi. **Giới hạn đã biết:** quét theo mẫu và danh sách không bắt được mọi trường hợp (tên viết tắt, tên một chữ, thông tin định danh gián tiếp trong câu văn); biện pháp còn lại là giao diện cảnh báo, giới hạn độ dài và hướng dẫn giáo viên. Vì vậy hồ sơ vẫn ghi rủi ro dữ liệu cá nhân lọt vào lời nhắc ở mức thấp còn lại.
5. **Chuyển dữ liệu ra nước ngoài (Điều 20 Luật 91/2025).** Nếu nhà cung cấp AI đặt máy chủ ngoài Việt Nam và lời nhắc **không chứa dữ liệu cá nhân** thì dự kiến **không phát sinh chuyển dữ liệu cá nhân ra nước ngoài**; tuy nhiên đề nghị vẫn ghi vào hồ sơ đánh giá tác động (PL-06, PL-07) để luật sư kết luận, nhất là khi rủi ro ở khoản 4 xảy ra. Tên, địa chỉ nhà cung cấp, vùng máy chủ, điều khoản không dùng dữ liệu để huấn luyện: ghi ở PL-08 khi Eric chốt nhà cung cấp; ưu tiên gói dịch vụ có cam kết không dùng dữ liệu khách hàng để huấn luyện và thời hạn lưu tối thiểu.
6. **Trẻ em (Điều 24 Luật 91/2025; điểm c khoản 2 Điều 7 Luật 134/2025).** Tính năng không nhận dữ liệu của trẻ em và không tương tác với trẻ em; không dùng thông tin về trẻ em để soạn nội dung nhắm vào điểm yếu của trẻ.
7. **Minh bạch (Điều 11 Luật 134/2025).** Người dùng nhận biết khi dùng AI (nút "Soạn nháp bằng AI", dấu "do AI soạn"); nội dung văn bản do AI soạn dùng nội bộ nhà trường, **chưa công bố ra công cộng**; nếu nhà trường công bố ra công cộng (website, tài liệu phát hành) thì tự chịu trách nhiệm thông báo khi nội dung có khả năng gây nhầm lẫn (khoản 3 Điều 11). Luật sư xác định có cần gắn nhãn cụ thể theo Nghị định 142/2026/NĐ-CP hay không.
8. **Bản quyền.** Nội dung AI soạn có thể trùng nội dung có bản quyền; giấy phép và nguồn của học liệu theo quy định của kho học liệu (22h1); giáo viên chịu trách nhiệm kiểm tra. Luật sư xác định quyền tác giả đối với đầu ra của AI và điều khoản của nhà cung cấp.
9. **Hai cấu hình khóa (GD-102).** Cấu hình `school`: nhà trường tự ký hợp đồng và nhập khóa với nhà cung cấp AI, tự trả phí, nhà trường là bên đưa dữ liệu (nội dung chương trình) cho nhà cung cấp; nền tảng chỉ chuyển tiếp qua máy chủ API. Cấu hình `platform`: nền tảng ký với nhà cung cấp, là bên xử lý phụ của nhà trường theo PL-02 Điều 7; **nhà cung cấp AI phải có tên trong PL-08**, trường được báo trước 30 ngày khi thêm hoặc đổi, có quyền phản đối. Thu phí theo token là thành phần của hóa đơn dịch vụ (PL-01).
10. **Nhật ký (GD-104).** Nhật ký yêu cầu giữ 12 tháng (cấu hình 1 đến 120 tháng): người yêu cầu, loại, môn, khối, chủ đề, số token, nhà cung cấp, mô hình, kết quả; **không lưu toàn văn lời nhắc**, chỉ mã băm. Có tên người dùng nên là dữ liệu cá nhân của cán bộ: ghi vào PL-13 (thời hạn giữ) và PL-06 (loại dữ liệu).

## 3. Câu thông báo cho quản trị trường khi bật AI (hiện ở màn hình Trợ lý AI, phải tích đã đọc)

> Khi bật, giáo viên có quyền soạn câu hỏi hoặc dùng kho học liệu có thể nhờ trợ lý AI soạn bản nháp. Chỉ nội dung chương trình được gửi cho nhà cung cấp AI (một bên xử lý bên ngoài nhà trường, có thể đặt máy chủ ở nước ngoài); hệ thống không gửi họ tên, số điện thoại, thư điện tử, số định danh, bài làm, điểm, nhận xét hay ảnh của học sinh, phụ huynh, cán bộ, và chặn yêu cầu có các thông tin đó. Nhà trường chịu trách nhiệm cho giáo viên biết điều này, và kiểm tra nội dung AI soạn (đúng chuyên môn, không chép nội dung có bản quyền) trước khi dùng.

## 4. Câu thông báo cho giáo viên (hiện ở hộp Soạn nháp bằng AI)

> Trợ lý AI chỉ nhận nội dung chương trình (cấp, khối, môn, chủ đề, yêu cầu cần đạt, mức nhận thức) và không bao giờ nhận dữ liệu cá nhân của học sinh, phụ huynh, cán bộ: không nhập họ tên, số điện thoại, thư điện tử, số định danh. Kết quả luôn là bản nháp do AI soạn, cần giáo viên kiểm tra và đi qua duyệt trước khi dùng.

## 5. Đoạn đề nghị chèn vào các mẫu khác khi luật sư đồng ý

- **PL-02 Điều 7 và Phụ lục B:** thêm dòng bên xử lý phụ "Nhà cung cấp AI `[ ]`, vùng `[ ]`, chỉ nhận nội dung chương trình, không nhận dữ liệu cá nhân, không dùng để huấn luyện (nếu nhà cung cấp cho chọn)" và áp dụng khi nhà trường chọn cấu hình `platform`.
- **PL-04 mục 3 (việc không được làm):** không nhập dữ liệu cá nhân vào mô tả gửi cho trợ lý AI; không dùng kết quả AI làm điểm hay nhận xét về học sinh; không công bố nội dung AI soạn khi chưa kiểm tra.
- **PL-05 mục 5:** nêu nhà cung cấp AI là bên xử lý phụ (nếu có) và nói rõ chỉ nội dung chương trình được gửi.
- **PL-06 mục 3, PL-07 mục 3 và 9:** thêm hoạt động "soạn nháp bằng AI", loại dữ liệu "nội dung chương trình, tên người yêu cầu ở nhật ký", rủi ro "dữ liệu cá nhân lọt vào mô tả" và biện pháp quét, từ chối, tắt mặc định.
- **PL-08:** thêm dòng dịch vụ "Trợ lý AI" (`subprocessor`, lưu dữ liệu cá nhân: không theo thiết kế; vùng, thời hạn lưu: theo nhà cung cấp).
- **PL-13:** thêm "nhật ký yêu cầu AI giữ 12 tháng".

## 6. Việc luật sư cần quyết (còn mở)

1. Kết luận mức rủi ro (thấp, trung bình hay thuộc danh mục rủi ro cao ở lĩnh vực giáo dục) sau khi đọc phụ lục Quyết định 33/2026/QĐ-TTg và Nghị định 142/2026/NĐ-CP; nghĩa vụ thông báo, gắn nhãn, giải trình, thời hạn chuyển tiếp (Điều 35 Luật 134/2025).
2. Có phát sinh chuyển dữ liệu cá nhân ra nước ngoài khi mô tả của giáo viên lỡ chứa dữ liệu cá nhân vượt qua bộ quét hay không, và cách ghi vào PL-07.
3. Tư cách của nền tảng (nhà cung cấp, bên xử lý phụ, bên kiểm soát độc lập) ở cấu hình `platform`; tư cách của nhà trường ở cấu hình `school`.
4. Điều khoản bắt buộc với nhà cung cấp AI (không huấn luyện bằng dữ liệu, thời hạn lưu, vùng máy chủ, thông báo vi phạm).
5. Quyền tác giả đối với đầu ra của AI và trách nhiệm khi trùng nội dung có bản quyền.
6. Văn bản chuyên ngành giáo dục của Bộ Giáo dục và Đào tạo về dùng trí tuệ nhân tạo trong dạy học, kiểm tra (nếu có) chưa tra ở lần này.
