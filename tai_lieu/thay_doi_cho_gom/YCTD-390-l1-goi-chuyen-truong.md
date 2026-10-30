---
yctd: YCTD-390
tieu_de: Liên thông dữ liệu học sinh, lát L1: gói chuyển trường bằng tệp
ngay: 2026-10-30
phien_ban_de_xuat: 0.253.0
---

## 02 Nhật ký

### 2026-10-30 — Liên thông dữ liệu học sinh, lát L1: gói chuyển trường bằng tệp (YCTD-390)

#### Công việc đã thực hiện

- Máy chủ API: `apps/api/src/student-records/transfer-package-rules.ts` (định dạng gói `school-management.student-transfer/1`, mã hóa bằng mật khẩu, kiểm mã băm), `transfer-packages.ts`, `transfer-packages.controller.ts`; đăng ký ở `apps/api/src/dang-ky/yctd-390-l1-goi-chuyen-truong.ts`. `ChildrenService.approve` tách phần xếp lớp thành `placeInClass` dùng chung với `admitTransferred` (tiếp nhận học sinh chuyển đến bằng gói).
- Cổng quản trị, 4.2 Biến động học sinh, phần chuyển trường (MH-651, MH-652, MH-653): nút "Lập gói" ở đề nghị chuyển đi (chọn phần thêm, xác nhận đồng ý của phụ huynh, hiện mật khẩu một lần, tải tệp gói và bản in PDF); nút "Nhập gói chuyển trường" (tệp, mật khẩu, xem trước, đơn vị, lớp, ngày bắt đầu học, tiếp nhận); nút "Học bạ nhận được" ở hồ sơ chuyển đến; cột "Mã gói".
- Database migration năm học `0233_add_student_transfer_packages`: cột gói ở `student_transfers`, bảng `received_learning_records`.
- Kiểm thử: `transfer-package-rules.test.ts` (CT-1860 đến CT-1862), `transfer-packages.test.ts` (CT-1863 đến CT-1866).

#### Quyết định

