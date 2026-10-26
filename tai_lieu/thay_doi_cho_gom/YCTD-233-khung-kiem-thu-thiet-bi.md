---
yctd: YCTD-233
tieu_de: DT-26 phần 26c: khung kiểm thử theo khổ thiết bị
ngay: 2026-10-26
phien_ban_de_xuat: 0.146.0
---

## 02 Nhật ký

### 2026-10-26 — DT-26 phần 26c: khung kiểm thử theo khổ thiết bị

#### Công việc đã thực hiện

- Đọc mục 18 của `32_KE_HOACH_THEO_HE_THONG_SO.md` (26c, ranh giới tệp với 26a, 26b), `tests/playwright.config.ts`, `.github/workflows/ci.yml` sau PR 177.
- `tests/playwright.config.ts`: biến `E2E_DEVICES` (`pr`, `full`); mặc định giữ dự án `chromium` như cũ. Thêm dự án `dien-thoai` (390 × 844), `may-tinh-bang-doc` (820 × 1180), `may-tinh-bang-ngang` (1180 × 820), `dien-thoai-webkit`; nhãn `@thiet-bi`, `@thiet-bi-pr`.
- `tests/e2e/device-checks.ts` (vùng chạm, cỡ chữ ô nhập, cuộn ngang, axe-core, đường cơ sở vi phạm đã biết) và `device-baseline.json`; spec 180 (`180-device-frame.spec.ts`) đo trang đăng nhập của ba ứng dụng và trang chủ cổng quản trị, ảnh chụp tham chiếu bật bằng `E2E_SCREENSHOTS=1` ở Linux.
- `.github/workflows/ci.yml`: việc `kiem-thu-thiet-bi` song song với `kiem-thu-giao-dien` (yêu cầu kéo: một mảnh, hai khổ, Chromium, nhãn `@thiet-bi-pr`; nhánh chính và lịch hằng đêm 19 giờ UTC: bốn dự án, chia hai mảnh, có WebKit); các việc nặng khác bỏ qua khi chạy theo lịch.
- Thêm thư viện kiểm thử `@axe-core/playwright` (axe-core, giấy phép MPL-2.0, chỉ dùng ở kiểm thử).
- Sửa lỗi thật bộ kiểm đo được ở màn đăng nhập phụ huynh (`apps/parent/src/screens/LoginScreen.tsx`): hai liên kết công khai nâng vùng chạm lên 44 px, không ngoại lệ.

#### Quyết định

- Bộ kiểm đã đo ra vi phạm thật ở trang đăng nhập (vùng chạm dưới 44 px, ô nhập 15 px, tương phản màu). Phần 26c không sửa giao diện ngoài liên kết phụ huynh nói trên (phần còn lại thuộc 26d cho ứng dụng giáo viên và phụ huynh, 26e cho cổng quản trị): các vi phạm đó ghi ở `device-baseline.json` kèm phần chịu trách nhiệm; spec chỉ hỏng khi có vi phạm mới ngoài đường cơ sở, xóa khỏi tệp khi đã sửa.
- Ảnh chụp tham chiếu chưa có tệp gốc trong kho (kết xuất khác nhau giữa hệ điều hành): tạo bằng `--update-snapshots` ở Linux của CI rồi đưa vào kho.
- Số phút đo của việc mới ở CI chưa có: ghi vào YCTD-233 sau lần chạy đầu của yêu cầu kéo.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-233, `21_KICH_BAN_KIEM_THU.md` CT-1112 đến CT-1114, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Sửa các vi phạm ở đường cơ sở (26d, 26e); tạo ảnh chụp tham chiếu ở CI; đo thời gian việc `kiem-thu-thiet-bi`.

## 24 Yêu cầu thay đổi

### YCTD-233: DT-26 phần 26c: khung kiểm thử theo khổ thiết bị – 2026-10-26

