import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aiTutorAccess, isQuietTime, vietnamMinuteOfDay, type AiTutorAccessInput } from './ai-tutor-access.js';
import { excerptOf } from './safety-flags.js';

// Hàm thuần của khóa gia sư AI (YCTD-383 lát L3), kịch bản CT-1779: biên khung giờ 21:59, 22:00, 05:59, 06:00 theo giờ Việt Nam (máy
// chủ chạy giờ UTC), khung giờ không qua nửa đêm, thứ tự ưu tiên các khóa, đoạn trích câu em gửi cho giáo viên chủ nhiệm
const vietnam = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);

const base: AiTutorAccessInput = {
  readOnly: false,
  exam: null,
  blockedAssignment: null,
  quietStart: '22:00',
  quietEnd: '06:00',
  now: vietnam('2026-10-30', '10:00'),
};

describe('Gia sư AI: điểm kiểm tra khóa', () => {
  it('giờ Việt Nam tính từ giờ UTC, không phụ thuộc múi giờ của máy chủ', () => {
    assert.equal(vietnamMinuteOfDay(new Date('2026-10-30T14:59:00Z')), 21 * 60 + 59);
    assert.equal(vietnamMinuteOfDay(new Date('2026-10-30T15:00:00Z')), 22 * 60);
    assert.equal(vietnamMinuteOfDay(new Date('2026-10-30T22:59:00Z')), 5 * 60 + 59);
    assert.equal(vietnamMinuteOfDay(new Date('2026-10-30T23:00:00Z')), 6 * 60);
  });

  it('khung giờ mặc định 22:00 đến 6:00: 21:59 mở, 22:00 khóa, 05:59 khóa, 06:00 mở', () => {
    assert.equal(isQuietTime(vietnam('2026-10-30', '21:59'), '22:00', '06:00'), false);
    assert.equal(isQuietTime(vietnam('2026-10-30', '22:00'), '22:00', '06:00'), true);
    assert.equal(isQuietTime(vietnam('2026-10-31', '00:00'), '22:00', '06:00'), true);
    assert.equal(isQuietTime(vietnam('2026-10-31', '05:59'), '22:00', '06:00'), true);
    assert.equal(isQuietTime(vietnam('2026-10-31', '06:00'), '22:00', '06:00'), false);
  });

  it('khung giờ trong ngày (không qua nửa đêm) và khung giờ bằng nhau', () => {
    assert.equal(isQuietTime(vietnam('2026-10-30', '11:59'), '12:00', '13:30'), false);
    assert.equal(isQuietTime(vietnam('2026-10-30', '12:00'), '12:00', '13:30'), true);
    assert.equal(isQuietTime(vietnam('2026-10-30', '13:29'), '12:00', '13:30'), true);
    assert.equal(isQuietTime(vietnam('2026-10-30', '13:30'), '12:00', '13:30'), false);
    assert.equal(isQuietTime(vietnam('2026-10-30', '12:00'), '12:00', '12:00'), false);
  });

  it('thông báo khóa theo bản mẫu MH-597', () => {
    assert.deepEqual(aiTutorAccess(base), { allowed: true });
    assert.deepEqual(aiTutorAccess({ ...base, now: vietnam('2026-10-30', '22:00') }), {
      allowed: false,
      code: 'quiet_hours',
      title: 'Ngoài giờ dùng.',
      message: 'Gia sư AI mở lại lúc 6:00.',
    });
    assert.deepEqual(aiTutorAccess({ ...base, exam: { title: 'Kiểm tra giữa kỳ Toán' } }), {
      allowed: false,
      code: 'exam',
      title: 'Đang trong giờ kiểm tra.',
      message: 'Gia sư AI tạm khóa đến khi em nộp bài Kiểm tra giữa kỳ Toán.',
    });
    const assignment = aiTutorAccess({ ...base, blockedAssignment: { title: 'Viết đoạn văn nghị luận' } });
    assert.equal(assignment.allowed, false);
    assert.equal(assignment.allowed === false && assignment.code, 'assignment');
    assert.match(assignment.allowed === false ? assignment.message : '', /"Viết đoạn văn nghị luận" là bài tự làm/);
    const custom = aiTutorAccess({
      ...base,
      quietStart: '21:00',
      quietEnd: '07:30',
      now: vietnam('2026-10-30', '21:00'),
    });
    assert.equal(custom.allowed === false && custom.message, 'Gia sư AI mở lại lúc 7:30.');
  });

  it('nhiều khóa cùng lúc: chỉ đọc, đang thi, bài tập, khung giờ', () => {
    const all = {
      ...base,
      exam: { title: 'Đề A' },
      blockedAssignment: { title: 'Bài B' },
      now: vietnam('2026-10-30', '23:00'),
    };
    const codeOf = (input: AiTutorAccessInput) => {
      const access = aiTutorAccess(input);
      return access.allowed ? 'open' : access.code;
    };
    assert.equal(codeOf({ ...all, readOnly: true }), 'read_only');
    assert.equal(codeOf(all), 'exam');
    assert.equal(codeOf({ ...all, exam: null }), 'assignment');
    assert.equal(codeOf({ ...all, exam: null, blockedAssignment: null }), 'quiet_hours');
  });

  it('đoạn trích câu em gửi: gộp khoảng trắng, tối đa 160 ký tự', () => {
    assert.equal(excerptOf('  Em   buồn\nquá  '), 'Em buồn quá');
    const long = 'a'.repeat(300);
    const excerpt = excerptOf(long);
    assert.equal(excerpt.length, 160);
    assert.ok(excerpt.endsWith('…'));
  });
});
