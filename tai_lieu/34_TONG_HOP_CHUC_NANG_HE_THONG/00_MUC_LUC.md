# 34. TỔNG HỢP CHỨC NĂNG HỆ THỐNG SCHOOL MANAGEMENT

- Mô tả: Mô tả chi tiết toàn bộ chức năng đang có của hệ thống School Management (Mầm non, Tiểu học, THCS, THPT): 21 phân hệ của cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh, quản trị nền tảng DT-SaaS; kèm sơ đồ quy trình bằng Mermaid, ma trận vai trò × phân hệ, bảng tra nhanh, chỗ lệch giữa tài liệu và mã, thuật ngữ
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-25
- Trạng thái: Chờ phê duyệt
- Căn cứ: yêu cầu của Eric ngày 2026-10-25 viết tài liệu tổng hợp chức năng kèm sơ đồ quy trình
- Nguồn: mã và tài liệu trên nhánh `main` ngày 2026-10-25, sau PR 165 (DT-SaaS phần S2), PR 166 (phần S1b), PR 167 (phần S9) và PR 169 (phần S3). Mô tả theo mã đang chạy, không theo kế hoạch chưa làm. Phần DT-SaaS chưa có mã ghi rõ là đang làm hoặc kế hoạch

## 1. Cách đọc

1. Tài liệu chia thành tám tệp vì quá dài cho một tệp (khoảng 6.000 dòng). Tệp 01 đọc trước: tổng quan, kiến trúc, đăng nhập, phân quyền, thông báo, DT-SaaS.
2. Các tệp 02 đến 06 mô tả từng phân hệ theo cùng khuôn: mục đích, cấp học, vai trò và mã quyền, căn cứ pháp lý, chức năng và màn hình (mục menu, đường dẫn, nút, mã MH), quy tắc nghiệp vụ (mã BR), dữ liệu và tệp xuất, liên kết với phân hệ khác, spec e2e. Sơ đồ quy trình đặt ở cuối mỗi tệp.
3. Số phân hệ 2.1 đến 2.21 theo thứ tự trong `PORTAL_WORKSPACES` (`packages/shared/src/portal-menu.ts`). Số mục menu (1.1., 4.1.1....) là số hiện trên cổng quản trị.
4. Khi tài liệu gốc (07, 08, 10, 11, 14, 32, QT) và mã lệch nhau, tài liệu này ghi theo mã; mọi chỗ lệch gom ở tệp 07, phụ lục B.
5. Ma trận quyền là quyền mặc định khi khởi tạo trường (seed của dịch vụ định danh). Quản trị trường chỉnh được ở Quản trị hệ thống 1.2, 1.3, nên dữ liệu của từng trường có thể khác.
6. Tài liệu không chứa dữ liệu cá nhân thật, khoá hay mật khẩu. Văn bản hạn chế phát tán chỉ ghi số hiệu, không chép nội dung.

## 2. Danh sách tệp

| Số | Tệp | Nội dung |
|---|---|---|
| 34.1 | [01_TONG_QUAN_VA_NEN_TANG.md](01_TONG_QUAN_VA_NEN_TANG.md) | Mục tiêu, đối tượng dùng, cấp học, kiến trúc (ứng dụng, cơ sở dữ liệu, tác vụ nền), thống kê nhanh; đăng nhập, phiên, vai trò, phân quyền, chọn phân hệ; thông báo; DT-SaaS đa thuê bao |
| 34.2 | [02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) | 2.1 Quản lý giáo dục nhóm 1 đến 6 (trường, lớp, nhân sự, học sinh, y tế, điểm danh, bán trú, công cụ hỗ trợ, cơ sở vật chất); 2.2 Cơ sở vật chất, TBDH; 2.3 Tuyển sinh đầu cấp; 2.4 Báo cáo số liệu EMIS; 2.5 Kí hồ sơ |
| 34.3 | [03_DAY_HOC_VA_KIEM_TRA_DANH_GIA.md](03_DAY_HOC_VA_KIEM_TRA_DANH_GIA.md) | 2.1 nhóm 7 Dạy học (môn, phân công, thời khoá biểu, máy xếp, sổ đầu bài, TT27, sổ điểm TT22, học bạ số, lên lớp, tốt nghiệp, báo cáo Tiểu học, THCS, THPT); nhóm 8 Kiểm tra, đánh giá |
| 34.4 | [04_DIEU_HANH_VA_QUAN_TRI.md](04_DIEU_HANH_VA_QUAN_TRI.md) | 2.6 Văn bản và điều hành; 2.7 Quản trị hệ thống; 2.15 KPI; 2.16 Website trường; 2.17 Hồ sơ chuyên môn (kế hoạch giáo dục, bồi dưỡng); 2.18 Thi đua, khen thưởng; 2.19 Bảo đảm chất lượng |
| 34.5 | [05_TAI_CHINH_NHAN_SU_HAU_CAN.md](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) | 2.8 Tài chính, học phí; 2.9 Nhân sự, chấm công, lương; 2.10 Bếp, kho, mua hàng, an toàn thực phẩm; 2.11 Tương tác, truyền thông; 2.12 Giảng dạy; 2.13 Tuyển sinh, tuyển dụng; 2.14 Báo cáo |
| 34.6 | [06_THU_VIEN_HOC_LIEU_VA_UNG_DUNG.md](06_THU_VIEN_HOC_LIEU_VA_UNG_DUNG.md) | 2.20 Thư viện; 2.21 Kho học liệu; 3 Ứng dụng giáo viên và ứng dụng phụ huynh theo màn hình |
| 34.7 | [07_MA_TRAN_VAI_TRO_VA_PHU_LUC.md](07_MA_TRAN_VAI_TRO_VA_PHU_LUC.md) | Ma trận vai trò × phân hệ; phụ lục A bảng tra nhanh 278 mục menu; phụ lục B chỗ lệch giữa tài liệu và mã; phụ lục C thuật ngữ |

