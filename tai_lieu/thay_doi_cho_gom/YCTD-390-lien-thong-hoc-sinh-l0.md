---
yctd: YCTD-390
tieu_de: Liên thông dữ liệu học sinh khi chuyển trường, chuyển cấp, lát L0: đặc tả, bảo mật, bản mẫu
ngay: 2026-10-30
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-10-30 — Liên thông dữ liệu học sinh khi chuyển trường, chuyển cấp, lát L0 (YCTD-390)

#### Công việc đã thực hiện

- Khảo sát mã: chuyển đi (`student_transfers`) chỉ có duyệt ở trường đi, hồ sơ là PDF hoặc tệp 82 cột không có học bạ, kết quả học tập, sức khỏe; chuyển đến nhập tệp 82 cột thành hồ sơ nháp; không có kênh giữa hai trường cùng hệ thống, khóa băm số định danh khác nhau mỗi trường; không có học lại; lên lớp đầu năm làm tay; `transfer_dossiers` (THCS lên THPT) chỉ là dấu trạng thái; tài khoản phụ huynh, học sinh theo từng trường; trường liên cấp đặt học sinh hoàn thành tiểu học là "Đã tốt nghiệp" dù trường có THCS (`learning-records-transition.ts`, `learning-records.ts` hàm tính lớp cuối).
- Kiểm căn cứ: Công văn 755/SGDĐT-GDPT ngày 09/9/2025 của Sở Lào Cai (văn bản gốc: hồ sơ, thời gian chuyển trường các cấp, xin học lại, báo cáo cuối học kỳ I và cuối năm, dẫn Văn bản hợp nhất 07/VBHN-BGDĐT, Thông tư 28/2020/TT-BGDĐT, Thông tư 10/2025/TT-BGDĐT); Thông tư 42/2021/TT-BGDĐT Điều 10 về mã định danh; Nghị định 13/2023/NĐ-CP đã hết hiệu lực, dùng Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP.
- Lập đặc tả và bản mẫu (`tai_lieu/ban_mau/yctd-390/DAC_TA.md`, `index.html`): 13 trường hợp (chuyển trường trong, ngoài hệ thống, giữa năm, cuối năm; lên cấp Mầm non lên Tiểu học, Tiểu học lên THCS, THCS lên THPT; lên cấp trong trường liên cấp; trường mới duyệt trúng tuyển yêu cầu trường cũ chuyển hồ sơ; lưu ban, thôi học, học lại), bảng dữ liệu đi theo và ở lại, gói `school-management.student-transfer/1`, hộp thư chuyển trường ở cơ sở dữ liệu nền tảng, danh sách lát L0 đến L6; bản mẫu MH-650 đến MH-659 ở ba khổ.
- Thêm BM-240 đến BM-244 ở `22_BAO_MAT.md`.

#### Quyết định

- Eric ngày 2026-10-30: làm đủ lát L0 đến L6; hồ sơ chuyển trường bắt buộc gửi theo nghĩa vụ pháp luật, mục thêm (sức khỏe, khen thưởng, ảnh) cần đồng ý, chờ luật sư trước khi bật ở trường thật; danh tính phụ huynh chung trên nền tảng là hướng đích nhưng làm ở đợt riêng, đợt này trường đến tạo tài khoản phụ huynh theo số điện thoại trong gói; gói mã hóa đầu cuối bằng khóa của trường đến; lên cấp trong trường liên cấp do Hiệu trưởng xác nhận danh sách; xếp lớp năm mới theo kết quả lên lớp, lưu ban có gợi ý và người quản lý xác nhận; tiếp nhận thì học sinh Đang học ngay; trường mới duyệt trúng tuyển gửi yêu cầu chuyển hồ sơ, phụ huynh xác nhận ở ứng dụng của trường cũ rồi Hiệu trưởng trường cũ mới chuyển; trường đến khởi tạo yêu cầu được cả với chuyển trường trong năm; duyệt bản mẫu MH-650 đến MH-659 và danh sách lát.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: định dạng gói theo kiểu gói khoá học `course-package/1`; nền tảng xóa bản mã hóa sau 30 ngày kể từ khi xử lý hoặc 90 ngày không ai tải; giới hạn 200 yêu cầu chuyển hồ sơ một trường một ngày; trường cũ trả lời trong 5 ngày làm việc; mã chức năng, quy tắc, tiêu chí, kịch bản, dữ liệu, API cấp ở từng lát có mã.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-390, `22_BAO_MAT.md` BM-240 đến BM-244, `tai_lieu/ban_mau/yctd-390/`.

