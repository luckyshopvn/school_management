// Chạy bản nhiều trường trên máy phát triển, song song với bản một trường (YCTD-310; tài liệu 32 mục 16.10): dịch vụ định danh, máy
// chủ API (đã dựng ở apps/*/dist) và cổng quản trị (vite) với biến của .env đè bởi tệp môi trường riêng do lệnh
// `pnpm --filter @school-management/database nhieu-truong-cuc-bo` sinh. Ctrl+C dừng cả ba.
//
// Cách dùng (ở thư mục gốc kho):
//   node scripts/chay-nhieu-truong.mjs [--env-out .env.nhieu-truong] [--portal-port 5190]
// Không in giá trị biến môi trường.
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
const portalPort = option('portal-port', '5190');
const environment = { ...process.env, ...merged };

const processes = [
  { name: 'dinh-danh', command: process.execPath, args: [resolve(GOC, 'apps/identity/dist/main.js')] },
  { name: 'api', command: process.execPath, args: [resolve(GOC, 'apps/api/dist/main.js')] },
  {
    name: 'cong-quan-tri',
    command: 'pnpm',
    args: ['--filter', '@school-management/portal', 'exec', 'vite', '--port', portalPort, '--strictPort'],
    shell: process.platform === 'win32',
  },
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
  `Trang đăng nhập theo đơn vị: http://${merged.PLATFORM_ROOT_DOMAIN}:${portalPort}/ ` +
    `(định danh cổng ${merged.IDENTITY_PORT}, API cổng ${merged.API_PORT})`,
);
