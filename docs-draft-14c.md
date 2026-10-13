# Nháp tài liệu DT-14 phần 14c — Hoàn thành chương trình, chuẩn nghề nghiệp, nhóm trẻ (YCTD-102)

## YCTD

### YCTD-102: Hoàn thành chương trình giáo dục mầm non, đánh giá chuẩn nghề nghiệp, nhóm trẻ – 2026-10-13

- Lý do: Eric yêu cầu ngày 2026-10-13, làm theo phân hệ mầm non của hệ thống quản lý trường học của Sở GD&ĐT TP.HCM: mục 4.4 (quản lý hoàn thành chương trình mầm non), mục 3.2 (đánh giá chuẩn nghề nghiệp), mục 4.1.6, 4.1.7 (nhóm học sinh). Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi:
  - Hoàn thành chương trình giáo dục mầm non: áp dụng cho lớp có bậc học mà tháng tuổi bắt đầu từ 60 trở lên (mẫu giáo 5-6 tuổi, theo danh mục bậc học của trường). Cuối năm học ghi cho từng trẻ đang học của lớp (trẻ trạng thái đang học, lớp hiện tại) kết quả Hoàn thành hoặc Chưa hoàn thành kèm ghi chú (tối đa 500 ký tự). Ghi nhiều trẻ một lần, có nút đánh dấu cả lớp hoàn thành rồi sửa từng trẻ; ghi lại thì thay kết quả cũ (một kết quả mỗi trẻ mỗi năm học). Giáo viên chủ nhiệm (VT-07) ghi cho lớp mình chủ nhiệm; quản lý đơn vị (VT-03) ghi cho mọi lớp của đơn vị.
  - Ban Giám hiệu (VT-02 toàn trường, VT-15 theo đơn vị được gán) xác nhận danh sách của lớp khi mọi trẻ đang học đã có kết quả và lớp có ít nhất một trẻ; đã xác nhận thì khóa, không ghi sửa được. Hủy xác nhận bắt buộc lý do, ghi nhật ký thao tác (giá trị trước là dòng xác nhận, giá trị sau là lý do), sau đó sửa và xác nhận lại.
  - Thống kê theo lớp và theo đơn vị: số lớp, số lớp đã xác nhận, số trẻ đang học, số hoàn thành, chưa hoàn thành, chưa ghi, tỷ lệ hoàn thành (số hoàn thành chia số trẻ đang học, phần trăm, làm tròn 2 chữ số; lớp chưa có trẻ là 0) và tổng toàn phạm vi.
  - Xuất danh sách ra Excel theo một lớp hoặc mọi lớp trong phạm vi (lọc được đơn vị): STT, đơn vị, lớp, họ tên trẻ, ngày sinh, giới tính, kết quả, ghi chú, trạng thái xác nhận. Mỗi lần xuất ghi một dòng nhật ký xuất (`export_logs`, mã báo cáo `program-completion`, có dữ liệu cá nhân) theo BR-74; người xem được danh sách thì xuất được, không cần `P17.data.export` vì danh sách thuộc nghiệp vụ của lớp.
  - Nhóm trẻ: nhóm có tên (duy nhất trong đơn vị), mô tả, giáo viên phụ trách (không bắt buộc, chọn từ hồ sơ nhân sự đang làm việc của đơn vị), trạng thái đang dùng hoặc ngừng dùng. Thêm nhiều trẻ một lần (chọn lớp rồi chọn trẻ hoặc cả lớp), chỉ trẻ đang học của đơn vị có nhóm; thêm trùng không lỗi; bớt trẻ. Một trẻ thuộc nhiều nhóm. Nhóm ngừng dùng không thêm trẻ được. Danh sách hồ sơ trẻ lọc được theo nhóm (`group_id`), phạm vi xem trẻ vẫn áp dụng.
  - Quản lý nhóm: Ban Giám hiệu, quản lý đơn vị có `P02.child-group.manage` trong phạm vi đơn vị. Giáo viên xem nhóm mình phụ trách (thấy mọi trẻ của nhóm) và nhóm có trẻ thuộc lớp mình được phân công (chỉ thấy trẻ trong phạm vi xem trẻ của mình, BR-72). Nhóm trẻ gắn với năm học, không chuyển sang năm mới.
  - Chuẩn nghề nghiệp: danh mục tiêu chuẩn, tiêu chí dùng chung toàn trường, gieo sẵn khi tạo cơ sở dữ liệu năm học: chuẩn nghề nghiệp giáo viên mầm non theo Thông tư 26/2018/TT-BGDĐT (5 tiêu chuẩn, 15 tiêu chí) và chuẩn hiệu trưởng cơ sở giáo dục mầm non theo Thông tư 25/2018/TT-BGDĐT (5 tiêu chuẩn, 18 tiêu chí). Chỉ gieo tên ngắn của tiêu chuẩn, tiêu chí, không chép nội dung văn bản; **cần đối chiếu văn bản** về tên và số tiêu chí của từng tiêu chuẩn (đặc biệt tiêu chuẩn 3 và 5 của chuẩn giáo viên, tiêu chuẩn 5 của chuẩn hiệu trưởng). Hiệu trưởng (`P07.professional-standard.manage`, cần phạm vi toàn trường) sửa tên tiêu chuẩn, tên tiêu chí, đánh dấu tiêu chí trọng yếu, ngừng hoặc dùng lại tiêu chí, thêm tiêu chí (mã tự đánh tiếp theo số lớn nhất của chuẩn). Sửa danh mục chỉ áp cho phiếu mở sau; phiếu đã mở giữ tiêu chí lúc mở. Mở năm học mới thì danh mục của năm cũ thay cho danh mục gieo sẵn.
  - Phiếu đánh giá: mỗi nhân sự một phiếu mỗi năm học, loại chuẩn chọn lúc mở (giáo viên hoặc hiệu trưởng; chuẩn hiệu trưởng dùng cho Hiệu trưởng, Phó Hiệu trưởng, quản lý đơn vị). Người đánh giá mở phiếu cho nhiều nhân sự đang làm việc một lần; nhân sự đã có phiếu thì bỏ qua và báo lại; nhân sự có tài khoản nhận thông báo mời tự đánh giá.
  - Luồng: chờ tự đánh giá → nhân sự tự đánh giá từng tiêu chí (mức và minh chứng, tối đa 2000 ký tự), lưu nhiều lần, gửi khi đủ mọi tiêu chí → chờ đánh giá → người đánh giá ghi mức từng tiêu chí, nhận xét từng tiêu chí và nhận xét chung, lưu nhiều lần → chốt khi đủ mọi tiêu chí: hệ thống xếp loại chung theo quy tắc dưới đây, nhân sự nhận thông báo kết quả. Phiếu đã gửi không tự sửa; phiếu đã chốt không sửa. Mức kết quả cuối từng tiêu chí là mức của người đánh giá. Chưa làm bước đánh giá của đồng nghiệp (góp ý của tổ chuyên môn), xem mục hạn chế.
  - Người đánh giá: phiếu chuẩn giáo viên do người có `P07.professional-standard.assess` (VT-03, VT-02) trong phạm vi đơn vị chính của nhân sự; phiếu chuẩn hiệu trưởng chỉ người có `P07.professional-standard.manage` (VT-02). Không ai mở, đánh giá, chốt phiếu của chính mình.
  - Quy tắc xếp loại chung (theo cách xếp loại của hai thông tư, **cần đối chiếu văn bản**; tiêu chí trọng yếu là tiêu chí đánh dấu trên danh mục, mặc định là các tiêu chí của tiêu chuẩn 1 và 2):
    - Chưa đạt: có tiêu chí Chưa đạt.
    - Tốt: mọi tiêu chí từ Khá trở lên, ít nhất 2/3 số tiêu chí đạt Tốt, mọi tiêu chí trọng yếu đạt Tốt.
    - Khá: mọi tiêu chí từ Đạt trở lên, ít nhất 2/3 số tiêu chí từ Khá trở lên, mọi tiêu chí trọng yếu từ Khá trở lên.
    - Đạt: các trường hợp còn lại (mọi tiêu chí từ Đạt trở lên).
    - “Ít nhất 2/3” so sánh số nguyên: số tiêu chí × 3 ≥ tổng số tiêu chí × 2.
  - Thống kê chuẩn nghề nghiệp theo loại chuẩn trong phạm vi (lọc được đơn vị): số phiếu, số đã chốt, số chưa chốt, số phiếu và tỷ lệ từng mức xếp loại trên số phiếu đã chốt.
  - Không dùng lại phân hệ đánh giá nhân sự theo kỳ (P09-05, chấm điểm theo chỉ số của đơn vị) vì chuẩn nghề nghiệp xếp mức theo tiêu chí của văn bản, không chấm điểm; tách thành màn hình “Chuẩn nghề nghiệp” riêng.
  - Nhập mức đánh giá từ Excel (mục 3.2.2 của hệ thống Sở) chưa làm, xem mục hạn chế.
