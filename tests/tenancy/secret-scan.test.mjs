import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

// Quét bí mật trong mã nguồn (DT-SaaS phần S8b, YCTD-201, tài liệu 32 mục 14.5 "Kiểm tra trong CI"): mọi tệp đang được theo dõi bằng git
// không được chứa khóa riêng, khóa truy cập của nhà cung cấp hay mã thông báo dạng thật. Chỉ quét mẫu có định dạng đặc trưng (ít nhầm);
// chỗ cố ý (ví dụ khóa mẫu trong tài liệu) khai ở ALLOWED kèm lý do. Chạy ở bước `pnpm test` của gói tests nên CI luôn chạy
const root = fileURLToPath(new URL('../../', import.meta.url));

const PATTERNS = [
  {
    name: 'khóa riêng PEM',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  { name: 'khóa truy cập AWS', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'mã thông báo GitHub', regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'khóa Stripe thật', regex: /\b[sr]k_live_[0-9A-Za-z]{16,}\b/ },
  { name: 'mã thông báo Slack', regex: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/ },
  { name: 'khóa API Google', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'mã thông báo Facebook dài hạn', regex: /\bEAA[A-Za-z0-9]{100,}\b/ },
];

// Tệp được phép chứa mẫu (đường dẫn tương đối, lý do)
const ALLOWED = new Map([['tests/tenancy/secret-scan.test.mjs', 'chính tệp quét chứa mẫu nhận dạng']]);

const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz|xlsx|docx|pptx)$/i;
const MAXIMUM_BYTES = 2_000_000;

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((path) => !BINARY_EXTENSIONS.test(path));
}

describe('quét bí mật trong mã nguồn', () => {
  it('không có khóa riêng, khóa nhà cung cấp, mã thông báo dạng thật ở tệp đang theo dõi', () => {
    const found = [];
    for (const path of trackedFiles()) {
      if (ALLOWED.has(path)) {
        continue;
      }
      let text;
      try {
        const buffer = readFileSync(`${root}${path}`);
        if (buffer.length > MAXIMUM_BYTES) {
          continue;
        }
        text = buffer.toString('utf8');
      } catch {
        // Tệp đã bị xóa khỏi cây làm việc nhưng chưa bỏ khỏi chỉ mục
        continue;
      }
      for (const pattern of PATTERNS) {
        if (pattern.regex.test(text)) {
          found.push(`${path}: ${pattern.name}`);
        }
      }
    }
    assert.deepEqual(found, [], 'Có bí mật trong mã nguồn; gỡ khỏi git, đổi khóa đã lộ rồi mới sửa kiểm tra này');
  });

  it('mẫu nhận dạng hoạt động (không quét hụt)', () => {
    const samples = [
      '-----BEGIN PRIVATE KEY-----',
      'AKIAABCDEFGHIJKLMNOP',
      `ghp_${'a'.repeat(36)}`,
      `sk_live_${'a'.repeat(24)}`,
      `xoxb-${'1'.repeat(24)}`,
      `AIza${'a'.repeat(35)}`,
    ];
    for (const sample of samples) {
      assert.ok(
        PATTERNS.some((pattern) => pattern.regex.test(sample)),
        sample,
      );
    }
    assert.ok(!PATTERNS.some((pattern) => pattern.regex.test('const khoa = "khong-phai-bi-mat"')));
  });
});
