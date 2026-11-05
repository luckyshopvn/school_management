---
yctd: YCTD-395
tieu_de: Ứng dụng giáo viên có giao diện trên máy tính, lát L2: trang chủ khổ máy tính
ngay: 2026-11-03
phien_ban_de_xuat: 0.239.0
---

## 02 Nhật ký

### 2026-11-03 — Ứng dụng giáo viên có giao diện trên máy tính, lát L2: trang chủ khổ máy tính (YCTD-395)

#### Công việc đã thực hiện

- Trang chủ MG-01 từ 1024 px theo bản mẫu đã duyệt (`tai_lieu/ban_mau/yctd-395`): dải chào màu nhấn có ngày, tên giáo viên, số lớp; ô lối tắt TD-22 có biểu tượng thay cột nút (Gia sư AI kèm số cờ chờ); mỗi lớp một thẻ có ô ký hiệu lớp, cấp, sĩ số, nhãn Chủ nhiệm và lưới chức năng ba cột theo cấp lớp. Từ 1280 px thông báo, thông báo đẩy, chấm công ở cột phải 320 px; 1024 đến 1279 px xuống dưới thẻ lớp. Dưới 1024 px giữ như trước.
- Một cây phần tử cho mọi khổ, chỉ đổi bố cục bằng lớp theo điểm ngắt, để khung thông báo, chấm công không tải hai lần. Ô, nút của khổ máy tính giữ tên đọc như nút ở điện thoại ("Hộp công cụ giảng dạy", "Sổ điểm lớp 6A").
- `packages/ui` `ShortcutTiles`: thêm tên đọc đầy đủ, số việc chờ trên ô, số cột do nơi dùng chọn (chưa ứng dụng nào khác dùng).
- Kiểm thử: e2e `242-giao-vien-may-tinh.spec.ts` thêm CT-2107 (1366), CT-2108 (1024, 390); `183-tablet-teacher-parent.spec.ts` kiểm vị trí khung theo bố cục mới.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: ô chấm công giữ thành thẻ "Chấm công hôm nay" ở cột phải (thẻ có sẵn, kèm nghỉ phép, phiếu lương, lịch công tác, công việc) thay vì đưa vào dải chào như bản mẫu, để không viết lại thành phần chấm công; dải chào ghi số lớp thay câu "Hôm nay bạn có N lớp".

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-395, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lát L3 (Ca trực, Ghi nhận), L4 (Sổ điểm), L5 (các màn còn lại) chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-395: Ứng dụng giáo viên có giao diện trên máy tính, lát L2: trang chủ khổ máy tính – 2026-11-03

- Lý do: lát L2 của YCTD-395 (Eric duyệt bản mẫu, danh sách lát ngày 2026-10-31; ngày 2026-11-03 bảo làm tiếp L2).
- Nội dung thay đổi: trang chủ MG-01 bố cục máy tính; `ShortcutTiles` thêm tên đọc, số việc chờ, số cột.
- Thành phần bị ảnh hưởng: `apps/teacher/src/screens/ClassesScreen.tsx`, `apps/teacher/src/shell/icons.tsx`, `packages/ui/src/ShortcutTiles.tsx`.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: dưới 1024 px không đổi; từ 1024 px nút chung thành ô lối tắt, nút lớp thành lưới trên thẻ, cùng chức năng và điều kiện hiện.
- Kiểm thử cần thực hiện: e2e 242, 183 và các spec ứng dụng giáo viên trên CI.
- Mức: Lớn (thuộc YCTD-395). Người phê duyệt: Eric, ngày 2026-10-31.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: trang chủ ứng dụng giáo viên bố cục máy tính từ 1024 px (YCTD-395 lát L2).
- Database migration: không. Quay lui: hoàn lại commit của lát.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Ứng dụng giáo viên có giao diện trên máy tính, lát L2: trang chủ khổ máy tính | YCTD-395 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-395 lát L2 (trang chủ giáo viên bố cục máy tính) |

## Thêm dòng

| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1403 | Cho giáo viên dạy lớp THCS (chủ nhiệm) và lớp Mầm non / Khi mở trang chủ ở khổ 1366 / Thì có dải chào, ô lối tắt theo quyền (Gia sư AI kèm số cờ), thẻ lớp có chức năng theo cấp và nhãn Chủ nhiệm, thông báo và chấm công ở cột phải; ở 1024 thông báo xuống dưới thẻ lớp; ở 390 như trước (CT-2107, CT-2108; YCTD-395) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2107 | MG-01 | Khổ 1366: trang chủ, bấm ô Ghi nhận rèn luyện | Dải chào, ô lối tắt, thẻ lớp theo cấp có nhãn Chủ nhiệm, cột phải; không cuộn ngang, vùng chạm 44 px, không lỗi truy cập; mở Ca trực | Kiểm thử tự động `tests/e2e/242-giao-vien-may-tinh.spec.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2108 | MG-01 | Khổ 1024 rồi 390: trang chủ | 1024: thông báo dưới thẻ lớp, không vi phạm bố cục; 390: không có ô lối tắt, dải chào, có nút như trước | Kiểm thử tự động `242-giao-vien-may-tinh.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-395 (lát L2) | Ứng dụng giáo viên có giao diện trên máy tính, lát L2: trang chủ khổ máy tính | {PHIEN_BAN} | MG-01 | AC-1403 | CT-2107, CT-2108 | PR, commit merge ghi khi gom; tệp mã: `apps/teacher/src/screens/ClassesScreen.tsx`, `packages/ui/src/ShortcutTiles.tsx` | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
