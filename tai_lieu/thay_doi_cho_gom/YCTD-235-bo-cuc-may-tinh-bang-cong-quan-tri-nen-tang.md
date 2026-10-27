---
yctd: YCTD-235
tieu_de: DT-26 phần 26e: bố cục máy tính bảng của cổng quản trị và cổng nền tảng
ngay: 2026-10-27
phien_ban_de_xuat: 0.159.0
---

## 02 Nhật ký

### 2026-10-27 — DT-26 phần 26e: bố cục máy tính bảng của cổng quản trị và cổng nền tảng

#### Công việc đã thực hiện

- `packages/ui`: `DataGrid` co giãn theo khổ (từ 768 px bảng cuộn ngang trong khung, cột đầu cố định; dưới 768 px dạng thẻ, cột chính làm tiêu đề, ba cột phụ đầu hiện ngay, các cột còn lại thu vào "Xem thêm"; cột chính khai báo bằng `primary`, không khai báo thì là cột đầu đang hiện); hộp thoại phủ kín màn hình dưới 768 px (`DIALOG_NARROW_FULL_SCREEN_CLASS`, áp cho hộp thoại của gói và ba hộp thoại của cổng quản trị); màu của bộ chủ đề đậm hơn để chữ đạt tương phản 4,5:1.
- Cổng quản trị: dưới 1280 px menu ngang thay bằng ngăn kéo bên trái mở bằng nút "Menu chức năng" (đóng bằng nút Đóng menu, nền mờ, phím Esc, khi chọn trang); dưới 1280 px vùng chạm 44 px, chữ ô nhập 16 px; dải nút Ghi, Hủy của biểu mẫu dính đáy dưới 768 px.
- Cổng nền tảng: từ 1280 px thanh bên đầy đủ; 768 đến 1279 px thanh chỉ còn biểu tượng, tên mục hiện khi rê chuột, đưa bàn phím tới hoặc chạm giữ; dưới 768 px ngăn kéo mở bằng nút ☰; nội dung rộng cuộn ngang trong vùng nội dung; vùng chạm, cỡ chữ ô nhập như cổng quản trị.
- Kiểm thử: e2e spec 184 (bốn khổ thiết bị); gỡ toàn bộ mục còn lại của đường cơ sở 26c (`tests/e2e/device-baseline.json` rỗng), spec 180 không còn cần đường cơ sở.

#### Quyết định

- Cổng quản trị không có thanh bên (từ DT-15 dùng menu ngang nhiều cấp theo mẫu của Sở) nên "thu gọn thành biểu tượng" của đặc tả áp cho cổng nền tảng; cổng quản trị dùng ngăn kéo dưới 1280 px vì menu ngang sổ xuống bằng rê chuột không hợp màn hình chạm và tràn dòng ở máy tính bảng ngang (QĐ-39).
- `DataGrid` chọn dạng bảng hay thẻ bằng `matchMedia` để chỉ dựng một dạng (dựng cả hai rồi ẩn bằng CSS làm mỗi ô có hai bản trong trang, bộ chọn của kiểm thử khớp hai phần tử).
- Đổi màu ngay ở bộ chủ đề chung (`packages/ui/src/theme.css`) thay vì ghi đè trong từng ứng dụng; ứng dụng giáo viên, phụ huynh đã ghi đè cùng giá trị ở 26d nên không đổi.
- Spec 184 tự chạy máy chủ Vite của cổng nền tảng và giả lập API đăng nhập vì môi trường e2e một trường không có cổng nền tảng; không sửa cấu hình Playwright của 26c.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-235, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-313, P19-10, AC-967 đến AC-969, CT-1258 đến CT-1260, MH-424, QĐ-39; màu M-01 đến M-03, M-05, C-03, T-01 đến T-05 ở `15_HE_THONG_THIET_KE.md`.

#### Vấn đề tồn đọng

- Thử trên máy tính bảng thật khi Eric có máy. Màn hình nghiệp vụ tự vẽ bảng (không dùng `DataGrid`) vẫn cuộn ngang trong khung của mình, chưa có dạng thẻ.

## 24 Yêu cầu thay đổi

