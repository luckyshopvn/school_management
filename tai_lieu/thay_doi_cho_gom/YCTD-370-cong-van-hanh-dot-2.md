---
yctd: YCTD-370
tieu_de: Thiết kế lại các trang còn lại của cổng vận hành (đợt 2)
ngay: 2026-10-29
phien_ban_de_xuat: 0.240.0
---

## 02 Nhật ký

### 2026-10-29 — Thiết kế lại các trang còn lại của cổng vận hành (đợt 2)

#### Công việc đã thực hiện

- Thiết kế lại tám trang cổng vận hành chưa làm ở YCTD-324 và YCTD-363 theo bản mẫu Eric duyệt ngày 2026-10-29: Bảng điều khiển (MH-330), Danh mục đơn vị (MH-580), Gói dịch vụ (MH-323), Thu phí (MH-328), Trợ lý AI (MH-341), Bảo trì (MH-331), Nhân viên vận hành (MH-581), Đổi mật khẩu (MH-582). Trang Đăng nhập giữ nguyên. Giữ đủ chức năng, dữ liệu, điểm cuối; tám lát, mỗi lát một commit.
- Thành phần dùng chung ở `apps/platform/src/platform-ui.tsx`: hộp thoại, hộp xác nhận, dải kết quả, khối rỗng, khung xương, thẻ chọn, chặn bấm gửi lặp. Bỏ mọi hộp nhập, hộp xác nhận của trình duyệt ở tám trang.
- Ẩn nút mà máy chủ đã chặn theo vai trò đang đăng nhập (`operatorCan`); quyền ở máy chủ không đổi. Trang không thuộc vai trò hiện "Bạn không có quyền xem trang này".
- Sửa LOI-VH2-1: Hỗ trợ, Kỹ thuật mở Gói dịch vụ bị báo lỗi cả trang vì trang gọi `GET billing/price-rules` (cần `billing.view`); nay chỉ gọi khi vai trò có quyền này.
- Chữ cổng vận hành tối thiểu 14 điểm ảnh (Q2 phương án a, LOI-VH2-2); bảng màu cổng vận hành và thành phần mới ghi vào tài liệu 15 mục 2.5, 5.1 (ĐX-15.1 đến ĐX-15.3, LOI-VH2-3).
- Kiểm thử: e2e mới `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` (CT-1690 đến CT-1701) đạt 12 trên 12 trên máy; ca cổng nền tảng của e2e 184 (CT-26e-3) đạt ở 1366, 1024, 390 điểm ảnh; ảnh chụp ba khổ từng lát đối chiếu bản mẫu.

#### Quyết định

- Eric duyệt ngày 2026-10-29: Q1 duyệt bản mẫu tám trang, Đăng nhập giữ nguyên; Q2 phương án a; Q3 duyệt ĐX-15.1 đến ĐX-15.3; Q4 ẩn nút theo quyền; Q5 bỏ khối "Tình trạng dịch vụ" khỏi đợt này; Q6 lập phiếu riêng cho ĐX-CN-1, 2, 3, 5, 6, 7, không làm ĐX-CN-4.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: ô mật khẩu mới giữ kiểm độ dài của trình duyệt (như trước), quy tắc dưới ô báo "Chưa đủ"; nhãn vai trò trong bảng nhân viên giữ cách gọi của `operators-api.ts`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-370, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `15_HE_THONG_THIET_KE.md` mục 2.5, 5.1, `14_DAC_TA_GIAO_DIEN.md` MH-323, MH-328, MH-330, MH-331, MH-341, MH-580 đến MH-582.

#### Vấn đề tồn đọng

- Phiếu riêng chờ làm theo thứ tự ĐX-CN-7, 6, 5, 2, 3, 1.
- Thông báo "Bạn không có quyền xem trang này" chỉ hiện khi vai trò đổi giữa phiên; chưa có kiểm thử tự động.

## 24 Yêu cầu thay đổi

### YCTD-370: Thiết kế lại các trang còn lại của cổng vận hành (đợt 2) – 2026-10-29