#### Vấn đề tồn đọng

- Chưa viết mã; làm tiếp từ lát L1 (định dạng gói, chuyển trường ngoài hệ thống).
- Luật sư chưa trả lời ba câu ở mục 16 của đặc tả (đưa vào PL-15 khi gom).
- Văn bản hợp nhất 07/VBHN-BGDĐT, Thông tư 28/2020/TT-BGDĐT Điều 35, 36 chưa đọc toàn văn; báo cáo khảo sát truong.hcm.edu.vn chưa có để đối chiếu thủ tục chuyển trường của Sở Thành phố Hồ Chí Minh.

## 24 Yêu cầu thay đổi

### YCTD-390: Liên thông dữ liệu học sinh khi chuyển trường, chuyển cấp – 2026-10-30

- Lý do: Eric nêu ngày 2026-10-30 việc liên thông dữ liệu học sinh khi chuyển trường, chuyển cấp chưa rõ; hiện chỉ có chuyển đi một chiều bằng tệp 82 cột, không có học bạ, đồng ý của phụ huynh, kênh giữa hai trường; trường liên cấp đặt học sinh hoàn thành cấp là "Đã tốt nghiệp".
- Nội dung thay đổi: gói chuyển trường `school-management.student-transfer/1` ký, mã hóa; hộp thư chuyển trường ở cơ sở dữ liệu nền tảng (nền tảng không đọc được nội dung); trường đến hoặc trường mới gửi yêu cầu chuyển hồ sơ, phụ huynh xác nhận ở trường cũ; đơn xin chuyển trường và đồng ý theo mục ở ứng dụng phụ huynh; lên cấp trong trường liên cấp; gói tuyển sinh khi lên cấp khác trường; tiếp nhận học lại; xếp lớp năm mới theo kết quả lên lớp; việc cần làm trên CSDL ngành. Làm theo lát L0 đến L6; chi tiết ở `tai_lieu/ban_mau/yctd-390/DAC_TA.md`. Lát L0: đặc tả, bảo mật, bản mẫu.
- Yêu cầu bị thay đổi: quyết định ngày 2026-10-16 (`47_KE_HOACH_THEO_HE_THONG_SO.md` mục 7, nguyên tắc 1) đưa "biến động liên trường" vào nhóm bản chạy nội bộ, nay trường trong hệ thống gửi gói thật cho nhau; BR-124 (tiếp nhận chuyển đến tạo hồ sơ nháp) đổi thành tiếp nhận tạo hồ sơ Đang học khi Hiệu trưởng tiếp nhận; bước chuyển năm học không đặt "Đã tốt nghiệp" cho học sinh lên cấp trong trường liên cấp.
- Thành phần bị ảnh hưởng (dự kiến): học sinh (4.1, 4.2), học bạ, kết quả cuối năm, tuyển sinh đầu cấp, xét tốt nghiệp, chuyển năm học, ứng dụng phụ huynh, ứng dụng học sinh, cổng vận hành, cơ sở dữ liệu nền tảng; tài liệu `07`, `08`, `09`, `10`, `11`, `14`, `16`, `17`, `21`, `22`, `27`, `48`.
- Dữ liệu, API, quyền bị ảnh hưởng (dự kiến): nền tảng thêm `school_transfer_keys`, `school_transfer_settings`, `transfer_mailbox`; năm học mở rộng `student_transfers`, thêm `student_transfer_consents`, `received_transfer_packages`; hồ sơ tuyển sinh thêm trường cũ, mã định danh Bộ, đồng ý lấy hồ sơ; điểm cuối giữa trường và nền tảng chỉ trả gói gửi cho đúng trường. Lát L0 không đổi dữ liệu, API, quyền.
- Ảnh hưởng chức năng cũ: không ở lát L0. Từ L1: chuyển đi, tiếp nhận chuyển đến bằng tệp 82 cột, thôi học, chuyển năm học, học bạ, tuyển sinh đầu cấp giữ hành vi cũ ngoài các điểm ở "Yêu cầu bị thay đổi".
- Kiểm thử cần thực hiện: lát L0 chỉ đổi tài liệu, chạy `node scripts/gom-thay-doi.mjs --kiem`; từ L1 chạy lại kiểm thử chuyển đi, chuyển đến (CT-16g-11), thôi học, chuyển năm học, học bạ, tuyển sinh đầu cấp, xét tốt nghiệp, e2e đa cấp 86.
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-30 (phương án, bản mẫu MH-650 đến MH-659, danh sách lát).
- Trạng thái: Đã phê duyệt

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-390 lát L0 (liên thông dữ liệu học sinh khi chuyển trường, chuyển cấp: đặc tả, bảo mật, bản mẫu; L1 đến L6 chưa làm) |

