---
yctd: YCTD-310
tieu_de: Trang đăng nhập theo mẫu (Sở → Cấp, Phường / Xã → Trường), Ghi nhớ phiên dài và bản nhiều trường trên máy
ngay: 2026-10-28
phien_ban_de_xuat: 0.183.0
---

## 02 Nhật ký

### 2026-10-28 — Trang đăng nhập theo mẫu và bản nhiều trường trên máy

#### Công việc đã thực hiện

- Thiết kế lại trang đăng nhập cổng quản trị theo ảnh mẫu của Eric: một thẻ trắng giữa nền xanh nhạt có chấm, tiêu đề "Đăng nhập hệ thống", mục THÔNG TIN ĐƠN VỊ (Sở Giáo dục và Đào tạo; Cấp và Phường / Xã cùng hàng, điện thoại xếp dọc; Trường), mục THÔNG TIN TÀI KHOẢN (Tên đăng nhập, Mật khẩu, hàng mã xác nhận có ảnh và nút làm mới dạng biểu tượng), Ghi nhớ, Quên Mật Khẩu?, nút Đăng nhập toàn chiều rộng. Bỏ cột thương hiệu bên trái; tên hệ thống, biểu trưng của trường (nếu có) đặt nhỏ phía trên thẻ.
- Tên miền chung: chọn Sở rồi Cấp (bắt buộc), Phường / Xã chỉ để lọc (có "Tất cả phường, xã" để bỏ lọc), danh sách Trường lọc theo Sở, Cấp và Phường nếu chọn; ô Cấp chỉ hiện cấp có trường trong sở (và phường nếu chọn) nhờ điểm cuối `GET /api/v1/auth/directory/levels` nhận thêm `department`, `commune`. Hàng mã xác nhận luôn hiện, ảnh của đúng trường hiện khi đã chọn trường. Tên miền của trường và chế độ một trường: mục THÔNG TIN ĐƠN VỊ chỉ đọc (tên Sở, trường, cấp, mã, năm học).
- Ghi nhớ: (a) nhớ đơn vị đã chọn (Sở, Cấp, Phường, Trường) và tên đăng nhập ở máy; (b) máy chủ định danh nhận `remember` khi đăng nhập (cả đăng nhập theo đơn vị): phiên cổng quản trị kéo dài `PORTAL_REMEMBER_DAYS` ngày (mặc định 30, từ 1 đến 90), cookie mã làm mới bền; không tích thì hạn 8 giờ như cũ và cookie là cookie phiên, hết khi đóng trình duyệt; (c) biểu mẫu thật có `autocomplete="username"`, `autocomplete="current-password"` để trình quản lý mật khẩu của trình duyệt đề nghị lưu. Trang không bao giờ tự lưu mật khẩu (localStorage, sessionStorage, cookie, IndexedDB).
- Lệnh `pnpm --filter @school-management/database nhieu-truong-cuc-bo` dựng bản nhiều trường trên máy song song bản một trường: vai trò, cơ sở dữ liệu nền tảng riêng, khoá gốc và mật khẩu sinh mới chỉ ghi vào tệp môi trường đã nằm trong `.gitignore`, nạp danh mục từ CSV theo tham số, nhận trường demo hiện có (adopt-existing, dùng lại cơ sở dữ liệu cũ), gắn trường demo vào danh mục. Lệnh dựng cũng tạo cơ sở dữ liệu chợ gia sư, khóa của chợ và bật chợ ở `cho-gia-su.truong.localhost`, ứng dụng Gia sư ở `gia-su.truong.localhost` (thu tiền thật luôn tắt). Tập lệnh `scripts/chay-nhieu-truong.mjs` chạy đủ bản nhiều trường bằng một lệnh: định danh 3101, API 3100, tiến trình nền, cổng quản trị 5190, cổng vận hành 5191, ứng dụng giáo viên 5192, phụ huynh 5193, học sinh 5194, chợ gia sư 5195, ứng dụng Gia sư 5196, tất cả ở tên miền `*.localhost`.
- Quản trị vào mọi trường trên bản nhiều trường: một tài khoản vận hành nền tảng (cơ chế DT-24, chính sách `any_school`) đăng nhập ở cổng nền tảng rồi mở phiên quản trị sang trường bất kỳ; cổng nền tảng tạo liên kết `http` ở cổng của cổng quản trị khi đặt `VITE_SCHOOL_PORTAL_PORT` (máy phát triển).
- `.gitignore` bỏ qua `.env.*` (trừ `.env.example`). Hướng dẫn ở tài liệu 32 mục 16.10 và README.

#### Quyết định

