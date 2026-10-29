---
yctd: YCTD-326
tieu_de: DT-29 phần 29b: mini app chung và Mầm non của Hộp công cụ giảng dạy
ngay: 2026-10-28
phien_ban_de_xuat: 0.202.0
---

## 02 Nhật ký

### 2026-10-28 — DT-29 phần 29b: mini app chung và Mầm non của Hộp công cụ giảng dạy

#### Công việc đã thực hiện

- Ứng dụng giáo viên, thư mục `apps/teacher/src/tools/mini/`: bảng trắng, xúc xắc và bốc số (mọi cấp); đồng hồ hình ảnh, đèn giữ trật tự, bảng thưởng sao (Mầm non, Tiểu học); hình và màu, đếm và số, làm quen chữ cái (Mầm non). Phần thuần ở `mini-logic.ts`.
- Danh mục `TEACHING_TOOLS` thêm tám công cụ; màn Hộp công cụ mở các công cụ này.

#### Quyết định

- Mọi mini app chạy trên máy giáo viên, dùng được khi mất mạng, không gọi máy chủ. Đèn giữ trật tự chỉ đo mức to nhỏ của micro ngay trên máy, không ghi âm, không lưu; dừng đo thì tắt micro. Bảng sao lưu trên máy theo lớp trong ngày, xóa khi đăng xuất như dữ liệu khác của công cụ lớp học, không vào sổ điểm hay nề nếp. Hình, đồ vật tự vẽ bằng SVG; chữ cái dùng phông của máy. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-326, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22, `14_DAC_TA_GIAO_DIEN.md` MH-561, `21_KICH_BAN_KIEM_THU.md` CT-1545 đến CT-1549, `11_TIEU_CHI_NGHIEM_THU.md` AC-1133, AC-1134, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Ngưỡng của đèn giữ trật tự cần thử ở lớp thật với nhiều loại micro; bảng sao chưa chuyển sang bảng điểm nhanh.

## 24 Yêu cầu thay đổi

### YCTD-326: DT-29 phần 29b: mini app chung và Mầm non của Hộp công cụ giảng dạy – 2026-10-28

- Lý do: phần 29b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22 (Eric duyệt ngày 2026-10-28).
- Nội dung thay đổi:
  - Bảng trắng: màu bút, độ dày nét, tẩy, xóa bảng; vẽ bằng ngón tay, bút cảm ứng, chuột; không lưu.
  - Xúc xắc một đến ba con và tổng; bốc số trong khoảng (tối đa 10 000 số), tuỳ chọn không lặp.
  - Đồng hồ hình ảnh 1, 2, 3, 5, 10 phút: đĩa màu vơi dần theo thời điểm kết thúc tuyệt đối, tạm dừng, chạy tiếp, tiếng báo hết giờ.
  - Đèn giữ trật tự: đèn xanh, vàng, đỏ theo độ ồn đã làm mượt và độ nhạy 1 đến 10.
  - Bảng thưởng sao: nhóm theo bản chia nhóm gần nhất của lớp (chưa chia thì bốn nhóm), mục tiêu 5, 10, 15, 20 sao, thêm, bớt, xóa bảng, không xếp hạng.
  - Hình và màu (sáu hình, sáu màu; gọi tên hình, màu hoặc cả hai; ẩn tên để hỏi; chọn ngẫu nhiên), đếm và số (1 đến 10 đồ vật tự vẽ, chạm để đếm, đếm đủ hiện số và tên số), làm quen chữ cái (29 chữ cái tiếng Việt in hoa và in thường cỡ lớn).
