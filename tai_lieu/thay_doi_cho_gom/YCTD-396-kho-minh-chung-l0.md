---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung cho kiểm định chất lượng và các bộ tiêu chí khác, lát L0: đặc tả, bản mẫu
ngay: 2026-10-31
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-10-31 — Kho minh chứng dùng chung, lát L0 (YCTD-396)

#### Công việc đã thực hiện

- Khảo sát mã: phân hệ Bảo đảm chất lượng (YCTD-149) đã có bộ tiêu chuẩn, đợt tự đánh giá, phiếu, minh chứng mã `Hn-a.b-c` dùng chung nhiều tiêu chí, xuất danh mục và báo cáo; nhưng minh chứng nằm ở cơ sở dữ liệu năm học, gắn với một đợt, chỉ nhận tệp, hồ sơ chuyên môn, văn bản đến, văn bản đi; không có phiên bản, thời hạn hiệu lực, người phụ trách tiêu chí; chỉ có bộ mẫu Mầm non.
- Tra cứu văn bản: Thông tư 17, 18, 19/2018/TT-BGDĐT; Thông tư 22/2024/TT-BGDĐT sửa đổi ba thông tư đó; Thông tư 22/2018/TT-BGDĐT là hướng dẫn thi đua, khen thưởng; Công văn 5932/BGDĐT-QLCL hướng dẫn cách mã `[Hn-a.b-c]`.
- Lập đặc tả và bản mẫu (`tai_lieu/ban_mau/yctd-396/DAC_TA.md`, `index.html`): chín màn MH-678 đến MH-686 ở ba khổ 1366, 1024, 390; kiểm tự động 99 tổ hợp màn hình, khổ, trạng thái không tràn khung, vùng chạm từ 40 điểm ảnh, chữ từ 14 điểm ảnh.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giữ mã YCTD-396, AC-1420 đến AC-1459, CT-2130 đến CT-2179, BR-533 đến BR-549, MH-678 đến MH-689; số database migration cấp ở lát viết mã.
- Eric ngày 2026-10-31 duyệt bản mẫu, danh sách lát và trả lời: Q-396-1 Thông tư 22/2024 sửa đổi Thông tư 17, 18, 19/2018; Q-396-2 kho xuyên năm học ở cơ sở dữ liệu hệ thống; Q-396-3 mở rộng phân hệ Bảo đảm chất lượng, đổi tên "Minh chứng và kiểm định", chuyển minh chứng cũ sang kho; Q-396-4 chụp PDF lúc gắn, giữ liên kết bản gốc, báo khi nguồn thay đổi; Q-396-5 luôn bản đầy đủ có tên học sinh, chặn tải theo quyền xem nguồn, ghi nhật ký truy cập (BM-271, Nghị định 13/2023/NĐ-CP); Q-396-6 nạp đủ nội dung chỉ báo theo văn bản, bỏ ràng buộc không chép nguyên văn cho phần bộ tiêu chí; Q-396-7 thêm ba quyền `P09.evidence.view`, `P09.evidence.contribute`, `P09.evidence.manage`; Q-396-8 làm chuẩn giáo viên, thi đua khen thưởng, chuẩn hiệu trưởng, trường học an toàn, kế hoạch năm học, thứ tự chuẩn giáo viên và thi đua trước; Q-396-9 tài khoản chỉ đọc có thời hạn cho đoàn đánh giá ngoài (vai trò VT-23, lát L8); Q-396-10 duyệt lát L1 đến L8.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giữ thêm BM-271 đến BM-275 và mã vai trò VT-23.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-396, `tai_lieu/ban_mau/yctd-396/`.

#### Vấn đề tồn đọng

- Chưa viết mã; làm lát L1 ở PR riêng.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung cho kiểm định chất lượng và các bộ tiêu chí khác – 2026-10-31

