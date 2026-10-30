# YCTD-389: Điểm danh bằng thẻ, máy chấm công, camera và cảnh báo nội quy

- Ngày: 2026-10-30
- Người lập: Claude, theo yêu cầu của Eric ngày 2026-10-30
- Trạng thái: **Đã phê duyệt** (Eric, ngày 2026-10-30: phương án, bản mẫu MH-640 đến MH-643, danh sách lát L0 đến L6 có L5b, tự ghi "Đi muộn" từ thẻ; quyết định ở mục 11).
- Mức: **Lớn.** Lý do: mở rộng phạm vi đã chốt (`05_PHAM_VI.md` dòng 46, 47 ghi hệ thống không nhận diện sinh trắc học và không quản lý luồng camera; `22_BAO_MAT.md` BM-121 ghi không nhận diện danh tính sinh trắc học), thêm thành phần chạy tại trường (trạm camera), thêm bảng dữ liệu và điểm cuối API, đổi giá trị `source` của hai bảng đang dùng, chạm nhiều phân hệ (điểm danh, đưa đón, chấm công, thông báo, tích hợp, hạnh kiểm).
- Bản mẫu: `tai_lieu/ban_mau/yctd-389/index.html` (mở thẳng bằng trình duyệt; thanh trên cùng chọn màn hình MH-640 đến MH-643, khổ, trạng thái).
- Hồ sơ pháp lý: `48_HO_SO_PHAP_LY/23_DONG_Y_SINH_TRAC_HOC_VA_BIEN_THONG_BAO.md` (PL-23, PL-24), câu hỏi luật sư 10 đến 16 ở PL-15 mục 3. Bảo mật: `22_BAO_MAT.md` BM-230 đến BM-235.

## 1. Hiện trạng đã kiểm trong mã

| Thành phần | Hiện có | Chỗ cần nối |
|---|---|---|
| Điểm danh học sinh theo ngày | Bảng `attendance_records` (`database/school-year/migrations/0008_create_attendance.ts`), một bản ghi mỗi trẻ mỗi ngày; trạng thái `present, absent_notified, absent_unnotified, late, early_leave, late_and_early_leave`; cột `source` đã có (`teacher, manager, parent, system`); không có giờ vào, giờ ra. Giáo viên chủ nhiệm ghi, chốt ngày; khi chốt, phụ huynh của trẻ vắng không phép nhận thông báo. | Cần nơi lưu **lượt qua cổng** (giờ vào, giờ ra, thiết bị, độ tin cậy) tách khỏi bản ghi điểm danh, rồi điền sẵn gợi ý cho giáo viên. |
| Điểm danh theo tiết (THCS, THPT) | `period_attendance` (`0080_create_class_logs.ts`). | Camera trong lớp chỉ làm ở giai đoạn sau (mục 9). |
| Đưa đón (mầm non) | `pickup_records`: giáo viên bàn giao, bảo vệ (VT-18) kiểm ở cổng nhiều lần trong ngày (`gate_check`), có ảnh người đón, có thông báo `child_handed_over`. | Thông báo "đã về" của mầm non giữ luồng bàn giao hiện có, không dùng camera. |
| Chấm công cán bộ | `attendance_logs` (`0020_create_staff_attendance.ts`), giờ vào, giờ ra dạng `HH:MM`; `source` chỉ có `self, manual`. Chưa có nhập từ thiết bị hay tệp, dù `05_PHAM_VI.md` dòng 47 đã dự kiến "nhập tay, nhập hàng loạt hoặc API". | Thêm giá trị `device`, điểm nhận dữ liệu thiết bị, nhập tệp. |
| Thông báo | `queueNotification` (`apps/api/src/common/notification-queue.ts`), kênh `in_app, sms, zalo, push`; Zalo rơi về SMS; giới hạn 5 SMS mỗi ngày; nhóm đẩy "điểm danh" theo tiền tố mẫu (`push-groups.ts`). | Mẫu mới `child_arrived_school`, `child_left_school` vào nhóm điểm danh; chỉ trong ứng dụng và đẩy, không SMS. |
| Camera | Giám thị thi trực tuyến chỉ đếm khuôn mặt trên máy học sinh (`@vladmandic/face-api`, MIT, `apps/student/src/proctoring.ts`); quét thẻ đáp án tự viết. Không có thư viện nhận diện. | Không dùng lại được cho nhận diện danh tính. |
| Mã QR | `jsqr` 1.4.0 và thành phần `QrScanner` (`packages/ui/src/QrScanner.tsx`, quét ngay trên trình duyệt); `qrcode` 1.5.4 ở cổng quản trị, phụ huynh, vận hành. | Dùng lại nguyên cho phương án thẻ QR. |
| Tích hợp ngoài | Khóa bí mật theo trường trong `integration_secrets` (mã hóa AES-256-GCM bằng khóa của trường); điểm nhận webhook công khai có kiểm chữ ký (thanh toán), phải khai lý do `WEBHOOK` trong `tenancy-route-policy.ts`. | Thêm loại kết nối `attendance_device`, theo đúng mẫu webhook thanh toán. |
| Đồng ý | `children.photo_consent`, `exam_proctor_consents` (có thu hồi), `video_recording_consents`, `school_consents` ở nền tảng; hồ sơ pháp lý `tai_lieu/48_HO_SO_PHAP_LY/`. | Thêm bảng đồng ý sinh trắc học riêng, có đồng ý của trẻ từ đủ 7 tuổi. |
| Hạnh kiểm | `conduct_entries` tính theo lớp; mẫu "nháp chờ giáo viên xác nhận" ở `classroom_score_events`. Chưa có vai trò giám thị. | Cảnh báo nội quy chỉ là nháp; việc giám thị và hạnh kiểm quyết định việc ghi nhận. |
| Nhiều trường | Mỗi trường một bộ cơ sở dữ liệu, xác định trường theo tên miền, thiếu ngữ cảnh thì từ chối. | Mỗi trường một trạm camera, một khóa thiết bị riêng; không có dữ liệu sinh trắc học dùng chung. |

