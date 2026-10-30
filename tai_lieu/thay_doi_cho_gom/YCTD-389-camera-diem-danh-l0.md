---
yctd: YCTD-389
tieu_de: Điểm danh bằng thẻ, máy chấm công, camera và cảnh báo nội quy, lát L0: phạm vi, bảo mật, hồ sơ pháp lý, bản mẫu
ngay: 2026-10-30
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-10-30 — Điểm danh bằng thẻ, máy chấm công, camera và cảnh báo nội quy, lát L0 (YCTD-389)

#### Công việc đã thực hiện

- Khảo sát mã: `attendance_records` một bản ghi mỗi học sinh mỗi ngày, đã có cột `source`, chưa có giờ vào, ra; `attendance_logs` của chấm công chỉ có `source` `self`, `manual`, chưa nhận dữ liệu thiết bị; `QrScanner` (`jsqr`) và `qrcode` dùng lại được cho thẻ QR; khóa kết nối theo trường ở `integration_secrets`; chưa có thư viện nhận diện khuôn mặt.
- Kiểm căn cứ pháp lý ngày 2026-10-30: Nghị định 13/2023/NĐ-CP đã được thay từ 01/01/2026 bởi Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP; dùng Điều 21, 24, 31, 32 của Luật và danh mục dữ liệu nhạy cảm của Nghị định.
- Lập đặc tả, phương án A (thẻ QR), B (thẻ RFID), C (máy chấm công có sẵn), D (camera khuôn mặt của hệ thống), kiến trúc trạm camera tại trường, giao diện cảnh báo nội quy, danh sách lát L0 đến L6 có L5b (`tai_lieu/ban_mau/yctd-389/DAC_TA.md`); bản mẫu MH-640 đến MH-643 ở ba khổ, năm trạng thái (`tai_lieu/ban_mau/yctd-389/index.html`).
- Sửa phạm vi `05_PHAM_VI.md` mục 3 (dòng 4, 5); thêm BM-230 đến BM-235 ở `22_BAO_MAT.md`; thêm PL-23, PL-24 (`48_HO_SO_PHAP_LY/23_DONG_Y_SINH_TRAC_HOC_VA_BIEN_THONG_BAO.md`), câu hỏi luật sư 10 đến 16 ở PL-15, dòng thời hạn lưu ở PL-13.
- Thống nhất giao diện cảnh báo với việc giám thị và hạnh kiểm: `camera_alerts.zone_id` tham chiếu `school_zones`; người nhận cảnh báo lấy từ lịch trực; `linked_record_type` là `student_conduct_record`; việc camera giữ `gate_passes`, in thẻ QR, điểm cuối ghi lượt qua cổng.

#### Quyết định

- Eric ngày 2026-10-30: làm hết L0 đến L6, kể cả camera khuôn mặt; ảnh khuôn mặt chưa chắc chắn chỉ giữ trên trạm tại trường; nhận diện khuôn mặt từ tiểu học trở lên (không cho mầm non); cảnh báo nội quy bản đầu gồm khu vực cấm, tụ tập, vào sau giờ đóng cổng, không đồng phục; lượt vào sau giờ học từ thẻ QR, thẻ RFID, máy chấm công tự ghi "Đi muộn", giáo viên sửa được; duyệt bản mẫu MH-640 đến MH-643 và danh sách lát.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: xử lý tại trạm đặt ở trường, máy chủ không nhận ảnh, đặc trưng; mô hình YuNet và SFace (giấy phép MIT, Apache 2.0, kiểm tệp giấy phép gốc trước khi viết mã), không dùng mô hình huấn luyện sẵn của InsightFace (chỉ cho nghiên cứu phi thương mại); nút bật camera khuôn mặt khóa tới khi trường tải bằng chứng đánh giá tác động; xin đồng ý của cả cha mẹ và học sinh từ đủ 7 tuổi; mã chức năng, tiêu chí, kịch bản, dữ liệu, API cấp ở từng lát có mã.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-389, `05_PHAM_VI.md` mục 3, `22_BAO_MAT.md` BM-230 đến BM-235, `48_HO_SO_PHAP_LY/` PL-13, PL-15, PL-23, PL-24.

#### Vấn đề tồn đọng

- Chưa viết mã; làm tiếp từ lát L1 (thẻ QR, lượt qua cổng, thông báo đến và về).
- Câu hỏi luật sư 10 đến 16 ở PL-15 chưa có trả lời; Điều 29, Mẫu số 10 của Nghị định 356/2025/NĐ-CP chưa đọc.
- Độ chính xác nhận diện phải đo bằng chạy thử 2 tuần ở trường thật; giá thiết bị là ước tính, cần báo giá.

## 24 Yêu cầu thay đổi

### YCTD-389: Điểm danh bằng thẻ, máy chấm công, camera và cảnh báo nội quy – 2026-10-30

