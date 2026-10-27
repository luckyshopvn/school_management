# Vỏ ứng dụng cài đặt: hướng dẫn chạy bản demo

DT-26 phần 26f, YCTD-236. Bản demo chạy trên máy giả lập Android (AVD) và iOS Simulator. Chưa ký bản phát hành, chưa có hồ sơ cửa hàng (26h). Thông báo đẩy gốc FCM, APNs (26g, YCTD-237) có phần mã, chưa gửi thật: xem mục "Thông báo đẩy gốc" ở cuối.

## Bản demo làm gì

- Mở trang khởi động (`www/index.html`): thêm trường bằng địa chỉ (ví dụ `https://truong-thu.example.vn`) hoặc bấm "Máy chủ phát triển trên máy này"; danh sách trường lưu trên máy.
- Chọn vai trò **Giáo viên** hoặc **Phụ huynh** để mở ứng dụng web tương ứng của trường trong WebView: trường chạy thật ở `/giao-vien/`, `/phu-huynh/`; máy chủ phát triển ở `http://localhost:5174/` (giáo viên), `http://localhost:5175/` (phụ huynh).
- Đăng nhập, dùng như PWA. Muốn đổi trường hoặc vai trò thì đóng hẳn ứng dụng rồi mở lại.

Chưa có trong bản demo: đóng gói sẵn mã của hai ứng dụng web trong ứng dụng, chọn trường từ danh mục DT-24, mã làm mới trong Keychain, Keystore, mở khóa sinh trắc học, liên kết sâu. Web Push không chạy trong WebView của ứng dụng cài đặt; ứng dụng dùng đẩy gốc (26g).

## Chuẩn bị máy chủ phát triển

Ở thư mục gốc của kho (đã `pnpm install`, `pnpm build`, cơ sở dữ liệu đã chạy theo README):

```bash
pnpm --filter @school-management/identity start
pnpm --filter @school-management/api start
pnpm --filter @school-management/teacher exec vite --host 127.0.0.1
pnpm --filter @school-management/parent exec vite --host 127.0.0.1
```

`adb reverse` nối tới `127.0.0.1` của máy thật; trên Windows `vite` mặc định chỉ nghe `[::1]` nên WebView báo `ERR_EMPTY_RESPONSE`. Nếu máy chủ phát triển đang chạy không có `--host 127.0.0.1`, chạy kèm ở cửa sổ khác:

```bash
pnpm --filter @school-management/mobile may-chu:ipv4
```

Muốn đăng nhập thử mà không đụng dữ liệu phát triển: tạo cặp cơ sở dữ liệu trống riêng (định danh, hệ thống), migrate, chạy `node dist/demo/demo-command.js reset --confirm` trong `apps/api` với `IDENTITY_DATABASE_URL`, `SYSTEM_DATABASE_URL` trỏ tới cặp đó (lệnh từ chối chạy trên cơ sở dữ liệu đã có dữ liệu thật), rồi chạy dịch vụ định danh, máy chủ API cùng biến môi trường. Tài khoản trình diễn: giáo viên `demo.giaovien1`, phụ huynh `0900000001`, mật khẩu chung hiện ở trang đăng nhập. Nếu cổng 5174, 5175 của máy thật đã bận, chạy `vite` ở cổng khác rồi chuyển cổng của máy giả lập tới đó, ví dụ `adb reverse tcp:5175 tcp:5385`.

## Android (Windows, macOS, Linux)

Cần cài (khoảng 3 GB tải về, 8 đến 12 GB trên đĩa):

| Thành phần                                                                                            | Ghi chú                                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| JDK 21 (ví dụ Eclipse Temurin 21)                                                                     | Đặt `JAVA_HOME`                             |
| Android SDK command-line tools                                                                        | Đặt `ANDROID_HOME` (ví dụ `D:\Android\Sdk`) |
| `sdkmanager "platform-tools" "build-tools;36.0.0" "platforms;android-36"`                             | Dựng bản debug                              |
| `sdkmanager "emulator" "system-images;android-36;google_apis;x86_64"`                                 | Máy giả lập                                 |
| Windows: bật "Windows Hypervisor Platform" trong Windows Features (cần quyền quản trị, khởi động lại) | Tăng tốc máy giả lập                        |

Hoặc cài Android Studio (có sẵn JDK, SDK Manager, Device Manager).

Tạo máy giả lập và chạy:

