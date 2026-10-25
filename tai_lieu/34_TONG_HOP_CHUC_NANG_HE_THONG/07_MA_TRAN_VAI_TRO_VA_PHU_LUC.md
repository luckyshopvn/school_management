# 34.7. MA TRẬN VAI TRÒ × PHÂN HỆ VÀ PHỤ LỤC

- Mô tả: Ma trận vai trò × phân hệ theo quyền mặc định, bảng tra nhanh 278 mục menu, các chỗ lệch giữa tài liệu và mã, thuật ngữ
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-25
- Trạng thái: Chờ phê duyệt
- Thuộc: [Tài liệu 34, tổng hợp chức năng hệ thống](00_MUC_LUC.md)
- Nguồn: mã và tài liệu trên nhánh `main` ngày 2026-10-25 (sau PR 165, 166, 167, 169). Khi tài liệu và mã lệch nhau, mô tả theo mã; chỗ lệch ghi ở [phụ lục](07_MA_TRAN_VAI_TRO_VA_PHU_LUC.md)

## 1. Ma trận vai trò × phân hệ

**Nguồn và cách dựng**: chạy lại toàn bộ 73 tệp migration định danh (`database/identity/migrations`, từ 0001 đến 0093) bằng Kysely với trình điều khiển giả để thu các câu `insert into role_permissions`, được tập quyền mặc định của từng vai trò; áp `MENU_PERMISSION_RULES` (`packages/shared/src/menu-permissions.ts`) cho từng mục lá của 21 phân hệ (`portal-menu.ts`, tính trên cây đầy đủ mọi cấp); áp `role_workspace_exclusions` seed (VT-14 bỏ 11 phân hệ). Đây là **quyền mặc định khi khởi tạo trường**; quản trị trường (VT-01, VT-02) chỉnh được ở 1.2 và 1.3, nên dữ liệu thật của từng trường có thể khác.

Ký hiệu: **Đ** thấy mọi mục có điều kiện quyền của phân hệ và có quyền thao tác ghi; **M** thấy một phần mục, có quyền ghi ở ít nhất một mục; **X** chỉ thấy mục bằng quyền xem (`.view`, `.search`, báo cáo); **-** không thấy mục nào có điều kiện quyền. Số sau ký hiệu là số mục thấy trên số mục có điều kiện quyền.

Lưu ý đọc bảng:

1. 12 mục không có điều kiện quyền hiện với mọi tài khoản vào cổng (1.4). Vì vậy mọi cán bộ đều thấy phân hệ **personnel** (Chấm công, Đơn nghỉ phép, Quy định phép năm, Ngày lễ, Phiếu lương của tôi, Công việc, Đánh giá nhân sự), **professional-records** (Việc của tôi), **reports** (Báo cáo và bảng điều khiển) và mục 3.2 Đánh giá chuẩn nghề nghiệp, 2.1 Năm học, 2.2 Cây đơn vị. Dữ liệu trong các trang này do máy chủ lọc theo quyền.
2. Cột **reports** không có mục có điều kiện; ô ghi theo quyền P17: Đ khi có quyền sửa, duyệt và cấu hình biểu (`P17.edit`, `P17.report-form.manage`), X khi chỉ có quyền xem báo cáo.
3. Cột **teaching** chỉ hiện với người có `P03.lesson-plan.review`, `P03.curriculum.manage` hoặc `P03.lesson.manage`; Ban Giám hiệu chỉ có `P03.view`, `P03.approve` nên không thấy mục này theo mặc định.
4. Đăng nhập không chặn kênh theo vai trò: mọi tài khoản có thể đăng nhập ứng dụng nào cũng được, nhưng chức năng hiện theo lớp được phân công và quyền. Cột hai ứng dụng ghi theo thiết kế và dữ liệu thấy được.

| Vai trò | education | facilities | entry-admissions | emis | signing | documents | system | finance | personnel | logistics | interaction | teaching | admissions | reports | kpi | website | professional-records | emulation | quality-assurance | library | learning-resources | Ứng dụng giáo viên | Ứng dụng phụ huynh |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VT-01 Quản trị nền tảng | M 1/75 | - | - | - | - | - | M 8/18 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| VT-02 Hiệu trưởng | M 71/75 | Đ 8/8 | Đ 15/15 | Đ 8/8 | Đ 4/4 | Đ 32/32 | Đ 18/18 | Đ 15/15 | Đ 5/5 | Đ 7/7 | Đ 2/2 | - 0/1 | M 1/2 | Đ | Đ 13/13 | Đ 9/9 | Đ 19/19 | Đ 11/11 | Đ 5/5 | Đ 7/7 | Đ 10/10 | M | - |
| VT-15 Phó Hiệu trưởng | M 65/75 | Đ 8/8 | M 13/15 | Đ 8/8 | Đ 4/4 | M 27/32 | X 5/18 | M 14/15 | Đ 5/5 | Đ 7/7 | Đ 2/2 | - 0/1 | M 1/2 | Đ | M 9/13 | M 7/9 | Đ 19/19 | Đ 11/11 | Đ 5/5 | Đ 7/7 | Đ 10/10 | M | - |
| VT-03 Quản lý đơn vị | M 56/75 | Đ 8/8 | X 15/15 | - | - | M 19/32 | M 9/18 | M 12/15 | M 1/5 | M 6/7 | Đ 2/2 | Đ 1/1 | Đ 2/2 | X | M 7/13 | M 6/9 | M 10/19 | M 7/11 | Đ 5/5 | Đ 7/7 | M 6/10 | M | - |
| VT-04 Kế toán | M 22/75 | - | - | - | - | M 13/32 | M 1/18 | M 13/15 | Đ 5/5 | M 5/7 | - | - | - | X | M 4/13 | - | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | M | - |
| VT-05 Kế toán trưởng | X 16/75 | - | - | - | - | M 11/32 | - | M 13/15 | Đ 5/5 | M 2/7 | - | - | - | X | M 4/13 | - | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | M | - |
| VT-06 Nhân sự | M 26/75 | - | - | - | - | Đ 32/32 | M 2/18 | - | Đ 5/5 | M 1/7 | - | - | M 1/2 | X | M 9/13 | - | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | M | - |
| VT-07 Giáo viên chủ nhiệm | M 25/75 | M 1/8 | - | - | - | M 11/32 | - | X 3/15 | - | M 1/7 | Đ 2/2 | Đ 1/1 | - | X | M 4/13 | - | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | Đ | - |
| VT-08 Giáo viên bộ môn | M 22/75 | M 1/8 | - | - | - | M 11/32 | - | - | - | M 1/7 | - | Đ 1/1 | - | X | M 4/13 | - | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | M | - |
| VT-09 Nhân viên y tế | M 17/75 | - | - | - | - | M 11/32 | - | - | - | M 6/7 | - | - | - | X | M 4/13 | - | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | M | - |
| VT-10 Nhân viên bếp | M 14/75 | - | - | - | - | M 11/32 | - | - | - | M 6/7 | - | - | - | X | M 4/13 | - | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | M | - |
| VT-11 Nhân viên kho và mua hàng | M 14/75 | Đ 8/8 | - | - | - | M 11/32 | - | - | - | M 2/7 | - | - | - | X | M 4/13 | - | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | M | - |
| VT-12 Nhân viên tuyển sinh | M 20/75 | - | M 13/15 | - | - | M 11/32 | - | X 3/15 | - | M 1/7 | - | - | M 1/2 | X | M 4/13 | M 6/9 | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | M | - |
| VT-14 Phụ huynh | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Đ |
| VT-16 Thủ quỹ | - | - | - | - | - | M 11/32 | - | M 11/15 | - | M 1/7 | - | - | - | X | M 4/13 | - | M 10/19 | M 7/11 | Đ 5/5 | X 1/7 | M 6/10 | M | - |
| VT-17 Tổ trưởng chuyên môn | M 18/75 | - | - | - | - | M 11/32 | - | - | - | M 1/7 | - | Đ 1/1 | - | X | M 7/13 | - | M 14/19 | M 7/11 | Đ 5/5 | X 1/7 | M 8/10 | M | - |
| VT-18 Bảo vệ | X 12/75 | - | - | - | - | - | - | - | - | M 1/7 | - | - | - | - | M 4/13 | - | - | - | - | - | - | M | - |
| VT-19 Cán bộ quản lý cấp trên | - | - | - | - | - | - | - | - | - | - | - | - | - | X | - | - | - | - | - | - | - | - | - |
| VT-20 Kiểm toán viên | - | - | - | - | - | - | - | X 11/15 | X 4/5 | - | - | - | - | X | - | - | - | - | - | - | - | - | - |

Ghi chú theo vai trò:

- **VT-01** chỉ có 3 quyền: `P01.account.manage`, `P01.announcement.manage`, `P01.feedback.manage`. Thấy 1.1 đến 1.4, 3.4, 3.6, 3.7, 4.3 của Quản trị hệ thống và 5.4 Mã định danh, mật khẩu mặc định. Không xem dữ liệu nghiệp vụ (PQ-10), không đăng nhập thay, không xuất toàn bộ dữ liệu.
- **VT-02** là vai trò duy nhất có `P01.school-level.manage`, `P01.account.impersonate`, `P01.data.export-all`, `P01.api-client.manage`, `P01.integration.manage`, `P01.academic-year.manage`. Theo mặc định VT-02 không thấy 6 mục do thiếu quyền thao tác riêng của bộ phận: 3.1.3 Nhập nhân sự từ Excel (`P01.import.staff` của VT-06), 4.1.13 Nhập dữ liệu khác từ Excel (`P05.opening-debt.import`), 4.5 Thực đơn bữa ăn (quyền bếp), 4.6.2 Y tế học đường (quyền y tế), Giảng dạy 1. Bài học và giáo án, Tuyển sinh 1. Tuyển sinh.
- **VT-15** ở Quản trị hệ thống chỉ thấy 2.3 đến 2.6 và 3.3 Nhật ký thao tác ở chế độ xem (nhờ `P01.view`; quyền `P01.edit` của ma trận gốc không dùng ở điểm cuối nào), cùng 2.1, 2.2 không điều kiện; không thấy nhóm 1, nhóm 4, các mục 3.1, 3.2, 3.4 đến 3.7. Ngoài ra không thấy 3.2 Chốt kỳ tài chính, 1.1 đến 1.4 thiết lập KPI, 1.1, 1.2 thiết lập website, quản trị văn bản 2.2 đến 2.5.
- **VT-06** trong mã giữ quyền văn thư: quản trị văn bản (`P09.incoming-document.admin`), đăng ký văn bản đến, ban hành văn bản đi, nên thấy đủ 32 mục phân hệ Văn bản và điều hành.
- **VT-14** có 12 quyền gốc của ma trận (xem học sinh, điểm danh, học phí, y tế, bếp, hoạt động, tương tác, kênh) dùng ở ứng dụng phụ huynh; ở cổng quản trị bị bỏ 11 phân hệ và không có quyền chi tiết của các phân hệ mới nên không thấy gì.
- **VT-18** thấy các mục lớp, học sinh, điểm danh ở chế độ xem nhờ `P02.view`, và ở ứng dụng giáo viên có nút "Xác nhận người đón tại cổng" (`P04.pickup.gate-confirm`, chỉ VT-18).
- **VT-19** chỉ có `P17.view`, `P17.report.consolidated`, `P19.view`: chỉ xem báo cáo tổng hợp.
- **VT-20** có `P05.view`, `P06.view`, `P06.ledger.view`, `P08.view`, `P08.payroll.view`, `P17.view`, `P19.view`: chỉ xem học phí, thu chi, sổ kế toán, bảng lương trong thời hạn tài khoản.

Ứng dụng giáo viên theo vai trò (đọc `apps/teacher/src/screens/ClassesScreen.tsx`):

- Mọi tài khoản cán bộ: thông báo, thẻ chấm công kèm Nghỉ phép, Phiếu lương, Công việc; "Sách tôi đang mượn"; "Bồi dưỡng của tôi" khi có `P09.training.use` (mọi vai trò cán bộ trừ VT-01, VT-18, VT-19, VT-20); "Kiểm kê thiết bị" khi có `P13.equipment.stocktake` (VT-02, VT-03, VT-07, VT-08, VT-11, VT-15).
- Có lớp được phân công (`GET /classes?mine=true`): mỗi lớp có Điểm danh, Đón trả, Nhật ký, Chăm sóc và y tế, Trao đổi và đồ bị mất, Hoạt động và hình ảnh, Báo cơm, Sổ điểm, Đánh giá học sinh, Bán trú, Dặn thuốc, Giảng dạy, hiện theo cấp của lớp; "Lịch dạy của tôi", "Sổ đầu bài" khi có lớp cấp phổ thông. Máy chủ chặn thao tác ngoài quyền (ví dụ báo cơm chỉ `P12.meal-report.submit` của VT-07; nhận và ghi liều thuốc chỉ `P10.medication.administer` của VT-07, VT-09).
- VT-18: nút xác nhận người đón tại cổng cho các đơn vị được gán.

## 2. Phụ lục A. Bảng tra nhanh chức năng

Toàn bộ 278 mục lá của 21 phân hệ trên cổng quản trị, sinh từ `PORTAL_WORKSPACES` (`packages/shared/src/portal-menu.ts`). Cột Cấp học lấy thuộc tính `levels` gần nhất của mục, nhóm hoặc phân hệ; "Mọi cấp" là không giới hạn. Mô tả chi tiết từng mục xem tệp của phân hệ ở [mục lục](00_MUC_LUC.md).