## 2. Căn cứ pháp lý (đã đối chiếu, ghi rõ chỗ chưa đọc)

**Lưu ý quan trọng:** Nghị định 13/2023/NĐ-CP mà yêu cầu nêu **đã được thay thế từ ngày 01/01/2026**. Văn bản đang áp dụng:

1. **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15**, Quốc hội thông qua ngày 26/06/2025, hiệu lực từ 01/01/2026.
   - Điều 31 khoản 2: dữ liệu sinh trắc học là "dữ liệu về thuộc tính vật lý, đặc điểm sinh học cá biệt và ổn định của một người". Đặc trưng khuôn mặt dùng để nhận diện thuộc loại này, kể cả khi chỉ lưu véc tơ đặc trưng.
   - Điều 31 khoản 4 điểm a: bên thu thập phải bảo mật vật lý thiết bị lưu trữ và truyền dữ liệu sinh trắc học, hạn chế quyền truy cập, có hệ thống theo dõi phòng ngừa xâm phạm. Điểm b: xử lý gây thiệt hại thì phải thông báo cho chủ thể theo quy định của Chính phủ.
   - Điều 31 khoản 3 điểm a: không theo dõi định vị qua thẻ nhận dạng tần số vô tuyến (RFID) và công nghệ khác, trừ khi chủ thể đồng ý, cơ quan có thẩm quyền yêu cầu hoặc luật khác quy định. Ảnh hưởng tới phương án thẻ RFID: chỉ quẹt thẻ tại cổng, không đặt đầu đọc rải khắp trường, và vẫn xin đồng ý.
   - Điều 32: ghi hình nơi công cộng không cần đồng ý chỉ trong các trường hợp ở khoản 1; khoản 2 buộc thông báo cho người bị ghi hình; khoản 4 chỉ lưu trong thời gian cần thiết, hết hạn phải xóa, hủy. Camera an ninh trong khuôn viên trường có thuộc khoản 1 hay không: **cần luật sư**.
   - Điều 24 khoản 2: người đại diện theo pháp luật thực hiện quyền thay trẻ em; với trẻ từ đủ 07 tuổi, việc công bố đời sống riêng tư cần đồng ý của cả trẻ và người đại diện. Khoản 3: dừng xử lý khi người đại diện rút lại đồng ý.
   - Điều 21: đánh giá tác động xử lý dữ liệu cá nhân, gửi cơ quan chuyên trách trong 60 ngày kể từ ngày đầu xử lý (đã ghi ở `48_HO_SO_PHAP_LY/06_DANH_GIA_TAC_DONG_XU_LY.md`).
   - Điều 8 khoản 5: mức phạt tối đa với tổ chức cho vi phạm thông thường là 03 tỷ đồng.
   - Điều 39 khoản 1: xử lý đã có đồng ý theo Nghị định 13/2023 được tiếp tục, không phải xin lại.
2. **Nghị định 356/2025/NĐ-CP** ngày 31/12/2025, hiệu lực 01/01/2026, quy định chi tiết Luật trên và thay Nghị định 13/2023. Danh mục dữ liệu cá nhân nhạy cảm có mục "Dữ liệu sinh trắc học, đặc điểm di truyền" (theo bản đăng của Sở Tư pháp Cần Thơ; số khoản trong Điều 4 **chưa đối chiếu với Công báo**). Điều 29 (thông báo vi phạm với dữ liệu vị trí, sinh trắc học) **chưa ai đọc**; Mẫu số 10 (báo cáo đánh giá tác động) **chưa đọc**.

Hệ quả cho thiết kế:

| Yêu cầu | Cách đáp ứng |
|---|---|
| Đồng ý bằng văn bản, có thể rút lại | Bảng đồng ý sinh trắc học riêng cho từng học sinh: người đại diện ký trên ứng dụng hoặc giấy (tải bản chụp), học sinh từ đủ 7 tuổi xác nhận riêng; rút lại thì trạm xóa đặc trưng trong lần đồng bộ kế tiếp (tối đa 15 phút) và ghi nhật ký. |
| Có phương án cho học sinh không đồng ý | Không đồng ý thì không đăng ký khuôn mặt; dùng thẻ QR hoặc giáo viên điểm danh như hiện nay. Không có thiệt thòi nào khác, màn hình không đánh dấu khác biệt trước lớp. |
| Thông báo có camera | Mẫu biển thông báo (PL-24) đặt ở cổng và khu vực có camera, tải từ màn hình cấu hình; nội dung ghi mục đích, thời hạn lưu, đầu mối liên hệ. |
| Tối thiểu hóa, thời hạn lưu ngắn | Chỉ lưu véc tơ đặc trưng (không lưu ảnh đăng ký sau khi tính xong), mã hóa, **chỉ nằm trên trạm tại trường**; máy chủ chỉ nhận mã học sinh, giờ, thiết bị, độ tin cậy. Ảnh cắt khuôn mặt của ca "cần xem" giữ trên trạm 24 giờ (mặc định; trường chỉnh 1 đến 7 ngày). Lượt qua cổng trên máy chủ giữ hết năm học. Đặc trưng xóa khi học sinh nghỉ học, rút đồng ý hoặc hết năm học (đăng ký lại đầu năm vì khuôn mặt trẻ thay đổi). |
| Quyền xem, xóa | Phụ huynh xem trạng thái đăng ký, các lượt qua cổng của con, yêu cầu xóa; nhà trường xử lý trong ứng dụng, có nhật ký. |
| Đánh giá tác động | Bổ sung phần "Điểm danh bằng camera" vào mẫu PL-06; trường phải lập và nộp trước khi bật; màn hình cấu hình **khóa nút bật** cho tới khi trường tải lên bằng chứng đã nộp (PL-23 mục 4). |
| Bảo mật vật lý (Điều 31 khoản 4) | Trạm đặt trong tủ khóa, ổ đĩa mã hóa, không mở cổng vào từ internet, kết nối ra máy chủ một chiều bằng khóa thiết bị; nhật ký truy cập. |

