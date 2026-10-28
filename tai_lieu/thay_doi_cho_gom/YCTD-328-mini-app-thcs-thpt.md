---
yctd: YCTD-328
tieu_de: DT-29 phần 29d: mini app THCS, THPT của Hộp công cụ giảng dạy
ngay: 2026-10-28
phien_ban_de_xuat: 0.204.0
---

## 02 Nhật ký

### 2026-10-28 — DT-29 phần 29d: mini app THCS, THPT của Hộp công cụ giảng dạy

#### Công việc đã thực hiện

- Ứng dụng giáo viên (`apps/teacher/src/tools/mini/`): máy tính khoa học, vẽ đồ thị hàm số, bảng tuần hoàn, hình học động, bảng hằng số và đổi đơn vị; phần thuần `expression.ts` (bộ tính biểu thức tự viết), `graph-logic.ts`, `periodic-table.ts`, `geometry.ts`, `units.ts`. Danh mục `TEACHING_TOOLS` thêm năm công cụ cho lớp THCS, THPT.

#### Quyết định

- Bộ tính biểu thức tự viết, không dùng `eval` hay `Function` (không chạy mã từ chữ người dùng gõ), dùng chung cho máy tính và vẽ đồ thị. Bảng tuần hoàn: tên nguyên tố theo IUPAC như sách Khoa học tự nhiên, Hoá học chương trình 2018; khối lượng nguyên tử chuẩn rút gọn của IUPAC; La, Ac ở nhóm 3. Hằng số vật lí theo CODATA 2018, làm tròn bốn chữ số có nghĩa. Mọi dữ liệu là dữ kiện khoa học công khai, nằm trong ứng dụng, chạy khi mất mạng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-328, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22, `14_DAC_TA_GIAO_DIEN.md` MH-563, `21_KICH_BAN_KIEM_THU.md` CT-1555 đến CT-1560, `11_TIEU_CHI_NGHIEM_THU.md` AC-1136, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Mô phỏng vật lí, hoá học để đợt sau (32 mục 22). Hình học động mới có tam giác; chưa có đường tròn, đa giác tự dựng.

## 24 Yêu cầu thay đổi

### YCTD-328: DT-29 phần 29d: mini app THCS, THPT của Hộp công cụ giảng dạy – 2026-10-28

- Lý do: phần 29d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22 (Eric duyệt ngày 2026-10-28).
- Nội dung thay đổi:
  - Máy tính khoa học: + − × ÷ ^, ngoặc, nhân ngầm, π, e, sin cos tan và hàm ngược (theo độ hoặc radian), căn bậc hai, căn bậc ba, ln, log, giai thừa, phần trăm; dấu phẩy thập phân; kết quả theo cách viết Việt Nam; lịch sử phép tính trong buổi; lỗi rõ ràng (chia cho 0, căn số âm, tan 90°).
  - Vẽ đồ thị: tối đa ba hàm y = f(x), lưới và số trên trục tự chọn bước, phóng to, thu nhỏ, ngắt nét ở điểm không xác định.
  - Bảng tuần hoàn: 118 nguyên tố theo chu kì, nhóm, màu theo loại, tìm theo kí hiệu, tên, số hiệu, ô chi tiết.
  - Hình học động: tam giác ABC kéo đỉnh trên lưới hoặc dời bằng nút; cạnh, góc, chu vi, diện tích, loại tam giác; đường trung tuyến và trọng tâm, đường cao và trực tâm, đường tròn ngoại tiếp.
  - Bảng hằng số, đổi đơn vị: 15 hằng số vật lí; đổi độ dài, khối lượng, thời gian, tốc độ, diện tích, thể tích, nhiệt độ.
