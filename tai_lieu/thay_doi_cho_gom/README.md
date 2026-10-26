# Thay đổi chờ gom

- Mô tả: Quy ước ghi tài liệu chung bằng tệp mảnh, mỗi PR một tệp, gom định kỳ vào `01`, `02`, `03`, `23`, `24`, `index.md` (YCTD-291).
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-26
- Trạng thái: Đã phê duyệt
- Người phê duyệt: Eric, ngày 2026-10-26

## 1. Vì sao

Nhiều phiên làm song song, mỗi PR đều thêm mục vào `02_NHAT_KY_DU_AN.md`, `24_YEU_CAU_THAY_DOI.md`, `23_LICH_SU_PHIEN_BAN.md`, bảng phiên bản ở `01_KE_HOACH_TONG_THE.md`, số đếm ở `index.md`, và tăng số phiên bản đầu các tài liệu đó. Các PR cùng sửa một chỗ nên mỗi lần một PR merge thì mọi PR khác xung đột, phải gộp main và chạy lại CI. Từ YCTD-291, mỗi PR chỉ thêm một tệp mảnh ở thư mục này; một PR gom đổ các tệp mảnh vào tài liệu chung.

## 2. Quy tắc cho PR thường

1. Thêm đúng một tệp `tai_lieu/thay_doi_cho_gom/YCTD-<số>-<ten-ngan>.md` (tên chữ thường không dấu, nối bằng gạch ngang), ví dụ `YCTD-233-khung-kiem-thu-thiet-bi.md`.
2. **Không sửa** `02_NHAT_KY_DU_AN.md`, `23_LICH_SU_PHIEN_BAN.md`, `24_YEU_CAU_THAY_DOI.md`, `index.md`, bảng mốc phát hành ở mục 3 của `01_KE_HOACH_TONG_THE.md`; **không tăng** số "Phiên bản" và "Ngày cập nhật" đầu các tài liệu này. Dòng chung của nhiều phần (ví dụ dòng phân hệ ở `03_DANH_SACH_CONG_VIEC.md`, ghi chú ở `index.md`) ghi qua mục "Nối dòng" của tệp mảnh.
3. Nội dung riêng của phần vẫn sửa tại chỗ vì mỗi phần sửa dòng khác nhau: dòng trạng thái của phần ở `32`, dòng của phần ở `34`, đặc tả `07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`, `22`. Các tài liệu này cũng không tăng số phiên bản đầu tài liệu trong PR thường (lần gom tăng một lần cho tài liệu chung; các tài liệu khác tăng khi có đợt rà soát).
4. Mã YCTD: lấy số còn trống hoặc số đã giữ sẵn cho đợt (xem dòng "Yêu cầu thay đổi" ở `index.md`), kiểm cả các PR đang mở và các tệp ở thư mục này.
5. Số phiên bản phần mềm ghi trong tệp mảnh chỉ là **đề xuất**; trong nội dung dùng chỗ giữ `{PHIEN_BAN}`. Số chính thức chốt khi gom theo thứ tự merge: phiên bản đề xuất có số sửa khác 0 (ví dụ `0.145.1`) thì tăng số sửa, ngược lại tăng số phụ.
6. CI chạy `node scripts/gom-thay-doi.mjs --kiem`: tệp mảnh sai định dạng thì CI hỏng. PR thường (nhánh không bắt đầu bằng `gom-`) sửa trực tiếp `02`, `23`, `24`, `index.md` thì CI cảnh báo, không chặn.

## 3. Định dạng tệp mảnh

```markdown
---
yctd: YCTD-233
tieu_de: DT-26 phần 26c: khung kiểm thử theo khổ thiết bị
ngay: 2026-10-26
phien_ban_de_xuat: 0.146.0
---

## 02 Nhật ký

### 2026-10-26 — DT-26 phần 26c: khung kiểm thử theo khổ thiết bị

#### Công việc đã thực hiện

- …

#### Quyết định

- …

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-233, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-233: DT-26 phần 26c: khung kiểm thử theo khổ thiết bị – 2026-10-26

- Lý do: …
- Nội dung thay đổi: …
- Thành phần bị ảnh hưởng: …
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-26

- Phạm vi thay đổi: … (YCTD-233).
- …

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-26 phần 26c: khung kiểm thử theo khổ thiết bị | YCTD-233 |

## index Số đếm

| Ca kiểm thử khởi đầu | Số lượng | +6 |
| 14 | màn hình | +2 |
| Màn hình dự kiến | Số lượng | +2 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P02 Trẻ, phụ huynh và lớp học | DT-26 phần 26c (YCTD-233: khung kiểm thử theo khổ thiết bị) |
| index.md | Màn hình dự kiến | MH-350, MH-351 (YCTD-233) |
```