Câu hỏi cho luật sư (đã ghi thành câu 10 đến 16 ở `48_HO_SO_PHAP_LY/15_DIEU_KIEN_DICH_VU_XU_LY_DU_LIEU.md` mục 3): camera an ninh trong trường có thuộc Điều 32 khoản 1 không; nền tảng có trở thành bên xử lý dữ liệu nhạy cảm (ảnh hưởng miễn trừ Điều 41 Nghị định 356) khi đặc trưng chỉ nằm trên trạm của trường; điểm danh có phải "công bố đời sống riêng tư" để cần đồng ý của học sinh từ đủ 7 tuổi hay chỉ cần đồng ý của cha mẹ (đề xuất xin cả hai cho chắc); quẹt thẻ RFID ở cổng có là "theo dõi định vị" của Điều 31 khoản 3; trường công lập có phải nộp đánh giá tác động.

## 3. Phương án điểm danh để trường chọn

Mọi phương án ghi cùng một loại dữ liệu ("lượt qua cổng"), nên trường đổi phương án mà không đổi màn hình điểm danh, thông báo.

| Phương án | Cách làm | Rủi ro pháp lý | Độ chính xác, tốc độ | Chi phí ước tính cho trường 1.000 học sinh, 2 cổng (cần báo giá) |
|---|---|---|---|---|
| **A. Thẻ QR** | In thẻ QR từ cổng quản trị (dùng lại `qrcode`); bảo vệ hoặc giáo viên trực quét bằng máy tính bảng hay điện thoại qua `QrScanner` có sẵn. | Thấp: không sinh trắc học. Mã QR chỉ chứa mã ngẫu nhiên, đổi được khi mất thẻ. | Gần như không nhận nhầm; nhầm do đưa thẻ hộ (cho mượn thẻ). Khoảng 2 giây mỗi học sinh. | Thẻ in nhựa khoảng 10 đến 20 nghìn đồng mỗi thẻ; 2 máy tính bảng khoảng 8 đến 12 triệu đồng. |
| **B. Thẻ RFID** | Đầu đọc tại cổng gửi mã thẻ về trạm. | Trung bình: Điều 31 khoản 3, chỉ đặt ở cổng, xin đồng ý. | Nhanh hơn QR (dưới 1 giây); vẫn có đưa thẻ hộ. | Đầu đọc khoảng 1 đến 3 triệu đồng mỗi cổng, thẻ khoảng 10 đến 15 nghìn đồng. |
| **C. Máy chấm công khuôn mặt có sẵn của trường** | Hệ thống nhận dữ liệu từ máy (đẩy qua API hoặc nhập tệp CSV, Excel). Nhận diện chạy trong máy của hãng; hệ thống không giữ đặc trưng. | Trung bình đến cao: vẫn là sinh trắc học, trường là bên kiểm soát, dữ liệu nằm ở máy của hãng. | Học sinh dừng trước máy khoảng 1 giây, độ chính xác cao nếu ánh sáng ổn. Một máy phục vụ khoảng 30 đến 50 người mỗi phút. | Máy khuôn mặt khoảng 4 đến 10 triệu đồng mỗi máy; cần 3 đến 4 máy cho giờ cao điểm. |
| **D. Camera khuôn mặt của hệ thống** | Camera IP tại cổng, trạm tại trường nhận diện, gửi lượt qua cổng về máy chủ. | Cao: sinh trắc học trẻ vị thành niên, cần đồng ý, đánh giá tác động, bảo mật vật lý. | Đi thẳng qua không dừng: dễ sót, nhận nhầm khi đông, ngược sáng, đeo khẩu trang. Khuyến nghị làn đi có điểm dừng ngắn. | Camera 4MP chống ngược sáng khoảng 1,5 đến 3 triệu đồng mỗi chiếc (4 chiếc); trạm máy tính nhỏ khoảng 7 đến 12 triệu đồng; tủ, nguồn, đèn bổ sung khoảng 3 đến 5 triệu đồng. |

Chấm công cán bộ, giáo viên: dùng chung phương án C hoặc D (người lớn, dễ đồng ý hơn), hoặc giữ tự chấm công trên ứng dụng như hiện nay. Lượt qua cổng của cán bộ ghi vào `attendance_logs` với `source = device`; người phụ trách nhân sự vẫn sửa được.

**Khuyến nghị:** làm A và C trước (rủi ro thấp, dùng được ngay, dựng sẵn toàn bộ đường dữ liệu), rồi mới làm D cho trường muốn và đã có đánh giá tác động. Không dùng nhận diện khuôn mặt cho mầm non (trẻ dưới 6 tuổi đã có luồng bàn giao, khuôn mặt thay đổi nhanh).

## 4. Luồng nghiệp vụ

### 4.1 Đến trường

1. Thiết bị (máy quét QR, đầu đọc, máy chấm công, trạm camera) ghi một lượt qua cổng: học sinh hoặc cán bộ, hướng (vào, ra), thời điểm, thiết bị, độ tin cậy (thẻ: tuyệt đối).
2. Máy chủ phân loại:
   - Độ tin cậy từ ngưỡng "chắc chắn" trở lên (mặc định 0,80; trường chỉnh): ghi lượt, gửi thông báo "con đã vào trường" cho phụ huynh nếu phụ huynh bật.
   - Từ ngưỡng "cần xem" (mặc định 0,60) đến dưới ngưỡng chắc chắn: ghi lượt ở trạng thái **cần xem**, không gửi thông báo, hiện ở màn hình điểm danh của giáo viên chủ nhiệm.
   - Dưới ngưỡng cần xem: trạm bỏ qua, không gửi về.
   - Cùng một người trong 5 phút: gộp làm một lượt.
