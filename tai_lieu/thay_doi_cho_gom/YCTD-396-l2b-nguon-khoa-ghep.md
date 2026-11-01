---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L2b: nguồn hồ sơ công việc, sổ điểm, điểm danh tháng, biểu đã gửi cấp trên
ngay: 2026-11-01
phien_ban_de_xuat: 0.262.0
---

## 02 Nhật ký

### 2026-11-01 — Kho minh chứng dùng chung, lát L2b (YCTD-396)

#### Công việc đã thực hiện

- Bộ đăng ký nguồn thêm bốn loại: hồ sơ công việc (bản chụp PDF thành phần hồ sơ), sổ điểm một môn của lớp trong một học kỳ (mã ghép lớp, môn, học kỳ; dùng bản in sổ điểm có sẵn), điểm danh của lớp trong một tháng (mã ghép lớp, tháng; PDF số ngày có mặt, vắng, tỉ lệ đi học của từng học sinh), biểu, báo cáo đã xuất tệp gửi cấp trên trong năm học (tệp đã lưu lúc xuất).
- Sổ điểm, điểm danh có dữ liệu cá nhân học sinh: bản chụp đầy đủ, chỉ người có quyền xem nguồn tải được (Q-396-5).
- Nút "Dùng làm minh chứng" thêm ở trang sổ điểm (môn và học kỳ đang chọn) và chi tiết hồ sơ công việc.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: các nguồn đọc qua dịch vụ của phân hệ nguồn (`ScoresService`, `AttendanceMealsService`, `WorkFilesService`, `UpperLevelSubmissions`) để giữ quyền và phạm vi; ô chọn sổ điểm liệt kê tối đa 10 lớp THCS, THPT theo tên, mỗi lớp các môn người dùng xem được, hai học kỳ; ô chọn điểm danh liệt kê 12 tháng gần nhất có điểm danh của tối đa 10 lớp. Lần sửa gần nhất của sổ điểm, điểm danh tính bằng thời điểm sửa lớn nhất của các dòng trong lớp và kỳ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-396, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `07_QUY_TAC_NGHIEP_VU.md` BR-544, `11_TIEU_CHI_NGHIEM_THU.md` AC-1431, AC-1432, `21_KICH_BAN_KIEM_THU.md` CT-2141 đến CT-2143.

#### Vấn đề tồn đọng

- Lát L3 đến L8 chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L2b: nguồn hồ sơ công việc, sổ điểm, điểm danh, biểu đã gửi – 2026-11-01

- Lý do: phần còn lại của lát L2 (YCTD-396), tách khỏi PR của lát L2 vì dùng mã ghép và có dữ liệu học sinh.
- Nội dung thay đổi: bốn loại nguồn mới ở bộ đăng ký nguồn; nút "Dùng làm minh chứng" ở trang sổ điểm và chi tiết hồ sơ công việc.
- Thành phần bị ảnh hưởng: `apps/api/src/quality-assurance/evidence-sources.ts`; `apps/portal/src/scores/ScoresPage.tsx`, `apps/portal/src/directives/WorkFilePages.tsx`; `packages/shared/src/evidence-store.ts`.
- Dữ liệu, API, quyền bị ảnh hưởng: không thêm bảng, quyền; `record_type` nhận thêm `work_file`, `score_book`, `class_attendance`, `upper_level_submission`.
- Ảnh hưởng chức năng cũ: sổ điểm, hồ sơ công việc chỉ thêm nút cho người có quyền đóng góp hoặc quản lý kho.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/*.test.ts`; e2e spec mới 245.
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-10-31 (danh sách lát).
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-11-01

- Phạm vi thay đổi: kho minh chứng nhận nguồn hồ sơ công việc, sổ điểm, điểm danh tháng, biểu đã gửi cấp trên (YCTD-396 lát L2b).
- Database migration: không có.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L2b | YCTD-396 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L2b (nguồn hồ sơ công việc, sổ điểm, điểm danh, biểu đã gửi) |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-544 | Nguồn mã ghép (YCTD-396 lát L2b): sổ điểm có mã "lớp:môn:học kỳ" (học kỳ I hoặc II), điểm danh có mã "lớp:YYYY-MM", biểu đã gửi có mã là mã biểu của năm học đang dùng; mã sai dạng bị từ chối; bản chụp sổ điểm, điểm danh có dữ liệu cá nhân học sinh, chỉ người có quyền xem sổ điểm (`P02.assessment.*`) hoặc báo cáo điểm danh (`P17.report.attendance`) tải được; nguồn đã thay đổi khi có dòng điểm, điểm danh sửa sau lần chụp |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1431 | Cho hồ sơ công việc của Hiệu trưởng / Khi Hiệu trưởng tìm và gắn làm minh chứng / Thì phiên bản 1 là PDF thành phần hồ sơ; người không thuộc hồ sơ không gắn được (CT-2141, CT-2143; YCTD-396 lát L2b) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1432 | Cho mã sổ điểm hoặc điểm danh sai dạng (học kỳ lạ, tháng 13) / Khi gắn / Thì bị từ chối 400 (CT-2142; YCTD-396 lát L2b) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2141 | P09-43 | CT-396-11: tìm hồ sơ công việc theo tên; giáo viên gắn; Hiệu trưởng gắn; tải tệp | Có hồ sơ; không 201; 201; PDF | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2142 | P09-43 | CT-396-12: gắn sổ điểm mã "khong-hop-le", học kỳ "ca_nam"; điểm danh tháng 2026-13 | 400 cả ba | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2143 | P09-43 | CT-396-13 (giao diện): Hiệu trưởng thêm minh chứng, chọn loại dữ liệu Hồ sơ công việc, tìm, chọn, ghi | Báo mã đã cấp; chi tiết có Bản 1 nguồn hồ sơ công việc | Kiểm thử giao diện `tests/e2e/245-nguon-ho-so-cong-viec.spec.ts` | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L2b | Kho minh chứng dùng chung, lát L2b: nguồn hồ sơ công việc, sổ điểm, điểm danh, biểu đã gửi | {PHIEN_BAN} | P09-43 | AC-1431, AC-1432 | CT-2141 đến CT-2143 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/evidence-sources.ts` và các tệp khác | Kiểm thử tự động trên máy ngày 01/11/2026; CI của PR |
