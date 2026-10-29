# 25. KẾT QUẢ KIỂM THỬ VÀ DANH SÁCH LỖI

- Mô tả: Kết quả lượt rà soát lại quy trình Vibecoding_Flow và kiểm thử toàn bộ trên nhánh chính sau PR 220 đến 236: lệnh đã chạy, số đạt và hỏng, bảng truy xuất YCTD-295 đến YCTD-313, rà bảo mật theo `22_BAO_MAT.md`, lỗi phân loại theo mức độ và đề xuất xử lý (YCTD-321).
- Phiên bản: 1.1
- Ngày cập nhật: 2026-10-29
- Trạng thái: Chờ Eric duyệt cách xử lý
- Người thực hiện: Claude, phiên rà soát do phiên điều phối giao ngày 2026-10-28

Đây là tài liệu "Kết quả kiểm thử và danh sách lỗi" của quy trình. Tài liệu được lập ngày 2026-10-28 với số 35 và đổi sang số 25 ngày 2026-10-29 (YCTD-369, bảng đổi số ở `index.md`). Nội dung mục 1 đến 7 là lượt rà soát ngày 2026-10-28; lượt kiểm thử sau thêm mục mới. Các báo cáo kiểm thử trước ở `43`, `44`, `45`; kết quả theo từng yêu cầu ở `27_MA_TRAN_TRUY_VET.md`.

## 1. Phạm vi

| Hạng mục | Nội dung |
|---|---|
| Ngày | 2026-10-28 |
| Mã nguồn | `origin/main` tại commit `8123bf4d` (Merge PR 231), gồm PR 220 đến 236 |
| Yêu cầu thay đổi được truy xuất | YCTD-295, 296, 300, 305, 306, 307, 309, 310, 311, 312, 313. Các số 297 đến 299, 301 đến 304, 308 không được dùng (308 đã đổi thành 309) |
| Tài liệu | `tai_lieu/` đối chiếu danh sách tệp bắt buộc của quy trình, quy ước tệp mảnh (YCTD-291, YCTD-293), nhật ký `02`, danh sách công việc `03`, lịch sử phiên bản `23`, sổ thay đổi `24` |
| Bảo mật | PR 233 đến 236 (YCTD-310 đến YCTD-313): xác thực, phân quyền, phiên, mật khẩu, argon2id, mã xác nhận, nhật ký, số CCCD, bí mật trong kho |
| Không thuộc phạm vi | Sửa mã, đổi nghiệp vụ. Mọi lỗi chỉ ghi lại và đề xuất |

## 2. Môi trường và cách chạy

| Hạng mục | Nội dung |
|---|---|
| Máy | Máy phát triển Windows 11, Node 24, pnpm 10.12.1, Docker (PostgreSQL 17, Redis 7, SeaweedFS) |
| Cơ sở dữ liệu | Riêng của lượt rà soát: `school_identity_rs321`, `school_system_rs321` (không dùng chung với bản đang chạy). E2e dùng cơ sở dữ liệu e2e của dự án (`school_system_e2e`, `school_platform_e2e`…) theo khoá `.claude/e2e.lock` |
| Redis | `redis://127.0.0.1:6379` (tránh lỗi treo cổng IPv6 trên máy này) |
| Thứ tự | Như việc `kiem-thu` của CI: định dạng, kiểm tệp mảnh, kiểm chỉ mục sinh, lint, build, typecheck, migrate, test; sau đó các bộ e2e như việc `kiem-thu-giao-dien`, `kiem-thu-thiet-bi` (tập con yêu cầu kéo), `kiem-thu-nhieu-truong` (bố cục database) |
| Không chạy trên máy | Bộ thiết bị đầy đủ (bốn dự án, có WebKit) và bố cục schema của bộ nhiều trường: lấy kết quả của CI nhánh chính (mục 3.3) |

## 3. Kết quả

### 3.1 Kiểm tĩnh, build, kiểm thử đơn vị và tích hợp

