# YCTD-395: Ứng dụng giáo viên có giao diện trên máy tính

- Mô tả: Đặc tả công việc thêm bố cục máy tính (từ 1024 điểm ảnh) cho ứng dụng giáo viên: thanh bên, nội dung rộng; điện thoại giữ như hiện nay. Danh sách lát, tiêu chí nghiệm thu dự kiến.
- Ngày: 2026-10-31
- Mức: **Lớn** (đổi bố cục toàn ứng dụng giáo viên, khoảng 36 màn hình; thêm thành phần dùng chung ở `packages/ui` cho ba ứng dụng). Không đổi dữ liệu, API, phân quyền.
- Trạng thái: Chờ Eric duyệt bản mẫu, danh sách lát và các câu hỏi ở mục 8
- Bản mẫu: `index.html` cùng thư mục (bốn màn hình, ba khổ 1366, 1024, 390, sáu trạng thái, hai phương án màu khung)

Ký hiệu nguồn: **[Mã]** đọc từ mã nguồn; **[Tài liệu]** từ tài liệu đã duyệt; **[Đề xuất]** chưa có, cần Eric duyệt.

## 1. Yêu cầu

Eric ngày 2026-10-31: "ứng dụng giáo viên cần cả giao diện trên máy tính". Điều phối viên chụp màn hình nghiệm thu Ca trực giám thị, ghi nhận vi phạm trên khổ rộng: chỉ một cột hẹp ở giữa, hai bên bỏ trống.

## 2. Hiện trạng

1. Ứng dụng giáo viên không có đường dẫn theo màn hình. `Application.tsx` giữ màn đang mở trong trạng thái (`opened`), mỗi màn có nút "Quay lại" về trang chủ (MG-01). [Mã]
2. Mỗi màn tự vẽ `ApplicationHeader` (thanh trắng "Ứng dụng giáo viên") và vùng nội dung `mx-auto max-w-md` (448 điểm ảnh), một số màn mở tới `md:max-w-3xl` (768). Trên màn hình 1366 điểm ảnh, nội dung chiếm 448 đến 768 điểm ảnh ở giữa. [Mã]
3. Trang chủ MG-01 đã có hai cột từ 1024 (thông báo, chấm công bên trái; lớp bên phải) nhưng các chức năng vẫn là cột khoảng 20 nút giống nhau. [Mã]
4. `packages/ui` chưa có khung có thanh bên. Thanh bên của cổng quản trị nằm trong `apps/portal/src/pages/AppShell.tsx`, gắn với bộ định tuyến, phân hệ và menu đánh số, phong cách hành chính nền xanh đậm; không dùng lại nguyên được cho ứng dụng giáo viên. [Mã]
5. Tài liệu `15` đã duyệt cho ứng dụng theo vai (YCTD-384, Eric duyệt ngày 2026-10-30): KC-09 "dưới 1024 điểm ảnh có thanh dưới 4 đến 5 mục; từ 1024 thanh dưới thành thanh bên trắng 240 điểm ảnh"; TD-21 khung theo vai đặt ở `packages/ui`; BC-02 ở tài liệu `14`. Lát L7 của YCTD-384 (khung TD-21, thanh dưới, trang chủ lối tắt, màu theo vai cho ứng dụng giáo viên) chưa làm. [Tài liệu]

## 3. Quan hệ với YCTD-384 lát L7

YCTD-395 làm phần "từ 1024 điểm ảnh" của L7 trước, theo KC-09 và TD-21 đã duyệt: thanh bên trắng 240 điểm ảnh, nội dung rộng. Phần điện thoại của L7 (thanh dưới, ô lối tắt, màu theo vai) giữ ở YCTD-384 L7, làm sau. Như vậy:

- Dưới 1024 điểm ảnh (điện thoại, máy tính bảng dọc): giữ y như hiện nay.
- Thành phần khung xây một lần ở `packages/ui`; L7, L8 (phụ huynh), L9 (học sinh) dùng lại và thêm phần thanh dưới.

Eric chọn ở câu Q-395-1.

## 4. Giải pháp

### 4.1 Khung máy tính

