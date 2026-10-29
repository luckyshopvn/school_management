---
yctd: YCTD-376
tieu_de: Khối Tình trạng dịch vụ ở trang Bảo trì (ĐX-CN-1)
ngay: 2026-10-29
phien_ban_de_xuat: 0.241.0
---

## 02 Nhật ký

### 2026-10-29 — Khối Tình trạng dịch vụ ở trang Bảo trì (ĐX-CN-1)

#### Công việc đã thực hiện

- Tiến trình nền ghi tín hiệu còn sống vào Redis mỗi 30 giây (kết nối riêng, giữ giá trị một ngày); quá 90 giây không có tín hiệu là đã dừng.
- Khóa cấp nền tảng qua `platformCacheKey` (`packages/server/src/resource-names.ts`, chỉ nhận nhóm `service-status`, `worker`); dịch vụ định danh đọc qua `Infrastructure.platformCache` (không cần ngữ cảnh trường); máy chủ API ghi qua `TimetableGenerationQueue.writePlatformStatus` (kết nối Redis duy nhất của máy chủ API). Không thêm vào baseline của bộ kiểm tĩnh.
- Máy chủ API mỗi 60 giây tự kiểm cơ sở dữ liệu (nền tảng ở chế độ nhiều trường, hệ thống ở chế độ một trường) và thùng chứa tệp dùng chung, ghi kết quả vào Redis, hết hạn sau 180 giây. Không thêm điểm cuối, không thêm bí mật.
- Dịch vụ định danh thêm `GET /api/v1/auth/platform/service-status` (quyền `maintenance.view`, mọi vai trò): đo cơ sở dữ liệu, Redis của mình; gọi `GET /api/v1/health` của máy chủ API (quá 3 giây là không phản hồi); đọc kết quả tự kiểm, tín hiệu còn sống, số việc chờ của hàng đợi xếp thời khoá biểu. Năm mục: Dịch vụ định danh, Máy chủ API, Tiến trình nền, Lưu trữ tệp, Hàng đợi; trạng thái Hoạt động, Chậm (quá 1 giây), Lỗi, Chưa rõ. Không lưu, không ghi nhật ký, không trả nội dung lỗi.
- Trang Bảo trì thêm thẻ "Tình trạng dịch vụ" theo bảng vẽ: đo khi mở trang và khi bấm Kiểm lại, không tự làm mới.
- Kiểm thử: CT-376-1 (`packages/server`), CT-376-2 (`apps/worker`), CT-376-3 (`apps/api`), CT-376-4 đến CT-376-6 (`apps/identity`), CT-376-7 (`Infrastructure.platformCache` không cần trường), CT-376-8 (`platformCacheKey` tiền tố `platform:`, danh sách nhóm), CT-1709 (e2e 240).

#### Quyết định

- Eric duyệt ngày 2026-10-29: Q1 phương án A (qua Redis); Q2 ngưỡng Chậm 1 giây cho mọi mục; Q3 chỉ làm mới khi bấm Kiểm lại; Q4 không làm cảnh báo trong phiếu này.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: tín hiệu của tiến trình nền giữ một ngày (thiết kế ghi hết hạn 90 giây) để báo được giờ tín hiệu cuối; quá 90 giây vẫn tính là đã dừng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-376, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `14_DAC_TA_GIAO_DIEN.md` MH-331, `17_DAC_TA_API.md`.

#### Vấn đề tồn đọng

- Kho tạm trong bộ nhớ (`REDIS_URL=memory://`, hồ sơ thử nghiệm) không chia sẻ với máy chủ API, tiến trình nền: mục Máy chủ API, Tiến trình nền, Lưu trữ tệp hiện Chưa rõ hoặc Lỗi.

## 24 Yêu cầu thay đổi

### YCTD-376: Khối Tình trạng dịch vụ ở trang Bảo trì (ĐX-CN-1) – 2026-10-29

