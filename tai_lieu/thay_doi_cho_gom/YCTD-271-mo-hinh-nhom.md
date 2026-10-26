---
yctd: YCTD-271
tieu_de: DT-28 phần 28a: mô hình nhóm dùng chung
ngay: 2026-10-26
phien_ban_de_xuat: 0.149.0
---

## 02 Nhật ký

### 2026-10-26 — DT-28 phần 28a: mô hình nhóm dùng chung

#### Công việc đã thực hiện

- Đọc mục 20 của `32` (dòng 28a, phạm vi 20.7, ranh giới đợt 1), mã `child-groups/` (4.1.6), `classroom-tools/` và `apps/teacher/src/tools/` (23b), sổ điểm (21c), mức đạt Tiểu học (20c), tiết nhóm và tổ hợp môn (21a, 21b).
- Thêm năm học 0170 (`group_sets`, cột bộ nhóm ở `child_groups`, `role` ở thành viên, `child_group_member_events`) và 0171 (dời `classroom_groupings` sang bộ nhóm `classroom`).
- Viết hàm chia thuần `group-split.ts` (ngẫu nhiên có hạt, trộn năng lực, gom tầng, cân bằng giới, ràng buộc, nhóm trưởng, từ tiết nhóm 21b), dịch vụ và điểm cuối `/group-sets`, hàm đọc ổn định `GroupSetsReader` cho 28b, 28c, 28e; công cụ lớp học 23b đọc, lưu bộ `classroom`; thẻ Chia nhóm thêm Kiểu chia và Dùng bộ nhóm có sẵn.
- Kiểm thử đơn vị CT-28a-1 đến CT-28a-12, e2e spec 210 (CT-28a-13); tài liệu 01, 07, 16, 17, 21, 23, 24, 32, `index.md`.

#### Quyết định

