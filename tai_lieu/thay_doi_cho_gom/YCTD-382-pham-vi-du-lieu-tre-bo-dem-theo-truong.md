---
yctd: YCTD-382
tieu_de: Phạm vi dữ liệu trẻ, bài thi trực tuyến và bộ nhớ đệm theo từng trường
ngay: 2026-10-29
phien_ban_de_xuat: 0.248.1
---

## 02 Nhật ký

### 2026-10-29 — Phạm vi dữ liệu trẻ, bài thi trực tuyến và bộ nhớ đệm theo từng trường

#### Công việc đã thực hiện

- Sửa các lỗi mức Cao L-33 đến L-37 theo đợt rà soát mã ngày 29/10/2026:
  - L-33: hồ sơ và danh sách trẻ (`GET /children`, `GET /children/:id`, xuất danh sách) trả sức khỏe, nhu cầu đặc biệt, hồ sơ CSDL ngành, dân tộc, diện chính sách, khuyết tật, biết bơi theo từng trẻ (BR-53, BR-107): vai trò văn phòng VT-02, VT-15, VT-03, VT-04, VT-09 trong đơn vị của vai trò, giáo viên chủ nhiệm (VT-07) với lớp đang chủ nhiệm, phụ huynh với con mình. Lọc theo cột nhạy cảm chỉ trả trẻ thuộc phạm vi này; sửa thông tin CSDL ngành cũng xét theo trẻ. Phạm vi mới ở `ChildScope.resolveHealth`;
  - L-34: `GET /children/:id/period-attendance` đòi quyền xem P02 và kiểm phạm vi xem trẻ (`ChildScope.assertCanRead`): phụ huynh của học sinh, nhân sự văn phòng trong đơn vị, giáo viên lớp được phân công;
  - L-35: giáo viên không phải người giao bài, không có quyền quản lý thi chỉ xem, chấm, nộp thay, hủy, đổi bài thi trực tuyến khi chủ nhiệm hoặc dạy môn của đề ở mọi lớp được giao (PQ-109);
  - L-36: bộ nhớ đệm cấp học tính khóa theo trường ở mỗi lần gọi;
  - L-37: bộ nhớ đệm cờ bản trình diễn ở máy chủ API và dịch vụ định danh tách theo mã trường.
- Kiểm thử CT-1723 đến CT-1728: hỏng trên mã cũ, đạt trên mã mới.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - cờ `health_fields_visible` của danh sách vẫn theo vai trò để màn hình hiện cột; giá trị của trẻ ngoài phạm vi trả trống;
  - bài thi giao cho nhiều lớp: giáo viên chỉ có phạm vi một phần lớp không thao tác được bài đó; người giao bài và người có quyền quản lý thi thao tác như trước.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-382, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Thời khóa biểu của học sinh (`GET /children/:id/timetable`) chưa kiểm phạm vi xem trẻ; mức Thấp, xử lý ở đợt sau.

## 24 Yêu cầu thay đổi

### YCTD-382: Phạm vi dữ liệu trẻ, bài thi trực tuyến và bộ nhớ đệm theo từng trường – 2026-10-29

