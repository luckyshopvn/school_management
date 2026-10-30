import type { AiPromptImage } from '../ai-assistant/ai-provider.js';

// Quy tắc thuần của ảnh bài tập gửi gia sư AI (YCTD-383 lát L4; Q5 của Eric: chỉ gói Nâng cao, ảnh xóa sau 30 ngày). Không đọc cơ sở dữ
// liệu: nhận diện định dạng theo byte đầu (không tin phần mở rộng hay kiểu trình duyệt gửi), bỏ siêu dữ liệu (vị trí, thông tin máy
// chụp, chú thích) trước khi lưu và gửi đi, mốc xóa ảnh 30 ngày

export const IMAGE_MAX_COUNT = 3;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGE_RETENTION_DAYS = 30;
export const IMAGE_TEXT_MAX_LENGTH = 2000;

export type TutorImageType = AiPromptImage['mediaType'];

export const IMAGE_TYPE_LABEL = 'JPEG, PNG hoặc WebP';

const startsWith = (body: Buffer, bytes: readonly number[], offset = 0) =>
  body.length >= offset + bytes.length && bytes.every((byte, index) => body[offset + index] === byte);

const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));

export function detectImageType(body: Buffer): TutorImageType | null {
  if (startsWith(body, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(body, ascii('RIFF')) && startsWith(body, ascii('WEBP'), 8)) {
    return 'image/webp';
  }
  return null;
}

// JPEG: bỏ đoạn APP1 (EXIF, XMP, có vị trí chụp), APP13 (IPTC), các APP khác và chú thích; giữ APP0 (JFIF), APP2 (hồ sơ màu), APP14
// (Adobe, cần để giải mã đúng màu). Đọc tới đoạn bắt đầu dữ liệu ảnh (SOS) rồi chép nguyên phần còn lại
const JPEG_KEPT_APP = new Set([0xe0, 0xe2, 0xee]);

function stripJpeg(body: Buffer): Buffer | null {
  const parts: Buffer[] = [body.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= body.length) {
    if (body[offset] !== 0xff) {
      return null;
    }
    const marker = body[offset + 1] as number;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd9) {
      parts.push(body.subarray(offset, offset + 2));
      return Buffer.concat(parts);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(body.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = body.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > body.length) {
      return null;
    }
    if (marker === 0xda) {
      parts.push(body.subarray(offset));
      return Buffer.concat(parts);
    }
    const dropped = marker === 0xfe || (marker >= 0xe1 && marker <= 0xef && !JPEG_KEPT_APP.has(marker));
    if (!dropped) {
      parts.push(body.subarray(offset, end));
    }
    offset = end;
  }
  return null;
}

// PNG: bỏ khối chữ (tEXt, zTXt, iTXt), EXIF (eXIf) và thời điểm (tIME); khối khác giữ nguyên kèm mã kiểm tra
const PNG_DROPPED = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(body: Buffer): Buffer | null {
  const parts: Buffer[] = [body.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= body.length) {
    const length = body.readUInt32BE(offset);
    const type = body.toString('latin1', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > body.length) {
      return null;
    }
    if (!PNG_DROPPED.has(type)) {
      parts.push(body.subarray(offset, end));
    }
    offset = end;
    if (type === 'IEND') {
      return Buffer.concat(parts);
    }
  }
  return null;
}

// WebP: bỏ khối EXIF, XMP; xóa cờ EXIF, XMP ở khối VP8X; tính lại độ dài RIFF
function stripWebp(body: Buffer): Buffer | null {
  if (body.length < 12) {
    return null;
  }
  const declared = body.readUInt32LE(4) + 8;
  const total = Math.min(declared, body.length);
  const parts: Buffer[] = [];
  let offset = 12;
  while (offset + 8 <= total) {
    const fourcc = body.toString('latin1', offset, offset + 4);
    const size = body.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (offset + 8 + size > total) {
      return null;
    }
    if (fourcc === 'VP8X') {
      const chunk = Buffer.from(body.subarray(offset, Math.min(end, total)));
      chunk[8] = (chunk[8] as number) & ~0x0c;
      parts.push(chunk);
    } else if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      parts.push(body.subarray(offset, Math.min(end, total)));
    }
    offset = end;
  }
  if (parts.length === 0) {
    return null;
  }
  const payload = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(payload.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, payload]);
}

// Ảnh hỏng cấu trúc trả null (máy chủ từ chối ảnh)
export function stripImageMetadata(body: Buffer, type: TutorImageType): Buffer | null {
  return type === 'image/jpeg' ? stripJpeg(body) : type === 'image/png' ? stripPng(body) : stripWebp(body);
}

export interface IncomingImage {
  originalName: string;
  size: number;
  buffer: Buffer;
}

export type ImageCheck = { ok: true; images: AiPromptImage[] } | { ok: false; field: 'images'; message: string };

// Kiểm số ảnh, cỡ ảnh, định dạng; trả ảnh đã bỏ siêu dữ liệu theo thứ tự em chọn
export function checkTutorImages(files: readonly IncomingImage[]): ImageCheck {
  if (files.length > IMAGE_MAX_COUNT) {
    return { ok: false, field: 'images', message: `Mỗi câu hỏi gửi tối đa ${IMAGE_MAX_COUNT} ảnh` };
  }
  const images: AiPromptImage[] = [];
  for (const [index, file] of files.entries()) {
    const label = files.length > 1 ? `Ảnh thứ ${index + 1}` : 'Ảnh';
    if (file.size === 0 || file.buffer.length === 0) {
      return { ok: false, field: 'images', message: `${label} trống` };
    }
    if (file.buffer.length > IMAGE_MAX_BYTES) {
      return { ok: false, field: 'images', message: `${label} vượt ${IMAGE_MAX_BYTES / 1024 / 1024} MB` };
    }
    const type = detectImageType(file.buffer);
    if (!type) {
      return { ok: false, field: 'images', message: `${label} phải là ảnh ${IMAGE_TYPE_LABEL}` };
    }
    const cleaned = stripImageMetadata(file.buffer, type);
    if (!cleaned) {
      return { ok: false, field: 'images', message: `${label} bị hỏng, em chụp lại nhé` };
    }
    images.push({ mediaType: type, data: cleaned });
  }
  return { ok: true, images };
}

// Mốc xóa ảnh: ảnh gửi từ đủ 30 ngày trước trở về trước thì xóa (gửi lúc t thì xóa ở lần chạy đầu tiên từ t + 30 ngày)
export function imageRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export const IMAGE_DELETED_LABEL = 'Ảnh đã xóa sau 30 ngày';
