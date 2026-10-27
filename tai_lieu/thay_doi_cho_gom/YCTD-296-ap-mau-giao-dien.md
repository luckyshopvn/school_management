---
yctd: YCTD-296
tieu_de: Áp sáu màn mẫu giao diện đã duyệt vào cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh
ngay: 2026-10-28
phien_ban_de_xuat: 0.174.0
---

## 02 Nhật ký

### 2026-10-28 — Áp sáu màn mẫu giao diện đã duyệt

#### Công việc đã thực hiện

- Học sinh (`/children`, `ChildrenPage`): dòng tiêu đề có số học sinh theo bộ lọc và nút "Nhập từ Excel" (sang `/student-imports`, theo quyền nhập), "Thêm mới" chuyển lên dòng tiêu đề; thẻ trạng thái (Tất cả và các trạng thái hồ sơ) đồng bộ với ô "Trạng thái" ở "Mở rộng tìm kiếm"; thẻ và lưới chung một khung trắng; cột họ tên có ảnh đại diện chữ cái đầu.
- Sổ điểm (`/scores`, `ScoresPage`): dòng mô tả lớp, học kỳ, Thông tư 22/2021; bộ lọc trong khung trắng; thẻ dạng gạch chân; nhóm cột "Đánh giá thường xuyên" trên TX1..n, Giữa kỳ, Cuối kỳ, "TB môn HK", Nhận xét; nhãn tiến độ nhập theo bản nháp; ô bắt buộc chưa nhập viền cam; ghi chú công thức lấy từ hệ số cấu hình.
- Thời khoá biểu (`/timetables`, `TimetablesPage`): dòng tóm tắt phiên bản, ngày áp dụng, đối tượng đang xem, số tiết mỗi tuần; "Xem theo" thành thẻ chọn Theo lớp, Theo giáo viên, Theo phòng; nhãn số xung đột phải sửa; lưới có dải "Buổi chiều", mỗi tiết là khối màu theo môn (`lesson-tone.ts`); liên kết "Xếp tự động" theo quyền quản lý thời khoá biểu. Lưới chỉ xem dùng chung với bản xem trước ở trang xếp tự động.
- Đăng nhập (`/login`, `LoginPage`, `LoginHero`): bố cục hai cột, cột trái nền xanh có biểu trưng, tên trường màu vàng, dòng giới thiệu và ba nhãn ứng dụng; cột phải là thẻ đăng nhập; trên điện thoại hai cột xếp chồng.
- Ứng dụng giáo viên, điểm danh (`AttendanceScreen`): thanh đầu xanh có tên lớp, ngày và ba bộ đếm (Có mặt, Nghỉ có báo, Nghỉ không báo); chạm vào dòng đổi lần lượt Có mặt, Nghỉ có báo, Nghỉ không báo; nút lưu, chốt ngày ở thanh dưới cố định.
- Ứng dụng phụ huynh, trang chủ (`HomeScreen`): đầu trang xanh "Xin chào," và tên phụ huynh; thẻ của con chồng lên đầu trang, có ảnh chữ cái đầu và trạng thái điểm danh hôm nay (lấy từ điểm danh tháng, không có thì không hiện); lưới bốn lối tắt Báo vắng, Thời khoá biểu, Thực đơn, Học phí thay cho các nút cũ cùng tên.

#### Quyết định

- Chỉ đổi phần trình bày, giữ nguyên dữ liệu, truy vấn, quyền, hộp thoại, nhãn và mã kiểm thử mà kiểm thử giao diện dùng ("Lưu điểm danh", "Ban hành", "Ghi nhớ tài khoản", "Xin chào, …", "Ghi điểm").
- Phần mẫu không có dữ liệu hay chức năng phía sau thì bỏ, không tự thêm: nút "Đồng bộ CSDL ngành", cột Phụ huynh, Chuyên cần ở danh sách học sinh; "Nhập từ Excel", "In sổ" ở sổ điểm; "Xuất Excel" ở thời khoá biểu; tiết, môn ở thanh đầu điểm danh; thẻ điểm mới, khoản cần nộp, nút "Đổi con", thanh điều hướng dưới ở trang chủ phụ huynh.
- Dùng màu của `packages/ui/src/theme.css`, không ghi mã màu trong mã; liên kết mới cao tối thiểu 44 px dưới 1280 px.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-296, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chưa chạy kiểm thử giao diện trên máy; chờ CI.

## 24 Yêu cầu thay đổi

### YCTD-296: Áp sáu màn mẫu giao diện đã duyệt vào cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh – 2026-10-28

- Lý do: Eric yêu cầu áp các mẫu giao diện đã duyệt trên canvas thiết kế vào mã; trang chủ cổng quản trị đã áp ở YCTD-295, còn sáu màn.
- Nội dung thay đổi: giao diện danh sách học sinh, sổ điểm, thời khoá biểu, đăng nhập cổng quản trị; điểm danh của ứng dụng giáo viên; trang chủ ứng dụng phụ huynh.
- Thành phần bị ảnh hưởng: `apps/portal/src/children/ChildrenPage.tsx`, `apps/portal/src/scores/ScoresPage.tsx`, `apps/portal/src/timetables/TimetablesPage.tsx`, `apps/portal/src/timetables/lesson-tone.ts`, `apps/portal/src/pages/LoginPage.tsx`, `apps/portal/src/pages/LoginHero.tsx`, `apps/teacher/src/screens/AttendanceScreen.tsx`, `apps/parent/src/screens/HomeScreen.tsx`.
- Dữ liệu, API, quyền bị ảnh hưởng: không; trang chủ phụ huynh gọi thêm API điểm danh tháng đã có để hiện trạng thái hôm nay.
- Ảnh hưởng chức năng cũ: không đổi hành vi; các nút "Báo vắng", "Thời khoá biểu", "Thực đơn", "Học phí" ở trang chủ phụ huynh chuyển thành lưới lối tắt, giữ tên và điều kiện hiện.
- Kiểm thử cần thực hiện: kiểm kiểu cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh; kiểm thử giao diện đăng nhập, học sinh, sổ điểm, thời khoá biểu, điểm danh, trang chủ phụ huynh; kiểm thử theo khổ thiết bị.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: áp sáu màn mẫu giao diện đã duyệt (YCTD-296): danh sách học sinh, sổ điểm, thời khoá biểu, đăng nhập cổng quản trị, điểm danh ứng dụng giáo viên, trang chủ ứng dụng phụ huynh.
- Không đổi dữ liệu, API, quyền.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Áp sáu màn mẫu giao diện đã duyệt | YCTD-296 |