- Lý do: Eric hỏi đã thiết kế lại toàn bộ cổng vận hành chưa; tám trang sau YCTD-324, YCTD-363 vẫn là giao diện cũ (tiêu đề cấp hai, biểu mẫu dài, hộp nhập của trình duyệt, nút hiện cho vai trò không được làm).
- Nội dung thay đổi: thiết kế lại giao diện tám trang theo bản mẫu đã duyệt; thành phần dùng chung; ẩn nút theo quyền đã có; sửa LOI-VH2-1; chữ tối thiểu 14 điểm ảnh; ghi bảng màu, thành phần vào tài liệu 15.
- Thành phần bị ảnh hưởng: `apps/platform/src/Application.tsx`, `apps/platform/src/cong-van-hanh.css`, `apps/platform/src/platform-ui.tsx` (mới), `DashboardPage.tsx`, `CatalogPage.tsx`, `PlansPage.tsx`, `BillingPage.tsx`, `AiPage.tsx`, `MaintenancePage.tsx`, `OperatorsPage.tsx`, `OperatorPasswordPage.tsx`, `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` (mới), tài liệu 14, 15.
- Dữ liệu bị ảnh hưởng: không; không có database migration.
- API bị ảnh hưởng: không; trang Gói dịch vụ chỉ gọi `GET billing/price-rules` khi vai trò có `billing.view`.
- Quyền bị ảnh hưởng: không đổi quyền; giao diện ẩn hoặc chuyển sang chỉ xem phần máy chủ đã chặn.
- Mức: Lớn (nhiều trang, sửa giá trị tài liệu 15). Người phê duyệt: Eric, ngày 2026-10-29.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: thiết kế lại tám trang còn lại của cổng vận hành, thành phần dùng chung, ẩn nút theo quyền, sửa trang Gói dịch vụ với vai trò Hỗ trợ, Kỹ thuật, chữ tối thiểu 14 điểm ảnh (YCTD-370).
- Quay lui: hoàn tác commit hợp nhất của PR; không có database migration, không đổi cấu hình.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Thiết kế lại các trang còn lại của cổng vận hành (đợt 2) | YCTD-370 |

## Thêm dòng