3. Giáo viên chủ nhiệm mở màn hình điểm danh: cột "Camera và thẻ" gợi ý trạng thái. Lượt chắc chắn trước giờ vào lớp gợi ý "Có mặt"; sau giờ vào lớp gợi ý "Đi muộn". Không có lượt nào: **để trống**, không gợi ý vắng.
4. Ngoại lệ (thống nhất với việc giám thị và hạnh kiểm, Eric duyệt ngày 2026-10-30): lượt "vào" sau giờ vào học từ thẻ QR, thẻ RFID hoặc máy chấm công (độ tin cậy tuyệt đối) **tự ghi "Đi muộn"** ở tiết 1 (`source = system`), giáo viên sửa được. Lượt từ camera khuôn mặt vẫn chỉ là gợi ý.
5. Giáo viên bấm "Xác nhận theo gợi ý" hoặc sửa từng dòng, rồi lưu như hiện nay. Bản ghi điểm danh vẫn do giáo viên ghi (`source = teacher`), có ghi chú tham chiếu lượt qua cổng. **Hệ thống không tự ghi vắng không phép**; luồng chốt ngày và thông báo vắng hiện có giữ nguyên.

### 4.2 Ra về

- Tiểu học trở lên: lượt "ra" gửi thông báo "con đã ra khỏi cổng" (khác với "đã về nhà": hệ thống không biết con về đâu).
- Mầm non: giữ luồng bàn giao, kiểm ở cổng của bảo vệ hiện có.

### 4.3 Nhận nhầm, không nhận ra

| Tình huống | Xử lý |
|---|---|
| Không nhận ra (đeo khẩu trang, ngược sáng, không đăng ký) | Không có lượt; giáo viên điểm danh tay như hiện nay. Trạm đếm số khuôn mặt không nhận ra theo giờ để nhà trường biết cần chỉnh camera, ánh sáng. |
| Độ tin cậy thấp | Lượt "cần xem"; giáo viên xem ảnh cắt (ảnh lấy trực tiếp từ trạm qua mạng trường, không qua máy chủ) rồi bấm "Đúng em này" hoặc "Không phải". |
| Nhận nhầm đã gửi thông báo cho phụ huynh | Giáo viên bấm "Báo nhận nhầm": lượt bị hủy, phụ huynh nhận thông báo đính chính; trạm ghi lại cặp nhầm để nhà trường đăng ký lại ảnh. Phụ huynh cũng bấm được "Con tôi chưa đến trường" trên thông báo, chuyển cho giáo viên chủ nhiệm. |
| Đưa thẻ hộ (QR, RFID) | Không chặn được bằng phần mềm; giáo viên điểm danh trong lớp vẫn là bước xác nhận cuối. |
| Trạm mất kết nối | Trạm giữ hàng đợi, gửi bù khi có mạng (dùng lại cột `recorded_at`, `is_backfilled`); thông báo gửi bù không gửi nếu đã quá 30 phút. |

## 5. Kiến trúc

### 5.1 Xử lý tại trường (đề xuất) hay trên máy chủ

| Tiêu chí | Trạm tại trường | Máy chủ |
|---|---|---|
| Hình ảnh rời trường | Không: chỉ gửi mã, giờ, độ tin cậy | Có: luồng hình đi qua internet |
| Băng thông | Rất thấp | 4 camera 4MP cần khoảng 16 đến 32 Mbps tải lên liên tục |
| Pháp lý | Dữ liệu sinh trắc học nằm ở trường (bên kiểm soát); nền tảng không giữ | Nền tảng giữ dữ liệu sinh trắc học của mọi trường: tăng nghĩa vụ và rủi ro |
| Vận hành | Phải lắp, cập nhật thiết bị tại trường | Đơn giản hơn về thiết bị |
| Nhiều trường | Tự nhiên tách: mỗi trường một trạm, một khóa | Phải tách nghiêm ngặt kho đặc trưng |

**Đề xuất: trạm tại trường.** Máy chủ không bao giờ nhận ảnh hay véc tơ đặc trưng.

### 5.2 Thành phần

```
[Camera IP cổng] --RTSP--> [Trạm camera tại trường] --HTTPS, khóa thiết bị--> [API của trường]
[Máy chấm công]  --đẩy dữ liệu hoặc tệp-----------------------------------> [API của trường]
[Máy tính bảng quét QR] --ứng dụng web có sẵn, phiên đăng nhập------------> [API của trường]
[Camera an ninh] --RTSP--> [Trạm] --sự kiện, ảnh đã làm mờ--> [API] --> [Ứng dụng giám thị]
```

- **Trạm camera** (ứng dụng mới `apps/camera-station`, chạy bằng Docker trên máy tính nhỏ Linux):
  - Đọc luồng RTSP, phát hiện và cắt khuôn mặt bằng **YuNet** (giấy phép MIT), tính véc tơ đặc trưng bằng **SFace** (Apache 2.0 theo các bản phân phối lại; **cần kiểm tệp giấy phép gốc** trong `opencv_zoo/models/face_recognition_sface`), chạy qua OpenCV (Apache 2.0) hoặc ONNX Runtime (MIT).
  - Kho đặc trưng: tệp SQLite mã hóa trên trạm; khóa giải mã lấy từ máy chủ khi khởi động và chỉ giữ trong bộ nhớ.
  - Đăng ký khuôn mặt: chụp trực tiếp tại trạm (3 đến 5 ảnh), tính véc tơ rồi xóa ảnh. Không lấy ảnh hồ sơ học sinh trên hệ thống để đăng ký (ảnh hồ sơ có mục đích khác, theo `photo_consent`).
  - Đồng bộ với máy chủ mỗi 15 phút: danh sách học sinh đã đồng ý, đã rút đồng ý, ngưỡng, giờ hoạt động; gửi lượt qua cổng.
  - Màn hình xem ảnh "cần xem" phục vụ trong mạng trường, giáo viên mở từ màn hình điểm danh (liên kết chỉ chạy được khi ở trong mạng trường).