- Lý do: ĐX-CN-1 của YCTD-370; bảng vẽ Bảo trì đã duyệt có khối Tình trạng dịch vụ nhưng chưa có nguồn dữ liệu.
- Nội dung thay đổi: tín hiệu còn sống của tiến trình nền; máy chủ API tự kiểm, ghi kết quả vào Redis (phương án A); điểm cuối `service-status` ở dịch vụ định danh; thẻ Tình trạng dịch vụ ở trang Bảo trì.
- Thành phần bị ảnh hưởng: `packages/server/src/service-status.ts` (mới), `apps/worker/src/heartbeat.ts` (mới), `apps/worker/src/main.ts`, `apps/api/src/common/service-status-reporter.ts` (mới), `apps/api/src/files/file-storage.ts`, `apps/api/src/application.module.ts`, `apps/identity/src/platform/platform-service-status.ts` (mới), `apps/identity/src/common/memory-store.ts`, `apps/identity/src/application.module.ts`, `apps/identity/src/common/infrastructure.ts`, `apps/identity/src/tenancy-route-policy.ts`, `packages/server/src/resource-names.ts`, `apps/api/src/timetables/timetable-generator.ts`, `apps/platform/src/MaintenancePage.tsx`, `apps/platform/src/platform-api.ts`, `tests/e2e/240-cong-van-hanh-dot-2.spec.ts`, tài liệu 14, 17.
- Dữ liệu bị ảnh hưởng: không có database migration; hai khóa Redis cấp nền tảng mới (`platform:worker:heartbeat`, `platform:service-status:api`, tạo qua `platformCacheKey` với danh sách nhóm cố định), chỉ chứa giờ, ok hoặc lỗi, thời gian.
- API bị ảnh hưởng: thêm `GET /api/v1/auth/platform/service-status`; không đổi điểm cuối cũ.
- Quyền bị ảnh hưởng: không; dùng lại `maintenance.view`.
- Triển khai: không thêm biến môi trường; tiến trình nền và máy chủ API cần cùng Redis với dịch vụ định danh (như hiện nay).
- Mức: Lớn. Người phê duyệt: Eric, ngày 2026-10-29.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: khối Tình trạng dịch vụ ở trang Bảo trì của cổng vận hành (YCTD-376).
- Quay lui: hoàn tác commit hợp nhất của PR; hai khóa Redis tự hết hạn, không có database migration.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Khối Tình trạng dịch vụ ở trang Bảo trì | YCTD-376 |

## Thêm dòng

| 11_TIEU_CHI_NGHIEM_THU.md | cuối bảng 19. Chức năng bổ sung theo tám ảnh sơ đồ chức năng | AC-1162 | Cho dịch vụ định danh, máy chủ API, tiến trình nền, lưu trữ tệp, hàng đợi / Khi người vận hành mở trang Bảo trì hoặc bấm Kiểm lại / Thì mỗi mục hiện Hoạt động, Chậm (quá 1 giây), Lỗi hoặc Chưa rõ kèm thời gian phản hồi; Redis hoặc máy chủ API không phản hồi vẫn trả kết quả, không lộ nội dung lỗi; không tự làm mới (Bắt buộc; CT-1709, CT-1710, CT-1729; YCTD-376) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1709 | P19-06 | Hỗ trợ mở Bảo trì: định danh ổn, tiến trình nền không tín hiệu, lưu trữ 1.500 ms; bấm Kiểm lại | Năm dòng, nhãn Hoạt động, Lỗi, Chậm đúng; Kiểm lại gọi máy chủ thêm một lần | Kiểm thử giao diện `tests/e2e/240-cong-van-hanh-dot-2.spec.ts` đạt ngày 29/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1710 | P19-06 | Thu thập tình trạng: đủ tín hiệu; tín hiệu tiến trình nền cũ hơn 90 giây; Redis, máy chủ API, cơ sở dữ liệu cùng lỗi | Hoạt động, Chậm, Lỗi, Chưa rõ đúng từng mục; không ném lỗi; không có nội dung lỗi gốc, địa chỉ máy | Kiểm thử tự động `apps/identity/src/platform/platform-service-status.test.ts` CT-376-4, CT-376-5; `apps/api/src/common/service-status-reporter.test.ts` CT-376-3; `packages/server/src/service-status.test.ts` CT-376-1 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1729 | P19-06 | Bốn vai trò gọi `service-status`; không mã phiên; tiến trình nền ghi tín hiệu | Bốn vai trò 200 đủ năm mục; không mã phiên 401; khóa tín hiệu có giờ ISO, hết hạn một ngày | Kiểm thử tự động CT-376-6, `apps/worker/src/heartbeat.test.ts` CT-376-2 | Đạt |
