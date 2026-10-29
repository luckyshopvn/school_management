---
yctd: YCTD-355
tieu_de: Sửa lỗi xem camera giám thị mất phiên khi hai yêu cầu mở phiên chạy song song
ngay: 2026-10-29
phien_ban_de_xuat: 0.235.0
---

## 02 Nhật ký

### 2026-10-29 — Sửa lỗi xem camera giám thị mất phiên khi hai yêu cầu mở phiên chạy song song (YCTD-355)

#### Công việc đã thực hiện

- Spec `154-online-exam-proctoring.spec.ts` (CT-1175, CT-23e-5) lúc đạt lúc hỏng trên CI (PR 246, PR 257): ô "Camera của …" không có "Đang xem". Dấu vết của run 40736134879 và run 40745898287 (bốn lần hỏng giống nhau) cho thấy đây là **lỗi ứng dụng, không phải lỗi kiểm thử**: ô không đang chờ mà đã ở trạng thái cuối "Không xem được", chi tiết "Phiên xem đã kết thúc".
- Nguyên nhân: ô camera (`LiveTile` ở `apps/portal/src/online-exams/ProctorPanel.tsx`) mở phiên xem ngay trong hiệu ứng. Ở bản chạy thử, StrictMode gắn hiệu ứng hai lần nên hai yêu cầu `POST /online-exams/attempts/:id/proctor/views` đi cùng một mili giây. Máy chủ (`exam-proctoring.ts`, `startView`) đóng mọi phiên xem còn mở của cùng người xem trên cùng bài làm trước khi tạo phiên mới. Hai yêu cầu được xử lý theo thứ tự đảo thì phiên của lượt hiệu ứng còn sống bị đóng (gửi tín hiệu trả 422 "Phiên xem đã kết thúc"), còn phiên sống sót thuộc lượt đã hủy và bị xoá ngay. Không còn phiên nào nên chờ bao lâu cũng không xem được. YCTD-306 chỉ chặn lượt đã hủy ghi đè trạng thái, chưa chặn đua ở máy chủ. Ở bản thật (không có StrictMode) bấm "Xem camera" hai lần nhanh cũng có thể gặp.
- Sửa ở cổng quản trị:
  - `LiveTile` hoãn mở phiên một nhịp (`setTimeout` 0) và xoá hẹn giờ khi gỡ: lượt gắn đầu của StrictMode bị gỡ trước khi hẹn giờ chạy nên chỉ một yêu cầu mở phiên.
  - Mỗi bài làm chỉ một yêu cầu mở phiên tại một thời điểm: `createSingleFlight` (`proctor-single-flight.ts`), yêu cầu đến sau dùng lại kết quả của yêu cầu trước.
  - Nút "Xem camera của …" tắt trong lúc yêu cầu mở phiên của bài làm đó đang chạy.
- Spec 154 giữ nguyên (không tăng thời gian chờ).
- Cổng quản trị có kiểm thử đơn vị như ứng dụng phụ huynh, học sinh (`node --test`, lệnh `test`, `allowImportingTsExtensions`): `proctor-single-flight.test.ts` ba ca (dùng lại kết quả, khoá riêng và gọi lại sau khi xong, lỗi truyền cho mọi bên chờ và cho thử lại).
- Kết quả trên máy ngày 2026-10-29: `pnpm --filter @school-management/portal test` 3/3 đạt; `typecheck`, `eslint`, `prettier --check` của các tệp đã sửa đạt. E2e có khoá: spec 01 đến 09 và 154 (29 ca) đạt, rồi spec 154 lặp hai lần đạt (154 đạt 3/3). Trên máy spec này trước khi sửa cũng thường đạt, nên bằng chứng chính là dấu vết CI nêu trên; cần CI của PR xác nhận.

#### Quyết định

- Sửa ở giao diện, không đổi quy tắc máy chủ "mở phiên mới thì đóng phiên cũ" (phương án đóng theo thời điểm tạo vẫn đua khi trùng mili giây). Phiên điều phối đồng ý ngày 2026-10-29.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-355, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-355: Sửa lỗi xem camera giám thị mất phiên khi hai yêu cầu mở phiên chạy song song – 2026-10-29

- Lý do: Lỗi ứng dụng làm spec 154 (CT-1175) hỏng thất thường trên CI: hai yêu cầu mở phiên xem camera song song của cùng bài làm làm máy chủ đóng phiên còn dùng, giáo viên thấy "Không xem được".
- Nội dung thay đổi: Ô camera hoãn mở phiên một nhịp; mỗi bài làm một yêu cầu mở phiên tại một thời điểm; nút "Xem camera" tắt khi đang mở phiên; kiểm thử đơn vị cho cổng quản trị.
- Thành phần bị ảnh hưởng: `apps/portal/src/online-exams/ProctorPanel.tsx`, `apps/portal/src/online-exams/proctor-single-flight.ts`, `apps/portal/src/online-exams/proctor-single-flight.test.ts`, `apps/portal/package.json`, `apps/portal/tsconfig.json`. Không đổi API, dữ liệu, phân quyền.
- Khả năng ảnh hưởng chức năng cũ: Xem camera trực tiếp (MH giám thị camera của YCTD-215) mở phiên chậm thêm một nhịp; "Xem tất cả" không đổi.
- Kiểm thử cần thực hiện: `pnpm --filter @school-management/portal test`, spec 154.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: sửa lỗi xem camera giám thị mất phiên khi hai yêu cầu mở phiên chạy song song (YCTD-355).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Sửa lỗi xem camera giám thị mất phiên khi mở phiên song song | YCTD-355 |
