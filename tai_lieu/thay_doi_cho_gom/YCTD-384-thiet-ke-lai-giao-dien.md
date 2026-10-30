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
- Eric ngày 2026-10-30 (Q-384-1 đến Q-384-4): phong cách hành chính theo thanh bên xanh đậm như cổng đang dùng; định nghĩa sẵn giá trị chế độ tối, chưa bật; ứng dụng Android, iOS về sau theo phương án Capacitor đóng gói; gói Gia sư AI trong ứng dụng cài từ cửa hàng bán trực tiếp, thanh toán bằng mã QR (rủi ro bị từ chối theo quy tắc thanh toán nội dung số của Apple, Google, ghi ở đặc tả mục 8.4).

- Eric duyệt bản mẫu và danh sách mười lát ngày 2026-10-30; tài liệu `15` mục 2.6, 2.7, 3, 4, 5.2, 7 chuyển Đã phê duyệt; tài liệu `14` sửa BC-02, BC-11, TN-01 đến TN-04, thêm BC-18; tài liệu `11` thêm AC-1200 đến AC-1216, tài liệu `21` thêm CT-1800 đến CT-1816.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-384, `15_HE_THONG_THIET_KE.md` mục 2.6, 2.7, 3, 4, 5.2, 7.

#### Vấn đề tồn đọng

- Lát L1 đến L9 làm tiếp theo danh sách đã duyệt.
- Thanh toán gói Gia sư AI bằng mã QR trong ứng dụng cài từ cửa hàng có thể bị Apple, Google từ chối; kiểm lại trước khi nộp (DT-26 phần 26h).

## 24 Yêu cầu thay đổi

### YCTD-384: Thiết kế lại giao diện toàn hệ thống theo hai phong cách – 2026-10-30

- Lý do: Eric yêu cầu giao diện sạch, đẹp, hiện đại, thân thiện và mọi chức năng dùng được đầy đủ trên máy tính, máy tính bảng, điện thoại, sẵn sàng cho ứng dụng Android, iOS; khảo sát cho thấy màu, phông, điều hướng, thành phần chưa thống nhất và khoảng 130 màn hình chưa dùng được đầy đủ trên điện thoại hoặc máy tính bảng.
- Nội dung thay đổi: hai phong cách dùng chung một bộ biến ở `packages/ui` ("Hành chính hiện đại" cho cổng quản trị, cổng vận hành; "Thân thiện theo vai" cho giáo viên, phụ huynh, học sinh); một phông; điểm ngắt, vùng chạm 44 điểm ảnh, chữ ô nhập 16 điểm ảnh ở mọi khổ; mười ba thành phần dùng chung mới; cách xử lý ba cỡ cho tám nhóm màn hình khó; quy tắc sẵn sàng cho ứng dụng gốc; làm lại theo mười lát (`tai_lieu/ban_mau/yctd-384/DAC_TA.md`). Phương án ứng dụng Android, iOS chỉ là đề xuất, chưa xây.
- Thành phần bị ảnh hưởng: `packages/ui`, `apps/portal`, `apps/platform`, `apps/teacher`, `apps/parent`, `apps/student`; tài liệu `11`, `14`, `15`, `21`.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Quyền bị ảnh hưởng: không.
- Mức: Lớn (sửa giá trị đã có ở tài liệu `15`, chạm mọi ứng dụng web).
- Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## Thêm dòng

