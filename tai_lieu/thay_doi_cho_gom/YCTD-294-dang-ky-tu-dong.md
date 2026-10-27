---
yctd: YCTD-294
tieu_de: Đăng ký mô-đun, tệp thay đổi cấu trúc và kiểu bảng bằng tệp riêng của từng phần
ngay: 2026-10-27
phien_ban_de_xuat: 0.171.0
---

## 02 Nhật ký

### 2026-10-27 — Đăng ký bằng tệp riêng của từng phần

#### Công việc đã thực hiện

- Tệp thay đổi cấu trúc của bốn cơ sở dữ liệu (định danh, hệ thống, năm học, nền tảng) nạp từ chỉ mục sinh tự động: `database/sinh-chi-muc.mjs` đọc `database/<loại>/migrations/` rồi sinh `<loại>/migrations.generated.ts`; `<loại>/index.ts` chỉ còn xuất lại chỉ mục. Không đổi tên tệp nào.
- Kiểu bảng của từng phần đặt ở `database/<loại>/schema-parts/<phần>.ts`, thêm bảng vào `SchoolYearDatabase` (hoặc `SystemDatabase`, `PlatformDatabase`, `IdentityDatabase`) bằng `declare module '../schema.js'`; chỉ mục `<loại>/schema-parts.generated.ts` kéo các tệp này vào chương trình, `database/src/index.ts` xuất lại kiểu của chúng. Chuyển bảng `scorm_attempts` (DT-28 phần 28h) sang `school-year/schema-parts/dt-28h-goi-scorm.ts` làm mẫu.
- Máy chủ API: mỗi phần thêm `apps/api/src/dang-ky/<phần>.ts` xuất mặc định `{ controllers, providers, transitionSteps } satisfies PhanDangKy` (`src/common/dang-ky-phan.ts`); `apps/api/sinh-dang-ky.mjs` sinh `src/dang-ky.generated.ts`; `ApplicationModule` nối các phần theo thứ tự tên tệp sau danh sách có sẵn. Chuyển đăng ký của DT-28 phần 28h sang `src/dang-ky/dt-28h-goi-scorm.ts` làm mẫu.
- Bước dựng, kiểm kiểu của `database` và `apps/api` chạy tập lệnh sinh trước `tsc`; tệp `*.generated.ts` không đưa lên kho (`.gitignore`).
- CI chạy `node database/sinh-chi-muc.mjs --kiem` và `node apps/api/sinh-dang-ky.mjs --kiem`: báo lỗi khi tên tệp sai mẫu, tệp thay đổi cấu trúc thiếu `export const migration`, tệp kiểu bảng thiếu `declare module`, tệp đăng ký thiếu `export default`, bộ điều khiển (`@Controller`) chưa có ở `application.module.ts` hay tệp nào ở `src/dang-ky/`, chỉ mục đã sinh lệch với thư mục.

#### Quyết định

- Chỉ mục sinh khi dựng, không đưa lên kho: một danh sách sinh ra mà đưa lên kho vẫn xung đột khi hai PR thêm dòng liền nhau (thường gặp vì phần mới lấy số lớn nhất), nên chỉ thư mục là nguồn. Phương án đã loại: đọc thư mục lúc chạy bằng `import()` động (mất kiểm kiểu, `dist` còn tệp cũ khi xoá nguồn), `import.meta.glob`/`require.context` (máy chủ dựng bằng `tsc`, không có bộ đóng gói).
- Giữ nguyên danh sách bộ điều khiển, dịch vụ đã có ở `application.module.ts` để không đổi thứ tự đăng ký tuyến; các phần nối sau cùng nên thứ tự cũ giữ nguyên (28h vốn đứng cuối).
- Thứ tự chạy tệp thay đổi cấu trúc không đổi: Kysely xếp theo tên tệp (đã bật `allowUnorderedMigrations`). So bốn cơ sở dữ liệu migrate từ đầu bằng mã cũ và mã mới trên PostgreSQL máy phát triển: cùng số bảng (định danh 25, hệ thống 94, năm học 457, nền tảng 53), số cột (173, 1113, 5303, 524), cùng cột, chỉ mục, ràng buộc và danh sách tệp đã chạy.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-294, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- PR đang mở (DT-26, DT-27, DT-28) khi gộp main phải chuyển dòng đăng ký của mình sang tệp riêng một lần (hướng dẫn ở mô tả PR).
- Các danh sách chung khác còn sửa tại chỗ: xuất lại hằng số, kiểu ở `database/src/index.ts` (trừ kiểu bảng của phần), `MY_WORK_SOURCE_TYPES`, menu cổng quản trị.

