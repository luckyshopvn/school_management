---
yctd: YCTD-395
tieu_de: Ứng dụng giáo viên có giao diện trên máy tính, lát L1: khung có thanh bên
ngay: 2026-10-31
phien_ban_de_xuat: 0.239.0
---

## 02 Nhật ký

### 2026-10-31 — Ứng dụng giáo viên có giao diện trên máy tính, lát L1: khung có thanh bên (YCTD-395)

#### Công việc đã thực hiện

- `packages/ui`: thêm `RoleNavigationShell` (phần máy tính của TD-21): từ 1024 px thanh bên trắng 240 px (tên ứng dụng, nhóm mục có biểu tượng, số việc chờ, Đăng xuất ở chân), thanh đầu trắng có tên màn và người dùng, nền trang theo phong cách theo vai; dưới 1024 px chỉ vẽ nội dung. `ApplicationHeader` thêm thuộc tính tùy chọn `hideInShell`: thanh chỉ ghi "Ứng dụng giáo viên" (6 màn) ẩn từ 1024 px trong khung; thanh ghi tên màn (Hộp công cụ, Chế độ lớp học, màn của lớp…) vẫn hiện vì là tiêu đề màn.
- `apps/teacher`: điều kiện chức năng theo quyền và cấp lớp tách thành hàm thuần `shell/teacher-features.ts`, dùng chung cho trang chủ MG-01 và thanh bên; dữ liệu trang chủ (người dùng, lớp, cờ Gia sư AI) tải ở `Application` (`shell/use-teacher-features.ts`), tải lại mỗi khi về trang chủ như trước. Thanh bên `shell/TeacherShell.tsx`: Trang chủ; các lớp và chức năng của lớp đang chọn; Giảng dạy; Rèn luyện; Cá nhân; Cổng trường.
- Kiểm thử: đơn vị `apps/teacher/src/shell/teacher-features.test.ts` (CT-2100 đến CT-2104); e2e `tests/e2e/242-giao-vien-may-tinh.spec.ts` ở khổ 1366 và 390 (CT-2105, CT-2106).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mục thanh bên là liên kết, lớp chọn bằng danh sách liên kết thay ô chọn, nhóm chỉ có nhãn chữ, để không trùng vai trò nút, tiêu đề, nhãn "Lớp" mà các kiểm thử e2e hiện có tìm trên màn hình 1280 px. Lát L1 chưa mở rộng vùng nội dung của từng màn (nút trong cột sẽ bị kéo dài); các màn được bố trí lại cho máy tính ở lát L2 đến L5.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-395, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lát L2 (trang chủ), L3 (Ca trực, Ghi nhận), L4 (Sổ điểm), L5 (các màn còn lại) chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-395: Ứng dụng giáo viên có giao diện trên máy tính, lát L1: khung có thanh bên – 2026-10-31

- Lý do: lát đầu của YCTD-395 (Eric duyệt bản mẫu, danh sách lát ngày 2026-10-31).
- Nội dung thay đổi: khung có thanh bên từ 1024 px cho ứng dụng giáo viên; điều kiện chức năng dùng chung cho trang chủ và thanh bên.
- Thành phần bị ảnh hưởng: `packages/ui` (`RoleNavigationShell`, `ApplicationHeader`), `apps/teacher` (`Application.tsx`, `ClassesScreen.tsx`, thư mục `shell`).
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: dưới 1024 px không đổi; từ 1024 px thêm thanh bên, thanh đầu, nền kem, ẩn thanh tiêu đề chung "Ứng dụng giáo viên" ở 6 màn; trang chủ giữ nút cũ. Ứng dụng phụ huynh, học sinh không đổi.
- Kiểm thử cần thực hiện: kiểm thử đơn vị ứng dụng giáo viên, e2e 242, 183 và các spec ứng dụng giáo viên trên CI.
- Mức: Lớn (thuộc YCTD-395). Người phê duyệt: Eric, ngày 2026-10-31.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-31