- Lý do: sửa lỗi L-33 đến L-37 của đợt rà soát mã ngày 29/10/2026; hệ thống chạy lại đúng BR-53, BR-72, BR-107, PQ-109 và cách ly giữa các trường.
- Nội dung thay đổi: dữ liệu sức khỏe và CSDL ngành của trẻ xét theo từng trẻ; điểm danh theo tiết kiểm quyền và phạm vi; thao tác bài thi đòi phạm vi trên mọi lớp được giao; bộ nhớ đệm cấp học và cờ trình diễn theo trường.
- Thành phần bị ảnh hưởng: `apps/api/src/children/child-scope.ts`, `apps/api/src/children/children.service.ts`, `apps/api/src/class-logs/class-logs.ts`, `apps/api/src/online-exams/online-exams.ts`, `apps/api/src/common/school-levels.ts`, `apps/api/src/demo/demo-mode.ts`, `apps/identity/src/messaging/demo-sms-sender.ts` và kiểm thử đi kèm.
- Dữ liệu, API, quyền bị ảnh hưởng: không đổi cấu trúc dữ liệu. `GET /children/:id/period-attendance` đòi một trong các quyền `P02.view`, `P02.edit`, `P02.class.manage`.
- Ảnh hưởng chức năng cũ: người ngoài phạm vi nêu trên không còn thấy các trường dữ liệu nhạy cảm, điểm danh theo tiết, bài thi nhiều lớp.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/api`, `apps/identity`; kiểm thử máy chủ hồ sơ trẻ, sổ đầu bài, thi trực tuyến, cấp học, bản trình diễn.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: phạm vi dữ liệu trẻ, bài thi trực tuyến và bộ nhớ đệm theo từng trường (YCTD-382, L-33 đến L-37).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Phạm vi dữ liệu trẻ, bài thi và bộ nhớ đệm theo trường | YCTD-382 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1723 | P02-02 | Trẻ có dị ứng, dân tộc, khuyết tật; người xem: nhân viên bếp cùng đơn vị có con học ở trường, giáo viên có vai trò chủ nhiệm nhưng chỉ dạy bộ môn ở lớp của trẻ, giáo viên chủ nhiệm lớp của trẻ | Hai người đầu: hồ sơ không có sức khỏe, CSDL ngành; danh sách trả trống dân tộc, khuyết tật; lọc theo khuyết tật không có trẻ. Chủ nhiệm lớp: thấy đủ | Kiểm thử tự động `apps/api/src/children/children.test.ts` đạt ngày 29/10/2026 (L-33) | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1724 | P02-47 | Điểm danh theo tiết của học sinh: giáo viên bộ môn không dạy lớp, nhân viên văn phòng đơn vị khác, Hiệu trưởng | 403; 403; 200 | Kiểm thử tự động `apps/api/src/class-logs/class-logs.test.ts` đạt ngày 29/10/2026 (L-34) | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1725 | P02-82 | Bài thi Hiệu trưởng giao cho 6A và 6B; giáo viên chủ nhiệm 6B, giáo viên Toán chỉ dạy 6A xem bài, xem lượt làm, nộp thay, hủy; Hiệu trưởng xem bài | 403 ở mọi thao tác của hai giáo viên; 200 | Kiểm thử tự động `apps/api/src/online-exams/online-exams.test.ts` đạt ngày 29/10/2026 (L-35) | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1726 | P01-35 | Hai trường trong cùng tiến trình: trường chỉ bật Mầm non đọc cấp học trước, trường bật THCS, THPT đọc sau; xóa đệm của trường đầu | Mỗi trường nhận cấp học của mình; cấp mặc định của trường sau là THCS | Kiểm thử tự động `apps/api/src/common/school-levels.test.ts` đạt ngày 29/10/2026 (L-36) | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1727 | P01-34 | Trường trình diễn và trường thật trong cùng tiến trình đọc cờ trình diễn lần lượt | Trường thật không bị coi là bản trình diễn; trường trình diễn vẫn chặn thao tác cần hệ thống thật | Kiểm thử tự động `apps/api/src/demo/demo-mode.test.ts` đạt ngày 29/10/2026 (L-37) | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1728 | P01-34 | Dịch vụ định danh gửi mã cho trường trình diễn rồi cho trường thật | Chỉ tin của trường thật được gửi qua nhà cung cấp | Kiểm thử tự động `apps/identity/src/messaging/demo-sms-sender.test.ts` đạt ngày 29/10/2026 (L-37) | Đạt |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-33 | Dữ liệu sức khỏe và CSDL ngành của trẻ ở hồ sơ, danh sách trẻ xét theo vai trò, chưa xét theo từng trẻ (đã xác minh) | CT-1723 | Người có vai trò được xem sức khỏe ở một phạm vi thấy dữ liệu của trẻ ngoài phạm vi đó | Đã sửa ở YCTD-382 |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-34 | Điểm danh theo tiết của học sinh chưa kiểm phạm vi xem trẻ (đã xác minh) | CT-1724 | Nhân sự ngoài lớp, ngoài đơn vị xem được điểm danh theo tiết | Đã sửa ở YCTD-382 |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-35 | Thao tác bài thi trực tuyến giao nhiều lớp chỉ đòi phạm vi ở một lớp (đã xác minh) | CT-1725 | Giáo viên một lớp thao tác trên bài làm của học sinh lớp khác | Đã sửa ở YCTD-382 |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-36 | Bộ nhớ đệm cấp học dùng chung giữa các trường ở chế độ nhiều trường (đã xác minh) | CT-1726 | Trường nhận cấp học của trường khác trong 30 giây | Đã sửa ở YCTD-382 |
| 25_KET_QUA_KIEM_THU.md | cuối bảng 6.2 Cao | L-37 | Bộ nhớ đệm cờ bản trình diễn dùng chung giữa các trường ở máy chủ API và dịch vụ định danh (đã xác minh) | CT-1727, CT-1728 | Trường thật có thể bị coi là bản trình diễn và ngược lại trong 30 giây | Đã sửa ở YCTD-382 |