- Danh mục của DT-24 đã phân cấp Sở → Phường/Xã (mã xã 5 chữ số, không có cấp huyện): không đổi cấu trúc dữ liệu.
- Thứ tự ô theo ảnh mẫu Eric gửi sau (Cấp và Phường / Xã cùng hàng, phường không bắt buộc), thay thứ tự Sở → Phường → Cấp của yêu cầu đầu.
- Ô Tên đăng nhập, Mật khẩu, Mã xác nhận dùng chữ gợi ý như mẫu; nhãn "Số điện thoại hoặc tên đăng nhập", "Mật khẩu", "Mã xác nhận" vẫn có cho trình đọc màn hình (ngoại lệ TD-02 của riêng trang đăng nhập; chữ gợi ý màu chữ phụ, tương phản trên 4.5:1). Ô Ghi nhớ, nút làm mới mã giữ tên "Ghi nhớ tài khoản", "Làm mới mã" cho trình đọc màn hình.
- Chế độ một trường giữ cách hiện mã xác nhận đã có (theo cấu hình hoặc sau lần nhập sai đầu tiên, máy chủ bắt buộc sau số lần sai cấu hình); không thêm đường vượt mã xác nhận: e2e đọc đáp án ở kho tạm như trước.
- Không tích Ghi nhớ thì cookie mã làm mới của cổng quản trị là cookie phiên (trước đây bền 8 giờ); phiên vẫn hết hạn sau 8 giờ ở máy chủ. Máy chủ nhận ra phiên đã ghi nhớ khi làm mới bằng độ dài phiên (dài hơn 8 giờ), không thêm cột.
- Trường demo nhận vào nền tảng bằng adopt-existing, không chép dữ liệu; mã nền tảng `tc-demo` (mã nền tảng cần 3 đến 32 ký tự chữ thường), tên miền `tc.truong.localhost`; đơn vị danh mục giả `DEMO-TC` nguồn `demo-local`. Eric dừng bản một trường ngày 2026-10-28 nên việc nền chạy theo giờ bật mặc định ở bản nhiều trường; chạy lại bản một trường trên cùng cơ sở dữ liệu thì dựng với `--tat-viec-nen`.
- Quản trị vào mọi trường là một tài khoản vận hành nền tảng duy nhất tên `Admin` (không phân biệt hoa thường), mật khẩu ngẫu nhiên từ 12 ký tự theo chính sách tài khoản vận hành, xác thực hai lớp bắt buộc; mật khẩu, khóa chỉ ở `.env.nhieu-truong`, không ở kho. Cổng vận hành chỉ dùng ở bản nhiều trường (5191); cổng 5177 của bản một trường không có nền tảng.
- Ứng dụng giáo viên, phụ huynh chưa có đăng nhập theo đơn vị nên không đổi.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-310, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 16.10.

#### Vấn đề tồn đọng

- Đăng nhập theo đơn vị cho ứng dụng giáo viên, phụ huynh (khi cần) là phần việc riêng.

## 24 Yêu cầu thay đổi

### YCTD-310: Trang đăng nhập theo mẫu, Ghi nhớ phiên dài và bản nhiều trường trên máy – 2026-10-28

- Lý do: Eric yêu cầu trang đăng nhập làm tương tự trang đăng nhập của hệ thống ngành, rồi gửi ảnh mẫu để thiết kế lại; muốn "Ghi nhớ" giữ đăng nhập và cho lưu mật khẩu; giữ trường demo hiện có, nạp danh mục trường toàn quốc vào bản nhiều trường trên máy.
- Nội dung thay đổi: bố cục MH-47 theo ảnh mẫu; thứ tự ô chọn đơn vị Sở → Cấp, Phường / Xã → Trường; lọc cấp học theo sở, phường; Ghi nhớ phiên dài, cookie bền; lệnh dựng và tập lệnh chạy bản nhiều trường trên máy; bỏ qua `.env.*` trong `.gitignore`.
- Thành phần bị ảnh hưởng: `apps/portal` (trang đăng nhập, ô mã xác nhận, ô chọn có tìm kiếm), `packages/ui` (`TextField` thêm `hideLabel`, `inputClassName`), `apps/identity` (đăng nhập nhận `remember`, cookie mã làm mới, điểm cuối cấp học), `apps/platform` (đường liên kết phiên hỗ trợ khi đặt `VITE_SCHOOL_PORTAL_PORT`), `database` (truy vấn cấp học, lệnh `nhieu-truong-cuc-bo`, hàm tạo cơ sở dữ liệu có vai trò riêng dùng chung với chợ gia sư), `scripts/chay-nhieu-truong.mjs`.
- Dữ liệu, API, giao diện, quyền bị ảnh hưởng: `POST /api/v1/auth/login`, `POST /api/v1/auth/directory/login` nhận `remember` (tuỳ chọn); `GET /api/v1/auth/directory/levels` nhận `department`, `commune` (tuỳ chọn); biến môi trường mới `PORTAL_REMEMBER_DAYS`; không đổi cấu trúc dữ liệu, không đổi quyền.
- Ảnh hưởng chức năng cũ: không tích Ghi nhớ thì đóng trình duyệt là phải đăng nhập lại (cookie phiên); chế độ một trường và tên miền của trường giữ luồng đăng nhập cũ.
- Kiểm thử cần thực hiện: `database` CT-310-1 đến CT-310-3; `apps/identity` CT-24-5 (cấp học theo phạm vi), CT-310-5 (Ghi nhớ); e2e 01 (CT-310-6), 59, 160; typecheck, lint, định dạng; `node scripts/gom-thay-doi.mjs --kiem`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Thay đổi giao diện: trang đăng nhập cổng quản trị theo ảnh mẫu (thẻ giữa nền xanh nhạt, THÔNG TIN ĐƠN VỊ, THÔNG TIN TÀI KHOẢN); ở tên miền chung chọn Sở → Cấp, Phường / Xã → Trường, cấp học lọc theo sở, phường (YCTD-310).
- Thay đổi chức năng: Ghi nhớ giữ phiên cổng quản trị `PORTAL_REMEMBER_DAYS` ngày (mặc định 30) bằng cookie bền; không tích thì cookie hết khi đóng trình duyệt.
- Công cụ: lệnh `nhieu-truong-cuc-bo` và `scripts/chay-nhieu-truong.mjs` dựng, chạy bản nhiều trường trên máy song song bản một trường.
- Không đổi cấu trúc dữ liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Trang đăng nhập theo mẫu (Sở → Cấp, Phường / Xã → Trường), Ghi nhớ phiên dài, bản nhiều trường trên máy | YCTD-310 |

