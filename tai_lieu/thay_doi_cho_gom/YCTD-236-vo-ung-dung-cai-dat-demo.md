---
yctd: YCTD-236
tieu_de: DT-26 phần 26f: vỏ ứng dụng cài đặt Capacitor, bản demo trên máy giả lập
ngay: 2026-10-27
phien_ban_de_xuat: 0.165.0
---

## 02 Nhật ký

### 2026-10-27 — DT-26 phần 26f: vỏ ứng dụng cài đặt Capacitor, bản demo trên máy giả lập

#### Công việc đã thực hiện

- `apps/mobile` (mới): vỏ Capacitor 8.5.3 một ứng dụng cho giáo viên và phụ huynh; trang khởi động (`www/index.html`) thêm trường bằng địa chỉ hoặc máy chủ phát triển, chọn vai trò, mở ứng dụng web của trường (`/giao-vien/`, `/phu-huynh/`; máy chủ phát triển cổng 5174, 5175) trong WebView; danh sách trường lưu trên máy.
- Dự án Android (`android/`, compileSdk 36, minSdk 24) và iOS (`ios/`, Swift Package Manager) do Capacitor sinh; Android chỉ cho phép http tới `localhost`, `10.0.2.2` (cấu hình bảo mật mạng), iOS cho phép mạng cục bộ (`NSAllowsLocalNetworking`); máy chủ được mở trong ứng dụng khai ở `capacitor.config.ts`, thêm bằng biến `CAP_CHO_PHEP_MAY_CHU`.
- Script `scripts/dung-android-debug.mjs` (`pnpm --filter @school-management/mobile android:debug`, `android:run`): kiểm JDK, Android SDK (thiếu thì in danh sách cần cài và dừng), `cap sync`, dựng APK debug bằng Gradle, chuyển cổng bằng `adb reverse`, cài và mở trên máy giả lập.
- Hướng dẫn chạy demo `apps/mobile/HUONG_DAN_DEMO.md` (Android AVD, iOS Simulator trên Mac). e2e spec 185: trang khởi động ở khổ máy tính và bốn khổ thiết bị.

#### Quyết định

- Đợt 3 của DT-26 làm theo phạm vi demo trên máy giả lập (Eric, 2026-10-27: "chỉ cần thử chạy trên máy giả lập"); 26g (đẩy FCM, APNs) và 26h (ký, dựng bản trên CI, phát hành, hồ sơ cửa hàng) hoãn đến khi có tài khoản nhà phát triển Apple, Google (GD-158).
- Bản demo tải ứng dụng web của trường trong WebView thay vì đóng gói bản dựng tĩnh: đóng gói cần lớp HTTP gốc, mã làm mới lưu ở Keychain, Keystore, phiên `client_kind = native` của dịch vụ định danh (phần còn lại của 26f) (QĐ-40).
- Máy giả lập Android gọi máy chủ phát triển qua `localhost` nhờ `adb reverse` (ngữ cảnh an toàn nên service worker, PWA chạy được) thay cho `10.0.2.2`.
- Thông báo đẩy chưa hỗ trợ trong ứng dụng cài đặt: Web Push không chạy trong WebView; dùng PWA trên trình duyệt (26b).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-236, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}; BR-366, P19-11, AC-1027, AC-1028, CT-1320, MH-484, QĐ-40, GD-158.

#### Vấn đề tồn đọng

- Chưa dựng, chưa chạy thử trên máy giả lập: máy phát triển chưa có JDK, Android SDK, máy giả lập (cần khoảng 3 GB tải về, 8 đến 12 GB trên đĩa; Eric tự bật Windows Hypervisor Platform); iOS cần máy Mac có Xcode. Phần còn lại của 26f (đóng gói, đăng nhập gốc, sinh trắc học, liên kết sâu, chọn trường từ danh mục DT-24), 26g, 26h làm khi có tài khoản.

## 24 Yêu cầu thay đổi

### YCTD-236: DT-26 phần 26f: vỏ ứng dụng cài đặt Capacitor, bản demo trên máy giả lập – 2026-10-27

