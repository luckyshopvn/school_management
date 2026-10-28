---
yctd: YCTD-277
tieu_de: DT-28 phần 28g: giờ học trực tuyến, phòng nhóm, phòng chia nhỏ
ngay: 2026-10-28
phien_ban_de_xuat: 0.172.0
---

## 02 Nhật ký

### 2026-10-28 — DT-28 phần 28g: giờ học trực tuyến, phòng nhóm, phòng chia nhỏ

#### Công việc đã thực hiện

- Làm phần 28g theo `32` mục 20.6, 20.7. **GD-144 Eric đã chốt 2026-10-28** ("Trường tự cấu hình"):
  - Mặc định không giới hạn giờ.
  - Mỗi trường tự đặt khung giờ mở thảo luận và phòng học nhóm; ngoài giờ chỉ đọc.
  - Đã cập nhật các chỗ của 28e còn ghi "chưa chốt" (tệp mảnh YCTD-275, chú thích mã, dòng 28e và dòng GD-144 ở 32).
- **Dùng lại 27a**, không thêm dịch vụ video:
  - Bộ nối phòng video (LiveKit, bộ giả lập khi kiểm thử), tên phòng theo trường, mã vào phòng theo vai trò.
  - Sự kiện gọi lại có chữ ký và giới hạn phút của gói. Thêm cửa `VideoRoomExtension` ở `VideoRoomsService`: sự kiện của phòng không thuộc 27a chuyển cho 28g, phút người dự của 28g cộng vào phút của gói.
- **Giờ học trực tuyến** (loại hoạt động `live_session`):
  - Giáo viên tạo ở ứng dụng giáo viên: giờ bắt đầu là `opens_at` (lịch học tập của 28e tự hiện), thời lượng 5 đến 240 phút.
  - Giáo viên mở phòng, vào làm chủ phòng; học sinh vào khi hoạt động đã giao, đang mở với em và phòng đang mở; Ban Giám hiệu, tổ trưởng vào xem.
  - Điểm danh gợi ý từ nhật ký vào ra (cả phòng chia nhỏ): có mặt khi dự từ nửa thời lượng, vào muộn hoặc ra sớm, vắng. Giáo viên xác nhận mới ghi kết quả hoạt động.
  - Không ghi hình (GD-131 của 27a giữ tắt).
- **Phòng chia nhỏ** từ phòng giờ học:
  - Chia theo bộ nhóm có sẵn hoặc ngẫu nhiên có hạt; lớp học trực tuyến gắn lớp thì lưu thành bộ nhóm `classroom`.
  - Có hạn phòng; thông báo tới mọi phòng; chuyển học sinh; học sinh "gọi giáo viên"; gọi tất cả về phòng chính.
- **Phòng nhóm** theo nhóm của bộ nhóm (28a):
  - Người lập bộ nhóm, giáo viên của lớp mở và vào bất cứ lúc nào.
  - Học sinh tự mở chỉ khi giáo viên bật cho bộ nhóm và trong giờ mở của trường.
  - Học sinh luôn thấy "Giáo viên đang xem phòng này" (GD-149).
  - Báo cáo từ phòng vào hàng chờ của 28e.
- **Giao diện:**
  - Ứng dụng giáo viên: `LiveScreen.tsx`, `LiveSessionScreen.tsx`.
  - Học sinh (`#hoc-sinh`): `StudentLivePanel.tsx`.
  - `VideoRoom` của `packages/ui` nhận nhãn vai trò.
  - Cổng quản trị: dòng giải thích giờ mở ở 9.5 nói rõ áp dụng cho cả phòng nhóm.
- **Đăng ký theo cơ chế của YCTD-294:**
  - Kiểu bảng: `database/school-year/schema-parts/dt-28g-hoc-truc-tuyen-truc-tiep.ts`.
  - Bộ điều khiển: `apps/api/src/dang-ky/dt-28g-hoc-truc-tuyen-truc-tiep.ts`.
  - Không sửa danh sách chung.
- **Kiểm thử:**
  - 5/5 ca thuần `live-rules.test.ts`, 3/3 ca API `live.test.ts`.
  - Hồi quy `video`, `discussions`, `learning`.
  - e2e `220-live-sessions` chạy kèm spec nền 01 đến 09.

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-277):
  - Giờ mở phòng nhóm dùng chung cấu hình `discussion_open_hours` của 28e.
  - Phòng giáo viên mở không theo giờ mở; phòng học sinh tự mở thì ngoài giờ không mở, không vào được.
  - Báo cáo từ phòng gắn chủ đề hệ thống "Phòng video" (đã khoá) của nhóm hoặc của lớp học trực tuyến, để dùng nguyên hàng chờ, phạm vi xử lý của 28e.
  - "Giáo viên đang xem" theo người đang trong phòng: có khi cấp mã vào, hết khi giáo viên bấm rời phòng hoặc máy chủ video báo rời.
  - Khoá tự chọn không gắn lớp: phòng nhóm, phòng chia nhỏ theo bộ nhóm dùng các bộ nhóm do chính giáo viên lập; chia ngẫu nhiên không lưu bộ nhóm.