| 14_DAC_TA_GIAO_DIEN.md | MH-341 | MH-580 | Cổng vận hành nền tảng: Danh mục đơn vị (YCTD-220, thiết kế lại ở YCTD-370; mục menu "Danh mục đơn vị"): ba thẻ chọn Danh mục, Trang đăng nhập, Chính sách vào trường. Thẻ Danh mục: năm ô số liệu (đơn vị theo cấp học, phường xã và số sở, lần nhập gần nhất, đơn vị cần xem lại, trường đã gắn mã Bộ); tra cứu đơn vị (Sở bắt buộc, cấp học, cờ, tên hoặc mã; Xem thêm; cột Vào trường hoặc Khởi tạo và vào trường chỉ cho Quản trị); bảng cờ chất lượng có nút Xem; nhập CSV (chỉ `catalog.manage`): Chạy thử, Nhập danh mục có xác nhận, báo cáo nhập trong hộp thoại có "Nhập thật tệp này"; các lần nhập gần đây. Hai thẻ còn lại: biểu mẫu cho vai trò có quyền, dạng chỉ xem cho vai trò khác; nút "Xem nhật ký vào trường" cho `audit.view` | Người vận hành nền tảng |
| 14_DAC_TA_GIAO_DIEN.md | MH-341 | MH-581 | Cổng vận hành nền tảng: Nhân viên vận hành (YCTD-311, thiết kế lại ở YCTD-370; chỉ Quản trị): nút "Thêm nhân viên" mở hộp thoại (tên đăng nhập, họ tên, vai trò, mã hai lớp của người tạo); thông tin hiện một lần trong hộp thoại có nút Chép, chỉ đóng bằng "Đã lưu, đóng"; bảng nhân viên (tên, tên đăng nhập, vai trò đổi có xác nhận, trạng thái kèm "Tạm khóa đến", xác thực hai lớp, đăng nhập gần nhất, Khóa có xác nhận, Mở khóa, Cấp lại khóa hai lớp trong hộp thoại). Từ YCTD-373: hộp thông tin hiện một lần có mã QR của địa chỉ `otpauth` | Quản trị nền tảng |
| 14_DAC_TA_GIAO_DIEN.md | MH-341 | MH-582 | Cổng vận hành nền tảng: Đổi mật khẩu (YCTD-323, thiết kế lại ở YCTD-370; mục "Đổi mật khẩu" ở chân thanh bên): thẻ rộng tối đa 480 điểm ảnh; mật khẩu hiện tại, mật khẩu mới có nút Hiện, hai dòng quy tắc đổi nhãn Đạt khi gõ (từ 12 ký tự, hai lần nhập khớp), nhập lại, mã hai lớp; lỗi tại đúng ô; còn mật khẩu tạm thì thanh bên không có mục nào và có dải cảnh báo | Người vận hành nền tảng |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1145 | Cho tám trang cổng vận hành thiết kế lại / Khi mở ở 1366, 1024, 390 điểm ảnh / Thì khớp bản mẫu đã duyệt, không cuộn ngang ngoài bảng (Bắt buộc; CT-1702, CT-1703; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1146 | Cho mọi chức năng có trước YCTD-370 ở tám trang / Khi làm lại sau thiết kế mới / Thì gọi đúng điểm cuối cũ với cùng dữ liệu gửi (Bắt buộc; CT-1692 đến CT-1696, CT-1704; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1147 | Cho bốn vai trò vận hành / Khi mở tám trang / Thì nút và biểu mẫu chỉ hiện với vai trò có quyền, vai trò khác thấy dạng chỉ xem hoặc không thấy; máy chủ vẫn kiểm quyền (Bắt buộc; CT-1691, CT-1697, CT-1700, CT-1701; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1148 | Cho vai trò Hỗ trợ, Kỹ thuật / Khi mở Gói dịch vụ / Thì thấy danh sách gói, không có dải lỗi (LOI-VH2-1) (Bắt buộc; CT-1690; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1149 | Cho thao tác không hoàn tác được (hủy thông báo bảo trì, hủy hóa đơn, khóa nhân viên, đổi vai trò, nhập danh mục thật, chạy chuyển trạng thái theo hạn) / Khi bấm / Thì có hộp xác nhận; Quay lại không gửi gì; hủy hóa đơn phải tích ô đồng ý (Bắt buộc; CT-1692, CT-1694, CT-1695; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1150 | Cho tám trang / Khi tìm `window.prompt`, `window.confirm` / Thì không còn (Bắt buộc; CT-1699; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1151 | Cho mỗi trang / Khi đang tải, rỗng, lỗi tải, thao tác thành công hoặc thất bại / Thì có khung xương, khối rỗng, dải lỗi có nút Tải lại, dải kết quả nêu lỗi của máy chủ (Bắt buộc; CT-1702; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1152 | Cho biểu mẫu nhập sai (kết thúc trước bắt đầu, JSON đơn giá theo mô hình, mật khẩu mới ngắn, lý do điều chỉnh trống) / Khi gửi / Thì lỗi hiện tại đúng ô, không gửi (Bắt buộc; CT-1693, CT-1695, CT-1696; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1153 | Cho nút gửi / Khi bấm nhiều lần nhanh / Thì chỉ gửi một lần, nút có trạng thái đang xử lý (Bắt buộc; CT-1693; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1154 | Cho người dùng bàn phím / Khi chuyển thẻ chọn, mở, đóng hộp thoại / Thì mũi tên chuyển thẻ, Esc đóng hộp thoại (trừ hộp thông tin hiện một lần), tiêu điểm về nút đã mở, có viền tiêu điểm (Bắt buộc; CT-1692, CT-1697; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1155 | Cho cổng vận hành / Khi đo chữ, màu / Thì không chữ nào dưới 14 điểm ảnh, chữ đạt tương phản 4,5:1, chỉ dùng giá trị ở tài liệu 15 mục 2.5 (Bắt buộc; CT-1702, CT-1703; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1156 | Cho thông tin hiện một lần (mật khẩu tạm, khóa hai lớp, mã khôi phục) / Khi nhấn Esc hoặc xem bộ nhớ trình duyệt / Thì hộp không đóng, bộ nhớ không có các giá trị này; chỉ đóng bằng "Đã lưu, đóng" (Bắt buộc; CT-1694; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1157 | Cho Tổng quan, Trường học, Nhật ký truy cập, Đơn vị cấp trên, Chợ gia sư / Khi mở sau YCTD-370 / Thì không đổi ngoài cỡ chữ tối thiểu 14 điểm ảnh (Bắt buộc; CT-1703, CT-1704; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1158 | Cho Bảng điều khiển / Khi Kế toán, Kỹ thuật bấm số lỗi / Thì Kế toán chỉ thấy số, Kỹ thuật mở được hộp thoại lỗi theo giờ của đúng trường (Bắt buộc; CT-1700, CT-1701; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1159 | Cho Trợ lý AI / Khi xem đơn giá theo gói và bấm "Sửa ở Gói dịch vụ" / Thì nhãn Sẵn sàng hoặc Chưa nhập đơn giá đúng, trang Gói mở đúng gói (Mong muốn; CT-1698; YCTD-370) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1160 | Cho trang không thuộc vai trò / Khi đang mở / Thì hiện "Bạn không có quyền xem trang này" thay khoảng trắng (Mong muốn; kiểm bằng xem mã; YCTD-370) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1690 | P19-06 | Hỗ trợ mở Gói dịch vụ; máy chủ trả 403 cho quy tắc tính phí | Thấy danh sách gói, không có dải lỗi, không có nút Lập gói mới, Sửa | Kiểm thử giao diện `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1691 | P19-06 | Hỗ trợ mở Bảo trì | Thấy bảng thông báo; không có biểu mẫu tạo, nút Hủy | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1692 | P19-06 | Quản trị bấm Hủy thông báo, chọn Quay lại, Esc, rồi xác nhận | Hộp xác nhận; Quay lại, Esc không gửi; tiêu điểm về nút Hủy; xác nhận gửi đúng một yêu cầu hủy | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1693 | P19-06 | Kỹ thuật tạo thông báo: kết thúc trước bắt đầu; sửa rồi bấm nhanh hai lần | Lỗi tại ô Kết thúc, không gửi; sau khi sửa chỉ một yêu cầu tạo | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1694 | P19-06 | Quản trị thêm nhân viên, nhấn Esc ở hộp thông tin một lần, đọc bộ nhớ trình duyệt; khóa nhân viên, Quay lại rồi xác nhận | Hộp không đóng bằng Esc, không có nút Đóng; bộ nhớ không có khóa, mật khẩu; khóa gửi `status: locked` một lần sau xác nhận | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1695 | P19-06 | Kế toán chọn Hủy hóa đơn: chưa tích ô đồng ý; tích ô, lý do trống | Nút khóa khi chưa tích; lý do trống báo tại ô; không gửi | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1696 | P19-06 | Đổi mật khẩu mới 11 ký tự, rồi 12 ký tự (giá trị biên) | 11 ký tự không gửi, quy tắc báo Chưa đủ; 12 ký tự gửi một lần, báo Đã đổi mật khẩu | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1697 | P19-06 | Kỹ thuật mở Danh mục đơn vị, chuyển thẻ bằng mũi tên | Tiêu điểm theo thẻ; Chính sách vào trường ở dạng chỉ xem, không có nút Xem nhật ký | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1698 | P19-06 | Kế toán bấm "Sửa ở Gói dịch vụ" ở gói chưa nhập đơn giá | Nhãn Chưa nhập đơn giá; trang Gói mở biểu mẫu và Phí AI của đúng gói | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1699 | P19-06 | Tìm `window.prompt`, `window.confirm` trong tám tệp trang | Không còn | Kiểm thử spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1700 | P19-06 | Kế toán mở Bảng điều khiển, Thu phí (Cấu hình), Trợ lý AI | Không có nút số lỗi, không có ô khóa cổng thanh toán, nhà cung cấp AI ở dạng chỉ xem | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1701 | P19-06 | Kỹ thuật bấm số lỗi của trường, mở Bảo trì | Hộp thoại lỗi đúng trường; thấy biểu mẫu tạo thông báo | Kiểm thử giao diện spec 240 đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1702 | P19-06 | Chụp tám trang ở 1366, 1024, 390 điểm ảnh với dữ liệu giả, các vai trò, hộp thoại, trạng thái rỗng | Khớp bản mẫu đã duyệt; không cuộn ngang cả trang | Ảnh chụp từng lát, đối chiếu bản mẫu ngày 29/10/2026; Eric xem | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1703 | P19-06 | Chạy lại CT-26e-3 của e2e 184 ở 1366, 1024, 390 điểm ảnh sau khi nâng cỡ chữ | Không cuộn ngang, cỡ chữ ô nhập, vùng chạm, axe đạt | Kiểm thử giao diện `tests/e2e/184-tablet-portal-platform.spec.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1704 | P19-06 | Chạy lại e2e có chạm cổng vận hành: 132, 136, 137, 139, 141, 160 | Đạt như trước | Chạy ở CI của PR YCTD-370 | Chưa chạy |
