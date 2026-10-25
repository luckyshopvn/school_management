import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';

// Container gộp của hồ sơ thử nghiệm (DT-SaaS phần S9, YCTD-203; tài liệu 32 mục 14.5): chạy dịch vụ định danh và máy chủ API
// trong một container, mở một cổng (PORT do Render, Koyeb đặt). Bộ định tuyến nhỏ này nhận mọi yêu cầu và chuyển theo đúng
// bảng tuyến của Caddy ở hồ sơ vận hành: nhóm điểm cuối định danh sang `identity`, phần còn lại sang `api`. Trước khi chạy:
// MIGRATE_ON_START=true thì chạy migrate cơ sở dữ liệu nền tảng; MIGRATE_SCHOOLS_ON_START=true thì migrate cuốn chiếu mọi trường
// (S2). Không có tiến trình `worker`: máy xếp thời khoá biểu chạy trong tiến trình hoặc tắt (không Redis ở hồ sơ thử nghiệm).
export const IDENTITY_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/users',
  '/api/v1/roles',
  '/api/v1/permissions',
  '/api/v1/api-clients',
];

export function upstreamOf(path) {
  const pathname = path.split('?')[0] ?? '/';
  return IDENTITY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ? 'identity'
    : 'api';
}

// Chuyển một yêu cầu sang dịch vụ con; dịch vụ con chưa sẵn sàng thì trả 503 để cổng biên hiện trang đang khởi động
export function createRouter(ports, host = '127.0.0.1') {
  return createServer((incoming, outgoing) => {
    const target = upstreamOf(incoming.url ?? '/');
    const forward = httpRequest(
      {
        host,
        port: ports[target],
        method: incoming.method,
        path: incoming.url,
        headers: incoming.headers,
      },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
      },
    );
    forward.on('error', () => {
      if (!outgoing.headersSent) {
        outgoing.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'retry-after': '5' });
      }
      outgoing.end(
        JSON.stringify({
          error: { code: 'ERR_SERVICE_WAKING', message: 'Dịch vụ đang khởi động, vui lòng thử lại', details: [] },
        }),
      );
    });
    incoming.pipe(forward);
  });
}

function run(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: environment });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${args.join(' ')} thoát với mã ${code}`))));
  });
}

function startService(name, script, environment) {
  const child = spawn(process.execPath, [script], { stdio: 'inherit', env: environment });
  child.on('exit', (code, signal) => {
    console.error(`Dịch vụ ${name} dừng (mã ${code ?? signal}); dừng cả container để nền tảng khởi động lại`);
    process.exit(1);
  });
  return child;
}

export async function main(environment = process.env) {
  const port = Number(environment.PORT ?? 8080);
  const ports = { identity: Number(environment.IDENTITY_PORT ?? 3001), api: Number(environment.API_PORT ?? 3000) };
  const shared = { ...environment, IDENTITY_PORT: String(ports.identity), API_PORT: String(ports.api) };
  // Máy chủ API gọi dịch vụ định danh và ngược lại qua địa chỉ nội bộ của container
  shared.IDENTITY_BASE_URL ??= `http://127.0.0.1:${ports.identity}`;
  shared.API_BASE_URL ??= `http://127.0.0.1:${ports.api}`;
  if (environment.MIGRATE_ON_START === 'true') {
    await run(process.execPath, ['/app/database/dist/src/platform-command.js', 'migrate'], shared);
  }
  if (environment.MIGRATE_SCHOOLS_ON_START === 'true') {
    await run(
      process.execPath,
      ['/app/database/dist/src/platform-command.js', 'migrate-schools', '--continue'],
      shared,
    );
  }
  const children = [
    startService('identity', '/app/apps/identity/dist/main.js', shared),
    startService('api', '/app/apps/api/dist/main.js', shared),
  ];
  const router = createRouter(ports);
  router.listen(port, '0.0.0.0', () => console.log(`Bộ định tuyến container gộp nghe cổng ${port}`));
  const stop = () => {
    router.close();
    for (const child of children) {
      child.removeAllListeners('exit');
      child.kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

if (process.argv[1]?.endsWith('router.mjs')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