- Lý do: phần 26c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 18 (YCTD-230): có bộ kiểm cố định để 26d, 26e và các phần sau đo giao diện ở khổ điện thoại và máy tính bảng.
- Nội dung thay đổi: dự án Playwright `dien-thoai`, `may-tinh-bang-doc`, `may-tinh-bang-ngang`, `dien-thoai-webkit` (biến `E2E_DEVICES`); nhãn `@thiet-bi`, `@thiet-bi-pr`; `tests/e2e/device-checks.ts` (vùng chạm 44 px, cỡ chữ ô nhập 16 px, không cuộn ngang cả trang, axe-core; đường cơ sở vi phạm đã biết); spec 180; việc CI `kiem-thu-thiet-bi` song song, yêu cầu kéo chạy tập con, nhánh chính và lịch hằng đêm chạy đủ chia hai mảnh có WebKit; vùng chạm hai liên kết công khai ở màn đăng nhập phụ huynh.
- Thành phần bị ảnh hưởng: `tests/playwright.config.ts`, `tests/e2e/` (tệp mới), `tests/package.json` (thêm `@axe-core/playwright`), `pnpm-lock.yaml`, `.github/workflows/ci.yml` (thêm việc mới và lịch hằng đêm; việc `kiem-thu`, `kiem-thu-giao-dien`, `kiem-thu-nhieu-truong` bỏ qua khi chạy theo lịch), `apps/parent/src/screens/LoginScreen.tsx`.
- Dữ liệu, API, quyền bị ảnh hưởng: không. Giao diện: chỉ vùng chạm hai liên kết ở màn đăng nhập phụ huynh; các vi phạm khác ghi ở đường cơ sở cho 26d, 26e.
- Ảnh hưởng chức năng cũ: không; mặc định chỉ chạy `chromium` như trước.
- Kiểm thử cần thực hiện: `pnpm typecheck`, `pnpm lint`, spec 180 ở `E2E_DEVICES=pr` (hai khổ) và `full`; e2e hiện có.
- Chưa làm: tạo ảnh chụp tham chiếu ở Linux của CI; đo số phút việc mới (ghi vào mục này sau lần chạy đầu); sửa vi phạm ở đường cơ sở (26d, 26e).
- Trạng thái: Đã triển khai (PR 188)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-26

- Phạm vi thay đổi: DT-26 phần 26c, khung kiểm thử theo khổ thiết bị (YCTD-233).
- Chức năng mới: không có chức năng cho người dùng; thêm dự án kiểm thử Playwright theo khổ điện thoại, máy tính bảng dọc, ngang, WebKit; bộ kiểm dùng chung (vùng chạm, cỡ chữ, cuộn ngang, axe-core); việc CI `kiem-thu-thiet-bi`.
- Lỗi đã sửa: vùng chạm hai liên kết công khai ở màn đăng nhập phụ huynh dưới 44 px.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Kiểm thử: CT-1112 đến CT-1114. Kết quả ở PR 188.
- Rủi ro: việc CI thêm thời gian chạy song song (không nối đuôi); ảnh chụp tham chiếu chưa có tệp gốc; vi phạm ở đường cơ sở chờ 26d, 26e.
- Khả năng tương thích: mặc định không đổi (dự án chromium); thêm thư viện kiểm thử `@axe-core/playwright` (MPL-2.0, chỉ ở kiểm thử).
- Phương án quay lui: hoàn lại commit gộp của nhánh 26c.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-26 phần 26c: khung kiểm thử theo khổ thiết bị (dự án Playwright theo khổ thiết bị, nhãn @thiet-bi, bộ kiểm vùng chạm 44 px, cỡ chữ ô nhập, cuộn ngang, axe-core; việc CI kiem-thu-thiet-bi chạy song song, hằng đêm chạy đủ), YCTD-233 | 2026-10-26 |

## index Số đếm

| Ca kiểm thử khởi đầu | Số lượng | +3 |
