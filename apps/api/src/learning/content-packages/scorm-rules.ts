import { createHmac, timingSafeEqual } from 'node:crypto';
import { crc32, inflateRawSync } from 'node:zlib';
import { ruleViolationError, type FieldError } from '@school-management/server';
import type { ScormStandard } from '@school-management/database';
import type { CompletionRule, ResultStatus } from '../learning-rules.js';

// Quy tắc thuần của gói SCORM (DT-28 phần 28h, YCTD-278; tài liệu 32 mục 20.7). Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11, ghi ở YCTD-278:
// - Gói zip tối đa 200 MB (GD-150), giải nén tối đa 2.000 tệp, 500 MB, mỗi tệp 200 MB; không nhận zip mã hóa, ZIP64, đường dẫn
//   tuyệt đối hay có `..`; chỉ nhận loại tệp của bài giảng web (trang, mã, kiểu, ảnh, âm thanh, video, phông, dữ liệu).
// - SCORM 2004 nhiều SCO chạy tuần tự theo tổ chức mặc định, không làm trình tự và điều hướng (GD-153).
// - Điểm quy về thang 10: `score.scaled` (2004) nếu có, không thì `raw` theo `min`, `max` (thiếu `max` thì coi thang 100).
// - Gói là mã của bên thứ ba: phát ở nguồn gốc riêng (CSP `sandbox allow-scripts`, khung `sandbox="allow-scripts"` không có
//   `allow-same-origin`), chỉ nạp mã, kiểu, ảnh từ chính gói, không gọi được máy chủ ngoài; mã truy cập ngắn hạn theo trường, học
//   sinh, hoạt động. Bộ chuyển API chạy trong khung, nhận giá trị ban đầu do máy chủ gắn vào trang, gửi thay đổi lên trang cha bằng
//   `postMessage`; người học chỉ là "Học sinh" với mã ẩn danh, gói không biết tên thật.
export const SCORM_RULE_CODE = 'YCTD-278';
export const MAXIMUM_SCORM_PACKAGE_BYTES = 200 * 1024 * 1024;
export const MAXIMUM_SCORM_FILES = 2000;
export const MAXIMUM_SCORM_EXTRACTED_BYTES = 500 * 1024 * 1024;
export const MAXIMUM_SCORM_FILE_BYTES = 200 * 1024 * 1024;
export const LAUNCH_TOKEN_SECONDS = 4 * 60 * 60;
export const SUSPEND_DATA_LIMIT: Record<ScormStandard, number> = { '1.2': 4096, '2004': 64000 };
const MAXIMUM_LOCATION = 1000;

export function scormRule(message: string, fields?: FieldError[]) {
  return ruleViolationError(SCORM_RULE_CODE, message, fields);
}

// ---------- Đọc zip an toàn

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  xhtml: 'application/xhtml+xml',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  xml: 'application/xml',
  xsd: 'application/xml',
  dtd: 'application/xml-dtd',
  txt: 'text/plain; charset=utf-8',
  vtt: 'text/vtt',
  srt: 'text/plain; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  pdf: 'application/pdf',
  map: 'application/json',
};

export function contentTypeOf(path: string): string | null {
  const extension = path.split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';
  return path.includes('.') ? (CONTENT_TYPES[extension] ?? null) : null;
}

// Đường dẫn trong gói: dấu gạch chéo xuôi, không tuyệt đối, không `..`, không ký tự điều khiển
export function safeEntryPath(raw: string): string | null {
  const name = raw.replace(/\\/g, '/');
  const control = [...name].some((character) => (character.codePointAt(0) ?? 0) < 0x20);
  if (name === '' || name.startsWith('/') || /^[a-zA-Z]:/.test(name) || control) {
    return null;
  }
  const parts = name.split('/').filter((part) => part !== '' && part !== '.');
  if (parts.some((part) => part === '..')) {
    return null;
  }
  return parts.join('/');
}

export interface ZipProblem {
  message: string;
  files?: string[];
}