| Lệnh | Kết quả | Thời gian | Ghi chú |
|---|---|---|---|
| `pnpm format:check` | Hỏng trên máy, đạt trên CI | 297 giây | Chỉ một tệp cục bộ không theo dõi (`.claude/tai-khoan-test-local.md`, bỏ qua bằng `.git/info/exclude`) chưa định dạng; mọi tệp của kho đạt. Không phải lỗi của kho |
| `node scripts/gom-thay-doi.mjs --kiem` | Đạt | 2 giây | 44 tệp mảnh, 0 lỗi (49 tệp sau khi thêm tệp của YCTD-321 và gộp nhánh chính `5bb5e025`, 0 lỗi) |
| `node database/sinh-chi-muc.mjs --kiem && node apps/api/sinh-dang-ky.mjs --kiem` | Đạt | 1 giây | Lần đầu hỏng vì tệp `*.generated.ts` cũ của worktree (bị bỏ qua khỏi git); chạy lại sau build thì đạt |
| `pnpm lint` | Đạt | 123 giây | |
| `pnpm build` | Đạt | 1142 giây | |
| `pnpm typecheck` | Đạt | 1174 giây | |
| `pnpm database:migrate` | Đạt | 28 giây | Trên cơ sở dữ liệu riêng |
| `pnpm test` | Đạt: 1785 ca, 1785 đạt, 0 hỏng, 0 bỏ qua | 3849 giây | Theo gói: máy chủ API 1394, dịch vụ định danh 145, cơ sở dữ liệu 128, `packages/server` 47, `tests` (tách trường, thử nghiệm, tài liệu) 28, ứng dụng giáo viên 18, `packages/pwa` 17, ứng dụng phụ huynh 3, việc nền 3, ứng dụng học sinh 2 |

### 3.2 Kiểm thử giao diện (e2e) trên máy

| Bộ | Lệnh | Kết quả | Ghi chú |
|---|---|---|---|
| Giao diện, lần 1 và 2 | `node e2e-setup.mjs && playwright test` (thư mục `tests`) | Không dùng được | Chạy cùng lúc với `typecheck` và `pnpm test`: lần 1 máy chủ web không lên trong 60 giây; lần 2 từ ca 10 API báo "Không liên lạc được với dịch vụ định danh", 101 ca hỏng. Đã dừng, không tính (L-22) |
| Giao diện, lần 3 (chạy riêng, có khoá) | như trên | 217 ca: 197 đạt, 18 hỏng, 1 bỏ qua, 1 không chạy; 56 phút | Ca gốc hỏng là `09-children.spec.ts:84`: `POST /api/v1/files` (tải giấy tờ) không có phản hồi; các ca 11, 12, 14 đến 18 dùng trẻ và phụ huynh do ca 09 tạo nên hỏng theo. Các ca hỏng khác: 165 (liên kết định danh giả lập), 67, 69, 76, 86, 90. Cùng bộ này đạt trên CI nhánh chính (mục 3.3) |
| Thiết bị, tập con yêu cầu kéo | `E2E_DEVICES=pr playwright test` | 20 ca: 17 đạt, 3 hỏng; 6 phút | `183-tablet-teacher-parent.spec.ts:90` (`may-tinh-bang-doc`) không thấy "Đang dạy: tiết 1": lượt chạy rơi đúng nửa đêm (23:53 đến 00:01) và spec tính thứ trong tuần theo giờ thật lúc chuẩn bị dữ liệu (L-23). `184-tablet-portal-platform.spec.ts:84` (`dien-thoai`, `may-tinh-bang-doc`) không thấy danh sách người dùng: chạy trước khi tách lỗi kho tệp IPv6 (lần 4 của bộ giao diện), chưa chạy lại; cùng bộ đạt trên CI của PR |
| Nhiều trường, bố cục database | `node e2e-multi-setup.mjs && playwright test --config playwright.multi.config.ts` | 33 ca: 30 đạt, 3 hỏng; 9 phút | Spec 132, 136, 137 hỏng cùng chỗ: `signInConsole` đăng nhập cổng vận hành, máy chủ trả "Dữ liệu không hợp lệ", không sang bước mã hai lớp. Nghi ngờ (chưa xác minh): `waitForResponse` ở `tests/e2e/platform-console.ts` bắt phản hồi ảnh mã tải lần đầu thay vì ảnh sau "Làm mới mã", máy chậm thì đáp án lệch (L-24). Cùng bộ đạt trên CI nhánh chính |
| Giao diện, lần 4 (kho tệp qua `127.0.0.1`) | như lần 3, thêm `S3_ENDPOINT=http://127.0.0.1:8333` | 217 ca: 214 đạt, 2 hỏng, 1 bỏ qua; 35 phút | 16 trong 18 ca hỏng ở lần 3 nay đạt: lỗi lần 3 do máy này phân giải `localhost` sang IPv6 khi máy chủ API gọi kho tệp, không phải lỗi mã (L-22). Hai ca còn hỏng: `02-academic-years.spec.ts:22` không thấy "Đã mở năm học 2026–2027" trong thời gian chờ (mở năm học chậm trên máy), `84-level-reports.spec.ts:38` `ERR_CONNECTION_REFUSED` tới máy chủ Vite cổng 5373 giữa lượt chạy. Cả hai đạt trên CI nhánh chính; không ghi thành lỗi mã |

### 3.3 CI của nhánh chính