| Vùng | Từ 1024 điểm ảnh | Dưới 1024 điểm ảnh |
|---|---|---|
| Thanh bên | Trắng, rộng 240 điểm ảnh, dính khi cuộn, cuộn riêng khi dài: tên ứng dụng, tên trường; Trang chủ; ô chọn lớp và chức năng của lớp đang chọn; nhóm Giảng dạy, Rèn luyện, Cá nhân, Cổng trường; Đăng xuất ở chân | Không có |
| Thanh đầu | Trắng, cao 64: năm học, tên màn đang mở, tên người dùng | Thanh tiêu đề trắng "Ứng dụng giáo viên" như hiện nay |
| Nội dung | Rộng tối đa 1200 điểm ảnh, đệm 24 | Như hiện nay (448 hoặc 768) |
| Nút "Quay lại" của từng màn | Giữ | Giữ |

Mục trên thanh bên lấy đúng danh sách chức năng trang chủ đang hiện, cùng điều kiện quyền và cấp lớp hiện có (`P04.pickup.gate-confirm`, `P04.gate-pass.record`, `P13.equipment.stocktake`, `P09.training.use`, `P02.learning.teach`, `P02.supervision.record`, cờ Gia sư AI, `hasLevelFeature`). Điều kiện chuyển thành một hàm dùng chung cho trang chủ và thanh bên để không viết hai lần. Máy chủ vẫn kiểm tra quyền ở mọi yêu cầu. Không thêm chức năng mới.

Chức năng của lớp (Điểm danh, Sổ điểm, Đánh giá, Trao đổi và đồ bị mất, Hoạt động và hình ảnh, Giảng dạy; Mầm non thêm Đón trả, Nhật ký, Chăm sóc và y tế, Báo cơm, Bán trú, Dặn thuốc) hiện theo lớp đang chọn ở ô chọn lớp; chỉ hiện chức năng có ở cấp của lớp đó. Giáo viên một lớp không thấy ô chọn, chỉ thấy tên lớp.

### 4.2 Màn hình tiêu biểu

| Màn hình | Máy tính | Điện thoại |
|---|---|---|
| MG-01 Trang chủ | Dải chào; "Lớp của tôi" thành lưới thẻ lớp, mỗi thẻ có tên, cấp, sĩ số, nhãn Chủ nhiệm và các nút chức năng của lớp xếp lưới; hàng nút việc nhanh (Gia sư AI, Lịch dạy, Sổ đầu bài, Hộp công cụ); cột phải 340 điểm ảnh từ 1280: chấm công, thông báo, thông báo đẩy | Như hiện nay |
| MH-676 Ca trực hôm nay | Hai thẻ số liệu; "Tôi đã ghi hôm nay" thành bảng (Giờ, Học sinh và lớp, Loại, Mục nội quy, Khu vực, Thu hồi); thu hồi mở dòng nhập lý do ngay dưới dòng | Như hiện nay |
| MH-676 Ghi nhận vi phạm, khen | Từ 1280: hai cột (1. Học sinh bên trái; 2. Nội dung, 3. Ảnh bên phải); 1024 đến 1279 một cột rộng. Thanh lưu dính đáy có nút Thôi, Lưu ghi nhận kèm số học sinh. Máy tính chọn tệp ảnh thay chụp | Như hiện nay |
| MH-275 Sổ điểm lớp | Bảng nhập theo ô (TD-29): cột họ tên và hàng tiêu đề dính khi cuộn, ô 44 điểm ảnh, cột TB môn; môn nhận xét có cột Kết quả | Như hiện nay (mỗi học sinh một thẻ) |

Các màn còn lại: bỏ giới hạn 448, 768 điểm ảnh từ 1024 để dùng vùng nội dung; màn nào có danh sách dài, bảng thì rà ở lát L5 theo ảnh chụp 1366.

### 4.3 Thay đổi mã dự kiến

