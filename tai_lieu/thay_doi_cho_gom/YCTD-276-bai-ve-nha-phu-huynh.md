---
yctd: YCTD-276
tieu_de: DT-28 phần 28f: bài về nhà và phụ huynh
ngay: 2026-10-28
phien_ban_de_xuat: 0.164.0
---

## 02 Nhật ký

### 2026-10-28 — DT-28 phần 28f: bài về nhà và phụ huynh

#### Công việc đã thực hiện

- Làm phần 28f theo `32` mục 20.6, 20.7. Bài về nhà là bài tập 28c ngữ cảnh `homework`; soạn, chấm, trả bài dùng lại 28c.
- Giao từ sổ đầu bài:
  - Tiết đã ghi có khối "Bài về nhà của tiết" và nút "Giao bài về nhà".
  - Máy tạo hoạt động bài tập ở lớp học trực tuyến của lớp và môn, gắn `class_log_id`, nhóm của tiết.
  - Hạn mặc định là đầu tiết kế tiếp của môn theo thời khoá biểu.
- Quy tắc khối lượng do trường tự đặt (GD-143), mục 9.6 Bài về nhà:
  - Ban Giám hiệu đặt theo cấp, khối: số bài, số phút mỗi ngày, thứ không để hạn, ngày lễ, khối không giao, cảnh báo hay chặn, căn cứ.
  - Nền tảng không đặt giới hạn mặc định; bảng mẫu gợi ý (chưa xác minh) chỉ để tham khảo.
- Lịch khối lượng 7 ngày của lớp:
  - Giáo viên xem ngay trước khi phát hành bài về nhà.
  - Chủ nhiệm, giáo viên của lớp, Ban Giám hiệu xem theo lớp, tuần ở mục 9.6.
- Phát hành theo quy tắc của trường:
  - Cảnh báo thì giáo viên xác nhận "Vẫn giao".
  - Chặn thì Ban Giám hiệu cho vượt có lý do (lưu trên bài).
- Phụ huynh:
  - "Bài tập về nhà của con" theo ngày đến hạn: trạng thái, kết quả, nhận xét khi thầy cô đã trả.
  - "Đã xem cùng con".
  - Nộp thay khi con chưa có tài khoản học (chụp vở, ghi âm, gõ ngắn); bài ghi người nộp là phụ huynh.
  - Trao đổi với thầy cô trên bài đã nộp.
- Nhắc bài về nhà: việc nền 15 phút một lượt gửi bốn loại nhắc tới phụ huynh (trong ứng dụng, tin đẩy) và tài khoản học của em.
  - Đã giao, sắp đến hạn (từ 19:00 hôm trước, trường đổi được), chưa nộp khi quá hạn, đã trả.
  - Giờ yên lặng 21:00 đến 6:00; nhiều bài của một em gộp một thông báo; mỗi bài, mỗi em, mỗi loại chỉ nhắc một lần.
- Vắng có phép ngày giao: màn hình bài của giáo viên gợi ý "Gia hạn 2 ngày" hoặc "Miễn".
- Kiểm thử: 9/9 ca của `homework-rules.test.ts`, `homework.test.ts`; hồi quy 123/123 ca (`homework`, `assignments`, `discussions`, `progress`, `learning`, `school-levels`, `quick-links`, `school-plan`, `child-groups`, `class-logs`); `migrate.test.ts`; e2e `215-homework-parents` đạt (chạy kèm spec nền 01 đến 09; spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường).

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-276):
  - Khối lượng tính theo ngày đến hạn (giờ Việt Nam); bài chưa ghi số phút tính 0 phút; quy tắc của khối thay quy tắc chung của cấp.
  - Bài tính vào khối lượng là bài về nhà đã phát hành của mọi môn trong lớp.
  - Hạn mặc định tìm tiết kế tiếp trong 14 ngày, bỏ ngày lễ; không thấy thì 7 giờ sáng sau 7 ngày.
  - Vượt quy tắc chặn: Ban Giám hiệu không có quyền phát hành bài tập (`P02.assignment.manage`) nên cho vượt trên bài trước, giáo viên phát hành sau.
  - Nộp thay chỉ cho bài làm cá nhân, con chưa có tài khoản học, chưa có bài nộp.
  - Phụ huynh trao đổi trên bài được cả khi con có tài khoản.
