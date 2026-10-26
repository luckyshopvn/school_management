# PL-05. MẪU CHÍNH SÁCH BẢO VỆ DỮ LIỆU CÁ NHÂN

- Mã mẫu: PL-05; phiên bản mẫu: S8a-1.1 (2026-10-26; YCTD-225 thêm đăng nhập bằng nhà cung cấp định danh bên ngoài ở mục 2, mục 5), S8a-1.0 (2026-10-25); YCTD-200.
- Trạng thái: **bản nháp, cần luật sư rà trước khi dùng.**
- Hiển thị: trong ứng dụng (đường dẫn ở chân trang và ở màn đồng ý của PL-04) và trang công khai của nền tảng; có số phiên bản; đổi nội dung thì tăng phiên bản và hỏi đồng ý lại (S2).
- Căn cứ (đã đọc ngày 2026-10-25): Điều 4 (quyền của chủ thể dữ liệu), Điều 9 (điều kiện của sự đồng ý: biết loại dữ liệu, mục đích, bên kiểm soát, quyền và nghĩa vụ), Điều 10, Điều 20, Điều 24 Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15; Điều 4, Điều 6 Nghị định 356/2025/NĐ-CP.
- Chính sách này mô tả cách Nền tảng xử lý dữ liệu **thay mặt các trường**. Mỗi trường là bên kiểm soát dữ liệu của trường mình và có thể có thông báo riêng (PL-03 phần B).

---

**CHÍNH SÁCH BẢO VỆ DỮ LIỆU CÁ NHÂN `[TÊN SẢN PHẨM]`**
Phiên bản `[ ]`, áp dụng từ ngày `[ ]`

## 1. Ai chịu trách nhiệm về dữ liệu của bạn

- **Nhà trường** của bạn (tên hiện ở đầu trang sau khi đăng nhập) là **bên kiểm soát dữ liệu cá nhân**: quyết định mục đích, căn cứ xử lý, ai được xem.
- **`[Tên pháp nhân vận hành nền tảng]`** là **bên xử lý dữ liệu cá nhân**: vận hành phần mềm theo thỏa thuận với Nhà trường. Đầu mối bảo vệ dữ liệu cá nhân của Nền tảng: `[ ]`.

## 2. Dữ liệu được xử lý

Tùy phân hệ Nhà trường bật, gồm:
- **Học sinh**: họ tên, ngày sinh, giới tính, lớp, mã định danh của ngành giáo dục, số định danh cá nhân (được mã hóa), địa chỉ; điểm danh, đón trả; kết quả học tập, đánh giá; hình ảnh hoạt động; tình trạng sức khỏe, cân đo, dặn thuốc.
- **Cha mẹ, người giám hộ, người đưa đón**: họ tên, quan hệ với học sinh, số điện thoại, thư điện tử, ảnh người đưa đón, tài khoản ứng dụng.
- **Cán bộ, giáo viên, nhân viên**: hồ sơ nhân sự, bằng cấp, phân công, chấm công, nghỉ phép, lương, bảo hiểm, tài khoản ngân hàng nhận lương.
- **Dữ liệu kỹ thuật**: tài khoản đăng nhập, thời điểm đăng nhập, địa chỉ IP, nhật ký thao tác (để bảo mật và điều tra sự cố).
- **Đăng nhập bằng nhà cung cấp định danh bên ngoài** (ví dụ VNeID), chỉ khi Nhà trường bật và chính bạn liên kết tài khoản: Nền tảng chỉ lưu **mã liên kết** do nhà cung cấp trả (được mã hóa), cùng nhật ký liên kết và đăng nhập; **không lưu số định danh cá nhân, căn cước, họ tên hay ngày sinh** từ nhà cung cấp. Nền tảng không tự tạo tài khoản từ nhà cung cấp; bạn có thể gỡ liên kết bất cứ lúc nào trong mục "Tài khoản của tôi" và vẫn đăng nhập bằng mật khẩu như trước. Học sinh dưới 14 tuổi không tự đăng nhập bằng cách này.

**Dữ liệu cá nhân nhạy cảm** có thể gồm: tình trạng sức khỏe; hình ảnh thẻ căn cước (nếu Nhà trường tải lên); thông tin tài khoản ngân hàng; vị trí (nếu dùng tính năng có vị trí) — theo danh mục ở Điều 4 Nghị định 356/2025/NĐ-CP. Các dữ liệu này được giới hạn quyền truy cập.

## 3. Mục đích

Quản lý học sinh, lớp, sức khỏe, học phí, nhân sự, học tập và đánh giá; liên lạc giữa Nhà trường và gia đình; báo cáo theo yêu cầu của cơ quan quản lý giáo dục; bảo mật và vận hành phần mềm. Nền tảng **không** bán dữ liệu, **không** dùng để quảng cáo, **không** dùng để huấn luyện mô hình trí tuệ nhân tạo.

