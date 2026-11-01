---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L3: bộ tiêu chí nhiều loại, mẫu mã, bộ mẫu kiểm định đủ chỉ báo, nhập chỉ báo từ Excel
ngay: 2026-11-01
phien_ban_de_xuat: 0.263.0
---

## 02 Nhật ký

### 2026-11-01 — Kho minh chứng dùng chung, lát L3 (YCTD-396)

#### Công việc đã thực hiện

- Bộ tiêu chí có thêm loại bộ (kiểm định, chuẩn giáo viên, chuẩn hiệu trưởng, thi đua, trường học an toàn, kế hoạch năm học, khác), đối tượng được đánh giá (nhà trường hoặc cá nhân), mẫu mã minh chứng, chu kỳ đánh giá; mã minh chứng cấp theo mẫu của bộ.
- Bộ mẫu kiểm định theo Thông tư 17, 18, 19/2018/TT-BGDĐT đã sửa đổi bởi Thông tư 22/2024/TT-BGDĐT, đủ tiêu chuẩn, tiêu chí, chỉ báo Mức 1 đến Mức 3: Mầm non 22 tiêu chí, 119 chỉ báo; Tiểu học 24 tiêu chí, 126 chỉ báo; THCS và THPT 25 tiêu chí, 123 chỉ báo. Nạp lại không tạo trùng; tiêu chí chưa có chỉ báo thì được bổ sung, tiêu chí trường đã nhập chỉ báo giữ nguyên.
- Tải tệp mẫu và nhập chỉ báo từ Excel: dòng lỗi thì không ghi dòng nào; chỉ báo cùng tiêu chí, mức, mã thì sửa nội dung.
- Nội dung chỉ báo do tác tử con của phiên thu từ bản gốc và văn bản hợp nhất 11, 12, 13/VBHN-BGDĐT ngày 31/12/2024 (trang luatvietnam.vn), áp các điểm sửa của Thông tư 22/2024, đối chiếu từng chỉ báo; tập lệnh sinh tệp `packages/shared/src/quality-templates/`.

#### Quyết định

- Eric ngày 2026-11-01 chọn Q-396-15 phương án A: bộ tiêu chí giữ ở cơ sở dữ liệu năm học, thêm cột loại bộ, đối tượng, mẫu mã, chu kỳ; không làm bảng `evidence_frameworks` ở cơ sở dữ liệu hệ thống.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: bộ mẫu mới có mã `MN-KDCL-2024`, `TH-KDCL-2024`, `THCS-KDCL-2024`, `THPT-KDCL-2024`; bộ Mầm non cũ `MN-KDCL` (25 tiêu chí do Claude đặt ở YCTD-149, khác văn bản) không nạp mới, trường đã nạp vẫn giữ; gợi ý minh chứng của bộ cũ chuyển sang tiêu chí cùng mã, cùng tên. Số mức của bộ mẫu là 3; yêu cầu Mức 4 là danh sách riêng của trường, không theo tiêu chí, chưa nạp. Chỉ báo không có ký hiệu a, b, c dùng mã "yc". Màn hình bộ tiêu chí sửa tại MH-257, không tách MH-684.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-396, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `07_QUY_TAC_NGHIEP_VU.md` BR-545 đến BR-547, `11_TIEU_CHI_NGHIEM_THU.md` AC-1433 đến AC-1435, `14_DAC_TA_GIAO_DIEN.md` MH-257, `16_CO_SO_DU_LIEU.md` mục 22f, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-2144 đến CT-2146, `tai_lieu/ban_mau/yctd-396/DAC_TA.md` mục 10.2.

#### Vấn đề tồn đọng

- Nội dung chỉ báo lấy từ trang tra cứu, chưa đối chiếu bản trên cổng văn bản của Chính phủ; Thông tư 13/2025/TT-BGDĐT thay cụm "phòng giáo dục và đào tạo" ở chỉ báo 1.1 Mức 1 c của ba bộ, chưa có câu thay mới nên giữ theo Thông tư 22/2024. Trường đối chiếu văn bản hiện hành, sửa trên phần mềm hoặc nhập lại từ Excel.
- Lát L4 đến L8 chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L3: bộ tiêu chí nhiều loại, bộ mẫu kiểm định đủ chỉ báo – 2026-11-01

