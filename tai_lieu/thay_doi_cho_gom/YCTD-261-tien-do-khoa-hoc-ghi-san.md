---
yctd: YCTD-261
tieu_de: DT-27 phần 27d2: tiến độ của khoá học ghi sẵn cho học sinh, giáo viên, phụ huynh
ngay: 2026-10-27
phien_ban_de_xuat: 0.163.0
---

## 02 Nhật ký

### 2026-10-27 — DT-27 phần 27d2: tiến độ của khoá học ghi sẵn

#### Công việc đã thực hiện

- Phần thứ hai của 27d (tách ở YCTD-254), làm sau khi 28d gộp (PR 206); nhánh tách từ 27d1 (PR 208).
- Máy chủ `apps/api/src/tutoring/tutoring-courses.ts`: học sinh báo phần trăm đã xem video, ghi kết quả hoạt động và nhật ký học tập của 28b; xem video ở kênh học sinh theo điều kiện mở của 28b; tiến độ của em trong khoá cho cha mẹ, học sinh; tiến độ từng học sinh cho giáo viên dạy, Ban Giám hiệu.
- Giao diện: bảng tiến độ học sinh ở khối Khoá học ghi sẵn (cổng quản trị); phần trăm đã xem từng video và tiến độ của em (ứng dụng phụ huynh, kênh học sinh); trình phát ở kênh học sinh báo phần trăm đã xem.
- Kiểm thử: CT-27d2-1, CT-27d2-2.

#### Quyết định

- Không thêm bảng, không thêm migration: tiến độ là `activity_results` (cột `progress`) và `learning_events` của 28b, nên bảng tiến độ, sổ điểm, báo cáo, tóm tắt hằng tuần của 28d tự thấy khoá học ghi sẵn như mọi khoá tự chọn. Số năm học 0157 của kế hoạch không dùng.
- Phần trăm đã xem chỉ tăng; xem từ 90% thì hoàn thành nếu cách tính của hoạt động là "xem xong" (cách tính khác chỉ ghi phần trăm); hoạt động đã xong thì giữ nguyên. Trình phát báo mỗi khi qua mốc 10% và khi xem hết.
- Chỉ học sinh (kênh student) ghi tiến độ; cha mẹ, giáo viên xem video không tính là em đã xem. Mở video ở kênh học sinh ghi nhật ký "mở", không hoàn thành ngay như hoạt động xem được thường của 28b.
- Tiến độ của em dùng cùng cách tính với danh sách học của 28b (hoạt động bắt buộc xong, quá hạn, phần trăm).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-261, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-351, P02-116, AC-1012, AC-1013, CT-1298, CT-1299.

#### Vấn đề tồn đọng

- Phần trăm đã xem do trình phát báo (không kiểm ở máy chủ từng đoạn đã tải); đủ cho theo dõi học tập, không dùng để chấm điểm.

## 24 Yêu cầu thay đổi

### YCTD-261: DT-27 phần 27d2: tiến độ của khoá học ghi sẵn cho học sinh, giáo viên, phụ huynh – 2026-10-27

- Lý do: phần còn lại của 27d sau khi tách (YCTD-254), cần tiến độ, bảng điểm hoạt động của 28d (YCTD-274), nay 28d đã gộp (PR 206). Phiên điều phối giao ngày 2026-10-27.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Tiến độ xem video**: học sinh ở kênh student xem bài video của khoá; trình phát báo phần trăm đã xem; máy chủ ghi kết quả hoạt động của 28b (`activity_results`: phần trăm chỉ tăng, từ 90% là hoàn thành nếu cách tính là "xem xong") và nhật ký học tập (mở, đang xem, hoàn thành). Bài còn khoá theo điều kiện mở của 28b thì không lấy được đường dẫn xem.
  - **Cha mẹ, học sinh**: khoá học trả thêm tiến độ của em: hoạt động bắt buộc đã xong, quá hạn, phần trăm; từng hoạt động (trạng thái, điểm, chưa mở); phần trăm đã xem từng video.
  - **Giáo viên dạy, Ban Giám hiệu**: bảng tiến độ từng học sinh của khoá: hoạt động bắt buộc đã xong, quá hạn, phần trăm đã xem từng video. Bảng tiến độ, sổ điểm, báo cáo đầy đủ ở Học trực tuyến của 28d.
  - Không thêm bảng, không thêm mã quyền.