### YCTD-235: DT-26 phần 26e: bố cục máy tính bảng của cổng quản trị và cổng nền tảng – 2026-10-27

- Lý do: phần 26e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 18 (đợt 2 của DT-26); 26d đã gộp (PR 200); phiên điều phối giao cho phiên chủ DT-26 ngày 2026-10-27.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Điều hướng cổng quản trị** (`apps/portal/src/pages/AppShell.tsx`, `MainMenu.tsx`): từ 1280 px giữ menu ngang; dưới 1280 px nút "Menu chức năng" mở ngăn kéo bên trái chứa cây menu gập của phân hệ đang chọn, giữ thứ tự và quyền như menu ngang; mục menu cao 44 px.
  - **Điều hướng cổng nền tảng** (`apps/platform/src/Application.tsx`, `platform-icons.tsx`, `index.css`): thanh bên đầy đủ từ 1280 px, chỉ biểu tượng ở 768 đến 1279 px (tên mục hiện khi rê chuột, đưa bàn phím tới, chạm giữ; tên đọc giữ bằng `aria-label`), ngăn kéo dưới 768 px; trang cấp trên xếp menu thành hàng dưới 768 px.
  - **Bảng dữ liệu** (`packages/ui/src/DataGrid.tsx`): cột đầu cố định khi cuộn ngang; dạng thẻ dưới 768 px; cột `primary`.
  - **Biểu mẫu, hộp thoại**: `FormRow` đã là hai cột (nhãn, ô) từ 768 px và một cột dưới 768 px, giữ nguyên; hộp thoại phủ kín màn hình dưới 768 px; dải nút Ghi, Hủy (`FormButtons`) dính đáy dưới 768 px.
  - **Truy cập**: màu nút chính, thanh đầu trang, liên kết, báo lỗi, cảnh báo, thông tin, thành công, chữ mờ đậm hơn ở bộ chủ đề; dưới 1280 px vùng chạm 44 px, chữ ô nhập 16 px ở cổng quản trị và cổng nền tảng.
  - **Màn hình đã rà**: trang đăng nhập và trang chủ cổng quản trị, ngăn kéo menu, Danh sách người dùng (lưới dữ liệu, hộp thoại Cấu hình cột hiển thị), trang đăng nhập và trang tổng quan cổng nền tảng (e2e spec 184, 180 ở bốn khổ). Danh sách học sinh, điểm danh, học phí, sổ điểm dùng chung `DataGrid`, `FormRow`, `FormButtons` nên nhận cùng bố cục; việc CI theo khổ thiết bị không có năm học nên các màn hình này chưa đo tự động.