| Phân hệ | Số | Mục | Đường dẫn | Cấp học |
|---|---|---|---|---|
| 2.1 Quản lý giáo dục | 1.1. | Trường học › Hồ sơ trường | `/school-profile` | Mọi cấp |
| 2.1 Quản lý giáo dục | 1.2. | Trường học › Quản lý phân hiệu | `/branches` | Mọi cấp |
| 2.1 Quản lý giáo dục | 1.3. | Trường học › Quản lý điểm trường | `/school-sites` | Mọi cấp |
| 2.1 Quản lý giáo dục | 1.4. | Trường học › Cấu hình trường | `/settings` | Mọi cấp |
| 2.1 Quản lý giáo dục | 1.6. | Trường học › Tài khoản đồng bộ của Bộ, của Sở | `/sync-accounts` | Mọi cấp |
| 2.1 Quản lý giáo dục | 1.7. | Trường học › Rà soát thông tin kiểm định CLGD | `/accreditation-review` | Mọi cấp |
| 2.1 Quản lý giáo dục | 1.8. | Trường học › Tách trường | `/school-splits` | Mọi cấp |
| 2.1 Quản lý giáo dục | 2.1. | Lớp học › Hồ sơ lớp học | `/classes` | Mọi cấp |
| 2.1 Quản lý giáo dục | 2.2. | Lớp học › Nhập lớp học từ Excel | `/class-imports` | Mọi cấp |
| 2.1 Quản lý giáo dục | 3.1.1. | Nhân sự › Hồ sơ nhân sự › Hồ sơ cán bộ, giáo viên | `/staff` | Mọi cấp |
| 2.1 Quản lý giáo dục | 3.1.2. | Nhân sự › Hồ sơ nhân sự › Nhân sự phân hiệu | `/staff-branches` | Mọi cấp |
| 2.1 Quản lý giáo dục | 3.1.3. | Nhân sự › Hồ sơ nhân sự › Nhập nhân sự từ Excel | `/staff-imports` | Mọi cấp |
| 2.1 Quản lý giáo dục | 3.1.5. | Nhân sự › Hồ sơ nhân sự › Xác thực số định danh nhân sự với CSDLQG về dân cư | `/staff-identity` | Mọi cấp |
| 2.1 Quản lý giáo dục | 3.2. | Nhân sự › Đánh giá chuẩn nghề nghiệp | `/professional-standards` | Mọi cấp |
| 2.1 Quản lý giáo dục | 3.3. | Nhân sự › Phân công phụ trách lớp | `/class-assignments` | Mọi cấp |
| 2.1 Quản lý giáo dục | 3.4. | Nhân sự › Khai báo tuần | `/school-weeks` | Mọi cấp |
| 2.1 Quản lý giáo dục | 3.5. | Nhân sự › Biến động nhân sự | `/staff-movements` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.1.1. | Học sinh › Hồ sơ học sinh › Quản lý hồ sơ học sinh | `/children` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.1.2. | Học sinh › Hồ sơ học sinh › Nhập học sinh từ Excel | `/student-imports` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.1.3. | Học sinh › Hồ sơ học sinh › Sắp xếp học sinh | `/student-order` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.1.5. | Học sinh › Hồ sơ học sinh › Điện thoại nhận tin của phụ huynh | `/sms-phones` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.1.6. | Học sinh › Hồ sơ học sinh › Nhóm học sinh | `/child-groups` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.1.8. | Học sinh › Hồ sơ học sinh › Thu thập, xác thực số định danh | `/national-ids` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.1.10. | Học sinh › Hồ sơ học sinh › Tài khoản học và thi | `/learning-accounts` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.1.11. | Học sinh › Hồ sơ học sinh › Cập nhật địa danh hành chính | `/administrative-units` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.1.13. | Học sinh › Hồ sơ học sinh › Nhập dữ liệu khác từ Excel | `/imports` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.2. | Học sinh › Biến động học sinh | `/student-movements` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.3.1. | Học sinh › Cân nặng, chiều cao › Nhập kết quả sức khỏe nuôi dưỡng | `/growth` | MN |
| 2.1 Quản lý giáo dục | 4.3.2. | Học sinh › Cân nặng, chiều cao › Tổng hợp cân nặng, chiều cao | `/growth-report` | MN |
| 2.1 Quản lý giáo dục | 4.4. | Học sinh › Hoàn thành chương trình | `/program-completion` | MN |
| 2.1 Quản lý giáo dục | 4.5. | Học sinh › Thực đơn bữa ăn | `/kitchen` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.6.1. | Học sinh › Sức khỏe học sinh › Nhập thông tin sức khỏe học sinh | `/student-health` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.6.2. | Học sinh › Sức khỏe học sinh › Y tế học đường | `/health` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.6.3. | Học sinh › Sức khỏe học sinh › Thuốc và dặn thuốc | `/medicines` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.7. | Học sinh › Điểm danh | `/attendance` | Mọi cấp |
| 2.1 Quản lý giáo dục | 4.8. | Học sinh › Bán trú | `/boarding` | TH |
| 2.1 Quản lý giáo dục | 4.9. | Học sinh › Nề nếp, thi đua lớp | `/conduct` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 5.1. | Công cụ hỗ trợ › Thống kê lớp, nhân sự, học sinh | `/statistics` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.2. | Công cụ hỗ trợ › Thống kê nhân sự | `/staff-statistics` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.3. | Công cụ hỗ trợ › Thống kê học sinh | `/student-statistics` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.4. | Công cụ hỗ trợ › Mã định danh, mật khẩu mặc định | `/default-passwords` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.5. | Công cụ hỗ trợ › Tiến độ xác thực số định danh học sinh | `/national-id-progress` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.6. | Công cụ hỗ trợ › Tiến độ xác thực số định danh nhân sự | `/staff-identity-progress` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.7. | Công cụ hỗ trợ › Chuyển hồ sơ lên năm học mới | `/year-rollover` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.8. | Công cụ hỗ trợ › Thống kê hồ sơ chưa nhập đủ | `/missing-profiles` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.10.1. | Công cụ hỗ trợ › Văn thư lưu trữ › Hồ sơ tài liệu | `/archive-records` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.10.2. | Công cụ hỗ trợ › Văn thư lưu trữ › Phông lưu trữ | `/archive-fonds` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.10.3. | Công cụ hỗ trợ › Văn thư lưu trữ › Thông tin lưu trữ | `/archive-holdings` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.10.4. | Công cụ hỗ trợ › Văn thư lưu trữ › Báo cáo lưu trữ | `/archive-report` | Mọi cấp |
| 2.1 Quản lý giáo dục | 5.11. | Công cụ hỗ trợ › Danh sách trúng tuyển Tuyển sinh đầu cấp | `/admitted-students` | Mọi cấp |
| 2.1 Quản lý giáo dục | 6.1. | Cơ sở vật chất › Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ | `/facility-investments` | Mọi cấp |
| 2.1 Quản lý giáo dục | 6.2. | Cơ sở vật chất › Nhập liệu cơ sở vật chất | `/facility-input` | Mọi cấp |
| 2.1 Quản lý giáo dục | 7.1. | Dạy học › Môn học và hoạt động giáo dục | `/subjects` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.2. | Dạy học › Phân công giảng dạy theo môn | `/teaching-assignments` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.3. | Dạy học › Khung giờ tiết học | `/period-slots` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.4. | Dạy học › Thời khoá biểu | `/timetables` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.5. | Dạy học › Đánh giá học sinh | `/student-assessments` | TH |
| 2.1 Quản lý giáo dục | 7.6. | Dạy học › Sổ đầu bài | `/class-logs` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.7. | Dạy học › Chuyên cần theo tiết | `/period-attendance` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.8. | Dạy học › Học bạ, khen thưởng, lên lớp | `/learning-records` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.9. | Dạy học › Xếp thời khoá biểu tự động | `/timetable-generator` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.10. | Dạy học › Dạy thay, đổi tiết | `/timetable-changes` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.11. | Dạy học › Báo cáo tiết dạy, dùng phòng, mã QR | `/timetable-reports` | TH, THCS, THPT |
| 2.1 Quản lý giáo dục | 7.12. | Dạy học › Tổ hợp môn | `/subject-combinations` | THPT |
| 2.1 Quản lý giáo dục | 7.13. | Dạy học › Tổ bộ môn | `/subject-teams` | THCS, THPT |
| 2.1 Quản lý giáo dục | 7.14. | Dạy học › Sổ điểm | `/scores` | THCS, THPT |
| 2.1 Quản lý giáo dục | 7.17. | Dạy học › Xét tốt nghiệp, hồ sơ thi | `/graduation` | THCS, THPT |
| 2.1 Quản lý giáo dục | 7.15. | Dạy học › Báo cáo, thống kê, EMIS Tiểu học | `/primary-reports` | TH |
| 2.1 Quản lý giáo dục | 7.16. | Dạy học › Sơ đồ chỗ ngồi | `/seating-charts` | THCS, THPT |
| 2.1 Quản lý giáo dục | 7.18. | Dạy học › Báo cáo, thống kê, EMIS THCS, THPT | `/secondary-reports` | THCS, THPT |
| 2.1 Quản lý giáo dục | 8.1. | Kiểm tra, đánh giá › Ngân hàng câu hỏi | `/question-bank` | THCS, THPT |
| 2.1 Quản lý giáo dục | 8.2. | Kiểm tra, đánh giá › Ma trận đề | `/exam-matrices` | THCS, THPT |
| 2.1 Quản lý giáo dục | 8.3. | Kiểm tra, đánh giá › Kế hoạch kiểm tra | `/assessment-plans` | THCS, THPT |
| 2.1 Quản lý giáo dục | 8.4. | Kiểm tra, đánh giá › Đề kiểm tra | `/exams` | THCS, THPT |
| 2.1 Quản lý giáo dục | 8.5. | Kiểm tra, đánh giá › Chấm bài kiểm tra | `/exam-grading` | THCS, THPT |
| 2.1 Quản lý giáo dục | 8.6. | Kiểm tra, đánh giá › Báo cáo kết quả kiểm tra | `/exam-reports` | THCS, THPT |
| 2.2 Quản lý cơ sở vật chất, TBDH | 1.1. | Cơ sở vật chất › Khai báo cơ sở vật chất | `/facility-rooms` | Mọi cấp |
| 2.2 Quản lý cơ sở vật chất, TBDH | 1.2. | Cơ sở vật chất › Báo cáo cơ sở vật chất | `/facility-report` | Mọi cấp |
| 2.2 Quản lý cơ sở vật chất, TBDH | 2.1. | Thiết bị dạy học › Tổng hợp thiết bị dạy học | `/equipment` | Mọi cấp |
| 2.2 Quản lý cơ sở vật chất, TBDH | 2.2. | Thiết bị dạy học › Thiết bị ngoài danh mục tối thiểu | `/equipment-outside` | Mọi cấp |
| 2.2 Quản lý cơ sở vật chất, TBDH | 2.3. | Thiết bị dạy học › Gửi thiết bị dạy học lên cấp trên | `/equipment-submission` | Mọi cấp |
| 2.2 Quản lý cơ sở vật chất, TBDH | 2.4. | Thiết bị dạy học › Nơi để và tem QR thiết bị | `/equipment-locations` | Mọi cấp |
| 2.2 Quản lý cơ sở vật chất, TBDH | 2.5. | Thiết bị dạy học › Kiểm kê thiết bị | `/equipment-stocktakes` | Mọi cấp |
| 2.2 Quản lý cơ sở vật chất, TBDH | 2.6. | Thiết bị dạy học › Đối sánh danh mục tối thiểu | `/equipment-minimum` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 1.1. | Hồ sơ tuyển sinh › Hồ sơ học sinh cuối cấp mầm non | `/entry-admissions/final-year` | MN |
| 2.3 Tuyển sinh đầu cấp | 1.2. | Hồ sơ tuyển sinh › Gửi xác nhận hoàn thành hồ sơ cuối cấp lên cấp trên | `/entry-admissions/completion` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 1.3. | Hồ sơ tuyển sinh › Danh sách học sinh đăng ký trường tiên tiến | `/entry-admissions/advanced` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 1.4. | Hồ sơ tuyển sinh › Tiếp nhận hồ sơ tuyển sinh | `/entry-admissions/intake` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 1.5. | Hồ sơ tuyển sinh › Gửi thông báo tuyển sinh đầu cấp | `/entry-admissions/notices` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 1.6. | Hồ sơ tuyển sinh › Chuyển hồ sơ trúng tuyển sang CSDL | `/entry-admissions/transfer` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 1.7. | Hồ sơ tuyển sinh › Danh sách kết quả chuyển hồ sơ | `/entry-admissions/transfer-results` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 1.8. | Hồ sơ tuyển sinh › Thông tin trường tuyển sinh theo bản đồ GIS | `/entry-admissions/school-map` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 2.1. | Danh mục › Các dịch vụ được đăng ký tại trường | `/entry-admissions/services` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 3.1. | Người dùng › Nhóm người dùng | `/entry-admissions/roles` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 3.2. | Người dùng › Danh sách người dùng | `/entry-admissions/users` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 3.3. | Người dùng › Danh sách nhân sự | `/entry-admissions/staff` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 3.4. | Người dùng › Danh sách lớp | `/entry-admissions/classes` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 4.1. | Thống kê › Thống kê hồ sơ cuối cấp | `/entry-admissions/statistics` | Mọi cấp |
| 2.3 Tuyển sinh đầu cấp | 5.1. | Hỗ trợ › Danh sách hỗ trợ tuyển sinh | `/entry-admissions/support` | Mọi cấp |
| 2.4 Báo cáo số liệu | 1.1.1. | Báo cáo đầu năm › Báo cáo EMIS đầu năm › Lập báo cáo đầu năm | `/emis` | MN |
| 2.4 Báo cáo số liệu | 1.1.2. | Báo cáo đầu năm › Báo cáo EMIS đầu năm › Gửi báo cáo đầu năm | `/emis/send` | MN |
| 2.4 Báo cáo số liệu | 1.2. | Báo cáo đầu năm › Báo cáo cơ sở vật chất | `/emis/facilities` | Mọi cấp |
| 2.4 Báo cáo số liệu | 1.3. | Báo cáo đầu năm › Báo cáo sức khỏe học sinh đầu năm | `/emis/health` | Mọi cấp |
| 2.4 Báo cáo số liệu | 2.1. | Báo cáo cuối năm › Báo cáo EMIS cuối năm | `/emis/end-of-year` | MN |
| 2.4 Báo cáo số liệu | 2.2. | Báo cáo cuối năm › Báo cáo đội ngũ | `/emis/staff` | Mọi cấp |
| 2.4 Báo cáo số liệu | 2.3. | Báo cáo cuối năm › Đề án ngoại ngữ | `/emis/foreign-language` | Mọi cấp |
| 2.4 Báo cáo số liệu | 2.4. | Báo cáo cuối năm › Báo cáo giáo dục mầm non cuối năm | `/emis/preschool-end-of-year` | MN |
| 2.5 Quản lý kí hồ sơ | 1.1. | Chứng thư số › Chứng thư số nhà trường | `/signing-certificate` | Mọi cấp |
| 2.5 Quản lý kí hồ sơ | 2.1. | Kí hồ sơ › Đồng bộ chứng thư số | `/signing-certificate-sync` | Mọi cấp |
| 2.5 Quản lý kí hồ sơ | 2.2. | Kí hồ sơ › Kí hồ sơ trường, lớp, nhân sự, học sinh | `/signing-dossiers` | Mọi cấp |
| 2.5 Quản lý kí hồ sơ | 2.3. | Kí hồ sơ › Xác nhận hoàn thành và gửi hồ sơ | `/signing-submissions` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 1.1. | Văn bản đến › Văn bản đến | `/incoming-documents` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 1.2. | Văn bản đến › Quản lý văn bản đến | `/incoming-documents/manage` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 1.3. | Văn bản đến › Văn bản xem để biết | `/incoming-documents/for-information` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 1.4. | Văn bản đến › Văn bản đánh dấu | `/incoming-documents/starred` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 1.5. | Văn bản đến › Văn bản theo dõi | `/incoming-documents/followed` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 1.6. | Văn bản đến › Tra cứu văn bản | `/incoming-documents/search` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 1.7. | Văn bản đến › Liên thông văn bản | `/incoming-documents/interconnect` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 2.1. | Quản trị văn bản › Sổ văn bản | `/document-books` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 2.2. | Quản trị văn bản › Đơn vị bên ngoài | `/external-units` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 2.3. | Quản trị văn bản › Khai báo nhóm đơn vị ban hành | `/external-unit-groups` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 2.4. | Quản trị văn bản › Danh mục văn bản | `/document-catalogs` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 2.5. | Quản trị văn bản › Lãnh đạo nhận văn bản | `/document-leaders` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 3.1. | Văn bản đi › Văn bản đi | `/outgoing-documents` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 3.2. | Văn bản đi › Quản lý văn bản đi | `/outgoing-documents/manage` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 3.3. | Văn bản đi › Liên thông văn bản đi | `/outgoing-documents/interconnect` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 3.4. | Văn bản đi › Tra cứu văn bản đi | `/outgoing-documents/search` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 4.1. | Quản lý công việc › Giao việc | `/directives/new` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 4.2. | Quản lý công việc › Công việc cần xử lý | `/directives/inbox` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 4.3. | Quản lý công việc › Công việc đã giao | `/directives/outbox` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 5.1. | Hồ sơ công việc › Hồ sơ cá nhân | `/work-files` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 5.2. | Hồ sơ công việc › Hồ sơ được chia sẻ | `/work-files/shared` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 5.3. | Hồ sơ công việc › Hồ sơ được chuyển giao | `/work-files/transferred` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 5.4. | Hồ sơ công việc › Hồ sơ nộp lưu | `/work-files/archive` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 5.5. | Hồ sơ công việc › Hồ sơ hết hạn bảo quản | `/work-files/expired` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 6.1. | Quản lý lịch đơn vị › Đăng ký lịch đơn vị | `/unit-schedules` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 6.2. | Quản lý lịch đơn vị › Lịch họp | `/meeting-schedules` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 6.3. | Quản lý lịch đơn vị › Đăng ký phòng họp | `/room-bookings` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 6.4. | Quản lý lịch đơn vị › Phòng họp | `/meeting-rooms` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 6.5. | Quản lý lịch đơn vị › Mẫu lịch | `/schedule-templates` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 7.1. | Báo cáo › Báo cáo thực hiện văn bản đến | `/document-reports/incoming` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 7.2. | Báo cáo › Báo cáo tổng hợp | `/document-reports/summary` | Mọi cấp |
| 2.6 Quản lý văn bản và điều hành | 7.3. | Báo cáo › Thống kê số liệu trong đơn vị | `/document-reports/statistics` | Mọi cấp |
| 2.7 Quản trị hệ thống | 1.1. | Người dùng và phân quyền › Nhóm người dùng | `/roles` | Mọi cấp |
| 2.7 Quản trị hệ thống | 1.2. | Người dùng và phân quyền › Phân quyền nhóm theo phần mềm | `/role-workspaces` | Mọi cấp |
| 2.7 Quản trị hệ thống | 1.3. | Người dùng và phân quyền › Phân quyền nhóm theo menu | `/role-permissions` | Mọi cấp |
| 2.7 Quản trị hệ thống | 1.4. | Người dùng và phân quyền › Danh sách người dùng | `/accounts` | Mọi cấp |
| 2.7 Quản trị hệ thống | 2.1. | Thiết lập › Năm học | `/academic-years` | Mọi cấp |
| 2.7 Quản trị hệ thống | 2.2. | Thiết lập › Cây đơn vị | `/org-units` | Mọi cấp |
| 2.7 Quản trị hệ thống | 2.3. | Thiết lập › Phòng ban và chức danh | `/departments` | Mọi cấp |
| 2.7 Quản trị hệ thống | 2.4. | Thiết lập › Danh mục dùng chung | `/catalogs` | Mọi cấp |
| 2.7 Quản trị hệ thống | 2.5. | Thiết lập › Phòng học và bậc học | `/rooms` | Mọi cấp |
| 2.7 Quản trị hệ thống | 2.6. | Thiết lập › Hạn mức phê duyệt | `/approval-thresholds` | Mọi cấp |
| 2.7 Quản trị hệ thống | 3.1. | Kết nối và nhật ký › Khóa API cho đối tác | `/api-clients` | Mọi cấp |
| 2.7 Quản trị hệ thống | 3.2. | Kết nối và nhật ký › Kết nối ngoài | `/integrations` | Mọi cấp |
| 2.7 Quản trị hệ thống | 3.3. | Kết nối và nhật ký › Nhật ký thao tác | `/audit-logs` | Mọi cấp |
| 2.7 Quản trị hệ thống | 3.4. | Kết nối và nhật ký › Ý kiến phản hồi | `/feedback` | Mọi cấp |
| 2.7 Quản trị hệ thống | 3.5. | Kết nối và nhật ký › Tệp đã tạo | `/generated-files` | Mọi cấp |
| 2.7 Quản trị hệ thống | 3.6. | Kết nối và nhật ký › Thông báo hệ thống | `/system-announcements` | Mọi cấp |
| 2.7 Quản trị hệ thống | 3.7. | Kết nối và nhật ký › Ứng dụng liên kết | `/app-links` | Mọi cấp |
| 2.7 Quản trị hệ thống | 4.1. | Quản trị và trình diễn › Đăng nhập thay | `/impersonations` | Mọi cấp |
| 2.7 Quản trị hệ thống | 4.2. | Quản trị và trình diễn › Xuất toàn bộ dữ liệu | `/school-data-export` | Mọi cấp |
| 2.7 Quản trị hệ thống | 4.3. | Quản trị và trình diễn › Bản trình diễn | `/demo-environment` | Mọi cấp |
| 2.8 Tài chính – học phí | 1.1. | Học phí và dịch vụ › Biểu phí và dịch vụ | `/fees` | Mọi cấp |
| 2.8 Tài chính – học phí | 1.2. | Học phí và dịch vụ › Đăng ký dịch vụ | `/registrations` | Mọi cấp |
| 2.8 Tài chính – học phí | 1.3. | Học phí và dịch vụ › Học phí | `/invoices` | Mọi cấp |
| 2.8 Tài chính – học phí | 1.4. | Học phí và dịch vụ › Duyệt miễn giảm và điều chỉnh | `/fee-approvals` | Mọi cấp |
| 2.8 Tài chính – học phí | 1.5. | Học phí và dịch vụ › Công nợ | `/debts` | Mọi cấp |
| 2.8 Tài chính – học phí | 1.6. | Học phí và dịch vụ › Nhắc nợ và xử lý quá hạn | `/debt-collection` | Mọi cấp |
| 2.8 Tài chính – học phí | 2.1. | Thu chi › Phiếu thu | `/receipts` | Mọi cấp |
| 2.8 Tài chính – học phí | 2.2. | Thu chi › Phiếu chi | `/payments` | Mọi cấp |
| 2.8 Tài chính – học phí | 2.3. | Thu chi › Quỹ và ngân hàng | `/cash-accounts` | Mọi cấp |
| 2.8 Tài chính – học phí | 2.4. | Thu chi › Sổ quỹ | `/cash-book` | Mọi cấp |
| 2.8 Tài chính – học phí | 2.5. | Thu chi › Đối chiếu ngân hàng | `/bank-reconciliation` | Mọi cấp |
| 2.8 Tài chính – học phí | 2.6. | Thu chi › Nợ nhà cung cấp | `/payables` | Mọi cấp |
| 2.8 Tài chính – học phí | 2.7. | Thu chi › Khoản mục thu chi | `/cashflow-categories` | Mọi cấp |
| 2.8 Tài chính – học phí | 3.1. | Kế toán › Sổ kế toán | `/ledger` | Mọi cấp |
| 2.8 Tài chính – học phí | 3.2. | Kế toán › Chốt kỳ tài chính | `/fiscal-periods` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 1.1. | Chấm công và nghỉ phép › Chấm công | `/staff-attendance` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 1.2. | Chấm công và nghỉ phép › Đơn nghỉ phép | `/leave-requests` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 1.3. | Chấm công và nghỉ phép › Quy định phép năm | `/leave-policies` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 1.4. | Chấm công và nghỉ phép › Ngày lễ và lịch bù | `/school-days` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 1.5. | Chấm công và nghỉ phép › Lịch công tác | `/work-schedules` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 2.1. | Lương › Bảng lương | `/payrolls` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 2.2. | Lương › Quyết toán và điều chỉnh lương | `/payroll-settlements` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 2.3. | Lương › Danh mục lương và biểu thuế | `/pay-items` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 2.4. | Lương › Thưởng và khấu trừ | `/bonus-deductions` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 2.5. | Lương › Phiếu lương của tôi | `/my-payslips` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 3.1. | Công việc và đánh giá › Công việc và kế hoạch | `/work` | Mọi cấp |
| 2.9 Nhân sự – chấm công, lương | 3.2. | Công việc và đánh giá › Đánh giá nhân sự | `/evaluations` | Mọi cấp |
| 2.10 Bếp – kho, mua hàng | 1. | Kho và tài sản | `/inventory` | Mọi cấp |
| 2.10 Bếp – kho, mua hàng | 2. | Đề nghị mua hàng | `/purchase-requests` | Mọi cấp |
| 2.10 Bếp – kho, mua hàng | 3.1. | Bán trú và an toàn thực phẩm › Kiểm thực ba bước | `/food-safety/inspections` | Mọi cấp |
| 2.10 Bếp – kho, mua hàng | 3.2. | Bán trú và an toàn thực phẩm › Lưu và hủy mẫu thức ăn | `/food-safety/samples` | Mọi cấp |
| 2.10 Bếp – kho, mua hàng | 3.3. | Bán trú và an toàn thực phẩm › Lô hàng nhập | `/food-safety/lots` | Mọi cấp |
| 2.10 Bếp – kho, mua hàng | 3.4. | Bán trú và an toàn thực phẩm › Hồ sơ an toàn thực phẩm của nhà cung cấp | `/food-safety/supplier-records` | Mọi cấp |
| 2.10 Bếp – kho, mua hàng | 3.5. | Bán trú và an toàn thực phẩm › Truy xuất nguồn gốc | `/food-safety/trace` | Mọi cấp |
| 2.11 Tương tác – truyền thông | 1. | Tương tác với phụ huynh | `/interactions` | Mọi cấp |
| 2.11 Tương tác – truyền thông | 2. | Hoạt động và tin tức | `/activities` | Mọi cấp |
| 2.12 Giảng dạy | 1. | Bài học và giáo án | `/teaching` | Mọi cấp |
| 2.13 Tuyển sinh, tuyển dụng | 1. | Tuyển sinh | `/admissions` | Mọi cấp |
| 2.13 Tuyển sinh, tuyển dụng | 2. | Tuyển dụng | `/recruitment` | Mọi cấp |
| 2.14 Báo cáo | 1. | Báo cáo và bảng điều khiển | `/reports` | Mọi cấp |
| 2.15 Đánh giá KPI | 1.1. | Thiết lập › Kỳ đánh giá | `/kpi/periods` | Mọi cấp |
| 2.15 Đánh giá KPI | 1.2. | Thiết lập › Bộ quy tắc chấm | `/kpi/rule-sets` | Mọi cấp |
| 2.15 Đánh giá KPI | 1.3. | Thiết lập › Đối tượng đánh giá | `/kpi/profiles` | Mọi cấp |
| 2.15 Đánh giá KPI | 1.4. | Thiết lập › Nhập dữ liệu từ hệ thống KPI cũ | `/kpi/legacy-import` | Mọi cấp |
| 2.15 Đánh giá KPI | 2.1. | Danh mục › Danh mục công việc chuẩn | `/kpi/catalog` | Mọi cấp |
| 2.15 Đánh giá KPI | 3.1. | Công việc › Việc của tôi | `/kpi/my-tasks` | Mọi cấp |
| 2.15 Đánh giá KPI | 3.2. | Công việc › Giao việc và duyệt đăng ký | `/kpi/assignments` | Mọi cấp |
| 2.15 Đánh giá KPI | 3.3. | Công việc › Chấm điểm công việc | `/kpi/grading` | Mọi cấp |
| 2.15 Đánh giá KPI | 4.1. | Đánh giá, xếp loại › Tự đánh giá, xếp loại | `/kpi/my-evaluation` | Mọi cấp |
| 2.15 Đánh giá KPI | 4.2. | Đánh giá, xếp loại › Đánh giá, xếp loại cán bộ | `/kpi/evaluations` | Mọi cấp |
| 2.15 Đánh giá KPI | 4.3. | Đánh giá, xếp loại › Tổng hợp tham mưu | `/kpi/advisory` | Mọi cấp |
| 2.15 Đánh giá KPI | 4.4. | Đánh giá, xếp loại › Biểu quyết xếp loại | `/kpi/voting` | Mọi cấp |
| 2.15 Đánh giá KPI | 5.1. | Báo cáo › Báo cáo KPI | `/kpi/reports` | Mọi cấp |
| 2.16 Website trường | 1.1. | Thiết lập › Thông tin website | `/website/settings` | Mọi cấp |
| 2.16 Website trường | 1.2. | Thiết lập › Tên miền | `/website/domains` | Mọi cấp |
| 2.16 Website trường | 2.1. | Nội dung › Tin tức | `/website/news` | Mọi cấp |
| 2.16 Website trường | 2.2. | Nội dung › Thông báo | `/website/announcements` | Mọi cấp |
| 2.16 Website trường | 2.3. | Nội dung › Giới thiệu, cơ cấu tổ chức | `/website/pages` | Mọi cấp |
| 2.16 Website trường | 2.4. | Nội dung › Công khai theo quy định | `/website/disclosures` | Mọi cấp |
| 2.16 Website trường | 2.5. | Nội dung › Thư viện ảnh | `/website/albums` | Mọi cấp |
| 2.16 Website trường | 3.1. | Duyệt và liên hệ › Nội dung chờ duyệt | `/website/review` | Mọi cấp |
| 2.16 Website trường | 3.2. | Duyệt và liên hệ › Thư liên hệ | `/website/contacts` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 1. | Việc của tôi | `/my-work` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 2.1. | Kho hồ sơ › Hồ sơ cá nhân | `/professional-records` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 2.2. | Kho hồ sơ › Hồ sơ tổ, nhóm | `/professional-records/groups` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 2.3. | Kho hồ sơ › Hồ sơ trường | `/professional-records/school` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 3.1. | Nộp và duyệt › Đợt nộp hồ sơ | `/professional-rounds` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 3.2. | Nộp và duyệt › Duyệt hồ sơ | `/professional-records/review` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 3.3. | Nộp và duyệt › Thống kê nộp hồ sơ | `/professional-records/statistics` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 4.1. | Thiết lập › Thư mục và luồng duyệt | `/professional-folders` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 4.2. | Thiết lập › Nhóm công tác | `/professional-work-groups` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 5.1. | Kế hoạch giáo dục › Kế hoạch của tôi | `/education-plans` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 5.2. | Kế hoạch giáo dục › Kế hoạch tổ, nhóm | `/education-plans/groups` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 5.3. | Kế hoạch giáo dục › Kế hoạch của trường | `/education-plans/school` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 5.4. | Kế hoạch giáo dục › Duyệt kế hoạch | `/education-plans/review` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 5.5. | Kế hoạch giáo dục › Tiến độ duyệt kế hoạch | `/education-plans/progress` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 5.6. | Kế hoạch giáo dục › Thư viện mẫu kế hoạch | `/education-plan-templates` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 6.1. | Bồi dưỡng giáo viên › Bồi dưỡng của tôi | `/training/mine` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 6.2. | Bồi dưỡng giáo viên › Khoá bồi dưỡng | `/training/courses` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 6.3. | Bồi dưỡng giáo viên › Hồ sơ bồi dưỡng | `/training/records` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 6.4. | Bồi dưỡng giáo viên › Năng lực số | `/training/competency` | Mọi cấp |
| 2.17 Hồ sơ chuyên môn | 6.5. | Bồi dưỡng giáo viên › Danh mục bồi dưỡng | `/training/settings` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 1.1. | Phong trào thi đua › Đợt thi đua | `/emulation/campaigns` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 1.2. | Phong trào thi đua › Đăng ký thi đua | `/emulation/registrations` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 2.1. | Hồ sơ đề nghị › Hồ sơ đề nghị của tôi | `/emulation/nominations` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 2.2. | Hồ sơ đề nghị › Tiếp nhận hồ sơ | `/emulation/nominations/review` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 3.1. | Hội đồng thi đua › Hội đồng và phiên họp | `/emulation/council` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 3.2. | Hội đồng thi đua › Bỏ phiếu bình xét | `/emulation/voting` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 3.3. | Hội đồng thi đua › Phúc khảo, khiếu nại | `/emulation/appeals` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 4.1. | Khen thưởng › Quyết định khen thưởng | `/emulation/decisions` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 5.1. | Báo cáo › Sổ theo dõi khen thưởng | `/emulation/history` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 5.2. | Báo cáo › Báo cáo đợt thi đua | `/emulation/reports` | Mọi cấp |
| 2.18 Thi đua, khen thưởng | 6.1. | Danh mục › Danh hiệu và hình thức khen thưởng | `/emulation/titles` | Mọi cấp |
| 2.19 Bảo đảm chất lượng | 1.1. | Tự đánh giá › Đợt tự đánh giá | `/quality/assessments` | Mọi cấp |
| 2.19 Bảo đảm chất lượng | 1.2. | Tự đánh giá › Phiếu đánh giá tiêu chí | `/quality/reports` | Mọi cấp |
| 2.19 Bảo đảm chất lượng | 1.3. | Tự đánh giá › Minh chứng | `/quality/evidences` | Mọi cấp |
| 2.19 Bảo đảm chất lượng | 2.1. | Kiểm định và thiết lập › Theo dõi công nhận | `/quality/recognition` | Mọi cấp |
| 2.19 Bảo đảm chất lượng | 2.2. | Kiểm định và thiết lập › Bộ tiêu chuẩn đánh giá | `/quality/frameworks` | Mọi cấp |
| 2.20 Thư viện | 1.1. | Danh mục › Ấn phẩm và bản sao | `/library/titles` | Mọi cấp |
| 2.20 Thư viện | 1.2. | Danh mục › Bạn đọc | `/library/readers` | Mọi cấp |
| 2.20 Thư viện | 2.1. | Mượn trả › Mượn, trả, đặt trước | `/library/circulation` | Mọi cấp |
| 2.20 Thư viện | 2.2. | Mượn trả › Phát và thu sách giáo khoa | `/library/textbooks` | Mọi cấp |
| 2.20 Thư viện | 3.1. | Kiểm kê và báo cáo › Kiểm kê | `/library/stocktakes` | Mọi cấp |
| 2.20 Thư viện | 3.2. | Kiểm kê và báo cáo › Báo cáo thư viện | `/library/reports` | Mọi cấp |
| 2.20 Thư viện | 4.1. | Thiết lập › Quy định mượn và phân loại | `/library/settings` | Mọi cấp |
| 2.21 Kho học liệu | 1. | Tìm học liệu | `/learning-resources` | Mọi cấp |
| 2.21 Kho học liệu | 2. | Học liệu của tôi | `/learning-resources/mine` | Mọi cấp |
| 2.21 Kho học liệu | 3. | Duyệt học liệu | `/learning-resources/review` | Mọi cấp |
| 2.21 Kho học liệu | 4. | Bộ sưu tập | `/learning-resources/collections` | Mọi cấp |
| 2.21 Kho học liệu | 5. | Báo lỗi học liệu | `/learning-resources/reports` | Mọi cấp |
| 2.21 Kho học liệu | 6. | Thống kê kho | `/learning-resources/statistics` | Mọi cấp |
| 2.21 Kho học liệu | 7. | Danh mục kho | `/learning-resources/settings` | Mọi cấp |
| 2.21 Kho học liệu | 8. | Câu hỏi, đề trong kho | `/learning-resources/questions` | Mọi cấp |
| 2.21 Kho học liệu | 9. | Rubric | `/learning-resources/rubrics` | Mọi cấp |
| 2.21 Kho học liệu | 10. | Gói chia sẻ liên trường | `/learning-resources/packages` | Mọi cấp |