| Lần chạy | Commit | Kết quả |
|---|---|---|
| 40660610923 | `3055cf03` (PR 232) | Đạt mọi việc |
| 40671653652 | `06edf3fd` (PR 233) | Hỏng `kiem-thu-thiet-bi` 1/2 và 2/2; hỏng `dung-anh-docker` ảnh identity và worker (các lần chạy sau đạt) |
| 40671670314 | `c5bd2720` (PR 234) | Hỏng `kiem-thu-thiet-bi` 1/2 và 2/2 |
| 40680163592 | `0fc030f2` (PR 236) | Hỏng `kiem-thu-thiet-bi` 1/2 và 2/2 |
| 40688015265 | `938835cc` (PR 235) | Hỏng `kiem-thu-thiet-bi` 1/2 và 2/2 |
| 40688025038 | `8123bf4d` (PR 231) | Hỏng `kiem-thu-thiet-bi` 1/2 và 2/2: mỗi mảnh 44 đạt, 4 hỏng; cùng một ca `180-device-frame.spec.ts:70` "Ảnh chụp tham chiếu trang đăng nhập cổng quản trị" ở bốn dự án `dien-thoai`, `dien-thoai-webkit`, `may-tinh-bang-doc`, `may-tinh-bang-ngang` (`toHaveScreenshot` lệch) |

Các việc khác của các lần chạy trên (`kiem-thu`, `kiem-thu-giao-dien`, `kiem-thu-nhieu-truong`, `dung-anh-docker`, `quet-phu-thuoc`) đều đạt. Yêu cầu kéo chỉ chạy tập con thiết bị (nhãn `@thiet-bi-pr`, chỉ Chromium) nên ca ảnh tham chiếu không chặn các PR 233 đến 236 lúc merge.

## 4. Đối chiếu bộ tài liệu với quy trình

| Hạng mục | Hiện trạng | Lỗi |
|---|---|---|
| Tệp bắt buộc `index.md`, `01` đến `24` | Đủ | |
| `25_KET_QUA_KIEM_THU.md`, `26_TRIEN_KHAI.md` | Không có. Số 25, 26 đã dùng cho thư mục quy trình nghiệp vụ và sơ đồ chức năng gốc (nay là `40_QUY_TRINH_NGHIEP_VU/`, `41_SO_DO_CHUC_NANG/`, YCTD-369). Kết quả kiểm thử nằm rải ở `43`, `44`, `45` và tệp mảnh; hướng dẫn triển khai, phương án quay lui ở `deploy/README.md`, `deploy/profiles/production/README.md`, không có biên bản triển khai trong `tai_lieu/` | L-19 |
| Quy ước tệp mảnh | `--kiem` đạt. Lần gom cuối là YCTD-291 ngày 2026-10-26; 44 tệp mảnh (YCTD-213 đến YCTD-313) chờ gom | L-09 |
| `02` | Mục mới nhất ngày 2026-10-26 (YCTD-291). Mục của 44 việc sau đó nằm ở tệp mảnh | L-09 |
| `03` | Phiên bản 0.76, ngày 2026-10-26. Không có dòng nào cho YCTD-292 đến YCTD-313 và các tệp mảnh của chúng không có mục "Nối dòng" cho `03`; lượt này ghi bù qua tệp mảnh YCTD-321. Dòng P13 hỏng định dạng bảng; "Mã N đang dùng đến: N22" trong khi đã có N24 | L-10, L-17 |
| `23` | Mục mới nhất 0.147.0. Phiên bản đề xuất 0.146.0 đến 0.189.0 nằm ở tệp mảnh; số chính thức chốt khi gom. Số 0.186.0 không tệp mảnh nào đề xuất | L-09 |
| `24` | Mục mới nhất YCTD-291. GD-144 (Eric chốt 2026-10-28) và GD-148 (chốt 2026-10-27) đã ghi ở tệp mảnh YCTD-275, YCTD-277, YCTD-280 và `47` mục 20; quy tắc tài khoản theo số CCCD ở tệp mảnh YCTD-311 | L-09 |
| `01` mục quyết định | Dòng "GD-140 đến GD-157" (`01` dòng 711) vẫn ghi giờ mở thảo luận (GD-144) và bản nháp ngoại tuyến (GD-148) là "còn lại", dù đã chốt | L-16 |
| Quyết định "mở mọi trường", "gói miễn phí" | Thuộc YCTD-314 (GD-159 đến GD-161) đang làm ở phiên khác, chưa merge. Không ghi bù | |
| Quyết định "sổ liên lạc" | Không tìm thấy quyết định nào trong kho và ghi chú các phiên. Không ghi bù để không bịa; cần Eric cho nội dung | L-18 |
| `07` | BR-202 xuất hiện hai lần với nội dung khác nhau (dòng 275, 279) | L-17 |

