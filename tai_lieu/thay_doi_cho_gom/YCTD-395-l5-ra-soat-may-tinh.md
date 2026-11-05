---
yctd: YCTD-395
tieu_de: Ứng dụng giáo viên có giao diện trên máy tính, lát L5: rà các màn còn lại, tài liệu 14, 15
ngay: 2026-11-03
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-11-03 — Ứng dụng giáo viên có giao diện trên máy tính, lát L5: rà các màn còn lại (YCTD-395)

#### Công việc đã thực hiện

- E2e rà soát `tests/e2e/252-giao-vien-ra-soat-may-tinh.spec.ts`: ở khổ 1366, mở lần lượt 14 màn chung (Lịch dạy, Sổ đầu bài, Hộp công cụ, Chế độ lớp học, Lớp trực tuyến, Ghi nhận rèn luyện, Chấm công và nghỉ phép, Phiếu lương, Công việc, Bồi dưỡng, Sách đang mượn, Xác nhận người đón, Quét thẻ ra vào, Kiểm kê thiết bị) và mọi chức năng của lớp Mầm non, THCS từ thanh bên; mỗi màn không cuộn ngang, mọi phần tử bấm được cao từ 44 px. Không màn nào vi phạm, nên lát không sửa mã giao diện.
- Tài liệu `14`: BC-02 ghi thanh bên khổ máy tính của ứng dụng giáo viên và các màn có bố cục máy tính; MG-01 ghi bố cục trang chủ khổ máy tính. Tài liệu `15`: TD-21 ghi `RoleNavigationShell`, TD-22 ghi phần mở rộng của `ShortcutTiles`.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: các màn còn lại giữ cột nội dung rộng tối đa 768 px ở giữa vùng nội dung khổ máy tính (đọc dễ, nút trong cột không kéo dài); chỉ màn có bảng, danh sách nhiều cột (trang chủ, Ca trực, Sổ điểm, Đánh giá) mở rộng như bản mẫu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-395.

#### Vấn đề tồn đọng

- Phần điện thoại (thanh dưới, ô lối tắt, màu theo vai) làm ở YCTD-384 lát L7.

## 24 Yêu cầu thay đổi

### YCTD-395: Ứng dụng giáo viên có giao diện trên máy tính, lát L5: rà các màn còn lại, tài liệu 14, 15 – 2026-11-03

- Lý do: lát cuối của YCTD-395 (Eric duyệt danh sách lát ngày 2026-10-31).
- Nội dung thay đổi: e2e rà soát mọi màn ở khổ 1366; cập nhật BC-02, MG-01 (`14`), TD-21, TD-22 (`15`).
- Thành phần bị ảnh hưởng: `tests/e2e/252-giao-vien-ra-soat-may-tinh.spec.ts`, `tai_lieu/14_DAC_TA_GIAO_DIEN.md`, `tai_lieu/15_HE_THONG_THIET_KE.md`.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: e2e 252.
- Mức: Lớn (thuộc YCTD-395). Người phê duyệt: Eric, ngày 2026-10-31.
- Trạng thái: Đã triển khai

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-395 lát L5 (rà mọi màn giáo viên ở khổ máy tính, tài liệu 14, 15) |

## Thêm dòng

| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1405 | Cho giáo viên có đủ quyền, dạy lớp Mầm non và THCS / Khi mở từng màn từ thanh bên ở khổ 1366 / Thì mỗi màn không cuộn ngang, mọi phần tử bấm được cao từ 44 px, mục đang mở được đánh dấu (CT-2115, CT-2116; YCTD-395) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2115 | MG-01 | Khổ 1366: 14 màn chung mở từ thanh bên | Mỗi màn không cuộn ngang, vùng chạm 44 px | Kiểm thử tự động `tests/e2e/252-giao-vien-ra-soat-may-tinh.spec.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2116 | MG-01 | Khổ 1366: chức năng lớp Mầm non, THCS mở từ thanh bên | Mỗi màn không cuộn ngang, vùng chạm 44 px | Kiểm thử tự động `252-giao-vien-ra-soat-may-tinh.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-395 (lát L5) | Ứng dụng giáo viên có giao diện trên máy tính, lát L5: rà các màn còn lại, tài liệu 14, 15 | Không áp dụng (không tăng phiên bản) | MG-01 | AC-1405 | CT-2115, CT-2116 | PR, commit merge ghi khi gom; tệp: `tests/e2e/252-giao-vien-ra-soat-may-tinh.spec.ts`, `tai_lieu/14_DAC_TA_GIAO_DIEN.md`, `tai_lieu/15_HE_THONG_THIET_KE.md` | Kiểm thử tự động trên máy ngày 03/11/2026; CI của PR |