- Thành phần bị ảnh hưởng: `packages/ui`, `apps/portal`, `apps/platform`, `tests` (spec 184, đường cơ sở). Ứng dụng giáo viên, phụ huynh nhận màu mới của bộ chủ đề (trùng giá trị đã ghi đè ở 26d).
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: MH-424; mọi lưới dữ liệu, hộp thoại của cổng quản trị ở khổ hẹp; menu cổng quản trị dưới 1280 px; thanh bên cổng nền tảng dưới 1280 px; màu của các ứng dụng dùng bộ chủ đề.
- Quyền bị ảnh hưởng: không (ngăn kéo dùng cùng danh sách mục đã lọc theo quyền).
- Ảnh hưởng chức năng cũ: từ 1280 px cổng quản trị giữ menu ngang và kích thước cũ; e2e khổ máy tính hiện có đạt không sửa kỳ vọng.
- Kiểm thử cần thực hiện: e2e spec 184, 180 ở bốn khổ thiết bị (CT-1258 đến CT-1260); e2e khổ máy tính của menu (01), tài khoản (04) và các spec dùng lưới dữ liệu; typecheck, lint.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-26 phần 26e, bố cục máy tính bảng của cổng quản trị và cổng nền tảng (YCTD-235).
- Chức năng mới: ngăn kéo menu của cổng quản trị dưới 1280 px; thanh biểu tượng và ngăn kéo của cổng nền tảng; lưới dữ liệu cột đầu cố định và dạng thẻ; hộp thoại toàn màn hình ở khổ hẹp (P19-10, MH-424).
- Lỗi đã sửa: nút, ô nhập dưới 44 px, chữ ô nhập dưới 16 px, màu chữ thiếu tương phản ở cổng quản trị (đường cơ sở 26c không còn mục nào).
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Kiểm thử: CT-1258 đến CT-1260. Kết quả: e2e thiết bị (E2E_DEVICES=full, spec 180 và 184, bốn dự án `dien-thoai`, `may-tinh-bang-doc`, `may-tinh-bang-ngang`, `dien-thoai-webkit`) 28/28 đạt; spec 184 ở khổ máy tính `chromium` 3/3 đạt; hồi quy khổ máy tính 01–09, 11, 13, 51, 53, 54, 55, 62, 67, 73, 90, 98 (menu, ngăn kéo ở khổ 375, tài khoản, học sinh, điểm danh, học phí, sổ điểm, lưới dữ liệu) đạt không sửa kỳ vọng (spec 02 nới thời gian chờ tại máy, không đưa vào mã); typecheck `apps/teacher`, `apps/parent`, `apps/portal`, `apps/platform`, `tests`, lint, prettier đạt. Lỗi tìm thấy khi đo và đã sửa: nhãn ẩn của cột thao tác (định vị tuyệt đối) kéo rộng cả trang ở khổ máy tính bảng (khung cuộn của bảng nay làm khối chứa); ô lưới trong bố cục lưới CSS bị bảng đẩy rộng (thêm `min-w-0`); ô chọn của bảng, liên kết Quên mật khẩu, Việc của tôi, tên trường dưới 44 px; chữ trên nền nhạt của nhãn trạng thái thành công, trung tính và tên trường vàng thiếu tương phản.
- Rủi ro: màu toàn hệ thống đậm hơn một bậc; màn hình tự vẽ bảng chưa có dạng thẻ; chưa thử trên máy tính bảng thật.
- Khả năng tương thích: từ 1280 px giữ bố cục cũ; không đổi API, dữ liệu.
- Phương án quay lui: hoàn lại commit gộp của nhánh; không có thay đổi dữ liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-26 phần 26e: bố cục máy tính bảng của cổng quản trị và cổng nền tảng, màu đủ tương phản ở bộ chủ đề | YCTD-235 |

## index Số đếm

| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +1 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | cuối bảng 12.1 Quy tắc về phân cấp phê duyệt | BR-313 | Bố cục máy tính bảng của cổng quản trị và cổng nền tảng (YCTD-235, DT-26 phần 26e): cổng quản trị từ 1280 px giữ menu ngang, dưới 1280 px menu là ngăn kéo bên trái; cổng nền tảng từ 1280 px thanh bên đầy đủ, 768 đến 1279 px chỉ biểu tượng (tên mục hiện khi rê chuột, đưa bàn phím tới, chạm giữ), dưới 768 px ngăn kéo; ngăn kéo giữ thứ tự mục và quyền như menu đầy đủ. Lưới dữ liệu từ 768 px là bảng cuộn ngang trong khung, cột đầu cố định; dưới 768 px mỗi dòng một thẻ, cột chính làm tiêu đề, ba cột phụ đầu hiện ngay, các cột còn lại thu vào "Xem thêm". Hộp thoại phủ kín màn hình dưới 768 px; nút Ghi, Hủy của biểu mẫu dính đáy dưới 768 px. Dưới 1280 px nút, ô nhập, mục menu cao tối thiểu 44 px, chữ ô nhập tối thiểu 16 px; chữ trên nền màu đạt tương phản 4,5:1 |
| 10_YEU_CAU_CHUC_NANG.md | cuối bảng 20. Phân hệ P19 — Kênh truy cập và thông báo | P19-10 | Bố cục máy tính bảng của cổng quản trị và cổng nền tảng (YCTD-235, DT-26 phần 26e) | Mọi người dùng cổng quản trị; người vận hành nền tảng | Menu theo quyền, lưới dữ liệu, biểu mẫu, hộp thoại sẵn có | Ngăn kéo menu, thanh biểu tượng, lưới cột cố định hoặc dạng thẻ, hộp thoại toàn màn hình, nút Ghi dính đáy theo khổ màn hình | Dùng được trên máy tính bảng dọc, ngang và điện thoại | BR-313 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-967 | Cho hiệu trưởng đã đăng nhập cổng quản trị / Khi mở trang chủ ở khổ điện thoại 390 × 844, máy tính bảng dọc 820 × 1180, ngang 1180 × 820 và máy tính 1280 px / Thì từ 1280 px có menu ngang; dưới 1280 px không có menu ngang, nút "Menu chức năng" mở ngăn kéo sát mép trái rộng tối đa 320 px, con trỏ vào nút Đóng menu, Esc và nút Đóng menu đóng ngăn kéo | P19-10 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-968 | Cho Danh sách người dùng / Khi mở ở bốn khổ và bấm Cấu hình cột hiển thị / Thì từ 768 px là bảng, tiêu đề cột đầu cố định khi cuộn ngang; dưới 768 px không có bảng, mỗi dòng một thẻ; hộp thoại dưới 768 px rộng bằng màn hình, từ 768 px hẹp hơn màn hình | P19-10 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-969 | Cho trang đăng nhập, trang chủ, ngăn kéo menu, Danh sách người dùng của cổng quản trị và trang đăng nhập, trang tổng quan của cổng nền tảng ở bốn khổ / Khi đo bằng bộ kiểm của 26c / Thì không cuộn ngang cả trang, không ô nhập chữ dưới 16 px, không nút, ô nhập, mục menu dưới 44 × 44 px, axe không lỗi nghiêm trọng (gồm tương phản màu); đường cơ sở của 26c rỗng | P19-10 |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-424 | Cổng quản trị và cổng nền tảng theo khổ thiết bị (YCTD-235): cổng quản trị dưới 1280 px: nút "Menu chức năng" trên thanh đầu trang mở ngăn kéo bên trái (tên phân hệ, nút Đóng menu, Trang chủ, cây menu gập), nền mờ phía sau; lưới dữ liệu dưới 768 px: mỗi dòng một thẻ (ô chọn, cột chính in đậm, ba cột phụ dạng nhãn và giá trị, "Xem thêm N cột", nút thao tác), có "Chọn tất cả dòng trên trang"; từ 768 px bảng cuộn ngang trong khung, cột đầu (sau ô chọn) cố định; hộp thoại phủ kín màn hình dưới 768 px; dải nút Ghi, Hủy dính đáy dưới 768 px. Cổng nền tảng: 768 đến 1279 px thanh bên rộng 4,5rem chỉ biểu tượng, tên mục hiện cạnh biểu tượng khi rê chuột, đưa bàn phím tới, chạm giữ; dưới 768 px nút ☰ mở ngăn kéo | P19-10 |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1258 | P19-10 | CT-26e-1: cổng quản trị ở bốn khổ thiết bị và khổ máy tính: menu ngang từ 1280 px, ngăn kéo dưới 1280 px (vị trí, độ rộng, con trỏ, Esc, nút Đóng menu); trang chủ, ngăn kéo không cuộn ngang, vùng chạm, cỡ chữ, axe | Đúng | Đạt; e2e spec 184 (`tests/e2e/184-tablet-portal-platform.spec.ts`), dự án `dien-thoai`, `may-tinh-bang-doc`, `may-tinh-bang-ngang`, `dien-thoai-webkit`; AC-967, AC-969 | Cao |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1259 | P19-10 | CT-26e-2: Danh sách người dùng: bảng có cột đầu cố định từ 768 px, dạng thẻ dưới 768 px; hộp thoại Cấu hình cột hiển thị phủ kín màn hình dưới 768 px; trang đạt bộ kiểm | Đúng | Đạt; e2e spec 184; AC-968, AC-969 | Cao |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1260 | P19-10 | CT-26e-3: cổng nền tảng (máy chủ Vite riêng, API giả lập): thanh bên đầy đủ từ 1280 px, biểu tượng có tên khi rê chuột ở 768 đến 1279 px, ngăn kéo dưới 768 px; trang đăng nhập, trang tổng quan đạt bộ kiểm; trang đăng nhập cổng quản trị không còn vi phạm (spec 180 không cần đường cơ sở) | Đúng | Đạt; e2e spec 184, 180; AC-969 | Cao |