## 5. Bảng truy xuất YCTD-295 đến YCTD-313

Quy ước của `21`: cột "Chức năng" nối kịch bản với mã chức năng ở `10`, không nối thẳng với AC; "AC có CT" xét theo cùng chức năng hoặc cùng nội dung. Dòng CT "chờ gom" nằm ở mục "Thêm dòng" của tệp mảnh.

| YCTD | PR | Tiêu chí nghiệm thu (11) | Kịch bản kiểm thử (21) | Kiểm thử tự động | Kết quả ghi lại | Chỗ hở |
|---|---|---|---|---|---|---|
| 295 Trang chủ theo mẫu Tổng quan | 220 | Không có | Không có | Không thêm | CI 11/11 đạt | MH-01 (`14` dòng 373) vẫn tả bố cục cũ; năm thẻ mới và khối "Việc cần xử lý" không có AC, CT, kiểm thử |
| 296 Áp sáu màn mẫu giao diện | 222 | Không có | Không có | Dùng e2e có sẵn | Tệp mảnh ghi "Chưa chạy kiểm thử giao diện trên máy; chờ CI". CI 11/11 đạt | Chủ yếu đổi trình bày; lối tắt và trạng thái điểm danh ở trang chủ phụ huynh là hành vi mới không có CT |
| 300 Ứng dụng học sinh riêng | 224 | Không có | Không có (có QĐ-45 ở `12`) | `apps/parent/src/student-address.test.ts`, e2e 150, 154, 180, 181, 212, 214, 217 đến 219 | CI 11/11 đạt | Chuyển hướng `#hoc-sinh`, manifest, service worker riêng không có AC, CT |
| 305 README song ngữ | 225 | Không áp dụng | Không áp dụng | Không áp dụng | CI lúc merge: `kiem-thu-giao-dien` hỏng | Merge khi một việc CI còn hỏng |
| 306 Sửa CI nhánh chính | 228 | Không áp dụng phần CI | Dùng CT-1175 (CT-23e-5), CT-16a-10 | Ảnh mẫu spec 180; spec 58, 154 | CI 12/12 đạt | Sửa lỗi tranh chấp ở ô camera không có kiểm thử đơn vị riêng |
| 307 Chọn phân hệ về bảng điều khiển | 231 | AC-392 (`11` dòng 467) tả hành vi cũ | CT-348 (`21` dòng 433) tả hành vi cũ | `01-login.spec.ts:182`, `70-…:170`, `72-…:178` | CI 11/11 đạt | AC-392, CT-348, MH-01 chưa cập nhật theo hành vi mới |
| 309 Hồ sơ cán bộ trang riêng chia thẻ | 232 | Không có | Không có (MH-12 sửa tại chỗ) | e2e 19, 55, 60 | CI 11/11 đạt | Thẻ Hợp đồng ẩn theo BR-46 là hành vi theo quyền không có AC, CT |
| 310 Đăng nhập theo mẫu, Ghi nhớ | 233 | Không có | CT-1501 đến CT-1506 (chờ gom) | `local-multi-school.test.ts`, `authentication.test.ts:90`, `unit-directory.test.ts:134`, `01-login.spec.ts:41`, `160-…:149` | Ô "Thực tế" của CT; CT-1504, CT-1506 ghi "Đạt" không ngày | Không có AC; phiên 30 đến 90 ngày, đổi kiểu cookie chưa có ở `22`, `07`; không có nhãn CT-310-4 trong mã |
| 311 Tài khoản theo số CCCD, argon2id | 235 | Không có | CT-1511 đến CT-1521 (chờ gom) | `national-id-accounts.test.ts`, `student-records-so.test.ts:490`, `221-tai-khoan-cccd.spec.ts`, `platform-operator-admin.test.ts:95` | Ô "Thực tế" của CT; CT-1519, CT-1520 không ngày | Không có AC, BR, BM; `08`, `14`, `16`, `17`, `22` chưa cập nhật (cột, điểm cuối, vai trò nhân viên vận hành, tham số argon2id, che số CCCD) |
| 312 Đăng nhập cổng vận hành theo mẫu | 234 | Không có | Dùng CT-1271 (CT-26e-3, chờ gom) chưa tả đăng nhập hai bước | `platform-console.ts`, e2e 132, 136, 137, 139, 160, 184, 195 đến 198 | CI 11/11 đạt | Không có AC, CT cho đăng nhập hai bước, Ghi nhớ, Quên mật khẩu; không có MH ở `14` |
| 313 Mã xác nhận cổng vận hành | 236 | Không có | Không có | `platform-operators.test.ts:200` (không gắn mã CT), `184-…:144` | CI 11/11 đạt | BR-121 (`07` dòng 194) vẫn ghi mã xác nhận "chỉ áp dụng kênh cổng quản trị"; BM-75 không nhắc; `POST /auth/platform/captcha` không có ở `17` |