- Thành phần bị ảnh hưởng: `05`, `07`, `08`, `14`, `16`, `17`, `21`, `01`, `02`, `03`, `23`, `index.md`; máy chủ API, cổng quản trị.
- Dữ liệu bị ảnh hưởng: tám bảng mới của năm học (tệp 0047); năm quyền mới (tệp 0037 của định danh).
- API bị ảnh hưởng: nhóm điểm cuối `/program-completion`, `/child-groups`, `/professional-standards`, `/professional-criteria`, `/professional-evaluations`, `/me/professional-evaluation`; `GET /children` thêm lọc `group_id`.
- Giao diện bị ảnh hưởng: ba màn hình mới trên cổng quản trị; màn hình Hồ sơ trẻ thêm ô lọc “Nhóm trẻ” (hiện khi có nhóm).
- Quyền bị ảnh hưởng: PQ mới (xem mục Quyền).
- Ảnh hưởng chức năng cũ: không đổi hành vi cũ.
- Kiểm thử cần thực hiện: CT-14c-1 đến CT-14c-10; kiểm thử giao diện `tests/e2e/48-standards-groups.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

| program_completions | Kết quả hoàn thành chương trình của trẻ (YCTD-102); một dòng mỗi trẻ mỗi năm học | child_id (duy nhất), class_id, org_unit_id, result (completed, not_completed), note, recorded_by, recorded_by_name |
| program_completion_confirmations | Xác nhận danh sách của lớp; có dòng là đã khóa, hủy xác nhận thì xóa dòng (nhật ký thao tác giữ lý do) | class_id (duy nhất), org_unit_id, completed_count, children_count, confirmed_by, confirmed_by_name, confirmed_at |
| child_groups | Nhóm trẻ trong đơn vị | org_unit_id, name (duy nhất trong đơn vị), description, teacher_staff_id, status (active, inactive), created_by |
| child_group_members | Trẻ của nhóm | group_id, child_id (khóa chính hai cột), added_by, created_at |
| professional_standards | Tiêu chuẩn của chuẩn nghề nghiệp, dùng chung toàn trường | standard_type (teacher, principal), code (TC1 đến TC5), name, order_no |
| professional_criteria | Tiêu chí của chuẩn, đánh số liên tục trong cả chuẩn | standard_id, standard_type, code (duy nhất theo loại chuẩn), name, is_key, order_no, status (active, inactive) |
| professional_evaluations | Phiếu đánh giá chuẩn nghề nghiệp; một phiếu mỗi nhân sự mỗi năm học | staff_id (duy nhất), org_unit_id, standard_type, status (self_assessing, self_submitted, finalized), self_submitted_at, overall_level (not_met, met, good, excellent), assessor_comment, opened_by, finalized_by, finalized_by_name, finalized_at |
| professional_evaluation_items | Tiêu chí của phiếu, chụp lúc mở phiếu | evaluation_id, criterion_id, standard_code, standard_name, criterion_code, criterion_name, is_key, order_no, self_rating, self_evidence, assessor_rating, assessor_note |

## Điểm cuối

| GET | /api/v1/program-completion/classes | Lớp mẫu giáo 5-6 tuổi trong phạm vi kèm số liệu (lọc org_unit_id) |
| GET | /api/v1/program-completion/statistics | Thống kê theo lớp, đơn vị và tổng |
| GET | /api/v1/program-completion/export | Xuất Excel theo class_id hoặc org_unit_id, ghi nhật ký xuất |
| GET, PUT | /api/v1/program-completion/classes/{id} | Danh sách trẻ kèm kết quả; ghi kết quả nhiều trẻ (`items`: child_id, result, note) |
| POST | /api/v1/program-completion/classes/{id}/confirm | Xác nhận danh sách của lớp |
| POST | /api/v1/program-completion/classes/{id}/unconfirm | Hủy xác nhận kèm `reason` |
| GET, POST | /api/v1/child-groups | Danh sách nhóm trong phạm vi (lọc org_unit_id); lập nhóm |
| GET, PATCH | /api/v1/child-groups/{id} | Chi tiết nhóm kèm trẻ; sửa tên, mô tả, giáo viên phụ trách, trạng thái |
| POST | /api/v1/child-groups/{id}/members | Thêm trẻ (`child_ids`, 1 đến 200) |
| POST | /api/v1/child-groups/{id}/members/remove | Bớt trẻ (`child_ids`) |
| GET | /api/v1/professional-standards | Danh mục tiêu chuẩn kèm tiêu chí (lọc standard_type) |
| PATCH | /api/v1/professional-standards/{id} | Sửa tên tiêu chuẩn |
| POST | /api/v1/professional-criteria | Thêm tiêu chí (`standard_id`, `name`, `is_key`) |
| PATCH | /api/v1/professional-criteria/{id} | Sửa tên, tiêu chí trọng yếu, trạng thái |
| GET, POST | /api/v1/professional-evaluations | Danh sách phiếu trong phạm vi (lọc org_unit_id, standard_type, status); mở phiếu (`standard_type`, `staff_ids`) |
| GET | /api/v1/professional-evaluations/statistics | Thống kê theo loại chuẩn và mức |
| GET | /api/v1/me/professional-evaluation | Phiếu của chính mình trong năm học (`evaluation` trống khi chưa mở) |
| GET | /api/v1/professional-evaluations/{id} | Chi tiết phiếu kèm tiêu chí |
| PUT | /api/v1/professional-evaluations/{id}/self | Tự đánh giá (`items`: criterion_id, rating, evidence) |
| POST | /api/v1/professional-evaluations/{id}/submit-self | Gửi tự đánh giá |
| PUT | /api/v1/professional-evaluations/{id}/assessment | Người đánh giá ghi mức (`items`: criterion_id, rating, note; `comment`) |
| POST | /api/v1/professional-evaluations/{id}/finalize | Chốt phiếu, xếp loại chung |

Vi phạm quy tắc nghiệp vụ của phần này trả `ERR_RULE_VIOLATION` với mã `YCTD-102` (lớp không phải mẫu giáo 5-6 tuổi, lớp đã xác nhận, còn trẻ chưa ghi, phiếu không ở bước phù hợp, còn tiêu chí chưa có mức).

## Màn hình

| MH mới | Hoàn thành chương trình (nhóm TRẺ VÀ LỚP, `/program-completion`): thống kê theo đơn vị, danh sách lớp mẫu giáo 5-6 tuổi kèm tỷ lệ, mở lớp để ghi kết quả từng trẻ hoặc đánh dấu cả lớp, xác nhận, hủy xác nhận kèm lý do, xuất Excel một lớp hoặc các lớp | VT-07 (lớp chủ nhiệm), VT-03; VT-02, VT-15 xác nhận |
| MH mới | Nhóm trẻ (nhóm TRẺ VÀ LỚP, `/child-groups`): lập nhóm, giáo viên phụ trách, xem trẻ của nhóm, thêm trẻ theo lớp, bớt trẻ | VT-02, VT-15, VT-03; giáo viên xem |
| MH mới | Chuẩn nghề nghiệp (nhóm NHÂN SỰ, `/professional-standards`): phiếu tự đánh giá của tôi, mở phiếu, thống kê xếp loại, phiếu của đơn vị, đánh giá và chốt phiếu, danh mục tiêu chuẩn, tiêu chí | Mọi nhân sự tự đánh giá; VT-03, VT-02 đánh giá; VT-02 sửa danh mục |

Số MH do người điều phối đánh khi gộp tài liệu. Màn hình Hồ sơ trẻ (MH-02) thêm ô lọc Nhóm trẻ.

## Quyền

| PQ mới | Hoàn thành chương trình (YCTD-102): `P02.program-completion.manage` cho VT-03 (mọi lớp của đơn vị), VT-07 (chỉ lớp đang chủ nhiệm) ghi kết quả; `P02.program-completion.approve` cho VT-02 (toàn trường), VT-15 (đơn vị được gán) xác nhận, hủy xác nhận. Người có một trong hai quyền xem và xuất danh sách trong phạm vi |
| PQ mới | Nhóm trẻ (YCTD-102): `P02.child-group.manage` cho VT-02, VT-15, VT-03 lập, sửa nhóm, thêm, bớt trẻ trong phạm vi đơn vị. Giáo viên không cần quyền: xem nhóm mình phụ trách và nhóm có trẻ lớp mình |
| PQ mới | Chuẩn nghề nghiệp (YCTD-102): `P07.professional-standard.manage` cho VT-02 sửa danh mục, mở và đánh giá mọi phiếu kể cả chuẩn hiệu trưởng; `P07.professional-standard.assess` cho VT-03 (và VT-02) mở, đánh giá, chốt phiếu chuẩn giáo viên của nhân sự trong đơn vị. Mọi nhân sự tự đánh giá phiếu của mình; không ai đánh giá phiếu của chính mình |

## Kết quả kiểm thử

Kiểm thử tự động `apps/api/src/professional-standards/standards-groups.test.ts` ngày 13/10/2026:

- CT-14c-1: Xếp loại chung với các tổ hợp mức (có Chưa đạt, có Đạt, đủ hoặc thiếu 2/3 Tốt hoặc Khá, tiêu chí trọng yếu thấp hơn) và tỷ lệ hoàn thành 2/3, 0/0: Chưa đạt, Tốt, Khá, Đạt đúng quy tắc; tỷ lệ 66,67 và 0 — đạt.
- CT-14c-2: Giáo viên chủ nhiệm, quản lý đơn vị xem lớp; giáo viên ghi kết quả lớp mình; giáo viên khác, quản lý đơn vị khác ghi; ghi cho lớp Mầm; ghi cho trẻ không học lớp; kết quả sai giá trị: chỉ thấy lớp mẫu giáo 5-6 tuổi trong phạm vi; ghi được, số liệu cập nhật; bị từ chối; trả YCTD-102; lỗi dữ liệu hai trường hợp cuối — đạt.
- CT-14c-3: Xác nhận khi còn trẻ chưa ghi; quản lý đơn vị xác nhận; Phó Hiệu trưởng xác nhận khi đủ; giáo viên sửa sau xác nhận; hủy xác nhận không lý do, có lý do; xác nhận lại: trả YCTD-102; bị từ chối; xác nhận được; trả YCTD-102; lỗi dữ liệu; mở khóa; xác nhận được — đạt.
- CT-14c-4: Thống kê toàn trường, theo đơn vị; xuất Excel một lớp; xuất lớp ngoài phạm vi: 2/4 trẻ (50%), đơn vị 66,67%; tệp Excel, nhật ký xuất có 3 dòng và dữ liệu cá nhân; bị từ chối — đạt.
- CT-14c-5: Quản lý đơn vị lập nhóm có giáo viên phụ trách; trùng tên; quản lý đơn vị khác, giáo viên lập; giáo viên phụ trách thuộc đơn vị khác; thêm trẻ, thêm trẻ đơn vị khác, thêm lại; một trẻ vào nhóm thứ hai; lọc danh sách trẻ theo nhóm: lập được; xung đột; bị từ chối; lỗi dữ liệu; thêm được, lỗi dữ liệu, không trùng; được; đúng trẻ của nhóm — đạt.
- CT-14c-6: Giáo viên chủ nhiệm xem nhóm; giáo viên phụ trách xem; quản lý đơn vị khác xem; bớt trẻ; giáo viên bớt trẻ: thấy hai nhóm có trẻ lớp mình, chỉ thấy trẻ của lớp mình; thấy mọi trẻ; bị từ chối; bớt được; bị từ chối — đạt.
- CT-14c-7: Xem danh mục; quản lý đơn vị sửa tiêu chí; Hiệu trưởng sửa: 5 tiêu chuẩn, 15 tiêu chí giáo viên, 5 tiêu chuẩn, 18 tiêu chí hiệu trưởng, tiêu chí tiêu chuẩn 1 là trọng yếu; bị từ chối; sửa được — đạt.
- CT-14c-8: Quản lý đơn vị khác mở phiếu; quản lý đơn vị mở chuẩn hiệu trưởng; mở chuẩn giáo viên cho hai giáo viên, mở lại; gửi khi thiếu tiêu chí; đánh giá trước khi gửi; người khác tự đánh giá; gửi đủ; giáo viên tự đánh giá phần người đánh giá; quản lý đánh giá 14 Khá 1 Đạt rồi chốt; sửa sau chốt; thông báo: bị từ chối hai lần; mở 2 phiếu, lần sau bỏ qua; trả YCTD-102 hai lần; bị từ chối; chờ đánh giá; bị từ chối; xếp loại Khá; trả YCTD-102; giáo viên nhận thông báo mở phiếu và kết quả — đạt.
- CT-14c-9: Hiệu trưởng mở chuẩn hiệu trưởng cho quản lý đơn vị; quản lý đơn vị đánh giá phiếu của mình; Hiệu trưởng đánh giá mọi tiêu chí Tốt rồi chốt: 18 tiêu chí, không có quyền đánh giá phiếu của mình, bị từ chối; xếp loại Tốt — đạt.
- CT-14c-10: Thống kê của Hiệu trưởng; giáo viên xem thống kê; quản lý đơn vị khác xem phiếu: chuẩn giáo viên 2 phiếu, 1 đã chốt Khá, 1 chưa chốt, chuẩn hiệu trưởng 1 Tốt; bị từ chối; danh sách trống — đạt.

Kiểm thử chuyển năm học `apps/api/src/academic-years/year-transition.test.ts`, kiểm thử hồ sơ trẻ `apps/api/src/children/children.test.ts`, kiểm thử giảng dạy vẫn đạt. Kiểm thử giao diện `tests/e2e/48-standards-groups.spec.ts`: ba luồng chính (ghi cả lớp và xác nhận; lập nhóm và thêm cả lớp; mở phiếu, tự đánh giá, đánh giá và chốt) đạt; cả bộ 68 ca kiểm thử giao diện đạt ngày 13/10/2026.

## Hạn chế

- Tên và số tiêu chí gieo sẵn là tên ngắn, cần đối chiếu Thông tư 26/2018/TT-BGDĐT và Thông tư 25/2018/TT-BGDĐT; quy tắc xếp loại Khá, Tốt (2/3 số tiêu chí, tiêu chí trọng yếu) cần đối chiếu điều khoản xếp loại của từng thông tư; Hiệu trưởng chỉnh danh mục, tiêu chí trọng yếu được, quy tắc 2/3 cố định trong mã.
- Chưa có bước đánh giá của đồng nghiệp, tổ chuyên môn; chưa có phiếu đánh giá Hiệu trưởng do cấp trên (Phòng GD&ĐT) vì Hiệu trưởng không tự đánh giá phiếu của mình trên hệ thống.
- Chưa có nhập mức đánh giá chuẩn nghề nghiệp từ Excel (mục 3.2.2 của hệ thống Sở); chưa có xuất Excel kết quả chuẩn nghề nghiệp.
- Phiếu đã chốt không mở lại; chưa có thao tác trả phiếu về để nhân sự tự đánh giá lại, chưa có hủy phiếu đã mở nhầm loại chuẩn.
- Hoàn thành chương trình chỉ tính trẻ trạng thái đang học ở lớp hiện tại; trẻ chuyển lớp giữ kết quả theo trẻ (một kết quả mỗi trẻ), trẻ đã nghỉ không vào danh sách. Chưa in giấy chứng nhận hoàn thành chương trình.
- Thông báo cho phụ huynh về kết quả hoàn thành chương trình chưa làm.
- Kiểm thử chạy với cơ sở dữ liệu định danh riêng (`school_identity_dt14c`) để không chạy tệp 0037 trên cơ sở dữ liệu định danh dùng chung khi tệp 0036 của nhánh khác chưa gộp (Kysely từ chối tệp thay đổi cấu trúc chạy không theo thứ tự).