| 14_DAC_TA_GIAO_DIEN.md | BC-17 | BC-18 | Mọi chức năng của cổng quản trị, cổng vận hành, ứng dụng giáo viên, phụ huynh, học sinh dùng được đầy đủ ở máy tính, máy tính bảng, điện thoại bằng chuột, bàn phím hoặc cảm ứng; cách bày theo nhóm màn hình ở `tai_lieu/ban_mau/yctd-384/DAC_TA.md` mục 3 (bảng nhiều cột, bảng nhập theo ô, lịch tuần, biểu mẫu dài, báo cáo, thao tác hàng loạt, thao tác chỉ dùng chuột) (YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1200 | Cho mỗi màn hình đã làm lại / Khi mở ở 1366, 1024, 390 điểm ảnh / Thì khớp bản mẫu đã duyệt, không có thanh cuộn ngang ngoài vùng bảng (Bắt buộc; CT-1800; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1201 | Cho mọi ứng dụng / Khi đo / Thì không chữ nào dưới 14 điểm ảnh, chữ ô nhập 16 điểm ảnh, nút, ô nhập, mục menu cao từ 44 điểm ảnh ở mọi khổ (Bắt buộc; CT-1801; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1202 | Cho mọi cặp chữ, nền / Khi đo / Thì đạt 4,5:1 (chữ thường), 3:1 (chữ từ 18 điểm ảnh, viền ô nhập, viền tiêu điểm) (Bắt buộc; CT-1802; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1203 | Cho mã giao diện đã sửa / Khi tìm mã màu viết cứng, lớp màu Tailwind, ghi đè biến màu ở từng ứng dụng / Thì không có, chỉ dùng biến sinh từ tài liệu 15 (Bắt buộc; CT-1803; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1204 | Cho mọi chức năng có trước YCTD-384 / Khi làm lại sau khi đổi giao diện / Thì gọi đúng điểm cuối cũ với cùng dữ liệu gửi; e2e hiện có đạt (Bắt buộc; CT-1804; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1205 | Cho cổng quản trị / Khi ở máy tính bảng, điện thoại / Thì còn điều hướng (dải biểu tượng, ngăn menu), số thứ bậc giữ nguyên (Bắt buộc; CT-1805; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1206 | Cho ứng dụng giáo viên, phụ huynh, học sinh / Khi dưới 1024 hoặc từ 1024 điểm ảnh / Thì có thanh dưới hoặc thanh bên; mọi chức năng cũ vào được qua lối tắt, thanh, hoặc "Tất cả" (Bắt buộc; CT-1806; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1207 | Cho mỗi màn hình đã làm lại / Khi đang tải, rỗng, lỗi, không có quyền, thao tác thành công / Thì có khung xương, khối rỗng, dải lỗi có nút Tải lại và mã tra cứu, thông báo không có quyền, thông báo nổi (Bắt buộc; CT-1807; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1208 | Cho người dùng bàn phím / Khi Tab qua khung, menu, lưới, biểu mẫu / Thì đi đúng thứ tự, có viền tiêu điểm, ô nhập có nhãn (Bắt buộc; CT-1808; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1209 | Cho bảng dữ liệu nhiều cột / Khi dưới 768 điểm ảnh / Thì thành danh sách thẻ hoặc cuộn ngang trong khung của bảng có cột đầu dính (Bắt buộc; CT-1809; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1210 | Cho nút theo quyền / Khi đăng nhập từng vai trò / Thì nút hiện, ẩn như trước YCTD-384; máy chủ vẫn kiểm quyền (Bắt buộc; CT-1810; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1211 | Cho ngày hiển thị trên màn hình đã làm lại / Khi xem / Thì dạng ngày/tháng/năm (Mong muốn; CT-1811; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1212 | Cho mỗi chức năng ở đặc tả YCTD-384 mục 3 / Khi làm trên điện thoại 390 và máy tính bảng 1024 điểm ảnh bằng cảm ứng / Thì hoàn thành được như trên máy tính (nhập, sửa, xóa, chọn nhiều, nhập Excel, xuất tệp) (Bắt buộc; CT-1812; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1213 | Cho bảng nhập theo ô / Khi nhập trên điện thoại theo học sinh hoặc theo cột / Thì dữ liệu gửi đi và kết quả ghi giống nhập theo bảng (Bắt buộc; CT-1813; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1214 | Cho thao tác kéo thả, chú thích khi trỏ chuột / Khi dùng cảm ứng / Thì có cách bấm tương đương, thông tin hiện được không cần trỏ chuột (Bắt buộc; CT-1814; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1215 | Cho trình duyệt đặt cỡ chữ 200% / Khi mở ứng dụng giáo viên, phụ huynh, học sinh / Thì không mất nội dung, không chồng chữ (Bắt buộc; CT-1815; YCTD-384) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1216 | Cho điện thoại có tai thỏ, thanh cử chỉ / Khi mở ở chế độ toàn màn hình (đã cài) / Thì thanh dưới, thanh đầu, thanh thao tác không bị che (Bắt buộc; CT-1816; YCTD-384) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1800 | P19-10 | Chụp ba khổ từng màn hình của lát, so với bản mẫu yctd-384; đo thanh cuộn ngang của trang | Đạt AC-1200 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1801 | P19-10 | Đo cỡ chữ, chiều cao phần tử tương tác ở ba khổ bằng tập lệnh trên trang | Đạt AC-1201 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1802 | P19-10 | Đo tương phản các cặp màu của biến PC-* | Đạt AC-1202 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1803 | P19-10 | Tìm mã màu viết cứng, lớp màu Tailwind, ghi đè biến ở mã đã sửa | Đạt AC-1203 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1804 | P19-10 | Chạy toàn bộ e2e hiện có sau mỗi lát | Đạt AC-1204 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1805 | P19-10 | Mở cổng quản trị ở 1024 và 390 điểm ảnh, đi tới một trang cấp ba qua dải biểu tượng, ngăn menu | Đạt AC-1205 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1806 | P19-09 | Mở từng chức năng cũ của ba ứng dụng ở 390 và 1366 điểm ảnh qua thanh dưới, thanh bên, "Tất cả" | Đạt AC-1206 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1807 | P19-10 | Giả lập đang tải, rỗng, lỗi 500, lỗi 403, ghi thành công cho màn hình của lát | Đạt AC-1207 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1808 | P19-10 | Đi hết một luồng chỉ bằng bàn phím | Đạt AC-1208 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1809 | P19-10 | Mở các lưới nhiều cột ở 390 điểm ảnh | Đạt AC-1209 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1810 | P19-10 | Đăng nhập lần lượt các vai trò có tài khoản thử, so nút hiện với trước lát | Đạt AC-1210 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1811 | P19-10 | Xem ngày trên màn hình đã làm lại | Đạt AC-1211 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1812 | P19-10 | Làm các thao tác của mục 3 đặc tả trên điện thoại, máy tính bảng giả lập cảm ứng | Đạt AC-1212 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1813 | P19-10 | Nhập điểm theo học sinh, theo cột ở 390 điểm ảnh và theo bảng ở 1366; so dữ liệu gửi | Đạt AC-1213 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1814 | P19-10 | Dùng cảm ứng ở Sơ đồ chỗ ngồi, Truy cập nhanh, Chấm công | Đạt AC-1214 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1815 | P19-09 | Đặt cỡ chữ trình duyệt 200%, mở ba ứng dụng | Đạt AC-1215 | | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1816 | P19-09 | Giả lập vùng an toàn trên điện thoại có tai thỏ ở chế độ đã cài | Đạt AC-1216 | | Chưa chạy |
