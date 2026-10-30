import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FieldError } from '@school-management/server';
import { cancelBlock, parsePlanInput, parseSchoolSettings, purchaseLine, upgradeLine } from './school-sales-rules.js';

// Quy tắc thuần của Gia sư AI do trường bán (YCTD-383 lát L1a, YCTD-387): giá trị biên của khung giờ, gói, điều kiện hủy, câu chữ dòng
// thu. Dữ liệu bịa
describe('Gia sư AI trường bán: quy tắc thuần', () => {
  it('khung giờ biên 00:00 và 23:59 hợp lệ; 24:00, 7:00, giờ trùng không hợp lệ', () => {
    const errors: FieldError[] = [];
    assert.deepEqual(parseSchoolSettings({ enabled_levels: [], quiet_start: '23:59', quiet_end: '00:00' }, errors), {
      enabled_levels: [],
      quiet_start: '23:59',
      quiet_end: '00:00',
    });
    assert.deepEqual(errors, []);
    const wrong: FieldError[] = [];
    parseSchoolSettings({ enabled_levels: 'THCS', quiet_start: '24:00', quiet_end: '7:00' }, wrong);
    assert.deepEqual(wrong.map((error) => error.field).sort(), ['enabled_levels', 'quiet_end', 'quiet_start']);
    const same: FieldError[] = [];
    parseSchoolSettings({ enabled_levels: ['TH'], quiet_start: '06:00', quiet_end: '06:00' }, same);
    assert.deepEqual(
      same.map((error) => error.field),
      ['quiet_end'],
    );
  });

  it('gói: giá biên 0 và 100 triệu, lượt 1 và 100.000 hợp lệ; vượt biên, số lẻ không hợp lệ; cấp xếp theo thứ tự', () => {
    const ok: FieldError[] = [];
    const plan = parsePlanInput(
      { kind: 'monthly', name: 'A', price: 100_000_000, turns: 100_000, school_levels: ['THPT', 'TH'] },
      ok,
    );
    assert.deepEqual(ok, []);
    assert.deepEqual(plan.school_levels, ['TH', 'THPT']);
    assert.equal(parsePlanInput({ kind: 'top_up', name: 'B', price: 0, turns: 1, school_levels: ['TH'] }, []).price, 0);
    const wrong: FieldError[] = [];
    parsePlanInput({ kind: 'monthly', name: 'C', price: 100_000_001, turns: 1.5, school_levels: ['TH'] }, wrong);
    assert.deepEqual(wrong.map((error) => error.field).sort(), ['price', 'turns']);
    const noKind: FieldError[] = [];
    parsePlanInput({ name: 'D', price: 1, turns: 1, school_levels: ['TH'] }, noKind);
    assert.deepEqual(
      noKind.map((error) => error.field),
      ['kind'],
    );
  });

  it('hủy: chỉ lần mua của trường còn hiệu lực, chưa lên hóa đơn, chưa dùng hoặc giữ lượt', () => {
    const row = { planSource: 'school', status: 'active', usedTurns: 0, heldTurns: 0 };
    assert.equal(cancelBlock(row, false), null);
    assert.equal(cancelBlock({ ...row, status: 'pending' }, false), null);
    assert.equal(cancelBlock({ ...row, planSource: 'platform' }, false), 'not_school');
    assert.equal(cancelBlock({ ...row, status: 'cancelled' }, false), 'not_cancellable');
    assert.equal(cancelBlock(row, true), 'invoiced');
    assert.equal(cancelBlock({ ...row, usedTurns: 1 }, false), 'turns_used');
    assert.equal(cancelBlock({ ...row, heldTurns: 1 }, false), 'turns_used');
  });

  it('câu chữ dòng thu của lần mua gói tháng, gói lượt và lần nâng', () => {
    const createdAt = new Date('2026-10-30T03:00:00Z');
    assert.deepEqual(
      purchaseLine({ planKind: 'monthly', planName: 'Cơ bản', periodMonth: '2026-11-01', turns: 100, createdAt }),
      { description: 'Gia sư AI: Cơ bản tháng 11/2026', basisNote: 'Mua ngày 30/10/2026' },
    );
    assert.equal(
      purchaseLine({ planKind: 'top_up', planName: 'Gói 50 lượt', periodMonth: null, turns: 50, createdAt }).basisNote,
      '50 lượt, mua ngày 30/10/2026, dùng trong 12 tháng',
    );
    assert.deepEqual(
      upgradeLine({
        fromPlanName: 'Cơ bản',
        toPlanName: 'Nâng cao',
        periodMonth: '2026-10-01',
        remainingDays: 2,
        daysInMonth: 31,
        extraTurns: 13,
      }),
      {
        description: 'Gia sư AI: nâng Cơ bản lên Nâng cao tháng 10/2026',
        basisNote: 'Chênh lệch theo 2/31 ngày còn lại; cộng 13 lượt',
      },
    );
  });
});