## 3. Danh sách 21 phân hệ

| Số | Phân hệ | Khoá | Cấp học | Số mục lá | Tệp |
|---|---|---|---|---|---|
| 2.1 | Quản lý giáo dục (tên đổi theo cấp, trường chỉ có Mầm non giữ "Quản lý giáo dục Mầm non") | `education` | Mọi cấp; nhóm 7 TH, THCS, THPT; nhóm 8 THCS, THPT; một số mục riêng MN hoặc TH | 76 | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md), [03](03_DAY_HOC_VA_KIEM_TRA_DANH_GIA.md) |
| 2.2 | Quản lý cơ sở vật chất, TBDH | `facilities` | Mọi cấp | 8 | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) |
| 2.3 | Tuyển sinh đầu cấp | `entry-admissions` | Mọi cấp; 1.1 chỉ MN | 15 | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) |
| 2.4 | Báo cáo số liệu | `emis` | Mọi cấp; biểu EMIS đầu năm, cuối năm, giáo dục mầm non chỉ MN | 8 | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) |
| 2.5 | Quản lý kí hồ sơ | `signing` | Mọi cấp | 4 | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) |
| 2.6 | Quản lý văn bản và điều hành | `documents` | Mọi cấp | 32 | [04](04_DIEU_HANH_VA_QUAN_TRI.md) |
| 2.7 | Quản trị hệ thống | `system` | Mọi cấp | 20 | [04](04_DIEU_HANH_VA_QUAN_TRI.md) |
| 2.8 | Tài chính – học phí | `finance` | Mọi cấp | 15 | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) |
| 2.9 | Nhân sự – chấm công, lương | `personnel` | Mọi cấp | 12 | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) |
| 2.10 | Bếp – kho, mua hàng | `logistics` | Mọi cấp | 7 | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) |
| 2.11 | Tương tác – truyền thông | `interaction` | Mọi cấp | 2 | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) |
| 2.12 | Giảng dạy | `teaching` | Mọi cấp | 1 | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) |
| 2.13 | Tuyển sinh, tuyển dụng | `admissions` | Mọi cấp | 2 | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) |
| 2.14 | Báo cáo | `reports` | Mọi cấp | 1 | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) |
| 2.15 | Đánh giá KPI | `kpi` | Mọi cấp | 13 | [04](04_DIEU_HANH_VA_QUAN_TRI.md) |
| 2.16 | Website trường | `website` | Mọi cấp | 9 | [04](04_DIEU_HANH_VA_QUAN_TRI.md) |
| 2.17 | Hồ sơ chuyên môn | `professional-records` | Mọi cấp | 20 | [04](04_DIEU_HANH_VA_QUAN_TRI.md) |
| 2.18 | Thi đua, khen thưởng | `emulation` | Mọi cấp | 11 | [04](04_DIEU_HANH_VA_QUAN_TRI.md) |
| 2.19 | Bảo đảm chất lượng | `quality-assurance` | Mọi cấp | 5 | [04](04_DIEU_HANH_VA_QUAN_TRI.md) |
| 2.20 | Thư viện | `library` | Mọi cấp | 7 | [06](06_THU_VIEN_HOC_LIEU_VA_UNG_DUNG.md) |
| 2.21 | Kho học liệu | `learning-resources` | Mọi cấp | 10 | [06](06_THU_VIEN_HOC_LIEU_VA_UNG_DUNG.md) |