- Thành phần bị ảnh hưởng: `packages/shared/src/teaching-tools.ts`, `apps/teacher/src/tools/mini/`, `apps/teacher/src/tools/ClassroomToolsScreen.tsx`.
- Dữ liệu bị ảnh hưởng: không có dữ liệu máy chủ; bảng sao lưu trên máy giáo viên (khoá `cong-cu-lop-hoc:sao:<lớp>`).
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: MH-337 (thêm ô công cụ), MH-561.
- Quyền bị ảnh hưởng: không. Micro chỉ dùng khi giáo viên bấm Bắt đầu đo và trình duyệt hỏi quyền.
- Kiểm thử cần thực hiện: CT-1545 đến CT-1549 (trong mã là CT-29b-1 đến CT-29b-5); `apps/teacher/src/tools/mini/mini.test.ts`, `apps/api/src/classroom-tools/teaching-tools.test.ts`, `tests/e2e/231-teaching-mini-apps.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-29 phần 29b, mini app chung và Mầm non (YCTD-326).
- Chức năng mới: bảng trắng, xúc xắc và bốc số, đồng hồ hình ảnh, đèn giữ trật tự, bảng thưởng sao, hình và màu, đếm và số, làm quen chữ cái trong Hộp công cụ giảng dạy.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-29 phần 29b: mini app chung và Mầm non của Hộp công cụ giảng dạy | YCTD-326 |

## Thêm dòng

| 14_DAC_TA_GIAO_DIEN.md | MH-337 | MH-561 | Ứng dụng giáo viên: mini app của Hộp công cụ giảng dạy (YCTD-326): Bảng trắng (màu, nét, Tẩy, Xóa bảng), Xúc xắc và bốc số (1 đến 3 con, Tung xúc xắc; Từ số, Đến số, Không bốc lặp lại, Bốc số, Bốc lại từ đầu), Đồng hồ hình ảnh (thời lượng, Bắt đầu, Tạm dừng, Chạy tiếp, Đặt lại), Đèn giữ trật tự (Bắt đầu đo, độ nhạy, Dừng đo, tắt micro), Bảng thưởng sao (Mục tiêu, Thêm sao, Bớt, Xóa bảng sao), Hình và màu, Đếm và số, Làm quen chữ cái | P03-09, P03-10 |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1133 | Cho giáo viên lớp Mầm non / Khi mở Hộp công cụ / Thì có hình và màu, đếm và số, làm quen chữ cái, bảng sao, đồng hồ hình ảnh, đèn trật tự, bảng trắng, xúc xắc; lớp Tiểu học không có ba mini app Mầm non (CT-1548, CT-1549; YCTD-326) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1134 | Cho đèn giữ trật tự / Khi giáo viên đo độ ồn / Thì âm thanh chỉ đo mức to nhỏ trên máy, không ghi âm, không lưu, không gửi đi; dừng đo thì tắt micro (CT-1546; YCTD-326) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1545 | P03-09 | Xúc xắc 1 đến 3 con, chấm từng mặt; bốc số không lặp đến khi hết; khoảng số sai | Mặt 1 đến 6 đủ chấm; hết số trả trống; khoảng sai có thông báo | Kiểm thử tự động `apps/teacher/src/tools/mini/mini.test.ts` CT-29b-1 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1546 | P03-09 | Đồng hồ hình ảnh theo thời điểm kết thúc; đèn trật tự theo độ ồn và độ nhạy | Phần còn lại, cung tròn đúng; cùng độ ồn, độ nhạy cao đèn đỏ sớm hơn | Kiểm thử tự động `apps/teacher/src/tools/mini/mini.test.ts` CT-29b-2 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1547 | P03-09 | Bảng sao ở biên 0 và mục tiêu; bảng chữ cái | Sao không vượt biên; đủ 29 chữ cái, không có F, J, W, Z | Kiểm thử tự động `apps/teacher/src/tools/mini/mini.test.ts` CT-29b-3 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1548 | P03-09 | Danh mục: mini app Mầm non ở lớp Tiểu học; đồng hồ hình ảnh, đèn trật tự, bảng sao ở THPT | Không hiện | Kiểm thử tự động `apps/api/src/classroom-tools/teaching-tools.test.ts` CT-29b-4 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1549 | P03-09 | Giao diện: giáo viên lớp Mầm non dùng hình và màu, đếm và số, chữ cái, bảng sao, xúc xắc; đổi sang lớp Tiểu học | Kết quả đúng từng mini app; lớp Tiểu học không có mini app Mầm non | Kiểm thử giao diện `tests/e2e/231-teaching-mini-apps.spec.ts` CT-29b-5 | Chưa chạy |
