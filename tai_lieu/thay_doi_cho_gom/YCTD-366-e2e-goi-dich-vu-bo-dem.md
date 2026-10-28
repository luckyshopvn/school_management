---
yctd: YCTD-366
tieu_de: Kiểm thử giao diện gói dịch vụ chờ bộ đệm ngữ cảnh trường
ngay: 2026-10-29
phien_ban_de_xuat: 0.246.0
---

## 02 Nhật ký

### 2026-10-29 — Kiểm thử giao diện gói dịch vụ chờ bộ đệm ngữ cảnh trường

#### Công việc đã thực hiện

- E2e `134-school-plans.spec.ts` CT-S5a-8 hỏng ở job nhiều trường của PR 260: mục "Kho học liệu" vẫn hiện dù trường alpha chỉ có gói `education`. Ca này qua ở mọi lượt CI trước khi PR 238 merge, kể cả lượt cuối của PR 238; mã lọc menu và dữ liệu gói không đổi. Nguyên nhân là thời điểm: kiểm thử gán gói thẳng vào cơ sở dữ liệu nền tảng ở beforeAll, còn máy chủ API giữ ngữ cảnh trường (kèm gói, trạng thái) trong bộ đệm 30 giây. Các ca e2e mới của PR 238 (khởi tạo trường ở lần mở đầu, vài chục giây) đổi thời điểm chạy, nên cổng quản trị có lúc đọc gói cũ (không giới hạn).
- Sửa kiểm thử: sau khi đăng nhập, chờ `GET /api/v1/school-plan` báo gói giới hạn (trường alpha) hoặc chỉ đọc (trường beta), tối đa 45 giây, rồi tải lại trang và mới kiểm menu, dải báo. Mã ứng dụng không đổi.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: không thêm điểm cuối xóa bộ đệm chỉ để kiểm thử; kiểm thử chờ đúng hành vi đã ghi của bộ phân giải trường (đọc lại sau tối đa 30 giây).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-366, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không.

## 24 Yêu cầu thay đổi

### YCTD-366: Kiểm thử giao diện gói dịch vụ chờ bộ đệm ngữ cảnh trường – 2026-10-29

- Lý do: E2e CT-S5a-8 hỏng thất thường ở job nhiều trường sau PR 238, chặn CI của nhiều PR.
- Nội dung thay đổi: Kiểm thử chờ máy chủ API nạp lại gói, trạng thái của trường (bộ đệm 30 giây) rồi mới kiểm menu và dải chỉ đọc.
- Thành phần bị ảnh hưởng: `tests/e2e/134-school-plans.spec.ts`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: kiểm thử giao diện gói dịch vụ chờ bộ đệm ngữ cảnh trường (YCTD-366).