- **Camera nội quy**: dùng **Frigate** (NVR phát hiện vật thể tại chỗ, theo tra cứu của việc giám thị là giấy phép MIT; **cần kiểm tệp LICENSE gốc**; tên và biểu trưng là nhãn hiệu) chạy cùng trạm; trạm đọc sự kiện của Frigate, làm mờ khuôn mặt trong ảnh tĩnh rồi gửi cảnh báo.
- **Máy chủ** (`apps/api`): phân hệ mới `gate-attendance` (lượt qua cổng, thiết bị, đồng ý sinh trắc học, mẫu thông báo) và `camera-alerts` (cảnh báo nội quy). Điểm nhận từ thiết bị là điểm cuối công khai có chữ ký, khai lý do `WEBHOOK`, nhận trên tên miền của trường, theo mẫu webhook thanh toán.

### 5.3 Thư viện và giấy phép

| Thư viện, mô hình | Giấy phép | Dùng | Ghi chú |
|---|---|---|---|
| OpenCV, YuNet | Apache 2.0, MIT | Có | Đã đối chiếu README của thư mục YuNet. |
| SFace | Apache 2.0 (nguồn thứ cấp) | Có, sau khi kiểm | Kiểm tệp giấy phép gốc trước khi viết mã. |
| ONNX Runtime | MIT | Có | |
| Frigate | MIT (theo tra cứu của việc giám thị, chưa kiểm gốc) | Có, cho camera nội quy | Không dùng tên, biểu trưng. Có nhận diện khuôn mặt từ bản 0.16 nhưng **không bật** cho camera nội quy. |
| InsightFace (ArcFace, buffalo_l) | Mã nguồn MIT, **mô hình huấn luyện sẵn chỉ cho nghiên cứu phi thương mại**, dùng thương mại phải liên hệ xin phép | Không | Chính xác hơn SFace nhưng không dùng được cho sản phẩm thu phí. |
| Ultralytics YOLO | AGPL-3.0 (chưa kiểm lại) | Không | Ràng buộc công khai mã khi cung cấp dịch vụ. |
| CompreFace | Apache 2.0, bản cập nhật gần nhất thấy được tháng 3/2025 | Không | Không rõ còn bảo trì; mô hình mặc định dựa trên InsightFace. |
| `@vladmandic/face-api` | MIT | Không | Đã dùng cho giám thị thi; mô hình nhận diện cũ, chạy trên trình duyệt, không hợp cho cổng trường. |

### 5.4 Thiết bị gợi ý (giá tham khảo thị trường Việt Nam, cần báo giá thật)

| Thiết bị | Cấu hình gợi ý | Giá ước tính |
|---|---|---|
| Trạm camera | Máy tính nhỏ Intel N100 hoặc mạnh hơn, 16 GB bộ nhớ, ổ 512 GB; thêm bộ tăng tốc suy luận gắn USB nếu chạy cả camera nội quy | 7 đến 12 triệu đồng (thêm khoảng 2 triệu đồng cho bộ tăng tốc) |
| Camera cổng | 4MP, chống ngược sáng (WDR 120 dB), ống kính 4 đến 6 mm, lắp ngang tầm mặt cách làn đi 1,5 đến 2 m | 1,5 đến 3 triệu đồng mỗi chiếc |
| Đèn bổ sung | Đèn chiếu đều phía trước làn đi | 0,5 đến 1 triệu đồng |
| Máy chấm công khuôn mặt (phương án C) | Loại có giao diện đẩy dữ liệu qua HTTP hoặc xuất tệp | 4 đến 10 triệu đồng mỗi máy |
| Máy tính bảng quét QR (phương án A) | Android 10 inch có camera sau | 4 đến 6 triệu đồng |

### 5.5 Độ chính xác (định tính, phải đo thử tại trường thật)

- Kết quả trên bộ dữ liệu người lớn chụp chính diện không phản ánh cổng trường: học sinh đi nhanh, nghiêng mặt, đội mũ, đeo khẩu trang, ngược sáng buổi sáng.
- Trẻ nhỏ: khuôn mặt thay đổi nhanh, độ chính xác của các mô hình công khai thấp hơn với trẻ em; đề xuất đăng ký lại mỗi năm học, chỉ áp dụng từ THCS (trường chọn cấp áp dụng).
- Khẩu trang: mô hình chung giảm mạnh độ chính xác; khi đeo khẩu trang coi như "không nhận ra", giáo viên điểm danh tay.
- Anh chị em sinh đôi: nhận nhầm là bình thường; trường đánh dấu cặp sinh đôi để luôn đưa vào "cần xem".
- Trước khi dùng thật: chạy thử 2 tuần ở chế độ "chỉ ghi, không gợi ý, không thông báo", đo tỉ lệ nhận đúng, nhận nhầm, bỏ sót bằng cách so với điểm danh tay; chỉ bật khi tỉ lệ nhận nhầm dưới 0,5 phần trăm (trường chỉnh).

### 5.6 Bản nhiều trường

- Mỗi trường: trạm riêng, khóa thiết bị riêng (lưu trong `integration_secrets`, mã hóa bằng khóa của trường), lượt qua cổng nằm trong cơ sở dữ liệu năm học của trường.
- Khóa thiết bị gắn với tên miền trường; điểm nhận kiểm chữ ký và mã trường, sai thì từ chối.
- Nền tảng không có kho đặc trưng chung, không có tìm kiếm khuôn mặt giữa các trường.
- Gói dịch vụ: thêm mô đun gói `camera-attendance` (bật theo trường), tương tự `sms-zalo`.

