import { crc32, deflateRawSync } from 'node:zlib';

// Ghi tệp ZIP (định dạng PKWARE APPNOTE, nén deflate, tên tệp UTF-8) cho gói toàn bộ dữ liệu của trường (DT-18 phần 18h).
// Viết riêng để không thêm thư viện; chưa dùng ZIP64 nên mỗi tệp và cả gói phải nhỏ hơn 4 GB, tối đa 65 535 tệp
const MAXIMUM_ENTRIES = 0xffff;
const MAXIMUM_BYTES = 0xffffffff;
const UTF8_FLAG = 0x0800;
const DEFLATE = 8;
const STORE = 0;

interface CentralEntry {
  name: Buffer;
  crc: number;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

export class ZipWriter {
  private readonly chunks: Buffer[] = [];
  private readonly entries: CentralEntry[] = [];
  private offset = 0;

  constructor(private readonly modifiedAt: Date = new Date()) {}

  get entryCount(): number {
    return this.entries.length;
  }

  get byteLength(): number {
    return this.offset;
  }

  add(name: string, content: Buffer | string): void {
    const data = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    if (this.entries.length >= MAXIMUM_ENTRIES) {
      throw new Error('Gói ZIP vượt số tệp tối đa');
    }
    const nameBuffer = Buffer.from(name.replaceAll('\\', '/'), 'utf8');
    const deflated = deflateRawSync(data);
    // Tệp đã nén sẵn (ảnh, PDF) nén lại không nhỏ hơn thì lưu nguyên
    const method = deflated.length < data.length ? DEFLATE : STORE;
    const stored = method === DEFLATE ? deflated : data;
    if (this.offset + stored.length > MAXIMUM_BYTES) {
      throw new Error('Gói ZIP vượt 4 GB');
    }
    const { time, date } = dosDateTime(this.modifiedAt);
    const entry: CentralEntry = {
      name: nameBuffer,
      crc: crc32(data) >>> 0,
      method,
      compressedSize: stored.length,
      size: data.length,
      offset: this.offset,
      time,
      date,
    };
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(UTF8_FLAG, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(entry.crc, 14);
    header.writeUInt32LE(entry.compressedSize, 18);
    header.writeUInt32LE(entry.size, 22);
    header.writeUInt16LE(nameBuffer.length, 26);
    header.writeUInt16LE(0, 28);
    this.push(header, nameBuffer, stored);
    this.entries.push(entry);
  }

  finish(): Buffer {
    const centralOffset = this.offset;
    for (const entry of this.entries) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(20, 6);
      header.writeUInt16LE(UTF8_FLAG, 8);
      header.writeUInt16LE(entry.method, 10);
      header.writeUInt16LE(entry.time, 12);
      header.writeUInt16LE(entry.date, 14);
      header.writeUInt32LE(entry.crc, 16);
      header.writeUInt32LE(entry.compressedSize, 20);
      header.writeUInt32LE(entry.size, 24);
      header.writeUInt16LE(entry.name.length, 28);
      header.writeUInt32LE(entry.offset, 42);
      this.push(header, entry.name);
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(this.offset - centralOffset, 12);
    end.writeUInt32LE(centralOffset, 16);
    this.push(end);
    return Buffer.concat(this.chunks);
  }

  private push(...buffers: Buffer[]): void {
    for (const buffer of buffers) {
      this.chunks.push(buffer);
      this.offset += buffer.length;
    }
  }
}

// Giờ trong ZIP theo kiểu MS-DOS, lấy giờ Việt Nam
function dosDateTime(moment: Date): { time: number; date: number } {
  const local = new Date(moment.getTime() + 7 * 60 * 60_000);
  const year = Math.max(1980, local.getUTCFullYear());
  return {
    time: (local.getUTCHours() << 11) | (local.getUTCMinutes() << 5) | Math.floor(local.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((local.getUTCMonth() + 1) << 5) | local.getUTCDate(),
  };
}

// Đọc lại gói ZIP (dùng trong kiểm thử): tên tệp và nội dung đã giải nén
export async function readZipEntries(buffer: Buffer): Promise<Map<string, Buffer>> {
  const { inflateRawSync } = await import('node:zlib');
  const entries = new Map<string, Buffer>();
  const endOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(endOffset + 10);
  let position = buffer.readUInt32LE(endOffset + 16);
  for (let index = 0; index < count; index += 1) {
    const method = buffer.readUInt16LE(position + 10);
    const compressedSize = buffer.readUInt32LE(position + 20);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const localOffset = buffer.readUInt32LE(position + 42);
    const name = buffer.subarray(position + 46, position + 46 + nameLength).toString('utf8');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(start, start + compressedSize);
    entries.set(name, method === DEFLATE ? inflateRawSync(data) : Buffer.from(data));
    position += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
