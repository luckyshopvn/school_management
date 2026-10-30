import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GATE_CARD_CODE_PATTERN,
  generateGateCardCode,
  isDuplicatePass,
  normalizeGateCardCode,
  shouldAutoMarkLate,
  suggestAttendanceStatus,
  vietnamTimeOfDay,
} from './gate-pass-rules.js';

// Quy tắc lượt qua cổng (YCTD-389): giờ Việt Nam, gộp lượt quét lại, gợi ý trạng thái, tự ghi đi muộn
const at = (iso: string) => new Date(iso);

describe('Quy tắc lượt qua cổng', () => {
  it('mã thẻ 16 ký tự base32, mỗi lần một mã khác', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateGateCardCode()));
    assert.equal(codes.size, 200);
    for (const code of codes) {
      assert.match(code, GATE_CARD_CODE_PATTERN);
    }
  });

  it('chuẩn hóa mã gõ tay: bỏ khoảng trắng, gạch nối, đổi chữ hoa', () => {
    assert.equal(normalizeGateCardCode(' abcd-efgh ijkl-mnop '), 'ABCDEFGHIJKLMNOP');
  });

  it('giờ theo múi giờ Việt Nam, kể cả lúc đổi ngày theo giờ quốc tế', () => {
    assert.equal(vietnamTimeOfDay(at('2026-10-30T00:08:00Z')), '07:08');
    assert.equal(vietnamTimeOfDay(at('2026-10-29T17:30:00Z')), '00:30');
  });

  it('cùng hướng trong 5 phút là một lượt; khác hướng hoặc quá 5 phút là lượt mới', () => {
    const previous = { direction: 'in' as const, passed_at: at('2026-10-30T00:00:00Z') };
    assert.equal(isDuplicatePass(previous, 'in', at('2026-10-30T00:05:00Z')), true);
    assert.equal(isDuplicatePass(previous, 'in', at('2026-10-30T00:05:01Z')), false);
    assert.equal(isDuplicatePass(previous, 'out', at('2026-10-30T00:01:00Z')), false);
    assert.equal(isDuplicatePass(undefined, 'in', at('2026-10-30T00:01:00Z')), false);
  });

  it('gợi ý có mặt khi vào trước hoặc đúng giờ học, đi muộn khi sau; không có lượt vào thì không gợi ý', () => {
    assert.equal(suggestAttendanceStatus(at('2026-10-30T00:15:00Z'), '07:15'), 'present');
    assert.equal(suggestAttendanceStatus(at('2026-10-30T00:16:00Z'), '07:15'), 'late');
    assert.equal(suggestAttendanceStatus(null, '07:15'), null);
  });

  describe('tự ghi đi muộn', () => {
    const base = {
      direction: 'in' as const,
      method: 'qr' as const,
      passedAt: at('2026-10-30T00:31:00Z'),
      schoolStartTime: '07:30',
      isSchoolDay: true,
      hasAttendanceRecord: false,
    };
    it('lượt vào bằng thẻ sau giờ học, ngày học, chưa điểm danh: tự ghi', () => {
      assert.equal(shouldAutoMarkLate(base), true);
    });
    it('đúng giờ học (giá trị biên) thì không tự ghi', () => {
      assert.equal(shouldAutoMarkLate({ ...base, passedAt: at('2026-10-30T00:30:00Z') }), false);
    });
    it('lượt từ camera khuôn mặt chỉ là gợi ý', () => {
      assert.equal(shouldAutoMarkLate({ ...base, method: 'camera' }), false);
    });
    it('thẻ RFID, máy chấm công cũng tự ghi', () => {
      assert.equal(shouldAutoMarkLate({ ...base, method: 'rfid' }), true);
      assert.equal(shouldAutoMarkLate({ ...base, method: 'device' }), true);
    });
    it('lượt ra, ngày không học, đã có điểm danh của giáo viên: không tự ghi', () => {
      assert.equal(shouldAutoMarkLate({ ...base, direction: 'out' }), false);
      assert.equal(shouldAutoMarkLate({ ...base, isSchoolDay: false }), false);
      assert.equal(shouldAutoMarkLate({ ...base, hasAttendanceRecord: true }), false);
    });
  });
});
