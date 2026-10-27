import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ZipWriter } from '../../school-data-export/zip-writer.js';
import {
  activityResult,
  contentSecurityPolicy,
  initialValues,
  injectShim,
  normalizeCommit,
  parseSessionTime,
  readScormPackage,
  shimScript,
  signLaunch,
  verifyLaunch,
} from './scorm-rules.js';
import { readCoursePackage, buildCoursePackage, remapContent, COURSE_PACKAGE_FORMAT } from './course-package-rules.js';

// Quy tắc thuần của gói SCORM, gói khoá học (DT-28 phần 28h, YCTD-278)
const MANIFEST_12 = `<?xml version="1.0"?>
<manifest identifier="goi-thu" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG"><organization identifier="ORG"><title>Phân số &amp; số thập phân</title>
    <item identifier="I1" identifierref="R1"><title>Bài 1</title></item>
  </organization></organizations>
  <resources><resource identifier="R1" type="webcontent" adlcp:scormtype="sco" href="bai1/index.html?trang=1"><file href="bai1/index.html"/></resource></resources>
</manifest>`;

const MANIFEST_2004 = `<manifest identifier="m" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
  <metadata><schemaversion>2004 4th Edition</schemaversion></metadata>
  <organizations default="O"><organization identifier="O"><title>Khoá 2004</title>
    <item identifier="A" identifierref="RA"><title>Phần A</title></item>
    <item identifier="G"><title>Nhóm</title><item identifier="B" identifierref="RB"><title>Phần B</title></item></item>
  </organization></organizations>
  <resources xml:base="noi-dung/">
    <resource identifier="RA" adlcp:scormType="sco" href="a.html"/>
    <resource identifier="RB" adlcp:scormType="sco" href="b%20c.html"/>
    <resource identifier="ASSET" adlcp:scormType="asset" href="chung.js"/>
  </resources>
</manifest>`;

function zip(files: Record<string, string>) {
  const writer = new ZipWriter();
  for (const [name, content] of Object.entries(files)) writer.add(name, content);
  return writer.finish();
}

