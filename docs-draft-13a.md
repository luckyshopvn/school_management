# Bản nháp tài liệu DT-13 phần 13a: nhập tệp CSDL ngành (YCTD-100)

Bản nháp để đưa vào `tai_lieu/`; chưa sửa `tai_lieu/`.

## 1. Tóm tắt

- Màn hình **Nhập dữ liệu** (MH-40) có thêm hai mục: **Trẻ từ CSDL ngành** (quyền `P01.import.children`, VT-02) và
  **Nhân sự từ CSDL ngành** (quyền `P01.import.staff`, VT-06).
- Nhận tệp xuất từ cơ sở dữ liệu ngành (CSDL ngành) dạng **xls** (Excel 97-2003) và **xlsx**. Tệp xls đọc bằng SheetJS
  (`xlsx` 0.20.3 tải từ cdn.sheetjs.com, không dùng bản 0.18.x trên npm có lỗ hổng); các loại nhập cũ vẫn dùng exceljs.
- Tệp không có đơn vị: người nhập chọn **đơn vị** trên màn hình. Cột "Mã lớp" so khớp **mã hoặc tên lớp** đang dùng của
  đơn vị đó và các đơn vị trực thuộc (chọn Trường chính là toàn trường), không phân biệt hoa thường, dấu, khoảng trắng thừa.
- Quy trình như các loại nhập khác: tải lên thì kiểm tra toàn bộ (xem trước số dòng tạo mới, cập nhật, bỏ qua, dòng lỗi và
  ghi chú từng dòng), còn dòng lỗi thì không ghi dòng nào; bấm **Ghi dữ liệu** thì kiểm tra lại rồi ghi trong một giao dịch.
- Nhập lại cùng tệp thì **cập nhật**, không tạo trùng: trẻ nhận ra theo số định danh cá nhân (không có thì số CCCD), nhân
  sự theo mã định danh Bộ GD&ĐT (không có thì CMND/CCCD).
- **Mọi cột** của tệp được lưu: cột có chỗ riêng trong hồ sơ ghi vào cột đó; các cột còn lại lưu vào `moet_profile`
  (jsonb, khóa tiếng Anh cố định, định nghĩa ở `apps/api/src/imports/moet-columns.ts`). Cột lạ (mẫu đổi phiên bản) lưu vào
  `moet_profile.extra_columns` theo tiêu đề.
- Hồ sơ trẻ và hồ sơ nhân sự có mục thu gọn **Thông tin theo CSDL ngành**, chỉ đọc. Mục của trẻ chỉ hiện với nhóm vai trò
  được xem sức khỏe (BR-53) vì có khuyết tật, bệnh về mắt, diện chính sách.

## 2. Thay đổi cơ sở dữ liệu năm học