- Phạm vi thay đổi: ứng dụng giáo viên có thanh bên từ 1024 px (YCTD-395 lát L1).
- Database migration: không. Quay lui: hoàn lại commit của lát.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Ứng dụng giáo viên có giao diện trên máy tính, lát L1: khung có thanh bên | YCTD-395 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-395 lát L1 (khung có thanh bên từ 1024 px cho ứng dụng giáo viên) |

## Thêm dòng

| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1400 | Cho giáo viên đã đăng nhập / Khi mở ứng dụng ở khổ từ 1024 px / Thì có thanh bên 240 px và thanh đầu có tên màn, thanh tiêu đề của màn ẩn; ở khổ dưới 1024 px không có thanh bên, giao diện như trước (CT-2105, CT-2106; YCTD-395) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1401 | Cho giáo viên có quyền ghi nhận rèn luyện, có cờ Gia sư AI, không có quyền cổng trường / Khi xem thanh bên / Thì thấy đúng các mục trang chủ có, có số cờ chờ, không thấy mục cổng trường; bấm mục thì mở đúng màn, mục đang mở được đánh dấu (CT-2100, CT-2101, CT-2102, CT-2105; YCTD-395) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1402 | Cho giáo viên dạy lớp THCS và lớp Mầm non / Khi chọn lớp ở thanh bên / Thì chức năng của lớp đổi theo cấp (THCS có Sổ điểm, Mầm non có Đón trả), đúng thứ tự trang chủ (CT-2103, CT-2105; YCTD-395) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1404 | Cho khổ 1366 và 390 / Khi mở trang chủ, Ca trực / Thì không có thanh cuộn ngang, mọi phần tử bấm được cao từ 44 px, không có lỗi truy cập nghiêm trọng (CT-2105, CT-2106; YCTD-395) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2100 | MG-01 | Giáo viên chưa có lớp, không quyền riêng | Chỉ thấy Chấm công và nghỉ phép, Phiếu lương, Công việc, Sách đang mượn | Kiểm thử tự động `apps/teacher/src/shell/teacher-features.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2101 | MG-01 | Quyền cổng, quét thẻ, kiểm kê, bồi dưỡng, ghi nhận rèn luyện; lớp THCS; 2 cờ Gia sư AI | Thấy đủ mục tương ứng, lịch dạy, sổ đầu bài, hộp công cụ, chế độ lớp học | Kiểm thử tự động `teacher-features.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2102 | MG-01 | Quyền dạy trực tuyến; mọi lớp Mầm non; chưa tải lớp | Lớp học trực tuyến ẩn; hiện khi chưa có lớp | Kiểm thử tự động `teacher-features.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2103 | MG-01 | Lớp Mầm non; lớp THCS | Chức năng của lớp theo cấp, đúng thứ tự trang chủ | Kiểm thử tự động `teacher-features.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2104 | MG-01 | Phân công cổng không gắn đơn vị; lớp nhiều cấp, một cấp | Bỏ phân công không đơn vị; lớp xếp theo cấp, giữ nguyên khi một cấp | Kiểm thử tự động `teacher-features.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2105 | MG-01 | Khổ 1366: thanh bên, mục theo quyền, đổi lớp, mở Ca trực, Quay lại | Thanh bên hiện, đánh dấu đúng mục, chức năng lớp theo cấp, không cuộn ngang, vùng chạm 44 px, không lỗi truy cập | Kiểm thử tự động `tests/e2e/242-giao-vien-may-tinh.spec.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2106 | MG-01 | Khổ 390: trang chủ, Ca trực | Không có thanh bên, thanh tiêu đề như trước, không cuộn ngang | Kiểm thử tự động `242-giao-vien-may-tinh.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-395 (lát L1) | Ứng dụng giáo viên có giao diện trên máy tính, lát L1: khung có thanh bên | {PHIEN_BAN} | MG-01 | AC-1400 đến AC-1402, AC-1404 | CT-2100 đến CT-2106 | PR, commit merge ghi khi gom; tệp mã: `packages/ui/src/RoleNavigationShell.tsx`, `apps/teacher/src/shell/TeacherShell.tsx`, `apps/teacher/src/shell/teacher-features.ts` | Kiểm thử tự động trên máy ngày 31/10/2026; CI của PR |