- Lý do: phần 26f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 18 (đợt 3 của DT-26); Eric quyết định ngày 2026-10-27 chỉ làm bản demo chạy trên máy giả lập; phiên điều phối giao cho phiên chủ DT-26.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt):
  - **Vỏ ứng dụng** `apps/mobile`: Capacitor 8.5.3 (`@capacitor/core`, `cli`, `android`, `ios`), mã ứng dụng demo `vn.schoolmanagement.demo`, tên "School Management"; trang khởi động chọn trường, vai trò; WebView mở ứng dụng web giáo viên, phụ huynh của trường.
  - **Mạng**: http chỉ tới máy chủ phát triển (`localhost`, `10.0.2.2` ở Android; mạng cục bộ ở iOS); máy chủ mở trong ứng dụng theo danh sách `allowNavigation`, địa chỉ khác mở bằng trình duyệt của máy.
  - **Dựng, chạy**: script dựng APK debug và chạy trên máy giả lập; bản debug ký bằng khóa debug tự sinh của Android SDK trên máy; kho không chứa khóa, keystore, `google-services.json`.
  - **Không làm ở bản demo**: đóng gói bản dựng tĩnh, chọn trường từ danh mục DT-24, đăng nhập kiểu ứng dụng gốc (mã làm mới ở Keychain, Keystore, sinh trắc học), nhà cung cấp định danh qua trình duyệt hệ thống, liên kết sâu, chặn phiên bản cũ, thông báo đẩy; không sửa dịch vụ định danh.
- Thành phần bị ảnh hưởng: `apps/mobile` (mới), `tests` (spec 185), `pnpm-lock.yaml`, `.prettierignore`, `eslint.config.js` (bỏ qua dự án Android, iOS do Capacitor sinh), ba Dockerfile chép thêm `apps/mobile/package.json` để `pnpm install --frozen-lockfile` khớp lockfile. Không sửa ứng dụng web, máy chủ, cơ sở dữ liệu.
- Dữ liệu bị ảnh hưởng: không.
- API bị ảnh hưởng: không.
- Giao diện bị ảnh hưởng: MH-484 (trang khởi động của ứng dụng cài đặt).
- Quyền bị ảnh hưởng: không.
- Ảnh hưởng chức năng cũ: không.
- Kiểm thử cần thực hiện: e2e spec 185 (CT-1320); typecheck, lint; dựng APK debug và chạy trên máy giả lập khi máy có Android SDK; iOS Simulator trên máy Mac.
- Trạng thái: Đã triển khai (bản demo; chưa dựng, chạy trên máy giả lập)

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-27

- Phạm vi thay đổi: DT-26 phần 26f bản demo, vỏ ứng dụng cài đặt Capacitor cho giáo viên và phụ huynh (YCTD-236).
- Chức năng mới: ứng dụng cài đặt bản demo (P19-11, MH-484): trang khởi động chọn trường, vai trò; mở ứng dụng web của trường trong ứng dụng; script dựng bản debug Android, hướng dẫn chạy iOS Simulator.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Kiểm thử: CT-1320. Kết quả: e2e spec 185 ở khổ máy tính 1/1 và bốn dự án thiết bị (`dien-thoai`, `may-tinh-bang-doc`, `may-tinh-bang-ngang`, `dien-thoai-webkit`) 4/4 đạt; typecheck `apps/mobile`, `tests`, lint, prettier đạt; `cap add android`, `cap add ios` sinh dự án được trên Windows; script dựng Android báo đúng các công cụ còn thiếu (mã thoát 2). Chưa dựng APK, chưa chạy trên máy giả lập Android, chưa chạy iOS Simulator (máy chưa có Android SDK, không có máy Mac).
- Rủi ro: chưa chạy thật trên máy giả lập; ứng dụng chỉ tải trang web của trường nên mất mạng thì chỉ còn những gì service worker đã lưu.
- Khả năng tương thích: không đổi ứng dụng web, API, dữ liệu.
- Phương án quay lui: hoàn lại commit gộp của nhánh; không có thay đổi dữ liệu.

## 01 Bảng phiên bản

| {PHIEN_BAN} | DT-26 phần 26f bản demo: vỏ ứng dụng cài đặt Capacitor cho giáo viên, phụ huynh, chạy trên máy giả lập | YCTD-236 |

