// Chạy đủ bản nhiều trường trên máy phát triển (YCTD-310; tài liệu 32 mục 16.10): dịch vụ định danh, máy chủ API, tiến trình nền (đã
// dựng ở apps/*/dist) và bảy ứng dụng web (vite): cổng quản trị trường, cổng vận hành nền tảng, ứng dụng giáo viên, phụ huynh, học sinh,
// chợ gia sư, ứng dụng Gia sư. Biến của .env bị đè bởi tệp môi trường riêng do lệnh
// `pnpm --filter @school-management/database nhieu-truong-cuc-bo` sinh. Mọi ứng dụng trỏ về định danh, API của bản nhiều trường và
// phục vụ ở tên miền *.localhost (trình duyệt tự đưa về máy, không sửa tệp hosts). Ctrl+C dừng tất cả.
//
// Cách dùng (ở thư mục gốc kho):
//   node scripts/chay-nhieu-truong.mjs [--env-out .env.nhieu-truong]
// Không in giá trị bí mật.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const GOC = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const baseFile = resolve(GOC, '.env');
const multiFile = resolve(GOC, option('env-out', '.env.nhieu-truong'));
if (!existsSync(multiFile)) {
  console.error(`Chưa có ${multiFile}: chạy lệnh nhieu-truong-cuc-bo trước (tài liệu 32 mục 16.10)`);
  process.exit(1);
}
const merged = {
  ...(existsSync(baseFile) ? parseEnv(readFileSync(baseFile, 'utf8')) : {}),
  ...parseEnv(readFileSync(multiFile, 'utf8')),
};
if (!merged.PLATFORM_DATABASE_URL || !merged.PLATFORM_ROOT_DOMAIN) {
  console.error(`${multiFile} thiếu PLATFORM_DATABASE_URL hoặc PLATFORM_ROOT_DOMAIN`);
  process.exit(1);
}

// Cổng của các ứng dụng web: dải 519x riêng, không đụng cổng chuẩn 5173… của bản một trường
const WEB = [
  { name: 'cong-quan-tri', filter: '@school-management/portal', port: 5190 },
  { name: 'cong-van-hanh', filter: '@school-management/platform', port: 5191 },
  { name: 'giao-vien', filter: '@school-management/teacher', port: 5192 },
  { name: 'phu-huynh', filter: '@school-management/parent', port: 5193 },
  { name: 'hoc-sinh', filter: '@school-management/student', port: 5194 },
  { name: 'cho-gia-su', filter: '@school-management/market', port: 5195 },
  { name: 'gia-su', filter: '@school-management/tutor', port: 5196 },
];
const port = (name) => WEB.find((app) => app.name === name).port;
// Khởi tạo trường ở lần mở đầu tiên (YCTD-314) cần tài khoản tạo cơ sở dữ liệu, vai trò: chưa đặt PLATFORM_ADMIN_DATABASE_URL thì suy
// từ POSTGRES_PASSWORD của .env và máy chủ của PLATFORM_DATABASE_URL; chỉ truyền cho tiến trình, không ghi ra tệp
if (!merged.PLATFORM_ADMIN_DATABASE_URL && merged.POSTGRES_PASSWORD) {
  const platformUrl = new URL(merged.PLATFORM_DATABASE_URL);
  merged.PLATFORM_ADMIN_DATABASE_URL = `postgres://${merged.POSTGRES_USER || 'postgres'}:${encodeURIComponent(
    merged.POSTGRES_PASSWORD,
  )}@${platformUrl.hostname}:${platformUrl.port || '5432'}/postgres`;
}
const root = merged.PLATFORM_ROOT_DOMAIN;
const school = merged.NHIEU_TRUONG_TEN_MIEN_TRUONG_DEMO || `<mã trường>.${root}`;
const schoolHost = merged.NHIEU_TRUONG_TEN_MIEN_TRUONG_DEMO || root;
const environment = {
  ...process.env,
  ...merged,
  // Cổng vận hành tạo đường liên kết vào trường bằng http ở cổng của cổng quản trị
  VITE_SCHOOL_PORTAL_PORT: String(port('cong-quan-tri')),
  // Ứng dụng giáo viên, phụ huynh của trường khi quản trị nền tảng mở từ cổng vận hành (YCTD-315)
  VITE_SCHOOL_TEACHER_PORT: String(port('giao-vien')),
  VITE_SCHOOL_PARENT_PORT: String(port('phu-huynh')),
  // Liên kết qua lại giữa ứng dụng phụ huynh và học sinh (cùng tên miền của trường, khác cổng khi phát triển)
  STUDENT_APP_URL: `http://${schoolHost}:${port('hoc-sinh')}/`,
  PARENT_APP_URL: `http://${schoolHost}:${port('phu-huynh')}/`,
};

const processes = [
  { name: 'dinh-danh', command: process.execPath, args: [resolve(GOC, 'apps/identity/dist/main.js')] },
  { name: 'api', command: process.execPath, args: [resolve(GOC, 'apps/api/dist/main.js')] },
  // Máy xếp thời khóa biểu chờ hàng đợi Redis, không gắn với trường nào
  { name: 'tien-trinh-nen', command: process.execPath, args: [resolve(GOC, 'apps/worker/dist/main.js')] },
  ...WEB.map(({ name, filter, port }) => ({
    name,
    command: 'pnpm',
    args: ['--filter', filter, 'exec', 'vite', '--port', String(port), '--strictPort'],
    shell: process.platform === 'win32',
  })),
];

const children = processes.map(({ name, command, args: commandArgs, shell }) => {
  const child = spawn(command, commandArgs, { cwd: GOC, env: environment, shell: Boolean(shell) });
  const prefix = (stream, target) =>
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim()) target.write(`[${name}] ${line}\n`);
      }
    });
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on('exit', (code) => console.log(`[${name}] đã dừng (mã ${code})`));
  return child;
});

const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log(
  [
    `Bản nhiều trường (định danh cổng ${merged.IDENTITY_PORT}, API cổng ${merged.API_PORT}):`,
    `  Đăng nhập chọn đơn vị        http://${root}:${port('cong-quan-tri')}/`,
    `  Cổng quản trị trường demo    http://${school}:${port('cong-quan-tri')}/`,
    `  Ứng dụng giáo viên           http://${school}:${port('giao-vien')}/`,
    `  Ứng dụng phụ huynh           http://${school}:${port('phu-huynh')}/`,
    `  Ứng dụng học sinh            http://${school}:${port('hoc-sinh')}/`,
    `  Cổng vận hành nền tảng       http://${merged.PLATFORM_CONSOLE_HOST || `platform.${root}`}:${port('cong-van-hanh')}/`,
    `  Chợ gia sư                   http://cho-gia-su.${root}:${port('cho-gia-su')}/`,
    `  Ứng dụng Gia sư              http://gia-su.${root}:${port('gia-su')}/`,
  ].join('\n'),
);