- Thành phần bị ảnh hưởng: `packages/shared/src/teaching-tools.ts`, `apps/teacher/src/tools/mini/`, `apps/teacher/src/tools/ClassroomToolsScreen.tsx`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: MH-337 (ô công cụ của lớp THCS, THPT), MH-563.
- Quyền bị ảnh hưởng: không.
- Kiểm thử cần thực hiện: CT-1555 đến CT-1560 (trong mã là CT-29d-1 đến CT-29d-6); `apps/teacher/src/tools/mini/secondary.test.ts`, `apps/api/src/classroom-tools/teaching-tools.test.ts`, `tests/e2e/233-teaching-secondary-apps.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-29 phần 29d, mini app THCS, THPT (YCTD-328).
- Chức năng mới: máy tính khoa học, vẽ đồ thị hàm số, bảng tuần hoàn, hình học động, bảng hằng số và đổi đơn vị trong Hộp công cụ giảng dạy.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-29 phần 29d: mini app THCS, THPT của Hộp công cụ giảng dạy | YCTD-328 |

## Thêm dòng

| 14_DAC_TA_GIAO_DIEN.md | MH-337 | MH-563 | Ứng dụng giáo viên: mini app THCS, THPT của Hộp công cụ giảng dạy (YCTD-328): Máy tính khoa học (Biểu thức, phím, Độ, Radian, Xóa lùi, Xóa hết, =, Lịch sử trong buổi), Vẽ đồ thị hàm số (Hàm 1 đến 3, Phóng to, Thu nhỏ, Đặt lại), Bảng tuần hoàn (Tìm nguyên tố, bảng 18 nhóm, họ lanthan, họ actini, ô chi tiết, chú thích màu), Hình học động (kéo đỉnh, dời đỉnh, các đường, số đo), Bảng hằng số, đơn vị (Đại lượng, Giá trị, Từ, Sang, bảng hằng số) | P03-09, P03-10 |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1136 | Cho giáo viên lớp THCS, THPT / Khi mở Hộp công cụ / Thì máy tính, đồ thị, bảng tuần hoàn, hình học, đổi đơn vị cho kết quả đúng, chạy khi mất mạng; biểu thức sai báo lỗi rõ ràng; lớp Mầm non, Tiểu học không có các mini app này (CT-1555 đến CT-1560; YCTD-328) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1555 | P03-09 | Biểu thức: thứ tự phép tính, luỹ thừa kết hợp phải, hàm, hằng, nhân ngầm, độ và radian; biểu thức sai | Kết quả đúng; lỗi rõ ràng | Kiểm thử tự động `apps/teacher/src/tools/mini/secondary.test.ts` CT-29d-1 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1556 | P03-09 | Đồ thị y = x, 1/x; bước lưới; biểu thức sai | Toạ độ đúng; 1/x ngắt nét tại 0; báo lỗi cú pháp | Kiểm thử tự động `apps/teacher/src/tools/mini/secondary.test.ts` CT-29d-2 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1557 | P03-09 | Bảng tuần hoàn: chu kì, nhóm, loại của các nguyên tố mốc; mỗi ô một nguyên tố; tìm | Đúng; 90 ô trong bảng chính, 28 ở hai hàng họ f | Kiểm thử tự động `apps/teacher/src/tools/mini/secondary.test.ts` CT-29d-3 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1558 | P03-09 | Tam giác vuông 3-4-5, tam giác đều, ba điểm thẳng hàng; đổi km, km/h, °C, tấn | Số đo, các tâm, loại tam giác, kết quả đổi đúng | Kiểm thử tự động `apps/teacher/src/tools/mini/secondary.test.ts` CT-29d-4 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1559 | P03-09 | Danh mục: mini app THCS, THPT ở lớp Mầm non, Tiểu học | Không hiện | Kiểm thử tự động `apps/api/src/classroom-tools/teaching-tools.test.ts` CT-29d-5 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1560 | P03-09 | Giao diện: giáo viên lớp THCS tính 2^10 + sin(30), chia cho 0, vẽ thêm hàm, tìm Na, bật đường tròn ngoại tiếp, đổi 2,5 km; đổi sang lớp Tiểu học | Kết quả đúng; lớp Tiểu học không có | Kiểm thử giao diện `tests/e2e/233-teaching-secondary-apps.spec.ts` CT-29d-6 | Chưa chạy |