- `packages/ui`: thêm `RoleNavigationShell` (phần máy tính của TD-21): nhận tên ứng dụng, tên đơn vị, nhóm mục, vùng chọn ngữ cảnh, tên người dùng, nội dung. Dưới 1024 chỉ vẽ nội dung (thanh bên ẩn bằng lớp `lg:`), nên điện thoại không đổi. Thanh bên là `<nav aria-label="Điều hướng chính">`, mục đang mở có `aria-current="page"`, dùng được bằng bàn phím. Màu lấy từ biến dùng chung, không ghi giá trị riêng.
- `ApplicationHeader`: thêm thuộc tính tùy chọn để ẩn từ 1024 khi nằm trong khung; ứng dụng phụ huynh, học sinh không đổi.
- `apps/teacher`: `Application.tsx` bọc màn hình bằng khung khi đã đăng nhập; giữ lớp đang chọn; điều kiện quyền tách thành hàm dùng chung; lớp vùng nội dung của các màn đổi sang một hằng dùng chung có `lg:max-w-[1200px]`.
- Không chạm `apps/api`, cơ sở dữ liệu, quyền.

## 5. Danh sách lát

Mỗi lát một PR vào `main`, đủ 11 kiểm tra CI mới gộp; điểm xem trước: ảnh chụp 390 và 1366 so với bản mẫu, chạy thử trên bản nhiều trường (http://tc.truong.localhost:5192/).

| Lát | Nội dung | Kiểm thử |
|---|---|---|
| L0 | Tài liệu: đặc tả này, bản mẫu, tệp mảnh, giữ mã | `node scripts/gom-thay-doi.mjs --kiem` |
| L1 | Khung: `RoleNavigationShell` ở `packages/ui`, hàm điều kiện chức năng dùng chung, bọc màn hình, ẩn thanh tiêu đề từ 1024, mở rộng vùng nội dung mọi màn | Kiểm thử đơn vị thành phần khung; e2e ở 390 (không có thanh bên, ảnh chụp như trước) và 1366 (thanh bên hiện, mở Ca trực từ thanh bên, đổi lớp, mục theo quyền) |
| L2 | Trang chủ MG-01 bố cục máy tính | e2e 390, 1366: thẻ lớp, nút chức năng theo cấp, giáo viên không có lớp |
| L3 | Ca trực, Ghi nhận MH-676 bố cục máy tính | e2e 390, 1366: bảng ghi nhận, thu hồi, ghi nhận hai cột, lỗi tại ô |
| L4 | Sổ điểm MH-275 bảng nhập theo ô; Đánh giá học sinh cùng cách | e2e 390, 1366: nhập, lưu, lỗi điểm ngoài 0 đến 10, chỉ xem khi không được phân công |
| L5 | Rà các màn còn lại ở 1366, sửa chỗ hẹp, cập nhật tài liệu `14` (BC-02, TN), `15` (TD-21 ghi phần đã làm) | Ảnh chụp 1366 và 390 mọi màn, so trước, sau |

Thứ tự: L0, rồi L1 đến L5 tuần tự, mỗi lát chờ Eric xem rồi mới làm tiếp.

## 6. Tiêu chí nghiệm thu dự kiến

Mã giữ sẵn: AC-1400 đến AC-1419, CT-2100 đến CT-2129. Ghi vào tài liệu `11`, `21` ở lát L1.

| Mã | Tiêu chí | Bắt buộc |
|---|---|---|
| AC-1400 | Từ 1024 điểm ảnh, mọi màn của ứng dụng giáo viên sau đăng nhập có thanh bên 240 điểm ảnh; dưới 1024 không có thanh bên, giao diện như trước (ảnh chụp 390 trước, sau giống nhau ngoài phần đã duyệt) | Có |
| AC-1401 | Thanh bên chỉ hiện chức năng người dùng có quyền và hợp cấp lớp, đúng như trang chủ; mở mục nào thì đúng màn đó, mục đang mở được đánh dấu | Có |
| AC-1402 | Đổi lớp ở ô chọn lớp thì nhóm chức năng của lớp đổi theo cấp lớp; giáo viên một lớp không thấy ô chọn | Có |
| AC-1403 | Ca trực, Ghi nhận, Sổ điểm hiện bố cục máy tính như bản mẫu ở 1366 và 1024; dữ liệu gửi máy chủ giống bố cục điện thoại | Có |
| AC-1404 | Không có thanh cuộn ngang ngoài bảng ở 1024, 1366, 390; mọi nút, ô nhập cao từ 44 điểm ảnh; chữ từ 14 điểm ảnh | Có |
| AC-1405 | Dùng được thanh bên và các màn tiêu biểu bằng bàn phím, có viền tiêu điểm | Có |

## 7. Bảo mật

Không đổi quyền, API, dữ liệu. Thanh bên chỉ ẩn, hiện mục theo cùng điều kiện với trang chủ; máy chủ vẫn kiểm tra quyền ở mọi điểm cuối. Không thêm thư viện. Phần B, C của kiểm tra bảo mật chạy ở từng lát có mã.

## 8. Câu hỏi chờ Eric quyết định

| Mã | Câu hỏi | Phương án | Đề xuất |
|---|---|---|---|
| Q-395-1 | Phạm vi | A. Chỉ làm khổ máy tính, điện thoại giữ như hiện nay; phần điện thoại để YCTD-384 L7. B. Làm trọn L7 ngay (thêm thanh dưới, ô lối tắt trên điện thoại, đổi màu theo vai) | A, đúng yêu cầu, ít rủi ro cho người đang dùng điện thoại |
| Q-395-2 | Màu khung máy tính | A. Màu hiện tại của ứng dụng (nhấn xanh dương #0670C0), đổi cùng lúc với điện thoại ở L7. B. Màu theo vai giáo viên đã duyệt (#0F6B5F) ngay từ bây giờ, chỉ ở khổ máy tính | A, để điện thoại và máy tính cùng một màu; bản mẫu có nút xem cả hai |
| Q-395-3 | Chức năng của lớp trên thanh bên | A. Ô chọn lớp và chức năng của lớp đang chọn. B. Chỉ chức năng chung; chức năng lớp vẫn bấm từ thẻ lớp ở trang chủ | A, đi thẳng tới Điểm danh, Sổ điểm không qua trang chủ |
| Q-395-4 | Sổ điểm trên máy tính | A. Bảng nhập theo ô như bản mẫu. B. Giữ mỗi học sinh một thẻ, chỉ rộng hơn | A, theo TD-29 đã duyệt |

## 9. Kết quả rà soát giao diện trên bản mẫu

| Mục | Kết quả |
|---|---|
| 1. Khớp đặc tả | Bốn màn hình, ba khổ; điện thoại vẽ lại theo giao diện hiện tại |
| 2. Giá trị tài liệu `15` | Màu hiện tại (`theme.css`, `apps/teacher/src/index.css`) hoặc PC-15 đến PC-21; KC-09, KC-10; CH-01 đến CH-07 |
| 3. Đủ trạng thái | Có dữ liệu, rỗng, đang tải, lỗi, không có quyền, thông báo thành công ở cả bốn màn |
| 4. Thông báo | Tiếng Việt, nói lỗi gì và cách xử lý (ví dụ "Chưa lưu được: Võ Đức Thắng, điểm thường xuyên 2 phải từ 0 đến 10") |
| 5. Responsive | Kiểm tự động 72 tổ hợp (4 màn, 3 khổ, 6 trạng thái): không phần tử nào tràn khung ngoài bảng cuộn |
| 6. Chữ dài | Tên lớp "10A1 Chuyên Toán – Tin học chất lượng cao", tên học sinh năm chữ: xuống dòng, không cắt dấu |
| 7. Tương phản | Nhấn #0670C0 trên trắng 5,1:1; chữ phụ #475569 trên #F5F7FA 7,0:1; phương án theo vai theo PC-15 đến PC-21 đã tính ở tài liệu `15` |
| 8. Bàn phím | Thanh bên là liên kết, ô chọn lớp là `select`, viền tiêu điểm 3 điểm ảnh |
| 9. Theo quyền | Mục thanh bên theo điều kiện của trang chủ (mục 4.1) |
| 10. Nút đang xử lý | "Đang lưu…" khóa nút; thu hồi cần nhập lý do |
| 11. Lỗi tại ô | Mục nội quy, ô điểm ngoài khoảng |
| 12. Màn cũ | Điện thoại không đổi; kiểm bằng ảnh chụp 390 trước, sau ở từng lát |
| Vùng chạm | Kiểm tự động: mọi nút, ô nhập, ô chọn cao từ 44 điểm ảnh ở 72 tổ hợp |
