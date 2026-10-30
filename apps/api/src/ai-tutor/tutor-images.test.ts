import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkTutorImages,
  detectImageType,
  IMAGE_MAX_BYTES,
  imageRetentionCutoff,
  stripImageMetadata,
} from './tutor-images.js';

// Quy tắc thuần của ảnh bài tập (YCTD-383 lát L4), kịch bản CT-1940: nhận diện định dạng theo byte đầu, bỏ siêu dữ liệu JPEG, PNG,
// WebP, số ảnh, cỡ ảnh, mốc xóa 30 ngày. Ảnh dựng bằng byte giả, không có ảnh thật
const segment = (marker: number, payload: Buffer) => {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
};

function sampleJpeg(extra = 'TOA-DO-GPS-THU'): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    segment(0xe1, Buffer.from(`Exif\0\0${extra}`, 'latin1')),
    segment(0xfe, Buffer.from('CHU-THICH-THU', 'latin1')),
    segment(0xdb, Buffer.alloc(65, 1)),
    segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.from([0x12, 0x34, 0x56, 0xff, 0xd9]),
  ]);
}

const pngChunk = (type: string, data: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
};

function samplePng(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.alloc(13, 1)),
    pngChunk('tEXt', Buffer.from('Author\0Nguoi Thu', 'latin1')),
    pngChunk('eXIf', Buffer.from('GPS-THU', 'latin1')),
    pngChunk('IDAT', Buffer.alloc(10, 2)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const webpChunk = (fourcc: string, data: Buffer) => {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length, 0);
  return Buffer.concat([
    Buffer.from(fourcc, 'latin1'),
    size,
    data,
    data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
};

function sampleWebp(): Buffer {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x0c;
  const payload = Buffer.concat([
    webpChunk('VP8X', vp8x),
    webpChunk('VP8 ', Buffer.alloc(11, 3)),
    webpChunk('EXIF', Buffer.from('GPS-THU', 'latin1')),
    webpChunk('XMP ', Buffer.from('<xmp>Nguoi Thu</xmp>', 'latin1')),
  ]);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(payload.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, payload]);
}

describe('Gia sư AI: quy tắc ảnh bài tập', () => {
  it('CT-1940: nhận diện JPEG, PNG, WebP theo byte đầu; GIF, PDF, chữ thì không nhận', () => {
    assert.equal(detectImageType(sampleJpeg()), 'image/jpeg');
    assert.equal(detectImageType(samplePng()), 'image/png');
    assert.equal(detectImageType(sampleWebp()), 'image/webp');
    assert.equal(detectImageType(Buffer.from('GIF89a......', 'latin1')), null);
    assert.equal(detectImageType(Buffer.from('%PDF-1.7', 'latin1')), null);
    assert.equal(detectImageType(Buffer.from('xin chao')), null);
  });

  it('CT-1940: bỏ siêu dữ liệu: JPEG mất APP1 và chú thích, PNG mất khối chữ và EXIF, WebP mất EXIF, XMP và cờ', () => {
    const jpeg = stripImageMetadata(sampleJpeg(), 'image/jpeg');
    assert.ok(jpeg);
    assert.doesNotMatch(jpeg.toString('latin1'), /Exif|TOA-DO-GPS|CHU-THICH/);
    assert.match(jpeg.toString('latin1'), /JFIF/);
    assert.deepEqual([...jpeg.subarray(-2)], [0xff, 0xd9]);

    const png = stripImageMetadata(samplePng(), 'image/png');
    assert.ok(png);
    assert.doesNotMatch(png.toString('latin1'), /Nguoi Thu|GPS-THU/);
    assert.match(png.toString('latin1'), /IHDR[\s\S]*IDAT[\s\S]*IEND/);

    const webp = stripImageMetadata(sampleWebp(), 'image/webp');
    assert.ok(webp);
    assert.doesNotMatch(webp.toString('latin1'), /GPS-THU|Nguoi Thu/);
    assert.equal(webp.readUInt32LE(4), webp.length - 8);
    assert.equal((webp[20] as number) & 0x0c, 0);
  });

  it('CT-1940: ảnh hỏng cấu trúc bị từ chối', () => {
    const broken = sampleJpeg().subarray(0, 30);
    assert.equal(stripImageMetadata(broken, 'image/jpeg'), null);
    const result = checkTutorImages([{ originalName: 'a.jpg', size: broken.length, buffer: broken }]);
    assert.equal(result.ok, false);
  });

  it('CT-1940: tối đa 3 ảnh, mỗi ảnh tối đa 4 MB, sai loại báo rõ', () => {
    const image = { originalName: 'a.jpg', size: 10, buffer: sampleJpeg() };
    assert.equal(checkTutorImages([image, image, image]).ok, true);
    const four = checkTutorImages([image, image, image, image]);
    assert.deepEqual(four, { ok: false, field: 'images', message: 'Mỗi câu hỏi gửi tối đa 3 ảnh' });
    const big = Buffer.concat([sampleJpeg(), Buffer.alloc(IMAGE_MAX_BYTES)]);
    const oversize = checkTutorImages([{ originalName: 'b.jpg', size: big.length, buffer: big }]);
    assert.equal(oversize.ok, false);
    assert.match((oversize as { message: string }).message, /vượt 4 MB/);
    const gif = Buffer.from('GIF89a......', 'latin1');
    const wrong = checkTutorImages([image, { originalName: 'c.gif', size: gif.length, buffer: gif }]);
    assert.deepEqual(wrong, { ok: false, field: 'images', message: 'Ảnh thứ 2 phải là ảnh JPEG, PNG hoặc WebP' });
  });

  it('CT-1940: mốc xóa ảnh là đúng 30 ngày trước', () => {
    const now = new Date('2026-10-30T03:00:00Z');
    assert.equal(imageRetentionCutoff(now).toISOString(), '2026-09-30T03:00:00.000Z');
  });
});