Kiểm trùng mã: 462 dòng "Thêm dòng" của 44 tệp mảnh không trùng nhau và không trùng tài liệu; `11` không trùng AC; `21` không trùng CT; `07` trùng BR-202 (L-17). Dòng CT-1269 đến CT-1271 ở tệp mảnh YCTD-235 lệch nghĩa cột (ô "Trạng thái" ghi "Cao"), `--kiem` không bắt được (L-17).

## 6. Danh sách lỗi và đề xuất xử lý

Mã lỗi dạng `L-nn` chỉ dùng trong tài liệu này. "Đã xác minh" là đã đọc mã hoặc chạy thật; "Nghi ngờ" là cần kiểm thêm. Mọi đề xuất chờ Eric duyệt; lượt này không sửa mã.

### 6.1 Nghiêm trọng

Lượt rà soát mã ngày 29/10/2026 thêm các lỗi L-30 trở đi; mỗi lỗi ghi YCTD đã sửa ở cột cuối.

| Mã | Lỗi | Bằng chứng | Hậu quả | Đề xuất xử lý |
|---|---|---|---|---|
| L-30 | Tính học phí chưa giữ nguyên hóa đơn chính đã phát hành của trẻ trong mọi trường hợp, kể cả trẻ đã chuyển đơn vị (đã xác minh) | CT-1720 | Hóa đơn đã phát hành, đã thu bị đổi số tiền, đơn vị, dòng chi tiết; trái BR-25 | Đã sửa ở YCTD-380 |

### 6.2 Cao

| Mã | Lỗi | Bằng chứng | Hậu quả | Đề xuất xử lý |
|---|---|---|---|---|
| L-01 | Mật khẩu mặc định dùng chung cho mọi tài khoản tạo theo số CCCD, chung cả bản triển khai nhiều trường (đã xác minh) | `apps/identity/src/common/configuration.ts:91` đọc một biến `DEFAULT_INITIAL_PASSWORD`; `accounts.service.ts` (`create`) gán cho tài khoản `nationalIdLogin`; hạn 7 ngày, đặt được tới 90 | Người từng nhận mật khẩu mặc định (giáo viên, phụ huynh, người trường khác) biết số CCCD của người khác thì đăng nhập và đổi mật khẩu trước chủ tài khoản. Thử rải một mật khẩu trên nhiều số CCCD qua kênh `teacher` không gặp mã xác nhận, chỉ vướng 10 yêu cầu mỗi phút mỗi địa chỉ. Hạn mật khẩu chỉ kiểm lúc đăng nhập, `changePassword` và `refresh` không kiểm lại | Eric chọn: (a) bỏ mật khẩu chung, phát mật khẩu tạm ngẫu nhiên riêng từng tài khoản (đã có `temporary-password.ts`) hoặc đường kích hoạt một lần; hoặc (b) giữ theo mẫu SMIS nhưng tách theo trường, rút hạn xuống tính bằng giờ, đếm và chặn đăng nhập sai bằng mật khẩu mặc định trên nhiều tài khoản theo địa chỉ, kiểm lại hạn ở `changePassword`, `refresh`. Ghi BM mới ở `22` |
| L-02 | CI nhánh chính hỏng từ PR 233: ảnh tham chiếu trang đăng nhập cổng quản trị (spec 180) chưa cập nhật theo giao diện đăng nhập mới (đã xác minh) | Mục 3.3: năm lần chạy liên tiếp trên `main` hỏng `kiem-thu-thiet-bi`, cùng ca `180-device-frame.spec.ts:70` ở bốn dự án | Nhánh chính đỏ; hằng đêm đỏ; lỗi thiết bị thật mới sẽ bị che. Quy tắc "chỉ merge khi mọi kiểm tra đạt" không bắt được vì PR chỉ chạy tập con thiết bị | Sinh lại bốn ảnh `*-linux.png` của spec 180 từ kết quả CI (như YCTD-306), mở PR có nhãn `thiet-bi-day-du`. Cân nhắc: PR sửa trang đăng nhập hoặc khung giao diện phải gắn nhãn `thiet-bi-day-du` |
| L-03 | YCTD-311 thay đổi lớn về tài khoản và bảo mật nhưng thiếu đặc tả (đã xác minh) | Tệp mảnh chỉ thêm dòng `21`; tìm `initial_password_expires_at`, `platform/operators`, `platform_operators.role`, `PASSWORD_HASH`, `DEFAULT_INITIAL_PASSWORD` ở `tai_lieu/` (ngoài tệp mảnh) không ra kết quả | Trái `11` ("chưa có tiêu chí nghiệm thu thì không coi là hoàn thành") và README tệp mảnh mục 2.3; người sau không biết quy tắc tài khoản, vai trò nhân viên vận hành, tham số băm | Bổ sung AC (`11`), BR (`07`), BM (`22`: argon2id, mật khẩu mặc định, che số CCCD), cột mới (`16`), bốn điểm cuối `/auth/platform/operators` (`17`), vai trò nhân viên vận hành (`08`), màn hình (`14`) trong một PR tài liệu |
| L-04 | YCTD-310, YCTD-313 làm đặc tả bảo mật lệch mã (đã xác minh) | BM-05 vẫn ghi phiên cổng quản trị 8 giờ, mã nay cho "Ghi nhớ" 30 ngày, tối đa 90 (`authentication.service.ts:50`); BR-121 (`07` dòng 194) ghi mã xác nhận "chỉ áp dụng kênh cổng quản trị" trong khi đã áp cho cổng vận hành và kênh học sinh | Đặc tả không còn là căn cứ nghiệm thu; quyết định phiên dài 30 đến 90 ngày cho vai trò phê duyệt chưa được ghi và duyệt ở `22` | Eric quyết mức "Ghi nhớ" chấp nhận được (giữ 30 ngày, hạ xuống 7 ngày, hoặc chỉ cho vai trò không phê duyệt, bắt xác thực lại cho thao tác nhạy cảm). Sau đó cập nhật BM-05, BM-71, BR-121, thêm AC |