- 28f thêm bốn mẫu thông báo theo kế hoạch: `homework_assigned`, `homework_due_soon`, `homework_missing`, `homework_returned`.
- Không thêm quyền mới, không có migration định danh.
- Mã khối riêng (BR-360, AC-1020, MH-480, CT-1310, BM-190, PQ-150, P03-40) để không va với 28e, 27d1, 27d2 đang mở; dòng bảng mới neo vào dòng của 28b.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-276, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Lịch học tập của 28e chưa tách riêng bài về nhà (bài về nhà hiện như mọi hoạt động có hạn).
- Kho chưa có tài liệu hướng dẫn sử dụng; bảng mẫu gợi ý đặt ở mục 9.6.

## 24 Yêu cầu thay đổi

### YCTD-276: DT-28 phần 28f: bài về nhà và phụ huynh – 2026-10-28

- Lý do: phần 28f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 20.6, 20.7 (kế hoạch DT-28 ở YCTD-270); Eric yêu cầu bài về nhà là một trong bốn tính năng chính của DT-28.
- Căn cứ:
  - Thông tư 15/2026 Điều lệ, khoản 1 Điều 33 (học sinh được bảo đảm thời gian tự học ở nhà) và Công văn 3977 (không giao bài tập về nhà cho lớp 1): phiên này không đọc lại văn bản gốc.
  - Theo GD-143 (Eric chốt 2026-10-26), nền tảng không đặt giới hạn nào theo các văn bản này; trường tự đối chiếu và ghi căn cứ ở quy tắc. Bảng mẫu gợi ý ghi rõ "chưa xác minh".
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Giao từ sổ đầu bài**:
    - Giáo viên của lớp học trực tuyến (lớp và môn của tiết) tạo bài về nhà từ tiết đã ghi.
    - Hoạt động bài tập ở chương đầu (chưa có chương thì tạo chương "Bài về nhà").
    - `assignments.context = homework`, `class_log_id`, `group_no` của tiết.
    - Hạn là đầu tiết kế tiếp cùng môn, cùng nhóm theo thời khoá biểu trong 14 ngày, bỏ ngày lễ; không thấy thì 7:00 sau 7 ngày.
    - Sổ đầu bài hiện bài về nhà của tiết đọc từ bảng bài tập. Màn hình soạn không gửi ngữ cảnh thì giữ ngữ cảnh đã có.
  - **Quy tắc khối lượng** (`homework_policies`, GD-143):
    - Cấp TH, THCS, THPT; khối 0 là chung của cấp, quy tắc của khối thay quy tắc chung.
    - Khối không giao; số bài, số phút mỗi ngày; thứ không để hạn; không để hạn vào ngày lễ; cảnh báo hoặc chặn; căn cứ.
    - Chưa có quy tắc thì không chặn, không cảnh báo.
  - **Phát hành bài về nhà**: tính bài về nhà đã phát hành của mọi môn trong lớp có cùng ngày đến hạn.
    - Vượt quy tắc cảnh báo: giáo viên gửi `confirm_warnings` để vẫn giao.
    - Vượt quy tắc chặn: Ban Giám hiệu cho vượt trên bài có lý do (`policy_override_reason`, `policy_override_by`), giáo viên phát hành sau.
  - **Lịch khối lượng**:
    - Bảy ngày theo ngày đến hạn: số bài, số phút của bài đã phát hành; bài đang soạn hiện thêm, không cộng.
    - Giáo viên xem quanh ngày đến hạn ở màn hình phát hành.
    - Chủ nhiệm, giáo viên của lớp, Ban Giám hiệu xem theo lớp, tuần ở mục 9.6.
  - **Phụ huynh**:
    - Danh sách bài về nhà đã giao của con (60 bài mới nhất) theo ngày đến hạn.
    - Trạng thái: chưa nộp, quá hạn, đã nộp, đã trả, được miễn. Điểm, mức, nhận xét chỉ khi thầy cô đã trả.
    - "Đã xem cùng con" (`homework_acknowledgements`).
    - Nộp thay: bài làm cá nhân, con chưa có tài khoản học, chưa có bài nộp; ảnh, PDF, ghi âm, chữ.
      - Dùng chung giới hạn tệp của 28c; `submitted_by_kind = guardian`.
    - Trao đổi trên bài đã nộp (`submission_comments`, `author_kind = guardian`).
  - **Nhắc** (`homework_reminders` là khóa chống gửi trùng; mẫu `homework_assigned`, `homework_due_soon`, `homework_missing`, `homework_returned`):
    - Mỗi loại trong 3 ngày kể từ sự việc: phát hành, giờ nhắc hôm trước ngày đến hạn (mặc định 19:00, `homework_reminder_time`, từ 06:00 đến trước 21:00), quá hạn chưa nộp, trả bài.
    - Không gửi từ 21:00 đến 6:00. Gộp các bài của một em trong lượt; em được miễn không nhắc.
    - Người nhận: phụ huynh (trong ứng dụng, tin đẩy) và tài khoản học của em (trong ứng dụng).
  - **Vắng có phép ngày giao**: học sinh nhận bài có báo vắng có phép (`absence_records.is_advised`) đúng ngày phát hành được gợi ý gia hạn (chưa có hạn riêng) hoặc miễn; giáo viên bấm thì đổi qua tuyến học sinh nhận bài của 28c.