Ngoài 21 phân hệ còn ba kênh: ứng dụng giáo viên, ứng dụng phụ huynh ([tệp 06](06_THU_VIEN_HOC_LIEU_VA_UNG_DUNG.md) mục 3) và trang quản trị nền tảng `apps/platform` của DT-SaaS ([tệp 01](01_TONG_QUAN_VA_NEN_TANG.md) mục 4).

## 4. Chỉ mục sơ đồ quy trình

Tài liệu có 77 sơ đồ Mermaid (flowchart, sequenceDiagram, stateDiagram-v2), đã dựng thử bằng Mermaid 11.4.1, không có lỗi cú pháp. Bảng dưới là các luồng chính theo yêu cầu; các sơ đồ trạng thái phụ xem cuối từng tệp.

| Luồng | Tệp | Mục |
|---|---|---|
| Kiến trúc hệ thống | [01](01_TONG_QUAN_VA_NEN_TANG.md) | 1.3 Kiến trúc tóm tắt |
| Đăng nhập, phân quyền và chọn phân hệ | [01](01_TONG_QUAN_VA_NEN_TANG.md) | 2. Sơ đồ (sequence đăng nhập, flowchart chọn phân hệ) |
| Thông báo cho phụ huynh | [01](01_TONG_QUAN_VA_NEN_TANG.md) | 3. Sơ đồ "Thông báo cho phụ huynh" |
| Vòng đời trường trong DT-SaaS | [01](01_TONG_QUAN_VA_NEN_TANG.md) | 4. Sơ đồ "Vòng đời trường trong DT-SaaS" |
| Hồ sơ triển khai thử nghiệm DT-SaaS (S9) | [01](01_TONG_QUAN_VA_NEN_TANG.md) | 4. Hồ sơ triển khai thử nghiệm (S9) |
| Tuyển sinh đầu cấp và nhập học | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) | Sơ đồ 1 |
| Tuyển sinh nội bộ của trường | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) | Sơ đồ 6 |
| Điểm danh hằng ngày, báo vắng, đón trả (Mầm non) | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) | Sơ đồ 2 |
| Báo cáo EMIS gửi Sở cùng kí hồ sơ | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) | Sơ đồ 3 |
| Chuyển hồ sơ lên năm học mới | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) | Sơ đồ 4 |
| Dặn thuốc | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) | Sơ đồ 5 |
| Kiểm kê thiết bị | [02](02_QUAN_LY_GIAO_DUC_CSVC_EMIS.md) | Sơ đồ 6 |
| Xếp thời khoá biểu, máy xếp, dạy thay | [03](03_DAY_HOC_VA_KIEM_TRA_DANH_GIA.md) | Sơ đồ 1 |
| Sổ đầu bài và chuyên cần theo tiết | [03](03_DAY_HOC_VA_KIEM_TRA_DANH_GIA.md) | Sơ đồ 2 |
| Đánh giá theo TT27 (Tiểu học) | [03](03_DAY_HOC_VA_KIEM_TRA_DANH_GIA.md) | Sơ đồ 3 |
| Nhập điểm và đánh giá theo TT22 (THCS, THPT) | [03](03_DAY_HOC_VA_KIEM_TRA_DANH_GIA.md) | Sơ đồ 4 |
| Học bạ số, xét lên lớp, xét tốt nghiệp | [03](03_DAY_HOC_VA_KIEM_TRA_DANH_GIA.md) | Sơ đồ 5 |
| Kiểm tra, đánh giá: ra đề, chấm, chuyển điểm | [03](03_DAY_HOC_VA_KIEM_TRA_DANH_GIA.md) | Sơ đồ 6 |
| Văn bản đến | [04](04_DIEU_HANH_VA_QUAN_TRI.md) | Văn bản đến: trạng thái, luồng nghiệp vụ |
| Văn bản đi | [04](04_DIEU_HANH_VA_QUAN_TRI.md) | Văn bản đi: trạng thái, cấp số, phát hành và liên thông |
| Giao việc | [04](04_DIEU_HANH_VA_QUAN_TRI.md) | Giao việc: trạng thái, luồng nghiệp vụ |
| Đăng nhập thay, xuất toàn bộ dữ liệu | [04](04_DIEU_HANH_VA_QUAN_TRI.md) | Luồng đăng nhập thay; Luồng xuất toàn bộ dữ liệu |
| KPI: giao việc, chấm, tự đánh giá, xếp loại, biểu quyết | [04](04_DIEU_HANH_VA_QUAN_TRI.md) | Sơ đồ KPI và hai sơ đồ trạng thái |
| Duyệt hồ sơ chuyên môn, kế hoạch giáo dục | [04](04_DIEU_HANH_VA_QUAN_TRI.md) | Duyệt hồ sơ chuyên môn; Duyệt kế hoạch giáo dục nhiều bước |
| Thi đua, khen thưởng | [04](04_DIEU_HANH_VA_QUAN_TRI.md) | Thi đua: từ đăng ký đến quyết định khen thưởng |
| Bảo đảm chất lượng, tự đánh giá | [04](04_DIEU_HANH_VA_QUAN_TRI.md) | Đợt tự đánh giá bảo đảm chất lượng |
| Bán trú và thu phí | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) | Sơ đồ 1 |
| Hoá đơn, phiếu thu, phiếu chi, hạn mức phê duyệt | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) | Sơ đồ 2 |
| Chấm công, nghỉ phép, tính lương | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) | Sơ đồ 3 |
| Kiểm thực ba bước, truy xuất nguồn gốc | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) | Sơ đồ 4 |
| Đăng hoạt động, duyệt, công bố cho phụ huynh | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) | Sơ đồ 5 |
| Mua hàng và nợ nhà cung cấp | [05](05_TAI_CHINH_NHAN_SU_HAU_CAN.md) | Sơ đồ 7 |
| Thư viện: mượn, trả, đặt trước, quá hạn | [06](06_THU_VIEN_HOC_LIEU_VA_UNG_DUNG.md) | Thư viện |
| Kho học liệu: đóng góp, duyệt, công bố, chia sẻ liên trường | [06](06_THU_VIEN_HOC_LIEU_VA_UNG_DUNG.md) | Kho học liệu |
| Điều hướng ứng dụng giáo viên, ứng dụng phụ huynh | [06](06_THU_VIEN_HOC_LIEU_VA_UNG_DUNG.md) | Điều hướng ứng dụng |

