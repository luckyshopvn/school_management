# Vỏ ứng dụng cài đặt: hướng dẫn chạy bản demo

DT-26 phần 26f, YCTD-236. Bản demo chạy trên máy giả lập Android (AVD) và iOS Simulator. Chưa ký bản phát hành, chưa có hồ sơ cửa hàng (26h), chưa có thông báo đẩy gốc FCM, APNs (26g).

## Bản demo làm gì

- Mở trang khởi động (`www/index.html`): thêm trường bằng địa chỉ (ví dụ `https://truong-thu.example.vn`) hoặc bấm "Máy chủ phát triển trên máy này"; danh sách trường lưu trên máy.
- Chọn vai trò **Giáo viên** hoặc **Phụ huynh** để mở ứng dụng web tương ứng của trường trong WebView: trường chạy thật ở `/giao-vien/`, `/phu-huynh/`; máy chủ phát triển ở `http://localhost:5174/` (giáo viên), `http://localhost:5175/` (phụ huynh).
- Đăng nhập, dùng như PWA. Muốn đổi trường hoặc vai trò thì đóng hẳn ứng dụng rồi mở lại.

Chưa có trong bản demo: đóng gói sẵn mã của hai ứng dụng web trong ứng dụng, chọn trường từ danh mục DT-24, mã làm mới trong Keychain, Keystore, mở khóa sinh trắc học, liên kết sâu, thông báo đẩy. Web Push không chạy trong WebView của ứng dụng cài đặt; muốn thử thông báo đẩy thì dùng PWA trên trình duyệt (26b).

## Chuẩn bị máy chủ phát triển

Ở thư mục gốc của kho (đã `pnpm install`, `pnpm build`, cơ sở dữ liệu đã chạy theo README):

```bash
pnpm --filter @school-management/identity start
pnpm --filter @school-management/api start
pnpm --filter @school-management/teacher dev
pnpm --filter @school-management/parent dev
```

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