### 6.3 Trung bình

| Mã | Lỗi | Bằng chứng | Đề xuất xử lý |
|---|---|---|---|
| L-05 | Số định danh của học sinh làm tên đăng nhập, lưu dạng rõ và ghi nguyên văn vào nhật ký (đã xác minh) | `student_learning_accounts.username`, `users.username`; nhật ký `learning-accounts.ts:353`, `student-accounts.service.ts:153`; thông báo lỗi `student-accounts.service.ts:85` | Che số (`maskLoginIdentifier`) ở hai nhật ký và thông báo lỗi; cân nhắc đổi mặc định `STUDENT_USERNAME_RULE` sang mã học sinh hoặc lưu băm HMAC để tra (BM-64, BM-80) |
| L-06 | Tài khoản nhân viên vận hành: mật khẩu tạm không bị bắt đổi, không có điểm cuối tự đổi mật khẩu; người tạo nhận cùng lúc mật khẩu, khóa TOTP, mã khôi phục (đã xác minh) | `platform-operator-admin.ts:132` (chú thích "bắt đổi" nhưng không đặt `must_change_password`), `:146` | Đặt `must_change_password` khi tạo và kiểm ở đăng nhập; thêm đổi mật khẩu (tối thiểu 12 ký tự, BM-85); cho nhân viên tự đăng ký TOTP lần đầu |
| L-07 | Vượt mã xác nhận của tài khoản cán bộ bằng `channel: "teacher"` (đã xác minh) | `authentication.controller.ts:117`: mã xác nhận chỉ áp cho `portal`, `student`; tài khoản cán bộ được nhận ở kênh `teacher` | Đếm lần sai và đòi mã xác nhận theo tài khoản ở mọi kênh, thêm ô mã ở ứng dụng giáo viên |
| L-08 | Số CCCD của nhân sự lưu dạng rõ ở `users.username` của cơ sở dữ liệu định danh; chi tiết tài khoản trả đủ số; tìm kiếm `like` dò được từng chữ số (phần nhật ký truy cập là nghi ngờ) | `accounts.service.ts` (chi tiết khoảng dòng 306, tìm kiếm dòng 176) | Ghi nhật ký truy cập dữ liệu nhạy cảm khi trả đủ số (BM-19); chỉ cho tìm khớp đủ 12 số; hoặc chấp nhận rủi ro và ghi vào `22` |
| L-09 | Chưa gom tệp mảnh từ 2026-10-26 (44 tệp tại `8123bf4d`, 48 tệp tại `5bb5e025`): `02`, `23`, `24`, `index.md`, `01` mục 3 dừng ở YCTD-291, phiên bản 0.147.0 | `tai_lieu/thay_doi_cho_gom/` | Chạy `node scripts/gom-thay-doi.mjs` trên nhánh `gom-2026-10-28` khi không có PR sắp merge (đã thử trên bản sao: gom được 49 tệp, không lỗi) |
| L-10 | `03` không ghi các việc YCTD-292 đến YCTD-313 (không có "Nối dòng") | `03_DANH_SACH_CONG_VIEC.md` | Đã ghi bù YCTD-295 đến YCTD-313 qua tệp mảnh YCTD-321; nhắc trong bản giao việc: PR nào cũng có dòng "Nối dòng" cho `03` |
| L-11 | YCTD-307, YCTD-295: AC-392, CT-348, MH-01 tả hành vi cũ | `11` dòng 467, `21` dòng 433, `14` dòng 373 | Sửa tại chỗ theo hành vi mới (về `/`, "Tổng quan phân hệ", năm thẻ, khối "Việc cần xử lý") |
| L-12 | YCTD-296, 300, 309, 312, 313 có hành vi mới hoặc hành vi theo quyền mà không có AC, CT | Mục 5 | Thêm AC, CT cho: ẩn thẻ Hợp đồng theo BR-46 (309), chuyển hướng `#hoc-sinh` (300), đăng nhập hai bước cổng vận hành (312), mã xác nhận cổng vận hành (313, gắn mã CT vào `platform-operators.test.ts:200`) |
| L-13 | Không YCTD nào trong lượt ghi kết quả kiểm thử theo mẫu (ngày, lệnh, số đạt, hỏng); bằng chứng chỉ còn ở GitHub Checks | Mục 5 | Mẫu tệp mảnh thêm dòng "Kết quả kiểm thử" bắt buộc ở mục `02`; kết quả các lượt rà soát ghi ở tài liệu này |