| Tệp thay đổi                     | Nội dung                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0045_add_moet_child_profile.ts` | `children.moet_profile` jsonb; `guardians.birth_year`, `guardians.id_number_encrypted`, `guardians.id_number_last4`; `data_import_jobs.preview` jsonb; loại nhập thêm `moet_children`, `moet_staff` |
| `0046_add_moet_staff_profile.ts` | `staff.moet_staff_code` (không trùng), `staff.moet_profile` jsonb                                                                                                                                   |

Chuyển năm học chép nguyên `moet_profile` của trẻ và nhân sự cùng các cột mới của người thân.

## 3. Ánh xạ cột tệp học sinh (82 cột)

Cột "quận/huyện" là cột không tiêu đề ngay sau mỗi cột "Tỉnh/Thành phố (...)".

| Cột trong tệp                                                                 | Lưu vào                                                                                               |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| STT                                                                           | Không lưu (số thứ tự)                                                                                 |
| Mã lớp                                                                        | Lớp của trẻ (`class_enrollments`), so khớp mã hoặc tên lớp                                            |
| Mã học sinh                                                                   | `children.moet_student_code`                                                                          |
| Họ tên, Ngày sinh, Giới tính                                                  | `children.full_name`, `dob`, `gender`                                                                 |
| Số định danh cá nhân (không có thì Số CCCD)                                   | `children.national_id_*` (mã hóa, băm, bốn số cuối)                                                   |
| Nơi sinh                                                                      | `children.place_of_birth`                                                                             |
| Chỗ ở hiện nay chi tiết                                                       | `children.address`                                                                                    |
| Trạng thái HS, Ngày nhập trạng thái                                           | `student_status`, `status_date`                                                                       |
| Chuyển đến từ Tỉnh/Thành Phố, Chuyển đến từ Xã, Lý do thôi học                | `transfer_from_province`, `transfer_from_ward`, `dropout_reason`                                      |
| Dân tộc, Quốc tịch, Tôn giáo                                                  | `ethnicity`, `nationality`, `religion`                                                                |
| Địa chỉ thường trú: tỉnh, (quận/huyện), xã/phường, tổ/thôn/xóm                | `permanent_province`, `permanent_district`, `permanent_ward`, `permanent_hamlet`                      |
| Quê quán: tỉnh, (quận/huyện), xã/phường, tổ/thôn/xóm                          | `hometown_province`, `hometown_district`, `hometown_ward`, `hometown_hamlet`                          |
| Nơi khai sinh: tỉnh, (quận/huyện), xã/phường                                  | `birth_registration_province`, `birth_registration_district`, `birth_registration_ward`               |
| Nơi sinh: tỉnh, (quận/huyện), xã/phường                                       | `birthplace_province`, `birthplace_district`, `birthplace_ward`                                       |
| Chỗ ở hiện nay: tỉnh, (quận/huyện), xã/phường; Khu phố mới                    | `current_province`, `current_district`, `current_ward`, `current_quarter`                             |
| Số điện thoại liên hệ                                                         | `contact_phone` (chuẩn hóa 10 chữ số)                                                                 |
| Số hộ chiếu, Nơi cấp (Hộ chiếu), Ngày cấp (Hộ chiếu)                          | `passport_number_encrypted`, `passport_number_last4`, `passport_issued_place`, `passport_issued_date` |
| Số CCCD, Nơi cấp, Ngày cấp                                                    | `citizen_id_encrypted`, `citizen_id_last4`, `citizen_id_issued_place`, `citizen_id_issued_date`       |
| Khu vực, Loại khuyết tật, Đối tượng chính sách                                | `area`, `disability_type`, `policy_target`                                                            |
| Miễn học phí, Giảm học phí, Hỗ trợ chi phí học tập, Hỗ trợ ăn trưa            | `tuition_exemption`, `tuition_reduction`, `learning_cost_support`, `lunch_support`                    |
| Học Ch.trình làm quen Ng.ngữ                                                  | `language_familiarization`                                                                            |
| Học sinh tuyển mới, Ngày tuyển mới                                            | `newly_enrolled`, `newly_enrolled_date`                                                               |
| Học 2 buổi/ngày, Học sinh lớp bán trú, Học bán trú                            | `two_sessions_per_day`, `boarding_class`, `boarding_type`                                             |
| Có mẹ dân tộc, Dân tộc mẹ, Có cha dân tộc, Dân tộc cha                        | `mother_ethnic_minority`, `mother_ethnicity`, `father_ethnic_minority`, `father_ethnicity`            |
| Học sinh biết bơi, Bệnh về mắt                                                | `can_swim`, `eye_disease`                                                                             |
| P.huynh có Smartphone, P.huynh có M.tính kết nối Internet                     | `parent_has_smartphone`, `parent_has_internet_computer`                                               |
| Giáo dục phát triển của trẻ                                                   | `development_education`                                                                               |
| Không có thông tin cha, Không có thông tin mẹ                                 | `no_father_info`, `no_mother_info`                                                                    |
| Họ tên, Nghề nghiệp, Năm sinh, Số điện thoại, Số CCCD/CMND/DDCN cha           | Người thân quan hệ "Cha": `guardians.full_name`, `occupation`, `birth_year`, `phone`, `id_number_*`   |
| Họ tên, Nghề nghiệp, Năm sinh, Số điện thoại, Số CCCD/CMND/DDCN mẹ            | Người thân quan hệ "Mẹ" (như trên)                                                                    |
| Họ tên, Nghề nghiệp, Năm sinh, Số điện thoại, Số CCCD/CMND/DDCN người giám hộ | Người thân quan hệ "Người giám hộ" (như trên)                                                         |
| Giới tính người giám hộ                                                       | `legal_guardian_gender`                                                                               |

## 4. Ánh xạ cột tệp cán bộ, giáo viên (75 cột)

| Cột trong tệp                                                                                         | Lưu vào                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STT                                                                                                   | Không lưu                                                                                                                                                   |
| Mã định danh Bộ GD&ĐT                                                                                 | `staff.moet_staff_code`; hồ sơ mới lấy luôn làm mã nhân sự `staff.code`                                                                                     |
| Họ tên, Giới tính, Ngày sinh                                                                          | `staff.full_name`, `gender`, `dob`                                                                                                                          |
| CMND/CCCD                                                                                             | `staff.id_number_encrypted`, `id_number_last4`                                                                                                              |
| Email, Điện thoại                                                                                     | `staff.email`, `staff.phone`                                                                                                                                |
| Ngày tuyển dụng                                                                                       | `recruitment_date`; hồ sơ mới lấy làm `staff.start_date`                                                                                                    |
| Trạng thái CB, Ngày nhập trạng thái                                                                   | `staff_status`, `status_date`                                                                                                                               |
| Ngày cấp, Nơi cấp (CMND/CCCD), VNeId mức độ 2                                                         | `id_issued_date`, `id_issued_place`, `vneid_level2`                                                                                                         |
| Dân tộc, Tôn giáo                                                                                     | `ethnicity`, `religion`                                                                                                                                     |
| Địa chỉ thường trú, quê quán (tỉnh, quận/huyện, xã/phường, tổ/thôn/xóm)                               | `permanent_*`, `hometown_*`                                                                                                                                 |
| Nơi khai sinh, chỗ ở hiện nay (tỉnh, quận/huyện, xã/phường)                                           | `birth_registration_*`, `current_*`                                                                                                                         |
| Là Đoàn viên, Là Đảng viên, Ngày vào đảng dự bị, Ngày vào đảng chính thức                             | `youth_union_member`, `party_member`, `party_probation_date`, `party_official_date`                                                                         |
| Số sổ BHXH                                                                                            | `social_insurance_number_encrypted`, `social_insurance_number_last4`                                                                                        |
| Vị trí việc làm, Nhóm chức vụ, Hình thức hợp đồng                                                     | `job_position`, `position_group`, `contract_form`                                                                                                           |
| Cơ quan tuyển dụng, Nghề nghiệp khi được tuyển dụng                                                   | `recruiting_agency`, `occupation_at_recruitment`                                                                                                            |
| Dạy nhóm lớp, Ngạch/Hạng                                                                              | `teaching_group`, `civil_service_rank`                                                                                                                      |
| S.tiết thực dạy trên tuần, S.tiết thực k.nhiệm trên tuần                                              | `teaching_periods_per_week`, `concurrent_periods_per_week`                                                                                                  |
| Đã tập huấn dạy KN sống, Dạy HSKT học hòa nhập, Dạy 1 buổi/ngày, Dạy 2 buổi/ngày                      | `life_skills_trained`, `teaches_inclusive`, `one_session_per_day`, `two_sessions_per_day`                                                                   |
| Mức phụ cấp thu hút nghề, thâm niên, ưu đãi nghề, chức vụ lãnh đạo (%)                                | `attraction_allowance_percent`, `seniority_allowance_percent`, `incentive_allowance_percent`, `leadership_allowance_percent`                                |
| Bậc lương, Phần trăm vượt khung (%), Hệ số lương, Ngày hưởng                                          | `salary_step`, `over_frame_percent`, `salary_coefficient`, `salary_effective_date`                                                                          |
| KQ B.dưỡng t.xuyên, T.độ c.môn n.vụ, T.độ LLCT, T.độ quản lý GD                                       | `regular_training_result`, `professional_qualification`, `political_theory_level`, `education_management_level`                                             |
| Ngoại ngữ chính, Nhóm/Loại C.Chỉ N.Ngữ, Điểm ngoại ngữ, Khung N.Lực N.Ngữ, Trình độ đào tạo ngoại ngữ | `main_foreign_language`, `language_certificate_group`, `language_certificate_type`, `language_score`, `language_framework_level`, `language_training_level` |
| T.độ tin học                                                                                          | `it_level`                                                                                                                                                  |
| Chuyên ngành chính/khác và trình độ, Cơ sở đào tạo                                                    | `main_major`, `main_major_level`, `other_major`, `other_major_level`, `training_institution`                                                                |
| Đánh giá viên chức/công chức, Giáo viên dạy giỏi, Danh hiệu phong tặng                                | `civil_servant_evaluation`, `excellent_teacher`, `honorary_titles`                                                                                          |

Kiểu giá trị trong `moet_profile`: chữ giữ nguyên; ngày đổi về YYYY-MM-DD (ngày sai là dòng lỗi); cột đánh dấu "x" lưu
`true`; số điện thoại chuẩn hóa; số căn cước, hộ chiếu, sổ bảo hiểm xã hội chỉ lưu mã hóa kèm bốn số cuối, màn hình chỉ
hiện bốn số cuối.

## 5. Quyết định (tự chọn theo chế độ tự chủ, ghi YCTD)

1. **Đọc tệp**: dòng tiêu đề là dòng đầu tiên trong năm dòng đầu có đủ các tiêu đề nhận diện (học sinh: Mã lớp, Họ tên,
   Ngày sinh; cán bộ: Họ tên, CMND/CCCD). Cột tìm theo tiêu đề (gộp khoảng trắng, xuống dòng), không theo vị trí. Thiếu
   cột bắt buộc (học sinh: Mã lớp, Họ tên, Ngày sinh, Giới tính và một trong Số định danh cá nhân, Số CCCD; cán bộ: Họ tên)
   thì từ chối cả tệp. Số định danh 11 chữ số (Excel cắt số 0 đầu khi ô là số) được thêm số 0; số điện thoại 9 chữ số hoặc
   đầu 84 được đổi về 10 chữ số bắt đầu bằng 0.
2. **Dị ứng (BR-06)**: tệp ngành không có cột dị ứng; trẻ nhập mới để **chưa khai báo** (`has_allergies` trống), bổ sung
   ở Hồ sơ trẻ. Trẻ nhập vào thẳng trạng thái đang học như nhập theo mẫu của trường (YCTD-46), thiếu giấy khai sinh, đồng
   ý hình ảnh chờ phụ huynh xác nhận.
3. **Trạng thái học sinh**: Đang học, Chuyển đến (kỳ 1, kỳ 2, trong hè), Nghỉ học xin học lại → đang học. Chuyển đi, Thôi
   học (kỳ 1, kỳ 2, trong hè): trẻ chưa có hồ sơ thì **bỏ qua, không tạo** (ghi chú dòng, không chặn tệp); trẻ đã có hồ sơ
   thì **giữ trạng thái hiện tại**, chỉ ghi trạng thái vào `moet_profile`, thôi học làm theo quy trình ở Hồ sơ trẻ. Trạng
   thái trống xem như Đang học; trạng thái ngoài danh mục là dòng lỗi.
4. **Trẻ đã có**: cập nhật họ tên, ngày sinh, giới tính, nơi sinh, địa chỉ, mã học sinh và thay toàn bộ `moet_profile`;
   không đổi đơn vị, lớp, trạng thái. Lớp trong tệp khác lớp hiện tại thì ghi chú, không tự chuyển lớp. Trẻ đã có ở đơn
   vị ngoài phạm vi người nhập là dòng lỗi.
5. **Ngày vào lớp** của trẻ mới: Ngày tuyển mới, không có thì Ngày nhập trạng thái khi trạng thái là chuyển đến hoặc xin
   học lại, không có nữa thì ngày nhập.
6. **Người thân**: tạo hoặc cập nhật mẹ, cha, người giám hộ (bỏ qua khi tệp đánh dấu "Không có thông tin cha/mẹ"). Tìm
   người thân theo số điện thoại (như nhập theo mẫu), không có số thì theo quan hệ và họ tên trong các người thân của trẻ.
   Người đã có được bổ sung nghề nghiệp, năm sinh, số định danh (mã hóa như số định danh trẻ). Mẹ đứng trước nên là người
   liên hệ chính khi trẻ chưa có. Người giám hộ trùng họ tên với cha hoặc mẹ là cùng một người, không tạo thêm. Hai người
   cùng một số điện thoại: số chỉ gắn với người đứng trước (ghi chú dòng). Trẻ mới cần ít nhất một người có số điện thoại
   (BR-06); cha mẹ đều không có số thì dùng Số điện thoại liên hệ cho người đầu tiên, vẫn không có thì là dòng lỗi.
7. **Quan hệ với trẻ**: tìm trong danh mục theo tên (Cha/Bố/Ba, Mẹ/Má, Người giám hộ), thiếu thì tạo mục mới (mã CHA, ME,
   GIAM_HO) khi ghi.
8. **Tài khoản phụ huynh**: như nhập trẻ theo mẫu: mỗi số điện thoại người thân có một tài khoản phụ huynh (tạo trước khi
   ghi, gọi lại không tạo trùng), tài khoản mới được xếp thông báo tin nhắn.
9. **Nhân sự**: nhận ra theo mã định danh Bộ GD&ĐT, không có thì CMND/CCCD (so khớp bốn số cuối rồi giải mã); một trong
   hai bắt buộc. CMND chín số hoặc CCCD mười hai số. Hồ sơ mới thuộc đơn vị đã chọn, mã nhân sự là mã định danh Bộ (không
   có hoặc đã bị dùng thì cấp mã CSDL-000001...), ngày vào làm là Ngày tuyển dụng (không có thì ngày nhập, có ghi chú).
   Trạng thái Đã chuyển đi, Đã điều động, Đã nghỉ hưu: chưa có hồ sơ thì bỏ qua; đã có thì giữ trạng thái. Nhân sự đã có
   được cập nhật họ tên, ngày sinh, giới tính, điện thoại, email, CMND/CCCD, mã định danh Bộ và toàn bộ `moet_profile`;
   không đổi đơn vị, trạng thái, ngày vào làm.
10. **Không tạo tài khoản đăng nhập và không tạo hợp đồng** cho nhân sự (nhập nhân sự theo mẫu cũng không tạo hợp đồng).
    Phòng ban, chức danh không tự gán vì danh mục của Bộ (vị trí việc làm, nhóm chức vụ) khác danh mục của trường; giá trị
    vẫn lưu trong `moet_profile`.
11. **Quyền**: tệp trẻ cần `P01.import.children` (VT-02), tệp nhân sự cần `P01.import.staff` (VT-06), trong phạm vi đơn
    vị của người nhập; đơn vị chọn ngoài phạm vi bị từ chối.

## 6. Ca kiểm thử

- CT-13a-1: tải tệp xls học sinh (tổng hợp) với đơn vị Điểm trường A1: kiểm tra trước, 2 dòng sẽ tạo mới, chưa ghi gì;
  bấm ghi thì lần nhập đã ghi — đạt.
- CT-13a-2: trẻ ghi đủ: lớp khớp tên không dấu, mã học sinh, ngày vào lớp theo ngày tuyển mới, `moet_profile` có dân tộc,
  quận/huyện cột không tên, cờ bán trú, số CCCD chỉ dạng mã hóa; dị ứng chưa khai báo; xem hồ sơ có mục CSDL ngành — đạt.
- CT-13a-3: cha, mẹ tạo kèm nghề nghiệp, năm sinh, bốn số cuối số định danh; số điện thoại 9 chữ số được thêm số 0; mẹ là
  người liên hệ chính và có tài khoản phụ huynh; trẻ "không có thông tin cha" và người giám hộ trùng tên mẹ chỉ có một
  người thân — đạt.
- CT-13a-4: nhập lại bằng xlsx: 0 tạo mới, 2 cập nhật; số trẻ, số người thân không đổi; họ tên, dân tộc được cập nhật —
  đạt.
- CT-13a-5: dòng tiêu đề ở dòng 2, số định danh mất số 0 đầu vẫn nhận; số định danh sai, lớp không có, ngày sinh sai, ngày
  nhập trạng thái sai báo đúng dòng, cột; trẻ "Chuyển đi kỳ 1" chưa có hồ sơ được bỏ qua kèm ghi chú; ghi bị từ chối
  (422), không ghi dòng nào — đạt.
- CT-13a-6: chọn Trường chính: tên lớp trùng ở hai đơn vị báo lỗi "nhiều lớp", mã lớp thì khớp — đạt.
- CT-13a-7: tệp thiếu cột Họ tên, tệp không phải Excel, thiếu đơn vị đều bị từ chối (400) — đạt.
- CT-13a-8: quản lý đơn vị, giáo viên, kế toán, phòng nhân sự tải tệp trẻ bị từ chối (403) — đạt.
- CT-13a-9: phòng nhân sự tải tệp xls cán bộ: 2 tạo mới, 1 bỏ qua (Đã nghỉ hưu); mã nhân sự là mã định danh Bộ, ngày vào
  làm là ngày tuyển dụng, không tài khoản, không hợp đồng; `moet_profile` có hệ số lương, đảng viên, quận/huyện, số sổ
  BHXH chỉ dạng mã hóa; xem hồ sơ có mục CSDL ngành — đạt.
- CT-13a-10: nhập lại tệp cán bộ bằng xlsx: cập nhật theo mã định danh Bộ và theo CMND chín số (dòng không có mã), không
  tạo trùng — đạt.
- CT-13a-11: dòng cán bộ CMND sai, ngày sinh sai, trạng thái lạ, trùng mã định danh trong tệp báo đúng dòng, cột — đạt.
- CT-13a-12: Hiệu trưởng, kế toán, giáo viên tải tệp cán bộ bị từ chối; phòng nhân sự chọn đơn vị ngoài phạm vi bị từ
  chối (403) — đạt.
- CT-13a-13 (giao diện, `tests/e2e/45-moet-import.spec.ts`): Hiệu trưởng tải tệp xlsx học sinh tổng hợp ở mục "Trẻ từ CSDL
  ngành", thấy "1 tạo mới, 0 cập nhật", ghi dữ liệu; hồ sơ trẻ ở lớp Mầm 9 có mục "Thông tin theo CSDL ngành" với dân tộc
  và quận/huyện — đạt.
- CT-13a-14 (chạy thử cục bộ, không đưa vào kho mã): tệp mẫu thật của trường (304 học sinh, 52 cán bộ) đọc đủ 82 và 75
  cột, không dòng lỗi; học sinh 269 tạo mới, 35 bỏ qua (chuyển đi, thôi học); nhập lại 269 cập nhật; cán bộ 52 tạo mới —
  đạt.

## 7. Giới hạn

- Tối đa 2.000 dòng và 5 MB mỗi tệp; chỉ đọc trang tính đầu tiên; các trang danh mục (DAN_TOC, TINH...) không đối chiếu,
  giá trị danh mục lưu nguyên chữ.
- Không tự chuyển lớp, chuyển đơn vị, cho thôi học hay nghỉ việc theo tệp; các việc này làm ở màn hình nghiệp vụ.
- Không xuất ngược dữ liệu lên CSDL ngành.
- Trẻ có trạng thái chuyển đi, thôi học chưa có hồ sơ không được tạo (không lưu lịch sử của trẻ đã rời trường).
- `moet_profile` thay toàn bộ mỗi lần nhập; giá trị bị xóa trong tệp cũng bị xóa trong hồ sơ.
- Nhân sự không có cả mã định danh Bộ lẫn CMND/CCCD là dòng lỗi.