- Lý do: Eric yêu cầu ngày 2026-10-30 điểm danh học sinh, chấm công cán bộ bằng camera, báo cha mẹ khi con đến và về, kèm camera giám sát nội quy gửi cảnh báo cho giám thị xác nhận; có phương án ít rủi ro (thẻ QR, thẻ RFID, máy chấm công có sẵn).
- Nội dung thay đổi: lượt qua cổng từ thiết bị; gợi ý điểm danh cho giáo viên xác nhận (không tự ghi vắng; riêng "Đi muộn" từ thẻ, máy chấm công được tự ghi); thông báo đến và về; nhận dữ liệu máy chấm công qua kết nối có chữ ký hoặc tệp; đồng ý dùng khuôn mặt của cha mẹ và học sinh; trạm camera tại trường nhận diện khuôn mặt; cảnh báo nội quy (khu vực cấm, tụ tập, vào sau giờ đóng cổng, không đồng phục) chờ giám thị xác nhận, không tự trừ điểm. Làm theo lát L0 đến L6, L5b; chi tiết ở `tai_lieu/ban_mau/yctd-389/DAC_TA.md`. Lát L0: phạm vi, bảo mật, hồ sơ pháp lý, đặc tả, bản mẫu.
- Yêu cầu bị thay đổi: `05_PHAM_VI.md` mục 3 dòng 4 (camera chỉ hiển thị đường dẫn) và dòng 5 (không tự nhận dạng sinh trắc học).
- Thành phần bị ảnh hưởng (dự kiến): điểm danh (P04), đưa đón, chấm công (P08), thông báo, tích hợp, cài đặt trường, gói dịch vụ; cổng quản trị, ứng dụng giáo viên, phụ huynh, học sinh; ứng dụng mới `apps/camera-station`; tài liệu `05`, `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `22`, `27`, `48`.
- Dữ liệu, API, quyền bị ảnh hưởng (dự kiến): bảng mới `attendance_devices`, `gate_passes`, `biometric_consents`, `camera_alerts`; thêm giá trị `device` cho `attendance_logs.source`, `system` đã có ở `attendance_records.source`; điểm nhận công khai có chữ ký cho thiết bị; quyền cấu hình thiết bị cho Hiệu trưởng, Quản lý đơn vị. Lát L0 không đổi dữ liệu, API, quyền.
- Ảnh hưởng chức năng cũ: không ở lát L0. Từ L1: điểm danh tay, chốt ngày, thông báo vắng, đưa đón giữ nguyên.
- Kiểm thử cần thực hiện: lát L0 chỉ đổi tài liệu, chạy `node scripts/gom-thay-doi.mjs --kiem`; từ L1 chạy lại kiểm thử điểm danh lớp, chốt ngày và thông báo vắng, đưa đón, chấm công, thông báo, chính sách điểm cuối công khai.
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-30 (phương án, bản mẫu MH-640 đến MH-643, danh sách lát).
- Trạng thái: Đã phê duyệt

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P04 Điểm danh và chăm sóc hằng ngày | YCTD-389 lát L0 (điểm danh bằng thẻ, máy chấm công, camera và cảnh báo nội quy: phạm vi, bảo mật, hồ sơ pháp lý, bản mẫu; L1 đến L6 chưa làm) |
| index.md | 48 | PL-23, PL-24: đồng ý dùng khuôn mặt để điểm danh, biển thông báo có camera (YCTD-389) |

## Thêm dòng

| 22_BAO_MAT.md | BM-215 | BM-230 | Dữ liệu khuôn mặt ở trạm camera (YCTD-389, PL-23): nhận diện chỉ chạy trên trạm đặt tại trường; ảnh chụp đăng ký xóa ngay sau khi tính đặc trưng; đặc trưng lưu mã hóa trên trạm, khóa giải mã do máy chủ cấp khi trạm khởi động và chỉ giữ trong bộ nhớ; máy chủ không bao giờ nhận ảnh hay đặc trưng khuôn mặt; chỉ người đã đồng ý (cha mẹ và học sinh từ đủ 7 tuổi), từ tiểu học trở lên, không cho mầm non; rút đồng ý thì trạm xóa trong lần đồng bộ kế tiếp (tối đa 15 phút), có nhật ký; đặc trưng xóa khi nghỉ học, hết năm học (tiểu học: hết học kỳ) |
| 22_BAO_MAT.md | BM-215 | BM-231 | Trạm camera tại trường (YCTD-389; khoản 4 Điều 31 Luật 91/2025/QH15): đặt trong tủ khóa, ổ đĩa mã hóa; không mở cổng vào từ internet; chỉ kết nối ra máy chủ của đúng trường bằng khóa thiết bị riêng (lưu mã hóa ở `integration_secrets`, thu hồi được), mọi yêu cầu có chữ ký và mã chống gửi lặp; nhật ký truy cập trạm; mất trạm thì thu hồi khóa thiết bị và khóa giải mã đặc trưng |
| 22_BAO_MAT.md | BM-215 | BM-232 | Điểm nhận lượt qua cổng từ thiết bị (YCTD-389; lát L2): `POST /api/v1/device-events` khai lý do trong `tenancy-route-policy.ts`, nhận trên tên miền của trường; thiết bị gửi khóa riêng ở tiêu đề `x-device-key` qua HTTPS, máy chủ chỉ lưu mã băm SHA-256 và bốn ký tự cuối, khóa chỉ hiện một lần khi tạo hoặc đổi; thiết bị đã tắt, khóa cũ sau khi đổi bị từ chối (401); `external_id` ghép mã thiết bị chống ghi trùng; chỉ nhận mã người, hướng, thời điểm (trong 7 ngày, lệch tối đa 5 phút về sau); tối đa 500 lượt mỗi lần; thiết bị ở đơn vị cấp 2 chỉ ghi người của đơn vị đó |
| 22_BAO_MAT.md | BM-215 | BM-233 | Ảnh khuôn mặt cần xem (YCTD-389): giữ trên trạm 1 ngày (trường chỉnh 1 đến 7), chỉ giáo viên chủ nhiệm của lớp xem qua mạng của trường bằng mã truy cập ngắn hạn do máy chủ ký; không qua máy chủ, không có nút tải xuống; mỗi lần xem ghi nhật ký |
| 22_BAO_MAT.md | BM-215 | BM-234 | Cảnh báo nội quy (YCTD-389): không gắn danh tính học sinh, không nối với nhận diện khuôn mặt; ảnh tĩnh làm mờ khuôn mặt trên trạm trước khi gửi; ảnh phục vụ bằng đường dẫn có chữ ký hạn 10 phút, xóa sau 7 ngày hoặc ngay khi giám thị báo nhầm; không tự trừ điểm; cảnh báo không đồng phục chỉ chạy ở camera cổng trong giờ vào trường |
| 22_BAO_MAT.md | BM-215 | BM-235 | Thông báo và đồng ý khi dùng camera ở trường (YCTD-389, PL-23, PL-24; Điều 32 Luật 91/2025/QH15): biển thông báo ở cổng và nơi có camera; đồng ý ghi người, vai trò, thời điểm, cách, phiên bản nội dung, đổi nội dung thì xin lại; nút bật camera khuôn mặt khóa tới khi trường tải bằng chứng đã nộp đánh giá tác động; người không đồng ý dùng thẻ QR hoặc điểm danh tay, màn hình không đánh dấu khác biệt trước lớp |
| 48_HO_SO_PHAP_LY/00_MUC_LUC.md | PL-22 | PL-23, PL-24 | [23_DONG_Y_SINH_TRAC_HOC_VA_BIEN_THONG_BAO.md](23_DONG_Y_SINH_TRAC_HOC_VA_BIEN_THONG_BAO.md) | Văn bản đồng ý dùng khuôn mặt để điểm danh, phần bổ sung cho PL-06; biển thông báo có camera (YCTD-389) | Trước khi trường bật camera khuôn mặt hoặc camera cảnh báo nội quy | Cha mẹ, học sinh từ đủ 7 tuổi đồng ý; luật sư của Eric rà mẫu | `biometric_consents` (dự kiến, lát L3); bằng chứng đánh giá tác động ở cài đặt trường |
| 48_HO_SO_PHAP_LY/13_CHINH_SACH_LUU_GIU_VA_XOA.md | Bản ghi camera khi thi trực tuyến (YCTD-215; mặc định tắt) | Dữ liệu camera ở trường (YCTD-389, PL-23) | Không dùng | Đặc trưng khuôn mặt chỉ trên trạm, xóa khi rút đồng ý, nghỉ học, hết năm học (tiểu học: hết học kỳ); ảnh cần xem `[1]` ngày (1 đến 7); ảnh cảnh báo nội quy `[7]` ngày, báo nhầm xóa ngay; lượt qua cổng theo dữ liệu nghiệp vụ | Như `consented` | Điều 31, khoản 4 Điều 32 Luật 91/2025/QH15 (luật sư kiểm, PL-15 câu 12) |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-389 | Điểm danh bằng thẻ, máy chấm công, camera và cảnh báo nội quy, lát L0: phạm vi, bảo mật, hồ sơ pháp lý, bản mẫu | Không áp dụng (tài liệu) | Chưa cấp (cấp ở lát L1 đến L6) | Chưa cấp | Chưa cấp | PR, commit merge ghi khi gom; tệp: `tai_lieu/ban_mau/yctd-389/DAC_TA.md`, `tai_lieu/ban_mau/yctd-389/index.html`, `tai_lieu/48_HO_SO_PHAP_LY/23_DONG_Y_SINH_TRAC_HOC_VA_BIEN_THONG_BAO.md` | `node scripts/gom-thay-doi.mjs --kiem` đạt; CI của PR |
