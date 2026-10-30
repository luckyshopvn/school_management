---
yctd: YCTD-391
tieu_de: Giám thị và rèn luyện từng học sinh, lát L2: ghi nhận vi phạm, khen trên ứng dụng giáo viên
ngay: 2026-10-30
phien_ban_de_xuat: 0.253.0
---

## 02 Nhật ký

### 2026-10-30 — Giám thị và rèn luyện từng học sinh, lát L2: ghi nhận vi phạm, khen trên ứng dụng giáo viên (YCTD-391)

#### Công việc đã thực hiện

- Ứng dụng giáo viên, nút "Ghi nhận rèn luyện" ở trang chủ cho người có `P02.supervision.record` (`apps/teacher/src/screens/SupervisionScreen.tsx`): màn hình Ca trực hôm nay (MH-676: số vi phạm, khen mình ghi hôm nay, danh sách, thu hồi kèm lý do) và Ghi nhận (MH-677: tìm học sinh theo tên hoặc lớp, chọn nhiều học sinh, chọn vi phạm hoặc khen và mục nội quy cùng cấp, khu vực, mô tả, chụp tối đa 3 ảnh).
- Máy chủ API: `apps/api/src/supervision/supervision-records.ts` (ghi nhận, danh sách, thu hồi, tìm học sinh, phạm vi), `supervision-access.ts` (phạm vi ghi nhận, xem); `apps/api/src/files/files.ts` thêm mục đích tệp `conduct_evidence`.
- Database migration: năm học `0241_create_student_conduct_records` (bảng `student_conduct_records`, thêm `conduct_evidence` vào ràng buộc mục đích tệp); định danh `0196_add_gate_pass_record_to_supervisor` (VT-22 được `P04.gate-pass.record` của YCTD-389).
- Kiểm thử: `apps/api/src/supervision/supervision-records.test.ts` (CT-1901 đến CT-1905).

#### Quyết định