// Đọc mục lục trung tâm của zip rồi giải nén từng tệp có kiểm cỡ, mã CRC; lỗi cấu trúc ném lỗi quy tắc
export function readScormZip(buffer: Buffer): Map<string, Buffer> {
  if (buffer.length > MAXIMUM_SCORM_PACKAGE_BYTES) {
    throw scormRule('Gói SCORM tối đa 200 MB', [{ field: 'file', message: 'Gói quá lớn' }]);
  }
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endOffset = buffer.lastIndexOf(signature);
  if (endOffset < 0 || endOffset + 22 > buffer.length) {
    throw scormRule('Tệp không phải gói zip', [{ field: 'file', message: 'Không đọc được tệp zip' }]);
  }
  const count = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  let position = buffer.readUInt32LE(endOffset + 16);
  if (count === 0xffff || position === 0xffffffff || centralSize === 0xffffffff) {
    throw scormRule('Không nhận gói zip dạng ZIP64', [{ field: 'file', message: 'Gói dùng ZIP64' }]);
  }
  if (count > MAXIMUM_SCORM_FILES) {
    throw scormRule(`Gói có quá ${MAXIMUM_SCORM_FILES} tệp`, [{ field: 'file', message: 'Quá nhiều tệp' }]);
  }
  const entries = new Map<string, Buffer>();
  const rejected: string[] = [];
  const unsafe: string[] = [];
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (position + 46 > buffer.length || buffer.readUInt32LE(position) !== 0x02014b50) {
      throw scormRule('Mục lục của gói zip bị hỏng', [{ field: 'file', message: 'Gói hỏng' }]);
    }
    const flags = buffer.readUInt16LE(position + 8);
    const method = buffer.readUInt16LE(position + 10);
    const crc = buffer.readUInt32LE(position + 16);
    const compressedSize = buffer.readUInt32LE(position + 20);
    const size = buffer.readUInt32LE(position + 24);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const localOffset = buffer.readUInt32LE(position + 42);
    const rawName = buffer.subarray(position + 46, position + 46 + nameLength).toString('utf8');
    position += 46 + nameLength + extraLength + commentLength;
    if (rawName.endsWith('/') || rawName.endsWith('\\')) {
      continue;
    }
    const name = safeEntryPath(rawName);
    if (!name) {
      unsafe.push(rawName);
      continue;
    }
    if ((flags & 0x1) !== 0) {
      throw scormRule('Không nhận gói zip có mật khẩu', [{ field: 'file', message: 'Gói có mật khẩu' }]);
    }
    if (method !== 0 && method !== 8) {
      throw scormRule('Gói zip dùng cách nén không hỗ trợ (chỉ nhận lưu thẳng hoặc deflate)', [
        { field: 'file', message: 'Cách nén không hỗ trợ' },
      ]);
    }
    if (!contentTypeOf(name)) {
      rejected.push(name);
      continue;
    }
    if (size > MAXIMUM_SCORM_FILE_BYTES || (total += size) > MAXIMUM_SCORM_EXTRACTED_BYTES) {
      throw scormRule('Gói giải nén quá 500 MB hoặc có tệp quá 200 MB', [{ field: 'file', message: 'Gói quá lớn' }]);
    }
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw scormRule('Tệp trong gói zip bị hỏng', [{ field: 'file', message: `Tệp hỏng: ${name}` }]);
    }
    const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const data = buffer.subarray(start, start + compressedSize);
    let body: Buffer;
    try {
      body = method === 8 ? inflateRawSync(data, { maxOutputLength: Math.max(size, 1) }) : Buffer.from(data);
    } catch {
      throw scormRule('Không giải nén được tệp trong gói', [{ field: 'file', message: `Tệp hỏng: ${name}` }]);
    }
    if (body.length !== size || crc32(body) !== crc) {
      throw scormRule('Tệp trong gói zip sai cỡ hoặc mã kiểm tra', [{ field: 'file', message: `Tệp hỏng: ${name}` }]);
    }
    if (entries.has(name)) {
      throw scormRule('Gói có hai tệp trùng đường dẫn', [{ field: 'file', message: `Trùng: ${name}` }]);
    }
    entries.set(name, body);
  }
  if (unsafe.length > 0) {
    throw scormRule(`Gói có đường dẫn thoát thư mục hoặc tuyệt đối: ${unsafe.slice(0, 5).join(', ')}`, [
      { field: 'file', message: 'Đường dẫn không an toàn' },
    ]);
  }
  if (rejected.length > 0) {
    throw scormRule(`Gói có loại tệp không cho phép: ${rejected.slice(0, 5).join(', ')}`, [
      { field: 'file', message: 'Loại tệp không cho phép' },
    ]);
  }
  return entries;
}

