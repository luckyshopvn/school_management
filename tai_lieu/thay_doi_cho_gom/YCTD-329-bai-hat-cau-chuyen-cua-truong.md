---
yctd: YCTD-329
tieu_de: DT-29 phần 29e: bài hát, câu chuyện của trường trong Hộp công cụ giảng dạy
ngay: 2026-10-28
phien_ban_de_xuat: 0.205.0
---

## 02 Nhật ký

### 2026-10-28 — DT-29 phần 29e: bài hát, câu chuyện của trường trong Hộp công cụ giảng dạy

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống `0121_add_song_story_resource_types.ts`: loại học liệu `song` (Bài hát), `story` (Câu chuyện), qua Ban Giám hiệu duyệt.
- Máy chủ API: kho học liệu nhận tệp âm thanh MP3, M4A, WAV, OGG theo chữ ký đầu tệp (`detectResourceFileType`).
- Ứng dụng giáo viên: mini app "Bài hát, câu chuyện của trường" (lớp Mầm non) liệt kê học liệu loại Bài hát, Câu chuyện đã công bố của cấp của lớp, phát âm thanh, video ngay trên lớp, chiếu ảnh, mở PDF hoặc liên kết.

#### Quyết định

- Dự án không kèm bài hát, truyện nào: nội dung do trường tải lên kho học liệu, qua luồng duyệt và kiểm bản quyền của 22h1 (Ban Giám hiệu duyệt như video). Mini app dùng lại quyền dùng học liệu, danh sách và tải tệp có sẵn của kho, không thêm điểm cuối. Chưa lưu tệp để phát khi mất mạng (tệp âm thanh, video lớn, cần mạng khi phát). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-329, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 21, `07_QUY_TAC_NGHIEP_VU.md` BR-196, `14_DAC_TA_GIAO_DIEN.md` MH-564, `16_CO_SO_DU_LIEU.md`, `21_KICH_BAN_KIEM_THU.md` CT-1561 đến CT-1563, `11_TIEU_CHI_NGHIEM_THU.md` AC-1137, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Lưu sẵn tệp để phát khi mất mạng (tuỳ chọn) chưa làm; giới hạn 50 MB mỗi tệp của kho học liệu áp cho cả âm thanh.

## 24 Yêu cầu thay đổi

### YCTD-329: DT-29 phần 29e: bài hát, câu chuyện của trường trong Hộp công cụ giảng dạy – 2026-10-28

- Lý do: phần 29e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 21 (Eric duyệt ngày 2026-10-28). Giáo viên Mầm non cần nhạc, bài hát, kể chuyện trên lớp; dự án không dùng tài nguyên có bản quyền, nội dung do trường tải lên.
- Nội dung thay đổi:
  - Hai loại học liệu mới Bài hát, Câu chuyện ở kho học liệu số; qua Ban Giám hiệu duyệt.
  - Kho học liệu nhận thêm tệp âm thanh MP3 (thẻ ID3 hoặc khung MPEG lớp III), M4A (hộp ftyp nhãn M4A), WAV, OGG.
  - Mini app Bài hát, câu chuyện của trường ở Hộp công cụ của lớp Mầm non: học liệu đã công bố (không nháp, không ẩn, không ngừng dùng) loại Bài hát, Câu chuyện, của cấp của lớp hoặc không ghi cấp; bài hát trước, xếp theo tên; mở tệp qua điểm cuối tải học liệu có sẵn (có ghi lượt dùng như kho), phát âm thanh, video, chiếu ảnh, mở PDF hoặc liên kết.
- Thành phần bị ảnh hưởng: `database/system/migrations/0121_add_song_story_resource_types.ts`, `apps/api/src/learning-resources/learning-resource-rules.ts`, `packages/shared/src/teaching-tools.ts`, `apps/teacher/src/tools/mini/SchoolMediaTool.tsx`, `school-media-logic.ts`.
- Dữ liệu bị ảnh hưởng: hai dòng `resource_types` mới.
- API bị ảnh hưởng: không thêm điểm cuối; tải tệp học liệu lên nhận thêm kiểu âm thanh.
- Giao diện bị ảnh hưởng: MH-337 (ô công cụ lớp Mầm non), MH-564; ô Loại ở Kho học liệu của cổng quản trị có thêm Bài hát, Câu chuyện.
- Quyền bị ảnh hưởng: không; giáo viên dùng quyền dùng học liệu (P09.learning-resource.use) đã có.
- Kiểm thử cần thực hiện: CT-1561 đến CT-1563 (trong mã là CT-29e-1 đến CT-29e-3); `apps/api/src/learning-resources/school-media.test.ts`, `apps/teacher/src/tools/mini/school-media.test.ts`, `tests/e2e/234-teaching-school-media.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: DT-29 phần 29e, bài hát, câu chuyện của trường (YCTD-329).
- Chức năng mới: loại học liệu Bài hát, Câu chuyện; kho học liệu nhận tệp âm thanh; mini app phát bài hát, câu chuyện của trường trên lớp Mầm non.
- Cấu trúc dữ liệu: hệ thống 0121.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-29 phần 29e: bài hát, câu chuyện của trường trong Hộp công cụ giảng dạy | YCTD-329 |

## Thêm dòng

| 14_DAC_TA_GIAO_DIEN.md | MH-337 | MH-564 | Ứng dụng giáo viên: Bài hát, câu chuyện của trường trong Hộp công cụ giảng dạy (YCTD-329): danh sách học liệu loại Bài hát, Câu chuyện đã công bố của cấp lớp (tên, loại, tác giả), khung Đang phát (trình phát âm thanh, video, ảnh, Mở tệp, Mở liên kết); chưa có học liệu thì hướng dẫn tải lên ở Kho học liệu | P03-09, P03-10 |
| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1137 | Cho kho học liệu có bài hát, câu chuyện / Khi giáo viên lớp Mầm non mở mini app / Thì chỉ thấy học liệu đã công bố của cấp lớp hoặc không ghi cấp, mở và phát được; tệp âm thanh MP3, M4A, WAV, OGG tải lên được, tệp đổi tên không nhận (CT-1561 đến CT-1563; YCTD-329) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1561 | P09-01 | Nhận dạng tệp âm thanh MP3, M4A, WAV, OGG; MP4 video; RIFF khác WAV; tệp đổi tên | Đúng kiểu; không nhận tệp giả | Kiểm thử tự động `apps/api/src/learning-resources/school-media.test.ts` CT-29e-1 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1562 | P03-09 | Lọc học liệu: loại, đã công bố, ẩn, cấp; thứ tự; kiểu phát theo kiểu tệp | Chỉ học liệu đủ điều kiện; bài hát trước; đúng kiểu phát | Kiểm thử tự động `apps/teacher/src/tools/mini/school-media.test.ts` CT-29e-2 | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1563 | P03-09 | Giao diện: bài hát Mầm non đã công bố, bài nháp, bài Tiểu học; giáo viên lớp Mầm non mở mini app; đổi sang lớp Tiểu học | Chỉ bài đã công bố của Mầm non, mở được; lớp Tiểu học không có mini app | Kiểm thử giao diện `tests/e2e/234-teaching-school-media.spec.ts` CT-29e-3 | Chưa chạy |