- Thành phần bị ảnh hưởng: `apps/api` (`tutoring/tutoring-courses*.ts`), `packages/ui` (`LessonVideoList`, `LessonCourseProgress`), `apps/portal`, `apps/parent`.
- Dữ liệu bị ảnh hưởng: dòng `activity_results`, `learning_events` của 28b cho hoạt động video của khoá học ghi sẵn.
- API bị ảnh hưởng: `GET /api/v1/tutoring/programs/{id}/course/progress`, `POST /api/v1/student/tutoring/course-media/{aid}/progress`; thêm `progress` vào `GET /api/v1/children/{id}/tutoring/programs/{pid}/course`, `GET /api/v1/student/tutoring/courses`.
- Giao diện bị ảnh hưởng: MH-349, MH-354.
- Quyền bị ảnh hưởng: không (như PQ-145 của YCTD-254).
- Ảnh hưởng chức năng cũ: mở video khoá gia sư ở kênh học sinh nay theo điều kiện mở của 28b.
- Kiểm thử cần thực hiện: `apps/api` (`tutoring-courses`, `learning`); kiểm tĩnh.
- Còn lại: chuyển mã nhiều độ phân giải (tuỳ chọn, mặc định tắt).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-27 phần 27d2, tiến độ của khoá học ghi sẵn (YCTD-261).
- Chức năng mới: tiến độ xem video ghi kết quả hoạt động của 28b; tiến độ của em cho cha mẹ, học sinh; bảng tiến độ học sinh cho giáo viên (P02-116).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không.
- Thay đổi API: tiến độ khoá học ở `/tutoring`, `/children/{id}/tutoring`, `/student/tutoring`.
- Kiểm thử: CT-1298, CT-1299 (CT-27d2-1, CT-27d2-2).
- Rủi ro: thấp.
- Khả năng tương thích: mở video ở kênh học sinh nay theo điều kiện mở của 28b.
- Phương án quay lui: hoàn lại commit gộp; kết quả đã ghi là dòng kết quả hoạt động bình thường của 28b.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-27 phần 27d2: tiến độ của khoá học ghi sẵn (phần trăm đã xem video ghi kết quả hoạt động của 28b, tiến độ cho học sinh, phụ huynh, giáo viên) | YCTD-261 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +1 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +2 |
| Ca kiểm thử khởi đầu | Số lượng | +2 |
| Chức năng đã liệt kê | Số lượng | +1 |
| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |

## Nối dòng

| 32_KE_HOACH_THEO_HE_THONG_SO.md | 27d | 27d2 đã làm (YCTD-261): tiến độ xem video ghi kết quả hoạt động của 28b, tiến độ của em cho cha mẹ và học sinh, bảng tiến độ học sinh cho giáo viên; không thêm migration (năm học 0157 không dùng) |
| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-27 phần 27d2 (YCTD-261: tiến độ của khoá học ghi sẵn) |
| 14_DAC_TA_GIAO_DIEN.md | MH-349 | YCTD-261: bảng tiến độ học sinh của khoá học ghi sẵn (hoạt động bắt buộc xong, quá hạn, phần trăm đã xem từng video) |
| 14_DAC_TA_GIAO_DIEN.md | MH-354 | YCTD-261: tiến độ của con trong khoá học ghi sẵn, phần trăm đã xem từng video; kênh học sinh báo phần trăm đã xem |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-280 | BR-351 | Tiến độ khoá học ghi sẵn (YCTD-261): chỉ học sinh ở kênh student ghi tiến độ xem video; phần trăm đã xem chỉ tăng; xem từ 90% thì hoàn thành nếu cách tính là "xem xong"; hoạt động đã xong giữ nguyên; bài còn khoá theo điều kiện mở của 28b thì không xem được; tiến độ là kết quả hoạt động của 28b nên bảng tiến độ, sổ điểm, báo cáo của 28d dùng chung |
| 10_YEU_CAU_CHUC_NANG.md | P02-102 | P02-116 | Tiến độ khoá học ghi sẵn của chương trình gia sư (YCTD-261) | Học sinh; cha mẹ; giáo viên; Ban Giám hiệu | Phần trăm đã xem video, kết quả hoạt động của 28b | Ghi tiến độ xem video, xem tiến độ của em, xem tiến độ từng học sinh | Kết quả hoạt động, nhật ký học tập | BR-351 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1012 | Cho khoá có bài 2 mở sau bài 1 / Khi học sinh mở bài 2, xem bài 1 được 30%, báo 20%, báo 95%, rồi mở bài 2 / Thì bài 2 bị chặn trước, phần trăm giữ 30 khi báo 20, bài 1 hoàn thành ở 95%, bài 2 mở sau đó, nhật ký học tập có mở, đang xem, hoàn thành (CT-1298; YCTD-261) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-944 | AC-1013 | Cho học sinh đã xem xong bài 1 trong ba hoạt động bắt buộc / Khi cha mẹ, giáo viên dạy, giáo viên khác xem tiến độ / Thì cha mẹ thấy 1/3 (33%) và phần trăm từng video, giáo viên dạy thấy dòng của em, giáo viên khác bị chặn (CT-1299; YCTD-261) |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1298 | P02-116 | CT-27d2-1: học sinh mở bài còn khoá, báo 150, 30, 20, 95, 100 phần trăm, mở bài tiếp theo | 422; 400; 30; 30; hoàn thành 95; giữ 95; 200 | Đạt; `apps/api/src/tutoring/tutoring-courses.test.ts`; 1012 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1204 | CT-1299 | P02-116 | CT-27d2-2: cha mẹ xem tiến độ của con, giáo viên dạy, giáo viên khác xem tiến độ khoá | 1/3 (33%), video 95; dòng của em; 403 | Đạt; `apps/api/src/tutoring/tutoring-courses.test.ts`; 1013 | Cao |