- Thành phần bị ảnh hưởng:
  - `apps/api`:
    - Thư mục mới `learning/homework`.
    - Sửa `learning/assignments`: kiểm quy tắc khi phát hành, giữ ngữ cảnh khi lưu, tách phần làm bài để phụ huynh nộp thay.
    - Đăng ký thêm cuối `application.module.ts`; danh sách ở `working-level.test.ts`.
  - `apps/teacher`: `HomeworkPanels.tsx`, `ClassLogScreen.tsx`, `AssignmentScreen.tsx` (ô "Làm ở đâu", "Số phút dự kiến").
  - `apps/parent`: `ChildHomeworkPanel.tsx`, `OnlineLearningPanel.tsx`.
  - `apps/portal`: `HomeworkPage.tsx`, `router.tsx`.
  - `packages/shared`: đường dẫn, quy tắc menu, mục 9.6.
  - `database`: năm học 0185, 0186.
  - `tests/e2e/215-homework-parents.spec.ts`.
- Dữ liệu bị ảnh hưởng: năm học `0185` (thêm cột `assignments`, bảng `homework_policies`, `homework_acknowledgements`), `0186` (`homework_reminders`).
- API bị ảnh hưởng: nhóm `/api/v1/learning/homework`, `/api/v1/learning/children/{childId}/homework`; tuyến phát hành bài tập nhận thêm `confirm_warnings` (xem `17_DAC_TA_API.md` mục 17.6).
- Giao diện bị ảnh hưởng: MH-480 đến MH-483.
- Quyền bị ảnh hưởng: PQ-150 (không thêm mã quyền).
- Ảnh hưởng chức năng cũ:
  - Bài tập trên lớp không đổi.
  - Phát hành bài về nhà có thể bị cảnh báo, chặn khi trường đã đặt quy tắc.
  - Lưu bài không gửi ngữ cảnh thì giữ ngữ cảnh cũ (trước đây về "trên lớp").
