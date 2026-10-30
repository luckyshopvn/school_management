import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scryptSync } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { ruleViolationError, type FieldError } from '@school-management/server';

// Gói chuyển trường `school-management.student-transfer/1` (YCTD-390 lát L1, BR-480). Gói là JSON nén gzip gồm bản kê và các
// phần (tệp JSON, PDF học bạ, tệp 82 cột) theo kiểu gói khoá học `course-package/1`, rồi mã hóa AES-256-GCM bằng khóa dẫn từ
// mật khẩu (scrypt). Mật khẩu do hệ thống sinh, chỉ hiện một lần và in trên bản in giao phụ huynh, không lưu. Bản kê ghi mã băm
// SHA-256 từng phần; sai một phần thì từ chối cả gói. Chữ ký bằng khóa của trường thêm ở lát L2. Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11: gói tối đa 50 MB, mật khẩu 16 ký tự chia bốn nhóm, scrypt N = 2^15, r = 8, p = 1
export const TRANSFER_PACKAGE_FORMAT = 'school-management.student-transfer/1';
export const TRANSFER_PACKAGE_RULE_CODE = 'BR-480';
export const MAXIMUM_TRANSFER_PACKAGE_BYTES = 50 * 1024 * 1024;
export const TRANSFER_PACKAGE_EXTENSION = 'goichuyen';

const MAGIC = Buffer.from('SMSTP/1\n', 'utf8');
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// Phần bắt buộc theo hồ sơ chuyển trường; phần thêm chỉ đóng gói khi phụ huynh đồng ý (BR-481)
export const OPTIONAL_TRANSFER_PARTS = ['suc-khoe', 'khen-thuong'] as const;
export type OptionalTransferPart = (typeof OPTIONAL_TRANSFER_PARTS)[number];
export const OPTIONAL_TRANSFER_PART_LABELS: Record<OptionalTransferPart, string> = {
  'suc-khoe': 'Sức khỏe',
  'khen-thuong': 'Khen thưởng',
};

export interface TransferPackagePart {
  path: string;
  sha256: string;
  bytes: number;
}

export interface TransferPackageManifest {
  format: string;
  package_code: string;
  kind: 'chuyen-truong';
  created_at: string;
  source_school: { name: string; code: string | null };
  destination: { school_name: string; province_name: string | null; ward_name: string | null };
  transfer_date: string;
  reason: string | null;
  approved_by_name: string;
  student: { full_name: string; dob: string | null; moet_student_code: string | null };
  consent: {
    optional_parts: OptionalTransferPart[];
    method: 'paper';
    recorded_by_name: string;
    recorded_at: string;
  } | null;
  parts: TransferPackagePart[];
}

export interface OpenedTransferPackage {
  manifest: TransferPackageManifest;
  files: Map<string, Buffer>;
  sha256: string;
}

export function transferPackageRule(message: string, fields?: FieldError[]) {
  return ruleViolationError(TRANSFER_PACKAGE_RULE_CODE, message, fields);
}

export const sha256Of = (body: Buffer) => createHash('sha256').update(body).digest('hex');

// Mật khẩu 16 ký tự chữ hoa và số, bỏ ký tự dễ nhầm (I, L, O, 0, 1), chia bốn nhóm
export function generateTransferPassword(): string {
  const characters = Array.from({ length: 16 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]);
  return [0, 4, 8, 12].map((start) => characters.slice(start, start + 4).join('')).join('-');
}

const normalizePassword = (password: string) => password.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Mã gói: GCT-<ngày lập>-<6 ký tự ngẫu nhiên>, ví dụ GCT-20270116-7F3K9Q
export function generatePackageCode(createdAt: Date): string {
  const day = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
  return `GCT-${day}-${suffix}`;
}

// Dựng bản kê từ các phần (mã băm, cỡ) rồi nén, mã hóa; trả tệp gói và mã băm của tệp
export function sealTransferPackage(
  manifest: Omit<TransferPackageManifest, 'parts' | 'format'>,
  files: Map<string, Buffer>,
  password: string,
): { body: Buffer; sha256: string; manifest: TransferPackageManifest } {
  const complete: TransferPackageManifest = {
    ...manifest,
    format: TRANSFER_PACKAGE_FORMAT,
    parts: [...files.entries()].map(([path, body]) => ({ path, sha256: sha256Of(body), bytes: body.length })),
  };
  const plain = gzipSync(
    Buffer.from(
      JSON.stringify({
        manifest: complete,
        files: Object.fromEntries([...files.entries()].map(([path, body]) => [path, body.toString('base64')])),
      }),
      'utf8',
    ),
  );
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const header = Buffer.from(
    JSON.stringify({
      format: TRANSFER_PACKAGE_FORMAT,
      package_code: manifest.package_code,
      kdf: 'scrypt',
      n: SCRYPT.N,
      r: SCRYPT.r,
      p: SCRYPT.p,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
    }),
    'utf8',
  );
  const key = scryptSync(normalizePassword(password), salt, 32, SCRYPT);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(header);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length);
  const body = Buffer.concat([MAGIC, length, header, encrypted]);
  if (body.length > MAXIMUM_TRANSFER_PACKAGE_BYTES) {
    throw transferPackageRule('Gói chuyển trường quá 50 MB');
  }
  return { body, sha256: sha256Of(body), manifest: complete };
}

