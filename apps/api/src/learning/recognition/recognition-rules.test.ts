import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  abbreviateName,
  certificateCode,
  configOf,
  courseCompleted,
  earnedBadges,
  longestOnTimeStreak,
  normalizeCode,
  parseConfig,
  verificationPage,
} from './recognition-rules.js';

// Quy tắc thuần của huy hiệu, chứng nhận hoàn thành (DT-28 phần 28i, YCTD-279)
const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T08:00:00Z`);

describe('Quy tắc huy hiệu, chứng nhận', () => {
  it('CT-28i-1: tắt mặc định; huy hiệu chương, khoá khi xong mọi hoạt động bắt buộc; nộp đúng hạn 5 lần liên tiếp', () => {
    assert.deepEqual(configOf(undefined), {
      badges_enabled: false,
      certificates_enabled: false,
      certificate: { title: 'Chứng nhận hoàn thành khoá học', signer_title: 'Hiệu trưởng', signer_name: '' },
    });
    assert.throws(() => parseConfig({ badges_enabled: 'có' }), /chưa hợp lệ/);
    const sections = [
      {
        id: 's1',
        title: 'Chương 1',
        activities: [
          { required: true, status: 'completed' },
          { required: false, status: 'not_started' },
        ],
      },
      { id: 's2', title: 'Chương 2', activities: [{ required: true, status: 'in_progress' }] },
      { id: 's3', title: 'Đọc thêm', activities: [{ required: false, status: 'not_started' }] },
    ];
    assert.deepEqual(
      earnedBadges(sections, []).map((badge) => badge.criterion_key),
      ['section:s1'],
    );
    assert.equal(courseCompleted(sections), false);
    const done = sections.map((section) => ({
      ...section,
      activities: section.activities.map((activity) => ({
        ...activity,
        status: activity.required ? 'passed' : activity.status,
      })),
    }));
    assert.equal(courseCompleted(done), true, 'chương không có hoạt động bắt buộc không tính');
    assert.deepEqual(
      earnedBadges(done, []).map((badge) => badge.kind),
      ['section_complete', 'section_complete', 'course_complete'],
    );
    assert.equal(courseCompleted([]), false);
    const submissions = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ late: day === 3, submitted_at: at(day) }));
    assert.equal(longestOnTimeStreak(submissions), 4, 'lần thứ 3 muộn cắt chuỗi');
    assert.equal(earnedBadges([], submissions).length, 0);
    const streak = [...submissions, { late: false, submitted_at: at(8) }];
    assert.deepEqual(earnedBadges([], streak), [
      {
        kind: 'on_time_streak',
        criterion_key: 'streak:5',
        section_id: null,
        title: 'Nộp bài đúng hạn 5 lần liên tiếp',
      },
    ]);
  });

  it('CT-28i-2: họ tên viết tắt, mã kiểm tra không có ký tự dễ nhầm; trang kiểm tra chỉ có tên khoá, ngày, trường, tên viết tắt', () => {
    assert.equal(abbreviateName('Nguyễn Văn An'), 'N. V. An');
    assert.equal(abbreviateName('  Lê   Thị Bích Ngọc '), 'L. T. B. Ngọc');
    assert.equal(abbreviateName('An'), 'An');
    const code = certificateCode(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 31]));
    assert.equal(code, 'CN-ABCDEFGHJ9');
    assert.match(certificateCode(), /^CN-[A-HJ-NP-Z2-9]{10}$/);
    assert.equal(normalizeCode(' cn-abcdefghj9 '), 'CN-ABCDEFGHJ9');
    assert.equal(normalizeCode('CN-123'), null);
    const page = verificationPage('CN-ABCDEFGHJ9', {
      course_title: 'Lập trình <Scratch>',
      school_name: 'Trường THCS thử',
      holder_short_name: 'N. V. An',
      issued_at: new Date('2026-11-20T03:00:00Z'),
      revoked_at: null,
    });
    assert.match(page, /Chứng nhận hợp lệ/);
    assert.match(page, /Lập trình &lt;Scratch&gt;/);
    assert.match(page, /N\. V\. An/);
    assert.match(page, /20\/11\/2026/);
    assert.ok(!page.includes('Nguyễn'), 'không có họ tên đầy đủ');
    assert.match(
      verificationPage('CN-ABCDEFGHJ9', {
        course_title: 'x',
        school_name: 'y',
        holder_short_name: 'z',
        issued_at: new Date(),
        revoked_at: new Date(),
      }),
      /đã bị thu hồi/,
    );
    assert.match(verificationPage('CN-KHONGCO', null), /Không tìm thấy chứng nhận/);
  });
});