- Kiểm thử cần thực hiện: kiểm thử đơn vị toàn kho; e2e `single` (spec 215 cùng các spec hiện có); typecheck, lint, build.
- Chưa làm (YCTD sau): bài về nhà tách riêng trong lịch học tập; học liệu gắn kèm khi giao từ sổ đầu bài (giáo viên thêm câu học liệu ở màn hình soạn).
- Trạng thái: Đã triển khai (PR chờ)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-28 phần 28f, bài về nhà và phụ huynh (YCTD-276).
- Chức năng mới:
  - Giao bài về nhà từ sổ đầu bài (P03-40, MH-480).
  - Quy tắc khối lượng của trường (P03-41, MH-483).
  - Lịch khối lượng (P03-42, MH-481, MH-483).
  - Bài tập của con, nộp thay (P03-43, MH-482).
  - Nhắc bài về nhà (P03-44).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0185`, `0186`; xem `16_CO_SO_DU_LIEU.md` mục 18L.
- Thay đổi API: xem `17_DAC_TA_API.md` mục 17.6.
- Kiểm thử: kịch bản CT-1310 đến CT-1319 (CT-28f-1 đến CT-28f-10 trong mã kiểm thử); `apps/api` 9/9 ca của 28f, e2e 215 đạt ngày 28/10/2026.
- Rủi ro: trường đặt quy tắc chặn quá chặt thì giáo viên phải chờ Ban Giám hiệu cho vượt; nhắc gửi theo lượt 15 phút nên có thể trễ tới 15 phút.
- Khả năng tương thích: không đổi hành vi bài tập trên lớp.
- Phương án quay lui: hoàn lại commit gộp của nhánh 28f; migration chỉ thêm cột, bảng.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-28 phần 28f: bài về nhà và phụ huynh (giao từ sổ đầu bài, quy tắc khối lượng do trường đặt, lịch khối lượng của lớp, phụ huynh xem bài của con, đã xem cùng con, nộp thay, nhắc có giờ yên lặng, gợi ý gia hạn khi vắng) (YCTD-276) | Đã triển khai |

## index Số đếm

| 10 | mã chức năng | +5 |
| 10 | còn hiệu lực | +5 |
| 14 | màn hình | +4 |
| 16 | bảng dự kiến | +3 |
| Chức năng đã liệt kê | Số lượng | +5 |
| Chức năng đã liệt kê | mã; | +5 |
| Tiêu chí nghiệm thu đã viết | Số lượng | +7 |
| Quy tắc nghiệp vụ đã xác định | Số lượng | +6 |
| Bảng dữ liệu dự kiến | Số lượng | +3 |
| Màn hình dự kiến | Số lượng | +4 |
| Ca kiểm thử khởi đầu | Số lượng | +10 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-480 đến MH-483 (YCTD-276) |

## Thêm dòng

| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-40 | Giao bài về nhà từ sổ đầu bài (YCTD-276, DT-28 phần 28f) | Giáo viên của lớp học trực tuyến | Tiết đã ghi, tên bài, số phút dự kiến | Tạo bài tập ngữ cảnh bài về nhà ở lớp học trực tuyến của lớp và môn, gắn tiết; hạn là đầu tiết kế tiếp của môn; sổ đầu bài hiện bài về nhà của tiết | Bài về nhà (bản nháp), hạn | BR-360 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-41 | Quy tắc khối lượng bài về nhà của trường (YCTD-276, GD-143) | Ban Giám hiệu | Cấp, khối, số bài, số phút mỗi ngày, thứ không để hạn, ngày lễ, khối không giao, cảnh báo hoặc chặn, căn cứ | Trường tự đặt, nền tảng không đặt mặc định; khi phát hành bài về nhà máy kiểm; cảnh báo cần xác nhận, chặn cần Ban Giám hiệu cho vượt có lý do | Quy tắc, cảnh báo hoặc chặn khi phát hành | BR-361, BR-362 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-42 | Lịch khối lượng bài về nhà của lớp (YCTD-276) | Giáo viên của lớp, chủ nhiệm, Ban Giám hiệu | Lớp, ngày bắt đầu | Bảy ngày theo ngày đến hạn: số bài, số phút của bài đã phát hành của mọi môn; bài đang soạn hiện thêm | Lịch 7 ngày | BR-362 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-43 | Bài tập của con, nộp thay (YCTD-276) | Phụ huynh | Bài về nhà của con, ảnh vở, ghi âm, chữ, lời trao đổi | Xem theo ngày đến hạn, trạng thái, kết quả, nhận xét khi đã trả; "Đã xem cùng con"; nộp thay khi con chưa có tài khoản học; trao đổi trên bài đã nộp | Bài nộp do phụ huynh nộp, xác nhận đã xem | BR-363 |
| 10_YEU_CAU_CHUC_NANG.md | P03-17 | P03-44 | Nhắc bài về nhà (YCTD-276) | Hệ thống; phụ huynh, học sinh nhận | Bài về nhà đã phát hành, giờ nhắc của trường | Nhắc đã giao, sắp đến hạn, chưa nộp, đã trả; giờ yên lặng; gộp nhiều bài một em; không nhắc lại; gợi ý gia hạn, miễn khi vắng có phép ngày giao | Thông báo trong ứng dụng, tin đẩy | BR-364, BR-365 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-360 | Bài về nhà từ sổ đầu bài (YCTD-276, DT-28 phần 28f): bài về nhà là bài tập 28c ngữ cảnh `homework`; giao từ một tiết đã ghi của sổ đầu bài cần là giáo viên của lớp học trực tuyến cùng lớp và môn của tiết (lớp chưa có thì 422); bài gắn tiết và nhóm của tiết; hạn mặc định là đầu tiết kế tiếp cùng môn, cùng nhóm theo thời khoá biểu (sau dạy thay, đổi tiết) trong 14 ngày sau ngày của tiết, bỏ ngày lễ, không thấy thì 7:00 sau 7 ngày; lưu bài không gửi ngữ cảnh thì giữ ngữ cảnh đã có; vi phạm: 403, 404, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-361 | Quy tắc khối lượng bài về nhà (YCTD-276, GD-143 Eric chốt 2026-10-26): nền tảng không đặt giới hạn; Ban Giám hiệu đặt theo cấp (TH, THCS, THPT) và khối (0 là chung của cấp; quy tắc của khối thay quy tắc chung); mỗi quy tắc có khối không giao, số bài 1 đến 20 và số phút 5 đến 600 mỗi ngày, thứ không để hạn, không để hạn vào ngày lễ, cảnh báo hoặc chặn, căn cứ tối đa 1.000 ký tự; trường chưa đặt thì không chặn, không cảnh báo; giờ nhắc sắp đến hạn từ 06:00 đến trước 21:00; vi phạm: 403, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-362 | Khối lượng và phát hành bài về nhà (YCTD-276): khối lượng tính theo ngày đến hạn (giờ Việt Nam) của bài về nhà đã phát hành của mọi môn trong lớp; bài chưa ghi số phút tính 0 phút; khi phát hành, vượt quy tắc cảnh báo thì giáo viên phải xác nhận (`confirm_warnings`), vượt quy tắc chặn thì chỉ phát hành được khi Ban Giám hiệu đã cho vượt trên bài có lý do (lưu lý do, người cho); lịch khối lượng cho giáo viên, chủ nhiệm của lớp, Ban Giám hiệu; vi phạm: 403, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-363 | Phụ huynh và bài về nhà (YCTD-276): phụ huynh xem bài về nhà đã giao của con, điểm, mức, nhận xét chỉ khi giáo viên đã trả; "Đã xem cùng con" ghi một lần mỗi phụ huynh; nộp thay chỉ khi bài làm cá nhân, con chưa có tài khoản học, bài còn nộp được (giới hạn tệp, hạn, nộp muộn như học sinh), bài ghi người nộp là phụ huynh; cán bộ xem được lớp không nộp thay; phụ huynh trao đổi trên bài đã nộp của con; vi phạm: 403, 404, 422 |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-364 | Nhắc bài về nhà (YCTD-276): bốn loại nhắc (đã giao, sắp đến hạn từ giờ nhắc hôm trước ngày đến hạn, chưa nộp khi quá hạn, đã trả), mỗi loại trong 3 ngày kể từ sự việc; không gửi từ 21:00 đến 6:00; các bài của một em gộp một thông báo mỗi lượt; mỗi bài, mỗi em, mỗi loại chỉ nhắc một lần; em được miễn không nhắc; người nhận là phụ huynh (trong ứng dụng, tin đẩy) và tài khoản học của em |
| 07_QUY_TAC_NGHIEP_VU.md | BR-252 | BR-365 | Vắng có phép ngày giao bài (YCTD-276): học sinh nhận bài về nhà có báo vắng có phép đúng ngày phát hành được gợi ý gia hạn (khi chưa có hạn riêng) hoặc miễn; giáo viên quyết, máy không tự đổi |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-111 | PQ-150 | Bài về nhà (YCTD-276, DT-28 phần 28f): không thêm mã quyền; giao từ sổ đầu bài, lịch khối lượng của bài, gợi ý khi vắng dùng `P02.assignment.manage` và phải là giáo viên của lớp học trực tuyến; quy tắc của trường, giờ nhắc, cho vượt quy tắc chặn chỉ Ban Giám hiệu (người có `P02.learning.decide`, hoặc có cả `P02.learning.view` và quyền duyệt học liệu); khối lượng của lớp cho giáo viên đang dạy lớp, chủ nhiệm, Ban Giám hiệu; mục 9.6 hiện cho người có quyền dạy, xem hoặc quyết định học tập trực tuyến; phụ huynh kiểm theo học sinh |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1020 | Cho tiết Toán ngày 2/11 của lớp 7A đã ghi sổ / Khi giáo viên khác giao bài về nhà, giáo viên của lớp giao, lưu bài ở màn hình soạn / Thì giáo viên khác 403; bài về nhà gắn tiết, hạn 7:00 ngày 9/11 (lớp chưa có thời khoá biểu); lưu lại vẫn là bài về nhà; sổ đầu bài hiện bài của tiết | CT-1314 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1021 | Cho trường chưa đặt quy tắc / Khi giáo viên phát hành bài về nhà / Thì phát hành được, không cảnh báo | CT-1310, CT-1315 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1022 | Cho quy tắc khối 7 tối đa 1 bài, 30 phút mỗi ngày, cảnh báo / Khi giáo viên phát hành bài thứ hai cùng hạn, xem lịch khối lượng, xác nhận vẫn giao / Thì lần đầu 422 cần xác nhận; lịch có ngày 9/11 một bài đã giao và bài đang soạn; sau xác nhận phát hành được kèm hai cảnh báo | CT-1311, CT-1315 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1023 | Cho quy tắc khối 7 tối đa 2 bài mỗi ngày, chặn / Khi giáo viên phát hành bài thứ ba, giáo viên tự cho vượt, Ban Giám hiệu cho vượt có lý do, giáo viên phát hành lại / Thì 422; giáo viên 403; phát hành được, bài lưu lý do và người cho vượt | CT-1315 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1024 | Cho An chưa có tài khoản học, Bình đã có / Khi phụ huynh của An xem bài của con, bấm "Đã xem cùng con", nộp thay ảnh vở và chữ, trao đổi; phụ huynh của Bình nộp thay; phụ huynh của Bình xem bài của An / Thì An có ba bài, nộp thay được, bài ghi người nộp là phụ huynh; phụ huynh của Bình 422 "Con đã có tài khoản học"; xem bài của An 403 | CT-1316 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1025 | Cho ba bài về nhà hạn 7:00 ngày 9/11 / Khi việc nền chạy lúc 22:00 ngày 8/11, 18:00, 19:30, 19:45 và 8:00 ngày 9/11 / Thì 22:00 không gửi; 18:00 mỗi em một thông báo "đã giao" gộp các bài; 19:30 nhắc sắp đến hạn trừ bài đã nộp; 19:45 không gửi lại; 8:00 nhắc chưa nộp; phụ huynh có cả tin đẩy | CT-1313, CT-1318 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-900 | AC-1026 | Cho giáo viên ở ứng dụng giáo viên, Ban Giám hiệu ở cổng quản trị, phụ huynh / Khi giáo viên giao bài về nhà từ tiết, phát hành; Ban Giám hiệu đặt quy tắc ở mục 9.6, xem khối lượng của lớp; phụ huynh nộp thay, bấm "Đã xem cùng con" / Thì bài hiện ở sổ đầu bài "Đã giao"; mục 9.6 có quy tắc và lịch của lớp; phụ huynh thấy "Đã nộp, chờ chấm", "phụ huynh nộp thay" | CT-1319 |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-480 | Ứng dụng giáo viên: Sổ đầu bài, tiết đã ghi (YCTD-276): khối "Bài về nhà của tiết" (bài, hạn, nhãn Đã giao hoặc Đang soạn, nút "Mở"; ô "Tên bài về nhà", nút "Giao bài về nhà" mở màn hình soạn bài tập; lớp chưa có lớp học trực tuyến của môn thì có dòng giải thích) (người dùng: Giáo viên) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-481 | Ứng dụng giáo viên: màn hình bài tập (YCTD-276): ô "Làm ở đâu" (Trên lớp, Bài về nhà), "Số phút dự kiến"; bài về nhà chưa phát hành có khối "Khối lượng bài về nhà 7 ngày của lớp" (mỗi ngày các môn, bài đang soạn in đậm), dòng vi phạm quy tắc của trường, nút "Giao bài cho học sinh", "Vẫn giao" khi bị cảnh báo; bài đã phát hành có khối "Vắng có phép ngày giao bài" (nút "Gia hạn 2 ngày", "Miễn") (người dùng: Giáo viên) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-482 | Ứng dụng phụ huynh: trong khung Học trực tuyến của con (YCTD-276): khối "Bài tập về nhà của {tên con}" theo ngày đến hạn (môn, tên bài, nhãn trạng thái, hạn, số phút, nộp muộn, phụ huynh nộp thay, hướng dẫn, điểm, mức, nhận xét); nút "Đã xem cùng con"; "Nộp thay" mở ô trả lời chữ, chụp vở, ghi âm và nút "Nộp thay con"; ô "Trao đổi với thầy cô" trên bài đã nộp (người dùng: Phụ huynh) |
| 14_DAC_TA_GIAO_DIEN.md | MH-361 | MH-483 | Cổng quản trị: 9.6 Bài về nhà (YCTD-276, `/online-homework`): "Khối lượng bài về nhà theo lớp" (chọn lớp, từ ngày; quy tắc áp cho lớp; bảng 7 ngày: ngày đến hạn, số bài, số phút, bài); "Quy tắc bài về nhà của trường" (chỉ Ban Giám hiệu: dòng giải thích nền tảng không đặt sẵn, "Bảng mẫu gợi ý để tham khảo" chưa xác minh, danh sách quy tắc có "Bỏ quy tắc", biểu mẫu cấp, khối, khi vượt, số bài, số phút, khối không giao, thứ không để hạn, ngày lễ, căn cứ, "Lưu quy tắc"; "Giờ nhắc", "Lưu giờ nhắc") (người dùng: Ban Giám hiệu, chủ nhiệm, giáo viên) |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1310 | P03-41 | CT-28f-1: trường chưa đặt quy tắc thì không chặn, không cảnh báo; quy tắc của khối thay quy tắc chung của cấp; khối không giao bị chặn | Đúng | Đạt 28/10/2026; `apps/api/src/learning/homework/homework-rules.test.ts`; AC-1021 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1311 | P03-41, P03-42 | CT-28f-2: vượt số bài, số phút mỗi ngày, thứ không để hạn, ngày lễ; nhập quy tắc sai báo theo ô | Đúng | Đạt 28/10/2026; `homework-rules.test.ts`; AC-1022 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1312 | P03-40, P03-42 | CT-28f-3: hạn là đầu tiết kế tiếp của môn, không có tiết thì 7:00 sau 7 ngày; lịch 7 ngày theo ngày đến hạn giờ Việt Nam; trạng thái bài của em | Đúng | Đạt 28/10/2026; `homework-rules.test.ts`; AC-1020 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1313 | P03-44 | CT-28f-4: nhắc có giờ yên lặng, sắp đến hạn từ giờ nhắc hôm trước, gộp nhiều bài một em, không nhắc lại, chưa nộp, đã trả | Đúng | Đạt 28/10/2026; `homework-rules.test.ts`; AC-1025 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1314 | P03-40 | CT-28f-5: giao bài về nhà từ tiết của sổ đầu bài; hạn mặc định; lưu lại vẫn là bài về nhà; giáo viên khác 403 | Đúng | Đạt 28/10/2026; `apps/api/src/learning/homework/homework.test.ts`; AC-1020 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1315 | P03-41, P03-42 | CT-28f-6: Ban Giám hiệu đặt quy tắc; cảnh báo cần xác nhận; chặn chỉ phát hành khi Ban Giám hiệu cho vượt có lý do; lịch khối lượng của lớp | Đúng | Đạt 28/10/2026; `homework.test.ts`; AC-1021, AC-1022, AC-1023 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1316 | P03-43 | CT-28f-7: phụ huynh xem bài của con, đã xem cùng con, nộp thay khi con chưa có tài khoản, trao đổi; con có tài khoản thì không nộp thay; phụ huynh khác 403 | Đúng | Đạt 28/10/2026; `homework.test.ts`; AC-1024 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1317 | P03-44 | CT-28f-8: học sinh vắng có phép ngày giao được gợi ý gia hạn; đã miễn thì không gợi ý | Đúng | Đạt 28/10/2026; `homework.test.ts` | Trung bình |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1318 | P03-44 | CT-28f-9: việc nền nhắc: giờ yên lặng, gộp nhiều bài một em, không nhắc lại, phụ huynh có tin đẩy | Đúng | Đạt 28/10/2026; `homework.test.ts`; AC-1025 | Cao |
| 21_KICH_BAN_KIEM_THU.md | CT-1145 | CT-1319 | P03-40, P03-41, P03-43 | CT-28f-10: giao diện: giáo viên giao từ sổ đầu bài, phát hành; Ban Giám hiệu đặt quy tắc, xem khối lượng; phụ huynh nộp thay, đã xem cùng con | Đúng | Đạt 28/10/2026; e2e `tests/e2e/215-homework-parents.spec.ts`; AC-1026 | Cao |
| 22_BAO_MAT.md | BM-101 | BM-190 | Nộp thay của phụ huynh (YCTD-276, BR-363): chỉ phụ huynh có liên kết với học sinh, chỉ khi con chưa có tài khoản học và bài làm cá nhân; bài ghi người nộp, loại người nộp; ảnh JPEG bỏ siêu dữ liệu ở máy chủ như bài của học sinh; phụ huynh không xem được bài của học sinh khác hay bài nhóm |
| 22_BAO_MAT.md | BM-101 | BM-191 | Nhắc bài về nhà (YCTD-276, BR-364): tiêu đề, nội dung chỉ có tên con và tên bài, gửi đúng phụ huynh của em và tài khoản học của em; không gửi từ 21:00 đến 6:00; nhật ký nhắc chống gửi trùng không chứa nội dung bài |
