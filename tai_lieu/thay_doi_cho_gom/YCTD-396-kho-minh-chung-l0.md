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
- Đề xuất mở rộng phân hệ Bảo đảm chất lượng thành kho minh chứng xuyên năm học thay vì làm phân hệ mới; chờ Eric trả lời Q-396-1 đến Q-396-10.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-396, `tai_lieu/ban_mau/yctd-396/`.

#### Vấn đề tồn đọng

- Chưa viết mã; làm từ lát L1 sau khi Eric duyệt bản mẫu, danh sách lát và câu hỏi.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung cho kiểm định chất lượng và các bộ tiêu chí khác – 2026-10-31

- Lý do: Eric ngày 2026-10-31: nhiều công việc đã làm trong phần mềm nhưng không đưa vào làm minh chứng được; cần hệ thống quản lý minh chứng, trước hết cho kiểm định chất lượng của nhà trường, dùng được cho các bộ tiêu chí khác.
- Nội dung thay đổi (đề xuất, chờ duyệt): kho minh chứng của trường ở cơ sở dữ liệu hệ thống, xuyên năm học; bộ tiêu chí cấu hình được nhiều loại, nhiều cấp học, đối tượng nhà trường hoặc cá nhân; minh chứng có mã theo từng bộ dạng `[H1-1.1-01]`, nguồn là tệp hoặc bản ghi trong hệ thống (chụp PDF lúc gắn), có phiên bản, thời hạn hiệu lực, dùng cho nhiều tiêu chí; nút "Dùng làm minh chứng" ở trang nguồn; phân công người phụ trách tiêu chí, bảng độ phủ và tiêu chí còn thiếu; xuất danh mục, báo cáo tự đánh giá theo mẫu hướng dẫn, gói hồ sơ theo hộp; ba quyền mới; phân hệ đổi tên "Minh chứng và kiểm định". Chi tiết ở `tai_lieu/ban_mau/yctd-396/DAC_TA.md`.
- Yêu cầu bị thay đổi: YCTD-149 (minh chứng của đợt chuyển sang kho; MH-255, MH-257 được thay bằng MH-679, MH-684).
- Thành phần bị ảnh hưởng (dự kiến): cơ sở dữ liệu hệ thống (bảng kho mới), năm học (đọc 22f), định danh (quyền); `apps/api/src/quality-assurance` và các module nguồn (văn bản, kế hoạch, điểm, điểm danh, nhân sự, EMIS, rèn luyện); `apps/portal` (phân hệ, các trang nguồn); `packages/shared` (menu, quyền); tài liệu `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `22`, `27`.
- Dữ liệu, API, quyền bị ảnh hưởng: có (bảng mới, chuyển dữ liệu minh chứng 22f, điểm cuối mới, quyền `P09.evidence.view`, `P09.evidence.contribute`, `P09.evidence.manage`).
- Ảnh hưởng chức năng cũ: đợt, phiếu, hội đồng, công nhận của 22f giữ nguyên; minh chứng cũ chuyển sang kho đủ mã, tệp; đường dẫn `/quality/evidences`, `/quality/frameworks` chuyển tới trang mới.
- Kiểm thử cần thực hiện: lát L0 chỉ đổi tài liệu, chạy `node scripts/gom-thay-doi.mjs --kiem`; từ L1 kiểm thử đơn vị kho, chuyển dữ liệu, quyền; e2e spec 80 vẫn đạt và spec mới cho kho.
- Mức: Lớn. Người phê duyệt: Eric (chờ duyệt bản mẫu, danh sách lát, Q-396-1 đến Q-396-10).
- Trạng thái: Chờ phê duyệt

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L0 (kho minh chứng dùng chung: đặc tả, bản mẫu, chờ Eric duyệt; L1 đến L7 chưa làm) |
