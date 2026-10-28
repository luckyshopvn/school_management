---
yctd: YCTD-321
tieu_de: Rà soát lại quy trình Vibecoding_Flow và kiểm thử toàn bộ trên nhánh chính ngày 2026-10-28
ngay: 2026-10-28
phien_ban_de_xuat: 0.197.0
---

## 02 Nhật ký

### 2026-10-28 — Rà soát lại quy trình và kiểm thử toàn bộ trên nhánh chính (YCTD-321)

#### Công việc đã thực hiện

- Chạy lại quy trình Vibecoding_Flow trên `origin/main` `8123bf4d` (sau PR 220 đến 236). Phiên rà soát: không sửa mã, không đổi nghiệp vụ, chỉ ghi lỗi và đề xuất.
- Đối chiếu bộ tài liệu với danh sách tệp bắt buộc của quy trình, quy ước tệp mảnh và `node scripts/gom-thay-doi.mjs --kiem` (44 tệp mảnh, 0 lỗi).
- Lập bảng truy xuất YCTD-295 đến YCTD-313 (tiêu chí nghiệm thu, kịch bản kiểm thử, kiểm thử tự động, kết quả).
- Chạy thật trên cơ sở dữ liệu riêng của phiên (`school_identity_rs321`, `school_system_rs321`): `pnpm format:check`, `pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm database:migrate`, `pnpm test`, ba bộ e2e như CI (giao diện, thiết bị tập con yêu cầu kéo, nhiều trường) có giữ khoá e2e.
- Rà bảo mật theo `22_BAO_MAT.md` cho PR 233 đến 236 (đăng nhập, phiên, mật khẩu, argon2id, mã xác nhận, nhật ký, số CCCD, bí mật trong kho).
- Ghi kết quả, danh sách lỗi theo mức độ và đề xuất xử lý vào tài liệu mới `35_KET_QUA_KIEM_THU.md`.

#### Quyết định

- Kết quả kiểm thử ghi ở tệp mới số 35 vì số 25 và 26 của dự án đã dùng cho `25_QUY_TRINH_NGHIEP_VU/` và `26_SO_DO_CHUC_NANG/` (phiên điều phối đồng ý ngày 2026-10-28). Việc lệch số so với danh sách của quy trình ghi thành phát hiện mức Thấp để Eric quyết.
- Không ghi bù quyết định "mở mọi trường", "gói miễn phí" (thuộc YCTD-314 đang làm, chưa merge) và "sổ liên lạc" (không tìm thấy dữ liệu trong kho và ghi chú các phiên) để không bịa.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-321, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `35_KET_QUA_KIEM_THU.md`.

#### Vấn đề tồn đọng

- Các lỗi và đề xuất ở `35_KET_QUA_KIEM_THU.md` mục 6, chờ Eric duyệt cách xử lý.

## 24 Yêu cầu thay đổi

### YCTD-321: Rà soát lại quy trình Vibecoding_Flow và kiểm thử toàn bộ trên nhánh chính – 2026-10-28

- Lý do: Eric yêu cầu chạy lại quy trình để tìm chỗ còn sót sau các PR 220 đến 236 merge ngày 2026-10-28.
- Nội dung thay đổi: Thêm tài liệu `35_KET_QUA_KIEM_THU.md` (kết quả kiểm thử, bảng truy xuất YCTD-295 đến YCTD-313, rà bảo mật, danh sách lỗi phân loại, đề xuất xử lý); ghi bổ sung `03` các việc đã merge từ YCTD-295 đến YCTD-313; thêm dòng 35 vào mục lục.
- Thành phần bị ảnh hưởng: Chỉ tài liệu (`tai_lieu/35_KET_QUA_KIEM_THU.md`, tệp mảnh này). Không đổi mã, dữ liệu, API, giao diện, phân quyền.
- Khả năng ảnh hưởng chức năng cũ: Không.
- Kiểm thử cần thực hiện: `pnpm format:check`, `node scripts/gom-thay-doi.mjs --kiem`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: rà soát lại quy trình và kiểm thử toàn bộ trên nhánh chính, tài liệu `35_KET_QUA_KIEM_THU.md` (YCTD-321). Không đổi mã.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Rà soát lại quy trình, kiểm thử toàn bộ trên nhánh chính, tài liệu 35 kết quả kiểm thử | YCTD-321 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P01 Nền tảng, đơn vị và phân quyền | YCTD-311: tài khoản theo số CCCD, mật khẩu mặc định có hạn, băm argon2id, nhân viên vận hành của công ty (PR 235, đặc tả 07, 08, 16, 17, 22 chưa cập nhật, xem `35` mục 6) |
| 03_DANH_SACH_CONG_VIEC.md | P07 Nhân sự | YCTD-309: hồ sơ cán bộ, giáo viên ở trang riêng chia thẻ (PR 232) |
| 03_DANH_SACH_CONG_VIEC.md | P17 Báo cáo và bảng điều khiển | YCTD-295: trang chủ cổng quản trị theo mẫu Tổng quan (PR 220); YCTD-307: chọn phân hệ thì về bảng điều khiển của phân hệ (PR 231) |
| 03_DANH_SACH_CONG_VIEC.md | P19 Kênh truy cập và thông báo | YCTD-296: áp sáu màn mẫu giao diện (PR 222); YCTD-300: ứng dụng học sinh riêng (PR 224); YCTD-310: đăng nhập theo mẫu Sở, Cấp, Trường và Ghi nhớ (PR 233); YCTD-312, YCTD-313: đăng nhập cổng vận hành và mã xác nhận (PR 234, 236) |

## Thêm dòng

| index.md | 34 | 35 | [35_KET_QUA_KIEM_THU.md](35_KET_QUA_KIEM_THU.md) | Kết quả kiểm thử | Lượt rà soát ngày 2026-10-28 trên nhánh chính: lệnh, số đạt và hỏng, bảng truy xuất YCTD-295 đến YCTD-313, rà bảo mật, lỗi phân loại và đề xuất xử lý (YCTD-321) | 10 Kiểm thử | Chờ Eric duyệt cách xử lý |
