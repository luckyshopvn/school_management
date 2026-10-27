---
yctd: YCTD-251
tieu_de: DT-27 phần 27a: lớp video trực tiếp
ngay: 2026-10-27
phien_ban_de_xuat: 0.158.0
---

## 02 Nhật ký

### 2026-10-27 — DT-27 phần 27a: lớp video trực tiếp

#### Công việc đã thực hiện

- Đọc mục 19.2 (phần 3 an toàn trẻ em và ghi hình, phần 4 hạ tầng video), 19.5 (27a), 19.11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà coturn và cấp máy chủ ICE của 23e, mẫu bộ nối nhà cung cấp (AI của 23d, thông báo đẩy của 26b), giới hạn gói (S5a), việc nền theo trường (S1b), kho tệp, chỗ nối điểm danh `recordRoomEvents` của 27b, kênh student của 23a.
- Thêm bộ nối `VideoRoomProvider` (`livekit` tự host, `livekit-cloud` dự phòng, `mock`; SDK máy chủ `livekit-server-sdk` 2.19.1, giấy phép Apache-2.0), dịch vụ phòng, điểm cuối giáo viên, cha mẹ, học sinh, sự kiện gọi lại có chữ ký, việc nền xóa bản ghi hết hạn.
- Năm học `0160`, `0161` (thay số giữ sẵn 0150, 0151 vì phải chạy sau bảng buổi gia sư 0153 của 27b), nền tảng `0240` (giới hạn phút, dung lượng bản ghi của gói).
- Hồ sơ vận hành: dịch vụ `livekit` (v1.13.7) và `egress` (v1.14.1) ở hồ sơ `video`, TURN dùng chung coturn của 23e, biến LIVEKIT_* không bắt buộc khi tắt video.
- Giao diện: thành phần dùng chung `VideoRoom`, `VideoHostPanel`, `VideoRecordingList` (`livekit-client` 2.22.3) ở `packages/ui`; lớp video của buổi ở cổng quản trị và ứng dụng giáo viên; cha mẹ vào xem và đồng ý ghi hình ở ứng dụng phụ huynh; học sinh vào lớp ở kênh student; cấu hình lớp video của trường; giới hạn video ở trang gói của nền tảng.
- Kiểm thử: CT-27a-1 đến CT-27a-8.

#### Quyết định

- Không rẽ nhánh theo nhà cung cấp trong mã nghiệp vụ; bộ giả lập trả mã vào phòng giả và nhận sự kiện ký bằng khóa giả lập.
- Tên phòng ở máy chủ video có mã trường; sự kiện gọi lại đi qua một địa chỉ chung (đường dẫn không cần trường), trường lấy từ tên phòng.
- Phòng chờ bật mặc định; mã vào phòng dùng để vào trong 10 phút; cha mẹ, Ban Giám hiệu vào xem, nói khi gia sư cho; học sinh chia sẻ màn hình khi được cho.
- Trong trường ghi hình tắt mặc định: chương trình bật ghi hình và mọi học sinh có đơn được duyệt có đồng ý còn hiệu lực của cha mẹ; bản ghi theo `storageKey('video-recordings', …)`, giữ 30 ngày (cấu hình), xem bằng đường dẫn ký 5 phút, không có nút tải, mỗi lần xem ghi nhật ký.
- Bảng trắng tự viết bằng canvas, đồng bộ qua kênh dữ liệu của phòng, không thêm thư viện (GD-137).
- Giới hạn của gói đo từ nhật ký vào ra ở cơ sở dữ liệu của trường; vượt thì không mở phòng mới, không cấp mã vào, không ghi mới.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-251, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-310 đến BR-312, PQ-120, P02-110, P02-111, AC-950 đến AC-952, MH-410 đến MH-414, CT-1250 đến CT-1257.

#### Vấn đề tồn đọng

- Đo băng thông, số nhân của Egress và cú pháp TURN dùng chung của LiveKit trên máy thật (E-05); luật sư kết luận ghi hình (E-06) trước khi bật ở trường thật; bản ghi lớn đọc cả tệp vào bộ nhớ khi phát (chưa có phát theo đoạn); khóa LiveKit ở biến môi trường, chưa có trang lưu mã hóa ở `platform`.

## 24 Yêu cầu thay đổi

### YCTD-251: DT-27 phần 27a: lớp video trực tiếp – 2026-10-27

