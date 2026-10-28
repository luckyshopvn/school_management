---
yctd: YCTD-352
tieu_de: Sửa CI nhánh chính: ảnh tham chiếu trang đăng nhập cổng quản trị theo giao diện đăng nhập mới
ngay: 2026-10-29
phien_ban_de_xuat: 0.232.0
---

## 02 Nhật ký

### 2026-10-29 — Sửa CI nhánh chính: ảnh tham chiếu trang đăng nhập cổng quản trị (YCTD-352)

#### Công việc đã thực hiện

- Việc `kiem-thu-thiet-bi` của nhánh chính hỏng từ PR 233 (YCTD-310, giao diện đăng nhập mới): ca `180-device-frame.spec.ts:70` "Ảnh chụp tham chiếu trang đăng nhập cổng quản trị" lệch ảnh mẫu ở bốn dự án `dien-thoai`, `dien-thoai-webkit`, `may-tinh-bang-doc`, `may-tinh-bang-ngang` (lỗi L-02 ở `35_KET_QUA_KIEM_THU.md`, YCTD-321).
- Thay bốn ảnh mẫu `tests/e2e/180-device-frame.spec.ts-snapshots/dang-nhap-cong-quan-tri-*-linux.png` bằng ảnh `*-actual.png` của lần chạy CI nhánh chính 40688025038 (commit `8123bf4d`, artifact `ket-qua-kiem-thu-thiet-bi-0`), theo cách của YCTD-306.
- Ảnh thực tế ổn định: mỗi khổ có bốn bản (hai mảnh, lần chạy và lần thử lại) giống hệt nhau. Trang đăng nhập cổng quản trị không đổi từ `8123bf4d` đến `5bb5e025` (không có thay đổi ở `apps/portal/src/pages/LoginPage.tsx`, `apps/portal/src/index.css`, `packages/ui`).
- PR gắn nhãn `thiet-bi-day-du` để chạy đủ bốn dự án thiết bị.

#### Quyết định

- Không đổi ngưỡng `maxDiffPixelRatio` và không bỏ ca ảnh tham chiếu. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-352, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- PR 243 (khung chung mới của cổng quản trị) sửa `apps/portal/src/index.css`; nếu PR đó làm đổi trang đăng nhập thì sinh lại bốn ảnh này từ CI sau khi merge.

## 24 Yêu cầu thay đổi

### YCTD-352: Sửa CI nhánh chính: ảnh tham chiếu trang đăng nhập cổng quản trị theo giao diện đăng nhập mới – 2026-10-29

- Lý do: Việc `kiem-thu-thiet-bi` của nhánh chính hỏng liên tục từ PR 233 vì ảnh mẫu của spec 180 còn là trang đăng nhập cũ (lỗi L-02, YCTD-321).
- Nội dung thay đổi: Thay bốn ảnh mẫu Linux của spec 180 bằng ảnh do CI chụp trang đăng nhập mới.
- Thành phần bị ảnh hưởng: `tests/e2e/180-device-frame.spec.ts-snapshots/` (bốn tệp ảnh). Không đổi mã, dữ liệu, API, giao diện, phân quyền.
- Khả năng ảnh hưởng chức năng cũ: Không.
- Kiểm thử cần thực hiện: việc `kiem-thu-thiet-bi` đủ bốn dự án (nhãn `thiet-bi-day-du`).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: ảnh tham chiếu trang đăng nhập cổng quản trị của kiểm thử theo khổ thiết bị theo giao diện đăng nhập mới, sửa CI nhánh chính (YCTD-352).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Sửa CI nhánh chính: ảnh tham chiếu trang đăng nhập cổng quản trị | YCTD-352 |