describe('Quy tắc gói SCORM', () => {
  it('CT-28h-1: đọc gói zip, chặn đường dẫn thoát thư mục, loại tệp không cho phép, thiếu bản kê, SCO trỏ tới tệp không có', () => {
    const good = readScormPackage(
      zip({
        'imsmanifest.xml': MANIFEST_12,
        'bai1/index.html': '<html><head></head><body>Bài</body></html>',
        'bai1/a.js': 'x',
      }),
    );
    assert.equal(good.manifest.standard, '1.2');
    assert.equal(good.manifest.title, 'Phân số & số thập phân');
    assert.deepEqual(good.manifest.scos, [{ identifier: 'I1', title: 'Bài 1', href: 'bai1/index.html?trang=1' }]);
    assert.equal(good.entries.size, 3);
    const rejects = (files: Record<string, string>, pattern: RegExp) =>
      assert.throws(
        () => readScormPackage(zip(files)),
        (error: unknown) => pattern.test((error as Error).message),
      );
    rejects({ 'imsmanifest.xml': MANIFEST_12, 'bai1/index.html': 'x', '../../ngoai.html': 'x' }, /thoát thư mục/);
    rejects({ 'imsmanifest.xml': MANIFEST_12, 'bai1/index.html': 'x', 'cai-dat.exe': 'x' }, /loại tệp không cho phép/);
    rejects({ 'bai1/index.html': 'x' }, /imsmanifest\.xml/);
    rejects({ 'imsmanifest.xml': MANIFEST_12 }, /không có trong gói/);
    assert.throws(() => readScormPackage(Buffer.from('khong phai zip')), /không phải gói zip/);
  });

  it('CT-28h-2: SCORM 2004 nhiều SCO theo thứ tự của tổ chức mặc định, xml:base, tên tệp có dấu cách; bỏ tài nguyên asset', () => {
    const pkg = readScormPackage(
      zip({
        'imsmanifest.xml': MANIFEST_2004,
        'noi-dung/a.html': 'a',
        'noi-dung/b c.html': 'b',
        'noi-dung/chung.js': '',
      }),
    );
    assert.equal(pkg.manifest.standard, '2004');
    assert.equal(pkg.manifest.title, 'Khoá 2004');
    assert.deepEqual(
      pkg.manifest.scos.map((sco) => [sco.identifier, sco.href]),
      [
        ['A', 'noi-dung/a.html'],
        ['B', 'noi-dung/b c.html'],
      ],
    );
  });

  it('CT-28h-3: mô hình dữ liệu: trạng thái, điểm về thang 10, thời gian phiên, dữ liệu tạm có giới hạn; kết quả hoạt động', () => {
    const classic = normalizeCommit('1.2', {
      'cmi.core.lesson_status': 'passed',
      'cmi.core.score.raw': '80',
      'cmi.core.score.max': '100',
      'cmi.core.session_time': '0000:12:30.5',
      'cmi.suspend_data': 'trang=4',
      'cmi.khac': 'bỏ qua',
    });
    assert.deepEqual(classic, {
      completion: 'completed',
      success: 'passed',
      score: 8,
      location: null,
      suspend_data: 'trang=4',
      session_seconds: 751,
    });
    const modern = normalizeCommit('2004', {
      'cmi.completion_status': 'incomplete',
      'cmi.success_status': 'unknown',
      'cmi.score.scaled': '0.655',
      'cmi.session_time': 'PT1H2M3S',
      'cmi.location': 'muc-2',
    });
    assert.equal(modern.score, 6.55);
    assert.equal(modern.session_seconds, 3723);
    assert.equal(modern.completion, 'incomplete');
    assert.equal(parseSessionTime('khong hop le'), 0);
    assert.equal(parseSessionTime('P3D'), 86_400, 'một phiên tối đa 24 giờ');
    assert.throws(() => normalizeCommit('1.2', { 'cmi.suspend_data': 'x'.repeat(4097) }), /4096/);
    const scos = ['A', 'B'];
    assert.equal(activityResult('submit', null, scos, []).status, 'not_started');
    assert.equal(
      activityResult('submit', null, scos, [
        { sco_identifier: 'A', completion: 'completed', success: 'unknown', score: 9 },
      ]).status,
      'in_progress',
    );
    const both = [
      { sco_identifier: 'A', completion: 'completed' as const, success: 'passed' as const, score: 9 },
      { sco_identifier: 'B', completion: 'completed' as const, success: 'failed' as const, score: 4 },
    ];
    assert.deepEqual(activityResult('submit', null, scos, both), { status: 'completed', score: 6.5 });
    assert.equal(activityResult('pass', null, scos, both).status, 'failed');
    const unreported = both.map((row) => ({ ...row, success: 'unknown' as const }));
    assert.equal(activityResult('pass', 6, scos, unreported).status, 'passed', 'gói không báo đạt thì so điểm đạt');
    assert.equal(activityResult('teacher', null, scos, both).status, 'in_progress');
    const resumed = initialValues('1.2', 'an-danh', {
      completion: 'incomplete',
      success: 'unknown',
      score: null,
      location: 'trang-3',
      suspend_data: 'x',
    });
    assert.equal(resumed['cmi.core.entry'], 'resume');
    assert.equal(resumed['cmi.core.student_name'], 'Học sinh', 'gói không biết tên thật');
  });

  it('CT-28h-4: mã truy cập ký HMAC có hạn, sai chữ ký hoặc hết hạn thì không mở; CSP sandbox, chỉ nạp từ gói; gắn bộ chuyển API', () => {
    const key = Buffer.alloc(32, 7);
    const claims = { s: 'truong-a', p: 'goi', a: 'hoat-dong', c: 'em', o: 'https://a.example', e: 1000 };
    const token = signLaunch(key, claims);
    assert.deepEqual(verifyLaunch(key, token, 999), claims);
    assert.equal(verifyLaunch(key, token, 1000), null, 'hết hạn');
    assert.equal(verifyLaunch(Buffer.alloc(32, 8), token, 1), null, 'khóa khác');
    const forged = `${Buffer.from(JSON.stringify({ ...claims, s: 'truong-b' })).toString('base64url')}.${token.split('.')[1]}`;
    assert.equal(verifyLaunch(key, forged, 1), null, 'sửa mã trường thì sai chữ ký');
    const policy = contentSecurityPolicy("'self'");
    assert.match(policy, /^sandbox allow-scripts;/);
    assert.match(policy, /script-src 'self' 'unsafe-inline' 'unsafe-eval';/);
    assert.match(policy, /connect-src 'self';/);
    assert.match(policy, /frame-ancestors 'self'$/);
    const script = shimScript({
      standard: '2004',
      sco: 'A',
      origin: 'https://a.example',
      values: { 'cmi.location': '</script>' },
    });
    assert.ok(!script.slice(8, -9).includes('</script>'), 'dữ liệu không đóng được thẻ script');
    const html = injectShim(
      '<!DOCTYPE html><html><head><title>x</title><script src="goi.js"></script></head></html>',
      script,
    );
    assert.ok(html.indexOf('API_1484_11') < html.indexOf('goi.js'), 'bộ chuyển API chạy trước mã của gói');
    assert.ok(injectShim('<p>khong head</p>', '<script></script>').startsWith('<script></script>'));
  });

  it('CT-28h-5: gói khoá học: đọc, kiểm mã băm từng học liệu, nối lại mã học liệu, bỏ hoạt động có học liệu không nhập được', () => {
    const content = {
      sections: [
        {
          key: 'c1',
          title: 'Chương 1',
          planned_week: null,
          items: [
            { key: 'a', kind: 'scorm', title: 'Gói', settings: { resource_id: 'r1' } },
            { key: 'b', kind: 'resource', title: 'Phiếu', settings: { resource_id: 'r2' } },
            { key: 'c', kind: 'page', title: 'Trang', settings: { body: 'x' } },
          ],
        },
      ],
    } as never;
    const buffer = buildCoursePackage({
      format: COURSE_PACKAGE_FORMAT,
      package_code: 'KHOA-1',
      source_school: 'Trường A',
      created_at: '2026-10-28T00:00:00Z',
      template: {
        title: 'Khoá mẫu',
        description: null,
        school_level: 'THCS',
        grade_level_code: null,
        subject_code: null,
        subject_name: null,
        content,
      },
      resources: [
        {
          ref: 'r2',
          scorm: false,
          title: 'Phiếu',
          description: null,
          type_code: 'worksheet',
          school_level: null,
          grade_level_code: null,
          subject_code: null,
          subject_name: null,
          keywords: [],
          author_name: null,
          language: 'vi',
          duration_minutes: null,
          license_code: 'SELF',
          license_source: null,
          origin: null,
          kind: 'file',
          file_name: 'phieu.pdf',
          content_type: 'application/pdf',
          sha256: 'sai',
          data: Buffer.from('pdf').toString('base64'),
          url: null,
          link_title: null,
        },
      ],
    });
    const { manifest, problems } = readCoursePackage(buffer);
    assert.equal(manifest.template.title, 'Khoá mẫu');
    assert.match(problems.get('r2') ?? '', /Mã băm/);
    const remapped = remapContent(manifest.template.content, new Map([['r1', 'moi-1']]));
    assert.deepEqual(
      remapped.content.sections[0]?.items.map((item) => [item.key, item.settings.resource_id ?? null]),
      [
        ['a', 'moi-1'],
        ['c', null],
      ],
    );
    assert.deepEqual(remapped.dropped, [{ title: 'Phiếu', reason: 'Học liệu của hoạt động không nhập được' }]);
    assert.throws(
      () => readCoursePackage(Buffer.from('x')),
      (error: unknown) =>
        /gói khoá học/.test((error as { details: Array<{ message: string }> }).details[0]?.message ?? ''),
    );
  });
});