Quy tắc của từng phần:

| Phần | Bắt buộc | Nội dung |
|---|---|---|
| Đầu tệp | Có | `yctd` khớp tên tệp; `tieu_de`; `ngay` dạng `YYYY-MM-DD`; `phien_ban_de_xuat` dạng `0.146.0` hoặc `không` (PR không tăng phiên bản phần mềm, ví dụ chỉ sửa kiểm thử, chỉ đổi tài liệu) |
| `## 02` | Có | Đúng mục nhật ký theo mẫu ở đầu `02_NHAT_KY_DU_AN.md`, bắt đầu bằng `### YYYY-MM-DD — <tên>` |
| `## 24` | Có | Đúng mục YCTD theo mẫu của `24_YEU_CAU_THAY_DOI.md`, bắt đầu bằng `### YCTD-<số>: <tên> – <ngày>` |
| `## 23` | Khi có phiên bản | Mục phiên bản theo mẫu của `23_LICH_SU_PHIEN_BAN.md`, bắt đầu bằng `### Phiên bản {PHIEN_BAN} – <ngày>` |
| `## 01` | Không | Một dòng bảng mốc phát hành ở mục 3 của `01`, bắt đầu bằng `\| {PHIEN_BAN} \|` |
| `## index` | Không | Mỗi dòng `\| <khoá dòng> \| <cụm sau số> \| +N \|`: cộng N vào số đứng ngay trước cụm (lần đầu trong dòng) ở dòng bảng của `index.md` có ô đầu đúng bằng khoá; cụm `Số lượng` là ô số thứ hai của bảng "Trạng thái tổng thể". Ví dụ `\| 10 \| mã chức năng \| +4 \|`, `\| Chức năng đã liệt kê \| Số lượng \| +4 \|`. Không ghi dòng "Yêu cầu thay đổi" (tự đếm) và không cần sửa khoảng `BR-01 đến BR-…`, `AC-01 đến AC-…`, `CT-001 đến CT-…`, `YCTD-01 đến YCTD-…` (tự tính lại từ `07`, `11`, `21`, `24`) |
| `## Nối dòng` | Không | Mỗi dòng `\| <tệp trong tai_lieu> \| <khoá dòng> \| <nội dung> \|`: nối `; <nội dung>` vào cuối ô cuối của dòng bảng có ô đầu đúng bằng khoá |

Không dùng tiêu đề cấp 1, cấp 2 (`#`, `##`) trong nội dung các mục. Không đưa dữ liệu thật (repo công khai).

## 4. Gom

Người gom (phiên điều phối hoặc Eric) làm định kỳ, khi không có PR nào sắp merge:

1. Tạo nhánh `gom-<ngày>` từ `origin/main`.
2. Chạy `node scripts/gom-thay-doi.mjs`. Tập lệnh kiểm mọi tệp mảnh (sai thì dừng, không ghi gì), xếp theo thứ tự merge (lần commit trên nhánh chính thêm tệp, theo `git log --first-parent`), rồi với từng tệp: chèn mục 02, 24, 23 lên đầu danh sách (tệp merge sau cùng nằm trên cùng), chốt số phiên bản phần mềm và thay `{PHIEN_BAN}`, chèn dòng 01 trước dòng `1.0.0`, cộng số ở `index.md`, nối dòng; sau đó tính lại các khoảng mã và số "Yêu cầu thay đổi" ở `index.md`, tăng số phiên bản đầu mỗi tài liệu chung đã sửa đúng một lần, đặt ngày cập nhật, xoá các tệp mảnh đã gom.
3. Rà `git diff`, commit, mở PR. PR gom được sửa trực tiếp tài liệu chung (CI không cảnh báo nhánh `gom-`).

Tuỳ chọn: `--kiem` chỉ kiểm định dạng; `--ngay <YYYY-MM-DD>` đặt ngày cập nhật; `--thu-muc <đường dẫn>` chạy trên bản sao `tai_lieu`. Kiểm thử đơn vị: `tests/tai-lieu/gom-thay-doi.test.mjs`.
