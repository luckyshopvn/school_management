---
yctd: YCTD-385
tieu_de: Biểu thống kê Thông tư 25/2024, lát L1: khung biểu nhiều phần, biểu 02.ĐN-TH và 02.CN-TH
ngay: 2026-10-30
phien_ban_de_xuat: 0.253.0
---

## 02 Nhật ký

### 2026-10-30 — Biểu thống kê Thông tư 25/2024, lát L1: khung biểu nhiều phần, biểu 02.ĐN-TH và 02.CN-TH (YCTD-385)

#### Công việc đã thực hiện

- Database migration hệ thống 0134: `report_forms` thêm `source` (`custom`, `tt25`, `eqms`), `form_number`, `sections` (JSON các phần, mỗi phần bộ cột riêng, có lặp theo nhóm loại hình), `archived`; kỳ thêm `mid_year`; `report_form_rows` thêm `section`. Nạp 02.ĐN-TH (164 mã) và 02.CN-TH (76 mã) chép từ bản gốc Thông tư 25/2024 (`database/system/data/tt25-tieu-hoc.ts`); hai biểu khung Tiểu học cũ đổi tên "(khung cũ)" và ẩn, số đã nhập giữ nguyên.
- Công thức (`packages/shared/src/primary-reports.ts`) thêm đối tượng `school`, `sites`, `staff`, `rooms`, `leavers`; điều kiện học sinh: tuổi (`age`, `age_under`, `age_over`), mới tuyển, lưu ban năm trước, dạng khuyết tật, dân tộc học bán trú, học lại hoặc thi lại trong hè, chuyển đến từ tỉnh khác; lớp ghép, lớp trong trường nhiều cấp; dòng cộng `rows:` gồm cả dòng nhập tay. Đội ngũ chỉ đếm người đang làm việc, trừ dòng nghỉ hưu, nghỉ, chuyển đi.
- Máy chủ API: số liệu nền mới ở `apps/api/src/primary-reports/tt25-facts.ts`; biểu đã tính trả phần, cột theo loại hình của trường; số nhập tay lưu theo phần; biểu pháp định không cho thay khung; xuất Excel mỗi phần một trang, đủ ba nhóm cột Tổng số, Công lập, Tư thục.
- Cổng quản trị 7.15: chọn phần của biểu, tiêu đề nhóm cột theo loại hình, cột Chỉ tiêu cố định khi cuộn ngang, nhãn "Nhập tay".
- Kiểm thử: CT-1880 đến CT-1886 (`apps/api/src/primary-reports/tt25-bieu.test.ts`).

#### Quyết định

- Eric ngày 2026-10-30: tuổi tính theo năm sinh (năm đầu của năm học trừ năm sinh), Q-385-3.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: phần của biểu lưu ở cột JSON `sections` cùng kiểu với `columns` có sẵn, thay bảng riêng ghi ở đặc tả L0; trường nhiều cấp đếm giáo viên theo cấp có lớp được phân công, người không dạy lớp đếm ở cấp thấp nhất; dạng khuyết tật so khớp chữ ở ô "Loại khuyết tật", không khớp là "khác"; dòng trình độ đào tạo (sư phạm hay có chứng chỉ bồi dưỡng nghiệp vụ sư phạm), đối tượng chính sách, phòng bộ môn, kiêm nhiệm, trường dạy 2 buổi, trường phổ thông dân tộc bán trú, học trực tuyến, hạ tầng cho học sinh khuyết tật, tư vấn tâm lý, sáp nhập, giải thể, chuyển ra nước ngoài, bồi dưỡng là nhập tay vì hồ sơ chưa có mã tương ứng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-385, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` mục 7.15, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`.

#### Vấn đề tồn đọng

- Lát L1 mức Lớn: chờ Eric (hoặc phiên điều phối theo ủy quyền) nghiệm thu trước khi gộp.
- Dòng nhập tay sẽ tính được khi hồ sơ có danh mục mã (trình độ tách sư phạm, đối tượng chính sách Tiểu học, vị trí việc làm phổ thông, loại phòng bộ môn): đề xuất làm cùng L9 đối chiếu Quyết định 4998.

## 24 Yêu cầu thay đổi

### YCTD-385: Biểu thống kê Thông tư 25/2024, lát L1: khung biểu nhiều phần, biểu 02.ĐN-TH và 02.CN-TH – 2026-10-30

- Lý do: lát L1 của YCTD-385 (danh sách lát đã duyệt ngày 2026-10-30).
- Nội dung thay đổi: khung biểu nhiều phần, công thức mới, nạp hai biểu Tiểu học theo Thông tư 25/2024, giao diện chọn phần, xuất Excel đủ cột mẫu.
- Thành phần bị ảnh hưởng: `database/system/migrations/0134_add_report_form_sections.ts` (mới), `database/system/data/tt25-tieu-hoc.ts` (mới), `database/system/schema-parts/yctd-385-bieu-thong-ke.ts` (mới), `database/system/schema.ts`, `packages/shared/src/primary-reports.ts`, `apps/api/src/primary-reports/primary-emis.ts`, `apps/api/src/primary-reports/tt25-facts.ts` (mới), `apps/portal/src/primary-reports/PrimaryReportsPage.tsx`, `apps/portal/src/primary-reports/primary-reports-api.ts`; tài liệu 11, 14, 16, 17, 21.
- Dữ liệu bị ảnh hưởng: database migration hệ thống 0134 thêm cột, nạp hai biểu, đổi tên và ẩn hai biểu khung cũ; số đã nhập của biểu cũ giữ nguyên (phần `main`).
- API bị ảnh hưởng: `/api/v1/primary-reports/emis` và `/secondary-reports/emis` trả thêm trường, nhận `?archived=true`; thay khung biểu pháp định trả 422.
- Quyền bị ảnh hưởng: không.
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-30 (danh sách lát).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: biểu thống kê Thông tư 25/2024 cấp Tiểu học 02.ĐN-TH, 02.CN-TH trên khung biểu nhiều phần (YCTD-385 lát L1).
- Quay lui: chạy `down` của database migration hệ thống 0134 (xóa biểu `tt25`, khôi phục tên và hiện hai biểu khung cũ, bỏ các cột mới), rồi hoàn tác commit hợp nhất của PR. Số nhập tay của biểu `tt25` ở `emis_report_values` của năm học còn lại, không ảnh hưởng biểu khác.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Biểu thống kê Thông tư 25/2024 cấp Tiểu học | YCTD-385 |