- Lý do: Eric ngày 2026-10-31: nhiều công việc đã làm trong phần mềm nhưng không đưa vào làm minh chứng được; cần hệ thống quản lý minh chứng, trước hết cho kiểm định chất lượng của nhà trường, dùng được cho các bộ tiêu chí khác.
- Nội dung thay đổi: kho minh chứng của trường ở cơ sở dữ liệu hệ thống, xuyên năm học; bộ tiêu chí cấu hình được nhiều loại, nhiều cấp học, đối tượng nhà trường hoặc cá nhân; minh chứng có mã theo từng bộ dạng `[H1-1.1-01]`, nguồn là tệp hoặc bản ghi trong hệ thống (chụp PDF lúc gắn), có phiên bản, thời hạn hiệu lực, dùng cho nhiều tiêu chí, bản chụp đầy đủ có tên học sinh chỉ người có quyền xem nguồn tải được, mọi lần xem, tải ghi nhật ký; nút "Dùng làm minh chứng" ở trang nguồn; phân công người phụ trách tiêu chí, bảng độ phủ và tiêu chí còn thiếu; xuất danh mục, báo cáo tự đánh giá theo mẫu hướng dẫn, gói hồ sơ theo hộp; ba quyền mới; vai trò VT-23 đoàn đánh giá ngoài chỉ đọc có thời hạn; bộ mẫu kiểm định đủ chỉ báo theo Thông tư 17, 18, 19/2018 đã sửa đổi bởi Thông tư 22/2024; bộ chuẩn giáo viên, thi đua, chuẩn hiệu trưởng, trường học an toàn, kế hoạch năm học; phân hệ đổi tên "Minh chứng và kiểm định". Chi tiết ở `tai_lieu/ban_mau/yctd-396/DAC_TA.md`.
- Yêu cầu bị thay đổi: YCTD-149 (minh chứng của đợt chuyển sang kho; MH-255, MH-257 được thay bằng MH-679, MH-684).
- Thành phần bị ảnh hưởng (dự kiến): cơ sở dữ liệu hệ thống (bảng kho mới), năm học (đọc 22f), định danh (quyền); `apps/api/src/quality-assurance` và các module nguồn (văn bản, kế hoạch, điểm, điểm danh, nhân sự, EMIS, rèn luyện); `apps/portal` (phân hệ, các trang nguồn); `packages/shared` (menu, quyền); tài liệu `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `22`, `27`.
- Dữ liệu, API, quyền bị ảnh hưởng: có (bảng mới, chuyển dữ liệu minh chứng 22f, điểm cuối mới, quyền `P09.evidence.view`, `P09.evidence.contribute`, `P09.evidence.manage`, vai trò VT-23).
- Ảnh hưởng chức năng cũ: đợt, phiếu, hội đồng, công nhận của 22f giữ nguyên; minh chứng cũ chuyển sang kho đủ mã, tệp; đường dẫn `/quality/evidences`, `/quality/frameworks` chuyển tới trang mới.
- Kiểm thử cần thực hiện: lát L0 chỉ đổi tài liệu, chạy `node scripts/gom-thay-doi.mjs --kiem`; từ L1 kiểm thử đơn vị kho, chuyển dữ liệu, quyền; e2e spec 80 vẫn đạt và spec mới cho kho.
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-31 (bản mẫu, danh sách lát L1 đến L8, Q-396-1 đến Q-396-10).
- Trạng thái: Đã phê duyệt

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L0 (kho minh chứng dùng chung: đặc tả, bản mẫu, Eric duyệt; L1 đến L8 chưa làm) |

## Thêm dòng

| 22_BAO_MAT.md | BM-104 | BM-271 | Minh chứng có dữ liệu cá nhân (YCTD-396, Q-396-5, Eric quyết định ngày 2026-10-31): bản chụp bản ghi làm minh chứng (sổ điểm, điểm danh, rèn luyện, hồ sơ cán bộ) luôn đầy đủ, có tên học sinh; không chép số định danh, căn cước; chỉ người có quyền xem loại nguồn đó ở phân hệ nguồn xem, tải được tệp, kể cả người có `P09.evidence.manage` và vai trò đoàn đánh giá ngoài; máy chủ kiểm ở mọi lần tải; mọi lần xem, tải, xuất gói ghi `evidence_events` (người, thời điểm, phiên bản); tệp tải qua API, không có đường dẫn ký sẵn. Lưu ý Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân: mục đích xử lý là hồ sơ kiểm định, đánh giá của nhà trường; trường là bên kiểm soát dữ liệu; chia sẻ cho đoàn đánh giá ngoài chỉ qua tài khoản có thời hạn và nhật ký (lát L8) |