## Thêm dòng

| 22_BAO_MAT.md | BM-215 | BM-240 | Tách dữ liệu giữa trường khi chuyển trường (YCTD-390): thứ duy nhất đi giữa hai trường là gói chuyển trường đã được Hiệu trưởng trường đi xác nhận (hoặc yêu cầu chuyển hồ sơ chỉ gồm mã định danh Bộ, họ tên, ngày sinh, mã hồ sơ tuyển sinh); không có điểm cuối nào cho trường này tra cứu học sinh của trường khác; trường cũ không khớp được yêu cầu thì chỉ trả "không tìm thấy học sinh"; giới hạn 200 yêu cầu một trường một ngày, cấu hình ở cổng vận hành |
| 22_BAO_MAT.md | BM-215 | BM-241 | Mã hóa và ký gói chuyển trường (YCTD-390): trong hệ thống, gói mã hóa đầu cuối bằng khóa công khai của trường đến, khóa riêng của trường bọc bằng khóa gốc như các khóa trường hiện có; manifest ký bằng khóa ký của trường đi, kèm mã băm SHA-256 từng phần, sai một phần thì từ chối cả gói; ngoài hệ thống, tệp gói mã hóa bằng mật khẩu chỉ in trên bản PDF giao phụ huynh; số định danh cá nhân trong gói nằm ở trường riêng, trường đến tính lại băm bằng khóa của mình |
| 22_BAO_MAT.md | BM-215 | BM-242 | Hộp thư chuyển trường ở cơ sở dữ liệu nền tảng (YCTD-390): chỉ giữ bản mã hóa và phần mô tả (mã gói, trường đi, trường đến, loại, trạng thái, hạn, mã băm), không có dữ liệu cá nhân dạng rõ; trường chỉ liệt kê, tải gói gửi cho mình và xem trạng thái gói mình gửi; người vận hành nền tảng không tải được bản mã hóa; bản mã hóa xóa sau 30 ngày kể từ khi tiếp nhận, từ chối, thu hồi hoặc sau 90 ngày không ai tải |
| 22_BAO_MAT.md | BM-215 | BM-243 | Đồng ý khi chuyển trường (YCTD-390; khoản 2 Điều 24 Luật 91/2025/QH15): mục bắt buộc của hồ sơ chuyển trường gửi theo đơn của cha mẹ, mục thêm (sức khỏe, khen thưởng, ảnh) chỉ gửi khi có đồng ý theo từng mục; trẻ từ đủ 7 tuổi ghi thêm đồng ý của trẻ; khi trường mới yêu cầu, phụ huynh xác nhận ở ứng dụng của trường cũ hoặc ký giấy để trường xác nhận thay kèm bản quét; đồng ý ghi người, mục, thời điểm, kênh, rút lại được trước khi gửi; chưa bật trên trường thật khi luật sư chưa trả lời câu hỏi ở đặc tả YCTD-390 mục 16 |
| 22_BAO_MAT.md | BM-215 | BM-244 | Nhật ký và quyền khi chuyển trường (YCTD-390): mọi bước lập, duyệt, gửi, tải, tiếp nhận, từ chối, thu hồi, xuất tệp ghi nhật ký ở cả hai trường (ai, lúc nào); xuất tệp gói ngoài hệ thống cần quyền `dataExport` và `nationalIdView` như hồ sơ chuyển trường hiện có; học bạ nhận từ trường khác lưu chỉ đọc, không sửa |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-390 | Liên thông dữ liệu học sinh khi chuyển trường, chuyển cấp, lát L0: đặc tả, bảo mật, bản mẫu | Không áp dụng (tài liệu) | Chưa cấp (cấp ở lát L1 đến L6) | Chưa cấp | Chưa cấp | PR, commit merge ghi khi gom; tệp: `tai_lieu/ban_mau/yctd-390/DAC_TA.md`, `tai_lieu/ban_mau/yctd-390/index.html` | `node scripts/gom-thay-doi.mjs --kiem` đạt; CI của PR |
