---
yctd: YCTD-318
tieu_de: Sổ điểm nhập từ Excel và in sổ
ngay: 2026-10-28
phien_ban_de_xuat: 0.194.0
---

## 02 Nhật ký

### 2026-10-28 — Sổ điểm nhập từ Excel và in sổ

#### Công việc đã thực hiện

- Máy chủ API thêm ba điểm cuối cho sổ điểm một môn ở một lớp, một học kỳ:
  - `GET /api/v1/scores/classes/:id/subjects/:subjectId/template?term_type=` trả `so-diem.xlsx`: cột Mã hệ thống, STT, Họ và tên, TX1…TXn (đủ số lần tối thiểu và số điểm đang có), Giữa kỳ, Cuối kỳ, Nhận xét (môn nhận xét: Kết quả, Nhận xét) kèm học sinh và điểm đang có; trang Hướng dẫn.
  - `POST /api/v1/scores/classes/:id/subjects/:subjectId/import` (biểu mẫu `term_type`, `file`) đọc tệp mẫu đã điền. Học sinh nhận theo mã hệ thống; điểm ghi dấu phẩy hoặc dấu chấm; số cột TX lấy theo tệp. Có dòng lỗi thì trả `saved: 0` và `errors` theo dòng, cột, không ghi; hợp lệ thì ghi như nút Ghi điểm (cùng quyền phân công, khoá sổ, hạn nhập).
  - `GET /api/v1/scores/classes/:id/subjects/:subjectId/print?term_type=` trả `so-diem.pdf`: tiêu đề lớp, môn, học kỳ; STT, họ tên, điểm, TB môn HK, nhận xét.
- Màn hình sổ điểm thẻ Nhập điểm thêm "Tải mẫu Excel", "Nhập từ Excel" (người được nhập môn) và "In sổ" (người xem được sổ); lỗi của tệp liệt kê theo dòng.
- Logic tệp tách ở `apps/api/src/scores/score-files.ts`, có kiểm thử đơn vị; kiểm thử máy chủ API cho cả ba điểm cuối.

#### Quyết định

- Nhập từ Excel ghi cả bảng của các học sinh có trong tệp (ô trống là chưa có điểm), giống bấm Ghi điểm sau khi sửa trên màn hình. Học sinh nhận theo mã hệ thống thay vì họ tên vì có thể trùng tên. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-318, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-318: Sổ điểm nhập từ Excel và in sổ – 2026-10-28

- Lý do: mẫu giao diện đã duyệt của Sổ điểm có "Nhập từ Excel" và "In sổ" nhưng mã chưa có (để lại ở YCTD-296); Eric yêu cầu làm nốt.
- Nội dung thay đổi: tệp mẫu nhập kèm điểm đang có, nhập sổ điểm từ Excel, in sổ ra PDF; ba nút ở thẻ Nhập điểm.
- Thành phần bị ảnh hưởng: `apps/api/src/scores/scores.ts`, `apps/api/src/scores/score-files.ts`, `apps/api/src/scores/score-files.test.ts`, `apps/api/src/scores/scores.test.ts`, `apps/portal/src/scores/ScoresPage.tsx`, `apps/portal/src/scores/scores-api.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: thêm ba điểm cuối; nhập dùng đúng quyền, khoá sổ của Ghi điểm; không đổi dữ liệu.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: kiểm kiểu máy chủ API, cổng quản trị; kiểm thử đơn vị `score-files.test.ts`, kiểm thử máy chủ API `scores.test.ts`; kiểm thử giao diện sổ điểm (98).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: sổ điểm nhập từ Excel, tải mẫu kèm điểm đang có, in sổ ra PDF (YCTD-318).
- Không đổi dữ liệu, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Sổ điểm nhập từ Excel và in sổ | YCTD-318 |
