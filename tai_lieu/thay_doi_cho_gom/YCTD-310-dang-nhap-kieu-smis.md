---
yctd: YCTD-310
tieu_de: Đăng nhập kiểu SMIS (Sở → Phường → Cấp học → Trường) và bản nhiều trường trên máy
ngay: 2026-10-28
phien_ban_de_xuat: 0.183.0
---

## 02 Nhật ký

### 2026-10-28 — Đăng nhập kiểu SMIS và bản nhiều trường trên máy

#### Công việc đã thực hiện

- Trang đăng nhập cổng quản trị ở tên miền chung: bốn ô chọn xếp dọc theo thứ tự Sở GD&ĐT → Phường/Xã → Cấp học → Trường như trang đăng nhập của hệ thống ngành; ô sau mở khi đã chọn ô trước; ô Phường/Xã có "Tất cả phường, xã"; ô Cấp học chỉ hiện cấp có trường trong sở, phường đã chọn (điểm cuối `GET /api/v1/auth/directory/levels` nhận thêm `department`, `commune`).
- Lệnh `pnpm --filter @school-management/database nhieu-truong-cuc-bo` dựng bản nhiều trường trên máy song song bản một trường: vai trò, cơ sở dữ liệu nền tảng riêng, khoá gốc và mật khẩu sinh mới chỉ ghi vào tệp môi trường đã nằm trong `.gitignore`, nạp danh mục từ CSV theo tham số, nhận trường demo hiện có (adopt-existing, dùng lại cơ sở dữ liệu cũ), gắn trường demo vào danh mục. Tập lệnh `scripts/chay-nhieu-truong.mjs` chạy dịch vụ định danh, máy chủ API, cổng quản trị ở cổng 3101, 3100, 5190.
- `.gitignore` bỏ qua `.env.*` (trừ `.env.example`). Hướng dẫn ở tài liệu 32 mục 16.10 và README.

#### Quyết định

- Danh mục của DT-24 đã phân cấp Sở → Phường/Xã (mã xã 5 chữ số, không có cấp huyện): không đổi cấu trúc dữ liệu, chỉ đổi thứ tự ô chọn và lọc cấp học.
- Theo thứ tự Eric yêu cầu (Phường trước Cấp học), khác trang hệ thống ngành (Cấp học trước Phường/Xã).
- Trường demo nhận vào nền tảng bằng adopt-existing, không chép dữ liệu; mã nền tảng `tc-demo` (mã nền tảng cần 3 đến 32 ký tự chữ thường), tên miền `tc.truong.localhost`; đơn vị danh mục giả `DEMO-TC` nguồn `demo-local`. Bản nhiều trường tắt việc nền chạy theo giờ để không chạy trùng bản một trường trên cùng cơ sở dữ liệu.
- Ứng dụng giáo viên, phụ huynh chưa có đăng nhập theo đơn vị nên không đổi.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-310, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 16.10.

#### Vấn đề tồn đọng

- Đăng nhập theo đơn vị cho ứng dụng giáo viên, phụ huynh (khi cần) là phần việc riêng.

## 24 Yêu cầu thay đổi

### YCTD-310: Đăng nhập kiểu SMIS và bản nhiều trường trên máy – 2026-10-28

- Lý do: Eric yêu cầu trang đăng nhập làm tương tự trang đăng nhập của hệ thống ngành (chọn Sở → Phường → Cấp học → Trường), giữ trường demo hiện có, nạp danh mục trường toàn quốc vào bản nhiều trường trên máy.
- Nội dung thay đổi: thứ tự và cách mở các ô chọn đơn vị ở MH-47; lọc cấp học theo sở, phường; lệnh dựng và tập lệnh chạy bản nhiều trường trên máy; bỏ qua `.env.*` trong `.gitignore`.
- Thành phần bị ảnh hưởng: `apps/portal` (trang đăng nhập), `apps/identity` (điểm cuối cấp học của ô chọn đơn vị), `database` (truy vấn cấp học, lệnh `nhieu-truong-cuc-bo`, hàm tạo cơ sở dữ liệu có vai trò riêng dùng chung với chợ gia sư), `scripts/chay-nhieu-truong.mjs`.
- Dữ liệu, API, giao diện, quyền bị ảnh hưởng: API thêm tham số tuỳ chọn `department`, `commune` cho `GET /api/v1/auth/directory/levels`; không đổi cấu trúc dữ liệu, không đổi quyền.
- Ảnh hưởng chức năng cũ: chế độ một trường và tên miền của trường giữ nguyên; người đã ghi nhớ đơn vị theo bố cục cũ (có cấp học, chưa chọn phường) được coi là "Tất cả phường, xã".
- Kiểm thử cần thực hiện: `database` CT-310-1 đến CT-310-3; `apps/identity` CT-24-5 (cấp học theo phạm vi); e2e 160, 01, 59; typecheck, lint, định dạng; `node scripts/gom-thay-doi.mjs --kiem`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Thay đổi chức năng: trang đăng nhập cổng quản trị ở tên miền chung chọn Sở GD&ĐT → Phường/Xã → Cấp học → Trường; cấp học lọc theo sở, phường (YCTD-310).
- Công cụ: lệnh `nhieu-truong-cuc-bo` và `scripts/chay-nhieu-truong.mjs` dựng, chạy bản nhiều trường trên máy song song bản một trường.
- Không đổi cấu trúc dữ liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Đăng nhập kiểu SMIS (Sở → Phường → Cấp học → Trường), bản nhiều trường trên máy | YCTD-310 |

## Nối dòng

| 14_DAC_TA_GIAO_DIEN.md | MH-47 | Từ YCTD-310 ô chọn đơn vị ở tên miền chung xếp dọc theo thứ tự Sở GD&ĐT → Phường/Xã (có "Tất cả phường, xã") → Cấp học (chỉ cấp có trường trong phạm vi đã chọn) → Trường, ô sau mở khi đã chọn ô trước |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1501 | P19-06 | CT-310-1: ghi tệp môi trường của bản nhiều trường giữ chú thích, biến khác; thay biến đã có, thêm biến mới | nội dung đúng từng dòng | Kiểm thử tự động `database/src/local-multi-school.test.ts` CT-310-1 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1502 | P19-06 | CT-310-2: cấp học của ô chọn đơn vị lọc theo sở, phường (danh mục mẫu giả); điểm cuối `directory/levels` nhận `department`, `commune`, mã phường sai thì 400 | chỉ cấp có trường đang hoạt động trong phạm vi; không tham số thì đủ năm cấp | Kiểm thử tự động `database/src/local-multi-school.test.ts` CT-310-2, `apps/identity/src/directory/unit-directory.test.ts` CT-24-5 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1503 | P19-06 | CT-310-3: gắn trường demo vào danh mục ở phường chỉ định; phường khác sở, cấp học sai, sở chưa có thì báo lỗi; chạy lại cho trường khác thì chuyển mã | đơn vị tìm thấy theo sở, phường, cấp; mã chỉ gắn một trường | Kiểm thử tự động `database/src/local-multi-school.test.ts` CT-310-3 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1504 | P19-06 | CT-310-4: giao diện chọn Sở → Phường/Xã (có "Tất cả phường, xã") → Cấp học → Trường ở tên miền chung, đăng nhập sang tên miền của trường | đơn vị chưa dùng nền tảng báo rõ; đăng nhập đúng sang trường alpha | Kiểm thử giao diện `tests/e2e/160-unit-directory-login.spec.ts` | Đạt |