- Migration năm học 0187, 0188 (dải giữ sẵn); không thêm quyền.
- Mã khối riêng (BR-410, AC-1070, MH-510, CT-1370, BM-215, PQ-175, P03-65); mục mới 12Q, 18P, 17.10 đặt sau mục của 28j.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-277, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Ghi hình giờ học của trường (GD-131) chưa làm.
- Gợi ý giờ học theo tiết của thời khoá biểu chưa làm.
- Phụ huynh chưa xem điểm danh giờ học trực tuyến riêng; kết quả hoạt động vẫn hiện như mọi hoạt động.

## 24 Yêu cầu thay đổi

### YCTD-277: DT-28 phần 28g: giờ học trực tuyến, phòng nhóm, phòng chia nhỏ – 2026-10-28

- Lý do: phần 28g của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270): dạy học trực tuyến trực tiếp trong lớp học trực tuyến và học nhóm có video.
- Căn cứ:
  - Thông tư 09/2021/TT-BGDĐT Điều 9 khoản 1 (phần mềm tổ chức dạy học trực tuyến trực tiếp có kênh hình, tiếng, chữ, chia sẻ màn hình), theo phần tóm tắt ở 20.2.
  - Luật Trẻ em, Luật 91/2025 Điều 24 theo phần tóm tắt ở 20.2: giáo viên luôn thấy phòng nhóm, học sinh biết khi giáo viên đang xem, không ghi hình. Phiên này không đọc lại văn bản gốc.
  - GD-144: **Eric đã chốt 2026-10-28** ("Trường tự cấu hình").
  - GD-149 (giáo viên quan sát luôn hiện), GD-131 của 27a (ghi hình tắt mặc định).
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Loại hoạt động `live_session`**: cài đặt `duration_minutes` 5 đến 240 (mặc định 45); hoàn thành do giáo viên; không đặt trong khoá mẫu.
  - **Phòng** (`learning_live_rooms`): `live_session` gắn hoạt động, `group` gắn nhóm, `breakout` con của phòng giờ học. Mỗi hoạt động, mỗi nhóm chỉ một phòng đang mở.
  - **Vai trò:**
    - Chủ phòng: giáo viên dạy lớp học trực tuyến; người lập bộ nhóm, giáo viên của lớp với phòng nhóm.
    - Người xem: Ban Giám hiệu, tổ trưởng, người xử lý vi phạm.
    - Học sinh: nói, bật camera; chia sẻ màn hình ở phòng nhóm và phòng chia nhỏ.
  - **Điểm danh:** phút dự của từng học sinh từ nhật ký vào ra của phòng giờ học và phòng chia nhỏ. Gợi ý có mặt khi dự ít nhất nửa thời lượng. Giáo viên xác nhận ghi `activity_results`: có mặt là hoàn thành, vắng là chưa học, có phép là được miễn.
  - **Phòng chia nhỏ:**
    - 2 đến 20 phòng, mỗi lần 1 đến 120 phút.
    - Chia lại thì kết thúc các phòng cũ.
    - Gọi tất cả về thì kết thúc phòng chia nhỏ, đóng các lượt gọi giáo viên.
  - **Phòng nhóm:**
    - Cài đặt `learning_group_room_settings.student_open` theo bộ nhóm, tắt mặc định.
    - Học sinh tự mở khi đã bật và trong giờ mở.
    - Ngoài giờ mở học sinh không vào được phòng học sinh tự mở.
  - **Báo cáo:** dòng `discussion_reports` gắn chủ đề hệ thống đã khoá "Phòng video (báo cáo từ phòng học trực tuyến)". Lý do có tiền tố tên phòng.
