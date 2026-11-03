---
yctd: YCTD-395
tieu_de: Ứng dụng giáo viên có giao diện trên máy tính, lát L3: Ca trực, Ghi nhận khổ máy tính
ngay: 2026-11-03
phien_ban_de_xuat: 0.239.0
---

## 02 Nhật ký

### 2026-11-03 — Ứng dụng giáo viên có giao diện trên máy tính, lát L3: Ca trực, Ghi nhận khổ máy tính (YCTD-395)

#### Công việc đã thực hiện

- Ca trực hôm nay (MH-676) từ 1024 px theo bản mẫu đã duyệt: nội dung rộng tối đa khoảng 1250 px; "Tôi đã ghi hôm nay" thành bảng (Giờ, Học sinh và lớp, Loại, Mục nội quy, Khu vực, Thu hồi); thu hồi mở dòng nhập lý do ngay dưới dòng; nút Ghi nhận mới không kéo hết bề ngang. Dưới 1024 px giữ danh sách thẻ như trước.
- Ghi nhận vi phạm, khen (MH-677): từ 1280 px hai cột (Học sinh bên trái; Nội dung, Ảnh bên phải); từ 1024 px lời nhắc và nút Lưu ghi nhận ở thanh dính đáy, nút đổi chữ "Đang lưu…" khi gửi.
- Form thu hồi, nhãn loại tách thành thành phần dùng chung cho danh sách và bảng.
- Kiểm thử: e2e `tests/e2e/250-giao-vien-ca-truc-may-tinh.spec.ts` (CT-2109 đến CT-2111).

#### Quyết định

- Không.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-395, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lát L4 (Sổ điểm, Đánh giá), L5 (các màn còn lại) chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-395: Ứng dụng giáo viên có giao diện trên máy tính, lát L3: Ca trực, Ghi nhận khổ máy tính – 2026-11-03

- Lý do: lát L3 của YCTD-395 (Eric duyệt bản mẫu, danh sách lát ngày 2026-10-31).
- Nội dung thay đổi: bố cục máy tính cho Ca trực hôm nay và Ghi nhận vi phạm, khen.
- Thành phần bị ảnh hưởng: `apps/teacher/src/screens/SupervisionScreen.tsx`.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: dưới 1024 px không đổi; từ 1024 px cùng thao tác, cùng dữ liệu gửi máy chủ.
- Kiểm thử cần thực hiện: e2e 250, 242.
- Mức: Lớn (thuộc YCTD-395). Người phê duyệt: Eric, ngày 2026-10-31.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-03

- Phạm vi thay đổi: Ca trực, Ghi nhận vi phạm, khen của ứng dụng giáo viên bố cục máy tính (YCTD-395 lát L3).
- Database migration: không. Quay lui: hoàn lại commit của lát.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Ứng dụng giáo viên có giao diện trên máy tính, lát L3: Ca trực, Ghi nhận khổ máy tính | YCTD-395 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-395 lát L3 (Ca trực, Ghi nhận của giáo viên bố cục máy tính) |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2109 | P02-141 | Khổ 1366: Ca trực có ghi nhận đang hiệu lực và đã thu hồi; thu hồi một ghi nhận | Bảng có cột Mục nội quy, dòng đã thu hồi có nhãn; dòng lý do mở dưới dòng; báo "Đã thu hồi ghi nhận"; không cuộn ngang, vùng chạm 44 px, không lỗi truy cập | Kiểm thử tự động `tests/e2e/250-giao-vien-ca-truc-may-tinh.spec.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2110 | P02-140 | Khổ 1366: Ghi nhận mới, chọn lớp, học sinh, mục nội quy, lưu | Học sinh và Nội dung cạnh nhau; lưu báo "Đã ghi cho 1 học sinh"; không vi phạm bố cục | Kiểm thử tự động `250-giao-vien-ca-truc-may-tinh.spec.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2111 | P02-141 | Khổ 390: Ca trực | Danh sách thẻ như trước, không có bảng, không cuộn ngang | Kiểm thử tự động `250-giao-vien-ca-truc-may-tinh.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-395 (lát L3) | Ứng dụng giáo viên có giao diện trên máy tính, lát L3: Ca trực, Ghi nhận khổ máy tính | {PHIEN_BAN} | P02-140, P02-141 | AC-1403 | CT-2109 đến CT-2111 | PR, commit merge ghi khi gom; tệp mã: `apps/teacher/src/screens/SupervisionScreen.tsx` | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