// Đọc phần đầu không mã hóa (định dạng, mã gói) để báo lỗi rõ trước khi giải mã
export function readTransferPackageHeader(
  body: Buffer,
): { format: string; package_code: string } & Record<string, unknown> {
  if (body.length > MAXIMUM_TRANSFER_PACKAGE_BYTES) {
    throw transferPackageRule('Gói chuyển trường quá 50 MB', [{ field: 'file', message: 'Tệp quá lớn' }]);
  }
  if (body.length < MAGIC.length + 4 || !body.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw transferPackageRule('Tệp không phải gói chuyển trường', [{ field: 'file', message: 'Sai loại tệp' }]);
  }
  const headerLength = body.readUInt32BE(MAGIC.length);
  const headerEnd = MAGIC.length + 4 + headerLength;
  if (headerLength > 4096 || headerEnd + 16 > body.length) {
    throw transferPackageRule('Gói chuyển trường bị hỏng', [{ field: 'file', message: 'Gói hỏng' }]);
  }
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(body.subarray(MAGIC.length + 4, headerEnd).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw transferPackageRule('Gói chuyển trường bị hỏng', [{ field: 'file', message: 'Gói hỏng' }]);
  }
  if (header.format !== TRANSFER_PACKAGE_FORMAT) {
    throw transferPackageRule(`Không đọc được định dạng gói ${String(header.format)}`, [
      { field: 'file', message: 'Định dạng gói không hỗ trợ' },
    ]);
  }
  if (typeof header.package_code !== 'string') {
    throw transferPackageRule('Gói chuyển trường bị hỏng', [{ field: 'file', message: 'Gói hỏng' }]);
  }
  return header as { format: string; package_code: string } & Record<string, unknown>;
}

// Giải mã bằng mật khẩu, kiểm bản kê và mã băm từng phần; sai mật khẩu và gói bị sửa đều báo cùng một lỗi
export function openTransferPackage(body: Buffer, password: string): OpenedTransferPackage {
  const header = readTransferPackageHeader(body);
  const headerLength = body.readUInt32BE(MAGIC.length);
  const headerBytes = body.subarray(MAGIC.length + 4, MAGIC.length + 4 + headerLength);
  const encrypted = body.subarray(MAGIC.length + 4 + headerLength);
  const wrongPassword = () =>
    transferPackageRule('Mật khẩu không đúng hoặc gói đã bị sửa', [
      { field: 'password', message: 'Kiểm tra mật khẩu' },
    ]);
  if (header.kdf !== 'scrypt' || header.n !== SCRYPT.N || header.r !== SCRYPT.r || header.p !== SCRYPT.p) {
    throw transferPackageRule('Gói chuyển trường bị hỏng', [{ field: 'file', message: 'Gói hỏng' }]);
  }
  let plain: Buffer;
  try {
    const key = scryptSync(normalizePassword(password), Buffer.from(String(header.salt), 'base64'), 32, SCRYPT);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(header.iv), 'base64'));
    decipher.setAAD(headerBytes);
    decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
    plain = Buffer.concat([decipher.update(encrypted.subarray(0, encrypted.length - 16)), decipher.final()]);
  } catch {
    throw wrongPassword();
  }
  let payload: { manifest?: TransferPackageManifest; files?: Record<string, unknown> };
  try {
    payload = JSON.parse(
      gunzipSync(plain, { maxOutputLength: MAXIMUM_TRANSFER_PACKAGE_BYTES * 2 }).toString('utf8'),
    ) as typeof payload;
  } catch {
    throw transferPackageRule('Gói chuyển trường bị hỏng', [{ field: 'file', message: 'Gói hỏng' }]);
  }
  const manifest = payload.manifest;
  if (
    !manifest ||
    manifest.format !== TRANSFER_PACKAGE_FORMAT ||
    manifest.package_code !== header.package_code ||
    !Array.isArray(manifest.parts) ||
    typeof payload.files !== 'object' ||
    payload.files === null
  ) {
    throw transferPackageRule('Bản kê của gói không hợp lệ', [{ field: 'file', message: 'Gói hỏng' }]);
  }
  const files = new Map<string, Buffer>();
  const listed = new Set<string>();
  for (const part of manifest.parts) {
    const content = payload.files[part.path];
    if (typeof content !== 'string') {
      throw transferPackageRule(`Gói thiếu phần ${part.path}`, [{ field: 'file', message: 'Gói thiếu phần' }]);
    }
    const partBody = Buffer.from(content, 'base64');
    if (partBody.length !== part.bytes || sha256Of(partBody) !== part.sha256) {
      throw transferPackageRule(`Phần ${part.path} sai mã băm`, [{ field: 'file', message: 'Gói đã bị sửa' }]);
    }
    files.set(part.path, partBody);
    listed.add(part.path);
  }
  const extra = Object.keys(payload.files).filter((path) => !listed.has(path));
  if (extra.length > 0) {
    throw transferPackageRule(`Gói có phần không ghi trong bản kê: ${extra.slice(0, 3).join(', ')}`, [
      { field: 'file', message: 'Gói đã bị sửa' },
    ]);
  }
  if (!files.has('ho-so-82-cot.xlsx') || !files.has('hoc-sinh.json')) {
    throw transferPackageRule('Gói thiếu hồ sơ học sinh', [{ field: 'file', message: 'Gói thiếu phần' }]);
  }
  return { manifest, files, sha256: sha256Of(body) };
}

// Đọc một phần JSON của gói đã mở
export function readJsonPart<T>(opened: OpenedTransferPackage, path: string): T | null {
  const body = opened.files.get(path);
  if (!body) {
    return null;
  }
  try {
    return JSON.parse(body.toString('utf8')) as T;
  } catch {
    throw transferPackageRule(`Phần ${path} không đọc được`, [{ field: 'file', message: 'Gói hỏng' }]);
  }
}

export const jsonPart = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8');
