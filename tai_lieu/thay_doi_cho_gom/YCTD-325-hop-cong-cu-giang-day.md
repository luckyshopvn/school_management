---
yctd: YCTD-325
tieu_de: DT-29 phần 29a: Hộp công cụ giảng dạy theo cấp học
ngay: 2026-10-28
phien_ban_de_xuat: 0.201.0
---

## 02 Nhật ký

### 2026-10-28 — DT-29 phần 29a: Hộp công cụ giảng dạy theo cấp học

#### Công việc đã thực hiện

- Khảo sát công cụ hỗ trợ giảng dạy đã có (23b, 23c, 23a, 23d, DT-28), đăng nhập thử ba tài khoản giáo viên ở trường trình diễn, vẽ bản thiết kế Hộp công cụ giảng dạy; Eric duyệt ngày 2026-10-28 (32 mục 21).
- Gói chung: danh mục công cụ `TEACHING_TOOLS` (`packages/shared/src/teaching-tools.ts`), ba mục cấp mới `class_pickup`, `class_medication`, `school_tutoring` ở `level-features.ts`.
- Máy chủ API: cấu hình `teaching_tools_disabled` (kiểu `teaching_tool_list`), `GET /classroom-tools/config` trả thêm `disabled_tools`.
- Ứng dụng giáo viên: màn Công cụ lớp học đổi thành Hộp công cụ giảng dạy (ô công cụ theo cấp của lớp, công cụ trường tắt, tính năng gói, lối vào giáo án, sổ đầu bài, lớp học trực tuyến), đường dẫn `?man=hop-cong-cu` và chuyển đường dẫn cũ, lối tắt trong `manifest.webmanifest`; trang chủ lọc Đón trả, Dặn thuốc, Lớp học trực tuyến, Gia sư trong trường theo cấp.
- Cổng quản trị: khối Hộp công cụ giảng dạy ở trang Cấu hình (bật, tắt từng công cụ).

#### Quyết định

- Bảng điểm nhanh giữ ở mọi cấp (Mầm non đang dùng để ghi nề nếp, thi đua); Gia sư trong trường lọc như Lớp học trực tuyến. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Công tắc từng công cụ là cấu hình của trường; công cụ thuộc tính năng trả phí (lớp học trực tuyến, `online-learning` của YCTD-314) ẩn khi gói chưa bật.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-325, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 21, `07_QUY_TAC_NGHIEP_VU.md` BR-460, `11_TIEU_CHI_NGHIEM_THU.md` AC-1130 đến AC-1132, `14_DAC_TA_GIAO_DIEN.md` MH-337, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1540 đến CT-1544, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Mini app mới theo cấp làm ở 29b đến 29e. Ứng dụng phụ huynh chưa lọc đón trả, dặn thuốc theo cấp.

## 24 Yêu cầu thay đổi

### YCTD-325: DT-29 phần 29a: Hộp công cụ giảng dạy theo cấp học – 2026-10-28

- Lý do: Eric yêu cầu ngày 2026-10-28 tập hợp các công cụ, mini app hỗ trợ giảng dạy phù hợp với bậc học trong giao diện giáo viên; duyệt đề xuất cùng ngày (32 mục 21).
- Nội dung thay đổi:
  - Danh mục công cụ một nơi ở gói chung: mã, tên, mô tả, nhóm (Trên lớp, Trò chơi và câu hỏi, Mini app theo môn, Giao bài và học trực tuyến), cấp áp dụng, chạy ngoại tuyến, tính năng gói.
  - Màn Hộp công cụ giảng dạy thay Công cụ lớp học: công cụ theo cấp của lớp đang chọn (Mầm non không có trò chơi kiến thức, sổ đầu bài, lớp học trực tuyến); bản chụp danh sách lớp lưu thêm cấp để lọc khi mất mạng (bản chụp cũ chưa có cấp thì không lọc); lối vào giáo án, sổ đầu bài và bài về nhà, lớp học trực tuyến, quay lại trở về Hộp công cụ; tab trong Chế độ lớp học đổi tên theo.
  - Công tắc theo trường: cấu hình `teaching_tools_disabled` đặt ở Trường chính, khối Hộp công cụ giảng dạy ở trang Cấu hình; công cụ thuộc tính năng gói chưa bật ẩn (đọc `GET /school-plan`).
  - Đường dẫn `?man=hop-cong-cu` mở thẳng Hộp công cụ; `?man=cong-cu-lop-hoc` đổi sang tên mới; lối tắt "Hộp công cụ giảng dạy" khi cài ứng dụng.
  - Trang chủ: Đón trả, Dặn thuốc chỉ ở lớp Mầm non, Tiểu học; Lớp học trực tuyến, Gia sư trong trường ẩn khi mọi lớp của giáo viên là lớp Mầm non.
  - Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giữ bảng điểm nhanh ở Mầm non; lọc gia sư như lớp học trực tuyến; khoá lưu trên máy và bộ nhớ đệm giữ tiền tố `cong-cu-lop-hoc` để dữ liệu đã lưu không mất.