- Lý do: phần 27a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 19.4, 19.5; nền của gia sư trong trường (27b điểm danh từ nhật ký phòng, 27c thù lao) và chợ gia sư (27f đến 27i). Văn bản đọc lại: Luật 91/2025/QH15 Điều 24 và Nghị định 356/2025/NĐ-CP Điều 21 khoản 5 (đã đọc toàn văn ở S8a, tóm tắt ở 19.2 phần 3).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Bộ nối** `VideoRoomProvider`: tạo phòng, cấp mã vào phòng theo người và quyền, đổi quyền, mời ra, kết thúc phòng, bắt đầu và dừng ghi, nhận sự kiện có chữ ký. `livekit` và `livekit-cloud` cùng mã (`VIDEO_PROVIDER`, `LIVEKIT_URL`, `LIVEKIT_PUBLIC_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`; thiếu thì máy chủ không khởi động), `mock` cho kiểm thử (từ chối khi NODE_ENV=production); trống là tắt video.
  - **Phòng** (năm học `0160`): phòng của buổi gia sư (một buổi một phòng, `tutoring_sessions.video_room_ref`) hoặc phòng tức thời của giáo viên; cấu hình trường `video_settings` (người dự tối đa GD-130 mặc định 8, giữ bản ghi GD-132 mặc định 30 ngày, phòng chờ); phòng chờ `video_room_admissions`; nhật ký vào ra `video_room_events`.
  - **Vai trò**: giáo viên dạy chương trình là chủ phòng (chia sẻ, ghi, cho nói, mời ra); Ban Giám hiệu vào xem; học sinh có đơn được duyệt (kênh student, `P02.learning.study`) nói, bật camera, chia sẻ màn hình khi được cho; cha mẹ của học sinh đó vào xem, nói khi được cho. Mã vào phòng dùng để vào trong 10 phút, cấp lại mỗi lần vào.
  - **Điểm danh**: học sinh vào ra phòng của buổi ghi sang `recordRoomEvents` của 27b (điểm danh gợi ý, giáo viên xác nhận); điểm cuối giả lập của 27b giữ cho kiểm thử.
  - **Ghi hình** (`0161`): chương trình bật `recording_enabled`; mọi học sinh có đơn được duyệt có đồng ý ghi hình còn hiệu lực của cha mẹ (`video_recording_consents`, bản chụp văn bản và mã băm, rút lại được); Egress ghi vào kho tệp theo `storageKey('video-recordings', …)`; "Đang ghi" luôn hiện; xem bằng đường dẫn ký 5 phút (phát trực tiếp, không lưu đệm, không có nút tải), mỗi lần xem ghi `video_recording_views` và nhật ký thao tác; Ban Giám hiệu giữ bản ghi quá hạn khi có tranh chấp; việc nền mỗi giờ xóa bản hết hạn.
  - **Gói** (nền tảng `0240`): `plans.video_max_minutes` (phút người dự mỗi tháng), `plans.video_max_recording_mb`; vượt thì không mở phòng mới, không cấp mã vào, không ghi mới; trang cấu hình hiện đã dùng.
  - **Hạ tầng**: `livekit` và `egress` ở hồ sơ `video` của `deploy/docker-compose.production.yml` và `deploy/profiles/production/compose.yml`, cấu hình `deploy/livekit/*.yaml` thay khóa lúc khởi động; TURN dùng chung coturn của 23e bằng khóa dùng chung; mở cổng TCP 7881, UDP 50000 đến 50200.