## 3. Phụ lục B. Chỗ lệch giữa tài liệu và mã

Gom từ khi rà mã ngày 2026-10-25. Tài liệu 34 mô tả theo mã; các chỗ dưới đây cần cập nhật tài liệu gốc hoặc sửa mã ở đợt sau. Không sửa trong lần này vì phạm vi chỉ là tài liệu tổng hợp.

### 3.1. 01 Tổng quan và nền tảng

| Chỗ | Tài liệu nói | Mã làm |
|---|---|---|
| `tai_lieu/index.md` dòng đầu; `04_TONG_QUAN_DU_AN.md` tên dự án, mục 1, GD-04 | "School Management - Hệ thống quản lý trường mầm non"; "Hệ thống phục vụ khối mầm non" | Hệ thống đã đa cấp: bốn mã cấp MN, TH, THCS, THPT (`school-levels.ts`), menu và ứng dụng theo cấp (DT-19 đến DT-21), đa thuê bao (DT-SaaS) |
| `index.md` dòng tài liệu 32 | DT-SaaS "(S1a, S2 đã triển khai; S1b đến S9 ... kế hoạch)" | S1b đã gộp (PR 166, `scheduler_state`, `JobScheduler`, điểm tick); S7a, S8a, S9 (PR 167), S3 (PR 169) đã gộp; tài liệu 32 mục 14.10 ghi đúng |
| `index.md` "Phân hệ đã xác định 19", `05_PHAM_VI.md` mười chín phân hệ | 19 phân hệ P01 đến P19 | Cổng quản trị có 21 phân hệ (`PORTAL_WORKSPACES`); P01 đến P19 chỉ còn là tiền tố mã quyền. Hai cách chia khác nhau, tài liệu chưa có bảng đối chiếu |
| `08_VAI_TRO_NGUOI_DUNG.md` mục 1 cột "Kênh sử dụng" | Mỗi vai trò dùng kênh nhất định (VT-07 ứng dụng giáo viên, VT-14 ứng dụng phụ huynh...) | `POST /auth/login` không kiểm vai trò theo kênh; chỉ đăng nhập mã một lần giới hạn tài khoản chỉ có VT-14. Ở cổng, VT-14 không thấy gì nhờ `role_workspace_exclusions`; VT-07 có quyền xem nhiều mục ở cổng |
| `08_VAI_TRO_NGUOI_DUNG.md` mục 3 ma trận P01 đến P19 | Ma trận theo 19 phân hệ cũ với Q, S, D, X | Ma trận 0003 chỉ cấp `Pxx.view/edit/approve`; menu và API dùng quyền chi tiết thêm ở migration sau. Ví dụ `P01.edit` của VT-15, VT-03 không có điểm cuối nào dùng; VT-02 không thấy mục Giảng dạy dù tài liệu ghi D ở P03 |
| `08` mục 1 VT-06 | Nhân sự: dữ liệu nhân sự | Migration 0052, 0054 cấp cho VT-06 quyền văn thư (quản trị văn bản, đăng ký văn bản đến, ban hành văn bản đi) |
| `08` mục 1 VT-01 và tài liệu 32 mục 14 | VT-01 "Quản trị nền tảng" | Trong một trường VT-01 là quản trị kỹ thuật của trường đó; quản trị nền tảng DT-SaaS là `platform_operators` ở cơ sở dữ liệu `platform`, không có vai trò. Trùng tên gây nhầm |
| `12_KIEN_TRUC_HE_THONG.md` mục 1 sơ đồ và mục 8 | Kênh thông báo gồm tin nhắn, thư điện tử, thông báo đẩy, Facebook; "Trung tâm thông báo" tách riêng | `NotificationChannel` chỉ có `in_app`, `sms`, `zalo`; không có thư điện tử, thông báo đẩy; Facebook chỉ để đăng bài; tiến trình gửi chạy trong máy chủ API |
| `12` mục 1 sơ đồ | Tiến trình chạy nền ghi vào cơ sở dữ liệu | `apps/worker` không đọc, không ghi cơ sở dữ liệu; chỉ đọc và ghi Redis cho máy xếp thời khóa biểu; máy chủ API lưu kết quả |
| `12` mục 9 CB-03, CB-06, CB-09 | Nhắc nợ quá hạn hằng ngày; tổng hợp bảng điều khiển hằng giờ; khóa tài khoản hết hiệu lực hằng ngày | Không có việc nền nào như vậy: nhắc nợ là thao tác tay (`sendReminders`); không có bảng số liệu tổng hợp sẵn; khóa tài khoản kiểm lúc đăng nhập |
| `12` mục 8 "Kênh gửi và loại sự kiện cấu hình được theo đơn vị" | Cấu hình kênh theo đơn vị | Kênh ghi cứng ở từng chỗ gọi `queueNotification`; chỉ có mẫu nội dung chung toàn trường và bật Zalo toàn trường |
| `32` mục 14.10 dòng S2 | Lịch chạy `purge-due`, `migrate-schools` chờ bộ lập lịch của S1b | Sau khi S1b gộp vẫn chưa đăng ký hai việc này vào `JobScheduler`; chạy bằng dòng lệnh |
| `32` mục 14.4 bảng trạng thái `schools` | Có `read_only`, chuyển chỉ đọc khi hết hạn | Ràng buộc có `read_only` nhưng không hàm nào chuyển trường sang đó (chờ S5a) |
| `04` mục 8 giới hạn 4, `13`, `12` QĐ-12 | Hạ tầng đám mây trong nước | Hồ sơ thử nghiệm S9 (đã gộp, PR 167; QĐ-28 tài liệu 12) đặt máy ngoài Việt Nam khi có văn bản đồng ý; hồ sơ vận hành S7a trên VPS trong nước |

