---
yctd: YCTD-395
tieu_de: Ứng dụng giáo viên có giao diện trên máy tính, lát L0: đặc tả, bản mẫu
ngay: 2026-10-31
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-10-31 — Ứng dụng giáo viên có giao diện trên máy tính, lát L0 (YCTD-395)

#### Công việc đã thực hiện

- Khảo sát mã: ứng dụng giáo viên giữ màn đang mở trong trạng thái, không có đường dẫn; mỗi màn tự vẽ thanh tiêu đề và vùng nội dung rộng 448 hoặc 768 điểm ảnh; `packages/ui` chưa có khung có thanh bên; thanh bên cổng quản trị gắn với bộ định tuyến và phân hệ nên không dùng lại nguyên được.
- Đối chiếu tài liệu `15` đã duyệt ở YCTD-384: KC-09, TD-21 đã quy định thanh bên trắng 240 điểm ảnh từ 1024 cho ứng dụng theo vai; lát L7 của YCTD-384 chưa làm.
- Lập đặc tả và bản mẫu (`tai_lieu/ban_mau/yctd-395/DAC_TA.md`, `index.html`): trang chủ MG-01, Ca trực và Ghi nhận MH-676, Sổ điểm MH-275 ở ba khổ 1366, 1024, 390, sáu trạng thái, hai phương án màu khung; kiểm tự động 72 tổ hợp không tràn khung, vùng chạm từ 44 điểm ảnh.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: dùng mã YCTD thay CONG_VIEC và tệp mảnh thay nhánh `tai-lieu/...` theo AI-46, AI-47; giữ mã AC-1400 đến AC-1419, CT-2100 đến CT-2129.
- Chờ Eric duyệt bản mẫu, danh sách lát L1 đến L5 và câu hỏi Q-395-1 đến Q-395-4.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-395, `tai_lieu/ban_mau/yctd-395/`.

#### Vấn đề tồn đọng

- Chưa viết mã; làm từ lát L1 sau khi Eric duyệt.

## 24 Yêu cầu thay đổi

### YCTD-395: Ứng dụng giáo viên có giao diện trên máy tính – 2026-10-31

- Lý do: Eric ngày 2026-10-31 yêu cầu ứng dụng giáo viên có giao diện trên máy tính; hiện trên màn hình rộng chỉ có một cột 448 đến 768 điểm ảnh ở giữa.
- Nội dung thay đổi: từ 1024 điểm ảnh có thanh bên trắng 240 điểm ảnh (Trang chủ, ô chọn lớp và chức năng của lớp, Giảng dạy, Rèn luyện, Cá nhân, Cổng trường), thanh đầu trắng, nội dung rộng tối đa 1200 điểm ảnh; bố cục máy tính cho trang chủ, Ca trực, Ghi nhận, Sổ điểm; dưới 1024 giữ như hiện nay. Làm trước phần máy tính của YCTD-384 lát L7.
- Yêu cầu bị thay đổi: không; làm theo KC-09, TD-21 (`15_HE_THONG_THIET_KE.md`) và BC-02 (`14_DAC_TA_GIAO_DIEN.md`) đã duyệt ở YCTD-384.
- Thành phần bị ảnh hưởng (dự kiến): `packages/ui` (thêm khung có thanh bên, thuộc tính tùy chọn của `ApplicationHeader`), `apps/teacher` (mọi màn hình); tài liệu `11`, `14`, `15`, `21`, `27`.
- Dữ liệu, API, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: điện thoại và máy tính bảng dọc không đổi; mọi màn giữ nút Quay lại; ứng dụng phụ huynh, học sinh không đổi.
- Kiểm thử cần thực hiện: lát L0 chỉ đổi tài liệu, chạy `node scripts/gom-thay-doi.mjs --kiem`; từ L1 e2e ứng dụng giáo viên ở 390 và 1366, kiểm thử đơn vị `packages/ui`, ảnh chụp trước, sau.
- Mức: Lớn. Người phê duyệt: Eric (chờ duyệt bản mẫu, danh sách lát).
- Trạng thái: Chờ phê duyệt

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | YCTD-395 lát L0 (ứng dụng giáo viên có giao diện trên máy tính: đặc tả, bản mẫu; L1 đến L5 chưa làm) |