```bash
avdmanager create avd -n Pixel_Demo -k "system-images;android-36;google_apis;x86_64" -d pixel_7
emulator -avd Pixel_Demo
pnpm --filter @school-management/mobile android:run
```

`android:run` dựng `android/app/build/outputs/apk/debug/app-debug.apk`, chuyển cổng 5174, 5175 của máy giả lập về máy thật (`adb reverse`), cài và mở ứng dụng. Chỉ dựng tệp APK: `pnpm --filter @school-management/mobile android:debug`. Thiếu công cụ thì script in danh sách cần cài và dừng (mã thoát 2).

Bản debug ký bằng khóa debug do Android SDK tự sinh trên máy (`~/.android/debug.keystore`); kho không chứa khóa, keystore, `google-services.json`.

Gỡ lỗi WebView: mở `chrome://inspect` trên Chrome của máy thật khi máy giả lập đang chạy ứng dụng.

## iOS Simulator (chỉ trên máy Mac)

Cần Xcode (bản ổn định hiện hành; tải khoảng 7 GB, chiếm 15 đến 40 GB) và một iOS Simulator. Không cần tài khoản nhà phát triển để chạy trên Simulator.

```bash
pnpm install
cd apps/mobile
npx cap sync ios
npx cap open ios
```

Trong Xcode chọn một iPhone Simulator rồi bấm Run. Simulator dùng chung mạng của máy Mac nên `http://localhost:5174/`, `http://localhost:5175/` trỏ thẳng tới máy chủ phát triển (`Info.plist` cho phép http tới mạng cục bộ bằng `NSAllowsLocalNetworking`). Dự án iOS dùng Swift Package Manager, không cần CocoaPods.

## Máy chủ khác máy phát triển

Trường chạy thật dùng https. Muốn mở trường ở tên miền khác `localhost`, `10.0.2.2`, `*.localhost` thì khai thêm khi đồng bộ:

```bash
CAP_CHO_PHEP_MAY_CHU=truong-thu.example.vn npx cap sync
```

(PowerShell: `$env:CAP_CHO_PHEP_MAY_CHU='truong-thu.example.vn'; npx cap sync`.) Địa chỉ ngoài danh sách được mở bằng trình duyệt của máy thay vì trong ứng dụng.

## Thông báo đẩy gốc (26g)

Trong ứng dụng, khối **Cài đặt thông báo** của ứng dụng giáo viên, phụ huynh dùng đẩy gốc: Android qua FCM, iOS qua APNs. Bấm "Bật thông báo trên máy này" thì máy hỏi quyền, ứng dụng lấy mã thiết bị và gửi về trường. Chạm thông báo thì ứng dụng mở đúng ứng dụng của trường đã lưu trên máy.

- Máy chủ phát triển thử bằng bộ giả lập: chạy máy chủ API với `PUSH_NATIVE_PROVIDER=development` (thêm `PUSH_DEVELOPMENT_OUTBOX=<tệp>` để ghi từng lần gửi ra tệp).
- Bản dựng chưa có `android/app/google-services.json` thì Firebase chưa khởi tạo: khối Cài đặt thông báo báo "Hệ thống chưa bật thông báo đẩy" và không lấy mã thiết bị.
- Gửi thật cần Eric làm (không đưa tệp khóa vào kho):
  1. Tạo dự án Firebase, thêm ứng dụng Android mã `vn.schoolmanagement.demo`, tải `google-services.json` đặt vào `apps/mobile/android/app/`, dựng lại APK.
  2. Ở Cài đặt dự án Firebase → Tài khoản dịch vụ → Tạo khóa riêng mới, rồi nạp vào nền tảng: `pnpm --filter @school-management/database platform set-native-push-key --provider fcm --file <tệp .json>` (bản một trường: đặt `FCM_SERVICE_ACCOUNT_FILE`).
  3. iOS: ở Apple Developer tạo khóa APNs `.p8`, nạp bằng `platform set-native-push-key --provider apns --file <tệp .p8> --key-id <mã khóa> --team-id <mã đội> --bundle-id vn.schoolmanagement.demo --environment sandbox`; trong Xcode bật năng lực Push Notifications. Simulator nhận đẩy giả lập bằng `xcrun simctl push`, mã thiết bị thật chỉ có trên máy thật.
  4. Đặt `PUSH_NATIVE_PROVIDER=native` cho máy chủ API.