- Lý do: lát L3 của YCTD-396; Q-396-6 (nạp đủ chỉ báo), Q-396-15 (bộ ở cơ sở dữ liệu năm học).
- Nội dung thay đổi: loại bộ, đối tượng, mẫu mã, chu kỳ; mã minh chứng theo mẫu; bốn bộ mẫu kiểm định theo văn bản sửa đổi 2024 đủ chỉ báo; bổ sung chỉ báo khi nạp lại; tệp mẫu và nhập chỉ báo từ Excel.
- Thành phần bị ảnh hưởng: `database/school-year/migrations/0247_add_quality_framework_kind.ts`, `database/school-year/schema-parts/yctd-396-bo-tieu-chi.ts`; `apps/api/src/quality-assurance/` (`quality-assurance.ts`, `quality-assurance.controller.ts`, `quality-fields.ts`, `evidence-store.ts`); `apps/portal/src/quality-assurance/` (`QualityPages.tsx`, `quality-api.ts`); `packages/shared/src/` (`quality-assurance.ts`, `evidence-store.ts`, thư mục `quality-templates/`).
- Dữ liệu, API, quyền bị ảnh hưởng: năm cột mới ở `quality_frameworks`; `POST /quality/frameworks/defaults` trả thêm `indicators_added`; điểm cuối mới `GET /quality/frameworks/{id}/indicators/template`, `POST /quality/frameworks/{id}/indicators/import`; không thêm quyền.
- Ảnh hưởng chức năng cũ: bộ đang có là bộ kiểm định của nhà trường, chu kỳ 5 năm, mẫu mã cũ, mã minh chứng không đổi; nạp bộ mẫu Mầm non tạo bộ mới `MN-KDCL-2024` thay vì `MN-KDCL`; cấp Tiểu học, THCS, THPT có bộ mẫu.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/*.test.ts`; e2e 80 (đổi tên bộ), 243 đến 245, spec mới 246; database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-10-31 (danh sách lát), 2026-11-01 (Q-396-15).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-01

- Phạm vi thay đổi: bộ tiêu chí nhiều loại có mẫu mã, bộ mẫu kiểm định Mầm non, Tiểu học, THCS, THPT đủ chỉ báo theo văn bản sửa đổi 2024, nhập chỉ báo từ Excel (YCTD-396 lát L3).
- Database migration: năm học `0247_add_quality_framework_kind`. Quay lui: chạy `down` (bỏ năm cột; mã minh chứng đã cấp giữ nguyên).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L3 | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L3 (bộ tiêu chí nhiều loại, bộ mẫu kiểm định đủ chỉ báo theo văn bản sửa đổi 2024, nhập chỉ báo từ Excel) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-545 | Mẫu mã minh chứng của bộ (YCTD-396 lát L3): 5 đến 40 ký tự, bắt buộc có {stt}, chỉ dùng các ô {hop}, {tieu_chuan}, {tieu_chi}, {stt}; mặc định H{hop}-{tieu_chi}-{stt}; mã cấp mới theo mẫu đang đặt, mã đã cấp không đổi khi sửa mẫu |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-546 | Nạp bộ mẫu (YCTD-396 lát L3): bộ cùng mã đã có thì không tạo lại; tiêu chí cùng mã chưa có chỉ báo nào thì được bổ sung chỉ báo của bộ mẫu, tiêu chí đã có chỉ báo giữ nguyên; trả số chỉ báo đã thêm |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-547 | Nhập chỉ báo từ Excel (YCTD-396 lát L3): cột Mã tiêu chí, Mức, Mã chỉ báo, Nội dung; tiêu chí phải thuộc bộ, mức từ 1 đến số mức của bộ, mã 1 đến 10 ký tự, nội dung 1 đến 2.000 ký tự, không trùng trong tệp; có dòng lỗi thì không ghi dòng nào; chỉ báo cùng tiêu chí, mức, mã thì sửa nội dung; chỉ người quản lý bảo đảm chất lượng |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1433 | Cho bộ thi đua có mẫu mã TĐ{tieu_chuan}.{tieu_chi}.{stt} / Khi thêm minh chứng cho tiêu chí 3.2 của tiêu chuẩn 3 / Thì mã là TĐ3.3.2.01; mẫu mã thiếu {stt} bị từ chối (CT-2144; YCTD-396 lát L3) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1434 | Cho trường chưa có bộ / Khi nạp bộ mẫu Mầm non, Tiểu học / Thì có bộ theo văn bản sửa đổi 2024 đủ tiêu chí (22, 24) và chỉ báo; nạp lại không tạo trùng, không thêm chỉ báo (CT-2144, CT-2145; YCTD-396 lát L3) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1435 | Cho tệp chỉ báo có một dòng tiêu chí không thuộc bộ / Khi nhập / Thì không ghi dòng nào, báo dòng lỗi; tệp đúng thì thêm chỉ báo mới, sửa nội dung chỉ báo có sẵn; giáo viên nhập bị 403; giao diện tải được tệp mẫu (CT-2145, CT-2146; YCTD-396 lát L3) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2144 | P09-40 | CT-396-14: bộ có mẫu mã thiếu {stt}; bộ thi đua mẫu TĐ{tieu_chuan}.{tieu_chi}.{stt}, thêm minh chứng tiêu chí 3.2; CT-22f-2 (sửa): nạp bộ Mầm non hai lần | 400; 201, mã TĐ3.3.2.01; lần 1 tạo 1 bộ và đủ chỉ báo, lần 2 bỏ qua, không thêm chỉ báo | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts`, `quality-assurance.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2145 | P09-40 | CT-396-15: nạp bộ Tiểu học; tải tệp mẫu; nhập tệp có dòng tiêu chí 9.9; nhập tệp sửa 1.1 Mức 1 a và thêm 1.1 Mức 2 z; giáo viên nhập | 24 tiêu chí, hơn 100 chỉ báo; tệp xlsx; 1 dòng lỗi, không ghi; thêm 1, sửa 1; 403 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2146 | P09-40 | CT-396-16 (giao diện): Hiệu trưởng nạp bộ mẫu Tiểu học, mở cây, tải tệp mẫu chỉ báo, thêm bộ thi đua có mẫu mã riêng | Cây có chỉ báo theo văn bản; tải tệp xlsx; bộ mới hiện ở lưới | Kiểm thử giao diện `tests/e2e/246-bo-tieu-chi-mau.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L3 | Kho minh chứng dùng chung, lát L3: bộ tiêu chí nhiều loại, bộ mẫu kiểm định đủ chỉ báo, nhập chỉ báo | {PHIEN_BAN} | P09-40, P09-43 | AC-1433 đến AC-1435 | CT-2144 đến CT-2146 | PR, commit merge ghi khi gom; tệp mã: `packages/shared/src/quality-templates/`, `apps/api/src/quality-assurance/quality-assurance.ts` và các tệp khác | Kiểm thử tự động trên máy ngày 01/11/2026; CI của PR |
