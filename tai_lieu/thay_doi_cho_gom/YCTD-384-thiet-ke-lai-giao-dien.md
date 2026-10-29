---
yctd: YCTD-384
tieu_de: Thiết kế lại giao diện toàn hệ thống theo hai phong cách
ngay: 2026-10-30
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-10-30 — Thiết kế lại giao diện toàn hệ thống theo hai phong cách

#### Công việc đã thực hiện

- Khảo sát hiện trạng các ứng dụng web trên bản nhiều trường ở máy phát triển (ảnh chụp 1366, 1024, 390 điểm ảnh) và rà mã giao diện: ba màu chính khác nhau, một phông, cổng vận hành không dùng `packages/ui`, ứng dụng giáo viên và học sinh không có thanh điều hướng, quy tắc 44 điểm ảnh chỉ áp dưới 1280 ở cổng quản trị, viền ô nhập dưới 3:1.
- Lập danh sách màn hình chưa dùng được đầy đủ trên điện thoại, máy tính bảng theo tám nhóm (bảng nhiều cột, bảng nhập theo ô, lịch tuần, biểu mẫu dài, báo cáo, thao tác hàng loạt, thao tác chỉ dùng chuột, khác) kèm cách xử lý từng nhóm ở ba cỡ.
- Trình ba hướng thiết kế kèm ảnh minh họa; Eric chọn hai phong cách.
- Bổ sung tài liệu `15` mục 2.6 (PC-01 đến PC-28), mục 2.7 (GT-01 đến GT-06, sẵn sàng cho ứng dụng Android, iOS), mục 3 (phông Be Vietnam Pro cho mọi ứng dụng), mục 4 (KC-09 đến KC-11), mục 5.2 (TD-20 đến TD-32), MC-03; trạng thái chờ phê duyệt.
- Bản mẫu `tai_lieu/ban_mau/yctd-384/index.html`: 17 màn hình của năm ứng dụng, ba khổ, sáu trạng thái, gồm Gia sư AI (MH-596 đến MH-599) và hai biến thể của phong cách hành chính; đặc tả, danh sách lát, phương án ứng dụng Android, iOS và quy tắc App Store, Google Play ở `tai_lieu/ban_mau/yctd-384/DAC_TA.md`.

#### Quyết định

- Eric ngày 2026-10-30: cổng quản trị trường và cổng vận hành theo phong cách "Hành chính hiện đại"; ứng dụng giáo viên, phụ huynh, học sinh theo phong cách "Thân thiện theo vai" với màu nhấn giáo viên #0F6B5F, phụ huynh #1F5FA8, học sinh #6D28D9; menu cổng quản trị giữ số thứ bậc.
- Eric ngày 2026-10-30: mọi chức năng dùng được đầy đủ ở máy tính, máy tính bảng, điện thoại; hệ thiết kế dùng lại được cho ứng dụng Android, iOS (chỉ thiết kế, đề xuất); chợ gia sư tách sang kho riêng và chương trình gia sư trong trường (DT-27) bỏ, nên không thuộc việc này; thêm Gia sư AI.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-384, `15_HE_THONG_THIET_KE.md` mục 2.6, 2.7, 3, 4, 5.2, 7.

#### Vấn đề tồn đọng

- Chờ Eric duyệt bản mẫu, danh sách lát và bốn câu hỏi Q-384-1 đến Q-384-4; chưa viết mã giao diện.

## 24 Yêu cầu thay đổi

### YCTD-384: Thiết kế lại giao diện toàn hệ thống theo hai phong cách – 2026-10-30

- Lý do: Eric yêu cầu giao diện sạch, đẹp, hiện đại, thân thiện và mọi chức năng dùng được đầy đủ trên máy tính, máy tính bảng, điện thoại, sẵn sàng cho ứng dụng Android, iOS; khảo sát cho thấy màu, phông, điều hướng, thành phần chưa thống nhất và khoảng 130 màn hình chưa dùng được đầy đủ trên điện thoại hoặc máy tính bảng.
- Nội dung thay đổi: hai phong cách dùng chung một bộ biến ở `packages/ui` ("Hành chính hiện đại" cho cổng quản trị, cổng vận hành; "Thân thiện theo vai" cho giáo viên, phụ huynh, học sinh); một phông; điểm ngắt, vùng chạm 44 điểm ảnh, chữ ô nhập 16 điểm ảnh ở mọi khổ; mười ba thành phần dùng chung mới; cách xử lý ba cỡ cho tám nhóm màn hình khó; quy tắc sẵn sàng cho ứng dụng gốc; làm lại theo mười lát (`tai_lieu/ban_mau/yctd-384/DAC_TA.md`). Phương án ứng dụng Android, iOS chỉ là đề xuất, chưa xây.
- Thành phần bị ảnh hưởng: `packages/ui`, `apps/portal`, `apps/platform`, `apps/teacher`, `apps/parent`, `apps/student`; tài liệu `11`, `14`, `15`, `21`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Mức: Lớn (sửa giá trị đã có ở tài liệu `15`, chạm mọi ứng dụng web).
- Trạng thái: Chờ phê duyệt
