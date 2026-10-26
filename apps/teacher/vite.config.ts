import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Khi phát triển, chuyển nhóm điểm cuối xác thực sang dịch vụ định danh, phần còn lại của /api/v1 sang máy chủ API
// (17_DAC_TA_API.md quy ước 8)
const identityTarget = process.env.IDENTITY_BASE_URL ?? 'http://localhost:3001';
const apiTarget = process.env.API_BASE_URL ?? 'http://localhost:3000';

// Đường dẫn gốc khi dựng (DT-SaaS phần S9): hồ sơ thử nghiệm phục vụ ba ứng dụng dưới /quan-ly, /giao-vien, /phu-huynh trên
// cùng tên miền của trường; mặc định / như trước
const base = process.env.APP_BASE_PATH?.trim() || '/';

// Phiên bản bộ nhớ đệm của service worker theo bản phát hành (DT-23 phần 23b, YCTD-212): khi dựng, thay mã bản dựng và danh sách
// tệp dựng cần giữ sẵn trong dist/sw.js. Mã bản dựng là biến APP_RELEASE nếu có, không thì băm tên các tệp dựng (tên có mã băm
// nội dung nên đổi nội dung là đổi mã). Lúc phát triển sw.js giữ giá trị mặc định
function serviceWorkerRelease(): Plugin {
  let outDirectory = 'dist';
  let files: string[] = [];
  return {
    name: 'service-worker-release',
    apply: 'build',
    configResolved(config) {
      outDirectory = resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      files = Object.keys(bundle).sort();
    },
    closeBundle() {
      const target = join(outDirectory, 'sw.js');
      const release =
        process.env.APP_RELEASE?.trim() || createHash('sha1').update(files.join('\n')).digest('hex').slice(0, 12);
      const precache = ['./', ...files.filter((name) => /\.(js|css)$/.test(name))];
      const source = readFileSync(target, 'utf8')
        .replace(/const VERSION = '[^']*';/, `const VERSION = ${JSON.stringify(release).replace(/"/g, "'")};`)
        .replace(
          /\/\* precache \*\/[\s\S]*?\/\* end-precache \*\//,
          `/* precache */ const PRECACHE = ${JSON.stringify(precache)}; /* end-precache */`,
        );
      writeFileSync(target, source);
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), serviceWorkerRelease()],
  server: {
    port: 5174,
    proxy: {
      '/api/v1/auth': { target: identityTarget },
      '/api/v1': { target: apiTarget },
    },
  },
});
