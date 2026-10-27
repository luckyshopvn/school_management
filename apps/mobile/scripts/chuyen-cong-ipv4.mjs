// Chuyển cổng IPv4 sang IPv6 cho máy chủ phát triển khi chạy bản demo trên máy giả lập (DT-26 phần 26f, YCTD-236). Trên Windows, `vite`
// mặc định chỉ nghe `localhost` = [::1] (IPv6), còn `adb reverse` nối tới 127.0.0.1 (IPv4) nên WebView báo ERR_EMPTY_RESPONSE. Script nghe
// 127.0.0.1 ở các cổng của ứng dụng giáo viên, phụ huynh và chuyển tới [::1] cùng cổng; chạy tới khi bấm Ctrl+C. Không cần khi máy chủ phát
// triển đã nghe 127.0.0.1 (ví dụ chạy `vite --host 127.0.0.1`)
//   node scripts/chuyen-cong-ipv4.mjs [cổng ...]   mặc định 5174 5175
import { createConnection, createServer } from 'node:net';

const ports = process.argv.slice(2).map(Number).filter(Boolean);
for (const port of ports.length > 0 ? ports : [5174, 5175]) {
  const server = createServer((client) => {
    const upstream = createConnection({ host: '::1', port });
    client.pipe(upstream).pipe(client);
    const close = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on('error', close);
    upstream.on('error', close);
  });
  server.on('error', (error) => {
    console.error(`Không nghe được 127.0.0.1:${port}: ${error.message}`);
  });
  server.listen(port, '127.0.0.1', () => console.log(`127.0.0.1:${port} → [::1]:${port}`));
}