// ---------- Đọc imsmanifest.xml

interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  text: string;
}

const decodeEntities = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&');

const localName = (name: string) => (name.includes(':') ? (name.split(':').pop() ?? name) : name).toLowerCase();

// Bộ đọc XML tối giản cho bản kê: phần tử, thuộc tính (tên cục bộ, chữ thường), chữ; bỏ chú thích, khai báo, CDATA giữ chữ
export function parseXml(source: string): XmlElement {
  const root: XmlElement = { name: '#root', attributes: {}, children: [], text: '' };
  const stack = [root];
  const cleaned = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');
  const pattern =
    /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  for (const match of cleaned.matchAll(pattern)) {
    const current = stack[stack.length - 1] as XmlElement;
    if (match[1] !== undefined) {
      current.text += match[1];
      continue;
    }
    if (match[6] !== undefined) {
      current.text += decodeEntities(match[6]);
      continue;
    }
    const closing = match[2] === '/';
    const name = localName(match[3] ?? '');
    if (closing) {
      while (stack.length > 1 && (stack.pop() as XmlElement).name !== name) {
        // phần tử chưa đóng: đóng luôn
      }
      continue;
    }
    const attributes: Record<string, string> = {};
    for (const attribute of (match[4] ?? '').matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attributes[localName(attribute[1] ?? '')] = decodeEntities(attribute[2] ?? attribute[3] ?? '');
    }
    const element: XmlElement = { name, attributes, children: [], text: '' };
    current.children.push(element);
    if (match[5] !== '/') {
      stack.push(element);
    }
  }
  return root;
}

const childrenNamed = (element: XmlElement | undefined, name: string) =>
  (element?.children ?? []).filter((child) => child.name === name);
const firstNamed = (element: XmlElement | undefined, name: string) => childrenNamed(element, name)[0];
const textOf = (element: XmlElement | undefined) => (element?.text ?? '').trim();

function* walk(element: XmlElement): Generator<XmlElement> {
  yield element;
  for (const child of element.children) {
    yield* walk(child);
  }
}

export interface ScormSco {
  identifier: string;
  title: string;
  href: string;
}

export interface ScormManifest {
  standard: ScormStandard;
  title: string;
  scos: ScormSco[];
}