## 6. Dữ liệu dự kiến (để đánh giá ảnh hưởng, chốt ở giai đoạn 07)

| Bảng (cơ sở dữ liệu) | Cột chính |
|---|---|
| `attendance_devices` (năm học hoặc hệ thống) | `id`, `kind` (`qr_scanner, rfid_reader, face_terminal, camera_station`), `name`, `location_name`, `direction` (`in, out, both`), `status`, `last_seen_at`, `disabled_at` |
| `gate_passes` (năm học) | `id`, `person_kind` (`child, staff`), `child_id` hoặc `staff_id`, `device_id`, `direction`, `passed_at`, `confidence`, `review_status` (`confirmed, needs_review, rejected`), `reviewed_by`, `reviewed_at`, `is_backfilled`, `external_id` (chống ghi trùng khi gửi lại) |
| `biometric_consents` (năm học) | `child_id` hoặc `staff_id`, `guardian_decision` (`pending, granted, refused, withdrawn`), `child_agreed` (trẻ từ đủ 7 tuổi), `method` (`app, paper`), `evidence_file_id`, `decided_by`, `decided_at`, `withdrawn_at`, `enrolled_at`, `template_deleted_at` |
| `camera_alerts` (năm học) | xem mục 8 |
| Sửa `attendance_logs.source` | thêm `device` |
| Sửa `attendance_records.source` | **không đổi**: giáo viên vẫn là người ghi |
| Cài đặt trường | ngưỡng chắc chắn, ngưỡng cần xem, giờ hoạt động, cấp học áp dụng, thời hạn giữ ảnh cần xem, bật thông báo đến, về |

## 7. Vai trò và quyền dự kiến

| Vai trò | Quyền |
|---|---|
| Hiệu trưởng (VT-02), Quản lý đơn vị (VT-03) | Cấu hình thiết bị, ngưỡng, phương án; xem theo dõi đồng ý; bật, tắt. Bật nhận diện khuôn mặt cần bằng chứng đánh giá tác động. |
| Giáo viên chủ nhiệm (VT-07) | Xem lượt qua cổng của lớp mình, xác nhận hoặc sửa, báo nhận nhầm, xem ảnh cần xem (trong mạng trường). |
| Bảo vệ (VT-18) | Quét QR tại cổng, xem tình trạng thiết bị cổng. Không xem ảnh khuôn mặt. |
| Nhân sự (VT-06) | Xem, sửa chấm công từ thiết bị, nhập tệp máy chấm công. |
| Phụ huynh (VT-14) | Đồng ý, rút đồng ý, xem lượt qua cổng của con, yêu cầu xóa, bật hoặc tắt thông báo đến, về. |
| Học sinh (VT-21) | Xác nhận đồng ý của chính mình (từ đủ 7 tuổi) trong ứng dụng học sinh. |
| Giám thị (vai trò mới do việc giám thị và hạnh kiểm đề xuất) | Hàng chờ cảnh báo nội quy (mục 8). |

## 8. Giao diện cảnh báo nội quy (bản nháp để khớp với việc giám thị và hạnh kiểm)

Nguyên tắc: cảnh báo **không gắn danh tính học sinh**, ảnh tĩnh đã làm mờ khuôn mặt, **không tự trừ điểm**; giám thị xác nhận rồi tự lập ghi nhận ở ứng dụng giám thị nếu cần.

Loại sự kiện ở bản đầu:

| `event_type` | Cách phát hiện | Độ tin cậy |
|---|---|---|
| `restricted_zone` | Người xuất hiện trong vùng vẽ sẵn (mái, sau nhà kho, bãi xe) trong khung giờ cấm, lâu hơn số giây đặt trước | Tốt |
| `crowding` | Số người trong vùng vượt ngưỡng, lâu hơn số giây đặt trước | Tốt |
| `after_hours_entry` | Có người qua cổng sau giờ đóng cổng (không nhận diện) | Tốt; "đi muộn" theo từng học sinh lấy từ lượt qua cổng, không phải cảnh báo |
| `fall` | Người nằm trên sàn lâu | Trung bình; để giai đoạn sau |
| `uniform` | Không đồng phục ở camera cổng, giờ vào trường | Thấp đến trung bình; Eric chọn làm (lát L5b, mục 11), mặc định chạy thử |

Dữ liệu một cảnh báo (API trả về, tên trường theo quy ước tiếng Anh của mã nguồn; ánh xạ với tên trường việc giám thị đã đề xuất):

| Trường | Kiểu | Ý nghĩa | Tên việc giám thị đề xuất |
|---|---|---|---|
| `id` | uuid | Mã cảnh báo | `id` |
| `event_type` | chuỗi | Loại sự kiện (bảng trên) | `loai_su_kien` |
| `camera_id` | uuid | Camera phát hiện | `camera_id` |
| `zone_id` | uuid hoặc rỗng | Khu vực trong `school_zones` (việc giám thị làm) | (thêm) |
| `location_name` | chuỗi | Tên vị trí hiển thị | `ten_vi_tri` |
| `occurred_at` | thời điểm | Lúc phát hiện | `thoi_diem` |
| `confidence` | số 0 đến 1 | Độ tin cậy | `do_tin_cay` |
| `person_count` | số | Số người thấy được | (thêm) |
| `snapshot_url` | chuỗi hoặc rỗng | Ảnh tĩnh đã làm mờ khuôn mặt, đường dẫn có chữ ký, hết hạn sau 10 phút | `anh_tinh_url` |
| `snapshot_expires_at` | thời điểm | Lúc ảnh bị xóa hẳn (mặc định 7 ngày, xóa ngay khi báo nhầm) | (thêm) |
| `status` | chuỗi | `pending` (chờ xem), `responding` (đang đến xem), `confirmed` (đã xác nhận), `false_alarm` (báo nhầm), `expired` (quá 24 giờ không ai xử lý) | `trang_thai`: `cho_xem, dang_den_xem, da_xac_nhan, bao_nham` (thêm `expired`) |
| `handled_by`, `handled_at` | uuid, thời điểm | Người, lúc xử lý | `nguoi_xu_ly_id`, `thoi_diem_xu_ly` |
| `handling_note` | chuỗi | Ghi chú của giám thị | (thêm) |
| `linked_record_type`, `linked_record_id` | chuỗi, uuid | Ghi nhận do ứng dụng giám thị lập sau khi xác nhận; loại hiện có: `student_conduct_record` | `ghi_nhan_id` |