## 4. Dữ liệu của trẻ em

Cha mẹ hoặc người đại diện theo pháp luật thay mặt học sinh thực hiện các quyền ở mục 7. Việc công bố, tiết lộ thông tin đời sống riêng tư của trẻ em từ đủ 07 tuổi cần đồng ý của trẻ em và người đại diện theo pháp luật (khoản 2 Điều 24 Luật Bảo vệ dữ liệu cá nhân). Số định danh của học sinh được mã hóa bằng khóa riêng của từng trường.

## 5. Nơi lưu trữ và bên xử lý phụ

- Dữ liệu của mỗi trường được tách riêng.
- **Trợ lý AI (chỉ khi trường bật; bản nháp theo PL-22):** chỉ nội dung chương trình (cấp, khối, môn, chủ đề, yêu cầu cần đạt) được gửi cho nhà cung cấp AI; hệ thống không gửi dữ liệu cá nhân của học sinh, phụ huynh, cán bộ và chặn yêu cầu có thông tin đó. Nhật ký yêu cầu (người yêu cầu, loại, số token, mô hình; không lưu toàn văn lời nhắc) được giữ `[12]` tháng. Nhà cung cấp AI nằm trong danh sách ở PL-08 khi trường chọn cấu hình do nền tảng cấp khóa.
- Khi bạn đăng nhập bằng nhà cung cấp định danh bên ngoài, việc xác thực diễn ra trên hệ thống của nhà cung cấp đó (với VNeID là hệ thống định danh và xác thực điện tử, qua tổ chức cung cấp dịch vụ xác thực điện tử) theo quy định và điều khoản của nhà cung cấp; Nền tảng chỉ nhận lại kết quả xác thực và mã liên kết. `[luật sư rà vai trò của nhà cung cấp định danh trước khi bật ở trường thật]`
- Danh sách nhà cung cấp hạ tầng (bên xử lý phụ) và vùng máy chủ: `[đường dẫn tới danh sách công khai theo PL-08]`.
- **Môi trường thử nghiệm**: với trường đã đồng ý dùng thử, dữ liệu được lưu tạm thời trên máy chủ đặt ngoài Việt Nam (vùng `[Singapore]`), đây là chuyển dữ liệu cá nhân xuyên biên giới; Nhà trường và Nền tảng lập hồ sơ đánh giá tác động theo quy định và chuyển dữ liệu về máy chủ trong nước theo lộ trình đã thông báo.

## 6. Thời gian lưu trữ

Trong thời gian Nhà trường dùng phần mềm, và sau khi Nhà trường ngừng dùng thì theo hợp đồng (Nhà trường được xuất dữ liệu trong `[30]` ngày, sau đó dữ liệu bị xóa; bản sao lưu xóa theo vòng quay). Chi tiết ở chính sách lưu giữ và xóa (PL-13).

## 7. Quyền của bạn

Theo Điều 4 Luật Bảo vệ dữ liệu cá nhân, bạn có quyền: được biết về việc xử lý; đồng ý hoặc không đồng ý, yêu cầu rút lại sự đồng ý; xem, chỉnh sửa hoặc yêu cầu chỉnh sửa; yêu cầu cung cấp, xóa, hạn chế xử lý; phản đối xử lý; khiếu nại, tố cáo, khởi kiện, yêu cầu bồi thường; yêu cầu áp dụng biện pháp bảo vệ dữ liệu của mình. Một số quyền có giới hạn theo luật (ví dụ trường hợp xử lý không cần đồng ý ở Điều 19 Luật). Yêu cầu rút đồng ý, hạn chế xử lý gửi bằng văn bản hoặc dạng điện tử kiểm chứng được (khoản 2 Điều 10 Luật).

Cách gửi yêu cầu: qua Nhà trường `[đầu mối]` hoặc chức năng `[Hồ sơ cá nhân → Yêu cầu về dữ liệu]` [nếu S2 làm]. Nền tảng hỗ trợ Nhà trường trả lời trong thời hạn pháp luật quy định.

## 8. Bảo vệ dữ liệu

Kết nối mã hóa; tách dữ liệu từng trường; phân quyền theo vai trò; xác thực hai lớp cho tài khoản vận hành; mã hóa trường dữ liệu trẻ em; sao lưu mã hóa; ghi nhật ký; giám sát và quy trình xử lý sự cố, thông báo vi phạm trong thời hạn luật định.

## 9. Thay đổi chính sách

Phiên bản mới hiện trong ứng dụng, có ngày áp dụng; thay đổi quan trọng được thông báo và hỏi đồng ý lại.

## 10. Liên hệ

Nhà trường: `[ ]`. Đầu mối bảo vệ dữ liệu cá nhân của Nền tảng: `[ ]`.