## Nối dòng

| 14_DAC_TA_GIAO_DIEN.md | MH-47 | Từ YCTD-310 bố cục theo ảnh mẫu của Eric: thẻ trắng giữa nền xanh nhạt; THÔNG TIN ĐƠN VỊ (Sở Giáo dục và Đào tạo; Cấp và Phường / Xã cùng hàng, phường chỉ lọc; Trường; chỉ đọc ở tên miền của trường); THÔNG TIN TÀI KHOẢN dùng chữ gợi ý, nhãn ẩn cho trình đọc màn hình (ngoại lệ TD-02); Ghi nhớ giữ phiên `PORTAL_REMEMBER_DAYS` ngày, không lưu mật khẩu ở trang |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1501 | P19-06 | CT-310-1: ghi tệp môi trường của bản nhiều trường giữ chú thích, biến khác; thay biến đã có, thêm biến mới | nội dung đúng từng dòng | Kiểm thử tự động `database/src/local-multi-school.test.ts` CT-310-1 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1502 | P19-06 | CT-310-2: cấp học của ô chọn đơn vị lọc theo sở, phường (danh mục mẫu giả); điểm cuối `directory/levels` nhận `department`, `commune`, mã phường sai thì 400 | chỉ cấp có trường đang hoạt động trong phạm vi; không tham số thì đủ năm cấp | Kiểm thử tự động `database/src/local-multi-school.test.ts` CT-310-2, `apps/identity/src/directory/unit-directory.test.ts` CT-24-5 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1503 | P19-06 | CT-310-3: gắn trường demo vào danh mục ở phường chỉ định; phường khác sở, cấp học sai, sở chưa có thì báo lỗi; chạy lại cho trường khác thì chuyển mã | đơn vị tìm thấy theo sở, phường, cấp; mã chỉ gắn một trường | Kiểm thử tự động `database/src/local-multi-school.test.ts` CT-310-3 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1504 | P19-06 | CT-310-4: giao diện chọn Sở → Cấp, Phường / Xã → Trường ở tên miền chung, đăng nhập có Ghi nhớ sang tên miền của trường; mở lại tên miền chung thì đơn vị, tên đăng nhập còn, mật khẩu trống; cookie mã làm mới bền khoảng 30 ngày | đơn vị chưa dùng nền tảng báo rõ; đăng nhập đúng sang trường alpha; ghi nhớ đúng | Kiểm thử giao diện `tests/e2e/160-unit-directory-login.spec.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1505 | P19-06 | CT-310-5: đăng nhập cổng quản trị không có `remember` thì phiên 8 giờ, cookie không có hạn; có `remember` thì phiên 30 ngày, cookie có Max-Age; làm mới giữ nguyên kiểu cookie | đúng hạn phiên, đúng kiểu cookie | Kiểm thử tự động `apps/identity/src/authentication/authentication.test.ts` CT-310-5 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1506 | P19-06 | CT-310-6: giao diện chế độ một trường: không tích Ghi nhớ thì cookie phiên; tích thì cookie bền khoảng 30 ngày; bộ nhớ của trang không chứa mật khẩu | đúng kiểu cookie; không có mật khẩu trong localStorage, sessionStorage | Kiểm thử giao diện `tests/e2e/01-login.spec.ts` | Đạt |