- Danh sách lát và các mặc định Q5 đến Q8: phiên điều phối duyệt thay Eric theo khuyến nghị, Eric có thể đổi.
- Claude tự chọn theo ủy quyền:
  - phạm vi ghi nhận là hợp của: lớp trong phạm vi đơn vị của người quản lý rèn luyện; lớp mình chủ nhiệm hoặc dạy; lớp thuộc cấp, khối của phân công trực đang dùng (không xét giờ trực, để ghi bù sau ca); Quản lý đơn vị (VT-03) chỉ ghi được khi có phân công;
  - người ghi xem ghi nhận của mình; người khác xem ghi nhận của lớp trong phạm vi; ảnh bằng chứng xem theo phạm vi xem ghi nhận, chưa gắn thì chỉ người tải lên;
  - thu hồi: người ghi trong ngày ghi (giờ Việt Nam), giáo viên chủ nhiệm của lớp, người quản lý rèn luyện; bắt buộc lý do; không xóa dòng ghi nhận; dòng điểm nề nếp lớp đi kèm bị xóa;
  - mục nội quy có gắn tiêu chí nề nếp lớp chỉ ghi thêm điểm lớp khi trường đã bật nề nếp; mỗi học sinh một dòng điểm;
  - báo giáo viên chủ nhiệm trong ứng dụng (mã mẫu `conduct_record_created`), không báo chính người ghi; báo phụ huynh làm ở lát L3;
  - ảnh bằng chứng chỉ JPEG, PNG; tự xóa sau 30 ngày (Q7) làm ở lát L3 cùng chính sách lưu giữ;
  - quét thẻ QR học sinh trong màn hình Ghi nhận chờ YCTD-389 lát L1 (thẻ QR) được gộp; giám thị dùng màn hình quét ở cổng của YCTD-389 nhờ quyền `P04.gate-pass.record`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-391, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md` mục 17.14, `27_MA_TRAN_TRUY_VET.md`.

#### Vấn đề tồn đọng

- Lát L3: sổ rèn luyện, biện pháp theo Thông tư 19/2025, phụ huynh xem, tin gộp cuối ngày, xóa ảnh hết hạn.
- PR này nối tiếp PR lát L1; gộp sau L1 và sau YCTD-389 lát L1 (quyền `P04.gate-pass.record`).

## 24 Yêu cầu thay đổi

### YCTD-391: Ứng dụng giám thị và theo dõi rèn luyện từng học sinh, lát L2: ghi nhận vi phạm, khen – 2026-10-30

- Lý do: lát L2 theo danh sách lát Eric duyệt ngày 2026-10-30.
- Nội dung thay đổi: ghi nhận vi phạm, khen từng học sinh trên ứng dụng giáo viên; ảnh bằng chứng; ghi thêm điểm nề nếp lớp theo mục nội quy; báo giáo viên chủ nhiệm; thu hồi; giám thị được quét thẻ ở cổng.
- Thành phần bị ảnh hưởng: `apps/api/src/supervision/`, `apps/api/src/files/files.ts`, `apps/api/src/application.module.ts`, `apps/teacher/src/Application.tsx`, `apps/teacher/src/screens/ClassesScreen.tsx`, `apps/teacher/src/screens/SupervisionScreen.tsx`, `database/school-year` (bảng mới, ràng buộc mục đích tệp), `database/identity` (gán quyền), tài liệu 07, 08, 10, 11, 14, 16, 17, 21, 27.
- Dữ liệu, API, quyền bị ảnh hưởng: bảng năm học `student_conduct_records`; giá trị `conduct_evidence` của `files.purpose`; điểm cuối mới `/supervision/my-scope`, `/supervision/students`, `/supervision/records`; VT-22 thêm `P04.gate-pass.record`.
- Ảnh hưởng chức năng cũ: nề nếp lớp có thêm dòng điểm do ghi nhận từng học sinh tạo (ghi chú "Ghi nhận … của …"); tệp các mục đích khác không đổi.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/supervision/*.test.ts`, `apps/api/src/files/*.test.ts`, `apps/api/src/boarding/boarding.test.ts`.
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: giám thị và rèn luyện từng học sinh, lát L2: ghi nhận vi phạm, khen trên ứng dụng giáo viên (YCTD-391).
- Database migration: năm học `0241_create_student_conduct_records`, định danh `0196_add_gate_pass_record_to_supervisor`. Quay lui: chạy `down` của hai tệp (xóa bảng ghi nhận, xóa tệp `conduct_evidence`, trả ràng buộc mục đích tệp; bỏ gán quyền). Dòng điểm nề nếp lớp đã tạo giữ nguyên.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Giám thị và rèn luyện từng học sinh, lát L2: ghi nhận vi phạm, khen | YCTD-391 |

## index Số đếm