- Thành phần bị ảnh hưởng: `database` (năm học `0160`, `0161`, nền tảng `0240`), `packages/shared` (`video.ts`), `packages/server` (`TenantPlan`), `packages/ui` (`VideoRoom.tsx`), `apps/api` (`video/`, `tutoring/tutoring.ts`, cấu hình, chính sách tuyến), `apps/identity`, `apps/platform` (giới hạn gói), `apps/portal`, `apps/teacher`, `apps/parent`, `deploy/`, `tests/`.
- Dữ liệu bị ảnh hưởng: năm học thêm 7 bảng `video_*`, cột `tutoring_programs.recording_enabled`; nền tảng thêm hai cột ở `plans`.
- API bị ảnh hưởng: nhóm `/api/v1/video`, `/api/v1/children/{id}/video`, `/api/v1/student/video`, `/api/v1/video/webhook` (không cần trường), `/api/v1/video/recordings/{id}/stream` (đường dẫn ký).
- Giao diện bị ảnh hưởng: MH-410 đến MH-414, MH-350, MH-354.
- Quyền bị ảnh hưởng: PQ-120 (không thêm mã quyền).
- Ảnh hưởng chức năng cũ: không (video tắt thì không có gì mới); nền tảng đặt giới hạn video cho gói thì trường dùng theo giới hạn.
- Kiểm thử cần thực hiện: `apps/api` (`video-rules`, `video`, `video-tenancy`, `tutoring`, `tenancy-matrix`); kiểm cấu hình hồ sơ vận hành có và không có hồ sơ `video`; e2e 190.
- Còn lại: đo thật và chốt giá băng thông (E-05); luật sư kết luận ghi hình (E-06); phát bản ghi theo đoạn; lưu khóa LiveKit mã hóa ở `platform`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-27 phần 27a, lớp video trực tiếp (YCTD-251).
- Chức năng mới: lớp video của buổi gia sư và phòng tức thời, phòng chờ, quyền theo vai trò, cha mẹ vào xem, học sinh vào lớp ở kênh student, bảng trắng, chia sẻ màn hình, ghi hình có đồng ý của cha mẹ và xem lại có nhật ký, điểm danh gợi ý từ nhật ký phòng, giới hạn phút và dung lượng bản ghi theo gói (P02-110, P02-111).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0160`, `0161`; nền tảng `0240`.
- Thay đổi API: nhóm `/video` (xem `17_DAC_TA_API.md`).
- Kiểm thử: CT-1250 đến CT-1257 (CT-27a-1 đến CT-27a-8): hàm thuần, luồng có cơ sở dữ liệu với bộ giả lập, cách ly hai trường ở hai bố cục, e2e 190.
- Rủi ro: chưa đo băng thông và Egress trên máy thật (E-05); ghi hình cần kết luận của luật sư (E-06).
- Khả năng tương thích: VIDEO_PROVIDER trống thì không có gì thay đổi.
- Phương án quay lui: tắt VIDEO_PROVIDER và hồ sơ `video`; hoàn lại commit gộp.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27a: lớp video trực tiếp (LiveKit tự host, phòng chờ, quyền theo vai trò, ghi hình có đồng ý của cha mẹ, điểm danh từ nhật ký phòng, giới hạn theo gói) | YCTD-251 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +3 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +3 |
| Màn hình dự kiến | Số lượng | +5 |
| Ca kiểm thử khởi đầu | Số lượng | +8 |
| Chức năng đã liệt kê | Số lượng | +2 |
| 10 | mã chức năng | +2 |
| 10 | còn hiệu lực | +2 |
| 14 | màn hình | +5 |
| 16 | bảng dự kiến | +7 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27 phần 27a (YCTD-251: lớp video trực tiếp) |
| 14_DAC_TA_GIAO_DIEN.md | MH-350 | YCTD-251: nút Lớp video của từng buổi mở bảng lớp video (MH-410) |
| 14_DAC_TA_GIAO_DIEN.md | MH-354 | YCTD-251: lớp video đang mở của buổi (vào xem, phòng chờ), ô đồng ý ghi hình theo chương trình |
| 16_CO_SO_DU_LIEU.md | tutoring_programs (từ YCTD-252) | YCTD-251: recording_enabled (ghi hình lớp video, cần đồng ý của cha mẹ) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-310 | Phòng video (YCTD-251): phòng của buổi gia sư do giáo viên dạy chương trình hoặc Ban Giám hiệu mở, phòng tức thời do giáo viên mở; tên phòng ở máy chủ video có mã trường; mã vào phòng dùng để vào trong 10 phút; giáo viên dạy là chủ phòng, Ban Giám hiệu vào xem, học sinh có đơn được duyệt nói và chia sẻ màn hình khi được cho, cha mẹ của học sinh đó vào xem và nói khi được cho; phòng chờ bật thì học sinh, cha mẹ đợi chủ phòng cho vào; phòng đã kết thúc không cấp mã vào |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-311 | Ghi hình lớp video (YCTD-251, Luật 91/2025 Điều 24, Nghị định 356/2025 Điều 21 khoản 5): trong trường tắt mặc định; chỉ ghi khi chương trình bật ghi hình và mọi học sinh có đơn được duyệt có đồng ý còn hiệu lực của cha mẹ (lưu bản chụp văn bản, rút lại được); "Đang ghi" luôn hiện; bản ghi giữ theo cấu hình trường (mặc định 30 ngày) trừ khi Ban Giám hiệu giữ vì tranh chấp; chỉ giáo viên dạy, Ban Giám hiệu, cha mẹ của học sinh có đơn xem được, bằng đường dẫn ký 5 phút, không tải xuống, mỗi lần xem ghi nhật ký |
| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-312 | Nhật ký phòng và giới hạn gói (YCTD-251): vào ra phòng ghi từ sự kiện có chữ ký của máy chủ video; học sinh vào ra phòng của buổi thành điểm danh gợi ý (BR-247); phút người dự mỗi tháng và dung lượng bản ghi còn giữ theo gói, vượt thì không mở phòng mới, không cấp mã vào, không ghi mới; kết thúc phòng ghi ra cho người còn trong phòng |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-115 | PQ-120 | Lớp video trực tiếp (YCTD-251, DT-27 phần 27a): không thêm mã quyền; mở, điều khiển phòng của buổi cho giáo viên dạy chương trình (`P02.tutoring.teach`) và Ban Giám hiệu (`P02.tutoring.manage`); cấu hình lớp video, giữ bản ghi cho `P02.tutoring.manage`; học sinh vào lớp bằng `P02.learning.study` ở kênh student; cha mẹ theo quan hệ phụ huynh với học sinh có đơn được duyệt |
| 10_YEU_CAU_CHUC_NANG.md | P02-102 | P02-110 | Lớp video trực tiếp (YCTD-251) | Giáo viên; Ban Giám hiệu; cha mẹ; học sinh | Buổi gia sư, người chờ, quyền nói, chia sẻ | Mở phòng, vào phòng, phòng chờ, cho nói, chia sẻ màn hình, bảng trắng, kết thúc; nhật ký vào ra thành điểm danh gợi ý | Phòng, nhật ký vào ra, điểm danh gợi ý | BR-310, BR-312, PQ-120 |
| 10_YEU_CAU_CHUC_NANG.md | P02-102 | P02-111 | Ghi hình và xem lại lớp video (YCTD-251) | Giáo viên; Ban Giám hiệu; cha mẹ | Đồng ý ghi hình theo chương trình, bản ghi | Đồng ý, rút đồng ý; bắt đầu, dừng ghi; xem lại bằng đường dẫn ký ngắn hạn; giữ bản ghi; xóa theo hạn | Bản ghi, nhật ký xem | BR-311, PQ-120 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-950 | Cho buổi gia sư có đơn được duyệt / Khi giáo viên dạy mở phòng, cha mẹ vào phòng chờ rồi được cho vào, giáo viên khác hoặc trường khác vào / Thì cha mẹ có mã xem (nói khi được cho), giáo viên khác và trường khác bị chặn (CT-1250, CT-1252, CT-1256, CT-1257; YCTD-251) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-951 | Cho phòng của buổi / Khi máy chủ video gửi sự kiện vào ra có chữ ký hoặc chữ ký sai / Thì nhật ký ghi đúng trường, học sinh vào muộn thành điểm danh gợi ý, chữ ký sai bị từ chối, vượt phút của gói thì không mở phòng (CT-1251, CT-1253, CT-1256; YCTD-251) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-952 | Cho chương trình có buổi lớp video / Khi ghi hình khi chưa bật, khi thiếu đồng ý, sau khi cha mẹ đồng ý; xem lại; rút đồng ý / Thì chỉ ghi được khi bật và đủ đồng ý, xem bằng đường dẫn ký có nhật ký, đường dẫn sửa bị từ chối, rút đồng ý thì không ghi được nữa (CT-1254, CT-1257; YCTD-251) |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-410 | Cổng: Gia sư trực tuyến › 2. Lịch buổi học › Lớp video (YCTD-251): mở lớp video của buổi; khung lớp video (micro, camera, chia sẻ màn hình, bảng trắng, "Đang ghi"); điều khiển phòng (người chờ và cho vào, cho nói, cho chia sẻ, mời ra, bắt đầu và dừng ghi, kết thúc, phút còn lại của gói); bản ghi của buổi và xem lại | Giáo viên dạy, Ban Giám hiệu |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-411 | Cổng: Gia sư trực tuyến › 4. Quy định dạy thêm › Lớp video trực tiếp (YCTD-251): người dự tối đa một phòng, thời hạn giữ bản ghi, phòng chờ; phút đã dùng và dung lượng bản ghi theo gói | Ban Giám hiệu sửa, giáo viên xem |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-412 | Ứng dụng giáo viên: Gia sư trong trường › Lớp video (YCTD-251): nút Lớp video của buổi, khung lớp video và điều khiển phòng như MH-410 | Giáo viên dạy |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-413 | Ứng dụng phụ huynh: Lớp video của con (YCTD-251): lớp đang mở của buổi, vào xem (phòng chờ), khung lớp video ở vai trò cha mẹ, ô đồng ý ghi hình từng chương trình kèm văn bản đồng ý | Cha mẹ |
| 14_DAC_TA_GIAO_DIEN.md | MH-401 | MH-414 | Ứng dụng phụ huynh, kênh học sinh: Lớp video gia sư (YCTD-251): lớp đang mở của buổi đã đăng ký, vào lớp (phòng chờ), micro, camera, chia sẻ màn hình khi được cho, bảng trắng | Học sinh |
| 16_CO_SO_DU_LIEU.md | tutoring_attendance, tutoring_room_events (từ YCTD-252) | video_settings, video_rooms (từ YCTD-251) | Cấu hình lớp video của trường và phòng video (BR-310; năm học `0160`) | cấu hình: max_participants, recording_retention_days, lobby_enabled (một dòng); phòng: kind (`session`, `instant`), tutoring_session_id (một buổi một phòng), title, host_user_id, status, provider, max_participants, lobby_enabled, recording_allowed |
| 16_CO_SO_DU_LIEU.md | tutoring_attendance, tutoring_room_events (từ YCTD-252) | video_room_admissions, video_room_events (từ YCTD-251) | Phòng chờ, quyền người dự và nhật ký vào ra (BR-310, BR-312; `0160`) | room_id, identity, role, display_name, user_id, child_id, admitted_at, can_speak, can_share; nhật ký: room_id, identity, role, kind (`join`, `leave`), at, source |
| 16_CO_SO_DU_LIEU.md | tutoring_attendance, tutoring_room_events (từ YCTD-252) | video_recording_consents, video_recordings, video_recording_views (từ YCTD-251) | Đồng ý ghi hình, bản ghi và nhật ký xem (BR-311; `0161`) | đồng ý: program_id, child_id, guardian_user_id, consent_text, consent_hash, consented_at, withdrawn_at; bản ghi: room_id, egress_id, storage_key, status, size_bytes, expires_at, hold_reason; lượt xem: recording_id, viewer_user_id, viewed_at |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1250 | P02-110 | CT-27a-1: quyền theo vai trò, tên phòng có mã trường, mã người dự | Đúng quyền; tên lạ trả null | Đạt; `apps/api/src/video/video-rules.test.ts`; 950 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1251 | P02-110 | CT-27a-2: phút người dự từ nhật ký vào ra; cấu hình nhà cung cấp, thiếu biến khi bật thì báo, giả lập không chạy ở môi trường thật | Đúng phút; lỗi khởi động rõ | Đạt; `apps/api/src/video/video-rules.test.ts`; 951 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1252 | P02-110 | CT-27a-3: giáo viên dạy mở phòng của buổi; cha mẹ vào phòng chờ, được cho vào thì có mã xem, được cho nói; giáo viên khác bị chặn | 403; chờ rồi sẵn sàng | Đạt; `apps/api/src/video/video.test.ts`; 950 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1253 | P02-110 | CT-27a-4: sự kiện gọi lại có chữ ký ghi nhật ký, học sinh vào muộn thành điểm danh gợi ý; chữ ký sai | 401; Vào muộn | Đạt; `apps/api/src/video/video.test.ts`; 951 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1254 | P02-111 | CT-27a-5: ghi hình cần bật và đồng ý; xem bằng đường dẫn ký có nhật ký; đường dẫn sửa; rút đồng ý | 422; 200; 403 | Đạt; `apps/api/src/video/video.test.ts`; 952 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1255 | P02-110 | CT-27a-6: kết thúc phòng ghi ra cho người còn trong phòng; phòng đã kết thúc không cấp mã; cấu hình của trường | 409; cấu hình lưu | Đạt; `apps/api/src/video/video.test.ts`; 950 | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1256 | P02-110 | CT-27a-7: cách ly phòng giữa hai trường ở hai bố cục; sự kiện về đúng trường; giới hạn phút của gói | 404; PLAN_LIMIT_EXCEEDED | Đạt; `apps/api/src/video/video-tenancy.test.ts`; 950, 951 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1257 | P02-110, P02-111 | CT-27a-8: giao diện: giáo viên mở lớp, cha mẹ đồng ý ghi hình và vào qua phòng chờ, ghi hình, xem lại, kết thúc | Phòng giả lập; xem lại bản ghi | Do CI chạy; `tests/e2e/190-video-room.spec.ts`; 950, 952 | Cao |
