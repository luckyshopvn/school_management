# YCTD-392: Bản nháp bổ sung hồ sơ pháp lý cho tài khoản dùng chung

Ngày 2026-10-30. Lát E0 của YCTD-392 (đặc tả `DAC_TA.md` cùng thư mục).

**Bản nháp do Claude soạn để làm việc với luật sư, không phải tư vấn pháp lý.** Căn cứ chỉ dẫn những điều đã đọc trong bộ hồ sơ pháp lý của dự án (`tai_lieu/48_HO_SO_PHAP_LY/00_MUC_LUC.md` mục 4); điểm chưa xác minh ghi rõ. Các đoạn dưới đây chưa đưa vào mẫu PL ở `tai_lieu/48_HO_SO_PHAP_LY/`. Luật sư rà xong thì đưa vào mẫu bằng YCTD mới và tăng phiên bản bộ mẫu.

Điều kiện Eric đặt (M3, ngày 2026-10-30): làm mã ngay, nhưng **chỉ nhận số định danh thật** cho tài khoản chung sau khi có PL-07 phần nền tảng và PL-09 bổ sung do Eric ký.

## 1. Thay đổi về vai trò

| Hoạt động | Trước YCTD-392 | Sau YCTD-392 |
|---|---|---|
| Tài khoản, vai trò, quyền ở từng trường | Trường kiểm soát, nền tảng xử lý | Không đổi |
| Danh tính chung: số định danh, số điện thoại đã xác minh, mật khẩu, xác thực hai lớp, phiên, nhật ký, danh sách trường đã liên kết | Không có | **Nền tảng kiểm soát** (nền tảng tự quyết mục đích: một tài khoản cho nhiều trường) |
| Đọc vai trò, danh sách con trong ngữ cảnh trường để hiện cho người dùng | Không có | Trường kiểm soát, nền tảng xử lý theo chỉ dẫn (thỏa thuận PL-02) |
| Trường gửi băm số định danh khi tạo tài khoản (gợi ý liên kết) | Không có | Chuyển giao giữa hai bên kiểm soát (Điều 7 Nghị định 356/2025/NĐ-CP) |

## 2. Đoạn bổ sung đề xuất

### 2.1. PL-02 Thỏa thuận xử lý dữ liệu (thêm Điều 5b)

> **Điều 5b. Tài khoản dùng chung trên nền tảng**
>
> 1. Nền tảng cung cấp tài khoản dùng chung để một người dùng đăng nhập vào nhiều trường. Đối với dữ liệu của tài khoản dùng chung (số định danh, số điện thoại đã xác minh, mật khẩu, yếu tố xác thực, phiên, nhật ký, danh sách trường đã liên kết), Nền tảng là bên kiểm soát dữ liệu cá nhân và tự chịu trách nhiệm về căn cứ xử lý.
> 2. Vai trò, quyền, quan hệ phụ huynh và học sinh, và mọi dữ liệu khác của Nhà trường vẫn do Nhà trường kiểm soát. Nền tảng chỉ đọc các dữ liệu đó trong ngữ cảnh của Nhà trường, theo chỉ dẫn tại khoản này, để hiện cho chính người dùng đã liên kết, không lưu lại.
> 3. Khi Nhà trường tạo tài khoản có số định danh, phần mềm gửi cho Nền tảng bản băm có khóa của số định danh để gợi ý liên kết. Nền tảng chỉ giữ bản băm khi đã có tài khoản dùng chung khớp và hủy ngay trong trường hợp khác. Hai bên coi khoản này là thỏa thuận chuyển giao dữ liệu cá nhân theo Điều 7 Nghị định 356/2025/NĐ-CP. `[ ]` (luật sư bổ sung nội dung bắt buộc của Điều 7 chưa có ở đây)
> 4. Nhà trường có thể tắt việc nhận đăng nhập bằng tài khoản dùng chung trong phần mềm; khi tắt, khoản 3 không áp dụng.

### 2.2. PL-04 Điều khoản sử dụng (thêm mục cho tài khoản dùng chung)

> 1. Tài khoản dùng chung do Nền tảng cung cấp, dùng để đăng nhập vào các trường đã cấp tài khoản cho bạn. Quyền của bạn ở mỗi trường do trường đó quyết định.
> 2. Bạn khai số định danh cá nhân của chính mình. Không khai số của người khác. Nền tảng có thể khóa tài khoản khai sai.
> 3. Mật khẩu tối thiểu 10 ký tự; người có vai trò nhân viên ở bất kỳ trường nào phải bật xác thực hai lớp.
> 4. Học sinh dưới 18 tuổi kích hoạt tài khoản khi cha mẹ hoặc người giám hộ xác nhận.
> 5. Bạn gỡ trường hoặc xóa tài khoản dùng chung bất cứ lúc nào; tài khoản ở trường không bị xóa.

### 2.3. PL-05 Chính sách bảo vệ dữ liệu cá nhân (thêm mục)