### 6.4 Thấp

| Mã | Lỗi | Đề xuất xử lý |
|---|---|---|
| L-14 | Đổi mật khẩu và đăng nhập thành công của tài khoản trường không ghi nhật ký bảo mật (`authentication.service.ts:453`); khó điều tra chiếm tài khoản ở L-01 | Ghi `password_changed` (địa chỉ, phiên, cờ "từ mật khẩu mặc định") và `login_succeeded` |
| L-15 | Đăng nhập cổng vận hành không có giới hạn tần suất theo địa chỉ (`platform-operators.ts:291`); "lượt đã qua" cấp cả khi chưa giải ảnh; khóa, đổi vai trò nhân viên không bắt mã hai lớp. Số CCCD lộ ở query string tìm kiếm, localStorage khi "Ghi nhớ", nhãn otpauth, nhật ký `operator.create` không che, stdout lệnh dòng lệnh, khóa Redis. Thông báo "tài khoản tạm khóa" khác sai mật khẩu nên lộ tài khoản tồn tại | Thêm `LoginRateLimiter`; chỉ cấp lượt khi vừa giải đúng ảnh; che số CCCD ở các chỗ trên; báo lỗi chung |
| L-16 | `01` dòng "GD-140 đến GD-157" ghi GD-144, GD-148 là còn lại dù đã chốt | Sửa dòng ở lần gom hoặc PR tài liệu kế tiếp |
| L-17 | Tài liệu sai nhỏ: BR-202 trùng ở `07` (dòng 275, 279); dòng P13 của `03` có chữ nằm ngoài bảng; "Mã N đang dùng đến: N22" trong khi đã có N24; CT-1269 đến CT-1271 (tệp mảnh YCTD-235) lệch cột; nhãn CT trong mã không thống nhất (CT-310-1 đến 6 so với CT-1501 đến 1506; không có nhãn CT-310-4) | Sửa trong PR tài liệu kế tiếp; cân nhắc cho `--kiem` kiểm cột "Trạng thái" của dòng `21` |
| L-18 | Quyết định "sổ liên lạc" của Eric không có trong kho | Eric cho nội dung để ghi YCTD |
| L-19 | Bộ tài liệu lệch danh sách của quy trình: số 25, 26 không phải "Kết quả kiểm thử", "Triển khai"; biên bản triển khai không nằm trong `tai_lieu/` | Đã xử lý ở YCTD-369 (2026-10-29): Eric chọn đánh lại số theo danh mục chuẩn: `25_KET_QUA_KIEM_THU.md` (tài liệu này), `26_TRIEN_KHAI.md`, `27_MA_TRAN_TRUY_VET.md`; tài liệu riêng của dự án dời sang `40` đến `49` (bảng đổi số ở `index.md`) |
| L-20 | Quét bí mật trong CI (`tests/tenancy/secret-scan.test.mjs`) bỏ sót khóa PEM dạng base64 (dạng của `IDENTITY_TOKEN_PRIVATE_KEY`), JWT, chuỗi kết nối có mật khẩu, khóa cổng thanh toán Việt Nam, số CCCD, tệp `.xlsx`, lịch sử git. Quét tay lượt này không thấy bí mật thật: tệp env theo dõi chỉ là tệp mẫu, CSV chỉ là dữ liệu "Mẫu", số CCCD trong kiểm thử là số mẫu | Bổ sung mẫu; chạy thêm gitleaks hoặc trufflehog trên lịch sử |
| L-21 | PR 225 (YCTD-305) merge khi `kiem-thu-giao-dien` còn hỏng (run 40615239236) | Nhắc lại quy tắc merge; kiểm `gh pr checks` trước khi merge |
| L-22 | Môi trường kiểm thử trên máy Windows: (1) `pnpm test` và e2e không chạy song song được, API báo "Không liên lạc được với dịch vụ định danh" khi bộ kiểm thử máy chủ chạy cùng Redis và máy; (2) `localhost` phân giải sang IPv6 làm treo kết nối tới kho tệp (`S3_ENDPOINT`) và Redis, gây 16 ca e2e hỏng giả (mục 3.2) | Ghi vào hướng dẫn kiểm thử ở `20`: trên máy chạy e2e sau khi `pnpm test` xong; dùng `127.0.0.1` cho `REDIS_URL`, `S3_ENDPOINT` ở `.env` và `.env.example` (không đổi mã) |
| L-23 | Spec 183 (CT-26d-2) tính thứ trong tuần bằng `new Date()` lúc chuẩn bị dữ liệu, trang lại tính lúc hiển thị; chạy qua nửa đêm giờ Việt Nam thì hỏng (`183-tablet-teacher-parent.spec.ts:55`) | Cố định giờ bằng `page.clock` hoặc tính thứ một lần rồi truyền cho trang |
| L-24 | Nghi ngờ đua trong `signInConsole` (YCTD-313): chờ phản hồi `POST /auth/platform/captcha` bất kỳ, có thể là ảnh tải lần đầu chứ không phải ảnh sau "Làm mới mã"; trên máy ba spec nhiều trường hỏng ở bước này | Chờ phản hồi sau khi ảnh đầu đã tải xong, hoặc đọc `captcha_id` đang hiện trên trang; chạy lại spec 132 nhiều lần để xác minh |