### 3.2. 02 Quản lý giáo dục, cơ sở vật chất, tuyển sinh đầu cấp, EMIS, kí hồ sơ

| Chỗ | Tài liệu nói | Mã làm |
|---|---|---|
| Tên phân hệ theo cấp (tài liệu 32, DT-19 phần 19c) | Phân hệ đổi tên thành "Quản lý giáo dục" khi trường bật cấp khác | `portalWorkspacesForLevels` (portal-menu.ts) đặt "Quản lý giáo dục <tên cấp>" khi người dùng làm việc ở đúng một cấp; chỉ "Quản lý giáo dục" khi chọn "Tất cả" |
| Thuật ngữ theo cấp (32, 19c) | Mầm non hiện "Trẻ", "Hồ sơ trẻ" theo bảng nhãn dùng chung | Nhãn menu trong portal-menu.ts cố định "Học sinh", "Hồ sơ học sinh"; trang 4.1.x cũng cố định "học sinh" |
| Tài liệu 14 mục 1.1 (bảng menu) | Mọi dòng ghi "Quản lý giáo dục Mầm non", không có cột cấp; MH-76, MH-77, MH-78 lặp hai lần | 4.3, 4.4 chỉ MN; 4.8 chỉ TH; 4.9 TH, THCS, THPT |
| Chuẩn nghề nghiệp 3.2 | Kỳ vọng có chuẩn giáo viên phổ thông TT 20/2018 và chuẩn hiệu trưởng phổ thông | Chỉ có chuẩn giáo viên mầm non TT 26/2018 và chuẩn hiệu trưởng mầm non TT 25/2018 (migration 0047), ghi "cần đối chiếu văn bản" |
| 1.7 Rà soát kiểm định | Phục vụ các cấp sau DT-19 đến DT-21 | `accreditation-review.ts` cố định cấp "Mầm non" |
| BR-124 (tệp 82 cột) | Cần cả quyền xem số định danh và quyền xuất | `POST /school-splits/:id/export` chỉ kiểm tra `P01.school-profile.manage` và `P17.data.export` nhưng giải mã số định danh vào tệp |
| MH-125 (3.4) | Xem cần `P01.view` hoặc `P01.academic-year.manage` | `GET /academic-years/:id/weeks` không gắn quyền, mọi người đã đăng nhập đọc được |
| MH-92, BR-125 (2.2) | Không nêu quyền nhập lớp | `permissionOfImport` dùng `P01.import.children` cho kiểu `classes` |
| BR-125 (tách trường) | Trạng thái "Nháp" đến "Đã xác nhận đi" | Mã và MH-124 hiện `draft` là "Chưa xác nhận" |
| QT-01 v1.3 | Không có xóa nháp, đề nghị chuyển đi, tiếp nhận chuyển đến | Có ở `student-records/student-transfers.ts`; duyệt chuyển đi đặt Thôi học; ghi chú trong `children/student-movements.ts` còn nói chưa có chuyển trường |
| Tài liệu 32 DT-16 (16f, 16g) | Có mục 5.9 và 4.1.9 | Không có lá menu 5.9 (là chế độ của 5.8) và 4.1.9 (gộp vào 4.1.8) |
| Menu lưu trữ 5.10 | Theo MH-96 đến MH-98 | Menu `/archive-fonds`, `/archive-holdings` bỏ quyền `P09.archive.export`, menu `/archive-report` bỏ `P09.archive.manage`, trong khi API GET nhận các quyền này |
| BR-97, MH-72 (4.4); BR-100, BR-101, MH-75, MH-76 (4.3) | Dẫn YCTD-104, YCTD-105 | Mã trả mã quy tắc `YCTD-102` |
| QT-02 (điểm danh) | Báo phụ huynh khi trẻ được điểm danh; trạng thái "Đã chốt" về "Đã điểm danh" khi sửa; lý do tối đa 500 ký tự; có việc chạy nền tổng hợp sau chốt | Lưu không gửi thông báo; sửa khi chốt giữ trạng thái chốt, mở lại là đường riêng; không giới hạn độ dài lý do; tổng hợp chạy đồng bộ và qua hàng đợi thông báo |
| QT-07 (dặn thuốc) | Có trạng thái Đã nhận thuốc và Đang chờ uống riêng; tự hoàn thành khi hết thời gian; báo cả y tế và GVCN; báo phụ huynh khi cho uống; từ chối, bỏ liều gửi cả SMS; leo thang sự kiện nặng | Nhận chuyển thẳng `administering`; hoàn thành khi đủ liều hoặc kết thúc sớm, không có tác vụ theo giờ; chỉ báo bên được giao; không báo khi cho uống; chỉ thông báo trong ứng dụng; không có leo thang |
| Brief, menu 4.8 | Bán trú chỉ Tiểu học | Menu chỉ TH nhưng API nhận mọi lớp không phải Mầm non |
| Kế hoạch 32 mục 18g; menu Cơ sở vật chất | Đối sánh danh mục tối thiểu cho TH, THCS, THPT (TT 37, 38, 39/2021) | Chỉ có mẫu `MN-TT02-2010`; thiết bị mới luôn `school_level = MN`; ràng buộc nhóm tuổi chỉ nhận nhóm mầm non; chọn cấp khác ra rỗng. Phân hệ không có `levels` nên hiện ở mọi cấp |
| Tài liệu 14 bảng menu Cơ sở vật chất | Chỉ đến mục 2.3 | portal-menu.ts có thêm 2.4, 2.5, 2.6 (MH-203 đến MH-205 có mô tả) |
| MH-80, MH-81 | 1.1 có lọc trạng thái; 2.1 lọc lĩnh vực, loại danh mục | Trang chỉ gửi đơn vị, khối, loại, hiện trạng (1.1) và đơn vị, lớp, nhóm tuổi, nhóm thiết bị (2.1); API có nhận các lọc kia |
| Menu so với API `/facility-rooms` | Hiện với người chỉ có `P13.equipment.manage` | `GET facilities/rooms` cần `P17.report.facilities` hoặc `P01.room.manage`, vai trò tự tạo chỉ có quyền thiết bị sẽ bị 403 |
| BR-138 (nơi để) | Tối đa hai cấp, phòng hoặc kho rồi vị trí | Mã chỉ kiểm tra nơi để cha không có cha; không kiểm tra loại của cha, vị trí không bắt buộc có cha |
| Kiểm kê thiết bị | Không nêu tách người nộp, người duyệt | Nộp, duyệt, trả lại, chốt cùng quyền `P13.equipment.manage`, một người tự duyệt được |
| MH-128, MH-129, MH-130 | Ghi quyền dạng "P13-13", "P13-12, P13-14", "P13-15" | Mã quyền thật `P17.report.facilities`, `P01.school-profile.manage`, `P13.equipment.manage` |
| Tài liệu 32 mục 8 (17d) | Chuyển hồ sơ tạo học sinh trong CSDL của năm học của đợt, năm đó phải đã tạo | `assertTargetYear` chỉ nhận năm học hiện tại; năm khác dù đã tạo, đang mở vẫn bị từ chối (BR-133 khớp mã) |
| Tài liệu 32 mục 8 (17d) | Loại hồ sơ có tài khoản hoặc tự do | `record_type` nhập tay qua ô "Tự do", mặc định `free`, không suy từ tài khoản phụ huynh, không đổi cách chuyển |
| MP-22 (tài liệu 14) | Hồ sơ đã duyệt ẩn nút, kể cả "Đồng ý nhập học"; quá hạn máy chủ từ chối | `parentConsent` không kiểm tra trạng thái duyệt và hạn điều chỉnh |
| BR-132 | Báo phụ huynh khi chuyển sang chờ phụ huynh xác nhận lại | Báo ở mọi lần "Đã chỉnh sửa thông tin" thành công |
| Tài liệu 32 (17c), 4.1 Thống kê | Theo đơn vị trường chính, phân hiệu | Có cả điểm trường khi điểm trường có hồ sơ |
| Menu 5.1 hỗ trợ tuyển sinh | Menu cần quyền xem hoặc trả lời | API còn nhận `P02.final-year.manage`, `.approve`; người chỉ có hai quyền này gọi được API nhưng không thấy menu |
| BR-133 | Không nêu quyền phụ khi chuyển hồ sơ | Người chạy cần `P02.child.manage` ở đơn vị đích; thiếu thì từng dòng báo lỗi |
| BR-127 (EMIS hoàn thành dữ liệu) | 2.1: loại hình, đợt cân đo học kỳ II, mọi trẻ 5 đến 6 tuổi đã đánh giá hoàn thành; 2.3: đã ghi thẻ "Trẻ làm quen tiếng Anh"; 1.1: loại hình, nhóm tuổi lớp, hiện trạng phòng | 2.1 kiểm tra loại trường, số đo học kỳ II, phiếu chuẩn nghề nghiệp đã chốt (điều kiện 5 đến 6 tuổi ở 2.4); 2.3 kiểm tra thẻ "Thống kê số trường, số trẻ"; 1.1 thêm loại trường, số đo học kỳ I, loại hợp đồng |
| MH-135 (2.3) | Có "Lấy dữ liệu năm trước", nút Ghi, Xóa dữ liệu | Có "Lấy dữ liệu", không có lấy năm trước |
| Tài liệu 31 mục 10.4.1, 32 (17a) | Sở có trang gửi riêng 1.2.2, 1.3.2, 2.1.2, 2.2.4, 2.3.2, 2.4.2 | Chỉ 1.1.2 là trang riêng; biểu khác gửi bằng khối gắn trong trang biểu |
| Tài liệu 31 mục 10.4.5 (1.3), 2.4 | Cột Học sinh (Tổng số, Nữ, Dân tộc), nhóm I Trường, II Học sinh, III Nhân viên y tế; 2.4 theo BaoCaoCuoiNamBieu1 của Sở | Cột Tổng số, Công lập, Tư thục, Dân lập, Nữ, Dân tộc với mã tự đặt; 2.4 dùng lại các thẻ Biểu 1 cũ và "Kết quả giáo dục" |
| Tài liệu 32 (16j) | 2.1 có sáu mục, 2.2 ba thẻ, 2.3 hai thẻ | Sau 17a: 2.1 một thẻ, 2.2 sáu thẻ, 2.3 một thẻ |
| Tài liệu 31 mục 10.3 (kí hồ sơ) | Sở có ô mật khẩu, "Đăng ký tài khoản", "Ký số", "Đăng nhập và ký", "Gửi hồ sơ" | Bản nội bộ: từ chối mật khẩu, "Kí xác nhận nội bộ", ẩn "Đăng nhập và kí", "Đánh dấu đã gửi" (chủ ý theo DT-16 chỉ chạy nội bộ) |
| Menu "Gửi ... lên cấp trên" (1.2 Tuyển sinh đầu cấp, 2.3 Cơ sở vật chất, EMIS) | Tên mục là gửi lên cấp trên | Không truyền gì, chỉ xuất tệp và đánh dấu (chủ ý, có dòng thông tin trên trang) |

