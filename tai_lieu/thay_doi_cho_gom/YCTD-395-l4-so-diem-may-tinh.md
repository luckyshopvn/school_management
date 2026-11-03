---
yctd: YCTD-395
tieu_de: Ứng dụng giáo viên có giao diện trên máy tính, lát L4: Sổ điểm, Đánh giá học sinh dạng bảng
ngay: 2026-11-03
phien_ban_de_xuat: 0.239.0
---

## 02 Nhật ký

### 2026-11-03 — Ứng dụng giáo viên có giao diện trên máy tính, lát L4: Sổ điểm, Đánh giá học sinh dạng bảng (YCTD-395)

#### Công việc đã thực hiện

- Sổ điểm (MH-275) và Đánh giá học sinh của ứng dụng giáo viên từ 1024 px là bảng nhập theo ô (TD-29): cột họ tên và hàng tiêu đề dính khi cuộn, ô 44 px; Sổ điểm có cột TX theo số lần nhiều nhất, Giữa kỳ, Cuối kỳ, TB môn (môn nhận xét có cột Kết quả), ô sai giá trị đánh dấu ngay tại ô; Đánh giá có Mức đạt, Điểm, Nhận xét, phẩm chất năng lực mỗi mục một cột. Dưới 1024 px giữ thẻ như trước.
- Hook `apps/teacher/src/shell/use-wide-layout.ts`: màn có ô nhập chỉ vẽ một bố cục theo khổ để mỗi ô có một phần tử duy nhất mang nhãn (tên ô giữ như trước, "Điểm thường xuyên 1 của …", "Mức đạt của …").
- Kiểm thử: e2e `tests/e2e/251-giao-vien-so-diem-may-tinh.spec.ts` (CT-2112 đến CT-2114).

#### Quyết định

- Không.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-395, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lát L5 (rà các màn còn lại, tài liệu `14`, `15`) chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-395: Ứng dụng giáo viên có giao diện trên máy tính, lát L4: Sổ điểm, Đánh giá học sinh dạng bảng – 2026-11-03

- Lý do: lát L4 của YCTD-395 (Eric duyệt bản mẫu, danh sách lát và Q-395-4 "sổ điểm dạng bảng nhập theo ô" ngày 2026-10-31).
- Nội dung thay đổi: bảng nhập theo ô cho Sổ điểm, Đánh giá học sinh ở khổ máy tính.
- Thành phần bị ảnh hưởng: `apps/teacher/src/screens/ScoreScreen.tsx`, `apps/teacher/src/screens/AssessmentScreen.tsx`, `apps/teacher/src/shell/use-wide-layout.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: dưới 1024 px không đổi; từ 1024 px cùng dữ liệu gửi máy chủ, cùng tên ô.
- Kiểm thử cần thực hiện: e2e 251, 90, 98.
- Mức: Lớn (thuộc YCTD-395). Người phê duyệt: Eric, ngày 2026-10-31.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: Sổ điểm, Đánh giá học sinh của ứng dụng giáo viên dạng bảng nhập theo ô ở khổ máy tính (YCTD-395 lát L4).
- Database migration: không. Quay lui: hoàn lại commit của lát.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Ứng dụng giáo viên có giao diện trên máy tính, lát L4: Sổ điểm, Đánh giá học sinh dạng bảng | YCTD-395 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-395 lát L4 (Sổ điểm, Đánh giá học sinh của giáo viên dạng bảng ở máy tính) |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2112 | MH-275 | Khổ 1366: Sổ điểm Toán lớp THCS, nhập chữ vào ô TX3 rồi sửa, lưu | Bảng có cột TX1 đến TX3, cột họ tên; ô sai có aria-invalid, nút Lưu khóa; lưu báo "Đã lưu điểm"; không vi phạm bố cục | Kiểm thử tự động `tests/e2e/251-giao-vien-so-diem-may-tinh.spec.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2113 | MG-01 | Khổ 1366: Đánh giá Tiếng Việt lớp Tiểu học có bài kiểm tra | Bảng có Mức đạt, Điểm, Nhận xét nhập được; không vi phạm bố cục | Kiểm thử tự động `251-giao-vien-so-diem-may-tinh.spec.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2114 | MH-275 | Khổ 390: Sổ điểm, Đánh giá | Thẻ như trước, không có bảng, không cuộn ngang | Kiểm thử tự động `251-giao-vien-so-diem-may-tinh.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-395 (lát L4) | Ứng dụng giáo viên có giao diện trên máy tính, lát L4: Sổ điểm, Đánh giá học sinh dạng bảng | {PHIEN_BAN} | MH-275 | AC-1403 | CT-2112 đến CT-2114 | PR, commit merge ghi khi gom; tệp mã: `apps/teacher/src/screens/ScoreScreen.tsx`, `apps/teacher/src/screens/AssessmentScreen.tsx` | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