| 14 | màn hình | +2 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-391 lát L2 (ghi nhận vi phạm, khen từng học sinh) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-487 | Ghi nhận rèn luyện từng học sinh (YCTD-391): người có `P02.supervision.record` ghi cho học sinh đang học ở lớp trong phạm vi (lớp trong phạm vi đơn vị nếu có quyền quản lý rèn luyện; lớp mình chủ nhiệm, dạy; lớp thuộc cấp, khối của phân công trực đang dùng); mục nội quy đang dùng, cùng cấp với lớp; 1 đến 30 học sinh mỗi lần, mỗi học sinh một ghi nhận; khu vực đang dùng; mô tả tối đa 500 ký tự; tối đa 3 ảnh JPEG, PNG do chính người ghi vừa tải, chưa gắn ghi nhận khác; thời điểm không sau hiện tại. Mục gắn tiêu chí nề nếp lớp và trường đã bật nề nếp thì ghi thêm một dòng điểm cho lớp mỗi học sinh. Báo giáo viên chủ nhiệm của lớp trong ứng dụng. Ghi nhận không tự trừ điểm, không tự xếp mức rèn luyện |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-488 | Xem, thu hồi ghi nhận rèn luyện (YCTD-391): người ghi xem ghi nhận của mình; người khác xem ghi nhận của lớp trong phạm vi; ảnh bằng chứng xem theo phạm vi xem ghi nhận. Thu hồi bắt buộc lý do, do người ghi trong ngày ghi (giờ Việt Nam), giáo viên chủ nhiệm của lớp hoặc người quản lý rèn luyện; giữ dòng ghi nhận với người, lý do, thời điểm thu hồi; xóa dòng điểm nề nếp lớp đi kèm; ghi nhận đã thu hồi không thu hồi lại |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-191 | PQ-194 | Ghi nhận rèn luyện (YCTD-391 lát L2): phạm vi ghi nhận, xem theo BR-487, BR-488; tệp `conduct_evidence` tải lên cần `P02.supervision.record` ở đơn vị của tệp. VT-22 có thêm `P04.gate-pass.record` (quét thẻ học sinh ở cổng, YCTD-389) |
| 10_YEU_CAU_CHUC_NANG.md | P02-136 | P02-140 | Ghi nhận vi phạm, khen từng học sinh (YCTD-391) | VT-22, VT-07, VT-08, VT-02, VT-15 (`P02.supervision.record`) | Học sinh, mục nội quy, khu vực, mô tả, ảnh bằng chứng | Kiểm phạm vi, cùng cấp; lưu mỗi học sinh một ghi nhận; ghi điểm nề nếp lớp theo mục; báo giáo viên chủ nhiệm | Màn hình Ghi nhận (MH-677) | BR-487 |
| 10_YEU_CAU_CHUC_NANG.md | P02-136 | P02-141 | Ca trực hôm nay, xem và thu hồi ghi nhận (YCTD-391) | Người ghi; giáo viên chủ nhiệm; người quản lý rèn luyện | Ngày, lớp, học sinh; lý do thu hồi | Liệt kê ghi nhận; thu hồi, xóa điểm lớp đi kèm | Màn hình Ca trực hôm nay (MH-676) | BR-488 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1265 | Cho giám thị trực khối 6, giáo viên bộ môn dạy lớp 7A / Khi mở Ghi nhận rèn luyện, tìm học sinh / Thì giám thị chỉ thấy lớp 6A và học sinh lớp 6A, giáo viên bộ môn chỉ thấy lớp 7A; chọn lớp ngoài phạm vi bị từ chối (CT-1901; YCTD-391) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1266 | Cho mục nội quy vi phạm gắn tiêu chí nề nếp trừ 2 điểm, trường đã bật nề nếp / Khi giám thị ghi cho hai học sinh lớp 6A / Thì có hai ghi nhận, lớp 6A có hai dòng trừ 2 điểm, giáo viên chủ nhiệm 6A nhận tin; mục khen không gắn tiêu chí thì không ghi điểm lớp (CT-1902; YCTD-391) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1267 | Cho giám thị / Khi ghi cho học sinh ngoài phạm vi, mục khác cấp, không chọn học sinh / Thì bị từ chối; giáo viên chủ nhiệm thấy ghi nhận của lớp mình, không thấy lớp khác; giáo viên bộ môn xem được ghi nhận của mình (CT-1903; YCTD-391) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1268 | Cho ảnh bằng chứng giám thị chụp / Khi gắn vào ghi nhận lớp 6A / Thì giáo viên chủ nhiệm 6A xem được ảnh, giáo viên lớp khác không xem được; ảnh đã gắn hoặc ảnh người khác tải không gắn được (CT-1904; YCTD-391) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1269 | Cho ghi nhận có điểm nề nếp lớp đi kèm / Khi thu hồi / Thì bắt buộc lý do; người ghi trong ngày và giáo viên chủ nhiệm thu hồi được, người khác không; dòng điểm lớp bị xóa; không thu hồi lại được (CT-1905; YCTD-391) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.2 Ứng dụng giáo viên | MH-676 | Ca trực hôm nay (YCTD-391, nút "Ghi nhận rèn luyện" ở trang chủ): số vi phạm, khen mình ghi hôm nay; nút Ghi nhận mới; danh sách ghi nhận hôm nay (học sinh, lớp, mục, khu vực, giờ, trạng thái); Thu hồi kèm lý do | Người có `P02.supervision.record` |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.2 Ứng dụng giáo viên | MH-677 | Ghi nhận vi phạm, khen (YCTD-391): tìm học sinh theo tên hoặc lớp trong phạm vi, chọn nhiều học sinh; chọn Vi phạm hoặc Khen, mục nội quy cùng cấp; khu vực; mô tả; chụp tối đa 3 ảnh; Lưu ghi nhận; báo kết quả có ghi điểm nề nếp lớp hay không | Người có `P02.supervision.record` |
| 16_CO_SO_DU_LIEU.md | class_log_settings (từ YCTD-171) | student_conduct_records (từ YCTD-391) | Ghi nhận vi phạm, khen từng học sinh (tệp năm học `0241`) | id, child_id, class_id, rule_item_id, rule_name và kind (chép lúc ghi), occurred_at, zone_id, description (tối đa 500), evidence_file_ids (tối đa 3 tệp `conduct_evidence`), source (`manual`, `gate`, `camera_alert`), class_conduct_entry_id (dòng điểm nề nếp lớp đi kèm), recorded_by, recorded_by_name, status (`active`, `revoked`), revoked_reason, revoked_by_name, revoked_at, created_at |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1901 | P02-140 | CT-391-7: phạm vi của giám thị trực khối 6 và giáo viên bộ môn lớp 7A; tìm học sinh theo tên; giám thị chọn lớp 7A; tìm 1 ký tự | Giám thị thấy 6A, hai học sinh 6A; bộ môn thấy 7A; 7A 403; 1 ký tự 400 | Kiểm thử tự động `apps/api/src/supervision/supervision-records.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1902 | P02-140 | CT-391-8: giám thị ghi vi phạm có gắn tiêu chí cho hai học sinh 6A; ghi khen không gắn tiêu chí | 201, hai ghi nhận, hai dòng điểm lớp -2, chủ nhiệm 6A nhận hai tin; khen không ghi điểm lớp | Kiểm thử tự động `supervision-records.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1903 | P02-141 | CT-391-9: học sinh ngoài phạm vi, mục khác cấp, không chọn học sinh; bộ môn ghi lớp 7A; chủ nhiệm 6A xem danh sách; bộ môn xem của mình | 403, 422, 400; 201; chủ nhiệm không thấy học sinh 7A; bộ môn thấy đúng ghi nhận của mình | Kiểm thử tự động `supervision-records.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1904 | P02-140 | CT-391-10: tải ảnh `conduct_evidence`, gắn ghi nhận; chủ nhiệm, bộ môn lớp khác tải ảnh; gắn lại ảnh đã gắn; gắn ảnh người khác tải | 201; chủ nhiệm 200, bộ môn 403; gắn lại 400; ảnh người khác 400 | Kiểm thử tự động `supervision-records.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1905 | P02-141 | CT-391-11: thu hồi không lý do; bộ môn thu hồi ghi nhận lớp khác; người ghi thu hồi trong ngày; thu hồi lần hai; chủ nhiệm thu hồi ghi nhận lớp mình | 400; 403; 200 và xóa dòng điểm lớp; 422; 200 | Kiểm thử tự động `supervision-records.test.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-391 (lát L2) | Ứng dụng giám thị và rèn luyện từng học sinh, lát L2: ghi nhận vi phạm, khen trên ứng dụng giáo viên | {PHIEN_BAN} | P02-140, P02-141 | AC-1265 đến AC-1269 | CT-1901 đến CT-1905 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/supervision/supervision-records.ts`, `apps/teacher/src/screens/SupervisionScreen.tsx` | Kiểm thử tự động trên máy ngày 30/10/2026; CI của PR |
