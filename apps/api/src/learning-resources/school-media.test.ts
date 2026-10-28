import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectResourceFileType } from './learning-resource-rules.js';

// Bài hát, câu chuyện của trường (DT-29 phần 29e, YCTD-329): kho học liệu nhận tệp âm thanh theo chữ ký đầu tệp
describe('Kho học liệu: tệp âm thanh', () => {
  it('CT-29e-1: nhận MP3 (thẻ ID3, khung MPEG lớp III), M4A, WAV, OGG; MP4 video vẫn là video; tệp đổi tên không nhận', () => {
    const id3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0]);
    const frame = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
    const m4a = Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
    const mp4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
    const wav = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    const riffOther = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]);
    const ogg = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0, 2]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    assert.deepEqual(
      [
        detectResourceFileType('bai-hat.mp3', id3),
        detectResourceFileType('bai-hat.mp3', frame),
        detectResourceFileType('ke-chuyen.m4a', m4a),
        detectResourceFileType('video.mp4', mp4),
        detectResourceFileType('ghi-am.wav', wav),
        detectResourceFileType('phim.avi', riffOther),
        detectResourceFileType('bai-hat.ogg', ogg),
        detectResourceFileType('anh.mp3', jpeg),
        detectResourceFileType('gia.mp3', Buffer.from('khong phai am thanh')),
      ],
      [
        'audio/mpeg',
        'audio/mpeg',
        'audio/mp4',
        'video/mp4',
        'audio/wav',
        undefined,
        'audio/ogg',
        'image/jpeg',
        undefined,
      ],
    );
  });
});