> **Tài khoản dùng chung**
>
> - Bên kiểm soát: Nền tảng `[tên pháp nhân]`.
> - Dữ liệu: số định danh cá nhân (mã hóa, chỉ hiện bốn số cuối), số điện thoại, họ tên hiển thị, mật khẩu (dạng băm), yếu tố xác thực hai lớp, thiết bị đã dùng, nhật ký đăng nhập, danh sách trường đã liên kết.
> - Mục đích: đăng nhập một lần vào các trường đã cấp tài khoản; bảo vệ tài khoản.
> - Căn cứ: sự đồng ý của bạn khi kích hoạt (Điều 9 Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15); với học sinh dưới 18 tuổi, đồng ý của cả học sinh và cha mẹ hoặc người giám hộ (khoản 2 Điều 24).
> - Không thu thập: điểm, sức khỏe, học phí, dữ liệu học tập; các dữ liệu này ở lại từng trường.
> - Lưu giữ: đến khi bạn xóa tài khoản dùng chung, cộng 30 ngày chờ; nhật ký theo PL-13.
> - Nơi lưu: `[vùng máy chủ của cơ sở dữ liệu nền tảng theo PL-08]`.
> - Quyền của bạn: xem, sửa số điện thoại, gỡ trường, rút đồng ý bằng cách xóa tài khoản dùng chung; liên hệ đầu mối ở Phụ lục C của PL-02.

### 2.4. PL-06 Đánh giá tác động (phần của nền tảng, thêm hoạt động)

| Mục | Nội dung |
|---|---|
| Hoạt động | Tài khoản dùng chung (YCTD-392) |
| Chủ thể | Nhân viên, giáo viên, phụ huynh, học sinh THCS, THPT của các trường dùng nền tảng |
| Dữ liệu | Như mục 2.3; số định danh của trẻ em 11 đến 18 tuổi |
| Rủi ro mới | (1) Lộ cơ sở dữ liệu nền tảng cùng khóa gốc cho biết số định danh của người dùng và các trường họ có tài khoản. (2) Một tài khoản bị chiếm mở được nhiều trường. (3) Khai số định danh của người khác. (4) Dò trường đang dùng nền tảng bằng số định danh |
| Biện pháp | Mã hóa và băm có khóa, khóa ngoài cơ sở dữ liệu; hai lớp bắt buộc với nhân viên; mã một lần khi vào trường trên thiết bị mới; liên kết cần thêm mã một lần tới số điện thoại trường ghi; câu báo chung và giới hạn tần suất; nhật ký hai phía (BM-250 đến BM-256 ở `22_BAO_MAT.md`) |
| Căn cứ đánh giá | Khoản 3 Điều 21 Luật 91/2025/QH15; nội dung hồ sơ theo khoản 3 Điều 19 Nghị định 356/2025/NĐ-CP (chưa đối chiếu Mẫu số ở Phụ lục) |

### 2.5. PL-07 Đánh giá tác động chuyển xuyên biên giới (phần của nền tảng)

Eric chọn bật tài khoản dùng chung cả khi cơ sở dữ liệu nền tảng ở máy chủ ngoài Việt Nam (D7). Khi đó Nền tảng là bên chuyển dữ liệu xuyên biên giới với dữ liệu tài khoản dùng chung (khoản 1 Điều 20 Luật 91/2025/QH15; điểm a khoản 1 Điều 17 Nghị định 356/2025/NĐ-CP). Cần lập hồ sơ riêng của Nền tảng theo PL-07, gồm số định danh của trẻ em. `[ ]` (luật sư xác nhận thời hạn nộp và cơ quan tiếp nhận)

### 2.6. PL-09 Phiếu chấp nhận rủi ro (bổ sung)

Thêm một dòng rủi ro: "Nền tảng lưu số định danh của người dùng, kể cả học sinh dưới 18 tuổi, ở máy chủ ngoài Việt Nam cho tài khoản dùng chung", biện pháp giảm thiểu như mục 2.4, thời hạn chấp nhận `[ ]`, Eric ký. Chưa ký thì phần mềm không nhận số định danh thật cho tài khoản dùng chung (điều kiện M3).

### 2.7. PL-14 Hướng dẫn mã hóa dữ liệu trẻ em (bổ sung)

Số định danh của học sinh THCS, THPT đã kích hoạt tài khoản dùng chung có thêm một bản ở cơ sở dữ liệu nền tảng: mã hóa bằng khóa mã hóa của nền tảng, băm bằng khóa băm của nền tảng, bốn số cuối dạng rõ. Hai khóa bọc bằng khóa gốc, không lưu cùng nhà cung cấp cơ sở dữ liệu. Bản ở trường (khóa của trường) giữ nguyên.

## 3. Câu hỏi cho luật sư

| Số | Câu hỏi |
|---|---|
| LS-1 | Căn cứ xử lý số định danh cho tài khoản dùng chung: đồng ý (Điều 9) có đủ không, hay dùng được trường hợp không cần đồng ý ở Điều 19 Luật 91/2025/QH15 (điểm nào)? |
| LS-2 | Số định danh cá nhân có thuộc danh mục dữ liệu cá nhân nhạy cảm ở Điều 4 Nghị định 356/2025/NĐ-CP không? Nếu có, biện pháp thêm nào bắt buộc? |
| LS-3 | Khoản 3 Điều 5b (trường gửi băm số định danh để gợi ý) có cần thỏa thuận riêng theo Điều 7 Nghị định 356/2025/NĐ-CP với từng trường, hay điều khoản trong PL-02 là đủ? Bản băm có khóa còn là dữ liệu cá nhân không? |
| LS-4 | Học sinh THCS, THPT: cách ghi nhận đồng ý kép (học sinh và cha mẹ) bằng mã một lần gửi tới số của cha mẹ có đủ không? |
| LS-5 | Thời hạn, cơ quan tiếp nhận hồ sơ PL-06, PL-07 phần của nền tảng khi bật tài khoản dùng chung ở máy chủ ngoài nước |
| LS-6 | Việc thêm vai trò bên kiểm soát có làm thay đổi kết luận ở PL-15 (điều kiện kinh doanh dịch vụ xử lý dữ liệu cá nhân) không? |