### 3.3. 03 Dạy học, kiểm tra đánh giá

| Chỗ | Tài liệu nói | Mã làm |
|---|---|---|
| Số mục "Đánh giá học sinh" | Tài liệu 14, đoạn YCTD-161: "mục 7.3 Đánh giá học sinh" | `portal-menu.ts`: 7.3 là Khung giờ tiết học, Đánh giá học sinh là 7.5 |
| Số mục "Xét tốt nghiệp, hồ sơ thi" | Tài liệu 14 đoạn YCTD-167 (dòng thêm sau): "7.15 Xét tốt nghiệp, hồ sơ thi ở THCS, THPT (MH-301)" | `portal-menu.ts`: 7.17 Xét tốt nghiệp, hồ sơ thi; 7.15 là Báo cáo, thống kê, EMIS Tiểu học (MH-301 ở bảng ghi đúng 7.17) |
| Cấp của 7.3, 7.4 | Tài liệu 14 đoạn YCTD-167: "7.3, 7.4, 7.5 vẫn chỉ ở Tiểu học" | 7.3, 7.4 không có `levels` riêng nên hiện ở TH, THCS, THPT (đoạn YCTD-169 của tài liệu 14 đã ghi lại đúng); chỉ 7.5 là `primary` |
| MH cho màn hình Tiểu học | Tài liệu 14 không có dòng MH riêng cho 7.5, 7.15 và phần TH của 7.8 (chỉ đoạn mô tả YCTD-161, 163, 165) | Màn hình `/student-assessments`, `/primary-reports`, `/learning-records` (lớp TH) có trong mã |
| Phân quyền đánh giá, học bạ | Tài liệu 08 không có dòng PQ cho `P02.assessment.enter`, `P02.assessment.view`, `P02.assessment.manage`, `P02.student-record.approve` (chỉ nhắc `P02.assessment.manage` trong PQ-99) | Identity migration 0070 cấp `enter` cho VT-07, VT-08; `view` cho VT-02, VT-15, VT-03; `manage` cho VT-02, VT-15; migration 0072 cấp `P02.student-record.approve` cho VT-02, VT-15 |
| Chạy nền của chấm, trộn đề | Tài liệu 32 mục 12.2: "chấm phiếu trắc nghiệm, trộn đề, máy xếp thời khoá biểu chạy nền ở `worker`" | Chỉ máy xếp chạy ở `apps/worker`; trộn đề (`exams.ts`) và chấm phiếu (`exam-grading.ts`) chạy đồng bộ trong API; OMR ảnh phiếu chưa làm |
| Mở khoá sau chuyển điểm | Chú thích đầu `exam-grading.ts`: "kiểm tra bù thì mở khoá, nhập bài, khoá và chuyển lại" | Hàm `unlock` cùng tệp từ chối khi trạng thái `transferred` ("Điểm đã chuyển vào sổ điểm, không mở khoá được"); BR-188 ghi đúng theo hàm |
| Cấp của nhóm 8 | Tài liệu 14 MH-277 "chọn cấp (nếu nhiều)"; API phần đề nhận TH, THCS, THPT | Menu nhóm 8 dùng `secondary(group(...))` nên chỉ hiện ở THCS, THPT; trường chỉ có Tiểu học không vào được ngân hàng câu hỏi qua menu dù API cho phép cấp TH |
| Ngưỡng xếp loại học tập TT22 | BR-180 và mã mặc định: mỗi mức cần một môn chủ chốt (Toán hoặc Ngữ văn) đạt ngưỡng; môn nhận xét có Chưa đạt thì Chưa đạt | Theo Điều 9 Thông tư 22/2021 (đối chiếu văn bản gốc): không có điều kiện môn Toán, Ngữ văn; mức Đạt cho phép tối đa 01 môn nhận xét Chưa đạt. Mã có ghi "cần đối chiếu văn bản gốc trước khi dùng" và ngưỡng là cấu hình được, nhưng điều kiện môn nhận xét ghi cứng trong `suggestLearningRating`. Đây là chỗ nên rà lại với văn bản |
| Rèn luyện hè, kiểm tra lại THCS, THPT | Thông tư 22/2021 phân biệt: rèn luyện Chưa đạt thì rèn luyện trong hè, học tập Chưa đạt thì kiểm tra lại môn chưa đạt | Mã cho giáo viên chọn tự do `summer_training` hoặc `retest`, không ràng buộc theo loại chưa đạt, không ghi môn kiểm tra lại |
| Điểm khuyến khích THPT | Mặc định `max_incentive: 4` theo quy chế cũ, công thức điểm xét cộng khuyến khích | Mã ghi "theo quy chế hiện hành, cần đối chiếu"; nếu quy chế đang áp dụng đã bỏ điểm khuyến khích thì trường cần đặt `max_incentive` về 0 ở cấu hình |
| Nhập điểm sổ điểm | Tài liệu 32 mục 12.4 và kiểu `ScoreSource` có nguồn `import` | API sổ điểm không có điểm cuối nhập, xuất Excel; nguồn `import` chưa dùng |
| Công bố thời khoá biểu | Brief yêu cầu "công bố cho giáo viên, phụ huynh" | Không có thông báo đẩy khi ban hành; giáo viên, phụ huynh thấy bản đang áp dụng khi mở ứng dụng, website, trang mã QR |

### 3.4. 04 Điều hành và quản trị

| Chỗ | Tài liệu nói | Mã làm |
|---|---|---|
| Căn cứ pháp lý của DT-18 | Tài liệu 32 mục 9.5 yêu cầu phiên làm đọc văn bản gốc căn cứ pháp lý của từng phần trước khi viết phạm vi | Mã (`apps/api/src/incoming-documents`, `outgoing-documents`, `work`, `work-files`, `unit-schedules`, `document-reports`) và YCTD-138, 140, 141 không dẫn văn bản pháp lý nào, kể cả Nghị định 30/2020/NĐ-CP về công tác văn thư; chỉ dựa khảo sát VNPT iOffice và quyết định của Eric |
| Tên nhóm quyền P09 | Tài liệu 08 bảng ma trận phân hệ ghi dòng "P09 Công việc, kế hoạch, đánh giá" | Migration định danh 0052, 0054, 0055 gắn 14 quyền văn bản đến, văn bản đi, giao việc, lịch, hồ sơ, báo cáo vào `module_code = 'P09'`; ma trận ở tài liệu 08 chưa có dòng cho phân hệ Quản lý văn bản và điều hành (chỉ có ở PQ-78, PQ-80, PQ-81) |
| Hạn chế của văn bản đến | Tài liệu 24 YCTD-138 mục Hạn chế ghi "Tạo việc", "Cấp số và phát hành", báo cáo văn bản đến chưa có, chờ 18b, 18c | Mã đã có: nút Tạo công việc, Lưu vào hồ sơ công việc ở chi tiết văn bản đến (`DirectivePages.tsx`), `GET /incoming-documents/{id}/tasks`, báo cáo `/document-reports/incoming`, văn bản đi ghi Văn bản trả lời khi phát hành |
| Quyền mục 4.2 Công việc cần xử lý | Tài liệu 14 MH-188 ghi đối tượng "Người được giao, quản lý đơn vị được giao" | `menu-permissions.ts` chỉ hiện mục cho người có `P09.task.direct`, `P09.work-file.use` hoặc `P09.schedule.view`; controller `task-directives` không có decorator quyền, danh sách lọc theo dòng của mình nên người đăng nhập nào cũng gọi được API |
| Tên thẻ ở 1.2 Quản lý văn bản đến | Tài liệu 14 MH-159 ghi thẻ "Chờ xử lý", "Đã xử lý" | Hai thẻ lọc theo trạng thái văn bản `processing` (nhãn trạng thái "Đang xử lý") và `completed` (nhãn "Đã kết thúc") trong `IncomingListPages.tsx`; tên thẻ và nhãn trạng thái ở cột khác nhau |
| Bước nhận việc | Tài liệu 32 mục 9.4 phần 18c theo iOffice không nêu bước nhận; quy trình iOffice thường có nhận việc | `directives.ts` không có thao tác nhận việc; dòng ở `todo` là đã giao, cập nhật tiến độ đầu tiên chuyển `in_progress` |
| tai_lieu/32 mục 9.4 phần 18h, ý về môi trường trình diễn | Bản trình diễn "bật bằng cấu hình của môi trường" | `apps/api/src/demo/demo-mode.ts` bật bằng một dòng ở bảng `demo_environment` (cơ sở dữ liệu hệ thống) do lệnh tạo dữ liệu ghi, cố ý không dùng biến môi trường của trường; tài liệu 24 YCTD-145 ghi đúng như mã |
| tai_lieu/32 mục 9.4 phần 18h, ý về đăng nhập thay | Khi đăng nhập thay không thao tác được trên chứng thư số và mật khẩu | `apps/api/src/impersonation/impersonation.ts` còn chặn kí hồ sơ, kí văn bản đi, xuất toàn bộ dữ liệu; `ImpersonationActionsController` chặn xem nhật ký đăng nhập thay khi đang đăng nhập thay; tài liệu 24 YCTD-145 đã ghi đủ trừ ý chặn xem nhật ký |
| tai_lieu/14 MH-99 (1.2 Phân quyền nhóm theo phần mềm) | Danh sách 11 phân hệ, dòng "Đã chọn N/11 phân hệ" | `RoleWorkspacesPage.tsx` và `roles.service.ts` dùng `PORTAL_WORKSPACES` ở `packages/shared/src/portal-menu.ts`, hiện có 21 phân hệ |
| Chú thích mã `apps/portal/src/portal-shell/SystemAnnouncementsPage.tsx`, `AppLinksPage.tsx` | Ghi "3.5 Thông báo hệ thống", "3.6 Ứng dụng liên kết" | Menu ở `portal-menu.ts` và tài liệu 14 (MH-105, MH-106) đánh số 3.6 Thông báo hệ thống, 3.7 Ứng dụng liên kết; 3.5 là Tệp đã tạo |
| tai_lieu/24 (mục ngày 2026-10-25 về văn bản căn cứ), tai_lieu/22 BM-67 | Nghị định 13/2023/NĐ-CP hết hiệu lực từ 01/01/2026, thay bằng Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP | `apps/api/src/school-data-export/school-data-archive.ts` vẫn ghi Nghị định 13/2023/NĐ-CP trong tệp `DOC_TRUOC.txt` của gói toàn bộ dữ liệu |
| tai_lieu/08 bảng vai trò (VT-01) và PQ-10 | VT-01 quản trị cấu hình kỹ thuật, không xem dữ liệu nghiệp vụ | VT-01 có `P01.account.manage` nên thấy và sửa 1.1 đến 1.4, xem thẻ Tài khoản và quyền của 3.3; không có `P01.view` nên không thấy 2.6, 3.3 thẻ Nghiệp vụ. Không mâu thuẫn trực tiếp nhưng tài liệu 08 không nêu rõ quyền tài khoản của VT-01 |
| Mã màn hình KPI | Tài liệu 14 đánh số MH-167 đến MH-179 cho 13 màn hình KPI (sau khi đánh lại số lúc gộp 18a) | Ghi chú trong `apps/portal/src/kpi/*.tsx` còn số cũ MH-158 đến MH-170 (ví dụ `KpiCatalogPage.tsx` ghi "MH-162 Danh mục công việc chuẩn"), trùng số với màn hình văn bản đến của tài liệu 14 |
| Lịch kỳ KPI | Tài liệu 14 MH-167, tài liệu 10 P09-13 mô tả lịch bốn bước (đăng ký và thực hiện, tự đánh giá, cấp trên đánh giá, tham mưu) | Mã chỉ dùng `register_to` để phân việc đầu kỳ hay phát sinh; ba cặp ngày còn lại chỉ lưu và hiện, không chặn thao tác tự đánh giá, kết luận, tham mưu ngoài khoảng ngày |
| Tài liệu hạn chế của 18d | Tài liệu 32 mục 9 (18d) yêu cầu không đưa nguyên văn, phụ lục của văn bản điều chỉnh HD 06-HD/BTCTU vào kho mã, chỉ đưa tham số chấm điểm | Migration `0064_create_kpi.ts` chứa nguyên câu chữ 30 tiêu chí chung theo Mẫu 01-A, 01-B (ghi "Eric chọn ngày 2026-10-20"); cần chủ dự án xác nhận nội dung này được phép nằm trong kho |
| Hạn tự động KPI | BR-135 nêu quá hạn duyệt, xác nhận thì việc tự vào danh mục, quá hạn chấm thì lấy kết quả tự đánh giá (không nói thời điểm áp) | Không có tác vụ nền; `KpiSupport.applyDue` chỉ chạy khi có người mở danh sách việc, phiếu hoặc nộp, kết luận, khóa kỳ, mỗi lần tối đa 500 việc; trước đó việc quá hạn vẫn ở trạng thái cũ |
| Người soạn không tự đăng (website) | BR-139 ghi "người soạn không tự đăng" | Mã chỉ chặn theo quyền: người chỉ có `P14.website.edit` bị 403 khi duyệt; Hiệu trưởng, Phó Hiệu trưởng có cả soạn và duyệt vẫn duyệt và đăng được bài chính mình soạn (`website-content.ts`, hàm `transition`) |
| Trang thời khóa biểu và đăng ký sự kiện (website) | Tài liệu 32 mục 9 (18f) ghi trang thời khóa biểu "chờ 22c" và có đường dẫn "đăng ký sự kiện qua QR"; bảng tiến độ ghi đăng ký sự kiện để phần sau | Mã đã có trang `/thoi-khoa-bieu` đọc `timetable_versions` (22c1); không có đường dẫn hay bảng đăng ký sự kiện qua QR |
| Danh mục đơn vị KPI | Tài liệu 10 P09-14 ghi danh mục đơn vị do VT-03, VT-17 lập | Quyền `P09.kpi.manage` (dùng để sửa danh mục đơn vị) còn cấp cho VT-02, VT-15; người cấu hình (VT-02, VT-06) sửa được cả danh mục đơn vị |
| Tài liệu 32 mục 9.4, phần 18e | Kho ba nhánh: cá nhân, "tổ hoặc khối", trường | Nhánh `group` gồm tổ chuyên môn (bảng `departments`) hoặc nhóm công tác (`professional_work_groups`); không có khái niệm khối (`professional-records.ts`, hàm `create`) |
| Tài liệu 32 mục 9.4, phần 22i | Thư viện mẫu năm học, tổ chuyên môn (dự giờ, thao giảng), giáo viên, chủ nhiệm, bài dạy theo cấp học; xuất Word, PDF, Excel | Bộ mặc định chỉ có 7 mẫu Mầm non; Tiểu học, THCS, THPT rỗng và nạp mặc định báo chưa có mẫu; không có mẫu chủ nhiệm, bài dạy; Excel chỉ ở bảng tiến độ duyệt, kế hoạch xuất Word, PDF (`packages/shared/src/education-plans.ts`, `EDUCATION_PLAN_DEFAULT_TEMPLATES`) |
| Tài liệu 07 BR-140 | Khóa năm học chặn mọi thao tác ghi của phân hệ trừ mở khóa | Chỉ kho hồ sơ kiểm tra khóa; kế hoạch giáo dục (cùng phân hệ menu) không kiểm tra khóa và vẫn ghi bản lưu kho vào `professional_documents` khi kho đã khóa (`education-plans.ts` không đọc `professional_record_settings`) |
| Tài liệu 07 BR-140 | Luồng "tổ trưởng duyệt" là một cấp do tổ trưởng | Khi bỏ bước tổ trưởng (người nộp là tổ trưởng, hồ sơ không thuộc tổ, nhóm) hồ sơ luồng `leader` chuyển sang `pending_approval` chờ Ban Giám hiệu (`firstStep` trong `professional-records.ts`); tài liệu không nói rõ trường hợp này |
| Tài liệu 32 mục 13.2 | Duyệt đăng ký bồi dưỡng đi qua cùng mô hình trạng thái, sự kiện của luồng duyệt 18e | Đăng ký có bộ trạng thái riêng `pending`, `team_approved`, `approved`, `rejected`, `cancelled` trong `training_registrations`, không có bảng sự kiện, chỉ ghi nhật ký thay đổi (`training.ts`, hàm `review`) |
| Tài liệu 32 mục 13.4, phần 22e | Kế hoạch bồi dưỡng năm học (nhu cầu của giáo viên, tổ đề xuất) duyệt bằng luồng 18e | Không có bảng hay màn hình kế hoạch bồi dưỡng; 6.3 chỉ hiện "x/y khoá đã kết thúc"; kế hoạch bồi dưỡng cá nhân lập qua mẫu kế hoạch giáo dục `MN-CA-NHAN-BDTX` (chỉ Mầm non) |
| Tài liệu 32 mục 13.4, phần 22e | Điểm danh từng buổi; nhắc hạn đăng ký | Chỉ ghi số buổi có mặt mỗi đăng ký; phân hệ bồi dưỡng không gửi thông báo nào (`training.ts` không gọi `queueNotification`), chỉ hiện việc chờ ở Việc của tôi |
| Tài liệu 32 mục 13.4, phần 22e | Biểu đồ mạng nhện cá nhân, theo dõi qua các năm; báo cáo theo tổ, chuyên đề, đơn vị tổ chức xuất Excel, PDF; tệp minh chứng tham chiếu thư mục cá nhân 18e | Có bản đồ nhiệt theo kỳ của năm học hiện hành, bảng hoàn thành định mức theo tổ; không có biểu đồ mạng nhện, không xuất Excel, PDF báo cáo; chứng chỉ không liên kết kho hồ sơ 18e (`TrainingPages.tsx`, `training.ts`) |
| Chú thích đầu `apps/portal/src/my-work/MyWorkPage.tsx` | Việc của tôi gom 9 nguồn (văn bản đến, đi, giao việc, phòng họp, KPI, hồ sơ chuyên môn, kế hoạch bài dạy, kí hồ sơ, nghỉ phép) | Máy chủ khai báo 14 nguồn, thêm kế hoạch giáo dục, bán trú an toàn thực phẩm, thi đua, bồi dưỡng, kho học liệu (`MY_WORK_SOURCE_TYPES`) |
| Căn cứ pháp lý thi đua (yêu cầu đề bài nêu Nghị định 98/2023/NĐ-CP) | Tài liệu 24 YCTD-148 và 32 mục 9 dòng 22d: căn cứ Luật Thi đua, khen thưởng 2022, Nghị định 368/2026/NĐ-CP, Thông tư 25/2026/TT-BNV | `packages/shared/src/emulation.ts` ghi Luật 2022 và Nghị định 368/2026/NĐ-CP; không có Nghị định 98/2023/NĐ-CP hay thông tư thi đua ngành giáo dục; Thông tư 25/2026/TT-BNV chỉ ở tài liệu |
| Hội đồng thi đua có "đúng một Chủ tịch" (07 BR-149) | Hội đồng của đợt có đúng một Chủ tịch | `emulation-fields.ts` chặn quá một Chủ tịch, `emulation-council.ts` `saveCouncil` chỉ đòi Chủ tịch khi có thành viên; ghi hội đồng rỗng vẫn được (mở phiên mới chặn "Chưa lập hội đồng") |
| Tỉ lệ tối đa (07 BR-148) | "Số hồ sơ đã tiếp nhận của danh hiệu không quá tỉ lệ tối đa của số hồ sơ danh hiệu gốc" | `emulation.ts` `checks` đếm hồ sơ ở trạng thái Đã tiếp nhận, Thông qua, Đã trình cấp trên, Đã khen thưởng (không tính Không thông qua), cộng chính hồ sơ đang xét khi nó chưa ở các trạng thái đó |
| Mức của trường khi hoàn thành đợt (07 BR-152, 24 YCTD-149) | Mức không vượt số mức của bộ tiêu chuẩn | `quality-assurance.ts` `complete` chỉ chặn khi `selfLevel > framework.max_level + 1`, API nhận 0 đến 4: với bộ ba mức, gọi API trực tiếp vẫn ghi được Mức 4 (giao diện chỉ cho chọn đến số mức của bộ) |
| Bộ tiêu chuẩn theo cấp học (32 mục 9.4 dòng 22f) | Bộ tiêu chuẩn cấu hình được theo cấp học, có thể thêm bộ mẫu theo thông tư hiện hành | `QUALITY_DEFAULT_FRAMEWORKS` chỉ có bộ Mầm non `MN-KDCL`; Tiểu học, THCS, THPT rỗng, `loadDefaults` báo "Chưa có bộ tiêu chuẩn mặc định cho cấp học này"; không có bộ theo Thông tư 17/2018, 18/2018 |
| Quyền vào trang Hội đồng và phiên họp (14 MH-245, `menu-permissions.ts`) | 3.1 chỉ cho người quản lý, người ban hành | `emulation-council.ts` `council` cho cả thành viên hội đồng xem hội đồng của đợt qua API; menu vẫn ẩn 3.1 với người chỉ có `P09.emulation.use` |
| Tăng phiên bản danh hiệu (07 BR-147, 24 YCTD-148) | Sửa tiêu chí, điều kiện thì tăng số hiệu | `emulation.ts` `updateTitle` chỉ tăng khi đổi tiêu chí, tỉ lệ phiếu, mức KPI, số năm liên tục, danh hiệu tiền đề; đổi điểm tối thiểu, tỉ lệ tối đa, sáng kiến không tăng |

