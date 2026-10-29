---
yctd: YCTD-362
tieu_de: Phòng học video của chợ gia sư
ngay: 2026-10-29
phien_ban_de_xuat: 0.242.0
---

## 02 Nhật ký

### 2026-10-29 — Phòng học video của chợ gia sư (DT-27 phần 27j)

#### Công việc đã thực hiện

- Thêm phần 27j vào tài liệu 32 (mục 19.12) và GD-164 (mốc của phòng học, quyết định của Eric ngày 2026-10-29).
- Cơ sở dữ liệu chợ marketplace 0040: `market_recording_consents` (đồng ý ghi hình theo con và gia sư, rút được), `market_session_rooms` (mở, đóng, xác nhận buổi), `market_session_participants` (phòng chờ, quyền nói, chia sẻ, mời ra), `market_session_attendance` (nhật ký vào ra).
- Cấu hình chợ thêm năm mốc (mở phòng trước giờ học, vào muộn tính vắng, gia sư vắng, tỉ lệ đủ buổi, tự xác nhận); API cổng vận hành đọc, ghi được; mặc định 10 phút, 15 phút, 10 phút, 80%, 24 giờ.
- Máy chủ API `apps/api/src/market/market-rooms.ts`: trạng thái phòng của buổi, đồng ý ghi hình (con từ đủ 7 tuổi cùng xác nhận), không đồng ý thì hủy buổi và hoàn đủ, vào phòng chờ, rời phòng, báo gia sư vắng (hoàn đủ), phòng của gia sư (người trong phòng chờ, điểm danh), cho vào, cho nói, cho chia sẻ màn hình, mời ra, xác nhận đã dạy kèm nhận xét. Quy tắc thuần ở `market-room-rules.ts`.
- `session/start` của 27i dùng mốc mở phòng của cấu hình, ghi phòng đã mở và trả thông tin vào phòng của chủ phòng; `session/join` chuyển sang phòng chờ; `session/end` đóng phòng, đóng các khoảng có mặt. Sự kiện vào ra của máy chủ video với phòng `market-*` chuyển sang chợ để ghi điểm danh.
- Việc định kỳ của chợ tự xác nhận buổi gia sư không xác nhận sau mốc (`runDue` trả thêm `autoConfirmed`).
- Ứng dụng Chợ gia sư: trang phòng học (`SessionRoom`): điều kiện vào phòng, đồng ý ghi hình, chọn "Con học" hay "Tôi vào xem", phòng chờ (hỏi lại mỗi 5 giây), lớp video `VideoRoom`, báo gia sư vắng, kết thúc buổi có điểm danh và nhận xét của gia sư. Trang Hồ sơ con có danh sách đồng ý ghi hình theo gia sư, nút rút đồng ý.
- Ứng dụng Gia sư: trang phòng dạy (`TeachingRoom`): điều kiện mở phòng, lớp video, `VideoHostPanel` (phòng chờ, cho vào, cho nói, cho chia sẻ, mời ra), kết thúc, điểm danh, xác nhận đã dạy.
- `VideoHostPanel` thêm `recordingLocked`: buổi bắt buộc ghi thì không có nút dừng ghi.
- Kiểm thử: CT-27j-1 (quy tắc thuần), sửa CT-27i-5, thêm CT-27j-2 (máy chủ), spec 199 CT-27j-3 (giao diện, bộ giả lập lớp video).

#### Quyết định

- Quyết định của Eric ngày 2026-10-29 ghi ở GD-164 và mục 19.12.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: đồng ý ghi hình lúc đặt buổi (27i) vẫn giữ; vào phòng cần thêm đồng ý theo gia sư. Gia sư mời ra được cả phụ huynh vào xem. Gia sư rời lớp video là kết thúc phòng.
- Spec 199 dùng học sinh đủ 18 tuổi (không bắt buộc ghi hình) để không phụ thuộc kho lưu bản ghi của môi trường kiểm thử; luồng đồng ý và ghi hình bắt buộc có kiểm thử máy chủ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-362, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Cần luật sư xem lại việc con từ đủ 7 tuổi cùng xác nhận đồng ý ghi hình trước khi mở thật.
- Biểu mẫu chỉnh năm mốc ở trang Chợ gia sư của cổng vận hành làm ở YCTD-363 (đụng `apps/platform`).
- Sự kiện "ghi xong" của máy chủ video cho phòng của chợ chưa nối (bản ghi LiveKit thật ở trạng thái đang xử lý đến khi có việc nối này); bộ giả lập trả tệp ngay nên kiểm thử không bị ảnh hưởng.

## 24 Yêu cầu thay đổi

### YCTD-362: Phòng học video của chợ gia sư – 2026-10-29

- Lý do: rà soát giao diện ngày 2026-10-28 ghi nút "Vào phòng học", "Mở phòng học" chỉ hiện một dòng chữ (T-M1, H-1, H-2); Eric duyệt thiết kế ngày 2026-10-28 và chốt quyết định phòng học ngày 2026-10-29.
- Nội dung thay đổi: phần 27j của DT-27: đồng ý ghi hình theo gia sư, phòng chờ, vào ra, điểm danh tự động, gia sư vắng, xác nhận buổi, tự xác nhận; giao diện hai phía.
- Thành phần bị ảnh hưởng: `database/marketplace/migrations/0040_create_market_session_rooms.ts`, `database/marketplace/schema-parts/dt-27j-phong-hoc-video.ts`, `database/src/marketplace/market-settings.ts`, `apps/api/src/market/market-rooms.ts`, `market-room-rules.ts`, `market-safety.ts`, `market-bookings.ts`, `market-admin.ts`, `apps/api/src/video/video.controller.ts`, `apps/api/src/dang-ky/dt-27j-phong-hoc-video.ts`, `packages/ui/src/VideoRoom.tsx`, `apps/market/src/SessionRoom.tsx`, `ParentBookings.tsx`, `ParentArea.tsx`, `apps/tutor/src/TeachingRoom.tsx`, `TutorBookings.tsx`, `tests/e2e/199-market-video-room.spec.ts`, `tests/e2e-multi-environment.mjs`.
- Dữ liệu, API, quyền bị ảnh hưởng: bốn bảng mới ở cơ sở dữ liệu chợ; API mới `GET /market/bookings/:id/room`, `POST .../room/consent`, `.../room/decline-recording`, `.../room/enter`, `.../room/leave`, `.../tutor-no-show`, `GET /market/recording-consents`, `POST /market/recording-consents/:id/withdraw`, `GET /market/tutor/bookings/:id/room`, `POST .../room/participants/:identity`, `.../room/confirm`; `session/join` trả trạng thái phòng chờ; cấu hình chợ thêm năm mốc.
- Ảnh hưởng chức năng cũ: phụ huynh không vào thẳng phòng nữa mà qua phòng chờ, gia sư cho vào; buổi có trẻ vị thành niên cần đồng ý ghi hình theo gia sư; phòng mở trước giờ học 10 phút thay cho 15 phút.
- Kiểm thử cần thực hiện: kiểm kiểu `apps/api`, `apps/market`, `apps/tutor`; kiểm thử máy chủ chợ; kiểm thử giao diện 197, 198, 199.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: phòng học video của chợ gia sư (DT-27 phần 27j): đồng ý ghi hình theo gia sư, phòng chờ, điểm danh tự động, gia sư vắng, xác nhận và tự xác nhận buổi (YCTD-362).
- Cơ sở dữ liệu chợ: marketplace 0040.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Phòng học video của chợ gia sư | YCTD-362 |