## index Số đếm

| 10 | mã chức năng | +1 |
| 10 | còn hiệu lực | +1 |
| 14 | màn hình | +1 |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | cuối bảng 12.1 Quy tắc về phân cấp phê duyệt | BR-366 | Ứng dụng cài đặt bản demo (YCTD-236, DT-26 phần 26f): một ứng dụng cho giáo viên và phụ huynh; mở lần đầu thì thêm trường bằng địa chỉ (trường chạy thật dùng https) hoặc máy chủ phát triển, chọn vai trò để mở ứng dụng web của trường (`/giao-vien/`, `/phu-huynh/`) trong ứng dụng; danh sách trường lưu trên máy, xóa được; chỉ mở trong ứng dụng các máy chủ đã khai ở cấu hình, địa chỉ khác mở bằng trình duyệt của máy; http chỉ được phép tới máy chủ phát triển; bản demo chưa có thông báo đẩy, đăng nhập kiểu ứng dụng gốc, liên kết sâu, chưa ký bản phát hành |
| 10_YEU_CAU_CHUC_NANG.md | cuối bảng 20. Phân hệ P19 — Kênh truy cập và thông báo | P19-11 | Ứng dụng cài đặt bản demo (YCTD-236, DT-26 phần 26f) | Giáo viên, phụ huynh | Địa chỉ trường, vai trò | Trang khởi động chọn trường, vai trò; mở ứng dụng web giáo viên hoặc phụ huynh của trường trong ứng dụng | Chạy được trên máy giả lập Android, iOS Simulator | BR-366 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-1027 | Cho trang khởi động của ứng dụng cài đặt / Khi nhập địa chỉ sai, địa chỉ không phải http, https, rồi thêm `https://truong-thu.example.vn/bat-ky` và máy chủ phát triển, tải lại, chọn Phụ huynh, Giáo viên, Xóa trường / Thì báo "Địa chỉ trường chưa đúng", "Địa chỉ phải bắt đầu bằng https://"; danh sách có hai trường sau khi tải lại; Phụ huynh mở `https://truong-thu.example.vn/phu-huynh/`, Giáo viên mở `/giao-vien/`, máy chủ phát triển mở `http://localhost:5174/`; xóa còn một trường; trang đạt bộ kiểm theo khổ thiết bị của 26c | P19-11 |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-892 | AC-1028 | Cho máy có JDK 21, Android SDK, máy giả lập đang chạy và máy chủ phát triển / Khi chạy `pnpm --filter @school-management/mobile android:run` / Thì dựng `app-debug.apk`, cài, mở ứng dụng trên máy giả lập, chọn Máy chủ phát triển, Giáo viên thì mở được trang đăng nhập ứng dụng giáo viên; máy thiếu công cụ thì script in danh sách cần cài và thoát mã 2 | P19-11 |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-484 | Ứng dụng cài đặt: trang khởi động (YCTD-236, bản demo): tiêu đề "School Management", dòng giới thiệu; khối "Trường đã thêm" (mỗi trường: tên, nút Giáo viên, Phụ huynh, Xóa trường; chưa có thì dòng "Chưa có trường nào."); khối "Thêm trường" (ô Địa chỉ trường, nút Thêm trường, nút Máy chủ phát triển trên máy này, dòng báo lỗi); vùng chạm 44 px, chữ ô nhập 16 px, chừa vùng tai thỏ, thanh điều hướng của máy | P19-11 |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung theo tám ảnh sơ đồ chức năng | CT-1320 | P19-11 | CT-26f-1: trang khởi động của ứng dụng cài đặt ở khổ máy tính và bốn khổ thiết bị: báo lỗi địa chỉ, thêm trường và máy chủ phát triển, giữ sau khi tải lại, mở đúng đường dẫn theo vai trò, xóa trường, bộ kiểm của 26c | Đúng | Đạt; e2e spec 185 (`tests/e2e/185-mobile-shell-launcher.spec.ts`); AC-1027. AC-1028 (dựng, chạy trên máy giả lập) chưa thực hiện được: máy chưa có Android SDK | Cao |
