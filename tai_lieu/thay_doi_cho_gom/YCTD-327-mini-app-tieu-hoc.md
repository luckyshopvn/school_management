---
yctd: YCTD-327
tieu_de: DT-29 phần 29c: mini app Tiểu học của Hộp công cụ giảng dạy
ngay: 2026-10-28
phien_ban_de_xuat: 0.203.0
---

## 02 Nhật ký

### 2026-10-28 — DT-29 phần 29c: mini app Tiểu học của Hộp công cụ giảng dạy

#### Công việc đã thực hiện

- Ứng dụng giáo viên (`apps/teacher/src/tools/mini/`): bảng cửu chương, khung ô li (bảng trắng có kẻ dòng như vở ô li), học xem đồng hồ, phân số trực quan; phần thuần ở `primary-logic.ts`. Danh mục `TEACHING_TOOLS` thêm bốn công cụ cho lớp Tiểu học.

#### Quyết định

- Chạy trên máy, không lưu kết quả, không cần danh sách lớp. Khung ô li tự vẽ (dòng kẻ mảnh mỗi ô li, dòng đậm mỗi bốn ô li, kẻ dọc mỗi bốn ô li), không dùng phông chữ mẫu có bản quyền: giáo viên viết mẫu bằng bút cảm ứng. Đọc giờ theo cách nói ở lớp ("7 giờ rưỡi", tuỳ chọn "8 giờ kém 15 phút"). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-327, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22, `14_DAC_TA_GIAO_DIEN.md` MH-562, `21_KICH_BAN_KIEM_THU.md` CT-1550 đến CT-1554, `11_TIEU_CHI_NGHIEM_THU.md` AC-1135, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Khổ ô li trên màn hình theo bề rộng bảng, chưa đúng kích thước in của vở thật.

## 24 Yêu cầu thay đổi

### YCTD-327: DT-29 phần 29c: mini app Tiểu học của Hộp công cụ giảng dạy – 2026-10-28

- Lý do: phần 29c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22 (Eric duyệt ngày 2026-10-28).
- Nội dung thay đổi:
  - Bảng cửu chương: bảng 2 đến 9, hỏi trong bảng đang chọn hoặc trộn bảng, Hiện đáp án, Câu khác, số câu đã hỏi trong buổi.
  - Khung ô li: bảng trắng có kẻ dòng ô li để viết mẫu.
  - Học xem đồng hồ: đồng hồ kim tự vẽ, kéo kim phút hoặc nút Lùi, Tiến theo bước 5, 15, 30 phút, từng giờ; ẩn giờ để hỏi; giờ ngẫu nhiên.
  - Phân số trực quan: hình tròn hoặc hình chữ nhật chia mẫu số phần (1 đến 12), tô tử số phần, chạm để tô, phân số tối giản.
- Thành phần bị ảnh hưởng: `packages/shared/src/teaching-tools.ts`, `apps/teacher/src/tools/mini/`, `apps/teacher/src/tools/ClassroomToolsScreen.tsx`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: MH-337 (ô công cụ của lớp Tiểu học), MH-562.
- Quyền bị ảnh hưởng: không.
- Kiểm thử cần thực hiện: CT-1550 đến CT-1554 (trong mã là CT-29c-1 đến CT-29c-5); `apps/teacher/src/tools/mini/primary.test.ts`, `apps/api/src/classroom-tools/teaching-tools.test.ts`, `tests/e2e/232-teaching-primary-apps.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-29 phần 29c, mini app Tiểu học (YCTD-327).
- Chức năng mới: bảng cửu chương, khung ô li, học xem đồng hồ, phân số trực quan trong Hộp công cụ giảng dạy.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-29 phần 29c: mini app Tiểu học của Hộp công cụ giảng dạy | YCTD-327 |

## Thêm dòng

| 14_DAC_TA_GIAO_DIEN.md | MH-337 | MH-562 | Ứng dụng giáo viên: mini app Tiểu học của Hộp công cụ giảng dạy (YCTD-327): Bảng cửu chương (Bảng 2 đến 9, Hỏi trong bảng, Trộn bảng, Hiện đáp án, Câu khác), Khung ô li, Học xem đồng hồ (kéo kim phút, bước đổi phút, Lùi, Tiến, đọc kiểu "kém", Giờ ngẫu nhiên, Ẩn giờ để hỏi), Phân số trực quan (Hình tròn, Hình chữ nhật, Tử số, Mẫu số) | P03-09, P03-10 |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1135 | Cho giáo viên lớp Tiểu học / Khi mở Hộp công cụ / Thì có bảng cửu chương, khung ô li, học xem đồng hồ, phân số trực quan cho kết quả đúng; lớp Mầm non, THCS không có các mini app này (CT-1550 đến CT-1554; YCTD-327) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1550 | P03-09 | Bảng nhân 7, 9; câu hỏi trong bảng và trộn bảng | Mười dòng đúng tích; thừa số trong khoảng | Kiểm thử tự động `apps/teacher/src/tools/mini/primary.test.ts` CT-29c-1 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1551 | P03-09 | Góc kim giờ, kim phút; phút theo bước khi kéo; đọc giờ, giờ rưỡi, giờ kém | Góc và cách đọc đúng | Kiểm thử tự động `apps/teacher/src/tools/mini/primary.test.ts` CT-29c-2 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1552 | P03-09 | Phân số sai tử, mẫu; tối giản 6/8; chia hình tròn; kẻ ô li | Báo lỗi; 3/4; phần tư đúng; dòng đậm mỗi bốn ô li | Kiểm thử tự động `apps/teacher/src/tools/mini/primary.test.ts` CT-29c-3 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1553 | P03-09 | Danh mục: mini app Tiểu học ở lớp Mầm non, THCS | Không hiện | Kiểm thử tự động `apps/api/src/classroom-tools/teaching-tools.test.ts` CT-29c-4 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1554 | P03-09 | Giao diện: giáo viên lớp Tiểu học dùng bảng cửu chương, đồng hồ, phân số, khung ô li; đổi sang lớp Mầm non | Kết quả đúng; lớp Mầm non không có | Kiểm thử giao diện `tests/e2e/232-teaching-primary-apps.spec.ts` CT-29c-5 | Chưa chạy |