- Claude chọn theo ủy quyền: GD-140 như kế hoạch (điểm trung bình môn học kỳ gần nhất có điểm, chưa đủ điểm thì trung bình cộng điểm đã có; Tiểu học mức đạt môn kỳ gần nhất); nguồn kết quả hoạt động báo lỗi đến khi 28d gộp.
- Bảng `classroom_groupings` của 23b còn được ghi song song một bản phát hành để spec 151, CT-23b-10 và bản ứng dụng cũ đọc được; máy chủ chỉ đọc bộ nhóm. Lưu bản chia không đổi thì giữ bộ cũ (tránh sinh bộ thừa).
- Sau khi 23a (PR 189) gộp: thêm đích `group` cho đề thi trực tuyến; thành viên lúc giao ghi thành dòng học sinh mang `group_id` nguồn để màn hình học sinh, danh sách học sinh của 23a không phải đổi và đổi nhóm sau đó không đổi bài đã giao.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-271, phiên bản {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Màn hình nhóm của con ở ứng dụng phụ huynh, của học sinh; màn hình bộ nhóm ở cổng quản trị.

## 24 Yêu cầu thay đổi

### YCTD-271: DT-28 phần 28a: mô hình nhóm dùng chung – 2026-10-26

- Lý do: phần 28a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270, PR 183); Eric yêu cầu chia nhóm học sinh dùng chung cho công cụ lớp học, hoạt động, bài tập, đề thi, học nhóm. GD-140 (nguồn điểm khi chia theo năng lực, mức không lưu, không hiện cho học sinh, phụ huynh) Claude chọn theo ủy quyền.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Cơ sở dữ liệu năm học 0170:** bảng `group_sets` (lớp, môn tuỳ chọn, tên, mục đích `subject`, `activity`, `classroom`, cách chia `manual`, `random`, `ability_mixed`, `ability_tiered`, `gender_balanced`, `timetable_group`, tham số, trạng thái `active`, `archived`, người lập, bộ được thay); `child_groups` thêm `group_set_id`, `class_id`, `position`, `leader_child_id`; ràng buộc tên duy nhất tách hai chỉ mục riêng phần (trong đơn vị khi không thuộc bộ, trong bộ khi thuộc bộ); `child_group_members.role`; bảng `child_group_member_events` (thêm, bớt, chuyển nhóm, đặt, bỏ nhóm trưởng).
  - **Cơ sở dữ liệu năm học 0171:** dời `classroom_groupings` của 23b sang bộ nhóm mục đích `classroom`, cách chia `manual`; học sinh đã rời lớp, tên trùng bị bỏ qua.
  - **Cách chia (hàm thuần `apps/api/src/child-groups/group-split.ts`):** ngẫu nhiên có hạt (cùng hạt cùng kết quả để xem trước rồi lưu đúng bản đã xem); trộn năng lực và cân bằng giới bằng một vòng xếp tham lam (ít xung đột "không cùng nhóm", còn chỗ, ít người, ít bạn cùng giới, tổng năng lực thấp); gom tầng xếp theo năng lực giảm dần rồi cắt liên tiếp; ràng buộc "cùng nhóm" gom thành cụm, "không cùng nhóm" tách khi còn cách, không tách được thì báo; nhóm trưởng ngẫu nhiên hoặc luân phiên; bộ nhóm từ tiết nhóm 21b theo tổ hợp môn đang hiệu lực (một học sinh có thể ở nhiều nhóm, không đổi `group_no`).
  - **Năng lực (GD-140):** THCS, THPT lấy điểm trung bình môn học kỳ gần nhất có điểm (chưa đủ điểm giữa kỳ, cuối kỳ thì trung bình cộng các điểm đã có); Tiểu học lấy mức đạt môn của kỳ đánh giá gần nhất quy thứ bậc ra số; nguồn kết quả hoạt động (28d) báo lỗi rõ cho đến khi 28d gộp. Mức chỉ tính trong yêu cầu, không lưu vào tham số, không trả ra.
  - **Máy chủ** (`apps/api/src/child-groups/group-sets.ts`): nhóm điểm cuối `/group-sets` (danh sách, xem trước, lưu, xem, đổi tên, lưu trữ, chuyển nhóm, nhóm trưởng, đổi nhóm trưởng cả bộ, môn của lớp, nhóm của con); chia lại là bộ mới có `replaces_id`, bộ cũ lưu trữ và giữ nguyên nhóm; nhóm của bộ không hiện ở 4.1.6 (danh sách, xem nhóm của DT-14c lọc `group_set_id` trống).
  - **Hàm đọc ổn định cho phần khác** `GroupSetsReader` (`activeSets`, `groupsOfSet`, `childIdsOfGroup`, `groupsOfChild`): 28b, 28c, 28e và đích nhóm của đề 23a chỉ đọc bộ nhóm qua đây; đổi chữ ký phải qua YCTD.
  - **Công cụ lớp học 23b dùng bộ nhóm:** `/classroom-tools/classes/{id}/grouping` đọc bộ `classroom` mới nhất của giáo viên; lưu tạo bộ mới thay bộ đang dùng (bản chia không đổi thì giữ bộ cũ), gửi kèm `group_set_id` khi chọn bộ sẵn có; dạng phản hồi giữ nguyên. Bảng `classroom_groupings` còn được ghi song song một bản phát hành cho bản ứng dụng cũ, máy chủ không đọc nữa; bỏ ở bản sau. Hàng đợi ngoại tuyến của gọi tên, bảng điểm không đổi.
  - **Ứng dụng giáo viên** (`apps/teacher/src/tools/GroupTool.tsx`): thêm Kiểu chia (Ngẫu nhiên trên máy, dùng được khi mất mạng; Cân bằng nam nữ, Trộn năng lực trong mỗi nhóm, Gom theo năng lực do máy chủ chia, cần mạng; chọn môn khi chia theo năng lực) và Dùng bộ nhóm có sẵn của lớp.
  - **Đích `group` cho đề thi trực tuyến 23a** (sau khi PR 189 gộp): `POST /online-exams/assignments` nhận thêm `group_ids` (nhóm của bộ nhóm đang dùng; nhóm của bộ đã lưu trữ 404, nhóm trống 400); `exam_assignment_targets` thêm `group_id` và loại `group` (năm học 0170); dòng `group` chỉ ghi nhóm được giao, thành viên lúc giao ghi thành dòng `student` mang `group_id` nguồn và qua đúng các kiểm tra của đích học sinh (cấp, khối, lớp giáo viên dạy); đổi nhóm sau khi giao không đổi danh sách làm bài; màn hình học sinh, danh sách học sinh của bài không đổi; chi tiết bài hiện dòng nhóm, không hiện riêng từng thành viên.