- Thành phần bị ảnh hưởng:
  - `apps/api`:
    - Thư mục mới `learning/live`.
    - `video/video-rooms.ts`: cửa `VideoRoomExtension`.
    - `learning/learning-activity-kinds.ts`: thêm loại cuối danh mục.
    - Tệp đăng ký `dang-ky/dt-28g-hoc-truc-tuyen-truc-tiep.ts`.
  - `apps/teacher`: `LiveScreen.tsx`, `LiveSessionScreen.tsx`, `OnlineClassesScreen.tsx`.
  - `apps/parent`: `student/StudentLivePanel.tsx`.
  - `apps/portal`: dòng giải thích giờ mở ở `DiscussionSafetyPage.tsx`.
  - `packages/ui`: `VideoRoom.tsx` (nhãn vai trò).
  - `database`: năm học 0187, 0188, tệp kiểu bảng `schema-parts/dt-28g-hoc-truc-tuyen-truc-tiep.ts`.
  - `tests/e2e/220-live-sessions.spec.ts`.
- Dữ liệu bị ảnh hưởng: năm học `0187` (`learning_live_rooms`, `learning_live_participants`, `learning_live_events`, `learning_group_room_settings`), `0188` (`learning_breakout_members`, `learning_live_notices`, `learning_live_help_requests`).
- API bị ảnh hưởng: xem `17_DAC_TA_API.md` mục 17.10.
- Giao diện bị ảnh hưởng: MH-510, MH-511.
- Quyền bị ảnh hưởng: PQ-175 (không thêm mã quyền).
- Ảnh hưởng chức năng cũ:
  - Lớp video gia sư của 27a không đổi.
  - Phút của gói tính thêm phút người dự của 28g.
  - Giờ mở thảo luận nay cũng là giờ mở phòng nhóm.
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho; e2e `single` (spec 220 cùng các spec hiện có); typecheck, lint, build.
- Chưa làm (YCTD sau): ghi hình giờ học của trường; gợi ý giờ học theo tiết của thời khoá biểu; phụ huynh xem điểm danh giờ học trực tuyến.
- Trạng thái: Đã triển khai (GD-144 đã chốt 2026-10-28)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-28 phần 28g, giờ học trực tuyến, phòng nhóm, phòng chia nhỏ (YCTD-277; GD-144 đã chốt 2026-10-28).
- Chức năng mới:
  - Giờ học trực tuyến có phòng chia nhỏ, điểm danh từ nhật ký phòng (P03-65, MH-510).
  - Phòng video nhóm (P03-66, MH-511).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0187`, `0188`; xem `16_CO_SO_DU_LIEU.md` mục 18P.
- Thay đổi API: xem `17_DAC_TA_API.md` mục 17.10.
- Kiểm thử: kịch bản CT-1370 đến CT-1378 (CT-28g-1 đến CT-28g-9 trong mã kiểm thử).
- Rủi ro: máy chủ video không gửi sự kiện rời phòng thì "giáo viên đang xem" còn hiện tới khi giáo viên bấm rời phòng hoặc phòng kết thúc; phút của gói tăng khi dùng nhiều phòng nhóm.
- Khả năng tương thích: không đổi hành vi cũ khi trường không dùng giờ học trực tuyến, phòng nhóm.
- Phương án quay lui: hoàn lại commit gộp của nhánh 28g (migration chỉ thêm bảng).

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28g: giờ học trực tuyến (phòng lớp từ lịch, điểm danh từ nhật ký phòng), phòng chia nhỏ, phòng video nhóm có "giáo viên đang xem", báo cáo vào hàng chờ; GD-144 đã chốt 2026-10-28 (YCTD-277) | Đã triển khai |

## index Số đếm

| 10 | mã chức năng | +2 |
| 10 | còn hiệu lực | +2 |
| 14 | màn hình | +2 |
| Chức năng đã liệt kê | Số lượng | +2 |
| Chức năng đã liệt kê | mã; | +2 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +4 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +4 |
| Màn hình dự kiến | Số lượng | +2 |
| Ca kiểm thử khởi đầu | Số lượng | +9 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-510, MH-511 (YCTD-277) |

## Thêm dòng

| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-65 | Giờ học trực tuyến và phòng chia nhỏ (YCTD-277, DT-28 phần 28g) | Giáo viên, học sinh | Tên, giờ bắt đầu, thời lượng; số phòng hoặc bộ nhóm, thời lượng phòng chia nhỏ; điểm danh | Giáo viên mở phòng giờ học, học sinh vào khi phòng mở; chia phòng, thông báo, chuyển học sinh, gọi về; học sinh gọi giáo viên; điểm danh gợi ý từ nhật ký phòng, giáo viên xác nhận | Kết quả hoạt động | BR-410, BR-411, BR-412 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-66 | Phòng video nhóm (YCTD-277; GD-144 đã chốt 2026-10-28) | Giáo viên, học sinh | Bật cho học sinh tự mở theo bộ nhóm; lý do báo cáo | Giáo viên mở, vào xem bất cứ lúc nào; học sinh tự mở khi được bật và trong giờ mở; học sinh luôn thấy giáo viên đang xem; báo cáo vào hàng chờ của trường | Phòng nhóm, báo cáo | BR-413 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-410 | Giờ học trực tuyến (YCTD-277, DT-28 phần 28g): loại hoạt động `live_session`, giờ bắt đầu là giờ mở của hoạt động, thời lượng 5 đến 240 phút (mặc định 45); giáo viên dạy lớp học trực tuyến mở phòng sau khi giao; học sinh vào khi hoạt động đang mở với em và phòng đang mở; Ban Giám hiệu, tổ trưởng vào xem; không ghi hình; mỗi hoạt động một phòng đang mở; phút người dự tính vào phút lớp video của gói (vượt thì không mở, không vào) |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-411 | Điểm danh giờ học trực tuyến (YCTD-277): phút dự của từng học sinh từ nhật ký vào ra của phòng giờ học và phòng chia nhỏ; gợi ý có mặt khi dự từ nửa thời lượng, vào muộn hoặc ra sớm khi có dự chưa đủ, vắng khi không vào; chỉ giáo viên dạy lớp xác nhận; có mặt ghi hoàn thành, vắng ghi chưa học, có phép ghi được miễn |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-412 | Phòng chia nhỏ (YCTD-277): chỉ từ phòng giờ học đang mở; theo bộ nhóm của lớp (khoá tự chọn: bộ nhóm của chính giáo viên) hoặc ngẫu nhiên 2 đến 20 phòng có hạt, lưu thành bộ nhóm `classroom` khi gắn lớp; 1 đến 120 phút; mỗi học sinh một phòng; chia lại thì kết thúc phòng cũ; học sinh chỉ vào phòng của em; gọi về thì kết thúc mọi phòng chia nhỏ |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-413 | Phòng video nhóm (YCTD-277; GD-144 đã chốt 2026-10-28, GD-149): người lập bộ nhóm, giáo viên của lớp mở và vào bất cứ lúc nào; học sinh của nhóm tự mở chỉ khi giáo viên bật cho bộ nhóm (tắt mặc định) và trong giờ mở của trường (mặc định không giới hạn); ngoài giờ mở không mở, không vào phòng học sinh tự mở; học sinh luôn thấy "Giáo viên đang xem phòng này" khi giáo viên, người xem đang trong phòng; không ghi hình; báo cáo vào hàng chờ của trường (BR-344) |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-111 | PQ-175 | Giờ học trực tuyến, phòng nhóm (YCTD-277, DT-28 phần 28g): không thêm mã quyền; cán bộ cần một trong `P02.learning.teach`, `P02.learning.template`, `P02.learning.decide`, `P02.learning.view`, `P02.discussion.moderate`, kiểm tiếp theo lớp học trực tuyến (lõi 28b) hoặc nhóm (người lập bộ nhóm, giáo viên của lớp là chủ phòng; người xử lý vi phạm vào xem); học sinh `P02.learning.study` (kênh `student`) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1070 | Cho nhật ký vào ra của ba học sinh, giờ học 45 phút; 11 học sinh chia 3 phòng hạt 42 / Khi tính điểm danh gợi ý, chia ngẫu nhiên / Thì 38 phút có mặt, 10 phút vào muộn hoặc ra sớm, không vào vắng; cùng hạt cùng kết quả, mỗi em một phòng, lệch tối đa một | CT-1370, CT-1371, CT-1372, CT-1373, CT-1374 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1071 | Cho giờ học chưa giao, đã giao; giáo viên khác; học sinh vào ra theo sự kiện gọi lại / Khi mở phòng, học sinh vào, giáo viên xác nhận có mặt / Thì 422 khi chưa giao, 403 với giáo viên khác; học sinh vào khi phòng mở; điểm danh gợi ý có mặt; kết quả hoạt động hoàn thành nguồn `live_session` | CT-1375 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1072 | Cho phòng giờ học đang mở / Khi chia 2 phòng ngẫu nhiên, học sinh vào phòng của em, gọi giáo viên, giáo viên gửi thông báo, chuyển em, gọi về / Thì em thấy phòng của em và thông báo; giáo viên thấy lượt gọi; em thấy đã bị chuyển; sau gọi về không vào được phòng chia nhỏ | CT-1376 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1073 | Cho bộ nhóm chưa bật, đã bật; giờ mở của trường không gồm giờ hiện tại / Khi học sinh mở phòng nhóm, giáo viên vào xem rồi rời, học sinh báo cáo, học sinh vào ngoài giờ / Thì 422 khi chưa bật; mở được khi bật; "giáo viên đang xem" bật rồi tắt; báo cáo vào hàng chờ của nhóm; 422 ngoài giờ; giáo viên vẫn mở được | CT-1377, CT-1378 |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-510 | Ứng dụng giáo viên, lớp học trực tuyến, nút "Giờ học trực tuyến, phòng nhóm" (YCTD-277): khối "Thêm giờ học trực tuyến" (tên, bắt đầu lúc, thời lượng); màn hình giờ học: "Mở phòng giờ học", "Vào phòng giờ học", "Kết thúc giờ học"; khối "Phòng chia nhỏ" (chia theo, số phòng, thời lượng, "Chia phòng", lượt gọi giáo viên, "Chuyển học sinh", "Thông báo tới mọi phòng", "Gọi tất cả về phòng chính"); khối "Điểm danh giờ học" (phút dự, gợi ý, chọn có mặt, vắng, có phép, "Xác nhận điểm danh"). Học sinh (`#hoc-sinh`): khối "Học trực tuyến trực tiếp" với nút vào giờ học, sang phòng chia nhỏ, "Gọi giáo viên", thông báo của giáo viên |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-511 | Phòng video nhóm (YCTD-277): ứng dụng giáo viên khối "Phòng nhóm" (ô "Cho học sinh tự mở phòng của ...", nút mở phòng, vào xem, số người đang trong phòng, dòng nhắc ngoài giờ mở); học sinh nút "Mở phòng nhóm ...", "Vào phòng nhóm ...", dòng luôn hiện "Giáo viên đang xem phòng này", nút "Báo cáo phòng này" |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1370 | P03-65 | CT-28g-1: thời lượng giờ học mặc định 45 phút, ngoài 5 đến 240 phút báo lỗi | Đúng | Đạt 28/10/2026; `apps/api/src/learning/live/live-rules.test.ts`; AC-1070 | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1371 | P03-65 | CT-28g-2: điểm danh gợi ý từ nhật ký vào ra, gộp phòng chia nhỏ | Đúng | Đạt 28/10/2026; `live-rules.test.ts`; AC-1070 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1372 | P03-65 | CT-28g-3: chia ngẫu nhiên có hạt, mỗi học sinh một phòng | Đúng | Đạt 28/10/2026; `live-rules.test.ts`; AC-1070 | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1373 | P03-65 | CT-28g-4: yêu cầu chia phòng cần bộ nhóm hoặc số phòng hợp lệ và thời lượng | Đúng | Đạt 28/10/2026; `live-rules.test.ts`; AC-1070 | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1374 | P03-66 | CT-28g-5: "giáo viên đang xem" khi chủ phòng hoặc người xem còn trong phòng | Đúng | Đạt 28/10/2026; `live-rules.test.ts`; AC-1070 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1375 | P03-65 | CT-28g-6: giờ học: chỉ vào khi phòng mở; điểm danh từ nhật ký phòng, giáo viên xác nhận ghi kết quả | Đúng | Đạt 28/10/2026; `apps/api/src/learning/live/live.test.ts`; AC-1071 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1376 | P03-65 | CT-28g-7: phòng chia nhỏ: chia, vào phòng của em, gọi giáo viên, thông báo, chuyển, gọi về | Đúng | Đạt 28/10/2026; `live.test.ts`; AC-1072 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1377 | P03-66 | CT-28g-8: phòng nhóm: tự mở khi được bật và trong giờ mở; giáo viên đang xem; báo cáo vào hàng chờ | Đúng | Đạt 28/10/2026; `live.test.ts`; AC-1073 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1378 | P03-65, P03-66 | CT-28g-9: giao diện: giáo viên tạo, mở giờ học; học sinh vào, thấy giáo viên đang xem; chia phòng, gọi giáo viên, gọi về; xác nhận điểm danh; phòng nhóm học sinh mở, giáo viên vào xem, học sinh báo cáo | Đúng | Đạt 28/10/2026; e2e `tests/e2e/220-live-sessions.spec.ts`; AC-1071, AC-1072, AC-1073 | Cao |
| 22_BAO_MAT.md | BM-101 | BM-215 | Phòng video của học tập trực tuyến (YCTD-277, BR-410, BR-413; GD-149): dùng bộ nối, tên phòng theo trường và sự kiện gọi lại có chữ ký của 27a nên phòng của trường này không nhận sự kiện của trường khác; mã vào phòng cấp lại mỗi lần vào theo vai trò; học sinh chỉ vào phòng của lớp học trực tuyến, nhóm, phòng chia nhỏ của em; không ghi hình; không có phòng riêng giữa hai học sinh mà giáo viên không vào được; học sinh luôn biết khi giáo viên đang xem |