- Eric ngày 2026-10-30: làm lát L1 sau khi duyệt lát L0 (PR 314).
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - gói là JSON nén gzip mã hóa AES-256-GCM, khóa dẫn từ mật khẩu bằng scrypt, cùng kiểu gói khoá học `course-package/1`, thay cho tệp zip ghi ở đặc tả mục 7.1 (không cần thêm bộ đọc zip có mật khẩu); chữ ký bằng khóa của trường thêm ở lát L2 cùng khóa trường, lát L1 dựa vào mã băm in trên bản in và thẻ xác thực của AES-GCM;
  - theo chỉ đạo của phiên điều phối (chọn phương án an toàn nhất cho dữ liệu học sinh): chỉ lập gói khi người lập xác nhận đã nhận đơn xin chuyển trường của cha mẹ;
  - Hiệu trưởng (quyền duyệt hồ sơ) lập gói cho đề nghị chờ duyệt hoặc đã duyệt; cần thêm quyền xuất dữ liệu và xem số định danh như hồ sơ chuyển trường hiện có; lập lại gói ra mã gói, mật khẩu mới;
  - phần thêm lát L1 là sức khỏe và khen thưởng; ảnh học sinh chưa đóng gói; đồng ý của phụ huynh ghi là đơn giấy, lát L3 thêm đồng ý trên ứng dụng;
  - học bạ chưa ký của năm đang học gửi như kết quả năm học đang học; học bạ, kết quả nhận được lưu chỉ đọc, xem và tải PDF ở "Học bạ nhận được";
  - học sinh trùng mã định danh Bộ hoặc số định danh với hồ sơ đã có thì từ chối, chưa gắn vào hồ sơ có sẵn (để lát sau nếu cần);
  - kiểm sĩ số lớp, gói dịch vụ trước khi tạo hồ sơ để không để lại hồ sơ nháp khi lớp đã đủ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-390, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `07_QUY_TAC_NGHIEP_VU.md` BR-480 đến BR-483, `11_TIEU_CHI_NGHIEM_THU.md` AC-1253 đến AC-1257, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md` giao kèo gói chuyển trường, `21_KICH_BAN_KIEM_THU.md` CT-1860 đến CT-1866.

#### Vấn đề tồn đọng

- Lát L2 (hộp thư nền tảng, khóa trường, chữ ký) đến L6 chưa làm.
- Luật sư chưa trả lời câu hỏi ở đặc tả mục 16; chưa bật trên trường thật.

## 24 Yêu cầu thay đổi

### YCTD-390: Liên thông dữ liệu học sinh, lát L1: gói chuyển trường bằng tệp – 2026-10-30

- Lý do: lát L1 của YCTD-390 (đặc tả `tai_lieu/ban_mau/yctd-390/DAC_TA.md`, Eric duyệt ngày 2026-10-30).
- Nội dung thay đổi: trường đi lập gói chuyển trường mã hóa bằng mật khẩu (hồ sơ, tệp 82 cột, học bạ đã ký, kết quả năm đang học, nhu cầu đặc biệt, môn lựa chọn; sức khỏe, khen thưởng khi phụ huynh đồng ý) kèm bản in; trường đến xem trước, xếp lớp, tiếp nhận thành hồ sơ Đang học; học bạ nhận được lưu chỉ đọc.
- Yêu cầu bị thay đổi: BR-124 (tiếp nhận chuyển đến tạo hồ sơ nháp) giữ nguyên với tệp 82 cột; tiếp nhận bằng gói tạo hồ sơ Đang học (BR-482).
- Thành phần bị ảnh hưởng: 4.2 Biến động học sinh (cổng quản trị), `student_transfers`, duyệt hồ sơ trẻ (`ChildrenService.approve` tách phần xếp lớp, hành vi giữ nguyên).
- Dữ liệu, API, quyền bị ảnh hưởng: migration năm học `0233_add_student_transfer_packages`; điểm cuối `POST /student-transfers/{id}/package`, `/package/preview`, `/package/accept`, `GET /student-transfers/received-learning-records`, `/{id}/file`; không thêm quyền.
- Ảnh hưởng chức năng cũ: duyệt hồ sơ, đề nghị chuyển đi, tiếp nhận bằng tệp 82 cột, hồ sơ chuyển PDF giữ nguyên.
- Kiểm thử cần thực hiện: CT-1860 đến CT-1866; chạy lại `student-records-so.test.ts` (CT-16g-11), `children` (duyệt hồ sơ), toàn bộ kiểm thử tự động.
- Mức: Lớn (thuộc YCTD-390). Người phê duyệt: Eric, ngày 2026-10-30.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-30

- Phạm vi thay đổi: liên thông dữ liệu học sinh, lát L1: gói chuyển trường bằng tệp (YCTD-390).
- Database migration: năm học `0233_add_student_transfer_packages`. Quay lui: chạy `down` (xóa bảng `received_learning_records`, chỉ mục và các cột gói của `student_transfers`); học sinh đã tiếp nhận bằng gói giữ nguyên hồ sơ, mất phần học bạ nhận được.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Liên thông dữ liệu học sinh, lát L1: gói chuyển trường bằng tệp | YCTD-390 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-480 | Gói chuyển trường (YCTD-390): định dạng `school-management.student-transfer/1`; gói tối đa 50 MB, mã hóa AES-256-GCM bằng khóa dẫn từ mật khẩu 16 ký tự do hệ thống sinh, chỉ hiện một lần và in trên bản in, không lưu; bản kê ghi mã băm SHA-256 từng phần, sai mật khẩu, sai một phần, thừa hoặc thiếu phần thì từ chối cả gói; chỉ lập cho đề nghị chuyển đi chờ duyệt hoặc đã duyệt, người lập có quyền duyệt hồ sơ, xuất dữ liệu, xem số định danh; lập gói ghi nhật ký xuất; mỗi mã gói tiếp nhận một lần |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-481 | Thành phần gói chuyển trường (YCTD-390): chỉ lập gói khi người lập xác nhận đã nhận đơn xin chuyển trường do cha mẹ hoặc người giám hộ ký; luôn có hồ sơ học sinh, cha mẹ; tệp 82 cột có mã định danh Bộ và số định danh; học bạ các năm đã ký kèm PDF nguyên bản; kết quả năm học đang học (học bạ chưa ký); nhu cầu đặc biệt, môn học lựa chọn khi có. Sức khỏe, khen thưởng chỉ đóng gói khi người lập xác nhận đã có đồng ý của phụ huynh (và của trẻ từ đủ 7 tuổi); học phí, công nợ, điểm danh, tin nhắn, nhật ký không đóng gói |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-482 | Tiếp nhận bằng gói chuyển trường (YCTD-390, Q7 của đặc tả): người tiếp nhận có quyền duyệt hồ sơ ở đơn vị của lớp; học sinh trùng mã định danh Bộ hoặc số định danh với hồ sơ đã có thì không tiếp nhận; kiểm gói dịch vụ, sĩ số lớp trước khi tạo hồ sơ (vượt sĩ số cần xác nhận); hồ sơ tạo từ tệp 82 cột của gói chuyển thẳng sang Đang học, xếp lớp từ ngày bắt đầu học (không sau hôm nay), tạo tài khoản phụ huynh có số điện thoại như duyệt hồ sơ mới; sức khỏe, nhu cầu đặc biệt của gói ghi vào hồ sơ |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-483 | Học bạ nhận từ trường khác (YCTD-390): học bạ đã ký, kết quả năm đang học trong gói lưu chỉ đọc theo học sinh kèm trường cấp, mã gói, mã băm của PDF; người có quyền sửa hồ sơ học sinh trong phạm vi xem và tải PDF nguyên bản; không sửa, không xóa |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1253 | Cho đề nghị chuyển đi chờ duyệt và Hiệu trưởng có quyền xuất dữ liệu, xem số định danh / Khi lập gói không chọn phần thêm / Thì tải được tệp gói và bản in PDF có mã gói, mật khẩu, mã băm; mật khẩu chỉ hiện một lần; gói có hồ sơ, tệp 82 cột, học bạ đã ký kèm PDF, kết quả năm đang học, nhu cầu đặc biệt (CT-1860, CT-1863; YCTD-390) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1254 | Cho người lập gói chọn sức khỏe hoặc khen thưởng / Khi chưa xác nhận đồng ý của phụ huynh / Thì không lập được; chưa xác nhận đã nhận đơn xin chuyển trường của cha mẹ cũng không lập được; xác nhận rồi thì gói có phần đó và ghi đồng ý trong bản kê; giáo viên không lập được gói (CT-1863; YCTD-390) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1255 | Cho tệp gói / Khi nhập sai mật khẩu, tệp bị sửa một byte hoặc không phải gói / Thì bị từ chối, không tạo gì (CT-1861, CT-1864; YCTD-390) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1256 | Cho gói hợp lệ của học sinh chưa có ở trường / Khi Hiệu trưởng chọn lớp và tiếp nhận / Thì học sinh Đang học trong lớp, học bạ nhận được xem và tải được PDF, danh sách chuyển đến có mã gói; tiếp nhận lại cùng gói bị từ chối (CT-1865; YCTD-390) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1257 | Cho học sinh trùng mã định danh Bộ với hồ sơ đã có, hoặc lớp đã đủ sĩ số chưa xác nhận / Khi tiếp nhận / Thì bị từ chối và không để lại hồ sơ nháp (CT-1864, CT-1866; YCTD-390) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1860 | P02-23 | Đóng gói ba phần rồi mở bằng mật khẩu viết thường, có dấu cách | Đủ phần, đúng mã băm; nội dung không ở dạng rõ trong tệp | Kiểm thử tự động `transfer-package-rules.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1861 | P02-23 | Sai mật khẩu; sửa một byte; tệp không phải gói; định dạng lạ | Từ chối với thông báo tương ứng | Kiểm thử tự động `transfer-package-rules.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1862 | P02-23 | Gói thiếu hồ sơ học sinh; mã gói | Từ chối; mã dạng GCT-ngày-6 ký tự | Kiểm thử tự động `transfer-package-rules.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1863 | P02-23 | Lập gói chưa xác nhận đơn của cha mẹ; lập gói có sức khỏe không xác nhận đồng ý; phần lạ; giáo viên lập; Hiệu trưởng lập có đồng ý | 400; 400; 400; 403; gói đủ bảy phần, PDF học bạ nguyên bản, đồng ý trong bản kê, mật khẩu không lưu, có nhật ký xuất | Kiểm thử tự động `transfer-packages.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1864 | P02-23 | Xem trước sai mật khẩu; xem trước, tiếp nhận học sinh trùng mã Bộ | 422 BR-480; xem trước báo hồ sơ đã có; tiếp nhận 422 | Kiểm thử tự động `transfer-packages.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1865 | P02-23 | Tiếp nhận gói hợp lệ vào lớp; xem, tải học bạ nhận được; tiếp nhận lại | Đang học trong lớp; một học bạ có PDF, một kết quả năm đang học; PDF đúng nguyên bản; lần hai 422 | Kiểm thử tự động `transfer-packages.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1866 | P02-23 | Tiếp nhận vào lớp đã đủ sĩ số, không xác nhận | 422 BR-04, số hồ sơ không đổi | Kiểm thử tự động `transfer-packages.test.ts` | Đạt |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-651 | Cổng quản trị: Lập gói chuyển trường (YCTD-390, hộp thoại từ nút "Lập gói" ở 4.2 Biến động học sinh, phần chuyển trường): danh sách phần luôn có, chọn phần thêm (sức khỏe, khen thưởng) kèm xác nhận đồng ý của phụ huynh; sau khi lập hiện mật khẩu một lần, mã băm, các phần, nút tải tệp gói và bản in PDF | VT-02, VT-15 (quyền duyệt hồ sơ, xuất dữ liệu, xem số định danh) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-652 | Cổng quản trị: Nhập gói chuyển trường (YCTD-390, nút ở 4.2 Biến động học sinh, phần chuyển trường): chọn tệp `.goichuyen`, nhập mật khẩu 16 ký tự, xem gói; lát L2 thêm hộp gói nhận qua hệ thống | VT-02, VT-15 (quyền duyệt hồ sơ) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-653 | Cổng quản trị: Xem gói và tiếp nhận (YCTD-390): trường cấp, người duyệt, ngày lập; học sinh, mã Bộ, bốn số cuối số định danh, lớp cũ, cha mẹ, học bạ; báo đã tiếp nhận hoặc trùng hồ sơ; chọn đơn vị, lớp, ngày bắt đầu học, xác nhận vượt sĩ số; nút Tiếp nhận. Ở hồ sơ chuyển đến có gói: "Học bạ nhận được" (xem, tải PDF, chỉ đọc) | VT-02, VT-15 (quyền duyệt hồ sơ); xem học bạ nhận được: người sửa hồ sơ học sinh |
| 16_CO_SO_DU_LIEU.md | student_transfers | received_learning_records (năm học, từ YCTD-390) | Học bạ, kết quả năm đang học nhận trong gói chuyển trường, chỉ đọc (BR-483) | id, transfer_id (`student_transfers`), child_id, package_code, source_school_name, kind (`learning_record`, `term_results`), academic_year_name, class_name, grade_level, school_level, content (JSON nội dung học bạ), storage_key (PDF nguyên bản), file_sha256, signer_name, signed_at, created_at; không chuyển năm học |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-390 lát L1 | Liên thông dữ liệu học sinh, lát L1: gói chuyển trường bằng tệp | {PHIEN_BAN} | P02-23 | AC-1253 đến AC-1257 | CT-1860 đến CT-1866 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/student-records/transfer-package-rules.ts`, `transfer-packages.ts`, `transfer-packages.controller.ts`, `apps/portal/src/students/TransferPackageDialogs.tsx`, `database/school-year/migrations/0233_add_student_transfer_packages.ts` | Kiểm thử tự động, CI của PR |