## 24 Yêu cầu thay đổi

### YCTD-294: Đăng ký mô-đun, tệp thay đổi cấu trúc và kiểu bảng bằng tệp riêng của từng phần – 2026-10-27

- Lý do: các PR song song của DT-26, DT-27, DT-28 cùng thêm dòng vào `apps/api/src/application.module.ts`, `database/<loại>/index.ts`, `database/<loại>/schema.ts`; mỗi lần một PR merge thì PR còn lại xung đột, phải gộp main và chờ CI thêm 30 đến 70 phút.
- Nội dung thay đổi: mỗi phần thêm tệp riêng (`database/<loại>/migrations/<số>_<tên>.ts`, `database/<loại>/schema-parts/<phần>.ts`, `apps/api/src/dang-ky/<phần>.ts`); chỉ mục sinh khi dựng; CI kiểm quên đăng ký và chỉ mục lệch.
- Thành phần bị ảnh hưởng: `database/sinh-chi-muc.mjs`, `database/<loại>/index.ts`, `database/<loại>/schema.ts`, `database/school-year/schema-parts/`, `database/src/index.ts`, `database/package.json`, `apps/api/sinh-dang-ky.mjs`, `apps/api/src/application.module.ts`, `apps/api/src/common/dang-ky-phan.ts`, `apps/api/src/dang-ky/`, `apps/api/package.json`, `.gitignore`, `.github/workflows/ci.yml`.
- Dữ liệu, API, giao diện, quyền bị ảnh hưởng: không; cấu trúc cơ sở dữ liệu sau migrate giống hệt trước.
- Ảnh hưởng chức năng cũ: không đổi hành vi chạy; thứ tự bộ điều khiển, dịch vụ, bước chuyển năm học giữ nguyên.
- Kiểm thử cần thực hiện: kiểm kiểu, quy tắc viết mã, kiểm thử máy chủ API và cơ sở dữ liệu, migrate từ đầu bốn cơ sở dữ liệu và so cấu trúc, kiểm thử giao diện 01 đến 09, thử hai nhánh mỗi nhánh thêm một mô-đun và một tệp thay đổi cấu trúc rồi gộp không xung đột.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: đăng ký mô-đun, tệp thay đổi cấu trúc, kiểu bảng bằng tệp riêng của từng phần (YCTD-294).
- Chỉ mục sinh khi dựng (`database/sinh-chi-muc.mjs`, `apps/api/sinh-dang-ky.mjs`), CI kiểm quên đăng ký.
- Không đổi hành vi chạy, không đổi cấu trúc dữ liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Đăng ký mô-đun, tệp thay đổi cấu trúc, kiểu bảng bằng tệp riêng của từng phần | YCTD-294 |

## Thêm dòng

| 13_CONG_NGHE_SU_DUNG.md | QU-11 | QU-12 | Mỗi phần đăng ký bằng tệp riêng, không thêm dòng vào danh sách chung: tệp thay đổi cấu trúc ở `database/<loại>/migrations/<số>_<tên>.ts` (xuất `migration`), bảng mới ở `database/<loại>/schema-parts/<phần>.ts` (`declare module '../schema.js'` thêm bảng vào giao diện cơ sở dữ liệu), bộ điều khiển, dịch vụ, bước chuyển năm học của máy chủ API ở `apps/api/src/dang-ky/<phần>.ts` (`export default { … } satisfies PhanDangKy`). Chỉ mục `*.generated.ts` sinh khi dựng, không đưa lên kho; CI chạy `node database/sinh-chi-muc.mjs --kiem`, `node apps/api/sinh-dang-ky.mjs --kiem` (YCTD-294) |
| 12_KIEN_TRUC_HE_THONG.md | QĐ-40 | QĐ-41 | Đăng ký bằng tệp riêng của từng phần (YCTD-294): chỉ mục tệp thay đổi cấu trúc, kiểu bảng, đăng ký máy chủ API sinh từ thư mục lúc dựng (`database/sinh-chi-muc.mjs`, `apps/api/sinh-dang-ky.mjs`), không đưa lên kho; kiểu bảng ghép bằng `declare module`; các phần nối sau danh sách có sẵn của `ApplicationModule` theo thứ tự tên tệp; phương án đã loại: chỉ mục sinh ra đưa lên kho (vẫn xung đột khi hai PR thêm dòng liền nhau), đọc thư mục lúc chạy bằng `import()` động (mất kiểm kiểu, `dist` giữ tệp đã xoá), `import.meta.glob` (máy chủ dựng bằng `tsc`, không có bộ đóng gói) | Đã chọn |
