import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generatePackageCode,
  generateTransferPassword,
  jsonPart,
  openTransferPackage,
  readJsonPart,
  readTransferPackageHeader,
  sealTransferPackage,
  TRANSFER_PACKAGE_FORMAT,
} from './transfer-package-rules.js';

const manifest = {
  package_code: 'GCT-20270116-ABC123',
  kind: 'chuyen-truong' as const,
  created_at: '2027-01-16T02:00:00.000Z',
  source_school: { name: 'Trường thử A', code: 'thu-a' },
  destination: { school_name: 'Trường thử B', province_name: null, ward_name: null },
  transfer_date: '2027-01-20',
  reason: null,
  approved_by_name: 'Hiệu trưởng thử',
  student: { full_name: 'Học sinh thử', dob: '2018-03-12', moet_student_code: null },
  consent: null,
};

const files = () =>
  new Map<string, Buffer>([
    ['hoc-sinh.json', jsonPart({ full_name: 'Học sinh thử' })],
    ['ho-so-82-cot.xlsx', Buffer.from('tep-82-cot-gia-lap')],
    ['hoc-ba/1.pdf', Buffer.from('%PDF-gia-lap')],
  ]);

describe('Gói chuyển trường (YCTD-390, BR-480)', () => {
  it('CT-1860: đóng gói rồi mở lại đúng mật khẩu ra đúng các phần, mã băm; mật khẩu không phân biệt hoa thường, dấu gạch', () => {
    const password = generateTransferPassword();
    assert.match(password, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    const sealed = sealTransferPackage(manifest, files(), password);
    assert.equal(sealed.manifest.format, TRANSFER_PACKAGE_FORMAT);
    assert.equal(sealed.manifest.parts.length, 3);
    assert.equal(readTransferPackageHeader(sealed.body).package_code, manifest.package_code);
    assert.ok(!sealed.body.includes(Buffer.from('Học sinh thử')), 'nội dung không được ở dạng rõ');
    const opened = openTransferPackage(sealed.body, password.toLowerCase().replace(/-/g, ' '));
    assert.equal(opened.sha256, sealed.sha256);
    assert.deepEqual(readJsonPart(opened, 'hoc-sinh.json'), { full_name: 'Học sinh thử' });
    assert.equal(opened.files.get('hoc-ba/1.pdf')?.toString(), '%PDF-gia-lap');
  });

  it('CT-1861: sai mật khẩu, sửa một byte, không phải gói, định dạng lạ đều bị từ chối', () => {
    const password = generateTransferPassword();
    const sealed = sealTransferPackage(manifest, files(), password);
    assert.throws(() => openTransferPackage(sealed.body, 'SAI1-SAI2-SAI3-SAI4'), /Mật khẩu không đúng/);
    const tampered = Buffer.from(sealed.body);
    const position = tampered.length - 20;
    tampered.writeUInt8(tampered.readUInt8(position) ^ 0xff, position);
    assert.throws(() => openTransferPackage(tampered, password), /Mật khẩu không đúng hoặc gói đã bị sửa/);
    assert.throws(() => openTransferPackage(Buffer.from('khong phai goi'), password), /không phải gói chuyển trường/);
    const strange = Buffer.from(sealed.body);
    const at = strange.indexOf(Buffer.from('/1"'));
    strange.write('/9"', at);
    assert.throws(() => readTransferPackageHeader(strange), /Không đọc được định dạng gói/);
  });

  it('CT-1862: gói thiếu hồ sơ học sinh bị từ chối; mã gói theo mẫu GCT-ngày-6 ký tự', () => {
    const password = generateTransferPassword();
    const sealed = sealTransferPackage(manifest, new Map([['hoc-ba/1.pdf', Buffer.from('x')]]), password);
    assert.throws(() => openTransferPackage(sealed.body, password), /Gói thiếu hồ sơ học sinh/);
    assert.match(generatePackageCode(new Date('2027-01-16T02:00:00Z')), /^GCT-20270116-[0-9A-Z]{6}$/);
  });
});