- Thành phần bị ảnh hưởng: `apps/api` (`child-groups/`, phần nhóm của `classroom-tools/`, đích nhóm của `online-exams/`), `apps/teacher` (phần chia nhóm của `tools/`), `database` (năm học, kiểu xuất), `tests` (spec 210); đăng ký mô-đun thêm cuối tệp `application.module.ts`; không sửa `MULTI_TENANT_SPEC`, `learning/`.
- Dữ liệu bị ảnh hưởng: cơ sở dữ liệu năm học (tệp 0170, 0171).
- API bị ảnh hưởng: thêm nhóm `/api/v1/group-sets`; `PUT /classroom-tools/classes/{id}/grouping` nhận thêm `group_set_id` tuỳ chọn (xem `17_DAC_TA_API.md`).
- Giao diện bị ảnh hưởng: thẻ Chia nhóm của Công cụ lớp học (MH-337) thêm Kiểu chia, Môn lấy kết quả học tập, Dùng bộ nhóm có sẵn của lớp; không đổi cổng quản trị, ứng dụng phụ huynh.
- Quyền bị ảnh hưởng: không thêm quyền. Giáo viên được phân công lớp (chủ nhiệm, bộ môn) hoặc dạy lớp trong bản thời khoá biểu đang áp dụng lập và xem bộ nhóm của lớp; sửa bộ do người lập hoặc vai trò đơn vị xem được lớp (Ban Giám hiệu, quản lý đơn vị); phụ huynh xem nhóm của con (tên nhóm, nhóm trưởng, bạn trong nhóm).
- Ảnh hưởng chức năng cũ: nhóm học sinh 4.1.6 không đổi; công cụ lớp học giữ nguyên dạng phản hồi và hành vi (spec 151, CT-23b-10 đạt không sửa kỳ vọng).
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho (CT-28a-1 đến CT-28a-12, CT-28a-14); e2e `single` (spec 210 cùng spec 151); kiểm tĩnh đa thuê bao và ma trận cách ly; typecheck, lint, build.
- Chưa làm (YCTD sau): nguồn năng lực kết quả hoạt động (chờ 28d); màn hình nhóm của con ở ứng dụng phụ huynh và của học sinh (điểm cuối `/group-sets/children/{id}` đã có; giao diện làm ở phần sở hữu `apps/parent`, màn hình học sinh của 23a); màn hình bộ nhóm ở cổng quản trị.

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-26

- Phạm vi thay đổi: DT-28 phần 28a, mô hình nhóm dùng chung (YCTD-271).
- Chức năng mới: bộ nhóm của lớp (chia tay, ngẫu nhiên có hạt, trộn năng lực, gom tầng, cân bằng giới, ràng buộc cùng nhóm, không cùng nhóm, từ tiết nhóm 21b), nhóm trưởng (đặt, ngẫu nhiên, luân phiên), lịch sử đổi thành viên; công cụ lớp học dùng bộ nhóm, chọn bộ sẵn có; hàm đọc ổn định `GroupSetsReader` cho 28b, 28c, 28e; giao đề thi trực tuyến 23a cho nhóm của bộ nhóm.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0170`, `0171`; xem `16_CO_SO_DU_LIEU.md` mục 18G.
- Thay đổi API: nhóm `/group-sets`; `PUT /classroom-tools/classes/{id}/grouping` nhận thêm `group_set_id`.
- Kiểm thử: kịch bản CT-1122 đến CT-1129 (CT-28a-1 đến CT-28a-14 trong mã kiểm thử).
- Rủi ro: chia theo năng lực dựa trên điểm chưa đầy đủ đầu năm (học sinh chưa có điểm xếp sau ở gom tầng); bảng `classroom_groupings` còn ghi song song một bản phát hành.
- Khả năng tương thích: nhóm 4.1.6 không đổi; công cụ lớp học giữ dạng phản hồi; bản chia cũ của 23b chuyển thành bộ nhóm.
- Phương án quay lui: hoàn lại commit gộp; tệp 0171 và 0170 có hàm `down` xóa bộ nhóm đã dời và các cột mới, `classroom_groupings` vẫn đủ dữ liệu vì được ghi song song.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28a: mô hình nhóm dùng chung (bộ nhóm của lớp mở rộng `child_groups`; chia tay, ngẫu nhiên, theo năng lực, cân bằng giới, ràng buộc, từ tiết nhóm 21b; nhóm trưởng, lịch sử; công cụ lớp học 23b dùng bộ nhóm; hàm đọc ổn định cho phần khác) | YCTD-271 |

## index Số đếm

| Quy tắc nghiệp vụ đã xác định | Số lượng | +2 |
| Bảng dữ liệu dự kiến | Số lượng | +2 |
| 16 | bảng dự kiến | +2 |
| Ca kiểm thử khởi đầu | Số lượng | +8 |