### 3.5. 05 Tài chính, nhân sự, hậu cần, tương tác

| Chỗ | Tài liệu nói | Mã làm |
|---|---|---|
| QT-04 mục 7, trạng thái phiếu thu | Phiếu thu có trạng thái Nháp rồi Đã phát hành (VT-04, VT-16 bấm phát hành) | Phiếu thu phát hành ngay khi lập, không có bản nháp; bảng `receipts` chỉ có `issued`, `pending_reversal`, `reversed` (`finance/receipts.service.ts` dòng 19-20, migration 0014) |
| QT-03 bước 4 và mục 15 | Tính học phí là tác vụ chạy nền theo lô | `POST fee-calculations` tính đồng bộ trong yêu cầu, chỉ ghi một dòng `fee_calculation_runs` để biết thành công, thất bại (`fees/fee-calculation.service.ts`) |
| BR-78 (07 mục 12.1) | Người lập chứng từ không tự phê duyệt chứng từ của mình | Chỉ kiểm ở phiếu chi, khoản điều chỉnh lương, đề nghị mua hàng, biên bản kiểm kê, hỏng mất tài sản, đơn nghỉ, đề nghị tuyển dụng, chốt kỳ. Không kiểm ở miễn giảm, phiếu điều chỉnh hóa đơn (`fees/discounts.service.ts`), phiếu đảo phiếu thu, phiếu đảo phiếu chi (`finance/receipt-reversals.service.ts`, `payment-reversals.service.ts`), duyệt bảng lương, quyết toán (`payroll/payroll.service.ts`, `settlements.service.ts`); thực tế được tách nhờ vai trò lập và vai trò duyệt khác nhau |
| BR-39, QT-06 mục 7 | Trạng thái ngày công: đủ công, đi muộn, về sớm, nghỉ có lương, nghỉ không lương, nghỉ lễ, vắng không phép | `timesheet_days` chỉ lưu `present`, `leave`, `absent`, `holiday`, `day_off`; đi muộn, về sớm là số lần đếm từ giờ vào, ra (migration 0021, `timesheets.service.ts`) |
| QT-06 mục 7 | Không có trạng thái trả lại bảng lương | Bảng lương có thao tác Trả lại, đưa về `draft` kèm lý do (`payroll.service.ts` dòng 294) |
| QT-10 mục 7 | Từ chối chỉ về Nháp rồi mới gửi lại | Mã cho gửi trình duyệt trực tiếp từ `rejected` ("Chỉ gửi trình duyệt hoạt động nháp hoặc bị từ chối"); sửa hoạt động bị từ chối thì về nháp (`activities/activities.ts`) |
| BR-83 và BR-167 | BR-83 bán trú bắt buộc với mọi trẻ đang học; BR-167 danh sách ăn lớp ngoài Mầm non là học sinh "đăng ký bán trú của tháng" | Dịch vụ `BAN_TRU` bắt buộc được tự đăng ký cho mọi học sinh đang học, không phân biệt cấp (`fees/registrations.service.ts` dòng 618-640), nên danh sách ăn lớp ngoài Mầm non là cả lớp trừ học sinh cắt suất; không có cách để học sinh Tiểu học không đăng ký bán trú |
| Tài liệu 32 mục kế hoạch DT-SaaS | Khóa cổng thanh toán, eSMS, Zalo, Facebook chuyển thành cấu hình của từng trường | Đã làm ở S3 (PR 169): khóa thanh toán, eSMS, Zalo, Facebook, kho tệp lưu mã hóa theo trường ở `integration_secrets`; dịch vụ định danh vẫn gửi mã đăng nhập qua eSMS theo cấu hình máy chủ, chưa theo trường |
| Q-140 (tài liệu 04) | Hệ thống tài khoản theo Thông tư 24/2024/TT-BTC "theo hiểu biết của nhóm thiết kế", kế toán trưởng kiểm lại số hiệu | Mã dựng sẵn tài khoản 111, 112, 131, 334, 332, 3335, 421, 531, 642 và quy tắc ghi sổ mặc định; chưa có ghi nhận đã kiểm lại số hiệu văn bản |
| MH-29 (tài liệu 14) | VT-15 chưa có quyền ở tệp 0034 nên chưa thấy thẻ Hợp nhất đơn vị | Đúng như mã: `P17.report.consolidated` chỉ gán VT-02, VT-19 |
| Tài liệu 12.1 BR-77 và mã | Hạn mức chốt kỳ tài chính có trong danh mục loại chứng từ `financial_period_closing` | `finance/fiscal-periods.ts` ghi Hiệu trưởng duyệt chốt kỳ, không theo hạn mức vì không có giá trị tiền; loại chứng từ này có trong `APPROVAL_DOCUMENT_TYPES` nhưng không được dùng |

### 3.6. 06 Thư viện, kho học liệu, ứng dụng giáo viên và phụ huynh

| Chỗ | Tài liệu nói | Mã làm |
|---|---|---|
| Menu phân hệ Thư viện | Tài liệu 32 mục 13.4 (22a): phân hệ gắn `levels` theo cấp bật | `portal-menu.ts` không đặt `levels` cho `library`; phân hệ hiện ở mọi cấp, kể cả trường chỉ có Mầm non (YCTD-181 ghi nhận) |
| Nơi lưu dữ liệu thư viện | Tài liệu 32 mục 13.4: danh mục, bản sao, bạn đọc ưu tiên CSDL hệ thống 0040 | Toàn bộ 15 bảng ở CSDL năm học `0100_create_library`; chép sang năm mới ở bước `library`; số hệ thống 0040 không dùng (YCTD-181 ghi nhận) |
| Cấp học sinh được mượn và ứng dụng phụ huynh | Tài liệu 32 mục 13.4: cấp mượn cấu hình được; ứng dụng phụ huynh hiện cho cấp có thư viện | Thiết lập 4.1 cho chọn cả MN, nhưng `LEVEL_FEATURES.library_loans` cố định `TH`, `THCS`, `THPT`: trường bật học sinh Mầm non mượn thì phụ huynh con Mầm non không thấy "Sách thư viện" |
| Quyền `P02.library.view` | Mô tả quyền ở `0090_add_library_permissions` và tài liệu YCTD-181: tra cứu, xem sách mình mượn, **đặt trước ấn phẩm** | `POST /library/reservations` yêu cầu `P02.library.manage`; người chỉ có quyền xem không tự đặt trước được, và ứng dụng giáo viên không có nút đặt trước |
| Thanh lý bản sao | Tài liệu 32 mục 13.4: thanh lý có biên bản, lý do, người duyệt | `POST /library/copies/dispose` chỉ cần lý do, không có biên bản, không có bước duyệt |
| Quá hạn | Tài liệu 32 mục 13.4: nhắc qua thông báo và Việc của tôi của thủ thư | Chỉ có thông báo khi thủ thư bấm "Nhắc quá hạn"; `my-work` không có nguồn thư viện; không có tác vụ nền tự nhắc |
| Thẻ bạn đọc | Tài liệu 32 mục 13.4: thẻ tự cấp khi nhập học, tự khóa khi nghỉ | Thẻ cấp khi bấm "Đồng bộ thẻ" (hoặc khi phát sách giáo khoa); khóa thẻ người đã nghỉ cũng chỉ khi đồng bộ |
| Danh mục ấn phẩm | Tài liệu 32 mục 13.4: nhập Excel theo mẫu, ảnh bìa, môn | Chưa có nhập Excel, ảnh bìa; ô môn chưa có trên giao diện (API nhận `subject_id`) (YCTD-181 ghi hạn chế) |
| Danh sách lượt mượn | Tài liệu 14 MH-293 mô tả chung | API lọc `open`, `overdue`, `returned`, `lost`; giao diện chỉ có Đang mượn, Quá hạn (YCTD-181 ghi hạn chế) |
| Căn cứ chuẩn thư viện | Tài liệu 32 mục 13.2: đọc văn bản gốc, ghi số hiệu vào YCTD | YCTD-181 và mã chưa ghi số hiệu thông tư tiêu chuẩn thư viện; ngưỡng chỉ tiêu để trống |
| Menu Kho học liệu | Tài liệu 32 mục 13.4 (22h1): phân hệ gắn `levels` theo cấp; có ứng dụng giáo viên | `portal-menu.ts` không đặt `levels`; chưa có màn hình kho học liệu trên ứng dụng giáo viên (YCTD-183 ghi hạn chế) |
| Luồng duyệt học liệu | Tài liệu 32 mục 13.2, 13.4: dùng lại luồng duyệt, sự kiện của 18e (`professional_documents`) | Kho có cột trạng thái riêng trên `learning_resources` và bảng sự kiện riêng `learning_resource_events`; chỉ dùng chung Việc của tôi |
| Kế hoạch bài dạy trong kho | Tài liệu 14 MH-303 không nhắc | API `POST /learning-resources/{id}/lesson-plans` có; giao diện chưa có ô chọn kế hoạch bài dạy, chi tiết hiện dữ liệu thô (YCTD-183 ghi hạn chế) |
| Điều hướng ứng dụng | Tài liệu 14 BC-02: ứng dụng giáo viên và phụ huynh dùng điều hướng dưới cùng, tối đa năm mục chính | Không có thanh điều hướng dưới cùng; giáo viên dùng một trang "Lớp của tôi" với nhiều nút, phụ huynh dùng trang chủ với thẻ từng con, mỗi thẻ đến 19 nút |
| Mã màn hình Lịch công tác | Tài liệu 14: lịch công tác thuộc MG-10 | Chú thích trong `WorkScheduleList.tsx` ghi MG-12 |
| Mã màn hình Đồng ý hình ảnh | Tài liệu 14: đồng ý hình ảnh ở MP-01 và MP-18; MP-09 là Trao đổi với nhà trường | Chú thích trong `PhotoConsentPanel.tsx` ghi MP-09 |
| Mã màn hình ứng dụng mới | Tài liệu 14 mục 2.2, 2.3 dừng ở MG-18, MP-22 | Các màn hình mới (Sổ đầu bài, Lịch dạy, Đánh giá học sinh, Bán trú, Sổ điểm, Bồi dưỡng ở ứng dụng giáo viên; Thời khoá biểu, Điểm danh theo tiết, Kết quả đánh giá, Học bạ, Cắt suất bán trú, Điểm học tập ở ứng dụng phụ huynh) không có mã MG, MP; một số mô tả trong dòng MH của cổng (MH-260, MH-266, MH-275, MH-276, MH-288, MH-298, MH-299) |
| Đổi mật khẩu ứng dụng giáo viên | Tài liệu 14 MH-48: đổi mật khẩu, kể cả khi bắt buộc | Ứng dụng giáo viên chỉ hiện màn hình đổi mật khẩu khi bắt buộc; không có lối vào đổi mật khẩu tự chọn |
| Sách tôi đang mượn với bảo vệ | Tài liệu 14 MH-298: giáo viên | Nút hiện cho mọi tài khoản ứng dụng giáo viên; VT-18 Bảo vệ không có `P02.library.view` nên gọi API bị từ chối |
| Chọn con ở ứng dụng phụ huynh | Yêu cầu tổng hợp nêu bước chọn con | Không có bước chọn con; mọi con hiện cùng lúc thành thẻ |