### 6.5 Điểm đã kiểm và đạt

- argon2id m = 64 MiB, t = 3, p = 4, cao hơn mức OWASP; biến môi trường không hạ được dưới mức tối thiểu; băm lại khi đăng nhập.
- Tài khoản không tồn tại vẫn chạy băm giả, chống dò theo thời gian; sai kênh báo như sai mật khẩu.
- Bắt đổi mật khẩu thực thi ở cả dịch vụ định danh và máy chủ API; mật khẩu mặc định không suy ra từ số CCCD, khởi động kiểm độ mạnh.
- Mã xác nhận sinh ở máy chủ, dùng một lần, hết hạn 5 phút; luồng đăng nhập theo đơn vị luôn bắt mã xác nhận.
- Cookie phiên `__Secure-`, `HttpOnly`, `Secure`, `SameSite=Strict`; mã làm mới quay vòng, dùng lại thì thu hồi phiên; đổi mật khẩu thu hồi phiên khác.
- Điểm cuối quản lý nhân viên vận hành kiểm vai trò `quan_tri` từ cơ sở dữ liệu ở mỗi yêu cầu; tạo tài khoản và cấp lại TOTP bắt mã hai lớp; không thấy controller mới thiếu guard.
- Mã chuyển phiên giữa tên miền 32 byte, chỉ lưu băm, dùng một lần.
- Kho không có tệp `.env` thật, khóa riêng, `.xlsx`, `.sql`; CSV danh mục trường thật không nằm trong kho.

## 7. Kết luận

- Kiểm tĩnh, build, typecheck, migrate và 1785 ca kiểm thử máy chủ đạt trên cơ sở dữ liệu riêng.
- E2e trên máy: giao diện 214/217 đạt (hai ca hỏng do máy chậm), thiết bị tập con 17/20, nhiều trường 30/33; các ca hỏng đều đạt trên CI, không có lỗi mã mới từ e2e ngoài hai lỗi kiểm thử (L-23, L-24 nghi ngờ). Bộ thiết bị đầy đủ hỏng trên CI nhánh chính (L-02).
- Tổng: 24 lỗi, gồm 4 Cao, 9 Trung bình, 11 Thấp; không có lỗi Nghiêm trọng.
- Cổng kiểm thử theo quy trình chưa đạt: còn bốn lỗi mức Cao chưa xử lý (L-01 đến L-04), trong đó L-02 làm nhánh chính đỏ từ PR 233.
- Thứ tự đề xuất: L-02 (sửa ảnh tham chiếu, nhỏ, gỡ nhánh chính đỏ); L-01 và L-04 (cần Eric quyết về mật khẩu mặc định và thời hạn "Ghi nhớ"); L-03 cùng L-11, L-12 trong một PR tài liệu đặc tả; L-09 gom tệp mảnh; các lỗi bảo mật Trung bình L-05 đến L-08 trong một PR mã; lỗi Thấp gom dần.