// Đường dẫn trong gói của `href` (gộp `xml:base`), giữ chuỗi truy vấn của SCO
export function resolveHref(base: string, href: string): { path: string | null; query: string } {
  const [pathPart, ...rest] = href.split(/(?=[?#])/);
  const joined = `${base}${pathPart ?? ''}`;
  let decoded: string;
  try {
    decoded = decodeURIComponent(joined);
  } catch {
    decoded = joined;
  }
  return { path: safeEntryPath(decoded), query: rest.join('') };
}

export function parseManifest(xml: string, files: Set<string>): ScormManifest {
  const root = parseXml(xml);
  const manifest = [...walk(root)].find((element) => element.name === 'manifest');
  if (!manifest) {
    throw scormRule('Bản kê imsmanifest.xml không có phần tử manifest', [{ field: 'file', message: 'Bản kê sai' }]);
  }
  const metadata = firstNamed(manifest, 'metadata');
  const version = `${textOf(firstNamed(metadata, 'schemaversion'))} ${xml.includes('adlcp_v1p3') ? 'v1p3' : ''}`;
  const standard: ScormStandard = /2004|CAM 1\.3|v1p3/i.test(version) ? '2004' : '1.2';
  const resourcesElement = firstNamed(manifest, 'resources');
  const resourceBase = resourcesElement?.attributes.base ?? '';
  const resources = new Map<string, { href: string; base: string; type: string }>();
  for (const resource of childrenNamed(resourcesElement, 'resource')) {
    const identifier = resource.attributes.identifier;
    if (!identifier) continue;
    resources.set(identifier, {
      href: resource.attributes.href ?? '',
      base: `${resourceBase}${resource.attributes.base ?? ''}`,
      type: (resource.attributes.scormtype ?? 'sco').toLowerCase(),
    });
  }
  const organizations = firstNamed(manifest, 'organizations');
  const organizationList = childrenNamed(organizations, 'organization');
  const organization =
    organizationList.find((item) => item.attributes.identifier === organizations?.attributes.default) ??
    organizationList[0];
  const scos: ScormSco[] = [];
  const problems: string[] = [];
  const addSco = (identifier: string, title: string, resourceId: string) => {
    const resource = resources.get(resourceId);
    if (!resource || resource.type !== 'sco' || resource.href === '') return;
    const { path, query } = resolveHref(resource.base, resource.href);
    if (!path || !files.has(path)) {
      problems.push(resource.href);
      return;
    }
    scos.push({
      identifier: identifier.slice(0, 200),
      title: title.slice(0, 300) || identifier,
      href: `${path}${query}`,
    });
  };
  if (organization) {
    for (const item of walk(organization)) {
      if (item.name === 'item' && item.attributes.identifierref) {
        addSco(
          item.attributes.identifier ?? item.attributes.identifierref,
          textOf(firstNamed(item, 'title')),
          item.attributes.identifierref,
        );
      }
    }
  }
  if (scos.length === 0 && problems.length === 0) {
    for (const [identifier] of resources) {
      addSco(identifier, identifier, identifier);
    }
  }
  if (problems.length > 0) {
    throw scormRule(`SCO trỏ tới tệp không có trong gói: ${problems.slice(0, 5).join(', ')}`, [
      { field: 'file', message: 'Bản kê trỏ tới tệp không có' },
    ]);
  }
  if (scos.length === 0) {
    throw scormRule('Gói không có SCO nào để chạy', [{ field: 'file', message: 'Không có SCO' }]);
  }
  if (new Set(scos.map((sco) => sco.identifier)).size !== scos.length) {
    throw scormRule('Bản kê có hai SCO trùng mã', [{ field: 'file', message: 'SCO trùng mã' }]);
  }
  const title =
    textOf(firstNamed(organization, 'title')) || scos[0]?.title || manifest.attributes.identifier || 'Gói SCORM';
  return { standard, title: title.slice(0, 300), scos };
}

// Gói hoàn chỉnh: tệp đã giải nén (đường dẫn, nội dung, kiểu) và bản kê
export function readScormPackage(buffer: Buffer) {
  const entries = readScormZip(buffer);
  const manifestBody = entries.get('imsmanifest.xml');
  if (!manifestBody) {
    throw scormRule('Gói không có imsmanifest.xml ở thư mục gốc', [{ field: 'file', message: 'Thiếu bản kê' }]);
  }
  const manifest = parseManifest(manifestBody.toString('utf8'), new Set(entries.keys()));
  return { manifest, entries };
}

// ---------- Mô hình dữ liệu CMI

export type CompletionValue = 'unknown' | 'not_attempted' | 'incomplete' | 'completed';
export type SuccessValue = 'unknown' | 'passed' | 'failed';

export interface AttemptState {
  completion: CompletionValue;
  success: SuccessValue;
  score: number | null;
  location: string | null;
  suspend_data: string | null;
}

export interface CommitInput {
  completion: CompletionValue | null;
  success: SuccessValue | null;
  score: number | null;
  location: string | null;
  suspend_data: string | null;
  session_seconds: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp10 = (value: number) => round2(Math.min(10, Math.max(0, value)));

// Thời gian SCORM 1.2 (`HHHH:MM:SS.SS`) hoặc 2004 (`PT1H2M3.5S`, có thể có ngày); sai dạng là 0
export function parseSessionTime(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const classic = /^(\d{1,4}):([0-5]?\d):([0-5]?\d(?:\.\d{1,2})?)$/.exec(value.trim());
  if (classic) {
    return Math.round(Number(classic[1]) * 3600 + Number(classic[2]) * 60 + Number(classic[3]));
  }
  const iso =
    /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      value.trim(),
    );
  if (!iso || value.trim() === 'P' || value.trim() === 'PT') return 0;
  const [years, months, days, hours, minutes, seconds] = iso.slice(1).map((part) => Number(part ?? 0));
  const total =
    (years ?? 0) * 31_536_000 +
    (months ?? 0) * 2_592_000 +
    (days ?? 0) * 86_400 +
    (hours ?? 0) * 3600 +
    (minutes ?? 0) * 60 +
    (seconds ?? 0);
  // Một phiên quá 24 giờ coi là sai, tính 24 giờ
  return Math.min(Math.round(total), 86_400);
}

function scoreOf(values: Record<string, string>, prefix: string): number | null {
  const scaled = Number.parseFloat(values[`${prefix}.scaled`] ?? '');
  if (prefix === 'cmi.score' && Number.isFinite(scaled)) {
    return clamp10(Math.max(0, scaled) * 10);
  }
  const raw = Number.parseFloat(values[`${prefix}.raw`] ?? '');
  if (!Number.isFinite(raw)) return null;
  const min = Number.parseFloat(values[`${prefix}.min`] ?? '');
  const max = Number.parseFloat(values[`${prefix}.max`] ?? '');
  const low = Number.isFinite(min) ? min : 0;
  const high = Number.isFinite(max) && max > low ? max : 100;
  return clamp10(((raw - low) / (high - low)) * 10);
}

// Giá trị gói gửi lên (khóa CMI là chuỗi) thành trạng thái chuẩn hóa; khóa lạ bỏ qua
export function normalizeCommit(standard: ScormStandard, raw: unknown): CommitInput {
  const values: Record<string, string> = {};
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number') values[key] = String(value);
    }
  }
  let completion: CompletionValue | null = null;
  let success: SuccessValue | null = null;
  let score: number | null;
  let location: string | undefined;
  let session: unknown;
  if (standard === '1.2') {
    const status = values['cmi.core.lesson_status']?.toLowerCase();
    if (status === 'passed' || status === 'failed') {
      completion = 'completed';
      success = status;
    } else if (status === 'completed') {
      completion = 'completed';
    } else if (status === 'incomplete' || status === 'browsed') {
      completion = 'incomplete';
    } else if (status === 'not attempted') {
      completion = 'not_attempted';
    }
    score = scoreOf(values, 'cmi.core.score');
    location = values['cmi.core.lesson_location'];
    session = values['cmi.core.session_time'];
  } else {
    const status = values['cmi.completion_status']?.toLowerCase();
    if (status === 'completed' || status === 'incomplete' || status === 'unknown') completion = status;
    if (status === 'not attempted') completion = 'not_attempted';
    const result = values['cmi.success_status']?.toLowerCase();
    if (result === 'passed' || result === 'failed' || result === 'unknown') success = result;
    score = scoreOf(values, 'cmi.score');
    location = values['cmi.location'];
    session = values['cmi.session_time'];
  }
  const suspend = values['cmi.suspend_data'];
  if (suspend !== undefined && suspend.length > SUSPEND_DATA_LIMIT[standard]) {
    throw scormRule(`Dữ liệu tạm của bài giảng quá ${SUSPEND_DATA_LIMIT[standard]} ký tự`);
  }
  return {
    completion,
    success,
    score,
    location: location === undefined ? null : location.slice(0, MAXIMUM_LOCATION),
    suspend_data: suspend ?? null,
    session_seconds: parseSessionTime(session),
  };
}

// Giá trị ban đầu cho bộ chuyển API trong khung (theo chuẩn của gói)
export function initialValues(
  standard: ScormStandard,
  learnerId: string,
  state: AttemptState | null,
): Record<string, string> {
  const resume = Boolean(state?.suspend_data || state?.location);
  const scoreText = state?.score === null || state?.score === undefined ? '' : String(state.score * 10);
  if (standard === '1.2') {
    const status =
      state?.success === 'passed' || state?.success === 'failed'
        ? state.success
        : state?.completion === 'completed'
          ? 'completed'
          : state?.completion === 'incomplete'
            ? 'incomplete'
            : 'not attempted';
    return {
      'cmi.core.student_id': learnerId,
      'cmi.core.student_name': 'Học sinh',
      'cmi.core.lesson_status': status,
      'cmi.core.entry': resume ? 'resume' : 'ab-initio',
      'cmi.core.credit': 'credit',
      'cmi.core.lesson_mode': 'normal',
      'cmi.core.lesson_location': state?.location ?? '',
      'cmi.core.score.raw': scoreText,
      'cmi.core.score.min': '0',
      'cmi.core.score.max': '100',
      'cmi.core.total_time': '0000:00:00',
      'cmi.suspend_data': state?.suspend_data ?? '',
      'cmi.launch_data': '',
    };
  }
  return {
    'cmi.learner_id': learnerId,
    'cmi.learner_name': 'Học sinh',
    'cmi.completion_status': state?.completion === 'not_attempted' ? 'not attempted' : (state?.completion ?? 'unknown'),
    'cmi.success_status': state?.success ?? 'unknown',
    'cmi.entry': resume ? 'resume' : 'ab-initio',
    'cmi.credit': 'credit',
    'cmi.mode': 'normal',
    'cmi.location': state?.location ?? '',
    'cmi.score.scaled': state?.score === null || state?.score === undefined ? '' : String(state.score / 10),
    'cmi.suspend_data': state?.suspend_data ?? '',
    'cmi.launch_data': '',
    'cmi.completion_threshold': '',
    'cmi.scaled_passing_score': '',
  };
}

// Kết quả hoạt động từ các SCO: chưa SCO nào chạy là chưa làm; đủ SCO hoàn thành thì hoàn thành; cách tính "đạt" cần mọi SCO
// đạt (hoặc điểm trung bình không dưới điểm đạt của hoạt động khi gói không báo đạt, chưa đạt)
export function activityResult(
  rule: CompletionRule,
  passScore: number | null,
  scoIdentifiers: string[],
  attempts: Array<{ sco_identifier: string; completion: CompletionValue; success: SuccessValue; score: number | null }>,
): { status: ResultStatus; score: number | null } {
  const mine = attempts.filter((attempt) => scoIdentifiers.includes(attempt.sco_identifier));
  const scores = mine.map((attempt) => attempt.score).filter((score): score is number => score !== null);
  const score = scores.length > 0 ? round2(scores.reduce((total, value) => total + value, 0) / scores.length) : null;
  if (mine.length === 0) {
    return { status: 'not_started', score };
  }
  const done = scoIdentifiers.every((identifier) => {
    const attempt = mine.find((item) => item.sco_identifier === identifier);
    return attempt?.completion === 'completed' || attempt?.success === 'passed' || attempt?.success === 'failed';
  });
  if (!done || rule === 'teacher' || rule === 'view') {
    return { status: done && rule === 'view' ? 'completed' : 'in_progress', score };
  }
  if (rule === 'pass') {
    const reported = mine.filter((attempt) => attempt.success !== 'unknown');
    const passed =
      reported.length > 0
        ? mine.every((attempt) => attempt.success !== 'failed') && reported.length === scoIdentifiers.length
        : passScore !== null && score !== null && score >= passScore;
    return { status: passed ? 'passed' : 'failed', score };
  }
  return { status: 'completed', score };
}

// ---------- Mã truy cập gói

export interface LaunchClaims {
  // Trường (chế độ nhiều trường) hoặc `single`
  s: string;
  // Gói, hoạt động (trống khi xem trước), học sinh (trống khi xem trước)
  p: string;
  a: string | null;
  c: string | null;
  // Nguồn gốc của trang cha nhận postMessage
  o: string;
  e: number;
}

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

export function signLaunch(key: Buffer, claims: LaunchClaims): string {
  const payload = base64url(JSON.stringify(claims));
  const signature = createHmac('sha256', key).update(`scorm-launch.${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyLaunch(key: Buffer, token: string, nowSeconds: number): LaunchClaims | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac('sha256', key).update(`scorm-launch.${payload}`).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as LaunchClaims;
    return typeof claims.e === 'number' && claims.e > nowSeconds ? claims : null;
  } catch {
    return null;
  }
}

// ---------- Phát gói

// CSP của mọi tệp trong gói: tài liệu luôn ở nguồn gốc riêng (sandbox không có allow-same-origin), chỉ nạp từ chính gói (`self`),
// không gửi biểu mẫu, không nhúng trang ngoài, không gọi máy chủ ngoài
export function contentSecurityPolicy(frameAncestors: string): string {
  return [
    'sandbox allow-scripts',
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "form-action 'none'",
    "base-uri 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join('; ');
}

const SHIM = `(function(){var d=__DATA__;var v=d.values,ch={},init=false,done=false,err='0',t0=Date.now();
function send(type){try{parent.postMessage({source:'school-management-scorm',type:type,sco:d.sco,values:ch},d.origin);}catch(e){}if(type!=='set'){ch={};}}
function stamp(){var s=Math.round((Date.now()-t0)/1000);if(d.standard==='1.2'){var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h<10?'000':h<100?'00':h<1000?'0':'')+h+':'+(m<10?'0':'')+m+':'+(x<10?'0':'')+x;}return 'PT'+s+'S';}
function get(k){if(!init||done){err='301';return '';}err='0';if(k.slice(-9)==='._children'){return '';}if(k.slice(-7)==='._count'){return '0';}if(Object.prototype.hasOwnProperty.call(v,k)){return String(v[k]);}err=d.standard==='1.2'?'201':'401';return '';}
function set(k,x){if(!init||done){err=d.standard==='1.2'?'301':'132';return 'false';}if(/student_id|student_name|learner_id|learner_name|\\.entry$|credit|mode$|total_time/.test(k)){err=d.standard==='1.2'?'403':'404';return 'false';}x=String(x);v[k]=x;ch[k]=x;err='0';send('set');return 'true';}
function start(){if(done){err=d.standard==='1.2'?'101':'104';return 'false';}init=true;err='0';send('initialize');return 'true';}
function commit(){if(!init){err='301';return 'false';}err='0';send('commit');return 'true';}
function finish(){if(!init||done){err='301';return 'false';}var k=d.standard==='1.2'?'cmi.core.session_time':'cmi.session_time';if(!ch[k]&&!v.__time){ch[k]=stamp();}done=true;err='0';send('finish');return 'true';}
function last(){return err;}function text(c){return c==='0'?'No error':'Error '+c;}function diag(){return '';}
window.API={LMSInitialize:start,LMSGetValue:get,LMSSetValue:set,LMSCommit:commit,LMSFinish:finish,LMSGetLastError:last,LMSGetErrorString:text,LMSGetDiagnostic:diag};
window.API_1484_11={Initialize:start,GetValue:get,SetValue:set,Commit:commit,Terminate:finish,GetLastError:last,GetErrorString:text,GetDiagnostic:diag};
window.addEventListener('pagehide',function(){if(init&&!done){finish();}});})();`;

// Mã bộ chuyển API gắn vào đầu trang SCO; dữ liệu ban đầu là JSON đã thoát `<` để không đóng thẻ script
export function shimScript(data: {
  standard: ScormStandard;
  sco: string;
  origin: string;
  values: Record<string, string>;
}): string {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<script>${SHIM.replace('__DATA__', json)}</script>`;
}

// Gắn bộ chuyển API ngay sau thẻ <head> (không có thì đầu tài liệu) để chạy trước mọi mã của gói
export function injectShim(html: string, script: string): string {
  const head = /<head[^>]*>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return `${html.slice(0, at)}${script}${html.slice(at)}`;
  }
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  const at = doctype ? doctype[0].length : 0;
  return `${html.slice(0, at)}${script}${html.slice(at)}`;
}