## Thêm dòng

| 16_CO_SO_DU_LIEU.md | report_forms, report_form_rows (bổ sung YCTD-175) | report_forms, report_form_rows (bổ sung YCTD-385) | Khung biểu nhiều phần cho biểu thống kê Thông tư 25/2024 (tệp hệ thống `0134`); nạp `tt25-02-dn-th`, `tt25-02-cn-th`; hai biểu khung Tiểu học cũ đổi tên "(khung cũ)", `archived` | report_forms thêm source (`custom`, `tt25`, `eqms`; mặc định `custom`), form_number, sections (JSON: code, name, columns gồm key, label, public_only; ownership_groups), archived; period thêm `mid_year`; report_form_rows thêm section (mặc định `main`). Số nhập tay ở `emis_report_values` dùng `tab_key` là mã phần |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1260 | Cho biểu 02.ĐN-TH, 02.CN-TH / Khi so với bản gốc Thông tư 25/2024 / Thì đủ 164 và 76 mã số, tên chỉ tiêu, đơn vị tính, năm phần (bốn phần ở cuối năm) với bộ cột của từng phần; chỗ nghi lỗi in giữ đúng bản in, có ghi chú (Bắt buộc; CT-1880, CT-1883, CT-1884; YCTD-385) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1261 | Cho trường có dữ liệu lớp, học sinh, cán bộ, phòng, hồ sơ trường / Khi mở biểu / Thì dòng tính được cho đúng số ở từng cột (tuổi theo năm sinh, lưu ban năm trước, dạng khuyết tật, đội ngũ theo hợp đồng, phòng theo hiện trạng), màn hình hiện nhóm cột theo loại hình của trường; dòng cộng gồm cả số nhập tay (Bắt buộc; CT-1880, CT-1881, CT-1882, CT-1884, CT-1885, CT-1886; YCTD-385) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1262 | Cho biểu pháp định / Khi nhập tay, thay khung, xuất Excel / Thì số lưu theo phần, cột ngoài phần bị từ chối; thay khung bị từ chối 422; tệp Excel mỗi phần một trang đủ ba nhóm cột Tổng số, Công lập, Tư thục, nhóm không thuộc loại hình để trống (Bắt buộc; CT-1885; YCTD-385) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1880 | P17-32 | Công thức mới: tuổi, so sánh tuổi, trường, đội ngũ, phòng; dòng cộng; công thức sai | Phân tích được; báo lỗi; đội ngũ chỉ đếm người đang làm trừ dòng nghỉ hưu; trường chỉ cột tổng | Kiểm thử đơn vị CT-1880 (`apps/api/src/primary-reports/tt25-bieu.test.ts`) | Chờ chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1881 | P17-32 | Phần đội ngũ, trường tư thục và công lập | Tư thục không có cột phân loại hợp đồng; xuất bảy cột theo ba nhóm | Kiểm thử đơn vị CT-1881 | Chờ chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1882 | P17-32 | Chữ "Khiếm thị", "Tự kỷ", "Đa tật", "Không"; vị trí "Giáo vụ", "Kế toán", "Lao công"; tuổi 19, 20, 60 | Nhìn, thần kinh tâm thần, khác, không khuyết tật; giáo vụ, kế toán, nhân viên khác; nhóm tuổi đúng | Kiểm thử đơn vị CT-1882 | Chờ chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1883 | P17-32 | Hiệu trưởng xem danh sách biểu Tiểu học, xin cả biểu ẩn; mở biểu Tiểu học ở đường THCS, THPT | Có hai biểu Thông tư 25; biểu khung cũ chỉ khi xin, tên có "(khung cũ)"; 404 | Kiểm thử đơn vị CT-1883 | Chờ chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1884 | P17-32 | Trường công lập chuẩn mức 2, một điểm trường, lớp 1 hai buổi, lớp 2 ghép, ba học sinh (một nữ dân tộc 6 tuổi, một khiếm thị), ba cán bộ, hai phòng | Đúng từng dòng 01 đến 164 đã chọn; nhóm cột Công lập; đội ngũ bảy cột | Kiểm thử đơn vị CT-1884 | Chờ chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1885 | P17-32 | Nhập tay phòng âm nhạc 2, trường 2 buổi 1; cột ngoài phần; thay khung; xuất Excel | Dòng cộng 158 = 2, 155 = 4; lưu theo phần; 400; 422 mã YCTD-165; tệp xuất được | Kiểm thử đơn vị CT-1885 | Chờ chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1886 | P17-32 | 02.CN-TH với một học sinh thôi học trong năm | Bỏ học 1 (nữ 0), quy mô 3, lớp ghép 1, vị trí dùng chung 1 | Kiểm thử đơn vị CT-1886 | Chờ chạy |
