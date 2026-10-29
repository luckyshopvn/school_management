---
yctd: YCTD-384
tieu_de: Thiết kế lại giao diện toàn hệ thống theo hai phong cách
ngay: 2026-10-30
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-10-30 — Thiết kế lại giao diện toàn hệ thống theo hai phong cách

#### Công việc đã thực hiện

- Khảo sát hiện trạng sáu ứng dụng web trên bản nhiều trường ở máy phát triển (ảnh chụp 1366, 1024, 390 điểm ảnh) và rà mã giao diện: ba màu chính khác nhau, một phông, cổng vận hành không dùng `packages/ui`, ứng dụng giáo viên và học sinh không có thanh điều hướng, bảng không bọc cuộn ngang, quy tắc 44 điểm ảnh chỉ áp dưới 1280 ở cổng quản trị, viền ô nhập dưới 3:1.
- Trình ba hướng thiết kế kèm ảnh minh họa; Eric chọn hai phong cách.
- Bổ sung tài liệu `15` mục 2.6 (PC-01 đến PC-28), mục 3 (phông Be Vietnam Pro cho mọi ứng dụng), mục 4 (KC-09 đến KC-11), mục 5.2 (TD-20 đến TD-26), MC-03; trạng thái chờ phê duyệt.
- Bản mẫu `tai_lieu/ban_mau/yctd-384/index.html`: 13 màn hình của sáu ứng dụng, ba khổ, sáu trạng thái; đặc tả và danh sách lát `tai_lieu/ban_mau/yctd-384/DAC_TA.md`.

#### Quyết định

- Eric ngày 2026-10-30: cổng quản trị trường và cổng vận hành theo phong cách "Hành chính hiện đại"; ứng dụng giáo viên, phụ huynh, học sinh, chợ gia sư theo phong cách "Thân thiện theo vai" với màu nhấn giáo viên #0F6B5F, phụ huynh #1F5FA8, học sinh #6D28D9, chợ gia sư giữ #1F4E8C; menu cổng quản trị giữ số thứ bậc.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-384, `15_HE_THONG_THIET_KE.md` mục 2.6, 3, 4, 5.2, 7.

#### Vấn đề tồn đọng

- Chờ Eric duyệt bản mẫu và danh sách lát; chưa viết mã giao diện.

## 24 Yêu cầu thay đổi

### YCTD-384: Thiết kế lại giao diện toàn hệ thống theo hai phong cách – 2026-10-30

- Lý do: Eric yêu cầu giao diện sạch, đẹp, hiện đại, thân thiện trên máy tính, máy tính bảng, điện thoại; khảo sát cho thấy màu, phông, điều hướng, thành phần chưa thống nhất giữa sáu ứng dụng và nhiều chỗ vỡ bố cục ở máy tính bảng, điện thoại.
- Nội dung thay đổi: hai phong cách dùng chung một bộ biến ở `packages/ui` ("Hành chính hiện đại" cho cổng quản trị, cổng vận hành; "Thân thiện theo vai" cho giáo viên, phụ huynh, học sinh, chợ gia sư); một phông; điểm ngắt, vùng chạm 44 điểm ảnh, chữ ô nhập 16 điểm ảnh ở mọi khổ; bảy thành phần dùng chung mới; làm lại khung và màn hình chính của từng ứng dụng theo chín lát (`tai_lieu/ban_mau/yctd-384/DAC_TA.md`).
- Thành phần bị ảnh hưởng: `packages/ui`, `apps/portal`, `apps/platform`, `apps/teacher`, `apps/parent`, `apps/student`, `apps/market`, `packages/market-client`; tài liệu `11`, `14`, `15`, `21`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Mức: Lớn (sửa giá trị đã có ở tài liệu `15`, chạm mọi ứng dụng web).
- Trạng thái: Chờ phê duyệt
