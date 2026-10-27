---
yctd: YCTD-293
tieu_de: Tệp mảnh có mục "Thêm dòng" để chèn dòng bảng mới vào tài liệu đặc tả
ngay: 2026-10-27
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-10-27 — Tệp mảnh có mục "Thêm dòng"

#### Công việc đã thực hiện

- Thêm mục `## Thêm dòng` vào `scripts/gom-thay-doi.mjs`: mỗi dòng gồm tệp, neo (ô đầu của dòng đứng trước hoặc `cuối bảng <tiêu đề>`) và dòng bảng mới giữ nguyên văn.
- `--kiem` báo lỗi khi tệp hoặc neo không có, số ô khác bảng, mã dòng mới đã có trong tài liệu hoặc trùng với tệp mảnh khác.
- Khi gom, chèn theo thứ tự merge; nhiều tệp cùng chèn sau một neo thì giữ thứ tự merge.
- Cập nhật `tai_lieu/thay_doi_cho_gom/README.md` (quy tắc 3, mẫu, bảng quy tắc từng phần); thêm ba ca ở `tests/tai-lieu/gom-thay-doi.test.mjs`.

#### Quyết định

- Dòng bảng mới ở tài liệu đặc tả (`07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`…) ghi qua "Thêm dòng" thay vì sửa tại chỗ, vì các PR song song cùng nối cuối một bảng nên xung đột mỗi lần một PR merge (gặp ở PR 196 với PR 185, 192, 197).
- Mục "Nối dòng" giữ nguyên nghĩa: chỉ nối nội dung vào ô cuối của một dòng có sẵn.
- Các PR đang mở (193, 195) giữ dòng tại chỗ, không cần chuyển.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-293.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-293: Tệp mảnh có mục "Thêm dòng" để chèn dòng bảng mới vào tài liệu đặc tả – 2026-10-27

- Lý do: quy ước tệp mảnh (YCTD-291) gỡ xung đột ở tài liệu chung nhưng các tài liệu đặc tả vẫn xung đột khi nhiều PR cùng thêm dòng cuối một bảng (BR, AC, MH, CT…); mục "Nối dòng" không thêm được dòng mới.
- Nội dung thay đổi: mục `## Thêm dòng` (`| <tệp> | <neo> | <ô 1> | … |`), neo là ô đầu của dòng đứng trước hoặc `cuối bảng <tiêu đề>`; kiểm khi chạy `--kiem` (tệp, neo, số ô, trùng mã); gom chèn theo thứ tự merge.
- Thành phần bị ảnh hưởng: `scripts/gom-thay-doi.mjs`, `tests/tai-lieu/gom-thay-doi.test.mjs`, `tai_lieu/thay_doi_cho_gom/README.md`.
- Dữ liệu, API, giao diện, quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không; tệp mảnh hiện có vẫn hợp lệ.
- Kiểm thử cần thực hiện: `node --test tests/tai-lieu/gom-thay-doi.test.mjs`, `node scripts/gom-thay-doi.mjs --kiem`.
- Trạng thái: Đã triển khai
