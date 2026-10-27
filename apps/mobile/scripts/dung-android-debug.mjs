// Dựng bản debug Android của vỏ ứng dụng cài đặt và (tùy chọn --chay) cài, mở trên máy giả lập (DT-26 phần 26f, YCTD-236, bản demo).
// Cần JDK 21 và Android SDK (platform-tools, build-tools, platforms;android-36); thiếu thì in danh sách cần cài rồi dừng, không tự tải.
// Bản debug ký bằng khóa debug tự sinh của Android SDK trên máy (~/.android/debug.keystore), không có khóa nào trong kho.
//   node scripts/dung-android-debug.mjs           dựng app-debug.apk
//   node scripts/dung-android-debug.mjs --chay    dựng, chuyển cổng 5174, 5175 (adb reverse), cài và mở trên máy giả lập đang chạy
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ANDROID = join(ROOT, 'android');
const APP_ID = 'vn.schoolmanagement.demo';
const WINDOWS = process.platform === 'win32';
// Cổng máy chủ phát triển của ứng dụng giáo viên, phụ huynh (vite.config.ts của từng ứng dụng)
const DEV_PORTS = [5174, 5175];
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: WINDOWS, ...options });
  if (result.status !== 0) {
    throw new Error(`Lệnh lỗi: ${command} ${args.join(' ')}`);
  }
};

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    WINDOWS ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(homedir(), 'Android', 'Sdk'),
    join(homedir(), 'Library', 'Android', 'sdk'),
  ];
  return candidates.find((path) => path && existsSync(join(path, 'platform-tools')));
}

function hasJava() {
  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin'))) {
    return true;
  }
  return spawnSync('java', ['-version'], { stdio: 'ignore', shell: WINDOWS }).status === 0;
}

const sdk = findSdk();
const missing = [
  ...(hasJava() ? [] : ['JDK 21 (ví dụ Eclipse Temurin 21; tải khoảng 190 MB), đặt JAVA_HOME']),
  ...(sdk
    ? []
    : [
        'Android SDK command-line tools (khoảng 150 MB), đặt ANDROID_HOME',
        'sdkmanager "platform-tools" "build-tools;36.0.0" "platforms;android-36" (khoảng 150 MB)',
        'Để chạy máy giả lập: sdkmanager "emulator" "system-images;android-36;google_apis;x86_64" (khoảng 1,8 GB), tạo AVD bằng avdmanager, bật Windows Hypervisor Platform',
      ]),
];
if (missing.length > 0) {
  console.error('Chưa đủ công cụ để dựng bản Android. Cần cài:');
  for (const item of missing) {
    console.error(`  - ${item}`);
  }
  console.error('Xem apps/mobile/HUONG_DAN_DEMO.md.');
  process.exit(2);
}

const environment = { ...process.env, ANDROID_HOME: sdk };
if (!existsSync(ANDROID)) {
  run('npx', ['cap', 'add', 'android'], { cwd: ROOT, env: environment });
}
run('npx', ['cap', 'sync', 'android'], { cwd: ROOT, env: environment });
run(WINDOWS ? 'gradlew.bat' : './gradlew', ['assembleDebug'], { cwd: ANDROID, env: environment });
const apk = join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
console.log(`Đã dựng ${apk}`);

if (process.argv.includes('--chay')) {
  const adb = join(sdk, 'platform-tools', WINDOWS ? 'adb.exe' : 'adb');
  const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' }).stdout ?? '';
  if (!/\tdevice\b/.test(devices)) {
    console.error('Chưa có máy giả lập nào đang chạy: mở bằng `emulator -avd <tên AVD>` rồi chạy lại.');
    process.exit(3);
  }
  // Máy giả lập gọi localhost:5174, 5175 tới máy chủ phát triển của máy thật (ngữ cảnh an toàn nên service worker chạy được)
  for (const port of DEV_PORTS) {
    run(adb, ['reverse', `tcp:${port}`, `tcp:${port}`], { shell: false });
  }
  run(adb, ['install', '-r', apk], { shell: false });
  run(adb, ['shell', 'am', 'start', '-n', `${APP_ID}/.MainActivity`], { shell: false });
  console.log('Đã mở ứng dụng trên máy giả lập.');
}