- Thành phần bị ảnh hưởng: `packages/shared` (`teaching-tools.ts`, `level-features.ts`), máy chủ API (`settings/setting-definitions.ts`, `classroom-tools/`), ứng dụng giáo viên (`Application.tsx`, `ClassesScreen.tsx`, `ClassroomModeScreen.tsx`, `tools/`), cổng quản trị (`settings/TeachingToolsSettingsBlock.tsx`, `SettingsPage.tsx`).
- Dữ liệu bị ảnh hưởng: thêm mục cấu hình `teaching_tools_disabled` ở bảng `settings` (không có migration).
- API bị ảnh hưởng: `GET /classroom-tools/config` thêm `disabled_tools`; `PUT /settings` nhận `teaching_tools_disabled`.
- Giao diện bị ảnh hưởng: MH-337, trang chủ ứng dụng giáo viên, Chế độ lớp học, trang Cấu hình của cổng quản trị.
- Quyền bị ảnh hưởng: không thêm quyền; ghi cấu hình theo quyền cấu hình hiện có.
- Ảnh hưởng chức năng cũ: giáo viên lớp THCS, THPT không còn thấy Đón trả, Dặn thuốc ở trang chủ; giáo viên chỉ có lớp Mầm non không thấy Lớp học trực tuyến, Gia sư trong trường; trò chơi kiến thức không hiện ở lớp Mầm non.
- Kiểm thử cần thực hiện: CT-1540 đến CT-1544 (trong mã là CT-29a-1 đến CT-29a-5); `apps/api/src/classroom-tools/classroom-tools.test.ts`, `apps/api/src/classroom-tools/teaching-tools.test.ts`, `apps/teacher/src/tools/toolbox.test.ts`, `tests/e2e/230-teaching-toolbox.spec.ts`; e2e 151, 152, 183, 210 sửa theo tên mới.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-29 phần 29a, Hộp công cụ giảng dạy theo cấp học (YCTD-325).
- Chức năng mới: Hộp công cụ giảng dạy (thay Công cụ lớp học) lọc theo cấp của lớp, trường bật tắt từng công cụ, lối vào màn đã có, đường dẫn mở thẳng; trang chủ lọc mục không hợp cấp.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-29 phần 29a: Hộp công cụ giảng dạy theo cấp học | YCTD-325 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-233 | BR-460 | Hộp công cụ giảng dạy (YCTD-325): công cụ hiện theo cấp của lớp đang chọn theo danh mục `TEACHING_TOOLS`; công cụ trong `teaching_tools_disabled` của Trường chính ẩn; công cụ gắn tính năng gói chưa bật ẩn; bản chụp danh sách lớp không có cấp thì không lọc theo cấp; Đón trả, Dặn thuốc ở trang chủ chỉ ở lớp Mầm non, Tiểu học |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1130 | Cho lớp Mầm non / Khi giáo viên mở Hộp công cụ giảng dạy / Thì có gọi tên, chia nhóm, đếm ngược, bảng điểm nhanh, giáo án; không có trò chơi kiến thức, sổ đầu bài, lớp học trực tuyến (CT-1541; YCTD-325) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1131 | Cho trường tắt một công cụ hoặc gói chưa có tính năng của công cụ / Khi giáo viên mở Hộp công cụ / Thì công cụ đó không hiện; mã công cụ sai bị từ chối khi ghi cấu hình (CT-1540, CT-1542; YCTD-325) |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1132 | Cho đường dẫn cũ `?man=cong-cu-lop-hoc` / Khi mở ứng dụng giáo viên / Thì Hộp công cụ mở và đường dẫn đổi thành `?man=hop-cong-cu` (CT-1543, CT-1544; YCTD-325) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1540 | P03-09 | Cấu hình `teaching_tools_disabled`: giá trị đúng, mã lạ, trùng, không phải danh sách; cấu hình công cụ trả `disabled_tools` | Giá trị đúng ghi được; sai bị từ chối; cấu hình trả đúng danh sách | Kiểm thử tự động `apps/api/src/classroom-tools/classroom-tools.test.ts` CT-29a-1 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1541 | P03-09 | Danh mục công cụ theo cấp Mầm non, THCS, bản chụp không có cấp | Mầm non không có trò chơi, sổ đầu bài, lớp học trực tuyến; THCS đủ; không có cấp thì không lọc | Kiểm thử tự động `apps/api/src/classroom-tools/teaching-tools.test.ts` CT-29a-2 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1542 | P03-09 | Công cụ trường tắt; gói không có `online-learning`, có, không giới hạn | Công cụ tắt ẩn; lớp học trực tuyến ẩn khi gói không có | Kiểm thử tự động `apps/api/src/classroom-tools/teaching-tools.test.ts` CT-29a-3 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1543 | P03-09 | Đường dẫn `?man=hop-cong-cu`, `?man=cong-cu-lop-hoc`, tham số khác | Mở Hộp công cụ, tên cũ đổi sang tên mới, giữ tham số khác | Kiểm thử tự động `apps/teacher/src/tools/toolbox.test.ts` CT-29a-4 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1544 | P03-09 | Giao diện: giáo viên một lớp Mầm non, một lớp Tiểu học mở Hộp công cụ, trường tắt đếm ngược, mở bằng đường dẫn cũ | Công cụ theo cấp; công cụ tắt ẩn; đường dẫn đổi sang tên mới | Kiểm thử giao diện `tests/e2e/230-teaching-toolbox.spec.ts` CT-29a-5 | Chưa chạy |