Điểm cuối:

| Phương thức, đường dẫn | Ai gọi | Việc |
|---|---|---|
| `POST /camera-stations/events` | Trạm (khóa thiết bị, chữ ký) | Gửi cảnh báo; trùng `external_id` thì bỏ qua |
| `GET /camera-alerts?status=&zone_id=&from=&to=` | Giám thị, ban giám hiệu | Danh sách theo phạm vi trực |
| `GET /camera-alerts/:id` | Như trên | Chi tiết, kèm `snapshot_url` mới |
| `POST /camera-alerts/:id/respond` | Giám thị | Chuyển `responding` |
| `POST /camera-alerts/:id/confirm` | Giám thị | Chuyển `confirmed`, ghi chú bắt buộc |
| `POST /camera-alerts/:id/dismiss` | Giám thị | Chuyển `false_alarm`, xóa ảnh ngay |
| `POST /camera-alerts/:id/link` | Ứng dụng giám thị | Gắn `linked_record_type`, `linked_record_id` |
| Thông báo `camera_alert_raised` | Hệ thống | Đẩy cho người đang trực vùng đó (danh sách trực do việc giám thị quản lý) |

Ranh giới với việc giám thị và hạnh kiểm (thống nhất với việc giám thị ngày 2026-10-30):
- Việc giám thị làm danh mục khu vực `school_zones`; `camera_alerts.zone_id` tham chiếu bảng này, màn hình vẽ vùng của camera gắn mỗi vùng ảnh vào một khu vực. Lịch trực `supervision_assignments` có danh sách khu vực; việc giám thị cung cấp hàm `findOnDutySupervisors(zoneId, at)` trả về danh sách người dùng, không ai trực thì trả về người có quyền quản lý rèn luyện. Thông báo `camera_alert_raised` gửi theo hàm này.
- `linked_record_type` của ghi nhận rèn luyện là `student_conduct_record`.
- Việc camera giữ `gate_passes`, in thẻ QR, màn hình quét ở cổng và điểm cuối ghi lượt qua cổng. Màn hình "Cổng trường" của giám thị dùng lại điểm cuối này (điện thoại giám thị là một thiết bị quét QR). Đi muộn tính từ lượt "vào" so với giờ vào học. Việc giám thị chỉ làm thêm lý do đi muộn, ra ngoài có phép, khách ra vào.
- Việc camera làm trạm, bảng `camera_alerts`, các điểm cuối trên và màn hình vẽ vùng; việc giám thị làm vai trò giám thị, lịch trực, hàng chờ cảnh báo và ghi nhận rèn luyện.

## 9. Ngoài phạm vi đợt này (đề xuất làm sau nếu cần)

- Điểm danh theo tiết bằng camera trong lớp: camera trong lớp học ghi hình liên tục trẻ vị thành niên, rủi ro pháp lý và phản ứng phụ huynh cao, lợi ích thấp vì giáo viên đã điểm danh theo tiết.
- Phát hiện té ngã.
- Tìm kiếm một học sinh trên mọi camera.

## 10. Danh sách lát (mỗi lát chạy được, có điểm xem trước)

| Lát | Nội dung | Phụ thuộc | Có thể làm trước riêng |
|---|---|---|---|
| L0 | Tài liệu: phiếu YCTD, sửa `05` (phạm vi), `22` (thay BM-121, thêm mục sinh trắc học), `48` (bổ sung PL-06, mẫu đồng ý, biển thông báo, câu hỏi luật sư), `10`, `11`, `14`, `16`, `17`, `21`, `27`. | Eric duyệt đề xuất | Có |
| L1 | **Thẻ QR**: bảng `attendance_devices`, `gate_passes`; in thẻ QR; màn hình quét ở cổng (dùng `QrScanner`); thông báo đến, về; cột "Camera và thẻ" ở màn hình điểm danh của giáo viên. | L0 | **Có: phương án A trọn vẹn** |
| L2 | **Máy chấm công**: khóa thiết bị theo trường, điểm nhận có chữ ký, nhập tệp CSV, Excel; chấm công cán bộ `source = device`; màn hình thiết bị. | L1 | **Có: phương án C** |
| L3 | **Đồng ý sinh trắc học**: bảng `biometric_consents`, màn hình phụ huynh, học sinh xác nhận, theo dõi đồng ý ở cổng quản trị, mẫu giấy, khóa nút bật theo bằng chứng đánh giá tác động. | L1 | Có (cần cho C nếu học sinh dùng máy chấm công khuôn mặt) |
| L4 | **Trạm camera, điểm danh khuôn mặt**: ứng dụng `apps/camera-station`, đăng ký, nhận diện, đồng bộ, xem ảnh cần xem trong mạng trường, chế độ chạy thử chỉ ghi. Thử bằng ảnh tổng hợp, không dùng ảnh người thật. | L1, L3 | Không |
| L5 | **Camera nội quy**: Frigate trên trạm, vẽ vùng, bảng `camera_alerts`, điểm cuối mục 8, thông báo (khu vực cấm, tụ tập, vào sau giờ đóng cổng). | L4 (dùng chung trạm), khớp với việc giám thị | Không |
| L5b | **Cảnh báo không đồng phục** theo mục 11. | L5 | Không |
| L6 | Kiểm thử đầu cuối, rà bảo mật phần B, C, hướng dẫn lắp đặt. | L1 đến L5 | |

