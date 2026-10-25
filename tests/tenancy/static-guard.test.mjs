import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

// Kiểm tĩnh của nền đa thuê bao (DT-SaaS phần S1a, tài liệu 32 mục 14.7 lớp 2): quét mã nguồn, chặn mã mới truy cập cơ sở dữ liệu,
// Redis, kho tệp ngoài lớp hạ tầng, đọc biến môi trường rải rác, ghép tay khóa của trường. Các chỗ đã có trước S1a nằm trong tệp
// baseline kèm lý do và do S1b, S3 gỡ dần: tệp mới vi phạm thì kiểm thử đỏ, tệp baseline hết vi phạm mà vẫn nằm trong baseline cũng
// đỏ (baseline chỉ được co lại). Cập nhật baseline: UPDATE_STATIC_GUARD_BASELINE=1 node --test tenancy/static-guard.test.mjs
const root = fileURLToPath(new URL('../../', import.meta.url));
const baselinePath = fileURLToPath(new URL('./static-guard-baseline.json', import.meta.url));

const SOURCE_ROOTS = ['apps', 'packages', 'database'];
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report', '.git']);

function isTestFile(path) {
  return (
    /\.test\.(ts|tsx|mjs)$/.test(path) ||
    /\/test-support\.ts$/.test(path) ||
    /\/tenant-test-support\.ts$/.test(path) ||
    /\/test-admin\.ts$/.test(path) ||
    path.endsWith('.d.ts')
  );
}

function* walk(directory) {
  for (const name of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(name)) {
      continue;
    }
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      yield* walk(path);
    } else if (/\.(ts|tsx|mjs)$/.test(name)) {
      yield path;
    }
  }
}

function sourceFiles() {
  const files = [];
  for (const sourceRoot of SOURCE_ROOTS) {
    for (const path of walk(join(root, sourceRoot))) {
      const relativePath = relative(root, path).split(sep).join('/');
      // Chỉ mã nguồn dịch vụ, gói dùng chung và gói cơ sở dữ liệu (không xét tệp thay đổi cấu trúc, giao diện, tài liệu)
      if (
        /^(apps\/(api|identity|worker)|packages\/server|database\/src)\//.test(relativePath) &&
        !isTestFile(relativePath)
      ) {
        files.push(relativePath);
      }
    }
  }
  return files.sort();
}

// Quy tắc: mỗi quy tắc có mẫu và danh sách đường dẫn được phép vĩnh viễn (lớp hạ tầng); các chỗ vi phạm cũ nằm ở baseline
const RULES = [
  {
    id: 'direct-database-connection',
    description:
      'mở kết nối cơ sở dữ liệu trực tiếp (createDatabase) ngoài lớp hạ tầng: dùng Databases, Infrastructure hoặc TenantConnections',
    pattern: /\bcreateDatabase\s*[<(]/,
    allowed: [
      /^database\/src\//,
      /^apps\/api\/src\/common\/databases\.ts$/,
      /^apps\/identity\/src\/common\/infrastructure\.ts$/,
      // Lệnh dòng lệnh quản trị chạy một lần, không thuộc yêu cầu của trường nào
      /^apps\/identity\/src\/(create-platform-(administrator|operator)|reset-operator-totp)\.ts$/,
    ],
  },
  {
    id: 'direct-redis-connection',
    description: 'mở kết nối Redis trực tiếp (new Redis) ngoài lớp hạ tầng',
    pattern: /\bnew Redis\(/,
    allowed: [/^apps\/identity\/src\/common\/infrastructure\.ts$/],
  },
  {
    id: 'direct-object-storage',
    description: 'mở kho tệp trực tiếp (new S3Client) ngoài FileStorage',
    pattern: /\bnew S3Client\(/,
    allowed: [/^apps\/api\/src\/files\/file-storage\.ts$/],
  },
  {
    id: 'environment-read',
    description:
      'đọc biến môi trường (process.env) ngoài tệp cấu hình và khởi động: cấu hình riêng của trường nằm ở cơ sở dữ liệu của trường',
    pattern: /\bprocess\.env\b/,
    allowed: [
      /\/configuration\.ts$/,
      /\/main\.ts$/,
      /^database\/src\/(environment|platform-command|migrate-command|level-check-command|tenancy-runtime|test-admin)\.ts$/,
      // Lệnh dòng lệnh vận hành nền tảng đọc khóa gốc ở biến môi trường (DT-SaaS phần S8b)
      /^apps\/identity\/src\/(create-platform-operator|reset-operator-totp)\.ts$/,
    ],
  },
  {
    id: 'redis-call-outside-infrastructure',
    description: 'gọi lệnh Redis trực tiếp: khóa phải đi qua cacheKey hoặc Infrastructure.keyPrefix()',
    pattern: /\bredis\w*\.(get|set|incr|expire|del|rpush|lpush|blpop|keys|multi|publish|subscribe)\(/i,
    allowed: [],
  },
  {
    id: 'handmade-tenant-prefix',
    description: 'ghép tay tiền tố của trường (tenants/, t:<mã>) thay vì dùng storageKey, cacheKey',
    pattern: /['"`]tenants\/|['"`]t:\$\{/,
    allowed: [/^packages\/server\/src\/resource-names\.ts$/],
  },
];

function scan() {
  const found = Object.fromEntries(RULES.map((rule) => [rule.id, []]));
  for (const path of sourceFiles()) {
    const text = readFileSync(join(root, path), 'utf8');
    for (const rule of RULES) {
      if (rule.allowed.some((allowedPattern) => allowedPattern.test(path))) {
        continue;
      }
      if (rule.pattern.test(text)) {
        found[rule.id].push(path);
      }
    }
  }
  return found;
}

function readBaseline() {
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch {
    return { _chu_thich: '', rules: {} };
  }
}

if (process.env.UPDATE_STATIC_GUARD_BASELINE) {
  const previous = readBaseline();
  const found = scan();
  const rules = {};
  for (const rule of RULES) {
    rules[rule.id] = Object.fromEntries(
      found[rule.id].map((path) => [
        path,
        previous.rules?.[rule.id]?.[path] ?? 'Có trước S1a, S1b hoặc S3 gỡ: chuyển sang lớp hạ tầng theo trường',
      ]),
    );
  }
  writeFileSync(
    baselinePath,
    `${JSON.stringify({ _chu_thich: 'Chỗ vi phạm có trước DT-SaaS S1a, kèm lý do; chỉ được co lại (tài liệu 32 mục 14.7 lớp 2)', rules }, null, 2)}\n`,
  );
}

describe('kiểm tĩnh nền đa thuê bao', () => {
  const baseline = readBaseline();
  const found = scan();
  for (const rule of RULES) {
    it(`${rule.id}: không có chỗ mới vi phạm, baseline không thừa`, () => {
      const allowedByBaseline = new Set(Object.keys(baseline.rules?.[rule.id] ?? {}));
      const added = found[rule.id].filter((path) => !allowedByBaseline.has(path));
      assert.deepEqual(added, [], `Tệp mới ${rule.description}: ${added.join(', ')}`);
      const stale = [...allowedByBaseline].filter((path) => !found[rule.id].includes(path));
      assert.deepEqual(stale, [], `Tệp đã hết vi phạm, xóa khỏi baseline: ${stale.join(', ')}`);
    });
  }
});