## 4. Phụ lục C. Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| `LEVEL_FEATURES` | Bảng chức năng ứng dụng theo cấp học trong `packages/shared/src/level-features.ts` |
| `level_scale` | Cách chấm theo thang mức của chỉ báo (bộ quy tắc 2, sáu mức) |
| `manifest.json` | Tệp mô tả gói: người tạo, thời điểm, bảng, cột, số dòng, tệp kèm, tệp bỏ qua |
| `on_demand_tls` | Cơ chế Caddy xin chứng chỉ HTTPS khi có truy cập đầu, sau khi hỏi máy chủ API tên miền có hợp lệ |
| `P01.view` | Quyền xem của phân hệ chức năng P01 Nền tảng, đơn vị và phân quyền |
| `progress_quality` | Cách chấm theo tiến độ và kết quả (bộ quy tắc 1) |
| 1.7 Rà soát thông tin kiểm định CLGD | Mục của phân hệ Quản lý giáo dục Mầm non lưu cấp độ kiểm định, chuẩn quốc gia; bảng `accreditation_reviews` |
| 18b, 18d, 18e, 17e | Mã phần kế hoạch: văn bản đi, KPI cán bộ, kho hồ sơ chuyên môn, mục 1.7 |
| A | Tổng điểm quy đổi tối đa của việc đầu kỳ đang tính |
| Ấn phẩm | Đầu sách, báo, tạp chí, tài liệu số trong danh mục thư viện (`library_titles`) |
| B | Tổng điểm quy đổi thực tế của việc đã chấm, kể cả việc phát sinh |
| Bài kiểm tra của lớp | Phiên chấm một đề đã khoá cho một lớp (`exam_sessions`) |
| Bản chạy nội bộ | Chức năng cần hệ thống ngoài làm đủ màn hình, bước kết nối thay bằng đánh dấu tay, có chỗ nối để cắm kết nối thật |
| Bản đang áp dụng | Bản thời khoá biểu đã ban hành có ngày áp dụng gần nhất không sau ngày xem |
| Bản sao | Một cuốn cụ thể của ấn phẩm, có số đăng ký cá biệt (`library_copies`) |
| Bản trình diễn | Máy chủ chạy dữ liệu giả, có trang chọn vai, chặn gửi tin và thanh toán thật, tự đặt lại định kỳ |
| Bảng điều kiện | Kết quả kiểm tra điều kiện của danh hiệu cho hồ sơ: Đạt, Không đạt, Chưa đối chiếu được; chỉ để hội đồng tham khảo |
| Báo vắng có báo, báo muộn | Báo trước hoặc sau giờ vào học `school_start_time` |
| BDTX | Bồi dưỡng thường xuyên |
| Biểu 01.ĐN-MN, 08.ĐN-NSNN | Biểu báo cáo đầu năm Mầm non và biểu ngân sách nhà nước theo hệ thống của Sở |
| Bố cục `database`, `schema` | Mỗi trường các cơ sở dữ liệu riêng, hoặc các lược đồ riêng trong ít cơ sở dữ liệu |
| Bộ quy tắc chấm | Tập tham số chấm điểm (cách chấm, điểm chuẩn, hệ số, mức, ngưỡng, hạn, tỷ lệ) có phiên bản; bản đã ban hành không sửa |
| Bộ tiêu chuẩn | Bộ tiêu chuẩn kiểm định gồm tiêu chuẩn, tiêu chí, chỉ báo theo mức; bảng `quality_frameworks` |
| BR | Quy tắc nghiệp vụ trong tài liệu 07 |
| BR-74 | Quy tắc xuất dữ liệu cá nhân phải có quyền và ghi nhật ký xuất |
| BR-xx, YCTD-xx, MH-xx, MG-xx, MP-xx | Mã quy tắc nghiệp vụ (07), yêu cầu thay đổi (24), màn hình cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh (14) |
| BR, BM, PQ, XT | Quy tắc nghiệp vụ, bảo mật, phân quyền, xác thực |
| BR, PQ, MH, YCTD, VT | Mã quy tắc nghiệp vụ (07), phân quyền (08), màn hình (14), yêu cầu thay đổi (24), vai trò (08) |
| BR, QT, MH, MG, MP, VT | Quy tắc nghiệp vụ (tài liệu 07), quy trình nghiệp vụ (tài liệu 25), màn hình cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh (tài liệu 14), vai trò (tài liệu 08) |
| Bước duyệt kế hoạch | Tổ trưởng, Phó Hiệu trưởng, Hiệu trưởng theo thứ tự cố định |
| Canary | Trường chạy migrate trước để thử |
| Cắt suất | Phụ huynh báo không ăn bán trú ngày đó |
| Cắt suất, chốt suất | Bán trú lớp ngoài Mầm non: phụ huynh báo không ăn ngày nào; giáo viên chốt số suất của lớp trong ngày |
| Cấp đang làm việc | Cấp người dùng chọn ở thanh đầu trang; null là "Tất cả" |
| CBQL/GV | Cán bộ quản lý, giáo viên |
| CC, CC0 | Giấy phép Creative Commons; CC0 là không bảo lưu quyền |
| Chế độ một trường, nhiều trường | Không có hay có `PLATFORM_DATABASE_URL` |
| Chế độ trình diễn | Cấu hình website hiện dải "Trang trình diễn", cho tạo nội dung mẫu, chặn lập chỉ mục |
| Chỉ báo | Yêu cầu cụ thể của một tiêu chí ở một mức; đạt đủ chỉ báo các mức từ 1 đến L thì gợi ý Mức L |
| Chỉ tiêu theo chuẩn | Bảy chỉ số đo kho thư viện so với ngưỡng cấu hình |
| Chốt điểm danh | Khóa điểm danh của lớp trong ngày, căn cứ tính suất ăn và tiền ăn |
| Chuyển trực tiếp | Văn thư chuyển xử lý không qua lãnh đạo |
| Chứng nhận do trường cấp | Chứng nhận hoàn thành khoá do trường tổ chức, có mã tra cứu 12 ký tự và mã QR |
| Chứng thư số | Thông tin chứng thư chữ ký số của trường; bản nội bộ không lưu khóa bí mật |
| CLGD | Chất lượng giáo dục (kiểm định) |
| Công nhận, hiệu lực | Kết quả đánh giá ngoài (cấp độ, quyết định, ngày); hiệu lực mặc định 5 năm |
| Cổng quyền (gate) | Điều kiện chung của cả nhóm menu cũ; mục chỉ hiện khi thỏa cả cổng và điều kiện chính |
| Cổng TTĐT | Cổng thông tin điện tử, ở đây là website trường |
| CSDL | Cơ sở dữ liệu |
| CSDL ngành, mã định danh Bộ | Cơ sở dữ liệu ngành giáo dục của Bộ GD&ĐT; mã học sinh, nhân sự do Bộ cấp |
| CSDLQG về dân cư | Cơ sở dữ liệu quốc gia về dân cư; hệ thống chưa kết nối, chỉ đánh dấu xác thực bằng tay |
| CT GDPT 2018 | Chương trình giáo dục phổ thông 2018 (Thông tư 32/2018/TT-BGDĐT) |
| Danh hiệu gốc của tỉ lệ | Danh hiệu dùng làm mẫu số khi tính tỉ lệ tối đa (ví dụ CSTDCS không quá 10% số LDTT) |
| Danh hiệu thi đua, hình thức khen thưởng | Hai loại mục của danh mục (`kind` `title`, `award`); ví dụ Lao động tiên tiến, Giấy khen của Hiệu trưởng |
| Danh hiệu tiền đề | Danh hiệu phải đạt nhiều năm liên tục liền trước để được xét danh hiệu cao hơn |
| Danh mục tối thiểu | Danh mục đồ dùng, đồ chơi, thiết bị tối thiểu theo TT 02/2010 sửa đổi bởi TT 34/2013 |
| DocumentExchange | Chỗ nối trục liên thông trong mã (bản `LocalDocumentExchange`) |
| DossierSigner | Chỗ nối ký nội bộ của phân hệ Quản lý kí hồ sơ, lập bản đã ký PDF |
| DT-SaaS | Đợt chuyển hệ thống thành nền tảng nhiều trường |
| DT-xx | Đợt triển khai theo kế hoạch |
| Đánh dấu đã trỏ | Ghi tay rằng bản ghi DNS của tên miền đã trỏ về máy chủ |
| Đăng nhập thay | Quản trị vào tài khoản người khác để hỗ trợ, có lý do, có hạn, có nhật ký |
| Đăng nhập thay (impersonation) | Hiệu trưởng vào tài khoản người khác để hỗ trợ, có lý do, tối đa 60 phút, ghi nhật ký |
| Đặt trước | Bạn đọc xếp hàng chờ ấn phẩm đã hết bản sẵn sàng |
| ĐĐGtx, ĐĐGgk, ĐĐGck | Điểm đánh giá thường xuyên, giữa kỳ, cuối kỳ (`regular`, `mid`, `final`) |
| Điểm chuẩn | Điểm gốc của một loại công việc (10 ở hai bộ mặc định) |
| Điểm liệt | Điểm bài thi từ ngưỡng `floor_score` trở xuống làm thí sinh không đạt tốt nghiệp |
| Điểm quy đổi | Điểm thực hiện nhân hệ số độ khó, không vượt mức tối đa |
| Định mức tiết | Số tiết bồi dưỡng thường xuyên phải đạt mỗi năm học, mặc định 120 |
| Đọc tại chỗ | Phân loại không cho mượn về |
| Đóng băng | Khóa văn bản đã ban hành, chặn gửi, công bố, lưu hồ sơ |
| Độ khó, độ phân biệt | Tỉ lệ điểm đạt trung bình của câu; hiệu tỉ lệ đạt nhóm 27% cao và 27% thấp |
| Đối tượng đánh giá | Hồ sơ KPI của một nhân sự: bộ quy tắc, nhóm, cấp học, vị trí việc làm, cấp trên trực tiếp |
| Đồng ý hình ảnh | Phụ huynh đồng ý cho dùng hình của trẻ; hình có trẻ chưa đồng ý không hiện cho phụ huynh |
| Đợt nộp | Đợt yêu cầu nộp hồ sơ vào một thư mục, có ngày mở và hạn nộp, nộp theo cá nhân hoặc theo tổ |
| Đợt thi đua (phong trào) | Một đợt xét thi đua trong năm học: thường xuyên (năm học) hoặc chuyên đề; bảng `emulation_campaigns` |
| Đợt tự đánh giá | Một lần trường tự đánh giá theo một bộ tiêu chuẩn: Đang chuẩn bị, Đang đánh giá, Đã hoàn thành |
| ĐTBmhk, ĐTBmcn | Điểm trung bình môn học kỳ, cả năm |
| EMIS | Hệ thống thông tin quản lý giáo dục; biểu báo cáo số liệu gửi cấp trên |
| eSMS, Zalo OA | Nhà cung cấp tin nhắn SMS; tài khoản chính thức Zalo của trường |
| Giấy ATTP | Giấy tờ an toàn thực phẩm của nhà cung cấp, nhất là giấy chứng nhận cơ sở đủ điều kiện |
| Giữ chỗ | Thời gian bản được giữ cho người đặt trước (mặc định 3 ngày) |
| Gói chia sẻ | Tệp gzip chứa bản kê JSON và nội dung học liệu để chuyển sang trường khác |
| Gói toàn bộ dữ liệu | Tệp ZIP chứa CSV mọi bảng, tệp đính kèm, `manifest.json`, `DOC_TRUOC.txt` |
| Gửi lên cấp trên | Cơ chế xuất tệp, trường nộp bằng tay rồi đánh dấu đã gửi (YCTD-121) |
| GVCN, CBQL, GV, NV | Giáo viên chủ nhiệm, cán bộ quản lý, giáo viên, nhân viên |
| Hạn chế xem | Văn bản chỉ người trong luồng xem được |
| Hạn mức phê duyệt | Số tiền theo đơn vị và loại chứng từ; từ hạn mức trở lên hoặc chưa đặt thì Hiệu trưởng duyệt |
| Hệ số độ khó | Hệ số nhân điểm thực hiện ra điểm quy đổi |
| HMTS | Mã phiếu hỏng, mất tài sản tạo khi chốt kiểm kê |
| Hóa đơn chính, hóa đơn bổ sung | Mỗi học sinh mỗi kỳ một hóa đơn chính; khoản phát sinh sau phát hành vào hóa đơn bổ sung cùng kỳ |
| Hóa đơn công nợ đầu kỳ | Hóa đơn chuyển nợ của học sinh sang năm học mới hoặc nhập tay khi khởi tạo |
| Học bạ số | Học bạ PDF lập từ kết quả đã khoá, kí nội bộ |
| Học liệu | Tài nguyên dạy học trong kho: tệp, liên kết ngoài, kế hoạch bài dạy tham chiếu |
| Hồ sơ cuối cấp | Hồ sơ trẻ lớp mẫu giáo năm cuối (từ 60 tháng tuổi) chuẩn bị vào lớp 1 |
| Hồ sơ đề nghị | Hồ sơ đề nghị khen thưởng cho một cá nhân hoặc tổ, một danh hiệu, trong một đợt |
| Hồ sơ đồng ý | `dpa`, `consent`, `impact-assessment`, `risk-acceptance` theo mẫu PL-01, PL-02, PL-03, PL-06 |
| Hồ sơ nộp lưu | Hồ sơ công việc đã kết thúc, chủ hồ sơ bàn giao cho văn thư lưu trữ |
| Kế hoạch cải tiến | Các việc khắc phục điểm yếu ghi ở phiếu, chuyển thành kế hoạch công việc nháp |
| Kế thừa minh chứng | Chép minh chứng của đợt cùng bộ năm học trước, giữ mã cũ, trạng thái Cần cập nhật |
| Kênh (channel) | `portal`, `teacher`, `parent` của phiên; `in_app`, `sms`, `zalo` của thông báo |
| Kho hồ sơ chuyên môn | Cây thư mục hồ sơ theo năm học, ba nhánh cá nhân, tổ hoặc nhóm, trường |
| Khóa API đối tác | Khóa chỉ đọc cấp cho đối tác theo phạm vi, căn cứ pháp lý, địa chỉ mạng, ngày hết hạn |
| Khóa năm học | Cờ của kho hồ sơ chặn mọi thao tác ghi hồ sơ, đợt nộp của năm học |
| Khoá số liệu, khoá điểm | Chốt kết quả theo kỳ và lớp; mở khoá cần lý do |
| Khoản mục thu chi | Danh mục phân loại thu, chi; nối quy tắc ghi sổ theo khoản mục |
| Kí nội bộ | Xác nhận kí trong phần mềm, không phải chữ ký số có giá trị pháp lý |
| Kiểm dò | Kiểm tra đủ năm mục thông tin của hồ sơ cuối cấp |
| Kiểm kê | Đợt quét bản sao để đối chiếu sổ: thiếu, thừa, hỏng |
| Kiểm thực ba bước | Kiểm tra thực phẩm khi nhập (bước 1), khi chế biến (bước 2), trước khi ăn (bước 3) theo Quyết định 1246/QĐ-BYT |
| KPI | Chỉ số đánh giá kết quả thực hiện công việc của từng cán bộ trong kỳ |
| KTĐK | Bài kiểm tra định kỳ (Tiểu học) |
| Kỳ công, bảng công | Tháng chấm công của đơn vị; chốt thì sinh bảng công từng ngày |
| Kỳ học phí, kỳ đăng ký | Một tháng dương lịch thuộc năm học đang mở |
| Ký nội bộ | Ký bằng chứng thư số nhà trường đã đăng ký trong hệ thống, không qua nhà cung cấp ký số thật |
| Kỳ tài chính | Tháng dương lịch của từng đơn vị; đã chốt thì khóa chứng từ của kỳ |
| Lấy lại | Người chuyển thu hồi lần chuyển khi người nhận chưa xử lý |
| LDTT, CSTDCS | Mã mặc định của Lao động tiên tiến, Chiến sĩ thi đua cơ sở |
| Liên thông | Gửi, nhận văn bản giữa các cơ quan qua trục văn bản; ở đây là bản chạy nội bộ |
| Liên thông nội bộ | Văn bản đi gửi đơn vị trong cây đơn vị của trường tự thành văn bản đến chờ vào sổ |
| Loại dữ liệu | `synthetic` dữ liệu giả, `consented` dữ liệu thật có đồng ý, `production` vận hành chính thức |
| Lô hàng nhập | Một dòng thực phẩm nhập có số lô, hạn dùng, nhà cung cấp, dùng để truy xuất |
| Luân chuyển | Người đang xử lý giao đúng vai của mình cho một người khác |
| Luồng duyệt | Cách duyệt của thư mục: không duyệt, tổ trưởng duyệt, tổ trưởng rồi Ban Giám hiệu duyệt |
| Luồng rủi ro | Học liệu phải thêm bước Ban Giám hiệu duyệt (video, liên kết ngoài, giấy phép có xin phép, loại do trường chọn) |
| Lưu kho | Bản PDF kế hoạch đã duyệt được ghi thành hồ sơ đã duyệt trong kho hồ sơ chuyên môn |
| Mã BIN ngân hàng | Mã ngân hàng dùng để dựng mã VietQR tĩnh |
| Mã Bộ | Mã định danh của Bộ Giáo dục và Đào tạo trong hồ sơ nhân sự |
| Mã đề | Bản trộn của đề, đánh số 101, 102, ... |
| Mã gói tin | Mã một lần chuyển hồ sơ (`GT-...`) hoặc hủy nhập học (`HN-...`) |
| Mã làm mới | Chuỗi bí mật trong cookie httpOnly để cấp mã phiên mới |
| Mã phiên | JWT ngắn hạn 15 phút ký Ed25519 |
| Mã quyền | Chuỗi `Pxx.<đối tượng>.<thao tác>`; P01 đến P19 là nhóm chức năng cũ |
| Mã tra cứu | Mã 12 chữ cái và chữ số in trên giấy khen, tra công khai ở `/tra-cuu-khen-thuong` |
| Ma trận đề, bảng đặc tả | Bảng chủ đề × mức × dạng, số câu, điểm, yêu cầu cần đạt |
| Mã xác nhận (captcha) | Ảnh chữ ở trang đăng nhập cổng quản trị |
| Mẫu lịch | Bộ dòng lịch theo thứ và buổi để áp vào một tuần |
| MG, MP | Mã màn hình ứng dụng giáo viên, ứng dụng phụ huynh trong tài liệu 14 |
| MH | Mã màn hình cổng quản trị và màn hình dùng chung trong tài liệu 14 |
| Miễn giảm, phiếu điều chỉnh | Giảm trừ trên hóa đơn theo loại cấu hình; điều chỉnh tăng hoặc giảm hóa đơn đã phát hành có lý do |
| Minh chứng, mã Hn-a.b-c | Tài liệu chứng minh cho tiêu chí; H là hộp, a.b mã tiêu chí, c số thứ tự hai chữ số |
| MN, TH, THCS, THPT | Mầm non, Tiểu học, Trung học cơ sở, Trung học phổ thông |
| Môn chủ chốt | Toán, Ngữ văn trong cấu hình sổ điểm (`key_subject_codes`) |
| Mở khóa, gửi lại | Biểu đã gửi bị khóa; yêu cầu mở khóa được duyệt thì chuyển "Cần gửi lại" |
| Mục lá | Mục menu có đường dẫn trang |
| Mức cuối cùng | `final_rank` chốt khi khóa kỳ |
| Mức đạt | Mức 1 đến Mức 4 (tối đa theo số mức của bộ), 0 là Chưa đạt |
| Mức nhận thức | Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao |
| Năng lực số | Khung năng lực số giáo viên gồm miền và mức; giáo viên tự đánh giá, tổ trưởng hoặc Ban Giám hiệu xác nhận |
| Ngày chốt | Ngày trong tháng trước kỳ (mặc định 25) sau đó đăng ký, hủy dịch vụ là trễ |
| Ngày công chuẩn | Số ngày làm việc của tháng theo lịch, dùng chia lương ngày |
| Nguồn việc (`MyWorkSource`) | Lớp ở máy chủ của mỗi phân hệ trả các việc đang chờ người dùng cho Việc của tôi |
| Người vận hành nền tảng | Tài khoản `platform_operators`, không thuộc trường nào |
| Ngưỡng gợi ý | Mức năng lực số mà miền thấp hơn thì hệ thống gợi ý chuyên đề bồi dưỡng |
| Nhánh | Loại kho của thư mục, hồ sơ: `personal`, `group`, `school` |
| Nhóm công khai | Nhóm nội dung phải công khai theo Thông tư 09/2024/TT-BGDĐT |
| Nhóm công tác | Nhóm cán bộ ngoài tổ chuyên môn, có trưởng nhóm duyệt thay tổ trưởng |
| Nhóm đối tượng | `leader` Lãnh đạo, quản lý; `staff` Cán bộ, viên chức |
| Nhóm người dùng | Tên trên giao diện của vai trò (`roles`); vai trò hệ thống không xóa được |
| NLS | Năng lực số (mã miền NLS-1 đến NLS-6) |
| Nộp trễ | Hồ sơ nộp lần đầu sau hạn nộp của đợt |
| OA | Official Account của Zalo |
| OMR | Nhận dạng phiếu trả lời từ ảnh, chưa làm |
| OTP, mã một lần | Mã 6 chữ số gửi SMS để phụ huynh đăng nhập |
| Ô bẫy | Ô ẩn `website` ở biểu mẫu liên hệ, có chữ thì coi là gửi tự động |
| P05, P06, P08, P12 đến P18 | Mã nhóm quyền: học phí, tài chính, chấm công và lương, bếp, kho, hoạt động, tương tác, tuyển sinh, báo cáo, tuyển dụng |
| Phạm vi cấp | Các cấp học tài khoản được xem; trống là mọi cấp |
| Phạm vi đơn vị | Đơn vị gắn với từng lần gán vai trò; gồm đơn vị cấp dưới |
| Phạm vi xem | Cá nhân (`private`), Tổ (`unit`), Toàn trường (`school`); Liên trường (`network`) chưa bật |
| Phân hệ (workspace) | Một bộ menu ngang đánh số của cổng quản trị, chọn ở ô phân hệ; 21 phân hệ, khóa như `education`, `finance` |
| Phân quyền nhóm theo menu | Ma trận mã quyền của nhóm hiển thị theo cây menu (1.3) |
| Phân quyền nhóm theo phần mềm | Chọn phân hệ nhóm được thấy (1.2); chỉ ảnh hưởng menu, không cấp quyền thao tác |
| Phân tuyến | Danh sách học sinh được phân về trường theo địa bàn, nhập từ Excel |
| PHHS | Phụ huynh học sinh |
| Phiên bản | Mỗi lần tải tệp hồ sơ hoặc mỗi lần trình kế hoạch tạo một bản lưu riêng, giữ bản cũ |
| Phiên bản học liệu | Mỗi lần thêm tệp, liên kết, kế hoạch bài dạy |
| Phiên bản quy tắc | Một bản cấu hình JSON của bộ quy tắc; kỳ giữ phiên bản đã áp |
| Phiên gốc | Phiên đăng nhập của quản trị trước khi đăng nhập thay, giữ nguyên để quay lại |
| Phiếu đánh giá tiêu chí | Phiếu của mỗi tiêu chí: hiện trạng, điểm mạnh, điểm yếu, kế hoạch cải tiến, chỉ báo đạt, mức |
| Phiếu đảo | Chứng từ hủy tác dụng phiếu thu, phiếu chi đã phát hành, cần duyệt |
| Phiếu kín | Lựa chọn của từng thành viên hội đồng chỉ chính người đó thấy; kết quả chỉ ghi số phiếu |
| Phông lưu trữ | Toàn bộ tài liệu lưu trữ của một đơn vị; báo cáo theo mét giá |
| Phúc khảo, khiếu nại | Phúc khảo: đề nghị xét lại kết quả bình xét của một hồ sơ; khiếu nại: ý kiến về đợt, có thể không gắn hồ sơ |
| Phương án | Một kết quả của máy xếp (tối đa 5 mỗi lần xếp) kèm điểm phạt và vi phạm |
| PQ, BR, MH, CT | Mã phân quyền (tài liệu 08), quy tắc nghiệp vụ (07), màn hình (14), kịch bản kiểm thử |
| QR, Crockford base32 | Mã tem thiết bị "TB-" + 10 ký tự trong bảng chữ số không dễ nhầm |
| Quyết toán | Bảng tính lương cuối cùng khi chấm dứt hợp đồng |
| Ràng buộc cứng, mềm | Của máy xếp: cứng mỗi vi phạm 1000 điểm phạt; mềm nhân mức quan trọng 0 đến 10 |
| Rubric | Bảng tiêu chí × mức điểm dùng chấm bài tự luận, sản phẩm học tập |
| Sao đỏ | Đội học sinh chấm nề nếp lớp khác (THCS, THPT) |
| SDD | Suy dinh dưỡng (nhẹ cân, thấp còi, gầy còm) |
| SHA-256 | Mã băm kiểm tính toàn vẹn của tệp |
| Slug | Đường dẫn không dấu của bài, album trên trang công khai |
| Số dư có | Tiền đã thu chưa phân bổ vào hóa đơn, dùng cho kỳ sau hoặc hoàn tiền |
| Sổ đăng ký cá biệt | Danh sách mọi bản sao kể cả đã mất, thanh lý; xuất Excel, PDF |
| Số đăng ký cá biệt | Mã duy nhất của bản sao dạng `SH-nnnnnn`, in trên tem QR |
| Số ĐDCN | Số định danh cá nhân 12 chữ số |
| Số đến, số đi | Số thứ tự của văn bản trong sổ văn bản đến, sổ văn bản đi |
| Số eOffice | Số phần mềm cấp tăng dần cho mỗi dự thảo văn bản đi |
| Sổ kép, bút toán | Ghi sổ Nợ, Có cân nhau; bút toán tự động sinh từ chứng từ, bút toán thủ công do kế toán ghi |
| Sổ khen thưởng | Bảng `emulation_awards` mọi năm học, gồm dòng từ quyết định và dòng nhập tay |
| Số ký hiệu | Số và ký hiệu của văn bản; văn bản đi có dạng "số/phần ký hiệu" |
| Sổ trách nhiệm chấm, duyệt | Thống kê việc duyệt, chấm đúng hạn, quá hạn, hệ thống tự xử lý của từng người quản lý |
| Tác vụ xuất nền | Lần xuất lớn chạy ở tiến trình nền của máy chủ API, kết quả ở 3.5 Tệp đã tạo |
| TBDH | Thiết bị dạy học |
| Tên miền chính, phụ, trình diễn | `primary` tên miền phục vụ trang; `alias` chuyển hướng về tên miền chính; `demo` tên miền giả lập để trình diễn |
| Thẻ bạn đọc | Thẻ thư viện của cán bộ hoặc học sinh, số thẻ `TV-nnnnnn` |
| Thông báo hệ thống | Bài bật lên khi vào cổng quản trị, khác thông báo nghiệp vụ |
| Thủ kho | Người có `P09.learning-resource.manage` |
| Thuê bao (tenant), trường | Một trường trên nền tảng, có mã, tên miền, bộ cơ sở dữ liệu riêng |
| Thư viện mẫu kế hoạch | Mẫu kế hoạch giáo dục theo cấp học gồm mục, cột, bước duyệt, cờ kí, thư mục lưu kho |
| Tỉ lệ đồng ý | Số phiếu đồng ý chia tổng số thành viên hội đồng (không chia số có mặt), hai chữ số thập phân |
| Tick | Lượt chạy của bộ lập lịch việc nền; điểm cuối cho bộ lập lịch bên ngoài gọi |
| Tiết ghi nhận | Số tiết bồi dưỡng được tính cho một đăng ký sau khi có kết quả |
| Tiết nhóm | Tiết có số nhóm 1 đến 9, học môn lựa chọn theo nhóm, cùng ô với nhóm khác của lớp |
| Tiết thực tế | Tiết theo bản đang áp dụng sau khi thay bằng dạy thay, đổi tiết của ngày |
| Tổ hợp môn | Nhóm 4 môn lựa chọn của học sinh THPT, thuộc ít nhất 2 nhóm môn |
| Tờ trình | Văn bản trường đề nghị cấp trên khen danh hiệu, hình thức thuộc cấp trên quyết định |
| Trả trước, điều chỉnh | Lương tháng M trả đầu tháng M; phần điều chỉnh theo công tháng M−1 |
| Trích yếu | Tóm tắt nội dung văn bản |
| Trình lãnh đạo | Văn thư chuyển văn bản cho người ở danh sách lãnh đạo nhận văn bản |
| Trục | Nhóm nhiệm vụ để phân loại việc trong bộ quy tắc |
| Trục Edoc | Trục liên thông văn bản điện tử; chưa kết nối |
| Truy cập nhanh | Lối tắt tới tối đa 12 trang ghim trên trang chủ |
| Trường hợp loại trừ | Tình huống buộc xếp mức thấp nhất (ví dụ bị kỷ luật trong kỳ) |
| Trường số 1 | Bản triển khai cũ nhận vào nền tảng bằng `adopt-existing`, tiền tố khóa trống |
| Trường tiên tiến | Loại đợt tuyển sinh `advanced` cần trường xác nhận hồ sơ |
| TT22 | Thông tư 22/2021/TT-BGDĐT, đánh giá học sinh THCS, THPT |
| TT27 | Thông tư 27/2020/TT-BGDĐT, đánh giá học sinh tiểu học |
| Tuyển sinh nội bộ | Đợt tuyển sinh do trường tự mở (`admissions`), khác Tuyển sinh đầu cấp theo Sở (`entry-admissions`) |
| Tỷ lệ xuất sắc | Số người tối đa được xếp Hoàn thành xuất sắc trên số người làm gốc |
| Ủy quyền chấm | Người quản lý giao quyền chấm việc cho một người khác, vượt cấp |
| Vào sổ | Văn thư ghi văn bản đến vào sổ văn bản đến, được cấp số đến |
| VietQR, cổng thanh toán | Chuẩn mã QR chuyển khoản; PayOS, SePay, Casso, VNPay, cổng giả lập `development` |
| Việc của tôi | Danh sách gom mọi việc đang chờ chính người dùng ở các phân hệ, có số đếm trên menu và đầu trang |
| Việc phát sinh | Việc lập sau ngày kết thúc đăng ký của lịch kỳ, chỉ tính vào B |
| VNeID | Ứng dụng định danh điện tử; nơi ở hiện tại nhập theo VNeID |
| VNPT iOffice | Hệ thống quản lý văn bản và điều hành mà các trường công lập TP.HCM đang dùng; phân hệ làm theo menu, biểu mẫu của hệ thống này |
| VT | Mã vai trò người dùng (tài liệu 08) |
| VT-17 | Vai trò Tổ trưởng chuyên môn |
| VT-xx | Mã vai trò theo tài liệu 08 |
| Worker | Tiến trình chạy nền `apps/worker`, chạy máy xếp |
| Xem để biết | Vai nhận văn bản chỉ để biết, mở văn bản là xong |
| Xếp loại tiết | A, B, C, D do giáo viên ghi ở sổ đầu bài, quy tắc theo cấp |
| XLC, PH, QH, ĐH | Ký hiệu trên danh sách: Xử lý chính, Phối hợp, Quá hạn, Đến hạn |
| Xung đột cứng, mềm | Lỗi chặn ban hành; cảnh báo không chặn |
| YCTD | Yêu cầu thay đổi (tài liệu 24) |
| YCTD-142, YCTD-147, YCTD-182 | Mã yêu cầu thay đổi của hồ sơ chuyên môn và Việc của tôi, kế hoạch giáo dục, hồ sơ bồi dưỡng |
| Z-score, LMS | Điểm chuẩn hóa theo chuẩn WHO, tính từ ba tham số L, M, S |