## 11. Quyết định của Eric ngày 2026-10-30

| Câu hỏi | Quyết định | Ảnh hưởng tới thiết kế |
|---|---|---|
| Thứ tự làm | **Làm hết L0 đến L6, kể cả camera khuôn mặt** (không theo khuyến nghị làm QR, máy chấm công trước) | Vẫn làm theo thứ tự lát L1 → L6 vì L4 cần đường dữ liệu của L1 và đồng ý của L3. Nút bật camera khuôn mặt vẫn khóa tới khi trường tải bằng chứng đánh giá tác động; câu hỏi luật sư ở mục 2 gửi song song, không chặn viết mã. |
| Ảnh ca cần xem | Chỉ trên trạm tại trường | Như mục 5.2: máy chủ không nhận ảnh, giáo viên xem trong mạng trường, tự xóa sau 1 ngày. |
| Cấp học bật khuôn mặt | **Từ tiểu học trở lên** (mầm non vẫn không dùng) | Cài đặt có Tiểu học, THCS, THPT, cán bộ. Với tiểu học: đăng ký lại mỗi học kỳ thay vì mỗi năm; ngưỡng chắc chắn mặc định cao hơn (0,85); chạy thử 2 tuần bắt buộc riêng cho khối tiểu học. |
| Cảnh báo nội quy bản đầu | Khu vực cấm, tụ tập, vào sau giờ đóng cổng, **không đồng phục** | Thêm lát L5b "không đồng phục" (dưới đây). |

Thiết kế cảnh báo không đồng phục (L5b), để giảm sai và tránh phân biệt đối xử:
- Chỉ chạy ở camera cổng, trong khung giờ vào trường; không chạy trong lớp, sân chơi.
- Không gắn danh tính: cảnh báo chỉ có ảnh tĩnh đã làm mờ khuôn mặt, không nối với lượt qua cổng hay nhận diện khuôn mặt.
- Mô hình phân loại nhỏ huấn luyện tại trạm bằng ảnh đồng phục của chính trường (áo trên ma-nơ-canh hoặc ảnh phần thân không có mặt); mô hình nền chọn loại có giấy phép cho dùng thương mại, kiểm giấy phép trước khi viết mã.
- Ngày miễn đồng phục (thể dục, lễ, trời lạnh) cài trong lịch; mặc định chạy thử chỉ ghi 2 tuần, đo tỉ lệ báo nhầm trước khi gửi cho giám thị.
- Thêm `event_type = uniform` vào giao diện cảnh báo mục 8 (đã báo việc giám thị).

## 12. Phiếu yêu cầu thay đổi (ghi ở tệp mảnh `thay_doi_cho_gom/YCTD-389-camera-diem-danh-l0.md`)

### YCTD-389: Điểm danh bằng thẻ, máy chấm công, camera và cảnh báo nội quy – 2026-10-30

- Lý do: Eric yêu cầu ngày 2026-10-30 điểm danh học sinh, chấm công cán bộ bằng camera, kèm camera giám sát nội quy; có phương án ít rủi ro (thẻ QR, RFID, máy chấm công có sẵn).
- Nội dung thay đổi: thêm lượt qua cổng từ thiết bị, gợi ý điểm danh cho giáo viên xác nhận, thông báo đến và về, nhận dữ liệu máy chấm công, đồng ý sinh trắc học, trạm camera tại trường, cảnh báo nội quy chờ giám thị xác nhận.
- Yêu cầu bị thay đổi: `05_PHAM_VI.md` dòng 46 (camera chỉ hiển thị liên kết) và dòng 47 (không nhận diện sinh trắc học); `22_BAO_MAT.md` BM-121; `attendance_logs.source`.
- Thành phần bị ảnh hưởng: phân hệ điểm danh (P04), đưa đón, chấm công (P08), thông báo, tích hợp, cài đặt trường, gói dịch vụ; ứng dụng cổng quản trị, giáo viên, phụ huynh, học sinh; ứng dụng mới `apps/camera-station`; hồ sơ pháp lý `48`.
- Kiểm thử phải chạy lại (tra `27`): điểm danh lớp, chốt ngày và thông báo vắng, đưa đón, chấm công, thông báo, chính sách điểm cuối công khai.
- Mức: Lớn.
- Trạng thái: Đã phê duyệt (Eric, ngày 2026-10-30).

## 13. Mã đã cấp, mã cấp sau

| Loại | Mã | Ghi chú |
|---|---|---|
| Yêu cầu thay đổi | YCTD-389 | Mọi lát dùng chung; mỗi lát một tệp mảnh |
| Màn hình | MH-640 điểm danh có kết quả thiết bị; MH-641 cấu hình thiết bị, ngưỡng, vùng cảnh báo; MH-642 đồng ý dùng khuôn mặt (phụ huynh, học sinh, nhà trường theo dõi); MH-643 thông báo đến và về | Ghi vào `14_DAC_TA_GIAO_DIEN.md` ở lát có giao diện tương ứng (L1: MH-640, MH-643; L2: MH-641; L3: MH-642) |
| Bảo mật | BM-230 đến BM-235 | Ghi ở lát L0 |
| Hồ sơ pháp lý | PL-23, PL-24 | Ghi ở lát L0 |
| Chức năng, quy tắc, tiêu chí, kịch bản (`10`, `07`, `11`, `21`), dữ liệu (`16`), API (`17`) | Cấp ở từng lát có mã | Theo cách làm của YCTD-383, YCTD-385 |