## 5. Những điểm cần chủ dự án lưu ý

Rút từ phụ lục B; chi tiết và vị trí trong mã xem [tệp 07](07_MA_TRAN_VAI_TRO_VA_PHU_LUC.md).

1. Migration KPI `database/school-year/migrations/0064_create_kpi.ts` chứa nguyên câu chữ tiêu chí chung lấy từ hướng dẫn 06-HD/BTCTU, trong khi tài liệu 32 (phần 18d) yêu cầu chỉ đưa tham số, không đưa nguyên văn tài liệu hạn chế vào kho công khai. Cần Eric xác nhận.
2. Tên bộ tài liệu (`index.md`, tài liệu 04) vẫn ghi "Hệ thống quản lý trường mầm non"; `index.md` và 05 vẫn ghi 19 phân hệ, mã có 21 phân hệ và bốn cấp học.
3. Không có kết nối thật lên CSDL của Bộ, Sở: các mục "gửi lên cấp trên" xuất tệp để nộp bằng tay; kí hồ sơ là kí nội bộ, không phải chữ ký số.
4. Thông báo chỉ có ba kênh trong mã: trong ứng dụng, SMS, Zalo (lỗi thì gửi SMS). Không có thư điện tử, không có thông báo đẩy như sơ đồ ở tài liệu 12.
5. Quy tắc người lập không tự duyệt (BR-78) chưa kiểm ở miễn giảm, điều chỉnh hoá đơn, đảo phiếu thu, duyệt bảng lương, quyết toán.
6. Gợi ý xếp loại học tập theo TT22 trong mã có điều kiện môn Toán hoặc Ngữ văn và quy tắc "một môn nhận xét Chưa đạt thì Chưa đạt", cần đối chiếu lại với Điều 9 Thông tư 22/2021/TT-BGDĐT.
7. Danh mục thiết bị tối thiểu, chuẩn nghề nghiệp, mẫu kế hoạch giáo dục, bộ tiêu chuẩn bảo đảm chất lượng mới có dữ liệu cho Mầm non.
8. Mã còn dẫn Nghị định 13/2023/NĐ-CP, văn bản tài liệu 24 ghi đã hết hiệu lực từ 01/01/2026.
